# React component islands

## Scope / trigger

Applies whenever `shendu/public/app.js`, `shendu/ui/`, or frontend build/deployment changes. Legacy route/data code owns records and DOM-compatible form collection; genuine shadcn React components own isolated control roots and explicit interactive surfaces.

## Signatures

- `renderMarkup(container, html)` disposes descendant roots, replaces trusted escaped template HTML, then synchronously enhances controls.
- `enhanceUi(container)` enhances freshly inserted native controls; it must complete before legacy event binding.
- `disposeUi(container)` unmounts registered roots deepest first, including portals with logical ownership.
- `mountComponent(container, element, {owner=container})` creates or updates an explicit component island through the same registry.
- Surface helpers: `prepareDialogContainer`, `showDialog`, `dismissDialog`, `showRail`, `showMenu`, `showVerificationCalendar`, `showStageCalendar`, `initializeToasts`, `showToast` from the built `ui/shadcn.js`.
- `npm ci`; `npm run build`; `npm run check`; `npm test`; `npm run smoke:ui -- <base-url>`.

## Contracts

Primitive hosts use `display:contents`, but remain real DOM ancestors. IDs, names, data attributes, values and disabled/readOnly stay on actual controls. Inputs/Textarea/NativeSelect are uncontrolled; hidden questions remain mounted. Checkbox has one native form field plus a visible real Radix Checkbox with a single event path. No schema/API changes.

NativeSelect has one arrow owner: the primitive's SVG is hidden by the adapter; ordinary selects use native appearance, while `.metric-status-control`, `.history-filter-select` and `.history-type-filter` already contain an authored chevron and must use `appearance:none` (including the WebKit property). Check both editable and disabled controls in a browser. Ghost/text actions have no component-default hover fill or default hover ink; pages own their text/underline feedback and visible keyboard focus. Explicit Menu triggers do not necessarily carry `.sd-ui`, so header protection targets their real `[data-slot]`. Portal menu highlights also stay transparent; do not remove real selected-date/status or normal primary-button fills.

DayPicker component overrides must have stable component identities. The local Calendar Root/Chevron/WeekNumber are declared at module scope; an inline Root function inside Calendar remounts the whole date surface whenever its controlled month changes, discarding the activated month button and focus. Do not compensate with a second focus manager. Actual DOM regression must retain the same root/previous/next nodes and the activated button focus through repeated month/year browsing for both stage and verification calendars, without selecting a date.

Child combinators still see the host even when its layout box disappears. Preserve host-aware equivalents for paired-field labels, afterword Cards, timing/status Badges and responsive table/list alignment. Header route Buttons and account/mobile DropdownMenu Buttons retain the approved text-only treatment in idle, hover, focus and active states: transparent background, no border/radius/shadow; use route text color plus a separate readable focus outline. Keep category-specific focus colors and white-theme contrast; do not restore shadcn's default filled header treatment.

Card/Label/Button template descendants are opaque to React. Keep custom title/typewriter/reel nodes native, and use DOM text nodes or escaped HTML. Never parse unescaped record content into JSX/HTML. No prototype monkeypatches, blind HTML-to-React tree conversion, MutationObserver remounts, moving React nodes out of their root, or a second root registry.

Dispose before every live subtree replacement/removal, including asynchronous backup/admin content and dialog bodies. Detached `template.innerHTML` for parsing remains valid. Raw heading `replaceChildren` and busy-button label updates are safe only in documented native/opaque regions.

Dialog/Menu/Tabs/DayPicker are the sole focus/keyboard owner for their surface. Busy/persistent close checks remain business callbacks; the app chooses initial/return focus without adding another Tab trap or document Escape handler. Month browsing never writes a date; explicit selection updates the original YYYY-MM-DD field once. Use local calendar fields rather than `toISOString()` to avoid timezone shifts. Locked historical dates show their original month even before the current minimum.

