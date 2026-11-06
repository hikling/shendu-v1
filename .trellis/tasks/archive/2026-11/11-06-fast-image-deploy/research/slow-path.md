# Source diagnosis

- Screenshot: npm ci 288.0s; Vite build still running at159.0s; Docker layer55.57MB/57.38MB at455.8s. Parallel BuildKit timers overlap, so these must not be summed into an invented total.
- `scripts/install.sh` and `update.sh` both unconditionally call `docker compose build --pull shendu`. `compose.yaml` has only a build definition; no prebuilt application distribution exists. UI source changes invalidate Vite and new dependency/base-image states can invalidate installation layers.
- Source build caching alone cannot remove cold npm/CPU/RAM pressure from small deployment servers or a slow Docker Hub connection. Use the CI image as the server artifact; GitHub Release download uses the same public GitHub access already needed for repository installation.
- Preserve real browser resource smoke, previous backup safeguards and old configurations. No access to the user's server means exact CPU/RAM/bandwidth causes cannot be asserted; known script work and screenshot stage timings are sufficient to remove the confirmed repeated build cost.
