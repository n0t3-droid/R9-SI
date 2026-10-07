// ============================================================================
// Player: movement physics (walk/sprint/sneak/swim/climb/fly), camera, target
// raycast, mining & placing, inventory, survival stats (health/food/air).
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, F = VR.F, PH = VR.PHYS, M = VR.M;
  const W = 0.3, H = 1.8, EYE = 1.62, SNEAK_EYE = 1.27;

  class Inventory {
    constructor() { this.slots = new Array(36).fill(null); this.armor = [null, null, null, null]; this.offhand = null; this.sel = 0; this.changed = true; }
    get held() { return this.slots[this.sel]; }
    add(id, n) {
      const max = VR.maxStack(id);
      let left = n;
      // merge into existing stacks (hotbar first)
      for (let i = 0; i < 36 && left > 0; i++) { const s = this.slots[i]; if (s && s.id === id && s.n < max && !s.dmg) { const k = Math.min(max - s.n, left); s.n += k; left -= k; } }
      for (let i = 0; i < 36 && left > 0; i++) if (!this.slots[i]) { const k = Math.min(max, left); this.slots[i] = { id, n: k }; left -= k; }
      this.changed = true;
      return n - left;
    }
    count(id) { let c = 0; for (const s of this.slots) if (s && s.id === id) c += s.n; return c; }
    remove(id, n) { for (let i = 35; i >= 0 && n > 0; i--) { const s = this.slots[i]; if (s && s.id === id) { const k = Math.min(s.n, n); s.n -= k; n -= k; if (!s.n) this.slots[i] = null; } } this.changed = true; return n === 0; }
    consumeHeld(n) { const s = this.slots[this.sel]; if (!s) return; s.n -= n || 1; if (s.n <= 0) this.slots[this.sel] = null; this.changed = true; }
    toJSON() { return { slots: this.slots, armor: this.armor, offhand: this.offhand, sel: this.sel }; }
    load(o) { if (!o) return; this.slots = (o.slots || []).slice(0, 36); while (this.slots.length < 36) this.slots.push(null); this.armor = o.armor || [null, null, null, null]; this.offhand = o.offhand || null; this.sel = o.sel || 0; this.changed = true; }
  }
  VR.Inventory = Inventory;

  class Player {
    constructor(game) {
      this.game = game;
      this.pos = [0.5, 100, 0.5]; this.vel = [0, 0, 0];
      this.yaw = 0; this.pitch = 0; this.roll = 0;
      this.onGround = false; this.flying = false; this.sprinting = false; this.sneaking = false;
      this.inWater = false; this.inLava = false; this.headInWater = false; this.onLadder = false;
      this.mode = 'creative';
      this.health = 20; this.food = 20; this.sat = 5; this.exhaust = 0; this.air = 300; this.xp = 0; this.level = 0;
      this.fallStart = null; this.hurtTime = 0; this.dead = false; this.regenTimer = 0; this.starveTimer = 0;
      this.inv = new Inventory();
      this.target = null;
      this.breaking = null; this.breakCooldown = 0; this.placeCooldown = 0;
      this.bob = 0; this.bobAmt = 0; this.fovKick = 0; this.eye = EYE; this.stepDist = 0;
      this.jumpCooldown = 0;
      this.spawn = [0.5, 100, 0.5];
      this.handSwing = 0;
      this.useTime = 0;
      this.reach = 5;
      this.flySpeed = 1;
      this.noclip = false;
    }
    get creative() { return this.mode !== 'survival'; }
    get zen() { return this.mode === 'zen'; }
    eyePos() { return [this.pos[0], this.pos[1] + this.eye, this.pos[2]]; }
    lookDir() { const cp = Math.cos(this.pitch); return [-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp]; }
    setMode(m) { this.mode = m; if (m === 'survival') this.flying = false; this.game.ui && this.game.ui.updateHUD(true); }
    // (a destination with a number gone bad — "/tp a b c", a corrupt save — is refused: the player stays where they are)
    teleport(x, y, z) { if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return false; this.pos = [x, y, z]; this.vel = [0, 0, 0]; this.fallStart = null; return true; }
    // the player is somewhere real: every number of the position, velocity and view finite. A NaN anywhere (a bad
    // command, a bug in a vehicle or a cutscene) would otherwise spread into every frame — the world vanishes, nothing
    // loads, the save is poisoned. The position goes back to the last good one (or the spawn), the rest to rest.
    sane() {
      const p = this.pos, v = this.vel;
      if (!Number.isFinite(p[0]) || !Number.isFinite(p[1]) || !Number.isFinite(p[2])) {
        const g = this.lastGood || (Array.isArray(this.spawn) && this.spawn.every(Number.isFinite) ? this.spawn : null) || this.game.worldSpawn();
        this.pos = [g[0], g[1], g[2]]; this.vel = [0, 0, 0]; this.fallStart = null;
        if (!this.badWarned) { this.badWarned = true; console.warn('player position was not a number — restored'); }
      }
      if (!Number.isFinite(v[0]) || !Number.isFinite(v[1]) || !Number.isFinite(v[2])) this.vel = [0, 0, 0];
      if (!Number.isFinite(this.yaw)) this.yaw = 0;
      if (!Number.isFinite(this.pitch)) this.pitch = 0;
      if (!this.lastGood) this.lastGood = [0, 0, 0];
      this.lastGood[0] = this.pos[0]; this.lastGood[1] = this.pos[1]; this.lastGood[2] = this.pos[2];
    }
    // teleport somewhere that may not be loaded yet: wait there (no falling) until the ground
    // is loaded, then stand on the nearest safe spot (never inside a wall, never in the void)
    // o: fly (stay in the air there, creative) · exact (that very spot) · keep (that spot when it is free, else the
    // nearest free one, outdoors first — a house set onto it meanwhile never traps you) · yaw/pitch (look that way)
    safeTeleport(x, y, z, o) {
      if (!this.teleport(x, y, z)) return false;
      this.hold = { x, y, z, t: 0, fly: !!(o && o.fly), exact: !!(o && o.exact), keep: !!(o && o.keep), bed: o && o.bed ? o.bed : null, yaw: o && Number.isFinite(o.yaw) ? o.yaw : null, pitch: o && Number.isFinite(o.pitch) ? o.pitch : null };
      if (this.hold.yaw !== null) { this.yaw = this.hold.yaw; this.pitch = this.hold.pitch || 0; }
    }
    // room for a body here: feet and head not in a solid block, not in lava
    isFree(x, y, z) {
      const w = this.game.world, T = R.T, fx = Math.floor(x), fy = Math.floor(y + 0.01), fz = Math.floor(z);
      const bad = (yy) => !!(T.flags[w.getBlock(fx, yy, fz)] & (F.SOLID | F.LAVA));
      return !bad(fy) && !bad(fy + 1);
    }
    // stuck in a block (something was built where you stand)? out to the nearest free spot, outdoors first
    unstick() {
      if (this.dead || this.hold || this.isFree(this.pos[0], this.pos[1], this.pos[2])) return false;
      const p = this.groundNear(this.pos[0], this.pos[1], this.pos[2], { out: true });
      this.pos = p; this.vel = [0, 0, 0]; this.fallStart = null;
      return true;
    }
    // the closest floor to stand on near a spot: few blocks away and little up or down is best; with o.out a spot
    // under the open sky is preferred to one inside (beside a house rather than in it, beside rather than on top)
    groundNear(x, y, z, o) {
      const w = this.game.world, T = R.T, out = !!(o && o.out);
      const solid = (xx, yy, zz) => { const s = w.getBlock(xx, yy, zz); return !!(T.flags[s] & F.SOLID); };
      const fluid = (xx, yy, zz) => { const s = w.getBlock(xx, yy, zz); return !!(T.flags[s] & (F.LAVA)); };
      const free = (xx, yy, zz) => !solid(xx, yy, zz) && !solid(xx, yy + 1, zz) && !fluid(xx, yy, zz) && !fluid(xx, yy + 1, zz);
      const fx = Math.floor(x), fz = Math.floor(z), fy = Math.floor(y);
      const RMAX = out ? 9 : 6;
      let best = null, bestC = 1e9;
      for (let r = 0; r <= RMAX; r++) {
        if (best && r > bestC) break;            // nothing further away can be better
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const cx = fx + dx, cz = fz + dz;
          if (!w.isLoaded(cx, cz)) continue;
          const top = out ? w.topAt(cx, cz) : 0;
          // stand on the closest floor near the wanted height (search down first, then up)
          for (let k = 0; k < 48; k++) {
            if (best && r + k * 1.2 >= bestC) break;
            for (const yy of [fy - k, fy + k + 1]) {
              if (yy < 1 || yy > 253) continue;
              if (!(solid(cx, yy - 1, cz) && free(cx, yy, cz))) continue;
              const c = r + Math.abs(yy - fy) * 1.2 + (out && yy <= top ? 6 : 0);
              if (c < bestC) { bestC = c; best = [cx + 0.5, yy, cz + 0.5]; }
            }
          }
        }
      }
      if (best) return best;
      const top = w.topAt(fx, fz);
      return [fx + 0.5, Math.min(254, top + 1), fz + 0.5];
    }

    // ---------------------------------------------------------------- update
    update(dt, input) {
      const g = this.game, world = g.world;
      if (this.dead) return;
      this.sane();
      if (this.hold) {
        // waiting for the destination to load: stay put, look around
        const H = this.hold;
        H.t += dt;
        const loaded = world.isLoaded(Math.floor(H.x), Math.floor(H.z)) && world.isLoaded(Math.floor(H.x) + 8, Math.floor(H.z)) && world.isLoaded(Math.floor(H.x) - 8, Math.floor(H.z));
        if (!loaded && H.t < 30) {
          this.pos = [H.x, H.y, H.z]; this.vel = [0, 0, 0]; this.fallStart = null;
          const sens0 = input.sensitivity; this.yaw -= input.mouse.dx * sens0; this.pitch = M.clamp(this.pitch - input.mouse.dy * sens0 * (input.invertY ? -1 : 1), -Math.PI / 2 + 0.001, Math.PI / 2 - 0.001);
          return;
        }
        this.hold = null;
        if (H.bed) {
          // the bed you slept in is gone? back to the world's spawn
          const s = world.getBlock(H.bed[0], H.bed[1], H.bed[2]), t = R.types[R.T.type[s]];
          if (!t || !(t.o.bed || t.o.kind === 'bed')) { const ws = g.worldSpawn(); this.spawn = ws.slice(); g.ui && g.ui.chatLine('Your bed is missing — back to the world spawn.', '#ffb86a'); this.safeTeleport(ws[0], ws[1], ws[2]); return; }
        }
        const keepOk = H.keep && this.isFree(H.x, H.y, H.z);
        if (H.fly && this.creative && (!H.keep || keepOk)) { this.pos = [H.x, H.y, H.z]; this.flying = true; }
        else { const p = H.exact || keepOk ? [H.x, H.y, H.z] : this.groundNear(H.x, H.y, H.z, { out: H.keep }); this.pos = p; }
        if (H.yaw !== null && H.yaw !== undefined) { this.yaw = H.yaw; this.pitch = H.pitch || 0; }
        this.vel = [0, 0, 0]; this.fallStart = null;
      }
      const get = g.starships ? g.starships.getFn() : (x, y, z) => world.getBlock(x, y, z);
      const nb = world.nbFn();
      // ---------- look ----------
      const sens = input.sensitivity * (g.zoom ? 0.3 : 1);
      this.yaw -= input.mouse.dx * sens;
      this.pitch -= input.mouse.dy * sens * (input.invertY ? -1 : 1);
      this.pitch = M.clamp(this.pitch, -Math.PI / 2 + 0.001, Math.PI / 2 - 0.001);
      if (input.hit('ArrowLeft')) this.yaw += 0.2; if (input.hit('ArrowRight')) this.yaw -= 0.2;
      // ---------- environment probes ----------
      const feet = get(Math.floor(this.pos[0]), Math.floor(this.pos[1] + 0.1), Math.floor(this.pos[2]));
      const mid = get(Math.floor(this.pos[0]), Math.floor(this.pos[1] + 0.9), Math.floor(this.pos[2]));
      const head = get(Math.floor(this.pos[0]), Math.floor(this.pos[1] + this.eye), Math.floor(this.pos[2]));
      const TF = R.T.flags;
      this.inWater = !!((TF[feet] | TF[mid]) & F.WATER) || this.aetherAt(feet) || this.aetherAt(mid);
      this.inLava = !!((TF[feet] | TF[mid]) & F.LAVA);
      this.headInWater = !!(TF[head] & (F.WATER | F.LAVA)) || this.aetherAt(head);
      this.onLadder = !!((TF[feet] | TF[mid]) & F.CLIMB);
      const slow = !!((TF[feet]) & F.SLOW) || R.T.type[feet] === (R.byName.cobweb && R.byName.cobweb.id);
      // ---------- movement intent ----------
      const typing = g.ui && g.ui.typing;
      const k = (c) => !typing && input.down(c);
      let fw = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0);
      let st = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0);
      const jump = k('Space'), sneak = k('ShiftLeft') || k('ShiftRight');
      if ((input.dbl('KeyW') || k('ControlLeft')) && fw > 0 && !sneak && (this.food > 6 || this.creative)) this.sprinting = true;
      if (fw <= 0 || sneak || (this.hitWall && !this.flying)) this.sprinting = false;
      if (this.creative && !typing && input.dbl('Space')) { this.flying = !this.flying; this.vel[1] = 0; }
      if (this.flying && this.onGround && !jump && this.vel[1] < 0 && !this.noclip) this.flying = false;
      this.sneaking = sneak && !this.flying;
      const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
      let wx = -sy * fw + cy * st, wz = -cy * fw - sy * st;
      const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
      // ---------- velocity ----------
      const v = this.vel;
      if (this.flying) {
        const sp = 11 * this.flySpeed * (this.sprinting ? 2.1 : 1);
        const tx = wx * sp, tz = wz * sp, ty = ((jump ? 1 : 0) - (sneak ? 1 : 0)) * 8 * this.flySpeed * (this.sprinting ? 1.5 : 1);
        const a = 1 - Math.exp(-dt * 9);
        v[0] += (tx - v[0]) * a; v[2] += (tz - v[2]) * a; v[1] += (ty - v[1]) * a;
      } else if (this.inWater || this.inLava) {
        const sp = this.inLava ? 1.6 : (this.sprinting ? 5.2 : 3.2);
        const a = 1 - Math.exp(-dt * 5);
        if (this.sprinting && this.inWater && this.headInWater) { // swim along look direction
          const d = this.lookDir(); v[0] += (d[0] * sp * fw - v[0]) * a; v[2] += (d[2] * sp * fw - v[2]) * a; v[1] += (d[1] * sp * fw - v[1]) * a;
        } else {
          v[0] += (wx * sp - v[0]) * a; v[2] += (wz * sp - v[2]) * a;
          v[1] -= (this.inLava ? 4 : 5) * dt;
          if (jump) v[1] = Math.min(v[1] + 22 * dt, 4.2);
          if (sneak) v[1] -= 6 * dt;
          v[1] *= Math.exp(-dt * 2.2);
        }
      } else {
        let sp = this.sneaking ? 1.3 : this.sprinting ? 5.6 : 4.3;
        if (this.speedTimer > 0) { this.speedTimer -= dt; sp *= 1.3; }
        if (slow) sp *= 0.4;
        if (this.game.statusSpeed) sp *= this.game.statusSpeed;
        const accel = this.onGround ? 14 : 3.2;
        const a = 1 - Math.exp(-dt * accel);
        v[0] += (wx * sp - v[0]) * a; v[2] += (wz * sp - v[2]) * a;
        v[1] -= 30 * dt;
        if (v[1] < -78) v[1] = -78;
        this.jumpCooldown -= dt;
        if (jump && this.onGround && this.jumpCooldown <= 0) {
          v[1] = 9.1; this.jumpCooldown = 0.25; this.onGround = false;
          if (this.sprinting) { v[0] += wx * 1.6; v[2] += wz * 1.6; }
          this.exhaust += this.sprinting ? 0.2 : 0.05;
        }
        if (this.onLadder) {
          v[0] *= 0.85; v[2] *= 0.85;
          if (jump || (this.hitWall && fw > 0)) v[1] = 2.4; else if (sneak) v[1] = Math.max(v[1], 0); else v[1] = Math.max(v[1], -2.4);
        }
      }
      // ---------- collide ----------
      let mx = v[0] * dt, my = v[1] * dt, mz = v[2] * dt;
      if (this.sneaking && this.onGround && !this.flying) {
        // edge guard: don't walk off ledges while sneaking
        const guard = (dx, dz) => PH.overlaps(get, this.pos[0] + dx - W + 0.01, this.pos[1] - 0.61, this.pos[2] + dz - W + 0.01, this.pos[0] + dx + W - 0.01, this.pos[1] - 0.01, this.pos[2] + dz + W - 0.01, nb);
        if (mx && !guard(mx, 0)) { mx = 0; v[0] = 0; }
        if (mz && !guard(0, mz)) { mz = 0; v[2] = 0; }
        if (mx && mz && !guard(mx, mz)) { mx = 0; mz = 0; }
      }
      // unstuck: something solid appeared inside the player (placed by a villager, a machine, a chunk reload…) → step out
      if (!this.noclip && PH.overlaps(get, this.pos[0] - W + 0.02, this.pos[1] + 0.02, this.pos[2] - W + 0.02, this.pos[0] + W - 0.02, this.pos[1] + H * (this.sneaking ? 0.83 : 1) - 0.05, this.pos[2] + W - 0.02, nb)) {
        this.stuckT = (this.stuckT || 0) + dt;
        if (this.stuckT > 0.12) { this.stuckT = 0; const fp = this.freeSpot(get, nb, W, H); if (fp) { this.pos[0] = fp[0]; this.pos[1] = fp[1]; this.pos[2] = fp[2]; if (v[1] < 0) v[1] = 0; mx = 0; my = 0; mz = 0; } }
      } else this.stuckT = 0;
      const prevY = this.pos[1];
      let res;
      // smooth ground: a grounded body follows the sloped surface (no falling-and-snapping between the triangles)
      let follow = null;
      if (!this.flying && !this.noclip && this.onGround && v[1] <= 0) { follow = PH.walkSmooth(get, this.pos, mx, mz); if (follow !== null) { my = follow; v[1] = 0; } }
      if (this.noclip) { this.pos[0] += mx; this.pos[1] += my; this.pos[2] += mz; res = { onGround: false, hitX: false, hitZ: false, hitY: false }; }
      else res = PH.move(get, this.pos, W, H * (this.sneaking ? 0.83 : 1), mx, my, mz, this.flying ? 0.6 : 0.6, nb, this.onGround && !this.flying);
      this.hitWall = res.hitX || res.hitZ;
      if (res.hitX) v[0] = 0; if (res.hitZ) v[2] = 0;
      if (follow !== null) { this.onGround = true; v[1] = 0; }
      else {
        if (res.hitY) { if (v[1] < 0) this.onGround = true; v[1] = 0; } else this.onGround = res.onGround;
        if (res.stepped) this.stepSmooth = (this.stepSmooth || 0) - res.stepped;
        if (my < 0 && !res.hitY) this.onGround = false;
        // landing on smooth ground: stand on the sloped surface, not on the block top under it
        if (!this.flying && !this.noclip && v[1] <= 0 && PH.snapSmooth(get, this.pos)) { this.onGround = true; v[1] = 0; }
      }
      // bouncy blocks
      if (this.onGround && !this.sneaking) { const below = get(Math.floor(this.pos[0]), Math.floor(this.pos[1] - 0.05), Math.floor(this.pos[2])); if (TF[below] & F.BOUNCY && this.lastVy < -3) { v[1] = -this.lastVy * 0.8; this.onGround = false; this.fallStart = null; } }
      this.lastVy = v[1] || this.lastVy;
      if (!res.hitY) this.lastVy = v[1];
      // ---------- fall damage ----------
      if (!this.onGround && !this.flying && !this.inWater && !this.onLadder) { if (this.fallStart === null || this.pos[1] > this.fallStart) this.fallStart = this.pos[1]; }
      else {
        if (this.fallStart !== null && !this.creative) {
          const d = this.fallStart - this.pos[1];
          const below = get(Math.floor(this.pos[0]), Math.floor(this.pos[1] - 0.05), Math.floor(this.pos[2]));
          const soft = TF[below] & (F.BOUNCY) || (R.types[R.T.type[below]] && /hay|slime|honey|bed/.test(R.types[R.T.type[below]].name));
          if (d > 3.4 && !this.inWater) this.damage(Math.floor(d - 3) * (soft ? 0.2 : 1), 'fall');
        }
        this.fallStart = null;
      }
      void prevY;
      // ---------- camera ----------
      const targetEye = this.sneaking ? SNEAK_EYE : EYE;
      this.eye += (targetEye - this.eye) * Math.min(1, dt * 12);
      const hs = Math.hypot(v[0], v[2]);
      if (this.onGround && hs > 0.1 && !this.flying) { this.bob += hs * dt * 1.55; this.bobAmt = Math.min(1, this.bobAmt + dt * 4); this.stepDist += hs * dt; }
      else this.bobAmt = Math.max(0, this.bobAmt - dt * 4);
      if (this.stepDist > 2.2) { this.stepDist = 0; g.audio && g.audio.step(this.blockBelow()); }
      const kick = (this.sprinting ? 0.1 : 0) + (this.flying && this.sprinting ? 0.08 : 0);
      this.fovKick += (kick - this.fovKick) * Math.min(1, dt * 6);
      if (this.stepSmooth) { this.stepSmooth *= Math.exp(-dt * 14); if (Math.abs(this.stepSmooth) < 0.01) this.stepSmooth = 0; }
      // ---------- survival ----------
      this.survival(dt);
      // ---------- interaction ----------
      this.interact(dt, input);
      this.handSwing = Math.max(0, this.handSwing - dt * 3.2);
      // void
      if (this.pos[1] < -40) { if (this.creative) this.teleport(this.pos[0], 140, this.pos[2]); else this.damage(40, 'void'); }
      this.sane();
    }
    // nearest spot where the player's box fits: straight up first (like climbing out), then sideways
    freeSpot(get, nb, W, H) {
      const x = this.pos[0], y = this.pos[1], z = this.pos[2];
      const fits = (px, py, pz) => !PH.overlaps(get, px - W + 0.02, py + 0.02, pz - W + 0.02, px + W - 0.02, py + H - 0.05, pz + W - 0.02, nb);
      const by = Math.floor(y);
      for (let dy = 0; dy <= 6; dy++) { const py = dy === 0 ? y : by + dy; if (fits(x, py, z)) return [x, py, z]; }
      const bx = Math.floor(x) + 0.5, bz = Math.floor(z) + 0.5;
      for (let r = 1; r <= 2; r++) for (const [dx, dz] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, r], [r, -r], [-r, -r]]) for (let dy = 0; dy <= 3; dy++) { if (fits(bx + dx, by + dy, bz + dz)) return [bx + dx, by + dy, bz + dz]; }
      return null;
    }
    aetherAt(s) { const t = R.types[R.T.type[s]]; return !!(t && t.o.aether); }
    blockBelow() { const w = this.game.world; return w.getBlock(Math.floor(this.pos[0]), Math.floor(this.pos[1] - 0.2), Math.floor(this.pos[2])); }

    // ---------------------------------------------------------------- survival
    survival(dt) {
      const g = this.game;
      this.hurtTime = Math.max(0, this.hurtTime - dt);
      if (this.creative) { this.air = 300; return; }
      // air
      if (this.headInWater) { this.air -= dt * 20; if (this.air <= -20) { this.air = 0; this.damage(2, 'drown'); } }
      else this.air = Math.min(300, this.air + dt * 60);
      if (this.inLava) { this.lavaTimer = (this.lavaTimer || 0) - dt; if (this.lavaTimer <= 0) { this.lavaTimer = 0.5; this.damage(4, 'lava'); this.onFire = 6; } }
      if (this.onFire > 0) { this.onFire -= dt; if (this.inWater) this.onFire = 0; this.fireTimer = (this.fireTimer || 0) - dt; if (this.fireTimer <= 0) { this.fireTimer = 1; this.damage(1, 'fire'); } }
      // hunger
      const hs = Math.hypot(this.vel[0], this.vel[2]);
      if (this.sprinting) this.exhaust += hs * dt * 0.1;
      if (this.inWater) this.exhaust += hs * dt * 0.01;
      if (this.exhaust >= 4) { this.exhaust -= 4; if (this.sat > 0) this.sat = Math.max(0, this.sat - 1); else if (g.difficulty !== 'peaceful') this.food = Math.max(0, this.food - 1); }
      this.regenTimer += dt;
      if (g.difficulty === 'peaceful') { if (this.regenTimer > 1) { this.regenTimer = 0; this.heal(1); if (this.food < 20) this.food++; } }
      else if (this.food >= 18 && this.health < 20) { const rate = this.sat > 0 && this.food === 20 ? 0.5 : 4; if (this.regenTimer >= rate) { this.regenTimer = 0; this.heal(1); this.exhaust += 6; } }
      else if (this.food === 0) { this.starveTimer += dt; if (this.starveTimer > 4) { this.starveTimer = 0; const lim = g.difficulty === 'hard' ? 0 : g.difficulty === 'normal' ? 1 : 10; if (this.health > lim) this.damage(1, 'starve'); } }
    }
    heal(n) { this.health = Math.min(20, this.health + n); this.game.ui && this.game.ui.updateHUD(); }
    damage(n, cause, src) {
      if (this.creative || this.dead || n <= 0) return;
      if (this.hurtTime > 0.35 && cause !== 'void' && cause !== 'starve' && cause !== 'drown') return;
      // armor reduction
      let armor = 0; for (const a of this.inv.armor) if (a) { const d = VR.itemDef(a.id); if (d && d.armor) armor += d.armor; }
      if (cause !== 'void' && cause !== 'starve' && cause !== 'drown' && cause !== 'fall') n = n * (1 - Math.min(20, armor) / 25);
      this.health -= n;
      this.hurtTime = 0.5;
      this.exhaust += 0.1;
      if (src) { const dx = this.pos[0] - src[0], dz = this.pos[2] - src[2], l = Math.hypot(dx, dz) || 1; this.vel[0] += dx / l * 6; this.vel[2] += dz / l * 6; this.vel[1] = Math.max(this.vel[1], 4.5); }
      const g = this.game;
      g.audio && g.audio.play('hurt');
      g.damageFlash = 1;
      if (this.health <= 0) { this.health = 0; this.die(cause); }
      g.ui && g.ui.updateHUD();
    }
    die(cause) {
      this.dead = true;
      const g = this.game;
      if (!g.keepInventory) { g.dropInventory && g.dropInventory(this); }
      g.ui && g.ui.showDeath(cause);
    }
    respawn() {
      this.dead = false; this.health = 20; this.food = 20; this.sat = 5; this.air = 300; this.onFire = 0;
      const g = this.game, sp = this.spawn && this.spawn.every(v => isFinite(v)) ? this.spawn : g.worldSpawn();
      // a bed spawn remembers the bed; if it was broken meanwhile we fall back to the world spawn
      this.safeTeleport(sp[0], sp[1], sp[2], { bed: this.spawnBed || null });
      g.ui && g.ui.updateHUD(true);
    }
    eat(def) {
      if (!def || (!def.food && !def.heal)) return false;
      if (def.heal && !def.food) { if (this.health >= 20 && !this.creative) return false; this.heal(def.heal); this.game.audio && this.game.audio.play('eat'); return true; }
      if (this.food >= 20 && !this.creative && def.id !== 'golden_apple') return false;
      this.food = Math.min(20, this.food + def.food); this.sat = Math.min(this.food, this.sat + def.sat);
      if (def.effect === 'regen') { this.heal(6); }
      if (def.effect === 'glow') this.game.glowTimer = 60;
      if (def.effect === 'speed') this.speedTimer = 40;
      this.game.audio && this.game.audio.play('eat');
      return true;
    }

    // ---------------------------------------------------------------- targeting / break / place
    interact(dt, input) {
      const g = this.game, world = g.world;
      const eye = this.eyePos(), dir = this.lookDir();
      this.target = g.ui && g.ui.blocking ? null : PH.raycast((x, y, z) => world.getBlock(x, y, z), eye[0], eye[1], eye[2], dir[0], dir[1], dir[2], this.reach, { nb: (x, y, z, d) => world.getBlock(x + VR.HF_DX[d], y, z + VR.HF_DZ[d]) });
      if (g.ui && g.ui.blocking) { this.breaking = null; return; }
      if (!input.captured) return;
      this.breakCooldown -= dt; this.placeCooldown -= dt;
      // scroll hotbar
      if (input.mouse.wheel) { this.inv.sel = ((this.inv.sel + input.mouse.wheel) % 9 + 9) % 9; this.inv.changed = true; }
      for (let i = 0; i < 9; i++) if (input.hit('Digit' + (i + 1))) { this.inv.sel = i; this.inv.changed = true; }
      const held = this.inv.held;
      const hdef = held ? VR.itemDef(held.id) : null;
      // gadgets / item use get first chance
      const gu = g.gadgets && g.gadgets.update(dt, input, this, hdef);
      if (gu) { if (gu !== 'keep') this.breaking = null; return; }
      // --- break ---
      const lmb = input.dragLook ? input.clickAction(0) : input.mouse.down[0];
      if (lmb && this.target) {
        const t = this.target;
        const s = t.state;
        if (this.creative) {
          if (this.breakCooldown <= 0) { this.breakBlock(t.x, t.y, t.z, s, false); this.breakCooldown = input.dragLook ? 0 : 0.22; this.handSwing = 1; }
        } else {
          if (!this.breaking || this.breaking.x !== t.x || this.breaking.y !== t.y || this.breaking.z !== t.z) this.breaking = { x: t.x, y: t.y, z: t.z, p: 0 };
          const time = this.breakTime(s, hdef);
          this.breaking.p += dt / time;
          this.handSwing = 1;
          this.breaking.sound = (this.breaking.sound || 0) - dt;
          if (this.breaking.sound <= 0) { this.breaking.sound = 0.25; g.audio && g.audio.dig(s, false); g.particles && g.particles.hitBlock(t, s); }
          if (this.breaking.p >= 1) { this.breakBlock(t.x, t.y, t.z, s, true); this.breaking = null; this.breakCooldown = 0.12; }
        }
      } else this.breaking = null;
      if (!input.mouse.down[0]) this.breakCooldown = 0;
      // --- pick block (middle) ---
      if (input.mouse.clicked[1] && this.target && this.creative) {
        const t = R.types[R.T.type[this.target.state]];
        if (t && (t.cat || (VR.SMOOTH_OF && VR.SMOOTH_OF[t.name]))) this.pickBlock((VR.SMOOTH_OF && VR.SMOOTH_OF[t.name]) || t.name);
      }
      // --- use / place ---
      // a click uses what the crosshair is on (a door, a lever, a bed, a chest, a lamp …) or the held item, or places the
      // held block. Holding the button keeps PLACING (a row of blocks) — never a use: a held click on a door used to open
      // it and shut it again 0.22 s later, as if nothing had happened.
      const rmbClick = input.dragLook ? input.clickAction(2) : input.mouse.clicked[2];
      const rmbHold = !input.dragLook && input.mouse.down[2] && this.placeCooldown <= 0 && this.placeHeld;
      if (rmbClick) {
        this.placed = false;
        const ok = this.use(hdef, held);
        if (ok) this.handSwing = 1;
        this.placeCooldown = 0.22;
        this.placeHeld = !ok || this.placed;   // after a use the held button rests until it is let go
      } else if (rmbHold) {
        if (this.placeRepeat(hdef, held)) this.handSwing = 1;
        this.placeCooldown = 0.22;
      }
      if (!input.mouse.down[2]) this.placeHeld = false;
    }
    // the held button builds on: the held block only — never onto what a click would use, never an item (food, bucket …)
    placeRepeat(hdef, held) {
      const t = this.target;
      if (!t || !held || (hdef && (hdef.food || hdef.heal || hdef.use))) return false;
      const type = R.byName[held.id];
      if (!type || (!this.sneaking && this.usable(t.state))) return false;
      return this.placeFromHit(type, t);
    }
    // would a right click use this block (open, switch, sit, sleep, open a container …) rather than build onto it?
    usable(s) {
      const t = R.types[R.T.type[s]]; if (!t) return false;
      const o = t.o, k = o.kind;
      return !!(R.T.flags[s] & F.INTERACT) || k === 'door' || k === 'trapdoor' || k === 'gate' || k === 'lever' || k === 'button' || k === 'bed' || k === 'seat' || k === 'helm' || k === 'beacon' ||
        !!(o.ui || o.toggle || o.bed || o.seat || (o.vx && o.vx.kind === 'mdoor')) || /chest$|barrel|cargo_crate|furnace|smoker|crafting_table|note_block|repeater/.test(t.name);
    }
    breakTime(s, hdef) {
      const T = R.T, hard = T.hard[s];
      if (hard < 0) return Infinity;
      if (hard === 0) return 0.05;
      const t = R.types[T.type[s]];
      const o = t ? t.o : {};
      let speed = 1, canHarvest = !o.needTool;
      if (hdef && hdef.tool && o.tool && hdef.tool === o.tool) { speed = hdef.speed; if (!o.tier || hdef.tier >= o.tier) canHarvest = true; }
      else if (o.needTool && hdef && hdef.tool === o.tool) canHarvest = hdef.tier >= (o.tier || 1);
      if (hdef && hdef.tool === 'sword' && t && /cobweb|bamboo/.test(t.name)) speed = 15;
      if (hdef && hdef.tool === 'shears' && t && (T.flags[s] & F.LEAVES || /wool|cobweb|vine/.test(t.name))) speed = 5;
      let time = hard * (canHarvest ? 1.5 : 5) / speed;
      if (!this.onGround && !this.flying) time *= 5;
      if (this.headInWater) time *= 5;
      return Math.max(0.05, time);
    }
    canHarvest(s, hdef) {
      const t = R.types[R.T.type[s]]; if (!t) return false;
      const o = t.o;
      if (!o.needTool) return true;
      return !!(hdef && hdef.tool === o.tool && (hdef.tier || 0) >= (o.tier || 1));
    }
    breakBlock(x, y, z, s, survival) {
      const g = this.game, world = g.world;
      const t = R.types[R.T.type[s]];
      if (!t) return;
      if (R.T.flags[s] & F.UNBREAK && !this.creative) return;
      if (t.o.kind === 'door' || (t.o.tall && t.has('half')) || t.o.kind === 'bed' || t.o.kind === 'model' || t.o.vxModel) g.breakMulti && g.breakMulti(x, y, z, s);
      const fluidIn = (R.T.flags[s] & F.WATERLOG) ? R.byName.water.defaultState : 0;
      world.setBlock(x, y, z, fluidIn, 4);
      if (VR.CUT_OF && (VR.CUT_OF[t.name] || VR.SMOOTH_OF[t.name] || (R.T.flags[s] & F.SMOOTH)) && g.sim && g.sim.cutAround) g.sim.cutAround(x, y, z);
      g.audio && g.audio.dig(s, true);
      g.particles && g.particles.breakBlock(x, y, z, s);
      g.onBlockBroken && g.onBlockBroken(x, y, z, s, this);
      if (survival) {
        const hdef = this.inv.held ? VR.itemDef(this.inv.held.id) : null;
        if (this.canHarvest(s, hdef)) g.dropsFor && g.dropsFor(x, y, z, s, hdef);
        this.exhaust += 0.005;
        this.damageHeld(1);
      }
    }
    damageHeld(n) {
      const h = this.inv.held; if (!h) return;
      const d = VR.itemDef(h.id); if (!d || !d.dur) return;
      h.dmg = (h.dmg || 0) + n;
      if (h.dmg >= d.dur) { this.inv.slots[this.inv.sel] = null; this.game.audio && this.game.audio.play('break_tool'); }
      this.inv.changed = true;
    }
    pickBlock(name) {
      const inv = this.inv;
      for (let i = 0; i < 9; i++) if (inv.slots[i] && inv.slots[i].id === name) { inv.sel = i; inv.changed = true; return; }
      let slot = inv.sel;
      if (inv.slots[slot]) { for (let i = 0; i < 9; i++) if (!inv.slots[i]) { slot = i; break; } }
      inv.slots[slot] = { id: name, n: 64 }; inv.sel = slot; inv.changed = true;
    }
    // right click: interact with block or place/use item. returns true if something happened
    use(hdef, held) {
      const g = this.game, world = g.world, t = this.target;
      // interact with the targeted block first (unless sneaking with an item)
      if (t && !(this.sneaking && held)) {
        if (g.interactBlock && g.interactBlock(t.x, t.y, t.z, t.state, this)) return true;
      }
      if (!held) return false;
      // sneaking with a shovel: toggle natural ground between smooth and cut (even on grass, which otherwise becomes a path)
      if (this.sneaking && t && hdef && hdef.tool === 'shovel' && g.sim && g.sim.toggleCut && g.sim.toggleCut(t.x, t.y, t.z, t.state, this, true)) return true;
      if (hdef && (hdef.food || hdef.heal)) { if (this.eat(hdef)) { if (!this.creative) this.inv.consumeHeld(1); return true; } return false; }
      if (hdef && hdef.use && g.useItem && g.useItem(hdef, held, t, this)) return true;
      const type = R.byName[held.id];
      if (!type || !t) return false;
      return (this.placed = this.placeFromHit(type, t));
    }
    placeFromHit(type, t) {
      const g = this.game, world = g.world;
      const T = R.T;
      // slab merge
      const merged = VR.Place.slabMerge(type, t.state, t.face, t.py - t.y);
      if (merged >= 0) { world.setBlock(t.x, t.y, t.z, merged, 4); this.afterPlace(type, t.x, t.y, t.z, merged); return true; }
      let x = t.x, y = t.y, z = t.z;
      if (!(T.flags[t.state] & F.REPLACE)) { x += VR.DX[t.face]; y += VR.DY[t.face]; z += VR.DZ[t.face]; }
      if (y < 0 || y >= VR.MAXY) return false;
      const cur = world.getBlock(x, y, z);
      if (cur && !(T.flags[cur] & F.REPLACE)) {
        // merge into slab at target position
        const m2 = VR.Place.slabMerge(type, cur, t.face === 2 ? 2 : t.face === 3 ? 3 : -1, 0);
        if (m2 >= 0) { world.setBlock(x, y, z, m2, 4); this.afterPlace(type, x, y, z, m2); return true; }
        return false;
      }
      const ctx = { world, face: t.face, x, y, z, fx: t.px - t.x, fy: t.py - t.y, fz: t.pz - t.z, yaw: this.yaw, pitch: this.pitch };
      const list = VR.Place.compute(type, ctx);
      if (!list) return false;
      // natural ground placed by hand is crisp (its cut twin): voxels build like voxels; Shift + shovel smooths a patch into the landscape
      if (VR.CUT_OF && VR.CUT_OF[type.name]) { const cut = R.byName[VR.CUT_OF[type.name]]; if (cut) for (const p of list) p.state = cut.state(type.decode(p.state)); }
      // collision check with player
      for (const p of list) {
        const boxes = VR.PHYS.collision(p.state, null);
        for (const b of boxes) {
          if (p.x + b[3] > this.pos[0] - W && p.x + b[0] < this.pos[0] + W && p.y + b[4] > this.pos[1] && p.y + b[1] < this.pos[1] + H && p.z + b[5] > this.pos[2] - W && p.z + b[2] < this.pos[2] + W && !this.noclip) return false;
        }
        if (g.entityBlocks && g.entityBlocks(p.x, p.y, p.z, p.state)) return false;
      }
      // waterlogging: keep water in waterloggable blocks placed into water
      for (const p of list) {
        const prev = world.getBlock(p.x, p.y, p.z);
        world.setBlock(p.x, p.y, p.z, p.state, 4);
        if (prev && (T.flags[prev] & F.WATER) && (T.flags[p.state] & F.WATERLOG) === 0 && g.onFluidDisplaced) g.onFluidDisplaced(p.x, p.y, p.z, prev);
      }
      this.afterPlace(type, list[0].x, list[0].y, list[0].z, list[0].state);
      return true;
    }
    afterPlace(type, x, y, z, s) {
      const g = this.game;
      g.audio && g.audio.place(s);
      if (!this.creative) this.inv.consumeHeld(1);
      g.onBlockPlaced && g.onBlockPlaced(x, y, z, s, this);
    }
    toJSON() { return { pos: this.pos, yaw: this.yaw, pitch: this.pitch, mode: this.mode, health: this.health, food: this.food, sat: this.sat, air: this.air, xp: this.xp, level: this.level, flying: this.flying, inv: this.inv.toJSON(), spawn: this.spawn, spawnBed: this.spawnBed || null }; }
    load(o) {
      if (!o) return;
      // every number checked: a save with a NaN (JSON writes null) or a wrong type takes the default, not the world down
      const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
      const vec = (a) => Array.isArray(a) && a.length >= 3 && a.slice(0, 3).every(v => typeof v === 'number' && Number.isFinite(v)) ? a.slice(0, 3) : null;
      const pos = vec(o.pos), spawn = vec(o.spawn);
      if (pos) this.pos = pos; else if (spawn) this.pos = spawn.slice();
      this.yaw = num(o.yaw, 0); this.pitch = num(o.pitch, 0);
      if (o.mode) this.mode = o.mode; this.health = num(o.health, 20); this.food = num(o.food, 20); this.sat = num(o.sat, 5); this.air = num(o.air, 300); this.xp = num(o.xp, 0); this.level = num(o.level, 0);
      this.flying = !!o.flying; this.inv.load(o.inv); if (spawn) this.spawn = spawn; this.spawnBed = o.spawnBed || null;
    }
  }
  VR.Player = Player;
})(VR);
