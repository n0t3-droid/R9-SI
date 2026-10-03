// ============================================================================
// R9 Studio · 🏘 Ort planen (v0.37): a whole place from one sentence, planned
// right here in the page (no account, no limit). The Studio surveys the piece of
// the open world you are looking at (heights, water, sand, rock, trees, what is
// built), reads the wish ("Fischerdorf mit Hafen, Kirche und sechs Häusern",
// "modernes Viertel mit Pool-Villen", "Bauernhof mit Feldern", "Bergdorf mit
// Kapelle") and plans a settlement that fits the ground — houses facing their
// streets (each a full Haus-Baukasten house with rooms and furniture), paths, a
// plaza, fields, trees, lamps, benches, a well or a fountain, docks and boats on
// the water, landmarks from the Genie's library (a church, a lighthouse, a
// windmill …) — and builds it: the ground levelled under every house, paths laid
// on the terrain (boardwalks over water), everything ONE Werkbank step that goes
// live to the game and comes back with ⟲. "Ändern" adds to the wish ("ohne
// Kirche", "mehr Häuser", "mit Feldern") and plans again on the same seed.
// Area frame: x west → east, z north → south (0 … w−1, 0 … d−1); rot = the side
// a front door faces: 0 north (−z), 1 east, 2 south, 3 west.
// ============================================================================
(function () {
  'use strict';
  const C = window.__studioCore, WM = VR.StudioWorld; if (!C || !WM) return;
  const R = VR.R, T = R.T, F = VR.F, KEEP = 0xffff;
  const L = (k, de, v) => (VR.I18N && VR.I18N.t ? VR.I18N.t(k, v, de) : String(de).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : m)));
  const HK = () => VR.HouseKit, GN = () => VR.Genie, CU = () => VR.Custom;
  const SITE = WM.site = { size: 64, area: null, sv: null, plan: null, placed: null, hist: [], status: '', text: '', seed: 1 };
  const stC = new Map();
  const st = (name, props) => { const key = props ? name + JSON.stringify(props) : name; let s = stC.get(key); if (s !== undefined) return s; const t = R.byName[name]; s = t ? (props ? t.state(props) : t.defaultState) : 0; stC.set(key, s); return s; };
  const has = (n) => !!R.byName[n];
  const nm = (s) => (s ? (R.types[T.type[s]] || { name: '' }).name : '');
  const clamp = (v, a, b, d) => { v = Math.round(+v); return Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : d; };
  const KINDS = 'gswrtbi';   // grass/soil, sand/gravel, water, rock, trees, built, snow/ice
  const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];

  // ---------------------------------------------------------------- the area: the selection, or around where you look
  SITE.areaFor = function (size, useSel) {
    const box = WM.regionBox && WM.regionBox(); if (!box || !WM.world) return null;
    const m = 3, maxW = box[3] - box[0] - 2 * m, maxD = box[5] - box[2] - 2 * m;
    const fit = (x0, z0, w, d) => { w = Math.max(16, Math.min(w, maxW)); d = Math.max(16, Math.min(d, maxD)); x0 = Math.max(box[0] + m, Math.min(box[3] - m - w, x0)); z0 = Math.max(box[2] + m, Math.min(box[5] - m - d, z0)); return { x0, z0, w, d }; };
    const WB = WM.wb, sel = useSel && WB && WB.selBox ? WB.selBox() : null;
    if (sel) return fit(sel[0], sel[2], sel[3] - sel[0] + 1, sel[5] - sel[2] + 1);
    let cx, cz;
    try { const cam = C.camFor(C.S.scene, C.S.cam, 100, 100); cx = Math.floor(cam.target[0]); cz = Math.floor(cam.target[2]); } catch (e) { cx = Math.floor(WM.region.center[0]); cz = Math.floor(WM.region.center[2]); }
    if (!Number.isFinite(cx) || !Number.isFinite(cz)) { cx = Math.floor(WM.region.center[0]); cz = Math.floor(WM.region.center[2]); }
    return fit(cx - (size >> 1), cz - (size >> 1), size, size);
  };

  // ---------------------------------------------------------------- the survey: what the ground is like, cell by cell
  const TREE_RE = /_log$|_leaves$|_wood$|_stem$|_hyphae$|vx_fruit|vx_palm|vx_royal|_crown_/;
  // the ground the world generator makes; anything else on top (a temple, a road, a house, a farm) counts as built
  const NATURE_RE = /^(stone|dirt|grass_block|coarse_dirt|podzol|rooted_dirt|mud|clay|sand|red_sand|gravel|snow|snow_block|powder_snow|ice|packed_ice|blue_ice|sandstone|red_sandstone|terracotta|[a-z_]+_terracotta|deepstone|cobbled_deepstone|tuff|calcite|basalt|smooth_basalt|blackstone|andesite|granite|diorite|cobblestone|mossy_cobblestone|moss_block|pale_moss_block|dripstone_block|obsidian|netherrack|mycelium|[a-z]+_mycel|gloom_sand|gloom_soil|skyroot_soil|emberrock|scoria|duskrock|ochre_rock|ember_ochre|umber_rock|sulfur|cinnabar|aether_stone|dusk_aether|magma_block|tidestone|abyssal_tidestone|voidstone|lilacite_block|[a-z_]+_ore|raw_[a-z]+_block|bone_block|farmland|dirt_path|muddy_mangrove_roots|packed_mud|amethyst_block|budding_amethyst|soul_sand|soul_soil|end_stone|crimson_nylium|warped_nylium)$/;
  const BUILT_RE = { test: (n) => !NATURE_RE.test(n) || /glazed/.test(n) };
  SITE.survey = function (A) {
    const n = A.w * A.d, top = new Int16Array(n), solid = new Int16Array(n), kind = new Uint8Array(n), names = new Map();
    let base = 1e9, maxH = -1e9;
    for (let z = 0; z < A.d; z++) for (let x = 0; x < A.w; x++) {
      const gx = A.x0 + x, gz = A.z0 + z, i = z * A.w + x;
      const g1 = WM.groundAt(gx, gz), g = g1 == null ? 0 : g1 - 1, s = WM.getBlock(gx, g, gz), name = nm(s);
      let k = 0, sol = g;
      if (T.flags[s] & F.FLUID) { k = 2; while (sol > 1 && (T.flags[WM.getBlock(gx, sol, gz)] & F.FLUID)) sol--; }
      else if (BUILT_RE.test(name)) k = 5;   // only what people make counts as built; any other ground is nature
      else if (/sand|gravel/.test(name)) k = 1;
      else if (/snow|ice/.test(name)) k = 6;
      else if (/grass|dirt|mud|podzol|moss|clay|soil|farmland|path|mycel/.test(name)) k = 0;
      else k = 3;
      if (names) { const key = KINDS[k] + ':' + name; names.set(key, (names.get(key) || 0) + 1); }
      if (k !== 2) for (let y = g + 1; y <= g + 8; y++) { const a = WM.getBlock(gx, y, gz); if (!a) continue; if (TREE_RE.test(nm(a))) { if (k !== 5) k = 4; } break; }
      top[i] = g; solid[i] = sol; kind[i] = k;
      if (g < base) base = g; if (g > maxH) maxH = g;
    }
    let water = -1; for (let i = 0; i < n; i++) if (kind[i] === 2) water = Math.max(water, top[i]);
    return { top, solid, kind, base, max: maxH, water, names: [...names.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14) };
  };
  // what paths and areas are made of
  const PATHM = { path: 'dirt_path', gravel: 'gravel', cobble: 'cobblestone', stone: 'stone_bricks', paver: 'paver_grey', planks: 'spruce_planks', sand: 'sand' };
  const AREAM = { stone: 'stone_bricks', paver: 'paver_grey', cobble: 'cobblestone', grass: 'grass_block', sand: 'sand', planks: 'spruce_planks', field: 'farmland', flowers: 'grass_block' };

  // ---------------------------------------------------------------- turning a block grid (as the Werkbank turns its clipboard)
  function turn(g, q) {
    let { sx, sy, sz, blocks } = g; const pts = (g.pts || []).map(p => p.slice());
    for (let r = 0; r < (q & 3); r++) {
      const nx = sz, nz = sx, out = new Uint16Array(nx * sy * nz);
      for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) { const s = blocks[(y * sz + z) * sx + x]; out[(y * nz + x) * nx + (sz - 1 - z)] = s === KEEP ? KEEP : CU().rotState(s, 1); }
      for (const p of pts) { const px = p[0], pz = p[1]; p[0] = sz - 1 - pz; p[1] = px; }
      blocks = out; sx = nx; sz = nz;
    }
    return Object.assign({}, g, { sx, sy, sz, blocks, pts });
  }
  // the columns a grid uses (seen from above)
  const footprint = (g) => { const m = new Uint8Array(g.sx * g.sz); for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) if (g.blocks[(y * g.sz + z) * g.sx + x] !== KEEP) m[z * g.sx + x] = 1; return m; };
  const spiral = (r) => { const out = [[0, 0]]; for (let d = 1; d <= r; d++) for (let a = -d; a <= d; a++) for (let b = -d; b <= d; b++) if (Math.max(Math.abs(a), Math.abs(b)) === d) out.push([a, b]); return out; };
  // where to try a house: close to the planned spot on gentle ground, then the same ring again allowing terraces
  const SPIRAL = (() => { const sp = spiral(16); return sp.map(([a, b]) => [a, b, 0]).concat(sp.map(([a, b]) => [a, b, 1])); })();

  // ---------------------------------------------------------------- layout: every house where it fits, near where it was planned
  SITE.layout = function (plan, A, sv) {
    const occ = new Uint8Array(A.w * A.d), body = new Uint8Array(A.w * A.d);
    const out = { houses: [], models: [], skipped: [] };
    // where the player stands stays free (nobody wakes up inside a wall)
    const pc = WM.region && WM.region.center;
    if (pc) { const px = Math.floor(pc[0]) - A.x0, pz = Math.floor(pc[2]) - A.z0; for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) { const x = px + a, z = pz + b; if (x >= 0 && z >= 0 && x < A.w && z < A.d) occ[z * A.w + x] = 4; } }
    const land = (x, z) => x >= 1 && z >= 1 && x < A.w - 1 && z < A.d - 1 && sv.kind[z * A.w + x] !== 2 && sv.kind[z * A.w + x] !== 5;
    // a house (or a model) as a grid with its body rectangle marked, turned so its front faces rot
    function place(g, bodyRect, want, rot, label, flatten) {
      // the clip's "front" is its −z side; rot 0 = north needs no turn, east one, south two, west three (clockwise)
      const pts = [[bodyRect[0], bodyRect[1]], [bodyRect[2], bodyRect[3]]].concat(g.door ? [[g.door[0], g.door[2]]] : []);
      const gq = turn(Object.assign({}, g, { pts }), rot);
      const bx0 = Math.min(gq.pts[0][0], gq.pts[1][0]), bz0 = Math.min(gq.pts[0][1], gq.pts[1][1]), bx1 = Math.max(gq.pts[0][0], gq.pts[1][0]), bz1 = Math.max(gq.pts[0][1], gq.pts[1][1]);
      const fp = footprint(gq), cxB = (bx0 + bx1) / 2, czB = (bz0 + bz1) / 2;
      for (const [ox, oz, steep] of SPIRAL) {
        const X0 = Math.round(want[0] + ox - cxB), Z0 = Math.round(want[1] + oz - czB);
        let ok = true; const hs = [];
        for (let z = 0; z < gq.sz && ok; z++) for (let x = 0; x < gq.sx; x++) {
          if (!fp[z * gq.sx + x]) continue;
          const ax = X0 + x, az = Z0 + z;
          if (!land(ax, az) || occ[az * A.w + ax]) { ok = false; break; }
          if (x >= bx0 && x <= bx1 && z >= bz0 && z <= bz1) hs.push(sv.top[az * A.w + ax]);
        }
        if (!ok || !hs.length) continue;
        hs.sort((a, b) => a - b);
        // gentle ground first; on hills the ground is terraced (cut on one side, filled on the other) up to 10 blocks
        if (flatten && hs[hs.length - 1] - hs[0] > (steep ? 10 : 3)) continue;
        const Fy = hs[hs.length >> 1];
        // claim the footprint and a ring of one block around it
        for (let z = -1; z <= gq.sz; z++) for (let x = -1; x <= gq.sx; x++) {
          const inside = x >= 0 && z >= 0 && x < gq.sx && z < gq.sz && fp[z * gq.sx + x];
          const near = !inside && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const xx = x + a, zz = z + b; return xx >= 0 && zz >= 0 && xx < gq.sx && zz < gq.sz && fp[zz * gq.sx + xx]; });
          const ax = X0 + x, az = Z0 + z;
          if ((inside || near) && ax >= 0 && az >= 0 && ax < A.w && az < A.d) { occ[az * A.w + ax] = 1; if (x >= bx0 && x <= bx1 && z >= bz0 && z <= bz1) body[az * A.w + ax] = 1; }
        }
        const door = gq.pts[2] ? [X0 + gq.pts[2][0], Z0 + gq.pts[2][1]] : null;
        return { g: gq, fp, X0, Z0, F: Fy, rot, label, body: [X0 + bx0, Z0 + bz0, X0 + bx1, Z0 + bz1], door };
      }
      return null;
    }
    // the landmarks first (a church is big and was asked for by name; houses find another gap more easily),
    // a bit smaller when the ground there does not allow the full size
    for (const m of plan.models) {
      let g = GN().raster(m.model, { set: 'all', max: 40 }); if (!g) continue;
      let p = place(g, [0, 0, g.sx - 1, g.sz - 1], [m.x, m.z], m.rot, m.model.name, true);
      for (const f of [0.8, 0.65]) {
        if (p || !m.type || !VR.GenieBrain) break;
        const m2 = VR.GenieBrain.buildModel({ type: m.type, size: Math.round((m.size || 24) * f), colors: {}, feats: {} }); if (!m2) break;
        const g2 = GN().raster(m2, { set: 'all', max: 40 }); if (!g2) break;
        p = place(g2, [0, 0, g2.sx - 1, g2.sz - 1], [m.x, m.z], m.rot, m.model.name, true); if (p) g = g2;
      }
      if (p) { p.model = true; out.models.push(p); } else out.skipped.push(m.model.name);
    }
    for (const h of plan.houses) {
      let spec = h.spec, g = HK().build(spec);
      const bodyRect = (g2) => [-g2.origin[0], -g2.origin[2], -g2.origin[0] + g2.house.width - 1, -g2.origin[2] + g2.house.depth - 1];
      let p = place(g, bodyRect(g), [h.x, h.z], h.rot, h.label, true);
      if (!p) {
        // too big for the gap: without the yard extras
        spec = HK().normalize(Object.assign({}, spec, { extras: spec.extras.filter(e => !/garage|pool|fence|garden|terrace/.test(e)) }));
        g = HK().build(spec); p = place(g, bodyRect(g), [h.x, h.z], h.rot, h.label, true);
      }
      if (p) { p.spec = spec; p.house = true; out.houses.push(p); } else out.skipped.push(h.label || spec.name);
    }
    out.occ = occ; out.body = body;
    return out;
  };

  // ---------------------------------------------------------------- the build: one list of block changes
  SITE.build = function (plan, placed, A, sv) {
    const W = new Map(), key = (x, y, z) => x + ',' + y + ',' + z;
    const set = (x, y, z, s) => { if (s === undefined || s === null) return; W.set(key(x, y, z), [x, y, z, s]); };
    const get = (x, y, z) => { const c = W.get(key(x, y, z)); return c ? c[3] : WM.getBlock(x, y, z); };
    const hgt = Int16Array.from(sv.top);                                // ground top after levelling
    const gX = (x) => A.x0 + x, gZ = (z) => A.z0 + z;
    const AIR = 0, DIRT = st('dirt'), GRASS = st('grass_block');
    const occ = placed.occ, body = placed.body, fromHouse = new Set();   // cells a house laid itself (its porch, its terrace)
    const inA = (x, z) => x >= 0 && z >= 0 && x < A.w && z < A.d;
    // clear what grows above a column (plants, leaves, logs) up to a height
    const clearUp = (x, z, from, to) => { for (let y = from; y <= to; y++) { const s = get(gX(x), y, gZ(z)); if (s && (TREE_RE.test(nm(s)) || (T.flags[s] & F.REPLACE))) set(gX(x), y, gZ(z), AIR); } };
    // level a column to height Fy (cut the hill, fill the hollow) with grass on top
    const level = (x, z, Fy) => {
      const i = z * A.w + x, g = hgt[i];
      if (sv.kind[i] === 2) return;
      if (g > Fy) { for (let y = Fy + 1; y <= g; y++) set(gX(x), y, gZ(z), AIR); set(gX(x), Fy, gZ(z), GRASS); clearUp(x, z, g + 1, g + 14); }
      else if (g < Fy) { for (let y = g + 1; y < Fy; y++) set(gX(x), y, gZ(z), DIRT); set(gX(x), Fy, gZ(z), GRASS); clearUp(x, z, Fy + 1, Fy + 14); }
      else clearUp(x, z, Fy + 1, Fy + 14);
      hgt[i] = Fy;
    };
    // ---- houses and landmarks: the ground levelled under their footprint (and a ring around), then the grid
    for (const p of placed.houses.concat(placed.models)) {
      const g = p.g;
      for (let z = -1; z <= g.sz; z++) for (let x = -1; x <= g.sx; x++) {
        const ax = p.X0 + x, az = p.Z0 + z; if (!inA(ax, az)) continue;
        const inside = x >= 0 && z >= 0 && x < g.sx && z < g.sz && p.fp[z * g.sx + x];
        const near = !inside && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => { const xx = x + a, zz = z + b; return xx >= 0 && zz >= 0 && xx < g.sx && zz < g.sz && p.fp[zz * g.sx + xx]; });
        if (inside || near) level(ax, az, p.F);
      }
      // a house's clip has y = 0 at its floor (dy = origin − 1 puts that floor into the ground's top); a model stands on it
      const y0 = p.house ? p.F + g.origin[1] : p.F + 1;
      for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) {
        const s = g.blocks[(y * g.sz + z) * g.sx + x]; if (s === KEEP) continue;
        set(gX(p.X0 + x), y0 + y, gZ(p.Z0 + z), s); fromHouse.add(key(gX(p.X0 + x), y0 + y, gZ(p.Z0 + z)));
      }
    }
    // ---- areas: plazas, fields, flower meadows
    for (const a of plan.areas) {
      const mat = AREAM[a.material] || 'stone_bricks';
      for (let z = a.z; z < Math.min(A.d - 1, a.z + a.d); z++) for (let x = a.x; x < Math.min(A.w - 1, a.x + a.w); x++) {
        const i = z * A.w + x; if (body[i] || sv.kind[i] === 2) continue;
        const y = hgt[i];
        clearUp(x, z, y + 1, y + 12);
        if (a.material === 'field') {
          const water = (z - a.z) % 5 === 2;
          set(gX(x), y, gZ(z), water ? st('water') : st('farmland'));
          if (!water && has('wheat')) set(gX(x), y + 1, gZ(z), st(['wheat', 'carrots', 'potatoes'][((a.x + a.z) >> 1) % 3] || 'wheat'));
        } else if (a.material === 'flowers') { set(gX(x), y, gZ(z), GRASS); if ((x + z * 3) % 2 === 0) set(gX(x), y + 1, gZ(z), st(['poppy', 'dandelion', 'short_grass'][(x * 7 + z) % 3])); }
        else set(gX(x), y, gZ(z), st(mat));
        occ[i] = occ[i] || 2;
      }
    }
    // ---- paths: laid into the ground along the terrain, boardwalks where they cross water
    const pathCells = new Set();
    for (const p of plan.paths) {
      const mat = st(PATHM[p.material] || 'dirt_path') || st('gravel'), r = p.width / 2;
      for (let k = 0; k + 1 < p.points.length; k++) {
        const [x0, z0] = p.points[k], [x1, z1] = p.points[k + 1], dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz || 1;
        for (let z = Math.min(z0, z1) - 3; z <= Math.max(z0, z1) + 3; z++) for (let x = Math.min(x0, x1) - 3; x <= Math.max(x0, x1) + 3; x++) {
          if (!inA(x, z)) continue;
          let t = ((x - x0) * dx + (z - z0) * dz) / L2; t = Math.max(0, Math.min(1, t));
          const ex = x - (x0 + dx * t), ez = z - (z0 + dz * t);
          if (ex * ex + ez * ez > (r + 0.01) * (r + 0.01) && !(p.width === 1 && Math.abs(ex) + Math.abs(ez) < 0.71)) continue;
          const i = z * A.w + x; if (body[i] || pathCells.has(i)) continue;
          pathCells.add(i);
          const y = hgt[i];
          if (fromHouse.has(key(gX(x), y, gZ(z)))) continue;                                 // a porch or terrace floor stays
          if (sv.kind[i] === 2) { set(gX(x), y, gZ(z), st('spruce_planks')); continue; }   // a boardwalk on the water
          const above = get(gX(x), y + 1, gZ(z)); if (above && (T.flags[above] & F.REPLACE)) set(gX(x), y + 1, gZ(z), AIR);
          set(gX(x), y, gZ(z), mat);
        }
      }
    }
    // ---- no door without a way to it: a shortest walk from each front door to the nearest path or plaza (around the
    // houses, never through water), laid in the place's path material; with no network yet, to the nearest door
    const netMat = st(PATHM[(plan.paths[0] && plan.paths[0].material) || 'path'] || 'dirt_path') || st('gravel');
    const isNet = (i) => pathCells.has(i) || occ[i] === 2;
    const doors = placed.houses.filter(h => h.door).map(h => { const d = DIR[h.rot]; return [h.door[0] + d[0], h.door[1] + d[1]]; }).filter(([x, z]) => inA(x, z));
    const lay = (i) => { if (pathCells.has(i) || occ[i] === 2) return; pathCells.add(i); const x = i % A.w, z = (i / A.w) | 0, y = hgt[i]; if (fromHouse.has(key(gX(x), y, gZ(z)))) return; if (sv.kind[i] === 2) { set(gX(x), y, gZ(z), st('spruce_planks')); return; } const above = get(gX(x), y + 1, gZ(z)); if (above && (T.flags[above] & F.REPLACE)) set(gX(x), y + 1, gZ(z), AIR); set(gX(x), y, gZ(z), netMat); };
    doors.forEach(([sx, sz], di) => {
      const start = sz * A.w + sx; if (body[start]) return;
      const hasNet = pathCells.size > 0 || plan.areas.length > 0;
      const goal = (i) => (hasNet ? isNet(i) : doors.some(([x, z], dj) => dj !== di && z * A.w + x === i));
      if (goal(start)) return;
      const prev = new Int32Array(A.w * A.d).fill(-2); prev[start] = -1; const q = [start]; let hit = -1;
      for (let qi = 0; qi < q.length && hit < 0; qi++) {
        const i = q[qi], x = i % A.w, z = (i / A.w) | 0;
        if (Math.abs(x - sx) + Math.abs(z - sz) > 48) continue;
        for (const [dx, dz] of DIR) {
          const nx = x + dx, nz = z + dz; if (!inA(nx, nz)) continue;
          const j = nz * A.w + nx; if (prev[j] !== -2 || body[j] || sv.kind[j] === 2 || occ[j] === 3) continue;
          if (Math.abs(hgt[j] - hgt[i]) > 2) continue;   // no path up a cliff
          prev[j] = i; if (goal(j)) { hit = j; break; } q.push(j);
        }
      }
      if (hit < 0) return;
      for (let i = prev[hit]; i >= 0; i = prev[i]) lay(i);
    });
    // ---- trees
    const tree = (x, z, kind) => {
      const i = z * A.w + x; if (!inA(x, z) || occ[i] || pathCells.has(i) || sv.kind[i] === 2 || sv.kind[i] === 5) return;
      const y = hgt[i] + 1, X = gX(x), Z = gZ(z), put = (dx, dy, dz, n, pr) => { const s = st(n, pr); if (s) { const cur = get(X + dx, y + dy, Z + dz); if (!cur || (T.flags[cur] & F.REPLACE) || TREE_RE.test(nm(cur))) set(X + dx, y + dy, Z + dz, s); } };
      const h0 = 4 + ((x * 31 + z * 17) % 3);
      if (kind === 'palm' && has('vx_palm_crown')) {
        for (let k = 0; k < h0 + 3; k++) put(0, k, 0, k >= h0 + 1 ? 'vx_palm_shaft' : (has('vx_royal_trunk') ? 'vx_royal_trunk' : 'jungle_log'));
        const ty = h0 + 3; put(0, ty, 0, 'vx_palm_crown');
        for (const [a, b, f] of [[1, 0, 1], [-1, 0, 3], [0, 1, 2], [0, -1, 0]]) { put(a, ty, b, 'vx_palm_frond', { facing: f }); put(a, ty - 1, b, 'vx_palm_frond', { facing: f }); }
      } else if (kind === 'fruit' && has('vx_fruit_trunk')) {
        const f = ['apple', 'cherry', 'plum', 'orange'][(x + z) % 4];
        for (let k = 0; k < 3; k++) put(0, k, 0, 'vx_fruit_trunk');
        for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { put(a, 3, b, 'vx_fruit_crown_' + f); if (Math.abs(a) + Math.abs(b) <= 1) put(a, 4, b, 'vx_fruit_crown_' + f); }
      } else if (kind === 'spruce') {
        const h = h0 + 3; for (let k = 0; k < h; k++) put(0, k, 0, 'spruce_log');
        for (let k = 2; k <= h; k++) { const rr = k >= h - 1 ? 0 : Math.max(1, Math.round((h - k) / 2.5)); for (let a = -rr; a <= rr; a++) for (let b = -rr; b <= rr; b++) if ((a || b || k >= h - 1) && Math.abs(a) + Math.abs(b) <= rr + (k % 2 ? 0 : 1)) put(a, k, b, 'spruce_leaves'); }
        put(0, h, 0, 'spruce_leaves');
      } else {
        const log = kind === 'birch' ? 'birch_log' : kind === 'cherry' ? 'cherry_log' : 'oak_log', leaf = kind === 'birch' ? 'birch_leaves' : kind === 'cherry' ? 'cherry_leaves' : 'oak_leaves';
        for (let k = 0; k < h0; k++) put(0, k, 0, log);
        for (let k = h0 - 2; k <= h0 + 1; k++) { const rr = k >= h0 ? 1 : 2; for (let a = -rr; a <= rr; a++) for (let b = -rr; b <= rr; b++) { if (Math.abs(a) === rr && Math.abs(b) === rr && ((a + b + k) & 1)) continue; if (!a && !b && k < h0) continue; put(a, k, b, leaf); } }
      }
      occ[i] = 3;
    };
    for (const [x, z, kind] of plan.trees) tree(x, z, kind);
    // ---- props
    const modern = plan.houses.some(h => h.spec && h.spec.style === 'modern');
    for (const p of plan.props) {
      const i = p.z * A.w + p.x; if (!inA(p.x, p.z)) continue;
      const y = hgt[i], X = gX(p.x), Z = gZ(p.z), d = DIR[p.rot], free = !body[i] && sv.kind[i] !== 2;
      switch (p.kind) {
        case 'lamp': if (free) set(X, y + 1, Z, st(modern && has('vx_lamppost_black') ? 'vx_lamppost_black' : 'vx_lamppost') || st('lantern')); break;
        case 'bench': if (free && VR.VM && VR.VM.MODELS.vm_bench) VR.VM.put((x, yy, z, n, pr) => set(x, yy, z, st(n, pr)), X, y + 1, Z, 'vm_bench', p.rot); break;
        case 'well': if (free) { set(X, y + 1, Z, st('vx_well') || st('stone_bricks')); } break;
        case 'fountain': if (free) { for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const k = (p.z + b) * A.w + p.x + a; if (!inA(p.x + a, p.z + b) || body[k]) continue; set(X + a, hgt[k], Z + b, st(Math.abs(a) === 2 || Math.abs(b) === 2 ? 'travertine' : 'paver_grey')); } set(X, y + 1, Z, st('vx_fountain') || st('stone_bricks')); } break;
        case 'market': if (free) {
          // a market stall: three crates of goods under a striped awning, two posts at the back
          const along = p.rot & 1 ? [0, 1] : [1, 0], back = [-d[0], -d[1]], aw = ['vx_awning_red', 'vx_awning_blue', 'vx_awning_green', 'vx_awning_yellow'][(p.x + p.z) % 4];
          for (let a = 0; a < 3; a++) {
            const cx = X + along[0] * a, cz = Z + along[1] * a;
            set(cx, y + 1, cz, st('vx_veg_crate') || st('barrel'));
            set(cx, y + 3, cz, st(aw, { facing: p.rot }) || st('red_wool'));
            if (a !== 1) { set(cx + back[0], y + 1, cz + back[1], st('oak_fence')); set(cx + back[0], y + 2, cz + back[1], st('oak_fence')); set(cx + back[0], y + 3, cz + back[1], st('oak_slab', { type: 'bottom' })); }
          }
        } break;
        case 'dock': {
          // planks out over the water, two wide, posts on the sides, a lantern at the end
          const n = p.len, side = [d[1], -d[0]];
          let wl = -1; for (let k = 0; k <= n; k++) { const xx = p.x + d[0] * k, zz = p.z + d[1] * k; if (!inA(xx, zz)) break; const kk = zz * A.w + xx; if (sv.kind[kk] === 2) { wl = sv.top[kk]; break; } }
          const yy = wl >= 0 ? wl : y;
          for (let k = 0; k <= n; k++) for (const s0 of [0, 1]) {
            const xx = p.x + d[0] * k + side[0] * s0, zz = p.z + d[1] * k + side[1] * s0; if (!inA(xx, zz)) continue;
            const kk = zz * A.w + xx; if (body[kk]) continue;
            set(gX(xx), Math.max(yy, sv.kind[kk] === 2 ? sv.top[kk] : hgt[kk]), gZ(zz), st('spruce_planks'));
            if (k % 3 === 0 && sv.kind[kk] === 2) for (let q = sv.solid[kk] + 1; q < sv.top[kk]; q++) set(gX(xx), q, gZ(zz), st('spruce_log'));
          }
          const ex = p.x + d[0] * n, ez = p.z + d[1] * n; if (inA(ex, ez)) set(gX(ex), yy + 1, gZ(ez), st('lantern'));
          break;
        }
        case 'boat': {
          // a little rowing boat on the water: a planked hull, two seats
          if (sv.kind[i] !== 2) break;
          const yy = sv.top[i], along = p.rot & 1 ? [1, 0] : [0, 1], side = p.rot & 1 ? [0, 1] : [1, 0];
          for (let k = -2; k <= 2; k++) for (const s0 of [0, 1]) {
            const xx = p.x + along[0] * k + side[0] * s0, zz = p.z + along[1] * k + side[1] * s0; if (!inA(xx, zz)) continue;
            const end = Math.abs(k) === 2;
            set(gX(xx), yy, gZ(zz), st(end ? 'spruce_planks' : 'oak_planks'));
            if (!end) set(gX(xx), yy + 1, gZ(zz), k === 0 ? st('oak_slab', { type: 'bottom' }) : AIR);
            else set(gX(xx), yy + 1, gZ(zz), st('spruce_slab', { type: 'bottom' }));
          }
          break;
        }
        case 'flowers': if (free) for (let k = 0; k < 3; k++) { const xx = p.x + (p.rot & 1 ? 0 : k), zz = p.z + (p.rot & 1 ? k : 0); if (!inA(xx, zz)) continue; const kk = zz * A.w + xx; if (body[kk] || pathCells.has(kk)) continue; set(gX(xx), hgt[kk] + 1, gZ(zz), st(['vx_flowerbed', 'vx_flowerbed_roses', 'vx_flowerbed_tulips'][(xx + zz) % 3]) || st('poppy')); } break;
        case 'statue': if (free) { set(X, y + 1, Z, st('stone_bricks')); if (VR.VM && VR.VM.MODELS.vm_sculpture) VR.VM.put((x, yy, z, n, pr) => set(x, yy, z, st(n, pr)), X, y + 2, Z, 'vm_sculpture', p.rot); } break;
        case 'campfire': if (free) { set(X, y + 1, Z, st('campfire')); for (const [a, b] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) { const k = (p.z + b) * A.w + p.x + a; if (inA(p.x + a, p.z + b) && !body[k]) set(X + a, hgt[k] + 1, Z + b, st('spruce_slab', { type: 'bottom' })); } } break;
        case 'fence': for (let k = 0; k < p.len; k++) { const xx = p.x + d[0] * k, zz = p.z + d[1] * k; if (!inA(xx, zz)) break; const kk = zz * A.w + xx; if (body[kk] || pathCells.has(kk) || sv.kind[kk] === 2) continue; set(gX(xx), hgt[kk] + 1, gZ(zz), st('oak_fence')); } break;
        case 'hay': if (free) { set(X, y + 1, Z, st('hay_block')); if (inA(p.x + 1, p.z)) set(X + 1, hgt[i + 1] + 1, Z, st('hay_block')); set(X, y + 2, Z, st('hay_block')); } break;
      }
    }
    // only what lies in the loaded region
    const box = WM.regionBox();
    const list = []; for (const c of W.values()) if (c[0] >= box[0] && c[0] < box[3] && c[2] >= box[2] && c[2] < box[5] && c[1] > 0 && c[1] < 500) list.push(c);
    return { list, paths: pathCells.size };
  };

  // ---------------------------------------------------------------- the wish, read
  const W = (list) => list;
  const KINDW = [
    ['harbor', W(['fischerdorf', 'hafen', 'hafenstadt', 'hafendorf', 'kustendorf', 'kuste', 'kustenort', 'seehafen', 'harbor', 'harbour', 'port', 'fishing village', 'fischer'])],
    ['beach', W(['ferienort', 'ferienanlage', 'badeort', 'strandort', 'strand', 'resort', 'beach', 'seebad'])],
    ['castle', W(['burgstadt', 'burgdorf', 'ritterdorf', '=burg', 'festung', 'castle town', 'castle', 'mittelalter', 'mittelalterlich', 'medieval'])],
    ['farm', W(['bauernhof', '=hof', 'gehoft', 'gutshof', 'landgut', 'farm', 'ranch', 'bauernhofe'])],
    ['camp', W(['zeltlager', 'zeltplatz', 'campingplatz', 'camping', 'lager', 'camp', 'pfadfinder'])],
    ['mountain', W(['bergdorf', 'alpendorf', 'almdorf', 'alm', 'bergsiedlung', 'mountain village', 'alpen', 'gebirge'])],
    ['modern', W(['villensiedlung', 'villenviertel', 'neubaugebiet', 'neubausiedlung', 'siedlung', 'vorort', 'wohnviertel', 'suburb', 'modern', 'modernes', 'moderne'])],
    ['town', W(['stadt', 'kleinstadt', 'altstadt', 'stadtchen', 'stadtteil', 'viertel', 'town', 'city', 'innenstadt', 'marktstadt'])],
    ['village', W(['dorf', 'dorfchen', 'dorfer', 'weiler', 'village', 'hamlet', 'ort', 'ortschaft'])],
  ];
  const NAMES = {
    harbor: ['Möwenhafen', 'Fischerbucht', 'Ankerstadt', 'Seewind', 'Hafenkate'], beach: ['Sonnenstrand', 'Palmenbucht', 'Wellental', 'Dünenblick'], castle: ['Burgstein', 'Falkenfels', 'Rabenburg', 'Löwenstein'],
    farm: ['Sonnenhof', 'Lindenhof', 'Kleeblatthof', 'Mühlenhof'], camp: ['Waldlager', 'Fuchsbau-Camp', 'Lagerfeuerplatz'], mountain: ['Tannengrund', 'Gipfelblick', 'Almrausch', 'Bergheim'],
    modern: ['Seeblick', 'Neue Mitte', 'Sonnenhang', 'Parkviertel'], town: ['Rosenthal', 'Marktstedt', 'Alt-Lindau', 'Brunnenstadt'], village: ['Lindenau', 'Kirschental', 'Wiesengrund', 'Neudorf', 'Bachheim'],
  };
  // the name: the last one in quotes ("…, Name „Lindenhof am See“" renames), or one given with "namens"
  const lastName = (text) => { const qs = [...String(text || '').matchAll(/[„"“]([^"“”„]{2,40})["“”]/g)]; if (qs.length) return qs[qs.length - 1][1].trim(); const B = VR.GenieBrain; return B && B.givenName ? B.givenName(text) : null; };
  SITE.brief = function (text) {
    const B = VR.GenieBrain, n = B ? B.norm(text) : String(text || '').toLowerCase(), w = (stems) => (B ? B.wants(n, stems) : null);
    let kind = 'village', kAt = 1e9;
    for (const [k, stems] of KINDW) { const re = new RegExp('(' + stems.map(x => (x[0] === '=' ? '\\b' + x.slice(1) : x)).join('|') + ')', 'g'); let m; while ((m = re.exec(n))) { if (m.index < kAt) { kAt = m.index; kind = k; } } }
    const HW = ['hauser', 'hausern', '=haus', 'hauschen', 'gebaude', 'houses', 'homes', 'hutten', 'villen', 'hofe', 'bauernhauser', 'wohnhauser', 'fischerhauser'];
    let count = B ? B.numBefore(n, HW) : null;
    if (count === null && /\b(viele|lots of|many) (hauser|hausern|houses|gebaude)\b/.test(n)) count = 12;
    if (count === null && /\b(wenige|ein paar|few|some) (hauser|hausern|houses|gebaude)\b/.test(n)) count = 4;
    const more = (n.match(/\b(mehr|more) (hauser|hausern|houses|gebaude)\b/g) || []).length - (n.match(/\b(weniger|fewer|less) (hauser|hausern|houses|gebaude)\b/g) || []).length;
    const hints = B ? B.houseHints(n) : {};
    const pathW = /\b(kopfsteinpflaster|pflaster|gepflastert\w*|steinwege|kopfstein|cobble\w*)\b/.test(n) ? 'cobble' : /\b(kieswege?|kies|gravel)\b/.test(n) ? 'gravel' : /\b(holzstege?|holzwege?|planken|boardwalks?)\b/.test(n) ? 'planks' : /\b(platten|pflasterplatten|paver\w*)\b/.test(n) ? 'paver' : /\b(sandwege?)\b/.test(n) ? 'sand' : null;
    return {
      kind, count, more, style: hints.style || null, hints, path: pathW, name: lastName(text),
      church: w(['kirche', 'kirchen', 'kapelle', '=dom', 'kirchturm', 'church', 'chapel']), lighthouse: w(['leuchtturm', 'lighthouse']), windmill: w(['windmuhle', '=muhle', 'windmill']),
      tower: w(['=turm', 'wachturm', 'aussichtsturm', 'tower', 'lookout']), castle: w(['=burg', 'schloss', 'festung', 'castle']), ferris: w(['riesenrad', 'jahrmarkt', 'kirmes', 'ferris']),
      fountain: w(['springbrunnen', 'brunnen', 'fontane', 'fountain']), well: w(['ziehbrunnen', 'wunschbrunnen', 'well']), statue: w(['statue', 'denkmal', 'monument']),
      docks: w(['steg', 'stege', 'stegen', 'bootssteg', 'anleger', 'pier', 'docks', 'dock', 'hafen', 'kai']), boats: w(['boot', 'boote', 'booten', 'kahn', 'fischerboot', 'fischerboote', 'boats', 'boat', 'schiffe']),
      fields: w(['feld', 'felder', 'feldern', 'acker', 'getreide', 'weizen', 'fields', 'field', 'crops', 'landwirtschaft']), forest: w(['=wald', 'walder', 'waldchen', 'baume', 'baumen', 'forest', 'woods', 'trees', 'waldrand']),
      orchard: w(['obstwiese', 'obstgarten', 'obstbaume', 'obstbaumen', 'orchard', 'apfelbaume']), market: w(['markt', 'marktplatz', 'marktstand', 'marktstande', 'stande', 'market', 'basar']),
      lamps: w(['laterne', 'laternen', 'lampen', 'lamps', 'lanterns', 'beleuchtung']), benches: w(['=bank', 'banke', 'banken', 'benches', 'sitzbanke']), fence: w(['zaun', 'zaune', 'zaunen', 'fence', 'fences', 'gatter']),
      flowers: w(['blumen', 'blumenwiese', 'blumenbeete', 'beete', 'garten', 'garden', 'gardens', 'flowers']), campfire: w(['lagerfeuer', 'feuerstelle', 'campfire', 'bonfire']), plaza: w(['platz', 'dorfplatz', 'marktplatz', 'plaza', 'square', 'piazza']),
      tents: w(['=zelt', 'zelte', 'zelten', 'tents', 'tipi', 'tipis']), cherry: w(['kirschbaum', 'kirschbaume', 'kirschbluten', 'sakura', 'cherry']), palms: w(['palme', 'palmen', 'palms']),
    };
  };
  // ---------------------------------------------------------------- a plan from the wish and the ground (deterministic for a seed)
  SITE.generate = function (br, A, sv, seed) {
    let r = (seed >>> 0) || 1; const rnd = () => { r ^= r << 13; r ^= r >>> 17; r ^= r << 5; return (r >>> 0) / 4294967296; };
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const N = A.w * A.d, at = (x, z) => z * A.w + x, inA = (x, z) => x >= 0 && z >= 0 && x < A.w && z < A.d;
    const dry = (i) => sv.kind[i] !== 2 && sv.kind[i] !== 5;
    // how far every cell is from water (in blocks, up to 40)
    const wd = new Int16Array(N).fill(999), q = [];
    for (let i = 0; i < N; i++) if (sv.kind[i] === 2) { wd[i] = 0; q.push(i); }
    for (let qi = 0; qi < q.length; qi++) { const i = q[qi], x = i % A.w, z = (i / A.w) | 0; if (wd[i] >= 40) continue; for (const [dx, dz] of DIR) { const nx = x + dx, nz = z + dz; if (!inA(nx, nz)) continue; const j = at(nx, nz); if (wd[j] > wd[i] + 1) { wd[j] = wd[i] + 1; q.push(j); } } }
    const hasWater = q.length > 0, coast = br.kind === 'harbor' || br.kind === 'beach';
    const flat = (x, z, rr) => { let lo = 1e9, hi = -1e9, bad = 0; for (let b = -rr; b <= rr; b += 2) for (let a = -rr; a <= rr; a += 2) { const xx = x + a, zz = z + b; if (!inA(xx, zz)) { bad++; continue; } const i = at(xx, zz); if (!dry(i)) bad++; lo = Math.min(lo, sv.top[i]); hi = Math.max(hi, sv.top[i]); } return { lo, hi, bad }; };
    // the plaza: a flat dry spot near the middle (on the coast: near the water)
    let best = null;
    for (let z = 8; z < A.d - 8; z += 2) for (let x = 8; x < A.w - 8; x += 2) {
      const f = flat(x, z, 3), i = at(x, z);
      const sc = (f.hi - f.lo) * 3 + f.bad * 10 + Math.hypot(x - A.w / 2, z - A.d / 2) * (coast && hasWater ? 0.04 : 0.15) + (coast && hasWater ? Math.abs(wd[i] - 9) * 0.8 : 0);
      if (!best || sc < best.sc) best = { x, z, sc };
    }
    const cx = best ? best.x : A.w >> 1, cz = best ? best.z : A.d >> 1;
    const style = br.style || { harbor: 'cottage', beach: 'modern', castle: 'classic', farm: 'cottage', camp: 'cabin', mountain: 'cabin', modern: 'modern', town: 'classic' }[br.kind] || pick(['cottage', 'cottage', 'cabin', 'classic', 'modern']);
    const area = A.w * A.d;
    let want = br.count !== null && br.count !== undefined ? br.count : { village: Math.round(area / 600), town: Math.round(area / 380), farm: 2, camp: 1, harbor: Math.round(area / 620), beach: Math.round(area / 700), castle: Math.round(area / 800), mountain: Math.round(area / 700), modern: Math.round(area / 520) }[br.kind];
    want = Math.max(br.kind === 'camp' ? 0 : 1, Math.min(16, (want || 4) + 3 * (br.more || 0)));
    const houses = [], paths = [], props = [], trees = [], areas = [], models = [];
    // spots for houses: every 3 blocks, scored by how flat and dry a 9 × 9 patch is and how near the plaza
    const cand = [];
    for (let z = 6; z < A.d - 6; z += 3) for (let x = 6; x < A.w - 6; x += 3) {
      const dd = Math.hypot(x - cx, z - cz); if (dd < 9) continue;
      const f = flat(x, z, 4); if (f.bad || f.hi - f.lo > 9) continue;
      cand.push({ x, z, sc: (f.hi - f.lo) * 4 + dd * 0.35 + rnd() * 3 + (coast && hasWater ? Math.max(0, wd[at(x, z)] - 14) * 0.6 : 0) });
    }
    cand.sort((a, b) => a.sc - b.sc);
    const gapX = br.kind === 'town' ? 12 : 14, gapZ = br.kind === 'town' ? 11 : 13;
    const HARBOR = ['#a8322a', '#2f5d8a', '#e8c46a', '#f4f4f2', '#3e7a5a', '#c8693f'];
    const specFor = (k) => {
      if (br.kind === 'farm' && k === 0) return HK().normalize(Object.assign({}, VR.GenieBrain ? VR.GenieBrain.house('Bauernhaus').spec : {}, { width: 13, depth: 9, extras: ['chimney', 'porch', 'flowers'] }));
      if (br.kind === 'farm' && k === 1) return HK().normalize({ name: 'Scheune', style: 'cottage', width: 12, depth: 9, floors: 1, floorHeight: 5, roof: { type: 'gable', color: '#4f5663' }, walls: { material: 'wood', color: '#8e2a20' }, accent: '#f4f4f2', windows: { style: 'small', frame: 'white' }, door: { kind: 'double', color: '#f4f4f2' }, extras: [], interior: false });
      let spec = HK().random(rnd); for (let t = 0; t < 30 && spec.style !== style; t++) spec = HK().random(rnd);
      const big = br.kind === 'modern' || br.kind === 'beach';
      const o = Object.assign({}, spec, { style, width: Math.min(spec.width, big ? 14 : 12), depth: Math.min(spec.depth, big ? 11 : 9), floors: Math.min(spec.floors, br.kind === 'town' ? 3 : 2), extras: spec.extras.filter(e => !/garage|fence/.test(e) && (e !== 'pool' || big)) });
      if (br.kind === 'harbor' && !br.hints.wallColor) o.walls = { material: 'wood', color: HARBOR[k % HARBOR.length] }, o.accent = '#f4f4f2';
      if (br.kind === 'mountain' && !br.hints.wallMaterial) o.walls = { material: rnd() < 0.5 ? 'log' : 'wood', color: '#8a5e36' };
      if (br.hints.roofColor) o.roof = Object.assign({}, o.roof, { color: br.hints.roofColor });
      if (br.hints.roofType) o.roof = Object.assign({}, o.roof, { type: br.hints.roofType });
      if (br.hints.wallColor || br.hints.wallMaterial) o.walls = Object.assign({}, o.walls, br.hints.wallColor ? { color: br.hints.wallColor } : null, br.hints.wallMaterial ? { material: br.hints.wallMaterial } : null);
      return HK().normalize(o);
    };
    const pathMat = br.path || { town: 'cobble', castle: 'cobble', modern: 'paver', beach: 'paver', mountain: 'gravel', harbor: 'gravel' }[br.kind] || (style === 'modern' ? 'paver' : 'path');
    // landmarks from the Genie's library get their ground FIRST (a church that was asked for is never the one that
    // does not fit): sized by their real footprint, turned to face the plaza, away from the plaza and each other
    const B = VR.GenieBrain, land = [], resv = [];
    const want2 = (flag, dflt) => (flag === true || (flag === null && dflt));
    const facing = (x, z) => { const dx = cx - x, dz = cz - z; return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : (dz > 0 ? 2 : 0); };
    const clash = (x, z, hx, hz) => (Math.abs(x - cx) < hx + 7 && Math.abs(z - cz) < hz + 7) || resv.some(q => Math.abs(q.x - x) < hx + q.hx + 2 && Math.abs(q.z - z) < hz + q.hz + 2) ||
      houses.some(h => Math.abs(h.x - x) < hx + 8 && Math.abs(h.z - z) < hz + 7) || areas.some(a => x + hx > a.x - 2 && x - hx < a.x + a.w + 2 && z + hz > a.z - 2 && z - hz < a.z + a.d + 2);
    const spotFor = (sx, sz, score) => {
      let bs = null;
      for (const c of cand) {
        const rot = facing(c.x, c.z), hx = Math.ceil((rot & 1 ? sz : sx) / 2), hz = Math.ceil((rot & 1 ? sx : sz) / 2);
        if (c.x - hx < 1 || c.z - hz < 1 || c.x + hx >= A.w - 1 || c.z + hz >= A.d - 1 || clash(c.x, c.z, hx, hz)) continue;
        const sc = score ? score(c) : c.sc;
        if (!bs || sc < bs.sc) bs = { x: c.x, z: c.z, sc, rot, hx, hz };
      }
      return bs;
    };
    if (want2(br.church, false)) land.push(['church', 28, (c) => Math.abs(Math.hypot(c.x - cx, c.z - cz) - 16) + c.sc * 0.3]);
    if (want2(br.castle, br.kind === 'castle')) land.push(['castle', 34, (c) => -sv.top[at(c.x, c.z)] * 0.8 + c.sc * 0.4]);
    if (want2(br.tower, false)) land.push(['tower', 22, (c) => -sv.top[at(c.x, c.z)] + c.sc * 0.2]);
    if (want2(br.ferris, false)) land.push(['ferris', 24, (c) => Math.hypot(c.x - cx, c.z - cz)]);
    const putLand = (type, size, score, at0) => {
      if (!B || !GN()) return;
      for (const sz0 of [size, Math.round(size * 0.8), Math.round(size * 0.65)]) {
        const m = B.buildModel({ type, size: sz0, colors: {}, feats: {} }); if (!m) return;
        const g = GN().raster(m, { set: 'all', max: 40 }); if (!g) return;
        const s = at0 ? Object.assign({ hx: Math.ceil(g.sx / 2), hz: Math.ceil(g.sz / 2) }, at0) : spotFor(g.sx, g.sz, score);
        if (!s) continue;
        resv.push({ x: s.x, z: s.z, hx: s.hx, hz: s.hz });
        models.push({ x: s.x, z: s.z, rot: s.rot !== undefined ? s.rot : facing(s.x, s.z), type, size: sz0, model: Object.assign(m, { name: B.lib(type).de }) });
        areas.push({ x: s.x - 1, z: s.z - 1, w: 2, d: 2, material: 'grass', label: '' });
        return;
      }
    };
    for (const [type, size, score] of land) putLand(type, size, score);
    if (want2(br.tents, br.kind === 'camp')) for (let k = 0; k < 4; k++) { const t = k * Math.PI / 2 + 0.4; putLand('tent', 11, null, { x: Math.round(cx + 8 * Math.cos(t)), z: Math.round(cz + 8 * Math.sin(t)) }); }
    for (const c of cand) {
      if (houses.length >= want) break;
      if (houses.some(h => Math.abs(h.x - c.x) < gapX && Math.abs(h.z - c.z) < gapZ)) continue;
      if (resv.some(q => Math.abs(q.x - c.x) < q.hx + 8 && Math.abs(q.z - c.z) < q.hz + 7)) continue;
      const { x, z } = c, dx = cx - x, dz = cz - z, rot = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : (dz > 0 ? 2 : 0);
      const s2 = specFor(houses.length);
      houses.push({ x, z, rot, label: s2.name, spec: s2 });
      paths.push({ points: [[x + DIR[rot][0] * 6, z + DIR[rot][1] * 6], [cx, cz]], width: br.kind === 'town' ? 3 : 2, material: pathMat });
      if (br.lamps !== false) { const mx = Math.round((x + cx) / 2), mz = Math.round((z + cz) / 2); props.push({ x: mx + (Math.abs(dz) > Math.abs(dx) ? 2 : 0), z: mz + (Math.abs(dx) >= Math.abs(dz) ? 2 : 0), kind: 'lamp', rot: 0, len: 1 }); }
      if (br.flowers) props.push({ x: x + DIR[(rot + 1) & 3][0] * 5 + DIR[rot][0] * 5, z: z + DIR[(rot + 1) & 3][1] * 5 + DIR[rot][1] * 5, kind: 'flowers', rot: (rot + 1) & 3, len: 3 });
    }
    // the plaza and what stands on it
    if (br.plaza !== false && br.kind !== 'camp') {
      const pw = br.kind === 'town' || br.market ? 11 : 9;
      areas.push({ x: cx - (pw >> 1), z: cz - (pw >> 1), w: pw, d: pw, material: pathMat === 'path' ? 'cobble' : pathMat === 'gravel' ? 'cobble' : pathMat, label: br.market ? 'Marktplatz' : 'Dorfplatz' });
      const fountain = br.fountain || (br.fountain === null && br.well !== true && (style === 'modern' || style === 'classic'));
      if (br.fountain !== false || br.well) props.push({ x: cx, z: cz, kind: fountain && !br.well ? 'fountain' : 'well', rot: 0, len: 1 });
      if (br.benches !== false) for (const [a, b, rt] of [[-3, -3, 2], [3, 3, 0]]) props.push({ x: cx + a, z: cz + b, kind: 'bench', rot: rt, len: 1 });
      if (br.market || (br.market === null && br.kind === 'town')) for (const [a, b, rt] of [[-4, 4, 0], [4, -4, 2], [4, 3, 3], [-4, -3, 1]]) props.push({ x: cx + a, z: cz + b, kind: 'market', rot: rt, len: 1 });
      if (br.statue) props.push({ x: cx + 3, z: cz - 3, kind: 'statue', rot: 2, len: 1 });
    }
    if (br.kind === 'camp' || br.campfire) props.push({ x: cx, z: cz, kind: 'campfire', rot: 0, len: 1 });
    // a free spot for something (a field, a landmark): flat, dry, away from houses and the plaza
    const used = (x, z, rx, rz) => houses.some(h => Math.abs(h.x - x) < rx + 6 && Math.abs(h.z - z) < rz + 5) || (Math.abs(x - cx) < rx + 6 && Math.abs(z - cz) < rz + 6) || areas.some(a => x + rx > a.x - 2 && x - rx < a.x + a.w + 2 && z + rz > a.z - 2 && z - rz < a.z + a.d + 2) || resv.some(q => Math.abs(q.x - x) < rx + q.hx + 2 && Math.abs(q.z - z) < rz + q.hz + 2);
    const freeSpot = (rx, rz, score) => { let bestS = null; for (const c of cand) { if (used(c.x, c.z, rx, rz)) continue; const sc = score ? score(c) : c.sc; if (!bestS || sc < bestS.sc) bestS = { x: c.x, z: c.z, sc }; } return bestS; };
    // fields (with a fence on a farm), an orchard
    const nFields = br.fields === false ? 0 : br.fields ? 2 : br.kind === 'farm' ? 3 : 0;
    for (let k = 0; k < nFields && A.w >= 40; k++) {
      const s = freeSpot(5, 6); if (!s) break;
      const fx = Math.max(2, Math.min(A.w - 10, s.x - 4)), fz = Math.max(2, Math.min(A.d - 12, s.z - 5));
      areas.push({ x: fx, z: fz, w: 8, d: 10, material: 'field', label: 'Feld' });
      if (br.fence || (br.fence === null && br.kind === 'farm')) props.push({ x: fx - 1, z: fz - 1, kind: 'fence', rot: 1, len: 10 }, { x: fx - 1, z: fz + 10, kind: 'fence', rot: 1, len: 10 });
    }
    if (br.kind === 'farm') for (const [a, b] of [[3, 3], [5, 4], [4, 6]]) if (houses[1]) props.push({ x: houses[1].x + a + 4, z: houses[1].z + b, kind: 'hay', rot: 0, len: 1 });
    // the windmill stands by the fields, the lighthouse on the shore (both after the houses and fields)
    if (want2(br.windmill, false)) putLand('windmill', 26, (c) => { const fld = areas.find(a => a.material === 'field'); return fld ? Math.hypot(c.x - fld.x - 4, c.z - fld.z - 5) : c.sc; });
    if (want2(br.lighthouse, br.kind === 'harbor') && hasWater) {
      let bs = null;
      for (let z = 5; z < A.d - 5; z++) for (let x = 5; x < A.w - 5; x++) { const i = at(x, z); if (!dry(i) || wd[i] < 2 || wd[i] > 4 || used(x, z, 3, 3)) continue; const sc = -Math.hypot(x - cx, z - cz) * 0.5 + Math.abs(wd[i] - 3) * 3; if (!bs || sc < bs.sc) bs = { x, z, sc }; }
      if (bs) putLand('lighthouse', 30, null, { x: bs.x, z: bs.z });
    }
    // docks and boats where the land meets the water
    const nDocks = br.docks === false ? 0 : br.docks ? 3 : coast ? 2 : 0, nBoats = br.boats === false ? 0 : br.boats ? 3 : br.kind === 'harbor' ? 2 : 0;
    if (hasWater && (nDocks || nBoats)) {
      const shore = [];
      for (let z = 2; z < A.d - 2; z++) for (let x = 2; x < A.w - 2; x++) { const i = at(x, z); if (!dry(i)) continue; DIR.forEach(([dx, dz], rot) => { let run = 0; for (let k = 1; k <= 10; k++) { const xx = x + dx * k, zz = z + dz * k; if (!inA(xx, zz) || sv.kind[at(xx, zz)] !== 2) break; run++; } if (run >= 4) shore.push({ x, z, rot, run, d: Math.hypot(x - cx, z - cz) }); }); }
      shore.sort((a, b) => a.d - b.d);
      const docks = [];
      for (const s of shore) { if (docks.length >= Math.max(nDocks, nBoats ? 1 : 0)) break; if (docks.some(d => Math.hypot(d.x - s.x, d.z - s.z) < 9)) continue; docks.push(s); }
      docks.forEach((s, k) => {
        const len = Math.min(8, s.run - 1);
        if (k < nDocks) props.push({ x: s.x, z: s.z, kind: 'dock', rot: s.rot, len });
        if (k < nBoats) { const side = [DIR[(s.rot + 1) & 3][0] * 3, DIR[(s.rot + 1) & 3][1] * 3], bx = s.x + DIR[s.rot][0] * Math.min(len, 6) + side[0], bz = s.z + DIR[s.rot][1] * Math.min(len, 6) + side[1]; if (inA(bx, bz) && sv.kind[at(bx, bz)] === 2) props.push({ x: bx, z: bz, kind: 'boat', rot: s.rot, len: 1 }); }
      });
    }
    // trees: how many and which kind follow the place and the ground
    const dens = br.forest ? 2.6 : br.forest === false ? 0.15 : { town: 0.4, modern: 0.7, beach: 0.6, camp: 1.8, mountain: 1.4 }[br.kind] || 1;
    const sandy = sv.kind.some(k => k === 1) && hasWater;
    const kinds = br.cherry ? ['cherry', 'cherry', 'oak'] : br.palms || (sandy && (br.kind === 'beach' || br.kind === 'harbor')) ? ['palm', 'palm', 'oak'] : br.kind === 'mountain' || br.kind === 'camp' || style === 'cabin' ? ['spruce', 'spruce', 'birch'] : ['oak', 'birch', 'fruit', 'cherry'];
    for (let k = 0; k < Math.round(area / 90 * dens); k++) trees.push([2 + Math.floor(rnd() * (A.w - 4)), 2 + Math.floor(rnd() * (A.d - 4)), pick(kinds)]);
    if (br.orchard) { const s = freeSpot(5, 5); if (s) for (let b = -4; b <= 4; b += 4) for (let a = -4; a <= 4; a += 4) trees.push([s.x + a, s.z + b, 'fruit']); }
    // the name and what it is
    const name = br.name || pick(NAMES[br.kind] || NAMES.village);
    const parts = [houses.length + ' ' + (houses.length === 1 ? 'Haus' : 'Häuser') + (br.plaza !== false && br.kind !== 'camp' ? ' um einen ' + (br.market ? 'Marktplatz' : 'Dorfplatz') : '')];
    if (models.length) parts.push(models.map(m => m.model.name).filter((v, i, a) => a.indexOf(v) === i).join(', '));
    if (props.some(p => p.kind === 'dock')) parts.push('Stege' + (props.some(p => p.kind === 'boat') ? ' und Boote' : ''));
    if (areas.some(a => a.material === 'field')) parts.push('Felder');
    if (props.some(p => p.kind === 'market')) parts.push('Marktstände');
    const missing = [];
    if ((br.docks || br.boats || br.lighthouse || coast) && !hasWater) missing.push('kein Wasser hier — Hafen und Boote fehlen');
    const notes = parts.join(', ') + ', Wege, ' + (br.lamps === false ? '' : 'Laternen, ') + 'Bäume.' + (missing.length ? ' (' + missing.join('; ') + ')' : '');
    return { kind: 'site', name, notes, houses, paths, areas: areas.filter(a => a.label !== '' || a.material !== 'grass'), trees, props, models, seed };
  };
  // 🎲 a village by chance (the same planner with an empty wish)
  SITE.random = function (A, sv, seed) { return SITE.generate(SITE.brief(''), A, sv, seed); };

  // ---------------------------------------------------------------- the map: the plan drawn over the surveyed ground
  SITE.drawMap = function (cv, A, sv, plan, placed) {
    const x = cv.getContext('2d'), W = cv.width, H = cv.height, k = Math.min(W / A.w, H / A.d), ox = (W - A.w * k) / 2, oz = (H - A.d * k) / 2;
    x.fillStyle = '#07090d'; x.fillRect(0, 0, W, H);
    const span = Math.max(1, sv.max - sv.base);
    for (let z = 0; z < A.d; z++) for (let xx = 0; xx < A.w; xx++) {
      const i = z * A.w + xx, h = (sv.top[i] - sv.base) / span, kd = sv.kind[i];
      const c = kd === 2 ? [40, 90, 170] : kd === 1 ? [200, 185, 140] : kd === 3 ? [128, 128, 130] : kd === 4 ? [40, 95, 50] : kd === 5 ? [150, 110, 90] : kd === 6 ? [235, 240, 245] : [85, 140, 70];
      const f = 0.65 + h * 0.5; x.fillStyle = `rgb(${Math.min(255, c[0] * f) | 0},${Math.min(255, c[1] * f) | 0},${Math.min(255, c[2] * f) | 0})`;
      x.fillRect(ox + xx * k, oz + z * k, Math.ceil(k), Math.ceil(k));
    }
    if (!plan) return;
    const P = (px, pz) => [ox + (px + 0.5) * k, oz + (pz + 0.5) * k];
    for (const a of plan.areas) { x.fillStyle = a.material === 'field' ? 'rgba(210,180,90,0.75)' : a.material === 'flowers' ? 'rgba(230,120,170,0.6)' : 'rgba(205,200,190,0.75)'; x.fillRect(ox + a.x * k, oz + a.z * k, a.w * k, a.d * k); }
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (const p of plan.paths) { x.strokeStyle = p.material === 'planks' ? '#b0844f' : '#e2d3b0'; x.lineWidth = Math.max(1.5, p.width * k); x.beginPath(); p.points.forEach(([px, pz], j) => { const q = P(px, pz); if (j) x.lineTo(q[0], q[1]); else x.moveTo(q[0], q[1]); }); x.stroke(); }
    for (const [tx, tz, kind] of plan.trees) { const q = P(tx, tz); x.fillStyle = kind === 'cherry' ? '#e58fb0' : kind === 'palm' ? '#7cbf4a' : kind === 'spruce' ? '#1f5e34' : '#2f8a3e'; x.beginPath(); x.arc(q[0], q[1], Math.max(1.5, k * 1.2), 0, Math.PI * 2); x.fill(); }
    for (const p of plan.props) { const q = P(p.x, p.z); x.fillStyle = p.kind === 'lamp' ? '#ffd76a' : p.kind === 'dock' || p.kind === 'boat' ? '#b0844f' : p.kind === 'fountain' || p.kind === 'well' ? '#7ad0ff' : '#e0e0e0'; x.fillRect(q[0] - 2, q[1] - 2, 4, 4); }
    // houses: where they will really stand (after the layout), their roof colour, a mark at the door, the name
    x.font = '600 10px system-ui, sans-serif'; x.textAlign = 'center';
    const items = placed ? placed.houses.concat(placed.models) : [];
    for (const it of items) {
      const [a0, b0, a1, b1] = it.body;
      x.fillStyle = it.house ? it.spec.roof.color : '#9b7cf0'; x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 1;
      x.fillRect(ox + a0 * k, oz + b0 * k, (a1 - a0 + 1) * k, (b1 - b0 + 1) * k); x.strokeRect(ox + a0 * k, oz + b0 * k, (a1 - a0 + 1) * k, (b1 - b0 + 1) * k);
      if (it.house) { const d = DIR[it.rot], cxm = (a0 + a1) / 2, czm = (b0 + b1) / 2, ex = d[0] ? (d[0] > 0 ? a1 + 0.5 : a0 - 0.5) : cxm, ez = d[1] ? (d[1] > 0 ? b1 + 0.5 : b0 - 0.5) : czm; const q = [ox + (ex + 0.5) * k, oz + (ez + 0.5) * k]; x.fillStyle = '#fff'; x.beginPath(); x.arc(q[0], q[1], Math.max(2, k * 0.8), 0, Math.PI * 2); x.fill(); }
      const lab = it.label || ''; if (lab && k * (a1 - a0) > 18) { const q = P((a0 + a1) / 2, (b0 + b1) / 2); x.fillStyle = 'rgba(0,0,0,0.55)'; const w = x.measureText(lab).width + 6; x.fillRect(q[0] - w / 2, q[1] - 7, w, 13); x.fillStyle = '#fff'; x.fillText(lab, q[0], q[1] + 3); }
    }
    // north arrow
    x.fillStyle = 'rgba(255,255,255,0.8)'; x.font = '700 11px system-ui'; x.textAlign = 'left'; x.fillText('N ↑', 8, 16);
  };

  // ---------------------------------------------------------------- the flow the dialog uses
  SITE.prepare = function (size, useSel) {
    const A = SITE.areaFor(size, useSel); if (!A) return null;
    SITE.area = A; SITE.sv = SITE.survey(A);
    return A;
  };
  SITE.setPlan = function (plan) {
    if (SITE.plan) { SITE.hist.push(SITE.plan); if (SITE.hist.length > 10) SITE.hist.shift(); }
    SITE.plan = plan; SITE.placed = SITE.layout(plan, SITE.area, SITE.sv);
    return SITE.placed;
  };
  SITE.back = function () { const p = SITE.hist.pop(); if (!p) return false; SITE.plan = p; SITE.placed = SITE.layout(p, SITE.area, SITE.sv); return true; };
  SITE.commit = function () {
    if (!SITE.plan || !SITE.placed || !WM.wb) return 0;
    const b = SITE.build(SITE.plan, SITE.placed, SITE.area, SITE.sv);
    const n = WM.wb.edit(b.list, '🏘 ' + SITE.plan.name);
    return n;
  };
  // plan from the words (a change adds to the words of the current plan and keeps its seed, so the place stays recognisable)
  const hash = (t) => { let h = 2166136261; for (const ch of String(t)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) || 1; };
  SITE.ask = async function (text, change, onStatus) {
    if (!SITE.area || !SITE.sv) throw { code: 'no_area' };
    onStatus && onStatus('think', 0);
    await new Promise(r => setTimeout(r, 20));
    const base = change && SITE.plan ? SITE.plan : null;
    const words = base && base.words ? base.words + ', ' + text : text;
    const seed = base && base.seed ? base.seed : hash(words);
    const plan = SITE.generate(SITE.brief(words), SITE.area, SITE.sv, seed);
    plan.words = words.slice(-1200);
    return plan;
  };
})();
