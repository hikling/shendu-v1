# Implementation handoff

Owned source edits: shendu/public/app.js,styles.css,index.html. Root owns docs, CUA and publication. No commit/push/browser performed by implementer.

- Calendar card nowmax352px with14pxpadding (12px on<=390px), versus520px/22px baseline. Centered larger Songti month uses only three header columns. Day buttons are32px circles, today has outline/dot, selection has dark fill and restrained shadow. The blue-paper surface, smaller weekday rhythm and fixed6rows keep the card compact. The today action moved into a quiet footer inside the same delegated month root; duplicate outer help was replaced with concise footer text. All existing data attributes, hidden verifyDate input, labels, selection/error/busy/keyboard owners and readonly flags remain.
- overviewBurst(className='overview-type-burst') allows the daily decorative class while preserving default markup byte-for-byte. dailySceneArt adds one daily-art-burst span with the same16vectors/delays/shapes; all8images, positions and dimensions remain unchanged. Daily CSS supplies local teal/mint/gold coloring and art-relative container units; particles run once for.9s, ring.75s and finish transparent. No timer, RAF, ambient loop or icon/art rotation was added. Removing only art's contain:paint allows outgoing particles; the existing canvas overflow-x:clip still contains page decoration.
- bindDailyArtBurst listens on the existing daily canvas, with a bounds check on the pointer-inert art. It never changes hit layers or input geometry. It ignores controls/content surfaces, touch, held-button dragging, coarse/nonhover pointers, saved reduce-motion and system reduced-motion. It sets is-bursting once per entry, resets on exit/blur/media change, and can replay on re-entry. cancelDailyArtBurst resets at prompt changes and theme reduction; setDailyImmersive(false) disposes canvas/window/media listeners before shell/auth replacement. No click action, Tab stop, focus/data/dirty mutation or network dependency was added.
- JS/CSS entry, existing module imports and daily scene cache refs consistently useoverview25. Calendar model/tests, backend, schema, illustration files, overview CSS and other-five form owners are unchanged.

## Checks

- npm run check PASS.
- Existing daily-flow12 + daily-calendar9: PASS21/21.
- Actual-source smoke tmp/calendar-check-smoke.mjs PASS18unchanged critical functions and5actual calendar template cases, including original readonly/empty/error-compatible structure.
- Actual-source smoke tmp/burst-source-smoke.mjs PASS default overviewBurst byte equivalence,16particles, mouse entry/re-entry without loop, controls/touch/drag/reduced-motion suppression and complete listener cleanup. These use source-level element/media stubs, not a browser substitute.
- git diff --check PASS.

Root browser QA remains responsible for actual visual size/aesthetic acceptance, hover hit behavior/particle visibility, clipping/mobile bounds, date interaction/save/readonly and motion preference rendering. No rendering result is inferred from source checks.
