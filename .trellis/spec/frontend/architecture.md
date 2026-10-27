# Frontend Architecture

## Files and boundaries

- `shendu/public/index.html` provides the application, modal, and toast roots and loads `styles.css` and `app.js` directly. `shendu/package.json` has no frontend framework or bundler.
- `shendu/public/app.js` owns route state, HTML templates, API calls, and event binding. `shell(content)` renders the shared top navigation, main area, and right rail. `navigate(route)` selects the view.
- `shendu/public/styles.css` owns global tokens, page styles, and breakpoints. Local fonts live under `shendu/public/assets/fonts/`.

## Render and bind

Page functions return HTML strings. After DOM replacement, they attach listeners to the new nodes. `renderReview()` calls `shell(content)` then `bindReview()`; `shell()` calls `bindCommon()`. A rerender removes old listeners, so every new control needs a binding path.

The six review types share `TYPES`, `QUESTIONS`, `reviewToolbar()`, and `renderReview()`. Daily-specific content is split into `dailyEvidence()`, `dailyReflection()`, `dailyActionFields()`, and `dailyJournal()` in `app.js`. Extend the shared path for common behavior and the daily branch for daily-only behavior.

Daily review uses `DAILY_STEPS` from `daily-flow.js` and `state.dailySection` (`intro`, `evidence`, `reflection`, `action`, `journal`). `dailyReviewHtml()` renders the intro and four panes once; `showDailySection()` changes `hidden` without replacing input nodes. Use `dailyStepIssues()` for current-step required checks and `showDailyIssues()` to expose/focus the missing field. Evidence and journal remain optional. `renderReview()` accepts preservation options for internal redraws; collect before replacing DOM and retain section/dirty through add/remove, save and completion. A first save changes null ID to a real ID and must not reset the flow. True route/record entry starts at intro. Do not use a hidden pane as proof that its values are absent or optional.

`statsHtml()` is owned by the shared stage/calendar dialog and renders once inside `rightRail()`. Review bodies must not call it. Its compact three-stat controls navigate through the existing guard after closing the parent dialog.

Routes are in-memory names such as `overview`, `daily`, `history`, `actions`, and `backup`. `boot()` opens `overview` after `refreshData()`. `renderOverview()` is the overview-only page; other page bodies retain their own render functions. `attemptNavigate()` guards unsaved input before moving between routes. Header, calendar, overview cards, and record-card handlers use that guard. Preserve it when adding navigation affordances.

The top navigation is shared by every logged-in route. `navItems()` filters the header review menu by `state.stage.showQuarter`, while the six overview category cards always come from all entries in `TYPES`. `bindCommon()` binds the header menus and route buttons after each `shell()` render; a page rerender must rebind them.

These are current repository conventions. A framework or router migration would be a separate explicit task.

## Static asset cache contract

`shendu/server.mjs` serves non-HTML static assets with `Cache-Control: public, max-age=31536000, immutable`, while HTML is `no-cache`. When changing `shendu/public/app.js` or `styles.css`, change the matching `?v=` URL in `shendu/public/index.html` in the same commit. Otherwise a returning browser can render new HTML or JS with old cached CSS or JS for up to a year. Verify the entry HTML points to the edited assets before visual QA.
