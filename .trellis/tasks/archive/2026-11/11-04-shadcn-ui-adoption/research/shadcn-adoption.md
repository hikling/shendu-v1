# Research: shadcn adoption in the existing native-JavaScript application

- Query: Safely use real shadcn components throughout the existing application without resetting its approved art direction or review/data behavior.
- Scope: mixed; current repository inspection plus official React, shadcn, Radix and Tailwind documentation.
- Date: 2026-11-04

## Recommendation

Use **explicit, disjoint React component islands** as a transitional component layer. Keep the existing business state, validators, request helpers, record schema and route-return controller. Introduce real checked-in shadcn component source, React and a production build. This is lower risk than rewriting the full 158k-character `app.js` at once, while providing real components rather than cosmetic class copying.

Do **not** run one broad HTML-to-React parser over `#app` and then continue the existing imperative mutations on that React tree. Nested roots alone do not cure ownership overlap: all regions mutated by the old code must actually be opaque to their containing React component. The conventional wrapper-island approach proposed by the parent is viable under the ownership rules below.

Use explicit JSX islands for behavior-rich UI (Dialog, stage panel/Tabs, dropdown/mobile navigation, Calendar). A generic tag mapper is only appropriate for stateless native-compatible primitives. Preserve custom overview/reel geometry and native answer details as documented nonfit exceptions unless their complete interaction owner is deliberately migrated.

## Files found

| File | Responsibility |
| --- | --- |
| `shendu/public/app.js` | HTML-string rendering, native bindings, DOM mutation, all page/form/modal state |
| `shendu/public/review-navigation.js` | Guarded review-entry origin and exit restoration; keep its contract |
| `shendu/public/daily-flow.js` | Daily question order and validation |
| `shendu/public/extended-flow.js` | Five extended flows and validation |
| `shendu/public/daily-calendar.js` | Pure date model, date labels and existing keyboard-date calculation |
| `shendu/public/verification-policy.js` | Type-specific minimum dates, also imported by server |
| `shendu/public/styles.css` | Existing brand/type/category variables, geometry and direct-child selectors |
| `shendu/public/index.html` | Three independent page/modal/toast roots and versioned assets |
| `shendu/server.mjs` | Native API/runtime, static serving and CSP |
| `shendu/Dockerfile` | Currently copies native files only; no dependency install or frontend build |
| `.github/workflows/verify.yml` | Existing syntax/tests, Docker build and health check; no frontend install/build |
| `shendu/tests/review-navigation.test.mjs` | Includes extraction/execution of actual `renderAuth()` source |

## Current ownership and mutation evidence

Line references below were inspected before implementation; they will move after edits.

