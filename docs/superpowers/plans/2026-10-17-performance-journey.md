# Performance Journey Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give each authorized private athlete, parent and school/club viewer a concise evidence-based training journey.

**Architecture:** Add an isolated read endpoint and service-only snapshot/source functions; share one deterministic summary engine between backend and UI. Existing Hub renderers mount the new card using their existing authenticated transport.

**Tech Stack:** Static JavaScript modules, Node test runner, Supabase Postgres/Edge Functions, GitHub Pages.

**Spec:** docs/superpowers/specs/2026-10-17-performance-journey-design.md

## Global Constraints
- Exact existing Hub palette; explicit scoped text colours.
- No authentication, workout prescription, exercise video or assignment changes.
- Only published verified weeks through assigned current week; audience authorization before source reads.
- Every 14 days means elapsed time, not automatic programme-week increments.
- No invented achievements; shared school athlete codes never expose individual records.

## Review Focus
- Parent cohort assignment differs from athlete direct assignment: follow each existing pathway.
- Mixed school roster assignments: group story is the cohort story, individual detail resolves its own programme.
- Shared check-ins have no athlete IDs: show submissions, never a fabricated unique-athlete denominator.
- One-week and unpublished programmes: meaningful starting state without imaginary history.
- Overrides and missing feedback: qualify summary, never present inferred performance gains.

### Task 1: Safe source and summaries
Files: performance-journey/journey-core.mjs, performance-journey/journey.test.mjs, supabase/functions/performance-journey/authorization.mjs.
Interface: buildJourney(source,{group,parent}) -> {steps,purpose,weeks,evidence}; authorizeContext(request,body,db) -> authorized subject.
- [x] Write/run failing tests for progression copy, boundaries, parent/shared role isolation and missing evidence.
- [x] Implement deterministic copy and authorization; run tests green.

### Task 2: Source, snapshots and endpoint
Files: supabase/migrations/new timestamp migration, supabase/functions/performance-journey/index.ts.
Interface: journey_source(kind,id,parentMode) -> safe JSON; refresh_performance_journeys() -> saved count.
- [x] Add RLS-protected context/snapshot tables and service-only source/refresh functions.
- [x] Resolve published history and period evidence; seed reviewed CRM context by durable athlete IDs.
- [x] Deploy endpoint, run SQL access/source tests and unauthenticated denial checks; populate and schedule daily due-check.

### Task 3: Portal UI and deployment
Files: performance-journey/journey-ui.js, performance-journey/journey.css, index.html, performance-journey/browser.test.cjs.
Interface: window.DuPerformanceJourney.mount(host,{request,audience}) -> destroyable mount.
- [x] Write failing integration/browser checks; add scoped card and minimal renderer hooks.
- [x] Run unit, browser and existing regression checks; review whole diff.
- [x] Deploy checked commit, verify GitHub Pages and live assets, record rollback and limitations.
