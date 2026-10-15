// F9 · Ultra für schwache PCs: the plan's measuring runs in ONE browser slot, one browser at a time (regress: skip — a
// driver, not a test of its own: test/ultralite.mjs is the test, smoke.mjs the game's smoke test). On this shared machine
// a browser slot is won in a race every half hour or so: four runs in four races took hours, one race does them all.
// Each run is a child process (its own browser, closed before the next starts) with its own environment; the logs go to
// .tmp_tests/ultralite_<tag>.log and .tmp_tests/smoke.log, the numbers to .tmp_tests/ultralite_<tag>.json.
//   RUNS=vlc_before,vlc_after,run3,smoke (default; also run3b, merged, classic)   BASE=file:///…/index.html (the branch base's dist, for vlc_before)
// usage: RUNS=… BASE=… bash test/wt_run.sh ultralite_runs.mjs 14400
import { spawnSync } from 'child_process';
import fs from 'fs';
const ROOT = '/home/dev/vr';                      // (test/wt_run.sh rewrites this to the checkout's root)
const ORIG = ['', 'home', 'claude', 'vr'].join('/'); // (and this not: the path the tests are written for)
const TMP = ROOT + '/.tmp_tests';
// (the copy wt_run.sh would run: every path the test was written for rewritten to this checkout)
const prep = (b) => { const s = fs.readFileSync(`${ROOT}/test/${b}`, 'utf8').split(ORIG).join(ROOT); fs.writeFileSync(`${TMP}/${b}`, s); return `${TMP}/${b}`; };
const RUNS = {
  vlc_before: ['ultralite.mjs', 3600, { MODE: 'potato', PRESETS: 'potato,high', N: '5', TAG: 'vlc_before', DIST: process.env.BASE || '' }],
  vlc_after: ['ultralite.mjs', 3600, { MODE: 'potato', PRESETS: 'potato,high', N: '5', TAG: 'vlc_after' }],
  run3: ['ultralite.mjs', 5400, { SCENES: 'hall,plaza,village,lake', TAG: 'run3' }],
  // (run 3 was cut off by the stop of 10 Oct 00:40 after the lake's Ultra: the rest of it — the lake's pair and the walks)
  run3b: ['ultralite.mjs', 5400, { SCENES: 'lake', TAG: 'run3b' }],
  // (after the merge of v042: the four switches still draw the same pictures cheaper — the plaza and the lake's mirror)
  merged: ['ultralite.mjs', 3600, { SCENES: 'plaza,lake', WALK: '0', TAG: 'merged' }],
  smoke: ['smoke.mjs', 1800, {}],
  classic: ['classic_v2.mjs', 1800, {}],   // (the look's grid test: the shadow lookup's wrap offset sits in every preset's shaders)
};
const want = (process.env.RUNS || 'vlc_before,vlc_after,run3,smoke').split(',');
let fails = 0;
for (const name of want) {
  const r = RUNS[name]; if (!r) { console.log(`  ✗ ${name}: no such run`); fails++; continue; }
  const [file, to, env] = r;
  if ('DIST' in env && !env.DIST) { console.log(`  ✗ ${name}: BASE (the base build's index.html) is not set`); fails++; continue; }
  const log = `${TMP}/${name === 'smoke' ? 'smoke' : name === 'classic' ? 'classic_v2' : 'ultralite_' + name}.log`;
  const E = { ...process.env }; for (const k of ['MODE', 'PRESETS', 'N', 'TAG', 'DIST', 'SCENES', 'WALK', 'RD', 'VGEN']) delete E[k];
  Object.assign(E, env);
  const fd = fs.openSync(log, 'w'), t0 = Date.now();
  console.log(`== ${name} (${file} ${JSON.stringify(env)}) ${new Date().toTimeString().slice(0, 8)}`);
  const res = spawnSync('timeout', [String(to), 'node', prep(file)], { env: E, stdio: ['ignore', fd, fd] });
  fs.closeSync(fd);
  const out = fs.readFileSync(log, 'utf8').trim().split('\n'), last = out[out.length - 1] || '';
  const ok = res.status === 0 && last === 'ALL OK';
  if (!ok) fails++;
  console.log(`  ${ok ? '✓' : '✗'} ${name}: ${last} (exit ${res.status}, ${Math.round((Date.now() - t0) / 60000)} min) — ${log}`);
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
