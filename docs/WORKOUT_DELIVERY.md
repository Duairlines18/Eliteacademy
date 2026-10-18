# Workout updates: delivery contract and reusable prompt

Use this prompt for future updates:

> Update [athlete / school], week [number], with these changes: [changes]. Resolve the exact athlete, programme and assigned week first. Use approved library exercise codes and separate dosage, rest and cues in structured prescriptions. Keep unrelated days and recovery restrictions intact. Refresh demo selections from the active library; never guess a video or substitute a different movement silently. Save, read back and check the actual published payload through the production athlete renderer and copied workout. Verify each requested change, every day/block, doses, rest, cues, primary/alternative demos, publication and assignment. Run the delivery regression suite and the current-content audit. Report PASS only with counts and evidence; state any login or video-playback checks that remain unverified. A saved database row alone is not delivered.

## Definition of delivered

1. The correct athlete/programme/week is resolved; publication does not advance an unrelated athlete or reveal a draft.
2. Every intended day/block and exercise survives the authenticated response shaping and actual UI normalizer.
3. Dose, rest and cues remain together. Legacy semicolons between independent movements still work.
4. Demos use the current active canonical exercise library. Reviewed selections stay scoped to their source row; alternatives remain attached and never replace the main exercise's guided demo.
5. Copy workout retains coach cues, dose and rest.
6. Source regressions pass before Pages deployment. Control Room publication preflight rejects incomplete structured doses, unavailable demos and invalid row mappings.
7. The saved content is read back and audited. An authenticated browser check is reported separately when unavailable; URL mapping checks do not prove YouTube playback.

## Automated commands

```sh
node --test athlete-qa/*.test.cjs athlete-qa/*.test.mjs coach-command/*.test.cjs coach-command/*.test.mjs parent-qa/*.test.cjs supabase/qa/*.test.mjs performance-journey/*.test.mjs performance-journey/*.test.cjs qa/workout-validation.test.cjs
node homepage-qa/homepage.test.cjs
node qa/check-workout-delivery.mjs /private/path/current-workouts.json
```

The private export must contain `athletes` (id, name, programme_id, current_week), `weeks`, `days`, `blocks` and active `exercises`, using database field names. Export only the target weeks. Never commit athlete exports, credentials, feedback or health notes to this public repository. The audit checks the production shaper, normalizer, athlete HTML and copied workout. Current assigned weeks must be published; included staged drafts must remain hidden by the publication gate.

Prefer structured `prescriptions` with `exerciseCode`, `dosage`, `rest`, `cues` and optional `alternativeExerciseCode`. Text-only running/recovery instructions remain supported. Mark text blocks `requiresDemo: true` when every row requires an explicitly reviewed demo; unknown exercise names require coach resolution, not an invented match.

## Deployment and limits

The frontend fix is in `index.html`. `hub-core.ts` carries reviewed row mappings using current library URLs. `workout-delivery.ts` loads active canonical movements referenced by reviewed text rows even when a duplicate `exerciseCodes` list is absent. Each existing Edge Function deployment retains its own authentication/handler/account modules and original JWT setting; only delivery shaping, exercise loading and the new helper are changed. Preserve those deployed account-specific repository methods when redeploying.

Control Room includes the same `qa/workout-validation.js` preflight. This is an authoring safeguard, not a replacement for backend authorization, nor a guarantee against writes through other clients. This change does not modify schema, RLS, credentials, programme content or current-week assignment.

Rollback: revert the frontend commit and redeploy the previous function bundles. No database rollback is needed.
