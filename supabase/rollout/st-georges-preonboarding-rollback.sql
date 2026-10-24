-- Reviewed rollback: retain identities/progress; never delete programme history.
-- Run only if this batch is being withdrawn, not after a subsequent approved launch.
begin;
do $rollback$
declare old_cohort jsonb;
begin
 select snapshot->'cohort' into strict old_cohort from public.programme_versions
 where change_note='st-georges-preonboarding-20261024: before-image';
 if not exists(select 1 from public.cohorts where id=(old_cohort->>'id')::uuid
   and programme_id=(old_cohort->>'programme_id')::uuid) then
   raise exception 'Cohort assignment changed after pre-onboarding; reconcile rollback manually';
 end if;
 update public.access_codes set status='paused',updated_at=now()
 where label like 'st-georges-preonboarding-20261024:%'
   or athlete_id in(select id from public.athletes where onboarding_data->>'provisioning_batch'='st-georges-preonboarding-20261024')
   or staff_id='e30e18d8-341f-460a-a464-d211197ea23a';
 update public.hub_sessions set revoked_at=now() where access_code_id in(
   select id from public.access_codes where label like 'st-georges-preonboarding-20261024:%'
   or athlete_id in(select id from public.athletes where onboarding_data->>'provisioning_batch'='st-georges-preonboarding-20261024')
   or staff_id='e30e18d8-341f-460a-a464-d211197ea23a');
 update public.athletes set access_status='archived',updated_at=now()
 where onboarding_data->>'provisioning_batch'='st-georges-preonboarding-20261024';
 update public.staff_profiles set access_status='archived',updated_at=now()
 where id='e30e18d8-341f-460a-a464-d211197ea23a';
 update public.programme_weeks set status='archived' where programme_id in(
   select id from public.programmes where source_of_truth like 'st-georges-preonboarding-20261024:%');
 update public.programmes set status='archived' where source_of_truth like 'st-georges-preonboarding-20261024:%';
 update public.cohorts set organization_id=(old_cohort->>'organization_id')::uuid,updated_at=now()
 where id=(old_cohort->>'id')::uuid;
end $rollback$;
commit;
