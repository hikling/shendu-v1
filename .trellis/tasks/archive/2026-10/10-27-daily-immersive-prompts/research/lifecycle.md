# Research: Immersive daily lifecycle

- Query: Where must hidden/inert header state and typewriter work be reset or preserved across daily rendering, navigation, dialogs, authentication and reduced motion?
- Scope: internal
- Date: 2026-10-27

## Files found
- `shendu/public/app.js`: shared shell, daily section switching, manual record writes, navigation guards, authentication and modal focus.
- `shendu/public/styles.css`: shared header offset, existing reduced-motion rules, daily surface styles.
- `.trellis/spec/frontend/architecture.md`: render/bind replacement and static cache contract.
- `.trellis/spec/frontend/state-and-data.md`: no autosave, collect-before-redraw, snapshot/read-only and dirty protection.
- `.trellis/spec/frontend/ui-quality.md`: header/dialog focus, native controls and both reduced-motion preferences.

Line references below describe the pre-implementation baseline for this task; concurrent edits may shift them.

## Findings

### Replacement and restoration points
- `app.js:187` `shell(content)` closes the open rail, disconnects the overview observer, replaces the whole `#app` subtree, then binds shared controls. Cancel any existing intro timer/listener before this replacement. Put immersive layout on the local `.app-shell` rather than a persistent body flag where possible; a normal shell replacement then cannot leave unrelated routes without their header.
- `app.js:403–411` `renderReview()` chooses an existing record or new draft, resets `dailySection` to intro except explicit preservation options, initializes missing daily metrics, then `shell()` + `bindReview()`. Keep the actual rendered metrics count as the prompt source; historical metrics can differ from current stage configuration.
- `app.js:425` `renderReviewFromCurrent()` currently preserves only section and dirty. Add the current prompt identifier to its preservation options. Add/remove handlers call `collectCurrent()` before redraw (`app.js:419–420`); retained hidden inputs must remain mounted so `collectCurrent()` (`app.js:426`) still gathers all questions.
- `app.js:447` completion success explicitly rerenders with `{dailySection:'journal'}`. Preserve/select the final journal prompt too, so success stays at the end with the pending/verified afterword accessible.
- `app.js:683` `navigate()` dispatches every normal route, but calendar handlers (`app.js:630–633`) can set route and call `renderReview()` directly. Cleanup only in `navigate()` is insufficient; the shell boundary must dispose old typing work as well.

### Entering writing and exiting
- `app.js:361–381` `showDailySection()` currently owns intro/editor visibility and heading focus. Extend this same owner for question visibility and immersive state. Before hiding the header, close its menus and close any rail; then set header hidden/inert and focus the newly visible question heading/control.
- Shared layout uses `.app-shell --header-height` (`styles.css:529`), `.workspace` top padding and `.main` scroll offsets (`styles.css:570–571`), with 56px mobile override (`styles.css:707`). A scoped writing class must remove the header offset and update prompt scroll margins; setting only `display:none` on the header leaves a blank band.
- `setRailOverlayOpen(false)` (`app.js:648–663`) unconditionally sets the header's `inert` to false and can restore focus to `#rail-toggle`. Close the rail **before** applying immersive header inert, and do not restore focus into the hidden trigger while entering writing. Returning to intro should restore normal header visibility/inert and focus the start button; exiting uses the existing `attemptNavigate()`.
- `attemptNavigate()` (`app.js:627`) blocks navigation while saving and offers dirty discard/cancel. The small immersive exit control must call it, not navigate directly. Cancel keeps the same prompt, values, dirty state and hidden header. Discard navigates through the usual shell, which restores the normal header.

