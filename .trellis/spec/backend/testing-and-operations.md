# Testing and Operations

From `shendu/`, install locked dependencies with `npm ci`, then run `npm run check` for server, browser script, and administration script syntax. `npm test` first builds the real shadcn React UI and runs the Node suite, including actual DOM compatibility tests. `shendu/tests/backup-security.test.mjs` starts a server against temporary data and checks account isolation, encryption, backup formats, restore transactions, and rollback. Files under `shendu/tests/fixtures/personal/` are compatibility fixtures.

For changes to encrypted fields, restore, sessions, or account ownership, update behavioral tests at the HTTP or helper boundary. CSS or layout-only changes need visual and interaction verification rather than selector-mirroring tests.

`README.md` documents local startup and deployed data/key locations; `UPGRADING.md` documents upgrade and rollback. `shendu/.env.example`, `shendu/compose.yaml`, and `shendu/Dockerfile` define configuration and deployment. Keep actual `.env`, `data/`, and backup keys out of planning artifacts and test runs. Preserve the production key path across upgrades.

The Docker builder runs `npm ci` and `npm run build`, then the native-server runtime copies `public/ui/` from it. Keep the UI source, Vite config, lockfile and license helper in the build context. `public/ui/` and `node_modules/` are ignored source artifacts. `npm run smoke:ui -- <base-url>` verifies health plus real HTML/JS/CSS MIME types and local component imports; do not accept a healthy backend with missing frontend resources. CI performs this against the built container.

## Backup tooling safety

`site-backup.sh [output-dir] [manual|pre-update]` is the shared server snapshot wrapper; `update.sh` delegates to it before fetching code when the user opts into a backup. Publish the first `data/server-backup.password` with an adjacent private temporary file and no-clobber hard link, so concurrent runs reuse the winning password. Never normalize the password file: the CLI removes exactly one final line ending, so copy original bytes to a random private per-invocation file. Clean temporary password/snapshot files on success and failure, and publish a backup output only after the CLI succeeds.

The final output copy must use private adjacent staging on the destination filesystem, followed by no-clobber publication only after the copy succeeds. A partial-copy/disk-full error must leave neither a final-looking backup nor its staging file. Reject an output directory physically equal to the application's transient `tmp` directory before password creation. This protects complete-file visibility; do not describe it as power-loss durability or live offline-restore safety.

CLI snapshot/migration output must not alias the active DB, SQLite `-wal`/`-shm`, original key or password file, including linked parent directories. Resolve path aliases before comparing. CLI restore is an offline administrator operation requiring a stopped application; checkpoint checks cannot prove an idle application has no open connection. Tests must exercise byte preservation and failed restore rollback with isolated data.

Keep `pinnedHttpsRequest` request and response error/abort handling symmetric: reject the operation directly and destroy the request even when it has already closed. Oversized and truncated responses must never settle as a successful external backup. Caddy receives only its domain, never the application's master key; enforce this on resolved Compose configuration in CI.

## Automated server installation contract

### 1. Scope and ownership

Root `install.sh` bootstraps a fresh Debian 12/13 Git checkout. `shendu/scripts/install.sh` owns configuration, missing Docker installation, build, startup and internal smoke checks. `shendu/scripts/update.sh` remains the code-upgrade owner. Installation changes must not edit application UI, runtime data, encryption or record behavior.

### 2. Signatures and inputs

`sh install.sh [domain] [install-dir]` defaults to `/opt/shendu-v1`. `sh shendu/scripts/install.sh [domain]` operates on its own application directory. Both require root and supported Debian. A fresh domain comes from the positional argument or terminal; noninteractive calls must supply it. Accept only a validated public ASCII hostname without scheme, path, port or placeholder. Read `.env` as configuration text, never shell source.

### 3. Data and configuration flow

Bootstrap downloads only the official `hikling/shendu-v1` `main` checkout or reuses a clean matching directory; it never pulls, resets or replaces an existing checkout. Create `.env` atomically with restrictive permissions only for a fresh deployment, using `.env.example` and a new 64-hex master key. Reuse existing `.env` byte-for-byte, including key and domain, and retain data, backups and Caddy volumes. An existing data file with missing configuration must stop before key generation. A `data` symlink (including a dangling link) with missing `.env` also stops; do not let directory traversal defaults hide old data. The bundled container upstream and health checks require port `3000`.

### 4. Validation and failure behavior

Reject unsupported OS, wrong repository/destination, dirty code, domain conflicts and unusable existing configuration. Reuse functioning Docker/Compose; stop for an incomplete existing installation instead of uninstalling packages. Download/clone/config/build/start/health/smoke failures return nonzero and never print an installation-success message. Suppress expanded Compose environment output. Diagnostics must not expose environment values or master keys.

### 5. Examples

Fresh interactive install: `sh install.sh`. Explicit unattended input/custom path: `sh install.sh review.example.com /srv/shendu-v1`. Already cloned: `sh shendu/scripts/install.sh review.example.com`. Existing site upgrade: `sh /opt/shendu-v1/shendu/scripts/update.sh /opt/shendu-v1`.

### 6. Verification

`sh shendu/tests/install-script.test.sh` runs isolated Linux behavior scenarios with temporary data and command mocks; never run a real package installer or point at production data in tests. CI must run these scenarios and POSIX syntax checks in addition to the existing application build/tests and real Docker image/static-resource smoke. Keep shell source LF via `.gitattributes`.

### 7. Common mistakes

Do not generate a fresh key because an old `.env` is missing, replace an existing `.env` to change domains, source `.env`, print full `docker compose config`, execute a failed download, or use a fresh-install rerun as a code update. Container-local smoke validates the app and assets, not public DNS/TLS; report the HTTPS address while explaining that Caddy certificate issuance needs reachable DNS and ports.
