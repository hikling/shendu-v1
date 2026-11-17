# Final review

Reviewed the complete change set against the task PRD/design/implementation plan and frontend/backend quality gates. No unresolved blocking defects remain.

## Findings (fixed)

- `shendu/public/finance-domain.js`: old purpose-only custom names still participated in substring scoring after the initial exact-match compatibility fix. Reproduced `买东西买药` / `网购买东西买药` selecting an old `买东西` category and `超市买菜刀` selecting an old `超市买菜` category. Coordinated the fix with the owning implementation agent: concrete built-in intents exclude empty-keyword custom names from the scoring pass; general shopping channels remain fallback evidence. Added domain and real API regression coverage. Explicit IDs, configured custom keywords, inactive categories and historical category objects remain intact.
- `.trellis/spec/frontend/state-and-data.md`: the list-filter description still mentioned category filtering. Root synchronized the description with the removed filter while retaining backend query compatibility.

## Findings (not fixed)

- Known deployment-boundary limitation in the existing idempotency contract: a request with an automatic empty `categoryId` that committed under the previous categorizer but lost its response can return safe `409 finance_id_conflict` if retried after a rule upgrade resolves a different category. Existing rows remain intact and duplicate creation is prevented. Root recorded this in the design; changing the original-request hash contract or migrating data is outside this UI/classification task. Ordinary unchanged-rule retries retain their existing coverage.

## Scope and behavior checked

- Purpose, kind/category capsules and the shared bottom footer keep monetary expressions out of the purpose text. Signed values and refund association remain intact.
- List markup and lifecycle contain no thumbnail observer, thumbnail authorization or image download. The receipt link resolves the exact clicked entry before opening its gallery, so shared receipt IDs cannot substitute another entry's metadata.
- Gallery previous/next/retry work is bound to the live workspace, exact modal/view and a fresh read owner. Old authorization responses, image events, replaced/closed dialogs and reauthentication cannot modify the current surface. Existing private URL validation remains in the receipt client.
- `finance-image-dialog` opts out of generic dialog decoration; generic confirmation/authentication behavior is unchanged. The hidden-navigation rule remains effective for single-image entries.
- Removing category filtering includes markup, filter state, request query and binding. Search composition/focus, kind, deleted-state, pagination, entry correction selectors and complete-period chart statistics remain supported.
- Shared matching is used by line entry, detail previews, OCR and server inference. Saved manual IDs are preserved, unknown purposes create/reuse categories only on confirmed writes, and no historical reclassification or storage migration occurs.
- Cache revisions cover the shell app, finance CSS/UI, receipt client and shared categorizer. Mobile Songti assets/styles and desktop typography are untouched.

## Verification

- Reviewer: `npm run check --prefix shendu` passed on the final shared code. This project has no separate lint/type-check command; its configured check validates JavaScript syntax across the server, browser and tools.
- Reviewer: `node --test shendu/tests/finance-domain.test.mjs` passed **13/13** on final matching behavior.
- Reviewer: `git diff --check` passed. Git's LF/CRLF normalization notices are not whitespace failures.
- Implementation agent: final domain/API suites passed **34/34** including persisted category selection, manual/history preservation and the reproduced substring cases.
- Root: affected finance UI and actual-overlay suites passed **66/66** before the final domain-only refinements; final complete `npm test` is owned by root and must finish before publishing.
- Root browser evidence (`local-data/browser-results.json`): real production assets with the actual shell/modal wrapper and synthetic entries at **1280/390/320px** show no horizontal overflow, equal **14.4px** action/link typography with matching footer bottoms, no list images or pre-click receipt reads, art-free contextual previews, working gallery navigation, correct shared-receipt entry metadata, inert background and no script exceptions. This is local synthetic-data acceptance, not a live S3 or production-account test.
