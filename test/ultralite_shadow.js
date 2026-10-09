// F9 · Schatten-Takt (src/main/ultralite.js VR.UL.Shadow + renderer.js shadowFrame), no browser:
//  a · the tile grid: tile size, the window centre and its hysteresis, the wrap offset, slots
//  b · the toroidal map: a point drawn into its tile lands on the texel the lookup reads (both matrices, random points)
//  c · the cadence: ring 0 every frame, ring 1 every 2nd, ring 2 every 4th (slow × 2 halves them)
//  d · the window moves: the tiles that enter (one strip per axis), a jump of a whole window is a full redraw; runs
//  e · a section's footprint: the tiles under its light-space box (every corner inside)
//  f · the sun step: the key steps by 0.25° (the renderer's quantum); the rebuild's slices cover every caster once
//  g · the renderer with a stub GL: a section upload marks only its tiles, the window walks by strips, a sun step is
//      spread over the slices, standing still draws nothing, Very Low (no takt) keeps the old path
//   bash test/wt_run.sh ultralite_shadow.js
const V = require('./load_shared.js');
global.window = undefined;
require('../src/main/gl.js'); require('../src/main/shaders.js'); require('../src/main/ultralite.js'); require('../src/main/renderer.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const UL = V.UL, SH = UL && UL.Shadow, M4 = V.mat4;
if (!SH) { console.log('VR.UL.Shadow missing'); console.log('FAILED 1'); process.exit(1); }

console.log('a · the tile grid');
check(SH.N === 16 && SH.tile(96) === 12 && SH.tile(64) === 8 && SH.tile(40) === 5, 'sixteen tiles a side: 12 blocks on shadows 3 (R 96), 8 on shadows 2, 5 on shadows 1');
{
  const T = 12;
  check(SH.center(null, 5.9, T) === 0 && SH.center(null, 6.1, T) === 12 && SH.center(null, -6.1, T) === -12, 'a new window centres on the nearest tile corner');
  check(SH.center(12, 12 + 8.9, T) === 12 && SH.center(12, 12 - 8.9, T) === 12, 'the window stays while the eye is within ¾ of a tile of its centre');
  check(SH.center(12, 12 + 9.2, T) === 24 && SH.center(12, 12 - 9.2, T) === 0, 'beyond ¾ of a tile it moves (to the nearest corner)');
  const off = SH.offset(24, 96);
  check(Math.abs(off - (((24 - 96) / 192) - Math.floor((24 - 96) / 192))) < 1e-12 && off >= 0 && off < 1, 'the wrap offset is frac((Wc − R) / 2R)', off);
  check(SH.slot(-1, 16) === 15 && SH.slot(16, 16) === 0 && SH.slot(37, 16) === 5, 'slots wrap (negative tiles too)');
}

console.log('b · the toroidal map: drawn texel = looked-up texel');
{
  // a low sun from the south-west, as in the eternal dusk
  const L = [Math.cos(2.3) * Math.cos(0.3), Math.sin(0.3), Math.sin(2.3) * Math.cos(0.3)];
  const lv = SH.lightView(new Float32Array(16), L);
  const R = 96, size = 3072, N = SH.N, T = SH.tile(R), ts = size / N, depth = 260;
  const P0 = [1234.25, 88.5, -731.75], cam = [1240.6, 90.1, -719.3];
  const lP0 = SH.toLight(lv, P0), lc = SH.toLight(lv, cam);
  const wc = [SH.center(null, lc[0], T), SH.center(null, lc[1], T)];
  const look = SH.lookupMatrix(new Float32Array(16), lv, [cam[0] - P0[0], cam[1] - P0[1], cam[2] - P0[2]], [wc[0] - lP0[0], wc[1] - lP0[1]], R, depth);
  const offs = [SH.offset(wc[0], R), SH.offset(wc[1], R)];
  let bad = 0, worst = 0, n = 0, depthBad = 0;
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 400; k++) {
    // a world point inside the window (camera-relative)
    const X = [cam[0] + (rnd() - 0.5) * 150, cam[1] + (rnd() - 0.5) * 80, cam[2] + (rnd() - 0.5) * 150];
    const lx = SH.toLight(lv, X);
    if (Math.abs(lx[0] - wc[0]) > R * 0.95 || Math.abs(lx[1] - wc[1]) > R * 0.95) continue;
    n++;
    const rel = [X[0] - cam[0], X[1] - cam[1], X[2] - cam[2]];
    // lookup: sc = clip * 0.5 + 0.5, texel = frac(sc + off) * size
    const c = SH.apply(look, rel);
    const su = c[0] * 0.5 + 0.5, sv = c[1] * 0.5 + 0.5;
    const tu = (su + offs[0] - Math.floor(su + offs[0])) * size, tv = (sv + offs[1] - Math.floor(sv + offs[1])) * size;
    // draw: the tile the point is in, its matrix and viewport
    const ti = Math.floor(lx[0] / T), tj = Math.floor(lx[1] / T);
    const tm = SH.tileMatrix(new Float32Array(16), lv, [cam[0] - P0[0], cam[1] - P0[1], cam[2] - P0[2]], ti * T - lP0[0], (ti + 1) * T - lP0[0], tj * T - lP0[1], (tj + 1) * T - lP0[1], depth);
    const d = SH.apply(tm, rel);
    const du = SH.slot(ti, N) * ts + (d[0] * 0.5 + 0.5) * ts, dv = SH.slot(tj, N) * ts + (d[1] * 0.5 + 0.5) * ts;
    const e = Math.max(Math.abs(du - tu), Math.abs(dv - tv));
    worst = Math.max(worst, e); if (e > 0.02) bad++;
    if (Math.abs(d[2] - c[2]) > 1e-4) depthBad++;
  }
  check(n > 200 && bad === 0, 'every point lands on the same texel in its tile as the lookup reads', `${n} points, worst ${worst.toFixed(4)} texels`);
  check(depthBad === 0, 'and at the same depth (one depth origin for every tile)');
  // the same point seen from a camera that moved (the lookup matrix follows the eye, the tiles stay)
  const cam2 = [cam[0] + 5.3, cam[1] - 1.1, cam[2] - 7.7];
  const look2 = SH.lookupMatrix(new Float32Array(16), lv, [cam2[0] - P0[0], cam2[1] - P0[1], cam2[2] - P0[2]], [wc[0] - lP0[0], wc[1] - lP0[1]], R, depth);
  const X = [cam[0] + 20, cam[1] - 3, cam[2] + 11];
  const a = SH.apply(look, [X[0] - cam[0], X[1] - cam[1], X[2] - cam[2]]), b = SH.apply(look2, [X[0] - cam2[0], X[1] - cam2[1], X[2] - cam2[2]]);
  check(Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])) < 1e-4, 'a moving eye reads the same texel and depth for a world point');
}

