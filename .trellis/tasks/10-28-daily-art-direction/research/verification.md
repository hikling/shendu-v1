# Visual / functional verification

Use isolated real backend from ignored shendu/tmp/daily-ui-server.mjs with synthetic records only. Existing58tests and previous full13question flow are baseline; this task changes daily visual/shell only.

- Inspect actual desktop screenshots of intro, sleep, energy and fact/action: composition must be a clear art-direction change, not old form with a color wash. Iterate if needed.
- Inspect390/320mobile: full input/button bounds, no horizontal overflow, art never occludes text or captures pointer.
- Verify one visible question, typing stable/reduced, intro brand/exit and editing exit/dirty cancel, then other-route header restoration.
- Verify retained fields after redraw/save, native metrics/date, validation positioning, historical2metrics/read-only/verification end.
- Verify whitecustomtheme/reducedMotion and normal keyboard focus, both saved/system motion source review.
- Syntax/targeted tests, strictaudit delta (baseline18), DESIGNlint baseline0errors/7warnings; update synthetic screenshots.

## Results — 2026-10-28

- Desktop1280×900: inspected intro, sleep, energy, fact, action. Full-bleed blue canvas, huge scene glyphs and native organic print are visibly distinct from the former form/cards. Large serif values and transparent writing surfaces keep actual answers in the foreground. Saved four synthetic screenshots in docs/daily-intro.png, daily-step.png, daily-energy.png, daily-writing.png.
- Visual iteration fixed oversized native number arrows, narrow status wrapping, intermediate-width art overflow and small-text contrast.320px max energy100 and sleep10 fit; units/status stack as full rows.320/390/720/820 viewport DOM checks show scrollWidth never exceeds viewport; art pointer-events is none.390px intro screenshot inspected, including custom white theme.
- Typewriter observed3/32 visible characters then32/32; start button bounds remain exactly x96,y642.21875,width160.859375,height60 throughout. Screen-reader full copy remains separate. Saved reduceMotion disables typing and glyph animation; system reduced-motion rule reviewed in source.
- New record13prompts: sleep/energy/metric/action fields retain values through next/back and add/remove redraw; required fact stays on its own prompt until filled. Manual save writes real isolated SQLite backend. One injected503 displays retained-content error; retry succeeds. Dirty exit cancel retains typed text. Completion locks journal and shows pending verification entry; exit restores shared header and clears daily body class.
- Historical record with2saved metrics uses12prompts, shows only旧阶段散步/旧阶段阅读 (not current stage metrics), then disabled journal and original locked verification results. Read-only/template, busy header controls and401 paths reviewed against unchanged logic; prior task's live401/busy verification remains applicable.
- npm run check and git diff --check pass. Full npm test58/58 pass (10daily-flow,21reel,27existing lifecycle/security/backup).
- Independent trellis-check agent reviewed full affected frontend scope and fixed local CSS issues above. No remaining source correctness findings.
- Premium strict audit:18baseline findings →18final, no new findings (dynamic footer handlers confirmed in browser). Existing static ownership/affordance/scrollbar findings remain outside this task. DESIGN lint:0errors/7existing warnings.
- All fixtures, account credentials, SQLite files and raw QA output remain in ignored shendu/tmp; docs screenshots contain synthetic values only. No production data or backend changes.
