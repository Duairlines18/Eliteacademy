-- Audited function body for isolated local QA. No live deployment.
CREATE OR REPLACE FUNCTION public.admin_publish_programme_week(p_week_id uuid, p_target_type text, p_target_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_week public.programme_weeks%rowtype;
  v_day_count integer;
  v_block_count integer;
  v_empty_count integer;
  v_invalid_exercises integer;
begin
  if not exists (
    select 1 from public.admin_profiles ap
    where ap.user_id = (select auth.uid())
  ) then
    raise exception 'Admin access required';
  end if;

  select * into v_week from public.programme_weeks where id=p_week_id;
  if not found then raise exception 'Programme week not found'; end if;

  select count(*) into v_day_count from public.training_days td where td.programme_week_id=v_week.id;

  select count(*),
         count(*) filter (
           where not (
             (jsonb_typeof(sb.content->'prescriptions')='array' and jsonb_array_length(sb.content->'prescriptions')>0)
             or (jsonb_typeof(sb.content->'items')='array' and jsonb_array_length(sb.content->'items')>0)
           )
         )
  into v_block_count,v_empty_count
  from public.session_blocks sb
  join public.training_days td on td.id=sb.training_day_id
  where td.programme_week_id=v_week.id;

  select count(*) into v_invalid_exercises
  from public.session_blocks sb
  join public.training_days td on td.id=sb.training_day_id
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(sb.content->'prescriptions')='array'
      then sb.content->'prescriptions' else '[]'::jsonb end
  ) p
  where td.programme_week_id=v_week.id
    and coalesce(p->>'exerciseCode','')<>''
    and not exists (
      select 1 from public.exercises e
      where e.code=p->>'exerciseCode' and e.active is true
    );

  if v_day_count=0 then raise exception 'Cannot publish: this week has no training days'; end if;
  if v_block_count=0 then raise exception 'Cannot publish: this week has no workout blocks'; end if;
  if v_empty_count>0 then raise exception 'Cannot publish: % workout block(s) are empty',v_empty_count; end if;
  if v_invalid_exercises>0 then raise exception 'Cannot publish: % exercise reference(s) are invalid or inactive',v_invalid_exercises; end if;

  if p_target_type='athlete' then
    if not exists (
      select 1 from public.athletes a
      left join public.cohorts c on c.id=a.cohort_id
      where a.id=p_target_id and coalesce(a.programme_id,c.programme_id)=v_week.programme_id
    ) then raise exception 'Athlete is not assigned to this programme'; end if;

    update public.athletes
    set current_week=v_week.week_number,current_phase=coalesce(v_week.phase,current_phase),updated_at=now()
    where id=p_target_id;
  elsif p_target_type='cohort' then
    if not exists (
      select 1 from public.cohorts c where c.id=p_target_id and c.programme_id=v_week.programme_id
    ) then raise exception 'Cohort is not assigned to this programme'; end if;

    update public.cohorts
    set current_week=v_week.week_number,current_phase=coalesce(v_week.phase,current_phase),updated_at=now()
    where id=p_target_id;
  else
    raise exception 'Target type must be athlete or cohort';
  end if;

  update public.programme_weeks
  set status='live',verification_status='verified',published_at=coalesce(published_at,now()),updated_at=now()
  where id=v_week.id;

  return jsonb_build_object(
    'ok',true,'week_id',v_week.id,'week_number',v_week.week_number,
    'target_type',p_target_type,'target_id',p_target_id
  );
end;
$function$