| Evidence | Consequence for migration |
| --- | --- |
| `app.js:201` `shell()` replaces `#app` then synchronously calls `bindCommon()` | All enhancement/mounting must finish before legacy handlers query real nodes. Dispose all descendant islands before replacement. |
| `app.js:147` onward `renderAuth()` replaces `#app`; `:961–962` boot/loading/error paths also replace it | A shell-only hook misses login, loading, disconnected and retry screens. Centralize every root-replacement path. |
| `app.js:252–255` removes, clones and appends moving reel cards | Keep the reel track as a genuinely native/opaque custom region. Cloned React-managed buttons lose React ownership/events. Do not claim clones are independent mounted components. |
| `app.js:350`, `:474`, `:651` native answer `details`, `.open` mutations and `toggle` events | Blind Accordion/Collapsible substitution loses mounted hidden inputs or breaks `.open` and validation focus. Keep native details or migrate the complete answer-group owner with force-mounted content and explicit open state. |
| `app.js:392–400` replaces `#daily-verification-calendar` on browse/selection | Mount/replace the Calendar island explicitly; old subtree must be disposed first. |
| `app.js:402–415` delegates day click and Arrow/Home/Page keys | Converted DayPicker must become the sole keyboard/selection owner; retaining both causes double movement or duplicate selection/dirty events. |
| `app.js:502–508`, `:565–570` replace prompt-heading children with text and emphasis span | These are native custom typography slots, or must be converted to explicit component props. A React-owned heading child list cannot still be mutated. |
| `app.js:514–534`, `:575` etc. mutate hidden state, data phase, current group, title, description, footer copy | Keep the native art-canvas owner intact initially; islands inside it must not re-render those externally owned ancestors. |
| `app.js:523`, `:585` mutate `daily-start.firstChild.textContent` | A wrapper, icon or React-generated structure can change the first child. Replace with an explicit label element/selector; preserve arrow artwork. |
| `app.js:649–660` binds input/toggle events, reads every mounted field and resizes textareas | Inputs must remain native DOM-compatible, uncontrolled and mounted before binding; IDs, names, data keys, disabled/readOnly, values and event behavior are contracts. |
| `app.js:662` onward changes disabled/aria-busy and temporarily replaces save-button HTML | Basic Button children can be opaque raw content; do not render React children and then let this replace them. Busy state must not remount the input tree. |
| `app.js:755–757` replaces `#backup-content`; `:836` replaces `#users-content` | Explicit redraw boundaries, including async success/error paths. |
| `app.js:833` `openTargetModal()` redraws `#target-fields` on WebDAV/S3 switch | Another dynamic slot inside a modal; not covered by just the four route-level slots in the original proposal. |
| `app.js:860–865` inserts a settings-back button before the modal header | Must stay within an opaque modal-body region or become a JSX prop/action; do not insert into React-owned children. |
| `app.js:890` theme `sync()` uses colorInput.nextElementSibling | An island host between the color and text input breaks this. Query by `name`/`data-color` identity instead. |
| `app.js:894–895` replaces/clears `#modal-root`, manages persistent modal and parent rail inertness | Dialog must own lifecycle and be unmounted before clearing DOM. Preserve persistent reauth and lock-busy close guards. |
| `app.js:900–901` redraws `#rail-calendar` | Separate stage-calendar behavior, distinct from verification calendar. |
| `app.js:906–916`, `:945–951`, `:964` manually own header menu visibility, keys, focus-out and outside click | A migrated Dropdown/Sheet must replace these bindings for its region, not sit beside them. |
| `app.js:918–934` manually owns rail dialog aria, body scroll lock, inert and return focus | One Dialog owner is required; remove/adapt corresponding legacy responsibilities when migrating it. |
| `app.js:937–939` manual phase-panel switch sets data-view/aria-pressed | Tabs migration needs one selected value owner and associated panels, not just styling those buttons. |
| `app.js:967` global modal/rail Tab traps, Escape dismissal and Ctrl+S | Remove/skip only migrated focus/dismissal paths; retain Ctrl+S and beforeunload. Two traps are not more accessible. |
| `app.js:129` creates/removes toast nodes with a timer | Replace through a singleton real shadcn/Sonner island; do not keep duplicate live regions/timers. |

## Viable primitive-island contract

