# Execution

1. Trace screenshot timing and default install/update build paths; record baseline.
2. Implement shared image preparation/cache/checksum/platform/atomic override; wire install/update, preserve snapshot and health gates. Add BuildKit dependency cache and runtime source label.
3. Extend isolated Linux tests for default no-build, warm reuse, failed and corrupt downloads/load, wrong architecture/label, override protection, unchanged keys/data and full update flow.
4. Build/test both native Linux architectures; publish checked image archives via CI; validate anonymous download and real Docker load/start/reuse.
5. Sync deployment/README/migration/spec contracts and evidence. Commit/push main, confirm exact source artifacts/CI, archive and journal without changing the application tree afterward.
