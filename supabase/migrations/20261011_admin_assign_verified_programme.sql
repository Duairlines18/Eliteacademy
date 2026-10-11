-- STAGED ONLY. Administrator-authenticated Edge Function must authorize caller.
-- This RPC accepts only service_role and atomically verifies assignment configuration.
-- It does NOT certify browser rendering, video playback, or personalized adjustments.
create or replace function public.admin_assign_verified_programme(
  p_athlete_id uuid, p_programme_id uuid, p_week integer
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_athlete public.athletes%rowtype;
  v_week public.programme_weeks%rowtype;
  v_days integer;
  v_empty_days integer;
  v_bad_codes integer;
  v_cohort_id uuid;
  v_cohort_members integer;
  v_actual record;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Administrative authorization required';
  end if;
  if p_athlete_id is null or p_programme_id is null or p_week is null or p_week < 1 then
    raise exception 'Athlete, programme and positive week are required';
  end if;

  select * into v_athlete from public.athletes where id=p_athlete_id for update;
  if not found then raise exception 'Athlete not found'; end if;
  if not exists(select 1 from public.programmes where id=p_programme_id)
    then raise exception 'Programme not found'; end if;

  -- Hub uses tier_id IS NULL when cohort.tier is NULL. No silent tier fallback.
  select * into v_week from public.programme_weeks
  where programme_id=p_programme_id and week_number=p_week and tier_id is null
    and status in ('live','completed') and verification_status='verified'
    and published_at is not null
  order by published_at desc limit 1;
  if not found then raise exception 'Requested default-tier programme week is not published and verified'; end if;

  select count(*) into v_days from public.training_days where programme_week_id=v_week.id;
  if v_days not between 1 and 7 then raise exception 'Training day count must be between 1 and 7'; end if;
  select count(*) into v_empty_days from public.training_days d
  where d.programme_week_id=v_week.id and not exists
    (select 1 from public.session_blocks b where b.training_day_id=d.id);
  if v_empty_days>0 then raise exception 'Programme contains training days without session blocks'; end if;

  -- Match the Hub's exerciseCodes and prescriptions references. Missing/inactive codes block.
  with codes as (
    select trim(x.code) as code
    from public.training_days d
    join public.session_blocks b on b.training_day_id=d.id
    cross join lateral (
      select jsonb_array_elements_text(case when jsonb_typeof(b.content->'exerciseCodes')='array'
        then b.content->'exerciseCodes' else '[]'::jsonb end) as code
      union all
      select item->>'exerciseCode' from jsonb_array_elements(
        case when jsonb_typeof(b.content->'prescriptions')='array'
        then b.content->'prescriptions' else '[]'::jsonb end) item
      union all
      select item->>'alternativeExerciseCode' from jsonb_array_elements(
        case when jsonb_typeof(b.content->'prescriptions')='array'
        then b.content->'prescriptions' else '[]'::jsonb end) item
    ) x
    where d.programme_week_id=v_week.id and nullif(trim(x.code),'') is not null
  )
  select count(*) into v_bad_codes from codes x
  left join public.exercises e on e.code=x.code and e.active=true where e.id is null;
  if v_bad_codes>0 then raise exception 'Programme references missing or inactive exercises'; end if;

  -- Reuse only an existing cohort exclusive to this athlete; shared cohorts must not change.
  if v_athlete.cohort_id is not null then
    select count(*) into v_cohort_members from public.athletes
      where cohort_id=v_athlete.cohort_id and id<>p_athlete_id;
  else v_cohort_members:=0; end if;
  if v_athlete.cohort_id is not null and v_cohort_members=0
     and exists(select 1 from public.cohorts where id=v_athlete.cohort_id and status='live')
  then
    update public.cohorts set programme_id=p_programme_id,current_week=p_week,
      current_phase=v_week.phase,tier=null,expected_sessions_per_week=v_days,updated_at=now()
    where id=v_athlete.cohort_id returning id into v_cohort_id;
  else
    insert into public.cohorts(organization_id,name,programme_id,tier,current_week,
      current_phase,status,expected_sessions_per_week,internal_notes)
    values(v_athlete.organization_id,
      'Individual delivery — '||coalesce(v_athlete.display_name,v_athlete.id::text),
      p_programme_id,null,p_week,v_week.phase,'live',v_days,
      'Managed by admin_assign_verified_programme')
    returning id into v_cohort_id;
  end if;

  update public.athletes set cohort_id=v_cohort_id,programme_id=p_programme_id,
    current_week=p_week,current_phase=v_week.phase,updated_at=now()
  where id=p_athlete_id;

  select a.cohort_id,a.programme_id athlete_programme,a.current_week athlete_week,
    c.programme_id cohort_programme,c.current_week cohort_week,c.status cohort_status
  into v_actual from public.athletes a join public.cohorts c on c.id=a.cohort_id
  where a.id=p_athlete_id;
  if v_actual.cohort_id is distinct from v_cohort_id
    or v_actual.athlete_programme is distinct from p_programme_id
    or v_actual.athlete_week is distinct from p_week
    or v_actual.cohort_programme is distinct from p_programme_id
    or v_actual.cohort_week is distinct from p_week
    or v_actual.cohort_status is distinct from 'live'
  then raise exception 'Delivery configuration verification failed; transaction rolled back'; end if;
  return jsonb_build_object('status','DELIVERY_CONFIG_VERIFIED',
    'athlete_id',p_athlete_id,'programme_id',p_programme_id,
    'week',p_week,'cohort_id',v_cohort_id,
    'published_week_id',v_week.id,'training_days',v_days);
end;
$$;
revoke all on function public.admin_assign_verified_programme(uuid,uuid,integer)
  from public,anon,authenticated;
grant execute on function public.admin_assign_verified_programme(uuid,uuid,integer)
  to service_role;
