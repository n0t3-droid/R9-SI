// ============================================================================
// Entities: creatures (micro-voxel, animated, AI), item drops, falling blocks,
// laser bolts, vehicles hook, first-person hand & held item, spawning, combat.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, F = VR.F, PH = VR.PHYS, mat4 = VR.mat4, SH = VR.SHAPE;
  const MOBS = VR.MOBS = {
    glimmer_deer: { model: 'glimmer_deer', hp: 10, speed: 3.2, w: 0.45, h: 1.4, drops: [['raw_beef', 1, 2], ['crystal_shard_azure', 0, 1]], xp: 2, biomes: /prism|crystal|forest|meadow|birch|taiga|grove/, group: [2, 4] },
    moss_boar: { model: 'moss_boar', hp: 12, speed: 2.8, w: 0.5, h: 0.95, drops: [['raw_porkchop', 1, 3], ['leather', 0, 1]], xp: 2, biomes: /forest|jungle|taiga|dark|swamp|plains|savanna/, group: [2, 3] },
    bloom_sheep: { model: 'bloom_sheep', hp: 8, speed: 2.4, w: 0.45, h: 1.25, drops: [['raw_mutton', 1, 2], ['pink_wool', 1, 1]], xp: 1, biomes: /plains|meadow|cherry|flower|sunflower|prism/, group: [2, 4] },
    crystal_crab: { model: 'crystal_crab', hp: 6, speed: 2.0, w: 0.4, h: 0.45, drops: [['crystal_shard_violet', 1, 2]], xp: 1, biomes: /beach|prism|crystal|river|shore/, group: [1, 3] },
    sky_ray: { model: 'sky_ray', hp: 16, speed: 7, w: 1.2, h: 0.6, fly: 'glide', drops: [['leather', 1, 2], ['glow_ink', 1, 2]], xp: 3, ambient: true },
    shard_wisp: { model: 'shard_wisp', hp: 4, speed: 1.6, w: 0.25, h: 0.5, fly: 'float', drops: [['glow_ink', 1, 1]], xp: 1, ambient: true, night: true },
    ember_husk: { model: 'ember_husk', hp: 20, speed: 3.1, w: 0.35, h: 1.85, hostile: true, dmg: 3, drops: [['coal', 0, 2], ['sunstone_dust', 0, 1]], xp: 5, fireImmune: true },
    void_stalker: { model: 'void_stalker', hp: 40, speed: 4.2, w: 0.3, h: 2.7, hostile: true, dmg: 6, drops: [['nether_star_shard', 0, 1], ['amethyst_shard', 1, 2]], xp: 10, teleports: true },
    raider_drone: { model: 'raider_drone', hp: 14, speed: 6, w: 0.45, h: 0.9, hostile: true, fly: 'hover', dmg: 3, ranged: true, drops: [['energy_cell', 0, 1], ['iron_ingot', 0, 1]], xp: 6 },
    hover_drone: { model: 'hover_drone', hp: 20, speed: 7, w: 0.3, h: 0.6, fly: 'hover', friendly: true, drops: [], xp: 0 },
  };
  VR.MOB_EGGS && VR.MOB_EGGS.forEach((m) => { if (!MOBS[m]) MOBS[m] = MOBS.glimmer_deer; });

  let NEXT_ID = 1;
  class Mob {
    constructor(kind, x, y, z) {
      this.id = NEXT_ID++; this.kind = kind; this.def = MOBS[kind];
      this.pos = [x, y, z]; this.vel = [0, 0, 0]; this.yaw = Math.random() * 6.28; this.bodyYaw = this.yaw; this.pitch = 0;
      this.hp = this.def.hp; this.hurt = 0; this.dead = false; this.deathT = 0; this.onGround = false;
      this.ai = { state: 'idle', t: Math.random() * 3, target: null, cool: 0, flee: 0 };
      this.walk = 0; this.walkAmt = 0; this.age = 0; this.alt = y;
    }
    get w() { return this.def.w; } get h() { return this.def.h; }
  }
  class Item {
    constructor(stack, x, y, z, vx, vy, vz) { this.id = NEXT_ID++; this.stack = stack; this.pos = [x, y, z]; this.vel = [vx || 0, vy || 0, vz || 0]; this.age = 0; this.delay = 0.6; this.spin = Math.random() * 6; this.onGround = false; }
  }

  class Entities {
    constructor(game) {
      this.game = game;
      this.mobs = []; this.items = []; this.falling = []; this.bolts = []; this.vehicles = [];
      this.spawnT = 2; this.mm = mat4.create(); this.tmp = mat4.create(); this.tmp2 = mat4.create();
      this.meshCache = new Map();
      game.dropStack = (stack, fromPlayer, at) => this.dropStack(stack, fromPlayer, at);
      game.entityBlocks = (x, y, z) => this.blocksPlacement(x, y, z);
    }
    // ---------------------------------------------------------------- spawning
    summon(kind, x, y, z) {
      if (kind === 'hoverbike' && this.game.gadgets) { this.game.gadgets.spawnVehicle('hoverbike', x, y, z); return true; }
      if (!MOBS[kind]) return false;
      const m = new Mob(kind, x, y, z);
      if (m.def.friendly) m.owner = this.game.player;
      this.mobs.push(m);
      return m;
    }
    peacefulish() { const g = this.game; return g.player.mode === 'zen' || g.difficulty === 'peaceful'; }
    trySpawn(dt) {
      const g = this.game, p = g.player, w = g.world;
      this.spawnT -= dt;
      if (this.spawnT > 0) return;
      this.spawnT = 1.2;
      const counts = { passive: 0, hostile: 0, ambient: 0 };
      for (const m of this.mobs) counts[m.def.hostile ? 'hostile' : m.def.ambient ? 'ambient' : 'passive']++;
      const E = g.env.E, night = E.night > 0.5;
      const zen = p.mode === 'zen';
      for (let attempt = 0; attempt < 3; attempt++) {
        const a = Math.random() * Math.PI * 2, d = 24 + Math.random() * 44;
        const x = Math.floor(p.pos[0] + Math.cos(a) * d), z = Math.floor(p.pos[2] + Math.sin(a) * d);
        if (!w.isLoaded(x, z)) continue;
        const top = w.topAt(x, z);
        const ground = w.getBlock(x, top, z);
        const b = VR.BIOMES[w.biomeAt(x, z)];
        const key = b ? b.key : '';
        if (Math.random() < 0.35 && counts.ambient < 6 && g.dim === 'overworld') {
          // ambient: sky rays near islands/altitude by day, wisps at night
          if (night && counts.ambient < 6) { this.summon('shard_wisp', x + 0.5, top + 2 + Math.random() * 3, z + 0.5); counts.ambient++; }
          else if (!night && Math.random() < 0.25) { const m = this.summon('sky_ray', x + 0.5, Math.max(top + 30, 140 + Math.random() * 40), z + 0.5); m.alt = m.pos[1]; counts.ambient++; }
          continue;
        }
        if (zen) continue;
        if (!(R.T.flags[ground] & F.SOLID) || (R.T.flags[ground] & F.FLUID)) {
          if ((R.T.flags[ground] & F.WATER) && /beach|river|ocean/.test(key) && counts.passive < 12 && Math.random() < 0.2) { /* fish later */ }
          continue;
        }
        const light = w.getLight(x, top + 1, z);
        const sky = (light >>> 12), blk = Math.max((light >> 8) & 15, (light >> 4) & 15, light & 15);
        const hostileOK = g.difficulty !== 'peaceful' && counts.hostile < (g.difficulty === 'hard' ? 14 : 9) && (night ? sky * (1 - E.night) < 7 : sky < 4) && blk < 6;
        if (hostileOK && (night || key === 'ember_canyons') && Math.random() < 0.7) {
          const kind = Math.random() < 0.12 ? 'void_stalker' : 'ember_husk';
          this.summon(kind, x + 0.5, top + 1, z + 0.5); counts.hostile++;
          continue;
        }
        if (counts.passive < 14 && !night && (ground === VR.GEN.S().grass || ground === VR.GEN.S().sand || ground === VR.GEN.S().podzol)) {
          const opts = Object.keys(MOBS).filter(k => !MOBS[k].hostile && !MOBS[k].ambient && MOBS[k].biomes && MOBS[k].biomes.test(key));
          if (!opts.length) continue;
          const kind = opts[Math.floor(Math.random() * opts.length)];
          const [g0, g1] = MOBS[kind].group || [1, 2];
          const n = g0 + Math.floor(Math.random() * (g1 - g0 + 1));
          for (let i = 0; i < n; i++) { const ox = x + Math.floor((Math.random() - 0.5) * 6), oz = z + Math.floor((Math.random() - 0.5) * 6); const ty = w.topAt(ox, oz); if (R.T.flags[w.getBlock(ox, ty, oz)] & F.SOLID) this.summon(kind, ox + 0.5, ty + 1, oz + 0.5); }
          counts.passive += n;
        }
      }
    }
    // ---------------------------------------------------------------- items
    dropStack(stack, fromPlayer, at) {
      const p = this.game.player;
      let x, y, z, vx = 0, vy = 3, vz = 0;
      if (at) { x = at[0]; y = at[1]; z = at[2]; vx = (Math.random() - 0.5) * 2; vz = (Math.random() - 0.5) * 2; }
      else { const e = p.eyePos(), d = p.lookDir(); x = e[0]; y = e[1] - 0.3; z = e[2]; vx = d[0] * 5; vy = d[1] * 5 + 2; vz = d[2] * 5; }
      const it = new Item({ id: stack.id, n: stack.n, dmg: stack.dmg }, x, y, z, vx, vy, vz);
      if (fromPlayer) it.delay = 1.6;
      this.items.push(it);
      return it;
    }
    blocksPlacement(x, y, z) {
      if (this.game.villages && this.game.villages.blocks(x, y, z)) return true;
      for (const m of this.mobs) { if (m.dead) continue; const w = m.w; if (m.pos[0] + w > x && m.pos[0] - w < x + 1 && m.pos[2] + w > z && m.pos[2] - w < z + 1 && m.pos[1] + m.h > y && m.pos[1] < y + 1) return true; }
      return false;
    }
    // ---------------------------------------------------------------- update
    update(dt) {
      const g = this.game, w = g.world, p = g.player;
      const get = (x, y, z) => w.getBlock(x, y, z), nb = w.nbFn();
      this.trySpawn(dt);
      // mobs
      for (let i = this.mobs.length - 1; i >= 0; i--) {
        const m = this.mobs[i];
        m.age += dt;
        const dx = m.pos[0] - p.pos[0], dz = m.pos[2] - p.pos[2], d2 = dx * dx + dz * dz;
        if (m.dead) { m.deathT += dt; if (m.deathT > 0.8) { this.onMobDeath(m); this.mobs.splice(i, 1); } continue; }
        if (d2 > 140 * 140 || (!w.isLoaded(Math.floor(m.pos[0]), Math.floor(m.pos[2])))) { this.mobs.splice(i, 1); continue; }
        if (m.def.hostile && p.mode === 'zen') { this.mobs.splice(i, 1); continue; }
        m.hurt = Math.max(0, m.hurt - dt);
        this.ai(m, dt, d2);
        this.physics(m, dt, get, nb);
      }
      // items
      for (let i = this.items.length - 1; i >= 0; i--) {
        const it = this.items[i];
        it.age += dt; it.delay -= dt; it.spin += dt * 1.6;
        if (it.age > 300) { this.items.splice(i, 1); continue; }
        const d = [p.pos[0] - it.pos[0], p.pos[1] + 0.8 - it.pos[1], p.pos[2] - it.pos[2]];
        const dist = Math.hypot(d[0], d[1], d[2]);
        if (it.delay <= 0 && dist < 1.8 && !p.dead) {
          if (dist < 0.6) {
            const got = p.inv.add(it.stack.id, it.stack.n);
            if (got > 0) { it.stack.n -= got; g.audio.play('pop'); g.codex && g.codex.onPickup && g.codex.onPickup(it.stack.id); }
            if (it.stack.n <= 0) { this.items.splice(i, 1); continue; }
          } else { it.vel[0] = d[0] / dist * 8; it.vel[1] = d[1] / dist * 8; it.vel[2] = d[2] / dist * 8; it.pos[0] += it.vel[0] * dt; it.pos[1] += it.vel[1] * dt; it.pos[2] += it.vel[2] * dt; continue; }
        }
        it.vel[1] -= 20 * dt;
        const inWater = R.T.flags[get(Math.floor(it.pos[0]), Math.floor(it.pos[1]), Math.floor(it.pos[2]))] & F.FLUID;
        if (inWater) { it.vel[1] = Math.min(it.vel[1] + 30 * dt, 1.5); it.vel[0] *= 0.9; it.vel[2] *= 0.9; }
        const res = PH.move(get, it.pos, 0.12, 0.25, it.vel[0] * dt, it.vel[1] * dt, it.vel[2] * dt, 0, nb);
        if (res.hitY) { it.vel[1] = 0; it.vel[0] *= 0.6; it.vel[2] *= 0.6; }
        if (res.hitX) it.vel[0] = 0; if (res.hitZ) it.vel[2] = 0;
        // merge
        if ((i & 7) === (g.frame & 7)) for (const o of this.items) { if (o !== it && o.stack.id === it.stack.id && !o.stack.dmg && !it.stack.dmg && Math.abs(o.pos[0] - it.pos[0]) < 0.8 && Math.abs(o.pos[1] - it.pos[1]) < 0.8 && Math.abs(o.pos[2] - it.pos[2]) < 0.8 && o.stack.n + it.stack.n <= VR.maxStack(o.stack.id)) { o.stack.n += it.stack.n; it.stack.n = 0; this.items.splice(i, 1); break; } }
      }
      // falling blocks
      for (let i = this.falling.length - 1; i >= 0; i--) {
        const f = this.falling[i];
        f.vel[1] = Math.max(-40, f.vel[1] - 30 * dt);
        const ny = f.pos[1] + f.vel[1] * dt;
        const bx = Math.floor(f.pos[0]), bz = Math.floor(f.pos[2]), by = Math.floor(ny);
        const below = get(bx, by, bz);
        if (f.tnt) { f.fuse -= dt; if ((below && (R.T.flags[below] & F.SOLID)) || ny < 0) { f.vel[1] = 0; } else f.pos[1] = ny; if (Math.random() < dt * 20) g.particles.smoke(f.pos[0], f.pos[1] + 1.05, f.pos[2], 1); continue; }
        if ((below && (R.T.flags[below] & F.SOLID) && !(R.T.flags[below] & F.REPLACE)) || ny < 0) {
          const ty = by + 1;
          const cur = get(bx, ty, bz);
          if (!cur || (R.T.flags[cur] & F.REPLACE)) w.setBlock(bx, ty, bz, f.state, 4);
          else this.dropStack({ id: R.types[R.T.type[f.state]].name, n: 1 }, false, [bx + 0.5, ty + 0.5, bz + 0.5]);
          this.falling.splice(i, 1);
          g.audio.place(f.state);
          if (f.damage) for (const m of this.mobs) if (Math.abs(m.pos[0] - bx - 0.5) < 0.8 && Math.abs(m.pos[2] - bz - 0.5) < 0.8 && Math.abs(m.pos[1] - ty) < 1.5) this.hurtMob(m, 6, null);
          continue;
        }
        f.pos[1] = ny;
      }
      // bolts
      for (let i = this.bolts.length - 1; i >= 0; i--) if (this.updateBolt(this.bolts[i], dt, get)) this.bolts.splice(i, 1);
    }
    physics(m, dt, get, nb) {
      const def = m.def;
      if (def.fly) {
        m.pos[0] += m.vel[0] * dt; m.pos[1] += m.vel[1] * dt; m.pos[2] += m.vel[2] * dt;
        if (def.fly !== 'glide' && PH.overlaps(get, m.pos[0] - m.w, m.pos[1], m.pos[2] - m.w, m.pos[0] + m.w, m.pos[1] + m.h, m.pos[2] + m.w, nb)) { m.pos[1] += 2 * dt * 4; m.vel[1] = Math.abs(m.vel[1]); }
        return;
      }
      const inFluid = R.T.flags[get(Math.floor(m.pos[0]), Math.floor(m.pos[1] + 0.3), Math.floor(m.pos[2]))] & F.FLUID;
      if (inFluid) { m.vel[1] = Math.min(m.vel[1] + 20 * dt, 2.5); m.vel[0] *= 0.92; m.vel[2] *= 0.92; }
      else m.vel[1] -= 30 * dt;
      let my = m.vel[1] * dt, follow = null;
      if (m.onGround && m.vel[1] <= 0 && !inFluid) { follow = PH.walkSmooth(get, m.pos, m.vel[0] * dt, m.vel[2] * dt); if (follow !== null) { my = follow; m.vel[1] = 0; } }
      const res = PH.move(get, m.pos, m.w, m.h, m.vel[0] * dt, my, m.vel[2] * dt, 0.6, nb, m.onGround);
      if (follow !== null) { res.onGround = true; res.hitY = true; m.vel[1] = 0; }
      else if (m.vel[1] <= 0 && PH.snapSmooth(get, m.pos)) { res.onGround = true; res.hitY = true; m.vel[1] = 0; }
      if (res.hitY) { if (m.vel[1] < -14 && !inFluid) this.hurtMob(m, Math.floor(-m.vel[1] / 3 - 3), null); m.vel[1] = 0; }
      m.onGround = res.onGround || (res.hitY && m.vel[1] === 0);
      if ((res.hitX || res.hitZ) && m.onGround && m.ai.moving) m.vel[1] = 8.5; // hop up
      if (res.hitX) m.vel[0] = 0; if (res.hitZ) m.vel[2] = 0;
      if (m.onGround) { m.vel[0] *= Math.exp(-dt * 6); m.vel[2] *= Math.exp(-dt * 6); }
      const lava = R.T.flags[get(Math.floor(m.pos[0]), Math.floor(m.pos[1] + 0.2), Math.floor(m.pos[2]))] & F.LAVA;
      if (lava && !def.fireImmune) { m.lava = (m.lava || 0) - dt; if (m.lava <= 0) { m.lava = 0.5; this.hurtMob(m, 4, null); } }
      if (m.pos[1] < -20) m.dead = true;
    }
    ai(m, dt, d2) {
      const g = this.game, p = g.player, def = m.def, A = m.ai, w = g.world;
      A.t -= dt; A.cool -= dt; A.flee -= dt;
      let tx = null, tz = null, speed = def.speed;
      m.ai.moving = false;
      if (def.fly === 'glide') {
        // wide gliding circles, gentle altitude waves
        m.yaw += dt * 0.12;
        const s = def.speed;
        m.vel[0] = -Math.sin(m.yaw) * s; m.vel[2] = -Math.cos(m.yaw) * s;
        m.vel[1] = Math.sin(m.age * 0.4) * 1.2 + (m.alt - m.pos[1]) * 0.2;
        m.walk += dt * 1.5; m.walkAmt = 1;
        return;
      }
      if (def.fly === 'float') {
        m.vel[0] = Math.sin(m.age * 0.3 + m.id) * 0.8; m.vel[2] = Math.cos(m.age * 0.27 + m.id * 2) * 0.8;
        const top = w.topAt(Math.floor(m.pos[0]), Math.floor(m.pos[2]));
        m.vel[1] = (top + 2.5 + Math.sin(m.age * 1.3) - m.pos[1]) * 0.8;
        if (g.env.E.night < 0.3) { m.hp -= dt * 2; if (m.hp <= 0) m.dead = true; }
        if (Math.random() < dt * 3) g.particles.glow(m.pos[0], m.pos[1] + 0.3, m.pos[2], [0.4, 1, 0.9], 1.2, 0.05, 0.2);
        m.yaw += dt;
        return;
      }
      if (def.friendly) {
        const tpx = p.pos[0] + Math.sin(m.age * 0.8) * 2.5, tpz = p.pos[2] + Math.cos(m.age * 0.8) * 2.5, tpy = p.pos[1] + 2.4;
        m.vel[0] += ((tpx - m.pos[0]) * 2 - m.vel[0]) * dt * 3; m.vel[1] += ((tpy - m.pos[1]) * 2 - m.vel[1]) * dt * 3; m.vel[2] += ((tpz - m.pos[2]) * 2 - m.vel[2]) * dt * 3;
        m.yaw = Math.atan2(-(p.pos[0] - m.pos[0]), -(p.pos[2] - m.pos[2]));
        return;
      }
      if (def.hostile && !p.dead && p.mode === 'survival' && (d2 < 30 * 30 || (m.raid && d2 < 160 * 160))) {
        // chase
        const dist = Math.sqrt(d2);
        if (def.ranged) {
          const ty = p.pos[1] + 3 + Math.sin(m.age) * 1.5;
          const want = dist > 12 ? 1 : dist < 7 ? -1 : 0;
          const dx = (p.pos[0] - m.pos[0]) / (dist || 1), dz = (p.pos[2] - m.pos[2]) / (dist || 1);
          m.vel[0] += (dx * def.speed * want + Math.cos(m.age) * 2 - m.vel[0]) * dt * 2; m.vel[2] += (dz * def.speed * want + Math.sin(m.age) * 2 - m.vel[2]) * dt * 2;
          m.vel[1] += ((ty - m.pos[1]) * 1.5 - m.vel[1]) * dt * 2;
          m.yaw = Math.atan2(-dx, -dz);
          if (A.cool <= 0 && dist < 26) { A.cool = 1.6 + Math.random(); const e = [m.pos[0], m.pos[1] + 0.4, m.pos[2]]; const tgt = [p.pos[0] - e[0], p.pos[1] + 1.2 - e[1], p.pos[2] - e[2]]; this.fireBolt(e, tgt, 38, def.dmg, m, [1, 0.25, 0.2]); }
          return;
        }
        tx = p.pos[0]; tz = p.pos[2]; speed *= 1.25;
        if (def.teleports && dist > 10 && Math.random() < dt * 0.25) this.teleportNear(m, p);
        if (dist < 1.4 + m.w && Math.abs(p.pos[1] - m.pos[1]) < 2 && A.cool <= 0) { A.cool = 1.1; p.damage(def.dmg * (g.difficulty === 'hard' ? 1.5 : g.difficulty === 'easy' ? 0.6 : 1), 'mob', m.pos); m.swing = 1; }
      } else if (A.flee > 0) {
        tx = m.pos[0] + (m.pos[0] - p.pos[0]); tz = m.pos[2] + (m.pos[2] - p.pos[2]); speed *= 1.6;
      } else {
        if (A.t <= 0) {
          A.t = 2 + Math.random() * 5;
          A.target = Math.random() < 0.6 ? [m.pos[0] + (Math.random() - 0.5) * 16, m.pos[2] + (Math.random() - 0.5) * 16] : null;
        }
        if (A.target) { tx = A.target[0]; tz = A.target[1]; speed *= 0.55; }
      }
      if (tx !== null) {
        const dx = tx - m.pos[0], dz = tz - m.pos[2], d = Math.hypot(dx, dz);
        if (d > 0.6) {
          // avoid walking off cliffs (passive only)
          const nx = m.pos[0] + dx / d * 0.8, nz = m.pos[2] + dz / d * 0.8;
          let drop = 0; for (let y = Math.floor(m.pos[1]) - 1; y > Math.floor(m.pos[1]) - 5; y--) { const b = w.getBlock(Math.floor(nx), y, Math.floor(nz)); if (b && (R.T.flags[b] & (F.SOLID | F.FLUID))) break; drop++; }
          if (drop >= 3 && !def.hostile) { A.target = null; }
          else {
            const tv = speed;
            m.vel[0] += (dx / d * tv - m.vel[0]) * Math.min(1, dt * 8); m.vel[2] += (dz / d * tv - m.vel[2]) * Math.min(1, dt * 8);
            const ty = Math.atan2(-dx, -dz);
            let dy = ty - m.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
            m.yaw += dy * Math.min(1, dt * 6);
            m.ai.moving = true;
          }
        } else A.target = null;
      }
      const hs = Math.hypot(m.vel[0], m.vel[2]);
      m.walk += hs * dt * 2.2; m.walkAmt += ((hs > 0.3 ? 1 : 0) - m.walkAmt) * Math.min(1, dt * 6);
      m.swing = Math.max(0, (m.swing || 0) - dt * 3);
    }
    teleportNear(m, p) {
      const w = this.game.world;
      for (let k = 0; k < 8; k++) {
        const a = Math.random() * 6.28, d = 3 + Math.random() * 4;
        const x = Math.floor(p.pos[0] + Math.cos(a) * d), z = Math.floor(p.pos[2] + Math.sin(a) * d);
        const top = w.topAt(x, z);
        if (Math.abs(top - p.pos[1]) > 6) continue;
        this.game.particles.spark(m.pos[0], m.pos[1] + 1, m.pos[2], [0.7, 0.3, 1], 20, 3);
        m.pos = [x + 0.5, top + 1, z + 0.5];
        this.game.particles.spark(m.pos[0], m.pos[1] + 1, m.pos[2], [0.7, 0.3, 1], 20, 3);
        this.game.audio.play('zap');
        return;
      }
    }
    // ---------------------------------------------------------------- combat
    rayEntity(o, d, maxD) {
      let best = null, bt = maxD;
      for (const m of this.mobs) {
        if (m.dead) continue;
        const b = [-m.w, 0, -m.w, m.w, m.h, m.w];
        const r = PH.rayBox(o[0], o[1], o[2], d[0], d[1], d[2], b, m.pos[0], m.pos[1], m.pos[2]);
        if (r && r[0] < bt) { bt = r[0]; best = m; }
      }
      let ships = this.game.starships ? this.game.starships.ships : [];
      if (this.game.trams && this.game.trams.cars.length) ships = ships.concat(this.game.trams.cars);
      for (const v of this.vehicles.length ? (ships.length ? this.vehicles.concat(ships) : this.vehicles) : ships) {
        if (!v.hitbox || v.state === 'flying') continue;
        const b = v.hitbox();
        const r = PH.rayBox(o[0], o[1], o[2], d[0], d[1], d[2], b, 0, 0, 0);
        if (r && r[0] < bt) { bt = r[0]; best = v; }
      }
      const vh = this.game.villages ? this.game.villages.ray(o, d, bt) : null;
      if (vh && vh.dist < bt) { bt = vh.dist; best = vh.ent; }
      return best ? { ent: best, dist: bt } : null;
    }
    playerAttack() {
      const g = this.game, p = g.player, input = g.input;
      if (!input.captured || g.ui.blocking || p.dead) return;
      const click = input.dragLook ? input.clickAction(0) : input.mouse.clicked[0];
      const rclick = input.dragLook ? input.clickAction(2) : input.mouse.clicked[2];
      if (!click && !rclick) return;
      const e = p.eyePos(), d = p.lookDir();
      const hit = this.rayEntity(e, d, 4.2);
      if (!hit) return;
      const blockDist = p.target ? p.target.dist : 99;
      if (hit.dist > blockDist) return;
      if (rclick && hit.ent.onUse) { hit.ent.onUse(p); input.mouse.clicked[2] = false; input.mouse.releasedBtn[2] = false; p.placeCooldown = 0.3; return; }
      if (click && hit.ent.onHit) { hit.ent.onHit(p.pos); p.handSwing = 1; input.mouse.clicked[0] = false; input.mouse.releasedBtn[0] = false; p.breakCooldown = 0.35; return; }
      if (!click || !hit.ent.def) return;
      const h = p.inv.held, hd = h ? VR.itemDef(h.id) : null;
      if (hd && (hd.use === 'laser' || hd.use === 'minelaser' || hd.use === 'wand' || hd.use === 'blueprint')) return; // these fire/select instead of punching
      const dmg = hd && hd.dmg ? hd.dmg : 1;
      this.hurtMob(hit.ent, dmg, p.pos);
      p.handSwing = 1;
      p.damageHeld(hd && hd.tool === 'sword' ? 1 : 2);
      p.exhaust += 0.1;
      // consume the click so it doesn't also break a block
      input.mouse.clicked[0] = false; input.mouse.releasedBtn[0] = false; p.breakCooldown = 0.35;
    }
    hurtMob(m, dmg, from) {
      if (m.dead || m.hurt > 0.3) return;
      m.hp -= dmg; m.hurt = 0.5;
      if (from) { const dx = m.pos[0] - from[0], dz = m.pos[2] - from[2], l = Math.hypot(dx, dz) || 1; m.vel[0] += dx / l * 7; m.vel[2] += dz / l * 7; if (!m.def.fly) m.vel[1] = 5.5; }
      if (!m.def.hostile) m.ai.flee = 5;
      this.game.audio.play('hurt');
      if (m.hp <= 0) { m.dead = true; this.game.particles.spark(m.pos[0], m.pos[1] + m.h * 0.5, m.pos[2], [1, 1, 1], 14, 3, 0); }
    }
    onMobDeath(m) {
      const g = this.game;
      g.particles.smoke(m.pos[0], m.pos[1] + 0.4, m.pos[2], 10);
      for (const [id, a, b] of m.def.drops || []) { const n = a + Math.floor(Math.random() * (b - a + 1)); if (n > 0 && VR.itemDef(id)) this.dropStack({ id, n }, false, [m.pos[0], m.pos[1] + 0.5, m.pos[2]]); }
      if (g.player.mode === 'survival') g.addXP && g.addXP(m.def.xp || 1);
      g.codex && g.codex.onKill && g.codex.onKill(m.kind);
      g.gadgets && g.gadgets.onMobKilled && g.gadgets.onMobKilled(m);
    }
    fireBolt(origin, dir, speed, dmg, owner, col) {
      const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
      this.bolts.push({ pos: origin.slice(), vel: [dir[0] / l * speed, dir[1] / l * speed, dir[2] / l * speed], dmg, owner, life: 2.5, col: col || [0.3, 1, 1] });
      this.game.audio.play('laser');
    }
    updateBolt(b, dt, get) {
      const g = this.game;
      b.life -= dt;
      if (b.life <= 0) return true;
      const step = [b.vel[0] * dt, b.vel[1] * dt, b.vel[2] * dt], len = Math.hypot(step[0], step[1], step[2]);
      const dn = [step[0] / len, step[1] / len, step[2] / len];
      // block hit
      const hit = PH.raycast(get, b.pos[0], b.pos[1], b.pos[2], dn[0], dn[1], dn[2], len);
      // entity hit
      let eh = null, et = hit ? hit.dist : len;
      const p = g.player;
      if (b.owner !== p && !b.friendly && !p.dead) { const r = PH.rayBox(b.pos[0], b.pos[1], b.pos[2], dn[0], dn[1], dn[2], [-0.35, 0, -0.35, 0.35, 1.8, 0.35], p.pos[0], p.pos[1], p.pos[2]); if (r && r[0] < et) { et = r[0]; eh = p; } }
      for (const m of this.mobs) { if (m === b.owner || m.dead || (b.owner && b.owner.def && b.owner.def.hostile && m.def.hostile)) continue; const r = PH.rayBox(b.pos[0], b.pos[1], b.pos[2], dn[0], dn[1], dn[2], [-m.w, 0, -m.w, m.w, m.h, m.w], m.pos[0], m.pos[1], m.pos[2]); if (r && r[0] < et) { et = r[0]; eh = m; } }
      // trail
      for (let k = 0; k < 3; k++) { const t = (k / 3) * Math.min(len, et); g.particles.spawn(b.pos[0] + dn[0] * t, b.pos[1] + dn[1] * t, b.pos[2] + dn[2] * t, 0, 0, 0, { life: 0.12, size: 0.07, grav: 0, col: b.col, emis: 1, collide: false }); }
      if (eh) {
        const hp = [b.pos[0] + dn[0] * et, b.pos[1] + dn[1] * et, b.pos[2] + dn[2] * et];
        if (eh === p) p.damage(b.dmg, 'laser', b.pos); else this.hurtMob(eh, b.dmg, b.pos);
        g.particles.spark(hp[0], hp[1], hp[2], b.col, 10, 3);
        return true;
      }
      if (hit) { g.particles.spark(hit.px, hit.py, hit.pz, b.col, 12, 3); if (b.breaks && g.player.mode !== 'zen') g.player.breakBlock(hit.x, hit.y, hit.z, hit.state, true); return true; }
      b.pos[0] += step[0]; b.pos[1] += step[1]; b.pos[2] += step[2];
      return false;
    }
    spawnFalling(x, y, z, state, damage) { this.falling.push({ pos: [x + 0.5, y, z + 0.5], vel: [0, 0, 0], state, damage }); }

    // ---------------------------------------------------------------- rendering helpers
    lightAt(x, y, z) {
      const l = this.game.world.getLight(Math.floor(x), Math.floor(y), Math.floor(z));
      return { sky: (l >>> 12) / 15, bl: [((l >> 8) & 15) / 15, ((l >> 4) & 15) / 15, (l & 15) / 15] };
    }
    beginVox(r, E, viewProj) {
      const gl = r.gl, p = r.P.vox;
      gl.useProgram(p.p); r.common(p, E);
      gl.uniformMatrix4fv(p.u.u_viewProj, false, viewProj || r.viewProj);
      gl.uniform1f(p.u.u_alpha, 1);
      if (p.u.u_sunShadow) gl.uniform1f(p.u.u_sunShadow, 0);
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
      return p;
    }
    // terrain shade on a model standing at pos (heightmap ray toward the sun)
    sunShade(pos, h) {
      const g = this.game, w = g.world, E = g.env && g.env.E;
      if (!w || !E || !g.renderer.q.hshadow) return 0;
      const L = E.sunDir[1] > 0.02 ? E.sunDir : E.moonDir;
      return w.sunShade(pos[0], pos[1] + (h || 1), pos[2], L);
    }
    drawModel(r, p, model, pos, cam, yaw, pose, light, opts) {
      const gl = r.gl;
      opts = opts || {};
      gl.uniform1f(p.u.u_sky, light.sky);
      gl.uniform3f(p.u.u_blockLight, light.bl[0], light.bl[1], light.bl[2]);
      if (p.u.u_sunShadow) gl.uniform1f(p.u.u_sunShadow, opts.baseMat || opts.noShade ? 0 : opts.shade !== undefined ? opts.shade : this.sunShade(pos, opts.shadeH || 1.2));
      gl.uniform1f(p.u.u_flash, opts.flash || 0);
      gl.uniform3f(p.u.u_tint, 1, 1, 1);
      gl.uniform1f(p.u.u_noFog, opts.noFog ? 1 : 0);
      const base = this.mm;
      base.set(mat4.create());
      if (opts.baseMat) base.set(opts.baseMat);
      else {
        mat4.translate(base, base, pos[0] - cam.x, pos[1] - cam.y, pos[2] - cam.z);
        mat4.rotY(base, base, yaw);
        if (opts.roll) mat4.rotZ(base, base, opts.roll);
        if (opts.pitch) mat4.rotX(base, base, opts.pitch);
      }
      const s = (opts.scale || 1) / (model.def.unit || 16);
      mat4.scale(base, base, s, s, s);
      const lay = model.def.layout, hide = opts.hide, rig = model.def.rig;
      // rigged models (the villagers): children hang off their parent's joint, so a bent elbow follows the raised arm
      const order = model.def.order || Object.keys(model.parts), mats = rig ? (this.rigMats || (this.rigMats = {})) : null;
      for (const name of order) {
        const pr = model.parts[name];
        if (!pr) continue;
        const t = this.tmp;
        const par = rig && rig[name];
        if (par && mats[par[0]]) { t.set(mats[par[0]]); const J = par[1]; mat4.translate(t, t, J[0], J[1], J[2]); }
        else { const L = lay[name] || [0, 0, 0]; t.set(base); mat4.translate(t, t, L[0], L[1], L[2]); }
        const q = pose && pose[name];
        // q = [rotX, rotY, rotZ, (offset x, y, z in model units)]
        if (q) { if (q.length > 3) mat4.translate(t, t, q[3] || 0, q[4] || 0, q[5] || 0); if (q[1]) mat4.rotY(t, t, q[1]); if (q[0]) mat4.rotX(t, t, q[0]); if (q[2]) mat4.rotZ(t, t, q[2]); }
        if (mats) { let m = mats[name]; if (!m) m = mats[name] = new Float32Array(16); m.set(t); }
        if (hide && hide[name]) continue;
        gl.uniformMatrix4fv(p.u.u_model, false, t);
        gl.bindVertexArray(pr.vao);
        gl.drawArrays(gl.TRIANGLES, 0, pr.count);
      }
    }
    pose(m, t) {
      const gait = m.def ? VR.getVoxModel(this.game.renderer.gl, m.def.model).def.gait : 'biped';
      const s = Math.sin(m.walk * 3) * 0.7 * (m.walkAmt || 0);
      const P = {};
      if (gait === 'quad') { P.leg_fl = [s, 0, 0]; P.leg_br = [s, 0, 0]; P.leg_fr = [-s, 0, 0]; P.leg_bl = [-s, 0, 0]; P.head = [Math.sin(t * 0.7 + m.id) * 0.1, Math.sin(t * 0.3 + m.id) * 0.2, 0]; P.claw_l = [0, Math.sin(t * 2) * 0.2, 0]; P.claw_r = [0, -Math.sin(t * 2) * 0.2, 0]; }
      // pose angles: positive X rotation swings a limb forward (models face -z) and tilts the head up
      else if (gait === 'biped') { P.leg_l = [s, 0, 0]; P.leg_r = [-s, 0, 0]; P.arm_l = [-s * 0.8 + (m.swing || 0) * 1.2, 0, 0]; P.arm_r = [s * 0.8 + (m.swing || 0) * 1.4, 0, 0]; if (m.def && m.def.hostile) { P.arm_l[0] += 1.3; P.arm_r[0] += 1.3; } }
      else if (gait === 'wings') { const f = Math.sin(t * 1.6 + m.id) * 0.35; P.wing_l = [0, 0, f]; P.wing_r = [0, 0, -f]; P.tail = [Math.sin(t * 1.3) * 0.15, Math.sin(t * 0.9) * 0.2, 0]; }
      else if (gait === 'float') { P.ring = [0.3, t * 2, 0.2]; P.body = [0, t, 0]; }
      else if (gait === 'hover') { P.rotor_l = [0, t * 30, 0]; P.rotor_r = [0, -t * 30, 0]; }
      if (m.dead) { for (const k in P) void k; }
      return P;
    }
    draw(r, E, cam) {
      const gl = r.gl, t = this.game.time;
      const p = this.beginVox(r, E);
      for (const m of this.mobs) {
        const dx = m.pos[0] - cam.x, dy = m.pos[1] - cam.y, dz = m.pos[2] - cam.z;
        if (dx * dx + dz * dz > 110 * 110) continue;
        if (!mat4.boxInFrustum(r.planes, dx - 2, dy - 1, dz - 2, dx + 2, dy + 3, dz + 2)) continue;
        const model = VR.getVoxModel(gl, m.def.model);
        if (!model) continue;
        const light = this.lightAt(m.pos[0], m.pos[1] + m.h * 0.6, m.pos[2]);
        if (m.def.fly === 'float') { light.sky = 1; }
        const deathRoll = m.dead ? Math.min(1.5, m.deathT * 4) : 0;
        this.drawModel(r, p, model, m.pos, cam, m.yaw, this.pose(m, t), light, { flash: m.hurt > 0.25 ? 1 : 0, roll: deathRoll, pitch: m.def.fly === 'glide' ? Math.sin(m.age * 0.4) * 0.1 : 0 });
      }
      // other players' shadows / third person self
      const g = this.game, pl = g.player;
      if (g.camMode !== 0 && !pl.dead && !(g.gadgets && g.gadgets.controlling)) {
        const Folk = VR.Folk, held = pl.inv && pl.inv.held ? pl.inv.held.id : null;
        const hero = Folk && Folk.heroLook ? Folk.heroLook(Object.assign({}, g.heroOpts(), { tool: Folk.isBlaster(held) ? 'blaster' : null })) : null;
        const hm = hero ? Folk.model(gl, hero, false) : null;
        const light = this.lightAt(pl.pos[0], pl.pos[1] + 1, pl.pos[2]);
        const flyTilt = pl.flying && Math.hypot(pl.vel[0], pl.vel[2]) > 6 ? -0.5 : 0;
        if (hm) {
          // you, as your hero: the same armoured explorer your friends see
          const pose = Folk.heroPose({ walk: pl.bob * 1.4, walkAmt: pl.bobAmt, swing: pl.handSwing, pitch: pl.pitch, fly: pl.flying, sneak: pl.sneaking, aim: hero.tool === 'blaster' });
          this.drawModel(r, p, hm, pl.pos, cam, pl.yaw, pose, light, { hide: { lids: true, mouth: true }, pitch: flyTilt });
        } else {
          const model = VR.getVoxModel(gl, 'player');
          const fake = { walk: pl.bob * 1.4, walkAmt: pl.bobAmt, id: 0, def: { model: 'player' }, swing: pl.handSwing };
          const pose = this.pose(fake, t);
          pose.head = [pl.pitch, 0, 0];
          if (pl.flying) { pose.leg_l = [0.2, 0, 0]; pose.leg_r = [0.25, 0, 0]; }
          this.drawModel(r, p, model, pl.pos, cam, pl.yaw, pose, light, { pitch: flyTilt });
        }
      }
      // vehicles
      if (g.gadgets && g.gadgets.drawVehicles) g.gadgets.drawVehicles(r, E, cam, p);
      // items & falling blocks (textured meshes)
      this.drawItems(r, E, cam);
    }
    // ---------------------------------------------------------------- textured item meshes
    itemMesh(id) {
      let m = this.meshCache.get(id);
      if (m) return m;
      const verts = [];
      // shade < 0: opaque texture (alpha = tint mask, never discarded); |shade| = 2: emissive
      const push = (x, y, z, u, v, l, nx, ny, nz, tint, sh) => verts.push(x, y, z, u, v, l, nx, ny, nz, tint[0], tint[1], tint[2], sh === undefined ? 1 : sh);
      const t = R.byName[id];
      const icons = this.game.icons;
      if (t && !VR.ITEMS[id] && R.T.shape[t.defaultState] === SH.VOXEL && VR.VX) {
        // mini-voxel architecture blocks: real 8x8x8 voxels in the hand / on the ground
        const G = VR.VX.iconGrid(t.defaultState);
        const P = VR.VX.PRESENT, EM = VR.VX.EMIS, GLS = VR.VX.GLASS;
        const at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x > 7 || y > 7 || z > 7) ? 0 : G[(y * 8 + z) * 8 + x];
        const layer = R.texIndex['vx_tile'] | 0;
        const D6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
        if (G) for (let y = 0; y < 8; y++) for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) {
          const v = at(x, y, z);
          if (!(v & P)) continue;
          const glass = (v & GLS) !== 0;
          const col = glass ? [0.72, 0.86, 0.96] : [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
          const sh = (v & EM) ? -2 : -1;
          for (let f = 0; f < 6; f++) {
            const n = at(x + D6[f][0], y + D6[f][1], z + D6[f][2]);
            if ((n & P) && !((n & GLS) && !glass)) continue;
            const fp = VR.MODEL.facePos(f, [x * 2, y * 2, z * 2, x * 2 + 2, y * 2 + 2, z * 2 + 2]).map(q => q / 16);
            const uv = [0, 0, 0, 16, 16, 16, 16, 0];
            for (const k of [0, 1, 2, 0, 2, 3]) push(fp[k * 3] - 0.5, fp[k * 3 + 1] - 0.5, fp[k * 3 + 2] - 0.5, uv[k * 2] / 16, uv[k * 2 + 1] / 16, layer, D6[f][0], D6[f][1], D6[f][2], col, sh);
          }
        }
        m = { verts, block: true };
      } else if (t && !VR.ITEMS[id]) {
        const s = t.defaultState, shape = R.T.shape[s];
        const tint = icons.tintOf(s) || [1, 1, 1];
        const opaqueLayer = R.T.layer[s] === 0;
        // a recoloured block (B1 „🎨 Aussehen"): every face in its colour (|shade| 3 in the mesh shader)
        const rc = R.T.rc ? R.T.rc[s] : 0, rcCol = rc && VR.Looks ? ((c) => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255])(VR.Looks.from565(rc)) : null;
        const faces = [];
        if (shape === SH.CUBE) for (let f = 0; f < 6; f++) { const fp = VR.MODEL.facePos(f, [0, 0, 0, 16, 16, 16]).map(v => v / 16); faces.push({ p: fp, uv: [0, 0, 0, 16, 16, 16, 16, 0], tex: R.T.tex[s * 6 + f], dir: f, tint: 1 }); }
        else if (R.models[s]) for (const f of R.models[s]) faces.push(f);
        else { const tx = R.T.tex[s * 6 + 4]; for (const q of VR.MODEL.cross(tx, {})) faces.push(q); }
        const crossLike = shape !== SH.CUBE && !R.models[s];
        for (const f of faces) {
          const N = [VR.DX[f.dir] || 0, VR.DY[f.dir] || 0, VR.DZ[f.dir] || 0];
          const layer = f.tex & 0xfff;
          // opaque textures carry the tint mask in alpha (grass sides): tint every face, the mask decides
          const opq = opaqueLayer && !crossLike;
          const useT = rcCol || (R.T.tint[s] && (opq || shape !== SH.CUBE || f.dir === 2 || !t.o.soil) ? tint : [1, 1, 1]);
          const sh = (opq ? -1 : 1) * (rcCol ? 3 : 1);
          const idx = [0, 1, 2, 0, 2, 3];
          for (const k of idx) push(f.p[k * 3] - 0.5, f.p[k * 3 + 1] - 0.5, f.p[k * 3 + 2] - 0.5, f.uv[k * 2] / 16, f.uv[k * 2 + 1] / 16, layer, N[0], N[1], N[2], useT, sh);
          if (f.double) for (const k of [0, 2, 1, 0, 3, 2]) push(f.p[k * 3] - 0.5, f.p[k * 3 + 1] - 0.5, f.p[k * 3 + 2] - 0.5, f.uv[k * 2] / 16, f.uv[k * 2 + 1] / 16, layer, -N[0], -N[1], -N[2], useT, sh);
        }
        m = { verts, block: true };
      } else {
        const d = VR.ITEMS[id];
        const layer = d ? d.tex : 0;
        const A = this.game.tex.albedo[0], Nn = this.game.tex.size, off = layer * Nn * Nn * 4;
        const a = (x, y) => (x < 0 || y < 0 || x >= Nn || y >= Nn) ? 0 : A[off + (y * Nn + x) * 4 + 3] > 127;
        const th = 1 / 32, W = [1, 1, 1];
        // front/back
        for (const [z, n] of [[th, 1], [-th, -1]]) {
          const q = [[-0.5, 0.5, z, 0, 0], [-0.5, -0.5, z, 0, 1], [0.5, -0.5, z, 1, 1], [0.5, 0.5, z, 1, 0]];
          const order = n > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
          for (const k of order) push(q[k][0], q[k][1], q[k][2], q[k][3], q[k][4], layer, 0, 0, n, W);
        }
        // edges from alpha
        const px = 1 / Nn;
        for (let y = 0; y < Nn; y++) for (let x = 0; x < Nn; x++) {
          if (!a(x, y)) continue;
          const x0 = -0.5 + x * px, x1 = x0 + px, y1 = 0.5 - y * px, y0 = y1 - px;
          const u = (x + 0.5) / Nn, v = (y + 0.5) / Nn;
          const quad = (pts, n) => { for (const k of [0, 1, 2, 0, 2, 3]) push(pts[k][0], pts[k][1], pts[k][2], u, v, layer, n[0], n[1], n[2], W); };
          if (!a(x - 1, y)) quad([[x0, y1, -th], [x0, y0, -th], [x0, y0, th], [x0, y1, th]], [-1, 0, 0]);
          if (!a(x + 1, y)) quad([[x1, y1, th], [x1, y0, th], [x1, y0, -th], [x1, y1, -th]], [1, 0, 0]);
          if (!a(x, y - 1)) quad([[x0, y1, -th], [x0, y1, th], [x1, y1, th], [x1, y1, -th]], [0, 1, 0]);
          if (!a(x, y + 1)) quad([[x0, y0, th], [x0, y0, -th], [x1, y0, -th], [x1, y0, th]], [0, -1, 0]);
        }
        m = { verts, block: false };
      }
      const gl = this.game.renderer.gl;
      m.vao = gl.createVertexArray(); m.vbo = gl.createBuffer();
      gl.bindVertexArray(m.vao); gl.bindBuffer(gl.ARRAY_BUFFER, m.vbo); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 52, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 52, 12);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 52, 24);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 52, 36);
      gl.bindVertexArray(null);
      m.count = verts.length / 13;
      this.meshCache.set(id, m);
      return m;
    }
    beginMesh(r, E, viewProj) {
      const gl = r.gl, p = r.P.mesh;
      gl.useProgram(p.p); r.common(p, E);
      gl.uniformMatrix4fv(p.u.u_viewProj, false, viewProj || r.viewProj);
      if (p.u.u_avgLum && r.texAvgLum) { gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, r.texAvgLum); gl.uniform1i(p.u.u_avgLum, 7); }
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, r.texAlbedo); gl.uniform1i(p.u.u_albedo, 0);
      gl.uniform1f(p.u.u_flash, 0);
      return p;
    }
    drawMesh(r, p, mesh, M, light, noFog) {
      const gl = r.gl;
      gl.uniform1f(p.u.u_sky, light.sky); gl.uniform3f(p.u.u_blockLight, light.bl[0], light.bl[1], light.bl[2]);
      gl.uniform1f(p.u.u_noFog, noFog ? 1 : 0);
      gl.uniformMatrix4fv(p.u.u_model, false, M);
      gl.bindVertexArray(mesh.vao);
      gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    }
    drawItems(r, E, cam) {
      if (!this.items.length && !this.falling.length) return;
      const gl = r.gl, p = this.beginMesh(r, E);
      gl.disable(gl.CULL_FACE);
      const M = this.tmp2;
      for (const it of this.items) {
        const dx = it.pos[0] - cam.x, dy = it.pos[1] - cam.y, dz = it.pos[2] - cam.z;
        if (dx * dx + dz * dz > 60 * 60) continue;
        const mesh = this.itemMesh(it.stack.id);
        M.set(mat4.create());
        mat4.translate(M, M, dx, dy + 0.18 + Math.sin(it.age * 2.5) * 0.06, dz);
        mat4.rotY(M, M, it.spin);
        const sc = mesh.block ? 0.28 : 0.42;
        mat4.scale(M, M, sc, sc, sc);
        this.drawMesh(r, p, mesh, M, this.lightAt(it.pos[0], it.pos[1] + 0.3, it.pos[2]));
        if (it.stack.n > 1) { const M2 = mat4.create(); M2.set(M); mat4.translate(M2, M2, 0.18, 0.12, 0.18); this.drawMesh(r, p, mesh, M2, this.lightAt(it.pos[0], it.pos[1] + 0.3, it.pos[2])); }
      }
      for (const f of this.falling) {
        const id = R.types[R.T.type[f.state]].name;
        const mesh = this.itemMesh(id);
        M.set(mat4.create());
        mat4.translate(M, M, f.pos[0] - cam.x, f.pos[1] + 0.5 - cam.y, f.pos[2] - cam.z);
        if (f.tnt) { const sc = 1 + Math.max(0, 0.6 - f.fuse) * 0.25; mat4.scale(M, M, sc, sc, sc); }
        const lt = this.lightAt(f.pos[0], f.pos[1] + 0.5, f.pos[2]);
        if (f.tnt && Math.floor(f.fuse * 4) % 2 === 0) { lt.sky = 1; lt.bl = [1, 1, 1]; }
        this.drawMesh(r, p, mesh, M, lt);
      }
      gl.enable(gl.CULL_FACE);
    }
    // ---------------------------------------------------------------- first-person hand
    drawHand(r, E, cam) {
      const g = this.game, pl = g.player, gl = r.gl;
      if (g.cockpit && g.cockpit.active()) { g.cockpit.draw(r, E, cam); return; }
      if (pl.dead || g.ui.screen === 'inventory' || (g.gadgets && g.gadgets.riding)) return;
      const aspect = r.W / r.H;
      const proj = mat4.perspective(mat4.create(), 70 * Math.PI / 180, aspect, 0.02, 10);
      const vp = mat4.mul(mat4.create(), proj, r.view);
      const inv = mat4.invert(mat4.create(), r.view);
      const light = this.lightAt(pl.pos[0], pl.pos[1] + pl.eye, pl.pos[2]);
      const swing = pl.handSwing, sw = Math.sin(swing * Math.PI), sw2 = Math.sin(Math.sqrt(Math.max(0, swing)) * Math.PI);
      const bobX = Math.sin(pl.bob * 2) * 0.03 * pl.bobAmt, bobY = Math.abs(Math.cos(pl.bob * 2)) * 0.035 * pl.bobAmt;
      const t = g.time || 0, idle = Math.sin(t * 1.3) * 0.006;
      const held = pl.inv.held;
      // camera-space arm: shoulder below the bottom-right corner, fist reaching toward the view centre
      const S = [0.64 + bobX, -0.8 - bobY + idle, -0.16];
      const F = [0.32 + bobX - sw2 * 0.17, -0.38 - bobY + idle - sw * 0.1 + sw2 * 0.05, -0.8 - sw * 0.16];
      if (held) { F[0] += 0.02; F[1] -= 0.02; }
      const d = [F[0] - S[0], F[1] - S[1], F[2] - S[2]];
      const dl = Math.hypot(d[0], d[1], d[2]); d[0] /= dl; d[1] /= dl; d[2] /= dl;
      const Y = [-d[0], -d[1], -d[2]];
      const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      let X = cr([0, 1, 0], Y); const xl = Math.hypot(X[0], X[1], X[2]) || 1; X = [X[0] / xl, X[1] / xl, X[2] / xl];
      const Z = cr(X, Y);
      const A = mat4.create();
      A[0] = X[0]; A[1] = X[1]; A[2] = X[2]; A[4] = Y[0]; A[5] = Y[1]; A[6] = Y[2]; A[8] = Z[0]; A[9] = Z[1]; A[10] = Z[2];
      A[12] = S[0]; A[13] = S[1]; A[14] = S[2];
      const armM = mat4.mul(mat4.create(), inv, A);
      mat4.scale(armM, armM, 1 / 32, 1 / 32, 1 / 32);
      // arm (suit sleeve + glove)
      const model = VR.getVoxModel(gl, 'fp_arm');
      if (model && model.parts.arm) {
        const p = this.beginVox(r, E, vp);
        gl.uniform1f(p.u.u_sky, light.sky); gl.uniform3f(p.u.u_blockLight, light.bl[0], light.bl[1], light.bl[2]);
        gl.uniform1f(p.u.u_flash, 0); gl.uniform3f(p.u.u_tint, 1, 1, 1); gl.uniform1f(p.u.u_noFog, 1);
        gl.uniformMatrix4fv(p.u.u_model, false, armM);
        const pr = model.parts.arm;
        gl.bindVertexArray(pr.vao); gl.drawArrays(gl.TRIANGLES, 0, pr.count);
      }
      if (!held) return;
      // the held item sits in the glove
      const fist = [S[0] + d[0] * dl * 0.9, S[1] + d[1] * dl * 0.9, S[2] + d[2] * dl * 0.9];
      const mesh = this.itemMesh(held.id);
      const p = this.beginMesh(r, E, vp);
      gl.disable(gl.CULL_FACE);
      const def = VR.itemDef(held.id);
      const L = mat4.create(); L.set(inv);
      if (mesh.block) {
        // a block rests on top of the glove (smaller than before so the hand stays visible)
        mat4.translate(L, L, fist[0] - 0.035, fist[1] + 0.115, fist[2] - 0.06);
        mat4.rotY(L, L, 0.78 - sw * 0.35); mat4.rotX(L, L, -0.18 - sw * 0.5);
        mat4.scale(L, L, 0.235, 0.235, 0.235);
      } else {
        mat4.translate(L, L, fist[0] - 0.03, fist[1] + 0.1, fist[2] - 0.02);
        mat4.rotY(L, L, -1.35); mat4.rotZ(L, L, def && def.tool ? 0.62 : 0.25); mat4.rotX(L, L, -sw * 1.1);
        mat4.scale(L, L, 0.44, 0.44, 0.44);
      }
      this.drawMesh(r, p, mesh, L, light, true);
      gl.enable(gl.CULL_FACE);
    }
    onColumnLoaded(c) {
      // generator-requested spawns (parked hoverbikes) are handled by Gadgets (with de-duplication)
      void c;
    }
  }
  VR.Entities = Entities;
})(VR);
