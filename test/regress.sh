#!/bin/bash
# The release regression set: the node tests first, then the browser tests one at a time. Each test runs through
# test/wt_run.sh, so browser tests wait for the machine-wide browser lock. A failing test never stops the run.
#
# usage: bash test/regress.sh [results file] [test names...]   (R9_EXCLUSIVE=1 holds both browser slots: the release run)
#   results file  default .tmp_tests/regress.txt of this checkout ("" keeps the default when names follow)
#   test names    run only these (*.js = node, *.mjs = browser) instead of the whole set
#   REGRESS_ONLY  node | browser  runs only that part of the set
# One line per test, in the results file and on screen:   <name> <exit code> <seconds> <summary>
#   summary  ALL OK | FAILED <n> | no summary (the test printed neither)
#   seconds  wall time of the run; a browser test includes its wait for the browser lock
# The last line is ALL OK or FAILED <n> (the number of tests that failed); the exit code is 0 only for ALL OK.

ROOT=$(cd "$(dirname "$0")/.." && pwd -P)
RESULTS=${1:-$ROOT/.tmp_tests/regress.txt}
[ $# -gt 0 ] && shift
mkdir -p "$(dirname "$RESULTS")" "$ROOT/.tmp_tests" || exit 2
: > "$RESULTS" || exit 2

# The sets are found, not listed: every test/*.js and test/*.mjs that prints the summary line ("ALL OK") is a real test
# and part of the regression — so a new test joins by following the convention, and no two branches fight over a
# list. A showcase or a profiling script that must not run here says so with a line containing "regress: skip".
is_test() { grep -q "ALL OK" "$1" && ! grep -q "regress: skip" "$1"; }
NODE_SET=$(for f in "$ROOT"/test/*.js; do is_test "$f" && basename "$f"; done | sort | tr '\n' ' ')
BROWSER_SET=$(for f in "$ROOT"/test/*.mjs; do is_test "$f" && basename "$f"; done | sort | tr '\n' ' ')

if [ $# -gt 0 ]; then LIST="$*"; else LIST="$NODE_SET $BROWSER_SET"; fi
NODES=(); BROWSERS=()
for t in $LIST; do
  case $t in
    *.js)  [ "${REGRESS_ONLY:-all}" != browser ] && NODES+=("$t") ;;
    *.mjs) [ "${REGRESS_ONLY:-all}" != node ] && BROWSERS+=("$t") ;;
    *) echo "skipped $t: not a .js or .mjs test" ;;
  esac
done

run_test() { # <name> <timeout seconds>; returns 0 only for exit code 0 and ALL OK
  local t=$1 to=$2 log="$ROOT/.tmp_tests/regress_$1.log" t0 t1 rc s line
  if [[ $t == *.mjs ]]; then echo "== $t (waits for the browser lock)"; else echo "== $t"; fi
  t0=$(date +%s)
  bash "$ROOT/test/wt_run.sh" "$t" "$to" > "$log" 2>&1
  rc=$?
  t1=$(date +%s)
  s=$(grep -E '^(ALL OK|FAILED [0-9]+)$' "$log" | tail -1)
  [ -n "$s" ] || s="no summary"
  line="$t $rc $((t1 - t0)) $s"
  echo "$line" | tee -a "$RESULTS"
  [ "$rc" = 0 ] && [ "$s" = "ALL OK" ]
}

total=0; fails=0
for t in "${NODES[@]}"; do total=$((total + 1)); run_test "$t" 600 || fails=$((fails + 1)); done
for t in "${BROWSERS[@]}"; do total=$((total + 1)); run_test "$t" "${R9_BROWSER_TO:-1800}" || fails=$((fails + 1)); done   # (R9_BROWSER_TO: a longer limit for the long ones, e.g. horizon.mjs on this machine)
echo "$total tests, $fails failed; results in $RESULTS"
if [ "$fails" = 0 ]; then echo "ALL OK"; exit 0; fi
echo "FAILED $fails"
exit 1
