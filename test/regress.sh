#!/bin/bash
# The release regression set: the node tests first, then the browser tests one at a time. Each test runs through
# test/wt_run.sh, so browser tests wait for the machine-wide browser lock. A failing test never stops the run.
#
# usage: bash test/regress.sh [results file] [test names...]
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

NODE_SET="genie_brain.js genie_raster.js housekit.js schem_io.js style_core.js gen_same.js id_snapshot.js light_same.js mesh_same.js phys_guard.js pool_recover.js store_fail.js vx_cache.js vx_cells.js worker_jobs.js modern_pack.js tex_check.js looks_core.js variants_core.js"
BROWSER_SET="smoke.mjs spawn.mjs studio_live.mjs catalog.mjs favs.mjs house_genie.mjs site_plan.mjs create_standalone.mjs imagine.mjs projects.mjs crafter3.mjs player2.mjs workbench.mjs world_style.mjs crafter2.mjs world_mode.mjs studio_drag.mjs tpl_upgrade.mjs crafter.mjs deadends.mjs bridge.mjs blocklook.mjs modern_pack.mjs mp.mjs slopes.mjs terrain_edit.mjs glass_conn.mjs modern_kit.mjs height.mjs ship_test.mjs star_test.mjs liveloop.mjs"

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
for t in "${BROWSERS[@]}"; do total=$((total + 1)); run_test "$t" 1800 || fails=$((fails + 1)); done
echo "$total tests, $fails failed; results in $RESULTS"
if [ "$fails" = 0 ]; then echo "ALL OK"; exit 0; fi
echo "FAILED $fails"
exit 1
