#!/bin/bash
# w-golden · the release gate: smoke → golden shots → the monkey, one after another, each through test/wt_run.sh (the
# machine-wide browser slots), on THIS checkout's dist/ (built first). Stops at nothing: every stage runs, the verdict
# is the sum. Exit 0 only when all three end with ALL OK.
#   usage: bash test/release_gate.sh [log dir, default .tmp_tests/gate]      (≈ 12–15 min on the 2-CPU machine)
#   env:   GATE_SKIP_BUILD=1 (dist/ as it is) · GATE_ONLY="golden monkey" · MONKEY_S=180 · R9_EXCLUSIVE=1 (the release lane)
#   logs:  <dir>/smoke.log, golden.log, monkey.log, gate.txt (one line a stage); diffs of failed shots in test/shots/golden_*_diff.png
# regress: skip  (it runs the browser gates itself)
ROOT=$(cd "$(dirname "$0")/.." && pwd -P); cd "$ROOT" || exit 2
OUT=${1:-.tmp_tests/gate}; mkdir -p "$OUT"
STAGES=${GATE_ONLY:-"smoke golden monkey"}
if [ "${GATE_SKIP_BUILD:-0}" != 1 ]; then node build.js > "$OUT/build.log" 2>&1 || { echo "build FAILED (see $OUT/build.log)"; exit 1; }; fi
: > "$OUT/gate.txt"; bad=0
for s in $STAGES; do
  case $s in smoke) to=900 ;; golden) to=1200 ;; monkey) to=1200 ;; *) echo "unknown stage $s"; exit 2 ;; esac
  t0=$(date +%s)
  bash test/wt_run.sh "$s.mjs" "$to" > "$OUT/$s.log" 2>&1
  last=$(grep -E '^(ALL OK|FAILED [0-9]+)$' "$OUT/$s.log" | tail -1); [ -z "$last" ] && last="NO VERDICT (crashed or timed out)"
  line="$s: $last ($(( $(date +%s) - t0 )) s)"; echo "$line" | tee -a "$OUT/gate.txt"
  [ "$last" = "ALL OK" ] || { bad=$((bad + 1)); grep -E '^\s+✗' "$OUT/$s.log" | head -8 | tee -a "$OUT/gate.txt"; }
done
if [ $bad = 0 ]; then echo "GATE ALL OK" | tee -a "$OUT/gate.txt"; else echo "GATE FAILED $bad" | tee -a "$OUT/gate.txt"; fi
exit $bad
