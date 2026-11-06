# Frontend / build security audit

Scope: source and browser trust boundaries only. Approved UI layout, wording, palettes, artwork and record payloads are preserved. This review and regression testing do not prove that every possible vulnerability is absent.

## Coverage

| Files / group | Reviewed boundary and result |
| --- | --- |
| `shendu/public/app.js` | API wrapper and same-origin credentials; login/register/reauth; topbar/navigation; overview/art/date templates; six review flows and record save/lock/verify; history/action templates; backup page, file reads, personal/site inspect/import/export, external-target forms/actions; account/admin and settings/stage writes; native form collection; modal/menu/toast lifecycle. Untrusted display strings are escaped or assigned as text. Concrete async ownership and duplicate submission bugs fixed below. |
| `public/index.html` | Local styles/module entry, body-sibling overlay roots, no remote executable bootstrap. Application cache revision advanced for security fixes. |
| `public/daily-flow.js`, `extended-flow.js`, `verification-policy.js`, `daily-calendar.js` | Pure prompt traversal/validation/minimum-date helpers. No network, storage, raw markup execution or secret retention. Existing validation/date contracts retained. |
| `public/overview-reel.js`, `record-art.js`, `review-intros.js`, `review-navigation.js` | Local catalog/shuffle/matching, record selection and text formatting, quote picker, source-navigation ownership. Art paths derive local catalogs; no remote record-content transmission. Repeated rendered text is still escaped by app owners. |
| `ui/runtime.jsx` | Root mounting/disposal, native form bridges, attribute conversion, checkbox/select controls and HTML adapter. Event attributes are excluded from React prop conversion. Raw HTML is an intentional bridge for authored app templates, not a general sanitizer; current callers escape untrusted fields first. Keep opaque legacy ownership and native FormData semantics. |
| `ui/surfaces.jsx` | Dialog/menu HTML sources traced back to app templates, text-based React calendar labels, controls, min dates, local civil date library and toast string rendering. No direct raw backend HTML sink identified. |
| `ui/calendar-date.js`, `ui/lunar-calendar.js` | Explicit civil-date arithmetic/library boundaries and cached lunar label generation; no network or dynamic code execution. |
| `ui/entry.jsx`, `ui/lib/utils.js`, `ui/components/ui/{alert,badge,button,calendar,card,checkbox,dialog,dropdown-menu,input,label,native-select,progress,radio-group,separator,skeleton,sonner,table,textarea}.jsx` | Genuine shadcn/Radix wrappers, local variants and accessibility props. No secret persistence or added network/dynamic execution. React children/props handle calendar/user-visible text. Intentional upstream export variants retained. |
| `ui/components/ui/tabs.jsx` | Entire source component had no import/call/reference outside its own definitions in UI, public, tests, docs or specs. Deleted; never entered runtime bundle. |
| `public/{styles,history-archive,workspace-pages,overview-entry,legacy-surfaces}.css`, `ui/{styles,compat,surfaces,stage,choice-controls}.css` | Static presentation/configuration inspected as non-executable frontend content; no edits or UI redesign. Static illustrations/fonts are local assets, not API/file-import code. |
| `vite.config.js`, `scripts/ui-licenses.mjs`, `scripts/smoke-ui.mjs` | Browser-only production build entry; output and source map settings; dependency license emission from pinned package metadata; isolated smoke checks. No user-controlled command interpolation or runtime secret injection identified. |
| `public/ui/*` | Generated build output, not source to hand-edit. Current source/build must be verified by root full build/container smoke. |

## Fixed findings

### F1: Backup requests could finish into another visit/dialog/account

Trigger: start file reading, inspection, restore or export, then replace the dialog/page/account before completion. Original handlers looked up global IDs or unconditionally closed/rerendered the current UI. Duplicate submit events could also send more than one restore/export request.

Impact: stale preview/confirmation/download UI, duplicate restore attempts, unrelated dialog dismissal, obsolete data refresh and lost context. Server account/format authorization remains authoritative; this is not a demonstrated server account-isolation bypass.

Fix: bind `renderBackup` to its original page/account. `dialogWriteTask` binds each write to its exact anchor/modal/page/account, keeps busy operations persistent and single-flight, and only releases its own write owner. Personal/site file reads use a per-input token. Downloads/actions require the original connected account owner. `refreshData` rejects obsolete account/caller results before mutating state. Personal restore still sends exact encrypted file/password/mode/replace confirmation and refreshes before closing.

