// Die Ankunft (f-arrival; plan docs/superpowers/plans/2026-10-23-f-arrival.md; review docs/reviews/v0.49.md R50-02,
// R50-06) — node only, real blocks where the eye is the judge:
//   1 · the floating tree tops: no leaf in the wow vistas' view cones of seeds 53 and 4242 floats — a leaf with no leaf,
//       log or solid block among its six neighbours, or a leaf group of up to 12 with none of them touching a log or the
//       ground (vgen 13; vgen 12's counted, the before)
//   2 · old worlds keep every chunk: vgen 12's chunks under those cones (seed 53) hash as pinned before this front touched
//       the generator (vgen 13's own pin: test/gen_same.js EXPECT13)
//   3 · the arrival a new world opens on (the worker's records VR.Vista.arrivals → VR.First.pick → its camera), measured
//       with rays through the generated chunks (block by block to 140 blocks and in the landmark's footprint, the land's
//       surface beyond; the landmark = its own blocks above its base): the landmark ≥ 8 % of the frame, ≤ 10 % of it
//       hidden, nothing within 6 m in the frame's upper half — seeds 53, 4242, 31337, 7 (the before: vgen 12, t-first's
//       pick by score, the vista's own composition)
//   4 · VR.First.pick: the sight-ok wow vista with the best score; none ok → the best score; no records → none
//   5 · Heimkehr's facing (VR.Travel.facing): at Herzwelt's spawn of seed 4242 (the Hangar Hall, its craft 2 m behind
//       the pad) the view leaves the craft and the nearest geometry in the frame's centre third is ≥ 8 m away (the
//       ground under the feet not counted); a wall 2 m ahead turns the view; a vista's walk faces its view
//   bash test/wt_run.sh arrival.js 1800        (SEEDS=53,4242,… the arrival's seeds · ONLY=1,2,… some parts)
require('./dom_stub.js');
const V = require('./load_shared.js');
global.performance = global.performance || require('perf_hooks').performance;
for (const f of ['i18n.js', 'lang_en.js', 'lang_de.js', 'settings_reg.js', 'skybodies.js', 'weather.js', 'env.js', 'klang.js', 'audio.js', 'wowmoment.js', 'first.js', 'travel.js']) { try { require('../src/main/' + f); } catch (e) { console.log('  (' + f + ': ' + e.message + ')'); } }
const R = V.R, F = V.F, RT = R.T, LAND = V.Land, VI = V.Vista, FI = V.First, SEA = V.C.SEA;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, on = (k) => !ONLY || ONLY.includes(String(k));
const SEEDS = (process.env.SEEDS || '53,4242,31337,7').split(',').map(Number);
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
const DEG = Math.PI / 180;
const fnv = (h, a) => { for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
const hx = (v) => v.toString(16).padStart(8, '0');
const nameOf = (s) => (s ? R.types[RT.type[s]].name : 'air');
const isLeaf = (s) => !!(s && (RT.flags[s] & F.LEAVES));
const isLog = (s) => !!s && /_log$|_wood$|_stem$|hyphae$/.test(nameOf(s));
const holds = (s) => { if (!s || isLeaf(s)) return false; const f = RT.flags[s]; return isLog(s) || !!((f & F.OPAQUE) || ((f & F.SOLID) && !(f & F.PLANT))); };
const hits = (s) => { if (!s) return false; const f = RT.flags[s]; return !!((f & (F.OPAQUE | F.LEAVES | F.FLUID)) || ((f & F.SOLID) && !(f & F.PLANT))); };
function world(g) {
  const CH = new Map();
  const chunk = (cx, cz) => { const k = cx * 65536 + cz; let c = CH.get(k); if (!c) { c = g.generate(cx, cz).blocks; CH.set(k, c); if (CH.size > 1600) CH.delete(CH.keys().next().value); } return c; };
  const blockAt = (x, y, z) => (y < 0 || y > 255 ? 0 : chunk(x >> 4, z >> 4)[(y << 8) | ((z & 15) << 4) | (x & 15)]);
  const SURF = new Map();
  const surfAt = (x, z) => { const X = x >> 2, Z = z >> 2, k = X * 65536 + Z; let h = SURF.get(k); if (h === undefined) { h = g.surfaceY(X * 4 + 2, Z * 4 + 2); SURF.set(k, h); } return h; };
  return { chunk, blockAt, surfAt, CH };
}
// the wow vistas' view cones: 120 blocks toward the landmark, ±20° (the chunks they cross, in a fixed order)
function coneChunks(P) {
  const out = [], seen = new Set();
  for (const v of P.vistas.filter(q => q.wow)) {
    const fx = -Math.sin(v.yaw), fz = -Math.cos(v.yaw);
    for (let s = 0; s <= 120; s += 8) for (let a = -20; a <= 20; a += 5) {
      const ca = Math.cos(a * DEG), sa = Math.sin(a * DEG), dx = fx * ca - fz * sa, dz = fz * ca + fx * sa;
      const cx = Math.floor((v.eye[0] + dx * s) / 16), cz = Math.floor((v.eye[2] + dz * s) / 16), k = cx * 65536 + cz;
      if (!seen.has(k)) { seen.add(k); out.push([cx, cz]); }
    }
  }
  return out;
}
// the floating leaves of a chunk: single leaves with no hold among their six neighbours, and leaf groups (face-connected,
// up to 12) none of whose cells touches a log or a solid block
function floatingIn(W, cx, cz) {
  const b = W.chunk(cx, cz), found = [], LEAFSTATE = W.leafState || (W.leafState = new Map());   // (cell → 1 held, 2 floating: a group classified once, across chunks)
  const key = (x, y, z) => (x * 65536 + z) * 256 + y;
  const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (let y = 2; y < 254; y++) for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
    const s0 = b[(y << 8) | (lz << 4) | lx]; if (!isLeaf(s0)) continue;
    const x = cx * 16 + lx, z = cz * 16 + lz, k0 = key(x, y, z); if (LEAFSTATE.has(k0)) continue;
    // its group: the face-connected leaves, until one touches a hold (a log, the ground, a wall), meets a group already
    // held, or the group outgrows 12 (a crown)
    const vis = new Map([[k0, [x, y, z]]]), q = [[x, y, z]]; let held = false;
    while (q.length && !held && vis.size <= 12) {
      const [px, py, pz] = q.pop();
      for (const [dx, dy, dz] of N6) {
        const nx = px + dx, ny = py + dy, nz = pz + dz, s = W.blockAt(nx, ny, nz);
        if (holds(s)) { held = true; break; }
        if (!isLeaf(s)) continue;
        const k = key(nx, ny, nz), st = LEAFSTATE.get(k);
        if (st === 1) { held = true; break; }
        if (!vis.has(k)) { vis.set(k, [nx, ny, nz]); q.push([nx, ny, nz]); }
      }
    }
    if (vis.size > 12) held = true;
    for (const k of vis.keys()) LEAFSTATE.set(k, held ? 1 : 2);
    if (!held) found.push({ at: [x, y, z], n: vis.size, name: nameOf(s0) });
  }
  return found;
}

