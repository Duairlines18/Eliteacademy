# Assignment history and admin execution
Base: PR #81 d9f0cad2b28e02ae1e9f11aa7f635af7e3dcdfbc (stacked branch).
Scope: immutable athlete/cohort/professional assignment and adjustment row transitions, scoped admin history API, read-only admin history panel, clear feedback review labels. No production deployment/writes.
Correction to audit: feedback status `reviewed` is produced automatically by feedbackStatus for review-needed answers. Human completion is reviewed_at. Do not clear the 12 pending review rows or change automatic classifications.
Plan: RED SQL assignment/API tests; additive migration; GREEN existing+new database suites; RED DOM tests for scoped lazy history and feedback labels; implement admin module and integration; full regression, independent review, stacked draft PRs.
Context snapshots supplement exact old/new state and do not certify a recipient viewed the content. Preserve no-op filters, private helpers, RLS, atomic rollback and original programmes.
SQL baseline RED: assignment schema/event tests failed before migration. GREEN: 13 new assignment/API tests; 22 Phase 1 checks; existing 18 PostgreSQL checks with both migrations; 158 existing Node tests.
Admin RED: missing module/history tab and false human attribution cases reproduced. GREEN: 26 admin checks including 10 history/review-label DOM/integration cases.
Decision: clarify feedback labels only. Do not infer completed human review from automatic triage status. Version-linked immutable feedback revisions remain a separate server/client contract.
Independent review and remote CI pending.
Independent review: no Critical findings; three Important viewer gaps and an Important tier-context gap confirmed. All reproduced RED and fixed GREEN: full projected state references/metadata, unassigned-history access with existing editor guards intact, equipment/alternatives, and exact selected tier context.
Ruling: referenced direct and cohort contexts are configuration evidence, not proof of which view was actually opened; viewer labels and report retain this distinction. Cost if mistaken: wrong interpretation of historic delivery, so authenticated delivery/version-binding proof remains a release gate.
Ruling: no automatic feedback data correction; reviewed status is triage and pending items must remain queued. Corrected the original QA brief in place.
Deferred minors: none reported. Hosted privilege parity, visual/mobile/playback and true concurrent-connection behaviour remain unverified, explicitly outside the branch's completed checks.
