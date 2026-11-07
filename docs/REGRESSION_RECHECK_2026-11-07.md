# Regression recheck against current main

Prepared source only; not deployed. This check reconciles the QA release candidate with the current main branch rather than publishing an older snapshot over newer work.

Main baseline: 6530ab665c8c4c9d3e3966800e2aa3f7fa0690da. The baseline passes 158 Node tests. The combined candidate passes 184 Node tests. No baseline test failure was found. Comparison is against repository source, not a claim of authenticated production verification.

Nine main commits since the original QA fork are retained, including parent/school/athlete email handoffs and the current $69/$129 elite-athlete pathways. The academy index and six inquiry/email route files are byte-identical to current main. The merge required no conflict resolution and did not alter those files beyond incorporating their existing main versions.

Additional fresh checks:
- Control Room: 65 tests passed. The first attempt lacked the temporary jsdom package; restoring the pinned dependency resolved the runner failure without application changes.
- Database: 68 disposable checks passed across durable demo mappings, publication history, assignment history and feedback revision retention.
- Protected publishing/RLS: 18 integration cases passed with the staged replacement installed.
- School HTTP: 1 integration test passed.
- Homepage structure, JavaScript syntax and integration preservation passed.
- Links: 9 tests passed. Du Airlines story: 14 tests passed.
- Shared website/admin validators remain identical.

The latest Control Room main has no commits missing from its QA branch. Browser CI runs on the consolidated candidate; source and database pass counts above are local execution evidence.

Hosted sign-in remains blocked: the available browser opens the Hub login screen and has no usable authenticated QA session. No further secure-login retry was issued during this recheck. Actual decoded playback, real-iPhone checks and post-deployment recipient verification remain unpassed. No production data, account, authentication policy or deployed endpoint was changed.
