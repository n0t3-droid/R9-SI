// ============================================================================
// 💡 Erfinderwerkstatt — the data and the rules (no DOM). A child puts two picture cards together and invents
// something: six start cards (Holz, Stein, Feuer, Wasser, Erde, Luft), 167 inventions, each one an existing block,
// item or Modern Living (VM) model of the game — no new ids. Every pair of two start cards gives something, so the
// first minute is all wins; the rest climbs from materials over tools and the modern home to a Sternenkern.
//   an invention: { k, id, a: [cardA, cardB], alts: [[…]…], cat }   (k = the card's key; id = its picture and item)
// The words are the tables' (lang_de.js / lang_en.js): erf.i.<k> = [name, one friendly line].
// Progress is per profile, not per world: localStorage 'r9si.inventions' = { v: 1, found: { key: time, … } }.
// VR.Inventions: card · idOf · has · known · cards · found · count · find · pairOf · combine · tip · text · reset · on ·
//   sync · reward · grant · recipeFor · depth
// ============================================================================
(function (VR) {
  'use strict';
  const KEY = 'r9si.inventions';
  const Inv = VR.Inventions = { KEY };

  // the cards you start with; the pictures are blocks and one item (Luft is a feather: light as air)
  Inv.STARTERS = [
    { k: 'holz', id: 'oak_log' }, { k: 'stein', id: 'cobblestone' }, { k: 'feuer', id: 'fire' },
    { k: 'wasser', id: 'water' }, { k: 'erde', id: 'dirt' }, { k: 'luft', id: 'feather' },
  ];
  // the chapters of the book: key, a picture
  Inv.CATS = [
    { k: 'anfang', icon: '🌱' }, { k: 'stoffe', icon: '🧱' }, { k: 'natur', icon: '🍎' }, { k: 'werkzeug', icon: '🔧' },
    { k: 'haus', icon: '🏠' }, { k: 'kueche', icon: '🍳' }, { k: 'technik', icon: '⚡' }, { k: 'weltall', icon: '🚀' },
  ];

  // key · picture id · the main pair · chapter · [alternative pairs, comma separated]
  // The order is the order a child tends to find them in (💡 Tipp walks it top down).
  const TABLE = [
    // ---- Anfang: the 21 pairs of the start cards, then the first steps from them
    ['bretter', 'oak_planks', 'holz holz', 'anfang', 'holz steinaxt'],
    ['steinaxt', 'stone_axe', 'holz stein', 'anfang'],
    ['fackel', 'torch', 'holz feuer', 'anfang', 'stock feuer'],
    ['papier', 'paper', 'holz wasser', 'anfang', 'bretter wasser'],
    ['pflanze', 'oak_sapling', 'holz erde', 'anfang'],
    ['notenblock', 'note_block', 'holz luft', 'anfang'],
    ['kies', 'gravel', 'stein stein', 'anfang'],
    ['ofen', 'furnace', 'stein feuer', 'anfang', 'kies feuer'],
    ['moosstein', 'mossy_cobblestone', 'stein wasser', 'anfang'],
    ['eisenerz', 'iron_ore', 'stein erde', 'anfang'],
    ['sand', 'sand', 'stein luft', 'anfang', 'kies kies'],
    ['lagerfeuer', 'campfire', 'feuer feuer', 'anfang', 'holz fackel'],
    ['kessel', 'cauldron', 'feuer wasser', 'anfang', 'eimer feuer'],
    ['terrakotta', 'terracotta', 'feuer erde', 'anfang'],
    ['feuerzeug', 'flint_and_steel', 'feuer luft', 'anfang'],
    ['fisch', 'raw_cod', 'wasser wasser', 'anfang'],
    ['schlamm', 'mud', 'wasser erde', 'anfang', 'erde wolke'],
    ['wolke', 'white_wool', 'wasser luft', 'anfang', 'wasser lagerfeuer'],
    ['acker', 'farmland', 'erde erde', 'anfang'],
    ['gras', 'grass_block', 'erde luft', 'anfang'],
    ['pusteblume', 'dandelion', 'luft luft', 'anfang'],
    ['stock', 'stick', 'bretter bretter', 'anfang', 'bretter steinaxt'],
    ['kohle', 'charcoal', 'fackel wasser', 'anfang', 'holz ofen'],
    ['glas', 'glass', 'sand ofen', 'anfang', 'sand lagerfeuer'],
    ['ziegel', 'brick', 'schlamm feuer', 'anfang', 'ton feuer,ton ofen'],
    ['eisen', 'iron_ingot', 'eisenerz ofen', 'anfang', 'eisenerz feuer'],
    ['bratfisch', 'cooked_cod', 'fisch feuer', 'anfang', 'fisch ofen,fisch lagerfeuer'],
    ['laub', 'oak_leaves', 'pflanze wasser', 'anfang'],
    ['schnee', 'snow_block', 'wolke wolke', 'anfang'],
    ['eis', 'ice', 'schnee wasser', 'anfang'],
    // ---- Stoffe: what things are made of
    ['lava', 'lava', 'stein ofen', 'stoffe', 'kies ofen'],
    ['obsidian', 'obsidian', 'lava wasser', 'stoffe'],
    ['sandstein', 'sandstone', 'sand sand', 'stoffe'],
    ['ton', 'clay', 'schlamm sand', 'stoffe'],
    ['metall', 'iron_block', 'eisen eisen', 'stoffe'],
    ['kupfer', 'copper_ingot', 'eisen terrakotta', 'stoffe'],
    ['licht', 'sunstone', 'glas feuer', 'stoffe', 'glas lagerfeuer'],
    ['gold', 'gold_ingot', 'eisen licht', 'stoffe', 'kupfer licht'],
    ['diamant', 'diamond', 'kohle lava', 'stoffe', 'kohle obsidian'],
    ['smaragd', 'emerald', 'diamant gras', 'stoffe'],
    ['quarz', 'quartz', 'stein sand', 'stoffe'],
    ['amethyst', 'amethyst_shard', 'quarz wasser', 'stoffe'],
    ['kristall', 'crystal_shard_azure', 'amethyst amethyst', 'stoffe', 'quarz quarz'],
    ['rosenkristall', 'crystal_shard_rose', 'kristall blume', 'stoffe'],
    ['bernstein', 'crystal_shard_amber', 'kristall honig', 'stoffe'],
    ['buntglas', 'red_stained_glass', 'glas kristall', 'stoffe'],
    ['faden', 'string', 'wolke stock', 'stoffe'],
    ['stoff', 'white_carpet', 'faden faden', 'stoffe'],
    ['buch', 'book', 'papier papier', 'stoffe'],
    ['honig', 'honey_bottle', 'blume glas', 'stoffe'],
    // ---- Natur & Essen: plants, food, and six creatures
    ['blume', 'poppy', 'gras wasser', 'natur'],
    ['sonnenblume', 'sunflower', 'blume licht', 'natur'],
    ['weizen', 'wheat', 'acker wasser', 'natur'],
    ['brot', 'bread', 'weizen ofen', 'natur', 'weizen feuer'],
    ['karotte', 'carrot', 'acker feuer', 'natur'],
    ['kartoffel', 'potato', 'acker erde', 'natur'],
    ['ofenkartoffel', 'baked_potato', 'kartoffel ofen', 'natur', 'kartoffel feuer'],
    ['kuerbis', 'pumpkin', 'acker licht', 'natur'],
    ['apfel', 'apple', 'laub laub', 'natur'],
    ['goldapfel', 'golden_apple', 'apfel gold', 'natur'],
    ['beeren', 'sweet_berries', 'laub blume', 'natur'],
    ['suppe', 'mushroom_stew', 'kessel kartoffel', 'natur'],
    ['kuerbiskuchen', 'pumpkin_pie', 'kuerbis brot', 'natur'],
    ['keks', 'cookie', 'brot honig', 'natur'],
    ['schaf', 'egg_bloom_sheep', 'wolke blume', 'natur'],
    ['moosschwein', 'egg_moss_boar', 'moosstein schlamm', 'natur'],
    ['glimmerhirsch', 'egg_glimmer_deer', 'laub licht', 'natur'],
    ['kristallkrabbe', 'egg_crystal_crab', 'kristall sand', 'natur'],
    ['himmelsrochen', 'egg_sky_ray', 'fisch wolke', 'natur'],
    ['splitterwisp', 'egg_shard_wisp', 'kristall luft', 'natur'],
    // ---- Werkzeug: things for the hand
    ['spitzhacke', 'iron_pickaxe', 'eisen stock', 'werkzeug'],
    ['axt', 'iron_axe', 'eisen steinaxt', 'werkzeug'],
    ['schere', 'shears', 'eisen papier', 'werkzeug'],
    ['eimer', 'bucket', 'eisen wasser', 'werkzeug'],
    ['kompass', 'compass', 'eisen luft', 'werkzeug', 'eisen kristall'],
    ['uhr', 'clock', 'kompass gold', 'werkzeug', 'kompass licht'],
    ['fernrohr', 'spyglass', 'glas kupfer', 'werkzeug'],
    ['bogen', 'bow', 'stock faden', 'werkzeug'],
    ['leiter', 'ladder', 'stock stock', 'werkzeug'],
    ['zaun', 'oak_fence', 'holz stock', 'werkzeug'],
    ['tuer', 'oak_door', 'bretter holz', 'werkzeug'],
    ['truhe', 'chest', 'bretter eisen', 'werkzeug'],
    ['schiene', 'rail', 'metall bretter', 'werkzeug'],
    ['hebel', 'lever', 'stock stein', 'werkzeug'],
    ['laterne', 'lantern', 'licht glas', 'werkzeug'],
    ['baustab', 'builder_wand', 'kristall stock', 'werkzeug'],
    ['werkbank', 'crafting_table', 'tisch steinaxt', 'werkzeug'],
    // ---- Zuhause: furniture and the living room (Modern Living)
    ['hocker', 'vm_stool', 'bretter stock', 'haus'],
    ['tisch', 'vm_dining_table_oak', 'hocker bretter', 'haus'],
    ['stuhl', 'vm_dining_chair_oak', 'hocker stock', 'haus'],
    ['bank', 'vm_bench', 'hocker hocker', 'haus'],
    ['sofa', 'vm_sofa_cream', 'bank stoff', 'haus', 'bank bett'],
    ['sessel', 'vm_armchair_cream', 'stuhl stoff', 'haus'],
    ['regal', 'vm_bookshelf', 'bretter buch', 'haus'],
    ['schreibtisch', 'vm_desk', 'tisch buch', 'haus'],
    ['schrank', 'vm_wardrobe', 'regal tuer', 'haus'],
    ['nachttisch', 'vm_nightstand', 'bett tisch', 'haus'],
    ['bett', 'white_bed', 'wolke bretter', 'haus'],
    ['etagenbett', 'vm_bunk_bed', 'bett leiter', 'haus'],
    ['kamin', 'vm_fireplace', 'ofen ziegel', 'haus'],
    ['klavier', 'vm_piano', 'notenblock tisch', 'haus'],
    ['blumentopf', 'vm_planter', 'terrakotta erde', 'haus'],
    ['zimmerpflanze', 'vm_monstera', 'blumentopf pflanze', 'haus'],
    ['kaktus', 'vm_plant_cactus_terracotta', 'blumentopf sand', 'haus'],
    ['bild', 'vm_art_landscape', 'papier bretter', 'haus'],
    ['spiegel', 'vm_mirror', 'glas eisen', 'haus'],
    ['fenster', 'vm_win_std1_white', 'glas bretter', 'haus'],
    ['vorhang', 'vm_curtain', 'stoff fenster', 'haus'],
    ['globus', 'vm_deco_globe_brass', 'kompass papier', 'haus'],
    ['aquarium', 'vm_deco_aquarium_cabinet', 'glas fisch', 'haus'],
    ['plattenspieler', 'vm_deco_record_walnut', 'notenblock kohle', 'haus'],
    // ---- Küche, Bad & Garten
    ['herd', 'vm_kitchen_white_hob', 'ofen metall', 'kueche'],
    ['spuele', 'vm_kitchen_white_sink', 'wasser schrank', 'kueche'],
    ['kuehlschrank', 'vm_fridge', 'schrank eis', 'kueche', 'schrank schnee'],
    ['wasserkocher', 'vm_kitchen_kettle_white', 'kessel strom', 'kueche'],
    ['toaster', 'vm_kitchen_toaster_cream', 'brot strom', 'kueche'],
    ['kaffeemaschine', 'vm_kitchen_espresso_steel', 'wasserkocher kohle', 'kueche'],
    ['pizzaofen', 'vm_shop_pizzaoven_wood', 'kamin brot', 'kueche'],
    ['eistruhe', 'vm_shop_icecream_freezer', 'eis truhe', 'kueche'],
    ['wanne', 'vm_bathtub', 'kessel wasser', 'kueche'],
    ['dusche', 'vm_shower', 'eimer glas', 'kueche', 'eimer wolke'],
    ['wc', 'vm_toilet', 'eimer stuhl', 'kueche'],
    ['sonnenschirm', 'vm_parasol', 'stock stoff', 'kueche'],
    ['grill', 'vm_bbq', 'lagerfeuer metall', 'kueche'],
    ['feuerschale', 'vm_fire_pit', 'lagerfeuer stein', 'kueche'],
    ['whirlpool', 'vm_garden_hottub_cedar', 'wanne feuer', 'kueche'],
    ['flamingo', 'vm_garden_poolfloat_flamingo', 'wasser blume', 'kueche'],
    ['maehroboter', 'vm_garden_mower_robot', 'gras saugroboter', 'kueche'],
    // ---- Technik: power, light, the smart home, things that roll
    ['strom', 'voltite_dust', 'kupfer wolke', 'technik', 'eisen wolke'],
    ['kabel', 'volt_wire', 'kupfer strom', 'technik', 'strom faden'],
    ['batterie', 'energy_cell', 'strom metall', 'technik', 'strom eisen'],
    ['lampe', 'volt_lamp', 'licht strom', 'technik', 'glas batterie'],
    ['tischlampe', 'vm_table_lamp', 'lampe hocker', 'technik'],
    ['stehlampe', 'vm_floor_lamp', 'lampe stock', 'technik'],
    ['kronleuchter', 'vm_chandelier', 'lampe lampe', 'technik'],
    ['neonschild', 'vm_shop_neon_open', 'lampe glas', 'technik'],
    ['smartlampe', 'vm_light_table_mushroom_white', 'lampe uhr', 'technik'],
    ['antenne', 'antenna', 'metall stock', 'technik'],
    ['schuessel', 'satellite_dish', 'antenne kessel', 'technik'],
    ['router', 'vm_smart_router_wifi', 'antenne kabel', 'technik'],
    ['fernseher', 'vm_tv', 'glas kabel', 'technik'],
    ['computer', 'vm_office_pc_rgb', 'fernseher schreibtisch', 'technik'],
    ['lautsprecher', 'vm_smart_speaker_charcoal', 'notenblock strom', 'technik'],
    ['kamera', 'vm_smart_camera_dome', 'fernrohr strom', 'technik'],
    ['klingel', 'vm_smart_doorbell_video', 'tuer kamera', 'technik'],
    ['saugroboter', 'vm_smart_vacuum_robot', 'luft batterie', 'technik'],
    ['luftreiniger', 'vm_smart_purifier_white', 'luft strom', 'technik'],
    ['hausbatterie', 'vm_smart_battery_wall', 'batterie batterie', 'technik'],
    ['solarspeicher', 'vm_smart_inverter_hybrid', 'hausbatterie licht', 'technik'],
    ['drucker3d', 'vm_office_printer3d_enclosed', 'computer ton', 'technik'],
    ['ebike', 'vm_mobility_ebike_city', 'metall batterie', 'technik'],
    ['escooter', 'vm_mobility_escooter_kick', 'bretter batterie', 'technik'],
    ['lastenrad', 'vm_mobility_cargobike_box', 'ebike truhe', 'technik'],
    ['moped', 'vm_mobility_moped_retro', 'ebike feuer', 'technik'],
    ['drohne', 'photo_drone', 'kamera luft', 'technik'],
    // ---- Weltall: the surprises at the end
    ['schubduese', 'thruster', 'metall feuer', 'weltall'],
    ['huelle', 'hull_plating', 'metall metall', 'weltall'],
    ['bullauge', 'viewport', 'huelle glas', 'weltall'],
    ['steuer', 'helm', 'huelle kompass', 'weltall'],
    ['reaktor', 'reactor_core', 'hausbatterie kristall', 'weltall'],
    ['aetherzelle', 'aether_cell', 'batterie wolke', 'weltall'],
    ['jetpack', 'jetpack', 'schubduese aetherzelle', 'weltall'],
    ['prismenherz', 'nether_star_shard', 'kristall licht', 'weltall'],
    ['sternenkern', 'star_core', 'prismenherz reaktor', 'weltall'],
    ['shuttle', 'shuttle_beacon', 'steuer schubduese', 'weltall'],
    ['schatzsucher', 'scanner', 'kompass diamant', 'weltall'],
    ['hoverbike', 'hoverbike', 'ebike schubduese', 'weltall'],
  ];

  // ---- the lookup tables, built once
  const pairOf = (s) => String(s).trim().split(/\s+/);
  const pk = (a, b) => (a < b ? a + '+' + b : b + '+' + a);
  const CARD = Object.create(null), BYPAIR = new Map();
  Inv.LIST = [];
  for (const s of Inv.STARTERS) CARD[s.k] = { k: s.k, id: s.id, starter: true, cat: null, a: null, alts: [] };
  for (const [k, id, a, cat, alts] of TABLE) {
    const c = { k, id, starter: false, cat, a: pairOf(a), alts: alts ? alts.split(',').map(pairOf) : [] };
    CARD[k] = c; Inv.LIST.push(c);
    for (const p of [c.a].concat(c.alts)) { const s = pk(p[0], p[1]); if (!BYPAIR.has(s)) BYPAIR.set(s, k); }
  }
  Inv.TOTAL = Inv.LIST.length;
  // how far an invention is from the start cards (0 = a start card): used to let 💡 Tipp lead the way softly
  const DEPTH = Object.create(null);
  {
    for (const s of Inv.STARTERS) DEPTH[s.k] = 0;
    for (let round = 1, changed = true; changed && round < 60; round++) {
      changed = false;
      for (const c of Inv.LIST) { if (DEPTH[c.k] !== undefined) continue; if ([c.a].concat(c.alts).some(p => DEPTH[p[0]] !== undefined && DEPTH[p[1]] !== undefined && DEPTH[p[0]] < round && DEPTH[p[1]] < round)) { DEPTH[c.k] = round; changed = true; } }
    }
  }
  Inv.depth = (k) => (DEPTH[k] === undefined ? -1 : DEPTH[k]);
  Inv.card = (k) => CARD[k] || null;
  Inv.idOf = (k) => (CARD[k] ? CARD[k].id : null);
  Inv.pairOf = (k) => { const c = CARD[k]; return c && c.a ? c.a.slice() : null; };
  Inv.find = (a, b) => (CARD[a] && CARD[b] ? BYPAIR.get(pk(a, b)) || null : null);

  // ---- the profile's progress
  let found = new Map(), raw = null;     // key → time
  const listeners = [];
  const emit = (e) => { for (const f of listeners.slice()) { try { f(e); } catch (er) { console.warn('invention listener', er); } } };
  const readRaw = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  function parse(r) {
    const m = new Map();
    let o = null; try { o = JSON.parse(r || 'null'); } catch (e) { o = null; }
    const f = o && typeof o === 'object' && o.found && typeof o.found === 'object' ? o.found : {};
    const rows = Object.keys(f).filter(k => CARD[k] && !CARD[k].starter).map((k, i) => [k, Number.isFinite(+f[k]) ? +f[k] : 0, i]);
    rows.sort((x, y) => x[1] - y[1] || x[2] - y[2]);
    for (const [k, t] of rows) m.set(k, t);
    return m;
  }
  function save() {
    const o = { v: 1, found: {} };
    for (const [k, t] of found) o.found[k] = t;
    raw = JSON.stringify(o);
    try { localStorage.setItem(KEY, raw); return true; } catch (e) { return false; }   // (full or refused: the session still counts)
  }
  raw = readRaw(); found = parse(raw);
  // the record changed in another tab or page: read it again
  Inv.sync = function () { const r = readRaw(); if (r === raw) return false; raw = r; found = parse(r); emit({ type: 'sync' }); return true; };
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('storage', (e) => { if (e.key === KEY || e.key === null) Inv.sync(); });

  Inv.has = (k) => !!(CARD[k] && (CARD[k].starter || found.has(k)));
  Inv.known = Inv.has;
  Inv.found = () => [...found.keys()];
  Inv.count = () => found.size;
  Inv.cards = () => Inv.STARTERS.map(s => s.k).concat([...found.keys()]);
  Inv.on = (fn) => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; };
  // two cards together → { ok: true, k, id, isNew } · { ok: false, reason: 'locked' (a card you do not have) | 'nothing' }
  Inv.combine = function (a, b) {
    if (!Inv.known(a) || !Inv.known(b)) return { ok: false, reason: 'locked' };
    const k = Inv.find(a, b);
    if (!k) return { ok: false, reason: 'nothing' };
    const isNew = !found.has(k);
    if (isNew) { found.set(k, Date.now()); save(); emit({ type: 'found', k }); }
    return { ok: true, k, id: CARD[k].id, isNew };
  };
  // 💡 Tipp: a pair of cards you have that makes something you have not found — the first such invention of the table
  Inv.tip = function () {
    for (const c of Inv.LIST) {
      if (found.has(c.k)) continue;
      const p = [c.a].concat(c.alts).find(q => Inv.known(q[0]) && Inv.known(q[1]));
      if (p) return { a: p[0], b: p[1], k: c.k };
    }
    return null;
  };
  Inv.reset = function () {
    found = new Map(); raw = null;
    try { localStorage.removeItem(KEY); } catch (e) { /* storage refused */ }
    emit({ type: 'reset' });
  };
  // the card's words in the language of the moment
  Inv.text = function (k) {
    const L = VR.I18N && VR.I18N.list ? VR.I18N.list('erf.i.' + k) : [];
    return { name: L[0] || k, line: L[1] || '' };
  };

  // ---- rewards. ctx = { inGame, mode, guest }: Creative and Zen put the item into the hand's reach; Survival (and a guest
  // in a friend's world) get the codex entry and the recipe, never a free item; on the start screen there is nobody to give to
  Inv.reward = function (ctx) {
    if (!ctx || !ctx.inGame) return 'none';
    return (ctx.mode === 'creative' || ctx.mode === 'zen') && !ctx.guest ? 'inventory' : 'codex';
  };
  const ctxOf = (g) => ({ inGame: !!(g && g.state === 'play' && g.player), mode: g && g.player ? g.player.mode || (g.meta && g.meta.mode) : null, guest: !!(g && g.meta && g.meta.guest) });
  Inv.ctxOf = ctxOf;
  // one stack of the invention into the inventory (the hotbar first); a second time only tops the stack up
  Inv.grant = function (g, k) {
    const c = CARD[k];
    if (!c || c.starter || !found.has(k)) return { ok: false, reason: 'unknown' };
    const ctx = ctxOf(g);
    if (!ctx.inGame) return { ok: false, reason: 'world' };
    if (Inv.reward(ctx) !== 'inventory') return { ok: false, reason: 'mode' };
    const inv = g.player.inv, max = VR.maxStack ? VR.maxStack(c.id) : 1, have = inv.count(c.id);
    if (have >= max) return { ok: true, added: 0, id: c.id };
    const n = inv.add(c.id, max - have);
    if (n <= 0) return { ok: false, reason: 'full' };
    inv.changed = true;
    return { ok: true, added: n, id: c.id };
  };

  // ---- the crafting recipe of an item, for the player who may not be given it: { kind: 'shaped', grid: rows × cols of ids
  // or null, w, h, n, list } or { kind: 'shapeless', list: [ids], n }; a tag (#planks) is shown as one of its members
  const TAGPIC = { planks: 'oak_planks', log: 'oak_log', wool: 'white_wool', stone: 'cobblestone', coal: 'coal', sand: 'sand', shard: 'crystal_shard_violet' };
  const pic = (x) => (typeof x === 'string' && x[0] === '#' ? TAGPIC[x.slice(1)] || null : x);
  Inv.recipeFor = function (id) {
    const rs = VR.Crafting && VR.Crafting.recipes;
    if (!rs || !id) return null;
    const r = rs.find(x => x.out === id);
    if (!r) return null;
    if (r.rows) {
      const w = Math.max(...r.rows.map(s => s.length)), grid = r.rows.map(s => { const row = []; for (let i = 0; i < w; i++) { const ch = s[i]; row.push(ch && ch !== ' ' ? pic(r.key[ch]) : null); } return row; });
      return { kind: 'shaped', grid, w, h: grid.length, n: r.n || 1, list: [...new Set(grid.flat().filter(Boolean))] };
    }
    const list = (r.ins || []).map(pic).filter(Boolean);
    return { kind: 'shapeless', list, n: r.n || 1 };
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
