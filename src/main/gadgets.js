// ============================================================================
// Gadgets: hoverbikes, flyable block-built ships (take the helm of anything you
// build), seats, jetpack, pulse blaster, mining laser, builder wand, geo
// scanner, waypoints, photo drone, defense turrets, night raids, meteor
// impacts and the related chat commands.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, F = VR.F, PH = VR.PHYS, mat4 = VR.mat4, M = VR.M;
  const TAU = Math.PI * 2, QT = Math.PI / 2;
  // the player's language (lang_de.js / lang_en.js)
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  const wrapA = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
  const DIRN = ['north', 'east', 'south', 'west'];
  const F6V = [[0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];
  const K3 = (x, y, z) => x + ',' + y + ',' + z;
  const NB26 = []; for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (dx || dy || dz) NB26.push([dx, dy, dz]);
  const WP_COLORS = ['#3af0ff', '#ff5ad0', '#ffd23a', '#7dff6a', '#ff7a3a', '#a07aff', '#ffffff', '#5a9aff'];
  const IDENT = mat4.create();

  // ---------------------------------------------------------------- block-state rotation (quarter turns, clockwise from above)
  function rotName(v, k, vals) {
    if (typeof v !== 'string') return -1;
    const toks = v.split('_');
    let changed = false;
    const mt = toks.map((t) => { const i = DIRN.indexOf(t); if (i < 0) return t; changed = true; return DIRN[(i + k) & 3]; });
    if (!changed) return -1;
    let ni = vals.indexOf(mt.join('_'));
    if (ni < 0 && mt.length === 2) ni = vals.indexOf(mt[1] + '_' + mt[0]);
    return ni;
  }
  function rotateState(s, k) {
    k = ((k % 4) + 4) % 4;
    if (!k || !s) return s;
    const t = R.types[R.T.type[s]];
    if (!t || !t.props || !t.props.length) return s;
    let ns = s;
    for (const pr of t.props) {
      const vals = pr.values, cur = t.get(ns, pr.name), v = vals[cur];
      if (pr.name === 'axis') {
        if (k & 1) { const nv = v === 'x' ? 'z' : v === 'z' ? 'x' : v; const ni = vals.indexOf(nv); if (ni >= 0) ns = t.with(ns, pr.name, ni); }
      } else if (pr.name === 'rotation' && vals.length === 16) ns = t.with(ns, pr.name, (cur + k * 4) & 15);
      else { const ni = rotName(v, k, vals); if (ni >= 0) ns = t.with(ns, pr.name, ni); }
    }
    return ns;
  }
  VR.rotateState = rotateState;

  // blocks that anchor a ship to the world (terrain, pads) and are never lifted
  let SHIP_EXCL = null;
  function shipExcl() {
    if (SHIP_EXCL) return SHIP_EXCL;
    const ex = new Uint8Array(R.types.length);
    const keep = /^(cobblestone|mossy_cobblestone|sandstone|red_sandstone|terracotta|obsidian|snow_block|moss_block|clay)$/;
    const S = VR.GEN && VR.GEN.S ? VR.GEN.S() : {};
    for (const k in S) { const s = S[k]; if (s) { const t = R.types[R.T.type[s]]; if (t && !keep.test(t.name)) ex[t.id] = 1; } }
    for (const t of R.types) {
      if (t.group && /^Natural/.test(t.group) && !/crystal/.test(t.name)) ex[t.id] = 1;
      if (/_ore$|^bedrock$|^landing_pad$|^launch_beacon$|^hazard_stripes$/.test(t.name)) ex[t.id] = 1;
    }
    SHIP_EXCL = ex;
    return ex;
  }
  // ore colors for the scanner
  let ORE_INFO = null;
  function oreInfo() {
    if (ORE_INFO) return ORE_INFO;
    ORE_INFO = new Map();
    const C = { coal: [0.25, 0.25, 0.3], iron: [0.95, 0.72, 0.55], copper: [1, 0.5, 0.25], gold: [1, 0.86, 0.2], diamond: [0.3, 1, 1], emerald: [0.25, 1, 0.45], lapis: [0.25, 0.4, 1], voltite: [1, 0.25, 0.25], quartz: [1, 1, 1], relic: [0.75, 0.45, 0.9] };
    for (const t of R.types) {
      let key = t.o.oreOf || (t.name === 'relic_ore' ? 'relic' : null);
      if (!key && /_crystal_cluster$/.test(t.name)) key = 'crystal';
      if (!key) continue;
      const col = key === 'crystal' ? [0.8, 0.5, 1] : (C[key] || [0.9, 0.9, 0.9]);
      ORE_INFO.set(t.id, { key, col });
    }
    return ORE_INFO;
  }

  // ---------------------------------------------------------------- hoverbike entity
  class Bike {
    constructor(gad, x, y, z, yaw) {
      this.gad = gad; this.kind = 'hoverbike';
      this.pos = [x, y, z]; this.vel = [0, 0, 0];
      this.yaw = yaw || 0; this.roll = 0; this.pitch = 0; this.age = 0;
      this.rider = null; this.hopCool = 0; this.spd = 0;
    }
    hitbox() { const p = this.pos; return [p[0] - 0.65, p[1], p[2] - 0.65, p[0] + 0.65, p[1] + 0.95, p[2] + 0.65]; }
    onUse(pl) { this.gad.useBike(this, pl); }
  }

  // ---------------------------------------------------------------- gadgets manager
  class Gadgets {
    constructor(g) {
      this.g = g;
      this.meta = g.meta || {};
      this.riding = null;       // {type:'bike'|'ship'|'seat', ...}
      this.ship = null;
      this.drone = null;
      this.bikes = [];
      this.turrets = new Map();
      this.fireCool = 0; this.heat = 0; this.overheat = 0;
      this.jetFuel = 1; this.jetOn = false;
      this.mineT = null;
      this.wand = { a: null, b: null, clip: null, undo: [] };
      this.blue = VR.Blueprints ? new VR.Blueprints(this) : null;   // blueprints.js: catalogue houses as items
      this.scanData = null; this.scanCool = 0;
      this.waypoints = Array.isArray(this.meta.waypoints) ? this.meta.waypoints : (this.meta.waypoints = []);
      this.bikeSpawns = new Set(this.meta.bikeSpawns || []);
      this.meteors = []; this.meteorT = 60 + Math.random() * 90;
      this.raid = { active: false, lastDay: -1, checkT: 15, mobs: [] };
      this.hudT = 0; this.wpT = 0; this.pruneT = 5; this.time = 0;
      this.restore = this.meta.flyingShip || null;
      this.tm = mat4.create(); this.tm2 = mat4.create();
      g.vehicleCam = (cam) => this.vehicleCam(cam);
      g.dropInventory = (p) => this.dropInventory(p);
      g.extraCommand = (cmd, a) => this.command(cmd, a);
      if (g.entities) g.entities.vehicles = this.bikes;
      // turrets already present in loaded columns
      if (g.world) for (const c of g.world.cols.values()) if (c.ready) this.scanColumn(c);
    }
    get controlling() { return !!(this.riding || this.drone); }
    say(t, c) { this.g.ui.chatLine(t, c || '#9ad8ff'); }

    // ================================================================ per-frame (global)
    tick(dt) {
      const g = this.g;
      this.time += dt;
      this.fireCool -= dt;
      this.heat = Math.max(0, this.heat - dt * 0.55);
      if (this.overheat > 0) this.overheat -= dt;
      this.scanCool -= dt;
      // unridden bikes keep hovering
      for (const b of this.bikes) if (b !== (this.riding && this.riding.bike)) this.updateBike(b, dt, null, true);
      if (this.ship && this.ship.state === 'landing') this.finishLanding(dt);
      if (this.restore) this.tryRestoreShip();
      this.updateTurrets(dt);
      this.updateRaid(dt);
      this.updateMeteors(dt);
      this.updateWaypointBeams(dt);
      if (this.blue) { this.blue.tickPlans(dt); this.blue.tickEdits(dt); }
      if (this.scanData && this.time > this.scanData.until) this.scanData = null;
      this.pruneT -= dt;
      if (this.pruneT <= 0) { this.pruneT = 5; for (const [k, t] of this.turrets) if (!g.world.col(t.x >> 4, t.z >> 4)) this.turrets.delete(k); }
      // HUD line
      this.hudT -= dt;
      if (this.hudT <= 0) { this.hudT = 0.15; g.ui.vehicleHud(this.hudText()); }
    }

    // ================================================================ input hooks
    // jetpack (before player physics)
    preUpdate(dt, input, p) {
      const g = this.g;
      const worn = (p.inv.armor[1] && p.inv.armor[1].id === 'jetpack') || (p.inv.held && p.inv.held.id === 'jetpack');
      if (!worn || p.flying || p.dead || g.ui.typing) { if (this.jetOn) { this.jetOn = false; g.audio.loop('jet', 0); } if (p.onGround) this.jetFuel = Math.min(1, this.jetFuel + dt * 0.35); return; }
      if (p.onGround) this.jetFuel = Math.min(1, this.jetFuel + dt * 0.35);
      const want = input.captured && input.down('Space') && !p.onGround && !p.inWater;
      const on = want && (this.jetFuel > 0 || p.creative);
      if (on) {
        p.vel[1] = Math.min(p.vel[1] + 46 * dt, 8);
        if (!p.creative) this.jetFuel = Math.max(0, this.jetFuel - dt * 0.14);
        p.fallStart = p.pos[1];
        const fw = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0), st = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
        const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
        const wx = -sy * fw + cy * st, wz = -cy * fw - sy * st;
        p.vel[0] += wx * 16 * dt; p.vel[2] += wz * 16 * dt;
        const hs = Math.hypot(p.vel[0], p.vel[2]); if (hs > 10) { p.vel[0] *= 10 / hs; p.vel[2] *= 10 / hs; }
        // exhaust
        const bx = p.pos[0] + Math.sin(p.yaw) * 0.32, bz = p.pos[2] + Math.cos(p.yaw) * 0.32;
        for (const side of [-0.16, 0.16]) {
          const ex = bx + Math.cos(p.yaw) * side, ez = bz - Math.sin(p.yaw) * side;
          g.particles.spawn(ex, p.pos[1] + 0.8, ez, (Math.random() - 0.5) * 0.6, -6 - Math.random() * 3, (Math.random() - 0.5) * 0.6, { life: 0.25 + Math.random() * 0.15, size: 0.09, grav: 0, col: [1, 0.55 + Math.random() * 0.3, 0.2], emis: 1, drag: 1, collide: false });
          if (Math.random() < 0.3) g.particles.spawn(ex, p.pos[1] + 0.6, ez, 0, -2, 0, { life: 0.9, size: 0.16, grav: -0.5, col: [0.6, 0.6, 0.65], drag: 1.5, grow: 0.4, collide: false });
        }
      }
      if (on !== this.jetOn) { this.jetOn = on; }
      g.audio.loop('jet', on ? 0.45 : 0, on ? 0.9 : 0.5);
      if (on) g.codex && g.codex.event && g.codex.event('jetpack');
    }
    // item logic while on foot. true = consumed this frame's mouse input ('keep' keeps the breaking state)
    update(dt, input, p, hdef) {
      const g = this.g;
      if (!hdef) { this.mineT = null; return false; }
      const lmbHold = input.dragLook ? input.holdAction(0) : input.mouse.down[0];
      const lmbClick = input.dragLook ? input.clickAction(0) : input.mouse.clicked[0];
      const rmbClick = input.dragLook ? input.clickAction(2) : input.mouse.clicked[2];
      if (hdef.use === 'laser') {
        const fire = input.dragLook ? lmbClick : lmbHold;
        if (fire && this.fireCool <= 0 && this.overheat <= 0) {
          this.fireCool = 0.16;
          const e = p.eyePos(), d = p.lookDir();
          const rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
          const o = [e[0] + d[0] * 0.6 + rx * 0.22, e[1] + d[1] * 0.6 - 0.14, e[2] + d[2] * 0.6 + rz * 0.22];
          // converge on what the crosshair points at
          const t = p.target, aim = t ? [t.px - o[0], t.py - o[1], t.pz - o[2]] : d;
          if (g.entities) g.entities.fireBolt(o, aim, 80, hdef.dmg || 7, p, [1, 0.3, 0.45]);
          g.particles.spark(o[0], o[1], o[2], [1, 0.4, 0.5], 4, 1.5);
          this.heat += 0.085; if (this.heat >= 1) { this.overheat = 1.4; this.heat = 1; g.audio.play('zap'); g.ui.hint(T('g.laser.hot'), 1200); }
          p.handSwing = 0.35;
        }
        return lmbHold || lmbClick ? true : false;
      }
      if (hdef.use === 'minelaser') return this.mineLaser(dt, input, p, lmbHold || lmbClick);
      if (hdef.use === 'wand') return this.wandInput(input, p, lmbClick, rmbClick);
      if (hdef.use === 'blueprint') return this.blue ? this.blue.input(input, p, hdef, lmbClick, rmbClick) : false;
      this.mineT = null;
      return false;
    }
    // right-click item use (called via game.useItem)
    use(def, stack, t, p) {
      const g = this.g, w = g.world;
      if (def.use === 'vehicle') {
        if (def.vehicle === 'hoverbike') {
          if (!t) return false;
          const x = t.x + VR.DX[t.face] + 0.5, y = t.y + VR.DY[t.face], z = t.z + VR.DZ[t.face] + 0.5;
          this.spawnVehicle('hoverbike', x, y + 0.2, z, p.yaw);
          if (!p.creative) p.inv.consumeHeld(1);
          g.audio.play('pop');
          return true;
        }
        if (def.vehicle === 'shuttle') {
          if (p.creative) { g.ui.openShipyard(); return true; }
          if (!g.starships) return false;
          g.starships.placeInFront((Math.random() * 4294967295) >>> 0, null, null, p);
          p.inv.consumeHeld(1);
          return true;
        }
      }
      if (def.use === 'spawn' && t) {
        const x = t.x + VR.DX[t.face] + 0.5, y = t.y + VR.DY[t.face], z = t.z + VR.DZ[t.face] + 0.5;
        if (g.entities && g.entities.summon(def.mob, x, y, z)) { if (!p.creative) p.inv.consumeHeld(1); g.particles.spark(x, y + 0.5, z, [1, 1, 1], 10, 2, 0); return true; }
        return false;
      }
      if (def.use === 'scan') { this.scan(p); return true; }
      if (def.use === 'waypoint') {
        const pos = t ? [t.x + VR.DX[t.face], t.y + VR.DY[t.face], t.z + VR.DZ[t.face]] : [Math.floor(p.pos[0]), Math.floor(p.pos[1]), Math.floor(p.pos[2])];
        this.addWaypoint(pos[0], pos[1], pos[2]);
        if (!p.creative) p.inv.consumeHeld(1);
        return true;
      }
      if (def.use === 'photo') { this.startDrone(); return true; }
      if (def.use === 'ignite' && t) {
        const x = t.x + VR.DX[t.face], y = t.y + VR.DY[t.face], z = t.z + VR.DZ[t.face];
        const cur = w.getBlock(x, y, z);
        if (!cur || (R.T.flags[cur] & F.REPLACE && !(R.T.flags[cur] & F.FLUID))) { w.setBlock(x, y, z, R.byName.fire.defaultState, 4); p.damageHeld(1); g.audio.play('zap'); return true; }
        return false;
      }
      if (def.use === 'zoom') return false;
      return false;
    }

    // ================================================================ mining laser
    mineLaser(dt, input, p, firing) {
      const g = this.g, w = g.world;
      if (!firing) { this.mineT = null; return false; }
      const e = p.eyePos(), d = p.lookDir();
      const hit = PH.raycast((x, y, z) => w.getBlock(x, y, z), e[0], e[1], e[2], d[0], d[1], d[2], 28);
      const len = hit ? hit.dist : 28;
      // beam
      const o = [e[0] + Math.cos(p.yaw) * 0.25, e[1] - 0.2, e[2] - Math.sin(p.yaw) * 0.25];
      const end = [e[0] + d[0] * len, e[1] + d[1] * len, e[2] + d[2] * len];
      const n = Math.min(40, Math.ceil(len * 1.5));
      for (let i = 0; i < n; i++) { const f = Math.random(); g.particles.spawn(o[0] + (end[0] - o[0]) * f, o[1] + (end[1] - o[1]) * f, o[2] + (end[2] - o[2]) * f, 0, 0, 0, { life: 0.06, size: 0.035, grav: 0, col: [1, 0.55, 0.15], emis: 1, collide: false }); }
      g.audio.loop('jet', 0.2, 1.6);
      clearTimeout(this.mineSnd); this.mineSnd = setTimeout(() => g.audio.loop('jet', 0), 120);
      if (!hit || (R.T.flags[hit.state] & F.FLUID)) { this.mineT = null; return true; }
      const hard = R.T.hard[hit.state];
      if (hard < 0 || ((R.T.flags[hit.state] & F.UNBREAK) && !p.creative)) return true;
      if (!this.mineT || this.mineT.x !== hit.x || this.mineT.y !== hit.y || this.mineT.z !== hit.z) this.mineT = { x: hit.x, y: hit.y, z: hit.z, p: 0 };
      const time = p.creative ? 0.08 : Math.max(0.06, hard * 1.5 / 12);
      this.mineT.p += dt / time;
      if (Math.random() < 0.5) g.particles.spark(hit.px, hit.py, hit.pz, [1, 0.6, 0.2], 2, 2);
      p.target = hit; p.breaking = { x: hit.x, y: hit.y, z: hit.z, p: Math.min(0.99, this.mineT.p) };
      if (this.mineT.p >= 1) {
        const s = hit.state, t = R.types[R.T.type[s]];
        if (t.o.kind === 'door' || (t.o.tall && t.has('half')) || t.o.kind === 'bed' || t.o.vxModel) g.breakMulti && g.breakMulti(hit.x, hit.y, hit.z, s);
        w.setBlock(hit.x, hit.y, hit.z, (R.T.flags[s] & F.WATERLOG) ? R.byName.water.defaultState : 0, 4);
        g.audio.dig(s, true); g.particles.breakBlock(hit.x, hit.y, hit.z, s);
        if (!p.creative) g.dropsFor && g.dropsFor(hit.x, hit.y, hit.z, s, { tool: t.o.tool, tier: 4, speed: 12 });
        this.mineT = null; p.breaking = null;
      }
      return 'keep';
    }

    // ================================================================ builder wand
    wandInput(input, p, lmb, rmb) {
      const g = this.g, W = this.wand, t = p.target;
      if (lmb) { if (t) { W.a = [t.x, t.y, t.z]; g.audio.play('click'); } return true; }
      if (rmb) { if (t) { W.b = [t.x, t.y, t.z]; g.audio.play('click'); } return true; }
      if (g.ui.typing) return false;
      const hitK = (c) => input.hit(c);
      if (hitK('KeyF')) this.wandFill('fill');
      else if (hitK('KeyH')) this.wandFill('hollow');
      else if (hitK('KeyG')) this.wandFill('walls');
      else if (hitK('KeyX')) this.wandFill('clear');
      else if (hitK('KeyC')) this.wandCopy();
      else if (hitK('KeyV')) this.wandPaste();
      else if (hitK('KeyR')) this.wandRotate();
      else if (hitK('KeyZ')) this.undo();
      return input.mouse.down[0] || input.mouse.down[2];
    }
    wandBox() {
      const W = this.wand; if (!W.a || !W.b) return null;
      return [Math.min(W.a[0], W.b[0]), Math.min(W.a[1], W.b[1]), Math.min(W.a[2], W.b[2]), Math.max(W.a[0], W.b[0]), Math.max(W.a[1], W.b[1]), Math.max(W.a[2], W.b[2])];
    }
    // the block the wand builds with: the first block item to the right of the wand in the hotbar
    wandBlock() {
      const inv = this.g.player.inv;
      for (let k = 1; k < 9; k++) { const st = inv.slots[(inv.sel + k) % 9]; if (st && R.byName[st.id] && !VR.ITEMS[st.id] && !R.byName[st.id].o.noItem) return R.byName[st.id]; }
      return null;
    }
    wandFill(mode, blockType) {
      const g = this.g, w = g.world, p = g.player;
      const B = this.wandBox();
      if (!B) { g.ui.hint(T('g.wand.corners2'), 2500); return; }
      const vol = (B[3] - B[0] + 1) * (B[4] - B[1] + 1) * (B[5] - B[2] + 1);
      if (vol > 1000000) { g.ui.hint(T('g.wand.tooBig'), 2500); return; }
      let type = blockType || null;
      if (mode !== 'clear' && !type) { type = this.wandBlock(); if (!type) { g.ui.hint(T('g.wand.noBlock'), 2500); return; } }
      const state = mode === 'clear' ? 0 : type.defaultState;
      let budget = Infinity;
      if (!p.creative && state) budget = p.inv.count(type.name);
      const list = [], undo = [];
      for (let y = B[1]; y <= B[4]; y++) for (let z = B[2]; z <= B[5]; z++) for (let x = B[0]; x <= B[3]; x++) {
        const edgeX = x === B[0] || x === B[3], edgeY = y === B[1] || y === B[4], edgeZ = z === B[2] || z === B[5];
        if (mode === 'hollow' && !(edgeX || edgeY || edgeZ)) continue;
        if (mode === 'walls' && !(edgeX || edgeZ)) continue;
        const old = w.getBlock(x, y, z);
        if (old === state || !w.col(x >> 4, z >> 4)) continue;
        if (state && budget <= 0) continue;
        if (!p.creative && (R.T.flags[old] & F.UNBREAK)) continue;
        list.push([x, y, z, state]); undo.push([x, y, z, old]);
        if (state) budget--;
      }
      if (!list.length) { g.ui.hint(T('g.wand.nothing'), 1500); return; }
      this.applyEdit(list, undo);
      if (!p.creative && state) p.inv.remove(type.name, list.length);
      g.audio.place(state || 1);
      g.ui.hint(T('g.wand.placed', { what: T(mode === 'clear' ? 'g.wand.cleared' : 'g.wand.set'), n: list.length.toLocaleString() }), 2200);
      g.codex && g.codex.event && g.codex.event('wand');
    }
    applyEdit(list, undo) {
      const g = this.g;
      g.world.bulkSet(list, false);
      if (undo) { this.wand.undo.push(undo); let total = 0; for (let i = this.wand.undo.length - 1; i >= 0; i--) { total += this.wand.undo[i].length; if (total > 1500000 || this.wand.undo.length - i > 8) { this.wand.undo.splice(0, i + 1); break; } } }
      for (const [x, y, z, s] of list) this.noteBlock(x, y, z, s);
    }
    undo() {
      const u = this.wand.undo.pop();
      if (!u) { this.g.ui.hint(T('g.wand.noUndo'), 1500); return; }
      this.g.world.bulkSet(u, false);
      for (const [x, y, z, s] of u) this.noteBlock(x, y, z, s);
      this.g.ui.hint(T('g.wand.undid', { n: u.length.toLocaleString() }), 1800);
    }
    wandCopy() {
      const g = this.g, w = g.world, B = this.wandBox();
      if (!B) { g.ui.hint(T('g.wand.corners'), 2000); return; }
      const sx = B[3] - B[0] + 1, sy = B[4] - B[1] + 1, sz = B[5] - B[2] + 1;
      if (sx * sy * sz > 1000000) { g.ui.hint(T('g.wand.copyBig'), 2000); return; }
      const data = new Uint16Array(sx * sy * sz);
      for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) data[(y * sz + z) * sx + x] = w.getBlock(B[0] + x, B[1] + y, B[2] + z);
      this.wand.clip = { sx, sy, sz, data };
      g.ui.hint(T('g.wand.copied', { sx, sy, sz }), 2600);
    }
    pasteOrigin() {
      const p = this.g.player, t = p.target, c = this.wand.clip;
      if (!t || !c) return null;
      const x = t.x + VR.DX[t.face], y = t.y + VR.DY[t.face], z = t.z + VR.DZ[t.face];
      // centre the clip horizontally on the target, sitting on the surface
      return [x - (c.sx >> 1), y, z - (c.sz >> 1)];
    }
    wandPaste() {
      const g = this.g, w = g.world, c = this.wand.clip, o = this.pasteOrigin();
      if (!c) { g.ui.hint(T('g.wand.noCopy'), 2000); return; }
      if (!o) return;
      const list = [], undo = [];
      for (let y = 0; y < c.sy; y++) for (let z = 0; z < c.sz; z++) for (let x = 0; x < c.sx; x++) {
        const s = c.data[(y * c.sz + z) * c.sx + x];
        if (!s) continue; // air in the clipboard doesn't erase
        const X = o[0] + x, Y = o[1] + y, Z = o[2] + z;
        if (Y < 0 || Y >= VR.MAXY || !w.col(X >> 4, Z >> 4)) continue;
        const old = w.getBlock(X, Y, Z); if (old === s) continue;
        list.push([X, Y, Z, s]); undo.push([X, Y, Z, old]);
      }
      if (!list.length) return;
      if (!g.player.creative) { g.ui.hint(T('g.wand.pasteMode'), 2200); return; }
      this.applyEdit(list, undo);
      g.audio.place(list[0][3]);
      g.ui.hint(T('g.wand.pasted', { n: list.length.toLocaleString() }), 2000);
    }
    wandRotate() {
      const c = this.wand.clip; if (!c) return;
      const nsx = c.sz, nsz = c.sx, out = new Uint16Array(c.data.length);
      for (let y = 0; y < c.sy; y++) for (let z = 0; z < c.sz; z++) for (let x = 0; x < c.sx; x++) {
        const nx = (c.sz - 1) - z, nz = x;
        out[(y * nsz + nz) * nsx + nx] = rotateState(c.data[(y * c.sz + z) * c.sx + x], 1);
      }
      this.wand.clip = { sx: nsx, sy: c.sy, sz: nsz, data: out };
      this.g.ui.hint(T('g.wand.rotated'), 1400);
    }
    shape(kind, type, r, h, hollow) {
      const g = this.g, w = g.world, p = g.player, t = p.target;
      const c = t ? [t.x, t.y, t.z] : [Math.floor(p.pos[0]), Math.floor(p.pos[1]), Math.floor(p.pos[2])];
      const state = type ? type.defaultState : 0;
      const list = [], undo = [];
      r = Math.min(48, Math.max(1, r)); h = Math.min(128, Math.max(1, h || 1));
      const put = (x, y, z) => { if (y < 0 || y >= VR.MAXY || !w.col(x >> 4, z >> 4)) return; const old = w.getBlock(x, y, z); if (old === state) return; list.push([x, y, z, state]); undo.push([x, y, z, old]); };
      if (kind === 'sphere') {
        for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d > r + 0.35) continue;
          if (hollow && d < r - 0.65) continue; put(c[0] + dx, c[1] + dy, c[2] + dz);
        }
      } else {
        for (let dy = 0; dy < h; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          const d = Math.sqrt(dx * dx + dz * dz); if (d > r + 0.35) continue;
          if (hollow && d < r - 0.65) continue; put(c[0] + dx, c[1] + dy + 1, c[2] + dz);
        }
      }
      if (!list.length) return 0;
      this.applyEdit(list, undo);
      return list.length;
    }

    // ================================================================ scanner
    scan(p) {
      const g = this.g, w = g.world, T = R.T;
      if (this.scanCool > 0) return;
      this.scanCool = 2;
      const info = oreInfo(), r = 22;
      const cx = Math.floor(p.pos[0]), cy = Math.floor(p.pos[1]), cz = Math.floor(p.pos[2]);
      const groups = new Map(), counts = {};
      const found = [];
      for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const d2 = dx * dx + dy * dy + dz * dz; if (d2 > r * r) continue;
        const s = w.getBlock(cx + dx, cy + dy, cz + dz); if (!s) continue;
        const inf = info.get(T.type[s]); if (!inf) continue;
        counts[inf.key] = (counts[inf.key] || 0) + 1;
        found.push([d2, dx, dy, dz, inf]);
      }
      found.sort((a, b) => a[0] - b[0]);
      for (const [, dx, dy, dz, inf] of found.slice(0, 160)) {
        let gr = groups.get(inf.key);
        if (!gr) { gr = { x: cx, y: cy, z: cz, boxes: [], color: [inf.col[0], inf.col[1], inf.col[2], 0.95], xray: true }; groups.set(inf.key, gr); }
        gr.boxes.push([dx + 0.04, dy + 0.04, dz + 0.04, dx + 0.96, dy + 0.96, dz + 0.96]);
      }
      this.scanData = { until: this.time + 14, groups: [...groups.values()] };
      g.audio.play('warp');
      for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; g.particles.spawn(p.pos[0] + Math.cos(a) * 0.6, p.pos[1] + 1, p.pos[2] + Math.sin(a) * 0.6, Math.cos(a) * 9, 0, Math.sin(a) * 9, { life: 0.8, size: 0.06, grav: 0, col: [0.3, 1, 1], emis: 1, drag: 0.5, collide: false }); }
      const keys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
      this.say(keys.length ? T('g.scan.found', { list: keys.map(k => `${counts[k]} ${k}`).join(' · ') }) : T('g.scan.none'), '#9affd8');
    }

    // ================================================================ waypoints
    addWaypoint(x, y, z, name) {
      if (this.waypoints.length >= 40) this.waypoints.shift();
      const n = this.waypoints.length;
      const wp = { x, y, z, name: name || T('g.wp.name', { n: n + 1 }), col: WP_COLORS[n % WP_COLORS.length] };
      this.waypoints.push(wp);
      this.meta.waypoints = this.waypoints;
      this.say(T('g.wp.set', { name: wp.name, x, y, z }), wp.col);
      this.g.audio.play('toast');
      return wp;
    }
    updateWaypointBeams(dt) {
      const g = this.g, p = g.player;
      this.wpT -= dt; if (this.wpT > 0) return; this.wpT = 0.12;
      for (const wp of this.waypoints) {
        const dx = wp.x + 0.5 - p.pos[0], dz = wp.z + 0.5 - p.pos[2];
        const d2 = dx * dx + dz * dz; if (d2 > 180 * 180 || d2 < 4) continue;
        const c = wp.col, col = [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255];
        for (let k = 0; k < 2; k++) g.particles.spawn(wp.x + 0.5 + (Math.random() - 0.5) * 0.3, wp.y + 0.5 + Math.random() * 24, wp.z + 0.5 + (Math.random() - 0.5) * 0.3, 0, 3, 0, { life: 1.4, size: 0.12, grav: 0, col, emis: 1, drag: 0, collide: false });
      }
    }

    // ================================================================ photo drone
    startDrone() {
      const g = this.g, p = g.player;
      this.drone = { pos: p.eyePos(), vel: [0, 0, 0] };
      g.photoMode(true);
      g.ui.hint(T('g.drone.hint'), 4500);
      g.codex && g.codex.event && g.codex.event('drone');
    }
    driveDrone(dt, input, blocked) {
      const g = this.g, p = g.player, d = this.drone, w = g.world;
      if (!g.photo || (!blocked && input.hit('KeyV'))) { this.drone = null; if (g.photo) g.photoMode(false); return; }
      const k = (c) => !blocked && !g.ui.typing && input.down(c);
      const fw = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0), st = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0), up = (k('Space') ? 1 : 0) - (k('ShiftLeft') ? 1 : 0);
      const sp = k('ControlLeft') ? 18 : 6;
      const dir = p.lookDir(), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      const tv = [dir[0] * fw * sp + rx * st * sp, dir[1] * fw * sp + up * sp, dir[2] * fw * sp + rz * st * sp];
      const a = 1 - Math.exp(-dt * 5);
      for (let i = 0; i < 3; i++) d.vel[i] += (tv[i] - d.vel[i]) * a;
      const pos = [d.pos[0], d.pos[1] - 0.15, d.pos[2]];
      PH.move((x, y, z) => w.getBlock(x, y, z), pos, 0.15, 0.3, d.vel[0] * dt, d.vel[1] * dt, d.vel[2] * dt, 0, w.nbFn());
      d.pos = [pos[0], pos[1] + 0.15, pos[2]];
      if (!blocked && (input.dragLook ? input.clickAction(0) : input.mouse.clicked[0])) g.screenshot();
    }

    // ================================================================ vehicles: hoverbike
    spawnVehicle(kind, x, y, z, yaw) {
      if (kind !== 'hoverbike') return null;
      const key = Math.floor(x) + ',' + Math.floor(y) + ',' + Math.floor(z);
      if (this.fromGen) { if (this.bikeSpawns.has(key)) return null; this.bikeSpawns.add(key); this.meta.bikeSpawns = [...this.bikeSpawns]; }
      const b = new Bike(this, x, y, z, yaw);
      this.bikes.push(b);
      return b;
    }
    spawnFromGen(kind, x, y, z) { this.fromGen = true; try { return this.spawnVehicle(kind, x, y, z, Math.random() * TAU); } finally { this.fromGen = false; } }
    useBike(b, pl) {
      const g = this.g;
      if (this.riding) return;
      if (pl.sneaking) { // pick it up
        const i = this.bikes.indexOf(b); if (i >= 0) this.bikes.splice(i, 1);
        if (!pl.creative || !pl.inv.count('hoverbike')) pl.inv.add('hoverbike', 1);
        g.audio.play('pop');
        return;
      }
      this.riding = { type: 'bike', bike: b };
      b.rider = pl; pl.flying = false; pl.target = null; pl.breaking = null;
      pl.yaw = b.yaw;
      g.audio.play('click');
      g.ui.hint(T('g.bike.hint'), 3000);
      g.codex && g.codex.event && g.codex.event('bike');
    }
    groundBelow(x, y, z, depth) {
      const w = this.g.world, bx = Math.floor(x), bz = Math.floor(z);
      for (let yy = Math.floor(y + 0.3); yy >= Math.floor(y) - depth; yy--) {
        const s = w.getBlock(bx, yy, bz);
        if (s && (R.T.flags[s] & (F.SOLID | F.FLUID)) && !(R.T.flags[s] & F.REPLACE && !(R.T.flags[s] & F.FLUID))) return yy + ((R.T.flags[s] & F.FLUID) ? 0.9 : 1);
      }
      return null;
    }
    updateBike(b, dt, input, free, blocked) {
      const g = this.g, w = g.world, p = g.player;
      b.age += dt; b.hopCool -= dt;
      const dxp = b.pos[0] - p.pos[0], dzp = b.pos[2] - p.pos[2];
      if (free && dxp * dxp + dzp * dzp > 120 * 120) return;
      if (!w.col(Math.floor(b.pos[0]) >> 4, Math.floor(b.pos[2]) >> 4)) return;
      const get = (x, y, z) => w.getBlock(x, y, z);
      const gy = this.groundBelow(b.pos[0], b.pos[1], b.pos[2], 5);
      const hover = 0.62 + Math.sin(b.age * 2.2) * 0.04;
      if (gy !== null && b.pos[1] - gy < 3.2) { const target = gy + hover; b.vel[1] += ((target - b.pos[1]) * 38 - b.vel[1] * 7.5) * dt; }
      else b.vel[1] -= 24 * dt;
      const fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw), rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw);
      let spd = b.vel[0] * fx + b.vel[2] * fz, lat = b.vel[0] * rx + b.vel[2] * rz;
      let turn = 0;
      if (input) {
        const k = (c) => !blocked && !g.ui.typing && input.down(c);
        const fw = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0), st = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0);
        const boost = k('ControlLeft') || k('ControlRight');
        if (st) p.yaw -= st * 2.4 * dt;
        const d = wrapA(p.yaw - b.yaw); turn = M.clamp(d, -3.4 * dt, 3.4 * dt); b.yaw += turn;
        const vmax = boost ? 31 : 21;
        const target = fw > 0 ? vmax : fw < 0 ? (spd > 1 ? 0 : -7) : spd;
        spd += (target - spd) * (1 - Math.exp(-dt * (fw > 0 ? 1.1 : fw < 0 ? 3 : 0.35)));
        if (!blocked && input.hit('Space') && b.hopCool <= 0 && gy !== null && b.pos[1] - gy < 1.6) { b.vel[1] = 8.5; b.hopCool = 0.9; g.audio.play('zap'); }
        // blasters
        const fire = input.dragLook ? input.clickAction(0) : input.mouse.down[0];
        if (!blocked && fire && this.fireCool <= 0 && g.entities) {
          this.fireCool = 0.2;
          const d3 = p.lookDir();
          for (const side of [-0.45, 0.45]) g.entities.fireBolt([b.pos[0] + fx * 1.1 + rx * side, b.pos[1] + 0.45, b.pos[2] + fz * 1.1 + rz * side], d3, 85, 6, p, [0.35, 1, 1]);
        }
        g.audio.loop('engine', 0.12 + Math.min(1, Math.abs(spd) / 30) * 0.3, 0.2 + Math.min(1, Math.abs(spd) / 30) * 0.8);
        // exhaust glow
        if (Math.random() < 0.6) for (const side of [-0.38, 0.38]) g.particles.spawn(b.pos[0] - fx * 0.95 + rx * side, b.pos[1] + 0.25, b.pos[2] - fz * 0.95 + rz * side, -fx * 2, 0, -fz * 2, { life: 0.2, size: 0.07, grav: 0, col: [0.3, 0.95, 1], emis: 1, collide: false });
      } else spd *= Math.exp(-dt * 1.2);
      lat *= Math.exp(-dt * 7);
      b.spd = spd;
      b.vel[0] = fx * spd + rx * lat; b.vel[2] = fz * spd + rz * lat;
      const res = PH.move(get, b.pos, 0.55, 0.9, b.vel[0] * dt, b.vel[1] * dt, b.vel[2] * dt, 1.1, w.nbFn());
      if (res.hitX || res.hitZ) { const imp = Math.abs(spd); if (imp > 14) { g.audio.play('hurt'); if (b.rider) p.damage(Math.floor((imp - 12) / 3), 'fall'); } b.vel[0] *= -0.2; b.vel[2] *= -0.2; }
      if (res.hitY) b.vel[1] = 0;
      // visual banking / pitch
      b.roll += (M.clamp(turn / Math.max(dt, 1e-3) * 0.16, -0.45, 0.45) - b.roll) * (1 - Math.exp(-dt * 6));
      b.pitch += (M.clamp(-b.vel[1] * 0.03, -0.3, 0.3) - b.pitch) * (1 - Math.exp(-dt * 6));
      if (b.pos[1] < -30) { const i = this.bikes.indexOf(b); if (i >= 0) this.bikes.splice(i, 1); if (b.rider) this.dismount(); }
    }
    driveBike(dt, input, b, blocked) {
      const g = this.g, p = g.player;
      if (this.bikes.indexOf(b) < 0) { this.dismount(); return; }
      if (!blocked && (input.hit('ShiftLeft') || input.hit('ShiftRight') || input.hit('KeyV'))) { this.dismount(); return; }
      this.updateBike(b, dt, input, false, blocked);
      p.pos = [b.pos[0], b.pos[1] + 0.35, b.pos[2]]; p.vel = b.vel.slice(); p.fallStart = null; p.onGround = true;
    }

    // ================================================================ seats
    sit(x, y, z) {
      const g = this.g, p = g.player;
      if (this.riding) return;
      const s = g.world.getBlock(x, y, z), t = R.types[R.T.type[s]];
      const f = t && t.has('facing') ? t.get(s, 'facing') : 0;
      // the seat's floor is the model's lowest cell (its anchor) whichever part was clicked: the top half of a two-block chair
      // seats the player as low as its foot. x, y, z stay the clicked block, the seat's own cell (driveSeat checks it)
      const base = VR.VM && t && t.has('part') && VR.VM.MODELS[t.name] ? VR.VM.partCells(VR.VM.MODELS[t.name], f, t.get(s, 'part'), x, y, z)[0][1] : y;
      this.riding = { type: 'seat', x, y, z, base };
      p.yaw = -f * QT; p.pitch = 0; p.flying = false; p.target = null; p.breaking = null;
      g.ui.hint(T('g.seat.hint'), 2200);
    }
    driveSeat(dt, input, blocked) {
      const r = this.riding, g = this.g, p = g.player;
      const s = g.world.getBlock(r.x, r.y, r.z), t = R.types[R.T.type[s]];
      if ((!blocked && (input.hit('ShiftLeft') || input.hit('ShiftRight') || input.hit('KeyV'))) || !t || !(t.o.kind === 'seat' || t.o.seat)) { this.dismount(); return; }
      p.pos = [r.x + 0.5, r.base + 0.4, r.z + 0.5]; p.vel = [0, 0, 0]; p.fallStart = null;
    }
    dismount() {
      const g = this.g, p = g.player, r = this.riding;
      if (!r) return;
      this.riding = null;
      g.audio.loop('engine', 0);
      if (r.type === 'bike') {
        const b = r.bike; b.rider = null;
        const rx = Math.cos(b.yaw), rz = -Math.sin(b.yaw);
        const spot = this.freeSpot([[b.pos[0] - rx * 1.2, b.pos[1], b.pos[2] - rz * 1.2], [b.pos[0] + rx * 1.2, b.pos[1], b.pos[2] + rz * 1.2], [b.pos[0], b.pos[1] + 1, b.pos[2]]]);
        p.teleport(spot[0], spot[1], spot[2]);
      } else if (r.type === 'tram') {
        const spot = this.freeSpot(g.trams ? g.trams.exitSpot(r) : [[p.pos[0], p.pos[1] + 1, p.pos[2]]]);
        p.teleport(spot[0], spot[1], spot[2]);
      } else if (r.type === 'seat') {
        const spot = this.freeSpot([[r.x + 0.5, r.base + 0.4, r.z + 0.5], [r.x + 0.5, r.base + 1, r.z + 0.5], [r.x + 1.5, r.base, r.z + 0.5], [r.x - 0.5, r.base, r.z + 0.5], [r.x + 0.5, r.base, r.z + 1.5], [r.x + 0.5, r.base, r.z - 0.5]]);
        p.teleport(spot[0], spot[1], spot[2]);
      }
      g.ui.vehicleHud(null);
    }
    freeSpot(cands) {
      const w = this.g.world, get = (x, y, z) => w.getBlock(x, y, z), nb = w.nbFn();
      for (const c of cands) for (let dy = 0; dy <= 2; dy++) {
        const y = c[1] + dy;
        if (!PH.overlaps(get, c[0] - 0.3, y, c[2] - 0.3, c[0] + 0.3, y + 1.8, c[2] + 0.3, nb)) return [c[0], y, c[2]];
      }
      const c = cands[0];
      return [c[0], c[1] + 1.2, c[2]];
    }

    // ================================================================ ships
    // gather every constructed block connected to the helm (26-neighbourhood), stopping at terrain & pads
    takeHelm(x, y, z) {
      const g = this.g, w = g.world, p = g.player, T = R.T;
      if (this.riding || this.ship) return;
      const EX = shipExcl();
      const helmS = w.getBlock(x, y, z);
      const seen = new Set([K3(x, y, z)]);
      const cells = [x, y, z, helmS];
      const q = [x, y, z];
      let x0 = x, x1 = x, y0 = y, y1 = y, z0 = z, z1 = z;
      const LIMIT = 12000;
      let fail = null;
      while (q.length && !fail) {
        const cz = q.pop(), cy = q.pop(), cx = q.pop();
        for (const d of NB26) {
          const nx = cx + d[0], ny = cy + d[1], nz = cz + d[2];
          if (ny < 0 || ny >= VR.MAXY) continue;
          const k = K3(nx, ny, nz);
          if (seen.has(k)) continue;
          seen.add(k);
          if (!w.col(nx >> 4, nz >> 4)) { fail = T('g.ship.unexplored'); break; }
          const s = w.getBlock(nx, ny, nz);
          if (!s || (T.flags[s] & F.FLUID) || EX[T.type[s]]) continue;
          cells.push(nx, ny, nz, s); q.push(nx, ny, nz);
          if (nx < x0) x0 = nx; if (nx > x1) x1 = nx; if (ny < y0) y0 = ny; if (ny > y1) y1 = ny; if (nz < z0) z0 = nz; if (nz > z1) z1 = nz;
          if (cells.length / 4 > LIMIT) { fail = T('g.ship.fused'); break; }
          if (x1 - x0 > 96 || z1 - z0 > 96 || y1 - y0 > 64) { fail = T('g.ship.fusedBig'); break; }
        }
      }
      if (fail) { this.say(fail, '#ff9a8a'); return; }
      if (cells.length / 4 < 2) { this.say(T('g.ship.noHull'), '#ff9a8a'); return; }
      // big launches need a second click so a ship fused to a building never takes off by surprise
      const n = cells.length / 4, key = x + ',' + y + ',' + z;
      if (n > 2500 && !(this.confirmHelm && this.confirmHelm.key === key && performance.now() - this.confirmHelm.t < 6000)) {
        this.confirmHelm = { key, t: performance.now() };
        this.say(T('g.ship.confirm', { n: n.toLocaleString(), sx: x1 - x0 + 1, sy: y1 - y0 + 1, sz: z1 - z0 + 1 }), '#ffd08a');
        return;
      }
      this.confirmHelm = null;
      const sx = x1 - x0 + 1, sy = y1 - y0 + 1, sz = z1 - z0 + 1;
      const blocks = new Uint16Array(sx * sy * sz);
      for (let i = 0; i < cells.length; i += 4) blocks[((cells[i + 1] - y0) * sz + (cells[i + 2] - z0)) * sx + (cells[i] - x0)] = cells[i + 3];
      const helmT = R.types[T.type[helmS]];
      const S = this.buildShip(sx, sy, sz, blocks, helmT.has('facing') ? helmT.get(helmS, 'facing') : 0, [x - x0, y - y0, z - z0]);
      S.pos = [x0 + S.pivot[0], y0 + S.pivot[1], z0 + S.pivot[2]];
      S.worldCells = cells;
      // carry block entities (crates, furnaces) along
      S.bes = [];
      for (let i = 0; i < cells.length; i += 4) {
        const cx = cells[i], cy = cells[i + 1], czz = cells[i + 2];
        const c = w.col(cx >> 4, czz >> 4); if (!c || !c.blockEntities) continue;
        const bk = (cy << 8) | ((czz & 15) << 4) | (cx & 15);
        const be = c.blockEntities.get(bk);
        if (be) { S.bes.push([cx - x0, cy - y0, czz - z0, be]); c.blockEntities.delete(bk); c.modified = true; if (g.furnaces) g.furnaces.delete(be); }
      }
      this.ship = S;
      this.riding = { type: 'ship' };
      p.flying = false; p.target = null; p.breaking = null; p.pitch = 0;
      p.yaw = S.yaw0;
      this.requestShipMesh(S);
      this.say(T('g.ship.engaged', { n: S.count, t: S.thrusters.length, v: Math.round(S.maxSpeed) }), '#9affd8');
      g.ui.hint(T('g.ship.online'), 3500);
    }
    buildShip(sx, sy, sz, blocks, facing, helmL) {
      const T = R.T;
      const S = { sx, sy, sz, blocks, count: 0, pivot: [sx >> 1, sy >> 1, sz >> 1], vel: [0, 0, 0], psi: 0, roll: 0, pitch: 0, turnVel: 0, state: 'meshing', gpu: null, t: 0 };
      S.yaw0 = -facing * QT;
      const fl = [VR.HF_DX[facing], VR.HF_DZ[facing]];
      const idx = (x, y, z) => (y * sz + z) * sx + x;
      const at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) ? 0 : blocks[idx(x, y, z)];
      const cells = [], all = [], thr = [];
      let reac = 0, seat = null, seatD = 1e9, nose = 0, minY = 1e9, maxY = -1e9;
      const tSeat = R.byName.pilot_seat && R.byName.pilot_seat.id, tThr = R.byName.thruster && R.byName.thruster.id, tReac = R.byName.reactor_core && R.byName.reactor_core.id;
      for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) {
        const s = blocks[idx(x, y, z)]; if (!s) continue;
        S.count++;
        all.push(x, y, z, s);
        const ox = x + 0.5 - S.pivot[0], oy = y + 0.5 - S.pivot[1], oz = z + 0.5 - S.pivot[2];
        if (!at(x + 1, y, z) || !at(x - 1, y, z) || !at(x, y + 1, z) || !at(x, y - 1, z) || !at(x, y, z + 1) || !at(x, y, z - 1)) cells.push(ox, oy, oz);
        const ty = T.type[s];
        if (ty === tThr) { const t = R.types[ty]; const f = t.get(s, 'facing'); thr.push([ox, oy, oz, F6V[f] || [0, 0, 1]]); }
        else if (ty === tReac) reac++;
        else if (ty === tSeat) { const d = Math.abs(x - helmL[0]) + Math.abs(y - helmL[1]) + Math.abs(z - helmL[2]); if (d < seatD && d <= 4) { seatD = d; seat = [x, y, z]; } }
        const fd = ox * fl[0] + oz * fl[1]; if (fd > nose) nose = fd;
        if (oy < minY) minY = oy; if (oy > maxY) maxY = oy;
      }
      S.cells = new Float32Array(cells);
      S.all = all;
      S.thrusters = thr;
      S.nose = nose; S.minY = minY; S.maxY = maxY;
      S.fl = fl;
      if (seat) S.eyeLocal = [seat[0] + 0.5, seat[1] + 1.45, seat[2] + 0.5];
      else S.eyeLocal = [helmL[0] - fl[0] + 0.5, helmL[1] + 1.62, helmL[2] - fl[1] + 0.5];
      S.seatL = seat || [helmL[0] - fl[0], helmL[1], helmL[2] - fl[1]];
      S.seated = !!seat;
      const power = 1 + thr.length + reac * 0.5;
      S.maxSpeed = Math.min(72, 8 + 26 * power / Math.sqrt(S.count / 60 + 1));
      S.turnRate = Math.min(2.4, 2.8 / Math.sqrt(S.count / 220 + 1));
      S.accel = Math.min(2.6, 0.8 + power * 0.25);
      S.radius = Math.max(sx, sy, sz) * 0.6;
      S.rotM = mat4.create(); S.modelMat = mat4.create(); S.normalMat = new Float32Array(9);
      this.updateShipRot(S);
      return S;
    }
    requestShipMesh(S) {
      const g = this.g, pool = g.pool;
      let wi = 0; pool.workers.forEach((wk, i) => { if (wk.inflight < pool.workers[wi].inflight) wi = i; });
      const copy = S.blocks.slice();
      pool.direct(wi, { type: 'shipmesh', sx: S.sx, sy: S.sy, sz: S.sz, blocks: copy }, [copy.buffer], (m) => this.onShipMesh(S, m));
    }
    onShipMesh(S, m) {
      const g = this.g;
      if (this.ship !== S || S.state !== 'meshing') return;
      if (m.type !== 'shipmesh') { this.say(T('g.ship.failed'), '#ff9a8a'); this.ship = null; this.riding = null; return; }
      S.gpu = g.renderer.uploadShip(m.sections);
      // lift the blocks out of the world
      const c = S.worldCells, list = [];
      if (c) { for (let i = 0; i < c.length; i += 4) { list.push([c[i], c[i + 1], c[i + 2], 0]); this.noteBlock(c[i], c[i + 1], c[i + 2], 0); } g.world.bulkSet(list, false); }
      S.worldCells = null;
      S.state = 'flying';
      g.audio.play('warp');
      g.codex && g.codex.event && g.codex.event('ship');
      for (const t of S.thrusters) { const wp = this.shipPoint(S, [t[0] + S.pivot[0], t[1] + S.pivot[1], t[2] + S.pivot[2]]); g.particles.smoke(wp[0], wp[1], wp[2], 6); }
    }
    updateShipRot(S) {
      const m = S.rotM; m.set(IDENT);
      mat4.rotY(m, m, S.psi + S.yaw0);
      if (S.pitch) mat4.rotX(m, m, S.pitch);
      if (S.roll) mat4.rotZ(m, m, S.roll);
      mat4.rotY(m, m, -S.yaw0);
      const n = S.normalMat; n[0] = m[0]; n[1] = m[1]; n[2] = m[2]; n[3] = m[4]; n[4] = m[5]; n[5] = m[6]; n[6] = m[8]; n[7] = m[9]; n[8] = m[10];
    }
    // ship-local point (grid coords) → world
    shipPoint(S, l) {
      const m = S.rotM, x = l[0] - S.pivot[0], y = l[1] - S.pivot[1], z = l[2] - S.pivot[2];
      return [S.pos[0] + m[0] * x + m[4] * y + m[8] * z, S.pos[1] + m[1] * x + m[5] * y + m[9] * z, S.pos[2] + m[2] * x + m[6] * y + m[10] * z];
    }
    shipDir(S, d) { const m = S.rotM; return [m[0] * d[0] + m[4] * d[1] + m[8] * d[2], m[1] * d[0] + m[5] * d[1] + m[9] * d[2], m[2] * d[0] + m[6] * d[1] + m[10] * d[2]]; }
    shipHits(S, px, py, pz, psi) {
      const w = this.g.world, T = R.T, c = Math.cos(psi), s = Math.sin(psi), cells = S.cells, n = cells.length;
      for (let i = 0; i < n; i += 3) {
        const ox = cells[i], oy = cells[i + 1], oz = cells[i + 2];
        const y = Math.floor(py + oy);
        if (y < 1) return true;
        if (y >= VR.MAXY) continue;
        const b = w.getBlock(Math.floor(px + ox * c + oz * s), y, Math.floor(pz - ox * s + oz * c));
        if (b && (T.flags[b] & F.SOLID) && !(T.flags[b] & F.REPLACE)) return true;
      }
      return false;
    }
    driveShip(dt, input, blocked) {
      const g = this.g, p = g.player, S = this.ship;
      if (!S) { this.riding = null; return; }
      const k = (c) => !blocked && !g.ui.typing && input.down(c);
      if (S.state === 'flying') {
        if (!blocked && input.hit('KeyV')) { if (this.landShip(false)) return; }
        const fw = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0), st = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0);
        const up = (k('Space') ? 1 : 0) - (k('ShiftLeft') || k('ShiftRight') ? 1 : 0);
        const boost = k('ControlLeft') || k('ControlRight') ? 1.65 : 1;
        // heading follows where you look (hold Alt to look around freely)
        let turn = 0;
        if (!k('AltLeft')) { const d = wrapA(p.yaw - (S.yaw0 + S.psi)); turn = M.clamp(d, -S.turnRate * dt, S.turnRate * dt); }
        if (turn) { if (!this.shipHits(S, S.pos[0], S.pos[1], S.pos[2], S.psi + turn)) S.psi += turn; else turn = 0; }
        S.turnVel += (turn / Math.max(dt, 1e-3) - S.turnVel) * Math.min(1, dt * 6);
        const h = S.yaw0 + S.psi, fx = -Math.sin(h), fz = -Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
        const vmax = S.maxSpeed * boost;
        const tv = [fx * fw * vmax + rx * st * vmax * 0.4, up * Math.min(20, vmax * 0.55), fz * fw * vmax + rz * st * vmax * 0.4];
        const a = 1 - Math.exp(-dt * S.accel * (fw || st || up ? 1 : 0.7));
        for (let i = 0; i < 3; i++) S.vel[i] += (tv[i] - S.vel[i]) * a;
        for (const ax of [0, 2, 1]) {
          const d = S.vel[ax] * dt; if (!d) continue;
          const np = [S.pos[0], S.pos[1], S.pos[2]]; np[ax] += d;
          if (ax === 1) { if (np[1] + S.maxY > 254) { S.vel[1] = 0; continue; } }
          if (this.shipHits(S, np[0], np[1], np[2], S.psi)) {
            if (Math.abs(S.vel[ax]) > 9) { g.audio.play('explode', { vol: 0.25 }); g.damageFlash = 0.3; }
            S.vel[ax] *= -0.12;
          } else S.pos[ax] = np[ax];
        }
        // visual attitude
        S.roll += (M.clamp(S.turnVel * 0.45, -0.5, 0.5) - S.roll) * (1 - Math.exp(-dt * 3));
        S.pitch += (M.clamp(S.vel[1] * 0.018 + fw * 0.03, -0.22, 0.22) - S.pitch) * (1 - Math.exp(-dt * 3));
        this.updateShipRot(S);
        // thrusters & sound
        const speed = Math.hypot(S.vel[0], S.vel[1], S.vel[2]);
        const thrust = Math.min(1, (Math.abs(fw) + Math.abs(up) * 0.6 + Math.abs(st) * 0.4) * boost);
        g.audio.loop('engine', 0.18 + thrust * 0.32, 0.25 + Math.min(1, speed / 60) * 0.9);
        const nThr = Math.min(10, S.thrusters.length);
        for (let i = 0; i < nThr; i++) {
          const t = S.thrusters[(i + g.frame) % S.thrusters.length];
          if (Math.random() > 0.35 + thrust * 0.65) continue;
          const dir = this.shipDir(S, t[3]);
          const wp = this.shipPoint(S, [t[0] + S.pivot[0] + t[3][0] * 0.6, t[1] + S.pivot[1] + t[3][1] * 0.6, t[2] + S.pivot[2] + t[3][2] * 0.6]);
          const v = 6 + thrust * 14;
          g.particles.spawn(wp[0], wp[1], wp[2], dir[0] * v + S.vel[0] * 0.8, dir[1] * v + S.vel[1] * 0.8, dir[2] * v + S.vel[2] * 0.8, { life: 0.18 + thrust * 0.2, size: 0.18 + thrust * 0.12, grav: 0, col: boost > 1 ? [0.5, 0.8, 1] : [1, 0.6, 0.25], emis: 1, drag: 2, grow: 0.6, collide: false });
        }
        // lasers from the nose
        const fire = input.dragLook ? input.clickAction(0) : input.mouse.down[0];
        if (!blocked && fire && this.fireCool <= 0 && g.entities) {
          this.fireCool = 0.17;
          const d3 = p.lookDir();
          for (const side of [-1.4, 1.4]) {
            const l = [S.pivot[0] + S.fl[0] * (S.nose + 0.6) + (-S.fl[1]) * side, S.pivot[1], S.pivot[2] + S.fl[1] * (S.nose + 0.6) + S.fl[0] * side];
            g.entities.fireBolt(this.shipPoint(S, l), d3, 110, 10, p, [0.4, 1, 1]);
          }
        }
        if (S.pos[1] + S.maxY > 235) g.codex && g.codex.event && g.codex.event('orbit');
      }
      // keep the pilot in the seat
      const e = this.shipPoint(S, S.eyeLocal);
      p.pos = [e[0], e[1] - p.eye, e[2]]; p.vel = S.vel.slice(); p.fallStart = null;
    }
    // snap to the block grid and put the blocks back into the world
    landShip(force) {
      const g = this.g, w = g.world, p = g.player, T = R.T, S = this.ship;
      if (!S || S.state !== 'flying') return false;
      const q = Math.round(S.psi / QT), psiS = q * QT, kf = ((-q % 4) + 4) % 4;
      const c = Math.round(Math.cos(psiS)), s = Math.round(Math.sin(psiS));
      const all = S.all, P = S.pivot;
      const place = (bx, by, bz, check) => {
        const out = [];
        for (let i = 0; i < all.length; i += 4) {
          const ox = all[i] + 0.5 - P[0], oy = all[i + 1] + 0.5 - P[1], oz = all[i + 2] + 0.5 - P[2];
          const x = Math.floor(bx + ox * c + oz * s), y = Math.floor(by + oy), z = Math.floor(bz - ox * s + oz * c);
          if (y < 0 || y >= VR.MAXY) { if (check) return null; continue; }
          if (!w.col(x >> 4, z >> 4)) { if (check) return null; continue; }
          const b = w.getBlock(x, y, z);
          if (b && !(T.flags[b] & F.REPLACE)) { if (check) return null; continue; }
          out.push([x, y, z, rotateState(all[i + 3], kf), all[i], all[i + 1], all[i + 2]]);
        }
        return out;
      };
      const base = [Math.round(S.pos[0]), Math.round(S.pos[1]), Math.round(S.pos[2])];
      let list = null, at = null;
      outer: for (const dy of [0, 1, 2, -1, 3, 4, 5, 6]) for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        list = place(base[0] + dx, base[1] + dy, base[2] + dz, true);
        if (list) { at = [base[0] + dx, base[1] + dy, base[2] + dz]; break outer; }
      }
      if (!list) {
        if (!force) { g.ui.hint(T('g.ship.noRoom'), 2600); g.audio.play('zap'); return false; }
        at = base; list = place(base[0], base[1], base[2], false);
      }
      const touched = new Set();
      g.world.bulkSet(list.map((e) => [e[0], e[1], e[2], e[3]]), false);
      for (const e of list) { touched.add(VR.ckey(e[0] >> 4, e[2] >> 4)); this.noteBlock(e[0], e[1], e[2], e[3]); }
      // block entities come back with the ship
      const map = new Map(); for (const e of list) map.set(e[4] + ',' + e[5] + ',' + e[6], e);
      for (const [lx, ly, lz, be] of S.bes || []) {
        const e = map.get(lx + ',' + ly + ',' + lz); if (!e) continue;
        const col = w.col(e[0] >> 4, e[2] >> 4); if (!col) continue;
        col.blockEntities.set((e[1] << 8) | ((e[2] & 15) << 4) | (e[0] & 15), be); col.modified = true;
        if (be.pos) be.pos = [e[0], e[1], e[2]];
      }
      // freeze the render transform on the landing spot until the terrain meshes catch up
      S.pos = at.slice(); S.psi = psiS; S.roll = 0; S.pitch = 0; S.vel = [0, 0, 0];
      this.updateShipRot(S);
      S.state = 'landing'; S.landT = 0; S.landCols = touched;
      this.riding = null;
      g.audio.loop('engine', 0);
      g.audio.play('door');
      // the pilot steps out of the seat
      const sl = S.seatL, sw = this.shipPoint(S, [sl[0] + 0.5, sl[1] + 0.5, sl[2] + 0.5]);
      const spot = this.freeSpot([[sw[0], Math.floor(sw[1]) + 0.4, sw[2]], [sw[0] + 1, Math.floor(sw[1]), sw[2]], [sw[0] - 1, Math.floor(sw[1]), sw[2]], [sw[0], Math.floor(sw[1]), sw[2] + 1], [sw[0], Math.floor(sw[1]), sw[2] - 1]]);
      p.teleport(spot[0], spot[1], spot[2]);
      g.ui.vehicleHud(null);
      if (this.meta.flyingShip) delete this.meta.flyingShip;
      this.say(T('g.ship.landed'), '#9affd8');
      return true;
    }
    finishLanding(dt) {
      const S = this.ship, w = this.g.world;
      S.landT += dt;
      let ready = S.landT > 0.3;
      if (ready) for (const k of S.landCols) { const c = w.cols.get(k); if (!c) continue; for (const s of c.sec) if (s.dirty || s.pending) { ready = false; break; } if (!ready) break; }
      if (ready || S.landT > 6) { if (S.gpu) this.g.renderer.freeShip(S.gpu); this.ship = null; }
    }
    serializeShip() {
      const S = this.ship;
      if (!S || S.state !== 'flying') return null;
      return { sx: S.sx, sy: S.sy, sz: S.sz, blocks: S.blocks, facing: Math.round(-S.yaw0 / QT) & 3, pos: S.pos.slice(), psi: S.psi, bes: S.bes };
    }
    tryRestoreShip() {
      const g = this.g, w = g.world, d = this.restore;
      if (!d || !d.blocks) { this.restore = null; return; }
      const r = Math.max(d.sx, d.sz);
      for (let dz = -r; dz <= r; dz += 8) for (let dx = -r; dx <= r; dx += 8) if (!w.col(Math.floor(d.pos[0] + dx) >> 4, Math.floor(d.pos[2] + dz) >> 4)) return;
      this.restore = null;
      const blocks = d.blocks instanceof Uint16Array ? d.blocks : new Uint16Array(d.blocks);
      const S = this.buildShip(d.sx, d.sy, d.sz, blocks, d.facing || 0, [d.sx >> 1, d.sy >> 1, d.sz >> 1]);
      S.pos = d.pos.slice(); S.psi = d.psi || 0; S.bes = d.bes || []; S.state = 'flying';
      this.updateShipRot(S);
      this.ship = S;
      this.landShip(true);
      if (this.ship) { this.ship.landT = 10; this.finishLanding(0); }
      delete this.meta.flyingShip;
    }
    shutdown() { if (this.ship && this.ship.state === 'flying') this.landShip(true); if (this.ship) { if (this.ship.gpu) this.g.renderer.freeShip(this.ship.gpu); this.ship = null; } this.riding = null; this.drone = null; }
    beforeSave(meta) {
      const d = this.serializeShip();
      if (d) meta.flyingShip = d; else delete meta.flyingShip;
      meta.waypoints = this.waypoints;
      meta.bikeSpawns = [...this.bikeSpawns];
    }
    // creative: conjure a shuttle in front of the player
    // build a designed ship in front of the player (volume cleared first so nothing fuses with the hull)
    summonDesign(bp, p) {
      const g = this.g, w = g.world, SG = VR.ShipGen;
      if (!SG || !bp || !bp.helm) return false;
      const dir = VR.Place.playerFacing(p.yaw);
      const b = SG.bounds(bp);
      const fx = VR.HF_DX[dir], fz = VR.HF_DZ[dir];
      const dist = Math.ceil(Math.max(b.z1 - b.z0, b.x1 - b.x0) / 2) + 5;
      const cx = Math.floor(p.pos[0] + fx * dist), cz = Math.floor(p.pos[2] + fz * dist);
      let base = 0;
      for (let u = b.x0; u <= b.x1; u += 2) for (let v = b.z0; v <= b.z1; v += 2) { const [dx, dz] = VR.rotXZ(u, v, dir); if (!w.col((cx + dx) >> 4, (cz + dz) >> 4)) { g.ui.hint(T('g.ship.noGround'), 2500); return false; } base = Math.max(base, w.topAt(cx + dx, cz + dz)); }
      base = Math.min(base + 1, 254 - b.h);
      const seen = new Map(), undo = [];
      const put = (x, y, z, s) => { if (y < 0 || y >= VR.MAXY || !w.col(x >> 4, z >> 4)) return; const k = K3(x, y, z); if (!seen.has(k)) undo.push([x, y, z, w.getBlock(x, y, z)]); seen.set(k, [x, y, z, s]); };
      for (let yy = 0; yy <= b.h + 1; yy++) for (let u = b.x0 - 1; u <= b.x1 + 1; u++) for (let v = b.z0 - 1; v <= b.z1 + 1; v++) { const [dx, dz] = VR.rotXZ(u, v, dir); put(cx + dx, base + yy, cz + dz, 0); }
      SG.place(bp, put, cx, base, cz, dir);
      this.applyEdit([...seen.values()], undo);
      g.audio.play('warp');
      g.particles.explosion(cx + 0.5, base + b.h * 0.5, cz + 0.5, 0.8);
      this.say(T('g.ship.ready', { name: bp.name, label: bp.label }), '#9affd8');
      return true;
    }
    summonShuttle(p) { if (VR.ShipGen) return this.summonDesign(VR.ShipGen.design((Math.random() * 4294967295) >>> 0, 'shuttle'), p); return this.summonShuttleClassic(p); }
    summonShuttleClassic(p) {
      const g = this.g, w = g.world;
      if (!VR.buildShuttle) return;
      const dir = VR.Place.playerFacing(p.yaw);
      const fx = VR.HF_DX[dir], fz = VR.HF_DZ[dir];
      const cx = Math.floor(p.pos[0] + fx * 16), cz = Math.floor(p.pos[2] + fz * 16);
      const rot = (u, v) => { switch (dir) { case 0: return [u, v]; case 1: return [-v, u]; case 2: return [-u, -v]; default: return [v, -u]; } };
      let base = 0;
      for (let u = -9; u <= 9; u += 3) for (let v = -10; v <= 11; v += 3) { const [dx, dz] = rot(u, v); base = Math.max(base, w.topAt(cx + dx, cz + dz)); }
      base = Math.min(base + 1, 236);
      const list = [], undo = [];
      const put = (u, yy, v, s) => { const [dx, dz] = rot(u, v); const x = cx + dx, y = base + yy, z = cz + dz; if (!w.col(x >> 4, z >> 4)) return; list.push([x, y, z, s]); undo.push([x, y, z, w.getBlock(x, y, z)]); };
      // clear the volume first so trees don't fuse with the hull
      for (let yy = 0; yy <= 12; yy++) for (let u = -10; u <= 10; u++) for (let v = -10; v <= 11; v++) put(u, yy, v, 0);
      VR.buildShuttle(put, (f) => (f + dir) % 4, new VR.RNG((Math.random() * 1e9) | 0));
      // later writes win: collapse duplicates
      const last = new Map(); for (const e of list) last.set(K3(e[0], e[1], e[2]), e);
      const fin = [...last.values()];
      this.applyEdit(fin, undo);
      g.audio.play('warp');
      g.particles.explosion(cx + 0.5, base + 4, cz + 0.5, 0.6);
      this.say(T('g.ship.shuttle'), '#9affd8');
    }

    // ================================================================ turrets
    scanColumn(c) {
      const tt = R.byName.turret; if (!tt || !c.blocks) return;
      const tid = tt.id, T = R.T, b = c.blocks;
      for (let i = 0; i < b.length; i++) { const s = b[i]; if (s && T.type[s] === tid) this.addTurret(c.cx * 16 + (i & 15), i >> 8, c.cz * 16 + ((i >> 4) & 15)); }
    }
    addTurret(x, y, z) { const k = K3(x, y, z); if (!this.turrets.has(k)) this.turrets.set(k, { x, y, z, yaw: Math.random() * TAU, pitch: 0, cool: Math.random(), retarget: Math.random() * 0.3, target: null }); }
    noteBlock(x, y, z, s) {
      const tt = R.byName.turret; if (!tt) return;
      if (s && R.T.type[s] === tt.id) this.addTurret(x, y, z); else this.turrets.delete(K3(x, y, z));
    }
    onBlockChanged(x, y, z, old, s) { if ((old && R.T.type[old] === (R.byName.turret && R.byName.turret.id)) || (s && R.T.type[s] === (R.byName.turret && R.byName.turret.id))) this.noteBlock(x, y, z, s); }
    onColumnLoaded(c) {
      this.scanColumn(c);
      if (c.spawns) for (const s of c.spawns) if (s[0] === 'hoverbike') this.spawnFromGen('hoverbike', s[1], s[2], s[3]);
      c.spawns = null;
    }
    updateTurrets(dt) {
      const g = this.g, p = g.player, ents = g.entities, w = g.world;
      if (!ents || !this.turrets.size) return;
      let n = 0;
      const get = (x, y, z) => w.getBlock(x, y, z);
      for (const t of this.turrets.values()) {
        const hx = t.x + 0.5, hy = t.y + 0.95, hz = t.z + 0.5;
        const dxp = hx - p.pos[0], dzp = hz - p.pos[2];
        if (dxp * dxp + dzp * dzp > 100 * 100) continue;
        if (++n > 48) break;
        t.cool -= dt; t.retarget -= dt;
        if (t.retarget <= 0) {
          t.retarget = 0.35; t.target = null;
          let best = 30 * 30;
          for (const m of ents.mobs) {
            if (m.dead || !m.def.hostile) continue;
            const ex = m.pos[0] - hx, ey = m.pos[1] + m.h * 0.5 - hy, ez = m.pos[2] - hz, d2 = ex * ex + ey * ey + ez * ez;
            if (d2 >= best) continue;
            const d = Math.sqrt(d2);
            const hit = PH.raycast(get, hx + ex / d * 0.7, hy + ey / d * 0.7, hz + ez / d * 0.7, ex / d, ey / d, ez / d, d - 0.7);
            if (hit && hit.dist < d - 1.2) continue;
            best = d2; t.target = m;
          }
        }
        let wy, wp;
        const m = t.target;
        if (m && !m.dead) {
          const ex = m.pos[0] + m.vel[0] * 0.15 - hx, ey = m.pos[1] + m.h * 0.5 - hy, ez = m.pos[2] + m.vel[2] * 0.15 - hz;
          wy = Math.atan2(-ex, -ez); wp = Math.atan2(ey, Math.hypot(ex, ez));
        } else { wy = t.yaw + dt * 0.6; wp = Math.sin(this.time * 0.7 + t.x) * 0.12; t.target = null; }
        const dy = wrapA(wy - t.yaw); t.yaw += M.clamp(dy, -6 * dt, 6 * dt);
        t.pitch += M.clamp(wp - t.pitch, -4 * dt, 4 * dt);
        if (t.target && Math.abs(dy) < 0.12 && t.cool <= 0) {
          t.cool = 0.65;
          const cp = Math.cos(t.pitch), d = [-Math.sin(t.yaw) * cp, Math.sin(t.pitch), -Math.cos(t.yaw) * cp];
          ents.bolts.push({ pos: [hx + d[0] * 0.8, hy + 0.05 + d[1] * 0.8, hz + d[2] * 0.8], vel: [d[0] * 70, d[1] * 70, d[2] * 70], dmg: 6, owner: t, friendly: true, life: 1.2, col: [0.3, 1, 1] });
          if (dxp * dxp + dzp * dzp < 40 * 40) g.audio.play('laser');
        }
      }
    }

    // ================================================================ night raids
    updateRaid(dt) {
      const g = this.g, p = g.player, E = g.env.E, st = this.raid;
      if (st.active) {
        st.mobs = st.mobs.filter((m) => !m.dead && g.entities && g.entities.mobs.indexOf(m) >= 0);
        if (!st.mobs.length) {
          st.active = false; g.raidActive = false;
          if (st.killed) { this.say(T('g.raid.won'), '#9affd8'); g.addXP && g.addXP(20); g.codex && g.codex.event && g.codex.event('raid'); }
        } else if (E.night < 0.25 || p.mode !== 'survival') { for (const m of st.mobs) m.dead = true; st.mobs = []; st.active = false; g.raidActive = false; }
        return;
      }
      g.raidActive = false;
      if (p.mode !== 'survival' || g.difficulty === 'peaceful' || !g.entities || g.dim !== 'overworld') return;
      st.checkT -= dt; if (st.checkT > 0) return;
      st.checkT = 20;
      const tod = g.env.timeOfDay;
      if (E.night > 0.8 && tod > 14000 && tod < 21000 && st.lastDay !== g.env.day && Math.random() < 0.035 && !(g.mp && g.mp.isClient)) this.startRaid();
    }
    startRaid() {
      const g = this.g, p = g.player, w = g.world, st = this.raid;
      if (!g.entities) return;
      const n = g.difficulty === 'hard' ? 6 : g.difficulty === 'easy' ? 3 : 4;
      const a = Math.random() * TAU;
      const cx = p.pos[0] + Math.cos(a) * 46, cz = p.pos[2] + Math.sin(a) * 46;
      st.mobs = [];
      for (let i = 0; i < n; i++) {
        const x = cx + (Math.random() - 0.5) * 8, z = cz + (Math.random() - 0.5) * 8;
        const y = Math.max(p.pos[1] + 12, w.topAt(Math.floor(x), Math.floor(z)) + 8);
        const m = g.entities.summon('raider_drone', x, y, z);
        if (m) { m.raid = true; st.mobs.push(m); }
      }
      st.active = st.mobs.length > 0; st.lastDay = g.env.day; st.killed = false;
      g.raidActive = st.active;
      const dirs = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
      const di = Math.round(((a % TAU) + TAU) % TAU / (TAU / 8)) % 8;
      this.say(T('g.raid.inbound', { dir: T('g.dir.' + dirs[di]) }), '#ffae6a');
      g.audio.play('warp');
    }
    onMobKilled(m) { if (m.raid) this.raid.killed = true; }

    // ================================================================ meteors
    updateMeteors(dt) {
      const g = this.g, p = g.player, E = g.env.E;
      if (p.mode === 'survival' && g.dim === 'overworld' && g.difficulty !== 'peaceful') {
        this.meteorT -= dt;
        if (this.meteorT <= 0) { this.meteorT = 100 + Math.random() * 160; if (E.night > 0.55 && Math.random() < 0.4 && !(g.mp && g.mp.isClient)) this.spawnMeteor(); }
      }
      for (let i = this.meteors.length - 1; i >= 0; i--) {
        const m = this.meteors[i];
        m.t += dt;
        const step = [m.vel[0] * dt, m.vel[1] * dt, m.vel[2] * dt];
        const len = Math.hypot(step[0], step[1], step[2]);
        const hit = PH.raycast((x, y, z) => g.world.getBlock(x, y, z), m.pos[0], m.pos[1], m.pos[2], step[0] / len, step[1] / len, step[2] / len, len);
        const trail = Math.min(12, Math.ceil(len * 2));
        for (let k = 0; k < trail; k++) {
          const f = k / trail;
          const x = m.pos[0] + step[0] * f, y = m.pos[1] + step[1] * f, z = m.pos[2] + step[2] * f;
          g.particles.spawn(x + (Math.random() - 0.5) * 0.6, y + (Math.random() - 0.5) * 0.6, z + (Math.random() - 0.5) * 0.6, 0, 0, 0, { life: 0.5 + Math.random() * 0.6, size: 0.35 + Math.random() * 0.4, grav: -0.5, col: [1, 0.55 + Math.random() * 0.35, 0.2], emis: 1, drag: 1, grow: 0.5, collide: false });
          if (Math.random() < 0.3) g.particles.spawn(x, y, z, 0, 0.4, 0, { life: 2.5, size: 0.5, grav: -0.3, col: [0.3, 0.28, 0.3], drag: 1, grow: 0.7, collide: false });
        }
        if (hit || m.t > 12) { this.impact(hit ? [hit.px, hit.py, hit.pz] : m.pos, m); this.meteors.splice(i, 1); continue; }
        m.pos[0] += step[0]; m.pos[1] += step[1]; m.pos[2] += step[2];
      }
    }
    spawnMeteor(tx, tz) {
      const g = this.g, p = g.player, w = g.world;
      if (tx === undefined) { const a = Math.random() * TAU, d = 28 + Math.random() * 50; tx = p.pos[0] + Math.cos(a) * d; tz = p.pos[2] + Math.sin(a) * d; }
      if (!w.col(Math.floor(tx) >> 4, Math.floor(tz) >> 4)) return false;
      const ty = w.topAt(Math.floor(tx), Math.floor(tz)) + 1;
      const b = Math.random() * TAU;
      const pos = [tx + Math.cos(b) * 150, Math.min(250, ty + 170), tz + Math.sin(b) * 150];
      const d = [tx - pos[0], ty - pos[1], tz - pos[2]], L = Math.hypot(d[0], d[1], d[2]);
      this.meteors.push({ pos, vel: [d[0] / L * 58, d[1] / L * 58, d[2] / L * 58], t: 0 });
      g.audio.play('meteor');
      this.say(T('g.meteor'), '#ffcf8a');
      return true;
    }
    impact(at, m) {
      const g = this.g, w = g.world, p = g.player, T = R.T;
      const cx = Math.floor(at[0]), cy = Math.floor(at[1]), cz = Math.floor(at[2]);
      const dist = Math.hypot(p.pos[0] - at[0], p.pos[1] - at[1], p.pos[2] - at[2]);
      g.audio.play('explode', { vol: Math.max(0.2, 1.4 - dist / 80) });
      g.particles.explosion(at[0], at[1] + 1, at[2], 1.6);
      if (dist < 9 && p.mode === 'survival') p.damage(Math.round(10 * (1 - dist / 9)), 'explosion', at);
      if (p.mode === 'zen') return;
      const r = 3.3 + Math.random() * 1.6, R0 = Math.ceil(r) + 1;
      const list = [];
      const bedrock = R.byName.bedrock && R.byName.bedrock.defaultState;
      const cry = VR.CRYSTALS ? VR.CRYSTALS[Math.floor(Math.random() * VR.CRYSTALS.length)][0] : 'violet';
      const S = (n, pr) => R.byName[n] ? (pr ? R.S(n, pr) : R.byName[n].defaultState) : 0;
      const magma = S('magma_block'), obs = S('obsidian'), ember = S('emberrock') || S('netherrack'), cblock = S(cry + '_crystal_block');
      const cluster = R.byName[cry + '_crystal_cluster'] ? R.S(cry + '_crystal_cluster', { facing: 4, size: 1 }) : 0;
      for (let dy = -R0; dy <= R0; dy++) for (let dz = -R0; dz <= R0; dz++) for (let dx = -R0; dx <= R0; dx++) {
        const x = cx + dx, y = cy + dy, z = cz + dz;
        if (y < 1 || y >= VR.MAXY) continue;
        const d = Math.sqrt(dx * dx + (dy * 1.25) * (dy * 1.25) + dz * dz);
        const cur = w.getBlock(x, y, z);
        if (cur === bedrock) continue;
        if (d <= r) list.push([x, y, z, 0]);
        else if (d <= r + 1.1 && dy < 0 && cur && (T.flags[cur] & F.SOLID)) {
          const rn = Math.random();
          list.push([x, y, z, rn < 0.35 ? magma : rn < 0.55 ? obs : rn < 0.7 ? cblock : ember || obs]);
        }
      }
      // the meteorite core
      const floorY = cy - Math.floor(r / 1.25);
      list.push([cx, floorY, cz, cblock || obs]); list.push([cx, floorY + 1, cz, cluster]);
      for (let k = 0; k < 5; k++) { const a = Math.random() * TAU, rr = 1 + Math.random() * (r - 1.5); const x = cx + Math.round(Math.cos(a) * rr), z = cz + Math.round(Math.sin(a) * rr); let y = floorY + 2; while (y > floorY - 3 && !(w.getBlock(x, y - 1, z) && (T.flags[w.getBlock(x, y - 1, z)] & F.SOLID))) y--; list.push([x, y, z, cluster]); }
      const last = new Map(); for (const e of list) if (w.col(e[0] >> 4, e[2] >> 4)) last.set(K3(e[0], e[1], e[2]), e);
      w.bulkSet([...last.values()], false);
      if (g.entities) g.entities.dropStack({ id: 'star_core', n: 1 }, false, [cx + 0.5, floorY + 2.5, cz + 0.5]);
      // knock nearby mobs about
      if (g.entities) for (const mob of g.entities.mobs) { const dd = Math.hypot(mob.pos[0] - at[0], mob.pos[2] - at[2]); if (dd < 8) g.entities.hurtMob(mob, 12 * (1 - dd / 8), at); }
      void m;
    }

    // ================================================================ misc
    dropInventory(p) {
      const g = this.g;
      if (!g.entities) return;
      const all = [...p.inv.slots, ...(p.inv.armor || []), p.inv.offhand];
      for (const st of all) if (st && st.n > 0) { const it = g.entities.dropStack({ id: st.id, n: st.n, dmg: st.dmg }, false, [p.pos[0], p.pos[1] + 1, p.pos[2]]); it.vel = [(Math.random() - 0.5) * 6, 3 + Math.random() * 3, (Math.random() - 0.5) * 6]; it.delay = 2; }
      p.inv.slots.fill(null); if (p.inv.armor) p.inv.armor.fill(null); p.inv.offhand = null; p.inv.changed = true;
    }
    hudText() {
      const g = this.g, p = g.player;
      const r = this.riding;
      if (this.drone) return null;
      // in the cockpit the heads-up display shows the numbers; keep only the key hints
      const ck = g.cockpit && g.cockpit.active();
      if (ck && r && (r.type === 'starship' || (r.type === 'ship' && this.ship && this.ship.state !== 'meshing'))) return g.cockpit.activeT < 9 ? '<small>' + T('g.ship.keys') + (r.type === 'starship' ? ' · <b>' + T('g.ship.keyAuto') + '</b>' : '') + ' · <b>' + T('g.ship.keyLand') + '</b></small>' : null;
      if (r && r.type === 'starship') return g.starships ? g.starships.hudText() : null;
      if (r && r.type === 'ship' && this.ship) {
        const S = this.ship;
        if (S.state === 'meshing') return T('g.ship.spooling');
        const sp = Math.hypot(S.vel[0], S.vel[1], S.vel[2]);
        const hd = ((Math.round(-(S.yaw0 + S.psi) * 180 / Math.PI) % 360) + 360) % 360;
        return T('g.ship.hud', { v: Math.round(sp), alt: Math.round(S.pos[1]), hd, n: S.count });
      }
      if (r && r.type === 'bike') return T('g.bike.hud', { v: Math.round(Math.abs(r.bike.spd || 0)) });
      if (r && r.type === 'seat') return null;
      if (r && r.type === 'tram') return g.trams ? g.trams.hud(r) : null;
      const h = p.inv.held, d = h ? VR.itemDef(h.id) : null;
      if (d && d.use === 'wand') {
        const B = this.wandBox(), blk = this.wandBlock();
        const sz = B ? `${B[3] - B[0] + 1}×${B[4] - B[1] + 1}×${B[5] - B[2] + 1}` : T(this.wand.a ? 'g.wand.cornerA' : 'g.wand.noSel');
        return T('g.wand.hud', { sz, blk: blk ? blk.display : '—' });
      }
      if (d && d.use === 'blueprint' && this.blue) return this.blue.hud(d);
      if (d && d.use === 'laser') return this.overheat > 0 ? '<b style="color:#ff6a6a">' + T('g.laser.overheated') + '</b>' : (this.heat > 0.05 ? `${T('g.laser.heat')}${'▮'.repeat(Math.ceil(this.heat * 10))}${'▯'.repeat(10 - Math.ceil(this.heat * 10))}` : null);
      const jet = (p.inv.armor[1] && p.inv.armor[1].id === 'jetpack') || (h && h.id === 'jetpack');
      if (jet && (!p.onGround || this.jetFuel < 1) && !p.creative) return `${T('g.jet.fuel')}${'▮'.repeat(Math.ceil(this.jetFuel * 10))}${'▯'.repeat(10 - Math.ceil(this.jetFuel * 10))}`;
      if (jet && !p.onGround) return T('g.jet.hold');
      return null;
    }
    outlines() {
      const out = [];
      const p = this.g.player, h = p.inv.held, d = h ? VR.itemDef(h.id) : null;
      if (d && d.use === 'wand') {
        const B = this.wandBox();
        if (B) out.push({ x: B[0], y: B[1], z: B[2], boxes: [[0, 0, 0, B[3] - B[0] + 1, B[4] - B[1] + 1, B[5] - B[2] + 1]], color: [0.2, 1, 1, 0.9] });
        else if (this.wand.a) out.push({ x: this.wand.a[0], y: this.wand.a[1], z: this.wand.a[2], boxes: [[0, 0, 0, 1, 1, 1]], color: [0.2, 1, 1, 0.9] });
        const c = this.wand.clip, o = this.pasteOrigin();
        if (c && o) out.push({ x: o[0], y: o[1], z: o[2], boxes: [[0, 0, 0, c.sx, c.sy, c.sz]], color: [1, 0.35, 0.9, 0.8] });
      }
      if (d && d.use === 'blueprint' && this.blue) this.blue.outlines(out);
      if (this.scanData) for (const gr of this.scanData.groups) out.push(gr);
      return out;
    }

    // ================================================================ camera
    vehicleCam(cam) {
      const g = this.g, p = g.player;
      if (this.drone) { const d = this.drone; return { x: d.pos[0], y: d.pos[1], z: d.pos[2], yaw: p.yaw, pitch: p.pitch, roll: 0, fov: cam.fov, far: cam.far, fixed: true }; }
      const r = this.riding;
      if (!r) return null;
      if (r.type === 'starship') return g.starships && g.starships.pilot ? g.starships.camera(cam) : null;
      if (r.type === 'tram') return g.trams ? g.trams.camera(cam, r) : null;
      if (r.type === 'seat') { if (g.camMode !== 0) return null; return Object.assign(cam, { x: r.x + 0.5, y: r.base + 1.45, z: r.z + 0.5, roll: 0, fixed: true }); }
      if (r.type === 'bike') {
        const b = r.bike;
        if (g.camMode === 0) return Object.assign(cam, { x: b.pos[0] - Math.sin(b.yaw) * 0.15, y: b.pos[1] + 1.5, z: b.pos[2] - Math.cos(b.yaw) * 0.15, roll: b.roll * 0.4, fixed: true, fov: cam.fov * (1 + Math.min(0.12, Math.abs(b.spd) / 250)) });
        const c = this.chase([b.pos[0], b.pos[1] + 1.2, b.pos[2]], g.camMode === 1 ? 5.5 : 9, 1.2, p);
        return Object.assign(cam, { x: c[0], y: c[1], z: c[2], roll: 0, fixed: true });
      }
      if (r.type === 'ship' && this.ship) {
        const S = this.ship;
        const sp = Math.hypot(S.vel[0], S.vel[1], S.vel[2]);
        const fovK = 1 + Math.min(0.15, sp / 500);
        if (g.camMode === 0) { const e = this.shipPoint(S, S.eyeLocal); return Object.assign(cam, { x: e[0], y: e[1], z: e[2], roll: S.roll * 0.6, fixed: true, fov: cam.fov * fovK }); }
        const dist = Math.max(9, S.radius * (g.camMode === 1 ? 1.55 : 2.6));
        const c = this.chase(S.pos, dist, S.radius * 0.3, p);
        return Object.assign(cam, { x: c[0], y: c[1], z: c[2], roll: 0, fixed: true, fov: cam.fov * fovK, far: cam.far + 60 });
      }
      return null;
    }
    chase(target, dist, height, p) {
      const w = this.g.world, dir = p.lookDir();
      const cx = target[0] - dir[0] * dist, cy = target[1] - dir[1] * dist + height, cz = target[2] - dir[2] * dist;
      const dx = cx - target[0], dy = cy - target[1], dz = cz - target[2], L = Math.hypot(dx, dy, dz) || 1;
      const hit = PH.raycast((x, y, z) => w.getBlock(x, y, z), target[0], target[1], target[2], dx / L, dy / L, dz / L, L);
      const d = hit ? Math.max(1.2, hit.dist - 0.5) : L;
      return [target[0] + dx / L * d, target[1] + dy / L * d, target[2] + dz / L * d];
    }
    // called by the game instead of player physics while controlling a vehicle/drone
    drive(dt, input, blocked) {
      const g = this.g, p = g.player;
      if (!blocked && input.captured && !g.ui.typing) {
        const sens = input.sensitivity;
        p.yaw -= input.mouse.dx * sens;
        p.pitch = M.clamp(p.pitch - input.mouse.dy * sens * (input.invertY ? -1 : 1), -1.55, 1.55);
      }
      if (this.drone) { this.driveDrone(dt, input, blocked); return; }
      const r = this.riding; if (!r) return;
      if (r.type === 'starship') { if (g.starships && g.starships.pilot) g.starships.drive(dt, input, blocked); else this.riding = null; p.target = null; return; }
      if (r.type === 'bike') this.driveBike(dt, input, r.bike, blocked);
      else if (r.type === 'ship') this.driveShip(dt, input, blocked);
      else if (r.type === 'seat') this.driveSeat(dt, input, blocked);
      else if (r.type === 'tram') { if (g.trams) g.trams.driveRide(dt, input, blocked, r); else this.dismount(); }
      p.target = null;
    }

    // ================================================================ rendering
    drawVehicles(r, E, cam, prog) {
      const g = this.g, ents = g.entities, gl = r.gl, p = g.player;
      if (!ents) return;
      const bikeM = this.bikes.length ? VR.getVoxModel(gl, 'hoverbike') : null;
      for (const b of this.bikes) {
        const dx = b.pos[0] - cam.x, dy = b.pos[1] - cam.y, dz = b.pos[2] - cam.z;
        if (dx * dx + dz * dz > 120 * 120) continue;
        if (!mat4.boxInFrustum(r.planes, dx - 2, dy - 1, dz - 2, dx + 2, dy + 2, dz + 2)) continue;
        const light = ents.lightAt(b.pos[0], b.pos[1] + 0.5, b.pos[2]);
        const t = this.time;
        ents.drawModel(r, prog, bikeM, b.pos, cam, b.yaw, { pod_l: [0, 0, Math.sin(t * 3) * 0.05], pod_r: [0, 0, -Math.sin(t * 3) * 0.05] }, light, { roll: b.roll, pitch: b.pitch });
        if (b.rider && g.camMode !== 0) this.drawRider(r, prog, [b.pos[0] - Math.sin(b.yaw) * 0.05, b.pos[1] - 0.05, b.pos[2] - Math.cos(b.yaw) * 0.05], cam, b.yaw, light, b.roll);
      }
      // pilot visible from the chase camera
      const S = this.ship;
      if (S && S.state === 'flying' && this.riding && this.riding.type === 'ship' && g.camMode !== 0) {
        const sp = this.shipPoint(S, [S.seatL[0] + 0.5, S.seatL[1] + 0.38 - 0.75, S.seatL[2] + 0.5]);
        this.drawRider(r, prog, sp, cam, S.yaw0 + S.psi, ents.lightAt(sp[0], sp[1] + 1, sp[2]), S.roll);
      }
      if (this.riding && this.riding.type === 'seat' && g.camMode !== 0) {
        const rr = this.riding, s = g.world.getBlock(rr.x, rr.y, rr.z), t = R.types[R.T.type[s]];
        const f = t && t.has('facing') ? t.get(s, 'facing') : 0;
        this.drawRider(r, prog, [rr.x + 0.5, rr.base + 0.38 - 0.75, rr.z + 0.5], cam, -f * QT, ents.lightAt(rr.x, rr.base + 1, rr.z), 0);
      }
      if (g.trams) g.trams.draw(r, E, cam, prog);
      // turret heads
      if (this.turrets.size) {
        const tm = VR.getVoxModel(gl, 'turret_head');
        for (const t of this.turrets.values()) {
          const dx = t.x + 0.5 - cam.x, dy = t.y - cam.y, dz = t.z + 0.5 - cam.z;
          if (dx * dx + dz * dz > 90 * 90) continue;
          if (!mat4.boxInFrustum(r.planes, dx - 1, dy, dz - 1, dx + 1, dy + 2, dz + 1)) continue;
          const light = ents.lightAt(t.x, t.y + 1, t.z);
          ents.drawModel(r, prog, tm, [t.x + 0.5, t.y + 9 / 16, t.z + 0.5], cam, t.yaw, { barrel: [t.pitch, 0, 0] }, light, {});
        }
      }
    }
    drawRider(r, prog, pos, cam, yaw, light, roll) {
      if (!prog) return;
      const ents = this.g.ents || this.g.entities, gl = r.gl, p = this.g.player;
      const model = VR.getVoxModel(gl, 'player');
      const pose = { leg_l: [1.45, 0, 0.08], leg_r: [1.45, 0, -0.08], arm_l: [1.1, 0, 0], arm_r: [1.1, 0, 0], head: [p.pitch * 0.6, M.clamp(wrapA(p.yaw - yaw), -1, 1), 0] };
      ents.drawModel(r, prog, model, pos, cam, yaw, pose, light, { roll: roll || 0 });
    }
    drawShip(r, E, layer) {
      const S = this.ship;
      if (!S || !S.gpu || !(S.state === 'flying' || S.state === 'landing')) return;
      const cam = r.cam, m = S.modelMat;
      m.set(IDENT);
      mat4.translate(m, m, S.pos[0] - cam.x, S.pos[1] - cam.y, S.pos[2] - cam.z);
      mat4.mul(m, m, S.rotM);
      mat4.translate(m, m, -S.pivot[0], -S.pivot[1], -S.pivot[2]);
      // piloting in first person: the cockpit overlay replaces the hull right around your head
      S.clipNear = this.riding && this.riding.type === 'ship' && this.g.camMode === 0 ? 2.2 : 0;
      r.drawShip(S, E, layer);
    }

    // ================================================================ chat commands
    command(cmd, a) {
      const g = this.g, p = g.player, say = (t, c) => this.say(t, c || '#cfe6ff');
      const blockArg = (n) => { if (!n || n === 'air') return null; const t = R.byName[n]; if (!t) { say(T('g.cmd.noBlock', { n }), '#ff8a8a'); return undefined; } return t; };
      const needCreative = () => { if (!p.creative) { say(T('g.cmd.needCreative'), '#ff8a8a'); return false; } return true; };
      switch (cmd) {
        case 'shuttle': if (needCreative()) this.summonShuttle(p); return true;
        case 'ship': {
          if (!needCreative()) return true;
          if (!a[0]) { g.ui.openShipyard(); return true; }
          const arch = VR.Starship && VR.Starship.ARCH[a[0]] ? a[0] : null;
          if (!arch) { say(T('g.cmd.shipTypes', { list: VR.Starship ? VR.Starship.archetypes.join(', ') : '—' }), '#ff8a8a'); return true; }
          const seed = a[1] ? (parseInt(a[1], 10) >>> 0) : (Math.random() * 4294967295) >>> 0;
          if (g.starships) g.starships.placeInFront(seed, arch, null, p); return true;
        }
        case 'blockship': {
          if (!needCreative()) return true;
          const arch = VR.ShipGen && VR.ShipGen.ARCH[a[0]] ? a[0] : null;
          const seed = a[1] ? (parseInt(a[1], 10) >>> 0) : (Math.random() * 4294967295) >>> 0;
          this.summonDesign(VR.ShipGen.design(seed, arch), p); return true;
        }
        case 'traffic': if (g.traffic) { g.traffic.spawnFlight(a[0] ? { arch: a[0] } : {}); say(T('g.cmd.traffic')); } return true;
        case 'bike': this.spawnVehicle('hoverbike', p.pos[0] - Math.sin(p.yaw) * 2.5, p.pos[1] + 0.5, p.pos[2] - Math.cos(p.yaw) * 2.5, p.yaw); say(T('g.cmd.bike')); return true;
        case 'meteor': { const d = p.lookDir(); if (!this.spawnMeteor(p.pos[0] + d[0] * 40, p.pos[2] + d[2] * 40)) say(T('g.cmd.meteorNo'), '#ff8a8a'); return true; }
        case 'raid': if (p.mode !== 'survival') say(T('g.cmd.raidNo'), '#ff8a8a'); else this.startRaid(); return true;
        case 'wp': case 'waypoint': { const name = a.join(' ').trim(); this.addWaypoint(Math.floor(p.pos[0]), Math.floor(p.pos[1]), Math.floor(p.pos[2]), name || undefined); return true; }
        case 'wpclear': this.waypoints.length = 0; say(T('g.cmd.wpclear')); return true;
        case 'pos1': case 'pos2': { const t = p.target; const v = t ? [t.x, t.y, t.z] : [Math.floor(p.pos[0]), Math.floor(p.pos[1]) - 1, Math.floor(p.pos[2])]; this.wand[cmd === 'pos1' ? 'a' : 'b'] = v; say(`${cmd} = ${v.join(' ')}`); return true; }
        case 'fill': case 'set': case 'walls': case 'hollow': { if (!needCreative()) return true; const t = blockArg(a[0]); if (t === undefined) return true; this.wandFill(t ? (cmd === 'set' ? 'fill' : cmd) : 'clear', t); return true; }
        case 'clear': if (needCreative()) this.wandFill('clear'); return true;
        case 'replace': {
          if (!needCreative()) return true;
          const from = blockArg(a[0]), to = blockArg(a[1]); if (from === undefined || to === undefined || !from) return true;
          const B = this.wandBox(); if (!B) { say(T('g.cmd.wandFirst'), '#ff8a8a'); return true; }
          const w = g.world, list = [], undo = [];
          for (let y = B[1]; y <= B[4]; y++) for (let z = B[2]; z <= B[5]; z++) for (let x = B[0]; x <= B[3]; x++) { const s = w.getBlock(x, y, z); if (s && R.T.type[s] === from.id) { list.push([x, y, z, to ? to.defaultState : 0]); undo.push([x, y, z, s]); } }
          if (list.length) this.applyEdit(list, undo); say(T('g.cmd.replaced', { n: list.length })); return true;
        }
        case 'copy': this.wandCopy(); return true;
        case 'paste': this.wandPaste(); return true;
        case 'rotate': this.wandRotate(); return true;
        case 'undo': this.undo(); return true;
        case 'sphere': case 'hsphere': case 'cyl': case 'hcyl': {
          if (!needCreative()) return true;
          const t = blockArg(a[0]); if (t === undefined) return true;
          const r0 = parseInt(a[1] || '4', 10) || 4, h = parseInt(a[2] || '1', 10) || 1;
          const n = this.shape(cmd.indexOf('sphere') >= 0 ? 'sphere' : 'cyl', t, r0, h, cmd[0] === 'h');
          say(T('g.cmd.built', { n })); return true;
        }
        case 'land': if (this.ship) this.landShip(false); return true;
        case 'haus': case 'house': case 'blueprint': return this.blue ? this.blue.command(a) : false;
        case 'bau': case 'forge': return this.blue ? this.blue.forgeCommand(a) : false;
      }
      return false;
    }
  }
  VR.Gadgets = Gadgets;
})(VR);
