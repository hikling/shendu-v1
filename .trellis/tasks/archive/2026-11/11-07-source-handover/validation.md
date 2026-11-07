# Source handover validation — 2026-11-07

- Work commit: `fc787703658a1e6d9ab682dc36ca347b76b2b1b9`.
- Application tree unchanged: `9eeb45427c0ab012bc1bcd6cc546cde82eb22de9`.
- Candidate ZIP generated from Git objects, verified and extracted to a new workspace sibling. Independent reviewer confirmed all 488 selected files equal committed blobs, including all 249 tracked application files, all 72 original-art source files and five synthetic encrypted compatibility fixtures. No real configuration, keys, databases or personal backups included. Handbook local links resolve inside the ZIP.
- Root packaging regressions: 22 tests passed on Windows/Python3.14; two output-symlink subcases skipped because host lacks symbolic-link privilege. Ubuntu/Python3.11 CI must exercise those before completion. Tests include dirty-source refusal, exact Git bytes/CRLF/modes, concurrent HEAD change, credential exclusion/detection, corrupt manifests/checksums, unsafe paths, content membership, size limits, no-clobber and reproducibility.
- From the extracted package with no existing dependencies: `npm ci --no-audit --no-fund` installed 152 packages using a new task-scoped cache (22s). `npm run check` passed. `npm test` built Vite successfully (3.55s) and passed all 179 application tests (29.997s), including backup compatibility/security and UI/date regressions.
- Extracted server started against a separate synthetic data directory and new random key on port43133. `npm run smoke:ui -- http://127.0.0.1:43133` passed actual health, HTML, app JS and local shadcn JS/CSS checks. Server stopped after verification.
- Public GitHub API confirmed the existing immutable application release contains Linux amd64/arm64 image archives and SHA-256 assets. No production server was accessed or modified.
- Reviewers reported no remaining source-completeness, documentation or privacy findings after fixing dot-path validation and pinning all Git reads to the captured commit.

Main synchronization passed. [GitHub Actions42347735109](https://github.com/hikling/shendu-v1/actions/runs/42347735109) completed all six jobs successfully: source handover/Python3.11 Linux regressions, native amd64/arm64 verification, immutable publication, anonymous download/load/start/reuse smoke on both architectures. No remaining skip depends on Windows link privilege in the Linux gate.

Delivery procedure: archive/journal, then generate and reverify the final exact-main ZIP and adjacent SHA-256 outside the source checkout. Bookkeeping commits are excluded from archive content apart from their source identity; no application changes occur after the extracted-source acceptance.
