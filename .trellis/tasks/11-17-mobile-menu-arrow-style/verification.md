# Verification — 2026-11-17

## Implemented scope

- Mobile descriptors no longer carry desktop `.header-link` centering into the dropdown. Every row retains its label, current-page state and guarded callback. Mobile menu styles are scoped to `.sd-menu-mobile` under <=960px: left alignment, 48px minimum rows, 15px text, capped width and Radix available-height scrolling.
- Only authored decorative U+2197 spans are marked. Mobile CSS paints a local monochrome SVG mask in currentColor; desktop retains its original Unicode glyph and page geometry. Existing hidden arrow spans are not forced visible. User-supplied text is never scanned or rewritten.
- No changes to the prior mobile click activation, six-review hidden illustrations, data, routes or desktop account menu.

## Evidence

- Production UI/OCR build and `npm run check`: passed.
- `npm test`: 508 discovered, 507 passed, 0 failed, 1 optional Chrome OCR smoke skipped.
- Actual surface suite: 18 passed, including mobile click/touch/keyboard, one guarded navigation, current-page preservation and desktop account descriptor preservation.
- Independent review: no blockers; 31 surface/browser-navigation/completion tests, syntax and diff checks passed. Mobile-only cascade, hidden-span preservation, SVG packaging and same-origin policy checked.
- PostCSS comparison: all existing menu CSS outside <=960px blocks unchanged after ignoring comments/line endings. Every new arrow rule is inside the mobile breakpoint; existing global/page styles remain untouched.
- Isolated HTTP smoke: health, HTML, JS/CSS MIME, real built shadcn bridge, finance/OCR resources and the exact new SVG with `image/svg+xml` passed. Temporary data/key and owned process only; server stopped after check.
- Cache chain: app and shadcn JS/CSS use mobile2; new mobile stylesheet loads last with mobile2. Other assets keep existing revisions.
- `git diff --check`: passed.

## Limits

Browser access still reported unavailable. User explicitly chose “先完成代码和自动检查”. No actual phone/desktop screenshot, physical touch sequence or visual acceptance is claimed; simulated DOM events and CSS checks cannot establish final device appearance. No production server update was performed.

## Publication

Independent review passed; main/release verification pending.
