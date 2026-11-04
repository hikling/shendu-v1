# shadcn UI adoption design

## Evidence / decision
Existing frontend is native HTML-string rendering plus imperative forms. A full React page rewrite would reimplement every mature lifecycle; a blind HTML-to-React parser would create competing child ownership. Adopt React's documented incremental component-island pattern instead. Genuine CLI-sourced shadcn components are copied into ui/components/ui and customized locally; no CDN or cosmetic-only replacement.

## Ownership
Legacy app.js continues owning API/data/navigation/dirty/read-only/security rules and custom page compositions. An explicit ui/runtime.jsx renders isolated real components into display:contents hosts before existing event handlers bind. Parent component raw descendants use opaque dangerouslySetInnerHTML, then descendants may receive disjoint component roots. Registry disposes roots deepest-first before ANY legacy subtree replacement. No moving React-owned elements into foreign containers, no monkeypatching DOM, no MutationObserver-driven fake components, no global JSX parsing of the legacy app.

Primitive UI: Button, Input, Textarea, NativeSelect, Label, Badge, Card, Table parts, Progress, Skeleton, Separator, Alert where semantic fit exists. Inputs remain uncontrolled with native names/values/FormData, hidden/file/color/checkbox semantics explicitly handled. Customized compound overview art/reel controls remain authored; answer native details retain their mounted textarea semantics (inner fields/buttons still use shadcn). These are documented exceptions, not blanket exclusion of review pages.

Complex surfaces: explicit JSX Dialog/DropdownMenu/Tabs/Calendar/Sonner islands with deliberate state callbacks to app.js. Each keyboard/focus behavior has one owner; remove legacy handlers only for surfaces taken over by Radix/DayPicker. Calendar callbacks preserve original date model, min dates, locked values, six week rows, Chinese labels, draft/completed/verified status. Menus retain exact allowed entries/permissions. Guarded/persistent/busy dialogs cannot dismiss until business state allows. Child dialogs above stage dialog retain focus restoration.

## Integration contracts
ui/entry.jsx exports public bridge functions from runtime and surfaces. renderMarkup(container,html) replaces legacy innerHTML sites after root disposal and enhances components synchronously. enhanceUi(container) can enhance freshly inserted raw DOM; disposeUi(container) is required before manual removal. mountComponent(container,ReactElement) is internal root registry API. Complex surface helper contracts coordinated between implementers; don't create parallel root registries. Native listeners are installed after real controls exist. Use explicit text nodes/spans for busy/start labels rather than assuming wrapper sibling/firstChild shapes. Stable containers must survive dynamic calendar/async backups/users redraws.

## Build / deployment
React19 + Vite8/Tailwind4 compile ui/entry.jsx in library mode to public/ui/shadcn.js and shadcn.css with hashed internal chunks. app.js imports the local built bridge. index references both versioned CSS/JS. Components config + lockfile checked in, generated build and node_modules ignored. No preflight reset or global brand/token overwrite. Tailwind component tokens adapt current theme, fonts and category palettes. Runtime server remains node-native; Docker gets build stage npm ci/build and copies static output only. Local npm start prebuilds; CI npm ci/build/check/test plus image/resource smoke test. Node minimum meets Vite and native SQLite requirements. Rollback is previous git revision, no database migration.

## Boundaries
Only frontend/component/build/deployment documents and relevant tests. Server/domain behavior, record schema, encryption, external backup permissions, review date policy, image files and data are unchanged. New source tasks never include fixture DB/key files. Site remains Chinese; externally sourced code attribution retained.
