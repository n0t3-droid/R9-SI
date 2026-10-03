// ============================================================================
// Block definitions part 4 — Voxel Realm originals (art direction from the
// concept image): realm rocks, glowing prism crystals, Aether energy fluid,
// and the Starforge sci-fi set (hulls, tech panels, neon, thrusters, helm...).
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, T = R.tex, TA = R.texAnim, MD = VR.MODEL, F = VR.F, ROT = R.ROT, FF = VR.FFLAG;
  const { def, G } = VR.BL;
  const { AXIS, FACING4, FACING6 } = VR.PROPS;
  const { slab, stairs, wall } = VR.FAM;
  const { box, quad, cross, rotY, rotX } = MD;
  G.REALM = 'Realm · Crystals & Rock';
  G.STAR = 'Starforge · Sci-fi';
  VR.GROUP_ORDER.push(G.REALM, G.STAR);

  // ---------------------------- realm rocks ----------------------------
  const rock = { cat: 'build', group: G.REALM, tool: 'pick', needTool: true, sound: 'stone', hard: 1.5, blast: 6 };
  VR.stoneFamily('duskrock', 'Duskrock', T('duskrock'), { hard: 1.5, blast: 6 }, G.REALM, null, { slab: 1, stairs: 1, wall: 1, flags: F.RANDROT | F.MACRO });
  VR.stoneFamily('polished_duskrock', 'Polished Duskrock', T('polished_duskrock'), { hard: 1.5, blast: 6 }, G.REALM, null, { slab: 1, stairs: 1 });
  VR.stoneFamily('duskrock_bricks', 'Duskrock Bricks', T('duskrock_bricks'), { hard: 1.5, blast: 6 }, G.REALM, null, { slab: 1, stairs: 1, wall: 1, familyName: 'duskrock_brick' });
  def('ochre_rock', Object.assign({ display: 'Ochre Rock', tex: T('ochre_rock'), flags: F.MACRO }, rock));
  def('ember_ochre', Object.assign({ display: 'Ember Ochre', tex: T('ember_ochre'), flags: F.MACRO }, rock));
  def('umber_rock', Object.assign({ display: 'Umber Rock', tex: T('umber_rock'), flags: F.MACRO | F.RANDROT }, rock));
  VR.stoneFamily('ochre_bricks', 'Ochre Bricks', T('ochre_bricks'), { hard: 1.5, blast: 6 }, G.REALM, null, { slab: 1, stairs: 1, wall: 1, familyName: 'ochre_brick' });
  def('aether_stone', Object.assign({ display: 'Aether-veined Stone', tex: T('aether_stone'), light: [2, 6, 8] }, rock));
  def('dusk_aether', Object.assign({ display: 'Aether-veined Duskrock', tex: T('dusk_aether'), flags: F.RANDROT | F.MACRO }, rock));   // glows through its cracks (emissive texels) only — no block light, so the peaks stay dark
  def('skyroot_soil', { display: 'Skyroot Soil', cat: 'nature', group: G.REALM, tex: T('skyroot_soil'), hard: 0.5, blast: 0.5, tool: 'shovel', sound: 'gravel', flags: F.RANDROT, soil: true });

  // ---------------------------- prism crystals ----------------------------
  const CRYSTALS = VR.CRYSTALS = [
    ['violet', 'Violet', [11, 4, 15]], ['azure', 'Azure', [4, 10, 15]], ['verdant', 'Verdant', [5, 15, 7]], ['rose', 'Rose', [15, 5, 10]], ['amber', 'Amber', [15, 11, 3]]];
  function crystalCluster(tx, big) {
    const f = [];
    const shards = big ? [[8, 8, 0, 14, 3], [4.5, 6, -22, 10, 2.5], [11.5, 6.5, 20, 9, 2.5], [7, 11.5, 14, 8, 2], [9.5, 3.5, -16, 7, 2]] : [[8, 8, 0, 9, 2.2], [5.5, 7, -24, 6, 1.8], [10.5, 9.5, 20, 5, 1.8]];
    for (const [cx, cz, ang, h, r] of shards) {
      let b = box([cx - r, 0, cz - r, cx + r, h, cz + r], tx, { cull: false });
      b = b.concat(box([cx - r * 0.55, h, cz - r * 0.55, cx + r * 0.55, h + r * 1.2, cz + r * 0.55], tx, { cull: false }));
      b = MD.rotate(b, ang % 2 ? 'x' : 'z', ang, cx, 0, cz);
      f.push(...b);
    }
    return MD.withFlags(f, FF.EMIT);
  }
  VR.crystalCluster = crystalCluster;
  for (const [c, D, l] of CRYSTALS) {
    const bt = T('crystal_block:' + c), ct = T('crystal:' + c);
    def(c + '_crystal_block', { display: D + ' Crystal Block', cat: 'nature', group: G.REALM, tex: bt, light: [Math.round(l[0] * 0.7), Math.round(l[1] * 0.7), Math.round(l[2] * 0.7)], hard: 1.5, blast: 1.5, tool: 'pick', needTool: true, sound: 'amethyst', flags: F.EMISSIVE * 0, crystal: c });
    def(c + '_crystal_cluster', { display: D + ' Crystal Cluster', cat: 'nature', group: G.REALM, props: [FACING6, ['size', 2]], defaultIndex: 4, shape: 'model', layer: 'cutout', tex: ct, model: (p) => VR.orient6(crystalCluster(ct, p.size === 1), p.facing), light: l, hard: 1.5, blast: 1.5, tool: 'pick', sound: 'amethyst', solid: false, drops: ['crystal_shard_' + c, 1, 3], crystal: c });
  }

  // ---------------------------- aether (energy fluid) ----------------------------
  def('aether', { display: 'Aether', cat: null, group: G.REALM, props: [['level', 16]], shape: 'fluid', layer: 'trans', tex: T('aether_still'), light: [5, 12, 15], filter: 1, hard: 100, blast: 100, solid: false, flags: F.FLUID | F.REPLACE, sound: 'water', noItem: true, aether: true });

  // ---------------------------- Starforge (sci-fi) ----------------------------
  const sf = { cat: 'build', group: G.STAR, tool: 'pick', needTool: true, tier: 2, sound: 'metal', hard: 4, blast: 9 };
  def('hull_plating', Object.assign({ display: 'Hull Plating', tex: T('hull:white') }, sf));
  def('hull_plating_gray', Object.assign({ display: 'Gray Hull Plating', tex: T('hull:gray') }, sf));
  def('hull_plating_dark', Object.assign({ display: 'Dark Hull Plating', tex: T('hull:dark') }, sf));
  def('hull_stripe_orange', Object.assign({ display: 'Orange-Striped Hull', props: [AXIS], tex: VR.axisTex(T('hull_stripe:orange'), T('hull:white')) }, sf));
  def('hull_stripe_blue', Object.assign({ display: 'Blue-Striped Hull', props: [AXIS], tex: VR.axisTex(T('hull_stripe:blue'), T('hull:white')) }, sf));
  slab('hull_slab', T('hull:white'), Object.assign({ display: 'Hull Slab' }, sf));
  stairs('hull_stairs', T('hull:white'), Object.assign({ display: 'Hull Stairs' }, sf));
  slab('dark_hull_slab', T('hull:dark'), Object.assign({ display: 'Dark Hull Slab' }, sf));
  stairs('dark_hull_stairs', T('hull:dark'), Object.assign({ display: 'Dark Hull Stairs' }, sf));
  const PANELS = [['tech_panel', 'Tech Panel', 'cyan', [3, 9, 12]], ['tech_panel_amber', 'Amber Tech Panel', 'amber', [12, 8, 2]], ['tech_panel_violet', 'Violet Tech Panel', 'violet', [9, 3, 12]]];
  for (const [id, D, c, l] of PANELS) def(id, Object.assign({ display: D, tex: T('tech_panel:' + c), light: l }, sf));
  const NEON = VR.NEON = [['cyan', [4, 13, 15]], ['magenta', [15, 4, 13]], ['amber', [15, 11, 3]], ['lime', [8, 15, 4]], ['white', [14, 14, 15]]];
  for (const [c, l] of NEON) def('neon_' + c, Object.assign({ display: 'Neon ' + c[0].toUpperCase() + c.slice(1), tex: T('neon:' + c), light: l }, sf, { hard: 1, blast: 2, sound: 'glass' }));
  def('light_panel', Object.assign({ display: 'Light Panel', shape: 'model', tex: T('light_panel'), props: [FACING6], defaultIndex: 5, model: (p) => VR.orient6(box([1, 0, 1, 15, 1, 15], { top: T('light_panel'), bottom: T('hull:gray'), side: T('hull:gray') }), p.facing === 5 ? 5 : p.facing === 4 ? 4 : p.facing).map(x => x), light: [15, 15, 14], solid: false }, sf, { hard: 1 }));
  def('vent', Object.assign({ display: 'Vent', tex: T('vent') }, sf));
  def('metal_grate', Object.assign({ display: 'Metal Grate', tex: T('metal_grate'), layer: 'cutout', opaque: false, flags: F.SELFCULL }, sf));
  def('landing_pad', Object.assign({ display: 'Landing Pad', tex: T('landing_pad'), flags: F.RANDROT }, sf));
  def('hazard_stripes', Object.assign({ display: 'Hazard Stripes', tex: T('hazard') }, sf));
  def('reactor_core', Object.assign({ display: 'Reactor Core', tex: T('reactor_core'), light: [6, 13, 15], flags: F.EMISSIVE }, sf, { hard: 6, blast: 30 }));
  def('viewport', Object.assign({ display: 'Viewport Glass', tex: T('viewport'), layer: 'trans', opaque: false, filter: 0, flags: F.SELFCULL }, sf, { hard: 3, blast: 12, sound: 'glass' }));
  def('forcefield', Object.assign({ display: 'Forcefield', tex: T('forcefield'), layer: 'trans', opaque: false, filter: 0, light: [3, 8, 14], flags: F.SELFCULL | F.EMISSIVE }, sf, { hard: 50, blast: 1200 }));
  def('cargo_crate', Object.assign({ display: 'Cargo Crate', props: [FACING4], tex: VR.facingTex(T('cargo_front'), T('cargo_side'), T('cargo_top')), flags: F.INTERACT, ui: 'chest' }, sf, { hard: 3 }));
  def('energy_conduit', Object.assign({ display: 'Energy Conduit', props: [AXIS], shape: 'model', layer: 'cutout', tex: T('conduit_pipe'), model: (p) => { let f = MD.cat(box([5, 0, 5, 11, 16, 11], T('conduit_pipe')), MD.withFlags(box([6.5, 0, 6.5, 9.5, 16, 9.5], T('conduit_glow'), { cull: false }), FF.EMIT)); if (p.axis === 1) f = MD.rotate(f, 'z', 90, 8, 8, 8); else if (p.axis === 2) f = MD.rotate(f, 'x', 90, 8, 8, 8); return f; }, light: [2, 8, 12], solid: true }, sf, { hard: 2 }));
  def('console', Object.assign({ display: 'Command Console', props: [FACING4], shape: 'model', tex: T('console_side'), model: (p) => rotY(MD.cat(box([1, 0, 3, 15, 9, 15], { top: T('console_desk'), side: T('console_side'), bottom: T('hull:dark') }), MD.withFlags(MD.rotate(box([1, 9, 9, 15, 17, 11], { 5: T('console_screen'), 4: T('hull:dark'), side: T('hull:dark'), top: T('hull:dark'), bottom: T('hull:dark') }, { cull: false }), 'x', -25, 8, 9, 10), 0)), p.facing), light: [2, 6, 9], flags: F.INTERACT, solid: true, kind: 'console' }, sf, { hard: 3 }));
  def('pilot_seat', Object.assign({ display: 'Pilot Seat', props: [FACING4], shape: 'model', tex: T('seat'), model: (p) => rotY(MD.cat(box([3, 0, 3, 13, 3, 13], T('hull:dark')), box([2, 3, 2, 14, 6, 14], T('seat')), box([2, 6, 11, 14, 18, 14], T('seat')), box([1, 5, 3, 3, 9, 12], T('hull:gray')), box([13, 5, 3, 15, 9, 12], T('hull:gray'))), p.facing), flags: F.INTERACT, solid: true, kind: 'seat' }, sf, { hard: 2, sound: 'wool' }));
  def('helm', Object.assign({ display: 'Ship Helm', props: [FACING4], shape: 'model', tex: T('helm_top'), model: (p) => rotY(MD.cat(box([4, 0, 4, 12, 10, 12], { side: T('hull:dark'), top: T('hull:dark') }), MD.withFlags(box([2, 10, 3, 14, 13, 13], { top: T('helm_top'), side: T('hull:gray'), bottom: T('hull:gray') }), FF.EMIT)), p.facing), light: [3, 9, 14], flags: F.INTERACT, solid: true, kind: 'helm' }, sf, { hard: 4 }));
  def('thruster', Object.assign({ display: 'Thruster', props: [FACING6, ['lit', 2]], defaultIndex: 1, shape: 'model', tex: T('thruster_side'), model: (p) => VR.orient6(MD.cat(box([2, 0, 2, 14, 12, 14], { side: T('thruster_side'), top: T('thruster_side'), bottom: T('thruster_side') }), box([3, 12, 3, 13, 16, 13], { side: T('hull:dark'), top: T('thruster_nozzle'), bottom: T('hull:dark') }), MD.withFlags(box([4, 15.5, 4, 12, 16, 12], { top: T(p.lit ? 'thruster_glow' : 'thruster_nozzle') }, { cull: false, faces: [2] }), p.lit ? FF.EMIT : 0)), p.facing), light: (p) => p.lit ? [15, 9, 4] : null, solid: true, kind: 'thruster' }, sf));
  def('antenna', Object.assign({ display: 'Antenna', shape: 'model', layer: 'cutout', tex: T('hull:gray'), model: () => MD.cat(box([6, 0, 6, 10, 2, 10], T('hull:dark')), box([7.5, 2, 7.5, 8.5, 15, 8.5], T('hull:gray'), { cull: false }), MD.withFlags(box([7, 15, 7, 9, 16, 9], T('neon:magenta'), { cull: false }), FF.EMIT)), light: [6, 1, 5], solid: false }, sf, { hard: 1 }));
  def('satellite_dish', Object.assign({ display: 'Satellite Dish', props: [FACING4], shape: 'model', tex: T('hull:white'), model: (p) => rotY(MD.cat(box([6, 0, 6, 10, 6, 10], T('hull:gray')), MD.rotate(MD.cat(box([1, 8, 1, 15, 9, 15], T('hull:white'), { cull: false }), box([7, 9, 7, 9, 13, 9], T('hull:gray'), { cull: false })), 'x', 35, 8, 8, 8)), p.facing), solid: true }, sf, { hard: 2 }));
  def('turret', Object.assign({ display: 'Pulse Turret', props: [['active', 2]], shape: 'model', tex: T('hull:dark'), model: () => MD.cat(box([2, 0, 2, 14, 6, 14], { side: T('hazard'), top: T('hull:dark'), bottom: T('hull:dark') }), box([4, 6, 4, 12, 9, 12], T('hull:gray'))), light: [3, 6, 10], solid: true, kind: 'turret', flags: F.INTERACT }, sf, { hard: 5, blast: 20 }));
  def('holo_projector', Object.assign({ display: 'Holo Projector', shape: 'model', tex: T('hull:dark'), model: () => MD.cat(box([3, 0, 3, 13, 4, 13], { top: T('tech_panel:cyan'), side: T('hull:dark') })), light: [4, 10, 15], solid: true, kind: 'holo' }, sf, { hard: 2 }));
  def('launch_beacon', Object.assign({ display: 'Launch Beacon', tex: { top: T('launch_beacon_top'), side: T('hazard') }, light: [15, 6, 2], flags: F.INTERACT, kind: 'beacon' }, sf));

  // ============================ VOXEL ARCHITECTURE (mini-voxel building kit) =============
  G.ARCH = 'Voxel Architecture';
  VR.GROUP_ORDER.push(G.ARCH);
  G.TECH = 'Voxel Tech';
  VR.GROUP_ORDER.push(G.TECH);
  G.LIFE = 'Village Life';
  VR.GROUP_ORDER.push(G.LIFE);
  G.SHOP = 'Supermarket';
  VR.GROUP_ORDER.push(G.SHOP);
  if (VR.VX) VR.VX.define(def, T, G, F);
  // natural ground and road surfaces draw as smooth slopes (R9 Smooth Ground, mesher.js)
  const NATURAL = ['grass_block', 'dirt', 'coarse_dirt', 'podzol', 'mycelium', 'mud', 'clay', 'gravel', 'sand', 'red_sand', 'moss_block', 'snow_block', 'rooted_dirt', 'asphalt', 'asphalt_dash', 'asphalt_zebra', 'grass_path', 'dirt_path_block', 'paver_grey', 'paver_sand', 'cobblestone_path', 'gravel_path'];
  for (const n of NATURAL) { const t = R.byName[n]; if (t) t.o.smooth = true; }
  // every natural block has a "cut" twin: the same block held in its cube shape (a shovel toggles between the two,
  // placing against a cut block continues cut). Twins are appended after every other block so saved worlds keep
  // their state ids.
  VR.CUT_OF = {}; VR.SMOOTH_OF = {};
  for (const n of NATURAL) {
    const t = R.byName[n]; if (!t) continue;
    const o = Object.assign({}, t.o, { smooth: false, display: t.display + ' · kantig', drops: t.o.drops || n, cat: null, group: null, cutOf: n });
    delete o.defaultIndex; if (t.o.defaultIndex) o.defaultIndex = t.o.defaultIndex;
    def(n + '_cut', o);
    VR.CUT_OF[n] = n + '_cut'; VR.SMOOTH_OF[n + '_cut'] = n;
  }
  // later block sets (blocks6.js: Vollton colours, panorama glass, modern doors) — appended, so older ids stay put
  for (const fn of (VR.BL.late || [])) fn();

  // ============================ FINALIZE ===============================================
  R.finalize();
  VR.AIR = 0;
})(VR);
