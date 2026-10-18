# Du Airlines Story — review record

Dedicated branch: `feature/du-airlines-story`. No merge or production deployment authorized.

## Implemented

- Separate `/my-journey/` page; original homepage gets desktop/mobile navigation links only.
- Nine chapters and 15 unique owner-supplied photographs, compressed into responsive WebP variants.
- Source-linked results, PB view, dated World Athletics ranking snapshots; indoor/outdoor context is explicit.
- Founder recollections from Airtable, including library/home practice and three years of self-directed on-ground coaching.
- Later appearances identified as Nanjing 2025, Tokyo 2025 and Toruń 2026; the seventh-place 2025 indoor result is the featured world-final milestone.
- Stable chapter anchors, native share, copy text with manual dialog fallback, HTML/JSON chapter content, print rules.
- No private academic data, raw CRM exports, auth changes, Hub changes or database changes.
- No visible Getty/Alamy watermark images identified. NOMA Photography’s signature is retained visibly and credited; photographer licensing should be confirmed for broader commercial redistribution.

## Verified

- Seven story/content/privacy/image/navigation assertions and JavaScript syntax.
- Existing homepage structure and byte-preservation regression (normalizing only the explicitly authorized navigation insertions).
- Independent code review: mobile SVG touch targets and missing dialog name identified and corrected. Image checks also caught and corrected one empty variant.
- Live browser inspection of the GitHub branch through a source preview: 320px frame has 303px content width and 303px scroll width (no page overflow); chart target is 45.47px in both dimensions.
- 1440px frame has 1423px content width and 1423px scroll width (no page overflow).
- Native story expansion, PB/results switching, Enter selection and ArrowRight result navigation verified in the browser.
- Mobile hero and desktop self-coached chapter inspected visually. All 15 image variants verified with Pillow; all core text and source tables remain static HTML without JavaScript.

## Review limitations

No physical iPhone/Safari test. Native OS share sheet and clipboard behavior depend on browser permissions; manual-copy dialog supplies an alternate path. Browser print stylesheet is provided but not visually checked as a PDF. Archive photographs’ exact capture dates are not independently authenticated, and narration/captions identify this where relevant. Founder should review the three-year period and all public narration before approval.

## Published polish — 17 October 2026

Owner explicitly requested polish and deployment. Overview stop 04 and the self-coached chapter now connect three years directing daily training with three later World Championship appearances and seventh at Nanjing 2025. Remote guidance remains acknowledged. All story-page external arrows are inline vector strokes to avoid iOS emoji presentation.

Research: the official World Athletics 2017 U20 list, requested with `ageCategory=u20&bestResultsOnly=true`, returned Mapaya at No. 10 with 16.30m, zero wind, Tlemcen, 1 July 2017. The list includes indoor performances and is labelled a U20 world top list without an outdoor-only claim. Direct HTML retrieved successfully; search index variants without explicit age filters returned senior athletes, so were not used. TCU’s 7 June 2022 NCAA preview explicitly reports No. 7 in the world. Both sources are linked in public cards. Annual lists and reported positions remain distinct from the 2025/2026 points-ranking snapshots.
