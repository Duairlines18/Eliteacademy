create table public.hub_daily_visits (
  visitor_kind text not null,
  athlete_id uuid references public.athletes(id) on delete cascade,
  staff_id uuid references public.staff_profiles(id) on delete cascade,
  visit_date date not null,
  last_visit_at timestamptz not null,
  constraint hub_daily_visits_subject check (
    (visitor_kind in ('private-athlete', 'parent', 'school-athlete') and athlete_id is not null and staff_id is null)
    or (visitor_kind = 'school-staff' and staff_id is not null and athlete_id is null)
  ),
  unique nulls not distinct (visitor_kind, athlete_id, staff_id, visit_date)
);

alter table public.hub_daily_visits enable row level security;
revoke all on public.hub_daily_visits from public, anon, authenticated, service_role;
grant select on public.hub_daily_visits to authenticated;
grant select, insert, update on public.hub_daily_visits to service_role;

create policy hub_daily_visits_admin_read on public.hub_daily_visits for select to authenticated
  using (exists (select 1 from public.admin_profiles where user_id = (select auth.uid())));

-- The Edge handlers supply only identities resolved from verified credentials.
create function public.record_hub_visit(
  p_kind text,
  p_athlete uuid default null,
  p_staff uuid default null,
  p_actor uuid default null
) returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare
  visited_at timestamptz := clock_timestamp();
begin
  if p_kind = 'school-staff' then
    if p_athlete is not null or p_actor is not null or not exists (
      select 1 from public.staff_profiles s
      where s.id = p_staff and s.access_status = 'active'
        and concat_ws(' ', s.full_name, s.display_name) !~* '(\mdemo\M|releaseqa|synthetic|\mqa\M|\mtest(ing)?\M)'
    ) then return false; end if;
  elsif p_kind in ('private-athlete', 'parent', 'school-athlete') then
    if p_staff is not null or not exists (
      select 1 from public.athletes a
      where a.id = p_athlete and a.access_status = 'active'
        and coalesce(a.onboarding_data->>'testing_placeholder', '') <> 'true'
        and concat_ws(' ', a.full_name, a.display_name) !~* '(\mdemo\M|releaseqa|synthetic|\mqa\M|\mtest(ing)?\M)'
        and not exists (
          select 1 from public.cohorts c where c.id = a.cohort_id
            and c.name ~* '(\mdemo\M|releaseqa|synthetic|\mqa\M|\mtest(ing)?\M)'
        )
        and not exists (select 1 from public.admin_profiles ap where ap.user_id = p_actor
          or ap.user_id in (a.athlete_user_id, a.parent_user_id))
        and (
          (p_kind = 'school-athlete' and p_actor is null and a.athlete_type = 'school' and a.cohort_id is not null)
          or (p_kind in ('private-athlete', 'parent') and a.athlete_type is distinct from 'school'
            and (a.programme_id is not null or a.cohort_id is not null)
            and p_actor = case when p_kind = 'parent' then a.parent_user_id else a.athlete_user_id end
            and (a.access_reason, a.payment_status) in
              (('stripe', 'paid'), ('manual_payment', 'manually_confirmed'), ('complimentary', 'not_required')))
        )
    ) then return false; end if;
  else
    return false;
  end if;

  insert into public.hub_daily_visits(visitor_kind, athlete_id, staff_id, visit_date, last_visit_at)
  values (p_kind, p_athlete, p_staff, (visited_at at time zone 'America/Chicago')::date, visited_at)
  on conflict (visitor_kind, athlete_id, staff_id, visit_date) do update
    set last_visit_at = excluded.last_visit_at
    where excluded.last_visit_at >= hub_daily_visits.last_visit_at + interval '1 minute';
  return true;
end;
$$;

revoke all on function public.record_hub_visit(text, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_hub_visit(text, uuid, uuid, uuid) to service_role;

-- Return one aggregate per identity. History never leaves the database as raw rows.
create function public.hub_visit_summary()
returns table (visitor_kind text, athlete_id uuid, staff_id uuid, last_visit_at timestamptz,
               this_week bigint, last_12_days bigint)
language sql stable security invoker set search_path = ''
as $$
  with today as (
    select (now() at time zone 'America/Chicago')::date as day
  )
  select v.visitor_kind, v.athlete_id, v.staff_id, max(v.last_visit_at),
    count(*) filter (where v.visit_date between date_trunc('week', t.day::timestamp)::date and t.day),
    count(*) filter (where v.visit_date between t.day - 11 and t.day)
  from public.hub_daily_visits v cross join today t
  group by v.visitor_kind, v.athlete_id, v.staff_id
  order by v.visitor_kind, v.athlete_id, v.staff_id;
$$;

revoke all on function public.hub_visit_summary() from public, anon, authenticated;
grant execute on function public.hub_visit_summary() to authenticated;
