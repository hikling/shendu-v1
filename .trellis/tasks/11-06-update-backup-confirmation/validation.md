# Validation

The screenshot shows visible y and an invalid-choice error, but cannot establish its hidden bytes. Existing literal y matches; raw values with surrounding space or trailing CR are rejected. Reproduced those three case/trim outcomes with POSIX Git sh locally: plain y accepted by both; space/CR rejected by old case and accepted after normalization. Do not assert the screenshot's exact invisible character is known.

Only updater confirmation, isolated test files and docs/spec/task artifacts change. No application UI, credentials, database, encryption, snapshot password handling, image policy or Compose mount changes. Script continues to snapshot before fetch, abort on snapshot failure, and preserve cleanup/lock ownership. Explicit latest-updater command supplies SHENDU_BACKUP_BEFORE_UPDATE=y as a reliable noninteractive confirmation; ordinary script defaults stay documented.

An independent read-only review found no blocking POSIX/choice/reexec/cleanup/backup-order/doc issues. Test worker added20 scenarios to the existing59: real canonical Linux PTY y/n/Enter, spaces/tab/CR, mixed case, invalid-then-valid, EOF, snapshot failure; explicit env yes/invalid/failure and ordinary noninteractive default. Driver timeout/errors fail the harness. No production data is involved. Local POSIX shell syntax, Python AST, npm run check, task context and diff whitespace checks passed. Windows host lacks Linux PTY execution; native Linux CI remains required before completion.

Native CI, published source-specific archives and anonymous deployment smoke: pending push.
