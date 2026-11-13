# Backup, encryption, and restore audit

## Confirmed issue and repair

- **P3: health endpoint reported an obsolete database version.** `shendu/server.mjs:1523` returned `schema: 6` in both the healthy response and the unavailable-key response, although startup metadata and completed migrations identify version 8. This can mislead upgrade/monitoring checks. Both branches now read `schema_meta.schema_version`, using the same numeric/default convention as the existing site-export and CLI metadata readers.
- `shendu/tests/health-schema.test.mjs` starts isolated real servers for normal and unavailable-key states, compares the returned version with SQLite metadata, changes the temporary metadata, and confirms the endpoint follows it in both states. Result: **2 passed, 0 failed**.

## Reviewed boundaries

- Personal backup versions 1-4 and stream/line compatibility; authenticated encrypted headers and payloads, canonical Base64, file/request/decompression limits, password limits, owner confirmation, duplicate IDs/periods, count/byte budgets, locked-record merge rules, transaction rollback.
- Site backup authorization and reauthentication; encryption and decompression limits, complete owner/foreign-key validation, role/status/password-hash validation, transient lease exclusion, old optional activity compatibility, atomic restore and session invalidation.
- WebDAV/S3 endpoint and credential normalization; HTTPS-only requests, private/reserved IPv4/IPv6 rejection, all-address DNS validation, pinned validated addresses, redirect rejection, same-endpoint restrictions, response limits, request deadlines, concurrency slots, non-overwriting test object names and readback.
- Explicit Beijing daily/weekly slots, schedule change anchors, latest-slot consumption, atomic success/failure results, retry after expiring claim, stale-claim protection, manual/test separation and ten-day run retention.
- `scripts/admin-cli.mjs` and `scripts/backup-safety.mjs`: password bytes, key/database matching, snapshot integrity/foreign-key validation, path aliases and SQLite sidecars, adjacent private staging, protected outputs, authenticated decompression, restore rollback and session invalidation. Offline CLI restore continues to require the documented stopped-server procedure.

No additional confirmed actionable vulnerability was found in these reviewed backup paths. This is a source review and isolated regression verification; it does not claim validation against live third-party WebDAV/S3 servers or deployed data.

## Verification

- `node --test tests/backup-security.test.mjs tests/backup-schedule.test.mjs`: **38 passed, 0 failed, 0 skipped**. Includes CLI snapshot/restore, old-format restoration, crypto tampering, owner isolation, replacement rollback, output path protection, private-address rejection, response interruption/size limits, concurrent upload slots and scheduler leases.
- `node --test tests/health-schema.test.mjs`: **2 passed, 0 failed**.
- Full syntax/build/test and deployment/release checks are coordinated by the root agent.

## Scope ownership

Only the `/healthz` handler and the new dedicated health test were changed in production/test code. Other server ranges are owned by the parallel authentication/record auditor. No real user data or storage endpoint was used.
