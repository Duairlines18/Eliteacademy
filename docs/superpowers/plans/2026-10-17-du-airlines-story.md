# The Du Airlines Story implementation plan

Goal: a separate, mobile-first photographic biography, reviewed before merge or production deployment.
Architecture: buildless `/my-journey/` document with scoped CSS, progressive-enhancement JavaScript and reusable public JSON content. Existing homepage receives navigation links only; Hub, forms, authentication and schema stay untouched.

- [ ] Write and run failing content/privacy/preservation tests.
- [ ] Build source-linked chapters from CRM founder stories and official records. Keep private academic records out of every tracked artifact. Caption undated images honestly.
- [ ] Optimize the ten owner-supplied photographs to responsive WebP. Record provenance and exclude Getty/Alamy/watermarked assets until licensing is documented.
- [ ] Implement accessible interactive results and PB charts, expandable narratives, chapter sharing/copy and print styling. Render all core stories without JavaScript.
- [ ] Run repository regressions and responsive/accessibility checks. Inspect preview and report any unavailable verification honestly.
- [ ] Push only the dedicated branch; create draft PR and reviewable preview. No merge, live-domain change, or production deployment.

Review focus: mobile navigation; chart keyboard/touch operation; no-JS fallback; image crops/weight; no accidental changes to existing homepage or Hub.
