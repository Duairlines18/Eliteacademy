# Performance Hub delivery repair — feature branch

Approved scope: shared parent/private assignment, identical prescriptions, demo retention, publication filtering, saved instructions, unified existing-style weekly overview and complete WhatsApp copying. Weekly Coaching Intelligence and Mindset Quotes are Phase 2 and are excluded.

## Implementation sequence and ledger

1. Audit existing copy boundaries and preserve deployed account modules in source control. Done. Website baseline 47 tests passed. Feature checkouts are isolated from main.
2. Reproduce and repair shared assignment, adjustments and publication metadata. Done. Parent direct/cohort fallback, history and feedback use the same account-assignment helpers. Seven original regression cases failed before repair and passed afterward; two more instruction-format regressions were subsequently reproduced and fixed.
3. Shared overview and copy formatter. Done. Real source helpers have tests for identity, order, safety, demo validity, delivery capabilities and explicit calendars. Five initial behavior tests failed before implementation. Existing source tests were updated to load the real helper and reflect the approved removal of parent copying.
4. Current-data and mobile verification. Completed locally with fixture authentication and real clipboard access; final evidence and live-environment blockers are recorded in the release summary.

Final independent review: four Important findings were reproduced and fixed with RED→GREEN tests: consistent substitution references, strict reviewed URL validation, Guided running safety cues and restored private published-week/history navigation. A grouped school raw-text isolation regression was also reproduced and fixed. Athlete education remains accessible through the existing coach-note fallback.

Final ruling: `staffNote` is deliberately staff-only data and is excluded from outward WhatsApp copy. Published `athleteNote`, `watch`, prescription cues and safety instructions are included. Broadening that to private staff notes without an explicit sharing rule could expose internal notes. This is a deferred minor, not a prescription omission.

Ruling: Preserve the existing private-athlete role with no parent linkage as the self-managed delivery path. Parent role always hides copy. An account with both parent and athlete linkage is marked review-required and fails closed for copy; no nationality, location or name is used. There is no explicit stored delivery-model setting. A future coach-managed `deliveryModel` setting needs approval for mixed accounts; no such setting or data mutation is introduced here.

Ruling: Source-only policy scripts are prepared for release review. They are not applied during branch implementation because live policy updates are production changes. They retain exact ownership predicates and add verified/non-null-publication checks; rollback restores the original expressions. No table, column, role, assignment or authentication change is made.

Ruling: Mphatso Week 6 remains withheld. Live investigation found `live` + `verified`, null `published_at`, no publication record and no scheduled date. The stored running/rest instruction formats are now supported without altering any prescription. Publication is a coaching/release decision; no timestamp is fabricated.

## Architecture

- Existing JWT and access-code handlers continue establishing ownership before loading content.
- `_shared/account-assignment.ts` resolves direct assignments for both account roles, falls back to the existing cohort only when no direct assignment exists, gates publication and applies adjustments. A broken direct assignment cannot silently select a cohort programme.
- `account-adjustments.ts` retains canonical active exercises referenced by prescriptions, legacy codes and reviewed text rows, including substitution targets.
- `hub-core.ts` preserves existing instruction-only prescription/root text formats and joins notes. No database content is rewritten.
- Private schedule queries and the response helper filter unpublished metadata. Current-week workouts still require live/completed, verified and a non-null publication timestamp.
- `hub-delivery/delivery.js` holds pure copy formatting, supported video validation, display capabilities and explicit weekday mapping. It can carry into Next.js.
- Both account dashboards call the same overview renderer. The current design, parent Guided mode, day cards and independent Performance Journey remain in place. Missing weekdays/dates are labeled for confirmation. No training, competition, recovery status or clearance is inferred.

## Copy boundary and output

Parent-managed access has no copy button; private self-managed copying requires the server-provided capability and published content. Existing authenticated school/staff sessions can copy their authorized training. Athletes copy the selected school group; staff copy all authorized groups with explicit group labels. No messaging is sent automatically.

Copy includes identity, week/day/title, duration, published focus/objective/purpose, watch/athlete notes, full ordered warm-up and training, dose/rest/cues/avoid text and valid movement demo URLs. Raw prescribed instructions are retained if normalization could otherwise lose details. Only published current-session routes expose the action. Clipboard denial falls back to a selectable full text field.

## Release order — requires final approval

1. Save the currently deployed parent/private/hub-data bundles and current policy expressions privately. The audit already captured baseline parent/private bundles; refresh them before release.
2. Deploy the changed parent/private/hub-data bundles with their existing JWT settings, preserving each function's original handler/account modules. Parent/private are JWT-verified; shared hub-data retains its existing setting and access-code validation.
3. Run authenticated parent/private parity, unrelated-account denial, school access and actual video playback checks against dedicated QA accounts. Current local browser tests use fixture authentication; they do not replace this step.
4. Apply `supabase/rollout/journey-assignment-parity.sql` to align the existing journey function’s direct/cohort resolution while retaining parent evidence/privacy rules. Then apply `supabase/rollout/hub-publication-policies.sql` only after reviewing the exact policy diff and verifying dedicated QA direct-read denial for unpublished data.
5. Merge website/Control Room feature branches only after final approval and QA. The main branch Pages workflow deploys production automatically; feature branches must not run its manual deployment job.
6. Verify a reversible publish/readback/restore on an isolated QA programme. Do not use a real athlete's prescription for a test write. Confirm parent and athlete resolve the same week afterward.

No new environment variables, secrets, credentials or account setup are required. Local browser QA uses `HUB_QA_FIXTURES` for a private JSON fixture export and `CHROMIUM_EXECUTABLE` for a working browser; never commit that export. Production keys remain in the existing server environment.

## Rollback

Revert the feature commits in website and Control Room and redeploy saved original Edge Function bundles with their original JWT settings. If the new read predicates were applied, run the reviewed `hub-publication-policies-rollback.sql` and, if the journey function was updated, `journey-assignment-parity-rollback.sql`, which restores the exact audited ownership/publication expressions. Restore any deliberate QA content edit through the existing protected workflow and read it back. No programme-assignment, prescription, table/column or authentication rollback is expected because none is changed by this repair.
