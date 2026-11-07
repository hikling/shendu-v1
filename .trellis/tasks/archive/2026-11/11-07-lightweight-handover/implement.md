# Execution

1. Implement tiny fixed-entry link bundle, update meaningful tests and receiving-developer documentation in parallel.
2. Run root unittests, actual package size/integrity/membership checks, link reachability and independent scope review. Confirm application tree unchanged; existing CI retains application/build/deploy checks.
3. Commit/sync main, finish Trellis and sync closure. Generate final exact-main bundle; verify it before deleting only the obsolete generated large ZIP/checksum. Confirm CI result and provide small package plus repository link.
