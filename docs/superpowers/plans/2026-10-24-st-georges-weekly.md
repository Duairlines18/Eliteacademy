# St George's weekly delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile two coached sessions weekly using one secure register, with clearer school views and a four-week review package.
**Architecture:** Existing hub-data custom code auth scopes a small attendance service and one RLS-protected table; an isolated browser module renders coach/editor and director summary. Existing programme tables preserve drafts/history.
**Tech Stack:** Static JS, Deno TypeScript, Supabase Postgres, Node test runner, Chromium.
**Spec:** docs/superpowers/specs/2026-10-24-st-georges-weekly-design.md

## Global Constraints
- No daily login requirement. Unknown is not absent. Optional home work excluded from attendance denominator.
- Existing eight credentials and athlete identities stay unchanged; server derives staff/cohort/programme.
- No unapproved programme publication; preserve original history and unknown start date.
- Existing homepage, private/parent and inline-video rules remain intact.

## Review Focus
- Cross-school ID injection and director/athlete/shared-code writes must fail before mutation.
- Weekly reconciliation must update existing day records, not duplicate them.
- Failed saves retain unsaved edits and old identity responses never update a new session.
- Historical week editing must not change the active cohort week or display unknown as absent.
- Programme drafts must never leak through the new attendance API.

### Task 1: Protected attendance service
Files: new `_shared/school-attendance.ts`, `supabase/qa/school-attendance.test.mjs`, migration; modify hub-data and repository.
Interfaces: `readSchoolAttendance(args)` and `saveSchoolAttendance(args)` consume standard token/repository/cryptoPort plus `weekNumber` and changed `entries`; return scoped week/roster/entries and writable capability. Repository resolves programme and active cohort roster; batch upsert unique person/day key.
- [ ] Write tests for named-coach writes, read-only director, athlete/shared denial, scope injection, invalid week/date/status, optional day denial, partial updates and historical week reconciliation.
- [ ] Run failing tests, implement minimal service and table/RLS migration, then run full Node suite.
- [ ] Commit backend with migration and rollback guidance.

### Task 2: Weekly editor and school presentation
Files: new `hub-delivery/school-attendance.js` + tests; modify index, coach-command renderer/styles and browser fixture.
Interfaces: module mounts inside identified staff views, uses existing protected hub request, returns editor or director view; stale-response guard uses current session stamp and root connection.
- [ ] Write failing tests for unknown participation, week selection, pending/error saves and consistent roster styling.
- [ ] Implement weekly date/status editor, explicit Save changes, read-only director summary, school schedule labels.
- [ ] Extend fixture/browser tests to reconcile a week and prove director sees same data without mutation controls; run school/routines/homepage regressions.
- [ ] Commit UI changes.

### Task 3: Four-week programme review and release evidence
Files: rollout preparation/rollback SQL, programme review document, QA report.
- [ ] Prepare all four weeks with 2+1 structure, mapped technique menu and pending dosage review; keep unpublished.
- [ ] Verify canonical exercise/video mappings and publish guards; preserve beforeimages before any approved admin operation.
- [ ] Review branch independently, fix material findings, record tests and outstanding coaching approval.
- [ ] Deliver reviewable result; no school distribution or unapproved programme publication.
