# Verification — 2026-11-16

## Completed implementation

- Main pages have independent paths and use indexed browser history. Saved reviews use their UUID path; first save replaces the address without replacing input nodes. Back/Forward reuse the existing unsaved/pending-operation guard and account ownership.
- Finance reuses the supplied shadcn component layer: Select, DropdownMenu, Popover/Calendar and Chart/Recharts Pie. Month and day charts use full-period positive expense aggregates independently of list filtering and pagination. Refunds and net expense are shown separately. Category colors remain stable across both charts.
- Month/date and ledger filter layout were updated within the existing paper, typography and illustration design. Previous bars and the duplicate category panel were removed.
- Updated README, design/UX documentation and frontend/backend contracts. Final application, finance module, UI bridge and stylesheet cache references use `finance6`.

## Automated verification

- Production build and `npm run check`: passed.
- Full application suite: 464 discovered, 463 passed, 0 failed, 1 existing opt-in real-Chrome OCR check skipped. Output is in ignored `local-data/final-tests.log`; independent review is recorded in `check-results.md`.
- Handover tests: 13 passed.
- Isolated HTTP smoke: health, entry HTML, built shadcn JS/CSS, browser navigation module, finance modules and local OCR resources passed. `/finance`, `/history`, `/actions` and a saved-review path return the application document. Temporary server stopped after verification.
- `git diff --check`: passed.
- Online production dependency audit did not complete. The first request could not reach npm; its approved-network retry was not executed because automatic approval review returned HTTP503, “No compatible account is available for this model.”

## Browser evidence and limits

Desktop checks completed before browser access became blocked:

- Login and refresh preserve the requested finance route.
- History → Back → finance → Forward → history updates both visible content and address.
- Back with unsaved `60 打车` / `50 吃饭` restores the original address; cancelling keeps the exact input node and values, with the correct 110.00 preview.
- Selecting a day changes only the day total; the monthly total remains unchanged and focus returns to the picker.
- The genuine Select menu opens with finance type choices.
- Both pies render nonzero 330×230 SVGs with the expected slices. Removed a `max-width:100%` override that had clamped Recharts' internal measuring wrapper to zero.

The final browser request was not executed: automatic approval review reported exhausted workspace credits. Mobile 320/390px geometry, final month popup browser interaction, latest distinct-color styling and the final scoped Calendar/button resets remain unverified visually. Component keyboard/date/disabled behavior has automated coverage; this is not a substitute for the remaining visual checks. No alternate browser surface was used.

## Static UI audit disposition

The optional generic strict audit returned 19 findings; it did **not** pass. Its raw output remains ignored in `local-data/audit`.

- Five ownership findings concern native field markup. History intentionally uses genuine visible NativeSelect; finance uses hidden native form owners under the actual Select adapter, and detailed entry keeps its existing native date Input. These boundaries are explicit in `component-islands.md` and `docs/shadcn-adoption.md`.
- Eleven actionless-button findings come from static inspection of template strings or library-owned buttons. App/finance actions bind handlers after rendering; Calendar, Dialog and other islands attach component behavior. The application and actual component tests exercise these paths.
- Three textarea-resize findings concern existing shared Textarea/native adapter markup. Current textarea sizing remains governed by the existing page styles; this task does not change the approved review editor behavior.

These are recorded as contextual audit dispositions, not a claimed green audit or browser acceptance.

## Remote publication pending

The pre-sync `git fetch origin main` was not executed: automatic approval review returned the same HTTP503 service error. No remote update, release publication or retention cleanup is claimed for this task. Finish local commit preparation; once approval service access is restored, fetch main, resolve any intervening changes, push the reviewed commit, wait for both architectures and public-download checks, then retain the latest four complete Releases without deleting tags. Keep this task active until that work is complete.
