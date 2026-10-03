#!/bin/bash
# snapshot dist and run tests against the snapshot in the background:  bash test/snap_suite.sh <name> a.mjs b.mjs …
# results: $SP/run_<name>.txt (one line per test), logs: $SP/suite_<test>.log
SP=/tmp/r9-scratch
name=$1; shift
rm -rf $SP/dist_$name; cp -r /home/dev/vr/dist $SP/dist_$name
(DIST=$SP/dist_$name setsid nohup bash /home/dev/vr/test/run_suite.sh "$@" > $SP/run_$name.txt 2>&1 &)
echo "started $name: $*"
