# Plain-English exercise guidance

This rollout updates the description and coaching cues for 85 existing exercises. The library's exercise codes, demonstration links and programme prescriptions are preserved. Each entry has short instructions, one spoken cue and a mistake to watch for. The seven series flagged in the prior audit still ask users to confirm the sequence with Coach Du. Their existing review notes are preserved.

## Release and rollback

After separate release approval, deploy the reviewed Hub changes and run `apply.sql` as a single transaction. The Hub can show both the previous and the revised wording. The SQL requires the exact prior content and video mapping, accepts a retry and aborts if it detects a conflicting edit. Verify the displayed instructions on a school coach workout and a parent-managed workout following the release.

Run `rollback.sql` to restore the prior text and revert the frontend commit if needed. Rollback aborts if any affected library text changed after release. The JSON file records the reviewable before and after values.