console.log('c · the cadence');
{
  const runs = (ring, slow) => { let n = 0; for (let f = 0; f < 64; f++) if (SH.due(ring, f, slow)) n++; return n; };
  check(runs(0) === 64 && runs(1) === 32 && runs(2) === 16, 'ring 0 every frame, ring 1 every 2nd, ring 2 every 4th', [runs(0), runs(1), runs(2)].join(' · '));
  check(runs(0, 2) === 64 && runs(1, 2) === 16 && runs(2, 2) === 8, 'slow × 2 (the governor): the outer rings half as often, ring 0 still every frame');
  check(SH.ring(5, 5, 5, 5) === 0 && SH.ring(6, 4, 5, 5) === 0 && SH.ring(7, 5, 5, 5) === 1 && SH.ring(8, 5, 5, 5) === 1 && SH.ring(9, 1, 5, 5) === 2, 'rings by tile distance from the eye: ≤ 1 → 0, ≤ 3 → 1, beyond → 2');
}

console.log('d · the window moves');
{
  const N = 16;
  const e1 = SH.entering(10, 11, N);
  check(e1 && e1[0] === 11 + N / 2 - 1 && e1[1] === 11 + N / 2 - 1, 'one tile east: the one column at the new east edge enters', JSON.stringify(e1));
  const e2 = SH.entering(10, 8, N);
  check(e2 && e2[0] === 8 - N / 2 && e2[1] === 9 - N / 2, 'two tiles west: two columns at the new west edge', JSON.stringify(e2));
  check(SH.entering(10, 10, N) === null, 'no move, nothing enters');
  check(SH.entering(10, 10 + N, N) === 'all' && SH.entering(10, 10 - N - 3, N) === 'all', 'a jump of a whole window: everything (a full redraw)');
  const r1 = SH.runs(5, 20, 16), r2 = SH.runs(-3, 4, 16), r3 = SH.runs(16, 31, 16);
  check(JSON.stringify(r1) === '[[5,15],[16,20]]' && JSON.stringify(r2) === '[[-3,-1],[0,4]]' && JSON.stringify(r3) === '[[16,31]]', 'a tile range splits where the texels wrap (at most two runs)', JSON.stringify([r1, r2, r3]));
  // the window's tile range around a centre
  const w = SH.windowTiles(24, 12, N);
  check(w[0] === 2 - N / 2 && w[1] === 2 + N / 2 - 1, 'the window holds N tiles: centre tile k → k − N/2 … k + N/2 − 1', JSON.stringify(w));
}

