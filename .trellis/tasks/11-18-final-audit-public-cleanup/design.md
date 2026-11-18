# Boundary and execution design

Audit existing implementation rather than adding product behavior. Independent review domains: auth/reviews/server writes; finance/receipt integrity; backups/schedules/frontend async. Root owns deployment, dependencies and cross-domain integration. Reviewers own only their research reports until triage, preventing shared-server conflicts. Fix only confirmed defects with meaningful regression coverage.

Root README/deployment and .gitignore changes implement the repository-cleanup request. Development directories remain intact via `git rm --cached`, never filesystem deletion. Compare file hashes/count before and after index-only removal; add anchored ignores. Do not purge history or tags. Finish local task/journal before untracking, because Trellis normally auto-commits records.

Publication stages: fixes/docs first while workflow remains; validate exact shendu tree and six jobs, retain four complete releases. Then untrack four requested paths; verify final main has the identical published application tree and local directory hashes unchanged. Subsequent bookkeeping stays local. No production account/bucket/database access. No broad dependency upgrade without confirmed advisory and compatibility evidence.
