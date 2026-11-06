# Deployment optimization validation

## Diagnosis and change

The supplied screenshot shows npm ci288s, a still-running Vite159s, and a Docker Hub layer455.8s. Timers overlap, so do not add them. Existing installation/update always selected a local Docker build with --pull. Host CPU/RAM and network were not directly measured. The default now performs zero host npm installation, frontend compilation or application image build. New clones also use --depth1. Exact source/platform local images are reused without an application download.

## Initial work commit and real publication

- Work commit `27b7c30eff487ce128ce06e3c7e1c8b1ae2ff563`.
- Application tree `caef846643f768369c5f872abfba7f6d5fa1a3ac`; docs/Trellis-only follow-ups retain this identity.
- [Initial CI42205173635](https://github.com/hikling/shendu-v1/actions/runs/42205173635): both native platforms passed59 isolated shell scenarios,179 application/DOM/HTTP/CLI tests, build, resolved Compose, real image health/static smoke and publication.
- [Public release](https://github.com/hikling/shendu-v1/releases/tag/deploy-caef846643f768369c5f872abfba7f6d5fa1a3ac): amd64 archive103,985,131bytes; arm64 archive102,802,905bytes; both SHA-256 files exist. Anonymous API metadata confirmed draft=false and four assets.
- Separate fresh native runners anonymously downloaded, verified, loaded and started the actual public archives, and reused each local image on the second call. The download/load/reuse/start/static step took11s amd64 /10s arm64 in GitHub CI. This is a CI measurement, not a promised deployment time on the user's connection.

## Regression coverage

Retained prior configuration/data/key/domain/Docker/backup failure cases. Added warm no-download/no-build reuse, download/invalid checksum/corrupt bytes/load/source-label failures preserving old selection, custom/symlink override refusal, ARM64 and unsupported daemon platforms, explicit-only source compilation, full update plus backup/health/UI, and corrupt-update rejection before replacing containers. Tests execute real scripts with isolated PATH mocks; no host packages or production data are changed.

Local full build/check179 tests, shell syntax, task manifests and diff whitespace checks passed. No application UI/source/content/data-model changes. Compose uses the same mounts, environment, private proxy trust and snapshot tooling. Partial downloads and generated selection use private temporary files; .env remains byte-for-byte unchanged.

## Final integration gate

Follow-up CI additionally exercises real generated Compose image selection, bind mounts, health and local UI, and an encrypted snapshot through site-backup.sh on both architectures. Final result will be recorded after the run. No live deployment is automatically changed by pushing main; transition instructions must load the new installer/updater rather than keep executing a previously self-copied build script.
