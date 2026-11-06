# Execution

1. Establish source inventory and coverage matrix; read runtime/security/frontend/deployment specs.
2. Parallel review: backups, deployment and frontend; root reviews HTTP/auth/storage and dependencies. Capture evidence and eliminate false positives.
3. Implement confirmed defects and proven dead-code cleanup within owners; add targeted negative/success regressions, preserving compatibility.
4. Independent check of combined patches and cross-boundary flows; update executable contracts/specs and audit report.
5. Run npm build/check/tests, all shell syntax and isolated Linux deploy scenarios, advisory review, git diff check, real Docker smoke in exact-SHA CI.
6. Commit/push main, confirm CI, archive and journal task, synchronize closure. Report concrete fixes, cleanup, verification and limits.
