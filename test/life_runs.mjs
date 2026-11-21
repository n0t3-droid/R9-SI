// t-life's browser evidence in one browser slot: test/life.mjs (the six scenes before/after, the counts, the costs) and
// then test/smoke.mjs, each a child process — one browser at a time, the slot held throughout (a slot freed between the
// two waited an hour once). The paths are rewritten to this checkout as test/wt_run.sh does.
// usage: BEFORE_DIST=file:///…/index.html TAG=after nohup bash test/wt_run.sh life_runs.mjs 7200 > .tmp_tests/life_runs.log 2>&1 &
// regress: skip  (a runner, not a test: its two tests are in the regression on their own)
import { spawnSync } from 'child_process';
import fs from 'fs';
const ORIG = ['', 'home', 'dev', 'vr'].join('/');   // (built, so the slot runner's rewrite leaves it alone)
const ROOT = '/home/dev/vr';                          // (the slot runner rewrites this one to the checkout)
fs.mkdirSync(`${ROOT}/.tmp_tests`, { recursive: true });
const res = [];
for (const [name, to] of [['life.mjs', 5400], ['smoke.mjs', 1800]]) {
  const src = fs.readFileSync(`${ROOT}/test/${name}`, 'utf8').split(ORIG).join(ROOT);
  const file = `${ROOT}/.tmp_tests/${name}`;
  fs.writeFileSync(file, src);
  console.log(`=== ${name}`);
  const r = spawnSync('timeout', [String(to), 'node', file], { stdio: 'inherit', env: process.env });
  res.push(`${name} exit ${r.status}`);
}
console.log(res.join(' · '));
