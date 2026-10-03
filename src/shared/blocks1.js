// ============================================================================
// Block definitions part 1 — Structural (mirrors minecraft.wiki Block navigation:
// Lumber, Stone/Deepslate, Overworld, Nether→Underforge, End→Hollow, Mineral)
// Names for franchise-specific things are our own; `wiki` keeps the research ref.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, T = R.tex, TA = R.texAnim, MD = VR.MODEL, F = VR.F, ROT = R.ROT;
  const G = VR.GROUPS = {
    LUMBER: 'Structural · Lumber', STONE: 'Structural · Stone & Deepstone', OVER: 'Structural · Surface Stones',
    FORGE: 'Structural · Underforge', HOLLOW: 'Structural · Hollow', MINERAL: 'Structural · Mineral',
    DECOR: 'Ornamental · Decorative', PARTIAL: 'Ornamental · Partial Blocks', DYED: 'Ornamental · Dyeable',
    LIGHT: 'Ornamental · Lighting', EDU: 'Ornamental · Laboratory',
    SOIL: 'Natural · Sediment & Soil', ROCK: 'Natural · Misc. Rock', ORE: 'Natural · Ores & Minerals',
    PLANT: 'Natural · Plants', FLOWER: 'Natural · Flowers', CROP: 'Natural · Crops', FUNGUS: 'Natural · Fungi',
    FAUNA: 'Natural · Fauna', AQUA: 'Natural · Aquatic', ECHO: 'Natural · Echo', FLUID: 'Natural · Fluids & Ice',
    NONPHYS: 'Natural · Non-physical', INTER: 'Utility · Interactable', UTIL: 'Utility · Utilizable',
    MECH: 'Utility · Volt & Mechanical', LAB: 'Utility · Laboratory', CREATIVE: 'Creative & Technical', LEGACY: 'Legacy & Curios'
  };
  VR.GROUP_ORDER = Object.values(G);

  const def = (name, o) => R.def(name, o);
  VR.BL = { def, G };

  // ---- common prop sets --------------------------------------------------------
  const AXIS = ['axis', ['y', 'x', 'z']];
  const FACING4 = ['facing', ['north', 'east', 'south', 'west']];
  const FACING6 = ['facing', ['north', 'east', 'south', 'west', 'up', 'down']];
  const HALF = ['half', ['bottom', 'top']];
  const SLABT = ['type', ['bottom', 'top', 'double']];
  VR.PROPS = { AXIS, FACING4, FACING6, HALF, SLABT };

  // Axis-oriented cube textures (logs, pillars)
  function axisTex(side, end, sideRot) {
    return (p) => {
      const a = p.axis;
      if (a === 0) return { top: end, bottom: end, side };
      if (a === 1) return { east: end, west: end, top: ROT(side, 1), bottom: ROT(side, 1), north: ROT(side, 1), south: ROT(side, 1) };
      return { north: end, south: end, top: side, bottom: side, east: ROT(side, 1), west: ROT(side, 1) };
    };
  }
  VR.axisTex = axisTex;

  // facing cube (front on facing side). facing idx 0 N,1 E,2 S,3 W
  function facingTex(front, side, top, bottom) {
    return (p) => {
      const o = { top, bottom: bottom !== undefined ? bottom : top, side };
      const key = ['north', 'east', 'south', 'west'][p.facing];
      o[key] = front;
      return o;
    };
  }
  VR.facingTex = facingTex;
  function facing6Tex(front, side, back) {
    return (p) => {
      const names = ['north', 'east', 'south', 'west', 'top', 'bottom'];
      const opp = { north: 'south', south: 'north', east: 'west', west: 'east', top: 'bottom', bottom: 'top' };
      const o = { side };
      const k = names[p.facing];
      o[k] = front; if (back !== undefined) o[opp[k]] = back;
      // sides for vertical-facing rotate
      return o;
    };
  }
  VR.facing6Tex = facing6Tex;

  // Block family helpers ---------------------------------------------------------
  function texObj(tx) { return typeof tx === 'number' ? { top: tx, bottom: tx, side: tx } : { top: tx.top !== undefined ? tx.top : tx.all, bottom: tx.bottom !== undefined ? tx.bottom : (tx.top !== undefined ? tx.top : tx.all), side: tx.side !== undefined ? tx.side : tx.all }; }
  VR.texObj = texObj;
  function slab(name, tx, o) {
    const t = texObj(tx);
    const tex6 = { 0: t.side, 1: t.side, 2: t.top, 3: t.bottom, 4: t.side, 5: t.side };
    const base = Object.assign({}, o);
    return def(name, Object.assign(base, {
      props: [SLABT], shape: (p) => p.type === 2 ? 'cube' : 'model', tex: tx,
      opaque: (p) => p.type === 2 && !(o && o.layer && o.layer !== 'opaque'),
      model: (p) => p.type === 0 ? MD.box([0, 0, 0, 16, 8, 16], tex6) : p.type === 1 ? MD.box([0, 8, 0, 16, 16, 16], tex6) : null,
      filter: (p) => p.type === 2 ? 15 : 0, kind: 'slab', solid: true,
    }));
  }
  function stairs(name, tx, o) {
    return def(name, Object.assign({}, o, { props: [FACING4, HALF], shape: 'stairs', tex: tx, kind: 'stairs', solid: true }));
  }
  function wall(name, tx, o) {
    return def(name, Object.assign({}, o, { shape: 'wall', tex: tx, kind: 'wall', conn: 3, solid: true }));
  }
  function fence(name, tx, o, connGroup) {
    return def(name, Object.assign({}, o, { shape: 'fence', tex: tx, kind: 'fence', conn: connGroup || 1, solid: true }));
  }
  VR.FAM = { slab, stairs, wall, fence };

  // Stone-like family: base + optional slab/stairs/wall
  function stoneFamily(id, disp, tx, stats, grp, wiki, opts) {
    opts = opts || {};
    const common = Object.assign({ cat: 'build', group: grp, sound: 'stone', tool: 'pick', needTool: true, tier: 1 }, stats);
    const b = opts.noBase ? null : def(id, Object.assign({ display: disp, tex: tx, wiki, flags: opts.flags || 0 }, common, opts.base || {}));
    const baseName = opts.familyName || id.replace(/_block$/, '').replace(/s$/, '');
    const fd = opts.famDisp || disp.replace(/s$/, '');
    const pc = Object.assign({}, common, { group: G.PARTIAL });
    if (opts.slab) slab(baseName + '_slab', tx, Object.assign({ display: fd + ' Slab', wiki: opts.slabWiki || 'Slab', parent: id }, pc));
    if (opts.stairs) stairs(baseName + '_stairs', tx, Object.assign({ display: fd + ' Stairs', wiki: 'Stairs', parent: id }, pc));
    if (opts.wall) wall(baseName + '_wall', tx, Object.assign({ display: fd + ' Wall', wiki: 'Wall', parent: id }, pc));
    return b;
  }
  VR.stoneFamily = stoneFamily;

  // ============================ LUMBER ==========================================
  const WOODS = VR.WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'pale_oak', 'poplar'];
  const FORGE_WOODS = VR.FORGE_WOODS = ['crimson', 'teal'];
  const WOOD_NAME = (w) => w.split('_').map(s => s[0].toUpperCase() + s.slice(1)).join(' ');
  VR.WOOD_NAME = WOOD_NAME;
  const woodStats = { hard: 2, blast: 2, tool: 'axe', sound: 'wood', flam: [5, 5] };
  const plankStats = { hard: 2, blast: 3, tool: 'axe', sound: 'wood', flam: [5, 20] };

  function woodSet(w, nether) {
    const W = WOOD_NAME(w);
    const logT = T('log:' + w), topT = T('log_top:' + w), sLogT = T('stripped_log:' + w), sTopT = T('stripped_log_top:' + w);
    const planksT = T('planks:' + w);
    const logWord = nether ? 'Stalk' : 'Log', woodWord = nether ? 'Hyphae' : 'Wood';
    const lid = nether ? w + '_stalk' : w + '_log', wid = nether ? w + '_hyphae' : w + '_wood';
    const flam = nether ? null : [5, 5];
    const extra = nether ? { flags: F.EMISSIVE * 0 } : {};
    def(lid, Object.assign({ display: W + ' ' + logWord, cat: 'build', group: G.LUMBER, wiki: nether ? 'Stems' : 'Log', props: [AXIS], tex: axisTex(logT, topT) }, woodStats, { flam }, extra));
    def(wid, Object.assign({ display: W + ' ' + woodWord, cat: 'build', group: G.LUMBER, wiki: nether ? 'Hyphae' : 'Wood', props: [AXIS], tex: axisTex(logT, logT) }, woodStats, { flam }));
    def('stripped_' + lid, Object.assign({ display: 'Stripped ' + W + ' ' + logWord, cat: 'build', group: G.LUMBER, wiki: 'Stripped_Log', props: [AXIS], tex: axisTex(sLogT, sTopT) }, woodStats, { flam }));
    def('stripped_' + wid, Object.assign({ display: 'Stripped ' + W + ' ' + woodWord, cat: 'build', group: G.LUMBER, wiki: 'Stripped_Wood', props: [AXIS], tex: axisTex(sLogT, sLogT) }, woodStats, { flam }));
    woodBuilding(w, W, planksT, nether ? null : [5, 20]);
  }
  function woodBuilding(w, W, planksT, flam) {
    const ps = Object.assign({}, plankStats, { flam });
    def(w + '_planks', Object.assign({ display: W + ' Planks', cat: 'build', group: G.LUMBER, wiki: 'Planks', tex: planksT }, ps));
    slab(w + '_slab', planksT, Object.assign({ display: W + ' Slab', cat: 'build', group: G.PARTIAL, wiki: 'Wooden_Slab', parent: w + '_planks' }, ps));
    stairs(w + '_stairs', planksT, Object.assign({ display: W + ' Stairs', cat: 'build', group: G.PARTIAL, wiki: 'Wooden_Stairs', parent: w + '_planks' }, ps));
    fence(w + '_fence', planksT, Object.assign({ display: W + ' Fence', cat: 'build', group: G.PARTIAL, wiki: 'Wooden_Fence', layer: 'opaque' }, ps), 1);
    def(w + '_fence_gate', Object.assign({ display: W + ' Fence Gate', cat: 'volt', group: G.MECH, wiki: 'Fence_Gate', props: [FACING4, ['open', 2]], shape: 'model', tex: planksT, kind: 'gate', conn: 1, flags: F.INTERACT, model: (p) => VR.gateModel(p, planksT) }, ps));
    const dt = T('door_top:' + w), db = T('door_bottom:' + w), tdT = T('trapdoor:' + w);
    def(w + '_door', Object.assign({ display: W + ' Door', cat: 'volt', group: G.MECH, wiki: 'Wooden_Door', props: [FACING4, HALF, ['open', 2], ['hinge', ['left', 'right']]], shape: 'model', layer: 'cutout', kind: 'door', flags: F.INTERACT, model: (p) => VR.doorModel(p, p.half ? dt : db), tex: db }, ps, { hard: 3, blast: 3 }));
    def(w + '_trapdoor', Object.assign({ display: W + ' Trapdoor', cat: 'volt', group: G.MECH, wiki: 'Wooden_Trapdoor', props: [FACING4, HALF, ['open', 2]], shape: 'model', layer: 'cutout', kind: 'trapdoor', flags: F.INTERACT, model: (p) => VR.trapdoorModel(p, tdT), tex: tdT }, ps, { hard: 3, blast: 3 }));
    def(w + '_button', Object.assign({ display: W + ' Button', cat: 'volt', group: G.MECH, wiki: 'Wooden_Button', props: [['face', ['floor', 'wall', 'ceiling']], FACING4, ['powered', 2]], shape: 'model', kind: 'button', pulse: 30, solid: false, flags: F.INTERACT, model: (p) => VR.buttonModel(p, planksT), tex: planksT }, ps, { hard: 0.5, blast: 0.5 }));
    def(w + '_pressure_plate', Object.assign({ display: W + ' Pressure Plate', cat: 'volt', group: G.MECH, wiki: 'Wooden_Pressure_Plate', props: [['powered', 2]], shape: 'model', kind: 'plate', detect: 'all', solid: false, model: (p) => VR.plateModel(p, planksT), tex: planksT }, ps, { hard: 0.5, blast: 0.5 }));
  }
  for (const w of WOODS) woodSet(w, false);
  // Bamboo lumber
  {
    const side = T('bamboo_block'), top = T('bamboo_block_top'), sside = T('stripped_bamboo_block'), stop = T('stripped_bamboo_block_top');
    def('bamboo_block', Object.assign({ display: 'Block of Bamboo', cat: 'build', group: G.LUMBER, wiki: 'Block_of_Bamboo', props: [AXIS], tex: axisTex(side, top) }, woodStats));
    def('stripped_bamboo_block', Object.assign({ display: 'Block of Stripped Bamboo', cat: 'build', group: G.LUMBER, wiki: 'Block_of_Stripped_Bamboo', props: [AXIS], tex: axisTex(sside, stop) }, woodStats));
    woodBuilding('bamboo', 'Bamboo', T('planks:bamboo'), [5, 20]);
    const mos = T('bamboo_mosaic');
    def('bamboo_mosaic', Object.assign({ display: 'Bamboo Mosaic', cat: 'build', group: G.LUMBER, wiki: 'Bamboo_Mosaic', tex: mos }, plankStats));
    slab('bamboo_mosaic_slab', mos, Object.assign({ display: 'Bamboo Mosaic Slab', cat: 'build', group: G.PARTIAL, wiki: 'Slab', parent: 'bamboo_mosaic' }, plankStats));
    stairs('bamboo_mosaic_stairs', mos, Object.assign({ display: 'Bamboo Mosaic Stairs', cat: 'build', group: G.PARTIAL, wiki: 'Stairs', parent: 'bamboo_mosaic' }, plankStats));
  }
  for (const w of FORGE_WOODS) woodSet(w, true);

  // ============================ STONE / DEEPSTONE ==================================
  const S15 = { hard: 1.5, blast: 6 }, S2 = { hard: 2, blast: 6 }, D3 = { hard: 3, blast: 6 }, D35 = { hard: 3.5, blast: 6 };
  const stoneFlags = F.RANDROT | F.MACRO;
  stoneFamily('stone', 'Stone', T('stone'), S15, G.STONE, 'Stone', { slab: 1, stairs: 1, flags: stoneFlags, base: { drops: 'cobblestone' } });
  stoneFamily('cobblestone', 'Cobblestone', T('cobblestone'), S2, G.STONE, 'Cobblestone', { slab: 1, stairs: 1, wall: 1, flags: F.MACRO });
  stoneFamily('mossy_cobblestone', 'Mossy Cobblestone', T('mossy_cobblestone'), S2, G.STONE, 'Mossy_Cobblestone', { slab: 1, stairs: 1, wall: 1 });
  stoneFamily('smooth_stone', 'Smooth Stone', T('smooth_stone'), S2, G.STONE, 'Smooth_Stone', {});
  slab('smooth_stone_slab', { top: T('smooth_stone'), side: T('smooth_stone_slab_side') }, { display: 'Smooth Stone Slab', cat: 'build', group: G.PARTIAL, wiki: 'Slab', sound: 'stone', tool: 'pick', needTool: true, hard: 2, blast: 6 });
  stoneFamily('stone_bricks', 'Stone Bricks', T('stone_bricks'), S15, G.STONE, 'Stone_Bricks', { slab: 1, stairs: 1, wall: 1, familyName: 'stone_brick' });
  stoneFamily('chiseled_stone_bricks', 'Chiseled Stone Bricks', T('chiseled_stone_bricks'), S15, G.STONE, 'Chiseled_Stone_Bricks');
  stoneFamily('cracked_stone_bricks', 'Cracked Stone Bricks', T('cracked_stone_bricks'), S15, G.STONE, 'Cracked_Stone_Bricks');
  stoneFamily('mossy_stone_bricks', 'Mossy Stone Bricks', T('mossy_stone_bricks'), S15, G.STONE, 'Mossy_Stone_Bricks', { slab: 1, stairs: 1, wall: 1, familyName: 'mossy_stone_brick' });
  for (const r of ['granite', 'diorite', 'andesite']) {
    const D = r[0].toUpperCase() + r.slice(1);
    stoneFamily(r, D, T(r), S15, G.STONE, D, { slab: 1, stairs: 1, wall: 1, flags: stoneFlags });
    stoneFamily('polished_' + r, 'Polished ' + D, T('polished_' + r), S15, G.STONE, 'Polished_' + D, { slab: 1, stairs: 1 });
  }
  stoneFamily('deepstone', 'Deepstone', { top: T('deepstone_top'), side: T('deepstone') }, D3, G.STONE, 'Deepslate', { base: { props: [AXIS], tex: axisTex(T('deepstone'), T('deepstone_top')), drops: 'cobbled_deepstone', sound: 'deep' } });
  stoneFamily('chiseled_deepstone', 'Chiseled Deepstone', T('chiseled_deepstone'), D35, G.STONE, 'Chiseled_Deepslate', { base: { sound: 'deep' } });
  stoneFamily('cobbled_deepstone', 'Cobbled Deepstone', T('cobbled_deepstone'), D35, G.STONE, 'Cobbled_Deepslate', { slab: 1, stairs: 1, wall: 1, base: { sound: 'deep' } });
  stoneFamily('polished_deepstone', 'Polished Deepstone', T('polished_deepstone'), D35, G.STONE, 'Polished_Deepslate', { slab: 1, stairs: 1, wall: 1, base: { sound: 'deep' } });
  stoneFamily('deepstone_bricks', 'Deepstone Bricks', T('deepstone_bricks'), D35, G.STONE, 'Deepslate_Bricks', { slab: 1, stairs: 1, wall: 1, familyName: 'deepstone_brick', base: { sound: 'deep' } });
  stoneFamily('cracked_deepstone_bricks', 'Cracked Deepstone Bricks', T('cracked_deepstone_bricks'), D35, G.STONE, 'Cracked_Deepslate_Bricks', { base: { sound: 'deep' } });
  stoneFamily('deepstone_tiles', 'Deepstone Tiles', T('deepstone_tiles'), D35, G.STONE, 'Deepslate_Tiles', { slab: 1, stairs: 1, wall: 1, familyName: 'deepstone_tile', base: { sound: 'deep' } });
  stoneFamily('cracked_deepstone_tiles', 'Cracked Deepstone Tiles', T('cracked_deepstone_tiles'), D35, G.STONE, 'Cracked_Deepslate_Tiles', { base: { sound: 'deep' } });
  stoneFamily('tuff', 'Tuff', T('tuff'), S15, G.STONE, 'Tuff', { slab: 1, stairs: 1, wall: 1, flags: stoneFlags });
  stoneFamily('chiseled_tuff', 'Chiseled Tuff', { top: T('chiseled_tuff_top'), side: T('chiseled_tuff') }, S15, G.STONE, 'Chiseled_Tuff');
  stoneFamily('polished_tuff', 'Polished Tuff', T('polished_tuff'), S15, G.STONE, 'Polished_Tuff', { slab: 1, stairs: 1, wall: 1 });
  stoneFamily('tuff_bricks', 'Tuff Bricks', T('tuff_bricks'), S15, G.STONE, 'Tuff_Bricks', { slab: 1, stairs: 1, wall: 1, familyName: 'tuff_brick' });
  stoneFamily('chiseled_tuff_bricks', 'Chiseled Tuff Bricks', { top: T('chiseled_tuff_bricks_top'), side: T('chiseled_tuff_bricks') }, S15, G.STONE, 'Chiseled_Tuff_Bricks');

  // ============================ SURFACE STONES (Overworld) ===============================
  stoneFamily('bricks', 'Bricks', T('bricks'), S2, G.OVER, 'Bricks', { slab: 1, stairs: 1, wall: 1, familyName: 'brick' });
  def('packed_mud', { display: 'Packed Mud', cat: 'build', group: G.OVER, wiki: 'Packed_Mud', tex: T('packed_mud'), hard: 1, blast: 3, tool: 'pick', sound: 'mud' });
  stoneFamily('mud_bricks', 'Mud Bricks', T('mud_bricks'), { hard: 1.5, blast: 3 }, G.OVER, 'Mud_Bricks', { slab: 1, stairs: 1, wall: 1, familyName: 'mud_brick' });
  stoneFamily('resin_bricks', 'Resin Bricks', T('resin_bricks'), S15, G.OVER, 'Resin_Bricks', { slab: 1, stairs: 1, wall: 1, familyName: 'resin_brick' });
  stoneFamily('chiseled_resin_bricks', 'Chiseled Resin Bricks', T('chiseled_resin_bricks'), S15, G.OVER, 'Chiseled_Resin_Bricks');
  for (const [pre, D] of [['', ''], ['red_', 'Red ']]) {
    const ss = { hard: 0.8, blast: 0.8 };
    const top = T(pre + 'sandstone_top'), bot = T(pre + 'sandstone_bottom'), side = T(pre + 'sandstone');
    stoneFamily(pre + 'sandstone', D + 'Sandstone', { top, bottom: bot, side }, ss, G.OVER, pre ? 'Red_Sandstone' : 'Sandstone', { slab: 1, stairs: 1, wall: 1, familyName: pre + 'sandstone' });
    stoneFamily('chiseled_' + pre + 'sandstone', 'Chiseled ' + D + 'Sandstone', { top, side: T('chiseled_' + pre + 'sandstone') }, ss, G.OVER, 'Chiseled_' + (pre ? 'Red_' : '') + 'Sandstone');
    stoneFamily('cut_' + pre + 'sandstone', 'Cut ' + D + 'Sandstone', { top, side: T('cut_' + pre + 'sandstone') }, ss, G.OVER, 'Cut_' + (pre ? 'Red_' : '') + 'Sandstone', { slab: 1 });
    stoneFamily('smooth_' + pre + 'sandstone', 'Smooth ' + D + 'Sandstone', top, S2, G.OVER, 'Smooth_' + (pre ? 'Red_' : '') + 'Sandstone', { slab: 1, stairs: 1 });
  }
  for (const m of ['cinnabar', 'sulfur']) {
    const D = m[0].toUpperCase() + m.slice(1);
    stoneFamily(m, D, T(m), S15, G.OVER, D, { slab: 1, stairs: 1, wall: 1, flags: stoneFlags });
    stoneFamily('chiseled_' + m, 'Chiseled ' + D, T('chiseled_' + m), S15, G.OVER, 'Chiseled_' + D);
    stoneFamily('polished_' + m, 'Polished ' + D, T('polished_' + m), S15, G.OVER, 'Polished_' + D, { slab: 1, stairs: 1 });
    stoneFamily(m + '_bricks', D + ' Bricks', T(m + '_bricks'), S15, G.OVER, D + '_Bricks', { slab: 1, stairs: 1, wall: 1, familyName: m + '_brick' });
  }
  // Tidestone (prismarine analog) — animated sheen handled in shader via MACRO flag
  stoneFamily('tidestone', 'Tidestone', T('tidestone'), S15, G.OVER, 'Prismarine', { slab: 1, stairs: 1, wall: 1 });
  stoneFamily('tidestone_bricks', 'Tidestone Bricks', T('tidestone_bricks'), S15, G.OVER, 'Prismarine_Bricks', { slab: 1, stairs: 1, familyName: 'tidestone_brick' });
  stoneFamily('abyssal_tidestone', 'Abyssal Tidestone', T('abyssal_tidestone'), S15, G.OVER, 'Dark_Prismarine', { slab: 1, stairs: 1 });

  // ============================ UNDERFORGE (Nether analog) ============================
  def('emberrock', { display: 'Emberrock', cat: 'build', group: G.FORGE, wiki: 'Netherrack', tex: T('emberrock'), hard: 0.4, blast: 0.4, tool: 'pick', needTool: true, sound: 'ember', flags: F.RANDROT | F.MACRO, eternalFire: true });
  stoneFamily('ember_bricks', 'Ember Bricks', T('ember_bricks'), S2, G.FORGE, 'Nether_Bricks', { slab: 1, stairs: 1, wall: 1, familyName: 'ember_brick' });
  fence('ember_brick_fence', T('ember_bricks'), { display: 'Ember Brick Fence', cat: 'build', group: G.PARTIAL, wiki: 'Nether_Brick_Fence', hard: 2, blast: 6, tool: 'pick', needTool: true, sound: 'stone' }, 2);
  stoneFamily('chiseled_ember_bricks', 'Chiseled Ember Bricks', T('chiseled_ember_bricks'), S2, G.FORGE, 'Chiseled_Nether_Bricks');
  stoneFamily('cracked_ember_bricks', 'Cracked Ember Bricks', T('cracked_ember_bricks'), S2, G.FORGE, 'Cracked_Nether_Bricks');
  stoneFamily('red_ember_bricks', 'Red Ember Bricks', T('red_ember_bricks'), S2, G.FORGE, 'Red_Nether_Bricks', { slab: 1, stairs: 1, wall: 1, familyName: 'red_ember_brick' });
  stoneFamily('scoria', 'Scoria', { top: T('scoria_top'), side: T('scoria') }, S15, G.FORGE, 'Blackstone', { slab: 1, stairs: 1, wall: 1, flags: F.MACRO });
  stoneFamily('polished_scoria', 'Polished Scoria', T('polished_scoria'), S2, G.FORGE, 'Polished_Blackstone', { slab: 1, stairs: 1, wall: 1 });
  stoneFamily('chiseled_polished_scoria', 'Chiseled Polished Scoria', T('chiseled_polished_scoria'), S15, G.FORGE, 'Chiseled_Polished_Blackstone');
  stoneFamily('polished_scoria_bricks', 'Polished Scoria Bricks', T('polished_scoria_bricks'), S15, G.FORGE, 'Polished_Blackstone_Bricks', { slab: 1, stairs: 1, wall: 1, familyName: 'polished_scoria_brick' });
  stoneFamily('cracked_polished_scoria_bricks', 'Cracked Polished Scoria Bricks', T('cracked_polished_scoria_bricks'), S15, G.FORGE, 'Cracked_Polished_Blackstone_Bricks');
  def('basalt', { display: 'Basalt', cat: 'build', group: G.FORGE, wiki: 'Basalt', props: [AXIS], tex: axisTex(T('basalt'), T('basalt_top')), hard: 1.25, blast: 4.2, tool: 'pick', needTool: true, sound: 'basalt' });
  def('polished_basalt', { display: 'Polished Basalt', cat: 'build', group: G.FORGE, wiki: 'Polished_Basalt', props: [AXIS], tex: axisTex(T('polished_basalt'), T('polished_basalt_top')), hard: 1.25, blast: 4.2, tool: 'pick', needTool: true, sound: 'basalt' });
  def('smooth_basalt', { display: 'Smooth Basalt', cat: 'build', group: G.FORGE, wiki: 'Smooth_Basalt', tex: T('smooth_basalt'), hard: 1.25, blast: 4.2, tool: 'pick', needTool: true, sound: 'basalt' });

  // ============================ HOLLOW (End analog) ==================================
  def('voidstone', { display: 'Voidstone', cat: 'build', group: G.HOLLOW, wiki: 'End_Stone', tex: T('voidstone'), hard: 3, blast: 9, tool: 'pick', needTool: true, sound: 'stone', flags: F.RANDROT });
  stoneFamily('voidstone_bricks', 'Voidstone Bricks', T('voidstone_bricks'), { hard: 3, blast: 9 }, G.HOLLOW, 'End_Stone_Bricks', { slab: 1, stairs: 1, wall: 1, familyName: 'voidstone_brick' });
  stoneFamily('lilacite_block', 'Lilacite Block', T('lilacite_block'), S15, G.HOLLOW, 'Purpur_Block', { slab: 1, stairs: 1, familyName: 'lilacite', famDisp: 'Lilacite' });
  def('lilacite_pillar', { display: 'Lilacite Pillar', cat: 'build', group: G.HOLLOW, wiki: 'Purpur_Pillar', props: [AXIS], tex: axisTex(T('lilacite_pillar'), T('lilacite_pillar_top')), hard: 1.5, blast: 6, tool: 'pick', needTool: true, sound: 'stone' });

  // ============================ MINERAL ===========================================
  const QZ = { hard: 0.8, blast: 0.8 };
  stoneFamily('quartz_block', 'Block of Quartz', { top: T('quartz_block_top'), side: T('quartz_block') }, QZ, G.MINERAL, 'Block_of_Quartz', { slab: 1, stairs: 1, familyName: 'quartz', famDisp: 'Quartz' });
  stoneFamily('quartz_bricks', 'Quartz Bricks', T('quartz_bricks'), QZ, G.MINERAL, 'Quartz_Bricks');
  stoneFamily('chiseled_quartz_block', 'Chiseled Quartz Block', { top: T('chiseled_quartz_block_top'), side: T('chiseled_quartz_block') }, QZ, G.MINERAL, 'Chiseled_Quartz_Block');
  def('quartz_pillar', { display: 'Quartz Pillar', cat: 'build', group: G.MINERAL, wiki: 'Quartz_Pillar', props: [AXIS], tex: axisTex(T('quartz_pillar'), T('quartz_pillar_top')), hard: 0.8, blast: 0.8, tool: 'pick', needTool: true, sound: 'stone' });
  stoneFamily('smooth_quartz', 'Smooth Quartz Block', T('quartz_block_bottom'), S2, G.MINERAL, 'Smooth_Quartz_Block', { slab: 1, stairs: 1, famDisp: 'Smooth Quartz' });

  // Copper family: 4 oxidation stages × waxed flag stored in state
  const OX = ['', 'exposed_', 'weathered_', 'oxidized_'];
  VR.OX = OX;
  const COP = { hard: 3, blast: 6, tool: 'pick', needTool: true, tier: 2, sound: 'metal' };
  const copperProps = [['stage', 4], ['waxed', 2]];
  const cT = (v) => (p) => T('copper:' + v + ':' + p.stage);
  def('copper_block', Object.assign({ display: 'Block of Copper', cat: 'build', group: G.MINERAL, wiki: 'Block_of_Copper', props: copperProps, tex: cT('block'), oxidizes: true, flags: F.RANDTICK }, COP));
  def('chiseled_copper', Object.assign({ display: 'Chiseled Copper', cat: 'build', group: G.MINERAL, wiki: 'Chiseled_Copper', props: copperProps, tex: cT('chiseled'), oxidizes: true, flags: F.RANDTICK }, COP));
  def('cut_copper', Object.assign({ display: 'Cut Copper', cat: 'build', group: G.MINERAL, wiki: 'Cut_Copper', props: copperProps, tex: cT('cut'), oxidizes: true, flags: F.RANDTICK }, COP));
  def('cut_copper_slab', Object.assign({
    display: 'Cut Copper Slab', cat: 'build', group: G.PARTIAL, wiki: 'Cut_Copper_Slab', props: [SLABT, ...copperProps], oxidizes: true, flags: F.RANDTICK, kind: 'slab',
    shape: (p) => p.type === 2 ? 'cube' : 'model', tex: cT('cut'), opaque: (p) => p.type === 2, filter: (p) => p.type === 2 ? 15 : 0, solid: true,
    model: (p) => { const t = T('copper:cut:' + p.stage); return p.type === 0 ? MD.box([0, 0, 0, 16, 8, 16], t) : p.type === 1 ? MD.box([0, 8, 0, 16, 16, 16], t) : null; }
  }, COP));
  def('cut_copper_stairs', Object.assign({ display: 'Cut Copper Stairs', cat: 'build', group: G.PARTIAL, wiki: 'Cut_Copper_Stairs', props: [FACING4, HALF, ...copperProps], oxidizes: true, flags: F.RANDTICK, shape: 'stairs', tex: cT('cut'), kind: 'stairs', solid: true }, COP));
  def('copper_grate', Object.assign({ display: 'Copper Grate', cat: 'build', group: G.MINERAL, wiki: 'Copper_Grate', props: copperProps, tex: cT('grate'), layer: 'cutout', opaque: false, oxidizes: true, flags: F.RANDTICK | F.SELFCULL }, COP));

  const metalBlock = (id, disp, wiki, tx, stats, extra) => def(id, Object.assign({ display: disp, cat: 'build', group: G.MINERAL, wiki, tex: tx, tool: 'pick', needTool: true, sound: 'metal' }, stats, extra || {}));
  metalBlock('iron_block', 'Block of Iron', 'Block_of_Iron', T('block:iron'), { hard: 5, blast: 6, tier: 2 });
  metalBlock('gold_block', 'Block of Gold', 'Block_of_Gold', T('block:gold'), { hard: 3, blast: 6, tier: 3 });
  metalBlock('amethyst_block', 'Block of Amethyst', 'Block_of_Amethyst', T('block:amethyst'), { hard: 1.5, blast: 1.5, tier: 1, sound: 'amethyst' });
  metalBlock('coal_block', 'Block of Coal', 'Block_of_Coal', T('block:coal'), { hard: 5, blast: 6, tier: 1, sound: 'stone', flam: [5, 5], fuel: 16000 });
  metalBlock('diamond_block', 'Block of Diamond', 'Block_of_Diamond', T('block:diamond'), { hard: 5, blast: 6, tier: 3 });
  metalBlock('emerald_block', 'Block of Emerald', 'Block_of_Emerald', T('block:emerald'), { hard: 5, blast: 6, tier: 3 });
  metalBlock('lapis_block', 'Block of Lapis Lazuli', 'Block_of_Lapis_Lazuli', T('block:lapis'), { hard: 3, blast: 3, tier: 2, sound: 'stone' });
  metalBlock('duskite_block', 'Block of Duskite', 'Block_of_Netherite', T('block:duskite'), { hard: 50, blast: 1200, tier: 4 });
  metalBlock('voltite_block', 'Block of Voltite', 'Block_of_Redstone', T('block:voltite'), { hard: 5, blast: 6, tier: 1 }, { cat: 'volt', flags: F.POWERSRC, power: 15, opaque: true });
})(VR);
