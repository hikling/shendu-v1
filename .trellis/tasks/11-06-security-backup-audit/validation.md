# Validation

## Local final source gate

- `npm run check`: passed; configured production JavaScript syntax gate. No separate lint/TypeScript gate exists.
- `npm test`: builds the genuine shadcn UI and licenses, then **179 passed / 0 failed / 0 skipped**. Includes personal/site/snapshot backup success and rejection, five legacy fixtures, rollback and key preservation, SSRF/transport/concurrency, auth/role/origin/slow-body session checks, actual DOM auth/backup/verification ownership and all existing product/date regressions.
- POSIX `sh -n` on root install, application install/update/site-backup/entrypoint and isolated scenario suite: passed using bundled shell. No claim of Windows-based Linux behavior validation.
- `git diff --check`: passed. LF/CRLF informational notices only on non-shell files.
- Task context manifest validation: passed.
- `npm audit --json --registry=https://registry.npmjs.org`: zero known advisories across all locked dependencies on 2026-11-06; no dependency changes needed.
- Tracked-source secret-pattern scan: no matching OpenAI-style key/private-key blocks in scanned small files. No production secrets accessed or printed. Not a Git-history scan.
- Independent integration reviewer: original targeted 18/18 passed; final verification-dialog increment reviewed separately in the integration report.

## Linux and container gate

Pending exact-work-commit GitHub Actions result. Required before task closure: all 33 isolated install/update/snapshot scenarios, shell syntax, Node build/check/all tests, resolved Compose secret/proxy assertions, real image build, running container health and actual local HTML/JS/CSS smoke. No real host package installation is part of these mocked installer scenarios.

## Scope

No visual CSS/illustration/content redesign, production database change, live deployment or live external-provider testing. Proven dead code and duplicate snapshot orchestration removed; supported file parsers and compatibility data retained. Source coverage is in `research/http-and-inventory.md`, `backups.md`, `frontend.md`, `deployment.md`, and `integration-review.md`; public summary is `docs/security-audit.md`.
