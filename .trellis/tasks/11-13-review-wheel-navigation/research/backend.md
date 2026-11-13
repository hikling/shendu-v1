# Account wheel preference

## Boundary

Changed only `defaultTheme()` and `normalizeTheme()` in `shendu/server.mjs`. The additive `reviewWheelNavigation` field defaults to true; only explicit boolean false disables it. Existing encrypted settings, account scoping, preference activity events, personal backup normalization and site restore normalization are reused. No schema or backup-format version changed.

## Validation

`node --test tests/review-wheel-settings-api.test.mjs`: **5/5 passed** with an isolated temporary local server/database on 2026-11-13.

- First registered owner and administrator-created members receive enabled wheel navigation and independent reduceMotion=false.
- A legacy stored JSON theme without the field reads as enabled while preserving reduced motion/colors and without mutating storage on read.
- Every true/false wheel and reduced-motion combination persists and reads back through a fresh login, stays account-scoped and remains encrypted in SQLite.
- Personal encrypted exports/restores round-trip both values. A resealed old-format theme missing the additive field restores enabled, preserving reduced motion.
- Site encrypted export/restore keeps two members' different values, invalidates old sessions as before, and restores missing legacy fields to enabled. Schema remains8.

No deployed data, real account, master key or external storage was accessed. Parent coordinates the integrated syntax/build/full suite and browser checks.
