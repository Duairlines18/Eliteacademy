# Technique Review — Principal Architecture Gate (2026-10-13)

**Status:** READ-ONLY AUDIT / NOT DEPLOYED. Linked to #25. Production is unchanged.

## Verified source-of-truth
- Production repository `Duairlines18/Eliteacademy` has a ~2.15 MB root `index.html` and a separate `performance/index.html` for Performance Intelligence. Do not confuse the latter with the primary academy hub.
- GitHub connector cannot return the oversized root `index.html` content; its directory and blob metadata are visible, but full role-specific UI mapping is **NOT COMPLETE**. Obtain a reviewable checkout or split the main HTML into reviewable modules before touching it.
- Live Supabase project `hiktwkdfvlujszczthdu` is ACTIVE_HEALTHY (PostgreSQL 17).
- Relevant live entities: `athletes`, `exercises`, `programme_weeks`, `training_days`, `session_blocks`, `staff_cohorts`, `hub_sessions`, `access_codes`.
- 10 private-athlete records and 3 school-athlete records at audit time.
- No technique-video tables or Storage bucket yet.
- Existing deployed functions include `hub-data`, `verify-hub-access`, `private-athlete-hub-data`, `parent-hub-data`, and others. Live function sources have shared modules and must not be overwritten by incomplete repository copies.

## Authentication split — MUST PRESERVE
1. Shared school hub: `verify-hub-access` and `hub-data` run without Supabase JWT verification; `hub-data` receives `x-du-session` and verifies opaque sessions from `hub_sessions`. Session roles: athlete/staff, scoped to cohort.
2. Private athlete and parent: `private-athlete-hub-data` and `parent-hub-data` require Supabase JWT; resolve athlete/parent from verified user.
3. Admin: audit existing admin authorization path before enabling any write endpoint.
4. A direct browser Storage upload relying on a generic `authenticated` policy is unsafe. Implement a dedicated, narrow server-side authorization boundary for each role. Never expose a service-role key.

## Minimal data architecture — proposal, not yet migration
- `technique_filming_profiles`: exercise_id (unique), preferred_view, setup_instruction, visibility_cue. Defaults only; fallback if none.
- `technique_video_requests`: athlete_id, programme_week_id, exercise_id (nullable only for special requests), requested_by role/principal, instruction_override, status.
- `technique_video_submissions`: athlete_id, programme_week_id, request_id (nullable), exercise_id, object_key, upload_state (reserved/uploading/ready/failed), review_state, duration_ms, byte_size, uploader identity, created_at, reviewed_at.
- `technique_video_feedback`: submission_id, reviewer identity, concise correction and optional positive cue, created_at.
- RLS enabled with no broad anonymous/authenticated access; edge functions enforce role and cohort membership on every operation. Use a database-side atomic slot-reservation mechanism for the max-three rule, including concurrent uploads. Use expiry/reconciliation for abandoned reservations.
- Storage bucket `technique-review`: private; 25 MB upload ceiling; signed, short-lived upload/download URLs only after authorization. Validate actual media metadata server-side, not solely browser claims. Duration verification/transcoding feasibility is a blocker until a no-extra-cost design is demonstrated.
- Retention: eight weeks is a **proposal**, not approved automatic deletion. Consent/safeguarding review first.

## UX mapping to complete
- Athlete: attach request/upload status to an existing exercise in the active week, plus compact Technique Review section.
- School coach: one cohort-level entry in existing Coach Training Sheet, select authorized athlete, submit against requested exercise.
- Admin: compact queue and create-request workflow in Control Room.
- Parent: read-only only if explicit verified parent-athlete authorization; do not enable by default.
- No new login or top-level navigation, no edits to workouts/publishing/demonstration videos.

## Capacity / cost assumptions (not plan verification)
40 athletes × 2 clips/week × 8 MB average = 640 MB/week; eight-week retained payload ~5 GB, excluding retries and egress. Supabase billing tier, storage/egress allowances and current consumption **not verified**; no claim of free capacity. Client-side 720p compression is a target, not guaranteed on every device.

## Go / no-go gates
- [x] Project, core schema and session architecture identified.
- [x] Isolated branch exists; no production modifications.
- [ ] Review full root `index.html` and precise render entrypoints.
- [ ] Verify admin role and staff cohort access with live function code.
- [ ] Verify storage/egress plan and actual account limits.
- [ ] Prove server-side duration check within budget, or choose an explicitly documented secure alternative.
- [ ] Review safeguarding/consent/retention for minors.
- [ ] Implement and test feature-flagged backend and frontend.
- [ ] Test iOS/Android, concurrent quota, permissions, rollback, parent view and existing workout flows.

**Deployment prohibition:** Do not create a public bucket, enable feature globally, merge to main, or alter existing authentication while any critical gate remains open.
