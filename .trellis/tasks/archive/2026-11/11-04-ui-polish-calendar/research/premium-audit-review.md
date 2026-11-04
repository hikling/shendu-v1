# Supplemental premium static audit

Date: 2026-11-05. This supplement inspects the existing native application plus React component islands. It does not repeat the completed implementation review or replace the main session's rendered browser acceptance.

## Exact result

Ran the installed `frontend-design-premium` 1.4.0 auditor in `strict` mode against the whole repository, without a custom manifest, exclusions or source changes:

```text
python <frontend-design-premium>/scripts/audit_project.py <repository> --mode strict --output .trellis/tasks/11-04-ui-polish-calendar/research/premium-audit.json
```

Exit **2**. The unmodified JSON contains **15 findings**: 2 unresolved ownership declarations and 13 reported violations. The strict audit is **not green**; this task does not claim full premium compliance. No configuration was added solely to suppress findings.

## Classification against actual owners

| Rule | Count | Evidence and classification |
| --- | ---: | --- |
| `ownership.native-select-undecided` | 2 | `public/app.js:367` and `ui/components/ui/native-select.jsx:15`. The script reads the native/authored decision from a machine manifest. This repository has no `premium-ui.json`; maintained `UX-CONTRACT.md`, `docs/shadcn-adoption.md` and `component-islands.md` already choose genuine shadcn NativeSelect with native options/events. The metric/history compositions author one visible chevron while the popup remains native. This is a machine-readable declaration gap, not a newly unresolved product decision or a request to replace the canonical select. |
| `affordance.actionless-button` | 9 | The checker recognizes only inline click attributes/form submission. It does not resolve the project's post-render listeners, data attributes, JSX prop spreading or Radix `asChild` behavior. Each reported target has an actual owner, detailed below. These are static-analysis false positives. |
| `form.textarea-resize-missing` | 3 | The checker inspects literal textarea tags, not stylesheet cascade/shared wrappers. The affected metric textarea has `.metric-copy textarea { resize:none }` in `public/styles.css`, plus `.daily-editor .daily-prompt textarea { resize:none; overflow-y:hidden }` and `sizeDailyTextareas()` for the immersive review. The shared Textarea/default legacy `.field textarea` still permits browser/vertical resizing on other screens. That broader rule predates this task; it was not converted to a new global resize policy as part of a scoped title/calendar fix. |
| `scrollbar.webkit-only` | 1 | `public/styles.css:12` has the existing global WebKit track/thumb baseline, without both standards properties. A direct comparison with pre-task HEAD confirms the same rule and missing standards properties already existed. The new stage folio retains visible internal scrolling where needed; global cross-engine scrollbar standardization is outside this task's requested change. |

### Actual action owners for all nine button findings

- `public/app.js:160`: `#auth-switch` is bound immediately after render at line164.
- `public/app.js:188` and `:198`: menu descriptors and `bindHeaderMenus()` pass real route/modal actions to DropdownMenu; regular `[data-nav]` controls use `bindCommon()` and the existing navigation guard.
- `public/app.js:326`: pending record buttons use `[data-open-action]`; `bindActionButtons(current)` is called when the folio is mounted. The trailing actions entry uses the folio's `[data-nav]` handler.
- `public/app.js:335`: `[data-remove-item]` is bound in `bindReview()`, collects before removal, marks dirty and rerenders the preserved question. The native listener is not an inline HTML action.
- `ui/components/ui/calendar.jsx:187`: CalendarDayButton forwards DayPicker's handlers and accessibility props through `{...props}` to real Button. The final DOM regression covers explicit selection, nonselecting month browse and stable navigation focus.
- `ui/components/ui/dialog.jsx:114`: the optional footer Button is inside `DialogPrimitive.Close asChild`; Radix supplies the action. This English default is not rendered by the customized Chinese application dialogs.
- `ui/runtime.jsx:138`: Button forwards the original stable attributes, then the application binds native listeners after synchronous enhancement. Runtime tests cover one native click/submit path and retained form values.
- `ui/surfaces.jsx:77`: Button is the `DropdownMenuTrigger asChild`; Radix supplies opening/keyboard behavior. Surface tests exercise keyboard opening and item selection.

The script's form-tag parser also stops at template/JSX expressions, so its limited literal-tag findings are not a complete inventory of all controls. No full application compliance is inferred from the count.

## Scope and contract reconciliation

- Maintained visual intent stays in `DESIGN.md`; domain/navigation behavior stays in `UX-CONTRACT.md` and the frontend specs. Runtime ownership remains `public/app.js` for state/data/routes, `ui/runtime.jsx` for native-compatible primitive islands, `ui/surfaces.jsx` for Dialog/Tabs/Menu/DayPicker, and `ui/stage.css` for the isolated 736×650 folio.
- Both stage and verification calendars use the same stable Calendar component overrides and the complete Chinese date labels. They keep distinct business variants and no parallel focus manager. The new regression first reproduced the remount bug and now asserts stable root/buttons/focus through repeated month/year browsing.
- The new native-select arrow rules, transparent ghost/menu states, comma-delimited safe text headings, no-side-card folio and persistent Tabs are documented with their actual runtime owners. Existing security, API, date minimum and record lifecycle decisions are not changed by a generic static-audit default.
- Per the main session's explicit scope decision, no manifest/map-only rewrite, global textarea change or global scrollbar migration was introduced to make this audit appear green. These existing policy differences are reported above rather than silently waived.

## Candidate-file audit

Read-only snapshot before this report was added: 31 candidates (16 modified, 15 untracked), all in this task's implementation, specs, research or QA evidence. No candidate path is a tmp directory, data/database, key, `.env`, backup, `node_modules` or generated `public/ui` output. Common private-key/OpenAI/GitHub token patterns had no matches; this is a bounded pattern check, not a guarantee about all possible secrets. The only binary candidates are five rendered synthetic-fixture QA screenshots in `docs/ui-polish-qa/`.

## Verification

- Reviewer executed `npm run check`: passed. This JavaScript project has no independent ESLint or TypeScript gate.
- Read the final persisted `shendu/tmp/ui-polish-test.log`: production build completed and **112/112 tests passed**, including shared heading safety, real native form contracts, calendar identity/focus, folio Tabs, nested dialogs and original domain/security rules. The main session owns that execution and the final CI result.
- No application, test or runtime stylesheet was changed by this supplemental reviewer. Only this report and the raw audit JSON were added.
- Final rendered desktop/mobile/theme checks, main synchronization and final-head CI remain the main session's completion responsibility.
