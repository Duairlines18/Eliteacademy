# St. George’s Six-Athlete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare six durable school athlete identities and a named coach with isolated code access, retaining existing shared access.
**Architecture:** Existing tables and protected Edge Functions remain authoritative. Nullable athlete/staff identity distinguishes person-bound school credentials from shared credentials. Unreleased credentials remain paused in production.
**Tech Stack:** HTML/JavaScript, TypeScript Edge Functions, Supabase/Postgres, Node test runner.
**Spec:** `/workspace/scratch/6d7d2025628d/St_Georges_Phase_1_Audit_2026-10-24.md` (approved by user).

## Global Constraints
- No public deployment, production merge, external credential distribution or unapproved programme publication.
- Preserve existing demo credentials, private/parent delivery, video mappings and programme history.
- Unknown athlete details and official start date remain unset.
- Use existing schema; no broad RLS grants, no browser service keys or plaintext secrets in Git.
- User authorized continuous execution of this scope; do not introduce another plan approval gate.

## Review Focus
- School session plus leftover authenticated private session must choose school identity.
- Tampered person/cohort/staff bindings and paused profiles must fail on every endpoint.
- Same browser switching between six athletes must clear progress and school-form caches.
- Legacy shared sessions must continue working without person IDs.
- Unknown form and draft programme must never masquerade as an approved personalized prescription.

### Task 1: Person-bound authorization and lifecycle
Files: `_shared/school-identity.ts`, `_shared/hub-service.ts`, `_shared/supabase-repository.ts`, `_shared/hub-core.ts`, `hub-data/index.ts`, tracked `verify-hub-access/index.ts`, `workout-completions/index.ts`; journey and school-review authorization dependencies.
Interfaces: `authorizeSchoolIdentity(repository, code, cohort, role, session?)` returns `{athlete,staff}`; `authorizeSchoolSession({token,repository,cryptoPort,now})` returns validated context; repository provides minimal identity lookups and session revocation.
- [ ] Write executable tests for six distinct bindings, reassignment, paused profiles, cross-school code mismatch, named staff membership, legacy access and logout.
- [ ] Run tests RED, implement checks and bootstrap identity, run new plus existing access/account tests GREEN.
- [ ] Route completion ownership through server identity; prioritize school header; check context and session across journey/review too.
- [ ] Commit verified backend changes.

### Task 2: Browser and existing administrator workflow
Files: website `index.html`, `hub-delivery/premium-v2.js`; Control Room `index.html`, a small access-code helper; focused tests in each repo.
Interfaces: bootstrap returns `{athlete:{id,displayName,formTier,testing},staff:{id,displayName},accessMode:'identified-school'|'shared-school'}`; completions retain existing wire format.
- [ ] Write failing tests for full placeholder display, identity state clearing, person-bound completion UI, and secure one-time generation/rotation.
- [ ] Preserve compact player, routines routes and school layout; scope form selection; add server logout and reset progress.
- [ ] Extend existing code dialog to select athlete/staff, use 32 WebCrypto bytes and store hash only; rotate one credential and revoke its sessions; never overwrite existing legacy codes implicitly.
- [ ] Run focused and existing regression suites; commit.

### Task 3: Reversible live pre-provisioning and programme drafts
Files: reviewed SQL admin-operation and rollback files under `supabase/rollout/`; private pre-write snapshots outside public Git; completion report.
Interfaces: six fixed placeholder UUIDs, one Coach Dube UUID, existing cohort/organization IDs; admin generates usable raw codes once after release.
- [ ] Freshly check scoped records and preserve before-images; ensure rerunning cannot duplicate placeholders or overwrite real names.
- [ ] Insert six school athletes, Coach Dube/membership, seven paused credential reservations and organization link transactionally. Keep pending payment and null start dates.
- [ ] Stage four-week draft using existing programme/library with two coached days and optional home day; retain source prescriptions for review and mark unresolved readiness/loading/rest explicitly.
- [ ] Verify exact rows, no unrelated changes, paused code state, draft publication gates and preserved originals.

### Task 4: QA and release package
Files: local browser QA fixture/server, school identity browser tests, final report and admin instructions.
- [ ] Execute desktop/mobile rendered Hub tests for six identities and named coach with explicit test-backend limitations.
- [ ] Run real live-data read verification; do not label fixture tests production end-to-end.
- [ ] Run invalid/expired/paused/rotated identity cases, original access/account/routines/video regression, secret scan and syntax checks.
- [ ] Fresh whole-branch review; fix material findings; commit and push feature branches only.
- [ ] Document blockers: isolated Supabase branch declined; public release not authorized. Leave live signed-in QA blocked until a runnable authorized backend exists.
