# Frontend audit and repair boundary

## Confirmed findings

- Admin create/reset/delete dialogs sent duplicate writes and applied a late result to whichever modal was currently open. A deferred request reproduced two creates from repeated submit and the old create closing a newer password-reset dialog.
- Public-registration changes did not serialize writes or restore the checkbox after failure. Rejecting a request to close registration left the UI showing closed registration despite the server retaining the prior open setting.
- Member status/role mutations lacked page/account ownership checks before notification and refresh.
- Review save/completion assigned late responses into global current-record/cache state and unconditionally released the saving flag. Ordinary navigation already blocks while saving; forced page/account replacement reproduced the stale write, so this is defense in depth rather than a demonstrated normal-navigation exploit.
- Cross-review found that awaiting stats before committing a successful lock allowed the real request helper's stats401 to open reauthentication and invalidate the old confirmation owner; the server had locked the record while the browser still held a draft. Completion now commits and renders the locked record immediately, then refreshes optional statistics independently. The real request helper takes an optional owner predicate to suppress stale401 reauthentication side effects for the audited writes.

## Change boundary

The behavior lives in app.js admin event bindings/mutations and saveCurrent/completeCurrent. Repair only those functions and their narrowly shared admin task helper. Reuse dialogWriteTask for modal writes; keep existing API payloads, permissions, templates, prompts, flow state and visual design. Add admin-write-ui.test.mjs and review-write-ui.test.mjs using the actual shadcn bridge. Update any existing extracted-function fixture only if its dependency list requires it. No server or release changes in this ownership area.

## Review coverage and limits

Inspected interpolation of record, template, backup, actor and account values; no concrete unescaped user-authored HTML injection was established. Current verification/backup dialogs and activity loads already carry owner guards. Stable saved-record introductions are keyed by category and ID and do not require another change. This is a targeted source audit and isolated regression exercise, not proof that every possible vulnerability is absent.

## Validation

Final integration also updates the header pending count only for accepted completion stats, without remounting the locked editor. Version-conflict refresh propagates its account/caller guard to all three HTTP requests, preventing late refresh 401 responses from opening reauthentication for another account. Two additional actual-component regressions passed; the final review-write file has 16 cases.

Implemented scoped member-page and review write owners, reused the shared modal write task for create/reset/delete, restored the visible registration state after failure, and made the shared modal task preserve a newer non-modal writer's busy state. API payloads, role boundaries, input constraints, review fields, prompts and visual design remain unchanged.

`node --test tests/admin-write-ui.test.mjs tests/review-write-ui.test.mjs tests/auth-ui.test.mjs tests/backup-ui.test.mjs tests/verification-ui.test.mjs tests/settings-motion.test.mjs tests/account-workspace.test.mjs tests/backup-target-schedule-ui.test.mjs tests/ui-overlay-inert.test.mjs` passed **61/61** on 2026-11-13. This includes 10 administrator-write and 11 review-write cases using actual application functions and the built shadcn component bridge. The three added shared-helper regressions start a later account-password, member-status or review-save task, finish the obsolete modal task, and prove that the later task remains busy until it completes itself.

The six review editors retain the mounted input, first-save ID, prompt and payload. Save-before-complete posts only the returned original record ID; stale save/complete/stats responses cannot update a replacement owner. Optional stats failure still finishes a successful lock. A real version-conflict refresh replaces the user object while retaining dirty inputs and releasing its own editor/confirmation correctly.

After the cross-review follow-up, the administrator/review/authentication/verification selection passed **30/30** (including three new real request/reauthentication cases; the review-write file now has14 cases). A delayed stats401 after successful completion preserves the locked cache/current record before and after login; stale stats401 does not open a reauthentication dialog over a replacement account, page, record or modal. Current save401 preserves unsaved input behind reauthentication; stale save401 produces no replacement-account UI side effects. These tests exposed and cover the Radix empty-root replacement boundary: optional stats compare the connected current modal-root node, not just null modal contents inside an obsolete node. Difference and syntax checks are part of the parent's integrated verification. Parent runs the final full suite and deployment CI separately.
