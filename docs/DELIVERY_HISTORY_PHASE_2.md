# Assignment history and admin History tab — staged only

Depends on Phase 1 (PR #81). Apply the second additive migration only after the first. No migration or admin change has been deployed to production.

## Database behaviour

The append-only event table now also retains projected athlete and cohort assignment/access state, individual exercise substitutions/coach notes, and athlete/cohort overrides. Exact OLD/NEW state is retained, including pending/unassigned identities and deleted override records. Unrelated login activity and unchanged delivery fields do not create noise. Referenced programme content/library is saved as context, with exact configured cohort tier selection; it is not proof of the athlete's rendered/viewed version. Existing authentication, publication functions and original feedback are unchanged.

`admin_delivery_history` is an invoker-security RPC with explicit admin verification plus the existing table RLS. It scopes results to one exact athlete/cohort, uses stable sequence pagination, and omits private snapshots from list responses. Full details require an event-ID request within the same subject scope. Counts/history are not fabricated for pre-installation activity. The shared programme events use historical candidate assignment context, not a statement that every candidate received or opened that week.

Exact individual state is historical; related roster and referenced base-week context are observed at the time the database trigger executes. Bulk updates are multiple row transitions, not one global membership-before snapshot. This phase does not promise globally serial history across concurrent transactions.

## Admin companion

The companion branch in Duairlines18/Du-Airlines-Hub- adds a read-only History tab to athlete and cohort programme workspaces. Lists load only when requested. Before/after details load only when expanded. Late responses after profile changes are ignored. Missing backend installation has a distinct not-enabled state; failed reads preserve existing data and provide retry. There are no restore/delete/publish actions in the History viewer.

The viewer displays stored programme content and retained demonstration links, never runs saved HTML, and allows only HTTPS YouTube demonstration links. It does not certify what the footage depicts or mobile playback. Private/service database operations are not labelled as a verified human action.

## Audit correction: feedback semantics

Earlier audit language incorrectly treated `status='reviewed'` with no timestamp as a review-state defect. `feedbackStatus` actually assigns that status automatically for responses that need coaching attention. Human completion is `reviewed_at`. Twelve such submissions must stay in the queue. The companion UI clarifies this as “Needs review”, and “Reviewed” only after the timestamp exists. Adjustment flags remain visible after review. No feedback row is cleared, migrated or marked reviewed by this work.

Feedback programme/version binding is still a separate priority. The current feedback service can replace an existing context row; immutable feedback revisions and identification of the exact displayed workout version require their own server/client contract. Submission-time state must not be mislabeled as the athlete's viewed version.

## Validation and rollout

Disposable PostgreSQL tests cover assignment/access/week changes, swaps, school membership context, override lifecycle, unassigned users, scoped admin-only reads, lazy summaries/details, pagination and rollback. Existing PostgreSQL publishing/readback tests run with both migrations enabled. Existing Phase 1 and platform suites remain required. Admin tests use a DOM engine and synthetic RPC responses; these are not production sign-ins or visual/mobile browser verification.

Before rollout: test hosted staging privilege parity, concurrent writes/load, true parent/private/school sign-ins, and admin-to-recipient delivery. Install both database migrations before enabling the History UI. The UI safely reports missing history support if released earlier by mistake. Retain audit evidence when rolling back: remove new assignment/override triggers and the read RPC only under a reviewed change; do not drop the event table or undo source athlete/programme data.

Still outstanding: training-day/week deletions/cascades, programme/day metadata and library-only changes, professional-member history, feedback revision/version binding, restore/reuse UI, authenticated production QA and actual video review.
