// ============================================================================
// u-moons2 · VR.BodyLife2 — what happens on Zinnober, Ocker and Aquamarin (plan docs/superpowers/plans/
// 2026-10-30-u-moons2.md §1; U§6.3; R§2.3, §5.4, §5.5). bodylife.js calls update() each frame on a body (one marked line);
// the sky draws what this puts in VR.BodySky.plumes (space_shaders.js: umbrellas on Zinnober, dust devils on Ocker).
//   · Zinnober: six active vents (gen_body2.js vents()), each erupting every 100–140 s for 40–60 s — the same moments for
//     host and guests (the world clock, the vent's seed). Sulfur dioxide leaves at ~140 m/s and climbs for over a minute
//     under 1.8 m/s² to 5–6 km, falling back in a ring twice as wide: the canopy grows, stands while the vent fires, and
//     fades. The Glutsee's fountains: glowing spatter over the open melt within 300 m (Very Low: a third, larger)
//   · Ocker: a dust devil in view every ~60 s — born 300–1,200 m away, wandering with the wind for 1.5–2.5 min, 300–800 m
//     tall, 26 m wide (R§5.4: up to 20 km tall and 70 m wide on Mars, the height ÷ 64, the width real); grains swirling
//     round its foot when you are close. The weather: a dust storm every ~25 min of play at most every other time — its
//     front (a wall of dust near the ground) arrives, τ climbs to 4.5 (atmo_lut.js: the day turns to dusk), holds and
//     clears; streaks of dust past the eye. Its thin air: sounds reach only 24 blocks, high tones gone within 8 (audio.js)
//   · Aquamarin: the swell taller than at home (the water's storm factor; the low gravity's slow periods are a stated gap:
//     the water shader's time is the world's); at night glowing drifters (our own: soft blue-green lights) over the shallows
//   · the codex: a plume, the Glutsee at night, a dust devil, the blue sunset, a storm, an atoll, Herzwelt overhead
// ============================================================================
(function (VR) {
  'use strict';
  const TAU = Math.PI * 2;
  const hash = (a, b) => { let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0) / 4294967296; };
  const ss = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  const B2 = VR.BodyLife2 = { PAGES: ['zinn', 'ocker', 'aqua', 'plume', 'lavalake', 'devil', 'bluesunset', 'storm', 'atoll', 'herzwelt'], force: {} };
  if (VR.BodyLife && VR.BodyLife.PAGES) for (const p of B2.PAGES) if (!VR.BodyLife.PAGES.includes(p)) VR.BodyLife.PAGES.push(p);

  // ---------------------------------------------------------------- Zinnober's plumes (pure: node tests them)
  // the eruption of a vent at t: {top (m over the vent), k (strength), firing}; the canopy rises as the first gas
  // climbs (v0²/2g), stands while the vent fires, fades as the last grains fall back
  B2.plume = function (vent, t, prof, gReal) {
    const P = prof.plume, per = P.every[0] + (P.every[1] - P.every[0]) * hash(vent.seed, 1);
    // u-moons3: a steady vent (bgen 2's first, in the landing's view — Io's great plumes stand for months) breathes
    // between 0.93 and 1 of its height over minutes, never quiet
    if (vent.steady) { const H = P.height[0] + (P.height[1] - P.height[0]) * hash(vent.seed, 3); return { top: H * (0.965 + 0.035 * Math.sin(t / 97 + vent.seed % 7)), k: 1, firing: true, H, up: 0 }; }
    let k = Math.floor(t / per), start = k * per + 0.25 * per * hash(vent.seed, k + 7);
    if (t < start) { k--; start = k * per + 0.25 * per * hash(vent.seed, k + 7); }
    const dur = P.dur[0] + (P.dur[1] - P.dur[0]) * hash(vent.seed, k + 911), H = P.height[0] + (P.height[1] - P.height[0]) * hash(vent.seed, k + 3);
    const v0 = Math.sqrt(2 * gReal * H), up = v0 / gReal, tau = t - start;
    if (tau < 0 || tau > dur + up) return { top: 0, k: 0, firing: false, H, up };
    const rise = Math.min(1, tau / up), top = H * (1 - (1 - rise) * (1 - rise));
    const kk = Math.min(1, tau / 8) * (tau < dur ? 1 : 1 - (tau - dur) / up);
    return { top, k: Math.max(0, kk), firing: tau < dur, H, up };
  };
  // ---------------------------------------------------------------- Ocker's weather (pure)
  // per 25-min slot: a storm with the chance ½ — its front 2 min, the peak 4 min at τ 4.5, the clearing 3 min; → {tau, front}
  B2.storm = function (t, prof) {
    const S = prof.storm, slot = Math.floor(t / 1500), s0 = slot * 1500;
    if (B2.force.storm !== undefined) return { tau: S.tauClear + (S.tauStorm - S.tauClear) * B2.force.storm, front: B2.force.front || 0 };
    if (hash(slot, 4711) > 0.5) return { tau: S.tauClear + 0.25 * hash(slot, 9), front: 0 };
    const a = s0 + 200 + 700 * hash(slot, 17), tt = t - a;
    if (tt < 0 || tt > 540) return { tau: S.tauClear, front: 0 };
    const k = tt < 120 ? ss(0, 120, tt) : tt < 360 ? 1 : 1 - ss(360, 540, tt);
    return { tau: S.tauClear + (S.tauStorm - S.tauClear) * k, front: tt < 150 ? Math.sin(Math.PI * tt / 150) : 0 };
  };
  // the dust devils alive at t round a point: one born every ~60 s (the slot's hash moves the moment), each 90–150 s,
  // born 300–1,200 m from (cx, cz) (the player's place when the slot began) → [{x, z, top, k, w}]
  B2.devils = function (t, cx, cz, prof, out) {
    out = out || []; out.length = 0;
    const E = prof.devils.every;
    for (let slot = Math.floor(t / E) - 2; slot <= Math.floor(t / E); slot++) {
      const born = slot * E + 0.6 * E * hash(slot, 3), life = 90 + 60 * hash(slot, 5), age = t - born;
      if (age < 0 || age > life) continue;
      const a = hash(slot, 7) * TAU, r = 300 + 900 * hash(slot, 11), wa = 0.35 + (hash(slot, 13) - 0.5) * 0.8, sp = 2 + 5 * hash(slot, 19);
      const bx = Math.round(cx / 400) * 400, bz = Math.round(cz / 400) * 400;
      out.push({ x: bx + Math.cos(a) * r + Math.cos(wa) * sp * age, z: bz + Math.sin(a) * r + Math.sin(wa) * sp * age,
        top: prof.devils.h[0] + (prof.devils.h[1] - prof.devils.h[0]) * hash(slot, 23), k: ss(0, 12, age) * (1 - ss(life - 15, life, age)), slot });
    }
    return out;
  };

  // ---------------------------------------------------------------- the frame (bodylife.js calls it)
  const S = B2.state = { devils: [], tau: 0.6, front: 0, drift: 0 };
  B2.update = function (g, dt, eye, E, id, t, plumes, tier, lit) {
    const BL = VR.BodyLife, BS = VR.BodySky, P = g.particles, p = g.player, w = g.world, prof = VR.Bodies.profile(id);
    const unlock = (k) => { if (g.codex) g.codex.unlock(k); };
    const big = tier === 0 ? 3 : 1;
    if (id !== 'zinn' && BS && BS.lake) BS.lake = null;   // (u-moons3: the Glutsee's far glow on Zinnober only)
    if (id !== 'ocker' && BS && BS.dustTau !== 0.6) { BS.dustTau = 0.6; BS.front = 0; S.tau = 0.6; S.front = 0; }   // (Ocker's weather stays on Ocker)
    if (id === 'zinn') {
      const gen = BL.gen(g, 'zinn'), near = [];
      for (const v of gen.vents()) {
        const d = Math.hypot(v.x - p.pos[0], v.z - p.pos[2]); if (d > 20000) continue;
        const pl = B2.plume(v, t, prof, prof.g); if (pl.top <= 1) continue;
        near.push({ v, d, pl });
        if (pl.firing && d < 9000) unlock('moon:plume');
      }
      near.sort((a, b) => a.d - b.d);
      for (const n of near.slice(0, 4)) plumes.push({ x: n.v.x, y: n.v.y + 1, z: n.v.z, top: n.pl.top, k: n.pl.k });
      // the Glutsee: spatter over the open melt; its glow by night is the codex's page
      const G = gen.glut, dG = Math.hypot(G.x - p.pos[0], G.z - p.pos[2]);
      // u-moons3: the Glutsee for the sky's far ground (bodysky.js → bsLake): its melt glows where the world's columns
      // end — Very Low's 64 m see only its near shore
      if (BS && (!BS.lake || BS.lake.g !== gen)) BS.lake = { g: gen, x: G.x, z: G.z, y: gen.heightAt(Math.floor(G.x), Math.floor(G.z)) + 1, R: G.R * 0.84 };
      if (dG < G.R + 40 && BS && BS.cur && BS.cur.light.lightK < 0.3) unlock('moon:lavalake');
      if (P && dG < G.R + 300) {
        const n = Math.floor((tier === 0 ? 3 : tier === 1 ? 7 : 12) * dt * 6 + Math.random());
        for (let k = 0; k < n; k++) {
          const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * G.R * 0.75, x = G.x + Math.cos(a) * r, z = G.z + Math.sin(a) * r;
          const y = w.isLoaded(Math.floor(x), Math.floor(z)) ? w.topAt(Math.floor(x), Math.floor(z)) + 1 : 42;
          const v = 3 + Math.random() * 6, grav = VR.DimReg.gravity(g.dim);
          P.spawn(x, y, z, (Math.random() - 0.5) * 1.5, v, (Math.random() - 0.5) * 1.5, { life: 2 * v / grav, size: (0.12 + Math.random() * 0.2) * big, grav, drag: 0.0001, col: [3.2, 1.1, 0.25], emis: 2.5, force: true, collide: false, fade: true });
        }
      }
    } else if (id === 'ocker') {
      // the weather → the air's τ (atmo_lut.js via bodysky.js), the front's wall (the fog)
      const st = B2.storm(t, prof);
      S.tau += (st.tau - S.tau) * Math.min(1, dt * 0.5); S.front += (st.front - S.front) * Math.min(1, dt * 0.8);
      if (BS) { BS.dustTau = S.tau; BS.front = S.front; }
      if (S.tau > 3) unlock('moon:storm');
      const L = BS && BS.cur ? BS.cur.light : null;
      if (L && L.sunEl > -0.02 && L.sunEl < 0.07 && S.tau < 2) unlock('moon:bluesunset');
      // the devils
      if (!S.base || (Math.floor(t / 60) !== S.slot)) { S.slot = Math.floor(t / 60); S.base = [p.pos[0], p.pos[2]]; }
      const dv = B2.devils(t, S.base[0], S.base[1], prof, S.devils);
      if (B2.force.devil) { const f = B2.force.devil; dv.push({ x: f.x, z: f.z, top: f.top || 600, k: 1, slot: -1 }); }
      dv.sort((a, b) => Math.hypot(a.x - p.pos[0], a.z - p.pos[2]) - Math.hypot(b.x - p.pos[0], b.z - p.pos[2]));
      for (const d of dv.slice(0, 4)) {
        const dd = Math.hypot(d.x - p.pos[0], d.z - p.pos[2]);
        const y = w.isLoaded(Math.floor(d.x), Math.floor(d.z)) ? w.topAt(Math.floor(d.x), Math.floor(d.z)) + 1 : prof.level;
        // (u-moons3: from the Rostschlucht's floor a devil on the plain 140 m up stands behind the wall — beyond the drawn
        // land nothing hides it, so it is not drawn: no column floating over the canyon)
        if (y - p.pos[1] > 30 && dd > ((w.renderDist | 0) || 8) * 16) continue;
        plumes.push({ x: d.x, y, z: d.z, top: d.top, k: d.k * (1 - 0.6 * Math.min(1, (S.tau - 0.6) / 3)) });
        if (dd < 1500 && d.k > 0.5) unlock('moon:devil');
        // grains round its foot
        if (P && dd < 90) {
          const n = Math.floor((tier === 0 ? 4 : 14) * dt * 4 + Math.random()), col = lit([0.5, 0.32, 0.2]);
          for (let k = 0; k < n; k++) { const a = Math.random() * TAU, r = 4 + Math.random() * 12; P.spawn(d.x + Math.cos(a) * r, y + Math.random() * 6, d.z + Math.sin(a) * r, -Math.sin(a) * 9, 2 + Math.random() * 4, Math.cos(a) * 9, { life: 2.5, size: (0.15 + Math.random() * 0.25) * big, grav: 0.3, drag: 0.02, col, emis: 0.001, force: true, collide: false, fade: true }); }
        }
      }
      // the storm's streaks past the eye
      if (P && S.front + Math.max(0, S.tau - 1.5) / 3 > 0.2) {
        const n = Math.floor((tier === 0 ? 6 : 24) * dt * 4 * Math.min(1.5, S.front + S.tau / 4.5) + Math.random()), col = lit([0.55, 0.36, 0.22]);
        for (let k = 0; k < n; k++) P.spawn(p.pos[0] - 22 + Math.random() * 6, p.pos[1] - 1 + Math.random() * 5, p.pos[2] + (Math.random() - 0.5) * 30, 12 + Math.random() * 6, (Math.random() - 0.5), (Math.random() - 0.5) * 2, { life: 3.2, size: (0.025 + Math.random() * 0.04) * big, grav: 0, drag: 0.001, col, emis: 0.001, force: true, collide: false, fade: true });
      }
    } else if (id === 'aqua') {
      if ((S.hzT = (S.hzT || 0) + dt) > 4) unlock('moon:herzwelt');
      const b = VR.BIOMES[w.biomeAt(Math.floor(p.pos[0]), Math.floor(p.pos[2]))];
      if (b && b.key === 'aqua_atoll') unlock('moon:atoll');
      // the drifters at night over the water near you (peaceful, our own: soft blue-green lights that rise and sink)
      const L = BS && BS.cur ? BS.cur.light : null;
      if (P && L && L.lightK < 0.25) {
        const n = Math.floor((tier === 0 ? 1 : 4) * dt * 3 + Math.random() * 0.6);
        for (let k = 0; k < n; k++) {
          const a = Math.random() * TAU, r = 8 + Math.random() * 50, x = p.pos[0] + Math.cos(a) * r, z = p.pos[2] + Math.sin(a) * r;
          if (w.isLoaded(Math.floor(x), Math.floor(z)) && w.topAt(Math.floor(x), Math.floor(z)) <= 63) P.spawn(x, 62.6 + Math.random() * 0.5, z, (Math.random() - 0.5) * 0.3, 0.05 + Math.random() * 0.1, (Math.random() - 0.5) * 0.3, { life: 6 + Math.random() * 6, size: (0.18 + Math.random() * 0.2) * big, grav: 0, drag: 0.01, col: [0.25, 1.4, 1.2], emis: 1.6, force: true, collide: false, fade: true });
        }
      }
    }
  };
})(VR);
