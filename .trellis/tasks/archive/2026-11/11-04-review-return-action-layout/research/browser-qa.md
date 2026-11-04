# Browser verification plan

Use only isolated synthetic fixture at 127.0.0.1:3192, not a production account.

1. History q/type/year/month -> open record -> exit -> same filter/query/list, expected scroll/focus.
2. Each daily, weekly, monthly, quarterly, yearly, decision historical record returns history.
3. Actions -> view original -> exit returns actions; overview fresh category -> exit returns overview after prior history source.
4. Current daily draft -> begin -> edit -> exit -> continue preserves input; exit discard -> original history. Save -> rerender -> exit preserves origin.
5. Calendar record entry after history cycle must not inherit stale context. Preserve guard and parent close order.
6. Actions no decorative stamp DOM; plan, actual result, adjustment display once, chronology and native controls accessible. Test long content/short missing legacy content and all category colors.
7. 1280/820/390/320 widths: no horizontal overflow; images/controls within card; no fixed content clipping. Reduced motion; white custom theme legible. Console no errors.
8. Capture desktop/mobile actions and preserve return evidence in these notes.

## Completed browser QA (2026-11-04)
- Six history categories each entered and exited: returned history in all six cases.
- Six action categories each entered and exited: returned actions in all six cases.
- History q=把心放慢, type=daily, year=2026, month=11 preserved after exit; original card focus restored, captured scrollY=223.
- Current daily draft: changed sleep to7.5, cancelled exit, saved, exited and reopened. Actual DOM input value remained7.5 after reload. Then changed to8, continued after exit confirmation (actual DOM value8), discarded through second exit: returned to history with original 返回来源 query. Initial attribute-only probe read the default HTML attribute rather than live input value; subsequent live-value checks above confirmed no product issue.
- Fresh overview weekly entry and calendar record entry after prior list visits both returned overview (no stale list source).
- Actual desktop action card inspected. 820/390/320 each had zero document/card/reading overflow; all10 record illustrations loaded; literal img-like synthetic text produced zero images in reading area. No 候/验 stamps in DOM.
- Theme saved with all three custom accents #FFFFFF and reduceMotion enabled: text remained dark and legible, artwork present, no overflow. Browser console error/warning logs empty.
- Default viewport restored. Genuine screenshots: docs/actions-reading.jpg and docs/actions-reading-mobile.jpg, captured with native browser clipping around the complete verified card.
- Independent reviewer fixed full-auth filter cleanup and ran91/91 tests. No backend/schema/eligibility/overview art changes.
