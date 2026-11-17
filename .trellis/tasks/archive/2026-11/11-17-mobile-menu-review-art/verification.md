# Verification — 2026-11-17

## Local result

- `npm run check`: passed (implementer and review gates).
- `npm test` (including production UI/OCR build): 508 discovered, 507 passed, 0 failures, 1 optional real-Chrome OCR check skipped.
- Menu component suite: 18/18 passed, including click-only opening, complete touch/mouse activation once, second tap close, cancelled pointer sequence, outside dismissal, selection/focus, keyboard and unchanged desktop pointer path.
- Independent full-scope review found no blocking production issue; 39 targeted surface/wheel/transition/completion tests and syntax/diff checks passed. Reviewer corrected one stale mobile-art spec sentence.
- Actual `bindHeaderMenus` with `attemptNavigate`: re-render binds new menu, saving blocks navigation, dirty content requires discard, normal selection navigates once.
- Compact handover suite: 13/13 passed.
- Isolated HTTP smoke: health, HTML/JS/CSS types, built shadcn runtime and local finance/OCR resources passed. Test-only data/key and port; owned server stopped afterwards.
- PostCSS parsed the stylesheet. After line-ending normalization, all CSS outside <=820px media blocks matches baseline byte-for-byte. New art hiding is scoped to `.daily-art-flow .daily-scene-art` under `(max-width:820px)`; its old dedicated grid row is removed. Desktop grid and art remain unchanged.
- Cache revisions: app, shadcn JS/CSS and main styles use mobile1; unrelated finance modules retain finance10.
- `git diff --check`: passed.

## Scope and limits

The reproduced menu defect is the missing click-only activation path in the built Radix trigger. Standard simulated touch pointerdown could already open it; this does not establish the exact event stream of the user's device. The fix opts in only the mobile hamburger and preserves the desktop account trigger's existing path.

Six review intros, questions, draft and locked states share the hidden art wrapper. Overview/history illustrations and stored review fields are unaffected. No form remount, prompt order, input-height or desktop style changes.

CUA inventory reported `Local browser access is unavailable for this chat`. No actual narrow/desktop browser rendering or physical-phone touch acceptance was performed; DOM and CSS checks are not visual acceptance. No browser restriction workaround used. No production account or server was changed.

## Publication

- Commit `9a457be55b09dc09ea7523f5aa71fcdf62f1db82` pushed to main; application tree `9a1fa025561a476579a4dff1f4baa0121c415438`.
- GitHub Actions <https://github.com/hikling/shendu-v1/actions/runs/43997554307>: completed/success. Both native builds, handover, publish and both public-download/Compose/health/UI/backup checks succeeded.
- New complete Release `deploy-9a1fa025561a476579a4dff1f4baa0121c415438` published with both images and checksums.
- Audited retention Plan/Apply confirmed exactly four Releases remain: current tree, `9e8bb5568882d3e7546d57afb39afca60ca368fb`, `cbe2bcb8a636c6e83978c08cdefa8e7cee57649f`, `07df282547cbc7798eef0a245c5acedf3f630223`. Removed only Release `deploy-a4daa76eb80b5ff47acfa5dfd6a977747d582a23`; no Git tags deleted.
- The user's production server has not been updated by this session; server update and real phone acceptance remain external steps.
