// ============================================================================
// Village Life & Supermarket: two more builder's kits of context-aware 8×8×8
// mini-voxel pieces (VX). Fruit-tree crowns melt into one round canopy, troughs,
// laundry lines and flower beds run on in rows, a 3×3 of windmill sail blocks
// draws one big four-bladed sail, barn door blocks become one big door. In the
// supermarket, shelves and fridges join into long gondolas and stack into tall
// units (header band on top, kick plate at the bottom), checkouts hand their
// belt on to the bagging end, ceiling light strips link up, the store sign
// spells its name across the row, and the sliding doors open (`open` prop).
// ============================================================================
(function (VR) {
  'use strict';
  const VX = VR.VX;
  if (!VX || !VX._) return;
  const { G, I, put, box, rotateGrid, PAINT_FN, sh, mix, hh, rotB, FULLB } = VX._;
  const { EMIS, GLASS, GLOSS, PRESENT } = VX;
  const { AIR, SOLID, WALL, ROOF, FLOOR, DOOR, OTHER } = VX.CLS;
  const KIND = VX.KIND;
  // local (north-facing) axes → world face directions for a facing q
  const LXP = [0, 4, 1, 5], LXM = [1, 5, 0, 4];

  // ---------------------------------------------------------------- helpers
  const specOf = (ns) => (ns ? VX._.specOf(ns) : null);
  const typeOf = (ns) => { const R = VR.R; return ns ? R.types[R.T.type[ns]] : null; };
  const propOf = (ns, p) => { const t = typeOf(ns); return t && t.has(p) ? t.get(ns, p) : -1; };
  const kindIs = (ns, ks) => { const o = specOf(ns); return !!o && ks.indexOf(o.kind) >= 0; };
  const seedOf = (c) => c.h + c.px * 4 + c.py * 8 + c.pz * 16;
  // neighbour ns joins state s: kind in ks, same facing (or same axis for front/back-symmetric pieces)
  const joins = (ns, s, sp, ks, axis, style) => {
    const o = specOf(ns);
    if (!o || ks.indexOf(o.kind) < 0) return false;
    if (style && o.style !== sp.style) return false;
    const a = propOf(ns, 'facing'), b = propOf(s, 'facing');
    return axis ? ((a ^ b) & 1) === 0 : a === b;
  };
  // in-plane row mask: bit0 local +x, bit1 local -x, bit2 up, bit3 down
  const rowHook = (o) => { o = o || {}; return (c, sp, s, nbS) => {
    const ks = o.kinds || [sp.kind], q = c.facing & 3, J = (d) => joins(nbS[d], s, sp, ks, o.axis, o.style);
    return (J(LXP[q]) ? 1 : 0) | (J(LXM[q]) ? 2 : 0) | (o.vert && J(2) ? 4 : 0) | (o.vert && J(3) ? 8 : 0);
  }; };
  // horizontal mask (unrotated): bit0 +x, bit1 -x, bit2 +z, bit3 -z
  const flatHook = (ks) => (c, sp, s, nbS) => (kindIs(nbS[0], ks || [sp.kind]) ? 1 : 0) | (kindIs(nbS[1], ks || [sp.kind]) ? 2 : 0) | (kindIs(nbS[4], ks || [sp.kind]) ? 4 : 0) | (kindIs(nbS[5], ks || [sp.kind]) ? 8 : 0);
  // fully enclosed (only happens for the neutral full-face probe in VX.init): paint as joined on every side so
  // row/stack pieces don't claim full side faces (neighbours would cull faces we leave open at a join)
  const enclosed = (c) => c.nc[0] === SOLID && c.nc[1] === SOLID && c.nc[2] === SOLID && c.nc[3] === SOLID && c.nc[4] === SOLID && c.nc[5] === SOLID;
  function mirrorX() { const t = G.slice(); for (let y = 0; y < 8; y++) for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) G[I(x, y, z)] = t[I(7 - x, y, z)]; }
  // disc of voxels in the xz plane
  function disc(cx, cz, r, y0, y1, col, f) { for (let y = y0; y <= y1; y++) for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) <= r) put(x, y, z, typeof col === 'function' ? col(x, y, z) : col, f); }
  // pixel rows (top row first, 'X' set) → cb(col, row)
  function pix(rows, cb) { for (let r = 0; r < rows.length; r++) for (let k = 0; k < rows[r].length; k++) if (rows[r][k] !== '.') cb(k, r, rows[r][k]); }

  // ---------------------------------------------------------------- palettes
  const WD = { oak: 0xA8783E, oakL: 0xC49258, oakD: 0x7A5230, dark: 0x5A3E28, iron: 0x3A3D44, steel: 0xB8C0C8, steelD: 0x8A949E, straw: 0xE2C063, strawD: 0xC49A3A, soil: 0x5E4028, soilD: 0x46301F, water: 0x4A9ADE, leaf: 0x4E9A3A, leafD: 0x2F6A28, kraft: 0xC89E6A };
  const FLOWERC = [0xE8403A, 0xF6D23A, 0xF08FB0, 0x6A7AF0, 0xFFFFFF, 0xB070FF, 0xFF8A2A, 0xFF5A8A];

  // ================================================================= VILLAGE LIFE
  // FRUIT TREE CROWN: neighbouring crowns (any fruit) merge into one canopy; only exposed sides round off
  const CROWN = {
    apple: { l: [0x4E9E3A, 0x5AAE42, 0x438E34, 0x68BC48], d: 0x2E6A26, f: [0xD8342A, 0xE84A36, 0xC42A22, 0xE8C040], n: 6 },
    orange: { l: [0x2E7E36, 0x38903E, 0x2A7432, 0x46A24A], d: 0x1E5A24, f: [0xFF8A1A, 0xFFA02E, 0xF27812], n: 6 },
    cherry: { l: [0xF7B2CE, 0xFAC6DA, 0xEF9CC0, 0xFDE0EC], d: 0xD884AA, f: [0xFFFFFF, 0xC8284A, 0x7AB84A, 0xFFFFFF], n: 7 },
    plum: { l: [0x4A8E3A, 0x56A044, 0x40823A, 0x62AE4C], d: 0x2A5E26, f: [0x6A2A7E, 0x7E3A92, 0x582070], n: 6 },
  };
  PAINT_FN.fcrown = function (s, c) {
    G.fill(0);
    const P = CROWN[s.fruit] || CROWN.apple, m = c.x, sd = seedOf(c) * 13 + 7;
    const ex = [0, 0, 0, 0, 0, 0];
    for (let d = 0; d < 6; d++) { const n = c.nc[d]; ex[d] = ((m >> d) & 1) || n === SOLID || n === WALL || n === FLOOR || n === ROOF ? 0 : 1; }
    const R0 = 5.0;
    for (let y = 0; y < 8; y++) for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
      const fx = x + 0.5, fy = y + 0.5, fz = z + 0.5;
      const dx = Math.max(ex[1] ? R0 - fx : 0, ex[0] ? R0 - (8 - fx) : 0, 0);
      const dy = Math.max(ex[3] ? R0 - fy : 0, ex[2] ? R0 - (8 - fy) : 0, 0);
      const dz = Math.max(ex[5] ? R0 - fz : 0, ex[4] ? R0 - (8 - fz) : 0, 0);
      const d = Math.hypot(dx, dy, dz);
      const seam = (x === 0 && !ex[1]) || (x === 7 && !ex[0]) || (y === 0 && !ex[3]) || (y === 7 && !ex[2]) || (z === 0 && !ex[5]) || (z === 7 && !ex[4]);
      const round = (dx > 0) + (dy > 0) + (dz > 0) >= 2;
      if (d > R0 - 0.4 + (round && !seam ? ((hh(x, y, z, sd) & 7) - 3.5) * 0.14 : 0)) continue;
      put(x, y, z, 1);
    }
    if (ex[3] && c.nc[3] === OTHER) box(3, 0, 3, 4, 1, 4, 1); // sits on a trunk: keep the underside closed over it
    // is a cell open (air inside the block, or an exposed side outside it)?
    const open = (x, y, z) => {
      if (x < 0) return ex[1]; if (x > 7) return ex[0]; if (y < 0) return ex[3]; if (y > 7) return ex[2]; if (z < 0) return ex[5]; if (z > 7) return ex[4];
      return !(G[I(x, y, z)] & PRESENT);
    };
    const onSeam = (x, y, z) => (x === 0 && !ex[1]) || (x === 7 && !ex[0]) || (y === 0 && !ex[3]) || (y === 7 && !ex[2]) || (z === 0 && !ex[5]) || (z === 7 && !ex[4]);
    const surf = [];
    for (let y = 0; y < 8; y++) for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
      if (!(G[I(x, y, z)] & PRESENT)) continue;
      if (open(x + 1, y, z) || open(x - 1, y, z) || open(x, y + 1, z) || open(x, y - 1, z) || open(x, y, z + 1) || open(x, y, z - 1)) surf.push(x, y, z);
    }
    // leafy dimples on the outer surface (never on a seam toward another crown)
    for (let i = 0; i < surf.length; i += 3) { const x = surf[i], y = surf[i + 1], z = surf[i + 2]; if (!onSeam(x, y, z) && y > 0 && (hh(x, y, z, sd + 5) % 5) === 0) G[I(x, y, z)] = 0; }
    for (let y = 0; y < 8; y++) for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
      const v = G[I(x, y, z)];
      if (!(v & PRESENT)) continue;
      const q = hh(x >> 1, (y + c.py * 8) >> 1, z >> 1, sd + 11);
      let col = P.l[q & 3];
      if (open(x, y + 1, z)) col = sh(col, 1.1);
      else if (open(x, y - 1, z) && ex[3]) col = mix(col, P.d, 0.55);
      G[I(x, y, z)] = (col | PRESENT) >>> 0;
    }
    // fruit (or blossom) dots on the visible surface
    for (let y = 0; y < 8; y++) for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
      if (!(G[I(x, y, z)] & PRESENT)) continue;
      const vis = open(x + 1, y, z) || open(x - 1, y, z) || open(x, y + 1, z) || open(x, y - 1, z) || open(x, y, z + 1) || open(x, y, z - 1);
      if (!vis) continue;
      const q = hh(x, y, z, sd + 23);
      if (q % P.n === 0) put(x, y, z, P.f[(q >>> 8) % P.f.length]);
    }
  };

  // FRUIT TREE TRUNK: flared roots on the ground, branches reaching into a crown above
  PAINT_FN.ftrunk = function (s, c) {
    G.fill(0);
    const dnT = c.x & 1, upC = (c.x >> 1) & 1, sd = seedOf(c);
    const bark = s.col, bD = sh(bark, 0.74), bL = sh(bark, 1.16);
    const col = (x, y, z) => { const q = hh(x, y + c.py * 8, z, 5) & 7; return q < 2 ? bD : q === 2 ? bL : bark; };
    box(3, 0, 3, 4, 7, 4, col);
    // gnarls
    for (let y = 0; y < 8; y++) {
      const q = hh(y, c.py, sd, 9);
      if ((q & 3) !== 0) continue;
      const o = 3 + ((q >> 4) & 1), p = [[2, o], [5, o], [o, 2], [o, 5]][(q >> 2) & 3];
      put(p[0], y, p[1], bD);
    }
    if (!dnT) {
      box(2, 0, 2, 5, 1, 5, col); del4(2, 1, 2); del4(2, 1, 5); del4(5, 1, 2); del4(5, 1, 5);
      for (const [x, z] of [[1, 3], [1, 4], [6, 3], [6, 4], [3, 1], [4, 1], [3, 6], [4, 6]]) put(x, 0, z, bD);
      for (const [x, z] of [[0, 4], [7, 3], [3, 7], [4, 0]]) if (hh(x, z, sd, 3) & 1) put(x, 0, z, sh(bD, 0.9));
      for (const [x, z] of [[1, 1], [6, 6], [1, 6], [6, 1]]) if (hh(x, z, sd, 4) & 1) put(x, 0, z, 0x5AA03A);
    }
    if (upC) {
      const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
      const skip = sd & 3;
      for (let k = 0; k < 4; k++) {
        if (k === skip && (sd & 4)) continue;
        const [dx, dz] = corners[k];
        const bx = dx < 0 ? 3 : 4, bz = dz < 0 ? 3 : 4;
        put(bx + dx, 5, bz + dz, bark); put(bx + dx * 2, 6, bz + dz * 2, bD); put(bx + dx * 3, 7, bz + dz * 3, bark);
        put(bx + dx * 2, 7, bz + dz * 2, bL);
      }
    }
    function del4(x, y, z) { G[I(x, y, z)] = 0; }
  };

  // WATER TROUGH: planked trough on trestles; rows join into one long trough
  PAINT_FN.trough = function (s, c) {
    G.fill(0);
    const R_ = c.x & 1, L_ = (c.x >> 1) & 1;
    const w = s.col, wD = sh(w, 0.74), wL = sh(w, 1.14);
    const xa = L_ ? 0 : 1, xb = R_ ? 7 : 6;
    const plank = (x, y) => y === 5 ? wL : (((y >> 1) + (x >> 2)) & 1) ? w : sh(w, 0.9);
    // trestle legs at the ends
    for (const [ok, x] of [[!L_, 1], [!R_, 6]]) if (ok) { box(x, 0, 0, x, 1, 1, wD); box(x, 0, 6, x, 1, 7, wD); box(x, 1, 1, x, 1, 6, wD); }
    box(xa, 2, 1, xb, 2, 6, wD);                    // bottom boards
    box(xa, 2, 1, xb, 5, 1, plank); box(xa, 2, 6, xb, 5, 6, plank); // long sides
    if (!L_) box(1, 2, 1, 1, 5, 6, plank);
    if (!R_) box(6, 2, 1, 6, 5, 6, plank);
    // iron bands
    for (const x of [2, 5]) if (x >= xa && x <= xb) { box(x, 2, 1, x, 5, 1, WD.iron); box(x, 2, 6, x, 5, 6, WD.iron); put(x, 5, 1, 0x55585F); put(x, 5, 6, 0x55585F); }
    // water, a little lighter toward the middle
    for (let x = Math.max(xa, L_ ? 0 : 2); x <= Math.min(xb, R_ ? 7 : 5); x++) for (let z = 2; z <= 5; z++) put(x, 4, z, (z === 3 || z === 4) && ((x + c.px * 8) % 5 === 2) ? 0x8AC8F0 : WD.water, GLOSS);
    box(Math.max(xa, L_ ? 0 : 2), 3, 2, Math.min(xb, R_ ? 7 : 5), 3, 5, 0x2E6AA8);
    rotateGrid(c.facing);
  };

  // SCARECROW: post, denim trousers, plaid shirt with straw hands, burlap head and a straw hat
  PAINT_FN.scarecrow = function (s, c) {
    G.fill(0);
    const sd = seedOf(c);
    const shirtA = [0xC8402E, 0x3E7AC0, 0x4E9A48, 0xD88A2A][sd & 3], shirtB = sh(shirtA, 0.72);
    const plaid = (x, y, z) => ((x + y) & 1) ? shirtA : ((x & 1) ? shirtB : sh(shirtA, 1.12));
    const denim = 0x3A5A98, straw = WD.straw, burlap = 0xD8BE88, hat = 0xE0B85A;
    box(3, 0, 3, 4, 3, 4, WD.oakD);                        // post
    box(2, 1, 3, 3, 2, 4, denim); box(4, 1, 3, 5, 2, 4, denim); // trouser legs
    put(3, 1, 3, WD.oakD); put(4, 1, 3, WD.oakD); put(3, 1, 4, WD.oakD); put(4, 1, 4, WD.oakD);
    put(2, 0, 3, straw); put(5, 0, 4, straw); put(2, 0, 4, WD.strawD); put(5, 0, 3, WD.strawD);
    box(2, 3, 2, 5, 4, 5, plaid);                           // torso
    box(0, 4, 3, 7, 4, 4, plaid);                           // arms on the crossbar
    put(4, 3, 2, 0x6A4A2A); put(3, 3, 2, sh(shirtB, 0.8)); // belt buckle-ish
    box(0, 3, 3, 0, 3, 4, straw); box(7, 3, 3, 7, 3, 4, straw); put(0, 2, 3, WD.strawD); put(7, 2, 4, WD.strawD); // straw hands
    put(4, 4, 2, 0xE8C040);                                 // patch
    box(2, 5, 2, 5, 6, 5, (x, y, z) => ((x + z + y) % 3 === 0) ? sh(burlap, 0.92) : burlap); // head
    put(2, 6, 2, 0x2A2A2A); put(5, 6, 2, 0x2A2A2A);         // button eyes
    put(3, 5, 2, 0x6A3A2A); put(4, 5, 2, 0x6A3A2A);         // stitched grin
    box(1, 7, 1, 6, 7, 6, (x, y, z) => (x === 1 || x === 6 || z === 1 || z === 6) ? hat : (x >= 3 && x <= 4 && z >= 3 && z <= 4 ? sh(hat, 1.1) : sh(hat, 0.84)));
    put(1, 6, 1, WD.strawD); put(6, 6, 6, WD.strawD);       // hat droop
    box(2, 7, 2, 5, 7, 2, 0xC0402E);                        // hat band (front)
    rotateGrid(c.facing);
  };

  // PUMPKIN PILE: two or three ribbed pumpkins (sometimes a white one or a squash) on their vine
  function pumpkin(cx, cz, r, y0, h, col) {
    const cy = y0 + h / 2;
    for (let y = y0; y < y0 + h && y < 8; y++) for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
      const dx = (x + 0.5 - cx) / r, dy = (y + 0.5 - cy) / (h / 2), dz = (z + 0.5 - cz) / r;
      if (dx * dx + dy * dy + dz * dz > 1.05) continue;
      const a = Math.atan2(z + 0.5 - cz, x + 0.5 - cx);
      const rib = (Math.round(a / (Math.PI / 4)) + 8) & 1;
      put(x, y, z, rib ? sh(col, 0.82) : (y === y0 + h - 1 ? sh(col, 1.1) : col));
    }
    const sx = Math.floor(cx), sz = Math.floor(cz), sy = Math.min(7, y0 + h);
    put(sx, sy, sz, 0x6A7A2A); if (h >= 3 && sy < 7) put(sx, sy, sz, 0x5A6A24);
  }
  PAINT_FN.pumpkins = function (s, c) {
    G.fill(0);
    const sd = seedOf(c), o = sd & 3;
    const PC = [0xE8781A, 0xE8781A, 0xF08A26, 0xEDE4CE, 0xE8781A, 0x6A9A3A, 0xF0B83A];
    const pc = (k) => PC[hh(k, sd, 1, 7) % PC.length];
    // vine & leaves on the ground
    for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) { const q = hh(x, z, sd, 3); if ((q & 7) === 0) put(x, 0, z, (q >> 3) & 1 ? 0x4E8A34 : 0x3A7028); }
    const lay = [
      [[2.6, 3.2, 2.6, 4, 0xE8781A], [5.8, 5.6, 1.9, 3, 1], [5.6, 1.8, 1.4, 2, 2]],
      [[4.6, 4.4, 2.7, 4, 0xE8781A], [1.8, 1.8, 1.6, 3, 1], [1.8, 6.0, 1.4, 2, 2]],
      [[3.4, 2.8, 2.4, 4, 0xE8781A], [5.4, 5.8, 2.1, 3, 1], [1.6, 6.0, 1.3, 2, 2]],
      [[4.0, 4.0, 2.8, 4, 0xE8781A], [0.9, 1.2, 1.1, 2, 1], [6.9, 6.8, 1.1, 2, 2]],
    ][o];
    for (const [x, z, r, h, k] of lay) pumpkin(x, z, r, 0, h, k > 16 ? k : pc(k));
    // a small one sitting on top sometimes
    if (sd & 8) pumpkin(lay[0][0] + 0.2, lay[0][1], 1.3, 4, 2, 0xF08A26);
  };

  // VEGETABLE CRATE: slatted crate heaped with one kind of vegetable (varies along a row), label on the front
  const VEG = [
    { c: [0xF07A1E, 0xE0681A], top: 0x5AB03A },          // carrots
    { c: [0x8ACB5A, 0x6AAE44, 0xA8DC70], big: 1 },        // cabbages / lettuce
    { c: [0xE03A2A, 0xC8281E, 0xF0503A], dot: 0x3A8A2A }, // tomatoes
    { c: [0xC8A064, 0xB08A52, 0xD8B478] },               // potatoes
    { c: [0x5A2A6A, 0x6A3A7A], dot: 0x4E8A34 },          // aubergines
    { c: [0xF2D24A, 0xE8C03A], top: 0x8ABA4A },           // corn
    { c: [0xE8302A, 0xF6C21A, 0x3E9A3A, 0xF08A1A] },       // peppers
    { c: [0xE8E0C8, 0xD8C8A8], top: 0x6AB84A },           // leeks / onions
  ];
  function heap(x0, x1, z0, z1, y0, top, V, sd) {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const q = hh(x, z, sd, 41);
      const h = top - ((q & 3) === 0 ? 1 : 0) - ((x === x0 || x === x1 || z === z0 || z === z1) && (q & 4) ? 1 : 0);
      for (let y = y0; y <= h; y++) {
        const k = V.big ? hh(x >> 1, y >> 1, z >> 1, sd) : hh(x, y, z, sd);
        let col = V.c[k % V.c.length];
        if (y === h && V.dot && (k & 7) === 0) col = V.dot;
        put(x, y, z, sh(col, 0.92 + ((k >> 4) & 3) * 0.04));
      }
      if (V.top && (q & 3) === 1 && h + 1 < 8) put(x, h + 1, z, V.top);
    }
  }
  PAINT_FN.vegcrate = function (s, c) {
    G.fill(0);
    const sd = seedOf(c), V = VEG[hh(c.px, c.pz, c.h + c.py * 4, 19) & 7];
    const w = s.col, wD = sh(w, 0.72), wL = sh(w, 1.1);
    box(0, 0, 1, 7, 3, 6, (x, y, z) => {
      const edge = (x === 0 || x === 7) + (z === 1 || z === 6);
      if (edge >= 2) return wD;
      if (y === 2 && edge) return null; // slat gap
      return y === 3 ? wL : ((y & 1) ? w : sh(w, 0.92));
    });
    box(1, 1, 2, 6, 3, 5, V.c[0]);
    box(0, 3, 3, 0, 3, 4, null); box(7, 3, 3, 7, 3, 4, null); // hand holes
    heap(1, 6, 2, 5, 3, 5, V, sd);
    // label on the front
    box(2, 1, 0, 5, 1, 0, 0xF2EAD6); put(3, 1, 0, V.c[0]); put(4, 1, 0, sh(V.c[0], 0.8));
    rotateGrid(c.facing);
  };

  // MILK CHURN: tapered steel churn with bands, shoulder handles and a lid
  PAINT_FN.milkcan = function (s, c) {
    G.fill(0);
    const m = s.col, mD = sh(m, 0.8), mL = sh(m, 1.1);
    disc(4, 4, 2.75, 0, 4, (x, y) => y === 0 || y === 3 ? mD : ((x + y) % 5 === 0 ? mL : m), GLOSS);
    disc(4, 4, 2.2, 5, 5, m, GLOSS);
    disc(4, 4, 1.45, 6, 6, mD, GLOSS);
    disc(4, 4, 1.95, 7, 7, mL, GLOSS);
    put(3, 7, 3, mD); put(4, 7, 4, mD);
    // little handles on the shoulder
    put(1, 5, 3, mD); put(1, 5, 4, mD); put(6, 5, 3, mD); put(6, 5, 4, mD);
    if (c.h & 1) disc(4, 4, 2.75, 2, 2, 0x3E6AB8, GLOSS); // a painted dairy band on some
  };

  // WHEELBARROW: wheel at the front (local -z), tub, handles to the back; filled by hash
  PAINT_FN.barrow = function (s, c) {
    G.fill(0);
    const sd = seedOf(c), tub = [0x3E8A4A, 0xC8402E, 0x3E6AB8, 0x3E8A4A][sd & 3], tD = sh(tub, 0.62), tL = sh(tub, 1.18);
    // wheel (yz disc) with a hub
    for (let y = 0; y < 4; y++) for (let z = 0; z < 4; z++) { const r = Math.hypot(y + 0.5 - 1.8, z + 0.5 - 1.8); if (r <= 1.85) for (const x of [3, 4]) put(x, y, z, r > 0.9 ? 0x2A2A2E : 0xC8CCD2); }
    // handles (wood) running from the wheel axle back past the tub, grips, legs
    for (const x of [1, 6]) { box(x, 3, 2, x, 3, 7, WD.oakD); put(x, 4, 7, 0x2A2A2E); box(x, 0, 5, x, 2, 5, WD.iron); }
    box(2, 2, 1, 5, 2, 2, WD.iron);
    // tub: slanted front over the wheel, straight back
    box(2, 3, 2, 5, 3, 5, tD, GLOSS);
    for (let y = 4; y <= 6; y++) {
      const zf = 6 - y, x0 = y === 4 ? 2 : 1, x1 = 7 - x0;
      for (let z = zf; z <= 6; z++) for (let x = x0; x <= x1; x++) {
        const wall = x === x0 || x === x1 || z === zf || z === 6;
        if (wall) put(x, y, z, y === 6 ? tL : tub, GLOSS);
        else if (y === 4) put(x, y, z, tD, GLOSS);
      }
    }
    const fill = (sd >> 2) & 3;
    if (fill === 1) box(2, 5, 2, 5, 5, 5, (x, y, z) => (hh(x, y, z, sd) & 3) ? WD.soil : WD.soilD);
    else if (fill === 2) { box(2, 5, 1, 5, 5, 5, (x, y, z) => ((x + y * 3 + z) % 4) ? 0xD8B048 : 0xE8C860); put(3, 6, 3, 0xE8C860); put(4, 6, 4, 0xD8B048); put(2, 6, 2, 0xD8B048); }
    else if (fill === 3) { pumpkin(3.2, 3.4, 1.4, 5, 2, 0xE8781A); pumpkin(5.0, 4.8, 1.0, 5, 2, 0xF08A26); }
    rotateGrid(c.facing);
  };

  // BEEHIVE: coiled straw skep on a little wooden stand, dark entrance at the front (local -z), bees
  PAINT_FN.beehive = function (s, c) {
    G.fill(0);
    const sd = seedOf(c), st = WD.straw, stD = sh(WD.straw, 0.8), stL = sh(WD.straw, 1.1);
    box(0, 0, 1, 7, 0, 6, (x, y, z) => (z === 1 || z === 6) ? WD.oakD : (x & 1 ? WD.oak : WD.oakL));
    const RAD = [0, 3.45, 3.6, 3.45, 3.1, 2.6, 1.9, 1.1];
    for (let y = 1; y < 8; y++) disc(4, 4, RAD[y], y, y, (x, yy, z) => ((Math.round(Math.atan2(z - 3.5, x - 3.5) * 3) + yy) & 1) ? st : (yy & 1 ? stD : stL));
    put(3, 7, 3, stD); put(4, 7, 4, stD);
    box(3, 1, 0, 4, 2, 1, 0x2A1E14); box(3, 1, 2, 4, 1, 2, 0x2A1E14); // entrance
    put(3, 1, 0, 0xE8A020);
    const B = [[1, 3, 0], [6, 2, 0], [6, 5, 1], [1, 6, 2], [7, 4, 4]];
    for (let k = 0; k < B.length; k++) if (((sd >> k) & 1) || k < 2) { const [x, y, z] = B[k]; put(x, y, z, 0xF6C82A); put(x, y, z + 1 > 7 ? z - 1 : z + 1, 0x2A2A2A); }
  };

  // BIRD BATH: stone pedestal and basin with water, sometimes a little bird on the rim
  PAINT_FN.birdbath = function (s, c) {
    G.fill(0);
    const st = s.col, sD = sh(st, 0.82), sL = sh(st, 1.08);
    disc(4, 4, 2.3, 0, 0, sD);
    disc(4, 4, 1.2, 1, 4, (x, y) => (y & 1) ? st : sD);
    disc(4, 4, 2.2, 5, 5, st);
    disc(4, 4, 3.9, 6, 6, (x, y, z) => { const r = Math.hypot(x + 0.5 - 4, z + 0.5 - 4); return r > 2.9 ? sL : null; });
    disc(4, 4, 2.9, 5, 5, sD);
    disc(4, 4, 2.9, 6, 6, (x, y, z) => (x + z) % 5 === 0 ? 0x9AD4F4 : 0x5AA8E0, GLOSS);
    const sd = seedOf(c);
    if (sd & 1) { const b = [0x3E7AD8, 0xD8402E, 0xE8B83A, 0x8A6A4A][(sd >> 1) & 3]; put(1, 7, 3, b); put(1, 7, 4, sh(b, 0.8)); put(0, 7, 4, 0x2A2A2A); put(1, 7, 2, 0xF08A1A); }
  };

  // MAILBOX: rural mailbox on a post, door on the front (local -z), red flag on the side
  PAINT_FN.mailbox = function (s, c) {
    G.fill(0);
    const sd = seedOf(c), col = [s.col, 0xC0443A, 0x3E8A4A, 0x3A3A44][sd & 3], dk = sh(col, 0.78), lt = sh(col, 1.15);
    box(3, 0, 3, 4, 3, 4, WD.oakD); box(3, 0, 2, 4, 0, 5, sh(WD.oakD, 0.85));
    box(2, 4, 1, 5, 5, 6, col, GLOSS);
    box(3, 6, 1, 4, 6, 6, lt, GLOSS);
    box(2, 4, 1, 5, 5, 1, dk, GLOSS); box(3, 6, 1, 4, 6, 1, dk, GLOSS); put(3, 5, 0, 0xD8DCE0); // door + knob
    if (sd & 4) { put(4, 4, 0, 0xF4F0E4); put(4, 5, 0, 0xF4F0E4); } // a letter peeking out
    // flag on the +x side
    const up = (sd >> 3) & 1;
    put(6, 4, 4, WD.iron);
    if (up) { box(6, 5, 4, 6, 7, 4, WD.iron); box(6, 6, 2, 6, 7, 3, 0xE83A2A); } else { box(6, 4, 3, 6, 4, 5, WD.iron); box(6, 3, 5, 6, 4, 6, 0xE83A2A); }
    rotateGrid(c.facing);
  };

  // PICNIC TABLE: A-frame legs, benches on both long sides, a gingham runner and a treat
  PAINT_FN.picnic = function (s, c) {
    G.fill(0);
    const w = s.col, wD = sh(w, 0.76), wL = sh(w, 1.1), sd = seedOf(c);
    for (const x of [1, 6]) {
      for (const [y, z] of [[0, 1], [0, 6], [1, 2], [1, 5], [2, 2], [2, 5], [3, 3], [3, 4]]) put(x, y, z, wD);
      box(x, 1, 0, x, 1, 7, wD); box(x, 3, 2, x, 3, 5, wD);
    }
    box(0, 2, 0, 7, 2, 1, (x, y, z) => z === 0 ? w : wL);
    box(0, 2, 6, 7, 2, 7, (x, y, z) => z === 7 ? w : wL);
    box(0, 4, 2, 7, 4, 5, (x, y, z) => (z & 1) ? wL : w);
    if (sd & 1) box(2, 4, 2, 5, 4, 5, (x, y, z) => ((x + z) & 1) ? 0xE84A3A : 0xF6F0E6);
    const t = (sd >> 1) & 3;
    if (t === 0) { box(3, 5, 3, 4, 5, 4, 0xD89A4A); put(3, 5, 3, 0xB0302A); put(4, 5, 4, 0xB0302A); } // cherry pie
    else if (t === 1) { box(4, 5, 3, 4, 6, 3, 0xF6E27A, 0); put(4, 7, 3, 0xE8E8E8); put(2, 5, 4, 0xF6E27A); } // lemonade
    else if (t === 2) { box(3, 5, 2, 5, 5, 3, 0xA8783E); box(3, 6, 2, 3, 6, 3, 0x8A5E32); box(5, 6, 2, 5, 6, 3, 0x8A5E32); box(4, 7, 2, 4, 7, 3, 0x8A5E32); put(4, 5, 4, 0xE84A3A); } // basket
    else { put(2, 5, 3, 0x3E8A3A); put(3, 5, 3, 0xE8403A); put(5, 5, 4, 0x3E8A3A); put(5, 5, 3, 0xE8403A); } // melon slices
    rotateGrid(c.facing);
  };

  // WINDMILL SAIL: wall-mounted (wall at local +z); a 3×3 of these draws one big four-bladed sail
  // with the hub in the middle block; a lone block draws a small complete sail
  function sailAt(a, b, S) {
    // a, b: offsets from the hub in design units (the 3×3 design is 24 units across)
    const r = Math.hypot(a, b);
    if (r < 2.1 * S) return r < 1.1 * S ? 3 : 2; // brass cap / hub
    const p = (a + b) * Math.SQRT1_2, q = (a - b) * Math.SQRT1_2;
    for (const [t, w] of [[p, q], [-p, -q], [q, -p], [-q, p]]) {
      if (t < 1.2 * S || t > 15.9 * S) continue;
      if (Math.abs(w) < 0.85 * S) return 4; // stock
      if (w > 0.85 * S && w < 5.3 * S && t > 3.4 * S && t + w < 16.9 * S) {
        if (w > 4.55 * S || t + w > 16.1 * S || ((t - 3.4 * S) % (3.1 * S)) < 0.62 * S) return 5; // lattice
        return 6; // canvas
      }
    }
    return 0;
  }
  PAINT_FN.sail = function (s, c) {
    G.fill(0);
    const m = c.x, R_ = m & 1, L_ = (m >> 1) & 1, U_ = (m >> 2) & 1, D_ = (m >> 3) & 1;
    const lone = !(R_ || L_ || U_ || D_);
    const i = !R_ ? 0 : L_ ? 1 : 2, j = !D_ ? 0 : U_ ? 1 : 2; // column counted from local +x, row from the bottom
    const COL = [0, 0, 0x4A3222, 0xD8A83A, 0x5A3E28, 0xA87444, s.col];
    let hubBlock = lone || (i === 1 && j === 1);
    for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
      let k;
      if (lone) {
        const n = [0, 0, 0, 0, 0, 0, 0];
        for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) n[sailAt((u + (a + 0.5) / 3 - 4) * 3, (v + (b + 0.5) / 3 - 4) * 3, 1.0)]++;
        k = n[3] ? 3 : n[2] >= 2 ? 2 : n[4] >= 2 ? 4 : (n[5] + n[6]) >= 3 ? (n[5] >= 5 ? 5 : 6) : 0;
      }
      else k = sailAt((2 - i) * 8 + u + 0.5 - 12, j * 8 + v + 0.5 - 12, 1.0);
      if (!k) continue;
      if (k === 6) { put(u, v, 3, ((v + u) & 3) === 0 ? sh(s.col, 0.94) : s.col); continue; }
      if (k === 5) { put(u, v, 2, COL[5]); continue; }
      if (k === 4) { put(u, v, 2, COL[4]); put(u, v, 3, sh(COL[4], 0.85)); continue; }
      put(u, v, 1, COL[k]); put(u, v, 2, COL[2]);
      if (k === 3) put(u, v, 0, COL[3]);
    }
    if (hubBlock) box(3, 3, 3, 4, 4, 7, 0x3A2A1E);
    rotateGrid(c.facing);
  };

  // RAISED FLOWER BED: wooden edge only on the outer sides, neighbours join; mixed / roses / tulips
  PAINT_FN.fbed = function (s, c) {
    G.fill(0);
    const m = c.x, px = m & 1, nx = (m >> 1) & 1, pz = (m >> 2) & 1, nz = (m >> 3) & 1;
    const w = s.col, wL = sh(w, 1.14), wD = sh(w, 0.78);
    const X = c.px * 8, Z = c.pz * 8, sd = seedOf(c);
    box(0, 0, 0, 7, 1, 7, (x, y, z) => y === 1 ? ((hh(x, z, sd, 3) & 3) ? WD.soil : WD.soilD) : WD.soilD);
    const edge = (x, z) => (!nx && x === 0) || (!px && x === 7) || (!nz && z === 0) || (!pz && z === 7);
    for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) if (edge(x, z)) { put(x, 0, z, wD); put(x, 1, z, w); put(x, 2, z, wL); }
    for (const [cx, cz, a, b] of [[0, 0, nx, nz], [7, 0, px, nz], [0, 7, nx, pz], [7, 7, px, pz]]) if (!a && !b) box(cx, 0, cz, cx, 3, cz, wD);
    const inner = (x, z) => !edge(x, z);
    if (s.bed === 'tulips') {
      for (let z = 0; z < 8; z++) {
        const row = (Z + z);
        if ((row % 3) === 0) continue;
        const colr = FLOWERC[hh(row >> 1, c.pz, 0, 61) % FLOWERC.length];
        for (let x = 0; x < 8; x++) {
          if (!inner(x, z)) continue;
          const on = ((X + x + (row % 3) * 1) % 2) === 0;
          if (!on) { if ((hh(x, z, sd, 2) & 3) === 0) put(x, 2, z, WD.leaf); continue; }
          put(x, 2, z, WD.leafD); put(x, 3, z, 0x4E9A3A); put(x, 4, z, colr); put(x, 5, z, sh(colr, 1.12));
        }
      }
    } else if (s.bed === 'roses') {
      const bush = [[1.9, 2.0], [5.8, 3.0], [3.0, 5.9], [6.4, 6.4]];
      for (let y = 2; y < 7; y++) for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
        if (!inner(x, z)) continue;
        let best = 9;
        for (const [bx, bz] of bush) best = Math.min(best, Math.hypot(x + 0.5 - bx, (y - 2) * 1.1, z + 0.5 - bz));
        if (best > 2.7 + ((hh(x, y, z, sd) & 3) * 0.15)) continue;
        const q = hh(x, y, z, sd + 7);
        let col = (q & 1) ? 0x2E6A2A : 0x3E7E32;
        if (best > 1.8 && (q % 5) === 0) col = [0xD8202E, 0xE8406A, 0xF6F0F0, 0xF07AA0][(q >> 5) & 3];
        put(x, y, z, col);
      }
    } else {
      for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
        if (!inner(x, z)) continue;
        const q = hh(X + x, Z + z, c.py, 71);
        if ((q & 7) === 0) continue;
        const tall = 1 + ((q >> 3) & 1) + ((q >> 9) & 1);
        for (let y = 2; y < 2 + tall; y++) put(x, y, z, (q >> 5) & 1 ? WD.leaf : WD.leafD);
        if ((q >> 4) & 1 || (q >> 10) & 1) put(x, 2 + tall, z, FLOWERC[(q >>> 12) % FLOWERC.length]);
      }
    }
  };

  // LAUNDRY LINE: posts at the row ends, a rope with clothes pegged on it (varies by hash)
  const CLOTH = [0xE84A3A, 0x3E7AD8, 0xF6D23A, 0xF4F2EC, 0x5AB06A, 0xF08FB0, 0x8A5AD8, 0x3AB8C8, 0xF08A2A];
  const GARB = [
    { w: 5, rows: ['XXXXX', 'X...X', '.XXX.', '.XXX.'] },             // (fixed below) t-shirt
    { w: 3, rows: ['XXX', 'XXX', 'XXX', 'XXX'], stripe: 2 },          // towel
    { w: 5, rows: ['XXXXX', 'XX.XX', 'XX.XX', 'XX.XX'] },             // trousers
    { w: 5, rows: ['.XXX.', '.XXX.', 'XXXXX', 'XXXXX'] },             // dress
    { w: 3, rows: ['X.X', 'X.X', 'XXX'] },                           // socks
    { w: 4, rows: ['XXXX', 'XXXX', 'XXXX'], stripe: 1 },              // pillowcase
  ];
  GARB[0].rows = ['XXXXX', 'XXXXX', '.XXX.', '.XXX.', '.XXX.'];
  GARB[3].rows = ['.XXX.', '.XXX.', 'XXXXX', 'XXXXX', 'XXXXX'];
  GARB[2].rows = ['XXXXX', 'XX.XX', 'XX.XX', 'XX.XX', 'XX.XX'];
  GARB[1].rows = ['XXX', 'XXX', 'XXX', 'XXX', 'XXX'];
  PAINT_FN.laundry = function (s, c) {
    G.fill(0);
    const R_ = c.x & 1, L_ = (c.x >> 1) & 1, sd = seedOf(c);
    const post = WD.oakD, rope = 0xE8E0CC;
    if (!R_) { box(7, 0, 3, 7, 6, 3, post); box(7, 7, 2, 7, 7, 4, post); box(7, 0, 2, 7, 0, 4, sh(post, 0.85)); }
    if (!L_) { box(0, 0, 3, 0, 6, 3, post); box(0, 7, 2, 0, 7, 4, post); box(0, 0, 2, 0, 0, 4, sh(post, 0.85)); }
    const xa = L_ ? 0 : 1, xb = R_ ? 7 : 6;
    for (let x = xa; x <= xb; x++) put(x, 7, 3, ((x + c.px * 8) % 3) ? rope : sh(rope, 0.9));
    // clothes
    let x = xa + (hh(sd, 1, 2, 3) & 1);
    let k = 0;
    while (x <= xb) {
      const q = hh(sd, k, c.py, 29), g = GARB[q % GARB.length];
      if (x + g.w - 1 > xb) { if (xb - x >= 2) { const sock = GARB[4]; drawG(sock, x, q); } break; }
      drawG(g, x, q);
      x += g.w + ((q >> 8) & 1);
      k++;
    }
    function drawG(g, x0, q) {
      const col = CLOTH[(q >>> 4) % CLOTH.length], col2 = CLOTH[(q >>> 12) % CLOTH.length];
      pix(g.rows, (u, r) => {
        let cc = col;
        if (g.stripe && r === g.stripe) cc = col2 === col ? 0xF4F2EC : col2;
        if (g === GARB[0] && r === 0 && (u === 2)) cc = sh(col, 0.8);
        put(x0 + u, 6 - r, 3, ((u + r) & 1) ? cc : sh(cc, 0.94));
      });
      put(x0, 7, 2, 0xD8B070); put(x0 + g.w - 1, 7, 2, 0xD8B070); put(x0, 7, 4, 0xD8B070); put(x0 + g.w - 1, 7, 4, 0xD8B070); // pegs
    }
    rotateGrid(c.facing);
  };

  // BARN DOOR: red planks, white frame and X braces; same-plane neighbours form one big door
  // (outer frame only on the outside, one shared divider between panels, iron track on top, handle at the seam)
  PAINT_FN.bdoor = function (s, c) {
    G.fill(0);
    const m = c.x, R_ = m & 1, L_ = (m >> 1) & 1, U_ = (m >> 2) & 1, D_ = (m >> 3) & 1;
    const red = s.col, white = 0xF2F0EA, whiteD = 0xDCD8CE;
    for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
      const plank = (u >> 1) + c.px * 4;
      const k = 0.9 + (hh(plank, c.py, c.pz, 7) & 3) * 0.04;
      const col = (u & 1) === 0 && ((u >> 1) & 1) ? sh(red, k * 0.86) : sh(red, k);
      box(u, v, 1, u, v, 6, col);
    }
    // one shared divider between joined panels: every block draws its u = 0 / v = 0 edge, the outer edges close the door
    for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
      const fr = (u === 0) || (u === 7 && !R_) || (v === 7 && !U_) || (v === 0);
      const xb = (u === v) || (u === 7 - v);
      if (fr || xb) { const col = fr ? white : whiteD; put(u, v, 0, col); put(u, v, 7, col); if (fr) for (let z = 1; z <= 6; z++) put(u, v, z, sh(red, 0.72)); }
    }
    // sliding track on top of the whole door (front side)
    if (!U_) { box(0, 7, 0, 7, 7, 0, 0x2E3036); if (!(c.px & 1) || !R_) { put(2, 6, 0, 0x4A4E56); put(5, 6, 0, 0x4A4E56); } }
    // handle at the seam of a double door (bottom row)
    if (!D_ && (L_ !== R_)) { const u = R_ ? 6 : 1; for (let v = 3; v <= 5; v++) { put(u, v, 0, WD.iron); put(u, v, 7, WD.iron); } }
    else if (!D_ && !L_ && !R_) { for (let v = 3; v <= 5; v++) { put(6, v, 0, WD.iron); put(6, v, 7, WD.iron); } }
    rotateGrid(c.facing);
  };

  // ================================================================= SUPERMARKET
  const SHOPC = { white: 0xEEF1F4, grey: 0xD2D8DE, greyD: 0xA8B0B8, dark: 0x3A4048, darkD: 0x2A2E34, rail: 0x3E4650, tag: 0xFFFFFF, sale: 0xFFE040, brand: 0x1F8F4E, brandL: 0x3FB86E };
  // --- products: small item drawers (front face at z = Z0, depth to Z1). Items keep a readable silhouette at
  // 8³: two-tone labels, caps & crimps set back one voxel (a shadow notch), short items leave dark space above.
  let Z0 = 0, Z1 = 4;
  const SILVER = 0xC8CED6;
  const itm = {
    heap(x, w, y, h, A, B, q) { // produce in a shallow crate
      for (let xx = x; xx < x + w; xx++) for (let z = Z0; z <= Z1; z++) {
        const k = hh(xx, y, z, q), col = (k & 3) === 0 ? B : A;
        const edge = xx === x || xx === x + w - 1;
        if (h > 1) {
          put(xx, y, z, z === Z0 ? (edge ? 0x9A6A3A : 0xC8A060) : sh(A, 0.8));
          if (!(z === Z0 && edge) && ((k >>> 8) % 4 !== 0 || z > Z0)) put(xx, y + 1, z, sh(col, 0.94 + ((k >> 5) & 3) * 0.04));
        } else put(xx, y, z, sh(col, 0.94 + ((k >> 5) & 3) * 0.04));
      }
    },
    bottles(x, w, y, h, A, B, q) { // bottles with caps set back
      for (let xx = x; xx < x + w; xx++) {
        const a = ((xx - x) & 1) ? sh(A, 0.9) : A;
        box(xx, y, Z0, xx, y, Z1, a);
        if (h > 1) { put(xx, y + 1, Z0 + 1, B); box(xx, y + 1, Z0 + 2, xx, y + 1, Z1, sh(a, 1.08)); }
      }
    },
    cans(x, w, y, h, A, B, q) { // stacked cans, every other one a shade darker so single cans show
      for (let xx = x; xx < x + w; xx++) for (let yy = y; yy < y + h; yy++) box(xx, yy, Z0, xx, yy, Z1, (zz) => ((xx + yy) & 1) ? sh(A, 0.86) : A);
      if (h === 1) put(x + (w >> 1), y, Z0, B);
    },
    box(x, w, y, h, A, B, q) { // carton with a logo pixel / band
      box(x, y, Z0, x + w - 1, y + h - 1, Z1, (xx, yy, zz) => zz === Z0 ? A : sh(A, 0.86));
      if (h > 1) { put(x + ((q >> 3) & 1) * (w - 1), y + h - 1, Z0, B); if (w > 1) put(x + (((q >> 3) & 1) ^ 1) * (w - 1), y, Z0, sh(A, 0.8)); }
      else put(x + ((q >> 3) & 1) * (w - 1), y, Z0, B);
    },
    tall(x, w, y, h, A, B, q) { // tall boxes one wide, a band across the middle
      for (let xx = x; xx < x + w; xx++) { box(xx, y, Z0, xx, y + h - 1, Z1 - 1, A); put(xx, y + h - 1, Z0, B); }
    },
    bag(x, w, y, h, A, B, q) { // chip bags: puffy body, crimped top set back
      box(x, y, Z0, x + w - 1, y, Z1 - 1, (xx, yy, zz) => zz === Z0 && xx === x + ((q >> 2) & 1) * (w - 1) ? B : A);
      if (h > 1) box(x, y + 1, Z0 + 1, x + w - 1, y + 1, Z1 - 1, sh(A, 1.14));
    },
    jar(x, w, y, h, A, B, q) { // jars: contents + a lid on top
      for (let xx = x; xx < x + w; xx++) { box(xx, y, Z0, xx, y, Z1, A); if (h > 1) box(xx, y + 1, Z0, xx, y + 1, Z1 - 1, B); }
    },
    short(x, w, y, h, A, B, q) { // low items (cheese, butter, bars, sponges): leave shadow above
      box(x, y, Z0, x + w - 1, y, Z1, (xx, yy, zz) => ((xx + zz) & 1) ? A : sh(A, 0.9));
      put(x + ((q >> 4) & 1) * (w - 1), y, Z0, B);
    },
    pot(x, w, y, h, A, B, q) { // potted plants: pot + foliage & blooms
      box(x, y, Z0 + 1, x + w - 1, y, Z0 + 3, A);
      if (h > 1) for (let xx = x; xx < x + w; xx++) for (let z = Z0; z <= Z0 + 3; z++) { const k = hh(xx, z, q, 3); put(xx, y + 1, z, (k % 3) === 0 ? B : (k & 8 ? WD.leaf : WD.leafD)); }
    },
    mixjar(x, w, y, h, A, B, q) { // candy jars full of colour
      for (let xx = x; xx < x + w; xx++) { box(xx, y, Z0, xx, y, Z1, (zz) => FLOWERC[hh(xx, y, zz, q) % FLOWERC.length]); if (h > 1) box(xx, y + 1, Z0, xx, y + 1, Z1 - 1, B); }
    },
    screen(x, w, y, h, A, B, q) { // gadget boxes with a glowing screen pixel
      itm.box(x, w, y, h, A, A, q);
      put(x + ((q >> 2) & 1) * (w - 1), y + h - 1, Z0, B, EMIS);
    },
    teddy(x, w, y, h, A, B, q) {
      if (h < 2 || w < 2) return itm.box(x, w, y, h, A, B, q);
      box(x, y, Z0 + 1, x + 1, y, Z0 + 3, 0x9A6A3A); box(x, y + 1, Z0 + 1, x + 1, y + 1, Z0 + 2, 0xB08050); put(x, y + 1, Z0 + 1, 0x2A2A2A); put(x + 1, y, Z0, 0xD8B080);
      if (w > 2) itm.box(x + 2, w - 2, y, h, A, B, q);
    },
    balls(x, w, y, h, A, B, q) { for (let xx = x; xx < x + w; xx++) { put(xx, y, Z0 + 1, FLOWERC[hh(xx, y, q, 3) % FLOWERC.length]); box(xx, y, Z0 + 2, xx, y, Z1, FLOWERC[hh(xx, y, q, 5) % FLOWERC.length]); } },
    eggs(x, w, y, h, A, B, q) { box(x, y, Z0, x + w - 1, y, Z1, 0xB8B0A0); for (let xx = x; xx < x + w; xx++) put(xx, y, Z0, 0xA8A090); if (h > 1) for (let xx = x; xx < x + w; xx++) for (let z = Z0 + 1; z <= Z1; z += 2) put(xx, y + 1, z, 0xF4EEDC); },
    carton(x, w, y, h, A, B, q) { // milk / juice cartons: white body, coloured top
      for (let xx = x; xx < x + w; xx++) { box(xx, y, Z0, xx, y + h - 1, Z1, A); put(xx, y + h - 1, Z0, B); if (h > 1) put(xx, y + 1, Z1, B); }
    },
  };
  // category: accent colour, header pictogram, items [drawer, widths, weight] and a palette of [A, B] colour pairs
  const I_ = (f, w, n) => ({ f, w, n: n || 1 });
  const SHELF = {
    fruit: { acc: 0xE53935, icon: ['.G.', 'RRR'], it: [I_('heap', [3, 4])], pal: [[0xD8342A, 0xE84A36], [0x8CC63A, 0xA8D84A], [0xFF9A1E, 0xFFB03A], [0xF6D23A, 0xF8E060], [0x7A3A8E, 0x8E4AA2], [0xF4A07A, 0xF8B890], [0xE0283A, 0x3A8A2A], [0xC8D84A, 0xB8C83A]] },
    veg: { acc: 0x43A047, icon: ['GGG', 'OOO'], it: [I_('heap', [3, 4])], pal: [[0x8ACB5A, 0x6AAE44], [0x3E7A2E, 0x2E6A26], [0xF07A1E, 0x5AB03A], [0xE03A2A, 0xC8281E], [0xF6C21A, 0xE8B010], [0x5A2A6A, 0x6A3A7A], [0xC8A064, 0xB08A52], [0x3E8A3A, 0x2E7A2E]] },
    bakery: { acc: 0xA1662F, icon: ['.T.', 'TTT'], it: [I_('short', [2, 3], 2), I_('bag', [2]), I_('tall', [1, 2])], pal: [[0xC8843A, 0xE8B070], [0x7A4E2A, 0xA0784A], [0xE8C47A, 0xC8843A], [0xE0A040, 0xF4D08A], [0xD8B888, 0xF4E8D0]] },
    pantry: { acc: 0xC0A030, icon: ['DDD', 'YYY'], it: [I_('jar', [2, 3]), I_('cans', [2, 3]), I_('box', [2]), I_('bottles', [2])], pal: [[0xB02A3A, 0xE8E0D0], [0xE0A020, 0xC89020], [0x6A9A3A, 0xE8E0D0], [0x2A5AC8, 0xF0C030], [0xD8C83A, 0x2A4A2A], [0xD8302A, SILVER], [0x3A7A3A, SILVER], [0x5A3A2A, 0xE0A020]] },
    drinks: { acc: 0x1E6FD9, icon: ['.W.', 'WWW'], it: [I_('bottles', [2, 3], 3), I_('cans', [2, 3]), I_('box', [2])], pal: [[0x7AC8F0, 0x2A6AD8], [0x4A2A1A, 0xE8302A], [0xFF8A1A, 0x3A8A2A], [0x6AD83A, 0x2A6A2A], [0x8A3AB0, 0xF0C0F0], [0xF8C030, 0x3A8A2A], [0xE8302A, 0x3A2A1A], [0x3A3AE0, 0xC8F040]] },
    snacks: { acc: 0xF57C00, icon: ['YWY', 'YYY'], it: [I_('bag', [2], 3), I_('tall', [1, 2]), I_('box', [2])], pal: [[0xE83A2A, 0xF8C020], [0xF8C020, 0xE83A2A], [0x2A8AE8, 0xF8C020], [0x3AB84A, 0xF8E040], [0xF07A1A, 0x3A2A1A], [0x8A3AD8, 0xF8C020], [0xE84AA0, 0x6A2A8A]] },
    cereal: { acc: 0xFBC02D, icon: ['WWW', 'WRW'], it: [I_('box', [2], 3), I_('tall', [1])], pal: [[0xF8D030, 0xE8402A], [0xE8502A, 0xF8D030], [0x3A7AE0, 0xF8D030], [0x7AC83A, 0xC83A2A], [0xA05AE0, 0xF8D030], [0xF08A2A, 0x3A7AE0], [0xD83A5A, 0x3A2A1A]] },
    sweets: { acc: 0xF06292, icon: ['P.P', '.P.'], it: [I_('mixjar', [2, 3]), I_('short', [2, 3]), I_('bag', [2])], pal: [[0xF06292, 0xFFFFFF], [0x6A3A1E, 0xE8302A], [0x6A3A1E, 0xE0B030], [0xB070FF, 0xF6D23A], [0x5AD8C8, 0xF06292], [0xFF8A2A, 0x6AD83A]] },
    dairy: { acc: 0x81D4FA, icon: ['.B.', 'WWW'], it: [I_('carton', [2, 3], 2), I_('short', [2]), I_('eggs', [2, 3]), I_('jar', [2])], pal: [[0xF4F4F0, 0x2A6AD8], [0xF4F4F0, 0xE8302A], [0xF4F4F0, 0x3AA84A], [0xF2C84A, 0xE8902A], [0xF6E07A, 0xE8C040], [0xF8C8D8, 0xF4F4F0], [0xFFF0C8, 0x8A5AC8]] },
    flowers: { acc: 0x9CCC65, icon: ['R.Y', '.G.'], it: [I_('pot', [2, 3])], pal: [[0xC06A3A, 0xE8403A], [0x3E7AD8, 0xF6D23A], [0xF4F2EC, 0xF08FB0], [0xE8B83A, 0xB070FF], [0xC06A3A, 0xFFFFFF]] },
    tech: { acc: 0x37474F, icon: ['CCC', '.W.'], it: [I_('screen', [2, 3], 2), I_('box', [1, 2])], pal: [[0x2A2E36, 0x3AF0FF], [0xF0F2F4, 0x3A8AFF], [0x2A2E36, 0x5AFF7A], [0x5A6472, 0xFF9A2A], [0xE8302A, 0x2A2E36], [0x2A2E36, 0xFF5AD8]] },
    toys: { acc: 0x8E24AA, icon: ['Y.Y', 'YYY'], it: [I_('teddy', [2, 3]), I_('balls', [2, 3]), I_('box', [2]), I_('tall', [1, 2])], pal: [[0xE8302A, 0xF6D23A], [0x3E7AD8, 0xF6D23A], [0xF6D23A, 0xE8302A], [0x3AB84A, 0xF6D23A], [0xF08FB0, 0x8A3AD8], [0xFF8A2A, 0x3E7AD8]] },
    home: { acc: 0x00897B, icon: ['.W.', 'WWW'], it: [I_('bottles', [2, 3]), I_('box', [2], 2), I_('short', [2, 3])], pal: [[0x2A6AE0, 0xF4F4F4], [0xFF8A2A, 0x2A6AE0], [0x3AB84A, 0xF6D23A], [0xE8EEF4, 0x5A9AE0], [0xF6D23A, 0x3AB84A], [0xE84AA0, 0x6A2A8A]] },
    pharmacy: { acc: 0xECEFF1, icon: ['.G.', 'GGG'], iconCol: 0x2EA84A, it: [I_('box', [1, 2], 2), I_('bottles', [2]), I_('short', [2])], pal: [[0xF4F6F8, 0x2EA84A], [0xF4F6F8, 0x2A6AD8], [0xF4F6F8, 0xE8302A], [0xC8782A, 0xF4F6F8], [0x9AD0F0, 0xF4F6F8], [0xF4F6F8, 0xF6B82A]] },
  };
  for (const k in SHELF) { const S = SHELF[k]; S.bag = []; S.it.forEach((it, i) => { for (let n = 0; n < it.n; n++) S.bag.push(i); }); }
  const ICONC = { R: 0xFF4A3A, G: 0x6AD84A, O: 0xFF9A2A, W: 0xFFFFFF, D: 0x6A4A2A, Y: 0xFFE04A, B: 0x2A6AD8, P: 0xFFFFFF, C: 0x3AF0FF, T: 0xF8E0B0 };
  // one tier of products between x0..x1 at height y (h tall); returns the facing starts (price tags)
  function tier(cat, x0, x1, y, h, seed) {
    const S = SHELF[cat], tags = [];
    let x = x0, k = 0;
    while (x <= x1) {
      const q = hh(seed, k, y, 97), it = S.it[S.bag[q % S.bag.length]];
      let w = it.w[(q >>> 5) % it.w.length];
      if (x + w - 1 > x1) w = x1 - x + 1;
      const P = S.pal[(q >>> 9) % S.pal.length];
      itm[it.f](x, w, y, h, P[0], P[1], q);
      tags.push(x);
      x += w + (((q >>> 14) % 3) === 0 && x + w < x1 ? 1 : 0); // sometimes a gap between facings
      k++;
    }
    return tags;
  }
  // SHELF (gondola): front at local -z; rows join (no side panels between), stacks join (header on the top block, kick plate at the bottom)
  PAINT_FN.mshelf = function (s, c) {
    G.fill(0);
    const S = SHELF[s.cat] || SHELF.pantry, m = enclosed(c) ? 15 : c.x, R_ = m & 1, L_ = (m >> 1) & 1, U_ = (m >> 2) & 1, D_ = (m >> 3) & 1;
    const frame = SHOPC.grey, back = 0x4E5862, board = 0x6A747E, acc = S.acc;
    const seed = hh(c.px + c.h * 2, c.py, c.pz, 31);
    box(0, 0, 7, 7, 7, 7, (x, y) => ((x & 1) && (y & 1) && y < 7) ? sh(back, 0.8) : back); // pegboard back
    const xa = L_ ? 0 : 1, xb = R_ ? 7 : 6;
    const tiers = [];
    const railAt = (y, tags) => { for (let x = xa; x <= xb; x++) { const q = hh(x, y, seed, 5); put(x, y, 0, tags.indexOf(x) >= 0 && (q & 1) ? ((q >>> 3) % 6 === 0 ? SHOPC.sale : SHOPC.tag) : SHOPC.rail); } };
    // base
    if (!D_) { box(0, 0, 0, 7, 0, 6, board); for (let x = 0; x < 8; x++) put(x, 0, 0, SHOPC.dark); }
    else box(xa, 0, 0, xb, 0, 6, board);
    tiers.push([0, 1, 2]);
    box(xa, 3, 0, xb, 3, 6, board); tiers.push([3, 4, 2]);
    if (U_) { box(xa, 6, 0, xb, 6, 6, board); tiers.push([6, 7, 1]); }
    for (const [by, y, h] of tiers) {
      const tags = tier(s.cat, xa, xb, y, h, seed + y * 7);
      if (by > 0 || D_) railAt(by, tags);
    }
    // header band on the top block of a stack: category accent band with a little pictogram
    if (!U_) {
      box(0, 6, 1, 7, 7, 7, sh(frame, 0.95));
      box(0, 6, 0, 7, 7, 0, (x, y) => y === 7 ? sh(acc, 0.9) : acc);
      pix(S.icon, (k, r, ch) => put(5 - k, 7 - r, 0, S.iconCol || ICONC[ch] || 0xFFFFFF));
    }
    // side panels where the row ends
    const side = (x) => box(x, 0, 0, x, 7, 7, (xx, y, z) => z === 0 ? SHOPC.greyD : (!U_ && y >= 6 ? acc : frame));
    if (!L_) side(0);
    if (!R_) side(7);
    rotateGrid(c.facing);
  };

  // GLASS-DOOR FRIDGE: one door per block; rows & stacks join into one lit cooler wall
  PAINT_FN.mfridge = function (s, c) {
    G.fill(0);
    const m = enclosed(c) ? 15 : c.x, R_ = m & 1, L_ = (m >> 1) & 1, U_ = (m >> 2) & 1, D_ = (m >> 3) & 1;
    const body = s.col, bodyD = sh(body, 0.82), led = 0xE8F8FF, inner = 0xDDEEF6;
    const seed = hh(c.px + c.h * 2, c.py, c.pz, 37);
    box(0, 0, 7, 7, 7, 7, inner);                                   // lit back wall
    if (!L_) box(0, 0, 1, 0, 7, 7, body);
    if (!R_) box(7, 0, 1, 7, 7, 7, body);
    if (!D_) { box(0, 0, 0, 7, 0, 7, SHOPC.darkD); for (let x = 1; x < 7; x += 2) put(x, 0, 0, 0x5A6068); }
    if (!U_) { box(0, 7, 0, 7, 7, 7, body); box(0, 7, 0, 7, 7, 0, s.sign || 0x2A8AE8, EMIS); for (let x = 1; x < 7; x++) if ((x + c.px * 8) % 3 === 0) put(x, 7, 0, 0xFFFFFF, EMIS); }
    // racks & products right behind the glass, framed by LED strips
    Z0 = 2; Z1 = 5;
    const cat = s.style === 'dairy' ? 'dairy' : 'drinks';
    const levels = [];
    if (D_) levels.push([0, 1, 2]); else levels.push([1, 2, 2]);
    levels.push([3, 4, 2]);
    if (U_) levels.push([6, 7, 1]);
    for (const [ry, y, h] of levels) {
      box(1, ry, 2, 6, ry, 6, 0xDCE4EA, GLOSS);
      for (let x = 2; x <= 5; x++) put(x, ry, 2, (hh(x, ry, seed, 3) % 4) ? 0xF4F8FA : SHOPC.sale);
      tier(cat, 2, 5, y, h, seed + y * 5);
    }
    if (!U_) box(1, 6, 2, 6, 6, 6, 0xDCE4EA, GLOSS);
    Z0 = 0; Z1 = 4;
    for (let y = D_ ? 0 : 1; y <= (U_ ? 7 : 6); y++) { put(1, y, 2, led, EMIS); put(6, y, 2, led, EMIS); }
    if (!U_) box(2, 6, 2, 5, 6, 2, led, EMIS);
    // door: slim frame + glass + handle
    for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
      const fr = u === 0 || u === 7 || (v === 0 && !D_) || (v === 7 && !U_);
      if (fr) { put(u, v, 1, bodyD, GLOSS); if (u === 0 || u === 7) put(u, v, 0, body, GLOSS); }
      else put(u, v, 1, 0xD4F0FF, GLASS);
    }
    for (let v = D_ ? 0 : 2; v <= (U_ ? 7 : 5); v++) put(6, v, 0, 0xD8DCE0, GLOSS);
    rotateGrid(c.facing);
  };

  // CHEST FREEZER: white tub, glass lid, ice-cream tubs inside; joins in rows and islands (flat)
  const ICE = [[0xF6B8C8, 0xE84A7A], [0x6A3A1E, 0x8A5A3A], [0xF4EAC8, 0xE8D8A0], [0x9AE0B0, 0x3A8A5A], [0xB8D8F8, 0x3A6AD8], [0xF8E07A, 0xE8A020], [0xD8B8F0, 0x8A4AC8]];
  PAINT_FN.mfreezer = function (s, c) {
    G.fill(0);
    const m = c.x, px = m & 1, nx = (m >> 1) & 1, pz = (m >> 2) & 1, nz = (m >> 3) & 1;
    const wall = (x, z) => (!nx && x === 0) || (!px && x === 7) || (!nz && z === 0) || (!pz && z === 7);
    const sd = seedOf(c);
    for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
      if (wall(x, z)) { for (let y = 0; y <= 5; y++) put(x, y, z, y === 0 ? SHOPC.dark : y === 2 ? 0x5A8AB8 : y === 5 ? 0xD0D8E0 : s.col, y === 5 ? GLOSS : 0); continue; }
      box(x, 0, z, x, 2, z, 0xDDF3FF);
      put(x, 5, z, 0xD8F2FF, GLASS);
    }
    // tubs (2×2) and a few ice-lolly boxes
    for (const [x0, z0] of [[1, 1], [4, 1], [1, 4], [4, 4]]) {
      const q = hh(x0 + c.px * 8, z0 + c.pz * 8, sd, 5), P = ICE[q % ICE.length];
      const xx0 = nx && x0 === 1 ? 0 : x0, zz0 = nz && z0 === 1 ? 0 : z0;
      if ((q >>> 5) % 4 === 0) { box(xx0, 3, zz0, xx0 + 2, 3, zz0 + 1, P[1]); put(xx0 + 1, 3, zz0, 0xFFFFFF); continue; }
      box(x0, 3, z0, x0 + 1, 3, z0 + 1, P[1]);
      box(x0, 4, z0, x0 + 1, 4, z0 + 1, P[0]);
      put(x0 + ((q >> 3) & 1), 4, z0 + ((q >> 4) & 1), 0xFFFFFF);
    }
    // cold glow along the inner rim
    for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) if (!wall(x, z) && (wall(x + 1, z) || wall(x - 1, z) || wall(x, z + 1) || wall(x, z - 1)) && ((x + z) & 1)) put(x, 4, z, 0xBFF4FF, EMIS);
    // lid divider rail over the middle of a joined freezer
    if ((px || nx) && !(c.px & 1)) for (let z = 0; z < 8; z++) if (!wall(0, z) || nz || pz) put(0, 5, z, 0xC0C8D0, GLOSS);
  };

  // PRODUCE STAND: two stepped rows of bins heaped with fruit & veg (sloped toward the customer at local -z)
  const PRODUCE = VEG.concat([
    { c: [0xD8342A, 0xE84A36, 0xC02A22] }, { c: [0x8CC63A, 0xA8D84A] }, { c: [0xFF9A1E, 0xFFB03A] }, { c: [0xF6D23A, 0xF8E060], top: 0x6A4A2A },
    { c: [0x7A3A8E, 0x8E4AA2, 0x6A2A7E] }, { c: [0x3E8A3A, 0xE8302A], big: 1 }, { c: [0xF4A07A, 0xF8B890] }, { c: [0x3A5A2A, 0x4A6A32] },
  ]);
  PAINT_FN.mproduce = function (s, c) {
    G.fill(0);
    const R_ = c.x & 1, L_ = (c.x >> 1) & 1, w = s.col, wD = sh(w, 0.76), wL = sh(w, 1.12), paint = 0x3E7A4A;
    const seed = hh(c.px + c.h * 2, c.py, c.pz, 43);
    box(0, 0, 0, 7, 2, 7, (x, y, z) => z === 0 ? (y === 2 ? wL : ((x >> 1) & 1 ? paint : sh(paint, 0.9))) : wD); // front skirt
    box(0, 3, 4, 7, 4, 7, wD);                     // back riser
    box(0, 2, 0, 7, 2, 3, w); box(0, 4, 4, 7, 4, 7, w); // bin floors
    // bins: front row (y3..4), back row (y5..6)
    let b = 0;
    for (const [z0, z1, y] of [[1, 3, 3], [4, 6, 5]]) {
      for (const [x0, x1] of [[1, 3], [5, 7]]) {
        const V = PRODUCE[hh(seed, b++, 0, 7) % PRODUCE.length];
        const xa = x0, xb = (x1 === 7 && !R_) ? 6 : x1;
        heap(xa, xb, z0, z1, y, y + 1, V, seed + b);
      }
      // lips & dividers
      box(0, y, z0 - 1, 7, y, z0 - 1, wL);
      box(0, y, z0, 0, y, z1, wL);
      box(4, y, z0, 4, y, z1, wL);
      // price tags on the bin lips
      for (const x of [2, 6]) put(x, y, z0 - 1, (hh(x, y, seed, 3) % 5) === 0 ? SHOPC.sale : 0xF4F4F0);
    }
    box(0, 5, 7, 7, 7, 7, (x, y) => y === 7 ? wL : 0x2E3A30); // chalkboard back
    for (let x = 1; x < 7; x++) if (hh(x, seed, 1, 3) & 1) put(x, 6, 7, 0xF4F4F0);
    if (!L_) box(0, 0, 0, 0, 7, 7, (x, y, z) => y > 4 && z < 4 + (y - 4) ? null : wD);
    if (!R_) box(7, 0, 0, 7, 7, 7, (x, y, z) => y > 4 && z < 4 + (y - 4) ? null : wD);
    if (!L_) box(0, 7, 4, 0, 7, 7, wL);
    rotateGrid(c.facing);
  };

  // DELI COUNTER / BAKERY CASE: glass display case, customer side local -z, staff side +z; rows join
  PAINT_FN.mcase = function (s, c) {
    G.fill(0);
    const R_ = c.x & 1, L_ = (c.x >> 1) & 1, bakery = s.style === 'bakery';
    const body = s.col, bodyD = sh(body, 0.8), trim = bakery ? 0xE8A0B0 : 0xC8A060, glass = 0xDDF4FF;
    const seed = hh(c.px + c.h * 2, c.py, c.pz, 47);
    box(0, 0, 0, 7, 3, 7, (x, y, z) => y === 0 ? SHOPC.darkD : z === 0 ? (y === 3 ? trim : (((x >> 1) + c.px * 4) & 1 ? body : sh(body, 0.93))) : bodyD);
    box(0, 3, 1, 7, 3, 5, bakery ? 0xF8F4EC : 0xEEF4F8, GLOSS);   // display bed
    box(0, 5, 6, 7, 5, 7, 0xC8CED6, GLOSS);                       // staff worktop
    box(0, 3, 6, 7, 4, 7, bodyD);
    // glass: front, curve, top
    for (let x = 0; x < 8; x++) { put(x, 4, 0, glass, GLASS); put(x, 5, 0, glass, GLASS); put(x, 6, 1, glass, GLASS); for (let z = 2; z <= 5; z++) put(x, 7, z, glass, GLASS); put(x, 7, 6, 0xB8C0C8, GLOSS); put(x, 6, 6, 0xFFF4DC, EMIS); }
    if (!L_) for (let y = 4; y <= 7; y++) for (let z = 0; z <= 6; z++) if (y < 6 || z >= y - 5) put(0, y, z, y === 4 ? 0xB8C0C8 : glass, y === 4 ? GLOSS : GLASS);
    if (!R_) for (let y = 4; y <= 7; y++) for (let z = 0; z <= 6; z++) if (y < 6 || z >= y - 5) put(7, y, z, y === 4 ? 0xB8C0C8 : glass, y === 4 ? GLOSS : GLASS);
    // goods
    const xa = L_ ? 0 : 1, xb = R_ ? 7 : 6;
    let x = xa, k = 0;
    while (x <= xb) {
      const q = hh(seed, k++, 3, 11), w = Math.min(xb - x + 1, 2 + (q & 1));
      if (bakery) {
        const t = q % 5;
        for (let xx = x; xx < x + w; xx++) for (let z = 2; z <= 4; z++) {
          if (t === 0) put(xx, 4, z, (xx + z) & 1 ? 0xE0A040 : 0xC8842A);                              // croissants
          else if (t === 1) put(xx, 4, z, (xx + z) & 1 ? [0xF08FB0, 0x6A3A1E, 0xF4E8D0][(q >>> 4) % 3] : 0xD89A5A); // donuts
          else if (t === 2) { put(xx, 4, z, [0xE84A7A, 0x3E7AD8, 0xF6D23A][(q >>> 4) % 3]); if (z < 4) put(xx, 5, z, 0xFFF4F8); } // cupcakes
          else if (t === 3) { put(xx, 4, z, 0xF4E0B8); put(xx, 5, z, z === 2 ? 0xE84A5A : 0x6A3A1E); } // cake slices
          else put(xx, 4, z, [0xF6B8C8, 0xB8E0B0, 0xD8C0F0, 0xF8E08A][(xx + z) & 3]);            // macarons
        }
      } else {
        const t = q % 5;
        for (let xx = x; xx < x + w; xx++) for (let z = 2; z <= 4; z++) {
          if (t === 0) { put(xx, 4, z, 0xF2C84A); if ((xx + z) & 1) put(xx, 5, z, 0xE8B83A); }        // cheese wheel
          else if (t === 1) put(xx, 4, z, (xx + z + k) % 3 ? 0x8A2A2A : 0xF4E0E0);                  // salami
          else if (t === 2) { put(xx, 4, z, 0xF0A0A0); if (z === 3) put(xx, 5, z, 0xF4B8B8); }        // ham
          else if (t === 3) put(xx, 4, z, (hh(xx, z, q, 1) & 1) ? 0x5A7A2A : 0x3A4A1E);            // olives
          else put(xx, 4, z, [0xE8402A, 0xF6D23A, 0x5AA83A, 0xF4F0E4][(xx * 3 + z) & 3]);          // salads
        }
        box(x, 3, 1, x + w - 1, 3, 1, 0xF4F4F0); put(x, 4, 1, 0xF4F4F0); // price stick label
      }
      x += w;
    }
    rotateGrid(c.facing);
  };

  // CHECKOUT: belt runs along local x toward the bagging end (scanner on that side); cashier behind (+z)
  PAINT_FN.mcheck = function (s, c) {
    G.fill(0);
    const m = c.x, endR = (m >> 2) & 1, endL = (m >> 3) & 1;
    // paint as if the bagging end is at local +x, mirror otherwise
    const flip = endL && !endR;
    const R_ = flip ? (m >> 1) & 1 : m & 1, L_ = flip ? m & 1 : (m >> 1) & 1;
    const body = s.col, acc = SHOPC.brand, belt = 0x2A2E34, sd = seedOf(c);
    box(0, 0, 0, 7, 3, 7, (x, y, z) => y === 0 ? SHOPC.darkD : (z === 0 && y === 2 ? acc : body));
    box(0, 4, 0, 7, 4, 7, 0xC8CED6, GLOSS);
    const scan = endR || endL || (!R_ && !L_) ? 1 : 0; // scanner station next to the bagging end (or on a lone counter)
    const bx1 = scan ? 4 : 7; // belt length
    for (let x = 0; x <= bx1; x++) for (let z = 1; z <= 4; z++) put(x, 4, z, ((x + c.px * 8) & 1) ? belt : 0x3A3F46);
    box(0, 5, 0, bx1, 5, 0, 0xB8C0C8, GLOSS); box(0, 5, 5, bx1, 5, 5, 0xB8C0C8, GLOSS);
    if (!L_) { box(0, 4, 1, 0, 5, 4, 0xB8C0C8, GLOSS); }
    if (scan) {
      box(5, 4, 1, 6, 4, 3, 0xCFEFFF, GLASS); box(5, 3, 1, 6, 3, 3, 0x1E232B); box(5, 3, 2, 6, 3, 2, 0xFF3A3A, EMIS); // scanner window + laser
      box(5, 5, 4, 6, 6, 5, 0x2A2E34, GLOSS); box(5, 5, 3, 6, 6, 3, 0x2A2E34); put(5, 5, 3, 0xFF3A3A, EMIS); put(6, 5, 3, 0xFF3A3A, EMIS); // scanner tower
      put(7, 5, 0, 0x2A2E34); put(7, 6, 0, 0x2A2E34); put(7, 6, 1, 0x5AFF7A, EMIS);              // card terminal
      // POS monitor on a pole for the cashier (+z)
      put(2, 5, 6, 0x5A6068); box(1, 6, 6, 3, 7, 6, 0x2A2E34); box(1, 6, 7, 3, 7, 7, 0x3AA8FF, EMIS); put(2, 7, 7, 0xF4F4F4, EMIS);
      put(2, 6, 5, 0x5AFF7A, EMIS); // customer display (back of the monitor)
    }
    // groceries on the belt / a divider bar
    if (sd & 1) box(1, 5, 1, 1, 5, 4, 0x3A8A5A);
    const GR = [0xE8302A, 0xF6D23A, 0x3E7AD8, 0xF4F4F0, 0x3AB84A, 0xFF8A2A];
    if (sd & 2) { box(2, 5, 2, 3, 6, 3, GR[(sd >>> 2) % 6]); put(2, 6, 2, GR[(sd >>> 3) % 6]); }
    if ((sd & 12) === 4 && !scan) { put(5, 5, 2, GR[sd % 6]); put(6, 5, 3, GR[(sd + 2) % 6]); }
    // drawer on the cashier side
    box(2, 2, 7, 5, 3, 7, sh(body, 0.9)); box(3, 3, 7, 4, 3, 7, 0x8A949E);
    if (flip) mirrorX();
    rotateGrid(c.facing);
  };

  // CHECKOUT END: bagging well with rollers continuing the belt, paper bags with groceries
  PAINT_FN.mcheckend = function (s, c) {
    G.fill(0);
    const m = c.x, chkR = m & 1, chkL = (m >> 1) & 1;
    const flip = chkR && !chkL; // paint with the checkout on the local -x side
    const body = s.col, acc = SHOPC.brand, sd = seedOf(c);
    box(0, 0, 0, 7, 3, 7, (x, y, z) => y === 0 ? SHOPC.darkD : (z === 0 && y === 2 ? acc : body));
    box(0, 3, 1, 7, 3, 5, 0xB8C0C8, GLOSS); // well floor (lower)
    box(0, 4, 0, 7, 4, 0, 0xC8CED6, GLOSS); box(0, 4, 6, 7, 4, 7, 0xC8CED6, GLOSS); box(7, 4, 0, 7, 4, 7, 0xC8CED6, GLOSS);
    box(0, 5, 0, 7, 5, 0, 0xB8C0C8, GLOSS); box(7, 5, 0, 7, 5, 5, 0xB8C0C8, GLOSS); box(0, 5, 5, 7, 5, 5, 0xB8C0C8, GLOSS);
    // rollers
    for (let x = 0; x <= 2; x++) for (let z = 1; z <= 4; z++) put(x, 4 - (x === 2 ? 1 : 0), z, (x & 1) ? 0x9AA4AE : 0xDCE2E8, GLOSS);
    // paper bags
    const bag = WD.kraft, bagD = sh(bag, 0.85);
    const bags = (sd & 1) ? [[3, 1]] : [[3, 1], [5, 3]];
    for (const [x0, z0] of bags) {
      box(x0, 4, z0, x0 + 1, 6, z0 + 1, (x, y, z) => y === 6 ? sh(bag, 1.1) : ((x + y) & 1 ? bag : bagD));
      const q = hh(x0, z0, sd, 9) % 3;
      if (q === 0) { put(x0, 7, z0, 0xE0B070); put(x0, 7, z0 + 1, 0xE0B070); }          // baguette
      else if (q === 1) { put(x0 + 1, 7, z0, 0x5AB03A); put(x0, 7, z0 + 1, 0x6AC048); } // greens
      else put(x0 + 1, 7, z0 + 1, 0xF07A1E);                                            // carrot tops
    }
    // folded bags stack at the back
    box(5, 5, 6, 6, 5, 7, bag); box(5, 6, 6, 6, 6, 7, bagD);
    if (flip) mirrorX();
    rotateGrid(c.facing);
  };

  // SELF-CHECKOUT KIOSK: pedestal, scanner plate with laser, big glowing screen, bagging shelf, status light
  PAINT_FN.mself = function (s, c) {
    G.fill(0);
    const body = s.col, sd = seedOf(c);
    box(1, 0, 2, 6, 3, 7, (x, y, z) => y === 0 ? SHOPC.darkD : (y === 2 && z === 2 ? SHOPC.brand : body));
    box(0, 4, 1, 7, 4, 7, 0xC8CED6, GLOSS);
    box(1, 4, 1, 3, 4, 3, 0xCFEFFF, GLASS); box(1, 3, 2, 3, 3, 2, 0xFF3A3A, EMIS); box(1, 3, 1, 3, 3, 1, 0x1E232B); box(1, 3, 3, 3, 3, 3, 0x1E232B);
    // screen (faces -z), frame behind
    box(2, 5, 5, 6, 7, 6, 0x2A2E34, GLOSS);
    const scr = (x, y) => y === 7 ? SHOPC.brandL : (x === 6 && y === 5 ? 0x5AFF7A : (y === 6 && x < 5 ? (x & 1 ? 0xE8F4FF : 0xB8D8F0) : 0x3A7AD8));
    for (let x = 2; x <= 6; x++) for (let y = 5; y <= 7; y++) put(x, y, 4, scr(x, y), EMIS);
    box(4, 4, 6, 4, 4, 6, 0x5A6068);
    // bag on the bagging scale
    box(5, 5, 1, 6, 6, 2, (x, y) => y === 6 ? sh(WD.kraft, 1.1) : WD.kraft);
    if (sd & 1) put(5, 7, 1, 0x5AB03A);
    // status light pole
    box(7, 5, 7, 7, 6, 7, 0x5A6068); put(7, 7, 7, (sd & 6) ? 0x5AFF7A : 0xFFB02A, EMIS);
    rotateGrid(c.facing);
  };

  // CART ROW: nested shopping carts along local x (handles at +x); rows join into one long line of carts
  PAINT_FN.mcarts = function (s, c) {
    G.fill(0);
    const R_ = c.x & 1, L_ = (c.x >> 1) & 1;
    const wire = s.col, wireD = sh(wire, 0.8), red = 0xD8322A;
    const X = c.px * 8;
    for (let x = 0; x < 8; x++) {
      const g = (X + x) % 3;
      // wheels & chassis
      if (g === 0) { put(x, 0, 1, 0x2A2A2E); put(x, 0, 6, 0x2A2A2E); }
      put(x, 1, 1, wireD, GLOSS); put(x, 1, 6, wireD, GLOSS);
      // basket walls (mesh) & floor
      for (let y = 3; y <= 6; y++) { const mesh = ((x + y) & 1) === 0 || y === 6 || y === 3; if (mesh) { put(x, y, 1, wire, GLOSS); put(x, y, 6, wire, GLOSS); } }
      box(x, 2, 2, x, 2, 5, wireD, GLOSS);
      put(x, 3, 3, wireD); put(x, 3, 4, wireD);
      // handle bars (one per nested cart)
      if (g === 2) { box(x, 7, 1, x, 7, 6, red, GLOSS); put(x, 6, 2, red); put(x, 6, 5, red); }
      if (g === 1) { box(x, 5, 2, x, 5, 5, (xx, y, z) => (z & 1) ? wire : null, GLOSS); }
    }
    if (!L_) for (let y = 2; y <= 6; y++) for (let z = 1; z <= 6; z++) if (((y + z) & 1) === 0 || y === 6 || z === 1 || z === 6) put(0, y, z, wire, GLOSS);
    if (!R_) { box(7, 7, 1, 7, 7, 6, red, GLOSS); box(7, 5, 3, 7, 6, 4, red); }
    rotateGrid(c.facing);
  };

  // BASKET STACK: nested red baskets on a small stand, handles on top
  PAINT_FN.mbaskets = function (s, c) {
    G.fill(0);
    const sd = seedOf(c), base = s.col;
    box(1, 0, 1, 6, 0, 6, 0x5A6068);
    const n = 4 + (sd & 1);
    for (let k = 0; k < n; k++) {
      const y = 1 + k, col = (sd & 16) && k === n - 1 ? 0x3E7AD8 : base;
      for (let z = 1; z <= 6; z++) for (let x = 1; x <= 6; x++) {
        const edge = x === 1 || x === 6 || z === 1 || z === 6;
        if (!edge) { if (k === n - 1) put(x, y - 1, z, sh(col, 0.7)); continue; }
        put(x, y, z, k === n - 1 ? (((x + z) & 1) && y > 0 ? col : sh(col, 1.08)) : sh(col, 0.78));
      }
    }
    const yt = n;
    for (let x = 2; x <= 5; x++) { put(x, Math.min(7, yt + 1), 1, 0x2A2A2E); put(x, Math.min(7, yt + 1), 6, 0x2A2A2E); }
    put(2, yt, 1, 0x2A2A2E); put(5, yt, 6, 0x2A2A2E);
  };

  // STORE SIGN: wall-mounted glowing lightbox; a row spells the store name next to a cart logo
  const FONT = {
    S: ['XXX', 'X..', 'XXX', '..X', 'XXX'], U: ['X.X', 'X.X', 'X.X', 'X.X', 'XXX'], P: ['XXX', 'X.X', 'XXX', 'X..', 'X..'], E: ['XXX', 'X..', 'XX.', 'X..', 'XXX'],
    R: ['XX.', 'X.X', 'XX.', 'X.X', 'X.X'], M: ['X.X', 'XXX', 'XXX', 'X.X', 'X.X'], A: ['.X.', 'X.X', 'XXX', 'X.X', 'X.X'], K: ['X.X', 'X.X', 'XX.', 'X.X', 'X.X'],
    T: ['XXX', '.X.', '.X.', '.X.', '.X.'], H: ['X.X', 'X.X', 'XXX', 'X.X', 'X.X'], O: ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'], F: ['XXX', 'X..', 'XX.', 'X..', 'X..'], D: ['XX.', 'X.X', 'X.X', 'X.X', 'XX.'],
  };
  const CART = ['XX......', '.XXXXXXX', '..XXXXXX', '...XXXX.', '...X..X.'];
  const TILES = [
    ['...G....', '..RRRR..', '.RRRRRR.', '.RRRRRR.', '..RRRR..'], // apple
    ['......GG', '.....OG.', '...OOO..', '.OOOO...', 'OO......'], // carrot
    ['...BB...', '..WWWW..', '..WBBW..', '..WWWW..', '..WWWW..'], // milk
    ['..TTTT..', '.TtTtTT.', 'TTTTTTTT', 'TTTTTTTT', '........'], // bread
  ];
  const TILEC = { R: 0xFF4A3A, G: 0x6AD83A, O: 0xFF8A1E, W: 0xFFFFFF, B: 0x3A8AFF, T: 0xF0A850, t: 0xFFE0A0 };
  function textCols(word) { const cols = []; for (let i = 0; i < word.length; i++) { const g = FONT[word[i]]; for (let k = 0; k < 3; k++) cols.push(g.map(r => r[k] === 'X')); if (i < word.length - 1) cols.push(null); } return cols; }
  const WORDS = { SUPERMARKET: textCols('SUPERMARKET'), MARKET: textCols('MARKET'), SHOP: textCols('SHOP'), FOOD: textCols('FOOD') };
  function axisSpan(bi, o, DOFF) { const PS = DOFF[4], PSS = DOFF[2], a = Math.abs(o); if (a === 1) return [bi % PS, PS - 1]; if (a === PS) return [Math.floor(bi / PS) % (PSS / PS), PSS / PS - 1]; return [Math.floor(bi / PSS), 1e9]; }
  function scanRow(B, bi, DOFF, d, s, sp) {
    const o = DOFF[d], sp2 = axisSpan(bi, o, DOFF), p = sp2[0], max = sp2[1], dir = o > 0 ? 1 : -1;
    let n = 0;
    for (let k = 1; k < 16; k++) {
      const pp = p + dir * k;
      if (pp < 0 || pp > max) return -1;
      if (!joins(B[bi + o * k], s, sp, ['msign'])) return n;
      if (pp === 0 || pp === max) return -1;
      n++;
    }
    return -1;
  }
  PAINT_FN.msign = function (s, c) {
    G.fill(0);
    const R_ = c.x & 1, L_ = (c.x >> 1) & 1, idx = (c.x >> 2) & 15, n = (c.x >> 6) & 15;
    const bg = s.col, bgD = sh(bg, 0.72), rim = 0xFFD23A, txt = 0xFFF8E4, logoC = 0xFFB02A;
    box(0, 1, 5, 7, 7, 7, bgD);
    box(0, 1, 4, 7, 7, 4, (x, y) => (y === 1 || y === 7) ? rim : bg, 0);
    for (let x = 0; x < 8; x++) { put(x, 1, 4, rim, EMIS); put(x, 7, 4, rim, EMIS); }
    if (!R_) box(7, 1, 4, 7, 7, 4, rim, EMIS);
    if (!L_) box(0, 1, 4, 0, 7, 4, rim, EMIS);
    // view column (left→right for someone facing the sign) → local x
    const P = (vc, row, col) => { const x = 7 - vc; if (x >= 0 && x <= 7) put(x, 6 - row, 3, col, EMIS); };
    const logo = () => { pix(CART, (k, r) => P(k, r, logoC)); };
    if (n >= 1) {
      if (idx === 0) logo();
      else {
        const word = n >= 7 ? WORDS.SUPERMARKET : n >= 4 ? WORDS.MARKET : n === 3 ? WORDS.SHOP : null;
        if (word) {
          const avail = (n - 1) * 8, start = 8 + Math.floor((avail - word.length) / 2);
          for (let u = 0; u < 8; u++) { const col = word[idx * 8 + u - start]; if (col) for (let r = 0; r < 5; r++) if (col[r]) P(u, r, txt); }
        } else pix(TILES[0], (k, r, ch) => P(k, r, TILEC[ch]));
      }
    } else if (!R_) logo();
    else pix(TILES[(c.px + c.pz + c.h) & 3], (k, r, ch) => P(k, r, TILEC[ch])); // row runs past this chunk section: product icon tiles
    rotateGrid(c.facing);
  };

  // AISLE SIGN: hanging lightbox with the aisle number (n + 1) on all four sides
  const DIGIT = [
    ['.XX.', 'XXX.', '.XX.', '.XX.', 'XXXX'], ['XXX.', '...X', '.XX.', 'X...', 'XXXX'], ['XXX.', '...X', '.XX.', '...X', 'XXX.'], ['X..X', 'X..X', 'XXXX', '...X', '...X'],
    ['XXXX', 'X...', 'XXX.', '...X', 'XXX.'], ['.XX.', 'X...', 'XXX.', 'X..X', '.XX.'], ['XXXX', '...X', '..X.', '.X..', '.X..'], ['.XX.', 'X..X', '.XX.', 'X..X', '.XX.'],
  ];
  PAINT_FN.maisle = function (s, c) {
    G.fill(0);
    const n = c.x & 7, bg = s.col, band = 0xFFC83A, dg = DIGIT[n];
    box(1, 0, 1, 6, 6, 6, (x, y) => y === 6 ? band : y === 0 ? sh(band, 0.85) : bg);
    // digits: view col k (0..3) on each face
    pix(dg, (k, r) => {
      const y = 5 - r;
      put(5 - k, y, 1, 0xFFFFFF, EMIS);     // -z face (viewer's right is -x)
      put(2 + k, y, 6, 0xFFFFFF, EMIS);     // +z face
      put(1, y, 2 + k, 0xFFFFFF, EMIS);     // -x face (viewer's right is +z)
      put(6, y, 5 - k, 0xFFFFFF, EMIS);     // +x face
    });
    const hang = c.nc[2] !== AIR;
    if (hang) { box(2, 7, 3, 2, 7, 4, 0x5A6068); box(5, 7, 3, 5, 7, 4, 0x5A6068); }
  };

  // CEILING LIGHT STRIP: hangs under a ceiling (head = 1) or lies on a surface; flat neighbours link into strips
  PAINT_FN.mlight = function (s, c) {
    G.fill(0);
    const m = c.x, px = m & 1, nx = (m >> 1) & 1, pz = (m >> 2) & 1, nz = (m >> 3) & 1;
    const hang = !!c.head, yH = hang ? 6 : 0, yD = hang ? 5 : 1, frame = 0xE8ECF0, glow = s.col;
    const alongX = (px || nx) || !(pz || nz);
    const seg = (x0, z0, x1, z1) => { box(x0, yH, z0, x1, yH, z1, frame, GLOSS); box(x0, yD, z0, x1, yD, z1, glow, EMIS); };
    if (alongX) seg(nx ? 0 : 1, 2, px ? 7 : 6, 5);
    if (pz || nz) seg(2, nz ? 0 : (alongX ? 2 : 1), 5, pz ? 7 : (alongX ? 5 : 6));
    // end caps
    if (alongX && !nx) box(1, yD, 2, 1, yD, 5, frame, GLOSS);
    if (alongX && !px) box(6, yD, 2, 6, yD, 5, frame, GLOSS);
    if (hang) put(3, 7, 3, 0x9AA2AA);
  };

  // SLIDING DOOR: automatic glass door in the block's middle plane; open prop slides the panels aside
  PAINT_FN.mdoor = function (s, c) {
    G.fill(0);
    const m = c.x, R_ = m & 1, L_ = (m >> 1) & 1, U_ = (m >> 2) & 1, D_ = (m >> 3) & 1, open = (m >> 4) & 1;
    const frame = s.frame || 0xA8B2BC, frameD = s.frameD || 0x7A848F, glass = s.col || 0xCFEFFF, dot = s.dot || 0xF4F8FA;
    // fixed outer posts
    if (!L_) box(0, 0, 3, 0, 7, 4, frame, GLOSS);
    if (!R_) box(7, 0, 3, 7, 7, 4, frame, GLOSS);
    if (!D_) box(0, 0, 3, 7, 0, 4, 0x3A3F46);
    const yTop = U_ ? 7 : 6;
    if (!U_) { box(0, 7, 2, 7, 7, 5, frame, GLOSS); put(3, 7, 1, open ? 0x5AFF7A : 0xFFB02A, EMIS); put(4, 7, 6, open ? 0x5AFF7A : 0xFFB02A, EMIS); }
    const panel = (x0, x1, z, edgeL, edgeR) => {
      for (let y = D_ ? 0 : 1; y <= yTop; y++) for (let x = x0; x <= x1; x++) {
        const edge = (x === x0 && edgeL) || (x === x1 && edgeR) || (y === yTop && !U_) || (y === 1 && !D_);
        if (edge) put(x, y, z, frameD, GLOSS);
        else put(x, y, z, (y === 3 && (x & 1)) ? dot : glass, (y === 3 && (x & 1)) ? 0 : GLASS);
      }
    };
    const lone = !L_ && !R_;
    if (lone) {
      if (!open) { panel(1, 3, 4, false, true); panel(4, 6, 4, true, false); }
      else { panel(1, 2, 3, false, true); panel(5, 6, 3, true, false); }
    } else {
      // one panel per block, meeting at the inner edge; opens toward the outer post
      const outerL = !L_; // outer post on the local -x side
      if (!open) panel(outerL ? 1 : 0, outerL ? 7 : 6, 4, !outerL, outerL);
      else if (outerL) panel(1, 2, 3, false, true); else panel(5, 6, 3, true, false);
    }
    rotateGrid(c.facing);
  };

  // SALE DISPLAY: pallet, pyramid of cans, a big glowing % tag on top (double-sided)
  const PCT = ['X..X', '..X.', '.X..', 'X..X'];
  PAINT_FN.mpromo = function (s, c) {
    G.fill(0);
    const sd = seedOf(c), CANS = [[0xE8302A, 0xF4F4F4], [0xF6C21A, 0xE8302A], [0x3E7AD8, 0xF4F4F4], [0x3AA84A, 0xF6D23A]];
    const A = CANS[sd & 3], B = CANS[(sd + 1) & 3];
    box(0, 0, 0, 7, 0, 7, (x, y, z) => ((z & 3) === 3) ? null : (x & 1 ? WD.oak : WD.oakL));
    box(0, 0, 0, 0, 0, 7, WD.oakD); box(7, 0, 0, 7, 0, 7, WD.oakD);
    const layer = (y, a, b) => { for (let z = a; z <= b; z++) for (let x = a; x <= b; x++) { const P = (x + z) & 1 ? A : B; put(x, y, z, (x === a || x === b || z === a || z === b) ? P[0] : sh(P[0], 0.85)); } };
    layer(1, 1, 6); layer(2, 2, 5); layer(3, 3, 4);
    for (let x = 1; x <= 6; x++) { put(x, 1, 1, (x & 1) ? A[1] : A[0]); }
    // tag
    const tag = 0xFFD02A, red = 0xE8302A;
    for (let y = 4; y <= 7; y++) for (let x = 1; x <= 6; x++) {
      if ((y === 7 || y === 4) && (x === 1 || x === 6)) continue;
      const k = x - 2, r = 7 - y;
      const on = k >= 0 && k < 4 && PCT[r][k] === 'X';
      put(7 - x, y, 3, on ? red : tag, EMIS); put(x, y, 4, on ? red : tag, EMIS);
    }
    rotateGrid(c.facing);
  };

  // FLOWER STAND: two stepped rows of zinc buckets with bouquets (front at local -z)
  PAINT_FN.mflowers = function (s, c) {
    G.fill(0);
    const sd = seedOf(c), paint = s.col, pD = sh(paint, 0.8), zinc = 0xB8C0C8;
    box(0, 0, 0, 7, 1, 3, (x, y, z) => z === 0 ? (y === 1 ? sh(paint, 1.12) : paint) : pD);
    box(0, 0, 4, 7, 3, 7, (x, y, z) => z === 4 ? (y === 3 ? sh(paint, 1.12) : paint) : pD);
    const FL = [[0xE8203A, 0xB0182A], [0xF6D23A, 0x6A4A2A], [0xB070FF, 0x8A4AD8], [0xFFFFFF, 0xF6D23A], [0xF08FB0, 0xE8608A], [0xFF8A2A, 0xE8302A]];
    const bucket = (x0, y0, z0, k) => {
      box(x0, y0, z0, x0 + 1, y0 + 1, z0 + 1, (x, y) => y === y0 + 1 ? sh(zinc, 1.08) : zinc, GLOSS);
      const F = FL[hh(k, sd, 3, 5) % FL.length];
      for (let x = x0 - (x0 > 0 ? 1 : 0); x <= x0 + 2 && x < 8; x++) for (let z = z0; z <= z0 + 1; z++) {
        const q = hh(x, z, sd + k, 7);
        put(x, y0 + 2, z, (q & 3) === 0 ? WD.leaf : F[q & 4 ? 1 : 0]);
        if ((q & 24) === 0 && y0 + 3 < 8) put(x, y0 + 3, z, F[0]);
      }
      put(x0, y0 + 2, z0, WD.kraft);
    };
    bucket(1, 2, 1, 0); bucket(5, 2, 1, 1); bucket(0, 4, 5, 2); bucket(3, 4, 5, 3); bucket(6, 4, 5, 4);
    box(3, 1, 0, 4, 1, 0, 0x2E3A30); put(3, 1, 0, 0xF4F4F0);
    rotateGrid(c.facing);
  };

  // SHOP FLOOR: glossy big tiles, subtle grid & speckle
  VX.floorPat.shop = (s, c, x, z) => {
    if (x === 0 || z === 0) return [s.col2, GLOSS];
    let col = ((c.px + c.pz) & 1) ? s.col : s.col3;
    const q = hh(x, z, c.h + c.px * 4 + c.pz * 8, 13);
    if ((q & 31) === 0) col = sh(col, 0.92); else if ((q & 31) === 1) col = sh(col, 1.03);
    return [col, GLOSS];
  };

  // ---------------------------------------------------------------- neighbour context
  VX.ctxHook.fcrown = (c, sp, s, nbS) => { let m = 0; for (let d = 0; d < 6; d++) if (kindIs(nbS[d], ['fcrown'])) m |= 1 << d; return m; };
  VX.ctxHook.ftrunk = (c, sp, s, nbS) => (kindIs(nbS[3], ['ftrunk']) ? 1 : 0) | (kindIs(nbS[2], ['fcrown']) ? 2 : 0) | (kindIs(nbS[2], ['ftrunk']) ? 4 : 0);
  VX.ctxHook.trough = rowHook({ axis: true });
  VX.ctxHook.laundry = rowHook({ axis: true });
  VX.ctxHook.sail = rowHook({ vert: true });
  VX.ctxHook.bdoor = rowHook({ vert: true, axis: true });
  VX.ctxHook.fbed = flatHook(['fbed']);
  VX.ctxHook.mshelf = rowHook({ vert: true });
  VX.ctxHook.mfridge = rowHook({ vert: true });
  VX.ctxHook.mfreezer = flatHook(['mfreezer']);
  VX.ctxHook.mproduce = rowHook();
  VX.ctxHook.mcase = rowHook({ style: true });
  VX.ctxHook.mcarts = rowHook({ axis: true });
  VX.ctxHook.mlight = flatHook(['mlight']);
  VX.ctxHook.mcheck = (c, sp, s, nbS) => {
    const q = c.facing & 3, K2 = ['mcheck', 'mcheckend'];
    const r = nbS[LXP[q]], l = nbS[LXM[q]];
    return (joins(r, s, sp, K2) ? 1 : 0) | (joins(l, s, sp, K2) ? 2 : 0) | (joins(r, s, sp, ['mcheckend']) ? 4 : 0) | (joins(l, s, sp, ['mcheckend']) ? 8 : 0);
  };
  VX.ctxHook.mcheckend = (c, sp, s, nbS) => { const q = c.facing & 3; return (joins(nbS[LXP[q]], s, sp, ['mcheck']) ? 1 : 0) | (joins(nbS[LXM[q]], s, sp, ['mcheck']) ? 2 : 0); };
  VX.ctxHook.msign = (c, sp, s, nbS, B, bi, DOFF) => {
    const q = c.facing & 3, dR = LXP[q], dL = LXM[q];
    let x = (joins(nbS[dR], s, sp, ['msign']) ? 1 : 0) | (joins(nbS[dL], s, sp, ['msign']) ? 2 : 0);
    if (B && DOFF) { const a = scanRow(B, bi, DOFF, dR, s, sp), b = scanRow(B, bi, DOFF, dL, s, sp); if (a >= 0 && b >= 0 && a + b + 1 <= 15) x |= (a << 2) | ((a + b + 1) << 6); }
    return x;
  };
  VX.ctxHook.maisle = (c, sp, s) => propOf(s, 'n') & 7;
  const doorRow = rowHook({ vert: true, axis: true });
  VX.ctxHook.mdoor = (c, sp, s, nbS) => doorRow(c, sp, s, nbS) | (propOf(s, 'open') > 0 ? 16 : 0);

  // ---------------------------------------------------------------- kinds
  Object.assign(KIND, {
    fcrown: { cls: OTHER }, ftrunk: { cls: OTHER }, trough: { cls: OTHER }, scarecrow: { cls: OTHER }, pumpkins: { cls: OTHER }, vegcrate: { cls: OTHER },
    milkcan: { cls: OTHER }, barrow: { cls: OTHER }, beehive: { cls: OTHER }, birdbath: { cls: OTHER }, mailbox: { cls: OTHER }, picnic: { cls: OTHER },
    sail: { cls: AIR }, fbed: { cls: OTHER }, laundry: { cls: AIR }, bdoor: { cls: WALL, opaque: true },
    mshelf: { cls: OTHER }, mfridge: { cls: OTHER }, mfreezer: { cls: OTHER }, mproduce: { cls: OTHER }, mcase: { cls: OTHER }, mcheck: { cls: OTHER }, mcheckend: { cls: OTHER },
    mself: { cls: OTHER }, mcarts: { cls: OTHER }, mbaskets: { cls: OTHER }, msign: { cls: OTHER }, maisle: { cls: AIR }, mlight: { cls: AIR }, mdoor: { cls: DOOR },
    mpromo: { cls: OTHER }, mflowers: { cls: OTHER },
  });

  // ---------------------------------------------------------------- collision / selection
  const R4 = (b) => (s, sel, t, f) => [rotB(b, f)];
  Object.assign(VX.boxHook, {
    fcrown: () => FULLB,
    ftrunk: () => [[0.3, 0, 0.3, 0.7, 1, 0.7]],
    trough: R4([0, 0, 0.125, 1, 0.75, 0.875]),
    scarecrow: (s, sel) => sel ? [[0.1, 0, 0.25, 0.9, 1, 0.75]] : [[0.25, 0, 0.25, 0.75, 1, 0.75]],
    pumpkins: () => [[0, 0, 0, 1, 0.5, 1]],
    vegcrate: R4([0, 0, 0.125, 1, 0.625, 0.875]),
    milkcan: () => [[0.15, 0, 0.15, 0.85, 1, 0.85]],
    barrow: R4([0.125, 0, 0, 0.875, 0.75, 1]),
    beehive: () => [[0.125, 0, 0.125, 0.875, 1, 0.875]],
    birdbath: () => [[0.1, 0, 0.1, 0.9, 0.875, 0.9]],
    mailbox: (s, sel, t, f) => sel ? [rotB([0.25, 0, 0.1, 0.85, 1, 0.9], f)] : [[0.35, 0, 0.35, 0.65, 1, 0.65]],
    picnic: () => [[0, 0, 0, 1, 0.625, 1]],
    sail: (s, sel, t, f) => sel ? [rotB([0, 0, 0, 1, 1, 0.5], f)] : [],
    fbed: (s, sel) => sel ? [[0, 0, 0, 1, 0.625, 1]] : [[0, 0, 0, 1, 0.375, 1]],
    laundry: (s, sel, t, f) => sel ? [rotB([0, 0, 0.3, 1, 1, 0.7], f)] : [],
    bdoor: () => FULLB,
    mshelf: () => FULLB, mfridge: () => FULLB,
    mfreezer: () => [[0, 0, 0, 1, 0.75, 1]],
    mproduce: () => [[0, 0, 0, 1, 0.875, 1]],
    mcase: () => FULLB,
    mcheck: () => [[0, 0, 0, 1, 0.75, 1]], mcheckend: () => [[0, 0, 0, 1, 0.75, 1]],
    mself: R4([0, 0, 0.125, 1, 1, 1]),
    mcarts: R4([0, 0, 0.125, 1, 1, 0.875]),
    mbaskets: () => [[0.125, 0, 0.125, 0.875, 0.875, 0.875]],
    msign: R4([0, 0.125, 0.5, 1, 1, 1]),
    maisle: (s, sel) => sel ? [[0.125, 0, 0.125, 0.875, 1, 0.875]] : [],
    mlight: (s, sel, t) => { if (!sel) return []; const hang = t.has('head') && t.get(s, 'head'); return [hang ? [0, 0.625, 0.125, 1, 1, 0.875] : [0, 0, 0.125, 1, 0.25, 0.875]]; },
    mdoor: (s, sel, t, f) => { const open = t.has('open') && t.get(s, 'open'); if (sel) return [rotB([0, 0, 0.375, 1, 1, 0.625], f)]; return open ? [] : [rotB([0, 0, 0.375, 1, 1, 0.625], f)]; },
    mpromo: () => [[0.05, 0, 0.05, 0.95, 1, 0.95]],
    mflowers: () => [[0, 0, 0, 1, 0.75, 1]],
  });
  const front = (c) => { c.facing = 2; };
  Object.assign(VX.iconHook, {
    fcrown: (c) => { c.x = 0; c.nc[3] = AIR; }, ftrunk: (c) => { c.x = 2; },
    trough: front, scarecrow: front, vegcrate: front, barrow: (c) => { c.facing = 3; }, mailbox: (c) => { c.facing = 3; }, picnic: front,
    sail: (c) => { c.facing = 2; c.x = 0; }, laundry: (c) => { c.facing = 2; c.x = 0; }, bdoor: (c) => { c.facing = 2; c.x = 0; }, fbed: (c) => { c.x = 0; },
    mshelf: (c) => { c.facing = 2; c.x = 0; }, mfridge: (c) => { c.facing = 2; c.x = 0; }, mfreezer: (c) => { c.x = 0; }, mproduce: front, mcase: front,
    mcheck: (c) => { c.facing = 2; c.x = 0; }, mcheckend: (c) => { c.facing = 2; c.x = 2; }, mself: front, mcarts: (c) => { c.facing = 2; c.x = 0; }, msign: (c) => { c.facing = 2; c.x = 0; },
    maisle: (c, sp, s) => { c.x = propOf(s, 'n') & 7; c.nc[2] = SOLID; }, mlight: (c) => { c.head = 0; c.x = 0; }, mdoor: (c) => { c.facing = 2; c.x = 0; }, mpromo: front, mflowers: front,
  });

  // ---------------------------------------------------------------- the blocks
  const SHELF_NAMES = { fruit: 'Fruit', veg: 'Vegetable', bakery: 'Bakery', pantry: 'Pantry', drinks: 'Drinks', snacks: 'Snacks', cereal: 'Cereal', sweets: 'Sweets', dairy: 'Dairy', flowers: 'Flower', tech: 'Tech', toys: 'Toy', home: 'Home & Cleaning', pharmacy: 'Pharmacy' };
  VX.LIFE = { SHELF_CATS: Object.keys(SHELF_NAMES), SHELF };
  VX.defineExtra.push(function (K) {
    const { add, FACING4 } = K;
    const G_ = K.G, life = { group: G_.LIFE || G_.ARCH, cat: 'vlife' }, shop = { group: G_.SHOP || G_.ARCH, cat: 'vshop' };
    const L = (name, display, sp, o) => add(name, display, sp, Object.assign({ filter: 0 }, life, o || {}));
    const S = (name, display, sp, o) => add(name, display, sp, Object.assign({ filter: 0 }, shop, o || {}));
    // ---- village life
    const FR = { apple: 'Apple', orange: 'Orange', cherry: 'Cherry Blossom', plum: 'Plum' };
    for (const f in FR) L('vx_fruit_crown_' + f, FR[f] + ' Tree Crown', { kind: 'fcrown', fruit: f, col: CROWN[f].l[0] }, { sound: 'grass', hard: 0.3 });
    L('vx_fruit_trunk', 'Fruit Tree Trunk', { kind: 'ftrunk', col: 0x7A5638 }, { sound: 'wood', hard: 1.2 });
    L('vx_trough', 'Water Trough', { kind: 'trough', col: 0x9A6A3A }, { props: [FACING4], sound: 'wood', hard: 1 });
    L('vx_scarecrow', 'Scarecrow', { kind: 'scarecrow', col: 0xD8B860 }, { props: [FACING4], sound: 'grass', hard: 0.5 });
    L('vx_pumpkin_pile', 'Pumpkin Pile', { kind: 'pumpkins', col: 0xE8781A }, { sound: 'wood', hard: 0.6 });
    L('vx_veg_crate', 'Vegetable Crate', { kind: 'vegcrate', col: 0xB08A5A }, { props: [FACING4], sound: 'wood', hard: 0.8 });
    L('vx_milk_can', 'Milk Churn', { kind: 'milkcan', col: 0xC8CED6 }, { sound: 'metal', hard: 1 });
    L('vx_wheelbarrow', 'Wheelbarrow', { kind: 'barrow', col: 0x3E8A4A }, { props: [FACING4], sound: 'metal', hard: 1 });
    L('vx_beehive', 'Beehive', { kind: 'beehive', col: 0xF2DC8A }, { sound: 'wood', hard: 0.8 });
    L('vx_birdbath', 'Bird Bath', { kind: 'birdbath', col: 0xB8B4AA }, { sound: 'stone', hard: 1.5 });
    L('vx_mailbox', 'Mailbox', { kind: 'mailbox', col: 0x3F6FB8 }, { props: [FACING4], sound: 'metal', hard: 1 });
    L('vx_picnic_table', 'Picnic Table', { kind: 'picnic', col: 0xB08050 }, { props: [FACING4], sound: 'wood', hard: 1 });
    L('vx_windmill_sail', 'Windmill Sail', { kind: 'sail', col: 0xF2E8D2 }, { props: [FACING4], kind: 'wallmount', solid: false, sound: 'wool', hard: 0.5 });
    L('vx_flowerbed', 'Raised Flower Bed', { kind: 'fbed', bed: 'mix', col: 0x8A5E32 }, { sound: 'grass', hard: 0.4 });
    L('vx_flowerbed_roses', 'Rose Bed', { kind: 'fbed', bed: 'roses', col: 0x8A5E32 }, { sound: 'grass', hard: 0.4 });
    L('vx_flowerbed_tulips', 'Tulip Bed', { kind: 'fbed', bed: 'tulips', col: 0x8A5E32 }, { sound: 'grass', hard: 0.4 });
    L('vx_laundry_line', 'Laundry Line', { kind: 'laundry', col: 0xE8E0CC }, { props: [FACING4], solid: false, sound: 'wool', hard: 0.2 });
    L('vx_barn_door', 'Barn Door', { kind: 'bdoor', col: 0xB5382E }, { props: [FACING4], opaque: true, filter: 15, sound: 'wood', hard: 2 });
    // ---- supermarket
    for (const cat in SHELF_NAMES) S('vx_shop_shelf_' + cat, SHELF_NAMES[cat] + ' Shelf', { kind: 'mshelf', cat, col: SHELF[cat].acc }, { props: [FACING4], sound: 'metal', hard: 1.5 });
    S('vx_shop_fridge_drinks', 'Drinks Fridge', { kind: 'mfridge', style: 'drinks', cat: 'drinks', col: 0x2E343C, sign: 0x2A8AE8 }, { props: [FACING4], light: [4, 6, 7], sound: 'glass', hard: 1.5 });
    S('vx_shop_fridge_dairy', 'Dairy Fridge', { kind: 'mfridge', style: 'dairy', cat: 'dairy', col: 0xE4E8EC, sign: 0x5AC8F0 }, { props: [FACING4], light: [4, 6, 7], sound: 'glass', hard: 1.5 });
    S('vx_shop_freezer', 'Ice-Cream Freezer', { kind: 'mfreezer', col: 0xF0F2F4 }, { light: [2, 4, 6], sound: 'metal', hard: 1.5 });
    S('vx_shop_produce', 'Produce Stand', { kind: 'mproduce', col: 0xA87A48 }, { props: [FACING4], sound: 'wood', hard: 1 });
    S('vx_shop_deli', 'Deli Counter', { kind: 'mcase', style: 'deli', col: 0x7A4A32 }, { props: [FACING4], light: [5, 5, 4], sound: 'glass', hard: 1.5 });
    S('vx_shop_bakery_case', 'Bakery Case', { kind: 'mcase', style: 'bakery', col: 0xF2D2C8 }, { props: [FACING4], light: [6, 5, 3], sound: 'glass', hard: 1.5 });
    S('vx_shop_checkout', 'Checkout Counter', { kind: 'mcheck', col: 0xEEF0F2 }, { props: [FACING4], sound: 'metal', hard: 1.5 });
    S('vx_shop_checkout_end', 'Checkout Bagging End', { kind: 'mcheckend', col: 0xEEF0F2 }, { props: [FACING4], sound: 'metal', hard: 1.5 });
    S('vx_shop_selfcheckout', 'Self-Checkout Kiosk', { kind: 'mself', col: 0xE8ECF0 }, { props: [FACING4], light: [2, 5, 8], sound: 'metal', hard: 1.5 });
    S('vx_shop_cart_bay', 'Shopping Cart Row', { kind: 'mcarts', col: 0xB8C0C8 }, { props: [FACING4], sound: 'metal', hard: 1 });
    S('vx_shop_basket_stack', 'Basket Stack', { kind: 'mbaskets', col: 0xD83A30 }, { sound: 'wood', hard: 0.6 });
    S('vx_shop_sign', 'Supermarket Sign', { kind: 'msign', col: SHOPC.brand }, { props: [FACING4], kind: 'wallmount', light: [8, 9, 7], sound: 'glass', hard: 1 });
    S('vx_shop_aisle_sign', 'Aisle Sign', { kind: 'maisle', col: 0x1E4E9A }, { props: [['n', 8]], solid: false, sound: 'metal', hard: 0.5 });
    S('vx_shop_floor', 'Supermarket Floor', { kind: 'floor', pat: 'shop', col: 0xEEF0F1, col2: 0xC6CBD0, col3: 0xE3E7EA, side: 0xD0D4D8, sidePat: 'techpanel', sideSpec: { col: 0xDCE0E4, col2: 0x9AA2AA } }, { opaque: true, filter: 15, sound: 'stone', hard: 1.5 });
    S('vx_shop_light', 'Supermarket Light Strip', { kind: 'mlight', col: 0xF4FAFF }, { props: [['head', 2]], defaultIndex: 1, kind: 'hanglight', solid: false, light: [13, 14, 15], sound: 'glass', hard: 0.5 });
    S('vx_shop_door', 'Automatic Sliding Door', { kind: 'mdoor', col: 0xCFEFFF }, { props: [FACING4, ['open', 2]], solid: false, sound: 'glass', hard: 1.5 });
    S('vx_shop_promo', 'Sale Display', { kind: 'mpromo', col: 0xFFD02A }, { props: [FACING4], light: [9, 7, 2], sound: 'metal', hard: 1 });
    S('vx_shop_flower_stand', 'Flower Stand', { kind: 'mflowers', col: 0x3E7A4A }, { props: [FACING4], sound: 'grass', hard: 0.6 });
  });
})(VR);
