#!/bin/bash
# Run one test against THIS checkout (the main folder or a git worktree of it).
# The tests were written for /home/claude/vr: a copy of the test with that path rewritten to this checkout's root
# runs instead. Browser tests (.mjs) take one of two machine-wide browser slots (/tmp/r9_browser_0.lock, _1.lock) —
# two browsers at most on this 2-CPU, 8 GB machine; R9_EXCLUSIVE=1 (the release regression) holds both slots, so a
# timing-sensitive run has the machine to itself. Node tests take one of two node slots (/tmp/r9_node_0.lock, _1).
# usage: bash test/wt_run.sh <name.mjs|name.js> [timeout seconds, default 900]
ROOT=$(cd "$(dirname "$0")/.." && pwd -P)
b=$(basename "$1"); to=${2:-900}
TMP=$ROOT/.tmp_tests; mkdir -p "$TMP" "$ROOT/test/shots"
sed -e "s#/home/claude/vr#$ROOT#g" -e "s#require('\./#require('$ROOT/test/#g" "$ROOT/test/$b" > "$TMP/$b"
if [[ $b == *.mjs ]]; then kind=browser; else kind=node; fi
if [ "$kind" = browser ] && [ "${R9_EXCLUSIVE:-0}" = 1 ]; then
  exec 8>/tmp/r9_browser_0.lock; flock 8
  exec 9>/tmp/r9_browser_1.lock; flock 9
  exec timeout "$to" node "$TMP/$b"
fi
# (node tests: one slot while the browsers are the bottleneck — the 2 CPUs go to the two browsers first)
if [ "$kind" = node ]; then SLOTS="0"; else SLOTS="0 1"; fi
for i in $(seq 1 7200); do
  for s in $SLOTS; do exec 9>"/tmp/r9_${kind}_$s.lock"; if flock -n 9; then exec timeout "$to" node "$TMP/$b"; fi; exec 9>&-; done
  sleep 1
done
exec flock "/tmp/r9_${kind}_0.lock" timeout "$to" node "$TMP/$b"
