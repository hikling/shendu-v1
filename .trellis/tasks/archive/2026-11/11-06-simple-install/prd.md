# Simplify installation

## Goal
Give a fresh Debian 12/13 server one installation command and one domain question. Remove the README showcase photo and synchronize deployment instructions.

## Requirements
- Automatically download the project, prepare missing dependencies, configure the domain and random master key, build, start, and verify the service.
- Reuse a functioning Docker Engine and Compose installation.
- Repeated runs preserve existing .env bytes, master keys, database files, backups and Caddy volumes; conflicting arguments or missing configuration over old data stop safely.
- Keep existing update and migration paths available.
- Explain prerequisites, completion, reruns and failure recovery without requiring manual environment-file editing for a fresh install.
- Do not change application source, UI, illustrations, business behavior, database or encryption.

## Acceptance
- Documented root installation command works on supported Debian systems with curl; missing curl has a short prerequisite command.
- Fresh install asks only for a domain (or accepts a positional domain), then starts the stack and checks health plus frontend resources.
- Failure to download, clone, build or pass health checks returns nonzero without claiming success; repeated setup cannot generate a new key over old data.
- Automated isolated Linux tests cover install, rerun preservation and key failure paths. Existing build, syntax, tests and container smoke checks pass.
- README has no showcase photo; deployment docs match the script interface. Commit and synchronize main.
