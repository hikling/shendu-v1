# Authentication and record integrity audit

Scope: `shendu/server.mjs` authentication/session/password/admin controls, record create/save/complete/verify/delete, settings and activity visibility. External backup/network handling belongs to the other auditor. Inspected local code and exercised only isolated temporary databases and local HTTP servers; no production accounts or data were used.

## Confirmed and fixed

1. **P2 — Saved drafts could change their type/period and bypass historical read-only rules.** At `shendu/server.mjs:1330`, validation previously checked only the requested current period and then rewrote both identity fields. With a saved daily draft whose period had naturally expired (simulated as `2000-01-01`), PUT of the same ID/version and today's period returned 200 and moved it into today. The same ID could then be saved as a decision. Existing draft identity now remains immutable: attempted relabel returns **409 `record_identity_conflict`**, before data or activity changes; updates no longer include identity columns. Original old-period requests still return 400 `period_locked`; completed/verified owned rows remain 409 `locked`; foreign IDs remain 404 `record_not_found`.

2. **P2 — Creating an already occupied periodic review returned a server error.** At `shendu/server.mjs:1332` and `:1340`, an idless second create of a nondecision review for the same user/type/period previously fell into SQLite's unique constraint and returned 500 `ERR_SQLITE_ERROR`. It now returns **409 `period_conflict`** without overwriting the row, version or activity. The database uniqueness constraint and specific unique-error fallback remain in place for competing writers. Same-day decisions and another account's same-period review remain allowed.

3. **P2 — Combined administrator account edits could partially commit on failure.** At `shendu/server.mjs:1484`, status, role, password and session deletion previously used independent autocommit statements. A synthetic password-write failure reproduced a 500 response while status had already changed from active to disabled and session_version from 1 to 2. Changes and session revocation now share one transaction; errors roll back every field, session version and session deletion. Password hashing occurs before acquiring the write transaction. Existing per-field version increments and permission rules are preserved.

Also reproduced the stale `/healthz` schema value (6 vs database schema 8) and handed it to the backup/runtime auditor; no ownership overlap.

## Verification

- Added `shendu/tests/auth-record-integrity.test.mjs` with seven HTTP behavior tests covering all six draft kinds, past-period/type relabels, duplicate draft/completed/verified periods, normal saves and stale versions, locked/foreign/unknown records, combined account success, injected password-write failure, injected session-delete failure, and administrator boundaries.
- Targeted regression run: `node --test tests/auth-record-integrity.test.mjs tests/record-delete.test.mjs tests/http-security.test.mjs tests/review-settings-api.test.mjs tests/activity-log-api.test.mjs` — **39 passed, 0 failed**.
- `node --check shendu/server.mjs` and `node --check shendu/tests/auth-record-integrity.test.mjs` — passed.

No additional reproducible issue found in the scoped ownership checks, role/session revocation, post-body authentication revalidation, CSRF/JSON protections, password controls, lifecycle validation or activity privacy/admin scoping. This is a scoped source review and regression exercise, not a guarantee that no vulnerability exists.
