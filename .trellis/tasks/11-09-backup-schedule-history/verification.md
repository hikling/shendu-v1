# Verification — 2026-11-09

## Scope and outcome

- S3 form labels and validation errors are Chinese. Safe connection settings and schedules are prefilled when editing; credentials remain blank. Type/period switching retains current input. Daily time and weekly weekday/time use Beijing time.
- Shared schedule helper and additive schema 7 migration replace elapsed-interval scheduling with Beijing calendar slots. Existing plans start with 02:00 / Monday defaults and an upgrade-time anchor. Manual backups and connection tests do not shift scheduled slots. A five-minute token lease allows an interrupted run to retry after restart; confirmed success/failure consumes the slot atomically with its log.
- Recent runs contain target name/type snapshots, execution source, result and message. The API returns all real backup successes/failures from today and the preceding nine Beijing dates, excluding future entries and connection tests. Positively identified old test dates are repaired; ambiguous old failures are not assigned invented provenance.
- The action verification original plan now uses a title above its full text, with spacing consistent with the result/adjustment content.
- Site export/restore and CLI snapshot schema metadata preserve the new contracts. Existing credentials, encrypted storage, ownership checks, write limits and outbound-address restrictions are retained.

## Checks

- `npm run check --prefix shendu`: passed.
- `npm test --prefix shendu`: production build and 239/239 tests passed, no failed/skipped/cancelled tests.
- Targeted coverage includes the actual built React/shadcn form bridge, schedule CRUD and safe edit data, pending/failure behavior, manual empty-time recovery, Beijing day/week boundaries and host-timezone independence, busy/restart/stale-token handling, legacy database migration, encrypted site round trips, ten-day cutoff and complete result lists beyond the former 12-row cap.
- Independent final review found no blocking issues.
- Isolated server smoke passed for health, HTML, app module, built shadcn JS/CSS and the new shared schedule module (HTTP 200 with JavaScript MIME). The test process was stopped and temporary data removed.
- `git diff --check`: passed.

## Verification limits

The host reported local browser use disabled. No real browser desktop/mobile visual check was claimed; form behavior was exercised through the built component bridge and responsive rules were reviewed in source. Tests use isolated temporary data and controlled outbound stubs, without accessing user backup targets or real credentials.
