// ============================================================================
// Starships (mini-voxel vehicles): designs are built & meshed in workers,
// parked ships are solid (you can walk on their wings), right-click boards,
// the flight model (flight.js) flies them — the mouse looks, the keys fly, V
// sets the ship down on its gear right where it is. Shuttles can be walked
// (cabin.js): up the rear ramp or the side stair, out of the pilot seat; the
// ramp, the side door with its stair and the cockpit door move here, and a
// parked shuttle kneels on its gear while its ramp is down. Outposts park one on
// their pad; the shipyard conjures any design. Also renders ships for the sky
// traffic.
// ============================================================================
(function (VR) {
  'use strict';
  const mat4 = VR.mat4, M = VR.M, PH = VR.PHYS, R = VR.R, F = VR.F;
  const TAU = Math.PI * 2, QT = Math.PI / 2;
  const IDENT = mat4.create();
  const wrapA = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
  let NEXT = 1;

  class Ship {
    constructor(mgr, d, pos, yaw, key) {
      this.mgr = mgr; this.d = d; this.id = NEXT++;
      this.pos = pos.slice(); this.yaw = yaw || 0; this.pitch = 0; this.roll = 0;
      this.vel = [0, 0, 0]; this.state = 'parked'; this.gear = 1; this.key = key || null; this.turnVel = 0;
      this.kind = 'starship';
    }
    get meta() { return this.d.meta; }
    // world AABB (rotated footprint)
    hitbox() {
      const m = this.d.meta; if (!m) return [this.pos[0] - 1, this.pos[1], this.pos[2] - 1, this.pos[0] + 1, this.pos[1] + 2, this.pos[2] + 1];
      const b = m.bounds, c = Math.cos(this.yaw), s = Math.sin(this.yaw);
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (const lx of [b[0], b[3]]) for (const lz of [b[2], b[5]]) { const wx = lx * c + lz * s, wz = -lx * s + lz * c; x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); z0 = Math.min(z0, wz); z1 = Math.max(z1, wz); }
      return [this.pos[0] + x0, this.pos[1] + 0.3, this.pos[2] + z0, this.pos[0] + x1, this.pos[1] + b[4], this.pos[2] + z1];
    }
    onUse(p) { this.mgr.use(this, p); }
    // ship-local metres → world
    toWorld(l) {
      const m = this.rot || this.mgr.rotOf(this);
      return [this.pos[0] + m[0] * l[0] + m[4] * l[1] + m[8] * l[2], this.pos[1] + m[1] * l[0] + m[5] * l[1] + m[9] * l[2], this.pos[2] + m[2] * l[0] + m[6] * l[1] + m[10] * l[2]];
    }
    dirWorld(l) { const m = this.rot || this.mgr.rotOf(this); return [m[0] * l[0] + m[4] * l[1] + m[8] * l[2], m[1] * l[0] + m[5] * l[1] + m[9] * l[2], m[2] * l[0] + m[6] * l[1] + m[10] * l[2]]; }
  }

  class Starships {
    constructor(g, opts) {
      opts = opts || {};
      this.g = g; this.title = !!opts.title;
      this.designs = new Map();
      this.ships = [];
      this.pilot = null;
      this.barrier = R.byName.barrier ? R.byName.barrier.defaultState : 1;
      this.m = mat4.create(); this.tmp = mat4.create();
      this.near = []; this.nearT = 0; this.fireCool = 0;
      const meta = this.title ? {} : (g.meta || {});
      this.meta = meta;
      this.spawned = new Set(meta.starshipSpawns || []);
      for (const s of meta.starships || []) this.spawn(s.seed, s.arch, s.palette, s.pos, s.yaw, s.key);
      this.plainGet = (x, y, z) => g.world.getBlock(x, y, z);
      this.proxyGet = (x, y, z) => this.getBlock(x, y, z);
      this.cabin = VR.Cabin ? new VR.Cabin(g, this) : null;
      this.mH = mat4.create();
    }
    // ---------------------------------------------------------------- designs (worker built, shared)
    design(seed, arch, palette, cb) {
      const key = (seed >>> 0) + ':' + (arch || '*') + ':' + (palette || '');
      let d = this.designs.get(key);
      if (d) { if (d.meta) { if (cb) cb(d); } else if (cb) d.waiters.push(cb); return d; }
      d = { key, seed: seed >>> 0, arch, palette, meta: null, gpu: null, occ: null, cells: null, waiters: cb ? [cb] : [], last: 0 };
      this.designs.set(key, d);
      const pool = this.g.pool;
      let wi = 0; pool.workers.forEach((wk, i) => { if (wk.inflight < pool.workers[wi].inflight) wi = i; });
      pool.direct(wi, { type: 'starship', seed: d.seed, arch: arch || null, palette: palette || null, allow: arch ? null : ['shuttle', 'interceptor', 'gunship', 'dropship', 'racer'] }, null, (m) => {
        if (m.type !== 'starship') { console.warn('starship build failed', m.msg); return; }
        if (!this.designs.has(key)) return;
        const gl = this.g.renderer.gl;
        d.meta = m.meta; d.occ = m.occ;
        const up = (mm) => (mm && mm.count ? VR.VoxGPU.upload(gl, mm) : null);
        d.gpu = { hull: up(m.hull), glass: up(m.glass), gear: up(m.gear), interior: up(m.interior) };
        if (m.extra) { d.gpu.ramp = up(m.extra.ramp); d.gpu.door = up(m.extra.door); d.gpu.stair = up(m.extra.stair); d.gpu.cabin = up(m.extra.cabin); }
        d.walk = m.walk || null;
        this.buildCells(d);
        const w = d.waiters; d.waiters = [];
        for (const f of w) f(d);
      });
      return d;
    }
    buildCells(d) {
      const o = d.occ, m = d.meta, org = m.origin, R0 = m.res;
      const all = [], surf = [], bot = [];
      const at = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < o.bx && j < o.by && k < o.bz && o.occ[(j * o.bz + k) * o.bx + i];
      let lo = null, hi = null;
      for (let j = 0; j < o.by; j++) for (let k = 0; k < o.bz; k++) for (let i = 0; i < o.bx; i++) {
        if (!at(i, j, k)) continue;
        const lx = org[0] + i + 0.5, ly = org[1] + j + 0.5, lz = org[2] + k + 0.5;
        all.push(lx, ly, lz);
        if (!at(i + 1, j, k) || !at(i - 1, j, k) || !at(i, j + 1, k) || !at(i, j - 1, k) || !at(i, j, k + 1) || !at(i, j, k - 1)) surf.push(lx, ly, lz);
        if (!at(i, j - 1, k)) bot.push(lx, ly, lz);
        if (!lo || lx < lo[0]) lo = [lx, ly, lz]; if (!hi || lx > hi[0]) hi = [lx, ly, lz];
      }
      d.cells = new Float32Array(surf); d.allCells = new Float32Array(all); d.bottom = new Float32Array(bot);
      // flight: up to 16 belly points spread over the underside (support when the gear is up), the wingtips
      const belly = [];
      for (let n = 0; n < bot.length; n += 3) belly.push([bot[n], bot[n + 1] - 0.5, bot[n + 2]]);
      belly.sort((a, b) => a[1] - b[1]);
      const low = belly.filter(q => q[1] <= belly[0][1] + 1.01);
      const pick = [];
      if (low.length) {
        const ext = (f) => low.reduce((a, q) => (f(q) > f(a) ? q : a), low[0]);
        for (const f of [(q) => -q[0], (q) => q[0], (q) => -q[2], (q) => q[2], (q) => -q[0] - q[2], (q) => q[0] - q[2], (q) => -q[0] + q[2], (q) => q[0] + q[2]]) { const q = ext(f); if (pick.indexOf(q) < 0) pick.push(q); }
        for (let n = 0; n < low.length && pick.length < 16; n += Math.max(1, Math.floor(low.length / 8))) if (pick.indexOf(low[n]) < 0) pick.push(low[n]);
      }
      d.belly = pick;
      d.wingtips = lo && hi ? [[lo[0] - 0.3, lo[1], lo[2]], [hi[0] + 0.3, hi[1], hi[2]]] : null;
      void R0;
    }
    free(d) { const gl = this.g.renderer.gl; if (d.gpu) for (const k in d.gpu) { const p = d.gpu[k]; if (p) { gl.deleteBuffer(p.vbo); gl.deleteVertexArray(p.vao); } } d.gpu = null; }
    gc() {
      const used = new Set(this.ships.map(s => s.d.key));
      if (this.g.traffic) for (const s of this.g.traffic.ships) used.add(s.d.key);
      if (this.previewKey) used.add(this.previewKey);
      for (const [k, d] of this.designs) if (!used.has(k) && d.meta && performance.now() - d.last > 60000) { this.free(d); this.designs.delete(k); }
    }
    // ---------------------------------------------------------------- instances
    spawn(seed, arch, palette, pos, yaw, key) {
      const d = this.design(seed, arch, palette);
      const s = new Ship(this, d, pos, yaw, key);
      this.ships.push(s);
      return s;
    }
    rotOf(s) {
      const m = s.rot || (s.rot = mat4.create());
      m.set(IDENT); mat4.rotY(m, m, s.yaw); if (s.pitch) mat4.rotX(m, m, s.pitch); if (s.roll) mat4.rotZ(m, m, s.roll);
      return m;
    }
    // world block lookup with parked ships acting as solid barriers (player collisions)
    getBlock(x, y, z) {
      const w = this.g.world, b = w.getBlock(x, y, z);
      if (b && (R.T.flags[b] & F.SOLID)) return b;
      for (const s of this.near) {
        const o = s.d.occ; if (!o) continue;
        const cx = x + 0.5 - s.pos[0], cy = y + 0.5 - s.pos[1] + (s.kneel || 0), cz = z + 0.5 - s.pos[2];
        const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
        const lx = cx * c - cz * sn, lz = cx * sn + cz * c; // inverse yaw
        const org = s.d.meta.origin;
        const i = Math.floor(lx - org[0]), j = Math.floor(cy - org[1]), k = Math.floor(lz - org[2]);
        if (i < 0 || j < 0 || k < 0 || i >= o.bx || j >= o.by || k >= o.bz) continue;
        if (o.occ[(j * o.bz + k) * o.bx + i]) return this.barrier;
      }
      return b;
    }
    getFn() { return this.near.length ? this.proxyGet : this.plainGet; }
    // ---------------------------------------------------------------- spawns from world gen & shipyard
    onColumnLoaded(c) {
      if (!c.spawns) return;
      for (const s of c.spawns) if (s[0] === 'starship') {
        const key = s[2] + ',' + s[3] + ',' + s[4];
        if (this.spawned.has(key)) continue;
        this.spawned.add(key); this.meta.starshipSpawns = [...this.spawned];
        this.spawn(s[1], null, null, [s[2], s[3], s[4]], -((s[5] || 0) & 3) * QT, key);
      }
    }
    placeInFront(seed, arch, palette, p) {
      const g = this.g, w = g.world;
      const yaw = -VR.Place.playerFacing(p.yaw) * QT;
      const d = this.design(seed, arch, palette, (d2) => {
        const m = d2.meta, len = m.bounds[5] - m.bounds[2], wid = m.bounds[3] - m.bounds[0];
        const dist = Math.ceil(Math.max(len, wid) / 2) + 4;
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
        const x = Math.round(p.pos[0] + fx * dist), z = Math.round(p.pos[2] + fz * dist);
        const s = new Ship(this, d2, [x, p.pos[1] + 30, z], yaw);
        this.ships.push(s);
        const y = this.groundY(s, p.pos[1] + 30, 80);
        s.pos[1] = y !== null ? y : Math.floor(p.pos[1]);
        g.audio.play('warp');
        g.particles.explosion(x + 0.5, s.pos[1] + m.height * 0.5, z + 0.5, 0.8);
        g.ui.chatLine(`${m.name} (${m.label}) has landed. Right-click it to board.`, '#9affd8');
      });
      return d;
    }
    // highest ground under the ship's footprint at yaw (null if none within depth)
    groundY(s, fromY, depth) {
      const d = s.d, cells = d.allCells, w = this.g.world;
      if (!cells) return null;
      const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
      const cols = new Set();
      for (let n = 0; n < cells.length; n += 3) { const x = Math.floor(s.pos[0] + cells[n] * c + cells[n + 2] * sn), z = Math.floor(s.pos[2] - cells[n] * sn + cells[n + 2] * c); cols.add(x + ',' + z); }
      let best = null;
      for (const k of cols) {
        const [x, z] = k.split(',').map(Number);
        for (let y = Math.floor(fromY); y > fromY - depth && y > 0; y--) { const b = w.getBlock(x, y, z); if (b && (R.T.flags[b] & F.SOLID) && !(R.T.flags[b] & F.REPLACE)) { if (best === null || y + 1 > best) best = y + 1; break; } }
      }
      return best;
    }
    // does the hull (its surface cells, or every cell with all) touch solid blocks at this pose?
    hits(s, px, py, pz, yaw, all) {
      const w = this.g.world, T = R.T, cells = all ? s.d.allCells : s.d.cells; if (!cells) return false;
      const c = Math.cos(yaw), sn = Math.sin(yaw);
      for (let n = 0; n < cells.length; n += 3) {
        const y = Math.floor(py + cells[n + 1]); if (y < 1) return true; if (y >= VR.MAXY) continue;
        const b = w.getBlock(Math.floor(px + cells[n] * c + cells[n + 2] * sn), y, Math.floor(pz - cells[n] * sn + cells[n + 2] * c));
        if (b && (T.flags[b] & F.SOLID) && !(T.flags[b] & F.REPLACE)) return true;
      }
      // the underside rests on the ground: its cells count down to just above their bottom face
      const bot = s.d.bottom;
      if (bot) for (let n = 0; n < bot.length; n += 3) {
        const y = Math.floor(py + bot[n + 1] - 0.45); if (y < 1) return true; if (y >= VR.MAXY) continue;
        const b = w.getBlock(Math.floor(px + bot[n] * c + bot[n + 2] * sn), y, Math.floor(pz - bot[n] * sn + bot[n + 2] * c));
        if (b && (T.flags[b] & F.SOLID) && !(T.flags[b] & F.REPLACE)) return true;
      }
      return false;
    }
    // ---------------------------------------------------------------- piloting (flight.js does the flying)
    // the ship as the flight model sees it (ship-frame metres, origin on the ground under the ship's middle)
    body(s) {
      const mgr = this, d = s.d, m = d.meta, B = m.bounds;
      const agility = { racer: 1.25, interceptor: 1.2, gunship: 0.95, dropship: 0.9, freighter: 0.75, cruiser: 0.65, carrier: 0.45 }[m.arch] || 1;
      return {
        kind: 'starship', ship: s,
        get pos() { return s.pos; }, get vel() { return s.vel; },
        get heading() { return s.yaw; }, set heading(v) { s.yaw = v; },
        setAttitude(pitch, roll) { s.pitch = pitch; s.roll = roll; mgr.rotOf(s); },
        setGear(v) { s.gear = v; },
        setDip(v) { s.dip = v; },
        hits: (x, y, z, h) => mgr.hits(s, x, y, z, h),
        overlaps: (x, y, z, h) => mgr.hits(s, x, y, z, h, true),
        cruiseBase: m.speed, agility,
        eye: m.eye, seat: m.seat, center: [0, m.height * 0.5, (B[2] + B[5]) * 0.5], bottom: 0,
        radius: Math.max(m.length, m.width) * 0.5, length: m.length, width: m.width, height: m.height,
        extent: [Math.max(Math.abs(B[0]), Math.abs(B[3])), Math.max(Math.abs(B[2]), Math.abs(B[5]))],
        gearFeet: (m.gear || []).map(q => [q[0], 0, q[1]]), belly: d.belly || [], exhaust: m.exhaust, guns: m.guns, wingtips: d.wingtips,
        name: m.name, label: m.label,
        // the furnished cockpit: the room the generator carved — or, for the big bridges, a console in front of the seat
        cockpit: m.cockpit || VR.consoleRoom(m.eye), consoleOnly: !m.cockpit,
        get hatch() { return m.cabin && mgr.cabin ? mgr.cabin.hatch(s) : null; },
        palette: VR.Starship && VR.Starship.PAL.find(q => q.key === m.palette),
      };
    }
    board(s, p, resume) {
      const g = this.g, gad = g.gadgets;
      if (!s.d.meta || !s.d.cells || this.pilot || (gad && gad.riding) || !VR.Flight) return;
      const flying = s.state === 'flying' && s.flight && s.flight.state !== 'landed';
      this.pilot = s; s.state = 'flying';
      if (gad) gad.riding = { type: 'starship', ship: s };
      p.flying = false; p.target = null; p.breaking = null;
      // the flight (and the view you chose) stays with the ship
      if (!s.flight) s.flight = new VR.Flight(g, this.body(s));
      s.flight.enter(resume && flying);
      g.audio.play('door');
      g.ui.hint(`${s.d.meta.name} · W/S throttle · A/D turn · Space/Shift climb · mouse looks (hold right button to steer) · B boost · C view · G autopilot · V land`, 5000);
      g.codex && g.codex.event && g.codex.event('ship');
      this.refreshNear(true);
    }
    drive(dt, input, blocked) {
      const g = this.g, p = g.player, s = this.pilot, m = s.d.meta, fl = s.flight;
      // the cockpit's controls get the left button first (aim + click)
      const onCtl = g.cockpit && g.cockpit.interact ? g.cockpit.interact(fl, input, blocked) : false;
      if (fl.update(dt, input, blocked) === 'exit') { this.exit(); return; }
      // lasers (they fly where you look) — once the weapons are armed
      this.fireCool -= dt;
      const fire = input.dragLook ? input.clickAction(0) : input.mouse.down[0];
      if (!blocked && !g.ui.typing && !onCtl && fire && this.fireCool <= 0 && g.entities && fl.armed) {
        this.fireCool = 0.15;
        const guns = m.guns.length ? m.guns : [[-1, m.eye[1] - 0.6, m.bounds[2] - 0.5], [1, m.eye[1] - 0.6, m.bounds[2] - 0.5]];
        const look = p.lookDir();
        for (const gp of guns) g.entities.fireBolt(fl.toWorld(gp), look, 120, 10, p, [0.4, 1, 1]);
      }
      if (s.pos[1] > 230) g.codex && g.codex.event && g.codex.event('orbit');
      const eye = fl.eyeWorld();
      p.pos = [eye[0], eye[1] - p.eye, eye[2]]; p.vel = s.vel.slice(); p.fallStart = null;
    }
    // get out (V once landed; quitting or saving parks the ship wherever it is)
    exit() {
      const g = this.g, s = this.pilot, p = g.player;
      if (!s) return;
      if (this.cabin && this.cabin.w) this.cabin.end();
      if (s.flight) s.flight.leave();
      s.vel[0] = 0; s.vel[1] = 0; s.vel[2] = 0; s.state = 'parked'; s.gear = 1; s.dip = 0;
      this.pilot = null;
      if (g.gadgets) g.gadgets.riding = null;
      g.audio.play('door');
      this.stepOut(s, p);
      g.ui.vehicleHud(null);
      this.refreshNear(true);
    }
    // put the player down beside a ship (the port side), or on its roof
    stepOut(s, p) {
      const g = this.g, m = s.d.meta, side = s.toWorld([m.bounds[0] - 1.2, 0.2, (m.bounds[2] + m.bounds[5]) * 0.5]);
      const spot = g.gadgets ? g.gadgets.freeSpot([[side[0], Math.floor(side[1]), side[2]], [side[0], Math.floor(side[1]) + 1, side[2]], [s.pos[0], s.pos[1] + m.height + 0.2, s.pos[2]]]) : side;
      p.teleport(spot[0], spot[1], spot[2]);
    }
    // the walker sits down at the controls (the ship may be flying itself)
    takeSeat(s, p) { this.board(s, p, true); }
    // the pilot gets up (cabin.js): the ship parks if it stands, flies on (hover hold / autopilot) if not
    leavePilot(s) {
      const g = this.g, fl = s.flight;
      if (this.pilot !== s) return;
      if (fl && fl.state === 'landed') { fl.leave(); s.vel[0] = 0; s.vel[1] = 0; s.vel[2] = 0; s.state = 'parked'; s.gear = 1; s.dip = 0; }
      else if (fl) { if (g.flight === fl) g.flight = null; g.camMode = 0; fl.view = fl.view; }
      this.pilot = null;
      if (g.gadgets) g.gadgets.riding = null;
      if (g.ui && g.ui.vehicleHud) g.ui.vehicleHud(null);
      if (g.audio) g.audio.play('door');
      this.refreshNear(true);
    }
    // walking aboard (gadgets.drive while riding 'cabin')
    walk(dt, input, blocked) { if (this.cabin && this.cabin.w) this.cabin.update(dt, input, blocked); else if (this.g.gadgets) this.g.gadgets.riding = null; }
    // on foot in the world: stepping onto a lowered ramp or the stair takes you aboard
    tryWalkIn(p) {
      if (!this.cabin || !p || this.cabin.w) return false;
      // (parked, or hovering on its own with nobody at the controls)
      for (const s of this.ships) if (s !== this.pilot && s.hatch && (s.hatch.ramp > 0.95 || s.hatch.door > 0.95) && Math.abs(s.pos[0] - p.pos[0]) < 30 && Math.abs(s.pos[2] - p.pos[2]) < 30 && this.cabin.tryBoard(s, p)) return true;
      return false;
    }
    // right-click a parked shuttle: at the tail the ramp goes up / down, at the side door that opens / shuts, anywhere else
    // you take the pilot seat
    use(s, p) {
      const C = VR.Cabin && VR.Cabin.of(s);
      if (C && this.cabin) {
        const e = p.eyePos(), d = p.lookDir(), l = this.cabin.toLocal(s, e), ld = this.cabin.dirLocal(s, d), B = s.d.meta.bounds;
        // where the look ray enters the ship's box (ship frame)
        let t0 = 0, t1 = 8;
        for (let a = 0; a < 3; a++) { const lo = [B[0], 0, B[2]][a], hi = [B[3], B[4], B[5]][a]; if (Math.abs(ld[a]) < 1e-6) { if (l[a] < lo || l[a] > hi) { t0 = 9; break; } continue; } let ta = (lo - l[a]) / ld[a], tb = (hi - l[a]) / ld[a]; if (ta > tb) { const q = ta; ta = tb; tb = q; } t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); }
        if (t0 <= t1) {
          const h = [l[0] + ld[0] * t0, l[1] + ld[1] * t0, l[2] + ld[2] * t0];
          if (h[2] > C.zT - 1.2 && Math.abs(h[0]) < C.ramp.w + 0.8) { this.cabin.toggleRamp(s); return; }
          if (h[0] * C.door.side > 0.8 && Math.abs(h[2] - C.door.z) < C.door.w) { this.cabin.toggleDoor(s); return; }
        }
      }
      this.board(s, p);
    }
    // V: landed → get out, flying → the assisted landing
    land() {
      const fl = this.pilot && this.pilot.flight; if (!fl) return false;
      if (fl.state === 'landed') { this.exit(); return true; }
      fl.assistLand(true); return false;
    }
    // the autopilot lives in the flight model (the villagers' shuttle ride starts it from here)
    get auto() { const fl = this.pilot && this.pilot.flight; return fl ? fl.auto : null; }
    toggleAuto() { const fl = this.pilot && this.pilot.flight; if (fl) fl.toggleAuto(); }
    startAuto(site) { const fl = this.pilot && this.pilot.flight; if (fl) fl.startAuto(site); }
    stopAuto(msg) { const fl = this.pilot && this.pilot.flight; if (fl) fl.stopAuto(msg); }
    // ---------------------------------------------------------------- per frame
    update(dt) {
      const g = this.g, p = g.player;
      this.nearT -= dt;
      if (this.nearT <= 0) { this.nearT = 0.4; this.refreshNear(); }
      if ((this.gcT = (this.gcT || 0) - dt) <= 0) { this.gcT = 20; this.gc(); }
      // keep parked ships' gear down & designs fresh; ramps, doors and the kneel move
      for (const s of this.ships) { if (s.state === 'parked') s.gear = 1; s.d.last = performance.now(); if (this.cabin && s.d.meta && s.d.meta.cabin) this.cabin.animate(s, dt); }
      // on foot in the world: up a lowered ramp or a stair → aboard
      if (p && this.cabin && !(g.gadgets && g.gadgets.riding) && !p.dead) this.tryWalkIn(p);
      // on foot inside a parked ship's hull (a world saved while walking aboard, a teleport): out beside it
      if (p && this.near.length && !(g.gadgets && g.gadgets.riding) && (this.stuckT = (this.stuckT || 0) - dt) <= 0) {
        this.stuckT = 0.5;
        const x = Math.floor(p.pos[0]), z = Math.floor(p.pos[2]);
        for (const y of [Math.floor(p.pos[1] + 0.3), Math.floor(p.pos[1] + 1.4)]) { if (this.getBlock(x, y, z) !== this.barrier) continue; const s = this.near.find(q => this.inOcc(q, x, y, z)); if (s) { this.stepOut(s, p); break; } }
      }
    }
    inOcc(s, x, y, z) {
      const o = s.d.occ; if (!o) return false;
      const cx = x + 0.5 - s.pos[0], cy = y + 0.5 - s.pos[1] + (s.kneel || 0), cz = z + 0.5 - s.pos[2], c = Math.cos(s.yaw), sn = Math.sin(s.yaw), org = s.d.meta.origin;
      const i = Math.floor(cx * c - cz * sn - org[0]), j = Math.floor(cy - org[1]), k = Math.floor(cx * sn + cz * c - org[2]);
      return i >= 0 && j >= 0 && k >= 0 && i < o.bx && j < o.by && k < o.bz && !!o.occ[(j * o.bz + k) * o.bx + i];
    }
    refreshNear(force) {
      const p = this.g.player; if (!p) { this.near = []; return; }
      this.near = this.ships.filter(s => s.state === 'parked' && s.d.occ && Math.abs(s.pos[0] - p.pos[0]) < 60 && Math.abs(s.pos[2] - p.pos[2]) < 60);
      void force;
    }
    hudText() {
      const s = this.pilot; if (!s || !s.d.meta || !s.flight) return null;
      const fl = s.flight, I = fl.info(), A = I.auto;
      const ap = A ? `<br><b style="color:#9affd8">AUTOPILOT → ${A.site.name.toUpperCase()} · ${(A.dist / 1000).toFixed(2)} km</b>` : '';
      const st = I.state === 'landed' ? ' · <b>LANDED</b>' : I.state === 'landing' ? ' · <b>LANDING</b>' : '';
      return `<b>${Math.round(I.speed)} m/s</b> · ALT ${Math.round(I.alt)} · HDG ${Math.round(I.heading)}° · THR ${Math.round(I.throttle * 100)}%${I.boost ? ' · <b style="color:#7ad8ff">BOOST</b>' : ''} · ${s.d.meta.name}${st}${ap}<br><small>W/S throttle · A/D turn · Space/Shift climb · B boost · X hover · right mouse steers · C view · F gear · <b>G autopilot</b> · <b>V land</b></small>`;
    }
    camera(cam) { return this.pilot.flight.camera(cam); }
    // ---------------------------------------------------------------- rendering (vox program)
    modelMat(s, cam, stretch) {
      const m = this.m, md = s.d.meta, res = md.res;
      m.set(IDENT);
      mat4.translate(m, m, s.pos[0] - cam.x, s.pos[1] + (s.dip || 0) - (s.kneel || 0) - cam.y, s.pos[2] - cam.z);
      mat4.rotY(m, m, s.yaw);
      if (s.pitch) mat4.rotX(m, m, s.pitch);
      if (s.roll) mat4.rotZ(m, m, s.roll);
      if (stretch && stretch !== 1) { const k = 1 / Math.sqrt(stretch); mat4.scale(m, m, k, k, stretch); }
      mat4.scale(m, m, 1 / res, 1 / res, 1 / res);
      mat4.translate(m, m, md.origin[0] * res, md.origin[1] * res, md.origin[2] * res);
      return m;
    }
    // room: you sit inside it — the furnished cockpit replaces the stand-in furniture and the glass is nearly clear;
    // aboard: the furnished cabin replaces the cabin's coarse furniture
    drawOne(r, prog, s, cam, layer, light, stretch, hideGlass, room, aboard) {
      const gl = r.gl, d = s.d; if (!d.gpu) return;
      const md = d.meta, M2 = this.modelMat(s, cam, stretch);
      gl.uniformMatrix4fv(prog.u.u_model, false, M2);
      gl.uniform1f(prog.u.u_sky, light.sky); gl.uniform3f(prog.u.u_blockLight, light.bl[0], light.bl[1], light.bl[2]);
      const mesh = (mm, M) => { if (!mm) return; if (M) gl.uniformMatrix4fv(prog.u.u_model, false, M); gl.bindVertexArray(mm.vao); gl.drawArrays(gl.TRIANGLES, 0, mm.count); if (M) gl.uniformMatrix4fv(prog.u.u_model, false, M2); };
      if (layer === 'opaque') {
        mesh(d.gpu.hull);
        // kneeling, the gear's feet stay on the ground (the struts slide up into the hull)
        if (d.gpu.gear && s.gear > 0.5) { if (s.kneel) { const G2 = this.mH; G2.set(M2); mat4.translate(G2, G2, 0, s.kneel * md.res, 0); mesh(d.gpu.gear, G2); } else mesh(d.gpu.gear); }
        if (d.gpu.interior && !room) mesh(d.gpu.interior);
        if (md.cabin) {
          const H = s.hatch || null, C = md.cabin, R = md.res, O = md.origin, T = this.mH;
          const hv = (q) => [(q[0] - O[0]) * R, (q[1] - O[1]) * R, (q[2] - O[2]) * R];
          // the ramp swings about its hinge
          if (d.gpu.ramp) { const a = (H ? H.ramp : 0) * C.ramp.open, h = hv(C.ramp.hinge); T.set(M2); mat4.translate(T, T, h[0], h[1], h[2]); if (a) mat4.rotX(T, T, a); mat4.translate(T, T, -h[0], -h[1], -h[2]); mesh(d.gpu.ramp, T); }
          // the side door steps out of its frame, then slides aft along the hull
          if (d.gpu.door) { const u = H ? H.door : 0, out = Math.min(1, u / 0.3) * 0.3, aft = Math.max(0, (u - 0.3) / 0.7) * 1.15; T.set(M2); mat4.translate(T, T, C.door.side * out * R, 0, aft * R); mesh(d.gpu.door, T); }
          // the stair unfolds down from the sill once the door is out of the way
          if (d.gpu.stair && H && H.door > 0.55) { const k = Math.min(1, (H.door - 0.55) / 0.45), y = (C.floor - O[1]) * R; T.set(M2); mat4.translate(T, T, 0, y, 0); mat4.scale(T, T, 1, Math.max(0.02, k * k * (3 - 2 * k)), 1); mat4.translate(T, T, 0, -y, 0); mesh(d.gpu.stair, T); }
          if (!aboard) mesh(d.gpu.cabin);
        }
      } else if (d.gpu.glass && !hideGlass) {
        if (room) gl.uniform1f(prog.u.u_alpha, 0.13);
        gl.bindVertexArray(d.gpu.glass.vao); gl.drawArrays(gl.TRIANGLES, 0, d.gpu.glass.count);
        if (room) gl.uniform1f(prog.u.u_alpha, 0.42);
      }
    }
    begin(r, E, layer) {
      const g = this.g, gl = r.gl, p = r.P.vox;
      gl.useProgram(p.p); r.common(p, E);
      gl.uniformMatrix4fv(p.u.u_viewProj, false, r.viewProj);
      gl.uniform1f(p.u.u_flash, 0); gl.uniform3f(p.u.u_tint, 1, 1, 1); gl.uniform1f(p.u.u_noFog, 0);
      gl.enable(gl.DEPTH_TEST);
      if (layer === 'opaque') { gl.uniform1f(p.u.u_alpha, 1); gl.enable(gl.CULL_FACE); }
      else { gl.uniform1f(p.u.u_alpha, 0.42); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.disable(gl.CULL_FACE); }
      void g;
      return p;
    }
    end(r, layer) { const gl = r.gl; if (layer !== 'opaque') { gl.disable(gl.BLEND); gl.depthMask(true); gl.enable(gl.CULL_FACE); } }
    lightAt(x, y, z) {
      const w = this.g.world; if (!w) return { sky: 1, bl: [0, 0, 0] };
      const l = w.getLight(Math.floor(x), Math.floor(y), Math.floor(z));
      return { sky: Math.max(0.35, (l >>> 12) / 15), bl: [((l >> 8) & 15) / 15, ((l >> 4) & 15) / 15, (l & 15) / 15] };
    }
    draw(r, E, layer) {
      const g = this.g;
      const extra = g.mp && g.mp.remoteShips ? g.mp.remoteShips() : null;
      const list = extra && extra.length ? this.ships.concat(extra) : this.ships;
      if (!list.length) return;
      const cam = r.cam, walker = this.cabin && this.cabin.w ? this.cabin.w.s : null;
      let prog = null, pilotRoom = null, cabinShip = null;
      for (const s of list) {
        if (!s.d.gpu || s.hidden) continue;
        const m = s.d.meta, rad = Math.max(m.length, m.width, m.height) * 0.6;
        const dx = s.pos[0] - cam.x, dy = s.pos[1] + m.height * 0.5 - cam.y, dz = s.pos[2] - cam.z;
        if (dx * dx + dz * dz > 420 * 420) continue;
        if (!mat4.boxInFrustum(r.planes, dx - rad, dy - rad, dz - rad, dx + rad, dy + rad, dz + rad)) continue;
        if (layer !== 'opaque' && !s.d.gpu.glass) continue;
        if (!prog) prog = this.begin(r, E, layer);
        // flying it from the cockpit: you sit in its furnished room (no hull clipping any more); until the worker has
        // furnished it, the generator's stand-in seats and dash stay. Walking aboard, the cockpit and the cabin are
        // furnished too (and the cabin whenever you are close to a shuttle with a hatch open)
        const inside = s === this.pilot && g.camMode === 0 && s.flight && s.flight.view === 0, walking = s === walker;
        const room = (inside || walking) && !!m.cockpit && !!(g.cockpit && g.cockpit.ready(s.flight || this.flightOf(s)));
        const near = s.hatch && (s.hatch.ramp > 0.02 || s.hatch.door > 0.02) && dx * dx + dz * dz < 45 * 45;
        // (from the pilot seat you only see the cabin through the open cockpit door)
        const aboard = !!(m.cabin && g.cockpit && (walking || near || (inside && s.hatch && s.hatch.cdoor > 0.02)) && g.cockpit.cabinReady(s));
        if (prog.u.u_clipNear) r.gl.uniform1f(prog.u.u_clipNear, 0);
        this.drawOne(r, prog, s, cam, layer, this.lightAt(s.pos[0], s.pos[1] + m.height + 1, s.pos[2]), 1, false, room, aboard);
        if (layer === 'opaque') { if (inside) pilotRoom = s; if (aboard && (!cabinShip || walking)) cabinShip = s; }
      }
      if (prog) this.end(r, layer);
      if (layer !== 'opaque' || !g.cockpit) return;
      if (pilotRoom && g.cockpit.drawRoom) g.cockpit.drawRoom(r, E, pilotRoom.flight);
      if (walker && walker.d.meta.cockpit && g.cockpit.drawRoomOf) g.cockpit.drawRoomOf(r, E, this.flightOf(walker));
      if (cabinShip && g.cockpit.drawCabin) g.cockpit.drawCabin(r, E, cabinShip);
    }
    // a ship's flight model (made the first time someone steps aboard: its switches, hatches and panels live there)
    flightOf(s) { if (!s.flight && VR.Flight && s.d.meta) s.flight = new VR.Flight(this.g, this.body(s)); return s.flight; }
    // ---------------------------------------------------------------- persistence
    beforeSave(meta) {
      meta.starships = this.ships.filter(s => s.d.meta).map(s => ({ seed: s.d.seed, arch: s.d.meta.arch, palette: s.d.palette || null, pos: s.pos.map(v => Math.round(v * 100) / 100), yaw: s.yaw, key: s.key }));
      meta.starshipSpawns = [...this.spawned];
    }
    // (saving & leaving: out of the seat, or off the ship you walk in, so the world reloads with you beside it)
    shutdown() { if (this.pilot) this.exit(); else if (this.cabin && this.cabin.w) { const s = this.cabin.w.s; this.cabin.end(); this.stepOut(s, this.g.player); } }
    destroy() { for (const d of this.designs.values()) this.free(d); this.designs.clear(); this.ships = []; this.near = []; }
  }
  VR.Starships = Starships;
})(VR);
