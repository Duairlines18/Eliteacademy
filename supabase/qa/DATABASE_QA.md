# Isolated database release verification

This opt-in suite needs no Supabase project, credentials, paid branch or production writes. It executes the actual staged policy/Journey SQL and audited administrator function bodies against synthetic tables and records in disposable local PostgreSQL.

Install the pinned test engine outside the application repository:

```bash
npm install --prefix /tmp/du-hub-database-qa --save-exact @electric-sql/pglite@0.3.14
PGLITE_MODULE=/tmp/du-hub-database-qa/node_modules/@electric-sql/pglite/dist/index.js node supabase/qa/database.integration.mjs
```

The final run executed PostgreSQL 17.5 (production is 17.6) and passed 18 tests. Checks include actual RLS filtering, matching parent/athlete rows, anonymous/unrelated denial, administrative authorization/grants, correct publish/readback/rollback, reversible saved-instruction edits, stale preview rejection, shared edit confirmation, incomplete/blank content denial, direct-first Journey parity, and exact policy/function rollback. Two further tests use the audited existing video/validation triggers: canonical demo metadata can change while every prescribed field remains exact, and any non-demo mutation still rejects. The Air Zim warm-up prescription guard also remains effective.

Before the new validator rollout was added, regression cases demonstrated rejection of nonempty instruction prescriptions and acceptance of empty content. The independent reviewer also identified whitespace codes and blank instructions; failing regressions preceded their fixes. `HUB_QA_BASELINE=1` runs the integration cases against the old validators and intentionally fails those repair assertions.

The fixtures contain synthetic UUIDs and content. Policy expressions and the baseline publishing function were captured read-only on 19 October 2026; the old update validator is the existing migration. No new application dependency or database table is introduced. The test module is opt-in rather than part of the dependency-free source test glob.

Limits: local claim/role simulation does not test JWT verification, hosted Edge Functions, Supabase gateway configuration, or a real account sign-in. The schema fixture includes relevant columns and policy expressions rather than a complete production clone. Hosted publish/restore and actual authenticated views remain release gates. Rollout SQL remains source-only until approval.
