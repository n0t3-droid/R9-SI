// f-polish (docs/superpowers/plans/2026-10-31-f-polish.md): the pure parts of the eight loose ends, every rule a check
//   a · Herzwelt's port: found on forest / snow / hill ground (a-life's strict search found none), deterministic per seed,
//       never on built ground, null while too little is loaded
//   b · the boss's cracks: no piece floats over a step (corners within 0.6 m), flat ground keeps the whole strip
//   c · the boss's hull: a dark under-hull and an emissive red-violet rim (rpg_walker2); _base keeps a-boss2's
//   d · an exo day's exposure: the sky's exposed mean ≤ 0.4 (never below half the base), a dim sky untouched
//   e · the stamp ghost's edges: a box's twelve, the coplanar seams none, an L its folds
//   f · the swarm's arrival: by the biggest body, D/2 + 700 m off its centre, on its sunlit side
//   g · the worlds' melt: the tint in the terrain shader behind LIGHT2 (Very Low's text unchanged: vl_programs.js)
//   h · the texts: none new (lang.js)
//   bash test/wt_run.sh polish.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '../src/');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
global.window = global.window || { addEventListener() {} };
global.performance = global.performance || { now: () => Date.now() };
const tryReq = (f) => { try { require(SRC + f); return true; } catch (e) { console.log('  (' + f + ': ' + String(e.message).slice(0, 120) + ')'); return false; } };
for (const f of ['main/peace.js', 'main/lifekit.js', 'main/padlife.js', 'main/ferries.js']) if (fs.existsSync(SRC + f)) tryReq(f);

