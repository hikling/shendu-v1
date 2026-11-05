# Independent review

Reviewed against the active PRD/design/implementation plan and frontend architecture, state/data, UI quality and component-island contracts. Baseline: `3f8ab1e`.

## Findings fixed

1. `shendu/public/app.js`, `renderBackup()` error surface: its Retry control was inserted asynchronously after `bindCommon()`, so the inherited `data-nav="backup"` attribute had no listener. Gave the newly inserted button the local `backup-retry` ID and bound only its click to `renderBackup()`. No global rebinding or API changes.
2. `shendu/public/workspace-pages.css`, <=820px users layout: grid cells activated at 820px while the preexisting table-to-card structure and labels activated only at 700px. Added the matching scoped table/tbody/tr structure, visually hidden table head, label pseudo-elements and full-width cells at the same 820px breakpoint. This removes the mixed grid-cell/table-row interval at 701-820px.

## Contracts verified in source

- Backup export/restore inputs, target actions and configured/available disable conditions retain their original IDs, file types and binding paths. Whole-site backup stays superadmin-only. The restore/encryption protocols and API payloads are unchanged.
- User search, registration, create/manage/delete controls and role/self/superadmin protections retain the original conditions and native attributes. `bindUsers`, deletion confirmation, user creation/reset and patch handlers are unchanged.
- Password inputs preserve names, required, 15/128 limits and autocomplete; new IDs connect their labels. Account/password/logout handlers are equivalent apart from formatting.
- Theme preview, cancel/reset/save and stage/template save/reset handlers are unchanged. `workspaceDialogHead()` retains `.modal-head h2/p`, so existing Dialog title/description extraction and settings back navigation still work.
- History filtering, search-caret restoration, source-return navigation and `data-open-record` IDs are unchanged. Artwork allocation still receives the complete record set before filtering.
- New art is local, decorative, pointer-inert and escaped. All seven `WORKSPACE_SCENES` assets exist. New CSS is restricted to history/workspace surfaces; overview, immersive review, actions and calendar behavior are unchanged.
- Fixed semantic workspace inks/backgrounds remain readable independently of a custom white accent. Shadcn hosts remain real ancestors; no new live DOM replacement bypasses `renderMarkup()`.

## Verification

- `npm run check`: pass after both fixes (the package's native JS syntax gate).
- `git diff --check`: pass after both fixes; Git prints the existing LF/CRLF conversion notice only.
- No standalone ESLint or TypeScript configuration exists in this JavaScript package. Production JSX compilation is part of the build/pretest workflow.
- Root owns final build, full tests, resource smoke, live browser and screenshots, spec synchronization and main/CI closure. This review does not claim those gates are complete.
- Root was asked to verify the backup 503/retry fixture and the users list at 820px, plus 1280/390/320px layout, decorative overflow, white theme, keyboard/dialog return and reduced motion.

## Findings not fixed

No further concrete code defect identified in the reviewed scope. Visual approval and final execution gates remain with root; they are not inferred from source inspection.
