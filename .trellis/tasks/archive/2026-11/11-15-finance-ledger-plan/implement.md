# Implementation
1. Freeze shared API/types, implement cents/calculation/category/OCR-text pure helpers.
2. Parallel ledger/backend migration+backup; standalone UI+shared daily widget; receipt presigning+compression+local OCR provisioning.
3. Root daily prompt/template/draft/snapshot integration, approved art, asset cache/check lists and integrated UI guards.
4. Meaningful unit and real HTTP/DOM tests: exact cents, isolation, versions, retry/duplicate/refund/zero, locked snapshot, personal/site backups/tombstones, endpoint/receipt permissions and image limits, browser module consistency. Check/build/full tests and isolated local smoke/browser when available.
5. Independent cross-layer check; reconcile specs/README/UX; commit/pushmain, verify CI/downloads and latest-four release retention; archive/journal after acceptance. Clearly report unavailable real storage/network/visual acceptance rather than claim it.
