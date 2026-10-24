# St George’s four-week pilot — release status

Updated 2026-10-24. Supabase is the source of truth for assignments and programme content; Airtable is the operational CRM.

## Current state
- Six existing athlete placeholders remain linked to their original identities and individual codes.
- Coach Dube has coaching access; Mr Chivandire has read-only Sports Director access.
- Four-week plyometric-skills pilot: two coached sessions weekly and one optional recovery day.
- Week 1 is published and assigned. Weeks 2–4 remain unreleased drafts.
- The four-week learning roadmap supports later preparation toward February.
- The prior 10-week-labelled programme remains stored as a fallback.
- Payment receipt, official start date, training timetable and final athlete details remain unconfirmed. Publishing Week 1 for owner testing does not confirm payment or authorize school distribution.

## Website release
PR #65 merged as `4fa44f499408afd3c8e28608538dd14a3ba9bf31`; its four QA workflows and Pages deployment passed. A follow-up release repairs coach copy demonstration links and complete warm-up printing, and expands school browser acceptance coverage to 375, 390, 430, 768 and 1440 pixels. No database or credential changes are required.

## Acceptance boundaries
Synthetic browser fixtures verify identity isolation, completion persistence, cues, canonical video targets, copy, print expansion and attendance reconciliation. They do not prove production credential login, actual YouTube playback, printer hardware output or practical one-hour class delivery. Coach Du must test the privately held codes and approve distribution after onboarding details are confirmed.

## Website-only rollback
For the follow-up release, create a rollback branch from current main, run `git revert -m 1 FOLLOW_UP_MERGE_SHA`, open a PR, pass release checks and merge normally. The previous website is the PR #65 merge above.

To restore the version before PR #65 as well, revert the follow-up merge first, then run `git revert -m 1 4fa44f499408afd3c8e28608538dd14a3ba9bf31` on the rollback branch; the resulting website returns to baseline `40300753c11dc48786fe9781e94892bf35bf1395`. Allow the normal Pages pipeline to finish and verify the served assets. Do not run Supabase rollback SQL, delete programmes, recreate athletes or rotate codes for a website rollback.
