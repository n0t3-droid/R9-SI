// ============================================================================
// 🗼 Aussichtsturm, 🏛 Halle / Markthalle, 🏰 Burg — three public structures.
// The lookout: a lattice of legs, rings and bracing (or a stone shaft) around
// a spiral stair, a railed platform with an optional pyramid roof. The hall:
// pilasters by rhythm, glass bands, a 1:2 gable roof of blocks and slabs with
// a skylight ridge, trusses, an open gable entrance with an awning; inside two
// rows of market stalls along a central aisle under lanterns, or a workshop
// with machines, a conveyor and containers. The castle: a two-thick curtain
// wall with a walkable top and crenellations, four corner towers with spiral
// stairs that open onto the wall walk, a gatehouse with a portcullis, a keep
// of three furnished floors, a well, stables and banners in the courtyard.
// ============================================================================
(function (VR) {
  'use strict';
  const Forge = VR.Forge; if (!Forge || !Forge.kit) return;
  const DIR = Forge.DIR;
  // ---------------------------------------------------------------- 🗼
  const LS = {
    holz: { name: 'Holz', leg: 'oak_log', legPr: { axis: 0 }, ring: 'oak_fence', brace: 'vx_beam_oak', bracePr: { axis: 0 }, stair: 'oak_stairs', fill: 'oak_planks', post: 'spruce_log', deck: 'deck_wood', rail: 'oak_fence', roof: 'vx_roof_shingle', wall: 'vx_planks', lamp: 'vx_lantern' },
    stahl: { name: 'Stahl', leg: 'black_metal', ring: 'iron_bars', brace: 'black_metal', stair: 'concrete_smooth_stairs', fill: 'black_metal', post: 'black_metal', deck: 'metal_grate', rail: 'vx_railing_black', roof: 'vx_roof_slate', wall: 'charcoal_panel', lamp: 'vx_lamppost_black' },
    stein: { name: 'Stein', leg: 'stone_bricks', ring: 'stone_brick_wall', brace: 'stone_bricks', stair: 'stone_brick_stairs', fill: 'stone_bricks', post: 'stone_bricks', deck: 'stone_brick_slab', rail: 'stone_brick_wall', roof: 'vx_roof_slate', wall: 'vx_stonebrick', lamp: 'vx_lantern' },
    backstein: { name: 'Backstein', leg: 'bricks', ring: 'brick_wall', brace: 'bricks', stair: 'brick_stairs', fill: 'bricks', post: 'bricks', deck: 'brick_slab', rail: 'brick_wall', roof: 'vx_roof_terracotta', wall: 'vx_redbrick', lamp: 'vx_lantern' },
    tech: { name: 'Tech', leg: 'vx_tech_trim', ring: 'vx_tech_railing', brace: 'vx_tech_band', stair: 'concrete_smooth_stairs', fill: 'vx_tech_gray', post: 'vx_tech_trim', deck: 'vx_floor_deck', rail: 'vx_tech_railing', roof: 'vx_dome_glass', wall: 'vx_tech_white', lamp: 'vx_lamppost_tech' },
  };
  Forge.register({
    id: 'lookout', icon: '🗼', name: 'Aussichtsturm', en: 'Lookout tower', level: true, sh: 1,
    params: [
      { k: 'h', label: 'Höhe', min: 8, max: 60, def: 24, dim: true },
      { k: 'k', label: 'Bauart', min: 0, max: 1, def: 0, names: ['Gitter', 'Massiv'] },
      { k: 'p', label: 'Plattform', min: 3, max: 7, def: 5, step: 2 },
      { k: 'r', label: 'Dach', min: 0, max: 1, def: 1 },
    ],
    styles: Object.keys(LS).map(id => ({ id, name: LS[id].name })),
    lot: (P) => [P.params.p + 4, P.params.p + 5],
    describe: (P) => [P.params.h + ' hoch', P.params.k ? 'massiv' : 'Gitter', 'Plattform ' + P.params.p].concat(P.params.r ? ['Dach'] : []),
  }, function (P, env) {
    const { h, k, p, r } = P.params, S = LS[P.style] || LS.holz;
    const s = 5, W = p + 4, D = p + 5, dy = -1, K = Forge.kit(W, h + 10, D, dy);
    const ox = (W - s) >> 1, oz = 2, cx = ox + 2, cz = oz + 2;              // the 5 × 5 shaft, one apron row in front
    K.box(0, 0, 0, W - 1, 0, D - 1, 'grass_block'); K.box(ox - 1, 0, oz - 1, ox + s, 0, oz + s, k ? 'stone_bricks' : 'gravel'); K.box(cx - 1, 0, 0, cx + 1, 0, oz, 'paver_grey');
    K.box(0, 1, 0, W - 1, h + 9, D - 1, 0);
    const top = h;                                                         // the platform's floor row
    if (k === 0) {
      // four legs, a ring every four rows, X bracing on every face
      for (const [lx, lz] of [[ox, oz], [ox + 4, oz], [ox, oz + 4], [ox + 4, oz + 4]]) K.col(lx, lz, 1, top - 1, S.leg, S.legPr);
      for (let y = 4; y < top; y += 4) for (let i = 1; i < 4; i++) { K.set(ox + i, y, oz, S.ring); K.set(ox + i, y, oz + 4, S.ring); K.set(ox, y, oz + i, S.ring); K.set(ox + 4, y, oz + i, S.ring); }
      for (let y = 1; y < top - 1; y++) { const i = ((y - 1) % 4), a = 1 + (i < 2 ? i : 3 - i), bq = 3 - (i < 2 ? i : 3 - i); if (y % 4 === 0) continue; for (const q of [a, bq]) { K.set(ox + q, y, oz, S.brace, S.bracePr); K.set(ox + q, y, oz + 4, S.brace, S.bracePr); K.set(ox, y, oz + q, S.brace, S.bracePr); K.set(ox + 4, y, oz + q, S.brace, S.bracePr); } }
      K.box(ox + 1, 1, oz, ox + 3, 2, oz, 0);                              // the way in at the front
    } else {
      K.shell(ox, 1, oz, ox + 4, top - 1, oz + 4, S.wall);
      for (let y = 4; y < top - 2; y += 5) { K.set(ox + 2, y, oz, 'vx_window_arch', { facing: 0 }); K.set(ox + 2, y, oz + 4, 'vx_window_arch', { facing: 2 }); K.set(ox, y, oz + 2, 'vx_window_arch', { facing: 3 }); K.set(ox + 4, y, oz + 2, 'vx_window_arch', { facing: 1 }); }
      K.box(ox + 1, 1, oz, ox + 1, 2, oz, 0); K.door(ox + 1, 1, oz, 2, 'oak_door', 0);   // (the first step starts right behind it)
      K.set(ox + 2, 3, oz, 'vm_wall_lantern', { facing: 0, part: 0 }); K.set(ox + 3, 2, oz, 'vm_house_sign', { facing: 0, part: 0 });
    }
    // the spiral stair around the centre post, every step with a block under it
    const steps = K.spiral(cx, 0, cz, top, S.stair, null, S.post);
    for (const [x, y, z] of steps) if (y - 1 >= 1 && K.get(x, y - 1, z) === 0) K.set(x, y - 1, z, S.fill);
    // the platform: p × p (+1 overhang) around the shaft, the last steps keep their headroom, a railing, lamps
    const half = (p + 2) >> 1;
    for (let z = cz - half; z <= cz + half; z++) for (let x = cx - half; x <= cx + half; x++) K.set(x, top, z, S.deck, /slab$/.test(S.deck) ? { type: 2 } : undefined);
    steps.forEach(([x, y, z], i) => { if (y === top) K.set(x, y, z, S.stair, { facing: [1, 1, 2, 2, 3, 3, 0, 0][i & 7], half: 0 }); else if (y >= top - 2) K.air(x, top, z); });
    for (let z = cz - half; z <= cz + half; z++) for (let x = cx - half; x <= cx + half; x++) if (x === cx - half || x === cx + half || z === cz - half || z === cz + half) K.set(x, top + 1, z, S.rail);
    for (const [x, z] of [[cx - half, cz - half], [cx + half, cz + half]]) K.set(x, top + 1, z, S.lamp);
    if (r) {
      const ry = top + 4;
      for (const [x, z] of [[cx - half + 1, cz - half + 1], [cx + half - 1, cz - half + 1], [cx - half + 1, cz + half - 1], [cx + half - 1, cz + half - 1]]) K.col(x, z, top + 1, ry - 1, S.post, S.legPr);
      if (S.roof === 'vx_dome_glass') { for (let z = cz - half; z <= cz + half; z++) for (let x = cx - half; x <= cx + half; x++) K.set(x, ry, z, 'vx_tech_band'); K.set(cx, ry + 1, cz, 'vx_dome_glass'); }
      else {
        let rr = half + 1, y = ry;
        while (rr >= 0) {
          for (let z = cz - rr; z <= cz + rr; z++) for (let x = cx - rr; x <= cx + rr; x++) { const edge = Math.max(Math.abs(x - cx), Math.abs(z - cz)) === rr; if (!edge) continue; const f = Math.abs(x - cx) > Math.abs(z - cz) ? (x < cx ? 1 : 3) : (z < cz ? 2 : 0); if (rr === 0) K.set(x, y, z, 'vx_ridge_' + S.roof.split('_').pop(), { facing: 0 }); else K.set(x, y, z, S.roof, { facing: f }); }
          rr--; y++;
        }
      }
    }
    K.grid.meta = { name: 'Aussichtsturm', doors: [[k ? ox + 1 : ox + 2, 1 + dy, oz]], floors: [0, top + dy], top: (r ? top + 4 + half + 2 : top + 2) + dy, platform: top + dy, lot: [W, D], anchor: [cx, 0] };
    return K.grid;
  });

  // ---------------------------------------------------------------- 🏛
  const HS = {
    holz: { name: 'Holz', wall: 'vx_planks', pier: 'vx_beam_oak', pierPr: { axis: 0 }, glass: 'window_black', roof: 'spruce_planks', slab: 'spruce_slab', truss: 'vx_beam_oak', trussPr: { axis: 1 }, floor: 'vx_floor_stone', column: 'oak_log', columnPr: { axis: 0 }, lamp: 'vx_lantern', sky: false },
    stahl: { name: 'Stahl', wall: 'charcoal_panel', pier: 'black_metal', glass: 'window_black', roof: 'charcoal_panel', slab: 'charcoal_panel_slab', truss: 'black_metal', floor: 'concrete_smooth', column: 'black_metal', lamp: 'vx_lamppost_black', sky: true },
    backstein: { name: 'Backstein', wall: 'vx_redbrick', pier: 'bricks', glass: 'window_warm', roof: 'roof_charcoal', slab: 'roof_charcoal_slab', truss: 'vx_beam_dark', trussPr: { axis: 1 }, floor: 'vx_floor_stone', column: 'vx_column_classic', lamp: 'vx_lantern', sky: false },
    stein: { name: 'Stein', wall: 'vx_sandstone', pier: 'smooth_sandstone', glass: 'window_black', roof: 'slate_roof', slab: 'slate_roof_slab', truss: 'vx_beam_dark', trussPr: { axis: 1 }, floor: 'vx_floor_checker', column: 'vx_column_classic', lamp: 'vx_lantern', sky: false },
    tech: { name: 'Tech', wall: 'vx_tech_white', pier: 'vx_tech_trim', glass: 'vx_glass_wall', glassPr: { facing: 0 }, roof: 'charcoal_panel', slab: 'charcoal_panel_slab', truss: 'vx_tech_band', floor: 'vx_floor_plaza', column: 'vx_tech_trim', lamp: 'vx_hex_light', sky: true },
  };
  Forge.register({
    id: 'hall', icon: '🏛', name: 'Halle', en: 'Hall', level: true, sh: 1,
    params: [
      { k: 'l', label: 'Länge', min: 20, max: 60, def: 32, dim: true },
      { k: 'w', label: 'Breite', min: 12, max: 30, def: 18, dim: true },
      { k: 'h', label: 'Traufhöhe', min: 6, max: 14, def: 8, dim: true },
      { k: 'c', label: 'Säulen', min: 0, max: 1, def: 1 },
      { k: 'm', label: 'Markt', min: 0, max: 1, def: 1, names: ['Werkhalle', 'Markt'] },
    ],
    styles: Object.keys(HS).map(id => ({ id, name: HS[id].name })),
    lot: (P) => [P.params.w, P.params.l + 2],
    title: (P) => (P.params.m ? 'Markthalle' : 'Werkhalle'),
    describe: (P) => [P.params.l + ' × ' + P.params.w, 'Traufe ' + P.params.h].concat(P.params.c ? ['Säulen'] : []),
  }, function (P, env) {
    const { l, w, h, c, m } = P.params, S = HS[P.style] || HS.holz, rng = Forge.rng(P, 'hall');
    const dy = -1, W = w, D = l + 2, ridge = h + Math.floor(((w - 1) >> 1) / 2) + 1, K = Forge.kit(W, ridge + 4, D, dy);
    const v0 = 2, v1 = D - 1, cx = w >> 1;
    K.box(0, 0, 0, W - 1, 0, D - 1, 'paver_grey'); K.box(0, 0, v0, W - 1, 0, v1, S.floor); K.box(0, 1, 0, W - 1, ridge + 3, D - 1, 0);
    // walls: pilasters every four, a solid lower band, glass above; the gables filled under the roof line
    const hr = (x) => h + Math.floor(Math.min(x, w - 1 - x) / 2);
    for (let v = v0; v <= v1; v++) for (let x = 0; x < w; x++) {
      const ring = x === 0 || x === w - 1 || v === v0 || v === v1; if (!ring) continue;
      const i = (v === v0 || v === v1) ? x : v - v0, pier = i % 4 === 0 || (x === 0 || x === w - 1) && (v === v0 || v === v1);
      const topY = (v === v0 || v === v1) ? hr(x) - 1 : h - 1;
      for (let y = 1; y <= topY; y++) {
        let mat = S.wall, pr;
        if (pier) mat = S.pier, pr = S.pierPr;
        else if (y >= 3 && y <= h - 2 && !((v === v0 || v === v1) && y > h - 2)) { mat = S.glass; pr = S.glassPr ? { facing: v === v0 ? 0 : v === v1 ? 2 : x === 0 ? 3 : 1 } : undefined; }
        K.set(x, y, v, mat, pr);
      }
    }
    // the roof: a 1:2 pitch of full blocks and bottom slabs, a glass skylight along the ridge for steel and tech
    for (let v = v0 - 1; v <= v1 + 1; v++) for (let x = -1; x <= w; x++) {
      const i = Math.min(Math.max(0, x), w - 1 - Math.max(0, Math.min(x, w - 1))), y = h + Math.floor(i / 2), mid = Math.abs(x - (w - 1) / 2) <= 1;
      if (S.sky && mid && v > v0 && v < v1) { K.set(x, y, v, 'glass'); continue; }
      if (i % 2 === 0) K.set(x, y, v, S.slab, { type: 0 }); else K.set(x, y, v, S.roof);
    }
    for (let x = 1; x < w - 1; x++) K.set(x, hr(x) - 1 + (Math.min(x, w - 1 - x) % 2 ? 0 : 0), v0 + 1, S.truss, S.trussPr);
    for (let v = v0 + 4; v < v1 - 2; v += 4) for (let x = 1; x < w - 1; x++) if (K.get(x, h - 1, v) === 0) K.set(x, h - 1, v, S.truss, S.trussPr);   // trusses
    // the gable entrance: open four wide and four high, an awning over it, lamps
    const gw = w >= 16 ? 4 : 2, gx0 = cx - (gw >> 1);
    K.box(gx0, 1, v0, gx0 + gw - 1, 4, v0, 0); for (let x = gx0; x < gx0 + gw; x++) K.set(x, 5, v0 - 1, m ? ['vx_awning_red', 'vx_awning_green', 'vx_awning_yellow', 'vx_awning_blue'][x & 3] : 'vx_awning_blue', { facing: 0 });
    K.set(gx0 - 1, 4, v0, 'vm_wall_lantern', { facing: 0, part: 0 }); K.set(gx0 + gw, 4, v0, 'vm_wall_lantern', { facing: 0, part: 0 });
    if (w >= 16) { K.box(gx0, 1, v1, gx0 + gw - 1, 3, v1, 0); K.set(gx0, 1, v1, 'oak_door', { facing: 0, half: 0, hinge: 0, open: 0 }); K.set(gx0, 2, v1, 'oak_door', { facing: 0, half: 1, hinge: 0, open: 0 }); K.set(gx0 + 1, 1, v1, 'oak_door', { facing: 0, half: 0, hinge: 1, open: 0 }); K.set(gx0 + 1, 2, v1, 'oak_door', { facing: 0, half: 1, hinge: 1, open: 0 }); K.set(gx0 + 2, 1, v1, S.wall); K.set(gx0 + 2, 2, v1, S.wall); K.set(gx0 + 2, 3, v1, S.wall); K.set(gx0 + 3, 1, v1, S.wall); K.set(gx0 + 3, 2, v1, S.wall); K.set(gx0 + 3, 3, v1, S.wall); }
    // columns in two rows, lanterns along the aisle
    if (c) for (let v = v0 + 4; v < v1 - 2; v += 4) for (const x of [3, w - 4]) K.col(x, 1, h - 2, S.column, S.columnPr);
    for (let v = v0 + 3; v < v1 - 1; v += 4) K.set(cx, h - 2, v, S.lamp);
    // the stalls: two rows along the aisle with awnings, crates and barrels — or a workshop
    let models = 0;
    if (m) {
      const stalls = ['vx_shop_produce', 'vx_shop_bakery_case', 'vx_shop_shelf_fruit', 'vx_shop_shelf_veg', 'vx_shop_shelf_flowers', 'vx_shop_shelf_bakery', 'vx_shop_deli', 'vx_shop_shelf_sweets'];
      const aw = ['vx_awning_red', 'vx_awning_green', 'vx_awning_yellow', 'vx_awning_blue'];
      for (let v = v0 + 2; v < v1 - 3; v += 4) {
        for (const [x, f] of [[c ? 4 : 2, 1], [c ? w - 5 : w - 3, 3]]) {
          const st = rng.pick(stalls), a = rng.pick(aw);
          for (let i = 0; i < 3; i++) { K.set(x, 1, v + i, st, { facing: f }); K.set(x, 3, v + i, a, { facing: f }); models++; }
          const side = f === 1 ? x - 1 : x + 1;
          if (side > 0 && side < w - 1) { K.set(side, 1, v, rng.chance(0.5) ? 'vx_crate' : 'vx_barrel'); if (rng.chance(0.5)) K.set(side, 1, v + 2, 'vx_veg_crate'); }
        }
      }
      if (K.fits('vm_shop_counter_espresso', cx - 1, 1, v1 - 3, 0)) { K.model('vm_shop_counter_espresso', cx - 1, 1, v1 - 3, 0); K.model('vm_shop_chair_bentwood', cx - 3, 1, v1 - 4, 1); K.model('vm_shop_table_marble', cx - 3, 1, v1 - 5, 0); }
      K.set(cx - 2, 1, v0 + 1, 'vx_flowerbed_tulips'); K.set(cx + 2, 1, v0 + 1, 'vx_flowerbed_roses');
    } else {
      for (let v = v0 + 2; v < v1 - 6; v += 5) { K.set(c ? 5 : 2, 1, v, 'vx_machine', { facing: 1 }); K.set(c ? 5 : 2, 1, v + 2, 'vx_machine', { facing: 1 }); models += 2; }
      for (let v = v0 + 2; v < v1 - 3; v++) K.set(cx + 1, 1, v, 'vx_conveyor', { facing: 0 });
      for (let v = v1 - 6; v < v1 - 1; v += 2) { K.set(w - 3, 1, v, 'vx_cargo'); K.set(w - 3, 2, v, 'vx_crate'); K.set(w - 4, 1, v, 'vx_cargo'); }
      K.set(2, 1, v1 - 2, 'vx_locker', { facing: 1 }); K.set(2, 1, v1 - 3, 'vx_locker', { facing: 1 }); K.model('vm_office_rack_server', 3, 1, v0 + 2, 1); K.model('vm_office_printer3d_enclosed', 2, 1, v0 + 2, 1);
    }
    K.grid.meta = { name: m ? 'Markthalle' : 'Werkhalle', doors: [[cx, 1 + dy, v0]], floors: [dy], top: ridge + 1 + dy, lot: [W, D], anchor: [cx, 0], stalls: models };
    return K.grid;
  });

  // ---------------------------------------------------------------- 🏰
  const CS = {
    stein: { name: 'Stein', wall: 'stone_bricks', wall2: 'mossy_stone_bricks', merlon: 'stone_brick_wall', slab: 'stone_brick_slab', stair: 'stone_brick_stairs', floor: 'cobblestone', path: 'stone_bricks', roof: 'slate', keepWall: 'vx_stonebrick', post: 'spruce_log', lamp: 'vx_lantern', banner: 'red_wool' },
    sandstein: { name: 'Sandstein', wall: 'sandstone', wall2: 'cut_sandstone', merlon: 'sandstone_wall', slab: 'smooth_sandstone_slab', stair: 'smooth_sandstone_stairs', floor: 'smooth_sandstone', path: 'cut_sandstone', roof: 'terracotta', keepWall: 'vx_sandstone', post: 'acacia_log', lamp: 'vx_lantern', banner: 'blue_wool' },
    fels: { name: 'Fels', wall: 'cobblestone', wall2: 'mossy_cobblestone', merlon: 'cobblestone_wall', slab: 'cobblestone_slab', stair: 'cobblestone_stairs', floor: 'coarse_dirt', path: 'gravel', roof: null, keepWall: 'vx_fieldstone', post: 'oak_log', lamp: 'vx_lantern', banner: 'green_wool' },
    dunkel: { name: 'Dunkel', wall: 'deepstone_bricks', wall2: 'cracked_deepstone_bricks', merlon: 'deepstone_brick_wall', slab: 'deepstone_brick_slab', stair: 'deepstone_brick_stairs', floor: 'polished_deepstone', path: 'deepstone_tiles', roof: 'slate', keepWall: 'vx_stonebrick', post: 'dark_oak_log', lamp: 'vx_lantern_crystal', banner: 'purple_wool' },
    backstein: { name: 'Backstein', wall: 'bricks', wall2: 'bricks', merlon: 'brick_wall', slab: 'brick_slab', stair: 'brick_stairs', floor: 'stone_bricks', path: 'granite_paver', roof: 'red', keepWall: 'vx_redbrick', post: 'spruce_log', lamp: 'vx_lantern', banner: 'yellow_wool' },
  };
  Forge.register({
    id: 'castle', icon: '🏰', name: 'Burg', en: 'Castle', level: true, sh: 4,
    params: [
      { k: 'w', label: 'Breite', min: 24, max: 64, def: 36, dim: true },
      { k: 'd', label: 'Tiefe', min: 24, max: 64, def: 36, dim: true },
      { k: 'h', label: 'Mauerhöhe', min: 6, max: 12, def: 8, dim: true },
      { k: 't', label: 'Türme', min: 0, max: 1, def: 1, names: ['eckig', 'rund'] },
      { k: 'k', label: 'Bergfried', min: 0, max: 1, def: 1 },
    ],
    styles: Object.keys(CS).map(id => ({ id, name: CS[id].name })),
    lot: (P) => [P.params.w, P.params.d],
    describe: (P) => [P.params.w + ' × ' + P.params.d, 'Mauer ' + P.params.h + ' hoch', P.params.t ? 'Rundtürme' : 'Ecktürme'].concat(P.params.k ? ['Bergfried'] : []),
  }, function (P, env) {
    const { w, d, h, t, k } = P.params, S = CS[P.style] || CS.stein, rng = Forge.rng(P, 'castle');
    // the keep (Bergfried) is the castle's tallest tower: its battlements stand a few rows over the corner towers' tops
    const TW = 7, towerH = h + 5, KSH = 4, KF = Math.max(3, Math.ceil((towerH + 5) / KSH)), ktop = KF * KSH;
    const KROOMS = ['salon', 'master', 'dining', 'library', 'study', 'guest', 'bedroom'];   // the knights' hall, the lord's chamber with a bath, …
    const dy = -1, K = Forge.kit(w, Math.max(towerH + 8, k ? ktop + 7 : 0), d, dy), cx = w >> 1;
    const stone = (x, y, z) => K.set(x, y, z, rng.chance(0.12) ? S.wall2 : S.wall);
    K.box(0, 0, 0, w - 1, 0, d - 1, 'grass_block'); K.box(0, 1, 0, w - 1, K.sy - 1, d - 1, 0);
    // ---- the curtain wall: two thick, the walk on top (row h − 1), merlons outside every other cell, a low parapet inside
    const inWall = (x, z) => x < 2 || z < 2 || x >= w - 2 || z >= d - 2;
    for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
      if (!inWall(x, z)) { K.set(x, 0, z, S.floor); continue; }
      K.set(x, 0, z, S.wall);
      for (let y = 1; y < h - 1; y++) stone(x, y, z);
      K.set(x, h - 1, z, S.slab, { type: 2 });
      const outer = x === 0 || z === 0 || x === w - 1 || z === d - 1, i = (x === 0 || x === w - 1) ? z : x;
      if (outer && (i & 1) === 0) K.set(x, h, z, S.merlon);
    }
    // ---- the corner towers: 7 × 7 (round: corners cut), a spiral stair inside, doors to the courtyard and onto the walk, a roof
    const corners = [[0, 0], [w - TW, 0], [0, d - TW], [w - TW, d - TW]];
    for (const [tx, tz] of corners) {
      const ccx = tx + 3, ccz = tz + 3, round = t === 1;
      for (let z = tz; z < tz + TW; z++) for (let x = tx; x < tx + TW; x++) {
        const dx = Math.abs(x - ccx), dz = Math.abs(z - ccz), cut = round && dx === 3 && dz === 3, edge = dx === 3 || dz === 3;
        if (cut) { K.box(x, 1, z, x, towerH + 2, z, 0); continue; }
        if (edge) { for (let y = 1; y <= towerH; y++) stone(x, y, z); K.set(x, towerH + 1, z, ((x + z) & 1) ? S.merlon : S.slab, ((x + z) & 1) ? undefined : { type: 0 }); }
        else { K.set(x, 0, z, S.floor); K.box(x, 1, z, x, towerH, z, 0); K.set(x, towerH, z, S.slab, { type: 2 }); }
      }
      // the spiral, the landing slabs at the walk level, the roof
      const steps = K.spiral(ccx, 0, ccz, towerH, S.stair, null, S.wall);
      for (const [x, y, z] of steps) if (y - 1 >= 1 && K.get(x, y - 1, z) === 0) K.set(x, y - 1, z, S.wall);
      for (let z = tz + 1; z < tz + TW - 1; z++) for (let x = tx + 1; x < tx + TW - 1; x++) if (Math.max(Math.abs(x - ccx), Math.abs(z - ccz)) === 2 && K.get(x, h - 1, z) === 0) K.set(x, h - 1, z, S.slab, { type: 0 });
      steps.forEach(([x, y, z], i) => { if (y === towerH) K.set(x, y, z, S.stair, { facing: [1, 1, 2, 2, 3, 3, 0, 0][i & 7], half: 0 }); else if (y >= towerH - 2) K.air(x, towerH, z); });
      // doors: into the courtyard (the face toward the inside) and onto the wall walk (through the two faces the walk meets)
      const inX = tx === 0 ? tx + TW - 1 : tx, inZ = tz === 0 ? tz + TW - 1 : tz;
      K.box(inX, 1, ccz, inX, 2, ccz, 0); K.box(ccx, 1, inZ, ccx, 2, inZ, 0);
      K.box(inX, h, tz === 0 ? tz + 1 : tz + TW - 2, inX, h + 1, tz === 0 ? tz + 1 : tz + TW - 2, 0);
      K.box(tx === 0 ? tx + 1 : tx + TW - 2, h, inZ, tx === 0 ? tx + 1 : tx + TW - 2, h + 1, inZ, 0);
      if (S.roof) { let rr = 3, y = towerH + 2; while (rr >= 0) { for (let z = ccz - rr; z <= ccz + rr; z++) for (let x = ccx - rr; x <= ccx + rr; x++) { if (Math.max(Math.abs(x - ccx), Math.abs(z - ccz)) !== rr) continue; if (round && rr === 3 && Math.abs(x - ccx) === 3 && Math.abs(z - ccz) === 3) continue; const f = Math.abs(x - ccx) > Math.abs(z - ccz) ? (x < ccx ? 1 : 3) : (z < ccz ? 2 : 0); if (rr === 0) K.set(x, y, z, 'vx_ridge_' + S.roof, { facing: 0 }); else K.set(x, y, z, 'vx_roof_' + S.roof, { facing: f }); } rr--; y++; } }
      else K.set(ccx, towerH + 1, ccz, S.lamp);
      K.set(ccx, h + 2, ccz, S.lamp);
    }
    // the wall walk must stay open where it meets a tower: clear the walk rows beside each tower on both faces
    for (const [tx, tz] of corners) { const zz = tz === 0 ? tz + TW : tz - 1, xx = tx === 0 ? tx + TW : tx - 1; K.box(tx === 0 ? 0 : w - 2, h, zz, tx === 0 ? 1 : w - 1, h + 2, zz, 0); K.box(xx, h, tz === 0 ? 0 : d - 2, xx, h + 2, tz === 0 ? 1 : d - 1, 0); }
    // ---- the gatehouse: two square towers flanking a three-wide passage, an arch, a raised portcullis, banners
    for (const gx of [cx - 5, cx + 2]) for (let z = 0; z < 5; z++) for (let x = gx; x < gx + 4; x++) { for (let y = 1; y <= h + 3; y++) stone(x, y, z); K.set(x, h + 4, z, ((x + z) & 1) ? S.merlon : S.slab, ((x + z) & 1) ? undefined : { type: 0 }); }
    K.box(cx - 1, 1, 0, cx + 1, 3, 1, 0); K.box(cx - 1, 4, 0, cx + 1, 4, 1, S.stair, { facing: 0, half: 1 }); K.set(cx, 4, 0, S.wall); K.set(cx, 4, 1, S.wall);
    for (let x = cx - 1; x <= cx + 1; x++) { K.set(x, 5, 0, 'iron_bars'); K.set(x, 6, 0, 'iron_bars'); }
    K.box(cx - 1, 0, 0, cx + 1, 0, 3, S.path);
    for (const gx of [cx - 5, cx + 2]) { K.col(gx + 1, 0, h + 5, h + 7, S.post, { axis: 0 }); K.set(gx + 1, h + 6, 1, S.banner); K.set(gx + 1, h + 5, 1, S.banner); K.set(gx + 2, 3, 0, S.lamp); }
    K.box(cx - 5, h, 0, cx + 5, h + 2, 1, 0); K.box(cx - 1, h, 0, cx + 1, h + 2, 1, 0);   // the walk passes over the gate
    for (let x = cx - 5; x <= cx + 5; x++) { K.set(x, h - 1, 0, S.slab, { type: 2 }); K.set(x, h - 1, 1, S.slab, { type: 2 }); if ((x & 1) === 0) K.set(x, h, 0, S.merlon); }
    // ---- the courtyard: paths, the well, stables, a smithy, lanterns
    K.box(cx - 1, 0, 2, cx + 1, 0, d - 4, S.path);
    const wx = cx + 6, wz = (d >> 1); K.set(wx, 1, wz, 'vx_well'); K.box(wx - 1, 0, wz - 1, wx + 1, 0, wz + 1, S.path);
    for (let z = TW + 2; z < d - TW - 2; z += 2) { K.set(2, 1, z, 'vx_hay'); if (z % 4 === 0) K.set(3, 1, z, 'vx_trough'); K.set(3, 1, z + 1, 'oak_fence'); }
    for (let z = TW + 2; z < d - TW - 2; z += 3) { K.col(4, z, 1, 3, S.post, { axis: 0 }); K.box(2, 4, z, 4, 4, z + 2, 'spruce_slab', { type: 0 }); }
    K.set(w - 3, 1, d - TW - 3, 'vx_stove', { facing: 3 }); K.set(w - 4, 1, d - TW - 3, 'anvil'); K.set(w - 3, 1, d - TW - 4, 'vx_barrel'); K.set(w - 4, 1, d - TW - 5, 'vx_crate');
    for (let z = 4; z < d - 4; z += 6) { K.set(2, 1, z, S.lamp); K.set(w - 3, 1, z, S.lamp); }
    for (let x = 4; x < w - 4; x += 6) K.set(x, h + 1, 1, S.lamp);
    // ---- the keep: 11 × 11 at the back, four to six floors with a scissor stair up onto its battlements, furnished
    const doors = [[cx, 1 + dy, 0]];
    if (k) {
      const kw = 11, kd = 11, kx = cx - 5, kz = d - 3 - kd, SH = KSH, KW = S.keepWall;
      for (let z = kz; z < kz + kd; z++) for (let x = kx; x < kx + kw; x++) {
        const ring = x === kx || x === kx + kw - 1 || z === kz || z === kz + kd - 1;
        for (let kf = 0; kf < KF; kf++) { const y0 = kf * SH; K.set(x, y0, z, ring ? S.wall : 'vx_floor_oak'); for (let y = y0 + 1; y < y0 + SH; y++) { if (ring) K.set(x, y, z, KW); else K.air(x, y, z); } }
        K.set(x, ktop, z, ring ? S.wall : S.slab, ring ? undefined : { type: 2 });
        if (ring) K.set(x, ktop + 1, z, ((x + z) & 1) ? S.merlon : S.slab, ((x + z) & 1) ? undefined : { type: 0 });
      }
      for (let kf = 0; kf < KF; kf++) { const y = 2 + kf * SH; for (const [x, z, f] of [[kx, kz + 5, 3], [kx + kw - 1, kz + 5, 1], [kx + 3, kz + kd - 1, 2], [kx + 7, kz + kd - 1, 2], [kx + 3, kz, 0], [kx + 7, kz, 0]]) K.set(x, y, z, 'vx_window_arch', { facing: f }); }
      K.box(kx + 5, 1, kz, kx + 5, 2, kz, 0); K.door(kx + 5, 1, kz, 2, 'spruce_door', 0); K.set(kx + 4, 3, kz, S.lamp); K.set(kx + 6, 3, kz, S.lamp);
      const ksw = K.stairwell(kx + 1, 0, kz + 2, KF + 1, SH, S.stair, S.wall, 'oak_fence', false);   // every floor and up onto the battlements
      const rooms = [];
      const mkR = (fi, type, u0, v0, u1, v1, dr) => ({ fi, type, u0, v0, u1, v1, doors: dr, windows: [] });
      for (let kf = 0; kf < KF; kf++) {
        const stairDoors = []; for (let z = 1; z <= 6; z++) for (let x = 1; x <= 2; x++) stairDoors.push({ u: x, v: z, side: 0 });
        const r = mkR(kf, KROOMS[Math.min(kf, KROOMS.length - 1)], 1, 1, kw - 2, kd - 2, stairDoors.concat(kf === 0 ? [{ u: 5, v: 1, side: 0 }] : []));
        if (kf === 1) r.zones = [{ u0: 1, v0: 1, u1: 4, v1: kd - 2, type: 'master' }, { u0: 5, v0: 1, u1: kw - 2, v1: kd - 2, type: 'bath' }];
        rooms.push(r);
      }
      const H = { u0: kx, v0: kz, w: kw, d: kd, floors: [], entry: { u: 5, n: 1 } };
      for (let kf = 0; kf < KF; kf++) H.floors.push({ y: kf * SH, rect: [0, 0, kw - 1, kd - 1], rooms: [rooms[kf]] });
      K.furnish(H, 0, 'classic', rng, SH);
      K.set(kx + 5, ktop + 2, kz + 5, S.post); K.set(kx + 5, ktop + 3, kz + 5, S.banner); K.set(kx + 5, ktop + 4, kz + 5, S.banner);
    }
    K.grid.meta = { name: 'Burg', doors, floors: [0], top: K.sy - 1 + dy, walk: h - 1 + dy, towerTop: towerH + dy, keep: k ? { floors: Array.from({ length: KF }, (_, i) => i * KSH + dy), roof: ktop + dy } : null, lot: [w, d], anchor: [cx, 0] };
    return K.grid;
  });
  // ---------------------------------------------------------------- 🏟
  const SS = {
    beton: { name: 'Beton', body: 'concrete_smooth', stair: 'concrete_smooth_stairs', tier: 'light_gray_concrete', wall: 'concrete_smooth', roof: 'charcoal_panel', roofGlass: 'glass', mast: 'black_metal', seat: ['red_concrete', 'blue_concrete', 'white_concrete'], glass: 'window_black', screen: 'vx_holo_screen' },
    stahl: { name: 'Stahl', body: 'light_gray_concrete', stair: 'stone_brick_stairs', tier: 'light_gray_concrete', wall: 'charcoal_panel', roof: 'black_metal', roofGlass: 'glass', mast: 'black_metal', seat: ['yellow_concrete', 'black_concrete', 'white_concrete'], glass: 'window_black', screen: 'vx_holo_screen' },
    tech: { name: 'Tech', body: 'vx_tech_gray', stair: 'concrete_smooth_stairs', tier: 'vx_tech_white', wall: 'vx_tech_white', roof: 'vx_tech_band', roofGlass: 'vx_glass_wall', mast: 'vx_tech_trim', seat: ['cyan_concrete', 'white_concrete', 'black_concrete'], glass: 'vx_window_tech', screen: 'vx_holo_screen' },
    backstein: { name: 'Backstein', body: 'bricks', stair: 'brick_stairs', tier: 'stone_bricks', wall: 'bricks', roof: 'roof_charcoal', roofGlass: 'glass', mast: 'black_metal', seat: ['red_concrete', 'white_concrete', 'red_concrete'], glass: 'window_warm', screen: 'vx_holo_screen_amber' },
  };
  Forge.register({
    id: 'stadium', icon: '🏟', name: 'Stadion', en: 'Stadium', level: true, sh: 1,
    params: [
      { k: 'l', label: 'Länge', min: 50, max: 110, def: 84, dim: true, step: 2 },
      { k: 'w', label: 'Breite', min: 40, max: 80, def: 60, dim: true, step: 2 },
      { k: 't', label: 'Ränge', min: 4, max: 12, def: 7 },
      { k: 'r', label: 'Dach', min: 0, max: 1, def: 1 },
      { k: 'k', label: 'Sport', min: 0, max: 1, def: 0, names: ['Fußball', 'Leichtathletik'] },
    ],
    styles: Object.keys(SS).map(id => ({ id, name: SS[id].name })),
    lot: (P) => [P.params.w, P.params.l],
    title: (P) => (P.params.k ? 'Leichtathletikstadion' : 'Fußballstadion'),
    describe: (P) => [P.params.l + ' × ' + P.params.w, P.params.t + ' Ränge'].concat(P.params.r ? ['Dach'] : []),
  }, function (P, env) {
    const { l, w, t, r, k } = P.params, S = SS[P.style] || SS.beton, rng = Forge.rng(P, 'stadium');
    const dy = -1, depth = 2 * t + 4, H = t + (r ? 8 : 3) + 2, K = Forge.kit(w, H + 16, l, dy);
    const px0 = depth, px1 = w - 1 - depth, pz0 = depth, pz1 = l - 1 - depth, cx = (w - 1) / 2, cz = (l - 1) / 2;
    K.box(0, 0, 0, w - 1, 0, l - 1, 'grass_block'); K.box(0, 1, 0, w - 1, H + 15, l - 1, 0);
    // the pitch: grass with white lines (outline, halfway line, centre circle, the boxes), goals; a track ring for athletics
    const track = k ? 5 : 0, ix0 = px0 + track, ix1 = px1 - track, iz0 = pz0 + track, iz1 = pz1 - track;
    const line = (x, z) => K.set(x, 0, z, 'white_concrete');
    for (let z = pz0; z <= pz1; z++) for (let x = px0; x <= px1; x++) K.set(x, 0, z, k && (x < ix0 || x > ix1 || z < iz0 || z > iz1) ? 'red_concrete' : 'grass_block');
    if (k) { for (let i = 1; i < 5; i++) { for (let z = pz0 + i; z <= pz1 - i; z++) { if ((z & 1) === 0) { line(px0 + i, z); line(px1 - i, z); } } for (let x = px0 + i; x <= px1 - i; x++) if ((x & 1) === 0) { line(x, pz0 + i); line(x, pz1 - i); } } }
    for (let z = iz0; z <= iz1; z++) { line(ix0, z); line(ix1, z); } for (let x = ix0; x <= ix1; x++) { line(x, iz0); line(x, iz1); line(x, Math.round(cz)); }
    const cr = Math.max(4, Math.round((ix1 - ix0) / 7)); for (let a = 0; a < 48; a++) line(Math.round(cx + Math.cos(a / 48 * Math.PI * 2) * cr), Math.round(cz + Math.sin(a / 48 * Math.PI * 2) * cr));
    const bw = Math.round((ix1 - ix0) * 0.6), bd = Math.max(4, Math.round((iz1 - iz0) / 7)), bx0 = Math.round(cx - bw / 2), bx1 = Math.round(cx + bw / 2);
    for (const [za, zb] of [[iz0, iz0 + bd], [iz1 - bd, iz1]]) { for (let x = bx0; x <= bx1; x++) { line(x, za); line(x, zb); } for (let z = za; z <= zb; z++) { line(bx0, z); line(bx1, z); } }
    for (const z of [iz0, iz1]) { for (let x = Math.round(cx) - 3; x <= Math.round(cx) + 3; x++) { K.set(x, 3, z, 'white_concrete'); for (let y = 1; y <= 2; y++) K.set(x, y, z, 'iron_bars'); } K.col(Math.round(cx) - 3, z, 1, 3, 'white_concrete'); K.col(Math.round(cx) + 3, z, 1, 3, 'white_concrete'); }
    // the stands: tiers of stairs rising outward from the pitch's edge, a walkway and an outer wall; rounded corners
    const dist = (x, z) => { const dx = x < px0 ? px0 - x : x > px1 ? x - px1 : 0, dz = z < pz0 ? pz0 - z : z > pz1 ? z - pz1 : 0; return Math.hypot(dx, dz); };
    const side = (x, z) => { const dx = x < px0 ? px0 - x : x > px1 ? x - px1 : 0, dz = z < pz0 ? pz0 - z : z > pz1 ? z - pz1 : 0; return dx > dz ? (x < px0 ? 1 : 3) : (z < pz0 ? 2 : 0); };   // the stairs face the pitch
    for (let z = 0; z < l; z++) for (let x = 0; x < w; x++) {
      const d = dist(x, z); if (d < 1) continue;
      const k2 = Math.round(d) - 1;                                   // 0 = the first tier
      if (k2 >= depth) continue;
      const y = 1 + Math.floor(Math.min(k2, 2 * t - 1) / 2);
      for (let yy = 1; yy < y; yy++) K.set(x, yy, z, S.body);
      if (k2 < 2 * t) { if ((k2 & 1) === 0) K.set(x, y, z, S.stair, { facing: side(x, z), half: 0 }); else K.set(x, y, z, S.seat[Math.floor(k2 / 2) % S.seat.length]); }
      else if (k2 < 2 * t + 3) { K.set(x, y, z, S.tier); if (k2 === 2 * t + 1 && (x + z) % 7 === 0) K.set(x, y + 1, z, 'vx_lamppost_black'); }
      else { K.col(x, z, y, y + 2, S.wall); if ((x + z) % 4 === 0 && d > 1) K.set(x, y + 1, z, S.glass); }
    }
    // four entrances through the outer wall and the walkway (the stand floor at the walkway is the top tier's height)
    const topY = 1 + Math.floor((2 * t - 1) / 2);
    for (const [x, z, dx, dz] of [[Math.round(cx), 0, 0, 1], [Math.round(cx), l - 1, 0, -1], [0, Math.round(cz), 1, 0], [w - 1, Math.round(cz), -1, 0]]) {
      for (let i = 0; i < 4; i++) for (let a = -1; a <= 1; a++) { const xx = x + dx * i + (dz ? a : 0), zz = z + dz * i + (dx ? a : 0); K.box(xx, topY + 1, zz, xx, topY + 3, zz, 0); K.set(xx, topY, zz, S.tier); }
      for (let a = -2; a <= 2; a += 4) { const xx = x + (dz ? a : 0), zz = z + (dx ? a : 0); K.col(xx, zz, topY + 1, topY + 4, S.mast); }
    }
    // the roof: a cantilevered band over the upper tiers on columns, glass at its inner edge; floodlight masts at the corners
    if (r) {
      const ry = topY + 6;
      for (let z = 0; z < l; z++) for (let x = 0; x < w; x++) { const d = dist(x, z); if (d < t + 1 || d > depth + 1) continue; K.set(x, ry, z, d < t + 3 ? S.roofGlass : S.roof); }
      for (let z = 0; z < l; z++) for (let x = 0; x < w; x++) { const d = dist(x, z); if (Math.round(d) !== 2 * t + 3 || (x + z) % 8 !== 0) continue; K.col(x, z, topY + 1, ry - 1, S.mast); }
    }
    for (const [x, z] of [[2, 2], [w - 3, 2], [2, l - 3], [w - 3, l - 3]]) { K.col(x, z, 1, topY + 12, S.mast); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) K.set(x + a, topY + 13, z + b, 'light_panel'); K.set(x, topY + 14, z, 'vx_lamppost_tech'); }
    // the scoreboard at one end
    for (let x = Math.round(cx) - 3; x <= Math.round(cx) + 3; x++) for (let y = topY + 3; y <= topY + 5; y++) K.set(x, y, 1, S.screen, { facing: 2 });
    K.grid.meta = { name: k ? 'Leichtathletikstadion' : 'Fußballstadion', doors: [[Math.round(cx), topY + 1 + dy, 0]], floors: [dy, topY + dy], top: topY + 14 + dy, lot: [w, l], anchor: [w >> 1, 0] };
    void rng;
    return K.grid;
  });
})(VR);
