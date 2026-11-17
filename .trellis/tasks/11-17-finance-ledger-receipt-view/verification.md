# Verification

- `npm run check`: passed.
- `npm test`: build passed; 520 tests, 519 passed, 0 failures, 1 optional browser OCR smoke skipped. Domain/API regression 34/34 separately passed.
- Finance UI and actual app overlay suites: 66/66 passed. Final full suite includes both.
- `git diff --check`: passed.
- Isolated headless Chrome with real production public assets, shadcn rendering, extracted actual app overlay owners and synthetic ledger data: desktop1280, mobile390 and320. No horizontal overflow; link/edit/refund/delete all14.4px and identical footer bottom coordinates. No category filter, list images or image reads before clicking. Larger purpose/capsules visually inspected from captured desktop/mobile screens.
- Receipt preview: exact clicked entry purpose/kind/category/amount/date, no legacy decoration, background inert; previous/next gallery and shared receipt with distinct entry context verified. Stale read/image events, close/reauth and retry ownership covered by behavioral tests. No live customer receipts or storage credentials used; actual provider image delivery is outside this synthetic browser fixture.
- Expanded keyword coverage and generic-shopping priority verified across line parsing, preview, OCR draft and real API writes. Existing empty-keyword purpose-name exact/substring matches no longer mask concrete built-in intent; explicit/manual/configured-keyword categories and saved historical rows remain valid. Unknown-purpose reuse verified.
- Initial full suite exposed a stale unknown-purpose test fixture (`文具` is now intentionally recognized); changed only that fixture to unknown `装裱`, preserving retry identity assertions. Final suite above is green.
- Compatibility limit: a successful pre-upgrade automatic write with lost response may safely return409 when retried after category-rule changes; no duplicate or historical overwrite. The existing cross-version create-hash contract was not redesigned.
- GitHub synchronization/release: pending final publish verification.
