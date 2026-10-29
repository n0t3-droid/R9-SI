// f-wild2 · R50-10 (docs/superpowers/plans/2026-10-23-f-wild2.md) — the wild in software, before any browser: the same
// models as the shaders (wildsim.js W.puffTau / birdsVisible / murmTargets, the impostor's kernel e^(−2.2 q²) cut at
// PUFF.cut, the ray's mesh with the wing curve turned in as wildgpu.js mode 4 does), drawn from where a player stands:
//  · the murmuration from the shore (wild.mjs's camera: 145 blocks, the eye 3 over the water) at eight moments of its
//    figures over a dusk sky: the share of the frame it covers (α ≥ 0.1) and its dark core (α ≥ 0.85, luma ≤ 60 over a
//    sky of luma ~190) — R50-10's "≥ 3 % of the lake view with a dark core ≥ 1 %"
//  · the pass: a young ray at its closest moment over the beach's cell, seen from the eye in the cell's middle — its
//    share of the frame (R50-10: ≥ 2 %); from below and from the side (the flap's curve)
// → test/shots/wild_preview_murm.png (a strip), wild_preview_ray.png; the numbers as checks. A tool for the next front:
// change a figure or the impostor's model and look in a minute.
//   bash test/wt_run.sh wild_preview.js 300
const V = require('./load_shared.js');
global.performance = global.performance || { now: () => Date.now() };
require(__dirname + '/../src/main/wildsim.js');
require(__dirname + '/../src/main/wildgpu.js');
const fs = require('fs');
let sharp = null; try { sharp = require('/home/dev/.npm-global/lib/node_modules/sharp'); } catch (e) { /* the pictures are a convenience */ }
const W = V.Wild, WG = V.WildGPU, SEA = V.C.SEA, TAU = Math.PI * 2;
// (try the impostor's model without editing wildsim.js: PUFF='{"R":3.4,"cut":1.3}')
if (process.env.PUFF) Object.assign(W.PUFF, JSON.parse(process.env.PUFF));
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const SHOTS = require('path').resolve(__dirname, '..') + '/test/shots/';   // (the test runs from test/ or .tmp_tests/)
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (e) { /* */ }
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
// a camera: eye, target, vertical fov (deg), the frame's size → project(p) = [sx, sy, depth] or null
const camera = (eye, tgt, fovDeg, WD, HT) => {
  const fw = nrm(sub(tgt, eye)), rt = nrm(cross(fw, [0, 1, 0])), up = cross(rt, fw), F = (HT / 2) / Math.tan(fovDeg * Math.PI / 360);
  return { eye, fw, rt, up, F, WD, HT, project(p) { const r = sub(p, eye), z = dot(r, fw); if (z < 0.1) return null; return [WD / 2 + dot(r, rt) / z * F, HT / 2 - dot(r, up) / z * F, z]; } };
};
const skyAt = (t) => [150 + 80 * t, 135 + 60 * t, 190 + 20 * t];   // (a dusk sky: luma ~150 at the top … ~200 low)
const save = async (path, img, w, h) => { if (sharp) await sharp(Buffer.from(img), { raw: { width: w, height: h, channels: 3 } }).png().toFile(path); };

