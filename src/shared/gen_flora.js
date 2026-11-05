// ============================================================================
// v-flora · the land between in bloom (vgen 17; docs/superpowers/plans/2026-11-05-v-flora.md). The land's woods and
// meadows (gen_land.js) are kept as they are for every older world; a vgen-17 world wraps them:
//   the trees    most solo meadow trees grow as L-system blossom trees (VR.Flora: Wolkenkirsche, Schneeschleier,
//                Lilaschirm, Sonnenregen — one kind per neighbourhood, a slow noise), the cherry groves too, and at the
//                woods' edges a golden or violet tree now and then; flowering shrubs (Rosenbusch, Schneebusch,
//                Lilabusch) along the woods' edges and here and there in the meadow
//   the meadows  colour fields: broad drifts of one colour flowing over the hills (a slower sample of the drift noise,
//                a colour per field from another), denser than before, tall meadow flowers inside (Kerzenblume,
//                Schirmblume, Glockenturm); clover and tiny flowers along the ways' edges
//   the wonders  a piece of the plan: three Traumbäume (a giant blossom tree in a meadow, a carpet of petals under it,
//                spawn 'petals' for the land life) and two rings of Glimmglocken (a fairy ring with a mossy stone, spawn
//                'glowring': motes at night)
// Every choice is a hash or a noise of the world position: a tree over a chunk border is the same tree on both sides.
// ============================================================================
(function (VR) {
  'use strict';
  const LAND = VR.Land, GEN = VR.Gen || VR.GEN, FL = VR.Flora, R = VR.R, M = VR.M, F = VR.F;
  if (!LAND || !FL || !LAND.DRESS_WOODS) return;
  const G = VR.GEN || GEN || {};
  G.FLORA_VGEN = 17;
  const on = LAND.floraOn = (g) => !!g && (g.vgen | 0) >= 17 && LAND.on(g);
  const SEA = 62;
  const ss = M.smoothstep;
  const h01 = (x, z, s) => (M.hash2(x | 0, z | 0, s | 0) >>> 0) / 4294967296;
  const ck = (x, z) => x * 65536 + z;
  const stc = new Map();
  const st = (name, props) => { const key = props ? name + JSON.stringify(props) : name; let s = stc.get(key); if (s !== undefined) return s; const t = R.byName[name]; s = t ? (props ? t.state(props) : t.defaultState) : 0; stc.set(key, s); return s; };
  const leafSt = (name) => st(name, { persistent: 0, distance: 1 });
  const meadowAt = (g, x, z, y) => g.biomeFor(g.climateAt(x, z), y - 1) === VR.BIOME.sky_meadow;
  const plantFlora = (w, name, x, y, z, seed) => FL.plant(w, name, x, y, z, seed >>> 0, st, leafSt);
  // the blossom tree of a neighbourhood: a slow noise picks the kind, so a stretch of meadow has its own tree
  FL.treeAt = function (g, x, z, h) {
    const n = g.nLandK.n2(x * 1.1 + 4100, z * 1.1 - 2300) * 0.5 + 0.5;
    const i = Math.floor(n * 4 * 1.6 + h * 0.6) % 4;
    return FL.TREES[i];
  };

  // ---------------------------------------------------------------- the trees
  const baseSolo = LAND.soloTrees, baseWoods = LAND.woodsTrees, SOLO = 22, SP = 5;
  LAND.soloTrees = function (g, P, w, x0, z0, x1, z1, keep) {
    if (!on(g)) return baseSolo(g, P, w, x0, z0, x1, z1, keep);
    for (let gz = Math.floor(z0 / SOLO); gz <= Math.floor(z1 / SOLO); gz++) for (let gx = Math.floor(x0 / SOLO); gx <= Math.floor(x1 / SOLO); gx++) {
      const hx = M.hash2(gx, gz, g.seed ^ 0x501a) >>> 0;
      if ((hx & 1023) / 1024 > 0.66) continue;   // (vgen 16: 0.42 — a few more lone trees, most in bloom)
      const x = gx * SOLO + 3 + ((hx >>> 10) % (SOLO - 6)), z = gz * SOLO + 3 + ((hx >>> 18) % (SOLO - 6));
      if (x < x0 || x > x1 || z < z0 || z > z1 || (keep && !keep(x, z))) continue;
      if (LAND.woodAt(g, x, z).d > 0.05 || !LAND.treeOk(g, P, x, z)) continue;
      if (LAND.keepAt(P, x + 2, z) || LAND.keepAt(P, x - 2, z) || LAND.keepAt(P, x, z + 2) || LAND.keepAt(P, x, z - 2)) continue;
      const y = g.surfaceY(x, z) + 1;
      if (y <= SEA + 2 || !meadowAt(g, x, z, y)) continue;
      const rng = new VR.RNG((hx ^ 0x2545f491) >>> 0), r = rng.next();
      if (r < 0.74) plantFlora(w, FL.treeAt(g, x, z, rng.next()), x, y, z, hx);
      else if (r < 0.88) G.TREES.fancyOak(w, x, y, z, rng); else G.TREES.roundTree(w, x, y, z, rng, { r: 3.2, h: 4 });
    }
  };
  LAND.woodsTrees = function (g, P, w, x0, z0, x1, z1, keep) {
    if (!on(g)) return baseWoods(g, P, w, x0, z0, x1, z1, keep);
    for (let gz = Math.floor(z0 / SP); gz <= Math.floor(z1 / SP); gz++) for (let gx = Math.floor(x0 / SP); gx <= Math.floor(x1 / SP); gx++) {
      const hx = M.hash2(gx, gz, g.seed ^ 0x7ee51) >>> 0, x = gx * SP + (hx % SP), z = gz * SP + ((hx >>> 8) % SP);
      if (x < x0 || x > x1 || z < z0 || z > z1 || (keep && !keep(x, z))) continue;
      const q = LAND.woodAt(g, x, z), d = q.d, kind = q.kind;
      if (((hx >>> 16) & 1023) / 1024 >= d * 0.85) continue;
      if (!LAND.treeOk(g, P, x, z)) continue;
      const y = g.surfaceY(x, z) + 1;
      if (y <= SEA + 2 || !meadowAt(g, x, z, y)) continue;
      const rng = new VR.RNG((hx ^ 0x5bd1e995) >>> 0), u = h01(x, z, g.seed ^ 0xf10a);
      // the cherry groves bloom in L-system trees; the broadleaf woods' edges carry a blossom tree now and then
      if (kind === 4 && u < 0.7) plantFlora(w, u < 0.45 ? 'wolkenkirsche' : 'schneeschleier', x, y, z, hx);
      else if ((kind === 0 || kind === 1) && d < 0.55 && u < 0.14) plantFlora(w, u < 0.07 ? 'lilaschirm' : 'sonnenregen', x, y, z, hx);
      else LAND.plantTree(w, kind, x, y, z, rng);
    }
  };
  // the shrubs: a jittered 4-grid, along the woods' edges (a third of the cells) and in the open meadow (a few)
  const SH = 4;
  function shrubs(g, P, w, x0, z0, x1, z1) {
    for (let gz = Math.floor(z0 / SH); gz <= Math.floor(z1 / SH); gz++) for (let gx = Math.floor(x0 / SH); gx <= Math.floor(x1 / SH); gx++) {
      const hx = M.hash2(gx, gz, g.seed ^ 0x5b0b) >>> 0, x = gx * SH + (hx % SH), z = gz * SH + ((hx >>> 8) % SH);
      if (x < x0 || x > x1 || z < z0 || z > z1) continue;
      const q = LAND.woodAt(g, x, z), u = ((hx >>> 16) & 1023) / 1024;
      const p = q.d > 0.06 && q.d < 0.4 ? 0.34 : q.d <= 0.06 ? 0.06 : 0;
      if (u >= p || !LAND.treeOk(g, P, x, z)) continue;
      const y = g.surfaceY(x, z) + 1;
      if (y <= SEA + 1 || !meadowAt(g, x, z, y)) continue;
      const cur = w.get(x, y, z); if (cur > 0 && !(R.T.flags[cur] & (F.PLANT | F.REPLACE))) continue;
      plantFlora(w, FL.SHRUBS[(hx >>> 26) % 3], x, y, z, hx);
    }
  }
  FL.shrubs = shrubs;
  const baseTrees = LAND.DRESS_WOODS[0], baseGround = LAND.DRESS_WOODS[1];
  LAND.DRESS_WOODS[0] = function dressTrees17(g, P, cx, cz, out) {
    baseTrees(g, P, cx, cz, out);
    if (!on(g)) return;
    const w = new G.ColumnWriter(cx, cz, out.blocks), x0 = cx * 16, z0 = cz * 16;
    shrubs(g, P, w, x0 - 3, z0 - 3, x0 + 18, z0 + 18);
  };

  // ---------------------------------------------------------------- the meadows: colour fields, the ways' edges
  let FS = null;
  const fields = () => FS || (FS = (() => {
    const s = (n) => st(n), tall = (n) => [st(n, { half: 0 }), st(n, { half: 1 })];
    const CANDLE = tall('candle_flower'), UMBEL = tall('umbel_flower'), BELL = tall('bell_tower_flower');
    return {
      // [main, accent, tall (or null)]: one colour a field, an accent in it, tall flowers rising out of some
      F: [[s('poppy'), s('oxeye_daisy'), null], [s('cornflower'), s('oxeye_daisy'), CANDLE], [s('dandelion'), s('cornflower'), null], [s('oxeye_daisy'), s('poppy'), UMBEL],
        [s('allium'), s('pink_tulip'), BELL], [s('pink_tulip'), s('white_tulip'), BELL], [CANDLE, s('azure_bluet'), CANDLE], [s('azure_bluet'), s('allium'), UMBEL]],
      EDGE: [s('dandelion'), s('oxeye_daisy'), s('azure_bluet'), st('wildflowers', { count: 1, facing: 0 })],
      CLOVER: [0, 1, 2, 3].map(c => st('clover', { count: c, facing: (c * 3) & 3 })),
      TALL0: new Set([st('tall_grass', { half: 0 }), st('large_fern', { half: 0 }), CANDLE[0], UMBEL[0], BELL[0]]),
    };
  })());
  FL.fields = fields;
  // a column's field: { i: the colour's index, d: the density 0…1 } (0 outside a field)
  const FQ = { i: 0, d: 0 };
  FL.fieldAt = function (g, x, z) {
    const fd = g.nLandD.n2(x * 0.42 + 1300, z * 0.42 - 700);
    FQ.d = fd > 0.02 ? 0.2 + 0.6 * ss(0.02, 0.3, fd) : 0;
    const n = g.nLandK.n2(x * 0.31 - 900, z * 0.31 + 400) * 0.5 + 0.5;
    FQ.i = Math.floor(n * 8 * 2.3) % 8;
    return FQ;
  };
  LAND.DRESS_WOODS[1] = function dressGround17(g, P, cx, cz, out) {
    baseGround(g, P, cx, cz, out);
    if (!on(g)) return;
    const blocks = out.blocks, x0 = cx * 16, z0 = cz * 16, S = LAND.plants(), Z = fields(), BIm = VR.BIOME.sky_meadow, KG = 1 | 2 | 4 | 16;
    for (let col = 0; col < 256; col++) {
      if (out.biome && out.biome[col] !== BIm) continue;
      const x = x0 + (col & 15), z = z0 + (col >> 4);
      if (LAND.zoneAt(g, x, z) || (LAND.keepAt(P, x, z) & KG)) continue;
      const y = LAND.topOf(blocks, col, 180);
      if (y < SEA || blocks[(y << 8) | col] !== S.GRASS) continue;
      const ai = ((y + 1) << 8) | col, cur = blocks[ai];
      // only bare grass or the meadow's own small plants are dressed again (never a tree, a shrub or a piece)
      if (cur && !(R.T.flags[cur] & F.PLANT) || (cur && (R.T.flags[cur] & F.LEAVES))) continue;
      const wasTall = Z.TALL0.has(cur);
      const free2 = wasTall || !blocks[ai + 256];
      const put1 = (s) => { blocks[ai] = s; if (wasTall) blocks[ai + 256] = 0; };
      const r = h01(x, z, g.seed ^ 0xf17a), r2 = h01(z, x, g.seed ^ 0x0c1e);
      // the ways' edges: clover and tiny flowers
      const nearWay = (LAND.keepAt(P, x + 2, z) | LAND.keepAt(P, x - 2, z) | LAND.keepAt(P, x, z + 2) | LAND.keepAt(P, x, z - 2)) & 1;
      if (nearWay) {
        if (r < 0.42) put1(Z.CLOVER[(r2 * 4) | 0]);
        else if (r < 0.56) put1(Z.EDGE[(r2 * 4) | 0]);
        continue;
      }
      const q = LAND.woodAt(g, x, z);
      if (q.d > 0.06) continue;
      const f = FL.fieldAt(g, x, z);
      const E = Z.F[f.i];
      if (!f.d || r >= f.d * (Array.isArray(E[0]) ? 0.45 : 1)) continue;   // (a field of tall flowers is thinner: they stand two high)
      const pick = r2 < 0.84 ? E[0] : E[1];
      if (E[2] && r2 > 0.9 && free2) { blocks[ai] = E[2][0]; blocks[ai + 256] = E[2][1]; continue; }
      if (Array.isArray(pick)) { if (free2) { blocks[ai] = pick[0]; blocks[ai + 256] = pick[1]; } continue; }
      put1(pick);
    }
  };

  // ---------------------------------------------------------------- the wonder spots
  // three Traumbäume and two glow rings in the open meadow: on a jittered 40-grid, 70…600 blocks out, flat, no way,
  // piece, field or wood near; the giants 220 apart, the rings 160 from each other and 90 from a giant
  LAND.PIECES.push(Object.assign(function wonders(g, P, K) {
    if (!on(g)) return;
    const gy = (x, z) => g.surfaceY(x, z);
    const cand = [];
    for (let z = -600; z <= 600; z += 40) for (let x = -600; x <= 600; x += 40) {
      const px = x + Math.round((h01(x, z, g.seed ^ 0xf1) - 0.5) * 24), pz = z + Math.round((h01(z, x, g.seed ^ 0xf2) - 0.5) * 24), d = Math.hypot(px, pz);
      if (d < 70 || d > 600) continue;
      cand.push([px, pz, h01(px, pz, g.seed ^ 0xf3)]);
    }
    cand.sort((a, b) => a[2] - b[2]);
    const giants = [], rings = [];
    const clear = (x, z, r) => {
      if (LAND.zoneAt(g, x, z) || LAND.nearViaduct(g, x, z)) return false;
      for (let dz = -r; dz <= r; dz += 3) for (let dx = -r; dx <= r; dx += 3) {
        if (dx * dx + dz * dz > r * r) continue;
        if (LAND.keepAt(P, x + dx, z + dz) || LAND.woodAt(g, x + dx, z + dz).d > 0.05) return false;
      }
      const y0 = gy(x, z); if (y0 <= SEA + 2 || !meadowAt(g, x, z, y0 + 1)) return false;
      for (let dz = -r + 2; dz <= r - 2; dz += 3) for (let dx = -r + 2; dx <= r - 2; dx += 3) if (Math.abs(gy(x + dx, z + dz) - y0) > 3) return false;
      return true;
    };
    for (const [x, z] of cand) {
      if (giants.length >= 3) break;
      if (giants.some(c => Math.hypot(c[0] - x, c[1] - z) < 220) || !clear(x, z, 13)) continue;
      giants.push([x, z]);
    }
    for (const [x, z] of cand) {
      if (rings.length >= 2) break;
      if (rings.some(c => Math.hypot(c[0] - x, c[1] - z) < 160) || giants.some(c => Math.hypot(c[0] - x, c[1] - z) < 90) || !clear(x, z, 8)) continue;
      rings.push([x, z]);
    }
    const ops = { set: K.put, get: () => 0 };
    const petals = [0, 1, 2, 3].map(c => st('pink_petals', { count: c, facing: c }));
    giants.forEach(([x, z], i) => {
      const y = gy(x, z) + 1, seed = M.hash2(x, z, g.seed ^ 0x7a0b) >>> 0;
      const p = plantFlora(ops, 'traumbaum', x, y, z, seed);
      // a carpet of fallen petals under the crown (thicker toward the trunk), the ground dressing leaves it be
      for (let dz = -11; dz <= 11; dz++) for (let dx = -11; dx <= 11; dx++) {
        const dd = Math.hypot(dx, dz); if (dd < 1.5 || dd > 11) continue;
        if (h01(x + dx, z + dz, seed) > 0.75 - dd * 0.045) continue;
        const yy = gy(x + dx, z + dz); if (Math.abs(yy + 1 - y) > 2) continue;
        K.put(x + dx, yy + 1, z + dz, petals[Math.min(3, Math.floor((11 - dd) / 3))]);
      }
      LAND._markDisc(P, x, z, 13, LAND.KEEP.CLEAR); LAND._markDisc(P, x, z, 4, LAND.KEEP.PIECE);
      const top = y + (p ? p.b.y1 : 16);
      LAND.addSpawn(P, ['petals', x, top - 4, z, 10], x, z);
      P.pieces.push({ kind: 'blossom_giant', x, z, y, top, i });
    });
    const GB = st('glowbell'), MC = st('moss_carpet'), MS = st('mossy_cobblestone'), CL = [0, 1, 2, 3].map(c => st('clover', { count: c, facing: c }));
    rings.forEach(([x, z], i) => {
      const y0 = gy(x, z);
      // the fairy ring: Glimmglocken round a circle of radius 5 (two deep in places), clover inside, a mossy stone
      for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) {
        const dd = Math.hypot(dx, dz), yy = gy(x + dx, z + dz) + 1;
        if (Math.abs(yy - 1 - y0) > 2) continue;
        if (dd > 4.5 && dd < 5.6) K.put(x + dx, yy, z + dz, GB);
        else if (dd >= 5.6 && dd < 6.3 && h01(x + dx, z + dz, g.seed ^ 0x61) < 0.35) K.put(x + dx, yy, z + dz, GB);
        else if (dd < 4.4 && dd > 1.5 && h01(x + dx, z + dz, g.seed ^ 0x62) < 0.5) K.put(x + dx, yy, z + dz, CL[(h01(z + dz, x + dx, 7) * 4) | 0]);
      }
      K.put(x, y0 + 1, z, MS); K.put(x, y0 + 2, z, MC);
      LAND._markDisc(P, x, z, 8, LAND.KEEP.CLEAR); LAND._markDisc(P, x, z, 7, LAND.KEEP.PIECE);
      LAND.addSpawn(P, ['glowring', x, y0 + 1, z, 5], x, z);
      P.pieces.push({ kind: 'glow_ring', x, z, y: y0 + 1, i });
    });
  }, { order: 7 }));
})(VR);
