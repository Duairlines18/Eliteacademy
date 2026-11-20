# Video release readiness follow-up

Status: release preparation verified locally; not deployed. Live role sign-in and actual device playback remain incomplete.

| Endpoint | Captured live version | Gateway JWT verification | Candidate files changed | Existing files preserved |
|---|---:|---|---:|---:|
| hub-data (school/staff) | 12 | false | 2 | 7 |
| parent-hub-data | 8 | true | 3 | 9 |
| private-athlete-hub-data | 12 | true | 3 | 9 |

The repository's shared core includes login-validation changes beyond this video repair. Copying that entire file into every live endpoint would include those changes. Candidate assembly instead retains the original authentication prefix and replaces only shapeBootstrap's video handling, the reviewed-library loader and (for account endpoints) the approved account-adjustment function. Every other deployed file remains byte-identical to its captured baseline. Original gateway JWT flags and entrypoints remain unchanged. Relative imports resolve inside each captured bundle. Hashes are recorded in VIDEO_RELEASE_PARITY_2026-11-07.json.

Local probes imported the three assembled candidates and verified original login validation, exact-code selection, stale-binding rejection, no-demo exclusion and fresh canonical lookup. Parent/private candidates also passed compound-row swap binding checks. This is a local bundle check, not hosted gateway or authenticated delivery proof.

The secure parent sign-in request timed out without a credential result. A fresh verification tab still displayed the Parent Access login form. No password reset, account creation, permission change or authenticated test was performed. The standard ACT02 YouTube watch page loaded its title and 20-second duration, but the media stayed at time=0, readyState=0 with a loading spinner. This environment therefore cannot certify decoded playback or the actual movement footage from that attempt. No real iPhone is attached to this workspace.

Remaining release order:
1. Establish existing QA parent/private/school/staff/admin sessions through the normal sign-in flow and check assigned-week isolation/readback.
2. Complete decoded playback and a real iPhone check; verify the content of the required movement videos.
3. Reconcile the website/Control Room PR stack and capture fresh function/database rollback definitions immediately before rollout. Re-run candidate checks if live versions or source hashes changed.
4. Deploy only the reviewed video changes with the preserved per-endpoint settings, then verify hosted response shape and recipient access again.

The captured JSON is evidence of this inspection, not an instruction to deploy against a stale baseline. No SQL/data changes or hosted deployments occurred in this follow-up.
