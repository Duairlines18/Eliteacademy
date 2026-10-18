# The Du Airlines Story

Standalone buildless page at `/my-journey/`. All narrative and result fallback content is server-independent HTML. Chart and sharing enhance it in `story.js`. Styles do not load on the homepage or Hub.

## Edit and reuse

Edit public copy, official sources, performances and dated ranking snapshots in `build_story.py`, then run `python my-journey/build_story.py`. It regenerates `story.json` and `index.html`. Do not edit their shared content separately. `story.json` provides reusable chapter IDs, headlines, summaries, extended narration and source IDs for sponsorship decks, social posts and documentary outlines. Chapter links are stable; sharing and copy-text work in the page. Print styling supports browser print/export.

Use `photos.json` for provenance and image metadata. Supply 480/960/1440 WebP variants and descriptive alt text. Keep undated image captions honest: image capture dates and events have not been independently authenticated. The same image can illustrate a chapter without proving its date. Hero repeats the TCU portrait; fifteen unique supplied images are present.

## Photo rights gate

The original ten supplied files were visually inspected; no visible Getty Images or Alamy watermarks were found. The founder supplied them as originals for this task. Photographer credit should be added when provided. This is not an independent copyright-chain audit.

Any future Getty Images, Alamy, watermarked or otherwise restricted image must be marked `publishAllowed: false` and excluded from HTML, share assets and GitHub/public previews until an appropriate license is documented. Never remove a watermark. Do not commit restricted originals into this public repository. Keep any license paperwork outside public assets.

The five later images are included too. The NOMA Photography image retains its visible photographer credit and a matching caption. Confirm broader sponsorship/third-party redistribution rights with that photographer.

## Sources and dates

The page separates official results, dated world-ranking snapshots, historical interview quotations, and founder recollections. Rankings #20 and #19 are the positions printed in official documents dated 16 September 2025 and 20 March 2026; they are not current rankings or event placings. The results chart contains selected meet results, not season bests. The PB filter contains selected outdoor breakthroughs, not an exhaustive PB chronology. No unverified school marks are charted.

Only one 17-word quotation is used from the TCU Magazine interview. The TCU article has an indoor-mark inconsistency (16.96 versus the official TCU bio's 16.95); that result is intentionally not plotted or repeated. The 2022 final took place 10 June; the report was published 11 June. Olympic 2028 language is explicitly aspirational.

The self-coached chapter uses the founder’s three-year recollection and separately identifies the three later documented appearances: Nanjing 2025, Tokyo 2025 and Toruń 2026.

No academic records or raw CRM extracts are included. Do not copy the private career archive wholesale into this repository.

## Checks and release

- `node --test my-journey/story.test.cjs`
- `node --check my-journey/story.js`
- `node homepage-qa/homepage.test.cjs`
- Existing public-page browser regression: `node homepage-qa/browser.test.cjs` using the project’s Playwright environment.

Branch only: `feature/du-airlines-story`. Approval is required before merge or production deployment. No data migrations or Hub changes are required.
