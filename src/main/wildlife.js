// ============================================================================
// Die Tierwelt als Spektakel (t-wild, WOW VI; docs/superpowers/plans/2026-10-16-t-wild.md) — the game's actor. The
// owner: a peaceful world where „immer etwas los ist": nothing hunts, nothing is hostile, nothing here collides, can be
// hit or is saved. Five switches (⚙ Bild · Dinge & Effekte), the caps by tier in ONE table (wildsim.js Wild.CAPS); Very
// Low has every cap 0 and the switches off: update() returns at its first lines and nothing is drawn or compiled.
//   Vogelschwärme (wildBirds): the murmuration — 160–300 boids over the lake (or the land round you) from the golden
//     hour, folding and turning as one cloud, landing in a tree line for the night, rising at dawn and leaving (one
//     instanced draw); gulls wheeling over the lake by day; a heron at the pond's edge that takes off slowly when you
//     come within 8 blocks and lands further on
//   Fischschwärme (wildFish): shoals of 32–80 small fish under the pier and in the falls' pool (t-land's fish anchors)
//     and in the shallows near you — swirling, flashing as they turn into the sun, scattering from you; carp in the ponds
//   Falter & Libellen (wildBugs): a swarm of butterflies at home on a flower drift (found round you), visiting its
//     flowers, rising round you as you walk through; dragonflies hovering and darting over the ponds
//   Himmelsrochen (wildRays): three or four great sky rays on a slow circuit between the Sky Isles (wildsim.js: where
//     they are is a pure function of the world's clock — every guest sees them in the same place), a trail of light motes
//  f-wild2 (R50-10, docs/superpowers/plans/2026-10-23-f-wild2.md): the murmuration flies figures (ribbons, a waist, a
//    ball that splits) and is drawn as birds near and a density cloud far (drawCloud, the translucent pass); once a
//    dusk a young ray glides low past the player's cell (passUpd); the shoal swims close under the surface, comes to a
//    still player's shadow and flashes as it turns
//   Herden ziehen (wildHerds): the deer cross the meadow in a line at dawn and graze, the sheep drift as one herd
//     (landlife.js / entities.js ask Wild.lineTarget / herdTarget); rabbits at the field edges that bolt into the hedge;
//     a fox along the hedge at dusk (it never catches anything)
// ============================================================================
(function (VR) {
  'use strict';
  const W = VR.Wild, WG = VR.WildGPU, TAU = Math.PI * 2;
  if (!W || !WG) return;
  // the switches (this file loads after the settings registry): on by default, off on Very Low (game.js PRESETS)
  if (VR.Settings && VR.Settings.add) for (const k of W.KEYS) VR.Settings.add({ key: k, g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.' + k, tip: 'g.set.' + k + '.tip', cost: k === 'wildRays' || k === 'wildBirds' ? 'mid' : 'low', def: true });

  const sm = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  const yawOf = (dx, dz) => Math.atan2(-dx, -dz);
  const wrapA = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
  const lightOf = (w, x, y, z) => { if (!w || !w.getLight) return 1; return (w.getLight(Math.floor(x), Math.floor(y), Math.floor(z)) >>> 12) / 15; };
  // block kinds by state (built once from the registry)
  const FLOWER = /flower|tulip|poppy|dandelion|allium|bluet|cornflower|lavender|lilac|orchid|lily_of|rose|sunflower|peony|daisy|oxeye/;
  const NOT_PLANT = /pot|block|bouquet|crystal|lilacite|leaves|stem|sapling|petal|pillar/;
  let MASK = null;
  const mask = () => {
    if (MASK) return MASK;
    const R = VR.R, n = R.T.type.length, m = new Uint8Array(n);
    for (let s = 1; s < n; s++) {
      const ty = R.types[R.T.type[s]]; if (!ty) continue;
      const nm = ty.name, f = R.T.flags[s];
      if (FLOWER.test(nm) && !NOT_PLANT.test(nm) && !(f & VR.F.SOLID)) m[s] |= 1;   // a flower (a plant: never a rose-coloured wall)
      if (nm === 'grass_block') m[s] |= 2;                                    // grass ground
      if ((f & VR.F.LEAVES) || /^(bush|sweet_berry_bush)$/.test(nm)) m[s] |= 4;   // cover (a hedge, a bush)
      if (f & (VR.F.WATER | VR.F.WATERLOG)) m[s] |= 8;                        // water (and the seagrass standing in it)
      if (f & VR.F.LEAVES) m[s] |= 16;                                        // leaves (a tree's crown)
    }
    return (MASK = m);
  };

  // ---------------------------------------------------------------- the models (our own; VR.VOXMODELS, 1/16 block)
  const M = VR.VOXMODELS, Grid = VR.VoxGrid;
  if (M && Grid) {
    const part = (sx, sy, sz, pv, fn) => { const g = new Grid(sx, sy, sz, pv[0], pv[1], pv[2]); fn(g); return { grid: g, pivot: [0, 0, 0] }; };
    // the heron: a blue-grey back, a pale S-necked neck with a dark stripe, a white head with a black crest and plume, an
    // amber dagger bill, long legs; the wings broad plates with dark primaries (folded: hung down along the flanks)
    M.wild_heron = () => {
      const back = 0x7c8996, wingC = 0x8e9ba8, prim = 0x2e3640, pale = 0xd9dee3, white = 0xf0f2f4, crest = 0x16181e, bill = 0xe2a23a, leg = 0x9c8a5a, eye = 0xf0d040, stripe = 0x3a4048;
      const wing = (left) => part(17, 2, 11, left ? [16, 1, 5] : [0, 1, 5], (g) => {
        for (let i = 0; i < 17; i++) {
          const x = left ? 16 - i : i, ch = Math.round(5 - i * 0.12), back2 = i > 11 ? Math.round((i - 11) * 0.6) : 0;
          g.box(x, 0, 5 - ch, x, 0, 5 + ch - back2, (xx, y, z) => (i > 10 && z > 4 ? prim : z >= 5 + ch - 1 - back2 && i > 4 ? prim : wingC));
        }
      });
      return {
        h: 1.3, w: 0.35, radius: 2, parts: {
          body: part(8, 8, 17, [4, 4, 8], (g) => { g.ell(4, 4, 8, 3.6, 3.3, 7.8, (x, y, z) => (y <= 2 ? pale : z > 13 ? 0x5a6672 : back), { shade: 0.06 }); }),
          neck: part(3, 12, 7, [1, 0, 4], (g) => { for (let y = 0; y < 12; y++) { const z = Math.round(4 - 2.2 * Math.sin(y / 11 * Math.PI)); g.box(0, y, z, 1, y, z + 1, pale); if (y > 2 && y < 10) g.set(0, y, z, stripe); } }),
          head: part(4, 5, 13, [2, 1, 8], (g) => { g.box(1, 0, 6, 2, 2, 9, white); g.box(1, 3, 7, 2, 3, 10, crest); g.box(1, 3, 11, 1, 3, 12, crest); g.box(1, 1, 0, 2, 1, 5, bill); g.set(1, 0, 3, bill); g.set(0, 2, 6, eye); g.set(3, 2, 6, eye); }),
          wing_l: wing(true), wing_r: wing(false),
          legs: part(6, 13, 4, [3, 12, 1], (g) => { g.box(1, 0, 1, 1, 11, 1, leg); g.box(4, 0, 1, 4, 11, 1, leg); g.box(0, 0, 0, 2, 0, 3, leg); g.box(3, 0, 0, 5, 0, 3, leg); }),
        },
        layout: { body: [0, 15, 0], neck: [0, 18, -6], head: [0, 29, -6], wing_l: [-3, 18, 0], wing_r: [3, 18, 0], legs: [0, 12, 1] },
        rig: { head: ['neck', [0, 11, 0]] },
        order: ['body', 'neck', 'head', 'wing_l', 'wing_r', 'legs'],
        gait: 'none',
      };
    };
    // a rabbit: grey-brown, a pale belly, long ears with a pink inside, a white scut, big hind feet (the companions' joints)
    M.wild_rabbit = () => {
      const fur = 0x8b7558, fur2 = 0x6e5c46, belly = 0xd6c8b0, white = 0xf4f0ea, ear = 0xd09a90, eye = 0x15100c, nose = 0x4a3530;
      return {
        h: 0.45, w: 0.2, radius: 0.8, parts: {
          body: part(7, 7, 10, [3, 3, 5], (g) => g.ell(3.5, 3.2, 5, 3.2, 3.0, 4.6, (x, y, z) => (y <= 1 && z < 6 ? belly : (x + z) % 5 === 0 ? fur2 : fur), { shade: 0.08 })),
          head: part(5, 5, 6, [2, 1, 4], (g) => { g.ell(2.5, 2.2, 3, 2.2, 2.0, 2.6, fur, { shade: 0.06 }); g.set(0, 3, 2, eye); g.set(4, 3, 2, eye); g.set(2, 1, 0, nose); }),
          ear_l: part(2, 6, 2, [1, 0, 1], (g) => { g.box(0, 0, 0, 1, 5, 1, fur); g.box(1, 1, 0, 1, 4, 0, ear); }),
          ear_r: part(2, 6, 2, [1, 0, 1], (g) => { g.box(0, 0, 0, 1, 5, 1, fur); g.box(0, 1, 0, 0, 4, 0, ear); }),
          tail: part(3, 3, 3, [1, 1, 0], (g) => g.ell(1.5, 1.5, 1.5, 1.45, 1.45, 1.45, white)),
          leg_fl: part(2, 3, 2, [1, 3, 1], (g) => g.box(0, 0, 0, 1, 2, 1, fur)), leg_fr: part(2, 3, 2, [1, 3, 1], (g) => g.box(0, 0, 0, 1, 2, 1, fur)),
          leg_bl: part(2, 3, 4, [1, 3, 1], (g) => g.box(0, 0, 0, 1, 2, 3, fur2)), leg_br: part(2, 3, 4, [1, 3, 1], (g) => g.box(0, 0, 0, 1, 2, 3, fur2)),
        },
        layout: { body: [0, 3.5, 0], head: [0, 6.5, -4.5], ear_l: [-1, 8.5, -4], ear_r: [1, 8.5, -4], tail: [0, 5, 4.6], leg_fl: [-1.5, 3, -3], leg_fr: [1.5, 3, -3], leg_bl: [-2, 3, 2], leg_br: [2, 3, 2] },
        gait: 'quad',
      };
    };
    // the fox: a red-orange coat, a cream chest and cheeks, black socks and ear tips, a bushy tail with a white tip
    M.wild_fox = () => {
      const fur = 0xd2602a, fur2 = 0xa8481e, cream = 0xf2e8d8, leg = 0x2a1e18, paw = 0x1a120e, nose = 0x141010, eye = 0x2a1a08, tipC = 0xf4f0ea;
      const tail = part(7, 7, 16, [3, 3, 0], (g) => { g.ell(3, 3, 7, 2.8, 2.8, 6.6, (x, y, z) => (z > 12 ? tipC : y <= 1 ? cream : fur), { shade: 0.06 }); });
      return {
        h: 0.72, w: 0.3, radius: 1.2, parts: {
          body: part(9, 7, 14, [4, 3, 7], (g) => { g.ell(4, 3, 7, 3.5, 2.9, 6.2, (x, y, z) => (y <= 1 && z <= 5 ? cream : fur), { shade: 0.08 }); }),
          head: part(9, 8, 12, [4, 3, 7], (g) => {
            g.ell(4, 3, 7, 3.3, 2.9, 3.2, (x, y, z) => (y <= 2 && z <= 6 ? cream : fur), { shade: 0.06 });
            g.box(3, 2, 1, 5, 3, 4, (x, y) => (y <= 2 ? cream : fur)); g.set(4, 3, 1, nose); g.set(2, 4, 4, eye); g.set(6, 4, 4, eye);
          }),
          ear_l: part(3, 4, 2, [1, 0, 1], (g) => { g.box(0, 0, 0, 2, 1, 1, fur); g.box(0, 2, 0, 2, 2, 1, fur2); g.box(1, 3, 0, 1, 3, 0, leg); }),
          ear_r: part(3, 4, 2, [1, 0, 1], (g) => { g.box(0, 0, 0, 2, 1, 1, fur); g.box(0, 2, 0, 2, 2, 1, fur2); g.box(1, 3, 0, 1, 3, 0, leg); }),
          tail,
          leg_fl: part(3, 6, 3, [1, 6, 1], (g) => { g.box(0, 0, 0, 1, 5, 1, (x, y) => (y < 4 ? leg : fur)); g.box(0, 0, 0, 1, 0, 1, paw); }),
          leg_fr: part(3, 6, 3, [1, 6, 1], (g) => { g.box(0, 0, 0, 1, 5, 1, (x, y) => (y < 4 ? leg : fur)); g.box(0, 0, 0, 1, 0, 1, paw); }),
          leg_bl: part(3, 6, 3, [1, 6, 1], (g) => { g.box(0, 0, 0, 1, 5, 1, (x, y) => (y < 4 ? leg : fur)); g.box(0, 0, 0, 1, 0, 1, paw); }),
          leg_br: part(3, 6, 3, [1, 6, 1], (g) => { g.box(0, 0, 0, 1, 5, 1, (x, y) => (y < 4 ? leg : fur)); g.box(0, 0, 0, 1, 0, 1, paw); }),
        },
        layout: { body: [0, 7, 0], head: [0, 10, -7], ear_l: [-1.6, 12.6, -6.5], ear_r: [1.6, 12.6, -6.5], tail: [0, 7.5, 5.8], leg_fl: [-2, 6, -3.5], leg_fr: [2, 6, -3.5], leg_bl: [-2, 6, 3.5], leg_br: [2, 6, 3.5] },
        gait: 'quad',
      };
    };
  }

  // ---------------------------------------------------------------- the herds' paths (landlife.js and entities.js ask)
  // is the herds' piece on for this game (the switch on, Low and up)
  W.herdsOn = (g) => !!(g && g.settings && g.settings.wildHerds && W.CAPS.deerLine[W.tierOf(g.settings)] > 0);
  // the deer's line at dawn: from a wood's edge (the anchor) out into the most open direction — 16 directions scored by
  // the open, walkable ground (grass under air, no step over a block, no crown within 2) out to 26 blocks. → {pts:
  // [[x, z]], L, s, gap, speed, n, done}, null (no 12 blocks of open ground) or undefined (columns on the way have not
  // come yet: ask again — run 2's deer asked right after the eye arrived, got "no way" and kept it); final: answer with
  // what there is (the columns out of reach may never come)
  W.deerPath = function (w, A, seed, final) {
    if (!w || !w.topAt || !w.isLoaded) return null;
    const MK = mask(), get = (x, y, z) => w.getBlock(x, y, z);
    let best = null, waiting = false;
    for (let k = 0; k < 16; k++) {
      const a = (k + W.h(seed, A.x, A.z) * 0.9) / 16 * TAU, dx = Math.cos(a), dz = Math.sin(a), pts = [];
      let y0 = w.topAt(Math.floor(A.x), Math.floor(A.z)), ok = 0;
      for (let d = 2; d <= 26; d += 2) {
        const x = Math.floor(A.x + 0.5 + dx * d), z = Math.floor(A.z + 0.5 + dz * d);
        if (!w.isLoaded(x, z)) { waiting = true; break; }
        const y = w.topAt(x, z), b = get(x, y, z);
        if (!(MK[b] & 2) || Math.abs(y - y0) > 1) break;
        let crown = false; for (let q = -2; q <= 2 && !crown; q += 2) for (let r = -2; r <= 2 && !crown; r += 2) if (MK[get(x + q, w.topAt(x + q, z + r), z + r)] & 16) crown = true;
        if (crown && d > 6) break;
        pts.push([x + 0.5, z + 0.5]); y0 = y; ok = d;
      }
      if (ok >= 12 && (!best || ok > best.ok)) best = { ok, pts };
    }
    if (waiting && !final) return undefined;
    if (!best) return null;
    const pts = [[A.x + 0.5, A.z + 0.5]].concat(best.pts), s = [0];
    for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, s: s, L: s[s.length - 1], at: 0, gap: 2.3, speed: 1.15, n: 0, done: false, lag: 0 };
  };
  // the point d along a line path: out = [x, z]
  W.linePoint = function (L, d, out) {
    const P = L.pts, S = L.s; d = Math.max(0, Math.min(L.L, d));
    let i = 1; while (i < P.length - 1 && S[i] < d) i++;
    const u = (d - S[i - 1]) / ((S[i] - S[i - 1]) || 1e-6);
    out[0] = P[i - 1][0] + (P[i][0] - P[i - 1][0]) * u; out[1] = P[i - 1][1] + (P[i][1] - P[i - 1][1]) * u;
    return out;
  };
  // a deer in the line: its slot is gap × its place behind the leader; the leader walks on while the last keeps up
  // (entities.js: the target of its walk; null when the line is done — then it grazes at the end)
  W.lineTarget = function (m, dt) {
    const L = m.line; if (!L || L.done) return null;
    const o = m.lt || (m.lt = [0, 0]);
    W.linePoint(L, L.at - m.li * L.gap, o);
    const d = Math.hypot(m.pos[0] - o[0], m.pos[2] - o[1]);
    if (m.li === 0) { if (d < 1.6 && L.lag < 3.5) L.at = Math.min(L.L + L.gap * L.n, L.at + dt * L.speed); }
    if (m.li === L.n - 1) L.lag = d;
    if (L.at >= L.L + L.gap * (L.n - 1) - 0.01) { L.done = true; return null; }
    return o;
  };
  // a sheep of a drifting herd: a spot round the herd's point (its own slot on a ring, a little of its own wander)
  W.herdTarget = function (m) {
    const H = m.herd; if (!H) return null;
    const o = m.ht || (m.ht = [0, 0]), k = (m.hk === undefined ? (m.hk = (m.id * 0.618) % 1) : m.hk);
    const a = k * TAU + Math.sin(H.t * 0.05 + m.id) * 0.6, r = (m.rest ? 0.9 : 1.6) + k * (m.rest ? 0.8 : 2.2);
    o[0] = H.x + Math.cos(a) * r; o[1] = H.z + Math.sin(a) * r;
    return o;
  };
  // the herd's point drifts inside its pasture: toward a seeded spot of the box, 0.25 blocks a second, a new one when there
  W.herdStep = function (H, box, seed, dt) {
    H.t = (H.t || 0) + dt;
    if (H.tx === undefined || Math.hypot(H.tx - H.x, H.tz - H.z) < 0.6) {
      H.k = (H.k || 0) + 1;
      H.tx = box[0] + 1.5 + W.h(seed, H.k, 1) * Math.max(0, box[2] - box[0] - 2);
      H.tz = box[1] + 1.5 + W.h(seed, H.k, 2) * Math.max(0, box[3] - box[1] - 2);
    }
    const dx = H.tx - H.x, dz = H.tz - H.z, d = Math.hypot(dx, dz) || 1, st = Math.min(d, 0.25 * dt);
    H.x += dx / d * st; H.z += dz / d * st;
    return H;
  };

  // ---------------------------------------------------------------- the actor
  const RAYCOL = [[0.32, 0.85, 1.0], [0.72, 0.5, 1.0]], MOTECOL = [[0.5, 0.95, 1.0], [0.82, 0.62, 1.0]];
  const TKEY = []; for (let k = 0; k < 8; k++) TKEY.push('wray' + (k >> 1) + (k & 1 ? 'r' : 'l'));
  const KINDCAP = { flock: 900, gull: 16, fish: 340, carp: 64, bfly: 128, dfly: 64, ray: 8 };   // (f-wild2: the murmuration's 840 boids on Ultra)
  const PIECES = ['birds', 'fish', 'bugs', 'rays', 'herds'];
  class Actor {
    constructor(game) {
      this.g = game; this.b = { tier: 0, cap: {} }; this.on = false; this.live = false;
      this.seed = ((((game.meta && game.meta.seed) | 0) ^ 0x7a11d) >>> 0) || 1;
      this.clock = null; this.time = 0;
      this.murm = null; this.gulls = []; this.herons = []; this.shoals = []; this.carps = []; this.swarms = []; this.dflies = []; this.rabbits = []; this.fox = null;
      this.scan = { at: null, i: 0, flowers: new Map(), cover: [], done: false, t: 0 };
      this.loop = null; this.rayAcc = [0, 0, 0, 0]; this.rays = []; this.rs = [0, 0, 0, 0, 0, 0, 0, 0];
      this.anchors = { t: 0, fish: [], duck: [] };
      this.list = []; this.cam = null;
      this.stats = { ms: {}, avg: {}, draws: 0, drawMs: 0, n: {} };
      for (const k of PIECES) { this.stats.ms[k] = 0; this.stats.avg[k] = 0; }
    }
    destroy() { this.reset(); if (this.g.airLife) this.g.airLife.noButterflies = false; }
    reset() { this.murm = null; this.gulls.length = 0; this.herons.length = 0; this.shoals.length = 0; this.carps.length = 0; this.swarms.length = 0; this.dflies.length = 0; this.rabbits.length = 0; this.fox = null; this.foxT = 0; this.live = false; }
    // the world's clock (s): the world time at the start, then real seconds; again from the world when the two part (a
    // time set by hand) — the rays are where this clock says (the same for host and guests)
    tick(dt) {
      const E = this.g.env, ws = E ? ((E.day || 0) * 24000 + (E.ticks || 0)) / 20 : 0;
      if (this.clock === null || (!this.g.zenFreezeTime && Math.abs(ws - this.clock) > 30)) this.clock = ws;
      else this.clock += dt;
      return this.clock;
    }
    // t-land's anchors (landlife.js: the fish places, the ponds' ducks), once a second
    anchorList() {
      const L = this.g.entities && this.g.entities.land, A = this.anchors;
      if (this.time - A.t < 1 && A.t > 0) return A;
      A.t = this.time; A.fish.length = 0; A.duck.length = 0;
      if (L && L.anchors) for (const a of L.anchors.values()) { if (a.kind === 'fish') A.fish.push(a); else if (a.kind === 'duck') A.duck.push(a); }
      return A;
    }
    // the water's surface near (x, y0, z): the top water block's y + 0.88, its depth (blocks), or null
    surface(x, z, y0) {
      const w = this.g.world, MK = mask(), X = Math.floor(x), Z = Math.floor(z);
      if (!w.isLoaded(X, Z)) return null;
      for (let y = Math.floor(y0) + 3; y > y0 - 6; y--) {
        if (!(MK[w.getBlock(X, y, Z)] & 8) || (MK[w.getBlock(X, y + 1, Z)] & 8)) continue;
        let d = 1; while (d < 12 && (MK[w.getBlock(X, y - d, Z)] & 8)) d++;
        return { y: y + 0.88, depth: d, top: y };
      }
      return null;
    }
    // a disc of water round (x, z) for a shoal: its radius — out to where (≤ rMax) at least 14 of 16 directions still meet
    // the same water (a pier's posts are a column or two: the fish swim round them, they do not end the water) — and the
    // band under the surface and over the bottom → {x, z, r, y0, y1, surf, sky} or null
    waterDisc(x, z, y0, rMax, minDepth) {
      const S = this.surface(x, z, y0); if (!S || S.depth < (minDepth || 1)) return null;
      let r = 0.9;
      for (let d = 1.5; d <= rMax + 0.01; d += 0.75) {
        let ok = 0;
        for (let k = 0; k < 16 && ok + 16 - k >= 14; k++) { const a = k / 16 * TAU, s2 = this.surface(x + Math.cos(a) * d, z + Math.sin(a) * d, S.top); if (s2 && s2.top === S.top && s2.depth >= 1) ok++; }
        if (ok < 14) break;
        r = d;
      }
      r -= 0.3;
      if (r < 1.6) return null;
      // (f-wild2: close under the surface, 0.15–1.1 — where the eye on the pier and the shore sees them)
      const bottom = S.top - S.depth + 1, y1 = S.y - 0.15, y0b = Math.max(bottom + 0.25, S.y - 1.1);
      return { x, z, r, y0: Math.min(y0b, y1 - 0.4), y1, surf: S.y, top: S.top, bottom, sky: Math.max(0.35, lightOf(this.g.world, x, S.top + 1, z)) };
    }
    update(dt) {
      const g = this.g, S = g.settings || {};
      W.budget(S, this.b);
      this.on = g.state === 'play' && (g.dim || 'overworld') === 'overworld' && !!g.world && !!g.player && W.any(this.b);
      if (!this.on) { if (this.live) this.reset(); if (g.airLife && g.airLife.noButterflies) g.airLife.noButterflies = false; return; }
      if (!(dt > 0)) return;
      dt = Math.min(dt, 0.1);
      this.live = true; this.time += dt;
      const clock = this.tick(dt), E = (g.env && g.env.E) || {}, tod = g.env ? g.env.timeOfDay : 6000, day = g.env ? (g.env.day | 0) : 0;
      const p = g.player.pos, eye = this.eye || (this.eye = [0, 0, 0]); eye[0] = p[0]; eye[1] = p[1] + 1.62; eye[2] = p[2];
      const sc = W.sched(this.seed, day, tod), wet = (E.rain || 0) > 0.15 || (E.snow || 0) > 0.15, cap = this.b.cap;
      const ctx = this.ctx || (this.ctx = {});
      ctx.clock = clock; ctx.tod = tod; ctx.day = day; ctx.sc = sc; ctx.wet = wet; ctx.E = E; ctx.eye = eye;
      // (walking: the player's speed, or how far the eye went since the last frame — a step taken however it was taken)
      const lp = this.lastP || (this.lastP = [p[0], p[1], p[2]]), moved = Math.hypot(p[0] - lp[0], p[2] - lp[2]) / dt;
      lp[0] = p[0]; lp[1] = p[1]; lp[2] = p[2];
      ctx.speed = Math.max(Math.hypot(g.player.vel ? g.player.vel[0] : 0, g.player.vel ? g.player.vel[2] : 0), moved < 60 ? moved : 0);
      ctx.moving = ctx.speed > 1.2;
      if (g.airLife) g.airLife.noButterflies = cap.bfly > 0;   // (the swarm takes over from the living air's butterfly dots)
      const T = this.stats.ms, A = this.stats.avg;
      let t0 = performance.now(), t1;
      this.updBirds(dt, ctx, cap); t1 = performance.now(); T.birds = t1 - t0; t0 = t1;
      this.updFish(dt, ctx, cap); t1 = performance.now(); T.fish = t1 - t0; t0 = t1;
      this.updBugs(dt, ctx, cap); t1 = performance.now(); T.bugs = t1 - t0; t0 = t1;
      this.updRays(dt, ctx, cap); t1 = performance.now(); T.rays = t1 - t0; t0 = t1;
      this.updHerds(dt, ctx, cap); t1 = performance.now(); T.herds = t1 - t0;
      for (const k of PIECES) A[k] = A[k] * 0.95 + T[k] * 0.05;
    }

    // ================================================================ the birds
    updBirds(dt, ctx, cap) {
      this.updMurm(dt, ctx, cap.murm);
      this.updGulls(dt, ctx, cap.gull);
      this.updHerons(dt, ctx, cap.heron);
    }
    // the murmuration: dusk → swirl, roost (land in the tree line), perch (the night), rise (dawn), leave. Its state: 'fly'
    // (stepped and drawn), 'seated' (on the perches: drawn within 90, nothing stepped), 'away' (gone: nothing)
    updMurm(dt, ctx, n) {
      const g = this.g, ph = W.murmPhase(ctx.tod);
      if (!n || ph === 'off' || ctx.wet) { this.murm = null; return; }
      // the cycle: the dusk of a day and the dawn after it are one flock (after midnight it is still yesterday's)
      const t = ctx.tod, key = (t < 2000 ? ctx.day - 1 : ctx.day);
      let Mu = this.murm;
      if (Mu && (Mu.key !== key || Mu.n !== n)) Mu = this.murm = null;
      if (!Mu) {
        const L = VR.Land && VR.Land.LAKE, heart = !!(g.meta && (g.meta.vgen | 0) >= 3 && g.meta.type !== 'flat');
        const nearLake = !!(heart && L && Math.hypot(ctx.eye[0] - L.x, ctx.eye[2] - L.z) < 450);
        const st = W.stageOf(this.seed, key, 'dusk', ctx.eye, nearLake);
        if (st.y === null) { const w = g.world, X = Math.floor(st.x), Z = Math.floor(st.z); st.y = (w.isLoaded(X, Z) ? w.topAt(X, Z) : ctx.eye[1] - 1.6) + 40; }
        if (Math.hypot(st.x - ctx.eye[0], st.z - ctx.eye[2]) > 700) return;
        const fl = new W.Flock(n, (W.h(this.seed, key, 0x6b) * 4294967295) >>> 0);
        // (f-wild2: each bird its own place in the murmuration's figures — W.murmTargets fills the offsets while it swirls)
        Mu = this.murm = { key, n, st, fl, S: W.murmPlaces(n), bofs: new Float32Array(n * 3), perch: null, roost: null, roostScan: null, noRoost: false, landed: new Uint8Array(n), acc: 0, ex: 0, ph, state: 'away', t: 0 };
        if (ph !== 'perch') this.murmIn(Mu, ctx);
      }
      const fl = Mu.fl;
      Mu.ph = ph; Mu.t += dt;
      if (Math.hypot(Mu.st.x - ctx.eye[0], Mu.st.z - ctx.eye[2]) > 900) { this.murm = null; return; }
      // the roost: a tree line near the stage (leaf-topped columns), found over a few frames from the end of the swirl
      if ((ph === 'roost' || ph === 'perch' || (ph === 'swirl' && t > 12600)) && !Mu.perch && !Mu.noRoost) this.findRoost(Mu);
      if (ph === 'perch') {
        if (Mu.state !== 'seated' && Mu.perch) this.murmSeat(Mu);
        else if (Mu.state === 'fly' && Mu.noRoost) Mu.state = 'away';   // (no tree line: they flew on)
        return;
      }
      if (ph === 'swirl' || ph === 'rise') {
        if (Mu.state === 'seated') { Mu.state = 'fly'; for (let i = 0; i < n; i++) { Mu.landed[i] = 0; fl.vel[i * 3 + 1] = 3 + (i % 5); } }
        else if (Mu.state === 'away') this.murmIn(Mu, ctx);
      }
      if (Mu.state !== 'fly') return;
      // the target: the seeded loop round the stage; roosting the tree line (or far off when there is none); leaving far off
      const tg = fl.tgt, swirl = ph === 'swirl' || ph === 'rise';
      // (the lobes: the cloud parts into wings and folds back while it swirls; roosting and leaving it holds together)
      if (fl.lofs) { if (swirl) W.murmLobes(this.seed ^ Mu.key, ctx.clock, fl.lobes, fl.P.lobeR || 30, fl.lofs); else fl.lofs.fill(0); }
      // (f-wild2: swirling, the birds fly the figures — ribbons, a waist, a ball that splits; roosting and leaving the
      //  flock holds together round its target)
      fl.bofs = swirl ? Mu.bofs : null;
      if (swirl) { W.murmTarget(this.seed ^ Mu.key, ctx.clock, Mu.st, tg); W.murmTargets(this.seed ^ Mu.key, ctx.clock, Mu.S, n, Mu.bofs, tg); }
      else if (ph === 'roost' && Mu.perch) { tg[0] = Mu.roost[0]; tg[1] = Mu.roost[1] + 6; tg[2] = Mu.roost[2]; }
      else { const a = W.h(this.seed, Mu.key, 9) * TAU; tg[0] = Mu.st.x + Math.cos(a) * 500; tg[1] = Mu.st.y + 30; tg[2] = Mu.st.z + Math.sin(a) * 500; if ((Mu.leaveT = (Mu.leaveT || 0) + dt) > 70) { Mu.state = 'away'; Mu.leaveT = 0; return; } }
      // the step: 30 times a second near, 20 from afar (W.MURM_HZ, f-wild2: 2.4× the boids in t-wild's CPU); the draw
      // extrapolates in between
      Mu.acc += dt;
      const h = Math.hypot(fl.ctr[0] - ctx.eye[0], fl.ctr[2] - ctx.eye[2]) > W.MURM_FAR ? 1 / W.MURM_HZ[1] : 1 / W.MURM_HZ[0];
      if (Mu.acc >= h) {
        const st = Math.min(Mu.acc, 0.1); Mu.acc = 0;
        fl.step(st);
        if (ph === 'roost' && Mu.perch) {
          // each bird sinks to its perch on the tree line: the pull grows over the roost's hour; arrived, it sits
          const k = sm((ctx.tod - 13400) / 700), pull = Math.min(1, st * (0.6 + 5 * k)), P = Mu.perch;
          let all = true;
          for (let i = 0; i < n; i++) {
            const o = i * 3;
            if (Mu.landed[i]) { fl.pos[o] = P[o]; fl.pos[o + 1] = P[o + 1]; fl.pos[o + 2] = P[o + 2]; fl.vel[o] = fl.vel[o + 1] = fl.vel[o + 2] = 0; continue; }
            all = false;
            const dx = P[o] - fl.pos[o], dy = P[o + 1] - fl.pos[o + 1], dz = P[o + 2] - fl.pos[o + 2], dd = Math.hypot(dx, dy, dz);
            if (k > 0.15 && dd < 2.5) { Mu.landed[i] = 1; continue; }
            if (k > 0.05) { fl.pos[o] += dx * pull * k; fl.pos[o + 1] += dy * pull * k; fl.pos[o + 2] += dz * pull * k; }
          }
          if (all) Mu.state = 'seated';
        }
      }
      Mu.ex = Mu.acc;
    }
    // the flock comes in from afar: a stream from the side of the stage away from the eye
    murmIn(Mu, ctx) {
      const st = Mu.st, ax = st.x - ctx.eye[0], az = st.z - ctx.eye[2], al = Math.hypot(ax, az) || 1;
      Mu.fl.place(st.x + ax / al * 140, st.y + 10, st.z + az / al * 140, 16);
      Mu.landed.fill(0); Mu.state = 'fly'; Mu.acc = 0; Mu.ex = 0;
    }
    // every bird on its perch (the night)
    murmSeat(Mu) {
      const fl = Mu.fl, P = Mu.perch;
      for (let i = 0; i < Mu.n; i++) { fl.pos[i * 3] = P[i * 3]; fl.pos[i * 3 + 1] = P[i * 3 + 1]; fl.pos[i * 3 + 2] = P[i * 3 + 2]; fl.vel[i * 3] = fl.vel[i * 3 + 1] = fl.vel[i * 3 + 2] = 0; Mu.landed[i] = 1; }
      Mu.state = 'seated'; Mu.ex = 0;
    }
    // the roost: the nearest tree line to the stage — rings round it (16 … 200 blocks out, a sample every 3 blocks, ~240 a
    // frame) until one meets six crowns within an eighth of the circle; then the crowns round their middle (a 2-block
    // grid, ±16) are the perches: one for each bird, on the leaves' tops
    findRoost(Mu) {
      const w = this.g.world, MK = mask(), st = Mu.st;
      const S = Mu.roostScan || (Mu.roostScan = { r: 16, k: 0, hits: [], local: null, li: 0 });
      let budget = 240;
      const leafTop = (x, z) => { if (!w.isLoaded(x, z)) return -1; const y = w.topAt(x, z); return (MK[w.getBlock(x, y, z)] & 16) ? y : -1; };
      while (budget > 0) {
        if (S.local) {   // the dense scan round a candidate
          const L = S.local, N = 17;
          for (; budget > 0 && L.i < N * N; budget--, L.i++) { const x = Math.floor(L.x) + ((L.i % N) - 8) * 2, z = Math.floor(L.z) + (Math.floor(L.i / N) - 8) * 2, y = leafTop(x, z); if (y >= 0) L.tops.push(x + 0.5, y + 1.05, z + 0.5); }
          if (L.i < N * N) return;
          if (L.tops.length >= 24) { this.seatPerches(Mu, L.tops); return; }
          S.local = null;
          continue;
        }
        if (S.r > 200) { Mu.noRoost = true; return; }
        const n = Math.max(24, Math.ceil(TAU * S.r / 3));
        for (; budget > 0 && S.k < n; budget--, S.k++) { const a = S.k / n * TAU, x = Math.floor(st.x + Math.cos(a) * S.r), z = Math.floor(st.z + Math.sin(a) * S.r), y = leafTop(x, z); if (y >= 0) S.hits.push(a, x, z); }
        if (S.k < n) return;
        // the ring is done: the best eighth of it
        let best = null, bn = 0;
        for (let i = 0; i < S.hits.length; i += 3) {
          let c = 0, sx = 0, sz = 0;
          for (let j = 0; j < S.hits.length; j += 3) { let d = Math.abs(S.hits[j] - S.hits[i]); if (d > Math.PI) d = TAU - d; if (d < TAU / 16) { c++; sx += S.hits[j + 1]; sz += S.hits[j + 2]; } }
          if (c > bn) { bn = c; best = [sx / c, sz / c]; }
        }
        S.hits.length = 0; S.k = 0; S.r += 6;
        if (best && bn >= 6) S.local = { x: best[0], z: best[1], i: 0, tops: [] };
      }
    }
    seatPerches(Mu, tops) {
      const n = Mu.n, P = new Float32Array(n * 3), m = tops.length / 3;
      let cx = 0, cy = 0, cz = 0;
      for (let i = 0; i < n; i++) { const j = (i % m) * 3, sp = Math.floor(i / m); P[i * 3] = tops[j] + (W.h(i, sp, 3) - 0.5) * 0.8; P[i * 3 + 1] = tops[j + 1] + W.h(i, sp, 4) * 0.25; P[i * 3 + 2] = tops[j + 2] + (W.h(i, sp, 5) - 0.5) * 0.8; cx += P[i * 3]; cy += P[i * 3 + 1]; cz += P[i * 3 + 2]; }
      Mu.perch = P; Mu.roost = [cx / n, cy / n, cz / n];
    }
    // gulls: by day over the lake (or the sea-level water round the eye) — wheeling circles, long glides, a few beats
    updGulls(dt, ctx, n) {
      const g = this.g, L = VR.Land && VR.Land.LAKE, SEA = (VR.C && VR.C.SEA) || 63;
      if (!n || !ctx.sc.gulls || ctx.wet) { this.gulls.length = 0; return; }
      const heart = !!(g.meta && (g.meta.vgen | 0) >= 3 && g.meta.type !== 'flat');
      let cx = null, cz = null;
      if (heart && L && Math.hypot(ctx.eye[0] - L.x, ctx.eye[2] - L.z) < 330) { cx = L.x; cz = L.z; }
      else if ((this.seaT = (this.seaT || 0) - dt) <= 0) {
        this.seaT = 3; this.sea = null;
        const w = g.world, MK = mask();
        for (let k = 0; k < 12 && !this.sea; k++) { const a = k / 12 * TAU, x = Math.floor(ctx.eye[0] + Math.cos(a) * 20), z = Math.floor(ctx.eye[2] + Math.sin(a) * 20); if (!w.isLoaded(x, z)) continue; const y = w.topAt(x, z); if (y <= SEA && (MK[w.getBlock(x, y, z)] & 8)) this.sea = [x, z]; }
      }
      if (cx === null && this.sea) { cx = this.sea[0]; cz = this.sea[1]; }
      if (cx === null) { this.gulls.length = 0; return; }
      const G = this.gulls;
      while (G.length > n) G.pop();
      while (G.length < n) {
        const i = G.length, h = (k) => W.h(this.seed, i, 0x9a + k);
        const lake = heart && L && cx === L.x;
        G.push({ i, ox: (h(1) - 0.5) * (lake ? 150 : 60), oz: (h(2) - 0.5) * (lake ? 110 : 60), R: 9 + h(3) * 16, y: SEA + 12 + h(4) * 20, w: (h(5) < 0.5 ? -1 : 1) * (6 + h(6) * 2), a: h(7) * TAU, ph: h(8) * TAU, flapT: h(9) * 6, pos: [0, 0, 0], yaw: 0, bank: 0, amp: 0 });
      }
      for (const q of G) {
        q.a += q.w / q.R * dt;
        const ccx = cx + q.ox + Math.sin(this.time * 0.03 + q.i) * 20, ccz = cz + q.oz + Math.cos(this.time * 0.027 + q.i * 1.3) * 20;
        q.pos[0] = ccx + Math.cos(q.a) * q.R; q.pos[2] = ccz + Math.sin(q.a) * q.R; q.pos[1] = q.y + Math.sin(q.a * 0.7 + q.i) * 2.5;
        const tx = -Math.sin(q.a) * Math.sign(q.w), tz = Math.cos(q.a) * Math.sign(q.w);
        q.yaw = yawOf(tx, tz); q.bank = -Math.sign(q.w) * 0.42;
        q.flapT -= dt; if (q.flapT < -1.6) q.flapT = 3 + W.h(q.i, Math.floor(this.time), 7) * 5;
        q.amp += ((q.flapT < 0 ? 0.62 : 0.06) - q.amp) * Math.min(1, dt * 4);
        q.ph += dt * (q.flapT < 0 ? 15 : 3);
      }
    }
    // the herons: one at a pond near the eye (by day), standing in the shallows at the edge; within 8 blocks it takes off
    // slowly and lands on the far side (or at the next pond); a pond whose heron flew off gets one again when the eye is far
    updHerons(dt, ctx, n) {
      const H = this.herons;
      if (!n || !ctx.sc.heron || ctx.wet) { H.length = 0; return; }
      const A = this.anchorList(), eye = ctx.eye;
      // the ponds within 110, the nearest first
      for (let i = H.length - 1; i >= 0; i--) if (Math.hypot(H[i].pos[0] - eye[0], H[i].pos[2] - eye[2]) > 150 || H[i].gone) H.splice(i, 1);
      if (H.length < n && (this.heronT = (this.heronT || 0) - dt) <= 0) {
        this.heronT = 2;
        const cand = A.duck.filter(a => Math.hypot(a.x - eye[0], a.z - eye[2]) < 110 && Math.hypot(a.x - eye[0], a.z - eye[2]) > 18 && !H.some(h => h.pond === a));
        cand.sort((a, b) => Math.hypot(a.x - eye[0], a.z - eye[2]) - Math.hypot(b.x - eye[0], b.z - eye[2]));
        for (const a of cand) { if (H.length >= n) break; const h = this.heronAt(a, W.h(this.seed, a.x, a.z) * TAU); if (h) H.push(h); }
      }
      for (const h of H) this.heronStep(h, dt, ctx);
    }
    // a heron's stand at a pond: in the shallows at angle a, 0.9 inside the rim, facing the water
    heronAt(pond, a) {
      const r = (pond.extra && pond.extra[0]) || 5;
      for (const k of [0.9, 1.4, 2.0]) {
        const x = pond.x + 0.5 + Math.cos(a) * (r - k), z = pond.z + 0.5 + Math.sin(a) * (r - k), S = this.surface(x, z, pond.y);
        if (!S || S.depth > 3) continue;
        return { pond, a, state: 'stand', t: 0, pos: [x, S.top + 0.55, z], yaw: yawOf(pond.x + 0.5 - x, pond.z + 0.5 - z), look: 0, flap: 0, ph: 0, wing: 0, legs: 0, neck: 0, pitch: 0, from: null, to: null };
      }
      return null;
    }
    heronStep(h, dt, ctx) {
      const eye = ctx.eye, dEye = Math.hypot(h.pos[0] - eye[0], h.pos[2] - eye[2]);
      h.t += dt;
      if (h.state === 'stand') {
        h.wing += (0 - h.wing) * Math.min(1, dt * 3); h.legs += (0 - h.legs) * Math.min(1, dt * 3);
        h.look = Math.sin(h.t * 0.4 + h.a) * 0.5 + Math.sin(h.t * 1.3) * 0.1;
        if (dEye < 8) { h.state = 'crouch'; h.t = 0; }
      } else if (h.state === 'crouch') {
        if (h.t > 0.6) {
          // where to: the far side of the pond when it is 12 from the eye, else the next pond (within 220), else away
          const pond = h.pond, r = (pond.extra && pond.extra[0]) || 5;
          let to = null;
          const aw = Math.atan2(h.pos[2] - eye[2], h.pos[0] - eye[0]);
          for (const da of [0, 0.6, -0.6]) { const a = aw + da, x = pond.x + 0.5 + Math.cos(a) * (r - 1), z = pond.z + 0.5 + Math.sin(a) * (r - 1); if (Math.hypot(x - eye[0], z - eye[2]) > 12) { const S = this.surface(x, z, pond.y); if (S && S.depth <= 3) { to = { x, y: S.top + 0.55, z, pond, a }; break; } } }
          if (!to) { const A = this.anchorList(); let best = null, bd = 220; for (const a of A.duck) { if (a === pond) continue; const d = Math.hypot(a.x - h.pos[0], a.z - h.pos[2]); if (d < bd) { bd = d; best = a; } } if (best) { const hh = this.heronAt(best, Math.atan2(h.pos[2] - best.z, h.pos[0] - best.x)); if (hh) to = { x: hh.pos[0], y: hh.pos[1], z: hh.pos[2], pond: best, a: hh.a }; } }
          if (!to) {
            // no water out of reach: it lands on the meadow 26–34 blocks on, past the pond (or flies off when there is none)
            const w = this.g.world;
            for (const dd of [30, 26, 34, 22]) { const x = h.pos[0] + Math.cos(aw) * dd, z = h.pos[2] + Math.sin(aw) * dd, X = Math.floor(x), Z = Math.floor(z); if (!w.isLoaded(X, Z)) continue; const y = w.topAt(X, Z); if (mask()[w.getBlock(X, y, Z)] & 2) { to = { x, y: y + 1, z, pond: h.pond, a: h.a, ground: true }; break; } }
            if (!to) { const x = h.pos[0] + Math.cos(aw) * 90, z = h.pos[2] + Math.sin(aw) * 90; to = { x, y: h.pos[1] + 30, z, pond: null, away: true }; }
          }
          const dist = Math.hypot(to.x - h.pos[0], to.z - h.pos[2]);
          h.from = h.pos.slice(); h.to = to; h.dur = Math.max(4, dist / 4.2) + 1.2; h.apex = Math.max(h.pos[1], to.y) + 5 + Math.min(10, dist * 0.12);
          h.state = 'fly'; h.t = 0;
        }
      } else if (h.state === 'fly') {
        const u = Math.min(1, h.t / h.dur), e = sm(u), F = h.from, T2 = h.to;
        const x = F[0] + (T2.x - F[0]) * e, z = F[2] + (T2.z - F[2]) * e;
        const y = (1 - u) * (1 - u) * F[1] + 2 * u * (1 - u) * h.apex + u * u * T2.y;
        const dx = x - h.pos[0], dz = z - h.pos[2], dy = y - h.pos[1];
        if (Math.hypot(dx, dz) > 1e-4) h.yaw = yawOf(dx, dz);
        h.pitch = Math.max(-0.3, Math.min(0.35, Math.atan2(dy, Math.hypot(dx, dz) + 1e-4)));
        h.pos[0] = x; h.pos[1] = y; h.pos[2] = z;
        h.ph += dt * TAU * 1.35;
        const beat = u < 0.55 ? 0.95 : u < 0.85 ? 0.3 : 0.55;
        h.flap += (beat - h.flap) * Math.min(1, dt * 3); h.wing += (1 - h.wing) * Math.min(1, dt * 4); h.legs += (1 - h.legs) * Math.min(1, dt * 2);
        if (u >= 1) { if (T2.away) { h.gone = true; return; } h.state = 'land'; h.t = 0; h.pond = T2.pond; h.a = T2.a; h.pitch = 0; }
      } else if (h.state === 'land') {
        h.wing += (0 - h.wing) * Math.min(1, dt * 2.5); h.legs += (0 - h.legs) * Math.min(1, dt * 4); h.flap *= Math.max(0, 1 - dt * 3);
        if (h.t > 1.1) { h.state = 'stand'; h.t = 0; if (!h.to || !h.to.ground) h.yaw = yawOf(h.pond.x + 0.5 - h.pos[0], h.pond.z + 0.5 - h.pos[2]); }
      }
    }

    // ================================================================ the fish
    updFish(dt, ctx, cap) {
      const A = this.anchorList(), eye = ctx.eye, nS = cap.shoals, nF = cap.fish, nC = cap.carp;
      // shoals: at the fish anchors (the pier, the falls' pool) within 64, then the shallows round the eye
      const SH = this.shoals;
      for (let i = SH.length - 1; i >= 0; i--) { const s = SH[i]; if (!nS || !nF || s.n !== nF || Math.hypot(s.b.x - eye[0], s.b.z - eye[2]) > (s.eyeOwn ? 70 : 90)) SH.splice(i, 1); }
      if (nS && nF && (this.shoalT = (this.shoalT || 0) - dt) <= 0) {
        this.shoalT = 2;
        for (const a of A.fish) {
          if (SH.length >= nS) break;
          if (Math.hypot(a.x - eye[0], a.z - eye[2]) > 64 || SH.some(s => s.key === a.key)) continue;
          const b = this.anchorDisc(a, Math.min(7, (a.extra && a.extra[0]) || 5));
          if (b) SH.push(this.newShoal(a.key, b, nF, false));
        }
        // the shallows round the eye: water at sea level with two blocks of depth, the nearest ahead first
        if (SH.length < nS && !SH.some(s => s.eyeOwn) && !SH.some(s => Math.hypot(s.b.x - eye[0], s.b.z - eye[2]) < 18) && this.waterNear(eye)) {
          const yaw = this.g.player.yaw, f = [-Math.sin(yaw), -Math.cos(yaw)];
          for (let k = 0; k < 12; k++) {
            const a = Math.atan2(f[1], f[0]) + ((k & 1) ? 1 : -1) * Math.ceil(k / 2) * 0.35, dd = 7 + (k % 3) * 3;
            const x = Math.floor(eye[0] + Math.cos(a) * dd) + 0.5, z = Math.floor(eye[2] + Math.sin(a) * dd) + 0.5;
            const b = this.waterDisc(x, z, eye[1] - 1.6, 5, 1);   // (the shallows too: minnows in a hand's depth of clear water)
            if (b && b.r >= 2.4) { SH.push(this.newShoal('eye:' + Math.floor(x) + ',' + Math.floor(z), b, nF, true)); break; }
          }
        }
      }
      for (const s of SH) {
        const d = Math.hypot(s.b.x - eye[0], s.b.z - eye[2]);
        if (d > 56) continue;   // (too small to see: no step)
        // (f-wild2) a still player at the water — on the pier, on the shore, not in it — casts a shadow on the surface
        // and the shoal gathers in it, beside you where you look down; a running or swimming player scatters them
        const c = s.fl.ctr, feet = eye[1] - 1.62, swim = feet < s.b.surf + 0.3, fast = ctx.speed > 2.6;
        s.fl.fear = Math.hypot(c[0] - eye[0], c[2] - eye[2]) < 4.5 && Math.abs(eye[1] - s.b.surf) < 3.5 && (swim || fast) ? eye : null;
        const FE = this.feet || (this.feet = [0, 0, 0]); FE[0] = eye[0]; FE[1] = feet; FE[2] = eye[2];
        const sh = !swim && !fast && d < s.b.r + 12 ? W.shadowOnWater(FE, ctx.E.sunDir, s.b.surf, this.shA || (this.shA = [0, 0])) : null;
        s.follow = !!(sh && this.openWater(s.b, sh));
        if (s.follow) { s.fl.tgt[0] = sh[0]; s.fl.tgt[2] = sh[1]; s.fl.tgt[1] = s.b.y0 + (s.b.y1 - s.b.y0) * 0.65; }
        else W.shoalTarget(s.seed, ctx.clock, s.b, s.fl.tgt);
        s.acc += dt; if (s.acc >= 1 / 30) { s.fl.step(Math.min(0.1, s.acc)); s.acc = 0; }
      }
      // carp: in the ponds within 40
      const CP = this.carps;
      for (let i = CP.length - 1; i >= 0; i--) { const s = CP[i]; if (!nC || s.n !== nC || Math.hypot(s.b.x - eye[0], s.b.z - eye[2]) > 60) CP.splice(i, 1); }
      if (nC && (this.carpT = (this.carpT || 0) - dt) <= 0) {
        this.carpT = 2;
        for (const a of A.duck) {
          if (CP.length >= 3) break;
          if (Math.hypot(a.x - eye[0], a.z - eye[2]) > 40 || CP.some(s => s.key === a.key)) continue;
          const b = this.waterDisc(a.x + 0.5, a.z + 0.5, a.y, Math.max(2, ((a.extra && a.extra[0]) || 5) - 1), 2);
          if (b) { const s = this.newShoal(a.key, b, nC, false, W.CARP); s.carp = true; CP.push(s); }
        }
      }
      for (const s of CP) {
        W.shoalTarget(s.seed, ctx.clock * 0.6, s.b, s.fl.tgt);
        s.acc += dt; if (s.acc >= 1 / 20) { s.fl.step(Math.min(0.1, s.acc)); s.acc = 0; }
      }
    }
    // the water of a fish anchor: its own disc, or — when the pier's posts crowd its end — the widest within 2.5 of it
    // (eight places round it); once per anchor (kept 30 s: the water does not move)
    anchorDisc(a, rMax) {
      const C = this.discs || (this.discs = new Map()), c = C.get(a.key);
      if (c && this.time - c.t < 30) return c.b;
      const x = a.x + 0.5, z = a.z + 0.5;
      let b = this.waterDisc(x, z, a.y, rMax, 2);
      for (let k = 0; k < 8 && !(b && b.r >= 4); k++) { const q = this.waterDisc(x + Math.cos(k / 8 * TAU) * 2.5, z + Math.sin(k / 8 * TAU) * 2.5, a.y, rMax, 2); if (q && (!b || q.r > b.r)) b = q; }
      C.set(a.key, { b, t: this.time });
      if (C.size > 24) C.delete(C.keys().next().value);
      return b;
    }
    // (f-wild2) the point p = [x, z] moved into the shoal's water: inside its disc and with open sky above the water
    // (not under a pier's deck — the fish there are hidden), the nearest such place round it; false when there is none
    openWater(b, p) {
      const w = this.g.world, R = VR.R, F = VR.F, dx = p[0] - b.x, dz = p[1] - b.z, dd = Math.hypot(dx, dz), lim = Math.max(0.5, b.r - 0.8);
      if (dd > lim) { p[0] = b.x + dx / dd * lim; p[1] = b.z + dz / dd * lim; }
      const open = (x, z) => { const X = Math.floor(x), Z = Math.floor(z); for (let y = b.top + 1; y <= b.top + 4; y++) { const q = w.getBlock(X, y, Z); if (q && (R.T.flags[q] & F.SOLID)) return false; } return true; };
      if (open(p[0], p[1])) return true;
      for (const r of [1.5, 2.5, 3.5]) for (let k = 0; k < 8; k++) {
        const x = p[0] + Math.cos(k / 8 * TAU) * r, z = p[1] + Math.sin(k / 8 * TAU) * r;
        if (Math.hypot(x - b.x, z - b.z) <= lim && open(x, z)) { p[0] = x; p[1] = z; return true; }
      }
      return false;
    }
    // is there water at the surface round the eye (eight columns 6 and 11 blocks out)? (a cheap look before the search)
    waterNear(eye) {
      const w = this.g.world, MK = mask();
      for (let k = 0; k < 16; k++) { const a = k / 8 * TAU, d = k < 8 ? 6 : 11, x = Math.floor(eye[0] + Math.cos(a) * d), z = Math.floor(eye[2] + Math.sin(a) * d); if (w.isLoaded(x, z) && (MK[w.getBlock(x, w.topAt(x, z), z)] & 8)) return true; }
      return false;
    }
    newShoal(key, b, n, eyeOwn, P) {
      const seed = (W.h(this.seed, Math.floor(b.x), Math.floor(b.z)) * 4294967295) >>> 0;
      const fl = new W.Flock(n, seed, P || W.SHOAL);
      fl.bound = b; fl.place(b.x, (b.y0 + b.y1) / 2, b.z, Math.min(2, b.r * 0.5));
      return { key, b, n, fl, seed, eyeOwn, acc: 0 };
    }

    // ================================================================ butterflies and dragonflies
    updBugs(dt, ctx, cap) {
      const eye = ctx.eye, nB = cap.bfly, nS = cap.swarms, nD = cap.dfly;
      // the column scan round the eye feeds the flower drifts (and the herds' cover)
      if (nB || cap.rabbit || cap.fox) this.scanStep(eye);
      // the swarms: the densest drifts within 36 (by day, dry)
      const SW = this.swarms, day = ctx.sc.bugs && !ctx.wet && ((ctx.E.sunDir && ctx.E.sunDir[1] > 0.05) || false);
      for (let i = SW.length - 1; i >= 0; i--) { const s = SW[i]; if (!nB || !day || s.n !== nB || Math.hypot(s.home.x - eye[0], s.home.z - eye[2]) > 52) SW.splice(i, 1); }
      if (nB && day && SW.length < nS && this.scan.drifts && (this.swarmT = (this.swarmT || 0) - dt) <= 0) {
        this.swarmT = 1.5;
        for (const dr of this.scan.drifts) {
          if (SW.length >= nS) break;
          if (Math.hypot(dr.x - eye[0], dr.z - eye[2]) > 36 || SW.some(s => Math.hypot(s.home.x - dr.x, s.home.z - dr.z) < 10)) continue;
          const home = { x: dr.x, y: dr.y, z: dr.z, r: Math.max(3, dr.r) };
          SW.push({ home, n: nB, sw: new W.Swarm(nB, (W.h(this.seed, Math.floor(dr.x), Math.floor(dr.z)) * 4294967295) >>> 0, home, dr.flowers), sky: Math.max(0.4, lightOf(this.g.world, dr.x, dr.y + 1, dr.z)) });
        }
      }
      for (const s of SW) if (Math.hypot(s.home.x - eye[0], s.home.z - eye[2]) < 48) s.sw.step(dt, eye, ctx.moving);
      // dragonflies: over the ponds within 36 (by day, dry)
      const DF = this.dflies, A = this.anchorList(), dday = ctx.sc.dfly && !ctx.wet;
      for (let i = DF.length - 1; i >= 0; i--) { const p = DF[i]; if (!nD || !dday || p.list.length !== nD || Math.hypot(p.x - eye[0], p.z - eye[2]) > 50) DF.splice(i, 1); }
      if (nD && dday && (this.dflyT = (this.dflyT || 0) - dt) <= 0) {
        this.dflyT = 2;
        for (const a of A.duck) {
          if (DF.length >= 3) break;
          if (Math.hypot(a.x - eye[0], a.z - eye[2]) > 36 || DF.some(p => p.key === a.key)) continue;
          const S = this.surface(a.x + 0.5, a.z + 0.5, a.y); if (!S) continue;
          const r = ((a.extra && a.extra[0]) || 5), list = [], COLS = [[0.15, 0.45, 0.95], [0.2, 0.75, 0.45], [0.85, 0.2, 0.18], [0.15, 0.6, 0.85]];
          for (let i = 0; i < nD; i++) { const h = (k) => W.h(this.seed + i, a.x, a.z * 7 + k); list.push({ x: a.x + 0.5 + (h(1) - 0.5) * r, y: S.y + 0.5 + h(2), z: a.z + 0.5 + (h(3) - 0.5) * r, tx: 0, ty: 0, tz: 0, hov: h(4) * 2, yaw: h(5) * TAU, ph: h(6) * 100, col: COLS[i % COLS.length], dart: 0 }); }
          DF.push({ key: a.key, x: a.x + 0.5, z: a.z + 0.5, r, surf: S.y, list, sky: Math.max(0.4, lightOf(this.g.world, a.x, S.top + 1, a.z)) });
        }
      }
      for (const p of DF) {
        if (Math.hypot(p.x - eye[0], p.z - eye[2]) > 40) continue;
        for (const q of p.list) {
          q.ph += dt * 70;
          if (q.dart > 0) {
            const dx = q.tx - q.x, dy = q.ty - q.y, dz = q.tz - q.z, d = Math.hypot(dx, dy, dz);
            if (d < 0.08) { q.dart = 0; q.hov = 0.8 + W.h(Math.floor(q.ph), 1, 2) * 2.4; }
            else { const st = Math.min(d, Math.max(1.5, d * 7) * dt); q.x += dx / d * st; q.y += dy / d * st; q.z += dz / d * st; if (Math.hypot(dx, dz) > 0.05) q.yaw = yawOf(dx, dz); }
          } else {
            q.hov -= dt; q.y += Math.sin(q.ph * 0.04) * 0.15 * dt; q.yaw += Math.sin(q.ph * 0.013) * 0.4 * dt;
            if (q.hov <= 0) {
              const k = Math.floor(q.ph), a = W.h(k, 3, 4) * TAU, rr = Math.sqrt(W.h(k, 5, 6)) * (p.r + 1);
              q.tx = p.x + Math.cos(a) * rr; q.tz = p.z + Math.sin(a) * rr; q.ty = p.surf + 0.35 + W.h(k, 7, 8) * 1.1; q.dart = 1;
            }
          }
        }
      }
    }
    // the column scan round the eye (every second column of a 56 × 56 box at the eye's 16-block cell, 140 a frame):
    // flowers into 8-block cells (the drifts: a cell with six flowers and more), grass at the foot of cover (the edges)
    scanStep(eye) {
      const S = this.scan, w = this.g.world, MK = mask();
      const cx = Math.floor(eye[0] / 16) * 16 + 8, cz = Math.floor(eye[2] / 16) * 16 + 8, N = 28;
      // (again when it met columns that had not come yet — 3 s later — and every 30 s: the land round you changes)
      const again = S.done && this.time - S.t > (S.miss ? 3 : 30);
      if (!S.at || S.at[0] !== cx || S.at[1] !== cz || again) { S.at = [cx, cz]; S.i = 0; S.flowers = new Map(); S.cover = []; S.done = false; S.miss = 0; }
      if (S.done) return;
      for (let k = 0; k < 140 && S.i < N * N; k++, S.i++) {
        const x = cx - N + (S.i % N) * 2, z = cz - N + Math.floor(S.i / N) * 2;
        if (!w.isLoaded(x, z)) { S.miss++; continue; }
        const y = w.topAt(x, z), b = w.getBlock(x, y, z), m = MK[b];
        if (m & 1) {   // (topAt can name the flower itself, or the grass under it)
          const ck = Math.floor(x / 8) + ',' + Math.floor(z / 8); let c = S.flowers.get(ck); if (!c) S.flowers.set(ck, c = []); c.push([x + 0.5, y, z + 0.5]);
        } else if (m & 2) {
          const up = w.getBlock(x, y + 1, z);
          if (MK[up] & 1) { const ck = Math.floor(x / 8) + ',' + Math.floor(z / 8); let c = S.flowers.get(ck); if (!c) S.flowers.set(ck, c = []); c.push([x + 0.5, y + 1, z + 0.5]); }
          else if (!up && S.cover.length < 160) {
            // an edge: cover (a hedge, a bush) at the foot of the next column or the one after
            for (const [ox, oz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = w.getBlock(x + ox, y + 1, z + oz); if (MK[c] & 4) { S.cover.push([x + 0.5, y + 1, z + 0.5, x + ox + 0.5, z + oz + 0.5]); break; } }
          }
        }
      }
      if (S.i < N * N) return;
      S.done = true; S.t = this.time;
      // the drifts: cells with six flowers or more, their flowers and the neighbours' within 7 of the middle
      const drifts = [];
      for (const [ck, c] of S.flowers) {
        if (c.length < 6) continue;
        let x = 0, y = 0, z = 0; for (const f of c) { x += f[0]; y += f[1]; z += f[2]; } x /= c.length; y /= c.length; z /= c.length;
        const [gx, gz] = ck.split(',').map(Number), fl = [];
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const n = S.flowers.get((gx + dx) + ',' + (gz + dz)); if (n) for (const f of n) if (Math.hypot(f[0] - x, f[2] - z) < 7 && fl.length < 48) fl.push(f); }
        let r = 0; for (const f of fl) r = Math.max(r, Math.hypot(f[0] - x, f[2] - z));
        drifts.push({ x, y, z, r: r + 0.5, flowers: fl, n: c.length });
      }
      drifts.sort((a, b) => b.n - a.n);
      S.drifts = drifts.slice(0, 6);
    }

    // ================================================================ the sky rays
    updRays(dt, ctx, cap) {
      const g = this.g, n = cap.ray;
      this.rays.length = 0;
      if (!n || !(g.meta && (g.meta.vgen | 0) >= 3 && g.meta.type !== 'flat')) return;
      const C = VR.Heart && VR.Heart.ISLES ? VR.Heart.ISLES : { x: 330, z: 140 };
      if (Math.hypot(ctx.eye[0] - C.x, ctx.eye[2] - C.z) > 1100) return;
      if (!this.loop) { const I = VR.IslesGen && VR.IslesGen.list ? VR.IslesGen.list({ seed: g.meta.seed }) : null; this.loop = W.rayLoop(I || []); }
      const P = g.particles, TR = g.trails, rate = cap.motes, night = ctx.E.night || 0;
      // (f-wild2) the pass at dusk: one young ray leaves the circuit for a glide low past the player's cell
      const pass = this.passUpd(ctx, n);
      for (let k = 0; k < n; k++) {
        const st = (pass && pass.k === k && W.passAt(pass, this.loop, this.seed, ctx.clock, this.rs)) || W.rayState(this.seed, ctx.clock, k, 4, this.loop, this.rs);
        const R = this.rays[k] || (this.rays[k] = new Float32Array(8)); R.set(st);
        this.rays.length = k + 1;
        const d = Math.hypot(st[0] - ctx.eye[0], st[1] - ctx.eye[1], st[2] - ctx.eye[2]);
        // the luminous trails from the wing tips (the trails' own glow ribbons, one additive draw for all): cyan and
        // violet, a few seconds long, brighter at night — the long light lines of the trailer's sky
        if (TR && TR.emit && d < 700) {
          const cy = Math.cos(st[3]), sy = Math.sin(st[3]), cb = Math.cos(st[5]), sb = Math.sin(st[5]), sc = st[7], col = k & 1 ? RAYCOL[1] : RAYCOL[0];
          // (one options record per trail, kept: the trails hold on to it)
          const o = this.trailO || (this.trailO = TKEY.map(() => ({ kind: 'glow', col: null, width: 1, life: 3.2, step: 1.2, k: 0.3, max: 48 })));
          for (let sd = 0; sd < 2; sd++) {
            const lx = (sd ? -0.5 : 0.5) * sc * 0.97 * cb, ly = (sd ? -0.5 : 0.5) * sc * 0.97 * sb, lz = 0.05 * sc;
            const q = o[k * 2 + sd]; q.col = col; q.width = 0.05 * sc; q.k = 0.26 + 0.34 * night;
            TR.emit(TKEY[k * 2 + sd], st[0] + lx * cy + lz * sy, st[1] + ly, st[2] - lx * sy + lz * cy, q);
          }
        }
        // the light motes from the wing tips and the tail's end: drifting, slowly fading
        if (!P || !rate || d > 230) continue;
        this.rayAcc[k] += dt * rate * (0.6 + 0.4 * night);
        while (this.rayAcc[k] >= 1) {
          this.rayAcc[k] -= 1;
          const cy = Math.cos(st[3]), sy = Math.sin(st[3]), s = st[7], pick = (Math.random() * 3) | 0;
          const lx = pick === 2 ? 0 : (pick ? -0.5 : 0.5) * s * 0.96, lz = pick === 2 ? 0.85 * s : 0.06 * s;
          const x = st[0] + lx * cy + lz * sy, z = st[2] - lx * sy + lz * cy, y = st[1] + (pick === 2 ? 0 : Math.sin(st[5]) * lx);
          const col = k & 1 ? MOTECOL[1] : MOTECOL[0];
          P.spawn(x, y, z, (Math.random() - 0.5) * 0.3, -0.12 - Math.random() * 0.2, (Math.random() - 0.5) * 0.3, { life: 3.2 + Math.random() * 1.6, size: 0.22 + Math.random() * 0.16, grav: 0, drag: 0.5, col, emis: 1, collide: false, fade: true, force: true });
        }
      }
    }

    // (f-wild2) the pass at dusk: planned once a day when its moment comes near (W.passTime: the same for every guest),
    // for the cell the player is in then; none in the rain, none when it would have had to leave already. → the plan
    // while the ray is on it, else null
    passUpd(ctx, n) {
      const P = this.pass || (this.pass = { day: null, plan: null, tried: false });
      if (P.day !== ctx.day) { P.day = ctx.day; P.plan = null; P.tried = false; }
      const Tn = (ctx.day * 24000 + W.passTime(this.seed, ctx.day)) / 20;
      if (!P.tried && ctx.clock > Tn - 110 && ctx.clock < Tn - 10) {
        P.tried = true;
        const plan = ctx.wet ? null : W.passPlan(this.seed, ctx.day, ctx.eye, this.loop, (x, z) => this.topUnder(x, z), n);
        P.plan = plan && plan.T0 > ctx.clock + 0.2 ? plan : null;
      }
      return P.plan && ctx.clock >= P.plan.T0 && ctx.clock <= P.plan.T1 ? P.plan : null;
    }
    // the top a low glide must clear at (x, z) under the Sky Isles' rock: the highest block below y 112 (the ground,
    // the trees, the lake's water — not a waterfall's falling water above the sea), or null when the column is not here
    topUnder(x, z) {
      const w = this.g.world;
      if (!w.isLoaded(x, z)) return null;
      const R = VR.R, F = VR.F, SEA = (VR.C && VR.C.SEA) || 63;
      for (let y = Math.min(112, w.topAt(x, z) + 1); y > 1; y--) { const b = w.getBlock(x, y, z); if (!b) continue; if ((R.T.flags[b] & F.FLUID) && y > SEA + 2) continue; return y + 1; }
      return null;
    }

    // ================================================================ rabbits and the fox
    updHerds(dt, ctx, cap) {
      const eye = ctx.eye, S = this.scan, RB = this.rabbits, nR = cap.rabbit;
      const okR = nR && ctx.sc.rabbits && !ctx.wet;
      for (let i = RB.length - 1; i >= 0; i--) { const r = RB[i]; if (!okR || r.gone || Math.hypot(r.pos[0] - eye[0], r.pos[2] - eye[2]) > 70) RB.splice(i, 1); }
      if (okR && RB.length < nR && S.done && S.cover.length && (this.rabbitT = (this.rabbitT || 0) - dt) <= 0) {
        this.rabbitT = 2.5;
        // an edge 14–48 from the eye, not where a rabbit sits already (seeded by the spot: every guest picks the same)
        const C = S.cover;
        for (let t = 0; t < 8 && RB.length < nR; t++) {
          const c = C[Math.floor(W.h(this.seed, Math.floor(this.time * 0.4), t) * C.length) % C.length], d = Math.hypot(c[0] - eye[0], c[2] - eye[2]);
          if (d < 14 || d > 48 || RB.some(r => Math.hypot(r.home[0] - c[0], r.home[2] - c[2]) < 4)) continue;
          RB.push({ home: [c[0], c[1], c[2]], cover: [c[3], c[4]], pos: [c[0], c[1], c[2]], yaw: W.h(c[0], c[2], 1) * TAU, state: 'graze', t: 0, hop: null, id: RB.length + 7, walk: 0, walkAmt: 0, alert: 0, sky: lightOf(this.g.world, c[0], c[1] + 0.5, c[2]) });
        }
      }
      for (const r of RB) this.rabbitStep(r, dt, ctx);
      // the fox at dusk: along a hedge (a run of cover) near the eye, a pounce at nothing, into the hedge at the end
      const okF = cap.fox && ctx.sc.fox && !ctx.wet;
      if (!okF) { this.fox = null; this.foxT = 0; }   // (the rest after a walk is the evening's: the next dusk's fox comes at once)
      else if (!this.fox && S.done && !S.miss && (this.foxT = (this.foxT || 0) - dt) <= 0) {
        // (only on a whole scan — run 2's first look met a hedge whose columns had not come and waited 20 s; no hedge:
        //  another look in 6 s)
        const path = this.hedgeRun(eye);
        this.foxT = path ? 0 : 6;
        if (path) this.fox = { path, s: 0, state: 'trot', t: 0, pos: [path.pts[0][0], path.pts[0][1], path.pts[0][2]], yaw: 0, walk: 0, walkAmt: 1, id: 5, pounced: false, jump: 0, pet: { state: 'follow' }, kind: 'wild_fox' };
      }
      if (this.fox) this.foxStep(this.fox, dt, ctx);
    }
    rabbitStep(r, dt, ctx) {
      const eye = ctx.eye, d = Math.hypot(r.pos[0] - eye[0], r.pos[2] - eye[2]);
      r.t += dt;
      if (r.state !== 'bolt' && (d < 7 || (ctx.moving && d < 10))) { r.state = 'bolt'; r.t = 0; r.hop = null; }
      else if (r.state === 'graze' && d < 12) { r.state = 'alert'; r.t = 0; }
      else if (r.state === 'alert' && d > 14) { r.state = 'graze'; r.t = 0; }
      if (r.hop) {
        const H = r.hop; H.t += dt; const u = Math.min(1, H.t / H.dur);
        r.pos[0] = H.from[0] + (H.to[0] - H.from[0]) * u; r.pos[2] = H.from[2] + (H.to[2] - H.from[2]) * u; r.pos[1] = H.from[1] + (H.to[1] - H.from[1]) * u + Math.sin(Math.PI * u) * (r.state === 'bolt' ? 0.55 : 0.35);
        r.walk += dt * 6; r.walkAmt = 1;
        if (u >= 1) r.hop = null;
        return;
      }
      r.walkAmt = 0;
      if (r.state === 'graze') {
        r.alert += (0 - r.alert) * Math.min(1, dt * 3);
        if (r.t > 2.5 + W.h(r.id, Math.floor(this.time / 3), 2) * 4) { r.t = 0; const a = W.h(r.id, Math.floor(this.time), 5) * TAU; const tx = r.home[0] + Math.cos(a) * 2.5, tz = r.home[2] + Math.sin(a) * 2.5; this.hopTo(r, tx, tz, 0.9, 0.32); }
      } else if (r.state === 'alert') {
        r.alert += (1 - r.alert) * Math.min(1, dt * 4); r.yaw += wrapA(yawOf(eye[0] - r.pos[0], eye[2] - r.pos[2]) - r.yaw) * Math.min(1, dt * 2);
      } else {   // bolting: fast hops to the cover, then gone into it
        r.alert = 1;
        const dc = Math.hypot(r.cover[0] - r.pos[0], r.cover[1] - r.pos[2]);
        if (dc < 0.6 || r.t > 6) { r.gone = true; return; }
        this.hopTo(r, r.cover[0], r.cover[1], 1.3, 0.2);
      }
    }
    // a hop toward (tx, tz): at most len, over dur seconds, onto the ground there (a step of one block at most)
    hopTo(r, tx, tz, len, dur) {
      const w = this.g.world, dx = tx - r.pos[0], dz = tz - r.pos[2], dl = Math.hypot(dx, dz) || 1, st = Math.min(len, dl), x = r.pos[0] + dx / dl * st, z = r.pos[2] + dz / dl * st;
      const y = w.isLoaded(Math.floor(x), Math.floor(z)) ? w.topAt(Math.floor(x), Math.floor(z)) + 1 : r.pos[1];
      const H = r.hop0 || (r.hop0 = { from: [0, 0, 0], to: [0, 0, 0], t: 0, dur: 0 });
      H.from[0] = r.pos[0]; H.from[1] = r.pos[1]; H.from[2] = r.pos[2]; H.to[0] = x; H.to[1] = Math.abs(y - r.pos[1]) <= 1.01 ? y : r.pos[1]; H.to[2] = z; H.t = 0; H.dur = dur;
      r.hop = H; r.yaw = yawOf(dx, dz);
    }
    // a run of cover blocks at ground height along x or z near the eye (6 and more), the path a block off it on the open
    // side: {pts: [[x, y, z]], L, side}
    hedgeRun(eye) {
      const S = this.scan, w = this.g.world, MK = mask();
      let best = null;
      for (let k = 0; k < Math.min(60, S.cover.length); k++) {
        const c = S.cover[(k * 7) % S.cover.length], hx = Math.floor(c[3]), hz = Math.floor(c[4]), y = Math.floor(c[1]);
        if (Math.hypot(c[0] - eye[0], c[2] - eye[2]) < 12 || Math.hypot(c[0] - eye[0], c[2] - eye[2]) > 45) continue;
        for (const [ax, az] of [[1, 0], [0, 1]]) {
          let a = 0, b = 0;
          while (a < 14 && (MK[w.getBlock(hx - ax * (a + 1), y, hz - az * (a + 1))] & 4)) a++;
          while (b < 14 && (MK[w.getBlock(hx + ax * (b + 1), y, hz + az * (b + 1))] & 4)) b++;
          const len = a + b + 1; if (len < 6 || (best && len <= best.len)) continue;
          // the open side: grass under air a block off the hedge
          for (const sd of [1, -1]) {
            const ox = az * sd, oz = ax * sd, pts = [];
            let ok = true;
            for (let i = -a; i <= b && ok; i++) { const x = hx + ax * i + ox, z = hz + az * i + oz, gy = w.topAt(x, z); if (Math.abs(gy + 1 - y) > 1 || (MK[w.getBlock(x, gy + 1, z)] & 4)) ok = false; else pts.push([x + 0.5, gy + 1, z + 0.5]); }
            if (ok) { best = { len, pts, into: [-ox, -oz] }; break; }
          }
        }
      }
      if (!best) return null;
      if (W.h(this.seed, Math.floor(best.pts[0][0]), Math.floor(best.pts[0][2])) < 0.5) best.pts.reverse();
      best.L = best.pts.length - 1;
      return best;
    }
    foxStep(f, dt, ctx) {
      const P = f.path, sp = 1.7;
      f.t += dt;
      if (f.state === 'trot') {
        f.s += sp * dt; f.walk += sp * dt; f.walkAmt = 1; f.pet.state = 'follow';
        if (!f.pounced && f.s > P.L * 0.5) { f.state = 'sniff'; f.t = 0; }
        if (f.s >= P.L) { f.state = 'slip'; f.t = 0; }
      } else if (f.state === 'sniff') {
        f.walkAmt = 0; f.pet.state = 'follow';
        if (f.t > 1.6) { f.state = 'pounce'; f.t = 0; f.pounced = true; }
      } else if (f.state === 'pounce') {
        const u = Math.min(1, f.t / 0.75); f.jump = Math.sin(Math.PI * u) * 1.05; f.s += 2.2 * dt; f.walkAmt = 0.4;
        if (u >= 1) { f.jump = 0; f.state = 'look'; f.t = 0; }
      } else if (f.state === 'look') {
        f.walkAmt = 0; f.pet.state = 'sit';
        if (f.t > 1.8) { f.state = 'trot'; f.t = 0; f.pet.state = 'follow'; }
      } else if (f.state === 'slip') {
        f.pos[0] += P.into[0] * dt * 1.4; f.pos[2] += P.into[1] * dt * 1.4; f.walkAmt = 1; f.walk += dt * 1.4;
        if (f.t > 0.9) { this.fox = null; this.foxT = 90; return; }
        return;
      }
      const i = Math.min(P.L - 1e-3, Math.max(0, f.s)), k = Math.floor(i), u = i - k, a = P.pts[k], b = P.pts[Math.min(P.L, k + 1)];
      f.pos[0] = a[0] + (b[0] - a[0]) * u; f.pos[2] = a[2] + (b[2] - a[2]) * u; f.pos[1] = a[1] + (b[1] - a[1]) * u + (f.jump || 0);
      f.yaw = yawOf(b[0] - a[0], b[2] - a[2]) || f.yaw;
    }

    // ================================================================ the draw
    draw(r, E, layer, cam) {
      if (!this.on || !this.live) return;
      if (layer === 'trans') { this.drawCloud(r, E, cam || r.cam); return; }
      if (layer !== 'opaque') return;
      const t0 = performance.now(), gl = r.gl, list = this.list, cap = this.b.cap;
      cam = cam || r.cam; list.length = 0;
      const cx = cam.x, cy = cam.y, cz = cam.z, put = WG.put, night = E.night || 0;
      // the murmuration (one draw), the gulls
      const Mu = this.murm;
      if (Mu && cap.murm) {
        // each boid a party of W.MURM_K birds (wildgpu.js 'flock'): spread round it in the sky, close together on the
        // perch; (f-wild2) the party draws its first W.birdsVisible(d) birds as dashes — all near, a few sparkle birds
        // far off — and the density cloud (drawCloud, the translucent pass) carries the rest
        const K = WG.kind(gl, 'flock', KINDCAP.flock), D = K.data, fl = Mu.fl, ex = Mu.state === 'fly' ? Mu.ex : 0, P = Mu.perch, S = WG.STRIDE;
        const dc = Mu.state === 'seated' && Mu.roost ? Math.hypot(Mu.roost[0] - cx, Mu.roost[2] - cz) : Math.hypot(fl.ctr[0] - cx, fl.ctr[2] - cz);
        const roosting = Mu.ph === 'roost' && P;
        let n = 0;
        if (Mu.state !== 'away' && dc < (Mu.state === 'seated' ? 90 : 520)) for (let i = 0; i < Mu.n && n < K.cap; i++) {
          const o = i * 3, sit = Mu.landed[i] === 1, vx = fl.vel[o], vy = fl.vel[o + 1], vz = fl.vel[o + 2];
          const x = fl.pos[o] + (sit ? 0 : vx * ex) - cx, y = fl.pos[o + 1] + (sit ? 0 : vy * ex) - cy, z = fl.pos[o + 2] + (sit ? 0 : vz * ex) - cz;
          // (the birds' size: half a block, a little more far off; the shader keeps a dash at least ~1.3 px thick)
          const d = Math.sqrt(x * x + y * y + z * z), s = 0.55 * Math.max(1, Math.min(1.5, d / 80));
          const hv = Math.hypot(vx, vz) + 1e-4, k = 0.86 + 0.24 * ((i * 0.618) % 1);
          // the party's spread: 1 in the sky; closing to its perch while it lands; small on the perch
          const spread = sit ? 0.22 : roosting ? 0.22 + 0.78 * sm(Math.hypot(P[o] - fl.pos[o], P[o + 1] - fl.pos[o + 1], P[o + 2] - fl.pos[o + 2]) / 14) : 1;
          put(D, n++, x, y, z, s, sit ? (i * 2.4) % TAU : yawOf(vx, vz), sit ? 0 : Math.atan2(vy, hv) * 0.8, sit ? 0 : fl.bank[i], fl.phase[i], 0.9 * k, 0.88 * k, 0.95 * k, 1, sit ? 0.02 : 0.45 + 0.5 * fl.flap[i], 0, sit ? -0.55 : 0.05, spread, 0, 0.12);
          D[(n - 1) * S + 19] = sit || Mu.state !== 'fly' ? W.MURM_K : W.birdsVisible(d);
        }
        if (n) list.push([K, n]);
      }
      if (this.gulls.length) {
        const K = WG.kind(gl, 'gull', KINDCAP.gull), D = K.data; let n = 0;
        for (const q of this.gulls) { const x = q.pos[0] - cx, y = q.pos[1] - cy, z = q.pos[2] - cz, d = Math.hypot(x, z); if (d > 320) continue; put(D, n++, x, y, z, 1.25 * Math.max(1, Math.min(1.8, d / 120)), q.yaw, 0, q.bank, q.ph, 1, 1, 1, 1, q.amp, 0, 0.08, 0, 0, 0.3); }
        if (n) list.push([K, n]);
      }
      // the fish: shoals (silver, flashing), carp (gold)
      if (this.shoals.length) {
        const K = WG.kind(gl, 'fish', KINDCAP.fish), D = K.data; let n = 0;
        for (const s of this.shoals) {
          const fl = s.fl; if (Math.hypot(s.b.x - cx, s.b.z - cz) > 56) continue;
          // (f-wild2: a little larger; each fish rolls into its turn, its silver flank flashing — the glow slot's flash)
          for (let i = 0; i < s.n && n < K.cap; i++) { const o = i * 3, vx = fl.vel[o], vy = fl.vel[o + 1], vz = fl.vel[o + 2], k = 0.85 + 0.3 * ((i * 0.618) % 1), bk = Math.max(-0.9, Math.min(0.9, fl.bank[i] * 1.6)), fx = sm((Math.abs(bk) - 0.12) / 0.4); put(D, n++, fl.pos[o] - cx, fl.pos[o + 1] - cy, fl.pos[o + 2] - cz, 0.36 * k, yawOf(vx, vz), Math.atan2(vy, Math.hypot(vx, vz) + 1e-4) * 0.6, bk, fl.phase[i], 1, 1, 1, s.b.sky, 0, 0, 0, 0.09, fx, 1.6); }
        }
        if (n) list.push([K, n]);
      }
      if (this.carps.length) {
        const K = WG.kind(gl, 'carp', KINDCAP.carp), D = K.data, TT = [[1, 1, 1], [1, 0.85, 0.6], [1, 0.95, 0.9], [0.95, 0.7, 0.55]]; let n = 0;
        for (const s of this.carps) { const fl = s.fl; for (let i = 0; i < s.n && n < K.cap; i++) { const o = i * 3, vx = fl.vel[o], vz = fl.vel[o + 2], t = TT[i % 4]; put(D, n++, fl.pos[o] - cx, fl.pos[o + 1] - cy, fl.pos[o + 2] - cz, 0.62 + 0.18 * ((i * 0.618) % 1), yawOf(vx, vz), 0, 0, fl.phase[i], t[0], t[1], t[2], s.b.sky, 0, 0, 0, 0.07, 0, 0.45); } }
        if (n) list.push([K, n]);
      }
      // the butterflies, the dragonflies
      if (this.swarms.length) {
        const K = WG.kind(gl, 'bfly', KINDCAP.bfly), D = K.data, SP = [[1.0, 0.86, 0.22], [1.0, 0.55, 0.12], [0.45, 0.72, 1.0], [0.98, 0.97, 0.93], [0.85, 0.16, 0.2]]; let n = 0;
        for (const s of this.swarms) {
          const sw = s.sw; if (Math.hypot(s.home.x - cx, s.home.z - cz) > 48) continue;
          for (let i = 0; i < sw.n && n < K.cap; i++) {
            const o = i * 3, st = sw.state[i], c = SP[sw.kind[i]], sit = st === 1;
            const yaw = sit ? sw.seedOf[i] : yawOf(sw.vel[o], sw.vel[o + 2]);
            put(D, n++, sw.pos[o] - cx, sw.pos[o + 1] - cy, sw.pos[o + 2] - cz, 0.34 + 0.05 * (sw.kind[i] % 3), yaw, sit ? 0 : 0.25, 0, sw.phase[i], c[0], c[1], c[2], s.sky, sit ? 0.35 : 1.05, 0, sit ? 0.95 : 0.4, 0, 0, 0.15);
          }
        }
        if (n) list.push([K, n]);
      }
      if (this.dflies.length) {
        const K = WG.kind(gl, 'dfly', KINDCAP.dfly), D = K.data; let n = 0;
        for (const p of this.dflies) { if (Math.hypot(p.x - cx, p.z - cz) > 40) continue; for (const q of p.list) { if (n >= K.cap) break; const c = q.col; put(D, n++, q.x - cx, q.y - cy, q.z - cz, 0.55, q.yaw, 0, 0, q.ph, c[0], c[1], c[2], p.sky, 0.22, 0, 0.05, 0, 0, 0.6); } }
        if (n) list.push([K, n]);
      }
      // the sky rays (glowing brighter at night)
      if (this.rays.length) {
        const K = WG.kind(gl, 'ray', KINDCAP.ray), D = K.data; let n = 0;
        // (f-wild2: the wing curve's beat, lag and droop — wildsim.js rayWing, the shader's mode 4; the glow along the
        //  wing edges brighter from the golden hour on and at night)
        const RY = W.RAY, tod = this.ctx ? this.ctx.tod : 6000, dusk = sm((tod - 10200) / 1400) * (1 - sm((tod - 13600) / 1200)), gw = 0.35 + 0.65 * Math.max(night, dusk);
        for (let k = 0; k < this.rays.length; k++) { const R = this.rays[k], x = R[0] - cx, y = R[1] - cy, z = R[2] - cz; if (x * x + z * z > 1100 * 1100) continue; put(D, n++, x, y, z, R[7], R[3], R[4], R[5], R[6], 1, 1, 1, 1, RY.wingA, RY.wingK, RY.rest, 0, gw, 0.35, k & 1 ? 0.65 : 0); }
        if (n) list.push([K, n]);
      }
      this.stats.draws = list.length ? WG.draw(r, E, list) : 0;
      this.stats.n.inst = 0; for (const [, n] of list) this.stats.n.inst += n;
      // the voxel animals: the herons, the rabbits, the fox
      this.drawVox(r, E, cam);
      this.stats.drawMs = this.stats.drawMs * 0.9 + (performance.now() - t0) * 0.1;
    }
    // (f-wild2) the murmuration's density cloud, in the translucent pass: each boid far enough that its party draws only
    // some of its birds is one impostor whose optical depth carries the rest — the boids' density round it (Flock.dens)
    // and how far its wings turn to the eye (W.puffTau); overlapping, they blend into a dark core with a lighter rim
    drawCloud(r, E, cam) {
      const Mu = this.murm, cap = this.b.cap, list = this.list;
      list.length = 0;
      if (!Mu || !cap.murm || Mu.state !== 'fly') return;
      const fl = Mu.fl, cx = cam.x, cy = cam.y, cz = cam.z;
      if (Math.hypot(fl.ctr[0] - cx, fl.ctr[2] - cz) > 520) return;
      const gl = r.gl, K = WG.kind(gl, 'puff', KINDCAP.flock), D = K.data, ex = Mu.ex, KB = W.MURM_K, R = W.PUFF.R, put = WG.put;
      let n = 0;
      for (let i = 0; i < Mu.n && n < K.cap; i++) {
        const o = i * 3, vx = fl.vel[o], vy = fl.vel[o + 1], vz = fl.vel[o + 2];
        const x = fl.pos[o] + vx * ex - cx, y = fl.pos[o + 1] + vy * ex - cy, z = fl.pos[o + 2] + vz * ex - cz, d = Math.sqrt(x * x + y * y + z * z) + 1e-4;
        const kv = W.birdsVisible(d);
        if (kv >= KB) continue;
        // the wings' plane: the boid's up, banked about its heading; its turn to the eye's ray
        const sv = Math.hypot(vx, vy, vz) + 1e-6, fx = vx / sv, fy = vy / sv, fz = vz / sv, hl = Math.hypot(fx, fz) + 1e-6, rx = -fz / hl, rz = fx / hl;
        const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy, b = fl.bank[i], cb = Math.cos(b), sb = Math.sin(b);
        const nx = ux * cb + rx * sb, ny = uy * cb, nz = uz * cb + rz * sb, ndv = Math.abs(nx * x + ny * y + nz * z) / d;
        const tau = W.puffTau(fl.dens[i], ndv, kv, KB, Mu.n);
        if (tau < 0.004) continue;
        put(D, n++, x, y, z, R, 0, 0, 0, 0, 0.022, 0.02, 0.026, tau, 0, 0, 0, 0, 0, 0, 0);
      }
      if (!n) return;
      list.push([K, n]);
      this.stats.drawsT = WG.draw(r, E, list);
    }
    drawVox(r, E, cam) {
      const g = this.g, ent = g.entities;
      if (!ent || (!this.herons.length && !this.rabbits.length && !this.fox)) return;
      let prog = null; const pg = () => prog || (prog = ent.beginVox(r, E));
      const t = g.time || this.time;
      for (const h of this.herons) {
        const dx = h.pos[0] - cam.x, dz = h.pos[2] - cam.z; if (dx * dx + dz * dz > 100 * 100) continue;
        const model = VR.getVoxModel(r.gl, 'wild_heron'); if (!model) continue;
        // the wings: folded down the flanks (wing 0) … spread and beating (wing 1); the neck folded in flight; the legs trail
        const pose = h.pose || (h.pose = { wing_l: [0, 0, 0, 0, 0, 0], wing_r: [0, 0, 0, 0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0], legs: [0, 0, 0] });
        // folded, a wing lies along the flank with its tip back over the tail (the span turned back, the chord down, a
        // little lower at the shoulder); spread, it beats about the shoulder
        const fw = 1 - h.wing, beat = h.wing * (Math.sin(h.ph) * 0.85 * h.flap + 0.1), Q = Math.PI / 2;
        pose.wing_l[0] = Q * fw; pose.wing_l[1] = Q * fw; pose.wing_l[2] = -beat; pose.wing_l[4] = -2 * fw;
        pose.wing_r[0] = Q * fw; pose.wing_r[1] = -Q * fw; pose.wing_r[2] = beat; pose.wing_r[4] = -2 * fw;
        pose.neck[0] = h.state === 'stand' ? 0.05 : h.state === 'crouch' ? 0.45 : -0.8 * h.wing; pose.neck[1] = h.state === 'stand' ? h.look * 0.5 : 0;
        pose.head[0] = h.state === 'stand' ? -0.1 + Math.sin(t * 0.7 + h.a) * 0.08 : 0.9 * h.wing; pose.head[1] = h.state === 'stand' ? h.look * 0.4 : 0;
        pose.legs[0] = 1.25 * h.legs;
        const light = ent.lightAt(h.pos[0], h.pos[1] + 1, h.pos[2]);
        ent.drawModel(r, pg(), model, h.pos, cam, h.yaw, pose, light, { shade: 0, pitch: h.pitch || 0, scale: 1.15 });
      }
      for (const q of this.rabbits) {
        const dx = q.pos[0] - cam.x, dz = q.pos[2] - cam.z; if (dx * dx + dz * dz > 60 * 60) continue;
        const model = VR.getVoxModel(r.gl, 'wild_rabbit'); if (!model) continue;
        q.pet = q.pet || { state: 'sit' }; q.pet.state = q.hop ? 'follow' : 'sit';
        const P = VR.Companions && VR.Companions.poseOf ? VR.Companions.poseOf(q, t) : {};
        if (P.head && !q.hop) P.head[0] += q.state === 'graze' ? -0.55 + Math.max(0, Math.sin(t * 7 + q.id)) * 0.18 : 0.25 * q.alert;
        if (P.ear_l) { P.ear_l[0] = -0.25 * (1 - q.alert); P.ear_r[0] = -0.25 * (1 - q.alert); }
        if (P.body && q.alert > 0.5 && !q.hop) P.body[0] += 0.35 * q.alert;
        ent.drawModel(r, pg(), model, q.pos, cam, q.yaw, P, ent.lightAt(q.pos[0], q.pos[1] + 0.4, q.pos[2]), { shade: 0, scale: 0.85 });
      }
      const f = this.fox;
      if (f) {
        const dx = f.pos[0] - cam.x, dz = f.pos[2] - cam.z;
        const model = VR.getVoxModel(r.gl, 'wild_fox');
        if (model && dx * dx + dz * dz < 70 * 70) {
          const P = VR.Companions && VR.Companions.poseOf ? VR.Companions.poseOf(f, t) : {};
          if (P.head && f.state === 'sniff') P.head[0] = -0.8 + Math.sin(t * 9) * 0.06;
          if (P.body && f.state === 'pounce') P.body[0] = -0.5 + f.jump * 0.8;
          ent.drawModel(r, pg(), model, f.pos, cam, f.yaw, P, ent.lightAt(f.pos[0], f.pos[1] + 0.5, f.pos[2]), { shade: 0 });
        }
      }
    }
    // what the tests read
    report() {
      const Mu = this.murm, nb = (a) => a.reduce((s, q) => s + q.n, 0);
      return {
        on: this.on, tier: this.b.tier, cap: Object.assign({}, this.b.cap),
        murm: Mu ? { n: Mu.n, ph: Mu.ph, state: Mu.state, ctr: Array.from(Mu.fl.ctr).map(v => +v.toFixed(1)), spread: +Mu.fl.spread().toFixed(1), stage: Mu.st, landed: Mu.landed.reduce((s, v) => s + v, 0), roost: Mu.roost ? Mu.roost.map(v => +v.toFixed(1)) : null, noRoost: !!Mu.noRoost } : null,
        gulls: this.gulls.length, herons: this.herons.map(h => ({ state: h.state, pos: h.pos.map(v => +v.toFixed(1)), pond: [h.pond.x, h.pond.z] })),
        shoals: this.shoals.map(s => ({ key: s.key, n: s.n, b: { x: +s.b.x.toFixed(1), z: +s.b.z.toFixed(1), r: +s.b.r.toFixed(1), y0: +s.b.y0.toFixed(2), y1: +s.b.y1.toFixed(2) }, ctr: Array.from(s.fl.ctr).map(v => +v.toFixed(1)), follow: !!s.follow, fishPos: Array.from({ length: s.n }, (_, i) => [+s.fl.pos[i * 3].toFixed(2), +s.fl.pos[i * 3 + 1].toFixed(2), +s.fl.pos[i * 3 + 2].toFixed(2)]) })), fish: nb(this.shoals), carp: nb(this.carps),
        swarms: this.swarms.map(s => ({ home: [+s.home.x.toFixed(1), +s.home.y.toFixed(1), +s.home.z.toFixed(1)], n: s.n, flowers: s.sw.flowers.length, up: Array.from(s.sw.state).filter(v => v === 2).length })),
        dflies: this.dflies.reduce((s, p) => s + p.list.length, 0), rays: this.rays.map(R => Array.from(R).map(v => +v.toFixed(2))),
        rabbits: this.rabbits.map(q => ({ state: q.state, pos: q.pos.map(v => +v.toFixed(1)) })), fox: this.fox ? { state: this.fox.state, pos: this.fox.pos.map(v => +v.toFixed(1)) } : null,
        drifts: this.scan.drifts ? this.scan.drifts.length : 0, cover: this.scan.cover.length,
        ms: Object.assign({}, this.stats.avg), drawMs: +this.stats.drawMs.toFixed(3), draws: this.stats.draws, inst: this.stats.n.inst || 0,
        // (f-wild2) the murmuration's figure, the pass at dusk
        figure: Mu && Mu.state === 'fly' && this.ctx ? W.murmFigure(this.seed ^ Mu.key, this.ctx.clock) : null,
        pass: this.pass ? { day: this.pass.day, tried: this.pass.tried, plan: this.pass.plan ? { k: this.pass.plan.k, T0: +this.pass.plan.T0.toFixed(1), Tn: +this.pass.plan.Tn.toFixed(1), T1: +this.pass.plan.T1.toFixed(1), P: this.pass.plan.P.map(v => +v.toFixed(1)), scale: +this.pass.plan.scale.toFixed(2) } : null } : null,
        clock: this.ctx ? +this.ctx.clock.toFixed(2) : null,
      };
    }
  }
  W.Actor = Actor;
  // the carp: slow and few, a loose group near the pond's bottom
  W.CARP = Object.assign({}, W.SHOAL, { r: 3, K: 6, maxC: 12, sepR: 1.4, wSep: 10, wAli: 1.2, wCoh: 0.35, wTgt: 0.9, tgtR: 1.6, vmin: 0.25, vmax: 0.95, amax: 4, fearR: 3, fearA: 6 });
})(VR);
