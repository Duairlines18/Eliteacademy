# Performance Journey

Approved in conversation on 17 October 2026: implement for private athletes, linked parents including Andria, and school/club coach and athlete pathways.

## Experience
Use existing Hub tokens (#090909 background, #111111 panels, #171717 raised panels, #6e1726 maroon, #c7a25a gold, #f5f1e8 text, #aaa69f muted). A compact illustrated vertical path speaks directly to the athlete: starting point, current building focus, next direction. Group viewers get the same programme story in group language. A details disclosure contains week-by-week source objectives and evidence labels. No invented scores or automatic training progression.

## Data and access
New independent Edge Function validates existing JWT or shared cohort sessions without modifying existing authentication. Parents can select only linked children; private athletes only their own assignment; staff drill-down is restricted to active athletes in their session cohort. Shared athlete codes expose group programme information only, without identities, individual feedback or health information.

Source resolution follows published verified programme weeks up to the assigned current week, never upcoming weeks. Direct assignment takes precedence for private athletes; parent pathway follows the existing cohort assignment. Cohort tiers must match. Active cohort/athlete overrides are surfaced in summary evidence; raw notes and unreviewed CRM content never reach public viewers. CRM continuity is imported as reviewed, audience-safe direction, with record provenance; live Airtable credentials are not assumed.

## Updates
Live source refreshes when the portal opens. Service-only snapshots capture the current programme story immediately and then when 14 days have elapsed; an assignment change starts a new snapshot series. A daily database job refreshes due snapshots without exposing credentials. Earlier training weeks remain visible in the source timeline; snapshots begin at rollout and are not retrospectively fabricated. Missing check-ins remain unknown; item checks do not imply fully completed sessions. Group check-in counts are scoped to the reporting period and distinguish roster-linked coverage from shared submissions.

## Verification and rollout
Unit-test copy classification, no fabricated progress, XSS escaping, identity/role isolation, empty history and one-week programmes. Browser-test mobile and desktop, athlete/parent/group paths, history details, contrast and host style isolation. Run existing repository regression tests. Additive database objects use RLS with no anon/authenticated grants; only authorized Edge Function responses expose summaries. Deploy backend before frontend, verify populated source/snapshots and authentication rejection, then confirm the Pages deployment and live assets. Rollback removes the script hook and unschedules the new job; existing training and video flows are unchanged.
