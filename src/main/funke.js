// ============================================================================
// Funke — die Begleitdrohne (e-funke, wave 4; plan docs/superpowers/plans/2026-10-22-e-funke.md; erlebnis §3,
// abenteuer §9–§11). A small glowing drone of our own (a light variant of the hover drone: a round white shell, a warm
// orange belly, one big cyan eye that blinks, a stubby antenna with a glowing tip) floats at the player's shoulder on a
// soft spring, banks into turns, lifts over blocks, peeks into the view when it talks and sits on the dashboard in a
// ship. It is the game's help and its tour guide:
//   · Wegweiser — a thin ribbon of light toward the current target (a sibling's source: story, quest; e-ctx's intent;
//     the newest waypoint; an unseen vista; the nearest unvisited village; the player's place) for 4 s, with one line;
//     on ask, or when the player seems lost (F.Lost: 90 s of moving without getting nearer to any target or reaching a
//     new place, or walking in circles);
//   · Nächster Wow — one line about something worth seeing soon (F.wowCandidates: the golden hour, the sunset, the
//     night, an aurora night, a shooting star and where, the murmuration at dusk, the cloud rays, the life director's
//     coming slots, the apron's next landing, the lantern festival, an unseen vista) — so nobody misses the best things;
//   · Scan — the chests and ores within 32 blocks (+8 per Spürsinn point) glow through the ground for 8 s;
//   · Foto — a picture from Funke's own spot with the player in it (the photo mode's 2× save);
//   · Hilfe — in Einfach the 🧭 hints and the first-time tips are Funke's lines instead of text boxes.
// A talking budget (F.Budget): one unprompted line per 90 s, none during Bauruhe (20 s after a build action),
// „Funke, Ruhe!" mutes the unprompted ones for 10 minutes. Lines from the tables (g.funke.*), German first; a bubble
// beside the drone; Funke's own blips (no voice files). Switch ⚙ Spiel „Funke" (funke, default on). Cost 🟢: a spring
// and one small model draw (culled when not seen), the 1-Hz brain bounded; F.cost measures it.
// Public: VR.Funke.ask() (e-ctx's last row), mute(), way(), wow(), scan(), photo(), addSource(fn).
// ============================================================================
(function (VR) {
  'use strict';
  const F = VR.Funke = VR.Funke || {};
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  const lang = () => (VR.I18N && VR.I18N.lang) || 'de';
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const wrapA = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

  // ---------------------------------------------------------------- the numbers
  F.GAP = 90;          // s between two unprompted lines (any line restarts the wait)
  F.BAURUHE = 20;      // s of quiet after a build action
  F.MUTE = 600;        // s of „Funke, Ruhe!"
  F.WAY_T = 4;         // s the light line shows
  F.WAY_L = 48;        // m it reaches at most
  F.SCAN_T = 8;        // s the scan's outlines show
  F.SCAN_R = 32;       // blocks the scan reaches (+8 per Spürsinn point)
  F.SCAN_MAX = 256;    // boxes drawn at most (chests first, then the rare, the nearest of each kind)
  F.SCAN_V = 16;       // m/s: the scan's wave
  F.SNAP = 24;         // m: beyond this the drone snaps to its place (a teleport)
  F.LAG = 2.6;         // m it may trail behind its place
  F.ASK_T = 8;         // s: asking again within this goes on to the next trick
  F.KIND_WAIT = { vista: 240, _: 600 };   // s before the same kind is told again unprompted (asked: any time)
  F.SCALE = 0.62;      // the drone's size (≈ 35 cm)
  F.SEAT_SCALE = 0.45; // on the dashboard (run 1: 0.55 filled the middle of the windscreen)
  F.cost = { frames: 0, ms: 0, worst: 0, draws: 0, drawMs: 0, scanMs: 0 };

  // ---------------------------------------------------------------- the talking budget (pure)
  class Budget {
    constructor() { this.last = -Infinity; this.buildT = -Infinity; this.muteT = -Infinity; }
    said(t) { this.last = t; }
    build(t) { this.buildT = t; }
    quiet(t) { return t - this.buildT < F.BAURUHE; }
    mute(t, sec) { this.muteT = t + (sec > 0 ? sec : F.MUTE); }
    unmute() { this.muteT = -Infinity; }
    muted(t) { return t < this.muteT; }
    // may a line be said now: an asked one always; an unprompted one not while muted or building, and 90 s after the last
    can(t, prompted) { if (prompted) return true; if (this.muted(t) || this.quiet(t)) return false; return t - this.last >= F.GAP; }
  }
  F.Budget = Budget;

  // ---------------------------------------------------------------- the lost player (pure; one sample a second)
  // moving (≥ moveMin m/s) for `need` s without getting `gain` m nearer to any target and without entering a new `cell`-m
  // cell → 'lost'; after `after` s of that, a full turn in the last `win` s within `rad` m over ≥ `len` m → 'circle'.
  // After either, quiet for `cool` s.
  class Lost {
    constructor(o) { this.o = Object.assign({ need: 90, cell: 32, gain: 6, moveMin: 0.8, win: 60, turn: TAU * 0.95, rad: 25, len: 50, after: 30, cool: 120 }, o || {}); this.reset(); }
    reset() { this.mt = 0; this.best = new Map(); this.cells = new Set(); this.lt = null; this.lx = 0; this.lz = 0; this.coolT = -Infinity; this.trk = []; }
    step(t, x, z, targets) {
      const o = this.o;
      let dt = 0, d = 0;
      if (this.lt !== null) { dt = clamp(t - this.lt, 0, 5); d = Math.hypot(x - this.lx, z - this.lz); }
      this.lt = t; this.lx = x; this.lz = z;
      let prog = false;
      const key = Math.floor(x / o.cell) + ',' + Math.floor(z / o.cell);
      if (!this.cells.has(key)) { if (this.cells.size) prog = true; this.cells.add(key); if (this.cells.size > 4096) this.cells.clear(); }
      if (targets) for (let i = 0; i < targets.length; i++) {
        const q = targets[i], tx = q[0], tz = q[1], k = Math.round(tx) + ',' + Math.round(tz), dd = Math.hypot(tx - x, tz - z), b = this.best.get(k);
        if (b === undefined) this.best.set(k, dd); else if (dd < b - o.gain) { this.best.set(k, dd); prog = true; }
      }
      const moving = dt > 0 && d / dt >= o.moveMin;
      if (prog) this.mt = 0; else if (moving) this.mt += dt;
      const tr = this.trk; tr.push(t, x, z); while (tr.length > 3 && t - tr[0] > o.win) tr.splice(0, 3);
      if (t < this.coolT) return null;
      if (this.mt >= o.need) { this.fire(t); return 'lost'; }
      if (this.mt >= o.after && this.circling()) { this.fire(t); return 'circle'; }
      return null;
    }
    fire(t) { this.mt = 0; this.coolT = t + this.o.cool; this.trk.length = 0; }
    circling() {
      const r = this.trk, o = this.o, n = r.length / 3; if (n < 10) return false;
      let turn = 0, len = 0, pa = null, cx = 0, cz = 0;
      for (let i = 1; i < n; i++) {
        const dx = r[i * 3 + 1] - r[i * 3 - 2], dz = r[i * 3 + 2] - r[i * 3 - 1], l = Math.hypot(dx, dz);
        len += l; if (l < 0.3) continue;
        const a = Math.atan2(dz, dx); if (pa !== null) turn += wrapA(a - pa); pa = a;
      }
      for (let i = 0; i < n; i++) { cx += r[i * 3 + 1]; cz += r[i * 3 + 2]; }
      cx /= n; cz /= n;
      let rad = 0; for (let i = 0; i < n; i++) rad = Math.max(rad, Math.hypot(r[i * 3 + 1] - cx, r[i * 3 + 2] - cz));
      return Math.abs(turn) >= o.turn && rad <= o.rad && len >= o.len;
    }
  }
  F.Lost = Lost;

  // ---------------------------------------------------------------- the phrases (pure)
  F.dist = function (m, lg) {
    m = Math.max(0, +m || 0);
    if (m < 995) return (m < 20 ? Math.round(m) : Math.round(m / 10) * 10) + ' m';
    const k = m / 1000, s = k < 9.95 ? k.toFixed(1) : String(Math.round(k));
    return ((lg || lang()) === 'de' ? s.replace('.', ',') : s) + ' km';
  };
  F.whenKey = function (eta) {
    if (eta <= 5) return ['g.funke.when.now', null];
    if (eta <= 45) return ['g.funke.when.soon', null];
    if (eta <= 95) return ['g.funke.when.min1', null];
    if (eta <= 150) return ['g.funke.when.min2', null];
    return ['g.funke.when.minN', { n: Math.max(3, Math.round(eta / 60)) }];
  };
  // a compass word for a direction (x, z): north is −z (yaw 0 looks north)
  const DIRS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
  F.dirKey = (x, z) => 'g.funke.dir.' + DIRS[((Math.round(Math.atan2(x, -z) / (Math.PI / 4)) % 8) + 8) % 8];

  // ---------------------------------------------------------------- the lines (the tables' lists, a variant by a counter)
  const WOW_KINDS = ['golden', 'golden_vista', 'sunset', 'night', 'aurora', 'meteor', 'murm', 'rays', 'balloon', 'bells', 'fireworks', 'lanterns', 'skyray', 'convoy', 'musician', 'ship', 'ship_temple', 'festival', 'vista', 'quiet'];
  const HELP_KINDS = ['villager', 'ship', 'chest', 'door', 'bed', 'vista', 'night', 'water', 'photo'];
  const ORE_KINDS = ['chest', 'coal', 'iron', 'copper', 'gold', 'diamond', 'emerald', 'lapis', 'voltite', 'quartz', 'relic', 'crystal', 'ore'];
  F.KEYS = ['g.funke.name', 'g.funke.hello', 'g.funke.way', 'g.funke.lost', 'g.funke.circle', 'g.funke.noway', 'g.funke.home',
    'g.funke.when.now', 'g.funke.when.soon', 'g.funke.when.min1', 'g.funke.when.min2', 'g.funke.when.minN',
    'g.funke.scan.found', 'g.funke.scan.none', 'g.funke.scan.item', 'g.funke.photo.go', 'g.funke.photo.done', 'g.funke.photo.no',
    'g.funke.mute', 'g.funke.unmute', 'g.funke.cmd', 'g.funke.off', 'g.set.funke', 'g.set.funke.tip', 'g.set.funkeQuiet', 'g.set.funkeQuiet.tip']
    .concat(WOW_KINDS.map(k => 'g.funke.wow.' + k), HELP_KINDS.map(k => 'g.funke.help.' + k), ORE_KINDS.map(k => 'g.funke.ore.' + k), DIRS.map(k => 'g.funke.dir.' + k));
  const fill = (s, v) => (v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined ? v[k] : m)) : String(s));
  // the n-th variant of a kind's line ('way', 'wow.golden', 'help.chest' …) with its values
  F.say = function (kind, vars, n) {
    const I = VR.I18N, key = 'g.funke.' + kind; if (!I) return '';
    const L = I.list(key);
    if (L && L.length) return fill(L[((n | 0) % L.length + L.length) % L.length], vars);
    const s = I.t(key, vars); return s === key ? '' : s;
  };

  // ---------------------------------------------------------------- the next wow (pure)
  // the life director's acts worth a word and their weight (A§10: 2 noticeable, 3 remarkable)
  F.LD_W = { balloon: 2, bells: 2, fireworks: 3, lanterns: 2, skyray: 3, convoy: 2, musician: 2 };
  const ISLES = [330, 140];
  // c: {tod, day, seed, wxSeed, tier (0 Very Low … 4 Ultra), sky3 (0…2), sw: {wildBirds, wildRays}, pos, heart, place,
  // ld: {seed, clock, ctx} | null, pads: [{key, seed, x, z, clock, cache}] | null, vistas: [{id, x, y, z, lm, seen}],
  // villages: [{name, x, z, fest}], wet, dim} → [{id, kind, w, eta (s), vars, src, pos?}]
  F.wowCandidates = function (c) {
    const out = []; if (!c || (c.dim && c.dim !== 'overworld')) return out;
    const tod = (((+c.tod || 0) % 24000) + 24000) % 24000, day = c.day | 0, P = c.pos || [0, 0, 0];
    const until = (tick) => { let d = tick - tod; if (d < 0) d += 24000; return d / 20; };
    const dayOf = (tick) => day + (tick < tod ? 1 : 0);
    const add = (id, kind, w, eta, vars, src, pos) => out.push({ id, kind, w, eta: Math.max(0, eta), vars: vars || {}, src: src || 'hour', pos: pos || null });
    const inWin = (a, b) => tod >= a && tod < b;
    // the hour: the golden hour (the sun 7.4° high at 10800; from 10400), the sunset (12000), the night's stars (13800)
    if (!c.wet) {
      add('golden:' + dayOf(10400), 'golden', 3, inWin(10400, 11200) ? 0 : until(10400));
      add('sunset:' + dayOf(12000), 'sunset', 3, inWin(11850, 12250) ? 0 : until(12000));
      add('night:' + dayOf(13800), 'night', 2, inWin(13800, 14600) ? 0 : until(13800));
    }
    // an aurora night (t-sky3, Himmel 2): it rises once the sun is ~7° under the horizon and holds till the dawn
    const S3 = VR.Sky3;
    if (S3 && (c.sky3 | 0) >= 2 && !c.wet) {
      // (the night of day n runs from its sunset at tick 12000 to the dawn: tonight is the night of today)
      if (S3.auroraNight(c.wxSeed, day) > 0 && tod < 23000) add('aurora:' + day, 'aurora', 3, tod >= 13200 ? 0 : until(13200));
    }
    // the next shooting star (t-sky3, from Himmel 1, a dark sky): when and where
    if (S3 && (c.sky3 | 0) >= 1 && !c.wet && (tod >= 13800 && tod < 22800)) {
      const A = day * 24000 + tod, m = S3.meteorNext(c.wxSeed, A, 3);
      if (m && m.A >= A && (m.A - A) / 20 <= 300) add('meteor:' + m.k, 'meteor', 2, (m.A - A) / 20, { dirKey: F.dirKey(m.from[0], m.from[2]) }, 'sky');
    }
    // the murmuration at dusk (t-wild: from Balanced, the birds' switch, not in the rain)
    const W = VR.Wild;
    if (W && !c.wet && c.sw && c.sw.wildBirds !== false && W.CAPS.murm[clamp(c.tier | 0, 0, 4)] > 0) {
      add('murm:' + dayOf(10400), 'murm', 3, inWin(10400, 13400) ? 0 : until(10400), null, 'wild');
    }
    // the cloud rays between the isles (t-wild: from Balanced, their switch) — near the isles, any hour
    if (W && c.heart !== false && c.sw && c.sw.wildRays !== false && W.CAPS.ray[clamp(c.tier | 0, 0, 4)] > 0 && Math.hypot(P[0] - ISLES[0], P[2] - ISLES[1]) < 420) {
      add('rays:' + day, 'rays', 3, 0, null, 'wild', [ISLES[0], 115, ISLES[1]]);
    }
    // the life director's coming slots (its pick at each slot with the place and the hour of now)
    const LD = VR.LifeDirector;
    if (LD && c.ld && c.ld.ctx && LD.slotAt) {
      const s = c.ld.seed, clk = c.ld.clock, k0 = LD.slotAt(s, clk) + 1;
      for (let k = k0; k < k0 + 12; k++) {
        const eta = LD.slotTime(s, k) - clk; if (eta > 300) break;
        const kind = c.ld.pick ? c.ld.pick(k) : LD.pick(s, k, c.ld.ctx);   // (f-flow: the director's forecast — its rotation — when it is there)
        if (kind && F.LD_W[kind]) add('ld:' + kind + ':' + k, kind, F.LD_W[kind], eta, null, 'ld');
      }
    }
    // the pads' next landing (PadLife; within 600 m — at the pad itself it is remarkable)
    const PL = VR.PadLife;
    if (PL && c.pads) for (const pad of c.pads) {
      const d = Math.hypot(pad.x - P[0], pad.z - P[2]); if (d > 600) continue;
      const cache = pad.cache || (pad.cache = { seed: pad.seed, n: 0, T: PL.t0(pad.seed) });
      const v = PL.visitAt(pad.seed, pad.clock, cache);
      const n = v.T > pad.clock ? v.n : v.n + 1, T0 = v.T > pad.clock ? v.T : v.T + PL.stay(pad.seed, v.n) + PL.GAP;
      add('ship:' + pad.key + ':' + n, 'ship', d < 220 ? 3 : 2, T0 - pad.clock, { temple: pad.key === 'apron' }, 'pad', [pad.x, 0, pad.z]);
    }
    // the lantern festival tonight in a village near (festival.js: dusk 11200 to 14800)
    if (c.villages) for (const v of c.villages) {
      if (!v || !v.fest || Math.hypot(v.x - P[0], v.z - P[2]) > 320 || !(tod < 14800 || tod >= 22000)) continue;
      add('fest:' + v.name + ':' + day, 'festival', 3, inWin(11200, 14800) ? 0 : until(11200), { name: v.name }, 'village', [v.x, 0, v.z]);
    }
    // an unseen vista near (its wow moment waits there)
    if (c.vistas) for (const v of c.vistas) {
      if (!v || v.seen) continue;
      const d = Math.hypot(v.x - P[0], v.z - P[2]); if (d > 300 || d < 4) continue;
      add('vista:' + v.id, 'vista', 3, 0, { lm: v.lm, d }, 'vista', [v.x + 0.5, v.y, v.z + 0.5]);
    }
    return out;
  };
  // the one to tell: unprompted (auto) only the remarkable (w ≥ 3) now or 15–180 s ahead; asked the best within 5 min;
  // never one already told (said: a Set of ids)
  F.pickWow = function (cands, said, mode) {
    let best = null, bs = 0;
    for (const c of cands || []) {
      if (!c || (said && said.has(c.id))) continue;
      if (mode === 'auto') { if (c.w < 3 || !(c.eta <= 2 || (c.eta >= 15 && c.eta <= 180))) continue; }
      else if (c.eta > 300) continue;
      const tf = c.eta <= 2 ? 0.9 : c.eta <= 120 ? 1 : Math.max(0.2, 1 - (c.eta - 120) / 300), s = c.w * tf;
      if (s > bs || (best && s === bs && c.eta < best.eta)) { bs = s; best = c; }
    }
    return best;
  };

  // ---------------------------------------------------------------- the spring (pure): critically damped, sub-stepped
  F.springState = (p) => ({ p: [p[0], p[1], p[2]], v: [0, 0, 0], snapped: false });
  F.spring = function (S, tgt, dt, w, maxLag) {
    S.snapped = false;
    const ex = tgt[0] - S.p[0], ey = tgt[1] - S.p[1], ez = tgt[2] - S.p[2];
    if (!(Math.hypot(ex, ey, ez) <= F.SNAP)) { S.p[0] = tgt[0]; S.p[1] = tgt[1]; S.p[2] = tgt[2]; S.v[0] = S.v[1] = S.v[2] = 0; S.snapped = true; return S; }
    const n = Math.max(1, Math.ceil(dt * 60 - 1e-9)), h = dt / n;
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { const a = w * w * (tgt[k] - S.p[k]) - 2 * w * S.v[k]; S.v[k] += a * h; S.p[k] += S.v[k] * h; }
    if (maxLag > 0) {
      const dx = S.p[0] - tgt[0], dy = S.p[1] - tgt[1], dz = S.p[2] - tgt[2], e = Math.hypot(dx, dy, dz);
      if (e > maxLag) { const s = maxLag / e; S.p[0] = tgt[0] + dx * s; S.p[1] = tgt[1] + dy * s; S.p[2] = tgt[2] + dz * s; }
    }
    return S;
  };

  // ---------------------------------------------------------------- the scan (pure): what glows, and the search
  F.SCAN_KINDS = [''].concat(ORE_KINDS);
  F.SCAN_COL = { chest: [1, 0.66, 0.18], coal: [0.42, 0.44, 0.55], iron: [0.95, 0.62, 0.45], copper: [1, 0.45, 0.2], gold: [1, 0.82, 0.12], diamond: [0.25, 1, 1], emerald: [0.22, 1, 0.42], lapis: [0.3, 0.45, 1], voltite: [1, 0.3, 0.3], quartz: [1, 1, 1], relic: [0.8, 0.45, 0.95], crystal: [0.8, 0.5, 1], ore: [0.85, 0.85, 0.85] };
  F.scanMarks = function (R) {
    if (R && R._funkeMarks) return R._funkeMarks;
    const mark = new Uint8Array(R.T.type.length), K = F.SCAN_KINDS;
    for (const t of R.types) {
      if (!t) continue;
      const o = t.o || {};
      let k = 0;
      if (o.ui === 'chest' || o.ui === 'voidchest') k = 1;
      else { let key = o.oreOf || (t.name === 'relic_ore' ? 'relic' : null); if (!key && /_crystal_cluster$/.test(t.name)) key = 'crystal'; if (key) { k = K.indexOf(key); if (k < 2) k = K.indexOf('ore'); } }
      if (!k) continue;
      const b = t.base | 0, n = t.nstates | 0 || 1;
      for (let s = b; s < b + n && s < mark.length; s++) mark[s] = k;
    }
    return (R._funkeMarks = { mark, CHEST: 1 });
  };
  const GRID = { g: null, st: null, rk: null };   // (the finds' grid and stack, kept between scans)
  class Scan {
    constructor(world, M, center, r) {
      this.w = world; this.M = M; this.r = r; this.c = [Math.floor(center[0]), Math.floor(center[1]), Math.floor(center[2])];
      const c = this.c, cx0 = c[0] >> 4, cz0 = c[2] >> 4, R = Math.ceil(r / 16) + 1, list = [];
      for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
        const cx = cx0 + dx, cz = cz0 + dz, nx = clamp(c[0], cx * 16, cx * 16 + 15), nz = clamp(c[2], cz * 16, cz * 16 + 15), d2 = (nx - c[0]) ** 2 + (nz - c[2]) ** 2;
        if (d2 <= r * r) list.push([d2, cx, cz]);
      }
      list.sort((a, b) => a[0] - b[0]);
      this.cols = list; this.i = 0; this.found = []; this.done = !list.length; this.cells = 0;
    }
    // up to maxCols columns (and stop after maxMs) → done
    step(maxCols, maxMs) {
      const t0 = maxMs ? now() : 0, mark = this.M.mark, c = this.c, r2 = this.r * this.r;
      let n = 0;
      while (this.i < this.cols.length && n < (maxCols || 4)) {
        const q = this.cols[this.i++], cx = q[1], cz = q[2]; n++;
        const col = this.w.col(cx, cz); if (!col || !col.blocks) continue;
        const B = col.blocks, H = col.H || (B.length >> 8), y0 = Math.max(0, c[1] - this.r), y1 = Math.min(H - 1, c[1] + this.r);
        for (let y = y0; y <= y1; y++) {
          const dy = y - c[1], base = y << 8;
          for (let i = 0; i < 256; i++) {
            const s = B[base | i]; if (!s) continue;
            const k = mark[s]; if (!k) continue;
            const x = cx * 16 + (i & 15), z = cz * 16 + (i >> 4), d2 = (x - c[0]) ** 2 + dy * dy + (z - c[2]) ** 2;
            if (d2 <= r2 && this.found.length < 4096) this.found.push({ x, y, z, k, d2 });
          }
        }
        this.cells += (y1 - y0 + 1) * 256;
        if (maxMs && now() - t0 > maxMs) break;
      }
      if (this.i >= this.cols.length) this.done = true;
      return this.done;
    }
    // the counts of all found (blocks), the finds (veins: blocks of a kind that touch count once — a seam of 170 coal is
    // one find), the boxes to draw: chests first, then the rare kinds, the nearest of each kind, at most SCAN_MAX
    result() {
      const counts = {}, veins = {}, K = F.SCAN_KINDS, c = this.c, r = Math.ceil(this.r) + 1, S = 2 * r + 1, SS = S * S, N = SS * S, found = this.found;
      // the finds on a grid of the scan's box (one byte a cell, kept between scans; 4096 blocks ≈ 1 ms)
      if (!GRID.g || GRID.g.length < N) GRID.g = new Uint8Array(N);
      const G = GRID.g, st = GRID.st || (GRID.st = new Int32Array(4096)), ix = (x, y, z) => (x - c[0] + r) * SS + (y - c[1] + r) * S + (z - c[2] + r);
      G.fill(0, 0, N);
      for (const f of found) { const nm = K[f.k]; counts[nm] = (counts[nm] || 0) + 1; G[ix(f.x, f.y, f.z)] = f.k; }
      for (const f of found) {
        const i0 = ix(f.x, f.y, f.z), k = G[i0]; if (!k) continue;   // (already part of a find)
        veins[K[k]] = (veins[K[k]] || 0) + 1; G[i0] = 0;
        if (k === 1) continue;   // (a chest is a find of its own)
        let sp = 0; st[sp++] = i0;
        while (sp) {
          const i = st[--sp];
          if (G[i + SS] === k) { G[i + SS] = 0; st[sp++] = i + SS; } if (G[i - SS] === k) { G[i - SS] = 0; st[sp++] = i - SS; }
          if (G[i + S] === k) { G[i + S] = 0; st[sp++] = i + S; } if (G[i - S] === k) { G[i - S] = 0; st[sp++] = i - S; }
          if (G[i + 1] === k) { G[i + 1] = 0; st[sp++] = i + 1; } if (G[i - 1] === k) { G[i - 1] = 0; st[sp++] = i - 1; }
        }
      }
      const RK = GRID.rk || (GRID.rk = K.map(n => { const i = F.SCAN_RANK.indexOf(n); return i < 0 ? 99 : i; }));
      const list = found.slice().sort((a, b) => (RK[a.k] - RK[b.k]) || (a.d2 - b.d2)).slice(0, F.SCAN_MAX)
        .map(f => ({ x: f.x, y: f.y, z: f.z, k: f.k, kind: K[f.k], d2: f.d2 }));
      return { counts, veins, list };
    }
  }
  F.Scan = Scan;
  // the kinds from the rarest down (the line names the first four, the boxes go in this order)
  F.SCAN_RANK = ['chest', 'relic', 'diamond', 'emerald', 'crystal', 'gold', 'voltite', 'lapis', 'quartz', 'iron', 'copper', 'coal', 'ore'];
  F.scanOrder = (counts) => Object.keys(counts).filter(k => counts[k] > 0).sort((a, b) => { const i = F.SCAN_RANK.indexOf(a), j = F.SCAN_RANK.indexOf(b); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });

  // ---------------------------------------------------------------- the drone (our own: a light variant of the hover drone)
  const MM = VR.VOXMODELS, Grid = VR.VoxGrid;
  if (MM && Grid) {
    const part = (sx, sy, sz, pv, fn) => { const gr = new Grid(sx, sy, sz, pv[0], pv[1], pv[2]); fn(gr); return { grid: gr, pivot: [0, 0, 0] }; };
    MM.funke = () => {
      const W = 0xf4f7fb, W2 = 0xdfe7ef, O = 0xff7c2c, O2 = 0xe8641c, C = 0x46f0ff, C2 = 0xb8fbff, C3 = 0x23b9d6, D = 0x18232e, G = 0x8c98a6, M2 = 0xb4bfca;
      return {
        h: 0.5, w: 0.28, fly: true, radius: 0.7, gait: 'hover',
        parts: {
          // the shell: white over a warm orange belly band, a dark visor round the eye at the front (−z)
          body: part(9, 8, 9, [4.5, 4, 4.5], (g) => {
            g.ell(4.5, 4, 4.5, 4.45, 3.95, 4.45, (x, y, z) => (y <= 1 ? O : y === 2 ? ((x + z) % 3 ? O : O2) : y >= 6 ? W : W2), { shade: 0.05 });
            for (let y = 2; y <= 6; y++) for (let x = 1; x <= 7; x++) for (let z = 0; z <= 2; z++) if (g.get(x, y, z) && Math.hypot(x - 4, (y - 4) * 1.2) <= 2.6 && z <= 1) g.set(x, y, z, D);
            g.set(4, 7, 4, G); g.set(3, 7, 4, M2); g.set(5, 7, 4, M2);
          }),
          // the eye: a 3 × 3 cyan light, a bright corner (the glint)
          eye: part(3, 3, 1, [1.5, 1.5, 1], (g) => { g.box(0, 0, 0, 2, 2, 0, (x, y) => ((x === 1 || y === 1) ? C : C3), { emis: 1 }); g.set(2, 2, 0, C2, 1); }),
          // the stubby antenna with its glowing tip
          antenna: part(1, 3, 1, [0.5, 0, 0.5], (g) => { g.box(0, 0, 0, 0, 1, 0, G); g.set(0, 2, 0, C, 1); }),
          rotor_l: part(5, 1, 5, [2.5, 0.5, 2.5], (g) => { g.box(0, 0, 2, 4, 0, 2, M2); g.box(2, 0, 0, 2, 0, 4, M2); }),
          rotor_r: part(5, 1, 5, [2.5, 0.5, 2.5], (g) => { g.box(0, 0, 2, 4, 0, 2, M2); g.box(2, 0, 0, 2, 0, 4, M2); }),
          // the side pods the rotors sit on, and the glow ring underneath
          pods: part(13, 2, 3, [6.5, 1, 1.5], (g) => { g.box(0, 0, 0, 2, 1, 2, W2); g.box(10, 0, 0, 12, 1, 2, W2); g.box(3, 1, 1, 9, 1, 1, G); }),
          glow: part(5, 1, 5, [2.5, 0.5, 2.5], (g) => { g.ell(2.5, 0.5, 2.5, 2.5, 0.6, 2.5, (x, y, z) => (Math.hypot(x - 2, z - 2) >= 1 ? C : null), { emis: 1 }); }),
        },
        layout: { body: [0, 0, 0], eye: [0, 0.4, -3.6], antenna: [1.2, 3.7, 1], rotor_l: [-5.5, 1.4, 0], rotor_r: [5.5, 1.4, 0], pods: [0, 0.2, 0], glow: [0, -4, 0] },
      };
    };
  }

  // ---------------------------------------------------------------- the light line and the scan on the GPU (our own small program)
  const FX_VS = `
layout(location=0) in vec3 a_pos;
layout(location=1) in vec4 a_col;
layout(location=2) in float a_d;
layout(location=3) in vec4 a_dir;
uniform mat4 u_viewProj;
uniform vec3 u_offset;
uniform float u_scale;
uniform float u_width;
out vec4 v_col;
out float v_d;
void main() {
  vec3 p = a_pos * u_scale + u_offset;
  if (a_dir.w != 0.0) { vec3 s = cross(a_dir.xyz, p); float l = length(s); if (l > 1e-5) p += s / l * a_dir.w * u_width; }
  v_col = a_col; v_d = a_d;
  gl_Position = u_viewProj * vec4(p, 1.0);
}`;
  const FX_FS = `
uniform vec4 u_tint;
uniform vec4 u_wave;
in vec4 v_col;
in float v_d;
out vec4 o;
void main() {
  float a = v_col.a * u_tint.a;
  vec3 c = v_col.rgb * u_tint.rgb;
  if (u_wave.y > 0.5 && u_wave.y < 1.5) {
    float q = u_wave.x - v_d;
    a *= clamp(q * 0.6, 0.0, 1.0);
    c *= 1.0 + 1.8 * exp(-q * q * 0.35);
  } else if (u_wave.y > 1.5) {
    float ph = fract((v_d - u_wave.x) / u_wave.z);
    float dash = smoothstep(0.0, 0.12, ph) * (1.0 - smoothstep(0.5, 0.62, ph));
    a *= mix(0.32, 1.0, dash) * (1.0 - smoothstep(u_wave.w * 0.7, u_wave.w, v_d)) * smoothstep(0.0, 0.9, v_d);
  }
  if (a < 0.004) discard;
  o = vec4(c * a, a);
}`;
  const STRIDE = 12;   // floats a vertex: pos 3, colour 4, d 1, dir 4
  const GX = {};       // the program and the buffers (per GL context; built on first use)
  function fxProgram(r) {
    if (GX.gl !== r.gl) { GX.gl = r.gl; GX.p = null; GX.way = null; GX.scan = null; GX.ring = null; GX.fail = false; }
    if (GX.p || GX.fail) return GX.p;
    try { GX.p = VR.GL.program(FX_VS, FX_FS, 'funke'); } catch (e) { GX.fail = true; console.warn('funke fx', e); }
    return GX.p;
  }
  function fxBuffer(gl, verts) {
    const vao = gl.createVertexArray(), vbo = gl.createBuffer();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, verts * STRIDE * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE * 4, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, STRIDE * 4, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, STRIDE * 4, 28);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, STRIDE * 4, 32);
    gl.bindVertexArray(null);
    return { vao, vbo, cap: verts, n: 0 };
  }
  // one vertex into a Float32Array at index i (the vertex number)
  const vtx = (A, i, x, y, z, r, g, b, a, d, dx, dy, dz, side) => { const o = i * STRIDE; A[o] = x; A[o + 1] = y; A[o + 2] = z; A[o + 3] = r; A[o + 4] = g; A[o + 5] = b; A[o + 6] = a; A[o + 7] = d; A[o + 8] = dx; A[o + 9] = dy; A[o + 10] = dz; A[o + 11] = side; };

  // ---------------------------------------------------------------- the bubble (one DOM element, written only while it shows)
  let bub = null;
  function bubble() {
    if (bub || typeof document === 'undefined' || !document.createElement) return bub;
    if (!document.getElementById('funkecss')) {
      const st = document.createElement('style'); st.id = 'funkecss';
      st.textContent = '#funkebub{position:absolute;left:0;top:0;max-width:min(330px,70vw);padding:6px 13px 8px;border-radius:15px;background:rgba(248,252,255,0.96);color:#16222e;font:600 15px/1.28 var(--font,sans-serif);box-shadow:0 5px 18px rgba(0,0,0,.30),0 0 0 2px rgba(70,232,255,.85),0 0 22px rgba(70,232,255,.45);pointer-events:none;display:none;z-index:28;will-change:transform}'
        + '#funkebub b{display:block;font:700 12px/1.3 var(--display,sans-serif);letter-spacing:.12em;color:#0a9fc0;text-transform:uppercase}'
        + '#funkebub .pic{display:inline-flex;gap:3px;margin-right:6px;vertical-align:middle}#funkebub kbd{display:inline-block;min-width:16px;padding:0 4px;border:1px solid #9fb2c2;border-bottom-width:2px;border-radius:4px;font:700 11px/16px var(--font,sans-serif);text-align:center;background:#fff;color:#223}'
        + '#funkebub .x{pointer-events:auto;margin-left:8px;border:0;background:none;color:#7a8a99;font:700 13px sans-serif;cursor:pointer}'
        + '#funkebub:after{content:"";position:absolute;top:50%;margin-top:-7px;border:7px solid transparent}#funkebub.l:after{right:-13px;border-left-color:rgba(248,252,255,.96)}#funkebub.r:after{left:-13px;border-right-color:rgba(248,252,255,.96)}'
        + '#hints.funke{display:none!important}';
      (document.head || document.body).appendChild(st);
    }
    bub = document.createElement('div'); bub.id = 'funkebub'; bub.setAttribute('role', 'status'); bub.setAttribute('aria-live', 'polite');
    bub.innerHTML = '<b></b><span class="pic"></span><span class="tx"></span>';
    (document.getElementById('app') || document.body).appendChild(bub);
    return bub;
  }

  // ---------------------------------------------------------------- the store (per browser: the greeting and the tips said)
  const KEY = 'r9si.funke';
  const MEM = { hello: false, help: {} };   // (said in this session: the same when the browser keeps no storage)
  F.store = function () { let o = null; try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { o = null; } if (!o || typeof o !== 'object') o = {}; if (!o.help || typeof o.help !== 'object') o.help = {}; return o; };
  F.save = function (o) { try { localStorage.setItem(KEY, JSON.stringify(o)); return true; } catch (e) { return false; } };

  // ---------------------------------------------------------------- the sources of targets a sibling adds (quests, the story)
  const SOURCES = [];
  F.addSource = function (fn) { if (typeof fn === 'function' && SOURCES.indexOf(fn) < 0) SOURCES.push(fn); };

  // ---------------------------------------------------------------- the actor (one per world)
  const PO = { col: null, size: 0.06, grav: 0, drag: 0.6, collide: false, life: 0.7, emis: 1, force: true };
  const POSE = { rotor_l: [0, 0, 0], rotor_r: [0, 0, 0], antenna: [0, 0, 0] }, HIDE_EYE = { eye: true };
  const OPTS = { scale: F.SCALE, pitch: 0, roll: 0, light: null, pose: POSE, hide: null, shade: 0, baseMat: null };
  class Actor {
    constructor(g) {
      this.g = g;
      const e = g.player && g.player.eyePos ? g.player.eyePos() : [0, 70, 0];
      this.S = F.springState(e); this.pos = this.S.p; this.anchor = [e[0], e[1], e[2]];
      this.pv = [0, 0, 0]; this.yaw = 0; this.roll = 0; this.pitch = 0; this.spin = 0;
      this.budget = new Budget(); this.lost = new Lost(); this.said = new Set(); this.n = 0;
      this.visible = false; this.brainT = 0.5; this.wowAt = -Infinity; this.targetsAt = -Infinity; this.targets = [];
      this.line = null; this.startT = null; this.askT = -Infinity; this.askI = 0; this.blinkT = 2; this.inputT = -Infinity;
      this.wayT = 0; this.wayPts = 0; this.wayTg = null; this.wayDirty = false; this.waySide = 0; this.wayYaw = 0; this.wayP = new Float32Array(26 * 3); this.wayD = new Float32Array(26); this.wayO = [0, 0, 0]; this.wayEnd = false;
      this.scanJob = null; this.scanT = 0; this.scanR = F.SCAN_R; this.scanO = [0, 0, 0]; this.scanN = 0; this.scanData = null; this.scanDirty = false; this.scanAsked = false;
      this.shot = null; this.ph = null; this.light = { sky: 1, bl: [0.32, 0.55, 0.62] }; this.lightT = 0;
      this.seat = null; this.seatM = VR.mat4 ? VR.mat4.create() : null; this.wp = [0, 0, 0];
      this.out = null; this.hint = null; this.padCache = {}; this.kindT = {};
      F.last = null;
    }
    // ---- what it may do
    on() { const g = this.g, S = g.settings || {}, p = g.player; return S.funke !== false && g.state === 'play' && !!p && !p.dead && !g.studioOpen && !(g.director && g.director.active); }
    busy() { const g = this.g, ui = g.ui; return !!(ui && (ui.screen || ui.typing)) || !!(g.wow && g.wow.active) || !!(g.arrival && g.arrival.holds && g.arrival.holds()) || !!(g.photoCam && g.photoCam.on) || !!(VR.Zeit && VR.Zeit.active) || !!this.ph; }
    einfach() { const U = VR.UIPrefs; try { return !(U && U.get && U.get().pro); } catch (e) { return true; } }
    // the player is there: a key, the mouse, a pad or a finger within the last minute (Funke never talks to an empty room)
    present(t) { return t - this.inputT < 60; }
    feel(T) {
      const I = this.g.input; if (!I) return;
      const m = I.mouse;
      if ((I.keys && I.keys.size) || (m && (m.dx || m.dy || (m.down && (m.down[0] || m.down[2])))) || (I.padDown && I.padDown.size) || (I.tDown && I.tDown.size)) this.inputT = T;
    }
    inVehicle() { const g = this.g; return !!g.flight || !!(g.gadgets && g.gadgets.controlling); }
    buildFocus() {
      const g = this.g, BH = VR.Bauhand, p = g.player, I = g.input, ms = I && I.mouse;
      return !!((BH && BH.state && BH.state !== 'closed') || (p && p.breaking) || (I && I.captured && ms && ms.down && (ms.down[0] || ms.down[2]) && !(g.ui && g.ui.screen)));
    }
    solid(x, y, z) { const w = this.g.world, R = VR.R, Fl = VR.F; if (!w || !R) return false; const b = w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return !!(b && (R.T.flags[b] & Fl.SOLID)); }
    ground(x, y, z) { const w = this.g.world, R = VR.R, Fl = VR.F; if (!w || !R) return false; const b = w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return !!(b && (R.T.flags[b] & (Fl.SOLID | (Fl.WATER || 0)))); }
    // ---- the frame
    update(dt) {
      const t0 = now(), g = this.g;
      if (!this.on()) { this.visible = false; this.wayT = 0; this.scanT = 0; this.scanJob = null; if (this.line) this.endLine(); if (this.ph) this.photoEnd(); return; }
      dt = clamp(dt || 0, 0, 0.1);
      const T = g.time || 0, p = g.player;
      const first = this.startT === null; if (first) this.startT = T;
      this.feel(T);
      if (this.buildFocus()) this.budget.build(T);
      this.visible = !(g.arrival && g.arrival.holds && g.arrival.holds());
      // where it wants to be
      this.seat = g.flight || null;
      if (!this.seat) {
        this.place(T);
        F.spring(this.S, this.anchor, dt, this.ph || this.wayT > 0 ? 9 : 6, this.inVehicle() ? 4 : F.LAG);
        if (first || (this.S.snapped && T - this.startT > 1)) this.sparkle();
        this.attitude(dt, T);
      }
      this.spin += dt * (this.seat ? 14 : 34);
      if ((this.blinkT -= dt) < -0.12) this.blinkT = 2.5 + ((this.n * 7919 + Math.floor(T)) % 30) / 10;
      if ((this.lightT -= dt) <= 0) { this.lightT = 0.25; this.relight(); }
      // the line, the way, the scan, the photo
      if (this.line && ((this.line.hint && !(VR.Hints && VR.Hints.current() === this.line.hint)) || (!this.line.hint && T >= this.line.until))) this.endLine();
      if (this.wayT > 0) this.wayT = Math.max(0, this.wayT - dt);
      if (this.scanJob) { const s0 = now(); if (this.scanJob.step(4, 0.4)) this.scanDone(); F.cost.scanMs += now() - s0; }
      if (this.scanT > 0) this.scanT = Math.max(0, this.scanT - dt);
      if (this.ph) this.photoStep(dt);
      if ((this.brainT -= dt) <= 0) { this.brainT = 1; try { this.brain(T); } catch (e) { if (!this.warned) { this.warned = true; console.warn('funke', e); } } }
      if (this.line) this.placeBubble();
      const ms = now() - t0, C = F.cost; C.frames++; C.ms += ms; if (ms > C.worst) C.worst = ms;
      void p;
    }
    // the place it wants: the shoulder; in view when it talks (first person); ahead when it shows the way; the photo spot
    place(T) {
      const g = this.g, p = g.player, A = this.anchor, cam = g.cam;
      const yaw = cam && Number.isFinite(cam.yaw) ? cam.yaw : p.yaw;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const bob = Math.sin(T * 2.1) * 0.05;
      if (this.ph && this.ph.spot) { const s = this.ph.spot; A[0] = s[0]; A[1] = s[1]; A[2] = s[2]; return; }
      if (this.inVehicle() && cam) { A[0] = cam.x + rx * 0.8 - fx * 0.2; A[1] = cam.y - 0.25 + bob; A[2] = cam.z + rz * 0.8 - fz * 0.2; return; }
      const P = p.pos, firstPerson = (g.camMode | 0) === 0 && !(g.photoCam && g.photoCam.on);
      if (this.wayT > 0 && this.wayTg && this.waySide && firstPerson && cam) {
        // the target off the view (first person): in the view on the target's side — the ribbon bends round from here
        const s = this.waySide;
        A[0] = cam.x + fx * 1.5 + rx * 0.72 * s; A[1] = cam.y - 0.12 + bob * 0.5; A[2] = cam.z + fz * 1.5 + rz * 0.72 * s;
      } else if (this.wayT > 0 && this.wayTg) {
        // ahead toward the target, at eye height
        const tg = this.wayTg.pos, dx = tg[0] - P[0], dz = tg[2] - P[2], L = Math.hypot(dx, dz) || 1;
        A[0] = P[0] + dx / L * 1.5 + rx * 0.35; A[1] = P[1] + 1.45 + bob; A[2] = P[2] + dz / L * 1.5 + rz * 0.35;
      } else if (this.line && firstPerson && cam) {
        // peeking into the view: front right of the eye
        A[0] = cam.x + fx * 1.55 + rx * 0.58; A[1] = cam.y - 0.14 + bob * 0.5; A[2] = cam.z + fz * 1.55 + rz * 0.58;
      } else {
        A[0] = P[0] + rx * 0.78 - fx * 0.3; A[1] = P[1] + 1.42 + bob; A[2] = P[2] + rz * 0.78 - fz * 0.3;
      }
      // lift over blocks: the place or the line from the head to it blocked → the other shoulder → over the head
      const hx = P[0], hy = P[1] + 1.5, hz = P[2];
      const blocked = (x, y, z) => this.solid(x, y, z) || this.solid(x, y + 0.3, z) || this.solid((x + hx) / 2, (y + hy) / 2, (z + hz) / 2);
      if (blocked(A[0], A[1], A[2])) {
        const mx = 2 * hx - A[0], mz = 2 * hz - A[2];
        if (!blocked(mx, A[1], mz)) { A[0] = mx; A[2] = mz; }
        else { A[0] = P[0] - fx * 0.2; A[1] = P[1] + 2.3 + bob; A[2] = P[2] - fz * 0.2; if (this.solid(A[0], A[1], A[2])) { A[0] = hx - fx * 0.5; A[1] = hy + 0.1; A[2] = hz - fz * 0.5; } }
      }
    }
    // banking: roll from the sideways acceleration, pitch from the forward one; the yaw turns toward its look
    attitude(dt, T) {
      const g = this.g, v = this.S.v, pv = this.pv, inv = dt > 1e-4 ? 1 / dt : 0;
      const ax = (v[0] - pv[0]) * inv, az = (v[2] - pv[2]) * inv; pv[0] = v[0]; pv[1] = v[1]; pv[2] = v[2];
      const want = this.lookYaw(T), c = Math.cos(this.yaw), s = Math.sin(this.yaw);
      const lat = ax * c - az * s, fwd = -ax * s - az * c, vf = -v[0] * s - v[2] * c;
      const k = 1 - Math.exp(-dt / 0.14);
      this.roll += (clamp(-lat * 0.05, -0.6, 0.6) - this.roll) * k;
      this.pitch += (clamp(-fwd * 0.03 - vf * 0.035, -0.35, 0.35) - this.pitch) * k;
      const d = wrapA(want - this.yaw), mx = 6 * dt;
      this.yaw = wrapA(this.yaw + clamp(d, -mx, mx));
      void g;
    }
    lookYaw(T) {
      const g = this.g, cam = g.cam, P = this.pos, pose = !!(g.photoCam && g.photoCam.on);
      // the way: to the player while it says it (the first second), then along the ribbon
      if (this.wayT > 0 && this.wayTg && !(cam && this.line && F.WAY_T - this.wayT < 1.1)) { const W = this.wayP, n = this.wayPts; if (n > 2) { const a = this.wayO; return Math.atan2(-(a[0] + W[6] - P[0]), -(a[2] + W[8] - P[2])); } const tg = this.wayTg.pos; return Math.atan2(-(tg[0] - P[0]), -(tg[2] - P[2])); }
      if (cam && (this.line || this.ph || pose)) return Math.atan2(-(cam.x - P[0]), -(cam.z - P[2]));   // to the player (the camera; in the 📷 photo mode it poses)
      const base = cam && Number.isFinite(cam.yaw) ? cam.yaw : (g.player ? g.player.yaw : 0);
      return base + Math.sin(T * 0.37) * 0.35;   // looking about a little
    }
    relight() {
      const w = this.g.world, P = this.seat ? this.wp : this.pos; if (!w || !w.getLight) return;
      const l = w.getLight(Math.floor(P[0]), Math.floor(P[1]), Math.floor(P[2])), L = this.light;
      L.sky = Math.max(0.38, (l >>> 12) / 15); L.bl[0] = Math.max(0.3, ((l >> 8) & 15) / 15); L.bl[1] = Math.max(0.52, ((l >> 4) & 15) / 15); L.bl[2] = Math.max(0.6, (l & 15) / 15);
    }
    sparkle() {
      const P = this.g.particles, p = this.pos; if (!P || !P.spawn) return;
      PO.col = [0.45, 0.95, 1];
      for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; P.spawn(p[0], p[1], p[2], Math.cos(a) * 2.2, (i % 3 - 1) * 0.8, Math.sin(a) * 2.2, PO); }
    }

    // ---- the brain, once a second
    brain(T) {
      const g = this.g, p = g.player;
      if (T - this.targetsAt >= 5) { this.targetsAt = T; this.targets = this.targetList(); }
      const r = this.lost.step(T, p.pos[0], p.pos[2], this.targets);
      if (!this.present(T)) return;
      if (r && !this.busy() && !this.line && this.budget.can(T, false)) { const tg = this.target(false); if (tg) this.way(tg, false, r === 'circle' ? 'circle' : 'lost'); }
      if (this.line || this.busy() || !this.budget.can(T, false)) return;
      // the greeting (once per browser), then the first-time help (Einfach), then the next wow
      const st = F.store();
      if (!st.hello && !MEM.hello && T - this.startT >= 6) { if (this.say('hello', null, false)) { if (this.g.audio && this.g.audio.cue) this.g.audio.cue('funke'); MEM.hello = true; st.hello = Date.now(); F.save(st); } return; }
      if (this.einfach() && this.helpTick(st)) return;
      if (T - this.wowAt >= 5) {
        this.wowAt = T;
        const K = this.kindT, cands = this.wowCands().filter(c => !(T - (K[c.kind] === undefined ? -Infinity : K[c.kind]) < (F.KIND_WAIT[c.kind] || F.KIND_WAIT._)));
        const c = F.pickWow(cands, this.said, 'auto');
        if (c && this.sayWow(c, false)) { this.said.add(c.id); K[c.kind] = T; }
      }
    }
    // the targets the lost detector watches (≤ 64, nearest first): villages, vistas, waypoints, landmarks, the intent's
    targetList() {
      const g = this.g, P = g.player.pos, out = [];
      const add = (x, z) => { if (Number.isFinite(x) && Number.isFinite(z)) out.push([x, z, (x - P[0]) ** 2 + (z - P[2]) ** 2]); };
      const V = g.villages; if (V && V.sites) for (const s of V.sites) add(s.x, s.z);
      if (g.wow && g.wow.list) for (const v of g.wow.list.values()) add(v.x, v.z);
      const W = g.gadgets && g.gadgets.waypoints; if (W) for (const wp of W) add(wp.x, wp.z);
      const L = VR.EventLog; if (L && L.HEART_LM && g.meta && (g.meta.vgen | 0) >= 3 && (g.dim || 'overworld') === 'overworld') for (const q of L.HEART_LM) add(q[1], q[2]);
      const I = VR.Intent; if (I && I.targets) { try { const list = typeof I.targets === 'function' ? I.targets() : I.targets; if (Array.isArray(list)) for (const t of list) if (t && t.pos) add(t.pos[0], t.pos[2]); } catch (e) { /* optional */ } }
      out.sort((a, b) => a[2] - b[2]);
      return out.slice(0, 64);
    }
    // the target of the way: a sibling's source, the intent, the newest waypoint; unless strong: an unseen vista, the
    // nearest unvisited village, the player's place → {pos, name, kind} | null
    target(strong) {
      const g = this.g, p = g.player, P = p.pos, far = (q, a) => { const d = Math.hypot(q[0] - P[0], q[2] - P[2]); return d >= (a || 6) ? d : 0; };
      for (const fn of SOURCES) { try { const t = fn(g); if (t && t.pos && far(t.pos)) return { pos: t.pos, name: t.name || '', kind: t.kind || 'source' }; } catch (e) { /* a sibling's */ } }
      const I = VR.Intent; if (I && I.current) { try { const c = I.current(); const t = c && c.target; if (t && t.pos && far(t.pos)) return { pos: t.pos, name: t.name || '', kind: 'intent' }; } catch (e) { /* optional */ } }
      const W = g.gadgets && g.gadgets.waypoints; if (W && W.length) { const wp = W[W.length - 1], q = [wp.x + 0.5, wp.y, wp.z + 0.5]; const d = far(q, 8); if (d && d < 6000) return { pos: q, name: wp.name, kind: 'waypoint' }; }
      if (strong) return null;
      let best = null, bd = 400;
      if (g.wow && g.wow.list) for (const v of g.wow.list.values()) { if (v.wow === false || (VR.WowMoment && VR.WowMoment.seen(g.meta, v.id))) continue; const q = [v.x + 0.5, v.y, v.z + 0.5], d = far(q, 5); if (d && d < bd) { bd = d; best = { pos: q, name: VR.WowMoment ? VR.WowMoment.title(v.lm) : '', kind: 'vista' }; } }
      if (best) return best;
      const V = g.villages; bd = 2000;
      if (V && V.sites) for (const s of V.sites) { const vil = V.known && V.known.get(s.id); if (vil && vil.visited) continue; const q = [s.x, s.y || P[1], s.z], d = far(q, 70); if (d && d < bd) { bd = d; best = { pos: q, name: (vil && vil.name) || s.name || '', kind: 'village' }; } }
      if (best && best.name) return best;
      const sp = p.spawn; if (sp && far(sp, 100)) return { pos: [sp[0], sp[1], sp[2]], name: T('g.funke.home'), kind: 'home' };
      return null;
    }
    // what is coming: the context of now → the candidates
    wowCands() {
      const g = this.g, E = g.env, S = g.settings || {}, p = g.player, ld = g.lifeDirector, pl = g.padLife;
      const heart = !!(g.meta && (g.meta.vgen | 0) >= 3 && g.meta.type !== 'flat');
      const c = {
        tod: E ? E.timeOfDay : 6000, day: E ? E.day | 0 : 0, seed: (g.meta && g.meta.seed) | 0, wxSeed: E && E.wx ? E.wx.seed : 0,
        tier: VR.Wild && VR.Wild.tierOf ? VR.Wild.tierOf(S) : 2, sky3: VR.Sky3 && VR.Sky3.level ? VR.Sky3.level() : 0,
        sw: { wildBirds: S.wildBirds !== false, wildRays: S.wildRays !== false }, pos: p.pos, heart, place: ld && ld.st ? ld.st.place : '',
        ld: ld && ld.on && ld.ctx ? { seed: ld.seed, clock: ld.clock, ctx: ld.ctx, pick: ld.forecast ? (k) => ld.forecast(k) : null } : null, pads: null, vistas: [], villages: [],   // (f-flow: pick — the director's forecast)
        wet: !!(E && E.E && ((E.E.rain || 0) > 0.15 || (E.E.snow || 0) > 0.15)), dim: g.dim || 'overworld',
      };
      if (pl && pl.on !== false && pl.pads && S.padLife !== false) { c.pads = []; for (const pad of pl.pads.values()) c.pads.push({ key: pad.key, seed: pad.seed, x: pad.x, z: pad.z, clock: pl.clock, cache: this.padCache[pad.key] || (this.padCache[pad.key] = null) }); }
      if (g.wow && g.wow.list) for (const v of g.wow.list.values()) if (v.wow !== false && Math.abs(v.x - p.pos[0]) < 320 && Math.abs(v.z - p.pos[2]) < 320) c.vistas.push({ id: v.id, x: v.x, y: v.y, z: v.z, lm: v.lm, seen: !!(VR.WowMoment && VR.WowMoment.seen(g.meta, v.id)) });
      const V = g.villages; if (V && V.known && V.festivalDay) for (const vil of V.known.values()) { const P = vil.plan; if (!P || Math.abs(P.x - p.pos[0]) > 320 || Math.abs(P.z - p.pos[2]) > 320) continue; let fest = false; try { fest = V.festivalDay(vil); } catch (e) { fest = false; } c.villages.push({ name: vil.name, x: P.x, z: P.z, fest }); }
      const out = F.wowCandidates(c);
      if (c.pads) for (const q of c.pads) if (q.cache) this.padCache[q.key] = q.cache;
      return out;
    }
    sayWow(c, prompted) {
      const g = this.g, wk = F.whenKey(c.eta), v = Object.assign({ when: T(wk[0], wk[1]) }, c.vars || {});
      if (c.kind === 'vista') { v.name = VR.WowMoment ? VR.WowMoment.title(c.vars.lm) : ''; v.d = F.dist(c.vars.d); }
      if (c.kind === 'meteor') v.dir = T(c.vars.dirKey);
      let kind = c.kind;
      if (kind === 'golden' && c.eta > 2) { const vis = this.nearVista(); if (vis) { kind = 'golden_vista'; v.name = vis; } }
      if (kind === 'ship' && c.vars && c.vars.temple) kind = 'ship_temple';
      const ok = this.say('wow.' + kind, v, prompted);
      if (ok && c.pos && (c.kind === 'vista' || c.kind === 'festival')) this.startWay({ pos: c.pos, name: v.name || '', kind: c.kind });
      void g;
      return ok;
    }
    nearVista() { const g = this.g, P = g.player.pos; if (!g.wow || !g.wow.list) return null; let best = null, bd = 120; for (const v of g.wow.list.values()) { if (v.wow === false) continue; const d = Math.hypot(v.x - P[0], v.z - P[2]); if (d < bd) { bd = d; best = v; } } return best && VR.WowMoment ? VR.WowMoment.title(best.lm) : null; }
    // the first-time tips (Einfach): something new near → its line, once per browser
    helpTick(st) {
      const g = this.g, p = g.player, R = VR.R, h = st.help, want = (k) => !h[k] && !MEM.help[k];
      let k = null, vars = null;
      const tg = p.target, tt = tg && R && R.types[R.T.type[tg.state]], nm = tt ? tt.name : '';
      if (nm && (tt.o.ui === 'chest' || tt.o.ui === 'voidchest') && want('chest')) k = 'chest';
      else if (nm && /door|gate/.test(nm) && want('door')) k = 'door';
      else if (nm && /_bed$|^bed/.test(nm) && want('bed')) k = 'bed';
      else if (want('villager') && g.villages && g.villages.agents) { for (const a of g.villages.agents) if (a.pos && Math.abs(a.pos[0] - p.pos[0]) < 7 && Math.abs(a.pos[2] - p.pos[2]) < 7 && Math.abs(a.pos[1] - p.pos[1]) < 3) { k = 'villager'; vars = { name: a.p && a.p.name ? a.p.name : '' }; break; } }
      if (!k && want('ship') && g.starships && g.starships.ships) { for (const s of g.starships.ships) if (s && s.pos && s !== g.starships.pilot && Math.hypot(s.pos[0] - p.pos[0], s.pos[2] - p.pos[2]) < 16) { k = 'ship'; break; } }
      if (!k && want('vista') && g.wow && g.wow.list) { for (const v of g.wow.list.values()) { const d = Math.hypot(v.x - p.pos[0], v.z - p.pos[2]); if (v.wow !== false && d < 40 && d > 5 && !(VR.WowMoment && VR.WowMoment.seen(g.meta, v.id))) { k = 'vista'; break; } } }
      if (!k && want('night') && g.env && g.env.E && g.env.E.night > 0.6 && (g.dim || 'overworld') === 'overworld') k = 'night';
      if (!k && want('water') && p.mode === 'survival' && p.air !== undefined && p.air < 200) k = 'water';
      if (!k) return false;
      if (!this.say('help.' + k, vars, false)) return false;
      h[k] = Date.now(); MEM.help[k] = true; F.save(st);
      return true;
    }

    // ---- talking
    say(kind, vars, prompted, o) {
      const g = this.g, T0 = g.time || 0;
      if (!this.on() || !this.budget.can(T0, prompted)) return false;
      if (!prompted && this.line) return false;
      const text = F.say(kind, vars, this.n++);
      if (!text) return false;
      this.budget.said(T0);
      this.show(text, o);
      return true;
    }
    show(text, o) {
      const g = this.g, T0 = g.time || 0, dur = Math.max(2.5, 1.2 + 0.06 * text.length);
      if (this.line && this.line.hint && !(o && o.hint)) this.unhide();
      this.line = { text, until: T0 + dur, hint: (o && o.hint) || null, picto: (o && o.picto) || null };
      F.last = { text, t: T0, hint: this.line.hint };
      if (VR.EventLog && VR.EventLog.emit) VR.EventLog.emit('social', 'funke', 1, null, 'funke');   // a-regie: a companion's line in the view (weight 1: no gap ends with it)
      if (this.out) this.out(text);
      this.blips(text);
      const el = bubble(); if (!el) return;
      el.querySelector('b').textContent = T('g.funke.name');
      el.querySelector('.tx').textContent = text;
      const pic = el.querySelector('.pic'); pic.innerHTML = '';
      if (this.line.picto) for (const q of this.line.picto) { const k = document.createElement('kbd'); k.textContent = q === 'mouse' ? '🖱' : q === 'finger' ? '👆' : q === 'Space' ? '␣' : q; pic.appendChild(k); }
      pic.style.display = this.line.picto && this.line.picto.length ? '' : 'none';
      let x = el.querySelector('.x'); if (x) x.remove();
      if (this.line.hint) { x = document.createElement('button'); x.className = 'x'; x.type = 'button'; x.textContent = '✕'; x.onclick = (e) => { if (e && e.stopPropagation) e.stopPropagation(); const H = VR.Hints; if (H) H.dismiss(); if (o && o.onDismiss) o.onDismiss(); this.endLine(); }; el.appendChild(x); }
      el.style.display = 'block'; el.style.opacity = '1';
      this.bx = null;
      this.placeBubble();
    }
    endLine() { if (this.line && this.line.hint) this.unhide(); this.line = null; if (bub) bub.style.display = 'none'; }
    unhide() { if (typeof document !== 'undefined') { const h = document.getElementById('hints'); if (h) h.classList.remove('funke'); } }
    // the bubble beside the drone (toward the middle of the screen), kept on the screen
    placeBubble() {
      const el = bub, g = this.g, r = g.renderer, cam = g.cam; if (!el || !r || !r.viewProj || !cam) return;
      const hidden = (g.hideHud && !(g.photoCam && g.photoCam.on)) || !!(g.ui && g.ui.screen);
      if (hidden) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
      if (el.style.display === 'none') el.style.display = 'block';
      const vp = r.viewProj, P = this.seat ? this.wp : this.pos, x = P[0] - cam.x, y = P[1] + 0.1 - cam.y, z = P[2] - cam.z;
      const W = r.canvas ? r.canvas.clientWidth || 1280 : 1280, H = r.canvas ? r.canvas.clientHeight || 720 : 720;
      const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
      let sx, sy, left;
      if (cw > 0.05) { const cx = (vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / cw, cy = (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / cw; sx = (cx * 0.5 + 0.5) * W; sy = (1 - (cy * 0.5 + 0.5)) * H; left = cx > -0.15; }
      else { sx = W - 40; sy = H * 0.45; left = true; }
      const bw = el.offsetWidth || 240, bh = el.offsetHeight || 50;
      let X = left ? sx - 26 - bw : sx + 26, Y = sy - bh / 2;
      X = clamp(X, 10, W - bw - 10); Y = clamp(Y, 10, H - bh - 96);   // (e-ux: never over the bottom row — the hotbar, the hint line, the 🖐 button)
      if (X + bw > W - 200 && Y < 236) Y = 236;   // (… nor over the minimap and its compass line)
      { const ks = VR.UX && VR.UX.stripBox; if (ks && X + bw > W - ks.w && Y + bh > H - ks.h) Y = Math.max(10, H - ks.h - bh - 8); }   // (… nor over the key-hint strip while it shows, ux.js)
      // (e-ux) never over the crosshair and its Aktion prompt: the bubble steps above them
      if (X < W / 2 + 160 && X + bw > W / 2 - 160 && Y < H / 2 + 66 && Y + bh > H / 2 - 14) Y = Math.max(10, H / 2 - 18 - bh);
      if (!this.bx || Math.abs(this.bx[0] - X) >= 1 || Math.abs(this.bx[1] - Y) >= 1 || this.bx[2] !== left) { this.bx = [X, Y, left]; el.style.transform = 'translate(' + (X | 0) + 'px,' + (Y | 0) + 'px)'; el.className = left ? 'l' : 'r'; }
    }
    // Funke's voice: pentatonic blips from the line's hash, higher than the villagers'
    blips(text) {
      const au = this.g.audio; if (!au || !au.ctx || !au.tone) return;
      let h = 2166136261; for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
      const t = au.ctx.currentTime, PEN = [0, 2, 4, 7, 9, 12], n = clamp(Math.round(text.length / 16), 3, 6);
      for (let k = 0; k < n; k++) au.tone(784 * Math.pow(2, PEN[(h >>> (k * 3)) % 6] / 12), 0.026, 0.065, 'triangle', false, t + k * 0.072, au.vox);   // (e-music: the Stimmen bus)
      au.tone(1568, 0.014, 0.11, 'sine', false, t + n * 0.072, au.vox);
    }
    // a 🧭 hint of the game shown as Funke's line (Einfach, not muted, not building)
    relayHint(id, o) {
      const g = this.g, T0 = g.time || 0;
      if (!this.on() || !this.einfach() || !this.present(T0) || this.budget.muted(T0) || this.budget.quiet(T0) || this.busy() || this.inVehicle()) return false;
      this.show(String((o && o.text) || ''), { hint: id, picto: o && o.picto, onDismiss: o && o.onDismiss });
      if (typeof document !== 'undefined') { const h = document.getElementById('hints'); if (h) h.classList.add('funke'); }
      return true;
    }
    retextHint(text) { if (this.line && this.line.hint && bub) { this.line.text = String(text || ''); bub.querySelector('.tx').textContent = this.line.text; } }

    // ---- asking (e-ctx's V with nothing else): the way, the next wow, a scan, a photo — again within 8 s: the next one
    ask() {
      const g = this.g, T0 = g.time || 0; if (!this.on()) return false;
      if (g.audio && g.audio.cue) g.audio.cue('funke');   // e-music: his leitmotif (at most every three minutes, score.js)
      const strong = this.target(true), list = [];
      if (strong) list.push('way');
      if (F.pickWow(this.wowCands(), this.said, 'ask')) list.push('wow');
      if (!strong && this.target(false)) list.push('way');
      list.push('scan'); if (!this.inVehicle()) list.push('photo');
      if (!list.includes('wow')) list.splice(Math.min(list.length, 1), 0, 'wow');   // („nothing coming" is an answer too)
      this.askI = T0 - this.askT < F.ASK_T ? (this.askI + 1) % list.length : 0; this.askT = T0;
      return this.doAsk(list[this.askI]);
    }
    doAsk(what) {
      if (what === 'way') return this.way(null, true);
      if (what === 'wow') return this.wowAsk();
      if (what === 'scan') return this.scan(true);
      if (what === 'photo') return this.photo();
      return false;
    }
    wowAsk() { const c = F.pickWow(this.wowCands(), this.said, 'ask'); if (!c) return this.say('wow.quiet', null, true); const ok = this.sayWow(c, true); if (ok) this.said.add(c.id); return ok; }
    muteNow() { const g = this.g; this.budget.mute(g.time || 0); this.say('mute', null, true); }
    unmuteNow() { this.budget.unmute(); this.say('unmute', null, true); }

    // ---- the way: a line and a ribbon of light toward the target for 4 s
    way(tg, prompted, kind) {
      if (!this.on()) return false;
      tg = tg || this.target(false);
      if (!tg) return prompted ? this.say('noway', null, true) : false;
      const P = this.g.player.pos, d = Math.hypot(tg.pos[0] - P[0], tg.pos[2] - P[2]);
      if (!this.say(kind || 'way', { name: tg.name || T('g.funke.home'), d: F.dist(d) }, prompted)) return false;
      this.startWay(tg);
      return true;
    }
    // the way starts from where the drone is going (its anchor), not from where it happens to be (run 1: the ribbon began
    // behind the camera and swept past it); in first person a target off the view puts the drone in the view on its side
    startWay(tg) {
      const g = this.g, cam = g.cam, p = g.player, T0 = g.time || 0;
      this.wayTg = tg; this.wayT = F.WAY_T; this.waySide = 0;
      const yaw = cam && Number.isFinite(cam.yaw) ? cam.yaw : (p ? p.yaw : 0), firstPerson = (g.camMode | 0) === 0 && !(g.photoCam && g.photoCam.on);
      this.wayYaw = yaw;
      if (!this.seat && firstPerson && cam && p) {
        const a = wrapA(Math.atan2(-(tg.pos[0] - p.pos[0]), -(tg.pos[2] - p.pos[2])) - yaw);
        if (Math.abs(a) > 0.85) this.waySide = a > 0 ? -1 : 1;   // (yaw grows to the left)
      }
      if (!this.seat && p) this.place(T0);
      this.buildWay();
    }
    // the points: from the drone's place toward the target, 2 m apart, up to 48 m (or the target), over what is solid; a
    // target off the view: it starts sideways and turns ≤ 0.5 rad a step (an arc round the player, never through the eye)
    buildWay() {
      const tg = this.wayTg, P = this.seat ? this.wp : this.anchor, A = this.wayP, D = this.wayD, O = this.wayO, s0 = this.waySide;
      const Lh = Math.hypot(tg.pos[0] - P[0], tg.pos[2] - P[2]) || 1;
      let th = s0 ? Math.atan2(Math.cos(this.wayYaw) * s0, -Math.sin(this.wayYaw) * s0) : Math.atan2(tg.pos[0] - P[0], tg.pos[2] - P[2]);
      const L = Math.min(F.WAY_L, Lh + (s0 ? 6 : 0)), n = clamp(Math.ceil(L / 2), 2, 25), step = L / n;
      O[0] = P[0]; O[1] = P[1]; O[2] = P[2];
      const off = !this.seat && this.inVehicle() ? 2.5 : 0.45, lvl = !!this.seat || !!(this.g.player && this.g.player.flying);   // (flying: the line keeps its height over a deep drop)   // (riding: it sits beside the eye — the line starts ahead)
      let x = P[0] + Math.sin(th) * off, z = P[2] + Math.cos(th) * off, y = P[1] - 0.1, d = 0, end = false, i = 1;
      A[0] = x - O[0]; A[1] = y - O[1]; A[2] = z - O[2]; D[0] = 0;
      for (; i <= n; i++) {
        const tx = tg.pos[0] - x, tz = tg.pos[2] - z, rem = Math.hypot(tx, tz);
        th += clamp(wrapA(Math.atan2(tx, tz) - th), -0.5, 0.5);
        end = rem <= step + 0.01;
        if (end) { x = tg.pos[0]; z = tg.pos[2]; } else { x += Math.sin(th) * step; z += Math.cos(th) * step; }
        let k = 0; while (k < 10 && this.solid(x, y, z)) { y += 1; k++; }                     // up over a wall or a hill
        let gy = null; for (let j = 0; j < 7; j++) if (this.ground(x, y - 1 - j, z)) { gy = Math.floor(y - 1 - j) + 1; break; }
        const want = gy === null ? (lvl ? y : y - 0.8) : gy + 0.55;   // a path of light low over the ground (water too): seen from above, not edge-on
        y = end ? tg.pos[1] + 1.2 : y + clamp(want - y, -0.9, 0.9);
        const px = x - O[0], py = y - O[1], pz = z - O[2], q = (i - 1) * 3;
        d += Math.hypot(px - A[q], py - A[q + 1], pz - A[q + 2]);
        A[i * 3] = px; A[i * 3 + 1] = py; A[i * 3 + 2] = pz; D[i] = d;
        if (end) break;
      }
      this.wayPts = (end ? i : n) + 1; this.wayLen = d; this.wayEnd = end; this.wayDirty = true;
    }

    // ---- the scan
    scanRadius() { const A = VR.Adventure, Adv = VR.Adv; try { if (A && Adv && A.on && A.on() && A.rec && A.rec.me) return Adv.effects(A.rec.me.pts).scan || F.SCAN_R; } catch (e) { /* optional */ } return F.SCAN_R; }
    scan(prompted) {
      const g = this.g, w = g.world, R = VR.R; if (!this.on() || !w || !R || this.scanJob) return false;
      const P = g.player.pos;
      this.scanR = Math.min(48, this.scanRadius());
      this.scanJob = new Scan(w, F.scanMarks(R), [P[0], P[1] + 1, P[2]], this.scanR);
      this.scanO[0] = Math.floor(P[0]) + 0.5; this.scanO[1] = Math.floor(P[1]); this.scanO[2] = Math.floor(P[2]) + 0.5;
      this.scanT = F.SCAN_T; this.scanT0 = g.time || 0; this.scanN = 0; this.scanData = null; this.scanAsked = !!prompted;
      const au = g.audio; if (au && au.ctx && au.tone) { const t = au.ctx.currentTime; au.tone(523, 0.03, 0.25, 'sine', false, t); au.tone(784, 0.03, 0.3, 'sine', false, t + 0.08); au.tone(1175, 0.025, 0.45, 'sine', true, t + 0.16); }
      return true;
    }
    scanDone() {
      const job = this.scanJob, res = job.result(); this.scanJob = null;
      this.scanData = res.list; this.scanDirty = true; this.scanN = res.list.length;
      const K = F.scanOrder(res.veins).slice(0, 4);   // (the rarest four kinds, each counted in finds)
      if (!K.length) { this.say('scan.none', null, this.scanAsked); return; }
      const list = K.map(k => T('g.funke.scan.item', { n: res.veins[k], what: T('g.funke.ore.' + k) })).join(' · ');
      this.say('scan.found', { list }, this.scanAsked);
    }

    // ---- the photo from Funke's spot: fly there, take the camera's place for one frame (the hero drawn), save at 2×
    photo() {
      const g = this.g; if (!this.on() || this.ph) return false;
      if (this.inVehicle()) return this.say('photo.no', null, true);
      const sh = this.photoSpot(); if (!sh) return this.say('photo.no', null, true);
      this.ph = { phase: 'fly', t: 0, spot: sh.pos, cam: sh.cam };
      this.say('photo.go', null, true);
      void g;
      return true;
    }
    photoSpot() {
      const g = this.g, p = g.player, e = p.eyePos(), yaw = p.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const tryAt = (bx, by, bz) => {
        const dx = bx - e[0], dy = by - e[1], dz = bz - e[2], L = Math.hypot(dx, dy, dz);
        let ok = L; for (let s = 0.3; s <= L + 0.4; s += 0.3) if (this.solid(e[0] + dx / L * s, e[1] + dy / L * s, e[2] + dz / L * s)) { ok = s - 0.45; break; }
        return ok >= 1.6 ? [e[0] + dx / L * ok, e[1] + dy / L * ok, e[2] + dz / L * ok] : null;
      };
      let pos = tryAt(e[0] - fx * 3.2 + rx * 1.5, e[1] + 0.9, e[2] - fz * 3.2 + rz * 1.5) || tryAt(e[0] - fx * 3.2 - rx * 1.5, e[1] + 0.9, e[2] - fz * 3.2 - rz * 1.5), look;
      if (pos) look = [e[0] * 0.4 + (e[0] + fx * 9) * 0.6, e[1] - 0.35, e[2] * 0.4 + (e[2] + fz * 9) * 0.6];
      else { pos = tryAt(e[0] + fx * 2.8 + rx * 0.6, e[1] + 0.35, e[2] + fz * 2.8 + rz * 0.6); if (!pos) return null; look = [e[0], e[1] - 0.25, e[2]]; }   // (in front: a picture of the face)
      const vx = look[0] - pos[0], vy = look[1] - pos[1], vz = look[2] - pos[2];
      return { pos, cam: { x: pos[0], y: pos[1], z: pos[2], yaw: Math.atan2(-vx, -vz), pitch: Math.atan2(vy, Math.hypot(vx, vz)), fov: 62 * DEG } };
    }
    photoStep(dt) {
      const g = this.g, st = this.ph; st.t += dt;
      if (st.phase === 'fly') {
        const s = st.spot, d = Math.hypot(this.pos[0] - s[0], this.pos[1] - s[1], this.pos[2] - s[2]);
        if (d < 0.3 || st.t > 1.8) {
          st.phase = 'hold'; st.t = 0;
          this.shot = st.cam; this.camMode0 = g.camMode; g.camMode = 1;   // (the hero is drawn in the picture)
          const r = g.renderer, PM = VR.PhotoMode;
          if (r) r.capNext = { k: (PM && PM.SCALE) || 2, cb: (img) => this.photoSaved(img) };
          if (PM && PM.flash) PM.flash();
          if (g.audio && g.audio.play) g.audio.play('click');
        }
      } else if (st.phase === 'hold' && st.t > 0.6) this.photoEnd();
    }
    photoEnd() { const g = this.g; if (this.shot) { this.shot = null; g.camMode = this.camMode0 | 0; } this.ph = null; }
    photoSaved(img) {
      const g = this.g, PM = VR.PhotoMode;
      F.lastShot = img ? { w: img.w, h: img.h } : null;
      if (img && PM && PM.Photo) { const pc = g.photoCam || (g.photoCam = new PM.Photo(g)); try { pc.save(img); } catch (e) { console.warn('funke photo', e); } }
      if (img) this.say('photo.done', null, true);
    }
    // the camera while the photo is taken (game.js's hook)
    cam(base) { const s = this.shot; if (!s) return null; return Object.assign({}, base, { x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch, roll: 0, fov: s.fov, fixed: true }); }

    // ---- drawing: the drone (opaque, after the scene's models)
    draw(r, E, cam) {
      if (!this.visible || this.shot || !this.on()) return;
      const g = this.g, ent = g.entities, gl = r.gl; if (!ent || !r.planes || !VR.getVoxModel) return;
      const t0 = now(), T0 = g.time || 0, m4 = VR.mat4;
      const model = VR.getVoxModel(gl, 'funke'); if (!model) return;
      let P = this.pos, yaw = this.yaw;
      OPTS.baseMat = null; OPTS.scale = F.SCALE; OPTS.roll = this.roll; OPTS.pitch = this.pitch;
      const fl = g.flight;
      if (fl && fl.toWorld && fl.b && fl.R3 && this.seatM) {
        // on the dashboard: the glare shield right of the pilot, with the ship's attitude
        const b = fl.b, e = b.eye || [0, 1.5, 0], K = g.cockpit && g.cockpit.kit ? g.cockpit.kit(fl) : null, top = K && K.def && Number.isFinite(K.def.dashTop) ? K.def.dashTop : e[1] - 0.3;
        const wp = fl.toWorld([e[0] + 0.5, top + 0.11, e[2] - 1.05], this.wp); wp[1] += fl.dip || 0; P = wp;
        const M = this.seatM; M.set(fl.R3); M[12] = wp[0] - cam.x; M[13] = wp[1] - cam.y; M[14] = wp[2] - cam.z;
        m4.rotY(M, M, this.line ? Math.PI + Math.sin(T0 * 1.3) * 0.15 : Math.sin(T0 * 0.6) * 0.5);
        m4.translate(M, M, 0, Math.sin(T0 * 2.4) * 0.012, 0);
        OPTS.baseMat = M; OPTS.scale = F.SEAT_SCALE;
      }
      const dx = P[0] - cam.x, dy = P[1] - cam.y, dz = P[2] - cam.z, R0 = 0.32 * OPTS.scale / F.SCALE;   // (the rotors' reach; run 1's 0.5 drew it beside the first-person eye, out of the view)
      if (!m4.boxInFrustum(r.planes, dx - R0, dy - R0, dz - R0, dx + R0, dy + R0, dz + R0)) return;   // not seen: nothing at all
      const prog = ent.beginVox(r, E);
      if (prog.u.u_clipNear) gl.uniform1f(prog.u.u_clipNear, 0);
      POSE.rotor_l[1] = this.spin; POSE.rotor_r[1] = -this.spin;
      POSE.antenna[0] = Math.sin(T0 * 3.1) * 0.12 + (this.line ? Math.sin(T0 * 17) * 0.1 : 0); POSE.antenna[2] = Math.sin(T0 * 2.3) * 0.1;
      OPTS.light = this.light; OPTS.hide = this.blinkT < 0 ? HIDE_EYE : null;
      ent.drawModel(r, prog, model, P, cam, yaw, POSE, this.light, OPTS);
      r.stats.draws += 7;
      const C = F.cost; C.draws++; C.drawMs += now() - t0;
    }
    // ---- drawing: the way's ribbon and the scan (translucent, additive)
    drawFx(r, E, cam) {
      if (!this.on() || (this.wayT <= 0 && this.scanT <= 0)) return;
      const p = fxProgram(r); if (!p) return;
      const gl = r.gl, t0 = now(), g = this.g, T0 = g.time || 0;
      gl.useProgram(p.p); gl.uniformMatrix4fv(p.u.u_viewProj, false, r.viewProj);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false); gl.disable(gl.CULL_FACE);
      if (this.wayT > 0 && this.wayPts > 1) this.drawWay(gl, p, cam);
      if (this.scanT > 0 && this.scanData) this.drawScan(gl, p, cam, T0);
      gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE); gl.enable(gl.DEPTH_TEST); gl.bindVertexArray(null);
      F.cost.drawMs += now() - t0;
      void E;
    }
    drawWay(gl, p, cam) {
      const B = GX.way || (GX.way = fxBuffer(gl, 160));
      if (this.wayDirty) {
        const A = this.wayA || (this.wayA = new Float32Array(160 * STRIDE)), P = this.wayP, D = this.wayD, n = this.wayPts;
        let v = 0;
        for (let i = 0; i < n - 1; i++) {
          const a = i * 3, b = a + 3, ex = P[b] - P[a], ey = P[b + 1] - P[a + 1], ez = P[b + 2] - P[a + 2], l = Math.hypot(ex, ey, ez) || 1, ux = ex / l, uy = ey / l, uz = ez / l;
          const q = [[a, D[i], -1], [a, D[i], 1], [b, D[i + 1], 1], [a, D[i], -1], [b, D[i + 1], 1], [b, D[i + 1], -1]];
          for (const [k, d, s] of q) vtx(A, v++, P[k], P[k + 1], P[k + 2], 0.42, 0.93, 1, 1, d, ux, uy, uz, s);
        }
        // a pillar of light where the line reaches the target
        B.rib = v;
        if (this.wayEnd) { const k = (n - 1) * 3, d = D[n - 1]; const pts = [[0, -1], [0, 1], [7, 1], [0, -1], [7, 1], [7, -1]]; for (const [h, s] of pts) vtx(A, v++, P[k], P[k + 1] - 1.2 + h, P[k + 2], 0.42, 0.93, 1, h ? 0 : 0.8, d, 0, 1, 0, s); }
        B.n = v; gl.bindBuffer(gl.ARRAY_BUFFER, B.vbo); gl.bufferSubData(gl.ARRAY_BUFFER, 0, A, 0, v * STRIDE); this.wayDirty = false;
      }
      const k = this.wayT, fade = Math.min(1, (F.WAY_T - k) / 0.3, k / 0.8), O = this.wayO, L = Math.max(4, this.wayLen || 1);
      gl.bindVertexArray(B.vao);
      gl.uniform3f(p.u.u_offset, O[0] - cam.x, O[1] - cam.y, O[2] - cam.z); gl.uniform1f(p.u.u_scale, 1);
      gl.uniform4f(p.u.u_wave, (F.WAY_T - k) * 7, 2, 2.2, L + 0.01);
      // a faint x-ray pass (never lost behind a hill), the soft glow, the bright core
      gl.disable(gl.DEPTH_TEST); gl.uniform1f(p.u.u_width, 0.05); gl.uniform4f(p.u.u_tint, 0.5, 0.8, 1, 0.16 * fade); gl.drawArrays(gl.TRIANGLES, 0, B.rib);
      gl.enable(gl.DEPTH_TEST);
      gl.uniform1f(p.u.u_width, 0.17); gl.uniform4f(p.u.u_tint, 0.45, 0.85, 1, 0.24 * fade); gl.drawArrays(gl.TRIANGLES, 0, B.rib);
      gl.uniform1f(p.u.u_width, 0.045); gl.uniform4f(p.u.u_tint, 1.25, 1.25, 1.25, 1.0 * fade); gl.drawArrays(gl.TRIANGLES, 0, B.rib);
      // the pillar of light where the line reaches its target (plain, a soft glow up from the ground)
      if (B.n > B.rib) { gl.uniform4f(p.u.u_wave, 0, 0, 0, 0); gl.uniform1f(p.u.u_width, 0.35); gl.uniform4f(p.u.u_tint, 0.6, 0.95, 1, 0.5 * fade); gl.drawArrays(gl.TRIANGLES, B.rib, B.n - B.rib); }
      F.cost.draws += 3; this.g.renderer.stats.draws += B.n > B.rib ? 4 : 3;
    }
    drawScan(gl, p, cam, T0) {
      const list = this.scanData, nb = list.length, O = this.scanO, age = T0 - this.scanT0, R = this.scanR;
      if (this.scanDirty) {
        const B = GX.scan || (GX.scan = fxBuffer(gl, F.SCAN_MAX * 60));
        const A = GX.scanA || (GX.scanA = new Float32Array(F.SCAN_MAX * 60 * STRIDE));
        let v = 0;
        const FACE = [[0, 2, 6, 0, 6, 4], [1, 5, 7, 1, 7, 3], [0, 4, 5, 0, 5, 1], [2, 3, 7, 2, 7, 6], [0, 1, 3, 0, 3, 2], [4, 6, 7, 4, 7, 5]];
        const EDGE = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7];
        const cx = [0, 0, 0, 0, 0, 0, 0, 0], cy = cx.slice(), cz = cx.slice();
        // faces first (all boxes), then the edges
        for (let pass = 0; pass < 2; pass++) {
          if (pass === 1) this.scanFaces = v;
          for (const b of list) {
            const col = F.SCAN_COL[b.kind] || F.SCAN_COL.ore, e = 0.03, x0 = b.x - O[0] - e, y0 = b.y - O[1] - e, z0 = b.z - O[2] - e, x1 = x0 + 1 + 2 * e, y1 = y0 + 1 + 2 * e, z1 = z0 + 1 + 2 * e, d = Math.sqrt(b.d2);
            for (let i = 0; i < 8; i++) { cx[i] = i & 1 ? x1 : x0; cy[i] = i & 2 ? y1 : y0; cz[i] = i & 4 ? z1 : z0; }
            if (pass === 0) { for (const f of FACE) for (const i of f) vtx(A, v++, cx[i], cy[i], cz[i], col[0], col[1], col[2], b.k === 1 ? 0.26 : 0.16, d, 0, 0, 0, 0); }
            else for (const i of EDGE) vtx(A, v++, cx[i], cy[i], cz[i], col[0], col[1], col[2], 0.95, d, 0, 0, 0, 0);
          }
        }
        B.n = v; gl.bindBuffer(gl.ARRAY_BUFFER, B.vbo); gl.bufferSubData(gl.ARRAY_BUFFER, 0, A, 0, v * STRIDE); this.scanDirty = false;
      }
      const B = GX.scan; if (!B) return;
      const wave = Math.min(R + 4, age * F.SCAN_V), fade = Math.min(1, this.scanT / 1);
      gl.disable(gl.DEPTH_TEST);   // (x-ray: they glow through the ground)
      gl.uniform3f(p.u.u_offset, O[0] - cam.x, O[1] - cam.y, O[2] - cam.z); gl.uniform1f(p.u.u_scale, 1); gl.uniform1f(p.u.u_width, 0);
      gl.uniform4f(p.u.u_wave, wave, 1, 0, 0);
      if (nb) {
        gl.bindVertexArray(B.vao);
        gl.uniform4f(p.u.u_tint, 1, 1, 1, fade); gl.drawArrays(gl.TRIANGLES, 0, this.scanFaces);
        // (the edges blended over, not added: run 2's orange and cyan boxes read white on the bright cyan hall floor)
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.uniform4f(p.u.u_tint, 1.3, 1.3, 1.3, fade); gl.drawArrays(gl.LINES, this.scanFaces, B.n - this.scanFaces); gl.blendFunc(gl.ONE, gl.ONE);
        F.cost.draws += 2; this.g.renderer.stats.draws += 2;
      }
      // the wave's ring on the ground, running out and fading
      if (wave < R + 3) {
        const G = GX.ring || (GX.ring = (() => { const Bf = fxBuffer(gl, 64 * 6), A = new Float32Array(64 * 6 * STRIDE); let v = 0; for (let i = 0; i < 64; i++) { const a0 = i / 64 * TAU, a1 = (i + 1) / 64 * TAU, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1), tx = c1 - c0, tz = s1 - s0, tl = Math.hypot(tx, tz); for (const [c, s, side] of [[c0, s0, -1], [c0, s0, 1], [c1, s1, 1], [c0, s0, -1], [c1, s1, 1], [c1, s1, -1]]) vtx(A, v++, c, 0, s, 0.4, 0.95, 1, 1, 0, tx / tl, 0, tz / tl, side); } gl.bindBuffer(gl.ARRAY_BUFFER, Bf.vbo); gl.bufferSubData(gl.ARRAY_BUFFER, 0, A); Bf.n = v; return Bf; })());
        gl.enable(gl.DEPTH_TEST);
        gl.bindVertexArray(G.vao);
        gl.uniform3f(p.u.u_offset, O[0] - cam.x, O[1] + 0.15 - cam.y, O[2] - cam.z); gl.uniform1f(p.u.u_scale, Math.max(0.5, wave)); gl.uniform1f(p.u.u_width, 0.22);
        gl.uniform4f(p.u.u_wave, 0, 0, 0, 0); gl.uniform4f(p.u.u_tint, 1, 1, 1, 0.75 * (1 - wave / (R + 3)));
        gl.drawArrays(gl.TRIANGLES, 0, G.n);
        F.cost.draws++; this.g.renderer.stats.draws++;
      }
    }
    destroy() { this.endLine(); this.photoEnd(); this.scanJob = null; this.scanData = null; this.wayT = 0; this.scanT = 0; }
  }
  F.Actor = Actor;

  // ---------------------------------------------------------------- the public calls (e-ctx's V row, the chat, the menu)
  const act = (g) => { g = g || VR.game; return g && g.funke ? g.funke : null; };
  F.ask = (g) => { const a = act(g); return a ? a.ask() : false; };
  F.way = (g) => { const a = act(g); return a ? a.way(null, true) : false; };
  F.wow = (g) => { const a = act(g); return a ? a.wowAsk() : false; };
  F.scan = (g) => { const a = act(g); return a ? a.scan(true) : false; };
  F.photo = (g) => { const a = act(g); return a ? a.photo() : false; };
  F.mute = (g, on) => { const a = act(g); if (!a) return false; if (on === false) a.unmuteNow(); else a.muteNow(); return true; };
  F.muted = (g) => { const a = act(g); return !!(a && a.budget.muted((a.g.time) || 0)); };
  F.on = (g) => { const a = act(g); return !!(a && a.on()); };
  F.command = function (g, arg) {
    const w = String(arg || '').trim().toLowerCase(), say = (m) => g.ui && g.ui.chatLine && g.ui.chatLine(m, '#9af4ff');
    if (/^(an|on|wach)$/.test(w)) { if (g.settings) g.settings.funke = true; F.mute(g, false); return; }
    if (/^(aus|off)$/.test(w)) { if (g.settings) g.settings.funke = false; say(T('g.funke.off')); return; }
    if (!act(g) || !act(g).on()) { say(T('g.funke.off')); return; }
    if (/^(weg|way|wo)$/.test(w)) F.way(g);
    else if (/^(wow|was|next)$/.test(w)) F.wow(g);
    else if (w === 'scan') F.scan(g);
    else if (/^(foto|photo|bild)$/.test(w)) F.photo(g);
    else if (/^(ruhe|still|hush|quiet)$/.test(w)) F.mute(g);
    else say(T('g.funke.cmd'));
  };

  // ---------------------------------------------------------------- the switches (⚙ Spiel)
  if (VR.Settings && VR.Settings.add) {
    VR.Settings.add({ key: 'funke', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.funke', tip: 'g.set.funke.tip', cost: 'low', def: true });
    VR.Settings.add({ key: 'funkeQuiet', g: 'play', sec: 'play', t: 'action', lab: 'g.set.funkeQuiet', tip: 'g.set.funkeQuiet.tip', act: 'funkeQuiet' });
  }

  // ---------------------------------------------------------------- hooks from here (as photomode.js and first.js do)
  const G = VR.Game;
  if (G && G.prototype && !G.prototype._funke) {
    G.prototype._funke = true;
    const ls = G.prototype.lifeStart;
    if (ls) G.prototype.lifeStart = function () { const r = ls.apply(this, arguments); if (this.funke) this.funke.destroy(); this.funke = new Actor(this); return r; };
    const td = G.prototype.teardownWorld;
    if (td) G.prototype.teardownWorld = function () { if (this.funke) { this.funke.destroy(); this.funke = null; } return td.apply(this, arguments); };
    const ch = G.prototype.chat;
    if (ch) G.prototype.chat = function (text) { const m = /^\/funke\b\s*(.*)$/i.exec(String(text || '')); if (m) { F.command(this, m[1]); return; } return ch.apply(this, arguments); };
  }
  const U = VR.UI;
  if (U && U.prototype && U.prototype.settingsAct && !U.prototype._funke) {
    U.prototype._funke = true;
    const sa = U.prototype.settingsAct;
    U.prototype.settingsAct = function (name) { if (name === 'funkeQuiet') { F.mute(this.game); if (this.hint) this.hint(F.say('mute', null, 0), 2400); return; } return sa.apply(this, arguments); };
  }
  // the 🧭 hints as Funke's lines (Einfach): the box stays the record (done, dismissed, counted), Funke shows it
  const H = VR.Hints;
  if (H && H.show && !H._funke) {
    H._funke = true;
    const show0 = H.show;
    H.show = function (id, o) { const ok = show0.apply(this, arguments); if (ok) { const a = act(); if (a) a.relayHint(id, o); } return ok; };
    const re0 = H.retext;
    if (re0) H.retext = function (text) { const r = re0.apply(this, arguments); const a = act(); if (a) a.retextHint(text); return r; };
  }
})(VR);
