-- Additive and opt-in. Apply before deploying Edge functions; activate only after release approval.
create table public.weekly_checkin_config (
 id boolean primary key default true check(id),
 enabled boolean not null default false,
 timezone text not null default 'America/Chicago',
 end_rollout date not null default '2026-11-13',
 start_rollout date not null default '2026-11-16'
);
insert into public.weekly_checkin_config(id) values(true);
alter table public.athletes add column checkin_timezone text;
create table public.weekly_checkin_requirements (
 id uuid primary key default gen_random_uuid(),
 athlete_id uuid not null references public.athletes(id),
 programme_week_id uuid not null references public.programme_weeks(id),
 week_number integer not null,
 kind text not null check(kind in ('start','end')),
 period_start date not null,
 due_date date not null,
 feedback_id uuid references public.feedback(id),
 submitted_at timestamptz,
 revision integer not null default 0,
 created_at timestamptz not null default now(),
 unique(athlete_id,programme_week_id,kind)
);
create index weekly_checkin_pending on public.weekly_checkin_requirements(athlete_id,due_date) where submitted_at is null;
create table public.weekly_checkin_receipts (
 submission_id text primary key,
 requirement_id uuid references public.weekly_checkin_requirements(id),
 feedback_id uuid references public.feedback(id),
 actor_user_id uuid not null,
 payload jsonb not null,
 revision integer not null,
 created_at timestamptz not null default now()
);
create table public.weekly_checkin_holds (
 id uuid primary key default gen_random_uuid(),
 athlete_id uuid not null references public.athletes(id),
 feedback_id uuid not null references public.feedback(id),
 generation integer not null default 1,
 reported_payload jsonb not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 released_at timestamptz,
 released_by uuid,
 release_note text,
 unique(feedback_id)
);
create index weekly_checkin_open_holds on public.weekly_checkin_holds(athlete_id) where released_at is null;
create table public.weekly_checkin_review_events (
 id uuid primary key default gen_random_uuid(),
 hold_id uuid not null references public.weekly_checkin_holds(id),
 generation integer not null,
 admin_user_id uuid not null,
 reported_payload jsonb not null,
 note text not null,
 created_at timestamptz not null default now()
);
-- Eligible accounts access their own ledger through the verified Edge handler. Direct reads are admin-only. All writes and receipts are server-only.
alter table public.weekly_checkin_config enable row level security;
alter table public.weekly_checkin_requirements enable row level security;
alter table public.weekly_checkin_receipts enable row level security;
alter table public.weekly_checkin_holds enable row level security;
alter table public.weekly_checkin_review_events enable row level security;
revoke all on public.weekly_checkin_config,public.weekly_checkin_requirements,public.weekly_checkin_receipts,public.weekly_checkin_holds,public.weekly_checkin_review_events from public,anon,authenticated;
grant select on public.weekly_checkin_config,public.weekly_checkin_requirements,public.weekly_checkin_holds,public.weekly_checkin_review_events to authenticated;
grant select,insert,update on public.weekly_checkin_config,public.weekly_checkin_requirements,public.weekly_checkin_receipts,public.weekly_checkin_holds,public.weekly_checkin_review_events to service_role;
create policy checkin_config_admin on public.weekly_checkin_config for select to authenticated
 using(exists(select 1 from public.admin_profiles ap where ap.user_id=(select auth.uid())));
create policy checkin_requirements_owner_or_admin on public.weekly_checkin_requirements for select to authenticated
 using(exists(select 1 from public.admin_profiles ap where ap.user_id=(select auth.uid())));
create policy checkin_holds_owner_or_admin on public.weekly_checkin_holds for select to authenticated
 using(exists(select 1 from public.admin_profiles ap where ap.user_id=(select auth.uid())));
create policy checkin_review_admin on public.weekly_checkin_review_events for select to authenticated
 using(exists(select 1 from public.admin_profiles ap where ap.user_id=(select auth.uid())));
create trigger weekly_checkin_reviews_immutable before update or delete or truncate on public.weekly_checkin_review_events
 for each statement execute function feedback_history_private.immutable_event();

-- Privileged RPCs run as invoker, with an empty search path; no client execution grants.
-- The caller passes ONLY the already verified identity, never a browser-selected athlete ID.
create function public.weekly_checkin_state(p_actor uuid,p_audience text,p_now timestamptz default now())
returns jsonb language plpgsql set search_path='' as $$
declare cfg public.weekly_checkin_config%rowtype; a public.athletes%rowtype;
 w public.programme_weeks%rowtype; c public.cohorts%rowtype; today date; monday date; starts date;
 candidate date; reqs jsonb; due jsonb; holds jsonb; timezone_name text;
