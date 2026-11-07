# Sunday release runbook — November 8, 2026

Deadline: 3:00 PM CST (21:00 UTC). Coach Du owns production decisions.

## Current decision

Preparation is approved. Production remains NO-GO until the evidence gates below pass and Coach Du explicitly approves the named merges, migrations and deployments. Do not lower a gate to meet the deadline. If a gate remains blocked, retain current production and record the exact blocker.

## Approved preparation and evidence

The release assembly helper addresses a verified source/deployment difference: repository shared modules include authentication and repository-method changes beyond the reviewed video repair. It preserves each captured live endpoint's original dependencies, JWT configuration, entrypoint and authentication prefix. Only shapeBootstrap's renderer, the reviewed-exercise loader and the account adjustment function are replaced. Candidate hashes must match the reviewed parity manifest exactly. Capture version/configuration, baseline hash or import drift aborts assembly.

No app, auth, pricing, prescription or production data change is made by running the helper. It performs no network calls and never deploys. Artifacts are preparation only, not proof of hosted compatibility.

Source baseline for this work: website #88 at 25a6f1adfc7992c54d83ceb0362a8d827ceb1db6. Control Room #8 at 987c02a05abff0d5e736ba237f324a9070a181d3 depends on #7 (59f45b006b051c1fccc45e7391e6dd2cb68e679a), then #6 (a528b5a37c69989980d8d426bdbee6f9d75b312c). Re-read actual remote heads before release.

