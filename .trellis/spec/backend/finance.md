# Finance ledger and receipt contract

## 1. Scope / trigger

Read this before changing finance persistence, daily finance completion, receipt storage, OCR packaging or their backup hooks. Schema9 is additive. Ledger entries are independent of review records: confirming an entry commits it immediately, and deleting a draft review cannot delete it. Daily historical content uses its completed snapshot.

## 2. Signatures

- `createFinanceLedger(deps)` in `shendu/finance-ledger.mjs` owns `finance_entries`, `finance_categories`, `finance_days`, account-scoped encrypted payloads and fixed activity events.
- `createFinanceReceipts(deps)` in `shendu/finance-receipts.mjs` owns `finance_receipts` and encrypted `finance_receipt_storage` settings. Its `handle(req,res,url,user)` follows the existing JSON/error contract.
- `GET /api/finance?month=YYYY-MM` or `date=YYYY-MM-DD`; optional `q`, `kind`, `category`, `cursor`, `deleted=1`.
- `POST /api/finance/entries`; `PUT /api/finance/entries/:id`; `DELETE /api/finance/entries/:id`; `POST /api/finance/entries/:id/restore`.
- `POST /api/finance/categories`; `PUT /api/finance/categories/:id`; `POST /api/finance/day`.
- `GET|PUT|DELETE /api/finance/storage`; `POST /api/finance/storage/test`; `POST /api/finance/receipts/prepare`; `POST /api/finance/receipts/:id/complete`; `POST /api/finance/receipts/read`.
- Browser `mountFinancePage(container,options)` and `mountDailyFinance(container,options)` return a disposable controller. `processReceiptFiles(files,options)` returns editable candidates, receipt IDs and warnings; it never writes ledger entries.
- Shared `parseFinanceLines(text,{categories,kind='expense'})` in `public/finance-domain.js` returns `{rows:[{line,expression,purpose,amountCents,categoryId}],errors:[{line,message}],totalCents}`. It is a pure preview parser; explicit confirmation still uses the existing entry endpoint per row.

## 3. Contracts

Entry creation supplies stable UUID `id`, real civil `date`, `kind` (`expense|income|refund|transfer`), `expression`, `purpose`, optional `categoryId`, `note`, `refundOf`, `receiptIds`, `source`. Restricted decimal +/- parsing produces positive integer `amountCents` in CNY; no eval or binary-floating-point sum. Mutations of existing entries supply `version`; identical create retries return the same entry. Categories are account-scoped, archived rather than removed, and historical labels remain readable.

The ledger response contains `{entries,categories,summary,trend,categoryTotals,expenseCategoryTotals,nextCursor,day}`. Period statistics ignore list search/type/category filters and deleted records. The list pages at50 entries. `deleted=1` includes active and deleted entries. `summary.balanceCents` is a period difference, never a bank balance. Refunds reduce expense; transfers contribute neither income nor expense. Day markers distinguish `zero` and `unrecorded` from recorded spending.

Refunds can make a day or category's net expense negative. Preserve signed net statistics; pie slices use only positive `expenseCategoryTotals`, with refunds and net expense shown separately in text even for a refund-only period. Never turn a negative net amount into a positive slice. Manual multi-entry and OCR candidates share explicit-confirmation/retry semantics; adding/removing rows preserves other mounted inputs and successfully committed rows are never re-created on a partial retry. Chinese search defers requests through IME composition and has a clear action.

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
- `ui-choice-controls.test.mjs`, `ui-surfaces.test.mjs`: genuine finance Select values/events/keyboard/reset/disabled semantics without changing review choices, mounted month/day controls, browse-without-callback, one callback per real selection and stale/disabled ownership.
- `receipt-client.test.mjs`: actual browser-client paths with bounded image fixtures, cancellation/worker initialization, local resources, direct compressed PUTs, duplicate confirmation and validated private reads.
- `receipt-ocr-runtime.test.mjs`: load both packaged models and recognize synthetic23.00. Optional browser smoke is not a replacement for desktop/narrow visual and real-provider checks.
- Build and Docker smoke must include both server modules, all finance browser modules and local OCR manifest resources; production needs no cloud OCR credential.

## 7. Wrong vs correct

Wrong: increment a review field on every save and use it as the ledger; replace all receipt images with public links; accept `x-amz-meta-sha256` as actual integrity proof.

Correct: explicitly commit independent UUID entries, snapshot server-owned totals at lock time, authorize private short-lived URLs per account, and verify S3's actual SHA256 checksum before marking an upload ready.

## Positive category shares and daily statistics

Scope: both category pies consume complete statistics from `GET /api/finance?month=YYYY-MM` or `date=YYYY-MM-DD`. `expenseCategoryTotals: [{categoryId,name,cents}]` aggregates all active expense entries in that period, independent of `q/kind/category/deleted/cursor`. Each trend row also exposes positive `spendingCents` to select the latest day with spending. Existing signed summaries and `categoryTotals` retain their meaning.

Validation and cases: the existing period validation and current-account filtering apply before aggregation. An empty or refund-only period returns no positive slices; a refund-only period still shows its refund and signed net summary. With 60 yuan transport, 50 yuan food and a 10 yuan food refund, positive shares total 110 yuan, refund is 10 yuan and net expense is 100 yuan. Income, transfers, deleted and foreign-account entries never contribute slices.

Required assertions: `finance-api.test.mjs` checks positive versus net totals, filtering/pagination independence and account isolation; `finance-ui.test.mjs` checks independent month/day loads, stale ownership, refunds, empty/error/retry states, stable category colors and unchanged mounted entry inputs. Wrong: sum visible entries or use the absolute net category amount as a slice. Correct: use complete positive category totals and keep refund/net text alongside the pie.


