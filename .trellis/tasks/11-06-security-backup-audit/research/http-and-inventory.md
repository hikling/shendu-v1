# HTTP, storage and source inventory review

## Scope and method

Root reviewed the HTTP/auth/storage boundaries and integrated three scoped reviewers plus an independent integration review. Production source was inventoried by file, routes were traced through validation and persistence, and findings were checked against real isolated HTTP/CLI/DOM tests. Test fixtures and generated output were distinguished from dead code. No deployed account, production data or original key was accessed.

| Production group | Coverage / evidence |
| --- | --- |
| `shendu/server.mjs`: startup/schema, master key initialization and migration | SQLite WAL/foreign keys/busy timeout; restrictive file permissions; encryption scopes; matching original key before migration; no replacement key for encrypted old data; atomic key persistence. Existing backup tests cover wrong/missing keys and original-file preservation. |
| `server.mjs`: password/session helpers and all auth/account/admin routes | Scrypt parameters; dummy password work; hashed random session token; HttpOnly/SameSite cookie and HTTPS flag; active/session-version/expiry checks; bounded login/register attempts; role hierarchy; last-superadmin/self restrictions; current-password confirmation; revoke sessions on password/role/status changes. |
| `server.mjs`: settings, record routes and summary | User-constrained queries and bound SQL parameters; current-period/type/ID validation; immutable completed records; optimistic versions; record/account/user capacity; server-side required fields and verification waiting periods; encrypted settings/content. |
| `server.mjs`: HTTP/body/static lifecycle | Cross-site metadata and origin rejection; JSON content type/object shape; bounded body; session revalidation after slow bodies; normalized public-root containment; local script CSP and security headers; HTML no-cache; generic unexpected errors. Direct forwarded-IP trust flaw fixed below. |
| `server.mjs`: personal/site backup and external transport | Full backup reviewer report in `backups.md`; API authorization/password/confirmation/rate ownership reviewed separately here. No live call depends on removed chunk transport. |
| `scripts/admin-cli.mjs`, `scripts/backup-safety.mjs` | Full backup reviewer report: offline snapshot/restore/migration, integrity and authenticated data checks, canonical protected paths, transactions/replacement rollback and original key preservation. |
| Browser modules, component islands, CSS, local catalogs and build helpers | File-by-file coverage and DOM/XSS/async checks in `frontend.md`; no visual redesign, assets or record-content edits. |
| Root/application installers, update/snapshot/entrypoint, Docker/Compose/Caddy/env/ignore/workflow | Coverage and isolated failure scenarios in `deployment.md`; final Linux behavior/container result belongs in validation. |
| `package.json`, lockfile and third-party notices | Locked versions retained; `npm audit --json --registry=https://registry.npmjs.org` returned zero known advisories on 2026-11-06. The dependency advisory database is a point-in-time check, not a guarantee. Existing license build remains required. |
| `tests/`, personal legacy fixtures, `.trellis/`, docs/art provenance | Tests and retained compatibility material support runtime contracts; not deleted as unused application code. Source scan found no matching OpenAI-style secret or private-key block in tracked small files; this is not a full historical secret scan. |

## Confirmed root findings

### Direct clients could spoof rate-limit addresses

`clientAddress()` previously consumed arbitrary `X-Forwarded-For` even on a directly exposed Node server. Rotating the header bypassed the login attempt bucket. Default startup now uses the socket address; forwarding requires `SHENDU_TRUST_PROXY=true`. The private Compose application explicitly opts in behind Caddy and has no published host port. Documented custom proxy boundary. Real isolated HTTP regression failed before the fix and passes after it; a separate trusted-proxy case preserves intended address separation.

### External backup resource and outcome boundaries

The backup reviewer added shared concurrency reservation before expensive payload work. HTTP now limits manual run/test attempts to 12 per hour per account/client, returns the busy helper status/code, and does not record a false failure over the currently running operation. Scheduled jobs similarly skip busy results. API regressions execute the actual extracted route logic and assert the number of work/outcome calls; helper regressions check allocation and slot release.

### Verified unused transport and code removed

Removed `/api/backup/upload/{start,chunk,preview,apply}` after checking browser/tests/docs references. Current inspect/import transport is preserved. Removed its exclusive filesystem imports, upload temporary-directory setup, account cleanup and periodic shared-temporary-file deletion. Kept CLI temporary storage independent. Removed uncalled `validRecordPeriod`; `validStoredRecordPeriod` remains for legacy data. The backup reviewer removed only the unreachable post-validation type skip. Frontend removals are listed separately.

## Additional negative coverage

`tests/http-security.test.mjs` adds direct/trusted proxy throttle, member/admin denial, bad origin/content type/body rejection without mutation, removed transport plus current inspect availability, external rate/busy outcome and session revocation during a delayed import body. The latter confirmed an existing protection rather than introducing another session workaround.

## Limits

Current configured JS syntax/build/test gates are used; there is no separate lint/type-check configuration. Review does not prove absence of vulnerabilities. Host/root control, public DNS/TLS, third-party service availability, browser privacy extensions and real production configuration were not remotely penetration-tested. CLI restore requires a stopped app. Synchronous cryptographic work and finite backup limits remain design constraints of this single-process personal application; concurrency/rate guards reduce the identified abuse path without claiming unlimited capacity.