begin
 select * into strict cfg from public.weekly_checkin_config where id;
 if not cfg.enabled then return jsonb_build_object('enabled',false,'due','[]'::jsonb,'requirements','[]'::jsonb,'held',false,'holds','[]'::jsonb);end if;
 if p_actor is null or (p_audience is null or p_audience not in ('parent','private-athlete')) then raise exception 'Check-in access denied';end if;
 select * into a from public.athletes where
  case when p_audience='parent' then parent_user_id=p_actor else athlete_user_id=p_actor end for update;
 if not found then raise exception 'Check-in access denied';end if;
 timezone_name:=coalesce(a.checkin_timezone,cfg.timezone);
 today:=(p_now at time zone timezone_name)::date;
 monday:=today-(extract(isodow from today)::integer-1);
 if a.access_status='active' and a.onboarding_complete is true
  and ((a.access_reason='complimentary' and a.payment_status='not_required')
   or (a.access_reason='manual_payment' and a.payment_status='manually_confirmed')
   or (a.access_reason='stripe' and a.payment_status='paid')) and today>=cfg.end_rollout then
  if a.programme_id is not null then
   select * into w from public.programme_weeks where programme_id=a.programme_id and week_number=a.current_week and tier_id is null
    and status in ('live','completed') and verification_status='verified' and published_at is not null;
   candidate:=a.programme_start_date+((a.current_week-1)*7);
  elsif a.cohort_id is not null then
   select * into c from public.cohorts where id=a.cohort_id and status='live';
   select pw.* into w from public.programme_weeks pw where pw.programme_id=c.programme_id and pw.week_number=c.current_week
    and (case when c.tier is null then pw.tier_id is null else pw.tier_id in (select pt.id from public.programme_tiers pt where pt.programme_id=c.programme_id and pt.name=c.tier) end)
    and pw.status in ('live','completed') and pw.verification_status='verified' and pw.published_at is not null;
   candidate:=c.start_date+((c.current_week-1)*7);
  end if;
  if w.id is not null then
   -- Never backfill historical weeks. Freeze enrollment dates so repeat logins cannot move due dates.
   starts:=case when candidate between monday and monday+6 then candidate else monday end;
   select period_start into candidate from public.weekly_checkin_requirements where athlete_id=a.id and programme_week_id=w.id limit 1;
   starts:=coalesce(candidate,starts);
   insert into public.weekly_checkin_requirements(athlete_id,programme_week_id,week_number,kind,period_start,due_date)
    values(a.id,w.id,w.week_number,'end',starts,greatest(starts+4,cfg.end_rollout)) on conflict do nothing;
   if starts>=cfg.start_rollout then
    insert into public.weekly_checkin_requirements(athlete_id,programme_week_id,week_number,kind,period_start,due_date)
     values(a.id,w.id,w.week_number,'start',starts,least(starts,today)) on conflict do nothing;
   end if;
  end if;
 end if;
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('payload',f.payload) order by r.period_start,r.kind desc),'[]') into reqs
  from public.weekly_checkin_requirements r left join public.feedback f on f.id=r.feedback_id where r.athlete_id=a.id;
 select coalesce(jsonb_agg(item order by item->>'due_date',item->>'kind' desc),'[]') into due
  from jsonb_array_elements(reqs) item where item->>'submitted_at' is null and (item->>'due_date')::date<=today;
 select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'generation',h.generation,'created_at',h.created_at)),'[]') into holds
  from public.weekly_checkin_holds h where h.athlete_id=a.id and h.released_at is null;
 return jsonb_build_object('enabled',true,'today',today,'timezone',timezone_name,'due',due,'requirements',reqs,'held',jsonb_array_length(holds)>0,'holds',holds);
end;$$;

create function public.save_weekly_checkin(p_actor uuid,p_audience text,p_requirement uuid,p_submission text,p_payload jsonb,p_expected_revision integer,p_safety boolean,p_now timestamptz default now())
returns jsonb language plpgsql set search_path='' as $$
declare a public.athletes%rowtype; r public.weekly_checkin_requirements%rowtype; receipt public.weekly_checkin_receipts%rowtype;
 fid uuid; today date; cfg public.weekly_checkin_config%rowtype;
