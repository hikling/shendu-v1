# Verification — 2026-11-10

- `npm run check --prefix shendu` passed.
- `npm test --prefix shendu` built the production component bundle and passed all 281 tests, with no failures or skips. This includes 8 new isolated HTTP/database tests and 12 usage-log UI tests running the actual app owners against the production component bridge.
- After adding the missing backup-password label to the existing complete-enum assertion, the 12 usage-log UI tests passed again. No production code changed after the full run.
- Isolated startup smoke passed: health, HTML, app JavaScript and built shadcn JavaScript/CSS returned successfully. A synthetic account created/saved/deleted a draft and received the corresponding login/save/delete usage entries. The smoke process and its temporary directory were removed.
- Backend independent read-only review found no blocking issues in atomic event writes, fixed-field privacy, own-account/day cursor boundaries, old-database migration or site-backup compatibility. The review identified that real external-backup success was not exercised in the new HTTP file; failure was exercised and both use the same transactional outcome helper.
- API regression checks cover all six review lifecycles, Beijing midnight boundaries, future timestamps, 121-event keyset pagination, cursor isolation, authentication, connection-test exclusion, the existing bodyless target-delete request, failed-log rollback, personal/site restore and old databases without events.
- UI checks cover Chinese fixed labels, escaping and ignored private payload fields; native dates and Beijing today; previous/next/today; empty and retry states; paging/deduplication; and stale page/account/day success or failure responses.
- CSS parses with PostCSS; `git diff --check` passed. Hero/filter border and section-rule ownership were reviewed from their scoped selectors.
- Browser use is disabled in the current Work session. Actual desktop/mobile screenshot and keyboard/layout acceptance were not performed; component checks and source review do not replace that visual acceptance.

The log starts at feature activation. Migration does not invent prior events. Personal backups remain compatible; site backups preserve optional activity metadata and accept old files without it. Schema 8 is additive, so startup creates the empty event table for existing databases.
