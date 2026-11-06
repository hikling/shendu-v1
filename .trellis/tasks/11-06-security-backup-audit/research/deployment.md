# Deployment and operations security audit

## Coverage

| Files | Reviewed boundaries and result |
| --- | --- |
| `install.sh` | Root/Debian guard, positional arguments, absolute destination, existing-folder/source/branch/dirty checks, quoted Git calls, clone failure, no code reset/pull on rerun. No shell evaluation of domain or paths; fixed repository URL. Host administrator's control over a locally modified checkout is a trusted capability, not a remote attack. |
| `shendu/scripts/install.sh` | Domain normalization/validation, text-only dotenv parsing, key syntax, missing-config/old-data guard including symlinks, atomic configuration, shared update lock, dependency reuse, Docker source, bounded health wait and actual UI smoke. Tightened atomic publication with `ln -T` so a directory created at the destination cannot be treated as a target directory. |
| `shendu/scripts/site-backup.sh` | Password lifecycle/permissions, concurrent first creation, password byte preservation, temporary names, secret output, live/fallback containers, publish-only-after-success and cleanup. Concrete fixes below. |
| `shendu/scripts/update.sh` | Temporary self-reexecution, lock, Git clean/main/ff-only update, optional snapshot before fetch, unchanged config/data, no container replacement before successful build and health timeout. Removed duplicate snapshot/password implementation in favor of the reviewed site-backup helper. |
| `shendu/scripts/docker-entrypoint.sh` | Restrictive umask, bind-directory setup/ownership, final `su-exec node` and argument-preserving `exec`. Root startup is needed to repair bind mount ownership; runtime is unprivileged. Host-provided environment and bind roots are administrator-trusted. |
| `shendu/Dockerfile` | Locked npm installation and separate frontend build; native Node runtime with local JS/CSS and smallest necessary Alpine runtime packages; no runtime Node modules/CDN; health check fixed to container 3000. |
| `shendu/compose.yaml`, `shendu/Caddyfile`, `shendu/.env.example` | App has no published host port; private network upstream and Caddy HTTPS/volume persistence; bounded container logging; app no-new-privileges. Isolated proxy env from app secrets. Explicit proxy trust is coordinated with root's HTTP fix. Kept application port/mounts/volumes unchanged. |
| `shendu/.dockerignore`, `shendu/.gitignore`, root attributes | Database/tmp/backups/env excluded; compatibility fixtures retained; shell LF. Added `.env.install.*` exclusion so a killed installer cannot accidentally send or commit a temporary master-key configuration. |
| `.github/workflows/verify.yml`, `shendu/tests/install-script.test.sh` | Ubuntu-only isolated PATH mocks avoid actual package/container changes. Reviewed shell syntax/real mocked behavior and existing true-image smoke. Added syntax checks for update/snapshot/entrypoint and JSON-level resolved-Compose env assertions. |

## Confirmed findings and changes

### 1. First snapshot password could be overwritten concurrently

Both update and manual snapshot scripts previously performed `if ! -f password; openssl ... > password`. Two first-time invocations can both pass the existence check; one can overwrite the password after another snapshot has encrypted with it. The persisted password would then fail to recover that snapshot. New-password publication now uses a 600-mode adjacent `mktemp` and a no-clobber hard link, and a loser reads the already-published winner. Update invokes this shared helper rather than maintaining a second implementation. This also removes 29 lines of duplicate snapshot orchestration.

The snapshot's per-invocation password copy now uses `mktemp` rather than a PID-only predictable filename, and the output filename includes the same random token. Cleanup is installed before any temporary password is created.

### 2. Shell password normalization could change the decryption password

`tr -d '\\r\\n'` removed embedded line breaks before manual backup, whereas the CLI password reader removes only one final line ending. A manually maintained password file with embedded newlines could create a snapshot that its original file could not decrypt. The script now copies the exact original password-file bytes to the private container temporary file. Existing passwords are never rewritten; argv/log output never contains password values.

### 3. Reverse proxy unnecessarily received the master key

Caddy used the entire application `.env` as `env_file`, including `SHENDU_MASTER_KEY`. It only needs a hostname. Caddy now receives only `SHENDU_DOMAIN`; the application retains its existing environment. This reduces secret exposure to the public-facing proxy process. CI inspects resolved Compose JSON and fails if another proxy variable is introduced. Root separately owns the explicit proxy-trust application security change.

### 4. Interrupted install configuration could enter Git/build context

An installer killed before its trap executes can leave `.env.install.*` beside `.env`. The file contains the random master key. Both ignore files now exclude that temporary pattern, complementing restrictive file permissions and normal cleanup. Configuration publication uses `ln -T --` to enforce a file destination.

### 5. Failed final copy could leave a truncated backup with a valid-looking name

The script originally copied the completed container snapshot directly to its final `.shendu-db` output. An `install` failure after partial writes (for example disk full) could leave a truncated final file despite returning nonzero. It now copies into a private `mktemp` in the destination directory and publishes the complete file atomically through a no-clobber hard link; cleanup removes the staged file on error. Existing output collisions remain untouched, and the source snapshot already uses the CLI's fsynced atomic writer. Canonical output equal to the application's temporary directory is rejected before password creation, preventing source/output aliasing and cleanup of a requested final backup. This guarantees complete-file visibility on successful copying; it is not a claim of full filesystem durability across sudden power loss.

## Regression verification

- Existing isolated installer scenarios retained (fresh install, Docker reuse/install/start, quoted nonexecuted dotenv, no-domain/non-TTY, old data/symlink protection, invalid domain/key/port, failed download/build/health/smoke, checkout/root/OS checks).
- Nine added scenarios cover private password/output publication and cleanup; exact multiline password-file bytes; deterministic concurrent publication winner; temporary-container fallback using the same password; failure with no partial output/secret temp; partial destination-copy failure with staged-output cleanup and unchanged recovery password; rejecting the staging directory as final destination; update snapshot success before fetch; required snapshot failure preventing Git/container mutation.
- CI now checks every deployment shell file with `sh -n`; resolved Compose ensures Caddy sees only the hostname and the private app explicitly opts into Caddy forwarding trust.
- Local bundled POSIX shell syntax checks and `git diff --check` pass. Complete behavior tests require Ubuntu CI; no real apt, Docker, production files or live deployment were used locally.

## Retained code and limits

The existing self-reexecution/update lock, Git-only test hook, old data/key checks, temporary-container backup fallback, Caddy certificate volumes and runtime ownership repair are used safety/compatibility paths and were retained. No speculative code deletion or UI change. Host administrator-provided arbitrary paths/environment remain trusted; this audit does not claim resistance to an administrator deliberately replacing scripts, Docker mounts or Git configuration. Public DNS/TLS is external to isolated installer smoke.
