# Protected workout publishing — QA and rollout gate

## Scope
Existing Hub UI remains unchanged. This branch stages:
- `admin-workout-publish` (authenticated administrator-only preview/update endpoint)
- `admin_update_workout_block` (atomic edit and readback RPC)
- delivery-target and exercise validation helpers
- existing programme assignment safeguard (separate; NOT required for ordinary edits)

## Existing architecture
- Private athlete with a direct `athletes.programme_id`: delivered through `private-athlete-hub-data.loadAssignedProgramme`. A NULL cohort is normal.
- Parent/school and other cohort routes: delivered from `cohorts.programme_id/current_week`.
- Workout content: `programme_weeks -> training_days -> session_blocks.content`; exercise demonstrations: `exercises.code/video_id/video_url`.
- Free-text `items` do not automatically link to library demonstrations.
- Airtable is coaching/CRM context; Supabase is the authoritative live workout delivery database. Do not infer athlete IDs from names.

## Deployment prerequisites (NOT YET MET)
1. Review migration SQL with a database engineer and run it against an isolated clone.
2. Confirm a known authorized Supabase Auth user ID and set `DU_ADMIN_USER_IDS` as a comma-separated **server-side** environment variable. Never expose a service role key.
3. Apply the `admin_update_workout_block` migration through a reviewed migration process.
4. Deploy `admin-workout-publish` with `verify_jwt=true`.
5. Ensure the calling client uses a valid Supabase Auth JWT; no unauthenticated browser calls.
6. Confirm no production push or UI change without approval.

## Mandatory tests before claiming end-to-end success
- Unauthorized/no JWT -> 401; valid non-admin JWT -> 403.
- Admin JWT preview -> 200, exact athlete/programme/week/block and recipient count.
- Wrong athlete, programme, week or block -> reject without writes.
- Direct private athlete with no cohort -> preview/edit succeeds for the assigned programme.
- Parent/school cohort -> correct route, no cross-programme leakage.
- Shared programme -> refuse edit without explicit `confirmShared`; with approval show affected recipient count.
- Missing or inactive exercise code -> rollback.
- Empty or incomplete structured prescription -> rollback.
- Stale `expectedContent` -> rollback (no lost updates).
- Correct edit -> atomic readback matches exactly; previous content available for rollback.
- Restore prior content using another confirmed edit; verify original state restored.
- Authenticated private, parent, school/coach browser login -> confirm new dosage, rest, exercise and demo URL actually render.
- Validate responsive mobile screens; no regressions in access, completion or feedback.

## Tested so far
- Live read-only SQL: 9 of 10 active athlete records have a currently published direct/cohort delivery configuration. `Coach Du QA Preview` points to an archived week.
- Read-only schema/repository inspection and direct/cohort routing tests: 13 of 13 logic checks passed in the JS tool runtime.
- Existing local Node suite: 10/10 passed (earlier validator version).
- No authenticated production browser delivery, database write/rollback, migration execution, or real video playback tests have passed yet.

## Risk notes
- `admin_update_workout_block` edits one block, not entire day/week or assignment; more operations require separately tested RPCs.
- Shared programme edits change every recipient of that programme. Do not use for individual exceptions.
- No persistent audit history table was added. The RPC returns `previous_content` to the authorized caller; record it securely before proceeding.
- For youth athletes, do not automatically advance training when recent illness/pain feedback needs coaching review.

## Administrator identity decision (Oct 2026)
- Designated Coach Du administrator email: `coachdu@duairlineseliteacademy.com`.
- Keep `duchenge28@gmail.com` as Parent Access/test account, not administrator.
- The Supabase dashboard owner's email is separate from Supabase Auth users.
- Do NOT add email string comparisons to the Edge Function and do NOT put admin email, Auth user IDs, access tokens or service-role secrets in public client HTML.
- First create/sign in to a verified Supabase Auth account for the business email using the normal supported flow. Look up its Auth user UUID in the protected Supabase Auth dashboard.
- Set the `DU_ADMIN_USER_IDS` Edge Function environment variable to that verified UUID (not the email); configure the environment variable only in the server-side secrets manager.
- Verify a normal parent JWT receives 403 and the verified admin JWT can preview before authorizing any write.
- No Auth account has been created or granted privileges by this documentation change.

## Existing administrator Auth record (user-provided screenshot, Oct 11)
- Existing Supabase Auth user: `coachdu@duairlineseliteacademy.com`, user UUID `ecc90043-119b-4985-b3ac-b4fef2930728`.
- Do not create a duplicate Auth user. Verify `email_confirmed_at` and a successful Auth sign-in before enabling admin privileges.
- After verification, configure server-side `DU_ADMIN_USER_IDS` with this UUID; do not put this value or any credentials into public HTML.
- User record presence alone is not proof of a verified email or functioning login.

## Deployment progress — 2026-10-11
- Confirmed Coach Du's existing Supabase Auth user has a verified email.
- Applied migration `admin_update_workout_block_20261011` successfully to the live Supabase project. Initial attempt failed because the grant signature omitted the expected-content argument; corrected and reapplied successfully.
- Deployed `admin-workout-publish` Edge Function version 1 with `verify_jwt=true`; function status ACTIVE.
- **Not enabled for publishing yet:** `DU_ADMIN_USER_IDS` server-side secret must be configured with the verified administrator's Auth UUID through Supabase Dashboard -> Edge Functions -> Secrets. There is no secret-management action available through the current integration. Until configured, endpoint returns `ADMIN_NOT_CONFIGURED` (503).
- No live athlete workout blocks were edited, no production GitHub branch was pushed, and no authenticated publish/readback/rollback test was performed.
- After secret configuration: test preview with Coach Du JWT, non-admin rejection, a reversible QA-only block edit with explicit target confirmation and snapshot, readback, restore, then check rendered Hub.
- Function rollback: disable/delete `admin-workout-publish` in Supabase. Database rollback (after checking dependencies): `DROP FUNCTION IF EXISTS public.admin_update_workout_block(uuid,uuid,integer,uuid,jsonb,jsonb,boolean);` Do not run rollback casually while requests are in flight.
