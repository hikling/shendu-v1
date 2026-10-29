# Five Extended Review Flows

## 1. Scope / trigger

This contract covers `weekly`, `monthly`, `quarterly`, `yearly`, and `decision` in `shendu/public/`. The five screens reuse the daily art canvas and question controls, but keep their own prompts and stored data. They do not add a route, server field, or migration.

## 2. Signatures

- `EXTENDED_FLOW[type].stages` in `extended-flow.js` defines ordered stage IDs, labels, and field IDs.
- `extendedPrompts(type, QUESTIONS[type])` returns ordered `{id,stage,stageIndex,phase,required,kind}` prompts. It throws if a question is missing from the flow or an unknown field is introduced.
- `extendedPromptNeighbor(prompts,current,direction)` returns the adjacent ID or `null` at a boundary.
- `extendedPromptIssues(data,title,prompt,beijingToday)` checks only the visible prompt; `extendedReviewIssues(data,title,prompts,beijingToday)` checks all prompts. Both return `{field,reason}` issues without mutating data.
- `renderReview()` mounts all inputs once through `extendedReviewHtml()`; `showExtendedPrompt()` only changes `hidden`, phase/side attributes and focus. `state.extendedPrompt` preserves the current question across answer redraw, save, and completion.

## 3. Contracts

All five forms send the existing `PUT /api/records` payload: `title` (required for `decision`), `data.answers[questionKey]` as arrays of up to five strings, plus `data.action`, optional `data.ifCondition`, required `data.ifThen`, and `data.verifyDate` in `YYYY-MM-DD`. Their existing period, `status`, `version`, and `templateSnapshot` rules stay intact. The `ifThen` screen renders both `ifCondition` and `ifThen` together and collects both original keys. The inline calendar only changes `verifyDate` when a day is explicitly selected. A local next/back movement does not save. Daily is different: its original server rule requires both contingency fields.

The art wrapper exposes `data-review-type` and `data-review-phase` with one of the 16 semantic slugs in `docs/extended-illustrations.md`; the intro uses that type's first phase. Each type currently displays its own `assets/overview/<type>.svg` as a temporary image. Art is `aria-hidden` and pointer inert. Replace each phase's asset mapping when its separately generated image exists; do not change the stored record or questions to select art.

## 4. Validation and error matrix

| Condition | Current screen | Completion |
| --- | --- | --- |
| Optional answer empty | Continue | Allowed |
| Required answer has no nonblank entry | Stay and focus its first textarea | Return issue for that question |
| Decision title empty | Stay on title input | Return `recordTitle` issue |
| Optional `ifCondition` empty | Continue | Allowed for all five types |
| Required `ifThen` empty | Stay on paired screen and focus response | Return `ifThen` issue |
| Date missing, invalid, or before Beijing today | Stay on calendar and focus visible eligible day | Return `verifyDate` issue |
| Completed, verified, or historical record | Bypass writing gate; controls disabled | Server state remains locked |

`showExtendedIssues()` must reveal the issue's screen before focusing its input. A hidden answer never leaves keyboard focus in an invisible panel. Server validation remains the final authority.

## 5. Good / base / bad cases

- Good: enter a required weekly answer, add a second item, advance, save, reload, and return to a preserved ordered array; complete after the paired action and valid date.
- Base: skip optional pattern or values on an existing blank draft; navigating back must retain other inputs and dirty state.
- Bad: advancing with an empty required answer, missing decision title, missing `ifThen`, or impossible date must stay on the precise page and focus a visible control. An empty `ifCondition` must never block an old five-type draft.

## 6. Tests required

`tests/extended-flow.test.mjs` asserts that every `QUESTIONS` key appears exactly once for all five types, the action fields remain present, traversal stops at both ends, optional questions do not block, required answers inspect all entries, blank `ifCondition` stays valid, blank `ifThen` is rejected, and final checks reject missing title/action/date. Run `npm run check` and `npm test`. Browser-check five intros and first prompts, phase/side changes, add/collapse, save/reload, lock/read-only, a narrow phone width, keyboard focus, and reduced motion.

## 7. Wrong vs correct

Wrong: render only the current answer and discard the previous textarea when moving forward; `collectCurrent()` then loses hidden answers and draft saving silently changes the payload.

Correct: keep all prompts mounted, toggle `hidden`, call `collectCurrent()` before moving, and preserve `state.extendedPrompt` during any form redraw. Keep the two contingency fields on one mounted screen; collect both, but only require `ifThen` for these five review types.
