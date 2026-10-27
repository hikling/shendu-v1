# Frontend State and Data

## State

`state` in `shendu/public/app.js` holds the user, stage, theme, records, stats, route, current record, dirty/saving flags, and menu/rail state. `boot()` calls `refreshData()` for `/api/me`, `/api/records`, and `/api/stats`, then opens `overview`. `applyTheme()` maps saved colors to CSS variables.

Use `request()` for JSON API operations. It sends same-origin credentials and handles error responses. `sessionExpired()` keeps unsaved form content while reauthentication is shown. Escape data placed into template HTML with `esc()`; `toast()` uses `textContent`.

## Review lifecycle

- `newRecord()` defines draft shape; `renderReview()` loads a record or draft. `templatesForRecord()` respects the saved template snapshot.
- `bindReview()` marks editable inputs dirty. `collectCurrent()` copies current DOM values into `state.current.data`. Collect before a rerender that replaces form nodes; `renderReviewFromCurrent()` demonstrates this for add/remove item actions.
- `saveCurrent()` explicitly sends `PUT /api/records`, updates the record cache, and clears dirty state. The current app has no automatic draft save.
- `validateCurrent()` checks required answers before `completeCurrent()` confirms and locks the record. Completed and historical records are read-only. The server also enforces period, version, and status rules.
- `attemptNavigate()` and `beforeunload` warn about unsaved changes. A local section switch must retain unsaved input and must not be treated as route departure.

Dates use `Asia/Shanghai` in `today()`, `defaultPeriod()`, and related frontend helpers, matching `currentPeriodFor()` in `server.mjs`. Preserve record shape, `version`, `draft/completed/verified` statuses, and template snapshots unless an API migration is explicitly planned.

## Overview read contract

`renderOverview()` reads the existing `state.records` cache. `overviewCompletedRecords(records,TYPES)` includes only records whose `type` is an own key in `TYPES` and whose status is exactly `completed`; `overviewRecords()` shuffles that selection on each overview render and takes at most 12 records. Drafts, verified records and unknown types never appear (user explicitly excludes action-verification content from this reel). The long reel repeats the selected records to fill at least 12 motion slots; copies beyond the original selection have `aria-hidden="true"` and `tabindex="-1"` and disappear in static reading mode. A record card resolves its exact `id` from `state.records` and opens `renderReview()` with that record, so two records on the same date cannot be confused. The overview does not write records or change API payloads.

`overviewRecordAppearances(records,random)` in `overview-reel.js` assigns a per-record-ID Map from all 15 local authorized `assets/reel-emotions/` illustrations, once per overview render. Explicit keywords in title, answers, actions, metrics and journal select unique best matches first and reserve those images; do not read verification result/adjustment. For no match, draw randomly from the full pool with unused images preferred until the pool is exhausted; ties choose from best-scoring themes, preferring unused. New overview visits may change fallback images, but loop copies within one render must share the same Map entry. Layout remains stable by ID, except a date-only title uses the full-width note layout. Selection runs solely in the browser; do not transmit record contents or persist an image field. Asset provenance belongs in the asset folder README. Tests must prove all15 can be drawn, no-match diversity, match priority, duplicate consistency and exclusion of verified records.

`overviewRecordTitle()` recognizes legacy default titles containing the same period in dotted, slashed, hyphenated or Chinese forms, normalizes that occurrence to `formatDate()` and displays it only once. Do not remove genuine title wording or other dates; do not change stored records. Test the actual imported `每日复盘 · 2026.09.16` form, not just exact string equality, plus blank and custom titles and other period types.

For a reel period in YYYY-MM-DD, `overviewDateParts()` provides a calendar-date line and full 星期一/星期日 weekday line from the stored period; use both lines in the card, including with a custom title. Split the normalized period out of legacy titles instead of displaying it twice. Weekly/monthly/yearly periods continue to use `formatDate()`. Do not change other views or stored data.
