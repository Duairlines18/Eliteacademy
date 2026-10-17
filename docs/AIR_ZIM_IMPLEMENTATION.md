# Assigned warm-up implementation

Status: feature branch only for GitHub; scoped Supabase data and admin-policy changes applied. Production Pages deployment requires owner approval.

The owner revised school scope during implementation: remove complete warm-up blocks from both school prototypes, retain individual exercise videos. Do not restore or assign a complete recipe to either school.

## Architecture and changes

`Eliteacademy/index.html` renders the athlete Hub. `Du-Airlines-Hub-` is the separate coach control room and was inspected but not modified. Published programmes are loaded by existing Edge Functions after validating an account assignment or a hashed school-code session. Reusable saved blocks remain in existing tables; session blocks contain the delivered prescriptions. No table, authentication flow, dashboard or environment variable was added.

Changed files:
- `index.html`: server-supplied warm-up stage labels; readable expandable title; individual-exercise category replaces the complete-recipe library presentation; account and shared-code category translation agree; authoritative tags replace stale fallback categories.
- `coach-command/coach-command.js`: preserve legacy main-workout sections when warm-up prescriptions exist; display server-supplied stage labels.
- `athlete-qa/air-zim.test.cjs`, `athlete-qa/exercise-categories.test.cjs`, `athlete-qa/air-zim.browser.cjs`, `coach-command/air-zim.test.cjs`: focused behavior and responsive checks.
- `homepage-qa/homepage.test.cjs`: retains the locked homepage byte check and unrelated integration checks, with explicit exceptions for the approved Hub changes covered by dedicated tests.
- `supabase/migrations/20261017070118_admin_profile_read_only_prevent_self_elevation.sql`: database policy already applied.

## Database change boundaries

Only warm-up session blocks and exercise secondary category tags changed. Both school prototypes have their complete warm-up blocks removed. Private current-week main workouts, recovery days, prescriptions, rest periods and athlete records remain intact. Reduced/short warm-ups remain where prescribed. The hamstring-return routine is explicitly conditional on existing return-to-running restrictions and Coach Du clearance; it adds no intensity targets.

All saved warm-up entries and underlying exercise/video records are retained. The detailed assignment IDs, before/after snapshots, data SQL and guarded rollback SQL are stored in the private delivery bundle, outside this public repository. Do not commit those files or real session tokens.

The policy audit reproduced a self-elevation issue inside a rolled-back transaction: `admin_self FOR ALL` allowed a signed-in user to insert their own admin membership. The applied migration changes it to SELECT-only. Existing admin-profile reads and protected admin content access were verified after the fix. Keep this correction when rolling back presentation/data changes.

## Verification

Run existing checks and focused tests from the repository root:

```sh
node athlete-qa/air-zim.test.cjs
node athlete-qa/exercise-categories.test.cjs
node athlete-qa/athlete-sheet.test.cjs
node coach-command/air-zim.test.cjs
node coach-command/coach-command.test.cjs
node homepage-qa/homepage.test.cjs
node parent-qa/parent-session.test.cjs
node parent-qa/session-card-polish.test.cjs
node --test supabase/qa/*.test.mjs
```

Responsive test uses a private server-shaped snapshot outside git:

```sh
AIR_ZIM_QA_BUNDLES=/absolute/private/ui-bundles.json CHROMIUM_EXECUTABLE=/path/to/chromium node athlete-qa/air-zim.browser.cjs
```

172 final browser checks passed across four assigned private athletes and both excluded school prototypes at 390px and 1440px, including all nine library categories.

These variables are QA inputs only; production needs no configuration change. Browser responses are intercepted deliberately: rendering checks are distinct from live authorization checks. YouTube modal targets are verified; external streaming playback is not asserted.

Live backend checks cover school athlete and staff bootstrap, complete-recipe exclusion, retained main sessions, full library retrieval and ignored caller programme overrides. PostgreSQL role/identity tests cover the four assigned private programmes, cross-programme denial, anonymous/unassigned recipe denial, self-elevation rejection and continued existing-admin access. Missing/invalid credentials are rejected by the live endpoints. Private athletes' actual password sign-ins were not performed or changed.

The full library contains 65 active records and 63 existing videos. Two existing entries have no video source: Fast Feet → Run; 10–30m Acceleration. No demonstration was invented. All warm-up entries have valid exercise/video references.

Existing advisor findings remain outside this change: mutable search paths on three existing functions, disabled leaked-password protection, and five server-only technique tables with RLS/no client policies.

## Rollback and migration

Before any later data rollback, compare the guarded SQL in the private delivery bundle with current coaching edits. Its predicates avoid overwriting newer content, but conflicts require review. The complete rollback was dry-run in a transaction and rolled back again, with row counts verified. It restores changed warm-up content and removed school blocks, deletes only the six inserted blocks, and restores changed secondary exercise tags. Keep the admin self-elevation fix.

For UI rollback, revert this feature commit through a new reviewed branch. No production UI rollback is needed until deployment. No main-branch push or production deployment is authorized by this implementation.

Existing programme/exercise IDs, JSON prescriptions and protected Edge Function contracts carry into a future Next.js interface unchanged.

## Reusable warm-up tools

Air Zim is a programme resource, never a numbered training day. The assigned
athlete dashboard offers it below the existing day grid. Each training-day view
and the exercise-library landing page also link to the same resource. The
resource route reuses only the Air Zim prescriptions already delivered in the
validated current programme; it contains no built-in recipe or athlete allowlist.
Unassigned programme responses produce no shortcut and no recipe on direct access.
The reference retains the source session warning and reminds athletes that the
current day's reduced warm-up, rest and return-to-running limits take priority.
Existing prescribed Air Zim accordions, workouts and day numbering are preserved.

The QA-only standalone preview day was removed and its existing warm-up block
moved inside the original first workout. This restores the original seven QA
days. The ten copied main/recovery blocks were unchanged; no athlete programme
was edited by that correction. Private backup/rollback SQL is retained outside
this public repository.
