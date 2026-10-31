// ============================================================================
// 🛰 Raumstation — the R9 Forge's station kind (u-stations; docs/superpowers/plans/2026-10-31-u-stations.md). The inside
// of a station as one block grid, built by symbol like every Forge kind ("station:k0#1"):
//   k0 · the Ringstation's section — the Panoramahalle (a window wall to the planet on its −z side, benches, planters, a
//        holo table, gravity plates in the floor), the open Andockdeck outside the glass (three berths with clamps,
//        guide lights and hazard edges — the player's ship parks on berth 0, the shuttles on berth 1), the
//        Stationsladen (shelves, the counter), the Leitstand (consoles, holo screens), the Quartiere (eight cabins on a
//        corridor), the Hydrogarten under a glass roof, and the ring corridor that curves up at both ends behind glass
//        bulkheads (the ring's own curve, radius 80)
//   k1 · an outpost at a moon — a smaller deck with two berths, a hall with its window wall, a counter, four bunks
// The grid's frame is the station dim's: −y the plates' gravity, −z toward the planet (the window wall), the floor
// at world y 64. STA.place(k) gives the grid's world offset and the places the game needs (the berths, the spawn, the
// counter, the cabins' beds and doors, the pad). Pure, deterministic, any thread (the worker stamps it: gen_stn.js).
// ============================================================================
(function (VR) {
  'use strict';
  const Forge = VR.Forge; if (!Forge || !Forge.kit) return;
  const tx = (...a) => Forge.tx(...a);
  const FY = 64;                                   // the floor's walking level (the floor blocks at 63)
  const RING_R = 80;                               // the ring corridor's curve (blocks)
  // the grids' extents in the dim (world coordinates of the grid's corner and its size)
  const BOX = [{ x0: -96, y0: 52, z0: -64, sx: 193, sy: 52, sz: 99 }, { x0: -40, y0: 52, z0: -48, sx: 81, sy: 30, sz: 66 }];
  // the places, in world coordinates of the dim (the same for every seed: the game and the tests read them)
  const PLACES = [
    { spawn: [0.5, FY, 6.5, 0], berth: [-16.5, FY, -31.5], pad: [17.5, FY, -31.5], hold: 1, counter: [28, FY, 6], board: [26, FY, 9],
      cabins: [], hall: [0, FY, 4], window: { z: -7, x0: -20, x1: 20, y0: FY, y1: FY + 8 }, garden: [0, FY, 22], control: [28, FY, 18], echo: [0.5, FY, -1.0] },
    { spawn: [0.5, FY, 3.5, 0], berth: [-9.5, FY, -26.5], pad: [9.5, FY, -26.5], hold: 1, counter: [7, FY, 4], board: [6, FY, 6],
      cabins: [], hall: [0, FY, 2], window: { z: -7, x0: -10, x1: 10, y0: FY, y1: FY + 6 }, garden: null, control: [-6, FY, 4] },
  ];
  // the cabins (their beds, doors, the spots in and out) — the same formulas the build uses, known without a build
  PLACES[0].cabins = []; for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const z0 = -5 + i * 7, xw = side < 0 ? -30 : -26, dz = z0 + 2, bx = side < 0 ? -33 : -23;
    PLACES[0].cabins.push({ door: [xw, FY, dz], inside: [side < 0 ? -32 : -24, FY, dz], outside: [-28, FY, dz], bed: [bx, FY, z0 + 1, 0], side, z0 });
  }
  PLACES[1].cabins = [[-9, -1], [-9, 2], [9, -1], [9, 2]].map(([x, z]) => ({ door: null, inside: [x + (x < 0 ? 2 : -2), FY, z], outside: [0, FY, 2], bed: [x, FY, z, 0] }));
  const STA = Forge.Station = { FY, RING_R, BOX, PLACES };
  STA.dna = (k) => 'station:k' + (k | 0) + '#1';
  STA.place = (k) => PLACES[k ? 1 : 0];
  STA.box = (k) => BOX[k ? 1 : 0];

  Forge.register({
    id: 'station', icon: '🛰', name: 'Raumstation', en: 'Space station', level: false, sh: 9,
    params: [{ k: 'k', label: 'Art', min: 0, max: 1, def: 0, names: ['Ringstation', 'Außenposten'] }],
    styles: [{ id: 'hell', name: 'Hell' }],
    lot: (P) => { const B = BOX[P.params.k ? 1 : 0]; return [B.sx, B.sz]; },
    title: (P) => (P.params.k ? tx('g.fg.stnOutpost', null, 'Außenposten', 'Outpost') : tx('g.fg.stnRing', null, 'Ringstation', 'Ringstation')),
    describe: (P) => (P.params.k ? [tx('g.fg.stnDeck2', null, 'Andockdeck, zwei Plätze', 'docking deck, two berths'), tx('g.fg.stnBunks', null, 'vier Kojen', 'four bunks')]
      : [tx('g.fg.stnHall', null, 'Panoramahalle', 'panorama hall'), tx('g.fg.stnDeck3', null, 'Andockdeck, drei Plätze', 'docking deck, three berths'), tx('g.fg.stnShop', null, 'Laden', 'shop'), tx('g.fg.stnCabins', null, 'acht Quartiere', 'eight cabins'), tx('g.fg.stnGarden', null, 'Hydrogarten', 'hydro garden')]),
  }, function (P) {
    const k = P.params.k ? 1 : 0, B = BOX[k], PL = PLACES[k];
    const K = Forge.kit(B.sx, B.sy, B.sz, 0);
    K.grid.blocks.fill(0);                                 // (a station stands in the void: everything not built is air)
    const rng = Forge.rng(P, 'stn');
    // world-coordinate writers
    const S = (x, y, z, n, pr) => K.set(x - B.x0, y - B.y0, z - B.z0, n, pr);
    const G = (x, y, z) => K.get(x - B.x0, y - B.y0, z - B.z0);
    const box = (x0, y0, z0, x1, y1, z1, n, pr) => K.box(x0 - B.x0, y0 - B.y0, z0 - B.z0, x1 - B.x0, y1 - B.y0, z1 - B.z0, n, pr);
    const clear = (x0, y0, z0, x1, y1, z1) => K.box(x0 - B.x0, y0 - B.y0, z0 - B.z0, x1 - B.x0, y1 - B.y0, z1 - B.z0, 0);
    const model = (n, x, y, z, f) => K.model(n, x - B.x0, y - B.y0, z - B.z0, f || 0);
    const F0 = FY - 1;
    // a room: hull shell (floor, walls, ceiling) with its inside cleared
    const room = (x0, z0, x1, z1, h, floor, wall, ceil) => {
      box(x0 - 1, F0 - 1, z0 - 1, x1 + 1, FY + h, z1 + 1, wall || 'hull_plating');
      box(x0 - 1, F0 - 1, z0 - 1, x1 + 1, F0 - 1, z1 + 1, 'hull_plating_dark');
      box(x0, F0, z0, x1, F0, z1, floor || 'vx_floor_deck');
      box(x0 - 1, FY + h, z0 - 1, x1 + 1, FY + h, z1 + 1, ceil || 'hull_plating_gray');
      clear(x0, FY, z0, x1, FY + h - 1, z1);
    };
    const lights = (x0, z0, x1, z1, h, step) => { for (let x = x0 + 2; x <= x1 - 1; x += step) for (let z = z0 + 2; z <= z1 - 1; z += step) S(x, FY + h, z, 'light_panel', { facing: 5 }); };
    const door = (x, z, w, h) => { for (let i = 0; i < w; i++) clear(x + (w > 0 ? 0 : 0), FY, z + i, x, FY + h - 1, z + i); };   // an opening through a wall along z at x
    const doorX = (x, z, w, h) => { for (let i = 0; i < w; i++) clear(x + i, FY, z, x + i, FY + h - 1, z); };
    const deck = (x0, z0, x1, z1) => {
      box(x0, F0 - 3, z0, x1, F0 - 1, z1, 'hull_plating_dark');                  // the deck's slab
      box(x0, F0, z0, x1, F0, z1, 'vx_floor_hangar');
      for (let x = x0; x <= x1; x++) { S(x, F0, z0, 'hazard_stripes'); S(x, F0 - 1, z0, 'neon_amber'); }
      for (let z = z0; z <= z1; z++) { S(x0, F0, z, 'hazard_stripes'); S(x1, F0, z, 'hazard_stripes'); }
      for (let x = x0; x <= x1; x += 4) S(x, FY, z0, 'vx_hex_light_cyan', { head: 1 });
      for (let z = z0 + 4; z <= z1; z += 6) { S(x0, FY, z, 'vx_tech_railing'); S(x1, FY, z, 'vx_tech_railing'); }
      // ribs under the slab (the deck seen from below and from the window: a built thing, not a plate)
      for (let x = x0 + 3; x <= x1 - 3; x += 8) for (let z = z0; z <= z1; z++) S(x, F0 - 4, z, 'vx_tech_trim');
    };
    const berth = (cx, cz, r, glow) => {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        const edge = Math.abs(dx) === r || Math.abs(dz) === r;
        S(cx + dx, F0, cz + dz, edge ? 'vx_floor_hangar_line' : (Math.abs(dx) <= 2 && Math.abs(dz) <= 2 ? 'stn_gravplate' : 'vx_floor_pad'));
      }
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) S(cx + sx * (r + 1), FY, cz + sz * (r + 1), 'stn_clamp');
      if (glow) for (let d = r + 3; d <= r + 15; d += 3) S(cx, F0, cz - d, 'neon_cyan');   // the guide line in from the approach side
    };
    if (k === 0) {
      // ---------------------------------------------------------------- the deck (outside, −z) and its berths
      deck(-34, -60, 34, -8);
      berth(Math.floor(PL.berth[0]), Math.floor(PL.berth[2]), 9, true);
      berth(Math.floor(PL.pad[0]), Math.floor(PL.pad[2]), 9, true);
      berth(0, -52, 5, false);
      for (let x = -30; x <= 30; x += 12) S(x, FY, -10, 'vx_hex_light_cyan', { head: 1 });
      // ---------------------------------------------------------------- the Panoramahalle
      room(-20, -6, 20, 14, 9, 'vx_tech_hex_white', 'hull_plating', 'hull_plating_gray');
      // the window wall: glass from the floor to the ceiling, mullions every 6, a band at mid height
      for (let x = -20; x <= 20; x++) for (let y = FY; y <= FY + 8; y++) S(x, y, -7, (x + 20) % 6 === 0 ? 'hull_plating_dark' : y === FY + 4 ? 'hull_plating_dark' : 'glass');
      for (let x = -21; x <= 21; x++) { S(x, F0, -7, 'hull_plating_dark'); S(x, FY + 9, -7, 'hull_plating_dark'); }
      // the airlock to the deck at the east end of the window wall (an opening framed in hazard stripes)
      for (let x = 15; x <= 17; x++) for (let y = FY; y <= FY + 3; y++) S(x, y, -7, 0);
      for (let y = FY; y <= FY + 4; y++) { S(14, y, -7, 'hazard_stripes'); S(18, y, -7, 'hazard_stripes'); }
      for (let x = 14; x <= 18; x++) S(x, FY + 4, -7, 'hazard_stripes');
      // the floor: gravity plates in a cross through the middle, the holo table at its heart
      for (let x = -12; x <= 12; x++) S(x, F0, 4, 'stn_gravplate');
      for (let z = -2; z <= 10; z++) S(0, F0, z, 'stn_gravplate');
      model('vx_holo_table', 0, FY, 4, 0); S(0, FY + 6, 4, 'holo_projector');
      // benches facing the glass, planters between, palms in the corners
      for (const x of [-15, -9, 9, 15]) for (const z of [-3, 0]) { S(x, FY, z, 'vx_bench', { facing: 2 }); S(x + 1, FY, z, 'vx_bench', { facing: 2 }); }
      for (const x of [-18, -12, -5, 5, 12]) { S(x, FY, -5, 'vx_planter'); S(x, FY + 1, -5, 'vx_fern_lush'); }
      for (const [x, z] of [[-19, 13], [19, 13], [-19, 8], [19, 8]]) model(rng.chance(0.5) ? 'vm_plant_palm_concrete' : 'vm_plant_fig_concrete', x, FY, z, 0);
      for (const z of [6, 10]) { S(-8, FY, z, 'vx_sofa_blue', { facing: 0 }); S(-7, FY, z, 'vx_sofa_blue', { facing: 0 }); S(8, FY, z, 'vx_sofa_blue', { facing: 0 }); S(9, FY, z, 'vx_sofa_blue', { facing: 0 }); }
      lights(-20, -6, 20, 14, 8, 5);
      // ---------------------------------------------------------------- the Hydrogarten (behind the hall, a glass roof)
      room(-20, 16, 20, 28, 9, 'moss_block', 'hull_plating', 'vx_dome_glass');
      doorX(-2, 15, 5, 4);
      for (let x = -18; x <= 18; x += 6) for (let z = 18; z <= 26; z += 4) {
        for (let dx = 0; dx <= 3; dx++) for (let dz = 0; dz <= 1; dz++) { S(x + dx, FY - 1, z + dz, 'grass_block'); S(x + dx, FY, z + dz, rng.chance(0.5) ? 'vx_flowerbed' : 'vx_fern_lush'); }
        S(x + 1, FY + 7, z, 'grow_lamp'); S(x + 2, FY + 7, z, 'grow_lamp');
      }
      for (const [x, z] of [[-17, 23], [17, 23], [0, 27]]) { S(x, FY - 1, z, 'dirt'); K.tree(x - B.x0, FY - B.y0, z - B.z0, 'oak', rng, false); }
      for (let x = -19; x <= 19; x++) { S(x, F0, 28, 'water', { level: 0 }); }
      // the back wall: a blue band, holo screens with the station's views, planters under them, cyan accents
      for (let x = -20; x <= 20; x++) { S(x, FY + 6, 15, 'hull_stripe_blue', { axis: 1 }); if (x % 4 === 0) S(x, FY + 7, 15, 'neon_cyan'); }
      for (const x of [-16, -10, 10, 16]) for (let dx = 0; dx < 3; dx++) { S(x + dx, FY + 2, 14, dx === 1 ? 'vx_holo_screen_amber' : 'vx_holo_screen', { facing: 2 }); S(x + dx, FY + 3, 14, 'vx_holo_screen', { facing: 2 }); S(x + dx, FY, 13, 'vx_planter'); S(x + dx, FY + 1, 13, dx === 1 ? 'vx_fern_lush' : 'vx_flowerbed'); }
      for (const z of [-2, 4, 10]) for (const x of [-21, 21]) { S(x, FY + 2, z, 'vx_hex_light_cyan', { head: 0 }); S(x, FY + 3, z, 'vx_holo_screen', { facing: x < 0 ? 1 : 3 }); }
      // ---------------------------------------------------------------- the Stationsladen (east of the hall)
      room(22, -5, 34, 9, 6, 'vx_shop_floor', 'hull_plating', 'hull_plating_gray');
      door(21, 2, 2, 3);
      for (let x = 23; x <= 33; x += 2) { S(x, FY, -5, 'vx_shop_shelf_tech', { facing: 2 }); S(x, FY + 1, -5, 'vx_shop_shelf_toys', { facing: 2 }); S(x + 1, FY, -5, 'vx_shop_fridge_drinks', { facing: 2 }); }
      for (let z = -3; z <= 3; z += 2) { S(34, FY, z, 'vx_shop_shelf_drinks', { facing: 3 }); }
      for (let x = 24; x <= 31; x += 2) S(x, FY, 0, 'vx_shop_shelf_snacks', { facing: 2 });
      S(PL.counter[0], FY, PL.counter[2], 'vx_shop_checkout', { facing: 3 }); S(PL.counter[0], FY, PL.counter[2] + 1, 'vx_shop_checkout', { facing: 3 });
      for (let x = 24; x <= 32; x += 4) S(x, FY + 6, 3, 'vx_shop_light');
      // the job board by the counter (a holo screen: [V] there shows the station's jobs)
      S(PL.board[0], FY + 1, PL.board[2] + 1, 'vx_holo_screen_amber', { facing: 0 });
      // ---------------------------------------------------------------- the Leitstand
      room(22, 11, 34, 26, 6, 'vx_floor_hangar', 'hull_plating_dark', 'hull_plating_gray');
      door(21, 11, 2, 3);
      for (let x = 24; x <= 32; x += 2) { S(x, FY, 26, 'vx_console', { facing: 0 }); S(x, FY + 2, 27, 'vx_holo_screen', { facing: 0 }); S(x, FY + 3, 27, 'vx_holo_screen', { facing: 0 }); }
      for (let z = 13; z <= 24; z += 3) { S(34, FY, z, 'vx_console', { facing: 3 }); S(35, FY + 2, z, 'vx_holo_screen', { facing: 3 }); }
      S(28, FY, 18, 'holo_projector'); S(28, FY + 5, 18, 'light_panel', { facing: 5 });
      for (let x = 22; x <= 34; x++) S(x, FY + 5, 11, 'neon_cyan');
      lights(22, 11, 34, 26, 6, 4);
      // ---------------------------------------------------------------- the Quartiere (west of the hall)
      room(-34, -5, -22, 24, 5, 'vx_floor_deck', 'hull_plating', 'hull_plating_gray');
      door(-21, 2, 2, 3);
      // two rows of cabins off a corridor x −29 … −27
      for (const cb of PL.cabins) {
        const side = cb.side, z0 = cb.z0, z1 = z0 + 5, xw = side < 0 ? -30 : -26, x0 = side < 0 ? -34 : -26, x1 = side < 0 ? -30 : -22;
        for (let z = z0; z <= z1 + 1; z++) for (let y = FY; y <= FY + 4; y++) S(xw, y, z, 'vx_tech_white');
        for (let x = x0; x <= x1; x++) for (let y = FY; y <= FY + 4; y++) S(x, y, z1 + 1, 'vx_tech_white');
        const dz = z0 + 2, fac = side < 0 ? 3 : 1;
        S(xw, FY, dz, 'door_glass_white', { facing: fac, half: 0 }); S(xw, FY + 1, dz, 'door_glass_white', { facing: fac, half: 1 });
        const bx = side < 0 ? -33 : -23, bz = z0 + 1;
        S(bx, FY, bz, 'light_blue_bed', { facing: 0, part: 1 }); S(bx, FY, bz + 1, 'light_blue_bed', { facing: 0, part: 0 });
        S(side < 0 ? -31 : -25, FY, z1, 'vx_locker', { facing: side < 0 ? 1 : 3 });
        S(side < 0 ? -32 : -24, FY + 4, z0 + 2, 'light_panel', { facing: 5 });
        if (side < 0) { S(-35, FY + 1, z0 + 2, 'viewport'); S(-35, FY + 2, z0 + 2, 'viewport'); }
      }
      for (let z = -4; z <= 23; z += 4) S(-28, FY + 5, z, 'light_panel', { facing: 5 });
      // ---------------------------------------------------------------- the ring corridor, curving up at both ends
      for (const sg of [-1, 1]) {
        const xs = sg < 0 ? -35 : 35;
        for (let z = 1; z <= 5; z++) for (let y = FY; y <= FY + 3; y++) S(xs, y, z, 0);   // the opening into it
        let prevF = F0;
        for (let dx = 0; dx <= 61; dx++) {
          const x = xs + sg * dx, rise = RING_R - Math.sqrt(RING_R * RING_R - dx * dx), fy = F0 + Math.round(rise);
          const lo = Math.min(prevF, fy), hi = Math.max(prevF, fy); prevF = fy;
          for (let z = 0; z <= 6; z++) {
            box(x, lo - 1, z, x, hi, z, z === 0 || z === 6 ? 'hull_plating' : 'vx_floor_deck');
            box(x, lo + 6, z, x, hi + 7, z, 'hull_plating_gray');
            if (z === 0 || z === 6) box(x, lo, z, x, hi + 6, z, (dx % 5 === 2 && z === 0) ? 'viewport' : 'hull_plating');
          }
          clear(x, fy + 1, 1, x, fy + 5, 5);
          if (dx % 4 === 0) { S(x, fy + 6, 3, 'light_panel', { facing: 5 }); S(x, fy + 1, 1, 'neon_cyan'); S(x, fy + 1, 5, 'neon_cyan'); }
          if (dx === 8) for (let z = 1; z <= 5; z++) for (let y = fy + 1; y <= fy + 5; y++) S(x, y, z, 'hardened_glass');   // the bulkhead: the rest of the ring beyond the glass
        }
      }
    } else {
      // ---------------------------------------------------------------- the outpost
      deck(-24, -44, 24, -8);
      berth(Math.floor(PL.berth[0]), Math.floor(PL.berth[2]), 8, true);
      berth(Math.floor(PL.pad[0]), Math.floor(PL.pad[2]), 8, true);
      room(-10, -6, 10, 8, 7, 'vx_tech_hex_white', 'vx_tech_white', 'hull_plating_gray');
      for (let x = -10; x <= 10; x++) for (let y = FY; y <= FY + 6; y++) S(x, y, -7, (x + 10) % 5 === 0 ? 'hull_plating_dark' : 'glass');
      for (let x = 7; x <= 8; x++) for (let y = FY; y <= FY + 2; y++) S(x, y, -7, 0);
      S(PL.counter[0], FY, PL.counter[2], 'vx_shop_checkout', { facing: 3 });
      S(PL.board[0], FY + 1, PL.board[2] + 1, 'vx_holo_screen_amber', { facing: 0 });
      for (let x = -8; x <= -4; x += 2) S(x, FY, 8, 'vx_console', { facing: 0 });
      S(-6, FY, 4, 'holo_projector');
      for (const cb of PL.cabins) { const [x, , z] = cb.bed; S(x, FY, z, 'light_blue_bed', { facing: 0, part: 1 }); S(x, FY, z + 1, 'light_blue_bed', { facing: 0, part: 0 }); }
      for (const x of [-6, 0, 6]) { S(x, FY, -5, 'vx_planter'); S(x, FY + 1, -5, 'vx_fern_lush'); }
      lights(-10, -6, 10, 8, 7, 5);
    }
    void G;
    return Object.assign(K.grid, { meta: { front: 0, doors: [], floors: [FY], station: k } });
  });
  // ---------------------------------------------------------------- u-stations2: the dressed hall (sgen 2)
  // A save's station generator version (meta.universe.sgen, src/main/stations.js STN.stampS): sgen 1 is the hall as
  // v0.54 built it (byte-identical: saved chunks of a station a save stood in stay the same); sgen 2 dresses the
  // Ringstation's hall: an oak floor with sand rugs instead of the white hex tiles (the gravity plates' cross stays), a
  // café in the west back corner (a counter with the drinks behind it, two tables with stools), warm floor lamps by the
  // sofas, tall plants along the side walls, crates on the deck by the airlock. The places the deck life uses
  // (STN.deckLife) stand on this. The outposts are not dressed.
  STA.CAFE = { counter: { x0: -18, x1: -15, z: 11 }, tables: [[-16, 8], [-12, 8]], crates: [[-3, -13], [-2, -13], [-3, -12], [-1, -13], [-2, -12]] };
  STA.dress = function (gr, k) {
    if (k) return gr;
    const B = BOX[0], R = VR.R, F0 = FY - 1;
    const sid = (n, pr) => { const t = R && R.byName[n]; return t ? (pr ? t.state(pr) : t.defaultState) : 0; };
    const idx = (x, y, z) => { const gx = x - B.x0, gy = y - B.y0, gz = z - B.z0; return gx < 0 || gy < 0 || gz < 0 || gx >= gr.sx || gy >= gr.sy || gz >= gr.sz ? -1 : (gy * gr.sz + gz) * gr.sx + gx; };
    const get = (x, y, z) => { const i = idx(x, y, z); return i < 0 ? 0 : gr.blocks[i]; };
    const S = (x, y, z, s) => { const i = idx(x, y, z); if (i >= 0 && s) gr.blocks[i] = s; };
    const nameOf = (s) => (s && R ? R.types[R.T.type[s]].name : '');
    const HEX = sid('vx_tech_hex_white'), OAK = sid('vx_floor_oak'), RUG = sid('vx_rug_sand');
    // the floor: oak where the white tiles were
    for (let x = -20; x <= 20; x++) for (let z = -6; z <= 14; z++) if (get(x, F0, z) === HEX) S(x, F0, z, OAK);
    const rug = (x0, z0, x1, z1) => { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) if (!get(x, FY, z) && get(x, F0, z) === OAK) S(x, FY, z, RUG); };
    rug(-11, 5, -5, 11); rug(5, 5, 11, 11); rug(-18, 6, -10, 10);
    // the café: the counter, the drinks behind it, the tables and their stools
    const C = STA.CAFE, CNT = sid('vx_counter'), POT = sid('vx_potplant'), TB = sid('vx_table'), ST = sid('vx_stool'), STO = sid('vx_stool_orange'), FR = sid('vx_shop_fridge_drinks', { facing: 2 });
    for (let x = C.counter.x0; x <= C.counter.x1; x++) S(x, FY, C.counter.z, CNT);
    S(C.counter.x0, FY + 1, C.counter.z, POT);
    for (const x of [-18, -17, -16]) S(x, FY, 14, FR);
    C.tables.forEach(([x, z], i) => { S(x, FY, z, TB); S(x - 1, FY, z, i ? STO : ST); S(x + 1, FY, z, i ? STO : ST); });
    S(-12, FY + 1, 8, POT);
    // warm floor lamps by the sofas and the café, tall plants along the side walls
    const LMP = sid('vx_floorlamp'), TP = sid('vx_tall_plant');
    for (const [x, z] of [[-10, 6], [-10, 10], [11, 6], [11, 10], [-19, 11]]) S(x, FY, z, LMP);
    for (const [x, z] of [[-20, -4], [-20, -1], [-20, 5], [20, -4], [20, -1], [20, 5], [20, 7], [20, 11]]) if (!get(x, FY, z)) S(x, FY, z, TP);
    // crates on the deck by the airlock (the dock worker's)
    const CR = sid('vx_crate');
    for (const [x, z] of C.crates) S(x, FY, z, CR);
    S(-3, FY + 1, -13, CR);
    void nameOf;
    return gr;
  };
  // the station's grid as a save of version v builds it (cached per thread)
  const GRIDS = {};
  STA.grid = function (k, v) {
    const key = (k ? 1 : 0) + ':' + (v >= 2 && !k ? 2 : 1);
    if (GRIDS[key]) return GRIDS[key];
    const gr = Forge.build(STA.dna(k));
    return (GRIDS[key] = v >= 2 && !k ? STA.dress(gr, k ? 1 : 0) : gr);
  };
  // (a kind the stations' generator builds, not one for the Forge's catalogue: off the list the Studio and the text parser
  // walk, in TYPES and gens for Forge.build)
  { const i = Forge.types.indexOf(Forge.TYPES.station); if (i >= 0) Forge.types.splice(i, 1); Forge.TYPES.station.hidden = true; }
})(VR);
