// v-dusk part B · the Flausellichter's rules (src/main/dusk.js, the pure part), node:
//  1. caps per tier: Very Low none (no swarm, no mote), rising with the tier, ≤ 200; the instance data never over the cap
//  2. the evening: 0 with the sun up, > 0.3 in the golden hour's end, 1 after the set
//  3. deterministic: the same seed and the same steps give the same swarm bit for bit; another seed another swarm
//  4. boids: after 20 s alone they keep apart (mean nearest neighbour ≥ 0.3 m, none closer than 0.08 m on average
//     over the frames), stay together (rms radius ≤ 4.5 m), fly in step (the velocities' order ≥ 0.3 while the
//     leader moves), hover over the grass (0.25–3.8 m)
//  5. you stand still 12 s beside them: a ring round you (≥ 70 % 1.5–3.3 m out, all eight eighths), ring() says so
//  6. you walk through at 4 m/s: they part (the nearest mote's mean distance ≥ 1.3 m and ≥ 1.5× as far as without the
//     parting rule, which is < 1.0)
//  7. they trail to the flowers and the water: with one attractor the centre comes within 3 m of it in 40 s
//  8. the chime once a night: the first ring of a night yes, the second no, the next night yes
//  9. a step allocates nothing (< 256 bytes a step over 2000 warm steps, the test's own numbers included)
//   bash test/wt_run.sh dusk_swarm.js 300
require('./load_shared.js');
require('../src/main/dusk.js');
if (!global.gc) { try { require('v8').setFlagsFromString('--expose-gc'); global.gc = require('vm').runInNewContext('gc'); } catch (e) { /* without: the raw heap */ } }
const D = VR.Dusk, TAU_ = Math.PI * 2;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const run = (sw, secs, ctx, fn) => { const dt = 1 / 30; for (let f = 0; f < secs * 30; f++) { if (fn) fn(f * dt, ctx); D.step(sw, dt, ctx); } };
const still = (x, y, z, s) => ({ px: x, py: y, pz: z, still: s || 0, speed: 0 });

console.log('1. caps per tier');
check(!!D && D.plan(0).cap === 0 && D.plan(0).swarms === 0 && D.plan(0).per === 0, 'Very Low: no swarm, no mote');
check([1, 2, 3, 4].every(t => D.plan(t).cap > D.plan(t - 1).cap) && D.plan(4).cap <= 200, 'caps rise with the tier, ≤ 200 (' + D.CAPS.join(' · ') + ')');
check([1, 2, 3, 4].every(t => D.plan(t).per * D.plan(t).swarms <= D.plan(t).cap), 'the swarms share the cap');
{
  const sws = [D.swarm(1, [0, 64, 0], 60), D.swarm(2, [20, 64, 0], 60)]; sws.forEach(s => { s.fade = 1; });
  const buf = new Float32Array(400 * 14), q = D.fill(buf, sws, [0, 64, 0], 1, 80), q0 = D.fill(buf, sws, [0, 64, 0], 1, 0);
  check(q <= 160 && q0 === 0, `the quads written stay under the cap (cap 80 → ${q} quads, two a mote; cap 0 → ${q0})`);
  const qd = D.fill(buf, sws, [0, 64, 0], 0, 80);
  check(qd === 0, 'by day nothing is written');
}

console.log('2. the evening');
check(D.glow(0.8) === 0 && D.glow(0.3) === 0, 'sun up: 0');
check(D.glow(0.05) > 0.3 && D.glow(0.05) < 1, 'the golden hour\'s end: ' + D.glow(0.05).toFixed(2));
check(D.glow(-0.05) === 1 && D.glow(-0.9) === 1, 'after the set: 1');

console.log('3. deterministic');
{
  const a = D.swarm(4242, [10, 70, -5], 48), b = D.swarm(4242, [10, 70, -5], 48), c = D.swarm(4243, [10, 70, -5], 48);
  const ctx = still(30, 70, 30);
  run(a, 10, ctx); run(b, 10, ctx); run(c, 10, ctx);
  check(a.p.every((v, i) => v === b.p[i]) && a.v.every((v, i) => v === b.v[i]), 'same seed, same steps: the same swarm bit for bit');
  check(a.p.some((v, i) => Math.abs(v - c.p[i]) > 0.01), 'another seed: another swarm');
}

