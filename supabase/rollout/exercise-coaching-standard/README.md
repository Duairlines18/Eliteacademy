# Du Airlines coaching content audit — 15 November 2026

**Review candidate only. Separate release approval is required. No merge, deployment or production SQL execution is part of this work.**

## Recovery and implementation record

- Recovered the existing dirty `fix/exercise-coaching-standard` checkout, including its `index.html` edit, content test and complete rollout folder. A separate scratch recovery copy was retained before editing.
- Fetched GitHub: the feature branch and `main` both pointed to `15f302ebe0b5f06b307ee807a1dbc200718a943d` at recovery; there was no existing coaching-audit PR.
- Read the live exercise schema, all 85 exercise records, RLS policy, trigger inventory and migration history. All 85 proposed `before` values and exercise/video identities matched production. Every public table had RLS enabled; exercises had the existing admin-only policy and no user triggers. No policy changes are proposed.
- Completed text review, reproduced the saved custom-cue failure against the original code, added edge cases, and verified the fix. Rehearsed both SQL directions only in disposable PostgreSQL, including intentional side-effect failures.
- Extended existing regression CI with the new content-rollout database suite; extended the existing parent/private mobile and desktop browser fixture with cue/Avoid assertions.

## Findings and scope

85 active exercises, 83 distinct linked videos. Before audit: 20 missing descriptions, 20 missing purposes, 13 missing coaching cues. Existing descriptions were short; several purposes were legacy programme notes, not functional purposes. All 85 default dosages were null and remain null. Existing prescriptions, IDs, categories and video mappings remain unchanged.

78 named exercises now have concise technique guidance, a functional purpose, 2–3 short cues and common mistakes. Loading, timing and progression remain decisions in the assigned programme. Seven multi-movement series have general control cues, donts and a visible first-use instruction to confirm their exact sequence with Coach Du. Their actual sequences are not verified or invented. Shoulder Airplane and other named variants explicitly defer to the demonstrated position; the audit does not certify that any linked video visually matches its text.

The 7 series awaiting sequence verification: ACT09, ACT10, ACT11, ACT12, CORE12, MOB10, MOB11. Existing video verification limitations and original admin notes are preserved. Existing Couch Stretch alternate demonstration is preserved. This is a text and delivery audit, not a completed visual audit of 83 videos or an individualized rehabilitation prescription.

ACC05 and SPR06 already have no linked demonstration. Those empty mappings remain empty; no replacement was guessed.

## Seven-series demonstration checks

On 15 November, opened each exact mapping in the cloud browser. Each page displayed the corresponding title below. Every player remained at `currentTime: 0`, `readyState: 0`, with a black loading player. A reload of ACT09 and a playback toggle did not resolve it. This is a playback limitation in this environment, not evidence that the videos are private. Titles and media metadata cannot verify movement order.