begin
 if p_actor is null or (p_audience is null or p_audience not in ('parent','private-athlete')) then raise exception 'Check-in access denied';end if;
 select * into r from public.weekly_checkin_requirements where id=p_requirement;
 if not found then raise exception 'Check-in access denied';end if;
 -- Lock order matches state enrollment: athlete first, then requirement.
 select * into a from public.athletes where id=r.athlete_id and
  case when p_audience='parent' then parent_user_id=p_actor else athlete_user_id=p_actor end for update;
 if not found then raise exception 'Check-in access denied';end if;
 select * into r from public.weekly_checkin_requirements where id=p_requirement for update;
 if p_submission is null or p_submission !~ '^[A-Za-z0-9-]{16,80}$' or jsonb_typeof(p_payload)<>'object' or p_payload->>'formVersion' is distinct from '2.0' or p_safety is null then raise exception 'Invalid check-in information';end if;
 select * into receipt from public.weekly_checkin_receipts where submission_id=p_submission;
 if found then
  if receipt.requirement_id<>r.id or receipt.actor_user_id<>p_actor or receipt.payload is distinct from p_payload then raise exception 'Invalid check-in retry';end if;
  return jsonb_build_object('saved',true,'id',r.feedback_id,'revision',r.revision,'duplicate',true);
 end if;
 select * into strict cfg from public.weekly_checkin_config where id;
 if not cfg.enabled then raise exception 'Check-ins are not active';end if;
 today:=(p_now at time zone coalesce(a.checkin_timezone,cfg.timezone))::date;
 if r.submitted_at is null and r.due_date>today then raise exception 'Check-in is not due';end if;
 if p_expected_revision is distinct from r.revision then raise exception 'This check-in changed. Reload before amending.';end if;
 fid:=r.feedback_id;
 if fid is null then
  insert into public.feedback(athlete_id,week_number,feedback_type,payload,status)
   values(a.id,r.week_number,'mandatory_week_'||r.kind,p_payload,case when p_safety then 'adjustment_flagged' else 'waiting' end) returning id into fid;
 else
  update public.feedback set payload=p_payload,status=case when p_safety then 'adjustment_flagged' else 'waiting' end,reviewed_at=null,admin_reply=null where id=fid;
 end if;
 update public.weekly_checkin_requirements set feedback_id=fid,submitted_at=coalesce(submitted_at,p_now),revision=revision+1 where id=r.id;
 insert into public.weekly_checkin_receipts(submission_id,requirement_id,actor_user_id,payload,revision) values(p_submission,r.id,p_actor,p_payload,r.revision+1);
 if p_safety then
  insert into public.weekly_checkin_holds(athlete_id,feedback_id,reported_payload) values(a.id,fid,p_payload)
   on conflict(feedback_id) do update set generation=public.weekly_checkin_holds.generation+1,updated_at=p_now,reported_payload=p_payload,released_at=null,released_by=null,release_note=null;
 end if;
 return jsonb_build_object('saved',true,'id',fid,'revision',r.revision+1);
end;$$;

create function public.open_weekly_end_checkin(p_actor uuid,p_audience text,p_now timestamptz default now())
returns jsonb language plpgsql set search_path='' as $$
declare state jsonb; a public.athletes%rowtype; r public.weekly_checkin_requirements%rowtype;
begin
 state:=public.weekly_checkin_state(p_actor,p_audience,p_now);
 if not (state->>'enabled')::boolean then return state;end if;
 select * into a from public.athletes where case when p_audience='parent' then parent_user_id=p_actor else athlete_user_id=p_actor end;
 select * into r from public.weekly_checkin_requirements where athlete_id=a.id and kind='end'
  order by created_at desc limit 1;
 if r.id is not null and r.submitted_at is null then
  update public.weekly_checkin_requirements set due_date=least(due_date,(state->>'today')::date) where id=r.id;
 end if;
 -- Opening early is the submitter's declaration, NOT a fabricated session completion.
 return public.weekly_checkin_state(p_actor,p_audience,p_now);
end;$$;

create function public.release_weekly_checkin_hold(p_admin uuid,p_hold uuid,p_generation integer,p_note text)
returns jsonb language plpgsql set search_path='' as $$
declare h public.weekly_checkin_holds%rowtype;
begin
 if not exists(select 1 from public.admin_profiles where user_id=p_admin) then raise exception 'Admin access required';end if;
 if p_note is null or length(btrim(p_note))<3 or length(p_note)>1000 then raise exception 'A review note is required';end if;
 select * into h from public.weekly_checkin_holds where id=p_hold for update;
 if not found or h.generation is distinct from p_generation or h.released_at is not null then raise exception 'Safety report changed. Reload before release.';end if;
 insert into public.weekly_checkin_review_events(hold_id,generation,admin_user_id,reported_payload,note) values(h.id,h.generation,p_admin,h.reported_payload,btrim(p_note));
 update public.weekly_checkin_holds set released_at=now(),released_by=p_admin,release_note=btrim(p_note) where id=h.id;
 return jsonb_build_object('released',true);
