# Bug Analysis: calendar cell styles leaking into buttons

## 1. Root Cause Category

- B / D / E: component-to-CSS identity contract, visual test coverage and implicit semantic assumptions.
- Proven defect: CalendarDayButton incorrectly used DayPicker's day-cell class. Both td and button then matched cell layout/border/size selectors. A display:flex override only corrected one conflicting property.
- The user's repeated visible 1/廿三 is clear screenshot evidence. The exact duplicate painting was not reproduced in this browser's old empty/populated fixture, so a definitive browser-paint cause is not claimed. Correcting the shared class contract removes the confirmed source defect.

## 2. Why the previous fix was insufficient

1. Explicit table rows/cells fixed geometry but retained the button/cell class collision.
2. Previous assertions found unique dates and empty outside td nodes, which cannot validate real glyph painting.
3. Populated first-of-month cells had opaque status backgrounds; transparent empty-month cells also needed inspection.

## 3. Prevention Mechanisms

| Priority | Mechanism | Action | Status |
| --- | --- | --- | --- |
| P0 | Component identity | Buttons use rdp-day_button; stage cell selectors target td.rdp-day | Done |
| P0 | Regression | Both calendars reject cell-class buttons; empty-month cross-year tests assert unique dates and stable focus | Done |
| P1 | Visual review | Empty/populated calendars, month/year navigation, reentry and320/390/820/1000/1100/1280px | Done |
| P1 | Spec | Record exclusive identities and the limits of DOM-only paint validation | Done |

## 4. Systematic Expansion

Shared CalendarDayButton is also used by review verification; its original selected date, locked month and disabled controls were checked against the new build. No record/API behavior changed. No clipping or data filtering was added.

## 5. Knowledge Capture

Updated frontend architecture, component-islands and UI-quality specs. This application has no generated source-spec template directory to synchronize. Main commit includes the contracts with source and tests.
