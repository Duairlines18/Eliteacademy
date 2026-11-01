# Parent and private athlete onboarding release

Continues merged parent PR #69 through integration PR #71. The existing five-question parent setup and website design remain intact.

## Changes

- `index.html`: accepts checkbox arrays and legacy comma-separated strings; restores saved private answers; reopens incomplete setup; provides Athlete Setup editing; preserves answers after failed saves and explains the existing combined notes limit.
- `supabase/functions/_shared/supabase-repository.ts`: explicitly creates new parent-managed and private account athletes with `athlete_type: private`, avoiding the table's school default. Existing linked profiles return unchanged. No schema, RLS, authentication configuration, payment or assignment changes.
- `qa/private-onboarding.browser.cjs`: synthetic mobile/desktop login, failed-save retry, handler validation, answer restoration/edit and Week 1 delivery.
- `supabase/qa/account-profile-creation.test.mjs`: creation classification and existing-profile preservation. Both creation tests failed on the old code before the two-field fix, then passed.
- `hub-delivery/routines.browser.cjs`: completed private-account fixture now contains the required saved answers.
- `.github/workflows/full-delivery-regression.yml`: includes private onboarding browser checks.
- `homepage-qa/homepage.test.cjs`: accounts only for the scoped onboarding additions while retaining protected homepage comparisons.

## Verification and rollout

Local full regression: 145 tests, zero failures. School HTTP, protected homepage, Story (14 tests), and PostgreSQL/PGlite parent persistence/privileges pass. The first integrated CI run exposed an outdated routines fixture; after its correction, all four workflows passed, including private 390/1440px, parent Chromium/WebKit, routines, six school identities and coach routes. Repeat gates on the final commit before merge.

Controlled production identities use generated `example.invalid` addresses; no real athlete credentials. Live registration, parent draft/final/stale-draft protection, private checkbox-array persistence/restoration/update, missing-session rejection and pending programme denial have passed. Final deployment checks must additionally confirm new account classification, approved synthetic programme delivery, paused access, isolation, clean-up, production HTML/assets and Nigel's unchanged active Week 1 record.

Only redeploy the existing `parent-hub-data` and `private-athlete-hub-data` bundles with the reviewed repository insert changes; retain JWT verification. Preserve all other deployed dependency bytes. No environment variables or manual setup changes.

Physical iPhone Safari remains distinct from WebKit CI. Automated local Chromium cannot start in this executor (socket operation denied); browser acceptance runs in GitHub Actions.

## Rollback

Revert PR #71's website merge and let the existing Pages workflow redeploy. For the classification addition, remove only the explicit `athlete_type: private` insert fields and redeploy the two account functions using their retained baseline bundles. Do not undo saved answers, activation/payment state or programme assignments. No database schema rollback is required.

The JSON answer contracts, secure endpoint ownership and programme assignment model carry into a later Next.js renderer.
