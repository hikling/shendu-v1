# Backup security review

## Coverage

- `server.mjs`: all helpers from `exportPayload` through `saveBackupOutcome`, including personal v4/v3/v2, legacy stream-v2 and encrypted-v1 parsing; metadata/owner checks; preview/merge/replace; account caps; site export/parse/validate/restore; target config; DNS/IP filtering; TLS pinning, signing, upload/readback and scheduled-result persistence.
- `scripts/admin-cli.mjs`: snapshot/migration sealing, restore decryption, SQLite/key validation, session invalidation, replacement/rollback, filesystem output paths.
- `scripts/backup-safety.mjs`: canonical Base64, atomic key/file writes, SQLite integrity/foreign keys and authentication of encrypted record/settings/credential fields.
- `tests/backup-security.test.mjs` and fixtures: reviewed success/negative tests and five format compatibility fixtures. Root separately owns API routes/auth/body/upload removal; deployment reviewer owns shell backup wrapper.

## Confirmed findings and changes

### Remote response error could terminate the Node server

`pinnedHttpsRequest` listened to request errors but not response-stream errors/aborts. An external WebDAV/S3 peer disconnecting after headers could emit an unhandled `IncomingMessage` error; a response error after request close could also leave the promise unsettled. Added response `error` and `aborted` listeners that directly reject the operation and destroy the request. Existing bounded response size, TLS validation, pinned DNS and 30-second deadline remain intact. Regression exercises error, abort, oversized response, error after request close, and successful response without network access.

### CLI backup output could overwrite live SQLite sidecar files or protected files through directory aliases

The old output guard compared only lexical DB/key/password paths. It allowed writing a snapshot to `shendu.db-wal` / `shendu.db-shm` and to the database/key via a linked parent directory, risking data corruption under an operator path mistake. The guard now resolves existing path/parent aliases (and Windows case) and also protects both SQLite sidecars. Regression creates isolated restored data and a linked directory, asserts nonzero rejection for all four paths, and verifies original database/key bytes and absent sidecars.

### Verified dead code removed

Removed the `validRecordType` skip inside `applyBackup`: `prepareBackup` validates every record through `normalizeImportedRecord` before returning the array; invalid types already throw. Keeping a later silent skip was unreachable and obscured the reject-before-delete contract. Supported legacy parser code is retained.

### Concurrent remote backups could retain unbounded encrypted payloads

Each manual remote backup generated a full encrypted account backup before awaiting a remote HTTPS upload; the endpoint had no concurrency guard. An authenticated member could point at a slow public service and queue repeated backups, retaining many large buffers for the 30-second network window. `runExternalBackup` now reserves one operation per account and at most four across the process before reading credentials, deriving keys or allocating payloads. Busy attempts return `429` / `backup_busy`, and `finally` releases slots on successful upload, connection failure and preparation failure. This shared boundary also covers scheduled backups and connection tests. Root owns API rate-limit and busy-outcome integration.

Regression holds four uploads pending, checks duplicate-account and fifth-account attempts perform no credential read/body allocation/network call, then verifies slots become reusable after upload success, upload rejection and credential-decryption failure.

## Verified existing protections

- AES-256-GCM authentication includes headers/AAD; password derivation is fixed to 600,000 PBKDF2-SHA-256 iterations. Current formats validate canonical salt/IV/tag/ciphertext Base64.
- Personal import limits encrypted bytes, decompressed output, entry counts, duplicate IDs/periods, per-account record count and stored bytes. Cross-account import requires source owner confirmation; IDs are deterministically remapped on cross-account collision.
- Merge protects completed/verified records and newer drafts. Replace and site restore validate first, execute a transaction and roll back capacity/constraint failures. Restoring site data deletes all old sessions.
- Site backup is password-protected, validates user/record/target/run ownership, retains original IDs for old site data and re-encrypts under the destination server key. Web routes separately require superadmin and current password where destructive/exporting.
- Snapshot validates SQLite integrity/foreign keys and authenticates every encrypted field against the embedded master key before replacement. Restore stages incoming files, keeps old DB/key copies and attempts rollback on replacement failure.
- External targets require HTTPS, reject userinfo/query/fragment/local/reserved IPs, inspect all DNS answers, pin resolved addresses and do not follow redirects. Response size/deadline are bounded. Credentials remain encrypted at rest and outside personal exports.

## Validation and limits

- `node --test tests/backup-security.test.mjs`: 29/29 passed after the first fixes, including authenticated failure/rollback, all five personal formats, site and CLI round trips.
- After strengthening closed-request error settlement and removing the redundant skip, targeted new tests passed (2/2); root will run the final full combined suite.
- Additional concurrency and transport tests passed together (2/2); the complete updated backup-security suite then passed 30/30. Final combined project suite is root-owned.
- `node --check server.mjs` and `node --check scripts/admin-cli.mjs`: passed.
- Tests use generated isolated accounts/data/keys; no production data or endpoint was accessed. TLS transport failure regressions use event-compatible mocks; live remote providers were not penetration-tested.
- CLI restore remains an offline administrator operation: docs require stopping the app. SQLite checkpoint busy checks do not prove that no idle application connection exists; do not describe CLI restore as a live hot-restore feature.
- No absolute absence-of-vulnerabilities claim: this review provides concrete source coverage, negative tests and bounded evidence.

## Deployment cross-review (read only)

Reviewed final `site-backup.sh`/`update.sh`/installer test changes against CLI password-file semantics. Copying original bytes agrees with CLI removal of exactly one final line ending; first-run hard-link publication selects a single winning password; the update wrapper delegates before fetching code; cleanup covers generated secret copies and snapshot staging files. Reported a concrete remaining partial-publication edge to root: the final `install` copy can leave a truncated final-looking backup on disk-full; final output needs adjacent staging and atomic rename plus cleanup. Also noted that using the transient `app/tmp` directory as final output requires rejection or special cleanup handling. Deployment owner is handling these; this reviewer did not modify deployment-owned files.
