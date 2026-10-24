# St George's weekly delivery and attendance

Approved direction: six existing identities; four-week pilot; two coached sessions and an optional home session. Coach can record attendance on the day, at week end, or reconcile an earlier week. No daily login requirement. One shared record powers daily and weekly editing. Unknown is not absent. Offline-first synchronization is not required: reconciliation when connected is sufficient, and failed saves must stay visibly unsaved.

Use one minimal attendance table. A unique athlete/cohort/programme/week/session key prevents duplicate daily/weekly records. Store actual session date, status, named recorder and modification time. Only active named coaches assigned to that cohort can write; director reads the same cohort data only; athletes and legacy shared codes cannot access the register. No new role grants or unrelated private data.

Coach: week selector, two actual date inputs, six roster rows with two attendance choices, one Save changes button. Week range follows programme duration. Review current or earlier week without changing the active training week. Absent/excused must be explicit. Save only changes, retain edits on network failure, no saved claim before server acknowledgement. Browser identity change invalidates pending responses.

Director: clear week of four, purpose, two coached/one optional schedule, cohort attendance summary, per-athlete recorded participation, unrecorded state and optional-session exclusion. Read-only and minimal roster. Do not present workout ticks or website visits as attendance.

Use existing dark/gold/green tokens for roster, editor and director. Preserve inline demos, routines, copy, feedback, private/parent screens and homepage.

Programme: retain original ten-week history. Prepare existing four-week draft with 2+1 sessions per week and existing approved exercise references. Stage Day1 Snap Down/Two-Leg Pogos/Broad Jump + Stick/Jump Squat + Stick and Day2 Snap Down/Two-Leg Pogos/Forward-Backward Pogos/Broad Jump + Stick as a technique menu awaiting final dosage review. No invented week-over-week load increase, no unapproved publication. Official start date remains null. Pilot assignment switch and expected coached count=2 happen together only after review.

Alternatives: browser-only attendance fails cross-device sharing; feedback blobs make reconciliation ambiguous. A single protected table is the smallest reliable option. Full offline sync adds unnecessary conflict-handling complexity; delayed reconciliation meets the coach's need.
