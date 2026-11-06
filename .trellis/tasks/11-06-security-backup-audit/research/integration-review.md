# Independent integration review

Reviewer scope: combined audit changes in this shared checkout, against the task PRD/design and backend HTTP/security and operations contracts. Reviewed production paths and their new regressions; did not alter production source owned by the other reviewers or execute against a real account/deployment.

## Findings

No additional confirmed defect remains from this integration review. Two concrete backup-wrapper edges reported during cross-review were corrected by the deployment owner before final inspection:

- A failed final `install` copy could leave a truncated file with the final backup filename. The helper now copies into a private adjacent staging file and publishes the complete output with a no-clobber hard link. Its trap removes staging and secret files on failure.
- Final output equal to the application's transient `tmp` directory could alias the source/output and interact with cleanup. The helper now compares physical directories and rejects this destination before creating a password.

These fixes have dedicated isolated shell scenarios. Actual Linux execution is part of root's final CI gate; the review does not substitute code inspection for that result.

## Cross-boundary review

| Area | Code paths and evidence reviewed |
| --- | --- |
| Personal backup UI/API | File size/empty checks; file-read visit token; inspect/restore exact ciphertext, password, mode and replace confirmation; old/new modal ownership; disabled/persistent single-flight writes; failed restore retry; refresh commits only for the original account/caller. Server retains parser, owner validation, transaction and authoritative account boundaries. |
| Site backup UI/API | Superadmin route checks and current-password confirmation; independent export/inspect/restore payloads; single-flight; stale response/download prevention; successful restore clears sessions and returns to login. Failure controls/values remain usable. |
| Reauthentication | API 401 invokes a persistent dialog; failed fetch/JSON is caught; controls restore for retry; stale login/reauth responses do not boot or dismiss replacement UI. Native FormData is captured before controls are disabled. Backup owner cleanup cannot clear another operation's busy state. |
| External backup | Busy slot acquired before credential decryption/KDF/buffer generation, one task/account and four total, finally release; manual rate limit; busy API/scheduler paths preserve the active task's status. Response error, aborted, oversized and after-request-close errors reject directly and destroy the request. Existing DNS/TLS pinning and bounded response/deadline retained. |
| Snapshot CLI | Canonical existing-file/parent resolution, Windows comparison, DB/WAL/SHM/master-key/password output exclusions; original format/restore/session invalidation/rollback paths retained. Checked new path regression assertions and owner backup report. |
| Snapshot shell/update | Adjacent private first-password publication; concurrent loser reads winner; original password bytes copied to random private per-invocation file; shared update helper runs before fetch; fallback container reuses same password; complete-only output publication and traps; final tmp-directory alias rejected. |
| HTTP/proxy | Direct server ignores attacker-controlled forwarding unless explicitly opted in; bundled private/unpublished app opts in; Caddy receives only domain and no master key; slow-body read revalidates the current session; member site-backup/admin calls denied; origin and JSON-shape rejection retained. |
| Cleanup/build | Removed upload transport has no live frontend/docs callers and current inspect/import compatibility remains; tab component has no remaining imports/references; app module URL revision updated; no presentation CSS/artwork changes. CI checks all shell syntax, isolated scenarios, resolved Compose env and real image/static-resource smoke. |

## Verification performed by this reviewer

- `npm run check`: passed on the combined working tree. This JavaScript repository has no separate lint or TypeScript checking script; syntax validation is the configured check gate.
- `node --test tests/auth-ui.test.mjs tests/backup-ui.test.mjs tests/http-security.test.mjs`: **18 passed, 0 failed**. Covers actual built shadcn DOM integration, stale owners, duplicate requests, restore retry/payload/refresh, auth failure recovery, privilege/origin/rate-limit and slow-upload session revocation.
- `git diff --check`: passed. Git's informational LF/CRLF conversion notices on three non-shell files are not whitespace errors.
- Confirmed no current tab imports or production legacy chunk-upload references; only route-removal regression tests intentionally retain the old route strings.

## Required final gates / limitations

Root owns the final full build/all-tests result, locked-dependency advisory result, actual Linux shell scenarios, real Docker/Compose/static-resource smoke, exact-commit GitHub CI evidence and main/task closure. Those final gates were not repeated or asserted complete here. Windows PATH has no POSIX shell; no real package installation or production backup was attempted by this reviewer. Source review and negative/success regressions reduce identified risks, and cannot prove the absence of every possible vulnerability or external host/plugin issue.

## Final incremental review: shared dialog writes and action verification

Independently reviewed the later `backupDialogTask` to `dialogWriteTask` rename, its owner/busy field rename, every backup caller and the new `openVerification` submit path. No additional confirmed defect found; no production source edits made by this reviewer.

- Helper semantics are preserved: capture exact modal/account and optional backup page, single-flight on the connected anchor, persistent/disabled controls while pending, owner-specific busy cleanup and idempotent finish. No production/test references to the old helper/owner/busy identifiers remain.
- Verification captures native form values before disabling controls; duplicate submit/cancel/navigation are blocked during the active request. Server success updates the original current account's record once, and a failed stats fetch does not convert a committed verification into a failed verification. UI completion/stats updates require the original owner again after the stats await.
- Failure retains editable values for retry. Forced modal/account replacement suppresses stale completion and cannot release a newer write owner. Existing decision-specific fields and advice markup are unchanged.
- `npm run check`: passed again after this increment.
- `node --test tests/verification-ui.test.mjs tests/backup-ui.test.mjs tests/ui-overlay-inert.test.mjs`: **17 passed, 0 failed**, including the three new verification DOM regressions and existing backup/overlay owner regressions.
- `git diff --check`: passed again. Root is separately running the final full suite; this targeted check does not assert its result.
