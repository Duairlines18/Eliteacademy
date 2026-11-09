# Plain-language workout delivery

Approved scope: preserve prescribed workout order in every Hub role; show coach conditions without opening a disclosure; explain existing doses and training terms in plain English. Preserve all training numbers, permissions, existing UI layout and programme history. Do not invent missing rest times.

Implementation: add optional source-row order metadata in the shared Supabase response and consume it in the shared frontend normalizer. Keep legacy content working when metadata is absent. Reuse hub-delivery/delivery.js for plain-English helpers. Keep canonical exercise names and the original numerical prescription visible. Display row cues/avoid notes openly; keep longer movement descriptions inside Technique tips.

Validation: failing regression tests for interleaved instructions/exercises and visible safety notes, plain-language unit tests, full delivery regression, then fixture-based mobile/desktop visual inspection. Deploy compatible backend metadata before the frontend. Existing programme content stays unchanged.

Release: feature branch and reviewed PR, CI before merge and existing GitHub Pages deployment. Rollback frontend by reverting this commit; response metadata is additive and can remain safely in older clients.
