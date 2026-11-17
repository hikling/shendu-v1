# Final code review — 2026-11-17

Reviewed the complete task changes against the PRD/design/implementation plan, official-provider research, backend finance/security/operations and frontend state contracts. Existing unrelated work was preserved. No commit or push was performed by this reviewer.

## Findings fixed

- `shendu/finance-receipts.mjs`: the completion error path could replace a failed GET with a generic integrity error before noticing a revoked session or changed setting/receipt revision. It now rechecks the current owner before returning the sanitized generic error. Upstream errors cannot override the current401/version conflict or leak raw provider messages.
- `shendu/tests/finance-receipts.test.mjs`: added focused regressions for rejecting R2 HEAD metadata mismatches before GET, logout/same-config restore/receipt revision changes during both successful and failed GETs, and S3 helper response-limit validation/forwarding. Tests also verify R2 HEAD omits checksum-mode while ordinary S3 retains it and the existing1MiB default.

## Cross-layer checks

- Native R2 detection requires HTTPS and the real hostname suffix; endpoint lookalikes and custom domains do not enable the exception. R2 PUT retains signed content length/type/digest metadata, but actual bounded object bytes are required to prove integrity. Missing, corrupt, truncated, non-Buffer and oversized readback bodies cannot mark a receipt ready.
- Ordinary S3 retains the original signed checksum header and mandatory checksum-enabled HEAD proof. No permissive missing-checksum fallback was introduced.
- Each R2 GET uses the declared bounded variant size; the server helper validates and forwards the limit into the pinned HTTPS reader. Receipt data, complete stored setting snapshot/revision and current session are checked across network awaits and before the ready write. Readback bytes remain transient; no image disk cache or schema changes.
- Client failures retain cancellation/current-owner behavior and identify prepare, clear-image, thumbnail or verification stages through safe copy/status only. Tests prove raw provider URLs/signatures are not displayed. Existing partial-confirmation and no-image rules remain intact.
- The versioned entry/bridge/finance/client references use finance9. Backend and user documentation describe both verification modes, private CORS setup and limits. The Docker runtime already includes the affected backend module; no new build input or dependency was introduced.

## Verification

- `npm run check`: PASS after the review fix. No standalone ESLint or TypeScript configuration exists; the syntax gate and JSX build are the project checks.
- Focused final tests:38 passed,0 failed (21 receipt-service/helper tests plus17 client tests). Output: ignored `local-data/reviewer-targeted.log`.
- Parent's first full production-build/test run passed493 assertions with1 expected existing opt-in Chrome OCR skip (494 discovered), before the final catch/race regressions. Parent is running the full suite again on the final files and will append its exact final count; this report does not treat the earlier run as final-snapshot verification.
- `git diff --check`: PASS. Parent owns handover/resource smoke and final release verification.

## Findings not fixed / limits

No blocking code finding remains from this review. Real R2 credentials, provider requests and browser/CORS acceptance were not available or performed. Tests establish application behavior and expected protocol handling, not the user's actual production failure stage. The supplied exact-origin CORS policy still needs to be applied to the user's bucket; no bucket setting was changed here.

Parent final-snapshot verification: production build, npm run check and full suite PASS with497 discovered,496 passed,0 failed,1 existing opt-in Chrome OCR skip. Handover13 and isolated HTTP/static-resource smoke PASS. No code changes followed these checks; source cache revision remainsfinance9.
