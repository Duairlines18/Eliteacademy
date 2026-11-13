-- Weekly cadence: private Monday readiness + Friday review; parent Friday review
-- (or explicit early completion). Existing reports and athlete programmes remain intact.
drop index if exists public.weekly_checkin_assignment_unique;
create unique index weekly_checkin_assignment_unique
 on public.weekly_checkin_requirements(athlete_id,period_start,kind) where not calendar_weekly;
-- Only move pending parent Sunday deadlines earlier. Never rewrite submitted history
-- or special early demo deadlines.
update public.weekly_checkin_requirements
 set due_date=period_start+4
 where calendar_weekly and submitted_at is null and due_date>period_start+4;

create or replace function public.weekly_checkin_state(p_actor uuid,p_audience text,p_now timestamptz default now())
returns jsonb language plpgsql set search_path='' as $$
declare cfg public.weekly_checkin_config%rowtype; a public.athletes%rowtype;
 w public.programme_weeks%rowtype; c public.cohorts%rowtype; today date; monday date; starts date;
 candidate date; reqs jsonb; due jsonb; holds jsonb; timezone_name text;
 first_week date; report_week date; last_week date;
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
   -- One parent report per calendar week, available after confirmed completion or Friday.
   -- Start with the current week at first enrollment, not a retroactive backlog.
   first_week:=cfg.end_rollout-(extract(isodow from cfg.end_rollout)::integer-1);
   select max(period_start) into last_week from public.weekly_checkin_requirements
    where athlete_id=a.id and calendar_weekly;
   for report_week in select g::date from pg_catalog.generate_series(
     coalesce(last_week+7,monday)::timestamp,monday::timestamp,interval '7 days') g loop
    insert into public.weekly_checkin_requirements(athlete_id,programme_week_id,week_number,kind,period_start,due_date,calendar_weekly)
     values(a.id,w.id,w.week_number,'end',report_week,report_week+4,true) on conflict do nothing;
   end loop;
  elsif w.id is not null then
   -- Calendar cadence is independent of how quickly the coach advances an assignment.
   -- Only generate the current week at first enrollment; preserve all older records.
   starts:=monday;
   insert into public.weekly_checkin_requirements(athlete_id,programme_week_id,week_number,kind,period_start,due_date)
    values(a.id,w.id,w.week_number,'end',starts,greatest(starts+4,cfg.end_rollout)) on conflict do nothing;
   if today>=cfg.start_rollout then
    insert into public.weekly_checkin_requirements(athlete_id,programme_week_id,week_number,kind,period_start,due_date)
     values(a.id,w.id,w.week_number,'start',starts,starts) on conflict do nothing;
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
 if not (state->>'enabled')::boolean then return state;end if;
 select * into a from public.athletes where case when p_audience='parent' then parent_user_id=p_actor else athlete_user_id=p_actor end;
 select * into r from public.weekly_checkin_requirements where athlete_id=a.id and kind='end' and (p_audience<>'parent' or calendar_weekly)
  order by period_start desc,created_at desc limit 1;
 if r.id is not null and r.submitted_at is null then
  update public.weekly_checkin_requirements set due_date=least(due_date,(state->>'today')::date) where id=r.id;
 end if;
 -- Opening early is the submitter's declaration, NOT a fabricated session completion.
 return public.weekly_checkin_state(p_actor,p_audience,p_now);
end;$$;
