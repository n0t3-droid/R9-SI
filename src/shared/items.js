// ============================================================================
// Items: materials, food, tools, armor, gadgets. Block items are implicit
// (item id = block type name). Registered textures: 'item:<id>'.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R;
  const I = VR.ITEMS = Object.create(null);
  const LIST = VR.ITEM_LIST = [];
  const title = (id) => id.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  function item(id, o) {
    o = o || {};
    o.id = id; o.name = o.name || title(id); o.stack = o.stack || 64;
    o.tex = R.tex('item:' + (o.texKey || id));
    o.cat = o.cat || 'items';
    I[id] = o; LIST.push(o);
    return o;
  }
  VR.defItem = item;

  // ---------------- materials ----------------
  const mats = [
    ['stick'], ['coal'], ['charcoal'], ['raw_iron'], ['raw_gold'], ['raw_copper'], ['iron_ingot'], ['gold_ingot'], ['copper_ingot'], ['duskite_ingot', { name: 'Duskite Ingot' }],
    ['relic_scrap'], ['iron_nugget'], ['gold_nugget'], ['diamond'], ['emerald'], ['lapis_lazuli'], ['voltite_dust', { name: 'Volt Dust' }], ['quartz'], ['amethyst_shard'],
    ['flint'], ['string'], ['feather'], ['leather'], ['bone'], ['bone_meal'], ['gunpowder'], ['clay_ball'], ['brick'], ['paper'], ['book'], ['sugar'], ['wheat'],
    ['wheat_seeds'], ['beetroot_seeds'], ['pumpkin_seeds'], ['melon_seeds'], ['slime_ball'], ['honeycomb'], ['snowball', { stack: 16 }], ['tide_crystals'], ['sunstone_dust'],
    ['aether_cell', { name: 'Aether Cell' }], ['star_core', { name: 'Star Core' }], ['glow_ink'], ['ink_sac'], ['egg', { stack: 16 }], ['arrow'], ['nether_star_shard', { name: 'Prism Heart' }],
  ];
  for (const [id, o] of mats) item(id, Object.assign({ cat: 'items' }, o || {}));
  for (const c of ['violet', 'azure', 'verdant', 'rose', 'amber']) item('crystal_shard_' + c, { name: title(c) + ' Crystal Shard', cat: 'items', crystal: c });

  // ---------------- food ----------------
  const foods = [
    ['apple', 4, 2.4], ['golden_apple', 4, 9.6, { effect: 'regen' }], ['bread', 5, 6], ['carrot', 3, 3.6], ['potato', 1, 0.6], ['baked_potato', 5, 6], ['beetroot', 1, 1.2],
    ['melon_slice', 2, 1.2], ['sweet_berries', 2, 0.4], ['glow_berries', 2, 0.4], ['starfruit', 4, 4, { effect: 'glow' }], ['dried_kelp', 1, 0.6], ['cookie', 2, 0.4],
    ['pumpkin_pie', 8, 4.8], ['mushroom_stew', 6, 7.2, { stack: 1 }], ['raw_beef', 3, 1.8], ['steak', 8, 12.8], ['raw_porkchop', 3, 1.8], ['cooked_porkchop', 8, 12.8],
    ['raw_chicken', 2, 1.2], ['cooked_chicken', 6, 7.2], ['raw_mutton', 2, 1.2], ['cooked_mutton', 6, 9.6], ['raw_cod', 2, 0.4], ['cooked_cod', 5, 6], ['raw_salmon', 2, 0.4], ['cooked_salmon', 6, 9.6],
    ['honey_bottle', 6, 1.2, { stack: 16 }], ['space_ration', 7, 8, { name: 'Space Ration' }],
  ];
  for (const [id, food, sat, o] of foods) item(id, Object.assign({ cat: 'food', food, sat }, o || {}));

  // ---------------- tools ----------------
  const TIERS = VR.TOOL_TIERS = {
    wooden: { tier: 1, speed: 2, dur: 59, dmg: 0, color: 0x9a7040 }, stone: { tier: 2, speed: 4, dur: 131, dmg: 1, color: 0x8a8a8a },
    copper: { tier: 2, speed: 5, dur: 190, dmg: 1, color: 0xd8804a }, iron: { tier: 3, speed: 6, dur: 250, dmg: 2, color: 0xd8d8d8 },
    golden: { tier: 1, speed: 12, dur: 32, dmg: 0, color: 0xf0d040 }, diamond: { tier: 4, speed: 8, dur: 1561, dmg: 3, color: 0x5af0e0 },
    duskite: { tier: 5, speed: 9, dur: 2031, dmg: 4, color: 0x5a3a7a },
  };
  const TOOLS = { pickaxe: ['pick', 1], axe: ['axe', 6], shovel: ['shovel', 1.5], hoe: ['hoe', 0], sword: ['sword', 3] };
  for (const m in TIERS) for (const t in TOOLS) {
    const [kind, base] = TOOLS[t], T = TIERS[m];
    item(m + '_' + t, { cat: 'tools', stack: 1, tool: kind, tier: T.tier, speed: T.speed, dur: T.dur, dmg: kind === 'sword' ? 4 + T.dmg : base + T.dmg * 0.5, mat: m, texKey: 'tool:' + t + ':' + m });
  }
  item('shears', { cat: 'tools', stack: 1, tool: 'shears', tier: 1, speed: 5, dur: 238 });
  item('flint_and_steel', { cat: 'tools', stack: 1, dur: 64, use: 'ignite' });
  item('bucket', { cat: 'tools', stack: 16, use: 'bucket' });
  item('water_bucket', { cat: 'tools', stack: 1, use: 'bucket', fluid: 'water' });
  item('lava_bucket', { cat: 'tools', stack: 1, use: 'bucket', fluid: 'lava', fuel: 20000 });
  item('aether_bucket', { cat: 'tools', stack: 1, use: 'bucket', fluid: 'aether' });
  item('bow', { cat: 'combat', stack: 1, dur: 384, use: 'bow' });
  item('compass', { cat: 'tools', stack: 1 });
  item('clock', { cat: 'tools', stack: 1 });
  item('spyglass', { cat: 'tools', stack: 1, use: 'zoom' });
  // armor
  const ARM = { leather: [1, 2, 3, 1, 0x9a5a2a], copper: [2, 4, 3, 1, 0xd8804a], iron: [2, 6, 5, 2, 0xd8d8d8], golden: [2, 5, 3, 1, 0xf0d040], diamond: [3, 8, 6, 3, 0x5af0e0], duskite: [3, 8, 6, 3, 0x5a3a7a] };
  const SLOTS = ['helmet', 'chestplate', 'leggings', 'boots'];
  for (const m in ARM) SLOTS.forEach((s, i) => item(m + '_' + s, { cat: 'combat', stack: 1, armor: ARM[m][i], slot: i, mat: m, color: ARM[m][4], texKey: 'armor:' + s + ':' + m, dur: 100 + i * 20 }));

  // ---------------- Starforge gadgets (signature tech) ----------------
  item('laser_blaster', { cat: 'tech', stack: 1, use: 'laser', dmg: 7, name: 'Pulse Blaster', energy: 1 });
  item('mining_laser', { cat: 'tech', stack: 1, use: 'minelaser', name: 'Mining Laser', energy: 1 });
  item('builder_wand', { cat: 'tech', stack: 1, use: 'wand', name: 'Builder Wand' });
  item('jetpack', { cat: 'tech', stack: 1, slot: 1, armor: 2, jetpack: true, name: 'Jetpack' });
  item('hoverbike', { cat: 'tech', stack: 1, use: 'vehicle', vehicle: 'hoverbike', name: 'Hoverbike' });
  item('shuttle_beacon', { cat: 'tech', stack: 1, use: 'vehicle', vehicle: 'shuttle', name: 'Shuttle Beacon' });
  item('photo_drone', { cat: 'tech', stack: 1, use: 'photo', name: 'Photo Drone' });
  item('waypoint_marker', { cat: 'tech', stack: 16, use: 'waypoint', name: 'Waypoint Marker' });
  item('energy_cell', { cat: 'tech', stack: 16, name: 'Energy Cell' });
  item('scanner', { cat: 'tech', stack: 1, use: 'scan', name: 'Geo Scanner' });

  // spawn eggs for creative
  VR.MOB_EGGS = ['glimmer_deer', 'moss_boar', 'sky_ray', 'crystal_crab', 'ember_husk', 'void_stalker', 'shard_wisp', 'bloom_sheep', 'hover_drone'];
  for (const m of VR.MOB_EGGS) item('egg_' + m, { cat: 'spawn', stack: 64, use: 'spawn', mob: m, texKey: 'egg:' + m, name: title(m) + ' Egg' });

  // extra texture layers used by the renderer
  for (let i = 0; i < 10; i++) R.tex('destroy#' + i);
  R.tex('particle_spark');
  VR.CUTOUT_TEX = ['particle_spark'];

  // ---------------- item lookup helpers ----------------
  VR.itemDef = function (id) {
    const it = I[id];
    if (it) return it;
    const t = R.byName[id];
    if (t) return t.itemDef || (t.itemDef = { id, get name() { return t.o && t.o.vxModel && VR.dispName ? VR.dispName(t.display) : t.display; }, stack: t.o.stack || 64, block: t, cat: t.cat });
    return null;
  };
  VR.itemName = (id) => { const d = VR.itemDef(id); return d ? d.name : id; };
  VR.maxStack = (id) => { const d = VR.itemDef(id); return d ? d.stack : 64; };
})(VR);
