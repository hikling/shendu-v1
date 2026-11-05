# Independent review

Reviewer: `pages_choice_review` (`trellis-check`), 2026-11-05. Reviewed the shared working tree against `prd.md`, `design.md`, `implement.md` and every frontend spec in `check.jsonl`; code baseline `26185639d9385124284ecfe1f2bc048f3d456ced`.

## Findings (fixed)

- File: `shendu/public/workspace-pages.css`
- Issue: the new settings-page card geometry set grid columns but did not explicitly set `display:grid`. The older <=620px `.workspace-settings-menu .settings-menu-item` rule still switched account/stage cards to flex columns, while the guide card remained grid. This made the three new cards inconsistent on phones.
- Fix: reported to the owning page implementer, who set the more specific new-page rule to `display:grid`, `grid-template-rows:auto`, centered alignment and explicit gaps, and centered/reset the illustration margin. Confirmed the final selectors override the old desktop/narrow rules. Browser geometry is still part of the main-session gate.

## Findings (not fixed)

- No additional confirmed code defect remains after the review fix. Choice controls retain one native value/FormData and input/change path, required validation/focus, disabled controls/fieldsets, reset and external-event synchronization. Their scoped attribute observer never replaces roots or nodes. The real Radix RadioGroup owns keyboard movement. Existing full label text is rendered as text.
- The new settings/calendar/stage/guide routes preserve guards, all original stage/metric/template fields, save failure/retry, account/write ownership and calendar record identity. Calendar is an accepted review-return source, including focus restoration to the actual `data-calendar-record` day. Ctrl+S is restricted to review routes so a retained `state.current` cannot save from a workspace page. No remaining `showRail`/`setRailOverlayOpen`/`railOpen` implementation or test caller was found.
- Specs still described the removed settings Dialog, stage Dialog/Tabs/showRail path and native select arrow. The main session owns documentation and has been notified to update `architecture.md`, `component-islands.md`, `state-and-data.md`, `ui-quality.md` and `archive-and-workspace-ui.md`. These are intentional contract updates, not reasons to restore obsolete behavior.
- Browser rendering, fresh production build after all page/surface edits, full test suite, asset smoke, commit/main/CI and task closure remain with the main session. This reviewer did not use a browser, build concurrently, commit or push.

## Verification

- `npm run check`: pass after final application changes.
- Lint: no ESLint configuration/script exists; the package's native-script syntax gate above passed.
- TypeCheck: no separate TypeScript gate exists in this JavaScript/JSX package; JSX production compilation remains in the main-session build/pretest gate.
- `tests/ui-choice-controls.test.mjs`, `tests/ui-runtime.test.mjs`, `tests/review-navigation.test.mjs`: 19/19 passed during independent review.
- `tests/account-workspace.test.mjs`, `tests/settings-motion.test.mjs`, `tests/ui-overlay-inert.test.mjs`, `tests/ui-surfaces.test.mjs`: 25/25 passed during independent review.
- After the page implementer stabilized tests and fixed the narrow card override, independently reran `tests/workspace-pages.test.mjs`, `tests/settings-motion.test.mjs`, `tests/review-navigation.test.mjs`: 17/17 passed. This includes the newly added motion account-owner regression.
- `git diff --check`: pass; only LF/CRLF normalization notices. The final `rg` for obsolete rail owners returned no matches.

No design, API, storage or security behavior was changed by the reviewer. The only direct reviewer write is this report.
