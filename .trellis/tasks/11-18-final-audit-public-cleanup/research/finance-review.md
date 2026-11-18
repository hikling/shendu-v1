# Finance and receipt final source review

Reviewed 2026-11-18 against current source, task artifacts and finance/testing contracts. Only finance-ui.js and its regression tests were changed with root authorization; root owns cache/spec/docs integration. No real user account, secret, bucket or deployed data was accessed.

## Confirmed finding — fixed

**P2: a rejected screenshot row could become permanently uncorrectable.**

- Owner: `shendu/public/finance-ui.js`, `importPreview` submit/write loop (currently around340). Before POST the loop saved `attemptedBody` and disabled row inputs. Any error retained both, including a definitive400 validation rejection. The planned-amount matching flow already treated400 differently, but the image-only OCR flow did not.
- Real trigger: OCR can identify12 yuan but no purpose. The editable purpose input has no browser-required constraint. Confirming produces400 `finance_purpose_required` in `finance-ledger.mjs` (purpose check around61), with zero entry writes. The user then cannot fill the purpose; retry resends the old empty purpose forever. In a multi-image batch this can happen after an earlier row was successfully saved.
- Reproduction: an isolated in-memory real ledger returned `{status:400,code:'finance_purpose_required',entryCount:0}` for the blank-purpose payload. A new actual production-UI regression committed the first screenshot row and rejected the second; before the fix it failed because second purpose.disabled was `true` instead of `false`. The409 control case already passed, confirming the intended uncertainty lock.
- Fix: catch only a current-owner HTTP400 around that row POST; discard only that row's `attemptedBody`, restore its controls and recompute remove-button availability, then propagate the error to the existing inline status. Keep the stable ID and saved receipt list. Completed rows stay disabled/done. Network/409 failures retain their exact attempted payload and cannot be edited.
- Regressions: `screenshot validation rejection unlocks only the rejected row for correction without losing completed rows` and `uncertain screenshot conflict retains its exact attempted payload and disabled fields`, in `shendu/tests/finance-ui.test.mjs` around185–195. Successful correction posts only the second row with the original ID/image and changed purpose, then closes normally.

## Reviewed coverage

- `finance-ledger.mjs`: integer-cent arithmetic and bounds, account-scoped prepared SQL, create-hash retries, optimistic versions, category insertion/entry/activity atomicity, refund owner/reference/caps, tombstones/restore, day-zero semantics, full-period totals independent of paging, locked daily snapshots, import graph validation and retained-local receipt links.
- `finance-receipts.mjs` and server integration: private encrypted configuration, owned reusable targets, HTTP session revalidation, public-HTTPS validation/pinned network path, SigV4 exact method/type/length/hash binding, rate/concurrency limits, pending retry version/key rotation, ready immutability, ordinary-S3 checksum proof, native-R2 bounded actual-byte digest verification, disconnect/reconnect identity, short private image reads and backup namespace/graph checks.
- `finance-domain.js`, `finance-receipt-matching.js`: nonexecutable exact decimal expressions, line/text limits, expanded shared classification/manual overrides, unknown-purpose fallback, exact unique amount associations and explicit ambiguity, no guessed settlement or OCR transaction writes.
- `finance-ui.js`: shared finance/daily entry ownership, one upload path, income-only hidden values, draft identity and pending-state protection, partial writes and stable retries, matched-image allowlists/max10/unused acknowledgment, full-image lazy navigation/old-read guards, storage test/save/delete semantics, independent date/range/chart reads.
- `receipt-client.js` and `scripts/prepare-ocr.mjs`: byte/type/pixel preflight, bounded compression and resource cleanup, local OCR assets/worker cancellation, strict target origin/path checks, direct compressed PUT with no originals, staged sanitized errors, per-image fallback and saved-ID ownership, lazy image reads.

No additional confirmed blocking vulnerability was found in these reviewed paths. Existing API compatibility intentionally allows old/manual receipt-free entries; new expense screenshot requirements are a current UI creation rule, not a global API migration. External object bytes remain outside database backups by design.

## Verification

- `node --test tests/finance-ui.test.mjs`: **67/67 passed** after fix.
- `node --test tests/finance-domain.test.mjs tests/finance-receipt-matching.test.mjs tests/finance-api.test.mjs tests/finance-receipts.test.mjs tests/receipt-client.test.mjs`: **96/96 passed**, including real isolated HTTP and encrypted-backup/receipt race tests.
- `npm run check`: passed (project JavaScript syntax gate; no separate static TypeScript checker configured).
- `git diff --check`: passed at review time.
- Source review and synthetic/local tests do not establish physical Safari behavior, live R2/S3 credentials/CORS correctness, or absence of all possible vulnerabilities. Root owns complete suite, dependency advisories, integration review, dual-architecture build and publication checks.
