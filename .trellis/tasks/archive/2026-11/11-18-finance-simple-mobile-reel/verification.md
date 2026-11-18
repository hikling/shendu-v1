# Verification

## Local checks

- `node --test tests/finance-ui.test.mjs tests/overview-reel.test.mjs`:86/86 passed.
- `npm test`:541 total,540 passed,0 failed,1 optional browser OCR smoke skipped. Includes production UI build.
- `npm run check` and `git diff --check`:passed.
- Handover packaging regression:13/13 passed.
- Browser: real production finance assets/modal and extracted real overview record/arc renderer, synthetic records, isolated Chrome. Income/upload verified at1280/390; reel verified at1280/820/390/320 with moving and static reduced-motion states. Four visible income fields, automatic salary payload, single empty upload entry, image-only confirmation, no inner field/document overflow or script errors. Final long-title mobile art spacing rechecked after adjustment.
- Mobile cards200×224px; desktop1280 stays282×276px;820 stays260×276px. Songti styling retained. Physical iPhone Safari, real provider upload and live server deployment were not performed.

Local logs, geometry JSON and screenshots are ignored under local-data/.

## Publication

- Work commit: `e7145be8aeedd8476964bdff2f09f0f4f2bed316`, synchronized to GitHub main.
- Immutable application tree: `d64c49b180ee98b9e174dbbb658615394437b00e`.
- [GitHub run44224159585](https://github.com/hikling/shendu-v1/actions/runs/44224159585): all six jobs succeeded, including both native architecture checks, handover, publish and both release-download smoke checks.
- Verified four complete Releases remain: current tree,4663fd7456d602c78f2d3370d24ac06ac707e594,a8edf4cef0b31a11782f59ffde4ab443c209861e,65dc2a7ce7759548e2c2d7bb52c091a533285c90. Deleted only obsolete Release448291555 (`deploy-cb852c7fd4ba294fb84a2a76568af94031456933`); all Git tags preserved.
- Temporary preview server and isolated QA browser closed. No production-server update has been performed; the server must update and the page refresh to use this release.
