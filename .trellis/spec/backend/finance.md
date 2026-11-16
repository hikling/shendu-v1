# Finance ledger and receipt contract

## 1. Scope / trigger

Read this before changing finance persistence, daily finance completion, receipt storage, OCR packaging or their backup hooks. Schema9 is additive. Ledger entries are independent of review records: confirming an entry commits it immediately, and deleting a draft review cannot delete it. Daily historical content uses its completed snapshot.

## 2. Signatures

- `createFinanceLedger(deps)` in `shendu/finance-ledger.mjs` owns `finance_entries`, `finance_categories`, `finance_days`, account-scoped encrypted payloads and fixed activity events.
- `createFinanceReceipts(deps)` in `shendu/finance-receipts.mjs` owns `finance_receipts` and encrypted `finance_receipt_storage` settings. Its `handle(req,res,url,user)` follows the existing JSON/error contract.
- `GET /api/finance?month=YYYY-MM` or `date=YYYY-MM-DD`; optional `q`, `kind`, `category`, `cursor`, `deleted=1`.
- `POST /api/finance/entries`; `PUT /api/finance/entries/:id`; `DELETE /api/finance/entries/:id`; `POST /api/finance/entries/:id/restore`.
- `POST /api/finance/categories`; `PUT /api/finance/categories/:id`; `POST /api/finance/day`.
- `GET|PUT /api/finance/storage`; `POST /api/finance/receipts/prepare`; `POST /api/finance/receipts/:id/complete`; `POST /api/finance/receipts/read`.
- Browser `mountFinancePage(container,options)` and `mountDailyFinance(container,options)` return a disposable controller. `processReceiptFiles(files,options)` returns editable candidates, receipt IDs and warnings; it never writes ledger entries.
- Shared `parseFinanceLines(text,{categories,kind='expense'})` in `public/finance-domain.js` returns `{rows:[{line,expression,purpose,amountCents,categoryId}],errors:[{line,message}],totalCents}`. It is a pure preview parser; explicit confirmation still uses the existing entry endpoint per row.

## 3. Contracts

Entry creation supplies stable UUID `id`, real civil `date`, `kind` (`expense|income|refund|transfer`), `expression`, `purpose`, optional `categoryId`, `note`, `refundOf`, `receiptIds`, `source`. Restricted decimal +/- parsing produces positive integer `amountCents` in CNY; no eval or binary-floating-point sum. Mutations of existing entries supply `version`; identical create retries return the same entry. Categories are account-scoped, archived rather than removed, and historical labels remain readable.

The ledger response contains `{entries,categories,summary,trend,categoryTotals,nextCursor,day}`. Period statistics ignore list search/type/category filters and deleted records. The list pages at50 entries. `deleted=1` includes active and deleted entries. `summary.balanceCents` is a period difference, never a bank balance. Refunds reduce expense; transfers contribute neither income nor expense. Day markers distinguish `zero` and `unrecorded` from recorded spending.

Refunds can make a day or category's net expense negative. Charts must retain those rows with signed values and distinguish refund magnitude from positive spending; never clamp a negative number to a small positive bar or silently drop refund-only categories. Manual multi-entry and OCR candidates share explicit-confirmation/retry semantics; adding/removing rows preserves other mounted inputs and successfully committed rows are never re-created on a partial retry. Chinese search defers requests through IME composition and has a clear action.

Quick text accepts up to6000 characters and30 nonempty lines. Each line contains a restricted decimal +/- expression, whitespace and purpose (at most160 characters); amount characters may be normalized from fullwidth, but purpose remains plain text. Blank lines are ignored, invalid lines retain their physical line number, and only valid positive amounts contribute to the preview total. Errors block confirmation of the batch. This adds no ledger API or database schema; each submitted row still receives all normal server validation.

New daily templates set `financeEnabled:true`; a saved snapshot missing this flag remains disabled. Finance goes after energy. Bounded `financeDraft` now includes `text` (maximum6000 characters) alongside legacy `expression`, `purpose`, `categoryId`, `note` and `receiptIds`; normalization must preserve old drafts and backups. Nonempty text/expression/purpose/note or receipt IDs is pending input and must be confirmed or cleared before advancing/completing. The server ignores supplied `financeSnapshot`, captures its own snapshot during completion and checks finance-enabled daily record size after insertion. Locked reading must not fetch today's ledger.

