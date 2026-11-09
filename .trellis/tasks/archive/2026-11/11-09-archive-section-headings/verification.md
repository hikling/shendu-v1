# Verification — 2026-11-09

## Result

- History all/filtered results and action pending/verified groups share a stronger section-heading hierarchy: decorative semantic glyph, larger Songti h2, functional description, separate actual count/unit, thin rules and a quiet paper background. Blue/brown/teal distinguish archive/waiting/verified without relying on color alone. No kicker slogans are restored.
- History count follows actual filtered rows including zero; clear-filter behavior is unchanged. Each action group shows its own count and configured escaped title/description; the former duplicate combined tally is removed. Records, artwork assignments, sorting and verification rules are unchanged.
- Settings removes the account-management card and uses two equal desktop destination columns, retaining stage, guide and motion preferences. Shared account/mobile menus keep their existing account entry and role guards.
- Header styles retain the hero illustration's reserved column on desktop; phone rules put art before the full-width heading and allow titles to wrap. Assets receive updated URLs.

## Evidence

- `npm run check --prefix shendu`: passed.
- `npm test --prefix shendu`: production build plus261/261 tests passed,0 failures/skips/cancellations.
- Added actual built-component header behavior coverage for all/filtered/zero/reset history counts, separate pending/verified counts, excluded drafts, custom escaped labels/descriptions and removed duplicate tally. Updated the existing settings destination assertion while retaining preference success/failure/account-owner tests and account/menu route tests.
- Isolated local service smoke passed: health, HTML, app module and built component JS/CSS served correctly. Test service terminated and fixture directory removed before commit.
- `git diff --check` and task context validation passed. Reviewed the applicable frontend archive/state/component contracts and final scoped CSS changes.

## Limitation

Local browser use was reported disabled by the host. No desktop/mobile screenshot or rendered geometry acceptance is claimed for this change. Component behavior and source-level responsive rules were verified; these checks do not prove visual layout. No production account or records were accessed.
