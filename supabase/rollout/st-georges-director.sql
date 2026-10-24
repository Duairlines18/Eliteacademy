alter table public.staff_profiles add column if not exists access_profile text not null default 'coach' check (access_profile in ('coach','sports_director'));
-- No new RLS grants. Existing staff default to coach. Director access is separately assigned.
