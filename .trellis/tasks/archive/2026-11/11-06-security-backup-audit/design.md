# Audit design and boundaries

## Threat model
Inputs include unauthenticated HTTP clients, authenticated members/admins, imported encrypted or legacy backup files, configured remote backup endpoints and server installation arguments/configuration. Protect account isolation, session integrity, availability, filesystem boundaries and encryption keys. A host administrator already controls the running server; do not misclassify that trusted capability as a web privilege escalation.

## Ownership and flow
- Backup reviewer: server backup/parser/import/export/remote-target functions, scripts/admin-cli.mjs and backup-safety.mjs, backup-security tests. Initially report evidence; implement scoped confirmed backup fixes without touching unrelated auth/routes, coordinating shared server.mjs edits.
- Deployment reviewer: root installer, scripts/{install,update,site-backup,docker-entrypoint}.sh, Docker/Compose/Caddy/env/build workflow, Linux shell tests. May implement verified fixes and regressions within these files.
- Frontend reviewer: public app/modules and ui components/runtime, build/license helper; verify escaping, request/file handling, root ownership and unused code. No visual redesign; implement only verified safe fixes/cleanup with tests.
- Root: HTTP/auth/session/static/storage and API integration in server.mjs, dependency audit, inventory/report, cross-review, specs, testing/CI and Git closure.

## Change rules
Use narrow patches at actual trust boundaries, keep supported backup formats and frontend native form semantics, and preserve transactions/rollback. No mass formatting, architecture rewrite, speculative cleanup or live data access. Share findings before touching common server backup API branches. Test with generated isolated dummy accounts/keys only; never read or output production secrets.

## Verification
Targeted behavioral tests demonstrate exploit/failure before a fix and safe behavior afterward. Existing full suite covers compatibility and regressions. Linux CI handles true POSIX script scenarios and actual container build/smoke. Audit dependency advisories against locked versions and separate production/browser reachability from build-only findings. Record limitations (no claim of exhaustive proof or live penetration test).