Receipt prepare accepts `{id,hash,variants:{image:{bytes,type,sha256},thumb:{bytes,type,sha256}}}`. Originals never leave the device. Compressed image is at most2MiB, thumbnail96KiB; supported types are WebP/JPEG. A ticket signs exact type, byte length and base64 `x-amz-checksum-sha256` for a random account-scoped key. Browser sends the signed Blob without assigning the forbidden Content-Length header. Completion requires checksum-enabled HEAD, exact content length/type and actual SHA256 response; metadata alone is insufficient. Reads accept at most50 owned ready IDs and `variant:'thumb'|'image'`, returning five-minute URLs.

Storage endpoints are validated public HTTPS with existing DNS/SSRF safeguards. Recheck original session, storage identity and receipt after each network await. Changing bucket/directory cannot reinterpret existing keys. CSP reveals only the current account's configured storage origin. Ordinary login requests a document reload when that policy needs storage; reauthentication keeps unsaved content. Browser validates signed URL origin/namespace and rejects redirects. Thumbnails wait for viewport proximity; full-image reads belong to the exact preview modal and offer retry.

Personal/site backups include ledger tombstones, day state, categories, encrypted storage configuration and receipt metadata; image bodies stay external. Validate the resulting merged graph before commit, including pre-existing entries. Old backups without finance preserve same-identity surviving accounts' finance. Equal-version conflicts must fail rather than silently overwrite. Deleted refund history can retain its old reference; active refund relationships remain strict.

## 4. Validation / error matrix

| Trigger | Result |
| --- | --- |
| Invalid expression, purpose, category, date or refund reference |400; no entry/event |
| Missing/foreign entry or receipt |404; no ownership disclosure |
| Stale version or conflicting idempotency payload |409; retain editable input |
| Refund exceeds original or original has active dependent refunds |409; whole mutation rolls back |
| Zero marker contradicts spending |409; existing state retained |
| Unsupported/mismatched S3 checksum |409 `finance_receipt_incomplete`; not ready |
| Config/receipt changes during asynchronous verification |409; do not issue stale result |
| Quota or finance daily snapshot size exceeded |413; no partial record/event commit |
| Rate/concurrency limit |429; retry without creating a second logical entry |
| Legacy backup without finance |Restore existing domains while preserving same-account finance |

## 5. Good / base / bad cases

Good: `8+8+8-1` and “早餐” produces2300 cents, suggests food, and respects the final manually selected category. `60 打车\n50 吃饭` produces two preview rows,11000 cents and transport/food suggestions without writing. Repeating the same create ID does not duplicate the entry. An active refund cannot exceed the owning expense's remaining amount.

Base: no S3 config still permits manual entry/local OCR with an explicit no-stored-image warning. A saved review from before finance retains its old prompt order.

Bad: trust image metadata as a digest, auto-create OCR candidates, infer account identity from a request field, include image bodies in app backups, or silently change an old review snapshot after editing the ledger.

## 6. Tests required

- `finance-domain.test.mjs`: exact cents, restricted expressions, multiline totals/categories, fullwidth amounts, physical error lines, size/row limits, pending text and editable OCR candidates.
- `finance-api.test.mjs`: real HTTP isolation/encryption, retries/versions/refunds/zero, independent ledger lifecycle, completion snapshot/size rollback, personal/site restore and merged-graph validation.
- `finance-receipts.test.mjs`: signing, checksum HEAD, ownership, config/session races, safe endpoints and backup associations.
- `finance-ui.test.mjs`, `review-write-ui.test.mjs`, `review-wheel-flow.test.mjs`: real component-island forms, explicit confirmation, multiline partial success/retry identity, legacy draft metadata, pending-text save/navigation, stale modal/account guards, conflict refresh, old/daily flow input identity and existing wheel validation.
- `ui-choice-controls.test.mjs`, `ui-surfaces.test.mjs`: compact finance NativeSelect values/events without changing review choices, mounted period controls, browse-without-callback, one callback per real selection and stale/disabled ownership.
- `receipt-client.test.mjs`: actual browser-client paths with bounded image fixtures, cancellation/worker initialization, local resources, direct compressed PUTs, duplicate confirmation and validated private reads.
- `receipt-ocr-runtime.test.mjs`: load both packaged models and recognize synthetic23.00. Optional browser smoke is not a replacement for desktop/narrow visual and real-provider checks.
- Build and Docker smoke must include both server modules, all finance browser modules and local OCR manifest resources; production needs no cloud OCR credential.

## 7. Wrong vs correct

Wrong: increment a review field on every save and use it as the ledger; replace all receipt images with public links; accept `x-amz-meta-sha256` as actual integrity proof.

Correct: explicitly commit independent UUID entries, snapshot server-owned totals at lock time, authorize private short-lived URLs per account, and verify S3's actual SHA256 checksum before marking an upload ready.
