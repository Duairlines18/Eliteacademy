# Guided training release — issues #96 and #97

Status: implementation candidate; production deployment blocked. No production data, assignments, history, authentication or schema changed in this work.

## Changes

- Private athletes can use the existing guided renderer with their assigned sessions, instructions, cues, rest, navigation and completion storage.
- Explicit same-week Mobility and Warm-Up references enable separate routines and a return to the originating workout. Original exercise completion keys remain unchanged.
- A rollback-by-default data preparation script targets only the isolated Andria and parent-demo Week 9 programmes, guards content/library drift and duplicate pogo loading, captures snapshots and checks history preservation. Main prescriptions are unchanged. No new routine is assigned to Anotidaishe.
- Single-set between-set rest is hidden; prescribed recovery before another movement remains visible.
- The delivery helper URL is versioned with the matching frontend revision to prevent stale cached helpers.
- The homepage preservation check recognizes only the scoped guided renderer/navigation changes; public forms and unrelated routes remain checked against the immutable baseline.

## Fresh verification

- 191 application/authorization/delivery regression tests passed.
- 85 Control Room tests passed, without Control Room source changes.
- 7 disposable PostgreSQL preparation, drift, rollback and snapshot-restore tests passed. This does not prove private production backup recovery.
- 28 additional SQL integration/feedback-retention tests passed, including cross-user denial and transactional rollback.
- Parent setup database checks passed (draft/final persistence, assignment/access preservation, idempotency and service-only RPC).
- 1 synthetic school HTTP integration test passed.
- 9 share-link tests and 14 story tests passed.
- Homepage structure, inline syntax and integration preservation passed after fixing its scoped normalization.
- Whitespace check passed with the repository's CRLF line endings recognized.
- Browser fixture test added for parent, parent demo, private athlete and private demo at 390/1440 pixels. Local Playwright execution cannot find its Chromium headless-shell executable. Installing Chromium returned an invalid/truncated ZIP; the installed system Chromium also aborts with `process_singleton_posix.cc:297 socket() failed: Operation not permitted`. No local browser PASS is claimed.

The full local browser sweep produced no passes. Homepage, routines, guided, plain-language and parent setup checks failed at the missing Chromium executable. Dashboard refresh, private onboarding and school identity reached the 20-second process deadline. Coach parity encountered the shared fixture port in use during the sweep. Four optional snapshot-driven suites require private fixture environment variables (`AIR_ZIM_QA_BUNDLES`, `VIDEO_QA_BOOTSTRAP`, `HUB_QA_FIXTURES`, `JOURNEY_QA_SOURCES`) and could not start. These are unresolved checks, not application assertion passes. CI runs the mandatory browser suites sequentially on an installed browser.

## Production read-only evidence

All four target profiles are active. Andria and parent demo each have a verified published Week 9 with three training days; content hashes match and programme/week IDs are independent. Anotidaishe and private demo each have a verified published Week 2 with seven days; content hashes match and programme/week IDs are independent. All 27 distinct coded exercises across both target weeks and the proposed routines resolve to exactly one active library entry, with matching stored Shorts URL/video ID. Instruction-only rows intentionally have no exercise code. This proves references, not footage accuracy or playback.

The available production browser displays the Hub access selector, without an authenticated account. Authenticated role isolation, real video movement review, iPhone playback and persistence after real logout/login are not verified. Fresh hosted WU01 playback observation remained at `currentTime: 0`, `readyState: 0` before and after player interaction. Movement footage could not be reviewed. This browser is desktop Chromium; no real iPhone is connected.

## Release gates still required

1. Required CI including all mobile/desktop browser checks must pass on the final commit.
2. Hosted demo sign-ins must prove routing, cross-user read/write denial, reload/logout/login persistence and feedback save/readback, without writing genuine athlete history.
3. Visually verify decoded movement footage for every target exercise, including actual iPhone playback.
4. Capture private current backend/data backup, prove recovery and compare deployed function bundle dependencies/configuration before applying the additive hub-core change. Preserve JWT/auth configuration.
5. Execute the data preparation against an appropriate disposable copy, then approve its inspected result for production under the existing authorization only when all gates pass. The script remains ROLLBACK by default.
6. Deploy compatible backend metadata before the frontend, verify live outcomes and record deployment IDs.

## Rollback

Revert the frontend release commit to restore current production behavior. For a subsequent authorized routine-data release, restore the original session block contents from that release's programme_versions snapshots and remove only the newly created routine rows after preserving any subsequent progress. Do not touch original day/block IDs or existing completion/feedback rows. The additive backend metadata is safe for older clients; retain the captured exact live function bundle for rollback. No production rollback is necessary for this candidate because nothing has been deployed.

## Scope and review evidence

Read-only recheck confirmed Andria Week 9 and parent demo content hash `0b65a8ddd00f340f8f9dbbdbbb09d5d5`; Anotidaishe Week 2 and private demo hash `ba1799487e910e6771b4324ce5ac35c4`. Both genuine published weeks and matching independent demos remain unchanged. The proposed routine script is unapplied.

Andria's Step-Up remains first in Monday's single-leg strength session (`2 × 8/leg`, 3-second lowering). Her Friday Snap Down remains in Landing Control (`2 × 4`, 75–90 seconds between jumping sets). The superseded generic warm-up is retained in storage and hidden only when both same-week replacement routines resolve. It does not append its extra Snap Down to the new warm-up. The disposable database now explicitly rejects a programme that already contains main-workout PLY03, preventing duplicated pogo volume.

Anotidaishe receives the same guided controls over his existing core sessions only. His original restrictions, conditional instructions, rest, Saturday repeat instruction and Sunday review instruction remain unchanged. No volleyball, standing or full Air Zim routine is added to his programme.

All authentication, completion transport, RLS and original programme/assignment writes are outside the diff. Local completion-key and response-shaping tests pass; hosted completion persistence and role isolation require an authenticated demo session. Production data, function deployments and frontend release are untouched.

**Decision: NO-GO.** Keep this candidate as a draft until the hosted, browser/device, private-backup and backend-parity gates above pass. Do not request final merge/deployment approval yet.
