# Verification — overview row and daily text layout

2026-10-28—29, baseline `9abe2cb`. Browser QA uses CUA with an isolated real SQLite backend and synthetic records, never the user's journal data. The earlier browser-credit approval failure was retried only after the user confirmed credits were restored; normal browser access succeeded. No alternate browser automation or approval workaround was used.

## Visual and interaction acceptance

- Overview: measured six entries on one row at1280/1100/960/820/701px, with unchanged96px icons and no document horizontal overflow. The first expanded information card stays inside the viewport at1100 (x323.5—543.5),960 (147—367),820 (77—297) and701 (42.5—262.5). Keyboard focus opens the existing information panel, Escape closes it, and direct icon activation enters daily. The existing arc, hover handlers, overview data functions and illustration assets are unchanged in source. At<=700px the phone layout remains three columns.
- Intro: the user's exact quote now has four punctuated blocks: 忙碌结束后， / 留几分钟给自己。 / 看看哪些投入， / 真的换来了想要的生活。 At1280px all four blocks measure71.484px high (47.649px font); at960px60.09px (40.064px font), and821px50.438px (33.620px font), without an extra incidental desktop wrap. At390/320px natural wrapping remains legible with no horizontal overflow. Full text remains mounted while the original typewriter changes glyph visibility.
- Reduced motion: saved reduceMotion=true and custom white accents on the disposable fixture; reloaded and opened the real intro. All four clauses were visible, zero hidden glyphs, no group shown before starting, no overflow. Sleep input and prompt retained the independent blue ink and visible paper/border. This verifies the saved preference; the system preference path was unchanged and source-reviewed, not separately toggled this round.
- Header: writing shows01 · 今日证据,02 · 事实与原因,03 · 明日行动,04 · 日记 beside the canonical red seal and wordmark, following actual prompts. There is exactly one daily-current-group node, zero body progress wrappers and zero gauge-title rows. Intro clears/hides the group. At320px the writer header group begins at y30 and the seal remains32px; switching no longer scrolls the moved group offscreen. Returning to intro keeps the focused start button visible (bottom704.34 in740px viewport for the long user quote).
- Input/persistence: entered sleep7.5, energy80, a fact, action, obstacle/response, verification date and diary in the disposable current-day draft. Save remained on04; reload and reopen preserved sleep7.5/energy80 and entered text. Previous/next kept data. Required empty obstacle feedback still focused its original input. Sleep/energy accessible names remain complete despite the removed visible title row.
- Historical read-only: opened the verified prior-day daily through the reel, selected 查看复盘, observed01 beside the logo, a disabled named sleep input, readonly feedback and no save action. Historical metrics use their original count. No completion or verification was performed on user data.
- Captured native screenshots for intro, sleep, energy,02,03,04 and the restored overview row. Converted JPEG captures to PNG without editing pixels or synthesizing a UI. Updated six existing daily screenshots and added docs/overview-row.png; README links the new row proof. Some screenshots were captured on28October and remaining stages on29October, reflecting the actual local QA dates.

## Source and automated checks

- Independent Trellis full-scope review and focused fitting/scroll follow-ups: no unresolved source defect; see source-review.md. Fourteen actual quotes produce46 clauses with punctuation/text/glyph count preserved. Twenty critical business/brand/typewriter functions match baseline after normalized line endings.
- `npm run check`: PASS.
- `node --test tests/daily-flow.test.mjs`: PASS10/10.
- `git diff --check`: PASS.
- Premium strict static audit:18 existing findings, zero new rule/file/message findings against the task baseline. Its exit1 is retained and not represented as a clean audit. Existing delegated-button/native-control/textarea/scrollbar findings are unchanged and outside these four corrections.
- DESIGN.md lint:0 errors,7 pre-existing warnings.
- No backend, persistence schema, daily-flow module, overview-reel logic, existing illustration, dependency or deployment setting changed. The full API/security suite is left to the repository CI; focused daily tests are the local change gate.

## Publication

Work commit `c61a572791c8049095f5b4d05b9c9bfdaf4a58ce` pushed to origin/main. Exact-revision Verify build run40732293526 completed successfully: https://github.com/hikling/shendu-v1/actions/runs/40732293526 . README's19 local references all resolve. No new deployment is claimed by this task. Finish-work bookkeeping follows this accepted work commit.
