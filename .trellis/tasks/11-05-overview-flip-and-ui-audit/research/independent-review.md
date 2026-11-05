# Independent review

Baseline: `0282dd7`. Reviewed the active PRD/design/implementation plan, UI inventory, theme-removal and legacy-implementation reports, frontend index and applicable architecture/state/component/UI contracts. This reviewer did not use a browser, alter the concurrent settings layout work, commit or push.

## Findings fixed

### Pending external target deletion could close a newer surface

- Owner: `shendu/public/app.js`, the new target-delete confirmation inside `bindBackup()`.
- The original implementation disabled only Confirm. Cancel/Escape could dismiss the Dialog while DELETE was pending. A delayed success then unconditionally called `closeModal()` and `renderBackup()`, potentially closing a replacement surface or replacing another route.
- Added the existing persistent-close guard and disabled the Dialog buttons for the pending operation. Duplicate confirmation is ignored. Success closes/refreshes only while the original confirm owner is connected; error restores the original close/disabled state for retry without changing the request or target ID.
- Added a deferred-request test to `shendu/tests/ui-overlay-inert.test.mjs`. It failed before the fix, then passed. It verifies one request, blocked pending dismissal, and safe completion after forced replacement by a persistent reauthentication surface. Existing tests cover pre-submit Cancel/Escape, failure/retry, exact DELETE target and focus return.

### New quiet text had insufficient contrast

- Owner: `shendu/public/legacy-surfaces.css`.
- Placeholder `#7b8778` measured 3.73:1 on `#fffefa`; the tiny auth footer `#73816b` measured 3.83:1 on the light auth background. Both are normal text.
- Reused `--legacy-muted` (`#61716a`): 5.10:1 on paper and 4.78:1 on the pale auth background. No layout or palette redesign.

## Source and contract review

- Theme UI, preset data and custom-color controls are removed. `applyTheme()` uses the approved teal/brown/blue accents. The motion PUT spreads the current theme object and changes only `reduceMotion`; legacy data is not rewritten or dropped. Pending and failed preference saves retain their existing owner/guard/retry behavior.
- Each overview entry remains one authored native Button with its original `data-nav` and a complete stable accessible name. Both faces are decorative and pointer-inert, so keyboard/Space/Enter/touch retain the native guarded navigation path. No expanded ARIA, side information target or nested focus control remains. Back content contains only the category name.
- Flip CSS uses a transform inside the fixed entry footprint. Focus has a category-colored outline; hover is restricted to hover-capable input. Both saved and system reduced-motion rules swap faces without a 3D transform. Rendered projection/hit testing remains a root browser gate.
- `bindOverviewArc`, `overviewRecords`, `overviewRecordCard`, `attemptNavigate`, `enterReview`, `renderReview`, `collectCurrent`, `saveCurrent`, `completeCurrent`, `renderHistory`, `renderActions`, `openVerification`, `openAccount`, `bindSiteBackup`, `openTargetModal`, `openUserModal` and `openDeleteUserModal` are unchanged from baseline after trimming surrounding whitespace. The browser `beforeunload` handler is exactly unchanged.
- Login/registration preserve field IDs/names, limits, autocomplete, required fields, registration availability, password visibility and original API handlers. Full auth teardown retains external rail/modal cleanup; persistent reauthentication retains the original editor, dirty state and failure/success paths.
- The modal classifier excludes explicit `workspace-dialog`/`verification-dialog` surfaces and all eight existing specialized operation-form IDs. They match the dedicated workspace CSS selectors. Generic decoration is added to a detached template, remains static/aria-hidden/pointer-inert, and preserves `.modal-head` title/description extraction, original controls and event-binding order.
- All new image paths refer to existing local record-library assets. There is no new dependency, external content service, live DOM replacement bypass, second focus trap or duplicate root registry. Ordinary controls and all complex surfaces continue through genuine shadcn/Radix components; overview geometry intentionally keeps the already documented authored native ownership.
- The inventory covers all route renderers/openModal call sites and notification/system surfaces. No additional `confirm`/`alert`/`prompt` call remains. Existing specialized pages are preserved, and native browser `beforeunload` remains browser-owned.
- Entry HTML and app bridge imports consistently use the new immutable-cache revision for modified resources; overview reel and existing artwork revisions remain unchanged.

## Verification

- `npm run check`: pass after the behavior fix.
- `node --test tests/ui-overlay-inert.test.mjs tests/settings-motion.test.mjs tests/ui-runtime.test.mjs tests/ui-surfaces.test.mjs`: 27/27 pass, using the real production component build for overlay/runtime/surface tests.
- `git diff --check`: pass after the final CSS fix; existing CRLF conversion notices only.
- This JavaScript package has no separate ESLint/TypeScript gate. Root owns final production build, complete suite, resource smoke and browser verification.

## Findings not fixed / root handoff

1. Spec synchronization is still required: current docs mention editable saved colors/presets, `openTheme`, `overviewBurst` and old overview side information. Root already owns this work. Update frontend architecture/state/UI/component examples and the index QA text to distinguish legacy theme-data compatibility from the removed color UI.
2. Browser gates: front/back actual rendering and full entry hit bounds at 1280/820/390/320px; unchanged desktop single row and no sibling shift; Tab/Enter/Space and single-tap touch navigation; both reduced-motion settings; reel geometry; settings checkbox label/keyboard/save failure; auth/register/first-run and connection failures; long restore confirmation; custom surfaces excluded from the generic classifier; pending target-delete dismissal/retry and reauth replacement.
3. Root owns README/screenshots, final build/full tests, main synchronization and CI. This source/DOM review does not claim those gates are complete.
