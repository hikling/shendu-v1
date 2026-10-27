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

`renderOverview()` reads the existing `state.records` cache. `overviewRecords()` includes only records whose `type` is in `TYPES` and whose status is `completed` or `verified`; it shuffles on each overview render and takes at most 12 records. Drafts never appear. The long reel repeats the selected records to fill at least 12 motion slots; copies beyond the original selection have `aria-hidden="true"` and `tabindex="-1"` and disappear in static reading mode. A record card resolves its exact `id` from `state.records` and opens `renderReview()` with that record, so two records on the same date cannot be confused. The overview does not write records or change API payloads.

`overviewRecordAppearance(record)` in `overview-reel.js` selects from the local authorized `assets/reel-emotions/` illustrations using explicit keywords in title, answers, actions and journal. A unique best match selects that illustration; no match or ambiguous tie uses a stable record-ID hash. Selection runs solely in the browser; do not transmit record contents to any service or persist an image field. Identical record data must produce identical art across shuffles and duplicates. Layout also uses stable ID, except a date-only title uses the full-width note layout. Do not derive either from shuffled index. Asset provenance belongs in the asset folder README.

`overviewRecordTitle()` recognizes legacy default titles containing the same period in dotted, slashed, hyphenated or Chinese forms, normalizes that occurrence to `formatDate()` and displays it only once. Do not remove genuine title wording or other dates; do not change stored records. Test the actual imported `每日复盘 · 2026.09.16` form, not just exact string equality, plus blank and custom titles and other period types.
