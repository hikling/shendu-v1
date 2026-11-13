# Verification

## Isolated local checks (2026-11-12—13)

- `npm run check --prefix shendu`: passed.
- `npm test --prefix shendu`: Vite production build and **323/323** tests passed, no skipped/cancelled cases. Repeated after the final completion/stats/401 integration changes.
- `python -B -m unittest discover -s tests -p test_package_handover.py -v`: **13/13** passed.
- Official-registry `npm audit --json` with the existing lockfile: **0** known vulnerabilities in every severity category. No automatic dependency changes.
- `git diff --check`: passed.
- Release-retention script: PowerShell parser passed; read-only Plan successfully enumerated 16 existing releases and validated the four baseline retained releases' assets. The actual cleanup plan will be refreshed after the new application release passes CI.

## Focused regression and independent review

- Auth/record API: 39/39; seven new integrity cases include historical identity changes, duplicates, locked/foreign rows, and transaction failures. See research/auth-records.md.
- Backup/schedule: 38/38; actual schema reporting: 2/2. See research/backup.md.
- Admin/review and related component UI: 61/61; 21 new admin/review write cases use real app functions and the built shadcn bridge. See research/frontend.md.
- Final review-write cases: **16/16**, including real request/sessionExpired 401 behavior, completed-state retention through reauthentication, obsolete stats/save/refresh rejection and live header counts. Final independent source cross-check found no additional blocker.
- Independent source cross-check confirmed server rollback/ownership/health boundaries and deployment behavior. See research/deployment.md. No additional confirmed blocker found in those scopes.
- README and docs/security-audit.md reflect current product functionality, manual recovery limitations, and audit boundaries. Backend/frontend specs capture the fixed write contracts.

## Release and main synchronization

Pending the code commit's Linux CI: native amd64/arm64 syntax, isolated install/update/snapshot scenarios, full test/build, image health/resources, publication and anonymous deployment downloads. Cleanup will keep the newest four by published_at, including the current application tree, and preserve Git tags/commits. Initial public inventory is in releases-initial.json; refreshed plan and final deletion/retention evidence will be saved alongside this file.

No deployed database, real account, master key or third-party storage contents were accessed or changed. Local tests and source review are scoped evidence, not proof that every possible vulnerability is absent.
