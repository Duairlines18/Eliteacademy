# Homepage refinement — approved principal implementation brief

## Governing decision
Preserve the existing production visual system. Do not redesign or replace it with the standalone HTML prototypes. The existing original trophy photograph, actual serif/italic fonts, premium green/gold textures, existing athlete story cards, all seven credentials, and Trust/Composure/Gratitude/Execute are authoritative.

## Interactive structure
- Hero: retain original image, concise holistic athletic-development positioning (strength, speed, power, movement, technical expertise), and one relevant exploration CTA.
- Credibility: preserve all seven original statistics and wording; compact spacing, not deletion.
- Single audience selector: Athletes & Parents / Schools & Clubs / In-Person Clinics. Show one relevant short panel at a time; avoid repeating identical pitches below.
- Clinics: drill into existing Soccer and Track & Field pathways and existing offerings; in-person only.
- Hub: one concise visual audience switcher (Athlete / Parent / Coach or School) with verified real Hub views or accurate representations, and no implication that it is merely remote coaching.
- CTA: connect to EXISTING functioning registration, inquiry and partnership pathways; preserve existing member access discreetly.
- Athlete results: keep current real stories, progress metrics, quotations and expandable story behavior.
- Closing: one consultative registration/partnership invitation; avoid repeated sections and duplicate buttons.

## Guardrails
- NO stock photos, fake screenshots, new design fonts, new brand colors, generic SaaS language, invented scarcity, invented testimonials or new registration systems.
- No changes to Hub data, Supabase, auth, payments, video submissions, coach assignments or workout programs.
- No merge or deployment without confirming exact source files, existing route targets and mobile QA.

## QA acceptance
1. Mobile 375px and 430px: hero photo legible, original typography intact, no horizontal overflow.
2. All seven credentials present exactly.
3. Athlete/School/Clinic navigation is usable with touch and keyboard.
4. Existing Soccer/Track pages and every registration/payment link remain functional.
5. Hub previews accurate to actual user roles.
6. No duplicate commercial copy blocks; each section has a unique purpose.
7. Main branch and live deployment untouched pending review.

## Implementation note
The GitHub repository currently exposes a README and an empty root index.html through the available file interface. Before modifying production UI, identify the actual deployed source entrypoint and CSS. Do not replace an empty index.html with an unrelated new website.