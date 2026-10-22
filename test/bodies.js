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
//   bash test/wt_run.sh bodies.js 300
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
check(PB && PO && B.ids.join() === 'basalt,opal', 'two bodies: basalt, opal', B.ids.join());
check(PB.kind === 'airless' && PO.kind === 'ice', 'kinds: Basalt airless (cratered), Opal ice');
check(Math.abs(PB.R - U.home.by.basalt.R) < 1 && Math.abs(PO.R - U.home.by.opal.R) < 1, 'radii from VR.Universe: Basalt ' + (PB.R / 1000).toFixed(2) + ' km, Opal ' + (PO.R / 1000).toFixed(2) + ' km (game)');
check(PB.g === 1.62 && PO.g === 0.49, 'g: Basalt 1.62, Opal 0.49 (U§2.1)');
check(Math.abs(PB.walk - 30 * 1.62 / 9.81) < 1e-9 && Math.abs(PO.walk - 30 * 0.49 / 9.81) < 1e-9, 'the walking gravity 30·g/9.81 (U§4.3)', PB.walk.toFixed(3) + ' · ' + PO.walk.toFixed(3));
check(B.BGEN === 1 && PB.bgen === 1 && PO.bgen === 1, 'bgen 1 for both');
check(D.has('basalt') && D.has('opal') && D.code('basalt') === 5 && D.code('opal') === 5 && D.sky('basalt') && D.sky('opal'), 'DimReg: basalt and opal, u_dim 5 (airless body), light from above');
check(D.g('basalt') === 1.62 && D.g('opal') === 0.49 && !D.actorsHome('basalt') && !D.actorsHome('opal'), 'DimReg: their g, no village life (actors none)');
check(D.get('basalt').travel && D.get('opal').travel && D.travelable({}).includes('basalt') && D.travelable({}).includes('opal'), '/dim reaches both (travel)');
check(V.makeGen('basalt', SEED, {}) instanceof BG && V.makeGen('opal', SEED, {}) instanceof BG, 'makeGen gives a BodyGen for each');
{
  const names = ['regolith', 'regolith_dark', 'tholin_ice'], types = names.map(n => R.byName[n]);
  check(types.every(Boolean), 'the blocks regolith, regolith_dark, tholin_ice exist');
  const last = R.types.slice(-3).map(t => t.name).join();
  check(last === names.join(), 'appended at the very end of the registry (VR.BL.late)', last);
  check(types.every(t => R.T.flags[t.defaultState] & V.F.OPAQUE), 'all three full opaque blocks');
  check(R.byName.regolith.o.smooth && R.byName.regolith_dark.o.smooth, 'the two dusts are natural ground (smooth slopes in Nahtlos)');
  check(names.every(n => R.texIndex[n] !== undefined && V.TEXREC && typeof V.TEXREC[n] === 'function') || !V.TEXREC, 'a procedural texture recipe each (tex_body.js)');
}
{
  const meta = {};
  B.stamp(meta);
  check(meta.universe && meta.universe.bodies && meta.universe.bodies.basalt.bgen === 1 && meta.universe.bodies.opal.bgen === 1, 'stamp: a save gets bgen 1 for each body');
  meta.universe.bodies.opal.bgen = 0.5; B.stamp(meta);
  check(meta.universe.bodies.opal.bgen === 0.5, 'stamp keeps what a save has (old worlds keep their moons)');
  check(JSON.stringify(B.bgenOf(meta)) === JSON.stringify({ basalt: 1, opal: 0.5 }), 'bgenOf → the genOpts table', JSON.stringify(B.bgenOf(meta)));
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
    k.n++; if (b === dark) k.dark++; if (b === reg || b === S.calcite) k.light++;
    let t = 0; while (t < 12 && (col.blocks[((y - t) << 8) | i] === reg || col.blocks[((y - t) << 8) | i] === dark)) t++; k.thick += t; k.h += y;
  });
  const fm = T.mare.dark / Math.max(1, T.mare.n), fh = T.high.light / Math.max(1, T.high.n);
  check(T.mare.n > 200 && fm > 0.75, 'the maria dark (regolith_dark on top)', (fm * 100).toFixed(0) + ' % of ' + T.mare.n);
  check(T.high.n > 200 && fh > 0.75, 'the highlands bright (regolith, calcite)', (fh * 100).toFixed(0) + ' % of ' + T.high.n);
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
      if (gB.rayAt(x2, z2) > 0.5 && !gB.boulderAt(x2, z2)) { ray++; const c2 = gB.generate(x2 >> 4, z2 >> 4), i2 = ((z2 & 15) << 4) | (x2 & 15), b2 = c2.blocks[(topOf(c2, i2) << 8) | i2]; if (b2 === st('regolith') || b2 === S.calcite) rays++; }
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
