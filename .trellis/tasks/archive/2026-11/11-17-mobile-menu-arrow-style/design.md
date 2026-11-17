# Boundaries

Menu cause: legacy header-link class carries justify-content:center into Radix menu descriptors, whereas bottom items do not. A mobile-only descriptor/styling contract must prevent desktop navigation styles leaking into mobile rows. Retain genuine shadcn DropdownMenu and its existing event/focus ownership; do not add a parallel menu.

Arrow cause: U+2197 is an emoji-capable Unicode glyph. Keep desktop glyph rendering unchanged. Mark only authored decorative diagonal-arrow spans and render a local monochrome SVG mask at the mobile header breakpoint <=960px. Do not transform user text or query DOM for arbitrary arrow characters. Keep spans/labels/IDs/actions in place; no drawing dependency or broad icon migration.

Menu implementer owns ui/surfaces.css, mobile descriptor/options in app.js, targeted actual-header regression if needed, and component-islands.md contract. Root owns marked arrow spans in app.js, one calendar arrow in surfaces.jsx, local SVG, dedicated mobile overrides CSS and index/app cache references. Coordinate app.js edits by exact region. No other page layout redesign.
