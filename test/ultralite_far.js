// F9 · Fern-Cache (src/main/ultralite.js VR.UL.Far + renderer.js farFrame), no browser:
//  a · when a cache is stale: none · size · move (1.5 m) · turn (4°) · age (500 ms) · tod (the sun two game minutes on)
//  b · when a cache can still be shown (6 m, the overscan's 7.5°); the near radius (half the render distance)
//  c · the overscan: a screen corner turned by 7.5° still lies in the cache's view, at the screen's pixels per degree;
//      the strips (the cache drawn a vertical strip a frame) cover its width once
//  d · the renderer with a stub GL: nothing to show yet, the frames draw live while the cache is drawn a strip a frame
//      (SLICES frames: in each the sky, the far sections in that strip and the horizon there), then it is shown; standing,
//      nothing far is drawn again; a step of 2 m or a turn of 5° begins a new cache while the old one is shown; turning
//      faster than TURN_FAST or running faster than FAST draws live without drawing caches; the near sections are the
//      ones within the radius
//   bash test/wt_run.sh ultralite_far.js
const V = require('./load_shared.js');
global.window = undefined;
require('../src/main/gl.js'); require('../src/main/shaders.js'); require('../src/main/ultralite.js'); require('../src/main/renderer.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const FC = V.UL && V.UL.Far, M4 = V.mat4;
if (!FC) { console.log('VR.UL.Far missing'); console.log('FAILED 1'); process.exit(1); }
const deg = Math.PI / 180;

console.log('a · when a cache is stale');
{
  const c = { ok: true, x: 0, y: 80, z: 0, fx: 0, fy: 0, fz: -1, fov: 75 * deg, aspect: 16 / 9, w: 1280, h: 720, t: 1000, sun: [0.6, 0.4, Math.sqrt(1 - 0.52)] };
  const cam = (o) => Object.assign({ x: 0, y: 80, z: 0, fx: 0, fy: 0, fz: -1, fov: 75 * deg, aspect: 16 / 9 }, o || {});
  const sunAt = (a) => [Math.cos(a) * Math.cos(0.4), Math.sin(0.4), Math.sin(a) * Math.cos(0.4)];
  const c2 = Object.assign({}, c, { sun: sunAt(1) });
  check(FC.stale(c2, cam(), 1200, sunAt(1), 1280, 720) === '', 'the same eye 200 ms later: good');
  check(FC.stale(null, cam(), 0, null, 1280, 720) === 'none' && FC.stale(Object.assign({}, c2, { ok: false }), cam(), 0, null, 1280, 720) === 'none', 'no cache: none');
  check(FC.stale(c2, cam(), 1200, sunAt(1), 1920, 1080) === 'size' && FC.stale(c2, cam({ fov: 60 * deg }), 1200, sunAt(1), 1280, 720) === 'size', 'another size or field of view: size');
  check(FC.stale(c2, cam({ x: 1.4 }), 1200, sunAt(1), 1280, 720) === '' && FC.stale(c2, cam({ x: 1.2, z: 1.0 }), 1200, sunAt(1), 1280, 720) === 'move', 'the eye 1.4 m away: good · 1.56 m: move');
  const turn = (a) => cam({ fx: -Math.sin(a), fz: -Math.cos(a) });
  check(FC.stale(c2, turn(3.5 * deg), 1200, sunAt(1), 1280, 720) === '' && FC.stale(c2, turn(4.5 * deg), 1200, sunAt(1), 1280, 720) === 'turn', 'turned 3.5°: good · 4.5°: turn (3.5° of the overscan left while the next one is drawn)');
  check(FC.stale(c2, cam(), 1499, sunAt(1), 1280, 720) === '' && FC.stale(c2, cam(), 1501, sunAt(1), 1280, 720) === 'age', '499 ms old: good · 501 ms: age');
  check(FC.stale(c2, cam(), 1200, sunAt(1 + 0.4 * deg), 1280, 720) === '' && FC.stale(c2, cam(), 1200, sunAt(1 + 0.6 * deg), 1280, 720) === 'tod', 'the sun 0.4° on: good · 0.6° (two game minutes): tod');
}

console.log('b · showable, the near radius');
{
  const c = { ok: true, x: 0, y: 80, z: 0, fx: 0, fy: 0, fz: -1 };
  check(FC.showable(c, { x: 5, y: 80, z: 3, fx: 0, fy: 0, fz: -1 }) && !FC.showable(c, { x: 7, y: 80, z: 0, fx: 0, fy: 0, fz: -1 }), 'a cache is shown up to 6 m off, not beyond');
  const t = FC.MARGIN * 0.95, t2 = FC.MARGIN * 1.05;
  check(FC.showable(c, { x: 0, y: 80, z: 0, fx: -Math.sin(t), fy: 0, fz: -Math.cos(t) }) && !FC.showable(c, { x: 0, y: 80, z: 0, fx: -Math.sin(t2), fy: 0, fz: -Math.cos(t2) }), 'and turned up to its overscan, not beyond');
  check(FC.near(16) === 128 && FC.near(10) === 80 && FC.near(4) === 48, 'the near radius: half the render distance (Ultra 128 blocks), at least 48');
  check(Math.abs(FC.MARGIN - 7.5 * deg) < 1e-9 && FC.within(Object.assign({}, c, { ok: false }), { x: 5, y: 80, z: 3, fx: 0, fy: 0, fz: -1 }) && !FC.showable(Object.assign({}, c, { ok: false }), { x: 5, y: 80, z: 3, fx: 0, fy: 0, fz: -1 }), 'the overscan 7.5°; within: the same limits for a cache still being drawn');
  check(FC.TURN_FAST > 60 * deg && FC.TURN_FAST < 150 * deg, 'turning faster than TURN_FAST draws live', (FC.TURN_FAST / deg).toFixed(0) + '°/s');
}

console.log('c · the overscan');
{
  const fov = 75 * deg, aspect = 16 / 9, os = FC.overscan(fov, aspect);
  check(os.sx > 1.2 && os.sx < 1.5 && os.sy > 1.2 && os.sy < 1.5, 'the cache is a little wider and taller than the screen', `${os.sx.toFixed(3)} × ${os.sy.toFixed(3)}`);
  // the screen's top-right corner direction, turned right by the turn limit (plus the slack) and up likewise
  const screen = M4.perspective(M4.create(), fov, aspect, 0.06, 1000), inv = M4.invert(M4.create(), screen);
  const ap = (m, v) => { const x = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3], y = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3], z = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3], w = m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3]; return [x / w, y / w, z / w]; };
  const corner = ap(inv, [1, 1, 0.5, 1]);
  const a = FC.MARGIN / Math.SQRT2, ca = Math.cos(a), sa = Math.sin(a);   // (a turn of the whole margin, half right, half up)
  const turned = [corner[0] * ca - corner[2] * sa, corner[1], corner[0] * sa + corner[2] * ca];   // a turn the other way about y
  const up = [turned[0], turned[1] * ca - turned[2] * sa, turned[1] * sa + turned[2] * ca];
  const cache = M4.perspective(M4.create(), os.fov, os.aspect, 0.06, 1000);
  const n = ap(cache, [up[0], up[1], up[2], 1]);
  check(Math.abs(n[0]) <= 1 && Math.abs(n[1]) <= 1, 'the screen\'s corner turned by the whole margin (7.5°: right and up) is still in the cache', `ndc ${n[0].toFixed(3)}, ${n[1].toFixed(3)}`);
  // and every screen edge direction turned by the margin any way
  let worst = 0;
  for (const [px, py] of [[1, 0], [0, 1], [1, 1], [-1, 1], [0.5, -1]]) for (let k = 0; k < 36; k++) {
    const ph = k / 36 * 2 * Math.PI, d0 = ap(inv, [px, py, 0.5, 1]), l = Math.hypot(d0[0], d0[1], d0[2]), d = d0.map(v => v / l);
    const e1 = [d[2], 0, -d[0]], l1 = Math.hypot(e1[0], e1[1], e1[2]); e1[0] /= l1; e1[2] /= l1;
    const e2 = [d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2], d[0] * e1[1] - d[1] * e1[0]];
    const c = Math.cos(FC.MARGIN * 0.999), s = Math.sin(FC.MARGIN * 0.999);
    const q = [0, 1, 2].map(i => d[i] * c + (e1[i] * Math.cos(ph) + e2[i] * Math.sin(ph)) * s);
    const m = ap(cache, [q[0] * 100, q[1] * 100, q[2] * 100, 1]);
    worst = Math.max(worst, Math.abs(m[0]), Math.abs(m[1]));
  }
  check(worst <= 1, 'every edge of the screen turned by the margin any way stays inside', 'worst ndc ' + worst.toFixed(3));
  const w = 1280, tw = w * os.sx, density = (W, t) => (W / 2) / t;
  check(Math.abs(density(tw, Math.tan(os.fov / 2) * os.aspect) - density(w, Math.tan(fov / 2) * aspect)) < 1e-6, 'its pixels per unit of view are the screen\'s (the far world as sharp as before)');
  let even = true;
  for (const W of [Math.ceil(1280 * os.sx), 7, 1000]) { const K = FC.SLICES, seen = new Uint8Array(W); for (let k = 0; k < K; k++) { const [x0, x1] = FC.strip(k, K, W); if (Math.abs((x1 - x0) - W / K) > 1) even = false; for (let i = x0; i < x1; i++) seen[i]++; } if (seen.some(v => v !== 1)) even = false; }
  check(even, `the ${FC.SLICES} strips cover the cache's width once each, evenly`);
}

