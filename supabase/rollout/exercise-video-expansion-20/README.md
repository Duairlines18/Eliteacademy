# Exercise video expansion: 20 exact mappings

Coach Du authorized storing the exact mappings and releasing them despite browser verification limits. This data-only release uses the existing public.exercises table, Control Room selector, and guided training resolver. No frontend deployment is required.

Run import.sql through the privileged database tool. It takes short table locks, inserts only absent exact mappings, aborts on conflicts, and verifies existing exercise rows and programme content remain unchanged. Rerunning is a no-op. Run inside BEGIN / ROLLBACK first; then run twice to prove persistence and idempotence.

All records are active and selectable. No exercise is assigned to any athlete. Default dosage is deliberately empty. Only coaching cues explicitly supplied by Coach Du are stored; descriptions, equipment, purposes, setup and actual series sequences remain pending review. These records are not independently video-verified. The exact video IDs and URLs are authoritative user-supplied mappings, not proof of playback.

MOB06 Couch Stretch is retained as a separate alternate video pending comparison with MOB02 Kneeling Couch Stretch, preserving the existing demonstration. No existing record is replaced.

Rollback: set active=false only for these batch-tagged codes after checking new prescriptions and reviewed links. Do not delete records or alter programme history. Existing assignments referencing these exercises need coach review before deactivation. This release does not change schemas, authentication, RLS, sessions or permissions.