end;$$;

revoke all on function public.weekly_checkin_state(uuid,text,timestamptz),public.save_weekly_checkin(uuid,text,uuid,text,jsonb,integer,boolean,timestamptz),public.open_weekly_end_checkin(uuid,text,timestamptz),public.release_weekly_checkin_hold(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.weekly_checkin_state(uuid,text,timestamptz),public.save_weekly_checkin(uuid,text,uuid,text,jsonb,integer,boolean,timestamptz),public.open_weekly_end_checkin(uuid,text,timestamptz),public.release_weekly_checkin_hold(uuid,uuid,integer,text) to service_role;

create function public.report_weekly_checkin_issue(p_actor uuid,p_audience text,p_submission text,p_payload jsonb,p_safety boolean)
returns jsonb language plpgsql set search_path='' as $$
declare a public.athletes%rowtype; receipt public.weekly_checkin_receipts%rowtype; fid uuid;
begin
 if p_actor is null or p_audience is null or p_audience not in ('parent','private-athlete') then raise exception 'Check-in access denied';end if;
 select * into a from public.athletes where case when p_audience='parent' then parent_user_id=p_actor else athlete_user_id=p_actor end for update;
 if not found then raise exception 'Check-in access denied';end if;
 if p_submission is null or p_submission !~ '^[A-Za-z0-9-]{16,80}$' or jsonb_typeof(p_payload)<>'object' or p_payload->>'formVersion' is distinct from '2.0' or p_safety is null then raise exception 'Invalid check-in information';end if;
 select * into receipt from public.weekly_checkin_receipts where submission_id=p_submission;
 if found then
  if receipt.requirement_id is not null or receipt.actor_user_id<>p_actor or receipt.payload is distinct from p_payload then raise exception 'Invalid check-in retry';end if;
  return jsonb_build_object('saved',true,'id',receipt.feedback_id,'duplicate',true);
 end if;
 insert into public.feedback(athlete_id,week_number,feedback_type,payload,status)
  values(a.id,a.current_week,'athlete_issue',p_payload,case when p_safety then 'adjustment_flagged' else 'waiting' end) returning id into fid;
 insert into public.weekly_checkin_receipts(submission_id,feedback_id,actor_user_id,payload,revision) values(p_submission,fid,p_actor,p_payload,1);
 if p_safety then insert into public.weekly_checkin_holds(athlete_id,feedback_id,reported_payload) values(a.id,fid,p_payload);end if;
 return jsonb_build_object('saved',true,'id',fid);
end;$$;
revoke all on function public.report_weekly_checkin_issue(uuid,text,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.report_weekly_checkin_issue(uuid,text,text,jsonb,boolean) to service_role;

-- Existing account SELECT policies allow assigned programmes directly through REST.
-- During enforcement, delivery must pass the verified Edge gate (including enrollment).
-- Admins retain direct access; service_role Edge clients retain their existing RLS bypass.
create schema checkin_private;
revoke all on schema checkin_private from public,anon,authenticated;
grant usage on schema checkin_private to authenticated;
create function checkin_private.direct_training_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select not coalesce((select enabled from public.weekly_checkin_config where id),true)
 or exists(select 1 from public.admin_profiles where user_id=(select auth.uid()));
$$;
revoke all on function checkin_private.direct_training_allowed() from public,anon,authenticated;
grant execute on function checkin_private.direct_training_allowed() to authenticated;
create policy weekly_checkin_edge_delivery on public.programme_weeks as restrictive for select to authenticated using((select checkin_private.direct_training_allowed()));
create policy weekly_checkin_edge_delivery on public.training_days as restrictive for select to authenticated using((select checkin_private.direct_training_allowed()));
create policy weekly_checkin_edge_delivery on public.session_blocks as restrictive for select to authenticated using((select checkin_private.direct_training_allowed()));

revoke update on public.weekly_checkin_receipts,public.weekly_checkin_review_events from service_role;
create trigger weekly_checkin_receipts_immutable before update or delete or truncate on public.weekly_checkin_receipts
 for each statement execute function feedback_history_private.immutable_event();
