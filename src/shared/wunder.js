// ============================================================================
// r-wunder · VR.Wunder — the Wundertiere's rules (plan docs/superpowers/plans/2026-11-07-r-wunder.md; the vision
// docs/superpowers/specs/2026-11-07-vision.md §Wundertiere). Pure: main thread, workers, node (test/wunder.js).
// Three rare, large, gentle creatures of our own design — peaceful, never hurt, never hunted:
//   Himmelswal      visits the Sky Isles every other evening (plannable: whaleVisit), flies a closed loop of long arcs
//                   from isle to isle over the domes (whaleRoute), coming in from the far sky and leaving to it
//                   (whaleAt: where it is at the world clock, the same for every guest); sings at dusk every 45 s the
//                   Heimat call of our score (root, up a sixth, a step back = the flute's keys 1 · 3 · 2: songAt);
//                   answering it with the flute within 14 s and 170 m (answered, hears) brings it down to carry you
//   Wanderbaum      stands by day, walks at night 5 m per real minute toward tomorrow's place 25–45 m away
//                   (treeTarget), never while a wanderer is within 12 m, never into a village; leaving a place it
//                   leaves a ring of blossoms (treeStep → {k: 'ring'}, ringSpots)
//   Laternenhirsch  in a dark night near a wanderer who stood still ≥ 10 s far from villages (deerMay) it leads to the
//                   nearest unseen wonder spot (deerPick, deerStep); it vanishes if you run or come within 3 m; the
//                   path gets a name (pathName)
// The event clock: each creature's sighting (the Chronik, the Regie) at most once per 2 game days (canEvent).
// Names: each creature its own, from the names system (nameOf). The Chronik's deed kinds w_whale, w_ride, w_tree,
// w_deer (their texts g.ch.ev.deed.w_*, icons) are added to VR.Chronik here — in the worker too, which writes them.
// ============================================================================
(function (VR) {
  'use strict';
  const WU = VR.Wunder = VR.Wunder || {};
  const TAU = Math.PI * 2;
  const h01 = WU.h01 = (a, b, c) => { let h = Math.imul((a | 0) ^ 0x51ed27, 0x297a2d39) ^ Math.imul((b | 0) + 0x632be5ab, 0x85ebca6b) ^ Math.imul((c | 0) + 0x1b873593, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
  const sm = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  const DAY = 24000;   // ticks a game day (20 a real second)

  // ---------------------------------------------------------------- the event clock
  WU.GAP = 2;
  WU.canEvent = (st, kind, day) => { const e = st && st.ev; const l = e ? e[kind] : undefined; return l === undefined || (day | 0) - l >= WU.GAP; };
  WU.markEvent = (st, kind, day) => { (st.ev || (st.ev = {}))[kind] = day | 0; };

  // ================================================================ the Himmelswal
  // len: metres nose to fluke · speed m/s · from: the visit's start (tick of the day) · dur: its length (ticks) · arr: the
  // arrival's and the leaving's glide (ticks) · alt: over the domes · songs: from songFrom to songTo every songEvery
  // ticks, songLen s long; the answer window (s); hear: the song's reach (m)
  WU.WHALE = { len: 34, speed: 4.2, from: 9000, dur: 13200, arr: 1800, alt: 30, far: 720, period: 7.5, songFrom: 11400, songTo: 13600, songEvery: 900, songLen: 6, window: 14, hear: 170 };
  // every other evening (the seed decides which): the villagers can tell you when it comes
  WU.whaleVisit = (seed, day) => (((day | 0) + (seed & 1)) & 1) === 0;
  WU.isleCentre = (isles) => { let x = 0, z = 0; for (const I of isles) { x += I.x; z += I.z; } return isles.length ? [x / isles.length, z / isles.length] : [330, 140]; };
  const topOf = (I) => I.y + (I.dome || 4);
  // the closed loop: the isles in order round their centre (the seed picks the first), from each to the next a long arc
  // (a quadratic curve bowed sideways by a third of the leg, rising 10 m in the middle), 30 m over the domes; lifted
  // wherever it would pass low over another isle, smoothed. → {pts, s, L, N}
  WU.whaleRoute = function (seed, isles) {
    const W = WU.WHALE, L0 = isles && isles.length ? isles.slice() : [{ x: 330, z: 140, y: 158, r: 42, dome: 4 }];
    const C = WU.isleCentre(L0);
    L0.sort((a, b) => Math.atan2(a.z - C[1], a.x - C[0]) - Math.atan2(b.z - C[1], b.x - C[0]));
    const k0 = Math.floor(h01(seed, 3, 0x7e) * L0.length), order = L0.map((_, i) => L0[(i + k0) % L0.length]);
    const pts = [], SEG = 22;
    for (let i = 0; i < order.length; i++) {
      const A = order[i], B = order[(i + 1) % order.length];
      const a = [A.x, topOf(A) + W.alt, A.z], b = [B.x, topOf(B) + W.alt, B.z];
      const dx = b[0] - a[0], dz = b[2] - a[2], d = Math.hypot(dx, dz) || 1, side = (i & 1 ? -1 : 1) * (0.28 + 0.12 * h01(seed, i, 0x51));
      const m = [(a[0] + b[0]) / 2 - dz / d * d * side, Math.max(a[1], b[1]) + 10, (a[2] + b[2]) / 2 + dx / d * d * side];
      for (let k = 0; k < SEG; k++) { const t = k / SEG, u = 1 - t; pts.push([u * u * a[0] + 2 * u * t * m[0] + t * t * b[0], u * u * a[1] + 2 * u * t * m[1] + t * t * b[1], u * u * a[2] + 2 * u * t * m[2] + t * t * b[2]]); }
    }
    const N = pts.length;
    const lift = () => { for (const q of pts) for (const I of L0) if (Math.hypot(q[0] - I.x, q[2] - I.z) < I.r * 1.45) q[1] = Math.max(q[1], topOf(I) + 24); };
    lift();
    for (let it = 0; it < 3; it++) { const cp = pts.map(q => q.slice()); for (let k = 0; k < N; k++) { const a = cp[(k + N - 1) % N], b = cp[(k + 1) % N], q = pts[k]; for (let j = 0; j < 3; j++) q[j] = q[j] * 0.5 + (a[j] + b[j]) * 0.25; } }
    lift();
    const s = [0];
    for (let k = 1; k <= N; k++) { const a = pts[k - 1], b = pts[k % N]; s.push(s[k - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])); }
    return { pts, s, L: s[N], N, C };
  };
  const cr = (a, b, c, d, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); };
  const at3 = (loop, s, o) => {
    const N = loop.N, L = loop.L, S = loop.s, P = loop.pts;
    s = ((s % L) + L) % L;
    let lo = 0, hi = N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
    const t = (s - S[lo]) / ((S[lo + 1] - S[lo]) || 1e-6);
    const a = P[(lo + N - 1) % N], b = P[lo % N], c = P[(lo + 1) % N], d = P[(lo + 2) % N];
    o[0] = cr(a[0], b[0], c[0], d[0], t); o[1] = cr(a[1], b[1], c[1], d[1], t); o[2] = cr(a[2], b[2], c[2], d[2], t);
    return o;
  };
  const Q0 = [0, 0, 0], Q1 = [0, 0, 0];
  // the point s along the loop: out = [x, y, z, yaw (the models face −z), pitch, curvature (+ left)]
  WU.routeAt = function (loop, s, out) {
    at3(loop, s, out); at3(loop, s - 3, Q0); at3(loop, s + 3, Q1);
    const dx = Q1[0] - Q0[0], dy = Q1[1] - Q0[1], dz = Q1[2] - Q0[2], hl = Math.hypot(dx, dz) || 1e-6;
    out[3] = Math.atan2(-dx, -dz); out[4] = Math.atan2(dy, hl);
    at3(loop, s + 8, Q1); at3(loop, s - 8, Q0);
    const h0 = Math.atan2(out[2] - Q0[2], out[0] - Q0[0]), h1 = Math.atan2(Q1[2] - out[2], Q1[0] - out[0]);
    let dh = h1 - h0; if (dh > Math.PI) dh -= TAU; else if (dh < -Math.PI) dh += TAU;
    out[5] = dh / 8;
    return out;
  };
  // where it is at absolute ticks T (day · 24000 + tick of the day) → out (10): x, y, z, yaw, pitch, bank, the fins' phase,
  // on (1 while it visits), k (0 far away … 1 on the loop), s (along the loop)
  const R0 = [0, 0, 0, 0, 0, 0];
  const posAt = (seed, loop, T, o) => {
    const W = WU.WHALE, d = Math.floor((T - W.from) / DAY), u = T - (d * DAY + W.from);
    if (!WU.whaleVisit(seed, d) || u < 0 || u >= W.dur) return 0;
    const s = u / 20 * W.speed + h01(seed, d, 0x3a) * loop.L;
    WU.routeAt(loop, s, R0);
    const k = sm(u / W.arr) * sm((W.dur - u) / W.arr), C = loop.C;
    let ox = R0[0] - C[0], oz = R0[2] - C[1]; const ol = Math.hypot(ox, oz) || 1; ox /= ol; oz /= ol;
    const far = (1 - k) * W.far;
    o[0] = R0[0] + ox * far; o[1] = R0[1] + (1 - k) * 70; o[2] = R0[2] + oz * far; o[5] = R0[5] * k; o[8] = k; o[9] = s;
    return 1;
  };
  const P2 = new Float32Array(10);
  WU.whaleAt = function (seed, loop, T, out) {
    out = out || new Float32Array(10);
    if (!posAt(seed, loop, T, out)) { out[7] = 0; out[8] = 0; return out; }
    if (posAt(seed, loop, T + 10, P2)) {
      const dx = P2[0] - out[0], dy = P2[1] - out[1], dz = P2[2] - out[2], hl = Math.hypot(dx, dz) || 1e-6;
      out[3] = Math.atan2(-dx, -dz); out[4] = Math.max(-0.35, Math.min(0.35, Math.atan2(dy, hl)));
    }
    out[5] = Math.max(-0.4, Math.min(0.4, -out[5] * 30));
    out[6] = (T / 20) * TAU / WU.WHALE.period;
    out[7] = 1;
    return out;
  };
  // the song at absolute ticks T: null (no song this evening, or not at dusk), else {k, t0, end (ticks), sing}
  WU.songAt = function (seed, T) {
    const W = WU.WHALE, d = Math.floor(T / DAY), tod = T - d * DAY;
    if (!WU.whaleVisit(seed, d) || tod < W.songFrom) return null;
    const k = Math.floor((tod - W.songFrom) / W.songEvery), t0 = d * DAY + W.songFrom + k * W.songEvery;
    if (W.songFrom + k * W.songEvery >= W.songTo) { const kl = Math.floor((W.songTo - W.songFrom - 1) / W.songEvery), e = d * DAY + W.songFrom + kl * W.songEvery + W.songLen * 20; return T <= e + W.window * 20 ? { k: kl, t0: e - W.songLen * 20, end: e, sing: false } : null; }
    const end = t0 + W.songLen * 20;
    return { k, t0, end, sing: T < end };
  };
  // the motif: the Heimat call of our score (score.js THEMES.home — root, up a sixth, a step back) on the flute's three
  // keys: 1 the root (C), 2 the fifth (G), 3 the sixth (A)
  WU.MOTIF = [1, 3, 2];
  WU.NOTES = { 1: 72, 2: 79, 3: 81 };
  // presses [{k, T}] (absolute ticks): the motif played in a row, from the song's last second to the window's end
  WU.answered = function (presses, songEnd) {
    const W = WU.WHALE, M = WU.MOTIF, L = [];
    for (const p of presses || []) if (p.T >= songEnd - 20 && p.T <= songEnd + W.window * 20) L.push(p.k);
    for (let i = 0; i + M.length <= L.length; i++) { let ok = true; for (let j = 0; j < M.length; j++) if (L[i + j] !== M[j]) { ok = false; break; } if (ok) return true; }
    return false;
  };
  WU.hears = (d) => d <= WU.WHALE.hear;

  // ================================================================ the Wanderbaum
  // v: m per real second (5 a minute) · stopR: no step while a wanderer is this near · vilMargin: round a village's
  // radius · the night (ticks) · tomorrow's place min … max m away
  WU.TREE = { v: 5 / 60, stopR: 12, vilMargin: 30, night0: 13200, night1: 22800, min: 25, max: 45, crown: 13 };
  WU.isNight = (tod) => tod >= WU.TREE.night0 && tod < WU.TREE.night1;
  WU.treeTarget = function (seed, day, from, ok) {
    const T = WU.TREE;
    for (let k = 0; k < 16; k++) {
      const a = h01(seed, day * 31 + k, 0x7a) * TAU, r = T.min + (T.max - T.min) * h01(seed, day * 31 + k, 0x7b);
      const x = Math.round((from[0] + Math.cos(a) * r) * 10) / 10, z = Math.round((from[1] + Math.sin(a) * r) * 10) / 10;
      if (ok(x, z)) return [x, z];
    }
    return null;
  };
  WU.inVillage = (x, z, vils, margin) => { for (const v of vils || []) if (Math.hypot(x - v[0], z - v[1]) < v[2] + (margin || 0)) return true; return false; };
  // one step: tr {x, z, tx, tz (null: nowhere to go), walking, stood (on a place it has not left yet)}; ctx {night,
  // players [[x, z]], vils [[x, z, r]]} → null or an event {k: 'ring' (x, z: the place it left) | 'arrive' | 'blocked'}
  WU.treeStep = function (tr, dt, ctx) {
    const T = WU.TREE, pl = ctx.players || [];
    if (!ctx.night || tr.tx === null || tr.tx === undefined) { tr.walking = false; return null; }
    for (const p of pl) if (Math.hypot(p[0] - tr.x, p[1] - tr.z) < T.stopR) { tr.walking = false; return null; }
    const dx = tr.tx - tr.x, dz = tr.tz - tr.z, d = Math.hypot(dx, dz);
    if (d < 0.05) { tr.x = tr.tx; tr.z = tr.tz; tr.tx = null; tr.walking = false; tr.stood = true; return { k: 'arrive', x: tr.x, z: tr.z }; }
    const st = Math.min(d, T.v * dt), nx = tr.x + dx / d * st, nz = tr.z + dz / d * st;
    if (WU.inVillage(nx, nz, ctx.vils, T.vilMargin)) { tr.tx = null; tr.walking = false; return { k: 'blocked', x: tr.x, z: tr.z }; }
    for (const p of pl) if (Math.hypot(p[0] - nx, p[1] - nz) < T.stopR) { tr.walking = false; return null; }
    let ev = null;
    if (tr.stood) { ev = { k: 'ring', x: tr.x, z: tr.z }; tr.stood = false; }
    tr.x = nx; tr.z = nz; tr.walking = true; tr.yaw = Math.atan2(-dx, -dz);
    return ev;
  };
  WU.ringSpots = function (x, z, seed) {
    const out = [], n = 14;
    for (let i = 0; i < n; i++) { const a = (i + 0.35 * (h01(seed, i, 0x21) - 0.5)) / n * TAU, r = 3.2 + 1.1 * h01(seed, i, 0x22); out.push([x + Math.cos(a) * r, z + Math.sin(a) * r]); }
    return out;
  };
  WU.seedToday = (st, day) => !st || st.seedDay !== (day | 0);

  // ================================================================ the Laternenhirsch
  WU.DEER = { still: 10, vilFar: 110, dark: 0.6, near: 3, run: 5.2, wait: 24, ahead0: 9, ahead1: 14, pace: 2.2, arrive: 7, maxD: 650, minD: 25 };
  WU.deerMay = (c) => (c.night || 0) >= WU.DEER.dark && (c.stillFor || 0) >= WU.DEER.still && (c.vilDist === undefined ? 1e9 : c.vilDist) >= WU.DEER.vilFar && WU.canEvent(c.st, 'deer', c.day);
  WU.deerPick = function (spots, seen, px, pz) {
    let best = null, bd = 1e9;
    for (const q of spots || []) { if (seen && seen[q.id]) continue; const d = Math.hypot(q.x - px, q.z - pz); if (d < WU.DEER.minD || d > WU.DEER.maxD) continue; if (d < bd) { bd = d; best = q; } }
    return best;
  };
  // one step: d {x, z, tx, tz, yaw}; c {px, pz, speed} → 'vanish' | 'arrive' | null
  WU.deerStep = function (d, dt, c) {
    const D = WU.DEER, dp = Math.hypot(c.px - d.x, c.pz - d.z);
    if ((c.speed || 0) > D.run || dp < D.near) return 'vanish';
    const dx = d.tx - d.x, dz = d.tz - d.z, dt2 = Math.hypot(dx, dz);
    if (dt2 < D.arrive && dp < 22) return 'arrive';
    d.walking = false;
    if (dp > D.wait || dt2 < 0.5) return null;
    const spd = dp < D.ahead0 ? D.pace * 1.4 : dp > D.ahead1 ? D.pace * 0.35 : D.pace;
    const st = Math.min(dt2, spd * dt);
    d.x += dx / dt2 * st; d.z += dz / dt2 * st; d.yaw = Math.atan2(-dx, -dz); d.walking = true;
    return null;
  };
  const PATH = { de: [['Laternen', 'Glimm', 'Hirsch', 'Schimmer', 'Mondlicht', 'Leucht', 'Silber', 'Sternen'], ['pfad', 'weg', 'steig', 'spur']],
    en: [['Lantern', 'Glimmer', 'Stag', 'Shimmer', 'Moonlight', 'Glow', 'Silver', 'Star'], [' Path', ' Way', ' Trail', ' Track']] };
  WU.pathName = function (seed, lang) {
    const P = PATH[lang === 'en' ? 'en' : 'de'], a = Math.floor(h01(seed, 1, 0x91) * P[0].length), b = Math.floor(h01(seed, 2, 0x92) * P[1].length);
    return P[0][a] + P[1][b];
  };

  // ================================================================ names
  // the whale a Wellari elder's name (soft, the sea's), the tree a Regoli elder's (deep and round), the deer a Flausel's
  const PEOPLE = { whale: 'aqua', tree: 'basalt', deer: 'flausel' };
  WU.nameOf = function (kind, seed) {
    const N = VR.Names; if (!N) return kind;
    for (let k = 0; k < 40; k++) {
      const w = kind === 'deer' && N.flausel ? N.flausel(seed, k) : N.word(PEOPLE[kind] || 'aqua', (seed | 0) * 31 + k * 7919 + (kind === 'tree' ? 17 : kind === 'deer' ? 29 : 0), 'elder');
      if (w && w.length >= 3 && w.length <= 12 && !N.blocked(w) && !N.reserved(w)) return w;
    }
    return kind === 'whale' ? 'Limar' : kind === 'tree' ? 'Romo' : 'Lichtel';
  };

  // ================================================================ the Chronik's deeds
  const C = VR.Chronik;
  WU.DEEDS = { w_whale: 6, w_ride: 8, w_tree: 5, w_deer: 7, w_flute: 4 };
  WU.ICON = { w_whale: '🐋', w_ride: '🐋', w_tree: '🌳', w_deer: '🦌', w_flute: '🎶' };
  if (C && C.DEEDS && !C.DEEDS.w_whale) {
    Object.assign(C.DEEDS, WU.DEEDS);
    for (const k in WU.DEEDS) if (C.KEYS && C.KEYS.indexOf('g.ch.ev.deed.' + k) < 0) C.KEYS.push('g.ch.ev.deed.' + k);
    const oi = C.icon;
    if (oi) C.icon = (e) => (e && e.k === 'deed' && e.v && WU.ICON[e.v.dk] ? WU.ICON[e.v.dk] : oi(e));
  }

  // ================================================================ the items
  // the flute (learnt from an elder by the water: keys 1 · 2 · 3 while held) and the lantern seed (a small light)
  if (VR.defItem && VR.ITEMS && !VR.ITEMS.wunder_flute) {
    VR.defItem('wunder_flute', { cat: 'tools', stack: 1, use: 'flute', name: 'Flute' });
    VR.defItem('lantern_seed', { cat: 'items', stack: 16, light: 9, name: 'Lantern Seed' });
  }

  // the language keys the game uses (test/wunder.js: all in both tables)
  WU.KEYS = ['g.wu.whale', 'g.wu.tree', 'g.wu.deer', 'g.wu.flute.learn', 'g.wu.flute.got', 'g.wu.flute.lesson', 'g.wu.flute.hint', 'g.wu.flute.prompt',
    'g.wu.whale.sing', 'g.wu.whale.heard', 'g.wu.whale.come', 'g.wu.whale.board', 'g.wu.whale.aboard', 'g.wu.whale.down', 'g.wu.whale.up', 'g.wu.whale.bye', 'g.wu.whale.seen',
    'g.wu.tree.sit', 'g.wu.tree.seed', 'g.wu.tree.rest', 'g.wu.tree.seen', 'g.wu.tree.ring', 'g.wu.deer.seen', 'g.wu.deer.gone', 'g.wu.deer.path', 'g.wu.deer.follow',
    'g.wu.book', 'g.wu.book.note', 'g.wu.book.whale', 'g.wu.book.tree', 'g.wu.book.deer', 'g.wu.book.none', 'g.wu.book.next', 'g.wu.book.next2', 'g.wu.lead', 'g.it.wunder_flute', 'g.it.lantern_seed',
    'g.set.wunder', 'g.set.wunder.tip', 'g.ctx.wunder'];
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
