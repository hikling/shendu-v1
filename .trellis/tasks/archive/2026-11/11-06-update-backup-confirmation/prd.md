# Update backup confirmation

The screenshot shows a visually correct y rejected before Git fetch. Literal y already matches; surrounding terminal whitespace or CR currently fails. Normalize only the explicit yes/no choice's surrounding ASCII whitespace, accept case-insensitive yes/no, preserve default empty/ordinary noninteractive skip, and never change password bytes. Invalid interactive choices should ask again; read failure/EOF should stop before changing code/containers. Explicit invalid environment choices must fail rather than silently skip.

Limit changes to updater input parsing, isolated deployment regression tests, README/deployment troubleshooting and the operations contract. Preserve snapshot-before-fetch, snapshot-failure abort, configuration, keys, backup files, containers, default prebuilt path, and all application UI/data behavior.

Acceptance: real PTY tests for y/n/Enter, whitespace/CR, invalid-then-valid, EOF; explicit env choices and backup-failure safety. Linux shell suite, source syntax, existing checks, both architecture CI/prebuilt release/download-smoke pass; sync main. Explain that the screenshot cannot reveal exact hidden bytes, and provide a retry command using latest updater with SHENDU_BACKUP_BEFORE_UPDATE=y.