1. A helper replaces a native primitive with an inert structural mount host (for example `span[data-ui-mount]` with `display:contents`) and renders a real shadcn component into that host.
2. `id`, `name`, `data-*`, ARIA, disabled/readOnly/required, native type and form association stay on the actual resulting control, **not** only on its host. The host has no focus role, tabindex or misleading control semantics.
3. Stateless Button/Label/Card descendants needed by legacy code can be passed as explicitly opaque raw HTML, rather than React child nodes. Then child controls in that opaque region may become their own independent islands. Only existing trusted template HTML is eligible; do not parse unescaped record content.
4. Enhance top-down using **fresh DOM queries after each parent mount**. A snapshot of descendant nodes taken before replacing a Label/Card is stale. An ownership marker/WeakSet must distinguish generated component nodes from still-unenhanced raw descendants; skipping every descendant of a mount host would incorrectly skip nested controls.
5. Keep a root registry and dispose descendant roots deepest-first **before** any legacy `innerHTML`, `replaceChildren`, removal or containing-root replacement. Radix portals may live outside the host, so lifecycle ownership must be logical as well as `container.contains(host)`.
6. Do not move component-rendered nodes out of their React root, adopt existing nodes as faux React children, or make the same child list both parsed React children and manually writable HTML.
7. Do not re-render an uncontrolled field island merely to toggle an unrelated page state. Initial values use `defaultValue`/`defaultChecked`; native DOM reads and original input/change events remain authoritative until the whole existing view redraws. File inputs never receive a programmatic nonempty value.
8. Enhancement must be synchronous at the existing render/bind boundary (React documents `flushSync` for the exceptional integration case). Do not call `flushSync` recursively inside React lifecycle/effects. Separate external enhancement work from component lifecycle callbacks.
9. No broad MutationObserver that repeatedly remounts arbitrary changed controls. It can race typing, reset selection and duplicate event listeners. Prefer explicit redraw helpers at known sites.
10. Existing layout selectors and `firstChild`/`nextElementSibling` assumptions must be adapted intentionally. `display:contents` fixes layout boxes; it does not make direct-child CSS or DOM sibling relationships unchanged.

## Component choices

| Existing surface | Real component fit | Required treatment |
| --- | --- | --- |
| Ordinary action/nav/form buttons | `Button` variants | Preserve semantic element, form submit behavior and explicit existing type. Custom category/reel art hit geometry is an exception. |
| Text/password/url/number fields | `Input` | Uncontrolled native node, same DOM/data/name identity. Retain custom gauge number layout/ruler. |
| Long review/verification/template text | `Textarea` | Keep auto-sizing, values in hidden questions and exact field identity. |
| Labels | `Label` | Preserve htmlFor or wrapping association. File-upload labels must remain labels; do not turn them into submit buttons. |
| Existing native selects | `NativeSelect` | Lower-risk than a custom Select because `FormData`, `.value`, change and option semantics remain. Account for its wrapper/icon and remove duplicate existing chevron. |
| Existing checkboxes/toggles | Explicit `Checkbox`/`Switch` adapters, or native-compatible declared exception | Radix Checkbox is not a native input with `.checked`. Must adapt value/change/FormData semantics and avoid duplicate hidden names. Quarter-toggle `input:checked + .quarter-switch` CSS needs real migration. Blind replacement is unsafe. |
| General paper surfaces/status/table | `Card`, `Badge`, `Table`, `Separator`, `Skeleton` | Preserve semantic section/button differences; source customization/asChild is appropriate where supported. Table introduces a wrapper; review mobile table rules. |
| Stage progress | `Progress` | Preserve value semantics, labels and existing custom tint; old child selector targets `i`, while new indicator is different markup. |
| Confirm/settings/auth-expiry/verify dialogs | Explicit `Dialog` / appropriate `AlertDialog` island | Must become sole focus/dismissal owner and preserve busy/persistent guards, body locking and nested parent restore. |
| Phase/calendar/pending section switch | Explicit `Tabs` island | Root/List/Trigger/Content share one React context; panels need linked IDs and correct hidden/forceMount behavior. Separate roots cannot carry Radix context implicitly. |
| Account/header/mobile navigation | Explicit `DropdownMenu` and/or `Sheet` | Use descriptors/callbacks for actions, native keyboard behavior, no old menu binding on the same elements. |
| Both month calendars | Explicit `Calendar` island using DayPicker | Preserve separate business contracts and Chinese locale, selected value, disabled states and no-dirty month browse. |
| Toast | Singleton shadcn/Sonner adapter | One notification/live-region owner; no duplicate legacy append/remove notifications. |
| Answer groups and overview arc/typewriter/art | Keep custom authored regions initially | They have specialized semantics and geometry with explicit prior user approval. Do not replace them merely to increase a component count. Their ordinary contained fields/buttons can still use real primitives where safe. |

