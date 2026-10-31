// ============================================================================
// u-stations · VR.Stations — space stations you dock at and live in (docs/superpowers/plans/2026-10-31-u-stations.md;
// U§3, §7.4; waves §6.2).
//   · the Ringstation over Herzwelt: fixed in the map on the equator under the Heartland's meridian, 52.9 km up — the
//     geostationary radius ∛(μT²/4π²) for Herzwelt's μ and its 1,200-s day, the planet 81.5° wide there. A wheel of
//     our own: ring radius 160 m, four docking decks on its planet side, a hub with solar wings and a mast with the red
//     beacon; it turns about its zenith axis once in STN.SPIN s. Two outposts on low circles round Basalt and Opal
//   · the shuttles: PadLife's own schedule (PL.visitAt with stays 50–110 s: a touchdown every 60–120 s on the world
//     clock) — the same craft land on the station's hangar deck inside and come up the corridors outside; pure, so
//     host and guests see the same
//   · docking: G near a station in space → the plan (transfer: the Reiseantrieb's short hop, eased, onto the corridor
//     1.2 km under the berth, matched to its turn → the corridor up through five guide gates → align → the clamp) →
//     VR.Travel.go(stn.k) with the ship parked on the berth; G in the parked ship undocks (back into space on the
//     corridor). The pure part is above the line (node: test/stations.js)
// ============================================================================
(function (VR) {
  'use strict';
  const STN = VR.Stations = {};
  const U = () => VR.Universe, PL = () => VR.PadLife;
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const unitInto = (a, o) => { const l = len(a) || 1; o[0] = a[0] / l; o[1] = a[1] / l; o[2] = a[2] / l; return o; };
  const crossInto = (a, b, o) => { const x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0]; o[0] = x; o[1] = y; o[2] = z; return o; };
  const smooth = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const smoother = (u) => { u = clamp(u, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };
  const strHash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; };
  const hh = (seed, n, salt) => { let x = Math.imul((seed | 0) ^ Math.imul(n | 0, 0x27d4eb2d), 0x9e3779b1) ^ (salt | 0); x ^= x >>> 15; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };

  // ---------------------------------------------------------------- the stations
  STN.SPIN = 240;              // s: the ring's turn
  STN.RING_R = 160;            // m: the ring's radius (the mesh: 40 blocks × STN.SCALE)
  STN.SCALE = 4;               // m a block of the station's outside mesh
  STN.DECK_Y = -24;            // m: the decks below the ring's middle plane (its planet side)
  STN.OUT_Y = -14;             // m: an outpost's deck under its hub
  STN.CORR = 1200;             // m: the corridor's mouth under the berth
  STN.APP_END = 60;            // m: the corridor ends, the alignment starts
  STN.CLAMP_D = 7;             // m: the ship's middle under the deck at the clamp
  STN.GATES = [1000, 750, 500, 250, 100];   // m: the guide frames on the corridor
  STN.MAST = 92;               // m: the beacon at the mast's top over the ring's middle
  STN.LIST = {
    ring: { id: 'ring', dim: 'stn.ring', body: 'herz', kind: 0, decks: 4, name: ['g.stn.ring', 'Ringstation', 'Ring Station'] },
    basalt: { id: 'basalt', dim: 'stn.basalt', body: 'basalt', kind: 1, decks: 1, alt: 3200, ph0: 0.6, name: ['g.stn.basalt', 'Außenposten Basalt', 'Basalt Outpost'] },
    opal: { id: 'opal', dim: 'stn.opal', body: 'opal', kind: 1, decks: 1, alt: 2400, ph0: 2.1, name: ['g.stn.opal', 'Außenposten Opal', 'Opal Outpost'] },
  };
  STN.IDS = ['ring', 'basalt', 'opal'];
  STN.byDim = (dim) => { for (const id of STN.IDS) if (STN.LIST[id].dim === dim) return STN.LIST[id]; return null; };
  STN.atBody = (body) => { for (const id of STN.IDS) if (STN.LIST[id].body === body) return STN.LIST[id]; return null; };
  STN.isDim = (dim) => typeof dim === 'string' && dim.charCodeAt(0) === 115 && dim.slice(0, 4) === 'stn.';
  STN.geoRadius = (mu, T) => Math.cbrt(mu * T * T / (4 * PI * PI));
  STN.ringAlt = () => { const b = U().home.body('herz'); return STN.geoRadius(b.mu, b.spin.T) - b.R; };
  // the ring's map place: from the chart's pole along the Heartland's meridian (through the map's origin) to the equator
  let _cp = null;
  STN.chartPos = () => {
    if (_cp) return _cp;
    const ch = U().home.chart('herz'), P = ch.P, L = Math.hypot(P[0], P[1]), d = PI / 2 * ch.R;
    return (_cp = [P[0] - P[0] / L * d, ch.datum + STN.ringAlt(), P[1] - P[1] / L * d]);
  };
  // the station's place in its body's inertial frame: r, v, its axes (A: the zenith — the ring's axis; e1, e2 its plane)
  // and the ring's turn φ
  const _z = [0, 0, 0], _q = [0, 0, 0], _p = [0, 0, 0];
  STN.place = (id, t, out) => {
    const S = U().home, L = STN.LIST[id], o = out || {};
    o.r = o.r || [0, 0, 0]; o.v = o.v || [0, 0, 0]; o.A = o.A || [0, 0, 0]; o.e1 = o.e1 || [0, 0, 0]; o.e2 = o.e2 || [0, 0, 0];
    const B = S.body(L.body), ax = (B.spin && B.spin.axis) || B.axis || [0, 0, 1];
    if (L.kind === 0) {
      S.chartToInertial('herz', STN.chartPos(), _z, t, o.r, o.v);
      unitInto(o.r, o.A); crossInto(ax, o.A, o.e1); unitInto(o.e1, o.e1); crossInto(o.A, o.e1, o.e2);
      o.phi = TAU * (((t / STN.SPIN) % 1) + 1);
    } else {
      // a low circle in the moon's equator plane
      crossInto(ax, Math.abs(ax[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], _q); unitInto(_q, _q); crossInto(ax, _q, _p);
      const rr = B.R + L.alt, n = Math.sqrt(B.mu / (rr * rr * rr)), th = L.ph0 + n * t, c = Math.cos(th), s = Math.sin(th), w = rr * n;
      for (let i = 0; i < 3; i++) { o.r[i] = rr * (c * _q[i] + s * _p[i]); o.v[i] = w * (-s * _q[i] + c * _p[i]); }
      unitInto(o.r, o.A); unitInto(o.v, o.e1); crossInto(o.A, o.e1, o.e2);
      o.phi = 0;
    }
    o.id = id; o.t = t;
    return o;
  };
  // a berth k: its point, its normal (out of the deck, toward the planet), its velocity, the ring's radial there (the
  // ship's up at the clamp)
  const _pl = {}, _pl2 = {};
  function deckPoint(id, k, t, P, out) {
    const L = STN.LIST[id];
    if (L.kind === 0) {
      const a = P.phi + k * PI / 2, c = Math.cos(a), s = Math.sin(a);
      for (let i = 0; i < 3; i++) { const u = c * P.e1[i] + s * P.e2[i]; out[i] = P.r[i] + STN.RING_R * u + STN.DECK_Y * P.A[i]; }
    } else for (let i = 0; i < 3; i++) out[i] = P.r[i] + STN.OUT_Y * P.A[i];
    return out;
  }
  const _a = [0, 0, 0], _b = [0, 0, 0];
  STN.deck = (id, k, t, out) => {
    const o = out || {}, L = STN.LIST[id]; k = L.kind === 0 ? ((k | 0) % 4 + 4) % 4 : 0;
    o.p = o.p || [0, 0, 0]; o.n = o.n || [0, 0, 0]; o.v = o.v || [0, 0, 0]; o.u = o.u || [0, 0, 0];
    const P = STN.place(id, t, _pl);
    deckPoint(id, k, t, P, o.p);
    for (let i = 0; i < 3; i++) o.n[i] = -P.A[i];
    if (L.kind === 0) { const a = P.phi + k * PI / 2; for (let i = 0; i < 3; i++) o.u[i] = Math.cos(a) * P.e1[i] + Math.sin(a) * P.e2[i]; }
    else for (let i = 0; i < 3; i++) o.u[i] = P.e1[i];
    const h = 0.05;
    deckPoint(id, k, t + h, STN.place(id, t + h, _pl2), _a); deckPoint(id, k, t - h, STN.place(id, t - h, _pl2), _b);
    for (let i = 0; i < 3; i++) o.v[i] = (_a[i] - _b[i]) / (2 * h);
    o.k = k;
    return o;
  };
  STN.gate = (id, k, i, t, out) => { const D = STN.deck(id, k, t, {}), o = out || [0, 0, 0], g = STN.GATES[i]; for (let j = 0; j < 3; j++) o[j] = D.p[j] + D.n[j] * g; return o; };
  STN.beacon = (id, t, out) => { const P = STN.place(id, t, _pl), o = out || [0, 0, 0], m = STN.LIST[id].kind === 0 ? STN.MAST : 40; for (let i = 0; i < 3; i++) o[i] = P.r[i] + P.A[i] * m; return o; };
  STN.handoff = (id) => { const L = STN.LIST[id], Pl = VR.Forge && VR.Forge.Station ? VR.Forge.Station.place(L.kind) : null; return { dim: L.dim, at: Pl ? Pl.berth.slice(0, 3) : [0.5, 64, 0.5], yaw: 0 }; };
  STN.nameOf = (id) => { const L = STN.LIST[id], n = L ? L.name : ['', id, id]; return VR.I18N && VR.I18N.tx ? VR.I18N.tx(n[0], null, n[1], n[2]) : n[1]; };

  // ---------------------------------------------------------------- the shuttles (PadLife's schedule)
  STN.PAD_O = { stay0: 50, stay1: 110 };   // the stay at the berth: touchdown to touchdown = stay + PadLife's GAP (10 s)
  STN.APP = 40; STN.DEP = 30;               // s: the way in up the corridor, the way out
  STN.seedOf = (id, wseed) => (strHash('stn:' + id) ^ Math.imul(wseed | 0, 0x9e3779b1)) | 0;
  STN.visits = (id, wseed, t0, t1) => {
    const P = PL(), seed = STN.seedOf(id, wseed), O = STN.PAD_O, c = P.visitAt(seed, t0, null, O), out = [];
    let n = c.n, T = c.T;
    while (T < t0) { T += P.stay(seed, n, O) + P.GAP; n++; }
    for (let k = 0; k < 10000 && T <= t1; k++) { out.push(T); T += P.stay(seed, n, O) + P.GAP; n++; }
    return out;
  };
  // the interior's hangar-deck pad for PadLife (the same seed and stays: the same shuttles land)
  STN.padFor = (id, wseed) => {
    const L = STN.LIST[id], Pl = VR.Forge && VR.Forge.Station ? VR.Forge.Station.place(L.kind) : { pad: [0, 64, -30], hold: 1 };
    return { key: 'stn:' + id, kind: 'stn', seed: STN.seedOf(id, wseed), x: Pl.pad[0], y: Pl.pad[1], z: Pl.pad[2], yaw: 0, out: [0, -1], spread: 0.35, holdSide: Pl.hold || 1, o: STN.PAD_O, serviceAt: null, cache: null, crafts: new Map() };
  };
  // the craft near station `id` at t: [{n, berth, phase ('approach' | 'docked' | 'leave'), u, p, fwd}]
  const _D = {}, _P0 = [0, 0, 0], _P1 = [0, 0, 0], _P2 = [0, 0, 0];
  const bez = (A, B, C, w, o) => { const a = (1 - w) * (1 - w), b = 2 * (1 - w) * w, c = w * w; for (let i = 0; i < 3; i++) o[i] = a * A[i] + b * B[i] + c * C[i]; return o; };
  STN.shuttles = (id, wseed, t, out, cache) => {
    const P = PL(), seed = STN.seedOf(id, wseed), O = STN.PAD_O, L = STN.LIST[id], list = out || [];
    list.length = 0;
    const c = P.visitAt(seed, t, cache && cache.seed === seed ? cache : null, O);
    if (cache) { cache.seed = c.seed; cache.n = c.n; cache.T = c.T; }
    const Tn = c.T, n = c.n, Tm1 = Tn - P.stay(seed, n - 1, O) - P.GAP, Tp1 = Tn + P.stay(seed, n, O) + P.GAP;
    for (const [m, T] of [[n - 1, Tm1], [n, Tn], [n + 1, Tp1]]) {
      const S = P.stay(seed, m, O), Lv = T + S;
      if (t < T - STN.APP || t > Lv + STN.DEP) continue;
      const berth = L.kind === 0 ? 1 + (((m % 3) + 3) % 3) : 0;
      const D = STN.deck(id, berth, t, _D);
      const a = TAU * hh(seed, m, 0x51), ln = [0, 0, 0], side = [0, 0, 0];
      crossInto(D.n, D.u, side);
      for (let i = 0; i < 3; i++) ln[i] = Math.cos(a) * D.u[i] + Math.sin(a) * side[i];
      const cr = { n: m, berth, phase: 'docked', u: 0, p: [0, 0, 0], fwd: [-D.n[0], -D.n[1], -D.n[2]], T, L: Lv };
      const end = STN.CLAMP_D - 2;
      for (let i = 0; i < 3; i++) _P2[i] = D.p[i] + D.n[i] * end;
      if (t < T) {
        cr.phase = 'approach'; cr.u = (t - (T - STN.APP)) / STN.APP;
        for (let i = 0; i < 3; i++) { _P0[i] = D.p[i] + D.n[i] * 3200 + ln[i] * 1600; _P1[i] = D.p[i] + D.n[i] * 700; }
        const w = 1 - (1 - cr.u) * (1 - cr.u);
        bez(_P0, _P1, _P2, w, cr.p);
        const w2 = 1 - Math.pow(1 - Math.min(1, cr.u + 0.01), 2), q = bez(_P0, _P1, _P2, w2, [0, 0, 0]);
        if (cr.u < 0.99) unitInto([q[0] - cr.p[0], q[1] - cr.p[1], q[2] - cr.p[2]], cr.fwd);
      } else if (t > Lv) {
        cr.phase = 'leave'; cr.u = (t - Lv) / STN.DEP;
        for (let i = 0; i < 3; i++) { _P0[i] = D.p[i] + D.n[i] * 3200 - ln[i] * 1600; _P1[i] = D.p[i] + D.n[i] * 700; }
        const w = cr.u * cr.u;
        bez(_P2, _P1, _P0, w, cr.p);
        const q = bez(_P2, _P1, _P0, Math.min(1, (cr.u + 0.01) * (cr.u + 0.01)), [0, 0, 0]);
        if (cr.u > 0.01) { unitInto([cr.p[0] - q[0], cr.p[1] - q[1], cr.p[2] - q[2]], cr.fwd); cr.fwd[0] = -cr.fwd[0]; cr.fwd[1] = -cr.fwd[1]; cr.fwd[2] = -cr.fwd[2]; }
      } else { for (let i = 0; i < 3; i++) cr.p[i] = _P2[i]; cr.u = (t - T) / S; }
      cr.up = D.u.slice();
      list.push(cr);
    }
    return list;
  };

  // ---------------------------------------------------------------- docking: the plan and the pose at s seconds
  STN.T2 = 14; STN.T3 = 3.5; STN.T4 = 1.4;
  STN.dockPlan = (id, k, t0, P0, V0) => {
    const D = STN.deck(id, k, t0 + 8, {}), C = [0, 0, 0];
    for (let i = 0; i < 3; i++) C[i] = D.p[i] + D.n[i] * STN.CORR;
    const dist = Math.hypot(C[0] - P0[0] - V0[0] * 8, C[1] - P0[1] - V0[1] * 8, C[2] - P0[2] - V0[2] * 8);
    const T1 = clamp(5 + dist / 30000, 5, 11);
    return { id, k, t0, P0: Array.from(P0), V0: Array.from(V0), T1, T2: STN.T2, T3: STN.T3, T4: STN.T4, dur: T1 + STN.T2 + STN.T3 + STN.T4, dist, dock: true };
  };
  const _Dk = {}, _B = [0, 0, 0], _C = [0, 0, 0];
  STN.dockAt = (J, s, out) => {
    const o = out || {}; o.p = o.p || [0, 0, 0]; o.fwd = o.fwd || [0, 0, 0]; o.up = o.up || [0, 0, 0];
    s = clamp(s, 0, J.dur);
    const t = J.t0 + s, D = STN.deck(J.id, J.k, t, _Dk);
    let d;
    if (s < J.T1) {
      const w = smoother(s / J.T1);
      for (let i = 0; i < 3; i++) { _B[i] = J.P0[i] + J.V0[i] * s; _C[i] = D.p[i] + D.n[i] * STN.CORR; o.p[i] = _B[i] + (_C[i] - _B[i]) * w; }
      o.phase = 'transfer'; d = STN.CORR;
      // the nose: along the way first, up into the corridor at the end
      const vx = (_C[0] - _B[0]), vy = (_C[1] - _B[1]), vz = (_C[2] - _B[2]), vl = Math.hypot(vx, vy, vz) || 1, k = smooth((s / J.T1 - 0.55) / 0.45);
      for (let i = 0; i < 3; i++) o.fwd[i] = [vx, vy, vz][i] / vl * (1 - k) - D.n[i] * k;
      unitInto(o.fwd, o.fwd);
      o.u = s / J.T1;
    } else if (s < J.T1 + J.T2) {
      const u = (s - J.T1) / J.T2; d = STN.CORR + (STN.APP_END - STN.CORR) * smooth(u);
      o.phase = 'corridor'; o.u = u;
    } else if (s < J.T1 + J.T2 + J.T3) {
      const u = (s - J.T1 - J.T2) / J.T3; d = STN.APP_END + (STN.CLAMP_D - STN.APP_END) * smooth(u);
      o.phase = 'align'; o.u = u;
    } else { d = STN.CLAMP_D; o.phase = 'clamp'; o.u = (s - J.T1 - J.T2 - J.T3) / J.T4; }
    if (o.phase !== 'transfer') { for (let i = 0; i < 3; i++) { o.p[i] = D.p[i] + D.n[i] * d; o.fwd[i] = -D.n[i]; } }
    for (let i = 0; i < 3; i++) o.up[i] = D.u[i];
    o.d = d; o.s = s;
    return o;
  };
  // undocking: the ship set out on the corridor 140 m under the berth, moving away at 14 m/s (plus the deck's own motion)
  STN.undockState = (id, k, t, out) => {
    const D = STN.deck(id, k, t, {}), o = out || {}; o.r = [0, 0, 0]; o.v = [0, 0, 0];
    for (let i = 0; i < 3; i++) { o.r[i] = D.p[i] + D.n[i] * 140; o.v[i] = D.v[i] + D.n[i] * 14; }
    o.fwd = D.n.slice(); o.up = D.u.slice();
    return o;
  };
  // the station in a ship's frame (its body's inertial frame) nearest to P: {id, d}
  STN.nearIn = (frame, P, t) => {
    let best = null;
    for (const id of STN.IDS) {
      const L = STN.LIST[id]; if (L.body !== frame) continue;
      const q = STN.place(id, t, _pl), d = Math.hypot(q.r[0] - P[0], q.r[1] - P[1], q.r[2] - P[2]);
      if (!best || d < best.d) best = { id, d };
    }
    return best;
  };

  // ---------------------------------------------------------------- the station's jobs (Stationsaufträge, pure)
  // two at a time per station and game day: a delivery (things the station needs, from the worlds round it) and a
  // photo (a sight from the hall's window); paid in Heliataler through the Abenteuer's quest award
  STN.JOBS = [
    { id: 'ice', kind: 'bring', item: 'ice', n: 16, size: 'M', at: ['ring', 'basalt'] },
    { id: 'iron', kind: 'bring', item: 'iron_ingot', n: 8, size: 'M', at: ['ring', 'opal'] },
    { id: 'wheat', kind: 'bring', item: 'wheat', n: 12, size: 'S', at: ['ring', 'basalt', 'opal'] },
    { id: 'glow', kind: 'bring', item: 'glowstone_dust', n: 6, size: 'S', at: ['ring'] },
    { id: 'photo', kind: 'photo', size: 'S', at: ['ring', 'basalt', 'opal'] },
  ];
  STN.jobsFor = (id, day, wseed) => {
    const L = STN.JOBS.filter(j => j.at.indexOf(id) >= 0 && j.kind === 'bring'), a = L[Math.floor(hh(STN.seedOf(id, wseed), day | 0, 0x10b) * L.length)];
    return [a, STN.JOBS.find(j => j.kind === 'photo')].filter(Boolean);
  };
  STN.REWARD = { S: 25, M: 60 };   // Heliataler (the quest award's own by size; shown on the board)

  // every text key this file uses (test/stations.js checks both tables)
  STN.keys = () => ['g.stn.ring', 'g.stn.basalt', 'g.stn.opal', 'g.dim.stnRing', 'g.dim.stnBasalt', 'g.dim.stnOpal', 'g.stn.dockGo', 'g.stn.corridor', 'g.stn.align', 'g.stn.clamp', 'g.stn.docked',
    'g.stn.tooFar', 'g.stn.undock', 'g.stn.undockGo', 'g.stn.site', 'g.stn.hud', 'g.stn.shop', 'g.stn.board', 'g.stn.jobs', 'g.stn.job.bring', 'g.stn.job.photo', 'g.stn.job.done', 'g.stn.job.need',
    'g.stn.job.take', 'g.stn.job.hand', 'g.stn.job.open', 'g.stn.welcome', 'g.stn.first', 'g.shop.name.station', 'g.set.stations', 'g.set.stations.tip', 'g.fg.stnRing', 'g.fg.stnOutpost', 'g.fg.stnHall',
    'g.fg.stnDeck3', 'g.fg.stnDeck2', 'g.fg.stnShop', 'g.fg.stnCabins', 'g.fg.stnGarden', 'g.fg.stnBunks', 'g.stn.shuttle', 'g.stn.beacon'];
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
