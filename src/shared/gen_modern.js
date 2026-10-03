// ============================================================================
// Modern towns — "rich town" settlement style built from the user's reference
// photos: (A) a single-storey mono-pitch house with stacked-stone piers,
// clerestory glazing, a glass-strip garage and a lawn; (B) a two-storey villa
// with balconies, black railings, a columned porch, wood-slat loggia and a
// driveway; (C) a neoclassical mansion (the town hall) with a columned portico,
// pilasters, a balustraded roof and a fountain plaza. Plus the civic life of a
// real town: a school with classrooms, a factory floor, an office block, a
// café with a terrace, a park with a fountain, and the supermarket. Every
// building is fully furnished from the Voxel Home kit. Lot-local frame: u
// across the front, v from the street (v = 0) into the lot, facing 0 = street.
// ============================================================================
(function (VR) {
  'use strict';
  const VG = VR.VillageGen;
  if (!VG) return;
  const MOD = VG.modern = {};
  const CARS = ['vx_car_black', 'vx_car_white', 'vx_car_red', 'vx_car_blue', 'vx_car_silver'];

  // ---------------------------------------------------------------- lot kit
  function kit(L, lot, o) {
    const P = L.P, w = lot.w, d = lot.d, F = lot.F, rng = o.rng;
    const K = {
      P, w, d, F, rng,
      box: (u0, v0, y0, u1, v1, y1, m, pr) => { for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) for (let y = y0; y <= y1; y++) P(u, y, v, m, pr); },
      clear: (u0, v0, y0, u1, v1, y1) => { for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) for (let y = y0; y <= y1; y++) P(u, y, v, null); },
      // perimeter walls of a rectangle between two heights (inclusive)
      shell: (u0, v0, u1, v1, y0, y1, m) => { for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) { if (u !== u0 && u !== u1 && v !== v0 && v !== v1) continue; for (let y = y0; y <= y1; y++) P(u, y, v, m); } },
      // ground fill up to the floor and the floor itself
      base: (u0, v0, u1, v1, floorMat, level) => { const fy = level === undefined ? F : level; for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) { const gy = o.ground(u, v); for (let y = Math.min(gy, fy) - 2; y < fy; y++) P(u, y, v, 'concrete_smooth'); P(u, fy, v, floorMat); } },
      floor: (u0, v0, u1, v1, m, y) => { for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) P(u, y === undefined ? F : y, v, m); },
      win: (u, v, y0, y1, m) => { for (let y = y0; y <= y1; y++) P(u, y, v, m || 'window_black'); },
      // a yard cell (margin) at the yard level: planted or paved
      yard: (u, v, m, pr) => P(u, F - 1, v, m, pr),
      // a parked car: 2 wide × 4 long × 2 tall; (u, v) is the front-left corner, along v when facing 0/2
      car: (u, v, y, facing, name) => {
        if (VG.plan2 && VG.plan2.NO_CARS) return;
        const along = (facing & 1) === 0;
        for (let p = 0; p < 16; p++) {
          const px = p & 1, py = (p >> 1) & 1, pz = p >> 2;
          // the model runs along its local -z (front) … +z (back); facing 0 puts the nose toward the street
          const du = along ? px : pz, dv = along ? pz : px;
          const uu = facing === 2 ? u + 1 - du : facing === 3 ? u + 3 - du : u + du;
          const vv = facing === 0 ? v + 3 - dv : facing === 1 ? v + 1 - dv : v + dv;
          P(uu, y + py, vv, name || 'vx_car_black', { facing, part: 'p' + p });
        }
      },
      tree: (u, v, y, big) => { const f = rng.pick(['apple', 'cherry', 'plum', 'orange']); for (let k = 0; k < (big ? 3 : 2); k++) P(u, y + k, v, 'vx_fruit_trunk'); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { P(u + a, y + (big ? 3 : 2), v + b, 'vx_fruit_crown_' + f); if (Math.abs(a) + Math.abs(b) <= 1) P(u + a, y + (big ? 4 : 3), v + b, 'vx_fruit_crown_' + f); } },
      hedgeRow: (u0, v0, u1, v1, light) => { for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) P(u, F, v, light ? 'vx_hedge_light' : 'vx_hedge'); },
      spot: (u, v, y) => P(u, y, v, 'vx_spot'),
      info: () => ({ beds: [], seats: [], work: [], door: null, outside: null, inside: null, chimney: null, table: null, lights: [], roofTop: F + 5, desks: [], cars: [] }),
    };
    return K;
  }
  MOD.kit = kit;
  const bed = (K, info, u, v, facing, col) => {
    // foot at (u, v), head one step along the facing direction
    const dv = facing === 2 ? 1 : facing === 0 ? -1 : 0, du = facing === 1 ? 1 : facing === 3 ? -1 : 0;
    K.P(u, K.F + 1, v, col, { facing, part: 0 }); K.P(u + du, K.F + 1, v + dv, col, { facing, part: 1 });
    info.beds.push([u, K.F + 1, v, facing]);
  };
  const chair = (K, info, u, v, facing, name) => { K.P(u, K.F + 1, v, name || 'vx_dining_chair', { facing }); info.seats.push([u, K.F + 1, v, facing]); };
  const BEDS = ['vx_bed_white', 'vx_bed_teal', 'vx_bed_blue', 'vx_bed_green', 'vx_bed_purple'];

  // ================================================================ A · mono-pitch modern house (18 × 14)
  MOD.houseA = function (L, lot, o) {
    const K = kit(L, lot, o), { P, F, rng } = K, info = K.info();
    const wall = 'stucco_white', stone = 'stacked_stone', roof = 'roof_charcoal', glass = 'window_black';
    // ---- floors & foundation
    K.base(0, 0, 6, 6, 'concrete_smooth');                    // garage
    K.base(0, 7, 6, 13, 'carpet_cream');                       // bedroom 1
    K.base(7, 2, 17, 8, 'oak_herringbone');                    // great room
    K.base(11, 0, 17, 1, 'oak_herringbone');                   // front-right dining bay
    K.base(7, 0, 10, 1, 'travertine');                         // porch
    K.base(7, 9, 9, 13, 'oak_herringbone');                    // hallway
    K.base(10, 9, 13, 13, 'dark_tile');                        // bath
    K.base(14, 9, 17, 13, 'carpet_cream');                     // master
    K.clear(-1, -1, F + 1, 18, 14, F + 8);
    // ---- walls (ground storey)
    K.shell(0, 0, 6, 6, F + 1, F + 3, wall);                   // garage
    K.shell(0, 7, 6, 13, F + 1, F + 3, wall);                  // bedroom 1
    K.shell(6, 2, 17, 13, F + 1, F + 3, wall);                 // main block (shares the garage / bedroom wall at u = 6)
    K.clear(11, 2, F + 1, 16, 2, F + 3);                       // dining bay opens into the great room
    K.box(11, 0, F + 1, 17, 0, F + 3, wall); K.box(11, 1, F + 1, 11, 1, F + 3, wall); K.box(17, 1, F + 1, 17, 1, F + 3, wall);
    K.box(11, 0, F + 1, 11, 0, F + 3, 'wood_slat', { axis: 1 }); K.box(17, 0, F + 1, 17, 0, F + 3, 'wood_slat', { axis: 1 });
    K.box(10, 0, F + 1, 10, 1, F + 5, stone); K.box(7, 0, F + 1, 7, 1, F + 5, stone);          // porch piers
    K.box(0, 0, F + 1, 0, 1, F + 3, stone); K.box(6, 0, F + 1, 6, 0, F + 3, stone);            // stone at the garage corners
    // interior partitions with door openings
    K.box(10, 9, F + 1, 17, 9, F + 3, wall); K.clear(11, 9, F + 1, 11, 9, F + 2); K.clear(15, 9, F + 1, 15, 9, F + 2);
    K.box(10, 10, F + 1, 10, 13, F + 3, wall); K.box(13, 10, F + 1, 13, 13, F + 3, 'subway_tile');
    K.clear(6, 10, F + 1, 6, 10, F + 2); K.clear(6, 4, F + 1, 6, 4, F + 2);
    P(6, F + 1, 4, 'birch_door', { facing: 1, half: 0, hinge: 0, open: 0 }); P(6, F + 2, 4, 'birch_door', { facing: 1, half: 1, hinge: 0, open: 0 });
    P(6, F + 1, 10, 'birch_door', { facing: 1, half: 0, hinge: 0, open: 0 }); P(6, F + 2, 10, 'birch_door', { facing: 1, half: 1, hinge: 0, open: 0 });
    // ---- glazing: garage door, glass entrance, shuttered bay window, side & back windows
    for (let u = 1; u <= 5; u++) K.win(u, 0, F + 1, F + 3, 'garage_door');
    for (const u of [8, 9]) for (const y of [F + 1, F + 2]) P(u, y, 2, 'vx_glass_door_black', { facing: 0, open: 0 });
    K.win(7, 2, F + 1, F + 3); K.win(10, 2, F + 1, F + 3); P(8, F + 3, 2, glass); P(9, F + 3, 2, glass);
    for (let u = 12; u <= 16; u++) { K.win(u, 0, F + 1, F + 2); P(u, F + 3, 0, 'wood_slat', { axis: 1 }); }
    for (const v of [4, 6, 11, 12]) K.win(17, v, F + 1, F + 2);
    for (const u of [2, 4, 15]) K.win(u, 13, F + 1, F + 2); K.win(11, 13, F + 2, F + 2, 'frosted_glass');
    for (const v of [9, 12]) K.win(0, v, F + 1, F + 2); for (const v of [2, 4]) K.win(0, v, F + 2, F + 2, 'frosted_glass');
    // ---- roofs: flat charcoal over the garage, bedroom and back rooms; a stepped mono-pitch over the great room
    K.floor(-1, -1, 6, 7, roof, F + 4); K.floor(-1, 7, 6, 14, roof, F + 4); K.floor(7, 9, 18, 14, roof, F + 4);
    const RY = (v) => v <= 3 ? F + 6 : v <= 6 ? F + 5 : F + 4;
    for (let v = -1; v <= 8; v++) for (let u = 6; u <= 18; u++) P(u, RY(v), v, roof);
    for (let v = 0; v <= 8; v++) for (let y = F + 4; y < RY(v); y++) { P(6, y, v, wall); P(17, y, v, wall); }   // side walls up to the roof line
    for (let y = F + 4; y <= F + 5; y++) { P(7, y, 2, wall); P(10, y, 2, wall); P(11, y, 0, wall); P(17, y, 0, wall); P(11, y, 1, wall); P(17, y, 1, wall); P(11, y, 2, wall); }
    for (let u = 8; u <= 9; u++) for (let y = F + 4; y <= F + 5; y++) P(u, y, 2, glass);                 // clerestory over the entrance
    for (let u = 12; u <= 16; u++) for (let y = F + 4; y <= F + 5; y++) P(u, y, 0, glass);                // clerestory over the bay
    K.clear(7, 0, F + 1, 10, 1, F + 5); K.box(10, 0, F + 1, 10, 1, F + 5, stone); K.box(7, 0, F + 1, 7, 1, F + 5, stone);   // the porch stays open
    info.roofTop = F + 7;
    // ---- interior · living
    for (let v = 4; v <= 6; v++) P(7, F + 1, v, 'vx_tv_wall', { facing: 1 });
    for (let v = 4; v <= 6; v++) { P(10, F + 1, v, 'vx_sofa_charcoal', { facing: 3 }); info.seats.push([10, F + 1, v, 3]); }
    P(9, F + 1, 5, 'vx_coffee_table', { facing: 1 }); for (let v = 4; v <= 6; v++) P(8, F + 1, v, 'vx_rug_sand');
    P(7, F + 1, 8, 'vx_tall_plant'); P(7, F + 1, 3, 'vx_tall_plant_black'); P(9, F + 2, 8, 'vx_art_warm', { facing: 0 });
    P(9, F + 4, 5, 'vx_pendant'); K.spot(8, 3, F + 5); K.spot(8, 7, F + 3); P(7, F + 2, 7, 'vx_sconce', { facing: 1 });
    // ---- interior · kitchen along the back wall, island with stools, dining in the bay
    for (let u = 11; u <= 15; u++) { P(u, F + 1, 8, u === 12 ? 'vx_kitchen_sink' : u === 14 ? 'vx_kitchen_hob' : 'vx_kitchen_island', { facing: 0 }); P(u, F + 3, 8, 'vx_upper_cabinet', { facing: 0 }); }
    P(16, F + 1, 8, 'vx_fridge', { facing: 0, part: 0 }); P(16, F + 2, 8, 'vx_fridge', { facing: 0, part: 1 });
    for (let u = 12; u <= 14; u++) { P(u, F + 1, 6, 'vx_kitchen_island_dark', { facing: 0 }); P(u, F + 1, 5, 'vx_stool'); info.seats.push([u, F + 1, 5, 2]); }
    P(12, F + 4, 6, 'vx_pendant_brass'); P(14, F + 4, 6, 'vx_pendant_brass');
    info.work.push(['stove', 14, F + 1, 7]);
    for (let u = 13; u <= 15; u++) P(u, F + 1, 2, 'vx_dining_table', { facing: 0 }); info.table = [14, F + 1, 2];
    for (let u = 13; u <= 15; u++) { chair(K, info, u, 1, 2); chair(K, info, u, 3, 0); }
    P(14, F + 5, 2, 'vx_chandelier'); P(16, F + 1, 1, 'vx_tall_plant'); P(12, F + 1, 1, 'vx_bookshelf', { facing: 1 }); P(12, F + 2, 1, 'vx_bookshelf', { facing: 1 });
    K.spot(16, 5, F + 4); K.spot(12, 4, F + 4);
    // ---- interior · hallway, bath, master, bedroom 1
    P(8, F + 2, 12, 'vx_art_cool', { facing: 0 }); K.spot(8, 11, F + 3); P(9, F + 1, 12, 'vx_tall_plant_black');
    P(11, F + 1, 10, 'vx_vanity', { facing: 2 }); P(11, F + 2, 10, 'vx_mirror', { facing: 2 }); P(12, F + 1, 12, 'vx_toilet', { facing: 0 });
    P(11, F + 1, 12, 'vx_shower', { facing: 0, part: 0 }); P(11, F + 2, 12, 'vx_shower', { facing: 0, part: 1 }); K.spot(12, 11, F + 3);
    bed(K, info, 15, 11, 2, rng.pick(BEDS)); P(14, F + 1, 12, 'vx_nightstand', { facing: 0 }); P(16, F + 1, 12, 'vx_nightstand', { facing: 0 });
    P(14, F + 1, 10, 'vx_wardrobe', { facing: 1, part: 0 }); P(14, F + 2, 10, 'vx_wardrobe', { facing: 1, part: 1 }); P(16, F + 2, 10, 'vx_art_gold', { facing: 3 }); K.spot(15, 11, F + 3); P(16, F + 1, 10, 'vx_rug_blue');
    bed(K, info, 2, 11, 2, rng.pick(BEDS)); if (o.beds > 3) bed(K, info, 4, 11, 2, rng.pick(BEDS)); else { P(4, F + 1, 12, 'vx_tech_desk', { facing: 2 }); chair(K, info, 4, 11, 2); }
    P(3, F + 1, 12, 'vx_nightstand', { facing: 0 }); P(1, F + 1, 9, 'vx_wardrobe', { facing: 1, part: 0 }); P(1, F + 2, 9, 'vx_wardrobe', { facing: 1, part: 1 }); P(3, F + 2, 8, 'vx_art_warm', { facing: 2 }); K.spot(3, 10, F + 3);
    // ---- garage: a car, crates and a locker
    K.car(2, 1, F + 1, 0, rng.pick(CARS)); P(5, F + 1, 5, 'vx_locker', { facing: 0 }); P(1, F + 1, 5, 'vx_crate'); P(1, F + 2, 5, 'vx_crate'); P(3, F + 3, 3, 'vx_spot'); P(5, F + 1, 1, 'vx_wheelbarrow', { facing: 2 });
    // ---- outside: driveway, path, lawn, beds, hedges, sconces, mailbox, a second car
    for (let v = -3; v <= -1; v++) for (let u = 0; u <= 6; u++) K.yard(u, v, 'concrete_smooth');
    for (let v = -3; v <= -1; v++) for (let u = 8; u <= 9; u++) K.yard(u, v, 'paver_grey');
    P(8, F, -1, 'travertine_slab'); P(9, F, -1, 'travertine_slab');
    for (let u = 11; u <= 16; u++) P(u, F, -1, rng.chance(0.5) ? 'vx_flowerbed_roses' : 'vx_flowerbed_tulips'); P(17, F, -1, 'vx_bush'); P(10, F, -1, 'vx_bush_light');
    K.hedgeRow(-2, -1, -2, 13, true); K.hedgeRow(19, -1, 19, 13, true);
    P(7, F + 2, -1, 'vx_sconce', { facing: 0 }); P(10, F + 2, -1, 'vx_sconce', { facing: 0 }); P(0, F + 2, -1, 'vx_sconce', { facing: 0 }); P(6, F + 2, -1, 'vx_sconce', { facing: 0 });
    P(11, F, -3, 'vx_mailbox', { facing: 0 }); P(7, F, -3, 'vx_bollard');
    if (rng.chance(0.5)) K.car(2, -3, F, 0, rng.pick(CARS));
    K.tree(-1, 12, F, true); if (rng.chance(0.6)) K.tree(18, 12, F, false);
    info.door = [8, F + 1, 2]; info.outside = [8, F, -2]; info.inside = [9, F + 1, 4];
    info.lights.push([9, F + 4, 5]);
    return info;
  };

  // ================================================================ B · two-storey villa (15 × 13)
  MOD.villa = function (L, lot, o) {
    const K = kit(L, lot, o), { P, F, rng } = K, info = K.info();
    const wall = 'stucco_cream', trim = 'white_trim', dark = 'charcoal_panel', glass = 'window_black', roof = 'roof_charcoal';
    const G2 = F + 4;   // upper floor slab
    // ---- ground floor
    K.base(0, 0, 14, 12, 'oak_herringbone'); K.base(0, 7, 6, 12, 'marble_white'); K.base(9, 0, 13, 1, 'travertine');
    K.clear(0, 0, F + 1, 14, 12, F + 12);
    K.shell(0, 0, 14, 12, F + 1, F + 3, wall);
    K.clear(10, 0, F + 1, 13, 1, F + 3); K.box(9, 0, F + 1, 9, 1, F + 3, wall); K.box(14, 0, F + 1, 14, 1, F + 3, wall);   // porch recess
    K.box(10, 2, F + 1, 13, 2, F + 3, wall);                  // wall behind the porch
    P(11, F + 1, 2, 'vx_glass_door_black', { facing: 0, open: 0 }); P(12, F + 1, 2, 'vx_glass_door_black', { facing: 0, open: 0 }); P(11, F + 2, 2, 'vx_glass_door_black', { facing: 0, open: 0 }); P(12, F + 2, 2, 'vx_glass_door_black', { facing: 0, open: 0 });
    K.win(10, 2, F + 1, F + 3); K.win(13, 2, F + 1, F + 3); P(11, F + 3, 2, glass); P(12, F + 3, 2, glass);
    for (let u = 1; u <= 8; u++) K.win(u, 0, F + 1, F + 3);                    // living room glass front
    for (const v of [2, 3, 5, 6, 9, 10]) K.win(0, v, F + 1, F + 2); for (const v of [4, 5, 8, 9]) K.win(14, v, F + 1, F + 2);
    for (const u of [2, 3, 6, 7, 10, 11]) K.win(u, 12, F + 1, F + 2);
    // porch columns and slab, upper slab
    for (const u of [10, 13]) for (let y = F + 1; y <= F + 3; y++) P(u, y, 0, 'vx_pillar_white');
    K.floor(-1, -1, 15, 13, trim, G2); K.floor(0, 0, 14, 12, 'oak_herringbone', G2); K.floor(9, 0, 13, 1, 'travertine', G2);
    K.box(10, 0, G2 - 1, 13, 1, G2 - 1, null); for (let u = 10; u <= 13; u++) P(u, G2 - 1, 0, 'vx_led_cove', { facing: 0 });
    // interior partitions: kitchen/dining at the back-left, stairs in the middle, living at the front
    K.box(7, 7, F + 1, 7, 12, F + 3, wall); K.clear(7, 9, F + 1, 7, 10, F + 2);
    K.box(1, 6, F + 1, 6, 6, F + 3, wall); K.clear(2, 6, F + 1, 3, 6, F + 2);
    // stairs: marble treads up the east side of the hall (u 8, v 8 → 11)
    for (let k = 0; k < 4; k++) { P(8, F + 1 + k, 8 + k, 'marble_white_stairs', { facing: 2, half: 0 }); for (let y = F + 1; y < F + 1 + k; y++) P(8, y, 8 + k, 'marble_white'); }
    K.clear(8, 8, G2, 8, 11, G2); K.clear(8, 11, G2, 8, 12, G2); P(8, G2, 12, 'oak_herringbone');
    for (let v = 7; v <= 11; v++) P(9, G2 + 1, v, 'vx_railing_black');
    // living room
    for (let u = 2; u <= 5; u++) { P(u, F + 1, 4, 'vx_sofa_cream', { facing: 0 }); info.seats.push([u, F + 1, 4, 0]); }
    P(3, F + 1, 2, 'vx_coffee_table_marble', { facing: 0 }); P(4, F + 1, 2, 'vx_coffee_table_marble', { facing: 0 }); for (let u = 2; u <= 5; u++) for (const v of [2, 3]) if (u < 3 || u > 4) P(u, F + 1, v, 'vx_rug_blue');
    for (let v = 2; v <= 4; v++) P(7, F + 1, v, 'vx_tv_wall', { facing: 3 });   // TV on the hall wall
    K.box(7, 1, F + 1, 7, 5, F + 3, wall); K.clear(7, 1, F + 1, 7, 1, F + 3); K.clear(7, 5, F + 1, 7, 5, F + 3);
    P(1, F + 1, 5, 'vx_tall_plant'); P(6, F + 1, 1, 'vx_tall_plant_black'); P(4, F + 2, 5, 'vx_art_warm', { facing: 0 }); P(3, F + 3, 3, 'vx_pendant'); K.spot(1, 2, F + 3); K.spot(6, 4, F + 3);
    for (let u = 1; u <= 6; u++) P(u, F + 1, 0, 'vx_led_strip', { facing: 2 });
    // kitchen & dining
    for (let u = 1; u <= 5; u++) { P(u, F + 1, 11, u === 2 ? 'vx_kitchen_sink' : u === 4 ? 'vx_kitchen_hob' : 'vx_kitchen_island', { facing: 0 }); P(u, F + 3, 11, 'vx_upper_cabinet', { facing: 0 }); }
    P(6, F + 1, 11, 'vx_fridge', { facing: 0, part: 0 }); P(6, F + 2, 11, 'vx_fridge', { facing: 0, part: 1 }); info.work.push(['stove', 4, F + 1, 10]);
    for (let u = 2; u <= 4; u++) { P(u, F + 1, 8, 'vx_dining_table_white', { facing: 0 }); chair(K, info, u, 7, 2); chair(K, info, u, 9, 0); } info.table = [3, F + 1, 8];
    P(3, F + 3, 8, 'vx_pendant_brass'); K.spot(5, 10, F + 3); P(1, F + 2, 7, 'vx_art_cool', { facing: 1 });
    // hall
    P(12, F + 1, 4, 'vx_tall_plant'); P(9, F + 2, 5, 'vx_art_gold', { facing: 0 }); K.spot(11, 4, F + 3); P(13, F + 1, 8, 'vx_bookshelf', { facing: 3 }); P(13, F + 2, 8, 'vx_bookshelf', { facing: 3 });
    P(10, F + 1, 11, 'vx_toilet', { facing: 0 }); P(12, F + 1, 11, 'vx_vanity', { facing: 0 }); P(12, F + 2, 11, 'vx_mirror', { facing: 0 }); K.box(9, 9, F + 1, 13, 9, F + 3, wall); K.clear(11, 9, F + 1, 11, 9, F + 2); K.box(9, 9, F + 1, 9, 12, F + 3, wall);
    // ---- upper floor: three bedrooms, a bathroom, a landing; balcony along the front and the east side
    const U = G2 + 1;
    K.shell(0, 2, 14, 12, U, U + 2, wall); K.box(0, 2, U, 14, 2, U + 2, wall);
    K.clear(1, 0, U, 13, 1, U + 2); K.clear(0, 0, U, 14, 1, U + 2);                       // balcony strip in front
    for (let u = 0; u <= 14; u++) P(u, U, 0, 'vx_railing_black'); for (const v of [1]) { P(0, U, v, 'vx_railing_black'); P(14, U, v, 'vx_railing_black'); }
    K.box(1, 0, G2, 4, 1, G2, 'deck_wood'); K.box(1, 0, U + 2, 4, 1, U + 2, null);          // loggia floor (wood)
    for (let u = 1; u <= 4; u++) { P(u, U, 2, 'wood_slat', { axis: 1 }); P(u, U + 1, 2, 'wood_slat', { axis: 1 }); P(u, U + 2, 2, 'wood_slat', { axis: 1 }); } K.clear(2, 2, U, 3, 2, U + 1); P(2, U, 2, 'vx_glass_door_black', { facing: 0, open: 0 }); P(3, U, 2, 'vx_glass_door_black', { facing: 0, open: 0 }); P(2, U + 1, 2, 'vx_glass_door_black', { facing: 0, open: 0 }); P(3, U + 1, 2, 'vx_glass_door_black', { facing: 0, open: 0 });
    for (const u of [6, 7, 10, 11]) K.win(u, 2, U, U + 1); for (const v of [4, 5, 8, 9]) { K.win(0, v, U, U + 1); K.win(14, v, U, U + 1); } for (const u of [2, 3, 8, 11, 12]) K.win(u, 12, U, U + 1);
    P(1, U, 0, 'vx_tech_planter'); P(4, U, 0, 'vx_bush'); P(13, U, 1, 'vx_tech_planter'); P(8, U, 0, 'vx_bush');
    // partitions
    K.box(5, 3, U, 5, 6, U + 2, wall); K.box(5, 6, U, 9, 6, U + 2, wall); K.clear(6, 6, U, 6, 6, U + 1); K.box(9, 3, U, 9, 6, U + 2, wall); K.clear(9, 4, U, 9, 4, U + 1);
    K.box(1, 7, U, 6, 7, U + 2, wall); K.clear(3, 7, U, 3, 7, U + 1); K.box(9, 8, U, 13, 8, U + 2, 'subway_tile'); K.clear(11, 8, U, 11, 8, U + 1);
    // master (front-left) with the loggia, bedroom 2 (front-right), bedroom 3 (back-left), bath (back-right), landing
    bed(K, info, 2, 4, 2, rng.pick(BEDS)); P(1, U, 5, 'vx_nightstand', { facing: 0 }); P(3, U, 5, 'vx_nightstand', { facing: 0 }); P(4, U, 3, 'vx_wardrobe', { facing: 3, part: 0 }); P(4, U + 1, 3, 'vx_wardrobe', { facing: 3, part: 1 }); P(2, U + 1, 6, 'vx_art_cool', { facing: 0 }); K.spot(2, 4, U + 2);
    bed(K, info, 11, 4, 2, rng.pick(BEDS)); P(12, U, 5, 'vx_nightstand', { facing: 0 }); P(13, U, 3, 'vx_wardrobe', { facing: 3, part: 0 }); P(13, U + 1, 3, 'vx_wardrobe', { facing: 3, part: 1 }); P(10, U, 3, 'vx_tech_desk', { facing: 3 }); chair(K, info, 11, 3, 3); K.spot(11, 4, U + 2); P(11, U + 1, 5, 'vx_art_warm', { facing: 0 });
    bed(K, info, 2, 9, 2, rng.pick(BEDS)); if (o.beds > 3) bed(K, info, 4, 9, 2, rng.pick(BEDS)); else { P(4, U, 10, 'vx_bookshelf', { facing: 3 }); P(4, U + 1, 10, 'vx_bookshelf', { facing: 3 }); } P(3, U, 10, 'vx_nightstand', { facing: 0 }); P(1, U, 8, 'vx_wardrobe', { facing: 1, part: 0 }); P(1, U + 1, 8, 'vx_wardrobe', { facing: 1, part: 1 }); K.spot(3, 9, U + 2);
    P(10, U, 11, 'vx_bathtub', { facing: 1 }); P(11, U, 11, 'vx_bathtub', { facing: 1 }); P(13, U, 11, 'vx_shower', { facing: 0, part: 0 }); P(13, U + 1, 11, 'vx_shower', { facing: 0, part: 1 }); P(13, U, 9, 'vx_toilet', { facing: 3 }); P(10, U, 9, 'vx_vanity', { facing: 2 }); P(10, U + 1, 9, 'vx_mirror', { facing: 2 }); K.box(10, 9, G2, 13, 11, G2, 'dark_tile'); K.spot(11, 10, U + 2);
    P(7, U, 10, 'vx_sofa_taupe', { facing: 0 }); info.seats.push([7, U, 10, 0]); P(7, U, 8, 'vx_tall_plant'); P(6, U + 1, 11, 'vx_art_gold', { facing: 0 }); K.spot(7, 5, U + 2); K.spot(7, 9, U + 2);
    // ---- roof: deep flat charcoal roof with a white fascia band and a small upper box
    const RT = U + 3;
    K.floor(-1, 1, 15, 13, trim, RT); K.floor(-1, 1, 15, 13, roof, RT + 1); K.box(-1, 1, RT + 1, 15, 1, RT + 1, 'roof_charcoal_slab', { type: 'bottom' }); K.box(-1, 13, RT + 1, 15, 13, RT + 1, 'roof_charcoal_slab', { type: 'bottom' });
    K.box(-1, 0, RT, 15, 0, RT, trim); K.box(-1, 0, RT + 1, 15, 0, RT + 1, 'roof_charcoal_slab', { type: 'bottom' });
    K.shell(4, 4, 10, 10, RT + 2, RT + 3, wall); K.floor(4, 4, 10, 10, roof, RT + 4); K.clear(5, 5, RT + 2, 9, 9, RT + 3); for (const u of [5, 7, 9]) K.win(u, 4, RT + 2, RT + 3);
    K.floor(5, 5, 9, 9, 'oak_herringbone', RT + 1); P(7, RT + 2, 7, 'vx_sofa_blue', { facing: 0 }); P(6, RT + 2, 8, 'vx_bookshelf', { facing: 1 });
    info.roofTop = RT + 5;
    // ---- outside: driveway with a car, steps, planters, lawn, hedge, palms/trees, bollards
    for (let v = -3; v <= -1; v++) for (let u = 9; u <= 14; u++) K.yard(u, v, 'concrete_smooth');
    K.car(12, -3, F, 0, rng.pick(CARS));
    for (let u = 11; u <= 12; u++) P(u, F, -1, 'travertine_stairs', { facing: 2, half: 0 });
    P(10, F, -1, 'vx_urn_white'); P(13, F, -1, 'vx_urn_white'); P(9, F, -1, 'vx_bollard'); P(14, F, -1, 'vx_bollard');
    for (let u = 0; u <= 8; u++) P(u, F, -1, u % 3 === 1 ? 'vx_bush' : 'vx_flowerbed'); P(-1, F, -1, 'vx_bush_light');
    for (let v = 0; v <= 12; v++) { P(-2, F, v, 'vx_hedge_light'); P(16, F, v, 'vx_hedge_light'); }
    for (let u = -2; u <= 16; u += 1) P(u, F, 13, 'vx_hedge');
    if (o.palms && o.put) { const [px, pz] = L.w(-1, 4); VG.palm(o.put, px, F, pz, 8); } else { K.tree(-1, 10, F, true); }
    K.tree(16, 2, F, false);
    for (let u = 9; u <= 14; u++) P(u, F + 3, -1, 'vx_led_strip_warm', { facing: 0 });
    info.door = [11, F + 1, 2]; info.outside = [11, F, -2]; info.inside = [11, F + 1, 5]; info.lights.push([3, F + 3, 3]);
    return info;
  };

  // ================================================================ C · neoclassical mansion (31 × 19) — the town hall
  MOD.mansion = function (L, lot, o) {
    const K = kit(L, lot, o), { P, F, rng } = K, info = K.info();
    const w = lot.w, d = lot.d, wall = 'stucco_white', trim = 'white_trim', glass = 'window_black';
    const V0 = 3;                                       // main body starts behind the portico
    const H1 = F + 4, U = F + 5, TOP = F + 9;           // ground ceiling, upper floor, cornice
    const cu = w >> 1;
    K.base(0, 0, w - 1, d - 1, 'marble_white');
    K.clear(0, 0, F + 1, w - 1, d - 1, F + 16);
    // main body: two storeys, white walls
    K.shell(0, V0, w - 1, d - 1, F + 1, TOP - 1, wall);
    K.floor(0, V0, w - 1, d - 1, trim, TOP);
    K.floor(1, V0 + 1, w - 2, d - 2, 'oak_herringbone', H1);
    // hall is double height in the centre
    K.clear(cu - 5, V0 + 1, H1, cu + 5, V0 + 9, H1);
    // pilasters and arched windows on the wings, both floors
    for (let u = 1; u < w - 1; u++) {
      const inCentre = Math.abs(u - cu) <= 6;
      if (!inCentre && (u - 1) % 3 === 0) { for (let y = F + 1; y <= TOP - 1; y++) P(u, y, V0 - 1, 'vx_pillar_white'); }
      else if (!inCentre && (u - 1) % 3 !== 0) { for (const y0 of [F + 1, U]) { K.win(u, V0, y0, y0 + 2); P(u, y0 + 3, V0, trim); } }
    }
    for (let v = V0 + 2; v < d - 1; v += 3) for (const uu of [0, w - 1]) for (const y0 of [F + 1, U]) { K.win(uu, v, y0, y0 + 2); K.win(uu, v + 1, y0, y0 + 2); }
    for (let u = 2; u < w - 2; u += 3) for (const y0 of [F + 1, U]) { K.win(u, d - 1, y0, y0 + 2); K.win(u + 1, d - 1, y0, y0 + 2); }
    // the portico: six two-storey columns, an entablature, a balustrade; tall arched entrance
    for (let k = 0; k < 6; k++) { const u = cu - 5 + k * 2; for (let y = F + 1; y <= TOP - 2; y++) P(u, y, 0, 'vx_column_classic'); }
    K.box(cu - 6, 0, TOP - 1, cu + 6, V0, TOP - 1, trim); K.box(cu - 6, 0, TOP, cu + 6, V0, TOP, trim);
    for (let u = cu - 6; u <= cu + 6; u++) P(u, TOP + 1, 0, 'vx_balustrade'); for (let v = 1; v <= V0; v++) { P(cu - 6, TOP + 1, v, 'vx_balustrade'); P(cu + 6, TOP + 1, v, 'vx_balustrade'); }
    K.floor(cu - 6, 0, cu + 6, V0 - 1, 'travertine', F);
    for (let v = 0; v < V0; v++) for (let u = cu - 6; u <= cu + 6; u++) P(u, TOP - 2, v, 'vx_spot');
    // entrance: double glass doors under a tall window, side lights
    K.clear(cu - 1, V0, F + 1, cu + 1, V0, F + 7);
    for (const u of [cu - 1, cu]) { P(u, F + 1, V0, 'vx_glass_door_black', { facing: 0, open: 0 }); P(u, F + 2, V0, 'vx_glass_door_black', { facing: 0, open: 0 }); }
    K.box(cu - 1, V0, F + 3, cu + 1, V0, F + 7, 'window_warm'); K.box(cu + 1, V0, F + 1, cu + 1, V0, F + 2, 'window_warm');
    for (const u of [cu - 4, cu - 3, cu + 3, cu + 4]) { K.win(u, V0, F + 1, F + 3, 'window_warm'); K.win(u, V0, U, U + 2, 'window_warm'); }
    P(cu - 2, F + 2, -1, 'vx_sconce', { facing: 0 }); P(cu + 2, F + 2, -1, 'vx_sconce', { facing: 0 });
    // hipped dark roof over the body (rings of stairs stepping in), a balustrade along the front cornice
    for (let i = 0; i <= 5; i++) {
      const y = TOP + 1 + i;
      for (let v = V0 + i; v <= d - 1 - i; v++) for (let u = i; u <= w - 1 - i; u++) {
        const edgeU = u === i || u === w - 1 - i, edgeV = v === V0 + i || v === d - 1 - i;
        if (!edgeU && !edgeV) { if (i < 5) P(u, y, v, 'roof_charcoal'); continue; }
        if (v >= V0 + i && v <= d - 1 - i) P(u, y, v, 'roof_charcoal_stairs', { facing: edgeV ? (v === V0 + i ? 2 : 0) : (u === i ? 1 : 3), half: 0 });
      }
    }
    for (let u = 0; u < w; u++) if (Math.abs(u - cu) > 6) P(u, TOP + 1, V0, 'vx_balustrade');
    // ---- interior · ground: grand hall with chandeliers and a double stair, dining hall (west wing), library (east wing), kitchen at the back
    for (let v = V0 + 1; v <= d - 2; v++) for (let u = cu - 5; u <= cu + 5; u++) P(u, F, v, ((u + v) & 1) ? 'marble_white' : 'marble_dark');
    K.box(cu - 6, V0 + 1, F + 1, cu - 6, d - 2, H1 - 1, wall); K.box(cu + 6, V0 + 1, F + 1, cu + 6, d - 2, H1 - 1, wall);
    K.clear(cu - 6, V0 + 4, F + 1, cu - 6, V0 + 5, F + 3); K.clear(cu + 6, V0 + 4, F + 1, cu + 6, V0 + 5, F + 3);
    P(cu, F + 7, V0 + 4, 'vx_chandelier'); P(cu, F + 7, V0 + 9, 'vx_chandelier');
    for (let k = 0; k < 4; k++) { P(cu - 3, F + 1 + k, d - 3 - k, 'marble_white_stairs', { facing: 0, half: 0 }); P(cu + 3, F + 1 + k, d - 3 - k, 'marble_white_stairs', { facing: 0, half: 0 }); for (let y = F + 1; y < F + 1 + k; y++) { P(cu - 3, y, d - 3 - k, 'marble_white'); P(cu + 3, y, d - 3 - k, 'marble_white'); } }
    K.box(cu - 2, d - 3, F + 1, cu + 2, d - 2, H1 - 1, 'marble_white'); K.floor(cu - 3, d - 3, cu + 3, d - 2, 'marble_white', H1);
    for (let u = cu - 5; u <= cu + 5; u++) if (Math.abs(u - cu) !== 3) P(u, H1 + 1, V0 + 10, 'vx_balustrade');
    for (const u of [cu - 5, cu + 5]) for (let v = V0 + 2; v <= V0 + 8; v += 3) P(u, F + 1, v, 'vx_urn_white');
    P(cu - 4, F + 3, V0 + 2, 'vx_sconce', { facing: 1 }); P(cu + 4, F + 3, V0 + 2, 'vx_sconce', { facing: 3 });
    P(cu, F + 1, V0 + 6, 'vx_fountain'); P(cu - 5, F + 2, V0 + 6, 'vx_art_gold', { facing: 1 }); P(cu + 5, F + 2, V0 + 6, 'vx_art_gold', { facing: 3 });
    // reception desk: the mayor works here
    P(cu - 1, F + 1, V0 + 2, 'vx_tech_desk', { facing: 0 }); P(cu, F + 1, V0 + 2, 'vx_tech_desk', { facing: 0 }); P(cu + 1, F + 1, V0 + 2, 'vx_tech_desk', { facing: 0 }); chair(K, info, cu, V0 + 3, 0); info.work.push(['council', cu, F + 1, V0 + 3]);
    // west wing: dining hall
    const WL = 1, WR = cu - 7, EL = cu + 7, ER = w - 2;
    for (let v = V0 + 3; v <= V0 + 8; v++) P(cu - 12, F + 1, v, 'vx_dining_table', { facing: 1 }); info.table = [cu - 12, F + 1, V0 + 5];
    for (let v = V0 + 3; v <= V0 + 8; v++) { chair(K, info, cu - 13, v, 1); chair(K, info, cu - 11, v, 3); }
    P(cu - 12, F + 3, V0 + 4, 'vx_chandelier'); P(cu - 12, F + 3, V0 + 7, 'vx_chandelier');
    for (let v = V0 + 2; v <= d - 3; v += 4) { P(WL, F + 1, v, 'vx_tall_plant'); P(WR, F + 2, v, 'vx_art_warm', { facing: 3 }); }
    for (let u = WL + 1; u <= WR - 1; u++) { P(u, F + 1, d - 2, u % 3 === 0 ? 'vx_kitchen_sink' : u % 3 === 1 ? 'vx_kitchen_hob' : 'vx_kitchen_island', { facing: 0 }); P(u, F + 3, d - 2, 'vx_upper_cabinet', { facing: 0 }); }
    info.work.push(['stove', WL + 2, F + 1, d - 3]);
    // east wing: library & council room
    for (let v = V0 + 2; v <= d - 2; v++) for (const u of [EL, ER]) { P(u, F + 1, v, 'vx_bookshelf_walnut', { facing: u === EL ? 1 : 3 }); P(u, F + 2, v, 'vx_bookshelf_walnut', { facing: u === EL ? 1 : 3 }); }
    for (let u = EL + 2; u <= ER - 2; u++) P(u, F + 1, V0 + 5, 'vx_dining_table', { facing: 0 }); for (let u = EL + 2; u <= ER - 2; u++) { chair(K, info, u, V0 + 4, 2); chair(K, info, u, V0 + 6, 0); }
    P(cu + 12, F + 3, V0 + 5, 'vx_chandelier'); P(EL + 2, F + 1, d - 3, 'vx_sofa_taupe', { facing: 0 }); P(EL + 3, F + 1, d - 3, 'vx_sofa_taupe', { facing: 0 }); P(ER - 2, F + 1, d - 3, 'vx_tall_plant'); P(cu + 12, F + 1, V0 + 2, 'vx_coffee_table_marble', { facing: 0 });
    info.work.push(['read', EL + 3, F + 1, V0 + 4]);
    // ---- interior · upper floor: bedrooms along both wings, a gallery over the hall
    K.floor(1, V0 + 1, w - 2, d - 2, 'carpet_cream', H1); K.clear(cu - 5, V0 + 1, H1, cu + 5, V0 + 9, H1);
    K.box(cu - 6, V0 + 1, U, cu - 6, d - 2, TOP - 1, wall); K.box(cu + 6, V0 + 1, U, cu + 6, d - 2, TOP - 1, wall); K.clear(cu - 6, d - 3, U, cu - 6, d - 3, U + 1); K.clear(cu + 6, d - 3, U, cu + 6, d - 3, U + 1);
    for (const side of [-1, 1]) {
      const u0 = side < 0 ? 2 : cu + 8, u1 = side < 0 ? cu - 8 : w - 3;
      K.box(cu + side * 13, V0 + 1, U, cu + side * 13, d - 3, TOP - 1, wall); K.clear(cu + side * 13, V0 + 2, U, cu + side * 13, V0 + 2, U + 1);
      for (const [ub, vb] of [[u0 + 2, V0 + 4], [u1 - 2, V0 + 4]]) { bed(K, info, ub, vb, 2, rng.pick(BEDS)); P(ub - 1, U, vb + 1, 'vx_nightstand', { facing: 0 }); P(ub + 1, U, vb + 1, 'vx_nightstand', { facing: 0 }); }
      P(u0, U, d - 3, 'vx_bathtub', { facing: 1 }); P(u0 + 1, U, d - 3, 'vx_bathtub', { facing: 1 }); P(u1, U, d - 3, 'vx_vanity', { facing: 0 }); P(u1, U + 1, d - 3, 'vx_mirror', { facing: 0 }); P(u1 - 2, U, d - 3, 'vx_toilet', { facing: 0 });
      P((u0 + u1) >> 1, U + 2, V0 + 6, 'vx_chandelier'); P(u0 + 1, U, V0 + 8, 'vx_wardrobe', { facing: 1, part: 0 }); P(u0 + 1, U + 1, V0 + 8, 'vx_wardrobe', { facing: 1, part: 1 }); P((u0 + u1) >> 1, U + 1, d - 4, 'vx_art_cool', { facing: 0 });
      P(u1 - 1, U, V0 + 8, 'vx_sofa_cream', { facing: 0 }); info.seats.push([u1 - 1, U, V0 + 8, 0]);
    }
    for (let v = V0 + 1; v <= V0 + 9; v++) { P(cu - 5, U, v, 'vx_balustrade'); P(cu + 5, U, v, 'vx_balustrade'); }
    // ---- outside: granite plaza with a fountain, steps, urns, bollards, lawns and trees at the sides
    for (let v = -3; v <= -1; v++) for (let u = -2; u <= w + 1; u++) K.yard(u, v, 'granite_paver');
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) K.yard(cu + a, -3 + b, a === 0 && b === 0 ? 'granite_paver' : 'water');
    P(cu, F, -3, 'vx_fountain'); for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (Math.abs(a) === 2 || Math.abs(b) === 2) K.yard(cu + a, -3 + b, 'travertine');
    for (const u of [cu - 7, cu + 7]) { P(u, F, -1, 'vx_urn'); P(u, F, -2, 'vx_bollard'); }
    for (let u = cu - 8; u <= cu + 8; u += 4) if (u !== cu) P(u, F, -4, null);
    for (const u of [-2, w + 1]) for (let v = 0; v < d; v += 4) P(u, F, v, 'vx_urn');
    K.tree(-1, d - 2, F, true); K.tree(w, d - 2, F, true);
    info.door = [cu, F + 1, V0]; info.outside = [cu, F, -2]; info.inside = [cu, F + 1, V0 + 4]; info.lights.push([cu, F + 7, V0 + 4]); info.roofTop = TOP + 7;
    return info;
  };

  // ================================================================ school (17 × 11)
  MOD.school = function (L, lot, o) {
    const K = kit(L, lot, o), { P, F, rng } = K, info = K.info();
    const w = lot.w, d = lot.d, wall = 'stucco_white', accent = 'charcoal_panel';
    K.base(0, 0, w - 1, d - 1, 'terrazzo'); K.clear(0, 0, F + 1, w - 1, d - 1, F + 9);
    K.shell(0, 0, w - 1, d - 1, F + 1, F + 3, wall); K.floor(-1, -1, w, d, 'roof_charcoal', F + 4); K.floor(0, 0, w - 1, d - 1, 'white_trim', F + 4);
    for (let u = 1; u < w - 1; u++) if (u % 2 === 1) { P(u, F + 1, 0, accent); K.win(u, 0, F + 2, F + 3); } else K.win(u, 0, F + 1, F + 3);
    // corridor along the front (v 1..2), three classrooms behind (v 4..d-2)
    K.box(1, 3, F + 1, w - 2, 3, F + 3, wall);
    const rooms = [];
    const nr = w >= 21 ? 3 : 2, rw = Math.floor((w - 2 - (nr - 1)) / nr);
    for (let k = 0; k < nr; k++) {
      const u0 = 1 + k * (rw + 1), u1 = u0 + rw - 1;
      if (k > 0) K.box(u0 - 1, 4, F + 1, u0 - 1, d - 2, F + 3, wall);
      K.clear(u0 + 1, 3, F + 1, u0 + 1, 3, F + 2);                          // door from the corridor
      P(u0 + 1, F + 1, 3, 'birch_door', { facing: 2, half: 0, hinge: 0, open: 0 }); P(u0 + 1, F + 2, 3, 'birch_door', { facing: 2, half: 1, hinge: 0, open: 0 });
      // whiteboard on the back wall, teacher's desk, rows of pupil desks
      for (let u = u0 + 1; u <= u1 - 1; u++) P(u, F + 2, d - 2, 'vx_school_board', { facing: 0 });
      P(u0 + (rw >> 1), F + 1, d - 3, 'vx_tech_desk', { facing: 0 }); info.work.push(['teach', u0 + (rw >> 1), F + 1, d - 4]);
      for (let v = d - 5; v >= 4; v -= 2) for (let u = u0 + 1; u <= u1 - 1; u += 2) { P(u, F + 1, v, 'vx_school_desk', { facing: 2 }); info.desks.push([u, F + 1, v, 2]); }
      K.spot(u0 + (rw >> 1), 6, F + 3); K.spot(u0 + (rw >> 1), d - 4, F + 3);
      for (const u of [u0, u1]) K.win(u, d - 1, F + 1, F + 2);
      rooms.push([u0, u1]);
    }
    // corridor: lockers, plants, art, a clock (spot), the entrance in the middle
    const du = w >> 1;
    K.clear(du - 1, 0, F + 1, du, 0, F + 2); for (const u of [du - 1, du]) for (const y of [F + 1, F + 2]) P(u, y, 0, 'vx_glass_door_black', { facing: 0, open: 0 });
    for (let u = 2; u < w - 2; u++) if (Math.abs(u - du) > 2 && u % 3 !== 0) P(u, F + 1, 2, 'vx_locker', { facing: 0 });
    P(1, F + 1, 1, 'vx_tall_plant'); P(w - 2, F + 1, 1, 'vx_tall_plant'); for (let u = 3; u < w - 3; u += 5) K.spot(u, 1, F + 3);
    P(du + 2, F + 2, 2, 'vx_art_cool', { facing: 0 }); P(du - 3, F + 2, 2, 'vx_art_warm', { facing: 0 });
    // sign and a playground in front: benches, flower beds, a hopscotch of pavers
    for (let u = du - 2; u <= du + 1; u++) P(u, F + 3, -1, 'vx_shop_sign', { facing: 0 });
    for (let v = -3; v <= -1; v++) for (let u = 0; u < w; u++) K.yard(u, v, (u + v) % 3 === 0 ? 'paver_grey' : 'concrete_smooth');
    P(1, F, -2, 'vx_bench', { facing: 0 }); info.seats.push([1, F, -2, 0]); P(w - 2, F, -2, 'vx_bench', { facing: 0 }); info.seats.push([w - 2, F, -2, 0]);
    P(3, F, -3, 'vx_flowerbed_tulips'); P(w - 4, F, -3, 'vx_flowerbed_roses'); P(du + 3, F, -3, 'vx_birdbath'); P(du - 4, F, -3, 'vx_bollard'); P(du + 4, F, -1, 'vx_bollard');
    K.hedgeRow(-2, -1, -2, d - 1, true); K.hedgeRow(w + 1, -1, w + 1, d - 1, true); K.tree(-1, d - 1, F, true);
    info.door = [du, F + 1, 0]; info.outside = [du, F, -2]; info.inside = [du, F + 1, 1]; info.roofTop = F + 5; info.play = [du, F, -2];
    return info;
  };

  // ================================================================ factory (19 × 13)
  MOD.factory = function (L, lot, o) {
    const K = kit(L, lot, o), { P, F, rng } = K, info = K.info();
    const w = lot.w, d = lot.d, wall = 'charcoal_panel', H = 6;
    K.base(0, 0, w - 1, d - 1, 'concrete_smooth'); K.clear(0, 0, F + 1, w - 1, d - 1, F + 16);
    K.shell(0, 0, w - 1, d - 1, F + 1, F + H, wall);
    for (let u = 1; u < w - 1; u++) { K.win(u, 0, F + 4, F + 5); K.win(u, d - 1, F + 4, F + 5); } for (let v = 1; v < d - 1; v++) { K.win(0, v, F + 4, F + 5); K.win(w - 1, v, F + 4, F + 5); }
    for (let u = 0; u < w; u++) P(u, F + 2, 0, 'temple_light_bar');                     // orange band
    K.floor(-1, -1, w, d, 'roof_charcoal', F + H + 1); K.floor(0, 0, w - 1, d - 1, 'stucco_grey', F + H + 1);
    // saw-tooth skylights and the stack
    for (let u = 2; u < w - 2; u += 5) for (let v = 1; v < d - 1; v++) { P(u, F + H + 2, v, 'window_black'); P(u + 1, F + H + 2, v, 'charcoal_panel'); }
    for (let y = F + H + 2; y <= F + H + 9; y++) P(w - 3, y, d - 3, 'black_metal'); P(w - 3, F + H + 10, d - 3, 'beacon_red');
    // loading dock: roller door on the front-right, crates on a dock
    const du = 4;
    K.clear(w - 6, 0, F + 1, w - 3, 0, F + 3); for (let u = w - 6; u <= w - 3; u++) for (let y = F + 1; y <= F + 3; y++) P(u, y, 0, 'garage_door');
    K.clear(du - 1, 0, F + 1, du, 0, F + 2); for (const u of [du - 1, du]) for (const y of [F + 1, F + 2]) P(u, y, 0, 'vx_glass_door_black', { facing: 0, open: 0 });
    for (let u = du - 2; u <= du + 1; u++) P(u, F + 4, -1, 'vx_shop_sign', { facing: 0 });
    // machines in two lines, a conveyor between, crates, control desk, hex lights
    const lines = [3, d - 4];
    for (const v of lines) for (let u = 2; u < w - 2; u += 2) { P(u, F + 1, v, 'vx_machine', { facing: v === 3 ? 2 : 0 }); info.work.push(['assemble', u, F + 1, v === 3 ? 4 : d - 5]); }
    for (let u = 2; u < w - 2; u++) P(u, F + 1, (d >> 1), 'vx_conveyor', { facing: 1 });
    for (let u = w - 5; u <= w - 2; u++) { P(u, F + 1, 1, 'vx_cargo'); if (u & 1) P(u, F + 2, 1, 'vx_crate'); }
    P(1, F + 1, (d >> 1) - 1, 'vx_console', { facing: 1 }); P(1, F + 1, (d >> 1), 'vx_console', { facing: 1 }); P(1, F + 2, (d >> 1), 'vx_holo_screen_amber', { facing: 1 }); info.work.push(['assemble', 2, F + 1, (d >> 1) - 1]);
    for (let u = 3; u < w - 3; u += 4) for (let v = 2; v < d - 2; v += 4) P(u, F + H, v, 'vx_hex_light');
    P(w - 2, F + 1, d - 2, 'vx_locker', { facing: 3 }); P(w - 3, F + 1, d - 2, 'vx_locker', { facing: 0 }); P(1, F + 1, d - 2, 'vx_tall_plant_black');
    for (let u = 2; u < w - 2; u++) P(u, F + 1, 2, 'vx_led_strip', { facing: 2 });
    // yard: asphalt apron with a parked truck-ish car, pallets, bollards, fence
    for (let v = -3; v <= -1; v++) for (let u = -1; u <= w; u++) K.yard(u, v, 'asphalt');
    K.car(w - 5, -3, F, 0, 'vx_car_white'); P(w - 1, F, -2, 'vx_cargo'); P(w - 1, F, -1, 'vx_cargo'); P(0, F, -2, 'vx_bollard'); P(du + 3, F, -2, 'vx_bollard');
    for (let v = -1; v < d; v++) { P(-2, F, v, 'vx_railing_black'); P(w + 1, F, v, 'vx_railing_black'); }
    info.door = [du, F + 1, 0]; info.outside = [du, F, -2]; info.inside = [du, F + 1, 2]; info.roofTop = F + H + 11;
    return info;
  };

  // ================================================================ office block (11 × 11, three storeys)
  MOD.office = function (L, lot, o) {
    const K = kit(L, lot, o), { P, F, rng } = K, info = K.info();
    const w = lot.w, d = lot.d, du = w >> 1;
    K.base(0, 0, w - 1, d - 1, 'terrazzo'); K.clear(0, 0, F + 1, w - 1, d - 1, F + 16);
    for (let s = 0; s < 3; s++) {
      const y0 = F + 1 + s * 4;
      K.shell(0, 0, w - 1, d - 1, y0, y0 + 2, 'window_black'); K.shell(0, 0, w - 1, d - 1, y0 + 3, y0 + 3, 'charcoal_panel');
      for (const [u, v] of [[0, 0], [w - 1, 0], [0, d - 1], [w - 1, d - 1]]) for (let y = y0; y <= y0 + 2; y++) P(u, y, v, 'charcoal_panel');
      if (s > 0) K.floor(1, 1, w - 2, d - 2, s === 1 ? 'carpet_cream' : 'oak_herringbone', y0 - 1);
      // desks with chairs along the windows, a meeting table in the middle, plants and spots
      for (let u = 2; u < w - 2; u += 3) { P(u, y0, 1, 'vx_tech_desk', { facing: 2 }); chair(K, info, u, 2, 0); info.work.push(['office', u, y0, 2]); P(u, y0, d - 2, 'vx_tech_desk', { facing: 0 }); chair(K, info, u, d - 3, 2); info.work.push(['office', u, y0, d - 3]); }
      for (let u = du - 1; u <= du + 1; u++) P(u, y0, d >> 1, 'vx_dining_table_white', { facing: 0 }); for (let u = du - 1; u <= du + 1; u++) { chair(K, info, u, (d >> 1) - 1, 2); chair(K, info, u, (d >> 1) + 1, 0); }
      P(1, y0, 1, 'vx_tall_plant'); P(w - 2, y0, d - 2, 'vx_tall_plant_black'); K.spot(du, 2, y0 + 2); K.spot(du, d - 3, y0 + 2); P(du, y0 + 2, d >> 1, 'vx_pendant');
      P(1, y0 + 1, d - 2, 'vx_art_cool', { facing: 1 });
      // stairwell in the back-right corner: ladder-stair up
      if (s < 2) for (let y = y0; y <= y0 + 3; y++) P(w - 2, y, 1, 'ladder', { facing: 0 });
      if (s < 2) P(w - 2, y0 + 3, 1, null);
    }
    K.floor(-1, -1, w, d, 'roof_charcoal', F + 13); K.floor(0, 0, w - 1, d - 1, 'stucco_grey', F + 13); for (let u = 0; u < w; u++) { P(u, F + 14, 0, 'vx_railing_black'); P(u, F + 14, d - 1, 'vx_railing_black'); }
    for (const [u, v] of [[2, 2], [w - 3, 2], [2, d - 3], [w - 3, d - 3]]) P(u, F + 14, v, 'vx_tech_planter');
    // lobby: glass doors, reception desk
    K.clear(du - 1, 0, F + 1, du, 0, F + 2); for (const u of [du - 1, du]) for (const y of [F + 1, F + 2]) P(u, y, 0, 'vx_glass_door_black', { facing: 0, open: 0 });
    for (let u = du - 2; u <= du + 1; u++) P(u, F + 4, -1, 'vx_led_strip_warm', { facing: 0 });
    for (let v = -3; v <= -1; v++) for (let u = 0; u < w; u++) K.yard(u, v, 'paver_grey');
    P(1, F, -2, 'vx_bench', { facing: 0 }); info.seats.push([1, F, -2, 0]); P(w - 2, F, -2, 'vx_bollard'); P(0, F, -2, 'vx_bollard'); P(du + 2, F, -3, 'vx_tech_planter');
    info.door = [du, F + 1, 0]; info.outside = [du, F, -2]; info.inside = [du, F + 1, 3]; info.roofTop = F + 15;
    return info;
  };

  // ================================================================ café (9 × 8) with a terrace
  MOD.cafe = function (L, lot, o) {
    const K = kit(L, lot, o), { P, F, rng } = K, info = K.info();
    const w = lot.w, d = lot.d, du = w >> 1, wall = 'stucco_cream';
    K.base(0, 0, w - 1, d - 1, 'oak_herringbone'); K.clear(0, 0, F + 1, w - 1, d - 1, F + 8);
    K.shell(0, 0, w - 1, d - 1, F + 1, F + 3, wall); K.floor(-1, -1, w, d, 'roof_charcoal', F + 4); K.floor(0, 0, w - 1, d - 1, 'white_trim', F + 4);
    for (let u = 1; u < w - 1; u++) if (Math.abs(u - du) > 1) K.win(u, 0, F + 1, F + 3); for (const v of [2, 3, 5]) { K.win(0, v, F + 1, F + 2); K.win(w - 1, v, F + 1, F + 2); }
    K.clear(du - 1, 0, F + 1, du, 0, F + 2); for (const u of [du - 1, du]) for (const y of [F + 1, F + 2]) P(u, y, 0, 'vx_glass_door_black', { facing: 0, open: 0 });
    for (let u = 1; u < w - 1; u++) P(u, F + 3, -1, 'vx_awning_red', { facing: 0 });
    // counter with a bakery case and coffee machine, pendants, tables inside
    for (let u = 1; u < w - 1; u++) P(u, F + 1, d - 2, u === 1 ? 'vx_shop_bakery_case' : u === w - 2 ? 'vx_kitchen_sink' : 'vx_kitchen_island_dark', { facing: 0 });
    for (let u = 2; u < w - 2; u++) P(u, F + 3, d - 2, 'vx_upper_cabinet', { facing: 0 }); P(w - 2, F + 1, d - 3, 'vx_stool'); info.work.push(['barista', du, F + 1, d - 3]);
    for (const u of [2, w - 3]) { P(u, F + 1, 3, 'vx_coffee_table_marble', { facing: 0 }); chair(K, info, u - 1, 3, 1); chair(K, info, u + 1, 3, 3); P(u, F + 3, 3, 'vx_pendant_brass'); }
    P(1, F + 2, 1, 'vx_art_warm', { facing: 1 }); P(w - 2, F + 1, 1, 'vx_tall_plant'); P(1, F + 1, d - 3, 'vx_tall_plant_black'); K.spot(du, 2, F + 3);
    // terrace: tables and chairs on pavers, planters, bollards
    for (let v = -3; v <= -1; v++) for (let u = -1; u <= w; u++) K.yard(u, v, 'paver_grey');
    for (const u of [1, w - 2]) { P(u, F, -2, 'vx_coffee_table', { facing: 0 }); chair(K, info, u, -3, 2); chair(K, info, u, -1, 0); }
    P(-1, F, -1, 'vx_tech_planter'); P(w, F, -1, 'vx_tech_planter'); P(du, F, -3, 'vx_bollard'); P(du - 2, F + 3, -1, 'vx_led_strip_warm', { facing: 0 });
    info.door = [du, F + 1, 0]; info.outside = [du, F, -2]; info.inside = [du, F + 1, 2]; info.roofTop = F + 5;
    return info;
  };

  // ================================================================ park (12 × 10): paths, lawn, fountain, benches, trees, playground
  MOD.park = function (L, lot, o) {
    const K = kit(L, lot, o), { P, F, rng } = K, info = K.info();
    const w = lot.w, d = lot.d, cu = w >> 1, cv = d >> 1;
    for (let v = 0; v < d; v++) for (let u = 0; u < w; u++) {
      const gy = o.ground(u, v); for (let y = gy + 1; y < F; y++) P(u, y, v, 'dirt');
      const path = u === cu || v === cv || u === 0 || v === 0 || u === w - 1 || v === d - 1;
      P(u, F, v, path ? 'paver_grey' : 'grass_block');
      for (let y = F + 1; y <= F + 6; y++) P(u, y, v, null);
      if (!path && (u + v) % 4 === 0 && rng.chance(0.6)) P(u, F + 1, v, rng.pick(['vx_flowerbed', 'vx_flowerbed_tulips', 'vx_flowerbed_roses', 'short_grass']));
    }
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) P(cu + a, F, cv + b, a === 0 && b === 0 ? 'granite_paver' : 'water');
    P(cu, F + 1, cv, 'vx_fountain'); for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (Math.abs(a) === 2 || Math.abs(b) === 2) P(cu + a, F, cv + b, 'travertine');
    for (const [u, v, f] of [[cu - 3, cv - 1, 1], [cu + 3, cv + 1, 3], [cu + 1, cv - 3, 2], [cu - 1, cv + 3, 0]]) { P(u, F + 1, v, 'vx_bench', { facing: f }); info.seats.push([u, F + 1, v, f]); }
    for (const [u, v] of [[1, 1], [w - 2, 1], [1, d - 2], [w - 2, d - 2]]) K.tree(u, v, F + 1, true);
    for (const [u, v] of [[cu - 2, 1], [cu + 2, d - 2], [1, cv + 2], [w - 2, cv - 2]]) P(u, F + 1, v, 'vx_bollard');
    P(2, F + 1, cv - 1, 'vx_picnic_table', { facing: 1 }); info.seats.push([2, F + 1, cv - 1, 1]); P(w - 3, F + 1, cv + 1, 'vx_birdbath');
    info.spot = [cu, F + 1, cv - 2]; info.play = [w - 3, F + 1, 2];
    return info;
  };

  // ---------------------------------------------------------------- dispatcher
  // returns the info record (lot-local) or null when the kind is not a modern building
  MOD.build = function (kind, L, lot, o) {
    switch (kind) {
      case 'home': case 'lot': {
        // homes come from the villa catalogue (real floor plans at real scale); lots too small for it get the two signature houses
        if (VG.plan2 && VG.plan2.build) { const info = VG.plan2.build(L, lot, o); if (info) return info; }
        if (lot.w >= 18 && lot.d >= 14) return MOD.houseA(L, lot, o);
        if (lot.w >= 15 && lot.d >= 13) return MOD.villa(L, lot, o);
        return null;
      }
      case 'hall': return MOD.mansion(L, lot, o);
      case 'school': return MOD.school(L, lot, o);
      case 'factory': return MOD.factory(L, lot, o);
      case 'office': return MOD.office(L, lot, o);
      case 'cafe': return MOD.cafe(L, lot, o);
      case 'park': return MOD.park(L, lot, o);
      default: return null;
    }
  };
  MOD.DIMS = { home: VG.plan2 && VG.plan2.DIMS ? VG.plan2.DIMS.slice() : [[18, 14], [15, 13]], hall: [[31, 19], [27, 17]], school: [[17, 14], [15, 13]], factory: [[19, 13], [15, 11]], office: [[11, 11]], cafe: [[9, 8]], park: [[12, 10]], clinic: [[11, 9]] };
  MOD.CIVIC = ['hall', 'school', 'factory', 'cafe', 'office', 'clinic', 'park'];
})(VR);
