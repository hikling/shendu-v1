# React component islands

## Scope / trigger

Applies whenever `shendu/public/app.js`, `shendu/ui/`, or frontend build/deployment changes. Legacy route/data code owns records and DOM-compatible form collection; genuine shadcn React components own isolated control roots and explicit interactive surfaces.

## Signatures

- `renderMarkup(container, html)` disposes descendant roots, replaces trusted escaped template HTML, then synchronously enhances controls.
- `enhanceUi(container)` enhances freshly inserted native controls; it must complete before legacy event binding.
- `disposeUi(container)` unmounts registered roots deepest first, including portals with logical ownership.
- `mountComponent(container, element, {owner=container})` creates or updates an explicit component island through the same registry.
- Surface helpers: `prepareDialogContainer`, `showDialog`, `dismissDialog`, `showMenu`, `showVerificationCalendar`, `showStageCalendar`, `initializeToasts`, `showToast` from the built `ui/shadcn.js`. Settings/calendar use ordinary workspace routes; there is no rail surface helper.
- `npm ci`; `npm run build`; `npm run check`; `npm test`; `npm run smoke:ui -- <base-url>`.

## Contracts

Primitive hosts use `display:contents`, but remain real DOM ancestors. IDs, names, data attributes, values and disabled/readOnly stay on actual controls. Inputs/Textarea are uncontrolled; hidden questions remain mounted. Checkbox has one native form field plus a visible real Radix Checkbox with a single event path. No schema/API changes.

Single-value selects normally use directly visible shadcn/Radix RadioGroup choices. The history page explicitly restores compact shadcn NativeSelect for `history-type`, `history-year` and `history-month`; their original native labels, focus, value/events and disabled-month semantics remain. Do not apply RadioGroup layout or hide their one authored chevron. Other single-value choices have no native popup or chevron. The hidden native select retains id/name/value/FormData, required/disabled semantics and exactly one input/change event pair. Native label/invalid focus forwards to the visible group. Reset and external value events synchronize without remounting; inherited disabled fieldsets and disabled options stay unavailable. `choice-controls.css` owns wrapping, category selection/focus colors and host-aware layout. Verify real keyboard arrows/Space, locked history and 320px choices. Ghost/text actions have no component-default hover fill or default hover ink; pages own text/underline feedback and visible keyboard focus. Header protection targets actual `[data-slot]` triggers. Preserve meaningful selected-date/choice fills.

DayPicker component overrides must have stable component identities. The local Calendar Root/Chevron/WeekNumber are declared at module scope; an inline Root function inside Calendar remounts the whole date surface whenever its controlled month changes, discarding the activated month button and focus. Do not compensate with a second focus manager. Actual DOM regression must retain the same root/previous/next nodes and the activated button focus through repeated month/year browsing for both stage and verification calendars, without selecting a date.

Child combinators still see the host even when its layout box disappears. Preserve host-aware equivalents for paired-field labels, afterword Cards, timing/status Badges and responsive table/list alignment. Header route Buttons and account/mobile DropdownMenu Buttons retain the approved text-only treatment in idle, hover, focus and active states: transparent background, no border/radius/shadow; use route text color plus a separate readable focus outline. Keep category-specific focus colors and fixed-palette contrast with legacy color data; do not restore shadcn's default filled header treatment.

Card/Label/Button template descendants are opaque to React. Keep custom title/typewriter/reel nodes native, and use DOM text nodes or escaped HTML. Never parse unescaped record content into JSX/HTML. No prototype monkeypatches, blind HTML-to-React tree conversion, MutationObserver remounts, moving React nodes out of their root, or a second root registry.

An archive card is a genuine Button with opaque native content, so its page layout must explicitly override the primitive's `items-center`/`justify-center`. `.history-record` uses a column with `align-items:stretch`, `justify-content:flex-start` and zero gap; its top/body/footer each declare full width. The copy column aligns to its start. Otherwise short titles, dates and status spans float at different centers even though the outer card is correctly sized. Check the rendered card rather than inferring alignment from template nesting.

Dispose before every live subtree replacement/removal, including asynchronous backup/admin content and dialog bodies. Detached `template.innerHTML` for parsing remains valid. Raw heading `replaceChildren` and busy-button label updates are safe only in documented native/opaque regions.

Dialog/Menu/Tabs/DayPicker are the sole focus/keyboard owner for their surface. Busy/persistent close checks remain business callbacks; the app chooses initial/return focus without adding another Tab trap or document Escape handler. Month browsing never writes a date; explicit selection updates the original YYYY-MM-DD field once. Use local calendar fields rather than `toISOString()` to avoid timezone shifts. Locked historical dates show their original month even before the current minimum.

`#app`, the unused compatibility `#rail-root`, `#modal-root` and `#toast-root` are body siblings. `shell()` replaces `#app`; calendar/settings/stage-settings/guide are normal pages with no Dialog, backdrop or inert state. `syncOverlayBackground()` owns application inert state for actual functional modals. Radix preserves live regions from `aria-hidden`; keep explicit `#app.inert` isolation for modals, without broad application `aria-live` or manual Radix-owned `aria-hidden` changes.

