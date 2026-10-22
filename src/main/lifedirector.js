// ============================================================================
// The Regisseur des Lebens (t-life, docs/superpowers/plans/2026-10-09-t-life.md §3.3–3.4). The owner: "ich mag es
// vibrant, immer etwas los — denk dir noch mehr coole Sachen aus". Every 20–40 s something happens within sight: one act
// chosen for the place and the hour from seventeen — birds across the sun, the lantern lighter at dusk, chimney smoke, a
// ship's low pass with its contrail, the sunrise convoy, a cat on a wall, pigeons bursting up, a hover-cart along the
// street, a meteor at night, a hot-air balloon over the hills, the noon bells, a firework salvo on festival evenings, kids
// with a ball, a street musician with a short pentatonic tune, a dog at the fountain's splash, a sky ray over the isles, a
// fisherman's catch.
//   The slots: event k at t_k = 30·k + j(seed, k), j ∈ [−5, 5] s → 20–40 s apart, on the world's clock (the trams': the
//   world time at the start, then real seconds). The choice is pure — LD.pick(seed, k, ctx): the acts the place, the hour,
//   the weather, a festival and the tier allow; an even slot takes its hashed pick, an odd slot avoids the picks of both
//   neighbours, so the same act never comes twice in a row (when only one fits, the odd slot stays quiet). Every guest
//   at the same place and hour sees the same act (its anchors come from the place: the lamps, the chimneys, the fountain).
//   The hours (§3.4): dawn the convoy · morning carts, pigeons, the balloon · noon the bells · afternoon kids, the musician,
//   the dog · dusk the lantern lighter, chimneys, music · night meteors, a lit low pass (and the pads' landing lights,
//   padlife.js; the fireflies, airlife.js; the festival, festival.js).
//   Cost tiers: 0 Very Low — birds, lanterns (the lamps light, no figure), chimneys; 1 Low + the passes, the convoy, the
//   cat, pigeons, the cart, meteors, the balloon, bells, fireworks and the lamplighter himself; 2 Balanced + kids, the
//   musician, the dog, the sky ray, the fisher (and meteor showers). Switch: settings.lifeDir (⚙ Bild · Dinge & Effekte;
//   padLife for the ships). Presentation only: nothing here is a block, nothing is saved, nothing collides.
//   LD.hourOf, LD.placeOf, LD.ACTS, LD.allowed, LD.candidates, LD.slotTime, LD.slotAt, LD.pick: pure (test/life_director.js).
//   f-flow (R50-03, docs/superpowers/plans/2026-10-23-f-flow.md §2.3; test/flow.js): the Regisseur rotates and paces. The
//   fly-bys are one family (LD.FLY: the low pass, the new close pass 'flyby' — the sky traffic's horizon flights pass
//   far while the director is on, traffic.js calm() — and the convoy). An act may start when the same act did not start
//   within 60 s (t-wild's sightings 300 s) and a fly-by when no fly-by started within 60 s and they stay ≤ ⅓ of the last
//   12 acts (LD.okNow); among the allowed the slot's own pick comes first, then the least recently played (LD.order). No
//   act starts within 15 s of the last start or of the last weighted event seen (EventLog.sinceSeen), during a wow
//   moment, or while a fly-by's pass is still to come: a slot waits up to 15 s. When nothing has started and nothing was
//   seen for 20 s, the director plays the next thing worth seeing now (the rotation's next act, or t-wild's heron, rays
//   or murmuration in view: 'heron' sends a standing heron up, 'rays' and 'murm' let the spectacle be the moment). The
//   acts are staged in the view (the passes in front, the balloon at 45–80 m). D.forecast(k): the act a coming slot will
//   play (Funke's "Nächster Wow").
// ============================================================================
(function (VR) {
  'use strict';
  const LD = VR.LifeDirector = VR.LifeDirector || {};
  const LK = VR.LifeKit, TAU = Math.PI * 2;
  const h = (a, b, c) => LK.h(a, b, c);
  const sm = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  // the switches (this file loads after the settings registry): padLife (padlife.js, hangarflight.js), lifeDir (here)
  if (VR.Settings && VR.Settings.add) {
    VR.Settings.add({ key: 'padLife', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.padLife', tip: 'g.set.padLife.tip', cost: 'low', def: true });
    VR.Settings.add({ key: 'lifeDir', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.lifeDir', tip: 'g.set.lifeDir.tip', cost: 'low', def: true });
  }

  // ---------------------------------------------------------------- the hours (ticks: 0 sunrise, 6000 noon, 12000 sunset)
  LD.HOURS = ['dawn', 'morning', 'noon', 'afternoon', 'dusk', 'night'];
  LD.hourOf = (tod) => { const t = ((tod % 24000) + 24000) % 24000; return t >= 22500 || t < 1500 ? 'dawn' : t < 5000 ? 'morning' : t < 7000 ? 'noon' : t < 11000 ? 'afternoon' : t < 13800 ? 'dusk' : 'night'; };

  // ---------------------------------------------------------------- the places
  // info: {heart (a Heartland world: the Gate Temple at the origin), villages: [{x, z, rad, style, plaza: {x, z, r}}],
  // water (water at the surface near the eye)} → hangar · plaza · street · hall · hills · isles · water · wild
  LD.PLACES = ['hangar', 'plaza', 'street', 'hall', 'hills', 'isles', 'water', 'wild'];
  LD.placeOf = function (pos, info) {
    const x = pos[0], z = pos[2];
    let best = null, bd = 1e9;
    for (const v of (info && info.villages) || []) { const d = Math.hypot(v.x - x, v.z - z); if (d < (v.rad || 70) && d < bd) { bd = d; best = v; } }
    if (best) {
      if (best.style === 'hall') return 'hall';
      const P = best.plaza; if (P && Math.hypot(P.x - x, P.z - z) < (P.r || 4) + 12) return 'plaza';
      return 'street';
    }
    if (info && info.heart) {
      if (x > -70 && x < 70 && z > -45 && z < 145) return 'hangar';
      if (Math.hypot(x - 330, z - 140) < 260) return 'isles';
      if (x > -280 && x < 280 && z > -430 && z < -205) return 'hills';
    }
    if (info && info.water) return 'water';
    return 'wild';
  };

  // ---------------------------------------------------------------- the acts: their rules and their cost tiers
  const OUT = ['hangar', 'plaza', 'street', 'hills', 'isles', 'water', 'wild'], TOWN = ['plaza', 'street', 'hall'];
  const DAY = ['morning', 'noon', 'afternoon'], SUN = ['morning', 'noon', 'afternoon', 'dusk'];
  // wx: 'dry' (no rain, or under the hall's vault), 'any'; need: a ctx.has flag; fest: a festival evening near
  LD.ACTS = {
    birds: { tier: 0, places: OUT, hours: SUN.concat(['dawn']), wx: 'dry', dur: 16 },   // (f-flow: and at dawn once the sun is up)
    lanterns: { tier: 0, places: ['plaza', 'street', 'hall', 'hangar'], hours: ['dusk'], wx: 'any', need: 'lamps', dur: 110 },
    chimneys: { tier: 0, places: ['plaza', 'street', 'hills', 'wild'], hours: ['dawn', 'morning', 'dusk', 'night'], wx: 'any', need: 'chimneys', dur: 32 },
    flyover: { tier: 1, places: OUT, hours: LD.HOURS, wx: 'dry', dur: 30 },
    convoy: { tier: 1, places: OUT, hours: ['dawn'], wx: 'any', dur: 40 },
    cat: { tier: 1, places: ['plaza', 'street', 'hills', 'hall'], hours: ['morning', 'noon', 'afternoon', 'dusk', 'night'], wx: 'dry', dur: 34 },
    pigeons: { tier: 1, places: ['plaza', 'street', 'hall', 'hangar'], hours: DAY, wx: 'dry', dur: 22 },
    cart: { tier: 1, places: ['street', 'plaza', 'hall', 'hangar'], hours: DAY, wx: 'any', dur: 24 },
    meteor: { tier: 1, places: OUT, hours: ['night', 'dawn'], wx: 'dry', dur: 9 },   // (f-flow: and at dawn while it is dark)
    balloon: { tier: 1, places: ['hills', 'wild', 'plaza', 'street', 'water', 'isles'], hours: DAY, wx: 'dry', dur: 80 },
    bells: { tier: 1, places: ['plaza', 'street', 'hall', 'hangar'], hours: ['noon'], wx: 'any', dur: 12 },
    fireworks: { tier: 1, places: TOWN, hours: ['dusk', 'night'], wx: 'any', fest: true, dur: 8 },
    kids: { tier: 2, places: TOWN, hours: DAY, wx: 'dry', dur: 34 },
    musician: { tier: 2, places: ['plaza', 'hall', 'street'], hours: ['afternoon', 'dusk', 'night'], wx: 'dry', dur: 28 },
    dog: { tier: 2, places: ['plaza', 'hall'], hours: DAY, wx: 'any', need: 'fountain', dur: 30 },
    skyray: { tier: 2, places: ['isles', 'hangar', 'wild', 'water'], hours: ['morning', 'noon', 'afternoon', 'dusk', 'night'], wx: 'dry', dur: 42 },
    fisher: { tier: 2, places: ['water'], hours: ['dawn', 'morning', 'noon', 'afternoon', 'dusk'], wx: 'any', need: 'water', dur: 32 },
    // ---- f-flow: the traffic's close pass, an act (tier 0: Very Low keeps its passes — the same flights, no cost of its
    // own); t-wild's animals near and in view, the director's to feature (again: the wait before the same act again, s)
    flyby: { tier: 0, places: OUT, hours: LD.HOURS, wx: 'dry', dur: 45 },
    heron: { tier: 2, places: OUT, hours: LD.HOURS, wx: 'dry', need: 'heron', dur: 14, again: 180 },
    rays: { tier: 2, places: OUT, hours: LD.HOURS, wx: 'dry', need: 'rays', dur: 30, again: 300 },
    murm: { tier: 2, places: OUT, hours: LD.HOURS, wx: 'dry', need: 'murm', dur: 30, again: 300 },
    // ---- f-flow end
  };
  LD.NAMES = Object.keys(LD.ACTS);
  // ctx: {place, hour, wet (rain or snow now; never under the hall's vault), fest, tier, has: {lamps, chimneys, fountain, water}}
  LD.allowed = function (name, ctx) {
    const A = LD.ACTS[name]; if (!A || !ctx) return false;
    if (A.tier > (ctx.tier === undefined ? 2 : ctx.tier)) return false;
    if (!A.places.includes(ctx.place) || !A.hours.includes(ctx.hour)) return false;
    if (A.wx === 'dry' && ctx.wet && ctx.place !== 'hall') return false;
    if (A.fest && !ctx.fest) return false;
    if (A.need && !(ctx.has && ctx.has[A.need])) return false;
    return true;
  };
  LD.candidates = (ctx) => LD.NAMES.filter(n => LD.allowed(n, ctx));
  // the slots: t_k = 30 k + j, j ∈ [−5, 5] (pure)
  LD.slotTime = (seed, k) => 30 * k + (h(seed, k, 0x51) - 0.5) * 10;
  LD.slotAt = function (seed, t) { let k = Math.floor(t / 30) + 1; while (LD.slotTime(seed, k) > t) k--; return k; };
  // t-polish · the cart is the streets' regular: by day in a town (a street, a plaza, a hall city) a hover-cart comes on
  // its own clock besides the acts — cart m at c_m = 34 m + j(seed, m), j ∈ [−3, 3] s → 28–40 s apart, so within 40 s of
  // arriving one comes (pure: every guest sees the same). It was one act in six of the slots: unseen for minutes.
  LD.CART_PLACES = ['street', 'plaza', 'hall'];
  LD.cartTime = (seed, m) => 34 * m + (h(seed, m, 0xca7) - 0.5) * 6;
  LD.cartAt = function (seed, t) { let m = Math.floor(t / 34) + 1; while (LD.cartTime(seed, m) > t) m--; return m; };
  LD.cartRegular = (ctx) => !!ctx && LD.CART_PLACES.includes(ctx.place) && LD.allowed('cart', ctx);
  // the act of slot k (null: quiet)
  LD.pick = function (seed, k, ctx) {
    const C = LD.candidates(ctx); if (!C.length) return null;
    const base = (kk) => C[Math.floor(h(seed, kk, 0xac7) * C.length)];
    if ((((k % 2) + 2) % 2) === 0) return base(k);
    const a = base(k - 1), b = base(k + 1), R = C.filter(c => c !== a && c !== b);
    return R.length ? R[Math.floor(h(seed, k, 0x7c1) * R.length)] : null;
  };

  // ---------------------------------------------------------------- f-flow: the rotation and the pacing (pure)
  // LD.FLY: the fly-bys, one family; LD.WILD: t-wild's animals the director features; LD.ROT: gap — the same act not again
  // within it (s; an act's own `again` overrides), the fly-bys not within it of each other; flyShare — the fly-bys at most
  // this share of the last `window` acts; pace — no act within it after a start or a weighted event seen; wait — how long
  // a slot waits for the pace; idle — after it without a start or a sight the director plays the next thing now
  LD.FLY = { flyover: 1, flyby: 1, convoy: 1 };
  LD.WILD = { heron: 1, rays: 1, murm: 1 };
  LD.ROT = { gap: 60, flyShare: 1 / 3, window: 12, pace: 15, wait: 15, idle: 20 };
  // may `kind` start at time t after the acts hist ([[t, kind], …], the oldest first)
  LD.okNow = function (kind, hist, t) {
    const A = LD.ACTS[kind]; if (!A) return false;
    const again = A.again || LD.ROT.gap, fly = !!LD.FLY[kind];
    let n = 0, flyN = 0;
    for (let i = hist.length - 1; i >= 0; i--) {
      const q = hist[i], dt = t - q[0];
      if (q[1] === kind && dt < again) return false;
      if (fly && LD.FLY[q[1]] && dt < LD.ROT.gap) return false;
      if (n < LD.ROT.window) { n++; if (LD.FLY[q[1]]) flyN++; }
    }
    return !fly || flyN + 1 <= (n + 1) * LD.ROT.flyShare + 1e-9;
  };
  const NAMEH = {};
  const nameH = (c) => NAMEH[c] || (NAMEH[c] = [...c].reduce((a, ch) => (Math.imul(a, 31) + ch.charCodeAt(0)) | 0, 7));
  // the candidates C in the order the rotation plays them at slot k, time t: the allowed ones — the slot's own pick
  // first, then the least recently played (never played first), ties by a hash of (seed, k, act)
  LD.order = function (seed, k, C, hist, t, first) {
    const last = (c) => { for (let i = hist.length - 1; i >= 0; i--) if (hist[i][1] === c) return hist[i][0]; return -Infinity; };
    const ok = C.filter(c => LD.okNow(c, hist, t)).map(c => ({ c, f: c === first ? 0 : 1, l: last(c), r: h(seed, k, nameH(c)) }));
    ok.sort((a, b) => a.f - b.f || a.l - b.l || a.r - b.r);
    return ok.map(q => q.c);
  };
  // ---- f-flow end

  // ---------------------------------------------------------------- the acts in the game
  // each: start(D, ev) → false when it finds no place to happen; update(D, ev, dt) → false when done; draw(D, ev, r, E,
  // cam, prog()) for its figures and models (the vox program, opaque); end(D, ev). ev: {kind, k, seed, age, dur, …}
  const ACT = LD.ACT = {};
  // a particle that lives one frame (an agent drawn again every frame); one options record for all of them (no allocation)
  const PO = { col: null, size: 0, force: true, grav: 0, drag: 0, collide: false, fade: false, life: 0, emis: 0 };
  const spawnP = (D, x, y, z, vx, vy, vz, col, size, emis) => { PO.col = col; PO.size = size; PO.life = D.dtLife; PO.emis = emis || 0; return D.P.spawn(x, y, z, vx, vy, vz, PO); };
  const rnd = (ev, i) => h(ev.seed, i, 0x3b);

  // ---- birds across the sun: a flock of 9–15 crosses in front of the sun (or across the view when the sun is behind)
  ACT.birds = {
    start(D, ev) {
      const E = D.E, sd = E.sunDir || [0.3, 0.8, 0.2], eye = D.eye, f = D.fwd;
      if (sd[1] < 0.08) return false;
      const sa = Math.atan2(sd[2], sd[0]), fa = Math.atan2(f[1], f[0]);
      let dir;
      if (Math.abs(LK.wrap(sa - fa)) < 1.1 && sd[1] < 0.8) { dir = sd.slice(); ev.sun = true; }
      else { const el = 0.32 + 0.22 * rnd(ev, 1), ca = fa + (rnd(ev, 2) - 0.5) * 0.6; dir = [Math.cos(ca) * Math.cos(el), Math.sin(el), Math.sin(ca) * Math.cos(el)]; }
      const R = 48 + 16 * rnd(ev, 3), c = [eye[0] + dir[0] * R, eye[1] + dir[1] * R, eye[2] + dir[2] * R];
      const hl = Math.hypot(dir[0], dir[2]) || 1, side = [-dir[2] / hl, dir[0] / hl], s = rnd(ev, 4) < 0.5 ? 1 : -1;
      ev.from = [c[0] - side[0] * 70 * s, c[1] - 6, c[2] - side[1] * 70 * s]; ev.to = [c[0] + side[0] * 70 * s, c[1] + 6, c[2] + side[1] * 70 * s];
      ev.d = [side[0] * s, side[1] * s]; ev.n = 9 + Math.floor(rnd(ev, 5) * 7); ev.ph = rnd(ev, 6) * TAU;
      ev.dur = 140 / (8.5 + 3 * rnd(ev, 7));
      D.st.birds = ev.n;
    },
    update(D, ev) {
      const u = ev.age / ev.dur, x = ev.from[0] + (ev.to[0] - ev.from[0]) * u, y = ev.from[1] + (ev.to[1] - ev.from[1]) * u + Math.sin(u * 5 + ev.ph) * 1.5, z = ev.from[2] + (ev.to[2] - ev.from[2]) * u;
      const Rx = -ev.d[1], Rz = ev.d[0], col = [0.12, 0.12, 0.14];
      for (let i = 0; i < ev.n; i++) {
        const li = i - (ev.n - 1) / 2, ai = Math.abs(li);
        const bx = x + Rx * li * 1.9 - ev.d[0] * ai * 1.3, bz = z + Rz * li * 1.9 - ev.d[1] * ai * 1.3, by = y + 0.3 * ai + Math.sin(D.time * 1.3 + i) * 0.3;
        const flap = Math.sin(D.time * 7.5 + i * 0.9 + ev.ph) * 0.5;
        spawnP(D, bx, by, bz, 0, 0, 0, col, 0.34);
        spawnP(D, bx + Rx * 0.7, by + flap, bz + Rz * 0.7, 0, 0, 0, col, 0.24);
        spawnP(D, bx - Rx * 0.7, by + flap, bz - Rz * 0.7, 0, 0, 0, col, 0.24);
      }
    },
  };

  // ---- the lantern lighter: at dusk a figure in a long coat and a top hat walks from lamp to lamp and lights them one by
  // one (a warm halo each); on Very Low the lamps light one by one by themselves
  ACT.lanterns = {
    start(D, ev) {
      const L = D.lampList(); if (L.length < 2) return false;
      const eye = D.eye, f = D.fwd, P0 = [eye[0] + f[0] * 10, eye[2] + f[1] * 10];
      const left = L.slice(); left.sort((a, b) => Math.hypot(a[0] - P0[0], a[2] - P0[1]) - Math.hypot(b[0] - P0[0], b[2] - P0[1]));
      const route = [left.shift()];
      while (route.length < 8 && left.length) { const c = route[route.length - 1]; let bi = 0, bd = 1e9; for (let i = 0; i < left.length; i++) { const d = Math.hypot(left[i][0] - c[0], left[i][2] - c[2]); if (d < bd) { bd = d; bi = i; } } if (bd > 22) break; route.push(left.splice(bi, 1)[0]); }
      if (route.length < 2) return false;
      ev.route = route; ev.lit = 0; ev.i = 0; ev.glowT = 0; ev.wait = -1;
      // the lamplighter comes from 5 m before the first lamp (on the side away from the second)
      if (D.tier >= 1) {
        const a = route[0], b = route[1], dx = a[0] - b[0], dz = a[2] - b[2], dl = Math.hypot(dx, dz) || 1;
        const sx = a[0] + dx / dl * 5, sz = a[2] + dz / dl * 5, gy = D.ground(sx, sz, a[1] - 2);
        ev.fig = { look: LK.folk(ev.seed, 'mayor', 'adult'), pos: [sx, gy === null ? a[1] - 2.5 : gy, sz], yaw: LK.yawOf(-dx, -dz), state: 'idle', walk: 0, walkAmt: 0, seed: 1.3 };
      }
      D.st.lamps = route.length; D.st.lit = 0;
    },
    update(D, ev, dt) {
      const R = ev.route;
      if (ev.fig && D.tier < 1) { ev.fig = null; ev.age = Math.min(ev.age, 2 + ev.lit * 2.4); }   // (Very Low chosen: he goes, the lamps light on by themselves)
      if (ev.fig) {
        const F = ev.fig;
        if (ev.i < R.length) {
          const L = R[ev.i], prev = ev.i ? R[ev.i - 1] : [F.pos[0], F.pos[1], F.pos[2]];
          // stand a step before the lamp's post, on the side he comes from
          const dx = prev[0] - L[0], dz = prev[2] - L[2], dl = Math.hypot(dx, dz) || 1, tx = L[0] + dx / dl * 0.9, tz = L[2] + dz / dl * 0.9;
          const ddx = tx - F.pos[0], ddz = tz - F.pos[2], d = Math.hypot(ddx, ddz);
          if (ev.wait < 0 && d > 0.15) {
            const st = Math.min(d, 1.35 * dt); F.pos[0] += ddx / d * st; F.pos[2] += ddz / d * st; F.walk += st; F.walkAmt = 1; F.state = 'idle'; F.yaw = LK.yawOf(ddx, ddz);
            if ((ev.gT = (ev.gT || 0) - dt) <= 0) { ev.gT = 0.3; const gy = D.ground(F.pos[0], F.pos[2], F.pos[1]); if (gy !== null && Math.abs(gy - F.pos[1]) < 1.6) F.pos[1] = gy; }
          } else {
            if (ev.wait < 0) ev.wait = 0;
            ev.wait += dt; F.walkAmt = 0; F.state = 'point'; F.yaw = LK.yawOf(L[0] - F.pos[0], L[2] - F.pos[2]);
            if (ev.wait > 0.8 && ev.lit === ev.i) ACT.lanterns.light(D, ev, L);
            if (ev.wait > 1.7) { ev.wait = -1; ev.i++; }
          }
        } else { F.state = 'idle'; F.walkAmt = 1; const a = F.yaw; F.pos[0] -= Math.sin(a) * 1.3 * dt; F.pos[2] -= Math.cos(a) * 1.3 * dt; F.walk += 1.3 * dt; if (ev.age > ev.dur - 1) F.on = false; }
      } else if (ev.lit < R.length && ev.age > 2 + ev.lit * 2.4) ACT.lanterns.light(D, ev, R[ev.lit]);
      // the halos of the lit lamps (each lamp a short-lived glow renewed: they fade when the act ends)
      if ((ev.glowT -= dt) <= 0) {
        ev.glowT = 0.45;
        for (let i = 0; i < ev.lit; i++) { const L = R[i], fl = 0.9 + 0.1 * Math.sin(D.time * 9 + i * 1.7); D.P.spawn(L[0], L[1], L[2], 0, 0, 0, { life: 0.95, size: 0.62 * fl, grav: 0, col: [1, 0.74, 0.38], emis: 1, drag: 0, collide: false, force: true }); }
      }
      D.st.lit = Math.max(D.st.lit || 0, ev.lit); D.st.lamps = R.length;
      return ev.lit < R.length || ev.age < ev.dur;
    },
    light(D, ev, L) { ev.lit++; D.P.spark(L[0], L[1], L[2], [1, 0.8, 0.4], 8, 1.2, 1); if (D.audio && D.audio.ctx && D.near(L, 24)) D.audio.tone(880, 0.02, 0.12, 'triangle'); },
    draw(D, ev, r, E, cam, prog) { if (ev.fig && ev.fig.on !== false) LK.drawFolk(D.g, r, prog(), ev.fig, cam, D.time); },
  };

  // ---- chimney smoke: a fire is lit — dark puffs at first, then white smoke drifting with the wind, from up to three
  // chimneys (one on Very Low)
  ACT.chimneys = {
    start(D, ev) {
      const C = D.chimneyList(); if (!C.length) return false;
      ev.c = C.slice(0, D.tier >= 1 ? 3 : 1); ev.t = 0;
    },
    update(D, ev, dt) {
      if ((ev.t -= dt) > 0) return;
      ev.t = D.tier >= 1 ? 0.12 : 0.25;
      const E = D.E, w = E.windDir || [1, 0], wk = (E.wind || 1) * 0.35, k = Math.min(1, ev.age / 9), fade = ev.age > ev.dur - 6 ? 0.4 : 1;
      if (Math.random() > fade) return;
      for (const c of ev.c) { const g = 0.32 + 0.52 * k; D.P.spawn(c[0] + 0.5 + (Math.random() - 0.5) * 0.3, c[1] + 1.1, c[2] + 0.5 + (Math.random() - 0.5) * 0.3, w[0] * wk + (Math.random() - 0.5) * 0.2, 1.1 + Math.random() * 0.4, w[1] * wk + (Math.random() - 0.5) * 0.2, { life: 4.5 + Math.random() * 2, size: 0.22 + Math.random() * 0.1, grav: -0.12, col: [g, g, g + 0.03], drag: 0.3, collide: false, grow: 0.42 }); }
    },
  };

  // ---- a ship's low pass with its contrail (by night its lights): the sky traffic flies it (traffic.js opts.over)
  // (f-flow: across the view, 50–85 m in front of the eye and 16–28 m up — inside the frame; v0.49's half passed behind the
  // eye and the other half 40–60 m overhead, over the top of the view; its pass comes ~11–20 s after the start: ev.eta)
  ACT.flyover = {
    start(D, ev) {
      const T = D.g.traffic; if (!T || !T.spawnFlight) return false;
      const sg = rnd(ev, 1) < 0.5 ? 1 : -1, fa = Math.atan2(D.fwd[1], D.fwd[0]), cross = fa + sg * (Math.PI / 2 - 0.4 * rnd(ev, 2));
      ev.tag = 'ld' + ev.k; ev.eta = 14;
      T.spawnFlight({ arch: ['shuttle', 'interceptor', 'racer', 'dropship'][Math.floor(rnd(ev, 3) * 4)], over: { a: cross, pass: -sg * (50 + 35 * rnd(ev, 4)), alt: 16 + 12 * rnd(ev, 5), t0: 0.12, contrail: true, tag: ev.tag, at: D.ahead(ev.eta) } });
    },
    update(D, ev) { const T = D.g.traffic; if (ev.age > 3 && T && !T.ships.some(s => s.tag === ev.tag)) return false; },
  };
  // ---- f-flow: a close pass — a horizon flight of the sky traffic across the view, 70–120 m in front, 20–40 m up, in its
  // own formation (the bigger craft more often: a fighter at 100 m is a dot); the traffic logs it at its nearest point
  ACT.flyby = {
    start(D, ev) {
      const T = D.g.traffic; if (!T || !T.spawnFlight) return false;
      const sg = rnd(ev, 1) < 0.5 ? 1 : -1, fa = Math.atan2(D.fwd[1], D.fwd[0]), cross = fa + sg * (Math.PI / 2 - 0.3 * rnd(ev, 2));
      ev.tag = 'ld' + ev.k; ev.eta = 14;
      const AR = ['freighter', 'shuttle', 'dropship', 'cruiser', 'freighter', 'interceptor', 'racer', 'shuttle'];
      T.spawnFlight({ arch: AR[Math.floor(rnd(ev, 3) * AR.length)], near: { a: cross, pass: -sg * (70 + 50 * rnd(ev, 4)), alt: 20 + 20 * rnd(ev, 5), t0: 0.12, tag: ev.tag, at: D.ahead(ev.eta) } });
    },
    update(D, ev) { const T = D.g.traffic; if (ev.age > 3 && T && !T.ships.some(s => s.tag === ev.tag)) return false; },
  };
  // ---- the sunrise convoy: three to five freighters in line, high up, their lights still on (f-flow: in front of the eye)
  ACT.convoy = {
    start(D, ev) {
      const T = D.g.traffic; if (!T || !T.spawnFlight) return false;
      const sg = rnd(ev, 3) < 0.5 ? 1 : -1, fa = Math.atan2(D.fwd[1], D.fwd[0]) + sg * (Math.PI / 2 + (rnd(ev, 1) - 0.5) * 0.6);
      ev.tag = 'ld' + ev.k; ev.eta = 20;
      T.spawnFlight({ arch: rnd(ev, 2) < 0.6 ? 'freighter' : 'shuttle', over: { a: fa, pass: -sg * (120 + 80 * rnd(ev, 4)), alt: 80 + 30 * rnd(ev, 5), t0: 0.05, convoy: D.tier >= 2 ? 5 : 3, tag: ev.tag, at: D.ahead(ev.eta) } });
    },
    update(D, ev) { const T = D.g.traffic; if (ev.age > 3 && T && !T.ships.some(s => s.tag === ev.tag)) return false; },
  };

  // ---- a cat on a wall: it sits, looks about, walks along the wall top, grooms, and at the end hops down behind it
  ACT.cat = {
    start(D, ev) {
      const W = D.wallTop(ev); if (!W) return false;
      ev.path = W.path; ev.away = W.away; ev.i = 0; ev.phase = 'sit'; ev.pt = 0;
      ev.q = { kind: 'moss_cat', pos: W.path[0].slice(), yaw: LK.yawOf(-W.away[0], -W.away[1]), state: 'sit', walk: 0, walkAmt: 0, id: ev.k & 7 };
    },
    update(D, ev, dt) {
      const q = ev.q; ev.pt += dt;
      if (ev.age > ev.dur - 2.2) { // the hop down behind the wall
        if (!ev.hop) ev.hop = { from: q.pos.slice(), t: 0 };
        const u = Math.min(1, (ev.hop.t += dt) / 0.7);
        q.pos[0] = ev.hop.from[0] + ev.away[0] * 1.4 * u; q.pos[2] = ev.hop.from[2] + ev.away[1] * 1.4 * u; q.pos[1] = ev.hop.from[1] + 0.6 * Math.sin(Math.PI * u) - 2.2 * u * u;
        q.state = 'follow'; q.walkAmt = 0.5; q.yaw = LK.yawOf(ev.away[0], ev.away[1]);
        return u < 1;
      }
      if (ev.phase === 'sit') { q.state = 'sit'; q.walkAmt = 0; if (ev.pt > 5 + 3 * rnd(ev, ev.i + 9) && ev.path.length > 1) { ev.phase = 'walk'; ev.pt = 0; ev.dir = ev.i >= ev.path.length - 1 ? -1 : ev.i === 0 ? 1 : (rnd(ev, ev.i) < 0.5 ? -1 : 1); } }
      else {
        const tgt = ev.path[ev.i + ev.dir], dx = tgt[0] - q.pos[0], dz = tgt[2] - q.pos[2], d = Math.hypot(dx, dz);
        if (d < 0.05) { ev.i += ev.dir; ev.phase = 'sit'; ev.pt = 0; }
        else { const st = Math.min(d, 0.9 * dt); q.pos[0] += dx / d * st; q.pos[2] += dz / d * st; q.pos[1] = tgt[1]; q.walk = (q.walk || 0) + st; q.walkAmt = 1; q.state = 'follow'; q.yaw = LK.yawOf(dx, dz); }
      }
    },
    draw(D, ev, r, E, cam, prog) { LK.drawQuad(D.g, r, prog(), ev.q, cam, D.time); },
  };

  // ---- pigeons: a dozen peck about the paving in front of you, then burst up all at once and fly off over the roofs
  ACT.pigeons = {
    start(D, ev) {
      const S = D.openGround(7 + 5 * rnd(ev, 1), (rnd(ev, 2) - 0.5) * 0.9, 2); if (!S) return false;
      ev.c = S; ev.burst = 7 + 4 * rnd(ev, 4); ev.b = [];
      // (each bird where its own ground is level with the spot: never in a planter or on a café chair)
      const want = 10 + Math.floor(rnd(ev, 3) * 6);
      for (let i = 0; i < want; i++) for (let t = 0; t < 3; t++) {
        const a = rnd(ev, 10 + i + 97 * t) * TAU, rr = Math.sqrt(rnd(ev, 30 + i + 97 * t)) * 2.2, x = S[0] + Math.cos(a) * rr, z = S[2] + Math.sin(a) * rr;
        if (D.ground(x, z, S[1]) !== S[1]) continue;
        ev.b.push({ x, y: S[1], z, yaw: rnd(ev, 50 + i) * TAU, ph: rnd(ev, 70 + i) * 6, vx: 0, vy: 0, vz: 0 }); break;
      }
      ev.n = ev.b.length; if (ev.n < 6) return false;
      ev.dur = ev.burst + 7;
      D.st.pigeons = ev.n;
    },
    update(D, ev, dt) {
      const eye = D.eye;
      if (!ev.up && (ev.age > ev.burst || Math.hypot(eye[0] - ev.c[0], eye[2] - ev.c[2]) < 3.5)) {
        ev.up = true;
        for (const b of ev.b) { const ax = b.x - eye[0], az = b.z - eye[2], al = Math.hypot(ax, az) || 1, sp = 3 + Math.random() * 3; b.vx = ax / al * sp + (Math.random() - 0.5) * 2; b.vz = az / al * sp + (Math.random() - 0.5) * 2; b.vy = 4 + Math.random() * 2.5; }
        if (D.audio && D.audio.ctx && D.near(ev.c, 30)) for (let k = 0; k < 6; k++) D.audio.tone(180 + Math.random() * 120, 0.02, 0.05, 'triangle', false, D.audio.ctx.currentTime + k * 0.05);
      }
      const body = [0.5, 0.52, 0.58], head = [0.34, 0.38, 0.44], wing = [0.6, 0.62, 0.66];
      for (const b of ev.b) {
        if (ev.up) { b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vy += 0.5 * dt; const fl = Math.sin(D.time * 22 + b.ph) * 0.18, sx = -b.vz, sz = b.vx, sl = Math.hypot(sx, sz) || 1; spawnP(D, b.x, b.y, b.z, 0, 0, 0, body, 0.17); spawnP(D, b.x + sx / sl * 0.22, b.y + fl, b.z + sz / sl * 0.22, 0, 0, 0, wing, 0.13); spawnP(D, b.x - sx / sl * 0.22, b.y + fl, b.z - sz / sl * 0.22, 0, 0, 0, wing, 0.13); }
        else { const peck = Math.max(0, Math.sin(D.time * 6 + b.ph)), wx = Math.sin(D.time * 0.6 + b.ph) * 0.15 * dt; b.x += Math.sin(b.yaw) * wx; b.z += Math.cos(b.yaw) * wx; spawnP(D, b.x, b.y + 0.14, b.z, 0, 0, 0, body, 0.17); spawnP(D, b.x + Math.sin(b.yaw) * 0.12, b.y + 0.27 - peck * 0.13, b.z + Math.cos(b.yaw) * 0.12, 0, 0, 0, head, 0.09); }
      }
    },
  };

  // ---- a hover-cart glides along the street across your view, crates of produce under its awning, a cyan glow beneath
  ACT.cart = {
    start(D, ev) {
      // across the view (a street seen from its side) — t-polish: the run cut to the view and 3 m beyond its edges (an uncut
      // run began 26 m to the side: t-life's picture shot it before it was in the frame), then to the stretch of it the eye
      // sees, 12 m of it at least (t-polish's browser run 2: across a street looked down, the run went on through the open
      // shop fronts and behind the palms — in the frame by its place, seen by nobody) — else along it (a street you look
      // down: it comes toward you, passes beside you and goes on behind you), at ±2.6, at ±1.5 (inside the lamps of a
      // narrow street), at ±4 m
      const d0 = 11 + 5 * rnd(ev, 1); let run = null, along = false;
      for (const d of [d0, d0 + 4, d0 - 3, d0 + 8]) { const r = D.runAcross(d, 18); if (r && (run = D.seenPart(D.inView(r, d), 12))) break; }
      if (!run) for (const off of [2.6, -2.6, 1.5, -1.5, 4, -4]) { const r = D.runAlong(off, 14); if (r && (run = D.seenPart(r, 12))) { along = true; break; } }
      if (!run) return false;
      ev.run = along ? run.slice().reverse() : rnd(ev, 2) < 0.5 ? run : run.slice().reverse(); ev.L = 0; ev.sp = 3.2;
      const P = []; for (const p of ev.run) P.push([p[0], p[1] + 0.45, p[2]]); ev.path = LK.path(P);
      ev.pos = [0, 0, 0, 0]; ev.dur = ev.path.L / ev.sp + 0.5; ev.y = null;
    },
    update(D, ev, dt) {
      const d = Math.min(ev.path.L, ev.age * ev.sp); LK.along(ev.path, d, ev.pos);
      ev.y = ev.y === null ? ev.pos[1] : ev.y + (ev.pos[1] - ev.y) * Math.min(1, dt * 4);
      if (D.tier >= 2 && Math.random() < 0.6) D.P.spawn(ev.pos[0] + (Math.random() - 0.5) * 1.4, ev.y - 0.2, ev.pos[2] + (Math.random() - 0.5) * 1.4, 0, -0.2, 0, { life: 0.35, size: 0.12, grav: 0, col: [0.3, 0.95, 1], emis: 1, drag: 0, collide: false, force: true });
    },
    draw(D, ev, r, E, cam, prog) { LK.drawModel(D.g, r, prog(), 'life_cart', [ev.pos[0], ev.y + Math.sin(D.time * 2.2) * 0.04, ev.pos[2]], ev.pos[3], cam, {}); },
  };

  const METEOR = [1, 0.96, 0.86];
  // ---- a meteor at night (on Balanced and up a short shower): a bright head and a fading streak high over the land
  ACT.meteor = {
    start(D, ev) {
      if ((D.E.night || 0) < 0.45) return false;
      const n = D.tier >= 2 ? 1 + Math.floor(rnd(ev, 1) * 4) : 1, fa = Math.atan2(D.fwd[1], D.fwd[0]), eye = D.eye;
      ev.m = [];
      for (let i = 0; i < n; i++) {
        const az = fa + (rnd(ev, 10 + i) - 0.5) * 1.6, el = 0.45 + 0.4 * rnd(ev, 20 + i), R = 300;
        const p = [eye[0] + Math.cos(az) * Math.cos(el) * R, eye[1] + Math.sin(el) * R, eye[2] + Math.sin(az) * Math.cos(el) * R];
        const sd = rnd(ev, 30 + i) < 0.5 ? 1 : -1, sx = -Math.sin(az) * sd, sz = Math.cos(az) * sd, sp = 90 + 50 * rnd(ev, 40 + i);
        ev.m.push({ t0: i === 0 ? 0.2 : 1 + 6 * rnd(ev, 50 + i), life: 1 + 0.6 * rnd(ev, 60 + i), p, v: [sx * sp * 0.8, -sp * 0.55, sz * sp * 0.8] });
      }
    },
    update(D, ev, dt) {
      for (const m of ev.m) {
        const a = ev.age - m.t0; if (a < 0 || a > m.life) continue;
        m.p[0] += m.v[0] * dt; m.p[1] += m.v[1] * dt; m.p[2] += m.v[2] * dt;
        const k = Math.sin(Math.PI * a / m.life);
        spawnP(D, m.p[0], m.p[1], m.p[2], 0, 0, 0, METEOR, 1.5 * k + 0.3, 1.6);
        D.P.spawn(m.p[0], m.p[1], m.p[2], 0, 0, 0, { life: 0.5, size: 0.95 * k, grav: 0, col: [0.75, 0.82, 1], emis: 1.2, drag: 0, collide: false, force: true });
      }
    },
  };

  // ---- a hot-air balloon drifting with the wind over the hills, its burner roaring now and then (f-flow: 45–80 m out and
  // 22–40 m up — at 85–145 m it covered 0.3–0.6 % of the screen, hardly there)
  ACT.balloon = {
    start(D, ev) {
      const fa = Math.atan2(D.fwd[1], D.fwd[0]) + (rnd(ev, 1) - 0.5) * 1.1, R = 45 + 35 * rnd(ev, 2), eye = D.eye;
      const x = eye[0] + Math.cos(fa) * R, z = eye[2] + Math.sin(fa) * R, top = D.top(x, z);
      ev.pos = [x, Math.max(top, eye[1] - 1.6) + 22 + 18 * rnd(ev, 3), z];
      const w = D.E.windDir || [1, 0], sp = 1.3 + 0.8 * rnd(ev, 4);
      ev.v = [w[0] * sp, 0, w[1] * sp]; ev.yaw = rnd(ev, 5) * TAU; ev.burn = 3; ev.y0 = ev.pos[1];
      D.st.balloon = 1;
    },
    update(D, ev, dt) {
      ev.pos[0] += ev.v[0] * dt; ev.pos[2] += ev.v[2] * dt; ev.pos[1] = ev.y0 + Math.sin(ev.age * 0.11) * 3; ev.yaw += dt * 0.03;
      ev.burn -= dt;
      if (ev.burn < 0) { if (ev.burn < -1.3) ev.burn = 6 + 5 * Math.random(); else if (D.tier >= 1) { D.P.spawn(ev.pos[0], ev.pos[1] + 2.2, ev.pos[2], 0, 1.5, 0, { life: 0.25, size: 0.55, grav: 0, col: [1, 0.62, 0.2], emis: 1, drag: 0, collide: false, force: true }); } }
    },
    draw(D, ev, r, E, cam, prog) { LK.drawModel(D.g, r, prog(), 'life_balloon', ev.pos, ev.yaw, cam, {}); },
  };

  // ---- the noon bells: a carillon in the pentatonic scale over the town, pigeons bursting from the roofs
  ACT.bells = {
    start(D, ev) {
      const c = D.townCentre(); if (!c) return false;
      ev.c = c; ev.n = 0; ev.flock = [];
      const tune = [6, 5, 4, 2, 1, 0, 2, 4, 6, 4, 5, 2], scale = [523.3, 587.3, 659.3, 784.0, 880.0, 1046.5, 1174.7];
      ev.notes = tune.map((s, i) => ({ t: 0.6 + i * 0.55 + (i >= 6 ? 0.6 : 0), f: scale[s] }));
      for (let i = 0; i < 14; i++) { const a = rnd(ev, i) * TAU, rr = 6 + 10 * rnd(ev, 20 + i), x = c[0] + Math.cos(a) * rr, z = c[2] + Math.sin(a) * rr; ev.flock.push({ x, y: D.top(x, z) + 1.5, z, vx: Math.cos(a) * 3, vy: 3.5 + 2 * rnd(ev, 40 + i), vz: Math.sin(a) * 3, ph: i }); }
    },
    update(D, ev, dt) {
      const A = D.audio, d = Math.hypot(D.eye[0] - ev.c[0], D.eye[2] - ev.c[2]), vol = Math.max(0, 0.16 * (1 - d / 120));
      while (ev.n < ev.notes.length && ev.age >= ev.notes[ev.n].t) { const f = ev.notes[ev.n].f; if (A && A.ctx && vol > 0.005) { A.tone(f, vol, 2.4, 'sine', true); A.tone(f * 2.01, vol * 0.25, 1.4, 'sine', true); } ev.n++; }
      if (ev.age > 1) for (const b of ev.flock) { b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; const fl = Math.sin(D.time * 20 + b.ph) * 0.2; spawnP(D, b.x, b.y, b.z, 0, 0, 0, [0.5, 0.52, 0.58], 0.18); spawnP(D, b.x, b.y + fl, b.z + 0.2, 0, 0, 0, [0.6, 0.62, 0.66], 0.13); }
    },
  };

  // ---- a firework salvo on a festival evening (the festival's own rockets, festival.js)
  ACT.fireworks = {
    start(D, ev) {
      const V = D.g.villages, vil = V && V.festivalNear ? V.festivalNear() : null; if (!vil || !V.festState) return false;
      const F = V.festState(vil), pz = vil.plan.plaza, PR = pz.r || 4, COLS = [[1, 0.3, 0.35], [0.35, 1, 0.5], [0.4, 0.6, 1], [1, 0.82, 0.3], [0.85, 0.45, 1], [0.35, 1, 1]];
      const n = 4 + Math.floor(rnd(ev, 1) * 3);
      for (let k = 0; k < n; k++) { const cor = [[-1, -1], [1, -1], [-1, 1], [1, 1]][k & 3]; F.rockets.push({ p: [pz.x + 0.5 + cor[0] * (PR + 3), pz.y + 1, pz.z + 0.5 + cor[1] * (PR + 3)], v: [(rnd(ev, 10 + k) - 0.5) * 3, 27 + 7 * rnd(ev, 20 + k), (rnd(ev, 30 + k) - 0.5) * 3], fuse: 1.1 + 0.5 * rnd(ev, 40 + k) + k * 0.3, col: COLS[k % COLS.length], col2: COLS[(k + 2) % COLS.length], type: ['peony', 'ring', 'willow', 'palm', 'crossette'][k % 5], whistle: false }); }
    },
    update() { },
  };

  // ---- kids with a ball: two children kick it back and forth on open ground, then run off
  ACT.kids = {
    start(D, ev) {
      const S = D.openGround(8 + 5 * rnd(ev, 1), (rnd(ev, 2) - 0.5) * 0.6, 3.5); if (!S) return false;
      const f = D.fwd, sx = -f[1], sz = f[0], half = 3.2;
      const A = [S[0] - sx * half, S[1], S[2] - sz * half], B = [S[0] + sx * half, S[1], S[2] + sz * half];
      if (D.ground(A[0], A[2], S[1]) !== S[1] || D.ground(B[0], B[2], S[1]) !== S[1]) return false;
      ev.k2 = [A, B].map((p, i) => ({ look: LK.folk(ev.seed + i * 977, 'child', 'child'), pos: p.slice(), home: p.slice(), yaw: LK.yawOf((i ? A : B)[0] - p[0], (i ? A : B)[2] - p[2]), state: 'idle', walk: 0, walkAmt: 0, kid: true, seed: i * 2.1, kick: 0 }));
      for (const K of ev.k2) K.posefx = (P) => { if (K.kick > 0) { const u = 1 - K.kick / 0.45; if (P.leg_r) { P.leg_r[0] = -0.9 + 1.7 * u; } if (P.shin_r) P.shin_r[0] = -0.3; } };
      ev.ball = { pos: [A[0] + sx * 0.6, A[1] + 0.15, A[2] + sz * 0.6], from: null, to: null, t: 0, T: 1, spin: 0 }; ev.side = 0; ev.next = 1.2;
    },
    update(D, ev, dt) {
      const K = ev.k2, b = ev.ball;
      for (const k of K) { k.kick = Math.max(0, k.kick - dt); }
      if (ev.age > ev.dur - 4) { // they run off together
        for (const k of K) { k.state = 'idle'; k.walkAmt = 1; k.run = true; k.walk += 3.2 * dt; k.yaw = LK.yawOf(D.fwd[1], -D.fwd[0]); k.pos[0] -= Math.sin(k.yaw) * 3.2 * dt; k.pos[2] -= Math.cos(k.yaw) * 3.2 * dt; }
        b.pos[0] = K[0].pos[0] - Math.sin(K[0].yaw) * 0.7; b.pos[2] = K[0].pos[2] - Math.cos(K[0].yaw) * 0.7; b.spin += dt * 9;
        return;
      }
      if (!b.from) {
        if ((ev.next -= dt) <= 0) { const kk = K[ev.side], other = K[1 - ev.side]; kk.kick = 0.45; kk.state = 'idle'; b.from = b.pos.slice(); const tgt = [other.home[0] + (Math.random() - 0.5) * 2.2, other.home[1] + 0.15, other.home[2] + (Math.random() - 0.5) * 2.2]; b.to = tgt; b.t = 0; b.T = Math.hypot(tgt[0] - b.from[0], tgt[2] - b.from[2]) / (4 + Math.random() * 2); b.lob = Math.random() < 0.35 ? 1.2 + Math.random() : 0; }
        else for (const k of K) { k.walkAmt = 0; k.state = 'idle'; k.yaw = LK.yawOf(b.pos[0] - k.pos[0], b.pos[2] - k.pos[2]); }
      } else {
        b.t += dt; const u = Math.min(1, b.t / b.T);
        b.pos[0] = b.from[0] + (b.to[0] - b.from[0]) * u; b.pos[2] = b.from[2] + (b.to[2] - b.from[2]) * u; b.pos[1] = b.from[1] + b.lob * 4 * u * (1 - u); b.spin += dt * 12;
        // the receiver runs to meet it
        const other = K[1 - ev.side], tx = b.to[0] - Math.sign(b.to[0] - b.from[0]) * 0.5, tz = b.to[2] - Math.sign(b.to[2] - b.from[2]) * 0.5, dx = tx - other.pos[0], dz = tz - other.pos[2], d = Math.hypot(dx, dz);
        if (d > 0.1) { const st = Math.min(d, 3 * dt); other.pos[0] += dx / d * st; other.pos[2] += dz / d * st; other.walk += st; other.walkAmt = 1; other.run = true; } else { other.walkAmt = 0; other.run = false; }
        other.yaw = LK.yawOf(b.pos[0] - other.pos[0], b.pos[2] - other.pos[2]);
        const kk = K[ev.side]; kk.walkAmt = 0; kk.state = u > 0.5 ? 'cheer' : 'idle';
        if (u >= 1) { b.from = null; ev.side = 1 - ev.side; ev.next = 0.5 + Math.random() * 0.9; K[1 - ev.side].state = 'idle'; }
      }
    },
    draw(D, ev, r, E, cam, prog) { for (const k of ev.k2) LK.drawFolk(D.g, r, prog(), k, cam, D.time); LK.drawModel(D.g, r, prog(), 'life_ball', ev.ball.pos, ev.ball.spin * 0.3, cam, { pitch: ev.ball.spin }); },
  };

  // ---- a street musician by the fountain: a lute, a short tune in the pentatonic scale, notes rising
  ACT.musician = {
    start(D, ev) {
      const c = D.fountain(), eye = D.eye, f = D.fwd;
      let p;
      if (c) { const dx = eye[0] - c[0], dz = eye[2] - c[2], dl = Math.hypot(dx, dz) || 1; p = [c[0] + dx / dl * 3.6, 0, c[2] + dz / dl * 3.6]; }
      else p = [eye[0] + f[0] * 7 - f[1] * 2.5, 0, eye[2] + f[1] * 7 + f[0] * 2.5];
      const gy = D.ground(p[0], p[2], eye[1] - 1.6); if (gy === null) return false; p[1] = gy;
      ev.fig = { look: LK.folk(ev.seed, 'crafter', 'adult'), pos: p, yaw: LK.yawOf(eye[0] - p[0], eye[2] - p[2]), state: 'idle', walk: 0, walkAmt: 0, seed: 0.7 };
      ev.fig.posefx = (P) => { const t = D.time; const set = (j, rx, ry, rz) => { const o = P[j]; if (o) { o[0] = rx; o[1] = ry; o[2] = rz; } }; set('arm_l', 1.15, 0.35, 0.55); set('fore_l', 0.9, 0, 0); set('arm_r', 0.85 + Math.sin(t * 13) * 0.28, 0, -0.35); set('fore_r', 0.8, 0, 0); if (P.head) P.head[0] = -0.1 + Math.abs(Math.sin(t * 4.2)) * 0.12; };
      // the tune: two phrases on D major pentatonic, from the seed
      const S = [293.7, 329.6, 370.0, 440.0, 493.9, 587.3, 659.3, 740.0];
      let t = 0.8, s = 3; ev.notes = [];
      for (let ph = 0; ph < 2; ph++) for (let i = 0; i < 12; i++) { s = Math.max(0, Math.min(7, s + [-2, -1, -1, 1, 1, 2, 0][Math.floor(rnd(ev, 100 + ph * 20 + i) * 7)])); const d = rnd(ev, 200 + i) < 0.3 ? 0.5 : 0.25; ev.notes.push({ t, f: S[i === 11 ? 0 : s], d }); t += d; if (i === 11) t += 0.8; }
      ev.n = 0; ev.tuneT = t; ev.loop = 0;
    },
    update(D, ev) {
      const A = D.audio, F = ev.fig, d = Math.hypot(D.eye[0] - F.pos[0], D.eye[2] - F.pos[2]), vol = Math.max(0, 0.06 * (1 - d / 40));
      const tt = ev.age - ev.loop * (ev.tuneT + 2);
      if (ev.n >= ev.notes.length) { if (tt > ev.tuneT + 2) { ev.loop++; ev.n = 0; } return; }
      while (ev.n < ev.notes.length && tt >= ev.notes[ev.n].t) {
        const N = ev.notes[ev.n++];
        if (A && A.ctx && vol > 0.003) { A.tone(N.f, vol, N.d * 2.2, 'triangle', true); A.tone(N.f / 2, vol * 0.35, N.d * 2.5, 'sine', true); }
        D.P.spawn(F.pos[0] + (Math.random() - 0.5) * 0.5, F.pos[1] + 2, F.pos[2] + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.3, 0.8, (Math.random() - 0.5) * 0.3, { life: 1.8, size: 0.09, grav: 0, col: [[1, 0.85, 0.3], [0.5, 1, 0.9], [1, 0.5, 0.8]][ev.n % 3], emis: 1, drag: 0.4, collide: false, force: true });
      }
    },
    draw(D, ev, r, E, cam, prog) {
      const F = ev.fig; LK.drawFolk(D.g, r, prog(), F, cam, D.time);
      const c = Math.cos(F.yaw), s = Math.sin(F.yaw), lp = ev.lp || (ev.lp = [0, 0, 0]);
      lp[0] = F.pos[0] - s * 0.32 + c * 0.05; lp[1] = F.pos[1] + 1.02; lp[2] = F.pos[2] - c * 0.32 - s * 0.05;
      LK.drawModel(D.g, r, prog(), 'life_lute', lp, F.yaw + Math.PI / 2, cam, { roll: 0.6, pitch: 0.15 });
    },
  };

  // ---- a dog at the fountain: it trots up, drinks, hops into the basin with a splash, shakes itself dry and trots off
  ACT.dog = {
    start(D, ev) {
      const c = D.fountain(); if (!c) return false;
      const eye = D.eye, a0 = Math.atan2(eye[2] - c[2], eye[0] - c[0]) + (rnd(ev, 1) < 0.5 ? 1.3 : -1.3);
      const st = [c[0] + Math.cos(a0) * 13, 0, c[2] + Math.sin(a0) * 13], rim = [c[0] + Math.cos(a0) * 2.9, 0, c[2] + Math.sin(a0) * 2.9];
      const g0 = D.ground(st[0], st[2], c[1]), g1 = D.ground(rim[0], rim[2], c[1]); if (g0 === null || g1 === null) return false;
      st[1] = g0; rim[1] = g1; ev.c = c; ev.st = st; ev.rim = rim; ev.phase = 'come'; ev.pt = 0;
      ev.q = { kind: 'life_dog', pos: st.slice(), yaw: LK.yawOf(rim[0] - st[0], rim[2] - st[2]), state: 'follow', walk: 0, walkAmt: 0, id: 3 };
    },
    update(D, ev, dt) {
      const q = ev.q; ev.pt += dt;
      const go = (tgt, sp) => { const dx = tgt[0] - q.pos[0], dz = tgt[2] - q.pos[2], d = Math.hypot(dx, dz); if (d < 0.08) return true; const st = Math.min(d, sp * dt); q.pos[0] += dx / d * st; q.pos[2] += dz / d * st; q.walk += st; q.walkAmt = 1; q.state = 'follow'; q.yaw = LK.yawOf(dx, dz); return false; };
      if (ev.phase === 'come') { if (go(ev.rim, 2.3)) { ev.phase = 'drink'; ev.pt = 0; } }
      else if (ev.phase === 'drink') { q.walkAmt = 0; q.state = 'drink'; q.yaw = LK.yawOf(ev.c[0] - q.pos[0], ev.c[2] - q.pos[2]); if (ev.pt > 4) { ev.phase = 'hop'; ev.pt = 0; ev.h0 = q.pos.slice(); } }
      else if (ev.phase === 'hop') { const u = Math.min(1, ev.pt / 0.6), dx = ev.c[0] - ev.h0[0], dz = ev.c[2] - ev.h0[2], dl = Math.hypot(dx, dz) || 1; q.pos[0] = ev.h0[0] + dx / dl * 1.3 * u; q.pos[2] = ev.h0[2] + dz / dl * 1.3 * u; q.pos[1] = ev.h0[1] + 0.9 * Math.sin(Math.PI * u) - 0.2 * u; if (u >= 1) { ev.phase = 'splash'; ev.pt = 0; D.P.splash(q.pos[0], q.pos[1] + 0.4, q.pos[2], [0.75, 0.88, 1]); if (D.audio && D.audio.ctx && D.near(q.pos, 25)) D.audio.tone(220, 0.03, 0.2, 'sine'); } }
      else if (ev.phase === 'splash') { q.state = 'follow'; q.walkAmt = 0.6; q.walk += dt * 2; if (Math.random() < 0.5) D.P.spawn(q.pos[0] + (Math.random() - 0.5), q.pos[1] + 0.3, q.pos[2] + (Math.random() - 0.5), (Math.random() - 0.5) * 2, 2 + Math.random() * 2, (Math.random() - 0.5) * 2, { life: 0.6, size: 0.06, grav: 14, col: [0.75, 0.88, 1], collide: false, force: true }); if (ev.pt > 2.2) { ev.phase = 'out'; ev.pt = 0; ev.h0 = q.pos.slice(); } }
      else if (ev.phase === 'out') { const u = Math.min(1, ev.pt / 0.6); q.pos[0] = ev.h0[0] + (ev.rim[0] - ev.h0[0]) * u; q.pos[2] = ev.h0[2] + (ev.rim[2] - ev.h0[2]) * u; q.pos[1] = ev.h0[1] + (ev.rim[1] - ev.h0[1]) * u + 0.9 * Math.sin(Math.PI * u); if (u >= 1) { ev.phase = 'shake'; ev.pt = 0; } }
      else if (ev.phase === 'shake') { q.walkAmt = 0; q.state = 'sit'; if (ev.pt < 1.5) for (let k = 0; k < 3; k++) { const a = Math.random() * TAU; D.P.spawn(q.pos[0], q.pos[1] + 0.45, q.pos[2], Math.cos(a) * 3, 1 + Math.random() * 2, Math.sin(a) * 3, { life: 0.5, size: 0.05, grav: 12, col: [0.78, 0.9, 1], collide: false, force: true }); } if (ev.pt > 2.5) { ev.phase = 'off'; ev.pt = 0; } }
      else { q.state = 'follow'; if (go(ev.st, 2.6)) return false; }
      if (ev.phase === 'come' || ev.phase === 'off') { if ((ev.gT = (ev.gT || 0) - dt) <= 0) { ev.gT = 0.3; const gy = D.ground(q.pos[0], q.pos[2], q.pos[1]); if (gy !== null && Math.abs(gy - q.pos[1]) < 1.2) q.pos[1] = gy; } }
    },
    draw(D, ev, r, E, cam, prog) { LK.drawQuad(D.g, r, prog(), ev.q, cam, D.time); },
  };

  // ---- a sky ray: a great glowing manta gliding in slow circles over the Sky Isles (the creature of the isles, drawn big)
  ACT.skyray = {
    start(D, ev) {
      if (D.g.wild && D.g.wild.b && D.g.wild.b.cap.ray > 0) return false;   // (t-wild: the Himmelsrochen fly between the isles: no blocky one here)
      const eye = D.eye, fa = Math.atan2(D.fwd[1], D.fwd[0]) + (rnd(ev, 1) - 0.5) * 0.8, R = 70 + 30 * rnd(ev, 2);
      ev.c = [eye[0] + Math.cos(fa) * R, eye[1] + 26 + 22 * rnd(ev, 3), eye[2] + Math.sin(fa) * R]; ev.r = 34 + 16 * rnd(ev, 4); ev.w = (rnd(ev, 5) < 0.5 ? 1 : -1) * 0.13; ev.a = rnd(ev, 6) * TAU; ev.pos = [0, 0, 0];
      ev.pose = { wing_l: [0, 0, 0], wing_r: [0, 0, 0], tail: [0, 0, 0] };
    },
    update(D, ev, dt) {
      ev.a += ev.w * dt; const fade = sm(ev.age / 3) * sm((ev.dur - ev.age) / 3);
      ev.pos[0] = ev.c[0] + Math.cos(ev.a) * ev.r; ev.pos[2] = ev.c[2] + Math.sin(ev.a) * ev.r; ev.pos[1] = ev.c[1] + Math.sin(ev.age * 0.4) * 2 + (1 - fade) * 30;
      ev.yaw = LK.yawOf(-Math.sin(ev.a) * Math.sign(ev.w), Math.cos(ev.a) * Math.sign(ev.w));
      const fl = Math.sin(ev.age * 1.6) * 0.32; ev.pose.wing_l[2] = fl; ev.pose.wing_r[2] = -fl; ev.pose.tail[0] = Math.sin(ev.age * 1.6 + 1) * 0.15;
    },
    draw(D, ev, r, E, cam, prog) { LK.drawModel(D.g, r, prog(), 'sky_ray', ev.pos, ev.yaw, cam, { scale: 7, roll: -Math.sign(ev.w) * 0.25, pose: ev.pose }); },
  };

  // ---- a fisherman's catch: a figure sits on the bank with his rod; a fish leaps, splashes, and he cheers
  ACT.fisher = {
    start(D, ev) {
      const B = D.bank(ev); if (!B) return false;
      ev.b = B; ev.fig = { look: LK.folk(ev.seed, 'farmer', 'adult'), pos: B.pos, yaw: LK.yawOf(B.out[0], B.out[1]), state: 'sitground', walk: 0, walkAmt: 0, seed: 2.2 };
      ev.jump = 9 + 6 * rnd(ev, 1);
    },
    update(D, ev, dt) {
      const F = ev.fig, B = ev.b, j = ev.age - ev.jump;
      if (j > 0 && j < 1) {
        const p0 = [B.water[0] + B.out[0] * 3, B.water[1], B.water[2] + B.out[1] * 3], u = j;
        if (!ev.s0) { ev.s0 = 1; D.P.splash(p0[0], p0[1], p0[2], [0.75, 0.88, 1]); }
        const x = p0[0] - B.out[0] * 1.4 * u, z = p0[2] - B.out[1] * 1.4 * u, y = p0[1] + 2.2 * Math.sin(Math.PI * u);
        spawnP(D, x, y, z, 0, 0, 0, [0.85, 0.88, 0.92], 0.2); spawnP(D, x + B.out[0] * 0.18, y - 0.04, z + B.out[1] * 0.18, 0, 0, 0, [1, 0.62, 0.3], 0.12);
      } else if (j >= 1 && !ev.s1) { ev.s1 = 1; D.P.splash(B.water[0] + B.out[0] * 1.6, B.water[1], B.water[2] + B.out[1] * 1.6, [0.75, 0.88, 1]); }
      F.state = j > 0.6 && j < 3.2 ? 'cheer' : 'sitground';
    },
    draw(D, ev, r, E, cam, prog) {
      const F = ev.fig; LK.drawFolk(D.g, r, prog(), F, cam, D.time);
      if (F.state !== 'cheer') { const c = Math.cos(F.yaw), s = Math.sin(F.yaw), rp = ev.rp || (ev.rp = [0, 0, 0]); rp[0] = F.pos[0] - s * 0.4; rp[1] = F.pos[1] + 0.55; rp[2] = F.pos[2] - c * 0.4; LK.drawModel(D.g, r, prog(), 'life_rod', rp, F.yaw + Math.PI, cam, {}); }
    },
  };

  // ---- f-flow: t-wild's animals (wildlife.js draws them; the director only chooses the moment)
  // a heron standing at a pond in view 12–45 m ahead lifts off and flies to the far side (its own flight, wildlife.js)
  ACT.heron = {
    start(D, ev) {
      const H = D.wildHeron(); if (!H) return false;
      H.state = 'crouch'; H.t = 0; ev.h = H; ev.pos = H.pos;
    },
    update() { },
  };
  // the Himmelsrochen gliding by within 260 m in view, or the murmuration in view at dusk: the moment is theirs
  ACT.rays = {
    start(D, ev) { const q = D.wildRay(); if (!q) return false; ev.ray = q.i; ev.pos = q.pos; ev.r = q.r; },
    update(D, ev) { const W = D.g.wild, R = W && W.rays && W.rays[ev.ray]; if (R) { ev.pos[0] = R[0]; ev.pos[1] = R[1]; ev.pos[2] = R[2]; } },
  };
  ACT.murm = {
    start(D, ev) { const q = D.wildMurm(); if (!q) return false; ev.pos = q.pos; ev.r = q.r; },
    update(D, ev) { const W = D.g.wild, Mu = W && W.murm; if (Mu && Mu.fl && Mu.fl.ctr) { ev.pos[0] = Mu.fl.ctr[0]; ev.pos[1] = Mu.fl.ctr[1]; ev.pos[2] = Mu.fl.ctr[2]; } },
  };
  // ---- f-flow end

  // ---------------------------------------------------------------- the director in the game
  const LAMP_RE = /^(vx_lamppost|vx_lamppost_crystal|vx_lamppost_tech|vx_lamppost_black|vx_arc_lamp|vm_arc_lamp|vx_garden_lamp|vm_town_lamp)$/;
  let LAMPS = null;
  const lampType = (t) => { if (!LAMPS) { const R = VR.R; LAMPS = new Uint8Array(R.types.length); for (let i = 0; i < R.types.length; i++) if (R.types[i] && LAMP_RE.test(R.types[i].name)) LAMPS[i] = 1; } return t < LAMPS.length && LAMPS[t] === 1; };
  LD.Actor = class {
    constructor(game) {
      this.g = game;
      const E = game.env;
      this.clock = E ? ((E.day || 0) * 24000 + (E.ticks || 0)) / 20 : 0;   // the world's clock (as the trams')
      this.seed = (((game.meta && game.meta.seed) | 0) ^ 0x1d1e) | 0;
      this.events = []; this.lastK = null; this.ctx = null; this.ctxT = 0; this.time = 0; this.rainT = -1e9;
      this.lamps = { at: null, list: [], scan: null, done: false };
      this.on = true; this.tier = 2; this.history = [];
      this.st = { started: 0, kinds: {}, lit: 0, lamps: 0, place: '', hour: '', pick: null, slot: 0, filled: 0 };
      // f-flow: the acts started ([t, kind], the rotation's memory), the last start, a slot waiting for the pace, the cart's
      // wait, the end of a fly-by's moment (nothing else meanwhile), the idle check's clock
      this.acts = []; this.lastStart = 0; this.pend = null; this.cartPend = 0; this.flyUntil = 0; this.idleT = 1; this.fillN = 0;
    }
    // ---- f-flow: the director's pace — may an act start now: 15 s after the last start and the last weighted event seen
    // (EventLog), not during a wow moment, not before a fly-by's pass is over
    calm() { return !!this.on; }
    sinceSeen() { const L = VR.EventLog; return L && L.on !== false && L.sinceSeen ? L.sinceSeen(2, true) : Infinity; }
    paced() {
      const t = this.time, R = LD.ROT;
      if (t - this.lastStart < R.pace || t < this.flyUntil) return false;
      if (this.g.wow && this.g.wow.active) return false;
      return this.sinceSeen() >= R.pace;
    }
    // the acts in order until one starts (one may find no place), within the cap of acts at once
    play(order, o) {
      if (this.events.length >= (this.tier >= 2 ? 4 : 2)) return null;
      for (let i = 0; i < order.length && i < 5; i++) { const kind = order[i]; if (this.events.some(e => e.kind === kind)) continue; const ev = this.start(kind, o); if (ev) return ev; }
      return null;
    }
    // nothing started and nothing seen for ROT.idle s: the next thing worth seeing now — t-wild's animal in view first (it
    // is there now), else the rotation's next act (the next slot's, pulled forward)
    idle(ctx) {
      const t = this.time, R = LD.ROT;
      if (Math.min(t - this.lastStart, this.sinceSeen()) < R.idle || t < this.flyUntil || this.pend || (this.g.wow && this.g.wow.active)) return;
      const k = (this.lastK || 0) + 1, order = LD.order(this.seed, k, LD.candidates(ctx), this.acts, t, LD.pick(this.seed, k, ctx));
      const wild = order.filter(c => LD.WILD[c]), rest = order.filter(c => !LD.WILD[c]);
      const ev = this.play(wild.concat(rest), { k: 700000 + k * 16 + (this.fillN++ & 15) });
      if (ev) this.st.filled++;
      else this.lastStart = t - R.idle + 5;   // (nothing could start: again in 5 s)
    }
    // the act a coming slot k will play: the rotation replayed from the acts so far (no pacing, no wild sighting)
    forecast(k) {
      const ctx = this.ctx; if (!ctx) return null;
      if (this.lastK === null) return LD.pick(this.seed, k, ctx);
      const C = LD.candidates(ctx); if (!C.length) return null;
      const hist = this.acts.slice(-24), last = this.history.length ? this.history[this.history.length - 1] : null;
      let kind = null, prev = last && last[0] === this.lastK ? last[1] : null;
      for (let j = this.lastK + 1; j <= k; j++) {
        // (as slot() chooses: its own pick unless the previous slot's, the rotation's order, never the previous slot's)
        let own = LD.pick(this.seed, j, ctx); if (own && own === prev) own = null;
        const t = this.time + (LD.slotTime(this.seed, j) - this.clock), order = LD.order(this.seed, j, C, hist, t, own);
        kind = null; for (const c of order) if (c !== prev && !LD.WILD[c]) { kind = c; break; }
        if (kind) hist.push([t, kind]);
        prev = kind;
      }
      return kind;
    }
    // where the eye will be in t seconds at its present pace (a walking player is 60 m on when a pass comes)
    ahead(t) {
      const p = this.g.player.pos, v = this.g.player.vel, sp = v ? Math.hypot(v[0], v[2]) : 0;
      if (!(sp > 0.5) || !(t > 0)) return [p[0], p[1], p[2]];
      const k = Math.min(sp, 8) * t / sp;
      return [p[0] + v[0] * k, p[1], p[2] + v[2] * k];
    }
    // t-wild's animals near and in view (the stage of 'heron', 'rays', 'murm'): in the view's cone, at a distance
    inSight(p, minD, maxD, cone) {
      const e = this.eye, dx = p[0] - e[0], dy = p[1] - e[1], dz = p[2] - e[2], dh = Math.hypot(dx, dz), d = Math.hypot(dh, dy);
      if (!(d >= minD && d <= maxD)) return false;
      const f = this.fwd, fw = dx * f[0] + dz * f[1]; if (fw <= 0) return false;
      if (Math.abs(dx * -f[1] + dz * f[0]) > fw * this.tanH * (cone || 0.85)) return false;
      const half = ((this.g.settings && this.g.settings.fov) || 70) * Math.PI / 360;
      return Math.abs(Math.atan2(dy, dh)) <= half * 0.9;
    }
    wildHeron() {
      const W = this.g.wild; if (!W || !W.herons || !W.herons.length) return null;
      for (const H of W.herons) if (H && H.state === 'stand' && H.pos && this.inSight(H.pos, 12, 45) && this.seen(H.pos, 0.8)) return H;
      return null;
    }
    wildRay() {
      const W = this.g.wild; if (!W || !W.rays || !W.rays.length) return null;
      for (let i = 0; i < W.rays.length; i++) { const R = W.rays[i]; if (R && this.inSight(R, 20, 260)) return { i, pos: [R[0], R[1], R[2]], r: Math.max(4, (R[7] || 16) * 0.5) }; }
      return null;
    }
    wildMurm() {
      const W = this.g.wild, Mu = W && W.murm; if (!Mu || Mu.state !== 'fly' || !Mu.fl || !Mu.fl.ctr) return null;
      const c = Mu.fl.ctr; if (!this.inSight(c, 20, 420, 1)) return null;
      return { pos: [c[0], c[1], c[2]], r: Math.max(8, Mu.fl.spread ? Mu.fl.spread() : 20) };
    }
    // ---- f-flow end
    // ---- what the acts read
    get E() { return (this.g.env && this.g.env.E) || {}; }
    get P() { return this.g.particles; }
    get audio() { return this.g.audio; }
    get eye() { const p = this.g.player.pos; return [p[0], p[1] + 1.62, p[2]]; }
    get fwd() { const c = this.g.cam, y = c ? c.yaw : this.g.player.yaw; return [-Math.sin(y), -Math.cos(y)]; }
    get dtLife() { return (this.dt || 0.033) * 1.5 + 1e-4; }
    near(p, d) { const e = this.g.player.pos; return Math.hypot(p[0] - e[0], p[2] - e[2]) < d; }
    get(x, y, z) { return this.g.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); }
    solid(b) { const R = VR.R, F = VR.F; return !!(b && (R.T.flags[b] & F.SOLID) && !(R.T.flags[b] & F.REPLACE)); }
    top(x, z) { const w = this.g.world; return w && w.topAt ? w.topAt(Math.floor(x), Math.floor(z)) : 80; }
    // the stand height at (x, z) near y0: the first solid block (from 6 above down to 10 below) with two free above it
    ground(x, z, y0) { for (let y = Math.floor(y0) + 6; y > y0 - 10; y--) { if (this.solid(this.get(x, y, z)) && !this.solid(this.get(x, y + 1, z)) && !this.solid(this.get(x, y + 2, z))) return y + 1; } return null; }
    // open level ground around a point dist ahead (ang: off the view): [x, y, z] or null. Where that spot is taken (café
    // tables and chairs in a street, a step, a planter) the next ones are tried — further on, nearer, straight ahead, to
    // either side within the view — in a fixed order (every guest finds the same spot)
    openGround(dist, ang, rad) {
      const f = this.fwd, a0 = Math.atan2(f[1], f[0]), eye = this.eye;
      for (const dd of [dist, dist + 4, dist + 8, Math.max(4, dist - 4)]) for (const aa of [ang, 0, -ang, 0.55, -0.55]) {
        if (aa === -ang && ang === 0) continue;
        const a = a0 + aa, x = eye[0] + Math.cos(a) * dd, z = eye[2] + Math.sin(a) * dd;
        const y = this.ground(x, z, eye[1] - 1.6); if (y === null) continue;
        let ok = true;   // (two rings round it: the rim and half way in)
        for (let k = 0; k < 16 && ok; k++) { const b = k / 8 * TAU + (k >= 8 ? 0.4 : 0), r = k < 8 ? rad : rad * 0.5, gy = this.ground(x + Math.cos(b) * r, z + Math.sin(b) * r, y); if (gy === null || Math.abs(gy - y) > 0.01) ok = false; }
        if (ok) return [x, y, z];
      }
      return null;
    }
    // a walkable run across the view dist ahead (≥ min metres): its points, or null
    runAcross(dist, min) {
      const f = this.fwd, eye = this.eye, cx = eye[0] + f[0] * dist, cz = eye[2] + f[1] * dist, sx = -f[1], sz = f[0];
      const y0 = this.ground(cx, cz, eye[1] - 1.6); if (y0 === null) return null;
      const side = (sg) => { const out = []; let y = y0; for (let k = 1; k <= 26; k++) { const x = cx + sx * k * sg, z = cz + sz * k * sg, gy = this.ground(x, z, y); if (gy === null || Math.abs(gy - y) > 1.01 || this.solid(this.get(x, gy + 1, z)) || this.solid(this.get(x + sz, gy, z - sx)) && this.solid(this.get(x - sz, gy, z + sx))) break; y = gy; out.push([x, gy, z]); } return out; };
      const a = side(-1).reverse(), b = side(1), run = a.concat([[cx, y0, cz]], b);
      return run.length >= min ? run : null;
    }
    // the tangent of half the view's width (the settings' vertical fov, the canvas's aspect)
    get tanH() { const g = this.g, fov = (g.settings && g.settings.fov) || 70, r = g.renderer, asp = r && r.W && r.H ? r.W / r.H : 16 / 9; return Math.tan(fov * Math.PI / 360) * asp; }
    // a run across the view dist ahead cut to the view's width and 3 m beyond it (t-polish: an act along it is seen at once)
    inView(run, dist) {
      const f = this.fwd, eye = this.eye, sx = -f[1], sz = f[0], lim = dist * this.tanH + 3;
      return run.filter(p => Math.abs((p[0] - eye[0]) * sx + (p[2] - eye[2]) * sz) <= lim);
    }
    // a walkable run along the view, off to one side by off metres, from 3 to 40 m ahead (≥ min metres), and on from there
    // past the eye to 6 m behind it while it can (t-polish: so what comes along it goes on behind you, not out of sight 3 m
    // in front of you): its points from behind to ahead, or null
    runAlong(off, min) {
      const f = this.fwd, eye = this.eye, sx = -f[1], sz = f[0];
      const y3 = this.ground(eye[0] + sx * off + f[0] * 3, eye[2] + sz * off + f[1] * 3, eye[1] - 1.6); if (y3 === null) return null;
      const walk = (k0, k1, dk) => {
        const out = []; let y = y3;
        for (let k = k0; dk > 0 ? k <= k1 : k >= k1; k += dk) {
          const x = eye[0] + sx * off + f[0] * k, z = eye[2] + sz * off + f[1] * k, gy = this.ground(x, z, y);
          if (gy === null || Math.abs(gy - y) > 1.01 || this.solid(this.get(x, gy + 1, z)) || this.solid(this.get(x + sx * 0.8, gy, z + sz * 0.8)) || this.solid(this.get(x - sx * 0.8, gy, z - sz * 0.8))) break;
          y = gy; out.push([x, gy, z]);
        }
        return out;
      };
      const ahead = walk(3, 40, 1);
      return ahead.length >= min ? walk(2, -6, -1).reverse().concat(ahead) : null;
    }
    // is a point seen from the eye: nothing solid on the line from the eye to dy over it (a wall, a trunk, a post, glass,
    // leaves; t-polish: a cart's run "in the frame" ran behind the shop fronts and the palms)
    seen(p, dy) {
      const e = this.eye, T = VR.R.T, F = VR.F, M = F.SOLID | F.FULL | F.LEAVES;
      const dx = p[0] - e[0], dyy = p[1] + (dy === undefined ? 1.2 : dy) - e[1], dz = p[2] - e[2], n = Math.ceil(Math.hypot(dx, dyy, dz) / 0.4);
      for (let i = 1; i < n - 1; i++) { const t = i / n, b = this.get(e[0] + dx * t, e[1] + dyy * t, e[2] + dz * t); if (b && (T.flags[b] & M) && !(T.flags[b] & F.REPLACE)) return false; }
      return true;
    }
    // the longest stretch of a run the eye sees (passing behind a post or a trunk: up to two points unseen in a row), with
    // two points more at each end (out from behind what hid it, and behind it again): its points, or null when fewer than
    // min of them are seen (a cart's upper half, 1.2 m over its ground)
    seenPart(run, min) {
      const v = run.map(p => this.seen(p, 1.2));
      let best = null;
      for (let i = 0; i < run.length; i++) {
        if (!v[i]) continue;
        let last = i, n = 0, gap = 0;
        for (let j = i; j < run.length; j++) { if (v[j]) { last = j; n++; gap = 0; } else if (++gap > 2) break; }
        if (!best || n > best.n) best = { a: i, b: last, n };
        i = last;
      }
      if (!best || best.n < min) return null;
      return run.slice(Math.max(0, best.a - 2), Math.min(run.length, best.b + 3));
    }
    // a wall top in front (1–3 blocks over the ground on your side) the cat can sit and walk on: {path, away}
    wallTop(ev) {
      const f = this.fwd, eye = this.eye, fa = Math.atan2(f[1], f[0]), feet = eye[1] - 1.62;
      for (let i = 0; i < 9; i++) {
        const ang = fa + ((i & 1) ? 1 : -1) * Math.ceil(i / 2) * 0.22 + (rnd(ev, 3) - 0.5) * 0.1;
        for (let d = 6; d <= 17; d++) {
          const x = Math.floor(eye[0] + Math.cos(ang) * d), z = Math.floor(eye[2] + Math.sin(ang) * d);
          const gy = this.ground(x + 0.5, z + 0.5, feet + 3);
          if (gy === null || gy - feet < 1 || gy - feet > 3.2) continue;
          // the cell one step back toward the eye is lower by a block or more (a wall's face)
          const bx = Math.floor(x + 0.5 - Math.cos(ang) * 1.2), bz = Math.floor(z + 0.5 - Math.sin(ang) * 1.2), by = this.ground(bx + 0.5, bz + 0.5, gy);
          if (by !== null && by > gy - 1) continue;
          // along the wall: the cells either side at the same height
          const path = [[x + 0.5, gy, z + 0.5]], sx = Math.round(-Math.sin(ang)), sz = Math.round(Math.cos(ang));
          for (const sg of [1, -1]) for (let k = 1; k <= 3; k++) { const px = x + sx * k * sg, pz = z + sz * k * sg, py = this.ground(px + 0.5, pz + 0.5, gy); if (py !== gy) break; if (sg > 0) path.push([px + 0.5, gy, pz + 0.5]); else path.unshift([px + 0.5, gy, pz + 0.5]); }
          return { path, away: [Math.cos(ang), Math.sin(ang)] };
        }
      }
      return null;
    }
    // a bank by the water within 14 blocks: {pos (on the bank), water (the surface in front), out (toward the water)}
    bank(ev) {
      const eye = this.eye, R = VR.R, F = VR.F, fa = Math.atan2(this.fwd[1], this.fwd[0]);
      for (let i = 0; i < 24; i++) {
        const a = fa + (i / 24 - 0.5) * 2.4 + (rnd(ev, 5) - 0.5) * 0.1;
        for (let d = 3; d <= 14; d++) {
          const x = eye[0] + Math.cos(a) * d, z = eye[2] + Math.sin(a) * d, t = Math.floor(this.top(x, z)), b = this.get(x, t, z);
          if (!(R.T.flags[b] & F.WATER)) continue;
          const bx = eye[0] + Math.cos(a) * (d - 1), bz = eye[2] + Math.sin(a) * (d - 1), gy = this.ground(bx, bz, t + 1);
          if (gy === null || gy > t + 2.2 || gy < t) continue;
          return { pos: [bx, gy, bz], water: [x, t + 0.9, z], out: [Math.cos(a), Math.sin(a)] };
        }
      }
      return null;
    }
    // the nearest active village and its pieces
    village() { const c = this.ctx; return c ? c.vil : null; }
    fountain() { const v = this.village(); if (!v || !v.plaza) return null; const P = v.plaza; if (!this.near([P.x, 0, P.z], 45)) return null; return [P.x + 0.5, P.y, P.z + 0.5]; }
    townCentre() { const v = this.village(); if (v && v.plaza) return [v.plaza.x + 0.5, v.plaza.y, v.plaza.z + 0.5]; if (this.ctx && this.ctx.place === 'hangar') return [0.5, 81, 60]; return null; }
    chimneyList() {
      const v = this.village(); if (!v || !v.plan.chimneys) return [];
      const e = this.g.player.pos, f = this.fwd;
      return v.plan.chimneys.filter(c => c && Math.hypot(c[0] - e[0], c[2] - e[2]) < 90).map(c => ({ c, s: Math.hypot(c[0] - e[0], c[2] - e[2]) - 40 * (((c[0] - e[0]) * f[0] + (c[2] - e[2]) * f[1]) / (Math.hypot(c[0] - e[0], c[2] - e[2]) || 1)) })).sort((a, b) => a.s - b.s).map(o => o.c);
    }
    // the street lamps near the eye: the scan of the lamp posts around (incremental) and the village's lamps that stand in
    // the open (six blocks of air over their heads: not a home's light)
    lampList() {
      const out = this.lamps.list.slice(), e = this.g.player.pos, v = this.village();
      if (v && v.plan.lamps) for (const l of v.plan.lamps) {
        if (!l || Math.hypot(l[0] - e[0], l[2] - e[2]) > 40 || Math.abs(l[1] - e[1]) > 9) continue;
        let open = true; for (let y = 1; y <= 6 && open; y++) if (this.solid(this.get(l[0], l[1] + y, l[2]))) open = false;
        if (open && !out.some(o => Math.abs(o[0] - l[0] - 0.5) < 1.5 && Math.abs(o[2] - l[2] - 0.5) < 1.5)) out.push([l[0] + 0.5, l[1] + 0.7, l[2] + 0.5]);
      }
      return out;
    }
    scanLamps(dt) {
      const L = this.lamps, e = this.g.player.pos, R0 = 30;
      if (!L.at || Math.hypot(L.at[0] - e[0], L.at[2] - e[2]) > 14) { L.at = e.slice(); L.scan = { i: 0, found: [] }; }
      const S = L.scan; if (!S) return;
      const W = 2 * R0 + 1, N = W * W, R = VR.R, w = this.g.world, y0 = Math.floor(L.at[1]) - 3, y1 = y0 + 10;
      for (let n = 0; n < 160 && S.i < N; n++, S.i++) {
        const x = Math.floor(L.at[0]) - R0 + (S.i % W), z = Math.floor(L.at[2]) - R0 + Math.floor(S.i / W);
        for (let y = y1; y >= y0; y--) { const b = w.getBlock(x, y, z); if (b && lampType(R.T.type[b])) { S.found.push([x + 0.5, y + 0.75, z + 0.5]); break; } }
      }
      if (S.i >= N) { L.list = S.found; L.scan = null; }
      void dt;
    }
    // the context of this moment: the place, the hour, the weather, a festival, the tier, what is near
    context() {
      const g = this.g, p = g.player.pos, E = this.E;
      const info = { heart: !!(g.meta && (g.meta.vgen | 0) >= 3 && g.meta.type !== 'flat'), villages: [], water: false };
      let vil = null, vd = 1e9;
      if (g.villages && g.villages.known) for (const V of g.villages.known.values()) { const P = V.plan; if (!P) continue; const d = Math.hypot(P.x - p[0], P.z - p[2]); if (d < 300) { const rec = { x: P.x, z: P.z, rad: P.rad || (P.style === 'hall' ? 150 : 75), style: P.style, plaza: P.plaza, plan: P }; info.villages.push(rec); if (d < vd) { vd = d; vil = rec; } } }
      // water at the surface near the eye (eight columns round it)
      const R = VR.R, F = VR.F;
      for (let k = 0; k < 8 && !info.water; k++) { const a = k / 8 * TAU, x = p[0] + Math.cos(a) * 7, z = p[2] + Math.sin(a) * 7, t = this.top(x, z), b = this.get(x, t, z); if (b && (R.T.flags[b] & F.WATER)) info.water = true; }
      const place = LD.placeOf(p, info), tod = g.env ? g.env.timeOfDay : 6000, hour = LD.hourOf(tod);
      const wet = (E.rain || 0) > 0.15 || (E.snow || 0) > 0.15;
      const fest = !!(g.villages && g.villages.festivalNear && g.villages.festivalNear());
      const has = { lamps: place === 'plaza' || place === 'street' || place === 'hall' || place === 'hangar', chimneys: !!(vil && vil.plan.chimneys && vil.plan.chimneys.some(c => c && Math.hypot(c[0] - p[0], c[2] - p[2]) < 90)), fountain: !!(vil && vil.plaza && Math.hypot(vil.plaza.x - p[0], vil.plaza.z - p[2]) < 45), water: info.water };
      if (this.tier >= 2 && g.wild && g.wild.on !== false) { has.heron = !!this.wildHeron(); has.rays = !!this.wildRay(); has.murm = !!this.wildMurm(); }   // (f-flow: t-wild's animals in view)
      return { place, hour, tod, wet, fest, tier: this.tier, has, vil };
    }
    update(dt) {
      const g = this.g, S = g.settings || {};
      this.clock += dt; this.time += dt; this.dt = dt;
      this.on = S.lifeDir !== false && g.state === 'play' && (g.dim || 'overworld') === 'overworld' && !!g.player && !!g.world && !!g.particles;
      this.tier = LK.tierOf(S);
      if (!this.on) { this.events.length = 0; return; }
      if ((this.ctxT -= dt) <= 0) { this.ctxT = 1; this.ctx = this.context(); this.st.place = this.ctx.place; this.st.hour = this.ctx.hour; }
      const ctx = this.ctx;
      if (ctx.hour === 'dusk' && ctx.has.lamps) this.scanLamps(dt);
      const k = LD.slotAt(this.seed, this.clock);
      if (this.lastK === null) this.lastK = k;            // (the first act comes with the next slot)
      else if (k > this.lastK) { this.lastK = k; if (this.auto !== false) this.slot(k); }   // (auto false: only forced acts — a test)
      // t-polish: the streets' regular — by day in a town a cart on its own clock (28–40 s apart), one at a time (f-flow:
      // it keeps its clock but waits up to 15 s for the pace, and the rotation lets one come a minute)
      const ck = LD.cartAt(this.seed, this.clock);
      if (this.lastCart === undefined) this.lastCart = ck;
      else if (ck > this.lastCart) { this.lastCart = ck; if (this.auto !== false && LD.cartRegular(ctx)) this.cartPend = this.time + LD.ROT.wait; }
      if (this.cartPend) {
        if (this.time > this.cartPend || !LD.cartRegular(ctx) || this.events.some(e => e.kind === 'cart') || !LD.okNow('cart', this.acts, this.time)) this.cartPend = 0;
        else if (this.paced()) { this.cartPend = 0; this.start('cart', { k: 900000 + ck }); }
      }
      // f-flow: a slot waiting for the pace (a newer slot replaces it); the idle fill, once a second
      if (this.pend && (this.time > this.pend.until || this.pend.k < this.lastK)) this.pend = null;
      if (this.pend && this.auto !== false && this.paced()) { const q = this.pend; this.pend = null; this.play(LD.order(this.seed, q.k, LD.candidates(ctx), this.acts, this.time, q.first), { k: q.k }); }
      if (this.auto !== false && (this.idleT -= dt) <= 0) { this.idleT = 1; this.idle(ctx); }
      const e0 = g.player.pos;
      for (let i = this.events.length - 1; i >= 0; i--) {
        const ev = this.events[i], A = ACT[ev.kind];
        ev.age += dt;
        let alive;
        // (an act above the tier ends at once — Very Low chosen while it runs; an act the eye has left 200 blocks behind
        // ends too: a flight, a teleport — unless the eye is near the act itself, the balloon it flew to)
        const far = Math.hypot(e0[0] - ev.eye0[0], e0[2] - ev.eye0[2]) > 200 && !(ev.pos && Math.hypot(e0[0] - ev.pos[0], e0[2] - ev.pos[2]) < 150);
        if (LD.ACTS[ev.kind].tier > this.tier || far) alive = false;
        else try { alive = A.update(this, ev, dt) !== false && ev.age < ev.dur; } catch (e) { alive = false; if (!this.warned) { this.warned = true; console.warn('life director', ev.kind, e); } }
        if (!alive) { if (A.end) A.end(this, ev); this.events.splice(i, 1); }
      }
    }
    slot(k) {
      const ctx = this.ctx; if (!ctx) return;
      let kind = LD.pick(this.seed, k, ctx);
      // (the place or the hour changed since the last slot — its neighbours were picked for another context: the slot
      // after the same act stays quiet, so it never comes twice in a row)
      const last = this.history.length ? this.history[this.history.length - 1] : null;
      const prev = last && last[0] === k - 1 ? last[1] : null;
      if (kind && kind === prev) kind = null;
      // f-flow: the rotation — the slot's own pick first when it may come, else the least recently played (never the
      // previous slot's); the slot waits for the pace
      const order = LD.order(this.seed, k, LD.candidates(ctx), this.acts, this.time, kind).filter(c => c !== prev);
      const first = order.length ? order[0] : null;
      this.st.pick = first; this.st.slot = k;
      this.history.push([k, first, ctx.place, ctx.hour]); if (this.history.length > 40) this.history.shift();
      if (!first) return;
      if (!this.paced()) { this.pend = { k, first, until: this.time + LD.ROT.wait }; return; }
      this.play(order, { k });
    }
    start(kind, o) {
      const A = ACT[kind], R = LD.ACTS[kind]; if (!A || !R) return null;
      const k = o && o.k !== undefined ? o.k : (this.lastK || 0) * 64 + 17 + this.events.length;
      const ev = { kind, k, seed: (Math.floor(h(this.seed, k, 0x9e1) * 4294967295) | 0), age: 0, dur: R.dur, eye0: this.g.player.pos.slice() };
      let ok;
      try { ok = A.start(this, ev) !== false; } catch (e) { ok = false; console.warn('life director', kind, e); }
      if (!ok) return null;
      this.events.push(ev); this.st.started++; this.st.kinds[kind] = (this.st.kinds[kind] || 0) + 1;
      // f-flow: the rotation's memory, the pace's clock, a fly-by's moment (its pass ~eta s on, and 8 s after it)
      this.acts.push([this.time, kind]); if (this.acts.length > 48) this.acts.shift();
      this.lastStart = this.time;
      if (LD.FLY[kind]) this.flyUntil = this.time + (ev.eta || 14) + 8;
      if (VR.EventLog) VR.EventLog.act(ev, this);   // e-log: an act begins (eventlog.js, the never-boring measure)
      return ev;
    }
    // start an act now (a camera director, the picture tests): look = a point to face first
    force(kind, o) {
      if (!this.on && this.g.settings && this.g.settings.lifeDir === false) return false;
      this.ctx = this.context();
      if (kind === 'lanterns') { const L = this.lamps; L.at = null; for (let i = 0; i < 400 && (!L.at || L.scan); i++) this.scanLamps(0); }
      return !!this.start(kind, o || {});
    }
    draw(r, E, layer, cam) {
      if (!this.on || layer !== 'opaque' || !this.events.length) return;
      const g = this.g, ent = g.entities; if (!ent) return;
      let p = null; const prog = () => p || (p = ent.beginVox(r, E));
      cam = cam || r.cam;
      for (const ev of this.events) { const A = ACT[ev.kind]; if (A.draw) { try { A.draw(this, ev, r, E, cam, prog); } catch (e) { if (!this.warnedD) { this.warnedD = true; console.warn('life director draw', ev.kind, e); } } } }
    }
    stats() {
      const kinds = {}; for (const ev of this.events) kinds[ev.kind] = (kinds[ev.kind] || 0) + 1;
      return { kinds, started: this.st.started, startedKinds: Object.assign({}, this.st.kinds), lit: this.st.lit || 0, lamps: this.st.lamps || 0, place: this.st.place, hour: this.st.hour, pick: this.st.pick, slot: this.st.slot, lampsSeen: this.lamps.list.length, history: this.history.slice(-6), filled: this.st.filled, acts: this.acts.slice(-12) };
    }
    destroy() { this.events.length = 0; }
  };
})(VR);
