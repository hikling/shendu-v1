# Independent review

## Findings (fixed)

- Files: `README.md`, `docs/deployment.md`.
  - Issue: The documentation implied that all fonts, including Chinese text fonts, ship with the repository. Actual `@font-face` assets are the three decorative Latin fonts; Chinese text uses system font fallbacks (`DESIGN.md`, `public/styles.css`).
  - Fix: Described bundled illustration/decorative-font/component resources and Chinese system-font fallback explicitly. No runtime or UI behavior changed.

## Findings (not fixed)

- File: `shendu/public/workspace-pages.css`.
  - Main-session rendered QA found a long username overflowing into the join-date cell in `after-users-multiple-1280.png`. Static column/host inspection did not expose this actual text-paint boundary failure. The main session owns the cell-wrap fix and stronger browser boundary assertions; this reviewer was instructed not to edit UI source during that work.
- Full rendered geometry, screenshots, the README overview image, complete tests/build/smoke and Git/CI closure remain owned by the main session; this review does not claim those checks have passed.

## Main-session resolution

The long-username issue is fixed with scoped `white-space:normal;overflow-wrap:anywhere`. Chrome rendered acceptance now asserts every text rectangle stays within its account cell, in addition to shared column coordinates and first-line alignment. All40 states at eight widths pass, including long usernames and real operation controls. Main-session build and153 tests, script check and static-resource smoke pass. README links were checked and its real GitHub Markdown render inspected. See `docs/workspace-readme-qa/README.md` and `final-checks.json`; remote synchronization and Linux CI are verified during task closure.

## Review evidence

- Read PRD/design/implementation/check contexts and frontend archive/workspace/component-island contracts.
- Account table changes preserve the native six-column markup inside genuine shadcn Table, including opaque descendants and `:has(.inline-actions)`; column proportions sum to 100% in both states. The existing <=820px table/row/cell reflow remains synchronized and the alignment selectors apply to actual controls.
- Backup ownership text is unchanged; only the collapsible container becomes a named section with a semantic heading. Password, account, member permissions, API calls and event handlers remain unchanged.
- Artwork/text size changes are locally scoped to action empty states, settings cards and workspace empty states. Static art remains pointer-inert; no overview/review/calendar styling was edited.
- Styles/app cache versions were updated; unchanged built component resources keep their existing version.
- README/deployment instructions were checked against package scripts, Compose, Dockerfile, environment example, install/update/site-backup scripts, admin CLI and server registration/encryption handling. Local Node launch, fixed container port 3000, optional pre-update snapshot, persistent data/key paths and backup formats match actual code.
- Existing spec contracts cover these local sizing/table/text changes; no new public interface or architecture contract was introduced. Main session may add its verified layout evidence to the workspace guide.

## Verification

- Lint/script gate: PASS — `npm run check` (twice; after the documentation correction included).
- TypeCheck: N/A — this JavaScript package has no separate TypeScript or ESLint command; JSX compilation is owned by the main session's build gate.
- Whitespace: PASS — `git diff --check`; only the repository's LF/CRLF informational warning appears.
- Tests/build/browser/smoke: not run by this reviewer, to avoid concurrent Vite output replacement and duplicate QA. Main session owns those checks.
