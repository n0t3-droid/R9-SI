// u-moons1 · Basalt and Opal, the first worlds beyond Herzwelt (docs/superpowers/plans/2026-10-22-u-moons1.md), node only:
//  a · the profiles (VR.Bodies.profile): U§2.1's numbers (the radius from VR.Universe, g, the walking gravity 30·g/9.81),
//      the kinds, the three blocks appended at the very end of the registry, bgen and its stamp in a save
//  b · morphology by the real-equivalent size (R§5.2; U§6.3: D_real = 64·D_game): D_T(Basalt) = 18 km real = 281 m game,
//      simple bowls d/D 0.20 below, complex craters above — a flat floor, a central peak, terraces, Pike's depth; peak
//      rings from 9 D_T; ice's own transition on Opal (2.7 km at Mars' g, ∝ 1/g)
//  c · the population: the cumulative size–frequency slope −2.9 ± 0.2 (the maria, unsaturated octaves), the highlands
//      denser than the maria, Opal's young ice with few craters; rays only on the youngest craters
//  d · Basalt's ground: maria dark and lower, highlands bright, regolith thicker on old ground, bare rock in fresh walls,
//      boulders round fresh craters, rilles in the maria, the landmark complex crater by the landing with its peak
//  e · Opal's ground: bright ice, lineae 16–31 m wide of tholin ice, the four tiger stripes (troughs, flanks) with their
//      vents, chaos plates, few craters
//  f · spawns standable and facing their sight, determinism, the same heights across chunk borders, the worker's API
//  g · walking: a jump on Opal 27.6 ± 0.5 m high (player.js's own numbers, DimReg's gravity), on Basalt 8.4 m; the fall
//      damage counts the fall as d·g/9.81 (U§4.3): a 25-m fall on Opal hurts no more than 1.3 m at home
//  h · the column time: a moon's chunk no slower than the overworld's (the same chunk coordinates, the same machine)
//  i · the sky and the light (bodysky.js): Helia sharp, no twilight; Amarant at its true size, the ring edge-on, the
//      eclipse; the env without air; with space_shaders.js loaded before shaders.js every program without BODYSKY is the
//      text it was; the geysers' schedule and heights; the suit's breath; the codex pages
//   bash test/wt_run.sh bodies.js 300
if (process.argv[2] === '--sky-text') {
  // (a child process: the shader sources with and without space_shaders.js loaded first, preprocessed without BODYSKY)
  const R0 = __dirname + '/../', load = (withSS) => {
    for (const k of Object.keys(require.cache)) delete require.cache[k];
    global.window = { devicePixelRatio: 1, screen: { width: 1280, height: 720 } }; global.WebGLFramebuffer = class {}; delete global.VR;
    require(R0 + 'test/dom_stub.js'); const V0 = require(R0 + 'test/load_shared.js'); global.self = global;
    for (const f of ['gl', 'light2', 'sky3', 'water_fx'].concat(withSS ? ['space_shaders'] : []).concat(['shaders'])) require(R0 + 'src/main/' + f + '.js');
    return V0.SHADERS;
  };
  const pre = (src, defs) => {
    const D = new Set(defs), out = [], stack = [], on = () => stack.every(s => s.on);
    for (const line of src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')) {
      const t = line.trim(); let m;
      if ((m = /^#ifdef\s+(\w+)/.exec(t))) { const o = D.has(m[1]); stack.push({ on: o, done: o }); continue; }
      if ((m = /^#ifndef\s+(\w+)/.exec(t))) { const o = !D.has(m[1]); stack.push({ on: o, done: o }); continue; }
      if ((m = /^#if\s+(.*)$/.exec(t))) { const o = !!Function('return ' + m[1].replace(/defined\s*\(\s*(\w+)\s*\)/g, (q, n) => (D.has(n) ? '1' : '0')).replace(/\b[A-Z_][A-Z_0-9]*\b/g, (n) => (D.has(n) ? '1' : '0')))(); stack.push({ on: o, done: o }); continue; }
      if (/^#else/.test(t)) { const s = stack[stack.length - 1]; s.on = !s.done; s.done = true; continue; }
      if (/^#endif/.test(t)) { stack.pop(); continue; }
      if (!on()) continue;
      const c = line.replace(/\/\/.*$/, '').trim(); if (c) out.push(c);
      if ((m = /^#define\s+(\w+)/.exec(t))) D.add(m[1]);
    }
    return out.join('\n');
  };
  const A = load(false), B2 = load(true);
  let diff = 0, n = 0;
  for (const k of Object.keys(A)) { if (typeof A[k] !== 'string') continue; n++; for (const defs of [[], ['LITE'], ['SKY3', 'SKY3HI'], ['LITE', 'MOTION']]) if (pre(A[k], defs) !== pre(B2[k], defs)) diff++; }
  console.log(JSON.stringify({ n, diff, grow: pre(B2.SKY_FS, ['BODYSKY']).length - pre(B2.SKY_FS, []).length }));
  process.exit(0);
}
require('./dom_stub.js');
const V = require('./load_shared.js');
require('../src/main/presence.js'); require('../src/main/player.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const B = V.Bodies, BG = V.BodyGen, U = V.Universe, D = V.DimReg, R = V.R;
if (!B || !BG) { console.log('  ✗ VR.Bodies / VR.BodyGen missing'); console.log('FAILED 1'); process.exit(1); }
const S = V.GEN.S(), st = (n) => (R.byName[n] ? R.byName[n].defaultState : -1);
const typeOf = (s) => (s > 0 ? R.types[R.T.type[s]].name : 'air');
const SEED = 4242;

// ================================================================ a · the profiles
console.log('a · the profiles');
const PB = B.profile('basalt'), PO = B.profile('opal');
check(PB && PO && B.ids.join() === 'basalt,opal,zinn,ocker,aqua', 'five bodies: basalt, opal (u-moons1), zinn, ocker, aqua (u-moons2)', B.ids.join());
check(PB.kind === 'airless' && PO.kind === 'ice', 'kinds: Basalt airless (cratered), Opal ice');
check(Math.abs(PB.R - U.home.by.basalt.R) < 1 && Math.abs(PO.R - U.home.by.opal.R) < 1, 'radii from VR.Universe: Basalt ' + (PB.R / 1000).toFixed(2) + ' km, Opal ' + (PO.R / 1000).toFixed(2) + ' km (game)');
check(PB.g === 1.62 && PO.g === 0.49, 'g: Basalt 1.62, Opal 0.49 (U§2.1)');
check(Math.abs(PB.walk - 30 * 1.62 / 9.81) < 1e-9 && Math.abs(PO.walk - 30 * 0.49 / 9.81) < 1e-9, 'the walking gravity 30·g/9.81 (U§4.3)', PB.walk.toFixed(3) + ' · ' + PO.walk.toFixed(3));
check(B.BGEN === 2 && PB.bgen === B.BGEN && PO.bgen === B.BGEN, 'the current bgen for both (u-moons3: 2 — Basalt and Opal the same at 1 and 2)');
check(D.has('basalt') && D.has('opal') && D.code('basalt') === 5 && D.code('opal') === 5 && D.sky('basalt') && D.sky('opal'), 'DimReg: basalt and opal, u_dim 5 (airless body), light from above');
check(D.g('basalt') === 1.62 && D.g('opal') === 0.49 && !D.actorsHome('basalt') && !D.actorsHome('opal'), 'DimReg: their g, no village life (actors none)');
check(D.get('basalt').travel && D.get('opal').travel && D.travelable({}).includes('basalt') && D.travelable({}).includes('opal'), '/dim reaches both (travel)');
check(V.makeGen('basalt', SEED, {}) instanceof BG && V.makeGen('opal', SEED, {}) instanceof BG, 'makeGen gives a BodyGen for each');
{
  const names = ['regolith', 'regolith_dark', 'tholin_ice'], types = names.map(n => R.byName[n]);
  check(types.every(Boolean), 'the blocks regolith, regolith_dark, tholin_ice exist');
  // (a-foes: later late blocks may follow them — the Leuchtfeuer does: the three in a row, after every shipped block)
  const snapEnd = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'test', 'id_snapshot.json'), 'utf8')).reduce((m, r) => Math.max(m, r[1] + r[2]), 0);
  const ix = types.map(t => R.types.indexOf(t)), last = ix.map(i => R.types[i].name).join();
  check(ix[1] === ix[0] + 1 && ix[2] === ix[0] + 2 && types[0].base >= snapEnd, 'appended late, in a row, after every shipped block (VR.BL.late)', last + ' from ' + types[0].base);
  check(types.every(t => R.T.flags[t.defaultState] & V.F.OPAQUE), 'all three full opaque blocks');
  check(R.byName.regolith.o.smooth && R.byName.regolith_dark.o.smooth, 'the two dusts are natural ground (smooth slopes in Nahtlos)');
  check(names.every(n => R.texIndex[n] !== undefined && V.TEXREC && typeof V.TEXREC[n] === 'function') || !V.TEXREC, 'a procedural texture recipe each (tex_body.js)');
}
{
  const meta = {};
  B.stamp(meta);
  check(meta.universe && meta.universe.bodies && meta.universe.bodies.basalt.bgen === B.BGEN && meta.universe.bodies.opal.bgen === B.BGEN, 'stamp: a save gets the current bgen for each body');
  meta.universe.bodies.opal.bgen = 0.5; B.stamp(meta);
  check(meta.universe.bodies.opal.bgen === 0.5, 'stamp keeps what a save has (old worlds keep their moons)');
  check(JSON.stringify(B.bgenOf(meta)) === JSON.stringify({ basalt: 2, opal: 0.5, zinn: 2, ocker: 2, aqua: 2 }), 'bgenOf → the genOpts table', JSON.stringify(B.bgenOf(meta)));
  check(new BG(SEED, 'opal', { bgen: { opal: 1 } }).bgen === 1 && new BG(SEED, 'basalt', {}).bgen === B.BGEN, 'a generator takes its bgen from the options, else the current');
}

// ================================================================ b · morphology by the real-equivalent size
console.log('b · morphology by the real-equivalent size (R§5.2)');
{
  const DT = B.transition(1.62, false);
  check(Math.abs(DT - 18000) < 1, 'the transition on Basalt: 18 km real (the Moon\'s, R§5.2)', DT.toFixed(0) + ' m');
  check(Math.abs(PB.DT - 18000 / 64) < 0.01, '= 281 m game', PB.DT.toFixed(2) + ' m');
  check(B.kind(17900, 1.62) === 'simple' && B.kind(18100, 1.62) === 'complex', '17.9 km real a simple bowl, 18.1 km a complex crater');
  check(B.kind(9 * 18000 + 100, 1.62) === 'peakring' && B.kind(9 * 18000 - 100, 1.62) === 'complex', 'peak rings from 9 D_T (162 km real)');
  check(Math.abs(B.transition(3.72, true) - 2700) < 1 && Math.abs(PO.DT * 64 - 2700 * 3.72 / 0.49) < 1, 'ice: 2.7 km at Mars\' g (R§5.2), ∝ 1/g → ' + (PO.DT * 64 / 1000).toFixed(1) + ' km real on Opal (' + PO.DT.toFixed(0) + ' m game)');
  // a simple bowl: the rim-to-floor depth is 0.2 D at every simple size
  let worst = 0;
  for (const Dg of [8, 30, 120, 270]) {
    const c = B.crater(Dg, PB), floor = B.craterHeight(c, 0, 0), rim = B.craterHeight(c, c.R, 0);
    worst = Math.max(worst, Math.abs((rim - floor) / Dg - 0.2));
  }
  check(worst < 0.005, 'simple bowls: depth/D = 0.20 (8, 30, 120, 270 m)', 'worst |d/D − 0.2| ' + worst.toFixed(4));
  const cs = B.crater(120, PB);
  check(cs.kind === 'simple' && B.craterHeight(cs, cs.R * 0.5, 0) < B.craterHeight(cs, cs.R * 0.8, 0) && B.craterHeight(cs, cs.R * 2, 0) > 0 && B.craterHeight(cs, cs.R * 2, 0) < B.craterHeight(cs, cs.R, 0), 'a bowl: deepest at the centre, a raised rim, an ejecta blanket falling off outside');
  // a complex crater: the landmark's size (360 m game = 23 km real)
  const cc = B.crater(360, PB), Dk = 360 * 64 / 1000;
  const pike = 1.044 * Math.pow(Dk, 0.301) * 1000 / 64;
  check(cc.kind === 'complex', '360 m (23 km real) is complex');
  check(Math.abs(cc.depth - pike) / pike < 0.1 && cc.depth / 360 < 0.2, 'Pike\'s depth 1.044·D^0.301 km (±10 %) — shallower than a bowl', 'd ' + cc.depth.toFixed(1) + ' m, d/D ' + (cc.depth / 360).toFixed(3));
  const fl = [], rf = cc.floorR;
  for (let k = 0; k <= 10; k++) fl.push(B.craterHeight(cc, cc.peakR * 1.15 + (rf * 0.85 - cc.peakR * 1.15) * k / 10, 0));
  check(Math.max(...fl) - Math.min(...fl) < 0.02 * cc.depth, 'a flat floor between the peak and the wall', 'spread ' + (Math.max(...fl) - Math.min(...fl)).toFixed(2) + ' m of ' + cc.depth.toFixed(1));
  const peak = B.craterHeight(cc, 0, 0) - fl[0];
  check(peak > 2 && cc.peakH > 2 && Math.abs(peak - cc.peakH) < 0.05, 'a central peak (Hale & Head 0.0049·D^1.297 km)', 'peak ' + peak.toFixed(1) + ' m over the floor');
  // terraces: the wall between floor and rim has benches — the slope along the wall drops to near flat at least twice
  let benches = 0, inBench = false;
  const N = 400, dr = (cc.R - rf) / N;
  for (let k = 1; k < N; k++) {
    const r = rf + k * dr, s = (B.craterHeight(cc, r + dr, 0) - B.craterHeight(cc, r - dr, 0)) / (2 * dr);
    if (s < 0.06 && !inBench) { benches++; inBench = true; } else if (s > 0.2) inBench = false;
  }
  check(cc.terraces >= 2 && benches >= 2, 'terraced walls (' + cc.terraces + ' terraces, ' + benches + ' benches found)');
  const old = B.craterHeight(cc, cc.R, 0.9), fresh = B.craterHeight(cc, cc.R, 0);
  check(old < fresh * 0.6 && B.craterHeight(cc, 0, 0.9) > B.craterHeight(cc, 0, 0), 'age softens: an old crater\'s rim lower, its floor shallower');
  const cr = B.crater(3000, PB);
  check(cr.kind === 'peakring' && B.craterHeight(cr, cr.R * 0.5, 0) > B.craterHeight(cr, 0, 0) + 1, 'a peak-ring basin (3 km game = 192 km real): the ring higher than the centre');
}

// ================================================================ c · the population
console.log('c · the population (R§5.2: slope −2.9)');
const gB = new BG(SEED, 'basalt', {}), gO = new BG(SEED, 'opal', {});
{
  // per octave, the craters of an 80 × 80-cell square far from the landing (the octave's own scale: 3.8 km for 12–24 m,
  // 61 km for 192–384 m), split by the ground at their centres: the density per km² of maria and of highlands
  const X0 = 52000, Z0 = -31000;
  const dens = (g, k, sel) => {
    const o = g.oct[k], n0 = 80, i0 = Math.floor(X0 / o.S), j0 = Math.floor(Z0 / o.S);
    let n = 0; const all = [];
    for (let j = j0; j < j0 + n0; j++) for (let i = i0; i < i0 + n0; i++) for (const c of g.cellCraters(k, i, j)) { all.push(c); if (sel(c)) n++; }
    return { n, all, span: n0 * o.S, x: i0 * o.S, z: j0 * o.S };
  };
  const mareShare = (g, x0, z0, span) => { let s = 0; for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) s += g.mareAt(x0 + (i + 0.5) * span / 32, z0 + (j + 0.5) * span / 32) > 0.5 ? 1 : 0; return s / 1024; };
  const rows = [];
  for (let k = 1; k <= 5; k++) {
    const dm = dens(gB, k, c => c.mare > 0.9), dh = dens(gB, k, c => c.mare < 0.1), share = mareShare(gB, dm.x, dm.z, dm.span), area = dm.span * dm.span / 1e6;
    rows.push({ k, d0: gB.oct[k].d0, mare: dm.n / (share * area), high: dh.n / ((1 - share) * area), nM: dm.n, nH: dh.n, all: dm.all });
  }
  const xs = rows.map(r => Math.log(r.d0)), ys = rows.map(r => Math.log(r.mare));
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) * (x - mx); });
  const sm = sxy / sxx;
  check(rows.every(r => r.nM >= 25), 'enough craters per octave in the maria', rows.map(r => r.nM).join(' · '));
  check(Math.abs(sm + 2.9) < 0.2, 'the maria\'s size–frequency slope −2.9 ± 0.2 (octaves 12 m … 384 m)', sm.toFixed(2) + ' · per km²: ' + rows.map(r => r.d0 + ' m ' + r.mare.toFixed(r.mare < 1 ? 3 : 1)).join(', '));
  check(rows[1].high > 3 * rows[1].mare && rows[2].high > 3 * rows[2].mare, 'the highlands (older ground) far denser than the maria', rows.slice(1, 3).map(r => r.d0 + ' m: ' + r.high.toFixed(2) + ' vs ' + r.mare.toFixed(2)).join(' · '));
  const every = rows.flatMap(r => r.all), cut = PB.craters.young;
  check(every.some(c => c.rays) && every.every(c => c.rays === (c.age < cut)), 'rays exactly on the young craters (age < ' + cut + ')', every.filter(c => c.rays).length + ' of ' + every.length);
  check(every.filter(c => c.D >= PB.DT).every(c => c.kind !== 'simple') && every.filter(c => c.D < PB.DT).every(c => c.kind === 'simple') && every.some(c => c.kind === 'complex'), 'every crater\'s kind by its real-equivalent size (complex from ' + PB.DT.toFixed(0) + ' m)');
  const dO = dens(gO, 2, () => true), nO = dO.n / (dO.span * dO.span / 1e6);
  check(nO < rows[1].mare / 4, 'Opal: young ice, few craters (24–48 m)', nO.toFixed(2) + '/km² vs Basalt\'s maria ' + rows[1].mare.toFixed(2));
}

// ================================================================ d · Basalt's ground
console.log('d · Basalt\'s ground');
const topOf = (col, ix) => { let y = 255; while (y > 0 && !col.blocks[(y << 8) | ix]) y--; return y; };
const tally = (g, cxs, czs, f) => { for (let cz = czs[0]; cz <= czs[1]; cz++) for (let cx = cxs[0]; cx <= cxs[1]; cx++) { const col = g.generate(cx, cz); for (let i = 0; i < 256; i++) f(col, i, cx * 16 + (i & 15), cz * 16 + (i >> 4)); } };
{
  const reg = st('regolith'), dark = st('regolith_dark');
  const T = { mare: { n: 0, dark: 0, light: 0, thick: 0, h: 0 }, high: { n: 0, dark: 0, light: 0, thick: 0, h: 0 } };
  // two windows near the landing, 13 × 13 chunks each: one wholly mare (off the landmark's rays), one wholly highlands
  const L0 = gB.landmark, TAU = Math.PI * 2;
  const whole = (x, z, want) => { for (let dz = -110; dz <= 110; dz += 55) for (let dx = -110; dx <= 110; dx += 55) { const m = gB.mareAt(x + dx, z + dz); if (want ? m < 0.97 : m > 0.03) return false; } return true; };
  const find = (want) => { for (let rr = 0; rr <= 6000; rr += 100) for (let a = 0; a < (rr ? 64 : 1); a++) { const x = Math.round(Math.cos(a / 64 * TAU) * rr), z = Math.round(Math.sin(a / 64 * TAU) * rr); if (Math.hypot(x - L0.x, z - L0.z) > L0.rayLen + 150 && whole(x, z, want)) return { x, z }; } return null; };
  const WM = find(true), WH = find(false);
  check(!!WM && !!WH, 'a whole mare and a whole highland within 6 km of the landing', WM && WH ? WM.x + ', ' + WM.z + ' · ' + WH.x + ', ' + WH.z : '');
  for (const W of [WM, WH]) if (W) tally(gB, [(W.x >> 4) - 6, (W.x >> 4) + 6], [(W.z >> 4) - 6, (W.z >> 4) + 6], (col, i, x, z) => {
    const o = gB.lastInfo[((i >> 4) + 1) * 18 + (i & 15) + 1];
    const m = o.m; if (m > 0.05 && m < 0.95) return;
    if (o.fresh || o.ray > 0.3 || o.rille > 0.5 || gB.boulderAt(x, z)) return;
    const k = m >= 0.95 ? T.mare : T.high, y = topOf(col, i), b = col.blocks[(y << 8) | i];
    k.n++; if (b === dark) k.dark++; if (b === reg || b === st('andesite') || b === st('diorite')) k.light++;
    let t = 0; while (t < 12 && (col.blocks[((y - t) << 8) | i] === reg || col.blocks[((y - t) << 8) | i] === dark)) t++; k.thick += t; k.h += y;
  });
  const fm = T.mare.dark / Math.max(1, T.mare.n), fh = T.high.light / Math.max(1, T.high.n);
  check(T.mare.n > 200 && fm > 0.75, 'the maria dark (regolith_dark on top)', (fm * 100).toFixed(0) + ' % of ' + T.mare.n);
  check(T.high.n > 200 && fh > 0.75, 'the highlands bright (regolith, andesite, diorite)', (fh * 100).toFixed(0) + ' % of ' + T.high.n);
  const tm = T.mare.thick / Math.max(1, T.mare.n), th = T.high.thick / Math.max(1, T.high.n);
  check(th >= 3 && tm <= 2.2 && th > tm + 1, 'regolith thicker on the old highlands', 'highlands ' + th.toFixed(1) + ' blocks, maria ' + tm.toFixed(1));
  check(T.high.h / Math.max(1, T.high.n) > T.mare.h / Math.max(1, T.mare.n) + 2, 'the maria lie lower (lava filled the basins)', (T.high.h / T.high.n - T.mare.h / T.mare.n).toFixed(1) + ' m');
}
{
  // the landmark: a young complex crater by the landing
  const L = gB.landmark;
  check(L && L.kind === 'complex' && L.D >= 300 && Math.hypot(L.x, L.z) < 600 && L.rays, 'the landmark: a young complex crater (D ' + (L ? L.D : '?') + ' m = ' + (L ? (L.D * 64 / 1000).toFixed(0) : '?') + ' km real) ' + (L ? Math.hypot(L.x, L.z).toFixed(0) : '?') + ' m from the landing, rays');
  const yC = gB.surfaceY(Math.round(L.x), Math.round(L.z)), yF = gB.surfaceY(Math.round(L.x + L.shape.floorR * 0.6), Math.round(L.z)), yR = gB.surfaceY(Math.round(L.x + L.R), Math.round(L.z)), yO = gB.surfaceY(Math.round(L.x + L.R * 3.2), Math.round(L.z));
  check(yC > yF + 2 && yR > yF + 25 && yR > yO + 4, 'in the world: the peak over the floor, the rim far over the floor and over the plain', `peak ${yC} · floor ${yF} · rim ${yR} · plain ${yO}`);
  // bare rock in its fresh walls, bright ejecta and rays on the dark mare round it
  let rock = 0, wall = 0, rays = 0, ray = 0;
  for (let a = 0; a < 64; a++) {
    const th = a / 64 * Math.PI * 2, x = Math.round(L.x + Math.cos(th) * L.R * 0.85), z = Math.round(L.z + Math.sin(th) * L.R * 0.85);
    const col = gB.generate(x >> 4, z >> 4), i = ((z & 15) << 4) | (x & 15), y = topOf(col, i), b = col.blocks[(y << 8) | i];
    wall++; if (b !== st('regolith') && b !== st('regolith_dark')) rock++;
    for (const f of [1.6, 2.4, 3.2]) {
      const x2 = Math.round(L.x + Math.cos(th) * L.R * f), z2 = Math.round(L.z + Math.sin(th) * L.R * f);
      if (gB.rayAt(x2, z2) > 0.5 && !gB.boulderAt(x2, z2)) { ray++; const c2 = gB.generate(x2 >> 4, z2 >> 4), i2 = ((z2 & 15) << 4) | (x2 & 15), b2 = c2.blocks[(topOf(c2, i2) << 8) | i2]; if (b2 === st('regolith') || b2 === st('diorite')) rays++; }
    }
  }
  check(rock / wall > 0.4, 'bare rock in the fresh walls', (rock / wall * 100).toFixed(0) + ' % of the wall\'s top');
  check(ray > 10 && rays / ray > 0.9, 'its rays bright on the dark mare', rays + ' of ' + ray + ' ray points light');
}
{
  // boulders round fresh craters: loose blocks standing on the surface, counted round young and old craters alike (an
  // old crater counted only where no fresh one's boulder field reaches it)
  const all = gB.cratersBox(-3000, -3000, 3000, 3000, true), list = all.filter(c => c.D >= 16 && c.D <= 80 && Math.hypot(c.x, c.z) > 300);
  const freshNear = (c) => all.some(f => f.fresh && f.D >= 12 && f !== c && Math.hypot(f.x - c.x, f.z - c.z) < 2.5 * c.R + 2.3 * f.R);
  const young = list.filter(c => c.age < PB.craters.boulders).slice(0, 12), old = list.filter(c => c.age > 0.6 && !freshNear(c)).slice(0, 12);
  const count = (c) => gB.bouldersNear(c.x, c.z, c.R * 2.5).length;
  const by = young.reduce((a, c) => a + count(c), 0) / Math.max(1, young.length), bo = old.reduce((a, c) => a + count(c), 0) / Math.max(1, old.length);
  check(young.length >= 5 && old.length >= 5 && by > 5 && bo === 0, 'boulders round fresh craters, none round old ones', 'per crater: young ' + by.toFixed(1) + ' (' + young.length + '), old ' + bo.toFixed(1) + ' (' + old.length + ')');
}
{
  // rilles: sinuous channels in the maria only
  let inMare = 0, outMare = 0, deep = 0;
  for (let k = 0; k < 40000; k++) {
    const x = (k % 200) * 41 - 4100 + 60000, z = Math.floor(k / 200) * 41 - 4100;
    const r = gB.rilleAt(x, z);
    if (r > 0.5) { if (gB.mareAt(x, z) > 0.8) inMare++; else outMare++; if (gB.rilleDepth(x, z) >= 3) deep++; }
  }
  check(inMare > 20 && outMare === 0 && deep > 0, 'rilles in the maria only, 3 m deep or more', inMare + ' samples in rilles');
  const w = gB.rilleWidth();
  check(w[0] >= 16 && w[1] <= 47, 'rilles 16–47 m wide (1–3 km real)', w.join('–') + ' m');
}

// ================================================================ e · Opal's ground
console.log('e · Opal\'s ground');
{
  const tho = st('tholin_ice'), bright = new Set([S.snowblock, S.packed, S.ice, S.blueice, S.snow1, S.calcite]);
  let n = 0, br = 0, lin = 0, linT = 0;
  tally(gO, [20, 27], [-40, -33], (col, i, x, z) => {
    const y = topOf(col, i), b = col.blocks[(y << 8) | i]; n++;
    if (gO.lineaAt(x, z) > 0.5) { lin++; if (b === tho || col.blocks[((y - 1) << 8) | i] === tho) linT++; }
    else if (bright.has(b)) br++;
  });
  check(n && br / (n - lin) > 0.9, 'bright ice outside the lineae (snow, packed and blue ice)', (br / (n - lin) * 100).toFixed(0) + ' %');
  check(lin > 30 && linT / lin > 0.85, 'the lineae of tholin ice', lin + ' columns, ' + (linT / lin * 100).toFixed(0) + ' % tholin');
  const ws = gO.lineaWidths(-20000, -20000, 20000);
  check(ws.length > 20 && Math.min(...ws) >= 16 && Math.max(...ws) <= 31, 'lineae 16–31 m wide (1–2 km real, R§5.6)', ws.length + ' lines, ' + Math.min(...ws).toFixed(1) + '–' + Math.max(...ws).toFixed(1) + ' m');
}
{
  const V0 = gO.vents();
  const byStripe = [0, 1, 2, 3].map(j => V0.filter(v => v.stripe === j).length);
  check(byStripe.length === 4 && byStripe.every(n => n >= 6), 'four tiger stripes, ≥ 6 vents each', byStripe.join(' · '));
  check(V0.every(v => v.z > 150 && Math.abs(v.x) < 1300), 'south of the landing, toward Amarant', 'z ' + Math.min(...V0.map(v => v.z)).toFixed(0) + '–' + Math.max(...V0.map(v => v.z)).toFixed(0));
  let inTrough = 0;
  for (const v of V0) { const y = gO.surfaceY(Math.round(v.x), Math.round(v.z)), yf = gO.surfaceY(Math.round(v.x), Math.round(v.z) + 40); if (y < yf - 3) inTrough++; }
  check(inTrough === V0.length, 'every vent deep in its trough (≥ 3 m under the flank 40 m away)', inTrough + ' of ' + V0.length);
  const s0 = gO.stripeProfile(0, 0);
  check(Math.abs(s0.width - 31) < 1 && s0.depth >= 6, 'a stripe: a trough 31 m wide (2 km real), ' + s0.depth.toFixed(1) + ' m deep, ridges on its flanks', 'flank +' + s0.flank.toFixed(1) + ' m');
  const vy = V0[0].y, vc = gO.generate(Math.floor(V0[0].x) >> 4, Math.floor(V0[0].z) >> 4), vi = ((Math.floor(V0[0].z) & 15) << 4) | (Math.floor(V0[0].x) & 15);
  check(vc.blocks[((vy + 1) << 8) | vi] === 0 && vc.blocks[(vy << 8) | vi] === 0, 'a vent is an open hole in the trough floor', 'at y ' + vy);
  let chaos = 0, plates = new Set();
  for (let k = 0; k < 20000 && chaos < 400; k++) { const x = (k * 7919) % 30000 - 15000, z = (k * 104729) % 30000 - 15000; const c = gO.chaosAt(x, z); if (c) { chaos++; plates.add(c.id); } }
  check(chaos > 50 && plates.size > 20, 'chaos: plates of ice in a darker matrix', chaos + ' samples on ' + plates.size + ' plates');
}

// ================================================================ f · spawns, determinism, borders
console.log('f · spawns, determinism, chunk borders');
for (const [g, name] of [[gB, 'Basalt'], [gO, 'Opal']]) {
  const s = g.findSpawn(0, 0);
  const x = Math.floor(s[0]), y = Math.floor(s[1]), z = Math.floor(s[2]), col = g.generate(x >> 4, z >> 4), i = ((z & 15) << 4) | (x & 15);
  const below = col.blocks[((y - 1) << 8) | i], at = col.blocks[(y << 8) | i], above = col.blocks[((y + 1) << 8) | i];
  check(Math.hypot(s[0], s[2]) < 200 && below && (R.T.flags[below] & V.F.SOLID) && !at && !above && Number.isFinite(s[3]), name + ': the spawn stands on ground near the landing, two blocks of air, a yaw', s.map(v => v.toFixed(1)).join(', ') + ' on ' + typeOf(below));
}
{
  const a = new BG(SEED, 'basalt', {}).generate(3, -2), b = new BG(SEED, 'basalt', {}).generate(3, -2);
  check(a.blocks.every((v, i) => v === b.blocks[i]), 'the same seed, the same chunk (two generators)');
  const c = new BG(SEED + 1, 'basalt', {}).generate(3, -2);
  check(!a.blocks.every((v, i) => v === c.blocks[i]), 'another seed, another chunk');
  let bad = 0;
  for (const g of [gB, gO]) for (let cz = -3; cz < 3; cz++) for (let cx = -3; cx < 3; cx++) {
    const col = g.generate(cx, cz);
    for (let i = 0; i < 256; i++) { const x = cx * 16 + (i & 15), z = cz * 16 + (i >> 4); if (Math.abs(topOf(col, i) - g.surfaceY(x, z)) > 1 && !g.boulderAt(x, z)) bad++; }
  }
  check(bad === 0, 'surfaceY agrees with the generated tops (borders included)', bad + ' columns off');
  const col = gB.generate(0, 0);
  check(col.blocks.length === 65536 && col.biome.length === 256 && col.caveBiome.length === 256 && col.tints.grass.length === 256 && Array.isArray(col.chests) && Array.isArray(col.spawns), 'a column: blocks, biome, caveBiome, tints, chests, spawns (the worker\'s shape)');
  check(col.biome.every(b => V.BIOMES[b] && V.BIOMES[b].moon === 'basalt') && gO.generate(0, 0).biome.every(b => V.BIOMES[b] && V.BIOMES[b].moon === 'opal'), 'every column in a moon biome of its body');
  const cl = gB.climateAt(5, 7);
  check(gB.biomeFor(cl, gB.surfaceY(5, 7)) === gB.biomeAt(5, 7) && typeof gB.tints(0, 0).water.length === 'number', 'climateAt + biomeFor = biomeAt (the worker\'s relight path), tints');
}

// ================================================================ g · walking
console.log('g · walking: the jump, the fall');
{
  const ground = 72, stone = S.stone;
  const world = { getBlock: (x, y, z) => (y < ground ? stone : 0), isLoaded: () => true, nbFn: () => () => 0, topAt: () => ground - 1, col: () => null, getLight: () => 15 << 12 };
  const mk = (dim, mode) => { const game = { world, ui: null, audio: null, starships: null, gadgets: null, zoom: false, difficulty: 'normal', worldSpawn: () => [0, 100, 0], statusSpeed: 0, dim, settings: {} }; const p = new V.Player(game); p.mode = mode || 'creative'; p.teleport(0.5, ground, 0.5); return p; };
  let jumpNow = false;
  const input = { sensitivity: 0.0024, invertY: false, captured: false, dragLook: false, mouse: { dx: 0, dy: 0, wheel: 0, down: [false, false, false], clicked: [false, false, false] }, hit: () => false, down: (c) => c === 'Space' && jumpNow, dbl: () => false };
  const jump = (dim) => {
    const p = mk(dim), dt = 1 / 60; let top = 0, t = 0, left = false;
    for (let k = 0; k < 10; k++) p.update(dt, input);
    jumpNow = true; p.update(dt, input); jumpNow = false;
    for (let k = 0; k < 60 * 40; k++) { p.update(dt, input); t += dt; top = Math.max(top, p.pos[1] - ground); if (p.pos[1] > ground + 0.05) left = true; if (left && p.onGround) break; }
    return { top, t };
  };
  const jo = jump('opal'), jb = jump('basalt'), jh = jump('overworld');
  check(Math.abs(jo.top - 27.6) <= 0.5, 'a jump on Opal 27.6 ± 0.5 m high (9.1 m/s at 1.50 m/s², U§4.3)', jo.top.toFixed(2) + ' m, ' + jo.t.toFixed(1) + ' s in the air');
  check(Math.abs(jo.t - 12.1) < 0.4, 'and 12.1 s in the air', jo.t.toFixed(2) + ' s');
  check(Math.abs(jb.top - 8.4) < 0.3 && Math.abs(jh.top - 1.38) < 0.1, 'on Basalt 8.4 m, at home 1.38 m (the genre\'s jump stays)', jb.top.toFixed(2) + ' · ' + jh.top.toFixed(2));
  // the fall damage dealt on landing (counted at the call: the natural regeneration may heal a point in the same frame)
  const fall = (dim, h) => { const p = mk(dim, 'survival'); p.health = 20; let hurt = 0; const d0 = p.damage.bind(p); p.damage = (n, c, s) => { if (c === 'fall') hurt += n; d0(n, c, s); }; p.teleport(0.5, ground + h, 0.5); const dt = 1 / 60; for (let k = 0; k < 60 * 60; k++) { p.update(dt, input); if (p.onGround) break; } for (let k = 0; k < 5; k++) p.update(dt, input); return hurt; };
  const dO = fall('opal', 25), dH = fall('overworld', 6), dO2 = fall('opal', 90);
  check(dO === 0, 'a 25-m fall on Opal hurts nothing (it counts as 1.25 m at home)', dO);
  check(dH > 0 && dO2 > 0, 'a 6-m fall at home hurts as before; 90 m on Opal (4.5 m at home) hurts too', dH + ' · ' + dO2);
}

// ================================================================ i · the sky, the light, the geysers, the suit
console.log('i · the sky and the light (bodysky.js), the geysers and the suit (bodylife.js, klang.js)');
{
  for (const f of ['klang', 'bodysky', 'bodylife', 'i18n', 'lang_en', 'lang_de']) require('../src/main/' + f + '.js');
  const BS = V.BodySky, BLf = V.BodyLife, U = V.Universe, D2 = 180 / Math.PI, eye = [0.5, 73.6, 0.5];
  // Basalt by day (t 0: Helia 27.6° high) and by night (t 1200: Helia −23°, Amarant 32.8° high and full)
  const day = BS.compute('basalt', eye, 0, { tier: 3 }), night = BS.compute('basalt', eye, 1200, { tier: 3 });
  check(day && day.light.lightK > 0.99 && Math.abs(day.light.sunDir[1] - Math.sin(27.6 / D2)) < 0.01, 'Basalt by day: Helia\'s whole disc over the horizon, the light from its true direction', (day.light.sunEl * D2).toFixed(1) + '°');
  const amb = day.light.ambSky[1] / day.light.sunColor[1], sky0 = day.sky;
  check(amb > 0.005 && amb < 0.12, 'the shadows\' light is the dark dust\'s bounce (no sky light)', (amb * 100).toFixed(1) + ' % of the sun');
  check(Math.abs(Math.asin(1 / sky0.par[3]) * D2 - 4.91) < 0.05, 'Amarant at its true size from Basalt (9.8° wide)', (2 * Math.asin(1 / sky0.par[3]) * D2).toFixed(2) + '°');
  const open = (s) => Math.abs(Math.asin(s.par[0] * s.pole[0] + s.par[1] * s.pole[1] + s.par[2] * s.pole[2])) * D2;
  check(open(sky0) < 2.5, 'its ring nearly edge-on from Basalt (Basalt orbits in the ring\'s plane, 1.5°)', open(sky0).toFixed(2) + '°');
  check(night.light.lightK === 0 && night.light.sunDir[1] < -0.99 && night.light.sunColor[1] === 0 && night.light.moonColor[1] > 0.005 && night.light.moonDir[1] > 0.5, 'Basalt by night: no sunlight at all, Amarant\'s light from Amarant', 'Amarant\'s light ' + night.light.moonColor[1].toFixed(3));
  check(night.expo > day.expo * 2 && night.sky.sunK[2] > day.sky.sunK[2], 'the eye opens at night, the stars come out', day.expo + ' → ' + night.expo);
  check(Math.abs(day.light.dip - Math.sqrt(2 * 1.6 / PB.R)) < 1e-4 && day.sky.ground[3] === day.light.dip, 'the far ground below the true horizon: dip √(2h/R)', (day.light.dip * D2).toFixed(2) + '°');
  // Helia sinking: the light goes out as its disc crosses the true horizon (no air, no twilight), not over ±7°
  let tSet = 0; for (let t = 300; t < 900; t += 2) { const r = BS.compute('basalt', eye, t, {}); if (r.light.sunEl < 0) { tSet = t; break; } }
  const a0 = BS.compute('basalt', eye, tSet - 20, {}).light, a1 = BS.compute('basalt', eye, tSet + 20, {}).light;
  check(a0.lightK > 0.99 && a1.lightK === 0 && a0.sunColor[1] * Math.max(0.05, ((x) => { let q = (x + 0.12) / 0.24; q = Math.max(0, Math.min(1, q)); return q * q * (3 - 2 * q); })(a0.sunDir[1])) > 2.5, 'the sunset is a step: full light 20 s before Helia\'s disc sinks, none 20 s after', 'set at t ' + tSet + ' s');
  // Opal: Amarant 26.8° wide, fixed in the south; the eclipse
  const o0 = BS.compute('opal', eye, 1200, {}), oe = BS.compute('opal', eye, 3420, {});
  check(Math.abs(2 * Math.asin(1 / o0.sky.par[3]) * D2 - 26.75) < 0.2 && o0.sky.par[2] > 0.7 && Math.abs(o0.light.parEl * D2 - 34.8) < 1, 'Opal: Amarant 26.8° wide, 35° high in the south (locked)', (2 * Math.asin(1 / o0.sky.par[3]) * D2).toFixed(2) + '°, az ' + (Math.atan2(o0.sky.par[0], o0.sky.par[2]) * D2).toFixed(0) + '°');
  check(open(o0.sky) < 4, 'its ring nearly edge-on from Opal (3°)', open(o0.sky).toFixed(2) + '°');
  check(oe.light.eclipse > 0.95 && oe.light.sunEl > 0.5 && oe.light.lightK < 0.05 && oe.light.sunColor[1] === 0 && oe.sky.sunK[1] < 0.05, 'the eclipse: Helia high behind Amarant, its light and glare gone', 'Helia ' + (oe.light.sunEl * D2).toFixed(0) + '° high, eclipse ' + oe.light.eclipse.toFixed(2));
  check(o0.light.ambSky[1] / Math.max(1e-6, o0.light.sunColor[1] * ((x) => { let q = (x + 0.12) / 0.24; q = Math.max(0, Math.min(1, q)); return q * q * (3 - 2 * q); })(o0.light.sunDir[1])) > amb * 3, 'Opal\'s bright ice lights its shadows far more than Basalt\'s dust');
  // the env: no air — no rain, wind, clouds, rays; the far land fades into the far ground's colour
  const E = { storm: [1, 0, 0, 0], bolt: [1, 0, 0, 0.5], rain: 1, wind: 2 }, env = { day: 0, ticks: 24000 * 0 + 0, timeOfDay: 0 };
  BS.env(E, env, { dim: 'basalt', renderDist: 8, biome: { key: 'basalt_mare' } }, 0.016);
  check(BS.want && E.rain === 0 && E.wind === 0 && E.cloudCover === 0 && E.rays === 0 && E.bolt[3] === 0 && E.fogColor === E.horizon && E.fog[0] > 64 && E.bodySky, 'the env on a moon: no rain, wind, clouds, rays; the haze is the far ground\'s colour; the sky\'s uniforms');
  const E2 = {}; BS.env(E2, env, { dim: 'overworld' }, 0.016);
  check(!BS.want && !E2.bodySky && Object.keys(E2).length === 1, 'at home BodySky leaves the env as it was (and the sky program without BODYSKY)');
  // the geysers: every 40–90 s for 10–18 s, the same for everyone, jets 2–3 km
  const vents = gO.vents(), prof = PO, g = V.DimReg.gravity('opal');
  let gaps = [], durs = [], tops = [], same = true;
  for (const v of vents.slice(0, 12)) {
    let last = null;
    for (let t = 0; t < 1200; t += 1) { const c = BLf.cycle(v, t, prof); if (!last || c.start !== last.start) { if (last) gaps.push(c.start - last.start); durs.push(c.dur); last = c; } }
    for (let t = 0; t < 600; t += 5) { const p = BLf.plume(v, t, prof, g); tops.push(p.top); const q = BLf.plume(v, t, prof, g); if (q.top !== p.top) same = false; }
  }
  check(Math.min(...gaps) >= 32 && Math.max(...gaps) <= 108 && Math.min(...durs) >= 10 && Math.max(...durs) <= 18, 'a vent erupts every 40–90 s (± a fifth) for 10–18 s', 'gaps ' + Math.min(...gaps).toFixed(0) + '–' + Math.max(...gaps).toFixed(0) + ' s, ' + Math.min(...durs).toFixed(0) + '–' + Math.max(...durs).toFixed(0) + ' s');
  check(Math.max(...tops) >= 1900 && Math.max(...tops) <= 3000.5 && same, 'the jets climb to 2–3 km under Opal\'s gravity (deterministic: host and guests alike)', 'highest ' + Math.max(...tops).toFixed(0) + ' m');
  const pv = BLf.plume(vents[0], BLf.cycle(vents[0], 300, prof).start + 5, prof, g);
  check(pv.firing && pv.top > 300 && pv.top < 600, 'five seconds into an eruption the ice is a few hundred metres up (v0 ≈ 85 m/s, not a rocket)', pv.top.toFixed(0) + ' m, v0 ' + pv.v0.toFixed(0) + ' m/s');
  // the suit, the pages
  check(V.Klang.breathEvery(0) === 3.6 && V.Klang.breathEvery(1) === 1.6, 'the suit\'s breath every 3.6 s at rest, 1.6 s after a sprint or a big jump');
  const I = V.I18N, pagesOk = BLf.PAGES.every(id => Array.isArray(I.dict.de['g.codex.moon.' + id]) && I.dict.de['g.codex.moon.' + id].length === 3 && Array.isArray(I.dict.en['g.codex.moon.' + id]));
  check(BLf.PAGES.length === 8 && pagesOk && I.dict.de['g.codex.cat.moons'] === 'Monde', 'eight codex pages „Monde", each with a name, a text and a hint in both languages');
  const st = JSON.parse(require('child_process').execFileSync(process.execPath, [__filename, '--sky-text'], { encoding: 'utf8', maxBuffer: 1 << 26 }).trim().split('\n').pop());
  check(st.n > 30 && st.diff === 0 && st.grow > 2000, 'space_shaders.js before shaders.js: every program without BODYSKY is the text it was (' + st.n + ' sources × 4 define sets); BODYSKY adds the airless sky (' + st.grow + ' chars)');
}

// ================================================================ h · the column time
console.log('h · the column time');
{
  const ow = V.makeGen('overworld', SEED, { vgen: 12 });
  const coords = []; for (let k = 0; k < 24; k++) coords.push([((k * 7) % 11) - 5 + 200, ((k * 5) % 9) - 4 - 300]);
  const time = (g) => { for (const [cx, cz] of coords.slice(0, 4)) g.generate(cx + 50, cz + 50); const t0 = process.hrtime.bigint(); for (const [cx, cz] of coords) g.generate(cx, cz); return Number(process.hrtime.bigint() - t0) / 1e6 / coords.length; };
  const tw = time(ow), tb = time(new BG(SEED, 'basalt', {})), to = time(new BG(SEED, 'opal', {}));
  check(tb <= tw && to <= tw, 'a moon\'s chunk no slower than the overworld\'s', 'overworld ' + tw.toFixed(1) + ' ms · Basalt ' + tb.toFixed(1) + ' ms · Opal ' + to.toFixed(1) + ' ms a chunk');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