(async () => {
  // ---------------------------------------------------------------- 1. the murmuration from the shore
  {
    const seed = (53 ^ 0x7a11d) >>> 0, key = 4, n = W.CAPS.murm[3], K = W.MURM_K, P = W.PUFF;
    const eye0 = [235, 70, 35], st = W.stageOf(seed, key, 'dusk', eye0, true);
    const fl = new W.Flock(n, (W.h(seed, key, 0x6b) * 4294967295) >>> 0), S = W.murmPlaces(n); fl.bofs = new Float32Array(n * 3);
    const ax = st.x - eye0[0], az = st.z - eye0[2], al = Math.hypot(ax, az);
    fl.place(st.x + ax / al * 140, st.y + 10, st.z + az / al * 140, 16);
    const WD = 640, HT = 360, tiles = [], stats = [];
    let clock = 5000;
    const shotAt = new Set(); for (let k = 0; k < 8; k++) shotAt.add(Math.round((40 + k * 12) * 20));   // (every 12 s from the 40th: the step is 20 a second, the game's from afar)
    for (let s = 0; s <= 140 * 20; s++) {
      clock += 1 / 20;
      W.murmTarget(seed ^ key, clock, st, fl.tgt); W.murmTargets(seed ^ key, clock, S, n, fl.bofs, fl.tgt); fl.step(1 / 20);
      if (!shotAt.has(s)) continue;
      const c = fl.ctr, bx = 205 - c[0], bz = 10 - c[2], bl = Math.hypot(bx, bz), dd = Math.min(bl, 145);
      const cam = camera([c[0] + bx / bl * dd, SEA + 3, c[2] + bz / bl * dd], [c[0], c[1] + 4, c[2]], 70, WD, HT);
      const tau = new Float32Array(WD * HT); let quad = 0, nq = 0;
      for (let i = 0; i < n; i++) {
        const p = [fl.pos[i * 3], fl.pos[i * 3 + 1], fl.pos[i * 3 + 2]], pr = cam.project(p); if (!pr) continue;
        const d = Math.hypot(...sub(p, cam.eye)), kv = W.birdsVisible(d);
        // the impostor (as drawCloud: the wings' plane, its turn to the eye)
        const v = [fl.vel[i * 3], fl.vel[i * 3 + 1], fl.vel[i * 3 + 2]], f2 = nrm(v), hl = Math.hypot(f2[0], f2[2]) + 1e-6, r2 = [-f2[2] / hl, 0, f2[0] / hl], u2 = cross(r2, f2), b = fl.bank[i];
        const nw = [u2[0] * Math.cos(b) + r2[0] * Math.sin(b), u2[1] * Math.cos(b), u2[2] * Math.cos(b) + r2[2] * Math.sin(b)], ndv = Math.abs(dot(nw, sub(p, cam.eye))) / d;
        const t0 = W.puffTau(fl.dens[i], ndv, kv, K, n);
        if (t0 > 0.004) {
          const Rp = P.R * cam.F / pr[2], ext = Math.ceil(Rp * P.cut) + 1; quad += 2.828 * (Rp * P.cut) ** 2; nq++;   // (the octagon wildgpu.js draws: 2√2 r²)
          for (let py = Math.max(0, Math.floor(pr[1] - ext)); py <= Math.min(HT - 1, Math.ceil(pr[1] + ext)); py++) for (let px = Math.max(0, Math.floor(pr[0] - ext)); px <= Math.min(WD - 1, Math.ceil(pr[0] + ext)); px++) {
            const q2 = ((px + 0.5 - pr[0]) ** 2 + (py + 0.5 - pr[1]) ** 2) / (Rp * Rp); if (q2 > P.cut * P.cut) continue; { const ax = Math.abs(px + 0.5 - pr[0]) / (Rp * P.cut), ay = Math.abs(py + 0.5 - pr[1]) / (Rp * P.cut); if (Math.max(ax, ay) > 0.924 || (ax + ay) > 1.307) continue; }
            const gx = Math.floor((px + 0.5 - pr[0]) / Rp * P.grain[0]), gy = Math.floor(-(py + 0.5 - pr[1]) / Rp * P.grain[0]);
            tau[py * WD + px] += t0 * W.puffGrain(gx, gy, (i * 0.618034) % 1) * Math.exp(-2.2 * q2);
          }
        }
        // the party's birds drawn (dashes ≥ 1.3 px: each its pixel's share, about its true area at least)
        for (let k = 0; k < Math.ceil(kv); k++) {
          const h = (q) => W.h(k, 77, q), o = k ? [(h(1) - 0.5) * 2 * W.MURM_RC, (h(2) - 0.5) * 2 * W.MURM_RC * 0.2, (h(3) - 0.5) * 2 * W.MURM_RC * 0.8] : [0, 0, 0];
          const q = cam.project([p[0] + o[0], p[1] + o[1], p[2] + o[2]]); if (!q) continue;
          const X = Math.floor(q[0]), Y = Math.floor(q[1]); if (X < 0 || X >= WD || Y < 0 || Y >= HT) continue;
          const span = 0.55 * Math.max(1, Math.min(1.5, q[2] / 80)) * cam.F / q[2];   // (px: the dash's length)
          tau[Y * WD + X] += Math.min(2, span * 1.3 / 2) * Math.min(1, kv - k);
        }
      }
      const img = Buffer.alloc(WD * HT * 3); let cov = 0, core = 0;
      for (let py = 0; py < HT; py++) for (let px = 0; px < WD; px++) {
        const a = 1 - Math.exp(-tau[py * WD + px]), sky = skyAt(py / HT), o = (py * WD + px) * 3;
        for (let k = 0; k < 3; k++) img[o + k] = Math.round(sky[k] * (1 - a) + [24, 22, 27][k] * a);
        if (a >= 0.1) cov++; if (a >= 0.85) core++;
      }
      const F = W.murmFigure(seed ^ key, clock);
      stats.push({ t: s / 20, fig: F.a + (F.w > 0 ? '→' + F.b : ''), cov: +(cov / WD / HT * 100).toFixed(2), od: +(quad / WD / HT).toFixed(3), nq, core: +(core / WD / HT * 100).toFixed(2), d: Math.round(dd) });
      tiles.push(img);
    }
    console.log('     ' + stats.map(q => `${q.t}s ${q.fig}: ${q.cov} % · core ${q.core} % · the impostors' quads ${q.od}× the frame (${q.nq})`).join('\n     '));
    const covs = stats.map(q => q.cov).sort((a, b) => a - b), cores = stats.map(q => q.core).sort((a, b) => a - b);
    const mc = covs[covs.length >> 1], mk = cores[cores.length >> 1];
    check(mc >= 3, `the flock covers ${mc} % of the lake view from the shore (the median of ${stats.length} moments; ≥ 3 %)`);
    check(mk >= 1, `with a dark core: ${mk} % of the frame at α ≥ 0.85 (≥ 1 %)`);
    const ods = stats.map(q => q.od).sort((a, b) => a - b), od = ods[ods.length >> 1];
    // (f-wild2 cost: the impostors' rasterized area — SwiftShader fills each quad's pixels, the cut disc's outside too)
    check(od <= 0.25, `the impostors rasterize ${od}× the frame's pixels (the median; ≤ 0.25×)`);
    check(covs[0] >= 2, `never small: the least of the moments ${covs[0]} %`);
    // the strip: four moments a row
    const cols = 4, rows = Math.ceil(tiles.length / cols), big = Buffer.alloc(cols * WD * rows * HT * 3, 12);
    tiles.forEach((img, k) => { const ox = (k % cols) * WD, oy = Math.floor(k / cols) * HT; for (let y = 0; y < HT; y++) img.copy(big, ((oy + y) * cols * WD + ox) * 3, y * WD * 3, (y + 1) * WD * 3); });
    await save(SHOTS + 'wild_preview_murm.png', big, cols * WD, rows * HT);
  }

  // ---------------------------------------------------------------- 2. the pass: a young ray at its closest moment
  {
    const g = V.makeGen('overworld', 53, { vgen: 11 }), I = V.IslesGen.list(g), loop = W.rayLoop(I), seed = (53 ^ 0x7a11d) >>> 0, day = 4;
    // (a flat stand-in for the ground: the beach's cell at the water's level — the shape of the pass, not its clearance:
    //  test/wild_sim.js checks that in the real blocks)
    const topAt = () => SEA + 1, eyeP = [228, SEA + 1 + 1.62, 36];
    const A = W.passPlan(seed, day, eyeP, loop, topAt);
    check(!!A, 'a pass over the beach\'s cell');
    if (A) {
      const st = [0, 0, 0, 0, 0, 0, 0, 0]; let best = null;
      for (let t = A.T0; t <= A.T1; t += 0.1) { W.passAt(A, loop, seed, t, st); const d = Math.hypot(st[0] - eyeP[0], st[1] - eyeP[1], st[2] - eyeP[2]); if (!best || d < best.d) best = { d, t, st: st.slice() }; }
      // the mesh, its wings curved as the shader does (mode 4), placed as the instance (scale, bank, pitch, yaw)
      const m = WG.mesh('ray'), VS = 11, RY = W.RAY, piv = WG.RAY_SHAPE.body;
      const place = (R, ph) => {
        const out = [];
        for (let i = 0; i < m.length; i += VS) {
          let x = m[i], y = m[i + 1], z = m[i + 2], nx = m[i + 3], ny = m[i + 4], nz = m[i + 5]; const w = m[i + 9];
          if (w > 0) { const sd = x < 0 ? -1 : 1, a = sd * W.rayWing(w, ph), c = Math.cos(a), s = Math.sin(a), qx = x - sd * piv; x = qx * c - y * s + sd * piv; y = qx * s + y * c; const n2 = nx * c - ny * s; ny = nx * s + ny * c; nx = n2; }
          x *= R[7]; y *= R[7]; z *= R[7];
          const cb = Math.cos(R[5]), sb = Math.sin(R[5]); [x, y] = [x * cb - y * sb, x * sb + y * cb]; [nx, ny] = [nx * cb - ny * sb, nx * sb + ny * cb];
          const cp = Math.cos(R[4]), sp = Math.sin(R[4]); [y, z] = [y * cp - z * sp, y * sp + z * cp]; [ny, nz] = [ny * cp - nz * sp, ny * sp + nz * cp];
          const cy = Math.cos(R[3]), sy = Math.sin(R[3]); [x, z] = [x * cy + z * sy, -x * sy + z * cy]; [nx, nz] = [nx * cy + nz * sy, -nx * sy + nz * cy];
          out.push([x + R[0], y + R[1], z + R[2]], [nx, ny, nz], [m[i + 6], m[i + 7], m[i + 8]], m[i + 10]);
        }
        return out;
      };
      // a z-buffered raster: light from a low sun ahead, the sky from above, the water's light from below, the glow
      const render = (cam, verts, WD, HT) => {
        const zb = new Float32Array(WD * HT).fill(1e9), img = Buffer.alloc(WD * HT * 3); let cov = 0;
        for (let py = 0; py < HT; py++) for (let px = 0; px < WD; px++) { const sky = skyAt(py / HT), o = (py * WD + px) * 3; img[o] = sky[0]; img[o + 1] = sky[1]; img[o + 2] = sky[2]; }
        const L = nrm([0.6, 0.25, -0.5]), g8 = (v) => Math.round(255 * Math.pow(Math.max(0, Math.min(1, v)), 1 / 2.2));
        for (let t = 0; t < verts.length; t += 12) {
          const P3 = [verts[t], verts[t + 4], verts[t + 8]].map(p => cam.project(p)); if (P3.some(q => !q)) continue;
          const [a, b, c] = P3, x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(WD - 1, Math.ceil(Math.max(a[0], b[0], c[0]))), y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(HT - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
          const den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]); if (Math.abs(den) < 1e-9) continue;
          for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
            const X = px + 0.5, Y = py + 0.5, l0 = ((b[1] - c[1]) * (X - c[0]) + (c[0] - b[0]) * (Y - c[1])) / den, l1 = ((c[1] - a[1]) * (X - c[0]) + (a[0] - c[0]) * (Y - c[1])) / den, l2 = 1 - l0 - l1;
            if (l0 < 0 || l1 < 0 || l2 < 0) continue;
            const z = l0 * a[2] + l1 * b[2] + l2 * c[2], k = py * WD + px; if (z >= zb[k]) continue; zb[k] = z;
            let n = nrm([0, 1, 2].map(j => l0 * verts[t + 1][j] + l1 * verts[t + 5][j] + l2 * verts[t + 9][j]));
            const pw = [0, 1, 2].map(j => l0 * verts[t][j] + l1 * verts[t + 4][j] + l2 * verts[t + 8][j]); if (dot(n, sub(cam.eye, pw)) < 0) n = n.map(q => -q);
            const al = [0, 1, 2].map(j => l0 * verts[t + 2][j] + l1 * verts[t + 6][j] + l2 * verts[t + 10][j]), em = l0 * verts[t + 3] + l1 * verts[t + 7] + l2 * verts[t + 11];
            const lit = 0.25 + 0.35 * (n[1] * 0.5 + 0.5) + 0.7 * Math.max(0, (dot(n, L) + 0.3) / 1.3) + 0.5 * Math.max(0, -n[1]);
            const o = k * 3, gl = Math.min(1, em * 0.7);
            img[o] = g8(al[0] * lit * (1 - gl) + 0.56 * gl); img[o + 1] = g8(al[1] * lit * (1 - gl) + 1.52 * gl); img[o + 2] = g8(al[2] * lit * (1 - gl) + 1.6 * gl);
          }
        }
        for (let k = 0; k < WD * HT; k++) if (zb[k] < 1e9) cov++;
        return { img, cov: cov / WD / HT };
      };
      const ph = best.t * TAU / RY.period + A.k * 1.9 + 0.8;
      // (the eye in the cell's middle, looking at the ray — the player who turns to it; fov 70)
      const VV = place(best.st, ph);
      const camA = camera(eyeP, [best.st[0], best.st[1], best.st[2]], 70, 640, 360), shotA = render(camA, VV, 640, 360);
      check(best.d <= 40 && shotA.cov >= 0.02, `the pass: ${best.d.toFixed(1)} blocks from the eye at its closest, ${(shotA.cov * 100).toFixed(1)} % of the frame (≥ 2 %)`);
      // from the side, 30 blocks off, the flap over a beat: the wings curve, the tips rise and fall
      const side = [], sv = [best.st[0] + Math.cos(best.st[3]) * 30, best.st[1] + 2, best.st[2] - Math.sin(best.st[3]) * 30];
      let tipLo = 1e9, tipHi = -1e9;
      for (let k = 0; k < 4; k++) {
        const R = best.st.slice(); R[5] = 0; R[4] = 0; const P4 = place(R, k * TAU / 4), V4 = P4;
        for (let i = 0; i < P4.length; i += 4) if (Math.abs(m[(i / 4) * VS]) > 0.48) { tipLo = Math.min(tipLo, P4[i][1] - R[1]); tipHi = Math.max(tipHi, P4[i][1] - R[1]); }
        side.push(render(camera(sv, [R[0], R[1], R[2]], 40, 320, 180), V4, 320, 180).img);
      }
      check(tipHi - tipLo > 0.35 * best.st[7], `the wings beat: the tips rise and fall ${(tipHi - tipLo).toFixed(1)} blocks over a beat (${((tipHi - tipLo) / best.st[7] * 100).toFixed(0)} % of the span)`);
      // the picture: the pass from below (640 × 360) over the side views (4 × 320 × 180 → 1280 × 180)
      const Wt = 1280, Ht = 360 + 180, big = Buffer.alloc(Wt * Ht * 3, 12);
      const blit = (img, w, h, ox, oy) => { for (let y = 0; y < h; y++) img.copy(big, ((oy + y) * Wt + ox) * 3, y * w * 3, (y + 1) * w * 3); };
      blit(shotA.img, 640, 360, 0, 0);
      const camB = camera(eyeP, [best.st[0], best.st[1], best.st[2]], 35, 640, 360), shotB = render(camB, VV, 640, 360); blit(shotB.img, 640, 360, 640, 0);
      side.forEach((img, k) => blit(img, 320, 180, k * 320, 360));
      await save(SHOTS + 'wild_preview_ray.png', big, Wt, Ht);
    }
  }
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();
