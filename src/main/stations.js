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
    ring: { id: 'ring', dim: 'stn.ring', body: 'herz', kind: 0, decks: 4, name: ['g.stn.ring', 'Ringstation', 'Ringstation'] },
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
    { id: 'copper', kind: 'bring', item: 'copper_ingot', n: 10, size: 'S', at: ['ring'] },
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
    'g.fg.stnDeck3', 'g.fg.stnDeck2', 'g.fg.stnShop', 'g.fg.stnCabins', 'g.fg.stnGarden', 'g.fg.stnBunks', 'g.stn.shuttle', 'g.stn.beacon', 'g.stn.dockHint', 'g.stn.need'];

  // ================================================================ u-stations2 (docs/superpowers/plans/2026-10-31-u-stations2.md)
  // ---------------------------------------------------------------- the station generator's version in the save
  // meta.universe.sgen (like u-fields2's rgen): a save that has stood in a station dim keeps sgen 1 (its saved chunks were
  // generated by v0.54's hall); every other save gets STN.SGEN (the dressed hall, forge_station.js STA.dress). Guests are
  // not stamped (the host's comes with the world).
  STN.SGEN = 2;
  STN.stampS = function (meta) {
    if (!meta || meta.guest) return meta;
    const u = meta.universe || (meta.universe = { v: 1 });
    if (!(u.sgen > 0)) { const was = [meta.dim].concat(Object.keys(meta.pos || {})).some(d => /^stn\./.test(String(d || ''))) || !!(meta.stations && meta.stations.first && Object.keys(meta.stations.first).length); u.sgen = was ? 1 : STN.SGEN; }
    return meta;
  };
  STN.sgenOf = (meta) => { const u = meta && meta.universe; return u && u.sgen > 0 ? u.sgen : STN.SGEN; };

  // ---------------------------------------------------------------- the deck life (pure: the world clock, host = guest)
  // The Ringstation's hall lives: a barista at the café's counter (working, then talking to the guests), café guests on
  // their stools, two people at the window wall (one points at the planet now and then), one on a bench facing the glass,
  // a dock worker carrying crates from the airlock to the berth, a walker crossing the hall from the cabins to the shop;
  // a drone circling over the holo table and one over the deck. The tiers: 0 (Very Low) four people, no drone; 1 seven and
  // a drone; 2 eight and two. → [{role, kind ('folk' | 'drone'), seed, pos, yaw, state, walk, walkAmt, talking, headYaw}]
  const yawTo = (dx, dz) => Math.atan2(-dx, -dz);   // (LifeKit.yawOf: a figure facing −z has yaw 0)
  const FYd = 64;
  const LIFE = [
    // [role, the lowest tier, seed]
    ['barista', 0, 11], ['guest', 0, 23], ['watcher', 0, 37], ['watcher', 0, 41],
    ['guest', 1, 53], ['sitter', 1, 67], ['docker', 1, 79], ['walker', 2, 97],
    ['hall', 1, 0], ['deck', 2, 0],
  ];
  STN.LIFE = LIFE;
  const seg = (A, B, u, o) => { o[0] = A[0] + (B[0] - A[0]) * u; o[1] = A[1] + (B[1] - A[1]) * u; o[2] = A[2] + (B[2] - A[2]) * u; return o; };
  STN.deckLife = function (t, tier, out) {
    out = out || []; out.length = 0;
    let gi = 0, wi = 0;
    for (let i = 0; i < LIFE.length; i++) {
      const L = LIFE[i]; if (tier < L[1]) continue;
      const role = L[0], drone = role === 'hall' || role === 'deck';
      const q = { role: drone ? role : role, kind: drone ? 'drone' : 'folk', seed: L[2], pos: [0, FYd, 0], yaw: 0, state: 'idle', walk: 0, walkAmt: 0, talking: false, headYaw: 0 };
      if (role === 'barista') {
        // 16 s: at the machine (work), 2 s along the counter, 4 s talking to the guests, 2 s back
        const c = ((t % 16) + 16) % 16, A = [-17.4, FYd, 12.6], B = [-15.6, FYd, 12.6];
        if (c < 8) { seg(A, A, 0, q.pos); q.state = 'work'; q.yaw = yawTo(0, 1); }
        else if (c < 10) { const u = smooth((c - 8) / 2); seg(A, B, u, q.pos); q.walk = u * 1.8; q.walkAmt = 1; q.yaw = yawTo(1, 0); }
        else if (c < 14) { seg(B, B, 0, q.pos); q.state = 'talk'; q.talking = true; q.yaw = yawTo(-0.3, -1); }
        else { const u = smooth((c - 14) / 2); seg(B, A, u, q.pos); q.walk = 1.8 + u * 1.8; q.walkAmt = 1; q.yaw = yawTo(-1, 0); }
      } else if (role === 'guest') {
        // on the stools either side of the first table, talking in turns
        const side = gi++ ? 1 : -1, x = -16 + side + 0.5;
        q.pos[0] = x; q.pos[1] = FYd + 0.25; q.pos[2] = 8.5; q.state = 'sit'; q.yaw = yawTo(-side, 0);
        q.talking = (Math.floor(t / 3.5) & 1) === (side > 0 ? 1 : 0);
      } else if (role === 'watcher') {
        // at the window wall, looking out at the planet; the second points at it now and then
        const k = wi++;
        q.pos[0] = k ? 1.6 : -1.8; q.pos[2] = k ? -5.6 : -5.4; q.yaw = yawTo(k ? -0.15 : 0.1, -1);
        q.headYaw = 0.35 * Math.sin(t * 0.21 + k * 2);
        if (k && ((t % 14) + 14) % 14 < 3.2) { q.state = 'point'; q.headYaw = 0; }
        q.talking = k === 0 && ((t % 14) + 14) % 14 > 3.2 && ((t % 14) + 14) % 14 < 6;
      } else if (role === 'sitter') {
        q.pos[0] = -14.5; q.pos[1] = FYd + 0.25; q.pos[2] = -2.5; q.state = 'sit'; q.yaw = 0; q.headYaw = 0.25 * Math.sin(t * 0.13);
      } else if (role === 'docker') {
        // 26 s: lifts a crate (work 4 s), carries it to the berth's edge (9 s), sets it down (3 s), back (9 s), 1 s pause
        const c = ((t % 26) + 26) % 26, A = [-1.5, FYd, -14.5], B = [-5.5, FYd, -20.2], D = Math.hypot(B[0] - A[0], B[2] - A[2]);
        if (c < 4) { seg(A, A, 0, q.pos); q.state = 'work'; q.yaw = yawTo(-0.4, 1); }
        else if (c < 13) { const u = (c - 4) / 9; seg(A, B, u, q.pos); q.state = 'carry'; q.walk = u * D; q.walkAmt = 1; q.yaw = yawTo(B[0] - A[0], B[2] - A[2]); }
        else if (c < 16) { seg(B, B, 0, q.pos); q.state = 'crouch'; q.yaw = yawTo(B[0] - A[0], B[2] - A[2]); }
        else if (c < 25) { const u = (c - 16) / 9; seg(B, A, u, q.pos); q.walk = D + u * D; q.walkAmt = 1; q.yaw = yawTo(A[0] - B[0], A[2] - B[2]); }
        else { seg(A, A, 0, q.pos); q.yaw = yawTo(-0.4, 1); }
      } else if (role === 'walker') {
        // the cabins' door → the holo table (a look, 5 s) → the shop's door, and back: 80 s
        const c = ((t % 80) + 80) % 80, W0 = [-19.5, FYd, 1.6], M = [0.5, FYd, 1.6], W1 = [19.5, FYd, 1.6], v = 1.25, d = 20, tw = d / v;
        const legs = [[W0, M, tw], [M, M, 5], [M, W1, tw], [W1, W1, 4], [W1, M, tw], [M, M, 5], [M, W0, tw], [W0, W0, 4]];
        let a = c * (80 / legs.reduce((s, l) => s + l[2], 0)), walked = 0;
        for (const [P0, P1, T0] of legs) {
          if (a <= T0) { const u = a / T0, mv = P0 !== P1; seg(P0, P1, u, q.pos); q.walkAmt = mv ? 1 : 0; q.walk = walked + (mv ? u * d : 0); q.yaw = mv ? yawTo(P1[0] - P0[0], 0) : P0 === M ? yawTo(0, 1) : yawTo(P0[0] < 0 ? 1 : -1, 0); break; }
          a -= T0; if (P0 !== P1) walked += d;
        }
      } else if (role === 'hall') {
        const a = t * TAU / 24; q.pos[0] = 0.5 + Math.cos(a) * 4.5; q.pos[1] = FYd + 5.4 + 0.3 * Math.sin(t * 0.9); q.pos[2] = 4.5 + Math.sin(a) * 4.5; q.yaw = yawTo(-Math.sin(a), Math.cos(a));
      } else if (role === 'deck') {
        const a = t * TAU / 30; q.pos[0] = 12 + Math.sin(a) * 6; q.pos[1] = FYd + 3.2 + 0.4 * Math.sin(t * 0.7); q.pos[2] = -22 + Math.sin(2 * a) * 3; q.yaw = yawTo(Math.cos(a) * 6, Math.cos(2 * a) * 6);
      }
      out.push(q);
    }
    return out;
  };

  // ---------------------------------------------------------------- the meshes' grids (pure; the game part meshes them)
  const st = (n, pr) => { const t = VR.R && VR.R.byName[n]; return t ? (pr ? t.state(pr) : t.defaultState) : 0; };
  function grid(sx, sy, sz) { const b = new Uint16Array(sx * sy * sz); return { sx, sy, sz, blocks: b, set(x, y, z, s) { if (x >= 0 && y >= 0 && z >= 0 && x < sx && y < sy && z < sz) b[(y * sz + z) * sx + x] = s; } }; }
  // the Ringstation: 96 × 32 × 96 blocks of 4 m — the ring (radius 40, a 5 × 5 tube), four spokes, the hub, the mast with
  // the red beacon, two solar wings, four decks on the ring's planet side (y 0 … 3).
  // u-stations2: a built thing, not a toy — the hull in panels (white and grey sectors, a dark band with radiator fins every
  // 45°), two rows of warm windows on the outer face and one on the inner, white running lights on the top instead of the
  // cyan strip, the spokes grey with amber markers, the hub's band in warm windows, red and green docking lights at the
  // decks' corners
  STN.ringGrid = function (Gd0, z0, z1) {
    const Gd = Gd0 || grid(96, 32, 96), C = 48, za = z0 === undefined ? 0 : z0, zb = z1 === undefined ? 96 : z1;
    const W = st('hull_plating'), GR = st('hull_plating_gray'), DK = st('hull_plating_dark'), AM = st('neon_amber'), WIN = st('window_warm'), BM = st('black_metal'), SOL = st('blue_stained_glass'), RED = st('beacon_red'), GN = st('neon_lime'), ANT = st('antenna'), HZ = st('hazard_stripes'), TT = st('vx_tech_trim'), LT = st('light_panel', { facing: 4 }) || st('neon_white') || W;
    for (let z = za; z < zb; z++) for (let x = 0; x < 96; x++) {
      const dx = x + 0.5 - C, dz = z + 0.5 - C, r = Math.hypot(dx, dz), a = Math.atan2(dz, dx), deg = ((a / PI * 180) % 360 + 360) % 360;
      const sector = Math.floor(deg / 22.5), inS = deg - sector * 22.5, band = inS < 2.4, cell = Math.floor((a + PI) / TAU * 200);
      const panel = band ? DK : (sector & 1 ? GR : W);
      if (r >= 37.5 && r <= 42.5) for (let y = 4; y <= 8; y++) {
        let s = panel;
        if (y === 4) s = DK;
        else if (y === 8) s = band ? DK : (Math.abs(r - 40) < 0.6 && cell % 10 === 0 ? LT : (r > 41.6 || r < 38.4) ? TT : panel);
        else if (r > 41.6) s = band ? (y === 6 ? BM : DK) : (y === 5 || y === 7) ? (cell % 4 === 3 ? panel : WIN) : TT;
        else if (r < 38.4) s = band ? DK : y === 6 ? (cell % 3 === 2 ? panel : WIN) : panel;
        Gd.set(x, y, z, s);
      }
      // radiator fins on the bands: dark plates standing off the outer face
      if (r > 42.5 && r <= 45.5 && Math.abs(inS - 1.2) < 0.9 && sector % 2 === 0) for (let y = 5; y <= 7; y++) Gd.set(x, y, z, y === 6 ? BM : DK);
      // the hub
      if (r <= 6.5) for (let y = 2; y <= 14; y++) Gd.set(x, y, z, y === 10 && r > 5.5 ? (cell % 3 === 0 ? TT : WIN) : y === 2 ? DK : (r > 5.5 && y % 4 === 0 ? TT : (r > 5.5 && y === 6 && cell % 2 === 0 ? WIN : W)));
      // the spokes (between the decks)
      for (let k = 0; k < 4; k++) {
        const sa = PI / 4 + k * PI / 2, ux = Math.cos(sa), uz = Math.sin(sa), al = dx * ux + dz * uz, ac = Math.abs(-dx * uz + dz * ux);
        if (al > 6 && al < 38 && ac <= 1.5) for (let y = 5; y <= 7; y++) Gd.set(x, y, z, ac > 0.9 ? BM : (Math.floor(al) % 8 === 0 && y === 7 ? LT : GR));   // (white markers: an amber or cyan one tints the whole spoke — the mesher's light)
      }
      // the decks: under the ring at 0°, 90°, 180°, 270°
      for (let k = 0; k < 4; k++) {
        const da = k * PI / 2, ux = Math.cos(da), uz = Math.sin(da), al = dx * ux + dz * uz, ac = -dx * uz + dz * ux;
        if (Math.abs(al - 40) <= 5 && Math.abs(ac) <= 5) for (let y = 0; y <= 3; y++) {
          const ea = Math.abs(al - 40) > 4.4, eb = Math.abs(ac) > 4.4, edge = ea || eb, corner = ea && eb;
          const mid = (ea && Math.abs(ac) < 0.8) || (eb && Math.abs(al - 40) < 0.8);   // (amber only mid-edge: a row of it turned the deck into a yellow lump)
          Gd.set(x, y, z, y === 0 ? (corner ? (ac > 0 ? GN : RED) : edge ? HZ : DK) : y === 3 ? GR : (edge && y === 1 ? (corner ? (ac > 0 ? GN : RED) : mid ? AM : DK) : GR));
        }
      }
    }
    if (zb < 96) return Gd;
    // the mast, its beacon, the wings on their boom
    for (let y = 15; y <= 29; y++) Gd.set(C, y, C, y === 29 ? ANT : BM);
    Gd.set(C, 30, C, RED); Gd.set(C - 1, 30, C, RED);
    for (let z = 26; z <= 70; z++) { if (z > 44 && z < 52) continue; for (let x = C - 3; x <= C + 2; x++) Gd.set(x, 20, z, x === C - 3 || x === C + 2 || z % 6 === 2 ? BM : SOL); }
    for (let z = 44; z <= 52; z++) Gd.set(C, 20, z, BM);
    return Gd;
  };
  // an outpost: a hub, one deck under it, a short mast, one wing
  STN.outpostGrid = function () {
    const Gd = grid(28, 18, 28), C = 14;
    const W = st('vx_tech_white'), DK = st('hull_plating_dark'), AM = st('neon_amber'), BM = st('black_metal'), SOL = st('blue_stained_glass'), RED = st('beacon_red'), GN = st('neon_lime'), HZ = st('hazard_stripes'), WIN = st('window_warm'), TT = st('vx_tech_trim');
    for (let z = 0; z < 28; z++) for (let x = 0; x < 28; x++) {
      const dx = x + 0.5 - C, dz = z + 0.5 - C, r = Math.hypot(dx, dz);
      if (r <= 4.5) for (let y = 1; y <= 10; y++) Gd.set(x, y, z, y === 6 && r > 3.6 ? WIN : y === 9 && r > 3.6 ? TT : W);
      if (Math.abs(dx) <= 5 && Math.abs(dz) <= 5) Gd.set(x, 0, z, Math.abs(dx) > 4.4 || Math.abs(dz) > 4.4 ? HZ : DK);
      if ((Math.abs(dx) > 4.4 || Math.abs(dz) > 4.4) && Math.abs(dx) <= 5 && Math.abs(dz) <= 5) Gd.set(x, 1, z, Math.abs(dx) > 4.4 && Math.abs(dz) > 4.4 ? (dx > 0 ? GN : RED) : AM);
    }
    for (let y = 11; y <= 15; y++) Gd.set(C, y, C, BM);
    Gd.set(C, 16, C, RED);
    for (let x = 0; x < 28; x++) { if (Math.abs(x + 0.5 - C) < 5) continue; for (let z = C - 2; z <= C + 1; z++) Gd.set(x, 8, z, z === C - 2 || x % 5 === 0 ? BM : SOL); }
    return Gd;
  };
  // a guide gate: a dark frame, amber corners, a cyan light in the middle of each side
  STN.gateGrid = function () {
    const Gd = grid(9, 1, 9), CY = st('neon_cyan'), AM = st('neon_amber'), DK = st('hull_plating_dark');
    for (let z = 0; z < 9; z++) for (let x = 0; x < 9; x++) if (x === 0 || z === 0 || x === 8 || z === 8) Gd.set(x, 0, z, (x === 0 || x === 8) && (z === 0 || z === 8) ? AM : (x === 4 || z === 4) ? CY : DK);
    return Gd;
  };
  // a station shuttle: 5 × 3 × 11, the nose toward −z
  STN.shuttleGrid = function () {
    const Gd = grid(5, 3, 11), W = st('vx_hull_white'), GL = st('tinted_glass'), CY = st('neon_cyan'), RD = st('neon_magenta'), GN = st('neon_lime'), DK = st('hull_plating_dark');
    for (let z = 0; z < 11; z++) for (let y = 0; y < 3; y++) for (let x = 0; x < 5; x++) {
      const tip = z < 2 && (x === 0 || x === 4 || y === 2);
      if (tip) continue;
      let s = W;
      if (z <= 2 && y >= 1 && x >= 1 && x <= 3) s = GL;
      if (z === 10) s = (x === 2 && y === 1) || (x !== 2 && y === 1 && (x === 1 || x === 3)) ? CY : DK;
      if (y === 0) s = DK;
      Gd.set(x, y, z, s);
    }
    Gd.set(0, 1, 6, RD); Gd.set(4, 1, 6, GN);
    return Gd;
  };

})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));

