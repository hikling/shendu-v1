# Verification — 2026-11-17

## Local evidence

- `npm run check`: passed.
- `npm test` including build: 505 discovered, 504 passed, 0 failed, 1 optional Chrome OCR smoke skipped. The two independent reviewer client regressions are included in this run.
- Independent receipt service/client tests: 46/46 passed (root's earlier targeted run: 44/44 before reviewer additions).
- Compact handover Python suite: 13 passed during this task.
- Isolated HTTP smoke: health, HTML, JS/CSS MIME, actual built shadcn bridge, finance modules and every packaged OCR asset passed. Temporary data and generated test key only; the owned server process was stopped.
- `git diff --check`: passed.
- Cache revision: app, finance-ui, dynamic receipt-client imports and HTML references all use finance10.

## Behavior checked

Same original hash with changed compressed content rotates both pending object keys and increments the existing row version. Identical variants reuse the pending row and revision. Missing/invalid/stale completion versions reject before storage access (only legacy pending v1 permits missing version). Retired R2 objects cannot stand in for current objects. Verification interrupted by rotation fails on both provider success and failure. Ready records stay immutable/idempotent. Ordinary S3 checksum and R2 bounded actual-byte verification remain enforced. UUID collisions and storage snapshot races remain isolated. Client forwards the version and displays only allowlisted safe error reasons.

## Limits

No real browser upload or user's Cloudflare R2 account was exercised. Local mocks verify protocol behavior; they do not prove the deployed website has been updated or that its CORS/network permissions work. No production data/configuration or external image objects were modified.

## Publication

- Work commit `ab50264132a47e2af763ad0ee289a535a51309e8` pushed to GitHub main.
- Application tree `9e8bb5568882d3e7546d57afb39afca60ca368fb`.
- GitHub Actions run <https://github.com/hikling/shendu-v1/actions/runs/43992498513>: completed/success. Handover, native amd64/arm64 verification, publication and both real public-download/container/Compose/backup checks succeeded.
- Release `deploy-9e8bb5568882d3e7546d57afb39afca60ca368fb` contains both architecture images and checksums.
- Audited retention Plan/Apply verified exactly four complete Releases remain: current tree, `cbe2bcb8a636c6e83978c08cdefa8e7cee57649f`, `07df282547cbc7798eef0a245c5acedf3f630223`, `a4daa76eb80b5ff47acfa5dfd6a977747d582a23`.
- Removed only obsolete Release `deploy-57afccc908e62fa9dbbdc04b012b2772a474269a`; all Git tags were preserved.
- No update command was executed against the user's production server. Updating and real browser/R2 acceptance remain external to these checks.
