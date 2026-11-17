# Full-scope review — 2026-11-17

## Findings fixed

- `shendu/tests/finance-receipts.test.mjs`: the new restore tests passed a bare `true` to `importUser`, whose options contract is `{replace:true}`. Corrected all three new calls so the legacy-path restore test exercises replacement restoration rather than silently falling back to merge behavior. Production code was unchanged by review.

## Review conclusions

- New screenshot and thumbnail keys keep the existing account namespace, receipt UUID and random upload-revision UUID. Same-day images share a single Beijing date directory. Recompression still changes both keys and old completion tickets still fail version checks. No change to R2 actual-byte proof, ordinary S3 checksum proof, ownership, session/storage rechecks, encryption or private signed reads.
- Import validation accepts both legacy receipt/revision directories and flat day filenames, validates real civil dates and type/variant suffixes, and rejects foreign namespaces before writes. Existing ready objects are never relocated or deleted. Corrected replacement-restore tests and the existing retry/race tests pass.
- Mobile font rules and the font stylesheet import are confined to <=960px. They select a distinct local `Shendu Songti` family, so missing device Songti installations cannot silently select Android's default sans family. Font-only declarations preserve heading geometry; desktop font rules remain untouched. Static server WOFF2 MIME, same-origin CSP and Docker public asset packaging already support the added resources.
- All 101 font CSS references are local and resolve to WOFF2 files. Independent binary verification matched every manifest length and SHA-256. Font implementation owns final coverage/provenance reconciliation; documentation must reflect any repaired files and final byte count.
- Ledger expressions are removed only from list presentation. The edit form and stored expression remain unchanged; refund association text, amount formatting, receipt controls and existing action paths are retained. Amounts and ledger text are larger; long monetary strings have a mobile single-column fallback while staying aligned at the right edge.
- HTML/app imports have new cache revisions for every changed runtime stylesheet/module. The component bundle did not change, so its existing cache revision is retained.

## Verification

- `npm run check`: passed in this review. This package has no separate ESLint or TypeScript gate.
- `node --test tests/finance-receipts.test.mjs`: 27 passed, 0 failed after the restore-test correction.
- `git diff --check`: passed.
- Parent full test log inspected: 511 discovered, 510 passed, 0 failed, 1 optional browser OCR smoke skipped. Parent owns final UI source smoke after its latest long-amount adjustment.
- Parent owns actual IAB mobile/desktop rendering acceptance. This review did not claim a physical Android/iOS-device test or real-provider upload/migration.

## Documentation synchronization

Parent replaced README's old local-font-only statement and the component guideline's inheritance-only rule. UI-quality now records real CJK-font availability checks and the readable ledger/long-amount contract. Font provenance reflects the final 6,030,988-byte total, matching the independently verified manifest. No unresolved production-code or documentation blocker was found.
