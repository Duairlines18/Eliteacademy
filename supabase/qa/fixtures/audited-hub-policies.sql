-- Audited SELECT/administrator policy expressions, 19 October 2026. Synthetic local QA only.
CREATE POLICY "admin_self" ON public.admin_profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "admin_all_athletes" ON public.athletes AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM admin_profiles a
  WHERE (a.user_id = auth.uid())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_profiles a
  WHERE (a.user_id = auth.uid()))));
CREATE POLICY "parent_or_athlete_read_own_athlete" ON public.athletes AS PERMISSIVE FOR SELECT TO authenticated USING (((access_status = 'active'::text) AND ((parent_user_id = auth.uid()) OR (athlete_user_id = auth.uid()))));
CREATE POLICY "admin_all_cohorts" ON public.cohorts AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM admin_profiles a
  WHERE (a.user_id = auth.uid())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_profiles a
  WHERE (a.user_id = auth.uid()))));
CREATE POLICY "admin_all_programme_weeks" ON public.programme_weeks AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM admin_profiles a
  WHERE (a.user_id = auth.uid())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_profiles a
  WHERE (a.user_id = auth.uid()))));
CREATE POLICY "parent_or_athlete_read_live_programme_weeks" ON public.programme_weeks AS PERMISSIVE FOR SELECT TO authenticated USING (((status = 'live'::text) AND (EXISTS ( SELECT 1
   FROM athletes a
  WHERE ((a.programme_id = programme_weeks.programme_id) AND (a.access_status = 'active'::text) AND ((a.parent_user_id = auth.uid()) OR (a.athlete_user_id = auth.uid())))))));
CREATE POLICY "admin_all_session_blocks" ON public.session_blocks AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM admin_profiles a
  WHERE (a.user_id = auth.uid())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_profiles a
  WHERE (a.user_id = auth.uid()))));
CREATE POLICY "parent_or_athlete_read_live_session_blocks" ON public.session_blocks AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM ((training_days td
     JOIN programme_weeks pw ON ((pw.id = td.programme_week_id)))
     JOIN athletes a ON ((a.programme_id = pw.programme_id)))
  WHERE ((td.id = session_blocks.training_day_id) AND (pw.status = 'live'::text) AND (a.access_status = 'active'::text) AND ((a.parent_user_id = auth.uid()) OR (a.athlete_user_id = auth.uid()))))));
CREATE POLICY "admin_all_training_days" ON public.training_days AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM admin_profiles a
  WHERE (a.user_id = auth.uid())))) WITH CHECK ((EXISTS ( SELECT 1
   FROM admin_profiles a
  WHERE (a.user_id = auth.uid()))));
CREATE POLICY "parent_or_athlete_read_live_training_days" ON public.training_days AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (programme_weeks pw
     JOIN athletes a ON ((a.programme_id = pw.programme_id)))
  WHERE ((pw.id = training_days.programme_week_id) AND (pw.status = 'live'::text) AND (a.access_status = 'active'::text) AND ((a.parent_user_id = auth.uid()) OR (a.athlete_user_id = auth.uid()))))));
