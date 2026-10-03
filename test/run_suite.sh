#!/bin/bash
# run a list of tests one after another; one line per test with OK/FAIL and the time
# DIST=/some/copy/of/dist runs the browser tests against that copy (so dist can be rebuilt meanwhile)
cd /home/claude/vr
SP=/tmp/claude-0/-home-claude/faf7c5c5-3403-55c6-865b-eb66c7edd5f9/scratchpad
for t in "$@"; do
  t0=$(date +%s)
  f=test/$t
  if [ -n "$DIST" ] && [[ $t == *.mjs ]]; then mkdir -p $SP/tsnap; sed -e "s#/home/claude/vr/dist#$DIST#g" -e "s#require('\./#require('/home/claude/vr/test/#g" test/$t > $SP/tsnap/$t; f=$SP/tsnap/$t; fi
  if [[ $t == *.mjs ]]; then out=$(timeout 900 node $f 2>&1); else out=$(timeout 600 node $f 2>&1); fi
  rc=$?
  t1=$(date +%s)
  last=$(echo "$out" | grep -E "ALL OK|FAILED|^OK|FAIL|✗" | tail -3 | tr '\n' ' ')
  echo "$t rc=$rc $((t1-t0))s :: $last"
  echo "$out" > $SP/suite_$t.log
done
echo SUITE DONE
