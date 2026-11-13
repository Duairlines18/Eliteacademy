-- Parents report once each Sunday. Existing feedback/history and private cadence are preserved.
alter table public.weekly_checkin_requirements add column calendar_weekly boolean not null default false;
alter table public.weekly_checkin_requirements add constraint parent_calendar_end_only check(not calendar_weekly or kind='end');

-- Replace only assignment uniqueness. Parent Sundays have their own calendar identity.
do $$ declare key_name text; begin
 for key_name in select c.conname from pg_catalog.pg_constraint c
  where c.conrelid='public.weekly_checkin_requirements'::regclass and c.contype='u'
  and c.conkey=array[
   (select attnum from pg_catalog.pg_attribute where attrelid=c.conrelid and attname='athlete_id'),
   (select attnum from pg_catalog.pg_attribute where attrelid=c.conrelid and attname='programme_week_id'),
   (select attnum from pg_catalog.pg_attribute where attrelid=c.conrelid and attname='kind')]::smallint[]
 loop execute pg_catalog.format('alter table public.weekly_checkin_requirements drop constraint %I',key_name);end loop;
end $$;
create unique index weekly_checkin_assignment_unique on public.weekly_checkin_requirements(athlete_id,programme_week_id,kind) where not calendar_weekly;

-- Retain all legacy rows. Select one existing end report per parent/calendar period;
-- obsolete unsent parent start/duplicate rows remain stored but no longer gate access.
with ranked as (
 select r.id,(r.period_start-(extract(isodow from r.period_start)::integer-1)) as monday,
  row_number() over(partition by r.athlete_id,r.period_start-(extract(isodow from r.period_start)::integer-1)
   order by (r.submitted_at is not null) desc,r.created_at desc,r.id) as priority
 from public.weekly_checkin_requirements r join public.athletes a on a.id=r.athlete_id
 where a.parent_user_id is not null and r.kind='end'
)
update public.weekly_checkin_requirements r set calendar_weekly=true,period_start=x.monday,due_date=x.monday+6
 from ranked x where r.id=x.id and x.priority=1;
create unique index weekly_checkin_parent_sunday_unique on public.weekly_checkin_requirements(athlete_id,period_start,kind) where calendar_weekly;

create or replace function public.weekly_checkin_state(p_actor uuid,p_audience text,p_now timestamptz default now())
returns jsonb language plpgsql set search_path='' as $$
declare cfg public.weekly_checkin_config%rowtype; a public.athletes%rowtype;
 w public.programme_weeks%rowtype; c public.cohorts%rowtype; today date; monday date; starts date;
 candidate date; reqs jsonb; due jsonb; holds jsonb; timezone_name text;
 first_sunday date; report_sunday date; latest_sunday date; last_sunday date;
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
  if w.id is not null and p_audience='parent' then
   -- Calendar cadence for parents; no parent start form and no pre-enrollment backlog.
   first_sunday:=cfg.end_rollout+(7-extract(isodow from cfg.end_rollout)::integer);
   latest_sunday:=greatest(first_sunday,today-(extract(isodow from today)::integer%7));
   select max(period_start+6) into last_sunday from public.weekly_checkin_requirements
    where athlete_id=a.id and calendar_weekly;
   -- Once enrolled, every subsequent Sunday is retained even if the parent misses login.
   for report_sunday in select g::date from pg_catalog.generate_series(
     coalesce(last_sunday+7,latest_sunday)::timestamp,latest_sunday::timestamp,interval '7 days') g loop
    insert into public.weekly_checkin_requirements(athlete_id,programme_week_id,week_number,kind,period_start,due_date,calendar_weekly)
     values(a.id,w.id,w.week_number,'end',report_sunday-6,report_sunday,true) on conflict do nothing;
   end loop;
  elsif w.id is not null then
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
  from public.weekly_checkin_requirements r left join public.feedback f on f.id=r.feedback_id where r.athlete_id=a.id and (p_audience<>'parent' or r.calendar_weekly or r.submitted_at is not null);
 select coalesce(jsonb_agg(item order by item->>'due_date',item->>'kind' desc),'[]') into due
  from jsonb_array_elements(reqs) item where item->>'submitted_at' is null and (item->>'due_date')::date<=today
   and (p_audience<>'parent' or (item->>'calendar_weekly')::boolean);
 select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'generation',h.generation,'created_at',h.created_at)),'[]') into holds
  from public.weekly_checkin_holds h where h.athlete_id=a.id and h.released_at is null;
 return jsonb_build_object('enabled',true,'today',today,'timezone',timezone_name,'due',due,'requirements',reqs,'held',jsonb_array_length(holds)>0,'holds',holds);
end;$$;

create or replace function public.open_weekly_end_checkin(p_actor uuid,p_audience text,p_now timestamptz default now())
returns jsonb language plpgsql set search_path='' as $$
declare state jsonb; a public.athletes%rowtype; r public.weekly_checkin_requirements%rowtype;
begin
 state:=public.weekly_checkin_state(p_actor,p_audience,p_now);
 if not (state->>'enabled')::boolean or p_audience='parent' then return state;end if;
 select * into a from public.athletes where case when p_audience='parent' then parent_user_id=p_actor else athlete_user_id=p_actor end;
 select * into r from public.weekly_checkin_requirements where athlete_id=a.id and kind='end'
  order by created_at desc limit 1;
 if r.id is not null and r.submitted_at is null then
  update public.weekly_checkin_requirements set due_date=least(due_date,(state->>'today')::date) where id=r.id;
 end if;
 -- Opening early is the submitter's declaration, NOT a fabricated session completion.
 return public.weekly_checkin_state(p_actor,p_audience,p_now);
end;$$;

