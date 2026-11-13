# Frontend State and Data

## State

`state` in `shendu/public/app.js` holds the user, stage, theme, records, stats, route, current record, dirty/saving flags, and menu and calendar month state. `boot()` calls `refreshData()` for `/api/me`, `/api/records`, and `/api/stats`, then opens `overview`. `applyTheme()` applies the fixed `DEFAULT_ACCENTS`, computes contrast and honors saved `reduceMotion`; old preset/color fields remain data-compatible but no longer select UI colors.

Use `request()` for JSON API operations. It sends same-origin credentials and handles error responses. `sessionExpired()` keeps unsaved form content while reauthentication is shown. Escape data placed into template HTML with `esc()`; `toast()` passes a plain string to the singleton Sonner component, never raw HTML.

## Review lifecycle

Saved-review introductions are record identity, not a new random visit. All six types' draft/completed/verified rows choose from the fixed category pool using their stable ID, independent of content, status or timestamps. Explicit history/action/calendar/reel entries and implicit type/period recovery must resolve the same row before selecting. Keep the new unsaved visit's text through local redraw/first save; cancelled guards cannot consume a new choice. Do not reorder the existing stable quote slots without addressing saved-record consistency, and do not write quote metadata into record payloads merely to stabilize this presentation.

- `newRecord()` defines draft shape; `renderReview()` loads a record or draft. `templatesForRecord()` respects the saved template snapshot.
- `bindReview()` marks editable inputs dirty. `collectCurrent()` copies current DOM values into `state.current.data`. Collect before a rerender that replaces form nodes; `renderReviewFromCurrent()` demonstrates this for add/remove item actions.
- `saveCurrent()` explicitly sends `PUT /api/records`, updates the record cache, and clears dirty state. The current app has no automatic draft save.
- `validateCurrent()` checks required answers before `completeCurrent()` confirms and locks the record. Completed and historical records are read-only. The server also enforces period, version, and status rules.
- `attemptNavigate()` and `beforeunload` warn about unsaved changes. A local section switch must retain unsaved input and must not be treated as route departure.

Daily question switching keeps all inputs mounted and collects before advancing. The daily fact/cause disclosures preserve closed textarea nodes in collection; only one row is open per question, adding opens/focuses the new row, removing opens/focuses its retained neighbor and validation reveals a closed target. Preview/disclosure state is UI-only and never added to record data. dailyPromptOwner() maps ifThen errors/navigation to the paired ifCondition screen without changing either saved field or final domain requirements. Local switches never write to the server. `dailyPromptIssues()` gates only the currently visible question (including both ifCondition/ifThen fields at their shared ifCondition stop), so an empty future action must not block an optional earlier question. Final `dailyStepIssues()` retains the domain requirements: evidence/cause/journal optional, configured required answer questions (default today), action/ifCondition/ifThen and a valid date no earlier than today. Final completion still runs server validation. Errors reveal and focus the exact prompt; failures retain data/prompt for retry. Busy writes disable competing controls and exit navigation. Read-only records bypass writing validation and expose original verification/pending content at the end. Metric prompts use the record's actual metric count and names. Keep prompt identity through answer redraw and first-save ID changes; never overwrite a historical template snapshot. Do not change the other five forms' payloads or validation.

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

## Interaction preference compatibility

### Scope / trigger
Theme-color controls and `openTheme()` are removed. Settings owns independent reduce-motion and review-wheel checkboxes; old accounts must retain saved compatibility fields. Missing `reviewWheelNavigation` means enabled; explicit false disables it.

### Signatures
`renderSettings()` binds `#motion-form`; `PUT /api/settings` still accepts `{theme}` and returns the existing settings object. Server normalization includes the wheel preference without a schema change.

### Contracts
Read FormData before disabling the form, spread `state.theme`, then update `reduceMotion` and `reviewWheelNavigation` from their independent checkbox values. Preserve preset, three colors and existing compatibility fields in the outgoing payload. Apply returned theme only on success. `DEFAULT_ACCENTS` determines displayed colors on every load, including all-white legacy values.

### Validation / error matrix
Unchecked -> send false for that preference. Either checkbox differing from its saved value marks the form dirty. Pending -> one request, disabled fieldset/buttons and guarded departure. Failure -> retain both checkboxes, original saved state and dirty flag for retry. Completion checks the connected form, account and request owner; pass the same current predicate into `request` to suppress obsolete 401 side effects. Old finally handlers cannot release a newer write.

### Good / base / bad cases
Legacy all-white account retains fixed readable accents and defaults wheel navigation on; accounts can save either preference independently. A failed save must never silently reset checkboxes or drop legacy data.

