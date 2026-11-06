# Fast deployment

## Problem and goal
User deployment screenshot spends 288 seconds in npm ci, at least 159 seconds building Vite, and about 456 seconds waiting on a Docker Hub layer. Fresh installs and updates always compile on the user's server. Remove npm/frontend compilation from the default deployment path and reuse an already installed identical image.

## Requirements
- Preserve approved UI/content, app behavior, .env/master keys/data, backups and existing root/domain/clean-checkout guards.
- Default install/update downloads a tested prebuilt Linux image anonymously, verifies checksum/source/platform, and starts it. Same source/platform reuses the local image without downloading or building it.
- Support amd64 and arm64, explicit source-build option, clear failure before replacing containers, no silent fallback to a lengthy build.
- Keep server health and real static resource verification; publish only after all CI checks pass. Update README/deployment/migration instructions and explain old updater migration.
- Test successful install/update/reuse and checksum/download/load/override failures in isolation, then verify real CI publication and anonymous artifact access.

## Acceptance
No default npm ci, Vite compilation or application image build on deployment servers. Linux scenarios and existing app tests pass; both platform images pass real-container smoke; public prebuilt assets exist for final application tree. Main and task closure synchronized, with honest network/time limitations rather than an invented speed guarantee.
