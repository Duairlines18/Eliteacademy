-- REVIEW ONLY: validated locally; apply only with release approval.
-- Existing signatures, authorization, grants and assignment rules are preserved.
BEGIN;
-- STAGED ONLY. Atomic edit of one EXISTING session block, not a programme rewrite.
-- Used by a protected admin-only Edge Function. No browser service-role access.
-- Editing a shared programme changes ALL athletes assigned to that programme.
create or replace function public.admin_update_workout_block(
  p_athlete_id uuid,
  p_programme_id uuid,
  p_week_number integer,
  p_block_id uuid,
  p_content jsonb,
  p_expected_content jsonb,
  p_allow_shared boolean default false
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
 -- Match JavaScript String.trim() so saved instructions and delivery agree.
 v_trim_chars constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
 v_athlete public.athletes%rowtype;
 v_week public.programme_weeks%rowtype;
 v_block public.session_blocks%rowtype;
 v_owner_count integer;
 v_bad_count integer;
 v_bad_dosage integer;
 v_codes jsonb;
 v_saved_content jsonb;
begin
 if auth.role() is distinct from 'service_role' then
   raise exception 'Administrative authorization required';
 end if;
 if p_athlete_id is null or p_programme_id is null or p_week_number is null
   or p_block_id is null or p_week_number<1 or p_content is null
   or jsonb_typeof(p_content)<>'object' then
   raise exception 'Exact athlete, programme, week, block and content are required';
 end if;
 select * into v_athlete from public.athletes where id=p_athlete_id for update;
 if not found then raise exception 'Athlete not found'; end if;
 if v_athlete.access_status<>'active' then raise exception 'Athlete is not active'; end if;
 -- Direct private athletes are identified by programme_id, cohort accounts by cohort.
 if (v_athlete.athlete_type='private' and v_athlete.programme_id is not null
      and v_athlete.programme_id is distinct from p_programme_id)
   or (not (v_athlete.athlete_type='private' and v_athlete.programme_id is not null)
      and not exists(select 1 from public.cohorts c where c.id=v_athlete.cohort_id
      and c.programme_id=p_programme_id and c.status='live')) then
   raise exception 'Programme is not assigned to athlete';
 end if;
 if not exists(select 1 from public.programmes p where p.id=p_programme_id and p.status='live')
 then raise exception 'Programme is not live'; end if;
 select * into v_week from public.programme_weeks
 where programme_id=p_programme_id and week_number=p_week_number and tier_id is null
 and p_week_number = case when v_athlete.athlete_type='private' and v_athlete.programme_id is not null
   then v_athlete.current_week else (select c.current_week from public.cohorts c where c.id=v_athlete.cohort_id) end
 and status in ('live','completed') and verification_status='verified'
 and published_at is not null;
 if not found then raise exception 'Target week is not published and verified'; end if;
 select b.* into v_block from public.session_blocks b
 join public.training_days d on d.id=b.training_day_id
 where b.id=p_block_id and d.programme_week_id=v_week.id for update of b;
 if not found then raise exception 'Block does not belong to the requested programme week'; end if;
 if v_block.content is distinct from p_expected_content then
   raise exception 'Workout changed since preview; refresh before editing';
 end if;
 -- Count effective recipients: direct programme OR cohort programme.
 select count(*) into v_owner_count from public.athletes a
 left join public.cohorts c on c.id=a.cohort_id
 where a.id<>p_athlete_id and
 (a.programme_id=p_programme_id or c.programme_id=p_programme_id);
 if v_owner_count>0 and not p_allow_shared then
   raise exception 'Shared programme edit requires explicit shared-scope confirmation';
 end if;
 if not coalesce((
  (jsonb_typeof(p_content->'instruction')='string' and nullif(btrim(p_content->>'instruction',v_trim_chars),'') is not null)
  or (jsonb_typeof(p_content->'items')='array' and jsonb_array_length(p_content->'items')>0)
  or (jsonb_typeof(p_content->'exerciseCodes')='array' and jsonb_array_length(p_content->'exerciseCodes')>0)
  or (jsonb_typeof(p_content->'prescriptions')='array' and jsonb_array_length(p_content->'prescriptions')>0)
  or (jsonb_typeof(p_content->'sections')='array' and jsonb_array_length(p_content->'sections')>0)
 ),false) then raise exception 'Workout content cannot be empty'; end if;
 if p_content ? 'prescriptions' and jsonb_typeof(p_content->'prescriptions')<>'array'
   then raise exception 'Prescriptions must be an array'; end if;
 if p_content ? 'exerciseCodes' and jsonb_typeof(p_content->'exerciseCodes')<>'array'
   then raise exception 'Exercise codes must be an array'; end if;
 if p_content ? 'items' and jsonb_typeof(p_content->'items')<>'array' then
   raise exception 'Items must be an array'; end if;
 select count(*) into v_bad_dosage from jsonb_array_elements(
   case when jsonb_typeof(p_content->'prescriptions')='array'
   then p_content->'prescriptions' else '[]'::jsonb end) p
 where jsonb_typeof(p) is distinct from 'object'
 or case when coalesce(p->>'exerciseCode','')<>''
   then nullif(btrim(p->>'exerciseCode',v_trim_chars),'') is null
     or nullif(btrim(p->>'dosage',v_trim_chars),'') is null
   else jsonb_typeof(p->'instruction') is distinct from 'string'
     or nullif(btrim(p->>'instruction',v_trim_chars),'') is null end;
 if v_bad_dosage>0 then raise exception 'Each prescription requires an exercise code and dosage, or a nonempty instruction'; end if;
 with refs as (
  select trim(x.code) code from (
   select jsonb_array_elements_text(case when jsonb_typeof(p_content->'exerciseCodes')='array'
     then p_content->'exerciseCodes' else '[]'::jsonb end) code
   union all
   select p->>'exerciseCode' from jsonb_array_elements(
     case when jsonb_typeof(p_content->'prescriptions')='array'
     then p_content->'prescriptions' else '[]'::jsonb end) p
   union all
   select p->>'alternativeExerciseCode' from jsonb_array_elements(
     case when jsonb_typeof(p_content->'prescriptions')='array'
     then p_content->'prescriptions' else '[]'::jsonb end) p
  ) x where nullif(trim(x.code),'') is not null
 )
 select count(*) into v_bad_count from refs r left join public.exercises e
 on e.code=r.code and e.active=true where e.id is null;
 if v_bad_count>0 then raise exception 'Missing or inactive exercise codes'; end if;
 -- Existing BEFORE triggers own canonical video_links. All prescribed fields
 -- must still read back exactly; return the actual saved demo metadata.
 update public.session_blocks set content=p_content where id=p_block_id returning content into v_saved_content;
 if (v_saved_content - 'video_links') is distinct from (p_content - 'video_links')
   then raise exception 'Workout read-back verification failed'; end if;
 return jsonb_build_object('status','WORKOUT_BLOCK_VERIFIED',
 'athlete_id',p_athlete_id,'programme_id',p_programme_id,
 'week',p_week_number,'block_id',p_block_id,'affected_other_athletes',v_owner_count,
 'content',v_saved_content,'previous_content',v_block.content);
end;
$$;
revoke all on function public.admin_update_workout_block(uuid,uuid,integer,uuid,jsonb,jsonb,boolean)
 from public,anon,authenticated;
grant execute on function public.admin_update_workout_block(uuid,uuid,integer,uuid,jsonb,jsonb,boolean)
 to service_role;

CREATE OR REPLACE FUNCTION public.admin_publish_programme_week(p_week_id uuid, p_target_type text, p_target_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
 -- Match JavaScript String.trim() so saved instructions and delivery agree.
 v_trim_chars constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
  v_week public.programme_weeks%rowtype;
  v_day_count integer;
  v_block_count integer;
  v_empty_count integer;
  v_invalid_exercises integer;
  v_invalid_prescriptions integer;
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
           where not coalesce((
             (jsonb_typeof(sb.content->'instruction')='string' and nullif(btrim(sb.content->>'instruction',v_trim_chars),'') is not null)
             or (jsonb_typeof(sb.content->'prescriptions')='array' and jsonb_array_length(sb.content->'prescriptions')>0)
             or (jsonb_typeof(sb.content->'items')='array' and jsonb_array_length(sb.content->'items')>0)
           ),false)
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

  select count(*) into v_invalid_prescriptions
  from public.session_blocks sb
  join public.training_days td on td.id=sb.training_day_id
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(sb.content->'prescriptions')='array'
      then sb.content->'prescriptions' else '[]'::jsonb end
  ) p
  where td.programme_week_id=v_week.id and (
    jsonb_typeof(p) is distinct from 'object'
    or case when coalesce(p->>'exerciseCode','')<>''
      then nullif(btrim(p->>'exerciseCode',v_trim_chars),'') is null
        or nullif(btrim(p->>'dosage',v_trim_chars),'') is null
      else jsonb_typeof(p->'instruction') is distinct from 'string'
        or nullif(btrim(p->>'instruction',v_trim_chars),'') is null end
  );
  if v_invalid_prescriptions>0 then raise exception 'Cannot publish: % prescription(s) are incomplete',v_invalid_prescriptions; end if;

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
;
COMMIT;