### Tests required
`tests/settings-motion.test.mjs` executes real form/API behavior: legacy colors, independent true/false values, missing wheel preference, compatibility field preservation, failure retry and obsolete form/account completion guards. `tests/review-wheel-settings-api.test.mjs` covers encrypted persistence, account isolation and personal/site backup compatibility. Browser-check genuine checkbox labels, saved preferences and narrow layout in an isolated fixture without changing real account preferences when browser access is available.

### Wrong vs correct
Wrong: save a partial theme that drops the other preference, apply legacy colors or add another color menu. Correct: save `{theme:{...state.theme,reduceMotion,reviewWheelNavigation}}` and derive visual accents from `DEFAULT_ACCENTS`.

## Workspace navigation and stage writes

`settings`, `calendar`, `stage-settings` and `guide` are ordinary routes. Their navigation uses `attemptNavigate()`; motion/stage edits mark dirty, pending writes block departure, and failure retains the mounted values. Stage configuration submits every original stage/metric field,49 review-template keys and4 action prompts, retaining unknown compatibility metadata. Success applies only to the connected original form/account/write owner. Calendar review entry captures month/scroll/date focus as source context; review exit restores it instead of overview. Global Ctrl/Cmd+S requires an actual review route, never merely a retained current record.


## Backup, authentication and verification async ownership

### Scope and signatures

Applies to `renderBackup`, personal/site file reads and inspect/import/export, external-target writes/actions, `renderAuth`, `sessionExpired`, and `openVerification`. Shared `dialogWriteTask(anchor)` owns pending modal writes. `refreshData(isCurrent = () => true)` returns `false` without committing stale account/caller results and `true` after applying an accepted refresh.

### Contracts

- Read native FormData before disabling controls. Pending login/register/reauth and dialog writes send one request; disabling visible controls alone is not a duplicate-submit guard.
- Associate asynchronous results with the exact connected form/button, modal, original account object and page where applicable. Backup page loads and file reads also need visit/read tokens; a later visit may reuse the same element ID.
- `dialogWriteTask` prevents duplicate submit events across handler-local tasks, makes the pending modal persistent, sets `state.saving`, and disables its native controls. On completion it restores the previous disabled/persistent state only for that same connected modal, and releases only its own `state.dialogWriteOwner`. A forced reauth/replacement must remain intact.
- Stale responses cannot download old-account exports, apply previews/import results, commit refreshed records/settings, close another modal, write errors into another form, navigate or release a newer write owner. Personal restore consumes the refresh boolean before closing; an accepted refresh replaces `state.user`, so do not reject it afterward merely because the returned user object has a new identity.
- Failed requests retain mounted values/passwords for retry. Reauth catches fetch/JSON failures and preserves the original unsaved editor on both failure and success. Full logged-out rendering clears `reauthOpen`.
- Verification sends the original result/adjustment/outcome/process payload and existing eligibility rules. Pending submission blocks dismissal and navigation. Once verification succeeds, apply its locked record; failure of the optional stats refresh must not invite another irreversible verification submission. Stats and rendering also require the original owner.
- Passwords, imported encrypted text and plaintext review contents remain transient in page/form closures; never copy them into localStorage/sessionStorage, logs or remote artwork APIs.

### Validation and tests

Use actual JSDOM plus the built shadcn bridge in `tests/backup-ui.test.mjs`, `tests/auth-ui.test.mjs`, `tests/verification-ui.test.mjs` and `tests/ui-overlay-inert.test.mjs`. Cover success/exact payload, duplicate submits, failure/retry, pending cancel/navigation, forced replacement/account changes, late file reads/downloads/errors, and old finally handlers preserving newer write owners. Server backup schema/crypto/ownership/transactions remain the final authority and have separate security tests.


## Configurable review content

`public/review-schema.js` normalizes each template's questions (stable id/label/required, max30) and disabledFields (daily sleep/energy/risk/journal only). Missing questions preserves legacy default behavior; [] removes all ordinary questions. Pass the record-specific review template into both flow modules and validators. Daily custom questions join reflection; extended custom questions precede action in the final stage. Preserve core action/ifThen/date, daily ifCondition and decision title requirements. A blank editor row must remain mounted for validation; normalize only persisted schemas.

Current-period drafts use live settings; completed/verified/expired drafts use their snapshots. Keep old answer keys when a question disappears. Stage metrics accept0–12 entries with stable IDs. `review-metrics.js` reconciles editable draft metrics by identity, retains removed entries in data.archivedMetrics and recovers matched archived answers. Never reconcile historical metrics. Settings region replacements must retain unrelated values and focus the inserted/adjacent input; saves retain existing ownership/pending/error guards.

