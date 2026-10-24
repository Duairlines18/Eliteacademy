# St George's — payment-gated four-week plyometric skills pilot

Prepared 2026-10-24. **Not athlete-facing released.**

## Scope
Two coached sessions per week for six athletes, focused on horizontal-jump plyometric skills (elastic rhythm, single-leg control, landing positions, forward propulsion), with supporting mobility, activation, strength, and trunk control. One optional low-impact recovery/mobility session. **No running, sprinting, acceleration training, tempo or running-capacity work.**

## Verified draft
Supabase programme ID: `9d5f562a-fa5b-44d1-a366-52e14bd3978c`. Four weeks, 12 days, 48 blocks. Each coached day includes a modified mobility/activation warm-up, plyometric prescription, technique/readiness check, supporting strength or tissue work, and two-round timed trunk circuit. No RUN/SPR exercise references remain in draft prescription arrays and no old running block titles remain.

Day 1: two-leg pogos 2x8, single-leg pogos 2x8/leg (regress if needed), Snap Down 3x5, Drop to Hold up to 3x8 (regress to 2x5), plank shoulder taps 2x45s, dead bugs 2x45s. Day 2: two-leg pogos 2x8, forward/backward pogos 2x6 contacts, Snap Down 2x5, Broad Jump + Stick 3x3, Drop to Hold 2x5, same trunk circuit. Quality-first, coach-supervised, 48h between jumping sessions. Do not automatically add contacts week by week.

## Four-week coaching objectives
W1 Learn stable positions and low-level rhythm.
W2 Consolidate quiet landings and single-leg alignment at stable dose.
W3 Apply forward rhythm and approach/takeoff **position skills without running drills**, only where athlete ready.
W4 Reassess control, consistency, symmetry and coach readiness for next block.

## Deployment gate
Before changing live cohort: confirm payment, actual start date and two coached days; verify session fits 60 minutes; confirm individual access credentials and staff/director roles; run live end-to-end browser checks for school and unrelated private/parent views, and verify actual exercise playback. Then publish approved programme weeks using existing controlled publishing, atomically set cohort programme assignment and expected_sessions_per_week=2, leave optional session out of attendance denominator. Confirm readback across roles.

**Preserve** current 10-week-labelled programme (one populated week) in Supabase as fallback/reusable asset. Never delete while assigned. No code or session rotation before coordinated release.

## Known limits
Data readback validates stored references, not actual YouTube playback or 60-minute class feasibility. Staff attendance and user experience still require authenticated browser acceptance tests. Four-week pilot is staged in database, not published or assigned to athletes.
