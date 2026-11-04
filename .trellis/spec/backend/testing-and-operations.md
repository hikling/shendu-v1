# Testing and Operations

From `shendu/`, install locked dependencies with `npm ci`, then run `npm run check` for server, browser script, and administration script syntax. `npm test` first builds the real shadcn React UI and runs the Node suite, including actual DOM compatibility tests. `shendu/tests/backup-security.test.mjs` starts a server against temporary data and checks account isolation, encryption, backup formats, restore transactions, and rollback. Files under `shendu/tests/fixtures/personal/` are compatibility fixtures.

For changes to encrypted fields, restore, sessions, or account ownership, update behavioral tests at the HTTP or helper boundary. CSS or layout-only changes need visual and interaction verification rather than selector-mirroring tests.

`README.md` documents local startup and deployed data/key locations; `UPGRADING.md` documents upgrade and rollback. `shendu/.env.example`, `shendu/compose.yaml`, and `shendu/Dockerfile` define configuration and deployment. Keep actual `.env`, `data/`, and backup keys out of planning artifacts and test runs. Preserve the production key path across upgrades.

The Docker builder runs `npm ci` and `npm run build`, then the native-server runtime copies `public/ui/` from it. Keep the UI source, Vite config, lockfile and license helper in the build context. `public/ui/` and `node_modules/` are ignored source artifacts. `npm run smoke:ui -- <base-url>` verifies health plus real HTML/JS/CSS MIME types and local component imports; do not accept a healthy backend with missing frontend resources. CI performs this against the built container.
