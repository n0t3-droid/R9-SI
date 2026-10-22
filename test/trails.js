// f-flow · R50-04 (docs/reviews/v0.49.md; plan docs/superpowers/plans/2026-10-23-f-flow.md §2.4): a contrail is smoke, not
// a white rod. src/main/trails.js's smoke ribbon, built in node (its vertices read back):
//  · it widens with age ×3 over its life (the newest point w0, the oldest 3 w0) and thins (the envelope falls with age);
//  · both ends are soft: the far end (the oldest point) ≤ 0.2 of the trail's brightest — also when the point cap cut the
//    trail before its life did (a fast ship: v0.49's rods were 176 m of a 14-s life, alpha 0.6 at the cut) — and the
//    newest end too, the condensation gap behind the engine and a trail whose ship flew on (v0.49: the hard end where the
//    ship crossed the 260-m line);
//  · the puffs' coordinate is the arc length in metres (two trails along the same path at different speeds carry the same
//    coordinate at the same place), not the age; the glow ribbons keep their seed;
//  · build() keeps its scratch: no per-frame arrays (v0.49 sliced and pushed arrays for every trail every frame);
//  · the sky traffic's contrails die in 6 s (was 14), its other smoke within 6 s, the contrail's points 2 m apart.
//   bash test/wt_run.sh trails.js 300
const V = require('./load_shared.js');
global.window = global.window || {};
V.SHADERS = V.SHADERS || { COMMON: '' };
require(__dirname + '/../src/main/trails.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const near = (a, b, e) => Math.abs(a - b) <= e;
const TR = V.Trails;
check(!!TR, 'VR.Trails exists');

const game = (preset) => ({ settings: { preset: preset || 'balanced' } });
const cam = { x: 0, y: 0, z: 0 };
// a trail along +x at 300 m in front of a camera at the origin looking down −z: points at x = −L … 0, y 120, z −300
// read back: the smoke vertices (10 floats: pos3, age, side, k, w, col3) → one record per ribbon point (its left/right)
function ribbon(T, kind) {
  const buf = T.buf[kind === 'g' ? 'g' : 's'], n = T.n[kind === 'g' ? 'g' : 's'], out = new Map();
  for (let i = 0; i < n; i++) {
    const o = i * 10, age = buf[o + 3], side = buf[o + 4], k = buf[o + 5], w = buf[o + 6];
    const key = age.toFixed(6) + ':' + w.toFixed(4);
    let r = out.get(key); if (!r) { r = { age, k, w, L: null, R: null }; out.set(key, r); }
    (side < 0 ? (r.L = [buf[o], buf[o + 1], buf[o + 2]]) : (r.R = [buf[o], buf[o + 1], buf[o + 2]]));
  }
  return [...out.values()].filter(r => r.L && r.R).map(r => Object.assign(r, { width: Math.hypot(r.R[0] - r.L[0], r.R[1] - r.L[1], r.R[2] - r.L[2]) })).sort((a, b) => a.age - b.age);
}
// fly an emitter along +x at v m/s for t seconds (dt 1/30), feeding the trail every frame; then `after` seconds unfed
function fly(T, key, v, t, o, after, x0, y0, z0) {
  const dt = 1 / 30; let x = x0 === undefined ? -v * t : x0;
  for (let s = 0; s < t; s += dt) { T.emit(key, x, y0 === undefined ? 120 : y0, z0 === undefined ? -300 : z0, o); T.update(dt); x += v * dt; }
  for (let s = 0; s < (after || 0); s += dt) T.update(dt);
  return x;
}
const SMOKE = (life, o) => Object.assign({ kind: 'smoke', col: [0.92, 0.93, 0.95], width: 1.6, grow: 2, life, step: 2, k: 1, max: 180 }, o || {});

// ---------------------------------------------------------------- width ×3 over its life, the envelope thins
{
  const T = new TR(game());
  fly(T, 'a', 20, 6.2, SMOKE(6));   // 6.2 s at 20 m/s: 124 m, every age from 0 to the life
  T.build(cam);
  const R = ribbon(T, 's');
  const young = R.filter(r => r.age < 0.08), old = R.filter(r => r.age > 0.9 && r.age < 0.97);
  const wy = young.length ? young.reduce((s, r) => s + r.width, 0) / young.length : 0, wo = old.length ? old.reduce((s, r) => s + r.width, 0) / old.length : 0;
  const ratio = wo / wy, ageY = young.length ? young.reduce((s, r) => s + r.age, 0) / young.length : 0, ageO = old.length ? old.reduce((s, r) => s + r.age, 0) / old.length : 0;
  const expect = (1 + 2 * ageO) / (1 + 2 * ageY);
  check(R.length > 20 && near(ratio, expect, expect * 0.05) && expect > 2.4, `the ribbon widens with age: ${wy.toFixed(2)} m at age ${ageY.toFixed(2)} → ${wo.toFixed(2)} m at ${ageO.toFixed(2)} (×${ratio.toFixed(2)}, ×3 over a whole life: ${expect.toFixed(2)} expected here)`);
  check(TR.width && near(TR.width(1.6, 2, 1) / TR.width(1.6, 2, 0), 3, 1e-9), 'TR.width(w0, grow, age): ×3 from the first to the last moment of its life');
  const kmax = Math.max(...R.map(r => r.k)), mid = R.filter(r => r.age > 0.45 && r.age < 0.55);
  check(mid.length && mid.every(r => r.k < 0.5 * kmax), `it thins with age: at half its life ≤ half the brightest (${mid.length ? Math.max(...mid.map(r => r.k)).toFixed(2) : '—'} of ${kmax.toFixed(2)})`);
  const tail = R[R.length - 1], head = R[0];
  check(tail.k <= 0.2 * kmax, `its far end (the oldest point, age ${tail.age.toFixed(2)}) ${tail.k.toFixed(3)} ≤ 0.2 × ${kmax.toFixed(2)}`);
  check(head.k <= 0.2 * kmax, `its newest end (behind the engine) ${head.k.toFixed(3)} ≤ 0.2 × the brightest: a condensation gap, no hard start`);
  // the puffs' coordinate: metres along the trail (w), steps of ~2 m (the emitter's odometer), growing toward the past
  const ws = R.map(r => r.w), span = Math.max(...ws) - Math.min(...ws);
  check(near(span, 6 * 20, 14), `the noise coordinate spans the trail's length in metres (${span.toFixed(1)} m of ≈ 120)`);
}
// ---------------------------------------------------------------- the point cap: the far end still soft
{
  const T = new TR(game());
  fly(T, 'b', 70, 5, SMOKE(6, { step: 1.1, max: 60 }));   // 70 m/s, a point a frame (2.3 m): 60 points = 2 s of a 6-s life
  T.build(cam);
  const R = ribbon(T, 's'), kmax = Math.max(...R.map(r => r.k)), tail = R[R.length - 1];
  check(tail.age < 0.6, `the cap cut it young (the oldest point's age ${tail.age.toFixed(2)} of its life)`);
  check(tail.k <= 0.2 * kmax, `cut by the cap, its far end still fades: ${tail.k.toFixed(3)} ≤ 0.2 × ${kmax.toFixed(2)} (v0.49: 0.6 of the brightest, a hard end)`);
}
// ---------------------------------------------------------------- the ship flies on (out of the 260-m range): soft
{
  const T = new TR(game());
  fly(T, 'c', 40, 3, SMOKE(6), 0.5);   // fed 3 s, then 0.5 s unfed
  T.build(cam);
  const R = ribbon(T, 's'), kmax = Math.max(...R.map(r => r.k)), head = R[0];
  check(R.length > 10 && head.k <= 0.2 * kmax, `a trail nobody feeds any more ends soft at its newest point too (${head.k.toFixed(3)} ≤ 0.2 × ${kmax.toFixed(2)})`);
  for (let i = 0; i < 30 * 7; i++) T.update(1 / 30);
  T.build(cam);
  check(T.n.s === 0 && !T.map.has('c:s') && !T.map.has('c'), `and is gone when its life is over (${T.n.s} vertices left)`);
}
// ---------------------------------------------------------------- arc length, not age
{
  const T1 = new TR(game()), T2 = new TR(game());
  fly(T1, 'p', 20, 4, SMOKE(6), 0, -80);
  fly(T2, 'q', 50, 1.6, SMOKE(6), 0, -80);   // the same 80 m, faster
  T1.build(cam); T2.build(cam);
  const A = ribbon(T1, 's'), B = ribbon(T2, 's');
  // the coordinate at x ≈ −40 (half way) relative to the trail's start (x −80): 40 m on both
  const at = (R, x) => { let best = null, bd = 1e9; for (const r of R) { const cx = (r.L[0] + r.R[0]) / 2, d = Math.abs(cx - x); if (d < bd) { bd = d; best = r; } } return best; };
  const a0 = at(A, -78), a1 = at(A, -40), b0 = at(B, -78), b1 = at(B, -40);
  const da = a1.w - a0.w, db = b1.w - b0.w;
  check(near(da, db, 2.5) && near(da, 38, 3), `the puffs sit at metres along the path: 38 m in, the coordinate moved ${da.toFixed(1)} (20 m/s) and ${db.toFixed(1)} (50 m/s) — the same, whatever the age`);
}
// ---------------------------------------------------------------- the glow keeps its seed; the scratch is kept
{
  const T = new TR(game());
  const G = { kind: 'glow', col: [0.5, 0.9, 1], width: 0.8, life: 0.4, step: 0.3, k: 0.8, max: 40 };
  fly(T, 'g', 30, 1, G);
  T.build(cam);
  const R = ribbon(T, 'g'), seeds = new Set(R.map(r => r.w.toFixed(4)));
  check(R.length > 5 && seeds.size === 1, `a glow ribbon: one seed along it (${seeds.size}), its intensity as emitted`);
  const s0 = T.scratch;
  for (let i = 0; i < 50; i++) { T.emit('g', 30 + i, 120, -300, G); T.update(1 / 30); T.build(cam); }
  check(!!s0 && T.scratch === s0, 'build() keeps one scratch for the points (no per-frame arrays)');
  const src = require('fs').readFileSync(__dirname + '/../src/main/trails.js', 'utf8'), b0 = src.indexOf('    build(cam)'), b1 = src.indexOf('\n    draw(', b0);
  const body = src.slice(b0, b1).replace(/this\.scratch = new Float64Array\([^)]*\)/, '');   // (the scratch grows once for a longer trail)
  check(b0 > 0 && !/\.slice\(|\.push\(\[|\bnew (Array|Float32Array|Float64Array)\b|\[\s*p\[0\]/.test(body), 'build() makes no arrays (no slice, no pushed literals, no new arrays but the scratch growing once)');
}
// ---------------------------------------------------------------- Very Low keeps its short trails, with the same soft ends
{
  const T = new TR(game('potato'));
  T.engine('v', [0, 120, -300], 45, { thrust: 0.8, size: 0.9, smokeLife: 6 });
  const o = T.map.get('v:s') && T.map.get('v:s').o;
  check(!!o && o.life <= 2.2 + 1e-9 && o.max <= 40, `Very Low: its smoke short (life ${o && o.life} s, ${o && o.max} points)`);
  fly(T, 'w', 45, 3, Object.assign({}, o));
  T.build(cam);
  const R = ribbon(T, 's'), kmax = R.length ? Math.max(...R.map(r => r.k)) : 0;
  check(R.length > 5 && R[R.length - 1].k <= 0.2 * kmax && R[0].k <= 0.2 * kmax, 'Very Low: soft at both ends too');
}
// ---------------------------------------------------------------- the sky traffic's smoke: 6 s, contrails 2 m apart
{
  global.VR.M = global.VR.M || { clamp: (v, a, b) => Math.max(a, Math.min(b, v)) };
  require(__dirname + '/../src/main/traffic.js');
  const calls = [];
  const g = { state: 'play', dim: 'overworld', player: { pos: [0, 81, 0] }, settings: { preset: 'balanced' }, trails: { engine(key, pos, sp, o) { calls.push(o); } }, particles: { spawn() { } } };
  const Tf = new V.Traffic(g);
  const meta = { exhaust: [[0, 1, 6, 0.6]], length: 16, width: 10, height: 4 };
  const ship = (o) => Object.assign({ d: { meta }, pos: [0, 140, -60], heading: 0, t: 0.4, spd: 40, big: false, contrail: false }, o);
  Tf.exhaust(ship({ contrail: true }), 90); Tf.exhaust(ship({}), 90); Tf.exhaust(ship({ big: true }), 90);
  const [c, n, b] = calls;
  check(c && c.smokeLife === 6 && c.smokeStep === 2 && c.smokeMax >= 180, `a contrail dies in 6 s (was 14), its points 2 m apart, ${c && c.smokeMax} of them (${JSON.stringify(c && { life: c.smokeLife, step: c.smokeStep, max: c.smokeMax })})`);
  check(n && n.smokeLife <= 6 && b && b.smokeLife <= 4.5, `the other traffic's smoke within 6 s (${n && n.smokeLife}), a big craft's 4.5 s (${b && b.smokeLife})`);
  const T = new TR(game());
  T.engine('e', [0, 120, -300], 50, c);
  const so = T.map.get('e:s').o;
  check(so.life === 6 && so.step === 2 && so.max >= 180 && near(so.grow, 2, 1e-9), `engine() hands them on: life ${so.life} s, step ${so.step} m, ${so.max} points, grow ${so.grow} (×3)`);
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
