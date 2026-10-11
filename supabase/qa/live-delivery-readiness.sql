-- Read-only live QA: run before any rollout. Does not mutate athletes or cohorts.
with assigned as (
 select a.id athlete_id,a.display_name,a.programme_id athlete_programme,
        a.current_week athlete_week,a.access_status,
        c.id cohort_id,c.programme_id delivered_programme,c.current_week delivered_week,
        c.status cohort_status,c.tier
 from public.athletes a left join public.cohorts c on c.id=a.cohort_id
), delivered as (
 select a.*,w.id week_id,w.status week_status,w.verification_status,w.published_at,
 (select count(*) from public.training_days d where d.programme_week_id=w.id) day_count,
 (select count(*) from public.training_days d where d.programme_week_id=w.id and not exists
  (select 1 from public.session_blocks b where b.training_day_id=d.id)) empty_days
 from assigned a left join public.programme_weeks w on
 w.programme_id=a.delivered_programme and w.week_number=a.delivered_week
 and w.tier_id is null
)
select display_name,athlete_id,
 case when cohort_id is null then 'NO_COHORT'
 when athlete_programme is distinct from delivered_programme
   or athlete_week is distinct from delivered_week then 'ASSIGNMENT_MISMATCH'
 when cohort_status<>'live' then 'COHORT_NOT_LIVE'
 when tier is not null then 'TIER_REQUIRES_SEPARATE_VALIDATION'
 when week_id is null or week_status not in ('live','completed')
   or verification_status<>'verified' or published_at is null then 'WEEK_NOT_PUBLISHED'
 when day_count not between 1 and 7 or empty_days>0 then 'INCOMPLETE_SESSIONS'
 else 'CONFIG_READY' end as delivery_status,
 day_count,empty_days
from delivered order by display_name;
