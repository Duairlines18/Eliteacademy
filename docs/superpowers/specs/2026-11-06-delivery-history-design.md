# Phase 1: durable workout publication and edit history

Approved direction: implement the first priorities from the Principal QA brief on an isolated branch. Production deployment and migrations are outside this branch's execution; no athlete data is used for write tests.

## Goal
Preserve a durable before/after record when an existing week is published or changed and when blocks in a published/previously published week are edited, inserted or removed. Existing publishing permissions, content validation, assignment resolution and Hub presentation remain intact.

## Approach
Database triggers cover existing admin RPCs and direct authorized database changes, instead of recording only browser actions or only one RPC. This is the implementation choice: browser-only logs miss changes requested through ChatGPT; rewriting all publishing endpoints introduces unnecessary behavioural risk. A dedicated append-only `delivery_audit_events` table is admin-readable and inaccessible to ordinary members. Existing `programme_versions` remains unchanged.

Each event records the changed row, operation, transaction, database role, available authenticated user ID, full before/after week content, library definitions needed to interpret demonstrations, and candidate active athlete/cohort assignment context. A service-role change without a verified user context is attributed to the service role, never falsely to Coach Du. Snapshots are database state, not proof that a human opened or completed the workout.

## Boundaries and correctness
- Draft-only edits create no event. Any week with a publication timestamp, including archived/reverted weeks, remains protected.
- Canonical video triggers run before the AFTER audit trigger, so saved after-content is authoritative; reconstruct before-content from OLD without altering saved content.
- Moving a block between weeks records each previously published affected week.
- Failed statements roll back content and history together. No-op updates do not create false changes.
- Historical events carry no cascading foreign key to mutable/deleted programme records. App roles cannot update/delete events or forge them through the snapshot helpers.
- Schema change does not backfill or claim to reconstruct historical delivery. No publication records or old snapshots are rewritten.
- Phase 1 covers week and block mutations. Training-day metadata/deletion, programme metadata, exercise-library-only changes, individual adjustment/assignment transitions and immutable feedback-version binding remain explicit subsequent work. Do not claim complete all-path delivery history until those are covered.

## Verification
Use disposable PGlite PostgreSQL with synthetic fixtures and existing real SQL publishing/update functions. Verify correct-target publication/readback, wrong-target and stale-preview failures, shared edit rejection, rollback, canonical demo fidelity, archive preservation, block move/insert/delete, immutable history, admin versus parent access and unchanged existing suites. Add CI for this database gate. No hosted writes, auth creation, email or access-code use.

Implementation detail: block changes use statement-level transition tables for truthful bulk before/after reconstruction. Assignment context is captured at event time, not a historical assignment transition. See docs/DELIVERY_HISTORY_PHASE_1.md for production gates and precise coverage limits.
