# Verification

## Implemented scope

- Independent encrypted CNY ledger; exact cent arithmetic, category suggestions/custom categories, income/refund/transfer, optimistic writes, stable retry IDs and recoverable deletion.
- Finance desktop/mobile route and shared daily widget after energy, preserving old saved question sequences. Confirmed entries survive draft deletion. Locked reviews use a server-captured historical summary.
- Local Chinese/English OCR, explicit editable confirmation, duplicate review, cancellation and lazy private image previews. Browser compresses readable image/thumbnail; originals never upload. No cloud OCR or public image hosting.
- Private S3 configuration or reuse of an owned backup target, scoped signed URLs, real checksum verification and owner-scoped document policy. Encrypted personal/site backups include metadata and explain external-image dependency.
- Existing approved budget illustration reused unchanged; new finance styling follows the warm paper/Songti UI.

## Independent review corrections

- S3 digest verification now checks actual checksum responses rather than trusting custom metadata. Config/session/receipt identity is rechecked after network awaits.
- Backup restore validates the resulting merged receipt graph and preserves deletion history. Finance completion size rejection rolls back business/event changes.
- OCR initialization is serialized through cancellation, stale processing is ignored, duplicate candidates start unchecked, image failures offer retry, and full-image results belong to their exact modal.
- Finance surface ownership uses stable account ID plus mounted surface, preserving interaction after an accepted same-account version-conflict refresh while rejecting replacement accounts.
- Direct completion of a legacy daily draft without a persisted template snapshot keeps finance disabled, preserving the established ordinary-question fallback.
- Manual multi-entry shares editable confirmation and stable retry IDs with OCR preview; search waits for Chinese composition and can be cleared without replacing the draft.
- Refund-only and mixed-sign charts retain negative net expense/category values with signed text, patterned refund bars and exact daily values. Zero is not drawn as a positive minimum bar. Obsolete account surfaces cannot open batch dialogs.

## Local checks

Final integration checks on2026-11-16: `npm run check` passed; `npm test` built the production resources and finished with **426 passed,0 failed,1 optional browser test skipped** (427 tests,47.36s). The27 finance DOM tests include manual batch/IME/clear, signed charts and stale-account guards. Publish evidence is added after GitHub verification.

- Production dependency audit against the official npm registry: zero known vulnerabilities.
- Handover packaging regression tests: 13 passed.
- Isolated HTTP smoke: health schema9, HTML, finance modules, built component resources and every packaged OCR asset HEAD length passed.
- Real local OCR runtime loads both packaged Chinese/English models with cache disabled and recognizes synthetic `23.00`; engine worker is terminated afterward.

## Acceptance limits

- No production data or credentials used. Actual user S3 endpoint/CORS/checksum compatibility, latency and compression readability on real screenshots remain untested. Configuration belongs in the application, not chat.
- Browser visual/mobile acceptance was unavailable. Optional browser OCR smoke is opt-in and skipped by normal automation; the attempted isolated Windows Chrome session failed before OCR because its GPU subprocess could not start. Node OCR verification does not substitute for browser visual acceptance.
- Image bytes remain in external S3; encrypted app backups contain indices/configuration, not image bodies. Original images are not retained. Ordinary screenshot size targets are goals, not a fixed ratio for long screenshots.
- OCR resources are self-hosted from pinned packages. Package metadata, engine licenses and bundled worker notices ship with the resources; the upstream trained-data Apache-2.0 source is identified in NOTICE.
