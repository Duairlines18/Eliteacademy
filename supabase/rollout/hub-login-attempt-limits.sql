begin;
create table public.hub_login_attempts (
 bucket_key text not null,
 window_start timestamptz not null,
 attempts integer not null check(attempts>0),
 primary key(bucket_key,window_start)
);
create index hub_login_attempts_expiry on public.hub_login_attempts(window_start);
alter table public.hub_login_attempts enable row level security;
revoke all on public.hub_login_attempts from public,anon,authenticated;
grant select,insert,update,delete on public.hub_login_attempts to service_role;
create function public.consume_hub_access_attempt(p_key text) returns boolean
language plpgsql security invoker set search_path=public,pg_temp as $$
declare win timestamptz:=to_timestamp(floor(extract(epoch from clock_timestamp())/600)*600); total integer; client_total integer;
begin
 if p_key !~ '^[a-f0-9]{64}$' then return false; end if;
 -- The global counter caps guesses even when client-supplied forwarding headers vary.
 insert into hub_login_attempts(bucket_key,window_start,attempts) values('global',win,1)
 on conflict(bucket_key,window_start) do update set attempts=hub_login_attempts.attempts+1 returning attempts into total;
 if total>1000 then return false; end if;
 insert into hub_login_attempts(bucket_key,window_start,attempts) values(p_key,win,1)
 on conflict(bucket_key,window_start) do update set attempts=hub_login_attempts.attempts+1 returning attempts into client_total;
 delete from hub_login_attempts where window_start<win-interval '1 day';
 return total<=1000 and client_total<=60;
end $$;
revoke all on function public.consume_hub_access_attempt(text) from public,anon,authenticated;
grant execute on function public.consume_hub_access_attempt(text) to service_role;
commit;
-- Rollback: restore verify-hub-access prior bundle first. Keep counters private;
-- do not remove limits while eight-character credentials remain active.
