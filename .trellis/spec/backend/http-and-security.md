# HTTP and Security

`api(req, res, url)` in `shendu/server.mjs` branches on pathname and method. `json()` sends no-store JSON; `error()` returns `{ error, message }` with an HTTP status. `request()` in `shendu/public/app.js` consumes that response shape. Validate and normalize request fields at the route before database writes, using existing record-type, ID, text, theme, stage, and backup helpers.

The outer server handler catches unexpected route failures and returns a generic 500 message. Expected user errors are returned with specific status and code. `console.error()` is used for startup/key failures, unexpected server errors, and scheduled-backup failures. Keep sensitive input and decrypted content out of logs.

`theme.reviewWheelNavigation` is the account preference for wheel-based review question navigation. `defaultTheme()` enables it, and `normalizeTheme()` disables it only for the literal boolean `false`; absent legacy fields default to `true`, independently of `reduceMotion`. The existing `GET /api/me`, `PUT /api/settings`, personal export/import and site restore use this shared normalization. Persist it through the existing encrypted theme setting and backup formats without a schema/version bump. Restoring an older theme without this field must enable navigation rather than infer a value from motion or colors. `tests/review-wheel-settings-api.test.mjs` exercises real new/legacy account reads, saved true/false across login, independent reduced motion, encryption and personal/site backup restore.

`api()` rejects cross-site fetch metadata and mismatched write origins. Protected routes call `requireUser()`; administrator routes also check role. Record queries constrain both `id` and `user.id`. Sessions use cookies, and login/register attempts are rate-limited. Keep those boundaries on new endpoints.

`clientAddress()` trusts `X-Forwarded-For` only when `SHENDU_TRUST_PROXY=true`; default/direct Node startup uses the socket address. Bundled Compose enables trust because the application port is unpublished and Caddy supplies the immediate forwarded hop. Never enable this behind an unprotected public application port. Body reads revalidate `req.authUser` against the current session before any subsequent write, including backup restore after slow uploads.

`PUT /api/records` only writes the current allowed period, preserves an existing draft's type/period identity, rejects edits to completed records, compares `version` to prevent overwrites, and enforces size limits. Ordinary review creation is unique per account/type/period; decisions allow multiple records in one day. Conflict responses and administrator mutation atomicity are specified under [Write integrity and health metadata](#write-integrity-and-health-metadata). `POST /api/records/:id/complete` validates required fields and locks the record; verification is a later transition. UI reorganization must preserve these contracts unless an explicit API/data task changes them.

`DELETE /api/records/:id` only removes owned draft rows, regardless of period. Read/validate the JSON body (which revalidates the session) before querying; require a numeric safe-integer version >=1 and match owner/status/version in the delete itself. Unknown/foreign IDs return404, submitted/verified rows409 locked, stale versions409 version_conflict. `PUT` with a supplied ID missing an owned row must return404 record_not_found rather than inserting: another device must not resurrect a deleted draft. ID-less requests remain the creation path. Test competing saves, submission and logout while a slow delete body arrives.

Completion must reject a `verifyDate` earlier than `verificationMinimum(type, Beijing today)`. `POST /api/records/:id/verify` must also reject submission before the same minimum computed from that record's Beijing `completed_at` date (with `created_at` fallback for old rows). Daily can verify on the completion day; weekly/monthly/quarterly/yearly require +7/+30/+90/+250 Beijing calendar days, and decisions require three calendar months with month-end clamping. Use the shared pure module `public/verification-policy.js` and return a specific 400 error without changing the record. Keep the selected expected date separate from this absolute minimum so existing early/on-time/late classification remains meaningful.

`staticFile()` serves from `shendu/public/`, rejects traversal, and uses no-cache for HTML with long immutable caching for other assets. Consider asset URL changes when updating deployment packaging.

Current personal backup transport is `POST /api/data/inspect` and `/api/data/import`; both accept the encrypted file as JSON text with bounded request/file size, owner verification and explicit replace confirmation. The unused `/api/backup/upload/*` temporary chunk transport was removed after checking all browser, tests and docs references. Keep all five supported personal file parsers/fixtures; transport removal does not remove old-format compatibility. The HTTP server must not delete arbitrary files from the CLI/shared temporary directory on a timer.

Manual external backup/test routes share a 12-per-hour rate bucket per account and client address. `runExternalBackup()` must acquire its shared slot before credential decryption, password derivation or payload creation: one operation per account and four across the process, covering manual, test and scheduled calls. Release in `finally` on every result. A busy attempt returns `429` / `backup_busy` and must not overwrite the running task's outcome; the scheduler skips that busy result rather than recording a failure. Keep this resource guard at the common helper as well as the HTTP frequency boundary.


