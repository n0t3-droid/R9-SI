// ============================================================================
// Voxel Home: the designer interior & exterior kit for the modern towns —
// modelled on the user's reference photos (mono-pitch modern house, two-storey
// villa, neoclassical mansion). Mini-voxel (VX) pieces: modular sofas, coffee
// & dining tables, TV walls, kitchen islands (sink/hob), fridges, wardrobes,
// nightstands, bathtubs, showers, toilets, vanities and mirrors, bookshelves,
// wall art, tall plants, pendant lamps, chandeliers, sconces, LED strips,
// recessed spots, columns (modern & classical), balustrades, black railings,
// garden urns, fountains, bollard lights and parked cars.
// ============================================================================
(function (VR) {
  'use strict';
  const VX = VR.VX;
  if (!VX || !VX._) return;
  const { G, put, box, rotateGrid, PAINT_FN, sh, hh, specOf, clsOf } = VX._;
  const { EMIS, GLASS, GLOSS } = VX;
  const { SOLID, WALL, WIN, DOOR, OTHER } = VX.CLS;
  const KIND = VX.KIND;
  const LXP = [0, 4, 1, 5], LXM = [1, 5, 0, 4];
  const same = (ns, sp) => { const o = specOf(ns); return !!(o && o.kind === sp.kind && o.family === sp.family); };
  const sameKind = (ns, sp) => { const o = specOf(ns); return !!(o && o.kind === sp.kind); };
  // joins along the piece's local x axis (bit 1: +x side, bit 2: -x side)
  const rowJoin = (c, sp, s, nbS) => { const q = c.facing & 3; return (same(nbS[LXP[q]], sp) ? 1 : 0) | (same(nbS[LXM[q]], sp) ? 2 : 0); };
  const flat4 = (c, sp, s, nbS) => (same(nbS[0], sp) ? 1 : 0) | (same(nbS[1], sp) ? 2 : 0) | (same(nbS[4], sp) ? 4 : 0) | (same(nbS[5], sp) ? 8 : 0);
  const stack = (c, sp, s, nbS) => (sameKind(nbS[2], sp) ? 1 : 0) | (sameKind(nbS[3], sp) ? 2 : 0);
  const conn4 = (c, sp, s, nbS) => { const con = (d) => { const ns = nbS[d], cl = clsOf(ns), o = specOf(ns); return same(ns, sp) || cl === SOLID || cl === WALL || cl === WIN || cl === DOOR || (o && (o.kind === 'fence' || o.kind === 'lamppost' || o.kind === 'column')) ? 1 : 0; }; return con(5) | (con(0) << 1) | (con(4) << 2) | (con(1) << 3); };
  Object.assign(VX.ctxHook, { tvwall: rowJoin, island: rowJoin, dining: rowJoin, books: stack, column: stack, baluster: conn4, rail: conn4, ledstrip: rowJoin, cabinet: rowJoin, bathtub: rowJoin });

  const P = {
    white: 0xF2F2EE, cream: 0xEDE6D6, charcoal: 0x2E3136, black: 0x1C1E22, steel: 0xB8BEC6, chrome: 0xD8DEE4, walnut: 0x6A4426, oak: 0xC09A62, marble: 0xEAEAEC, marbleV: 0xBCBEC6,
    glass: 0xB8DCF0, water: 0x7AC8F0, warm: 0xFFD27A, warmD: 0xFFB040, orange: 0xFF8A2A, leaf: 0x3E8A4A, leafL: 0x5AAE5A, soil: 0x4A3626, brass: 0xC8A048, stone: 0xB4B0A6, stoneD: 0x8A867C,
  };
  // box with per-voxel colour and flags (null colour leaves the voxel empty)
  const boxF = (x0, y0, z0, x1, y1, z1, cf, ff) => { for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const cc = cf(x, y, z); if (cc === null || cc === undefined) continue; put(x, y, z, cc, ff ? ff(x, y, z) : 0); } };

  // ---------------------------------------------------------------- living room
  // COFFEE TABLE: low dark frame with a glass or marble top and a bowl
  PAINT_FN.coffee = function (s, c) {
    G.fill(0);
    box(1, 0, 1, 1, 2, 6, s.col); box(6, 0, 1, 6, 2, 6, s.col);
    box(0, 3, 0, 7, 3, 7, s.top, s.glassTop ? GLASS : GLOSS);
    if (c.h & 1) { box(3, 4, 3, 4, 4, 4, s.deco || P.brass, GLOSS); } else { box(2, 4, 3, 2, 5, 3, P.leaf); put(2, 4, 3, P.soil); box(5, 4, 4, 5, 4, 4, P.warm, EMIS); }
    rotateGrid(c.facing);
  };
  // TV WALL: media console with a wide dark screen above (joins sideways into one long unit)
  PAINT_FN.tvwall = function (s, c) {
    G.fill(0);
    const R_ = c.x & 1, L_ = (c.x >> 1) & 1;
    box(L_ ? 0 : 1, 0, 5, R_ ? 7 : 6, 1, 7, s.col, GLOSS);                      // console
    box(L_ ? 0 : 1, 1, 5, R_ ? 7 : 6, 1, 5, sh(s.col, 1.15));
    box(0, 3, 7, 7, 7, 7, s.wall || P.charcoal);                                // panel
    boxF(L_ ? 0 : 1, 3, 6, R_ ? 7 : 6, 6, 6, (x, y) => (y === 3 || y === 6 || (x === 1 && !L_) || (x === 6 && !R_)) ? P.black : s.screen, (x, y) => (y === 3 || y === 6 || (x === 1 && !L_) || (x === 6 && !R_)) ? GLOSS : EMIS);
    put(3, 2, 6, P.warmD, EMIS); put(4, 2, 6, P.warmD, EMIS);                   // LED under the console
    rotateGrid(c.facing);
  };
  // ---------------------------------------------------------------- kitchen & dining
  // ISLAND / COUNTER: marble slab on a panelled base; sink or hob variants; joins sideways
  PAINT_FN.island = function (s, c) {
    G.fill(0);
    const R_ = c.x & 1, L_ = (c.x >> 1) & 1;
    box(L_ ? 0 : 1, 0, 1, R_ ? 7 : 6, 0, 6, P.black);                              // toe kick
    box(0, 1, 0, 7, 5, 7, (x, y, z) => (z === 0 && (x === 3 || x === 4) && y === 3) ? P.chrome : s.col, GLOSS); // base with handle
    box(0, 6, 0, 7, 6, 7, (x, y, z) => ((x * 3 + z * 5 + c.h) % 11 === 0) ? P.marbleV : s.top, GLOSS);       // slab
    if (s.family === 'sink') { box(2, 6, 2, 5, 6, 5, P.chrome, GLOSS); box(2, 6, 2, 5, 6, 5, P.steel); box(3, 5, 3, 4, 5, 4, sh(P.steel, 0.7)); box(3, 7, 6, 4, 7, 6, P.chrome, GLOSS); put(3, 7, 5, P.chrome, GLOSS); }
    else if (s.family === 'hob') { box(1, 7, 1, 6, 7, 6, P.black, GLOSS); for (const [x, z] of [[2, 2], [5, 2], [2, 5], [5, 5]]) put(x, 7, z, 0x5A5E66, GLOSS); }
    else if (c.h === 1) { put(1, 7, 6, P.leaf); put(1, 7, 5, P.leafL); } else if (c.h === 2) { box(5, 7, 1, 6, 7, 1, P.warm); }
    rotateGrid(c.facing);
  };
  // UPPER CABINET: wall-hung white cabinet with a lit underside
  PAINT_FN.cabinet = function (s, c) {
    G.fill(0);
    const R_ = c.x & 1, L_ = (c.x >> 1) & 1;
    box(0, 3, 4, 7, 7, 7, (x, y, z) => (z === 4 && y === 4 && (x === 3 || x === 4)) ? P.chrome : (z === 4 && x === 3 && !R_ && !L_) ? sh(s.col, 0.9) : s.col, GLOSS);
    if (!L_) box(0, 3, 4, 0, 7, 7, sh(s.col, 0.86));
    if (!R_) box(7, 3, 4, 7, 7, 7, sh(s.col, 0.86));
    box(1, 2, 5, 6, 2, 6, P.warm, EMIS);
    rotateGrid(c.facing);
  };
  // FRIDGE: two stacked parts of brushed steel with a freezer drawer below and a tall door above
  PAINT_FN.fridge = function (s, c) {
    G.fill(0);
    const up = c.part === 1;
    box(0, up ? 0 : 1, 1, 7, 7, 7, (x, y, z) => z === 1 ? (up ? (x === 6 && y >= 1 && y <= 6 ? P.chrome : s.col) : (y === 3 ? P.black : x === 6 && y >= 4 ? P.chrome : s.col)) : sh(s.col, 0.85), GLOSS);
    if (!up) box(0, 0, 1, 7, 0, 7, P.black);
    if (up) { put(2, 3, 1, 0x7AB8E0, EMIS); put(3, 3, 1, 0x7AB8E0, EMIS); }
    rotateGrid(c.facing);
  };
  // DINING TABLE: long top on end legs; joins along its length
  PAINT_FN.dining = function (s, c) {
    G.fill(0);
    const R_ = c.x & 1, L_ = (c.x >> 1) & 1;
    box(0, 5, 1, 7, 5, 6, s.top, GLOSS);
    box(0, 4, 1, 7, 4, 6, sh(s.top, 0.8));
    if (!L_) { box(0, 0, 1, 0, 4, 1, s.col); box(0, 0, 6, 0, 4, 6, s.col); }
    if (!R_) { box(7, 0, 1, 7, 4, 1, s.col); box(7, 0, 6, 7, 4, 6, s.col); }
    if (c.h & 1) { put(3, 6, 3, P.white, GLOSS); put(4, 6, 4, P.white, GLOSS); put(4, 6, 3, P.leaf); } else if (c.h === 2) { box(3, 6, 3, 4, 6, 4, s.top === P.walnut ? P.cream : P.walnut, GLOSS); }
    rotateGrid(c.facing);
  };
  // DINING CHAIR: slim frame, cushioned seat, upholstered back
  PAINT_FN.dchair = function (s, c) {
    G.fill(0);
    for (const [x, z] of [[1, 1], [6, 1], [1, 6], [6, 6]]) box(x, 0, z, x, 2, z, s.col);
    box(1, 3, 1, 6, 3, 6, s.cushion, GLOSS);
    box(1, 4, 6, 6, 7, 7, (x, y) => y === 7 ? sh(s.cushion, 1.1) : s.cushion);
    rotateGrid(c.facing);
  };
  // ---------------------------------------------------------------- bedroom & bath
  PAINT_FN.wardrobe = function (s, c) {
    G.fill(0);
    const up = c.part === 1;
    box(0, 0, 2, 7, 7, 7, (x, y, z) => z === 2 ? ((x === 3 || x === 4) && y === (up ? 2 : 5) ? P.chrome : x === 3 ? sh(s.col, 0.88) : s.col) : sh(s.col, 0.9), GLOSS);
    if (up) box(0, 7, 2, 7, 7, 7, sh(s.col, 0.95));
    if (!up) box(0, 0, 2, 7, 0, 7, P.black);
    rotateGrid(c.facing);
  };
  PAINT_FN.nightstand = function (s, c) {
    G.fill(0);
    box(1, 0, 1, 6, 3, 6, (x, y, z) => (z === 1 && y === 2 && (x === 3 || x === 4)) ? P.chrome : s.col, GLOSS);
    box(3, 4, 3, 4, 4, 4, P.black); box(2, 5, 2, 5, 7, 5, s.shade || P.cream, EMIS);
    rotateGrid(c.facing);
  };
  // BATHTUB: two-block freestanding tub (joins along its length), water inside, chrome tap at one end
  PAINT_FN.bathtub = function (s, c) {
    G.fill(0);
    const R_ = c.x & 1, L_ = (c.x >> 1) & 1;
    box(L_ ? 0 : 1, 0, 1, R_ ? 7 : 6, 4, 6, (x, y, z) => (y === 4) ? sh(s.col, 1.05) : s.col, GLOSS);
    box(L_ ? 0 : 2, 2, 2, R_ ? 7 : 5, 4, 5, null);
    box(L_ ? 0 : 2, 3, 2, R_ ? 7 : 5, 3, 5, P.water, GLASS);
    if (!R_) { box(6, 5, 3, 6, 6, 4, P.chrome, GLOSS); put(5, 6, 3, P.chrome, GLOSS); }
    rotateGrid(c.facing);
  };
  // SHOWER: glass enclosure in a corner (back and left walls tiled), rain head above
  PAINT_FN.shower = function (s, c) {
    G.fill(0);
    const up = c.part === 1;
    box(0, 0, 7, 7, 7, 7, s.tile, GLOSS); box(0, 0, 0, 0, 7, 7, s.tile, GLOSS);      // tiled back & left walls
    box(7, 0, 0, 7, 7, 6, P.glass, GLASS); box(1, 0, 0, 6, 7, 0, P.glass, GLASS);   // glass front & right
    if (!up) { box(1, 0, 1, 6, 0, 6, sh(s.tile, 0.8)); put(3, 0, 3, P.chrome); put(1, 4, 6, P.chrome, GLOSS); box(1, 5, 6, 1, 5, 6, P.chrome, GLOSS); }
    else { box(2, 7, 2, 5, 7, 5, P.chrome, GLOSS); box(1, 6, 6, 1, 7, 6, P.chrome); }
    rotateGrid(c.facing);
  };
  PAINT_FN.toilet = function (s, c) {
    G.fill(0);
    box(2, 0, 1, 5, 2, 5, s.col, GLOSS); box(1, 3, 1, 6, 3, 5, s.col, GLOSS); box(2, 3, 2, 5, 3, 4, 0x9AD0E8, GLASS);
    box(1, 0, 6, 6, 6, 7, s.col, GLOSS); put(3, 7, 6, P.chrome, GLOSS);
    rotateGrid(c.facing);
  };
  PAINT_FN.vanity = function (s, c) {
    G.fill(0);
    box(0, 0, 3, 7, 4, 7, (x, y, z) => (z === 3 && y === 2 && (x === 3 || x === 4)) ? P.chrome : s.col, GLOSS);
    box(0, 5, 2, 7, 5, 7, s.top, GLOSS); box(2, 5, 3, 5, 5, 6, P.chrome); box(3, 5, 4, 4, 5, 5, sh(P.steel, 0.7));
    box(3, 6, 6, 4, 7, 6, P.chrome, GLOSS); put(3, 7, 5, P.chrome, GLOSS);
    rotateGrid(c.facing);
  };
  // MIRROR: wall-hung, LED-edged
  PAINT_FN.mirror = function (s, c) {
    G.fill(0);
    boxF(0, 1, 7, 7, 6, 7, (x, y) => (x === 0 || x === 7 || y === 1 || y === 6) ? P.warm : 0xC8D8E8, (x, y) => (x === 0 || x === 7 || y === 1 || y === 6) ? EMIS : GLOSS);
    rotateGrid(c.facing);
  };
  // ---------------------------------------------------------------- study & decor
  PAINT_FN.books = function (s, c) {
    G.fill(0);
    const above = c.x & 1;
    box(0, 0, 3, 7, 7, 7, s.col, GLOSS);
    for (const y0 of [1, 5]) { box(1, y0, 3, 6, y0 + 2, 6, null); for (let x = 1; x <= 6; x++) { const k = hh(x + c.px * 8, y0 + c.py, c.h, 51) % 7; if (k === 6) continue; put(x, y0, 4, [0xB84A3A, 0x3F63A8, 0x4E9A56, 0xE8B83A, 0x8A5AC8, 0xF2F2EE][k]); if (k !== 5) put(x, y0 + 1, 4, [0xB84A3A, 0x3F63A8, 0x4E9A56, 0xE8B83A, 0x8A5AC8, 0xF2F2EE][k]); } }
    if (above) box(0, 7, 3, 7, 7, 7, s.col, GLOSS);
    rotateGrid(c.facing);
  };
  // ART: framed abstract canvas on the back wall; the motif comes from the block position
  PAINT_FN.art = function (s, c) {
    G.fill(0);
    const pal = s.family === 'warm' ? [0xF2E8D8, 0xE07A3A, 0xC8443A, 0x2E3136] : s.family === 'cool' ? [0xE8F0F4, 0x3F6AC0, 0x2F9C98, 0x1C1E22] : [0xF2F2EE, 0x1C1E22, 0xC8A048, 0x8A8A90];
    box(0, 0, 7, 7, 7, 7, s.frame, GLOSS);
    for (let y = 1; y <= 6; y++) for (let x = 1; x <= 6; x++) {
      const v = (Math.sin(x * 0.9 + c.h * 1.7) + Math.cos(y * 1.1 + c.px * 2)) * 0.5;
      put(x, y, 6, pal[v > 0.5 ? 1 : v > 0 ? 2 : v > -0.5 ? 0 : 3]);
    }
    rotateGrid(c.facing);
  };
  // TALL PLANT: pot, stem and broad leaves
  PAINT_FN.plant2 = function (s, c) {
    G.fill(0);
    box(2, 0, 2, 5, 2, 5, s.col, GLOSS); box(3, 2, 3, 4, 2, 4, P.soil);
    box(3, 3, 3, 4, 5, 4, 0x5A7A3A);
    const L = (x, y, z, big) => { put(x, y, z, P.leaf); if (big) { put(x + 1, y, z, P.leafL); put(x, y, z + 1, P.leafL); } };
    L(1, 4, 3, true); L(5, 5, 2, true); L(2, 6, 5, true); L(5, 6, 5, true); L(1, 6, 1, false); L(3, 7, 3, true); L(6, 4, 4, false); put(4, 7, 5, P.leafL); put(2, 5, 6, P.leafL);
  };
  // ---------------------------------------------------------------- lighting
  PAINT_FN.pendant = function (s, c) {
    G.fill(0);
    put(3, 7, 3, P.black); put(3, 6, 3, P.black); put(3, 5, 3, P.black);
    boxF(1, 2, 1, 6, 4, 6, (x, y, z) => y === 4 ? s.col : (x === 1 || x === 6 || z === 1 || z === 6) ? s.col : P.warm, (x, y, z) => (y === 4 || x === 1 || x === 6 || z === 1 || z === 6) ? GLOSS : EMIS);
    box(2, 1, 2, 5, 1, 5, P.warm, EMIS);
  };
  PAINT_FN.chandelier = function (s, c) {
    G.fill(0);
    box(3, 5, 3, 4, 7, 4, P.brass, GLOSS);
    boxF(1, 3, 1, 6, 4, 6, (x, y, z) => ((x === 1 || x === 6) && (z === 1 || z === 6)) ? P.brass : (x === 1 || x === 6 || z === 1 || z === 6) ? 0xFFF4D0 : null, (x, y, z) => ((x === 1 || x === 6) && (z === 1 || z === 6)) ? GLOSS : EMIS);
    for (const [x, z] of [[2, 2], [5, 2], [2, 5], [5, 5], [3, 3], [4, 4]]) { put(x, 2, z, 0xFFF8E0, EMIS); put(x, 1, z, 0xE8F0FF, GLASS); }
    put(3, 4, 3, P.warm, EMIS); put(4, 4, 4, P.warm, EMIS);
  };
  PAINT_FN.sconce = function (s, c) {
    G.fill(0);
    box(3, 2, 6, 4, 5, 7, s.col, GLOSS);
    box(3, 6, 6, 4, 6, 6, P.warm, EMIS); box(3, 1, 6, 4, 1, 6, P.warm, EMIS);
    rotateGrid(c.facing);
  };
  // LED STRIP: a thin light line along the front-bottom edge (or the top, for cove lighting)
  PAINT_FN.ledstrip = function (s, c) {
    G.fill(0);
    const y = s.top ? 7 : 0;
    box(0, y, 0, 7, y, 0, s.glow, EMIS);
    box(0, y, 1, 7, y, 1, sh(s.glow, 0.75), EMIS);
    rotateGrid(c.facing);
  };
  PAINT_FN.spot = function (s, c) {
    G.fill(0);
    boxF(2, 7, 2, 5, 7, 5, (x, y, z) => (x === 2 || x === 5 || z === 2 || z === 5) ? P.white : 0xFFF6DC, (x, y, z) => (x === 2 || x === 5 || z === 2 || z === 5) ? GLOSS : EMIS);
  };
  PAINT_FN.bollard = function (s, c) {
    G.fill(0);
    box(3, 0, 3, 4, 4, 4, s.col, GLOSS); box(2, 5, 2, 5, 5, 5, s.glow, EMIS); box(2, 6, 2, 5, 6, 5, s.col, GLOSS);
  };
  // ---------------------------------------------------------------- architecture
  // COLUMN: modern square pillar or classical fluted round column; base and capital appear at the ends of a stack
  PAINT_FN.column = function (s, c) {
    G.fill(0);
    const above = c.x & 1, below = (c.x >> 1) & 1;
    if (s.family === 'round') {
      for (let y = 0; y < 8; y++) for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
        const d = Math.hypot(x + 0.5 - 4, z + 0.5 - 4);
        const cap = (!above && y >= 6) || (!below && y <= 1);
        if (d > (cap ? 4.05 : 3.3)) continue;
        const flute = !cap && ((Math.round(Math.atan2(z + 0.5 - 4, x + 0.5 - 4) / (Math.PI / 6)) & 1) === 0) && d > 2.6;
        put(x, y, z, cap ? (y === 7 || y === 0 ? sh(s.col, 0.92) : s.col) : flute ? sh(s.col, 0.86) : s.col, GLOSS);
      }
    } else {
      box(2, 0, 2, 5, 7, 5, s.col, GLOSS);
      if (!above) box(1, 6, 1, 6, 7, 6, s.col, GLOSS);
      if (!below) box(1, 0, 1, 6, 1, 6, s.col, GLOSS);
    }
  };
  // BALUSTRADE: turned white balusters under a moulded rail, joining to neighbours
  PAINT_FN.baluster = function (s, c) {
    G.fill(0);
    const on = (k) => (c.x >> k) & 1;
    const dirs = [[5, 3, 0], [0, 7, 3], [4, 3, 7], [1, 0, 3]];   // d, endX, endZ
    const post = (x, z) => { box(x - 0, 0, z, x + 1, 7, z + 1, (X, y) => (y === 0 || y === 6) ? sh(s.col, 0.9) : s.col, GLOSS); };
    const mid = 3;
    let any = false;
    for (let k = 0; k < 4; k++) {
      if (!on(k)) continue; any = true;
      const d = dirs[k][0];
      const along = d === 0 || d === 1;
      for (let t = 0; t < 4; t++) {
        const [x, z] = d === 5 ? [mid, t] : d === 4 ? [mid, 7 - t] : d === 0 ? [7 - t, mid] : [t, mid];
        const X1 = along ? x : x + 1, Z1 = along ? z + 1 : z;
        box(x, 6, z, X1, 7, Z1, s.col, GLOSS);                                    // rail
        box(x, 0, z, X1, 0, Z1, sh(s.col, 0.9), GLOSS);                          // plinth
        if (t === 1 || t === 3) { box(x, 1, z, X1, 5, Z1, (X, y) => (y === 2 || y === 4) ? sh(s.col, 0.86) : s.col, GLOSS); } // baluster
      }
    }
    if (!any || (c.x !== 5 && c.x !== 10) || c.h === 0) post(3, 3);
  };
  // BLACK RAILING: slim steel posts, three bars and a handrail
  PAINT_FN.rail = function (s, c) {
    G.fill(0);
    const on = (k) => (c.x >> k) & 1;
    box(3, 0, 3, 4, 7, 4, s.col, GLOSS);
    for (let k = 0; k < 4; k++) {
      if (!on(k)) continue;
      const d = [5, 0, 4, 1][k];
      for (let t = 0; t < 3; t++) {
        const [x, z] = d === 5 ? [3, t] : d === 4 ? [3, 7 - t] : d === 0 ? [7 - t, 3] : [t, 3];
        const along = d === 0 || d === 1;
        const X1 = along ? x : x + 1, Z1 = along ? z + 1 : z;
        box(x, 7, z, X1, 7, Z1, s.rail || s.col, GLOSS);
        for (const y of [1, 3, 5]) box(x, y, z, X1, y, Z1, s.col);
      }
    }
    if (s.glow) { put(3, 0, 3, s.glow, EMIS); }
  };
  PAINT_FN.urn = function (s, c) {
    G.fill(0);
    box(2, 0, 2, 5, 0, 5, s.col, GLOSS); box(3, 1, 3, 4, 2, 4, s.col);
    for (let y = 3; y <= 5; y++) { const r = y === 5 ? 3 : 2 + (y - 3) * 0.5; for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) if (Math.hypot(x + 0.5 - 4, z + 0.5 - 4) <= r + 0.3) put(x, y, z, y === 5 ? sh(s.col, 1.06) : s.col, GLOSS); }
    box(3, 5, 3, 4, 5, 4, P.soil);
    for (const [x, y, z] of [[2, 6, 3], [4, 6, 2], [5, 6, 5], [3, 7, 4], [2, 7, 5], [5, 7, 2]]) put(x, y, z, (x + z) & 1 ? P.leaf : P.leafL);
    if (c.h & 1) { put(3, 7, 2, 0xF06292); put(5, 6, 3, 0xF0C040); }
  };
  // FOUNTAIN CENTRE: two stone tiers with water; place it in a ring of slabs and water
  PAINT_FN.fountain = function (s, c) {
    G.fill(0);
    for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) { const d = Math.hypot(x + 0.5 - 4, z + 0.5 - 4); if (d <= 4.1) { put(x, 0, z, s.col, GLOSS); if (d <= 3.3) put(x, 1, z, P.water, GLASS); if (d > 3.3) put(x, 1, z, s.col, GLOSS); } }
    box(3, 1, 3, 4, 4, 4, s.col, GLOSS);
    for (let z = 1; z < 7; z++) for (let x = 1; x < 7; x++) { const d = Math.hypot(x + 0.5 - 4, z + 0.5 - 4); if (d <= 2.6) put(x, 5, z, d > 1.9 ? s.col : P.water, d > 1.9 ? GLOSS : GLASS); }
    box(3, 6, 3, 4, 6, 4, s.col, GLOSS); put(3, 7, 3, 0xBFEFFF, GLASS); put(4, 7, 4, 0xBFEFFF, GLASS);
  };
  // SOFA CORNER: the L piece — backrests on the back and on one side
  PAINT_FN.lcorner = function (s, c) {
    G.fill(0);
    const col = s.col, dk = sh(col, 0.82);
    box(0, 0, 0, 7, 0, 7, 0x3A424E); box(0, 1, 0, 7, 2, 7, dk);
    box(0, 3, 0, 7, 3, 7, col);
    box(0, 3, 6, 7, 6, 7, (x, y) => y === 6 ? sh(col, 1.06) : col);       // back
    box(0, 3, 0, 1, 6, 7, (x, y) => y === 6 ? sh(col, 1.06) : col);       // side (local -x)
    if (s.pillow) box(3, 4, 5, 4, 5, 5, s.pillow);
    rotateGrid(c.facing);
  };
  // CURTAIN: a soft cloth panel hanging from the ceiling beside a window (two parts tall)
  PAINT_FN.curtain = function (s, c) {
    G.fill(0);
    const up = c.part === 1;
    if (up) box(0, 7, 6, 7, 7, 6, P.black);
    for (let x = 0; x < 8; x++) { const fold = (x & 1) ? 6 : 5; box(x, 0, fold, x, 7, fold, (X, y) => (x & 1) ? sh(s.col, 0.88) : s.col); }
    rotateGrid(c.facing);
  };
  // ARC LAMP: a modern floor lamp — heavy base, a slim arc, a shade with a warm glow
  PAINT_FN.arclamp = function (s, c) {
    G.fill(0);
    box(4, 0, 4, 6, 0, 6, s.col, GLOSS); put(5, 1, 5, s.col); put(5, 2, 5, s.col); put(5, 3, 5, s.col); put(5, 4, 5, s.col); put(4, 5, 4, s.col); put(3, 6, 3, s.col); put(2, 6, 2, s.col);
    box(0, 4, 0, 3, 5, 3, (x, y, z) => y === 5 ? s.col : P.warm, (x, y, z) => y === 5 ? GLOSS : EMIS);
    rotateGrid(c.facing);
  };
  // TALL CABINET: a two-part column — oven and drawers below, cupboards above
  PAINT_FN.tallcab = function (s, c) {
    G.fill(0);
    const up = c.part === 1;
    box(0, 0, 2, 7, 7, 7, (x, y, z) => z === 2 ? (!up && y >= 2 && y <= 5 && x >= 1 && x <= 6 ? (y === 2 || y === 5 || x === 1 || x === 6 ? P.black : 0x2A3A48) : (x === 3 || x === 4) && (y === (up ? 3 : 6)) ? P.chrome : s.col) : sh(s.col, 0.9), GLOSS);
    if (!up) { put(2, 3, 2, 0xFF8A2A, EMIS); }
    rotateGrid(c.facing);
  };
  // WALL SHELF: a floating shelf with books, a vase and a candle
  PAINT_FN.wshelf = function (s, c) {
    G.fill(0);
    box(0, 3, 5, 7, 3, 7, s.col, GLOSS);
    put(1, 4, 6, 0x3F63A8); put(2, 4, 6, 0xC0443A); put(2, 5, 6, 0xC0443A); put(3, 4, 6, 0xE8B83A);
    box(5, 4, 6, 5, 6, 6, P.white, GLOSS); put(5, 7, 6, P.leaf); put(7, 4, 6, P.warm, EMIS);
    rotateGrid(c.facing);
  };
  // SUN LOUNGER: a slatted recliner for the pool deck
  PAINT_FN.lounger = function (s, c) {
    G.fill(0);
    for (const [x, z] of [[1, 1], [6, 1], [1, 6], [6, 6]]) put(x, 0, z, P.black);
    box(0, 1, 0, 7, 1, 5, (x, y, z) => (z & 1) ? s.col : sh(s.col, 0.85), GLOSS);
    box(0, 2, 6, 7, 4, 7, (x, y, z) => y === 4 ? sh(s.col, 1.05) : s.col, GLOSS);
    box(2, 2, 2, 5, 2, 3, s.towel || 0xF2F2EE);
    rotateGrid(c.facing);
  };
  // BBQ GRILL: black barrel grill on legs, a warm ember glow
  PAINT_FN.bbq = function (s, c) {
    G.fill(0);
    put(1, 0, 2, P.black); put(6, 0, 2, P.black); put(1, 0, 5, P.black); put(6, 0, 5, P.black);
    box(0, 1, 1, 7, 3, 6, P.black, GLOSS); box(1, 4, 2, 6, 4, 5, 0x3A3D44, GLOSS); box(2, 3, 2, 5, 3, 5, 0xFF6A2A, EMIS);
    box(7, 4, 3, 7, 4, 4, P.chrome, GLOSS); put(0, 2, 0, P.chrome);
    rotateGrid(c.facing);
  };
  // FIREPLACE: a stone surround with a black steel firebox and a glowing fire — two parts tall (the upper part is the chimney breast with a mantel)
  PAINT_FN.fireplace = function (s, c) {
    G.fill(0);
    const up = c.part === 1, st = s.stone || 0x8E8A82, dk = sh(st, 0.8);
    if (!up) {
      box(0, 0, 3, 7, 7, 7, (x, y, z) => z === 3 ? ((x + y) & 1 ? st : dk) : st);
      box(1, 0, 3, 6, 5, 7, null); box(1, 0, 4, 6, 5, 7, P.black); box(1, 0, 3, 6, 0, 3, P.black);
      box(2, 0, 5, 5, 1, 6, 0x4A3A2A); box(2, 1, 5, 5, 2, 6, 0xFF7A20, EMIS); box(3, 3, 5, 4, 3, 6, 0xFFC040, EMIS);
      box(0, 6, 2, 7, 6, 2, P.walnut, GLOSS); box(0, 6, 3, 7, 7, 3, P.walnut, GLOSS);   // the mantel shelf
    } else {
      box(0, 0, 4, 7, 7, 7, (x, y, z) => z === 4 ? ((x + y) & 1 ? st : dk) : st);
      box(2, 2, 3, 5, 5, 3, 0x2A2D33, GLOSS); box(3, 3, 3, 4, 4, 3, 0xD8B070, GLOSS);   // a framed mirror over the mantel
    }
    rotateGrid(c.facing);
  };
  // WASHER: a white washing machine with a round glass door and a control panel
  PAINT_FN.washer = function (s, c) {
    G.fill(0);
    box(0, 0, 1, 7, 6, 7, s.col || P.white, GLOSS);
    for (let y = 1; y <= 5; y++) for (let x = 1; x <= 6; x++) { const d = Math.hypot(x + 0.5 - 4, y + 0.5 - 3.2); if (d < 2.6) put(x, y, 1, d < 1.9 ? 0x3A4E66 : P.chrome, d < 1.9 ? GLASS : GLOSS); }
    box(1, 6, 1, 6, 6, 1, 0x2A2D33, GLOSS); put(2, 6, 1, 0x2FD070, EMIS); put(5, 6, 1, P.chrome);
    rotateGrid(c.facing);
  };
  // COAT RACK: a walnut wall panel with hooks, a coat and a bag, a shoe bench below
  PAINT_FN.coatrack = function (s, c) {
    G.fill(0);
    box(0, 2, 7, 7, 7, 7, s.col || P.walnut, GLOSS);
    for (const x of [1, 3, 5, 7]) put(x, 6, 6, P.chrome, GLOSS);
    box(1, 2, 6, 1, 5, 6, 0x2F4A78); box(3, 3, 6, 3, 5, 6, 0xC0443A); put(5, 4, 6, 0x6A4A30); put(5, 5, 6, 0x6A4A30);
    box(0, 0, 5, 7, 0, 7, P.black); box(0, 1, 5, 7, 1, 7, 0xC8B090, GLOSS); put(2, 2, 6, 0x2A2D33); put(6, 2, 6, 0xE8E6E0);
    rotateGrid(c.facing);
  };
  // PIANO: a black gloss upright piano with a keyboard, sheet music and a stool space in front
  PAINT_FN.piano = function (s, c) {
    G.fill(0);
    box(0, 0, 4, 7, 7, 7, s.col || P.black, GLOSS);
    box(0, 3, 2, 7, 3, 3, P.black, GLOSS); for (let x = 0; x < 8; x++) put(x, 4, 2, (x % 3 === 1) ? P.black : P.white, GLOSS); box(0, 4, 3, 7, 4, 3, P.white, GLOSS);
    box(2, 5, 3, 5, 6, 3, 0xF4F0E4); put(3, 6, 3, 0x2A2D33); put(4, 5, 3, 0x2A2D33);
    put(1, 0, 3, P.black); put(6, 0, 3, P.black); put(1, 1, 3, P.black); put(6, 1, 3, P.black);
    rotateGrid(c.facing);
  };
  // PERGOLA BEAM: an open slatted roof piece for the garden terrace (black steel frame, walnut slats)
  PAINT_FN.pergola = function (s, c) {
    G.fill(0);
    box(0, 6, 0, 7, 7, 0, P.black, GLOSS); box(0, 6, 7, 7, 7, 7, P.black, GLOSS);
    for (let z = 1; z < 7; z += 2) box(0, 7, z, 7, 7, z, s.col || P.walnut);
    rotateGrid(c.facing);
  };
  // GARDEN LAMP: a short black path light with a warm top
  PAINT_FN.gardenlamp = function (s, c) {
    G.fill(0);
    box(3, 0, 3, 4, 4, 4, P.black, GLOSS); box(2, 5, 2, 5, 5, 5, P.warm, EMIS); box(2, 6, 2, 5, 6, 5, P.black, GLOSS);
  };
  // SCHOOL BOARD: a wide whiteboard with marker scribbles, on the back wall
  PAINT_FN.board = function (s, c) {
    G.fill(0);
    box(0, 1, 7, 7, 6, 7, (x, y) => (x === 0 || x === 7 || y === 1 || y === 6) ? P.steel : P.white, GLOSS);
    for (let x = 1; x <= 6; x++) { const k = hh(x + c.px * 8, c.h, 3, 61) % 5; if (k < 3) put(x, 2 + k, 6, [0x2F55C8, 0xC0443A, 0x1C1E22][k]); }
    put(1, 0, 6, P.steel); put(6, 0, 6, P.steel);
    rotateGrid(c.facing);
  };
  // SCHOOL DESK: a small desk with an attached chair behind it (the pupil sits at +v)
  PAINT_FN.sdesk = function (s, c) {
    G.fill(0);
    box(0, 4, 0, 7, 4, 3, s.top, GLOSS); box(0, 0, 0, 0, 3, 0, s.col); box(7, 0, 0, 7, 3, 0, s.col); box(0, 0, 3, 0, 3, 3, s.col); box(7, 0, 3, 7, 3, 3, s.col);
    put(2, 5, 1, 0xF2F2EE); put(3, 5, 1, 0xF2F2EE); put(5, 5, 2, 0x2F55C8);
    box(2, 0, 6, 5, 2, 7, s.seat, GLOSS); box(2, 3, 7, 5, 5, 7, s.seat, GLOSS);
    rotateGrid(c.facing);
  };
  // MACHINE: a boxy industrial unit with a control panel, warning stripe and blinking lights
  PAINT_FN.machine = function (s, c) {
    G.fill(0);
    box(0, 0, 1, 7, 6, 7, (x, y, z) => y === 0 ? P.black : (z === 1 && y === 3) ? 0xE8B83A : s.col, GLOSS);
    box(1, 7, 2, 6, 7, 6, sh(s.col, 0.8), GLOSS);
    box(2, 4, 1, 5, 5, 1, P.black); put(3, 5, 1, 0x5AFF7A, EMIS); put(4, 5, 1, 0xFF4A3A, EMIS); put(2, 4, 1, 0x4AC8FF, EMIS);
    box(3, 6, 0, 4, 6, 0, P.steel); box(3, 5, 0, 4, 5, 0, P.steel);
    if (c.h & 1) { box(0, 7, 3, 0, 7, 4, P.steel); put(0, 7, 3, 0xFF8A2A, EMIS); }
    rotateGrid(c.facing);
  };
  // CONVEYOR: rollers on a low frame, running along the piece's axis
  PAINT_FN.conveyor = function (s, c) {
    G.fill(0);
    box(0, 0, 1, 7, 2, 1, P.black); box(0, 0, 6, 7, 2, 6, P.black);
    for (let x = 0; x < 8; x++) box(x, 3, 1, x, 3, 6, (x & 1) ? P.steel : sh(P.steel, 0.8), GLOSS);
    if (c.h === 1) box(2, 4, 2, 4, 5, 5, 0xB08050); else if (c.h === 2) box(3, 4, 3, 5, 4, 4, 0x4AC8FF, GLOSS);
    rotateGrid(c.facing);
  };
  // CAR: a 2×4×2-block sedan drawn once into a 16×16×32 canvas and sliced per part
  const carCache = new Map();
  const carCanvas = (s) => {
    let cv = carCache.get(s.col); if (cv) return cv;
    cv = new Uint32Array(16 * 16 * 32);
    const I = (x, y, z) => (y * 32 + z) * 16 + x;
    const set = (x, y, z, col, f) => { if (x < 0 || y < 0 || z < 0 || x >= 16 || y >= 16 || z >= 32) return; cv[I(x, y, z)] = (col & 0xffffff) | (f || 0) | (1 << 24); };
    const B = (x0, y0, z0, x1, y1, z1, col, f) => { for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, z, typeof col === 'function' ? col(x, y, z) : col, f); };
    const body = s.col, dark = sh(s.col, 0.8), glass = 0x6A8CA8, tyre = 0x1C1E22, rim = 0xC8CCD0;
    B(2, 3, 2, 13, 6, 29, body, GLOSS);                          // lower body
    B(1, 4, 3, 14, 5, 28, body, GLOSS);                          // flanks
    B(3, 7, 9, 12, 9, 24, (x, y, z) => (z === 9 || z === 24 || x === 3 || x === 12) ? (y === 9 ? body : glass) : body, (x, y, z) => (z === 9 || z === 24 || x === 3 || x === 12) && y < 9 ? GLASS : GLOSS); // cabin with windows
    B(4, 10, 11, 11, 10, 22, body, GLOSS);                       // roof
    B(3, 7, 10, 12, 8, 10, glass, GLASS); B(3, 7, 23, 12, 8, 23, glass, GLASS);   // windscreens
    B(2, 6, 3, 13, 6, 8, sh(body, 1.05), GLOSS); B(2, 6, 25, 13, 6, 28, sh(body, 1.05), GLOSS); // bonnet & boot
    for (const z of [5, 25]) for (const x of [0, 13]) { B(x, 1, z, x + 2, 4, z + 3, (X, y, Z) => (y === 2 || y === 3) && (Z === z + 1 || Z === z + 2) ? rim : tyre); }   // wheels
    B(2, 2, 2, 13, 2, 29, dark);                                 // sills
    B(3, 4, 2, 5, 5, 2, 0xFFF4C0, EMIS); B(10, 4, 2, 12, 5, 2, 0xFFF4C0, EMIS);   // headlights
    B(3, 4, 29, 5, 5, 29, 0xE03030, EMIS); B(10, 4, 29, 12, 5, 29, 0xE03030, EMIS); // tail lights
    B(6, 3, 2, 9, 3, 2, 0x2A2C30); B(6, 3, 29, 9, 3, 29, 0x2A2C30);
    B(1, 5, 12, 1, 5, 13, dark); B(14, 5, 12, 14, 5, 13, dark);  // mirrors
    carCache.set(s.col, cv);
    return cv;
  };
  PAINT_FN.car = function (s, c) {
    G.fill(0);
    const cv = carCanvas(s);
    const p = c.part, px = p & 1, py = (p >> 1) & 1, pz = p >> 2;            // 2 wide × 2 tall × 4 long
    for (let z = 0; z < 8; z++) for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const v = cv[((py * 8 + y) * 32 + pz * 8 + z) * 16 + px * 8 + x];
      if (!v) continue;
      put(x, y, z, v & 0xffffff, v & (GLASS | EMIS | GLOSS));
    }
    rotateGrid(c.facing);
  };

  Object.assign(KIND, { fireplace: { cls: OTHER }, washer: { cls: OTHER }, coatrack: { cls: OTHER }, piano: { cls: OTHER }, pergola: { cls: OTHER }, gardenlamp: { cls: OTHER }, lcorner: { cls: OTHER }, curtain: { cls: OTHER }, arclamp: { cls: OTHER }, tallcab: { cls: OTHER }, wshelf: { cls: OTHER }, lounger: { cls: OTHER }, bbq: { cls: OTHER }, board: { cls: OTHER }, sdesk: { cls: OTHER }, machine: { cls: OTHER }, conveyor: { cls: OTHER }, coffee: { cls: OTHER }, tvwall: { cls: OTHER }, island: { cls: OTHER }, cabinet: { cls: OTHER }, fridge: { cls: OTHER }, dining: { cls: OTHER }, dchair: { cls: OTHER }, wardrobe: { cls: OTHER }, nightstand: { cls: OTHER }, bathtub: { cls: OTHER }, shower: { cls: OTHER }, toilet: { cls: OTHER }, vanity: { cls: OTHER }, mirror: { cls: OTHER }, books: { cls: OTHER }, art: { cls: OTHER }, plant2: { cls: OTHER }, pendant: { cls: OTHER }, chandelier: { cls: OTHER }, sconce: { cls: OTHER }, ledstrip: { cls: OTHER }, spot: { cls: OTHER }, bollard: { cls: OTHER }, column: { cls: OTHER }, baluster: { cls: OTHER }, rail: { cls: OTHER }, urn: { cls: OTHER }, fountain: { cls: OTHER }, car: { cls: OTHER } });
  const NONE = () => [];
  Object.assign(VX.boxHook, {
    fireplace: () => [[0, 0, 0.375, 1, 1, 1]], washer: () => [[0, 0, 0.125, 1, 0.875, 1]], coatrack: () => [[0, 0, 0.625, 1, 0.25, 1]], piano: () => [[0, 0, 0.25, 1, 1, 1]], pergola: NONE, gardenlamp: () => [[0.25, 0, 0.25, 0.75, 0.875, 0.75]],
    lcorner: () => [[0, 0, 0, 1, 0.875, 1]], curtain: NONE, arclamp: () => [[0.5, 0, 0.5, 0.875, 0.5, 0.875]], tallcab: () => [[0, 0, 0.25, 1, 1, 1]], wshelf: NONE, lounger: () => [[0, 0, 0, 1, 0.625, 1]], bbq: () => [[0, 0, 0.125, 1, 0.625, 0.875]],
    board: NONE, sdesk: () => [[0, 0, 0, 1, 0.625, 1]], machine: () => [[0, 0, 0.125, 1, 1, 1]], conveyor: () => [[0, 0, 0.125, 1, 0.5, 0.875]],
    coffee: () => [[0, 0, 0, 1, 0.5, 1]], tvwall: () => [[0, 0, 0.6, 1, 1, 1]], island: () => [[0, 0, 0, 1, 0.875, 1]], cabinet: NONE, fridge: () => [[0, 0, 0.125, 1, 1, 1]], dining: () => [[0, 0, 0.125, 1, 0.75, 0.875]], dchair: () => [[0.125, 0, 0.125, 0.875, 0.5, 1]],
    wardrobe: () => [[0, 0, 0.25, 1, 1, 1]], nightstand: () => [[0.125, 0, 0.125, 0.875, 0.5, 0.875]], bathtub: () => [[0, 0, 0.125, 1, 0.625, 0.875]], shower: () => [[0, 0, 0, 1, 1, 1]], toilet: () => [[0.125, 0, 0.125, 0.875, 0.5, 1]], vanity: () => [[0, 0, 0.25, 1, 0.75, 1]], mirror: NONE,
    books: () => [[0, 0, 0.375, 1, 1, 1]], art: NONE, plant2: () => [[0.25, 0, 0.25, 0.75, 0.4, 0.75]], pendant: NONE, chandelier: NONE, sconce: NONE, ledstrip: NONE, spot: NONE, bollard: () => [[0.25, 0, 0.25, 0.75, 0.875, 0.75]],
    column: () => [[0.125, 0, 0.125, 0.875, 1, 0.875]], baluster: () => [[0, 0, 0, 1, 1, 1]], rail: () => [[0, 0, 0, 1, 1, 1]], urn: () => [[0.25, 0, 0.25, 0.75, 0.75, 0.75]], fountain: () => [[0, 0, 0, 1, 0.9, 1]], car: () => [[0, 0, 0, 1, 1, 1]],
  });
  Object.assign(VX.iconHook, { tvwall: (c) => { c.x = 0; }, island: (c) => { c.x = 0; }, dining: (c) => { c.x = 0; }, bathtub: (c) => { c.x = 0; }, column: (c) => { c.x = 0; }, baluster: (c) => { c.x = 10; }, rail: (c) => { c.x = 10; }, car: (c) => { c.part = 6; c.facing = 1; }, fridge: (c) => { c.part = 1; }, wardrobe: (c) => { c.part = 1; }, shower: (c) => { c.part = 0; } });

  VX.defineExtra.push(function (K) {
    const { add, FACING4 } = K;
    const G_ = K.G, grp = { group: G_.HOME || G_.ARCH, cat: 'vtech' };
    const A = (name, display, sp, o) => add(name, display, sp, Object.assign({}, grp, o || {}));
    const PART2 = ['part', ['lower', 'upper']];
    // sofas in designer colours reuse the modular sofa
    A('vx_sofa_charcoal', 'Charcoal Modular Sofa', { kind: 'sofa', col: 0x3A3D44, pillow: 0xE8D8B8 }, { props: [FACING4], filter: 0, sound: 'wool', hard: 0.6 });
    A('vx_sofa_cream', 'Cream Modular Sofa', { kind: 'sofa', col: 0xEDE6D6, pillow: 0x3A3D44 }, { props: [FACING4], filter: 0, sound: 'wool', hard: 0.6 });
    A('vx_sofa_taupe', 'Taupe Velvet Sofa', { kind: 'sofa', col: 0xA89482, pillow: 0xF2F2EE }, { props: [FACING4], filter: 0, sound: 'wool', hard: 0.6 });
    A('vx_coffee_table', 'Glass Coffee Table', { kind: 'coffee', col: P.black, top: 0xC8E0EE, glassTop: true }, { props: [FACING4], filter: 0, sound: 'glass', hard: 0.8 });
    A('vx_coffee_table_marble', 'Marble Coffee Table', { kind: 'coffee', col: P.walnut, top: P.marble }, { props: [FACING4], filter: 0, sound: 'stone', hard: 0.8 });
    A('vx_tv_wall', 'TV Media Wall', { kind: 'tvwall', col: P.walnut, screen: 0x1A2A44, wall: P.charcoal }, { props: [FACING4], filter: 0, light: [2, 4, 7], sound: 'wood', hard: 1 });
    A('vx_kitchen_island', 'Kitchen Island', { kind: 'island', col: P.white, top: P.marble }, { props: [FACING4], filter: 0, sound: 'stone', hard: 1 });
    A('vx_kitchen_sink', 'Kitchen Sink Counter', { kind: 'island', family: 'sink', col: P.white, top: P.marble }, { props: [FACING4], filter: 0, sound: 'stone', hard: 1 });
    A('vx_kitchen_hob', 'Kitchen Hob Counter', { kind: 'island', family: 'hob', col: P.white, top: P.marble }, { props: [FACING4], filter: 0, sound: 'stone', hard: 1 });
    A('vx_kitchen_island_dark', 'Dark Kitchen Island', { kind: 'island', family: 'dark', col: P.charcoal, top: P.marble }, { props: [FACING4], filter: 0, sound: 'stone', hard: 1 });
    A('vx_upper_cabinet', 'Upper Cabinet', { kind: 'cabinet', col: P.white }, { props: [FACING4], filter: 0, light: [4, 3, 1], sound: 'wood', hard: 1 });
    A('vx_fridge', 'Steel Fridge', { kind: 'fridge', col: P.steel }, { props: [FACING4, PART2], filter: 0, sound: 'metal', hard: 1.5 });
    A('vx_dining_table', 'Walnut Dining Table', { kind: 'dining', col: P.black, top: P.walnut }, { props: [FACING4], filter: 0, sound: 'wood', hard: 1 });
    A('vx_dining_table_white', 'White Dining Table', { kind: 'dining', family: 'white', col: P.white, top: P.marble }, { props: [FACING4], filter: 0, sound: 'stone', hard: 1 });
    A('vx_dining_chair', 'Dining Chair', { kind: 'dchair', col: P.black, cushion: 0xD8D0C0 }, { props: [FACING4], filter: 0, sound: 'wood', hard: 0.6 });
    A('vx_dining_chair_teal', 'Teal Dining Chair', { kind: 'dchair', col: P.brass, cushion: 0x2F9C98 }, { props: [FACING4], filter: 0, sound: 'wood', hard: 0.6 });
    A('vx_wardrobe', 'Wardrobe', { kind: 'wardrobe', col: P.white }, { props: [FACING4, PART2], filter: 0, sound: 'wood', hard: 1 });
    A('vx_wardrobe_walnut', 'Walnut Wardrobe', { kind: 'wardrobe', col: P.walnut }, { props: [FACING4, PART2], filter: 0, sound: 'wood', hard: 1 });
    A('vx_nightstand', 'Nightstand & Lamp', { kind: 'nightstand', col: P.walnut, shade: P.cream }, { props: [FACING4], filter: 0, light: [9, 7, 4], sound: 'wood', hard: 0.6 });
    A('vx_bathtub', 'Freestanding Bathtub', { kind: 'bathtub', col: P.white }, { props: [FACING4], filter: 0, sound: 'stone', hard: 1 });
    A('vx_shower', 'Glass Shower', { kind: 'shower', col: P.white, tile: 0x4A4E56 }, { props: [FACING4, PART2], filter: 0, sound: 'glass', hard: 1 });
    A('vx_toilet', 'Toilet', { kind: 'toilet', col: P.white }, { props: [FACING4], filter: 0, sound: 'stone', hard: 1 });
    A('vx_vanity', 'Vanity Sink', { kind: 'vanity', col: P.walnut, top: P.marble }, { props: [FACING4], filter: 0, sound: 'stone', hard: 1 });
    A('vx_mirror', 'LED Mirror', { kind: 'mirror', col: P.white }, { props: [FACING4], filter: 0, light: [6, 5, 4], sound: 'glass', hard: 0.5 });
    A('vx_bookshelf', 'White Bookshelf', { kind: 'books', col: P.white }, { props: [FACING4], filter: 0, sound: 'wood', hard: 1 });
    A('vx_bookshelf_walnut', 'Walnut Bookshelf', { kind: 'books', col: P.walnut }, { props: [FACING4], filter: 0, sound: 'wood', hard: 1 });
    A('vx_art_warm', 'Abstract Art (Warm)', { kind: 'art', family: 'warm', frame: P.black }, { props: [FACING4], filter: 0, sound: 'wood', hard: 0.3 });
    A('vx_art_cool', 'Abstract Art (Cool)', { kind: 'art', family: 'cool', frame: P.white }, { props: [FACING4], filter: 0, sound: 'wood', hard: 0.3 });
    A('vx_art_gold', 'Abstract Art (Gold)', { kind: 'art', family: 'gold', frame: P.brass }, { props: [FACING4], filter: 0, sound: 'wood', hard: 0.3 });
    A('vx_tall_plant', 'Tall Indoor Plant', { kind: 'plant2', col: P.white }, { filter: 0, sound: 'grass', hard: 0.3 });
    A('vx_tall_plant_black', 'Tall Plant (Black Pot)', { kind: 'plant2', col: P.black }, { filter: 0, sound: 'grass', hard: 0.3 });
    A('vx_pendant', 'Pendant Lamp', { kind: 'pendant', col: P.black }, { filter: 0, light: [13, 11, 7], sound: 'metal', hard: 0.4 });
    A('vx_pendant_brass', 'Brass Pendant Lamp', { kind: 'pendant', col: P.brass }, { filter: 0, light: [13, 11, 7], sound: 'metal', hard: 0.4 });
    A('vx_chandelier', 'Crystal Chandelier', { kind: 'chandelier', col: P.brass }, { filter: 0, light: [14, 13, 10], sound: 'glass', hard: 0.4 });
    A('vx_sconce', 'Wall Sconce', { kind: 'sconce', col: P.black }, { props: [FACING4], filter: 0, light: [10, 8, 4], sound: 'metal', hard: 0.4 });
    A('vx_led_strip', 'LED Floor Strip (Orange)', { kind: 'ledstrip', glow: P.orange }, { props: [FACING4], filter: 0, light: [10, 6, 1], sound: 'metal', hard: 0.3 });
    A('vx_led_strip_warm', 'LED Floor Strip (Warm)', { kind: 'ledstrip', glow: P.warm }, { props: [FACING4], filter: 0, light: [10, 8, 4], sound: 'metal', hard: 0.3 });
    A('vx_led_cove', 'LED Cove Strip', { kind: 'ledstrip', glow: P.warm, top: true }, { props: [FACING4], filter: 0, light: [10, 8, 4], sound: 'metal', hard: 0.3 });
    A('vx_spot', 'Recessed Ceiling Spot', { kind: 'spot', col: P.white }, { filter: 0, light: [12, 11, 9], sound: 'metal', hard: 0.3 });
    A('vx_bollard', 'Bollard Path Light', { kind: 'bollard', col: P.black, glow: P.warm }, { filter: 0, light: [9, 7, 3], sound: 'metal', hard: 0.8 });
    A('vx_pillar_white', 'White Square Pillar', { kind: 'column', col: P.white }, { filter: 0, sound: 'stone', hard: 1.5 });
    A('vx_column_classic', 'Classical Column', { kind: 'column', family: 'round', col: P.white }, { filter: 0, sound: 'stone', hard: 1.5 });
    A('vx_balustrade', 'White Balustrade', { kind: 'baluster', col: P.white }, { filter: 0, sound: 'stone', hard: 1 });
    A('vx_railing_black', 'Black Steel Railing', { kind: 'rail', col: P.black, rail: 0x3A3D44 }, { filter: 0, sound: 'metal', hard: 1 });
    A('vx_railing_lit', 'Black Railing (Lit)', { kind: 'rail', family: 'lit', col: P.black, rail: 0x3A3D44, glow: P.warm }, { filter: 0, light: [6, 4, 2], sound: 'metal', hard: 1 });
    A('vx_urn', 'Garden Urn', { kind: 'urn', col: P.stone }, { filter: 0, sound: 'stone', hard: 1 });
    A('vx_urn_white', 'White Urn', { kind: 'urn', col: P.white }, { filter: 0, sound: 'stone', hard: 1 });
    A('vx_fountain', 'Fountain Centre', { kind: 'fountain', col: P.stone }, { filter: 0, sound: 'stone', hard: 1.5 });
    for (const [k, col, pil] of [['charcoal', 0x3A3D44, 0xE8D8B8], ['cream', 0xEDE6D6, 0x3A3D44], ['taupe', 0xA89482, 0xF2F2EE], ['white', 0xECEEF2, 0xFF8A2A]]) A('vx_sofa_corner_' + k, k[0].toUpperCase() + k.slice(1) + ' Sofa Corner', { kind: 'lcorner', col, pillow: pil }, { props: [FACING4], filter: 0, sound: 'wool', hard: 0.6 });
    A('vx_curtain', 'Linen Curtain', { kind: 'curtain', col: 0xE8E2D4 }, { props: [FACING4, PART2], filter: 0, sound: 'wool', hard: 0.2 });
    A('vx_curtain_grey', 'Grey Curtain', { kind: 'curtain', col: 0x8A8E96 }, { props: [FACING4, PART2], filter: 0, sound: 'wool', hard: 0.2 });
    A('vx_arc_lamp', 'Arc Floor Lamp', { kind: 'arclamp', col: P.black }, { props: [FACING4], filter: 0, light: [12, 10, 6], sound: 'metal', hard: 0.4 });
    A('vx_tall_cabinet', 'Tall Kitchen Cabinet', { kind: 'tallcab', col: P.white }, { props: [FACING4, PART2], filter: 0, sound: 'wood', hard: 1 });
    A('vx_tall_cabinet_black', 'Black Tall Cabinet', { kind: 'tallcab', col: 0x25272B }, { props: [FACING4, PART2], filter: 0, sound: 'wood', hard: 1 });
    A('vx_wall_shelf', 'Floating Shelf', { kind: 'wshelf', col: P.walnut }, { props: [FACING4], filter: 0, light: [3, 2, 1], sound: 'wood', hard: 0.4 });
    A('vx_lounger', 'Sun Lounger', { kind: 'lounger', col: 0xD8CDB8, towel: 0x3F6AC0 }, { props: [FACING4], filter: 0, sound: 'wood', hard: 0.6 });
    A('vx_bbq', 'BBQ Grill', { kind: 'bbq', col: P.black }, { props: [FACING4], filter: 0, light: [6, 3, 1], sound: 'metal', hard: 1 });
    A('vx_fireplace', 'Stone Fireplace', { kind: 'fireplace', stone: 0x9A948A }, { props: [FACING4, PART2], filter: 0, light: [14, 9, 3], sound: 'stone', hard: 1.5 });
    A('vx_fireplace_dark', 'Slate Fireplace', { kind: 'fireplace', stone: 0x4A4E56 }, { props: [FACING4, PART2], filter: 0, light: [14, 9, 3], sound: 'stone', hard: 1.5 });
    A('vx_washer', 'Washing Machine', { kind: 'washer', col: P.white }, { props: [FACING4], filter: 0, sound: 'metal', hard: 1 });
    A('vx_coat_rack', 'Coat Rack & Shoe Bench', { kind: 'coatrack', col: P.walnut }, { props: [FACING4], filter: 0, sound: 'wood', hard: 0.8 });
    A('vx_piano', 'Upright Piano', { kind: 'piano', col: P.black }, { props: [FACING4], filter: 0, sound: 'wood', hard: 1.2 });
    A('vx_pergola', 'Pergola Slats', { kind: 'pergola', col: P.walnut }, { props: [FACING4], filter: 0, sound: 'wood', hard: 0.8 });
    A('vx_garden_lamp', 'Garden Path Light', { kind: 'gardenlamp', col: P.black }, { filter: 0, light: [9, 7, 4], sound: 'metal', hard: 0.5 });
    A('vx_lamppost_black', 'Black Street Lamp', { kind: 'lamppost', col: 0x2A2D32, post: 0x2A2D32, glow: 0xFFD27A }, { props: [['head', 2]], defaultIndex: 1, light: (p) => p.head ? [14, 12, 7] : null, filter: 0, sound: 'metal' });
    A('vx_glass_door_black', 'Black-Frame Glass Door', { kind: 'mdoor', col: 0xBFE4F4, frame: 0x2A2D32, frameD: 0x1C1E22, dot: 0xC8D8E0 }, { props: [FACING4, ['open', 2]], solid: false, sound: 'glass', hard: 1.5 });
    A('vx_school_board', 'Whiteboard', { kind: 'board', col: P.white }, { props: [FACING4], filter: 0, sound: 'metal', hard: 0.5 });
    A('vx_school_desk', 'School Desk', { kind: 'sdesk', col: P.black, top: P.oak, seat: 0x3F6AC0 }, { props: [FACING4], filter: 0, sound: 'wood', hard: 0.8 });
    A('vx_machine', 'Factory Machine', { kind: 'machine', col: 0x5A6472 }, { props: [FACING4], filter: 0, light: [3, 3, 3], sound: 'metal', hard: 2 });
    A('vx_conveyor', 'Conveyor Belt', { kind: 'conveyor', col: P.steel }, { props: [FACING4], filter: 0, sound: 'metal', hard: 1.5 });
    const CARS = { black: 0x22262C, white: 0xEEF0F2, red: 0xB8302A, blue: 0x2C4C8A, silver: 0xB8BEC6 };
    const PARTS = ['part', ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12', 'p13', 'p14', 'p15']];
    for (const k in CARS) A('vx_car_' + k, k[0].toUpperCase() + k.slice(1) + ' Car', { kind: 'car', col: CARS[k] }, { props: [FACING4, PARTS], filter: 0, sound: 'metal', hard: 2 });
  });
  VR.HOME_CARS = ['vx_car_black', 'vx_car_white', 'vx_car_red', 'vx_car_blue', 'vx_car_silver'];
})(VR);
