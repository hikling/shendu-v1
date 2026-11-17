# Verification

- Final `npm test`: build passed; 525 tests, 524 passed, 0 failed, 1 optional real-browser OCR smoke skipped. `npm run check` and `git diff --check` passed.
- Root finance UI60/60; classification domain/API37/37; reviewer final domain15/15 and targeted controls/chart8/8 passed.
- Synthetic browser acceptance using real production public assets, shadcn/Calendar/Pie and extracted actual app overlay owner at1280/390/320: import date/type/amount/purpose/category/note controls all within row/card; no horizontal overflow; imported 买面条 shows餐饮. Screenshots visually inspected. No live data or provider credentials used.
- Populated charts expose four real nonzero sectors, new bright stable colors and readable center/legend. At320 the maximum amount `¥999,999,999.99` fits the center (124px text within130px). Normal CSS animation is finance-pie-reveal; both account reduce-motion and emulated system reduced-motion produce none immediately. No script exceptions.
- New behavioral tests cover day/month entry scope, independent ledger/chart dates, full-month stats, pagination cursor, unsaved native field identity and stale day response rejected after switching to month. Existing tests cover pending writes, dates/Calendar and request ownership.
- Actual iOS Safari was not tested on a physical iPhone. Scoped date/grid sizing and WebKit value rules address the screenshot's intrinsic date width, but narrow Chrome acceptance is not native Safari evidence.
- Read-only public-site check before publishing still reported finance15 assets; this change uses finance16 for app/UI/CSS/categorizer/receipt client. A server update and page reload are needed to load it.
- GitHub main work commit `da8f1eaa90ed387b602e380ae37bbd43028ffd42`, application tree `a8edf4cef0b31a11782f59ffde4ab443c209861e`. [Run44079681544](https://github.com/hikling/shendu-v1/actions/runs/44079681544) passed all six jobs: handover, amd64/arm64 verification, publish and both download smoke checks.
- Release retention plan/apply verified four complete releases remain, including this app tree. Removed only release447971778 (`deploy-eff391597c0342c5d47dca9d6a5219f556fa50f0`); all Git tags retained.
- Test preview server and isolated browser closed; no live server deployment performed.
