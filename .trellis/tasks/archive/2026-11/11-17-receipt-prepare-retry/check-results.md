# Independent review — 2026-11-17

Result: no blocking code, ownership or contract issues found in the task diff.

## Scope checked

- Prepare deduplicates by owner/original hash. Equal normalized variants reuse keys/version; changed pending variants rotate both random keys while preserving receipt ID, original hash, row count and creation time.
- Pending rotation uses encrypted-data plus owner/id/hash/ready/version CAS. Ready duplicates return before changes, and completion remains idempotent for already-ready receipts.
- Pending tickets carry `uploadVersion`; the browser validates and echoes it. Stale/invalid versions fail before storage requests; omission is supported only for pending version1. Midflight rotation still fails through the existing snapshot/version guard.
- Prepare now checks the full saved storage snapshot after asynchronous DNS validation. Complete retains session, full storage snapshot and decrypted receipt data/version checks, including network failures. Ordinary S3 checksum proof and bounded R2 actual-byte SHA256 readback remain intact.
- Error reasons cross the actual `request` helper's error-code boundary through a finite allowlist. User messages contain fixed local text rather than provider messages, signed URLs or object keys. Existing cancellation/obsolete-owner handling remains.
- Docs/specs match these contracts; cache revisions reach the edited app, finance loader and receipt client. No ledger/category/schema/provider changes or remote deletion were added.

## Reviewer changes

Added two behavioral client regressions in `shendu/tests/receipt-client.test.mjs`: malformed upload revisions must prevent every direct PUT/completion, and unknown provider error codes must use the safe fallback without being exposed as `receiptReason` or leaking private text. No production fix was required by this review.

## Verification executed independently

- `npm run check`: passed. The project uses its explicit JavaScript syntax checks; it defines no separate lint/type-check scripts.
- `node --test tests/finance-receipts.test.mjs tests/receipt-client.test.mjs`: 46 passed, 0 failed, 0 skipped.
- `git diff --check`: passed (only Git's normal LF-to-CRLF notice for the client test file).

The targeted suite includes failed same-file retry, both-key rotation, retired R2 objects, legacy and stale tickets, concurrent HEAD success/failure after rotation, storage restore during prepare DNS, account isolation, ready immutability, checksum/content integrity, and safe client messaging.

## Remaining verification boundaries

Root owns the full build/test run, isolated HTTP resource smoke, GitHub publication/native image checks and release retention. These results belong in `verification.md`; they are not claimed by this independent targeted review. Real production R2/browser upload acceptance still requires the updated deployment and actual user screenshot.