console.log('e · a section\'s footprint');
{
  const L = [Math.cos(0.7) * Math.cos(0.35), Math.sin(0.35), Math.sin(0.7) * Math.cos(0.35)];
  const lv = SH.lightView(new Float32Array(16), L), T = 12;
  const box = [32, 64, -48, 48, 80, -32];
  const lb = SH.lightBox(lv, box[0], box[1], box[2], box[3], box[4], box[5], [0, 0, 0, 0]);
  const tr = SH.tilesOf(lb, T, [0, 0, 0, 0]);
  let inside = true;
  for (const x of [box[0], box[3]]) for (const y of [box[1], box[4]]) for (const z of [box[2], box[5]]) {
    const l = SH.toLight(lv, [x, y, z]);
    const i = Math.floor(l[0] / T), j = Math.floor(l[1] / T);
    if (i < tr[0] || i > tr[1] || j < tr[2] || j > tr[3]) inside = false;
  }
  check(inside, 'every corner of the section lies in the marked tiles', JSON.stringify(tr));
  check((tr[1] - tr[0] + 1) * (tr[3] - tr[2] + 1) <= 9, 'a 16³ section marks a few tiles (≤ 3 × 3), not the map', (tr[1] - tr[0] + 1) + ' × ' + (tr[3] - tr[2] + 1));
}

console.log('f · the sun step and the rebuild');
{
  const a = SH.sunKey([Math.cos(1) * Math.cos(0.3), Math.sin(0.3), Math.sin(1) * Math.cos(0.3)]);
  const b = SH.sunKey([Math.cos(1.0005) * Math.cos(0.3), Math.sin(0.3), Math.sin(1.0005) * Math.cos(0.3)]);
  const c = SH.sunKey([Math.cos(1.0046) * Math.cos(0.3), Math.sin(0.3), Math.sin(1.0046) * Math.cos(0.3)]);
  check(a.key === b.key && a.key !== c.key, 'the key holds for a tenth of a step and changes after one (0.0044 rad ≈ 0.25°)', [a.key, b.key, c.key].join(' '));
  check(Math.abs(Math.hypot(a.L[0], a.L[1], a.L[2]) - 1) < 1e-9, 'the stepped direction is a unit vector');
  for (const n of [0, 1, 5, 97, 2250]) {
    const seen = new Uint8Array(n); let ok = true;
    for (let k = 0; k < SH.SLICES; k++) { const [s, e] = SH.slice(n, SH.SLICES, k); for (let i = s; i < e; i++) { if (seen[i]) ok = false; seen[i] = 1; } }
    if (!ok || seen.some(v => !v)) { check(false, `the ${SH.SLICES} slices of ${n} casters cover each once`); }
  }
  check(true, `the ${SH.SLICES} slices of 0, 1, 5, 97 and 2250 casters cover each caster exactly once`);
}

