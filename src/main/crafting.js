// ============================================================================
// Crafting (shaped + shapeless, auto-generated family recipes), smelting,
// containers with loot, furnaces, sleeping, experience.
// ============================================================================
(function (VR) {
  'use strict';
  // the player's language (lang_de.js / lang_en.js)
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  const R = VR.R;
  const has = (id) => !!(R.byName[id] || VR.ITEMS[id]);
  const TAGS = {
    planks: (id) => /_planks$/.test(id), log: (id) => /(_log|_wood|_stem|_hyphae)$/.test(id) && !/stripped|mushroom/.test(id) || /^stripped_.*_(log|wood)$/.test(id),
    wool: (id) => /_wool$/.test(id), stone: (id) => id === 'cobblestone' || id === 'cobbled_deepstone' || id === 'scoria',
    coal: (id) => id === 'coal' || id === 'charcoal', sand: (id) => id === 'sand' || id === 'red_sand', shard: (id) => /^crystal_shard_/.test(id),
  };
  const match1 = (want, id) => { if (!want) return !id; if (!id) return false; if (want[0] === '#') return TAGS[want.slice(1)](id); return want === id; };
  const recipes = [];
  const shaped = (rows, key, out, n) => { if (!has(out)) return; for (const k in key) if (key[k][0] !== '#' && !has(key[k])) return; recipes.push({ rows, key, out, n: n || 1 }); };
  const shapeless = (ins, out, n) => { if (!has(out)) return; for (const i of ins) if (i[0] !== '#' && !has(i)) return; recipes.push({ ins, out, n: n || 1 }); };

  // ---------------- basics ----------------
  for (const t of R.types) {
    const m = /^(.*)_(log|stem)$/.exec(t.name);
    if (m && !/stripped/.test(t.name) && R.byName[m[1] + '_planks']) { shapeless([t.name], m[1] + '_planks', 4); if (R.byName['stripped_' + t.name]) shapeless(['stripped_' + t.name], m[1] + '_planks', 4); }
    // family: slabs / stairs / walls from their base block
    const sm = /^(.*)_slab$/.exec(t.name); if (sm) { const base = t.o.parent || [sm[1], sm[1] + 's', sm[1] + '_block', sm[1] + '_planks'].find(b => R.byName[b]); if (base) shaped(['XXX'], { X: base }, t.name, 6); }
    const st = /^(.*)_stairs$/.exec(t.name); if (st) { const base = t.o.parent || [st[1], st[1] + 's', st[1] + '_block', st[1] + '_planks'].find(b => R.byName[b]); if (base) shaped(['X  ', 'XX ', 'XXX'], { X: base }, t.name, 4); }
    const wm = /^(.*)_wall$/.exec(t.name); if (wm && t.o.kind === 'wall') { const base = t.o.parent || [wm[1], wm[1] + 's'].find(b => R.byName[b]); if (base) shaped(['XXX', 'XXX'], { X: base }, t.name, 6); }
    const fm = /^(.*)_fence$/.exec(t.name); if (fm && R.byName[fm[1] + '_planks']) { shaped(['XSX', 'XSX'], { X: fm[1] + '_planks', S: 'stick' }, t.name, 3); if (R.byName[fm[1] + '_fence_gate']) shaped(['SXS', 'SXS'], { X: fm[1] + '_planks', S: 'stick' }, fm[1] + '_fence_gate', 1); }
    const dm = /^(.*)_door$/.exec(t.name); if (dm && R.byName[dm[1] + '_planks']) shaped(['XX', 'XX', 'XX'], { X: dm[1] + '_planks' }, t.name, 3);
    const tm = /^(.*)_trapdoor$/.exec(t.name); if (tm && R.byName[tm[1] + '_planks']) shaped(['XXX', 'XXX'], { X: tm[1] + '_planks' }, t.name, 2);
    const bm = /^(.*)_bed$/.exec(t.name); if (bm && R.byName[bm[1] + '_wool']) shaped(['WWW', 'PPP'], { W: bm[1] + '_wool', P: '#planks' }, t.name, 1);
    const cm = /^(.*)_carpet$/.exec(t.name); if (cm && R.byName[cm[1] + '_wool']) shaped(['WW'], { W: cm[1] + '_wool' }, t.name, 3);
    const gm = /^(.*)_stained_glass$/.exec(t.name); if (gm) { shaped(['GGG', 'GDG', 'GGG'], { G: 'glass', D: gm[1] + '_wool' }, t.name, 8); if (R.byName[t.name + '_pane']) shaped(['GGG', 'GGG'], { G: t.name }, t.name + '_pane', 16); }
    const bm2 = /^(.*)_button$/.exec(t.name); if (bm2 && R.byName[bm2[1] + '_planks']) shapeless([bm2[1] + '_planks'], t.name, 1);
    const pm = /^(.*)_pressure_plate$/.exec(t.name); if (pm && R.byName[pm[1] + '_planks']) shaped(['XX'], { X: pm[1] + '_planks' }, t.name, 1);
  }
  // ---------------- modern set (v0.30): Vollton = two concretes mixed (the pair whose blend is closest), gloss with
  // honeycomb lacquer; panorama glass from glass + frame material; modern doors from their materials
  if (VR.VOLLTON && VR.COLOR_HEX) {
    const lin = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255].map(v => Math.pow(v, 2.2));
    const cols = VR.COLORS.filter(c => has(c + '_concrete')), used = new Set();
    for (const [id, , hex] of VR.VOLLTON) {
      const want = lin(hex); let best = null, bd = 1e9;
      for (let i = 0; i < cols.length; i++) for (let j = i; j < cols.length; j++) {
        const k = cols[i] + '+' + cols[j]; if (used.has(k)) continue;
        const a = lin(VR.COLOR_HEX[cols[i]]), b = lin(VR.COLOR_HEX[cols[j]]);
        const d = (a[0] + b[0]) / 2 - want[0], e = (a[1] + b[1]) / 2 - want[1], f = (a[2] + b[2]) / 2 - want[2], dd = d * d + e * e + f * f;
        if (dd < bd) { bd = dd; best = [cols[i], cols[j], k]; }
      }
      if (!best) continue;
      used.add(best[2]);
      shapeless([best[0] + '_concrete', best[1] + '_concrete'], 'vollton_' + id, 2);
      shapeless(['vollton_' + id, 'honeycomb'], 'vollton_' + id + '_gloss', 1);
    }
  }
  for (const [style, frame] of [['black', 'coal'], ['white', 'bone_meal'], ['anthracite', 'iron_nugget'], ['bronze', 'copper_ingot'], ['grid', 'iron_ingot'], ['frosted', 'quartz'], ['tinted', 'amethyst_shard']])
    shaped(['GGG', 'GFG', 'GGG'], { G: 'glass', F: frame }, 'panorama_' + style, 8);
  shaped(['FG', 'FG', 'FI'], { F: 'coal', G: 'glass', I: 'iron_ingot' }, 'door_glass_black', 1);
  shaped(['FG', 'FG', 'FI'], { F: 'bone_meal', G: 'glass', I: 'iron_ingot' }, 'door_glass_white', 1);
  shaped(['XX', 'XX', 'XI'], { X: 'vollton_anthracite', I: 'iron_ingot' }, 'door_pivot_anthracite', 1);
  shaped(['XX', 'XX', 'XI'], { X: 'dark_oak_planks', I: 'coal' }, 'door_slat_walnut', 1);
  shaped(['XX', 'XX', 'XI'], { X: 'vollton_white', I: 'coal' }, 'door_flush_white', 1);
  shaped(['XX', 'XX', 'XI'], { X: 'oak_planks', I: 'coal' }, 'door_flush_oak', 1);
  shaped(['XG', 'XX', 'XI'], { X: 'vollton_anthracite', G: 'glass', I: 'iron_ingot' }, 'door_strip_anthracite', 1);
  shaped(['IG', 'IG', 'IQ'], { I: 'iron_ingot', G: 'glass', Q: 'quartz' }, 'door_frosted_steel', 1);
  shaped(['FG', 'FF', 'FG'], { F: 'iron_ingot', G: 'glass' }, 'door_loft_black', 1);
  shaped(['X', 'X'], { X: '#planks' }, 'stick', 4);
  shaped(['XX', 'XX'], { X: '#planks' }, 'crafting_table');
  shaped(['C', 'S'], { C: '#coal', S: 'stick' }, 'torch', 4);
  shaped(['XXX', 'X X', 'XXX'], { X: '#planks' }, 'chest');
  shaped(['XSX', 'X X', 'XSX'], { X: '#planks', S: '#planks' }, 'barrel');
  shaped(['XXX', 'X X', 'XXX'], { X: '#stone' }, 'furnace');
  shaped(['III', 'IFI', 'SSS'], { I: 'iron_ingot', F: 'furnace', S: 'smooth_stone' }, 'blast_furnace');
  shaped(['S S', 'SSS', 'S S'], { S: 'stick' }, 'ladder', 3);
  shaped(['XX', 'XX'], { X: 'stone' }, 'stone_bricks', 4);
  shaped(['XX', 'XX'], { X: 'brick' }, 'bricks');
  shaped(['GGG', 'GGG'], { G: 'glass' }, 'glass_pane', 16);
  shaped(['WW', 'WW'], { W: 'string' }, 'white_wool');
  shaped(['PPP', 'BBB', 'PPP'], { P: '#planks', B: 'book' }, 'bookshelf');
  shaped(['PP', 'PP'], { P: 'paper' }, 'book');
  shaped(['SSS'], { S: 'sugar_cane' }, 'paper', 3);
  shapeless(['sugar_cane'], 'sugar', 1);
  shaped(['XXX'], { X: 'wheat' }, 'bread');
  shaped(['GGG', 'GAG', 'GGG'], { G: 'gold_ingot', A: 'apple' }, 'golden_apple');
  shaped(['SXS', 'XTX', 'SXS'], { S: '#sand', X: 'gunpowder', T: '#sand' }, 'tnt');
  shaped(['GGG', 'GRG', 'GGG'], { G: 'glass', R: 'voltite_dust' }, 'volt_lamp');
  shaped(['S', 'C'], { S: 'stick', C: '#stone' }, 'lever');
  shaped(['R', 'S'], { R: 'voltite_dust', S: 'stick' }, 'volt_torch');
  shaped(['PPP', 'CIC', 'CRC'], { P: '#planks', C: '#stone', I: 'iron_ingot', R: 'voltite_dust' }, 'piston');
  shaped(['I I', 'ISI', 'I I'], { I: 'iron_ingot', S: 'stick' }, 'rail', 16);
  shaped(['G G', 'GSG', 'GRG'], { G: 'gold_ingot', S: 'stick', R: 'voltite_dust' }, 'powered_rail', 6);
  shaped(['I I', ' I '], { I: 'iron_ingot' }, 'bucket');
  shaped([' I', 'I '], { I: 'iron_ingot' }, 'shears');
  shapeless(['iron_ingot', 'flint'], 'flint_and_steel');
  shaped([' ST', 'S T', ' ST'], { S: 'stick', T: 'string' }, 'bow');
  shaped(['F', 'S', 'E'], { F: 'flint', S: 'stick', E: 'feather' }, 'arrow', 4);
  shaped([' I ', 'IRI', ' I '], { I: 'iron_ingot', R: 'voltite_dust' }, 'compass');
  shaped([' G ', 'GRG', ' G '], { G: 'gold_ingot', R: 'voltite_dust' }, 'clock');
  shaped(['A', 'C', 'C'], { A: 'amethyst_shard', C: 'copper_ingot' }, 'spyglass');
  shapeless(['bone'], 'bone_meal', 3);
  shapeless(['brown_mushroom', 'red_mushroom', 'bowl'], 'mushroom_stew');
  shapeless(['pumpkin', 'sugar', 'egg'], 'pumpkin_pie');
  shapeless(['wheat', 'cocoa', 'wheat'], 'cookie', 8);
  // storage blocks
  for (const [ing, blk] of [['iron_ingot', 'iron_block'], ['gold_ingot', 'gold_block'], ['copper_ingot', 'copper_block'], ['diamond', 'diamond_block'], ['emerald', 'emerald_block'], ['lapis_lazuli', 'lapis_block'], ['coal', 'coal_block'], ['voltite_dust', 'voltite_block'], ['raw_iron', 'raw_iron_block'], ['raw_gold', 'raw_gold_block'], ['raw_copper', 'raw_copper_block'], ['duskite_ingot', 'duskite_block'], ['iron_nugget', 'iron_ingot'], ['gold_nugget', 'gold_ingot']]) {
    if (!has(blk) || !has(ing)) continue;
    shaped(['XXX', 'XXX', 'XXX'], { X: ing }, blk);
    if (!/nugget/.test(ing)) shapeless([blk], ing, 9);
  }
  // crystals
  for (const c of ['violet', 'azure', 'verdant', 'rose', 'amber']) { shaped(['XX', 'XX'], { X: 'crystal_shard_' + c }, c + '_crystal_block'); shaped(['G', 'X'], { G: 'glass', X: 'crystal_shard_' + c }, 'neon_' + ({ violet: 'magenta', azure: 'cyan', verdant: 'lime', rose: 'magenta', amber: 'amber' }[c]), 4); }
  // tools
  const TM = { wooden: '#planks', stone: '#stone', copper: 'copper_ingot', iron: 'iron_ingot', golden: 'gold_ingot', diamond: 'diamond' };
  for (const m in TM) {
    const X = TM[m];
    shaped(['XXX', ' S ', ' S '], { X, S: 'stick' }, m + '_pickaxe');
    shaped(['XX', 'XS', ' S'], { X, S: 'stick' }, m + '_axe');
    shaped(['X', 'S', 'S'], { X, S: 'stick' }, m + '_shovel');
    shaped(['XX', ' S', ' S'], { X, S: 'stick' }, m + '_hoe');
    shaped(['X', 'X', 'S'], { X, S: 'stick' }, m + '_sword');
  }
  for (const t of ['pickaxe', 'axe', 'shovel', 'hoe', 'sword']) shapeless(['diamond_' + t, 'duskite_ingot'], 'duskite_' + t);
  shapeless(['relic_scrap', 'relic_scrap', 'relic_scrap', 'relic_scrap', 'gold_ingot', 'gold_ingot', 'gold_ingot', 'gold_ingot'], 'duskite_ingot');
  // armor
  const AM = { leather: 'leather', copper: 'copper_ingot', iron: 'iron_ingot', golden: 'gold_ingot', diamond: 'diamond' };
  for (const m in AM) {
    const X = AM[m];
    shaped(['XXX', 'X X'], { X }, m + '_helmet'); shaped(['X X', 'XXX', 'XXX'], { X }, m + '_chestplate'); shaped(['XXX', 'X X', 'X X'], { X }, m + '_leggings'); shaped(['X X', 'X X'], { X }, m + '_boots');
  }
  // Starforge tech
  shaped(['CRC', 'RGR', 'CRC'], { C: 'copper_ingot', R: 'voltite_dust', G: 'glass' }, 'energy_cell', 2);
  shaped(['GAG', 'ACA', 'GAG'], { G: 'glass', A: 'crystal_shard_azure', C: 'energy_cell' }, 'aether_cell');
  shaped(['III', 'IEI', 'III'], { I: 'iron_ingot', E: 'energy_cell' }, 'hull_plating', 8);
  shapeless(['hull_plating', 'coal'], 'hull_plating_dark');
  shapeless(['hull_plating', 'gravel'], 'hull_plating_gray');
  shaped(['HHH', 'HEH', 'HHH'], { H: 'hull_plating', E: 'energy_cell' }, 'tech_panel', 8);
  shaped(['HH', 'HH'], { H: 'hull_plating_gray' }, 'landing_pad', 4);
  shaped(['GGG', 'GEG', 'GGG'], { G: 'glass', E: 'energy_cell' }, 'light_panel', 4);
  shaped(['GIG', 'GEG', 'GIG'], { G: 'glass', I: 'iron_ingot', E: 'crystal_shard_azure' }, 'viewport', 4);
  shaped(['IEI', 'CAC', 'I I'], { I: 'iron_ingot', E: 'energy_cell', C: 'copper_ingot', A: 'crystal_shard_amber' }, 'laser_blaster');
  shaped(['DEA', ' I ', ' I '], { D: 'diamond', E: 'energy_cell', A: 'crystal_shard_rose', I: 'iron_ingot' }, 'mining_laser');
  shaped(['IAI', 'IEI', 'T T'], { I: 'iron_ingot', A: 'aether_cell', E: 'energy_cell', T: 'hull_plating' }, 'jetpack');
  shaped([' G ', 'HAH', 'EHE'], { G: 'viewport', H: 'hull_plating', A: 'aether_cell', E: 'energy_cell' }, 'hoverbike');
  shaped(['DSD', 'AHA', 'DSD'], { D: 'diamond', S: 'nether_star_shard', A: 'aether_cell', H: 'hull_plating' }, 'shuttle_beacon');
  shaped([' C', 'S '], { C: 'crystal_shard_verdant', S: 'stick' }, 'builder_wand');
  shaped(['I', 'E', 'I'], { I: 'iron_ingot', E: 'energy_cell' }, 'scanner');
  shaped(['C', 'S'], { C: 'crystal_shard_verdant', S: 'stick' }, 'waypoint_marker', 4);
  shaped(['III', 'CEC', 'III'], { I: 'iron_ingot', C: 'copper_ingot', E: 'energy_cell' }, 'turret');
  shaped(['IHI', 'HTH', 'IHI'], { I: 'iron_ingot', H: 'hull_plating', T: 'thruster' }, 'helm');
  shaped(['HAH', 'HEH', 'H H'], { H: 'hull_plating', A: 'aether_cell', E: 'energy_cell' }, 'thruster');
  shaped(['HHH', 'H H'], { H: 'hull_plating' }, 'pilot_seat');
  shapeless(['wheat', 'raw_beef', 'apple', 'paper'], 'space_ration', 2);

  const SMELT = { raw_iron: 'iron_ingot', raw_gold: 'gold_ingot', raw_copper: 'copper_ingot', iron_ore: 'iron_ingot', gold_ore: 'gold_ingot', copper_ore: 'copper_ingot', deepstone_iron_ore: 'iron_ingot', deepstone_gold_ore: 'gold_ingot', deepstone_copper_ore: 'copper_ingot', sand: 'glass', red_sand: 'glass', cobblestone: 'stone', stone: 'smooth_stone', clay_ball: 'brick', clay: 'terracotta', raw_beef: 'steak', raw_porkchop: 'cooked_porkchop', raw_chicken: 'cooked_chicken', raw_mutton: 'cooked_mutton', raw_cod: 'cooked_cod', raw_salmon: 'cooked_salmon', potato: 'baked_potato', kelp: 'dried_kelp', wet_sponge: 'sponge', relic_ore: 'relic_scrap', cobbled_deepstone: 'deepstone', stone_bricks: 'cracked_stone_bricks', emberrock: 'ember_bricks' };
  const FUEL = { coal: 80, charcoal: 80, coal_block: 800, lava_bucket: 1000, stick: 5, energy_cell: 120, aether_cell: 400, bamboo: 2.5, dried_kelp_block: 200 };
  const fuelOf = (id) => FUEL[id] || (/_planks$|_log$|_wood$|_stem$|chest|crafting_table|barrel|bookshelf|_fence|_stairs|_slab/.test(id) && R.byName[id] && R.byName[id].o.flam ? 15 : 0) || (/wooden_/.test(id) ? 10 : 0);
  for (const t of R.types) { const m = /^(.*)_log$/.exec(t.name); if (m) SMELT[t.name] = 'charcoal'; }

  const C = VR.Crafting = {
    recipes, SMELT, fuelOf,
    match(grid, n) {
      const ids = [];
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const s = grid[y * n + x]; ids.push(s ? s.id : null); }
      // bounding box
      let x0 = n, y0 = n, x1 = -1, y1 = -1;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (ids[y * n + x]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      if (x1 < 0) return null;
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      const filled = ids.filter(Boolean);
      for (const r of recipes) {
        if (r.rows) {
          const rh = r.rows.length, rw = Math.max(...r.rows.map(s => s.length));
          if (rw !== w || rh !== h) continue;
          for (const mirror of [false, true]) {
            let ok = true;
            for (let y = 0; y < h && ok; y++) for (let x = 0; x < w && ok; x++) {
              const ch = r.rows[y][mirror ? w - 1 - x : x] || ' ';
              const want = ch === ' ' ? null : r.key[ch];
              if (!match1(want, ids[(y0 + y) * n + (x0 + x)])) ok = false;
            }
            if (ok) return { id: r.out, n: r.n };
          }
        } else {
          if (r.ins.length !== filled.length) continue;
          const left = filled.slice();
          let ok = true;
          for (const want of r.ins) { const i = left.findIndex(id => match1(want, id)); if (i < 0) { ok = false; break; } left.splice(i, 1); }
          if (ok) return { id: r.out, n: r.n };
        }
      }
      return null;
    },
    consume(grid, n) {
      for (let i = 0; i < n * n; i++) { const s = grid[i]; if (!s) continue; if (/_bucket$/.test(s.id) && s.id !== 'bucket') { s.id = 'bucket'; continue; } s.n--; if (s.n <= 0) grid[i] = null; }
    },
  };

  // ---------------- loot ----------------
  const LOOT = {
    dungeon: [['bread', 1, 3, 0.6], ['bone', 1, 5, 0.5], ['string', 1, 3, 0.4], ['gunpowder', 1, 3, 0.4], ['iron_ingot', 1, 4, 0.4], ['gold_ingot', 1, 3, 0.3], ['voltite_dust', 2, 6, 0.3], ['diamond', 1, 2, 0.08], ['golden_apple', 1, 1, 0.06], ['wheat_seeds', 2, 6, 0.3], ['coal', 2, 8, 0.4], ['crystal_shard_violet', 1, 4, 0.2]],
    outpost: [['space_ration', 1, 4, 0.7], ['energy_cell', 1, 3, 0.6], ['iron_ingot', 2, 6, 0.5], ['copper_ingot', 2, 8, 0.5], ['aether_cell', 1, 2, 0.3], ['hull_plating', 4, 16, 0.4], ['neon_cyan', 2, 8, 0.4], ['laser_blaster', 1, 1, 0.15], ['crystal_shard_azure', 1, 4, 0.3], ['scanner', 1, 1, 0.1], ['waypoint_marker', 2, 6, 0.3]],
    outpost_rare: [['jetpack', 1, 1, 0.45], ['mining_laser', 1, 1, 0.4], ['aether_cell', 1, 3, 0.6], ['energy_cell', 2, 6, 0.7], ['diamond', 1, 3, 0.35], ['hoverbike', 1, 1, 0.25], ['shuttle_beacon', 1, 1, 0.08], ['builder_wand', 1, 1, 0.3], ['nether_star_shard', 1, 1, 0.15]],
    station: [['shuttle_beacon', 1, 1, 0.3], ['jetpack', 1, 1, 0.5], ['nether_star_shard', 1, 2, 0.5], ['aether_cell', 2, 4, 0.8], ['diamond', 2, 5, 0.6]],
  };
  C.rollLoot = function (table, size) {
    const items = new Array(size || 27).fill(null);
    const L = LOOT[table] || LOOT.dungeon;
    for (const [id, a, b, p] of L) { if (!has(id) || Math.random() > p) continue; let slot; let tries = 0; do { slot = Math.floor(Math.random() * items.length); } while (items[slot] && tries++ < 20); items[slot] = { id, n: a + Math.floor(Math.random() * (b - a + 1)) }; }
    return items;
  };

  // ---------------- game hooks: containers, furnaces, sleep, xp ----------------
  VR.installCraftingHooks = function (g) {
    const beAt = (x, y, z, create) => {
      const c = g.world.col(x >> 4, z >> 4); if (!c) return null;
      const k = (y << 8) | ((z & 15) << 4) | (x & 15);
      let be = c.blockEntities.get(k);
      if (!be && create) { be = create(); c.blockEntities.set(k, be); }
      return { be, c };
    };
    g.openContainer = (x, y, z, t) => {
      const r = beAt(x, y, z, () => ({ type: 'chest', items: null }));
      if (!r) return;
      const be = r.be;
      if (!be.items) be.items = be.loot ? C.rollLoot(be.loot, 27) : new Array(27).fill(null);
      if (t.name === 'void_chest') { g.voidChest = g.voidChest || new Array(27).fill(null); be.items = g.voidChest; }
      r.c.modified = true;
      g.audio.play('chest');
      g.ui.openInventory('chest', { items: be.items, title: t.display, col: r.c });
      g.codex && g.codex.onOpen && g.codex.onOpen(t.name, be.loot);
    };
    g.onInventoryClose = (kind, data) => { if (data && data.col) data.col.modified = true; };
    g.furnaces = new Set();
    g.openFurnace = (x, y, z, t) => {
      const r = beAt(x, y, z, () => ({ type: 'furnace', items: [null, null, null], burn: 0, burnMax: 0, progress: 0 }));
      if (!r) return;
      r.be.pos = [x, y, z]; r.be.speed = /blast|smoker/.test(t.name) ? 2 : 1;
      g.furnaces.add(r.be);
      r.c.modified = true;
      g.ui.openInventory('furnace', { items: r.be.items, title: t.display, col: r.c, burn: r.be.burn, get progress() { return r.be.progress; } });
    };
    g.tickFurnaces = (dt) => {
      for (const f of g.furnaces) {
        const it = f.items, inp = it[0];
        const out = inp ? SMELT[inp.id] : null;
        const canOut = out && (!it[2] || (it[2].id === out && it[2].n < VR.maxStack(out)));
        if (f.burn <= 0 && canOut && it[1]) { const fv = fuelOf(it[1].id); if (fv > 0) { f.burn = f.burnMax = fv; if (/_bucket$/.test(it[1].id)) it[1] = { id: 'bucket', n: 1 }; else { it[1].n--; if (!it[1].n) it[1] = null; } } }
        const was = f.lit;
        f.lit = f.burn > 0;
        if (f.burn > 0) f.burn -= dt;
        if (f.burn > 0 && canOut) { f.progress += dt * f.speed / 10; if (f.progress >= 1) { f.progress = 0; if (it[2]) it[2].n++; else it[2] = { id: out, n: 1 }; inp.n--; if (!inp.n) it[0] = null; } }
        else f.progress = Math.max(0, f.progress - dt * 0.2);
        if (was !== f.lit && f.pos) { const [x, y, z] = f.pos; const s = g.world.getBlock(x, y, z); const t = R.types[R.T.type[s]]; if (t && t.has('lit')) g.world.setBlock(x, y, z, t.with(s, 'lit', f.lit ? 1 : 0), 4); }
        if (!f.lit && !f.progress && !it[0]) g.furnaces.delete(f);
      }
    };
    g.sleep = (x, y, z) => {
      const tod = g.env.timeOfDay;
      g.player.spawn = [x + 0.5, y + 0.6, z + 0.5];
      g.player.spawnBed = [x, y, z];
      if (g.mp && g.mp.isClient) { g.ui.chatLine(T('g.chat.spawnSetGuest'), '#ffe0a0'); return; }
      if (tod > 12500 && tod < 23500) { g.ui.loading(T('g.load.sleeping'), 1); setTimeout(() => { g.env.setTime(0); g.env.day = (g.env.day || 0) + 1; g.env.rainTarget = 0; g.ui.show(null); g.input.captured = true; g.ui.chatLine(T('g.chat.morning'), '#ffe0a0'); g.codex && g.codex.event && g.codex.event('sleep'); }, 900); }
      else g.ui.chatLine(T('g.chat.spawnSetNight'), '#ffe0a0');
    };
    g.addXP = (n) => {
      const p = g.player;
      p.xp += n / (7 + p.level * 2);
      while (p.xp >= 1) { p.xp -= 1; p.level++; g.audio.play('levelup'); }
      g.ui.updateHUD(true);
    };
  };
})(VR);
