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

Pending GitHub main push, native image build, public download verification and release retention.
