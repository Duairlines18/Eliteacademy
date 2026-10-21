# Performance Hub release verification — 21 October 2026

**Release gate: HOLD for authenticated account and hosted publishing verification.**

Audited website commit: `54967c70ce611571f82b4be4d847f070294630e3`, feature branch `feature/premium-hub-v2-role-ui`, draft PR #58. Control Room: `dbcf42f`. No merge, production deployment, database write, account creation, credential extraction or access-code retrieval was performed.

## Role results

| Experience | Replayed browser UI | Real authenticated account |
| --- | --- | --- |
| Private Athlete | PASS at 320, 390 and 1280px | NOT VERIFIED |
| Parent | PASS at 320, 390 and 1280px | NOT VERIFIED |
| School Coach / Staff | PASS at 390 and 1280px | NOT VERIFIED |
| School Athlete | PASS at 390 and 1280px | NOT VERIFIED |

The browser tests replay API responses built from a read-only current-programme export with QA identity labels. Supabase Auth and API responses are fixtures. Clipboard, rendering, navigation, player controls and scroll behavior run in Chromium. These checks do not verify real JWTs, valid access-code exchange, account-level isolation, saved completions or actual YouTube playback.

## Verified evidence

- GitHub independently confirmed the four supplied workflows succeeded on `54967c7`.
- Fresh full delivery suite: 92 tests passed; isolated PostgreSQL suite: 18 passed; Control Room publication validator: 10 passed; story suite: 14 passed. Homepage source/syntax and production-integration preservation checks passed.
- Homepage Chromium: 363 assertions across 375, 390, 430, 768 and 1440px.
- Expanded delivery Chromium: 803 checks across all four roles. Checks cover identity, training/calendar layout, saved instructions, Quick View/Guided Mode, copy policy, real clipboard contents, school group filtering, horizontal overflow and runtime errors.
- Player checks cover compact default, exact selected video ID, fullscreen permission, manual expand/minimize, retained iframe, closing/reopening, Escape, original workout URL, scroll restoration and unchanged workout text. Native OS fullscreen and video playback remain unverified.
- Read-only current-programme delivery validation: 15 distinct current programme weeks, 188 blocks, 429 reviewed demo links and 471 structured prescriptions. Rendered dosage/rest, copied instructions, demo mapping and publication checks passed. The export also covers live cohort assignments; it is not an authenticated export from each individual account.
- All 9 active athletes have an assignment to a live programme and a published, verified current week. There are 7 linked athlete accounts and 2 linked parent accounts. This verifies configuration, not the correctness of an unseen coaching decision or successful login.
- Across stored blocks: 3,488 structured/legacy code references, zero invalid/inactive codes; zero unresolved generated demo names; zero invalid generated item indices; zero duplicate active exercise names; zero detected ordinary-bridge false matches for single-leg glute bridges. All 262 position-aligned structured/generated links agree on movement identity. Mixed-format rows are covered separately by the render/validator checks.
- The deployed `hub-data`, `parent-hub-data` and `private-athlete-hub-data` bundles match repository TypeScript source, ignoring trailing whitespace.
- Actual HTTP requests without credentials received 401 from `hub-data`, both account delivery endpoints, `workout-completions` and `admin-workout-publish`. No positive authenticated HTTP result is claimed.
- RLS is enabled on all 37 public tables. Account lookups bind to the verified user ID; direct assignments take priority over cohort assignments. Shared school sessions bind to a server-validated cohort and role. Current staff access is cohort-code based, not individually identified staff-account access.

## Video source of truth and remaining boundaries

`public.exercises` remains canonical. Structured prescriptions use exercise codes; legacy rows use the existing SQL trigger and reviewed aliases. Protected delivery loads current canonical URLs for reviewed movements. This QA adds no matcher and changes no exercise URL or prescription.

There are 65 active exercises. Two have no video: `SPR06` (Fast Feet → Run) and `ACC05` (10–30m Acceleration). The one stored code reference without a video is SPR06 in an earlier Week 4; current-programme validation above passed. No related movement was substituted. Add the correct recording through the existing library workflow when available.

No active athlete currently uses an exercise substitution. Synthetic substitution tests verify preserved dosage, rest, mirrored movement references and safety text, but no live substitution delivery is claimed. Editing only a library URL does not rerun legacy block triggers; protected delivery reads current URLs, and any stored-link backfill still needs separate review.

Security advisors also report two pre-existing mutable-search-path functions and disabled leaked-password protection. Eight tables have RLS with no policies; this denies ordinary client access and is consistent with protected server access, not evidence of public exposure. No security setting was changed. References: [search-path advisory](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Changes in this QA increment

- `hub-delivery/browser.qa.cjs`: update the stale name-only assertion to the approved “Hi, [athlete]” identity; scope fixture initialization to localhost so it does not inject storage operations into video frames; add compact-player/context checks; add desktop school-role coverage.
- This report. No product code, Control Room code, Supabase function, table, policy or data change.
- Browser dependencies were installed outside the application repository. No production dependency was added.

## Required next gates

1. Secure sign-in to an authorized test private athlete and parent account; verify actual identity, assignments, demos, routines, completion save/reload and denial of unrelated athlete selectors.
2. Secure school athlete/staff code entry in the browser; verify cohort isolation and role restrictions with actual sessions.
3. Authorized administrator sign-in; use an existing dedicated disposable QA programme, not a real athlete workout. Test preview → confirmed edit → hosted readback → authenticated Hub → restore, plus stale-preview and non-admin denial.
4. Verify real YouTube playback and native fullscreen on the target devices.
5. Recheck the final PR head and workflows. Obtain explicit final approval before merging or deploying.

The live website was observed at its access selector and existing private-athlete sign-in form. It is production, so it cannot establish that PR #58's unmerged presentation changes are deployed.

## Reproduction and rollback

Run the commands in `.github/workflows/full-delivery-regression.yml`, then `node --test qa/*.test.cjs` from the Control Room repository. Run `PGLITE_MODULE=/path/to/pglite/dist/index.js node supabase/qa/database.integration.mjs` for isolated database checks. The browser replay command is `HUB_QA_FIXTURES=/private/path/fixtures.json CHROMIUM_EXECUTABLE=/path/to/chromium node hub-delivery/browser.qa.cjs`; fixtures must stay outside git. It expects the four existing QA labels Andria, Larry, Pride and Okello and server-shaped programme payloads with actual demonstration links.

Rollback this increment by reverting its QA commit on the feature branch. Production needs no rollback because it was not changed. Restore any future hosted QA content edit through the protected preview/confirm/readback workflow using its captured original content. Do not reset athlete workouts or undo existing video repairs.
