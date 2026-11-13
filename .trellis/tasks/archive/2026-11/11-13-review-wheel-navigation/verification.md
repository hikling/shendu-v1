# Verification — 2026-11-13

- `npm run check --prefix shendu`: passed all syntax checks, including the new wheel module.
- `npm test --prefix shendu`: Vite production build passed; **341 tests passed, 0 failed/skipped/cancelled**.
- `python -B -m unittest discover -s tests -p 'test_package_handover.py' -v`: **13 passed**.
- Local running-server resource smoke passed health, HTML, app, built component JS/CSS and the new `/review-wheel.js` asset. Context manifest validation and `git diff --check` passed.
- Independent final review found no blocking functional or security issue. Its 18 targeted tests passed. The outdated motion-only specification was corrected.
- Behavioral coverage: all six real review flows, required-field validation/input retention, read-only traversal, first/last/intro boundaries, 100-event wheel bursts, reversal/idle/cooldown, pixel/line/page units, native textarea/ancestor/document scroll priority, off/busy/modal/account/IME/control guards and disposer behavior.
- Settings coverage: independent switches, missing-field defaults, failure/retry, stale owners, encrypted storage, account isolation, fresh login, personal and site backup round trips, legacy backups and unchanged schema8.
- Earlier isolated desktop browser check verified settings checkbox save, refresh persistence and the two-row1280×860 layout. This continuation could not reconnect to local browser access. User explicitly chose “先完成代码和自动检查”; physical wheel feel, narrow viewport and full scrollbar visual acceptance remain unverified. No claim of those browser checks is made.
- Fixture uses local disposable data only. No production account or review data was changed during acceptance checks.

## Publication

- Work commit `8c4884ccf245936f36e17d84e092bc18b73a139e` pushed to `main`; application tree `c512e1e38de62c4b459264e3f81fb12eb298b470`.
- GitHub Actions run [43427303768](https://github.com/hikling/shendu-v1/actions/runs/43427303768) completed successfully: handover, native amd64/arm64 verification, immutable publication, and public download smoke on both architectures. Compact evidence is in `research/ci-result.json`.
- Following the earlier request to keep the latest four Releases, verified all four retained versions have their complete architecture assets/checksums; removed only the oldest fifth Release (`deploy-720aceb0bcfed89a389e03fade90c355cfff9753`). Final inventory contains four Releases including the new application tree. Git tags were preserved. Inventory plan/result are in `research/`.
- Isolated preview process16068 was stopped after checks. Ignored disposable local data is excluded from Git.
