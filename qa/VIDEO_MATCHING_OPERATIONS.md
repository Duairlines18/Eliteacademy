# Exercise video matching: operating contract

## Single source of truth
- Exercise demonstrations live in public.exercises (code, name, video_url, active).
- The Control Room's structured prescriptions reference exercises.code; never infer a different video from the dosage text.
- The athlete Hub should resolve those same exercise codes against the authorized exercise library returned by its protected Supabase endpoint.
- Legacy session_blocks.content.items strings are matched server-side by public.sync_session_block_exercise_videos(), producing content.video_links.
- Do not add a second independent JavaScript fuzzy matcher. If an exercise is missing, add/correct the exercise library record or a narrowly reviewed alias in the SQL migration.

## When adding or editing a workout
1. Select the existing exercise code in Control Room. Avoid free-text substitutes for the movement identity.
2. Confirm that exercises.video_url is populated and active before publishing.
3. Save via the existing protected preview/confirmation flow; do not bypass it.
4. Inspect the generated demonstration on the athlete view for the correct movement variant.
5. Run qa/video-matching-regression.sql after any alias/matcher change and verify the zero false-match invariant.
6. For exercises without a recorded demo, leave the video missing and flag for filming. Never substitute a related but different movement.

## Current boundaries
- The SQL trigger runs on INSERT or UPDATE OF content; it does not automatically refresh existing session blocks when only exercises.video_url changes. Run a reviewed backfill after library changes.
- Matching a plain text movement is inherently less reliable than a structured exercise code. Migrate legacy items to codes as workouts are naturally edited, not in a bulk prescription rewrite.
- A non-video running or recovery instruction does not necessarily need a demonstration.
- No frontend files or production site were changed by the database migration. End-to-end athlete browser checks remain required before marking full UI QA complete.

## Rollback
The previous trigger definition must be restored from the pre-change database backup or migration history. Restoring only the function does not restore old generated video_links; run a controlled backfill after rollback. Never roll back workout prescriptions.
