-- Preserve revisions without changing existing feedback replacement or triage behaviour.
create schema feedback_history_private;
revoke all on schema feedback_history_private from public,anon,authenticated,service_role;
create table public.feedback_revision_events(
 sequence_id bigint generated always as identity primary key,
 event_id uuid not null default gen_random_uuid() unique,
 recorded_at timestamptz not null default clock_timestamp(),
 transaction_id bigint not null default txid_current(),
 feedback_id uuid not null,
 operation text not null check(operation in ('INSERT','UPDATE','DELETE')),
 actor_user_id uuid,
 actor_role text not null,
 before_record jsonb,
 after_record jsonb
);
-- No cascading FK: removal of the source must not erase its retained answers.
create index feedback_revision_source_sequence on public.feedback_revision_events(feedback_id,sequence_id desc);
alter table public.feedback_revision_events enable row level security;
revoke all on public.feedback_revision_events from public,anon,authenticated,service_role;
revoke all on sequence public.feedback_revision_events_sequence_id_seq from public,anon,authenticated,service_role;
grant select on public.feedback_revision_events to authenticated,service_role;
create policy feedback_revision_admin_read on public.feedback_revision_events for select to authenticated
 using(exists(select 1 from public.admin_profiles a where a.user_id=(select auth.uid())));
create function feedback_history_private.immutable_event() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Feedback history is immutable';end;
$$;
create trigger feedback_revision_immutable before update or delete or truncate on public.feedback_revision_events
for each statement execute function feedback_history_private.immutable_event();
create function feedback_history_private.capture_revision() returns trigger
language plpgsql security definer set search_path='' as $$
declare prior jsonb; saved jsonb; fid uuid;
begin
 if tg_op<>'INSERT' then prior:=to_jsonb(old);fid:=old.id;end if;
 if tg_op<>'DELETE' then saved:=to_jsonb(new);fid:=new.id;end if;
 if prior is not distinct from saved then return null;end if;
 insert into public.feedback_revision_events(feedback_id,operation,actor_user_id,actor_role,before_record,after_record)
 values(fid,tg_op,auth.uid(),coalesce(nullif(auth.role(),''),session_user),prior,saved);
 return null;
end;
$$;
revoke all on all functions in schema feedback_history_private from public,anon,authenticated,service_role;
create trigger feedback_revision_capture after insert or update or delete on public.feedback
for each row execute function feedback_history_private.capture_revision();
comment on table public.feedback_revision_events is 'Immutable source feedback row revisions from installation onward. Submission IDs, original answers and review state retained. Not proof of displayed workout version.';
