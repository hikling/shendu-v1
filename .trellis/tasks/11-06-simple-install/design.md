# Design

## Boundary and owner
The gap lives in server setup: the old installer stops after preparing Docker and .env. Change only root install.sh (new bootstrap), shendu/scripts/install.sh (orchestration), deployment tests/CI, README, deployment/migration docs, LF attributes and operations spec. Existing update.sh and application/container configuration remain unchanged.

## Interface and flow
- Root install.sh [domain] [install-dir], default /opt/shendu-v1. Downloaded independently and run with sh. Root and Debian 12/13 required. Install missing Git/CA certificates via apt, clone main from the fixed official repository, then delegate to shendu/scripts/install.sh [domain].
- Existing destination must be a clean main Git checkout of hikling/shendu-v1 with expected installer files. Never pull, reset or delete it in bootstrap; rerun delegates existing code. Updates use the existing update script.
- App installer validates domain/configuration before installing Docker. A fresh domain may come from an argument or terminal prompt (stdin TTY or /dev/tty); noninteractive runs without a domain fail clearly. Accept a public ASCII hostname, no scheme, path, port, wildcard or example placeholder; normalize case. Do not source .env as shell code.
- If .env is absent, reject existing data files/master key rather than generating a replacement. Create .env atomically with mode 600 from .env.example, replacing domain and key. Existing .env remains byte-for-byte unchanged; reject a conflicting domain argument or unusable key/port/domain configuration rather than editing it.
- Reuse Docker/Compose when present. Otherwise install only on supported Debian from the Docker official source (stop for partial/incompatible existing Docker instead of removing packages). Start daemon if necessary. Keep application port 3000 and current mounts/volumes.
- Compose validate with output suppressed, build while any old container stays running, start with bounded Compose --wait, then run the existing Node smoke-ui script inside the application container against http://127.0.0.1:3000. Show HTTPS URL and existing update command. Internal smoke does not assert public DNS/TLS; explain Caddy may still be obtaining its certificate.

## Tradeoffs and compatibility
Keep local Docker builds and Caddy HTTPS; no registry publishing, new runtime dependency, UI changes or new management framework. Shell scripts are POSIX sh with LF endings. Installer does not update code or migrate old ZIP installs. Failures preserve config/data for retry and show short diagnostic commands without dumping environment secrets. Existing deployment must continue using update.sh.

## Verification and rollback
Linux behavior tests copy scripts and fixtures into temporary trees with mock apt/docker/git/openssl, never touch host packages or real data. CI runs them before existing app/container checks. Revert deployment source commit to roll back tooling; do not roll back or regenerate data/config.
