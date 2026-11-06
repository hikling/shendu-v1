# Implementation plan

1. Implement bootstrap and app orchestration with configuration/data preservation and clear failures.
2. Add isolated Linux behavioral tests and wire them into CI; enforce LF for shell sources.
3. Replace README multi-step server install with the single command and domain prompt; remove showcase image. Synchronize detailed deployment and migration wording while keeping anchors.
4. Document the deployment interface and invariants in backend operations specs.
5. Run POSIX shell syntax checks, Linux mocked installer scenarios, npm build/check/tests and git diff --check. Independent review of scripts, tests, docs and scope.
6. Commit/push main, check exact-SHA Linux CI (including real container build/smoke), fix actual issues if necessary, archive task and record journal, then synchronize closure commits.
