# Deployment and dependency review

Root reviewed root install.sh, application install/update/prepare-image/entrypoint/site-backup integration, Compose/Caddy/Dockerfile, build/OCR/license preparation, public docs and handover packager. No production host/account/secret/bucket was accessed.

Confirmed P2: update.sh checked main/clean clone/application shape but unlike bootstrap did not validate origin. A similarly shaped unrelated checkout could fetch/merge another repository then run its prepare-image script as root. Added the existing official HTTPS/SSH allowlist before lock/backup/fetch/Docker. The Linux scenario asserts wrong origin causes no snapshot/fetch/Docker, unchanged .env and no lock. Local POSIX syntax passed; full Linux scenarios will be verified in native CI (no Linux subsystem available locally).

Reviewed preservation: update copies itself before fast-forward, shared pre-update snapshot, managed image override publishes only after checksum/platform/source-tree verification, warm reuse and explicit source build, no automatic source fallback, health/UI checks after switch. Startup failure does not automatically restore DB/container; docs remain explicit. Root README now gives a set-eu subshell + EXIT cleanup downloaded-updater command, custom directory, backup/key/image boundaries, post-update checks and refresh. Local shell parser accepted changed updater/test source.

Registry checks2026-11-18: production dependency audit0. All dependencies have one real advisory GHSA-fc5q-39xc-vjpf (CVE-2026-112366), propagated to4 package nodes picomatch/fdir/tinyglobby/vite. Official advisory updatedNov17 says <=4.0.7 vulnerable, no patch. Registry latest is4.0.7. Vite is build-only, static repository globs, no website-user glob input; production runtime has no node_modules build chain. Did not apply suggested Vite downgrade6.2.7. Record as an unresolved development-chain advisory, not a clean all-dependency audit. Source: https://github.com/advisories/GHSA-fc5q-39xc-vjpf

Tracked-file high-confidence key/token pattern scan returned0 matches (private key headers/GitHub PAT/OpenAI/AWS IDs); output recorded filenames only, no secret values. This is not a full secret-history guarantee. No history rewrite requested.

Repository cleanup will happen only after final application release success. git rm --cached preserves local contents. Compare tracked directory file hashes before/after, anchor ignored paths, preserve tags and same shendu tree. Public docs remove broken development-directory links and explain no automatic future builds.
