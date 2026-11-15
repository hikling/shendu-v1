# Verification — 2026-11-15

## Change
- All six review flows share `moveReviewPrompt()` and the canvas-local `createReviewTransition()` controller. Buttons and wheel navigate through the same accepted button handlers.
- Outgoing content/art fades for100ms with8px movement; incoming content/art fades for220ms with16px movement, reversed for back navigation. The stable background/header/footer and mounted fields are preserved.
- Pending turns do not queue repeated navigation. Programmatic error revelation, route/auth replacement, save busy state and modal opening cancel the active effect. Deferred updates check connected canvas/editor, account, record and saving/overlay ownership.
- Cancellation is handled for each animation as soon as it starts, including partial API failure; original inert state is restored. System/account reduced motion and unsupported animation keep immediate navigation.

## Checks
- `npm run check --prefix shendu`: passed.
- `npm test --prefix shendu`: production Vite build passed; **354 tests passed, 0 failed/skipped/cancelled**.
- `python -B -m unittest discover -s tests -p 'test_package_handover.py' -v`: **13 tests passed**.
- Eight controlled-animation cases cover two-phase ordering, no queued navigation, cancellation/ownership/detachment, original input/inert preservation, native cancellation and late completions, reduced-motion/API fallback, partial target failure and mid-transition preference change.
- Five additional real six-flow cases traverse every question in both directions with buttons and wheel, including stage and calendar changes; verify input identity/long values, synchronous validation, actual shell/save/modal cancellation and stale account/record/editor guards. Existing write/delete/backup/authentication regressions remain green.
- `git diff --check` passed.
- Independent read-only review found no blocking issue in the controller, six-flow integration, cancellation/ownership, focus, reduced-motion or scoped CSS behavior. It reused the main session's full-suite evidence instead of rerunning it.

## Acceptance limit
Browser access was unavailable on the preceding attempts (2026-11-13 and2026-11-14). The user had explicitly chosen code and automated checks. Physical animation appearance and narrow-layout browser acceptance are not claimed. No production account/review data was changed by tests.

## Publication
- Work commit `6ee86afd35bdfe50ca0152d03b88f608dae3f976` pushed to `main`; application tree `250b9eddea7c9563d25020666b62482653f66db8`.
- [GitHub Actions43664011584](https://github.com/hikling/shendu-v1/actions/runs/43664011584) passed handover, native amd64/arm64 verification, publication and both public-download smoke checks. Compact evidence is in `research/ci-result.json`.
- Following the user's existing latest-four request, the current application release and the next three recent complete releases were protected. Only the oldest fifth Release `deploy-a5fbe2e2c9f3987782c620fb82ac81bf86891c29` was removed; final inventory contains four complete Releases and all Git tags are preserved. Inventory plan/result are retained under `research/`.
