# Implementation handoff

Owned files: shendu/public/app.js,styles.css,index.html,daily-flow.js and tests/daily-flow.test.mjs. Root owns documentation and browser QA. No commit or push from implementer.

- Overview heading changes from clamp(2.5rem,5.2vw,4.4rem) to clamp(3rem,6.2vw,5.2rem). The existing two lines, colors and fonts remain. Large category size128px,<=1280px112px;701—820px uses clamp(98px,(100vw−104px)/6,112px) and8px gaps. <=700px remains three columns. <=540px icons use clamp(88px,(100vw−63px)/3,96px) with8px column gaps; the small heading has an available-width font cap. Only the first information panel changes side through1400px to avoid clipping after the larger row. Art and reel logic are unchanged.
- Fourteen daily quotes each have two clauses, each exactly5codepoints including punctuation. The other five quote pools are unchanged. Intro type is clamp(52px,5.6vw,88px) plus the existing safe desktop container cap;<=820px44—58px and<=390px40px. Existing glyph mounting, escaping, semantic full text, timers and reduced-motion paths remain.
- dailyAnswerInputs wraps only daily today/cause rows in native details.daily-answer[data-daily-answer]. One row begins open; adding opens the appended row, and native toggle keeps a single row open per question. dailyAnswerPreview yields a whitespace-normalized72-codepoint summary, escaped at initial render and written through textContent on edits. All original data-answer/index textareas remain mounted. openDailyAnswer/focusDailyAnswer reveal/focus added, retained or invalid targets; opening also recalculates textarea height. Collapse alone does not set dirty or write records. Locked fields remain disabled while native summaries permit reading.
- answerItemRow and answerAddButton share the original row/control markup rather than duplicating it for disclosures. A manual actual-source comparison proves non-daily itemInputs output byte-identical to HEAD across400cases (five types, keys, values, labels, locks and accessible labels).
- Stable combined prompt ID is ifCondition; dailyPromptOwner maps ifThen to that owner in validation, traversal, showDailyPrompt and restored prompt selection. Both fields retain independent data-simple keys and labelled inputs on the same screen. Current-screen validation gates both original requirements; showDailyIssues displays that owner then focuses the exact missing field. Final dailyStepIssues and server validation are unchanged. Date is the next screen. Original saved templates/field payloads and03scene remain.
- Entry CSS/JS, changed daily-flow import and scene image cache URLs consistently use overview23.

## Checks

- npm run check: PASS.
- node --test tests/daily-flow.test.mjs: PASS12/12, including both-missing, each-one-missing, both-present, unchanged final requirements, legacy response mapping and paired forward/back traversal.
- git diff --check: PASS (only existing Git LF/CRLF checkout notices).
- Manual actual-source smoke shendu/tmp/compact-source-smoke.mjs: PASS400non-daily byte-equivalent cases;14two-clause quotes/max5codepoints; preserved five other quote pools; safe disclosure HTML/textareas.
- Premium strict audit shendu/tmp/compact-implement-audit.json:17findings; baseline18. Existing findings remain subject to root's baseline comparison and manual adjudication. This is not a clean static audit.

Browser layout, native disclosure keyboard/toggle timing, saved/failed/busy/401 and historical read-only runtime acceptance are explicitly root QA responsibilities; source checks alone do not establish those results.
