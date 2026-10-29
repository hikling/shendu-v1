# Independent source review

Reviewed the complete current diff against PRD/design/implement and frontend architecture, state/data and UI-quality specs. Scope is the native browser UI plus its docs/specs; no server, persistence, schema or API code changed. No actionable source issues found and no corrective source edits were needed.

## Calendar

- The card is scoped to `.daily-date-picker`, capped at 352px with 14px padding (12px at narrow widths), 32px circular day controls and six stable week rows. New head/footer styling does not affect the shared stage calendar or other five forms.
- Moving Today into `.daily-calendar-foot` keeps it inside `#daily-verification-calendar`, so the existing delegated click listener still handles it after every month redraw. Full Chinese selection/live text, named native buttons, the table, one roving day, hidden verifyDate field and locked flags remain intact.
- `renderDailyCalendar` and `bindDailyCalendar` are unchanged: browsing/focus cannot select or dirty; explicit selection follows the original input event, saving/error/readonly/keyboard and focus paths. Newly redrawn controls retain existing busy/error treatment. Past-date/locked rules remain in the unchanged date model.

## Illustration burst and scope

- The 8 image assets, scene derivation, alternating placement and sizes remain unchanged. A single aria-hidden decorative span contains 16 particles; images/container/particles remain pointer-inert and acquire no click handler or keyboard stop.
- Canvas pointer tracking accepts only a released-button mouse with fine hover capability. It checks the artwork bounds and excludes all real form/content/navigation regions. The handler changes only a local CSS class and local entry flags; it cannot write records, mark dirty, save or move focus.
- Particles run once for .9s, the ring for .75s, then finish transparent. Repeated motion inside does not restart; leaving/reentering can replay. Prompt changes reset, route/shell/auth replacement disposes listeners, and media changes/window blur reset. Both reduced-motion preferences and coarse/touch input suppress activation; matching CSS also hides the decoration.
- Default `overviewBurst()` markup is byte-identical to HEAD. `renderOverview`, overview CSS/reel selection and other five form owners are unchanged. Entry app/CSS cache URLs use overview25 and changed-module imports match. Documentation describes the resulting boundary/interaction consistently.

## Verification

- `npm run check`: PASS (repository has a browser-script syntax gate, no separate lint/typecheck script).
- `node --test tests/daily-flow.test.mjs tests/daily-calendar.test.mjs`: PASS, 21/21.
- `node tmp/calendar-check-smoke.mjs`: PASS, 18 unchanged critical source functions and 5 actual calendar template cases.
- `node tmp/burst-source-smoke.mjs`: PASS, default overview markup equivalence, 16 particles, one-entry/reentry behavior, control/touch/drag/motion guards and complete listener cleanup.
- `git diff --check`: PASS.

The temporary source smokes exercise actual extracted source with controlled DOM/media stubs. They do not establish rendered geometry or browser pointer behavior. Root owns the separate real-browser desktop/mobile, calendar/save/readonly and reduced-motion visual acceptance and screenshot refresh.
