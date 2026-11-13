# Wheel navigation implementation and checks

## Behavior owner and boundary

`public/review-wheel.js` owns the shared wheel-burst state and native-content priority. `app.js` imports it once and `bindReviewWheel()` binds the current `.daily-flow` after its real daily/extended button handlers. The listener covers the art, writing surface and footer rather than the `display:contents` editor alone. No document/window wheel listeners, timers, saved record fields or new write requests are used.

- 90 normalized vertical pixels trigger a step. One continuous burst can step once; another step needs both 650ms after the prior step and 220ms without wheel input. Opposite directions reset unfinished accumulation but cannot evade a consumed burst or cooldown.
- Pixel, line (16px) and page (viewport) units normalize before accumulation. Horizontal/zoom/modifier wheels, numeric/range/select controls and IME composition retain native handling.
- A textarea, scrollable ancestor or document with room in the wheel direction gets native scroll. That entire burst remains consumed even at its edge; a fresh settled gesture may then navigate. This prevents momentum in long content turning into a new question.
- Account/editor ownership, active question, preference, saving, inert backgrounds and modal/menu/listbox presence gate navigation. The preference defaults on when absent. Detached canvases ignore events and each binding returns a disposer; rebinding the same canvas disposes its prior listener.
- Stepping clicks the original visible enabled `[data-daily-next]` or `[data-daily-back]`, preserving exact prompt validation, collection, focus, saved snapshots and read-only behavior. First-question upward wheel stays on that question. Intro wheels never start a review. Last-question downward wheel cannot invoke completion/deletion or navigation.

## Files

- New controller: `shendu/public/review-wheel.js`.
- App changes limited to import, `bindReviewWheel()` and a call after existing flow binding.
- `package.json` syntax check includes the controller.
- Existing review-write and draft-delete function-extraction fixtures only gain the new binder/module dependency, with previous assertions unchanged.
- New tests: `review-wheel.test.mjs` and `review-wheel-flow.test.mjs`.

## Verification

`node --test shendu/tests/review-wheel.test.mjs shendu/tests/review-wheel-flow.test.mjs shendu/tests/review-write-ui.test.mjs shendu/tests/draft-delete-ui.test.mjs`: **41 passed, 0 failed**.

Seven controller/DOM cases cover long momentum bursts, direction changes, quiet/cooldown ordering, units, native scrolling, disabled/busy/composition/boundary/detached/disposed surfaces, modifiers and controls. Four actual-app cases use the built shadcn bridge and real daily/extended render, show, bind, validation and collection functions: all six read-only flows traverse both ways without any submission, all six editable flows reject empty required fields then retain the same typed input through next/back, 100 continuous wheel events cannot sweep questions, and preference/busy/modal/account/overflow guards hold. Two existing suites (30 tests) remain green. Parent coordinates full suite and browser acceptance.
