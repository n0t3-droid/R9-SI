// t-form's browser proof in one queue slot: test/formtools.mjs (the Studio: ✦ Formen, ✦ Glatt) and then
// test/smoothvox.mjs (the game: the surface-nets pieces, the fine surface, a designed hand-built piece, Very Low), one
// browser after the other. Each runs from a copy with this checkout's paths (as test/wt_run.sh makes one); OLD_DIST and N
// pass through to smoothvox.mjs. Ends with ALL OK or FAILED n (the two tests' failures added).
// regress: skip (the two tests run on their own in the regression)
//   OLD_DIST=/path/to/v042/dist/index.html nohup bash test/wt_run.sh tform_proof.mjs 4000 > .tmp_tests/tform_proof.log 2>&1 &
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { spawnSync } from 'child_process';
const ROOT = '/home/claude/vr';                                   // (test/wt_run.sh writes this checkout's root here)
const ORIG = ['', 'home', 'claude', 'vr'].join('/');              // (the tests' own spelling, not rewritten)
const TMP = ROOT + '/.tmp_tests';
mkdirSync(TMP, { recursive: true });
let fails = 0;
for (const name of ['formtools.mjs', 'smoothvox.mjs']) {
  const src = readFileSync(ROOT + '/test/' + name, 'utf8').split(ORIG).join(ROOT);
  writeFileSync(TMP + '/' + name, src);
  console.log(`===== ${name}`);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [TMP + '/' + name], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', env: process.env, maxBuffer: 1 << 26, timeout: 3600 * 1000 });
  process.stdout.write(r.stdout || ''); if (r.stderr) process.stdout.write(r.stderr.slice(-4000));
  const last = (r.stdout || '').trim().split('\n').pop() || '';
  const m = /FAILED (\d+)/.exec(last);
  const f = /ALL OK/.test(last) ? 0 : m ? +m[1] : 1;
  console.log(`===== ${name}: ${f ? 'FAILED ' + f : 'ALL OK'} in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  fails += f;
}
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
