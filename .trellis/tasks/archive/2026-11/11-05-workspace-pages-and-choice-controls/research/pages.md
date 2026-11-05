# Independent workspace pages

## Implemented

- `settings`, `calendar`, `stage-settings` and `guide` are ordinary in-memory routes, with the common header, shared warm-paper canvas and readable workspace width. Removed the stage RailSurface, backdrop/state and settings-navigation Dialog paths.
- Calendar uses the unchanged genuine shadcn/DayPicker control, one shared stats row, current stage and two latest pending actions. The calendar illustration is the existing green `daily-07-small-checklist`; its page token selector wins over the generic workspace fallback.
- Review entry from calendar preserves its source, scroll and original record identity. Exit restores the calendar and original date focus. Ctrl+S only operates on an actual six-category review route, so a stale `state.current` cannot submit a review after navigating to settings/calendar.
- Settings has three illustrated destinations, saved motion preference, direct guide and full stage/template editing pages. Stage editing retains all original payload keys, 49 review-template fields, four action-prompt fields and action-template legacy metadata.
- Stage and motion edits use the existing unsaved/pending navigation guard. Required validation, duplicate submit prevention, retained inputs on failure, per-account/per-form async completion and write-owner release remain explicit. Functional confirmation, verification, backup and reauthentication Dialogs retain their actual Radix behavior.
- Fixed inherited narrow settings CSS: every new settings card explicitly remains a two-column grid with centered illustration; old <=620px flex rules no longer create a mismatched first/second card layout.

## Files

`shendu/public/app.js`, `public/review-navigation.js`, `public/workspace-pages.css`, `ui/surfaces.jsx` (stage surface only), `ui/stage.css`; behavior updates in `tests/account-workspace.test.mjs`, `settings-motion.test.mjs`, `ui-overlay-inert.test.mjs`, `ui-surfaces.test.mjs`, `review-navigation.test.mjs`; new `tests/workspace-pages.test.mjs`.

## Checks

- `node --check public/app.js`: passed.
- `node --test tests/settings-motion.test.mjs tests/account-workspace.test.mjs tests/ui-overlay-inert.test.mjs tests/ui-surfaces.test.mjs tests/review-navigation.test.mjs tests/workspace-pages.test.mjs`: 38/38 passed after the independent-page migration and owner-guard tests.
- After final narrow-grid override and calendar-return focus refinement: page/motion/account/navigation subset 24/24 passed.
- `git diff --check`: passed (existing line-ending notices only in the other choice-control owner's files).
- No references to removed `showRail`, `setRailOverlayOpen`, `railOpen`, `railView`, `rightRail` remain in app/UI/tests.

## Integration

Parent owns the final shared build/cache update, real browser QA, specification/docs updates and main/CI closure. The choice-control agent owns runtime/choice components and CSS. No server/schema/dependency/generated artwork changes or Git commits were made by this page implementer.
