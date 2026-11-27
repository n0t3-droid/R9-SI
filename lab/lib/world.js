// ============================================================================
// R9-SI Lab · die Welt, wie das Spiel sie erzeugt — in node, ohne Browser.
// The world exactly as the game generates it (the same shared sources the game's workers run), for the lab's tools,
// detectors and reports: a generator per (seed, vgen), a chunk cache, the column and block readers, the places (villages,
// towns) by name, style or nearness, and regions cut out as cell lists.
//   const W = require('./lib/world.js'); const g = W.gen(3616214791, 21); W.top(g, x, z)
// ============================================================================
'use strict';
const VR = require('../../test/load_shared.js');
const W = module.exports = {};
W.VR = VR; W.R = VR.R; W.F = VR.F;
const R = VR.R, F = VR.F;

// a generator for a world made with this seed and generator version (vgen: the version a new world gets in game.js)
W.gen = function (seed, vgen) {
  const g = VR.makeGen('overworld', seed >>> 0, { vgen: vgen | 0 });
  g.vgen = vgen | 0;
  g._labChunks = new Map();
  return g;
};
// the newest generator version (what a new world gets), read from game.js
W.newestVgen = function () {
  try { const s = require('fs').readFileSync(require('path').join(__dirname, '../../src/main/game.js'), 'utf8'); const m = /vgen: o\.vgen \? \+o\.vgen : (\d+)/.exec(s); return m ? +m[1] : 21; } catch (e) { return 21; }
};
// a generated chunk (cached, at most MAX per generator; generation is deterministic, so a dropped one comes back the same)
W.MAX = 900;
W.chunk = function (g, cx, cz) {
  const C = g._labChunks || (g._labChunks = new Map()), k = cx + ',' + cz;
  let o = C.get(k);
  if (o) { C.delete(k); C.set(k, o); return o; }
  o = g.generate(cx, cz);
  C.set(k, o);
  if (C.size > W.MAX) C.delete(C.keys().next().value);
  return o;
};
W.block = function (g, x, y, z) {
  if (y < 0 || y > 255) return 0;
  const o = W.chunk(g, x >> 4, z >> 4);
  return o.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)];
};
W.name = (s) => (s ? R.types[R.T.type[s]].name : 'air');
W.flags = (s) => (s ? R.T.flags[s] : 0);
W.solid = (s) => !!(s && (R.T.flags[s] & F.SOLID));
W.leaves = (s) => !!(s && (R.T.flags[s] & F.LEAVES));
W.isLog = (s) => !!s && /(_log|_wood|_stem|_trunk)$/.test(W.name(s));
W.fluid = (s) => !!(s && (R.T.flags[s] & F.FLUID));
// the highest block of a column that counts (default: solid or fluid, not plants), searched from yMax down
W.top = function (g, x, z, yMax, ok) {
  ok = ok || ((s) => W.solid(s) || W.fluid(s));
  const o = W.chunk(g, x >> 4, z >> 4), lx = x & 15, lz = z & 15;
  for (let y = Math.min(255, yMax === undefined ? 255 : yMax); y > 0; y--) { const s = o.blocks[(y << 8) | (lz << 4) | lx]; if (s && ok(s, y)) return { y, s }; }
  return { y: 0, s: 0 };
};
// the column's surface height as the generator sees it (the land before structures)
W.surface = (g, x, z) => g.surfaceY(x, z);
W.biome = (g, x, z) => { const B = VR.BIOMES[g.biomeFor(g.climateAt(x, z), g.surfaceY(x, z))]; return B ? B.key : '?'; };

// ---- the places: villages and towns (gen_village.js)
const VG = () => VR.VillageGen;
// every place whose site lies within r blocks of (x, z)
W.sitesNear = function (g, x, z, r) {
  const out = new Map(), step = 64;
  for (let dz = -r; dz <= r; dz += step) for (let dx = -r; dx <= r; dx += step) {
    for (const s of VG().sitesFor(g, (x + dx) >> 4, (z + dz) >> 4)) if (!out.has(s.id) && Math.hypot(s.x - x, s.z - z) <= r) out.set(s.id, s);
  }
  return [...out.values()].sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
};
W.findSite = function (g, q) {
  q = q || {};
  const r = q.r || 2500, near = q.near || [0, 0];
  const list = W.sitesNear(g, near[0], near[1], r);
  return list.find((s) => (!q.name || s.name === q.name) && (!q.style || s.style === q.style)) || null;
};
W.plan = (g, site) => VG().plan(g, site);

// ---- regions: the cells of a box [x0, x1] × [y0, y1] × [z0, z1] as IsoPic ops (x − x0, y − y0, z − z0, state)
// opts: flipX / flipZ (turn the view: the picture's front is low z), skip(state, name) (left out)
W.region = function (g, box, opts) {
  opts = opts || {};
  const { x0, x1, y0, y1, z0, z1 } = box, ops = [];
  const skip = opts.skip || ((s, n) => /^(short_grass|tall_grass|fern|large_fern)$/.test(n));
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const o = W.chunk(g, x >> 4, z >> 4), lx = x & 15, lz = z & 15;
    for (let y = y0; y <= y1; y++) {
      const s = o.blocks[(y << 8) | (lz << 4) | lx]; if (!s) continue;
      if (skip(s, W.name(s))) continue;
      ops.push(opts.flipX ? x1 - x : x - x0, y - y0, opts.flipZ ? z1 - z : z - z0, s);
    }
  }
  return ops;
};
