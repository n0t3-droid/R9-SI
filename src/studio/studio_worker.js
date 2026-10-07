// ============================================================================
// Studio worker extension: on top of the game's worker (textures, meshing) it
// builds whole catalogue houses with the villa generator, lights and meshes
// them section by section with the game's mesher, and reports what each house
// is made of (every furniture model, facade piece and block with counts).
// ============================================================================
(function (VR) {
  'use strict';
  const prev = self.onmessage;
  const PAD = VR.MESH_PAD || 2, PS = 16 + PAD * 2, PSS = PS * PS;
  function toTris(q) {
    const nq = q.length >> 5, out = new Uint16Array(nq * 48);
    for (let i = 0; i < nq; i++) { const s = i * 32, d = i * 48; out.set(q.subarray(s, s + 24), d); out.set(q.subarray(s, s + 8), d + 24); out.set(q.subarray(s + 16, s + 32), d + 32); }
    return out;
  }
  // light a block grid (sx × sy × sz): sky light floods in from every open boundary cell (straight down at full
  // strength), block light spreads from every emitting state
  function lightGrid(sx, sy, sz, blocks) {
    const R = VR.R, T = R.T;
    const N = sx * sy * sz, idx = (x, y, z) => (y * sz + z) * sx + x;
    const light = new Uint16Array(N);
    const q = new Int32Array(N + 16); let qh = 0, qt = 0;
    for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) {
      if (x && y && z && x < sx - 1 && y < sy - 1 && z < sz - 1) continue;
      const i = idx(x, y, z);
      if (T.filter[blocks[i]] < 15) { light[i] = 15 << 12; q[qt++] = i; }
    }
    const DX = [1, -1, 0, 0, 0, 0], DY = [0, 0, 1, -1, 0, 0], DZ = [0, 0, 0, 0, 1, -1];
    while (qh < qt) {
      const i = q[qh++], s = light[i] >>> 12; if (s <= 1) continue;
      const x = i % sx, z = Math.floor(i / sx) % sz, y = Math.floor(i / (sx * sz));
      for (let d = 0; d < 6; d++) {
        const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
        if (nx < 0 || ny < 0 || nz < 0 || nx >= sx || ny >= sy || nz >= sz) continue;
        const n = idx(nx, ny, nz), f = T.filter[blocks[n]]; if (f >= 15) continue;
        const v = (d === 3 && s === 15 && f === 0) ? 15 : s - 1 - f;   // straight down through air: full daylight
        if (v > (light[n] >>> 12)) { light[n] = (light[n] & 0xfff) | (v << 12); if (qt < q.length) q[qt++] = n; }
      }
    }
    qh = qt = 0;
    for (let i = 0; i < N; i++) { const e = T.emit[blocks[i]]; if (e) { light[i] = (light[i] & 0xf000) | e; q[qt++] = i; } }
    while (qh < qt) {
      const i = q[qh++], l = light[i], r = (l >> 8) & 15, g = (l >> 4) & 15, b = l & 15; if (r <= 1 && g <= 1 && b <= 1) continue;
      const x = i % sx, z = Math.floor(i / sx) % sz, y = Math.floor(i / (sx * sz));
      for (let d = 0; d < 6; d++) {
        const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
        if (nx < 0 || ny < 0 || nz < 0 || nx >= sx || ny >= sy || nz >= sz) continue;
        const n = idx(nx, ny, nz), f = T.filter[blocks[n]]; if (f >= 15) continue;
        const dec = 1 + f, nl = light[n], nr = r - dec, ng = g - dec, nb = b - dec, cr = (nl >> 8) & 15, cg = (nl >> 4) & 15, cb = nl & 15;
        if (nr > cr || ng > cg || nb > cb) { light[n] = (nl & 0xf000) | (Math.max(nr, cr) << 8) | (Math.max(ng, cg) << 4) | Math.max(nb, cb); if (qt < q.length) q[qt++] = n; }
      }
    }
    return light;
  }
  // mesh the 16³ section at grid offset (ox, oy, oz); null when it holds nothing
  const TINT = {};
  function meshOne(sx, sy, sz, blocks, light, ox, oy, oz) {
    const idx = (x, y, z) => (y * sz + z) * sx + x;
    const pb = new Uint16Array(PS * PS * PS), pl = new Uint16Array(PS * PS * PS);
    let any = false;
    for (let py = 0; py < PS; py++) for (let pz = 0; pz < PS; pz++) for (let px = 0; px < PS; px++) {
      const x = ox + px - PAD, y = oy + py - PAD, z = oz + pz - PAD, o = py * PSS + pz * PS + px;
      if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) { pl[o] = 15 << 12; continue; }
      const i = idx(x, y, z); pb[o] = blocks[i]; pl[o] = light[i];
      if (blocks[i] && px >= PAD && py >= PAD && pz >= PAD && px < 16 + PAD && py < 16 + PAD && pz < 16 + PAD) any = true;
    }
    if (!any) return null;
    if (!TINT.g) { TINT.g = new Uint16Array(PS * PS).fill(VR.rgb565(127, 191, 85)); TINT.f = new Uint16Array(PS * PS).fill(VR.rgb565(95, 168, 58)); TINT.w = new Uint16Array(PS * PS).fill(VR.rgb565(63, 118, 228)); }
    const r = VR.meshSection({ blocks: pb, light: pl, grass: TINT.g, foliage: TINT.f, water: TINT.w, sy: 0, ox: ox, oz: oz, fancyLeaves: true, smooth: true, vxLod: false });
    return { ox, oy, oz, opaque: toTris(r.opaque), cutout: toTris(r.cutout), trans: toTris(r.trans) };
  }
  // light + mesh a block grid into 16³ sections
  function meshGrid(sx, sy, sz, blocks) {
    const light = lightGrid(sx, sy, sz, blocks), out = [];
    for (let oy = 0; oy < sy; oy += 16) for (let oz = 0; oz < sz; oz += 16) for (let ox = 0; ox < sx; ox += 16) { const m = meshOne(sx, sy, sz, blocks, light, ox, oy, oz); if (m) out.push(m); }
    return out;
  }
  // a catalogue house built on a flat lawn like the town builder does: the block grid (lot + a 2-block margin)
  function houseGrid(m, headroom) {
    const VG = VR.VillageGen, PLAN = VG && VG.plan2, R = VR.R;
    if (!PLAN) throw new Error('no villa catalogue in this build');
    const cat = PLAN.CATALOGUE[m.index]; if (!cat) throw new Error('unknown house ' + m.index);
    const lotW = cat.lot[0], lotD = cat.lot[1], F = 8, pad = 5;   // houses reach up to 4 cells past their lot (steps, porticos, bay windows)
    const ops = [];
    const L = VG.makeLot((x, y, z, s) => ops.push(x, y, z, s), pad, pad, 0);
    const lot = { w: lotW, d: lotD, F, r: 0, ox: pad, oz: pad, kind: 'home' };
    const o = { rng: new VR.RNG(m.seed || 7), ground: () => F - 1, beds: m.beds || 3, mirror: !!m.mirror, noCustom: !!m.noCustom };
    if (m.skin) o.skin = m.skin;
    const t0 = performance.now();
    const info = PLAN.build(L, lot, o);
    const tBuild = performance.now() - t0;
    if (!info) throw new Error('house did not build');
    let maxY = F + 4;
    for (let k = 1; k < ops.length; k += 4) if (ops[k] > maxY) maxY = ops[k];
    const sx = lotW + pad * 2, sz = lotD + pad * 2;
    const sy = headroom ? Math.ceil((maxY + 1 + headroom) / 16) * 16 : maxY + 3;
    const blocks = new Uint16Array(sx * sy * sz);
    const idx = (x, y, z) => (y * sz + z) * sx + x;
    const grass = R.byName.grass_block.defaultState, dirt = R.byName.dirt.defaultState;
    for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) { for (let y = 0; y < F - 1; y++) blocks[idx(x, y, z)] = dirt; blocks[idx(x, F - 1, z)] = grass; }
    const wrote = new Uint8Array(sx * sy * sz);   // the cells the villa builder put something (or air) into
    for (let k = 0; k < ops.length; k += 4) { const x = ops[k], y = ops[k + 1], z = ops[k + 2]; if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) continue; const i = idx(x, y, z); blocks[i] = ops[k + 3]; wrote[i] = 1; }
    return { cat, lotW, lotD, F, pad, info, o, ops, sx, sy, sz, blocks, wrote, tBuild };
  }
  // every catalogue house, lit and meshed, with what it is made of
  function buildHouse(m) {
    const R = VR.R, T = R.T, VX = VR.VX;
    const g = houseGrid(m, 0), { cat, lotW, lotD, F, pad, info, o, ops, sx, sy, sz, blocks } = g;
    // what it is made of: furniture / facade models by anchor part, plain blocks by count
    const models = new Map(), blockCount = new Map();
    for (let i = 0; i < blocks.length; i++) {
      const s = blocks[i]; if (!s) continue;
      const sp = VX.spec(s);
      if (sp && sp.kind === 'model') {
        const t = R.types[T.type[s]];
        if (t.has('part') && t.get(s, 'part') !== 0) continue;
        models.set(sp.model.name, (models.get(sp.model.name) || 0) + 1);
      } else {
        const t = R.types[T.type[s]], nm = t ? t.name : '?';
        blockCount.set(nm, (blockCount.get(nm) || 0) + 1);
      }
    }
    const t1 = performance.now();
    const sections = meshGrid(sx, sy, sz, blocks);
    const tMesh = performance.now() - t1;
    const H = info.plan;
    const rooms = H.floors.map((fl, i) => ({ level: i, y: F + fl.y, rooms: fl.rooms.map(r => ({ type: r.type, id: r.id || null, u0: r.u0, v0: r.v0, u1: r.u1, v1: r.v1 })) }));
    return {
      dims: [sx, sy, sz], floorY: F, storeyH: H.sh, storeys: H.storeys, roofTop: info.roofTop, house: [H.u0 + pad, H.v0 + pad, H.w, H.d], lot: [lotW, lotD, pad],
      family: H.family, skin: info.skin, skins: cat.skins.slice(), mirrored: !!o.mirror, custom: !!info.custom, beds: info.beds.length, seats: info.seats.length, desks: (info.desks || []).length, cars: (info.cars || []).length,
      rooms, blocksTotal: ops.length / 4,
      models: [...models.entries()].map(([name, n]) => [name, n]).sort((a, b) => b[1] - a[1]),
      blocks: [...blockCount.entries()].map(([name, n]) => [name, n]).sort((a, b) => b[1] - a[1]),
      sections, ms: { build: g.tBuild, mesh: tMesh },
      grid: blocks,   // the house's blocks (y, z, x) — the Studio's 🎯 finds what was tapped in it
    };
  }

  // ---------------------------------------------------------------- the Crafter: one house open for editing
  // CS keeps the generated house (base), the edited grid and its light; edits relight the grid and re-mesh only
  // the sections whose blocks or light changed. The grid grows upward in 16-block steps as the player builds.
  let CS = null;
  const sKey = (ox, oy, oz) => ox + ',' + oy + ',' + oz;
  function craftGrow(S, ny) {
    const { sx, sy, sz } = S; if (ny <= sy) return;
    const n = sx * ny * sz, nb = new Uint16Array(n), nbase = new Uint16Array(n), nw = new Uint8Array(n);
    nb.set(S.blocks); nbase.set(S.base); nw.set(S.wrote);
    S.blocks = nb; S.base = nbase; S.wrote = nw; S.sy = ny;
  }
  // the generated house (the pure villa builder, never a design) with a saved design laid on top
  function craftBase(m) {
    const g = houseGrid(Object.assign({}, m, { noCustom: true }), 24);
    const S = { index: m.index, sx: g.sx, sy: g.sy, sz: g.sz, F: g.F, pad: g.pad, lotW: g.lotW, lotD: g.lotD, blocks: g.blocks, base: g.blocks.slice(), wrote: g.wrote, light: null, g };
    let applied = 0;
    const e = m.edit, C = VR.Custom;
    const T = e && C.tplData(e);
    if (T) {
      // v2: the whole template box (keep cells stay as generated)
      const yTop = S.F + T.y1; if (yTop >= S.sy - 2) craftGrow(S, Math.ceil((yTop + 18) / 16) * 16);
      for (let yy = 0; yy < T.H; yy++) for (let v = 0; v < T.D; v++) for (let u = 0; u < T.W; u++) {
        const k = T.idx[(yy * T.D + v) * T.W + u]; if (!k) continue;
        const s = T.st[k], x = T.u0 + u + S.pad, y = S.F + T.y0 + yy, z = T.v0 + v + S.pad;
        if (s < 0 || x < 0 || z < 0 || y < 0 || x >= S.sx || z >= S.sz || y >= S.sy) continue;
        const i = (y * S.sz + z) * S.sx + x; if (S.blocks[i] !== s) applied++;
        S.blocks[i] = s;
      }
    } else if (e && e.cells) {
      // v1: lot-local cells relative to the floor on top of the generated house
      const pal = e.pal.map(C.fromPortable);
      let top = 0; for (const c of e.cells) top = Math.max(top, S.F + c[1]);
      if (top >= S.sy - 2) craftGrow(S, Math.ceil((top + 18) / 16) * 16);
      for (const c of e.cells) {
        const x = c[0] + S.pad, y = S.F + c[1], z = c[2] + S.pad, s = pal[c[3]];
        if (s < 0 || x < 0 || z < 0 || y < 0 || x >= S.sx || z >= S.sz || y >= S.sy) continue;
        S.blocks[(y * S.sz + z) * S.sx + x] = s; applied++;
      }
    }
    S.applied = applied;
    return S;
  }
  function craftOpen(m) {
    CS = craftBase(m);
    const g = CS.g, applied = CS.applied; delete CS.g;
    CS.light = lightGrid(CS.sx, CS.sy, CS.sz, CS.blocks);
    const sections = [];
    for (let oy = 0; oy < CS.sy; oy += 16) for (let oz = 0; oz < CS.sz; oz += 16) for (let ox = 0; ox < CS.sx; ox += 16) { const r = meshOne(CS.sx, CS.sy, CS.sz, CS.blocks, CS.light, ox, oy, oz); if (r) sections.push(r); }
    const H = g.info.plan;
    return { index: m.index, dims: [CS.sx, CS.sy, CS.sz], floorY: g.F, pad: g.pad, lot: [g.lotW, g.lotD], house: [H.u0 + g.pad, H.v0 + g.pad, H.w, H.d], storeyH: H.sh, storeys: H.storeys, roofTop: g.info.roofTop,
      skin: g.info.skin, mirrored: !!g.o.mirror, applied, blocks: CS.blocks.slice(), base: CS.base.slice(), wrote: CS.wrote.slice(), sections };
  }
  // a design → its v2 template, without touching the open Crafter session (the Studio upgrades old designs with this)
  function craftTemplate(m) {
    const S = craftBase(m);
    const r = VR.Custom.makeTemplate({ sx: S.sx, sy: S.sy, sz: S.sz, pad: S.pad, F: S.F, lot: [S.lotW, S.lotD], blocks: S.blocks, base: S.base, wrote: S.wrote });
    return { index: m.index, tpl: r ? r.tpl : null, changed: r ? r.changed : 0, top: r ? r.top : 0, skin: S.g.info.skin, mirrored: !!S.g.o.mirror };
  }
  function craftEdit(m) {
    if (!CS) throw new Error('no house open');
    const ch = m.changes;   // [x, y, z, state, …] in grid coordinates
    let top = 0; for (let k = 1; k < ch.length; k += 4) top = Math.max(top, ch[k]);
    const sy0 = CS.sy;
    if (top >= CS.sy - 2) craftGrow(CS, Math.ceil((top + 18) / 16) * 16);
    const { sx, sz } = CS, sy = CS.sy;
    const dirty = new Set();
    const mark = (x, y, z) => { if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return; dirty.add(sKey(x & ~15, y & ~15, z & ~15)); };
    for (let k = 0; k < ch.length; k += 4) {
      const x = ch[k], y = ch[k + 1], z = ch[k + 2];
      if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) continue;
      CS.blocks[(y * sz + z) * sx + x] = ch[k + 3];
      for (let dy = -PAD; dy <= PAD; dy += PAD) for (let dz = -PAD; dz <= PAD; dz += PAD) for (let dx = -PAD; dx <= PAD; dx += PAD) mark(x + dx, y + dy, z + dz);
    }
    const old = CS.light, oldN = old.length;
    CS.light = lightGrid(sx, sy, sz, CS.blocks);
    // every section whose light changed (incl. a 1-block rim: smooth light and AO read the neighbours)
    for (let i = 0; i < CS.light.length; i++) {
      if (i < oldN && CS.light[i] === old[i]) continue;
      const x = i % sx, z = Math.floor(i / sx) % sz, y = Math.floor(i / (sx * sz));
      mark(x, y, z); if ((x & 15) === 0) mark(x - 1, y, z); if ((x & 15) === 15) mark(x + 1, y, z); if ((y & 15) === 0) mark(x, y - 1, z); if ((y & 15) === 15) mark(x, y + 1, z); if ((z & 15) === 0) mark(x, y, z - 1); if ((z & 15) === 15) mark(x, y, z + 1);
    }
    if (sy !== sy0) for (let oy = sy0 & ~15; oy < sy; oy += 16) for (let oz = 0; oz < sz; oz += 16) for (let ox = 0; ox < sx; ox += 16) dirty.add(sKey(ox, oy, oz));
    const sections = [];
    for (const k of dirty) {
      const [ox, oy, oz] = k.split(',').map(Number);
      const r = meshOne(sx, sy, sz, CS.blocks, CS.light, ox, oy, oz);
      sections.push(r || { ox, oy, oz, empty: true });
    }
    return { dims: [sx, sy, sz], sections };
  }
  // ---------------------------------------------------------------- the world mode: a region of a saved R9-SI world
  // Columns come from the game's save (IndexedDB, read by the page) or from the world's own generator (same seed and
  // options as the game); each column is lit like the game lights it and meshed section by section with its
  // neighbours as padding. Sections reach the page in batches (the region appears while it is meshed); the blocks
  // go along for picking. The region is a diorama: below the lowest ground (minus 24) nothing is meshed.
  const WGEN = new Map();
  const genFor = (m) => { const k = m.dim + '|' + (m.seed >>> 0) + '|' + JSON.stringify(m.opts || {}); let g = WGEN.get(k); if (!g) { g = VR.makeGen(m.dim, m.seed >>> 0, m.opts || {}); WGEN.set(k, g); } return g; };
  const WCOLS = new Map();
  // the world's style on one column of the region: generated land takes the rules, a saved column keeps what the
  // player built and takes the rules where it still holds what the generator made (the game does the same)
  let WSTYLE = null, WREG = null;
  function styledColumn(c) {
    const WS = VR.WorldStyle, st = WSTYLE, map = st && WS ? WS.compile(st.rules) : null;
    let blocks;
    if (c.savedOrig) {
      blocks = c.savedOrig.slice();
      if (st && WS && (c.sv || 0) !== st.sv) { const old = WS.rulesAt(st, c.sv || 0); if (old) WS.reconcile(blocks, c.raw, WS.compile(old), map); }
    } else blocks = map ? WS.applyGen(c.raw.slice(), map) : c.raw.slice();
    const water = c.water0.slice(); if (st && st.water && WS) WS.applyWater(water, st.water);
    // where a cell shows what the rules made of the generator's block, the page needs that block (the 🎨 Stil tab
    // points at a cell and means what was there): [index, raw state] pairs
    let orig = null;
    if (map) { const o = [], r = c.raw, n = Math.min(blocks.length, r.length); for (let i = 0; i < n; i++) { const x = r[i]; if (blocks[i] !== x && blocks[i] === map[x]) o.push(i, x); } if (o.length) orig = Uint32Array.from(o); }
    return { blocks, water, orig };
  }
  function worldRegion(m) {
    const g = genFor(m), sky = m.dim === 'overworld' || m.dim === 'drift' || m.dim === 'flat';
    const saved = new Map(); for (const s of (m.saved || [])) saved.set(s.cx + ',' + s.cz, s);
    WSTYLE = m.style || null;
    const id = m.id, n = m.n, T = VR.R.T, t0 = performance.now();
    WCOLS.clear();
    // centre-out: the middle of the region (where the player was) is ready first
    const order = []; for (let dz = 0; dz < n; dz++) for (let dx = 0; dx < n; dx++) order.push([m.cx0 + dx, m.cz0 + dz, Math.max(Math.abs(dx - (n - 1) / 2), Math.abs(dz - (n - 1) / 2))]);
    order.sort((a, b) => a[2] - b[2]);
    WREG = { order, sky, dim: m.dim };
    let done = 0, outB = [];
    const flushB = () => {
      if (!outB.length) return;
      const tr = []; for (const c of outB) { tr.push(c.blocks.buffer); if (c.orig) tr.push(c.orig.buffer); }
      self.postMessage({ type: 'world_region', id, part: true, sections: [], cols: outB, done, total: order.length * 2, ms: performance.now() - t0 }, tr);
      outB = [];
    };
    for (const [cx, cz] of order) {
      const key = cx + ',' + cz, sv = saved.get(key);
      // the raw generation is kept: the style can be changed and shown again without reading the world twice
      const col = g.generate(cx, cz);
      const c = { cx, cz, raw: col.blocks, savedOrig: sv ? sv.blocks : null, sv: sv ? sv.sv || 0 : 0, grass: col.tints.grass, foliage: col.tints.foliage, water0: col.tints.water };
      const r = styledColumn(c);
      c.blocks = r.blocks; c.water = r.water; c.H = c.blocks.length >> 8; c.orig = r.orig;
      c.light = VR.computeColumnLight(c.blocks, sky);
      let top = 0; for (let y = c.H - 1; y > 0 && !top; y--) for (let i = 0; i < 256; i++) { const s = c.blocks[(y << 8) | i]; if (s && (T.flags[s] & (VR.F.SOLID | VR.F.FLUID))) { top = y; break; } }
      c.top = top;
      WCOLS.set(key, c);
      outB.push({ cx, cz, blocks: c.blocks.slice(), saved: !!sv, orig: c.orig ? c.orig.slice() : null });
      done++; if (outB.length >= 6) flushB();
    }
    flushB();
    regionMesh(id, t0, done, order.length * 2);
  }
  // a new style for the region (the Studio's 🎨 Stil, shown before it goes into the world)
  function worldRestyle(m) {
    if (!WREG) { self.postMessage({ type: 'world_region', id: m.id, part: false, sections: [], cols: [], done: 0, total: 0, ms: 0 }); return; }
    WSTYLE = m.style || null;
    const t0 = performance.now(), T = VR.R.T, outB = [];
    for (const c of WCOLS.values()) {
      const r = styledColumn(c);
      c.blocks = r.blocks; c.water = r.water; c.H = c.blocks.length >> 8; c.orig = r.orig; c.light = VR.computeColumnLight(c.blocks, WREG.sky);
      let top = 0; for (let y = c.H - 1; y > 0 && !top; y--) for (let i = 0; i < 256; i++) { const s = c.blocks[(y << 8) | i]; if (s && (T.flags[s] & (VR.F.SOLID | VR.F.FLUID))) { top = y; break; } }
      c.top = top;
      outB.push({ cx: c.cx, cz: c.cz, blocks: c.blocks.slice(), saved: !!c.savedOrig, orig: c.orig ? c.orig.slice() : null });
    }
    const tr = []; for (const c of outB) { tr.push(c.blocks.buffer); if (c.orig) tr.push(c.orig.buffer); }
    self.postMessage({ type: 'world_region', id: m.id, part: true, sections: [], cols: outB, done: 0, total: WCOLS.size, restyle: true, ms: performance.now() - t0 }, tr);
    regionMesh(m.id, t0, WCOLS.size, WCOLS.size * 2, true);
  }
  // one column's tints with its neighbours as padding, and one of its sections meshed with the neighbours around it
  function colTints(c, nb) {
    const grass = new Uint16Array(PS * PS), foliage = new Uint16Array(PS * PS), water = new Uint16Array(PS * PS);
    for (let pz = 0; pz < PS; pz++) for (let px = 0; px < PS; px++) {
      const lz = pz - PAD, lx = px - PAD, nn = nb[(lz < 0 ? 0 : lz > 15 ? 2 : 1) * 3 + (lx < 0 ? 0 : lx > 15 ? 2 : 1)] || c, ci = (((lz + 16) & 15) << 4) | ((lx + 16) & 15);
      grass[pz * PS + px] = nn.grass[ci]; foliage[pz * PS + px] = nn.foliage[ci]; water[pz * PS + px] = nn.water[ci];
    }
    return { grass, foliage, water };
  }
  const nbOf = (cx, cz) => { const nb = []; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) nb.push(WCOLS.get((cx + dx) + ',' + (cz + dz)) || null); return nb; };
  function meshColSec(cx, cz, sy, nb, tints) {
    const c = nb[4], PSz = PS * PS * PS;
    let any = false; for (let i = sy << 12, e = Math.min(c.blocks.length, (sy + 1) << 12); i < e; i++) if (c.blocks[i]) { any = true; break; }
    if (!any) return null;
    const blocks = new Uint16Array(PSz), light = new Uint16Array(PSz), yb = sy * 16 - PAD;
    for (let pz = 0; pz < PS; pz++) {
      const lz = pz - PAD, czi = lz < 0 ? 0 : lz > 15 ? 2 : 1, iz = (lz + 16) & 15;
      for (let px = 0; px < PS; px++) {
        const lx = px - PAD, cxi = lx < 0 ? 0 : lx > 15 ? 2 : 1, ix = (lx + 16) & 15, nn = nb[czi * 3 + cxi], ci = (iz << 4) | ix;
        for (let py = 0; py < PS; py++) {
          const y = yb + py, o = py * PSS + pz * PS + px;
          if (y < 0) continue;
          if (!nn || y >= nn.H) { light[o] = 0xf000; continue; }
          const i = (y << 8) | ci; blocks[o] = nn.blocks[i]; light[o] = nn.light[i];
        }
      }
    }
    const r = VR.meshSection({ blocks, light, grass: tints.grass, foliage: tints.foliage, water: tints.water, sy, ox: cx * 16, oz: cz * 16, fancyLeaves: true, smooth: true, vxLod: false });
    const sec = { ox: cx * 16, oy: sy * 16, oz: cz * 16, opaque: toTris(r.opaque), cutout: toTris(r.cutout), trans: toTris(r.trans) };
    return sec.opaque.length || sec.cutout.length || sec.trans.length ? sec : null;
  }
  function regionMesh(id, t0, done0, total, restyle) {
    const order = WREG.order;
    let minTop = 1e9; for (const c of WCOLS.values()) if (c.top < minTop) minTop = c.top;
    let done = done0, out = [];
    const flush = (final) => {
      if (!out.length && !final) return;
      const tr = []; for (const s of out) tr.push(s.opaque.buffer, s.cutout.buffer, s.trans.buffer);
      self.postMessage({ type: 'world_region', id, part: !final, sections: out, cols: [], done, total, restyle: !!restyle, ms: performance.now() - t0 }, tr);
      out = [];
    };
    const y0 = Math.max(0, minTop - 24), sy0 = y0 >> 4;
    WREG.sy0 = sy0;
    for (const [cx, cz] of order) {
      const nb = nbOf(cx, cz), c = nb[4], tints = colTints(c, nb);
      const secTop = Math.min(c.H, c.top + 2) >> 4;
      for (let sy = sy0; sy <= secTop; sy++) {
        const sec = meshColSec(cx, cz, sy, nb, tints);
        if (sec) out.push(sec);
        if (out.length >= 24) flush(false);
      }
      done++;
    }
    flush(true);
  }
  // the Werkbank (v0.35): block changes in the region — the columns take them (a generated column becomes a saved one, so
  // a new style keeps them), are lit again, and every section whose blocks or light changed is meshed again
  function worldEdit(m) {
    const ch = m.changes, T = VR.R.T, touched = new Map(), marks = new Set();
    const mark = (cx, sy, cz) => { if (sy >= 0) marks.add(cx + ',' + sy + ',' + cz); };
    for (let k = 0; k < ch.length; k += 4) {
      const x = ch[k], y = ch[k + 1], z = ch[k + 2], s = ch[k + 3], cx = x >> 4, cz = z >> 4;
      const c = WCOLS.get(cx + ',' + cz); if (!c || y < 0 || y >= c.H) continue;
      if (!c.savedOrig) { c.savedOrig = c.blocks.slice(); c.sv = WSTYLE ? WSTYLE.sv || 0 : 0; }
      const i = (y << 8) | ((z & 15) << 4) | (x & 15);
      c.blocks[i] = s; c.savedOrig[i] = s;
      if (!touched.has(c)) touched.set(c, c.light);
      const lx = x & 15, lz = z & 15, ly = y & 15, sy = y >> 4;
      for (let dz = lz === 0 ? -1 : 0; dz <= (lz === 15 ? 1 : 0); dz++) for (let dx = lx === 0 ? -1 : 0; dx <= (lx === 15 ? 1 : 0); dx++) for (let dy = ly === 0 ? -1 : 0; dy <= (ly === 15 ? 1 : 0); dy++) mark(cx + dx, sy + dy, cz + dz);
    }
    for (const [c, old] of touched) {
      c.light = VR.computeColumnLight(c.blocks, WREG.sky);
      let top = 0; for (let y = c.H - 1; y > 0 && !top; y--) for (let i = 0; i < 256; i++) { const s = c.blocks[(y << 8) | i]; if (s && (T.flags[s] & (VR.F.SOLID | VR.F.FLUID))) { top = y; break; } }
      c.top = top;
      // sections whose light changed (and their neighbours: smooth light reads across the border)
      const nsec = c.H >> 4;
      for (let sy = 0; sy < nsec; sy++) {
        let diff = false; for (let i = sy << 12, e = (sy + 1) << 12; i < e; i++) if (c.light[i] !== old[i]) { diff = true; break; }
        if (diff) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) mark(c.cx + dx, sy, c.cz + dz);
      }
    }
    const out = [], empty = [], tc = new Map();
    for (const key of marks) {
      const [cx, sy, cz] = key.split(',').map(Number), c = WCOLS.get(cx + ',' + cz); if (!c || sy >= (c.H >> 4)) continue;
      let t = tc.get(cx + ',' + cz); if (!t) { const nb = nbOf(cx, cz); t = { nb, tints: colTints(c, nb) }; tc.set(cx + ',' + cz, t); }
      const sec = meshColSec(cx, cz, sy, t.nb, t.tints);
      if (sec) out.push(sec); else empty.push([cx * 16, sy * 16, cz * 16]);
    }
    const tr = []; for (const s of out) tr.push(s.opaque.buffer, s.cutout.buffer, s.trans.buffer);
    self.postMessage({ type: 'world_edit', id: m.id, sections: out, empty }, tr);
  }
  // something to place in the world, built and meshed once: a catalogue house (its variant, or the player's design)
  // or a furniture model. Lot-local cells (x = u, z = v, y relative to the floor) + sections of a tight grid around them.
  function placeMesh(m) {
    const cells = new Map(), M = 16;
    let W = 1, D = 1, info = null, name = '', ops = null, forgeMeta = null;
    const VG = VR.VillageGen, PLAN = VG && VG.plan2, F = 64;
    if (m.kind === 'forge') {
      // a Forge structure (🏭) from its DNA on flat ground: every non-keep cell, lot-local
      const Fg = VR.Forge, g = Fg.build(m.dna);
      ops = Fg.ops(g); W = g.sx; D = g.sz; name = Fg.describe(m.dna, true); forgeMeta = g.meta;
    } else if (m.kind === 'house') {
      const cat = PLAN && PLAN.CATALOGUE[m.index]; if (!cat) throw new Error('unknown house ' + m.index);
      W = cat.lot[0]; D = cat.lot[1]; name = cat.name;
      const SX = W + M * 2, SZ = D + M * 2;
      const L = VG.makeLot((x, y, z, s) => { if (x < -M || z < -M || x >= W + M || z >= D + M || y < 0) return; cells.set(((y * SZ) + z + M) * SX + x + M, s); }, 0, 0, 0);
      const o = { index: m.index, rng: new VR.RNG(7), ground: () => F - 1, beds: 3 };
      if (m.skin) o.skin = m.skin; if (m.mirror !== undefined) o.mirror = !!m.mirror;
      if (m.noCustom) o.noCustom = true;
      info = PLAN.build(L, { w: W, d: D, F, r: 0, ox: 0, oz: 0, kind: 'home' }, o);
      if (!info) throw new Error('house did not build');
      var unpack = (key) => [key % SX - M, Math.floor(key / (SX * SZ)) - F, Math.floor(key / SX) % SZ - M];
    } else {
      const VM = VR.VM, mod = VM && VM.MODELS[m.name]; if (!mod) throw new Error('unknown model ' + m.name);
      name = mod.display || m.name;
      const SX = 64, SZ = 64;
      VM.put((u, y, v, nm, pr) => { const t = VR.R.byName[nm]; const s = typeof nm === 'number' ? nm : t ? (pr ? t.state(Object.assign(t.decode(t.defaultState), pr)) : t.defaultState) : 0; cells.set(((y + 8) * SZ + v + 8) * SX + u + 8, s); }, 0, 0, 0, m.name, 0);
      var unpack = (key) => [key % SX - 8, Math.floor(key / (SX * SZ)) - 8, Math.floor(key / SX) % SZ - 8];
      const fp = VM.footprint(mod, 0); W = 1; D = 1; for (const [dx, , dz] of fp) { W = Math.max(W, dx + 1); D = Math.max(D, dz + 1); }
    }
    if (!ops) { ops = new Int32Array(cells.size * 4); let k = 0; for (const [key, s] of cells) { const [x, y, z] = unpack(key); ops[k++] = x; ops[k++] = y; ops[k++] = z; ops[k++] = s; } }
    let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9, top = 0;
    for (let i = 0; i < ops.length; i += 4) {
      const x = ops[i], y = ops[i + 1], z = ops[i + 2], s = ops[i + 3];
      if (!s) continue;
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (z < z0) z0 = z; if (x > x1) x1 = x; if (y > y1) y1 = y; if (z > z1) z1 = z; if (y > top) top = y;
    }
    if (x1 < x0) { x0 = y0 = z0 = 0; x1 = y1 = z1 = 0; }
    // the grid: every non-air cell, one block of air around it (light comes in from the boundary)
    const gx0 = x0 - 1, gy0 = y0 - 1, gz0 = z0 - 1, sx = x1 - gx0 + 2, sy = y1 - gy0 + 2, sz = z1 - gz0 + 2;
    const grid = new Uint16Array(sx * sy * sz);
    for (let i = 0; i < ops.length; i += 4) { const s = ops[i + 3]; if (!s) continue; grid[((ops[i + 1] - gy0) * sz + (ops[i + 2] - gz0)) * sx + (ops[i] - gx0)] = s; }
    const sections = meshGrid(sx, sy, sz, grid);
    const H = info && info.plan;
    return { kind: m.kind, index: m.index, name: m.name || null, dna: m.dna || null, title: name, ops, lot: [W, D], house: H ? [H.u0, H.v0, H.w, H.d] : [0, 0, W, D], bounds: [x0, y0, z0, x1, y1, z1], top, origin: [gx0, gy0, gz0], sections, custom: !!(info && info.custom), skin: info ? info.skin : null, mirror: !!(H && H.mirrored), level: forgeMeta ? forgeMeta.level : true, terrain: forgeMeta ? forgeMeta.terrain : false, doors: forgeMeta ? forgeMeta.doors : null };
  }
  // ---------------------------------------------------------------- the meadow around the Crafter's lot (v0.33.2)
  // The player can walk off the property: grass all around (M blocks), the odd tuft and flower, a garden fence at
  // the edge. The lot itself is a hole (the house grid draws it). Grid coordinates of the meadow: x − M, z − M.
  function craftMeadow(m) {
    const R = VR.R, sx = m.sx, sz = m.sz, F = m.F, M = m.M, SX = sx + 2 * M, SZ = sz + 2 * M, SY = F + 2;
    const blocks = new Uint16Array(SX * SY * SZ), idx = (x, y, z) => (y * SZ + z) * SX + x;
    const st = (n) => (R.byName[n] ? R.byName[n].defaultState : 0);
    const grass = st('grass_block'), dirt = st('dirt'), fence = st('oak_fence'), tuft = st('short_grass');
    const flowers = ['poppy', 'dandelion', 'cornflower', 'allium', 'oxeye_daisy', 'azure_bluet'].map(st).filter(Boolean);
    let seed = 1234567;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let z = 0; z < SZ; z++) for (let x = 0; x < SX; x++) {
      const inLot = x >= M && z >= M && x < M + sx && z < M + sz;
      if (inLot) continue;
      for (let y = 0; y < F - 1; y++) blocks[idx(x, y, z)] = dirt;
      blocks[idx(x, F - 1, z)] = grass;
      const edge = x === 0 || z === 0 || x === SX - 1 || z === SZ - 1;
      if (edge) { if (fence) blocks[idx(x, F, z)] = fence; continue; }
      // a clear strip of lawn along the lot, then tufts and flowers
      const near = x >= M - 3 && z >= M - 3 && x < M + sx + 3 && z < M + sz + 3;
      const r = rnd();
      if (!near && r < 0.05 && tuft) blocks[idx(x, F, z)] = tuft;
      else if (!near && r < 0.058 && flowers.length) blocks[idx(x, F, z)] = flowers[Math.floor(rnd() * flowers.length)];
    }
    return { M, sections: meshGrid(SX, SY, SZ, blocks) };
  }
  self.onmessage = function (e) {
    const m = e.data;
    try {
      if (m.type === 'world_region') { worldRegion(m); return; }
      if (m.type === 'craft_meadow') {
        const r = craftMeadow(m);
        const tr = []; for (const sc of r.sections) tr.push(sc.opaque.buffer, sc.cutout.buffer, sc.trans.buffer);
        self.postMessage(Object.assign({ type: 'craft_meadow', id: m.id }, r), tr);
        return;
      }
      if (m.type === 'world_restyle') { worldRestyle(m); return; }
      if (m.type === 'world_edit') { worldEdit(m); return; }
      if (m.type === 'clip_mesh') {
        // a Werkbank clipboard / Bauteil: its blocks in a grid with one cell of air around, lit and meshed
        const sx = m.sx + 2, sy = m.sy + 2, sz = m.sz + 2, g = new Uint16Array(sx * sy * sz);
        for (let y = 0; y < m.sy; y++) for (let z = 0; z < m.sz; z++) for (let x = 0; x < m.sx; x++) g[((y + 1) * sz + z + 1) * sx + x + 1] = m.blocks[(y * m.sz + z) * m.sx + x];
        const sections = meshGrid(sx, sy, sz, g);
        const tr = []; for (const sc of sections) tr.push(sc.opaque.buffer, sc.cutout.buffer, sc.trans.buffer);
        self.postMessage({ type: 'clip_mesh', id: m.id, sections }, tr);
        return;
      }
      if (m.type === 'place_mesh') {
        const r = placeMesh(m);
        const tr = [r.ops.buffer]; for (const s of r.sections) tr.push(s.opaque.buffer, s.cutout.buffer, s.trans.buffer);
        self.postMessage(Object.assign({ type: 'place_mesh', id: m.id }, r), tr);
        return;
      }
      if (m.type === 'craft_open' || m.type === 'craft_edit') {
        const r = m.type === 'craft_open' ? craftOpen(m) : craftEdit(m);
        const tr = []; for (const sc of r.sections) if (!sc.empty) tr.push(sc.opaque.buffer, sc.cutout.buffer, sc.trans.buffer);
        if (r.blocks) tr.push(r.blocks.buffer, r.base.buffer, r.wrote.buffer);
        self.postMessage(Object.assign({ type: m.type, id: m.id }, r), tr);
      } else if (m.type === 'craft_tpl') {
        self.postMessage(Object.assign({ type: 'craft_tpl', id: m.id }, craftTemplate(m)));
      } else if (m.type === 'house') {
        const r = buildHouse(m);
        const tr = [r.grid.buffer]; for (const s of r.sections) tr.push(s.opaque.buffer, s.cutout.buffer, s.trans.buffer);
        self.postMessage(Object.assign({ type: 'house', id: m.id, index: m.index }, r), tr);
      } else if (m.type === 'blockmesh') {
        // one block (or a small named group) on its own, lit from all sides
        const R = VR.R, t = R.byName[m.name];
        const s = t ? (m.state !== undefined ? m.state : t.defaultState) : 0;
        const blocks = new Uint16Array(27); blocks[(1 * 3 + 1) * 3 + 1] = s;
        const sections = meshGrid(3, 3, 3, blocks);
        const tr = []; for (const sc of sections) tr.push(sc.opaque.buffer, sc.cutout.buffer, sc.trans.buffer);
        self.postMessage({ type: 'blockmesh', id: m.id, name: m.name, sections }, tr);
      } else if (m.type === 'furnsrc') {
        // the edited furniture source: recompile the models the registry already knows (same names), drop the mesh caches
        const VM = VR.VM;
        VM.DEFS.length = 0;
        new Function('VR', m.text)(VR);
        let n = 0;
        for (const d of VM.DEFS) { const old = VM.MODELS[d.name]; if (!old) continue; try { const c = VM.compile(d.name, d.o); if (c.parts.length) { Object.assign(old, c); n++; } } catch (err) { /* keep the old one */ } }
        if (VR.VX.clearCache) VR.VX.clearCache();
        self.postMessage({ type: 'furnsrc', id: m.id, updated: n });
      } else if (prev) prev(e);
    } catch (err) {
      self.postMessage({ type: 'error', id: m.id, msg: String(err && err.stack || err) });
    }
  };
})(VR);
