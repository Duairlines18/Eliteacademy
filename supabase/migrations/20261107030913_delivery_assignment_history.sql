-- Extends Phase 1; no existing athlete/workout/feedback data is rewritten.
alter table public.delivery_audit_events add column event_kind text not null default 'content'
  check(event_kind in ('content','assignment'));
alter table public.delivery_audit_events alter column programme_week_id drop not null;
alter table public.delivery_audit_events drop constraint delivery_audit_events_source_table_check;
alter table public.delivery_audit_events add constraint delivery_audit_events_source_table_check
  check(source_table in ('programme_weeks','session_blocks','athletes','cohorts','athlete_overrides','cohort_overrides'));
create index delivery_audit_subject_sequence on public.delivery_audit_events(source_table,subject_id,sequence_id desc);

create function delivery_audit_private.assignment_state(p_table text,p_row jsonb)
returns jsonb language sql immutable set search_path='' as $$
 select case when p_row is null then null else coalesce((select jsonb_object_agg(key,value)
 from jsonb_each(p_row) where key=any(case p_table
 when 'athletes' then array['id','athlete_type','organization_id','programme_id','cohort_id','current_week','current_phase','form_tier','access_status','access_reason','paid','payment_status','parent_user_id','athlete_user_id','coach_note','exercise_substitutions','programme_start_date']
 when 'cohorts' then array['id','organization_id','name','programme_id','current_week','current_phase','tier','status','expected_sessions_per_week','start_date','end_date']
 else array['id','athlete_id','cohort_id','programme_week_id','training_day_id','session_block_id','override_content','admin_note','active'] end)), '{}'::jsonb) end;
$$;

create function delivery_audit_private.assignment_context(p_table text,p_state jsonb)
returns jsonb language sql volatile security definer set search_path='' as $$
 select jsonb_build_object('state',p_state,
  'related_athlete_ids',coalesce((select jsonb_agg(a.id order by a.id) from public.athletes a
   where (p_table='athletes' and a.id=(p_state->>'id')::uuid)
    or (p_table in ('cohorts','cohort_overrides') and a.cohort_id=case when p_table='cohorts' then (p_state->>'id')::uuid else (p_state->>'cohort_id')::uuid end)
    or (p_table='athlete_overrides' and a.id=(p_state->>'athlete_id')::uuid)),'[]'::jsonb),
  'week_context',coalesce((select jsonb_agg((delivery_audit_private.snapshot_week(w.id)-'assignment_context'-'cohort_context')||jsonb_build_object('tier_name',(select t.name from public.programme_tiers t where t.id=w.tier_id)) order by w.id)
   from public.programme_weeks w where
    (p_table in ('athlete_overrides','cohort_overrides') and w.id=(p_state->>'programme_week_id')::uuid)
    or (p_table='cohorts' and w.programme_id=(p_state->>'programme_id')::uuid and w.week_number=(p_state->>'current_week')::integer
      and (((p_state->>'tier') is null and w.tier_id is null) or exists(select 1 from public.programme_tiers t where t.id=w.tier_id and t.programme_id=w.programme_id and t.name=p_state->>'tier')))
    or (p_table='athletes' and ((w.programme_id=(p_state->>'programme_id')::uuid and w.week_number=(p_state->>'current_week')::integer and w.tier_id is null)
      or exists(select 1 from public.cohorts c where c.id=(p_state->>'cohort_id')::uuid and w.programme_id=c.programme_id and w.week_number=c.current_week
       and ((c.tier is null and w.tier_id is null) or exists(select 1 from public.programme_tiers t where t.id=w.tier_id and t.programme_id=w.programme_id and t.name=c.tier)))))),'[]'::jsonb));
$$;

create function delivery_audit_private.record_assignment() returns trigger
language plpgsql security definer set search_path='' as $$
declare prior jsonb; saved jsonb; sid uuid; wid uuid;
begin
 if tg_op<>'INSERT' then prior:=delivery_audit_private.assignment_state(tg_table_name,to_jsonb(old));sid:=old.id;end if;
 if tg_op<>'DELETE' then saved:=delivery_audit_private.assignment_state(tg_table_name,to_jsonb(new));sid:=new.id;end if;
 if prior is not distinct from saved then return null;end if;
 wid:=coalesce((saved->>'programme_week_id')::uuid,(prior->>'programme_week_id')::uuid);
 insert into public.delivery_audit_events(event_kind,source_table,operation,subject_id,subject_ids,programme_week_id,actor_user_id,actor_role,before_snapshot,after_snapshot)
 values('assignment',tg_table_name,tg_op,sid,array[sid],wid,auth.uid(),coalesce(nullif(auth.role(),''),session_user),
   case when prior is not null then delivery_audit_private.assignment_context(tg_table_name,prior) end,
   delivery_audit_private.assignment_context(tg_table_name,saved));
 return null;