`#app`, `#rail-root`, `#modal-root` and `#toast-root` are siblings directly under body. `shell()` only replaces `#app`; the stage Dialog mounts in `#rail-root` and is disposed on close or departure. `syncOverlayBackground()` in app.js is the single owner of application inert state, derived from mounted modal/stage DOM. Radix deliberately preserves live regions from `aria-hidden`; scoped editor date/save announcements therefore do not replace explicit `#app.inert` isolation. Do not add broad `aria-live` to `#app` or manually toggle Radix-owned `aria-hidden` attributes.

A child modal makes the stage Dialog inert while the app remains inert. `prepareDialogContainer()` replaces the empty body-sibling modal container before a new visit: reusing an ancestor captured by parent `hideOthers` can conceal a later child from accessibility. On child close, restore the connected parent trigger after making the parent interactive; restore application focus only once the final overlay is gone. Full `renderAuth()` must dismiss the external rail, clear `state.railOpen`, and force-close the modal before mounting login. Persistent session-expiry reauthentication keeps the unsaved editor and its source context instead.

Initialize the singleton Sonner at `#toast-root` before `init()` or any Dialog. Its existing polite live region remains available during the first modal and nested visits. Do not create an extra toaster or mount it under inert `#app`. The stage surface uses real Tabs with force-mounted, hidden inactive panels; only its current panel is visible/focusable and its statistics remain shared.

Build `ui/entry.jsx` with Vite library mode to `public/ui/`, `publicDir:false`, no Tailwind Preflight. Explicitly define browser `process.env.NODE_ENV` as production; Vite library mode otherwise leaves a nonexistent browser `process`. Source/index version strings must change with runtime assets because static resources are immutable cached. Docker builder copies UI source and license-build helper; runtime copies compiled resources and runs the native server.

## Validation / error matrix

| Trigger | Required behavior |
| --- | --- |
| Hidden question or closed answer changes visibility | Same input node/value remains available to collection |
| Add/remove/save/async redraw | Collect first, unmount nested roots before replacing, bind final controls once |
| Save/lock busy; persistent reauthentication | Cannot dismiss or navigate until existing business rule allows |
| Stage dialog opens a child | Child has no hidden ancestor; closing restores connected parent trigger |
| Confirmation above live review date/save status | App stays inert; dialog and toast remain available; final close restores the editor |
| Full auth reset with a stage/child open | External roots are disposed, open state cleared and login is interactive |
| Browse month / choose disabled date | No input event, dirty change or saved date rewrite |
| White custom theme | Readable text/boundaries/focus remain visible |
| Missing built resource/license | Build or deployment smoke fails; API health alone is insufficient |

## Good / base / bad cases

Good: Card owns opaque form markup, Input has its own disjoint root, native collection sees edited values, disposal removes Input before Card. Base: ordinary Button preserves original data-nav and guarded handler. Bad: replacing an opaque region without cleaning its nested roots, or wrapping a legacy focus trap around Radix's trap.

## Tests required

Actual DOM tests import the production build and assert native values/FormData/events, hidden field retention, nested-root disposal, checkbox, progress semantics, menus, calendars and guarded/nested Dialog behavior. Overlay regressions execute the real app ownership helpers against index.html roots, including live review descendants, first-modal toast, repeated child visits, focus return and full auth teardown. Keep all domain/security/navigation tests. Browser gate includes auth, overview, all six review types, history/actions, settings, backups/admin, desktop and 320/390/820px, custom white themes, reduced motion, console, focus and layout. JSX compilation is part of build/pretest; this JavaScript package has no separate TypeScript or ESLint gate. Deployed smoke checks `/healthz`, HTML and real local JS/CSS.

## Wrong vs correct

Wrong: `container.innerHTML = nextHtml` while it contains registered roots. Correct: `renderMarkup(container,nextHtml)` before native handlers bind. Wrong: preserving both Tailwind `translate` and legacy `transform:translate` on the same dialog. Correct: `.sd-dialog` has one position owner, with the other translation explicitly disabled. Wrong: using `.nextElementSibling` to pair color inputs through hosts. Correct: query the text field by its stable `name`.
