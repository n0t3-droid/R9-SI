// ============================================================================
// R9-SI Lab · Spürhunde: Detektoren, die in einer erzeugten Welt Fehler finden, ohne dass jemand hinsieht.
// Detectors that find defects in a generated world without anyone looking. Each returns findings
// [{ kind, x, y, z, info, score }] — score: how bad (bigger is worse), for sorting and for the report's top cases.
//   roads(g, plan)        lane cells of a town's or village's roads whose top is bare ground (a hole in the road)
//   doors(g, plan)        doors of homes and workplaces you cannot walk out of (a drop of two blocks, a wall, water in front)
//   crowns(g, box)        leaf clusters that touch trunks of two different kinds (trees of two species grown into each other)
//   floating(g, box)      leaf clusters with no trunk and nothing under them (a crown left in the air)
//   plantsOnPaving(g, box) flowers and grass standing on a road or paving block
// ============================================================================
'use strict';
const W = require('../lib/world.js');
const D = module.exports = {};
const R = W.R, F = W.F;
const nameOf = W.name;
// the blocks a road or a path is made of (every style's path, pavement, plaza and the marks)
const PAVING = /asphalt|paver|plaza|packed_ice|snow_block|gravel|path|cobble|stone_brick|sandstone|travertine|granite|terracotta|concrete|_slab|planks|deck|tile|brick|vx_floor/;
const BARE = /^(grass_block|dirt|coarse_dirt|rooted_dirt|podzol|sand|red_sand|moss_block|mud|clay|mycelium|stone|stacked_stone|snow_block)$/;   // (stacked_stone: a modern yard's retaining wall)
const isPlant = (s) => !!s && (R.T.flags[s] & (F.PLANT || 0)) && !(R.T.flags[s] & F.SOLID);

