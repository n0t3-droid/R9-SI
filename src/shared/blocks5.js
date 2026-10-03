// ============================================================================
// Block definitions part 5 — Designer Home materials (from the user's reference
// photos): stucco, stacked ledgestone, charcoal roofing, wood slats, glass-strip
// garage doors, black-framed floor-to-ceiling glass, driveway concrete, pavers,
// marble, travertine, herringbone oak, subway & dark tiles, decking, pool tiles.
// Loaded before blocks4.js (which finalizes the registry).
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, T = R.tex, F = VR.F;
  const { def, G } = VR.BL;
  const { AXIS } = VR.PROPS;
  G.HOME = 'Designer Home · Modern & Classic';
  VR.GROUP_ORDER.push(G.HOME);
  const stone = { cat: 'build', group: G.HOME, tool: 'pick', needTool: true, sound: 'stone', hard: 1.5, blast: 6 };
  const wood = { cat: 'build', group: G.HOME, tool: 'axe', sound: 'wood', hard: 1.5, blast: 3 };
  const fam = (id, disp, tex, o) => VR.stoneFamily(id, disp, tex, { hard: 1.5, blast: 6 }, G.HOME, null, Object.assign({ slab: 1, stairs: 1 }, o || {}));
  // ---- walls ----
  fam('stucco_white', 'White Stucco', T('stucco_white'), { wall: 1 });
  fam('stucco_cream', 'Cream Stucco', T('stucco_cream'));
  fam('stucco_grey', 'Grey Stucco', T('stucco_grey'));
  fam('stacked_stone', 'Stacked Ledgestone', { side: T('stacked_stone'), top: T('concrete_smooth'), bottom: T('concrete_smooth') }, { wall: 1 });
  fam('charcoal_panel', 'Charcoal Cladding', T('charcoal_panel'));
  fam('white_clinker', 'White Clinker Brick', T('white_clinker'), { wall: 1 });
  fam('stucco_ochre', 'Ochre Stucco', T('stucco_ochre'));
  fam('stucco_sand', 'Sand Stucco', T('stucco_sand'));
  fam('bossed_stone', 'Bossed White Stone', T('bossed_stone'), { wall: 1 });

  fam('white_trim', 'White Cornice Trim', { side: T('white_trim'), top: T('white_trim_top'), bottom: T('white_trim_top') });
  def('black_metal', Object.assign({ display: 'Black Steel', tex: T('black_metal') }, stone, { sound: 'metal' }));
  def('wood_slat', Object.assign({ display: 'Walnut Slat Panel', props: [AXIS], tex: VR.axisTex(T('wood_slat'), T('wood_slat_end')) }, wood));
  def('garage_door', Object.assign({ display: 'Glass-Strip Garage Door', tex: { side: T('garage_door'), top: T('black_metal'), bottom: T('black_metal') } }, stone, { sound: 'metal' }));
  // ---- roofs ----
  fam('roof_charcoal', 'Charcoal Roofing', { side: T('roof_charcoal'), top: T('roof_charcoal_top'), bottom: T('roof_charcoal_top') });
  fam('slate_roof', 'Natural Slate', T('slate_roof'));
  // ---- ground ----
  fam('concrete_smooth', 'Smooth Concrete', T('concrete_smooth'));
  fam('paver_grey', 'Grey Pavers', T('paver_grey'));
  fam('granite_paver', 'Granite Plaza Pavers', T('granite_paver'));
  fam('travertine', 'Travertine', T('travertine'));
  def('deck_wood', Object.assign({ display: 'Composite Decking', tex: T('deck_wood') }, wood));
  VR.FAM.slab('deck_wood_slab', T('deck_wood'), Object.assign({ display: 'Decking Slab', parent: 'deck_wood' }, wood, { group: G.PARTIAL }));
  def('pool_tile', Object.assign({ display: 'Pool Tile', tex: T('pool_tile') }, stone));
  // ---- interior floors & tiles ----
  fam('marble_white', 'White Marble', T('marble_white'));
  fam('marble_dark', 'Dark Marble', T('marble_dark'));
  def('oak_herringbone', Object.assign({ display: 'Herringbone Oak Floor', tex: T('oak_herringbone') }, wood));
  def('subway_tile', Object.assign({ display: 'Subway Tile', tex: T('subway_tile') }, stone));
  def('dark_tile', Object.assign({ display: 'Dark Bath Tile', tex: T('dark_tile') }, stone));
  def('terrazzo', Object.assign({ display: 'Terrazzo', tex: T('terrazzo') }, stone));
  fam('porcelain_tile', 'Porcelain Tile', T('porcelain_tile'));
  def('oak_wide', Object.assign({ display: 'Wide Oak Planks', tex: T('oak_wide') }, wood));
  fam('micro_cement', 'Micro-cement', T('micro_cement'));
  def('walnut_panel', Object.assign({ display: 'Walnut Wall Panel', tex: T('walnut_panel') }, wood));
  def('black_kitchen', Object.assign({ display: 'Black Matte Panel', tex: T('black_kitchen') }, stone));
  def('carpet_cream', Object.assign({ display: 'Cream Carpet', tex: T('carpet_cream') }, wood, { sound: 'wool', hard: 0.6 }));
  // floor slabs with a white plaster underside: one block is the floor of the room above and the ceiling of the room below
  for (const [id, disp, top] of [['floor_oak', 'Oak Floor (white ceiling)', 'oak_herringbone'], ['floor_oak_wide', 'Wide Oak Floor (white ceiling)', 'oak_wide'], ['floor_porcelain', 'Porcelain Floor (white ceiling)', 'porcelain_tile'], ['floor_cement', 'Micro-cement Floor (white ceiling)', 'micro_cement'], ['floor_marble', 'Marble Floor (white ceiling)', 'marble_white'], ['floor_tile', 'Tile Floor (white ceiling)', 'dark_tile'], ['floor_carpet', 'Carpet Floor (white ceiling)', 'carpet_cream'], ['floor_terrazzo', 'Terrazzo Floor (white ceiling)', 'terrazzo'], ['floor_concrete', 'Concrete Floor (white ceiling)', 'concrete_smooth']])
    def(id, Object.assign({ display: disp, tex: { top: T(top), bottom: T('stucco_white'), side: T('white_trim_top') } }, stone, { hard: 1.2 }));
  // ---- glass ----
  const glass = { cat: 'build', group: G.HOME, sound: 'glass', hard: 0.6, blast: 1, layer: 'trans', opaque: false, filter: 0, flags: F.SELFCULL };
  def('window_black', Object.assign({ display: 'Black-Frame Glass', tex: T('window_black') }, glass));
  def('window_white', Object.assign({ display: 'White-Frame Glass', tex: T('window_white') }, glass));
  def('window_warm', Object.assign({ display: 'Warm-Lit Glass', tex: T('window_warm'), light: [12, 9, 4], flags: F.SELFCULL | F.EMISSIVE }, glass));
  def('glass_rail', Object.assign({}, glass, { display: 'Glass Balustrade', tex: T('glass_rail'), shape: 'pane', paneEdge: T('black_metal'), conn: 4, solid: true, layer: 'cutout', flags: 0 }));
  def('frosted_glass', Object.assign({ display: 'Frosted Glass', tex: T('frosted_glass') }, glass));
})(VR);
