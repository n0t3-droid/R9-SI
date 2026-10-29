// u-orbit3 · the view from orbit in numbers (docs/superpowers/plans/2026-10-29-u-orbit3.md): Herzwelt drawn offline
// (test/space0_offline.js → .py: the game's own GLSL on llvmpipe, seed 53, 3 km up over the Heartland) and measured by
// test/orbit3_measure.py.
//   1. by day (High tier 2, Very Low tier 0): no milky veil — the land saturated (mean HSV S ≥ 0.2), contrasty (luma sd
//      ≥ 40), the haze near the nadir far below the limb's (10th-percentile min(r,g,b) nadir / limb ≤ 0.75, nadir ≤ 90)
//      u-orbit2: S 0.13, sd 33.6, ratio 0.88, nadir floor 129
//   2. at night (High): the ground dark with clustered towns, no carpet — the lower 40 %'s lit share ≤ 0.15, median ≤ 14 (u-orbit2: the airglow's green floor, 18.2)
//   3. the patch's lights never wrap (a Uint8 overflow drew v0.50's / u-orbit2 run 4's orange carpet): every lit texel
//      within 255 of its own computation and the land's lit share ≤ 0.35
//   bash test/wt_run.sh orbit3.js 600
const { execFileSync } = require('child_process');
const path = require('path'), fs = require('fs');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
function shot(tag, ticks, tier, mode) {
  execFileSync('node', [path.join(ROOT, 'test/space0_offline.js'), 'herz', '2', String(ticks), String(tier), '0', '0', '0', '640', '360', tag], { cwd: ROOT, env: Object.assign({}, process.env, { SEED: '53' }), stdio: 'pipe' });
  execFileSync('python3', [path.join(ROOT, 'test/space0_offline.py'), path.join(ROOT, '.tmp_tests/space0_off', tag)], { cwd: ROOT, stdio: 'pipe' });
  return JSON.parse(execFileSync('python3', [path.join(ROOT, 'test/orbit3_measure.py'), path.join(ROOT, 'test/shots', `space0_off_${tag}.png`), mode], { cwd: ROOT }).toString());
}
console.log('1 · by day');
for (const [tier, name] of [[2, 'High'], [0, 'Very Low']]) {
  const m = shot(`orbit3_day_t${tier}`, 5200, tier, 'day');
  console.log(`  ${name}: ${JSON.stringify(m)}`);
  check(m.sat >= 0.2, `${name}: the land saturated (S ${m.sat} ≥ 0.2)`);
  check(m.sd >= 40, `${name}: contrast (luma sd ${m.sd} ≥ 40)`);
  check(m.haze <= 0.75 && m.floorNadir <= 90, `${name}: the veil near the nadir (floor ${m.floorNadir} ≤ 90, ${m.haze} of the limb's ≤ 0.75)`);
}
console.log('2 · at night');
{
  const m = shot('orbit3_night_t2', 20500, 2, 'night');
  console.log(`  High: ${JSON.stringify(m)}`);
  check(m.lit <= 0.15 && m.median <= 14, `the ground dark (lit ${m.lit} ≤ 0.15, median ${m.median} ≤ 14; u-orbit2 18.2)`);
}
console.log('3 · the patch\'s lights');
{
  const dir = path.join(ROOT, '.tmp_tests/space0_off/tex_53_2'), f = fs.readdirSync(dir).find(n => /^patch_.*_b\.bin$/.test(n));
  const b = fs.readFileSync(path.join(dir, f)), a = fs.readFileSync(path.join(dir, f.replace('_b.bin', '_a.bin')));
  let land = 0, lit = 0;
  for (let k = 0; k < b.length; k += 4) if (a[k + 3] < 128) { land++; if (b[k] > 0) lit++; }
  check(land > 0 && lit / land <= 0.35, `${f}: the land's lit share ${(lit / land).toFixed(3)} ≤ 0.35`);
  const src = fs.readFileSync(path.join(ROOT, 'src/shared/bodytex.js'), 'utf8');
  check(/L = Math\.min\(255, L \* \(1 \+ kf/.test(src), 'the villages\' boost capped at 255 (no Uint8 wrap)');
}
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
