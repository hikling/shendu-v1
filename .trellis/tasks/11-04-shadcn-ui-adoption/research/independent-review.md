# Independent implementation review

## Confirmed findings fixed by reviewer

- `ui/compat.css`: component mount hosts are real DOM ancestors even with `display:contents`. Added host-aware equivalents of the existing paired obstacle/response label typography, locked-review afterword paper, action verification timing badge (including overdue), and narrow admin status rules. This preserves legacy direct-child styles without changing composition.
- `ui/surfaces.css`: corrected invalid calendar caption `font:... inherit` shorthand to explicit inherited family, size, weight and line height.
- `ui/runtime.jsx`: removed the unnecessary native exception for the ordinary overview information-card CTA. It now uses Button while retaining its original `data-nav`, class and opaque arrow. Custom category hit targets and cloned curved-reel controls remain authored.
- `tests/ui-runtime.test.mjs`: verified that the ordinary overview CTA is a real Button with the same navigation data and arrow.
- `ui/compat.css` / `ui/surfaces.css`: supplied readable ink focus-outline defaults for new primitives, calendars and menus when custom theme colors are white. The fallback uses normal specificity, allowing the existing category-specific outlines to win.
- `public/app.js` / `public/index.html`: scoped review live regions still made Radix retain portions of the editor behind confirmation dialogs. Moved the stable rail root beside modal/toast roots at body level and added explicit `syncOverlayBackground()` inert ownership for the application whenever either Dialog is present. Closing a child restores its parent while keeping the background inert; closing the final overlay restores the application. Full authentication rendering explicitly disposes the now-external rail and modal so no stale overlay or inert login survives sign-out. No second keyboard trap was added.
- `tests/ui-overlay-inert.test.mjs`: executes the actual application overlay/auth owner functions with real shadcn Dialogs and live date/save descendants; checks background inertness, independent enabled overlay roots, persistent dismissal guard, notifications, parent/final focus restoration and logged-out teardown.

## Findings coordinated with surface implementer

- Locked verification calendar originally applied today's minimum month even to an older saved locked date. It now omits that minimum navigation bound when locked; the regression test displays and selects the original historical date while all controls remain disabled.
- Browser QA found Tailwind's individual `translate` and legacy `transform:translate` both positioning Dialog, plus a default max-width restricting the stage dialog. Implementer fixed scoped Dialog geometry.
- Browser QA found a child Dialog portalled into the initially empty `#modal-root`, which the parent's `hideOthers` had already hidden. `prepareDialogContainer()` now disposes/replaces that empty body-level structural root on each new visit, while the registry still owns the new Dialog and its opaque child roots. The regression repeats two nested visits and checks that the child has no hidden ancestor and closing restores parent access.
- Sonner was lazily mounted in an empty root, which could already be hidden by a modal. `initializeToasts()` now mounts the singleton before `init()` and any dialogs, so its existing polite live region is preserved by `hideOthers`; the nested-dialog regression checks the first notification while a modal remains open.
- The broad `#app[aria-live=polite]` made `hideOthers` retain the entire application background. Removed that broad live region and retained scoped question/error/toast live regions. The nested-dialog regression asserts background hiding.

## Verification at review checkpoint

- `npm run check`: passed; repository has a native-script syntax check rather than an ESLint or TypeScript configuration.
- Production `npm run build`: passed, local JS/CSS and third-party notices emitted; no browser `process.env` dependency.
- Targeted actual DOM and navigation suite: 23/23 passed (`ui-runtime`, `ui-surfaces`, `review-navigation`, `ui-overlay-inert`), including repeated nested dialogs, scoped live descendants and logged-out teardown. The final focused overlay/auth rerun passed without console errors after supplying jsdom's visual animation-frame environment.
- Existing API/server/domain files were not changed. Read-only/new/hidden fields continue using native DOM values and existing payload collectors.
- Independent code inspection found no additional API/security/cache/deployment blocker. Final clean install, full suite, desktop/mobile browser QA and actual Docker/CI smoke remain the main session's integration gates.
