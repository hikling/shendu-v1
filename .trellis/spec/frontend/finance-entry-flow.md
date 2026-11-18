# Finance entry and receipt matching

## 1. Scope

Finance page and daily-review expense widget share the same creation rules. New detailed entry is income-only. Expense text is a plan, and cannot POST until saved screenshots have been matched and explicitly confirmed. Existing ledger editing/refunds, historical rows, APIs and backup formats remain compatible.

## 2. Owners and signatures

- `finance-ui.js`: `mountQuickEntry`, `openDetailed`, `openMatchedExpenses`, `importFiles`, `importPreview` and `write` own the live forms.
- `matchFinanceReceipts(rows,result)` in `finance-receipt-matching.js` returns `{rows,receipts,unmatchedReceiptIds}` without DOM/network or input mutation. Input rows have stable IDs, exact `amountCents`, expression/purpose/category. Result contains saved `receiptIds` and per-image OCR candidates.
- Receipt candidates already carry their own receipt IDs, including an empty-amount fallback for failed OCR. The UI must require `imageStatus==='stored'`; matcher allowlisting alone is not storage proof.

## 3. Contracts

Income opens blank and visibly contains only date, amount/expression, source and note. Its hidden kind is enforced as `income` in POST; hidden category follows source suggestions, with no visible kind/category field or category hint. It never seeds, consumes or clears an expense draft. Existing edit/refund forms keep their kind/category controls.

Quick text supports original decimal arithmetic, line numbers and category correction, but its sole upload button opens file selection only. Both finance and daily widgets omit the duplicate screenshot-entry button. Blank text permits image-only OCR confirmation; valid populated text uses matching, invalid nonempty text preserves input and blocks upload. An unresolved attempted row resumes its exact matching payload instead of starting a new upload. Unique positive integer cents must correspond to exactly one typed row and one saved image before automatic matching. Duplicate OCR detections in one image deduplicate; one image may cover different unique row amounts. Same-amount rows, multiple images for one amount, unknown or mismatched amounts stay manual. Only explicit expense candidates participate; do not infer settlement, subset sums, approximate equality or first-match order.

The matching Dialog keeps user-entered amounts/purpose/categories/date. Checkbox choices associate one or more saved images per row (1–10). Legacy draft receipts remain with the first planned row, and previous attempted images remain available. Unused images require explicit acknowledgment and never create extra entries. Inline preview loads only on request, stays in the same form and has its own per-image read owner. Do not replace the modal or eager-load thumbnails.

Standalone screenshot entry also requires stored images and expense rows; income/refund screenshots use their respective entry points. Recognition-only output cannot create a text-only expense. Income remains text-entry capable. Server API compatibility is deliberate, not a new global receipt requirement on old data/imports.

## 4. Error and retry matrix

- No file, unconfigured/unstored or failed upload: no expense POST; retain original plan.
- Missing match, >10 images or unacknowledged unused image: inline error before POST.
- Cancel matching: no new write; retain planned text and choices in the live workspace.
- Partial success: remove only confirmed physical lines; retain original ID and full attempted payload for uncertain rows. Disable remapping, text editing and clear while a result is unresolved. Retry the same payload. A definitive400 validation rejection may unlock correction;409 or uncertain failure must retain identity.
- Image-only import confirmation follows the same400 boundary: unlock only the current rejected row, discard its frozen attempted payload and preserve already committed rows. All409/network/ambiguous failures retain exact payload and disabled controls; subsequent correction cannot resubmit earlier successful entries. Regressions must submit an actually rejected row and then a corrected retry, not just inspect a template.
- Replaced account/page/modal/reauth: old upload, preview and save responses cannot mutate or close the replacement. Preview guards include exact live form, host visibility and fresh image owner.

## 5. Surfaces

Use existing genuine shadcn controls and scoped finance Dialog layout. `.finance-select-menu` must render above dialog100/overlay95 (finance menu125); a z50 portal appears behind the overlay and cannot receive pointer input. Verify actual option hit-testing, not only programmatic change or DOM presence. Keep mobile field sizing, Songti and explicit focus/reduced-motion conventions.

## 6. Tests

Matcher tests cover exact cents, repeated rows/images, malformed or non-expense OCR, saved-ID allowlist, multi-amount images and immutability. Finance UI tests exercise no-POST text/upload stages, income draft isolation, required matches, manual choices, unused/max10 rules, legacy images, partial retries/definitive validation, stale owners and lazy preview. Review write/wheel tests drive the actual upload+matching confirmation before clearing finance pending state. Browser acceptance covers popup pointer reachability and desktop/390/320 flows; synthetic fixtures are not real-provider or physical Safari tests.

## 7. Wrong / correct

Wrong: attach all batch IDs to every row, assign equal amounts positionally, permit a recognition-only acknowledgment to bypass expense images, or change an uncertain attempted payload.

Correct: require saved images, auto-match only unique exact amounts, expose explicit manual associations, preserve each row's receipt list and retry identity, and retain original entered data until confirmed.
