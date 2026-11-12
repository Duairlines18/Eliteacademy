# Mandatory Check-ins Implementation Plan

> **For agentic workers:** Execute inline using superpowers:executing-plans. Coach Du requested AI responsibilities, not independently running agents.

**Goal:** Enforce reliable start/end check-ins before eligible training access.

**Architecture:** Extend existing authenticated parent/private handlers with a shared gate. Store answers in existing feedback with additive requirement and safety-hold tables; privileged atomic RPCs validate ownership and assignment. Keep enforcement disabled until approved release.

**Tech Stack:** Static HTML/JavaScript, Supabase Edge TypeScript, PostgreSQL, Node test, Playwright, disposable PGlite.

**Spec:** docs/superpowers/specs/2026-11-12-mandatory-checkins-design.md and Coach Du's final specification in the task.

## Global Constraints
- No production migration, merge or deployment without separate approval.
- Preserve all coaching content, auth/onboarding, history, branding and existing school/professional flows.
- No retroactive historical check-ins; November 13 end-only, November 16 twice weekly.
- Unknown is distinct from healthy/completed; all safety concerns persist until explicit coach review/release.

## Review Focus
- Simultaneous tabs/retries: one requirement and feedback row, no lost amendment.
- Assignment change with an overdue report: original requirement remains actionable.
- Missing/stale dates and regional midnight: stable enrollment and due dates, no historical backlog.
- Failed foreground revalidation: no stale dashboard/training access.
- Parent uncertainty and a cleared concern: no invented answer or automatic safety release.

### Task 1: Validation and atomic persistence
Files: new `_shared/weekly-checkins.ts`, `supabase/migrations/*mandatory_weekly_checkins.sql`, `supabase/qa/weekly-checkins.test.mjs`, `supabase/qa/weekly-checkins.database.mjs`.
Interfaces: `normalizeCheckin(kind,input,audience)`, `checkinSafety(payload)`, privileged state/save/issue/release RPCs; repository wraps RPC results.
- [ ] Write validation and database tests; run and observe missing-feature failures.
- [ ] Implement exact options, conditional validation, rollout/assignment requirements, atomic idempotent saves, immutable revisions, holds and admin audit/release.
- [ ] Run Node and disposable database tests; confirm ownership/RLS, amendment conflicts, duplicates, transition and rollout behavior.

### Task 2: Authorized delivery gate and coach review endpoint
Files: `_shared/checkin-service.ts`, repository, parent/private handlers, workout-completions, new `weekly-checkin-admin` Edge endpoint and tests.
Interfaces: `checkin-state`, `save-checkin`, `open-end-checkin`, `report-checkin-issue`; gate response `{code:'CHECKIN_REQUIRED'|'SAFETY_REVIEW_REQUIRED',checkins}` contains no workout data.
- [ ] Write handler tests for private/parent bootstrap/history/programme bypass, unauthenticated calls and support exceptions; run red.
- [ ] Implement authenticated gate, safe support paths, admin-only listing and separate hold release.
- [ ] Run handler and existing account/feedback regressions.

### Task 3: Entry UI and cache boundaries
Files: new `hub-delivery/weekly-checkins.js`, `index.html`, new admin review HTML/JS, browser QA.
Interfaces: shared check-in renderer/controller using authenticated Edge requests; route to entry form before any protected Hub render.
- [ ] Write mobile/desktop browser scenarios for both roles, conditionals, retry, amendment, unknown, direct route, foreground/date boundary and failed status fetch; observe red.
- [ ] Implement accessible selectable forms, conditional fields, support paths, safe drafts, server-confirmed transition and coach review screen.
- [ ] Verify mobile layout and both roles with synthetic accounts through real handlers/RPC fixtures.

### Task 4: Release verification
Files: CI workflow and release report/runbook with activation and rollback instructions.
- [ ] Run full existing Node/database/browser regressions and new flow tests, inspect output.
- [ ] Review whole branch for authorization, concurrency, safety, data integrity and scope.
- [ ] Commit/push feature branch and prepare reviewable PR if available; do not merge/deploy.
- [ ] Report exact results, blockers, activation sequence and rollback.