// ============================================================================ the game part (VR.Game present)
// the station's outside as voxel meshes in the space frame (spaceflight.js's marked hook), its beacon far away, the
// docking and the undocking, the station's own sky (the space scene behind the station dims' blocks), the shuttles on
// the hangar deck (a PadLife pad), the crew, the shop 🛰 and the job board. Switch: settings.stations (⚙ Bild).
(function (VR) {
  'use strict';
  const STN = VR.Stations, G0 = VR.Game, SF = VR.SpaceFlight, A = VR.Ascent;
  if (!STN || !G0 || !SF || !A || typeof document === 'undefined') return;
  const U = () => VR.Universe, T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const PI = Math.PI, D2R = PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const nrm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const on = (g) => !(g && g.settings && g.settings.stations === false);
  const wseedOf = (g) => ((g && g.meta && g.meta.seed) | 0);
  const worldT = (g) => (g && g.env ? U().worldSeconds(g.env.day | 0, g.env.ticks) : 0);
  STN.stats = { meshes: 0, drawn: 0, shuttles: 0, glare: 0, dockMs: [], err: null, phase: null, frames: 0, interior: 0 };
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'stations', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.stations', tip: 'g.set.stations.tip', cost: 'low', def: true });

  // u-stations2: the hand-off — the minimap's whole re-do passes while the station streams in spread over frames
  if (VR.MapView) VR.MapView.budgetIf = (g) => STN.inStation(g);
  // u-stations2: the station generator's version in the save (Bodies.stamp / bgenOf wrapped: genOpts.bgen.stn)
  { const BD = VR.Bodies; if (BD && BD.stamp && !BD.__stn2) { BD.__stn2 = true; const s0 = BD.stamp, b0 = BD.bgenOf; BD.stamp = function (meta) { const m = s0.apply(this, arguments); STN.stampS(meta); return m; }; BD.bgenOf = function (meta) { const o = b0.apply(this, arguments); if (o) o.stn = STN.sgenOf(meta); return o; }; } }
  // ---------------------------------------------------------------- the meshes (the grids: the pure part above → the worker's shipmesh job)
  const MESH = { ring: { grid: 'ringGrid', piv: [48, 6, 48], s: STN.SCALE }, outpost: { grid: 'outpostGrid', piv: [14, 3.5, 14], s: STN.SCALE }, gate: { grid: 'gateGrid', piv: [4.5, 0.5, 4.5], s: 3.2 }, shuttle: { grid: 'shuttleGrid', piv: [2.5, 1.5, 5.5], s: 1.6 } };
  const M = STN.meshes = {};
  // (the ring's grid is filled a few rows a frame — 12 of 96 — so no frame pays for all of it; then the worker meshes it)
  function meshOf(g, key) {
    const m = M[key]; if (m && m.gpu) return m;
    if (m && !m.rows) return null;   // (in a worker, or its sections on their way to the GPU)
    if (!g.pool || !g.renderer || !g.renderer.uploadShip) return null;
    const rec = m || (M[key] = { gpu: null, modelMat: new Float32Array(16), normalMat: new Float32Array(9), clipNear: 0, rows: key === 'ring' ? { Gd: null, z: 0 } : null });
    let Gd;
    if (rec.rows) { const R0 = rec.rows; R0.Gd = STN.ringGrid(R0.Gd, R0.z, Math.min(96, R0.z + 12)); R0.z += 12; if (R0.z < 96) return null; Gd = R0.Gd; rec.rows = null; }
    else Gd = STN[MESH[key].grid]();
    const copy = Gd.blocks.slice();
    let wi = 0; g.pool.workers.forEach((wk, i) => { if (wk.inflight < g.pool.workers[wi].inflight) wi = i; });
    g.pool.direct(wi, { type: 'shipmesh', sx: Gd.sx, sy: Gd.sy, sz: Gd.sz, blocks: copy }, [copy.buffer], (msg) => { if (msg.type === 'shipmesh') { rec.queue = msg.sections; rec.parts = []; } });   // (uploaded two sections a frame: STN.prepare)
    return null;
  }
  // the meshes asked for from the frame (not the draw: a frame may be drawn rarely) while a station's world is near
  STN.prepare = function (g) {
    const a = g.flight && g.flight.asc; if (!a || !on(g)) return;
    const L = STN.atBody(a.st.frame); if (!L) return;
    for (const k in M) { const m = M[k]; if (m.queue) { for (const o of g.renderer.uploadShip(m.queue.splice(0, 2))) m.parts.push(o); if (!m.queue.length) { m.gpu = m.parts; m.queue = null; m.parts = null; STN.stats.meshes++; } } }
    const P = STN.place(L.id, a.st.t, _P), d = Math.hypot(P.r[0] - a.st.r[0], P.r[1] - a.st.r[1], P.r[2] - a.st.r[2]);
    if (d < 200000) { meshOf(g, L.kind === 0 ? 'ring' : 'outpost'); meshOf(g, 'gate'); meshOf(g, 'shuttle'); }
  };
  // the camera's place (body-inertial) and its local frame (row-major local → inertial; columns east, up, south)
  const _M = new Float64Array(9), _cr = [0, 0, 0], _cv = [0, 0, 0];
  function camInertial(g, cam, st0, b) {
    const S = U().home;
    if (st0.frame === 'herz') { S.chartToInertial('herz', [cam.x, cam.y, cam.z], null, st0.t, _cr, _cv); A.localM(cam.x, cam.z, st0.t, _M); }
    else { A.localFrame(st0, _M); const dx = cam.x - b.pos[0], dy = cam.y - b.pos[1], dz = cam.z - b.pos[2]; for (let i = 0; i < 3; i++) _cr[i] = st0.r[i] + _M[i * 3] * dx + _M[i * 3 + 1] * dy + _M[i * 3 + 2] * dz; }
    return _cr;
  }
  const toLocal = (v) => [_M[0] * v[0] + _M[3] * v[1] + _M[6] * v[2], _M[1] * v[0] + _M[4] * v[1] + _M[7] * v[2], _M[2] * v[0] + _M[5] * v[1] + _M[8] * v[2]];
  // a mesh's matrices: grid axes gx, gy (inertial unit vectors; gz = gx × gy), its pivot at inertial P, the camera at C
  function place(m, key, gx, gy, P, C) {
    const D = MESH[key], s = D.s, gz = cross(gx, gy), X = toLocal(gx), Y = toLocal(gy), Z = toLocal(gz), tr = toLocal([P[0] - C[0], P[1] - C[1], P[2] - C[2]]);
    const mm = m.modelMat, nm = m.normalMat, pv = D.piv;
    for (let i = 0; i < 3; i++) { mm[i] = X[i] * s; mm[4 + i] = Y[i] * s; mm[8 + i] = Z[i] * s; mm[12 + i] = tr[i] - (X[i] * pv[0] + Y[i] * pv[1] + Z[i] * pv[2]) * s; nm[i] = X[i]; nm[3 + i] = Y[i]; nm[6 + i] = Z[i]; }
    mm[3] = mm[7] = mm[11] = 0; mm[15] = 1;
    return len(tr);
  }
  // one instance list per mesh kind (the gates and the shuttles are several)
  const inst = { gate: [], shuttle: [] };
  const instOf = (key, i) => { const L = inst[key]; while (L.length <= i) L.push({ gpu: null, modelMat: new Float32Array(16), normalMat: new Float32Array(9), clipNear: 0 }); const o = L[i]; o.gpu = M[key].gpu; return o; };
  const _P = {}, _D = {}, _sh = [], _shc = {};
  // spaceflight.js's space frame, opaque and translucent: the station near the ship, its gates, its shuttles
  STN.drawSpace = function (g, r, E, layer) {
    try {
      const fl = g && g.flight, a = fl && fl.asc; if (!a || !on(g)) return;
      const st0 = a.st, L = STN.atBody(st0.frame); if (!L) return;
      const cam = r.cam, t = st0.t, C = camInertial(g, cam, st0, fl.b);
      const P = STN.place(L.id, t, _P), d = Math.hypot(P.r[0] - C[0], P.r[1] - C[1], P.r[2] - C[2]);
      if (d > 200000) return;
      const key = L.kind === 0 ? 'ring' : 'outpost', m = meshOf(g, key); let n = 0;
      meshOf(g, 'gate'); meshOf(g, 'shuttle');   // (asked for early: in a worker while the ship is still far)
      if (d > 16000) return;
      if (m) {
        const c = Math.cos(P.phi), s = Math.sin(P.phi), gx = [0, 1, 2].map(i => c * P.e1[i] + s * P.e2[i]);
        place(m, key, gx, P.A, P.r, C); r.drawShip(m, E, layer); n++;
      }
      // the gates of berth 0 (always: they are the station's lights in the dark), the shuttles near
      const gm = meshOf(g, 'gate');
      if (gm) {
        const Dk = STN.deck(L.id, 0, t, _D), side = cross(Dk.n, Dk.u);
        for (let i = 0; i < STN.GATES.length; i++) { const o = instOf('gate', i), p = [0, 1, 2].map(j => Dk.p[j] + Dk.n[j] * STN.GATES[i]); place(o, 'gate', Dk.u, Dk.n, p, C); r.drawShip(o, E, layer); n++; }
        void side;
      }
      const sm = meshOf(g, 'shuttle');
      if (sm) {
        const list = STN.shuttles(L.id, wseedOf(g), t, _sh, _shc); let k = 0;
        for (const cr of list) {
          if (Math.hypot(cr.p[0] - C[0], cr.p[1] - C[1], cr.p[2] - C[2]) > 9000) continue;
          const z = [-cr.fwd[0], -cr.fwd[1], -cr.fwd[2]], y0 = cr.up, y = nrm([y0[0] - z[0] * dot(y0, z), y0[1] - z[1] * dot(y0, z), y0[2] - z[2] * dot(y0, z)]), x = cross(y, z);
          const o = instOf('shuttle', k++); place(o, 'shuttle', x, y, cr.p, C); r.drawShip(o, E, layer); n++;
        }
        STN.stats.shuttles = k;
      }
      STN.stats.drawn = n;
    } catch (e) { if (!STN.stats.err) { STN.stats.err = String((e && e.stack) || e); console.error('stations space', e); } }
  };

  // ---------------------------------------------------------------- the beacon far away (one additive glare)
  const perm = (v) => [v[1], v[2], v[0]];
  STN.beaconDir = function (fr, eph, id, t) {
    const L = STN.LIST[id], b = eph && eph.bodies && eph.bodies[L.body], SSb = VR.SpaceScene && VR.SpaceScene.BODIES; if (!b || !SSb) return null;
    const q = perm(STN.beacon(id, t, [0, 0, 0])), P = [b.p[0] + q[0], b.p[1] + q[1], b.p[2] + q[2]], rel = [P[0] - fr.pos[0], P[1] - fr.pos[1], P[2] - fr.pos[2]], d = len(rel);
    if (!(d > 1)) return null;
    // behind a world? (the line of sight against each body's sphere)
    for (const k of ['herz', 'aqua', 'opal', 'basalt', 'amarant']) {
      const bb = eph.bodies[k], B = SSb[k]; if (!bb || !B) continue;
      const ox = bb.p[0] - fr.pos[0], oy = bb.p[1] - fr.pos[1], oz = bb.p[2] - fr.pos[2], tc = (ox * rel[0] + oy * rel[1] + oz * rel[2]) / d;
      if (tc <= 0 || tc >= d) continue;
      if (ox * ox + oy * oy + oz * oz - tc * tc < B.R * B.R) return null;
    }
    const D = [rel[0] / d, rel[1] / d, rel[2] / d], Ax = fr.axes;
    return { dir: [dot(Ax[0], D), dot(Ax[1], D), dot(Ax[2], D)], d };
  };
  const blink = (t) => { const u = ((t % 1.6) + 1.6) % 1.6; return u < 0.12 ? u / 0.12 : u < 0.42 ? 1 : u < 0.62 ? 1 - (u - 0.42) / 0.2 : 0; };
  const SSc = VR.SpaceScene;
  if (SSc && SSc.frameSetup && !SSc._stn) {
    SSc._stn = true;
    const fs0 = SSc.frameSetup;
    SSc.frameSetup = function (Sx, eph, o) {
      const fr = fs0.apply(this, arguments);
      try {
        const g = VR.game, fl = g && g.flight, a = fl && fl.asc;
        if (fr && g && a && SF.inSpace(g) && !STN.inStation(g)) {
          const L = STN.atBody(a.st.frame), t = a.st.t;
          const B = L ? STN.beaconDir(fr, eph, L.id, t) : null;
          if (B && B.d > 900) {
            const dS = B.dir, bu0 = Math.abs(dS[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], k = dot(bu0, dS), u = nrm([bu0[0] - dS[0] * k, bu0[1] - dS[1] * k, bu0[2] - dS[2] * k]), v = cross(dS, u);
            const tt = performance.now() / 1000, bl = 0.15 + 0.85 * blink(tt), far = clamp(1.2 - Math.log10(B.d / 1000) * 0.35, 0.25, 1) * clamp((B.d - 1200) / 7000, 0.1, 1);   // (u-stations2: near, the mesh's own red lamp — the glare fades: run 1's star covered the ring)
            fr.draws.push({ prog: 'glare', add: true, stn: true, u: { u_cdir: dS, u_bu: u, u_bv: v, u_half: Math.tan(25 * D2R), u_sunDir: dS, u_sunCol: [1.0, 0.13, 0.07], u_gl: [bl * far, 0.0012, 1.3, 0.5] }, tex: {} });
            STN.stats.glare++;
            STN.lastBeacon = { dir: dS, d: B.d };
          }
        }
      } catch (e) { if (!STN.stats.err) { STN.stats.err = String((e && e.stack) || e); console.error('stations beacon', e); } }
      return fr;
    };
  }
  // the story's ch. 3 beacon: now the real one (its direction from the true place — the old one hung over the limb)
  const SP = VR.StoryPlay;
  if (SP && SP.stationDir) {
    SP.stationDir = function (fr, eph, t, cam) { void cam; const g = VR.game, a = g && g.flight && g.flight.asc, tt = a ? a.st.t : worldT(g); const B = STN.beaconDir(fr, eph, 'ring', tt); return B ? B.dir : null; };
  }

  // ---------------------------------------------------------------- docking (G at the station in space)
  STN.target = function (g, fl) {
    const a = fl && fl.asc; if (!a || fl.regime !== 'space' || a.jump || a.cruise) return null;
    const st0 = a.st, L = STN.atBody(st0.frame); if (!L) return null;
    const cam = g.cam || (g.renderer && g.renderer.cam); if (!cam) return null;
    const C = camInertial(g, cam, st0, fl.b), P = STN.place(L.id, st0.t, _P), rel = [P.r[0] - C[0], P.r[1] - C[1], P.r[2] - C[2]], d = len(rel);
    const cp = Math.cos(cam.pitch || 0), fL = [-Math.sin(cam.yaw || 0) * cp, Math.sin(cam.pitch || 0), -Math.cos(cam.yaw || 0) * cp];
    const f = [_M[0] * fL[0] + _M[1] * fL[1] + _M[2] * fL[2], _M[3] * fL[0] + _M[4] * fL[1] + _M[5] * fL[2], _M[6] * fL[0] + _M[7] * fL[1] + _M[8] * fL[2]];
    const ang = Math.acos(clamp(dot(f, rel) / d, -1, 1));
    return { id: L.id, d, ang, ok: d < 40000 || ang < 9 * D2R };
  };
  STN.dock = function (g, fl, id, quiet) {
    const a = A.ascOf(fl), st0 = a.st;
    const why = VR.Travel && VR.Travel.canGo ? VR.Travel.canGo(g, STN.LIST[id].dim) : null;
    if (why) { SF.hint(fl, why); return false; }
    const J = STN.dockPlan(id, 0, st0.t, st0.r, st0.v);
    a.jump = { dock: true, J, s: 0, to: id, id, ph: null };
    fl.auto = null; fl.regime = 'space';
    if (g.trails && g.trails.clear) g.trails.clear();
    if (!quiet) SF.say(fl, 'g.stn.dockGo', { name: STN.nameOf(id), km: (J.dist / 1000).toFixed(1), s: Math.round(J.dur) });
    if (g.audio && g.audio.play) g.audio.play('boost');
    STN.stats.dockMs = []; STN.stats.phase = 'transfer'; STN.stats.dockT0 = performance.now();
    return true;
  };
  const toggle0 = SF.toggle;
  SF.toggle = (fl) => {
    const g = fl && fl.g;
    try {
      // in a station, in the parked ship: G undocks
      if (g && STN.isDim(g.dim) && (fl.regime || 'air') === 'air' && g.starships && g.starships.pilot && g.starships.pilot.flight === fl) return STN.undock(g, fl);
      if (g && fl.regime === 'space' && !fl.auto) { const tg = STN.target(g, fl); if (tg && tg.ok) return STN.dock(g, fl, tg.id); }
    } catch (e) { console.warn('stations G', e); }
    return toggle0(fl);
  };
  const flash0 = SF.jumpFlash;
  SF.jumpFlash = (J, s) => (J && J.dock ? Math.exp(-Math.pow((s - (J.T1 + J.T2 + J.T3 + 0.08)) / 0.12, 2)) * 0.55 : flash0(J, s));
  const _o = {}, _mp = [0, 0, 0], _mv = [0, 0, 0];
  const jump0 = SF.jumpStep;
  SF.jumpStep = (fl, h) => {
    const a = A.ascOf(fl), j = a.jump;
    if (!j || !j.dock) return jump0(fl, h);
    const st0 = a.st, g = fl.g, J = j.J;
    j.s = Math.min(J.dur, j.s + h); st0.t += h;
    STN.dockAt(J, j.s, _o);
    for (let i = 0; i < 3; i++) { st0.v[i] = (_o.p[i] - st0.r[i]) / Math.max(h, 1e-4); st0.r[i] = _o.p[i]; }
    st0.coast = false;
    if (_o.phase === 'transfer' && _o.u < 0.85) { A.slew(a.S, _o.fwd, _o.up, 2.4 * h, 1.2 * h); A.math.ortho(a.S); }
    else A.frameFrom(_o.fwd, _o.up, a.S);
    if (st0.frame === 'herz') { A.toMap(st0, _mp, _mv); for (let i = 0; i < 3; i++) { a.pos[i] = _mp[i]; fl.b.pos[i] = _mp[i]; fl.b.vel[i] = 0; } }
    if (_o.phase !== j.ph) {
      j.ph = _o.phase; STN.stats.phase = _o.phase;
      if (_o.phase === 'corridor') SF.hint(fl, 'g.stn.corridor', null, 3000);
      if (_o.phase === 'align') SF.hint(fl, 'g.stn.align', null, 3000);
      if (_o.phase === 'clamp') {
        SF.hint(fl, 'g.stn.clamp', null, 2600);
        fl.bump = Math.max(fl.bump || 0, 0.9);
        if (g && g.audio && g.audio.tone) { g.audio.tone(110, 0.18, 0.35, 'square', true); setTimeout(() => { try { g.audio.tone(165, 0.12, 0.25, 'square', true); } catch (e) { /* the sound is a nicety */ } }, 140); }
      }
    }
    if (fl.auto === null && fl.g) STN.hudAuto(fl, j, _o);
    if (j.s >= J.dur && !j.hold) {
      // the clamp holds the ship at the berth while the veil closes (the trip tears the space frame down)
      j.hold = performance.now(); STN.stats.dockDone = j.hold;
      const ho = STN.handoff(j.id);
      STN.arriving = { id: j.id, t: j.hold };
      fl.auto = null;
      try { VR.Travel.go(g, { dim: ho.dim, via: 'cmd', at: ho.at }); } catch (e) { console.warn(e); }
    }
    if (j.hold && performance.now() - j.hold > 25000) a.jump = null;   // (a trip that never went: the hands back, at the berth)
  };
  STN.hudAuto = (fl, j, o) => { const I = fl.asc && fl.asc.info; if (I) { I.speed = 0; I.alt = o.d; } };

  // ---------------------------------------------------------------- undocking (G in the parked ship)
  STN.undock = function (g, fl) {
    const L = STN.byDim(g.dim); if (!L || !VR.Travel) return false;
    const home = VR.DimReg.home(g.meta), to = home === 'flat' ? 'flat' : 'overworld';
    STN.pendingUndock = { id: L.id, to, t0: performance.now() };
    SF.hint(fl, 'g.stn.undockGo', null, 2600);
    try { VR.Travel.go(g, { dim: to, via: 'cmd' }); } catch (e) { console.warn(e); STN.pendingUndock = null; }
    return true;
  };
  function undockTick(g) {
    const U0 = STN.pendingUndock; if (!U0) return;
    if (performance.now() - U0.t0 > 40000) { STN.pendingUndock = null; return; }
    if (g.dim !== U0.to || g.state !== 'play' || (g.travel && g.travel.trip)) return;
    const SS = g.starships, fl = SS && SS.pilot && SS.pilot.flight; if (!fl) return;
    STN.pendingUndock = null;
    const L = STN.LIST[U0.id], t = A.clock(fl);
    A.orbitAt(fl, [0, SF.ORBIT, 0], t);
    const a = A.ascOf(fl), s0 = a.st, Ud = STN.undockState(U0.id, 0, s0.t, {});
    s0.frame = L.body; s0.r.set ? s0.r.set(Ud.r) : Ud.r.forEach((x, i) => { s0.r[i] = x; }); Ud.v.forEach((x, i) => { s0.v[i] = x; });
    s0.coast = true; U().verletInit(s0, U().home.body(L.body).mu);
    A.frameFrom(Ud.fwd, Ud.up, a.S);
    if (L.body === 'herz') { A.toMap(s0, _mp, _mv); for (let i = 0; i < 3; i++) { a.pos[i] = _mp[i]; fl.b.pos[i] = _mp[i]; } }
    if (VR.Cruise && VR.Cruise.ensureScene) VR.Cruise.ensureScene(g);
    SF.say(fl, 'g.stn.undockGo');
  }

  // ---------------------------------------------------------------- the station's sky: the space scene behind its blocks
  STN.TILT = 22 * D2R;   // the hall's view: the planet's middle 22° under the eye line, its limb across the window's top (+19°)
  STN.inStation = (g) => !!(g && STN.isDim(g.dim));
  const eph = {}, SFs = { anc: null };
  STN.interiorFrame = function (g, cam, t) {
    const L = STN.byDim(g.dim), SS = VR.SpaceScene, r = g.renderer; if (!L || !SS || !SS.state || !r) return null;
    if (VR.Cruise && VR.Cruise.ensureScene) VR.Cruise.ensureScene(g);
    SS.ephemeris(t, eph);
    const P = STN.place(L.id, t, _P), Dk = STN.deck(L.id, 0, t, _D);
    const y0 = [-Dk.u[0], -Dk.u[1], -Dk.u[2]], z0 = P.A, c = Math.cos(STN.TILT), s = Math.sin(STN.TILT);
    const fwd = [0, 1, 2].map(i => -z0[i] * c + y0[i] * s), up = [0, 1, 2].map(i => y0[i] * c + z0[i] * s);
    const ref = eph.bodies[L.body], q = perm(Dk.p), pos = [ref.p[0] + q[0], ref.p[1] + q[1], ref.p[2] + q[2]];
    const anc = SS.anchor({ name: 'stn', ref: L.body, pos, fwd: perm(fwd), up: perm(up), fov: (cam && cam.fov) || 1.2, nadir: null, body: L.body }, eph);
    const tier = SS.tier(g);
    if ((STN._needT = (STN._needT || 0) - 1) <= 0) { STN._needT = 20; SS.needs(g, anc, tier); }
    SFs.anc = anc;
    const fr = SS.frameSetup(SFs, eph, { H: r.H, tier, bloom: !!(r.q.bloom && r.hdr), patch: SS.state.patch });
    if (VR.PlanetLODGL && fr.bodies.herz && r.gl && L.body === 'herz') { try { VR.PlanetLODGL.update(g, r.gl, fr.bodies.herz.camB, tier); } catch (e) { /* the impostor alone */ } }
    return fr;
  };
  const env0 = A.env;
  A.env = function (E, o, env) {
    const res = env0.apply(this, arguments);
    const g = A.game || VR.game;
    if (o && STN.isDim(o.dim) && g && !SF.inSpace(g)) {
      try {
        const t = U().worldSeconds(env.day | 0, env.ticks), fr = STN.interiorFrame(g, g.cam, t);
        if (fr) {
          SF.cur = fr; STN.stats.interior++;
          E.climb = { space: true, y: 0, k: 1, airK: 0, bg: 1, body: 1, imp: 1, t, curve: 0, cut0: 0, cut1: 0, hzR: 0, dip: 0 };
          const k = 2.2 / Math.max(0.5, fr.look.exposure);
          E.sunDir = fr.sunS; E.sunColor = [k, k, k * 1.02]; E.moonDir = [-fr.sunS[0], -fr.sunS[1], -fr.sunS[2]]; E.moonColor = [0.02, 0.025, 0.035];
          const pk = (0.05 + 0.08 * fr.look.dayK) / Math.max(0.5, fr.look.exposure);
          E.ambSky = [pk * 0.75, pk * 0.85, pk * 1.15];
          E.exposure = fr.look.exposure * 0.62;
          const rd = ((o.renderDist || 8) * 16);
          E.fog = [rd * 0.95, rd * 1.2, 0, 0]; E.fogColor = [0, 0, 0];
          E.rain = 0; E.snow = 0; E.wet = 0; E.puddle = 0; E.wind = 0; E.gust = 0; E.cloudCover = 0; E.cloudDrift = null; E.rays = 0; E.nebula = 0; E.snowCover = 0;
          if (E.storm) { E.storm[2] = 0; E.storm[3] = 0; } if (E.bolt) E.bolt[3] = 0;
          E.night = 0.5; E.emissiveBoost = 0.9; E.bloomThreshold = 1.3; E.bloomStrength = 0.07;
        }
      } catch (e) { if (!STN.stats.err) { STN.stats.err = String((e && e.stack) || e); console.error('stations sky', e); } }
    }
    return res;
  };

  // ---------------------------------------------------------------- life aboard: the hangar deck's shuttles (PadLife)
  const PL = VR.PadLife;
  if (PL && PL.Actor) {
    class StnActor extends PL.Actor {
      constructor(g) { super(g); this.stn = true; }
      update(dt) {
        const g = this.g, pl = g.player;
        this.clock += dt;
        this.on = on(g) && g.settings.padLife !== false && g.state === 'play';
        this.tier = PL.tierOf(g.settings || {});
        const st0 = this.st; st0.pads = this.pads.size; st0.crafts = 0; st0.parked = 0; st0.crew = 0; st0.drones = 0; st0.visible = 0;
        if (!this.on || !pl || !g.starships) { for (const p of this.pads.values()) p.live = null; return; }
        const E = g.env && g.env.E, night = E ? E.night || 0 : 0;
        for (const pad of this.pads.values()) {
          const d = Math.hypot(pad.x - pl.pos[0], pad.z - pl.pos[2]);
          pad.outs = pad.outs || [{}, {}, {}];
          const list = PL.active(pad, pad.seed, this.clock, pad.cache || (pad.cache = { seed: pad.seed, n: 0, T: PL.t0(pad.seed) }), pad.outs, pad.o, pad.list || (pad.list = []));
          pad.live = list;
          for (const q of list) this.craft(pad, q, dt, d, night);
        }
      }
    }
    STN.StnActor = StnActor;
    const AP = PL.Actor.prototype;
    if (!AP.__stn) {
      AP.__stn = true;
      const up0 = AP.update, dr0 = AP.draw;
      AP.update = function (dt) {
        up0.call(this, dt); if (this.stn || this.ferry) return;
        const g = this.g;
        try {
          undockTick(g);
          if (!STN.inStation(g)) { if (g.stnLife) { g.stnLife.actor.destroy(); g.stnLife = null; } return; }
          let Lf = g.stnLife;
          if (!Lf || Lf.world !== g.world) {
            if (Lf) Lf.actor.destroy();
            const L = STN.byDim(g.dim), act = new StnActor(g);
            act.clock = worldT(g);
            act.pads.set('stn', STN.padFor(L.id, wseedOf(g)));
            Lf = g.stnLife = { world: g.world, dim: g.dim, id: L.id, actor: act, crew: null, t: 0 };
          }
          Lf.actor.update(dt);
          STN.lifeTick(g, Lf, dt);
          STN.deckTick(g, Lf);   // u-stations2
        } catch (e) { if (!STN.stats.err) { STN.stats.err = String((e && e.stack) || e); console.error('stations life', e); } }
      };
      AP.draw = function (r, E, layer, cam) { dr0.call(this, r, E, layer, cam); if (this.stn || this.ferry) return; const Lf = this.g && this.g.stnLife; if (Lf && Lf.world === this.g.world) { Lf.actor.draw(r, E, layer, cam); if (layer === 'opaque') STN.drawDeck(this.g, r, E, cam, Lf); } };
    }
  }
  // the crew: a village plan of the station (its cabins the homes, the hall its square) — villages.js does the rest
  STN.crewPlan = function (id) {
    const L = STN.LIST[id], Pl = VR.Forge.Station.place(L.kind), seed = (STN.seedOf(id, 1) >>> 0);
    const homes = Pl.cabins.map((c, i) => ({ kind: 'home', ops: [], door: c.door ? c.door.slice() : c.inside.slice(), outside: c.outside.slice(), inside: c.inside.slice(), beds: [c.bed.slice()], seats: [], work: [], chimney: null, table: null, lights: [], box: [c.inside[0] - 3, Pl.hall[1] - 1, c.inside[2] - 3, c.inside[0] + 3, Pl.hall[1] + 4, c.inside[2] + 3], F: Pl.hall[1] - 1, r: 0, w: 5, d: 6, ox: c.inside[0] - 2, oz: c.inside[2] - 2, i }));
    return { id: 'stn:' + id, name: STN.nameOf(id), style: 'moon', kit: 'terminal', x: Pl.hall[0], y: Pl.hall[1], z: Pl.hall[2], seed, homes, work: [], farms: [], lots: [], lamps: [], chimneys: [], plaza: { x: Pl.hall[0], y: Pl.hall[1], z: Pl.hall[2] }, roads: [], bell: null, pad: null, shops: [], pastures: [], prefab: [] };
  };
  STN.lifeTick = function (g, Lf, dt) {
    Lf.t += dt;
    // the welcome (once a visit) and the first time (once a save)
    if (!Lf.hello && g.state === 'play' && Lf.t > 1.2) {
      Lf.hello = true;
      const m = g.meta, rec = m && (m.stations || (m.stations = { v: 1, first: {}, jobs: {} }));
      if (g.ui && g.ui.chatLine) g.ui.chatLine(T('g.stn.welcome', { name: STN.nameOf(Lf.id) }), '#9ad8ff');
      if (rec && !rec.first[Lf.id]) { rec.first[Lf.id] = (g.env && g.env.day) | 0 || 1; if (g.ui && g.ui.toast) g.ui.toast('🛰 ' + T('g.stn.first', { name: STN.nameOf(Lf.id) }), '', null); if (VR.Quests && VR.Quests.emit) { try { VR.Quests.emit('arrive', { dim: g.dim }); } catch (e) { /* an Abenteuer world only */ } } }
    }
    if (!Lf.crew && Lf.t > 2 && g.villages && g.villages.addVillage && g.settings.stationCrew !== false) {
      try { const P = STN.crewPlan(Lf.id); g.villages.addVillage(P); Lf.crew = g.villages.known.get(P.id) || true; } catch (e) { Lf.crew = true; console.warn('stations crew', e); }
    }
  };

  // ---------------------------------------------------------------- u-stations2: the deck life drawn (STN.deckLife, pure)
  // the people and the drones of the Ringstation's hall and deck on the world clock (the hangar deck's PadLife clock);
  // their looks are made one a frame and their models built one a frame (no frame pays for all of them: the hand-off).
  // Tier: PadLife's (Very Low four people, no drone). Switch: settings.stations / settings.stationCrew.
  const LOOKROLE = { barista: 'barista', guest: ['office', 'scholar'], watcher: ['pilot', 'teacher'], sitter: 'elder', docker: 'worker', walker: 'operator' };
  STN.stats.deck = { folk: 0, drones: 0, hall: 0, drawn: 0 };
  STN.deckTick = function (g, Lf) {
    const L = STN.byDim(g.dim), D = STN.stats.deck; D.folk = D.drones = D.hall = 0;
    if (!L || L.kind !== 0 || !on(g) || g.settings.stationCrew === false || !VR.LifeKit) { Lf.deck = null; return; }
    const tier = PL && PL.tierOf ? PL.tierOf(g.settings || {}) : 1, LK = VR.LifeKit;
    const list = STN.deckLife(Lf.actor.clock, tier, Lf.deckL || (Lf.deckL = []));
    const F = Lf.deck || (Lf.deck = { figs: [], made: 0 });
    let made = 0, wk = {};
    for (let i = 0; i < list.length; i++) {
      const q = list[i], f = F.figs[i] || (F.figs[i] = { look: null, pos: [0, 0, 0], yaw: 0, seed: q.seed * 0.37, kind: q.kind, role: q.role });
      if (f.role !== q.role) { f.role = q.role; f.kind = q.kind; f.look = null; f.mdl = null; f.ready = false; }
      f.pos[0] = q.pos[0]; f.pos[1] = q.pos[1]; f.pos[2] = q.pos[2]; f.yaw = q.yaw; f.state = q.state; f.walk = q.walk; f.walkAmt = q.walkAmt; f.talking = q.talking; f.headYaw = q.headYaw;
      f.on = true;
      if (q.kind === 'folk') {
        if (!f.look && made < (STN.DECK_BUILD || 1)) { const n = wk[q.role] = (wk[q.role] | 0) + 1, R0 = LOOKROLE[q.role], role = Array.isArray(R0) ? R0[(n - 1) % R0.length] : R0 || 'office'; f.look = LK.folk(0x57a7 + q.seed * 7919 + (Lf.id === 'ring' ? 0 : 3), role, 'adult'); made++; }
        else if (!f.look) wk[q.role] = (wk[q.role] | 0) + 1;
        D.folk++; if (q.pos[0] >= -20 && q.pos[0] <= 21 && q.pos[2] >= -6 && q.pos[2] <= 15) D.hall++;
      } else D.drones++;
    }
    F.figs.length = list.length;
  };
  STN.drawDeck = function (g, r, E, cam, Lf) {
    const F = Lf.deck, ent = g.entities, LK = VR.LifeKit; if (!F || !ent || !LK) return;
    let p = null, built = 0, n = 0; const t = g.time || 0;
    const pose = F.dronePose || (F.dronePose = { rotor_l: [0, 0, 0], rotor_r: [0, 0, 0] });
    pose.rotor_l[1] = t * 30; pose.rotor_r[1] = -t * 30;
    for (const f of F.figs) {
      if (!f || !f.on) continue;
      if (f.kind === 'drone') { if (!p) p = ent.beginVox(r, E); if (LK.drawModel(g, r, p, 'hover_drone', f.pos, f.yaw, cam, { pose })) n++; continue; }
      if (!f.look) continue;
      if (!f.ready) { if (built >= (STN.DECK_BUILD || 1)) continue; built++; }   // (one model built a frame)
      if (!p) p = ent.beginVox(r, E);
      if (LK.drawFolk(g, r, p, f, cam, t)) { n++; f.ready = true; }
    }
    STN.stats.deck.drawn = n;
  };
  // ---------------------------------------------------------------- the shop 🛰 and the job board ([V] at the counter, the board)
  const SH = VR.Shop;
  if (SH && SH.SHOPS && SH.SHOPS.indexOf('station') < 0) {
    SH.SHOPS.push('station'); SH.ICON.station = '🛰'; SH.BUYS.station = true;
    const cat0 = SH.catalog;
    let cache = null;
    SH.catalog = function (shop) {
      if (shop !== 'station') return cat0.apply(this, arguments);
      if (cache) return cache;
      const out = [], Adv = VR.Adv, ex = (id) => !!((VR.itemDef && VR.itemDef(id)) || (VR.R && VR.R.byName[id]));
      if (Adv && Adv.PRICES) for (const id of ['engine', 'shield', 'jump']) if (Adv.PRICES[id]) out.push({ key: 'up:' + id, kind: 'up', id, price: Adv.PRICES[id][0], cat: 'up' });
      for (const [id, p] of [['energy_cell', 10], ['photo_drone', 75], ['scanner', 55], ['spyglass', 22], ['shuttle_beacon', 240]]) if (ex(id)) out.push({ key: 'item:' + id, kind: 'item', id, price: p, cat: 'item' });
      for (const k of [{ id: 'stnplates', price: 55, parts: [['stn_gravplate', 12]] }, { id: 'stnclamps', price: 45, parts: [['stn_clamp', 4], ['hazard_stripes', 16]] }]) if (k.parts.every(([id]) => ex(id))) out.push({ key: 'kit:' + k.id, kind: 'kit', id: k.id, price: k.price, parts: k.parts.map(p => p.slice()), cat: 'kit' });
      return (cache = out);
    };
  }
  STN.openShop = (g) => { if (!SH || !SH.open) return false; const ok = SH.open('station', null, null); if (!ok && g.ui && g.ui.hint) g.ui.hint(T('g.stn.shop'), 2400); return ok; };
  // the jobs: two a game day per station; [V] at the board takes one, [V] again with the things hands it in
  const jobRec = (g) => { const m = g && g.meta; if (!m) return null; const r = m.stations || (m.stations = { v: 1, first: {}, jobs: {} }); r.jobs = r.jobs || {}; r.first = r.first || {}; return r; };
  STN.board = function (g) {
    const Lf = g.stnLife; if (!Lf) return false;
    const R0 = jobRec(g), day = (g.env && g.env.day) | 0, list = STN.jobsFor(Lf.id, day, wseedOf(g)), key = Lf.id + ':' + day;
    const J = R0.jobs[key] || (R0.jobs[key] = { taken: null, done: [] });
    const say = (k, v, c) => { if (g.ui && g.ui.chatLine) g.ui.chatLine(T(k, v), c || '#ffd98a'); };
    const name = (id) => (VR.itemName ? VR.itemName(id) : id);
    const open = list.filter(j => J.done.indexOf(j.id) < 0);
    if (!open.length) { say('g.stn.job.done', { taler: 0 }); return true; }
    if (!J.taken || J.done.indexOf(J.taken) >= 0) { J.taken = open[0].id; const j = open[0]; say('g.stn.job.open'); say(j.kind === 'bring' ? 'g.stn.job.bring' : 'g.stn.job.photo', { n: j.n, item: name(j.item) }, '#9ad8ff'); return true; }
    const j = list.find(x => x.id === J.taken); if (!j) return true;
    if (j.kind === 'bring') {
      const inv = g.player && g.player.inv, have = inv ? inv.count(j.item) : 0;
      if (have < j.n) { say('g.stn.job.need', { n: j.n - have, item: name(j.item) }, '#ffb08a'); return true; }
      inv.remove(j.item, j.n);
      STN.payJob(g, J, j);
    } else say('g.stn.job.photo', null, '#9ad8ff');
    return true;
  };
  STN.payJob = function (g, J, j) {
    J.done.push(j.id); J.taken = null;
    let taler = STN.REWARD[j.size] || 25;
    try { if (VR.Adventure && VR.Adventure.award) { const r = VR.Adventure.award('quest', { size: j.size }); if (r && r.taler) taler = r.taler; } } catch (e) { /* a builder's world: the thanks alone */ }
    if (g.ui && g.ui.toast) g.ui.toast('🛰 ' + T('g.stn.job.done', { taler }), STN.nameOf(g.stnLife ? g.stnLife.id : 'ring'), null);
    if (g.audio && g.audio.cue) g.audio.cue('wonder');
  };
  // the photo job: a picture taken in the station while it is the one taken
  const PMc = VR.PhotoMode;
  if (PMc && PMc.Photo && PMc.Photo.prototype.shoot && !PMc.Photo.prototype.shoot.__stn) {
    const os = PMc.Photo.prototype.shoot;
    PMc.Photo.prototype.shoot = function () {
      try { const g = VR.game; if (!this.busy && g && STN.inStation(g) && g.stnLife) { const R0 = jobRec(g), J = R0 && R0.jobs[g.stnLife.id + ':' + ((g.env && g.env.day) | 0)]; const j = J && J.taken && STN.JOBS.find(x => x.id === J.taken); if (j && j.kind === 'photo') STN.payJob(g, J, j); } } catch (e) { /* the picture comes first */ }
      return os.apply(this, arguments);
    };
    for (const k of Object.keys(os)) PMc.Photo.prototype.shoot[k] = os[k];
    PMc.Photo.prototype.shoot.__stn = true;
  }
  // [V] near the counter or the board (e-ctx's near hooks)
  if (VR.Ctx && VR.Ctx.hooks && Array.isArray(VR.Ctx.hooks.near)) VR.Ctx.hooks.near.push((g, eye, dir) => {
    const Lf = g && g.stnLife; if (!Lf || !STN.inStation(g)) return null;
    const Pl = VR.Forge.Station.place(STN.LIST[Lf.id].kind), list = [];
    const c = Pl.counter, b = Pl.board;
    if (Math.abs(c[0] + 0.5 - eye[0]) < 5 && Math.abs(c[2] + 0.5 - eye[2]) < 5) list.push({ kind: 'shop', name: T('g.stn.shop'), pos: [c[0] + 0.5, c[1] + 1, c[2] + 0.5], r: 1.1, act: (gg) => STN.openShop(gg) });
    if (Math.abs(b[0] + 0.5 - eye[0]) < 5 && Math.abs(b[2] + 1.5 - eye[2]) < 5) list.push({ kind: 'board', name: T('g.stn.board'), pos: [b[0] + 0.5, b[1] + 1.5, b[2] + 1.5], r: 1.0, act: (gg) => STN.board(gg) });
    return list.length && VR.Ctx.pickNear ? VR.Ctx.pickNear(eye, dir, list) : null;
  });
  // the hint in space: G docks when you look at the station (or are near it)
  let hintT = 0;
  const play0 = G0.prototype.playFrame;
  G0.prototype.playFrame = function (dt) {
    try {
      const fl = this.flight;
      if (fl && SF.inSpace(this)) STN.prepare(this);
      if (fl && fl.regime === 'space' && !fl.auto && (hintT -= dt) <= 0) {
        hintT = 1.5;
        const tg = STN.target(this, fl);
        if (tg && tg.ok && tg.d > 2000 && this.ui && this.ui.hint) this.ui.hint(T('g.stn.dockHint', { name: STN.nameOf(tg.id), km: (tg.d / 1000).toFixed(1) }), 1400);
      }
      if (STN.inStation(this) && this.starships && this.starships.pilot && (hintT -= dt) <= 0) { hintT = 4; if (this.ui && this.ui.hint) this.ui.hint(T('g.stn.undock'), 2000); }
    } catch (e) { /* a hint is a nicety */ }
    return play0.call(this, dt);
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
