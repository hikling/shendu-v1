# UI Quality

`shendu/public/styles.css` defines surface, ink, line, accent, radius, and shadow variables in `:root`. `applyTheme()` in `app.js` sets three accent variables and computes their text contrast. Theme settings expose six presets, custom colors, and a reduce-motion control. Shared UI must remain legible with every preset and custom accent.

The current shell has a shared top navigation and main column. Its mobile menu replaces the desktop links at narrow widths. The stage/calendar/pending-action rail opens on demand. Narrow widths reflow the six overview cards, record reel, and existing forms. Check breakpoint transitions, not only wide desktop (`styles.css`).

- Preserve semantic buttons, form labels or accessible names, visible `:focus-visible`, and status feedback. `calendarHtml()`, the header menu triggers, and `openModal()` in `app.js` provide local examples.
- Dialogs use `#modal-root`; `openModal()` and the document key handler manage focus and Escape. Reuse that path for confirmation and settings dialogs.
- Keep both `@media(prefers-reduced-motion:reduce)` and the saved `reduceMotion` setting.
- For translucent surfaces, make text, controls, focus rings, and status labels readable over all supported backgrounds and themes. Establish hierarchy with grouping, type, and spacing before effects.
- The auxiliary rail is an overlay dialog while open on the overview or below the wide-screen breakpoint: `setRailOverlayOpen()` sets the main/header inert, keeps Tab inside the rail, allows Escape and close-button dismissal, and returns focus to `#rail-toggle`. There is no backdrop-dismiss element. If changing the rail, verify keyboard and close-button paths on desktop and mobile.
- The overview record reel moves continuously when motion is allowed. Its pause control, keyboard focus behavior, and static layout for the saved `reduceMotion` setting and system `prefers-reduced-motion` preference must keep cards readable and operable. Duplicated loop cards must stay out of the accessibility and keyboard order.
- The daily metric-status `<select>` and date fields are intentionally native controls; their browser-owned popup geometry is acceptable in this self-hosted form. Keep their accessible names and test the opened controls at narrow widths when changing them.

`npm run check` is the existing browser-script syntax gate. The test suite covers security and backups rather than visual behavior (`shendu/package.json`, `shendu/tests/backup-security.test.mjs`). Inspect actual desktop/mobile states and exercise affected keyboard and pointer paths for UI changes.
