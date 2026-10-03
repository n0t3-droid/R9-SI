// ============================================================================
// Block definitions part 2 — Ornamental & Natural
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, T = R.tex, TA = R.texAnim, MD = VR.MODEL, F = VR.F, ROT = R.ROT, FF = VR.FFLAG;
  const { def, G } = VR.BL;
  const { AXIS, FACING4, FACING6, HALF, SLABT } = VR.PROPS;
  const { slab, stairs, wall } = VR.FAM;
  const { box, quad, cross, rotY, rotX, cropHash } = MD;
  const axisTex = VR.axisTex;
  const COLORS = VR.COLORS, CN = VR.COLOR_NAME;

  // ============================ ORNAMENTAL ======================================
  def('weeping_obsidian', { display: 'Weeping Obsidian', cat: 'build', group: G.DECOR, wiki: 'Crying_Obsidian', tex: T('weeping_obsidian'), hard: 50, blast: 1200, tool: 'pick', needTool: true, tier: 4, light: [8, 3, 11], sound: 'stone', flags: F.RANDTICK });
  def('gilded_scoria', { display: 'Gilded Scoria', cat: 'build', group: G.DECOR, wiki: 'Gilded_Blackstone', tex: T('gilded_scoria'), hard: 1.5, blast: 6, tool: 'pick', needTool: true, sound: 'stone' });
  def('reinforced_deepstone', { display: 'Reinforced Deepstone', cat: 'build', group: G.DECOR, wiki: 'Reinforced_Deepslate', tex: { top: T('reinforced_deepstone_top'), side: T('reinforced_deepstone') }, hard: 55, blast: 1200, sound: 'deep', flags: F.UNBREAK });

  // Bars & chains
  const barsP = { cat: 'build', group: G.PARTIAL, shape: 'pane', layer: 'cutout', conn: 4, hard: 5, blast: 6, tool: 'pick', needTool: true, sound: 'metal', solid: true };
  def('iron_bars', Object.assign({ display: 'Iron Bars', wiki: 'Iron_Bars', tex: T('iron_bars'), paneEdge: T('iron_bars') }, barsP));
  def('copper_bars', Object.assign({ display: 'Copper Bars', wiki: 'Copper_Bars', props: [['stage', 4], ['waxed', 2]], tex: (p) => T('copper:bars:' + p.stage), oxidizes: true, flags: F.RANDTICK }, barsP));
  def('iron_chain', { display: 'Iron Chain', cat: 'build', group: G.PARTIAL, wiki: 'Iron_Chain', props: [AXIS], shape: 'model', layer: 'cutout', tex: T('iron_chain'), model: (p) => VR.chainModel(p.axis, T('iron_chain')), hard: 5, blast: 6, tool: 'pick', needTool: true, sound: 'chain', solid: true });
  def('copper_chain', { display: 'Copper Chain', cat: 'build', group: G.PARTIAL, wiki: 'Copper_Chain', props: [AXIS, ['stage', 4], ['waxed', 2]], shape: 'model', layer: 'cutout', tex: (p) => T('copper:chain:' + p.stage), model: (p) => VR.chainModel(p.axis, T('copper:chain:' + p.stage)), hard: 5, blast: 6, tool: 'pick', needTool: true, sound: 'chain', oxidizes: true, flags: F.RANDTICK, solid: true });

  // ---- Dyeable / Dyed --------------------------------------------------------------
  const woolS = { hard: 0.8, blast: 0.8, tool: 'shears', sound: 'wool', flam: [30, 60] };
  for (const c of COLORS) {
    const D = CN(c), wt = T('wool:' + c);
    def(c + '_wool', Object.assign({ display: D + ' Wool', cat: 'color', group: G.DYED, wiki: 'Wool', tex: wt, color: c }, woolS));
    slab(c + '_wool_slab', wt, Object.assign({ display: D + ' Wool Slab', cat: 'color', group: G.DYED, wiki: 'Wool_Slab', color: c }, woolS));
    stairs(c + '_wool_stairs', wt, Object.assign({ display: D + ' Wool Stairs', cat: 'color', group: G.DYED, wiki: 'Wool_Stairs', color: c }, woolS));
    def(c + '_carpet', { display: D + ' Carpet', cat: 'color', group: G.DYED, wiki: 'Carpet', shape: 'model', tex: wt, model: () => VR.carpetModel(wt), hard: 0.1, blast: 0.1, sound: 'wool', flam: [60, 20], solid: true, height: 1, color: c });
  }
  def('terracotta', { display: 'Terracotta', cat: 'color', group: G.DYED, wiki: 'Terracotta', tex: T('terracotta'), hard: 1.25, blast: 4.2, tool: 'pick', needTool: true, sound: 'stone', flags: F.MACRO });
  const conS = { hard: 1.8, blast: 1.8, tool: 'pick', needTool: true, sound: 'stone' };
  for (const c of COLORS) {
    const D = CN(c);
    def(c + '_terracotta', { display: D + ' Terracotta', cat: 'color', group: G.DYED, wiki: 'Stained_Terracotta', tex: T('terracotta:' + c), hard: 1.25, blast: 4.2, tool: 'pick', needTool: true, sound: 'stone', color: c, flags: F.MACRO });
    def(c + '_glazed_terracotta', { display: D + ' Glazed Terracotta', cat: 'color', group: G.DYED, wiki: 'Glazed_Terracotta', props: [FACING4], tex: (p) => ROT(T('glazed:' + c), p.facing), hard: 1.4, blast: 1.4, tool: 'pick', needTool: true, sound: 'stone', color: c, noPiston: 'sticky' });
    const ct = T('concrete:' + c);
    def(c + '_concrete', Object.assign({ display: D + ' Concrete', cat: 'color', group: G.DYED, wiki: 'Concrete', tex: ct, color: c }, conS));
    slab(c + '_concrete_slab', ct, Object.assign({ display: D + ' Concrete Slab', cat: 'color', group: G.DYED, wiki: 'Concrete_Slab', color: c }, conS));
    stairs(c + '_concrete_stairs', ct, Object.assign({ display: D + ' Concrete Stairs', cat: 'color', group: G.DYED, wiki: 'Concrete_Stairs', color: c }, conS));
    def(c + '_concrete_powder', { display: D + ' Concrete Powder', cat: 'color', group: G.DYED, wiki: 'Concrete_Powder', tex: T('concrete_powder:' + c), hard: 0.5, blast: 0.5, tool: 'shovel', sound: 'sand', flags: F.FALLING, hardensTo: c + '_concrete', color: c });
  }
  // Glass
  // glass drops itself here — everything placed in this world is an item. Every glass block keeps its own frame
  // (v0.33.2: the joined-up glass of v0.33 is gone again)
  const glassS = { hard: 0.3, blast: 0.3, sound: 'glass' };
  def('glass', Object.assign({ display: 'Glass', cat: 'color', group: G.DYED, wiki: 'Glass', tex: T('glass'), layer: 'cutout', opaque: false, flags: F.SELFCULL }, glassS));
  def('tinted_glass', Object.assign({ display: 'Tinted Glass', cat: 'color', group: G.DYED, wiki: 'Tinted_Glass', tex: T('tinted_glass'), layer: 'trans', opaque: false, filter: 15, flags: F.SELFCULL, dropsNothing: false }, glassS));
  def('glass_pane', Object.assign({ display: 'Glass Pane', cat: 'color', group: G.PARTIAL, wiki: 'Glass_Pane', tex: T('glass'), paneEdge: T('glass_pane_top'), shape: 'pane', layer: 'cutout', conn: 4, solid: true }, glassS));
  for (const c of COLORS) {
    const D = CN(c);
    def(c + '_stained_glass', Object.assign({ display: D + ' Stained Glass', cat: 'color', group: G.DYED, wiki: 'Stained_Glass', tex: T('stained_glass:' + c), layer: 'trans', opaque: false, flags: F.SELFCULL, color: c }, glassS));
    def(c + '_stained_glass_pane', Object.assign({ display: D + ' Stained Glass Pane', cat: 'color', group: G.DYED, wiki: 'Stained_Glass_Pane', tex: T('stained_glass:' + c), paneEdge: T('stained_glass_pane_top:' + c), shape: 'pane', layer: 'trans', conn: 4, solid: true, color: c }, glassS));
  }

  // ---- Lighting -------------------------------------------------------------------
  const candleColors = ['plain', ...COLORS];
  for (const c of candleColors) {
    const tx = T('candle:' + c);
    def(c === 'plain' ? 'candle' : c + '_candle', {
      display: c === 'plain' ? 'Candle' : CN(c) + ' Candle', cat: 'color', group: G.LIGHT, wiki: 'Candle', props: [['candles', [1, 2, 3, 4]], ['lit', 2]],
      shape: 'model', layer: 'cutout', tex: tx, model: (p) => VR.candleModel(p.candles + 1, p.lit, tx), hard: 0.1, blast: 0.1, sound: 'candle',
      light: (p) => p.lit ? [3 * (p.candles + 1), Math.round(2.2 * (p.candles + 1)), Math.round(1.2 * (p.candles + 1))] : null, flags: F.INTERACT, solid: false, color: c === 'plain' ? null : c
    });
  }
  def('light_rod', { display: 'Light Rod', cat: 'func', group: G.LIGHT, wiki: 'End_Rod', props: [FACING6], defaultIndex: 4, shape: 'model', layer: 'cutout', tex: T('light_rod'), model: (p) => VR.rodModel(p.facing, T('light_rod')), light: [13, 13, 15], hard: 0, blast: 0, sound: 'wood', solid: true });
  const MIRE = [['ochre', [15, 14, 9]], ['verdant', [11, 15, 11]], ['pearl', [14, 8, 15]]];
  for (const [m, l] of MIRE) def(m + '_mire_light', { display: m[0].toUpperCase() + m.slice(1) + ' Mirelight', cat: 'func', group: G.LIGHT, wiki: 'Froglight', props: [AXIS], tex: axisTex(T('mire_light:' + m), T('mire_light_top:' + m)), light: l, hard: 0.3, blast: 0.3, sound: 'froglight' });
  def('sunstone', { display: 'Sunstone', cat: 'func', group: G.LIGHT, wiki: 'Glowstone', tex: T('sunstone'), light: [15, 13, 8], hard: 0.3, blast: 0.3, sound: 'glass', drops: ['sunstone_dust', 2, 4] });
  def('jack_o_lantern', { display: "Jack o'Lantern", cat: 'func', group: G.LIGHT, wiki: "Jack_o'Lantern", props: [FACING4], tex: VR.facingTex(T('jack_o_lantern'), T('pumpkin_side'), T('pumpkin_top')), light: [15, 10, 4], hard: 1, blast: 1, tool: 'axe', sound: 'wood' });
  const lanternS = { cat: 'func', group: G.LIGHT, shape: 'model', layer: 'cutout', hard: 3.5, blast: 3.5, tool: 'pick', needTool: true, sound: 'lantern', solid: true };
  def('lantern', Object.assign({ display: 'Lantern', wiki: 'Lantern', props: [['hanging', 2]], tex: T('lantern'), model: (p) => VR.lanternModel(p.hanging, T('lantern')), light: [15, 11, 6] }, lanternS));
  def('copper_lantern', Object.assign({ display: 'Copper Lantern', wiki: 'Copper_Lantern', props: [['hanging', 2], ['stage', 4], ['waxed', 2]], tex: (p) => T('copper:lantern:' + p.stage), model: (p) => VR.lanternModel(p.hanging, T('copper:lantern:' + p.stage)), light: [9, 15, 7], oxidizes: true, flags: F.RANDTICK }, lanternS));
  def('spirit_lantern', Object.assign({ display: 'Spirit Lantern', wiki: 'Soul_Lantern', props: [['hanging', 2]], tex: T('spirit_lantern'), model: (p) => VR.lanternModel(p.hanging, T('spirit_lantern')), light: [4, 9, 11] }, lanternS));
  def('tide_lantern', { display: 'Tide Lantern', cat: 'func', group: G.LIGHT, wiki: 'Sea_Lantern', tex: T('tide_lantern'), light: [12, 15, 15], hard: 0.3, blast: 0.3, sound: 'glass', drops: ['tide_crystals', 2, 3] });
  const TORCHES = [['torch', 'Torch', 'Torch', [14, 10, 5]], ['copper_torch', 'Copper Torch', 'Copper_Torch', [8, 14, 6]], ['spirit_torch', 'Spirit Torch', 'Soul_Torch', [4, 9, 11]],
    ['red_torch', 'Red Torch', 'Colored_Torch', [14, 3, 2]], ['blue_torch', 'Blue Torch', 'Colored_Torch', [3, 6, 15]], ['green_torch', 'Green Torch', 'Colored_Torch', [3, 14, 4]], ['purple_torch', 'Purple Torch', 'Colored_Torch', [12, 3, 15]],
    ['sea_torch', 'Sea Torch', 'Underwater_Torch', [8, 14, 14]]];
  VR.TORCH_IDS = TORCHES.map(t => t[0]);
  for (const [id, disp, wiki, l] of TORCHES) {
    const tx = T(id);
    def(id, { display: disp, cat: 'func', group: wiki === 'Colored_Torch' || wiki === 'Underwater_Torch' ? G.EDU : G.LIGHT, wiki, props: [['face', 5]], shape: 'model', layer: 'cutout', tex: tx, model: (p) => VR.torchModel(p.face, tx), light: l, hard: 0, blast: 0, sound: 'wood', solid: false, kind: 'torch', underwater: id === 'sea_torch' });
  }
  def('hardened_glass', { display: 'Hardened Glass', cat: 'color', group: G.EDU, wiki: 'Hardened_Glass', tex: T('hardened_glass'), layer: 'cutout', opaque: false, flags: F.SELFCULL, hard: 10, blast: 9, sound: 'glass' });
  def('hardened_glass_pane', { display: 'Hardened Glass Pane', cat: 'color', group: G.EDU, wiki: 'Hardened_Glass_Pane', tex: T('hardened_glass'), paneEdge: T('glass_pane_top'), shape: 'pane', layer: 'cutout', conn: 4, hard: 10, blast: 9, sound: 'glass', solid: true });
  def('glowing_obsidian', { display: 'Glowing Obsidian', cat: 'build', group: G.LEGACY, wiki: 'Glowing_Obsidian', tex: T('glowing_obsidian'), light: [12, 4, 2], hard: 35, blast: 1200, tool: 'pick', needTool: true, tier: 4, sound: 'stone' });

  // ============================ NATURAL: SOIL =====================================
  T('grass_snow_side');
  for (const fam of ['dripstone', 'sulfur', 'icicle']) for (const th of ['tip', 'tip_merge', 'frustum', 'middle', 'base']) T('drip:' + fam + ':' + th);
  const shovel = (h) => ({ hard: h, blast: h, tool: 'shovel' });
  def('grass_block', Object.assign({ display: 'Grass Block', cat: 'nature', group: G.SOIL, wiki: 'Grass_Block', tex: { top: T('grass_top'), bottom: T('dirt'), side: T('grass_side') }, tint: 'grass', sound: 'grass', drops: 'dirt', flags: F.RANDTICK | F.RANDROT | F.MACRO, soil: true }, shovel(0.6)));
  def('dirt', Object.assign({ display: 'Dirt', cat: 'nature', group: G.SOIL, wiki: 'Dirt', tex: T('dirt'), sound: 'gravel', flags: F.RANDROT | F.MACRO, soil: true }, shovel(0.5)));
  def('coarse_dirt', Object.assign({ display: 'Coarse Dirt', cat: 'nature', group: G.SOIL, wiki: 'Coarse_Dirt', tex: T('coarse_dirt'), sound: 'gravel', flags: F.RANDROT | F.MACRO, soil: true }, shovel(0.5)));
  def('dirt_path', Object.assign({ display: 'Dirt Path', cat: 'nature', group: G.SOIL, wiki: 'Dirt_Path', shape: 'model', tex: { top: T('dirt_path_top'), side: T('dirt_path_side'), bottom: T('dirt') }, model: () => box([0, 0, 0, 16, 15, 16], { top: T('dirt_path_top'), side: T('dirt_path_side'), bottom: T('dirt') }), sound: 'grass', drops: 'dirt', solid: true, height: 15 }, shovel(0.65)));
  def('mycelium', Object.assign({ display: 'Mycelium', cat: 'nature', group: G.SOIL, wiki: 'Mycelium', tex: { top: T('mycelium_top'), bottom: T('dirt'), side: T('mycelium_side') }, sound: 'grass', drops: 'dirt', flags: F.RANDTICK | F.RANDROT, soil: true }, shovel(0.6)));
  def('podzol', Object.assign({ display: 'Podzol', cat: 'nature', group: G.SOIL, wiki: 'Podzol', tex: { top: T('podzol_top'), bottom: T('dirt'), side: T('podzol_side') }, sound: 'grass', drops: 'dirt', flags: F.RANDROT, soil: true }, shovel(0.5)));
  def('rooted_dirt', Object.assign({ display: 'Rooted Dirt', cat: 'nature', group: G.SOIL, wiki: 'Rooted_Dirt', tex: T('rooted_dirt'), sound: 'gravel', soil: true }, shovel(0.5)));
  def('mud', Object.assign({ display: 'Mud', cat: 'nature', group: G.SOIL, wiki: 'Mud', tex: T('mud'), sound: 'mud', flags: F.RANDROT, soil: true, colTop: 14 }, shovel(0.5)));
  def('clay', Object.assign({ display: 'Clay', cat: 'nature', group: G.SOIL, wiki: 'Clay', tex: T('clay'), sound: 'gravel', drops: ['clay_ball', 4, 4] }, shovel(0.6)));
  def('gravel', Object.assign({ display: 'Gravel', cat: 'nature', group: G.SOIL, wiki: 'Gravel', tex: T('gravel'), sound: 'gravel', flags: F.FALLING | F.RANDROT }, shovel(0.6)));
  def('sand', Object.assign({ display: 'Sand', cat: 'nature', group: G.SOIL, wiki: 'Sand', tex: T('sand'), sound: 'sand', flags: F.FALLING | F.RANDROT | F.MACRO }, shovel(0.5)));
  def('red_sand', Object.assign({ display: 'Red Sand', cat: 'nature', group: G.SOIL, wiki: 'Red_Sand', tex: T('red_sand'), sound: 'sand', flags: F.FALLING | F.RANDROT | F.MACRO }, shovel(0.5)));
  def('gloom_sand', Object.assign({ display: 'Gloom Sand', cat: 'nature', group: G.SOIL, wiki: 'Soul_Sand', tex: T('gloom_sand'), sound: 'soul', flags: F.SLOW | F.RANDROT, colTop: 14, spiritFire: true }, shovel(0.5)));
  def('gloom_soil', Object.assign({ display: 'Gloom Soil', cat: 'nature', group: G.SOIL, wiki: 'Soul_Soil', tex: T('gloom_soil'), sound: 'soul', flags: F.RANDROT, spiritFire: true }, shovel(0.5)));
  def('crimson_mycel', { display: 'Crimson Mycel', cat: 'nature', group: G.SOIL, wiki: 'Crimson_Nylium', tex: { top: T('crimson_mycel'), bottom: T('emberrock'), side: T('crimson_mycel_side') }, hard: 0.4, blast: 0.4, tool: 'pick', needTool: true, sound: 'nylium', drops: 'emberrock', flags: F.RANDROT });
  def('teal_mycel', { display: 'Teal Mycel', cat: 'nature', group: G.SOIL, wiki: 'Warped_Nylium', tex: { top: T('teal_mycel'), bottom: T('emberrock'), side: T('teal_mycel_side') }, hard: 0.4, blast: 0.4, tool: 'pick', needTool: true, sound: 'nylium', drops: 'emberrock', flags: F.RANDROT });
  def('farmland', Object.assign({ display: 'Farmland', cat: 'nature', group: G.UTIL, wiki: 'Farmland', props: [['moisture', 8]], shape: 'model', tex: (p) => ({ top: T(p.moisture >= 7 ? 'farmland_wet' : 'farmland'), side: T('dirt_path_side'), bottom: T('dirt') }), model: (p) => box([0, 0, 0, 16, 15, 16], { top: T(p.moisture >= 7 ? 'farmland_wet' : 'farmland'), side: T('dirt'), bottom: T('dirt') }), sound: 'gravel', drops: 'dirt', flags: F.RANDTICK, solid: true, height: 15 }, shovel(0.6)));

  // ============================ NATURAL: MISC ROCK =================================
  def('bedrock', { display: 'Bedrock', cat: 'nature', group: G.ROCK, wiki: 'Bedrock', tex: T('bedrock'), hard: -1, blast: 3600000, sound: 'stone', flags: F.UNBREAK | F.RANDROT });
  def('magma_block', { display: 'Magma Block', cat: 'nature', group: G.ROCK, wiki: 'Magma_Block', tex: T('magma'), light: [3, 1, 0], hard: 0.5, blast: 0.5, tool: 'pick', needTool: true, sound: 'stone', hot: true, eternalFire: true });
  def('obsidian', { display: 'Obsidian', cat: 'nature', group: G.ROCK, wiki: 'Obsidian', tex: T('obsidian'), hard: 50, blast: 1200, tool: 'pick', needTool: true, tier: 4, sound: 'stone', flags: F.RANDROT });
  def('calcite', { display: 'Calcite', cat: 'nature', group: G.ROCK, wiki: 'Calcite', tex: T('calcite'), hard: 0.75, blast: 0.75, tool: 'pick', needTool: true, sound: 'calcite', flags: F.RANDROT });
  const dripP = [['dir', ['up', 'down']]];
  def('pointed_dripstone', { display: 'Pointed Dripstone', cat: 'nature', group: G.ROCK, wiki: 'Pointed_Dripstone', props: dripP, defaultIndex: 1, shape: 'drip', layer: 'cutout', tex: T('drip:dripstone:tip'), dripFam: 'dripstone', hard: 1.5, blast: 3, tool: 'pick', needTool: true, sound: 'dripstone', solid: true, flags: F.RANDTICK });
  def('dripstone_block', { display: 'Dripstone Block', cat: 'nature', group: G.ROCK, wiki: 'Dripstone_Block', tex: T('dripstone_block'), hard: 1.5, blast: 1, tool: 'pick', needTool: true, sound: 'dripstone', flags: F.RANDROT });
  def('sulfur_spike', { display: 'Sulfur Spike', cat: 'nature', group: G.ROCK, wiki: 'Sulfur_Spike', props: dripP, shape: 'drip', layer: 'cutout', tex: T('drip:sulfur:tip'), dripFam: 'sulfur', hard: 1.5, blast: 3, tool: 'pick', needTool: true, sound: 'stone', solid: true, flags: F.RANDTICK });
  def('fuming_sulfur', { display: 'Fuming Sulfur', cat: 'nature', group: G.ROCK, wiki: 'Potent_Sulfur', tex: T('fuming_sulfur'), hard: 1.5, blast: 6, tool: 'pick', needTool: true, sound: 'stone', flags: F.RANDTICK });

  // ============================ NATURAL: ORES =====================================
  const oreS = { hard: 3, blast: 3, tool: 'pick', needTool: true, sound: 'stone' };
  const deepS = { hard: 4.5, blast: 3, tool: 'pick', needTool: true, sound: 'deep' };
  const ORES = [
    ['coal', 'Coal', 1, ['coal', 1, 1], 'Coal_Ore'], ['copper', 'Copper', 2, ['raw_copper', 2, 5], 'Copper_Ore'], ['iron', 'Iron', 2, ['raw_iron', 1, 1], 'Iron_Ore'],
    ['gold', 'Gold', 3, ['raw_gold', 1, 1], 'Gold_Ore'], ['lapis', 'Lapis Lazuli', 2, ['lapis_lazuli', 4, 9], 'Lapis_Lazuli_Ore'], ['voltite', 'Voltite', 3, ['voltite_dust', 4, 5], 'Redstone_Ore'],
    ['diamond', 'Diamond', 3, ['diamond', 1, 1], 'Diamond_Ore'], ['emerald', 'Emerald', 3, ['emerald', 1, 1], 'Emerald_Ore']];
  VR.ORES = ORES;
  for (const [m, D, tier, drop, wiki] of ORES) {
    const volt = m === 'voltite';
    const extra = volt ? { props: [['lit', 2]], light: (p) => p.lit ? [9, 2, 1] : null, flags: F.RANDTICK, litOre: true } : {};
    def(m + '_ore', Object.assign({ display: D + ' Ore', cat: 'nature', group: G.ORE, wiki, tex: T('ore:' + m + ':stone'), tier, drops: drop, xp: [1, 3], oreOf: m }, oreS, extra));
    def('deepstone_' + m + '_ore', Object.assign({ display: 'Deepstone ' + D + ' Ore', cat: 'nature', group: G.ORE, wiki: 'Deepslate_' + wiki, tex: T('ore:' + m + ':deepstone'), tier, drops: drop, xp: [1, 3], oreOf: m }, deepS, extra));
  }
  def('ember_gold_ore', Object.assign({ display: 'Ember Gold Ore', cat: 'nature', group: G.ORE, wiki: 'Nether_Gold_Ore', tex: T('ore:gold:emberrock'), tier: 1, drops: ['gold_nugget', 2, 6], oreOf: 'gold' }, oreS, { sound: 'ember' }));
  def('ember_quartz_ore', Object.assign({ display: 'Ember Quartz Ore', cat: 'nature', group: G.ORE, wiki: 'Nether_Quartz_Ore', tex: T('ore:quartz:emberrock'), tier: 1, drops: ['quartz', 1, 1], oreOf: 'quartz' }, oreS, { sound: 'ember' }));
  def('relic_ore', { display: 'Relic Ore', cat: 'nature', group: G.ORE, wiki: 'Ancient_Debris', tex: { top: T('relic_ore_top'), side: T('relic_ore') }, hard: 30, blast: 1200, tool: 'pick', needTool: true, tier: 4, sound: 'stone', drops: 'relic_ore' });
  for (const [m, D] of [['copper', 'Copper'], ['iron', 'Iron'], ['gold', 'Gold']])
    def('raw_' + m + '_block', { display: 'Block of Raw ' + D, cat: 'nature', group: G.ORE, wiki: 'Block_of_Raw_' + D, tex: T('raw_block:' + m), hard: 5, blast: 6, tool: 'pick', needTool: true, tier: m === 'gold' ? 3 : 2, sound: 'stone' });
  def('budding_amethyst', { display: 'Budding Amethyst', cat: 'nature', group: G.ORE, wiki: 'Budding_Amethyst', tex: T('budding_amethyst'), hard: 1.5, blast: 1.5, tool: 'pick', needTool: true, sound: 'amethyst', dropsNothing: true, flags: F.RANDTICK, noPiston: 'break' });
  const BUDS = [['small_amethyst_bud', 'Small Amethyst Bud', 1, 7], ['medium_amethyst_bud', 'Medium Amethyst Bud', 2, 9], ['large_amethyst_bud', 'Large Amethyst Bud', 4, 11], ['amethyst_cluster', 'Amethyst Cluster', 5, 14]];
  for (const [id, D, lv, h] of BUDS) {
    const tx = T('amethyst:' + id);
    def(id, { display: D, cat: 'nature', group: G.ORE, wiki: id === 'amethyst_cluster' ? 'Amethyst_Cluster' : 'Amethyst_Bud', props: [FACING6], defaultIndex: 4, shape: 'model', layer: 'cutout', tex: tx, model: (p) => VR.orient6(cross(tx, { h, inset: 3 }), p.facing), light: [lv, Math.round(lv * 0.5), lv], hard: 1.5, blast: 1.5, tool: 'pick', needTool: true, sound: 'amethyst', solid: false, drops: id === 'amethyst_cluster' ? ['amethyst_shard', 4, 4] : 'nothing' });
  }

  // ============================ NATURAL: PLANTS =====================================
  const plantS = { cat: 'nature', group: G.PLANT, shape: 'model', layer: 'cutout', hard: 0, blast: 0, sound: 'plant', solid: false };
  const wv = FF.WAVE;
  function plant(id, disp, wiki, texName, o) {
    const tx = T(texName || id);
    return def(id, Object.assign({ display: disp, wiki, tex: tx, model: () => cross(tx, { flags: wv }), flags: F.PLANT, flam: [60, 100], jitter: true }, plantS, o || {}));
  }
  function tallPlant(id, disp, wiki, o) {
    const lo = T(id + '_bottom'), hi = T(id + '_top');
    return def(id, Object.assign({ display: disp, wiki, props: [HALF], tex: (p) => p.half ? hi : lo, model: (p) => cross(p.half ? hi : lo, { flags: wv }), flags: F.PLANT, tall: true, flam: [60, 100], jitter: true }, plantS, o || {}));
  }
  VR.plantDef = plant;
  plant('short_grass', 'Short Grass', 'Short_Grass', null, { tint: 'grass', flags: F.PLANT | F.REPLACE, drops: 'seeds_chance', tool: 'shears' });
  tallPlant('tall_grass', 'Tall Grass', 'Tall_Grass', { tint: 'grass', flags: F.PLANT | F.REPLACE, drops: 'seeds_chance' });
  plant('fern', 'Fern', 'Fern', null, { tint: 'grass', flags: F.PLANT | F.REPLACE, tool: 'shears' });
  tallPlant('large_fern', 'Large Fern', 'Large_Fern', { tint: 'grass', flags: F.PLANT | F.REPLACE });
  plant('bush', 'Bush', 'Bush', null, { tint: 'grass', tool: 'shears' });
  plant('dead_bush', 'Dead Bush', 'Dead_Bush', null, { flags: F.PLANT | F.REPLACE, drops: ['stick', 0, 2], dryPlant: true });
  plant('short_dry_grass', 'Short Dry Grass', 'Short_Dry_Grass', null, { flags: F.PLANT | F.REPLACE, tint: 'dry', dryPlant: true });
  plant('tall_dry_grass', 'Tall Dry Grass', 'Tall_Dry_Grass', null, { flags: F.PLANT | F.REPLACE, tint: 'dry', dryPlant: true });
  plant('red_shrub', 'Red Shrub', 'Red_Shrub', null, {});
  plant('firefly_bush', 'Firefly Bush', 'Firefly_Bush', null, { light: [2, 2, 1], fireflies: true });
  plant('hanging_roots', 'Hanging Roots', 'Hanging_Roots', null, { hangs: true, flags: 0 });
  plant('pale_hanging_moss', 'Pale Hanging Moss', 'Pale_Hanging_Moss', null, { hangs: true, flags: 0 });
  def('leaf_litter', Object.assign({ display: 'Leaf Litter', wiki: 'Leaf_Litter', props: [['count', [1, 2, 3, 4]], FACING4], tex: T('leaf_litter'), tint: 'dry', model: (p) => VR.groundCoverModel(p.count + 1, p.facing, T('leaf_litter')), flam: [60, 100], flags: F.PLANT | F.REPLACE }, plantS));
  def('azalea', Object.assign({ display: 'Azalea', wiki: 'Azalea', tex: T('azalea_top'), model: () => MD.cat(box([0, 8, 0, 16, 16, 16], { top: T('azalea_top'), side: T('azalea_side'), bottom: T('azalea_side') }, { cull: false }), cross(T('azalea_plant'), { h: 8 })), sapling: 'azalea', solid: true, flam: [30, 60] }, plantS, { solid: true }));
  def('flowering_azalea', Object.assign({ display: 'Flowering Azalea', wiki: 'Flowering_Azalea', tex: T('flowering_azalea_top'), model: () => MD.cat(box([0, 8, 0, 16, 16, 16], { top: T('flowering_azalea_top'), side: T('flowering_azalea_side'), bottom: T('azalea_side') }, { cull: false }), cross(T('azalea_plant'), { h: 8 })), sapling: 'azalea', flam: [30, 60] }, plantS, { solid: true }));
  def('cactus', { display: 'Cactus', cat: 'nature', group: G.PLANT, wiki: 'Cactus', props: [['age', 16]], shape: 'model', layer: 'cutout', tex: { top: T('cactus_top'), side: T('cactus_side'), bottom: T('cactus_bottom') }, model: () => box([1, 0, 1, 15, 16, 15], { top: T('cactus_top'), side: T('cactus_side'), bottom: T('cactus_bottom') }, { cull: false }), hard: 0.4, blast: 0.4, sound: 'wool', flags: F.RANDTICK | F.PLANT, hurts: 1, solid: true });
  def('bamboo', { display: 'Bamboo', cat: 'nature', group: G.PLANT, wiki: 'Bamboo', props: [['leaves', 3], ['age', 2]], shape: 'model', layer: 'cutout', tex: T('bamboo_stalk'), model: (p) => { const f = box([6.5, 0, 6.5, 9.5, 16, 9.5], { side: T('bamboo_stalk'), top: T('bamboo_top'), bottom: T('bamboo_top') }, { cull: false, uv: { 0: [0, 0, 3, 16], 1: [0, 0, 3, 16], 4: [0, 0, 3, 16], 5: [0, 0, 3, 16], 2: [13, 0, 16, 3], 3: [13, 0, 16, 3] } }); if (p.leaves) f.push(...cross(T(p.leaves === 2 ? 'bamboo_leaves_large' : 'bamboo_leaves_small'), { flags: FF.WAVELEAF })); return f; }, hard: 1, blast: 1, tool: 'axe', sound: 'bamboo', flags: F.RANDTICK | F.PLANT, flam: [60, 60], solid: true, fuel: 50 });
  def('bamboo_shoot', Object.assign({ display: 'Bamboo Shoot', wiki: 'Bamboo', tex: T('bamboo_shoot'), model: () => cross(T('bamboo_shoot'), { h: 12 }), flags: F.RANDTICK | F.PLANT, drops: 'bamboo', noItem: true }, plantS));
  def('big_dripleaf', { display: 'Big Dripleaf', cat: 'nature', group: G.PLANT, wiki: 'Big_Dripleaf', props: [FACING4, ['part', ['head', 'stem']], ['tilt', 3]], shape: 'model', layer: 'cutout', tex: T('big_dripleaf_top'), model: (p) => p.part === 0 ? MD.cat(rotY(box([0, 15 - p.tilt * 2, 0, 16, 15.5 - p.tilt * 2, 16], { top: T('big_dripleaf_top'), bottom: T('big_dripleaf_top'), side: T('big_dripleaf_side') }, { cull: false }), p.facing), cross(T('big_dripleaf_stem'), { h: 15, inset: 5 })) : cross(T('big_dripleaf_stem'), { inset: 5 }), hard: 0.1, blast: 0.1, tool: 'axe', sound: 'plant', flam: [60, 100], solid: (p) => p.part === 0 && p.tilt < 2, height: 15, dripleaf: true });
  plant('small_dripleaf', 'Small Dripleaf', 'Small_Dripleaf', 'small_dripleaf', { tool: 'shears' });
  plant('mangrove_propagule', 'Mangrove Propagule', 'Mangrove_Propagule', 'mangrove_propagule', { sapling: 'mangrove', flags: F.PLANT | F.RANDTICK });
  plant('palm_sapling', 'Royal Palm Sapling', 'Sapling', 'sapling:palm', { props: [['stage', 2]], sapling: 'palm', flags: F.PLANT | F.RANDTICK, fuel: 100 });
  def('mangrove_roots', { display: 'Mangrove Roots', cat: 'nature', group: G.PLANT, wiki: 'Mangrove_Roots', tex: { top: T('mangrove_roots_top'), side: T('mangrove_roots') }, layer: 'cutout', opaque: false, hard: 0.7, blast: 0.7, tool: 'axe', sound: 'roots', flam: [5, 20], flags: F.SELFCULL });
  def('muddy_mangrove_roots', { display: 'Muddy Mangrove Roots', cat: 'nature', group: G.PLANT, wiki: 'Muddy_Mangrove_Roots', props: [AXIS], tex: axisTex(T('muddy_mangrove_roots'), T('muddy_mangrove_roots_top')), hard: 0.7, blast: 0.7, tool: 'shovel', sound: 'mud' });
  def('moss_block', { display: 'Moss Block', cat: 'nature', group: G.PLANT, wiki: 'Moss_Block', tex: T('moss'), hard: 0.1, blast: 0.1, tool: 'hoe', sound: 'moss', flags: F.RANDROT, soil: true });
  def('moss_carpet', { display: 'Moss Carpet', cat: 'nature', group: G.PLANT, wiki: 'Moss_Carpet', shape: 'model', tex: T('moss'), model: () => VR.carpetModel(T('moss')), hard: 0.1, blast: 0.1, tool: 'hoe', sound: 'moss', solid: true, height: 1 });
  def('pale_moss_block', { display: 'Pale Moss Block', cat: 'nature', group: G.PLANT, wiki: 'Pale_Moss_Block', tex: T('pale_moss'), hard: 0.1, blast: 0.1, tool: 'hoe', sound: 'moss', flam: [5, 100], flags: F.RANDROT });
  def('pale_moss_carpet', { display: 'Pale Moss Carpet', cat: 'nature', group: G.PLANT, wiki: 'Pale_Moss_Carpet', shape: 'model', tex: T('pale_moss'), model: () => VR.carpetModel(T('pale_moss')), hard: 0.1, blast: 0.1, tool: 'hoe', sound: 'moss', solid: true, height: 1, flam: [5, 100] });
  def('resin_clump', Object.assign({ display: 'Resin Clump', wiki: 'Resin_Clump', props: [['faces', 64]], defaultIndex: 32, tex: T('resin_clump'), model: (p) => VR.faceSheetModel(p.faces || 32, T('resin_clump'), 0.1) }, plantS, { cat: 'nature' }));
  def('resin_block', { display: 'Block of Resin', cat: 'build', group: G.PLANT, wiki: 'Block_of_Resin', tex: T('resin_block'), hard: 0, blast: 0, sound: 'resin' });
  def('pale_heart', { display: 'Pale Heart', cat: 'nature', group: G.PLANT, wiki: 'Creaking_Heart', props: [AXIS, ['awake', 2]], tex: (p) => axisTex(T(p.awake ? 'pale_heart_awake' : 'pale_heart'), T('pale_heart_top'))(p), light: (p) => p.awake ? [9, 5, 1] : null, hard: 10, blast: 10, tool: 'axe', sound: 'wood', flags: F.RANDTICK });
  def('vines', { display: 'Vines', cat: 'nature', group: G.PLANT, wiki: 'Vines', props: [['faces', 32]], defaultIndex: 1, shape: 'model', layer: 'cutout', tex: T('vine'), tint: 'foliage', model: (p) => VR.faceSheetModel(p.faces & 31, T('vine'), 0.8, { flags: FF.WAVELEAF }), hard: 0.2, blast: 0.2, tool: 'shears', sound: 'vine', flam: [15, 100], flags: F.CLIMB | F.REPLACE | F.RANDTICK, solid: false });

  // Leaves & saplings
  const LEAF_TINT = { oak: 'foliage', jungle: 'foliage', acacia: 'foliage', dark_oak: 'foliage', mangrove: 'foliage', spruce: 'spruce', birch: 'birch' };
  const leafS = { cat: 'nature', group: G.PLANT, layer: 'cutout', opaque: false, hard: 0.2, blast: 0.2, tool: 'hoe', sound: 'leaves', flam: [30, 60], filter: 1 };
  const LEAVES = VR.WOODS.map(w => [w + '_leaves', VR.WOOD_NAME(w) + ' Leaves', w]).filter(x => x[2] !== 'poplar')
    .concat([['yellow_poplar_leaves', 'Yellow Poplar Leaves', 'poplar'], ['orange_poplar_leaves', 'Orange Poplar Leaves', 'poplar'], ['red_poplar_leaves', 'Red Poplar Leaves', 'poplar'],
      ['azalea_leaves', 'Azalea Leaves', 'azalea'], ['flowering_azalea_leaves', 'Flowering Azalea Leaves', 'azalea']]);
  VR.LEAVES = LEAVES;
  for (const [id, D, w] of LEAVES) {
    const texName = id.replace('_leaves', '');
    def(id, Object.assign({ display: D, wiki: w === 'poplar' ? 'Poplar_Leaves' : (w === 'azalea' ? 'Azalea_Leaves' : VR.WOOD_NAME(w).replace(' ', '_') + '_Leaves'), props: [['persistent', 2], ['distance', 8]], tex: T('leaves:' + texName), tint: LEAF_TINT[w] || 0, flags: F.LEAVES | F.RANDTICK | F.WAVELEAF, wood: w, sapling: w }, leafS));
  }
  for (const w of VR.WOODS) {
    if (w === 'mangrove') continue;
    plant(w + '_sapling', VR.WOOD_NAME(w) + ' Sapling', 'Sapling', 'sapling:' + w, { props: [['stage', 2]], sapling: w, flags: F.PLANT | F.RANDTICK, fuel: 100 });
  }

  // ============================ NATURAL: FLOWERS ====================================
  const flowerS = { group: G.FLOWER, flags: F.PLANT, flower: true };
  const FLOWERS = [['allium', 'Allium', 'Allium', 'magenta'], ['azure_bluet', 'Azure Bluet', 'Azure_Bluet', 'light_gray'], ['blue_orchid', 'Blue Orchid', 'Blue_Orchid', 'light_blue'],
    ['cactus_flower', 'Cactus Flower', 'Cactus_Flower', 'pink'], ['cornflower', 'Cornflower', 'Cornflower', 'blue'], ['dandelion', 'Dandelion', 'Dandelion', 'yellow'],
    ['golden_dandelion', 'Golden Dandelion', 'Golden_Dandelion', 'yellow'], ['lily_of_the_valley', 'Lily of the Valley', 'Lily_of_the_Valley', 'white'], ['oxeye_daisy', 'Oxeye Daisy', 'Oxeye_Daisy', 'light_gray'],
    ['poppy', 'Poppy', 'Poppy', 'red'], ['torchflower', 'Torchflower', 'Torchflower', 'orange'], ['red_tulip', 'Red Tulip', 'Tulip', 'red'], ['orange_tulip', 'Orange Tulip', 'Tulip', 'orange'],
    ['white_tulip', 'White Tulip', 'Tulip', 'light_gray'], ['pink_tulip', 'Pink Tulip', 'Tulip', 'pink'], ['blight_rose', 'Blight Rose', 'Wither_Rose', 'black']];
  VR.FLOWERS = FLOWERS;
  for (const [id, D, wiki, dye] of FLOWERS) plant(id, D, wiki, 'flower:' + id, Object.assign({ dye, hurts: id === 'blight_rose' ? 1 : 0, light: id === 'torchflower' ? [4, 2, 0] : null }, flowerS));
  def('moon_eye', Object.assign({ display: 'Moon-eye Bloom', wiki: 'Eyeblossom', props: [['open', 2]], tex: (p) => T(p.open ? 'flower:moon_eye_open' : 'flower:moon_eye'), model: (p) => cross(T(p.open ? 'flower:moon_eye_open' : 'flower:moon_eye'), { flags: wv | (p.open ? FF.EMIT : 0) }), light: (p) => p.open ? [5, 3, 1] : null, flags: F.PLANT | F.RANDTICK, dye: 'orange', flower: true }, plantS, { group: G.FLOWER }));
  const TALLF = [['lilac', 'Lilac', 'Lilac', 'magenta'], ['peony', 'Peony', 'Peony', 'pink'], ['rose_bush', 'Rose Bush', 'Rose_Bush', 'red'], ['sunflower', 'Sunflower', 'Sunflower', 'yellow'], ['pitcher_plant', 'Pitcher Plant', 'Pitcher_Plant', 'cyan']];
  for (const [id, D, wiki, dye] of TALLF) tallPlant(id, D, wiki, { group: G.FLOWER, dye, flower: true });
  def('pink_petals', Object.assign({ display: 'Pink Petals', wiki: 'Pink_Petals', props: [['count', [1, 2, 3, 4]], FACING4], tex: T('pink_petals'), model: (p) => VR.groundCoverModel(p.count + 1, p.facing, T('pink_petals')), flags: F.PLANT | F.REPLACE, dye: 'pink', flam: [60, 100] }, plantS, { group: G.FLOWER }));
  def('wildflowers', Object.assign({ display: 'Wildflowers', wiki: 'Wildflowers', props: [['count', [1, 2, 3, 4]], FACING4], tex: T('wildflowers'), model: (p) => VR.groundCoverModel(p.count + 1, p.facing, T('wildflowers')), flags: F.PLANT | F.REPLACE, dye: 'yellow', flam: [60, 100] }, plantS, { group: G.FLOWER }));
  def('spore_blossom', Object.assign({ display: 'Spore Blossom', wiki: 'Spore_Blossom', tex: T('spore_blossom'), model: () => MD.cat([quad([[1, 15.9, 1], [1, 15.9, 15], [15, 15.9, 15], [15, 15.9, 1]], T('spore_blossom_base'), [1, 1, 15, 15], 3, { double: true })], cross(T('spore_blossom'), { y0: 9, h: 7, inset: 1 })), hangs: true, spores: true }, plantS, { group: G.FLOWER }));

  // ============================ NATURAL: CROPS =======================================
  const cropS = { cat: 'food', group: G.CROP, shape: 'model', layer: 'cutout', hard: 0, blast: 0, sound: 'crop', solid: false, flags: F.PLANT | F.RANDTICK, crop: true };
  const CROPS = [['wheat', 8, 'Wheat_Seeds', 'wheat_seeds'], ['carrots', 8, 'Carrot', 'carrot'], ['potatoes', 8, 'Potato', 'potato'], ['beetroots', 4, 'Beetroot_Seeds', 'beetroot_seeds']];
  VR.CROPS = CROPS;
  for (const [id, n, wiki, seed] of CROPS) {
    def(id, Object.assign({ display: id[0].toUpperCase() + id.slice(1), wiki, props: [['age', n]], tex: (p) => T('crop:' + id + ':' + p.age), model: (p) => cropHash(T('crop:' + id + ':' + p.age), { flags: wv }), maxAge: n - 1, seed, noItem: true }, cropS));
  }
  def('glow_berry_vine', Object.assign({ display: 'Glow Berry Vine', wiki: 'Glow_Berries', props: [['berries', 2], ['tip', 2]], tex: (p) => T(p.berries ? 'glow_vine_berries' : 'glow_vine'), model: (p) => cross(T((p.tip ? 'glow_vine_tip' : 'glow_vine') + (p.berries ? '_berries' : '')), { flags: FF.WAVELEAF }), light: (p) => p.berries ? [14, 10, 4] : null, flags: F.CLIMB | F.RANDTICK, hangs: true, noItem: true, flam: [15, 60] }, cropS, { group: G.CROP }));
  def('starfruit_plant', { display: 'Starfruit Plant', cat: 'nature', group: G.CROP, wiki: 'Chorus_Plant', shape: 'chorus', layer: 'cutout', tex: T('starfruit_plant'), hard: 0.4, blast: 0.4, tool: 'axe', sound: 'wood', drops: ['starfruit', 0, 1], solid: true, conn: 6 });
  def('starfruit_flower', { display: 'Starfruit Flower', cat: 'nature', group: G.CROP, wiki: 'Chorus_Flower', props: [['age', 6]], shape: 'model', layer: 'cutout', tex: (p) => T(p.age >= 5 ? 'starfruit_flower_dead' : 'starfruit_flower'), model: (p) => box([2, 0, 2, 14, 14, 14], T(p.age >= 5 ? 'starfruit_flower_dead' : 'starfruit_flower')), hard: 0.4, blast: 0.4, tool: 'axe', sound: 'wood', flags: F.RANDTICK, solid: true, conn: 6 });
  def('cocoa', Object.assign({ display: 'Cocoa', wiki: 'Cocoa_Beans', props: [FACING4, ['age', 3]], tex: (p) => T('cocoa:' + p.age), model: (p) => { const s = [[6, 7, 11, 10, 12, 15], [5, 5, 9, 11, 12, 15], [4, 3, 7, 12, 12, 15]][p.age]; return rotY(box(s, T('cocoa:' + p.age), { cull: false }), p.facing - 2); }, hard: 0.2, blast: 3, tool: 'axe', noItem: true, maxAge: 2 }, cropS, { solid: true }));
  def('melon', { display: 'Melon', cat: 'food', group: G.CROP, wiki: 'Melon', tex: { top: T('melon_top'), side: T('melon_side') }, hard: 1, blast: 1, tool: 'axe', sound: 'wood', drops: ['melon_slice', 3, 7] });
  def('pumpkin', { display: 'Pumpkin', cat: 'food', group: G.CROP, wiki: 'Pumpkin', tex: { top: T('pumpkin_top'), side: T('pumpkin_side') }, hard: 1, blast: 1, tool: 'axe', sound: 'wood' });
  def('carved_pumpkin', { display: 'Carved Pumpkin', cat: 'food', group: G.CROP, wiki: 'Carved_Pumpkin', props: [FACING4], tex: VR.facingTex(T('carved_pumpkin'), T('pumpkin_side'), T('pumpkin_top')), hard: 1, blast: 1, tool: 'axe', sound: 'wood' });
  for (const [fr, D] of [['melon', 'Melon'], ['pumpkin', 'Pumpkin']]) {
    def(fr + '_stem', Object.assign({ display: D + ' Stem', wiki: D + '_Seeds', props: [['age', 8], ['attach', 5]], tint: 'stem', tex: (p) => T(p.attach ? 'stem_attached' : 'stem'), model: (p) => p.attach ? rotY([quad([[0, 10, 8], [0, 0, 8], [16, 0, 8], [16, 10, 8]], T('stem_attached'), [0, 6, 16, 16], 4, { double: true })], p.attach - 1) : cross(T('stem'), { h: 2 + p.age * 2 }), fruit: fr, maxAge: 7, noItem: true, seed: fr + '_seeds' }, cropS));
  }
  def('sugar_cane', Object.assign({ display: 'Sugar Cane', wiki: 'Sugar_Cane', props: [['age', 16]], tex: T('sugar_cane'), tint: 'grass', model: () => cross(T('sugar_cane')), cane: true }, cropS, { cat: 'nature', group: G.CROP }));
  def('sweet_berry_bush', Object.assign({ display: 'Sweet Berry Bush', wiki: 'Sweet_Berries', props: [['age', 4]], tex: (p) => T('sweet_berry_bush:' + p.age), model: (p) => cross(T('sweet_berry_bush:' + p.age), { flags: wv, h: p.age === 0 ? 8 : 16 }), slows: true, hurts: 1, maxAge: 3, noItem: true, flam: [60, 100] }, cropS));
  def('ashwart', Object.assign({ display: 'Ashwart', wiki: 'Nether_Wart', props: [['age', 4]], tex: (p) => T('ashwart:' + p.age), model: (p) => cropHash(T('ashwart:' + p.age), { h: 8 + p.age * 2 }), maxAge: 3, noItem: true, seed: 'ashwart_item' }, cropS, { group: G.FUNGUS }));
  def('hay_block', { display: 'Hay Bale', cat: 'food', group: G.CROP, wiki: 'Hay_Bale', props: [AXIS], tex: axisTex(T('hay_side'), T('hay_top')), hard: 0.5, blast: 0.5, tool: 'hoe', sound: 'grass', flam: [60, 20], softLanding: 0.2 });

  // ============================ NATURAL: FUNGI =====================================
  plant('brown_mushroom', 'Brown Mushroom', 'Brown_Mushroom', 'brown_mushroom', { group: G.FUNGUS, light: [1, 1, 1], flags: F.PLANT | F.RANDTICK, mushroom: true, flam: null });
  plant('red_mushroom', 'Red Mushroom', 'Red_Mushroom', 'red_mushroom', { group: G.FUNGUS, flags: F.PLANT | F.RANDTICK, mushroom: true, flam: null });
  def('shelf_mushroom', Object.assign({ display: 'Shelf Mushroom', wiki: 'Shelf_Mushroom', props: [FACING4, ['size', 2]], tex: T('shelf_mushroom'), model: (p) => rotY(p.size ? box([1, 6, 8, 15, 8, 16], { top: T('shelf_mushroom'), bottom: T('shelf_mushroom_under'), side: T('shelf_mushroom_under') }, { cull: false }) : box([4, 7, 11, 12, 8.5, 16], { top: T('shelf_mushroom'), bottom: T('shelf_mushroom_under'), side: T('shelf_mushroom_under') }, { cull: false }), p.facing), bouncy: true, flam: [60, 100] }, plantS, { group: G.FUNGUS, solid: true }));
  const mushT = (cap) => ({ tex: T(cap), fungusCap: true });
  def('brown_mushroom_block', Object.assign({ display: 'Brown Mushroom Block', cat: 'nature', group: G.FUNGUS, wiki: 'Mushroom_Blocks', hard: 0.2, blast: 0.2, tool: 'axe', sound: 'wood', drops: ['brown_mushroom', 0, 2], mushInside: T('mushroom_inside') }, mushT('brown_mushroom_block')));
  def('red_mushroom_block', Object.assign({ display: 'Red Mushroom Block', cat: 'nature', group: G.FUNGUS, wiki: 'Mushroom_Blocks', hard: 0.2, blast: 0.2, tool: 'axe', sound: 'wood', drops: ['red_mushroom', 0, 2], mushInside: T('mushroom_inside') }, mushT('red_mushroom_block')));
  def('mushroom_stem', { display: 'Mushroom Stem', cat: 'nature', group: G.FUNGUS, wiki: 'Mushroom_Blocks', tex: T('mushroom_stem'), hard: 0.2, blast: 0.2, tool: 'axe', sound: 'wood', mushInside: T('mushroom_inside') });
  def('glow_lichen', Object.assign({ display: 'Glow Lichen', wiki: 'Glow_Lichen', props: [['faces', 64]], defaultIndex: 32, tex: T('glow_lichen'), model: (p) => VR.faceSheetModel(p.faces || 32, T('glow_lichen'), 0.1), light: [5, 7, 6], hard: 0.2, blast: 0.2, tool: 'shears', flags: F.REPLACE, flam: [15, 100] }, plantS, { group: G.FUNGUS }));
  for (const [w, D, lightC] of [['crimson', 'Crimson', null], ['teal', 'Teal', null]]) {
    plant(w + '_fungus', D + ' Fungus', w === 'crimson' ? 'Crimson_Fungus' : 'Warped_Fungus', w + '_fungus', { group: G.FUNGUS, flags: F.PLANT, sapling: w, flam: null });
    plant(w + '_roots', D + ' Roots', w === 'crimson' ? 'Crimson_Roots' : 'Warped_Roots', w + '_roots', { group: G.FUNGUS, flags: F.PLANT | F.REPLACE, flam: null });
    def(w + '_wart_block', { display: D + ' Wart Block', cat: 'nature', group: G.FUNGUS, wiki: w === 'crimson' ? 'Nether_Wart_Block' : 'Warped_Wart_Block', tex: T(w + '_wart_block'), hard: 1, blast: 1, tool: 'hoe', sound: 'wart', flags: F.RANDROT });
  }
  plant('ember_sprouts', 'Ember Sprouts', 'Nether_Sprouts', 'ember_sprouts', { group: G.FUNGUS, flags: F.PLANT | F.REPLACE, flam: null });
  def('lumishroom', { display: 'Lumishroom', cat: 'nature', group: G.FUNGUS, wiki: 'Shroomlight', tex: T('lumishroom'), light: [15, 9, 4], hard: 1, blast: 1, tool: 'hoe', sound: 'wart' });
  def('weeping_vines', Object.assign({ display: 'Weeping Vines', wiki: 'Weeping_Vines', props: [['tip', 2]], tex: (p) => T(p.tip ? 'weeping_vines_tip' : 'weeping_vines'), model: (p) => cross(T(p.tip ? 'weeping_vines_tip' : 'weeping_vines'), { flags: FF.WAVELEAF }), flags: F.CLIMB | F.RANDTICK, hangs: true, flam: null }, plantS, { group: G.FUNGUS }));
  def('twisting_vines', Object.assign({ display: 'Twisting Vines', wiki: 'Twisting_Vines', props: [['tip', 2]], tex: (p) => T(p.tip ? 'twisting_vines_tip' : 'twisting_vines'), model: (p) => cross(T(p.tip ? 'twisting_vines_tip' : 'twisting_vines'), { flags: FF.WAVELEAF }), flags: F.CLIMB | F.RANDTICK, flam: null }, plantS, { group: G.FUNGUS }));

  // ============================ NATURAL: FAUNA ======================================
  def('bee_nest', { display: 'Bee Nest', cat: 'nature', group: G.FAUNA, wiki: 'Bee_Nest', props: [FACING4, ['honey', 6]], tex: (p) => VR.facingTex(T(p.honey >= 5 ? 'bee_nest_front_honey' : 'bee_nest_front'), T('bee_nest_side'), T('bee_nest_top'), T('bee_nest_bottom'))(p), hard: 0.3, blast: 0.3, tool: 'axe', sound: 'wood', flam: [30, 20], flags: F.RANDTICK | F.INTERACT });
  def('honeycomb_block', { display: 'Honeycomb Block', cat: 'nature', group: G.FAUNA, wiki: 'Honeycomb_Block', tex: T('honeycomb_block'), hard: 0.6, blast: 0.6, sound: 'coral' });
  def('bone_block', { display: 'Bone Block', cat: 'nature', group: G.FAUNA, wiki: 'Bone_Block', props: [AXIS], tex: axisTex(T('bone_block_side'), T('bone_block_top')), hard: 2, blast: 2, tool: 'pick', needTool: true, sound: 'bone' });
  def('cobweb', { display: 'Cobweb', cat: 'nature', group: G.FAUNA, wiki: 'Cobweb', shape: 'model', layer: 'cutout', tex: T('cobweb'), model: () => cross(T('cobweb'), { inset: 0 }), hard: 4, blast: 4, tool: 'shears', sound: 'cobweb', drops: 'string', solid: false, web: true });
  def('starborn_egg', { display: 'Starborn Egg', cat: 'nature', group: G.FAUNA, wiki: 'Dragon_Egg', shape: 'model', tex: T('starborn_egg'), model: () => MD.cat(box([6, 15, 6, 10, 16, 10], T('starborn_egg')), box([4, 14, 4, 12, 15, 12], T('starborn_egg')), box([3, 13, 3, 13, 14, 13], T('starborn_egg')), box([2, 11, 2, 14, 13, 14], T('starborn_egg')), box([1, 8, 1, 15, 11, 15], T('starborn_egg')), box([2, 3, 2, 14, 8, 14], T('starborn_egg')), box([3, 1, 3, 13, 3, 13], T('starborn_egg')), box([6, 0, 6, 10, 1, 10], T('starborn_egg'))), light: [1, 0, 2], hard: 3, blast: 9, sound: 'stone', flags: F.FALLING, solid: true });
  def('turtle_egg', { display: 'Turtle Egg', cat: 'nature', group: G.FAUNA, wiki: 'Turtle_Egg', props: [['eggs', [1, 2, 3, 4]], ['hatch', 3]], shape: 'model', layer: 'cutout', tex: T('turtle_egg'), model: (p) => { const pos = [[5, 4], [1, 7], [9, 9], [7, 1]]; const f = []; for (let i = 0; i <= p.eggs; i++) f.push(...box([pos[i][0], 0, pos[i][1], pos[i][0] + 4, 7, pos[i][1] + 4], T('turtle_egg'), { cull: false })); return f; }, hard: 0.5, blast: 0.5, sound: 'egg', solid: false, flags: F.RANDTICK });

  // ============================ NATURAL: AQUATIC =====================================
  const CORALS = ['tube', 'brain', 'bubble', 'fire', 'horn'];
  VR.CORALS = CORALS;
  for (const c of CORALS) {
    const D = c[0].toUpperCase() + c.slice(1);
    for (const dead of [false, true]) {
      const pre = dead ? 'dead_' : '', DP = dead ? 'Dead ' : '';
      def(pre + c + '_coral_block', { display: DP + D + ' Coral Block', cat: 'nature', group: G.AQUA, wiki: dead ? 'Dead_Coral_Block' : 'Coral_Block', tex: T('coral_block:' + pre + c), hard: 1.5, blast: 6, tool: 'pick', needTool: true, sound: 'coral', flags: dead ? 0 : F.RANDTICK, coral: !dead });
      def(pre + c + '_coral', { display: DP + D + ' Coral', cat: 'nature', group: G.AQUA, wiki: dead ? 'Dead_Coral' : 'Coral', shape: 'model', layer: 'cutout', tex: T('coral:' + pre + c), model: () => cross(T('coral:' + pre + c)), hard: 0, blast: 0, sound: 'coral', solid: false, flags: (dead ? 0 : F.WATERLOG) | F.PLANT, coral: !dead });
      def(pre + c + '_coral_fan', { display: DP + D + ' Coral Fan', cat: 'nature', group: G.AQUA, wiki: dead ? 'Dead_Coral_Fan' : 'Coral_Fan', shape: 'model', layer: 'cutout', tex: T('coral_fan:' + pre + c), model: () => VR.fanModel(T('coral_fan:' + pre + c)), hard: 0, blast: 0, sound: 'coral', solid: false, flags: (dead ? 0 : F.WATERLOG) | F.PLANT, coral: !dead });
    }
  }
  def('kelp', { display: 'Kelp', cat: 'nature', group: G.AQUA, wiki: 'Kelp', props: [['tip', 2], ['age', 16]], shape: 'model', layer: 'cutout', tex: T('kelp'), model: (p) => cross(T(p.tip ? 'kelp' : 'kelp_plant'), { flags: FF.WAVELEAF }), hard: 0, blast: 0, sound: 'plant', solid: false, flags: F.WATERLOG | F.RANDTICK });
  def('dried_kelp_block', { display: 'Dried Kelp Block', cat: 'nature', group: G.AQUA, wiki: 'Dried_Kelp_Block', tex: { top: T('dried_kelp_top'), side: T('dried_kelp_side') }, hard: 0.5, blast: 2.5, tool: 'hoe', sound: 'grass', flam: [30, 60], fuel: 4000 });
  def('lily_pad', { display: 'Lily Pad', cat: 'nature', group: G.AQUA, wiki: 'Lily_Pad', shape: 'model', layer: 'cutout', tex: T('lily_pad'), tint: 0x208030, model: () => [quad([[0, 0.25, 0], [0, 0.25, 16], [16, 0.25, 16], [16, 0.25, 0]], T('lily_pad'), [0, 0, 16, 16], 2, { double: true })], hard: 0, blast: 0, sound: 'plant', solid: true, height: 0.25, onWater: true, randomRot: true });
  def('sea_pickle', { display: 'Sea Pickle', cat: 'nature', group: G.AQUA, wiki: 'Sea_Pickle', props: [['pickles', [1, 2, 3, 4]], ['wet', 2]], shape: 'model', layer: 'cutout', tex: T('sea_pickle'), model: (p) => { const pos = [[6, 6, 6], [3, 3, 6], [3, 8, 4], [9, 4, 6]]; const f = []; for (let i = 0; i <= p.pickles; i++) { const [x, z, h] = pos[i]; f.push(...box([x, 0, z, x + 4, h, z + 4], T('sea_pickle'), { cull: false, uv: { 2: [4, 0, 8, 4], 3: [8, 0, 12, 4], 0: [0, 5, 4, 5 + h], 1: [0, 5, 4, 5 + h], 4: [0, 5, 4, 5 + h], 5: [0, 5, 4, 5 + h] } })); } return f; }, light: (p) => p.wet ? [Math.min(15, 6 + p.pickles * 3) * 0.5 | 0, Math.min(15, 6 + p.pickles * 3), Math.min(15, 6 + p.pickles * 3) - 2] : null, hard: 0, blast: 0, sound: 'slime', solid: false });
  def('seagrass', { display: 'Seagrass', cat: 'nature', group: G.AQUA, wiki: 'Seagrass', shape: 'model', layer: 'cutout', tex: T('seagrass'), model: () => cross(T('seagrass'), { flags: FF.WAVELEAF }), hard: 0, blast: 0, sound: 'plant', solid: false, flags: F.WATERLOG | F.REPLACE, tool: 'shears' });
  def('tall_seagrass', { display: 'Tall Seagrass', cat: 'nature', group: G.AQUA, wiki: 'Seagrass', props: [HALF], shape: 'model', layer: 'cutout', tex: (p) => T(p.half ? 'tall_seagrass_top' : 'tall_seagrass_bottom'), model: (p) => cross(T(p.half ? 'tall_seagrass_top' : 'tall_seagrass_bottom'), { flags: FF.WAVELEAF }), hard: 0, blast: 0, sound: 'plant', solid: false, flags: F.WATERLOG | F.REPLACE, tall: true, noItem: true });

  // ============================ NATURAL: ECHO (sculk analog) ============================
  def('echo_moss', { display: 'Echo Moss', cat: 'nature', group: G.ECHO, wiki: 'Sculk', tex: T('echo_moss'), hard: 0.2, blast: 0.2, tool: 'hoe', sound: 'echo', flags: F.RANDROT, xp: [1, 1] });
  def('echo_heart', { display: 'Echo Heart', cat: 'nature', group: G.ECHO, wiki: 'Sculk_Catalyst', tex: { top: T('echo_heart_top'), side: T('echo_heart_side'), bottom: T('echo_moss') }, light: [2, 7, 7], hard: 3, blast: 3, tool: 'hoe', sound: 'echo' });
  def('echo_sensor', { display: 'Echo Sensor', cat: 'volt', group: G.ECHO, wiki: 'Sculk_Sensor', props: [['phase', 3], ['power', 16]], shape: 'model', layer: 'cutout', tex: T('echo_sensor_top'), model: (p) => MD.cat(box([0, 0, 0, 16, 8, 16], { top: T('echo_sensor_top'), side: T('echo_sensor_side'), bottom: T('echo_moss') }), cross(T(p.phase === 1 ? 'echo_tendril_active' : 'echo_tendril'), { y0: 8, h: 8, inset: 4, flags: p.phase === 1 ? FF.EMIT : 0 })), light: [1, 3, 3], hard: 1.5, blast: 1.5, tool: 'hoe', sound: 'echo', solid: true, height: 8, sensor: true });
  def('echo_horn', { display: 'Echo Horn', cat: 'nature', group: G.ECHO, wiki: 'Sculk_Shrieker', props: [['active', 2]], shape: 'model', layer: 'cutout', tex: T('echo_horn_top'), model: () => box([0, 0, 0, 16, 8, 16], { top: T('echo_horn_top'), side: T('echo_horn_side'), bottom: T('echo_moss') }), hard: 3, blast: 3, tool: 'hoe', sound: 'echo', solid: true, height: 8 });
  def('echo_vein', Object.assign({ display: 'Echo Vein', wiki: 'Sculk_Vein', props: [['faces', 64]], defaultIndex: 32, tex: T('echo_vein'), model: (p) => VR.faceSheetModel(p.faces || 32, T('echo_vein'), 0.1), hard: 0.2, blast: 0.2, tool: 'hoe', sound: 'echo', flags: F.REPLACE }, plantS, { group: G.ECHO }));

  // ============================ NATURAL: FLUIDS & ICE ===================================
  def('water', { display: 'Water', cat: null, group: G.FLUID, wiki: 'Water', props: [['level', 16]], shape: 'fluid', layer: 'trans', tex: T('water_still'), tint: 'water', filter: 1, hard: 100, blast: 100, solid: false, flags: F.FLUID | F.WATER | F.REPLACE, sound: 'water', noItem: true });
  def('lava', { display: 'Lava', cat: null, group: G.FLUID, wiki: 'Lava', props: [['level', 16]], shape: 'fluid', layer: 'opaque', tex: T('lava_still'), light: [15, 9, 3], filter: 1, hard: 100, blast: 100, solid: false, opaque: false, flags: F.FLUID | F.LAVA | F.REPLACE | F.EMISSIVE, sound: 'lava', noItem: true });
  def('bubble_column', { display: 'Bubble Column', cat: null, group: G.FLUID, wiki: 'Bubble_Column', props: [['drag', 2]], shape: 'fluid', layer: 'trans', tex: T('water_still'), tint: 'water', filter: 1, hard: 100, blast: 100, solid: false, flags: F.FLUID | F.WATER | F.REPLACE, noItem: true, bubbles: true });
  def('ice', { display: 'Ice', cat: 'nature', group: G.FLUID, wiki: 'Ice', tex: T('ice'), layer: 'trans', opaque: false, filter: 1, hard: 0.5, blast: 0.5, tool: 'pick', sound: 'glass', slip: 0.98, flags: F.SELFCULL | F.RANDTICK, silkOnly: true });
  def('packed_ice', { display: 'Packed Ice', cat: 'nature', group: G.FLUID, wiki: 'Packed_Ice', tex: T('packed_ice'), hard: 0.5, blast: 0.5, tool: 'pick', sound: 'glass', slip: 0.98, silkOnly: true });
  def('blue_ice', { display: 'Blue Ice', cat: 'nature', group: G.FLUID, wiki: 'Blue_Ice', tex: T('blue_ice'), hard: 2.8, blast: 2.8, tool: 'pick', sound: 'glass', slip: 0.989, silkOnly: true });
  def('ice_crystal', { display: 'Ice Crystal', cat: 'nature', group: G.FLUID, wiki: 'Ice_Crystal', props: [FACING6, ['size', 3]], defaultIndex: 4, shape: 'model', layer: 'cutout', tex: T('ice_crystal'), model: (p) => VR.orient6(cross(T('ice_crystal'), { h: 8 + p.size * 4, inset: 2, flags: FF.EMIT }), p.facing), light: [6, 10, 14], hard: 1, blast: 1, tool: 'pick', sound: 'amethyst', solid: false });
  def('icicle', { display: 'Icicle', cat: 'nature', group: G.FLUID, wiki: 'Icicle', props: dripP, defaultIndex: 1, shape: 'drip', layer: 'cutout', tex: T('drip:icicle:tip'), dripFam: 'icicle', hard: 0.5, blast: 0.5, tool: 'pick', sound: 'glass', solid: true, flags: F.RANDTICK, melts: true });
  def('snow', { display: 'Snow', cat: 'nature', group: G.FLUID, wiki: 'Snow', props: [['layers', [1, 2, 3, 4, 5, 6, 7, 8]]], shape: (p) => p.layers === 7 ? 'cube' : 'model', tex: T('snow'), model: (p) => p.layers === 7 ? null : VR.layerModel(p.layers + 1, T('snow')), opaque: (p) => p.layers === 7, filter: (p) => p.layers === 7 ? 15 : 0, hard: 0.1, blast: 0.1, tool: 'shovel', sound: 'snow', flags: F.RANDTICK, solid: (p) => p.layers > 0, height: (p) => (p.layers) * 2, drops: ['snowball', 1, 1], replaceable: (p) => p.layers === 0, snowLayer: true });
  def('powder_snow', { display: 'Powder Snow', cat: 'nature', group: G.FLUID, wiki: 'Powder_Snow', tex: T('powder_snow'), layer: 'trans', opaque: false, filter: 1, solid: false, hard: 0.25, blast: 0.25, sound: 'snow', flags: F.SELFCULL | F.SLOW, powder: true, noItem: true });
  def('snow_block', { display: 'Snow Block', cat: 'nature', group: G.FLUID, wiki: 'Snow_Block', tex: T('snow'), hard: 0.2, blast: 0.2, tool: 'shovel', sound: 'snow', drops: ['snowball', 4, 4] });

  // ============================ NATURAL: NON-PHYSICAL ===================================
  const fireT = TA('fire', 8), sfireT = TA('spirit_fire', 8);
  def('fire', { display: 'Fire', cat: null, group: G.NONPHYS, wiki: 'Fire', props: [['age', 16]], shape: 'model', layer: 'cutout', tex: fireT, model: () => VR.fireModel(fireT), light: [15, 10, 5], hard: 0, blast: 0, solid: false, flags: F.REPLACE | F.RANDTICK, noItem: true, fire: true });
  def('spirit_fire', { display: 'Spirit Fire', cat: null, group: G.NONPHYS, wiki: 'Soul_Fire', shape: 'model', layer: 'cutout', tex: sfireT, model: () => VR.fireModel(sfireT), light: [4, 9, 11], hard: 0, blast: 0, solid: false, flags: F.REPLACE, noItem: true, fire: true });
  VR.fireModel = function (tx) {
    const fl = FF.EMIT | FF.WAVE * 0;
    return MD.cat(cross(tx, { inset: 1.5, flags: fl }),
      [quad([[0, 16, 1], [0, 0, 1], [16, 0, 1], [16, 16, 1]], tx, [0, 0, 16, 16], 4, { double: true, flags: fl }),
        quad([[16, 16, 15], [16, 0, 15], [0, 0, 15], [0, 16, 15]], tx, [0, 0, 16, 16], 5, { double: true, flags: fl }),
        quad([[1, 16, 16], [1, 0, 16], [1, 0, 0], [1, 16, 0]], tx, [0, 0, 16, 16], 0, { double: true, flags: fl }),
        quad([[15, 16, 0], [15, 0, 0], [15, 0, 16], [15, 16, 16]], tx, [0, 0, 16, 16], 1, { double: true, flags: fl })]);
  };
})(VR);
