# Delivery history implementation plan

**Goal:** Add and prove durable publication/block-change history in the existing database workflows.
**Architecture:** Add append-only audit records and private snapshot/trigger helpers; preserve RPCs and frontend.
**Tech stack:** PostgreSQL/PLpgSQL, Node 24, pinned PGlite 0.5.13.
**Spec:** docs/superpowers/specs/2026-11-06-delivery-history-design.md

## Constraints
No production writes/deployment, no genuine athlete fixture, no assignment/auth/schema rewrites beyond additive history objects; preserve existing programmes and functions. Scope is week/block mutations, not complete all-path historical reconstruction.

## Review focus
Service-role attribution must remain honest. Parent/athlete must not read other recipients' snapshots. Canonical BEFORE video triggers must run before audit. Shared programmes and cross-week moves must not lose the old snapshot. Audit failure must roll back the mutation.

### Task 1 — Reproduce missing history
- [x] Create `supabase/qa/delivery-history.database.mjs`: load existing synthetic database, audited policies and live-equivalent rollout functions; add synthetic history tables as needed for fixture parity.
- [x] Prove existing publication and block update succeed but create no durable audit record (RED).
- [x] Pin PGlite and generate migration with the installed Supabase CLI after checking command help.

### Task 2 — Implement atomic append-only history
- [x] Create private snapshot and mutation helpers plus admin-only read policies and immutable history table in generated migration.
- [x] Register AFTER triggers for programme_weeks and session_blocks, including old/new-week handling and no-op filtering.
- [x] Test week publish/edit, block edit/insert/delete/move, unpublished drafts, archived history, wrong target, shared edit, stale preview, rollback and forged/modified history denial (GREEN).
- [x] Run full existing Node and PostgreSQL suites; record results.

### Task 3 — Make the check repeatable and reviewable
- [x] Add the isolated database test to delivery CI with pinned dependency; document scope, rollout checks, failure handling and rollback limits.
- [x] Review complete diff; resolve substantive findings with failing tests.
- [x] Push isolated branch and create PR with exact validation and undeployed status. Production migration and authenticated browser proof remain pending.
