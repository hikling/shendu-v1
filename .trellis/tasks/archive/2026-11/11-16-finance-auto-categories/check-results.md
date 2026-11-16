# Final code review — 2026-11-16

Reviewed task PRD/design/implementation, frontend component/data/UI contracts and backend finance contracts against the complete task diff. No browser was available; no browser or alternate automation was attempted.

## Fixed findings

- `shendu/public/finance-ui.js`: transferring a recognized automatic quick-entry row into detailed entry treated its category as a manual lock. Added explicit seeded automatic/manual ownership so editing the purpose updates automatic classification while preserving chosen corrections. Added a real component-form regression.
- `shendu/public/finance-ui.js`: editing an older explicit `uncategorized` entry rendered an empty automatic selection and could silently reclassify a mere amount correction. Preserve explicit legacy categories during edits and explicit corrections transferred from quick entry; regression checks the exact PUT category.
- `shendu/public/finance-ui.js`: detail/OCR automatic selection text could retain the original unknown purpose after editing it. Those options now use a neutral automatic label, while the live hint shows the current resolved purpose. Quick-entry previews remain current because they are rebuilt from each parsed input.
- `shendu/finance-ledger.mjs`: deterministic category IDs derived from private purpose text permitted dictionary guessing against plaintext IDs even though names were encrypted. After parent approval, switched new fallback categories to random server UUIDs, reusing exact owned decrypted names. The entry transaction passes its candidate ID to the final category insertion, without accepting arbitrary client IDs. Existing retry, rollback and backup checks pass; same-name categories across accounts now assert distinct IDs.
- `shendu/public/finance-domain.js`: stored overrides of built-in categories could hide newly added built-in keyword synonyms. Augment active built-in IDs with their maintained default synonyms while preserving custom names/keywords and longest/exact matching. Regression checks that an existing renamed food category still recognizes 聚餐.

## Full-scope checks

- Confirmation is the only category write path; reads, typing, OCR candidates and review draft saves do not create category rows. Invalid receipts/refunds and forced entry insertion failures leave no orphan category. Existing current-account encryption/ownership and transaction boundaries remain.
- Missing category IDs in imports still fail graph validation; the live automatic resolution does not bypass imported category ownership. Existing categories, long160-character fallback names, signed refund summaries and encrypted backup/restore are covered.
- Automatic category count is bounded by the ledger entry cap plus built-ins instead of the old100 limit. Existing name lists remain bounded; very large selector lists may warrant a later product/performance redesign, but no new unbounded query or API is introduced here.
- Quick/detail/import forms preserve explicit manual corrections and pending/partial retry owners. Private receipt preview requests stay account-owned, signed and short-lived; visible count links and thumbnails open the existing guarded viewer. Upload feedback accurately says confirmation is still required.
- The removed category manager has no remaining UI handler. The month-label removal retains the accessible existing month picker. Detailed layout is scoped to its dialog and keeps actual shadcn control owners. Docker's builder already copies the shared `public/finance-domain.js` dependency; no missing build input found.

## Verification

- `npm run check`: PASS (configured native JavaScript syntax gate).
- `npm test`, including production Vite/React build: PASS.470 discovered,469 passed,0 failed,1 expected existing opt-in real-Chrome strict-CSP OCR smoke skipped.
- `git diff --check`: PASS; normal Git newline notices only.
- No separate TypeScript/ESLint configuration exists; the JSX production build and configured syntax gate passed.
- Logs: ignored task `local-data/full-tests.log` and `local-data/final-check.log`.

## Remaining limits

No blocking code issue remains from this review. Final desktop/mobile visual appearance is not browser-verified because browser tools are unavailable; automated DOM/component assertions do not replace that. Parent owns final HTTP resource smoke, handover result, docs/cache synchronization, commit and GitHub publication.
