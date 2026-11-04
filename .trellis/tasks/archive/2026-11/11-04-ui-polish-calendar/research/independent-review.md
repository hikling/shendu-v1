# Independent review: UI polish and stage calendar

## Review scope and ownership

Read the task PRD/design and component-islands contract. This reviewer is read-only for implementation files; heading/legacy stylesheet ownership stays with the main session, primitive compatibility with its assigned worker, and stage Dialog/Calendar/Menu work with the surfaces worker. No application code was changed by this review.

## Shared heading and primitive review

- `setReviewPromptHeading()` normalizes legacy title values before string operations and builds each punctuation-delimited line with DOM text nodes / `textContent`. It does not interpolate template titles or metric names into HTML. Global emphasis offsets and per-line slicing use consistent JavaScript string offsets, including emphasis spanning punctuation boundaries. Null/numeric/HTML-like title regression cases are included in the real-owner tests.
- Daily and all five extended review heading callers delegate to the same owner. It reuses the existing Chinese comma/full-stop splitter, preserves punctuation and complete text, and keeps emphasis inside each displayed line. Block lines replace balanced headline wrapping without forcing unbreakable long phrases on phones. No review question, field, save, prompt state or payload was changed.
- NativeSelect's library icon remains hidden by the existing adapter. The authored history type/year/month and metric-status chevron containers now explicitly use `appearance:none` / `-webkit-appearance:none`; other native selects retain the browser arrow. Disabled authored chevrons have a reduced-opacity state. Actual names, values, option nodes and event/form collection remain untouched.
- The header compatibility selector now includes explicit `data-slot` menu Buttons that lack `sd-ui`. It preserves transparent, borderless header geometry for account/mobile triggers. Ghost Button no longer supplies its unrelated default hover background. Existing category and focus outlines remain separate from hover decoration.

No additional heading or primitive implementation issue was found at this checkpoint. The main session reported the three heading regression cases passed and visually checked the real financial-metric heading and single arrows at1280px/320px; those browser checks were not independently rerun by this reviewer.

## Coordinated findings resolved

- The initial snapshot retained `ui/surfaces.css`'s `.header-menu-item[data-highlighted]` fill and the legacy `styles.css` hover fill. Radix applies `data-highlighted` on pointer entry, so changing only the trigger/ghost variant would leave a rectangular account/mobile menu hover background. The surfaces worker replaced those backgrounds with a higher-specificity transparent hover/focus/highlight rule, underline feedback and a separate visible focus outline. Rechecked the final selectors against legacy hover and Tailwind utility specificity.
- Current account/mobile menu entries could retain the old `.active` fill until hover, then lose it under the new transparent rule. The main session chose a consistently transparent current state, using aria-current/class plus text weight and underline. The explicit `.sd-menu .header-menu-item:is(.active,[aria-current="page"])` rule now wins over the old current background both before and during interaction. This is the confirmed product decision, not an accidental loss of current-page semantics.
- `.stage-summary-item:first-of-type` matched every real Button because each has its own component host. It incorrectly removed all three statistics' left borders and applied the first-column inset to every column. Reported the real DOM ancestry issue; the implementer replaced it with the explicit `stage-summary-first` class on the first summary item. Rechecked both template and scoped stylesheet.

## Stage calendar review

- Stage surface now renders a single `.stage-folio` Dialog. `railDecor`, side-card overlay children and compact illustration-header output are removed from the application/surface templates; this is not a CSS-only concealment. `ui/stage.css` isolates the736px/650px folio geometry and status/focus rules from review verification calendars. The middle page owns necessary overflow; heading, Tabs and footer statistics stay fixed inside the viewport-bounded shell.
- The three real Radix Tabs retain force-mounted hidden inactive panels, so legacy stage/pending bindings and native fields remain available. Their visibility/focus and arrow navigation still have one component owner. Dialog mounting/disposal uses the same root registry and opaque-body boundaries.
- Stage Calendar retains local date conversion, first-match record identity, the original today-or-recorded-day eligibility, Chinese complete date/status names, fixed six-week rows and view-only month browsing. Selection still closes the stage surface before the original navigation guard. Caption styling adds an accessible full caption rather than replacing it with aria-hidden month/year fragments alone.
- Application/parent inert ownership, fresh child modal mounts, busy/persistent guards, initial/return focus and final authentication teardown remain in the existing app helpers; no parallel focus trap or document Escape handler was introduced. Parent and child still live in sibling roots. Existing nested-dialog/auth regression paths continue exercising those actual helpers.

No unresolved implementation finding remains from source review. Final real-browser size, keyboard/focus and lifecycle checks remain the main session's integration gate.

## Final calendar component identity review

The main session's final browser pass found navigation focus loss during a controlled month update. The shared `Calendar()` previously declared its custom Root/Chevron/WeekNumber component functions inside render. DayPicker treats those functions as element types; recreating Root changed the type and remounted its subtree, replacing the navigation buttons and losing focus.

The primitive implementer lifted `CalendarRoot`, `CalendarChevron` and `CalendarWeekNumber` to module scope. This retains stable component types across month/state updates while preserving the original rendered markup, rootRef forwarding, class/DOM props, chevron orientation and week-number children. `CalendarDayButton` was already module scoped. The `components` override spread still comes after defaults, so existing callers' DayButton/CaptionLabel customization remains supported. Date values, selected/minimum/disabled rules, month callbacks, locale, fixed weeks, Dialog/Tabs ownership and native form collectors are unchanged. A fresh components object is acceptable; the component function references supplied inside it must remain stable. Keep custom structural DayPicker components module scoped or otherwise reference-stable rather than recreating element types during controlled updates.

Reviewed the new production-build DOM regression in `ui-surfaces.test.mjs`. It exercises both real stage and verification surfaces, retains the original DayPicker root and both navigation nodes, asserts focus remains on the activated node, uses the saved next-button handle again across December-to-January, returns with the saved previous-button handle and confirms no date selection occurs while browsing. This would fail when a month update disconnects/replaces the saved controls, rather than merely asserting the displayed month text. Existing calendar tests still cover disabled/locked dates, six rows and original record identity. The implementer/main session reported first reproducing failure against the old build and passing the focused regression after the fix; that red/green execution was not independently repeated by this reviewer. No further source or test-contract issue was found. The main session owns the final full suite and real-browser focus recheck.

## Documentation synchronized

Updated the remaining old760px/side-card rules in `ui-quality.md`, `DESIGN.md` and the later stage section of `UX-CONTRACT.md` to the new736px/650px folio, no side-card template output, isolated stage.css and necessary page-internal scrolling. Preserved the main session's new shared-heading paragraph and already-updated architecture/adoption/primary UX sections. The main session owns any final QA/README/task completion records.

## Verification ownership

`git diff --check` passed at the completed source-review checkpoint. No separate ESLint or TypeScript configuration exists; production JSX compilation and the native syntax gate are the project checks. The main session owns and reports the final production build, syntax check, full test suite, desktop/mobile browser validation, resource-version updates and main/CI completion. This report does not claim independent execution of those final integration gates.
