# Acceptance focus

## Current evidence
The old flow changes hidden fields, heading content and art side immediately. Heading mount animation does not replay on text replacement; scene animations only rerun when an image becomes displayed. The missing common transition belongs to daily/extended navigation after validation. Wheel navigation already clicks those same controls.

## Review gates
- Direction, outgoing/incoming order and one navigation per animation; no accumulated click queue.
- Before deferred switch, original canvas/editor/account/record still owns the operation and no save or overlay has replaced it.
- Cancelled animation rejection never becomes an unhandled rejection or invokes the old callback.
- Validation failure stays on current screen, with error and focus immediately available.
- Long values and real shadcn input nodes remain mounted through next/back; no duplicated forms or art.
- Keep existing wheel threshold/idle/cooldown and native scroll priority intact.
- Default animation, account/system reduced motion, unsupported animation and interrupt paths all restore usability.
- Only scoped content/art properties animate. Existing grid, artwork rotation, header, footer and page background retain their ownership.

## Browser availability
On2026-11-13, `cua.getState()` returned no browsers and reported local browser access unavailable; on2026-11-14 the resumed attempt with `cua.listBrowsers()` returned the same limitation. The earlier user choice was to complete code/automated checks. Do not claim physical animation/scroll-wheel or narrow-layout browser acceptance for this round.