### Modal, reauthentication and keyboard
- `request()` calls `sessionExpired()` on authenticated401 (`app.js:98–102`). `sessionExpired()` opens a persistent modal over the existing DOM and does **not** rerender or reload records. Successful reauthentication closes that modal and asks for another save. Therefore preserve current question, input nodes, dirty state and writing immersion beneath it; do not reset to intro or expose the header just because authentication expired.
- `openModal()` / `closeModal()` (`app.js:625–626`) capture/restore `modalReturnFocus`; nested rail handling toggles its inert state. Keep the invoking question/exit control connected until the modal is closed, so failure/cancel returns focus correctly. For intro dialogs, stop/reveal the typewriter rather than let hidden background typing continue; closing a dialog need not replay an already completed introduction.
- `boot()`, `init()` and `renderAuth()` (`app.js:131,686–687`) can replace `#app` directly, bypassing `shell()`. If a general cleanup helper owns timers or body flags, call it before these authentication replacements as well. This differs from `sessionExpired()`, which preserves the form.
- Global key handling (`app.js:692`) already traps Tab in the active modal/rail, closes via Escape, and handles Ctrl/Meta+S. Keep those guards. Hidden question parents naturally remove controls from native Tab order; prompt focus must not rely on all mounted controls being disabled. The lock-specific busy marker already prevents Escape/backdrop dismissal during completion.

### Typewriter and motion
- Existing CSS (`styles.css:44,55`) reduces CSS animation/transition duration for system or saved motion settings, but this does **not** cancel JavaScript timeouts. The new typing owner needs explicit JavaScript checks for `state.theme.reduceMotion` / body class **and** `matchMedia('(prefers-reduced-motion: reduce)').matches`.
- `applyTheme()` (`app.js:105`) is the canonical saved/draft-theme application point. `openTheme()` (`app.js:621`) previews colors, applies the saved reduceMotion value on submit, then calls `navigate(state.route)`. A typing cancellation/reveal hook in `applyTheme()` handles setting reduction on while typing; disabling reduction need not replay a paragraph already fully revealed.
- No current `matchMedia`, visibility or typing timer owner exists in app.js. Register a media-query `change` listener while the intro owns typing, reveal full text immediately if reduction becomes active, and remove that listener when disposing. Prefer a single timer owner with an idempotent dispose function.
- Timer callbacks must check that their target is still connected and the intro is still visible. Leaving for the first prompt, internal redraw, another record/route, or auth replacement must prevent detached callbacks from updating a newer intro.
- Reserve layout from the full paragraph (e.g. full-text glyph spans whose visibility changes); changing the partial paragraph's text with balanced wrapping can shift lines during typing. Provide the complete text once to assistive technology; visual typing is aria-hidden and should not use per-character aria-live announcements. Starting immediately should cancel typing without blocking the button.

## QA edge cases
1. Enter while the mobile/review menu was open, then start: no menu/focusable header or top offset remains; back to intro restores it.
2. Rapid start during typing, back to intro, exit to overview, then re-enter: no detached timer/caret or duplicate listeners, no paragraph jump.
3. Add/remove a fact after first save ID allocation: same prompt/dirty values and keyboard focus survive the shell replacement.
4. Exit with dirty input → cancel; exit → discard; exit during delayed PUT; complete503 then retry: preserve guards, and only a successful route departure restores the other page's header.
5.401 during save from a writing prompt: reauth modal focus/Tab/Escape behavior remains correct, and retry returns to the same prompt without losing input. Intro401 should stop/reveal background typing.
6. Saved reduceMotion enabled at entry, enabled from settings midtyping, and a system media preference change: full text is visible immediately without JS typing work. Other routes' CSS motion behavior stays unchanged.
7. Historical verified records with a different metric count traverse every actual metric and reach the original result; completed records reach the pending-action entry.

## External references / versions
No external source or new library is required; findings are from the current native-JavaScript SPA. No browser, server, database or Git operations were performed for this research.

## Caveats / Not Found
- The initial design wording about reauthentication cleanup has been resolved in design.md: the existing401 contract preserves the form; stop intro animation/listeners where needed, **not** the question or writing immersion beneath the modal.
- Header restoration while a rail is still open must retain rail ownership of inert state. Avoid an unconditional shared `header.inert=false` that overrides the dialog's state.