## Automatic category assignment on confirmed entries

1. Scope: live POST/PUT of a ledger entry with empty/omitted categoryId uses keyword recognition, then the full trimmed purpose (up to160 characters) as a fallback category name. Explicit valid IDs remain supported for manual corrections and legacy drafts. No UI category-management flow remains; existing category endpoints are retained for compatibility.
2. Signatures: public financeCategoryLabel(purpose,categories,kind) is a pure preview label; server automaticCategory resolves the same keywords and generates a random UUID for a new fallback name. No remote text recognition is used.
3. Contracts: category insertion uses the current account's existing encrypted finance_categories table inside the entry/activity transaction. Reads, previews, draft saves and receipt processing do not create categories. Repeated names reuse IDs by matching decrypted names per account; IDs must not encode or hash private purpose text; list/category aggregates see them after successful commit. The category cap matches50000 ledger entries plus built-ins, avoiding the old100-category ceiling for automatic purposes.
4. Validation/errors: explicit unknown/archived IDs retain existing400 checks; invalid receipt or refund aborts before insertion; quota/entry insert errors roll back both category and entry. Import accepts category names up to160 and the expanded bounded count; entries still require a category present in the imported graph.
5. Cases: 吃饭/聚餐/团建 map to餐饮, 修鞋 maps to修鞋, and unknown income稿酬 maps to稿酬. Historical explicit IDs stay intact. Unknown-purpose categories are ordinary encrypted categories, not public/shared records.
6. Tests: domain synonyms/pure labels, HTTP account isolation/encryption/retry/reuse, failed receipt/refund and forced-insert rollback, full-name encrypted backup/restore, and real UI multiline/detail/OCR payloads.
7. Wrong: create categories as the user types or POST a UI placeholder uncategorized for an automatic unknown purpose. Correct: send empty categoryId for automatic assignment and let the confirmed-entry transaction resolve it; freeze attempted rows during retries.


## Receipt storage test, disconnect and upload failure contract

### 1. Scope
Storage testing/deletion, image association recovery, and disconnected backups. Keep private S3 images external; never silently turn failed configured uploads into normal image-free entry candidates.

### 2. Signatures
- GET /api/finance/storage returns configured,disconnected,receiptCount,version,safe config or null,owned reusable targets.
- POST /api/finance/storage/test accepts the current unsaved PUT-shaped {config,reuseTargetId?,version?}; secret omission can reuse only the current account's saved secret. No configuration write.
- DELETE /api/finance/storage requires numeric current {version}; returns the same safe storage shape. PUT retains its current version checks.
- processReceiptFiles returns imageStatus stored|not_stored alongside candidates,receiptIds,warnings; configured upload/verification errors reject with receipt_upload_failed.

### 3. Contracts
The test uses a random small probe inside the actual receipt namespace, PUT/GET byte comparison/DELETE cleanup through pinned S3 requests, rate10/minute and existing bounded network concurrency. It does not claim browser CORS or actual receipt checksum support, does not save settings or log a successful usage action, and sanitizes provider errors. Revalidate the session and complete storage snapshot across awaits; cleanup still runs on failure or stale ownership.

Deletion clears credentials and pending receipt indexes, never external image objects or ledger rows. Ready indexes remain paired with an encrypted tombstone {version,config:null,storageIdentity:hash|null}. Ready images pin the old storage location; reconnect requires that identity, while updated credentials are allowed. No-ready disconnect permits correcting the location. hasReadyReceipt remains an ownership/readiness check independent of whether storage is connected, so existing ledger editing and backups remain possible. Signed image reads require active storage.

Backup validation accepts active or disconnected storage, validates the selected setting against the whole merged receipt graph before writes, and preserves private keys/namespace ownership. Replacing an existing setting increases its revision above both prior and incoming versions, including clearing from an old backup, preventing stale test/delete requests from matching a restored revision.

### 4. Validation/error matrix
- Missing/invalid/stale delete revision:409; no changes.
- Invalid draft endpoint/config:400; only owned reusable targets accepted; unknown target404.
- Revoked session401, changed settings409; no stale success.
- Probe failure or cleanup failure409 with safe message; rate/concurrency429.
- Reconnect wrong location with ready indexes409; receipt graph mismatch aborts restore.
- Failed configured upload never returns candidates ready for confirmation. Recognition-only candidates require explicit UI acknowledgment before text-only entry.

### 5. Cases
Good: test draft corrected credentials before saving, then upload real screenshot and confirm entry. Existing entry without image uses 补传截图 and explicit 保存修改, preserving all amounts/fields.
Base: disconnected account retains ready receipts and may edit ledger fields; viewing images resumes after reconnecting original location.
Bad: infer image associations from purpose/amount, remove external photos on config deletion, echo upstream credential errors, or report test success as browser upload compatibility.

### 6. Tests
Receipt service tests cover draft non-persistence, tiny probe readback/cleanup, failure/redaction, rate/concurrency, revoked sessions and revision races, disconnect/reconnect and pinned identity, merged restore and monotonic revisions. Finance HTTP tests cover auth, version, CSP and encrypted tombstone roundtrip. Client tests cover upload/verification rejection and per-image IDs even with no OCR amount. UI tests cover unsaved test fields and result invalidation, deletion confirmation, recognition-only acknowledgment, supplemental upload preserving existing entry/version and failure/cancel/stale owners.

### 7. Wrong versus correct
Wrong: catch image-upload errors as a warning and allow ordinary confirmation of a receipt-free candidate; style only new entries; clear storage by dropping version/history.
Correct: stop failed configured batches, explicitly distinguish text-only recognition, reuse the canonical detail variant for edit/refund, and retain versioned disconnected metadata without credentials.
