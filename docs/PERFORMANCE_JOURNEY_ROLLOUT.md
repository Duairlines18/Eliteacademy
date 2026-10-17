# Performance Journey rollout

## Behaviour

- My Journey / Group Journey is available in the existing Hub navigation and below the training-day picker (or coach dashboard).
- Current source refreshes on opening the page. Saved updates are created initially, on assignment changes, and after 14 elapsed days. A daily 06:15 UTC cron checks due subjects; reads also catch up a due snapshot.
- Parent access follows the parent's existing cohort assignment; athlete access follows its existing direct assignment. Both resolve a durable athlete ID, never a name.
- Shared cohort athlete codes expose only the group programme story. Staff can select active roster athletes in the same cohort. No school/club athlete records are invented when a roster is empty.
- Historical published/verified archived weeks are included as planned history. Drafts, unverified weeks, unpublished current weeks and future weeks are excluded. Missing initial weeks are not fabricated.
- Existing prescriptions, login flows and video-upload flows are untouched.

## Data and permissions

The independent `performance-journey` Edge Function validates JWTs with `auth.getUser`, or validates the existing hashed cohort session plus active access code. It is deployed with gateway JWT verification disabled because it supports both mechanisms; every data read requires one of these validated contexts.

`performance_journey_context` and `performance_journey_snapshots` have RLS enabled with no client grants/policies. The security advisor's informational no-policy finding is intentional: only the service role can read them. New public source/refresh functions also revoke execution from PUBLIC, anon and authenticated.

The unexposed `journey_private` schema contains an assignment version ledger. Its internal trigger increments on assignment/cohort/tier changes, including A → B → A. The trigger function is SECURITY DEFINER solely to update this inaccessible internal ledger, has a fixed search path, no public execution grants, and returns no data. This prevents prior-assignment snapshots from being offered by the API.

## CRM continuity

Reviewed audience-safe direction was imported from Athlete Programme Control for six active athletes using Supabase Athlete IDs and CRM record provenance. This is an import, not a continuous Airtable integration. Supabase-driven journey and snapshot updates are automatic. Subsequent CRM edits require an explicit synchronization; no runtime Airtable credential was available or assumed. Unreviewed Continuity Notes, health notes and internal sales notes never enter the portal. Next-step copy expires when the assigned week or programme no longer matches its review.

To refresh context, read the athlete's current Supabase assignment, reconcile the CRM row by `Supabase Athlete ID`, then upsert only `next_title`, `next_focus`, `purpose`, `programme_id`, `reviewed_week`, `crm_record_id`, `synced_at` into `performance_journey_context`. Do not copy raw notes.

## Validation

- 36 Node unit/integration/existing regression checks passed.
- 135 browser assertions passed across private athlete, parent, shared school athlete and staff at 320, 390 and 1280px, plus every supplied active private source.
- Browser checks covered runtime errors, illustration/history rendering, contrast >=4.5:1, card overflow, roster/parent view behaviour and preserved training navigation. Role/API responses were fixtures with sanitized current database sources; these are not live account login tests.
- Live endpoint tests using temporary existing-code-scoped QA sessions returned 200 for school athlete and staff group reads, and 403 for cross-athlete access. Temporary sessions were removed. Missing authentication returned 401.
- Database tests inside a rolled-back transaction verified assignment A → B → A gets a new version, repeated due checks do not duplicate snapshots, and a snapshot older than 14 days produces one new update.
- Direct anon/authenticated table grants were verified absent. Existing security advisor warnings were outside this change.
- Independent review identified current-phase classification and assignment-history isolation defects; regression tests were added and both were fixed before frontend publication. Same-name parent selection and feedback-coverage wording were also corrected.

## Rollback

Remove the new stylesheet, navigation item, journey route and mount block from `index.html`, or revert this feature's frontend commit. Existing workout/video flows are independent. Stop future saved updates with `select cron.unschedule('du-performance-journey-due-check');`. Retain the additive tables to preserve records unless an explicit deletion is requested. The Edge Function can remain inaccessible from the UI while existing access checks continue to protect it.
