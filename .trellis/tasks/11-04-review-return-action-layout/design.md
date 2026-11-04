# Design

## Boundary
Owners: app.js handles in-memory route entry/exit, filters and guarded navigation; styles.css owns archive page layout; index.html asset revisions. Existing category colors, image allocator, date policy, record schema, server and approved overview art remain unchanged. Extend existing navigation rather than use browser.back(), which can leave the app.

## Return navigation
Capture a validated UI-only source route when entering a record, before changing state.route. Both daily/extended exit handlers use the same return owner through attemptNavigate. Preserve context across save/rerender and local prompt movement; reset for genuinely fresh entries. Restore source filter state, scroll and invoking record focus where practical. Cover calendar and overview entries so they cannot accidentally inherit a prior history origin.

## Action layout
Retain wide single-record rows and category palette/transparent illustrations. Replace the two independent rounded disclosures with one coherent reading section: original plan as a full-width anchor, actual result and adjustment as aligned subparts of the same surface. Use meaningful labels once, clear Songti/utility hierarchy and dividing rules. Pending cards show only original plan plus existing validation CTA/date rules. Long content wraps naturally; no fixed height clipping, fake stamps or new decorative numbering. Support collapse only if needed for genuinely long content, using native details with text disclosure label rather than plus that resembles close. Reuse record snapshot label strings and escape all content.

## Canonical UI
Routes and guard: app.js navigate/attemptNavigate. Records: state.records + templatesForRecord. Scroll: document body, no global height/overflow edits. Theme: existing category action-tone/soft variables. Forms, submission, toast and calendars keep existing owners. Tests target observed navigation/render behavior, not only source matching.
