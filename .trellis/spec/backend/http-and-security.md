# HTTP and Security

`api(req, res, url)` in `shendu/server.mjs` branches on pathname and method. `json()` sends no-store JSON; `error()` returns `{ error, message }` with an HTTP status. `request()` in `shendu/public/app.js` consumes that response shape. Validate and normalize request fields at the route before database writes, using existing record-type, ID, text, theme, stage, and backup helpers.

The outer server handler catches unexpected route failures and returns a generic 500 message. Expected user errors are returned with specific status and code. `console.error()` is used for startup/key failures, unexpected server errors, and scheduled-backup failures. Keep sensitive input and decrypted content out of logs.

`api()` rejects cross-site fetch metadata and mismatched write origins. Protected routes call `requireUser()`; administrator routes also check role. Record queries constrain both `id` and `user.id`. Sessions use cookies, and login/register attempts are rate-limited. Keep those boundaries on new endpoints.

`PUT /api/records` only writes the current allowed period, rejects edits to completed records, compares `version` to prevent overwrites, and enforces size limits. `POST /api/records/:id/complete` validates required fields and locks the record; verification is a later transition. UI reorganization must preserve these contracts unless an explicit API/data task changes them.

Completion must reject a `verifyDate` earlier than `verificationMinimum(type, Beijing today)`. `POST /api/records/:id/verify` must also reject submission before the same minimum computed from that record's Beijing `completed_at` date (with `created_at` fallback for old rows). Daily can verify on the completion day. Use the shared pure module `public/verification-policy.js` and return a specific 400 error without changing the record. Keep the selected expected date separate from this absolute minimum so existing early/on-time/late classification remains meaningful.

`staticFile()` serves from `shendu/public/`, rejects traversal, and uses no-cache for HTML with long immutable caching for other assets. Consider asset URL changes when updating deployment packaging.
