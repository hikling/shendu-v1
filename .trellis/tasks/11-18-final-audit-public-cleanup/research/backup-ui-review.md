# Backup / scheduling / general UI final review

Reviewed current source on 2026-11-18. Only confirmed defects below; no production data, credentials or external bucket were accessed. Root authorized narrow source fixes after the initial review.

## Fixed findings

### P2 — CLI snapshots did not authenticate finance ciphertext

- Owner: `shendu/scripts/backup-safety.mjs:32`, newly covered table loop at63; both snapshot creation and offline restore use this helper in `scripts/admin-cli.mjs`.
- Before: SQLite integrity/foreign-key checks and authentication covered review/settings/backup credentials, but omitted `finance_entries`, `finance_categories`, `finance_days` and `finance_receipts`. An isolated in-memory DB with an authentic encrypted theme rejected a wrong key yet accepted corrupt `sd1` ciphertext in each finance table.
- Consequence: CLI could create a success-looking backup or restore an authenticated archive containing unreadable financial fields. This is backup integrity/recoverability, not a demonstrated unauthenticated remote exploit.
- Fix: authenticate every present finance table with its actual live owner/identity AAD; receipts include `:data`. Missing finance tables stay compatible with old snapshots. Existing failure message/restore rollback remain intact.
- Regression: `backup-security.test.mjs:190` accepts legacy/no-finance and valid finance, then rejects changed tags, different owners and different IDs for all four tables. Test224 drives actual CLI snapshot and restore with corrupted finance and proves original output/database/key remain byte-identical.

### P2 — personal/external export could produce files its own importer rejected

- Owner: `server.mjs:559` (`createBackupBuffer`), importer limit at665, external common caller1191.
- Before: personal builder compressed without checking expanded48MiB; the direct-download route checked sealed36MiB but external S3/WebDAV backups bypassed that route. Permitted review/ledger/receipt metadata totals can exceed one personal import's limits.
- Reproduction: actual extracted builder+parser with scaled1KiB limit exported a514-byte highly compressible backup successfully, then immediately rejected that same backup as `backup_limit_exceeded` on import.
- Fix: shared builder checks serialized size before gzip/PBKDF and sealed size before returning. Both direct export and external backup now fail with413 / `backup_limit_exceeded` and suggest a server snapshot. External failure records remain governed by existing outcome logic.
- Regression: `backup-security.test.mjs:309` uses the real builder/parser and real external runner. Exact limits export and parse; one-byte over either limit rejects direct creation and both S3/WebDAV uploads before any network call. Valid retry proves failure released the account slot.

## Reviewed surfaces without another confirmed blocker

- Personal current/legacy parsers: authenticated encryption, strict Base64 for current envelope, decompression/file/request limits, owner confirmation, supported five compatibility fixtures, prepared IDs and immutable locked merge behavior.
- `applyBackup` / `applySiteBackup`: validation before transaction, same-owner constraints, finance graph checks, capacity errors and rollback, legacy finance preservation for surviving identity, session invalidation on site restore, original master-key/credential separation.
- CLI: output alias protections, correct key/database authentication, password byte preservation, offline restore and replacement rollback. This does not prove a running application is offline; deployment documentation retains the stopped-app requirement.
- External targets: HTTPS/public-address validation, pinned DNS/IP requests, no implicit redirects, bounded response/abort/error handling, one-account/four-global guards before decryption/serialization, safe credential projections.
- Scheduler: Beijing civil slots, anchors and stale selected-target rejection, expiring claim leases, atomic terminal result/slot, busy retry without consuming slot, ten-calendar-day success/failure history with target/trigger identity.
- Backup/settings/activity/general navigation UI: escaped server strings, read/write/visit ownership, persistent pending dialogs and retry inputs, exact restore mode/password payload, no secret persistence in Web Storage; real back/forward, deep link/current-owner resolution and reduced-motion settings are covered by focused tests.
- Observed missing request-level stale401 predicates in backup calls and sent to auth reviewer, who owns `app.js` and added current predicates across those calls. Do not count that separately as an additional vulnerability here.

## Verification

- `npm run check`:passed after final helper changes. Native JS project has no separate static type-check command.
- `git diff --check -- shendu/scripts/backup-safety.mjs shendu/tests/backup-security.test.mjs shendu/server.mjs`:passed.
- First focused backup/schedule/UI/settings/navigation run:77/77 passed after snapshot fix. Command: `node --test tests/backup-security.test.mjs tests/backup-schedule.test.mjs tests/backup-schedule-api.test.mjs tests/backup-ui.test.mjs tests/backup-target-schedule-ui.test.mjs tests/settings-motion.test.mjs tests/browser-navigation.test.mjs`.
- After final common-builder guard and third new regression: `node --test tests/backup-security.test.mjs`:33/33 passed, no skipped/cancelled/failed tests.
- Root owns final full suite, release and deployment checks. Review was isolated source/helper/API/DOM verification, not real-provider or physical phone acceptance.

Owned edits: `shendu/scripts/backup-safety.mjs`, `shendu/tests/backup-security.test.mjs`, only `createBackupBuffer` within `shendu/server.mjs`, and this report. No commit/push performed.
