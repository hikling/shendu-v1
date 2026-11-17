# Independent review — 2026-11-17

Result: no blocking production-code, navigation or scope findings.

## Reviewed behavior and boundaries

- The original mismatch came from mobile descriptors carrying `.header-link`, whose desktop presentation centers its contents. Only mobile descriptors now discard source classes; label HTML, current-page semantics and existing guarded callbacks remain. Desktop account descriptors preserve their classes.
- Mobile menu rules are restricted to `.sd-menu-mobile` inside `max-width:960px`. The selectors override legacy row styling with one left-aligned 48px-minimum/15px list, viewport-bounded width and Radix available-height scrolling. Current-page state has an explicit marker in addition to color. Existing clickActivation, keyboard, outside dismissal, focus return and route ownership remain unchanged.
- Authored northeast-arrow spans alone carry `mobile-action-arrow`; there is no runtime user-text scan or replacement. The 17 native template spans and calendar component span preserve their original glyph text and existing DOM/action ownership.
- The late-loaded mobile stylesheet sets font-size/line-height only on marked mobile spans and paints a fixed local SVG mask in currentColor. It does not set parent display, so existing hidden stage-summary arrows and hidden settings prompts remain hidden. No conflicting existing arrow pseudo-element was found. WebKit and unprefixed mask forms are present; the graphic contains no external dependencies.
- Desktop rules and arrow rendering are untouched above960px. The prior <=820px six-review art hiding remains intact. Overview/history layouts, stored records, inputs and navigation destinations are not redesigned.
- New CSS/SVG are under public, which the existing runtime Docker copy includes. Server MIME mapping serves SVG as image/svg+xml, and CSP permits same-origin styles/images. Root owns actual resource smoke evidence. App and shadcn JS/CSS cache references use mobile2; the unmodified main stylesheet retains mobile1.
- Specs match the new mobile-specific presentation contract.

## Independent checks

- `npm run check`: passed. There is no separate ESLint or TypeScript check script; the repository's explicit JavaScript syntax gate was used.
- `node --test tests/ui-surfaces.test.mjs tests/browser-navigation.test.mjs tests/review-completion-layout.test.mjs`: 31 passed, 0 failed, 0 skipped.
- `git diff --check`: passed.

The surface suite exercises real built menu components and actual header binding, including current-page semantics, source-class isolation, unchanged desktop classes, click/touch/keyboard sequences, one navigation per selection, saving/dirty guards and re-render binding.

## Limits

The user chose code and automated checks while local browser access is unavailable. No physical-phone touch test, rendered narrow-layout comparison or screenshot acceptance was performed. DOM/CSS inspection does not establish visual acceptance. Root owns full-suite/build, isolated HTTP resource smoke and publication records in verification.md.

No production changes or extra tests were needed from the reviewer.
