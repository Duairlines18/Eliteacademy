-- Prevent signed-in users from granting themselves administrator access.
-- Existing control-room login only SELECTs the user's admin profile.
drop policy admin_self on public.admin_profiles;
create policy admin_self on public.admin_profiles for select to authenticated using (user_id = (select auth.uid()));
