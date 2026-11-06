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

Work commit: `1c1a2869d2dfbe5d0a29ba7997547573de2e2bd6`.

[Verify build run 42197939382](https://github.com/hikling/shendu-v1/actions/runs/42197939382), Ubuntu 24.04 / Node 24: all steps **success**.

- **46** isolated installation/update/snapshot scenarios passed (the shell source has 33 standalone `new_case` lines plus loop-expanded cases; the runtime total is authoritative).
- All deployment shell syntax passed.
- Locked dependency installation, genuine UI build, production syntax gate and **179/179** tests passed.
- Resolved Compose configuration passed, including proxy secret isolation and explicit forwarding trust on the private application upstream.
- Real Docker image built successfully; running container returned healthy. Log confirmed `Health, HTML, app module and local shadcn JS/CSS passed.` The initial poll during startup was retried normally before success.
- Installer scenarios use isolated PATH mocks; no real host package installation or live deployment mutation was performed. Actual image build/start is a separate true-container check.

The independent integration report also records a final **17/17** verification/backup/overlay increment review. No confirmed unresolved defect was identified. No UI CSS, artwork or product-content edits were included.

## Scope

No visual CSS/illustration/content redesign, production database change, live deployment or live external-provider testing. Proven dead code and duplicate snapshot orchestration removed; supported file parsers and compatibility data retained. Source coverage is in `research/http-and-inventory.md`, `backups.md`, `frontend.md`, `deployment.md`, and `integration-review.md`; public summary is `docs/security-audit.md`.
