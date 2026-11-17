# Final scope review

No unresolved implementation blocker. Final integration review and checks were completed in the main session; independent helper/reviewer work covered the matcher and identified legacy receipt preservation before interruption.

## Fixed findings

- Finance Select portal z50 was below overlay95/dialog100. Real browser pointer hit-testing returned the overlay and kind stayedexpense. Scoped menu125 makes the actual option reachable and selection becomesincome. This also fixes category selectors in finance dialogs.
- Legacy draft screenshots must survive new matching; first planned row retains old IDs alongside its new matched screenshot. Per-row associations never receive the entire uploaded batch by default.
- Attempted create payloads are immutable across uncertain responses, modal reopen and retry. The underlying text/clear/category controls lock until resolution. A definitive400 validation rejection unlocks correction, including the current reconciled row object; uncertain/409 responses retain identity. Partial successes remove only their own physical lines.
- Removed obsolete manual expense-batch and recognition-only text confirmation paths. Income creation enforces income regardless of the hidden form field, and standalone screenshot creation enforcesexpense. Every submitted expense UI row requires stored receipts, at most10; unused pictures require acknowledgment.

## Review coverage

- Matcher: exact positive cents, bidirectional uniqueness, per-image dedup, saved-ID allowlist, expense candidates only, no approximate/subset-sum/positional guessing or input mutation. It does not assert storage readiness or payment settlement; UI requires stored status and confirmation, server retains receipt ownership/readiness checks.
- Income is blank and independent from expense drafts. Existing edit/refund API behavior and old receipt-free data remain compatible.
- Matching preview stays inline in its exact live form and has per-image request ownership; superseded/hidden/replaced/reauth responses stay silent. Saved associations are specific to each row. Cancel, upload failure, missing match and obsolete account create no expense writes.
- Actual app daily-save/wheel tests traverse upload and matching before clearing pending finance state; no test-only production bypass.
- New helper is included in syntax and deployed-resource smoke checks. Cache17 covers app, component CSS/bridge, finance UI/CSS, matcher and receipt imports.

## Evidence and limits

- Full suite:539 total,538 passed,0 failed,1 optional browser OCR smoke skipped. Final finance UI/matcher suite74/74 and syntax/diff checks passed after final labels/status updates.
- Desktop1280 and mobile390/320 synthetic browser flows: income enforces kind and preserves plan; text/upload create no premature expense; unique auto and unknown manual match work; missing mapping blocks; inline preview decodes a synthetic stand-in image; correct per-row IDs POST only after confirmation; no horizontal overflow or script errors. Actual menu pointer reachability verified.
- Tests use synthetic records/images, not live customer/provider data. No physical iPhone Safari or new live R2 upload acceptance in this task; existing provider/client tests remain green.

Final publishing gate: GitHub run44125803981 all six jobs succeeded on the final app tree; handover Python13/13 passed; exactly four complete releases remain and Git tags are intact.
