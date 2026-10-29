# Compact Parent Setup Implementation Plan

Goal: Five-question parent setup saved securely to Supabase; email excluded by user approval.
Architecture: Existing Auth and parent endpoint; versioned compact payload, merged JSON, atomic draft/final save. Existing Control Room modal shows answers and activates direct assignments.
Spec: User release request and approved audit, with email removed on October 29.
Constraints: Preserve registration/design/programmes/RLS. Production requires separate approval. No new application table. Never mark complete until confirmed save.
Review focus: concurrent profile creation; stale drafts after final save; legacy medical data; active versus paused access; direct assignment activation without cohort.

## Task 1: Parent backend contract
- [x] Write and run failing validator/service tests for five questions, partial draft, unknown keys, safety, legacy support and preservation.
- [x] Implement parent-core validator and service draft handler. Repository uses service-only RPC for atomic JSON merge; unique partial parent index and creation conflict recovery.
- [x] Verify contract and account/security suites. Migration stays unapplied pending production approval.

## Task 2: Parent UI
- [x] Write failing browser tests for compact screen, exact labels, max two priorities, exclusive equipment, conditional safety, save failure, drafts, pending and active states.
- [x] Add scoped UI module/styles and connect only the parent renderer/submit handler. Save drafts serially, restore server draft; no sensitive local storage.
- [x] Verify mobile WebKit and desktop Chromium with intercepted backend fixtures.

## Task 3: Control Room and release
- [x] Test answer review and direct assignment activation.
- [x] Add escaped, read-only setup answers to existing modal; accept programme or cohort only for athlete access changes.
- [x] Run regression suites, SQL fixture verification if local PostgreSQL is available, inspect branch diff and prepare draft PRs plus rollout/rollback instructions.
- [x] Leave production unchanged until separate approval. No notification delivery is claimed.

Execution notes: User approved implementation without email. Production migration/deploy intentionally not performed. Author and independent review completed; no important defects found. Local WebKit dependencies unavailable; CI provides WebKit check.
