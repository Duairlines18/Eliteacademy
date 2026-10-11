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
 v_athlete public.athletes%rowtype;
 v_week public.programme_weeks%rowtype;
 v_block public.session_blocks%rowtype;
 v_owner_count integer;
 v_bad_count integer;
 v_bad_dosage integer;
 v_codes jsonb;
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
 if not (
  (jsonb_typeof(p_content->'items')='array' and jsonb_array_length(p_content->'items')>0)
  or (jsonb_typeof(p_content->'exerciseCodes')='array' and jsonb_array_length(p_content->'exerciseCodes')>0)
  or (jsonb_typeof(p_content->'prescriptions')='array' and jsonb_array_length(p_content->'prescriptions')>0)
  or (jsonb_typeof(p_content->'sections')='array' and jsonb_array_length(p_content->'sections')>0)
 ) then raise exception 'Workout content cannot be empty'; end if;
 if p_content ? 'prescriptions' and jsonb_typeof(p_content->'prescriptions')<>'array'
   then raise exception 'Prescriptions must be an array'; end if;
 if p_content ? 'exerciseCodes' and jsonb_typeof(p_content->'exerciseCodes')<>'array'
   then raise exception 'Exercise codes must be an array'; end if;
 if p_content ? 'items' and jsonb_typeof(p_content->'items')<>'array' then
   raise exception 'Items must be an array'; end if;
 select count(*) into v_bad_dosage from jsonb_array_elements(
   case when jsonb_typeof(p_content->'prescriptions')='array'
   then p_content->'prescriptions' else '[]'::jsonb end) p
 where nullif(trim(p->>'exerciseCode'),'') is null
 or nullif(trim(p->>'dosage'),'') is null;
 if v_bad_dosage>0 then raise exception 'Each prescription requires an exercise code and dosage'; end if;
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
 update public.session_blocks set content=p_content where id=p_block_id;
 if (select content from public.session_blocks where id=p_block_id) is distinct from p_content
   then raise exception 'Workout read-back verification failed'; end if;
 return jsonb_build_object('status','WORKOUT_BLOCK_VERIFIED',
 'athlete_id',p_athlete_id,'programme_id',p_programme_id,
 'week',p_week_number,'block_id',p_block_id,'affected_other_athletes',v_owner_count,
 'content',p_content,'previous_content',v_block.content);
end;
$$;
revoke all on function public.admin_update_workout_block(uuid,uuid,integer,uuid,jsonb,jsonb,boolean)
 from public,anon,authenticated;
grant execute on function public.admin_update_workout_block(uuid,uuid,integer,uuid,jsonb,jsonb,boolean)
 to service_role;
