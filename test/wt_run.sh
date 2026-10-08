#!/bin/bash
# Run one test against THIS checkout (the main folder or a git worktree of it).
# The tests were written for /home/claude/vr: a copy of the test with that path rewritten to this checkout's root
# runs instead. Browser tests (.mjs) take a machine-wide lock, so only one browser runs at a time (2 CPUs here).
# usage: bash test/wt_run.sh <name.mjs|name.js> [timeout seconds, default 900]
ROOT=$(cd "$(dirname "$0")/.." && pwd -P)
b=$(basename "$1"); to=${2:-900}
TMP=$ROOT/.tmp_tests; mkdir -p "$TMP" "$ROOT/test/shots"
sed -e "s#/home/claude/vr#$ROOT#g" -e "s#require('\./#require('$ROOT/test/#g" "$ROOT/test/$b" > "$TMP/$b"
# Node tests take one of two slots (/tmp/r9_node_0.lock, _1): at most two run at once next to the one browser test,
# so a dozen agents on an 8 GB machine never run it out of memory (that restarted the container once).
if [[ $b == *.mjs ]]; then exec flock /tmp/r9_browser.lock timeout "$to" node "$TMP/$b"; fi
for i in $(seq 1 600); do
  for s in 0 1; do exec 9>"/tmp/r9_node_$s.lock"; if flock -n 9; then exec timeout "$to" node "$TMP/$b"; fi; exec 9>&-; done
  sleep 1
done
exec flock /tmp/r9_node_0.lock timeout "$to" node "$TMP/$b"
