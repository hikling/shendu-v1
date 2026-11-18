# Independent final integration review

Read-only cross-review of the complete current production diff on2026-11-18: server.mjs, scripts/backup-safety.mjs, scripts/update.sh, public/app.js, finance-ui.js and index.html. Reviewed their new regressions and their live parser/client contracts. No additional confirmed blocker found; no production or test edits made during this pass.

## Verified boundaries

- Updater validates the exact canonical repository origins before lock creation, snapshots, fetch or Docker. Its accepted forms match the installer convention. The new wrong-origin scenario asserts absence of all three side effects, original .env bytes and no stale lock, rather than only matching error copy.
- Snapshot authentication now visits all four optional finance tables. The exact AAD is consistent with live encryption: finance-entry:user:id, finance-category:user:id, finance-day:user:date and finance-receipt:user:id:data, with the shared shendu:data:v1 prefix. Legacy snapshots lacking those tables remain accepted. Tests independently tamper tags, owners and identities and exercise CLI creation/restoration failure with byte-preserved original output/database/key.
- The common account backup builder checks serialized expanded bytes against48MiB before compression/KDF and complete sealed bytes against36MiB before returning. These are the same constants used by gunzip maxOutputLength and personal-file validation. The resulting JSON text stays within the48MiB request cap, since its36MiB ASCII file content requires only small envelope quoting overhead. All manual/external paths call this common builder; external owner slots release in finally. The bounded regression verifies exact inclusive limits, both limit-1 failures, both WebDAV/S3 no-upload behavior and a subsequent valid retry. It exercises production builder/parser/external functions with reduced limits, while existing API tests cover real endpoints and encryption.
- Completion reads the body before selecting the row and revalidates the current session for both JSON and legacy bodyless requests. Current clients pass the exact saved record version; optional-version legacy compatibility remains deliberate. Invalid/stale versions cannot mutate or log. Owner/status/version remain in the final UPDATE; withActivity already suppresses events when changes is0. The real HTTP tests cover all six review types, stale/invalid versions, owner/non-UUID/locked boundaries and slow-body logout.
- PUT now accepts the existing stored-ID contract only for an already-owned row; missing IDs still404, so old non-UUID records are writable without creating client-chosen IDs or reviving deleted drafts. SQL remains parameterized.
- Frontend owner closures are passed through to request's401 check, not just used after await. They are lexical closures, so passing task.current without binding is valid. Backup, verification/statistics, settings, account/admin/activity paths preserve their existing active response handling. Actual-request regressions verify both obsolete401 suppression and valid current reauthentication.
- Completion conflict refresh updates cached records while preserving the exact reviewed editor/record and current account ownership; it does not silently lock or replace the newly edited remote content. Returned saved versions are used after save-before-complete. Existing pending/write-finally guards remain in place.
- Finance400 correction fix preserves earlier successes and uncertain payloads. New app and finance import cache versions match index.html; no shared module schema/path mismatch introduced.

## Checks rerun in this pass

- `npm run check`:passed; this project has no separate TypeScript static-check command.
- `git diff --check`:passed (only existing CRLF conversion notices).
- `node --test tests/review-write-ui.test.mjs tests/verification-ui.test.mjs tests/backup-ui.test.mjs`:**34/34 passed**, including actual401 handlers and new completion conflict/version assertions.

Root owns the full suite, Linux installation scenarios, dependencies, dual-architecture publication, final repository untracking/hash proof and release retention. This review does not certify real-provider credentials, physical devices, production state or absence of every possible vulnerability.
