-- Technique Review v1: additive, disabled-by-default schema.
-- DO NOT apply until server authorization, consent and video-duration validation pass.
create table if not exists public.technique_filming_profiles (
  exercise_id uuid primary key references public.exercises(id) on delete cascade,
  preferred_view text not null default 'side' check (preferred_view in ('side','front','rear','front-quarter','either')),
  camera_setup text not null default 'Keep the camera still and your full body visible.',
  filming_cue text not null default 'Show one or two controlled repetitions.',
  updated_at timestamptz not null default now()
);
create table if not exists public.technique_video_requests (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id),
  programme_week_id uuid not null references public.programme_weeks(id),
  exercise_id uuid references public.exercises(id),
  instruction_override text check (char_length(instruction_override) <= 500),
  requested_by text not null,
  status text not null default 'open' check (status in ('open','fulfilled','cancelled')),
  created_at timestamptz not null default now(),
  unique (id, athlete_id, programme_week_id)
);
create table if not exists public.technique_video_submissions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id),
  programme_week_id uuid not null references public.programme_weeks(id),
  request_id uuid,
  exercise_id uuid references public.exercises(id),
  object_key text unique,
  upload_state text not null default 'reserved' check (upload_state in ('reserved','uploading','ready','failed','deleted')),
  review_state text not null default 'pending' check (review_state in ('pending','reviewed')),
  duration_ms integer check (duration_ms between 1 and 15000),
  byte_size bigint check (byte_size between 1 and 26214400),
  uploaded_by text not null,
  reserved_until timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint video_request_athlete_week_fk foreign key (request_id, athlete_id, programme_week_id)
    references public.technique_video_requests(id, athlete_id, programme_week_id),
  constraint ready_requires_metadata check (
    upload_state <> 'ready' or (object_key is not null and duration_ms is not null and byte_size is not null)
  )
);
create index if not exists technique_video_submissions_queue_idx
  on public.technique_video_submissions(review_state, created_at) where upload_state='ready';
create index if not exists technique_video_submissions_quota_idx
  on public.technique_video_submissions(athlete_id, programme_week_id, upload_state);
create table if not exists public.technique_video_feedback (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.technique_video_submissions(id) on delete cascade,
  reviewer text not null,
  correction text not null check (char_length(correction) between 1 and 1000),
  positive_cue text check (char_length(positive_cue) <= 500),
  created_at timestamptz not null default now()
);
-- All new tables deny direct browser access. Narrow server APIs must verify role, scope and consent.
alter table public.technique_filming_profiles enable row level security;
alter table public.technique_video_requests enable row level security;
alter table public.technique_video_submissions enable row level security;
alter table public.technique_video_feedback enable row level security;
revoke all on public.technique_filming_profiles from anon, authenticated;
revoke all on public.technique_video_requests from anon, authenticated;
revoke all on public.technique_video_submissions from anon, authenticated;
revoke all on public.technique_video_feedback from anon, authenticated;

-- Atomic slot reservation: must be called only after server-side authorization.
-- All submissions for a given athlete/week serialize on the athlete row lock.
create or replace function public.reserve_technique_video_slot(
  p_athlete_id uuid, p_programme_week_id uuid, p_uploaded_by text,
  p_request_id uuid default null, p_exercise_id uuid default null
) returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid; v_programme_id uuid; v_count integer;
begin
  select programme_id into v_programme_id from public.athletes where id=p_athlete_id for update;
  if not found then raise exception 'Athlete not found'; end if;
  if not exists(select 1 from public.programme_weeks where id=p_programme_week_id and programme_id=v_programme_id)
    then raise exception 'Programme week does not belong to athlete'; end if;
  if p_request_id is not null and not exists (
    select 1 from public.technique_video_requests where id=p_request_id and athlete_id=p_athlete_id
      and programme_week_id=p_programme_week_id and status='open'
  ) then raise exception 'Invalid video request'; end if;
  select count(*) into v_count from public.technique_video_submissions
    where athlete_id=p_athlete_id and programme_week_id=p_programme_week_id
      and (upload_state='ready' or (upload_state in ('reserved','uploading') and reserved_until>now()));
  if v_count>=3 then raise exception 'Weekly video limit reached'; end if;
  insert into public.technique_video_submissions(athlete_id,programme_week_id,request_id,exercise_id,uploaded_by)
    values(p_athlete_id,p_programme_week_id,p_request_id,p_exercise_id,p_uploaded_by)
    returning id into v_id;
  return v_id;
end $$;
revoke all on function public.reserve_technique_video_slot(uuid,uuid,text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.reserve_technique_video_slot(uuid,uuid,text,uuid,uuid) to service_role;
