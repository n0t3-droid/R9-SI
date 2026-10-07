// ============================================================================
// Block simulation at 20 TPS: fluids (water/lava/aether), falling blocks,
// random ticks (growth, spread, decay, melt), fire, TNT & explosions,
// volt circuits (levers, buttons, plates, torches, dust, lamps, doors, pistons).
// Zen Builder can switch world physics off entirely.
// ============================================================================
(function (VR) {
  'use strict';
  // the player's language (lang_de.js / lang_en.js)
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const R = VR.R, F = VR.F, SH = VR.SHAPE;
  const TICK = 0.05;
  // a string key: packing x, z (±2^25) and y into one number lost the low bits (y) beyond 2^53
  const key3 = (x, y, z) => x + ',' + y + ',' + z;
  const DX6 = [1, -1, 0, 0, 0, 0], DY6 = [0, 0, 1, -1, 0, 0], DZ6 = [0, 0, 0, 0, 1, -1];

  class Sim {
    constructor(game) {
      this.game = game;
      this.tick = 0; this.acc = 0;
      this.sched = new VR.Heap(); this.schedKeys = new Set();
      this.t = {}; // cached type ids
      const T = (n) => R.byName[n] ? R.byName[n].id : -1;
      for (const n of ['water', 'lava', 'aether', 'fire', 'spirit_fire', 'tnt', 'grass_block', 'dirt', 'farmland', 'ice', 'snow', 'volt_wire', 'lever', 'volt_lamp', 'volt_torch', 'volt_block', 'obsidian', 'cobblestone', 'stone', 'mycelium', 'sugar_cane', 'cactus', 'bamboo', 'kelp', 'depth_charge', 'piston', 'sticky_piston', 'piston_head', 'note_block', 'target', 'daylight_detector', 'repeater', 'observer', 'powered_rail', 'activator_rail', 'detector_rail']) this.t[n] = T(n);
      this.physics = true;
      this.plates = new Map();
    }
    get enabled() { const g = this.game; return !(g.player && g.player.mode === 'zen' && !g.zenPhysics); }
    typeOf(s) { return R.T.type[s]; }
    schedule(x, y, z, delay, kind) {
      const k = key3(x, y, z) + ':' + (kind === 'unpress' ? 1 : kind === 'volt' ? 2 : kind === 'tnt' ? 3 : 0);
      if (this.schedKeys.has(k)) return;
      this.schedKeys.add(k);
      this.sched.push({ x, y, z, kind: kind || 'block', k }, this.tick + Math.max(1, delay | 0));
    }
    // ---------------------------------------------------------------- change hooks
    onBlockChanged(x, y, z, old, s) {
      if (!this.enabled) return;
      // neighbor updates: fluids, gravity, support, volt
      for (let d = 0; d < 6; d++) this.neighborUpdate(x + DX6[d], y + DY6[d], z + DZ6[d]);
      this.neighborUpdate(x, y, z);
      if (this.isVolt(old) || this.isVolt(s) || this.voltNear(x, y, z)) this.schedule(x, y, z, 1, 'volt');
    }
    neighborUpdate(x, y, z) {
      const w = this.game.world, s = w.getBlock(x, y, z);
      if (!s) return;
      const fl = R.T.flags[s];
      if (fl & F.FLUID) { this.schedule(x, y, z, this.fluidDelay(s)); return; }
      if (fl & F.FALLING) { const b = w.getBlock(x, y - 1, z); if (!b || (R.T.flags[b] & (F.REPLACE | F.FLUID)) && !(R.T.flags[b] & F.SOLID)) this.schedule(x, y, z, 2); return; }
      if (fl & F.PLANT || this.needsSupport(s)) this.schedule(x, y, z, 1);
    }
    needsSupport(s) { const t = R.types[R.T.type[s]]; if (!t) return false; const k = t.o.kind; return k === 'torch' || k === 'lever' || k === 'button' || k === 'rail' || k === 'wire' || k === 'door' || k === 'carpet' || t.name === 'volt_wire' || t.name === 'snow'; }
    fluidDelay(s) { const t = R.T.type[s]; return t === this.t.lava ? (this.game.dim === 'underforge' ? 10 : 30) : t === this.t.aether ? 4 : 5; }

    // ---------------------------------------------------------------- main update
    update(dt) {
      this.acc += dt;
      let n = 0;
      while (this.acc >= TICK && n < 4) { this.acc -= TICK; this.step(); n++; }
      if (n >= 4) this.acc = 0;
    }
    step() {
      this.tick++;
      const g = this.game;
      if (!this.enabled) { this.sched.clear(); this.schedKeys.clear(); return; }
      // scheduled
      let budget = 600;
      while (this.sched.size && this.sched.peekPri() <= this.tick && budget-- > 0) {
        const e = this.sched.pop();
        this.schedKeys.delete(e.k);
        this.run(e);
      }
      // random ticks around player
      this.randomTicks(3);
      // pressure plates (entities standing on them)
      if (this.tick % 4 === 0) this.checkPlates();
      // automatic sliding doors
      if (this.tick % 3 === 0) this.slidingDoors();
      void g;
    }
    run(e) {
      const w = this.game.world;
      const s = w.getBlock(e.x, e.y, e.z);
      if (e.kind === 'unpress') { const t = R.types[R.T.type[s]]; if (t && t.has('powered') && (t.o.kind === 'button' || t.o.kind === 'plate')) { w.setBlock(e.x, e.y, e.z, t.with(s, 'powered', 0), 4); this.schedule(e.x, e.y, e.z, 1, 'volt'); } return; }
      if (e.kind === 'volt') { this.volt(e.x, e.y, e.z); return; }
      if (e.kind === 'tnt') { this.explode(e.x + 0.5, e.y + 0.5, e.z + 0.5, 4, true); return; }
      if (!s) return;
      const fl = R.T.flags[s];
      if (fl & F.FLUID) { this.fluid(e.x, e.y, e.z, s); return; }
      if (fl & F.FALLING) { const b = w.getBlock(e.x, e.y - 1, e.z); if (!b || ((R.T.flags[b] & (F.REPLACE | F.FLUID)) && !(R.T.flags[b] & F.SOLID))) { w.setBlock(e.x, e.y, e.z, 0, 4); this.game.entities && this.game.entities.spawnFalling(e.x, e.y, e.z, s, true); } return; }
      if ((fl & F.PLANT) || this.needsSupport(s)) this.checkSupport(e.x, e.y, e.z, s);
    }
    checkSupport(x, y, z, s) {
      const w = this.game.world, t = R.types[R.T.type[s]];
      if (!t) return;
      const below = w.getBlock(x, y - 1, z);
      let ok = true;
      if (R.T.flags[s] & F.PLANT) ok = !!below && (!!(R.T.flags[below] & F.SOLID) || R.T.type[below] === R.T.type[s] || (t.o.tall && t.get(s, 'half') === 1 && R.T.type[below] === R.T.type[s]));
      if (t.o.tall && t.has('half') && t.get(s, 'half') === 1) ok = R.T.type[below] === R.T.type[s];
      if (t.o.kind === 'torch') { const f = t.get(s, 'face'); if (f === 0) ok = !!(R.T.flags[below] & F.SOLID); else { const d = f - 1; const bx = x - VR.HF_DX[d], bz = z - VR.HF_DZ[d]; ok = !!(R.T.flags[w.getBlock(bx, y, bz)] & F.SOLID); } }
      if (t.name === 'volt_wire' || t.o.kind === 'rail' || t.name === 'snow') ok = !!(R.T.flags[below] & F.SOLID);
      if (!ok) { w.setBlock(x, y, z, 0, 4); if (this.game.player.mode === 'survival') this.game.dropsFor(x, y, z, s, null); this.game.particles.breakBlock(x, y, z, s); }
    }

    // ---------------------------------------------------------------- fluids
    fluid(x, y, z, s) {
      const w = this.game.world, T = R.T;
      const type = T.type[s], t = R.types[type];
      const isLava = type === this.t.lava;
      let lvl = t.get(s, 'level');
      const same = (b) => T.type[b] === type;
      const lvOf = (b) => same(b) ? t.get(b, 'level') : -1;
      const above = w.getBlock(x, y + 1, z);
      // 1) recompute level for flowing blocks
      if (lvl !== 0) {
        let want = 99;
        if (same(above)) want = 8;
        else {
          let sources = 0;
          for (let d = 0; d < 4; d++) {
            const nb = w.getBlock(x + VR.HF_DX[d], y, z + VR.HF_DZ[d]);
            const nl = lvOf(nb);
            if (nl === 0) sources++;
            if (nl >= 0) want = Math.min(want, nl >= 8 ? 1 : nl + (isLava ? 2 : 1));
          }
          const below = w.getBlock(x, y - 1, z);
          if (sources >= 2 && !isLava && ((T.flags[below] & F.SOLID) || lvOf(below) === 0)) want = 0;
        }
        if (want > 7 && want !== 8) { w.setBlock(x, y, z, 0, 4); return; }
        if (want !== lvl) { lvl = want; s = t.with(s, 'level', lvl); w.setBlock(x, y, z, s, 4); }
      }
      // 2) interactions (lava + water)
      if (isLava) {
        for (let d = 0; d < 6; d++) {
          if (d === 3) continue;
          const nb = w.getBlock(x + DX6[d], y + DY6[d], z + DZ6[d]);
          if (T.flags[nb] & F.WATER && (T.flags[nb] & F.FLUID)) {
            w.setBlock(x, y, z, lvl === 0 ? R.byName.obsidian.defaultState : R.byName.cobblestone.defaultState, 4);
            this.game.particles.smoke(x + 0.5, y + 1, z + 0.5, 6); this.game.audio.play('zap');
            return;
          }
        }
      }
      // 3) spread down
      const below = w.getBlock(x, y - 1, z);
      const canFlow = (b) => !b || ((T.flags[b] & F.REPLACE) && !(T.flags[b] & F.FLUID) && !(T.flags[b] & F.SOLID));
      if (y > 0) {
        if (canFlow(below)) { if (below) { this.game.particles.breakBlock(x, y - 1, z, below); } w.setBlock(x, y - 1, z, t.with(t.defaultState, 'level', 8), 4); return; }
        if (isLava && (T.flags[below] & F.WATER) && (T.flags[below] & F.FLUID)) { w.setBlock(x, y - 1, z, R.byName.stone.defaultState, 4); return; }
        if (same(below) && lvOf(below) !== 0 && lvOf(below) < 8) { w.setBlock(x, y - 1, z, t.with(below, 'level', 8), 4); return; }
      }
      // 4) spread sideways
      const next = lvl >= 8 ? 1 : lvl + (isLava ? 2 : 1);
      if (next > 7) return;
      if (same(below) || !(T.flags[below] & F.SOLID) && !canFlow(below) && !(T.flags[below] & F.FLUID)) { /* on fluid or odd surface: still spread */ }
      // prefer directions leading to a drop within 4 blocks
      const dirs = [0, 1, 2, 3];
      const score = dirs.map((d) => {
        for (let k = 1; k <= 4; k++) {
          const px = x + VR.HF_DX[d] * k, pz = z + VR.HF_DZ[d] * k;
          const b = w.getBlock(px, y, pz);
          if (!canFlow(b) && !same(b)) return 99;
          if (canFlow(w.getBlock(px, y - 1, pz))) return k;
        }
        return 50;
      });
      const best = Math.min(...score);
      for (const d of dirs) {
        if (best < 50 && score[d] !== best) continue;
        const nx = x + VR.HF_DX[d], nz = z + VR.HF_DZ[d];
        const nb = w.getBlock(nx, y, nz);
        if (canFlow(nb)) { if (nb) { if (this.game.player.mode === 'survival') this.game.dropsFor(nx, y, nz, nb, null); } w.setBlock(nx, y, nz, t.with(t.defaultState, 'level', next), 4); }
        else if (same(nb)) { const nl = lvOf(nb); if (nl > next && nl < 8) w.setBlock(nx, y, nz, t.with(nb, 'level', next), 4); }
        else if (isLava && (T.flags[nb] & F.WATER) && (T.flags[nb] & F.FLUID)) w.setBlock(nx, y, nz, R.byName.cobblestone.defaultState, 4);
      }
    }

    // ---------------------------------------------------------------- random ticks
    randomTicks(per) {
      const g = this.game, w = g.world, p = g.player;
      const pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4, psy = Math.floor(p.pos[1]) >> 4;
      const R2 = 5;
      for (let dz = -R2; dz <= R2; dz++) for (let dx = -R2; dx <= R2; dx++) {
        const c = w.col(pcx + dx, pcz + dz);
        if (!c) continue;
        for (let sy = Math.max(0, psy - 4); sy <= Math.min(c.sec.length - 1, psy + 4); sy++) {
          if (!c.sec[sy].count) continue;
          for (let k = 0; k < per; k++) {
            const r = (Math.random() * 4096) | 0;
            const i = (sy << 12) | r;
            const s = c.blocks[i];
            if (!s || !(R.T.flags[s] & F.RANDTICK) && !this.randomAlways(s)) continue;
            const x = c.cx * 16 + (i & 15), z = c.cz * 16 + ((i >> 4) & 15), y = i >> 8;
            this.randomTick(x, y, z, s);
          }
        }
      }
    }
    randomAlways(s) { const ty = R.T.type[s]; return ty === this.t.grass_block || ty === this.t.fire || ty === this.t.ice || (R.T.flags[s] & F.LEAVES) || ty === this.t.farmland; }
    randomTick(x, y, z, s) {
      const g = this.game, w = g.world, T = R.T, ty = T.type[s], t = R.types[ty];
      const light = w.getLight(x, y + 1, z), sky = light >>> 12, blk = Math.max((light >> 8) & 15, (light >> 4) & 15, light & 15);
      const bright = Math.max(Math.round(sky * g.skyBright), blk);
      if (ty === this.t.grass_block) {
        const above = w.getBlock(x, y + 1, z);
        if (above && (T.flags[above] & F.OPAQUE)) {
          // covered grass dies — but only where a side still shows (towns and roads bury thousands of grass blocks;
          // converting the invisible ones would just remesh and re-save columns for nothing)
          let seen = false;
          for (let d = 0; d < 4 && !seen; d++) { const nb = w.getBlock(x + VR.HF_DX[d], y, z + VR.HF_DZ[d]); if (!nb || !(T.flags[nb] & F.OPAQUE)) seen = true; }
          if (seen) w.setBlock(x, y, z, R.byName.dirt.defaultState, 1);
          return;
        }
        if (bright >= 9) for (let k = 0; k < 2; k++) {
          const nx = x + ((Math.random() * 3) | 0) - 1, ny = y + ((Math.random() * 5) | 0) - 3, nz = z + ((Math.random() * 3) | 0) - 1;
          if (w.getBlock(nx, ny, nz) === R.byName.dirt.defaultState && !(T.flags[w.getBlock(nx, ny + 1, nz)] & F.OPAQUE)) w.setBlock(nx, ny, nz, s, 1);
        }
        return;
      }
      if (T.flags[s] & F.LEAVES) {
        if (!t.has('persistent') || t.get(s, 'persistent')) return;
        // decay when no log within 5 blocks
        for (let dy = -4; dy <= 4; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
          const b = w.getBlock(x + dx, y + dy, z + dz);
          if (b && /(_log|_stem|_wood|mushroom_stem)$/.test(R.types[T.type[b]] ? R.types[T.type[b]].name : '')) return;
        }
        w.setBlock(x, y, z, 0, 4);
        if (g.player.mode === 'survival' && Math.random() < 0.06) g.dropStack({ id: Math.random() < 0.5 ? 'stick' : (R.byName[t.name.replace('_leaves', '_sapling')] ? t.name.replace('_leaves', '_sapling') : 'apple'), n: 1 }, false, [x + 0.5, y + 0.5, z + 0.5]);
        g.particles.breakBlock(x, y, z, s);
        return;
      }
      if (ty === this.t.fire) { this.fireTick(x, y, z, s, t); return; }
      if (ty === this.t.ice) { if (blk > 11) w.setBlock(x, y, z, R.byName.water.defaultState, 4); return; }
      if (ty === this.t.farmland) { const wet = t.has('moisture') ? t.get(s, 'moisture') : 0; void wet; return; }
      if (t.o.maxAge !== undefined && t.has('age')) { const age = t.get(s, 'age'); if (age < t.o.maxAge && bright >= 9 && Math.random() < 0.3) w.setBlock(x, y, z, t.with(s, 'age', age + 1), 4); return; }
      if (t.o.sapling && bright >= 9) {
        if (t.has('stage') && t.get(s, 'stage') === 0) { w.setBlock(x, y, z, t.with(s, 'stage', 1), 1); return; }
        this.growTree(x, y, z, t.o.sapling);
        return;
      }
      if (ty === this.t.sugar_cane || ty === this.t.cactus || ty === this.t.bamboo) {
        let h = 1; while (T.type[w.getBlock(x, y - h, z)] === ty) h++;
        if (h < (ty === this.t.bamboo ? 12 : 3) && !w.getBlock(x, y + 1, z) && Math.random() < 0.25) w.setBlock(x, y + 1, z, t.defaultState, 4);
        return;
      }
      if (t.o.oxidizes && t.has('stage') && !t.get(s, 'waxed') && Math.random() < 0.02) { const st = t.get(s, 'stage'); if (st < 3) w.setBlock(x, y, z, t.with(s, 'stage', st + 1), 1); return; }
      if (t.o.litOre && t.get(s, 'lit')) { w.setBlock(x, y, z, t.with(s, 'lit', 0), 4); return; }
    }
    growTree(x, y, z, kind) {
      const g = this.game, w = g.world;
      const writer = { get: (a, b, c) => w.getBlock(a, b, c), ok: () => true, set: (a, b, c, s) => w.setBlock(a, b, c, s, 2), place: (a, b, c, s, mode) => { const cur = w.getBlock(a, b, c); if (!cur || ((R.T.flags[cur] & F.REPLACE) && !(R.T.flags[cur] & F.FLUID)) || (mode === 1 && (R.T.flags[cur] & (F.LEAVES | F.PLANT)))) { w.setBlock(a, b, c, s, 2); return true; } return false; } };
      w.setBlock(x, y, z, 0, 2);
      const T = VR.GEN.TREES, rng = new VR.RNG((Math.random() * 1e9) | 0);
      const f = { oak: T.oak, spruce: T.spruce, birch: T.birch, jungle: T.jungle, acacia: T.acacia, dark_oak: T.darkOak || T.oak, cherry: T.cherry, mangrove: T.mangrove || T.oak, pale_oak: T.paleOak || T.oak, poplar: T.poplar || T.oak, azalea: T.oak, palm: T.palm || T.oak }[kind] || T.oak;
      try { f(writer, x, y, z, rng); } catch (e) { console.warn(e); }
      g.particles.spark(x + 0.5, y + 1, z + 0.5, [0.5, 1, 0.4], 12, 2, 0.3);
    }
    fireTick(x, y, z, s, t) {
      const g = this.game, w = g.world, T = R.T;
      const age = t.get(s, 'age');
      const below = w.getBlock(x, y - 1, z);
      const bt = R.types[T.type[below]];
      const eternal = bt && /netherrack|emberrock|magma|soul|gloom/.test(bt.name);
      if (!eternal && (g.env.rain > 0.5 && (w.getLight(x, y, z) >>> 12) >= 15)) { w.setBlock(x, y, z, 0, 4); return; }
      if (!eternal && age >= 15) { w.setBlock(x, y, z, 0, 4); return; }
      if (!eternal) w.setBlock(x, y, z, t.with(s, 'age', Math.min(15, age + 1 + ((Math.random() * 3) | 0))), 1);
      // burn / spread
      for (let d = 0; d < 6; d++) {
        const nx = x + DX6[d], ny = y + DY6[d], nz = z + DZ6[d];
        const nb = w.getBlock(nx, ny, nz); if (!nb) continue;
        const nt = R.types[T.type[nb]]; if (!nt || !nt.o.flam) continue;
        const [ignite, burn] = nt.o.flam;
        if (Math.random() * 300 < burn) {
          if (nt.name === 'tnt') { this.primeTNT(nx, ny, nz); continue; }
          w.setBlock(nx, ny, nz, Math.random() < 0.4 ? R.byName.fire.defaultState : 0, 4);
        } else if (Math.random() * 100 < ignite) {
          // ignite air next to the flammable block
          for (let e = 0; e < 6; e++) { const ax = nx + DX6[e], ay = ny + DY6[e], az = nz + DZ6[e]; if (!w.getBlock(ax, ay, az) && Math.random() < 0.3) { w.setBlock(ax, ay, az, R.byName.fire.defaultState, 4); break; } }
        }
      }
    }
    ignite(x, y, z) { const w = this.game.world; if (!w.getBlock(x, y, z)) w.setBlock(x, y, z, R.byName.fire.defaultState, 4); }

    // ---------------------------------------------------------------- explosions
    primeTNT(x, y, z) {
      const w = this.game.world;
      w.setBlock(x, y, z, 0, 4);
      if (this.game.entities) this.game.entities.falling.push({ pos: [x + 0.5, y, z + 0.5], vel: [0, 0, 0], state: R.byName.tnt.defaultState, fuse: 3.5, damage: false, tnt: true });
      this.schedule(x, y, z, 70, 'tnt');
      this.game.audio.play('zap');
    }
    explode(cx, cy, cz, power, breaks) {
      const g = this.game, w = g.world, T = R.T;
      if (g.entities) g.entities.falling = g.entities.falling.filter((f) => !(f.tnt && Math.abs(f.pos[0] - cx) < 1 && Math.abs(f.pos[2] - cz) < 1));
      const destroyed = new Map();
      if (breaks && this.enabled) {
        for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) for (let k = 0; k < 16; k++) {
          if (i !== 0 && i !== 15 && j !== 0 && j !== 15 && k !== 0 && k !== 15) continue;
          let dx = i / 15 * 2 - 1, dy = j / 15 * 2 - 1, dz = k / 15 * 2 - 1;
          const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
          let inten = power * (0.7 + Math.random() * 0.6);
          let x = cx, y = cy, z = cz;
          while (inten > 0) {
            const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
            const s = w.getBlock(bx, by, bz);
            if (s) { const res = T.blast[s]; inten -= (res + 0.3) * 0.3; if (inten > 0 && !(T.flags[s] & F.UNBREAK) && res < 1200) destroyed.set(bx + ',' + by + ',' + bz, [bx, by, bz, s]); }
            x += dx * 0.3; y += dy * 0.3; z += dz * 0.3; inten -= 0.225;
          }
        }
        let n = 0;
        for (const [bx, by, bz, s] of destroyed.values()) {
          const t = R.types[T.type[s]];
          if (t && t.name === 'tnt') { w.setBlock(bx, by, bz, 0, 1); this.schedule(bx, by, bz, 10 + ((Math.random() * 20) | 0), 'tnt'); continue; }
          w.setBlock(bx, by, bz, 0, 3);
          if (g.player.mode === 'survival' && Math.random() < 0.3) g.dropsFor(bx, by, bz, s, null);
          if ((n++ & 3) === 0) g.particles.breakBlock(bx, by, bz, s);
        }
        for (const [bx, by, bz] of destroyed.values()) for (let d = 0; d < 6; d++) this.neighborUpdate(bx + DX6[d], by + DY6[d], bz + DZ6[d]);
        // one batched light & remesh pass
        const r = Math.ceil(power) + 2;
        for (let dx = -r; dx <= r; dx += 4) for (let dz = -r; dz <= r; dz += 4) for (let dy = -r; dy <= r; dy += 4) w.markDirtyAround(Math.floor(cx + dx), Math.floor(cy + dy), Math.floor(cz + dz));
        this.relightArea(Math.floor(cx), Math.floor(cy), Math.floor(cz), r);
      }
      g.particles.explosion(cx, cy, cz, power / 4);
      g.audio.play('explode', { vol: Math.min(1.5, power / 4) });
      // damage entities & player
      const p = g.player;
      const hurt = (pos, h, fn) => { const dx = pos[0] - cx, dy = pos[1] + h * 0.5 - cy, dz = pos[2] - cz, d = Math.hypot(dx, dy, dz); if (d < power * 2) { const f = 1 - d / (power * 2); fn(Math.round(f * power * 5), [dx / (d || 1) * f * 14, dy / (d || 1) * f * 10 + 3, dz / (d || 1) * f * 14]); } };
      hurt(p.pos, 1.8, (dmg, v) => { p.damage(dmg, 'explosion'); if (p.mode !== 'zen') { p.vel[0] += v[0]; p.vel[1] += v[1]; p.vel[2] += v[2]; } });
      if (g.entities) for (const m of g.entities.mobs) hurt(m.pos, m.h, (dmg, v) => { g.entities.hurtMob(m, dmg, null); m.vel[0] += v[0]; m.vel[1] += v[1]; m.vel[2] += v[2]; });
      g.shake = Math.min(1, (g.shake || 0) + power / 6);
    }
    relightArea(x, y, z, r) {
      // light was updated per block with flag 3 → skipped; do a coarse re-seed so holes get lit
      const w = this.game.world;
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) for (let dy = -r; dy <= r; dy++) {
        const s = w.getBlock(x + dx, y + dy, z + dz);
        if (!s && dx * dx + dy * dy + dz * dz <= r * r) w.updateLight(x + dx, y + dy, z + dz, R.byName.stone.defaultState, 0);
      }
      w.flushChanged();
    }

    // ---------------------------------------------------------------- volt (simplified redstone)
    isVolt(s) {
      if (!s) return false;
      const t = R.types[R.T.type[s]]; if (!t) return false;
      const k = t.o.kind;
      return k === 'lever' || k === 'button' || k === 'plate' || k === 'wire' || k === 'repeater' || k === 'comparator' || t.name === 'volt_torch' || t.name === 'volt_block' || t.name === 'volt_lamp' || k === 'door' || k === 'trapdoor' || t.name === 'tnt' || t.name === 'piston' || t.name === 'sticky_piston' || t.name === 'note_block' || k === 'target' || k === 'daylight' || k === 'rail';
    }
    voltNear(x, y, z) { const w = this.game.world; for (let d = 0; d < 6; d++) if (this.isVolt(w.getBlock(x + DX6[d], y + DY6[d], z + DZ6[d]))) return true; return false; }
    // power emitted by block s toward neighbor direction d (0..5 from s)
    emits(s, x, y, z) {
      const t = R.types[R.T.type[s]]; if (!t) return 0;
      const k = t.o.kind;
      if (k === 'lever' || k === 'button' || k === 'plate') return t.get(s, 'powered') ? 15 : 0;
      if (t.name === 'volt_torch') return t.get(s, 'lit') ? 15 : 0;
      if (t.name === 'volt_block') return 15;
      if (k === 'target') return t.has('power') ? t.get(s, 'power') : 0;
      if (k === 'daylight') return t.get(s, 'power');
      if (k === 'repeater' || k === 'comparator') return t.get(s, 'powered') ? 15 : 0;
      void x; void y; void z;
      return 0;
    }
    powerAt(x, y, z) {
      // max power arriving at block position from neighbors (sources, wires, powered solid blocks)
      const w = this.game.world, T = R.T;
      let p = 0;
      for (let d = 0; d < 6; d++) {
        const nx = x + DX6[d], ny = y + DY6[d], nz = z + DZ6[d];
        const s = w.getBlock(nx, ny, nz); if (!s) continue;
        const t = R.types[T.type[s]];
        if (t && t.name === 'volt_wire') p = Math.max(p, t.get(s, 'power'));
        else p = Math.max(p, this.emits(s, nx, ny, nz));
        // strong power through solid blocks next to sources (one hop)
        if ((T.flags[s] & F.OPAQUE) && p < 15) for (let e = 0; e < 6; e++) { const s2 = w.getBlock(nx + DX6[e], ny + DY6[e], nz + DZ6[e]); if (s2 && (nx + DX6[e] !== x || ny + DY6[e] !== y || nz + DZ6[e] !== z)) { const t2 = R.types[T.type[s2]]; if (t2 && (t2.o.kind === 'lever' || t2.o.kind === 'button' || t2.o.kind === 'plate' || t2.name === 'volt_torch' && e === 3)) p = Math.max(p, this.emits(s2)); } }
      }
      return p;
    }
    volt(x, y, z) {
      const w = this.game.world, T = R.T;
      // recompute wire network around (x,y,z) with BFS
      const wireT = R.byName.volt_wire;
      const seen = new Set(), wires = [];
      const q = [[x, y, z]];
      for (let d = 0; d < 6; d++) q.push([x + DX6[d], y + DY6[d], z + DZ6[d]]);
      while (q.length && wires.length < 400) {
        const [a, b, c] = q.pop();
        const k = a + ',' + b + ',' + c; if (seen.has(k)) continue; seen.add(k);
        const s = w.getBlock(a, b, c);
        if (!s || T.type[s] !== wireT.id) continue;
        wires.push([a, b, c]);
        for (let d = 0; d < 4; d++) for (const dy of [0, 1, -1]) q.push([a + VR.HF_DX[d], b + dy, c + VR.HF_DZ[d]]);
      }
      // reset & propagate from sources
      const level = new Map();
      for (const [a, b, c] of wires) level.set(a + ',' + b + ',' + c, 0);
      const pq = [];
      for (const [a, b, c] of wires) {
        let src = 0;
        for (let d = 0; d < 6; d++) { const s = w.getBlock(a + DX6[d], b + DY6[d], c + DZ6[d]); if (s && T.type[s] !== wireT.id) src = Math.max(src, this.emits(s)); }
        if (src) { level.set(a + ',' + b + ',' + c, src); pq.push([a, b, c, src]); }
      }
      while (pq.length) {
        const [a, b, c, v] = pq.shift();
        if (v <= 1) continue;
        for (let d = 0; d < 4; d++) for (const dy of [0, 1, -1]) {
          const k = (a + VR.HF_DX[d]) + ',' + (b + dy) + ',' + (c + VR.HF_DZ[d]);
          if (!level.has(k)) continue;
          if (level.get(k) < v - 1) { level.set(k, v - 1); pq.push([a + VR.HF_DX[d], b + dy, c + VR.HF_DZ[d], v - 1]); }
        }
      }
      const changed = [];
      for (const [a, b, c] of wires) { const s = w.getBlock(a, b, c); const nv = level.get(a + ',' + b + ',' + c); if (wireT.get(s, 'power') !== nv) { w.setBlock(a, b, c, wireT.with(s, 'power', nv), 3); changed.push([a, b, c]); } }
      // update consumers around the wires and the origin
      const cons = new Set();
      const addAround = (a, b, c) => { for (let d = 0; d < 6; d++) cons.add((a + DX6[d]) + ',' + (b + DY6[d]) + ',' + (c + DZ6[d])); cons.add(a + ',' + b + ',' + c); };
      addAround(x, y, z); for (const [a, b, c] of wires) addAround(a, b, c);
      for (const k of cons) { const [a, b, c] = k.split(',').map(Number); this.updateConsumer(a, b, c); }
    }
    updateConsumer(x, y, z) {
      const g = this.game, w = g.world, T = R.T;
      const s = w.getBlock(x, y, z); if (!s) return;
      const t = R.types[T.type[s]]; if (!t) return;
      const k = t.o.kind;
      const powered = () => this.powerAt(x, y, z) > 0 || (k === 'door' && (this.powerAt(x, y + (t.get(s, 'half') ? -1 : 1), z) > 0));
      if (t.name === 'volt_lamp') { const on = powered() ? 1 : 0; if (t.get(s, 'lit') !== on) w.setBlock(x, y, z, t.with(s, 'lit', on), 4); }
      else if (k === 'door' || k === 'trapdoor' || k === 'gate') {
        const on = powered() ? 1 : 0;
        if (t.has('open') && t.get(s, 'open') !== on) { w.setBlock(x, y, z, t.with(s, 'open', on), 4); if (k === 'door') { const oy = t.get(s, 'half') ? -1 : 1; const o2 = w.getBlock(x, y + oy, z); if (T.type[o2] === t.id) w.setBlock(x, y + oy, z, t.with(o2, 'open', on), 4); } g.audio.play('door'); }
      }
      else if (t.name === 'tnt') { if (powered()) this.primeTNT(x, y, z); }
      else if (t.name === 'volt_torch') {
        // inverted by the block it's attached to
        const f = t.get(s, 'face'); const ax = f === 0 ? x : x - VR.HF_DX[f - 1], ay = f === 0 ? y - 1 : y, az = f === 0 ? z : z - VR.HF_DZ[f - 1];
        const att = w.getBlock(ax, ay, az);
        let p = 0; if (att && (T.flags[att] & F.OPAQUE)) { for (let d = 0; d < 6; d++) { const s2 = w.getBlock(ax + DX6[d], ay + DY6[d], az + DZ6[d]); if (!s2 || (ax + DX6[d] === x && ay + DY6[d] === y && az + DZ6[d] === z)) continue; const t2 = R.types[T.type[s2]]; if (t2 && t2.name === 'volt_wire') p = Math.max(p, t2.get(s2, 'power')); else p = Math.max(p, this.emits(s2)); } }
        const lit = p > 0 ? 0 : 1;
        if (t.get(s, 'lit') !== lit) { w.setBlock(x, y, z, t.with(s, 'lit', lit), 4); this.schedule(x, y, z, 2, 'volt'); }
      }
      else if (t.name === 'piston' || t.name === 'sticky_piston') this.piston(x, y, z, s, t, powered());
      else if (t.name === 'note_block') { const on = powered(); const was = t.get(s, 'powered'); if (on && !was) this.playNote(x, y, z, t.get(s, 'note')); if ((on ? 1 : 0) !== was) w.setBlock(x, y, z, t.with(s, 'powered', on ? 1 : 0), 1); }
      else if (t.o.kind === 'rail' && t.has('powered')) { const on = powered() ? 1 : 0; if (t.get(s, 'powered') !== on) w.setBlock(x, y, z, t.with(s, 'powered', on), 4); }
    }
    playNote(x, y, z, note) {
      const a = this.game.audio; if (!a.ctx) return;
      a.tone(440 * Math.pow(2, (note - 12) / 12), 0.25, 0.8, 'triangle', true);
      this.game.particles.glow(x + 0.5, y + 1.2, z + 0.5, [Math.random(), 1, Math.random()], 1, 0.15, 1);
    }
    piston(x, y, z, s, t, on) {
      const w = this.game.world, T = R.T;
      const f = t.get(s, 'facing'), ext = t.get(s, 'extended');
      const DIR = [[0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 1, 0], [0, -1, 0]][f];
      if (on && !ext) {
        // push up to 12 blocks
        const line = [];
        let cx = x + DIR[0], cy = y + DIR[1], cz = z + DIR[2];
        for (let i = 0; i < 13; i++) {
          const b = w.getBlock(cx, cy, cz);
          if (!b || (T.flags[b] & F.REPLACE)) break;
          if (i === 12 || T.flags[b] & F.UNBREAK || T.type[b] === R.byName.obsidian.id || T.hard[b] < 0) return;
          line.push(b); cx += DIR[0]; cy += DIR[1]; cz += DIR[2];
        }
        for (let i = line.length - 1; i >= 0; i--) w.setBlock(x + DIR[0] * (i + 2), y + DIR[1] * (i + 2), z + DIR[2] * (i + 2), line[i], 4);
        w.setBlock(x, y, z, t.with(s, 'extended', 1), 4);
        const head = R.byName.piston_head;
        w.setBlock(x + DIR[0], y + DIR[1], z + DIR[2], head.state({ facing: f, sticky: t.name === 'sticky_piston' ? 1 : 0 }), 4);
        this.game.audio.play('door');
      } else if (!on && ext) {
        w.setBlock(x, y, z, t.with(s, 'extended', 0), 4);
        const hx = x + DIR[0], hy = y + DIR[1], hz = z + DIR[2];
        if (T.type[w.getBlock(hx, hy, hz)] === R.byName.piston_head.id) w.setBlock(hx, hy, hz, 0, 4);
        if (t.name === 'sticky_piston') { const b = w.getBlock(hx + DIR[0], hy + DIR[1], hz + DIR[2]); if (b && !(T.flags[b] & F.UNBREAK) && !(T.flags[b] & F.FLUID)) { w.setBlock(hx + DIR[0], hy + DIR[1], hz + DIR[2], 0, 4); w.setBlock(hx, hy, hz, b, 4); } }
        this.game.audio.play('door');
      }
    }
    checkPlates() {
      const g = this.game, w = g.world, p = g.player;
      const bodies = [p.pos]; if (g.entities) for (const m of g.entities.mobs) bodies.push(m.pos);
      const now = new Set();
      for (const pos of bodies) {
        const x = Math.floor(pos[0]), y = Math.floor(pos[1] + 0.05), z = Math.floor(pos[2]);
        const s = w.getBlock(x, y, z); const t = R.types[R.T.type[s]];
        if (t && t.o.kind === 'plate') { now.add(x + ',' + y + ',' + z); if (!t.get(s, 'powered')) { w.setBlock(x, y, z, t.with(s, 'powered', 1), 4); this.schedule(x, y, z, 1, 'volt'); g.audio.play('click'); } }
      }
      for (const [k, v] of this.plates) if (!now.has(k)) { const [x, y, z] = v; const s = w.getBlock(x, y, z); const t = R.types[R.T.type[s]]; if (t && t.o.kind === 'plate' && t.get(s, 'powered')) { w.setBlock(x, y, z, t.with(s, 'powered', 0), 4); this.schedule(x, y, z, 1, 'volt'); } this.plates.delete(k); }
      for (const k of now) this.plates.set(k, k.split(',').map(Number));
    }

    // ---------------------------------------------------------------- automatic sliding doors (v0.33.2)
    // The voxel glass doors ('mdoor': shops, modern houses) slide open when the player comes within reach and close
    // behind them a little later; a door group (panels side by side, stacked) moves together.
    slidingDoors() {
      const g = this.game, w = g.world, p = g.player; if (!w || !p || !p.pos) return;
      if (!this.mdoorS) { const n = R.T.type.length; this.mdoorS = new Uint8Array(n); for (const t of R.types) if (t && t.o.vx && t.o.vx.kind === 'mdoor' && t.has('open')) for (let k = t.base; k < t.base + t.nstates; k++) this.mdoorS[k] = 1; }
      const M = this.mdoorS, open = this.slides || (this.slides = new Map()), q = p.pos, now = this.tick;
      const setOpen = (cells, v) => { let n = 0; for (const c of cells) { const s = w.getBlock(c[0], c[1], c[2]); if (!M[s]) continue; const t = R.types[R.T.type[s]]; if (t.get(s, 'open') !== v) { w.setBlock(c[0], c[1], c[2], t.with(s, 'open', v), 4); n++; } } return n; };
      for (let y = Math.floor(q[1]) - 1; y <= Math.floor(q[1] + 1.8); y++) for (let z = Math.floor(q[2] - 5); z <= Math.floor(q[2] + 5); z++) for (let x = Math.floor(q[0] - 5); x <= Math.floor(q[0] + 5); x++) {
        const s = w.getBlock(x, y, z); if (!M[s]) continue;
        const t = R.types[R.T.type[s]], k = x + ',' + y + ',' + z;
        if (Math.hypot(x + 0.5 - q[0], z + 0.5 - q[2]) <= 1.9 && y <= q[1] + 1.8 && y + 1 >= q[1]) {
          // near: the whole door group opens (and stays open while someone is here)
          const cells = this.slideGroup(x, y, z, s);
          if (!t.get(s, 'open') && setOpen(cells, 1) && g.audio) g.audio.play('door');
          for (const c of cells) open.set(c.join(','), now);
        } else if (t.get(s, 'open') && !open.has(k)) open.set(k, now);   // left open (a save, a friend): closes when nobody is near
      }
      for (const [k, t0] of open) {
        if (now - t0 < 12) continue;
        open.delete(k);
        const c = k.split(',').map(Number), d = Math.hypot(c[0] + 0.5 - q[0], c[2] + 0.5 - q[2]);
        if (d > 32) continue;
        if (setOpen([c], 0) && d < 12 && g.audio && (c[1] === Math.floor(q[1]) || Math.random() < 0.3)) g.audio.play('door');
      }
    }
    slideGroup(x, y, z, s) {
      const w = this.game.world, id = R.T.type[s], out = [], seen = new Set([x + ',' + y + ',' + z]), q = [[x, y, z]];
      while (q.length && out.length < 12) {
        const c = q.shift(); out.push(c);
        for (let d = 0; d < 6; d++) {
          const nx = c[0] + VR.DX[d], ny = c[1] + VR.DY[d], nz = c[2] + VR.DZ[d], k = nx + ',' + ny + ',' + nz;
          if (seen.has(k)) continue; seen.add(k);
          if (Math.abs(nx - x) > 2 || Math.abs(ny - y) > 2 || Math.abs(nz - z) > 2) continue;
          if (R.T.type[w.getBlock(nx, ny, nz)] === id) q.push([nx, ny, nz]);
        }
      }
      return out;
    }

    // ---------------------------------------------------------------- interactions routed from game
    interact(x, y, z, s, t, p) {
      const g = this.game, w = g.world;
      const held = p.inv.held, hd = held ? VR.itemDef(held.id) : null;
      if (t.name === 'tnt' && hd && hd.use === 'ignite') { this.primeTNT(x, y, z); p.damageHeld(1); return true; }
      if (t.name === 'note_block') { const n = (t.get(s, 'note') + 1) % 25; w.setBlock(x, y, z, t.with(s, 'note', n), 1); this.playNote(x, y, z, n); return true; }
      if (t.name === 'repeater') { const d = (t.get(s, 'delay') + 1) % 4; w.setBlock(x, y, z, t.with(s, 'delay', d), 4); g.audio.play('click'); return true; }
      if (t.o.kind === 'button' || t.o.kind === 'lever') { this.schedule(x, y, z, 1, 'volt'); return false; }
      if (hd && hd.use === 'ignite') { const fx = x + VR.DX[p.target.face], fy = y + VR.DY[p.target.face], fz = z + VR.DZ[p.target.face]; this.ignite(fx, fy, fz); p.damageHeld(1); g.audio.play('zap'); return true; }
      if (hd && hd.id === 'bone_meal') {
        if (t.o.maxAge !== undefined && t.has('age')) { w.setBlock(x, y, z, t.with(s, 'age', Math.min(t.o.maxAge, t.get(s, 'age') + 2 + ((Math.random() * 3) | 0))), 4); if (!p.creative) p.inv.consumeHeld(1); g.particles.spark(x + 0.5, y + 0.5, z + 0.5, [0.5, 1, 0.4], 10, 2, 0.3); return true; }
        if (t.o.sapling) { this.growTree(x, y, z, t.o.sapling); if (!p.creative) p.inv.consumeHeld(1); return true; }
        if (t.name === 'grass_block') { for (let k = 0; k < 18; k++) { const ax = x + ((Math.random() * 7) | 0) - 3, az = z + ((Math.random() * 7) | 0) - 3; if (R.T.type[w.getBlock(ax, y, az)] === t.id && !w.getBlock(ax, y + 1, az)) w.setBlock(ax, y + 1, az, Math.random() < 0.85 ? R.byName.short_grass.defaultState : R.byName[['poppy', 'dandelion', 'cornflower', 'allium'][(Math.random() * 4) | 0]].defaultState, 4); } if (!p.creative) p.inv.consumeHeld(1); return true; }
      }
      if (hd && hd.tool === 'hoe' && (t.name === 'grass_block' || t.name === 'dirt') && !w.getBlock(x, y + 1, z)) { w.setBlock(x, y, z, R.byName.farmland.defaultState, 4); g.audio.place(s); p.damageHeld(1); return true; }
      if (hd && hd.tool === 'axe' && /_log$/.test(t.name) && R.byName['stripped_' + t.name]) { const st = R.byName['stripped_' + t.name]; w.setBlock(x, y, z, st.with(st.defaultState, 'axis', t.get(s, 'axis')), 4); g.audio.place(s); p.damageHeld(1); return true; }
      // the shovel makes a path of cut grass — and of any grass in the Klassisch look, where natural ground keeps its
      // cube shape anyway (no cut / smooth toggle there: it would change nothing you can see)
      if (hd && hd.tool === 'shovel' && (t.name === 'grass_block_cut' || (t.name === 'grass_block' && VR.LOOK && !VR.LOOK.ground)) && !w.getBlock(x, y + 1, z) && R.byName.dirt_path) { w.setBlock(x, y, z, R.byName.dirt_path.defaultState, 4); g.audio.place(s); p.damageHeld(1); return true; }
      if (hd && hd.tool === 'shovel' && this.toggleCut(x, y, z, s, p, false)) return true;
      if (t.o.ui === 'chest' || /chest$|barrel|cargo_crate/.test(t.name)) { g.openContainer && g.openContainer(x, y, z, t); return true; }
      if (/furnace|smoker/.test(t.name)) { g.openFurnace && g.openFurnace(x, y, z, t); return true; }
      if (t.o.kind === 'bed' || t.o.bed) { g.sleep && g.sleep(x, y, z); return true; }
      if (t.o.kind === 'helm') { g.gadgets && g.gadgets.takeHelm(x, y, z); return true; }
      if ((t.o.kind === 'seat' || t.o.seat) && g.gadgets) { g.gadgets.sit(x, y, z); return true; }
      if (t.o.kind === 'beacon' && g.gadgets) { g.gadgets.launchBeacon(x, y, z); return true; }
      return false;
    }
    // R9 Smooth Ground: the shovel cuts a natural block into its cube twin (right-click) or smooths a patch of cut
    // ground back into the landscape (sneak + right-click: the connected cut blocks around the hit, up to ~160)
    toggleCut(x, y, z, s, p, smooth) {
      const g = this.game, w = g.world, t = R.types[R.T.type[s]]; if (!t) return false;
      if (VR.LOOK && !VR.LOOK.ground) return false;   // Klassisch: every block is a cube already (dug ground still turns cut: cutAround)
      if (!smooth) {
        const toName = VR.CUT_OF[t.name]; if (!toName) return false;
        const to = R.byName[toName]; if (!to) return false;
        w.setBlock(x, y, z, to.state(t.decode(s)), 5);
        g.audio.place(s); p.damageHeld(1);
        this.say(T('g.sim.hard'));
        return true;
      }
      if (!VR.SMOOTH_OF[t.name]) return false;
      const seen = new Set(), q = [[x, y, z]], key = (a, b, c) => ((a + 1048576) * 2048 + (b + 1024)) * 2097152 + (c + 1048576);
      seen.add(key(x, y, z));
      let n = 0;
      while (q.length && n < 160) {
        const [cx, cy, cz] = q.shift();
        const cs = w.getBlock(cx, cy, cz), ct = R.types[R.T.type[cs]];
        if (!ct || !VR.SMOOTH_OF[ct.name]) continue;
        const to = R.byName[VR.SMOOTH_OF[ct.name]];
        w.setBlock(cx, cy, cz, to.state(ct.decode(cs)), 5); n++;
        for (let d = 0; d < 6; d++) {
          const nx = cx + VR.DX[d], ny = cy + VR.DY[d], nz = cz + VR.DZ[d];
          if (Math.abs(nx - x) > 6 || Math.abs(ny - y) > 4 || Math.abs(nz - z) > 6) continue;
          const k = key(nx, ny, nz); if (seen.has(k)) continue; seen.add(k); q.push([nx, ny, nz]);
        }
      }
      g.audio.place(s); p.damageHeld(1);
      this.say(n > 1 ? T('g.sim.softN', { n }) : T('g.sim.soft1'));
      return true;
    }
    say(text) { const g = this.game; if (g.ui && g.ui.chatLine) g.ui.chatLine(text, '#9ad8ff'); }
    // a dug natural block leaves crisp voxels behind: the exposed natural neighbours become their cut twins
    cutAround(x, y, z) {
      const w = this.game.world;
      for (let d = 0; d < 6; d++) {
        const nx = x + VR.DX[d], ny = y + VR.DY[d], nz = z + VR.DZ[d];
        const ns = w.getBlock(nx, ny, nz); if (!ns) continue;
        const nt = R.types[R.T.type[ns]]; if (!nt || !VR.CUT_OF[nt.name]) continue;
        const to = R.byName[VR.CUT_OF[nt.name]]; if (!to) continue;
        w.setBlock(nx, ny, nz, to.state(nt.decode(ns)), 5);
      }
    }
    onColumnLoaded() { /* reserved */ }
  }
  VR.Sim = Sim;
})(VR);