Review templates normalize through public/review-schema.js (questions<=30, validated stable base/custom_ IDs, label<=160, required boolean, explicit empty list preserved). Stage metrics allow0–12 entries and stable IDs normalized by review-metrics.js. Completion checks required answer keys from the normalized saved snapshot (or current settings for legacy drafts without snapshots), plus all unchanged core action/date/title invariants. Snapshot version1 remains compatible; later settings must not rewrite a locked record. Personal backup normalization must preserve question structures, disabled fields, metric IDs and archived metric answers.


External backup schedules use public/backup-schedule.js as the shared Beijing civil-time owner. API fields scheduleTime(HH:MM)/scheduleWeekday(1Mon..7Sun) map to additive SQLite columns; manual and test operations never shift scheduled slots. Validate schedules on create/update/restore and preserve existing enabled state unless explicitly supplied. Claim scheduled work with a five-minute expiring token lease; terminal outcome/log/slot consumption must commit atomically, while an abandoned claim can retry after expiry and stale completions cannot release a new owner. Do not export transient leases in site backups. Startup/migration must not replay a slot before the new plan anchor; stale selected targets must pass anchor+updated_at guards before execution. Tests never write backup outcomes or last-success state. Retain HTTPS/public-address pinning, one-account/four-global resource guards and rate limits.

Result history retains ten Beijing calendar days including today, without a12-row or500-row truncation within that window. Only identifiable backup success/error events enter the result list; store attempted target name/kind and manual/scheduled source. Do not expose credentials when returning safe edit configuration. New site backups preserve schedule and run metadata; normalize imported timestamps to ISO before lexical cutoff comparisons. Legacy unknown test/backup failures must not be falsely relabeled. CLI snapshots read actual schema_meta version rather than hard-coding one.

## Write integrity and health metadata

### 1. Scope / Trigger

Preserve these contracts when changing record save requests, administrator account editing, transaction boundaries, or health reporting. They prevent old drafts being relabeled into a new period, duplicate-period saves being treated as new successful records, partially applied account changes, and stale migration metadata.

### 2. Signatures

- `PUT /api/records`: `{id?,type,period,version?,title?,data?}`; successful response `{record}`.
- `PATCH /api/admin/users/:id`: optional `status`, `role`, `password`; successful response `{ok:true}`.
- `GET /healthz`: numeric `schema` read from `schema_meta` where `key='schema_version'`, using the existing version-8 fallback when metadata is absent.

### 3. Contracts

For an owned draft identified by `id`, both stored `type` and stored `period` are immutable. The save `UPDATE` changes only title, data, version and update timestamp. Validate the requested current period first; an old draft cannot be made writable by sending a new period/type. ID-less creation checks `(user_id,type,period)` for daily/weekly/monthly/quarterly/yearly records regardless of the existing row's status. Return the same `period_conflict` if the insert subsequently raises SQLite unique constraint `2067` and that owned period now exists. `decision` is exempt from this period uniqueness rule. Failed checks leave both records and activity events unchanged.

Administrator PATCH rechecks the current actor after reading the body, preserves the existing self/superadmin/peer-admin restrictions, validates a supplied nonempty password, and derives its hash before writes. Accepted status/role/password changes, their existing per-field `session_version` increments, and deletion of all target sessions run in one `BEGIN IMMEDIATE` transaction. Return success only after commit; a field-write or session-deletion error rolls back the entire operation. Preserve existing field allowlists and the rule that only a superadministrator can change roles.

Healthy `/healthz` returns `200 {ok:true,schema,dataEncryption:'AES-256-GCM'}`. An unavailable data key returns `503 {ok:false,schema,error:'data_key_unavailable'}`. Both responses read the same actual stored schema version; neither hard-codes an obsolete version based on key availability.

### 4. Validation & Error Matrix

| Condition | Response / effect |
| --- | --- |
| Requested period is not current for its requested type | `400 period_locked`, before row identity checks |
| Supplied ID has no owned row | `404 record_not_found` |
| Owned row is completed or verified | `409 locked`, before draft identity/version checks |
| Owned draft type or period differs from a valid current-period request | `409 record_identity_conflict` |
| Same-identity draft has stale version | `409 version_conflict` |
| ID-less ordinary review duplicates an owned type/period | `409 period_conflict`; preserve the original row and activity |
| Same-day ID-less decisions or another account's matching period | Independent creations remain allowed |
| Administrator lacks current authority or cannot manage target | `403`, no account/session mutation |
| Nonempty administrator-supplied password fails shape validation | `400`, no account/session mutation |
| Any transactional administrator write fails | Generic `500` through the outer handler; all fields and sessions restored |

