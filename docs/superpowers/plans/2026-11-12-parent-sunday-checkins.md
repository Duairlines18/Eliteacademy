# Parent Sunday Check-ins Implementation Plan

> Execute inline; Coach Du requested AI responsibilities rather than independently running agents.

**Goal:** Parents complete one calendar-week report each Sunday, carried forward to their next login. Private athletes retain the existing start/end assignment schedule.

**Architecture:** Extend the existing requirements ledger with a parent calendar flag and separate uniqueness for each Sunday period. Keep immutable revisions, identity checks, receipts and safety holds. Parent dates use the existing server timezone; no browser clock or external scheduler.

**Spec:** Coach Du's November 12 instruction: parents Sunday only, including their next Sunday/Monday/start-of-week login. Keep the approved black theme and shortened end report.

## Constraints
- No separate parent start form or early parent end opening.
- First parent Sunday is November 15; no historical backfill before enrollment.
- Previously generated pending reports persist across logins and assignment changes.
- One report per Sunday even when an assignment stays unchanged or changes within the same reporting period.
- Existing records, programmes, authentication and school/professional delivery remain intact.
- The report's calendar dates are authoritative; its programme reference snapshots the assignment available at enrollment, without inventing a historical assignment.

## Review focus
Sunday midnight and Monday carry-over; repeated requests; unchanged assignment across Sundays; assignment change before a pending report; old cached clients attempting early opening.

## Tasks
- [ ] Add real database tests for Friday/Saturday, Sunday, Monday, repeated Sundays, assignment changes, unknown/partial answers and timezone boundaries; observe failures.
- [ ] Add migration with parent calendar uniqueness and updated state/open RPCs. Parent UI and coach review use the Sunday reporting period instead of implying an unverified historical programme week.
- [ ] Run database, UI, authorization and full regressions; inspect source diff.
- [ ] Publish the approved branch, wait for CI, deploy compatible backend/migration before static release, then verify production and record rollback.
