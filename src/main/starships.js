// ============================================================================
// Starships (mini-voxel vehicles): designs are built & meshed in workers,
// parked ships are solid (you can walk on their wings), right-click boards,
// mouse steers, gear retracts in flight, V lands them snapped to the block
// grid. Outposts park one on their pad; the shipyard conjures any design.
// Also renders ships for the sky traffic.
// ============================================================================
(function (VR) {
  'use strict';
  // the player's language (lang_de.js / lang_en.js)
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
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
      const all = [], surf = [];
      const at = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < o.bx && j < o.by && k < o.bz && o.occ[(j * o.bz + k) * o.bx + i];
      for (let j = 0; j < o.by; j++) for (let k = 0; k < o.bz; k++) for (let i = 0; i < o.bx; i++) {
        if (!at(i, j, k)) continue;
        const lx = org[0] + i + 0.5, ly = org[1] + j + 0.5, lz = org[2] + k + 0.5;
        all.push(lx, ly, lz);
        if (!at(i + 1, j, k) || !at(i - 1, j, k) || !at(i, j + 1, k) || !at(i, j - 1, k) || !at(i, j, k + 1) || !at(i, j, k - 1)) surf.push(lx, ly, lz);
      }
      d.cells = new Float32Array(surf); d.allCells = new Float32Array(all);
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
        // the Gate Temple's pad: a shuttle that stays parked there, its thrusters burning (hangarFx)
        const hangar = s[6] === 'hangar';
        const ship = this.spawn(s[1], hangar ? 'shuttle' : null, null, [s[2], s[3], s[4]], -((s[5] || 0) & 3) * QT, key);
        if (hangar && ship) ship.hangar = true;
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
        g.ui.chatLine(T('g.star.landed', { name: m.name, label: m.label }), '#9affd8');
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
    hits(s, px, py, pz, yaw) {
      const w = this.g.world, T = R.T, cells = s.d.cells; if (!cells) return false;
      const c = Math.cos(yaw), sn = Math.sin(yaw);
      for (let n = 0; n < cells.length; n += 3) {
        const y = Math.floor(py + cells[n + 1]); if (y < 1) return true; if (y >= VR.MAXY) continue;
        const b = w.getBlock(Math.floor(px + cells[n] * c + cells[n + 2] * sn), y, Math.floor(pz - cells[n] * sn + cells[n + 2] * c));
        if (b && (T.flags[b] & F.SOLID) && !(T.flags[b] & F.REPLACE)) return true;
      }
      return false;
    }
    // ---------------------------------------------------------------- piloting
    board(s, p) {
      const g = this.g, gad = g.gadgets;
      if (!s.d.meta || this.pilot || (gad && gad.riding)) return;
      this.pilot = s; s.state = 'flying';
      if (gad) gad.riding = { type: 'starship', ship: s };
      p.flying = false; p.target = null; p.breaking = null; p.yaw = s.yaw; p.pitch = 0;
      g.audio.play('door');
      g.ui.hint(T('g.star.hint', { name: s.d.meta.name }), 4000);
      g.codex && g.codex.event && g.codex.event('ship');
    }
    drive(dt, input, blocked) {
      const g = this.g, p = g.player, s = this.pilot, m = s.d.meta;
      const k = (c) => !blocked && !g.ui.typing && input.down(c);
      if (!blocked && input.hit('KeyV')) { this.auto = null; this.land(); return; }
      if (!blocked && !g.ui.typing && input.hit('KeyG')) this.toggleAuto();
      let fw = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0), st = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0);
      let up = (k('Space') ? 1 : 0) - (k('ShiftLeft') || k('ShiftRight') ? 1 : 0);
      let boost = k('ControlLeft') || k('ControlRight') ? 1.7 : 1;
      const agile = m.arch === 'racer' || m.arch === 'interceptor' ? 2.4 : m.arch === 'freighter' || m.arch === 'cruiser' ? 0.9 : m.arch === 'carrier' ? 0.45 : 1.6;
      let wantYaw = p.yaw, steer = !k('AltLeft');
      // autopilot: any flight key hands the controls back
      if (this.auto && (fw || st || up)) this.stopAuto(T('g.star.autoOff'));
      if (this.auto) {
        const a = this.autoDrive(dt, s, m, agile);
        if (a === 'landed') return;
        if (a) { fw = a.fw; up = a.up; st = a.st || 0; boost = a.boost; wantYaw = a.yaw; steer = true; }
      }
      let turn = 0;
      if (steer) { const dd = wrapA(wantYaw - s.yaw); turn = M.clamp(dd, -agile * dt, agile * dt); }
      if (turn && !this.hits(s, s.pos[0], s.pos[1], s.pos[2], s.yaw + turn)) { s.yaw += turn; if (this.auto) p.yaw += turn; } else turn = 0; // on autopilot your view turns with the ship
      s.turnVel += (turn / Math.max(dt, 1e-3) - s.turnVel) * Math.min(1, dt * 6);
      const vmax = m.speed * boost, fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw), rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);
      const tv = [fx * fw * vmax + rx * st * vmax * 0.4, up * Math.min(22, vmax * 0.6), fz * fw * vmax + rz * st * vmax * 0.4];
      const acc = 1 - Math.exp(-dt * (fw || st || up ? 1.4 : 0.9));
      for (let i = 0; i < 3; i++) s.vel[i] += (tv[i] - s.vel[i]) * acc;
      for (const ax of [0, 2, 1]) {
        const dd = s.vel[ax] * dt; if (!dd) continue;
        const np = s.pos.slice(); np[ax] += dd;
        if (ax === 1 && np[1] + m.height > 254) { s.vel[1] = 0; continue; }
        if (this.hits(s, np[0], np[1], np[2], s.yaw)) { if (Math.abs(s.vel[ax]) > 10) { g.audio.play('explode', { vol: 0.25 }); g.damageFlash = 0.3; } s.vel[ax] *= -0.12; }
        else s.pos[ax] = np[ax];
      }
      s.roll += (M.clamp(s.turnVel * 0.4, -0.55, 0.55) - s.roll) * (1 - Math.exp(-dt * 3));
      s.pitch += (M.clamp(s.vel[1] * 0.02 - fw * 0.02, -0.25, 0.25) - s.pitch) * (1 - Math.exp(-dt * 3));
      this.rotOf(s);
      // gear retracts once airborne
      const alt = s.pos[1] - (this.groundY(s, s.pos[1] + 1, 6) || -99);
      s.gear += ((alt > 2.5 ? 0 : 1) - s.gear) * Math.min(1, dt * 2);
      // engines
      const speed = Math.hypot(s.vel[0], s.vel[1], s.vel[2]);
      const thrust = Math.min(1, (Math.abs(fw) + Math.abs(up) * 0.6 + Math.abs(st) * 0.4) * boost);
      g.audio.loop('engine', 0.16 + thrust * 0.32, 0.3 + Math.min(1, speed / 60) * 0.9);
      if (g.trails) for (let ei = 0; ei < m.exhaust.length; ei++) { const e = m.exhaust[ei]; g.trails.engine('pilot' + ei, s.toWorld([e[0], e[1], e[2] + 0.3]), speed, { thrust: Math.max(0.15, thrust), size: e[3], col: boost > 1 ? [0.35, 0.9, 1] : [0.55, 0.5, 1] }); }
      for (const e of m.exhaust) {
        if (Math.random() > 0.3 + thrust * 0.7) continue;
        const wp = s.toWorld([e[0], e[1], e[2] + 0.2]), dir = s.dirWorld([0, 0, 1]), v = 6 + thrust * 16;
        g.particles.spawn(wp[0] + (Math.random() - 0.5) * e[3], wp[1] + (Math.random() - 0.5) * e[3], wp[2], dir[0] * v + s.vel[0] * 0.7, dir[1] * v + s.vel[1] * 0.7, dir[2] * v + s.vel[2] * 0.7, { life: 0.16 + thrust * 0.22, size: e[3] * (0.5 + thrust * 0.5), grav: 0, col: boost > 1 ? [0.55, 0.85, 1] : [1, 0.62, 0.28], emis: 1, drag: 2, grow: 0.7, collide: false });
      }
      // lasers
      this.fireCool -= dt;
      const fire = input.dragLook ? input.clickAction(0) : input.mouse.down[0];
      if (!blocked && fire && this.fireCool <= 0 && g.entities) {
        this.fireCool = 0.15;
        const guns = m.guns.length ? m.guns : [[-1, m.eye[1] - 0.6, m.bounds[2] - 0.5], [1, m.eye[1] - 0.6, m.bounds[2] - 0.5]];
        const look = p.lookDir();
        for (const gp of guns) g.entities.fireBolt(s.toWorld(gp), look, 120, 10, p, [0.4, 1, 1]);
      }
      if (s.pos[1] > 230) g.codex && g.codex.event && g.codex.event('orbit');
      const eye = s.toWorld(m.eye);
      p.pos = [eye[0], eye[1] - p.eye, eye[2]]; p.vel = s.vel.slice(); p.fallStart = null;
    }
    // ---------------------------------------------------------------- autopilot: fly me to the next village
    autoTargets() {
      const g = this.g, V = g.villages, s = this.pilot; if (!V || !s) return [];
      return V.list().filter(v => Math.hypot(v.x - s.pos[0], v.z - s.pos[2]) > 140).sort((a, b) => Math.hypot(a.x - s.pos[0], a.z - s.pos[2]) - Math.hypot(b.x - s.pos[0], b.z - s.pos[2]));
    }
    toggleAuto() {
      const g = this.g, s = this.pilot; if (!s) return;
      const list = this.autoTargets();
      if (!list.length) { g.ui.hint(T('g.star.noVillage'), 2600); return; }
      // G cycles through the villages, nearest first, then switches the autopilot off
      let i = 0;
      if (this.auto) { i = list.findIndex(v => v.id === this.auto.site.id) + 1; if (i <= 0 || i >= Math.min(list.length, 6)) { this.stopAuto(T('g.star.autoOff2')); return; } }
      this.startAuto(list[i]);
    }
    startAuto(site) {
      const g = this.g, s = this.pilot, m = s.d.meta;
      const dx = site.x - s.pos[0], dz = site.z - s.pos[2], L = Math.hypot(dx, dz) || 1;
      // touch down just outside the houses, on the side we arrive from
      const RAD = site.rad || (VR.VillageGen && VR.VillageGen.RAD) || 58;
      const A = this.auto = { site, spot: null, cruise: Math.max(s.pos[1] + 18, site.y + 60, 120), t: 0, tries: 0, climb: 0, dist: L, eta: 0, refined: false };
      const base = Math.atan2(-dx, -dz), cand = [];
      for (const off of [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4]) {
        const a = base + off, r = RAD + 10 + Math.max(m.length, m.width) * 0.5;
        cand.push([Math.round(site.x + Math.sin(a) * r), Math.round(site.z + Math.cos(a) * r)]);
      }
      const pts = [];
      for (const c of cand) for (const [ox, oz] of [[0, 0], [-6, -6], [6, -6], [-6, 6], [6, 6]]) pts.push([c[0] + ox, c[1] + oz]);
      // cruise altitude clears the highest ground under the whole route
      const N = Math.min(60, Math.ceil(L / 24));
      for (let i = 1; i <= N; i++) pts.push([Math.round(s.pos[0] + dx * i / N), Math.round(s.pos[2] + dz * i / N)]);
      g.pool.direct(0, { type: 'surface', dim: g.dim || 'overworld', points: pts }, null, (msg) => {
        if (this.auto !== A || !msg.res || A.refined) return;
        const H = msg.res, SEA = VR.C.SEA;
        let best = null, bv = 1e9;
        cand.forEach((c, k) => { const hs = H.slice(k * 5, k * 5 + 5); const mn = Math.min(...hs), mx = Math.max(...hs); const v = (mx - mn) * 2 + k * 0.8 + (mn <= SEA + 1 ? 40 : 0); if (v < bv) { bv = v; best = [c[0] + 0.5, mx + 1, c[1] + 0.5]; } });
        A.spot = best;
        let top = 0; for (let i = cand.length * 5; i < H.length; i++) top = Math.max(top, H[i]);
        A.cruise = M.clamp(Math.max(top + 34, (best ? best[1] : site.y) + 45), 100, 236);
      });
      g.ui.chatLine(T('g.star.auto', { site: site.name, km: (L / 1000).toFixed(1) }), '#9affd8');
      g.audio && g.audio.tone && g.audio.tone(660, 0.08, 0.1, 'triangle', true);
    }
    stopAuto(msg) { if (!this.auto) return; this.auto = null; if (msg) this.g.ui.hint(msg, 2200); }
    // near the destination, pick a real landing field from the loaded chunks: flat, dry, no trees or houses
    refineSpot(A, s, m) {
      const g = this.g, w = g.world, T = R.T, VG = VR.VillageGen, site = A.site, RAD = site.rad || (VG && VG.RAD) || 58;
      const b = m.bounds, hx = Math.ceil(Math.max(Math.abs(b[0]), Math.abs(b[3]))) + 1, hz = Math.ceil(Math.max(Math.abs(b[2]), Math.abs(b[5]))) + 1;
      const BAD = /leaves|log|wood|vx_|glass|fence|door|wheat|carrot|potato|beet|farmland|planks|bed|lamp|torch|chest|landing_pad|hazard|crystal|ice$/;
      // ground height at a column: -1 water / trees / houses / crops, null not loaded yet
      const ground = (x, z) => {
        const c = w.col(x >> 4, z >> 4); if (!c || !c.ready) return null;
        let y = c.height[((z & 15) << 4) | (x & 15)];
        for (let k = 0; k < 3 && y > 1; k++) { const bl = w.getBlock(x, y, z); if (bl && (T.flags[bl] & F.SOLID)) break; y--; }
        const bl = w.getBlock(x, y, z);
        if (!bl || (T.flags[bl] & (F.WATER | F.LAVA))) return -1;
        const t = R.types[T.type[bl]];
        if (t && BAD.test(t.name)) return -1;
        return y;
      };
      let best = null, bs = 1e9, missing = 0;
      const a0 = Math.atan2(s.pos[0] - site.x, s.pos[2] - site.z);
      for (const rho of [RAD - 4, RAD + 4, RAD + 12, RAD + 22, RAD + 34, RAD + 48, RAD + 64]) for (let k = 0; k < 20; k++) {
        const a = a0 + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * (Math.PI / 10);
        for (const rot of [0, 1]) {
          const ex = rot ? hz : hx, ez = rot ? hx : hz;
          const cx = Math.round(site.x + Math.sin(a) * (rho + Math.max(ex, ez) * 0.5)), cz = Math.round(site.z + Math.cos(a) * (rho + Math.max(ex, ez) * 0.5));
          let mn = 999, mx = -1, bad = 0, n = 0, miss = false;
          for (let dz = -ez; dz <= ez && !miss; dz += 2) for (let dx = -ex; dx <= ex; dx += 2) {
            const y = ground(cx + dx, cz + dz); n++;
            if (y === null) { miss = true; break; }
            if (y < 0) { bad++; continue; }
            if (y < mn) mn = y; if (y > mx) mx = y;
          }
          if (miss) { missing++; continue; }
          if (mx < 0 || bad > n * 0.35) continue;
          const score = rho + Math.max(0, mx - mn - 1) * 6 + bad * 30 + Math.ceil(k / 2) * 3;
          if (score < bs) { bs = score; best = [cx + 0.5, mx + 1, cz + 0.5, bad]; }
        }
      }
      A.refineTries = (A.refineTries || 0) + 1;
      if (best && (!best[3] || !missing || A.refineTries > 6)) { A.spot = best.slice(0, 3); A.refined = true; }
      else if (!missing || A.refineTries > 6) A.refined = true; // keep the surveyed spot
    }
    autoDrive(dt, s, m, agile) {
      const g = this.g, w = g.world, A = this.auto;
      A.t += dt;
      const site = A.site;
      const d0 = Math.hypot(site.x - s.pos[0], site.z - s.pos[2]);
      if (!A.refined && d0 < 150 && (A.refineT = (A.refineT || 0) - dt) <= 0) { A.refineT = 0.5; this.refineSpot(A, s, m); }
      const tgt = A.spot || [site.x + 0.5, site.y + 1, site.z + 0.5];
      const dx = tgt[0] - s.pos[0], dz = tgt[2] - s.pos[2], dist = Math.hypot(dx, dz);
      A.dist = dist;
      const yaw = Math.atan2(-dx, -dz), off = Math.abs(wrapA(yaw - s.yaw));
      const speed = Math.hypot(s.vel[0], s.vel[2]);
      A.eta = speed > 1 ? dist / speed : 0;
      const vcruise = Math.min(110, m.speed * 1.5), brake = Math.max(70, vcruise * 2.2);
      // altitude: cruise high, glide down over the last stretch
      let alt = A.cruise;
      if (dist < brake) alt = tgt[1] + 2 + (A.cruise - tgt[1] - 2) * Math.max(0, (dist - 5) / brake) ** 1.4;
      // obstacles ahead in the direction of travel (sky islands, a mountain the survey missed): pull up
      if (dist > 20) {
        const look = Math.min(1.4, 8 / Math.max(1, speed) + 0.6);
        if (this.hits(s, s.pos[0] + s.vel[0] * look, s.pos[1] + 1, s.pos[2] + s.vel[2] * look, s.yaw) || this.hits(s, s.pos[0] + s.vel[0] * look * 0.5, s.pos[1] + 1, s.pos[2] + s.vel[2] * look * 0.5, s.yaw)) A.climb = 1.6;
      }
      A.climb = Math.max(0, A.climb - dt);
      if (A.climb > 0) { alt = Math.max(alt, s.pos[1] + 14); if (dist > brake) A.cruise = Math.min(236, Math.max(A.cruise, s.pos[1] + 10)); }
      const up = M.clamp((alt - s.pos[1]) / 7, -1, 1);
      // final approach: hold the heading and slide sideways onto the spot
      if (dist < 18) {
        if (A.finalYaw === undefined) A.finalYaw = s.yaw;
        const vmax = m.speed, vd = Math.min(7, dist * 0.9) / Math.max(dist, 1e-3);
        const vx = dx * vd, vz = dz * vd, fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw), rx = Math.cos(s.yaw), rz = -Math.sin(s.yaw);
        const fw = M.clamp((vx * fx + vz * fz) / vmax, -1, 1), st = M.clamp((vx * rx + vz * rz) / (vmax * 0.4), -1, 1);
        // touch down once the ground there is loaded and we're right above it
        const resting = dist < 2.5 && this.hits(s, s.pos[0], s.pos[1] - 0.6, s.pos[2], s.yaw);
        if (dist < 2.5 && (s.pos[1] - tgt[1] < 5 || resting)) {
          const c = w.col(Math.floor(tgt[0]) >> 4, Math.floor(tgt[2]) >> 4);
          if (c && c.ready) {
            const name = site.name;
            this.auto = null;
            if (this.land() !== false && !this.pilot) { g.ui.chatLine(T('g.star.welcome', { name }), '#ffd98a'); g.ui.hint(T('g.star.welcome', { name }), 3000); if (g.codex && g.codex.event) g.codex.event('autopilot'); return 'landed'; }
            // no room: try another field
            this.auto = A; A.tries++; A.refined = false; A.refineT = 0; A.finalYaw = undefined;
            if (A.tries > 4) { this.stopAuto(T('g.star.autoNoRoom')); return null; }
            const a = Math.random() * Math.PI * 2; A.spot = [tgt[0] + Math.cos(a) * 14, tgt[1], tgt[2] + Math.sin(a) * 14];
          }
        }
        return { fw, st, up: dist < 6 ? up : Math.max(up, -0.3), boost: 1, yaw: A.finalYaw };
      }
      A.finalYaw = undefined;
      // throttle: gentle while climbing out or turning, slower on the approach
      let fw = 1;
      if (s.pos[1] < Math.min(alt, A.cruise) - 25 && dist > brake) fw = 0.35;
      if (off > 0.5) fw = Math.min(fw, 0.3);
      if (A.climb > 0) fw = Math.min(fw, 0.15);
      if (dist < brake) fw = Math.min(fw, M.clamp(dist / brake, 0.12, 1));
      const boost = dist > brake * 1.5 && off < 0.2 && A.climb <= 0 ? vcruise / m.speed : 1;
      return { fw, st: 0, up, boost, yaw };
    }
    land() {
      const g = this.g, s = this.pilot, p = g.player;
      if (!s) return;
      const yaw = Math.round(s.yaw / QT) * QT;
      const old = [s.pos.slice(), s.yaw, s.pitch, s.roll];
      s.yaw = yaw; s.pitch = 0; s.roll = 0;
      s.pos[0] = Math.round(s.pos[0]); s.pos[2] = Math.round(s.pos[2]);
      let y = this.groundY(s, s.pos[1] + 0.5, 40);
      if (y === null || s.pos[1] - y > 40) y = Math.round(s.pos[1]); // hover-park in the sky
      let ok = false;
      for (let k = 0; k < 8 && !ok; k++) { if (!this.hits(s, s.pos[0], y + k, s.pos[2], s.yaw)) { y += k; ok = true; } }
      if (!ok) { s.pos = old[0]; s.yaw = old[1]; s.pitch = old[2]; s.roll = old[3]; this.rotOf(s); g.ui.hint(T('g.star.noRoom'), 1800); return false; }
      s.pos[1] = y; s.vel = [0, 0, 0]; s.state = 'parked'; s.gear = 1; this.rotOf(s);
      this.pilot = null;
      if (g.gadgets) g.gadgets.riding = null;
      g.audio.loop('engine', 0); g.audio.play('door');
      // step out on the port side
      const m = s.d.meta, side = s.toWorld([m.bounds[0] - 1.2, 0.2, (m.bounds[2] + m.bounds[5]) * 0.5]);
      const spot = g.gadgets ? g.gadgets.freeSpot([[side[0], Math.floor(side[1]), side[2]], [side[0], Math.floor(side[1]) + 1, side[2]], [s.pos[0], s.pos[1] + m.height + 0.2, s.pos[2]]]) : side;
      p.teleport(spot[0], spot[1], spot[2]);
      g.ui.vehicleHud(null);
      this.refreshNear(true);
    }
    // ---------------------------------------------------------------- per frame
    update(dt) {
      const g = this.g, p = g.player;
      this.nearT -= dt;
      if (this.nearT <= 0) { this.nearT = 0.4; this.refreshNear(); }
      if ((this.gcT = (this.gcT || 0) - dt) <= 0) { this.gcT = 20; this.gc(); }
      // keep parked ships' gear down & designs fresh
      for (const s of this.ships) { if (s.state === 'parked') s.gear = 1; s.d.last = performance.now(); }
      if (g.settings && g.settings.anim !== false) for (const s of this.ships) if (s.hangar && s.state === 'parked' && !s.hidden) this.hangarFx(s);
      void p;
    }
    // the hangar shuttle's idle glow: its thrusters burn on the pad (a flying ship's engine trail at low thrust) and dust
    // lifts off the pad under them (Animierte Anzeigen; only near the player)
    hangarFx(s) {
      const g = this.g, m = s.d.meta, pl = g.player;
      if (!m || !m.exhaust || !pl || Math.abs(s.pos[0] - pl.pos[0]) > 48 || Math.abs(s.pos[2] - pl.pos[2]) > 48) return;
      if (!s.tid) s.tid = 'hg' + (Math.random() * 1e9 | 0);
      if (g.trails) for (let ei = 0; ei < m.exhaust.length; ei++) { const e = m.exhaust[ei]; g.trails.engine(s.tid + ei, s.toWorld([e[0], e[1], e[2] + 0.3]), 0, { thrust: 0.5, size: e[3], col: [1, 0.72, 0.35], minor: ei > 1 }); }
      // the dust lies on the pad and drifts out from under the hull (it does not climb through the hull)
      if (g.particles && Math.random() < 0.3) for (const e of m.exhaust) {
        const wp = s.toWorld([e[0], e[1], e[2]]);
        g.particles.spawn(wp[0] + (Math.random() - 0.5) * e[3] * 2, s.pos[1] + 0.15, wp[2] + (Math.random() - 0.5) * e[3] * 2, (Math.random() - 0.5) * 2.5, 0.05 + Math.random() * 0.2, (Math.random() - 0.5) * 2.5, { life: 0.8 + Math.random() * 0.6, size: 0.12 + e[3] * 0.2, grav: -0.15, col: [0.62, 0.56, 0.48], emis: 0, drag: 1.5, grow: 1.4, collide: false });
      }
    }
    refreshNear(force) {
      const p = this.g.player; if (!p) { this.near = []; return; }
      // (a hidden ship — the hangar's shuttle while it is out flying, hangarflight.js — is not there to bump into)
      this.near = this.ships.filter(s => s.state === 'parked' && !s.hidden && s.d.occ && Math.abs(s.pos[0] - p.pos[0]) < 60 && Math.abs(s.pos[2] - p.pos[2]) < 60);
      void force;
    }
    hudText() {
      const s = this.pilot; if (!s || !s.d.meta) return null;
      const sp = Math.hypot(s.vel[0], s.vel[1], s.vel[2]), hd = ((Math.round(-s.yaw * 180 / Math.PI) % 360) + 360) % 360;
      const ap = this.auto ? T('g.star.autoHud', { site: this.auto.site.name.toUpperCase(), km: (this.auto.dist / 1000).toFixed(2) }) : '';
      return T('g.star.hud', { v: Math.round(sp), alt: Math.round(s.pos[1]), hd, name: s.d.meta.name, ap });
    }
    camera(cam) {
      const g = this.g, s = this.pilot, p = g.player, m = s.d.meta;
      const sp = Math.hypot(s.vel[0], s.vel[1], s.vel[2]), fovK = 1 + Math.min(0.15, sp / 500);
      if (g.camMode === 0) { const e = s.toWorld(m.eye); return Object.assign(cam, { x: e[0], y: e[1], z: e[2], roll: s.roll * 0.6, fixed: true, fov: cam.fov * fovK }); }
      const rad = Math.max(m.length, m.width) * 0.5;
      const dist = Math.max(8, rad * (g.camMode === 1 ? 1.9 : 3));
      const target = s.toWorld([0, m.height * 0.5, (m.bounds[2] + m.bounds[5]) * 0.5]);
      const c = g.gadgets ? g.gadgets.chase(target, dist, rad * 0.3, p) : target;
      return Object.assign(cam, { x: c[0], y: c[1], z: c[2], roll: 0, fixed: true, fov: cam.fov * fovK, far: cam.far + 60 });
    }
    // ---------------------------------------------------------------- rendering (vox program)
    modelMat(s, cam, stretch) {
      const m = this.m, md = s.d.meta, res = md.res;
      m.set(IDENT);
      mat4.translate(m, m, s.pos[0] - cam.x, s.pos[1] - cam.y, s.pos[2] - cam.z);
      mat4.rotY(m, m, s.yaw);
      if (s.pitch) mat4.rotX(m, m, s.pitch);
      if (s.roll) mat4.rotZ(m, m, s.roll);
      if (s.scale && s.scale !== 1) mat4.scale(m, m, s.scale, s.scale, s.scale);   // a ship drawn smaller (hangarflight.js)
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
    shutdown() { if (this.pilot) this.land(); }
    destroy() { for (const d of this.designs.values()) this.free(d); this.designs.clear(); this.ships = []; this.near = []; }
  }
  VR.Starships = Starships;
})(VR);