console.log('g · the renderer with a stub GL');
{
  // a stub GL: every call is counted, nothing is drawn
  const calls = {}; const n = (k) => { calls[k] = (calls[k] || 0) + 1; };
  const gl = new Proxy({}, { get(t, k) { if (k in t) return t[k]; if (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k)) return 1; return (...a) => { n(k); if (k === 'getUniformLocation') return {}; if (k === 'getProgramParameter' || k === 'getShaderParameter') return true; if (k === 'createTexture' || k === 'createFramebuffer' || k === 'createBuffer' || k === 'createVertexArray' || k === 'createProgram' || k === 'createShader') return {}; if (k === 'checkFramebufferStatus') return 1; return undefined; }; } });
  V.GL.gl = gl; V.GL.ext = {};
  const r = Object.create(V.Renderer.prototype);
  r.gl = gl; r.multi = false; r.stats = { draws: 0, tris: 0 }; r.frameNo = 0;
  r.q = { shadows: 3072, shadowDist: 96, shadowTakt: true, smoothProps: 0, smoothFurn: 0, vxLod: 96 };
  r.shadowMat = M4.create(); r.shadowBase = M4.create(); r.shadowPlanes = new Float32Array(24); r.shadowCam = [0, 0, 0];
  r.tmpM = M4.create(); r.tmpM2 = M4.create(); r.firsts = new Int32Array(512); r.counts = new Int32Array(512); r.origins = new Float32Array(2048);
  r.P = { shadow: { p: {}, u: {} }, shadowCut: { p: {}, u: {} } };
  r.shadowSize = 3072; r.shadowTex = {}; r.shadowFB = {};
  r.texAlbedo = {};
  r.ensureShadowBack = function () { this.shadowTex2 = this.shadowTex2 || {}; this.shadowFB2 = this.shadowFB2 || {}; return true; };
  // a world: 21 × 21 columns, 5 sections each with a mesh
  const cols = new Map(), all = [];
  for (let cz = -10; cz <= 10; cz++) for (let cx = -10; cx <= 10; cx++) {
    const sec = [];
    for (let sy = 0; sy < 16; sy++) { const s = { ox: cx * 16, oy: sy * 16, oz: cz * 16, hasMesh: sy >= 3 && sy < 8, fade: 1, mesh: [sy >= 3 && sy < 8 ? { arena: { vao: {} }, off: 0, cap: 96, count: 96 } : null, null, null, null, null] }; sec.push(s); if (s.hasMesh) all.push(s); }
    cols.set(cx + ',' + cz, { cx, cz, sec });
  }
  const world = { col: (cx, cz) => cols.get(cx + ',' + cz) || null, fading: new Set() };
  const E = { sunDir: [Math.cos(2.3) * Math.cos(0.3), Math.sin(0.3), Math.sin(2.3) * Math.cos(0.3)], moonDir: [0, -1, 0] };
  const cam = { x: 8.5, y: 90, z: 8.5 };
  r.cam = cam;
  const frame = () => { r.frameNo++; r.stats.draws = 0; const d0 = calls.drawArrays || 0, s0 = calls.scissor || 0, c0 = calls.clear || 0; r.shadowFrame(world, E, cam); return { draws: (calls.drawArrays || 0) - d0, scissors: (calls.scissor || 0) - s0, clears: (calls.clear || 0) - c0 }; };
  const f1 = frame();
  check(f1.draws > 300 && r.shadowValid, 'the first frame draws the whole map', f1.draws + ' sections');
  const fullDraws = f1.draws;
  let still = 0; for (let i = 0; i < 12; i++) still += frame().draws;
  check(still === 0, 'standing still (no sun step, nothing changed): nothing is drawn', still);
  // a section uploaded near the eye
  const s = cols.get('0,0').sec[5];
  r.nearShadow(s);
  const f2 = frame();
  check(f2.draws > 0 && f2.draws < fullDraws * 0.35 && f2.scissors > 0, 'a changed section redraws only the tiles under it (scissored)', `${f2.draws} of ${fullDraws}`);
  check(frame().draws === 0, 'and then nothing again');
  // the eye walks east 40 blocks, a block a frame: strips, never the whole map
  let walkDraws = 0, walkMax = 0, fullOnWalk = r.stats.shadowRenders || 0;
  for (let i = 0; i < 40; i++) { cam.x += 1; const f = frame(); walkDraws += f.draws; walkMax = Math.max(walkMax, f.draws); }
  check((r.stats.shadowRenders || 0) === fullOnWalk, 'walking 40 blocks re-bases nothing (no full redraw)');
  check(walkMax < fullDraws * 0.35 && walkDraws < fullDraws * 1.5, 'the window walks by strips: each frame a small part', `max ${walkMax}, all ${walkDraws}, a full map ${fullDraws}`);
  // a sun step: the new map is built over the slices while the old one is read
  const L0 = E.sunDir.slice();
  E.sunDir = [Math.cos(2.3 + 0.006) * Math.cos(0.3), Math.sin(0.3), Math.sin(2.3 + 0.006) * Math.cos(0.3)];
  const tex0 = r.shadowTex, per = [];
  for (let i = 0; i < SH.SLICES + 2; i++) per.push(frame().draws);
  const spread = per.slice(0, SH.SLICES);
  check(spread.every(d => d > 0 && d < fullDraws * 0.5), `a sun step is drawn over ${SH.SLICES} frames, a part each`, per.join(' '));
  check(r.shadowTex !== tex0 && per[SH.SLICES] === 0, 'then the two maps swap and nothing more is drawn');
  void L0;
  // the stub: Very Low keeps the old path (no takt: renderShadows as before)
  r.q.shadowTakt = false; r.shadowValid = false; r.shadowKey = null;
  const f3 = frame();
  check(f3.draws > 300 && f3.scissors === 0, 'without the takt the map is drawn whole as before (no scissor)');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