## Dialog and calendar details that must be explicit

### Dialog

- Radix Dialog already manages focus confinement, Escape and outside interaction; the old global modal Tab branch must not compete with it.
- `open`, `onOpenChange`, `onEscapeKeyDown`, `onInteractOutside`, `onOpenAutoFocus`, `onCloseAutoFocus` provide the necessary control points. Check persistent and `.modal[data-review-lock-busy]` before allowing close.
- `Dialog.Portal` supports an explicit `container`; keep the intended modal root and z-level behavior. Parent rail and child verify/stage modal must be exercised together.
- During top-down enhancement, default auto-focus can select an old native field that is immediately replaced. Prevent auto-focus until enhancement is complete, then focus the intended real control. On replacement (settings page -> another settings page), suppress transient return-focus; on actual close, restore connected invoking control.
- A real `DialogTitle`/`DialogDescription` must share the Dialog context. Do not fake a title using only a matching data attribute; preserve visible heading/title association without duplicate announcements.

### Calendar

- The official `Calendar` is built over React DayPicker and supports controlled selected/month values, locale, class names, formatters and component customization.
- Verification: `onMonthChange` is view-only; explicit selection updates the original YYYY-MM-DD field and dirty path once. Supply the existing `verificationMinimum()` boundary and preserve historical read-only values and date/month selection.
- Use Monday-first Chinese locale, stable six-week height, full Chinese weekday labels, disabled/past states and distinguish selected/today. Do not use `toISOString().slice(0,10)` blindly on a locally selected midnight; convert the selected calendar day by local date fields or a deliberate date-only helper so timezone does not shift it.
- Stage calendar: only today or dates containing original daily records are actionable; modifiers must retain draft/completed/verified status and original ID. Month browsing never creates records.
- Remove old delegated day keyboard logic for a converted DayPicker; it is another keyboard owner. Keep pure existing policy/model tests as business regression tests even if grid rendering is replaced.

## Build/deploy recommendations

- `package.json` currently has no dependencies/build (`shendu/package.json:1–18`). The Dockerfile currently does not install npm dependencies; adding browser imports without build changes will deploy a broken site.
- A low-disruption build option is Vite library mode from a `client/` source directory into a dedicated `public/ui/` directory. Set `publicDir:false` in that library build to avoid copying public assets into itself, and restrict `emptyOutDir` to that dedicated generated directory. Existing native static serving and pure modules may remain in their locations. The output must include bundled React/component JS and CSS, with a version/hash contract.
- Alternative: a normal Vite `dist` app is valid for a full React rewrite, but requires changing static-server input and source/test paths. Do not change those implicitly.
- Keep `public/verification-policy.js`: `server.mjs:11` imports it directly, and all existing domain tests import their corresponding public modules. Moving or deleting those files solely for a bundler breaks backend/tests.
- Use a lockfile and reproducible `npm ci`; add frontend build to CI and a Docker builder stage. Runtime should continue to serve local compiled files without a frontend toolchain, external CDN or image API.
- Current CSP (`server.mjs:1427`) permits self scripts/connect plus inline CSS but no CDN scripts or fonts. Production shadcn must be bundled locally; keep existing local fonts. Do not weaken CSP just to load a CDN component bundle.
- Tailwind Preflight resets headings, images, borders and form styles. Import only required theme/utilities (officially supported) or deliberately scope a reset; do not let its default reset silently reshape the approved canvases.
- Preserve the existing runtime `--primary`, `--secondary`, `--tertiary` and computed contrast values. Map shadcn semantic variables to the maintained brand tokens instead of replacing them with a default black/white theme. A generated component class and legacy style with the same property must have a deliberate precedence.

## Test impact and quality gates

The existing 91-test suite covers domain/server behavior, but does not establish React/DOM interoperability safety. Additional actual DOM/component tests and browser checks are needed.

