# Verification

## Local checks

- `node --test tests/finance-ui.test.mjs tests/overview-reel.test.mjs`:86/86 passed.
- `npm test`:541 total,540 passed,0 failed,1 optional browser OCR smoke skipped. Includes production UI build.
- `npm run check` and `git diff --check`:passed.
- Browser: real production finance assets/modal and extracted real overview record/arc renderer, synthetic records, isolated Chrome. Income/upload verified at1280/390; reel verified at1280/820/390/320 with moving and static reduced-motion states. Four visible income fields, automatic salary payload, single empty upload entry, image-only confirmation, no inner field/document overflow or script errors. Final long-title mobile art spacing rechecked after adjustment.
- Mobile cards200×224px; desktop1280 stays282×276px;820 stays260×276px. Songti styling retained. Physical iPhone Safari, real provider upload and live server deployment were not performed.

Local logs, geometry JSON and screenshots are ignored under local-data/.

## Publication

Pending main synchronization, six-job release verification and four-release retention. No production-server update has been performed.
