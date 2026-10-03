// ============================================================================
// The house catalogue — real villas at real scale. Every home in a modern town
// is built from a researched floor plan, not painted by hand:
//  · STADTVILLA (after the Kern-Haus Stadtvillen: Signus 8.98 × 10.23 m, Karat
//    12.60 × 11.85 m, two full storeys under a 22° hip roof): Diele with the
//    stair, Gäste-WC and HWR beside it, a study at the front, the open
//    Wohnen/Essen/Küche across the whole garden side behind floor-to-ceiling
//    glass and terrace doors; upstairs Kind 1 + 2 at the street, Flur/Galerie
//    over the hall, the master with a dressing zone and a balcony on the garden
//    side, a big family bath, a guest room with its own shower bath. Skins:
//    white/anthracite (Signus), grey, mediterranean with terracotta, Bauhaus
//    flat roof (Black Label), clinker, sand.
//  · BEL PORTALE (Stilhaus): classicist Stadtvilla — 6 m twin-column portico
//    with a pediment, two octagonal corner towers, balustrade balconies, a
//    mansard roof with dormers, the double-height foyer with the stair, a
//    polygonal living room with a fireplace wall, a winter-garden dining room.
//  · SANSSOUCIS (Stilhaus "Villa am See"): white clinker on a bossed stone base,
//    natural slate roof, six 6 m marble columns across two storeys on the
//    garden front, a curved balustraded terrace, the double staircase, a pool.
//  · TOSCANA (Stilhaus): ochre mediterranean villa with a round tower, arched
//    windows, an arcaded loggia and terracotta roofs.
// Every house has a double garage (42 m²) or carport and driveway, a garden
// with a travertine terrace, pergola, outdoor dining, BBQ, loungers, a pool on
// the big lots, lawns, beds, hedges and trees — and every room is furnished by
// the interior designer. Lot-local frame: u across the front, v from the
// street (v = 0) into the lot, facing 0 = street, 1 = +u, 2 = +v, 3 = −u.
// ============================================================================
(function (VR) {
  'use strict';
  const VG = VR.VillageGen;
  if (!VG) return;
  const PLAN = VG.plan2 = {};
  const CARS = ['vx_car_black', 'vx_car_white', 'vx_car_red', 'vx_car_blue', 'vx_car_silver'];
  const BEDS = ['vx_bed_white', 'vx_bed_teal', 'vx_bed_blue', 'vx_bed_green', 'vx_bed_purple', 'vx_bed_pink'];
  const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]];          // facing → (du, dv)
  const FACE_FROM_WALL = [2, 3, 0, 1];                      // a piece against wall side s faces into the room
  const CIRC = { foyer: 1, hall: 1, gallery: 1 };           // circulation rooms

  // ---------------------------------------------------------------- skins (exterior looks)
  const SKINS = {
    signus: { id: 'signus', wall: 'stucco_white', accent: 'charcoal_panel', plinth: 'concrete_smooth', band: 'stucco_white', trim: 'white_trim', roof: 'hip', hip: 'slate', glass: 'window_black', rail: 'vx_railing_black', column: 'vx_pillar_white', canopy: 'white_trim', floorL: 'floor_oak_wide', floorH: 'floor_porcelain' },
    grey: { id: 'grey', wall: 'stucco_grey', accent: 'wood_slat', plinth: 'concrete_smooth', band: 'white_trim', trim: 'white_trim', roof: 'hip', hip: 'slate', glass: 'window_black', rail: 'glass_rail', column: 'vx_pillar_white', canopy: 'white_trim', floorL: 'floor_oak', floorH: 'floor_cement' },
    sand: { id: 'sand', wall: 'stucco_sand', accent: 'wood_slat', plinth: 'stacked_stone', band: 'stucco_sand', trim: 'white_trim', roof: 'hip', hip: 'slate', glass: 'window_black', rail: 'vx_railing_black', column: 'vx_pillar_white', canopy: 'roof_charcoal_slab', floorL: 'floor_oak_wide', floorH: 'floor_porcelain' },
    mediterran: { id: 'mediterran', wall: 'stucco_cream', accent: 'stucco_ochre', plinth: 'travertine', band: 'white_trim', trim: 'white_trim', roof: 'hip', hip: 'terracotta', glass: 'window_black', rail: 'vx_balustrade', column: 'vx_column_classic', canopy: 'white_trim', floorL: 'floor_marble', floorH: 'floor_marble', arches: true, palms: true },
    bauhaus: { id: 'bauhaus', wall: 'stucco_white', accent: 'charcoal_panel', plinth: 'charcoal_panel', band: 'charcoal_panel', trim: 'white_trim', roof: 'flat', hip: 'slate', glass: 'window_black', rail: 'glass_rail', column: 'black_metal', canopy: 'charcoal_panel', floorL: 'floor_cement', floorH: 'floor_porcelain' },
    klinker: { id: 'klinker', wall: 'white_clinker', accent: 'charcoal_panel', plinth: 'concrete_smooth', band: 'charcoal_panel', trim: 'white_trim', roof: 'hip', hip: 'slate', glass: 'window_black', rail: 'vx_railing_black', column: 'vx_pillar_white', canopy: 'charcoal_panel', floorL: 'floor_oak', floorH: 'floor_porcelain' },
    classic: { id: 'classic', wall: 'stucco_cream', accent: 'white_trim', plinth: 'bossed_stone', band: 'white_trim', trim: 'white_trim', roof: 'mansard', hip: 'slate', glass: 'window_white', rail: 'vx_balustrade', column: 'vx_column_classic', canopy: 'white_trim', floorL: 'floor_marble', floorH: 'floor_marble', lintels: true, quoins: true },
    lake: { id: 'lake', wall: 'white_clinker', accent: 'bossed_stone', plinth: 'bossed_stone', band: 'white_trim', trim: 'white_trim', roof: 'hip', hip: 'slate', glass: 'window_white', rail: 'vx_balustrade', column: 'vx_column_classic', canopy: 'white_trim', floorL: 'floor_marble', floorH: 'floor_oak', lintels: true, palms: true },
    toscana: { id: 'toscana', wall: 'stucco_ochre', accent: 'stucco_sand', plinth: 'travertine', band: 'stucco_ochre', trim: 'travertine', roof: 'hip', hip: 'terracotta', glass: 'window_black', rail: 'vx_balustrade', column: 'vx_column_classic', canopy: 'travertine', floorL: 'floor_terrazzo', floorH: 'floor_terrazzo', arches: true, palms: true },
  };
  SKINS.pult = { id: 'pult', wall: 'stucco_white', accent: 'wood_slat', plinth: 'stacked_stone', band: 'stucco_white', trim: 'white_trim', roof: 'mono', hip: 'slate', glass: 'window_black', rail: 'glass_rail', column: 'stacked_stone', canopy: 'roof_charcoal_slab', floorL: 'floor_oak', floorH: 'floor_porcelain' };
  SKINS.blacklabel = { id: 'blacklabel', wall: 'stucco_white', accent: 'black_metal', plinth: 'charcoal_panel', band: 'black_metal', trim: 'black_metal', roof: 'flat', hip: 'slate', glass: 'window_black', rail: 'glass_rail', column: 'black_metal', canopy: 'black_metal', floorL: 'floor_cement', floorH: 'floor_porcelain', cantilever: true };
  // Glashaus: Vollton walls, panorama glass with joined black frames, flush and pivot doors (v0.31)
  SKINS.glas = { id: 'glas', wall: 'vollton_white', accent: 'vollton_graphite', plinth: 'vollton_graphite', band: 'vollton_graphite', trim: 'vollton_white', roof: 'flat', hip: 'slate', glass: 'panorama_black', rail: 'glass_rail', column: 'black_metal', canopy: 'vollton_graphite', floorL: 'floor_oak_wide', floorH: 'floor_porcelain', cantilever: true, staffel: true,
    panorama: { glass: 'panorama_black', frosted: 'panorama_frosted' }, door: 'door_flush_white', entry: 'door_pivot_anthracite', terrace: 'door_glass_black' };
  // … and at night: anthracite Vollton, white-framed glass, white trim
  SKINS.glasnacht = { id: 'glasnacht', wall: 'vollton_anthracite', accent: 'vollton_white', plinth: 'vollton_black', band: 'vollton_white', trim: 'vollton_white', roof: 'flat', hip: 'slate', glass: 'panorama_white', rail: 'glass_rail', column: 'vollton_white', canopy: 'vollton_white', floorL: 'floor_oak', floorH: 'floor_cement', cantilever: true, staffel: true,
    panorama: { glass: 'panorama_white', frosted: 'panorama_frosted' }, door: 'door_flush_oak', entry: 'door_loft_black', terrace: 'door_glass_white' };
  PLAN.SKINS = SKINS;
  const STADT_SKINS = ['signus', 'signus', 'grey', 'sand', 'mediterran', 'bauhaus', 'klinker', 'pult', 'blacklabel', 'glas', 'glasnacht'];

  // ---------------------------------------------------------------- floor-plan helpers
  const R = (type, u0, v0, u1, v1, extra) => Object.assign({ type, u0, v0, u1, v1 }, extra || {});
  // the wall cells shared by two rooms (a's wall side s and the run of cells) — rooms are separated by exactly one wall cell
  function shared(a, b) {
    const ov = (a0, a1, b0, b1) => { const lo = Math.max(a0, b0), hi = Math.min(a1, b1); return hi >= lo ? [lo, hi] : null; };
    if (b.u0 === a.u1 + 2) { const o = ov(a.v0, a.v1, b.v0, b.v1); if (o) return { side: 1, cells: range(o).map(v => [a.u1 + 1, v]) }; }
    if (a.u0 === b.u1 + 2) { const o = ov(a.v0, a.v1, b.v0, b.v1); if (o) return { side: 3, cells: range(o).map(v => [a.u0 - 1, v]) }; }
    if (b.v0 === a.v1 + 2) { const o = ov(a.u0, a.u1, b.u0, b.u1); if (o) return { side: 2, cells: range(o).map(u => [u, a.v1 + 1]) }; }
    if (a.v0 === b.v1 + 2) { const o = ov(a.u0, a.u1, b.u0, b.u1); if (o) return { side: 0, cells: range(o).map(u => [u, a.v0 - 1]) }; }
    return null;
  }
  const range = ([a, b]) => { const o = []; for (let k = a; k <= b; k++) o.push(k); return o; };

  // ================================================================ STADTVILLA (parametric: 13×13 … 18×16)
  // interior W × D; left column a (study / kid 1 / master), foyer column fw (3–4), right column (WC + HWR / kid 2 / guest)
  function tStadtvilla(w, d, o) {
    const W = w - 2, D = d - 2, fw = W >= 14 ? 4 : 3, a = Math.floor((W - fw - 2) / 2), r0 = a + fw + 3;
    const fd = 5, gd = fd + 2;                               // front band depth, gallery depth
    const fu0 = a + 2, fu1 = a + 1 + fw;                     // foyer columns
    const zl = a + 1, zd = a + fw + 1;                       // open-plan zone splits
    const H = { family: 'stadtvilla', w, d, storeys: 2, floors: [], stairs: { u: fu1, v0: 2, n: 3 }, entry: { u: fw === 4 ? fu0 + 1 : fu0 + 1, n: fw === 4 ? 2 : 1 } };
    const G = { y: 0, rooms: [
      R('study', 1, 1, a, fd, { to: 'foyer' }),
      R('foyer', fu0, 1, fu1, fd, { id: 'foyer' }),
      R('wc', r0, 1, W, 2, { to: 'foyer' }),
      R('utility', r0, 4, W, fd, { to: 'foyer', to2: 'open' }),
      R('open', 1, gd, W, D, { id: 'open', to: 'foyer', wide: fw === 4 ? 3 : 2, zones: [R('living', 1, gd, zl, D), R('dining', zl + 1, gd, zd, D), R('kitchen', zd + 1, gd, W, D)] }),
    ] };
    const U = { y: 4, rooms: [
      R('kid', 1, 1, a, fd, { to: 'gallery' }),
      R('gallery', fu0, 1, fu1, gd, { id: 'gallery' }),
      R('kid', r0, 1, W, fd, { to: 'gallery', terrace: true }),
      R('master', 1, gd, a, D, { to: 'gallery', balcony: true, dressing: true }),
      R('bath', fu0, gd + 2, fu1, D, { to: 'gallery' }),
    ] };
    if (D - gd >= 6) { U.rooms.push(R('guest', r0, gd, W, gd + 3, { id: 'guest', to: 'gallery' }), R('ensuite', r0, gd + 5, W, D, { to: 'guest' })); }
    else U.rooms.push(R('guest', r0, gd, W, D, { to: 'gallery' }));
    H.floors.push(G, U);
    H.features = { canopy: true, erker: o.rng.chance(0.5) ? { side: 3, v0: 2, v1: 4 } : null, balcony: o.rng.chance(0.65) ? { u0: 1, u1: fu1, deep: 2 } : null, garageDoor: { v0: 4, v1: fd } };
    // Staffelgeschoss (OKAL Staffel): the upper floor drops the garage-side column, the rest becomes a roof terrace
    if (o.staffel) { U.rooms = U.rooms.filter(r => r.u0 < r0); U.rect = [0, 0, r0 - 1, d - 1]; H.staffel = true; }
    if (o.cantilever) { H.features.cantilever = { u0: fu0, u1: fu1 }; H.features.canopy = false; }
    H.floors[0].rooms[0].id = 'study';
    return H;
  }

  // ================================================================ BEL PORTALE (17 × 15): the classicist Stadtvilla
  function tBelPortale(o) {
    const w = 17, d = 15, W = 15, D = 13;
    const H = { family: 'belportale', w, d, storeys: 2, floors: [], stairs: { u: 9, v0: 2, n: 3 }, entry: { u: 7, n: 2 }, voidRect: [7, 1, 8, 4] };
    H.floors.push({ y: 0, rooms: [
      R('living', 1, 1, 5, 8, { to: 'foyer', wide: 3, fireplace: 3, tower: true }),
      R('foyer', 7, 1, 9, D, { id: 'foyer', grand: true }),
      R('dining', 11, 1, W, 5, { to: 'foyer', wide: 3, tower: true, winter: true }),
      R('wc', 11, 7, 12, 8, { to: 'foyer' }),
      R('utility', 14, 7, W, 8, { to: 'kitchen' }),
      R('kitchen', 11, 10, W, D, { id: 'kitchen', to: 'foyer', wide: 2 }),
      R(o.rng.chance(0.4) ? 'cinema' : 'library', 1, 10, 5, D, { to: 'foyer' }),
    ] });
    H.floors.push({ y: 4, rooms: [
      R('master', 1, 1, 5, 6, { to: 'gallery', tower: true }),
      R('walkin', 1, 8, 5, 9, { to: 'master' }),
      R('ensuite', 1, 11, 5, D, { to: 'gallery' }),
      R('gallery', 7, 5, 9, D, { id: 'gallery' }),
      R('kid', 11, 1, W, 5, { to: 'gallery', tower: true }),
      R('bath', 11, 7, W, 9, { to: 'gallery' }),
      R('kid', 11, 11, W, D, { to: 'gallery' }),
    ] });
    H.features = { portico: { u0: 5, u1: 11 }, towers: [[0, 0], [w - 1, 0]], frontBalconies: true, garageDoor: null };
    return H;
  }

  // ================================================================ SANSSOUCIS (18 × 14): the villa by the lake
  function tSanssoucis(o) {
    const w = 18, d = 14, W = 16, D = 12;
    const H = { family: 'sanssoucis', w, d, storeys: 2, floors: [], stairs: { double: true, u0: 8, u1: 10, v0: 2, n: 3 }, entry: { u: 8, n: 2 }, voidRect: [8, 1, 10, 4] };
    H.floors.push({ y: 0, rooms: [
      R('salon', 1, 1, 6, 5, { to: 'foyer', wide: 3, fireplace: 1 }),
      R('foyer', 8, 1, 10, D, { id: 'foyer', grand: true, checker: true }),
      R('study', 12, 1, W, 4, { to: 'foyer' }),
      R('wc', 12, 6, 13, 7, { to: 'foyer' }),
      R('utility', 15, 6, W, 7, { to: 'kitchen' }),
      R('kitchen', 12, 9, W, D, { id: 'kitchen', to: 'foyer', wide: 2 }),
      R('dining', 1, 7, 6, D, { to: 'foyer', wide: 3 }),
    ] });
    H.floors.push({ y: 4, rooms: [
      R('kid', 1, 1, 6, 5, { to: 'gallery' }),
      R('gallery', 8, 5, 10, D, { id: 'gallery' }),
      R('guest', 12, 1, W, 5, { to: 'gallery' }),
      R('master', 1, 7, 6, D, { to: 'gallery', balcony: true, dressing: true }),
      R('bath', 12, 7, W, 9, { to: 'gallery' }),
      R('kid', 12, 11, W, D, { to: 'gallery' }),
    ] });
    H.features = { colonnade: { u0: 0, u1: w - 1 }, curvedTerrace: true, canopy: true, garageDoor: { v0: 6, v1: 7 }, quoins: true };
    return H;
  }

  // ================================================================ TOSCANA (15 × 13): the mediterranean villa with a round tower
  function tToscana(o) {
    const w = 15, d = 13, W = 13, D = 11;
    const H = { family: 'toscana', w, d, storeys: 2, floors: [], stairs: { u: 8, v0: 2, n: 3 }, entry: { u: 7, n: 1 } };
    H.floors.push({ y: 0, rooms: [
      R('living', 1, 1, 4, 5, { to: 'foyer', wide: 2, tower: true, fireplace: 1 }),
      R('foyer', 6, 1, 8, 5, { id: 'foyer' }),
      R('wc', 10, 1, W, 2, { to: 'foyer' }),
      R('utility', 10, 4, W, 5, { to: 'foyer', to2: 'open' }),
      R('open', 1, 7, W, D, { id: 'open', to: 'foyer', wide: 3, zones: [R('dining', 1, 7, 6, D), R('kitchen', 7, 7, W, D)] }),
    ] });
    H.floors.push({ y: 4, rooms: [
      R('master', 1, 1, 4, 5, { to: 'gallery', tower: true }),
      R('gallery', 6, 1, 8, 8, { id: 'gallery' }),
      R('kid', 10, 1, W, 5, { to: 'gallery', terrace: true }),
      R('bath', 6, 10, 8, D, { to: 'gallery' }),
      R('kid', 1, 7, 4, D, { to: 'gallery' }),
      R('guest', 10, 7, W, D, { to: 'gallery', balcony: true }),
    ] });
    H.features = { roundTower: [0, 0], loggia: { u0: 1, u1: 6 }, canopy: true, garageDoor: { v0: 4, v1: 5 } };
    return H;
  }

  // ================================================================ PALAIS ROYAL (25 × 15 + the swimming hall): Stilhaus' palace
  function tPalais(o) {
    const w = 25, d = 15, W = 23, D = 13;
    const H = { family: 'palais', w, d, storeys: 2, floors: [], stairs: { double: true, u0: 11, u1: 13, v0: 2, n: 3 }, entry: { u: 11, n: 3 }, voidRect: [11, 1, 13, 4] };
    H.floors.push({ y: 0, rooms: [
      R('salon', 1, 1, 9, 6, { to: 'foyer', wide: 3, fireplace: 1 }),
      R('dining', 1, 8, 9, D, { to: 'foyer', wide: 3 }),
      R('foyer', 11, 1, 13, D, { id: 'foyer', grand: true, checker: true }),
      R(o.rng.chance(0.5) ? 'library' : 'cinema', 15, 1, W, 6, { to: 'foyer', wide: 2 }),
      R('kitchen', 15, 8, 19, D, { id: 'kitchen', to: 'foyer', wide: 2 }),
      R('bar', 21, 8, W, 9, { to: 'kitchen' }),
      R('wc', 21, 11, W, D, { to: 'kitchen' }),
    ] });
    H.floors.push({ y: 4, rooms: [
      R('master', 1, 1, 9, 6, { to: 'gallery', dressing: true }),
      R('walkin', 1, 8, 4, D, { to: 'master' }),
      R('ensuite', 6, 8, 9, D, { to: 'master' }),
      R('gallery', 11, 5, 13, D, { id: 'gallery' }),
      R('guest', 15, 1, W, 6, { to: 'gallery' }),
      R('kid', 15, 8, 18, D, { id: 'kid', to: 'gallery' }),
      R('bath', 20, 8, W, D, { to: 'kid' }),
    ] });
    H.features = { portico: { u0: 9, u1: 15 }, frontBalconies: true, quoins: true, poolHall: { u0: 0, u1: 9, deep: 8 }, garageDoor: null };
    return H;
  }

  // ================================================================ BUNGALOW (17 × 14, one storey under a hip roof — OKAL Bungalow / Stilhaus Primavera)
  function tBungalow(o) {
    const w = 17, d = 14, W = 15, D = 12;
    const H = { family: 'bungalow', w, d, storeys: 1, floors: [], stairs: null, entry: { u: 7, n: 1 } };
    H.floors.push({ y: 0, rooms: [
      R('kid', 1, 1, 4, 3, { to: 'hall' }),
      R('kid', 1, 5, 4, 7, { to: 'hall' }),
      R('hall', 6, 8, 8, 7, { id: 'hall' }),
      R('master', 10, 1, W, 4, { to: 'hall', dressing: true }),
      R('bath', 10, 12, 12, 7, { to: 'hall' }),
      R('utility', 14, 6, W, 7, { to: 'open' }),
      R('open', 1, 9, W, D, { id: 'open', to: 'hall', wide: 3, zones: [R('living', 1, 9, 5, D), R('dining', 6, 9, 9, D), R('kitchen', 10, 9, W, D)] }),
    ] });
    H.floors[0].rooms[2] = R('hall', 6, 1, 8, 7, { id: 'hall' });
    H.floors[0].rooms[4] = R('bath', 10, 6, 12, 7, { to: 'hall' });
    H.features = { canopy: true, garageDoor: { v0: 6, v1: 7 } };
    return H;
  }

  // ---------------------------------------------------------------- the scaler: every plan grows by PLAN.SCALE (1.5 → "villa scale")
  // wall lines map to round(x · s); a room edge stays one cell inside its bounding walls, so walls keep one cell thick
  PLAN.SCALE = 1.5;
  function scalePlan(H, s) {
    if (!s || s === 1) return H;
    const T = (x) => Math.round(x * s), Tc = (p) => Math.round(p * s);
    const w = T(H.w - 1) + 1, d = T(H.d - 1) + 1;
    const foyer0 = H.floors[0].rooms.find(r => r.type === 'foyer' || r.type === 'hall');
    const stairRight = !!(H.stairs && foyer0 && !H.stairs.double && H.stairs.u === foyer0.u1);
    const rect = (r) => { const u0 = T(r.u0 - 1) + 1, v0 = T(r.v0 - 1) + 1, u1 = T(r.u1 + 1) - 1, v1 = T(r.v1 + 1) - 1; r.u0 = u0; r.v0 = v0; r.u1 = u1; r.v1 = v1; };
    for (const fl of H.floors) {
      for (const r of fl.rooms) {
        const old = { u0: r.u0, u1: r.u1, v0: r.v0, v1: r.v1 };
        rect(r);
        if (r.zones) {
          // zones split the room without walls: scale their inner boundaries proportionally inside the new rect
          const su = (r.u1 - r.u0) / Math.max(1, old.u1 - old.u0), sv = (r.v1 - r.v0) / Math.max(1, old.v1 - old.v0);
          for (const z of r.zones) { const zu0 = z.u0 === old.u0 ? r.u0 : r.u0 + Math.round((z.u0 - old.u0) * su), zu1 = z.u1 === old.u1 ? r.u1 : r.u0 + Math.round((z.u1 - old.u0) * su), zv0 = z.v0 === old.v0 ? r.v0 : r.v0 + Math.round((z.v0 - old.v0) * sv), zv1 = z.v1 === old.v1 ? r.v1 : r.v0 + Math.round((z.v1 - old.v0) * sv); z.u0 = zu0; z.u1 = zu1; z.v0 = zv0; z.v1 = zv1; }
          for (let k = 1; k < r.zones.length; k++) { const a = r.zones[k - 1], b = r.zones[k]; if (a.v0 === b.v0 && a.v1 === b.v1 && b.u0 !== a.u1 + 1) b.u0 = a.u1 + 1; }
        }
      }
      if (fl.rect) fl.rect = [T(fl.rect[0]), T(fl.rect[1]), T(fl.rect[2]), T(fl.rect[3])];
    }
    const foyer = H.floors[0].rooms.find(r => r.type === 'foyer' || r.type === 'hall');
    if (H.stairs) {
      const S = H.stairs;
      if (S.double) { S.u0 = foyer ? foyer.u0 : T(S.u0 - 1) + 1; S.u1 = foyer ? foyer.u1 : T(S.u1 + 1) - 1; }
      else if (foyer) S.u = stairRight ? foyer.u1 : foyer.u0;
      S.v0 = 2;
    }
    if (foyer) H.entry.u = foyer.u0 + ((foyer.u1 - foyer.u0 + 1 - H.entry.n) >> 1);
    if (H.voidRect) { const [a, b, c, dd] = H.voidRect; H.voidRect = [T(a - 1) + 1, T(b - 1) + 1, T(c + 1) - 1, Tc(dd)]; }
    const f = H.features || {};
    if (f.erker) { f.erker.v0 = Tc(f.erker.v0); f.erker.v1 = Tc(f.erker.v1); }
    if (f.balcony) { f.balcony.u0 = Tc(f.balcony.u0); f.balcony.u1 = Math.min(w - 2, Tc(f.balcony.u1)); f.balcony.deep = 3; }
    if (f.portico) { f.portico.u0 = Tc(f.portico.u0); f.portico.u1 = Tc(f.portico.u1); }
    if (f.towers) f.towers = f.towers.map(([u, v]) => [u === 0 ? 0 : w - 1, v === 0 ? 0 : d - 1]);
    if (f.roundTower) f.roundTower = [f.roundTower[0] === 0 ? 0 : w - 1, f.roundTower[1] === 0 ? 0 : d - 1];
    if (f.colonnade) f.colonnade = { u0: 0, u1: w - 1 };
    if (f.loggia) { f.loggia.u0 = Tc(f.loggia.u0); f.loggia.u1 = Tc(f.loggia.u1); }
    if (f.poolHall) { f.poolHall.u0 = Tc(f.poolHall.u0); f.poolHall.u1 = Tc(f.poolHall.u1); f.poolHall.deep = Tc(f.poolHall.deep); }
    if (f.cantilever) { f.cantilever.u0 = Tc(f.cantilever.u0); f.cantilever.u1 = Tc(f.cantilever.u1); }
    if (f.garageDoor) { f.garageDoor.v0 = Tc(f.garageDoor.v0); f.garageDoor.v1 = Tc(f.garageDoor.v1); }
    H.w = w; H.d = d; H.scaled = s;
    return H;
  }
  PLAN.scalePlan = scalePlan;

  // ---------------------------------------------------------------- the catalogue: lot size → house
  // lots: [w, d] of the whole lot (house + garage + garden); the family is chosen by the lot's dims
  PLAN.CATALOGUE = [
    { lot: [25, 22], make: (o) => tStadtvilla(18, 16, o), garage: true, garden: 6, skins: STADT_SKINS },
    { lot: [23, 21], make: (o) => tStadtvilla(16, 15, o), garage: true, garden: 6, skins: STADT_SKINS },
    { lot: [21, 20], make: (o) => tStadtvilla(14, 14, o), garage: true, garden: 6, skins: STADT_SKINS },
    { lot: [24, 23], make: tBelPortale, garage: true, garden: 6, skins: ['classic'], front: 2 },
    { lot: [25, 23], make: tSanssoucis, garage: true, garden: 9, skins: ['lake'] },
    { lot: [22, 19], make: tToscana, garage: true, garden: 6, skins: ['toscana'] },
    { lot: [24, 20], make: tBungalow, garage: true, garden: 6, skins: ['signus', 'grey', 'sand', 'mediterran', 'klinker', 'glas'] },
    { lot: [32, 27], make: tPalais, garage: true, garden: 10, skins: ['classic'], front: 2 },
    { lot: [20, 19], make: (o) => tStadtvilla(13, 13, o), garage: true, garden: 6, skins: STADT_SKINS },
    { lot: [17, 19], make: (o) => tStadtvilla(13, 13, o), garage: false, carport: true, garden: 6, skins: STADT_SKINS },
    { lot: [13, 17], make: (o) => tStadtvilla(13, 13, o), garage: false, carport: false, garden: 4, skins: STADT_SKINS },
  ];
  // lot sizes follow the scaled houses: garage strip (10) or carport (5) beside, the portico in front, the garden behind
  PLAN.GARAGE_W = 10; PLAN.CARPORT_W = 5;
  for (const c of PLAN.CATALOGUE) {
    const H = scalePlan(c.make({ rng: new VR.RNG(1), beds: 3 }), PLAN.SCALE);
    c.front = c.front ? Math.round(c.front * PLAN.SCALE) : 0;
    c.garden = Math.round(c.garden * PLAN.SCALE);
    c.lot = [H.w + (c.garage ? PLAN.GARAGE_W : c.carport ? PLAN.CARPORT_W : 0), c.front + H.d + c.garden];
  }
  PLAN.DIMS = PLAN.CATALOGUE.map(c => c.lot.slice());
  // names (the Studio's catalogue order) and the blueprint icon of each house
  const NAMES = [['Villa R9 180', 'villa'], ['Villa R9 160', 'villa'], ['Villa R9 140', 'villa'], ['Bel Portale', 'portico'], ['Sanssoucis', 'colonnade'], ['Toscana', 'tower'], ['Bungalow R9', 'bungalow'], ['Palais Royal', 'palace'], ['Villa R9 130', 'villa'], ['Villa R9 130 Carport', 'villa'], ['Villa R9 Compact', 'compact']];
  PLAN.CATALOGUE.forEach((c, i) => { c.name = NAMES[i] ? NAMES[i][0] : 'Villa ' + (i + 1); c.icon = NAMES[i] ? NAMES[i][1] : 'villa'; });
  // blueprints: every catalogue house as an item (main.blueprints.js builds it where the player points)
  if (VR.defItem) PLAN.CATALOGUE.forEach((c, i) => VR.defItem('blueprint_' + i, { name: 'Blueprint · ' + c.name, cat: 'blueprints', stack: 1, use: 'blueprint', house: i, texKey: 'blueprint:' + c.icon }));
  PLAN.pick = function (w, d, rng) {
    const exact = PLAN.CATALOGUE.filter(c => c.lot[0] === w && c.lot[1] === d);
    if (exact.length) return exact[0];
    // otherwise the biggest catalogue entry that fits the lot
    const fits = PLAN.CATALOGUE.filter(c => c.lot[0] <= w && c.lot[1] <= d).sort((p, q) => q.lot[0] * q.lot[1] - p.lot[0] * p.lot[1]);
    return fits[0] || null;
  };
  PLAN.dims = function (rng) { return PLAN.DIMS[rng.int(PLAN.DIMS.length)].slice(); };
  PLAN.templates = { stadtvilla: tStadtvilla, belportale: tBelPortale, sanssoucis: tSanssoucis, toscana: tToscana, bungalow: tBungalow, palais: tPalais };
  PLAN.shared = shared;
  if (VG.modern && VG.modern.DIMS) VG.modern.DIMS.home = PLAN.DIMS.slice();   // the town planner draws home lots from the catalogue
})(VR);
