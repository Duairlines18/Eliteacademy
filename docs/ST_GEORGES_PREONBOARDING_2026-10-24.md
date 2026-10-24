# St. George’s pre-onboarding release package

Status: implementation prepared on `feature/st-georges-six-athlete-preonboarding`; public release is NOT authorized or performed.

## Database operations completed

The reviewed `supabase/rollout/st-georges-preonboarding.sql` transaction was executed and read-verified on project `hiktwkdfvlujszczthdu`. It creates no tables, columns, policies, Auth users or administrator memberships.

| Temporary identity | Stable athlete UUID | Access |
|---|---|---|
| St. George’s Athlete 01 | 2125ed9b-fa9a-4280-aed7-feaeceeb2512 | Paused reservation |
| St. George’s Athlete 02 | 49ad0afd-dfc7-42fc-8171-8f43f95b654d | Paused reservation |
| St. George’s Athlete 03 | ae1f4e0f-efd3-4605-942f-d42c64008661 | Paused reservation |
| St. George’s Athlete 04 | 6da224c6-01a5-4f5c-9ddf-eea4f5c903a6 | Paused reservation |
| St. George’s Athlete 05 | 5a239b45-7f8e-44ee-82cf-68c5c9e0b722 | Paused reservation |
| St. George’s Athlete 06 | 272aff8c-2c68-4580-bd99-df2a06a9f7cc | Paused reservation |

All six use organization `a827b9b0-bb2b-4429-abaa-98aa32b90e11` and cohort `3e456205-257e-4954-a5cd-1eb163599bb3`. The cohort remains their programme-assignment authority; direct `programme_id` is null. Forms, events, marks and medical details remain unknown; payment is pending, start date null, and private onboarding metadata marks the test batch.

Coach Dube is staff UUID `e30e18d8-341f-460a-a464-d211197ea23a`, with one membership in the same cohort and one independent paused code reservation. No unrelated school or private-athlete permissions were granted.

The cohort is now linked to its existing organization. Existing demo codes were neither replaced nor extended; their original status, expiry and last-use values were checked after provisioning. The original published programme and its four-day configuration are unchanged.

## Programme draft

Draft programme `9d5f562a-fa5b-44d1-a366-52e14bd3978c` contains four unpublished, unverified weeks. Week 1 copies existing Day 1 and Day 2 prescriptions plus the old optional Day 4 as optional Day 3. Two coached days target approximately 60 minutes; timing needs coaching review. Existing exercise/video references remain intact. The unchanged saved ASIM base is included in both coached days as Air Zim Warm-Up.

Weeks 2–4 contain review objectives, not invented sets, loads or progressions. Introductory plyometrics, core coverage, early jump technique, medicine balls/sleds, missing rests, forms and readiness still require Coach Du review. Week 1 is staged for that review, not declared launch-ready. The intended 2+1 schedule is retained with draft metadata; switching the live cohort assignment and expected count must happen together after configuration approval.

Before-images of cohort/programme/weeks/days/blocks and created-ID metadata are preserved in two administrator-only `programme_versions` records under the batch marker `st-georges-preonboarding-20261024`.

## Implemented behavior

- School code and session records carry person identity. Every school bootstrap, completion, journey and coach-review request checks active profile, matching code/session identity, cohort, organization for athletes, and staff membership for named staff.
- Legacy shared codes remain cohort-scoped. No client-supplied athlete ID, viewer key or leftover account sign-in overrides an identified school session.
- Completion keys derive from athlete UUID. UI progress and form selection are isolated per athlete; late requests from a previous login cannot mutate the current display. Assigned forms override local preview choices.
- Full placeholder display names remain distinguishable. School layout, compact videos, optional expansion and separate routines navigation are retained.
- Server logout revokes the code session. The browser clears local progress immediately; a failed network request cannot guarantee remote revocation until an administrator revokes it or it expires.
- Existing Control Room code creation now supports a named athlete/coach, generates 32 cryptographic random bytes, stores SHA-256 only and displays plaintext once. Individually replacing a code pauses that person's prior credentials and revokes their sessions; new credentials stay paused until explicitly activated.

## Credential procedure

Reservation hashes intentionally have no retained readable code. They cannot be retrieved and are not usable logins. This prevents accidental admission through the old production cohort-only backend.

After the identity-aware backend and Control Room are authorized and deployed: sign in as administrator, open Access Management, select the school cohort and named athlete or Coach Dube, enter a label and optional expiry, then generate. Save the displayed credential securely once. The default test expiry is seven days. Activate only after the backend is verified; do not send anything externally without Coach Du's release authorization.

