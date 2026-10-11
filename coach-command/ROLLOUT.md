# Coach Command v1 — feature-branch rollout

## Scope
Read-only coach interface, designed for a controlled 6–10-athlete cohort. One team overview and one workout view; athlete detail is only available when the roster comes from a separately authorized cohort-scoped backend response. Day 1 and Day 2 are athletics, Day 3 is optional. Monday–Friday is the planning week, not fixed day assignments.

## Files
- `coach-command/coach-command.js`: standalone, dependency-free UI module. Exposes `window.DuCoachCommand.mount(host, staffBootstrap, options)`.

## Integration contract
1. Keep the **existing** staff code verification and `hub-data` bootstrap flow. Never send an access code or service-role key to this component.
2. Pass the already verified `hub-data` response with `role === 'staff'`, `cohort`, `programme.sessions`, and `exercises`.
3. Mount inside the authenticated staff screen only. Example:
   `window.DuCoachCommand.mount(document.getElementById('coach-root'), verifiedStaffBootstrap)`
4. The existing `hub-data` response does not include an athlete roster. Until a new protected roster endpoint validates `x-du-session` and scopes its query to the session's `cohort_id`, the UI deliberately shows **no athlete names or active counts**. Do not use browser-side Supabase `athletes` queries or a manually assembled roster. Once authorized, pass `{rosterVerified:true,roster:athletes}`; every athlete must have the same `cohort_id`.
5. Exercise videos are embedded only for supported HTTPS YouTube links. Missing videos show no button.
6. Do not use this UI as a workout publishing endpoint. Publishing remains in Admin Room.

## Release gates
- Verify actual `shapeBootstrap` field names and exercise fields, particularly `prescriptions`, `sectionTitle`, `exerciseCode`, `video_url`, `coaching_cues`.
- Check that staff access code validation, session expiry, and suspension continue to work.
- Verify 3-day and preparing-week states, no cross-cohort data, 320px phone, laptop, copy, print, and YouTube video.
- Inspect current 2.1 MB Hub `index.html` and identify the exact staff rendering hook before replacing anything. GitHub connector currently cannot return that oversized file; do not blindly patch it.
- Add a protected staff roster endpoint with existing session validation before enabling athlete snapshots or counts.
- Run authenticated end-to-end tests on a QA cohort before production merge.

## Rollback
Remove the module integration from the staff view or revert the feature branch merge. This commit does not modify production files or Supabase tables.

## Known limitations
This is a reusable UI module **not yet wired into the production Hub**. The existing staff bootstrap is cohort-scoped, but does not return authorized athlete identities. No attendance, feedback, or analytics are added. The UI renders the first three published sessions as Day 1–3, so actual school session order must be verified during integration.
