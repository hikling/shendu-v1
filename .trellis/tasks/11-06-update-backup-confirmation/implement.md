# Plan

1. Normalize only choice whitespace/case, retain explicit choices and safe defaults, reprompt invalid TTY entries, stop on failed read.
2. Add regression cases using real Linux PTYs and mocked commands, plus explicit environment/path failure cases. Demonstrate whitespace rejection on old code.
3. Explain cause uncertainty and retry using latest updater with explicit y; capture operations contract.
4. Review safety and run appropriate syntax/isolated checks; commit/sync main and wait native CI/public image smoke. Archive/journal and synchronize closure.