Regenerating for the same person preserves the athlete UUID, assignment and completion records. Other five athlete codes and legacy shared codes remain unchanged. If rotation fails, the new record stays paused and no raw code is returned. Verify old code and old token rejection after rotation.

## Verification and limitations

- Website unit/static regression suite: 110 tests passed, including stale-401 and named-staff roster isolation cases.
- Synthetic HTTP integration: one integration test passed for six identities, same-browser viewer spoof resistance, staff completion denial, invalid token and logout. This uses in-memory synthetic records, not live Supabase.
- Control Room generation/rotation and workout validation: 13 tests passed.
- Homepage structure, script syntax and scoped preservation checks passed after extending its existing approved-change normalizer to these named Hub functions. Public forms/content remain protected; line endings are normalized only in the comparison.
- Security review found a stale-response identity race; deferred bootstrap/list/save tests reproduced it RED and passed GREEN after the fix. No Critical review findings were reported.
- Live data checks verified six athlete identities, one named coach/membership, seven paused reservations, four unpublished draft weeks and unchanged original demo credentials/programme.
- All 20 original school exercise codes and 20 distinct reviewed video links resolved to active canonical records in Phase 1. This proves mapping consistency, not footage correctness or successful playback.
- `school-identity.browser.cjs` is prepared but was NOT executed here. It is designed to run desktop/mobile Chromium against real authorization service code with synthetic in-memory records. It is deliberately NOT production-equivalent Supabase end-to-end testing. It checks six names, independent completion, refresh, routines, matching demo iframe, compact/expanded player, staff read-only copy UI and viewport fit. Video network is blocked; it does not prove YouTube playback.

The separate Supabase test branch was declined. The cloud browser also cannot reach the local fixture server. A non-public, runnable Supabase-equivalent environment is therefore not currently available. Production signed-in tests for all seven identities, real RLS behavior, uploads, actual video playback, session expiry/reopen across devices and private/parent/school production regression remain release blockers. Do not describe this package as live-ready solely because code tests or records pass.

## Current publication blockers

The website feature-branch push was rejected by automatic approval review because publishing the broad implementation to this public repository would disclose internal source, schema/rollout details and identifiers without sufficiently explicit public-disclosure authorization. It was not bypassed. The Control Room command-line push failed because Git credentials were unavailable. Neither branch was published, no PR/CI run occurred, and neither website nor Edge Functions were deployed. Both branches have local commits; obtain explicit approval for publishing their exact payload before attempting another public push.

## Source and deployment

Changed website files include `index.html`, `hub-delivery/premium-v2.js`, shared school authorization/completion/repository services, school login/logout and completion entrypoints, journey and coach-review authorization, focused tests, workflow and rollout documentation. The formerly untracked deployed login/completion/school-review entrypoints are now recorded in Git. Control Room changes are limited to `index.html`, `access-codes.js` and focused tests.

Exact deployed before-bundles for the six affected school endpoints are retained under `supabase/rollout/baseline-20261024/`. They contain source and version metadata, not secret environment values. Preserve endpoint-specific shared-file differences when planning deployment; do not redeploy every Supabase function indiscriminately. Public release, merge and production function deployment still require explicit authorization.

No new production environment variables are introduced. Local fixtures optionally use `DU_SCHOOL_QA_PORT` (default 4173). Production functions use existing server-side Supabase environment credentials. The frontend continues using its publishable key. No service-role key or readable code is committed.

## Replace names and details

Edit the existing athlete record: `full_name`, `display_name`, `form_tier`, `events`, `personal_bests`, and appropriately private onboarding/coaching fields. Retain UUID, cohort, code binding and progress. Remove the testing flag only when the real athlete is confirmed. Do not create another athlete to change a name. A form change may version the Journey assignment through an existing trigger; it does not delete completions. Confirm training-day labels and official start date only after the school schedule and payment are agreed.

## Rollback

Do not execute the rollout twice: it deliberately rejects an existing batch rather than duplicating people. `st-georges-preonboarding-rollback.sql` pauses batch credentials, revokes their sessions, archives test identities/drafts and restores the prior organization link, while keeping all progress and original programmes. It stops if the cohort assignment has changed since provisioning. It has been reviewed but not executed, because the provisioned work is being retained.

Before any future authorized deployment, record the selected commit and function versions. Revert feature commits and restore the saved deployed function bundles if release verification fails. Original demo credentials must remain untouched. Never delete programme history or real training progress as a rollback shortcut.
