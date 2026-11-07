-- Additive audit only. No backfill, no publishing/RLS/auth/assignment behaviour changes.
create schema delivery_audit_private;
revoke all on schema delivery_audit_private from public, anon, authenticated, service_role;

create table public.delivery_audit_events (
  sequence_id bigint generated always as identity primary key,
  event_id uuid not null default gen_random_uuid() unique,
  schema_version integer not null default 1 check (schema_version=1),
  recorded_at timestamptz not null default clock_timestamp(),
  transaction_id bigint not null default txid_current(),
  source_table text not null check (source_table in ('programme_weeks','session_blocks')),
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  subject_id uuid not null,
  subject_ids uuid[] not null,
  -- Deliberately no cascading FK: history survives removal of mutable source rows.
  programme_week_id uuid not null,
  actor_user_id uuid,
  actor_role text not null,
  before_snapshot jsonb,
  after_snapshot jsonb not null
);
create index delivery_audit_week_sequence on public.delivery_audit_events(programme_week_id,sequence_id desc);
alter table public.delivery_audit_events enable row level security;
revoke all on public.delivery_audit_events from public, anon, authenticated, service_role;
revoke all on sequence public.delivery_audit_events_sequence_id_seq from public, anon, authenticated, service_role;
grant select on public.delivery_audit_events to authenticated, service_role;
create policy delivery_audit_admin_read on public.delivery_audit_events for select to authenticated
  using (exists(select 1 from public.admin_profiles a where a.user_id=(select auth.uid())));
comment on table public.delivery_audit_events is 'Append-only database-state evidence for week and published block mutations. Not proof of recipient viewing. Other mutation types require subsequent coverage.';

create function delivery_audit_private.immutable_event() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'Delivery audit history is immutable'; end;
$$;
create trigger delivery_audit_immutable before update or delete or truncate on public.delivery_audit_events
for each statement execute function delivery_audit_private.immutable_event();

-- VOLATILE is intentional: an AFTER trigger must see changes from its own statement.
-- Override only the changed row to reconstruct the before-image without writing it back.
create function delivery_audit_private.snapshot_week(
  p_week_id uuid, p_week_override jsonb default null,
  p_changed_block_ids uuid[] default null, p_old_blocks jsonb default null
) returns jsonb language sql volatile security definer set search_path='' as $$
  select jsonb_build_object(
    'week',coalesce(p_week_override,to_jsonb(w)),
    'programme',to_jsonb(p),
    'days',coalesce((
      select jsonb_agg(to_jsonb(d)||jsonb_build_object('blocks',coalesce((
        select jsonb_agg(x.row order by (x.row->>'sort_order')::integer nulls last,x.row->>'id') from (
          select to_jsonb(b) as row from public.session_blocks b
          where b.training_day_id=d.id and (p_changed_block_ids is null or not (b.id=any(p_changed_block_ids)))
          union all select old_block from jsonb_array_elements(coalesce(p_old_blocks,'[]'::jsonb)) old_block where old_block->>'training_day_id'=d.id::text
        ) x
      ),'[]'::jsonb)) order by (to_jsonb(d)->>'sort_order')::integer nulls last,d.id)
      from public.training_days d where d.programme_week_id=p_week_id
    ),'[]'::jsonb),
    -- Preserve canonical definitions as they were. Whole library supports legacy name links;
    -- snapshots intentionally omit internal exercise admin notes.
    'exercise_library',coalesce((select jsonb_agg(to_jsonb(e)-'admin_notes' order by e.code,e.id) from public.exercises e),'[]'::jsonb),
    -- These are candidate assignments, not a claim of actual delivery/login/viewing.
    -- Include direct and cohort context so a later reassignment cannot rewrite this evidence.
    'assignment_context',coalesce((select jsonb_agg(jsonb_build_object(
      'athlete_id',a.id,'athlete_type',a.athlete_type,'access_status',a.access_status,
      'direct_programme_id',a.programme_id,'direct_current_week',a.current_week,
      'cohort_id',a.cohort_id,'cohort_programme_id',c.programme_id,'cohort_current_week',c.current_week,
      'cohort_status',c.status,'cohort_tier',c.tier,'form_tier',a.form_tier,
      'parent_user_id',a.parent_user_id,'athlete_user_id',a.athlete_user_id,
      'exercise_substitutions',to_jsonb(a)->'exercise_substitutions','coach_note',to_jsonb(a)->'coach_note'
    ) order by a.id) from public.athletes a left join public.cohorts c on c.id=a.cohort_id
      where a.access_status='active' and (a.programme_id=w.programme_id or c.programme_id=w.programme_id)),'[]'::jsonb),
    'cohort_context',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'programme_id',c.programme_id,
      'current_week',c.current_week,'tier',c.tier,'status',c.status) order by c.id)
      from public.cohorts c where c.programme_id=w.programme_id),'[]'::jsonb)
  ) from public.programme_weeks w left join public.programmes p on p.id=w.programme_id where w.id=p_week_id;
