# Mandatory weekly check-ins — release runbook

Status: implementation on `feat/mandatory-weekly-checkins`; production unchanged. Merge, deployment and activation require Coach Du's separate approval. Target initial end-of-week release November 13–15, 2026. Normal start/end schedule begins November 16.

## What changes

Authenticated parents and private athletes pass through a dedicated entry step. Four standardized questions plus applicable followups are validated on the server. Missing reports block delivery; submissions clear only their own requirement. Unknown answers are explicit. An accurate partial end report satisfies the requirement and can be amended. Only newly enrolled current assignments generate requirements; outstanding requirements persist across assignment changes.

One unique requirement exists per athlete, assigned programme week and check-in kind. Saves lock the requirement, preserve revisions in the existing feedback audit and reject stale amendments. Receipt keys make exact retries idempotent and cannot acknowledge another actor/context. Safety holds retain the original concerning answer even after a healthy amendment. Ordinary feedback review cannot release them; an explicit generation-checked admin decision with a review note is required. This controls coaching access, not medical clearance.

## Deliberate scheduling choices

- Dates use the configurable business timezone `America/Chicago`, with an optional `athletes.checkin_timezone` override (for example `Africa/Harare`). Confirm overrides before activation. Browser clock never determines eligibility.
- Several existing assignments have missing/stale start dates. Enrollment snapshots the current calendar Monday when the supplied assignment date does not match the current week. That snapshot stays fixed. No old programme history is enrolled.
- An assigned programme week is checked in once, even if Coach Du leaves it assigned across multiple calendar weeks. A newly assigned programme week generates its own requirements. Do not repeatedly require the same report when an assignment is unchanged.
- End reporting opens Friday in the assignment's timezone, or earlier when the athlete/parent declares they finished. The UI opens it after all main sessions are marked complete. This opening never fabricates a training completion record.
- Safety, issue reporting, contact and logout remain accessible without a successful check-in-status fetch.

## Files / infrastructure

Existing `feedback` and `feedback_revision_events` remain authoritative for submitted answers/history. Additive config, requirement, receipt, hold and review-event tables preserve all existing records. RPCs are executable only by the server role; actor identity comes from verified authentication. Direct programme REST reads are restricted to admin while enforcement is enabled; eligible programme delivery uses the checked Edge paths. Existing school/professional delivery uses its existing server path.

Coach review: `/hub/checkin-review/` (existing Supabase admin account; backend verifies `admin_profiles`). It displays submitted/missing reports, unenrolled active accounts, issue reports and safety holds. An unenrolled account is not treated as having completed feedback. The review list is limited to the latest 1,000 requirement rows and 100 issue reports; open holds are not truncated.

## Verification

- Local full Node regression: 238 tests passed before final release check; repeat and record final count below.
- Disposable PostgreSQL: rollout dates, timezone midnight, duplicate requirements, concurrent saves, optimistic amendments, original answer retention, cross-user/role rejection, direct RPC denial, restrictive programme policies, overdue transitions, early end opening and safety release tested.
- UI integration: both audiences execute the actual UI, real handlers, normalizer and SQL in a disposable database. Retried submissions, amendments, unknown values, conditional details and safety holds tested.
- TypeScript shared handlers/repository: checked with TypeScript 5.9.3.
- Hosted login / production deployment / production migration: not performed.
- Local Playwright: blocked by Chromium launch (`socket() failed: Operation not permitted`). Browser tests are checked into CI; do not describe mobile/desktop visual QA as passed until its workflow completes.

## November 12 continuation verification

- Fixed the CI browser failure's duplicate route refresh: eligible navigation now schedules the entry guard once, while school/professional dashboard refresh behavior is preserved. A new regression failed before the fix and passes after it.
- Updated the homepage preservation normalizer for only the check-in asset tags and named entry hooks. The immutable homepage/integration baselines remain unchanged; both checks pass.
- Fresh local results: 239 application tests, 17 check-in database tests, 7 reversible guided-routine database tests, 1 school HTTP authorization test, 9 public-link tests and 14 story checks passed.
- Local Chromium remains blocked by `socket() failed: Operation not permitted`. Mobile/desktop browser verification is still pending. The previous CI head failed before this fix, so its result is not release approval.
- Fix commit: `a6bd60f`. Automatic approval review rejected the feature-branch push because it requires explicit authorization for the remote write. No retry through another route was attempted. Obtain push authorization, then rerun all PR checks before requesting merge/deploy/activation approval. Production remains unchanged.

## Approved release sequence (do not execute before approval)

1. Record production static commit and deployed Edge versions. Confirm existing feedback audit migration is installed. Back up schema/config and record row counts without exposing athlete data.
2. Apply `supabase/migrations/20261112090000_mandatory_weekly_checkins.sql`. It inserts `enabled=false`. Do not enable yet.
3. Deploy `parent-hub-data`, `private-athlete-hub-data`, `workout-completions` and the new `weekly-checkin-admin` functions with the project's existing authentication settings. The handlers verify users themselves; never expose the service role.
4. Merge/deploy static files only after checks pass. Confirm account login/onboarding and school/professional flows still work with enforcement disabled. Confirm `/hub/checkin-review/` rejects a nonadmin and works for Coach Du.
5. Set per-athlete timezone overrides as appropriate. Confirm November 13 rollout dates. Enable only after coordinated static/backend verification and explicit activation approval:
   `update public.weekly_checkin_config set enabled=true where id=true;`
6. Verify private and parent entry, direct training URL denial, exact retry, saved amendment, safety hold and coach release using isolated authorized demo identities. Do not use real athlete answers for smoke tests.

## Rollback

First disable enforcement: `update public.weekly_checkin_config set enabled=false where id=true;`. This also restores direct programme reads under the pre-existing RLS policies. Retain all new tables and saved answers. If needed restore the recorded static commit and prior Edge functions. Do not drop feedback, requirements, receipts, holds, review events or revision history. Re-enable only after the corrected release is verified and approved.