`prepareDialogContainer()` replaces the empty body-sibling modal container before a new visit, avoiding stale hideOthers snapshots. Closing a functional modal restores the application before connected return focus. Full `renderAuth()` force-closes modals before login; persistent session-expiry reauthentication preserves the unsaved editor and its source context. Settings/calendar navigation uses the same dirty/pending guards as other normal pages.

Initialize singleton Sonner at `#toast-root` before `init()` or any Dialog. Its polite live region remains available during modal visits. Do not create another toaster or mount it under inert `#app`. Calendar shows one summary and a normal responsive calendar/context spread; it no longer uses Tabs.

Build `ui/entry.jsx` with Vite library mode to `public/ui/`, `publicDir:false`, no Tailwind Preflight. Explicitly define browser `process.env.NODE_ENV` as production; Vite library mode otherwise leaves a nonexistent browser `process`. Source/index version strings must change with runtime assets because static resources are immutable cached. Docker builder copies UI source and license-build helper; runtime copies compiled resources and runs the native server.

## Validation / error matrix

| Trigger | Required behavior |
| --- | --- |
| Hidden question or closed answer changes visibility | Same input node/value remains available to collection |
| Add/remove/save/async redraw | Collect first, unmount nested roots before replacing, bind final controls once |
| Save/lock busy; persistent reauthentication | Cannot dismiss or navigate until existing business rule allows |
| Settings/calendar navigation | Normal page, no backdrop/inert; dirty or pending changes remain protected |
| Confirmation above live review date/save status | App stays inert; dialog and toast remain available; final close restores the editor |
| Full auth reset with a functional modal open | External roots are disposed and login is interactive |
| Browse month / choose disabled date | No input event, dirty change or saved date rewrite |
| Legacy all-white color data | Fixed accents remain readable; motion preference still applies |
| Missing built resource/license | Build or deployment smoke fails; API health alone is insufficient |

## Good / base / bad cases

Good: Card owns opaque form markup, Input has its own disjoint root, native collection sees edited values, disposal removes Input before Card. Base: ordinary Button preserves original data-nav and guarded handler. Bad: replacing an opaque region without cleaning its nested roots, or wrapping a legacy focus trap around Radix's trap.

## Tests required

Actual DOM tests import the production build and assert native values/FormData/events, hidden field retention, nested-root disposal, checkbox, progress semantics, menus, calendars and guarded/nested Dialog behavior. Overlay regressions execute the real app ownership helpers against index.html roots, including live review descendants, first-modal toast, repeated child visits, focus return and full auth teardown. Keep all domain/security/navigation tests. Browser gate includes auth, overview, all six review types, history/actions, settings, backups/admin, desktop and 320/390/820px, legacy all-white color data, reduced motion, console, focus and layout. JSX compilation is part of build/pretest; this JavaScript package has no separate TypeScript or ESLint gate. Deployed smoke checks `/healthz`, HTML and real local JS/CSS.

## Wrong vs correct

Wrong: `container.innerHTML = nextHtml` while it contains registered roots. Correct: `renderMarkup(container,nextHtml)` before native handlers bind. Wrong: preserving both Tailwind `translate` and legacy `transform:translate` on the same dialog. Correct: `.sd-dialog` has one position owner, with the other translation explicitly disabled. Wrong: using `.nextElementSibling` to find a related field through hosts. Correct: query the actual control by its stable ID/name; read Checkbox via its native form field.

## Calendar cell and button identity

`CalendarDayButton` uses `getDefaultClassNames().day_button` (`rdp-day_button`), never `.rdp-day`. The shared verification calendar retains its ordinary DayPicker table cells. Stage alone supplies module-stable `MonthGrid/Weekdays/Weekday/Weeks/Week/Day` overrides in `ui/surfaces.jsx`, producing div grid/rowgroup/row/columnheader/gridcell semantics without any table/thead/tbody/tr/td/th descendant. Strip slot-only `day/modifiers/week/scope` props. Stage cells use `.stage-calendar-cell`, not shared `.rdp-day`, and set inline `gridColumnStart:(day.date.getDay()+6)%7+1` after incoming styles. Stage rows have seven equal tracks and a positive minimum height (58/54/51px at their breakpoints), even when all outside-month cells collapse. Do not depend on blank cells for weekday placement, mix native table layout with stage Grid rows, or apply these private overrides to verification dates. DayPicker retains month, keyboard and focus ownership; CalendarDayButton remains unchanged. Test both calendars together when shared Calendar code changes.

A structurally correct DOM cannot prove a browser painted dates in their civil positions. For repeated/stray glyph reports, compare every actual date's rendered center with its independently calculated weekday header and week row; counts alone miss misplaced dates. Cover empty/populated months, all seven month starts, leap/year transitions, 320px and desktop, resizing and Chrome page zoom. Inject `display:none!important` on outside-month placeholders and assert that it really applies: date positions and six positive-height rows must survive. Keep42cells/sixrows/sevencolumns, one control per actual civil day, empty outside cells, unchanged record/disabled values and stable month-button/return focus. The portable browser regression is `docs/stage-placement-qa/check.cjs` (requires Playwright, Chrome and an isolated authenticated synthetic fixture). Do not fix drawing artifacts by cropping or hiding valid dates. Distinguish a reproduced injected failure from the user's exact unreplicated double-paint, and downloaded-production-asset checks from an actual live account render.
