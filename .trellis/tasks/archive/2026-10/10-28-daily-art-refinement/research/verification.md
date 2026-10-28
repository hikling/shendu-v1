# Verification

## Baseline / scope
Clean18b0e4a main. Native JS and CSS, no server/payload changes. Premium static baseline18; DESIGN lint baseline0errors7warnings. Browser3188 uses synthetic isolated real backend, ignored tmp only.

## Plan
- Desktop1280×900: intro,01sleep+energy,02facts,03action,04journal. Confirm side mapping, semantic scene, input affordance and screenshot.
- Compare computed brand styles with overview:36px square/radius12 seal; original red gradient, same shadows; serif wordmark23.76px/800/.22em at1280. Mobile32px at<=540; shared owner and no daily overrides.
-320/390/720/820 bounds and10/100, long text, focus, opened native select/date. Decorative art doesn't capture pointer.
- Keep one mounted prompt visible, back/next and redraw retain values, required feedback, dirty exit, manual save/failedretry, busy/locked/template paths.
- System/saved reduced-motion; custom white theme readability. Source review covers unchanged401 paths.
- Independent trellis-check; npm check + daily-flow10tests; premium static delta and DESIGN lint. Update screenshots/README/spec.

## Source contract supplied by implementer
`.daily-art-flow[data-daily-side]`:right for intro/evidence/action, left for reflection/journal. Scene variants intro/sleep/energy/evidence/reflection/action/calendar/journal. One aria-hidden `.daily-scene-art` holds `.daily-scene-image` local resources. Eight original600×640SVG. `headerBrandContent()` reuses canonical brand classes; daily lockup is decorative. <=820single-column, small art in normal flow.

## Results
- Desktop1280×900: intro/01sleep+energy/02facts/03action/04journal inspected. Actual captured content area1261×900 (native viewport gutter); six screenshots saved under docs/daily-*.png.01right,02left,03right,04left confirmed by visible screenshots and scene attributes. No image mirroring or field reordering.
- Semantic drawings inspected as full compositions; bed/moon, stretching, checklist, magnifier, steps/path, calendar and open journal are visibly associated with the prompt.8SVG safety/source checks pass; decorative art pointer-events:none and aria-hidden.
- Compared computed daily and overview desktop brand: exact match for seal dimensions/radius/red gradient/font/weight/shadow and wordmark font/size/weight/spacing/dark color. Mobile seal32px; daily no longer overrides brand styles.
-320×740 sleep10 and390×844 energy100 visibly complete, with clear white input/focus ring. No horizontal overflow at320/390/720/820.720/820 writing layout inspected; long multi-line fact wraps inside the field. Compact art remains in document flow and mobile uses normal vertical scroll. Opened native status selector and native date picker; no replacement popup added.
- Real isolated backend:13questions with3current metrics. Back/next preserves7.5sleep/100energy/fact/cause/action/if/then/date/journal. Added and removed supplementary fact, required fact error focused the field, and dirty exit allowed continuing without data loss. Injected save503 retained values; retry succeeded and reload restored them. Completion succeeded; locked journal disabled and pending verification link retained. Historical2metric record uses12questions, all fields disabled. Persisted synthetic record confirms expected values and completed status.
- White custom accents with saved reduceMotion:true: daily canvas remains#E9EDF7, text#152B54 and wordmark#1E1C19. Reduced-motion class active and full intro text shown. System reduced-motion CSS path, busy/401 and template preservation reviewed in unchanged source; not re-exercised through a delayed proxy in this task.
- Independent full-scope trellis-check found and fixed input contrast: border#7487A3 is3.51:1 against paper/3.12:1 against canvas, placeholder#5A7193 is4.77:1. After fix npm run check and daily-flow10/10 pass; SVG8/8 and git diff --check pass. See source-review.md.
- Premium strict static audit remains18 findings with identical per-rule counts to baseline (native-select1/actionless-button14/textarea-resize2/scrollbar1); no new static finding. Existing backup native confirm is outside this task. DESIGN lint0errors/7existingwarnings. This is a clean task delta, not a clean repository-wide strict audit.
- README, DESIGN, UX-CONTRACT, frontend architecture/UI contracts and asset provenance updated. QA data/helper remain ignored tmp; no real user records or credentials included. Publication follows the work commit, then task archive/journal and final HEAD CI verification.
- Work commit8853a3b pushed to public main. GitHub CI run40649325580 completed successfully: https://github.com/hikling/shendu-v1/actions/runs/40649325580 . Task archive/journal follow as separate bookkeeping commits.