Regression: seven real JSDOM/shadcn bridge tests in `backup-ui.test.mjs` cover stale visits/errors/XSS-shaped metadata, personal inspect duplicate/persistent/replacement behavior, restore success/failure/retry/exact payload, late file reads and exports, site inspect/restore/export, and stale refresh. Existing deletion overlay tests now include actual shared owner helper.

### F2: Authentication requests had no single-flight/stale ownership/error recovery

Trigger: repeatedly submit login/register/reauth while pending, simulate network failure during reauth, or replace an auth form/modal before a delayed response. The reauth fetch rejected outside a catch, and delayed responses could close current UI or boot an obsolete login.

Fix: capture native payload before disabling controls, submit once, retain values on failure, catch fetch/JSON failures, and check exact connected form/account before applying completion/error. Full logged-out rendering clears an obsolete reauthentication flag. Normal successful reauth still preserves the original unsaved review.

Regression: `auth-ui.test.mjs` covers exact payload, duplicate prevention, safe error text, network failure/retry, obsolete auth responses, obsolete reauth completion and flag reset; existing persistent reauth success/failure tests also pass.

## Proven dead-code cleanup

- Removed unused `navItems()` in `app.js`: no caller; obsolete pre-existing top review-menu builder.
- Removed unused `enhanceUi` import from `app.js`; actual bridge export remains used elsewhere.
- Removed unreferenced `ui/components/ui/tabs.jsx` as detailed above.
- Confirmed no current frontend calls to legacy `/api/backup/upload/{start,chunk,preview,apply}`. Personal restore uses `/api/data/{inspect,import}` and site backup uses `/api/admin/site-backup/*`; informed root before server-side compatibility cleanup.
- Retained compatibility theme/template fields, upstream component variants, historical QA/Trellis files and static artwork. Absence of a simple text reference alone is not sufficient to delete dynamic data/assets.

## Verification in this subtask

- `npm run check`: passed.
- `node --test tests/auth-ui.test.mjs tests/backup-ui.test.mjs tests/ui-overlay-inert.test.mjs tests/account-workspace.test.mjs tests/settings-motion.test.mjs tests/workspace-pages.test.mjs tests/review-navigation.test.mjs`: **41/41 passed**.
- Scoped `git diff --check`: passed.
- No visual design changes; DOM behavior verified through actual built shadcn bridge. No live production account, backup or credentials accessed. Final full build/tests/dependency audit/container/CI and Git closure belong to root integration report.


## Follow-up: review write / bootstrap reachability

`saveCurrent` was rechecked against all current call sites (save button, keyboard shortcut, completion pre-save): it sets `state.saving` synchronously before its first await, disables main controls, and all ordinary route/review departure goes through `attemptNavigate`. Completion retains its own pending lock. A 401 rejects the original save immediately and opens persistent same-account reauth; success does not replace `state.user`. No ordinary user-reachable account/page replacement while a successful save is pending was identified, so no speculative save refactor was made.

`boot` does not consume `refreshData(false)` and its error path is not independently guarded. Under current callers, `false` here requires an independently replaced account during its loading screen: startup, a current single-flight login, or retry after the previous boot already ended are its only entries; the loading screen has no route/account controls, and reauth preserves the same account object. A 401 starts `init` only after Promise.all rejected the earlier refresh; late sibling responses cannot commit that rejected refresh. Thus no ordinary overlapping-boot trigger was established and this was not classified as a demonstrated vulnerability or changed. Any future cancellable/background boot should add explicit loading-visit ownership before exposing such entry points.

### F3: Action verification could be submitted repeatedly and finish into a different page/modal

Concrete normal trigger: submit action verification over a slow connection, then submit again or click its still-enabled Cancel/close control, navigate to history or open a different verification modal. Its delayed success unconditionally updated records, closed whichever modal was open and rendered actions. Unlike review save, this handler had no `state.saving`/persistent/single-flight guard.

Fix: generalized the existing backup modal owner helper to `dialogWriteTask` and reused it for action verification, preserving original markup, payload and verification date rules. Pending native controls and dismissal/navigation are locked; stale completions cannot update another account, dismiss another modal, write stats or release another write. After irreversible verification success, an optional stats refresh error no longer leaves a retryable submit dialog.

Regression: `tests/verification-ui.test.mjs` has three actual DOM tests for exact payload/duplicate prevention/pending cancel and navigation, failure input retention and successful commit despite stats failure, and forced modal/account/new-write replacement with delayed completion. Frontend specs now record the shared contracts and no longer describe unused Tabs as a current surface.

Follow-up verification: scoped frontend suite including verification UI passed **44/44**; `node --check public/app.js` and scoped `git diff --check` passed. Root must rerun the final full suite after these three added tests (previous integration total was 176).
