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
- GitHub: main work commit `fa5d071651d04e2388aeeaceeb19a7aa23c95a60`, application tree `65dc2a7ce7759548e2c2d7bb52c091a533285c90`. [Run44073115330](https://github.com/hikling/shendu-v1/actions/runs/44073115330) succeeded: handover, amd64 verify, arm64 verify, publish and both download-smoke jobs all green.
- Release retention: audited plan/apply retained four complete releases including this application tree; removed only release447923571 (`deploy-9a1fa025561a476579a4dff1f4baa0121c415438`). All Git tags preserved.
- Test preview server and isolated Chrome closed. No deployment or live account/storage mutation performed; server update remains separate.
