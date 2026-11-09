# Verification — 2026-11-09

## Implemented

- History exposes a separate delete button only for drafts, with escaped record summary, confirmation, dirty-input guard, busy protection and original-account/dialog ownership. Success preserves filters, removes cached data and restores focus; failures retain the confirmation and record.
- DELETE validates current session, account, draft status and precise numeric version. Completed/verified rows cannot be removed. Past-period drafts may be removed. Stale PUT requests with a deleted/foreign ID return404 rather than recreating data. No schema migration.
- Calendar current-stage row uses natural content height; pending receives the remaining right-column space. Long focus previews, footer and narrow stacking remain readable.
- Decorative title kickers are removed from non-review pages, panels, auth/connection surfaces and calendar component heading. Six-review intro copy, labels and functional descriptions remain.
- Asset revisions updated for browser cache invalidation.

## Checks

- `npm run check --prefix shendu`: passed.
- `npm test --prefix shendu`: build plus256/256 passed, no failures/skips/cancellations. Added8 real-HTTP deletion/race tests and9 actual built-component UI tests.
- Final CSS build and targeted9 UI tests passed after padding-cascade refinement; later changes only bump asset URLs and documentation.
- Browser on isolated local synthetic data:1280/821/820/390/320px stage/calendar, no horizontal overflow. At1280px final default stage203px and pending395px, together aligned with618px calendar and20px gap. A300-character focus retains footer within the card without overflow. Narrow pending remains280px.
- Actual history shows one draft deletion control and none on completed/verified cards, with no nested buttons and a42px action target. Opened the confirmation, checked stable320px bounds, and cancelled; the draft remained. Final deletion behavior verified by HTTP/component tests, not by deleting user records in a browser.
- Independent backend/UI implementations each ran targeted tests; root reviewed final changes and actual browser layout. `git diff --check` passed.

Only isolated fixture data was used. No live site, user drafts or credentials were changed.
