-- One linked athlete is the existing parent endpoint contract. Abort rather
-- than delete or relink records if duplicates have appeared since the audit.
create unique index if not exists athletes_parent_user_unique
  on public.athletes(parent_user_id) where parent_user_id is not null;

-- Invoker security: only service_role can call, and it already owns the trusted
-- Edge Function write path. No new parent write grants or RLS bypass function.
create or replace function public.save_parent_athlete_setup(
  p_parent_user_id uuid, p_answers jsonb, p_complete boolean
) returns jsonb
language plpgsql security invoker
set search_path = ''
as $$
declare athlete public.athletes%rowtype;
begin
  if p_parent_user_id is null or p_answers is null
     or jsonb_typeof(p_answers) <> 'object' or p_complete is null then
    raise exception 'Invalid parent setup';
  end if;
  select * into athlete from public.athletes
    where parent_user_id = p_parent_user_id for update;
  if not found then raise exception 'Parent athlete not found'; end if;
  -- A late draft or repeated completion cannot erase or reopen completed setup.
  if athlete.onboarding_complete is true then return to_jsonb(athlete); end if;
  update public.athletes
    set onboarding_data = coalesce(onboarding_data, '{}'::jsonb) || p_answers,
        onboarding_complete = p_complete
    where id = athlete.id returning * into athlete;
  return to_jsonb(athlete);
end;
$$;
revoke all on function public.save_parent_athlete_setup(uuid,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.save_parent_athlete_setup(uuid,jsonb,boolean) to service_role;
