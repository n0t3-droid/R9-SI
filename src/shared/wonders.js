// ============================================================================
// ✨ Wunder der Welt — rare landmarks worth setting out for (wave 2, W-A).
// Where they stand: a grid of 640-block cells; a hash of (seed, cell) gives a
// cell a wonder six times in ten, on dry, gentle ground that keeps clear of
// everything the generator builds — villages (their whole reach), the sky
// rails between them, outposts and their rails, citadels and their viaducts,
// sky islands overhead, the Heartland's temple and designed lands — and of
// the world spawn. The spawn's own cell always has one, 250–450 blocks out,
// its entrance turned toward the spawn: a new player finds it on day one.
// What stands there: one of eight wonders, by the biome where one fits
// (crystal fields → the cathedral, forests → the giant tree, coasts → the
// lighthouse …). Sites are read in the worker (they need the terrain); the
// game builds a wonder when you come near (src/main/wonders_game.js) — the
// chunk generator never does, so old worlds keep their terrain exactly.
// The eight generators (wonders_build.js) are one Forge type, 'wonder', hidden
// from the Forge's list: `wonder:sternwarte#1a2b` builds through the game's
// forge plans (the levelled lot, the slices) like any Forge structure.
// ============================================================================
(function (VR) {
  'use strict';
  const M = VR.M, SEA = VR.C.SEA;
  const W = VR.Wonders = { CELL: 640, CHANCE: 0.6, GENS: {} };
  // the eight: German first (the names the owner gave them), English our own; prefer = the biomes where one fits
  W.TYPES = [
    { id: 'kristall', icon: '💎', de: 'Kristallkathedrale', en: 'Cathedral of Crystals', prefer: /prism|crystal|cherry|amethyst/, lot: [45, 58] },
    { id: 'regenbogen', icon: '🌈', de: 'Regenbogenbrücke', en: 'Rainbow Arch', prefer: /river|flower|sunflower|meadow|lush/, coast: true, lot: [17, 62] },
    { id: 'sternwarte', icon: '🔭', de: 'Sternwarte', en: 'Star Observatory', prefer: /windswept|hills|plateau|slopes|grove|meadow/, lot: [41, 45] },
    { id: 'riesenbaum', icon: '🌳', de: 'Riesenbaum', en: 'Giant Tree', prefer: /forest|jungle|taiga|dappled|pale_garden/, lot: [57, 57] },
    { id: 'wolkenturm', icon: '🗼', de: 'Wolkenleuchtturm', en: 'Cloud Lighthouse', prefer: /beach|shore|stony|windswept/, coast: true, lot: [37, 41] },
    { id: 'labyrinth', icon: '🌿', de: 'Labyrinthgarten', en: 'Maze Garden', prefer: /plains|meadow|sky_meadow|flower|savanna_plateau/, lot: [61, 61] },
    { id: 'pyramide', icon: '☀️', de: 'Sonnenpyramide', en: 'Golden Sun Pyramid', prefer: /desert|savanna|badlands|ember/, lot: [51, 57] },
    { id: 'mondtempel', icon: '🌙', de: 'Mondtempel', en: 'Moonlight Temple', prefer: /snow|ice|frozen|taiga|grove|tundra|cold/, lot: [45, 55] },
  ];
  W.type = (id) => W.TYPES.find(t => t.id === id) || null;
  W.dna = (type, seed) => 'wonder:' + type + '#' + ((seed >>> 0) & 0xffffffff || 1).toString(16);
  // a name as people write it ("Sternwarte", "die sternwarte", "star observatory", "Kristall-Kathedrale") → the type id
  const fold = (s) => String(s || '').toLowerCase().replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss').replace(/[^a-z]/g, '');
  // (a lighthouse or a tower alone stays the Forge's lookout: only the wonder's own names and words that belong to no
  // Forge type name a wonder)
  W.byName = function (text) {
    const f = fold(text); if (f.length < 4) return null;
    for (const t of W.TYPES) { if (f === t.id) return t.id; for (const nm of [t.de, t.en]) { const k = fold(nm); if (f === k || f.includes(k)) return t.id; } }
    const WORDS = { kristall: ['kathedrale', 'cathedral', 'kristallkirche'], regenbogen: ['regenbogen', 'rainbow'], sternwarte: ['observatorium', 'observatory', 'teleskop', 'telescope'], riesenbaum: ['baumriese', 'giantree', 'riesenbaume'], wolkenturm: ['wolkenturm', 'cloudtower', 'cloudlighthouse'], labyrinth: ['labyrinth', 'irrgarten', 'maze'], pyramide: ['pyramide', 'pyramid'], mondtempel: ['mondtempel', 'moontemple', 'moonlight'] };
    for (const id in WORDS) for (const w of WORDS[id]) if (f.includes(w)) return id;
    return null;
  };

  // ---------------------------------------------------------------- where a wonder may stand
  // only in the normal overworld (climate, many biomes); a flat or one-biome world has none
  const usable = (g) => !!(g && g.climateAt && g.surfaceY && !(g.singleBiome >= 0) && !g.flat);
  W.usable = usable;
  const BAD = /ocean|river|beach|shore|swamp|mangrove|mushroom|peaks|ice_spikes|deep_dark|frozen_river|stony|jagged|ember_canyons/;
  const segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz; let t = L ? ((px - ax) * dx + (pz - az) * dz) / L : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - t * dx, pz - az - t * dz); };
  // the sky rail between two villages (gen_rails.js), as straight segments on the ground plan: the same geometry the
  // generator lays its viaduct along (a line it drops later is still avoided — a wonder never cuts through one)
  function railSegs(g, A, B) {
    const VG = VR.VillageGen, dx = B.x - A.x, dz = B.z - A.z, sx = Math.sign(dx) || 1, sz = Math.sign(dz) || 1;
    const out = VG.rad(g) + 8, SHIFT = 10, JOG = out + 24, adx = Math.abs(dx), adz = Math.abs(dz);
    if (adz < JOG && adx >= adz) { const z = A.z + Math.round(dz / 2); return [[A.x + sx * out, z, B.x - sx * out, z]]; }
    if (adx < JOG) { const x = A.x + Math.round(dx / 2); return [[x, A.z + sz * out, x, B.z - sz * out]]; }
    if (adx >= adz) { const z0 = A.z + sz * SHIFT, x1 = B.x - sx * SHIFT; return [[A.x + sx * out, z0, x1, z0], [x1, z0, x1, B.z - sz * out]]; }
    const x0 = A.x + sx * SHIFT, z1 = B.z - sz * SHIFT; return [[x0, A.z + sz * out, x0, z1], [x0, z1, B.x - sx * out, z1]];
  }
  // the villages within r of (x, z) (cells of the village grid)
  function villagesNear(g, x, z, r) {
    const VG = VR.VillageGen; if (!VG) return [];
    const C = VG.cell(g), R0 = Math.ceil(r / C), ci = Math.floor(x / C), cj = Math.floor(z / C), out = [];
    for (let dj = -R0; dj <= R0; dj++) for (let di = -R0; di <= R0; di++) { const s = VG.site(g, ci + di, cj + dj); if (s && Math.abs(s.x - x) <= r + C && Math.abs(s.z - z) <= r + C) out.push(s); }
    return out;
  }
  // the ground of a footprint: 5 × 5 samples over ±30 (the 64-wide lot and its verge) → {min, max, mid, wet}
  // (shallow water at the rim is fine — the levelling fills it — deep water or water inside the lot is not)
  function footprint(g, x, z, full) {
    const hs = [], pts = full ? [-30, -15, 0, 15, 30] : [-30, 30];
    let wet = 0, deep = 0;
    for (const dz of pts) for (const dx of pts) {
      const h = g.surfaceY(x + dx, z + dz), rim = Math.abs(dx) === 30 || Math.abs(dz) === 30;
      if (h <= SEA + 1) { if (!rim || h < SEA - 3) deep++; else wet++; continue; }
      hs.push(h);
    }
    hs.sort((a, b) => a - b);
    return { min: hs[0], max: hs[hs.length - 1], mid: hs[hs.length >> 1], wet, deep, n: hs.length };
  }
  // is (x, z) a good place for a wonder? → {y, biome, coast} or null. relax (0 … 1) loosens the slope for the spawn's
  // search when no gentle spot is in reach
  // (W.dbg = {} counts why places are turned down — for tuning)
  const no = (why) => { if (W.dbg) W.dbg[why] = (W.dbg[why] || 0) + 1; return null; };
  W.place = function (g, x, z, spawn, relax) {
    relax = relax || 0;
    const cl = g.climateAt(x, z);
    if ((cl.canyon || 0) > 0.12 || (cl.ember || 0) > 0.35 || (cl.river || 0) > 0.3) return no('climate');
    const h0 = g.surfaceY(x, z);
    if (h0 <= SEA + 1 || h0 > 150) return no(h0 <= SEA + 1 ? 'sea' : 'high');
    const b = VR.BIOMES[g.biomeFor(cl, h0)];
    if (!b || b.ocean || BAD.test(b.key)) return no('biome');
    // the Heartland: never near its temple, never in its designed lands (city, Pod Hills, canyon, citadel mountain,
    // station peaks, the lowland under the Sky Isles, the Gate Plateau)
    const H = VR.Heart;
    if (H && H.on && H.on(g)) {
      if (Math.hypot(x - H.TEMPLE.x, z - H.TEMPLE.z) < 160 + 40) return no('temple');
      if (Math.hypot(x, z) < H.R1 + 80) {
        const D = H.design(g, x, z);
        if (D && (D.plat > 0.02 || D.city > 0.04 || D.hills > 0.12 || D.cz > 0.08 || D.mount > 0.04 || D.peak > 0.04 || D.isleLow > 0.06)) return no('heartland');
      }
    }
    if (spawn && Math.hypot(x - spawn[0], z - spawn[1]) < 160) return no('spawn');
    // a quick look at the footprint's corners before the whole of it
    // (relax 2 is the spawn's last resort in a crowded or rugged ring: steeper, wetter at the rim, nearer a village —
    // still clear of its reach)
    const RELIEF = 20 + relax * 8, RIMWET = relax >= 2 ? 6 : 3;
    const q = footprint(g, x, z, false);
    if (q.deep || q.wet > (relax >= 2 ? 2 : 1) || !q.n) return no('water');
    if (Math.max(q.max, h0) - Math.min(q.min, h0) > RELIEF) return no('slope');
    const f = footprint(g, x, z, true);
    if (f.deep || f.wet > RIMWET) return no('water');
    if (f.max - f.min > RELIEF) return no('slope');
    // villages: their whole reach (a modern town spreads 230 blocks) plus room for the lot
    for (const v of villagesNear(g, x, z, 420)) { const need = relax >= 2 ? Math.max(160, (VR.VillageGen.siteRad(g, v) || 80) + 70) : Math.max(160, (VR.VillageGen.siteRad(g, v) || 80) + 96); if (Math.hypot(v.x - x, v.z - z) < need) return no('village'); }
    // the sky rails between villages
    const RG = VR.RailGen;
    if (RG && RG.linkFrom) for (const v of villagesNear(g, x, z, 1200)) {
      const lk = RG.linkFrom(g, v); if (!lk) continue;
      if (x < Math.min(lk.a.x, lk.b.x) - 120 || x > Math.max(lk.a.x, lk.b.x) + 120 || z < Math.min(lk.a.z, lk.b.z) - 120 || z > Math.max(lk.a.z, lk.b.z) + 120) continue;
      for (const s of railSegs(g, lk.a, lk.b)) if (segDist(x, z, s[0], s[1], s[2], s[3]) < 60) return no('rail');
    }
    // outposts and their rails, citadels and their viaducts
    if (g.nearestOutpost) {
      const o = g.nearestOutpost(x, z);
      if (o) {
        if (Math.hypot(o.x - x, o.z - z) < 110) return no('outpost');
        if (o.rail) { const L = 9 + o.railLen, d = [[-1, 0], [0, -1], [1, 0], [0, 1]][o.dir & 3]; if (segDist(x, z, o.x, o.z, o.x + d[0] * L, o.z + d[1] * L) < 60) return no('outpost'); }
      }
    }
    if (g.nearestCitadel) {
      const c = g.nearestCitadel(x, z, 1200);
      if (c) {
        if (Math.hypot(c.x - x, c.z - z) < (c.R || 34) + 120) return no('citadel');
        for (const v of c.viaducts || []) if (segDist(x, z, v.x0, v.z0, v.x0 + Math.cos(v.a) * v.len, v.z0 + Math.sin(v.a) * v.len) < 60) return no('citadel');
      }
    }
    // sky islands: none hanging low over the lot
    if (g.islandAt) for (const [dx, dz] of [[0, 0], [-24, -24], [24, -24], [-24, 24], [24, 24]]) { const I = g.islandAt(x + dx, z + dz); if (I && I.bottom < f.mid + 140) return no('island'); }
    // a coast or a lake in sight (for the lighthouse and the rainbow): water in a ring 60–90 out
    let coast = 0; for (let a = 0; a < 8; a++) { const r = a & 1 ? 90 : 64; if (g.surfaceY(Math.round(x + Math.cos(a * 0.785) * r), Math.round(z + Math.sin(a * 0.785) * r)) <= SEA) coast++; }
    return { y: f.mid, biome: b.key, coast, relief: f.max - f.min };
  };
  // the wonder for a place: a type that fits the biome (seven times in ten when there is one), else any
  W.typeAt = function (g, x, z, rng, info) {
    info = info || W.place(g, x, z, null) || { biome: '', coast: 0 };
    const fits = W.TYPES.filter(t => t.prefer.test(info.biome || '') || (t.coast && info.coast >= 2));
    if (fits.length && rng.chance(0.72)) return rng.pick(fits).id;
    return rng.pick(W.TYPES).id;
  };
  // facing r turns the lot's front (street side, v = 0) toward FRONT[r] (blueprints.js)
  const FRONT = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const faceToward = (dx, dz) => { let best = 0, bd = -9; for (let r = 0; r < 4; r++) { const d = FRONT[r][0] * dx + FRONT[r][1] * dz; if (d > bd) { bd = d; best = r; } } return best; };
  W.faceToward = faceToward;
  const keyOf = (i, j) => i + '_' + j;
  // does the hash give cell (i, j) a wonder at all (before the ground is asked)? — six cells in ten
  W.roll = (g, i, j) => new VR.RNG(M.hash2(i, j, g.seed + 0x57a2d)).chance(W.CHANCE);
  // the site of cell (i, j) for a world whose spawn is at spawn = [x, z]: {key, i, j, x, z, y, type, seed, r, first} or null
  W.site = function (g, i, j, spawn) {
    if (!usable(g)) return null;
    const sp = spawn && Number.isFinite(spawn[0]) && Number.isFinite(spawn[1]) ? [Math.round(spawn[0]), Math.round(spawn[1])] : [0, 0];
    const sk = sp[0] + ',' + sp[1];
    if (!g._wonders || g._wonders.sk !== sk) g._wonders = { sk, map: new Map(), first: undefined };
    const C = g._wonders, key = keyOf(i, j);
    if (C.map.has(key)) return C.map.get(key);
    if (C.map.size > 800) C.map.clear();
    const si = Math.floor(sp[0] / W.CELL), sj = Math.floor(sp[1] / W.CELL);
    let site = null;
    if (i === si && j === sj) site = firstSite(g, sp);
    else {
      const rng = new VR.RNG(M.hash2(i, j, g.seed + 0x57a2d));
      if (rng.chance(W.CHANCE)) {
        // the gentlest good place on a 5 × 5 grid over the cell's middle (125 … 513: sites of neighbouring cells
        // stay ≥ 250 apart), a little jitter so no two worlds share a pattern
        const first = Math.abs(i - si) <= 1 && Math.abs(j - sj) <= 1 ? firstOf(g, sp) : null;
        let best = null;
        for (let b = 0; b < 5; b++) for (let a = 0; a < 5; a++) {
          const x = i * W.CELL + 135 + a * 92 + rng.int(21) - 10, z = j * W.CELL + 135 + b * 92 + rng.int(21) - 10;
          if (first && Math.hypot(first.x - x, first.z - z) < 300) continue;
          const P = W.place(g, x, z, sp); if (!P) continue;
          const score = P.relief + Math.hypot(a - 2, b - 2) * 0.8;
          if (!best || score < best.score) best = { x, z, P, score };
        }
        if (best) site = { key, i, j, x: best.x, z: best.z, y: best.P.y, type: W.typeAt(g, best.x, best.z, rng, best.P), seed: (rng.int(0x7fffffff) >>> 0) || 1, r: rng.int(4), first: false };
      }
    }
    C.map.set(key, site);
    return site;
  };
  // the spawn's cell: the best gentle spot in the ring 250–450 around the spawn, its entrance toward the spawn
  const firstOf = (g, sp) => { const C = g._wonders; if (C.first === undefined) C.first = firstSite(g, sp); return C.first; };
  function firstSite(g, sp) {
    const C = g._wonders; if (C.first !== undefined) return C.first;
    const i = Math.floor(sp[0] / W.CELL), j = Math.floor(sp[1] / W.CELL), rng = new VR.RNG(M.hash2(i, j, g.seed + 0xf1a57));
    const a0 = rng.next() * Math.PI * 2;
    let best = null;
    for (const relax of [0, 0.5, 1, 2]) {
      const N = relax >= 2 ? 36 : 20;
      for (const r of [300, 360, 260, 420, 330, 390, 445]) {
        for (let k = 0; k < N; k++) {
          const a = a0 + (k + (r % 7) * 0.31) * Math.PI * 2 / N, x = Math.round(sp[0] + Math.cos(a) * r), z = Math.round(sp[1] + Math.sin(a) * r);
          const P = W.place(g, x, z, sp, relax); if (!P) continue;
          const score = P.relief + Math.abs(r - 320) * 0.02 + (P.coast >= 6 ? 3 : 0);
          if (!best || score < best.score) best = { x, z, P, score };
        }
        if (best && best.P.relief <= 8) break;
      }
      if (best) break;
    }
    if (!best) { C.first = null; return null; }
    const site = { key: keyOf(i, j), i, j, x: best.x, z: best.z, y: best.P.y, type: W.typeAt(g, best.x, best.z, rng, best.P), seed: (rng.int(0x7fffffff) >>> 0) || 1, r: faceToward(sp[0] - best.x, sp[1] - best.z), first: true };
    C.first = site;
    return site;
  }
  // every site within r of (x, z), the nearest first — what the worker job 'wonders' sends the game
  W.near = function (g, x, z, r, spawn) {
    if (!usable(g)) return [];
    const R0 = Math.ceil(r / W.CELL), ci = Math.floor(x / W.CELL), cj = Math.floor(z / W.CELL), out = [];
    for (let dj = -R0; dj <= R0; dj++) for (let di = -R0; di <= R0; di++) { const s = W.site(g, ci + di, cj + dj, spawn); if (s && Math.hypot(s.x - x, s.z - z) <= r) out.push(s); }
    out.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    return out;
  };
  // the worker's job: {x, z, r, spawn, budget?} → {type:'wonders', list, more}. A cold cell costs its terrain samples
  // (20–60 ms): with a budget (ms) the job computes the nearest cells it has time for and says more = true — the game
  // asks again a moment later, the worker's other jobs run in between
  W.job = function (g, m) {
    const r = Math.min(3000, m.r || 1500), list = [];
    if (!usable(g)) return { type: 'wonders', id: m.id, list, more: false };
    const R0 = Math.ceil(r / W.CELL), ci = Math.floor(m.x / W.CELL), cj = Math.floor(m.z / W.CELL), cells = [];
    for (let dj = -R0; dj <= R0; dj++) for (let di = -R0; di <= R0; di++) {
      const i = ci + di, j = cj + dj, nx = Math.max(i * W.CELL, Math.min(m.x, (i + 1) * W.CELL)), nz = Math.max(j * W.CELL, Math.min(m.z, (j + 1) * W.CELL));
      const d = Math.hypot(nx - m.x, nz - m.z); if (d <= r) cells.push([d, i, j]);
    }
    cells.sort((a, b) => a[0] - b[0]);
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()), t0 = now();
    let more = false;
    for (const [, i, j] of cells) {
      if (m.budget && now() - t0 > m.budget && !(g._wonders && g._wonders.map.has(keyOf(i, j)))) { more = true; continue; }
      const s = W.site(g, i, j, m.spawn); if (s && Math.hypot(s.x - m.x, s.z - m.z) <= r) list.push(Object.assign({}, s));
    }
    list.sort((a, b) => Math.hypot(a.x - m.x, a.z - m.z) - Math.hypot(b.x - m.x, b.z - m.z));
    return { type: 'wonders', id: m.id, list, more };
  };
  // a site's wonder: the Forge DNA and its build (the game builds it through its forge plans)
  W.dnaOf = (s) => W.dna(s.type, s.seed);
  W.build = function (type, seed, env) { return VR.Forge.build(W.dna(type, seed), env); };
  // the gift: every wonder found on this device (a viewer's convenience, kept across worlds): {type: seed} in
  // localStorage. The Studio's Forge offers each as a ✨ chip (it builds anywhere). Storage that is blocked or full just
  // keeps nothing.
  const GIFT_KEY = 'r9si.wonderGifts';
  W.gifts = function () {
    try { const o = JSON.parse(localStorage.getItem(GIFT_KEY) || '{}') || {}; return W.TYPES.filter(t => o[t.id] > 0).map(t => ({ type: t.id, seed: o[t.id] >>> 0, de: t.de })); }
    catch (e) { return []; }
  };
  W.giveGift = function (type, seed) {
    try { const o = JSON.parse(localStorage.getItem(GIFT_KEY) || '{}') || {}; if (!(o[type] > 0) && W.type(type)) { o[type] = (seed >>> 0) || 1; localStorage.setItem(GIFT_KEY, JSON.stringify(o)); } }
    catch (e) { /* no storage: the wonder is still found in this world */ }
  };

  // ---------------------------------------------------------------- the hidden Forge type
  // registered like any Forge structure (Forge.parse / build / meta / job), then taken out of the Forge's list: the
  // Studio's 🏭 chips and the Forge's text parser never offer it; /bau <Name> builds one after it was discovered
  const Forge = VR.Forge;
  if (Forge && Forge.register && !Forge.TYPES.wonder) {
    const t = Forge.register({
      id: 'wonder', icon: '✨', name: 'Wunder', en: 'Wonder', level: true, sh: 1, params: [],
      styles: W.TYPES.map(tp => ({ id: tp.id, name: tp.de })),
      lot: (P) => (W.type(P.style) || W.TYPES[0]).lot.slice(),
      title: (P) => (W.type(P.style) || W.TYPES[0]).de,
      describe: () => [],
    }, function (P, env) {
      const fn = W.GENS[P.style] || W.GENS[W.TYPES[0].id];
      if (!fn) throw new Error('Wonders: no generator for ' + P.style);
      return fn(P, env, Forge.rng(P, 'wonder:' + P.style));
    });
    const i = Forge.types.indexOf(t); if (i >= 0) Forge.types.splice(i, 1);
  }
})(VR);