// ---- the blocks a place's roads are made of: its style's path, the speckle (pathAlt: coarse dirt, sandstone in the
// desert — gen_village.js paves one cell in eight with it), the centre line, the pavement, the plaza and the marks
D.roadBlocks = function (g, plan) {
  const VG = W.VR.VillageGen, S = VG.styleOf ? VG.styleOf(g, plan.style) : (VG.STYLES[plan.style] || {});
  const set = new Set(['asphalt_zebra', 'asphalt_dash', 'granite_paver', 'dirt_path']);
  for (const k of ['path', 'pathAlt', 'pathLine', 'sidewalk']) if (S[k]) set.add(S[k]);
  if (!S.pathAlt) set.add(plan.style === 'desert' ? 'sandstone' : 'coarse_dirt');
  for (const p of S.plaza || []) set.add(p);
  return set;
};
// ---- roads: the plan's roads are lists of [x, y, z] every third point (gen_village.js plan.roads); every cell of the
// road's width (RW blocks either side of the line: 2 for the five-wide streets of the airy villages and the towns with a
// pavement, else 1) is looked at from above:
//   road-hole   its top is bare ground at the road's height, not the road's own blocks (a gap in the paving)
//   road-bump   bare ground lies ON the paving (a yard filled up over the road, a mound on the street)
//   road-obstacle  something stands in a lane at a person's height (a lamp, a palm, a hedge, a yard's wall) — a town's
//                  pavement keeps its kerb furniture (the bins, the e-bikes), the plaza and the landing pad are their own
D.roads = function (g, plan) {
  const out = []; let lane = 0, holes = 0, bumps = 0, obstacles = 0;
  const seen = new Set(), ROAD = D.roadBlocks(g, plan);
  const VG = W.VR.VillageGen, S = VG.styleOf ? VG.styleOf(g, plan.style) : {};
  const RW = S.sidewalk || (plan.roadW | 0) >= 5 ? 2 : 1, LANE = S.sidewalk ? 1.5 : RW;
  const isRoad = (n) => ROAD.has(n);
  const pz = plan.plaza, pad = plan.pad;
  const own = (x, z) => (pz && Math.max(Math.abs(x - pz.x), Math.abs(z - pz.z)) <= pz.r + 1) || (pad && Math.max(Math.abs(x - pad.x), Math.abs(z - pad.z)) <= 6);
  for (const pts of plan.roads || []) {
    if (!pts || pts.length < 2) continue;
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k], b = pts[k + 1], ex = b[0] - a[0], ez = b[2] - a[2], L2 = ex * ex + ez * ez; if (L2 < 1e-6) continue;
      const x0 = Math.floor(Math.min(a[0], b[0]) - 3), x1 = Math.ceil(Math.max(a[0], b[0]) + 3), z0 = Math.floor(Math.min(a[2], b[2]) - 3), z1 = Math.ceil(Math.max(a[2], b[2]) + 3);
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        let t = ((x - a[0]) * ex + (z - a[2]) * ez) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
        const d = Math.hypot(x - (a[0] + t * ex), z - (a[2] + t * ez)); if (d > RW) continue;   // (the road's width)
        const key = x + ',' + z; if (seen.has(key)) continue; seen.add(key);
        if (own(x, z)) continue;   // (the plaza's and the landing pad's own cells)
        const yRoad = Math.round(a[1] + (b[1] - a[1]) * t) - 1;   // (the plan's points are one above the paving)
        const top = W.top(g, x, z, yRoad + 3, (s) => W.solid(s) || W.fluid(s));
        if (!top.s || Math.abs(top.y - yRoad) > 3) continue;   // (a bridge, a cut or a structure over it: not this detector's)
        lane++;
        const n = nameOf(top.s);
        if (isRoad(n)) continue;
        if (!BARE.test(n)) {
          // something standing on the road's surface, at a person's height (a lamp, a trunk, a hedge, a wall)
          if (d <= LANE + 1e-9 && top.y - yRoad >= 1 && top.y - yRoad <= 2 && !W.fluid(top.s)) {
            let y = top.y - 1; while (y > yRoad - 2 && W.block(g, x, y, z) && !isRoad(nameOf(W.block(g, x, y, z))) && !BARE.test(nameOf(W.block(g, x, y, z)))) y--;
            const under = nameOf(W.block(g, x, y, z));
            if (isRoad(under) || BARE.test(under)) { obstacles++; out.push({ kind: 'road-obstacle', x, y: y + 1, z, info: `${nameOf(W.block(g, x, y + 1, z))} on the ${under} (${d.toFixed(1)} from the road's line)`, score: 2 }); }
          }
          continue;
        }
        if (/^(vm_|vx_)/.test(nameOf(W.block(g, x, top.y + 1, z)))) continue;   // (a bed: a tree or a planter set in the soil — the turning circle's)
        // bare ground on top: lying on paving (a bump), or the ground itself where the paving should be (a hole)
        let paved = -1;
        for (let y = top.y - 1; y >= top.y - 4; y--) { const s = W.block(g, x, y, z); if (s && isRoad(nameOf(s))) { paved = y; break; } if (s && !BARE.test(nameOf(s)) && W.solid(s)) break; }
        if (paved >= 0) { bumps++; out.push({ kind: 'road-bump', x, y: top.y, z, info: `${n} ${top.y - paved} high on the ${nameOf(W.block(g, x, paved, z))}`, score: 1 + top.y - paved }); }
        else if (Math.abs(top.y - yRoad) <= 1) { holes++; out.push({ kind: 'road-hole', x, y: top.y, z, info: n, score: 1 }); }
      }
    }
  }
  return { finds: out, lane, holes, bumps, obstacles };
};

