// F9 · Spiegelung leicht (renderer.js reflectPass / ensureReflection / waterUniforms with q.reflLite), no browser:
//  a · the mirror is a quarter of the frame each way (1/16 of its pixels; Ultra's water 2 draws a half each way)
//  b · it draws the sections within 96 blocks (Ultra: 160; the horizon stands in beyond) and the props' far forms
//  c · the water reads it edge-aware (u_reflUp 1, its depth on unit 9); off: one tap as before
//  d · off (every preset but Ultra · Leicht): the mirror as before
//   bash test/wt_run.sh ultralite_refl.js
const V = require('./load_shared.js');
global.window = undefined;
require('../src/main/gl.js'); require('../src/main/shaders.js'); require('../src/main/ultralite.js'); require('../src/main/renderer.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const M4 = V.mat4;
const uni = {};
const gl = new Proxy({}, { get(t, k) { if (k in t) return t[k]; if (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k)) return 1; return (...a) => { if (k === 'uniform1f' || k === 'uniform1i' || k === 'uniform2f') uni[a[0] && a[0].name] = a.slice(1); if (/^create/.test(k)) return {}; if (k === 'checkFramebufferStatus') return 1; return undefined; }; } });
V.GL.gl = gl; V.GL.ext = {};
const water = V.R.byName.water.defaultState;
// a lake at y 60 in front of the eye; sections all round, out to 200 blocks
const world = { getBlock: (x, y, z) => (y === 60 ? water : 0) };
const vis = [];
for (let cz = -13; cz <= 13; cz++) for (let cx = -13; cx <= 13; cx++) vis.push({ ox: cx * 16, oy: 64, oz: cz * 16, hasMesh: true, fade: 1, mesh: [{ arena: { vao: {} }, off: 0, cap: 96, count: 96 }, null, null, null, null] });
function make(q) {
  const r = Object.create(V.Renderer.prototype);
  const KEEP = ['u_reflUp', 'u_reflSize', 'u_reflDepth', 'u_reflTex', 'u_reflOn'];
  const stub = (name) => ({ p: {}, u: new Proxy({}, { get: (t, k) => (KEEP.includes(k) ? { name: name + '.' + k } : undefined) }) });
  Object.assign(r, { gl, multi: false, hdr: true, stats: { draws: 0, tris: 0 }, frameNo: 0, q: Object.assign({ water: 2, smoothProps: 2, smoothFurn: 1, vxLod: 96 }, q), P: { opaque: stub('o'), cutout: stub('c'), sky: stub('s'), trans: stub('t') }, W: 1280, H: 720, w: 1280, h: 720, sceneFB: {}, emptyVAO: {}, shadowMat: M4.create(), proj: M4.create(), view: M4.create(), viewProj: M4.create(), invViewProj: M4.create(), planes: new Float32Array(24), firsts: new Int32Array(512), counts: new Int32Array(512), origins: new Float32Array(2048), tmpM: M4.create(), tmpM2: M4.create(), texNoise: {} });
  r.propLevels = []; r.drawProps = function (E, camPos, shadow, refl) { this.propLevels.push(refl); };
  r.setupCamera({ x: 8, y: 66, z: 8, yaw: 0, pitch: -0.3, fov: 75 * Math.PI / 180, far: 1200 });
  return r;
}
const E = { sunDir: [0.6, 0.4, 0.69], moonDir: [0, -1, 0], fogColor: [0.5, 0.5, 0.6] };
const run = (q) => { const r = make(q); r.reflectPass({ cam: r.cam }, E, world, vis, [r.cam.x, r.cam.y, r.cam.z]); return r; };

console.log('a · the size');
const lite = run({ reflLite: true }), ultra = run({});
check(lite.reflOn && lite.reflW === 320 && lite.reflH === 180, 'Ultra · Leicht: a quarter of the frame each way', `${lite.reflW} × ${lite.reflH}`);
check(ultra.reflOn && ultra.reflW === 640 && ultra.reflH === 360, 'Ultra (water 2) as before: a half each way', `${ultra.reflW} × ${ultra.reflH}`);

console.log('b · what it draws');
check(lite.stats.reflSecs < ultra.stats.reflSecs && lite.reflList.every(s => Math.hypot(s.ox + 8 - 8, s.oz + 8 - 8) <= 96), 'the sections within 96 blocks (the horizon beyond)', `${lite.stats.reflSecs} sections (Ultra ${ultra.stats.reflSecs})`);
check(lite.propLevels.join() === '1' && ultra.propLevels.join() === '2', 'the props at their far forms (tier 1); Ultra as before (tier 2)');

console.log('c · the read');
const u = (r) => { for (const k in uni) delete uni[k]; r.waterUniforms(r.P.trans, E); return Object.assign({}, uni); };
const ul = u(lite), uu = u(ultra);
check(ul['t.u_reflUp'] && ul['t.u_reflUp'][0] === 1 && ul['t.u_reflSize'] && ul['t.u_reflSize'][0] === 320, 'the water reads it edge-aware (its depth, its size)');
check(uu['t.u_reflUp'] && uu['t.u_reflUp'][0] === 0, 'Ultra: one bilinear tap as before');

console.log('d · off');
const bal = run({ water: 1 });
check(bal.reflW === 320 && bal.propLevels.join() === '1' && u(bal)['t.u_reflUp'][0] === 0, 'water 1 (Balanced) as before: a quarter, far forms, one tap');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
