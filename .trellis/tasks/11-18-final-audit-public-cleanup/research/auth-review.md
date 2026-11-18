# Auth, review lifecycle and async-owner audit

Reviewed current source, then reproduced three logical defects with synthetic accounts/records and actual production handlers. Root authorized the narrow source/test fixes below. No production credentials, data or buckets were accessed; no commit/push by this reviewer.

## Findings fixed

### P2: obsolete 401 responses could destroy a newer modal

- Owner: `shendu/public/app.js`, `openVerification` (around814) and other existing owner-aware request callers.
- Before: response handlers checked `task.current()` after `await request`, but omitted the third `isCurrent` predicate. The real `request()` first called `sessionExpired()` on401, so the later ownership check was too late.
- Reproduction used actual request/sessionExpired/openModal/Dialog functions: start verification, force a replacement modal/account, then deliver old401. Observed `{replacementStillPresent:false,reauthOpened:true,reauthUsername:"new"}`; the new modal/input was removed. No cross-account record disclosure was observed.
- Fix: forward existing exact owner predicates at18 request sites: verification and its stats read; draft delete; backup page loads, password/export/inspect/import, targets and site backup; managed-account reads; sequenced activity reads; stage save and own password change. No new ownership abstraction or UI changes.
- Regressions execute actual request/sessionExpired with the production component bridge. Old verify/stats responses preserve newer modals for both same and replacement accounts; old backup load/export/inspect responses preserve replacement input. A current401 still opens reauthentication.

### P2: a clean stale tab could permanently lock another tab's newer draft

- Owners: `shendu/public/app.js:712`, `shendu/server.mjs:1395` complete route.
- Before: TabA saved v1, TabB saved v2 with different action. TabA's clean editor submitted bodyless completion. Actual HTTP returned200 and permanently locked TabB's action, despite TabA's confirmation referring to its earlier version.
- Fix: current UI always submits the actual reviewed record.version, including the returned version after a first/dirty save. Server awaits body and revalidates session, strictly validates supplied safe-integer version, rejects stale supplied version409 before any write/event, and includes row.version in the final conditional update. A conflict refreshes the cache for reopening while preserving the original mounted editor and values.
- Compatibility decision from root: legacy clients may omit version and retain their established bodyless behavior. They cannot receive the new stale-client protection until updated. Current UI always supplies it. No API-wide mandatory-version migration was introduced.
- Regressions cover all six types with stale v1/new v2, malformed version values, no state/activity mutation on denial, exact-version success, current UI clean/first-save payloads and conflict preservation. Slow JSON upload followed by logout receives401 and cannot lock the draft.

### P2: valid legacy draft IDs could be read but not saved

- Owner: `shendu/server.mjs:1376` PUT record ID validation.
- Existing stored/site-backup compatibility intentionally permits non-UUID IDs through validStoredRecordId. A current-period legacy draft remained editable in UI but PUT rejected it under validEntityId.
- Actual HTTP reproduction: `legacy-draft-id`, current period, draft status: GET200; PUT400 `记录编号不正确`.
- Fix: validate supplied existing IDs through validStoredRecordId, then retain mandatory owned-row lookup and existing period/status/identity/version checks. Supplied missing IDs still return404; only ID-less creation generates new UUID records.
- Regressions cover all six legacy current-period drafts: save, stale-version denial, foreign denial, missing-ID no-insert, completion and locked-edit denial. This does not relabel expired drafts or allow client-ID insertions.

## Reviewed surface without additional confirmed blocker

- Server auth/register/login/logout, username/password validation, hashed sessions/expiry/revocation, per-address login throttles and explicit proxy trust.
- Origin/fetch-metadata/JSON boundaries, scoped SQL owner predicates, static-path containment and no-store API responses.
- Account self/superadmin/peer-admin restrictions, combined account mutation transactions and session rollback, own password change.
- Record current periods, six-type identity/version constraints, uniqueness, draft deletion, completion required answers/template snapshots/finance snapshot/size limits, verification eligibility and immutable status transitions.
- Browser authentication, reauthentication, save/complete/delete/verification pending state, mounted-input retention, admin writes, stage/account settings owner checks and HTML escaping.
- Review schema/verification policy interactions were traced; focused existing tests exercise all six period and waiting boundaries. Broader finance, backup and deployment audits belong to the other reviewers/root.

## Verification

- `npm run check`: passed after final source edits (syntax check; project has no separate lint/typecheck command).
- `node --test tests/review-write-ui.test.mjs tests/auth-record-integrity.test.mjs`:30/30 passed after final changes.
- `node --test tests/verification-ui.test.mjs tests/backup-ui.test.mjs`:14/14 passed, including real request/401 regressions.
- Earlier affected-domain pass:94/94 (auth/account/admin, draft deletion, verification, backup, workspace/stage/activity); full final suite delegated to root to avoid duplicate work.
- `git diff --check`: passed; only CRLF conversion notices.
- No unresolved confirmed auth/review finding after these fixes. This is bounded source/test evidence, not proof of absence of every possible vulnerability or native-device/live-server acceptance.