## Review wheel navigation

`public/review-wheel.js` is the single wheel gesture owner. `bindReviewWheel()` attaches to the current `.daily-flow` after existing daily/extended handlers. Default `theme.reviewWheelNavigation` is enabled unless explicitly false. Intro, first-up and last-down boundaries do not start/exit/submit a review. Step only through the existing visible enabled previous/next buttons, preserving each flow's validators, mounted inputs, collection, focus and readonly behavior.

Normalize pixel/line/page units and require 90 vertical pixels. A continuous burst steps once, then needs both a650ms cooldown and220ms quiet interval before rearming. Direction reversal resets incomplete accumulation but must not bypass a consumed burst. Give scrollable textarea/ancestor/document content first use; if any event scrolls content natively, consume the whole burst even after reaching its edge. Ignore zoom/horizontal/modifier wheels, IME composition, numeric/range/select controls, disabled preferences, saving, replaced/detached account/editor contexts and open modal/menu/listbox surfaces. Keep listeners local and disposable, with no global wheel interception or timers.

`review-wheel.test.mjs` covers gesture timing, units, scrolling and ignored controls. `review-wheel-flow.test.mjs` executes actual six-flow render/bind/validation/collection with the built component bridge: readonly traversal, editable errors/input retention, no automatic completion, long bursts, settings and owner guards. Old review-write and draft-delete fixtures must include the shared binder without stubbing the wheel module or changing their existing assertions.

## Review and member-management write ownership

- `saveCurrent()` binds a write to the account, exact current record, mounted `#daily-editor`/page and `state.reviewWriteOwner`. First save applies the returned ID without remounting the editor or losing the current prompt. A late success/error from a replaced surface cannot change its replacement's record cache, dirty state, notification or busy owner.
- `completeCurrent()` captures the original editor, record and confirmation modal. When a save is required, await that exact saved record before posting its returned ID; recheck account/surface after both save and completion. On an accepted completion response, immediately update the record cache, release its write owner, close its confirmation and render the locked result at the final prompt. Only then start optional stats refresh: it must never delay or erase an already successful business commit.
- Optional completion stats belong to the newly rendered locked record/account/editor/page and the captured live modal root. `prepareDialogContainer` replaces an empty root on a later dialog visit; compare the connected `#modal-root` node itself as well as its modal. A stale detached root can otherwise falsely report no new modal. Stats failure or current-session 401 may request reauthentication but cannot leave a server-locked record locally editable, undo it or submit completion twice.
- `request(path, options = {}, isCurrent = () => true)` preserves the existing payload/error/throw contract. Its optional third callback gates only the 401-triggered `sessionExpired()` side effect before it occurs. The audited review-save/completion, administrator modal/page writes and optional stats pass their existing owner predicate; checking ownership only in the caller's catch is too late to stop a stale 401 replacing a new modal/account with reauthentication.
- Version-conflict recovery calls `refreshData(current)`. An accepted refresh intentionally replaces the user object; transfer that accepted identity to the enclosing completion closure so it can report the conflict and release its own confirmation/editor without dropping dirty input.
- Accepted optional stats update the header pending count locally without remounting the locked editor. `refreshData` passes its account/caller guard into all three requests so late refresh 401 responses cannot reauthenticate a replacement context.
- Administrator create/reset/delete dialogs use `dialogWriteTask` plus the captured members page and role. Read FormData before begin, send once, protect pending dismissal, keep failed inputs for retry, and never close/refresh a replacement modal/page/account.
- `managedUsersWriteTask` serializes status, role and registration writes within their original account/page. Disable competing account controls while pending. Failed registration changes must restore both the native checkbox and its visible shadcn checkbox to the last saved value; suppress recursive change handling during that synchronization.
- Review, administrator-page and shared-dialog finally handlers release only their own owner token. Clearing one owner must not clear `state.saving` while a newer review, dialog, account, settings or administrator-page writer remains. Detached old dialogs must not restore the persistence/controls of a replacement modal.

`admin-write-ui.test.mjs` and `review-write-ui.test.mjs` execute the actual app functions with JSDOM and the built shadcn bridge. Cover duplicate submission, exact payloads, failure/retry, all six first-save editors, original-ID save-before-complete, stale account/record/page/modal and stats responses, version-conflict refresh identity changes, registration rollback, and cross-owner completion. Review tests must also execute the real `request` and `sessionExpired` path: current stats401 retains the completed record through reauthentication, stale stats401 cannot open reauthentication over another account/page/record/modal, and stale save401 cannot affect its replacement owner while current save401 preserves dirty input. Keep the existing authentication, backup, verification, settings and account regressions passing when changing the shared dialog/request helpers.
