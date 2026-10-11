# Programme assignment safeguard — QA gate (pilot)

**Status: NOT APPROVED FOR DEPLOYMENT.** This document is the pre-deployment review; no production migration has been applied.

## Findings to resolve
1. **Authorization:** The SQL routine permits the service role. A protected admin Edge Function must authenticate the actual caller and verify administrator authorization before using the service role. A service-role check alone does not authenticate the administrator.
2. **Assignment integrity:** Other write paths can still update `athletes.programme_id`, `athletes.current_week` or `cohorts` independently. The routine is safe only if all administrative switching routes are routed through it.
3. **Programme completeness:** Counting `training_days` does not prove that exercises, session blocks, media references or tier-specific content will load. Validate the exact delivery bundle with the same rules as the Hub before activation.
4. **Cohort lifecycle:** A new cohort on every switch leaves unused cohorts behind and changes shared-cohort semantics. Determine when to reuse a dedicated cohort and preserve school group assignments.
5. **Activation policy:** Access suspension/expiration and payment entitlements are independent from programme selection; do not automatically reactivate suspended accounts.
6. **Verification scope:** Database readback verifies configuration, not authenticated browser delivery or user login. Add a protected readback of the effective bundle, then mobile/desktop browser QA.

## Mandatory acceptance tests
- Published, verified, complete week succeeds and returns exact programme/week for target account.
- Missing, draft, unpublished or unverified week rejects without changing the target.
- Missing session blocks/exercises or invalid substitutions rejects without changing the target.
- Non-admin caller and suspended account cannot activate content.
- Switching one private athlete leaves Ogden/Andria and every other account unchanged.
- Switching a school athlete cannot silently move them out of their school's coach oversight.
- Simultaneous switches on one athlete serialize; the latest confirmed operation matches actual delivery.
- Account-specific refinements remain isolated.
- Parent, private athlete, staff and access-code routes all show the intended effective programme.
- Verify mobile and desktop display separately.

## Observed read-only production audit (2026-10-11)
- One athlete-to-cohort programme/week mismatch remains (Takunda).
- No production records were changed during this QA.
- Do not repair Takunda until the intended programme and week are confirmed.

## Rollback
No production rollout yet. Remove or revert feature branch commits if abandoned. Once deployed, require a separate reversible database migration and a documented cohort restoration plan.