### 5. Good / Base / Bad Cases

- Good: save the same draft ID/type/period with its latest version; its version increments. Create two independent decisions on the same day.
- Base: create one daily review, then attempt ID-less creation for that same account/day; receive `period_conflict` and reopen the original record.
- Bad: change an old weekly draft's period to this week, or change an existing decision to a daily review; receive `record_identity_conflict` after current-period validation. Do not rewrite identity to bypass locks.

### 6. Tests Required

`tests/auth-record-integrity.test.mjs` covers identity immutability for all six types, old-period lock precedence, valid updates/version conflicts, duplicate ordinary records in draft/completed/verified states, multiple decisions, per-account isolation, and unchanged activity on rejected writes. Inject a password-write or session-delete failure into a disposable database and assert all administrator target fields, session versions and sessions roll back together; also assert successful combined edits revoke old sessions and retain role boundaries. `tests/health-schema.test.mjs` compares actual SQLite metadata with both the healthy and unavailable-key HTTP responses, then changes temporary metadata and checks both branches follow it.

### 7. Wrong vs Correct

Wrong: update a stored draft's type/period from submitted fields; perform administrator status/role writes before a later password write outside a transaction; return `schema:6` from health responses.

Correct: reject identity changes, normalize expected ordinary-period uniqueness to `409 period_conflict`, commit all accepted account changes and session revocation together, and read the current `schema_meta` value for both health states.

## Activity feed

Schema8 additively creates `activity_events` with a user foreign key and delete cascade; startup does not fabricate events from older records. Keep the action whitelist in `ACTIVITY_ACTIONS` and the browser label map synchronized: login/logout, draft_saved/draft_deleted, review_completed/action_verified, stage_updated/preferences_updated, password_updated/backup_password_updated, backup_success/backup_failed, backup_target_created/backup_target_updated/backup_target_deleted, data_exported/data_imported and site_exported/site_imported. Store only event ID, owner, action, optional whitelisted record type/period/target kind and timestamp. Titles, bodies, verification content, target names, credentials and arbitrary supplied messages must not enter this table or response.

Authenticated `GET /api/activity` defaults to a cross-date feed and returns `{date:null,scope,entries,nextCursor}`. The current database session role owns visibility: admin/superadmin receive `scope:'site'` for all accounts, members receive `scope:'personal'` with an unconditional owner predicate. This wider administrator visibility was explicitly approved by the user; client query parameters cannot override it. Each entry has only `{id,actorName,action,recordType,period,targetKind,createdAt}`; join the current username for `actorName`, without storing names in events or exposing the user row. The existing optional `date=YYYY-MM-DD` query remains supported: validate a real civil date and constrain its Beijing midnight interval.

Both scopes exclude timestamps after now, order by `(created_at DESC,id DESC)` and return at most50 entries using a51-row lookahead. Validate and look up the cursor within the same visibility, optional date and time bounds before applying the keyset predicate; invalid cursor shape returns400, an invisible/missing/out-of-date/future cursor404. Keep the per-user time index and the global time index for these two access paths. Reads never create events. The feed remains schema8 and does not change event persistence or backup formats; it has no automatic ten-day retention, unlike the separate external-backup result history.

Use `withActivity()` SAVEPOINTs or an existing transaction so a completed business write and its event commit or roll back together, including draft deletion and backup outcomes. Failed validations, zero-row writes and connection tests create no event; actual external-backup failures use `backup_failed` in the shared outcome transaction. Export events record successful file generation, not proof that a browser received a download. Keep `DELETE /api/backup/targets/:id` compatible with the existing bodyless request; unlike record deletion, it must not require a JSON version body or Content-Type.

Web site backups include the optional `activity` array; validate IDs, owning users, the fixed action/type/period/kind fields and timestamps before any replacement. Restore normalizes timestamps and imports events inside the existing transaction, then appends `site_imported` for the restored superadministrator. Legacy site files lacking `activity` remain valid and start with that real restore event; do not invent prior use. CLI snapshots include the table through the existing full-database mechanism. Preserve session revalidation after asynchronous body reads on writing routes.
