# Frontend Guidelines

Shendu's browser UI combines a native JavaScript single-page application with genuine shadcn React component islands. Read these guides before changing `shendu/public/` or `shendu/ui/`.

Read the user-confirmed product direction in [`PRODUCT.md`](../../../PRODUCT.md) before planning new screens. This product brief defines outcomes; the files below describe current code conventions.

## Pre-development checklist

1. Read [Architecture](./architecture.md) for rendering and event binding.
2. Read [State and data](./state-and-data.md) before changing forms, navigation, or save behavior.
3. Read [UI quality](./ui-quality.md) before changing layout, category colors, or dialogs; for six-review positioning also read [Review composition](./review-composition.md).
4. Trace any changed record payload or completion rule through `shendu/server.mjs`.
5. For weekly, monthly, quarterly, yearly, or decision pages, read [Extended review flows](./extended-review-flow.md) before changing prompt order or validation.
6. For history, workspace, authentication and confirmation surfaces, read [Archive and workspace UI](./archive-and-workspace-ui.md).
7. Read [Component islands](./component-islands.md) before rendering, controls, dialogs, calendars, or build changes.

## Quality check

- Run `npm run check` in `shendu/`.
- Check affected routes at desktop and narrow mobile widths, including keyboard focus, drawers, dialogs, fixed category colors, ignored legacy color preferences, and reduced motion.
- For review forms check new, dirty, saved, locked, and historical read-only records.
- Run `npm test` when API, persistence, security, or backup behavior changes.

## Guides

- [Architecture](./architecture.md)
- [State and data](./state-and-data.md)
- [UI quality](./ui-quality.md)
- [Extended review flows](./extended-review-flow.md)
- [Component islands](./component-islands.md)
- [Archive and workspace UI](./archive-and-workspace-ui.md)
