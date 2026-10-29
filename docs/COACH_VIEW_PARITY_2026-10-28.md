# Coach view parity

Coaches now use the existing Team Command / Full Workout interface from Dashboard,
Current Week and saved training-day URLs at every screen width. Direct URLs open
the requested assigned day. Standalone routines keep their separate screen.

The phone screenshots showed Coach Command while the laptop showed an older Hub
dashboard and the separate session-reference renderer. Current production source
already mounted Coach Command on Dashboard, but Current Week and direct day links
still used the other renderer. This change consolidates those entry points and
versions the component URL so updated HTML requests the matching script.

Production files: `index.html`, `coach-command/coach-command.js`.
Tests and CI: coach unit and route browser tests; routine browser selector updated
for the canonical staff view; homepage isolation and Pages preparation checks
updated for the scoped change; route browser test added to full regression CI.

No database, policy, authentication or programme changes. Sports directors retain
their read-only overview; athletes and parents retain their existing views.

Verification:

- 135 delivery/security/unit regression tests passed.
- Synthetic school HTTP integration passed; 14 Story checks passed.
- Coach route browser: 69 checks at 390, 768 and 1440 pixels, including complete
  copy, print disclosures, demos, cues, back navigation and athlete isolation.
- School identity browser: 551 checks across five widths.
- Routines browser: 78 checks across five role combinations and two widths.
- Homepage browser: 363 assertions across five widths; homepage isolation passed.
- Independent code review: no blocking issues.

Browser fixtures use synthetic authorized records. Actual live Supabase responses
and third-party video playback were not exercised by those fixtures. Existing open
tabs may need a hard refresh to replace their older loaded HTML.

Rollback: revert this release's merge commit and let the existing Pages workflow
redeploy. No data rollback or manual setup is required. The same dependency-free
coach component can be wrapped or ported during a later Next.js migration.
