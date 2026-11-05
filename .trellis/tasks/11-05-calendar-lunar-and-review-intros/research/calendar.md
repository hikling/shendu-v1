# Stage calendar implementation

## Changes

- Pinned the verified MIT `lunar-javascript` package to `1.7.7`; lockfile updated. The existing UI build license collector includes its bundled license without a supplemental notice.
- `shendu/ui/lunar-calendar.js` calculates annotations locally from explicit YYYY-MM-DD/local Date fields. The visual label prioritizes the exact solar term, then the lunar month on its first day, then the lunar day. Full lunar year/month/day remain in the accessible name. Leap months retain their marker.
- `shendu/ui/surfaces.jsx` attaches the current month's annotation map to the existing stage Calendar. Record IDs, first-match identity, record-state marks, disabled rules, navigation and selection callbacks remain unchanged. The separate review verification calendar is untouched.
- `shendu/ui/stage.css` explicitly restores seven-column table geometry and six fixed week rows. Dates use two-line rounded slips, independent status marks, warm solar-term ink and distinct today/status treatments. Hidden outside-month cells still reserve their columns. Phone widths shrink with their available fraction.
- `shendu/tests/lunar-calendar.test.mjs` covers Spring Festival, lunar-year boundary, leap month, term priority, exact terms across year boundaries, Gregorian leap day, invalid dates and three host timezones.
- `shendu/tests/ui-surfaces.test.mjs` additionally checks seven cells per week, one lunar label per real month day, November 2026 terms/full accessible names and empty outside-month cells.

## Validation

- `npm install --save-exact lunar-javascript@1.7.7` succeeded; npm audit reported zero vulnerabilities.
- `node --test tests/lunar-calendar.test.mjs`: 5/5 passed.
- `git diff --check`: passed, with routine line-ending warnings only.
- Production build and full suite are coordinated by the parent after all three implementation branches are ready; the new DOM assertions require that fresh bundle.

## Browser follow-up

Inspect the real stage route at desktop and 820/390/320px: complete seven-column alignment, no stray right-edge date, readable lunar labels/terms, visible status/today markers and month navigation focus/click ownership. Verify 2026-11-07 (立冬), 2026-11-22 (小雪), February 2026 (春节) and year-boundary navigation. No API/schema/persistence changes were made.
