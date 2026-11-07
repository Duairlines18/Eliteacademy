# Workout/demo sync: before and staged after

These changes are in review branches, not deployed. No athlete, assignment, workout, library entry or feedback record was changed during this audit.

| Area | Before | Staged behaviour |
|---|---|---|
| Saved demo identity | Name-only generated links; save discards reviewed code | Stable exercise code and exact instruction binding |
| Library rename or URL edit | Name dependence can lose selection; stale loaded definitions can remain | Reviewed code follows current active canonical entry; lookup failure surfaces |
| Editing a workout row | Carried demo metadata can follow changed text | Changed row needs deliberate selection and confirmation; stale binding rejects |
| Same movement, new dose | Guard could block renewed same-code selection | Exact freshly reviewed instruction can be saved |
| Compound row | Several movement demos may apply | Multiple explicit choices retained |
| Row alignment | Structured prescription index assumed to match text index | Positional mapping requires explicit alignment and equal row counts |
| Ambiguity | First match/name overlap can mislead | Ambiguous identity needs explicit selection; no unknown-code fallback |
| Publication checks | Website/admin validator rules drifted | Identical checked-in validators compare video identity and instruction binding |
| Individual swaps | Binding could become stale behind replacement | Approved swap updates valid binding; stale input remains hidden |

## Evidence gathered

- Read-only live inventory: 1,455 saved links, 329 linked blocks. All currently match one active library exercise and its exact URL. Name-only storage is a future reliability weakness, not proof those links are currently wrong.
- All 18 active athlete records, including QA records and six Saints athletes, have exactly one matching published current week in this query. This does not test sign-in or hosted response delivery.
- Library gaps: ACC05 has no video and no structured block references. SPR06 has no video and one reference in Andria's completed Week 4. No substitute was guessed.
- Local suites: 65 Control Room tests, 184 website tests, 22 durable-mapping PostgreSQL cases and 18 full publication/RLS integration cases with the replacement installed. Independent review reproduced three further regressions (untouched stale binding, compound-row swap and lost no-demo choice); all have failing-then-passing regressions and fixes. All GitHub CI jobs passed on website commit 78d8ec9d65baa68980112194eef741a4d7c615c2 and Control Room commit 987c02a05abff0d5e736ba237f324a9070a181d3, including 390px/1440px actual editor-save checks.

## Checks that cannot be marked passed yet

- Hosted parent/private/school/staff/admin authentication and end-to-end delivery: the secure sign-in follow-up timed out; a fresh browser verification still shows the login form. No authenticated session was established.
- Actual video decoding: sampled ACT02 page title/poster load, but video time remains zero and readyState zero. No real-iPhone test or full-footage semantic audit has been completed.
- Production rollout and post-deployment parity: not executed. The PR stack and each endpoint's live dependencies/JWT settings must be reconciled first.

Registration, video upload and broad account cleanup have not been recertified by this focused demo-sync change. Existing regression coverage is preserved. No test result here means the entire platform has passed every requested QA gate.

Deployment follow-up: exact live bundles were inspected. Candidate bundles preserve the per-endpoint entrypoints, non-video dependencies, JWT flags and authentication prefix. Local probes over those candidates passed. See VIDEO_RELEASE_PARITY_2026-11-07.json and VIDEO_RELEASE_READINESS_2026-11-07.md. This preparation is not deployment or hosted sign-in proof.
