-- Restore the exact audited read-policy predicates.
BEGIN;
ALTER POLICY "parent_or_athlete_read_live_programme_weeks" ON public.programme_weeks USING (((status = 'live'::text) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.programme_id = programme_weeks.programme_id) AND (a.access_status = 'active'::text) AND ((a.parent_user_id = auth.uid()) OR (a.athlete_user_id = auth.uid())))))));
ALTER POLICY "parent_or_athlete_read_live_session_blocks" ON public.session_blocks USING ((EXISTS ( SELECT 1
   FROM ((training_days td
     JOIN programme_weeks pw ON ((pw.id = td.programme_week_id)))
     JOIN athletes a ON ((a.programme_id = pw.programme_id)))
  WHERE ((td.id = session_blocks.training_day_id) AND (pw.status = 'live'::text) AND (a.access_status = 'active'::text) AND ((a.parent_user_id = auth.uid()) OR (a.athlete_user_id = auth.uid()))))));
ALTER POLICY "parent_or_athlete_read_live_training_days" ON public.training_days USING ((EXISTS ( SELECT 1
   FROM (programme_weeks pw
     JOIN athletes a ON ((a.programme_id = pw.programme_id)))
  WHERE ((pw.id = training_days.programme_week_id) AND (pw.status = 'live'::text) AND (a.access_status = 'active'::text) AND ((a.parent_user_id = auth.uid()) OR (a.athlete_user_id = auth.uid()))))));
COMMIT;

