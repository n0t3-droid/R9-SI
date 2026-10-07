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
  const ARCHS = ['shuttle', 'interceptor', 'gunship', 'racer', 'dropship', 'freighter', 'cruiser', 'carrier'];
  const PAL = [['sf', 'starforge', 'Starforge'], ['nw', 'nightwing', 'Nightwing'], ['ss', 'sunstrike', 'Sunstrike'], ['rb', 'royal', 'Royal Blue'], ['rh', 'hauler', 'Rust Hauler'], ['as', 'arctic', 'Arctic Survey']];
  Forge.register({
    id: 'shuttle', icon: '🚀', name: 'Shuttle', en: 'Shuttle', level: false, sh: 1,
    params: [
      { k: 'a', label: 'Bauart', min: 0, max: 7, def: 0, names: ['Shuttle', 'Interceptor', 'Gunship', 'Racer', 'Dropship', 'Frachter', 'Kreuzer', 'Träger'] },
      { k: 'p', label: 'Landeplatz', min: 0, max: 1, def: 1 },
    ],
    styles: PAL.map(([id, , name]) => ({ id, name, words: [name.toLowerCase(), id] })),
    lot: (P) => { const bp = design(P); return [bp.sx + (P.params.p ? 4 : 0), bp.sz + (P.params.p ? 4 : 0)]; },
    describe: (P) => [['Shuttle', 'Interceptor', 'Gunship', 'Racer', 'Dropship', 'Frachter', 'Kreuzer', 'Träger'][P.params.a]].concat(P.params.p ? ['Landeplatz'] : []),
  }, function (P, env) {
    const bp = design(P), pad = P.params.p ? 2 : 0;
    const dy = -1, W = bp.sx + pad * 2, D = bp.sz + pad * 2, K = Forge.kit(W, bp.sy + 3, D, dy);
    if (pad) {
      const cx = (W - 1) / 2, cz = (D - 1) / 2, r = Math.max(W, D) / 2;
      for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) { const dd = Math.hypot(x - cx, z - cz) / r; if (dd <= 0.82) K.set(x, 0, z, 'landing_pad'); else if (dd <= 1.02) K.set(x, 0, z, 'hazard_stripes'); }
      for (const [x, z] of [[0, 0], [W - 1, 0], [0, D - 1], [W - 1, D - 1]]) { K.set(x, 0, z, 'vx_tech_gray'); K.set(x, 1, z, 'vx_lamppost_tech'); }
      K.set(Math.round(cx), 0, 0, 'vx_floor_pad');
    }
    for (let y = 0; y < bp.sy; y++) for (let z = 0; z < bp.sz; z++) for (let x = 0; x < bp.sx; x++) { const s = bp.blocks[(y * bp.sz + z) * bp.sx + x]; if (s) K.set(x + pad, y + 1, z + pad, s); }
    K.grid.meta = { name: bp.name, doors: [[Math.round((W - 1) / 2), 1 + dy, 0]], floors: [], top: bp.sy + dy + 1, lot: [W, D], anchor: [W >> 1, 0], ship: { arch: bp.arch, palette: bp.palette, count: bp.count } };
    return K.grid;
  });
  function design(P) {
    const SG = VR.ShipGen, a = ARCHS[P.params.a] || 'shuttle', pal = (PAL.find(q => q[0] === P.style) || PAL[0])[1];
    return SG.design(((P.seed >>> 0) * 2654435761 + P.params.a * 7919) >>> 0, a, { palette: pal });
  }
})(VR);
