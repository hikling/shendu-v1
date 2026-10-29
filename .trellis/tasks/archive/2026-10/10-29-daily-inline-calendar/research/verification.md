# Verification — daily inline calendar

2026-10-29, baseline24e4d43. CUA exercised the local real SQLite backend through an isolated QA proxy and synthetic records only. The foreground helper/browser was interrupted by user continuation; final calendar selection/persistence/readonly acceptance was performed after restarting the fixture. No production user data was edited.

## Browser acceptance

- Entered the verification prompt through the existing flow: the Chinese month calendar was already rendered, with no extra input/popup click. Initially showed未选择验证日期, with the stored value still empty. Advancing without selection focused the visible2026-10-29day and associated aria-invalid/error text;2026-10-28 was disabled.
- Browsed toNovember and back: selection stayed empty and save status remained saved. ArrowRight moved focus29→30 while value stayed empty; native Enter selected30 and saving succeeded. PageDown moved focus toNovember30 while keeping the October30 selection and saved status; PageUp returned. Date labels use full星期 names.
- ClickedOctober31, forced one503save failure and observed the chosen date retained with retry feedback. A separate retry succeeded; reload/reentry restoredOctober31, its selected styling, month and saved state. No extra response/step appeared.
- At390/320px there was no horizontal document overflow; calendar panel stayed within x24—359 and24—296. Available day buttons measured41.84×37px and32.84×37px respectively. Group03, date and exit remained visible. The daily prompt computed700-weight Songti with explicit SimSun/system fallback, retaining39.04px at1280; baseline was500 at the same size. Daily header contained zero logo/seal/wordmark nodes on intro and writing.
- White custom accents plus saved reduceMotion=true: intro had zero hidden glyphs; calendar selection retained white text over its independent dark-blue background; prompt remained700weight. No remote font was added.
- Completed the synthetic draft with its original required fields through the existing lock dialog; returned to calendar. It retainedOctober31, all date/month/today controls were disabled, and no save button remained. Locked-past-month behavior is additionally covered by the model and actual-template checks, not asserted as a separate historical browser run.
- Exited to overview: shared header was visible and its brand remained present. Overview/rail calendar and other-five owners are byte-identical in the independent source smoke.
- Captured actual intro, sleep, energy, fact, cause, action, contingency, diary and calendar views. Converted native captures to PNG without editing pixels; all related daily README screenshots now reflect the logo removal/bold headings, with new docs/daily-calendar.png. No screenshot synthesis.

## Source and automated checks

- Independent trellis-check fixed one compatibility bug: validated non-string legacy date representations now normalize to string in the display model, without mutating supplied data. Added regression; see source-review.md.
- npm run check PASS, including the new calendar module. Daily-flow12 plus calendar9 tests PASS21/21; cases cover empty/selection/browse, editable-expired/locked-history, leap years, keyboard month/year/min/max bounds, full Chinese labels and legacy value normalization.
- Independent smoke:18 critical existing functions unchanged; five generated calendar templates have one hidden field, native table,42cells, correct edit/readonly tab behavior. No API/schema/runtime dependency/art/overview/reel changes.
- Premium strict audit17existing findings, identical file/rule/message multiset to baseline; no new findings. Exit1 remains acknowledged rather than represented as a clean static audit. DESIGN lint0errors/7existing warnings. git diff --check PASS.
- Not newly exercised: system-level reduced motion,401reauth, actual touch/virtual keyboard or assistive technology. Their unchanged shared owners remain source-reviewed. Narrow views are real browser viewport tests.

## Publication

Work commit23646b1c9d3ade18f74e74e6db1b25ba58470dd8 fast-forwarded to main and pushed. Exact-revision Verify build run40821924855 completed successfully: https://github.com/hikling/shendu-v1/actions/runs/40821924855 . README22local references all resolve. Browser viewport reset/owned tab closed; verified temporary helper67032 and children were stopped. Finish-work archive/journal follows the accepted work commit. No deployment claimed.
