// ============================================================================
// u-worlds · VR.WorldEco — every world of Helia (and of the other stars) as rich as Herzwelt (plan
// docs/superpowers/plans/2026-10-31-u-worlds.md). The owner (31 Oct): „so umfangreich wie unsere Welt, nur andere Spezies,
// andere Umgebung". Pure: the main thread, the workers and the tests run it.
//   KINDS[kind]   per body kind (aqua, ocker, zinn, basalt, opal — the exo worlds are these kinds with another seed):
//                 biomes (appended to VR.BIOMES), flora (plants of our own shapes, built from existing blocks), fauna
//                 (2–3 creatures and what they do), the native species (its look, its houses' kit, its goods, the
//                 syllables of its language), ores, the liquid of its lakes, landmarks
//   decorate      bgen ≥ 3 (VR.Bodies.BGEN): after the kind's own generator — the biomes' ground and tint, caves (a
//                 coarse lattice of two 3-D noises: spaghetti tunnels), ore veins, ponds (water · frozen · lava),
//                 flora, landmarks, the villages' blocks and their ['village', id] spawns. bgen ≤ 2 untouched.
//   of(gen)       → the world's eco: 3 village sites (the first 110–170 m from the landing, in sight), their plans
//                 (villages.js addVillage: homes with beds, a trader's stall, a garden, lamps, the plaza — the houses
//                 in the species' shape: round shell huts, earth terraces, basalt towers, half-sunk domes, ice vaults)
//   names(kind)   invented names from the species' syllables (test/names.js lists the species' names)
// Cost: a chunk's decoration is a few hundred noise samples (the caves on a 4-block lattice) and the structures'
// buckets; the sites and plans are made once per generator. Very Low: the same blocks (no extra draw); the villages'
// people use villages.js's tiers, the creatures worldlife.js's caps.
// ============================================================================
(function (VR) {
  'use strict';
  const M = VR.M, B = VR.Bodies;
  if (!B || !VR.BodyGen) return;
  const E = VR.WorldEco = { BGEN: 3 };
  const SEA = (VR.C && VR.C.SEA) || 63;
  const h01 = (a, b, c) => { let h = Math.imul((a | 0) ^ 0x2c1b3c6d, 0x297a2d39) ^ Math.imul((b | 0) + 0x632be5ab, 0x85ebca6b) ^ Math.imul((c | 0) + 0x5bd1e995, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
  const strHash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; };

  // ================================================================ the worlds
  // biomes: key, de, en, col (grass/foliage tint), surf (the ground's top), base (the kind's biomes it may lie on)
  // flora: id, shape (umbrella · spire · bulb · fan · tuft · coral), bio (eco biome indices), p (per 5×5 cell; tufts
  //        per column), blocks — our own plants: the shapes are ours, the blocks the game's
  // fauna: id, de, en, does (graze · fly · swim · hop), bio
  // species: de, en (one word, both tables), look (skin, feat — the head's own feature —, featC, garb, eye), kit (the
  //        house: shape and blocks), goods (the trader's stall), syl (the language's syllables), end (name endings)
  const K = E.KINDS = {
    aqua: {
      liquid: 'water',
      biomes: [
        { key: 'aqua_fangrove', de: 'Fächerhain', en: 'Fan Grove', col: 0x3ab88a, surf: 'moss_block' },
        { key: 'aqua_saltmeadow', de: 'Salzwiese', en: 'Salt Meadow', col: 0x8ad0a0, surf: 'pale_moss_block' },
        { key: 'aqua_reef', de: 'Riffgarten', en: 'Reef Garden', col: 0x40c0b0, surf: null, under: true },
      ],
      base: ['aqua_island', 'aqua_atoll'],
      flora: [
        { id: 'fanpalm', de: 'Fächerpalme', en: 'Fan Palm', shape: 'fan', bio: [0, 1], p: 0.5, stem: 'stripped_bamboo_block', leaf: 'jungle_leaves', h: [4, 7] },
        { id: 'shellcap', de: 'Muschelschirm', en: 'Shell Cap', shape: 'umbrella', bio: [0], p: 0.22, stem: 'mushroom_stem', cap: 'tube_coral_block', under: 'tide_lantern', h: [3, 5], r: [2, 3] },
        { id: 'saltreed', de: 'Salzfarn', en: 'Salt Fern', shape: 'tuft', bio: [0, 1], p: 0.16, b: ['fern', 'short_grass', 'lily_of_the_valley'] },
        { id: 'reefcoral', de: 'Riffkoralle', en: 'Reef Coral', shape: 'coral', bio: [2], p: 0.12, b: ['brain_coral_block', 'fire_coral_block', 'horn_coral_block', 'tube_coral_block'], h: [2, 4] },
        { id: 'reeftuft', de: 'Seegras', en: 'Sea Grass', shape: 'tuft', bio: [2], p: 0.2, b: ['seagrass', 'tube_coral_fan', 'sea_pickle', 'kelp'] },
      ],
      fauna: [
        { id: 'reef_glider', de: 'Riffgleiter', en: 'Reef Glider', does: 'swim' },
        { id: 'shell_strider', de: 'Muschelschreiter', en: 'Shell Strider', does: 'graze' },
        { id: 'spray_sailor', de: 'Gischtsegler', en: 'Spray Sailor', does: 'fly' },
      ],
      species: {
        de: 'Wellari', en: 'Wellari',
        look: { skin: [0x4fa8b8, 0x5cb8c0, 0x3e96a8, 0x6ac0c4], cut: ['tunic', 'gown', 'tunic'], feat: 'fins', featC: [0x2a6a9a, 0x1f7a8a, 0x3a5aa8], garb: [0xf2eedc, 0xe8d8b0, 0xf0a890, 0xd86a5a, 0xf4f0f4, 0x7ad0c8], eye: 0x1a3a5a },
        kit: { shape: 'round', wall: 'calcite', band: 'cyan_terracotta', roof: 'dried_kelp_block', floor: 'bamboo_planks', fill: 'sandstone', window: 'light_blue_stained_glass', door: 'bamboo_door', bed: 'cyan_bed', light: 'tide_lantern', paving: 'smooth_quartz', lamp: 'vx_lamppost_crystal', canopy: 'cyan_wool', mark: 'tube_coral_block' },
        goods: ['dried_kelp_block', 'kelp', 'sea_pickle', 'tube_coral_block', 'brain_coral_block', 'sponge', 'tide_lantern', 'lily_pad'],
        syl: ['wa', 'li', 'nel', 'sa', 'ri', 'mo', 'thi', 'lu', 'na', 've', 'ar', 'io', 'ma', 'el', 'sha', 'ne'], end: ['i', 'a', 'el', 'en'],
      },
      ores: [{ b: 'copper_ore', y: [6, 28], n: 4 }, { b: 'lapis_ore', y: [6, 22], n: 2 }, { b: 'emerald_ore', y: [6, 16], n: 1 }],
      landmarks: [
        { id: 'arch', de: 'Korallenbogen', en: 'Coral Arch', shape: 'arch', b: 'brain_coral_block', b2: 'tube_coral_block' },
        { id: 'shroom', de: 'Leuchtschirm', en: 'Glow Canopy', shape: 'giantcap', b: 'mushroom_stem', b2: 'tube_coral_block', b3: 'tide_lantern' },
      ],
    },
    ocker: {
      liquid: 'ice',
      biomes: [
        { key: 'ocker_lichen', de: 'Rostflechtenfeld', en: 'Rust Lichen Field', col: 0xb04a3a, surf: 'crimson_mycel' },
        { key: 'ocker_thorn', de: 'Dornsteppe', en: 'Thorn Steppe', col: 0x9a8a50, surf: 'coarse_dirt' },
        { key: 'ocker_amber', de: 'Bernsteingarten', en: 'Amber Garden', col: 0xd89a40, surf: 'red_sand' },
      ],
      base: null,
      flora: [
        { id: 'rustcap', de: 'Rostschirm', en: 'Rust Cap', shape: 'umbrella', bio: [0], p: 0.35, stem: 'stripped_crimson_stalk', cap: 'crimson_wart_block', under: 'lantern', h: [3, 6], r: [2, 3] },
        { id: 'thornpillar', de: 'Dornsäule', en: 'Thorn Pillar', shape: 'spire', bio: [1], p: 0.4, base: 'cactus', tip: 'cactus_flower', h: [2, 4] },
        { id: 'ambernadel', de: 'Bernsteinnadel', en: 'Amber Needle', shape: 'spire', bio: [2], p: 0.35, base: 'amber_crystal_block', tip: 'amber_crystal_cluster', h: [1, 4] },
        { id: 'dusttuft', de: 'Staubgras', en: 'Dust Grass', shape: 'tuft', bio: [0, 1, 2], p: 0.12, b: ['dead_bush', 'crimson_roots', 'short_grass'] },
        { id: 'rustbulb', de: 'Rostknolle', en: 'Rust Bulb', shape: 'bulb', bio: [0, 1], p: 0.18, stem: 'stripped_crimson_stalk', head: 'orange_terracotta', h: [1, 2] },
      ],
      fauna: [
        { id: 'dune_trotter', de: 'Dünentraber', en: 'Dune Trotter', does: 'graze' },
        { id: 'rust_hopper', de: 'Rosthüpfer', en: 'Rust Hopper', does: 'hop' },
        { id: 'dust_moth', de: 'Staubfalter', en: 'Dust Moth', does: 'fly' },
      ],
      species: {
        de: 'Dunelin', en: 'Dunelin',
        look: { skin: [0xd8b444, 0xc8a43a, 0xe0c25a, 0xbc9a36], cut: ['robe', 'cape', 'robe'], feat: 'horns', featC: [0xf0e2c0, 0xd8c8a0, 0xe8d0a8], garb: [0xe8d8b8, 0x9a4a2a, 0x5a6a7a, 0xd8b060, 0x7a3a2a, 0x3a6a6a], eye: 0x2a1a10 },
        kit: { shape: 'terrace', wall: 'terracotta', band: 'red_sandstone', roof: 'smooth_red_sandstone', floor: 'acacia_planks', fill: 'red_sandstone', window: 'orange_stained_glass', door: 'acacia_door', bed: 'orange_bed', light: 'lantern', paving: 'smooth_red_sandstone', lamp: 'vx_lamppost_black', canopy: 'orange_wool', mark: 'amber_crystal_block' },
        goods: ['red_sand', 'terracotta', 'orange_terracotta', 'cactus', 'red_sandstone', 'amber_crystal_block', 'lantern', 'iron_ingot'],
        syl: ['du', 'ne', 'ka', 'ro', 'tes', 'ul', 'mar', 'ze', 'om', 'ra', 'bek', 'sim', 'ta', 'ho', 'gal', 'ir'], end: ['in', 'ek', 'a', 'ur'],
      },
      ores: [{ b: 'iron_ore', y: [8, 120], n: 5 }, { b: 'gold_ore', y: [8, 60], n: 2 }, { b: 'ember_quartz_ore', y: [8, 90], n: 2 }],
      landmarks: [
        { id: 'needle', de: 'Bernsteinturm', en: 'Amber Tower', shape: 'giantcrystal', b: 'amber_crystal_block', b2: 'amber_crystal_cluster' },
        { id: 'circle', de: 'Steinkreis der Dunelin', en: 'Dunelin Stone Circle', shape: 'circle', b: 'red_sandstone', b2: 'lantern' },
      ],
    },
    zinn: {
      liquid: 'lava',
      biomes: [
        { key: 'zinn_ashwood', de: 'Aschewald', en: 'Ash Wood', col: 0xd06a30, surf: 'tuff' },
        { key: 'zinn_sulfgarden', de: 'Schwefelgarten', en: 'Sulfur Garden', col: 0xe0c040, surf: 'sulfur' },
        { key: 'zinn_glassfield', de: 'Glasfeld', en: 'Glass Field', col: 0x6a4aa0, surf: 'obsidian' },
      ],
      base: ['zinn_plains', 'zinn_mountains', 'zinn_patera'],
      flora: [
        { id: 'ashbirch', de: 'Aschebirke', en: 'Ash Birch', shape: 'fan', bio: [0], p: 0.5, stem: 'polished_basalt', leaf: 'orange_poplar_leaves', h: [4, 7] },
        { id: 'glowbulb', de: 'Glutknolle', en: 'Ember Bulb', shape: 'bulb', bio: [0, 1], p: 0.2, stem: 'crimson_stalk', head: 'magma_block', h: [1, 3] },
        { id: 'sulfspike', de: 'Schwefelstachel', en: 'Sulfur Spike', shape: 'spire', bio: [1], p: 0.4, base: 'sulfur', tip: 'sulfur_spike', h: [1, 3] },
        { id: 'glassbloom', de: 'Glasblüte', en: 'Glass Bloom', shape: 'tuft', bio: [2], p: 0.14, b: ['violet_crystal_cluster', 'amber_crystal_cluster'] },
        { id: 'ashfern', de: 'Aschefarn', en: 'Ash Fern', shape: 'tuft', bio: [0, 1], p: 0.1, b: ['crimson_roots', 'twisting_vines', 'dead_bush'] },
      ],
      fauna: [
        { id: 'ember_snail', de: 'Glutschnecke', en: 'Ember Snail', does: 'graze' },
        { id: 'ash_lark', de: 'Aschelerche', en: 'Ash Lark', does: 'fly' },
        { id: 'sulfur_beetle', de: 'Schwefelkäfer', en: 'Sulfur Beetle', does: 'hop' },
      ],
      species: {
        de: 'Glutani', en: 'Glutani',
        look: { skin: [0x4a2a3a, 0x542e3e, 0x3e2434, 0x5a3440], cut: ['coat', 'robe', 'coat'], feat: 'crest', featC: [0xffb02a, 0xff7a2a, 0xffd050], garb: [0xd84a2a, 0xf0c040, 0x2a2a30, 0xe8e0d0, 0x8a2a1a], eye: 0xffa030, glow: true },
        kit: { shape: 'tower', wall: 'polished_basalt', band: 'sulfur_bricks', roof: 'amber_crystal_block', floor: 'crimson_planks', fill: 'basalt', window: 'yellow_stained_glass', door: 'crimson_door', bed: 'red_bed', light: 'spirit_lantern', paving: 'polished_sulfur', lamp: 'vx_lamppost_crystal', canopy: 'yellow_wool', mark: 'magma_block' },
        goods: ['sulfur', 'obsidian', 'magma_block', 'amber_crystal_block', 'polished_sulfur', 'glowing_obsidian', 'sulfur_bricks', 'gold_ingot'],
        syl: ['glu', 'ta', 'ni', 'ber', 'os', 'kai', 'rum', 'ze', 'fa', 'lo', 'tir', 'ga', 'van', 'ur', 'pe', 'sol'], end: ['an', 'i', 'or', 'et'],
      },
      ores: [{ b: 'ember_gold_ore', y: [8, 60], n: 3 }, { b: 'gold_ore', y: [8, 50], n: 2 }, { b: 'ember_quartz_ore', y: [8, 90], n: 3 }],
      landmarks: [
        { id: 'crystal', de: 'Glutkristall', en: 'Ember Crystal', shape: 'giantcrystal', b: 'amber_crystal_block', b2: 'magma_block' },
        { id: 'arch', de: 'Aschebogen', en: 'Ash Arch', shape: 'arch', b: 'polished_basalt', b2: 'sulfur_bricks' },
      ],
    },
    basalt: {
      liquid: null,
      biomes: [
        { key: 'basalt_glowmoss', de: 'Leuchtmoossenke', en: 'Glow Moss Hollow', col: 0x5ac89a, surf: 'moss_block' },
        { key: 'basalt_crystal', de: 'Kristallmulde', en: 'Crystal Basin', col: 0x7ab0e8, surf: 'regolith' },
        { key: 'basalt_shroom', de: 'Pilzhain', en: 'Mushroom Grove', col: 0xa8907a, surf: 'regolith_dark' },
      ],
      base: null,
      flora: [
        { id: 'greycap', de: 'Mondschirm', en: 'Moon Cap', shape: 'umbrella', bio: [2], p: 0.45, stem: 'mushroom_stem', cap: 'brown_mushroom_block', under: 'lantern', h: [3, 6], r: [2, 3] },
        { id: 'azurespire', de: 'Azurnadel', en: 'Azure Needle', shape: 'spire', bio: [1], p: 0.4, base: 'azure_crystal_block', tip: 'azure_crystal_cluster', h: [1, 4] },
        { id: 'glowtuft', de: 'Leuchtmoos', en: 'Glow Moss', shape: 'tuft', bio: [0], p: 0.2, b: ['lumishroom', 'fern', 'short_grass'] },
        { id: 'stonebulb', de: 'Steinknolle', en: 'Stone Bulb', shape: 'bulb', bio: [0, 2], p: 0.22, stem: 'mushroom_stem', head: 'red_mushroom_block', h: [1, 2] },
      ],
      fauna: [
        { id: 'crater_roller', de: 'Kraterroller', en: 'Crater Roller', does: 'graze' },
        { id: 'moon_moth', de: 'Mondfalter', en: 'Moon Moth', does: 'fly' },
      ],
      species: {
        de: 'Regoli', en: 'Regoli',
        look: { skin: [0x8a8cc0, 0x7a80b4, 0x9a98cc, 0x8484b8], cut: ['tunic', 'coat', 'tunic'], feat: 'antennae', featC: [0x7af0ff, 0xb0ff9a, 0xffe07a], garb: [0x3a4a6a, 0x6a7a9a, 0xe8e8f0, 0x2a3a4a, 0x8a5a9a], eye: 0x101828, glow: true },
        kit: { shape: 'dome', wall: 'polished_andesite', band: 'smooth_basalt', roof: 'light_blue_stained_glass', floor: 'smooth_stone', fill: 'andesite', window: 'light_blue_stained_glass', door: 'door_glass_white', bed: 'gray_bed', light: 'lantern', paving: 'polished_andesite', lamp: 'vx_lamppost_tech', canopy: 'gray_wool', mark: 'azure_crystal_block' },
        goods: ['regolith', 'basalt', 'smooth_basalt', 'azure_crystal_block', 'lantern', 'diorite', 'andesite', 'iron_ingot'],
        syl: ['re', 'go', 'li', 'mun', 'sel', 'ka', 'tor', 'vi', 'den', 'ul', 'pa', 'so', 'ren', 'ix', 'ma', 'thel'], end: ['i', 'o', 'un', 'is'],
      },
      ores: [{ b: 'iron_ore', y: [8, 60], n: 4 }, { b: 'voltite_ore', y: [8, 40], n: 2 }, { b: 'diamond_ore', y: [6, 20], n: 1 }],
      landmarks: [
        { id: 'tower', de: 'Azurturm', en: 'Azure Spire', shape: 'giantcrystal', b: 'azure_crystal_block', b2: 'azure_crystal_cluster' },
        { id: 'circle', de: 'Mondsteinkreis', en: 'Moonstone Circle', shape: 'circle', b: 'smooth_basalt', b2: 'lantern' },
      ],
    },
    opal: {
      liquid: null,
      biomes: [
        { key: 'opal_fernfrost', de: 'Frostfarnfeld', en: 'Frost Fern Field', col: 0x9ad8e8, surf: 'snow_block' },
        { key: 'opal_icebloom', de: 'Eisblütenwiese', en: 'Ice Bloom Meadow', col: 0xe8a8c8, surf: 'packed_ice' },
        { key: 'opal_bluegrove', de: 'Blaukelchhain', en: 'Blue Chalice Grove', col: 0x5aa8d8, surf: 'snow_block' },
      ],
      base: ['opal_plains', 'opal_chaos', 'opal_lineae'],
      flora: [
        { id: 'frostfern', de: 'Frostfarn', en: 'Frost Fern', shape: 'tuft', bio: [0, 2], p: 0.2, b: ['fern', 'short_grass', 'ice_crystal'] },
        { id: 'bluechalice', de: 'Blaukelch', en: 'Blue Chalice', shape: 'umbrella', bio: [2], p: 0.45, stem: 'blue_ice', cap: 'teal_wart_block', under: 'tide_lantern', h: [3, 6], r: [2, 3] },
        { id: 'iceneedle', de: 'Eisnadel', en: 'Ice Needle', shape: 'spire', bio: [0, 2], p: 0.2, base: 'packed_ice', tip: 'ice_crystal', h: [2, 5] },
        { id: 'icebloom', de: 'Eisblüte', en: 'Ice Bloom', shape: 'spire', bio: [1], p: 0.4, base: 'rose_crystal_block', tip: 'rose_crystal_cluster', h: [1, 2] },
        { id: 'snowpine', de: 'Schneekiefer', en: 'Snow Pine', shape: 'fan', bio: [0], p: 0.3, stem: 'spruce_log', leaf: 'spruce_leaves', h: [4, 7] },
      ],
      fauna: [
        { id: 'frost_seal', de: 'Frostrobbe', en: 'Frost Seal', does: 'graze' },
        { id: 'ice_wisp', de: 'Eisflimmer', en: 'Ice Shimmer', does: 'fly' },
      ],
      species: {
        de: 'Nivari', en: 'Nivari',
        look: { skin: [0x9ac8f0, 0x8abce8, 0xaad4f4, 0x7ab0e0], cut: ['coat', 'cape', 'coat'], feat: 'antlers', featC: [0x9ad8ff, 0xc8f0ff, 0x7ac0f0], garb: [0x2a4a7a, 0x7a2a4a, 0xe8e0d0, 0x3a6a5a, 0xc84a4a], eye: 0x2a3a6a },
        kit: { shape: 'vault', wall: 'packed_ice', band: 'snow_block', roof: 'blue_ice', floor: 'spruce_planks', fill: 'packed_ice', window: 'light_blue_stained_glass', door: 'spruce_door', bed: 'light_blue_bed', light: 'lantern', paving: 'snow_block_cut', lamp: 'vx_lamppost_crystal', canopy: 'light_blue_wool', mark: 'rose_crystal_block' },
        goods: ['packed_ice', 'blue_ice', 'ice_crystal', 'snow_block', 'tholin_ice', 'rose_crystal_block', 'azure_crystal_cluster', 'lantern'],
        syl: ['ni', 'va', 'ri', 'is', 'fel', 'ka', 'ylo', 'sen', 'mi', 'tor', 'al', 'kel', 'su', 'vin', 'ha', 'ren'], end: ['i', 'a', 'el', 'is'],
      },
      ores: [{ b: 'lapis_ore', y: [8, 50], n: 3 }, { b: 'diamond_ore', y: [6, 20], n: 1 }, { b: 'emerald_ore', y: [6, 30], n: 1 }],
      landmarks: [
        { id: 'rose', de: 'Rosenkristall', en: 'Rose Crystal', shape: 'giantcrystal', b: 'rose_crystal_block', b2: 'rose_crystal_cluster' },
        { id: 'arch', de: 'Eisbogen', en: 'Ice Arch', shape: 'arch', b: 'packed_ice', b2: 'blue_ice' },
      ],
    },
  };
  E.ids = Object.keys(K);
  // every block name the worlds use (the tests check they exist)
  E.blockNames = function (kind) {
    const W = K[kind], out = new Set(), add = (v) => { if (typeof v === 'string') out.add(v); else if (Array.isArray(v)) v.forEach(add); };
    for (const b of W.biomes) add(b.surf);
    for (const f of W.flora) for (const k of ['stem', 'leaf', 'cap', 'under', 'b', 'base', 'tip', 'head']) add(f[k]);
    for (const k in W.species.kit) if (k !== 'shape') add(W.species.kit[k]);
    for (const o of W.ores) add(o.b);
    for (const l of W.landmarks) add([l.b, l.b2, l.b3]);
    if (W.liquid) add(W.liquid === 'ice' ? ['water', 'ice'] : W.liquid);
    return [...out];
  };

  // the biomes, appended after every older one (gen_body.js, gen_body2.js run before this file): a save's biome bytes
  // keep their meaning; flag moon (the body), no weather
  if (VR.BIOMES && VR.BIOME && VR.BIOME.aqua_fangrove === undefined) {
    for (const kind of E.ids) for (const b of K[kind].biomes) {
      const e = { id: VR.BIOMES.length, key: b.key, name: b.en, temp: 0.5, down: 0, grass: b.col, foliage: b.col, water: kind === 'aqua' ? 0x34c4b6 : 0x3F76E4, sky: 0, fog: null, precip: 'none', moon: kind, eco: true };
      VR.BIOMES.push(e); VR.BIOME[b.key] = e.id;
    }
  }

  // ================================================================ names (the species' own language)
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  E.word = function (kind, seed, n) {
    const S = K[kind].species, L = S.syl;
    let w = '';
    for (let i = 0; i < n; i++) w += L[Math.floor(h01(seed, i, 0x51) * L.length)];
    if (h01(seed, 9, 0x52) < 0.5) w += S.end[Math.floor(h01(seed, 10, 0x53) * S.end.length)];
    return cap(w.slice(0, 10));
  };
  const NAMES = {};
  E.names = function (kind) {
    if (NAMES[kind]) return NAMES[kind];
    const pick = (salt, n, syl) => { const out = [], seen = new Set(); for (let k = 0; out.length < n && k < n * 8; k++) { const w = E.word(kind, salt * 977 + k, syl + (h01(salt, k, 3) < 0.3 ? 1 : 0)); if (w.length >= 3 && !seen.has(w)) { seen.add(w); out.push(w); } } return out; };
    return (NAMES[kind] = { first: pick(strHash(kind) ^ 0x11, 32, 2), kids: pick(strHash(kind) ^ 0x22, 16, 2), sur: pick(strHash(kind) ^ 0x33, 16, 3) });
  };

  // ================================================================ the states (resolved once the registry is complete)
  const SC = new Map();
  const st = (name, props) => { const k = props ? name + JSON.stringify(props) : name; let s = SC.get(k); if (s !== undefined) return s; const t = VR.R.byName[name]; s = t ? (props ? t.state(props) : t.defaultState) : 0; SC.set(k, s); return s; };
  E.st = st;
  E.floraStates = function (kind) {
    const out = [], ground = new Set(K[kind].biomes.map(b => b.surf).concat(['sulfur', 'packed_ice', 'blue_ice', 'snow_block', 'ice', 'basalt', 'polished_basalt']));
    for (const f of K[kind].flora) for (const k of ['stem', 'leaf', 'cap', 'under', 'b', 'base', 'tip', 'head']) { const v = f[k]; if (!v) continue; for (const n of [].concat(v)) if (!ground.has(n)) out.push(st(n)); }
    return out;
  };
  const solid = (s) => s && (VR.R.T.flags[s] & VR.F.SOLID) && !(VR.R.T.flags[s] & VR.F.FLUID);
  const isFluid = (s) => s && (VR.R.T.flags[s] & VR.F.FLUID);

  // ================================================================ the eco of a generator: sites, plans, structures
  const kindOf = (gen) => (K[gen.id] ? gen.id : null);
  E.of = function (gen) {
    if (!gen || !(gen.bgen >= E.BGEN)) return null;
    if (gen.eco) return gen.eco;
    const kind = kindOf(gen); if (!kind) return null;
    return (gen.eco = new Eco(gen, kind));
  };
  class Eco {
    constructor(gen, kind) {
      this.gen = gen; this.kind = kind; this.W = K[kind]; this.s = (gen.s ^ 0xec0) >>> 0;
      const F = VR.Fractal, s = this.s;
      this.nB = new F(s ^ 0x101, 2, 1 / 230, 0.5);
      this.nB2 = new F(s ^ 0x102, 2, 1 / 140, 0.5);
      this.nC1 = new F(s ^ 0x201, 1, 1 / 40, 0.5);
      this.nC2 = new F(s ^ 0x202, 1, 1 / 40, 0.5);
      this.nCE = new F(s ^ 0x203, 1, 1 / 160, 0.5);
      this.baseOk = this.W.base ? new Set(this.W.base.map(k => VR.BIOME[k])) : null;
      this.land = gen.findSpawn(gen.prof.spawn.x, gen.prof.spawn.z);
      this.sites = []; this.plans = new Map(); this.buckets = new Map(); this.marks = [{ x: this.land[0], z: this.land[2], r: 5 }];   // (the landing kept clear)
      this.build();
    }
    // the eco biome (an index of W.biomes, or -1) at a column: pure noise, so neighbours agree
    bioAt(x, z) {
      const v = this.nB.n2(x, z);
      if (v < -0.18) return 0;
      if (v > 0.22) return 1;
      return this.nB2.n2(x, z) > 0.12 ? 2 : -1;
    }
    // the base ground allows the eco (land, not lava, not the stripes); h: the ground's height
    okAt(x, z, h, bio) {
      if (this.kind === 'aqua' && h < SEA + 1) return false;
      if (this.baseOk && !this.baseOk.has(bio !== undefined ? bio : this.gen.biomeAt(x, z))) return false;
      return true;
    }
    // a plant's or a pond's ground outside the chunk: the generator's height and whether the eco may grow there (cached:
    // the neighbours ask for the same cells)
    groundAt(x, z) {
      const key = x * 65536 + z, C = this.gc || (this.gc = new Map());
      let v = C.get(key);
      if (v === undefined) { const y = this.gen.surfaceY(x, z); v = this.okAt(x, z, y) ? y : -1; if (C.size > 8192) C.clear(); C.set(key, v); }
      return v;
    }
    near(x, z, pad) { for (const m of this.marks) if (Math.abs(m.x - x) < m.r + pad && Math.abs(m.z - z) < m.r + pad) return true; return false; }
    // ---------------------------------------------------------------- the sites and their plans
    build() {
      const g = this.gen, L = this.land, rings = [[110, 170], [420, 620], [880, 1150]];
      const rot = h01(this.s, 1, 7) * Math.PI * 2;
      rings.forEach(([r0, r1], ri) => {
        let best = null, bs = 1e9;
        for (let k = 0; k < 28; k++) {
          const a = rot + ri * 2.1 + k / 28 * Math.PI * 2, r = r0 + (r1 - r0) * h01(this.s, ri, k + 11);
          const x = Math.round(L[0] + Math.cos(a) * r), z = Math.round(L[2] + Math.sin(a) * r);
          const sc = this.siteScore(x, z); if (sc.score < bs) { bs = sc.score; best = { x, z, y: sc.y }; }
        }
        const id = 'eco:' + this.kind + ':' + ri;
        const site = { id, x: best.x, z: best.z, y: best.y, ring: ri, rad: 30, name: E.word(this.kind, this.s + ri * 131, 2 + (ri === 1 ? 1 : 0)) };
        this.sites.push(site); this.marks.push({ x: site.x, z: site.z, r: 34 });
      });
      // the landmarks: on a ring 230–380 m out, away from the villages
      this.landmarks = this.W.landmarks.map((lm, i) => {
        let x = 0, z = 0;
        for (let k = 0; k < 12; k++) {
          const a = rot + 1.3 + i * 2.6 + k * 0.5, r = 230 + 150 * h01(this.s, i, 77 + k);
          x = Math.round(L[0] + Math.cos(a) * r); z = Math.round(L[2] + Math.sin(a) * r);
          if (!this.near(x, z, 30) && this.okAt(x, z, g.surfaceY(x, z))) break;
        }
        const y = Math.max(g.surfaceY(x, z), this.kind === 'aqua' ? SEA : 0);
        const o = { id: 'lm:' + this.kind + ':' + lm.id, key: lm.id, de: lm.de, en: lm.en, x, y, z, lm };
        this.marks.push({ x, z, r: 16 });
        return o;
      });
      for (const s of this.sites) this.addOps(this.planOf(s).ops);
      for (const l of this.landmarks) this.addOps(landmarkOps(l, this.W));
    }
    siteScore(x, z) {
      const g = this.gen, hs = [];
      let wet = 0, bad = 0;
      for (const [dx, dz] of [[0, 0], [-18, -18], [0, -18], [18, -18], [-18, 0], [18, 0], [-18, 18], [0, 18], [18, 18], [-9, -9], [9, 9], [-9, 9], [9, -9]]) {
        const h = g.surfaceY(x + dx, z + dz); hs.push(h);
        if (this.kind === 'aqua' && h < SEA + 1) wet++;
        if (this.baseOk && this.kind !== 'aqua' && !this.baseOk.has(g.biomeAt(x + dx, z + dz))) bad++;
      }
      hs.sort((a, b) => a - b);
      const med = hs[6], range = hs[hs.length - 1] - hs[0];
      return { y: this.kind === 'aqua' ? Math.max(SEA + 1, med) : med, score: range + wet * 12 + bad * 20 };
    }
    planOf(site) {
      let P = this.plans.get(site.id);
      if (!P) { P = villagePlan(this, site); this.plans.set(site.id, P); }
      return P;
    }
    // the plan as villages.js takes it (no ops: the worker's answer)
    plan(id) {
      const s = this.sites.find(q => q.id === id); if (!s) return null;
      const P = this.planOf(s), out = {};
      for (const k in P) if (k !== 'ops') out[k] = P[k];
      return out;
    }
    fauna() { return this.W.fauna.slice(); }
    addOps(ops) {
      // ops [x, y, z, state …] into per-chunk buckets
      for (let i = 0; i < ops.length; i += 4) {
        const key = (ops[i] >> 4) + ',' + (ops[i + 2] >> 4);
        let b = this.buckets.get(key); if (!b) this.buckets.set(key, b = []);
        b.push(ops[i], ops[i + 1], ops[i + 2], ops[i + 3]);
      }
    }
    // ---------------------------------------------------------------- one chunk
    decorate(cx, cz, out) {
      const g = this.gen, W = this.W, blocks = out.blocks, x0 = cx * 16, z0 = cz * 16, R = VR.R;
      const tops = this._tops || (this._tops = new Int16Array(256)), ebio = this._eb || (this._eb = new Int8Array(256));
      const BI = W.biomes.map(b => VR.BIOME[b.key]);
      const surfS = W.biomes.map(b => (b.surf ? st(b.surf) : 0));
      const tintG = out.tints && out.tints.grass, tintF = out.tints && out.tints.foliage;
      const col565 = W.biomes.map(b => VR.rgb565((b.col >> 16) & 255, (b.col >> 8) & 255, b.col & 255));
      // ---- the ground: the top of each column, the biomes, their ground and tint
      for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
        const c = lz * 16 + lx, x = x0 + lx, z = z0 + lz;
        let y = 250; while (y > 1 && (!blocks[(y << 8) | c] || isFluid(blocks[(y << 8) | c]))) y--;
        // (a snow layer or a frost sheet on top stays the top's cover: its ground is below)
        tops[c] = y; ebio[c] = -1;
        const b = this.bioAt(x, z);
        if (b < 0) continue;
        const B0 = W.biomes[b];
        if (B0.under) { if (this.kind === 'aqua' && y < SEA - 1 && y > SEA - 16) { ebio[c] = b; out.biome[c] = BI[b]; } continue; }
        if (!this.okAt(x, z, y, out.biome[c]) || this.near(x, z, 0)) continue;
        ebio[c] = b; out.biome[c] = BI[b];
        const ts = blocks[(y << 8) | c];
        if (surfS[b] && solid(ts) && !(R.T.flags[blocks[((y + 1) << 8) | c]] & VR.F.SOLID)) blocks[(y << 8) | c] = surfS[b];
        if (tintG) { tintG[c] = col565[b]; tintF[c] = col565[b]; }
      }
      // ---- caves and ores
      this.caves(blocks, x0, z0, tops);
      this.ores(blocks, cx, cz, tops);
      // ---- ponds
      if (W.liquid) this.ponds(blocks, x0, z0, tops);
      // ---- flora
      this.flora(blocks, x0, z0, tops, ebio);
      // ---- the structures: villages and landmarks (their blocks last)
      const bk = this.buckets.get(cx + ',' + cz);
      if (bk) for (let i = 0; i < bk.length; i += 4) { const y = bk[i + 1]; if (y < 1 || y > 254) continue; blocks[(y << 8) | ((bk[i + 2] & 15) << 4) | (bk[i] & 15)] = bk[i + 3]; }
      for (const s of this.sites) if ((s.x >> 4) === cx && (s.z >> 4) === cz) out.spawns.push(['village', s.id]);
      return out;
    }
    caves(blocks, x0, z0, tops) {
      // two 3-D noises on a lattice (8 blocks across, 4 up), trilinear: a tunnel where both are near zero (|a| + |b| < t),
      // in a band from 36 below the ground to 6 below it (where they can be found; a mouth reaches the light)
      const aqua = this.kind === 'aqua', NY = 64;
      const A = this._ca || (this._ca = new Float32Array(3 * 3 * NY)), Bn = this._cb || (this._cb = new Float32Array(3 * 3 * NY));
      let maxTop = 0, minTop = 999; for (let i = 0; i < 256; i++) { const t = tops[i]; if (t > maxTop) maxTop = t; if (t > 0 && t < minTop) minTop = t; }
      const Y0 = Math.max(6, (minTop - 40) & ~3), ny = Math.min(NY, Math.ceil((maxTop - Y0) / 4) + 2);
      if (ny < 2 || maxTop < 12) return;
      for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) for (let j = 0; j < ny; j++) {
        const x = x0 + i * 8, z = z0 + k * 8, y = Y0 + j * 4, q = (i * 3 + k) * NY + j;
        A[q] = this.nC1.n3(x, y * 1.6, z); Bn[q] = this.nC2.n3(x + 911, y * 1.6, z - 377);
      }
      const bed = VR.GEN.S().bedrock;
      for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
        const c = lz * 16 + lx, top = tops[c], x = x0 + lx, z = z0 + lz;
        if (top < 12 || (aqua && top < SEA + 8) || this.near(x, z, 6)) continue;
        const open = this.nCE.n2(x, z) > 0.55;   // a cave's mouth: here the tunnels may reach the light
        const yTop = Math.min(open && !aqua ? top : top - 6, Y0 + (ny - 2) * 4 + 3), yBot = Math.max(Y0, top - 36);
        const i = lx >> 3, k = lz >> 3, fx = (lx & 7) / 8, fz = (lz & 7) / 8;
        for (let y = yBot; y <= yTop; y++) {
          const j = (y - Y0) >> 2, fy = ((y - Y0) & 3) / 4;
          const a = tri(A, NY, i, k, j, fx, fz, fy); if (a > 0.075 || a < -0.075) continue;
          if (Math.abs(a) + Math.abs(tri(Bn, NY, i, k, j, fx, fz, fy)) < 0.075) {
            const p = (y << 8) | c, s = blocks[p];
            if (s && s !== bed && !isFluid(s)) blocks[p] = 0;
          }
        }
      }
    }
    ores(blocks, cx, cz, tops) {
      const bed = VR.GEN.S().bedrock;
      this.W.ores.forEach((o, oi) => {
        const S0 = st(o.b);
        for (let n = 0; n < o.n; n++) {
          const lx = Math.floor(h01(cx * 7 + oi, cz, n * 3 + 1 + this.s) * 16), lz = Math.floor(h01(cx, cz * 7 + oi, n * 3 + 2 + this.s) * 16);
          const c0 = lz * 16 + lx, top = tops[c0];
          const y1 = Math.min(o.y[1], top - 4); if (y1 <= o.y[0]) continue;
          const y = o.y[0] + Math.floor(h01(cx + n, cz - oi, 0x3a + this.s) * (y1 - o.y[0]));
          const size = 3 + Math.floor(h01(n, oi, cx ^ cz) * 4);
          for (let k = 0; k < size; k++) {
            const x = Math.max(0, Math.min(15, lx + (k % 3) - 1)), z = Math.max(0, Math.min(15, lz + ((k >> 1) % 2))), yy = y + (k >> 2);
            const p = (yy << 8) | (z * 16 + x), s = blocks[p];
            if (solid(s) && s !== bed) blocks[p] = S0;
          }
        }
      });
    }
    ponds(blocks, x0, z0, tops) {
      // one pond per 112-block cell at most: a hollow at the centre's height, filled (water · frozen over · lava)
      const g = this.gen, C = 112, liq = this.W.liquid;
      const sW = st(liq === 'lava' ? 'lava' : 'water'), sI = liq === 'ice' ? st('ice') : 0;
      for (let ci = Math.floor((x0 - 12) / C); ci <= Math.floor((x0 + 28) / C); ci++) for (let cj = Math.floor((z0 - 12) / C); cj <= Math.floor((z0 + 28) / C); cj++) {
        if (h01(ci, cj, this.s ^ 0x9d) > 0.55) continue;
        const px = ci * C + 16 + Math.floor(h01(ci, cj, this.s ^ 0x9e) * (C - 32)), pz = cj * C + 16 + Math.floor(h01(ci, cj, this.s ^ 0x9f) * (C - 32));
        const r = 4 + h01(ci, cj, 0xa0) * 5;
        if (px + r + 1 < x0 || px - r - 1 > x0 + 15 || pz + r + 1 < z0 || pz - r - 1 > z0 + 15) continue;
        if (this.near(px, pz, r + 12)) continue;
        const L = g.surfaceY(px, pz);
        let lo = 1e9, hi = -1e9; for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r]]) { const h = g.surfaceY(px + dx, pz + dz); lo = Math.min(lo, h); hi = Math.max(hi, h); }
        if (hi - lo > 2 || lo < L - 1 || !this.okAt(px, pz, L)) continue;
        for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
          const x = x0 + lx, z = z0 + lz, d = Math.hypot(x - px, z - pz) / r;
          if (d > 1) continue;
          const c = lz * 16 + lx, top = tops[c];
          if (top > L + 4) continue;
          const dep = 1 + Math.round(2.2 * (1 - d * d));
          for (let y = L + 1; y <= Math.min(250, top + 1); y++) blocks[(y << 8) | c] = 0;
          for (let y = L - dep + 1; y <= L; y++) blocks[(y << 8) | c] = y === L && sI ? sI : sW;
          tops[c] = -1;   // (no plant in a pond)
        }
      }
    }
    flora(blocks, x0, z0, tops, ebio) {
      const g = this.gen, W = this.W, C = 5;
      const put = (x, y, z, s) => { const lx = x - x0, lz = z - z0; if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || y < 1 || y > 254) return; const p = (y << 8) | (lz * 16 + lx); if (!blocks[p]) blocks[p] = s; };
      const putW = (x, y, z, s) => { const lx = x - x0, lz = z - z0; if (lx < 0 || lx > 15 || lz < 0 || lz > 15) return; const p = (y << 8) | (lz * 16 + lx); if (!blocks[p] || isFluid(blocks[p])) blocks[p] = s; };
      const big = W.flora.filter(f => f.shape !== 'tuft' && f.shape !== 'coral');
      // ---- the big plants: one candidate per 5×5 cell (its place, its kind by hash; the ground from the generator)
      for (let i = Math.floor((x0 - 4) / C); i <= Math.floor((x0 + 19) / C); i++) for (let j = Math.floor((z0 - 4) / C); j <= Math.floor((z0 + 19) / C); j++) {
        const x = i * C + Math.floor(h01(i, j, this.s ^ 0xf1) * C), z = j * C + Math.floor(h01(i, j, this.s ^ 0xf2) * C);
        const b = this.bioAt(x, z); if (b < 0 || W.biomes[b].under) continue;
        const opts = big.filter(f => f.bio.indexOf(b) >= 0); if (!opts.length) continue;
        const f = opts[Math.floor(h01(i, j, this.s ^ 0xf3) * opts.length)];
        if (h01(i, j, this.s ^ 0xf4) > f.p) continue;
        if (this.near(x, z, 4)) continue;
        const y0 = this.groundAt(x, z); if (y0 < 0) continue;
        // (inside the chunk the real ground decides: a pond, a crater's boulder — no plant there)
        if (x >= x0 && x < x0 + 16 && z >= z0 && z < z0 + 16) { const t = tops[(z - z0) * 16 + x - x0]; if (t < 0 || Math.abs(t - y0) > 1) continue; }
        plant(f, x, y0 + 1, z, h01(i, j, this.s ^ 0xf5), put);
      }
      // ---- the tufts and the corals: per column, inside the chunk
      for (let c = 0; c < 256; c++) {
        const b = ebio[c]; if (b < 0) continue;
        const top = tops[c]; if (top < 1) continue;
        const x = x0 + (c & 15), z = z0 + (c >> 4), hv = h01(x, z, this.s ^ 0xf6);
        const under = !!W.biomes[b].under;
        for (const f of W.flora) {
          if (f.bio.indexOf(b) < 0 || (f.shape !== 'tuft' && f.shape !== 'coral')) continue;
          if (hv > f.p) continue;
          const pick = f.b[Math.floor(h01(x, z, 0xf7) * f.b.length)];
          if (under) {
            const above = blocks[((top + 1) << 8) | c]; if (!isFluid(above)) break;
            if (f.shape === 'coral') { const h = f.h[0] + Math.floor(h01(x, z, 0xf8) * (f.h[1] - f.h[0] + 1)); for (let k = 1; k <= h && top + k < SEA - 1; k++) putW(x, top + k, z, st(pick)); }
            else if (top + 1 < SEA - 1) putW(x, top + 1, z, st(pick));
          } else {
            const p = ((top + 1) << 8) | c; if (blocks[p] || !solid(blocks[(top << 8) | c])) break;
            blocks[p] = st(pick);
          }
          break;
        }
      }
    }
  }
  E.Eco = Eco;
  // the lattice's trilinear value (3 × 3 columns of NY samples, 8 blocks apart)
  function tri(Arr, NY, i, k, j, fx, fz, fy) {
    const a = (i * 3 + k) * NY + j, b = ((i + 1) * 3 + k) * NY + j, c = (i * 3 + k + 1) * NY + j, d = ((i + 1) * 3 + k + 1) * NY + j;
    const c00 = Arr[a] * (1 - fx) + Arr[b] * fx, c10 = Arr[c] * (1 - fx) + Arr[d] * fx;
    const c01 = Arr[a + 1] * (1 - fx) + Arr[b + 1] * fx, c11 = Arr[c + 1] * (1 - fx) + Arr[d + 1] * fx;
    return (c00 * (1 - fz) + c10 * fz) * (1 - fy) + (c01 * (1 - fz) + c11 * fz) * fy;
  }

  // ---------------------------------------------------------------- the plants (our own shapes)
  function plant(f, x, y, z, u, put) {
    const H = f.h ? f.h[0] + Math.floor(u * (f.h[1] - f.h[0] + 1)) : 1, r = (k) => h01(x + k, z - k, y);
    switch (f.shape) {
      case 'umbrella': {
        // a stem, a flat cap (a disc, its rim one lower), lights hung under it
        const S = st(f.stem), Cc = st(f.cap), R0 = f.r[0] + Math.floor(r(1) * (f.r[1] - f.r[0] + 1));
        for (let k = 0; k < H; k++) put(x, y + k, z, S);
        for (let dx = -R0; dx <= R0; dx++) for (let dz = -R0; dz <= R0; dz++) { const d = Math.hypot(dx, dz); if (d > R0 + 0.4) continue; put(x + dx, y + H - (d > R0 - 0.6 ? 1 : 0), z + dz, Cc); }
        if (f.under && R0 >= 2) { const U = st(f.under); put(x + R0 - 1, y + H - 2, z, U); put(x - R0 + 1, y + H - 2, z, U); }
        break;
      }
      case 'spire': {
        const S = st(f.base), Tp = st(f.tip);
        for (let k = 0; k < H; k++) put(x, y + k, z, S);
        put(x, y + H, z, Tp);
        if (H >= 3) { const sx = r(2) < 0.5 ? 1 : -1; put(x + sx, y, z, S); put(x + sx, y + 1, z, Tp); }
        break;
      }
      case 'bulb': {
        const S = st(f.stem), Hd = st(f.head);
        for (let k = 0; k < H; k++) put(x, y + k, z, S);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = 0; dy <= 1; dy++) if (!(Math.abs(dx) + Math.abs(dz) === 2 && dy === 1)) put(x + dx, y + H + dy, z + dz, Hd);
        break;
      }
      case 'fan': {
        // a slender trunk, leaning once; a crown of fronds in a star, their tips drooping
        const S = st(f.stem), Lf = st(f.leaf), lean = r(3) < 0.5 ? 1 : 0, ax = r(4) < 0.5 ? 1 : -1;
        let tx = x;
        for (let k = 0; k < H; k++) { if (lean && k === Math.floor(H / 2)) tx += ax; put(tx, y + k, z, S); }
        const ty = y + H;
        put(tx, ty, z, Lf);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const n = Math.abs(dx) + Math.abs(dz) === 2 ? 2 : 3;
          for (let k = 1; k <= n; k++) put(tx + dx * k, ty - (k === n ? 1 : 0), z + dz * k, Lf);
        }
        break;
      }
    }
  }

  // ---------------------------------------------------------------- the landmarks
  function landmarkOps(l, W) {
    const ops = [], put = (x, y, z, s) => ops.push(x, y, z, s), X = l.x, Y = l.y, Z = l.z, L = l.lm, b = st(L.b), b2 = st(L.b2 || L.b);
    switch (L.shape) {
      case 'arch': {
        // a parabolic arch 22 wide, 15 high, three thick, its keystones of the second block
        for (let dx = -11; dx <= 11; dx++) {
          const u = dx / 11, yy = Math.round(15 * (1 - u * u));
          for (let t = -1; t <= 1; t++) for (let k = 0; k <= 2; k++) put(X + dx, Y + yy - k, Z + t, Math.abs(dx) < 2 ? b2 : b);
          if (Math.abs(dx) >= 9) for (let y = Y - 3; y < Y + yy; y++) for (let t = -1; t <= 1; t++) put(X + dx, y, Z + t, b);
        }
        break;
      }
      case 'giantcrystal': {
        // a leaning crystal 26 high, tapering, with smaller spires round its foot
        for (let k = 0; k < 26; k++) { const rr = 3.2 * (1 - k / 28); const ox = Math.round(k * 0.12); for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) if (Math.hypot(dx, dz) <= rr) put(X + dx + ox, Y + k - 2, Z + dz, b); }
        put(X + 3, Y + 24, Z, b2);
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, x = X + Math.round(Math.cos(a) * 6), z = Z + Math.round(Math.sin(a) * 6), h = 3 + (i * 7) % 5; for (let k = -1; k < h; k++) put(x, Y + k, z, b); put(x, Y + h, z, b2); }
        break;
      }
      case 'giantcap': {
        const S = st(L.b), Cc = st(L.b2), U = st(L.b3 || L.b2);
        for (let k = -2; k < 17; k++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) put(X + dx, Y + k, Z + dz, S);
        for (let dx = -8; dx <= 8; dx++) for (let dz = -8; dz <= 8; dz++) { const d = Math.hypot(dx, dz); if (d > 8.4) continue; put(X + dx, Y + 17 - (d > 6.5 ? 1 : 0) + (d < 3 ? 1 : 0), Z + dz, Cc); if ((dx * 3 + dz * 5) % 7 === 0 && d > 2 && d < 7) put(X + dx, Y + 15, Z + dz, U); }
        break;
      }
      case 'circle': {
        // nine standing stones round a lit centre stone
        for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, x = X + Math.round(Math.cos(a) * 9), z = Z + Math.round(Math.sin(a) * 9), h = 4 + (i % 3); for (let k = -2; k < h; k++) { put(x, Y + k, z, b); put(x, Y + k, z + 1, b); } if (i % 3 === 0) put(x, Y + h, z, st('lantern')); }
        for (let k = -1; k < 2; k++) put(X, Y + k, Z, b); put(X, Y + 2, Z, b2);
        break;
      }
    }
    // (lift: the landmark's air above its foot cleared in its own footprint is not needed — it stands on the ground)
    void W;
    return ops;
  }

  // ================================================================ the villages (plans villages.js takes)
  function writer(ground, F, K0) {
    const ops = [], put = (x, y, z, s) => ops.push(x, y, z, s);
    const level = (x, z) => {
      const gy = ground(x, z);
      if (gy < F) for (let y = Math.max(gy + 1, F - 5); y < F; y++) put(x, y, z, st(K0.fill));
      for (let y = F + 1; y <= Math.max(F + 9, Math.min(gy + 2, F + 14)); y++) put(x, y, z, 0);
    };
    return { ops, put, level };
  }
  // a home in the species' shape at (cx, cz), its door on the side s (+1: +z, toward the plaza when it is there)
  function house(Kit, ground, F, cx, cz, s, u) {
    const W = writer(ground, F, Kit), put = W.put, S = (n, p) => st(n, p);
    const wall = S(Kit.wall), band = S(Kit.band), roof = S(Kit.roof), win = S(Kit.window), floor = S(Kit.floor);
    let RZ = 3, top = 3, R = 5;
    const fill = (fn, rx, rz, h) => { for (let dx = -rx; dx <= rx; dx++) for (let dz = -rz; dz <= rz; dz++) for (let dy = 1; dy <= h; dy++) { const v = fn(dx, dy, dz); if (v !== undefined) put(cx + dx, F + dy, cz + dz, v); } };
    switch (Kit.shape) {
      case 'round': {   // a shell hut: a round wall, a band of colour, a cone of thatch, windows to the four sides
        R = 5; RZ = 4; top = 3;
        for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) if (dx * dx + dz * dz <= 22) { W.level(cx + dx, cz + dz); put(cx + dx, F, cz + dz, floor); }
        fill((dx, dy, dz) => {
          const d = Math.hypot(dx, dz);
          if (dy <= 3) { if (d > 4.6) return; if (d > 3.5) return dy === 2 && (dx === 0 || dz === 0) && !(dx === 0 && Math.sign(dz) === s) ? win : dy === 3 ? band : wall; return 0; }
          const rr = 5.2 - (dy - 3) * 1.35; if (d > rr) return; return d > rr - 1.3 ? roof : 0;
        }, 5, 5, 7);
        break;
      }
      case 'terrace': {   // an earth house: thick walls, a flat roof with a parapet, a band at the foot, wide windows
        R = 5; RZ = 3; top = 3;
        for (let dx = -5; dx <= 5; dx++) for (let dz = -4; dz <= 4; dz++) { W.level(cx + dx, cz + dz); put(cx + dx, F, cz + dz, floor); }
        fill((dx, dy, dz) => {
          const edge = Math.abs(dx) === 4 || Math.abs(dz) === 3;
          if (dy === 4) return Math.abs(dx) <= 4 && Math.abs(dz) <= 3 ? roof : undefined;
          if (dy === 5) return (Math.abs(dx) === 4 || Math.abs(dz) === 3) && ((dx + dz) & 1) === 0 ? band : undefined;
          if (Math.abs(dx) > 4 || Math.abs(dz) > 3) return;
          if (!edge) return 0;
          if (dy === 1) return band;
          return dy === 2 && Math.abs(dz) === 3 && Math.abs(dx) >= 2 && Math.abs(dx) <= 3 ? win : dy === 2 && Math.abs(dx) === 4 && dz === 0 ? win : wall;
        }, 5, 4, 5);
        break;
      }
      case 'tower': {   // a basalt tower house: a wide storey, a narrower one over it, a crown of crystal
        R = 4; RZ = 3; top = 4;
        for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) { W.level(cx + dx, cz + dz); put(cx + dx, F, cz + dz, floor); }
        fill((dx, dy, dz) => {
          const ax = Math.abs(dx), az = Math.abs(dz);
          if (dy <= 4) { if (ax > 3 || az > 3) return; if (ax < 3 && az < 3) return 0; return dy === 4 ? band : dy === 2 && (ax === 0 || az === 0) && !(dx === 0 && Math.sign(dz) === s) ? win : wall; }
          if (dy <= 7) { if (ax > 2 || az > 2) return dy === 5 && ax <= 3 && az <= 3 ? band : undefined; if (ax < 2 && az < 2) return 0; return dy === 6 && (ax === 0 || az === 0) ? win : wall; }
          const rr = 2 - (dy - 8); if (ax > rr || az > rr) return; return roof;
        }, 4, 4, 10);
        break;
      }
      case 'dome': {   // a half-sunk dome: a ring of stone, a band, a glass cap with an oculus of light
        R = 5; RZ = 4; top = 3;
        for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) if (dx * dx + dz * dz <= 24) { W.level(cx + dx, cz + dz); put(cx + dx, F, cz + dz, floor); }
        fill((dx, dy, dz) => {
          const d = Math.sqrt(dx * dx + dz * dz + (dy * 1.1) * (dy * 1.1)); if (d > 4.8) return;
          if (d > 3.7) return dy <= 1 ? wall : dy === 2 ? band : roof; return 0;
        }, 5, 5, 5);
        break;
      }
      default: {   // 'vault': an ice vault along z — walls three high, a round barrel roof, the ends with windows
        R = 4; RZ = 4; top = 3;
        for (let dx = -4; dx <= 4; dx++) for (let dz = -5; dz <= 5; dz++) { W.level(cx + dx, cz + dz); put(cx + dx, F, cz + dz, floor); }
        const OUT = [5, 5, 4, 3], IN = [4, 4, 3];
        fill((dx, dy, dz) => {
          const ax = Math.abs(dx), az = Math.abs(dz); if (ax > 3 || az > 4 || dy > OUT[ax]) return;
          const inner = ax <= 2 && az <= 3 && dy <= IN[ax];
          if (inner) return 0;
          if (az === 4 && dy === 2 && ax === 2) return win;
          return dy === OUT[ax] ? roof : dy === 1 ? band : wall;
        }, 4, 5, 5);
      }
    }
    // the door (two halves) on the side s, two beds at the back, a light inside, a lamp by the door
    const dz = RZ * s, fac = s > 0 ? 2 : 0;
    put(cx, F + 1, cz + dz, S(Kit.door, { facing: fac, half: 0 })); put(cx, F + 2, cz + dz, S(Kit.door, { facing: fac, half: 1 }));
    if (Kit.shape === 'round' || Kit.shape === 'dome') put(cx, F + 3, cz + dz, Kit.shape === 'round' ? band : roof);
    const beds = [], bz = cz - s, hf = s > 0 ? 0 : 2;
    for (const bx of [cx - 2, cx + 2]) { put(bx, F + 1, bz, S(Kit.bed, { facing: hf, part: 0 })); put(bx, F + 1, bz - s, S(Kit.bed, { facing: hf, part: 1 })); beds.push([bx, F + 1, bz, hf]); }
    put(cx, F + top, cz, S('light_panel', { facing: 5 }));
    put(cx + 1 + (u > 0.5 ? 0 : -2), F + 1, cz + dz + s, S(Kit.light));
    return { kind: 'home', ops: W.ops, door: [cx, F + 1, cz + dz], outside: [cx, F + 1, cz + dz + s], inside: [cx, F + 1, cz + dz - 2 * s], beds, seats: [], work: [], chimney: null, table: null, lights: [[cx, F + top, cz]], box: [cx - R, F, cz - R, cx + R, F + 9, cz + R] };
  }
  const HOMES = [[-13, -14], [0, -15], [13, -14], [-13, 14], [0, 15], [13, 14]];
  function villagePlan(eco, site) {
    const Kit = eco.W.species.kit, g = eco.gen, F = site.y | 0, X = site.x, Z = site.z, kind = eco.kind;
    const ground = (x, z) => g.surfaceY(x, z);
    const seed = strHash(site.id + ':' + (eco.s >>> 0)) >>> 0;
    const P = { id: site.id, name: site.name, style: 'sp:' + kind, kind, x: X, y: F + 1, z: Z, seed, rad: 30, homes: [], work: [], farms: [], lots: [], lamps: [], chimneys: [], plaza: { x: X, y: F + 1, z: Z }, roads: [], bell: null, pad: null, shops: [], pastures: [], orchards: [], windmills: [], base: null, ops: [], names: E.names(kind), species: kind };
    const W = writer(ground, F, Kit), put = W.put, pav = st(Kit.paving), mark = st(Kit.mark);
    // the plaza: 13 × 13 paving, the species' mark stone in its middle (a pillar with its light), the ways to the homes
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) { W.level(X + dx, Z + dz); put(X + dx, F, Z + dz, (dx + dz) % 4 === 0 && Math.abs(dx) < 5 && Math.abs(dz) < 5 ? st(Kit.band) : pav); }
    put(X, F + 1, Z, mark); put(X, F + 2, Z, mark); put(X, F + 3, Z, st(Kit.light));
    for (const [dx, dz] of HOMES) {
      const s = dz > 0 ? -1 : 1;
      for (let k = 6; k < Math.abs(dz) - 4; k++) { W.level(X + dx, Z + k * Math.sign(dz)); put(X + dx, F, Z + k * Math.sign(dz), pav); if (dx) for (let q = Math.min(0, dx); q <= Math.max(0, dx); q++) { W.level(X + q, Z + 7 * Math.sign(dz)); put(X + q, F, Z + 7 * Math.sign(dz), pav); } }
    }
    for (const o of W.ops) P.ops.push(o);
    HOMES.forEach(([dx, dz], i) => { const h = house(Kit, ground, F, X + dx, Z + dz, dz > 0 ? -1 : 1, h01(seed, i, 5)); P.homes.push(h); for (const o of h.ops) P.ops.push(o); delete h.ops; });
    // the trader's stall (east of the plaza): a counter under a striped canopy, the goods on show
    const SW = writer(ground, F, Kit), sx = X + 10, sz = Z;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -3; dz <= 3; dz++) { SW.level(sx + dx, sz + dz); SW.put(sx + dx, F, sz + dz, pav); }
    for (let dz = -2; dz <= 2; dz++) SW.put(sx + 1, F + 1, sz + dz, st(Kit.band));
    for (const [dx, dz] of [[-2, -3], [2, -3], [-2, 3], [2, 3]]) for (let k = 1; k <= 3; k++) SW.put(sx + dx, F + k, sz + dz, st(Kit.wall));
    for (let dx = -2; dx <= 2; dx++) for (let dz = -3; dz <= 3; dz++) SW.put(sx + dx, F + 4, sz + dz, (dz & 1) ? st(Kit.canopy) : st('white_wool'));
    const goods = eco.W.species.goods.filter(n => VR.R.byName[n]);
    for (let k = 0; k < 3 && k < goods.length; k++) SW.put(sx + 1, F + 2, sz - 2 + k * 2, st(goods[k]));
    for (const o of SW.ops) P.ops.push(o);
    P.work.push({ kind: 'stall', spot: [sx - 1, F + 1, sz], keeper: [sx + 1.5, F + 1, sz + 0.5] });
    // the garden (west): beds of the world's crop rows on its own ground, a keeper
    const GW = writer(ground, F, Kit), gx = X - 11, gz = Z;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -4; dz <= 4; dz++) { GW.level(gx + dx, gz + dz); GW.put(gx + dx, F, gz + dz, Math.abs(dx) === 1 ? st('moss_block') : pav); if (Math.abs(dx) === 1) GW.put(gx + dx, F + 1, gz + dz, st('vm_crop_rows')); }
    for (const o of GW.ops) P.ops.push(o);
    P.work.push({ kind: 'garden', spot: [gx, F + 1, gz] });
    // the lamps round the plaza and along the ways
    for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6], [-7, 0], [7, -8], [-7, 8]]) { P.ops.push(X + dx, F + 1, Z + dz, st(Kit.lamp)); P.lamps.push([X + dx, F + 2, Z + dz]); }
    return P;
  }
  E.villagePlan = villagePlan;

  // ================================================================ the hook: the generators of bgen ≥ 3
  const wrap = (proto) => {
    if (!proto || proto.generate.__eco) return;
    const g0 = proto.generate;
    proto.generate = function (cx, cz) {
      const out = g0.call(this, cx, cz);
      if (this.bgen >= E.BGEN && out && out.blocks) {
        try { const eco = E.of(this); if (eco) eco.decorate(cx, cz, out); }
        catch (e) { if (!this._ecoErr) { this._ecoErr = 1; console.warn('world eco', e); } }
      }
      return out;
    };
    proto.generate.__eco = true;
  };
  wrap(VR.BodyGen.prototype);
  if (VR.BodyGenKinds) for (const k in VR.BodyGenKinds) { const C = VR.BodyGenKinds[k]; let p = C && C.prototype; while (p && !Object.prototype.hasOwnProperty.call(p, 'generate')) p = Object.getPrototypeOf(p); if (p && p !== VR.BodyGen.prototype) wrap(p); }
  // the worker's questions (worker_main.js): the villages near a point, a village's plan
  E.sitesNear = function (gen, x, z, r) { const eco = E.of(gen); if (!eco) return null; return eco.sites.filter(s => Math.hypot(s.x - x, s.z - z) <= r).map(s => ({ id: s.id, name: s.name, style: 'sp:' + eco.kind, x: s.x, y: s.y + 1, z: s.z, rad: s.rad })); };
  E.planFor = function (gen, vid) { const eco = E.of(gen); return eco ? eco.plan(vid) : null; };
  // the player-facing words (lang_de.js / lang_en.js)
  E.KEYS = [];
  for (const kind of E.ids) {
    const W = K[kind];
    E.KEYS.push('g.eco.sp.' + kind, 'g.eco.home.' + kind);
    for (const b of W.biomes) E.KEYS.push('g.biome.' + b.key);
    for (const f of W.fauna) E.KEYS.push('g.mob.' + f.id);
    for (const l of W.landmarks) E.KEYS.push('g.eco.lm.' + kind + '.' + l.id);
  }
  E.KEYS.push('g.set.realGrav', 'g.set.realGrav.tip', 'g.eco.worlds', 'g.eco.worlds.tip', 'g.eco.welcome', 'g.eco.handel', 'g.travel.worlds', 'g.eco.village', 'g.eco.met');
  // bgen 3 is the bodies' current version (bodies.js reads it: a new save's bodies get it, an old save keeps its own)
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
