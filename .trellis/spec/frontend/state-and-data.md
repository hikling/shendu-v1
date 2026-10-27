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

`overviewRecordAppearance(record)` uses a stable hash of `record.id` to select the decorative local `assets/reel/reel-01.svg` through `reel-06.svg` and the `story`/`note` layout. Do not derive appearance from the shuffled array index, loop slot or current time: duplicate cards for one record must match, and refresh/order changes must not replace that record's art or layout. The decoration is independent of record type/content and is not a new persisted image field. Category, date, title, excerpt and the status label continue to come from the actual record, `TYPES`, `formatDate()` and `STATUS`; never add invented metrics or progress to fill the card. Artwork uses `aria-hidden` and no pointer interaction. Asset provenance and recoloring mappings belong in `public/assets/reel/README.md`.

When a reel record title is empty or equals its formatted period after whitespace normalization, show that period once as the primary title instead of repeating it as both date and title. Keep a separate period for genuinely different custom titles; do not modify stored records.
