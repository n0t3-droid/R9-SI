// ============================================================================
// Sky rails: arched viaducts with a railway on top link neighbouring villages,
// as in the trailer. Deterministic per world seed: each village links to its
// nearest neighbour (within ~560 blocks); the line runs grid-aligned (straight,
// or an L with a curve), climbs gently high above the land, stands on pillars
// with round arches between them, ramps down to a little station outside each
// village, and wears the style of the towns it joins (stone brick or tech).
// The game rebuilds the same line geometry for the tram that rides it.
// ============================================================================
(function (VR) {
  'use strict';
  const VG = VR.VillageGen, M = VR.M;
  if (!VG) return;
  const SEA = VR.C.SEA;
  const st = VG.st;
  const RG = VR.RailGen = {};
  // per world: v2 villages are bigger and further apart (see VG.par)
  const linkLen = (g) => g.vgen >= 5 ? 1100 : g.vgen >= 2 ? 620 : 500;
  const PILLAR = 10, CLEAR = 12, GRADE = 1 / 6; // a gentle 1-in-6 climb

  // ---------------------------------------------------------------- which villages link up
  // every village links to its nearest neighbour (sites in cells 3 apart are always > LINK apart, so ±2 cells suffice)
  function nearestOther(g, s) {
    const cache = g._railNear || (g._railNear = new Map());
    let best = cache.get(s.id);
    if (best !== undefined) return best;
    if (cache.size > 800) cache.clear();
    best = null; let bd = linkLen(g) ** 2;
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      const o = VG.site(g, s.i + di, s.j + dj);
      if (!o || o.id === s.id) continue;
      const d = (o.x - s.x) ** 2 + (o.z - s.z) ** 2;
      if (d < bd) { bd = d; best = o; }
    }
    cache.set(s.id, best);
    return best;
  }
  const mkLink = (a, b) => a.id < b.id ? { key: a.id + '|' + b.id, a, b } : { key: b.id + '|' + a.id, a: b, b: a };
  RG.linkFrom = function (g, s) { const n = s && nearestOther(g, s); return n ? mkLink(s, n) : null; };
  // all links touching a site: to its nearest neighbour, and from every site that has it as nearest
  RG.linksOf = function (g, s) {
    if (!s) return [];
    const L = [], add = (lk) => { if (lk && !L.some(l => l.key === lk.key)) L.push(lk); };
    add(RG.linkFrom(g, s));
    for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
      const o = VG.site(g, s.i + di, s.j + dj);
      if (!o || o.id === s.id) continue;
      const m = nearestOther(g, o);
      if (m && m.id === s.id) add(mkLink(o, s));
    }
    return L;
  };

  // ---------------------------------------------------------------- the line
  // pts: [x, z, dir] with dir 0 = along +x/−x, 1 = along ±z; heights smoothed so the deck clears the land
  RG.line = function (g, link) {
    const cache = g._railLines || (g._railLines = new Map());
    let Ln = cache.get(link.key);
    if (Ln !== undefined) return Ln;
    if (cache.size > 24) cache.delete(cache.keys().next().value);
    Ln = build(g, link);
    cache.set(link.key, Ln);
    return Ln;
  };
  function build(g, link) {
    const A = link.a, B = link.b;
    const dx = B.x - A.x, dz = B.z - A.z, sx = Math.sign(dx) || 1, sz = Math.sign(dz) || 1;
    const out = VG.rad(g) + 8, SHIFT = 10;
    const pts = [];
    const push = (x, z, dir) => { const L = pts[pts.length - 1]; if (L && L[0] === x && L[1] === z) return; pts.push([x, z, dir]); };
    const adx = Math.abs(dx), adz = Math.abs(dz), JOG = out + 24;
    if (adz < JOG && adx >= adz) {
      // straight along x, halfway between the two towns
      if (adx < out * 2 + 30) return null;
      const z = A.z + Math.round(dz / 2);
      for (let x = A.x + sx * out; x !== B.x - sx * out; x += sx) push(x, z, 0);
    } else if (adx < JOG) {
      if (adz < out * 2 + 30) return null;
      const x = A.x + Math.round(dx / 2);
      for (let z = A.z + sz * out; z !== B.z - sz * out; z += sz) push(x, z, 1);
    } else {
      // an L: leave along the longer axis on the side facing the other town (so lines from one town never share a
      // track), turn once, and arrive along the other axis
      if (adx >= adz) {
        const z0 = A.z + sz * SHIFT, x1 = B.x - sx * SHIFT;
        for (let x = A.x + sx * out; x !== x1; x += sx) push(x, z0, 0);
        push(x1, z0, 2);
        for (let z = z0 + sz; z !== B.z - sz * out; z += sz) push(x1, z, 1);
      } else {
        const x0 = A.x + sx * SHIFT, z1 = B.z - sz * SHIFT;
        for (let z = A.z + sz * out; z !== z1; z += sz) push(x0, z, 1);
        push(x0, z1, 2);
        for (let x = x0 + sx; x !== B.x - sx * out; x += sx) push(x, z1, 0);
      }
    }
    if (pts.length < 30) return null;
    // no line through a third village
    for (let k = 0; k < pts.length; k += 16) { const v = VG.near(g, pts[k][0], pts[k][1], 6); if (v && v.id !== A.id && v.id !== B.id) return null; }
    // (vgen 6) no line through the Heartland's citadel zone: its plinth and the viaducts leave there (gen_citadel.js)
    if (g.vgen >= 6 && VR.Heart && VR.Heart.on(g)) { const C = VR.Heart.CITADEL; for (let k = 0; k < pts.length; k += 4) if (Math.hypot(pts[k][0] - C.x, pts[k][1] - C.z) < 52) return null; }
    // heights: clear the land (widest ground in a window), gentle grades (1 in 6), ramps to ground at both ends
    const n = pts.length, ground = pts.map(p => g.surfaceY(p[0], p[1]));
    const req = new Float64Array(n);
    for (let i = 0; i < n; i++) { let m = SEA; for (let k = -8; k <= 8; k++) { const q = ground[Math.max(0, Math.min(n - 1, i + k))]; if (q > m) m = q; } req[i] = Math.min(196, Math.max(SEA + 10, m + CLEAR)); }
    req[0] = Math.max(SEA + 1, ground[0]) + 1; req[n - 1] = Math.max(SEA + 1, ground[n - 1]) + 1;
    const H = Float64Array.from(req);
    for (let i = 1; i < n; i++) H[i] = Math.max(H[i], H[i - 1] - GRADE);
    for (let i = n - 2; i >= 0; i--) H[i] = Math.max(H[i], H[i + 1] - GRADE);
    // ends must come down to the stations (flat for the platform), then climb along the grade
    const FLAT = 9;
    for (let i = 0; i < n; i++) H[i] = Math.min(H[i], req[0] + Math.max(0, i - FLAT) * GRADE);
    for (let i = n - 1; i >= 0; i--) H[i] = Math.min(H[i], req[n - 1] + Math.max(0, n - 1 - i - FLAT) * GRADE);
    const Y = Array.from(H, v => Math.round(v));
    // the corner is a flat pad
    const c = pts.findIndex(p => p[2] === 2);
    if (c > 0) for (let k = c - 2; k <= c + 2; k++) if (k >= 0 && k < n) Y[k] = Y[c];
    // re-check clearance after the pull-down: where the deck would cut into land, it becomes a cutting (fine)
    const tech = A.style === 'tech' || B.style === 'tech';
    return { key: link.key, pts, Y, ground, tech, a: A.id, b: B.id, names: [A.name, B.name] };
  }

  // ---------------------------------------------------------------- block ops per chunk
  function ops(g, Ln) {
    if (Ln.ops) return Ln.ops;
    const chunks = new Map();
    const bucket = (x, z) => { const k = (x >> 4) + ',' + (z >> 4); let b = chunks.get(k); if (!b) { b = { f: [], o: [] }; chunks.set(k, b); } return b; };
    const put = (x, y, z, s) => bucket(x, z).o.push(x, y, z, s);
    const fill = (x, z, y0, y1, s) => { if (y1 >= y0) bucket(x, z).f.push(x, z, y0, y1, s); };
    const T = Ln.tech;
    const deck = st(T ? 'vx_floor_deck' : 'stone_bricks'), deckEdge = st(T ? 'vx_tech_white' : 'stone_bricks');
    const pillar = st(T ? 'vx_tech_white_strip' : 'stone_bricks'), pillarB = st(T ? 'vx_tech_white' : 'cracked_stone_bricks') || pillar;
    const parapet = st(T ? 'vx_tech_railing' : 'stone_brick_wall');
    const lamp0 = st(T ? 'vx_lamppost_tech' : 'vx_lamppost', { head: 0 }), lamp1 = st(T ? 'vx_lamppost_tech' : 'vx_lamppost', { head: 1 });
    const rail = (shape) => st('rail', { shape });
    const P = Ln.pts, Y = Ln.Y, n = P.length;
    for (let i = 0; i < n; i++) {
      const [x, z, dir] = P[i], y = Y[i];
      const along = dir === 1 ? 1 : 0;           // 0: runs along x, 1: along z (curve counts as both)
      const px = along ? 1 : 0, pz = along ? 0 : 1; // sideways
      const g0 = Ln.ground[i];
      // deck, parapets, clearance above
      for (let w = -2; w <= 2; w++) {
        const cx = x + px * w, cz = z + pz * w;
        const edge = Math.abs(w) === 2;
        if (dir === 2) { // the corner: a solid 5×5 pad
          for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { put(x + a, y - 1, z + b, deck); fill(x + a, z + b, y, y + 6, 0); }
          continue;
        }
        put(cx, y - 1, cz, edge ? deckEdge : deck);
        fill(cx, cz, y, y + 6, 0);
        if (edge && i > 7 && i < n - 8) put(cx, y, cz, parapet);
      }
      // rail on top
      const prev = Y[i - 1], next = Y[i + 1];
      let shape = along ? 0 : 1;
      if (dir === 2) {
        // a curve joining the sides toward the previous and the next point
        // (shapes: 6 south-east, 7 south-west, 8 north-west, 9 north-east)
        const side = (q) => q[0] > x ? 'e' : q[0] < x ? 'w' : q[1] > z ? 's' : 'n';
        const a = side(P[i - 1]), b = side(P[i + 1]);
        const ns = 'ns'.includes(a) ? a : b, ew = 'ew'.includes(a) ? a : b;
        shape = { se: 6, sw: 7, nw: 8, ne: 9 }[ns + ew] || 0;
      } else if (next !== undefined && next > y && i + 1 < n && P[i + 1][2] !== 2) {
        // ascending toward the next block
        const d = along ? (P[i + 1][1] - z) : (P[i + 1][0] - x);
        shape = along ? (d > 0 ? 5 : 4) : (d > 0 ? 2 : 3);
      } else if (prev !== undefined && prev > y && P[i - 1][2] !== 2) {
        const d = along ? (P[i - 1][1] - z) : (P[i - 1][0] - x);
        shape = along ? (d > 0 ? 5 : 4) : (d > 0 ? 2 : 3);
      }
      put(x, y, z, rail(shape));
      // pillars with arches between them
      const h = y - 1 - g0;
      if (h > 3) {
        const u = i % PILLAR;
        if (u === 0) {
          for (let w = -2; w <= 2; w++) for (let t = -1; t <= 0; t++) { const cx = x + px * w + (along ? 0 : t), cz = z + pz * w + (along ? t : 0); fill(cx, cz, Math.min(g0, g.surfaceY(cx, cz)) - 1, y - 2, Math.abs(w) === 2 ? pillarB : pillar); }
        } else {
          // round arch: the spandrel hangs deeper near the pillars
          const f = (u - PILLAR / 2) / (PILLAR / 2), depth = 1 + Math.round((1 - Math.sqrt(Math.max(0, 1 - f * f))) * Math.min(h - 2, 5));
          for (let w = -2; w <= 2; w++) { const cx = x + px * w, cz = z + pz * w; fill(cx, cz, y - 1 - depth, y - 2, deckEdge); }
        }
      } else if (h > 0) {
        for (let w = -2; w <= 2; w++) { const cx = x + px * w, cz = z + pz * w; fill(cx, cz, g0, y - 2, deckEdge); }
      }
      // lamps along the parapet
      if (i % 20 === 10 && i > 6 && i < n - 6 && dir !== 2) { const lx = x + px * 2, lz = z + pz * 2; put(lx, y, lz, lamp0); put(lx, y + 1, lz, lamp1); }
    }
    // stations: a platform under a canopy with benches and lights at both ends
    const post = st(T ? 'vx_tech_white_strip' : 'spruce_log') || pillar, roof = st(T ? 'vx_tech_white' : 'spruce_planks') || deckEdge;
    const roofEdge = st(T ? 'vx_tech_band' : 'dark_oak_planks') || roof;
    const hang = T ? st('vx_hex_light') : st('lantern', { hanging: 1 });
    const floor = st(T ? 'vx_floor_plaza' : 'polished_andesite') || deck;
    const seat = st(T ? 'vx_sofa_white' : 'vx_bench', { facing: 0 }) ? T ? 'vx_sofa_white' : 'vx_bench' : null;
    for (const end of [0, n - 1]) {
      const [x, z, dir] = P[end], y = Y[end];
      const along = dir === 1 ? 1 : 0, px = along ? 1 : 0, pz = along ? 0 : 1;
      const at = (a, w) => [x + px * w + (along ? 0 : a), z + pz * w + (along ? a : 0)];
      for (let a = -6; a <= 6; a++) for (let w = -3; w <= 3; w++) {
        const [cx, cz] = at(a, w);
        fill(cx, cz, Math.min(y - 2, g.surfaceY(cx, cz)), y - 2, deckEdge);
        put(cx, y - 1, cz, w === 0 ? deck : floor);
        fill(cx, cz, y, y + 5, 0);
        // canopy: corner posts, a roof with a darker rim
        if (Math.abs(w) === 3 && (Math.abs(a) === 5 || a === 0)) for (let k = 0; k < 4; k++) put(cx, y + k, cz, post);
        put(cx, y + 4, cz, (Math.abs(w) === 3 || Math.abs(a) === 6) ? roofEdge : roof);
      }
      for (let a = -6; a <= 6; a++) { const [cx, cz] = at(a, 0); put(cx, y, cz, rail(along ? 0 : 1)); }
      for (const a of [-3, 3]) { const [cx, cz] = at(a, 0); if (hang) put(cx, y + 3, cz, hang); }
      // benches face the track (facing: 0 north, 1 east, 2 south, 3 west)
      if (seat) for (const w of [-3, 3]) for (const a of [-3, -2, 2, 3]) {
        const [cx, cz] = at(a, w);
        const f = along ? (w > 0 ? 3 : 1) : (w > 0 ? 0 : 2);
        put(cx, y, cz, st(seat, { facing: f }));
      }
      // a street lamp at the town end of the platform
      const ax = along ? 1 : 0, nb = end === 0 ? P[1] : P[n - 2];
      const town = -Math.sign(nb[ax] - P[end][ax]) || 1;
      const [qx, qz] = at(town * 7, 2);
      fill(qx, qz, Math.min(y - 2, g.surfaceY(qx, qz)), y - 1, deckEdge);
      put(qx, y, qz, lamp0); put(qx, y + 1, qz, lamp1);
    }
    Ln.ops = chunks;
    return chunks;
  }
  RG.ops = ops;
  // what the game thread needs to run a tram: the track as block points and heights, the towns' names
  RG.describe = function (Ln) {
    const n = Ln.pts.length, P = new Int32Array(n * 3);
    for (let i = 0; i < n; i++) { P[i * 3] = Ln.pts[i][0]; P[i * 3 + 1] = Ln.Y[i]; P[i * 3 + 2] = Ln.pts[i][1]; }
    return { key: Ln.key, pts: P, tech: Ln.tech, names: Ln.names };
  };
  // every other source of rail lines (the citadel viaducts, see gen_citadel.js) registers a provider: (g, x, z, r) → descriptions
  // of the lines near (x, z) within r. The tram system learns all of them through this one call (the worker's 'railways').
  RG.providers = [];
  RG.near = function (g, x, z, r) {
    const CELL = VG.cell(g);
    const out = [], seen = new Set(), R0 = Math.ceil(r / CELL) + 1, ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
    for (let dj = -R0; dj <= R0; dj++) for (let di = -R0; di <= R0; di++) {
      const s = VG.site(g, ci + di, cj + dj); if (!s) continue;
      const lk = RG.linkFrom(g, s); if (!lk || seen.has(lk.key)) continue; seen.add(lk.key);
      if (Math.hypot((lk.a.x + lk.b.x) / 2 - x, (lk.a.z + lk.b.z) / 2 - z) > r) continue;
      const Ln = RG.line(g, lk); if (Ln) out.push(RG.describe(Ln));
    }
    for (const P of RG.providers) { const more = P(g, x, z, r); if (more) for (const d of more) out.push(d); }
    return out;
  };

  // apply every line that crosses this chunk
  RG.apply = function (g, cx, cz, out) {
    const CELL = VG.cell(g);
    const x0 = cx * 16, z0 = cz * 16;
    const ci = Math.floor((x0 + 8) / CELL), cj = Math.floor((z0 + 8) / CELL);
    const seen = new Set();
    for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
      const s = VG.site(g, ci + di, cj + dj);
      if (!s) continue;
      const lk = RG.linkFrom(g, s);
      if (lk && !seen.has(lk.key)) {
        seen.add(lk.key);
        // quick bbox reject
        const minx = Math.min(lk.a.x, lk.b.x) - 12, maxx = Math.max(lk.a.x, lk.b.x) + 12, minz = Math.min(lk.a.z, lk.b.z) - 12, maxz = Math.max(lk.a.z, lk.b.z) + 12;
        if (x0 + 16 < minx || x0 > maxx || z0 + 16 < minz || z0 > maxz) continue;
        const Ln = RG.line(g, lk); if (!Ln) continue;
        const b = ops(g, Ln).get(cx + ',' + cz); if (!b) continue;
        const B = out.blocks;
        for (let i = 0; i < b.f.length; i += 5) { const lx = b.f[i] - x0, lz = b.f[i + 1] - z0, s2 = b.f[i + 4]; const y0 = Math.max(1, b.f[i + 2]), y1 = Math.min(254, b.f[i + 3]); for (let y = y0; y <= y1; y++) B[(y << 8) | (lz << 4) | lx] = s2; }
        for (let i = 0; i < b.o.length; i += 4) { const lx = b.o[i] - x0, lz = b.o[i + 2] - z0, y = b.o[i + 1]; if (y < 1 || y > 254) continue; B[(y << 8) | (lz << 4) | lx] = b.o[i + 3]; }
        if (!out.spawns) out.spawns = [];
        const P0 = Ln.pts[0];
        if (P0[0] >= x0 && P0[0] < x0 + 16 && P0[1] >= z0 && P0[1] < z0 + 16) out.spawns.push(['railway', Ln.key, P0[0], Ln.Y[0], P0[1]]);
      }
    }
  };

  // the cells RG.apply reads for a chunk: its 7 x 7 window and the 5 x 5 around each of its sites (nearestOther). The
  // worker computes them in slices before the job runs (VG.cellNeeds), nearest first.
  VG.cellNeeds.push((g, cx, cz) => {
    const CELL = VG.cell(g), ci = Math.floor((cx * 16 + 8) / CELL), cj = Math.floor((cz * 16 + 8) / CELL), out = [];
    for (let r = 0; r <= 5; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (Math.max(Math.abs(di), Math.abs(dj)) === r) out.push([ci + di, cj + dj]);
    return out;
  });

  const OG = VR.OverworldGen && VR.OverworldGen.prototype;
  if (OG) {
    const prevGen = OG.generate;
    OG.generate = function (cx, cz) {
      const out = prevGen.call(this, cx, cz);
      if (this.singleBiome < 0) { try { RG.apply(this, cx, cz, out); } catch (e) { if (VG.probe && e === VG.probe) throw e; if (!this._railErr) { this._railErr = 1; console.warn('rail gen', e); } } }
      return out;
    };
  }
})(VR);
