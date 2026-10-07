// ============================================================================
// Discovery Codex: biomes, creatures and milestones. Unlocks show a toast and
// are saved with the world.
// ============================================================================
(function (VR) {
  'use strict';
  const title = (id) => id.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  // [id, name, description, hint, icon]
  const MILESTONES = [
    ['log', 'Timber!', 'Collected your first log.', 'Trees have more to give.', 'oak_log'],
    ['table', 'Workbench', 'Crafted a crafting table.', 'Four planks, one purpose.', 'crafting_table'],
    ['torch', 'First Light', 'Crafted torches.', 'Coal and sticks push back the dark.', 'torch'],
    ['stone', 'First Stone', 'Gathered cobblestone.', 'Dig deeper than dirt.', 'cobblestone'],
    ['furnace', 'Fired Up', 'Built a furnace.', 'Eight stones in a ring.', 'furnace'],
    ['iron', 'Iron Will', 'Obtained an iron ingot.', 'Smelt what you mine.', 'iron_ingot'],
    ['diamond', 'Blue Fire', 'Found a diamond.', 'Deep, deep down.', 'diamond'],
    ['crystal', 'Crystal Harvest', 'Collected a realm crystal shard.', 'The glowing spires shed shards.', 'crystal_shard_violet'],
    ['aether', 'Liquid Energy', 'Bottled aether in a bucket.', 'Blue rivers hum with power.', 'aether_bucket'],
    ['star_core', 'Meteor Hunter', 'Recovered a star core from a meteor crater.', 'Watch the night sky in Survival.', 'star_core'],
    ['outpost', 'Outpost Explorer', 'Opened a crate at a Starforge outpost.', 'Find a landing pad with a tower.', 'cargo_crate'],
    ['blaster', 'Armed & Ready', 'Got hold of a Pulse Blaster.', 'Outposts and Starforge crafting.', 'laser_blaster'],
    ['jetpack', 'Rocket Pack', 'Flew with a jetpack.', 'Wear it, jump, hold Space.', 'jetpack'],
    ['bike', 'Hover Time', 'Rode a hoverbike.', 'Outposts keep one parked nearby.', 'hoverbike'],
    ['ship', 'Take the Helm', 'Flew a ship built from blocks.', 'Right-click a Ship Helm inside a hull.', 'helm'],
    ['orbit', 'Edge of Space', 'Flew a ship to the top of the sky.', 'Climb, climb, climb.', 'viewport'],
    ['wand', 'Master Builder', 'Shaped the world with the Builder Wand.', 'Two corners, one key.', 'builder_wand'],
    ['blueprint', 'Architect', 'Built a villa from a blueprint.', 'Creative → Blueprints, or /haus.', 'blueprint_0'],
    ['drone', 'Say Cheese', 'Launched the photo drone.', 'A camera with wings.', 'photo_drone'],
    ['shot', 'Postcard', 'Captured a screenshot.', 'F2 or the photo drone.', 'glass'],
    ['raid', 'Raid Defender', 'Repelled a night raid of drones.', 'Survive the night in Survival.', 'turret'],
    ['kill', 'First Blood', 'Defeated a hostile creature.', 'Not everything here is friendly.', 'iron_sword'],
    ['deep', 'Into the Depths', 'Reached the bottom of the world.', 'Keep digging.', 'deepstone'],
    ['sky', 'Cloud Walker', 'Stood higher than the clouds.', 'Climb or fly above 200.', 'white_wool'],
    ['night', 'Night Owl', 'Survived a full night in Survival.', 'Stay alive till dawn.', 'lantern'],
    ['sleep', 'Good Night', 'Slept in a bed.', 'Beds skip the night.', 'red_bed'],
    ['village', 'Neighbours', 'Found a village.', 'Follow the chimney smoke and the lamps.', 'vx_lamppost'],
    ['villager', 'Hello, Friend', 'Talked to a villager.', 'Right-click someone in a village.', 'vx_bed_red'],
    ['quest', 'Good Samaritan', 'Helped a villager with a request.', 'Ask "Can I help?"', 'emerald'],
    ['home', 'Home Builder', 'A family moved into a house you built.', 'Near a village: walls, a roof, a door and a bed.', 'vx_bed_blue'],
    ['festival', 'Lantern Night', 'Joined a Lantern Festival.', 'Villages celebrate every third evening.', 'lantern'],
    ['autopilot', 'Sky Taxi', 'Let the autopilot fly you to another village.', 'Press G in a starship.', 'shuttle_beacon'],
  ];
  const INV_TRIGGERS = { oak_log: 'log', birch_log: 'log', spruce_log: 'log', jungle_log: 'log', acacia_log: 'log', dark_oak_log: 'log', cherry_log: 'log', mangrove_log: 'log', cobblestone: 'stone', iron_ingot: 'iron', diamond: 'diamond', crystal_shard_violet: 'crystal', crystal_shard_azure: 'crystal', crystal_shard_verdant: 'crystal', crystal_shard_rose: 'crystal', crystal_shard_amber: 'crystal', aether_bucket: 'aether', star_core: 'star_core', laser_blaster: 'blaster', crafting_table: 'table', torch: 'torch', furnace: 'furnace' };

  class Codex {
    constructor(g, meta) {
      this.g = g;
      this.meta = meta || {};
      this.found = Object.assign({}, this.meta.codex || {});
      this.entries = [];
      this.byId = new Map();
      const add = (id, cat, name, desc, hint, icon) => { const e = { id, cat, name, desc, hint, icon }; this.entries.push(e); this.byId.set(id, e); };
      for (const [id, n, d, h, ic] of MILESTONES) add('m:' + id, 'Milestones', n, d, h, ic);
      for (const k in VR.MOBS || {}) { if (VR.MOBS[k] === VR.MOBS.glimmer_deer && k !== 'glimmer_deer') continue; add('c:' + k, 'Creatures', title(k), 'Encountered a ' + title(k) + '.', 'A creature yet to be met.', 'egg_' + k); }
      for (const b of VR.BIOMES) {
        const cat = b.realm ? 'Realm Biomes' : b.cave ? 'Caves' : b.forge ? 'Underforge' : b.hollow ? 'The Hollow' : b.drift ? 'Drift Isles' : 'Overworld Biomes';
        add('b:' + b.key, cat, b.name, 'Discovered ' + b.name + '.', 'An unexplored ' + (cat === 'Caves' ? 'cave' : 'land') + '.', null);
      }
      this.t = 0; this.nightStart = null;
      this.seen = new Set();
    }
    unlock(id) {
      if (this.found[id]) return false;
      const e = this.byId.get(id); if (!e) return false;
      this.found[id] = Date.now();
      const g = this.g;
      if (g.settings.toasts !== false && g.ui) g.ui.toast(e.cat === 'Milestones' ? 'Milestone' : 'Discovered', e.name, e.icon && VR.itemDef(e.icon) ? e.icon : null);
      else if (g.audio) g.audio.play('achievement');
      if (g.audio && e.cat === 'Milestones') g.audio.play('achievement');
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
    list() {
      const order = ['Milestones', 'Creatures', 'Realm Biomes', 'Overworld Biomes', 'Caves', 'Underforge', 'The Hollow', 'Drift Isles'];
      return this.entries.map(e => Object.assign({ found: !!this.found[e.id] }, e)).sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat));
    }
    toJSON() { return this.found; }
  }
  VR.Codex = Codex;
})(VR);