console.log('a · Herzwelt\'s port');
{
  const Fe = V.Ferries;
  check(Fe && typeof Fe.herzPick === 'function', 'VR.Ferries.herzPick');
  const h = (x, z, s) => { let v = (x * 374761393 + z * 668265263 + s * 1442695041) | 0; v = (v ^ (v >>> 13)) * 1274126177; return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
  // a forest's edge on a gentle hill: ±1 m bumps, a fifth of the columns not plain ground (roots, a stone, a stump)
  const forest = (x, z) => ({ y: 70 + Math.round(Math.sin(x * 0.05) * 2 + h(x, z, 1)), nat: h(x, z, 2) > 0.2, built: false });
  const sp = [100, 70, -40];
  const a = Fe.herzPick(sp, 4242, forest, 24), b = Fe.herzPick(sp, 4242, forest, 24), c = Fe.herzPick(sp, 77, forest, 24);
  check(!!a && a.loose === 1, 'a forest\'s edge: a site where a-life\'s strict rule found none ' + JSON.stringify(a));
  check(a && b && a.x === b.x && a.z === b.z, 'the same seed, the same site');
  check(a && c && (a.x !== c.x || a.z !== c.z), 'another seed turns the rings: another site ' + JSON.stringify(c));
  const d = a ? Math.hypot(a.x - sp[0], a.z - sp[2]) : 0;
  check(d >= 33 && d <= 120, `34–118 m from the spawn (${d.toFixed(0)} m)`);
  const flat = (x, z) => ({ y: 64, nat: true, built: false });
  const f = Fe.herzPick(sp, 4242, flat, 24);
  check(!!f && !f.loose, 'open flat ground: the strict rule still wins');
  check(Fe.herzPick(sp, 4242, () => null, 24) === null, 'nothing loaded: null (asked again in a second)');
  check(Fe.herzPick(sp, 4242, (x, z) => ({ y: 64, nat: false, built: true }), 24) === null, 'built ground everywhere: no port');
  const cliff = (x, z) => ({ y: 60 + ((x >> 2) & 7) * 3, nat: true, built: false });
  check(Fe.herzPick(sp, 4242, cliff, 24) === null, 'a staircase of 3-m steps: no port (the pad would float)');
}

console.log('b · the boss\'s cracks');
{
  V.VOXMODELS = V.VOXMODELS || {};
  tryReq('shared/rpg.js'); tryReq('main/voxmodels.js'); tryReq('main/rpg_boss2.js');
  const B2 = V.RPGBoss2;
  check(B2 && typeof B2.crackStrip === 'function', 'VR.RPGBoss2.crackStrip');
  const step = (x, z) => (x < 5 ? 70 : x < 7.4 ? 71 : 72);   // one-block steps at x = 5 and 7.4 (a stair of half blocks too)
  const P = []; const pv = (x, y, z) => P.push([x, y, z]);
  const r = B2.crackStrip(step, 0.3, 2.2, 10.7, 3.1, 0.7, pv, true);
  // a piece's gap: its height against the ground under its inside (samples between its corners, off the borders)
  const gapOf = (Q, i) => { const ym = Q.slice(i, i + 6).reduce((a, p) => a + p[1], 0) / 6 - 0.05; let gmax = 0; for (const a of [0.15, 0.5, 0.85]) for (const b of [0.15, 0.5, 0.85]) { const A = Q[i], Bq = Q[i + 1], C = Q[i + 2]; const x = A[0] + (Bq[0] - A[0]) * a + (C[0] - Bq[0]) * b; gmax = Math.max(gmax, Math.abs(ym - step(x, 0))); } return gmax; };
  let worst = 0; for (let i = 0; i < P.length; i += 6) worst = Math.max(worst, gapOf(P, i));
  check(r.dropped >= 1 && r.kept >= 6, `stepped ground: ${r.kept} pieces kept, ${r.dropped} over a step dropped`);
  check(worst <= 0.6 + 1e-6, `every kept piece on its own ground (worst gap ${worst.toFixed(2)} m)`);
  const P0 = []; B2.crackStrip(step, 0.3, 2.2, 10.7, 3.1, 0.7, (x, y, z) => P0.push([x, y, z]), false);
  let worst0 = 0; for (let i = 0; i < P0.length; i += 6) worst0 = Math.max(worst0, gapOf(P0, i));
  check(worst0 > 0.3, `a-boss2's strip bridged the step (a gap of ${worst0.toFixed(2)} m) — the before`);
  const P1 = []; const r1 = B2.crackStrip(() => 64, 0, 0, 7.5, 2.5, 0.5, (x, y, z) => P1.push([x, y, z]), true);
  let L = 0; for (let i = 0; i < P1.length; i += 6) { const a = [(P1[i][0] + P1[i + 1][0]) / 2, (P1[i][2] + P1[i + 1][2]) / 2], b = [(P1[i + 2][0] + P1[i + 5][0]) / 2, (P1[i + 2][2] + P1[i + 5][2]) / 2]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  check(r1.dropped === 0 && Math.abs(L - Math.hypot(7.5, 2.5)) < 0.3, `flat ground: the whole strip (${L.toFixed(2)} of ${Math.hypot(7.5, 2.5).toFixed(2)} m), pieces ≤ 0.9 m`);
}

console.log('c · the boss\'s hull');
{
  const hadF = !!V.Foes; if (!hadF) V.Foes = { stub: true };   // (rpg_boss.js wants VR.Foes at load: the model part needs none)
  tryReq('main/rpg_boss.js'); if (!hadF) delete V.Foes;
  const M = V.VOXMODELS;
  if (M && M.rpg_walker2 && M.rpg_walker2_base) {
    const g = M.rpg_walker2().parts.hull.grid, g0 = M.rpg_walker2_base().parts.hull.grid;
    let em = 0, emRV = 0, darkLow = 0, low = 0, darkLow0 = 0;
    const lum = (c) => (((c >> 16) & 255) * 0.2126 + ((c >> 8) & 255) * 0.7152 + (c & 255) * 0.0722) / 255;
    for (let x = 0; x < 24; x++) for (let z = 0; z < 24; z++) for (let y = 0; y < 14; y++) {
      const v = g.get(x, y, z), v0 = g0.get(x, y, z);
      if (v && (v >> 24) & 1) { em++; if (((v >> 16) & 255) > 200 && (v & 255) > 100 && ((v >> 8) & 255) < 80) emRV++; }
      if (y < 6 && v) { low++; if (lum(v) < 0.25) darkLow++; }
      if (y < 6 && v0 && lum(v0) < 0.25) darkLow0++;
    }
    check(emRV >= 20 && emRV === em, `the rim: ${emRV} red-violet emissive voxels on the widest band`);
    check(darkLow / Math.max(1, low) > 0.8 && darkLow0 / Math.max(1, low) < 0.5, `the under-hull dark: ${(darkLow / low * 100).toFixed(0)} % of its voxels (a-boss2: ${(darkLow0 / low * 100).toFixed(0)} %)`);
  } else check(false, 'the walker models load in node');
}

console.log('d · an exo day\'s exposure');
{
  global.self = global;
  if (!V.ExoDayExpo) { const src = fs.readFileSync(SRC + 'main/starexo.js', 'utf8'); const m = src.match(/VR\.ExoDayExpo = (.*);\n/); if (m) V.ExoDayExpo = eval(m[1]); }
  const X = V.ExoDayExpo;
  check(typeof X === 'function', 'VR.ExoDayExpo');
  if (X) {
    const e1 = X(1.0, 0.65), e2 = X(1.0, 2.0), e3 = X(1.2, 0.2);
    check(Math.abs(e1 * 0.65 - 0.4) < 1e-6, `a bright peach sky (0.65): exposed 0.4 (expo ${e1.toFixed(2)}, was 1.00)`);
    check(Math.abs(e2 - 0.5) < 1e-6, `a blinding one: never below half the base (${e2.toFixed(2)})`);
    check(e3 === 1.2 && X(1, 0) === 1, 'a dim sky and no air: untouched');
  }
  { const src0 = fs.readFileSync(SRC + 'main/starexo.js', 'utf8'), m = src0.match(/VR\.ExoSkyK = (.*);\n/); const K = V.ExoSkyK || (m && eval(m[1]));
    check(K && Math.abs(K(5800) - 1) < 1e-9 && K(2977) < 0.45 && K(2977) >= 0.35 && K(9000) <= 1.15, `a cool star's air scatters less: the sky ×${K && K(2977).toFixed(2)} under a 2977-K red dwarf, ×${K && K(9000).toFixed(2)} under a 9000-K star`); }
  const src = fs.readFileSync(SRC + 'main/starexo.js', 'utf8');
  check(/air3\[i\] \*= kx|a3\[i\] \*= kx\[i % 3\]/.test(src) && /Polish\.off\.exo/.test(src), 'the air\'s stops in the star\'s colour, behind the switch');
}

console.log('e · the stamp ghost\'s edges');
{
  tryReq('main/stamp.js');
  const ST = V.Stamp;
  const box = ST.make(2, 2, 2); box.data.fill(1);
  const one = ST.make(1, 1, 1); one.data[0] = 1;
  const Lm = ST.make(2, 1, 2); Lm.data[0] = 1; Lm.data[1] = 1; Lm.data[2] = 1;   // (x, z): (0,0) (1,0) (0,1)
  const gb = ST.ghost(box, () => [0.5, 0.5, 0.5]), g1 = ST.ghost(one, () => [0.5, 0.5, 0.5]), gL = ST.ghost(Lm, () => [0.5, 0.5, 0.5]);
  const n = (G) => (G.lines ? G.lines.length / 6 : -1), len = (G) => { let s = 0; for (let i = 0; i < G.lines.length; i += 6) s += Math.hypot(G.lines[i + 3] - G.lines[i], G.lines[i + 4] - G.lines[i + 1], G.lines[i + 5] - G.lines[i + 2]); return s; };
  check(n(g1) === 12, `one block: 12 edges (${n(g1)})`);
  check(gb.lines && Math.abs(len(gb) - 24) < 1e-6, `a 2 × 2 × 2 box: its twelve 2-m edges (${n(gb)} unit lines, ${gb.lines && len(gb)} m) — no seams on the faces`);
  check(gL.lines && Math.abs(len(gL) - 22) < 1e-6, `an L of three: its folds (${gL.lines && len(gL)} m: two outlines of 8 and six posts)`);
  check(gb.verts.length === gb.faces * 18, 'the triangles as before (stamp.js\'s checks)');
}

console.log('f · the swarm\'s arrival');
{
  tryReq('shared/bodytex.js'); tryReq('main/i18n.js'); tryReq('main/cruise.js'); tryReq('main/fields.js'); tryReq('main/fields2.js');
  const F2 = V.Fields2 || V.F2;
  const fn = F2 && F2.swarmEnd;
  check(typeof fn === 'function', 'VR.Fields2.swarmEnd');
  if (fn) {
    const B = V.Rubble.swarm().bodies; let k = 0; for (let i = 1; i < B.length; i++) if (B[i].D > B[k].D) k = i;
    const sun = [0.6, 0.0, -0.8], rel = [2500, 0, 0], e = fn(rel, sun), o = F2.rockOff(k);
    const off = [e.r[0] - o[0], e.r[1] - o[1], e.r[2] - o[2]], d = Math.hypot(...off);
    check(e.k === k && Math.abs(d - (B[k].D / 2 + 700)) < 1e-6, `by the biggest body (rock.${k}, ${B[k].D} m): ${d.toFixed(0)} m off its centre`);
    check((off[0] * sun[0] + off[1] * sun[1] + off[2] * sun[2]) / d > 0.5, 'on its sunlit side');
    const lk = e.look[0] * off[0] + e.look[1] * off[1] + e.look[2] * off[2];
    check(lk / d < -0.999, 'the nose on the body');
  }
}

console.log('g · the worlds\' melt');
{
  const s = fs.readFileSync(SRC + 'main/shaders.js', 'utf8'), i = s.indexOf('u_dim == 5 && u_lavaTint');
  const before = s.lastIndexOf('#ifdef LIGHT2', i), endif = s.lastIndexOf('#endif', i);
  check(i > 0 && before > endif, 'the melt\'s tint behind LIGHT2 (Low and up)');
  check(/u_lavaTint/.test(fs.readFileSync(SRC + 'main/renderer.js', 'utf8')), 'the renderer sets it (VR.Polish.off.lava: the base\'s)');
  const ld = s.indexOf('u_dim == 5 && u_lavaTint', i + 10), ldB = s.lastIndexOf('#ifdef LIGHT2', ld), ldE = s.lastIndexOf('#endif', ld);
  check(ld > 0 && ldB > ldE, 'the far tiles\' melt too (LOD_FS, behind LIGHT2)');
  const bsrc = fs.readFileSync(SRC + 'main/bodysky.js', 'utf8'), lc = bsrc.match(/lakeC: (.*)\n/);
  check(!!lc && /Polish\.off\.lava/.test(lc[1]) && /\[1\.0, 0\.24, 0\.03\]/.test(lc[1]), 'the sky\'s far Glutsee deep orange (G/R 0.24, was 0.42)');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
