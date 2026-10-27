# Verification plan

Use ignored `shendu/tmp/daily-ui-server.mjs` with isolated real backend/SQLite and synthetic data; no user data. Baseline is the previous completed daily-flow task (54 tests). Previous audit has15oldfindings plus3proven static false positives on dynamic footer bindings.

## Runtime acceptance
- Enter intro and count progressively revealed glyphs at two moments; typography larger, complete paragraph reserves constant bounds. Start before typing finishes and confirm animation ends/cancels.
- Every prompt has exactly one visible writing group; default sequence13questions: sleep/energy/metric0/metric1/metric2/risk/today/cause/action/ifCondition/ifThen/verifyDate/journal.
- Header hidden+inert, zero reserved header offset, keyboard cannot reach menu; previous to intro and dirty-aware exit restore navigation. Other routes retain header.
- Sleep/energy and each metric remain optional; today required; action/obstacle/response/date required only at their own prompt; cause/risk/journal optional.
- Previous/next and add/remove preserve fields/dirty/prompt, save failure+retry stays on same prompt, first save ID change does not reset prompt. Switching has no writes.
- Historical verified record traverses all prompts read-only and has original verification; completed record pending entry remains reachable.
- Desktop1280 and phone390/320, keyboard focus, no horizontal overflow, saved/system reducedmotion static full text, typewriter cleanup, readable custom theme.
- Syntax/tests and independent checker; README/DESIGN/UX/spec and synthetic screenshots updated.

## Results
- PASS: typewriter changed from2/29visible glyphs to29/29, with identical full-text geometry134.375px high; semantic accessibility tree exposed the paragraph once. Starting at0visible glyphs entered sleep immediately and cancelled typing. Desktopfont42px; mobile390px font30.03px. Glyph layout stayed fixed.
- PASS: default13questions traversed in specified order; sleep→energy→each metric→risk→today→cause→action→ifCondition→ifThen→verifyDate→journal. Only current question visible. Header hidden+inert and workspace padding0; exit restores visible/non-inert header.
- PASS: previous/next retained sleep7.5 and energy80 plus metric text/status. Dirty exit→cancel stayed at metric0. Today add/remove retained question, values and keyboard focus after first serverID allocation.
- PASS: optional evidence/cause/journal did not block; today/action/obstacle/response/date each reported only its own requirement. Pastdate focused verifyDate; validdate reached journal.
- PASS: no current-day server record existed before explicit save. One-shot503 save retained values/question and retried successfully. Injected401 opened persistent reauth while keeping immersive state/current today prompt; real synthetic-account login and save retry preserved all inputs.
- PASS: complete503 retry remained journal; success stayed at journal with zero editable fields and reachable pending-verification dialog. Historical verified record with2old metrics showed12questions, preserved old metric names, had zero enabled inputs and original result available at end.
- PASS: 320/390/820 layouts had no horizontal overflow; mobile metric textarea/select, footer and headings visually inspected. Native status select expanded. Saved reduceMotion showed full text immediately without typing; white custom accents retained readable progress/text. System matchMedia change path reviewed, not overridden in browser.
- PASS: opening stage/calendar during active typing stopped/revealed it; checker fixed this one cleanup gap. Shell/auth/modal/intro departure and media listener cleanup reviewed. Final clean browser load had no console errors.
- Checks: npm run check;58/58fulltests(10daily,21reel,27existingsecurity/lifecycle);checker10dailytests anddiffcheck. Strictaudit18→18(no new findings; pre-existing3dynamic-footer false positives remain documented in prior task). DESIGNlint0errors/7existingwarnings.
- Screenshots updated with synthetic data: docs/daily-intro.png, docs/daily-step.png; no runtime data/credentials committed. Real QA backend and helpers remain ignored under shendu/tmp/.
