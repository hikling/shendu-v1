# Independent deployment cross-check

Read-only review of root `install.sh`, `shendu/scripts/install.sh`, `update.sh`, `prepare-image.sh`, `site-backup.sh`, `docker-entrypoint.sh`, `Dockerfile`, `compose.yaml`, `.dockerignore`, `.env.example`, and `Caddyfile`. Checked the existing Linux test/CI coverage without rerunning it locally.

No additional confirmed actionable security or logic issue was found in these paths.

- Install entry points require root, validate supported systems, domain syntax, repository identity/main/clean state for reuse, and existing key configuration. Existing `.env` is parsed as data, never sourced as shell. Fresh configuration is privately staged and published without replacement; existing data without configuration cannot trigger replacement key generation.
- Install/update share a directory lock. Updater self-copies before fetching, uses fast-forward-only changes, performs any selected snapshot before source changes, and does not replace running containers when image preparation fails.
- Image selection uses a validated immutable application tree ID, supported Docker architecture, HTTPS GitHub URL, bounded download time, SHA-256 verification, and matching loaded image label/platform. There is no implicit source-build fallback. Only verified local selection is atomically published; `.env` is not rewritten and linked/custom overrides are rejected.
- Snapshot password and output creation use private random adjacent staging and non-overwriting publication. Original password bytes are copied for the CLI, snapshot paths are generated rather than shell-interpreted, output is exposed only after a complete copy, and traps clean temporary secrets/partial results. The actual temporary directory cannot be selected as final output. Existing snapshot and key files are preserved.
- Runtime image copies explicit application inputs. `.env`, live data, temporary files, backups, and local generated build output are excluded from the build context. Entrypoint limits its ownership change to configured data/tmp mounts then drops to `node`; Compose does not publish the application port, sets no-new-privileges, and retains Caddy/data volumes.

## Operational boundaries to state accurately

- Failed image preparation preserves the original running application. Once Compose has replaced the application container, a failing health or UI check stops with diagnostics; the updater does **not** automatically roll back the container or database. Recovery follows the documented manual backup/rollback procedure.
- These shell scripts target the documented Linux/Debian deployment environment. This independent pass did not execute a POSIX shell or Docker locally. `.github/workflows/verify.yml` runs shell syntax/scenario checks and native amd64/arm64 image/download/snapshot verification; final CI status is coordinated by the root agent.
- Trusted administrator configuration, checked-out repository contents, GitHub release access, and the Docker daemon remain deployment trust boundaries. No deployed configuration, live database, storage endpoint, or production container was accessed in this review.