// ================================================================ 1 + 2 · the floating tree tops; old worlds keep their chunks
// vgen 12's chunks under the wow cones of seed 53, hashed before this front's first change (generator v0.49 + u-home)
const PIN12 = '827635fd';
if (on(1) || on(2)) {
  console.log('1 · the floating tree tops · 2 · vgen 12 kept');
  for (const SEED of [53, 4242]) {
    const row = {};
    for (const vgen of [12, 13]) {
      const g = V.makeGen('overworld', SEED, { vgen }), P = LAND.plan(g), W = world(g), cones = coneChunks(P);
      let h = 2166136261 >>> 0, leaves = 0; const fl = [];
      for (const [cx, cz] of cones) {
        const b = W.chunk(cx, cz);
        if (SEED === 53 && vgen === 12) h = fnv(h, b);
        for (let i = 0; i < b.length; i++) if (isLeaf(b[i])) leaves++;
        for (const f of floatingIn(W, cx, cz)) fl.push(f);
      }
      row[vgen] = { chunks: cones.length, leaves, fl, h: hx(h) };
    }
    const kinds = (fl) => { const m = new Map(); for (const f of fl) m.set(f.name, (m.get(f.name) || 0) + f.n); return [...m].map(([n, c]) => n + ' ' + c).join(', ') || 'none'; };
    console.log(`     seed ${SEED}: ${row[12].chunks} chunks in the wow cones · vgen 12: ${row[12].leaves} leaves, ${row[12].fl.length} floating (${kinds(row[12].fl)}) · vgen 13: ${row[13].leaves} leaves, ${row[13].fl.length} floating (${kinds(row[13].fl)}) (${secs()})`);
    if (on(1)) check(row[13].fl.length === 0, `seed ${SEED}, vgen 13: no floating leaf in the wow vistas' cones (${row[13].fl.length}${row[13].fl.length ? ': ' + row[13].fl.slice(0, 4).map(f => f.name + '@' + f.at.join(',') + (f.n > 1 ? '×' + f.n : '')).join(' ') : ''}; vgen 12 had ${row[12].fl.length})`);
    if (on(2) && SEED === 53) check(row[12].h === PIN12, `vgen 12 keeps every chunk under seed 53's wow cones (${row[12].chunks} chunks hash ${row[12].h}, pinned ${PIN12})`);
  }
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
