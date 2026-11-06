// p-stream2 · the fine far level (src/shared/lod.js level -1, src/main/horizon.js FINE_D): 2-block cells near the camera
// while the chunks load. No browser:
//  a · LOD.cell: level -1 = 2 blocks, 0 = 4 (as before); a level -1 tile (64 blocks) builds, its vertices inside the tile,
//      with about as many trees per area as level 0 (a quarter per cell), cheaper than a level 0 tile
//  b · Horizon.shownUnder: a fine tile is needed only where its 16 columns are not all shown (or still fading in)
//  c · the selection (the real Horizon.update with a stub GL): standing in loaded land no fine tile is asked for (the old tiles); flying
//      into unloaded land the tiles round the camera are asked for at level -1, first (nearest); with the streaming plan
//      off, or ring 1 on (High/Ultra), never
//   bash test/wt_run.sh stream_fine.js
const V = require('./load_shared.js');
global.window = undefined;
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
// a GL that does nothing
const glStub = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k) ? 0 : () => ({}))) });
V.GL = V.GL || {}; V.GL.tex2D = () => ({});
V.ckey = V.ckey || ((cx, cz) => (cx + 32768) * 65536 + (cz + 32768));   // (world.js's key)
require('../src/main/horizon.js');
const H = V.Horizon;
const g1 = V.makeGen('overworld', 1, { worldType: 'default', vgen: 17 });

console.log('a · the level -1 tile');
{
  check(V.LOD.cell(-1) === 2 && V.LOD.cell(0) === 4 && V.LOD.cell(3) === 32, 'cells: 2, 4, 32 blocks');
  let ms0 = 0, ms1 = 0, t0n = 0, t1n = 0, inside = true, built = 0;
  for (let i = 0; i < 4; i++) {
    let t = performance.now(); const a = V.LOD.build(g1, { level: 0, tx: 2 + i, tz: -3 }); ms0 += performance.now() - t;
    t = performance.now(); const b = V.LOD.build(g1, { level: -1, tx: 4 + 2 * i, tz: -6 }); ms1 += performance.now() - t;
    if (b && b.count) built++;
    if (b && b.verts) { const v = new Int16Array(b.verts); for (let k = 0; k < v.length; k += 6) { const x = v[k] / 8, z = v[k + 2] / 8; if (x < -1 || x > 65 || z < -1 || z > 65) inside = false; } }
    t0n += a ? a.count : 0; t1n += b ? b.count : 0;
  }
  check(built === 4 && inside, 'level -1 tiles build, their vertices inside the 64-block tile');
  check(ms1 < ms0 * 1.2, 'a level -1 tile costs no more than a level 0 tile (it covers a quarter)', `${(ms1 / 4).toFixed(1)} vs ${(ms0 / 4).toFixed(1)} ms`);
}

console.log('b · shownUnder');
const mkWorld = (shownR, cx0, cz0) => {
  const cols = new Map(), fading = new Set();
  for (let dz = -12; dz <= 12; dz++) for (let dx = -12; dx <= 12; dx++) if (dx * dx + dz * dz <= shownR * shownR) { const c = { cx: cx0 + dx, cz: cz0 + dz, shownAt: 1, fade: 1 }; cols.set(V.ckey(cx0 + dx, cz0 + dz), c); }
  return { cols, fading, renderDist: 6, dim: 'overworld', seed: 1, genOpts: { worldType: 'default', vgen: 17 }, streamPlan: true };
};
{
  const w = mkWorld(10, 0, 0);
  check(H.shownUnder(w, 0, 0) && H.shownUnder(w, -1, -1), 'all 16 columns shown: not needed');
  w.fading.add(w.cols.get(V.ckey(1, 1)));
  check(!H.shownUnder(w, 0, 0), 'one of them still fading in: needed (it fills the dither)');
  w.cols.delete(V.ckey(2, 3));
  check(!H.shownUnder(w, 0, 0) && !H.shownUnder(null, 0, 0), 'one missing: needed');
}

console.log('c · the selection');
const sel = (w, opt) => {
  const asked = [];
  const g = { world: w, dim: 'overworld', renderer: { gl: glStub, q: { lite: false } }, tex: null, pool: { workers: [1], broadcast() {}, submit(m, tr, cb) { asked.push(m); cb({ type: 'lod', empty: false, verts: new ArrayBuffer(12), idx: new Uint16Array(3), count: 3, minY: 0, maxY: 1 }); } }, settings: {} };
  const h = new H(g); h.setLevel(1);
  if (opt && opt.far1) h.farOn = () => true, h.far = { update() {}, on: () => true, reset() {}, set: { bytes: 0 } }, h.updateMaskFar = () => {};
  h.updateMask = () => {};
  for (let i = 0; i < 12; i++) h.update({ x: 8, y: 100, z: 8, yaw: 0, pitch: 0, fov: 1.3 });   // (each tile ready at once: the coarse ring first, then finer)
  asked.drawn = h.drawList.length;
  return asked;
};
{
  // (the render distance's disk shown: the fine tiles inside it are not needed; the few at the corners beyond the disk replace
  // the level 0 tiles there — no more draws than without the fine level)
  for (const rd of [6, 4]) {
  const wl = mkWorld(rd, 0, 0); wl.renderDist = rd; const on = sel(wl); wl.streamPlan = false; const off = sel(wl);
  const fineL = on.filter(m => m.level === -1).length;
  check(fineL === 0 && on.drawn <= off.drawn, `standing in loaded land (render distance ${rd}): no fine tile, the same tiles drawn`, `${fineL} fine tiles, drawn ${off.drawn} → ${on.drawn}`);
  }
  const empty = sel(mkWorld(-1, 0, 0)), fine = empty.filter(m => m.level === -1);
  const i0 = empty.findIndex(m => m.level === -1), d0 = fine.length ? Math.hypot(fine[0].tx * 64 + 32 - 8, fine[0].tz * 64 + 32 - 8) : 1e9;
  check(fine.length >= 4 && empty.slice(0, i0).every(m => m.level >= 0) && d0 < 64, 'in unloaded land: once the coarse tiles stand, the fine tiles round the camera (the nearest first)', `${fine.length} of ${empty.length}`);
  const w2 = mkWorld(-1, 0, 0); w2.streamPlan = false;
  check(sel(w2).every(m => m.level !== -1), 'the streaming plan off: never (the old far tiles)');
  check(sel(mkWorld(-1, 0, 0), { far1: true }).every(m => m.level !== -1), 'ring 1 on (High, Ultra): never');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
