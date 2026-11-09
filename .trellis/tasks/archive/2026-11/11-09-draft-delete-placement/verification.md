# Verification — 2026-11-09

- History cards are restored to their original single open button; archive-only delete wrapper and styles are removed.
- Both daily and extended review footers mount a draft-only delete button. Their actual prompt owners show it only at the final prompt, including daily templates without diary. Historical editor read-only state does not hide a draft deletion operation. Completed and verified records never render the button.
- Existing confirmation/dialog ownership is reused. Cancellation and errors preserve mounted input values and dirty state. Confirmation uses the current ID/version; a first save updates the bound action through current state. A never-saved draft is discarded locally without writing a server record. A successful deletion clears current/dirty and uses shared navigation to history with filters retained and focus restored. Old account/editor/record/dialog completions are ignored.
- No server/API/schema change; existing owner/status/version deletion and stale-save protections remain.

## Checks

- Syntax check passed (`npm run check --prefix shendu`).
- Build and full test suite passed (`npm test --prefix shendu`):259/259 tests,0 failed/skipped/cancelled.
- Revised12 actual built-component UI tests cover all six types, current/past drafts, submitted/verified omission, actual last prompt including custom daily templates, cancellation and escaped summary, dirty input preservation, busy/dismissal/duplicate protection, API failure/retry, first save, local-only discard, stale owners, history without deletion and title-first auxiliary pages.
- Isolated server smoke passed: health, HTML, app module and built shadcn JS/CSS all served correctly.
- Source review confirmed the existing `.daily-art-flow [hidden]` suppression applies, the action row can wrap, final delete remains in the existing footer, and full suite retains completion/verification regressions.

## Limit

The host reported local browser use disabled when opening the isolated preview. No current desktop/mobile visual acceptance or screenshot is claimed. Validation uses production render/prompt/binding functions through the built component bridge; this does not prove browser geometry. No user records or live site were accessed.
