# Frontend State and Data

## State

`state` in `shendu/public/app.js` holds the user, stage, theme, records, stats, route, current record, dirty/saving flags, and menu and calendar month state. `boot()` calls `refreshData()` for `/api/me`, `/api/records`, and `/api/stats`, then opens `overview`. `applyTheme()` applies the fixed `DEFAULT_ACCENTS`, computes contrast and honors saved `reduceMotion`; old preset/color fields remain data-compatible but no longer select UI colors.

Use `request()` for JSON API operations. It sends same-origin credentials and handles error responses. `sessionExpired()` keeps unsaved form content while reauthentication is shown. Escape data placed into template HTML with `esc()`; `toast()` passes a plain string to the singleton Sonner component, never raw HTML.

## Review lifecycle

- `newRecord()` defines draft shape; `renderReview()` loads a record or draft. `templatesForRecord()` respects the saved template snapshot.
- `bindReview()` marks editable inputs dirty. `collectCurrent()` copies current DOM values into `state.current.data`. Collect before a rerender that replaces form nodes; `renderReviewFromCurrent()` demonstrates this for add/remove item actions.
- `saveCurrent()` explicitly sends `PUT /api/records`, updates the record cache, and clears dirty state. The current app has no automatic draft save.
- `validateCurrent()` checks required answers before `completeCurrent()` confirms and locks the record. Completed and historical records are read-only. The server also enforces period, version, and status rules.
- `attemptNavigate()` and `beforeunload` warn about unsaved changes. A local section switch must retain unsaved input and must not be treated as route departure.

Daily question switching keeps all inputs mounted and collects before advancing. The daily fact/cause disclosures preserve closed textarea nodes in collection; only one row is open per question, adding opens/focuses the new row, removing opens/focuses its retained neighbor and validation reveals a closed target. Preview/disclosure state is UI-only and never added to record data. dailyPromptOwner() maps ifThen errors/navigation to the paired ifCondition screen without changing either saved field or final domain requirements. Local switches never write to the server. `dailyPromptIssues()` gates only the currently visible question (including both ifCondition/ifThen fields at their shared ifCondition stop), so an empty future action must not block an optional earlier question. Final `dailyStepIssues()` retains the domain requirements: evidence/cause/journal optional, at least one nonblank today answer, action/ifCondition/ifThen and a valid date no earlier than today. Final completion still runs server validation. Errors reveal and focus the exact prompt; failures retain data/prompt for retry. Busy writes disable competing controls and exit navigation. Read-only records bypass writing validation and expose original verification/pending content at the end. Metric prompts use the record's actual metric count and names. Keep prompt identity through answer redraw and first-save ID changes; never overwrite a historical template snapshot. Do not change the other five forms' payloads or validation.

The five extended review flows also keep all inputs mounted. `state.extendedPrompt` is UI-only and survives answer add/remove rerenders, save and completion. `extendedPromptIssues()` gates one visible question; `extendedReviewIssues()` repeats the original final requirements before lock. The paired `ifThen` screen collects both original keys but requires only `data.ifThen`; `data.ifCondition` remains optional in all five, unlike daily. Errors reveal and focus the missing required response. Decision title uses `state.current.title`, and the original `data.answers` arrays, `data.action`, `data.verifyDate`, period, version and template snapshot remain unchanged. Save and reload must recover every closed answer disclosure. See [Extended review flows](./extended-review-flow.md) for the full matrix.

Dates use `Asia/Shanghai` in `today()`, `defaultPeriod()`, and related frontend helpers, matching `currentPeriodFor()` in `server.mjs`. Preserve record shape, `version`, `draft/completed/verified` statuses, and template snapshots unless an API migration is explicitly planned.

All six review flows now use the always-visible verifyDate calendar backed by the same YYYY-MM-DD field. `verificationMinimum()` in `public/verification-policy.js` supplies the type-specific earliest date; daily uses today, weekly/monthly/quarterly/yearly wait 7/30/90/250 calendar days from completion, and decision begins three calendar months after completion. Explicit day/earliest-eligible-day selection updates its mounted hidden input and dispatches the existing input/dirty path; browsing or moving keyboard focus never selects/saves. Saved and reloaded values restore month/selection; read-only disables all changes but displays the original date. Calendar redraw preserves current error association on the visible roving day; required errors focus that day, never the hidden input. Busy guards and `setReviewBusy()` apply to newly rendered controls as well. Do not persist displayed month/focus state in record data.

## Overview read contract

