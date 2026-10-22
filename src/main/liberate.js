// ============================================================================
// Orte befreien — the outposts of the old beacon network (a-foes; plan docs/superpowers/plans/2026-10-23-a-foes.md
// §2.3, spec docs/superpowers/specs/2026-10-22-abenteuer-design.md §6). In an Abenteuer world every outpost starts
// gestört: its Leuchtfeuer (the late block of foeblocks.js, put on the pad in place of the launch beacon) glows
// red-violet, sparks crackle on its pylons, its strays patrol (foes.js). Two ways to free it:
//   Kampf       power the strays down, then hold the beacon's circle (12 blocks) for 30 · 45 · 60 s (by band) through
//               two waves of shadow drones — leaving pauses the ring, never resets it (L.Ring)
//   Beruhigen   [V] in front of a stray starts a 2-s timing ring: [V] again while the needle is in the green arc calms
//               it (the arc grows with Geschick); then [V] at the Leuchtfeuer opens the Lichtleiter: turn the conduit
//               tiles until the light runs from the crystal to the lamp (3×3, 4×4, 5×5 by the site's distance;
//               generated along a random path, so always solvable; Geschick 5 and 10 lock a right tile each). The only
//               way with Begegnungen aus — nothing here ever needs a fight
// Freed, it is a MOMENT (L.TIMELINE, ≈ 6 s): the beacon flickers and draws in, turns cyan with a flash and a beam, a
// ring of light sweeps over the land, the music swells with a rising chord, the strays stand up with green optics,
// Funke cheers, the banner ✦ BEFREIT ✦ with the rewards, the event log's peak (w 5), the quests' 'freed'. Then it is
// useful: a trading post (its Helfer keeps the Hangar's shop), a landing pad (an autopilot target), a Schnellreise
// beacon ([V] at any freed beacon: a 3-s fade to another), and one Helfer follows the player.
// Pure core node-tested (test/liberate.js); the glue finds the outposts in the loaded columns (the pad's ship spawn and
// its launch beacon) and asks the worker for the nearest; nothing in the generator changes. Saved in
// meta.adventure.sites / .freed (A§15). Cost 🟢: a 4-Hz look at the sites, the FX only near an outpost.
// ============================================================================
(function (VR) {
  'use strict';
  const L = VR.Liberate = VR.Liberate || {};
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (v, d) => (Number.isFinite(+v) ? +v : d);
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

  // ================================================================ the rules (pure)
  L.RING_R = 12; L.RING_T = { easy: 30, normal: 45, hard: 60 }; L.WAVES = [0.25, 0.6];
  L.CALM_T = 2; L.FAST_T = 3; L.quest = true;
  // the capture ring: the zone held fills it, leaving pauses it, never resets it; two drone waves on the way
  class Ring {
    constructor(band) { this.T = L.RING_T[band] || L.RING_T.normal; this.held = 0; this.p = 0; this.w1 = false; this.w2 = false; this.done = false; }
    step(dt, inside) {
      const ev = [];
      if (this.done || !inside || !(dt > 0)) return ev;
      this.held += dt; this.p = Math.min(1, this.held / this.T);
      if (!this.w1 && this.p >= L.WAVES[0]) { this.w1 = true; ev.push('wave1'); }
      if (!this.w2 && this.p >= L.WAVES[1]) { this.w2 = true; ev.push('wave2'); }
      if (this.p >= 1 - 1e-9) { this.done = true; ev.push('done'); }
      return ev;
    }
    save() { return { h: +this.held.toFixed(3), w1: this.w1, w2: this.w2, d: this.done }; }
    static from(o, band) { const r = new Ring(band); if (o && typeof o === 'object') { r.held = clamp(num(o.h, 0), 0, 600); r.p = Math.min(1, r.held / r.T); r.w1 = !!o.w1; r.w2 = !!o.w2; r.done = !!o.d && r.p >= 1 - 1e-9; } return r; }
  }
  L.Ring = Ring;

  // ---------------------------------------------------------------- a seeded random (the same seed, the same puzzle)
  L.rng = function (seed) {
    let h = 2166136261 >>> 0; const s = String(seed);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    let x = h || 1;
    return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  };

  // ---------------------------------------------------------------- the Lichtleiter (light conduits)
  // a tile's connections as bits N 1 · E 2 · S 4 · W 8; a turn moves each a quarter clockwise
  const N = 1, E = 2, S = 4, W = 8, DIRS = [[N, -1, 0, S], [E, 0, 1, W], [S, 1, 0, N], [W, 0, -1, E]];
  L.rotMask = (m, r) => { r = ((r % 4) + 4) % 4; let x = m & 15; for (let i = 0; i < r; i++) x = ((x << 1) | (x >> 3)) & 15; return x; };
  const maskOf = (tl) => L.rotMask(tl.t, tl.r);
  L.puzzle = function (seed, n) {
    n = clamp(n | 0, 3, 5); const rnd = L.rng('lichtleiter:' + seed + ':' + n);
    const src = Math.floor(rnd() * n), dst = Math.floor(rnd() * n);
    // a path from the crystal's tile (src, 0) to the lamp's (dst, n−1): a random walk that never crosses itself
    const seen = new Uint8Array(n * n), stack = [[src, 0]], prev = new Int16Array(n * n).fill(-1);
    seen[src * n] = 1;
    let found = false;
    while (stack.length && !found) {
      const [r, c] = stack[stack.length - 1];
      if (r === dst && c === n - 1) { found = true; break; }
      const opts = [];
      for (const d of DIRS) { const rr = r + d[1], cc = c + d[2]; if (rr >= 0 && rr < n && cc >= 0 && cc < n && !seen[rr * n + cc]) opts.push([rr, cc]); }
      if (!opts.length) { stack.pop(); continue; }
      const nx = opts[Math.floor(rnd() * opts.length)];
      seen[nx[0] * n + nx[1]] = 1; prev[nx[0] * n + nx[1]] = r * n + c; stack.push(nx);
    }
    const path = []; for (let i = dst * n + n - 1; i >= 0; i = prev[i]) { path.unshift(i); if (i === src * n) break; }
    const tiles = [];
    for (let i = 0; i < n * n; i++) { const ty = [0, 5, 3, 3, 7, 5][Math.floor(rnd() * 6)]; const r = Math.floor(rnd() * 4); tiles.push({ t: ty, r, sol: r, path: false, lock: false }); }
    const dirTo = (a, b) => { const ra = (a / n) | 0, ca = a % n, rb = (b / n) | 0, cb = b % n; return rb < ra ? N : cb > ca ? E : rb > ra ? S : W; };
    const opp = (d) => (d === N ? S : d === S ? N : d === E ? W : E);
    for (let k = 0; k < path.length; k++) {
      const i = path[k], inn = k === 0 ? W : opp(dirTo(path[k - 1], i)), out = k === path.length - 1 ? E : dirTo(i, path[k + 1]), m = inn | out;
      const straight = m === (N | S) || m === (E | W), base = straight ? (N | S) : (N | E);
      let sol = 0; while (L.rotMask(base, sol) !== m) sol++;
      tiles[i] = { t: base, r: sol, sol, path: true, lock: false };
    }
    const pz = { n, src, dst, tiles };
    // scrambled until the lamp is dark
    for (let tries = 0; tries < 40; tries++) {
      for (const tl of tiles) if (tl.path) tl.r = (tl.sol + 1 + Math.floor(rnd() * 3)) % 4;
      if (!L.solved(pz)) break;
    }
    return pz;
  };
  L.clone = (pz) => ({ n: pz.n, src: pz.src, dst: pz.dst, tiles: pz.tiles.map(t => Object.assign({}, t)) });
  L.rotate = (pz, i) => { const tl = pz.tiles[i]; if (!tl || tl.lock) return false; tl.r = (tl.r + 1) % 4; return true; };
  L.flood = function (pz) {
    const n = pz.n, lit = new Uint8Array(n * n), q = [];
    const s0 = pz.src * n; if (maskOf(pz.tiles[s0]) & W) { lit[s0] = 1; q.push(s0); }
    while (q.length) {
      const i = q.pop(), r = (i / n) | 0, c = i % n, m = maskOf(pz.tiles[i]);
      for (const d of DIRS) {
        if (!(m & d[0])) continue;
        const rr = r + d[1], cc = c + d[2]; if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
        const j = rr * n + cc; if (lit[j] || !(maskOf(pz.tiles[j]) & d[3])) continue;
        lit[j] = 1; q.push(j);
      }
    }
    const d0 = pz.dst * n + n - 1;
    return { lit, solved: !!lit[d0] && !!(maskOf(pz.tiles[d0]) & E) };
  };
  L.solved = (pz) => L.flood(pz).solved;
  L.hintsFor = (ges) => ((ges | 0) >= 10 ? 2 : (ges | 0) >= 5 ? 1 : 0);
  L.hint = function (pz, k) {
    let left = k | 0;
    const order = pz.tiles.map((t, i) => i).filter(i => pz.tiles[i].path && !pz.tiles[i].lock);
    for (const i of order) { if (left <= 0) break; const tl = pz.tiles[i]; if (L.rotMask(tl.t, tl.r) === L.rotMask(tl.t, tl.sol) && left < order.length) { continue; } tl.r = tl.sol; tl.lock = true; left--; }
    for (const i of order) { if (left <= 0) break; const tl = pz.tiles[i]; if (tl.lock) continue; tl.r = tl.sol; tl.lock = true; left--; }
    return pz;
  };
  L.maskOf = maskOf;

  // ---------------------------------------------------------------- the calm ring: one lap in 2 s, press in the arc
  L.calmArc = (ges) => Math.min(140, 70 + 7 * clamp(ges | 0, 0, 10));
  L.calmStart = (rnd, ges, t) => ({ t0: +t || 0, c: 40 + (rnd ? rnd() : Math.random()) * 280, w: L.calmArc(ges) });
  L.calmNeedle = (st, t) => { const a = ((t - st.t0) / L.CALM_T) * 360; return ((a % 360) + 360) % 360; };
  L.calmPress = (st, t) => { let d = Math.abs(L.calmNeedle(st, t) - st.c) % 360; if (d > 180) d = 360 - d; return d <= st.w / 2; };

  // ---------------------------------------------------------------- a site
  L.tierOf = (x, z) => { const d = Math.hypot(x, z); return d < 900 ? 3 : d < 1800 ? 4 : 5; };
  L.rot = (dir, u, v) => { switch (((dir | 0) % 4 + 4) % 4) { case 0: return [u, v]; case 1: return [-v, u]; case 2: return [-u, -v]; default: return [v, -u]; } };
  L.beaconOf = (x, y, z, dir) => { const b = L.rot(dir, -6, 6); return [x + b[0], y + 1, z + b[1]]; };
  L.site = function (o) {
    const x = Math.round(num(o.x, 0)), y = Math.round(num(o.y, 64)), z = Math.round(num(o.z, 0)), dir = clamp(num(o.dir, 0) | 0, 0, 3);
    const s = { id: x + '_' + z, x, y, z, dir, tier: L.tierOf(x, z), strays: o.strays === undefined || o.strays === null ? null : clamp(num(o.strays, 0) | 0, 0, 8), res: 0, cal: 0, st: 'stoer', day: null, t: 0, ring: null };
    s.beacon = L.beaconOf(x, y, z, dir);
    return s;
  };
  L.state = (s) => (!s ? 'stoer' : s.st === 'frei' ? 'frei' : s.strays !== null && s.strays !== undefined && s.res >= s.strays ? 'bereit' : 'stoer');
  L.setStrays = (s, n) => { s.strays = clamp(n | 0, 0, 8); if (s.res > s.strays) s.res = s.strays; if (s.cal > s.res) s.cal = s.res; return s; };
  L.resolve = function (s, how) { if (!s || s.strays === null || s.res >= s.strays) return false; s.res++; if (how === 'calm') s.cal++; return true; };
  L.canRing = (s, enc) => L.state(s) === 'bereit' && enc !== 'off';
  L.setFree = (s, day) => { s.st = 'frei'; s.day = day | 0; s.t = Date.now(); return s; };
  // the record (A§15): meta.adventure.sites[id] = {x, y, z, dir, n (strays), res, cal, st, day, t, ring}; a freed site
  // also in meta.adventure.freed[id] = {day, as: 'trade', x, y, z, b (the beacon)}
  L.store = function (rec, s) {
    if (!rec || !s) return;
    const S = rec.sites && typeof rec.sites === 'object' ? rec.sites : (rec.sites = {});
    S[s.id] = { x: s.x, y: s.y, z: s.z, dir: s.dir, n: s.strays, res: s.res, cal: s.cal, st: s.st, day: s.day, t: s.t || 0, ring: s.ring || null };
    if (s.st === 'frei') { const Fd = rec.freed && typeof rec.freed === 'object' ? rec.freed : (rec.freed = {}); Fd[s.id] = { day: s.day | 0, as: 'trade', x: s.x, y: s.y, z: s.z, b: s.beacon, t: s.t || 0 }; }
  };
  L.load = function (rec, id) {
    const o = rec && rec.sites && rec.sites[id]; if (!o || typeof o !== 'object') return null;
    const s = L.site({ x: o.x, y: o.y, z: o.z, dir: o.dir, strays: o.n === undefined ? o.strays : o.n });
    s.id = String(id).slice(0, 40);
    if (s.strays !== null) { s.res = clamp(num(o.res, 0) | 0, 0, s.strays); s.cal = clamp(num(o.cal, 0) | 0, 0, s.res); }
    s.st = o.st === 'frei' ? 'frei' : 'stoer'; s.day = o.day === null || o.day === undefined ? null : num(o.day, 0) | 0; s.t = num(o.t, 0);
    s.ring = o.ring && typeof o.ring === 'object' ? o.ring : null;
    return s;
  };
  // the freed ones of a record, with their beacons
  L.freedList = function (rec) {
    const out = []; const Fd = rec && rec.freed && typeof rec.freed === 'object' ? rec.freed : null; if (!Fd) return out;
    for (const id in Fd) { const f = Fd[id]; if (!f || typeof f !== 'object' || !Number.isFinite(+f.x)) continue; out.push({ id, x: +f.x, y: num(f.y, 64), z: num(f.z, 0), beacon: Array.isArray(f.b) && f.b.length === 3 ? f.b.map(Number) : null, day: f.day | 0, t: num(f.t, 0) }); }
    return out;
  };
  // outposts in a column's spawns: the pad's parked ship ['starship', seed, x, y + 1, z, dir] with the launch beacon
  // (or already our Leuchtfeuer) at rot(−6, 6) on the pad — a village's pad has none
  L.fromSpawns = function (spawns, getBlock) {
    const out = [], R = VR.R; if (!Array.isArray(spawns) || !R) return out;
    const lb = R.byName.launch_beacon, lf = R.byName.leuchtfeuer;
    for (const s of spawns) {
      if (!Array.isArray(s) || s[0] !== 'starship' || s.length < 6) continue;
      const x = s[2] | 0, y1 = s[3] | 0, z = s[4] | 0, dir = s[5] | 0, b = L.beaconOf(x, y1 - 1, z, dir);
      const st = getBlock(b[0], b[1], b[2]), ty = st ? R.T.type[st] : -1;
      if (!((lb && ty === lb.id) || (lf && ty === lf.id))) continue;
      out.push({ id: x + '_' + z, x, y: y1 - 1, z, dir, beacon: b });
    }
    return out;
  };
  L.travelTargets = function (freed, here) {
    const out = [];
    for (const f of freed || []) { const b = f.beacon || [f.x, f.y, f.z]; const d = Math.hypot(b[0] - here[0], b[2] - here[2]); if (d < 8) continue; out.push(Object.assign({ d }, f)); }
    return out.sort((a, b) => a.d - b.d);
  };
  L.placeOf = (s) => ({ id: s.id, x: s.x, y: s.y, z: s.z });
  // the outposts' names: our own words, chosen by the place
  L.NAMES = ['Nordwind', 'Kupferhang', 'Sternwacht', 'Morgenrot', 'Silbergrat', 'Funkenfeld', 'Weitblick', 'Glimmerhöhe', 'Abendtau', 'Wolkenrast', 'Lichtung', 'Steinbogen', 'Bernsteinkamm', 'Himmelstor', 'Westwacht', 'Taufeld'];
  L.nameOf = (s) => L.NAMES[Math.floor(L.rng('name:' + s.id)() * L.NAMES.length)];
  // the moment's beats (s from the start)
  L.TIMELINE = [{ t: 0, k: 'flicker' }, { t: 0.6, k: 'cyan' }, { t: 0.6, k: 'beam' }, { t: 0.75, k: 'ring' }, { t: 0.9, k: 'music' }, { t: 1.6, k: 'stand' }, { t: 2.2, k: 'funke' }, { t: 2.4, k: 'banner' }, { t: 6.2, k: 'end' }];
  L.beatsBetween = (a, b) => L.TIMELINE.filter(q => q.t > a - 1e-9 && q.t <= b + 1e-9 && !(a > 0 && q.t <= a));
  L.KEYS = ['g.lib.calm.hint', 'g.lib.calm.ok', 'g.lib.calm.miss', 'g.lib.ring', 'g.lib.ring.out', 'g.lib.ring.wave', 'g.lib.ring.start', 'g.lib.puz.title', 'g.lib.puz.help', 'g.lib.puz.later', 'g.lib.puz.done', 'g.lib.puz.hint',
    'g.lib.freed.kick', 'g.lib.freed.title', 'g.lib.freed.sub', 'g.lib.funke.freed', 'g.lib.funke.ready', 'g.lib.funke.helper', 'g.lib.funke.ring', 'g.lib.funke.stoer', 'g.lib.trader', 'g.lib.fast.title', 'g.lib.fast.none', 'g.lib.fast.go', 'g.lib.fast.close',
    'g.lib.journal', 'g.lib.journal.none', 'g.lib.journal.freed', 'g.lib.journal.stoer', 'g.lib.site', 'g.lib.helper', 'g.lib.q.note', 'g.adv.taler', 'g.adv.float'];

  // ================================================================================ the game
  const game = () => VR.game || null;
  const F = () => VR.Foes;
  const A = () => VR.Adventure;
  const rec = () => (VR.Adventure && VR.Adventure.rec) || null;
  L.cost = { frames: 0, ms: 0, fx: 0, fxMs: 0 };
  // this world's sites (a fresh table for every world)
  const W0 = { world: null, sites: new Map(), ruins: new Map(), asked: -1e9, askAt: null, listener: null, vil: new Map() };
  L.W = W0;
  function bind(g) {
    if (W0.world === g.world) return;
    W0.world = g.world; W0.sites = new Map(); W0.ruins = new Map(); W0.asked = -1e9; W0.askAt = null; W0.vil = new Map();
    L.moment = null; L.calmSt = null; L.closePuzzle(); L.ringSite = null;
    const r0 = rec();
    if (r0 && r0.sites) for (const id in r0.sites) { const s = L.load(r0, id); if (s) W0.sites.set(s.id, s); }
    if (g.world && g.world.listeners) {
      W0.listener = { onColumnLoaded: (c) => L.onColumn(g, c) };
      g.world.listeners.push(W0.listener);
      for (const c of g.world.cols.values()) if (c.ready) L.onColumn(g, c);
    }
  }
  // a column came in: outposts (the pad's ship + its launch beacon), ruins (a ruined gate's chest)
  L.onColumn = function (g, c) {
    if (!c) return;
    if (c.spawns && c.spawns.length) {
      const w = g.world;
      for (const o of L.fromSpawns(c.spawns, (x, y, z) => w.getBlock(x, y, z))) L.know(g, o);
    }
    if (c.blockEntities && c.blockEntities.size) for (const [k, v] of c.blockEntities) if (v && v.loot === 'ruin') {
      const x = c.cx * 16 + (k & 15), z = c.cz * 16 + ((k >> 4) & 15), id = 'r' + x + '_' + z;
      if (!W0.ruins.has(id)) W0.ruins.set(id, { id, kind: 'ruin', x, y: k >> 8, z, r: 32 });
    }
  };
  L.know = function (g, o) {
    let s = W0.sites.get(o.id);
    if (!s) { s = L.site(o); W0.sites.set(s.id, s); }
    else if (o.dir !== undefined) { s.dir = o.dir; s.beacon = L.beaconOf(s.x, s.y, s.z, s.dir); s.y = o.y; }
    s.known = true;
    L.ensureBeacon(g, s);
    return s;
  };
  // the Leuchtfeuer on the pad: red-violet while gestört, cyan when free (a runtime edit, Abenteuer worlds only)
  L.ensureBeacon = function (g, s) {
    if (!F() || !F().advOn(g) || !s.beacon) return false;
    const w = g.world, R = VR.R, lf = R.byName.leuchtfeuer, b = s.beacon; if (!lf || !w) return false;
    if (!w.isLoaded(b[0], b[2])) return false;
    const cur = w.getBlock(b[0], b[1], b[2]), want = lf.state({ frei: s.st === 'frei' ? 1 : 0 });
    if (cur === want) return true;
    const ty = cur ? R.T.type[cur] : -1, lb = R.byName.launch_beacon;
    if (cur && ty !== lf.id && !(lb && ty === lb.id)) return false;   // (something the player put there stays)
    w.setBlock(b[0], b[1], b[2], want, 4);
    return true;
  };
  // the nearest outpost, from the worker (/locate's job), while the player moves
  function ask(g) {
    const p = g.player.pos, t = g.time || 0;
    if (t - W0.asked < 12 || !g.pool || !g.pool.direct) return;
    if (W0.askAt && Math.hypot(p[0] - W0.askAt[0], p[2] - W0.askAt[1]) < 160 && t - W0.asked < 90) return;
    W0.asked = t; W0.askAt = [p[0], p[2]];
    const world = g.world;
    try { g.pool.direct(0, { type: 'locate', dim: g.dim, biome: 'outpost', x: Math.floor(p[0]), z: Math.floor(p[2]) }, null, (m) => { if (W0.world !== world || !m || !Array.isArray(m.pos)) return; L.knowFar(m.pos); }); } catch (e) { /* no worker: the columns tell */ }
  }
  L.knowFar = function (pos) {
    const id = Math.round(pos[0]) + '_' + Math.round(pos[2]);
    if (!W0.sites.has(id)) W0.sites.set(id, Object.assign(L.site({ x: pos[0], y: pos[1], z: pos[2], dir: 0 }), { known: false }));
    return W0.sites.get(id);
  };
  L.sites = () => W0.sites;
  // the contested zones for foes.js: the unfreed outposts and the ruins
  const ZL = [];
  L.zones = function (g) {
    ZL.length = 0;
    for (const s of W0.sites.values()) if (s.known && s.st !== 'frei') ZL.push(s.zone || (s.zone = { id: 'o:' + s.id, kind: 'outpost', x: s.x, y: s.y, z: s.z, r: 40, site: s }));
    for (const r of W0.ruins.values()) ZL.push(r);
    void g;
    return ZL;
  };
  L.siteOf = (id) => W0.sites.get(id) || null;
  L.save = function (g, s) { const r0 = rec(); if (r0 && s) L.store(r0, s); if (g && g.saveMeta && !(g.meta && g.meta.guest)) { try { const q = g.saveMeta(); if (q && q.catch) q.catch(() => {}); } catch (e) { /* the autosave keeps it */ } } };
  // a stray of a site powered down or calmed
  L.resolved = function (g, id, how) {
    const s = W0.sites.get(id); if (!s || s.st === 'frei') return;
    if (L.resolve(s, how)) { L.save(g, s); if (L.state(s) === 'bereit') L.ready(g, s); }
  };
  L.ready = function (g, s) {
    const fk = g.funke, key = VR.Binds && VR.Binds.label ? VR.Binds.label('KeyV', VR.I18N && VR.I18N.lang) : 'V';
    const txt = T('g.lib.funke.ready', { key });
    if (fk && fk.on && fk.on() && fk.show) fk.show(txt); else if (g.ui && g.ui.hint) g.ui.hint(txt, 4200);
  };
  // the Kranarm's place: the control tower's roof
  L.towerSpot = function (s, g) {
    const q = L.rot(s.dir, 15, 0), x = s.x + q[0], z = s.z + q[1];
    const w = g && g.world; if (!w || !w.isLoaded(x, z)) return null;
    const y = w.topAt(x, z); return [x + 0.5, y + 1, z + 0.5];
  };

  // ---------------------------------------------------------------- the frame (from foes.js: F.tick)
  L.tick = function (g, dt, on) {
    const t0 = now();
    if (!on) { if (L.calmSt) L.calmEnd(g, false); if (L.puz) L.closePuzzle(); L.moment = null; L.ring(g, null); return; }
    bind(g);
    ask(g);
    if ((L.slow = (L.slow || 0) - dt) <= 0) { L.slow = 0.25; L.look(g); }
    L.stepRing(g, dt);
    if (L.calmSt) L.stepCalm(g, dt);
    if (L.moment) L.stepMoment(g, dt);
    if (L.fade) L.stepFade(g, dt);
    L.stepHelpers(g, dt);
    const C = L.cost, ms = now() - t0; C.frames++; C.ms += ms;
  };
  // four times a second: the beacons' state, the sparks of a disturbed outpost, the Helfer of a freed one
  L.look = function (g) {
    const p = g.player.pos, P = g.particles, En = g.entities;
    for (const s of W0.sites.values()) {
      if (!s.known) continue;
      const d = Math.hypot(p[0] - s.x, p[2] - s.z);
      if (d > 140) continue;
      if (!s.placed) s.placed = L.ensureBeacon(g, s);
      if (s.st !== 'frei' && d < 70 && P && s.beacon) {   // red-violet sparks crackle on the pylons and the beacon
        const q = L.rot(s.dir, Math.random() < 0.5 ? 7 : -7, Math.random() < 0.5 ? 7 : -7);
        P.spark(s.x + q[0] + 0.5, s.y + 3.6, s.z + q[1] + 0.5, [1, 0.25, 0.85], 5, 2.2, 1);
        if (Math.random() < 0.5) P.glow(s.beacon[0] + 0.5, s.beacon[1] + 1.1, s.beacon[2] + 0.5, [1, 0.3, 0.9], 1.0, 0.07, 0.8);
      }
      if (s.st === 'frei' && d < 64 && En) L.ensureTrader(g, En, s);
    }
  };

  // ---------------------------------------------------------------- the capture ring
  L.ringSite = null;
  L.stepRing = function (g, dt) {
    const p = g.player.pos, enc = F() ? F().enc() : 'off', kids = !!(g.settings && g.settings.kids);
    let s = L.ringSite;
    if (!s) for (const q of W0.sites.values()) { if (q.known && L.state(q) === 'bereit' && q.beacon && Math.hypot(p[0] - q.beacon[0], p[2] - q.beacon[2]) < L.RING_R + 10) { s = q; break; } }
    if (!s || !L.canRing(s, kids ? 'off' : enc) || L.moment) { L.ringSite = null; L.ring(g, null); return; }
    L.ringSite = s;
    const r0 = rec(), band = r0 ? r0.band : 'normal';
    if (!s.ringObj) s.ringObj = Ring.from(s.ring, band);
    const R = s.ringObj, b = s.beacon, inside = Math.hypot(p[0] - b[0] - 0.5, p[2] - b[2] - 0.5) <= L.RING_R && Math.abs(p[1] - b[1]) < 8 && !g.player.dead && !(F() && F().fainting);
    if (inside && !s.ringSaid) { s.ringSaid = true; const fk = g.funke; if (fk && fk.on && fk.on() && fk.show) fk.show(T('g.lib.funke.ring')); }
    const ev = R.step(dt, inside);
    for (const e of ev) {
      if (e === 'wave1' || e === 'wave2') { if (F() && F().swarm) F().swarm(g, b[0] + 0.5, b[1], b[2] + 0.5, s.id); if (g.ui && g.ui.hint) g.ui.hint(T('g.lib.ring.wave'), 2400); if (g.audio && g.audio.play) g.audio.play('static'); }
      if (e === 'done') L.free(g, s);
    }
    if ((s.ringSaveT = (s.ringSaveT || 0) - dt) <= 0 && inside) { s.ringSaveT = 5; s.ring = R.save(); L.save(null, s); }
    L.ring(g, s, inside);
  };
  // the ring's line on the HUD
  let ringEl = null, ringKey = '';
  L.ring = function (g, s, inside) {
    if (typeof document === 'undefined' || !document.createElement) return;
    if (!s) { if (ringEl && ringKey !== '') { ringEl.style.display = 'none'; ringKey = ''; } return; }
    if (!ringEl) { css(); ringEl = document.createElement('div'); ringEl.id = 'libring'; (document.getElementById('hud') || document.body).appendChild(ringEl); }
    const pc = Math.floor(s.ringObj.p * 100), key = pc + ':' + (inside ? 1 : 0);
    if (key === ringKey) return; ringKey = key;
    ringEl.style.display = '';
    ringEl.className = inside ? 'in' : 'out';
    ringEl.innerHTML = `<div class="bar"><i style="width:${pc}%"></i></div><div class="tx">${esc(inside ? T('g.lib.ring', { p: pc }) : T('g.lib.ring.out'))}</div>`;
  };

  // ---------------------------------------------------------------- the calm ring ([V] at a stray)
  L.calmSt = null;
  L.calmBegin = function (g, m) {
    if (!m || !m.foe || m.foe.gone || L.calmSt) return false;
    const f = m.foe; if (f.st === 'down' || f.st === 'calm' || f.st === 'helper' || f.st === 'leave' || f.st === 'strike') return false;
    const r0 = rec(), ges = r0 ? r0.me.pts.ges | 0 : 0;
    L.calmSt = Object.assign(L.calmStart(Math.random, ges, g.time || 0), { m, tries: 0, end: 0 });
    f.listen = true;   // (it pauses while it listens)
    if (f.tok && F()) { F().W.tokens.give(m.id); f.tok = false; } if (f.st === 'tele') { f.st = 'approach'; f.t = 0; f.cool = Math.max(f.cool, 2.5); }
    L.calmUi(g, true);
    if (g.audio && g.audio.play) g.audio.play('button');
    return true;
  };
  L.calmTap = function (g) {
    const S = L.calmSt; if (!S) return false;
    const t = g.time || 0;
    if (L.calmPress(S, t)) { L.calmEnd(g, true); return true; }
    S.tries++; S.flash = 0.35;
    if (g.audio && g.audio.play) g.audio.play('deny');
    if (g.ui && g.ui.hint) g.ui.hint(T('g.lib.calm.miss'), 1200);
    return false;
  };
  L.stepCalm = function (g, dt) {
    const S = L.calmSt, m = S.m, p = g.player.pos;
    if (!m.foe || m.foe.gone || m.foe.st === 'down' || Math.hypot(m.pos[0] - p[0], m.pos[2] - p[2]) > 7) { L.calmEnd(g, false); return; }
    m.vel[0] = 0; m.vel[2] = 0; m.foe.cool = Math.max(m.foe.cool, 1.5);
    if (S.flash > 0) S.flash -= dt;
    L.calmUi(g, true);
  };
  L.calmEnd = function (g, ok) {
    const S = L.calmSt; L.calmSt = null; L.calmUi(g, false);
    if (!S) return;
    const m = S.m; if (m && m.foe) m.foe.listen = false;
    if (ok && m && F()) {
      F().calmMob(g, m);
      if (g.ui && g.ui.hint) g.ui.hint(T('g.lib.calm.ok'), 1600);
      if (m.foe.site) L.resolved(g, m.foe.site, 'calm');
    }
  };
  let calmEl = null;
  L.calmUi = function (g, on) {
    if (typeof document === 'undefined' || !document.createElement) return;
    if (!on) { if (calmEl) calmEl.style.display = 'none'; return; }
    if (!calmEl) {
      css(); calmEl = document.createElement('div'); calmEl.id = 'libcalm';
      calmEl.innerHTML = '<svg viewBox="-60 -60 120 120"><circle class="bg" r="44"/><path class="arc" d=""/><line class="nd" x1="0" y1="0" x2="0" y2="-50"/><circle class="hub" r="7"/></svg><div class="tx"></div>';
      (document.getElementById('app') || document.body).appendChild(calmEl);
    }
    const S = L.calmSt; if (!S) return;
    calmEl.style.display = '';
    if (S.drawn !== S.c) {
      S.drawn = S.c;
      const a0 = (S.c - S.w / 2 - 90) * Math.PI / 180, a1 = (S.c + S.w / 2 - 90) * Math.PI / 180, r = 44;
      calmEl.querySelector('.arc').setAttribute('d', `M ${(Math.cos(a0) * r).toFixed(2)} ${(Math.sin(a0) * r).toFixed(2)} A ${r} ${r} 0 ${S.w > 180 ? 1 : 0} 1 ${(Math.cos(a1) * r).toFixed(2)} ${(Math.sin(a1) * r).toFixed(2)}`);
      const key = VR.Binds && VR.Binds.label ? VR.Binds.label('KeyV', VR.I18N && VR.I18N.lang) : 'V';
      calmEl.querySelector('.tx').textContent = T('g.lib.calm.hint', { key });
    }
    const nd = calmEl.querySelector('.nd'); nd.setAttribute('transform', 'rotate(' + L.calmNeedle(S, g.time || 0).toFixed(1) + ')');
    calmEl.className = S.flash > 0 ? 'miss' : (L.calmPress(S, g.time || 0) ? 'hot' : '');
  };

  // ---------------------------------------------------------------- the Lichtleiter ([V] Reparieren at a bereit beacon)
  L.puz = null;
  L.openPuzzle = function (g, s) {
    if (!s || typeof document === 'undefined') return false;
    if (L.state(s) === 'stoer') { const fk = g.funke; if (fk && fk.on && fk.on() && fk.show) fk.show(T('g.lib.funke.stoer', { key: VR.Binds && VR.Binds.label ? VR.Binds.label('KeyV', VR.I18N && VR.I18N.lang) : 'V' })); else if (g.ui && g.ui.hint) g.ui.hint(T('g.lib.funke.stoer', { key: 'V' }), 3600); return false; }
    if (s.st === 'frei') return false;
    const r0 = rec(), ges = r0 ? r0.me.pts.ges | 0 : 0;
    if (!s.pz) { s.pz = L.puzzle(s.id, s.tier); L.hint(s.pz, L.hintsFor(ges)); }
    L.puz = { s, done: 0 };
    css();
    let el = document.getElementById('lichtleiter');
    if (!el) {
      el = document.createElement('div'); el.id = 'lichtleiter'; el.className = 'screen';
      el.innerHTML = '<div class="panel box llcard"></div>';
      const root = (g.ui && g.ui.root) || document.getElementById('ui') || document.body; root.appendChild(el);
    }
    L.renderPuzzle();
    if (g.ui && g.ui.show) g.ui.show('lichtleiter'); else el.classList.add('on');
    return true;
  };
  L.closePuzzle = function () {
    const P = L.puz; L.puz = null; if (!P) return;
    const g = game(); if (g && g.ui && g.ui.screen === 'lichtleiter' && g.ui.resume) g.ui.resume();
  };
  // the tile's conduit as SVG (a 100 × 100 cell, the connections from the middle to the edges)
  const tileSvg = (m, lit, locked) => {
    const c = lit ? '#7ff6ff' : '#5d6b82', w = lit ? 15 : 13, seg = { 1: 'M50 50V0', 2: 'M50 50H100', 4: 'M50 50V100', 8: 'M50 50H0' };
    let d = ''; for (const b of [1, 2, 4, 8]) if (m & b) d += seg[b];
    return `<svg viewBox="0 0 100 100"><rect x="3" y="3" width="94" height="94" rx="12" class="bg${locked ? ' lk' : ''}"/>${d ? `<path d="${d}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" fill="none"${lit ? ' filter="url(#llglow)"' : ''}/><circle cx="50" cy="50" r="${m ? 10 : 0}" fill="${c}"/>` : ''}</svg>`;
  };
  L.renderPuzzle = function () {
    const P = L.puz, el = typeof document !== 'undefined' && document.querySelector('#lichtleiter .panel'); if (!P || !el) return;
    const pz = P.s.pz, fl = L.flood(pz), n = pz.n;
    let h = `<svg width="0" height="0" style="position:absolute"><defs><filter id="llglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs></svg>`;
    h += `<div class="llhead"><h2>💠 ${esc(T('g.lib.puz.title'))}</h2><button type="button" class="btn small" data-ll="close">${esc(T('g.lib.puz.later'))}</button></div>`;
    h += `<div class="note">${esc(T('g.lib.puz.help'))}</div>`;
    h += `<div class="llgrid${fl.solved ? ' solved' : ''}" style="--n:${n}">`;
    for (let r = 0; r < n; r++) {
      h += `<div class="llside l">${r === pz.src ? '<i class="cry"></i>' : ''}</div>`;
      for (let c = 0; c < n; c++) { const i = r * n + c, tl = pz.tiles[i]; h += `<button type="button" class="lltile${tl.lock ? ' lock' : ''}" data-ll="t" data-i="${i}" aria-label="${r + 1}·${c + 1}">${tileSvg(maskOf(tl), !!fl.lit[i], tl.lock)}</button>`; }
      h += `<div class="llside r">${r === pz.dst ? `<i class="lamp${fl.solved ? ' on' : ''}"></i>` : ''}</div>`;
    }
    h += '</div>';
    const hints = pz.tiles.filter(t => t.lock).length;
    if (hints) h += `<div class="note llh">${esc(T('g.lib.puz.hint', { n: hints }))}</div>`;
    if (fl.solved) h += `<div class="lldone">${esc(T('g.lib.puz.done'))}</div>`;
    el.innerHTML = h;
    if (el.querySelectorAll) for (const b of el.querySelectorAll('[data-ll]')) b.onclick = () => L.puzAct(b.getAttribute('data-ll'), +b.getAttribute('data-i'));
  };
  L.puzAct = function (what, i) {
    const P = L.puz, g = game(); if (!P || !g) return;
    if (what === 'close') { L.closePuzzle(); return; }
    if (what === 't' && !P.done && L.rotate(P.s.pz, i)) {
      if (g.audio && g.audio.play) g.audio.play('switch');
      L.renderPuzzle();
      if (L.solved(P.s.pz)) {
        P.done = 1; if (g.audio && g.audio.play) g.audio.play('twinkle');
        const s = P.s; setTimeout(() => { if (L.puz && L.puz.s === s) L.closePuzzle(); L.free(g, s); }, 1300);
      }
    }
  };

  // ---------------------------------------------------------------- the MOMENT: freed
  L.moment = null;
  L.free = function (g, s) {
    if (!s || s.st === 'frei' || (L.moment && L.moment.s === s)) return false;
    L.moment = { s, t: 0, done: new Set() };
    L.ringSite = null; L.ring(g, null);
    if (F() && g.entities) { const Fo = F(); for (const m of g.entities.mobs) { const f = m.foe; if (f && !f.gone && f.wave && f.site === s.id) { f.st = 'leave'; f.t = 0; if (f.tok) { Fo.W.tokens.give(m.id); f.tok = false; } } } }
    return true;
  };
  L.stepMoment = function (g, dt) {
    const M = L.moment, s = M.s, b = s.beacon || [s.x, s.y + 1, s.z], P = g.particles, t0 = M.t;
    M.t += dt;
    for (const q of L.beatsBetween(t0 === 0 ? 0 : t0, M.t)) { if (M.done.has(q.k)) continue; M.done.add(q.k); L.beat(g, s, q.k); }
    if (P && M.t < 0.6) { if (Math.random() < 0.6) P.spark(b[0] + 0.5, b[1] + 0.8, b[2] + 0.5, Math.random() < 0.5 ? [1, 0.3, 0.9] : [0.5, 0.95, 1], 6, 2.5, 1); }
    if (P && M.t > 0.6 && M.t < 3.5 && Math.random() < 0.5) P.glow(b[0] + 0.5 + (Math.random() - 0.5) * 2, b[1] + 1 + Math.random() * 3, b[2] + 0.5 + (Math.random() - 0.5) * 2, [0.55, 1, 1], 2.2, 0.06, 1.6);
    if (M.done.has('end')) L.moment = null;
  };
  L.beat = function (g, s, k) {
    const b = s.beacon || [s.x, s.y + 1, s.z], au = g.audio, P = g.particles;
    switch (k) {
      case 'flicker': if (au && au.play) au.play('spool'); break;
      case 'cyan': {
        L.setFree(s, g.env ? g.env.day | 0 : 0); s.placed = L.ensureBeacon(g, s); s.ringObj = null; s.ring = null; s.zone = null;
        if (P) { P.spark(b[0] + 0.5, b[1] + 1, b[2] + 0.5, [0.6, 1, 1], 60, 7, 1); P.spark(b[0] + 0.5, b[1] + 1, b[2] + 0.5, [1, 1, 1], 30, 4, 1); }
        L.bloom(); if (au && au.play) au.play('thump', { vol: 0.8 });
        break;
      }
      case 'music': {
        if (au && au.swell) au.swell(g.env ? g.env.day | 0 : 0, 0.9);
        if (au && au.ctx && au.tone) { const t = au.ctx.currentTime; [392, 494, 587, 784, 988].forEach((f, i) => { au.tone(f, 0.09, 2.6 - i * 0.2, 'sine', true, t + i * 0.16); au.tone(f * 2.01, 0.025, 1.6, 'sine', true, t + i * 0.16 + 0.01); }); }
        break;
      }
      case 'stand': L.standUp(g, s); break;
      case 'funke': { const fk = g.funke, txt = T('g.lib.funke.freed'); if (fk && fk.on && fk.on() && fk.show) fk.show(txt); else if (g.ui && g.ui.toast) g.ui.toast(txt, '', null); break; }
      case 'banner': {
        const Ad = A(); let r = null;
        if (Ad && Ad.award) r = Ad.award('freed', { id: s.id });
        L.banner(g, s, r);
        if (VR.EventLog && VR.EventLog.emit) VR.EventLog.emit('milestone', 'freed', 5, [b[0] + 0.5, b[1] + 2, b[2] + 0.5], 'liberate', 40);
        if (VR.Quests && VR.Quests.emit) VR.Quests.emit('freed', { id: s.id });
        if (VR.EventLog && VR.EventLog.found) { /* (the codex's own discoveries stay theirs) */ }
        L.save(g, s);
        break;
      }
    }
  };
  // the strays stand up as Helfer: the first follows the player, one keeps the trading post; new ones rise from the pad
  L.standUp = function (g, s) {
    const En = g.entities, Fo = F(); if (!En || !Fo) return;
    const calm = [];
    for (const m of En.mobs) { const f = m.foe; if (f && !f.gone && !f.remote && f.site === s.id && (f.st === 'calm' || f.st === 'patrol' || f.st === 'approach')) calm.push(m); }
    while (calm.length < 2) { const m = Fo.guard(g, En, s, calm.length + 1, true, Object.assign(Fo.ctx(g), { enc: 'normal', lastBuild: -1e12, freed: [], villages: [], homes: [] })); if (!m) break; calm.push(m); }
    const r0 = rec(); let follower = null;
    for (const m of En.mobs) if (m.foe && m.foe.helper && !m.foe.trader && !m.foe.gone) follower = m;
    calm.forEach((m, i) => {
      const f = m.foe; f.st = 'helper'; f.t = 0; f.helper = true; f.calm = 1; f.kneel = 1;
      if (i === 0 && !follower) { follower = m; f.follow = null; f.site = null; if (r0) r0.helper = { k: f.k }; Fo.stats.helpers++; }
      else { f.trader = true; f.site = s.id; const q = L.rot(s.dir, 4, -4); f.follow = [s.x + q[0] + 0.5, s.y + 1, s.z + q[1] + 0.5]; }
      if (g.particles) g.particles.spark(m.pos[0], m.pos[1] + 0.8, m.pos[2], [0.4, 1, 0.6], 18, 3, 1);
    });
    if (follower) setTimeout(() => { const fk = g.funke; if (fk && fk.on && fk.on() && fk.show) fk.show(T('g.lib.funke.helper')); }, 4600);
  };
  // the trading post keeps its Helfer (back after a reload)
  L.ensureTrader = function (g, En, s) {
    for (const m of En.mobs) if (m.foe && !m.foe.gone && m.foe.trader && m.foe.site === s.id) return;
    const Fo = F(); if (!Fo) return;
    const q = L.rot(s.dir, 4, -4), x = s.x + q[0], z = s.z + q[1];
    if (!g.world.isLoaded(x, z)) return;
    const m = En.summon('foe_driller', x + 0.5, s.y + 1, z + 0.5); if (!m) return;
    m.foe = Fo.make('driller', m.id, m.pos); m.foe.st = 'helper'; m.foe.helper = true; m.foe.trader = true; m.foe.site = s.id; m.foe.follow = [x + 0.5, s.y + 1, z + 0.5]; m.foe.calm = 1;
  };
  // the player's Helfer: back beside the player after a reload; at night beside the home
  L.stepHelpers = function (g, dt) {
    const En = g.entities, r0 = rec(), Fo = F(); if (!En || !Fo || !r0 || !r0.helper) return;
    if ((L.helpT = (L.helpT || 0) - dt) > 0) return; L.helpT = 1;
    let fol = null; for (const m of En.mobs) if (m.foe && !m.foe.gone && m.foe.helper && !m.foe.trader) fol = m;
    const p = g.player.pos;
    if (!fol) {
      const k = Fo.KINDS[r0.helper.k] && Fo.STRAYS.indexOf(r0.helper.k) >= 0 && r0.helper.k !== 'crane' ? r0.helper.k : 'driller';
      const pt = Fo.spot(g, p[0], p[2], 4, Math.random); if (!pt) return;
      fol = En.summon('foe_' + k, pt[0], pt[1], pt[2]); if (!fol) return;
      fol.foe = Fo.make(k, fol.id, pt); fol.foe.st = 'helper'; fol.foe.helper = true; fol.foe.calm = 1;
    }
    // at night, near home, it sits by the door
    const NL = VR.NewLife, h = NL && NL.home ? NL.home(g) : null, night = g.env && g.env.E && g.env.E.night > 0.6;
    if (night && h && h.dim === g.dim && Array.isArray(h.pos) && Math.hypot(p[0] - h.pos[0], p[2] - h.pos[2]) < 30) { fol.foe.follow = [h.pos[0] + 1.5, h.pos[1], h.pos[2] + 1.5]; fol.foe.sit = true; }
    else { fol.foe.follow = null; fol.foe.sit = false; }
    if (Math.hypot(fol.pos[0] - p[0], fol.pos[2] - p[2]) > 40 && !fol.foe.sit) { const pt = Fo.spot(g, p[0], p[2], 4, Math.random); if (pt) { fol.pos[0] = pt[0]; fol.pos[1] = pt[1]; fol.pos[2] = pt[2]; } }
  };
  // the banner (gold and cyan), the bloom over the screen
  L.banner = function (g, s, r) {
    if (typeof document === 'undefined' || !document.createElement) return;
    css();
    let el = document.getElementById('libban');
    if (!el) { el = document.createElement('div'); el.id = 'libban'; el.setAttribute('aria-live', 'polite'); (document.getElementById('app') || document.body).appendChild(el); }
    const xp = r && r.xp ? r.xp : 0, tl = r ? (r.taler || 0) + (r.gift || 0) : 0;
    const sub = [xp ? T('g.adv.float', { n: xp }) : '', tl ? T('g.adv.taler', { n: '+' + tl }) : ''].filter(Boolean).join('   ·   ');
    el.innerHTML = `<div class="rays"></div><div class="glow"></div><div class="kick">${esc(T('g.lib.freed.kick'))}</div><div class="big">${esc(T('g.lib.freed.title', { name: L.nameOf(s) }))}</div>` + (sub ? `<div class="sub">${esc(T('g.lib.freed.sub', { r: sub }))}</div>` : '');
    el.className = ''; void el.offsetWidth; el.className = 'on';
    clearTimeout(L.banT); L.banT = setTimeout(() => { el.className = 'off'; L.banT = setTimeout(() => { el.className = ''; }, 900); }, 4200);
  };
  L.bloom = function () {
    if (typeof document === 'undefined' || !document.createElement) return;
    css();
    let el = document.getElementById('libbloom');
    if (!el) { el = document.createElement('div'); el.id = 'libbloom'; (document.getElementById('app') || document.body).appendChild(el); }
    el.className = ''; void el.offsetWidth; el.className = 'on';
  };

  // ---------------------------------------------------------------- Schnellreise: between the freed beacons (a 3-s fade)
  L.fastOpen = function (g, s) {
    if (typeof document === 'undefined' || !document.createElement) return false;
    const r0 = rec(); if (!r0) return false;
    const here = s ? s.beacon || [s.x, s.y, s.z] : g.player.pos, list = L.travelTargets(L.freedList(r0), here);
    css();
    let el = document.getElementById('libfast');
    if (!el) { el = document.createElement('div'); el.id = 'libfast'; el.className = 'screen'; el.innerHTML = '<div class="panel box llcard"></div>'; ((g.ui && g.ui.root) || document.getElementById('ui') || document.body).appendChild(el); }
    let h = `<div class="llhead"><h2>⚡ ${esc(T('g.lib.fast.title'))}</h2><button type="button" class="btn small" data-lf="close">${esc(T('g.lib.fast.close'))}</button></div>`;
    if (!list.length) h += `<div class="note">${esc(T('g.lib.fast.none'))}</div>`;
    for (const q of list.slice(0, 8)) { const st = L.siteOf(q.id) || L.site(q); h += `<button type="button" class="btn lfgo" data-lf="go" data-id="${esc(q.id)}">${esc(T('g.lib.fast.go', { name: L.nameOf(st), d: VR.Ctx && VR.Ctx.dist ? VR.Ctx.dist(q.d) : Math.round(q.d) + ' m' }))}</button>`; }
    el.querySelector('.panel').innerHTML = h;
    for (const b of el.querySelectorAll('[data-lf]')) b.onclick = () => { if (b.getAttribute('data-lf') === 'go') { const q = list.find(x => x.id === b.getAttribute('data-id')); if (g.ui && g.ui.resume) g.ui.resume(); if (q) L.fastGo(g, q); } else if (g.ui && g.ui.resume) g.ui.resume(); };
    if (g.ui && g.ui.show) g.ui.show('libfast');
    return true;
  };
  L.fade = null;
  L.fastGo = function (g, q) {
    if (L.fade) return false;
    const b = q.beacon || [q.x, q.y + 1, q.z], d = L.rot(0, 0, 0);
    L.fade = { t: 0, to: [b[0] + 0.5 + 2.5, b[1] + 0.2, b[2] + 0.5 + 2.5], moved: false }; void d;
    F() && F().veil && (function () { const el = document.getElementById('foeveil'); if (el) el.querySelector('span').textContent = ''; })();
    L.veil(true);
    if (g.audio && g.audio.play) g.audio.play('warp');
    return true;
  };
  L.stepFade = function (g, dt) {
    const S = L.fade; S.t += dt;
    if (S.t >= 1.2 && !S.moved) { S.moved = true; try { g.player.safeTeleport(S.to[0], S.to[1], S.to[2]); } catch (e) { g.player.pos = S.to.slice(); } }
    if (S.t >= L.FAST_T) { L.fade = null; L.veil(false); }
  };
  L.veil = function (on) {
    if (typeof document === 'undefined' || !document.createElement) return;
    let el = document.getElementById('libveil');
    if (!el) { css(); el = document.createElement('div'); el.id = 'libveil'; (document.getElementById('app') || document.body).appendChild(el); }
    el.className = on ? 'on' : '';
  };

  // ---------------------------------------------------------------- [V]: e-ctx's row 4 — Beruhigen · Reparieren · Schnellreise · Einkaufen
  L.near = function (g, eye, dir) {
    if (!F() || !F().on(g)) return null;
    if (L.calmSt) return { kind: 'machine', pos: [L.calmSt.m.pos[0], L.calmSt.m.pos[1] + 0.8, L.calmSt.m.pos[2]], r: 1.2, act: (gg) => L.calmTap(gg) };
    const En = g.entities, list = NEAR; list.length = 0;
    if (En) for (const m of En.mobs) {
      const f = m.foe; if (!f || f.gone || f.remote || Math.abs(m.pos[0] - eye[0]) > 6 || Math.abs(m.pos[2] - eye[2]) > 6) continue;
      if (f.trader) { list.push({ kind: 'shop', name: T('g.lib.trader'), pos: [m.pos[0], m.pos[1] + 0.7, m.pos[2]], r: 0.9, act: (gg) => L.trade(gg, m) }); continue; }
      if (F().STRAYS.indexOf(f.k) < 0 || f.helper || f.st === 'calm' || f.st === 'down' || f.st === 'leave' || f.st === 'strike') continue;
      list.push({ kind: 'machine', name: T('g.foe.name.' + f.k), pos: [m.pos[0], m.pos[1] + F().KINDS[f.k].h * 0.55, m.pos[2]], r: Math.max(0.7, F().KINDS[f.k].w * 1.6), act: (gg) => L.calmBegin(gg, m) });
    }
    for (const s of W0.sites.values()) {
      const b = s.beacon; if (!s.known || !b || Math.abs(b[0] - eye[0]) > 6 || Math.abs(b[2] - eye[2]) > 6) continue;
      list.push({ kind: 'beacon', broken: s.st !== 'frei', name: L.nameOf(s), pos: [b[0] + 0.5, b[1] + 0.6, b[2] + 0.5], r: 0.8, act: (gg) => (s.st === 'frei' ? L.fastOpen(gg, s) : L.openPuzzle(gg, s)) });
    }
    return list.length && VR.Ctx && VR.Ctx.pickNear ? VR.Ctx.pickNear(eye, dir, list) : null;
  };
  const NEAR = [];
  L.trade = function (g, m) {
    const S = VR.Shop; if (!S || !S.open) return false;
    return S.open('hangar', { p: { name: T('g.lib.trader') }, name: T('g.lib.trader'), helper: m });
  };
  if (VR.Ctx && VR.Ctx.hooks && Array.isArray(VR.Ctx.hooks.near)) VR.Ctx.hooks.near.push((g, eye, dir) => L.near(g, eye, dir));

  // ---------------------------------------------------------------- the quests' Befreien, Funke's way, the autopilot's pads
  // a village's outpost: the nearest one to the village (the worker's answer, once) — none until it came, so the
  // quests of a day stay the same wherever the player asks
  L.villageOutpost = function (g, vil) {
    const P = vil && (vil.plan || vil); if (!P || !g || !g.pool || !g.pool.direct) return null;
    const key = (vil.id !== undefined ? vil.id : P.x + '_' + P.z) + ':' + g.dim;
    const v = W0.vil.get(key); if (v !== undefined) return v === 'ask' ? undefined : v;
    W0.vil.set(key, 'ask');
    const world = g.world;
    try { g.pool.direct(0, { type: 'locate', dim: g.dim, biome: 'outpost', x: Math.floor(P.x), z: Math.floor(P.z) }, null, (m) => { if (W0.world !== world) return; W0.vil.set(key, m && Array.isArray(m.pos) && Math.hypot(m.pos[0] - P.x, m.pos[2] - P.z) <= 1600 ? L.placeOf(L.knowFar(m.pos)) : null); }); } catch (e) { W0.vil.set(key, null); }
    return undefined;
  };
  const Q = VR.Quests;
  if (Q && Q.placesFor && !Q.placesFor.__lib) {
    const op = Q.placesFor;
    const np = function (vil) {
      const list = op.apply(this, arguments); if (!list || Q.placesNow) return list;
      const g = game(); if (!g || !F() || !F().advOn(g)) return list;
      const o = L.villageOutpost(g, vil);
      if (o === undefined) return null;   // (not yet: like the vistas, no offer until the list is whole)
      if (!o) return list;
      const key = 'out:' + o.id; if (list.some(p => p.id === key)) return list;
      const out = list.concat(Q.places({ outposts: [o] })).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      return out;
    };
    np.__lib = true; Q.placesFor = np;
  }
  if (Q && Array.isArray(Q.journalSections)) Q.journalSections.push(() => {
    const r0 = rec(); if (!r0) return '';
    const fr = L.freedList(r0), open = [];
    for (const s of W0.sites.values()) if (s.known && s.st !== 'frei') open.push(s);
    if (!fr.length && !open.length) return '';
    let h = `<h3>🗼 ${esc(T('g.lib.journal'))}</h3><div class="jdone">`;
    for (const f of fr) h += `<div>✦ ${esc(T('g.lib.journal.freed', { name: L.nameOf(f), day: f.day }))}</div>`;
    for (const s of open.slice(0, 4)) h += `<div>◇ ${esc(T('g.lib.journal.stoer', { name: L.nameOf(s), n: Math.max(0, (s.strays === null ? 0 : s.strays) - s.res) }))}</div>`;
    return h + '</div>';
  });
  const I = VR.Intent;
  if (I && I.addSource) I.addSource((g) => {
    const r0 = rec(); if (!r0 || !F() || !F().advOn(g)) return null;
    return L.freedList(r0).map(f => ({ kind: 'pad', id: 'lib:' + f.id, name: L.nameOf(f), toKey: 'g.ctx.toThing', pos: [f.x + 0.5, f.y + 3, f.z + 0.5], base: f.y, top: f.y + 12, r: 8 }));
  });
  const FU = VR.Funke;
  if (FU && FU.addSource) FU.addSource((g) => {
    if (!F() || !F().advOn(g)) return null;
    const p = g.player.pos; let best = null, bd = 900;
    for (const s of W0.sites.values()) { if (s.st === 'frei') continue; const d = Math.hypot(s.x - p[0], s.z - p[2]); if (d < bd && d > 30) { bd = d; best = s; } }
    return best ? [{ pos: [best.x + 0.5, best.y + 4, best.z + 0.5], name: T('g.lib.site', { name: L.nameOf(best) }), kind: 'outpost' }] : null;
  });

  // ---------------------------------------------------------------- the FX in the translucent pass: the beam, the rings
  const FX_VS = `
layout(location=0) in vec3 a_pos;
layout(location=1) in vec4 a_col;
uniform mat4 u_viewProj;
uniform vec3 u_off;
uniform vec3 u_scale;
out vec4 v_col;
void main() { v_col = a_col; gl_Position = u_viewProj * vec4(a_pos * u_scale + u_off, 1.0); }`;
  const FX_FS = `
uniform vec4 u_tint;
in vec4 v_col;
out vec4 o;
void main() { float a = v_col.a * u_tint.a; o = vec4(v_col.rgb * u_tint.rgb * a, a); }`;
  const GX = { gl: null, p: null, fail: false, geo: {} };
  function fxProgram(gl) {
    if (GX.gl !== gl) { GX.gl = gl; GX.p = null; GX.fail = false; GX.geo = {}; }
    if (GX.p || GX.fail || !VR.GL || !VR.GL.program) return GX.p;
    try { GX.p = VR.GL.program(FX_VS, FX_FS, 'liberate'); } catch (e) { GX.fail = true; console.warn('liberate fx', e); }
    return GX.p;
  }
  function upload(gl, arr) {
    const vao = gl.createVertexArray(), vbo = gl.createBuffer();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 28, 12);
    gl.bindVertexArray(null);
    return { vao, n: arr.length / 7 };
  }
  // a unit ring (radius 1) in the xz plane, w its relative half width, soft at both edges; segments in angle order
  function ringGeo(gl, w, segs) {
    const key = 'r' + w + ':' + segs; if (GX.geo[key]) return GX.geo[key];
    const A = [], v = (a, r, al) => A.push(Math.cos(a) * r, 0, Math.sin(a) * r, 1, 1, 1, al);
    for (let i = 0; i < segs; i++) {
      const a0 = i / segs * TAU, a1 = (i + 1) / segs * TAU;
      for (const [r0, al0, r1, al1] of [[1 - w, 0, 1, 1], [1, 1, 1 + w, 0]]) { v(a0, r0, al0); v(a0, r1, al1); v(a1, r1, al1); v(a0, r0, al0); v(a1, r1, al1); v(a1, r0, al0); }
    }
    return (GX.geo[key] = upload(gl, A));
  }
  // a beam: three crossed quads (unit width and height), bright at the foot and in the middle, soft at the edges and the top
  function beamGeo(gl) {
    if (GX.geo.beam) return GX.geo.beam;
    const A = [], v = (x, y, z, al) => A.push(x, y, z, 1, 1, 1, al);
    for (let k = 0; k < 3; k++) {
      const a = k * Math.PI / 3, cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5;
      for (const [x0, z0, a0, x1, z1, a1] of [[-cx, -cz, 0, 0, 0, 1], [0, 0, 1, cx, cz, 0]]) { v(x0, 0, z0, a0); v(x1, 0, z1, a1); v(x1, 1, z1, 0); v(x0, 0, z0, a0); v(x1, 1, z1, 0); v(x0, 1, z0, 0); }
    }
    return (GX.geo.beam = upload(gl, A));
  }
  const OFF = [0, 0, 0];
  function drawGeo(gl, p, geo, ox, oy, oz, sx, sy, sz, r, g2, b, a, first, count) {
    gl.uniform3f(p.u.u_off, ox, oy, oz); gl.uniform3f(p.u.u_scale, sx, sy, sz); gl.uniform4f(p.u.u_tint, r, g2, b, a);
    gl.bindVertexArray(geo.vao); gl.drawArrays(gl.TRIANGLES, first || 0, count === undefined ? geo.n : count);
    L.cost.fx++;
  }
  L.drawFx = function (En, r, E, cam) {
    const g = En.game; if (!F() || !F().on(g) || !r.viewProj) return;
    const t0 = now(), p0 = g.player.pos, time = g.time || 0;
    // what is there to draw: a disturbed or freed beacon near, the ring, the moment, a Kranarm's warning
    let any = !!L.moment || !!L.ringSite;
    if (!any) for (const s of W0.sites.values()) if (s.known && s.beacon && Math.abs(s.x - p0[0]) < 200 && Math.abs(s.z - p0[2]) < 200) { any = true; break; }
    let crane = null; if (En.mobs) for (const m of En.mobs) if (m.foe && m.foe.k === 'crane' && (m.foe.st === 'tele' || m.foe.st === 'strike')) { crane = m; any = true; break; }
    if (!any) return;
    const gl = r.gl, p = fxProgram(gl); if (!p) return;
    gl.useProgram(p.p); gl.uniformMatrix4fv(p.u.u_viewProj, false, r.viewProj);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    const beam = beamGeo(gl), thick = ringGeo(gl, 0.05, 96), thin = ringGeo(gl, 0.03, 128);
    for (const s of W0.sites.values()) {
      const b = s.beacon; if (!s.known || !b) continue;
      const dx = b[0] + 0.5 - cam.x, dz = b[2] + 0.5 - cam.z; if (dx * dx + dz * dz > 220 * 220) continue;
      const free = s.st === 'frei', M = L.moment && L.moment.s === s ? L.moment : null;
      if (free || M) {
        const k = M ? clamp((M.t - 0.6) / 0.4, 0, 1) : 1, pulse = 0.85 + 0.15 * Math.sin(time * 2.2);
        if (k > 0) { drawGeo(gl, p, beam, dx, b[1] + 0.8 - cam.y, dz, 1.6, 48 * k, 1.6, 0.25, 0.85, 1, 0.55 * pulse); drawGeo(gl, p, beam, dx, b[1] + 0.8 - cam.y, dz, 0.5, 60 * k, 0.5, 0.6, 1, 1, 0.9 * pulse); }
      } else {   // a disturbed beacon: a short red-violet flicker of a beam
        const fl = 0.35 + 0.35 * Math.max(0, Math.sin(time * 7.3) * Math.sin(time * 3.1 + 1));
        drawGeo(gl, p, beam, dx, b[1] + 0.8 - cam.y, dz, 1.1, 14, 1.1, 1, 0.25, 0.8, 0.45 * fl);
      }
      // the light ring sweeping over the land
      if (M && M.t >= 0.75 && M.t < 4.6) {
        const u = (M.t - 0.75) / 3.85, R = 2 + 128 * (1 - Math.pow(1 - u, 2.2)), fade = 1 - u;
        drawGeo(gl, p, thin, dx, b[1] + 0.6 - cam.y, dz, R, 1, R, 0.35, 1, 1, 1.4 * fade);
        drawGeo(gl, p, thick, dx, b[1] + 0.4 - cam.y, dz, R * 0.985, 1, R * 0.985, 0.2, 0.7, 1, 0.5 * fade);
      }
    }
    // the capture ring on the ground: dim all round, bright as far as it is filled
    const RS = L.ringSite;
    if (RS && RS.ringObj && RS.beacon) {
      const b = RS.beacon, dx = b[0] + 0.5 - cam.x, dz = b[2] + 0.5 - cam.z, oy = b[1] - 0.85 - cam.y, segs = 96, k = Math.floor(RS.ringObj.p * segs);
      drawGeo(gl, p, thick, dx, oy, dz, L.RING_R, 1, L.RING_R, 0.3, 0.8, 1, 0.35);
      if (k > 0) drawGeo(gl, p, thick, dx, oy + 0.02, dz, L.RING_R, 1, L.RING_R, 0.5, 1, 1, 1.3, 0, k * 12);
    }
    // the Kranarm's warning: a red-violet ring under the player
    if (crane) { const f = crane.foe, sc = 1.8 * (f.st === 'tele' ? 0.6 + 0.4 * f.flare : 1); drawGeo(gl, p, thick, f.lock[0] - cam.x, f.lock[1] + 0.06 - cam.y, f.lock[2] - cam.z, sc, 1, sc, 1, 0.25, 0.85, 1.2); }
    gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE); gl.bindVertexArray(null);
    L.cost.fxMs += now() - t0;
    void OFF; void E;
  };
  // the translucent pass's hook (game.js calls entities.drawTranslucent when it is there)
  if (VR.Entities && VR.Entities.prototype) {
    const prev = VR.Entities.prototype.drawTranslucent;
    VR.Entities.prototype.drawTranslucent = function (r, E, cam) { if (prev) prev.call(this, r, E, cam); try { L.drawFx(this, r, E, cam); } catch (e) { if (!L.warned) { L.warned = true; console.warn('liberate fx', e); } } };
  }

  // ---------------------------------------------------------------- the look (injected once)
  let cssDone = false;
  function css() {
    if (cssDone || typeof document === 'undefined' || !document.head) return; cssDone = true;
    const s = document.createElement('style'); s.id = 'libcss'; s.textContent = CSS; document.head.appendChild(s);
  }
  const CSS = `
#libring { position: absolute; left: 50%; top: 64px; transform: translateX(-50%); width: min(360px, 70vw); pointer-events: none; text-align: center; filter: drop-shadow(0 2px 6px rgba(0,0,0,.6)); }
#libring .bar { height: 10px; border-radius: 6px; background: rgba(8, 14, 30, .7); border: 1px solid rgba(110, 240, 255, .5); overflow: hidden; }
#libring .bar i { display: block; height: 100%; background: linear-gradient(90deg, #4fe7ff, #b4fbff); box-shadow: 0 0 12px rgba(80, 230, 255, .9); transition: width .3s; }
#libring .tx { margin-top: 5px; font: 700 15px/1.2 var(--font, sans-serif); color: #dffcff; text-shadow: 0 1px 3px #000; }
#libring.out .tx { color: #ffd2f4; }
#libring.out .bar i { background: linear-gradient(90deg, #ff5fd5, #ffb5ef); box-shadow: none; }
#libcalm { position: absolute; left: 50%; top: 50%; width: 190px; height: 190px; margin: -95px 0 0 -95px; z-index: 31; pointer-events: none; display: none; filter: drop-shadow(0 0 10px rgba(0,0,0,.5)); }
#libcalm svg { width: 100%; height: 100%; overflow: visible; }
#libcalm .bg { fill: none; stroke: rgba(10, 16, 34, .72); stroke-width: 14; }
#libcalm .arc { fill: none; stroke: #63ffb0; stroke-width: 12; stroke-linecap: round; filter: drop-shadow(0 0 6px rgba(80, 255, 170, .9)); }
#libcalm .nd { stroke: #fff6c8; stroke-width: 5; stroke-linecap: round; filter: drop-shadow(0 0 5px rgba(255, 240, 160, .9)); }
#libcalm .hub { fill: #fff6c8; }
#libcalm.hot .arc { stroke: #b6ffd9; stroke-width: 15; }
#libcalm.miss .bg { stroke: rgba(120, 20, 70, .8); }
#libcalm .tx { position: absolute; left: 50%; top: 100%; transform: translateX(-50%); margin-top: 8px; white-space: nowrap; font: 700 16px/1.2 var(--font, sans-serif); color: #eafff4; text-shadow: 0 1px 3px #000; }
#lichtleiter, #libfast { align-items: center; justify-content: center; background: radial-gradient(ellipse at 50% 45%, rgba(10, 30, 50, .45), rgba(3, 6, 14, .75)); }
.llcard { width: min(560px, 94vw); }
.llcard .llhead { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
.llcard h2 { margin: 0; font-size: 24px; color: #bff8ff; text-shadow: 0 0 14px rgba(80, 230, 255, .45); }
.llgrid { display: grid; grid-template-columns: 34px repeat(var(--n), 1fr) 34px; gap: 6px; margin: 14px auto 6px; max-width: 470px; align-items: center; }
.llgrid .lltile { aspect-ratio: 1; padding: 0; border: 0; background: none; cursor: pointer; transition: transform .15s; }
.llgrid .lltile:hover { transform: scale(1.04); }
.llgrid .lltile svg { width: 100%; height: 100%; display: block; }
.llgrid .lltile .bg { fill: #141c30; stroke: #2a3754; stroke-width: 3; }
.llgrid .lltile .bg.lk { stroke: #63ffb0; }
.llgrid .llside { display: grid; place-items: center; }
.llgrid .cry { width: 26px; height: 32px; background: linear-gradient(160deg, #e9fdff, #5fe3ff 55%, #1b7fbf); clip-path: polygon(50% 0, 100% 35%, 80% 100%, 20% 100%, 0 35%); filter: drop-shadow(0 0 8px #6ff0ff); }
.llgrid .lamp { width: 26px; height: 26px; border-radius: 50%; background: #2b3247; border: 3px solid #56627e; }
.llgrid .lamp.on { background: radial-gradient(circle, #ffffff, #8ff8ff 50%, #2fb8ff); border-color: #c8fbff; box-shadow: 0 0 22px 6px rgba(110, 240, 255, .85); }
.llgrid.solved .lltile .bg { stroke: #6ff0ff; }
.llcard .lldone { margin-top: 8px; text-align: center; font: 800 20px/1.2 var(--display, sans-serif); color: #c9fdff; text-shadow: 0 0 14px rgba(80, 230, 255, .8); }
.llcard .lfgo { display: block; width: 100%; margin: 8px 0; text-align: left; }
#libban { position: absolute; left: 50%; top: 30%; width: min(820px, 94vw); transform: translate(-50%, -50%); z-index: 42; pointer-events: none; text-align: center; display: none; }
#libban.on { display: block; animation: libIn .7s cubic-bezier(.2, 1.4, .35, 1) both; }
#libban.off { display: block; animation: libOut .85s ease-in both; }
@keyframes libIn { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.45); } 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
@keyframes libOut { 0% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, -64%) scale(1.06); } }
#libban .rays { position: absolute; left: 50%; top: 50%; width: 700px; height: 700px; margin: -350px 0 0 -350px; border-radius: 50%; background: repeating-conic-gradient(from 0deg, rgba(120, 245, 255, .28) 0deg 6deg, rgba(120, 245, 255, 0) 6deg 15deg); -webkit-mask: radial-gradient(circle, #000 12%, rgba(0,0,0,.5) 40%, transparent 66%); mask: radial-gradient(circle, #000 12%, rgba(0,0,0,.5) 40%, transparent 66%); animation: libRays 4.6s ease-out both; }
@keyframes libRays { 0% { opacity: 0; transform: scale(.3) rotate(0); } 15% { opacity: 1; } 100% { opacity: 0; transform: scale(1.2) rotate(40deg); } }
#libban .glow { position: absolute; left: 50%; top: 50%; width: 620px; height: 260px; margin: -130px 0 0 -310px; border-radius: 50%; background: radial-gradient(ellipse at center, rgba(90, 235, 255, .6), rgba(60, 160, 255, .18) 45%, rgba(60, 160, 255, 0) 70%); }
#libban .kick { position: relative; font: 800 17px/1 var(--display, sans-serif); letter-spacing: 8px; color: #d4fdff; text-shadow: 0 0 14px rgba(90, 235, 255, .95), 0 1px 2px #000; }
#libban .big { position: relative; margin: 8px 0 10px; font: 900 clamp(38px, 6.4vw, 80px)/1.05 var(--display, sans-serif); background: linear-gradient(180deg, #ffffff 0%, #c9fbff 45%, #4fd9ff 100%); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 0 16px rgba(70, 220, 255, .85)) drop-shadow(0 4px 0 rgba(0, 40, 70, .6)); }
#libban .sub { position: relative; font: 700 22px/1.25 var(--font, sans-serif); color: #fff6d8; text-shadow: 0 2px 8px rgba(0,0,0,.85), 0 0 14px rgba(255, 200, 80, .5); white-space: pre; }
#libbloom { position: absolute; inset: 0; z-index: 30; pointer-events: none; opacity: 0; background: radial-gradient(ellipse at 50% 55%, rgba(170, 250, 255, .75), rgba(60, 200, 255, .25) 45%, rgba(40, 120, 255, 0) 75%); mix-blend-mode: screen; }
#libbloom.on { animation: libBloom 2.6s ease-out; }
@keyframes libBloom { 0% { opacity: 0; } 10% { opacity: 1; } 100% { opacity: 0; } }
#libveil { position: absolute; inset: 0; z-index: 46; pointer-events: none; opacity: 0; background: radial-gradient(ellipse at center, #0b2a3a, #02060c 75%); transition: opacity 1.1s ease-in-out; }
#libveil.on { opacity: 1; }
@media (prefers-reduced-motion: reduce) { #libban .rays { display: none; } #libbloom.on { animation-duration: .01s; } }
`;
})(VR);
