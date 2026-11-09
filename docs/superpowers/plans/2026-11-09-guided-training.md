# Guided training implementation plan

Goal: deliver the approved #96/#97 scope with existing rendering, authorization and completion storage.

Architecture: retain every original training day, block, prescription and completion key. Add two independently persisted routine days to each of the two isolated volleyball programmes only after release gates pass. Explicit preparation references hide the superseded warm-up in the current view after normalization, so main-workout keys do not shift. Private athletes use the existing parent guided renderer. No schema or authentication changes.

Tech stack: existing static HTML/JavaScript, Supabase response shaping, transactional PostgreSQL data preparation.

Spec: user-authorized DU AIRLINES — GUIDED TRAINING FINAL IMPLEMENTATION; issues #96 and #97. Latest approved routine doses from #96 comment 6733560793: WU01/WU06/WU07 1×8 per side/leg; WU05 1×5/side; WU03 1×6/leg; SPR01 2×15m; PLY03 2×10. Do not invent missing rest. The published main sessions take precedence over older drafts.

Constraints: no paid services, migrations, added injury loading, changes to genuine assignments, or deletion of historical data. Demo programmes already mirror live athletes with independent IDs; retain them. Do not deploy until hosted identity/isolation, decoded video accuracy, backup/restore and required regression gates pass.

Review focus: missing or foreign routine references fail closed; main keys remain stable; a preparation routine must never become a training day; failed saves must not show success; Ano's programme receives no standing warm-up.

- [x] Test private guided rendering, preparation references, key preservation and routine navigation before implementation.
- [x] Enable guided rendering for private athletes through the current account renderer; add preparation navigation, completion/feedback handoff and single-set rest presentation.
- [x] Shape only same-week validated preparation references; prepare a transactional, rollback-by-default data script for Andria and parent demo with drift and history guards.
- [ ] Run full regressions, browser checks at 390/1440px, response shaping tests, and Control Room tests. Inspect live assignments, videos and access.
- [ ] Review the final diff. Commit and open a draft PR if hosted release gates remain blocked; otherwise deploy through existing publishers and verify live accounts.

Ledger: baseline 183 tests passed on main 20a08f6. Both demo content hashes match their athletes, with independent programme/week/day IDs. Live browser has no Hub session. WU01 player remains at 0:00, readyState 0 after Play; decoded movement playback unverified. No production writes authorized until integrity gates pass; continue implementation and fixture verification.
