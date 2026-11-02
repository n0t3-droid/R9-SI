// ============================================================================
// Tiere zum Liebhaben (u-wild2; docs/superpowers/plans/2026-11-02-u-wild2.md) — the rules, with no game in them.
// The game glue is src/main/wildheart.js (VR.WildHeart). Our own designs; the science is real and written here:
//   · coat(seed, pattern) — an animal's coat as a Turing pattern: Young's (1984) cellular model of reaction–diffusion
//     (cells that are "coloured" activate their near neighbours and inhibit a ring further out; a few rounds settle
//     spots, stripes or dapples), on a 24×24 torus, deterministic by seed (no Math.random); one per individual, baked
//     once into its voxel colours (the game caches a few variants per kind)
//   · spring(s, target, w, z, dt) — a damped spring (ears and tails that swing after the body: secondary motion),
//     sub-stepped so it is stable at any frame time
//   · lineSlot / follow — a family walking in a line: each baby aims at a point a gap behind the one ahead of it
//   · react(kind, ctx) — what a wild animal does about you: graze, lift its head, come closer and sniff, peek, back off
//   · bonds — feeding builds trust (wild → curious → trusting: follows a while → friend: a companion or a visitor at
//     your door); the save format meta.wildBonds
//   · settle(ctx) — at dusk animals go to rest, in rain they shelter
// ============================================================================
(function (VR) {
  'use strict';
  const B = VR.WildBond = {};
  // the kinds this front looks after: temper (how it meets you), its coat, the foods it takes, family (mother + babies),
  // pet (it can become a 🐾 companion: src/shared/pets.js)
  B.KINDS = {
    glimmer_deer: { temper: 'shy', coat: 'spots', babyCoat: 'spots', food: ['apple', 'wheat', 'carrot'], family: true, base: [0xd8c8a0], dark: 0x8a6a42, light: 0xfff4dc, strength: 0.35, babyStrength: 0.85 },
    bloom_sheep: { temper: 'calm', coat: 'dapples', babyCoat: 'dapples', food: ['wheat', 'apple'], family: true, base: null, dark: 0xe6d6ea, light: 0xfffcff, strength: 0.5, babyStrength: 0.6 },
    moss_boar: { temper: 'calm', coat: 'stripes', babyCoat: 'stripes', food: ['carrot', 'potato', 'apple', 'beetroot'], family: true, base: null, dark: 0x3a3020, light: 0xb89a6a, strength: 0.3, babyStrength: 0.8 },
    glimmer_fox: { temper: 'curious', coat: 'dapples', babyCoat: 'dapples', food: ['glow_berries', 'sweet_berries'], pet: true, base: [0xe8782e], dark: 0xc2561e, light: 0xffb070, strength: 0.45, babyStrength: 0.5 },
    moss_cat: { temper: 'shy', coat: 'stripes', babyCoat: 'stripes', food: ['raw_cod'], pet: true, base: [0x3d4d30], dark: 0x26321e, light: 0x6a8048, strength: 0.6, babyStrength: 0.6 },
    crystal_pup: { temper: 'curious', coat: 'spots', babyCoat: 'spots', food: ['bone'], pet: true, base: [0xeaf6ff], dark: 0xa8d0f0, light: 0xffffff, strength: 0.5, babyStrength: 0.6 },
  };
  B.isKind = (k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(B.KINDS, k);
  B.VARIANTS = 4;               // coat variants per kind and age (cached models)
  B.N = 24;                     // the coat's grid (a torus)

  // ---------------------------------------------------------------- a seeded generator (mulberry32)
  B.rng = function (seed) {
    let s = seed | 0;
    return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };

  // ---------------------------------------------------------------- coats (Young's activator–inhibitor cells)
  // r1: the activating disc, r2: the inhibiting ring's outer edge, w: the ring's weight, p0: the share of coloured cells
  // at the start, ax/ay: the neighbourhood squeezed along x (stripes run along x)
  B.PATTERNS = {
    spots: { r1: 2.2, r2: 4.6, w: 0.30, p0: 0.2, ax: 1, ay: 1 },
    stripes: { r1: 2.0, r2: 4.2, w: 0.30, p0: 0.5, ax: 0.55, ay: 1 },
    dapples: { r1: 1.5, r2: 3.2, w: 0.55, p0: 0.3, ax: 1, ay: 1 },
  };
  const NB = {};
  const hood = (pat) => {
    if (NB[pat]) return NB[pat];
    const q = B.PATTERNS[pat], off = [], R = Math.ceil(q.r2 / Math.min(q.ax, q.ay));
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const d = Math.hypot(dx * q.ax, dy * q.ay);
      if (d <= q.r1) off.push(dx, dy, 1); else if (d <= q.r2) off.push(dx, dy, -q.w);
    }
    return (NB[pat] = off);
  };
  // → Uint8Array n×n, 0 (ground colour) … 255 (pattern colour), softened once (a 3×3 binomial blur)
  B.coat = function (seed, pat, n) {
    n = n || B.N;
    const q = B.PATTERNS[pat] || B.PATTERNS.spots, off = hood(B.PATTERNS[pat] ? pat : 'spots'), r = B.rng(seed), N = n * n;
    let c = new Uint8Array(N), c2 = new Uint8Array(N);
    for (let i = 0; i < N; i++) c[i] = r() < q.p0 ? 1 : 0;
    // (wrap tables instead of a modulo per neighbour: ~3× faster)
    const L = off.length / 3, ox = new Int32Array(L), oy = new Int32Array(L), ow = new Float32Array(L), wr = new Int32Array(n * 3);
    for (let k = 0; k < L; k++) { ox[k] = off[k * 3]; oy[k] = off[k * 3 + 1]; ow[k] = off[k * 3 + 2]; }
    for (let i = 0; i < n * 3; i++) wr[i] = i % n;
    for (let it = 0; it < 6; it++) {
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        let s = 0;
        for (let k = 0; k < L; k++) if (c[wr[y + oy[k] + n] * n + wr[x + ox[k] + n]]) s += ow[k];
        c2[y * n + x] = s > 0 ? 1 : s < 0 ? 0 : c[y * n + x];
      }
      const t = c; c = c2; c2 = t;
    }
    const o = new Uint8Array(N);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += c[((y + dy + n) % n) * n + (x + dx + n) % n] * (dx && dy ? 1 : dx || dy ? 2 : 4);
      o[y * n + x] = Math.round(s / 16 * 255);
    }
    return o;
  };
  // the coat of kind's variant v (0 … VARIANTS-1), adult or baby: {pat, tex, dark, light, k}
  B.coatSpec = function (kind, v, baby) {
    const K = B.KINDS[kind]; if (!K) return null;
    const pat = baby ? K.babyCoat : K.coat;
    const seed = (((kind.length * 7919) ^ (v * 104729)) + (baby ? 31337 : 0)) | 0;
    return { pat, tex: B.coat(seed + kind.charCodeAt(0) * 13, pat), dark: K.dark, light: K.light, k: baby ? K.babyStrength : K.strength };
  };
  // sample a coat at voxel (x, y, z): wrapped on the torus, the three axes folded so a body's sides and back both show it
  B.sample = (tex, x, y, z, n) => { n = n || B.N; const u = ((Math.round(z * 1.3 + x * 0.6) % n) + n) % n, v = ((Math.round(y * 1.5 + x * 0.9) % n) + n) % n; return tex[v * n + u]; };
  // a colour mixed toward the pattern's colour (dark spots on a light ground, or light flecks on a dark one)
  B.mix = (c, to, k) => {
    const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255, R = (to >> 16) & 255, G = (to >> 8) & 255, Bb = to & 255;
    return (Math.round(r + (R - r) * k) << 16) | (Math.round(g + (G - g) * k) << 8) | Math.round(b + (Bb - b) * k);
  };

  // ---------------------------------------------------------------- springs (secondary motion)
  // s = {x, v}; w: angular frequency (rad/s), z: damping ratio. Sub-stepped at ≤ 1/120 s: stable for any dt.
  B.spring = function (s, target, w, z, dt) {
    if (!(dt > 0)) return s.x;
    if (dt > 0.25) dt = 0.25;
    const n = Math.max(1, Math.ceil(dt * 120)), h = dt / n;
    for (let i = 0; i < n; i++) { const a = -w * w * (s.x - target) - 2 * z * w * s.v; s.v += a * h; s.x += s.v * h; }
    return s.x;
  };

  // ---------------------------------------------------------------- families: a line behind the mother
  // the point `gap` blocks behind a walker at (x, z) facing yaw (models face -z: forward = (-sin yaw, -cos yaw))
  B.lineSlot = (x, z, yaw, gap, out) => { out = out || [0, 0]; out[0] = x + Math.sin(yaw) * gap; out[1] = z + Math.cos(yaw) * gap; return out; };
  B.GAP = 0.9;                  // blocks between a baby and the one ahead of it
  // a baby's wish: [tx, tz, speedK] toward its slot; 0 speed when close (it stands and looks about)
  B.follow = function (me, ahead, aheadYaw, out) {
    out = out || [0, 0, 0];
    B.lineSlot(ahead[0], ahead[2], aheadYaw, B.GAP, out);
    const d = Math.hypot(out[0] - me[0], out[1] - me[2]);
    out[2] = d < 0.25 ? 0 : Math.min(1.8, 0.75 + d * 0.8);   // (faster the further behind: it keeps up with a walking mother)
    return out;
  };

  // ---------------------------------------------------------------- how a wild animal meets you
  // ctx: {d: blocks to you, speed: your speed (b/s), still: s you stood still, food: you hold its food, trust: 0 … 3,
  //       grazing: it was grazing}. → 'flee' | 'hide' | 'peek' | 'alert' | 'approach' | 'sniff' | 'none'
  B.NOTICE = 10; B.CURIOUS = 14; B.SNIFF = 1.9; B.SHY = 7;
  B.react = function (kind, c) {
    const K = B.KINDS[kind]; if (!K) return 'none';
    const t = c.trust | 0, fast = c.speed > 4.2, moving = c.speed > 1.2;
    if (c.d > B.CURIOUS + 2) return 'none';
    // food in your hand and you wait: every kind comes (a shy one later, a little slower: the game's speed)
    if (c.food && c.still >= (K.temper === 'shy' && t < 1 ? 2.5 : 1)) return c.d <= B.SNIFF ? 'sniff' : 'approach';
    if (t >= 2) return c.d <= B.SNIFF ? 'sniff' : moving ? 'none' : c.d < 5 ? 'approach' : 'none';
    if (fast && c.d < 6) return K.temper === 'calm' ? 'alert' : 'flee';
    if (K.temper === 'shy') {
      if (moving && c.d < B.SHY) return 'hide';
      if (!moving && c.d < B.CURIOUS) return c.still > 3 ? 'peek' : 'alert';
      return 'none';
    }
    if (K.temper === 'curious') {
      if (!moving && c.still >= 1.5) return c.d <= B.SNIFF ? 'sniff' : c.d < B.CURIOUS ? 'approach' : 'none';
      return moving && c.d < B.NOTICE ? 'alert' : 'none';
    }
    // calm grazers: they lift their heads as you pass and go on grazing
    return moving && c.d < B.NOTICE ? 'alert' : 'none';
  };

  // ---------------------------------------------------------------- dusk and rain
  // ctx: {night 0 … 1, rain 0 … 1} → 'rest' (at dusk, into a nest or a burrow) | 'shelter' (under a tree) | null
  B.settle = (c) => (c.night > 0.35 ? 'rest' : c.rain > 0.35 ? 'shelter' : null);

  // ---------------------------------------------------------------- bonds (trust by feeding)
  B.STATES = ['wild', 'curious', 'trusting', 'friend'];
  B.FEED_COOL = 4;              // s between two treats
  B.FOLLOW_S = 90;              // s a trusting animal follows you after a treat
  B.EAT_WAIT = 1.4;             // s it stands sniffing your hand before it eats
  B.bond = (kind, seed) => ({ kind, seed: seed | 0, fed: 0, lastFed: -1e9, followT: 0, state: 'wild' });
  B.levelOf = (fed) => (fed >= 3 ? 3 : fed >= 2 ? 2 : fed >= 1 ? 1 : 0);
  B.takes = (kind, item) => { const K = B.KINDS[kind]; return !!(K && item && K.food.indexOf(item) >= 0); };
  // a treat eaten at time now: true when it counted (not within FEED_COOL of the last)
  B.feed = function (b, now) {
    if (now - b.lastFed < B.FEED_COOL) return false;
    b.lastFed = now; b.fed++;
    const lv = B.levelOf(b.fed);
    b.state = B.STATES[lv];
    if (lv >= 2) b.followT = B.FOLLOW_S;
    return true;
  };
  B.tick = (b, dt) => { if (b.followT > 0) b.followT = Math.max(0, b.followT - dt); };
  B.follows = (b) => b.followT > 0;
  // a friend comes to your door: by day, you at home, nobody visiting, its time come
  B.VISIT_MIN = 240; B.VISIT_SPAN = 240; B.VISIT_STAY = 45;
  B.visitDue = (f, c) => !!(f && c.day && c.atHome && !c.visiting && c.now >= (f.nextVisit || 0));
  B.visited = (f, now, rnd) => { f.nextVisit = now + B.VISIT_MIN + (rnd === undefined ? 0.5 : rnd) * B.VISIT_SPAN; return f.nextVisit; };

  // ---------------------------------------------------------------- the save (meta.wildBonds): the friends only
  B.MAX = 6;
  B.serialize = function (list) {
    const out = [];
    if (!Array.isArray(list)) return out;
    for (const b of list) {
      if (out.length >= B.MAX) break;
      if (!b || !B.isKind(b.kind) || !(b.fed >= 3)) continue;
      out.push({ kind: b.kind, seed: b.seed | 0, fed: Math.min(99, b.fed | 0) });
    }
    return out;
  };
  B.deserialize = function (list) {
    const out = [];
    if (!Array.isArray(list)) return out;
    for (const r of list) {
      if (out.length >= B.MAX) break;
      if (!r || typeof r !== 'object' || !B.isKind(r.kind) || !Number.isFinite(r.fed) || r.fed < 3) continue;
      const b = B.bond(r.kind, Number.isFinite(r.seed) ? r.seed : 0);
      b.fed = Math.min(99, r.fed | 0); b.state = 'friend'; b.nextVisit = 0;
      out.push(b);
    }
    return out;
  };

  // how often an animal thinks about you (s): near often, far rarely; beyond 48 blocks not at all (Infinity)
  B.thinkEvery = (d2) => (d2 < 256 ? 0.25 : d2 < 1600 ? 0.6 : d2 < 2304 ? 1.5 : Infinity);
})(VR);
