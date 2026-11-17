# Verification — 2026-11-17

## Scope

- Removed the recently introduced sans-serif family from the mobile menu panel and items. The panel inherits the original root Songti/serif family; mobile caption and items explicitly inherit it.
- Caption inheritance overrides the legacy caption font shorthand. Original sizes, weights, line heights, spacing, colors, behavior and desktop rules remain unchanged.
- App entry and shadcn JS/CSS references use `mobile3`; untouched page/arrow styles retain their existing revisions.
- Corrected the component guideline that had incorrectly prescribed sans-serif labels.

## Evidence

- Production UI/OCR build: passed.
- `npm run check`: passed in independent review.
- Existing production-build surface suite: 18 passed, 0 failed, 0 skipped.
- Independent cascade/scope review and CSS structure comparison: passed.
- Isolated HTTP smoke: health, HTML, navigation/finance modules, built shadcn resources, OCR resources and local arrow SVG passed. Temporary data and owned server only; server stopped afterward.
- `git diff --check`: passed.

## Limits

The user previously chose code and automated checks while local browser access was unavailable. No phone browser visual acceptance or production-server update is claimed.

## Publication

- Work commit `0df6572123c3e04091823b03c0db357b84f346dc` pushed to GitHub main; application tree `20e126598dc9b5f5fbaca481292900491952810e`.
- GitHub Actions <https://github.com/hikling/shendu-v1/actions/runs/44004156592>: all six jobs passed, including both native architecture checks, handover, publication and both download/container smoke checks.
- Complete Release `deploy-20e126598dc9b5f5fbaca481292900491952810e` published.
- Audited retention Plan/Apply verified exactly four complete Releases remain: current tree, `eff391597c0342c5d47dca9d6a5219f556fa50f0`, `9a1fa025561a476579a4dff1f4baa0121c415438`, `9e8bb5568882d3e7546d57afb39afca60ca368fb`. Removed only obsolete Release `deploy-cbe2bcb8a636c6e83978c08cdefa8e7cee57649f`; all Git tags preserved.