console.log('4. boids');
{
  const sw = D.swarm(7, [0, 64, 0], 60), ctx = still(40, 64, 40);
  let nnSum = 0, nnMin = 0, frames = 0, order = 0, ordN = 0, hoverOK = true;
  run(sw, 20, ctx, (t) => {
    if (t < 3) return;
    const n = sw.n, P = sw.p, V = sw.v; let mn = 1e9, sum = 0;
    for (let i = 0; i < n; i++) { let best = 1e9; for (let j = 0; j < n; j++) if (j !== i) best = Math.min(best, Math.hypot(P[i * 3] - P[j * 3], P[i * 3 + 1] - P[j * 3 + 1], P[i * 3 + 2] - P[j * 3 + 2])); sum += best; mn = Math.min(mn, best); const y = P[i * 3 + 1] - 64; if (y < 0.24 || y > 3.81) hoverOK = false; }
    nnSum += sum / n; nnMin += mn; frames++;
    let vx = 0, vy = 0, vz = 0, vs = 0; for (let i = 0; i < n; i++) { vx += V[i * 3]; vy += V[i * 3 + 1]; vz += V[i * 3 + 2]; vs += Math.hypot(V[i * 3], V[i * 3 + 1], V[i * 3 + 2]); }
    order += Math.hypot(vx, vy, vz) / (vs || 1); ordN++;
  });
  let r2 = 0; for (let i = 0; i < sw.n; i++) r2 += (sw.p[i * 3] - sw.cx) ** 2 + (sw.p[i * 3 + 1] - sw.cy) ** 2 + (sw.p[i * 3 + 2] - sw.cz) ** 2;
  const rms = Math.sqrt(r2 / sw.n);
  check(nnSum / frames >= 0.3, `they keep apart (mean nearest neighbour ${(nnSum / frames).toFixed(2)} m)`);
  check(nnMin / frames >= 0.08, `none crowd in (closest pair on average ${(nnMin / frames).toFixed(3)} m)`);
  check(rms <= 4.5, `they stay together (rms radius ${rms.toFixed(2)} m)`);
  check(order / ordN >= 0.3, `they fly in step (order ${(order / ordN).toFixed(2)})`);
  check(hoverOK, 'over the grass, under the treetops (0.25–3.8 m)');
}

console.log('5. the ring round a still player');
{
  const sw = D.swarm(11, [0, 64, 0], 40), ctx = still(3, 64, 2);
  run(sw, 12, ctx, (t, c) => { c.still = t; });
  const r = D.ring(sw, 3, 64, 2);
  check(r.share >= 0.7 && r.sectors === 8 && r.ok, `a ring round you (${Math.round(r.share * 100)} % in the band, ${r.sectors}/8 eighths)`);
  const sw2 = D.swarm(11, [0, 64, 0], 40), c2 = still(3, 64, 2); c2.ringOk = false;
  run(sw2, 12, c2, (t, c) => { c.still = t; });
  check(!D.ring(sw2, 3, 64, 2).ok, 'not for a swarm that may not ring (only the nearest)');
  const sw3 = D.swarm(11, [0, 64, 0], 40), c3 = still(3, 64, 2);
  run(sw3, 12, c3, (t, c) => { c.still = 0; c.speed = 0.2; });
  check(!D.ring(sw3, 3, 64, 2).ok, 'not while you do not stand still');
}

console.log('6. walking through');
{
  const pass = (part) => {
    const k0 = D.K.part; if (!part) D.K.part = 0;
    const sw = D.swarm(21, [0, 64, 0], 40), ctx = { px: -14, py: 63.2, pz: 0.3, still: 0, speed: 0 };
    run(sw, 6, Object.assign({}, ctx, { px: 0, pz: 40 }));   // they settle round their home first (you far away)
    let s = 0, n = 0; sw.tgtT = 99; ctx.pz = sw.cz; ctx.py = sw.cy - 1; const x0 = sw.cx - 14, xm = sw.cx;   // (the leader rests: you walk straight through its middle)
    run(sw, 7, ctx, (t, c) => { c.px = x0 + t * 4; c.vx = 4; c.speed = 4; if (Math.abs(c.px - xm) < 3) { let best = 1e9; for (let i = 0; i < sw.n; i++) best = Math.min(best, Math.hypot(sw.p[i * 3] - c.px, sw.p[i * 3 + 2] - c.pz)); s += best; n++; } });
    D.K.part = k0; return n ? s / n : 0;
  };
  const a = pass(true), b = pass(false);
  check(a >= 1.3 && a >= b * 1.5, `they part as you walk through (nearest mote ${a.toFixed(2)} m on average)`);
  check(b < 1.0, `(without the parting rule ${b.toFixed(2)} m: the test sees it)`);
}

console.log('7. the flowers and the water');
{
  const sw = D.swarm(31, [0, 64, 0], 40); sw.attract = [[9, 64, 6]];
  let best = 1e9; run(sw, 40, still(-30, 64, -30), () => { best = Math.min(best, Math.hypot(sw.cx - 9, sw.cz - 6)); });
  check(best <= 3, `the swarm trails to a flower 11 m off (comes within ${best.toFixed(2)} m)`);
}

