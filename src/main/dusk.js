// ============================================================================
// Flausellichter (v-dusk; docs/superpowers/plans/2026-11-05-v-dusk.md): at dusk and at night the meadows and the
// forest edges come alive — soft drifting swarm lights, the little lights of the Flausel folk (fairy.js). They flock
// (boids: separation, alignment, cohesion), drift between their meadow and the flowers and the water near it (a stream
// trailing after its leader point), gather round you in a slow ring when you stand still, and part as you walk through.
// Once a night, when a swarm has closed its ring round you, a gentle chime.
//   pure part (node): the caps per tier, the dusk factor, a deterministic swarm (its own seeded generator, no
//   Math.random), one boids step, the ring test, the once-a-night rule — test/dusk_swarm.js
//   game part: anchors on grass near the player (forest edges and flowers count more), at most CAPS[tier] motes in all,
//   drawn with the particle program from its own small instance buffer, additive, one draw call (renderer.drawMotes);
//   Very Low: nothing — frame() returns at its first test between once-a-second tier checks, nothing allocated, no
//   program. Switch: dusk (⚙ Bild · Dinge & Effekte).
// ============================================================================
(function (VR) {
  'use strict';
  const D = VR.Dusk = {};
  const TAU = Math.PI * 2;
  // the motes of each tier, in all: 0 Very Low · 1 Low · 2 Balanced · 3 High · 4 Ultra — and how many swarms share them
  D.CAPS = [0, 36, 80, 120, 168];
  D.SWARMS = [0, 1, 2, 2, 3];
  D.plan = (tier) => { const t = Math.max(0, Math.min(4, tier | 0)), s = D.SWARMS[t]; return { swarms: s, per: s ? Math.floor(D.CAPS[t] / s) : 0, cap: D.CAPS[t] }; };
  // how much of the evening it is: 0 with the sun up (above ~13°), rising through the golden hour, 1 from the sun's set
  D.glow = (sunY) => { const e = Math.max(0, Math.min(1, (0.22 - sunY) / 0.24)); return e * e * (3 - 2 * e); };
  // a night's number (noon to noon: one night one number; ticks 0 = sunrise, 12000 = sunset)
  D.nightOf = (ticks) => Math.floor(((ticks || 0) - 6000) / 24000);
  // once a night: true the first time a ring closes in this night
  D.chimeOk = (mem, night) => { if (mem.night === night) return false; mem.night = night; return true; };
  // the generator: mulberry32 in the swarm's own state
  const rnd = (sw) => { let t = (sw.rs = (sw.rs + 0x6D2B79F5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  D.rnd = rnd;
  // the lights' colours (linear, before the particle shader's ×4 for emissive): warm gold, mint, rose-lilac, sky blue
  D.HUES = [[0.26, 0.2, 0.08], [0.13, 0.24, 0.16], [0.24, 0.14, 0.23], [0.14, 0.19, 0.26]];
  // a swarm of n motes round home [x, y (the ground), z]
  D.swarm = function (seed, home, n) {
    const sw = { n, seed: seed | 0, rs: (seed | 0) ^ 0x9e3779b9, p: new Float32Array(n * 3), v: new Float32Array(n * 3), ph: new Float32Array(n), hue: new Uint8Array(n),
      home: [home[0], home[1], home[2]], floor: home[1], tgt: [home[0], home[1] + 1.2, home[2]], tgtT: 0, attract: [], t: 0, fade: 0, gone: false, ring: 0, near: false, cx: home[0], cy: home[1] + 1, cz: home[2] };
    const main = Math.floor(rnd(sw) * 4);
    for (let i = 0; i < n; i++) {
      const a = rnd(sw) * TAU, r = Math.sqrt(rnd(sw)) * 2.2;
      sw.p[i * 3] = home[0] + Math.cos(a) * r; sw.p[i * 3 + 1] = home[1] + 0.6 + rnd(sw) * 1.6; sw.p[i * 3 + 2] = home[2] + Math.sin(a) * r;
      sw.v[i * 3] = (rnd(sw) - 0.5) * 0.4; sw.v[i * 3 + 1] = (rnd(sw) - 0.5) * 0.1; sw.v[i * 3 + 2] = (rnd(sw) - 0.5) * 0.4;
      sw.ph[i] = rnd(sw) * TAU; sw.hue[i] = rnd(sw) < 0.7 ? main : Math.floor(rnd(sw) * 4);
    }
    return sw;
  };
  // the rules' weights (tuned on test/dusk_swarm.js and the pictures)
  const K = D.K = { rn: 1.7, rs: 0.6, coh: 0.55, ali: 0.9, sep: 5, home: 0.45, ring: 1.8, ringR: 2.3, part: 16, partR: 3, vmax: 1.5, vrun: 3.2, drag: 0.7, wander: 0.35, ringFrom: 1.6, ringFull: 4.5, ringReach: 10 };
  // one step. ctx: {px, py, pz: the player's feet, vx, vz: its velocity, still: seconds standing still, speed: m/s, ringOk: this swarm may ring}
  D.step = function (sw, dt, ctx) {
    if (!(dt > 0)) return; if (dt > 0.1) dt = 0.1;
    const n = sw.n, P = sw.p, V = sw.v; sw.t += dt;
    // the leader point: it wanders between the home meadow and the flowers and water near it (the motes trail after it)
    if ((sw.tgtT -= dt) <= 0) {
      sw.tgtT = 6 + rnd(sw) * 7;
      if (sw.attract.length && rnd(sw) < 0.6) { const q = sw.attract[Math.floor(rnd(sw) * sw.attract.length)]; sw.tgt[0] = q[0]; sw.tgt[1] = q[1] + 0.7; sw.tgt[2] = q[2]; }
      else { const a = rnd(sw) * TAU, r = rnd(sw) * 5; sw.tgt[0] = sw.home[0] + Math.cos(a) * r; sw.tgt[1] = sw.floor + 0.9 + rnd(sw) * 1.2; sw.tgt[2] = sw.home[2] + Math.sin(a) * r; }
    }
    // the centre, and whether you are close and still enough for a ring
    let cx = 0, cy = 0, cz = 0; for (let i = 0; i < n; i++) { cx += P[i * 3]; cy += P[i * 3 + 1]; cz += P[i * 3 + 2]; } cx /= n || 1; cy /= n || 1; cz /= n || 1;
    sw.cx = cx; sw.cy = cy; sw.cz = cz;
    const px = ctx.px, py = ctx.py, pz = ctx.pz, dcp = Math.sqrt((cx - px) * (cx - px) + (cz - pz) * (cz - pz));
    const ringK = ctx.ringOk !== false && dcp < K.ringReach ? Math.max(0, Math.min(1, ((ctx.still || 0) - K.ringFrom) / (K.ringFull - K.ringFrom))) : 0;
    sw.ring += (ringK - sw.ring) * Math.min(1, dt * 1.5);
    const walking = (ctx.speed || 0) > 0.8, rn2 = K.rn * K.rn, t = sw.t, floor = sw.floor;
    for (let i = 0; i < n; i++) {
      const ix = i * 3, x = P[ix], y = P[ix + 1], z = P[ix + 2];
      let sx = 0, sy = 0, sz = 0, mx = 0, my = 0, mz = 0, ux = 0, uy = 0, uz = 0, m = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const jx = j * 3, dx = x - P[jx], dy = y - P[jx + 1], dz = z - P[jx + 2], d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > rn2) continue;
        m++; mx += P[jx]; my += P[jx + 1]; mz += P[jx + 2]; ux += V[jx]; uy += V[jx + 1]; uz += V[jx + 2];
        if (d2 < K.rs * K.rs) { const d = Math.sqrt(d2) + 1e-4, f = (K.rs - d) / (K.rs * d); sx += dx * f; sy += dy * f; sz += dz * f; }
      }
      let ax = sx * K.sep, ay = sy * K.sep, az = sz * K.sep;
      if (m) { ax += (mx / m - x) * K.coh + (ux / m - V[ix]) * K.ali; ay += (my / m - y) * K.coh + (uy / m - V[ix + 1]) * K.ali; az += (mz / m - z) * K.coh + (uz / m - V[ix + 2]) * K.ali; }
      // its own point: round the leader (a slow loop of its own), or its place in the ring round you
      const ph = sw.ph[i];
      const lx = sw.tgt[0] + Math.cos(t * 0.31 + ph) * 1.4, ly = sw.tgt[1] + Math.sin(t * 0.53 + ph * 2) * 0.45, lz = sw.tgt[2] + Math.sin(t * 0.27 + ph * 1.3) * 1.4;
      let gx = (lx - x) * K.home, gy = (ly - y) * K.home, gz = (lz - z) * K.home;
      const rk = sw.ring;
      if (rk > 0.001) {
        const a = (i / n) * TAU + t * 0.22, R = K.ringR + 0.3 * Math.sin(t * 0.7 + ph);
        const rx = px + Math.cos(a) * R, ry = py + 0.8 + 0.5 * ((i * 7) % 5) / 4 + 0.2 * Math.sin(t * 0.9 + ph * 3), rz = pz + Math.sin(a) * R;
        gx = gx * (1 - rk) + (rx - x) * K.ring * rk; gy = gy * (1 - rk) + (ry - y) * K.ring * rk; gz = gz * (1 - rk) + (rz - z) * K.ring * rk;
        ax *= 1 - 0.6 * rk; ay *= 1 - 0.6 * rk; az *= 1 - 0.6 * rk;   // (in the ring each keeps its own place: less flocking)
      }
      ax += gx; ay += gy; az += gz;
      // a little wander of its own (two sines)
      ax += Math.sin(t * 1.3 + ph * 7) * K.wander; ay += Math.sin(t * 0.9 + ph * 5) * K.wander * 0.5; az += Math.cos(t * 1.1 + ph * 3) * K.wander;
      // walking through: they part round you (and lift a little)
      let run = false;
      if (walking) {
        const dx = x - px - (ctx.vx || 0) * 0.3, dz = z - pz - (ctx.vz || 0) * 0.3, dy = y - (py + 1), d = Math.sqrt(dx * dx + dz * dz);   // (from where you will be in a moment)
        if (d < K.partR && Math.abs(dy) < 2.2) { const f = (K.partR - d) / K.partR * K.part, inv = 1 / (d + 0.05); ax += dx * inv * f; az += dz * inv * f; ay += f * 0.25; run = true; }
      }
      V[ix] += ax * dt; V[ix + 1] += ay * dt; V[ix + 2] += az * dt;
      const dr = Math.exp(-K.drag * dt); V[ix] *= dr; V[ix + 1] *= dr; V[ix + 2] *= dr;
      const sp = Math.sqrt(V[ix] * V[ix] + V[ix + 1] * V[ix + 1] + V[ix + 2] * V[ix + 2]), vm = run ? K.vrun : K.vmax;
      if (sp > vm) { const k = vm / sp; V[ix] *= k; V[ix + 1] *= k; V[ix + 2] *= k; }
      P[ix] = x + V[ix] * dt; P[ix + 1] = y + V[ix + 1] * dt; P[ix + 2] = z + V[ix + 2] * dt;
      // over the grass, under the treetops
      const lo = floor + 0.25, hi = floor + 3.8;
      if (P[ix + 1] < lo) { P[ix + 1] = lo; if (V[ix + 1] < 0) V[ix + 1] *= -0.3; } else if (P[ix + 1] > hi) { P[ix + 1] = hi; if (V[ix + 1] > 0) V[ix + 1] *= -0.3; }
    }
  };
  // the ring round (px, py, pz): the share of motes 1.5–3.3 m out at about your height, the eighths of the circle they fill
  const RING = { share: 0, sectors: 0, ok: false };   // (one answer object, reused: asked every frame while you stand in a ring)
  D.ring = function (sw, px, py, pz, out) {
    let k = 0, sec = 0; const n = sw.n, P = sw.p;
    for (let i = 0; i < n; i++) {
      const dx = P[i * 3] - px, dz = P[i * 3 + 2] - pz, dy = P[i * 3 + 1] - py, d = Math.sqrt(dx * dx + dz * dz);
      if (d < 1.5 || d > 3.3 || dy < -0.5 || dy > 3) continue;
      k++; sec |= 1 << (Math.floor((Math.atan2(dz, dx) / TAU + 0.5) * 8) & 7);
    }
    let s = 0; for (let b = 0; b < 8; b++) if (sec & (1 << b)) s++;
    const share = n ? k / n : 0, r = out || RING;
    r.share = share; r.sectors = s; r.ok = share >= 0.7 && s === 8; return r;
  };
  // the instance data of the swarms: two quads a mote (a soft halo and a bright core), camera-relative — 14 floats
  // each, the particle layout (pos+size, uv rect, colour+layer, emissive+alpha); returns the quads written
  D.fill = function (out, swarms, cam, glow, cap) {
    const d = out; let o = 0, q = 0; const max = Math.floor(d.length / 14);
    for (const sw of swarms) {
      const a0 = glow * sw.fade; if (a0 < 0.01) continue;
      const P = sw.p, t = sw.t;
      for (let i = 0; i < sw.n && q + 2 <= max && q < cap * 2; i++) {
        const ph = sw.ph[i], s = Math.sin(t * (1.7 + (i % 5) * 0.23) + ph * 9), tw = 0.45 + 0.55 * s * s, a = a0 * tw, c = D.HUES[sw.hue[i]];
        const x = P[i * 3] - cam[0], y = P[i * 3 + 1] - cam[1], z = P[i * 3 + 2] - cam[2];
        for (let h = 0; h < 2; h++) {
          d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = h ? 0.045 + 0.02 * tw : 0.2 + 0.07 * tw;
          d[o + 4] = 0; d[o + 5] = 0; d[o + 6] = 1; d[o + 7] = 1;
          // (the core warm-white in its hue, the halo the hue itself, faint: lights, not a mist)
          const k = h ? 1.15 : 0.6, w0 = h ? 0.035 : 0; d[o + 8] = c[0] * k + w0; d[o + 9] = c[1] * k + w0; d[o + 10] = c[2] * k + w0; d[o + 11] = -1;
          d[o + 12] = 1; d[o + 13] = h ? a : a * 0.2;
          o += 14; q++;
        }
      }
    }
    return q;
  };

  if (typeof document === 'undefined') return;   // node: the pure part only
  // ============================================================================ the game
  const T = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : de);
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'dusk', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.dusk', tip: 'g.set.dusk.tip', cost: 'low', def: true });
  const S = D.state = { sw: [], tier: 0, tierT: 0, findT: 0, still: 0, speed: 0, last: null, mem: { night: null }, floorT: 0, flowers: null, cost: { ms: 0, frames: 0 } };
  const out = D.out = { data: null, count: 0, fill: null };
  D.hold = false;   // (golden pictures: nothing drawn)
  const tierOf = (g) => (VR.AirLife && VR.AirLife.tierOf ? VR.AirLife.tierOf(g.settings) : 2);
  const on = (g) => !!g.settings && g.settings.dusk !== false && g.settings.airLife !== false;
  // the flowers' states (built once)
  const FLOWERS = ['dandelion', 'golden_dandelion', 'poppy', 'cornflower', 'oxeye_daisy', 'lily_of_the_valley', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'wildflowers', 'torchflower', 'sunflower', 'vx_flowerbed', 'vx_flowerbed_roses', 'vx_flowerbed_tulips', 'starfruit_flower'];
  function flowerTable() {
    const R = VR.R; if (S.flowers || !R || !R.T) return S.flowers;
    const t = new Uint8Array(R.T.flags.length);
    for (const nm of FLOWERS) { const b = R.byName[nm]; if (b) for (let s = b.base; s < b.base + b.nstates; s++) t[s] = 1; }
    const gb = R.byName.grass_block; S.grassType = gb ? R.T.type[gb.defaultState] : -1;
    return (S.flowers = t);
  }
  const ground = (g, x, z) => { const w = g.world; if (!w || !w.col) return null; const ix = Math.floor(x), iz = Math.floor(z), c = w.col(ix >> 4, iz >> 4); if (!c || !c.height) return null; return c.height[((iz & 15) << 4) | (ix & 15)] + 1; };
  const flag = (st, f) => !!(VR.R.T.flags[st] & f);
  // a meadow spot near the player: grass on top; flowers, water and a forest edge near it count more
  function anchor(g, p, night) {
    const w = g.world, R = VR.R, FL = flowerTable(); if (!w || !FL) return null;
    let best = null, bs = 0;
    for (let k = 0; k < 14; k++) {
      const h = Math.imul(night * 7919 + k * 104729 + (S.sw.length + 1) * 15485863, 2654435761) >>> 0;
      const a = (h % 3600) / 3600 * TAU, r = 9 + ((h >>> 12) % 1300) / 100;
      const x = Math.floor(p[0] + Math.cos(a) * r), z = Math.floor(p[2] + Math.sin(a) * r), gy = ground(g, x, z); if (gy === null) continue;
      if (S.sw.some((s) => Math.hypot(s.home[0] - x, s.home[2] - z) < 13)) continue;
      const top = w.getBlock(x, gy - 1, z), below = w.getBlock(x, gy - 2, z);
      let floorY = gy, sc = 0;
      if (R.T.type[top] === S.grassType) sc = 1; else if (R.T.type[below] === S.grassType && !flag(top, VR.F.SOLID)) { sc = 1; floorY = gy - 1; }
      if (!sc) continue;
      let fl = 0, edge = 0, wet = 0;
      for (let j = 0; j < 8; j++) {
        const b = j * TAU / 8, ex = Math.floor(x + Math.cos(b) * 4.5), ez = Math.floor(z + Math.sin(b) * 4.5), ey = ground(g, ex, ez); if (ey === null) continue;
        const st = w.getBlock(ex, ey - 1, ez);
        if (FL[st] || FL[w.getBlock(ex, ey, ez)]) fl++;
        if (flag(st, VR.F.LEAVES) || flag(w.getBlock(ex, floorY + 3, ez), VR.F.LEAVES)) edge++;
        if (flag(st, VR.F.WATER)) wet++;
      }
      sc += fl * 0.35 + (edge > 0 && edge < 6 ? 1.5 : 0) + (wet ? 0.6 : 0);
      if (sc > bs) { bs = sc; best = [x + 0.5, floorY, z + 0.5]; }
    }
    return best;
  }
  // the flowers and the water near a home (the leader's other places)
  function attractors(g, home) {
    const w = g.world, FL = flowerTable(), out2 = [];
    for (let dz = -9; dz <= 9 && out2.length < 6; dz += 3) for (let dx = -9; dx <= 9 && out2.length < 6; dx += 3) {
      const x = Math.floor(home[0] + dx), z = Math.floor(home[2] + dz), gy = ground(g, x, z); if (gy === null) continue;
      const st = w.getBlock(x, gy - 1, z);
      if (FL[st] || FL[w.getBlock(x, gy, z)] || flag(st, VR.F.WATER)) out2.push([x + 0.5, gy - (flag(st, VR.F.WATER) ? 0.2 : 0), z + 0.5]);
    }
    return out2;
  }
  function chime(g) {
    const a = g.audio;
    try { if (a && a.ctx && a.tone) [659, 784, 988, 1175, 1319, 1568].forEach((f, i) => a.tone(f, 0.035, 1.4, 'sine', true, a.ctx.currentTime + i * 0.14)); } catch (e) { /* no sound */ }
    const text = T('g.dusk.ring', null, 'Die Flausellichter tanzen einen Ring um dich.', 'The Flausel lights dance a ring round you.');
    if (VR.Quiet && VR.Quiet.note) VR.Quiet.note(text, 1, 'dusk.ring'); else if (g.ui && g.ui.hint) g.ui.hint(text, 3000);
    S.rings = (S.rings || 0) + 1;
  }
  // the frame (game.js, after the fairy places)
  D.frame = function (g, dt, eye, E) {
    if ((S.tierT -= dt) <= 0) { S.tierT = 1; S.tier = g && on(g) ? tierOf(g) : 0; }
    if (S.tier === 0 || D.hold || !g || g.state !== 'play' || !E) { if (S.sw.length) S.sw.length = 0; out.count = 0; return; }
    const pl = g.player; if (!pl || !pl.pos) { out.count = 0; return; }
    const p = pl.pos, sd = E.sunDir || [0, 1, 0];
    const glow = D.glow(sd[1]) * (1 - Math.min(1, (E.rain || 0) * 1.6)) * (g.underwater ? 0 : 1);
    S.glow = glow;
    // standing still or walking (the feet's speed, smoothed)
    if (!S.last) S.last = [p[0], p[1], p[2]];
    const idt = 1 / Math.max(1e-3, dt), vx = (p[0] - S.last[0]) * idt, vz = (p[2] - S.last[2]) * idt, v = Math.sqrt(vx * vx + vz * vz); S.last[0] = p[0]; S.last[1] = p[1]; S.last[2] = p[2];
    const kv = Math.min(1, dt * 6); S.vx = (S.vx || 0) + ((v < 12 ? vx : 0) - (S.vx || 0)) * kv; S.vz = (S.vz || 0) + ((v < 12 ? vz : 0) - (S.vz || 0)) * kv;
    S.speed += (Math.min(12, v) - S.speed) * Math.min(1, dt * 6);
    S.still = S.speed < 0.3 ? S.still + dt : 0;
    const plan = D.plan(S.tier), night = D.nightOf(E.ticks !== undefined ? E.ticks : (g.env && g.env.ticks) || 0);
    // swarms come with the evening near you, go when you leave them or the day comes
    if (glow > 0.05 && S.sw.length < plan.swarms && (S.findT -= dt) <= 0) {
      S.findT = 2;
      const h = anchor(g, p, night);
      if (h) { const sw = D.swarm((night * 31 + Math.floor(h[0]) * 73856093) ^ (Math.floor(h[2]) * 19349663), h, plan.per); sw.attract = attractors(g, h); S.sw.push(sw); }
    }
    let nearest = null, nd = 1e9;
    for (const sw of S.sw) { const d = Math.hypot(sw.cx - p[0], sw.cz - p[2]); if (d < nd) { nd = d; nearest = sw; } sw.gone = sw.gone || d > 44 || glow < 0.03; }
    if ((S.floorT -= dt) <= 0) { S.floorT = 0.5; for (const sw of S.sw) { const gy = ground(g, sw.cx, sw.cz); if (gy !== null && Math.abs(gy - sw.floor) < 6) sw.floor = gy; } }
    const ctx = S.ctx || (S.ctx = { px: 0, py: 0, pz: 0, still: 0, speed: 0, ringOk: false });
    ctx.px = p[0]; ctx.py = p[1]; ctx.pz = p[2]; ctx.still = S.still; ctx.speed = S.speed; ctx.vx = S.vx; ctx.vz = S.vz;
    for (let i = S.sw.length - 1; i >= 0; i--) {
      const sw = S.sw[i];
      sw.fade = Math.max(0, Math.min(1, sw.fade + dt * (sw.gone ? -0.5 : 0.35)));
      if (sw.gone && sw.fade <= 0) { S.sw.splice(i, 1); continue; }
      if (nd > 60 && sw !== nearest) continue;
      ctx.ringOk = sw === nearest && !sw.gone;
      D.step(sw, dt, ctx);
    }
    // the ring closed round you: once a night, a chime
    if (nearest && nearest.ring > 0.9 && S.still > 5 && glow > 0.3 && D.ring(nearest, p[0], p[1], p[2]).ok && D.chimeOk(S.mem, night)) chime(g);
    out.glow = glow; out.cap = plan.cap; out.count = S.sw.length ? 1 : 0;
  };
  // the renderer asks for the quads (camera-relative) when it draws
  out.fill = function (cam) {
    if (!out.data) out.data = new Float32Array(D.CAPS[4] * 2 * 14);
    return D.fill(out.data, S.sw, cam, out.glow || 0, out.cap || 0);
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
