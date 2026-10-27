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

Daily question switching keeps all inputs mounted and collects before advancing. Local switches never write to the server. `dailyPromptIssues()` gates only the currently visible question, so an empty future action must not block an optional earlier question. Final `dailyStepIssues()` retains the domain requirements: evidence/cause/journal optional, at least one nonblank today answer, action/ifCondition/ifThen and a valid date no earlier than today. Final completion still runs server validation. Errors reveal and focus the exact prompt; failures retain data/prompt for retry. Busy writes disable competing controls and exit navigation. Read-only records bypass writing validation and expose original verification/pending content at the end. Metric prompts use the record's actual metric count and names. Keep prompt identity through answer redraw and first-save ID changes; never overwrite a historical template snapshot. Do not change the other five forms' payloads or validation.

Dates use `Asia/Shanghai` in `today()`, `defaultPeriod()`, and related frontend helpers, matching `currentPeriodFor()` in `server.mjs`. Preserve record shape, `version`, `draft/completed/verified` statuses, and template snapshots unless an API migration is explicitly planned.

## Overview read contract

`renderOverview()` reads the existing `state.records` cache. `overviewVerifiedRecords(records,TYPES)` includes only records with an own `TYPES` key and status exactly `verified`, then deduplicates by category and period (calendar quarter for the date-shaped quarterly periods). Decisions use the event/record ID, so different events on the same day remain separate. Duplicate keys keep the most recently verified version, using valid verification timestamps, then updated_at, then created_at as the last per-record fallback; never mutate stored records. `overviewRecords()` shuffles the full deduplicated list once per overview render, without a 12-record limit. Every unique record belongs to each complete round, and only after the whole round does the same order repeat. Card excerpts use verification result, adjustment, then the existing original-record summary as fallback. No verified records produces a verification-specific empty state with a route to action verification, not the old first-review prompt.

The motion reel fills the measured path with a whole number of complete rounds. DOM clones have `aria-hidden="true"` and `tabindex="-1"`, keep the exact original record ID/art, and disappear in keyboard/static/reduced-motion reading. Resize recomputes the required number of complete groups. Track-level click delegation must handle both originals and new clones and resolve the exact stored record by ID before `renderReview()`. The overview does not write records or change API payloads.

`overviewRecordAppearances(records,random)` in `overview-reel.js` assigns a per-record-ID Map from all 15 local authorized `assets/reel-emotions/` illustrations, once per overview render. Matching first considers verification result/adjustment; when these do not match a theme it considers title, answers, actions, metrics and journal. Unique best matches reserve their images first. For no match, draw randomly from the full pool with unused images preferred until the pool is exhausted; ties choose from best-scoring themes, preferring unused. New overview visits may change fallback images, but loop copies within one render must share the same Map entry. Layout remains stable by ID, except a date-only title uses the full-width note layout. Selection runs solely in the browser; do not transmit record contents or persist an image field. Asset provenance belongs in the asset folder README. Tests must prove all15 can be drawn, no-match diversity, match priority, duplicate consistency and verified-only selection plus period/event deduplication.

`overviewRecordTitle()` recognizes legacy default titles containing the same period in dotted, slashed, hyphenated or Chinese forms, normalizes that occurrence to `formatDate()` and displays it only once. Do not remove genuine title wording or other dates; do not change stored records. Test the actual imported `每日复盘 · 2026.09.16` form, not just exact string equality, plus blank and custom titles and other period types.

For a reel period in YYYY-MM-DD, `overviewDateParts()` provides a calendar-date line and full 星期一/星期日 weekday line from the stored period; use both lines in the card, including with a custom title. Split the normalized period out of legacy titles instead of displaying it twice. Weekly/monthly/yearly periods continue to use `formatDate()`. Do not change other views or stored data.
