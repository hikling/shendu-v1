# Verification calendar: duplicate autumn dates

## Evidence and cause

- `ui/surfaces.jsx:66–75` owns the one verification Calendar shared by all six review types. `calendarDate()` creates native local Dates; its month, selected value, today, minimum month, maximum month and return-to-minimum action all retain that path. It never supplies the civil `dateLib` already used by StageCalendar.
- StageCalendar uses `ui/stage-date.js` for explicit civil fields and a memoized DateLib override (`newDate` plus `today`). Its Date subclass survives date-fns cloning and isolates local getters/setters from inconsistent extension modifications.
- DayPicker `getDates()` generates its dates using `differenceInCalendarDays` / `addDays`; date-fns `addDays()` calls `setDate(getDate()+amount)`. When a fingerprint extension changes local getters/offsets and only some setters, these operations no longer describe the same civil date. DayPicker then groups the inconsistent dates by week in `getMonths()`, so a week can contain eight dates. A fixed-width seven-column table cannot correct that input.
- Read-only JSDOM experiment against the current production build: normal November2026 has six rows of seven cells and30 buttons; the existing `partial-setters` hostile helper produces a first row with eight cells and incorrect date labels. `local-getters` also corrupts weekday headers. This verifies the failure class at date-generation level; it is not a claim to have inspected or exactly reproduced My Fingerprint's private implementation.
- `ui/surfaces.css:23–38` intentionally keeps verification as a normal fixed-layout DayPicker table, with separate `.rdp-day` cells and `.rdp-day_button` buttons. No structural CSS defect was found that can produce an extra date independently. The button/cell class split is already correct.

## Smallest safe change

Reuse the existing Date subclass and DateLib factory in the verification picker. If renaming the stage-specific file/exports to shared civil/calendar names, keep one implementation and update both explicit callers; there are no other source consumers of `stageDate` / `stageDateLibrary`. Preserve the exported `calendarDate(value)` signature in `surfaces.jsx`.

Use civil instances for every Date entering verification DayPicker: initial month, saved selection, explicit today, start/end month and return-to-minimum action. Memoize its DateLib override by business today. Continue deriving saved/onSelect values through the explicit YYYY-MM-DD getters, and retain the canonical minimum comparison, `locked`, `canSelect`, required selection and month-only callback behavior.

VerificationDay should override `data-day` with the same canonical string as `data-verify-day`; inherited `toLocaleDateString()` can still consult spoofed Intl/default timezone despite civil getters. Keep the actual CalendarDayButton, ordinary semantic DayPicker table, stable component references and DayPicker keyboard/focus owner. Do not copy stage-only grid slots, crop the extra cell, alter global Date, save instants instead of dates, or change category waiting periods.

## Required checks

1. Production-build DOM regression with hostile local Date APIs: normal plus `offset-only`, `local-getters` and `partial-setters`, multiple autumn years and year/leap boundaries. Check exact ordered unique civil dates, six seven-cell weeks, empty outside cells and normal weekday labels.
2. Selection remains exactly the original YYYY-MM-DD; dates before category minimum remain disabled; return-to-minimum lands on and selects the exact minimum. Locked historical selection before the current minimum remains visible/read-only, with navigation disabled. Busy `canSelect` remains a no-op.
3. Repeated month/year navigation retains the same Calendar root and previous/next buttons, actual focused navigation control and no selection callback. Old date nodes disconnect.
4. Real Chrome rendering with spoof installed before importing the production bundle: every button center aligns with its independently computed weekday/header and expected week row; no valid button extends past the calendar on desktop and320/390px. Test six category palettes and minima, ordinary timezone/DST and reduced motion.
5. Keep existing stage tests and verify both calendars together after sharing the date adapter. The legacy hidden input and category verification-policy tests remain unchanged and must pass.
