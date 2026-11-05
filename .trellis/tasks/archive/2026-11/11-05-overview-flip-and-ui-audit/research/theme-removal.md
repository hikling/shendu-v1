# Settings: fixed brand and independent motion preference

## Scope

Removed all theme/palette/custom-color entry points and their dialog, palette data and dead CSS. `applyTheme()` now writes the approved default teal/brown/blue accents and contrast variables, while still applying the saved `reduceMotion` flag and canceling the active typewriter when needed. Category palettes are unchanged.

The settings Dialog retains account/security, stage and guide entries. A separate illustrated-paper-compatible motion form owns its own save through the existing `PUT /api/settings`. It spreads the current legacy theme object, changing only `reduceMotion`; stored preset/custom colors remain part of the request and server response. No server, backup, schema or API change.

During save, the form fieldset and all Dialog buttons are disabled and the existing persistent-close guard prevents dismissal/replacement from settings controls. Duplicate submission is ignored. A failed save retains the chosen checkbox state and re-enables retry. A replaced/detached settings form cannot clear another Dialog's persistent guard.

## Files

- `shendu/public/app.js`: fixed accents, removal of theme art/notes/dialog/entries, independent motion form and save binding.
- `shendu/public/workspace-pages.css`: removes theme presentation and adds scoped responsive preference styling.
- `shendu/public/styles.css`: precise deletion of unused palette/swatch/color-row rules only; preserved other concurrent overview cleanup.
- `shendu/tests/settings-motion.test.mjs`: executes the real native owners in JSDOM.

## Checks

- `node --test tests/settings-motion.test.mjs`: 4/4 passed (fixed palette + reduceMotion, legacy-field preservation, duplicate/busy guard, failed save/retry, disabling preference, replacement guard).
- `npm run check`: passed.
- `git diff --check`: passed (only existing line-ending notices).
- Source search confirms no `openTheme`, `PALETTES`, theme entry, palette grid or color-row remnants in app/workspace/global presentation sources.

The main session owns runtime/cache integration, production build/full regression and actual desktop/narrow-browser visual verification.