1. Mount real primitive components and verify exact native node identity, values/defaults, disabled/readOnly, label association, `.value`, FormData and one original input/change event. Include number0/7.5/empty invalid editing, textarea, select, checkbox, file and color.
2. Mount parent Card/Label with opaque nested controls, replace a nested dynamic slot, and repeatedly replace the page. Assert no orphan roots/portals, duplicate event handlers, console warnings or lost focus/caret. Confirm synchronous binding sees final nodes.
3. Busy button HTML/text updates, prompt emphasis, typewriter, answer add/remove/toggle and overview resize clones must operate only within declared native/opaque boundaries.
4. Dialog open/close, child modal from stage, persistent reauth, delayed save/failed lock retry, Escape/outside and return focus must have one owner and no trapped/inert page after close.
5. Calendar browse/select/save/reload and locked history at date boundaries; no duplicate movement/dirty events. Six review verification minimum rules remain unchanged.
6. Actual auth, shell, history filters, history/actions return paths, all six review forms, theme/settings, backup forms and account administration need browser smoke coverage, at desktop/820/390/320px, reduced motion and custom white colors.
7. `tests/review-navigation.test.mjs:76–84` extracts `renderAuth()` and runs it with DOM stubs. If it gains an external render-helper dependency, add an honest helper stub or refactor the tested owner; do not simply skip the account-origin cleanup regression.
8. Run syntax/component checks, the full existing suite plus new DOM tests, production frontend build, and Docker health smoke. Check generated asset requests/content types and returning-browser cache versions.

## External references (verified this session)

- shadcn repository and component-copy model: https://github.com/shadcn-ui/ui
- Existing-project React/Vite/Tailwind setup: https://ui.shadcn.com/docs/installation/vite
- Manual component setup: https://ui.shadcn.com/docs/installation/manual
- Radix-flavor Button: https://ui.shadcn.com/docs/components/radix/button
- Native Select: https://ui.shadcn.com/docs/components/native-select (currently redirects to the Base UI flavor; select a consistent flavor explicitly rather than mixing generated registries accidentally)
- Calendar and DayPicker extension point: https://ui.shadcn.com/docs/components/calendar
- React DOM ownership and intentionally unmanaged empty nodes: https://react.dev/learn/manipulating-the-dom-with-refs
- Multiple roots, cleanup and synchronous integration: https://react.dev/reference/react-dom/client/createRoot
- Radix Dialog API, portal container and focus/dismissal hooks: https://www.radix-ui.com/primitives/docs/components/dialog
- Tailwind selective imports without Preflight: https://tailwindcss.com/docs/preflight
- Parser security FAQ: https://github.com/remarkablemark/html-react-parser#is-this-xss-safe

The fetched React docs identify v19.3; Radix Dialog docs identify1.2.0; Tailwind docs identify4.3. These are documentation observations, not resolved package versions. Implementation must inspect installed/registry versions and record exact lockfile versions. The parser explicitly does not sanitize input and does not convert inline event-handler strings into functions; it is not an ownership or security solution.

## Related specs

- `.trellis/spec/frontend/architecture.md`: render/bind, daily ownership, source-return, static cache contracts.
- `.trellis/spec/frontend/state-and-data.md`: mounted field collection, dirty/locked/reauth and date-policy invariants.
- `.trellis/spec/frontend/ui-quality.md`: approved custom geometry, theme contrast, calendars, focus, reduced motion and mobile evidence.
- `DESIGN.md` and `UX-CONTRACT.md`: brand and cross-screen contracts.

## Caveats / Not Found

- No React framework, bundler or browser component test framework currently exists in the inspected app package.
- No browser/component code was implemented by this research. No git operation or write outside this task research directory was performed.
- There is no universal safe automatic substitution for interactive primitives. The raw-island approach is viable only with the explicit lifecycle/semantics adaptations above; its compatibility must be proven in real DOM tests and the browser before broad claims of adoption.
