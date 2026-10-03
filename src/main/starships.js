// ============================================================================
// Starships (mini-voxel vehicles): designs are built & meshed in workers,
// parked ships are solid (you can walk on their wings), right-click boards,
// the flight model (flight.js) flies them — the mouse looks, the keys fly, V
// sets the ship down on its gear right where it is. Outposts park one on
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
    onUse(p) { this.mgr.board(this, p); }
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
        d.gpu = { hull: m.hull.count ? VR.VoxGPU.upload(gl, m.hull) : null, glass: m.glass.count ? VR.VoxGPU.upload(gl, m.glass) : null, gear: m.gear.count ? VR.VoxGPU.upload(gl, m.gear) : null };
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
        const cx = x + 0.5 - s.pos[0], cy = y + 0.5 - s.pos[1], cz = z + 0.5 - s.pos[2];
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
      };
    }
    board(s, p) {
      const g = this.g, gad = g.gadgets;
      if (!s.d.meta || !s.d.cells || this.pilot || (gad && gad.riding) || !VR.Flight) return;
      this.pilot = s; s.state = 'flying';
      if (gad) gad.riding = { type: 'starship', ship: s };
      p.flying = false; p.target = null; p.breaking = null;
      // the flight (and the view you chose) stays with the ship
      if (!s.flight) s.flight = new VR.Flight(g, this.body(s));
      s.flight.enter();
      g.audio.play('door');
      g.ui.hint(`${s.d.meta.name} · W/S throttle · A/D turn · Space/Shift climb · mouse looks (hold right button to steer) · B boost · C view · G autopilot · V land`, 5000);
      g.codex && g.codex.event && g.codex.event('ship');
      this.refreshNear(true);
    }
    drive(dt, input, blocked) {
      const g = this.g, p = g.player, s = this.pilot, m = s.d.meta, fl = s.flight;
      if (fl.update(dt, input, blocked) === 'exit') { this.exit(); return; }
      // lasers (they fly where you look)
      this.fireCool -= dt;
      const fire = input.dragLook ? input.clickAction(0) : input.mouse.down[0];
      if (!blocked && !g.ui.typing && fire && this.fireCool <= 0 && g.entities && this.armed(fl)) {
        this.fireCool = 0.15;
        const guns = m.guns.length ? m.guns : [[-1, m.eye[1] - 0.6, m.bounds[2] - 0.5], [1, m.eye[1] - 0.6, m.bounds[2] - 0.5]];
        const look = p.lookDir();
        for (const gp of guns) g.entities.fireBolt(fl.toWorld(gp), look, 120, 10, p, [0.4, 1, 1]);
      }
      if (s.pos[1] > 230) g.codex && g.codex.event && g.codex.event('orbit');
      const eye = fl.eyeWorld();
      p.pos = [eye[0], eye[1] - p.eye, eye[2]]; p.vel = s.vel.slice(); p.fallStart = null;
    }
    armed(fl) { return !fl.weapons || fl.weapons.armed !== false; }
    // get out (V once landed; quitting or saving parks the ship wherever it is)
    exit() {
      const g = this.g, s = this.pilot, p = g.player;
      if (!s) return;
      if (s.flight) s.flight.leave();
      s.vel[0] = 0; s.vel[1] = 0; s.vel[2] = 0; s.state = 'parked'; s.gear = 1; s.dip = 0;
      this.pilot = null;
      if (g.gadgets) g.gadgets.riding = null;
      g.audio.play('door');
      // step out on the port side
      const m = s.d.meta, side = s.toWorld([m.bounds[0] - 1.2, 0.2, (m.bounds[2] + m.bounds[5]) * 0.5]);
      const spot = g.gadgets ? g.gadgets.freeSpot([[side[0], Math.floor(side[1]), side[2]], [side[0], Math.floor(side[1]) + 1, side[2]], [s.pos[0], s.pos[1] + m.height + 0.2, s.pos[2]]]) : side;
      p.teleport(spot[0], spot[1], spot[2]);
      g.ui.vehicleHud(null);
      this.refreshNear(true);
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
      // keep parked ships' gear down & designs fresh
      for (const s of this.ships) { if (s.state === 'parked') s.gear = 1; s.d.last = performance.now(); }
      void p;
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
      mat4.translate(m, m, s.pos[0] - cam.x, s.pos[1] + (s.dip || 0) - cam.y, s.pos[2] - cam.z);
      mat4.rotY(m, m, s.yaw);
      if (s.pitch) mat4.rotX(m, m, s.pitch);
      if (s.roll) mat4.rotZ(m, m, s.roll);
      if (stretch && stretch !== 1) { const k = 1 / Math.sqrt(stretch); mat4.scale(m, m, k, k, stretch); }
      mat4.scale(m, m, 1 / res, 1 / res, 1 / res);
      mat4.translate(m, m, md.origin[0] * res, md.origin[1] * res, md.origin[2] * res);
      return m;
    }
    drawOne(r, prog, s, cam, layer, light, stretch, hideGlass) {
      const gl = r.gl, d = s.d; if (!d.gpu) return;
      const M2 = this.modelMat(s, cam, stretch);
      gl.uniformMatrix4fv(prog.u.u_model, false, M2);
      gl.uniform1f(prog.u.u_sky, light.sky); gl.uniform3f(prog.u.u_blockLight, light.bl[0], light.bl[1], light.bl[2]);
      if (layer === 'opaque') {
        if (d.gpu.hull) { gl.bindVertexArray(d.gpu.hull.vao); gl.drawArrays(gl.TRIANGLES, 0, d.gpu.hull.count); }
        if (d.gpu.gear && s.gear > 0.5) { gl.bindVertexArray(d.gpu.gear.vao); gl.drawArrays(gl.TRIANGLES, 0, d.gpu.gear.count); }
      } else if (d.gpu.glass && !hideGlass) { gl.bindVertexArray(d.gpu.glass.vao); gl.drawArrays(gl.TRIANGLES, 0, d.gpu.glass.count); }
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
      const cam = r.cam;
      let prog = null;
      for (const s of list) {
        if (!s.d.gpu || s.hidden) continue;
        const m = s.d.meta, rad = Math.max(m.length, m.width, m.height) * 0.6;
        const dx = s.pos[0] - cam.x, dy = s.pos[1] + m.height * 0.5 - cam.y, dz = s.pos[2] - cam.z;
        if (dx * dx + dz * dz > 420 * 420) continue;
        if (!mat4.boxInFrustum(r.planes, dx - rad, dy - rad, dz - rad, dx + rad, dy + rad, dz + rad)) continue;
        if (layer !== 'opaque' && !s.d.gpu.glass) continue;
        if (!prog) prog = this.begin(r, E, layer);
        const hide = s === this.pilot && g.camMode === 0;
        if (prog.u.u_clipNear) r.gl.uniform1f(prog.u.u_clipNear, hide ? 2.6 : 0);
        this.drawOne(r, prog, s, cam, layer, this.lightAt(s.pos[0], s.pos[1] + m.height + 1, s.pos[2]), 1, hide);
        if (hide && prog.u.u_clipNear) r.gl.uniform1f(prog.u.u_clipNear, 0);
      }
      if (prog) this.end(r, layer);
    }
    // ---------------------------------------------------------------- persistence
    beforeSave(meta) {
      meta.starships = this.ships.filter(s => s.d.meta).map(s => ({ seed: s.d.seed, arch: s.d.meta.arch, palette: s.d.palette || null, pos: s.pos.map(v => Math.round(v * 100) / 100), yaw: s.yaw, key: s.key }));
      meta.starshipSpawns = [...this.spawned];
    }
    shutdown() { if (this.pilot) this.exit(); }
    destroy() { for (const d of this.designs.values()) this.free(d); this.designs.clear(); this.ships = []; this.near = []; }
  }
  VR.Starships = Starships;
})(VR);
