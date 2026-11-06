# Independent calendar review

## Findings (fixed)

No source issue required a reviewer fix. Only this review record was written by the checker.

## Findings (not fixed)

- `.trellis/spec/frontend/component-islands.md`: the final stage-only date-adapter section still names `ui/stage-date.js`, `stageDate()` and `stageDateLibrary()` and explicitly excludes verification dates. It must be synchronized with the new shared `ui/calendar-date.js` / `calendarDate()` / `calendarDateLibrary()` contract. The main session owns its debugging retrospective and spec update; this reviewer reported the stale statements without editing them concurrently.
- Browser geometry, screenshot acceptance, final PRD checkmarks, remote main synchronization and exact-commit Linux CI remain main-session closure gates. The reviewer does not infer their completion from static source or unit tests.

## Main-session resolution

The stale stage-only spec has been replaced with the shared `calendar-date.js` contract, all Date boundaries and exact canonical fields. The workspace guide records the620/540px desktop measure. `research/root-cause.md` captures the missing verification coverage and why DOM-only testing missed pointer obstruction. Main-session production build passed155 tests; Chrome/Edge acceptance passed257 checks with no console/page errors, including real pointer navigation, multi-year civil geometry and narrow stage alignment. See `docs/review-calendar-qa/` for before/after evidence. Main synchronization and CI are checked during closure.

The12 actual six-category history-to-review/date/exit flows also pass at normal1280px and hostile390px, preserving the original hidden field and locked record. Work commit`796524235851908bcd2077dcb0ebe243c92d09dd` is on remote main; [its Linux CI](https://github.com/hikling/shendu-v1/actions/runs/42186955876) completed successfully. The synthetic fixture was stopped and both ports closed.

## Scope and behavior review

- Both surface entry points now consume the same existing civil Date implementation. The helper rename changes its names and documentation without changing the former StageDate arithmetic; stage records, lunar annotations and private semantic grid slots remain intact.
- Verification passes civil instances at every Date boundary: visible month, saved selection, business today, minimum month, maximum month and the return-to-minimum action. Its memoized DateLib supplies both `newDate` and `today`, preventing native local Date creation inside DayPicker helpers. No global Date/Intl modification is introduced in production.
- `calendarDate(value)` remains exported through `surfaces.jsx` and the bundle. Its consumers are internal to the two calendar surfaces; they read explicit civil getters through `calendarValue`, never persist the backing timestamp. The unchanged application boundary still writes only canonical YYYY-MM-DD to the original hidden field.
- Verification retains the ordinary genuine shadcn/DayPicker table, CalendarDayButton and sole keyboard/focus ownership. The canonical `data-day` override is spread after the base button default; it therefore correctly replaces the spoof-sensitive locale string. Required selection, `locked`, `canSelect`, disabled minimum comparisons and month-only navigation callbacks retain their original guards.
- Category minimum rules and server/business logic were not edited: daily today; weekly/monthly/quarterly/yearly +7/30/90/250 civil days; decision three calendar months. Existing original-field input/change ownership is unchanged in `public/app.js`, whose only diff is its component-bundle cache version.
- The verification navigation z-index is locally scoped and restores real pointer access above the full-width month caption. No caption/date clipping or forced test-only clicking was added to production.
- Desktop stage layout narrows the left card to at most620px and52% of its spread, and the calendar to540px. Existing <=1050 ratios, <=820 stacking, date/lunar typography, row heights and right-side stretch alignment remain in place. Other workspace geometry is untouched.
- Built CSS and component-import cache tokens, plus the app script token, consistently use `1.0.0-reviewcivil2`; unchanged independent static modules retain their previous tokens.

## Regression coverage

- New production-build DOM tests cover all three hostile timezone modes across30 consecutive months, including multiple autumns, December/January transitions and February2028. They assert weekday headings, six seven-cell rows, unique ordered date identities, actual row/column ancestry, empty outside cells, selection/minimum behavior, stable root/navigation nodes and focus, and removal of previous-month controls.
- The second test uses the real six-category `verificationMinimum`, verifies exact disabled boundaries, distinguishes actual today from the future minimum, exercises busy selection guards and checks a locked February29 historical selection with disabled navigation.
- The main session reported an old-build failure before rebuilding and155 passing tests after the fix. This reviewer inspected the assertions and did not rerun the build/test suite while the main session's browser acceptance was reading shared generated assets.

## Verification

- Script/lint gate: PASS — `npm run check`.
- Whitespace: PASS — `git diff --check`.
- TypeCheck: N/A — the JavaScript package has no separate TypeScript/ESLint command; compilation is the main session's build gate.
- Full tests/build: main-session evidence, not independently rerun here.
- No additional runtime source edits, commits, API calls or data writes were made by this checker.
