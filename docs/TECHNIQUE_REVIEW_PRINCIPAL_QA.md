# Principal engineering QA — Technique Review (2026-10-13)

## Decision: NO-GO for production deployment

Verified against the actual 2.15 MB root `index.html` blob and live Supabase schema. This is not a completed pilot.

### Critical blockers
1. **No real screen mount.** The current root app has `renderStaffDashboard()`, `renderAthleteDashboard()`, and an async `render()` router. Existing adapters under `performance/` are not imported by the root app. They must be mounted after the appropriate render, with lifecycle cleanup and role-specific state.
2. **School cohort records.** All three current school athletes have NULL `cohort_id`. School coach upload must deny them until the correct school/cohort assignments are made by an authorized administrator. Do not infer membership.
3. **Week IDs.** The UI programme uses `p.week` (week number), but the upload API expects the UUID `programme_weeks.id`. Resolve this from an authorized server query, not from a guessed client value.
4. **Exercise IDs.** The hub's `EXERCISES` library mixes `id`, `code`, and derived strings. Only UUIDs in the existing `exercises` table may be sent to the video API.
5. **Media validation.** Current MP4/QuickTime ISO BMFF parser is conservative but has not been tested against real iPhone/Android recordings, edit lists, or HEVC. Container duration alone is not sufficient for all recordings. No video can be marked ready before trusted media validation passes.
6. **Upload token lifecycle.** Supabase signed upload URLs can remain usable beyond the app's 30-minute reservation; storage object policies and cleanup must be verified. Upload size, MIME and duration need independent server checks.
7. **Consent and safeguarding.** Youth video consent, coach/parent authorization, deletion and retention policy are unresolved. No automatic eight-week deletion has been enabled.
8. **Admin access.** The Control Room component currently relies on an admin JWT/profile and has not been wired to the actual admin route. Test authorization with real admin accounts.
9. **No executed integration tests.** Staged Deno media tests have not been run; no mobile upload QA, RLS penetration tests, race tests, or rollback rehearsal.

### Changes committed in this branch
- Additive RLS-enabled schema, atomic quota reservation, and private bucket migration.
- Private athlete and school-code staff upload API sources.
- Admin review queue API source and three role-specific UI components.
- Integration bridge; **not imported or mounted in the root app**.

### Required release sequence
1. Correct UUID mapping and real role-screen mounting on the feature branch.
2. Set up disposable staging Supabase project and apply migration there.
3. Verify consent, media parser, storage policies, cleanup and abuse limits.
4. Run Deno tests, browser QA, mobile uploads, and cross-role security tests.
5. Pilot with Charles after written approval; school pilot only after cohort records are assigned.
6. Merge and deploy only after all gates pass. Keep feature disabled until then.

Production has not been modified by this feature branch.
