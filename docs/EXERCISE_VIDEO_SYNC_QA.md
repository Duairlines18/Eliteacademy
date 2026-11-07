# Exercise/demo synchronization — staged runtime repair

Reviewed block demos now refresh from the current authorized exercise library even if the movement name was already loaded. Name-bound rows refresh all active exact-name candidates; ambiguity hides the demo rather than selecting the first. Explicit reviewed exerciseCode references resolve by exact code, including after a library rename, without falling back to another movement with the same name. Missing/inactive selections cannot reuse stale loaded definitions. Stored JSON URLs remain non-authoritative.

The patch changes bundle loading/shaping only. It does not rewrite dosage, rest, cues, instruction text, assignments or live database records. A failed refresh surfaces an error rather than silently serving an obsolete demo. This trades availability during a library lookup failure for avoiding a misleading demonstration. Existing clients must reload/revalidate their bundle to receive library changes; this is not a live push to already-open video players.

Nine targeted tests cover current URL replacement, missing/inactive lookup, ambiguous names, exact-code selection with no wrong-name fallback, unrelated movement preservation, code-bound rename and lookup failure. Existing regression suite remains required. Real footage semantics, playback on iPhone, authenticated parent/private/school/admin delivery and production dependency parity remain rollout gates.

Still open: database-generated legacy maps remain name-bound unless explicitly migrated; legacy rename requires a reviewed remap, never a fuzzy runtime substitution. Existing stored video_links URLs are not backfilled, so admin publication preflight may correctly require resaving an old block after library edits. Semantic review of all library videos and automatic database/library history synchronization are not claimed complete. Do not redeploy every Edge Function blindly: retain each live endpoint's existing dependencies/JWT settings and verify its bundle before deployment.

Independent review found that account adjustments could discard renamed code references. Full parent/private adjustment-path and personal-swap regressions reproduced this and now pass. Explicit demo codes are updated with the approved replacement so the original movement cannot remain selected behind a new name.

## Shared publication preflight

The website offline delivery QA and Control Room publication validator now use the same checked-in implementation. Reviewed `exerciseCode` references select one active library entry without name fallback. Name-only legacy references must match exactly one active entry. Saved demo URLs are compared by YouTube video identity, so equivalent watch/Shorts links pass while a different video blocks publication. Preflight only reports issues; it never rewrites stored URLs, prescriptions or library records.

Eleven contract regressions cover duplicate names, invalid explicit codes, equivalent URL formats, wrong video IDs, ambiguous legacy references, input preservation duplicate query parameters duplicate-name library ordering encoded query parameters and ID-only canonical demos. These are synthetic source-level checks; authenticated role views, actual footage review, mobile playback and deployment remain separate gates.
