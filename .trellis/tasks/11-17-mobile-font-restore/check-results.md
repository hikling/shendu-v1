# Mobile font restoration review

Reviewed 2026-11-17 against the task PRD and frontend architecture, component-island and UI-quality contracts. No blocking findings and no production-code changes were needed.

- The Radix dropdown content is portaled beneath `body`; neither the portal wrapper nor `.sd-surface` supplies a replacement font family. The existing `.sd-menu[data-slot="dropdown-menu-content"] { font:inherit }` therefore inherits the original root Songti/serif stack after the mobile sans override is removed.
- Mobile caption and menu items explicitly inherit that family. The caption selector has three classes, overriding the later one-class `.header-menu-caption` sans-serif shorthand in `public/styles.css`. Item size, weight and line-height remain 15px, 500 and 1.6; the selected item remains weight 750. Caption size, weight and line-height remain 13px, 600 and 1.4.
- All typography corrections are confined to the existing <=960px media block. A PostCSS structural comparison against HEAD confirmed all non-font mobile declarations and all CSS outside that block are unchanged. No menu markup, behavior, SVG arrow or global/page stylesheet changed.
- The app entry, shadcn import and shadcn stylesheet consistently use `mobile3`; untouched stylesheet cache revisions are retained.
- The component-islands spec now preserves the approved serif family during mobile menu alignment changes.

## Verification

- `npm --prefix shendu run check`: passed. This JavaScript package has no separate ESLint or TypeScript gate.
- `git diff --check`: passed.
- PostCSS comparison and caption/item inheritance checks: passed.
- Build, existing actual-menu DOM suite and HTTP resource smoke are owned by the parent session; this review did not duplicate or race those operations.
- No new source-mirroring CSS tests were added for this reversible font-family correction.
- Actual device/browser rendering was not checked. Cascade and source review do not establish physical-phone appearance or installed font availability.
