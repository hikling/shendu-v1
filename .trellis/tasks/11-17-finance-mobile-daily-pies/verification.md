# Verification

- Final `npm test`: build passed; 525 tests, 524 passed, 0 failed, 1 optional real-browser OCR smoke skipped. `npm run check` and `git diff --check` passed.
- Root finance UI60/60; classification domain/API37/37; reviewer final domain15/15 and targeted controls/chart8/8 passed.
- Synthetic browser acceptance using real production public assets, shadcn/Calendar/Pie and extracted actual app overlay owner at1280/390/320: import date/type/amount/purpose/category/note controls all within row/card; no horizontal overflow; imported 买面条 shows餐饮. Screenshots visually inspected. No live data or provider credentials used.
- Populated charts expose four real nonzero sectors, new bright stable colors and readable center/legend. At320 the maximum amount `¥999,999,999.99` fits the center (124px text within130px). Normal CSS animation is finance-pie-reveal; both account reduce-motion and emulated system reduced-motion produce none immediately. No script exceptions.
- New behavioral tests cover day/month entry scope, independent ledger/chart dates, full-month stats, pagination cursor, unsaved native field identity and stale day response rejected after switching to month. Existing tests cover pending writes, dates/Calendar and request ownership.
- Actual iOS Safari was not tested on a physical iPhone. Scoped date/grid sizing and WebKit value rules address the screenshot's intrinsic date width, but narrow Chrome acceptance is not native Safari evidence.
- Read-only public-site check before publishing still reported finance15 assets; this change uses finance16 for app/UI/CSS/categorizer/receipt client. A server update and page reload are needed to load it.
- GitHub release validation pending.