$$;

create function delivery_audit_private.record_week() returns trigger
language plpgsql security definer set search_path='' as $$
declare before_image jsonb;
begin
  if tg_op='UPDATE' and to_jsonb(old) is not distinct from to_jsonb(new) then return null; end if;
  if tg_op='INSERT' then
    if new.published_at is null then return null; end if;
    before_image:=null;
  else
    if old.published_at is null and new.published_at is null and not exists(
      select 1 from public.delivery_audit_events where programme_week_id=new.id
    ) then return null; end if;
    before_image:=delivery_audit_private.snapshot_week(new.id,to_jsonb(old));
  end if;
  insert into public.delivery_audit_events(source_table,operation,subject_id,subject_ids,programme_week_id,actor_user_id,actor_role,before_snapshot,after_snapshot)
    values(tg_table_name,tg_op,new.id,array[new.id],new.id,auth.uid(),coalesce(nullif(auth.role(),''),session_user),
      before_image,delivery_audit_private.snapshot_week(new.id));
  return null;
end;
$$;

-- Transition tables reconstruct ALL changed rows, including bulk Quick Write/RPC writes.
-- Row-level AFTER triggers would incorrectly mix other rows' new state into the before image.
create function delivery_audit_private.record_blocks() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  wid uuid; changed_ids uuid[]; old_rows jsonb:='[]'; new_rows jsonb:='[]';
begin
  if tg_op='UPDATE' then
    select coalesce(jsonb_agg(to_jsonb(o)),'[]') into old_rows
      from du_audit_old_blocks o join du_audit_new_blocks n using(id) where to_jsonb(o) is distinct from to_jsonb(n);
    select coalesce(jsonb_agg(to_jsonb(n)),'[]') into new_rows
      from du_audit_new_blocks n join du_audit_old_blocks o using(id) where to_jsonb(o) is distinct from to_jsonb(n);
  elsif tg_op='INSERT' then
    select coalesce(jsonb_agg(to_jsonb(n)),'[]') into new_rows from du_audit_new_blocks n;
  else
    select coalesce(jsonb_agg(to_jsonb(o)),'[]') into old_rows from du_audit_old_blocks o;
  end if;
  select array_agg(distinct (r->>'id')::uuid order by (r->>'id')::uuid) into changed_ids from jsonb_array_elements(old_rows||new_rows) r;
  if changed_ids is null then return null; end if;
  for wid in
    select distinct d.programme_week_id from jsonb_array_elements(old_rows||new_rows) r
      join public.training_days d on d.id=(r->>'training_day_id')::uuid
      join public.programme_weeks w on w.id=d.programme_week_id
      where w.published_at is not null or exists(select 1 from public.delivery_audit_events e where e.programme_week_id=w.id)
  loop
    insert into public.delivery_audit_events(source_table,operation,subject_id,subject_ids,programme_week_id,actor_user_id,actor_role,before_snapshot,after_snapshot)
      values(tg_table_name,tg_op,changed_ids[1],changed_ids,wid,auth.uid(),coalesce(nullif(auth.role(),''),session_user),
        delivery_audit_private.snapshot_week(wid,null,changed_ids,old_rows),delivery_audit_private.snapshot_week(wid));
  end loop;
  return null;
end;
$$;
revoke all on all functions in schema delivery_audit_private from public, anon, authenticated, service_role;
create trigger delivery_audit_week after insert or update on public.programme_weeks
for each row execute function delivery_audit_private.record_week();
create trigger delivery_audit_block_insert after insert on public.session_blocks
referencing new table as du_audit_new_blocks for each statement execute function delivery_audit_private.record_blocks();
create trigger delivery_audit_block_update after update on public.session_blocks
referencing old table as du_audit_old_blocks new table as du_audit_new_blocks for each statement execute function delivery_audit_private.record_blocks();
create trigger delivery_audit_block_delete after delete on public.session_blocks
referencing old table as du_audit_old_blocks for each statement execute function delivery_audit_private.record_blocks();
