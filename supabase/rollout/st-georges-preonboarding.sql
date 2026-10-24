-- Approved pre-onboarding only. No credential is active and no draft is published.
-- Idempotent batch marker; never rename an existing athlete or replace demo codes.
begin;
do $preonboard$
declare
 c public.cohorts%rowtype; a uuid; coach uuid; draft uuid; w uuid; d uuid; source_day record;
 batch text := 'st-georges-preonboarding-20261024';
 slot integer;
begin
 select * into strict c from public.cohorts where id='3e456205-257e-4954-a5cd-1eb163599bb3' for update;
 if exists(select 1 from public.athletes where onboarding_data->>'provisioning_batch'=batch) then
   raise exception 'Batch already provisioned: inspect existing IDs rather than creating duplicates';
 end if;
 if c.programme_id <> '3d063e65-1f91-4aca-af59-b0c04bd73044' then raise exception 'Assignment changed; re-audit'; end if;
 if c.organization_id is not null and c.organization_id <> 'a827b9b0-bb2b-4429-abaa-98aa32b90e11' then raise exception 'Organization changed'; end if;
 insert into public.programme_versions(programme_week_id,snapshot,change_note)
 select 'e776d769-2d23-4da9-9cec-a22fd49cdbab',
 jsonb_build_object('cohort',to_jsonb(c),'programme',(select to_jsonb(p) from programmes p where p.id=c.programme_id),
 'weeks',(select jsonb_agg(pw) from programme_weeks pw where pw.programme_id=c.programme_id),
 'days',(select jsonb_agg(td) from training_days td join programme_weeks pw on pw.id=td.programme_week_id where pw.programme_id=c.programme_id),
 'blocks',(select jsonb_agg(sb) from session_blocks sb join training_days td on td.id=sb.training_day_id join programme_weeks pw on pw.id=td.programme_week_id where pw.programme_id=c.programme_id)),
 batch || ': before-image';
 update public.cohorts set organization_id='a827b9b0-bb2b-4429-abaa-98aa32b90e11',updated_at=now() where id=c.id;
 for slot in 1..6 loop
   insert into public.athletes(full_name,display_name,athlete_type,organization_id,cohort_id,programme_id,access_status,access_reason,payment_status,admin_notes,onboarding_data)
   values ('St. George’s Athlete '||lpad(slot::text,2,'0'),'St. George’s Athlete '||lpad(slot::text,2,'0'),'school',
   'a827b9b0-bb2b-4429-abaa-98aa32b90e11',c.id,null,'active','institutional','pending',
   'TESTING PLACEHOLDER. Do not distribute access. Athlete details, schedule and payment pending.',
   jsonb_build_object('testing_placeholder',true,'provisioning_batch',batch,'slot',slot)) returning id into a;
   -- Unrecoverable random reservation hash: admin generates a usable code once after release.
   insert into public.access_codes(code_type,cohort_id,athlete_id,code_hash,status,label,expires_at)
   values('cohort',c.id,a,encode(sha256(extensions.gen_random_bytes(32)),'hex'),'paused',
     batch || ': Athlete '||lpad(slot::text,2,'0')||' — RESERVED; regenerate in admin',now()+interval '7 days');
 end loop;
 if exists(select 1 from public.staff_profiles where full_name='Coach Dube') then raise exception 'Existing Coach Dube profile requires reconciliation'; end if;
 insert into public.staff_profiles(full_name,display_name,role_title,access_status)
 values('Coach Dube','Coach Dube','School coach — testing slot','active') returning id into coach;
 insert into public.staff_cohorts(staff_id,cohort_id) values(coach,c.id);
 insert into public.access_codes(code_type,cohort_id,staff_id,code_hash,status,label,expires_at)
 values('staff',c.id,coach,encode(sha256(extensions.gen_random_bytes(32)),'hex'),'paused',
   batch || ': Coach Dube — RESERVED; regenerate in admin',now()+interval '7 days');
 insert into public.programmes(name,duration_weeks,sport,event_focus,status,source_of_truth)
 values('St George’s College Harare — Four-week Pilot (Review Draft)',4,'School Performance',
   'Running capacity, movement foundations and introductory horizontal-jump preparation','draft',
   batch || ': draft revision of '||c.programme_id||'; two coached sessions plus optional home session; not approved for delivery') returning id into draft;
 for slot in 1..4 loop
   insert into public.programme_weeks(programme_id,week_number,phase,weekly_objective,status,verification_status,athlete_education)
   values(draft,slot,'Pilot — coach review required',
   case when slot=1 then 'Review existing foundations for two coached sessions of approximately 60 minutes and an optional home session.'
   else 'Coach review draft: confirm progression from the prior week after readiness, school schedule and athlete feedback are known.' end,
   'draft','needs_verification','Testing draft. Form, readiness, injury considerations, training days and start date remain unconfirmed.') returning id into w;
   if slot=1 then
     for source_day in select * from public.training_days where programme_week_id='e776d769-2d23-4da9-9cec-a22fd49cdbab' and sort_order in (1,2,4) order by sort_order loop
       insert into public.training_days(programme_week_id,day_key,title,intensity,objective,duration,sort_order)
       values(w,'Day '||case when source_day.sort_order=4 then 3 else source_day.sort_order end,
       source_day.title,source_day.intensity,source_day.objective,
       case when source_day.sort_order=4 then source_day.duration else 'Approximately 60 minutes — review timing' end,
       case when source_day.sort_order=4 then 3 else source_day.sort_order end) returning id into d;
       insert into public.session_blocks(training_day_id,block_type,title,sort_order,saved_block_id,content,athlete_note,staff_note,admin_note)
       select d,block_type,title,sort_order,saved_block_id,content,athlete_note,staff_note,
         'Draft source retained from '||id||'. Review form/readiness and missing rests; no progression approved.'
       from public.session_blocks where training_day_id=source_day.id;
       if source_day.sort_order in (1,2) then
         insert into public.session_blocks(training_day_id,block_type,title,sort_order,saved_block_id,content,athlete_note,staff_note,admin_note)
         select d,'warm-up','Air Zim Warm-Up',1,'df8473ad-5620-438d-9bed-2ebffabdebfe',
           jsonb_build_object('requirement','Complete','prescriptions',jsonb_agg(jsonb_build_object(
             'exerciseCode',e.code,'dosage',i.prescription->>'dosage','rest',coalesce(i.prescription->>'rest',''),
             'cues',coalesce(i.prescription->>'cues','')) order by i.position)),
           'Coach-approved readiness required before plyometric additions.',
           'Review introductory snap-down/landing elements from existing school reactive-strength block; do not automatically add the full block.',
           'Reuses approved ASIM base unchanged. Introductory plyometrics, core balance, equipment and total duration require Coach Du review.'
         from public.saved_block_items i join public.exercises e on e.id=i.exercise_id
         where i.block_id='df8473ad-5620-438d-9bed-2ebffabdebfe';
       end if;
     end loop;
   end if;
 end loop;
 insert into public.programme_versions(programme_week_id,snapshot,change_note)
 values('e776d769-2d23-4da9-9cec-a22fd49cdbab',
   jsonb_build_object('draft_programme_id',draft,'staff_id',coach,'cohort_id',c.id,'batch',batch,
     'intended_schedule',jsonb_build_object('coached_sessions',2,'optional_home_sessions',1,'official_start_date',null)),
   batch || ': created IDs and intended schedule');
end $preonboard$;
commit;
