// ============================================================================
// Voxel Architecture ("VX"): context-aware mini-voxel building blocks.
// Every VX block is an 8x8x8 voxel sculpture painted procedurally from its
// type, its neighbours (walls meet roofs, windows stack & merge, shutters hang
// beside windows, door jambs, fences connect, rugs join into one big rug…) and
// a few bits of its world position (brick bonds, timber braces, shingle
// courses). The chunk mesher greedily meshes the voxels with baked AO straight
// into the terrain vertex stream (flat colour tint on a bevelled "voxel tile"
// texture), so VX buildings get real lighting, shadows, fog and collision and
// can be mined & placed like any other block.
// ============================================================================
(function (VR) {
  'use strict';
  const VX = VR.VX = {};
  const N = 8, N3 = 512;
  const PRESENT = 1 << 24, EMIS = 1 << 25, GLASS = 1 << 26, GLOSS = 1 << 27, HOLO = 1 << 28;
  VX.PRESENT = PRESENT; VX.EMIS = EMIS; VX.GLASS = GLASS; VX.GLOSS = GLOSS; VX.HOLO = HOLO;
  // extension points (voxtech.js): extra context bits, boxes, icon poses and block definitions per kind
  VX.ctxHook = {}; VX.boxHook = {}; VX.iconHook = {}; VX.defineExtra = []; VX.floorPat = {};
  // neighbour classes
  const AIR = 0, SOLID = 1, WALL = 2, WIN = 3, ROOF = 4, FLOOR = 5, DOOR = 6, OTHER = 7;
  VX.CLS = { AIR, SOLID, WALL, WIN, ROOF, FLOOR, DOOR, OTHER };
  // face directions (same as the mesher): 0 +x, 1 -x, 2 +y, 3 -y, 4 +z, 5 -z
  const NX = [1, -1, 0, 0, 0, 0], NY = [0, 0, 1, -1, 0, 0], NZ = [0, 0, 0, 0, 1, -1];
  const OPP = [1, 0, 3, 2, 5, 4];
  // FACING4 (north,east,south,west) → face dir
  const F4D = [5, 0, 4, 1];

  // ---------------------------------------------------------------- colours
  const sh = (c, k) => { const r = Math.min(255, ((c >> 16) & 255) * k) | 0, g = Math.min(255, ((c >> 8) & 255) * k) | 0, b = Math.min(255, (c & 255) * k) | 0; return (r << 16) | (g << 8) | b; };
  const mix = (a, b, t) => { const f = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); return (f(16) << 16) | (f(8) << 8) | f(0); };
  VX.sh = sh; VX.mix = mix;
  const hh = (a, b, c, s) => { let h = (a * 374761393 + b * 668265263 + c * 1274126177 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return h >>> 0; };
  VX.hash = hh;
  const C = VX.COL = {
    oak: 0xB5854B, oakD: 0x8A5E32, spruce: 0x6E4B2F, dark: 0x4A3222, birch: 0xD8C49A, cherry: 0xD99A94, acacia: 0xC0643A,
    stone: 0x9A9892, stoneD: 0x77756F, mortar: 0x6A6862, iron: 0x3A3D44, brass: 0xC89A3A, white: 0xF4F2EC, cream: 0xEEDDB8,
    glass: 0xBFE6FF, warm: 0xFFD27A, fire: 0xFF8A2A, soil: 0x5A3E28, leaf: 0x5FA83A, leafD: 0x3F7F2A,
    orange: 0xFF7A1A, blue: 0x2A7AE0, cyan: 0x3AF0FF, violet: 0xB070FF, hull: 0xE8ECF0, hullD: 0x3A3F48,
  };
  const PLASTER = VX.PLASTER = { white: 0xF1ECE0, cream: 0xEEDDB8, peach: 0xF3BF9A, mint: 0xB5E2C4, sky: 0xB3D6EE, butter: 0xF4E09A, lavender: 0xCDBCEB, rose: 0xEFB3B8 };
  const PAINT = VX.PAINT = { red: 0xB5423A, yellow: 0xE7B84A, blue: 0x4F7FB8, green: 0x5E9A6A, white: 0xEDEDE6, teal: 0x3E9C98 };
  const ROOFC = VX.ROOFC = { red: 0xB0453A, terracotta: 0xC8693F, slate: 0x4F5663, blue: 0x3F63A8, teal: 0x2F8C8A, green: 0x4E7F46, violet: 0x7A55C8, thatch: 0xD2B060, shingle: 0x8E6A45, white: 0xE2E7EE, gold: 0xE0A83A, pink: 0xE58FB0 };
  const FLOWERS = [0xE8403A, 0xF6D23A, 0xF08FB0, 0x5A7AF0, 0xFFFFFF, 0xB070FF, 0xFF8A2A];

  // ---------------------------------------------------------------- grid & painting helpers
  const G = new Uint32Array(N3);
  const I = (x, y, z) => (y * N + z) * N + x;
  VX.I = I;
  // VX16: a second, twice-as-fine grid for model pieces (voxmodel.js); quads are in 1/16-block units either way
  const G16 = new Uint32Array(4096);
  const I16 = (x, y, z) => (y * 16 + z) * 16 + x;
  const G32 = new Uint32Array(32768);
  const I32 = (x, y, z) => (y * 32 + z) * 32 + x;
  VX.G16 = G16; VX.I16 = I16; VX.G32 = G32; VX.I32 = I32; VX.G = G;
  VX.gridFor = (res) => res === 32 ? G32 : res === 16 ? G16 : G;
  VX.QU = 32;   // quad positions are in 1/32-block units
  // material bits 29..31 of a voxel pick a surface texture (fabric, leather, wood, marble, metal, plant, stone)
  VX.MAT = { none: 0, fabric: 1, leather: 2, wood: 3, marble: 4, metal: 5, plant: 6, stone: 7 };
  VX.matBit = (m) => (m & 7) << 29;
  function put(x, y, z, c, f) { if (x < 0 || y < 0 || z < 0 || x > 7 || y > 7 || z > 7) return; G[I(x, y, z)] = ((c & 0xffffff) | PRESENT | (f || 0)) >>> 0; }
  function del(x, y, z) { if (x < 0 || y < 0 || z < 0 || x > 7 || y > 7 || z > 7) return; G[I(x, y, z)] = 0; }
  function get(x, y, z) { if (x < 0 || y < 0 || z < 0 || x > 7 || y > 7 || z > 7) return 0; return G[I(x, y, z)]; }
  function box(x0, y0, z0, x1, y1, z1, c, f) {
    for (let y = Math.max(0, y0); y <= Math.min(7, y1); y++) for (let z = Math.max(0, z0); z <= Math.min(7, z1); z++) for (let x = Math.max(0, x0); x <= Math.min(7, x1); x++) {
      const cc = typeof c === 'function' ? c(x, y, z) : c;
      if (cc === null || cc === undefined) G[I(x, y, z)] = 0; else G[I(x, y, z)] = ((cc & 0xffffff) | PRESENT | (f || 0)) >>> 0;
    }
  }
  function clearBox(x0, y0, z0, x1, y1, z1) { box(x0, y0, z0, x1, y1, z1, null); }
  // face-local addressing: (u along the face plane's horizontal world axis, v up, depth into the block)
  function fx(d, u, v, dp) {
    switch (d) {
      case 0: return [7 - dp, v, u]; case 1: return [dp, v, u];
      case 4: return [u, v, 7 - dp]; case 5: return [u, v, dp];
      case 2: return [u, 7 - dp, v]; default: return [u, dp, v];
    }
  }
  function fput(d, u, v, dp, c, f) { const p = fx(d, u, v, dp); put(p[0], p[1], p[2], c, f); }
  function fdel(d, u, v, dp) { const p = fx(d, u, v, dp); del(p[0], p[1], p[2]); }
  function fget(d, u, v, dp) { const p = fx(d, u, v, dp); return get(p[0], p[1], p[2]); }
  // rotate a facing-local design: paint in "north-facing" local coords (front = -z) then rotate
  function rotateGrid(q) {
    q = ((q % 4) + 4) % 4;
    if (!q) return;
    const tmp = G.slice();
    for (let y = 0; y < 8; y++) for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
      let nx = x, nz = z;
      for (let r = 0; r < q; r++) { const t = nx; nx = 7 - nz; nz = t; }
      G[I(nx, y, nz)] = tmp[I(x, y, z)];
    }
  }
  // in-plane horizontal neighbour faces of a vertical face d: [minus side face, plus side face]
  const SIDE = { 0: [5, 4], 1: [5, 4], 4: [1, 0], 5: [1, 0] };
  const HFACES = [0, 1, 4, 5];

  // ---------------------------------------------------------------- material patterns (walls)
  // pattern(u, v, C, d) sets P0 (colour at depth 0 or -1 = carved) and P1 (colour at depth 1)
  let P0 = 0, P1 = 0, PF0 = 0, PF1 = 0;
  const PAT = {};
  PAT.plaster = (s, u, v, c) => { P0 = -1; P1 = sh(s.col, 0.985 + ((c.h & 1) ? 0.03 : 0)); };
  PAT.timber = (s, u, v, c, d) => {
    // posts every two blocks, rails at the block top, a diagonal brace across each two-block panel
    const along = (d === 0 || d === 1) ? c.pz : c.px;
    const U = along * 8 + u, V = c.py * 8 + v;
    const flip = ((c.px + c.pz) & 1) ^ (c.py & 1);
    let beam = (U === 0) || (v === 0 && c.py === 0);
    const dv = flip ? (15 - U) : U;
    if (Math.abs(dv - V) <= 0 && U > 0 && U < 15) beam = true;
    P0 = beam ? s.col2 : -1; P1 = s.col;
  };
  PAT.siding = (s, u, v, c) => { const row = v >> 1; const k = 0.96 + ((hh(row, c.py, c.h, 5) & 3) * 0.02); P0 = (v & 1) ? sh(s.col, k) : -1; P1 = sh(s.col, k * 0.84); };
  PAT.logs = (s, u, v, c) => { const lo = (v & 1) === 0; P0 = lo ? -1 : sh(s.col, 0.95 + ((hh(v >> 1, c.py, c.h, 3) & 3) * 0.03)); P1 = sh(s.col, lo ? 0.72 : 0.9); };
  PAT.planks = (s, u, v, c, d) => { const along = (d === 0 || d === 1) ? c.pz : c.px; const bd = (along * 8 + u) >> 1; const k = 0.93 + (hh(bd, c.py, c.h, 7) & 3) * 0.035; P0 = (u & 1) === 1 && (hh(bd, v >> 2, 1, 9) & 7) === 0 ? -1 : sh(s.col, k); P1 = sh(s.col, 0.7); };
  PAT.batten = (s, u, v, c) => { P0 = (u & 3) === 0 ? sh(s.col, 0.8) : -1; P1 = sh(s.col, (u & 3) === 2 ? 1.04 : 0.96); };
  PAT.bricks = (s, u, v, c, d) => {
    const along = (d === 0 || d === 1) ? c.pz : c.px;
    const row = v >> 1, off = (row & 1) * 2;
    const U = along * 8 + u + off;
    const mortar = (v & 1) === 1 || (U & 3) === 3;
    const k = 0.9 + (hh(U >> 2, row + c.py * 4, c.h, 11) % 5) * 0.045;
    if (mortar) { P0 = s.flushMortar ? s.col2 : -1; P1 = s.col2; }
    else { P0 = sh(s.col, k); P1 = sh(s.col, k * 0.85); }
  };
  PAT.fieldstone = (s, u, v, c, d) => {
    // tiny voronoi of 4 stones per block face
    const along = (d === 0 || d === 1) ? c.pz : c.px;
    let best = 99, second = 99, id = 0;
    for (let k = 0; k < 5; k++) {
      const hs = hh(k, along + c.h * 2, c.py + d * 3, 21);
      const sx = (hs & 7) + 0.5, sy = ((hs >> 3) & 7) + 0.5;
      const dd = (u + 0.5 - sx) ** 2 * 0.7 + (v + 0.5 - sy) ** 2;
      if (dd < best) { second = best; best = dd; id = hs; } else if (dd < second) second = dd;
    }
    const edge = Math.sqrt(second) - Math.sqrt(best) < 0.85 || u === 0 || v === 0;
    const k = 0.82 + ((id >> 8) % 7) * 0.05;
    if (edge) { P0 = -1; P1 = s.col2; } else { P0 = sh(mix(s.col, (id >> 12) & 1 ? 0x8A8070 : s.col, 0.3), k); P1 = sh(s.col, k * 0.8); }
  };
  PAT.sandstone = (s, u, v, c) => { const line = v === 3 || v === 7; P0 = line ? -1 : sh(s.col, v < 3 ? 1.0 : 0.97); P1 = sh(s.col, 0.82); };
  PAT.adobe = (s, u, v, c) => { P0 = -1; P1 = sh(s.col, 0.98 + (c.h & 1) * 0.03); };
  PAT.hull = (s, u, v, c) => {
    const seam = u === 0 || v === 0;
    const stripe = s.stripe && ((c.py + (c.h >> 1)) & 3) === 1 && (v === 3 || v === 4);
    if (seam) { P0 = -1; P1 = s.col2; PF1 = s.glowSeam ? EMIS : 0; }
    else { P0 = stripe ? (((c.h & 1) ? C.blue : C.orange)) : sh(s.col, 1 - ((u + v) & 1) * 0.0); PF0 = GLOSS; P1 = s.col; }
    if (!seam && s.lights && u === 6 && v === 6 && (c.h & 3) === 0) { P0 = s.lightCol || C.cyan; PF0 = EMIS; }
  };
  PAT.crystal = (s, u, v, c) => {
    const seam = u === 0 || v === 0;
    if (seam) { P0 = -1; P1 = C.violet; PF1 = EMIS; }
    else { P0 = sh(s.col, 1 - (((u >> 1) + (v >> 1)) & 1) * 0.025); PF0 = GLOSS; P1 = s.col; }
  };
  VX.PAT = PAT;

  // ---------------------------------------------------------------- painters per kind
  const PAINT_FN = {};
  // exposed if the neighbour lets light/sight through or is a partial block
  const exposed = (c, d) => { const n = c.nc[d]; return n === AIR || n === OTHER || n === DOOR || n === ROOF; };

  // WALL --------------------------------------------------------------------
  PAINT_FN.wall = function (s, c) {
    G.fill(0);
    box(0, 0, 0, 7, 7, 7, sh(s.col, 0.9));
    const pat = PAT[s.pat] || PAT.plaster;
    const aboveOpen = !(c.nc[2] === WALL || c.nc[2] === WIN);
    const onGround = c.nc[3] === SOLID || c.nc[3] === FLOOR;
    const overDoor = c.nc[3] === DOOR;
    const inner = s.inner || INNER[s.pat] || s.col;
    void inner;
    for (const d of HFACES) {
      if (!exposed(c, d)) continue;
      if (!((c.ext >> d) & 1) && !s.bothSides) {
        // interior side: smooth finish with a wooden wainscot (cheap to mesh, cosy to look at)
        const wood = s.wainscot || 0x9A6E44;
        for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
          let col = inner;
          if (s.wains !== false && onGround) col = v <= 1 ? wood : v === 2 ? sh(wood, 1.15) : inner;
          fput(d, u, v, 0, col);
        }
        continue;
      }
      for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
        PF0 = 0; PF1 = 0;
        pat(s, u, v, c, d);
        let c0 = P0, f0 = PF0;
        const c1 = P1, f1 = PF1;
        // wall-top band (a beam under the eaves) and a stone plinth at the base
        if (s.band && aboveOpen && v >= 7) { c0 = s.trim; f0 = 0; }
        if (s.plinth && onGround && v <= 1) { c0 = v === 1 ? sh(s.plinth, 1.05) : s.plinth; f0 = 0; }
        if (overDoor && v <= 1) { c0 = s.lintel || s.trim || C.dark; f0 = 0; }
        if (c0 < 0) fdel(d, u, v, 0); else fput(d, u, v, 0, c0, f0);
        fput(d, u, v, 1, c1, f1);
      }
      // jambs beside doors, shutters beside windows (exterior side only)
      const sides = SIDE[d];
      for (let k = 0; k < 2; k++) {
        const sd = sides[k], uEdge = (sd === 0 || sd === 4) ? 7 : 0, dir = uEdge === 7 ? -1 : 1;
        if (c.nc[sd] === DOOR) for (let v = 0; v < 8; v++) { fput(d, uEdge, v, 0, s.jamb || s.trim || C.dark); }
        const sc = (c.x >> (k * 3 + (d === 0 || d === 1 ? 0 : 6))) & 7;
        if (sc && (c.ext >> d) & 1) {
          const col = SHUTTER[sc];
          for (let v = 1; v <= 6; v++) for (let w = 0; w < 3; w++) fput(d, uEdge + dir * w, v, 0, (v & 1) ? col : sh(col, 0.8));
          fput(d, uEdge + dir * 2, 2, 0, C.iron); fput(d, uEdge + dir * 2, 5, 0, C.iron);
        }
      }
    }
    // vertical corners: posts / quoins where two exposed faces meet
    if (s.corner) {
      for (const [da, db] of [[0, 4], [0, 5], [1, 4], [1, 5]]) {
        if (!exposed(c, da) || !exposed(c, db)) continue;
        const x = da === 0 ? 7 : 0, z = db === 4 ? 7 : 0;
        for (let v = 0; v < 8; v++) {
          let col = s.corner;
          if (s.quoin) col = ((v >> 1) + c.py) & 1 ? s.corner : sh(s.corner, 0.86);
          put(x, v, z, col); put(x + (x ? -1 : 1), v, z, col); put(x, v, z + (z ? -1 : 1), col);
          if (s.quoin && ((v >> 1) + c.py) & 1) { put(x + (x ? -2 : 2), v, z, col); } else if (s.quoin) put(x, v, z + (z ? -2 : 2), col);
        }
      }
    }
    // top: coping / snow when nothing sits on it
    if (c.nc[2] === AIR || c.nc[2] === OTHER) {
      const cap = s.cap || sh(s.col, 0.8);
      box(0, 7, 0, 7, 7, 7, cap);
      if (s.pat === 'crystal') { box(0, 7, 0, 7, 7, 0, C.violet, EMIS); box(0, 7, 7, 7, 7, 7, C.violet, EMIS); }
    }
  };
  const INNER = { plaster: null, timber: null, adobe: null, siding: 0xE8DCC4, logs: 0xB0845A, planks: 0xC89A64, batten: 0x8A6A4A, bricks: 0xE8E2D6, fieldstone: 0xE4DDCC, sandstone: 0xEAD8B0, hull: 0xDDE2EA, crystal: 0xF4F0FF };
  const SHUTTER = [0, 0x3F7F4A, 0x3F63A8, 0xB5423A, 0x3A3A3A, 0x2F8C8A, 0xE7B84A, 0x7A55C8];
  VX.SHUTTER = SHUTTER;

  // WINDOW (in a wall plane; borrows the surrounding wall's material) ---------
  PAINT_FN.window = function (s, c) {
    G.fill(0);
    const f = c.facing & 1; // 0: plane along x (faces ±z) · 1: plane along z (faces ±x)
    const faces = f === 0 ? [4, 5] : [0, 1];
    const border = c.borderSpec || WALL_DEFAULT;
    // body in the border material
    box(0, 0, 0, 7, 7, 7, sh(border.col, 0.9));
    const pat = PAT[border.pat] || PAT.plaster;
    for (const d of faces) {
      if (!exposed(c, d)) continue;
      for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
        PF0 = 0; PF1 = 0; pat(border, u, v, c, d);
        if (P0 < 0) fdel(d, u, v, 0); else fput(d, u, v, 0, P0, PF0);
        fput(d, u, v, 1, P1, PF1);
      }
    }
    // opening (merges with stacked / side-by-side windows); 7-wide so the mullion cross is centred
    const up = c.nc[2] === WIN, dn = c.nc[3] === WIN;
    const sides = f === 0 ? [1, 0] : [5, 4];
    const lf = c.nc[sides[0]] === WIN, rt = c.nc[sides[1]] === WIN;
    const u0 = lf ? 0 : 1, u1 = 7, v0 = dn ? 0 : 1, v1 = 7;
    const at = (u, v, dp) => f === 0 ? [u, v, dp] : [dp, v, u];
    const P = (u, v, dp, col, fl) => { const p = at(u, v, dp); put(p[0], p[1], p[2], col, fl); };
    const D = (u, v, dp) => { const p = at(u, v, dp); del(p[0], p[1], p[2]); };
    const round = s.style === 'round', arch = s.style === 'arch';
    const inside = (u, v) => {
      if (u < u0 || u > u1 || v < v0 || v > v1) return false;
      if (round) { const du = u - 4, dv = v - 4; return du * du + dv * dv <= 10.6; }
      if (arch && !up) { if (v === v1 && (u < u0 + 2 || u > u1 - 2)) return false; if (v === v1 - 1 && (u < u0 + 1 || u > u1 - 1)) return false; }
      return true;
    };
    for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) if (inside(u, v)) for (let dp = 0; dp < 8; dp++) D(u, v, dp);
    // frame ring + mullion cross + glass pane
    const frame = s.frame;
    for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
      if (!inside(u, v)) continue;
      const edge = !inside(u - 1, v) || !inside(u + 1, v) || !inside(u, v - 1) || !inside(u, v + 1);
      const mull = s.mullion && !round && (((u1 - u0) % 2 === 0 && u === (u0 + u1) / 2) || ((v1 - v0) % 2 === 0 && v === (v0 + v1) / 2));
      if (edge || mull) { for (let dp = 2; dp <= 5; dp++) P(u, v, dp, frame, s.frameFlags || 0); }
      else P(u, v, 4, s.glassCol || C.glass, GLASS);
    }
    // sill on the exterior side(s)
    if (!dn) {
      const extA = (c.ext >> faces[0]) & 1, extB = (c.ext >> faces[1]) & 1;
      const both = !extA && !extB;
      for (let u = 0; u <= 7; u++) {
        if (u < 0 || u > 7) continue;
        if (extA || both) { const dp0 = faces[0] === 4 || faces[0] === 0 ? 6 : 1; P(u, 0, dp0, s.sill || C.white); P(u, 0, faces[0] === 4 || faces[0] === 0 ? 7 : 0, s.sill || C.white); }
        if (extB || both) { const dp0 = faces[1] === 4 || faces[1] === 0 ? 6 : 1; P(u, 0, dp0, s.sill || C.white); P(u, 0, faces[1] === 4 || faces[1] === 0 ? 7 : 0, s.sill || C.white); }
      }
    }
    if (s.glow) for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) { const p = at(u, v, 2); const g = get(p[0], p[1], p[2]); if (g && !(g & GLASS) && inside(u, v)) put(p[0], p[1], p[2], s.glow, EMIS); }
  };

  // ROOF (45° voxel slope; facing = uphill direction like stairs; auto hip corners) --
  PAINT_FN.roof = function (s, c) {
    G.fill(0);
    const fa = c.facing; let shape = c.shape, fb = c.facing2;
    const sAlong = (fc, x, z) => fc === 0 ? 7 - z : fc === 1 ? x : fc === 2 ? z : 7 - x; // 0 at the eave side, 7 at the high side
    const eaveOpen = c.eave, sideA = c.sideA, sideB = c.sideB, ridge = c.ridgeTop;
    const col = s.col, col2 = sh(s.col, s.course || 0.86), trim = s.trim || C.dark, under = s.under || C.oakD;
    // low (22°) hip roofs rise half a block per cell: part bit 0 = lower / upper half of the slope; part >> 1 = the corner
    // kind (0 plain, 1/2 hip with the second uphill side at facing+1 / facing−1, 3/4 the same as valleys) — set by the builder,
    // not read from the neighbours, so the hip lines of a low roof land exactly where the planner put them
    const lowUp = s.low ? (c.part & 1) : 0, lowCorner = s.low ? (c.part >> 1) : 0;
    if (s.low) { shape = lowCorner === 0 ? 0 : lowCorner <= 2 ? 1 : 2; fb = (fa + ((lowCorner & 1) ? 1 : 3)) & 3; }
    const hOf = s.low ? (a) => (lowUp ? 5 : 1) + (a >> 1) : (a) => a + 1;
    for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
      let h;
      if (s.ridge) {
        // half-height peak along the ridge axis (fa & 1 === 0 → ridge runs along x)
        const t = (fa & 1) === 0 ? z : x;
        h = Math.min(t, 7 - t) + 1;
      } else {
        const a = sAlong(fa, x, z);
        h = hOf(a);
        if (shape === 1) h = Math.min(h, hOf(sAlong(fb, x, z))); // outer corner
        else if (shape === 2) h = Math.max(h, hOf(sAlong(fb, x, z))); // inner corner
      }
      for (let y = 0; y < h; y++) {
        const top = y === h - 1;
        let cc;
        if (top) {
          const course = ((c.py * 8 + y) >> 1) & 1;
          const lane = s.ridge ? 0 : (((fa & 1) === 0 ? x : z) + (course ? 1 : 0)) >> 1;
          cc = course ? col2 : col;
          if (s.tiles) cc = sh(cc, 0.95 + (hh(lane, y, c.h, 13) & 3) * 0.035);
          if (s.moss && (hh(x, z, c.h + c.py, 17) & 31) === 0) cc = 0x6A8A3A;
        } else cc = y === 0 && c.nc[3] === AIR ? under : sh(col2, 0.8);
        put(x, y, z, cc, s.flags || 0);
      }
    }
    // ridge cap
    if (s.ridge) {
      const along = (fa & 1) === 0;
      for (let k = 0; k < 8; k++) { if (along) { put(k, 4, 3, s.ridgeCol || trim); put(k, 4, 4, s.ridgeCol || trim); } else { put(3, 4, k, s.ridgeCol || trim); put(4, 4, k, s.ridgeCol || trim); } }
    } else if (ridge && !s.low) {
      for (let k = 0; k < 8; k++) for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) { if (sAlong(fa, x, z) === 7 && get(x, 7, z)) put(x, 7, z, s.ridgeCol || trim); }
    }
    // fascia board along the eave, barge boards on open gable sides
    if (eaveOpen && !s.ridge) for (let x = 0; x < 8; x++) for (let z = 0; z < 8; z++) if (sAlong(fa, x, z) === 0) { put(x, 0, z, trim); }
    if (!s.ridge && !s.low) for (const [open, side] of [[sideA, 0], [sideB, 7]]) {
      if (!open) continue;
      for (let t = 0; t < 8; t++) {
        const x = (fa & 1) === 0 ? side : t, z = (fa & 1) === 0 ? t : side;
        const a = sAlong(fa, x, z);
        put(x, a, z, trim);
        if (a > 0) put(x, a - 1, z, sh(trim, 0.85));
      }
    }
  };

  // FLOOR ---------------------------------------------------------------------
  PAINT_FN.floor = function (s, c) {
    G.fill(0);
    box(0, 0, 0, 7, 7, 7, s.side || C.stone);
    // sides: foundation stones when exposed (tech floors: panels)
    const sidePat = s.sidePat ? PAT[s.sidePat] : null, sideSpec = s.sideSpec || FOUND;
    for (const d of HFACES) {
      if (!exposed(c, d)) continue;
      for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
        PF0 = 0; PF1 = 0; if (sidePat) sidePat(sideSpec, u, v, c, d); else PAT.fieldstone(FOUND, u, v, c, d);
        if (P0 < 0) fdel(d, u, v, 0); else fput(d, u, v, 0, P0, PF0);
        fput(d, u, v, 1, P1, PF1);
      }
    }
    // top surface
    for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
      let cc = s.col, fl = s.flags || 0;
      switch (s.pat) {
        case 'planks': { const X = c.px * 8 + x, b = (c.pz * 8 + z) >> 1; const seam = (X + (b & 1) * 5 + (hh(b, c.h, 0, 3) & 7)) % 16 === 0; cc = seam ? sh(s.col, 0.72) : sh(s.col, 0.94 + (hh(b, c.h, 2, 5) & 3) * 0.03); if ((z & 1) === 1) cc = sh(cc, 0.93); break; }
        case 'tiles': cc = (x === 0 || z === 0) ? s.col2 : sh(s.col, 0.97 + (c.h & 1) * 0.04); break;
        case 'checker': cc = ((x >> 2) + (z >> 2) + c.px + c.pz) & 1 ? s.col : s.col2; fl |= GLOSS; break;
        case 'stone': PF0 = 0; PAT.fieldstone(FOUND_TOP, x, z, c, 2); cc = P0 < 0 ? s.col2 : P0; break;
        case 'metal': cc = (x === 0 || z === 0) ? s.col2 : ((x + z) & 3) === 0 ? sh(s.col, 0.8) : s.col; fl |= GLOSS; if (x === 4 && z === 4 && (c.h & 1)) { cc = C.cyan; fl |= EMIS; } break;
        case 'marble': cc = mix(s.col, s.col2, (hh(x >> 1, z >> 1, c.h, 7) & 7) === 0 ? 0.6 : 0); fl |= GLOSS; break;
        default: { const fp = VX.floorPat[s.pat]; if (fp) { const r = fp(s, c, x, z); cc = r[0]; fl = r[1]; if (r[2]) { put(x, 7, z, cc, fl); continue; } } }
      }
      if (cc < 0) { del(x, 7, z); put(x, 6, z, s.col2 || sh(s.col, 0.7)); continue; }
      put(x, 7, z, cc, fl);
    }
  };
  const FOUND = { col: 0x8E8C86, col2: 0x5E5C58 }, FOUND_TOP = { col: 0xA8A69E, col2: 0x6E6C66 };

  // BEAM / POST ---------------------------------------------------------------
  PAINT_FN.beam = function (s, c) {
    G.fill(0);
    const ax = c.axis; // 0 y, 1 x, 2 z
    const col = s.col, dk = sh(s.col, 0.8);
    const hard = (n) => n === SOLID || n === FLOOR || n === WALL || n === ROOF;
    if (ax === 0) {
      box(3, 0, 3, 4, 7, 4, (x, y, z) => ((y >> 1) & 1) ? col : sh(col, 0.93));
      if (hard(c.nc[3]) || c.nc[3] === AIR) box(2, 0, 2, 5, 0, 5, dk);
      if (hard(c.nc[2])) { box(2, 7, 2, 5, 7, 5, dk); box(3, 6, 2, 4, 6, 5, col); box(2, 6, 3, 5, 6, 4, col); }
    } else if (ax === 1) { box(0, 3, 2, 7, 5, 5, (x, y) => (y & 1) ? col : sh(col, 0.93)); }
    else { box(2, 3, 0, 5, 5, 7, (x, y) => (y & 1) ? col : sh(col, 0.93)); }
  };

  // CHIMNEY -------------------------------------------------------------------
  PAINT_FN.chimney = function (s, c) {
    G.fill(0);
    const top = c.nc[2] === AIR || c.nc[2] === OTHER;
    for (let y = 0; y < 8; y++) for (let z = 1; z <= 6; z++) for (let x = 1; x <= 6; x++) {
      const edge = x === 1 || x === 6 || z === 1 || z === 6;
      if (!edge && top && y >= 3) continue;
      const row = y >> 1, U = (x === 1 || x === 6) ? z : x;
      const mortar = (y & 1) === 1 || ((U + (row & 1) * 2) & 3) === 3;
      put(x, y, z, mortar ? s.col2 : sh(s.col, 0.92 + (hh(U >> 2, row, c.h, 3) & 3) * 0.04));
    }
    if (top) {
      box(0, 6, 0, 7, 7, 7, (x, y, z) => (x >= 2 && x <= 5 && z >= 2 && z <= 5) ? null : sh(s.col2, 1.1));
      box(2, 3, 2, 5, 3, 5, C.fire, EMIS);
    }
  };

  // FENCE (picket, connects to fences/walls/solids) -----------------------------
  PAINT_FN.fence = function (s, c) {
    G.fill(0);
    const col = s.col;
    box(3, 0, 3, 4, 7, 4, sh(col, 0.92));
    put(3, 7, 3, sh(col, 1.05)); put(4, 7, 4, sh(col, 1.05));
    for (let k = 0; k < 4; k++) {
      if (!((c.x >> k) & 1)) continue;
      const d = [5, 0, 4, 1][k];
      for (let t = 0; t < 4; t++) {
        const [x0, z0] = d === 5 ? [3, t] : d === 4 ? [3, 7 - t] : d === 0 ? [7 - t, 3] : [t, 3];
        const along = d === 0 || d === 1;
        const X1 = along ? x0 : x0 + 1, Z1 = along ? z0 + 1 : z0;
        box(x0, 2, z0, X1, 2, Z1, sh(col, 0.85)); box(x0, 5, z0, X1, 5, Z1, sh(col, 0.85));
        if ((t & 1) === 1) { const px = along ? x0 : x0, pz = along ? z0 : z0; box(px, 1, pz, px + (along ? 0 : 1), 6, pz + (along ? 1 : 0), col); put(px, 7, pz, col); }
      }
    }
  };

  // LAMPPOST ----------------------------------------------------------------------
  PAINT_FN.lamppost = function (s, c) {
    G.fill(0);
    const post = s.post || C.iron;
    if (!c.head) {
      box(3, 0, 3, 4, 7, 4, post);
      if (c.nc[3] === SOLID || c.nc[3] === FLOOR || c.nc[3] === AIR) { box(2, 0, 2, 5, 1, 5, sh(post, 1.2)); box(1, 0, 1, 6, 0, 6, sh(post, 0.9)); }
      box(2, 5, 3, 5, 5, 4, post);
      return;
    }
    box(3, 0, 3, 4, 1, 4, post);
    box(2, 1, 2, 5, 1, 5, post);
    const glow = s.glow || C.warm;
    if (s.crystal) {
      box(3, 2, 3, 4, 6, 4, glow, EMIS); box(2, 3, 3, 5, 4, 4, glow, EMIS); box(3, 3, 2, 4, 4, 5, glow, EMIS); put(3, 7, 3, glow, EMIS);
    } else {
      box(2, 2, 2, 5, 5, 5, glow, EMIS);
      for (const [x, z] of [[2, 2], [5, 2], [2, 5], [5, 5]]) box(x, 2, z, x, 5, z, post);
      box(1, 6, 1, 6, 6, 6, post); box(2, 7, 2, 5, 7, 5, post); put(3, 7, 3, sh(post, 1.3)); put(4, 7, 4, sh(post, 1.3));
    }
  };

  // WINDOW BOX & PLANTER ----------------------------------------------------------
  function flowers(y0, x0, z0, x1, z1, c, seed) {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const h = hh(x, z, c.h + seed, 31);
      if ((h & 3) === 0) continue;
      const tall = 1 + ((h >> 2) & 1);
      for (let y = 0; y < tall; y++) put(x, y0 + y, z, (h >> 5) & 1 ? C.leaf : C.leafD);
      if ((h >> 3) & 1) put(x, y0 + tall, z, FLOWERS[(h >> 7) % FLOWERS.length]);
    }
  }
  PAINT_FN.windowbox = function (s, c) {
    G.fill(0);
    // local: wall at +z (back), box hangs at z 5..7 just under the window sill above
    box(0, 3, 5, 7, 5, 7, (x, y, z) => (y === 3 || x === 0 || x === 7 || z === 5) ? (y === 5 ? sh(s.col, 1.1) : s.col) : C.soil);
    box(1, 5, 6, 6, 5, 6, C.soil);
    flowers(6, 1, 5, 6, 6, c, 1);
    box(1, 2, 7, 1, 2, 7, C.iron); box(6, 2, 7, 6, 2, 7, C.iron);
    rotateGrid(c.facing);
  };
  PAINT_FN.planter = function (s, c) {
    G.fill(0);
    box(0, 0, 0, 7, 2, 7, (x, y, z) => (x === 0 || x === 7 || z === 0 || z === 7) ? ((y === 2) ? sh(s.col, 1.08) : s.col) : C.soil);
    flowers(3, 1, 1, 6, 6, c, 2);
  };

  // FURNITURE ---------------------------------------------------------------------
  PAINT_FN.bed = function (s, c) {
    G.fill(0);
    const head = c.part === 1, wood = s.wood || C.oakD, blanket = s.col;
    // local: bed runs along -z (head at north when facing north); this block is foot (part 0) or head (1)
    box(0, 0, 0, 7, 0, 7, null);
    for (const [x, z] of [[0, 0], [7, 0], [0, 7], [7, 7]]) box(x, 0, z, x, 1, z, wood);
    box(0, 2, 0, 7, 2, 7, wood);
    box(0, 3, 0, 7, 3, 7, C.white);
    if (head) {
      box(0, 2, 0, 7, 6, 0, wood); box(1, 7, 0, 6, 7, 0, sh(wood, 1.15));
      box(1, 4, 1, 6, 4, 3, 0xF8F6F0); box(2, 5, 1, 5, 5, 2, 0xF8F6F0);
      box(0, 4, 5, 7, 4, 7, blanket); box(0, 3, 4, 7, 3, 7, sh(blanket, 0.9));
    } else {
      box(0, 4, 0, 7, 4, 6, (x, y, z) => ((x + z) & 3) === 0 ? sh(blanket, 1.15) : blanket);
      box(0, 3, 0, 0, 3, 6, sh(blanket, 0.85)); box(7, 3, 0, 7, 3, 6, sh(blanket, 0.85));
      box(0, 2, 7, 7, 4, 7, wood);
    }
    rotateGrid(c.facing);
  };
  PAINT_FN.table = function (s, c) {
    G.fill(0);
    const w = s.col;
    for (const [x, z] of [[1, 1], [6, 1], [1, 6], [6, 6]]) box(x, 0, z, x, 5, z, sh(w, 0.85));
    box(0, 6, 0, 7, 6, 7, (x, y, z) => ((x >> 1) & 1) ? w : sh(w, 0.94));
    const h = c.h + c.px * 4 + c.pz * 8;
    // things on the table
    if (h & 1) { box(2, 7, 2, 3, 7, 3, 0xF0EDE4); put(2, 7, 2, 0xC87A3A); }
    if (h & 2) { put(5, 7, 4, 0xE8C070); put(6, 7, 4, 0xE0B060); }
    if (h & 4) { put(4, 7, 5, C.warm, EMIS); }
    if (h & 8) { box(1, 7, 5, 2, 7, 6, 0x3A5AB0); }
  };
  PAINT_FN.chair = function (s, c) {
    G.fill(0);
    const w = s.col;
    for (const [x, z] of [[1, 1], [6, 1], [1, 6], [6, 6]]) box(x, 0, z, x, 2, z, sh(w, 0.85));
    box(1, 3, 1, 6, 3, 6, w);
    if (s.cushion) box(2, 4, 2, 5, 4, 5, s.cushion);
    box(1, 4, 6, 6, 7, 6, (x, y) => (x === 1 || x === 6 || y === 7) ? sh(w, 0.9) : (x & 1 ? null : w));
    rotateGrid(c.facing);
  };
  PAINT_FN.bench = function (s, c) {
    G.fill(0);
    box(0, 0, 2, 0, 3, 5, C.iron); box(7, 0, 2, 7, 3, 5, C.iron);
    box(0, 3, 2, 7, 3, 5, (x, y, z) => (z & 1) ? s.col : sh(s.col, 0.9));
    box(0, 4, 6, 7, 6, 6, (x, y) => (y & 1) ? s.col : null);
    box(0, 3, 6, 0, 6, 6, C.iron); box(7, 3, 6, 7, 6, 6, C.iron);
    rotateGrid(c.facing);
  };
  PAINT_FN.shelf = function (s, c) {
    G.fill(0);
    const w = s.col;
    box(0, 0, 5, 7, 7, 7, sh(w, 0.8));
    box(0, 0, 0, 0, 7, 7, w); box(7, 0, 0, 7, 7, 7, w);
    box(0, 0, 0, 7, 0, 7, w); box(0, 4, 0, 7, 4, 7, w); box(0, 7, 0, 7, 7, 7, w);
    const BOOK = [0xB5423A, 0x3F63A8, 0x4E7F46, 0xE0A83A, 0x7A55C8, 0x8A5E32, 0x2F8C8A, 0xE8E0D0];
    for (const y0 of [1, 5]) for (let x = 1; x <= 6; x++) {
      const h = hh(x, y0, c.h + c.px * 2 + c.pz * 5, 41);
      if ((h & 7) === 0) continue;
      const hgt = Math.min(y0 === 1 ? 3 : 2, 2 + ((h >> 3) & 1));
      const col = BOOK[(h >> 5) & 7];
      box(x, y0, 1, x, y0 + hgt - 1, 4, col); put(x, y0 + hgt - 1, 1, sh(col, 1.2));
    }
    rotateGrid(c.facing);
  };
  PAINT_FN.stove = function (s, c) {
    G.fill(0);
    box(0, 0, 0, 7, 6, 7, (x, y, z) => (y === 6) ? C.iron : (((x + y) & 1) ? s.col : sh(s.col, 0.94)));
    box(2, 1, 0, 5, 4, 0, null); box(2, 1, 1, 5, 3, 1, C.fire, EMIS); box(3, 1, 1, 4, 2, 1, C.warm, EMIS);
    box(2, 4, 0, 5, 4, 0, C.iron);
    box(4, 7, 2, 6, 7, 4, 0x2A2A30); put(5, 7, 3, 0x4A4A55);
    box(1, 7, 5, 2, 7, 6, C.iron);
    rotateGrid(c.facing);
  };
  PAINT_FN.counter = function (s, c) {
    G.fill(0);
    box(0, 0, 0, 7, 5, 7, (x, y, z) => z === 0 && (x === 3 || x === 4) && y > 0 ? sh(s.col, 0.75) : (y === 3 && z === 0 ? sh(s.col, 0.85) : s.col));
    box(0, 6, 0, 7, 6, 7, s.top || 0xD8D2C4);
    const h = c.h + c.px * 4;
    if (h & 1) { box(1, 7, 2, 3, 7, 3, 0xD8A060); }
    if (h & 2) { box(5, 7, 4, 5, 7, 5, 0x6AA0D0); put(5, 7, 4, 0xF0F0F0); }
    rotateGrid(c.facing);
  };
  PAINT_FN.rug = function (s, c) {
    G.fill(0);
    // borders only where the rug ends → multi-block rugs join into one
    const bx0 = (c.x & 2) === 0, bx1 = (c.x & 1) === 0, bz0 = (c.x & 8) === 0, bz1 = (c.x & 4) === 0;
    for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
      const edge = (bx0 && x === 0) || (bx1 && x === 7) || (bz0 && z === 0) || (bz1 && z === 7);
      const inner = (bx0 && x === 1) || (bx1 && x === 6) || (bz0 && z === 1) || (bz1 && z === 6);
      const motif = ((x + z + c.px * 8 + c.pz * 8) % 6) === 0;
      put(x, 0, z, edge ? s.col2 : inner ? C.cream : motif ? sh(s.col, 1.2) : s.col);
    }
  };
  PAINT_FN.lantern = function (s, c) {
    G.fill(0);
    const hang = c.nc[2] === SOLID || c.nc[2] === WALL || c.nc[2] === FLOOR || c.nc[2] === ROOF || c.nc[2] === OTHER;
    const y0 = hang ? 2 : 0;
    box(2, y0, 2, 5, y0 + 3, 5, s.glow || C.warm, EMIS);
    for (const [x, z] of [[2, 2], [5, 2], [2, 5], [5, 5]]) box(x, y0, z, x, y0 + 3, z, C.iron);
    box(2, y0 + 4, 2, 5, y0 + 4, 5, C.iron); box(3, y0 + 5, 3, 4, y0 + 5, 4, C.iron);
    if (hang) box(3, y0 + 5, 3, 3, 7, 3, 0x5A5A60);
  };
  PAINT_FN.floorlamp = function (s, c) {
    G.fill(0);
    box(2, 0, 2, 5, 0, 5, C.iron); box(3, 1, 3, 4, 4, 4, C.brass);
    box(1, 5, 1, 6, 7, 6, (x, y, z) => (x === 1 || x === 6 || z === 1 || z === 6) ? s.col : null);
    box(2, 5, 2, 5, 6, 5, C.warm, EMIS);
  };
  PAINT_FN.crate = function (s, c) {
    G.fill(0);
    const w = s.col;
    box(0, 0, 0, 7, 7, 7, (x, y, z) => {
      const ex = (x === 0 || x === 7) + (y === 0 || y === 7) + (z === 0 || z === 7);
      if (ex >= 2) return sh(w, 0.7);
      return ((y >> 1) & 1) ? w : sh(w, 0.9);
    });
    if (s.label) box(2, 3, 0, 5, 4, 0, s.label);
  };
  PAINT_FN.barrel = function (s, c) {
    G.fill(0);
    for (let y = 0; y < 8; y++) for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
      const r = Math.hypot(x - 3.5, z - 3.5);
      const rad = (y === 0 || y === 7) ? 3.1 : 3.8;
      if (r > rad) continue;
      const band = y === 1 || y === 6;
      put(x, y, z, band ? C.iron : (y === 7 ? sh(s.col, 0.85) : (((Math.atan2(z - 3.5, x - 3.5) * 2.5) | 0) & 1 ? s.col : sh(s.col, 0.9))));
    }
  };
  PAINT_FN.potplant = function (s, c) {
    G.fill(0);
    box(2, 0, 2, 5, 2, 5, 0xC06A3A); box(3, 2, 3, 4, 2, 4, C.soil);
    const h = c.h + c.px * 4 + c.pz * 8;
    for (let k = 0; k < 14; k++) {
      const q = hh(k, h, 0, 51);
      const x = 1 + (q & 5) % 6, z = 1 + ((q >> 3) & 5) % 6, y = 3 + ((q >> 6) & 3);
      put(x, y, z, (q >> 9) & 1 ? C.leaf : C.leafD);
      if (y > 3) put(x, y - 1, z, C.leafD);
    }
    box(3, 3, 3, 4, 5, 4, C.leafD);
    if (h & 1) put(3, 6, 4, FLOWERS[h % FLOWERS.length]);
  };
  PAINT_FN.hay = function (s, c) {
    G.fill(0);
    box(0, 0, 0, 7, 7, 7, (x, y, z) => (x === 2 || x === 5) ? 0xB0802A : (((x + y * 3 + z * 5) % 7) === 0 ? 0xE8C860 : 0xD8B048));
  };
  PAINT_FN.awning = function (s, c) {
    G.fill(0);
    // local: wall at +z; fabric slopes from (y7, z7) down to (y3, z0), scalloped front
    for (let z = 0; z < 8; z++) {
      const y = 3 + (z >> 1);
      for (let x = 0; x < 8; x++) put(x, y, z, ((x >> 1) & 1) ? s.col : s.col2);
    }
    for (let x = 0; x < 8; x++) if ((x & 1) === 0) put(x, 2, 0, ((x >> 1) & 1) ? s.col : s.col2);
    box(0, 7, 7, 7, 7, 7, C.iron);
    rotateGrid(c.facing);
  };
  const ICONS = [
    [0b0100, 0b0110, 0b1110, 0b0100], // wheat
    [0b1110, 0b1110, 0b0100, 0b0100], // hammer
    [0b1111, 0b1001, 0b1001, 0b1111], // book
    [0b0110, 0b1111, 0b1111, 0b0000], // bread
    [0b1111, 0b0110, 0b0110, 0b1111], // anvil
    [0b0100, 0b1110, 0b1110, 0b0100], // crystal
    [0b1010, 0b1111, 0b0110, 0b0100], // heart
    [0b0100, 0b1111, 0b0100, 0b1010], // star
  ];
  const ICOL = [0xF6D23A, 0x9AA0A8, 0x3F63A8, 0xD8A060, 0x5A5A60, 0xB070FF, 0xE8403A, 0xFFE07A];
  PAINT_FN.sign = function (s, c) {
    G.fill(0);
    // local: wall at +z; bracket out along -z, board hangs under it
    box(3, 7, 1, 4, 7, 7, C.iron);
    box(1, 2, 2, 6, 6, 2, s.col);
    box(1, 2, 2, 6, 2, 2, sh(s.col, 0.8)); box(1, 6, 2, 6, 6, 2, sh(s.col, 0.8));
    put(2, 7, 2, C.iron); put(5, 7, 2, C.iron);
    const ic = ICONS[c.icon & 7];
    for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) if ((ic[r] >> (3 - k)) & 1) { put(2 + k, 5 - r, 1, ICOL[c.icon & 7], c.icon === 5 ? EMIS : 0); put(5 - k, 5 - r, 3, ICOL[c.icon & 7], c.icon === 5 ? EMIS : 0); }
    rotateGrid(c.facing);
  };
  PAINT_FN.solar = function (s, c) {
    G.fill(0);
    box(3, 0, 3, 4, 2, 4, C.iron);
    for (let z = 0; z < 8; z++) {
      const y = 3 + (z >> 1);
      for (let x = 0; x < 8; x++) {
        const frame = x === 0 || x === 7 || z === 0 || z === 7;
        put(x, y, z, frame ? 0xC8CCD4 : ((x & 3) === 0 || (z & 3) === 0) ? 0x5A7AB0 : 0x203A78, frame ? GLOSS : GLOSS);
      }
    }
    rotateGrid(c.facing);
  };
  PAINT_FN.dish = function (s, c) {
    G.fill(0);
    box(3, 0, 3, 4, 3, 4, 0xB0B4BC);
    for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
      const r = Math.hypot(x - 3.5, z - 3.5);
      if (r > 3.9) continue;
      const y = 4 + Math.round(r * 0.6);
      put(x, y, z, r > 3.2 ? 0xC8CCD4 : C.hull, GLOSS);
    }
    box(3, 5, 3, 4, 6, 4, 0xB0B4BC); put(3, 7, 3, C.cyan, EMIS);
  };
  PAINT_FN.crystal = function (s, c) {
    G.fill(0);
    box(1, 0, 1, 6, 0, 6, 0x4A3A60); box(2, 1, 2, 5, 1, 5, 0x5A4A70);
    const spikes = [[3, 3, 7], [5, 4, 5], [2, 5, 4], [4, 2, 5], [5, 2, 3], [2, 2, 3]];
    for (const [x, z, h] of spikes) for (let y = 1; y <= h; y++) { put(x, y, z, y > h - 2 ? sh(s.col, 1.25) : s.col, EMIS); if (y < h - 2) put(x + 1, y, z, sh(s.col, 0.85), EMIS); }
  };
  PAINT_FN.well = function (s, c) {
    G.fill(0);
    for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
      const r = Math.hypot(x - 3.5, z - 3.5);
      if (r > 3.9) continue;
      if (r > 2.4) for (let y = 0; y <= 4; y++) put(x, y, z, ((y + ((x + z) >> 1)) & 1) ? C.stone : C.stoneD);
      else put(x, 1, z, 0x2A6AC8, GLOSS);
    }
  };

  // ---------------------------------------------------------------- kind specs
  // cls: neighbour class this kind presents · opaque: full-cube shell (culls neighbours)
  const KIND = VX.KIND = {
    wall: { cls: WALL, opaque: true },
    window: { cls: WIN, filter: 0 },
    roof: { cls: ROOF, filter: 15 },
    floor: { cls: FLOOR, opaque: true },
    beam: { cls: OTHER },
    chimney: { cls: WALL, filter: 15 },
    fence: { cls: OTHER },
    lamppost: { cls: OTHER },
    windowbox: { cls: OTHER },
    planter: { cls: OTHER },
    bed: { cls: OTHER }, table: { cls: OTHER }, chair: { cls: OTHER }, bench: { cls: OTHER }, shelf: { cls: OTHER }, stove: { cls: OTHER }, counter: { cls: OTHER },
    rug: { cls: AIR }, lantern: { cls: OTHER }, floorlamp: { cls: OTHER }, crate: { cls: OTHER }, barrel: { cls: OTHER }, potplant: { cls: OTHER }, hay: { cls: OTHER },
    awning: { cls: OTHER }, sign: { cls: OTHER }, solar: { cls: OTHER }, dish: { cls: OTHER }, crystal: { cls: OTHER }, well: { cls: OTHER },
  };
  const WALL_DEFAULT = { pat: 'plaster', col: PLASTER.white, col2: C.oakD, trim: C.oakD };

  // ---------------------------------------------------------------- registry glue
  let R = null, T = null, SH = null, F = null;
  let clsOf = null, fullMask = null, specOf = null, borderOf = null, shutterOf = null;
  function init() {
    if (clsOf) return;
    R = VR.R; T = R.T; SH = VR.SHAPE; F = VR.F;
    const n = T.type.length;
    clsOf = new Uint8Array(n); fullMask = new Uint8Array(n); specOf = new Array(n).fill(null); borderOf = new Uint8Array(n); shutterOf = new Uint8Array(n);
    VX.WALLSPECS = [WALL_DEFAULT];
    for (let s = 1; s < n; s++) {
      const fl = T.flags[s], shp = T.shape[s];
      if (shp === SH.VOXEL) {
        const t = R.types[T.type[s]], sp = t.o.vx;
        specOf[s] = sp;
        clsOf[s] = KIND[sp.kind].cls;
        if (sp.kind === 'wall') { let i = VX.WALLSPECS.indexOf(sp); if (i < 0) { i = VX.WALLSPECS.length; VX.WALLSPECS.push(sp); } borderOf[s] = i; }
        if (sp.kind === 'window') shutterOf[s] = sp.shutter || 0;
      } else if (!s) clsOf[s] = AIR;
      else if ((fl & F.OPAQUE)) clsOf[s] = SOLID;
      else { const t = R.types[T.type[s]]; clsOf[s] = t && t.o.kind === 'door' ? DOOR : (fl & F.SOLID) && !(fl & (F.PLANT | F.FLUID | F.REPLACE)) ? OTHER : AIR; }
    }
    // full-face masks from a neutral paint (all neighbours solid)
    const cc = neutralCtx();
    for (let s = 1; s < n; s++) {
      if (!specOf[s] || specOf[s].lazy) continue;   // lazy models (voxmodel.js) build on first use, not here: no full faces
      fillCtxFromState(cc, s);
      paintState(s, cc);
      let m = 0;
      const NN = specOf[s].res || 8, GR = VX.gridFor(NN), IX = NN === 32 ? I32 : NN === 16 ? I16 : I;
      for (let d = 0; d < 6; d++) {
        let full = true;
        for (let a = 0; a < NN && full; a++) for (let b = 0; b < NN; b++) {
          const p = d === 0 ? [NN - 1, a, b] : d === 1 ? [0, a, b] : d === 2 ? [a, NN - 1, b] : d === 3 ? [a, 0, b] : d === 4 ? [a, b, NN - 1] : [a, b, 0];
          const v = GR[IX(p[0], p[1], p[2])];
          if (!(v & PRESENT) || (v & GLASS)) { full = false; break; }
        }
        if (full) m |= 1 << d;
      }
      fullMask[s] = m;
    }
  }
  VX.init = init;
  function neutralCtx() { return { nc: [SOLID, SOLID, SOLID, SOLID, SOLID, SOLID], ns: [0, 0, 0, 0, 0, 0], ext: 0, px: 0, py: 0, pz: 0, h: 0, x: 0, facing: 0, facing2: 0, shape: 0, part: 0, axis: 0, head: 0, icon: 0, eave: 0, sideA: 0, sideB: 0, ridgeTop: 0, borderSpec: null }; }
  function fillCtxFromState(c, s) {
    const t = R.types[T.type[s]];
    c.facing = t.has('facing') ? t.get(s, 'facing') : 0;
    c.part = t.has('part') ? t.get(s, 'part') : 0;
    c.axis = t.has('axis') ? t.get(s, 'axis') : 0;
    c.head = t.has('head') ? t.get(s, 'head') : 0;
    c.icon = t.has('icon') ? t.get(s, 'icon') : 0;
  }
  // per-face neighbour masks for the painted block (NN×NN bytes: 0 empty, 1 opaque, 2 glass), filled by a paint
  // function that knows its neighbour's exact voxels (model parts next to their siblings); null = use the cull bits
  const NB = [null, null, null, null, null, null];
  VX.NB = NB;
  function paintState(s, c) {
    const sp = specOf[s];
    const fn = PAINT_FN[sp.kind];
    NB[0] = NB[1] = NB[2] = NB[3] = NB[4] = NB[5] = null;
    if (sp.res >= 16) { if (fn) fn(sp, c); else VX.gridFor(sp.res).fill(0); return; }
    if (fn) fn(sp, c); else G.fill(0);
  }
  VX.cls = (s) => { init(); return clsOf[s]; };
  VX.full = (s) => { init(); return fullMask[s]; };
  VX.spec = (s) => { init(); return specOf[s]; };

  // ---------------------------------------------------------------- context for a block in a padded section
  const ctx = neutralCtx();
  const nbS = [0, 0, 0, 0, 0, 0];
  // build context; returns the extra-bits key part
  function buildCtx(s, sp, B, bi, DOFF, L, wx, wy, wz) {
    const c = ctx;
    for (let d = 0; d < 6; d++) { const ns = B[bi + DOFF[d]]; nbS[d] = ns; c.nc[d] = clsOf[ns]; }
    // exterior faces: open sky (15) or one step under an eave / overhang (14); interiors are darker
    let ext = 0;
    for (let d = 0; d < 6; d++) if ((L[bi + DOFF[d]] >>> 12) >= 14) ext |= 1 << d;
    c.ext = ext;
    c.px = wx & 1; c.py = wy & 1; c.pz = wz & 1; c.h = hh(wx, wy, wz, 77) & 3;
    fillCtxFromState(c, s);
    let x = 0;
    const k = sp.kind;
    if (k === 'wall') {
      // shutter colours of in-plane neighbouring windows: bits [face0 lo, hi | face4 lo, hi] per plane
      // for faces 0/1 (plane along z): neighbours 5 (-z) and 4 (+z) → k=0,1 at bits 0..5 ; faces 4/5 (plane x): neighbours 1,0 → bits 6..11
      const w = (d) => clsOf[nbS[d]] === WIN ? (shutterOf[nbS[d]] & 7) : 0;
      x = w(5) | (w(4) << 3) | (w(1) << 6) | (w(0) << 9);
    } else if (k === 'window') {
      // borrow the wall material from an in-plane neighbour (or below/above)
      const f = c.facing & 1;
      const cand = f === 0 ? [1, 0, 3, 2] : [5, 4, 3, 2];
      let b = 0;
      for (const d of cand) { const ns = nbS[d]; if (clsOf[ns] === WALL && borderOf[ns]) { b = borderOf[ns]; break; } }
      c.borderSpec = VX.WALLSPECS[b] || WALL_DEFAULT;
      x = b;
    } else if (k === 'roof') {
      const t = R.types[T.type[s]];
      const fa = c.facing;
      const up = nbS[F4D[fa]], dn = nbS[OPP[F4D[fa]]];
      c.shape = 0; c.facing2 = 0;
      const rf = (ns) => specOf[ns] && specOf[ns].kind === 'roof' && !specOf[ns].ridge ? R.types[T.type[ns]].get(ns, 'facing') : -1;
      if (!sp.ridge) {
        const fu = rf(up), fd = rf(dn);
        if (fu >= 0 && (fu & 1) !== (fa & 1)) { c.shape = 1; c.facing2 = fu; }
        else if (fd >= 0 && (fd & 1) !== (fa & 1)) { c.shape = 2; c.facing2 = fd; }
      }
      // eave: no roof continuing downhill (same level or one course lower)
      const dnDiag = B[bi + DOFF[OPP[F4D[fa]]] + DOFF[3]], upDiag = B[bi + DOFF[F4D[fa]] + DOFF[2]];
      c.eave = clsOf[dn] !== ROOF && clsOf[dn] !== WALL && clsOf[dnDiag] !== ROOF ? 1 : 0;
      const sA = (fa & 1) === 0 ? 1 : 5, sB = (fa & 1) === 0 ? 0 : 4; // x- / x+ sides (or z-/z+)
      c.sideA = clsOf[nbS[sA]] === AIR || clsOf[nbS[sA]] === OTHER ? 1 : 0;
      c.sideB = clsOf[nbS[sB]] === AIR || clsOf[nbS[sB]] === OTHER ? 1 : 0;
      c.ridgeTop = clsOf[upDiag] !== ROOF && clsOf[upDiag] !== WALL && clsOf[upDiag] !== SOLID && (clsOf[up] === AIR || clsOf[up] === OTHER || rf(up) === ((fa + 2) & 3)) ? 1 : 0;
      x = c.shape | (c.facing2 << 2) | (c.eave << 4) | (c.sideA << 5) | (c.sideB << 6) | (c.ridgeTop << 7);
      void t;
    } else if (k === 'fence') {
      const con = (d) => { const ns = nbS[d], cl = clsOf[ns]; return cl === SOLID || cl === WALL || cl === WIN || (specOf[ns] && (specOf[ns].kind === 'fence' || specOf[ns].kind === 'lamppost')) || cl === DOOR ? 1 : 0; };
      x = con(5) | (con(0) << 1) | (con(4) << 2) | (con(1) << 3);
    } else if (k === 'rug') {
      const same = (d) => specOf[nbS[d]] && specOf[nbS[d]].kind === 'rug' ? 1 : 0;
      x = same(0) | (same(1) << 1) | (same(4) << 2) | (same(5) << 3);
    } else if (VX.ctxHook[k]) x = VX.ctxHook[k](c, sp, s, nbS, B, bi, DOFF) & 0x3ffff;
    c.x = x;
    return x;
  }

  // ---------------------------------------------------------------- greedy mesher for one painted block
  // Output record per quad (Int16 x RS): dir, col565, flags(emis 1|glass 2|gloss 4), then 4 vertices x
  // [px, py, pz (1/16 block units), u, v (1/16 texture units), ao]; vertex order already AO-flipped.
  const RS = 3 + 4 * 6;
  const tmpQ = [];
  const mask = new Int32Array(1024), maskAO = new Int32Array(1024);
  const CS = [[-1, -1], [-1, 1], [1, 1], [1, -1]];
  // the grid being meshed (8³ by default, 16³ for model pieces)
  let MG = G, MN = 8, MI = I;
  // index into a face mask for the voxel (x, y, z) looking across face d
  const nbIdx = (d, x, y, z) => d < 2 ? y * MN + z : d < 4 ? x * MN + z : x * MN + y;
  const occAt = (x, y, z, solidNb) => {
    if (x >= 0 && y >= 0 && z >= 0 && x < MN && y < MN && z < MN) { const v = MG[MI(x, y, z)]; return (v & PRESENT) && !(v & GLASS) ? 1 : 0; }
    let out = 0, d = -1;
    if (x < 0) { out++; d = 1; } else if (x >= MN) { out++; d = 0; }
    if (y < 0) { out++; d = 3; } else if (y >= MN) { out++; d = 2; }
    if (z < 0) { out++; d = 5; } else if (z >= MN) { out++; d = 4; }
    if (out !== 1) return 0;
    const m = NB[d];
    if (m) return m[nbIdx(d, Math.min(MN - 1, Math.max(0, x)), Math.min(MN - 1, Math.max(0, y)), Math.min(MN - 1, Math.max(0, z)))] === 1 ? 1 : 0;
    return (solidNb >> d) & 1;
  };
  const to565 = (c) => (((c >> 19) & 31) << 11) | (((c >> 10) & 63) << 5) | ((c >> 3) & 31);
  const P3 = [0, 0, 0], Q1 = [0, 0, 0], Q2 = [0, 0, 0], QC = [0, 0, 0];
  function meshGridN(GR, NN, cull, solidNb) {
    MG = GR; MN = NN; MI = NN === 32 ? I32 : NN === 16 ? I16 : I;
    const SC = 32 / NN;                     // voxel size in 1/32 block units
    const MK = 64 / NN;                     // material texture: one repeat per quarter block, world-aligned
    const TK = 128 / NN;                    // bevel tile: one per eighth block (one per voxel of the 8³ grid)
    tmpQ.length = 0;
    const bx = [0, 0, 0, 0, 0, 0];
    for (let d = 0; d < 6; d++) {
      const ax = d >> 1;
      const nx = NX[d], ny = NY[d], nz = NZ[d];
      const t1 = ax === 0 ? 2 : 0, t2 = ax === 1 ? 2 : 1;
      for (let sl = 0; sl < NN; sl++) {
        let any = false;
        for (let b = 0; b < NN; b++) for (let a = 0; a < NN; a++) {
          let x, y, z;
          if (ax === 0) { x = sl; y = b; z = a; } else if (ax === 1) { y = sl; x = a; z = b; } else { z = sl; x = a; y = b; }
          const v = MG[MI(x, y, z)];
          const mi = b * NN + a;
          mask[mi] = -1;
          if (!(v & PRESENT)) continue;
          const glass = (v & GLASS) !== 0;
          const qx = x + nx, qy = y + ny, qz = z + nz;
          let vis;
          if (qx < 0 || qy < 0 || qz < 0 || qx >= NN || qy >= NN || qz >= NN) { const m = NB[d], nb = m ? m[nbIdx(d, x, y, z)] : 0; vis = nb ? (!glass && nb === 2) : !((cull >> d) & 1); }
          else { const w = MG[MI(qx, qy, qz)]; vis = !(w & PRESENT) || (!glass && (w & GLASS) !== 0); }
          if (!vis) continue;
          let ao = 0;
          if (!glass) {
            P3[0] = qx; P3[1] = qy; P3[2] = qz;
            for (let q = 0; q < 4; q++) {
              Q1[0] = P3[0]; Q1[1] = P3[1]; Q1[2] = P3[2]; Q2[0] = P3[0]; Q2[1] = P3[1]; Q2[2] = P3[2];
              Q1[t1] += CS[q][0]; Q2[t2] += CS[q][1];
              QC[0] = Q1[0]; QC[1] = Q1[1]; QC[2] = Q1[2]; QC[t2] += CS[q][1];
              const o1 = occAt(Q1[0], Q1[1], Q1[2], solidNb), o2 = occAt(Q2[0], Q2[1], Q2[2], solidNb), oc = occAt(QC[0], QC[1], QC[2], solidNb);
              ao |= ((o1 && o2) ? 3 : o1 + o2 + oc) << (q * 2);
            }
          }
          mask[mi] = to565(v & 0xffffff) | (((v >>> 25) & 15) << 16) | (((v >>> 29) & 7) << 20);
          maskAO[mi] = ao;
          any = true;
        }
        if (!any) continue;
        for (let b = 0; b < NN; b++) for (let a = 0; a < NN;) {
          const mi = b * NN + a, key = mask[mi];
          if (key < 0) { a++; continue; }
          let w = 1, h = 1;
          const ao = maskAO[mi];
          // AO-aware merging: extend along an axis only while the corner shading is constant along it
          const q0 = ao & 3, q1 = (ao >> 2) & 3, q2 = (ao >> 4) & 3, q3 = (ao >> 6) & 3;
          const alongA = q0 === q3 && q1 === q2, alongB = q0 === q1 && q3 === q2;
          if (alongA) while (a + w < NN && mask[mi + w] === key && maskAO[mi + w] === ao) w++;
          if (alongB) outer: while (b + h < NN) { for (let k = 0; k < w; k++) { const mj = (b + h) * NN + a + k; if (mask[mj] !== key || maskAO[mj] !== ao) break outer; } h++; }
          for (let hb = 0; hb < h; hb++) for (let k = 0; k < w; k++) mask[(b + hb) * NN + a + k] = -1;
          if (ax === 0) { bx[0] = sl; bx[3] = sl + 1; bx[2] = a; bx[5] = a + w; bx[1] = b; bx[4] = b + h; }
          else if (ax === 1) { bx[1] = sl; bx[4] = sl + 1; bx[0] = a; bx[3] = a + w; bx[2] = b; bx[5] = b + h; }
          else { bx[2] = sl; bx[5] = sl + 1; bx[0] = a; bx[3] = a + w; bx[1] = b; bx[4] = b + h; }
          const pos = VR.MODEL.facePos(d, [bx[0] * SC, bx[1] * SC, bx[2] * SC, bx[3] * SC, bx[4] * SC, bx[5] * SC]);
          const sx = bx[3] - bx[0], sy = bx[4] - bx[1], sz = bx[5] - bx[2];
          const uw = ax === 0 ? sz : sx, vh = ax === 1 ? sz : sy;
          const matId = (key >>> 20) & 7;
          // UVs follow the voxel position (world-aligned within the block) so tiles and material patterns run
          // seamlessly across neighbouring quads; material patterns turn upright on quads taller than wide
          // (u runs along the face's tangent, v along its bitangent — the cube-face convention the normal maps expect)
          const K = matId ? MK : TK;
          const uvs = [0, 0, 0, 0, 0, 0, 0, 0];
          for (let k = 0; k < 4; k++) {
            const px = pos[k * 3] / SC, py = pos[k * 3 + 1] / SC, pz = pos[k * 3 + 2] / SC;
            let u, v;
            switch (d) { case 0: u = NN - pz; v = NN - py; break; case 1: u = pz; v = NN - py; break; case 2: u = px; v = pz; break; case 3: u = px; v = NN - pz; break; case 4: u = px; v = NN - py; break; default: u = NN - px; v = NN - py; }
            uvs[k * 2] = u * K; uvs[k * 2 + 1] = v * K;
          }
          const upright = matId && ax !== 1 && vh > uw ? 128 : 0;
          const aov = [0, 0, 0, 0];
          if (ao) for (let k = 0; k < 4; k++) {
            const p1 = pos[k * 3 + t1] > bx[t1] * SC ? 1 : -1, p2 = pos[k * 3 + t2] > bx[t2] * SC ? 1 : -1;
            const ai = p1 < 0 ? (p2 < 0 ? 0 : 1) : (p2 > 0 ? 2 : 3);
            aov[k] = (ao >> (ai * 2)) & 3;
          }
          const start = (aov[0] + aov[2] > aov[1] + aov[3]) ? 1 : 0;
          tmpQ.push(d, key & 0xffff, ((key >>> 16) & 127) | upright);
          for (let kk = 0; kk < 4; kk++) {
            const k = (kk + start) & 3;
            tmpQ.push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2], uvs[k * 2], uvs[k * 2 + 1], aov[k]);
          }
          a += w;
        }
      }
    }
    const out = Int16Array.from(tmpQ);
    MG = G; MN = 8; MI = I;
    return out;
  }
  const meshGrid = (cull, solidNb) => meshGridN(G, 8, cull, solidNb);
  VX.meshGrid = meshGrid; VX.meshGridN = meshGridN;

  // cache: state → Map(key → quads)
  const cache = new Map();
  let cacheN = 0;
  VX.clearCache = () => { cache.clear(); cacheN = 0; lodCache.clear(); lodN = 0; };
  VX.stats = { hits: 0, miss: 0 };

  // ---------------------------------------------------------------- far boxes
  // the piece's bounding box in its average surface colour: one face per side instead of dozens of quads
  const lodCache = new Map();
  let lodN = 0;
  function lodFromQuads(quads) {
    let x0 = 99, y0 = 99, z0 = 99, x1 = -1, y1 = -1, z1 = -1, r = 0, g = 0, b = 0, wsum = 0, emis = 0, n = 0;
    for (let q = 0; q < quads.length; q += RS) {
      if (quads[q + 2] & 2) continue; // glass
      n++;
      const col = quads[q + 1] & 0xffff;
      let ax = 99, ay = 99, az = 99, bx = -1, by = -1, bz = -1;
      for (let k = 0; k < 4; k++) { const o = q + 3 + k * 6; const px = quads[o], py = quads[o + 1], pz = quads[o + 2]; if (px < ax) ax = px; if (px > bx) bx = px; if (py < ay) ay = py; if (py > by) by = py; if (pz < az) az = pz; if (pz > bz) bz = pz; }
      const area = Math.max(1, (bx - ax) || 1) * Math.max(1, (by - ay) || 1) * Math.max(1, (bz - az) || 1);
      r += ((col >> 11) & 31) * area; g += ((col >> 5) & 63) * area; b += (col & 31) * area; wsum += area;
      if (quads[q + 2] & 1) emis++;
      if (ax < x0) x0 = ax; if (bx > x1) x1 = bx; if (ay < y0) y0 = ay; if (by > y1) y1 = by; if (az < z0) z0 = az; if (bz > z1) z1 = bz;
    }
    return n ? { box: [x0, y0, z0, x1, y1, z1], col: ((Math.round(r / wsum) & 31) << 11) | ((Math.round(g / wsum) & 63) << 5) | (Math.round(b / wsum) & 31), emis: emis > n * 0.5 } : false;
  }
  // the same box straight from the painted grid (no quads needed): bounds of the solid voxels, colour of the ones on the surface
  function lodFromGrid(sp) {
    const NN = sp.res >= 16 ? sp.res : 8, GR = VX.gridFor(NN), IX = NN === 32 ? I32 : NN === 16 ? I16 : I, Q = 32 / NN;
    let x0 = 99, y0 = 99, z0 = 99, x1 = -1, y1 = -1, z1 = -1, r = 0, g = 0, b = 0, n = 0, emis = 0;
    const solid = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < NN && y < NN && z < NN && (GR[IX(x, y, z)] & PRESENT) && !(GR[IX(x, y, z)] & GLASS);
    for (let y = 0; y < NN; y++) for (let z = 0; z < NN; z++) for (let x = 0; x < NN; x++) {
      const v = GR[IX(x, y, z)];
      if (!(v & PRESENT) || (v & GLASS)) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
      if (solid(x + 1, y, z) && solid(x - 1, y, z) && solid(x, y + 1, z) && solid(x, y - 1, z) && solid(x, y, z + 1) && solid(x, y, z - 1)) continue;
      n++; r += (v >> 16) & 255; g += (v >> 8) & 255; b += v & 255; if (v & EMIS) emis++;
    }
    if (!n) return false;
    const inv = 1 / n;
    return { box: [x0 * Q, y0 * Q, z0 * Q, (x1 + 1) * Q, (y1 + 1) * Q, (z1 + 1) * Q], col: to565(((r * inv) << 16) | ((g * inv) << 8) | (b * inv)), emis: emis > n * 0.5 };
  }
  function emitFar(M, x, y, z, lb, cull) {
    const bb = lb.box, far = M.far, layer = M.layerTile;
    for (let d = 0; d < 6; d++) {
      const ax = d >> 1, atEdge = (d & 1) ? bb[ax] <= 0 : bb[ax + 3] >= 32;
      if (atEdge && ((cull >> d) & 1)) continue;
      const pos = VR.MODEL.facePos(d, bb);
      const w = ax === 0 ? bb[5] - bb[2] : bb[3] - bb[0], h = ax === 1 ? bb[5] - bb[2] : bb[4] - bb[1];
      const uvs = [0, 0, 0, h, w, h, w, 0];
      const light = lightFor[d], w5 = d | (lb.emis ? 1 << 12 : 0);
      far.ensure(4);
      for (let k = 0; k < 4; k++) far.v(x + pos[k * 3] / 32, y + pos[k * 3 + 1] / 32, z + pos[k * 3 + 2] / 32, layer, uvs[k * 2] / 2, uvs[k * 2 + 1] / 2, w5, light, lb.col);
    }
  }

  // ---------------------------------------------------------------- mesher entry
  // M: { B, L, bufs, DOFF, layerTile, layerGloss, layerGlass, ox, oy, oz, far, detail }
  const lightFor = [0, 0, 0, 0, 0, 0];
  VX.meshBlock = function (M, x, y, z, bi, s) {
    init();
    const sp = specOf[s];
    if (!sp) return;
    const B = M.B, L = M.L, DOFF = M.DOFF;
    const lightNb = (d) => L[bi + DOFF[d]];
    const wx = M.ox + x, wy = M.oy + y, wz = M.oz + z;
    const extra = buildCtx(s, sp, B, bi, DOFF, L, wx, wy, wz);
    let cull = 0;
    for (let d = 0; d < 6; d++) {
      const ns = nbS[d];
      if (!ns) continue;
      if (T.shape[ns] === SH.VOXEL) { if ((fullMask[ns] >> OPP[d]) & 1) cull |= 1 << d; }
      else if (T.flags[ns] & F.OPAQUE) cull |= 1 << d;
    }
    if (sp.kind === 'roof') {
      // neighbouring straight roof pieces with the same slope share an identical profile → cull the joint
      const fa = ctx.facing, fu = F4D[fa], fdn = OPP[fu];
      const sides = (fa & 1) === 0 ? [0, 1] : [4, 5];
      const rfac = (ns) => specOf[ns] && specOf[ns].kind === 'roof' && !specOf[ns].ridge ? R.types[T.type[ns]].get(ns, 'facing') : -1;
      if (sp.ridge) {
        for (const d of sides) { const ns = nbS[d]; if (specOf[ns] && specOf[ns].kind === 'roof' && specOf[ns].ridge && ((R.types[T.type[ns]].get(ns, 'facing') & 1) === (fa & 1))) cull |= 1 << d; }
      } else if (ctx.shape === 0) {
        for (const d of sides) {
          const ns = nbS[d];
          if (rfac(ns) !== fa) continue;
          const nbi = bi + DOFF[d];
          const u2 = rfac(B[nbi + DOFF[fu]]), d2 = rfac(B[nbi + DOFF[fdn]]);
          if ((u2 >= 0 && (u2 & 1) !== (fa & 1)) || (d2 >= 0 && (d2 & 1) !== (fa & 1))) continue;
          cull |= 1 << d;
        }
      }
    }
    const c = ctx;
    let ncBits = 0;
    for (let d = 0; d < 6; d++) ncBits |= c.nc[d] << (d * 3);
    const varBits = c.px | (c.py << 1) | (c.pz << 2) | (c.h << 3);
    const key = ncBits + c.ext * 262144 + cull * 16777216 + varBits * 1073741824 + extra * 34359738368;
    let m = cache.get(s);
    if (!m) { m = new Map(); cache.set(s, m); }
    let quads = m.get(key);
    // lighting: faces take the light of the block they look into; faces looking into solid blocks
    // (window reveals, trims) use the brightest neighbour
    let aS = 0, aR = 0, aG = 0, aB = 0;
    for (let d = 0; d < 6; d++) { const l = lightNb(d); const q = l >>> 12; if (q > aS) aS = q; const r = (l >> 8) & 15, g = (l >> 4) & 15, b = l & 15; if (r > aR) aR = r; if (g > aG) aG = g; if (b > aB) aB = b; }
    const amb = (aS << 12) | (aR << 8) | (aG << 4) | aB;
    const own = L[bi];
    for (let d = 0; d < 6; d++) {
      const ns = nbS[d];
      const l = lightNb(d);
      if (ns && (T.flags[ns] & F.OPAQUE)) lightFor[d] = own || amb;
      else lightFor[d] = l || (ns ? amb : l);
    }
    // far-only sections (outside the detail radius) draw the averaged box and never build the fine quads:
    // the box comes from the cached quads when they exist, else straight from the painted voxels
    if (M.detail === false && M.far) {
      let lm = lodCache.get(s);
      if (!lm) { lm = new Map(); lodCache.set(s, lm); }
      let lb = lm.get(key);
      if (lb === undefined) {
        if (quads) lb = lodFromQuads(quads);
        else { paintState(s, c); lb = lodFromGrid(sp); }
        lm.set(key, lb);
        if (++lodN > 60000) { lodCache.clear(); lodN = 0; }
      }
      if (lb) emitFar(M, x, y, z, lb, cull);
      return;
    }
    if (!quads) {
      paintState(s, c);
      quads = sp.res >= 16 ? meshGridN(VX.gridFor(sp.res), sp.res, cull, cull) : meshGrid(cull, cull);
      m.set(key, quads);
      VX.stats.miss++;
      if (++cacheN > 40000) { cache.clear(); cacheN = 0; }
    } else VX.stats.hits++;
    if (!quads.length) return;
    // far LOD: the piece's bounding box in its average colour (one face per side instead of dozens of quads)
    if (M.far && quads.lod === undefined) quads.lod = lodFromQuads(quads);
    if (M.far && quads.lod) emitFar(M, x, y, z, quads.lod, cull);
    const bufs = M.bufs, smooth = sp.res >= 16;   // fine models get smooth lacquer surfaces instead of the bevel tile
    for (let q = 0; q < quads.length; q += RS) {
      const d = quads[q], col = quads[q + 1] & 0xffff, fl = quads[q + 2];
      const glass = (fl & 2) !== 0;
      const buf = glass ? bufs[2] : bufs[0];
      const matId = (fl >> 4) & 7;
      const matLayer = matId && M.layerMat ? M.layerMat[matId] : 0;
      // material quads: texture layer + upright rotation (bit 12) + world-scale variation (bit 15; not on metal)
      const layer = glass ? M.layerGlass : matLayer ? matLayer | ((fl & 128) ? 4096 : 0) | (matId !== 5 ? 32768 : 0) : (fl & 8) && M.layerHolo ? M.layerHolo : (fl & 4) ? (smooth && M.layerSmoothGloss ? M.layerSmoothGloss : M.layerGloss) : (smooth && M.layerSmooth ? M.layerSmooth : M.layerTile);
      const w5base = d | ((fl & 1) ? 1 << 12 : 0);
      const light = lightFor[d];
      buf.ensure(4);
      for (let k = 0; k < 4; k++) {
        const o = q + 3 + k * 6;
        buf.v(x + quads[o] / 32, y + quads[o + 1] / 32, z + quads[o + 2] / 32, layer, quads[o + 3], quads[o + 4], w5base | (quads[o + 5] << 3), light, col);
      }
    }
  };

  // ---------------------------------------------------------------- collision / selection boxes
  const bcache = new Map();
  const FULLB = [[0, 0, 0, 1, 1, 1]];
  const rotB = (b, q) => { let [x0, y0, z0, x1, y1, z1] = b; for (let r = 0; r < q; r++) { const nx0 = 1 - z1, nx1 = 1 - z0, nz0 = x0, nz1 = x1; x0 = nx0; x1 = nx1; z0 = nz0; z1 = nz1; } return [x0, y0, z0, x1, y1, z1]; };
  VX.boxes = function (s, sel) {
    init();
    const key = s * 2 + (sel ? 1 : 0);
    let b = bcache.get(key);
    if (b) return b;
    const sp = specOf[s], t = R.types[T.type[s]];
    const f = t.has('facing') ? t.get(s, 'facing') : 0;
    switch (sp.kind) {
      case 'roof': b = sp.ridge ? [[0, 0, 0, 1, 0.5, 1]] : [[0, 0, 0, 1, 0.5, 1], rotB([0, 0.5, 0, 1, 1, 0.5], f)]; break;
      case 'beam': { const a = t.has('axis') ? t.get(s, 'axis') : 0; b = a === 0 ? [[0.3, 0, 0.3, 0.7, 1, 0.7]] : a === 1 ? [[0, 0.375, 0.25, 1, 0.75, 0.75]] : [[0.25, 0.375, 0, 0.75, 0.75, 1]]; break; }
      case 'chimney': b = [[0.125, 0, 0.125, 0.875, 1, 0.875]]; break;
      case 'fence': b = sel ? [[0.3, 0, 0.3, 0.7, 1, 0.7]] : [[0.3, 0, 0.3, 0.7, 1.5, 0.7]]; break;
      case 'lamppost': b = [[0.3, 0, 0.3, 0.7, 1, 0.7]]; break;
      case 'windowbox': b = [rotB([0, 0.375, 0.625, 1, 0.75, 1], f)]; break;
      case 'planter': b = [[0, 0, 0, 1, 0.4, 1]]; break;
      case 'bed': b = [[0, 0, 0, 1, 0.5625, 1]]; break;
      case 'table': b = sel ? [[0, 0, 0, 1, 0.875, 1]] : [[0, 0.75, 0, 1, 0.875, 1], [0.1, 0, 0.1, 0.9, 0.75, 0.9]]; break;
      case 'chair': case 'bench': b = [[0.1, 0, 0.1, 0.9, 0.5, 0.9]]; break;
      case 'shelf': b = FULLB; break;
      case 'stove': case 'counter': b = [[0, 0, 0, 1, 0.875, 1]]; break;
      case 'rug': b = sel ? [[0, 0, 0, 1, 0.0625, 1]] : []; break;
      case 'lantern': b = [[0.25, 0, 0.25, 0.75, 0.75, 0.75]]; break;
      case 'floorlamp': b = [[0.2, 0, 0.2, 0.8, 1, 0.8]]; break;
      case 'barrel': b = [[0.06, 0, 0.06, 0.94, 1, 0.94]]; break;
      case 'potplant': b = [[0.25, 0, 0.25, 0.75, 0.8, 0.75]]; break;
      case 'awning': b = sel ? [rotB([0, 0.3, 0, 1, 1, 1], f)] : []; break;
      case 'sign': b = sel ? [rotB([0.1, 0.25, 0, 0.9, 1, 1], f)] : []; break;
      case 'solar': b = [[0, 0, 0, 1, 0.9, 1]]; break;
      case 'dish': case 'crystal': b = [[0.1, 0, 0.1, 0.9, 1, 0.9]]; break;
      case 'well': b = [[0, 0, 0, 1, 0.625, 1]]; break;
      default: b = VX.boxHook[sp.kind] ? VX.boxHook[sp.kind](s, sel, t, f, sp) : FULLB;
    }
    // walk-through decorations (LED strips, pictures, pendant lamps, curtains, wall shelves …) have no collision box,
    // but they can be pointed at — the box around their voxels — so they can be picked, broken and found (v0.37)
    if (sel && (!b || !b.length)) b = voxBox(s) || [];
    bcache.set(key, b);
    return b;
  };
  function voxBox(s) {
    let G = null; try { G = VX.iconGrid(s); } catch (e) { G = null; }
    if (!G || !G.length) return null;
    const n = Math.round(Math.cbrt(G.length)); let x0 = n, y0 = n, z0 = n, x1 = -1, y1 = -1, z1 = -1;
    for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) if (G[(y * n + z) * n + x] & PRESENT) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (z < z0) z0 = z; if (x > x1) x1 = x; if (y > y1) y1 = y; if (z > z1) z1 = z; }
    return x1 < 0 ? null : [[x0 / n, y0 / n, z0 / n, (x1 + 1) / n, (y1 + 1) / n, (z1 + 1) / n]];
  }

  // ---------------------------------------------------------------- icon voxels (inventory previews)
  VX.iconGrid = function (s) {
    init();
    const c = neutralCtx();
    for (let d = 0; d < 6; d++) c.nc[d] = AIR;
    c.nc[3] = SOLID; c.ext = 0b110011;
    fillCtxFromState(c, s);
    const sp = specOf[s];
    if (!sp) return null;
    if (sp.kind === 'window') { c.borderSpec = WALL_DEFAULT; c.nc[0] = c.nc[1] = c.nc[4] = c.nc[5] = AIR; }
    if (sp.kind === 'roof') { c.eave = 1; c.sideA = 1; c.sideB = 1; c.ridgeTop = 1; c.facing = 2; }
    if (sp.kind === 'fence') c.x = 0b0101;
    if (sp.kind === 'lamppost') c.head = 1;
    if (sp.kind === 'bed') { c.facing = 1; c.part = 0; }
    if (['chair', 'bench', 'shelf', 'stove', 'counter', 'sign', 'solar'].indexOf(sp.kind) >= 0) c.facing = 2;
    if (sp.kind === 'windowbox' || sp.kind === 'awning') c.facing = 0;
    if (VX.iconHook[sp.kind]) VX.iconHook[sp.kind](c, sp, s);
    if (sp.res >= 16 && VX.icon16) return VX.icon16(sp, s);
    paintState(s, c);
    return G.slice();
  };
  VX.faceColor = function (s) { init(); const sp = specOf[s]; return sp ? (sp.col || C.stone) : C.stone; };

  // ---------------------------------------------------------------- block definitions
  // called from blocks4.js right before R.finalize()
  VX.define = function (def, T, G_, F_) {
    const T_ = T;
    const tile = T_('vx_tile'); T_('vx_tile_gloss'); T_('vx_glass'); T_('vx_holo'); T_('vx_smooth'); T_('vx_smooth_gloss'); for (const m of ['fabric', 'leather', 'wood', 'marble', 'metal', 'plant', 'stone']) T_('vx_mat_' + m);
    void tile;
    const hex = (c) => ('000000' + (c >>> 0).toString(16)).slice(-6);
    const texFor = (col) => T_('vxcol:' + hex(col));
    const base = (o) => Object.assign({ cat: 'arch', group: G_.ARCH || G_.BUILD || 'building', shape: 'voxel', sound: 'stone', hard: 1.5, blast: 6, solid: true }, o);
    const add = (name, display, vx, o) => def(name, base(Object.assign({ display, vx, tex: texFor(vx.col || 0x999999) }, o || {})));
    const FACING4 = ['facing', ['north', 'east', 'south', 'west']];
    const wall = (name, display, sp, o) => add(name, display, Object.assign({ kind: 'wall' }, sp), Object.assign({ opaque: true, filter: 15 }, o || {}));
    // ---- walls
    for (const k in PLASTER) {
      wall('vx_plaster_' + k, cap(k) + ' Plaster Wall', { pat: 'plaster', col: PLASTER[k], trim: C.oakD, plinth: 0x9A968C, band: true, corner: 0, lintel: C.oakD, jamb: C.oakD }, { sound: 'stone' });
    }
    for (const k of ['white', 'cream', 'butter', 'rose']) wall('vx_timber_' + k, cap(k) + ' Timber Frame', { pat: 'timber', col: PLASTER[k], col2: C.dark, trim: C.dark, plinth: 0x8E8A80, band: true, corner: C.dark, lintel: C.dark, jamb: C.dark }, { sound: 'wood' });
    for (const k in PAINT) wall('vx_siding_' + k, cap(k) + ' Wood Siding', { pat: 'siding', col: PAINT[k], trim: 0xF2F0EA, plinth: 0x8E8A80, band: true, corner: 0xF2F0EA, lintel: 0xF2F0EA, jamb: 0xF2F0EA }, { sound: 'wood', hard: 1 });
    wall('vx_logwall', 'Log Cabin Wall', { pat: 'logs', col: 0x8A5E36, trim: C.dark, corner: 0x6A4A2A, band: false, plinth: 0x7A7870 }, { sound: 'wood', hard: 1 });
    wall('vx_planks', 'Oak Board Wall', { pat: 'planks', col: C.oak, trim: C.oakD, band: true, corner: C.oakD, plinth: 0x8E8A80 }, { sound: 'wood', hard: 1 });
    wall('vx_darkwood', 'Dark Batten Wall', { pat: 'batten', col: 0x5A3F2A, trim: 0x3A281A, band: true, corner: 0x3A281A, plinth: 0x6E6C66 }, { sound: 'wood', hard: 1 });
    wall('vx_stonebrick', 'Stone Brick Wall', { pat: 'bricks', col: 0x9C9A94, col2: 0x6A6862, trim: 0x7E7C76, corner: 0xB0AEA6, quoin: true }, { hard: 2 });
    wall('vx_fieldstone', 'Fieldstone Wall', { pat: 'fieldstone', col: 0x9A968C, col2: 0x5E5C58, trim: 0x7A776E }, { hard: 2 });
    wall('vx_sandstone', 'Carved Sandstone Wall', { pat: 'sandstone', col: 0xE2C995, trim: 0xC8A870, band: true, cap: 0xD2B47E, corner: 0xD8BC84 }, { hard: 1.2 });
    wall('vx_adobe', 'Adobe Wall', { pat: 'adobe', col: 0xD9A06C, trim: 0x8A5A32, band: false, cap: 0xC88E5C, plinth: 0xB07A4A }, { hard: 1.2 });
    wall('vx_redbrick', 'Red Brick Wall', { pat: 'bricks', col: 0xA84E3A, col2: 0xD6CCBC, flushMortar: true, trim: 0x8A3E2E, corner: 0xC8BCA8, quoin: true }, { hard: 2 });
    wall('vx_hull_white', 'Hull Panel Wall', { pat: 'hull', col: C.hull, col2: 0x7A808A, stripe: true, lights: true, trim: 0xB8BEC8, band: true, corner: 0xB8BEC8 }, { hard: 3, sound: 'metal' });
    wall('vx_hull_dark', 'Dark Hull Wall', { pat: 'hull', col: 0x3E444E, col2: C.cyan, glowSeam: true, lights: true, lightCol: 0xFF7A1A, trim: 0x2A2E36, band: true, corner: 0x2A2E36 }, { hard: 3, sound: 'metal' });
    wall('vx_crystal_wall', 'Prism Crystal Wall', { pat: 'crystal', col: 0xF4F0FF, trim: 0xDCD4F4, band: true, corner: 0xE4DCFA }, { hard: 2.5, sound: 'glass', light: [3, 1, 5] });
    // ---- windows (take on the material of the wall around them)
    const win = (name, display, sp, o) => add(name, display, Object.assign({ kind: 'window', col: 0xBFE6FF }, sp), Object.assign({ props: [FACING4], filter: 0, layer: 'opaque', sound: 'glass', hard: 1 }, o || {}));
    win('vx_window', 'Cottage Window', { frame: 0xF4F2EC, mullion: true, sill: 0xF4F2EC });
    win('vx_window_wood', 'Wooden Window', { frame: C.oakD, mullion: true, sill: C.oak });
    win('vx_window_arch', 'Arched Window', { frame: 0xF4F2EC, style: 'arch', sill: 0xE8E0D0 });
    win('vx_window_round', 'Porthole Window', { frame: 0xB8BEC8, style: 'round', sill: 0xB8BEC8, frameFlags: GLOSS });
    const SHN = { green: 1, blue: 2, red: 3, teal: 5, yellow: 6, violet: 7 };
    for (const k in SHN) win('vx_window_shutter_' + k, cap(k) + ' Shuttered Window', { frame: 0xF4F2EC, mullion: true, sill: 0xF4F2EC, shutter: SHN[k] });
    win('vx_window_glow', 'Glowing Viewport', { frame: 0x3E444E, style: 'round', glow: C.cyan, glassCol: 0x8AD8FF, sill: 0x3E444E }, { light: [2, 8, 12] });
    // ---- roofs
    for (const k in ROOFC) {
      const sp = { kind: 'roof', col: ROOFC[k], trim: k === 'white' ? 0x9AA2AE : (k === 'thatch' ? 0xA88A40 : 0x4A3222), tiles: k !== 'thatch' && k !== 'white', moss: k === 'shingle' || k === 'slate', course: k === 'thatch' ? 0.9 : 0.84, flags: k === 'white' || k === 'gold' || k === 'teal' || k === 'violet' ? GLOSS : 0 };
      add('vx_roof_' + k, cap(k) + ' Roof', sp, { props: [FACING4], filter: 15, kind: 'vxroof', sound: k === 'thatch' ? 'grass' : 'stone', hard: 1 });
      add('vx_ridge_' + k, cap(k) + ' Roof Ridge', Object.assign({}, sp, { ridge: true, ridgeCol: sh(sp.trim, 1.1) }), { props: [FACING4], filter: 15, sound: 'stone', hard: 1 });
      // low-pitch hip roof (22°, the Stadtvilla roof): two pieces per cell pair — lower half-slope and upper half-slope
      if (k === 'slate' || k === 'terracotta' || k === 'red' || k === 'shingle' || k === 'white') add('vx_hip_' + k, cap(k) + ' Low Hip Roof', Object.assign({}, sp, { low: true, trim: k === 'slate' ? 0x2A2D33 : sp.trim }), { props: [FACING4, ['part', ['lower', 'upper', 'lower_l', 'upper_l', 'lower_r', 'upper_r', 'lower_vl', 'upper_vl', 'lower_vr', 'upper_vr']]], filter: 15, kind: 'vxroof', sound: 'stone', hard: 1 });
    }
    // ---- floors
    const floor = (name, display, sp) => add(name, display, Object.assign({ kind: 'floor', side: 0x8E8C86 }, sp), { opaque: true, filter: 15, sound: sp.pat === 'planks' ? 'wood' : 'stone' });
    floor('vx_floor_oak', 'Oak Floorboards', { pat: 'planks', col: 0xB8884E });
    floor('vx_floor_spruce', 'Spruce Floorboards', { pat: 'planks', col: 0x7A5434 });
    floor('vx_floor_tile', 'Terracotta Tiles', { pat: 'tiles', col: 0xC8744A, col2: 0xE8D8C0 });
    floor('vx_floor_checker', 'Checker Tiles', { pat: 'checker', col: 0xF2EEE6, col2: 0x3A3A44 });
    floor('vx_floor_stone', 'Flagstone Floor', { pat: 'stone', col: 0xA8A69E, col2: 0x6E6C66 });
    floor('vx_floor_metal', 'Deck Plating', { pat: 'metal', col: 0x9AA0AA, col2: 0x5A606A });
    floor('vx_floor_marble', 'Prism Marble', { pat: 'marble', col: 0xF4F0FA, col2: 0xB090F0 });
    // ---- structure
    add('vx_beam_oak', 'Oak Beam', { kind: 'beam', col: 0x8A5E32 }, { props: [['axis', ['y', 'x', 'z']]], sound: 'wood', filter: 0 });
    add('vx_beam_dark', 'Dark Beam', { kind: 'beam', col: 0x4A3222 }, { props: [['axis', ['y', 'x', 'z']]], sound: 'wood', filter: 0 });
    add('vx_beam_white', 'White Column', { kind: 'beam', col: 0xF0EEE8 }, { props: [['axis', ['y', 'x', 'z']]], filter: 0 });
    add('vx_chimney', 'Brick Chimney', { kind: 'chimney', col: 0xA84E3A, col2: 0x6A4E44 }, { filter: 15, hard: 2 });
    add('vx_chimney_stone', 'Stone Chimney', { kind: 'chimney', col: 0x9C9A94, col2: 0x5E5C58 }, { filter: 15, hard: 2 });
    add('vx_fence_white', 'White Picket Fence', { kind: 'fence', col: 0xF2F0EA }, { sound: 'wood', filter: 0, hard: 1 });
    add('vx_fence_wood', 'Rustic Picket Fence', { kind: 'fence', col: 0x9A6A3A }, { sound: 'wood', filter: 0, hard: 1 });
    add('vx_lamppost', 'Street Lamp', { kind: 'lamppost', col: C.iron, post: C.iron, glow: C.warm }, { props: [['head', 2]], defaultIndex: 1, light: (p) => p.head ? [15, 12, 6] : null, filter: 0, sound: 'metal' });
    add('vx_lamppost_crystal', 'Crystal Street Lamp', { kind: 'lamppost', col: 0xE8E4F4, post: 0xE8E4F4, glow: 0xC08AFF, crystal: true }, { props: [['head', 2]], defaultIndex: 1, light: (p) => p.head ? [10, 5, 15] : null, filter: 0, sound: 'glass' });
    add('vx_windowbox', 'Flower Window Box', { kind: 'windowbox', col: 0xF2F0EA }, { props: [FACING4], filter: 0, sound: 'wood', hard: 0.5 });
    add('vx_windowbox_wood', 'Rustic Window Box', { kind: 'windowbox', col: 0x8A5E32 }, { props: [FACING4], filter: 0, sound: 'wood', hard: 0.5 });
    add('vx_planter', 'Flower Bed', { kind: 'planter', col: 0x8A5E32 }, { filter: 0, sound: 'grass', hard: 0.5 });
    // ---- furniture
    const BEDC = { red: 0xC0443A, blue: 0x3F6AC0, green: 0x4E9A56, yellow: 0xE8B83A, purple: 0x8A5AC8, pink: 0xF08FB0, white: 0xECEAE4, teal: 0x2F9C98 };
    for (const k in BEDC) add('vx_bed_' + k, 'Cozy ' + cap(k) + ' Bed', { kind: 'bed', col: BEDC[k] }, { props: [FACING4, ['part', ['foot', 'head']]], kind: 'bed', flags: F_.INTERACT, filter: 0, sound: 'wool', hard: 0.3, height: 9 });
    add('vx_table', 'Wooden Table', { kind: 'table', col: 0xA87A48 }, { filter: 0, sound: 'wood', hard: 1 });
    add('vx_chair', 'Wooden Chair', { kind: 'chair', col: 0x9A6A3A, cushion: 0xC0443A }, { props: [FACING4], filter: 0, sound: 'wood', hard: 1 });
    add('vx_bench', 'Park Bench', { kind: 'bench', col: 0xA87A48 }, { props: [FACING4], filter: 0, sound: 'wood', hard: 1 });
    add('vx_shelf', 'Bookshelf Nook', { kind: 'shelf', col: 0x8A5E32 }, { props: [FACING4], filter: 0, sound: 'wood', hard: 1 });
    add('vx_stove', 'Cast Iron Stove', { kind: 'stove', col: 0x4A4E58 }, { props: [FACING4], filter: 0, light: [12, 6, 2], sound: 'metal', hard: 2 });
    add('vx_counter', 'Kitchen Counter', { kind: 'counter', col: 0xB08A5A, top: 0xD8D2C4 }, { props: [FACING4], filter: 0, sound: 'wood', hard: 1 });
    const RUGC = { red: [0xB84A3A, 0x6A2A22], blue: [0x3F63A8, 0x22345A], green: [0x4E7F46, 0x2A4A26], sand: [0xD8B87A, 0x8A6A3A] };
    for (const k in RUGC) add('vx_rug_' + k, cap(k) + ' Rug', { kind: 'rug', col: RUGC[k][0], col2: RUGC[k][1] }, { filter: 0, solid: false, sound: 'wool', hard: 0.2 });
    add('vx_lantern', 'Hanging Lantern', { kind: 'lantern', col: C.iron }, { filter: 0, light: [15, 11, 5], sound: 'metal', hard: 0.5 });
    add('vx_lantern_crystal', 'Crystal Lantern', { kind: 'lantern', col: C.iron, glow: 0xC08AFF }, { filter: 0, light: [10, 5, 15], sound: 'glass', hard: 0.5 });
    add('vx_floorlamp', 'Floor Lamp', { kind: 'floorlamp', col: 0xE8D8B0 }, { filter: 0, light: [14, 11, 6], sound: 'wood', hard: 0.5 });
    add('vx_crate', 'Supply Crate', { kind: 'crate', col: 0xB08A5A }, { sound: 'wood', hard: 1 });
    add('vx_cargo', 'Cargo Container', { kind: 'crate', col: 0xE06A2A, label: 0xF2F2EC }, { sound: 'metal', hard: 2 });
    add('vx_barrel', 'Oak Barrel', { kind: 'barrel', col: 0x9A6A3A }, { sound: 'wood', hard: 1 });
    add('vx_potplant', 'Potted Plant', { kind: 'potplant', col: 0xC06A3A }, { filter: 0, sound: 'grass', hard: 0.3 });
    add('vx_hay', 'Hay Bale', { kind: 'hay', col: 0xD8B048 }, { sound: 'grass', hard: 0.5 });
    // ---- civic & sci-fi
    const AWC = { red: [0xE04A3A, 0xF4F0E8], blue: [0x3F7AD0, 0xF4F0E8], green: [0x4E9A56, 0xF4F0E8], yellow: [0xF0C040, 0xF4F0E8] };
    for (const k in AWC) add('vx_awning_' + k, cap(k) + ' Awning', { kind: 'awning', col: AWC[k][0], col2: AWC[k][1] }, { props: [FACING4], filter: 0, solid: false, sound: 'wool', hard: 0.3 });
    add('vx_sign', 'Hanging Sign', { kind: 'sign', col: 0xA87A48 }, { props: [FACING4, ['icon', 8]], filter: 0, solid: false, sound: 'wood', hard: 0.5 });
    add('vx_solar', 'Solar Panel', { kind: 'solar', col: 0x203A78 }, { props: [FACING4], filter: 0, sound: 'metal', hard: 1.5 });
    add('vx_dish', 'Comm Dish', { kind: 'dish', col: C.hull }, { filter: 0, sound: 'metal', hard: 1.5 });
    const CRC = { violet: [0xB070FF, [10, 4, 15]], azure: [0x4AC8FF, [3, 10, 15]], rose: [0xFF6AB0, [15, 5, 10]] };
    for (const k in CRC) add('vx_crystal_' + k, cap(k) + ' Crystal Lamp', { kind: 'crystal', col: CRC[k][0] }, { filter: 0, light: CRC[k][1], sound: 'glass', hard: 1 });
    add('vx_well', 'Stone Well', { kind: 'well', col: C.stone }, { filter: 0, hard: 2 });
    for (const f of VX.defineExtra) f({ def, add, wall, floor, T: T_, G: G_, F: F_, FACING4, cap, texFor });
  };
  function cap(s) { return s.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' '); }
  // painting kit for extensions (voxtech.js)
  VX._ = { G, I, put, del, get, box, clearBox, fput, fdel, fget, rotateGrid, PAINT_FN, exposed, SIDE, HFACES, NX, NY, NZ, OPP, F4D, C, sh, mix, hh, flowers, rotB, FULLB, PAT,
    setP: (a, b, fa, fb) => { P0 = a; P1 = b; PF0 = fa || 0; PF1 = fb || 0; }, clsOf: (s) => { init(); return clsOf[s]; }, specOf: (s) => { init(); return specOf[s]; } };
})(VR);