console.log('8. the chime once a night');
{
  const mem = { night: null }, n0 = D.nightOf(12000 + 24000 * 5), n1 = D.nightOf(23000 + 24000 * 5), n2 = D.nightOf(12000 + 24000 * 6);
  check(n0 === n1 && n2 === n0 + 1 && D.nightOf(3000 + 24000 * 6) === n0, 'a night is one number (dusk to dawn)');
  check(D.chimeOk(mem, n0) === true && D.chimeOk(mem, n1) === false && D.chimeOk(mem, n2) === true, 'the first ring of a night chimes, the second not, the next night again');
}

console.log('9. no allocation a step');
{
  const sw = D.swarm(41, [0, 64, 0], 56), ctx = { px: 2, py: 64, pz: 2, still: 0, speed: 0, vx: 0, vz: 0 };
  const go = (n) => { for (let f = 0; f < n; f++) { ctx.still = (f % 600) / 30; ctx.speed = f % 900 < 300 ? 3 : 0; D.step(sw, 1 / 30, ctx); } };
  go(6000);   // (warm: every branch seen, optimised)
  if (global.gc) global.gc();
  const h0 = process.memoryUsage().heapUsed; go(2000); const per = (process.memoryUsage().heapUsed - h0) / 2000;
  check(!global.gc || per < 256, `a step allocates ~nothing (${per.toFixed(0)} B a step with the test's own numbers${global.gc ? '' : '; no gc here, not judged'})`);
  const t0 = process.hrtime.bigint(); go(3000); const us = Number(process.hrtime.bigint() - t0) / 3000 / 1000;
  console.log(`     a step of 56 motes: ${us.toFixed(1)} µs`);
}

console.log('10. the colours keep at dusk');
{
  const sws = [D.swarm(51, [0, 64, 0], 40)], buf = new Float32Array(400 * 14);
  if (D.pickHue) sws.push(D.swarm(52, [30, 64, 0], 40, D.pickHue(sws, 52))); else sws.push(D.swarm(52, [30, 64, 0], 40));
  sws.forEach(s => { s.fade = 1; });
  const q = D.fill(buf, sws, [0, 64, 0], 1, 120);
  let sat = 0; for (let k = 0; k < q; k++) { const o = k * 14, mx = Math.max(buf[o + 8], buf[o + 9], buf[o + 10]), mn = Math.min(buf[o + 8], buf[o + 9], buf[o + 10]); if (mx >= 2.2 * mn) sat++; }
  check(q > 0 && sat === q, `every light a saturated hue (${sat}/${q} quads max ≥ 2.2 × min channel)`);
  const share = (s) => s.main === undefined ? 0 : s.hue.reduce((a, h) => a + (h === s.main ? 1 : 0), 0) / s.n;
  check(sws.every(s => share(s) >= 0.8), `each swarm one main hue (${sws.map(s => Math.round(share(s) * 100) + ' %').join(', ')})`);
  check(sws[0].main !== undefined && sws[0].main !== sws[1].main, 'a neighbour swarm takes another hue');
  // the fog toward their own colour: far away only the alpha falls
  const far = [D.swarm(53, [0, 64, 60], 20)]; far[0].fade = 1;
  const b1 = new Float32Array(100 * 14), b2 = new Float32Array(100 * 14), q1 = D.fill(b1, far, [0, 64, 0], 1, 120), q2 = D.fill(b2, far, [0, 64, 0], 1, 120, [20, 70, 0, 0]);
  let same = q1 === q2, lower = q1 === q2; for (let k = 0; k < q1 && same; k++) { const o = k * 14; for (let c = 8; c < 11; c++) if (b1[o + c] !== b2[o + c]) same = false; if (!(b2[o + 13] < b1[o + 13] * 0.8)) lower = false; }
  check(same && lower, 'fogged motes keep their colour, only their light fades');
}

