# Parent Setup release — implementation and rollout

Status: implemented on feature/parent-onboarding-compact in both repositories. Not merged or deployed. Email explicitly excluded by Coach Du; no provider configuration, notification table or email credentials added.

## Behaviour

Registration remains unchanged. Parents see exactly five questions. Priorities are limited to two; bodyweight-only excludes other equipment; reported pain requires details. Setup saves against the authenticated parent-linked athlete. Drafts are restored from Supabase and do not mark completion. Completion is confirmed from the database response before showing success. Active parents proceed through the existing authorized Hub; paused parents stay paused. Returning completed parents skip setup.

The database routine merges approved answer JSON, preserving previous medical/context data and identity/assignment/access fields. Completed setup is immutable through this endpoint: late drafts/repeated completions return the completed record. The partial unique parent link index prevents concurrent duplicate profiles; repository creation handles a conflict by rereading the existing link. New answer keys: formVersion=2, developmentPriorities, hubFrequency, trainingLocations, equipment, safetyStatus, safetyDetails (only supplied when reporting a concern). Existing fields remain readable. No existing records need backfilling.

The Control Room's existing athlete modal shows escaped read-only setup answers and parent details. Direct programme assignments now satisfy athlete activation/resume requirements. Professional cohort rules are unchanged.

There is no verified agreed Hub-frequency field in the audited assignment schema. Saved draft frequency preloads; new parents choose their agreed frequency. We do not infer it from session counts or hardcode Felipe's daughter. Her agreed selection is 1 day.

## Files

Website: index.html; parent-setup/setup.js and setup.css; supabase/functions/_shared/parent-core.ts, parent-handler.ts, parent-service.ts, supabase-repository.ts; supabase/migrations/20261029150702_parent_athlete_setup.sql; supabase/qa/parent-onboarding.test.mjs, parent-setup.database.cjs; parent-qa/parent-setup.browser.cjs; homepage-qa/homepage.test.cjs; .github/workflows/parent-session-qa.yml; implementation plan and this release note.

Control Room: index.html; qa/parent-setup.test.cjs; .github/workflows/protected-publishing-regression.yml.

## Verification

- Full website source/browser suite: 157 tests passed, zero failed.
- Control Room suite: 16 tests passed, zero failed.
- Existing routines browser regression: 78 checks passed across parent/private/school athlete/staff/professional at mobile and desktop widths.
- New setup browser: desktop Chromium 1440px and mobile Chromium 390px passed; five questions, draft prefill/save, priority/equipment rules, safe payload, failed-save recovery and pending success.
- Embedded PostgreSQL/PGlite migration test passed: real draft/final persistence, old medical/name/access/assignment preservation, repeated completion, late draft, unique parent link, denied anon/authenticated RPC execution and unknown-parent rejection.
- Existing account delivery/ownership/security suites passed, including direct assignment and unauthenticated denial.
- Independent review found no critical or important issues. It noted that assignedHubFrequency has no current backend source; this is intentionally unused until an explicitly verified agreement field exists.
- Local WebKit could not start because native libraries are absent; dependency installation was blocked by the host's process restrictions. The parent QA workflow installs Chromium/WebKit dependencies and runs the same setup test with RUN_WEBKIT=1. Actual iPhone Safari remains a separate physical-device check.
- No production onboarding record was written, no real parent account changed, and no notification sent. Local PostgreSQL persistence evidence is not production evidence.

Commands: node --test supabase/qa/parent-onboarding.test.mjs supabase/qa/account-delivery.test.mjs supabase/qa/access-security.test.mjs; node parent-qa/parent-session.test.cjs; node --test qa/*.test.cjs (Control Room). Browser/database tests require playwright@1.56.1 and @electric-sql/pglite@0.5.13 via NODE_PATH. CI uses temporary QA dependencies; production has no new npm dependency.

## Production rollout — explicit approval still required

1. Recheck main heads and CI, confirm no new duplicate parent links and retain the currently deployed parent-hub-data bundle privately.
2. Apply only the named migration. It adds one partial unique index and one SECURITY INVOKER routine, callable only by service_role. No table/column, Auth setting or RLS policy changes.
3. Deploy only parent-hub-data with JWT verification enabled and the complete reviewed dependency bundle. Other functions must not be redeployed. Keep old payload compatibility during rollout.
4. With a controlled test identity, verify live registration/profile creation, save/draft/final persistence, authenticated ownership, pending restrictions and admin retrieval. Never use real parent data for destructive tests.
5. Merge/deploy the website and Control Room branches only with approval. Website main pushes trigger Pages production deployment. Verify actual deployed asset hashes/versions and rerun controlled registration/pending/assignment/activation/return-login/paused access tests. Do not assign a real athlete's programme during tests.
6. Record live database persistence evidence and remaining physical Safari results. No email delivery test applies to this release.

## Rollback

Revert website and Control Room release commits and redeploy the saved parent-hub-data bundle. Keep completed flags and saved JSON intact. Old completed parents continue skipping onboarding. If an incomplete compact draft must return to the old form, it will need to finish the old questionnaire; the JSON is retained. Leave the additive routine/index in place during a normal rollback. Only after reverting the function and confirming no callers remain may an operator drop public.save_parent_athlete_setup(uuid,jsonb,boolean) and athletes_parent_user_unique. Do not delete or relink parent records. No notification/retry cleanup is needed.

The endpoint, JSON contracts, Auth ownership and SQL routine carry into Next.js; only the renderer later needs replacing.
