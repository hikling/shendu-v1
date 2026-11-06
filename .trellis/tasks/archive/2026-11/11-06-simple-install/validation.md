# Validation

- Boundary checked: application UI/source, illustrations, business rules, database and Compose/Docker runtime configuration unchanged.
- Local `npm run check`: passed.
- Local `npm test`: passed, including Vite production build and all 155 tests.
- POSIX `sh -n` for root bootstrap, application installer and installer suite: passed.
- `git diff --check`: passed.
- Independent documentation review found and corrected the working-directory prerequisite in the public-health check example.
- Independent Trellis code review added explicit CI syntax checks and regressions preventing key generation when a data symlink exists without .env.
- First Ubuntu run passed 31 installation scenarios, then exposed an overly broad assertion: checking for any `pull` also matched legitimate Docker image downloads. Scoped the assertion to Git fetch/pull/reset commands; installer behavior was correct. Exact-commit rerun outcome will be recorded below.
- Linux mocked installation suite and real Docker build/resource smoke are wired into the existing Ubuntu CI. Local machine has no runnable Linux Docker/WSL environment, so no claim of local server installation is made.
- Exact work commit `78a83b625f98a48634172f4d575a3476343e1569`: all Ubuntu CI steps passed, including shell syntax, complete isolated installer scenarios, locked npm install, build/check/155 tests, Compose validation, real Docker build and running-container health/HTML/JS/CSS smoke. Run: https://github.com/hikling/shendu-v1/actions/runs/42191948769 .
- Downloaded the published README installation URL and verified its SHA-256 equals the local reviewed bootstrap. README showcase image removed; existing product description and deployment anchors retained.