`renderOverview()` reads the existing `state.records` cache. `overviewVerifiedRecords(records,TYPES)` includes only records with an own `TYPES` key and status exactly `verified`, then deduplicates by category and period (calendar quarter for the date-shaped quarterly periods). Decisions use the event/record ID, so different events on the same day remain separate. Duplicate keys keep the most recently verified version, using valid verification timestamps, then updated_at, then created_at as the last per-record fallback; never mutate stored records. `overviewRecords()` shuffles the full deduplicated list once per overview render, without a 12-record limit. Every unique record belongs to each complete round, and only after the whole round does the same order repeat. Card excerpts use verification result, adjustment, then the existing original-record summary as fallback. No verified records produces a verification-specific empty state with a route to action verification, not the old first-review prompt.

The motion reel fills the measured path with a whole number of complete rounds. DOM clones have `aria-hidden="true"` and `tabindex="-1"`, keep the exact original record ID/art, and disappear in keyboard/static/reduced-motion reading. Resize recomputes the required number of complete groups. Track-level click delegation must handle both originals and new clones and resolve the exact stored record by ID before `renderReview()`. The overview does not write records or change API payloads.

`overviewRecordAppearances(records,random)` in `overview-reel.js` assigns a per-record-ID Map from all 15 local authorized `assets/reel-emotions/` illustrations, once per overview render. Matching first considers verification result/adjustment; when these do not match a theme it considers title, answers, actions, metrics and journal. Unique best matches reserve their images first. For no match, draw randomly from the full pool with unused images preferred until the pool is exhausted; ties choose from best-scoring themes, preferring unused. New overview visits may change fallback images, but loop copies within one render must share the same Map entry. Layout remains stable by ID, except a date-only title uses the full-width note layout. Selection runs solely in the browser; do not transmit record contents or persist an image field. Asset provenance belongs in the asset folder README. Tests must prove all15 can be drawn, no-match diversity, match priority, duplicate consistency and verified-only selection plus period/event deduplication.

`overviewRecordTitle()` recognizes legacy default titles containing the same period in dotted, slashed, hyphenated or Chinese forms, normalizes that occurrence to `formatDate()` and displays it only once. Do not remove genuine title wording or other dates; do not change stored records. Test the actual imported `每日复盘 · 2026.09.16` form, not just exact string equality, plus blank and custom titles and other period types.

For a reel period in YYYY-MM-DD, `overviewDateParts()` provides a calendar-date line and full 星期一/星期日 weekday line from the stored period; use both lines in the card, including with a custom title. Split the normalized period out of legacy titles instead of displaying it twice. Weekly/monthly/yearly periods continue to use `formatDate()`. Do not change other views or stored data.

When waiting rules change, derive the eligibility date of existing completed records from their original completed_at (created_at fallback), without rewriting verifyDate, answers, status or prior verification. dueBadge must report waiting before that absolute minimum even when an old expected date has passed; action buttons and submission guards use the same earliestActualVerification boundary. Already verified records retain their original result and timing.

## Motion preference compatibility

### Scope / trigger
Theme-color controls and `openTheme()` are removed. Settings owns the independent motion checkbox; old accounts must retain saved compatibility fields.

### Signatures
`renderSettings()` binds `#motion-form`; `PUT /api/settings` still accepts `{theme}` and returns the existing settings object. No server/schema change.

### Contracts
Read `new FormData(form).get('reduceMotion') === 'on'`, spread `state.theme`, then update only `reduceMotion`. Preserve preset, three colors and unknown compatibility fields. Apply returned theme only on success. `DEFAULT_ACCENTS` determines displayed colors on every load, including all-white legacy values.

### Validation / error matrix
Unchecked -> send false. Pending -> one request, disabled fieldset/buttons and guarded departure. Failure -> retain checkbox, original saved state and dirty flag for retry. Completion checks the connected form, account and request owner; old finally handlers cannot release a newer write.

### Good / base / bad cases
Legacy all-white account retains fixed readable accents; ordinary accounts can save either motion value; a failed save must never silently reset the checkbox or drop legacy data.

### Tests required
`tests/settings-motion.test.mjs` executes real form/API behavior: legacy colors, true/false, unknown field preservation, failure retry and obsolete form/account completion guards. Browser-check the genuine checkbox/label, saved motion and narrow layout in an isolated fixture without changing real account preferences.

### Wrong vs correct
Wrong: save `{theme:{reduceMotion:true}}`, apply legacy colors or add another color menu. Correct: save `{theme:{...state.theme,reduceMotion:checked}}` and derive visual accents from `DEFAULT_ACCENTS`.

## Workspace navigation and stage writes

`settings`, `calendar`, `stage-settings` and `guide` are ordinary routes. Their navigation uses `attemptNavigate()`; motion/stage edits mark dirty, pending writes block departure, and failure retains the mounted values. Stage configuration submits every original stage/metric field,49 review-template keys and4 action prompts, retaining unknown compatibility metadata. Success applies only to the connected original form/account/write owner. Calendar review entry captures month/scroll/date focus as source context; review exit restores it instead of overview. Global Ctrl/Cmd+S requires an actual review route, never merely a retained current record.