The existing full delivery CI already discovers qa/*.test.cjs, including the new assembler tests; no workflow expansion or dependency installation is needed for this helper.

## Offline assembly

1. Use a clean committed checkout of the approved candidate. The CLI refuses uncommitted changes to its own module, function sources or parity reference.
2. Read-only recapture hub-data, parent-hub-data and private-athlete-hub-data with Supabase get_edge_function. Save each complete parsed function object as <slug>.json in a private directory outside the repository. Do not save credentials, session tokens or athlete records. Preserve the returned files, version, verify_jwt, import_map and entrypoint_path.
3. Confirm live state still matches docs/VIDEO_RELEASE_PARITY_2026-11-07.json. Do not edit that reference merely to make a drift failure disappear. Investigate drift, review its implications and renew approval if scope changes.
4. Use a new, nonexistent output directory whose parent already exists:

```sh
node qa/assemble-video-release.mjs --capture-dir /private/captures --output /private/release-candidate
```

The example paths are placeholders for private local directories. Output contains one isolated source tree and settings.json for each endpoint, plus manifest.json written last. A missing manifest means incomplete output. Never deploy a partially written directory. Existing output directories are rejected rather than mixed or overwritten; after a failed write, choose a different fresh directory and investigate the failure.

The manifest records the exact committed source SHA, the original approval source SHA, baseline versions, original JWT flags, original entrypoints, and SHA-256 hashes for every baseline and generated file. All original remote imports remain unchanged. Relative imports must resolve within each endpoint's captured bundle.

5. Import the generated shared TypeScript modules locally and rerun exact-code, renamed-library, lookup failure, stale-binding, compound-row swap and no-demo checks against those generated files. Also verify original login/expiry behavior is unchanged. This is local runtime evidence, not hosted sign-in or actual footage playback.
6. Before staging/deploying, verify artifact bytes against manifest.json again. The helper's source SHA is meaningful only for a committed checkout. Capture and retain baseline bundles separately as rollback material.

## Required gates and honest status

| Gate | Acceptance | Present status |
| --- | --- | --- |
| Source preservation | Latest main ancestor; homepage, six handoff pages and approved pricing preserved | Passed at audited baseline; refresh before release |
| Automated regression | Website, admin, database/history and publishing suites pass on final source | Passed locally; rerun CI on new preparation commit |
| Mobile/desktop browser | Final candidate onboarding, refresh, school/director routes and editor save | Prior candidate CI passed with synthetic sessions; fresh local browser unavailable |
| Hosted identity | Parent, private athlete, school athlete, coach, director and admin normal sign-in; logout, refresh, saved setup and returning sessions | Blocked: no authenticated QA session |
| Hosted delivery and isolation | Intended current/past weeks visible; cross-user/cross-school and drafts denied; publishing protected | Only unauthenticated 401 probes passed; signed-in gate blocked |
| Media | Coach Du confirms correct movement footage; actual decoded playback on a physical iPhone | Blocked: no connected iPhone/authorized device-test method |
| Staging database | Exact live-schema/privilege parity, one-time migrations, replay refusal, rollback and two-connection contention/load | Disposable SQL checks pass; hosted/full-schema/concurrency gate open |
| Recovery | Verified provider backup/PITR time and retention, isolated restore rehearsal | Not verified |
| Business submissions | Opt-in QA submission persists and reaches the intended inbox without customer messages | Handoff pages/links inspected; actual receipt unverified |

Do not use real-athlete credentials in automation. Do not retrieve active access codes, forge JWTs, impersonate users with service-role privileges, or create shared-programme QA fixtures. Existing QA identities must have isolated mutable programmes before testing publishing, assignment changes or feedback. New hosted accounts/permissions and paid staging infrastructure require separate approval.

Where a real iPhone is unavailable, keep that gate blocked. Mobile viewport emulation, poster/title loads and video URLs are not evidence of decoded physical-device playback. ACC05 (10–30m Acceleration) and SPR06 (Fast Feet → Run) lack media; do not publish affected new demo-required prescriptions until Coach Du verifies appropriate demonstrations. Preserve prior training content.

## Database and function controls

Read-only comparison must cover the migration ledger, current schema, RPC grants, RLS, triggers and all deployed function files/settings. Production PostgreSQL was 17.6 at inspection. Existing function settings were hub-data v12/JWT false, parent-hub-data v8/JWT true, private-athlete-hub-data v12/JWT true, and admin-workout-publish v3/JWT true. Never infer that JWT false means the endpoint lacks application session checks.

Ordered pending migrations:

1. 20261107023631_delivery_audit_history.sql
2. 20261107030913_delivery_assignment_history.sql
3. 20261107055415_feedback_revision_history.sql

The migrations are additive one-time DDL, not blindly replayable scripts. Inspect the migration ledger and reject already-applied/partially present states. Use the migration runner's transaction/history behavior; prove failure recovery on staging before production. Do not turn duplicate-object errors into silent success.

The video rollout SQL replaces sync_session_block_exercise_videos without backfilling rows. Capture its exact live definition before any authorized application. Covered history is from installation onward; no historical record may be fabricated. Whole-week/library snapshots and audit-trigger write latency need staging measurement. Conflicting UPSERT updates to published blocks deliberately reject; ordinary UPDATE/INSERT editor paths need hosted validation.

Security findings remain tracked, not silently changed: ten RLS-enabled/no-policy informational findings, mutable-search-path warnings for two invoker functions, and disabled leaked-password protection. Confirm intended access; never add broad policies or weaken RLS to silence warnings.

## Controlled release after explicit production approval

1. Record exact approved source commits, tested artifact hashes, database baseline, restore point and rollback bundles. Confirm every required gate is passed, not waived by assumption.
2. Refresh live and GitHub state. Stop if either changed since verification.
3. Agree a short operational pause in Coach Du editing/publishing. Do not revoke users or change permissions for the pause. The old editor and replacement video trigger must not be used together during the switch.
4. In the reviewed order, apply the three history migrations and video trigger; deploy only the isolated endpoint artifacts with original settings; release the compatible Control Room stack and website candidate before resuming edits. Account for automatic GitHub Pages deployment when merging website main. Do not merge main as a harmless preparation step.
5. Use isolated hosted QA sessions to publish/read back, inspect the correct recipient view, deny another user/school and verify prior-week/history/feedback behavior. Confirm the real-user inventory remains unchanged. Test current production assets and actual iPhone playback.
6. Resume publishing only after checks pass. Record final live versions, release timestamp, source/artifact hashes and named rollback points. If any gate fails, stop progression and use the reviewed rollback.

## Backup and rollback

Before any production change, verify the actual provider backup/PITR restore point and retention; capture its identifier/time and rehearse an isolated restore. Source captures and database row counts are not backups. Keep private baseline schema/function/grant/trigger definitions and the migration ledger with the release record.

Baseline code rollback points: website main 6530ab665c8c4c9d3e3966800e2aa3f7fa0690da and Control Room main 28517156827e54702a086f583b5450417903329b, subject to a fresh recapture. Preserve every later approved business change when constructing a rollback.

Restore exact captured endpoint bundles with their original JWT flags and entrypoints. Restore the exact old video trigger definition if necessary. Disable only the new audit capture triggers under an approved rollback; retain immutable audit/revision tables and document the capture gap. Never erase audit evidence, overwrite programmes or restore the whole database over intervening valid athlete work as a routine rollback.

Rollback triggers include wrong-user/school visibility, missing assigned weeks, incorrect demonstrations, lost saved setup, broken publishing/save operations and elevated production errors. Artifact rollback does not automatically reverse data saved while the release was active.

## Monday operating checklist

- Verify each newly activated paying user can open their actual assigned current week and Day 1–3 through the correct role.
- Confirm St George's coach/director/athlete access and publish future draft weeks only after Coach Du's content approval.
- Review pending and previous-week feedback; use reviewed_at as the human completion signal.
- Check prescriptions, rest instructions, exercise codes and required footage before every publication.
- Check saved onboarding answers, activation and assignments without duplicate profiles.
- Monitor login, bootstrap, save/publish failures and inquiry receipt. Use opt-in QA messages for inbox checks.
- Preserve $69/$129 elite options, approved prices and brochure destinations; confirm renewal/programme coverage.
- If Sunday's release gates remain blocked, retain stable production and carry a precise blocker list into Monday.

## Execution ledger

- Implementation authorized by Coach Du after the November 7 readiness audit; no production authorization inferred.
- Work isolated on fix/qa-release-packaging-20261107 from website #88's audited head.
- First 16 assembler tests failed with the helper absent, then passed after implementation. Full website suite: 200/200 after adding them.
- Additional account-wrapper and committed-CLI integration checks pass: 18 packaging checks and final full website suite 202/202.
- Actual captured bundles assembled to the existing reviewed hashes: hub-data 8 runtime probes, parent-hub-data 13, private-athlete-hub-data 13 passed. No hosted deployment occurred.
- Ruling: use the existing feature checkout and a new branch; do not create another worktree or independent agents. This follows the authorized branch scope and Coach Du's instruction that specialist roles are responsibilities rather than independently running agents.
- Ruling: existing CI test globs already include assembly checks; omit a redundant workflow change.
- Final review: author self-review, following Coach Du's instruction against independently running agents. Inspected allowed splices, hash/config drift checks, relative imports, exclusive artifact creation, input immutability and committed-source labelling. No critical or important finding identified; independent review and hosted release gates remain outstanding.
- Hosted public-browser checks: the brochure story destination rendered, an athlete story opened and closed, and parent/private tabs selected the correct login destinations. These checks did not authenticate or submit data.
