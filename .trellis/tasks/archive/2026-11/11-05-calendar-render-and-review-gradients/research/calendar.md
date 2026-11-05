# Calendar implementation and causal evidence

## Proven source issue

`CalendarDayButton` used `getDefaultClassNames().day`, which is `rdp-day`; DayPicker assigns that same class to its grid-cell td. Shared and stage CSS assign table-cell layout to `.rdp-day`, so both cell and button matched cell selectors. The prior stronger `.stage-day` selector overrode display back to flex, but the semantic collision and cell-level property matches remained. This is an actual local integration error independent of whether a particular browser repaints it visibly.

Changed the button to the correct `defaultClassNames.day_button` (`rdp-day_button`) and scoped stage cell geometry/state selectors to `td.rdp-day`. Button control styles stay explicit flex. This prevents cell-layout selectors from ever selecting a nested day button; no clipping or duplicate-date filtering workaround was added.

## User symptom and uncertainty

User screenshots clearly show multiple painted `1/廿三` copies on the first week of November2026, sometimes beyond the seven-column edge. The DOM-based prior test only checked empty outside-month cells and did not catch visual repaint defects. Parent browser baseline on an empty fixture at961/1000/1100/1200/1280px did not reproduce the extra copies: DOM consistently had30 buttons and six empty first-row cells before November1. Therefore do not claim that source inspection proves the exact browser paint cause; the class collision is confirmed, the correlation to the user's duplicate drawing is plausible but remains environment-specific. Parent owns before/after visual validation on the new build.

## Layout

- Status legend is first in a dedicated top toolbar, aligned right; removed bottom legend.
- The centered month/year caption is between the month arrows; the nav span centers with a280px maximum and shrinks with the calendar.
- Existing seven equal table columns, six weeks, lunar/terms, status markers/legend, view-only month browsing, record IDs, original disabled rules and DayPicker focus handling remain.
- Only the stage calendar layout changed; shared button class correction is checked on both stage and verification calendars.

## Tests

Source syntax (`node --check tests/ui-surfaces.test.mjs`) and scoped `git diff --check` passed. No build was run by this implementer to avoid concurrent bundle mutations.

Updated bundle DOM tests assert that no button carries the cell class and both calendar button types carry `rdp-day_button`. Added empty November -> December -> January -> December -> return regression:42cells/sixweeks/sevencolumns, real dates unique, day1 exactly once, all outside cells structurally empty, stable activated next-button focus and no implicit selection. These tests require the parent-owned new production build. Actual paint/layout/legend/caption responsiveness is the parent's browser gate.

## Files

- shendu/ui/components/ui/calendar.jsx
- shendu/ui/surfaces.jsx
- shendu/ui/stage.css
- shendu/tests/ui-surfaces.test.mjs