// ---- doors: plan.homes and plan.work carry door [x, y, z] (the door's lower cell) and outside [x, y, z] (in front).
// The way from the door to the spot in front is walked cell by cell (a straight line): each cell's standing height (a
// full block's top, half a block lower on stairs and bottom slabs) may lie at most one block below the one before —
// a drop of two or more is a door you cannot reach; solid blocks at head height on the way wall it in; a spot in front
// that lies in water is no place to stand
const standOn = (g, x, z, yMax) => {
  const t = W.top(g, x, z, yMax, (s) => W.solid(s) || W.fluid(s)); if (!t.s) return null;
  const n = nameOf(t.s), half = /_stairs$/.test(n) || /_slab$/.test(n) ? 0.5 : 0;
  return { y: t.y + 1 - half, top: t.y, wet: W.fluid(t.s), n };
};
D.doors = function (g, plan) {
  const out = []; let n = 0;
  for (const h of (plan.homes || []).concat(plan.work || [])) {
    if (!h || !h.door || !h.outside) continue;
    n++;
    const [dx, dy, dz] = h.door, [ox, , oz] = h.outside;
    const steps = Math.max(Math.abs(ox - dx), Math.abs(oz - dz));
    let prev = dy, worst = 0, at = null, wall = null;
    for (let i = 1; i <= steps; i++) {
      const x = Math.round(dx + (ox - dx) * i / steps), z = Math.round(dz + (oz - dz) * i / steps);
      const c = standOn(g, x, z, Math.ceil(prev) + 1); if (!c) continue;
      if (W.solid(W.block(g, x, Math.floor(c.y), z)) && W.solid(W.block(g, x, Math.floor(c.y) + 1, z)) && !W.fluid(W.block(g, x, Math.floor(c.y), z))) { wall = wall || [x, Math.floor(c.y), z]; }
      const drop = prev - c.y;
      if (drop > worst) { worst = drop; at = [x, c.top, z, c]; }
      prev = c.y;
    }
    const end = standOn(g, ox, oz, Math.ceil(prev) + 1);
    if (worst >= 1.99) out.push({ kind: 'door-high', x: at[0], y: at[1], z: at[2], info: `${h.kind || 'house'}: a drop of ${worst} blocks on the way from the door`, score: worst });
    else if (wall) out.push({ kind: 'door-walled', x: wall[0], y: wall[1], z: wall[2], info: `${h.kind || 'house'}: solid blocks in the way from the door`, score: 3 });
    else if (end && end.wet) out.push({ kind: 'door-wet', x: ox, y: end.top, z: oz, info: `${h.kind || 'house'}: the spot in front of the door is in ${end.n}`, score: 2 });
  }
  return { finds: out, doors: n };
};

