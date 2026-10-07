#!/bin/bash
# run a list of tests one after another; one line per test with OK/FAIL and the time
# DIST=/some/copy/of/dist runs the browser tests against that copy (so dist can be rebuilt meanwhile)
cd /home/dev/vr
SP=/tmp/r9-scratch
for t in "$@"; do
  t0=$(date +%s)
  f=test/$t
  if [ -n "$DIST" ] && [[ $t == *.mjs ]]; then mkdir -p $SP/tsnap; sed -e "s#/home/dev/vr/dist#$DIST#g" -e "s#require('\./#require('/home/dev/vr/test/#g" test/$t > $SP/tsnap/$t; f=$SP/tsnap/$t; fi
  if [[ $t == *.mjs ]]; then out=$(flock /tmp/r9_browser.lock timeout 900 node $f 2>&1); else out=$(timeout 600 node $f 2>&1); fi
  rc=$?
  t1=$(date +%s)
  last=$(echo "$out" | grep -E "ALL OK|FAILED|^OK|FAIL|✗" | tail -3 | tr '\n' ' ')
  echo "$t rc=$rc $((t1-t0))s :: $last"
  echo "$out" > $SP/suite_$t.log
done
echo SUITE DONE
