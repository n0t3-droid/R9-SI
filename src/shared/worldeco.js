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
        kit: { lamp4: 'lantern', post4: 'bamboo_fence', pave4: ['smooth_sandstone', 'cut_sandstone'], bench4: 'smooth_sandstone_slab', flower4: 'blue_orchid', shape: 'round', wall: 'calcite', band: 'cyan_terracotta', roof: 'dried_kelp_block', floor: 'bamboo_planks', fill: 'sandstone', window: 'light_blue_stained_glass', door: 'bamboo_door', bed: 'cyan_bed', light: 'tide_lantern', paving: 'smooth_quartz', lamp: 'vx_lamppost_crystal', canopy: 'cyan_wool', mark: 'tube_coral_block' },
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
        { key: 'ocker_lichen', de: 'Rostflechtenfeld', en: 'Rust Lichen Field', col: 0x8a6448, surf: 'podzol' },
        { key: 'ocker_thorn', de: 'Dornsteppe', en: 'Thorn Steppe', col: 0x9a8a50, surf: 'coarse_dirt' },
        { key: 'ocker_amber', de: 'Bernsteingarten', en: 'Amber Garden', col: 0xd89a40, surf: 'red_sand' },
      ],
      base: null,
      flora: [
        { id: 'rustcap', de: 'Rostschirm', en: 'Rust Cap', shape: 'umbrella', bio: [0], p: 0.35, stem: 'mushroom_stem', cap: 'brown_mushroom_block', under: 'lantern', h: [3, 6], r: [2, 3] },
        { id: 'thornpillar', de: 'Dornsäule', en: 'Thorn Pillar', shape: 'spire', bio: [1], p: 0.4, base: 'cactus', tip: 'cactus_flower', h: [2, 4] },
        { id: 'ambernadel', de: 'Bernsteinnadel', en: 'Amber Needle', shape: 'spire', bio: [2], p: 0.35, base: 'amber_crystal_block', tip: 'amber_crystal_cluster', h: [1, 4] },
        { id: 'dusttuft', de: 'Staubgras', en: 'Dust Grass', shape: 'tuft', bio: [0, 1, 2], p: 0.12, b: ['dead_bush', 'short_grass', 'dead_bush'] },
        { id: 'rustbulb', de: 'Rostknolle', en: 'Rust Bulb', shape: 'bulb', bio: [0, 1], p: 0.18, stem: 'mushroom_stem', head: 'brown_terracotta', h: [1, 2] },
      ],
      fauna: [
        { id: 'dune_trotter', de: 'Dünentraber', en: 'Dune Trotter', does: 'graze' },
        { id: 'rust_hopper', de: 'Rosthüpfer', en: 'Rust Hopper', does: 'hop' },
        { id: 'dust_moth', de: 'Staubfalter', en: 'Dust Moth', does: 'fly' },
      ],
      species: {
        de: 'Dunelin', en: 'Dunelin',
        look: { skin: [0xd8b444, 0xc8a43a, 0xe0c25a, 0xbc9a36], cut: ['robe', 'cape', 'robe'], feat: 'horns', featC: [0xf0e2c0, 0xd8c8a0, 0xe8d0a8], garb: [0xe8d8b8, 0x9a4a2a, 0x5a6a7a, 0xd8b060, 0x7a3a2a, 0x3a6a6a], eye: 0x2a1a10 },
        kit: { lamp4: 'lantern', post4: 'acacia_fence', pave4: ['smooth_red_sandstone', 'cut_red_sandstone'], bench4: 'acacia_slab', flower4: 'orange_tulip', shape: 'terrace', wall: 'terracotta', band: 'red_sandstone', roof: 'smooth_red_sandstone', floor: 'acacia_planks', fill: 'red_sandstone', window: 'orange_stained_glass', door: 'acacia_door', bed: 'orange_bed', light: 'lantern', paving: 'smooth_red_sandstone', lamp: 'vx_lamppost_black', canopy: 'orange_wool', mark: 'amber_crystal_block' },
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
        kit: { lamp4: 'spirit_lantern', post4: 'crimson_fence', pave4: ['polished_basalt', 'smooth_basalt'], bench4: 'crimson_slab', flower4: 'torchflower', shape: 'tower', wall: 'polished_basalt', band: 'sulfur_bricks', roof: 'amber_crystal_block', floor: 'crimson_planks', fill: 'basalt', window: 'yellow_stained_glass', door: 'crimson_door', bed: 'red_bed', light: 'spirit_lantern', paving: 'polished_sulfur', lamp: 'vx_lamppost_crystal', canopy: 'yellow_wool', mark: 'magma_block' },
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
        kit: { lamp4: 'lantern', post4: 'andesite_wall', pave4: ['polished_andesite', 'andesite'], bench4: 'smooth_stone_slab', flower4: 'azure_bluet', shape: 'dome', wall: 'polished_andesite', band: 'smooth_basalt', roof: 'light_blue_stained_glass', floor: 'smooth_stone', fill: 'andesite', window: 'light_blue_stained_glass', door: 'door_glass_white', bed: 'gray_bed', light: 'lantern', paving: 'polished_andesite', lamp: 'vx_lamppost_tech', canopy: 'gray_wool', mark: 'azure_crystal_block' },
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
        kit: { lamp4: 'lantern', post4: 'spruce_fence', pave4: ['smooth_stone', 'snow_block_cut'], bench4: 'spruce_slab', flower4: 'white_tulip', shape: 'vault', wall: 'packed_ice', band: 'snow_block', roof: 'blue_ice', floor: 'spruce_planks', fill: 'packed_ice', window: 'light_blue_stained_glass', door: 'spruce_door', bed: 'light_blue_bed', light: 'lantern', paving: 'snow_block_cut', lamp: 'vx_lamppost_crystal', canopy: 'light_blue_wool', mark: 'rose_crystal_block' },
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
  // u-worlds4 · bgen 5's kits (the dusk: a darker second paving tone everywhere — the pale stones washed pink at dusk —,
  // Zinnober's benches and posts of dark polished deepstone instead of crimson — no basalt slab exists, no new blocks),
  // the towns' roads between the villages and their bridges over water and lava. E.kit(kind, bgen): bgen ≤ 4 the kit as
  // it was (the same object), bgen 5 a copy with pave4/bench4/post4 taken from these (plaza4 reads them as before).
  const K5 = {
    aqua: { pave5: ['smooth_sandstone', 'packed_mud'], road5: 'cut_sandstone', bridge5: 'bamboo_planks' },
    ocker: { pave5: ['cut_red_sandstone', 'brown_terracotta'], road5: 'packed_mud', bridge5: 'acacia_planks' },
    zinn: { pave5: ['polished_basalt', 'polished_deepstone'], bench5: 'polished_deepstone_slab', post5: 'polished_deepstone_wall', road5: 'smooth_basalt', bridge5: 'polished_basalt' },
    basalt: { pave5: ['polished_andesite', 'polished_deepstone'], road5: 'polished_tuff', bridge5: 'smooth_stone' },
    opal: { pave5: ['smooth_stone', 'stone_bricks'], road5: 'spruce_planks', bridge5: 'spruce_planks' },
  };
  E.K5 = K5;
  // u-worlds5 · bgen 6's town ground (dressTown): the floor between the buildings (two tones of the species' own
  // ground — Zinnober basalt, nothing red that reads as lava), the garden beds and their plants, Aquamarin's pier
  // quarter over the water (a deck, posts every four blocks, a railing at the outer edge)
  const K6 = {
    aqua: { floor6: ['pale_moss_block', 'sand'], bed6: 'moss_block', plants6: ['fern', 'short_grass', 'lily_of_the_valley', 'blue_orchid'], deck6: 'mangrove_planks', postp6: 'stripped_mangrove_log', rail6: 'bamboo_fence' },
    ocker: { floor6: ['coarse_dirt', 'packed_mud'], bed6: 'podzol', plants6: ['dead_bush', 'short_grass', 'orange_tulip'] },
    zinn: { floor6: ['basalt', 'smooth_basalt'], bed6: 'tuff', plants6: ['dead_bush', 'torchflower', 'dead_bush'] },
    basalt: { floor6: ['regolith', 'andesite'], bed6: 'moss_block', plants6: ['fern', 'short_grass', 'azure_bluet'] },
    opal: { floor6: ['snow_block', 'packed_ice'], bed6: 'snow_block', plants6: ['fern', 'short_grass', 'white_tulip'] },
  };
  E.K6 = K6;
  E.DARK = new Set(['packed_mud', 'brown_terracotta', 'polished_deepstone', 'smooth_basalt', 'stone_bricks', 'mud_bricks', 'tuff_bricks', 'polished_tuff']);
  const KIT5 = {};
  E.kit = function (kind, bgen) {
    const k0 = K[kind].species.kit;
    if (!(bgen >= 5)) return k0;
    const ck = bgen >= 6 ? kind + ':6' : kind;   // (u-worlds5: bgen 6 adds the ground's keys, the rest as bgen 5)
    if (KIT5[ck]) return KIT5[ck];
    const k5 = Object.assign({}, k0, K5[kind], bgen >= 6 ? K6[kind] : null);
    k5.pave4 = k5.pave5; if (k5.bench5) k5.bench4 = k5.bench5; else k5.bench5 = k5.bench4; if (k5.post5) k5.post4 = k5.post5; else k5.post5 = k5.post4;
    return (KIT5[ck] = k5);
  };
  // every block name the worlds use (the tests check they exist)
  E.blockNames = function (kind) {
    const W = K[kind], out = new Set(), add = (v) => { if (typeof v === 'string') out.add(v); else if (Array.isArray(v)) v.forEach(add); };
    for (const b of W.biomes) add(b.surf);
    for (const f of W.flora) for (const k of ['stem', 'leaf', 'cap', 'under', 'b', 'base', 'tip', 'head']) add(f[k]);
    for (const k in W.species.kit) if (k !== 'shape') add(W.species.kit[k]);
    for (const k in K6[kind]) add(K6[kind][k]);   // (u-worlds5: bgen 6's ground)
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
  const SITE_PTS = [[0, 0], [-18, -18], [0, -18], [18, -18], [-18, 0], [18, 0], [-18, 18], [0, 18], [18, 18], [-9, -9], [9, 9], [-9, 9], [9, -9]];
  // (u-worlds4: a town's ground — 25 points over ±48)
  const TOWN_PTS = []; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) TOWN_PTS.push([i * 24, j * 24]);
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
      const g = this.gen, L = this.land, T5 = g.bgen >= 5, rings = [[T5 ? 100 : 75, T5 ? 125 : 105], [420, 620], [880, 1150]]   // (u-worlds2: the first village closer — in the arrival's view; u-worlds4, bgen 5: the town a little further, its edge 35–60 m off);
      const rot = h01(this.s, 1, 7) * Math.PI * 2;
      rings.forEach(([r0, r1], ri) => {
        let best = null, bs = 1e9;
        for (let k = 0; k < 28; k++) {
          const a = rot + ri * 2.1 + k / 28 * Math.PI * 2, r = r0 + (r1 - r0) * h01(this.s, ri, k + 11);
          const x = Math.round(L[0] + Math.cos(a) * r), z = Math.round(L[2] + Math.sin(a) * r);
          const sc = this.siteScore(x, z, T5 && ri === 0); if (sc.score < bs) { bs = sc.score; best = { x, z, y: sc.y }; }
        }
        const id = 'eco:' + this.kind + ':' + ri, town = T5 && ri === 0;
        const site = { id, x: best.x, z: best.z, y: best.y, ring: ri, rad: town ? 64 : 30, name: E.word(this.kind, this.s + ri * 131, 2 + (ri === 1 ? 1 : 0)) };
        if (town) site.town = true;
        this.sites.push(site); this.marks.push({ x: site.x, z: site.z, r: town ? 72 : 34 });
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
      { const P0 = this.sites[0] && this.planOf(this.sites[0]); if (P0 && P0.dress) this.dress = P0.dress; }   // (u-worlds5, bgen 6: the town's ground)
      for (const l of this.landmarks) this.addOps(landmarkOps(l, this.W));
      if (T5) this.buildWays();
    }
    siteScore(x, z, town) {
      const g = this.gen, hs = [];
      let wet = 0, bad = 0;
      for (const [dx, dz] of (town ? TOWN_PTS : SITE_PTS)) {
        const h = g.surfaceY(x + dx, z + dz); hs.push(h);
        if (this.kind === 'aqua' && h < SEA + 1) wet++;
        if (this.baseOk && this.kind !== 'aqua' && !this.baseOk.has(g.biomeAt(x + dx, z + dz))) bad++;
      }
      hs.sort((a, b) => a - b);
      const med = hs[hs.length >> 1], range = hs[hs.length - 1] - hs[0];
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
    // ---------------------------------------------------------------- u-worlds4 · bgen 5: the ways between the villages
    // From the town's edge to the second village, from there to the third: 3 wide, a gentle meander, the species' road
    // block laid on the ground at decoration (a bridge of its planks or stone over water and lava), nothing planted on
    // them. this.ways [{from, to, a, b, n}], this.wayB: per chunk [x, z, state …]
    buildWays() {
      const kit = E.kit(this.kind, this.gen.bgen), road = st(kit.road5);
      this.bridge = st(kit.bridge5);
      this.ways = []; this.wayB = new Map();
      const seen = new Set();
      const S = this.sites;
      for (let i = 0; i + 1 < S.length; i++) {
        const A = S[i], B = S[i + 1], dx = B.x - A.x, dz = B.z - A.z, len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
        const a = [A.x + ux * (A.rad + 4), A.z + uz * (A.rad + 4)], b = [B.x - ux * (B.rad + 4), B.z - uz * (B.rad + 4)];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ph = h01(this.s, i, 0x77) * 6.28;
        let n = 0;
        for (let t = 0; t <= L; t += 0.5) {
          const m = 3 * Math.sin(t / 37 + ph) * Math.min(1, t / 30, (L - t) / 30);
          const cx = a[0] + ux * t - uz * m, cz = a[1] + uz * t + ux * m;
          for (let q = -1; q <= 1; q++) {
            const x = Math.round(cx - uz * q), z = Math.round(cz + ux * q), key = x * 65536 + z;
            if (seen.has(key)) continue; seen.add(key);
            if (this.nearSite(x, z)) continue;
            const ck = (x >> 4) + ',' + (z >> 4);
            let bk = this.wayB.get(ck); if (!bk) this.wayB.set(ck, bk = []);
            bk.push(x, z, road); n++;
          }
        }
        this.ways.push({ from: A.id, to: B.id, a, b, n, ux, uz, L });
      }
    }
    nearSite(x, z) { for (const m of this.marks) { const r = m.r > 30 ? m.r - 4 : m.r; if (Math.abs(m.x - x) < r && Math.abs(m.z - z) < r) return true; } return false; }
    wayCells(cx, cz) { return (this.wayB && this.wayB.get(cx + ',' + cz)) || []; }
    // a column on (or within pad of) a way: its distance from the way's line (the meander is at most 3)
    onWay(x, z, pad) {
      for (const w of this.ways) {
        const px = x - w.a[0], pz = z - w.a[1], t = px * w.ux + pz * w.uz;
        if (t < -pad || t > w.L + pad) continue;
        if (Math.abs(-px * w.uz + pz * w.ux) <= 4.5 + pad) return true;
      }
      return false;
    }
    // the ways' blocks in one chunk: on the ground's top (plants and snow over it cleared), a bridge over a liquid
    layWays(blocks, cx, cz) {
      const list = this.wayCells(cx, cz); if (!list.length) return;
      const R = VR.R;
      for (let i = 0; i < list.length; i += 3) {
        const c = ((list[i + 1] & 15) << 4) | (list[i] & 15);
        let y = 250, s = 0;
        while (y > 1) { s = blocks[(y << 8) | c]; if (s && ((R.T.flags[s] & VR.F.SOLID) || isFluid(s))) break; y--; }
        if (y <= 1) continue;
        blocks[(y << 8) | c] = isFluid(s) ? this.bridge : list[i + 2];
        for (let k = 1; k <= 3; k++) { const p = ((y + k) << 8) | c, q = blocks[p]; if (q && !(R.T.flags[q] & VR.F.SOLID)) blocks[p] = 0; }
      }
    }
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
      // ---- (u-worlds5, bgen 6) the town's ground: levelled, dressed, eased into the world
      if (this.dress) this.dressTown(blocks, x0, z0, tops);
      // ---- flora
      this.flora(blocks, x0, z0, tops, ebio);
      // ---- (u-worlds4, bgen 5) the ways between the villages
      if (this.wayB) this.layWays(blocks, cx, cz);
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
    // u-worlds5 · bgen 6: the town's square (Chebyshev ≤ r0 from the plaza) levelled to the floor F — the hills above it
    // cut, the hollows and lava filled with the species' fill, the floor in the species' two tones of ground with beds
    // of its plants in the gaps; Aquamarin's water a deck on posts (the pier quarter, a railing at its outer edge), the
    // buildings' boxes on foundations down to the ground or the sea bed. The ring r0…r1 eases the floor back into the
    // world. The structures' own blocks come later (the plan's ops) and win.
    inTown(x, z, pad) { const D = this.dress; return !!D && Math.max(Math.abs(x - D.x), Math.abs(z - D.z)) <= D.r1 + pad; }
    dressTown(blocks, x0, z0, tops) {
      const D = this.dress, X = D.x, Z = D.z, F = D.F, R = VR.R;
      if (x0 + 15 < X - D.r1 || x0 > X + D.r1 || z0 + 15 < Z - D.r1 || z0 > Z + D.r1) return;
      const inBox = (x, z) => { for (const b of D.boxes) if (x >= b[0] && x <= b[2] && z >= b[1] && z <= b[3]) return true; return false; };
      const nearBox = (x, z, p) => { for (const b of D.boxes) if (x >= b[0] - p && x <= b[2] + p && z >= b[1] - p && z <= b[3] + p) return true; return false; };
      // a smooth value noise (cells of 5, bilinear): the beds and the floor's second tone in soft shapes, not squares
      const vn = (x, z, salt, k) => { const fx = x / k, fz = z / k, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, a = h01(i, j, salt), b = h01(i + 1, j, salt), c2 = h01(i, j + 1, salt), d2 = h01(i + 1, j + 1, salt); return (a * (1 - u) + b * u) * (1 - v) + (c2 * (1 - u) + d2 * u) * v; };
      const sol = (s) => s && (R.T.flags[s] & VR.F.SOLID) && !(R.T.flags[s] & VR.F.FLUID);
      for (let c = 0; c < 256; c++) {
        const x = x0 + (c & 15), z = z0 + (c >> 4), d = Math.max(Math.abs(x - X), Math.abs(z - Z));
        if (d > D.r1) continue;
        let gy = 250; while (gy > 1 && !sol(blocks[(gy << 8) | c])) gy--;
        const wet = isFluid(blocks[((gy + 1) << 8) | c]), hi = Math.min(254, Math.max(gy, F) + 8);
        if (d <= D.r0) {
          const box = inBox(x, z);
          if (wet && D.pier && !box) {
            // the pier quarter: boardwalks three wide round the buildings and along the avenues' causeways (on posts every
            // four blocks, down to the sea bed), the lagoon open between them
            for (let y = F; y <= hi; y++) blocks[(y << 8) | c] = 0;
            if (nearBox(x, z, 3)) {
              blocks[(F << 8) | c] = D.deck;
              if (((x - X) & 3) === 0 && ((z - Z) & 3) === 0) for (let y = gy + 1; y < F; y++) blocks[(y << 8) | c] = D.post;
              if (!nearBox(x, z, 2)) blocks[((F + 1) << 8) | c] = D.rail;   // (the railing on the lagoon's side)
            }
            tops[c] = -1; continue;
          }
          for (let y = F + 1; y <= hi; y++) blocks[(y << 8) | c] = 0;
          for (let y = gy + 1; y < F; y++) blocks[(y << 8) | c] = D.fill;
          // the floor: two tones in blotches, beds of the species' plants in a quarter of the 4 × 4 cells
          const bed = !box && vn(x, z, this.s ^ 0x6b1, 5) > 0.66;
          blocks[(F << 8) | c] = bed ? D.bed : D.floor[vn(x, z, this.s ^ 0x6b2, 4) > 0.66 ? 1 : 0];
          const hp = h01(x, z, this.s ^ 0x6b3);
          if (!box && (bed ? hp < 0.55 : hp < 0.04)) blocks[((F + 1) << 8) | c] = D.plants[Math.floor(h01(x, z, this.s ^ 0x6b4) * D.plants.length)];
          tops[c] = -1;
        } else {
          // the ring: the floor eased back to the world's ground (smoothstep), the world's own top kept
          if (wet && D.pier) continue;
          const u = (d - D.r0) / (D.r1 - D.r0), sm = u * u * (3 - 2 * u), th = Math.round(F + (gy - F) * sm);
          if (th === gy) continue;
          const surf = blocks[(gy << 8) | c];
          for (let y = Math.min(th, gy) + 1; y <= hi; y++) blocks[(y << 8) | c] = 0;
          for (let y = gy; y < th; y++) blocks[(y << 8) | c] = D.fill;
          blocks[(th << 8) | c] = surf;
          tops[c] = th;
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
        if (this.near(x, z, 4) || (this.ways && this.onWay(x, z, 3)) || (this.dress && this.inTown(x, z, 3))) continue;
        const y0 = this.groundAt(x, z); if (y0 < 0) continue;
        // (inside the chunk the real ground decides: a pond, a crater's boulder — no plant there)
        if (x >= x0 && x < x0 + 16 && z >= z0 && z < z0 + 16) { const t = tops[(z - z0) * 16 + x - x0]; if (t < 0 || Math.abs(t - y0) > 1) continue; }
        plant(f, x, y0 + 1, z, h01(i, j, this.s ^ 0xf5), put);
      }
      // ---- (u-worlds2) the landing's garden: seven of the world's big plants on a ring 8–13 m round the landing, so
      // the first look shows the world's life whatever biome the landing lies in
      const L = this.land;
      const G5 = this.gen.bgen >= 5 && this.kind === 'aqua', NG = G5 ? 12 : 7;   // (u-worlds4, bgen 5: Aquamarin's landing garden fuller, on the beach too)
      if (big.length && Math.abs(L[0] - x0 - 8) < 32 && Math.abs(L[2] - z0 - 8) < 32) for (let k = 0; k < NG; k++) {
        const a = k / NG * Math.PI * 2 + h01(k, 3, this.s ^ 0xfa) * 0.5, r = 8 + h01(k, 4, this.s ^ 0xfa) * 5;
        const x = Math.round(L[0] + Math.cos(a) * r), z = Math.round(L[2] + Math.sin(a) * r);
        if (x < x0 - 4 || x > x0 + 19 || z < z0 - 4 || z > z0 + 19 || this.near(x, z, 2)) continue;
        // (none in the arrival's view of the first village: ±35° round its bearing stays open)
        const s0 = this.sites && this.sites[0];
        if (s0) { let da = Math.abs(Math.atan2(z - L[2], x - L[0]) - Math.atan2(s0.z - L[2], s0.x - L[0])); if (da > Math.PI) da = 2 * Math.PI - da; if (da < 0.61) continue; }
        let y0 = this.groundAt(x, z); if (y0 < 0 && G5) { const yy = g.surfaceY(x, z); if (yy >= SEA) y0 = yy; } if (y0 < 0) continue;
        if (x >= x0 && x < x0 + 16 && z >= z0 && z < z0 + 16) { const t = tops[(z - z0) * 16 + x - x0]; if (t < 0 || Math.abs(t - y0) > 1) continue; }
        plant(big[k % big.length], x, y0 + 1, z, h01(k, 5, this.s ^ 0xfa), put);
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
  // u-worlds2 · the species' monument in the middle of the plaza (5 × 5 at its foot, 13–20 high: it tells the village
  // from 100 m and more) — our own forms: the Wellari's spiral shell tower, the Dunelin's tapering sand tower with its
  // lantern, the Glutani's sulfur spire with a glowing amber crown, the Regoli's crater dome with its signal mast, the
  // Nivari's pointed ice vault with a rose crystal. E.CENTRE: the monuments' heights (test/worlds2.js)
  E.CENTRE = { aqua: 14, ocker: 18, zinn: 20, basalt: 13, opal: 15 };
  function centrepiece(kind, put, X, F, Z) {
    const S = (n, p) => st(n, p), H = E.CENTRE[kind] || 10;
    const ring = (y, r, f) => { for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) { const d = Math.hypot(dx, dz); if (d <= r) { const v = f(dx, dz, d); if (v) put(X + dx, F + y, Z + dz, v); } } };
    if (kind === 'aqua') {
      const wall = S('calcite'), band = S('cyan_terracotta'), cap = S('tube_coral_block');
      for (let y = 1; y <= H - 2; y++) { const r = 2.9 - y * 0.15, a0 = y * 0.7; ring(y, r, (dx, dz, d) => { if (d < r - 1.1) return 0; const a = Math.atan2(dz, dx); return Math.abs(((a - a0) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI) < 0.6 ? band : wall; }); }
      put(X, F + H - 1, Z, cap); put(X, F + H, Z, S('tide_lantern'));
    } else if (kind === 'ocker') {
      const wall = S('terracotta'), band = S('red_sandstone'), win = S('orange_stained_glass');
      for (let y = 1; y <= H - 3; y++) { const r = y < 7 ? 2 : y < 13 ? 1.5 : 1; for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { if (Math.max(Math.abs(dx), Math.abs(dz)) > Math.floor(r + 0.5) || (r === 1.5 && Math.abs(dx) === 2 && Math.abs(dz) === 2)) continue; const edge = Math.max(Math.abs(dx), Math.abs(dz)) === Math.floor(r + 0.5); put(X + dx, F + y, Z + dz, y % 4 === 0 ? band : edge && y % 4 === 2 && (dx === 0 || dz === 0) ? win : wall); } }
      put(X, F + H - 2, Z, band); put(X, F + H - 1, Z, S('lantern')); put(X, F + H, Z, S('amber_crystal_block'));
    } else if (kind === 'zinn') {
      const base = S('polished_basalt'), br = S('sulfur_bricks'), ps = S('polished_sulfur'), core = S('magma_block');
      for (let y = 1; y <= H - 3; y++) { const r = y <= 2 ? 2.6 : 2.2 * (1 - (y - 2) / (H - 2)) + 0.4; ring(y, r, (dx, dz, d) => (dx === 0 && dz === 0 && y > 2 && y % 3 === 0 ? core : y <= 2 ? base : (y + Math.round(Math.atan2(dz, dx) * 2)) % 3 === 0 ? ps : br)); }
      put(X, F + H - 2, Z, S('amber_crystal_block')); put(X, F + H - 1, Z, S('amber_crystal_block')); put(X, F + H, Z, S('spirit_lantern'));
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(X + dx, F + H - 2, Z + dz, S('amber_crystal_block'));
    } else if (kind === 'basalt') {
      const rim = S('smooth_basalt'), glass = S('light_blue_stained_glass'), mast = S('polished_andesite');
      for (let y = 1; y <= 4; y++) ring(y, 3.2, (dx, dz, d) => { if (y === 1) return d > 2.4 ? rim : 0; const R = Math.sqrt(Math.max(0, 9.6 - (y - 1) * (y - 1) * 1.1)); return d <= R && d > R - 1.1 ? glass : 0; });
      for (let y = 4; y <= H - 1; y++) put(X, F + y, Z, mast);
      put(X - 1, F + H - 3, Z, mast); put(X + 1, F + H - 3, Z, mast); put(X, F + H, Z, S('azure_crystal_block')); put(X, F + 2, Z, S('lantern'));
    } else {
      const ice = S('packed_ice'), blue = S('blue_ice'), snow = S('snow_block');
      // two pillars and a pointed vault between them (the way under it open), a rose crystal at the point
      for (let y = 1; y <= H - 2; y++) for (const sx of [-2, 2]) for (let dz = -1; dz <= 1; dz++) {
        const lean = Math.max(0, y - 6) / (H - 8) * 2; const x = Math.round(sx - Math.sign(sx) * lean);
        put(X + x, F + y, Z + dz, y % 4 === 1 ? snow : dz === 0 ? blue : ice);
      }
      for (let dz = -1; dz <= 1; dz++) { put(X, F + H - 2, Z + dz, blue); put(X, F + H - 1, Z + dz, ice); }
      put(X, F + H, Z, S('rose_crystal_block'));
    }
  }
  // u-worlds3 · bgen 4's plaza round the dance ring: benches on its four edges facing in (plaza.seats, the culture
  // moment's onlookers sit there), the monument's foot — a low step of the band's slab round it, the species' lights at
  // its corners, flowers on moss in the middle of each side —, lanterns on short posts (the species' fence or wall). The counts
  // on the plan (plaza.foot, plaza.lanterns) for test/worlds3.js.
  function plaza4(kind, Kit, put, P, X, F, Z) {
    const pz = P.plaza, seats = pz.seats = [], bench = st(Kit.bench4);
    // the benches: the four edges, two each side of the ways in (f: 0 −z, 1 +x, 2 +z, 3 −x — the way they face)
    for (const u of [-3, -2, 2, 3]) {
      for (const [x, z, f] of [[u, -6, 2], [u, 6, 0], [-6, u, 1], [6, u, 3]]) { put(X + x, F + 1, Z + z, bench); seats.push([X + x, F + 1, Z + z, f]); }
    }
    // the monument's foot (its ring of cells three out; Regoli's dome reaches there at its rim: left free)
    let foot = 0;
    const step = st(Kit.bench4), light = st(Kit.lamp4), moss = st('moss_block'), fl = st(Kit.flower4);
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== 3) continue;
      if (kind === 'basalt' && Math.hypot(dx, dz) <= 3.25) continue;
      const corner = Math.abs(dx) === 3 && Math.abs(dz) === 3, mid = dx === 0 || dz === 0;
      if (corner) put(X + dx, F + 1, Z + dz, light);
      else if (mid) { put(X + dx, F, Z + dz, moss); put(X + dx, F + 1, Z + dz, fl); }
      else put(X + dx, F + 1, Z + dz, step);
      foot++;
    }
    pz.foot = foot;
    // the lanterns on posts between the benches and the corners' lamps
    let n = 0;
    const post = st(Kit.post4);
    for (const [x, z] of [[-4, -6], [4, -6], [-4, 6], [4, 6], [-6, -4], [-6, 4], [6, -4], [6, 4]]) { put(X + x, F + 1, Z + z, post); put(X + x, F + 2, Z + z, light); P.lamps.push([X + x, F + 3, Z + z]); n++; }
    pz.lanterns = n;
  }
  const HOMES = [[-13, -14], [0, -15], [13, -14], [-13, 14], [0, 15], [13, 14]];
  function villagePlan(eco, site) {
    const g = eco.gen, Kit = E.kit(eco.kind, g.bgen), F = site.y | 0, X = site.x, Z = site.z, kind = eco.kind;   // (u-worlds4: bgen 5's kit — the darker tones)
    if (site.town) return townPlan(eco, site, Kit);
    const ground = (x, z) => g.surfaceY(x, z);
    const seed = strHash(site.id + ':' + (eco.s >>> 0)) >>> 0;
    const P = { id: site.id, name: site.name, style: 'sp:' + kind, kind, x: X, y: F + 1, z: Z, seed, rad: 30, homes: [], work: [], farms: [], lots: [], lamps: [], chimneys: [], plaza: { x: X, y: F + 1, z: Z, r: 6 }, roads: [], bell: null, pad: null, shops: [], pastures: [], orchards: [], windmills: [], base: null, ops: [], names: E.names(kind), species: kind };
    const W = writer(ground, F, Kit), put = W.put, v4 = g.bgen >= 4 && Kit.pave4, pav = v4 ? st(Kit.pave4[0]) : st(Kit.paving), mark = st(Kit.mark);   // (u-worlds3, bgen 4: the ways in the calm tone too)
    // the plaza: 13 × 13 paving, the species' mark stone in its middle (a pillar with its light), the ways to the homes
    // (u-worlds3, bgen 4: two calm tones — the dance ring's path in the second — instead of the loud band pattern)
    const pa = pav, pb = v4 ? st(Kit.pave4[1]) : pav;
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) { W.level(X + dx, Z + dz); const d = Math.hypot(dx, dz); put(X + dx, F, Z + dz, v4 ? (d >= 4.4 && d < 5.5 ? pb : pa) : (dx + dz) % 4 === 0 && Math.abs(dx) < 5 && Math.abs(dz) < 5 ? st(Kit.band) : pav); }
    centrepiece(kind, put, X, F, Z);   // (u-worlds2: the species' own monument in the plaza's middle, seen from 100 m)
    if (v4) plaza4(kind, Kit, put, P, X, F, Z);
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

  // ================================================================ u-worlds4 · bgen 5: the first site is a town
  // The plaza and its monument in the middle (as the villages: plaza4), four avenues out to ±56, 18 homes along them
  // (their doors to the avenue or toward the plaza, a short way from each door), the hall west of the plaza (benches
  // facing the speaker's stone, an open entrance toward the plaza), the market east (four stalls of the species' goods),
  // the landmark at the north avenue's end, a garden at the south end, lamps along the avenues. All ours, all procedural.
  // ([dx, dz, door side] — the door side +1: +z)
  const TOWN_HOMES = [[-10, -18, 1], [10, -18, 1], [-10, -32, 1], [10, -32, 1], [-10, -46, 1], [10, -46, 1],
    [-10, 18, -1], [10, 18, -1], [-10, 32, -1], [10, 32, -1], [-10, 46, -1], [10, 46, -1],
    [34, -10, 1], [34, 10, -1], [48, -10, 1], [48, 10, -1], [-40, -10, 1], [-40, 10, -1], [-54, -10, 1], [-54, 10, -1]];
  E.TOWN_HOMES = TOWN_HOMES;
  E.LANDMARK5 = { aqua: 'lighthouse', ocker: 'windcatcher', zinn: 'obelisk', basalt: 'observatory', opal: 'frostspire' };
  function townPlan(eco, site, Kit) {
    const g = eco.gen, F = site.y | 0, X = site.x, Z = site.z, kind = eco.kind;
    const GM = new Map(), ground = (x, z) => { const k = x * 65536 + z; let v = GM.get(k); if (v === undefined) GM.set(k, v = g.surfaceY(x, z)); return v; };   // (each column asked once)
    const seed = strHash(site.id + ':' + (eco.s >>> 0)) >>> 0;
    const P = { id: site.id, name: site.name, style: 'sp:' + kind, kind, town: true, x: X, y: F + 1, z: Z, seed, rad: 64, homes: [], work: [], farms: [], lots: [], lamps: [], chimneys: [], plaza: { x: X, y: F + 1, z: Z, r: 6 }, roads: [], bell: null, pad: null, shops: [], pastures: [], orchards: [], windmills: [], base: null, ops: [], names: E.names(kind), species: kind };
    const W = writer(ground, F, Kit), put = W.put, pa = st(Kit.pave4[0]), pb = st(Kit.pave4[1]);
    const v6 = g.bgen >= 6, paved = v6 ? new Set() : null;   // (u-worlds5, bgen 6: the paved cells, for the aprons)
    const pave = (x, z, s) => { W.level(x, z); put(x, F, z, s); if (paved) paved.add(x * 65536 + z); };
    // the plaza (13 × 13, the dance ring in the second tone), the monument, the benches, the monument's foot, the lanterns
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) { const d = Math.hypot(dx, dz); pave(X + dx, Z + dz, d >= 4.4 && d < 5.5 ? pb : pa); }
    centrepiece(kind, put, X, F, Z);
    plaza4(kind, Kit, put, P, X, F, Z);
    // the avenues: 3 wide, their edges in the second tone; lamps on posts every 12 blocks, two blocks off the way
    const post = st(Kit.post4), light = st(Kit.lamp4);
    const AV = [[0, -1, 7, 56], [0, 1, 7, 56], [1, 0, 7, 56], [-1, 0, 32, 60]];   // (west: behind the hall)
    for (const [ux, uz, k0, len] of AV) {
      for (let k = k0; k <= len; k++) for (let t = -1; t <= 1; t++) { const x = X + ux * k + (uz ? t : 0), z = Z + uz * k + (ux ? t : 0); pave(x, z, t === 0 ? pa : pb); }
      for (let k = k0 + 5; k <= len; k += 12) for (const sd of [-1, 1]) { const x = X + ux * k + uz * 2 * sd, z = Z + uz * k + ux * 2 * sd; if (Math.abs(k - 18) < 3 || Math.abs(k - 32) < 3 || Math.abs(k - 46) < 3) continue; put(x, F + 1, z, post); put(x, F + 2, z, light); P.lamps.push([x, F + 3, z]); }
    }
    // the homes and the ways from their doors to the avenue
    const homeOps = [];
    TOWN_HOMES.forEach(([dx, dz, s], i) => {
      const cx = X + dx, cz = Z + dz;
      const h = house(Kit, ground, F, cx, cz, s, h01(seed, i, 5));
      const o = h.outside;
      if (Math.abs(dx) <= 12) { const step = Math.sign(X - cx); for (let x = o[0]; Math.abs(x - X) > 1; x += step) pave(x, o[2], pa); }
      else { const step = Math.sign(Z - cz); for (let z = o[2]; Math.abs(z - Z) > 1; z += step) pave(o[0], z, pa); }
      P.homes.push(h); for (const q of h.ops) homeOps.push(q); delete h.ops;
    });
    // (u-worlds5, bgen 6) an apron of the second tone round every home (the ring one outside its box; the ways stay)
    if (v6) for (const h of P.homes) { const b = h.box; for (let x = b[0] - 1; x <= b[3] + 1; x++) for (let z = b[2] - 1; z <= b[5] + 1; z++) if ((x < b[0] || x > b[3] || z < b[2] || z > b[5]) && !paved.has(x * 65536 + z)) pave(x, z, pb); }
    // the hall (west): 19 × 13, walls five high, the band under the roof, windows, an open entrance toward the plaza
    const hall = hallOps(Kit, ground, F, X - 22, Z, kind);
    for (const q of hall.ops) homeOps.push(q);
    P.hall = { box: hall.box, door: hall.door, inside: hall.inside, seats: hall.seats, speaker: hall.speaker };
    P.work.push({ kind: 'hall', spot: hall.speaker.slice(), inside: hall.speaker.slice(), seats: hall.seats });
    P.lights = (P.lights || []).concat(hall.lights);
    // the market (east): a square of the second tone, four stalls with the species' goods
    const mk = marketOps(eco, Kit, ground, F, X + 20, Z);
    for (const q of mk.ops) homeOps.push(q);
    P.market = { box: mk.box, spots: mk.spots, x: X + 20, y: F + 1, z: Z };
    for (const w of mk.work) P.work.push(w);
    // the garden (south end): beds of the world's crops, a keeper
    const gx = X, gz = Z + 60;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -4; dz <= 4; dz++) { pave(gx + dx, gz + dz, Math.abs(dx) === 1 || Math.abs(dx) === 3 ? st('moss_block') : pa); if (Math.abs(dx) === 1 || Math.abs(dx) === 3) put(gx + dx, F + 1, gz + dz, st('vm_crop_rows')); }
    P.work.push({ kind: 'garden', spot: [gx, F + 1, gz] });
    // the landmark (north end): the species' own, seen from the landing and from the other villages' ways
    const lm = landmark5(kind, Kit, ground, F, X, Z - 64, v6);
    for (const q of lm.ops) homeOps.push(q);
    P.landmark = { kind, shape: E.LANDMARK5[kind], h: lm.h, x: X, y: F + 1, z: Z - 64, box: lm.box };
    if (lm.climb) P.landmark.climb = lm.climb;   // (u-worlds5, bgen 6: the ladder, the deck)
    // (u-worlds5, bgen 6) the town's ground, laid at decoration (Eco.dressTown): the boxes the buildings stand in (their
    // foundations reach the ground or the sea bed), the floor's tones, the beds and their plants, the pier's parts
    if (v6) {
      const boxes = P.homes.map(h => [h.box[0], h.box[2], h.box[3], h.box[5]]);
      for (const b of [P.hall.box, P.market.box, lm.box]) boxes.push([b[0], b[2], b[3], b[5]]);
      boxes.push([X - 7, Z - 7, X + 7, Z + 7], [gx - 4, gz - 5, gx + 4, gz + 5]);
      for (const [ux, uz, k0, len] of AV) boxes.push(ux ? [Math.min(X + ux * k0, X + ux * len), Z - 2, Math.max(X + ux * k0, X + ux * len), Z + 2] : [X - 2, Math.min(Z + uz * k0, Z + uz * len), X + 2, Math.max(Z + uz * k0, Z + uz * len)]);
      P.dress = { x: X, z: Z, F, r0: 72, r1: 84, boxes, floor: Kit.floor6.map(n => st(n)), bed: st(Kit.bed6), plants: Kit.plants6.map(n => st(n)), fill: st(Kit.fill), pier: !!Kit.deck6, deck: Kit.deck6 ? st(Kit.deck6) : -1, post: Kit.postp6 ? st(Kit.postp6) : 0, rail: Kit.rail6 ? st(Kit.rail6) : 0 };
    }
    for (const o of W.ops) P.ops.push(o);
    for (const o of homeOps) P.ops.push(o);
    return P;
  }
  // the hall: its long side along x, the entrance on the east end (+x, toward the plaza), the speaker's stone at the west
  function hallOps(Kit, ground, F, cx, cz, kind) {
    const W = writer(ground, F, Kit), put = W.put, S = (n, p) => st(n, p);
    const wall = S(Kit.wall), band = S(Kit.band), roof = S(Kit.roof), win = S(Kit.window), floor = S(Kit.floor), bench = S(Kit.bench4), mark = S(Kit.mark);
    const RX = 9, RZ = 6, H = 5;
    for (let dx = -RX; dx <= RX; dx++) for (let dz = -RZ; dz <= RZ; dz++) { W.level(cx + dx, cz + dz); put(cx + dx, F, cz + dz, floor); }
    for (let dx = -RX; dx <= RX; dx++) for (let dz = -RZ; dz <= RZ; dz++) for (let dy = 1; dy <= H; dy++) {
      const ax = Math.abs(dx), az = Math.abs(dz), edge = ax === RX || az === RZ;
      if (!edge) continue;
      if (dx === RX && az <= 1 && dy <= 3) { put(cx + dx, F + dy, cz + dz, 0); continue; }   // (the open entrance)
      const corner = ax === RX && az === RZ;
      put(cx + dx, F + dy, cz + dz, dy === H ? band : !corner && dy >= 2 && dy <= 3 && ((az === RZ && (dx + 30) % 3 === 0) || (ax === RX && dx < 0 && az % 3 === 0 && az > 0)) ? win : wall);
    }
    // the roof: a flat roof with a parapet (earth, basalt and ice), a stepped one for the round shells and the domes
    const stepped = Kit.shape === 'round' || Kit.shape === 'dome';
    for (let i = 0; i < (stepped ? 4 : 1); i++) for (let dx = -RX + i; dx <= RX - i; dx++) for (let dz = -RZ + i; dz <= RZ - i; dz++) put(cx + dx, F + H + 1 + i, cz + dz, roof);
    if (!stepped) for (let dx = -RX; dx <= RX; dx++) for (let dz = -RZ; dz <= RZ; dz++) if ((Math.abs(dx) === RX || Math.abs(dz) === RZ) && ((dx + dz) & 1) === 0) put(cx + dx, F + H + 2, cz + dz, band);
    // inside: four rows of benches each side of the aisle facing the speaker (west, f 3 −x), the speaker's stone, lights
    const seats = [];
    for (const bx of [-3, 0, 3, 6]) for (const bz of [-4, -3, -2, 2, 3, 4]) { put(cx + bx, F + 1, cz + bz, bench); seats.push([cx + bx, F + 1, cz + bz, 3]); }
    const sp = [cx - RX + 2, F + 1, cz];
    put(sp[0] - 1, F + 1, sp[2], mark); put(sp[0] - 1, F + 2, sp[2], S(Kit.light));
    const lights = [];
    for (const lx of [-6, -1, 4]) { put(cx + lx, F + H - 0, cz, S('light_panel', { facing: 5 })); lights.push([cx + lx, F + H, cz]); }
    // the sign of the hall over its entrance: the species' mark and a light each side
    put(cx + RX, F + 4, cz, mark); put(cx + RX + 1, F + 1, cz - 2, S(Kit.light)); put(cx + RX + 1, F + 1, cz + 2, S(Kit.light));
    void kind;
    return { ops: W.ops, box: [cx - RX, F, cz - RZ, cx + RX + 1, F + 10, cz + RZ], door: [cx + RX, F + 1, cz], inside: [cx, F + 1, cz], seats, speaker: sp, lights };
  }
  // the market: a square 16 × 17 of the second tone, four stalls (posts, a counter toward the lane, a striped canopy)
  function marketOps(eco, Kit, ground, F, cx, cz) {
    const W = writer(ground, F, Kit), put = W.put, S = (n, p) => st(n, p);
    const pa = S(Kit.pave4[0]), pb = S(Kit.pave4[1]);
    for (let dx = -8; dx <= 7; dx++) for (let dz = -8; dz <= 8; dz++) { W.level(cx + dx, cz + dz); put(cx + dx, F, cz + dz, Math.abs(dz) <= 1 ? pa : ((dx + dz) & 3) === 0 ? pa : pb); }
    const goods = eco.W.species.goods.filter(n => VR.R.byName[n]);
    const spots = [], work = [];
    let gi = 0;
    for (const [sx, sz] of [[-4, -5], [3, -5], [-4, 5], [3, 5]]) {
      const x0 = cx + sx, z0 = cz + sz, fz = Math.sign(sz);   // (fz: the stall's back side; the lane at z = cz)
      for (const [dx, dz] of [[-2, -1], [2, -1], [-2, 1], [2, 1]]) for (let k = 1; k <= 3; k++) put(x0 + dx, F + k, z0 + dz, S(Kit.wall));
      for (let dx = -2; dx <= 2; dx++) for (let dz = -1; dz <= 1; dz++) put(x0 + dx, F + 4, z0 + dz, (dx & 1) ? S(Kit.canopy) : S('white_wool'));
      for (let dx = -1; dx <= 1; dx++) put(x0 + dx, F + 1, z0 - fz, S(Kit.band));
      for (let k = 0; k < 3; k++) { const gname = goods[(gi++) % goods.length]; if (gname) put(x0 - 1 + k, F + 2, z0 - fz, S(gname)); }
      const cust = [x0, F + 1, z0 - 2 * fz];
      spots.push(cust);
      work.push({ kind: 'stall', spot: cust.slice(), keeper: [x0 + 0.5, F + 1, z0 + fz * 0 + 0.5] });
    }
    // a lamp at the square's four corners
    for (const [dx, dz] of [[-8, -8], [7, -8], [-8, 8], [7, 8]]) { put(cx + dx, F + 1, cz + dz, S(Kit.post4)); put(cx + dx, F + 2, cz + dz, S(Kit.lamp4)); }
    return { ops: W.ops, box: [cx - 8, F, cz - 8, cx + 7, F + 9, cz + 8], spots, work };
  }
  // the landmarks: the species' own forms, 22–28 high
  function landmark5(kind, Kit, ground, F, X, Z, v6) {
    const W = writer(ground, F, Kit), put = W.put, S = (n, p) => st(n, p);
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) if (Math.hypot(dx, dz) <= 6.5) { W.level(X + dx, Z + dz); put(X + dx, F, Z + dz, S(Kit.pave4[(Math.hypot(dx, dz) > 5) ? 1 : 0])); }
    const disc = (y, r, f) => { const R = Math.ceil(r); for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) { const d = Math.hypot(dx, dz); if (d <= r) { const v = f(dx, dz, d); if (v !== undefined) put(X + dx, F + y, Z + dz, v); } } };
    let h = 22;
    if (kind === 'aqua') {
      // the lighthouse: a round tower of calcite with a cyan band winding up, a glass lantern room, the tide lantern
      const wall = S('calcite'), band = S('cyan_terracotta'), glass = S('light_blue_stained_glass'); h = 24;
      for (let y = 1; y <= 19; y++) { const r = 3.4 - y * 0.06; disc(y, r, (dx, dz, d) => { if (d < r - 1.2) return 0; const a = Math.atan2(dz, dx); return (Math.round((a / (Math.PI * 2)) * 12 + y * 0.8) % 6 === 0) ? band : (y % 6 === 3 && (dx === 0 || dz === 0) ? glass : wall); }); }
      disc(20, 3.2, () => S('smooth_sandstone_slab'));
      for (let y = 21; y <= 22; y++) disc(y, 2.2, (dx, dz, d) => (d > 1.2 ? glass : y === 21 ? S('tide_lantern') : 0));
      disc(23, 2.2, () => S('dried_kelp_block')); put(X, F + 24, Z, S('tube_coral_block'));
    } else if (kind === 'ocker') {
      // the windcatcher: a square tower of terracotta in bands of red sandstone, open vents at the top, a lantern, amber
      const wall = S('terracotta'), band = S('red_sandstone'), glass = S('orange_stained_glass'); h = 25;
      for (let y = 1; y <= 22; y++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2, corner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
        if (!edge) { put(X + dx, F + y, Z + dz, 0); continue; }
        if (y >= 18 && y <= 20 && !corner) { put(X + dx, F + y, Z + dz, 0); continue; }   // (the vents)
        put(X + dx, F + y, Z + dz, y % 5 === 0 || y === 21 ? band : (y % 5 === 2 && !corner && (dx === 0 || dz === 0)) ? glass : wall);
      }
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) put(X + dx, F + 23, Z + dz, Math.abs(dx) === 3 || Math.abs(dz) === 3 ? band : S('smooth_red_sandstone'));
      put(X, F + 19, Z, S('lantern')); put(X, F + 24, Z, S('lantern')); put(X, F + 25, Z, S('amber_crystal_block'));
    } else if (kind === 'zinn') {
      // the obelisk: polished basalt tapering from 5 to 1, seams of magma up its faces, an amber crown, the spirit lantern
      const b = S('polished_basalt'), seam = S('magma_block'), amb = S('amber_crystal_block'); h = 27;
      for (let y = 1; y <= 24; y++) { const r = y < 3 ? 3 : Math.max(0, Math.round(2.4 * (1 - (y - 3) / 23) + 0.2)); for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) put(X + dx, F + y, Z + dz, (dx === 0 || dz === 0) && (Math.abs(dx) === r || Math.abs(dz) === r) && y > 3 && y % 4 !== 0 ? seam : b); }
      put(X, F + 25, Z, amb); put(X, F + 26, Z, amb); put(X, F + 27, Z, S('spirit_lantern'));
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) put(X + dx, F + 25, Z + dz, amb);
    } else if (kind === 'basalt') {
      // the observatory: a tower of polished andesite, a glass dome on a basalt ring, the azure crystal lens toward the sky
      const wall = S('polished_andesite'), rim = S('smooth_basalt'), glass = S('light_blue_stained_glass'), lens = S('azure_crystal_block'); h = 23;
      for (let y = 1; y <= 14; y++) disc(y, 2.6, (dx, dz, d) => (d > 1.5 ? (y % 5 === 0 ? rim : y % 5 === 3 && (dx === 0 || dz === 0) ? glass : wall) : 0));
      disc(15, 4.6, () => rim);
      for (let y = 16; y <= 20; y++) { const R = Math.sqrt(Math.max(0, 4.6 * 4.6 - (y - 15) * (y - 15))); disc(y, R, (dx, dz, d) => (d > R - 1.1 ? glass : 0)); }
      for (let k = 0; k < 5; k++) put(X + 1 + (k >> 1), F + 17 + k, Z, lens);
      put(X, F + 16, Z, S('lantern')); put(X, F + 21, Z, S('polished_andesite')); put(X, F + 22, Z, S('polished_andesite')); put(X, F + 23, Z, lens);
    } else {
      // the frost spire: packed ice tapering round, blue ice winding up it, the rose crystal at the point, chimes of crystal
      const ice = S('packed_ice'), blue = S('blue_ice'), snow = S('snow_block'), rose = S('rose_crystal_block'); h = 26;
      for (let y = 1; y <= 24; y++) { const r = 3.2 * Math.pow(1 - y / 26, 0.8) + 0.3; disc(y, r, (dx, dz, d) => { if (y > 3 && d < r - 1.2) return 0; const a = Math.atan2(dz, dx); return y % 7 === 1 ? snow : (Math.round(a / (Math.PI * 2) * 8 + y * 0.5) % 4 === 0 ? blue : ice); }); }
      put(X, F + 25, Z, rose); put(X, F + 26, Z, rose);
      for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) { put(X + dx, F + 14, Z + dz, S('lantern')); }
    }
    // four lamps round its foot
    for (const [dx, dz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) { put(X + dx, F + 1, Z + dz, S(Kit.post4)); put(X + dx, F + 2, Z + dz, S(Kit.lamp4)); }
    const climb = v6 ? climbOps(kind, put, disc, S, F, X, Z) : null;
    return { ops: W.ops, h, box: [X - 6, F, Z - 6, X + 6, F + h, Z + 6], climb };
  }
  // u-worlds5 · bgen 6: every landmark climbable — an entrance on the town's side (+z), a ladder up a shaft in its middle
  // (on a pillar's south face), a deck to stand on with a parapet: the lighthouse's and the windcatcher's roofs, the
  // observatory's ring under its glass dome, a gallery round the obelisk and round the frost spire. Written after the
  // landmark's own blocks (the later op wins). {x, z, y0, y1 (the ladder), deck (where one stands), door}
  const CLIMB6 = { aqua: [23, 'top', 'calcite'], ocker: [23, 'top', 'terracotta'], zinn: [18, 'collar', 'polished_basalt'], basalt: [15, 'dome', 'polished_andesite'], opal: [14, 'collar', 'packed_ice'] };
  function climbOps(kind, put, disc, S, F, X, Z) {
    const [yd, how, pil] = CLIMB6[kind], lad = S('ladder', { facing: 2 }), pillar = S(pil), DOOR = 4;
    for (let y = 1; y <= yd; y++) { put(X, F + y, Z, lad); put(X, F + y, Z - 1, pillar); }
    for (let y = 1; y <= 2; y++) for (let k = 1; k <= DOOR; k++) put(X, F + y, Z + k, 0);   // (the entrance from the town)
    put(X, F + yd + 1, Z, 0); put(X, F + yd + 2, Z, 0);
    if (kind === 'aqua') {
      // the lighthouse's roof: the crown's coral gone, a railing round the rim
      disc(yd + 1, 2.2, (dx, dz, d) => (d > 1.5 ? S('bamboo_fence') : 0));
      for (const [dx, dz] of [[2, 0], [-2, 0], [0, -2]]) put(X + dx, F + yd + 2, Z + dz, S('tide_lantern'));
    } else if (kind === 'ocker') {
      // the windcatcher's roof: a railing on its rim, amber and a lantern on the four corners
      for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
        const rim = Math.abs(dx) === 3 || Math.abs(dz) === 3, corner = Math.abs(dx) === 3 && Math.abs(dz) === 3;
        put(X + dx, F + yd + 1, Z + dz, corner ? S('amber_crystal_block') : rim ? S('acacia_fence') : 0);
        if (corner) put(X + dx, F + yd + 2, Z + dz, S('lantern'));
      }
      put(X, F + yd + 2, Z, 0);
    } else if (kind === 'basalt') {
      put(X, F + yd + 1, Z, 0);   // (the lantern under the dome steps aside)
      put(X - 2, F + yd + 1, Z - 2, S('lantern'));
      for (let dx = -1; dx <= 1; dx++) for (let dz = 3; dz <= 5; dz++) for (let y = 1; y <= 2; y++) put(X + dx, F + yd + y, Z + dz, 0);   // (a window open toward the town)
    } else {
      // a gallery round the shaft's top: the obelisk's square collar of basalt, the spire's round one of snow, a parapet
      const R = kind === 'zinn' ? 3 : 4;
      for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
        const d = kind === 'zinn' ? Math.max(Math.abs(dx), Math.abs(dz)) : Math.hypot(dx, dz);
        if (d > R + 0.01 || (dx === 0 && dz === 0)) continue;
        put(X + dx, F + yd, Z + dz, kind === 'zinn' ? S('polished_basalt') : S('snow_block'));
        if (d > R - 0.8) put(X + dx, F + yd + 1, Z + dz, kind === 'zinn' ? S('polished_deepstone_wall') : S('spruce_fence'));
      }
      for (const [dx, dz] of [[R, 0], [-R, 0], [0, -R]]) put(X + dx, F + yd + 2, Z + dz, kind === 'zinn' ? S('spirit_lantern') : S('lantern'));
      for (let y = yd + 1; y <= yd + 2; y++) for (let k = 0; k <= 2; k++) put(X, F + y, Z + k, 0);   // (the way out of the shaft)
    }
    return { x: X, z: Z, y0: F + 1, y1: F + yd, deck: F + yd + 1, door: DOOR, how };
  }

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
