# Independent source review — imagegen art and number panels

2026-10-28, baseline `d5cf40b`. Reviewed the full task PRD/design/implementation, check context, frontend index/architecture/state-and-data/UI-quality, and current app/CSS/asset changes. `get_context.py --mode packages` reports a single repository with frontend/backend layers. Changes remain frontend presentation and local resources; no server, API payload, persistence, authentication or backup change.

## Findings fixed

1. Visible-label/name mismatch in `gaugeCard()`: the new visible labels “睡眠时长/精力分值” were overridden by the former aria-labels. The implementer incorporated this review finding: names now include the visible labels plus the former descriptions; both explicit label associations and status/hint references remain intact.
2. Zero-width native number editing buffer in `gaugePresentation()`: the main session reproduced typing `-` after clearing the input. Native `value` was empty, `validity.badInput` true, `:placeholder-shown` false, and the computed input width collapsed to0. Changed empty/unparseable `inputCh` fallback from0 to4.12ch, with a source comment explaining native buffers such as `-`/`1e+`. The real empty placeholder still uses its dedicated4.4em rule. Finite-value widths, ruler/status logic and saved values are unchanged; existing flex shrink keeps the fixed unit inside the outer field. The main session owns the post-fix browser regression evidence.

## Source conclusions

- `gaugeCard()` remains the sole sleep/energy markup owner, called only twice by `dailyEvidence()`. `gaugePresentation()` is shared by initial rendering and `updateGauge()`. Empty/null/undefined/blank/nonfinite values show waiting copy and hide both fill and knob; real0 shows the actual0 pointer. Sleep uses the complete0—24 domain and0/6/12/18/24 ruler; energy uses0—100 and0/25/50/75/100. Baseline position is calculated from the actual stage setting and the same domain, including boundary and custom baselines. Comparison copy is neutral and adds no medical conclusion.
- The reference ruler has no slider role, handler or focus target. Number inputs retain `type=number`, min/max/step, the same `data-simple` values and input event path. Chinese units, state, hint and baseline are integrated in one panel. Valid digits use intrinsic ch width; invalid native buffers retain positive editable width. Only the internal input/unit position changes; the outer field geometry is independent. Focus is visible on the label wrapper; disabled text remains readable and its pointer styling is neutral.
- Question counts and the top “回到引导” control were removed from markup, listener, visibility writes and CSS. The live status now reports group and question title, without a count. The footer's previous/first-question return remains mounted and uses the original collect/guard path. All other questions remain mounted, so switching and redraw still retain values.
- Dirty marking/exit guard, busy disabling, manual save, failure retry,401 reauthentication preservation, first-save ID, final validation/lock flow, read-only afterword and historical template/metric handling retain their existing owners and code paths. Image/number presentation does not write data. Shared branding,01right/02left/03right/04left scene mapping and the other five forms remain unchanged. Removed legacy gauge CSS was used only by the former daily gauge markup.
- Scene markup references all8 local WebP resources using overview21 and correct1254×1254 dimensions; all8 scene selectors remain present. index JS/CSS and daily module use overview21. No stale SVG path or removed-progress-control reference remains in runtime app/CSS. The decorative parent remains aria-hidden and pointer-inert; reduced-motion rules cover scene and ruler transitions.
- Parsed the image manifest and prompt JSON. All16 PNG/WebP SHA256 values and byte sizes match disk; every pair is1254×1254 with identical real alpha. Visible pixels match exactly after compositing onto fog blue, white and black. The outermost pixel alpha is at most1; substantive artwork retains transparent margins. PNG total5,660,414B, WebP total3,447,480B. All7 follow-up subjects plus the separate sleep prompt are reconstructable. No runtime generation call or external asset fetch is introduced. The main session owns provenance wording and visual style approval.

## Verification

- `npm run check`: PASS after the final width correction. This repository configures JavaScript syntax checks, not a separate linter or TypeScript checker.
- `node --test tests/daily-flow.test.mjs`: PASS10/10 after correction.
- Isolated execution of the actual app helper code: PASS23 numeric/empty/invalid/custom-baseline cases; sleep0/7.5/24 and energy0/75/100, zero/max/custom baselines, out-of-range finite values, nonfinite/blank/native-buffer strings. Filled→clear→0 update behavior and both locked markup variants passed. Every empty/unparseable case now retains positive editable width. This is source smoke evidence, not a substitute for the real-browser number-buffer regression.
- PNG/WebP/hash/prompt/resource/selector checks: PASS8pairs/16hashes. CSS braces balanced.
- `git diff --check`: PASS; Git only reports the existing LF→CRLF normalization notice for the asset README.

## Scope boundaries / not fixed

- The repository's existing backup-target deletion still uses native `confirm()`; it predates this task and is outside the daily presentation scope. No new native-dialog or nonsemantic click path was introduced.
- The main session owns real-browser visual/state verification, screenshots, current DESIGN/spec/README updates, premium static baseline/delta and publication. This source review does not claim those runtime results or a clean repository-wide premium audit.

No unresolved source finding introduced by this task remains after the two corrections above.
