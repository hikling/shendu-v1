# Change boundary

The mobile hamburger is converted by bindHeaderMenus to a shadcn/Radix MenuSurface. Fix its mobile-specific activation path after reproducing the failure; keep account menu and navigation guards unchanged. The six review types already share .daily-art-flow/.daily-scene-art; restrict hiding and grid changes to the existing <=820px review breakpoint in styles.css. Do not remove markup/remount inputs or alter prompt data, overview cards, history art or desktop layout.

Ownership: menu implementer owns app.js (only mobile menu options), ui/surfaces.jsx and menu behavior tests. Root owns styles.css mobile-only changes, cache references, docs/specs and task artifacts. Reviewer checks full scope. Scope does not include ledger/backend/API changes.
