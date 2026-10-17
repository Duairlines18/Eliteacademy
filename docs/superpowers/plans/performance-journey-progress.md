# SDD ledger — plan: docs/superpowers/plans/2026-10-17-performance-journey.md

Approved design and instruction to implement are in the conversation. Execution remains in this session on an isolated new clone/feature branch.
Pre-flight: source JSON from Task 2 is consumed by Task 1 buildJourney and Task 3 UI; authorization occurs before any source/snapshot read.
Ruling: import reviewed CRM direction with provenance; do not expose or automatically transform private CRM notes — no deployed Airtable runtime credential is established. Cost: subsequent CRM context changes need explicit synchronization until a credential-backed connector is configured.

Task 1: complete — deterministic summary and scoped authorization tests RED→GREEN.
Task 2: complete — deployed source/snapshot endpoint, daily due-check and initial snapshots; verified RLS/grants and rolled-back assignment-cycle/idempotence/14-day tests.
Task 3: complete — shared component mounted in athlete, parent and school/club routes; 36 Node checks and 135 browser assertions pass; live shared-role reads 200 and cross-athlete requests 403.
Final review: independent fresh-context reviewer. Fixed current-phase classification and snapshot assignment-version isolation using regression tests RED→GREEN. Parent picker and roster-feedback wording findings were regraded as Important for correct child identity and evidence interpretation, and fixed in the same pass.
Historical source qualification: verified, previously published archived weeks before the current week are metadata-only journey history. Future/unpublished/unverified content is never included; current-week training access is unchanged.
Deferred minors: none.
