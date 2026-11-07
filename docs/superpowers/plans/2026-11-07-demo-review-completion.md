# Demo Review and Delivery Verification Implementation Plan

> Execute inline; review the complete change independently before release claims.

**Goal:** Complete deliberate demo selection after text edits, then verify source, database, browser and available hosted delivery evidence before issuing a before/after report.

**Architecture:** Keep existing static Control Room and Supabase contracts. Add a separate item-demo review module, exact text-bound review metadata inside video_links, and matching existing-trigger validation. No account creation/deletion, workout reassignment or bulk backfill.

**Tech Stack:** Existing JavaScript, DOM, Node tests, disposable PGlite PostgreSQL and existing CI.

## Global constraints
- Preserve all text, doses, assignments, authentication and feedback.
- Multiple demonstrations per instruction row remain possible.
- Explicit reviewed codes never fall back to another movement.
- A real-device or authenticated hosted check is never represented by a synthetic test.

## Review focus
- Same-code dose edits require renewed review rather than silently reusing metadata.
- Row insertion/reordering must invalidate carried positional selection.
- Duplicate names require exact code choice; no first-match inference.
- Nonmovement rows may explicitly need no video.
- Failed or missing backend/readback must not claim successful publication.

## Task 1: Editor
- [x] Write failing pure/DOM tests for changed rows, compound rows, no-demo review, stale confirmations, invalid/inactive codes and immutable inputs.
- [x] Add workout-demo-review.js with mount/getContent lifecycle and pure prepare function; integrate legacy item editor save.
- [x] Run the complete admin regression suite and syntax checks.

## Task 2: Database binding
- [x] Reproduce fresh same-code review currently blocked and stale text marker currently accepted.
- [x] Add exact reviewed_item binding and retain backward-compatible rejection for unbound carried mappings.
- [x] Verify actual editor payload through the staged trigger, protected update readback and rollback.

## Task 3: Delivery evidence
- [ ] Run full source, database and mobile/desktop browser suites.
- [x] Inspect available authenticated sessions and current live library/assignment mappings read-only.
- [x] Attempt actual playback and record environment limits; do not alter genuine accounts to manufacture tests.

## Task 4: Review and release status
- [x] Independent review; reproduce and fix important findings.
- [ ] Save linked PRs, wait for CI and assess deployment prerequisites.
- [ ] Produce before/after summary with separate passed, outstanding and deployment states.

Ruling: user requested all steps without another design handoff; implementation stays within existing Control Room/Supabase structure and the already approved demo-sync work.

Final review: fixed stale untouched binding, compound-row swap marker loss and regenerated no-demo choice, each RED→GREEN. Local source suites: admin65/site184; durable PostgreSQL22; publish integration18.
Ruling: unavailable credentials and real-iPhone/media playback remain unpassed gates, rather than modifying real accounts or certifying synthetic sessions as hosted proof.
