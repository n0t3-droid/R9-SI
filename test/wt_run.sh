#!/bin/bash
# Run one test against THIS checkout (the main folder or a git worktree of it).
# The tests were written for /home/claude/vr: a copy of the test with that path rewritten to this checkout's root
# runs instead. Browser tests (.mjs) take a machine-wide lock, so only one browser runs at a time (2 CPUs here).
# usage: bash test/wt_run.sh <name.mjs|name.js> [timeout seconds, default 900]
ROOT=$(cd "$(dirname "$0")/.." && pwd -P)
b=$(basename "$1"); to=${2:-900}
TMP=$ROOT/.tmp_tests; mkdir -p "$TMP" "$ROOT/test/shots"
sed -e "s#/home/claude/vr#$ROOT#g" -e "s#require('\./#require('$ROOT/test/#g" "$ROOT/test/$b" > "$TMP/$b"
if [[ $b == *.mjs ]]; then exec flock /tmp/r9_browser.lock timeout "$to" node "$TMP/$b"; else exec timeout "$to" node "$TMP/$b"; fi
