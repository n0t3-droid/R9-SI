// ============================================================================
// 🌳 Park / Garten and 🚀 Shuttle. The park: a ring path with cross paths from
// four entrances, a fountain or a round bed in the middle, a pond with a sand
// rim, lily pads and a little deck, trees by density and style, benches along
// the ring facing in, lamps at the path corners, flower beds, a hedge rim, a
// picnic lawn with tables and a hammock in the big ones. Four looks: Stadt
// (pavers, black lamps, oaks and birches), Landhaus (gravel, fruit trees),
// Tech (plaza tiles, tech lamps), Japan (gravel, cherry trees, a red bridge).
// The shuttle: one of the game's own starship designs (ShipGen), landed on
// its gear, optionally on a landing pad with hazard stripes and beacons —
// empty cells keep the world, so it sits on any ground.
// ============================================================================
(function (VR) {
  'use strict';
  const Forge = VR.Forge; if (!Forge || !Forge.kit) return;
  const PS = {
    stadt: { name: 'Stadt', path: 'paver_grey', edge: 'granite_paver', lamp: 'vx_lamppost_black', bench: 'vx_bench', trees: ['oak', 'birch'], bed: ['vx_flowerbed_tulips', 'vx_flowerbed_roses', 'vx_flowerbed'], plinth: 'granite_paver' },
    landhaus: { name: 'Landhaus', path: 'gravel', edge: 'dirt_path', lamp: 'vx_lamppost', bench: 'vx_bench', trees: ['oak', 'oak', 'birch'], bed: ['vx_flowerbed', 'vx_flowerbed_roses'], plinth: 'cobblestone' },
    tech: { name: 'Tech', path: 'vx_floor_plaza', edge: 'vx_floor_plaza_line', lamp: 'vx_lamppost_tech', bench: 'vx_bench', trees: ['birch', 'birch', 'oak'], bed: ['vx_tech_planter', 'vx_flowerbed_tulips'], plinth: 'vx_floor_hex' },
    japan: { name: 'Japan', path: 'gravel', edge: 'smooth_stone', lamp: 'vx_lamppost', bench: 'vx_bench', trees: ['cherry', 'cherry', 'oak'], bed: ['vx_flowerbed_roses', 'azalea'], plinth: 'smooth_stone' },
  };
  Forge.register({
    id: 'park', icon: '🌳', name: 'Park', en: 'Park', level: true, sh: 1,
    params: [
      { k: 'w', label: 'Breite', min: 16, max: 64, def: 28, dim: true },
      { k: 'd', label: 'Tiefe', min: 16, max: 64, def: 28, dim: true },
      { k: 't', label: 'Bäume', min: 1, max: 3, def: 2, names: ['wenige', 'einige', 'viele'] },
      { k: 'p', label: 'Teich', min: 0, max: 1, def: 1 },
      { k: 'f', label: 'Brunnen', min: 0, max: 1, def: 1 },
    ],
    styles: Object.keys(PS).map(id => ({ id, name: PS[id].name })),
    lot: (P) => [P.params.w, P.params.d],
    describe: (P) => [P.params.w + ' × ' + P.params.d, ['wenige', 'einige', 'viele'][P.params.t - 1] + ' Bäume'].concat(P.params.p ? ['Teich'] : [], P.params.f ? ['Brunnen'] : []),
  }, function (P, env) {
    const { w, d, t, p, f } = P.params, S = PS[P.style] || PS.stadt, rng = Forge.rng(P, 'park');
    const dy = -1, K = Forge.kit(w, 12, d, dy), cx = w >> 1, cz = d >> 1, ins = 3;
    K.box(0, 0, 0, w - 1, 0, d - 1, 'grass_block'); K.box(0, 1, 0, w - 1, 11, d - 1, 0);
    const path = new Uint8Array(w * d), onPath = (x, z) => x >= 0 && z >= 0 && x < w && z < d && path[z * w + x] === 1;
    const lay = (x, z) => { if (x < 0 || z < 0 || x >= w || z >= d) return; path[z * w + x] = 1; K.set(x, 0, z, S.path); };
    // the ring (two wide), the cross paths and the four entrances
    for (let z = ins; z < d - ins; z++) for (let x = ins; x < w - ins; x++) { const e = x <= ins + 1 || x >= w - ins - 2 || z <= ins + 1 || z >= d - ins - 2; if (e) lay(x, z); }
    for (let z = 0; z < d; z++) { lay(cx, z); lay(cx - 1, z); } for (let x = 0; x < w; x++) { lay(x, cz); lay(x, cz - 1); }
    // the centre: a fountain on its plinth, or a round flower bed
    for (let z = cz - 3; z <= cz + 2; z++) for (let x = cx - 3; x <= cx + 2; x++) { const dd = Math.hypot(x - cx + 0.5, z - cz + 0.5); if (dd <= 3.2) lay(x, z); }
    if (f) { for (let z = cz - 2; z <= cz + 1; z++) for (let x = cx - 2; x <= cx + 1; x++) K.set(x, 0, z, S.plinth); K.set(cx - 1, 1, cz - 1, 'vx_fountain'); K.set(cx, 1, cz - 1, 'vx_fountain'); K.set(cx - 1, 1, cz, 'vx_fountain'); K.set(cx, 1, cz, 'vx_fountain'); }
    else { for (let z = cz - 2; z <= cz + 1; z++) for (let x = cx - 2; x <= cx + 1; x++) { const dd = Math.hypot(x - cx + 0.5, z - cz + 0.5); K.set(x, 0, z, dd <= 1.6 ? 'grass_block' : S.path); if (dd <= 1.6) K.set(x, 1, z, rng.pick(S.bed)); } }
    // the pond in the back-right quarter: water with a sand rim, lily pads, a deck with a bench (a red bridge in Japan)
    if (p) {
      const px0 = Math.min(w - ins - 5, cx + 3), pz0 = Math.min(d - ins - 5, cz + 2), pw = Math.min(8, w - ins - 3 - px0), pd = Math.min(5, d - ins - 3 - pz0);
      for (let z = pz0 - 1; z <= pz0 + pd; z++) for (let x = px0 - 1; x <= px0 + pw; x++) { const inW = x >= px0 && x < px0 + pw && z >= pz0 && z < pz0 + pd; if (onPath(x, z)) continue; K.set(x, 0, z, inW ? 'water' : 'sand'); if (inW && rng.chance(0.15)) K.set(x, 1, z, 'lily_pad'); }
      if (P.style === 'japan') { for (let x = px0 - 1; x <= px0 + pw; x++) { K.set(x, 1, pz0 + 2, 'oak_planks'); K.set(x, 2, pz0 + 2 - 1 < 0 ? 0 : pz0 + 1, x === px0 - 1 || x === px0 + pw ? 'red_wool' : 'oak_fence'); K.set(x, 2, pz0 + 3, x === px0 - 1 || x === px0 + pw ? 'red_wool' : 'oak_fence'); } }
      else { for (let x = px0; x < px0 + 3; x++) K.set(x, 0, pz0 - 1, 'deck_wood'); K.set(px0 + 1, 1, pz0 - 1, S.bench, { facing: 2 }); }
    }
    // trees on the lawn, away from paths and water
    const free = (x, z) => x > 0 && z > 0 && x < w - 1 && z < d - 1 && !onPath(x, z) && K.get(x, 0, z) === Forge.st('grass_block') && K.get(x, 1, z) === 0;
    const clear = (x, z, r) => { for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) if (!(a === 0 && b === 0) && (onPath(x + a, z + b) || K.get(x + a, 0, z + b) === Forge.st('water'))) return false; return true; };
    const nTrees = Math.max(4, Math.round(t * w * d / 150));
    let placed = 0;
    for (let i = 0; i < nTrees * 30 && placed < nTrees; i++) {
      const x = 2 + rng.int(w - 4), z = 2 + rng.int(d - 4);
      if (!free(x, z) || !clear(x, z, 2)) continue;
      let ok = true; for (let b = -3; b <= 3 && ok; b++) for (let a = -3; a <= 3; a++) { const s = K.get(x + a, 1, z + b); if (s && s !== K.KEEP && /_log$/.test(VR.R.types[VR.R.T.type[s]].name)) { ok = false; break; } }
      if (!ok) continue;
      K.tree(x, 1, z, rng.pick(S.trees), rng, t === 3 && rng.chance(0.4)); placed++;
    }
    // benches along the ring facing in, lamps at the corners and entrances, flower beds beside the paths
    const bench = (x, z, facing) => { if (K.get(x, 1, z) === 0 && !onPath(x, z)) K.set(x, 1, z, S.bench, { facing }); };
    for (let x = ins + 4; x < w - ins - 4; x += 6) { bench(x, ins - 1, 2); bench(x, d - ins, 0); }
    for (let z = ins + 4; z < d - ins - 4; z += 6) { bench(ins - 1, z, 1); bench(w - ins, z, 3); }
    for (const [x, z] of [[ins - 1, ins - 1], [w - ins, ins - 1], [ins - 1, d - ins], [w - ins, d - ins], [cx + 1, 1], [cx - 2, d - 2], [1, cz + 1], [w - 2, cz - 2]]) if (K.get(x, 1, z) === 0) K.set(x, 1, z, S.lamp);
    for (let x = ins + 2; x < w - ins - 2; x += 3) { if (!onPath(x, ins + 2) && K.get(x, 1, ins + 2) === 0) K.set(x, 1, ins + 2, rng.pick(S.bed)); if (!onPath(x, d - ins - 3) && K.get(x, 1, d - ins - 3) === 0) K.set(x, 1, d - ins - 3, rng.pick(S.bed)); }
    // the picnic lawn in the front-left quarter of the big parks, a hedge rim with the entrances left open, wildflowers
    if (w >= 32 && d >= 24) { if (K.fits('vm_garden_hammock_stand', ins + 3, 1, ins + 4, 0)) K.model('vm_garden_hammock_stand', ins + 3, 1, ins + 4, 0); for (const [x, z] of [[ins + 3, ins + 7], [ins + 6, ins + 7]]) if (K.get(x, 1, z) === 0 && !onPath(x, z)) K.set(x, 1, z, 'vx_picnic_table', { facing: 0 }); if (K.get(ins + 8, 1, ins + 4) === 0) K.set(ins + 8, 1, ins + 4, 'vx_birdbath'); }
    for (let z = 0; z < d; z++) for (const x of [0, w - 1]) if (!onPath(x, z) && K.get(x, 1, z) === 0) K.set(x, 1, z, 'vx_hedge');
    for (let x = 0; x < w; x++) for (const z of [0, d - 1]) if (!onPath(x, z) && K.get(x, 1, z) === 0) K.set(x, 1, z, 'vx_hedge');
    const flowers = ['poppy', 'dandelion', 'cornflower', 'oxeye_daisy', 'azure_bluet', 'short_grass', 'short_grass'];
    for (let z = 1; z < d - 1; z++) for (let x = 1; x < w - 1; x++) if (free(x, z) && rng.chance(0.08)) K.set(x, 1, z, rng.pick(flowers));
    K.grid.meta = { name: 'Park', doors: [[cx, 1 + dy, 0], [cx, 1 + dy, d - 1], [0, 1 + dy, cz], [w - 1, 1 + dy, cz]], floors: [dy], top: 8, lot: [w, d], anchor: [cx, 0], trees: placed };
    return K.grid;
  });

  // ---------------------------------------------------------------- 🚀
  // A ship of the game's own starship generator, landed: on a pad with a hazard ring (p), under an open hangar with a
  // gantry (h), with a ground station beside it — a control booth with consoles and a dish, fuel, cargo (s) — a gangway
  // of hull stairs up to the ship's hatch (g, so you walk aboard), beacons and lamps (m). Five liveries.
  const ARCHS = ['shuttle', 'interceptor', 'gunship', 'racer', 'dropship', 'freighter', 'cruiser', 'carrier'];
  const ANAMES = ['Shuttle', 'Interceptor', 'Gunship', 'Racer', 'Dropship', 'Frachter', 'Kreuzer', 'Träger'];
  const PAL = [['sf', 'starforge', 'Starforge'], ['nw', 'nightwing', 'Nightwing'], ['ss', 'sunstrike', 'Sunstrike'], ['rh', 'hauler', 'Rust Hauler'], ['as', 'arctic', 'Arctic Survey']];
  const STATION = 7;   // the ground station's strip beside the pad
  Forge.register({
    id: 'shuttle', icon: '🚀', name: 'Raumschiff', en: 'Spaceship', level: true, sh: 1,
    params: [
      { k: 'a', label: 'Bauart', min: 0, max: 7, def: 0, names: ANAMES },
      { k: 'p', label: 'Landeplatz', min: 0, max: 1, def: 1 },
      { k: 'h', label: 'Hangar', min: 0, max: 1, def: 0 },
      { k: 's', label: 'Bodenstation', min: 0, max: 1, def: 1 },
      { k: 'g', label: 'Gangway', min: 0, max: 1, def: 1 },
      { k: 'm', label: 'Leuchtfeuer', min: 0, max: 1, def: 1 },
    ],
    styles: PAL.map(([id, , name]) => ({ id, name, words: [name.toLowerCase(), id] })),
    lot: (P) => { if (!VR.ShipGen) return [21 + 6 + (P.params.s ? STATION : 0), 34]; return layout(P).lot; },
    describe: (P) => [ANAMES[P.params.a]].concat(P.params.p ? ['Landeplatz'] : [], P.params.h ? ['Hangar'] : [], P.params.s ? ['Bodenstation'] : [], P.params.g && (!VR.ShipGen || layout(P).hatch) ? ['Gangway'] : []),
  }, function (P, env) {
    const L = layout(P), bp = L.bp, { W, D, ox, oz, pad } = L, { h, s, g, m } = P.params;
    const top = bp.sy + 1 + (h ? 4 : 0), dy = -1, K = Forge.kit(W, top + 4, D, dy);
    const shipAt = (x, y, z) => { const a = x - ox, c = z - oz, b = y - 1; return a >= 0 && b >= 0 && c >= 0 && a < bp.sx && b < bp.sy && c < bp.sz ? bp.blocks[(b * bp.sz + c) * bp.sx + a] : 0; };
    // the apron: the pad (a disc of landing plates in a hazard ring on plaza tiles) — without one the ship stands on the
    // levelled ground itself
    const px0 = ox - pad, px1 = ox + bp.sx - 1 + pad, cx = (px0 + px1) / 2, cz = (D - 1) / 2;
    if (P.params.p) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const inPad = x >= px0 && x <= px1, dd = Math.hypot((x - cx) / Math.max(1, (px1 - px0 + 1) / 2), (z - cz) / Math.max(1, D / 2));
      K.set(x, 0, z, inPad && dd <= 0.84 ? 'landing_pad' : inPad && dd <= 1.04 ? 'hazard_stripes' : 'vx_floor_plaza');
    }
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) for (let y = 1; y < top + 4; y++) K.air(x, y, z);
    if (P.params.p) K.set(Math.round(cx), 0, 0, 'vx_floor_pad');
    // the ship
    for (let y = 0; y < bp.sy; y++) for (let z = 0; z < bp.sz; z++) for (let x = 0; x < bp.sx; x++) { const st = bp.blocks[(y * bp.sz + z) * bp.sx + x]; if (st) K.set(x + ox, y + 1, z + oz, st); }
    // the gangway: hull stairs from the apron up to the deck where the ship opens (see exitOf), railings on both sides
    const doors = [];
    if (g && L.hatch) {
      const { x: hx, y: hy, z: hz, d, n } = L.hatch, lane = [Math.abs(d[1]), Math.abs(d[0])];   // the deck cell (grid; feet row hy), outward
      const facing = d[0] < 0 ? 1 : d[0] > 0 ? 3 : d[1] > 0 ? 0 : 2;                              // the steps rise toward the ship
      for (let j = 0; j < (L.hatch.cut || 0); j++) for (let k = 0; k < n; k++) { const x = hx - d[0] * j + lane[0] * k, z = hz - d[1] * j + lane[1] * k; K.air(x, hy, z); K.air(x, hy + 1, z); }   // the hatch (an airlock through a thick hull)
      for (let i = 1; i < hy; i++) for (let k = 0; k < n; k++) {
        const x = hx + d[0] * i + lane[0] * k, z = hz + d[1] * i + lane[1] * k, y = hy - i;
        K.set(x, y, z, 'hull_stairs', { facing, half: 0 });
        for (let yy = 1; yy < y; yy++) K.set(x, yy, z, (yy & 1) ? 'black_metal' : 'hull_plating_dark');
        K.air(x, y + 1, z); K.air(x, y + 2, z);
      }
      for (const k of [-1, n]) for (let i = 1; i < hy; i++) { const x = hx + d[0] * i + lane[0] * k, z = hz + d[1] * i + lane[1] * k, y = hy - i + 1; if (!shipAt(x, y, z) && K.get(x, y, z) === 0) K.set(x, y, z, 'vx_tech_railing'); }
      doors.push([hx + d[0] * hy, 1 + dy, hz + d[1] * hy]);
    }
    // the hangar: portal frames over the pad, a roof with a glass ridge, a gantry crane along it
    if (h) {
      const y1 = bp.sy + 3, fx0 = px0, fx1 = px1;
      const free = (x, z) => K.get(x, 1, z) === 0 && K.get(x, 2, z) === 0;   // never a column in the gangway or its railing
      for (let z = 0; z < D; z += Math.max(4, Math.round(D / 5))) { for (const x of [fx0, fx1]) if (free(x, z)) K.col(x, z, 1, y1 - 1, 'vx_tech_trim'); for (let x = fx0; x <= fx1; x++) K.set(x, y1, z, 'vx_tech_band'); }
      for (const x of [fx0, fx1]) if (free(x, D - 1)) K.col(x, D - 1, 1, y1 - 1, 'vx_tech_trim');
      for (let z = 0; z < D; z++) for (let x = fx0; x <= fx1; x++) if (K.get(x, y1, z) !== VR.R.byName.vx_tech_band.defaultState) K.set(x, y1, z, Math.abs(x - cx) <= 1 ? 'glass' : 'charcoal_panel');
      for (let z = 1; z < D - 1; z++) { K.set(Math.floor(cx) - 3, y1 - 1, z, 'black_metal'); K.set(Math.floor(cx) + 3, y1 - 1, z, 'black_metal'); }
      for (let x = Math.floor(cx) - 3; x <= Math.floor(cx) + 3; x++) K.set(x, y1 - 1, D >> 1, 'hull_plating_dark');
      K.set(Math.floor(cx), y1 - 2, D >> 1, 'iron_chain', { axis: 0 }); K.set(Math.floor(cx), y1 - 3, D >> 1, 'iron_chain', { axis: 0 });
      for (let z = 2; z < D - 2; z += 5) K.set(Math.round(cx), y1 - 1, z, 'vx_hex_light');
    }
    // the ground station: a control booth (consoles, a screen wall, a chair, a door to the pad), a dish, fuel, cargo
    if (s) {
      const sx0 = W - STATION + 1, bz0 = 1, bz1 = Math.min(D - 2, bz0 + 5), bx0 = sx0, bx1 = W - 1;
      for (let z = bz0; z <= bz1; z++) for (let x = bx0; x <= bx1; x++) {
        const edge = x === bx0 || x === bx1 || z === bz0 || z === bz1, corner = (x === bx0 || x === bx1) && (z === bz0 || z === bz1);
        K.set(x, 0, z, 'vx_floor_hex');
        for (let y = 1; y <= 3; y++) K.set(x, y, z, !edge ? 0 : y === 2 && !corner ? 'viewport' : 'vx_tech_white');   // a window band all round
        K.set(x, 4, z, edge ? 'vx_tech_trim' : 'vx_tech_white');
      }
      const dz = (bz0 + bz1) >> 1;
      K.box(bx0, 1, dz, bx0, 2, dz, 0); K.door(bx0, 1, dz, 3, 'door_glass_black', 0);
      K.set(bx0 + 2, 1, bz0 + 1, 'vx_console', { facing: 0 }); K.set(bx0 + 3, 1, bz0 + 1, 'vx_console', { facing: 0 }); K.set(bx1 - 1, 1, dz, 'vx_holo_table');
      K.set(bx0 + 2, 1, bz1 - 1, 'vx_tech_desk', { facing: 2 }); K.model('vm_office_chair_mesh', bx0 + 2, 1, bz1 - 2, 2);
      K.set(bx0 + 2, 2, bz0, 'vx_holo_screen', { facing: 2 }); K.set(bx0 + 3, 2, bz0, 'vx_holo_screen', { facing: 2 });
      K.set(bx0 + 2, 3, dz, 'vx_hex_light'); K.set(bx1 - 2, 5, dz, 'vx_dish'); K.set(bx1 - 1, 5, bz0 + 1, 'antenna');
      // fuel and cargo along the strip
      for (let z = bz1 + 2; z < D - 1; z += 3) { K.set(W - 3, 1, z, 'vx_barrel'); K.set(W - 2, 1, z, 'vx_barrel'); K.set(W - 3, 1, z + 1, 'vx_cargo'); K.set(W - 2, 1, z + 1, 'vx_cargo'); K.set(W - 2, 2, z + 1, 'vx_crate'); }
      doors.push([bx0, 1 + dy, dz]);
    }
    // beacons and lamps
    if (m) {
      for (const [x, z] of [[px0, 0], [px1, 0], [px0, D - 1], [px1, D - 1]]) if (K.get(x, 1, z) === 0) { K.set(x, 0, z, 'vx_tech_gray'); K.set(x, 1, z, 'vx_lamppost_tech'); }
      if (P.params.p) for (const z of [Math.round(cz) - 3, Math.round(cz) + 3]) for (const x of [px0, px1]) if (K.get(x, 1, z) === 0 && !shipAt(x, 1, z)) K.set(x, 1, z, 'beacon_red');
    }
    if (!doors.length) doors.push([Math.round(cx), 1 + dy, 0]);
    K.grid.meta = { name: bp.name, doors, floors: [], top: top + dy, lot: [W, D], anchor: [Math.round(cx), 0], helm: bp.helm ? [bp.helm[0] + ox, bp.helm[1] + 1 + dy, bp.helm[2] + oz] : null, hatch: L.hatch ? [L.hatch.x, L.hatch.y + dy, L.hatch.z] : null, ship: { arch: bp.arch, palette: bp.palette, count: bp.count } };
    return K.grid;
  });
  // the ship (cached: the placer asks for the lot of a pending plan every half second) and where everything goes
  const designs = new Map();
  function design(P) {
    const SG = VR.ShipGen, a = ARCHS[P.params.a] || 'shuttle', pal = (PAL.find(q => q[0] === P.style) || PAL[0])[1];
    const seed = ((P.seed >>> 0) * 2654435761 + P.params.a * 7919) >>> 0, key = seed + ':' + a + ':' + pal;
    let bp = designs.get(key); if (bp) return bp;
    bp = SG.design(seed, a, { palette: pal });
    if (designs.size > 24) designs.delete(designs.keys().next().value);
    designs.set(key, bp); return bp;
  }
  // the way aboard: walk the ship from its helm (the pilot's seat) the way a person would — level, or a step at a time
  // on stairs and slabs, both ways. Where the deck ends in an opening (a side hatch, the open stern) with nothing under
  // the next step, that is an exit; where only one hull block stands between the deck and the open air, a hatch can be
  // cut there (two high, the threshold kept). Openings first, then hatches; the lowest; port side first. Its ramp (one
  // step down per cell outward, to the ground) must not run into the ship.
  // → {x, y, z (the deck cell, ship coordinates, y = feet row), d: [dx, dz] outward, n: width 1–2, cut: bool} or null
  const DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]];    // port first, then the stern, starboard, the bow
  function exitOf(bp) {
    const { sx, sy, sz, blocks, helm } = bp; if (!helm) return null;
    const inB = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < sx && y < sy && z < sz;
    const at = (x, y, z) => (inB(x, y, z) ? blocks[(y * sz + z) * sx + x] : 0), sol = (x, y, z) => Forge.solidish(at(x, y, z));
    const stand = (x, y, z) => inB(x, y, z) && y >= 1 && !sol(x, y, z) && !sol(x, y + 1, z) && sol(x, y - 1, z);
    const step = (s) => { if (!s) return false; const t = VR.R.types[VR.R.T.type[s]], k = t && t.o && t.o.kind; return k === 'stairs' || k === 'slab'; };
    const HELM = VR.R.byName.helm && VR.R.byName.helm.id;
    const seen = new Set(), q = [], key = (x, y, z) => x + ',' + y + ',' + z;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) for (let dy = -1; dy <= 1; dy++) { const x = helm[0] + dx, y = helm[1] + dy, z = helm[2] + dz; if (stand(x, y, z) && !seen.has(key(x, y, z))) { seen.add(key(x, y, z)); q.push([x, y, z]); } }
    // the ramp from deck cell (x, y, z) outward d, starting `from` cells out: free of the ship from the ground up
    const rampFree = (x, y, z, dx, dz, from) => { for (let i = from; i <= y + from - 1; i++) for (let yy = 0; yy <= y - (i - from + 1) + 2; yy++) if (at(x + dx * i, yy, z + dz * i)) return false; return true; };
    const open = (x, y, z) => !sol(x, y, z) && !sol(x, y + 1, z);
    const exits = [];
    while (q.length) {
      const [x, y, z] = q.shift();
      for (const [dx, dz] of DIRS) {
        const nx = x + dx, nz = z + dz;
        const go = (yy) => { const k = key(nx, yy, nz); if (!seen.has(k)) { seen.add(k); q.push([nx, yy, nz]); } };
        if (stand(nx, y, nz)) { go(y); continue; }
        if (stand(nx, y + 1, nz) && step(at(nx, y, nz))) { go(y + 1); continue; }                      // up a step
        if (step(at(x, y - 1, z)) && stand(nx, y - 1, nz)) { go(y - 1); continue; }                    // down from one
        if (open(nx, y, nz) && !sol(nx, y - 1, nz)) { if (rampFree(x, y, z, dx, dz, 1)) exits.push({ x, y, z, d: [dx, dz], n: 1, cut: 0 }); continue; }
        // up to three hull blocks between the deck and the open air (nothing to stand on beyond): a hatch — a short
        // airlock through a thick hull — can be cut there, two high, its floor kept
        for (let j = 1; j <= 3; j++) {
          const cx = x + dx * j, cz = z + dz * j;
          if (!inB(cx, y, cz) || !sol(cx, y - 1, cz) || [at(cx, y, cz), at(cx, y + 1, cz)].some(s => s && VR.R.T.type[s] === HELM)) break;
          const bx = cx + dx, bz = cz + dz;
          if (open(bx, y, bz) && !sol(bx, y - 1, bz)) { if (rampFree(cx, y, cz, dx, dz, 1)) exits.push({ x: cx, y, z: cz, d: [dx, dz], n: 1, cut: j }); break; }
          if (open(bx, y, bz)) break;   // a deck beyond: the walk gets there by itself
        }
      }
    }
    if (!exits.length) return null;
    const di = (e) => DIRS.findIndex(d => d[0] === e.d[0] && d[1] === e.d[1]);
    exits.sort((a, b) => (a.cut - b.cut) || a.y - b.y || di(a) - di(b) || a.z - b.z || a.x - b.x);
    const e = exits[0], side = [Math.abs(e.d[1]), Math.abs(e.d[0])];     // a second lane beside it when that one is an exit too
    if (exits.some(o => o.cut === e.cut && o.y === e.y && di(o) === di(e) && o.x === e.x + side[0] && o.z === e.z + side[1])) e.n = 2;
    return e;
  }
  // the lot: the pad around the ship, room for the gangway on its side, the station strip on the starboard side
  function layout(P) {
    const bp = design(P), pad = P.params.p ? 3 : 1, E = P.params.g ? exitOf(bp) : null;
    // how far the ramp reaches past the ship's box on each side (it runs E.y cells out from the deck cell)
    let ex0 = 0, ex1 = 0, ez0 = 0, ez1 = 0;
    if (E) { const fx = E.x + E.d[0] * (E.y + 1), fz = E.z + E.d[1] * (E.y + 1); ex0 = Math.max(0, -fx - pad); ex1 = Math.max(0, fx - (bp.sx - 1) - pad); ez0 = Math.max(0, -fz - pad); ez1 = Math.max(0, fz - (bp.sz - 1) - pad); }
    const ox = pad + ex0, oz = pad + ez0, shipW = ox + bp.sx + pad + ex1, W = shipW + (P.params.s ? STATION : 0), D = oz + bp.sz + pad + ez1;
    const hatch = E ? { x: E.x + ox, y: E.y + 1, z: E.z + oz, d: E.d, n: E.n, cut: E.cut } : null;   // grid coordinates (the ship stands on row 1)
    return { bp, pad, ox, oz, W, D, shipW, lot: [W, D], hatch };
  }
})(VR);
