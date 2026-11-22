# Feedback revision retention — branch only

Preserves complete feedback row before/after images on INSERT, UPDATE and DELETE. Existing replacement, triage, submission acknowledgement, review and reply behaviours are unchanged. No historical revision is invented or backfilled. Future schema columns are retained by the row snapshot.

The append-only table is admin-readable under RLS, and service-role-readable for protected backend use. No app role can forge, modify, delete or truncate revisions; source removal cannot cascade-delete them. Private security-definer capture helpers use an empty search path and cannot be called directly by app roles. Capture and source changes share a transaction: failed writes/rollback must not leave an unrecorded successful change.

Original payload submission IDs are retained, but existing submission-ID lookup is unchanged. Historical-ID-aware idempotency and delayed retry protection remain separate work; retention alone does not prevent an old retry from re-entering the existing replacement path. No current feedback rows are cleared, reclassified or marked reviewed.

This does not identify which workout version a person actually viewed. Programme/week/version binding, historical feedback UI, author attribution through service operations, concurrency/load and authenticated browser/staging proof remain outstanding. Revisions can contain private coaching/health answers; keep them admin-only and exclude their contents from public logs/artifacts.

Tests use disposable synthetic PostgreSQL, never real athlete writes. CI runs retention alongside prior history gates. Production installation remains pending staging/privilege verification. Rollback can disable only feedback_revision_capture under a reviewed change; retain the evidence table. Disabling capture creates a history gap, not a reason to overwrite old answers.