// ---- leaf clusters in a box (6-connected): the trunks they touch, the leaves' kinds, whether anything holds them
function clusters(g, box) {
  const { x0, x1, y0, y1, z0, z1 } = box, X = x1 - x0 + 1, Y = y1 - y0 + 1, Z = z1 - z0 + 1;
  const at = (x, y, z) => W.block(g, x, y, z);
  const idx = (x, y, z) => ((y - y0) * Z + (z - z0)) * X + (x - x0);
  const done = new Uint8Array(X * Y * Z), list = [];
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const i = idx(x, y, z); if (done[i]) continue;
    const s = at(x, y, z); if (!W.leaves(s)) { done[i] = 1; continue; }
    // a flood fill over face neighbours
    const stack = [[x, y, z]], logs = new Map(), kinds = new Map(); let size = 0, held = false, cx = 0, cy = 0, cz = 0, edge = false;
    done[i] = 1;
    while (stack.length) {
      const [a, b, c] = stack.pop(); size++; cx += a; cy += b; cz += c;
      const ls = at(a, b, c), ln = nameOf(ls); kinds.set(ln, (kinds.get(ln) || 0) + 1);
      for (const [p, q, r] of [[a + 1, b, c], [a - 1, b, c], [a, b + 1, c], [a, b - 1, c], [a, b, c + 1], [a, b, c - 1]]) {
        if (p < x0 || p > x1 || q < y0 || q > y1 || r < z0 || r > z1) { edge = true; continue; }
        const ns = at(p, q, r); if (!ns) continue;
        const nn = nameOf(ns);
        if (W.leaves(ns)) { const j = idx(p, q, r); if (!done[j]) { done[j] = 1; stack.push([p, q, r]); } continue; }
        if (W.isLog(ns)) { logs.set(nn, (logs.get(nn) || 0) + 1); held = true; continue; }
        if (q === b - 1 && W.solid(ns)) held = true;   // (resting on something)
        if (W.solid(ns) && q !== b - 1) held = held || false;
      }
    }
    list.push({ size, logs, kinds, held, edge, x: Math.round(cx / size), y: Math.round(cy / size), z: Math.round(cz / size) });
  }
  return list;
}
const woodOf = (n) => n.replace(/^stripped_/, '').replace(/_(log|wood|stem|trunk)$/, '');
D.crowns = function (g, box) {
  const out = []; let n = 0;
  for (const c of clusters(g, box)) {
    if (c.size < 6) continue;
    n++;
    const woods = new Set([...c.logs.keys()].map(woodOf));
    if (woods.size >= 2) out.push({ kind: 'crowns-fused', x: c.x, y: c.y, z: c.z, info: `${[...woods].join(' + ')} trees grown into one crown (${c.size} leaves: ${[...c.kinds.keys()].join(', ')})`, score: c.size });
  }
  return { finds: out, clusters: n };
};
D.floating = function (g, box) {
  const out = [];
  for (const c of clusters(g, box)) {
    if (c.size < 10 || c.held || c.edge) continue;
    out.push({ kind: 'crown-floating', x: c.x, y: c.y, z: c.z, info: `${c.size} leaves (${[...c.kinds.keys()].join(', ')}) with no trunk and nothing under them`, score: c.size });
  }
  return { finds: out };
};
D.plantsOnPaving = function (g, box) {
  const out = [];
  for (let z = box.z0; z <= box.z1; z++) for (let x = box.x0; x <= box.x1; x++) {
    const t = W.top(g, x, z, box.y1, (s) => !!s && (W.solid(s) || isPlant(s)));
    if (!t.s || !isPlant(t.s)) continue;
    const under = W.block(g, x, t.y - 1, z), un = nameOf(under);
    if (PAVING.test(un) && /asphalt|paver|plaza|path|travertine|granite_paver/.test(un)) out.push({ kind: 'plant-on-paving', x, y: t.y, z, info: `${nameOf(t.s)} on ${un}`, score: 1 });
  }
  return { finds: out };
};

// ---- railways (gen_rails.js): the sky rails link neighbouring villages and come down to a station outside each; a line
// whose track runs inside a place (within its radius) ramps down through its streets and houses
//   rails(g, x, z, r) → finds 'rail-in-town' (one per line and place, at the track's point deepest inside), lines, points
D.rails = function (g, x, z, r) {
  const VG = W.VR.VillageGen, RG = W.VR.RailGen, out = [];
  if (!RG) return { finds: out, lines: 0, points: 0 };
  const CELL = VG.cell(g), R0 = Math.ceil(r / CELL) + 1, ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
  const seen = new Set(); let lines = 0, points = 0;
  for (let dj = -R0; dj <= R0; dj++) for (let di = -R0; di <= R0; di++) {
    const s = VG.site(g, ci + di, cj + dj); if (!s) continue;
    for (const lk of RG.linksOf(g, s)) {
      if (seen.has(lk.key)) continue; seen.add(lk.key);
      const Ln = RG.line(g, lk); if (!Ln) continue;
      lines++;
      const worst = new Map();   // site id → {depth, x, y, z, site}
      for (let i = 0; i < Ln.pts.length; i++) {
        const [px, pz] = Ln.pts[i]; points++;
        for (const t of W.sitesNear(g, px, pz, 260)) {
          const depth = (t.rad || VG.rad(g)) - Math.hypot(px - t.x, pz - t.z);
          if (depth <= 0) continue;
          const w = worst.get(t.id);
          if (!w || depth > w.depth) worst.set(t.id, { depth, x: px, y: Ln.Y[i], z: pz, site: t });
        }
      }
      for (const w of worst.values()) out.push({ kind: 'rail-in-town', x: w.x, y: w.y, z: w.z, info: `the railway ${Ln.names.join(' – ')} runs ${Math.round(w.depth)} blocks inside ${w.site.name} (${w.site.style}, radius ${w.site.rad})`, score: Math.round(w.depth) });
    }
  }
  return { finds: out, lines, points };
};
