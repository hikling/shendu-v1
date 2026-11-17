# Verification — 2026-11-17

## Result

- Actual same-origin Noto Serif SC WOFF2 subsets are aliased to `Shendu Songti` for mobile headings, intro, brand and menu at <=960px. Missing device fonts no longer decide those titles. Desktop heading families and existing heading size/weight/layout remain unchanged.
- Ledger purpose is 1.05rem; metadata, notes, date, controls and receipt status are larger. Amount is 1.3rem (1.25rem on phones). List expression is absent; edit expressions and refund association remain. Exceptional long amounts use a full-width right-aligned mobile row to preserve readability.
- New receipt uploads/revisions flatten both compressed image and thumbnail into one Beijing day directory per account. Existing objects retain their original paths. New and legacy keys remain valid through import/restore/read; no deployed objects were moved or deleted.

## Automated evidence

- Production build and `npm run check`: passed.
- Full suite: 511 discovered, 510 passed, 0 failed, 1 optional browser OCR smoke skipped.
- After long-amount presentation update: finance UI suite 55 passed. After reviewer corrected replace options: receipt suite 27 passed.
- Independent full-scope review: no unresolved production findings. Corrected new tests to use actual `{replace:true}` restore options.
- All 101 fonts parsed with FontTools/Brotli; actual cmap/variable axes verified. All 84 distinct Chinese title sample characters covered. Final binary total 6,030,988 bytes; all local SHA256/length manifests match.
- HTTP delivery of every font verified with exact SHA256, WOFF2 declared length and font/woff2 MIME. Full UI/OCR resource smoke passed against isolated server.
- `git diff --check`: passed. No credentials or real account data used in local validation.

## Actual browser scope

IAB browser against isolated synthetic account and entries:

- 390px: menu labels, overview, history, actions, finance, daily intro and daily question all compute `Shendu Songti`; screenshots inspected for real serif appearance.
- 320px: document scroll width equals viewport; four ledger rows (including long purpose/note and ¥1,000,000.00) have no horizontal overflow. Purpose is 18.9px and ordinary amounts 22.5px; duplicate expression/amount below purpose is absent.
- 1280px: finance headings retain original SimSun/Songti/Georgia families; mobile menu hidden. Browser error log empty at final inspection. Temporary viewport override reset.
- Font CSS and binary URLs were versioned after repairing initially truncated downloads, so acceptance did not rely on those cached files.

This is real browser verification at phone viewport sizes, not a physical Android/iOS-device test. No real-provider S3/R2 upload or production-server update was performed. New folder behavior applies to new uploads; existing external objects remain where they are.
