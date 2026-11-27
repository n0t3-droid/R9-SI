#!/bin/bash
# R9-SI Lab · der PC-Emulator, mit einem der zwei Browser-Plätze der Maschine (/tmp/r9_browser_0.lock, _1.lock — dieselben
# wie test/wt_run.sh): the PC emulator waits for one of the machine's two browser slots, then runs lab/emu/emu.mjs.
#   bash lab/emu/run.sh [--profiles office,old-laptop,potato] [--scenes town,sea,flight] [--seconds 30] [--seed S] [--out file]
ROOT=$(cd "$(dirname "$0")/../.." && pwd -P)
for i in $(seq 1 7200); do
  for s in 0 1; do exec 9>"/tmp/r9_browser_$s.lock"; if flock -n 9; then exec node "$ROOT/lab/emu/emu.mjs" "$@"; fi; exec 9>&-; done
  sleep 1
done
exec flock /tmp/r9_browser_0.lock node "$ROOT/lab/emu/emu.mjs" "$@"