console.log('d · the renderer with a stub GL');
{
  const calls = {}; let farDraws = 0; const drawn = [];
  const gl = new Proxy({}, { get(t, k) { if (k in t) return t[k]; if (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k)) return 1; return (...a) => { calls[k] = (calls[k] || 0) + 1; if (k === 'drawArrays' && a[2] >= 1000) { farDraws++; drawn.push(a[2]); } /* (a far section's count is 1000 + its number; the fullscreen passes draw 3) */ if (k === 'getUniformLocation') return {}; if (/^create/.test(k)) return {}; if (k === 'checkFramebufferStatus') return 1; return undefined; }; } });
  V.GL.gl = gl; V.GL.ext = {};
  const r = Object.create(V.Renderer.prototype);
  const stub = () => ({ p: {}, u: {} });
  Object.assign(r, { gl, multi: false, hdr: true, stats: { draws: 0, tris: 0 }, frameNo: 0, q: { farCache: true, vxLod: 96 }, P: { opaque: stub(), cutout: stub(), sky: stub(), farComp: stub() }, W: 1280, H: 720, w: 1280, h: 720, sceneFB: {}, emptyVAO: {}, shadowMat: M4.create(), proj: M4.create(), view: M4.create(), viewProj: M4.create(), invViewProj: M4.create(), planes: new Float32Array(24), firsts: new Int32Array(512), counts: new Int32Array(512), origins: new Float32Array(2048), tmpM: M4.create(), tmpM2: M4.create() });
  // sections: 21 × 21 columns, 3 sections each; the far ones carry a marker count (1000 + their number)
  const vis = []; let nf = 0;
  for (let cz = -10; cz <= 10; cz++) for (let cx = -10; cx <= 10; cx++) for (let sy = 4; sy < 7; sy++) {
    const far = Math.hypot(cx * 16, cz * 16) > 80;   // (from the eye at 8, 8: the section's centre is at cx·16 + 8)
    vis.push({ ox: cx * 16, oy: sy * 16, oz: cz * 16, hasMesh: true, fade: 1, mesh: [{ arena: { vao: {} }, off: 0, cap: 96, count: far ? 1000 + nf++ : 96 }, null, null, null, null] });
  }
  const world = { renderDist: 10 };
  let hz = 0; const horizon = { draw() { hz++; } };
  const E = { sunDir: [0.6, 0.4, Math.sqrt(1 - 0.52)], moonDir: [0, -1, 0], fogColor: [0.5, 0.5, 0.6] };
  const cam = { x: 8, y: 80, z: 8, yaw: 0, pitch: 0, fov: 75 * deg, far: 1200 };
  let clock = 1000; const realNow = performance.now; performance.now = () => clock;
  const frame = (dt) => { clock += dt === undefined ? 16.7 : dt; r.setupCamera(cam); const f0 = farDraws, s0 = calls.scissor || 0; drawn.length = 0; const fc = r.farFrame({ cam, horizon }, E, world, vis, [cam.x, cam.y, cam.z]); return { fc, far: farDraws - f0, ids: drawn.slice(), scissor: (calls.scissor || 0) - s0 }; };
  const K = FC.SLICES, nFar = nf;
  // the first frames: nothing to show yet — they draw live while the cache is drawn, a strip a frame
  const first = []; for (let i = 0; i < K; i++) first.push(frame());
  const inView = r.fc.front.list.length, count = new Map();
  for (const f of first) for (const id of f.ids) count.set(id, (count.get(id) || 0) + 1);
  const listIds = r.fc.front.list.map(s => s.mesh[0].count);
  check(first.slice(0, K - 1).every(f => !f.fc) && first[K - 1].fc && r.stats.farBuilt === 1, `nothing to show yet: ${K - 1} frames live while the cache is drawn, the ${K}th shows it (no frame draws it whole)`);
  check(listIds.every(id => count.get(id) >= 1) && [...count.values()].every(n => n <= 2) && inView > 100 && inView < nFar, 'every far section in the cache\'s view is drawn, in its strip (at most two strips where it straddles)', `${inView} in view of ${nFar}, ${[...count.values()].reduce((a, b) => a + b, 0)} draws`);
  const most = Math.max(...first.map(f => f.far));
  check(most <= 0.6 * inView && first.every(f => f.scissor >= 1) && hz === K, `a strip a frame: no frame draws more than 60 % of them (the most ${most}), each scissored, the horizon once in each`, first.map(f => f.far).join(' ') + ' · horizon ' + hz);
  const f1 = first[K - 1];
  check(f1.fc.near.length === vis.length - nFar && f1.fc.near.every(s => s.mesh[0].count === 96), 'the near list: the sections within the radius only', f1.fc.near.length);
  let far = 0, hz0 = hz; for (let i = 0; i < 20; i++) { cam.yaw += 0.001; far += frame().far; }
  check(far === 0 && hz === hz0 && r.stats.farBuilt === 1, 'standing (and looking a little round) for 20 frames: nothing far is drawn again', far);
  cam.x += 2;
  const per = []; for (let i = 0; i < K + 2; i++) { const f = frame(); per.push(f); }
  check(r.stats.farBuilt === 2 && per.every(f => f.fc) && per.slice(0, K).every(f => f.far > 0) && per.slice(K).every(f => f.far === 0), `a step of 2 m: a new cache, drawn a strip a frame over ${K} frames while the old one is shown`, per.map(f => f.far).join(' '));
  check(r.fc.front.x === cam.x, 'then it is the one shown');
  cam.yaw += 5 * deg; const ft = frame();
  check(ft.fc && (r.fc.back !== null || r.stats.farBuilt === 3), 'a turn of 5°: a new cache is begun, the old one shown meanwhile');
  for (let i = 0; i < K + 2; i++) frame();
  // turning faster than TURN_FAST (3° a frame, 180°/s): live, and no cache is drawn that would be off before it is done
  let liveT = 0, farT = 0; for (let i = 0; i < 20; i++) { cam.yaw += 3 * deg; const f = frame(16.7); if (!f.fc) liveT++; if (i >= 10) farT += f.far; }
  check(liveT >= 10 && farT === 0 && r.fc.back === null, 'a fast turn (180°/s) draws live and draws no cache meanwhile', `${liveT} of 20 frames live, ${farT} far draws in the last 10`);
  for (let i = 0; i < 30; i++) frame(16.7);
  // a run faster than FAST: live
  let live = 0; for (let i = 0; i < 20; i++) { cam.z += 1.0; if (!frame(16.7).fc) live++; }
  check(live >= 10, 'a run of 60 m/s draws live (no cache)', live + ' of 20 frames live');
  let back = 0; for (let i = 0; i < 30; i++) if (frame(16.7).fc) back++;
  check(back > 0 && frame().fc, 'standing again, the cache comes back', back + ' of 30 frames');
  performance.now = realNow;
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