console.log('11. swarms keep apart, crowded glows soft-capped');
{
  const a = D.swarm(61, [-10, 64, 0], 40), b = D.swarm(62, [10, 64, 0], 40), sws = [a, b];
  a.attract = [[0, 64, 0]]; b.attract = [[0, 64, 0]];
  const ctx = still(0, 64, 80); let mn = 1e9;
  for (let f = 0; f < 60 * 30; f++) { if (D.space) D.space(sws, 18); D.step(a, 1 / 30, ctx); D.step(b, 1 / 30, ctx); if (f > 60) mn = Math.min(mn, Math.hypot(a.cx - b.cx, a.cz - b.cz)); }
  check(mn >= 18, `two swarms lured to one flower between them stay ≥ 18 m apart (closest ${mn.toFixed(1)} m)`);
  const sw = D.swarm(63, [0, 64, 0], 40); sw.fade = 1; run(sw, 20, still(40, 64, 40));
  const buf = new Float32Array(100 * 14), halo = () => { const q = D.fill(buf, [sw], [0, 64, 0], 1, 120); let s = 0; for (let k = 0; k < q; k++) if (buf[k * 14 + 3] > 0.1) s += buf[k * 14 + 13]; return s; };
  D.step(sw, 1e-4, still(40, 64, 40)); const spread = halo();
  const nb0 = sw.nb ? sw.nb.slice() : null; if (sw.nb) sw.nb.fill(0); const raw = halo(); if (nb0) sw.nb.set(nb0);
  for (let i = 0; i < sw.n; i++) { sw.p[i * 3] = 0.1 * Math.cos(i); sw.p[i * 3 + 1] = 65 + 0.1 * Math.sin(i * 3); sw.p[i * 3 + 2] = 0.1 * Math.sin(i); }
  D.step(sw, 1e-4, still(40, 64, 40)); const packed = halo();
  check(packed <= 0.6 * spread, `a packed clump glows no brighter (halo sum ${packed.toFixed(2)} vs ${spread.toFixed(2)} spread)`);
  check(spread >= 0.85 * raw, `a loose swarm in flight keeps its glow (${spread.toFixed(2)} of ${raw.toFixed(2)})`);
}

console.log('12. the ring breathes');
{
  const sw = D.swarm(11, [0, 64, 0], 40), PX = 3, PY = 64, PZ = 2, ctx = still(PX, PY, PZ);
  run(sw, 12, ctx, (t, c) => { c.still = t; });
  const n = sw.n, ang = (i) => Math.atan2(sw.p[i * 3 + 2] - PZ, sw.p[i * 3] - PX), rad = (i) => Math.hypot(sw.p[i * 3] - PX, sw.p[i * 3 + 2] - PZ);
  const ys = Array.from({ length: n }, (_, i) => sw.p[i * 3 + 1]), med = ys.slice().sort((x, y) => x - y)[n >> 1], low = ys.map(y => y < med);
  let dh = 0, dr = 0, ns = 0, rMin = 1e9, rMax = -1e9, okN = 0, cv = 0, wPos = 0, wNeg = 0;
  let prev = Array.from({ length: n }, (_, i) => ang(i)), still0 = 12;
  for (let s = 0; s < 100; s++) {
    run(sw, 0.5, ctx, (t, c) => { c.still = still0 + s * 0.5 + t; });
    let yl = 0, yh = 0, rl = 0, rh = 0, nl = 0, rs = 0, w = 0, wl = 0; const as = [];
    for (let i = 0; i < n; i++) {
      const y = sw.p[i * 3 + 1], r = rad(i), a = ang(i); rs += r; as.push(a);
      if (low[i]) { yl += y; rl += r; nl++; let d = a - prev[i]; d -= Math.round(d / TAU_) * TAU_; wl += d / 0.5; } else { yh += y; rh += r; }
      prev[i] = a;
    }
    const nh = n - nl; dh += Math.abs(yh / nh - yl / nl); dr += Math.abs(rh / nh - rl / nl); ns++;
    rMin = Math.min(rMin, rs / n); rMax = Math.max(rMax, rs / n);
    w = wl / nl; if (w > 0.05) wPos++; if (w < -0.05) wNeg++;
    as.sort((x, y) => x - y); const gaps = as.map((x, i) => (i ? x - as[i - 1] : x + TAU_ - as[n - 1])), gm = TAU_ / n; cv += Math.sqrt(gaps.reduce((q, g) => q + (g - gm) ** 2, 0) / n) / gm;
    if (D.ring(sw, PX, PY, PZ, {}).ok) okN++;
  }
  check(dh / ns >= 0.5, `two rings at different heights (${(dh / ns).toFixed(2)} m apart)`);
  check(dr / ns >= 0.45, `… and different radii (${(dr / ns).toFixed(2)} m apart)`);
  check(rMax - rMin >= 0.3, `the ring breathes (mean radius ${rMin.toFixed(2)}–${rMax.toFixed(2)} m)`);
  check(wPos >= 5 && wNeg >= 5, `the turn slowly reverses (${wPos} samples one way, ${wNeg} the other)`);
  check(cv / ns >= 0.3, `the motes' places uneven (gaps' variation ${(cv / ns).toFixed(2)})`);
  check(okN >= 80, `still a ring all along (${okN}/100 samples)`);
}

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
