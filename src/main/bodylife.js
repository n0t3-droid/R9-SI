// ============================================================================
// u-moons1 · VR.BodyLife — what happens on Basalt and Opal (docs/superpowers/plans/2026-10-22-u-moons1.md §2.4; U§4.3,
// §6.3; R§5.6). game.js calls update(g, dt, eye, E) once a frame (one line); off the moons it returns at once.
//   · the geysers (Opal): every vent of the tiger stripes (gen_body.js vents()) erupts every 40–90 s for 10–18 s — the
//     same moments for the host and the guests (the world clock and the vent's own seed). The ice leaves at up to ~85 m/s
//     and climbs for most of a minute under Opal's 1.5 m/s² to 2–3 km before it falls back, so a plume stands long after
//     its vent went quiet: the sky draws the four nearest as columns (bodysky.js BS.plumes); within 260 m particles — the
//     column's foot and the glittering fall-back (Very Low: a third of them, larger); the ground trembles within 120 m
//   · low gravity felt: dust from every landing and from sprinting steps — regolith grey or ice glitter — flying in vacuum
//     arcs (no drag) under the world's own gravity, so on Opal it hangs for seconds (player.js counts the fall damage by g)
//   · Basalt: an impact flash every ~3 min (a stated compression: the real Moon sees one a few hours at a camera's
//     threshold) 150–400 m off: a white flash and a slow spray of ejecta; Amarant rising over the horizon noticed
//   · the suit's own sound (klang.js SUIT): no air, so no ambience (ambience.js) and the world's sounds only from within
//     a few metres, muffled (audio.js: BodyLife.vacuum) — the breath, faster after a sprint or a big jump, and the fan
//   · the codex's pages „Monde" (codex.js): the two moons, the Amarant-rise, a complex crater, an impact, a geyser, the
//     eclipse, a 20-m jump — found by being there; a first arrival says the world's gravity in one line
// ============================================================================
(function (VR) {
  'use strict';
  const BL = VR.BodyLife = { vacuum: false, PAGES: ['basalt', 'opal', 'amarantrise', 'crater', 'impact', 'geyser', 'eclipse', 'jump'] };
  const TAU = Math.PI * 2;
  const hash = (a, b) => { let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0) / 4294967296; };
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));

  // ---------------------------------------------------------------- the geysers (pure: node tests them)
  // a vent's schedule: its period (40–90 s), the start of cycle k (jittered by up to a fifth of the period), the eruption's
  // length (10–18 s) → the eruption under way at t, or the last one: {k, start, dur}
  BL.cycle = function (vent, t, prof) {
    const G = prof.geyser, P = G.every[0] + (G.every[1] - G.every[0]) * hash(vent.seed, 1);
    const k = Math.floor(t / P), start = k * P + 0.2 * P * hash(vent.seed, k + 7), dur = G.dur[0] + (G.dur[1] - G.dur[0]) * hash(vent.seed, k + 911);
    if (t < start) { const k2 = k - 1; return { k: k2, start: k2 * P + 0.2 * P * hash(vent.seed, k2 + 7), dur: G.dur[0] + (G.dur[1] - G.dur[0]) * hash(vent.seed, k2 + 911), P }; }
    return { k, start, dur, P };
  };
  // the plume of one eruption τ seconds after it began: the ice leaves at v0 (its top reaches H = v0²/2g), the last of it
  // when the vent stops; → {top, bottom, k (its strength), firing} — the column between the first ice and the last
  BL.plume = function (vent, t, prof, g) {
    const c = BL.cycle(vent, t, prof), tau = t - c.start;
    const G = prof.geyser, H = G.height[0] + (G.height[1] - G.height[0]) * hash(vent.seed, c.k + 3), v0 = Math.sqrt(2 * g * H), up = v0 / g;
    if (tau < 0 || tau > c.dur + 2 * up) return { top: 0, bottom: 0, k: 0, firing: false, H, v0 };
    const y = (s) => (s <= 0 ? 0 : s >= 2 * up ? 0 : v0 * s - 0.5 * g * s * s);
    // the column's top: the highest of the ice launched between 0 and min(τ, dur) (the earliest until it turns, then the
    // one just at its apex); its foot: the last ice's height once the vent is quiet
    const s0 = Math.max(0, tau - Math.min(tau, c.dur));
    const top = s0 <= up && up <= tau ? H : Math.max(y(tau), y(s0));
    const bottom = tau > c.dur ? Math.min(y(tau - c.dur), top) : 0;
    const k = (tau < c.dur ? 1 : Math.max(0, 1 - (tau - c.dur) / (2 * up))) * Math.min(1, tau / 2);
    return { top, bottom, k, firing: tau >= 0 && tau < c.dur, H, v0 };
  };
  // the body's generator on the main thread (the vents, a crater under the player) — the save's bgen
  BL.gen = function (g, id) {
    const seed = g.meta ? g.meta.seed >>> 0 : 0, bg = VR.Bodies.bgenOf(g.meta || {})[id], key = id + ':' + seed + ':' + bg;
    if (BL._gk !== key) { BL._gk = key; BL._g = new VR.BodyGen(seed, id, { bgen: { [id]: bg } }); }
    return BL._g;
  };

  // ---------------------------------------------------------------- the frame
  const S = BL.state = { id: null, t: 0, landY: null, wasGround: true, peak: 0, takeoff: 0, sprintT: 0, exert: 0, impactSlot: -1, parUp: null, near: [], shake: 0, flash: 0, said: {} };
  BL.update = function (g, dt, eye, E) {
    const D = VR.DimReg && VR.DimReg.get(g.dim), id = D && D.body;
    if (!id || !g.player || !g.world) {
      if (BL.vacuum) { BL.vacuum = false; suitOff(g); }
      BL.thin = false;   // u-moons2
      if (VR.BodySky && VR.BodySky.plumes.length) VR.BodySky.plumes = [];
      S.id = null;
      return;
    }
    const p = g.player, w = g.world, prof = VR.Bodies.profile(id), grav = (VR.DimReg.walkGravity || VR.DimReg.gravity)(g.dim);
    const real = VR.DimReg.realGrav !== false;   // u-worlds: no suit, no muffled vacuum unless ⚙ „Echte Schwerkraft der Welten"
    const vac = real && (!prof.air || id === 'ocker'); if (BL.vacuum && !vac) suitOff(g); BL.vacuum = vac; BL.thin = real && id === 'ocker';   // u-moons2: Aquamarin's air carries sound; Ocker's 6 mbar barely
    const t = VR.Universe.worldSeconds(g.env.day | 0, g.env.ticks);
    if (S.id !== id) {   // arrived
      S.id = id; S.landY = null; S.wasGround = true; S.impactSlot = Math.floor(t / 180); S.parUp = null;
      unlock(g, 'moon:' + id);
      if (!S.said[id] && g.ui) { S.said[id] = true; if (VR.EventLog && VR.EventLog.emit) VR.EventLog.emit('space', 'moon_land', 4, null, 'moon');   /* e-cam: a highlight (the reel's postcard) */ g.ui.toast(T('g.moon.hello', { name: T('g.dim.' + id, null, prof.name.de) }), T('g.moon.hello.' + id)); }
    }
    const BS = VR.BodySky;
    // the sky's eye and the ground under it (the horizon's dip)
    if (BS) { BS.eye[0] = eye[0]; BS.eye[1] = eye[1]; BS.eye[2] = eye[2]; BS.groundY = w.isLoaded(Math.floor(p.pos[0]), Math.floor(p.pos[2])) ? w.topAt(Math.floor(p.pos[0]), Math.floor(p.pos[2])) + 1 : null; }
    const tier = (g.settings && Number.isFinite(g.settings.particles)) ? g.settings.particles | 0 : 2;
    const lightK = BS && BS.cur ? BS.cur.light.lightK : 1, amb = E && E.ambSky ? E.ambSky : [0.1, 0.1, 0.1];
    // (u-moons2: with air, Helia's light as it reaches the ground — through a storm it is a glimmer)
    const sc = prof.air && E && E.sunColor && lightK > 0 ? E.sunColor : [2.8 * lightK, 2.85 * lightK, 3.0 * lightK];
    const lit = (alb) => [alb[0] * (sc[0] * 0.75 + amb[0] * 1.5 + 0.02), alb[1] * (sc[1] * 0.75 + amb[1] * 1.5 + 0.02), alb[2] * (sc[2] * 0.75 + amb[2] * 1.5 + 0.025)];
    // ---- the landing's dust and the sprint's puffs, in vacuum arcs
    const P = g.particles;
    const dustCol = () => {
      if (id === 'opal') return [0.85, 0.9, 0.98];
      if (id === 'zinn' || id === 'ocker' || id === 'aqua') return id === 'zinn' ? [0.6, 0.52, 0.28] : id === 'ocker' ? [0.42, 0.26, 0.15] : [0.62, 0.58, 0.48];   // u-moons2
      const b = VR.BIOMES[w.biomeAt(Math.floor(p.pos[0]), Math.floor(p.pos[2]))];
      return b && b.key === 'basalt_mare' ? [0.075, 0.073, 0.07] : [0.26, 0.25, 0.235];
    };
    const puff = (n, spd, up, size) => {
      if (!P) return;
      const col = lit(dustCol()), big = tier === 0 ? 3 : 1, m = Math.max(1, Math.round(n / big));
      for (let k = 0; k < m; k++) {
        const a = Math.random() * TAU, s = spd * (0.4 + Math.random() * 0.8);
        P.spawn(p.pos[0] + Math.cos(a) * 0.3, p.pos[1] + 0.05, p.pos[2] + Math.sin(a) * 0.3, Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s,
          { life: 1.2 + 2.4 * Math.sqrt(30 / Math.max(1, grav)) * (0.5 + Math.random() * 0.5), size: size * big * (0.7 + Math.random() * 0.6), grav, drag: 0.0001, col, emis: 0.001, force: true, fade: true });
      }
    };
    if (p.onGround && !S.wasGround && !p.flying) {
      const fall = (S.peak || p.pos[1]) - p.pos[1];
      if (fall > 0.6 || Math.abs(p.lastVy || 0) > 2) puff(Math.min(40, 10 + fall * 2), 1.2 + Math.min(3, fall * 0.12), 1.0 + Math.min(2.5, fall * 0.1), 0.07);
      // a big jump on Opal (20 m and more over the take-off) is a page of the codex
      if (id === 'opal' && S.peak - S.takeoff >= 20) unlock(g, 'moon:jump');
      if (S.peak - S.takeoff > 5) S.exert = Math.min(1, S.exert + 0.35);
    }
    if (!p.onGround && S.wasGround) { S.takeoff = p.pos[1]; S.peak = p.pos[1]; }
    if (!p.onGround) S.peak = Math.max(S.peak, p.pos[1]);
    S.wasGround = p.onGround;
    if (p.onGround && p.sprinting && Math.hypot(p.vel[0], p.vel[2]) > 3) { S.sprintT -= dt; S.exert = Math.min(1, S.exert + dt * 0.04); if (S.sprintT <= 0) { S.sprintT = 0.38; puff(5, 0.8, 0.6, 0.05); } }
    S.exert = Math.max(0, S.exert - dt / VR.Klang.SUIT.calm);
    // ---- the geysers (Opal)
    const plumes = [];
    S.shake = Math.max(0, S.shake - dt);
    if (id === 'opal') {
      const gen = BL.gen(g, 'opal'), vents = gen.vents();
      const near = [];
      for (const v of vents) {
        const dx = v.x - p.pos[0], dz = v.z - p.pos[2], d = Math.hypot(dx, dz);
        if (d > 6000) continue;
        const pl = BL.plume(v, t, prof, grav);
        if (pl.top <= 1) continue;
        near.push({ v, d, pl });
      }
      near.sort((a, b) => a.d - b.d);
      for (const n of near.slice(0, 4)) plumes.push({ x: n.v.x, y: n.v.y + 1, z: n.v.z, top: n.pl.top, bottom: n.pl.bottom, k: n.pl.k });
      for (const n of near) {
        if (n.d > 260) break;
        if (n.pl.firing && n.d < 300) unlock(g, 'moon:geyser');
        if (n.pl.firing && n.d < 120) S.shake = Math.max(S.shake, 0.3 * (1 - n.d / 120));
        if (!P) continue;
        // the column's foot: grains leaving the vent (a cone of ±7°), and the fall-back glittering round it
        const rate = (tier === 0 ? 10 : tier === 1 ? 22 : 34) * n.pl.k * (n.pl.firing ? 1 : 0.25);
        const cnt = Math.floor(rate * dt + Math.random()), big = tier === 0 ? 3 : 1, colIce = lit([0.9, 0.95, 1.0]);
        for (let k = 0; k < cnt; k++) {
          const a = Math.random() * TAU, sp = 0.12 * Math.random(), v0 = n.pl.v0 * (0.25 + 0.55 * Math.random());
          if (n.pl.firing) P.spawn(n.v.x + (Math.random() - 0.5) * 1.6, n.v.y + 1, n.v.z + (Math.random() - 0.5) * 1.6, Math.cos(a) * sp * v0, v0, Math.sin(a) * sp * v0,
            { life: Math.min(30, 2 * v0 / grav), size: (0.18 + Math.random() * 0.25) * big, grav, drag: 0.0001, col: colIce, emis: 0.05, force: true, collide: false, fade: true });
          const r = 10 + Math.random() * 60, b = Math.random() * TAU;
          P.spawn(n.v.x + Math.cos(b) * r, n.v.y + 30 + Math.random() * 60, n.v.z + Math.sin(b) * r, (Math.random() - 0.5) * 0.6, -1 - Math.random() * 2, (Math.random() - 0.5) * 0.6,
            { life: 14 + Math.random() * 10, size: (0.06 + Math.random() * 0.08) * big, grav: grav * 0.15, drag: 0.0001, col: colIce, emis: 0.2, force: true, fade: true });
        }
      }
      if (BS && BS.cur && BS.cur.light.eclipse > 0.5) unlock(g, 'moon:eclipse');
    }
    if (VR.BodyLife2) VR.BodyLife2.update(g, dt, eye, E, id, t, plumes, tier, lit);   // u-moons2: Zinnober's plumes, Ocker's devils and storms, Aquamarin's nights
    if (BS) BS.plumes = plumes;
    // the ground's tremble near a firing vent: a small dip of the eye now and then (presence.js's landing dip)
    if (S.shake > 0 && Math.random() < dt * 6 && !(VR.A11y && VR.A11y.less(g.settings))) { p.dipAmp = Math.max(p.dipAmp || 0, 0.02 * S.shake); p.dipT = 0; }
    // ---- Basalt: the impact flashes and Amarant rising
    if (id === 'basalt') {
      const slot = Math.floor(t / 180);
      if (slot !== S.impactSlot) {
        S.impactSlot = slot;
        const seed = (g.meta ? g.meta.seed : 0) ^ slot * 2654435761;
        const a = hash(seed, 1) * TAU, r = 150 + 250 * hash(seed, 2);
        const x = p.pos[0] + Math.cos(a) * r, z = p.pos[2] + Math.sin(a) * r;
        if (w.isLoaded(Math.floor(x), Math.floor(z))) impact(g, x, w.topAt(Math.floor(x), Math.floor(z)) + 1, z, grav, tier, lit);
      }
      const L = BS && BS.cur ? BS.cur.light : null;
      if (L) {
        const up = L.parEl > -L.dip + 0.02;
        if (S.parUp === false && up) unlock(g, 'moon:amarantrise');
        S.parUp = up;
      }
      // standing in a complex crater (by its real-equivalent size: central peak, terraces)
      if ((S.craterT = (S.craterT || 0) - dt) <= 0) {
        S.craterT = 2;
        const c = BL.gen(g, 'basalt').craterAt(p.pos[0], p.pos[2]);
        if (c && c.kind !== 'simple') unlock(g, 'moon:crater');
      }
    }
    // ---- the suit's sound
    suit(g, dt);
  };
  function unlock(g, key) { if (g.codex) g.codex.unlock(key); }
  // an impact: the white flash and the ejecta flying out in slow arcs; heard only as a faint thud through the ground nearby
  function impact(g, x, y, z, grav, tier, lit) {
    const P = g.particles; if (!P) return;
    if (!VR.A11y || VR.A11y.flash('impact')) P.spawn(x, y + 0.5, z, 0, 0, 0, { life: 0.35, size: 6, grav: 0, drag: 0.0001, col: [6, 6, 5.5], emis: 2, force: true, collide: false, fade: true });
    P.spawn(x, y + 0.5, z, 0, 0, 0, { life: 0.9, size: 14, grav: 0, drag: 0.0001, col: [1.5, 1.4, 1.2], emis: 1, force: true, collide: false, fade: true });
    const n = tier === 0 ? 30 : tier === 1 ? 60 : 110, big = tier === 0 ? 2.5 : 1, col = lit([0.22, 0.21, 0.2]);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * TAU, el = (25 + 40 * Math.random()) * Math.PI / 180, s = 6 + 16 * Math.random();
      P.spawn(x, y + 0.3, z, Math.cos(a) * Math.cos(el) * s, Math.sin(el) * s, Math.sin(a) * Math.cos(el) * s,
        { life: 2 * s * Math.sin(el) / grav + 0.5, size: (0.15 + Math.random() * 0.3) * big, grav, drag: 0.0001, col, emis: 0.001, force: true, fade: true });
    }
    unlock(g, 'moon:impact');
  }
  // the suit: a breathy swell on a loop of noise through a band (the ambient bus), and the fan's hum — built on the first
  // moon frame, faded out off the moons
  function suit(g, dt) {
    const a = g.audio, K = VR.Klang && VR.Klang.SUIT;
    if (!a || !a.ctx || !a.noise || !K) return;
    const c = a.ctx, now = c.currentTime;
    if (!BL.su) {
      const bus = a.amb || a.master;
      const src = c.createBufferSource(); src.buffer = a.noise; src.loop = true;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = K.breath.f; bp.Q.value = K.breath.q;
      const bg = c.createGain(); bg.gain.value = 0;
      src.connect(bp); bp.connect(bg); bg.connect(bus); src.start();
      const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = K.hum.f;
      const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = K.hum.f2;
      const hg = c.createGain(); hg.gain.value = 0;
      const g1 = c.createGain(); g1.gain.value = K.hum.g; const g2 = c.createGain(); g2.gain.value = K.hum.g2;
      o1.connect(g1); o2.connect(g2); g1.connect(hg); g2.connect(hg);
      const src2 = c.createBufferSource(); src2.buffer = a.noise; src2.loop = true; src2.playbackRate.value = 0.7;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = K.hum.air;
      const ag = c.createGain(); ag.gain.value = K.hum.airG;
      src2.connect(lp); lp.connect(ag); ag.connect(hg);
      hg.connect(bus); o1.start(); o2.start(); src2.start();
      BL.su = { bg, hg, next: now + 0.6, srcs: [src, o1, o2, src2] };
    }
    const su = BL.su;
    if (!BL.vacuum) return;
    su.hg.gain.setTargetAtTime(1, now, 0.8);
    if (now >= su.next) {
      const B = K.breath, ex = BL.state.exert, every = VR.Klang.breathEvery(ex), d = B.dur * (1 - 0.3 * ex), gIn = B.g * (1 + 0.6 * ex);
      // in (a rise) and out (a softer, longer fall), a breath every few seconds
      su.bg.gain.cancelScheduledValues(now);
      su.bg.gain.setValueAtTime(su.bg.gain.value, now);
      su.bg.gain.linearRampToValueAtTime(gIn, now + d * 0.38);
      su.bg.gain.linearRampToValueAtTime(B.gOut * (1 + 0.5 * ex), now + d * 0.55);
      su.bg.gain.linearRampToValueAtTime(0.0001, now + d);
      su.next = now + every * (0.92 + Math.random() * 0.16);
    }
  }
  // (faded out, then the sources stopped: at home nothing of the suit keeps running; the next arrival builds it anew)
  function suitOff(g) {
    const su = BL.su, a = g && g.audio; if (!su || !a || !a.ctx) return;
    const now = a.ctx.currentTime;
    su.hg.gain.setTargetAtTime(0, now, 0.4); su.bg.gain.cancelScheduledValues(now); su.bg.gain.setTargetAtTime(0, now, 0.2);
    for (const n of su.srcs) { try { n.stop(now + 2); } catch (e) { /* already stopped */ } }
    BL.su = null;
  }
})(VR);
