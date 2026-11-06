# Security and dead-code audit

## Goal
Review the project's production code and deployment tools, prioritizing backup import/export and one-command installation. Fix verified defects and remove proven unused code without changing the approved product/UI.

## Requirements
- Review authentication/authorization, sessions, HTTP input and origin checks, static serving, encrypted storage, personal/site/snapshot backup formats, import validation/rollback, external backup requests, browser rendering and async ownership, deployment/update/backup scripts, build/dependencies and container configuration.
- Record coverage by file/domain and findings with reproducible triggers, actual impact, fixes and verification.
- Exercise successful backup round trips and failed restore attempts against isolated data; protect cross-account ownership, old supported formats, original keys and original records.
- Verify install/rerun/failure behavior and configuration/data preservation; do not execute host package installation or affect a real deployment during testing.
- Delete only code whose lack of use is verified, accounting for dynamic dispatch, compatibility paths, generated assets and test fixtures.
- Preserve visual layout, product wording and normal workflows. Do not promise absolute vulnerability freedom or delete historical Trellis/QA evidence as cleanup.

## Acceptance
- All production source/config groups have an explicit coverage entry; real issues are fixed or described with concrete remaining constraints.
- Every security fix has meaningful regression evidence, and affected old-format and success paths still pass.
- Build, syntax, all tests, isolated Linux deployment scenarios, dependency advisory review, diff check and real container smoke complete.
- Review report documents removed dead code and retained compatibility code. Changes synchronized to main with exact-SHA CI evidence and task closure.
