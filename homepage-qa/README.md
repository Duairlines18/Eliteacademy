# Premium homepage verification

The homepage retains the existing Playfair Display/Inter typography, NCAA trophy
photograph, forest green/gold palette, seven credentials, three original athlete
stories, Soccer/Track pathways, values and partnership form. The four audience
tabs lead to the existing role-specific Hub login routes. The tabs stay in one
horizontal strip on phones; athlete cards support native touch swiping and reuse
the original story photos. Partnership inquiries open in a native, internally
scrolling dialog without moving the page underneath.

Run from the repository root:

```sh
node homepage-qa/homepage.test.cjs
node coach-command/coach-command.test.cjs
node athlete-qa/athlete-sheet.test.cjs
node parent-qa/parent-session.test.cjs
node parent-qa/session-card-polish.test.cjs
node --test supabase/qa/*.test.mjs
npm install --no-save playwright@1.62.1
npx playwright install chromium
node homepage-qa/browser.test.cjs
```

The browser test starts its own local HTTP server and checks 375, 390, 430, 768
and 1440px viewports. It exercises section links, expanding credentials, both
sport routes, all four role-specific login screens, keyboard tabs, each story
modal, and the original partnership form. It also simulates touch swipes, verifies all
three photos load, and checks dialog bounds, page scroll position, Escape,
close-button behavior and focus restoration. It checks for horizontal overflow,
uncaught JavaScript errors and homepage content leaking onto other routes.
`CHROMIUM_EXECUTABLE` supports an already-installed browser.
`HOMEPAGE_BASE_URL` can target the deployed site for the same read-only checks.

The preservation check compares the registration/payment forms, public routing,
Hub application, and other existing scripts against production commit
`af9a65949329a3cd754000d172aa37c5cb1a98ef` byte-for-byte, excluding only the intentionally changed partnership dialog
presentation handler. All consent, validation and submission handlers remain
protected. It separately checks the
original partnership form. No Supabase schemas, functions, payment URLs,
registration logic or role authorization are changed.

These checks do not log into private accounts, submit inquiries, create
registrations, upload athlete videos or make payments. Those live transactions
are outside this homepage change's test coverage. Chromium viewport checks do
not replace testing on physical iOS Safari.

Production automatically deploys through the existing Pages workflow on pushes
to `main`. Recovery references:

- `backup/main-before-homepage-20261015`: main before this work.
- `backup/homepage-original-20261015`: pre-redesign site (`3bd68d1`).

Restore through a reviewed revert or a new commit from the chosen recovery
reference. Do not force-push production history.