end;
$$;
revoke all on all functions in schema delivery_audit_private from public,anon,authenticated,service_role;
create trigger delivery_audit_athlete_assignment after insert or update or delete on public.athletes
for each row execute function delivery_audit_private.record_assignment();
create trigger delivery_audit_cohort_assignment after insert or update or delete on public.cohorts
for each row execute function delivery_audit_private.record_assignment();
create trigger delivery_audit_athlete_override after insert or update or delete on public.athlete_overrides
for each row execute function delivery_audit_private.record_assignment();
create trigger delivery_audit_cohort_override after insert or update or delete on public.cohort_overrides
for each row execute function delivery_audit_private.record_assignment();

-- Invoker security + explicit admin check; the table's existing admin-only RLS still applies.
-- Summaries are small; full private snapshots are returned only for a scoped detail request.
create function public.admin_delivery_history(
 p_subject_type text,p_subject_id uuid,p_before_sequence bigint default null,
 p_limit integer default 20,p_event_id uuid default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.admin_profiles a where a.user_id=(select auth.uid())) then raise exception 'Admin access required';end if;
 if p_subject_type not in ('athlete','cohort') or p_subject_type is null or p_subject_id is null
   or p_limit is null or p_limit<1 or p_limit>50 or p_before_sequence<=0 then raise exception 'Invalid history request';end if;
 with matching as (
  select e.* from public.delivery_audit_events e where (p_before_sequence is null or e.sequence_id<p_before_sequence)
   and (p_event_id is null or e.event_id=p_event_id) and (
    (p_subject_type='athlete' and (
      (e.source_table='athletes' and (e.subject_id=p_subject_id or e.before_snapshot->'state'->>'id'=p_subject_id::text))
      or coalesce(e.before_snapshot->'related_athlete_ids','[]'::jsonb) ? p_subject_id::text
      or coalesce(e.after_snapshot->'related_athlete_ids','[]'::jsonb) ? p_subject_id::text
      or exists(select 1 from jsonb_array_elements(coalesce(e.before_snapshot->'assignment_context','[]'::jsonb)||coalesce(e.after_snapshot->'assignment_context','[]'::jsonb)) a where a->>'athlete_id'=p_subject_id::text)))
    or (p_subject_type='cohort' and (
      (e.source_table='cohorts' and (e.subject_id=p_subject_id or e.before_snapshot->'state'->>'id'=p_subject_id::text))
      or e.before_snapshot->'state'->>'cohort_id'=p_subject_id::text or e.after_snapshot->'state'->>'cohort_id'=p_subject_id::text
      or exists(select 1 from jsonb_array_elements(coalesce(e.before_snapshot->'cohort_context','[]'::jsonb)||coalesce(e.after_snapshot->'cohort_context','[]'::jsonb)) c where c->>'id'=p_subject_id::text)))
   ) order by e.sequence_id desc limit p_limit+1
 ), page as (select * from matching order by sequence_id desc limit p_limit)
 select jsonb_build_object('events',coalesce((select jsonb_agg(case when p_event_id is not null then to_jsonb(p)
   else jsonb_build_object('event_id',p.event_id,'sequence_id',p.sequence_id::text,'recorded_at',p.recorded_at,'event_kind',p.event_kind,
    'source_table',p.source_table,'operation',p.operation,'actor_role',p.actor_role,'actor_user_id',p.actor_user_id,'programme_week_id',p.programme_week_id) end order by p.sequence_id desc) from page p),'[]'::jsonb),
   'has_more',(select count(*)>p_limit from matching),
   'next_before_sequence',case when (select count(*)>p_limit from matching) then (select min(sequence_id)::text from page) end)
 into result;
 return result;
end;
$$;
revoke all on function public.admin_delivery_history(text,uuid,bigint,integer,uuid) from public,anon,service_role;
grant execute on function public.admin_delivery_history(text,uuid,bigint,integer,uuid) to authenticated;
