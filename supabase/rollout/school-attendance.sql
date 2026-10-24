-- Reviewed migration candidate. Run through apply_migration after approval.
-- No direct anonymous/authenticated access: named staff use protected hub-data.
begin;
create table public.school_attendance (
 id uuid primary key default gen_random_uuid(),
 cohort_id uuid not null references public.cohorts(id),
 programme_id uuid not null references public.programmes(id),
 week_number integer not null check (week_number > 0),
 athlete_id uuid not null references public.athletes(id),
 session_number smallint not null check (session_number in (1,2)),
 session_date date,
 status text not null check (status in ('unrecorded','present','absent','excused')),
 recorded_by_staff_id uuid not null references public.staff_profiles(id),
 recorded_at timestamptz not null default now(),
 constraint school_attendance_date_required check (status='unrecorded' or session_date is not null),
 unique (cohort_id,programme_id,week_number,athlete_id,session_number)
);
alter table public.school_attendance enable row level security;
revoke all on public.school_attendance from anon, authenticated;
grant select,insert,update on public.school_attendance to service_role;
comment on table public.school_attendance is 'Named-coach recorded session attendance; independent of Hub logins and workout completions.';
commit;
-- Rollback: restore prior hub-data bundle first. Retain rows for history; revoke
-- service_role INSERT/UPDATE to disable writing. Drop only if empty and approved.
