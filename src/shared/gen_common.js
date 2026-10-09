// ============================================================================
// World-gen toolkit: column writer, trees, vegetation, structures (worker side)
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R;
  const GEN = VR.GEN = {};
  let S_ = null;
  // Lazily resolved state ids
  GEN.S = function () {
    if (S_) return S_;
    const s = (n, p) => R.S(n, p);
    S_ = {
      air: 0, stone: s('stone'), deep: s('deepstone'), bedrock: s('bedrock'), water: s('water'), lava: s('lava'),
      dirt: s('dirt'), grass: s('grass_block'), coarse: s('coarse_dirt'), podzol: s('podzol'), mycelium: s('mycelium'), rooted: s('rooted_dirt'), mud: s('mud'), clay: s('clay'),
      sand: s('sand'), redsand: s('red_sand'), gravel: s('gravel'), sandstone: s('sandstone'), redsandstone: s('red_sandstone'),
      snow1: s('snow', { layers: 0 }), snowblock: s('snow_block'), powder: s('powder_snow'), ice: s('ice'), packed: s('packed_ice'), blueice: s('blue_ice'),
      calcite: s('calcite'), tuff: s('tuff'), granite: s('granite'), diorite: s('diorite'), andesite: s('andesite'), smoothbasalt: s('smooth_basalt'),
      terracotta: s('terracotta'), cobble: s('cobblestone'), mossycobble: s('mossy_cobblestone'), moss: s('moss_block'), mosscarpet: s('moss_carpet'),
      obsidian: s('obsidian'), magma: s('magma_block'), glowlichen: s('glow_lichen'),
      emberrock: s('emberrock'), gloomsand: s('gloom_sand'), gloomsoil: s('gloom_soil'), basalt: s('basalt'), scoria: s('scoria'),
      crimsonmycel: s('crimson_mycel'), tealmycel: s('teal_mycel'), voidstone: s('voidstone'),
      cinnabar: s('cinnabar'), sulfur: s('sulfur'), fuming: s('fuming_sulfur'), dripblock: s('dripstone_block'), echomoss: s('echo_moss'),
      shortgrass: s('short_grass'), fern: s('fern'), deadbush: s('dead_bush'),
    };
    return S_;
  };

  // ---------------------------------------------------------------------------
  // Column writer: writes blocks only inside its own 16x16 column
  class ColumnWriter {
    constructor(cx, cz, blocks) { this.x0 = cx * 16; this.z0 = cz * 16; this.b = blocks; }
    ok(x, y, z) { const lx = x - this.x0, lz = z - this.z0; return y >= 0 && y < 256 && lx >= 0 && lx < 16 && lz >= 0 && lz < 16; }
    get(x, y, z) { if (!this.ok(x, y, z)) return -1; return this.b[(y << 8) | ((z - this.z0) << 4) | (x - this.x0)]; }
    set(x, y, z, s) { if (this.ok(x, y, z)) this.b[(y << 8) | ((z - this.z0) << 4) | (x - this.x0)] = s; }
    // place if current is air / replaceable (plants, snow layer, leaves when log)
    place(x, y, z, s, mode) {
      if (!this.ok(x, y, z)) return false;
      const i = (y << 8) | ((z - this.z0) << 4) | (x - this.x0);
      const cur = this.b[i];
      if (cur === 0) { this.b[i] = s; return true; }
      const fl = R.T.flags[cur];
      if (mode === 1) { // log: replaces leaves, plants, snow, water
        if ((fl & (VR.F.LEAVES | VR.F.REPLACE | VR.F.PLANT)) || (fl & VR.F.FLUID && fl & VR.F.WATER)) { this.b[i] = s; return true; }
        return false;
      }
      if (mode === 2) { // force except bedrock
        if (cur !== GEN.S().bedrock) { this.b[i] = s; return true; } return false;
      }
      if (fl & VR.F.REPLACE && !(fl & VR.F.FLUID)) { this.b[i] = s; return true; }
      return false;
    }
  }
  GEN.ColumnWriter = ColumnWriter;

  // ---------------------------------------------------------------------------
  // F-NoCrystal: new worlds (vgen ≥ 9) generate no crystal of any kind, large or small (the owner's wish); every crystal
  // source of the generators asks this one gate. A generator made with the option noCrystal (the title panorama: a
  // vgen-5 world that is only looked at) asks it too. Older worlds keep their crystals (and their chunks) exactly.
  GEN.NOCRY_VGEN = 9;
  GEN.noCry = (g) => !!g && ((g.vgen | 0) >= GEN.NOCRY_VGEN || g.noCrystal === true);
  // a natural rock pinnacle where a crystal spire stood: a round needle tapering gently to a blunt top, its outline
  // wobbling a little and stepping out in a ledge now and then (a hash of the cell and o.seed: no draw from the caller's
  // random stream), leaning a few blocks at most, sunk `root` rows into the ground.
  //   o: { h, r (the foot's radius), lean: [dx, dz] of the top, mat(x, y, z, f) → state (f = 0 foot … 1 top),
  //        top: the top row's state (moss, grass) or 0, root (default 2), seed,
  //        keep(state) → true leaves a cell holding that block as it is (a building beside the rock) }
  // rock replaces what is there (w.set; a writer with ok() — a chunk's ColumnWriter — is asked first, so the material is
  // only worked out for the cells of its own chunk); returns the y of the top row.
  // A chunk's ColumnWriter (x0, z0) is visited over its own 16 × 16 columns only: the realm features run for a chunk and
  // its eight neighbours through the chunk's writer, so most passes over a rock miss it — they now cost nothing (the
  // same cells are written: the ones beyond the chunk were refused by ok() anyway; no draw, only hashes of the cell)
  GEN.pinnacle = function (w, x, y, z, o) {
    const H = VR.M.hash2, ok = w.ok ? (px, py, pz) => w.ok(px, py, pz) : null;
    const h = Math.max(2, o.h | 0), r0 = Math.max(0.6, o.r), root = o.root === undefined ? 2 : o.root, seed = o.seed | 0;
    const lx = o.lean ? o.lean[0] : 0, lz = o.lean ? o.lean[1] : 0;
    const clip = !!ok && typeof w.x0 === 'number' && typeof w.z0 === 'number';
    const X0 = clip ? w.x0 : -1e9, X1 = clip ? w.x0 + 15 : 1e9, Z0 = clip ? w.z0 : -1e9, Z1 = clip ? w.z0 + 15 : 1e9;
    // (the whole rock beside the chunk: its widest row is r0 + 0.3, ri one more, the lean at most |lean| out)
    const reach = r0 + 3;
    if (clip && (x + Math.max(0, lx) + reach < X0 || x + Math.min(0, lx) - reach > X1 || z + Math.max(0, lz) + reach < Z0 || z + Math.min(0, lz) - reach > Z1)) return y + h - 1;
    for (let t = -root; t < h; t++) {
      const f = Math.max(0, t) / h;
      const r = r0 * (1 - 0.45 * Math.pow(f, 1.2)) + ((H(t, seed, 0x51) & 3) === 0 ? 0.3 : 0);
      const cx = x + lx * f * f, cz = z + lz * f * f, rx = Math.round(cx), rz = Math.round(cz), ri = Math.ceil(r + 0.5);
      const dx0 = Math.max(-ri, X0 - rx), dx1 = Math.min(ri, X1 - rx), dz0 = Math.max(-ri, Z0 - rz), dz1 = Math.min(ri, Z1 - rz);
      for (let dx = dx0; dx <= dx1; dx++) for (let dz = dz0; dz <= dz1; dz++) {
        const px = rx + dx, pz = rz + dz, ex = px - cx, ez = pz - cz;
        if (ok && !ok(px, y + t, pz)) continue;
        const rr = r + ((H(px * 7 + t, pz * 13 - t, seed) & 255) / 255 - 0.5) * 0.5;
        if (ex * ex + ez * ez > rr * rr) continue;
        if (o.keep) { const cur = w.get(px, y + t, pz); if (cur > 0 && o.keep(cur)) continue; }
        w.set(px, y + t, pz, t === h - 1 && o.top ? o.top : o.mat(px, y + t, pz, f));
      }
    }
    return y + h - 1;
  };

  // ---------------------------------------------------------------------------
  // Tree builders. w: writer, (x,y,z) = base (first log block), rng
  const st = (n, p) => R.S(n, p);
  const leafState = (name) => st(name, { persistent: 0, distance: 1 });
  const logState = (name, axis) => st(name, { axis: axis || 0 });
  GEN.leafState = leafState; GEN.logState = logState;

  function blob(w, x, y, z, rx, ry, rz, s, rng, fuzz) {
    for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) for (let dz = -rz; dz <= rz; dz++) {
      const d = (dx * dx) / (rx * rx + 0.01) + (dy * dy) / (ry * ry + 0.01) + (dz * dz) / (rz * rz + 0.01);
      if (d <= 1 + (fuzz ? (rng.next() - 0.5) * fuzz : 0)) w.place(x + dx, y + dy, z + dz, s);
    }
  }
  GEN.blob = blob;
  function leafLayer(w, x, y, z, r, s, rng, cornerChance) {
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (Math.abs(dx) === r && Math.abs(dz) === r && (r === 0 || rng.next() > (cornerChance || 0))) continue;
      w.place(x + dx, y, z + dz, s);
    }
  }
  function trunk(w, x, y, z, h, s) { for (let i = 0; i < h; i++) w.place(x, y + i, z, s, 1); }
  function ground(w, x, y, z, s) { const g = w.get(x, y - 1, z); if (g >= 0 && g !== s && (R.T.flags[g] & VR.F.SOLID)) w.set(x, y - 1, z, s); }

  const TREES = GEN.TREES = {};
  TREES.oak = function (w, x, y, z, rng, o) {
    o = o || {};
    const h = (o.h || 4) + rng.int(o.hr || 3), log = logState(o.log || 'oak_log'), leaf = leafState(o.leaf || 'oak_leaves');
    ground(w, x, y, z, GEN.S().dirt);
    for (let ly = y + h - 3; ly <= y + h; ly++) {
      const r = ly >= y + h - 1 ? 1 : 2;
      leafLayer(w, x, ly, z, r, leaf, rng, ly >= y + h ? 0 : 0.5);
    }
    trunk(w, x, y, z, h, log);
    if (o.vines) vinesAround(w, x, y + h, z, 3, rng);
    if (o.beeNest && rng.chance(o.beeNest)) w.place(x, y + h - 4, z + 1, st('bee_nest', { facing: 2, honey: 0 }));
  };
  TREES.birch = function (w, x, y, z, rng, o) { TREES.oak(w, x, y, z, rng, Object.assign({ log: 'birch_log', leaf: 'birch_leaves', h: (o && o.tall) ? 9 : 5, hr: (o && o.tall) ? 5 : 3 }, o)); };
  TREES.fancyOak = function (w, x, y, z, rng) {
    const h = 7 + rng.int(6), log = logState('oak_log'), leaf = leafState('oak_leaves');
    ground(w, x, y, z, GEN.S().dirt);
    trunk(w, x, y, z, h, log);
    blob(w, x, y + h, z, 3, 2, 3, leaf, rng, 0.5);
    const branches = 2 + rng.int(3);
    for (let b = 0; b < branches; b++) {
      const a = rng.next() * Math.PI * 2, len = 3 + rng.int(3), by = y + Math.floor(h * 0.5) + rng.int(Math.max(1, h >> 1));
      let bx = x, bz = z, yy = by;
      for (let i = 1; i <= len; i++) {
        bx = Math.round(x + Math.cos(a) * i); bz = Math.round(z + Math.sin(a) * i); yy = by + Math.floor(i * 0.6);
        w.place(bx, yy, bz, logState('oak_log', Math.abs(Math.cos(a)) > 0.7 ? 1 : Math.abs(Math.sin(a)) > 0.7 ? 2 : 0), 1);
      }
      blob(w, bx, yy + 1, bz, 2, 2, 2, leaf, rng, 0.6);
    }
  };
  // the trailer's round park tree: a short trunk under a compact, slightly flattened ball of leaves
  TREES.roundTree = function (w, x, y, z, rng, o) {
    o = o || {};
    const h = (o.h || 3) + rng.int(2), log = logState(o.log || 'oak_log'), leaf = leafState(o.leaf || 'oak_leaves');
    const r = (o.r || 2.6) + rng.next() * 0.6;
    ground(w, x, y, z, GEN.S().dirt);
    trunk(w, x, y, z, h + 1, log);
    blob(w, x, y + h + 1, z, r, r * 0.85, r, leaf, rng, 0.35);
    if (rng.chance(0.5)) w.place(x, y + h + 1 + Math.ceil(r * 0.85), z, leaf);
  };
  TREES.spruce = function (w, x, y, z, rng, o) {
    o = o || {};
    const h = 6 + rng.int(4), log = logState('spruce_log'), leaf = leafState('spruce_leaves');
    ground(w, x, y, z, GEN.S().dirt);
    let r = 0, maxR = 2 + rng.int(2);
    const start = o.pine ? h - 3 : 1 + rng.int(2);
    for (let ly = y + h + 1; ly >= y + start; ly--) {
      leafLayer(w, x, ly, z, r, leaf, rng, 0);
      if (r >= maxR || (r >= 1 && ly % 2 === 0 && rng.chance(0.5))) r = r > 1 ? 1 : r; else r++;
      if (r > maxR) r = maxR;
    }
    w.place(x, y + h + 2, z, leaf);
    trunk(w, x, y, z, h, log);
  };
  TREES.megaSpruce = function (w, x, y, z, rng, o) {
    const h = 15 + rng.int(12), log = logState('spruce_log'), leaf = leafState('spruce_leaves');
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { ground(w, x + dx, y, z + dz, GEN.S().podzol); trunk(w, x + dx, y, z + dz, h, log); }
    const pine = o && o.pine;
    const leafStart = pine ? h - 5 : Math.floor(h * 0.35);
    for (let ly = y + h + 1; ly >= y + leafStart; ly--) {
      const t = (y + h + 1 - ly) / (h + 1 - leafStart);
      let r = Math.round(1 + t * (pine ? 2 : 4));
      if ((ly & 1) && !pine) r = Math.max(1, r - 1);
      for (let dx = -r; dx <= r + 1; dx++) for (let dz = -r; dz <= r + 1; dz++) {
        const ddx = dx <= 0 ? dx : dx - 1, ddz = dz <= 0 ? dz : dz - 1;
        if (ddx * ddx + ddz * ddz <= r * r + 0.5) w.place(x + dx, ly, z + dz, leaf);
      }
    }
  };
  TREES.jungle = function (w, x, y, z, rng, o) {
    const h = 6 + rng.int(6), log = logState('jungle_log'), leaf = leafState('jungle_leaves');
    ground(w, x, y, z, GEN.S().dirt);
    for (let ly = y + h - 2; ly <= y + h + 1; ly++) leafLayer(w, x, ly, z, ly >= y + h ? 1 : 2, leaf, rng, 0.4);
    trunk(w, x, y, z, h, log);
    vinesAround(w, x, y + h, z, 3, rng);
    cocoaOn(w, x, y, z, h, rng);
  };
  TREES.megaJungle = function (w, x, y, z, rng) {
    const h = 16 + rng.int(14), log = logState('jungle_log'), leaf = leafState('jungle_leaves');
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { ground(w, x + dx, y, z + dz, GEN.S().dirt); trunk(w, x + dx, y, z + dz, h, log); }
    blob(w, x, y + h, z, 5, 2, 5, leaf, rng, 0.4);
    const br = 2 + rng.int(3);
    for (let b = 0; b < br; b++) {
      const a = rng.next() * Math.PI * 2, by = y + Math.floor(h * 0.5) + rng.int(h >> 2);
      let bx = x, bz = z;
      for (let i = 1; i <= 4; i++) { bx = Math.round(x + Math.cos(a) * i); bz = Math.round(z + Math.sin(a) * i); w.place(bx, by + (i >> 1), bz, log, 1); }
      blob(w, bx, by + 3, bz, 3, 1, 3, leaf, rng, 0.4);
    }
    for (let i = 0; i < 20; i++) {
      const dx = rng.irange(-1, 2), dz = rng.irange(-1, 2), vy = y + rng.int(h);
      const side = rng.int(4);
      const vx = x + (side === 0 ? -1 : side === 1 ? 2 : dx), vz = z + (side === 2 ? -1 : side === 3 ? 2 : dz);
      const mask = side === 0 ? 2 : side === 1 ? 8 : side === 2 ? 4 : 1;
      for (let k = 0; k < 4 + rng.int(6); k++) w.place(vx, vy - k, vz, st('vines', { faces: mask }));
    }
  };
  // a royal palm (the Admiral-plan driveway palm): a tall smooth grey trunk with a slight lean, a green crownshaft,
  // the crown with coconuts and two rings of long arching fronds. put(x, y, z, name, props) places by block name.
  GEN.palmTree = function (put, x, y, z, h, rng) {
    h = h || 9 + rng.int(4);
    const lean = rng.int(4), leanAt = Math.max(3, h - 3 - rng.int(3)), dx = [0, 1, 0, -1][lean], dz = [-1, 0, 1, 0][lean];
    let cx = x, cz = z;
    for (let k = 0; k < h; k++) {
      if (k === leanAt && rng.chance(0.6)) { cx += dx; cz += dz; }
      put(cx, y + k, cz, k >= h - 2 ? 'vx_palm_shaft' : 'vx_royal_trunk');
    }
    const ty = y + h;
    put(cx, ty, cz, 'vx_palm_crown');
    put(cx + 1, ty, cz, 'vx_palm_frond', { facing: 1 }); put(cx - 1, ty, cz, 'vx_palm_frond', { facing: 3 });
    put(cx, ty, cz + 1, 'vx_palm_frond', { facing: 2 }); put(cx, ty, cz - 1, 'vx_palm_frond', { facing: 0 });
    put(cx + 1, ty - 1, cz, 'vx_palm_frond', { facing: 1 }); put(cx - 1, ty - 1, cz, 'vx_palm_frond', { facing: 3 });
    put(cx, ty - 1, cz + 1, 'vx_palm_frond', { facing: 2 }); put(cx, ty - 1, cz - 1, 'vx_palm_frond', { facing: 0 });
    return [cx, ty, cz];
  };
  TREES.palm = function (w, x, y, z, rng) {
    ground(w, x, y, z, GEN.S().dirt);
    GEN.palmTree((px, py, pz, name, props) => w.place(px, py, pz, st(name, props), 1), x, y, z, 0, rng);
  };
  TREES.acacia = function (w, x, y, z, rng) {
    const log = logState('acacia_log'), leaf = leafState('acacia_leaves');
    ground(w, x, y, z, GEN.S().dirt);
    const h = 5 + rng.int(3), bendAt = h - 1 - rng.int(3), d = rng.int(4);
    const dx = VR.HF_DX[d], dz = VR.HF_DZ[d];
    let cx = x, cz = z, cy = y;
    for (let i = 0; i < h; i++) {
      if (i >= bendAt) { cx += dx; cz += dz; }
      w.place(cx, cy, cz, log, 1); cy++;
    }
    const topY = cy;
    leafLayer(w, cx, topY - 1, cz, 3, leaf, rng, 0); for (const [ax, az] of [[3, 3], [-3, 3], [3, -3], [-3, -3]]) w.set(cx + ax, topY - 1, cz + az, 0);
    leafLayer(w, cx, topY, cz, 1, leaf, rng, 1);
    for (const [ax, az] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) w.place(cx + ax, topY, cz + az, leaf);
    if (rng.chance(0.6)) { // second branch
      const d2 = (d + 2) % 4; let bx = x, bz = z, by = y + bendAt - 1;
      for (let i = 0; i < 3; i++) { bx += VR.HF_DX[d2]; bz += VR.HF_DZ[d2]; by++; w.place(bx, by, bz, log, 1); }
      leafLayer(w, bx, by + 1, bz, 2, leaf, rng, 0); leafLayer(w, bx, by + 2, bz, 1, leaf, rng, 0);
    }
  };
  TREES.darkOak = function (w, x, y, z, rng) {
    const h = 6 + rng.int(3), log = logState('dark_oak_log'), leaf = leafState('dark_oak_leaves');
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { ground(w, x + dx, y, z + dz, GEN.S().dirt); trunk(w, x + dx, y, z + dz, h, log); }
    for (let ly = y + h - 2; ly <= y + h + 1; ly++) {
      const r = ly >= y + h + 1 ? 2 : ly >= y + h ? 3 : 4;
      for (let dx = -r; dx <= r + 1; dx++) for (let dz = -r; dz <= r + 1; dz++) {
        const ex = dx <= 0 ? -dx : dx - 1, ez = dz <= 0 ? -dz : dz - 1;
        if (ex + ez <= r + 1 + (rng.chance(0.3) ? 1 : 0)) w.place(x + dx, ly, z + dz, leaf);
      }
    }
  };
  TREES.paleOak = function (w, x, y, z, rng) {
    const h = 7 + rng.int(4), log = logState('pale_oak_log'), leaf = leafState('pale_oak_leaves');
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { ground(w, x + dx, y, z + dz, GEN.S().dirt); trunk(w, x + dx, y, z + dz, h, log); }
    if (rng.chance(0.25)) w.set(x, y + 2 + rng.int(3), z, st('pale_heart', { axis: 0, awake: 0 }));
    for (let ly = y + h - 3; ly <= y + h + 1; ly++) {
      const r = ly >= y + h + 1 ? 2 : ly >= y + h - 1 ? 4 : 3;
      for (let dx = -r; dx <= r + 1; dx++) for (let dz = -r; dz <= r + 1; dz++) {
        const ex = dx <= 0 ? -dx : dx - 1, ez = dz <= 0 ? -dz : dz - 1;
        if (ex * ex + ez * ez <= r * r + 1 - rng.int(2)) {
          if (w.place(x + dx, ly, z + dz, leaf) && ly === y + h - 3 && rng.chance(0.35)) {
            const len = 1 + rng.int(4);
            for (let k = 1; k <= len; k++) w.place(x + dx, ly - k, z + dz, st('pale_hanging_moss'));
          }
        }
      }
    }
  };
  TREES.cherry = function (w, x, y, z, rng) {
    const log = logState('cherry_log'), leaf = leafState('cherry_leaves');
    ground(w, x, y, z, GEN.S().dirt);
    const h = 4 + rng.int(3);
    trunk(w, x, y, z, h, log);
    const nb = 2 + rng.int(2), tops = [];
    const a0 = rng.next() * Math.PI * 2;
    for (let b = 0; b < nb; b++) {
      const a = a0 + b * (Math.PI * 2 / nb) + (rng.next() - 0.5) * 0.6;
      let bx = x, bz = z, by = y + h - 1;
      const len = 3 + rng.int(3);
      for (let i = 1; i <= len; i++) {
        bx = Math.round(x + Math.cos(a) * i); bz = Math.round(z + Math.sin(a) * i); by = y + h - 1 + Math.round(i * 0.7);
        w.place(bx, by, bz, logState('cherry_log', Math.abs(Math.cos(a)) > 0.7 ? 1 : Math.abs(Math.sin(a)) > 0.7 ? 2 : 0), 1);
      }
      tops.push([bx, by, bz]);
    }
    for (const [bx, by, bz] of tops) {
      blob(w, bx, by + 2, bz, 4, 2, 4, leaf, rng, 0.3);
      for (let i = 0; i < 10; i++) { // drooping edges
        const a = rng.next() * Math.PI * 2, rr = 3 + rng.int(2);
        const px = Math.round(bx + Math.cos(a) * rr), pz = Math.round(bz + Math.sin(a) * rr);
        w.place(px, by + 1, pz, leaf); if (rng.chance(0.5)) w.place(px, by, pz, leaf);
      }
    }
  };
  TREES.mangrove = function (w, x, y, z, rng) {
    const log = logState('mangrove_log'), leaf = leafState('mangrove_leaves'), roots = st('mangrove_roots');
    const lift = 2 + rng.int(3), h = 6 + rng.int(5);
    // prop roots
    for (let r = 0; r < 4 + rng.int(3); r++) {
      const a = rng.next() * Math.PI * 2;
      for (let i = 0; i <= 3; i++) {
        const rx = Math.round(x + Math.cos(a) * i), rz = Math.round(z + Math.sin(a) * i), ry = y + lift - i;
        for (let d = 0; d < 6 && ry - d >= 0; d++) { const g = w.get(rx, ry - d, rz); if (g > 0 && (R.T.flags[g] & VR.F.SOLID) && !(R.T.flags[g] & VR.F.LEAVES)) { if (g === GEN.S().mud) w.set(rx, ry - d, rz, st('muddy_mangrove_roots', { axis: 0 })); break; } if (d === 0 || i === 3) w.place(rx, ry - d, rz, roots, 1); else if (i < 3) break; }
      }
    }
    trunk(w, x, y + lift, z, h, log);
    for (let ly = y + lift + h - 3; ly <= y + lift + h + 1; ly++) {
      const r = ly >= y + lift + h ? 2 : 3;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (dx * dx + dz * dz <= r * r + 1 && rng.chance(0.9)) {
        if (w.place(x + dx, ly, z + dz, leaf) && ly === y + lift + h - 3 && rng.chance(0.12)) w.place(x + dx, ly - 1, z + dz, st('mangrove_propagule'));
      }
    }
    vinesAround(w, x, y + lift + h, z, 3, rng);
  };
  TREES.poplar = function (w, x, y, z, rng, o) {
    const log = logState('poplar_log');
    const colors = ['yellow_poplar_leaves', 'orange_poplar_leaves', 'red_poplar_leaves'];
    const leaf = leafState(colors[(o && o.color !== undefined) ? o.color : rng.int(3)]);
    ground(w, x, y, z, GEN.S().dirt);
    const h = 9 + rng.int(6);
    trunk(w, x, y, z, h, log);
    for (let ly = y + 3; ly <= y + h + 2; ly++) {
      const t = (ly - (y + 3)) / (h - 1);
      const r = t < 0.15 ? 1 : t > 0.85 ? (ly >= y + h + 2 ? 0 : 1) : 2;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) === r && Math.abs(dz) === r && r > 0) continue;
        if (r === 2 && (Math.abs(dx) + Math.abs(dz) === 3) && rng.chance(0.5)) continue;
        w.place(x + dx, ly, z + dz, leaf);
      }
    }
    // shelf mushrooms on the trunk
    for (let i = 0; i < 2; i++) if (rng.chance(0.6)) {
      const f = rng.int(4); const my = y + 1 + rng.int(2);
      w.place(x + VR.HF_DX[f], my, z + VR.HF_DZ[f], st('shelf_mushroom', { facing: (f + 2) % 4, size: rng.int(2) }));
    }
  };
  TREES.fallenLog = function (w, x, y, z, rng, logName) {
    const d = rng.int(2), len = 4 + rng.int(4);
    const log = logState(logName || 'poplar_log', d ? 1 : 2);
    for (let i = 0; i < len; i++) {
      const lx = x + (d ? i : 0), lz = z + (d ? 0 : i);
      const g = w.get(lx, y - 1, lz);
      if (g >= 0 && !(R.T.flags[g] & VR.F.SOLID)) continue;
      w.place(lx, y, lz, log, 1);
      if (rng.chance(0.3)) w.place(lx, y + 1, lz, st(rng.chance(0.5) ? 'moss_carpet' : 'brown_mushroom'));
    }
  };
  TREES.azalea = function (w, x, y, z, rng) {
    const log = logState('oak_log'), leaves = [leafState('azalea_leaves'), leafState('flowering_azalea_leaves')];
    w.set(x, y - 1, z, st('rooted_dirt'));
    const h = 4 + rng.int(2);
    let cx = x, cz = z;
    for (let i = 0; i < h; i++) { if (i === 2 && rng.chance(0.5)) { cx += rng.irange(-1, 1); cz += rng.irange(-1, 1); } w.place(cx, y + i, cz, log, 1); }
    for (let ly = y + h - 2; ly <= y + h + 1; ly++) {
      const r = ly === y + h + 1 ? 1 : 2;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (!(Math.abs(dx) === r && Math.abs(dz) === r && rng.chance(0.6))) w.place(cx + dx, ly, cz + dz, leaves[rng.chance(0.3) ? 1 : 0]);
    }
    for (let d = 2; d < 6; d++) { const g = w.get(x, y - d, z); if (g === GEN.S().stone || g === GEN.S().deep) w.set(x, y - d, z, st('rooted_dirt')); else if (g === 0) { w.place(x, y - d, z, st('hanging_roots')); break; } else break; }
  };
  TREES.hugeMushroom = function (w, x, y, z, rng, red) {
    const stem = st('mushroom_stem'), cap = st(red ? 'red_mushroom_block' : 'brown_mushroom_block');
    const h = 5 + rng.int(3);
    for (let i = 0; i < h; i++) w.place(x, y + i, z, stem, 1);
    if (red) {
      for (let ly = y + h - 3; ly <= y + h; ly++) {
        const r = ly === y + h ? 1 : 2;
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (ly < y + h && Math.abs(dx) < r && Math.abs(dz) < r) continue;
          if (Math.abs(dx) === r && Math.abs(dz) === r) continue;
          w.place(x + dx, ly, z + dz, cap);
        }
      }
    } else {
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) if (!(Math.abs(dx) === 3 && Math.abs(dz) === 3)) w.place(x + dx, y + h, z + dz, cap);
    }
  };
  TREES.hugeFungus = function (w, x, y, z, rng, kind) {
    const crimson = kind === 'crimson';
    const stalk = logState(crimson ? 'crimson_stalk' : 'teal_stalk'), wart = st(crimson ? 'crimson_wart_block' : 'teal_wart_block'), light = st('lumishroom');
    const h = 5 + rng.int(9);
    trunk(w, x, y, z, h, stalk);
    for (let ly = y + h - 3; ly <= y + h; ly++) {
      const r = ly >= y + h ? 1 : ly >= y + h - 1 ? 2 : 3;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.abs(dx) === r && Math.abs(dz) === r && rng.chance(0.7)) continue;
        if (ly < y + h - 1 && Math.abs(dx) < r && Math.abs(dz) < r) continue;
        w.place(x + dx, ly, z + dz, rng.chance(0.08) ? light : wart);
        if (crimson && ly === y + h - 3 && rng.chance(0.2)) { const len = 1 + rng.int(4); for (let k = 1; k <= len; k++) w.place(x + dx, ly - k, z + dz, st('weeping_vines', { tip: k === len ? 1 : 0 })); }
      }
    }
  };
  function vinesAround(w, x, y, z, r, rng) {
    for (let i = 0; i < 12; i++) {
      const side = rng.int(4), off = rng.irange(-r, r);
      const vx = x + (side === 0 ? -r - 1 : side === 1 ? r + 1 : off), vz = z + (side === 2 ? -r - 1 : side === 3 ? r + 1 : off);
      const mask = side === 0 ? 2 : side === 1 ? 8 : side === 2 ? 4 : 1;
      const top = y - rng.int(2);
      const adjX = vx + (side === 0 ? 1 : side === 1 ? -1 : 0), adjZ = vz + (side === 2 ? 1 : side === 3 ? -1 : 0);
      const adj = w.get(adjX, top, adjZ);
      if (adj <= 0 || !(R.T.flags[adj] & VR.F.LEAVES)) continue;
      for (let k = 0; k < 2 + rng.int(5); k++) if (!w.place(vx, top - k, vz, st('vines', { faces: mask }))) break;
    }
  }
  GEN.vinesAround = vinesAround;
  function cocoaOn(w, x, y, z, h, rng) {
    for (let i = 0; i < 3; i++) if (rng.chance(0.3)) {
      const f = rng.int(4), cy = y + 2 + rng.int(Math.max(1, h - 4));
      w.place(x - VR.HF_DX[f], cy, z - VR.HF_DZ[f], st('cocoa', { facing: f, age: rng.int(3) }));
    }
  }
  TREES.bush = function (w, x, y, z, rng, logN, leafN) {
    w.place(x, y, z, logState(logN || 'jungle_log'), 1);
    blob(w, x, y + 1, z, 2, 1, 2, leafState(leafN || 'oak_leaves'), rng, 0.8);
  };
  TREES.spike = function (w, x, y, z, rng) { // ice spike
    const tall = rng.chance(0.08), h = tall ? 30 + rng.int(25) : 8 + rng.int(10), r = tall ? 2 : 1 + rng.int(2);
    const p = GEN.S().packed;
    for (let i = 0; i < h; i++) {
      const rr = Math.max(0, Math.round(r * (1 - i / h) + 0.3));
      for (let dx = -rr; dx <= rr; dx++) for (let dz = -rr; dz <= rr; dz++) if (dx * dx + dz * dz <= rr * rr + 0.5) w.place(x + dx, y + i, z + dz, p, 1);
    }
  };
  TREES.boulder = function (w, x, y, z, rng, s) { blob(w, x, y, z, 1 + rng.int(2), 1 + rng.int(2), 1 + rng.int(2), s || GEN.S().mossycobble, rng, 0.6); };

  // ---------------------------------------------------------------------------
  // Structures (small, ≤ 16 blocks across) ------------------------------------
  const STRUCT = GEN.STRUCT = {};
  STRUCT.dungeon = function (w, x, y, z, rng, chestList) {
    const rx = 3 + rng.int(2), rz = 3 + rng.int(2);
    const cob = GEN.S().cobble, mossy = GEN.S().mossycobble;
    for (let dx = -rx - 1; dx <= rx + 1; dx++) for (let dz = -rz - 1; dz <= rz + 1; dz++) for (let dy = -1; dy <= 4; dy++) {
      const edge = dx === -rx - 1 || dx === rx + 1 || dz === -rz - 1 || dz === rz + 1 || dy === -1 || dy === 4;
      if (edge) { const cur = w.get(x + dx, y + dy, z + dz); if (cur > 0 && (R.T.flags[cur] & VR.F.SOLID)) w.set(x + dx, y + dy, z + dz, dy === -1 && rng.chance(0.7) ? mossy : cob); }
      else w.set(x + dx, y + dy, z + dz, 0);
    }
    w.set(x, y, z, st('monster_cage', { mob: rng.int(4) }));
    const cx = x + (rng.chance(0.5) ? rx : -rx), cz = z + rng.irange(-rz + 1, rz - 1);
    if (w.ok(cx, y, cz)) { w.set(cx, y, cz, st('chest', { facing: rng.int(4) })); if (chestList) chestList.push([cx, y, cz, 'dungeon']); }
  };
  STRUCT.well = function (w, x, y, z, rng) {
    const ss = GEN.S().sandstone, slab = st('sandstone_slab', { type: 0 }), water = GEN.S().water;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { w.set(x + dx, y - 1, z + dz, ss); w.set(x + dx, y, z + dz, (Math.abs(dx) === 2 || Math.abs(dz) === 2) ? slab : ss); }
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (dx === 0 || dz === 0) { w.set(x + dx, y, z + dz, water); w.set(x + dx, y - 1, z + dz, water); w.set(x + dx, y - 2, z + dz, ss); }
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (dx !== 0 && dz !== 0) { w.set(x + dx, y + 1, z + dz, ss); w.set(x + dx, y + 2, z + dz, ss); }
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) w.set(x + dx, y + 3, z + dz, dx === 0 && dz === 0 ? ss : slab);
    w.set(x, y + 1, z, 0);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (dx === 0 || dz === 0) w.set(x + dx, y + 1, z + dz, 0);
  };
  STRUCT.ruinedGate = function (w, x, y, z, rng, chestList) {
    const ob = GEN.S().obsidian, cry = st('weeping_obsidian'), mag = GEN.S().magma, sb = st('stone_bricks'), msb = st('mossy_stone_bricks');
    const axis = rng.int(2), W = 4, H = 5;
    for (let i = -2; i <= W + 1; i++) for (let j = -2; j <= 2; j++) {
      const px = x + (axis ? j : i), pz = z + (axis ? i : j);
      if (rng.chance(0.7)) w.set(px, y - 1, pz, rng.chance(0.5) ? sb : (rng.chance(0.5) ? msb : GEN.S().gravel));
      if (rng.chance(0.08)) w.set(px, y - 1, pz, mag);
    }
    for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) {
      const frame = i === 0 || i === W - 1 || j === 0 || j === H - 1;
      if (!frame) continue;
      if (rng.chance(0.25)) continue;
      const px = x + (axis ? 0 : i), pz = z + (axis ? i : 0);
      w.set(px, y + j, pz, rng.chance(0.18) ? cry : ob);
    }
    const cx = x + (axis ? 2 : -2), cz = z + (axis ? -2 : 2);
    if (w.ok(cx, y, cz)) { w.set(cx, y, cz, st('chest', { facing: 2 })); if (chestList) chestList.push([cx, y, cz, 'ruin']); }
  };
  STRUCT.camp = function (w, x, y, z, rng, chestList) {
    // abandoned camp (dappled forest): campfire (unlit), logs as seats, straw bed, barrel
    w.set(x, y, z, st('campfire', { facing: 0, lit: 0 }));
    for (const [dx, dz, ax] of [[2, 0, 2], [-2, 0, 2], [0, 2, 1], [0, -2, 1]]) if (rng.chance(0.75)) w.place(x + dx, y, z + dz, logState('stripped_poplar_log', ax), 1);
    w.place(x + 3, y, z + 2, st('straw_bed', { facing: 0, part: 0 })); w.place(x + 3, y, z + 1, st('straw_bed', { facing: 0, part: 1 }));
    if (w.ok(x - 3, y, z - 2)) { w.set(x - 3, y, z - 2, st('barrel', { facing: 4, open: 0 })); if (chestList) chestList.push([x - 3, y, z - 2, 'camp']); }
    for (let i = 0; i < 6; i++) { const dx = rng.irange(-4, 4), dz = rng.irange(-4, 4); if (w.get(x + dx, y, z + dz) === 0) w.place(x + dx, y, z + dz, st('leaf_litter', { count: rng.int(4), facing: rng.int(4) })); }
  };
  STRUCT.tower = function (w, x, y, z, rng, chestList) {
    const sb = st('stone_bricks'), msb = st('mossy_stone_bricks'), csb = st('cracked_stone_bricks');
    const h = 8 + rng.int(6), broken = rng.int(3);
    for (let dy = -1; dy < h; dy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const wall = Math.abs(dx) === 2 || Math.abs(dz) === 2;
      if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
      if (dy === -1) { w.set(x + dx, y + dy, z + dz, sb); continue; }
      if (!wall) { w.set(x + dx, y + dy, z + dz, 0); continue; }
      if (dy > h - 3 - broken && rng.chance(0.4)) continue;
      if (dy === 0 && dx === 0 && dz === 2) continue; if (dy === 1 && dx === 0 && dz === 2) continue;
      w.set(x + dx, y + dy, z + dz, rng.chance(0.25) ? msb : rng.chance(0.15) ? csb : sb);
    }
    for (let dy = 0; dy < h - 2; dy++) w.set(x - 1, y + dy, z - 1, st('ladder', { facing: 2 }));
    w.set(x + 1, y + h - 4, z + 1, st('lantern', { hanging: 0 }));
    if (w.ok(x + 1, y, z - 1)) { w.set(x + 1, y, z - 1, st('chest', { facing: 2 })); if (chestList) chestList.push([x + 1, y, z - 1, 'tower']); }
  };
  // noCry (a vgen-9 world): the same hollow with the same draws, a dripstone pocket instead of an amethyst geode — a
  // dripstone lining in the calcite and basalt shells, stalagmites on its floor and stalactites from its ceiling where
  // the buds and clusters grew (nothing on its walls)
  STRUCT.geode = function (w, x, y, z, rng, noCry) {
    const r = 4 + rng.int(2);
    const bas = GEN.S().smoothbasalt, cal = GEN.S().calcite, am = noCry ? GEN.S().dripblock : st('amethyst_block'), bud = noCry ? am : st('budding_amethyst');
    for (let dx = -r - 2; dx <= r + 2; dx++) for (let dy = -r - 2; dy <= r + 2; dy++) for (let dz = -r - 2; dz <= r + 2; dz++) {
      const d = Math.sqrt(dx * dx + dy * dy * 1.2 + dz * dz) + (rng.next() - 0.5) * 0.6;
      const cur = w.get(x + dx, y + dy, z + dz); if (cur < 0 || cur === GEN.S().bedrock) continue;
      if (d > r + 2) continue;
      if (d > r + 1) w.set(x + dx, y + dy, z + dz, bas);
      else if (d > r) w.set(x + dx, y + dy, z + dz, cal);
      else if (d > r - 1) w.set(x + dx, y + dy, z + dz, rng.chance(0.1) ? bud : am);
      else w.set(x + dx, y + dy, z + dz, 0);
    }
    // crystals on inner surface (noCry: dripstone on its floor and ceiling)
    for (let i = 0; i < 40; i++) {
      const a = rng.next() * Math.PI * 2, b = Math.acos(2 * rng.next() - 1);
      const px = Math.round(x + Math.cos(a) * Math.sin(b) * (r - 1.5)), py = Math.round(y + Math.cos(b) * (r - 1.5)), pz = Math.round(z + Math.sin(a) * Math.sin(b) * (r - 1.5));
      if (w.get(px, py, pz) !== 0) continue;
      for (let f = 0; f < 6; f++) {
        const nx = px - VR.DX[f], ny = py - VR.DY[f], nz = pz - VR.DZ[f];
        const g = w.get(nx, ny, nz);
        if (g === am || g === bud) {
          const fac = [1, 3, 4, 5, 2, 0][f], k = rng.int(4);
          if (!noCry) w.set(px, py, pz, st(['small_amethyst_bud', 'medium_amethyst_bud', 'large_amethyst_bud', 'amethyst_cluster'][k], { facing: fac }));
          else if (fac === 4 || fac === 5) w.set(px, py, pz, st('pointed_dripstone', { dir: fac === 4 ? 0 : 1 }));
          break;
        }
      }
    }
  };
  STRUCT.sulfurSpring = function (w, x, y, z, rng) {
    const sul = GEN.S().sulfur, cin = GEN.S().cinnabar, water = GEN.S().water, fum = GEN.S().fuming, mag = GEN.S().magma, tuff = GEN.S().tuff;
    const r = 3 + rng.int(3);
    for (let dx = -r - 2; dx <= r + 2; dx++) for (let dz = -r - 2; dz <= r + 2; dz++) {
      const d = Math.sqrt(dx * dx + dz * dz) + (rng.next() - 0.5);
      if (d > r + 2) continue;
      for (let dy = -3; dy <= 0; dy++) {
        const px = x + dx, py = y + dy, pz = z + dz;
        if (d <= r && dy >= -1) w.set(px, py, pz, dy === 0 ? 0 : water);
        else if (d <= r && dy === -2) w.set(px, py, pz, rng.chance(0.3) ? fum : sul);
        else if (dy <= 0) { const cur = w.get(px, py, pz); if (cur > 0 && (R.T.flags[cur] & VR.F.SOLID)) w.set(px, py, pz, rng.chance(0.5) ? sul : rng.chance(0.5) ? cin : tuff); }
      }
      if (d > r && d <= r + 1.5) for (let dy = 1; dy <= 3; dy++) if (w.get(x + dx, y + dy, z + dz) === 0 && rng.chance(0.15)) { w.set(x + dx, y + dy - 1, z + dz, sul); break; }
    }
    w.set(x, y - 3, z, mag); w.set(x, y - 2, z, fum);
  };
})(VR);
