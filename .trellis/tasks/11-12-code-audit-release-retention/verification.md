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

- Code commit: `caf2887bd09e22ecff3fafc52df8b4e985008c78`; application tree: `6bc42050193eccd2e2efc08afa128c3c37fd7c8d`.
- [GitHub Actions run 43418605273](https://github.com/hikling/shendu-v1/actions/runs/43418605273): completed/success. Handover, both native architecture verification jobs, publication and both public-download smoke jobs succeeded.
- Refreshed inventory had **17** published releases. The reviewed `release-plan.json` protected the latest four by published_at and required complete uploaded amd64/arm64 images and checksums. `retain-releases.ps1 -Mode Apply` rechecked each release's ID/tag/date and the protected set before deletion.
- Cleanup completed on 2026-11-13: **13** obsolete Releases deleted, **4** retained, final inventory and assets verified. `release-retention-result.json` records every deleted/retained ID, tag, publication date and asset summary. No Git deletion endpoint was used; a fresh remote-tag listing confirmed all **17** source tags remain.
- Retained application trees, newest first: `6bc42050193eccd2e2efc08afa128c3c37fd7c8d`, `98037b3e0fd34acdbb5954fc5550576699195e53`, `a5fbe2e2c9f3987782c620fb82ac81bf86891c29`, `720aceb0bcfed89a389e03fade90c355cfff9753`.
- Final evidence/archive/journal commits only affect documentation and task records, so they reuse the same verified application tree and Release rather than creating a fifth release.

No deployed database, real account, master key or third-party storage contents were accessed or changed. Local tests and source review are scoped evidence, not proof that every possible vulnerability is absent.
