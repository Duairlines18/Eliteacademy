# Delivery history — Phase 1 (branch only)

## What this adds

An additive migration records programme-week publication/state changes and changes to blocks belonging to a published or previously published week. It does not replace the existing publishing RPCs or their authorization/validation. No frontend, exercise prescription, assignment or existing history record is rewritten.

`delivery_audit_events` stores immutable, versioned before/after database snapshots. The snapshot includes the week, days/blocks, exercise-library definitions, and candidate athlete/cohort assignment context. Database triggers cover both the Control Room and other authorized SQL/RPC writers. Block transition tables reconstruct the entire changed statement, avoiding mixed old/new bulk snapshots. A history insert failure aborts the workout change in the same transaction.

This is database-state evidence, not a delivery or viewing receipt from the athlete. Assignment context is captured when the content/week operation runs. For example, the existing publishing RPC advances an athlete before publishing its week: the before-content image contains the then-current assignment context, not the athlete's previous current week. Assignment transition auditing is subsequent work.

## Authorization and attribution

- Authenticated admin reads use the existing `admin_profiles` identity check.
- Ordinary member reads are filtered by RLS. No app role can insert, edit, delete or truncate audit records directly.
- Private helpers are inaccessible to app roles. Security-definer functions have an empty search path and fully qualified persistent objects.
- Service-role changes without an authenticated subject are recorded with a null human actor and the service role. This must not be displayed as “Coach Du personally published.” Verified human attribution through server-side publishing can be added later.
- Source rows are not foreign-key parents of history: removing a mutable source row cannot cascade-delete recorded events. A database owner can still deliberately change schema/disable triggers; this is app-level immutability, not tamper-proof external storage.

## Coverage and limits

Covered: week INSERT with publication timestamp; changed week UPDATE after publication; archived/unpublished previously recorded weeks; block INSERT/UPDATE/DELETE including bulk changes and movement between weeks; canonical generated links after existing BEFORE triggers; transaction failure/rollback; admin versus parent permissions.

Not yet covered: week deletion or training-day deletion/cascades, training-day/programme metadata-only changes, exercise-library-only updates, individual overrides/adjustments, membership/assignment changes, version-linked feedback, authenticated production/browser publishing, recipient viewing acknowledgements and restore UI. Do not market this first slice as complete programme versioning.

Snapshots carry the exercise library to interpret legacy names and recorded video mappings; only internal exercise admin notes are excluded. These are private admin records. Long-term storage cost and snapshot deduplication need measurement before high-volume rollout.

Tests run inside disposable PostgreSQL (PGlite 0.5.13). This proves SQL, trigger and RLS behaviour for those cases, but does not replace true multi-connection concurrency/load testing on isolated PostgreSQL. Event sequence IDs are allocation order, not a guaranteed global commit order. Overlapping writes must not be reconstructed as one serial history from sequence IDs alone.

## Repeatable validation

Install outside the repository:

```sh
npm install --prefix /tmp/du-delivery-qa --no-save @electric-sql/pglite@0.5.13
PGLITE_MODULE=/tmp/du-delivery-qa/node_modules/@electric-sql/pglite/dist/index.js node --test supabase/qa/delivery-history.database.mjs
PGLITE_MODULE=/tmp/du-delivery-qa/node_modules/@electric-sql/pglite/dist/index.js HUB_QA_AUDIT_HISTORY=1 node supabase/qa/database.integration.mjs
```

The new CI job runs both. The existing full delivery suite still runs separately.

## Rollout gate — not executed

1. Review the migration and capture the current live source definitions/privileges. Confirm the private schema/table names are unused and existing canonical triggers are active. Confirm an existing authenticated admin can read `admin_profiles` while members cannot self-elevate.
2. Apply to an isolated staging copy and replay representative parent/private/school publication/edit requests. Verify candidate assignment context against actual role-specific assignment resolution; it is not an affected-recipient count.
3. Test two concurrent connections, rollback and expected-content conflicts. Measure latency and storage with representative full weeks.
4. Review the remaining coverage limits before enabling in production. Migration installation takes table/trigger locks; schedule the eventual application and monitor errors.
5. After a separately authorized production migration, perform QA-only authenticated admin publish/readback and recipient-view checks. Existing QA profiles sharing real programmes are unsafe fixtures.

There is no production backfill. Old histories cannot be invented from present mutable content.

## Rollback if a staged migration causes errors

Disable/drop only the new `delivery_audit_week`, `delivery_audit_block_insert`, `delivery_audit_block_update`, and `delivery_audit_block_delete` triggers under a reviewed change. Existing publish/update functions were not replaced. Retain the audit table and private helpers so evidence is not discarded. Do not drop old snapshots, restore entire programmes or bypass validation as a rollback. Disabling capture stops future audit coverage; record the gap and investigate before re-enabling.

## Next priorities

1. Cover the remaining metadata, assignment/adjustment and library mutation paths; make exact publication/version history readable in the Control Room.
2. Bind new feedback to the delivered programme/week/version and fix the reviewed-status/timestamp inconsistency without rewriting original answers.
3. Prove authenticated registration, returning sessions and full admin-to-recipient browser delivery; review actual demo footage.
