#!/bin/bash
# run ONE browser test against a snapshot of dist with a live log:  bash test/live.sh <name> <test.mjs>
# log: $SP/live_<name>.log (written while it runs) — the last line says ALL OK / FAILED n
SP=/tmp/r9-scratch
name=$1; t=$2
rm -rf $SP/dist_$name; cp -r /home/dev/vr/dist $SP/dist_$name
mkdir -p $SP/tsnap
sed -e "s#/home/dev/vr/dist#$SP/dist_$name#g" -e "s#require('\./#require('/home/dev/vr/test/#g" /home/dev/vr/test/$t > $SP/tsnap/live_$name.mjs
(setsid nohup timeout 1500 node $SP/tsnap/live_$name.mjs > $SP/live_$name.log 2>&1 &)
echo "started $name: $t → $SP/live_$name.log"
