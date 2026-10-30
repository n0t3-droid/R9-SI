// ============================================================================
// a-life · VR.Ferries — life between the worlds (plan docs/superpowers/plans/2026-10-30-a-life.md; waves §7.4).
//   · the moons' settlements: on Basalt and Opal a settlement is founded on the player's first landing (nothing on a moon
//     needs a fight: the Friedlich rule of the spec for every world) — 40–90 m from where you came down, or beside your
//     home when you live there (u-home's „Hier wohne ich"). It is a village plan (villages.js addVillage): its families,
//     its builders raising one home after another (domes on Basalt, ice-block halls on Opal), a greenhouse to tend, a
//     plaza with lamps, two ferry pads and the dock. Over three game days it grows (lots unlocked by day; the greenhouses
//     and the lamps come as prefabs, raised block by block while you watch); a home on that moon brings two neighbours
//   · the ferries: per route and dock a PadLife pad (padlife.js) with a stay of 110–230 s — one departure every 120–240 s
//     on the world's clock, the same for the host and the guests. [V] at the dock: the panel → aboard → the chase view
//     over the lift and the climb-out → VR.Travel to the other dock → the arrival shot over its pad
//   · the traffic between the worlds: ferries, freighters and small craft on the routes (Herzwelt, the moons, Aquamarin,
//     the swarm), flown by the cruise law (slow near the bodies, fast between), drawn in the space scene as nav lights,
//     a hull glint and an engine streak — from orbit and in the cruise. The star map's home card: the trade routes
//   Pure part above the line (node: test/ferries.js); the game's glue below it.
// Cost 🟢: the settlement is blocks and villagers (their LOD); the ferries are PadLife's tiers (Very Low: the craft only);
// the space traffic one instanced draw (Very Low ≤ 16 craft, else ≤ 64). Switch: ⚙ Spiel „Leben zwischen den Welten"
// (spaceLife) — off: no ferries, no traffic, no new settlement (the built ones stay as blocks).
// ============================================================================
(function (VR) {
  'use strict';
  const Fe = VR.Ferries = VR.Ferries || {};
  const PL = () => VR.PadLife, LKf = () => VR.LifeKit;
  const TAU = Math.PI * 2;
  const hh = (a, b, c) => { let h = Math.imul((a | 0) ^ 0x2c1b3c6d, 0x297a2d39) ^ Math.imul((b | 0) + 0x632be5ab, 0x85ebca6b) ^ Math.imul((c | 0) + 0x5bd1e995, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
  const strHash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ================================================================ the routes and the schedule (pure)
  // a: b: the worlds' dims (overworld = Herzwelt); body: the body each dim is in space; ferry: rideable (a dock each end)
  Fe.ROUTES = [
    { id: 'herz-basalt', a: 'overworld', b: 'basalt', ferry: true },
    { id: 'herz-opal', a: 'overworld', b: 'opal', ferry: true },
    { id: 'basalt-opal', a: 'basalt', b: 'opal', ferry: true },
    { id: 'herz-aqua', a: 'overworld', b: 'aqua' },
    { id: 'herz-swarm', a: 'overworld', b: 'swarm' },
    { id: 'opal-swarm', a: 'opal', b: 'swarm' },
  ];
  Fe.BODY = { overworld: 'herz', basalt: 'basalt', opal: 'opal', aqua: 'aqua', swarm: 'swarm' };
  Fe.MOONS = ['basalt', 'opal'];
  Fe.route = (id) => Fe.ROUTES.find(r => r.id === id) || null;
  Fe.routesAt = (dim) => Fe.ROUTES.filter(r => r.ferry && (r.a === dim || r.b === dim));
  Fe.other = (r, dim) => (r.a === dim ? r.b : r.a);
  // a dock's stay: 110–230 s + PadLife's 10-s gap → a departure every 120–240 s
  Fe.FERRY_O = { stay0: 110, stay1: 230 };
  Fe.padSeed = (route, dim, wseed) => (strHash(route + '@' + dim) ^ Math.imul(wseed | 0, 0x9e3779b1)) | 0;
  // the departures (the lift) of a route's ferry from the dock on `dim` within [t0, t1)
  Fe.departures = function (route, dim, wseed, t0, t1) {
    const P = PL(), seed = Fe.padSeed(route, dim, wseed), o = Fe.FERRY_O, out = [];
    const c = P.visitAt(seed, t0, null, o);
    let n = c.n, T = c.T;
    // (the visit before may still be on the pad: its lift is T − GAP)
    for (let k = -1; k < 4000; k++) {
      const m = n + k, Tm = k < 0 ? T - P.stay(seed, n - 1, o) - P.GAP : T, L = Tm + P.stay(seed, m, o);
      if (k >= 0) T = T + P.stay(seed, m, o) + P.GAP;
      if (L >= t1) break;
      if (L >= t0) out.push(L);
    }
    return out;
  };
  // the ferry at a dock at clock t: {parked (a ferry stands there now), dep (its next lift), land (the next touchdown), m}
  Fe.next = function (route, dim, wseed, t, cache) {
    const P = PL(), seed = Fe.padSeed(route, dim, wseed), o = Fe.FERRY_O;
    if (cache && cache.seed !== seed) { cache.seed = seed; cache.c = null; }
    const c = P.visitAt(seed, t, cache ? cache.c : null, o); if (cache) cache.c = c;
    const L = c.T + P.stay(seed, c.n, o);
    if (t >= c.T && t < L) return { parked: true, dep: L, land: c.T, m: c.n };
    const T1 = t < c.T ? c.T : L + P.GAP;
    return { parked: false, dep: T1 + P.stay(seed, t < c.T ? c.n : c.n + 1, o), land: T1, m: t < c.T ? c.n : c.n + 1 };
  };

  // ================================================================ the traffic (pure)
  Fe.TRIP = { ferry: 150, freighter: 260, small: 110 };   // s from one world to the other
  Fe.SLOT = { freighter: 90, small: 60 };                 // s between launches per route and direction (jittered)
  Fe.CAP = [16, 40, 64, 64, 64];                          // craft at once by tier (Very Low … Ultra)
  const KIND_N = { ferry: 0, freighter: 1, small: 2 };
  // the craft between the worlds at clock t → out [{route, kind, u (0 … 1 from a to b), dir (+1 a→b, −1), lat, seed}]
  Fe.traffic = function (t, wseed, tier, out) {
    out = out || []; out.length = 0;
    const cap = Fe.CAP[clamp(tier | 0, 0, 4)], thin = (tier | 0) <= 0 ? 0.3 : 1;
    const push = (r, ri, kind, t0, dir, k) => {
      const u = (t - t0) / Fe.TRIP[kind]; if (!(u >= 0 && u <= 1)) return;
      if (out.length >= cap) return;
      out.push({ route: r.id, kind, u: dir > 0 ? u : 1 - u, dir, lat: hh(ri * 7 + KIND_N[kind], k, dir > 0 ? 31 : 37) * 2 - 1, seed: (Math.imul(ri + 1, 0x51ed27) ^ Math.imul(k | 0, 0x2545f491) ^ (dir > 0 ? 0 : 0x5bd1) ^ KIND_N[kind]) >>> 0 });
    };
    // the ferries first: they leave the docks on the docks' schedule
    Fe.ROUTES.forEach((r, ri) => {
      if (!r.ferry) return;
      for (const dir of [1, -1]) { const from = dir > 0 ? r.a : r.b; for (const d of Fe.departures(r.id, from, wseed, t - Fe.TRIP.ferry, t + 1e-9)) push(r, ri, 'ferry', d, dir, Math.round(d)); }
    });
    for (const kind of ['freighter', 'small']) Fe.ROUTES.forEach((r, ri) => {
      const S = Fe.SLOT[kind], tr = Fe.TRIP[kind];
      for (const dir of [1, -1]) {
        const ph = hh(ri, KIND_N[kind], dir) * S, k1 = Math.floor((t - ph) / S);
        for (let k = k1; k > k1 - Math.ceil(tr / S) - 2; k--) {
          if (thin < 1 && hh(ri * 3 + dir, k, KIND_N[kind] + 77) >= thin) continue;
          push(r, ri, kind, ph + k * S + hh(ri * 5 + dir, k, KIND_N[kind] + 3) * S * 0.6, dir, k);
        }
      }
    });
    return out;
  };
  // the craft in low orbits round the inhabited worlds (waiting for their slot, servicing, coming and going): per body
  // 2 (Very Low) or 6, 4–30 km up, each on its own plane, a lap in 6–14 minutes → out [{body, kind, n, e1, e2, r (×R), th}]
  Fe.ORBIT_AT = ['herz', 'basalt', 'opal', 'aqua'];
  Fe.orbiters = function (t, wseed, tier, out) {
    out = out || []; out.length = 0;
    const per = (tier | 0) <= 0 ? 2 : 6;
    Fe.ORBIT_AT.forEach((b, bi) => {
      for (let i = 0; i < per; i++) {
        const r = (j) => hh((wseed | 0) + bi * 977, i, j);
        const z = r(1) * 2 - 1, a = r(2) * TAU, q = Math.sqrt(1 - z * z), n = [q * Math.cos(a), z, q * Math.sin(a)];
        const ax = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], d0 = ax[0] * n[0] + ax[1] * n[1] + ax[2] * n[2];
        let e1 = [ax[0] - n[0] * d0, ax[1] - n[1] * d0, ax[2] - n[2] * d0]; const l1 = Math.hypot(e1[0], e1[1], e1[2]); e1 = [e1[0] / l1, e1[1] / l1, e1[2] / l1];
        const e2 = [n[1] * e1[2] - n[2] * e1[1], n[2] * e1[0] - n[0] * e1[2], n[0] * e1[1] - n[1] * e1[0]];
        const lap = 360 + r(3) * 480, th = r(4) * TAU + TAU * t / lap;
        out.push({ body: b, kind: r(5) < 0.3 ? 'freighter' : 'small', n: i, e1, e2, alt: 4000 + r(6) * 26000, th, seed: (Math.imul(bi + 11, 0x51ed27) ^ i) >>> 0 });
      }
    });
    return out;
  };
  // the cruise law along a route: a craft leaves A's surface H0 up, its distance to the nearer surface growing
  // exponentially to the half-way point, then the same down to B (U§5.5: speed ∝ the distance to the nearest surface);
  // lat (−1 … 1) its lane beside the line. pa, pb: the bodies' centres (m); ra, rb: their radii → out (m)
  Fe.H0 = 8000;
  const UP = [0, 1, 0];
  Fe.along = function (pa, ra, pb, rb, u, lat, out) {
    out = out || [0, 0, 0];
    const dx = pb[0] - pa[0], dy = pb[1] - pa[1], dz = pb[2] - pa[2], D = Math.hypot(dx, dy, dz) || 1, ex = dx / D, ey = dy / D, ez = dz / D;
    const L = Math.max(2 * Fe.H0 + 1, D - ra - rb), Lh = L / 2, k = Math.log(Lh / Fe.H0);
    const x = u <= 0.5 ? Fe.H0 * Math.exp(k * 2 * u) : L - Fe.H0 * Math.exp(k * 2 * (1 - u));
    // the lane: sideways (across the line and the ecliptic's up), wider far from the bodies
    let sx = ey * UP[2] - ez * UP[1], sy = ez * UP[0] - ex * UP[2], sz = ex * UP[1] - ey * UP[0]; const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
    const off = lat * (1500 + 0.03 * Math.min(x, L - x));
    out[0] = pa[0] + ex * (ra + x) + sx * off; out[1] = pa[1] + ey * (ra + x) + sy * off; out[2] = pa[2] + ez * (ra + x) + sz * off;
    return out;
  };

  // ================================================================ the craft over a settlement (pure)
  // a craft crossing the settlement's sky on the world clock: one every ~32 s (jittered), from the horizon past the plaza
  // (35–90 m to its side, 35–65 m up) and away, climbing at both ends; a dropship, a freighter or a shuttle
  Fe.PASS = { slot: 32, len: 1960 };
  Fe.craftSeed = (seed, k) => (Math.floor(hh(seed, k, 0x3e1) * 4294967295) >>> 0);
  Fe.passAt = function (seed, k) {
    const r = (j) => hh(seed, k, j), a7 = r(7);
    return { k, t0: k * Fe.PASS.slot + r(1) * Fe.PASS.slot * 0.5, a: r(2) * TAU, off: (r(3) < 0.5 ? -1 : 1) * (35 + r(4) * 55), alt: 35 + r(5) * 30, v: 38 + r(6) * 30, arch: a7 < 0.55 ? 'dropship' : a7 < 0.85 ? 'freighter' : 'shuttle' };
  };
  const smooth01 = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  Fe.passPos = function (P, t, cx, cy, cz, out) {
    const Lh = Fe.PASS.len / 2, s = (t - P.t0) * P.v - Lh; if (t < P.t0 || s > Lh) return null;
    const dx = Math.cos(P.a), dz = Math.sin(P.a), e = s / Lh;
    out = out || {}; const p = out.pos || (out.pos = [0, 0, 0]);
    p[0] = cx + dx * s - dz * P.off; p[2] = cz + dz * s + dx * P.off; p[1] = cy + P.alt + 90 * e * e;
    out.yaw = Math.atan2(-dx, -dz); out.speed = P.v; out.roll = 0; out.pitch = 0; out.gear = 0;
    out.fade = smooth01((1 - Math.abs(e)) / 0.08);
    return out;
  };

  // ================================================================ the settlement (pure)
  // the record: meta.life = {v: 1, sites: {basalt: {x, y, z, day0, id, home}}, docks: {overworld: {x, y, z}}, pre: {…}}
  Fe.NAMES = ['Kraterruh', 'Lichtmulde', 'Neuhafen', 'Sternbucht', 'Stillfeld', 'Glanzhang', 'Silbersenke', 'Frostbogen', 'Morgenkuppel', 'Weitsicht'];
  Fe.nameOf = (site) => Fe.NAMES[Math.floor(hh(strHash(String(site && site.id)), 3, 9) * Fe.NAMES.length)];
  Fe.daysOf = (site, day) => Math.max(0, (day | 0) - ((site && site.day0) | 0));
  // the settlement's site: on the home's world beside the home; else 40–90 m from the landing, its bearing by the seed
  Fe.found = function (rec, dim, day, pos, home, wseed) {
    if (!rec || Fe.MOONS.indexOf(dim) < 0 || !Array.isArray(pos)) return null;
    const S = rec.sites || (rec.sites = {});
    if (S[dim]) return S[dim];
    const nearHome = home && home.dim === dim && Array.isArray(home.pos);
    const c = nearHome ? home.pos : pos, a = hh(wseed | 0, strHash(dim), 5) * TAU, r = nearHome ? 42 : 55 + hh(wseed | 0, strHash(dim), 6) * 25;
    const s = S[dim] = { x: Math.round(c[0] + Math.cos(a) * r), y: Math.round(c[1]), z: Math.round(c[2] + Math.sin(a) * r), day0: day | 0, id: 'life:' + dim + ':' + ((wseed | 0) & 0xffff), home: !!nearHome };
    return s;
  };
  // how many lots are unlocked after `days` (the neighbours of a home come last: the saved lot indices stay)
  Fe.LOT_DAYS = [0, 1, 1, 2, 2, 3];
  Fe.NEIGH_DAYS = [1, 2];
  Fe.unlocked = (days, home) => Fe.LOT_DAYS.filter(d => d <= days).length + (home ? Fe.NEIGH_DAYS.filter(d => d <= days).length : 0);
  Fe.prefabsFor = (plan, days) => plan.prefab.filter(p => p.day <= days);

  // block states by name (cached)
  const SC = new Map();
  function st(name, props) {
    const key = props ? name + JSON.stringify(props) : name; let s = SC.get(key); if (s !== undefined) return s;
    const R = VR.R, t = R && R.byName[name]; s = t ? (props ? t.state(props) : t.defaultState) : 0; SC.set(key, s); return s;
  }
  // the kits: the house of each world (Basalt domes, Opal ice-block halls; the Herzwelt terminal has no homes)
  Fe.KIT = {
    basalt: { kit: 'dome', wall: 'vx_tech_white', band: 'hull_stripe_blue', glass: 'vx_dome_glass', floor: 'vx_tech_hex_white', fill: 'vx_tech_gray', bed: 'light_blue_bed', door: 'door_glass_white', paving: 'vx_floor_pad' },
    opal: { kit: 'ice', wall: 'packed_ice', glass: 'vx_dome_glass', roof: 'blue_ice', floor: 'vx_tech_hex_white', fill: 'packed_ice', bed: 'white_bed', door: 'door_glass_white', paving: 'vx_floor_pad' },
    overworld: { kit: 'terminal', wall: 'vx_tech_white', glass: 'vx_dome_glass', floor: 'vx_tech_hex_white', fill: 'vx_tech_gray', paving: 'vx_floor_pad' },
  };
  // an ops writer: put(x, y, z, state); the ground under a footprint levelled to F (filled up to 4 below, cleared above)
  function writer(ground, F) {
    const ops = [];
    const put = (x, y, z, s) => { ops.push(x, y, z, s); };
    const level = (x, z, fill) => {
      const gy = ground(x, z);
      if (gy < F) for (let y = Math.max(gy + 1, F - 4); y < F; y++) put(x, y, z, fill);
      if (gy > F) for (let y = F + 1; y <= Math.min(gy, F + 12); y++) put(x, y, z, 0);
    };
    return { ops, put, level };
  }
  // a dome home (Basalt): a hemisphere of r 4.5 — two rings of white panels, glass above —, its door toward the plaza
  // (s = +1: the door on the +z side), two beds at the back, a light panel
  function dome(K, ground, F, cx, cz, s) {
    const W = writer(ground, F), put = W.put;
    for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) { if (dx * dx + dz * dz > 22) continue; W.level(cx + dx, cz + dz, st(K.fill)); put(cx + dx, F, cz + dz, st(K.floor)); }
    for (let dy = 0; dy <= 4; dy++) for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) {
      const d = Math.sqrt(dx * dx + dz * dz + (dy * 1.15) * (dy * 1.15)); if (d > 4.5) continue;
      const y = F + 1 + dy, x = cx + dx, z = cz + dz;
      if (d > 3.4) put(x, y, z, st(dy === 0 ? K.wall : dy === 1 ? K.band : K.glass)); else put(x, y, z, 0);
    }
    const dzd = 4 * s, fac = s > 0 ? 2 : 0;
    put(cx, F + 1, cz + dzd, st(K.door, { facing: fac, half: 0 })); put(cx, F + 2, cz + dzd, st(K.door, { facing: fac, half: 1 }));
    // the beds at the back, head to the wall
    const bz = cz - 1 * s, hf = s > 0 ? 0 : 2;
    const beds = [];
    for (const bx of [cx - 2, cx + 2]) { put(bx, F + 1, bz, st(K.bed, { facing: hf, part: 0 })); put(bx, F + 1, bz - s, st(K.bed, { facing: hf, part: 1 })); beds.push([bx, F + 1, bz, hf]); }
    put(cx, F + 3, cz, st('light_panel', { facing: 5 }));
    return { kind: 'home', ops: W.ops, door: [cx, F + 1, cz + dzd], outside: [cx, F + 1, cz + dzd + s], inside: [cx, F + 1, cz + dzd - 2 * s], beds, seats: [], work: [], chimney: null, table: null, lights: [[cx, F + 3, cz]], box: [cx - 5, F, cz - 5, cx + 5, F + 6, cz + 5], F, r: 0, w: 9, d: 9, ox: cx - 4, oz: cz - 4 };
  }
  // an ice-block hall (Opal): 9 × 7 outside, walls of packed ice three high, a roof of blue ice with a glass strip
  function hall(K, ground, F, cx, cz, s) {
    const W = writer(ground, F), put = W.put;
    for (let dx = -5; dx <= 5; dx++) for (let dz = -4; dz <= 4; dz++) { W.level(cx + dx, cz + dz, st(K.fill)); put(cx + dx, F, cz + dz, st(K.floor)); }
    for (let dy = 1; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) for (let dz = -3; dz <= 3; dz++) {
      const edge = Math.abs(dx) === 4 || Math.abs(dz) === 3, y = F + dy, x = cx + dx, z = cz + dz;
      if (dy === 4) put(x, y, z, st(dx === 0 || Math.abs(dz) === 0 ? K.glass : K.roof));
      else if (edge) put(x, y, z, st(dy === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 3 ? K.glass : K.wall));
      else put(x, y, z, 0);
    }
    const dzd = 3 * s, fac = s > 0 ? 2 : 0;
    put(cx, F + 1, cz + dzd, st(K.door, { facing: fac, half: 0 })); put(cx, F + 2, cz + dzd, st(K.door, { facing: fac, half: 1 }));
    const bz = cz - 1 * s, hf = s > 0 ? 0 : 2, beds = [];
    for (const bx of [cx - 2, cx + 2]) { put(bx, F + 1, bz, st(K.bed, { facing: hf, part: 0 })); put(bx, F + 1, bz - s, st(K.bed, { facing: hf, part: 1 })); beds.push([bx, F + 1, bz, hf]); }
    put(cx, F + 3, cz, st('light_panel', { facing: 5 }));
    return { kind: 'home', ops: W.ops, door: [cx, F + 1, cz + dzd], outside: [cx, F + 1, cz + dzd + s], inside: [cx, F + 1, cz + dzd - 2 * s], beds, seats: [], work: [], chimney: null, table: null, lights: [[cx, F + 3, cz]], box: [cx - 5, F, cz - 4, cx + 5, F + 5, cz + 4], F, r: 0, w: 9, d: 7, ox: cx - 4, oz: cz - 3 };
  }
  // a greenhouse: a glass vault 9 long (along x), r 3.2, crop beds on moss either side of a path, grow lamps under the
  // glass, open at both ends
  function greenhouse(K, ground, F, cx, cz) {
    const W = writer(ground, F), put = W.put;
    for (let dx = -5; dx <= 5; dx++) for (let dz = -4; dz <= 4; dz++) { W.level(cx + dx, cz + dz, st(K.fill)); put(cx + dx, F, cz + dz, st(Math.abs(dz) === 1 || Math.abs(dz) === 2 ? 'moss_block' : K.floor)); }
    for (let dx = -4; dx <= 4; dx++) for (let dy = 0; dy <= 3; dy++) for (let dz = -4; dz <= 4; dz++) {
      const d = Math.hypot(dz, dy * 1.05), x = cx + dx, y = F + 1 + dy, z = cz + dz;
      if (d > 3.3) continue;
      const end = Math.abs(dx) === 4;
      if (d > 2.3 || (end && !(Math.abs(dz) === 0 && dy <= 1))) put(x, y, z, st(dy === 0 && d > 2.3 ? K.wall : K.glass));
      else if (dy === 0 && (Math.abs(dz) === 1 || Math.abs(dz) === 2) && !end) put(x, y, z, st('vm_crop_rows'));
      else put(x, y, z, 0);
    }
    for (const dx of [-2, 0, 2]) put(cx + dx, F + 3, cz, st('grow_lamp'));
    return { ops: W.ops, spot: [cx + 3, F + 1, cz] };
  }
  function pad(K, ground, F, cx, cz) {
    const W = writer(ground, F);
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) { W.level(cx + dx, cz + dz, st(K.fill)); W.put(cx + dx, F, cz + dz, st(Math.abs(dx) === 4 || Math.abs(dz) === 4 ? K.paving : 'landing_pad')); }
    return W.ops;
  }
  // the terminal of a place: the plaza (7 × 7 paving, four lamps), the dock post at its north edge, the pads east and west
  // with paths to them (one pad per ferry route from here)
  Fe.PADX = 24;
  function terminal(dim, K, ground, F, x, z) {
    const W = writer(ground, F), put = W.put;
    for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) { W.level(x + dx, z + dz, st(K.fill)); put(x + dx, F, z + dz, st(K.paving)); }
    for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) put(x + dx, F + 1, z + dz, st('vx_lamppost_tech'));
    const dock = [x, F + 1, z - 3]; put(dock[0], dock[1], dock[2], st('ferry_dock'));
    const routes = Fe.routesAt(dim), pads = [];
    routes.forEach((r, i) => {
      const sx = i === 0 ? 1 : -1, px = x + sx * Fe.PADX;
      for (let dx = 5; dx < Fe.PADX - 4; dx++) { W.level(x + sx * dx, z, st(K.fill)); put(x + sx * dx, F, z, st(K.paving)); }
      const po = pad(K, ground, F, px, z); for (let k = 0; k < po.length; k++) W.ops.push(po[k]);
      pads.push({ route: r.id, to: Fe.other(r, dim), x: px + 0.5, y: F + 1, z: z + 0.5, out: [sx, 0], stand: [x + sx * 6 + 0.5, F + 1, z + 1.5] });
    });
    return { ops: W.ops, dock, pads };
  }
  // the plan: a village plan villages.js takes (addVillage), with the moon's own parts:
  //   homes (the pioneers' home, there from the start) · lots (the homes the builders raise, in order: their day in .day;
  //   a home on this moon: two neighbours appended) · prefab [{day, ops, what}] (the terminal at once; the greenhouses
  //   and the lamps on their days) · pads [{route, to, x, y, z, yaw, out, stand}] · dock [x, y, z] · kit
  Fe.plan = function (dim, site, ground, o) {
    const K = Fe.KIT[dim] || Fe.KIT.basalt, F = site.y | 0, X = site.x | 0, Z = site.z | 0, home = !!(o && o.home);
    const house = K.kit === 'ice' ? hall : dome;
    const seed = strHash(String(site.id)) >>> 0;
    const P = { id: site.id, name: Fe.nameOf(site), style: 'moon', kit: K.kit, x: X, y: F + 1, z: Z, seed, homes: [], work: [], farms: [], lots: [], lamps: [], chimneys: [], plaza: { x: X, y: F + 1, z: Z }, roads: [], bell: null, pad: null, shops: [], pastures: [], orchards: [], windmills: [], base: null, prefab: [], pads: [], dock: null, dim };
    const T = terminal(dim, K, ground, F, X, Z);
    P.prefab.push({ day: 0, what: 'terminal', ops: T.ops });
    P.dock = T.dock;
    P.pads = T.pads.map(p => Object.assign(p, { yaw: Math.atan2(-p.out[0], -p.out[1]) }));
    if (K.kit === 'terminal') return P;
    // the homes: the pioneers' (at once), then the lots in their order (doors toward the plaza)
    const H0 = house(K, ground, F, X - 9, Z + 12, -1);
    P.homes.push(H0); P.prefab.push({ day: 0, what: 'home', ops: H0.ops });
    const LOTS = [[9, 12], [-9, -13], [9, -13], [0, 20], [-18, 14], [18, 14]];
    LOTS.forEach(([dx, dz], i) => { const h = house(K, ground, F, X + dx, Z + dz, dz > 0 ? -1 : 1); h.day = Fe.LOT_DAYS[i]; P.lots.push(h); });
    if (home) [[-18, -14], [18, -14]].forEach(([dx, dz], i) => { const h = house(K, ground, F, X + dx, Z + dz, 1); h.day = Fe.NEIGH_DAYS[i]; h.neighbour = true; P.lots.push(h); });
    // the greenhouses (day 1 and 3) and the lamps along the ways (day 2)
    const G1 = greenhouse(K, ground, F, X, Z - 24), G2 = greenhouse(K, ground, F, X, Z + 29);
    P.prefab.push({ day: 1, what: 'greenhouse', ops: G1.ops }); P.prefab.push({ day: 3, what: 'greenhouse', ops: G2.ops });
    P.work.push({ kind: 'garden', spot: G1.spot }, { kind: 'garden', spot: G2.spot });
    const LW = writer(ground, F), lamps = [[-12, 2], [12, 2], [-5, -8], [5, -8], [-5, 8], [5, 8], [0, -17], [0, 24]];
    for (const [dx, dz] of lamps) { LW.put(X + dx, F + 1, Z + dz, st('vx_lamppost_tech')); P.lamps.push([X + dx, F + 2, Z + dz]); }
    P.prefab.push({ day: 2, what: 'lamps', ops: LW.ops });
    return P;
  };
  // the plan as villages.js sees it now: the lots unlocked so far
  Fe.villagePlan = function (P, days, home) { const v = Object.assign({}, P); v.lots = P.lots.slice(0, Math.min(P.lots.length, Fe.unlocked(days, home))); return v; };

  // f-polish: Herzwelt's port, found whatever the ground: the candidates 34–118 m from the spawn on four rings, their
  // order turned by the world's seed; probe(x, z) → {y, nat, built} (the ground's height, natural / built ground) or
  // null (not loaded). Strict: a footprint of natural ground within ±3 m (a-life's rule); else the loaded candidate
  // with the fewest misses (≤ 30 % of the footprint, nothing built, ±5 m) — open snow, a forest's edge, a hill. → site
  // {x, y, z, loose} or null (too few loaded: asked again in a second)
  Fe.herzPick = function (sp, seed, probe, padx) {
    const PX = (padx || 24) + 4, rot = ((seed >>> 0) % 997) / 997 * TAU;
    let best = null, bs = 1e9, loose = null, ls = 1e9, loaded = 0;
    for (let k = 0; k < 64; k++) {
      const a = rot + (k + (k >> 4) * 0.5) / 16 * TAU, r = 34 + Math.floor(k / 16) * 28;
      const x = Math.round(sp[0] + Math.cos(a) * r), z = Math.round(sp[2] + Math.sin(a) * r);
      const c = probe(x, z); if (!c) continue;
      if (!probe(x - PX, z) || !probe(x + PX, z)) continue;
      loaded++;
      const y0 = c.y; let miss = 0, sc = 0, n = 0, built = false;
      for (let dx = -PX; dx <= PX; dx += 2) for (let dz = -4; dz <= 4; dz += 2) {
        const q = probe(x + dx, z + dz); n++;
        if (!q) { miss++; continue; }
        const dy = Math.abs(q.y - y0);
        if (q.built) built = true;
        if (dy > 3 || !q.nat) miss++;
        sc += Math.min(dy, 8);
      }
      if (built) continue;
      if (!miss && sc < bs) { bs = sc; best = { x, y: y0, z }; }
      const lsc = miss * 40 + sc + r * 0.2;
      if (miss <= n * 0.3 && lsc < ls && sc / n <= 5) { ls = lsc; loose = { x, y: y0, z, loose: 1 }; }
    }
    return best || (loaded >= 8 ? loose : null);
  };

  // the words (German first; also in lang_de.js / lang_en.js)
  Fe.KEYS = ['g.fe.founded', 'g.fe.foundedSub', 'g.fe.grows', 'g.fe.neighbours', 'g.fe.title', 'g.fe.to', 'g.fe.parked', 'g.fe.next', 'g.fe.board', 'g.fe.close', 'g.fe.wait', 'g.fe.aboard', 'g.fe.welcome', 'g.fe.none', 'g.fe.routes', 'g.fe.legend', 'g.fe.terminal', 'g.fe.grows.greenhouse', 'g.fe.grows.lamps', 'g.ctx.ferry', 'g.set.spaceLife', 'g.set.spaceLife.tip'];

  // ================================================================================ the game
  if (typeof window === 'undefined' || !VR.Game || !VR.PadLife || !VR.PadLife.Actor) return;
  const POL = VR.Polish || (VR.Polish = { off: {} });   // f-polish's switches (the tests' before | after)
  const P0 = VR.PadLife, LK = VR.LifeKit;
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const on = (g) => !(g && g.settings && g.settings.spaceLife === false);
  const wseedOf = (g) => (g && g.meta && g.meta.seed) | 0;
  const recOf = (g) => { const m = g && g.meta; if (!m) return null; const r = m.life || (m.life = { v: 1, sites: {}, docks: {}, pre: {} }); r.sites = r.sites || {}; r.docks = r.docks || {}; r.pre = r.pre || {}; return r; };
  const guest = (g) => !!(g && ((g.meta && g.meta.guest) || (g.mp && g.mp.isClient)));
  const mmss = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const dimName = (d) => (VR.Travel ? VR.Travel.dimName(d) : d);
  Fe.stats = { founded: 0, prefabBlocks: 0, rides: 0, arrivals: 0, space: 0, spaceMs: 0, err: null };

  // ---------------------------------------------------------------- the ground, kept: a height map round a site
  // (taken once, when the site is founded: later the settlement's own blocks would read as ground)
  Fe.HM_R = 36;
  const R0 = () => VR.R;
  const SOLID = () => (VR.F && VR.F.SOLID) || 1;
  function topAt(w, x, z, y0) {
    const R = R0();
    for (let y = Math.min(250, y0 + 40); y > Math.max(1, y0 - 60); y--) { const s = w.getBlock(x, y, z); if (s && (R.T.flags[s] & SOLID())) return y; }
    return y0;
  }
  function takeHM(w, s) {
    const N = Fe.HM_R * 2 + 1; let out = '';
    for (let dz = -Fe.HM_R; dz <= Fe.HM_R; dz++) for (let dx = -Fe.HM_R; dx <= Fe.HM_R; dx++) out += String.fromCharCode(64 + clamp(topAt(w, s.x + dx, s.z + dz, s.y) - s.y, -60, 60));
    void N; return out;
  }
  const groundOf = (s) => (x, z) => { const dx = x - s.x, dz = z - s.z, N = Fe.HM_R * 2 + 1; if (!s.hm || Math.abs(dx) > Fe.HM_R || Math.abs(dz) > Fe.HM_R) return s.y; return s.y + s.hm.charCodeAt((dz + Fe.HM_R) * N + dx + Fe.HM_R) - 64; };
  const loadedRound = (w, x, z, r) => w.isLoaded(x, z) && w.isLoaded(x - r, z - r) && w.isLoaded(x + r, z - r) && w.isLoaded(x - r, z + r) && w.isLoaded(x + r, z + r);
  const onGround = (g) => { const p = g.player; return !!(p && !p.dead && !(g.starships && g.starships.pilot) && g.state === 'play' && !(g.flight && (g.flight.regime === 'space' || g.flight.auto))); };

  // ---------------------------------------------------------------- the ferries' pads (a PadLife.Actor of their own)
  class FerryActor extends P0.Actor {
    constructor(g) { super(g); this.ferry = true; }
    update(dt) {
      const g = this.g, S = g.settings || {}, pl = g.player;
      this.clock += dt;
      this.on = on(g) && g.state === 'play';
      this.tier = P0.tierOf(S);
      const st = this.st; st.pads = this.pads.size; st.crafts = 0; st.parked = 0; st.crew = 0; st.drones = 0; st.visible = 0;
      if (!this.on || !pl || !g.starships) { for (const p of this.pads.values()) { p.live = null; p.ground = null; } return; }
      const E = g.env && g.env.E, night = E ? E.night || 0 : 0;
      for (const pad of this.pads.values()) {
        if (pad.kind === 'pass') continue;
        if (pad.shift && !pad.ride) { const k = Math.min(Math.abs(pad.shift), dt * 0.5); pad.shift += pad.shift > 0 ? -k : k; }
        const d = Math.hypot(pad.x - pl.pos[0], pad.z - pl.pos[2]);
        if (d > P0.VIS && !pad.ride) { pad.live = null; continue; }
        pad.outs = pad.outs || [{}, {}, {}];
        const t = this.clock + (pad.shift || 0);
        const list = P0.active(pad, pad.seed, t, pad.cache || (pad.cache = { seed: pad.seed, n: 0, T: P0.t0(pad.seed) }), pad.outs, pad.o, pad.list || (pad.list = []));
        pad.live = list;
        for (const q of list) { this.craft(pad, q, dt, d, night); this.departs(pad, q); }
      }
      this.passes(dt);
    }
    // the craft over the settlement (a pad of its own kind: PadLife's draw shows them)
    passes(dt) {
      const g = this.g, L = g.life, s = L && L.site, SS = g.starships;
      let pad = this.pads.get('pass');
      if (!s || !L.plan || Fe.MOONS.indexOf(g.dim) < 0 || !this.on || !SS) { if (pad) pad.live = null; return; }
      if (!pad) { pad = { key: 'pass', kind: 'pass', seed: Fe.padSeed('pass', g.dim, wseedOf(g)), x: s.x, y: s.y, z: s.z, crafts: new Map(), live: [] }; this.pads.set('pass', pad); }
      const t = this.clock, k1 = Math.floor(t / Fe.PASS.slot), list = pad.live || (pad.live = []), pl = g.player.pos, Tr = g.trails;
      list.length = 0;
      for (let k = k1 - 2; k <= k1; k++) {
        const P = Fe.passAt(pad.seed, k);
        let c = pad.crafts.get(k);
        const q = Fe.passPos(P, t, s.x + 0.5, s.y + 1, s.z + 0.5, c ? c.q : null); if (!q) continue;
        if (!c) {
          c = { m: k, arch: P.arch, d: SS.design(Fe.craftSeed(pad.seed, k), P.arch, null), q, inst: { d: null, pos: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, gear: 0, hatch: { ramp: 0, door: 0, cdoor: 0 }, kneel: 0 }, ev: { t: 0, pos: null, d: null, contrail: false, near: false, tag: null }, alpha: 0, dist: 1e9, tid: 'fp' + k, wp: [0, 0, 0] };
          pad.crafts.set(k, c); for (const kk of [...pad.crafts.keys()]) if (kk < k - 3) pad.crafts.delete(kk);
        }
        if (!SS.designs.has(c.d.key)) c.d = SS.design(Fe.craftSeed(pad.seed, k), P.arch, null);
        c.d.last = performance.now(); q.m = k; list.push(q);
        const I = c.inst; I.d = c.d; I.pos[0] = q.pos[0]; I.pos[1] = q.pos[1]; I.pos[2] = q.pos[2]; I.yaw = q.yaw; I.pitch = 0; I.roll = 0; I.gear = 0;
        const dist = Math.hypot(q.pos[0] - pl[0], q.pos[1] - pl[1], q.pos[2] - pl[2]); c.dist = dist;
        c.alpha = q.fade * (1 - LK.smooth((dist - P0.FADE0) / (P0.FADE1 - P0.FADE0)));
        this.st.crafts++; if (c.alpha > 0.5) this.st.visible++;
        c.ev.pos = q.pos; c.ev.d = c.d; if (VR.EventLog && VR.EventLog.pass) VR.EventLog.pass(c.ev, dist);
        const m = c.d.meta;
        if (Tr && Tr.engine && m && this.tier >= 1 && dist < 600 && c.alpha > 0.1) for (let ei = 0; ei < Math.min(2, m.exhaust.length); ei++) {
          const e = m.exhaust[ei], lo = c.lo || (c.lo = [0, 0, 0]); lo[0] = e[0]; lo[1] = e[1]; lo[2] = e[2] + 0.3; P0.toWorld(I.pos, I.yaw, lo, c.wp);
          Tr.engine(c.tid + ei, c.wp, q.speed, { thrust: 0.8, size: e[3] * 1.3, col: [0.5, 0.85, 1], minor: ei > 0, smokeLife: 3 });
        }
      }
      void dt;
    }
    // e-log: a ferry lifts off its pad (once per visit)
    departs(pad, q) {
      const c = pad.crafts.get(q.m); if (!c || c._fd || q.phase !== 'lift') return; c._fd = 1;
      if (VR.EventLog && VR.EventLog.emit) VR.EventLog.emit('travel', 'ferry_depart', 2, [q.pos[0], q.pos[1] + 3, q.pos[2]], 'ferry', c.d && c.d.meta && c.d.meta.length ? c.d.meta.length * 0.5 : 10);
    }
  }
  Fe.FerryActor = FerryActor;
  function padRec(g, p, dim) {
    return { key: 'fe:' + p.route + '@' + dim, kind: 'ferry', route: p.route, to: p.to, seed: Fe.padSeed(p.route, dim, wseedOf(g)), x: p.x, y: p.y, z: p.z, yaw: p.yaw, out: p.out, holdSide: -1, o: Fe.FERRY_O, arch: 'shuttle', stand: p.stand, serviceAt: null, cache: null, crafts: new Map(), shift: 0 };
  }
  // the pads of a place from its site alone (their places do not depend on the ground)
  Fe.padsAt = function (dim, site) { const P = Fe.plan(dim, Object.assign({}, site, { hm: null }), () => site.y, { home: false }); return P.pads; };

  // ---------------------------------------------------------------- the frame (from PadLife.Actor's update: no line in game.js)
  Fe.tick = function (g, dt) {
    if (!g || !g.world || !g.player) return;
    Fe._dt = dt;
    let L = g.life;
    if (!L || L.world !== g.world) {
      if (L && L.actor) L.actor.destroy();
      L = g.life = { world: g.world, dim: g.dim, actor: new FerryActor(g), plan: null, site: null, vil: null, t: 0.3, docks: [], q: null, name: '' };
    }
    if (g.state === 'play' && on(g)) {
      if ((L.t -= dt) <= 0) { L.t = 1; settle(g, L); }
      stepPrefab(g, L, dt);
    }
    stepRide(g, L, dt);
    L.actor.update(dt);
  };
  // found, plan, register and grow the settlement of this world (1 Hz)
  function settle(g, L) {
    const rec = recOf(g); if (!rec) return;
    const dim = g.dim, w = g.world, p = g.player.pos;
    let s = null;
    if (Fe.MOONS.indexOf(dim) >= 0) {
      s = rec.sites[dim];
      if (!s) {
        if (guest(g) || !onGround(g)) return;
        const NL = VR.NewLife, home = NL && NL.home ? NL.home(g) : null;
        s = Fe.found(rec, dim, (g.env && g.env.day) | 0, p, home, wseedOf(g)); if (!s) return;
        s.y = Math.round(p[1]) - 1; s.fresh = 1;
      }
    } else if (dim === 'overworld') {
      s = rec.docks.overworld;
      if (!s) { if (guest(g) || !Object.keys(rec.sites).length || !onGround(g)) return; s = herzSite(g); if (!s) return; rec.docks.overworld = s; s.fresh = 1; }
    } else return;
    if (!s.hm) {
      if (!loadedRound(w, s.x, s.z, Fe.HM_R)) return;
      s.y = topAt(w, s.x, s.z, s.y); s.hm = takeHM(w, s);
    }
    if (!L.plan) {
      L.site = s; L.home = !!s.home;
      L.plan = Fe.plan(dim, s, groundOf(s), { home: L.home });
      L.name = dim === 'overworld' ? T('g.fe.terminal') : L.plan.name;
      L.docks = [L.plan.dock];
      L.actor.pads.clear();
      for (const pp of L.plan.pads) { const r = padRec(g, pp, dim); L.actor.pads.set(r.key, r); }
      if (s.fresh) { delete s.fresh; Fe.stats.founded++; if (dim !== 'overworld' && g.ui && g.ui.toast) { g.ui.toast('🏡 ' + T('g.fe.founded', { name: L.name }), T('g.fe.foundedSub', { name: L.name }), null); } if (VR.EventLog && VR.EventLog.emit) VR.EventLog.emit('milestone', 'life_founded', 3, [s.x + 0.5, s.y + 3, s.z + 0.5], 'ferries', 20); }
    }
    const days = dim === 'overworld' ? 0 : Fe.daysOf(s, (g.env && g.env.day) | 0);
    // the prefabs due (the terminal and the pioneers' home at once, the rest raised in sight)
    const done = rec.pre[dim] || (rec.pre[dim] = []);
    if (!L.q && !guest(g)) for (let i = 0; i < L.plan.prefab.length; i++) { const pf = L.plan.prefab[i]; if (pf.day > days || done.indexOf(i) >= 0) continue; L.q = { i, k: 0, pf, instant: pf.day === 0 }; break; }
    // the village: registered once its land is there, its lots unlocked by day
    const V = g.villages;
    if (V && L.plan.homes.length && done.indexOf(1) >= 0) {
      const n = Fe.unlocked(days, L.home);
      if (!L.vil) { V.addVillage(Fe.villagePlan(L.plan, days, L.home)); L.vil = V.known.get(L.plan.id) || null; }
      else if (L.vil.plan.lots.length < n) {
        const was = L.vil.plan.lots.length; L.vil.plan.lots = L.plan.lots.slice(0, n);
        if (L.plan.lots.slice(was, n).some(l => l.neighbour) && g.ui && g.ui.toast) g.ui.toast('🏠 ' + T('g.fe.neighbours', { name: L.name }), '', null);
      }
      if (L.fast && L.vil && L.vil.active && V.catchUp) V.catchUp(L.vil);
    }
    if (L.fast && !L.q) L.fast = false;
  }
  // the settlement `days` older at once (the tests; a Zeitraffer later): founded earlier, the prefabs due raised at once,
  // the village's builders catching up on the time
  Fe.age = function (g, days) {
    const rec = recOf(g), L = g && g.life, s = rec && rec.sites[g.dim]; if (!s || !L) return false;
    s.day0 = (s.day0 | 0) - (days | 0); L.fast = true; L.t = 0;
    if (L.vil && g.villages) L.vil.st.lastSeen = (L.vil.st.lastSeen === undefined ? g.villages.worldTime() : L.vil.st.lastSeen) - days * 24000;
    return true;
  };
  // Herzwelt's ferry port: the flattest open place 34–60 m from the world's spawn (natural ground, nothing over it)
  const NATURAL = /grass|dirt|sand$|^stone$|gravel|snow|podzol|mud|clay|moss_block|terracotta|andesite|diorite|granite/;
  const BUILT = /brick|polished|smooth|cut_|chiseled|planks|slab|stairs|vx_|vm_|path|concrete|tile|paver/;
  function herzSite(g) {
    const w = g.world, Tv = VR.Travel, sp = Tv && Tv.herzTarget ? Tv.herzTarget(g, true).pos : g.player.pos; if (!sp) return null;
    const R = R0(), y0 = Math.round(sp[1]);
    Fe.stats.herz = { tried: 64, loaded: 0 };
    // the ground under the trees and the snow's layer (the leaves are no floor; a-life's search read them as one)
    const SOFT = /leaves|log$|_log|wood$|stem|snow_layer|flower|fern|bush|sapling|tall|short_grass|^grass$|vine|mushroom/;
    const probe = (x, z) => {
      if (!w.isLoaded(x, z)) return null;
      let y = Math.min(250, y0 + 40);
      for (; y > Math.max(1, y0 - 60); y--) { const s = w.getBlock(x, y, z); if (!s || !(R.T.flags[s] & SOLID())) continue; const n = R.types[R.T.type[s]], nm = n ? n.name : ''; if (SOFT.test(nm)) continue; return { y, nat: NATURAL.test(nm) && !BUILT.test(nm), built: BUILT.test(nm) }; }
      return { y: y0, nat: false, built: false };
    };
    if (POL.off.port) {   // a-life's search (the switch: the tests' before)
      let best = null, bs = 1e9;
      for (let k = 0; k < 64; k++) {
        const a = (k + (k >> 4) * 0.5) / 16 * TAU, r = 34 + Math.floor(k / 16) * 28;
        const x = Math.round(sp[0] + Math.cos(a) * r), z = Math.round(sp[2] + Math.sin(a) * r);
        if (!loadedRound(w, x, z, Fe.PADX + 6)) continue; Fe.stats.herz.loaded++;
        const yy = topAt(w, x, z, y0); let ok = true, sc = 0;
        for (let dx = -Fe.PADX - 4; dx <= Fe.PADX + 4 && ok; dx += 2) for (let dz = -4; dz <= 4 && ok; dz += 2) {
          const y = topAt(w, x + dx, z + dz, yy), n = R.types[R.T.type[w.getBlock(x + dx, y, z + dz)]], nm = n ? n.name : '';
          if (Math.abs(y - yy) > 3 || !NATURAL.test(nm) || BUILT.test(nm)) ok = false; else sc += Math.abs(y - yy);
        }
        if (ok && sc < bs) { bs = sc; best = { x, y: yy, z, day0: (g.env && g.env.day) | 0, id: 'life:overworld:' + (wseedOf(g) & 0xffff) }; }
      }
      return best;
    }
    const c = Fe.herzPick(sp, wseedOf(g), probe, Fe.PADX);
    Fe.stats.herz.found = c ? (c.loose ? 'loose' : 'strict') : null;
    return c ? { x: c.x, y: c.y, z: c.z, day0: (g.env && g.env.day) | 0, id: 'life:overworld:' + (wseedOf(g) & 0xffff) } : null;
  }
  // the prefab under way: day 0 at once; the rest 24 blocks a second while you are within 160 m (sparks), at once when not
  function stepPrefab(g, L, dt) {
    const Q = L.q; if (!Q || !L.site || guest(g)) return;
    const w = g.world, ops = Q.pf.ops, s = L.site, p = g.player.pos, R = R0();
    if (!loadedRound(w, s.x, s.z, 34)) return;
    const near = Math.hypot(p[0] - s.x, p[2] - s.z) < 160;
    let n = Q.instant || L.fast || !near ? 1e9 : Math.max(1, Math.round(dt * 24 + (Q.acc || 0))); Q.acc = Q.instant || L.fast || !near ? 0 : (dt * 24 + (Q.acc || 0)) - n;
    if (Q.k === 0 && !Q.instant && near && VR.EventLog && VR.EventLog.emit) VR.EventLog.emit('build', 'life_' + Q.pf.what, 2, [ops[0] + 0.5, ops[1] + 1, ops[2] + 0.5], 'ferries', 6);
    while (Q.k < ops.length && n > 0) {
      const x = ops[Q.k], y = ops[Q.k + 1], z = ops[Q.k + 2], v = ops[Q.k + 3]; Q.k += 4;
      if (w.getBlock(x, y, z) === v) continue;
      // (never a block into the player)
      if (v && (R.T.flags[v] & SOLID()) && Math.abs(p[0] - x - 0.5) < 0.9 && Math.abs(p[2] - z - 0.5) < 0.9 && p[1] > y - 1.9 && p[1] < y + 1) continue;
      w.setBlock(x, y, z, v, 0); Fe.stats.prefabBlocks++; n--;
      if (!Q.instant && near && v && g.particles && g.particles.spark && (Q.k & 12) === 0) g.particles.spark(x + 0.5, y + 0.5, z + 0.5, [0.6, 0.92, 1], 5, 1.4);
    }
    if (Q.k >= ops.length) {
      const rec = recOf(g), done = rec.pre[g.dim] || (rec.pre[g.dim] = []); if (done.indexOf(Q.i) < 0) done.push(Q.i);
      if (!Q.instant && (Q.pf.what === 'greenhouse' || Q.pf.what === 'lamps')) {
        if (g.ui && g.ui.toast && near) g.ui.toast('🌱 ' + T('g.fe.grows', { name: L.name, what: T('g.fe.grows.' + Q.pf.what) }), '', null);
        if (near && VR.EventLog && VR.EventLog.emit) VR.EventLog.emit('build', 'life_done', 3, [ops[0] + 0.5, ops[1] + 2, ops[2] + 0.5], 'ferries', 6);
      }
      L.q = null; L.t = 0;
    }
  }

  // ---------------------------------------------------------------- [V] at the dock: the panel, boarding, the ride
  function css() {
    if (document.getElementById('fecss')) return;
    const s = document.createElement('style'); s.id = 'fecss';
    s.textContent = '#fepanel .fecard{max-width:420px}#fepanel .ferow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 6px;border-top:1px solid #ffffff1a}#fepanel .ferow b{font-size:15px}#fepanel .note{opacity:.8;font-size:12px}#fepanel .fehead{display:flex;justify-content:space-between;align-items:center;gap:10px}';
    document.head.appendChild(s);
  }
  // the routes from this dock right now: [{pad, to, parked, dep, land}]
  Fe.board = function (g) {
    const L = g && g.life; if (!L || !L.actor) return [];
    const t = L.actor.clock, out = [];
    for (const pad of L.actor.pads.values()) { if (pad.kind !== 'ferry') continue; const n = Fe.next(pad.route, g.dim, wseedOf(g), t + (pad.shift || 0), null); out.push({ pad, to: pad.to, parked: n.parked, dep: n.dep - t, land: n.land - t, m: n.m }); }
    return out;
  };
  Fe.openPanel = function (g) {
    const L = g && g.life; if (!L) return false;
    css();
    let el = document.getElementById('fepanel');
    if (!el) { el = document.createElement('div'); el.id = 'fepanel'; el.className = 'screen'; el.innerHTML = '<div class="panel box fecard"></div>'; ((g.ui && g.ui.root) || document.getElementById('ui') || document.body).appendChild(el); }
    const list = Fe.board(g);
    let h = `<div class="fehead"><h2>${esc(T('g.fe.title', { name: L.name }))}</h2><button type="button" class="btn small" data-fe="close">${esc(T('g.fe.close'))}</button></div>`;
    if (!list.length) h += `<div class="note">${esc(T('g.fe.none'))}</div>`;
    list.forEach((q, i) => {
      const when = q.parked ? T('g.fe.parked', { t: mmss(q.dep) }) : T('g.fe.next', { t: mmss(q.land) });
      h += `<div class="ferow"><div><b>⛴ ${esc(T('g.fe.to', { to: dimName(q.to) }))}</b><div class="note">${esc(when)}</div></div><button type="button" class="btn primary" data-fe="go" data-i="${i}">${esc(T('g.fe.board'))}</button></div>`;
    });
    el.querySelector('.panel').innerHTML = h;
    for (const b of el.querySelectorAll('[data-fe]')) b.onclick = () => { const go = b.getAttribute('data-fe') === 'go'; if (g.ui && g.ui.resume) g.ui.resume(); if (go) Fe.take(g, list[+b.getAttribute('data-i')].pad); };
    if (g.ui && g.ui.show) g.ui.show('fepanel');
    return true;
  };
  // board the ferry at this pad: a ferry at the dock takes you at once (the passenger's boarding is the stay's last
  // seconds: the pad's clock runs ahead for you); none there: wait for the next one at the dock
  Fe.take = function (g, pad) {
    const L = g && g.life; if (!L || !pad || L.ride) return false;
    const t = L.actor.clock + (pad.shift || 0), n = Fe.next(pad.route, g.dim, wseedOf(g), t, null);
    if (!n.parked || n.dep - t < 1.5) { L.wait = { pad, at: g.player.pos.slice() }; if (g.ui && g.ui.chatLine) g.ui.chatLine(T('g.fe.wait', { to: dimName(pad.to), t: mmss(n.land - t) }), '#9affd8'); return true; }
    pad.shift = (pad.shift || 0) + Math.max(0, n.dep - 3.2 - t); pad.ride = true;
    L.ride = { pad, to: pad.to, route: pad.route, m: n.m, t: 0, pos: g.player.pos.slice(), cam: null, phase: 'board' };
    L.wait = null; Fe.camOn = true; Fe.stats.rides++;
    hud(g, false);
    if (g.ui && g.ui.chatLine) g.ui.chatLine(T('g.fe.aboard', { to: dimName(pad.to) }), '#9affd8');
    if (VR.EventLog && VR.EventLog.emit) VR.EventLog.emit('travel', 'ferry_board', 2, null, 'ferry');
    return true;
  };
  function hud(g, show) {
    if (!show) { if (Fe._hud === undefined) Fe._hud = !!g.hideHud; g.hideHud = true; }
    else { g.hideHud = !!Fe._hud; Fe._hud = undefined; }
    const el = document.getElementById('hud'); if (el) el.style.visibility = g.hideHud ? 'hidden' : 'visible';
  }
  // where a ferry to `dim` on `route` puts you down: beside its pad there (the place's site known), else the world's own
  function arrivalOf(g, dim, route) {
    const rec = recOf(g); const s = dim === 'overworld' ? rec.docks.overworld : rec.sites[dim];
    if (!s) return dim === 'overworld' ? { via: 'herz' } : { via: 'cmd' };
    const p = Fe.padsAt(dim, s).find(q => q.route === route);
    return p ? { via: 'cmd', at: [p.stand[0], s.y + 1.05, p.stand[2]] } : { via: 'cmd' };
  }
  function stepRide(g, L, dt) {
    if (L.wait && !L.ride) {
      const W = L.wait, p = g.player.pos;
      if (Math.hypot(p[0] - W.at[0], p[2] - W.at[2]) > 40) L.wait = null;
      else { const t = L.actor.clock + (W.pad.shift || 0), n = Fe.next(W.pad.route, g.dim, wseedOf(g), t, null); if (n.parked && n.dep - t > 6 && t - n.land > 4) Fe.take(g, W.pad); }
    }
    // the arrival shot: the ferry comes over its pad and settles; then you stand beside it
    if (Fe.pend && Fe.pend.dim === g.dim && g.state === 'play' && L.plan) {
      const P = Fe.pend; Fe.pend = null;
      const pad = [...L.actor.pads.values()].find(q => q.route === P.route);
      if (pad) {
        const c = P0.visitAt(pad.seed, L.actor.clock, null, pad.o);
        pad.shift = c.T - 8.5 - L.actor.clock; pad.ride = true;
        L.arr = { pad, m: c.n, t: 0, cam: null }; Fe.camOn = true; hud(g, false); Fe.stats.arrivals++;
      } else hud(g, true);
    }
    if (L.arr) {
      const A = L.arr; A.t += dt;
      if (A.t > 11) {
        A.pad.ride = false; L.arr = null; Fe.camOn = false; hud(g, true);
        const st = A.pad.stand; if (st && g.player.safeTeleport) g.player.safeTeleport(st[0], A.pad.y + 0.05, st[2]);
        if (g.ui && g.ui.toast) g.ui.toast('⛴ ' + T('g.fe.welcome', { name: L.name }), '', null);
        if (VR.EventLog && VR.EventLog.emit) VR.EventLog.emit('travel', 'ferry_arrive', 3, [A.pad.x, A.pad.y + 3, A.pad.z], 'ferry', 12);
      }
    }
    const R = L.ride; if (!R) return;
    R.t += dt;
    const p = g.player; if (p && R.phase !== 'travel') { p.pos[0] = R.pos[0]; p.pos[1] = R.pos[1]; p.pos[2] = R.pos[2]; if (p.vel) { p.vel[0] = 0; p.vel[1] = 0; p.vel[2] = 0; } }
    const c = R.pad.crafts.get(R.m), q = c && c.q;
    if (R.phase === 'board' && (R.t > 17 || (q && q.phase === 'depart' && q.u - q.S - P0.LIFT > 8.5))) {
      R.phase = 'travel'; Fe.camOn = false;
      const a = arrivalOf(g, R.to, R.route), Tv = VR.Travel;
      R.pad.ride = false; L.ride = null;
      if (!Tv || !Tv.go) { hud(g, true); return; }
      Fe.pend = a.at ? { dim: R.to, route: R.route } : null;
      if (!a.at) hud(g, true);
      Tv.go(g, { dim: R.to, via: a.via, at: a.at }).then((ok) => { if (!ok) { Fe.pend = null; hud(g, true); } });
    }
  }
  // the chase view: behind and over the ferry you ride (or the one bringing you in), eased; a slow turn while it stands
  const V3 = () => [0, 0, 0];
  Fe.cam = function (g, base) {
    const L = g && g.life; if (!L || !base) return null;
    const S = L.ride || L.arr; if (!S) { Fe.camOn = false; return null; }
    const c = S.pad.crafts.get(S.m); if (!c || !c.inst || !c.d || !c.d.meta) return null;
    const I = c.inst, m = c.d.meta, q = c.q || {};
    const fx = -Math.sin(I.yaw), fz = -Math.cos(I.yaw);
    const parked = q.phase === 'parked' || q.phase === 'settle' || q.phase === 'slide';
    const len = Math.max(8, m.length || 12), hgt = Math.max(3, m.height || 4);
    const D = len * 1.5 + 8, H = hgt * 1.4 + 3;
    // standing: from beside and behind, turning slowly; flying: right behind, a little over
    const turn = parked ? 0.9 - 0.04 * S.t : 0.25;
    const bx = -fx * Math.cos(turn) + fz * Math.sin(turn), bz = -fz * Math.cos(turn) - fx * Math.sin(turn);
    const want = [I.pos[0] + bx * D, I.pos[1] + H, I.pos[2] + bz * D];
    const look = [I.pos[0] + fx * len * 0.35, I.pos[1] + hgt * 0.55, I.pos[2] + fz * len * 0.35];
    const k = S.cam ? 1 - Math.exp(-3.5 * Math.min(0.1, Fe._dt || 0.016)) : 1;
    const C = S.cam || (S.cam = { p: V3(), l: V3() });
    for (let i = 0; i < 3; i++) { C.p[i] += (want[i] - C.p[i]) * k; C.l[i] += (look[i] - C.l[i]) * k; }
    if (q.phase === 'depart' || q.phase === 'lift' || q.phase === 'approach') for (let i = 0; i < 3; i++) { C.p[i] = want[i] * 0.6 + C.p[i] * 0.4; C.l[i] = look[i]; }
    const dx = C.l[0] - C.p[0], dy = C.l[1] - C.p[1], dz = C.l[2] - C.p[2];
    return Object.assign({}, base, { x: C.p[0], y: C.p[1], z: C.p[2], yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), roll: 0, fixed: true });
  };

  // [V] near the dock (e-ctx row 4: kind 'ferry')
  if (VR.Ctx && VR.Ctx.hooks && Array.isArray(VR.Ctx.hooks.near)) VR.Ctx.hooks.near.push((g, eye, dir) => {
    const L = g && g.life; if (!L || !L.docks || !L.docks.length || !on(g) || L.ride) return null;
    const list = [];
    for (const d of L.docks) { if (!d || Math.abs(d[0] + 0.5 - eye[0]) > 6 || Math.abs(d[2] + 0.5 - eye[2]) > 6) continue; list.push({ kind: 'ferry', name: L.name, pos: [d[0] + 0.5, d[1] + 0.9, d[2] + 0.5], r: 0.9, act: (gg) => Fe.openPanel(gg) }); }
    return list.length && VR.Ctx.pickNear ? VR.Ctx.pickNear(eye, dir, list) : null;
  });

  // the hooks into PadLife's actor (its update and draw run on every world): the ferries' tick and their craft
  const AP = P0.Actor.prototype;
  if (!AP.__fe) {
    AP.__fe = true;
    const up0 = AP.update, dr0 = AP.draw;
    AP.update = function (dt) { up0.call(this, dt); if (this.ferry) return; try { Fe.tick(this.g, dt); } catch (e) { if (!Fe.stats.err) { Fe.stats.err = String((e && e.stack) || e); console.error('ferries', e); } } };
    AP.draw = function (r, E, layer, cam) { dr0.call(this, r, E, layer, cam); if (this.ferry) return; const L = this.g && this.g.life; if (L && L.actor && L.world === this.g.world) L.actor.draw(r, E, layer, cam); };
  }
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'spaceLife', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.spaceLife', tip: 'g.set.spaceLife.tip', cost: 'low', def: true });

  // ---------------------------------------------------------------- the traffic in space (SpaceScene.frameSetup's hook)
  // each craft one instanced quad, additive, no depth: a nav light (a hull glint in the sun when near), its engine streak
  // behind it, the blink red/green; hidden behind a body (a line-of-sight test on the CPU); kept at half the far plane
  // with its angular size (the space scene's depth range is a few km)
  const TVS = `
uniform mat4 u_viewProj;
uniform vec2 u_px;
in vec4 a_p;   // direction × the fixed distance (scene axes, from the eye), the core's radius (px)
in vec4 a_v;   // the travel direction (scene axes), the streak (px)
in vec4 a_k;   // kind (0 ferry · 1 freighter · 2 small), the blink's phase, brightness, the hull lit (0 … 1)
out vec2 v_q;
out float v_len;
out vec4 v_k;
void main() {
  int id = gl_VertexID;
  float cx = (id == 1 || id == 2 || id == 4) ? 1.0 : -1.0, cy = (id == 2 || id == 4 || id == 5) ? 1.0 : -1.0;
  vec4 P = u_viewProj * vec4(a_p.xyz, 1.0);
  vec4 Q = u_viewProj * vec4(a_p.xyz + a_v.xyz * length(a_p.xyz) * 0.01, 1.0);
  vec2 s0 = P.xy / P.w, s1 = Q.xy / max(Q.w, 1e-6);
  vec2 d = (s1 - s0) / u_px; float L = length(d);
  vec2 ax = L > 1e-4 ? d / L : vec2(1.0, 0.0), ay = vec2(-ax.y, ax.x);
  float r = a_p.w * 3.0, sl = a_v.w;
  float along = cx > 0.0 ? r : -(sl + r), across = cy * r;
  v_q = vec2(along, across) / r; v_len = sl / r; v_k = a_k;
  gl_Position = P.w > 0.0 ? vec4((s0 + (ax * along + ay * across) * u_px) * P.w, P.z, P.w) : vec4(2.0, 2.0, 2.0, 1.0);
}`;
  const TFS = `
uniform float u_time;
in vec2 v_q;
in float v_len;
in vec4 v_k;
out vec4 o;
void main() {
  float core = exp(-dot(v_q, v_q) * 9.0);
  float s = v_q.x < 0.0 ? clamp(-v_q.x / max(v_len, 1e-3), 0.0, 1.0) : 1.0;
  float streak = v_q.x < 0.0 && v_q.x > -v_len ? exp(-v_q.y * v_q.y * 40.0) * (1.0 - s) * (1.0 - s) : 0.0;
  vec3 eng = v_k.x < 0.5 ? vec3(0.45, 0.85, 1.0) : v_k.x < 1.5 ? vec3(1.0, 0.62, 0.3) : vec3(0.7, 0.8, 1.0);
  float blink = step(fract(u_time * 0.7 + v_k.y), 0.1);
  vec3 nav = mix(vec3(1.0, 0.25, 0.2), vec3(0.3, 1.0, 0.45), step(0.5, fract(v_k.y * 7.0)));
  vec3 hull = vec3(1.0, 0.97, 0.9) * (0.35 + 0.65 * v_k.w);
  vec3 col = hull * core * 0.9 + eng * (core * 0.6 + streak * 0.8) + nav * blink * core * 1.4;
  o = vec4(col * v_k.z, 0.0);
}`;
  const TR = { rel: [0, 0, 0], near: [0, 0, 0, 1e12], list: [], inst: new Float32Array(64 * 12), n: 0, p: [0, 0, 0], p2: [0, 0, 0], prog: undefined, vao: null, ib: null, vp: null };
  function trafficProg() {
    if (TR.prog !== undefined) return TR.prog;
    try { TR.prog = VR.GL.program(TVS, TFS, 'ferries.traffic', []); } catch (e) { console.error('ferries shader failed: ' + (e && e.message)); TR.prog = null; }
    return TR.prog;
  }
  function trafficVAO(gl, p) {
    if (TR.vao) return TR.vao;
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    TR.ib = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, TR.ib); gl.bufferData(gl.ARRAY_BUFFER, TR.inst.byteLength, gl.DYNAMIC_DRAW);
    ['a_p', 'a_v', 'a_k'].forEach((nm, i) => { const l = gl.getAttribLocation(p.p, nm); if (l < 0) return; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 4, gl.FLOAT, false, 48, i * 16); gl.vertexAttribDivisor(l, 1); });
    gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return (TR.vao = vao);
  }
  const KN = { ferry: 0, freighter: 1, small: 2 }, SIZE = { ferry: 60, freighter: 140, small: 24 };
  function bodyAt(eph, dim) {
    const id = Fe.BODY[dim];
    if (id === 'swarm') { const c = VR.Fields && VR.Fields.swarmCentre ? VR.Fields.swarmCentre(eph) : null; return c ? { p: c, R: 3000 } : null; }
    const b = eph.bodies[id], B = VR.SpaceScene.BODIES[id]; return b && B ? { p: b.p, R: B.R } : null;
  }
  const IDS = ['herz', 'aqua', 'opal', 'basalt', 'amarant'];
  function hidden(eph, cam, rel, d) {
    for (const id of IDS) {
      const b = eph.bodies[id], B = VR.SpaceScene.BODIES[id]; if (!b || !B) continue;
      const ox = b.p[0] - cam[0], oy = b.p[1] - cam[1], oz = b.p[2] - cam[2], tc = (ox * rel[0] + oy * rel[1] + oz * rel[2]) / d;
      if (tc <= 0 || tc >= d) continue;
      const q = ox * ox + oy * oy + oz * oz - tc * tc; if (q < B.R * B.R * 0.995) return true;
    }
    return false;
  }
  function spaceFrame(g, fr, eph, o) {
    const t0 = performance.now(), E = g.env;
    const tier = LK.tierOf(g.settings), t = E ? ((E.day || 0) * 24000 + (E.ticks || 0)) / 20 : 0;
    const list = Fe.traffic(t, wseedOf(g), tier, TR.list), cam = fr.pos, ax = fr.axes, pxr = (o.H || 720) / fr.fov;
    const far = (g.space && g.space.cam && g.space.cam.far) || (g.cam && g.cam.far) || 100, DF = far * 0.5, I = TR.inst;
    const sun = fr.sunS; let n = 0;
    const rel = TR.rel, NR = TR.near; NR[3] = 1e12;
    for (const c of list) {
      const r = Fe.route(c.route), A = bodyAt(eph, r.a), B = bodyAt(eph, r.b); if (!A || !B) continue;
      Fe.along(A.p, A.R, B.p, B.R, c.u, c.lat, TR.p); Fe.along(A.p, A.R, B.p, B.R, Math.min(1, c.u + 0.001), c.lat, TR.p2);
      rel[0] = TR.p[0] - cam[0]; rel[1] = TR.p[1] - cam[1]; rel[2] = TR.p[2] - cam[2];
      const d = Math.hypot(rel[0], rel[1], rel[2]); if (d < 5 || d > 3e7) continue;
      const vis = 1 - LK.smooth((d - 6e5) / 6e6); if (vis <= 0.01 || hidden(eph, cam, rel, d)) continue;
      let vx = TR.p2[0] - TR.p[0], vy = TR.p2[1] - TR.p[1], vz = TR.p2[2] - TR.p[2]; const vl = Math.hypot(vx, vy, vz) || 1;
      const speed = vl / (0.001 * Fe.TRIP[c.kind]); vx /= vl; vy /= vl; vz /= vl; if (c.dir < 0) { vx = -vx; vy = -vy; vz = -vz; }
      const sx = (rel[0] * ax[0][0] + rel[1] * ax[0][1] + rel[2] * ax[0][2]) / d, sy = (rel[0] * ax[1][0] + rel[1] * ax[1][1] + rel[2] * ax[1][2]) / d, sz = (rel[0] * ax[2][0] + rel[1] * ax[2][1] + rel[2] * ax[2][2]) / d;
      const k = n * 12, rpx = Math.max(2, Math.min(24, SIZE[c.kind] / d * pxr * 0.5));
      I[k] = sx * DF; I[k + 1] = sy * DF; I[k + 2] = sz * DF; I[k + 3] = rpx;
      if (d < NR[3]) { NR[0] = sx; NR[1] = sy; NR[2] = sz; NR[3] = d; }
      I[k + 4] = vx * ax[0][0] + vy * ax[0][1] + vz * ax[0][2]; I[k + 5] = vx * ax[1][0] + vy * ax[1][1] + vz * ax[1][2]; I[k + 6] = vx * ax[2][0] + vy * ax[2][1] + vz * ax[2][2];
      I[k + 7] = Math.min(90, speed * 0.5 / d * pxr + rpx * 2);
      I[k + 8] = KN[c.kind]; I[k + 9] = (c.seed % 997) / 997; I[k + 10] = vis * (c.kind === 'small' ? 0.8 : 1.2);
      I[k + 11] = sun ? clamp(0.5 + 0.5 * -(sx * sun[0] + sy * sun[1] + sz * sun[2]), 0, 1) : 0.5;
      if (++n >= 48) break;
    }
    // the craft in orbit round the worlds
    const ol = Fe.orbiters(t, wseedOf(g), tier, TR.orb || (TR.orb = []));
    for (const c of ol) {
      if (n >= 64) break;
      const b = eph.bodies[c.body], B = VR.SpaceScene.BODIES[c.body]; if (!b || !B) continue;
      const rr = B.R + c.alt, ct = Math.cos(c.th), sn = Math.sin(c.th);
      for (let i = 0; i < 3; i++) TR.p[i] = b.p[i] + rr * (c.e1[i] * ct + c.e2[i] * sn);
      rel[0] = TR.p[0] - cam[0]; rel[1] = TR.p[1] - cam[1]; rel[2] = TR.p[2] - cam[2];
      const d = Math.hypot(rel[0], rel[1], rel[2]); if (d < 5 || d > 3e7) continue;
      const vis = 1 - LK.smooth((d - 6e5) / 6e6); if (vis <= 0.01 || hidden(eph, cam, rel, d)) continue;
      const vx = -c.e1[0] * sn + c.e2[0] * ct, vy = -c.e1[1] * sn + c.e2[1] * ct, vz = -c.e1[2] * sn + c.e2[2] * ct;
      const sx = (rel[0] * ax[0][0] + rel[1] * ax[0][1] + rel[2] * ax[0][2]) / d, sy = (rel[0] * ax[1][0] + rel[1] * ax[1][1] + rel[2] * ax[1][2]) / d, sz = (rel[0] * ax[2][0] + rel[1] * ax[2][1] + rel[2] * ax[2][2]) / d;
      const k = n * 12, rpx = Math.max(2, Math.min(24, SIZE[c.kind] / d * pxr * 0.5)), speed = TAU * rr / 600;
      I[k] = sx * DF; I[k + 1] = sy * DF; I[k + 2] = sz * DF; I[k + 3] = rpx;
      if (d < NR[3]) { NR[0] = sx; NR[1] = sy; NR[2] = sz; NR[3] = d; }
      I[k + 4] = vx * ax[0][0] + vy * ax[0][1] + vz * ax[0][2]; I[k + 5] = vx * ax[1][0] + vy * ax[1][1] + vz * ax[1][2]; I[k + 6] = vx * ax[2][0] + vy * ax[2][1] + vz * ax[2][2];
      I[k + 7] = Math.min(60, speed * 0.5 / d * pxr + rpx * 2);
      I[k + 8] = KN[c.kind]; I[k + 9] = (c.seed % 997) / 997; I[k + 10] = vis * 1.1;
      I[k + 11] = sun ? clamp(0.5 + 0.5 * -(sx * sun[0] + sy * sun[1] + sz * sun[2]), 0, 1) : 0.5;
      n++;
    }
    TR.n = n; Fe.stats.space = n; Fe.stats.near = NR[3] < 1e12 ? NR : null;   // (the nearest craft drawn: its direction in the scene's axes, its distance)
    if (n) fr.draws.push({ prog: 'fe_traffic', fn: drawTraffic, n });
    Fe.stats.spaceMs = performance.now() - t0;
  }
  function drawTraffic(r, d) {
    const gl = r.gl, p = trafficProg(); if (!p || !p.p) return;
    const vao = trafficVAO(gl, p);
    gl.bindBuffer(gl.ARRAY_BUFFER, TR.ib); gl.bufferSubData(gl.ARRAY_BUFFER, 0, TR.inst, 0, d.n * 12); gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.useProgram(p.p);
    const vp = TR.vp || (TR.vp = gl.getParameter(gl.VIEWPORT));
    if (p.u.u_viewProj) gl.uniformMatrix4fv(p.u.u_viewProj, false, r.viewProj);
    if (p.u.u_px) gl.uniform2f(p.u.u_px, 2 / Math.max(1, vp[2]), 2 / Math.max(1, vp[3]));
    if (p.u.u_time) gl.uniform1f(p.u.u_time, (performance.now() / 1000) % 1000);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, d.n); gl.bindVertexArray(r.emptyVAO);
    r.stats.draws++; r.stats.tris += 2 * d.n;
  }
  const SSc = VR.SpaceScene;
  if (SSc && SSc.frameSetup && !SSc._fe) {
    SSc._fe = true;
    const fs0 = SSc.frameSetup;
    SSc.frameSetup = function (Sx, eph, o) {
      const fr = fs0.apply(this, arguments);
      const g = VR.game;
      try { if (fr && g && on(g) && o) { TR.vp = null; spaceFrame(g, fr, eph, o); } } catch (e) { if (!Fe.stats.err) { Fe.stats.err = String((e && e.stack) || e); console.error('ferries space', e); } }
      return fr;
    };
  }

  // ---------------------------------------------------------------- the star map: Helia's trade routes (the home card)
  // a small orrery of Helia's worlds where they are now (log radius), the routes as lines (ferries cyan, freight amber),
  // the craft on them as dots — the same craft as in space, at the same moment
  Fe.drawRoutes = function (cv, g) {
    const U = VR.Universe; if (!cv || !U || !U.home || !U.home.by.amarant) return false;
    const X = cv.getContext('2d'), W = cv.width, H = cv.height, t = VR.StarJump ? VR.StarJump.worldT(g) : 0;
    X.fillStyle = '#050914'; X.fillRect(0, 0, W, H);
    // Amarant's family in the middle (its moons by their distance, log scale), Herzwelt's Aquamarin beside it; Helia and
    // the swarm at the edge in their directions
    const cx = W / 2, cy = H / 2 - 4, R = Math.min(W / 2, H / 2 / 0.62) - 22, xy = {};
    const pA = U.home.pos('amarant', t), rel = (id) => { const v = U.home.pos(id, t); return [v[0] - pA[0], v[1] - pA[1]]; };
    const moons = ['herz', 'opal', 'basalt'].filter(id => U.home.by[id]), ds = moons.map(id => Math.hypot(...rel(id)));
    const dmin = Math.min(...ds), dmax = Math.max(...ds);
    const place = (v, rr) => { const a = Math.atan2(v[1], v[0]); return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.62]; };
    xy.amarant = [cx, cy];
    moons.forEach((id, i) => { xy[id] = place(rel(id), 34 + (Math.log(ds[i] / dmin) / Math.max(0.3, Math.log(dmax / dmin))) * (R - 60)); });
    if (U.home.by.aqua && xy.herz) { const v = U.home.rel('aqua', t), a = Math.atan2(v[1], v[0]); xy.aqua = [xy.herz[0] + Math.cos(a) * 16, xy.herz[1] + Math.sin(a) * 10]; }
    const hel = rel('helia'); xy.helia = place(hel, R + 8);
    if (U.home.by.swarm) xy.swarm = place(rel('swarm'), R - 6);
    // Amarant's orbits
    X.strokeStyle = '#7fd4ff22'; X.lineWidth = 1;
    moons.forEach((id) => { const r = Math.hypot(xy[id][0] - cx, (xy[id][1] - cy) / 0.62); X.beginPath(); X.ellipse(cx, cy, r, r * 0.62, 0, 0, TAU); X.stroke(); });
    const at = (dim) => xy[Fe.BODY[dim]];
    X.lineWidth = 1.6;
    for (const r of Fe.ROUTES) { const a = at(r.a), b = at(r.b); if (!a || !b) continue; X.strokeStyle = r.ferry ? '#7fe8ffcc' : '#ffc27a88'; X.setLineDash(r.ferry ? [] : [5, 4]); X.beginPath(); X.moveTo(a[0], a[1]); X.lineTo(b[0], b[1]); X.stroke(); }
    X.setLineDash([]);
    const list = Fe.traffic(((g.env && g.env.day) || 0) * 1200 + ((g.env && g.env.ticks) || 0) / 20, wseedOf(g), 2, []);
    for (const c of list) { const r = Fe.route(c.route), a = at(r.a), b = at(r.b); if (!a || !b) continue; const u = c.u; X.fillStyle = c.kind === 'ferry' ? '#c8faff' : c.kind === 'freighter' ? '#ffcc88' : '#dfe6ff'; X.beginPath(); X.arc(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, c.kind === 'ferry' ? 2.6 : c.kind === 'freighter' ? 2.2 : 1.5, 0, TAU); X.fill(); }
    X.font = '11px sans-serif'; X.textAlign = 'center';
    const nameOf = (id) => { const b = U.home.by[id]; return b && b.name ? (VR.I18N && VR.I18N.lang !== 'de' ? (b.name.en || b.name.de) : b.name.de) : id; };
    for (const id of Object.keys(xy)) {
      const p = xy[id], big = id === 'amarant' || id === 'helia';
      X.fillStyle = id === 'helia' ? '#fff2c0' : id === 'amarant' ? '#e8c49a' : id === 'swarm' ? '#b9a9a0' : '#9affd8';
      X.beginPath(); X.arc(p[0], p[1], big ? 5.5 : 3.4, 0, TAU); X.fill();
      X.fillStyle = '#cfe3ff'; X.fillText(nameOf(id), p[0], p[1] + (id === 'aqua' ? 14 : -8));
    }
    X.textAlign = 'left'; X.fillStyle = '#cfe3ffcc'; X.fillText(T('g.fe.legend', { n: list.length }), 8, H - 8);
    return true;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
