// ============================================================================
// Discovery Codex: biomes, creatures and milestones. Unlocks show a toast and
// are saved with the world.
// ============================================================================
(function (VR) {
  'use strict';
  const title = (id) => id.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  // the player's language (lang_de.js / lang_en.js): every entry's name, description and hint are looked up when
  // shown, so the language switches live. Milestones: [id, icon]; their texts are g.codex.m.<id> = [name, desc, hint].
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k), TL = (k) => (VR.I18N && VR.I18N.list ? VR.I18N.list(k) : []);
  const MILESTONES = [
    ['log', 'oak_log'], ['table', 'crafting_table'], ['torch', 'torch'], ['stone', 'cobblestone'], ['furnace', 'furnace'], ['iron', 'iron_ingot'], ['diamond', 'diamond'],
    ['crystal', 'crystal_shard_violet'], ['aether', 'aether_bucket'], ['star_core', 'star_core'], ['outpost', 'cargo_crate'], ['blaster', 'laser_blaster'], ['jetpack', 'jetpack'],
    ['bike', 'hoverbike'], ['ship', 'helm'], ['orbit', 'viewport'], ['wand', 'builder_wand'], ['blueprint', 'blueprint_0'], ['drone', 'photo_drone'], ['shot', 'glass'],
    ['raid', 'turret'], ['kill', 'iron_sword'], ['deep', 'deepstone'], ['sky', 'white_wool'], ['night', 'lantern'], ['sleep', 'red_bed'], ['village', 'vx_lamppost'],
    ['villager', 'vx_bed_red'], ['quest', 'emerald'], ['home', 'vx_bed_blue'], ['festival', 'lantern'], ['autopilot', 'shuttle_beacon'],
  ];
  const CATS = { milestones: 'g.codex.cat.milestones', creatures: 'g.codex.cat.creatures', realm: 'g.codex.cat.realm', overworld: 'g.codex.cat.overworld', caves: 'g.codex.cat.caves', forge: 'g.codex.cat.forge', hollow: 'g.codex.cat.hollow', drift: 'g.codex.cat.drift' };
  const INV_TRIGGERS = { oak_log: 'log', birch_log: 'log', spruce_log: 'log', jungle_log: 'log', acacia_log: 'log', dark_oak_log: 'log', cherry_log: 'log', mangrove_log: 'log', cobblestone: 'stone', iron_ingot: 'iron', diamond: 'diamond', crystal_shard_violet: 'crystal', crystal_shard_azure: 'crystal', crystal_shard_verdant: 'crystal', crystal_shard_rose: 'crystal', crystal_shard_amber: 'crystal', aether_bucket: 'aether', star_core: 'star_core', laser_blaster: 'blaster', crafting_table: 'table', torch: 'torch', furnace: 'furnace' };

  class Codex {
    constructor(g, meta) {
      this.g = g;
      this.meta = meta || {};
      this.found = Object.assign({}, this.meta.codex || {});
      this.entries = [];
      this.byId = new Map();
      // an entry: {id, catKey, icon, text()} — text() gives {name, desc, hint} in the language of the moment
      const add = (id, catKey, icon, text) => { const e = { id, catKey, icon, text }; this.entries.push(e); this.byId.set(id, e); };
      for (const [id, ic] of MILESTONES) add('m:' + id, 'milestones', ic, () => { const L = TL('g.codex.m.' + id); return { name: L[0] || id, desc: L[1] || '', hint: L[2] || '' }; });
      for (const k in VR.MOBS || {}) { if (VR.MOBS[k] === VR.MOBS.glimmer_deer && k !== 'glimmer_deer') continue; add('c:' + k, 'creatures', 'egg_' + k, () => { const name = T('g.mob.' + k, null, title(k)); return { name, desc: T('g.codex.metCreature', { name }), hint: T('g.codex.creatureHint') }; }); }
      for (const b of VR.BIOMES) {
        const catKey = b.realm ? 'realm' : b.cave ? 'caves' : b.forge ? 'forge' : b.hollow ? 'hollow' : b.drift ? 'drift' : 'overworld';
        add('b:' + b.key, catKey, null, () => { const name = T('g.biome.' + b.key, null, b.name); return { name, desc: T('g.codex.foundBiome', { name }), hint: T(catKey === 'caves' ? 'g.codex.biomeHintCave' : 'g.codex.biomeHint') }; });
      }
      this.t = 0; this.nightStart = null;
      this.seen = new Set();
    }
    unlock(id) {
      if (this.found[id]) return false;
      const e = this.byId.get(id); if (!e) return false;
      this.found[id] = Date.now();
      const g = this.g;
      if (g.settings.toasts !== false && g.ui) g.ui.toast(T(e.catKey === 'milestones' ? 'g.codex.toastMilestone' : 'g.codex.toastFound'), e.text().name, e.icon && VR.itemDef(e.icon) ? e.icon : null);
      else if (g.audio) g.audio.play('achievement');
      if (g.audio && e.catKey === 'milestones') g.audio.play('achievement');
      return true;
    }
    event(name) { this.unlock('m:' + name); }
    // item milestones only mean something in Survival
    get surv() { return this.g.player && this.g.player.mode === 'survival'; }
    onCraft(id) { const k = INV_TRIGGERS[id]; if (k && this.surv) this.unlock('m:' + k); }
    onPickup(id) { const k = INV_TRIGGERS[id] || (/_log$/.test(id) ? 'log' : null); if (k && this.surv) this.unlock('m:' + k); }
    onKill(kind) { const d = VR.MOBS[kind]; if (d && d.hostile) this.unlock('m:kill'); }
    onOpen(name, loot) { if (loot && /outpost/.test(loot)) this.unlock('m:outpost'); }
    update(dt) {
      const g = this.g, p = g.player, w = g.world;
      if (!p || !w) return;
      this.t -= dt; if (this.t > 0) return;
      this.t = 1;
      const x = Math.floor(p.pos[0]), y = Math.floor(p.pos[1]), z = Math.floor(p.pos[2]);
      const b = VR.BIOMES[w.biomeAt(x, z)];
      if (b) {
        // cave biomes only count when you're actually underground
        const sky = (w.getLight(x, y + 1, z) >>> 12);
        if (!b.cave || sky < 6) this.unlock('b:' + b.key);
      }
      if (g.entities) for (const m of g.entities.mobs) { const dx = m.pos[0] - p.pos[0], dz = m.pos[2] - p.pos[2]; if (dx * dx + dz * dz < 144 && Math.abs(m.pos[1] - p.pos[1]) < 12) this.unlock('c:' + m.kind); }
      if (p.mode === 'survival') for (const s of p.inv.slots) if (s) { const k = INV_TRIGGERS[s.id] || (/_log$/.test(s.id) ? 'log' : null); if (k) this.unlock('m:' + k); }
      if (y <= 6) this.unlock('m:deep');
      if (y >= 200) this.unlock('m:sky');
      // a full night survived
      if (p.mode === 'survival') {
        const tod = g.env.timeOfDay;
        if (tod > 13200 && tod < 14000 && this.nightStart === null) this.nightStart = g.env.day;
        if (this.nightStart !== null && tod > 23300 && !p.dead) { this.unlock('m:night'); this.nightStart = null; }
        if (p.dead) this.nightStart = null;
      }
    }
    // the entries with their texts in the language of the moment: {id, cat, name, desc, hint, icon, found}
    list() {
      const order = ['milestones', 'creatures', 'realm', 'overworld', 'caves', 'forge', 'hollow', 'drift'];
      return this.entries.map(e => Object.assign({ id: e.id, catKey: e.catKey, cat: T(CATS[e.catKey]), icon: e.icon, found: !!this.found[e.id] }, e.text())).sort((a, b) => order.indexOf(a.catKey) - order.indexOf(b.catKey));
    }
    toJSON() { return this.found; }
  }
  VR.Codex = Codex;
})(VR);
