# Independent review

No blocking or mechanical findings. No source edits made by the reviewer.

## Scope and contracts

Reviewed all production changes, the new test helper, UI/lunar regressions,
`docs/chrome-autumn-qa/check.cjs`, and the added civil-date section in
`component-islands.md` against the task artifacts. The fix remains confined to
stage-calendar date arithmetic, lunar field validation/month length, and matching
runtime cache stamps. No CSS, other route behavior, record payload, verification
date construction, global Date patch, or extra keyboard/focus owner was added.

DayPicker/date-fns cloning retains the private subclass. Its local methods map
to UTC-backed civil fields; DateLib `newDate`/`today` overrides and all stage entry
paths preserve that representation. The supplied date is never converted from a
saved instant. Stage labels/data-day use the same explicit civil date. Lunar Date
input interpretation and all original record/disabled/selection rules remain.

## Independently executed verification

- `npm run check`: passed. This JavaScript project has no separate ESLint or
  TypeScript gate; `node --check ui/stage-date.js` also passed.
- Lunar tests: 6/6 passed, including hostile local-API overrides and unchanged
  lunar/solar-term labels.
- 5,508 DayPicker model states passed: every month of 2000–2050, three system
  zones (Shanghai, New York, London), and three spoof modes (offset-only, local
  getters, partial setters). In each combination the spoof was installed before
  dynamically importing the production stage-date module. Models used DateLib,
  normalized initial months, `getDates` and `getMonths` directly. Assertions
  required six weeks/42 cells, exact sequential in-month dates, and preservation
  of the civil subclass/zero offset. Years1/99 construction also passed.

## Rendered evidence reviewed

The browser QA installs spoofing before app imports and independently checks
Gregorian sequence, weekday headings, actual cell/week geometry, disposal of old
date controls, navigation node/focus identity, original recorded-day selection
and exit-to-calendar focus, forward/backward year transitions and narrow widths.
`final-checks.json` records 792 passing states across Chrome normal/three spoof
modes and Edge normal/partial-setters, with no reported console/page errors.
The previous placement regression artifact records 48 passing checks. Root also
reports full tests153/153 and UI smoke passing; the reviewer did not duplicate
those full runs or rebuild while browser acceptance was active.

## Evidence limits and remaining closure

The controlled environment reproduces the failure class, including duplicate
autumn dates, but the exact My Fingerprint source/settings were not inspected or
verified. Do not claim the simulation proves that plugin's precise implementation.
No outstanding code/spec finding remains. Main push, exact-SHA CI, task archival
and fixture shutdown are root's remaining completion steps, not code defects.