| Code | Observed title / exact demonstration | Sequence result |
| --- | --- | --- |
| ACT09 | [Table Position — Six-Movement Activation Series](https://www.youtube.com/shorts/i7Kdkh2eSqE) | Unverified; no six-step order invented |
| ACT10 | [Seated Leg Raise Series](https://www.youtube.com/shorts/licUqHf0kuw) | Unverified |
| ACT11 | [Superman Activation Series](https://www.youtube.com/shorts/nDrQyHNwtRg) | Unverified |
| ACT12 | [Glute Bridge Activation Series](https://www.youtube.com/shorts/TYSVGbdo-lI) | Unverified |
| CORE12 | [Bear Series — Opposite Toe Touch](https://www.youtube.com/shorts/Tpp9h6tXNY8) | Unverified |
| MOB10 | [Body Circles Mobility Series](https://www.youtube.com/shorts/BeWvd3n4lk0) | Unverified |
| MOB11 | [Ground Mobility Series](https://www.youtube.com/shorts/wm0LZwdtImk) | Unverified |

All seven descriptions explicitly say **Sequence not yet verified** and ask for confirmation before first use. Only general control cues are supplied. Visual review must establish the actual setup, ordered movements, transitions and variant-specific Avoid guidance before claiming these sequences are verified. Neither prior conversation snippets nor exercise titles were used to invent an order.

## Delivery

The existing description / purpose / coaching_cues fields are retained. Cue: and Avoid: formatting is parsed by existing library, guided training and coach movement views. A custom structured-workout cue no longer suppresses library Avoid guidance when it has no explicit Avoid section. The custom cue, phase, dose and rest are preserved; an explicit workout Avoid note remains authoritative. No design or authentication changes.

Cue and Avoid fall back independently. Empty, whitespace-only and phase-only notes retain library guidance; Avoid-only notes retain the library cue. Multiline guidance parses without showing the Avoid text again as the main cue. The homepage preservation test excludes only this specifically tested parser from its older immutable baseline; unrelated forms and routes remain checked.

## Release and rollback

apply.sql is guarded, atomic and idempotent. It aborts if any named exercise/video or existing coaching text changed since the audit. It checks all protected exercise fields and programme content inside the transaction. Rehearse with BEGIN / ROLLBACK; apply only after tests pass and check persistence on a new query. rollback.sql restores exact prior coaching text only if current text matches this release; it preserves all protected fields and programmes. It never deletes an exercise.

Source files are the reviewable content.json, guarded changes.json and apply.sql / rollback.sql. No private athlete data or credentials are included.

The guards cover all protected exercise columns and snapshots of programmes, weeks, training days, session blocks, saved blocks/items, athlete/cohort overrides, athlete/cohort/professional assignments, programme versions, feedback and workout completions. Scripts acquire table locks; a future authorized release should use a short `lock_timeout` and a quiet window. They deliberately live under `rollout/`, outside automatic migrations.

After separate approval, rehearse `apply.sql` inside `BEGIN; SET LOCAL lock_timeout='5s'; ... ROLLBACK;` against a fresh baseline. Any stale identity, mapping or coaching edit requires re-audit, never bypassing the guard. Only an explicitly approved execution should commit. Re-query all 85 entries and protected data afterward.

If a future approved database release needs reversal, execute `rollback.sql` in a transaction with the same timeout, verify the exact prior coaching text and protected data, then commit. It aborts instead of overwriting subsequent coaching edits. `updated_at` records the rollback time rather than pretending the record was never edited. For frontend rollback, revert this PR's commit on a new branch and follow the normal review/release process. No rollback is needed now because nothing has been released.

## Verification results

Local Node 24 verification:

- Full delivery/content/service regression command from `.github/workflows/full-delivery-regression.yml`: **245 passed**, including all 85 rows through bootstrap, normalization, library cards, guided cards, school sheets and copied workout text.
- `node --test supabase/qa/exercise-coaching.database.mjs`: **12 passed**. Covers payload parity, atomic apply/retry/rollback/retry, rehearsal, stale text/name/video guards, later-edit rollback refusal, malicious side effects and admin/non-admin/anonymous exercise RLS.
- Disposable database and HTTP integration (`database.integration.mjs`, `weekly-checkins.database.mjs`, `parent-sunday-checkins.database.mjs`, `guided-routines.database.mjs`, `school-http.integration.mjs`): **47 passed**. Includes parent/athlete access, staff/director distinctions, cross-user denials, original prescriptions/history and reversible routines.
- `node --test link-previews/links.test.cjs`: **9 passed**.
- `node homepage-qa/homepage.test.cjs`: structure, inline JavaScript syntax and integration preservation passed. `git diff --check` passed.

Use `PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js` for disposable database tests; CI installs pinned `@electric-sql/pglite@0.5.13`. Local PGlite reports PostgreSQL 18.6; hosted production reports PostgreSQL 17.6, so this is not a hosted database rehearsal.

**Outstanding limitations:** the local `guided-training.browser.cjs` run could not launch Chromium. The bundled Playwright browser was absent; the installed Chromium executable then exited on `socket() failed: Operation not permitted` before any assertion ran. The new mobile/desktop assertions remain queued for GitHub CI, not locally passed. No hosted authenticated athlete/parent/staff journey or physical-device playback was certified. Seven series remain visually unverified, and the other 76 linked videos were not visually re-audited in this pass. Review the PR's live CI checks separately; this document records local results only.

## Scientific reference points

General principles were checked against NSCA landing progression guidance and ACE standard exercise instruction. All coaching copy is independently written for this library; these sources do not verify Du Airlines video content or specific series order.

- NSCA: https://www.nsca.com/education/videos/plyometric-implementation-setup-and-execution-of-jump-landing-positions-to-decrease-likelihood-of-injuries/
- ACE Bird Dog: https://www.acefitness.org/resources/everyone/exercise-library/14/bird-dog/
- ACE Glute Bridge: https://www.acefitness.org/resources/everyone/exercise-library/49/glute-bridge/
