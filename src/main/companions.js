// ============================================================================
// Companions (🐾 Begleiter), the game side. A wild companion is a mob (entities.js); a tamed one is the same mob with
// a `pet` record (name, state, seed). This module tames them with their treat, steers them (budgeted paths, the
// teleport back to the player, the jump along, the walk to bed), poses them (tail wag, ear twitch, sit, the sleep
// curl), shows the 🐾 chip, opens the rename box, answers Pfeifen, saves them (meta.companions) and shows the
// companions of friends in multiplayer. The rules are in src/shared/pets.js (VR.Pets).
// ============================================================================
(function (VR) {
  'use strict';
  const P = VR.Pets;
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  const KEYS = Object.keys(P.KINDS);
  const STATES = P.STATES;
  const L = (a, b, k) => a + (b - a) * k;
  const angDiff = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
  const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
  // a pose part: [rotX, rotY, rotZ, offX, offY, offZ] written in place (no allocation per frame)
  const put = (o, k, rx, ry, rz, ox, oy, oz) => { const v = o[k] || (o[k] = [0, 0, 0, 0, 0, 0]); v[0] = rx; v[1] = ry; v[2] = rz; v[3] = ox; v[4] = oy; v[5] = oz; return v; };

  class Companions {
    constructor(g, meta) {
      this.g = g;
      this.budget = 2;                  // path searches this frame
      this.ctx = { player: [0, 0, 0], night: false, home: null };   // reused every think
      this.prevOnGround = true;
      this.chipT = 0; this.chipText = null;
      this.rename = null; this.renameEl = null; this.renameIn = null;
      this.mountUI();
      const list = meta ? P.deserialize(meta.companions) : [];
      for (const rec of list) this.adopt(rec);
    }
    // ---------------------------------------------------------------- the things that are yours
    pets() { const out = []; const ms = this.g.entities ? this.g.entities.mobs : []; for (const m of ms) if (m.pet) out.push(m); return out; }
    adopt(rec) {
      const ent = this.g.entities; if (!ent || !P.isKind(rec.kind)) return null;
      const m = ent.summon(rec.kind, rec.pos[0], rec.pos[1], rec.pos[2]);
      if (!m) return null;
      m.yaw = rec.yaw; m.bodyYaw = rec.yaw;
      m.pet = { name: rec.name, state: rec.state, seed: rec.seed, pos: m.pos, idle: 0, clock: 0, progD: Infinity, progT: 0, thinkT: 0, thinkDt: 0, path: null, pi: 0, goal: null, fails: 0, wig: 0, sitK: 0, sleepK: 0 };
      return m;
    }
    // a wild companion becomes yours: the treat in your hand, hearts, a chirp, its name (the rename box opens)
    tame(m, p) {
      const g = this.g, K = P.KINDS[m.kind];
      if (!K) return;
      if (this.pets().length >= P.MAX) { g.ui.hint(T('g.pet.full', { n: P.MAX }), 3200); return; }
      const held = p.inv && p.inv.held;
      if (!held || held.id !== K.treat) { g.ui.hint(T('g.pet.wantsTreat', { name: K.name, treat: VR.itemName(K.treat) }), 3800); return; }
      if (!p.creative) p.inv.consumeHeld(1);
      const seed = Math.abs(Math.round(m.pos[0] * 7 + m.pos[2] * 13 + m.id)) | 0;
      m.pet = { name: P.pickName(m.kind, seed), state: 'follow', seed, pos: m.pos, idle: 0, clock: 0, progD: Infinity, progT: 0, thinkT: 0, thinkDt: 0, path: null, pi: 0, goal: null, fails: 0, wig: 1.5, sitK: 0, sleepK: 0 };
      m.hurt = 0; m.ai.flee = 0; m.ai.target = null; m.ai.moving = false;
      this.hearts(m, 9);
      g.audio.play('pet');
      g.ui.toast(T('g.pet.tamed', { name: m.pet.name }), T('g.pet.tamedSub', { kind: K.name }), 'egg_' + m.kind);
      this.chipT = 0;
      this.openRename(m);
    }
    // right-click: tame (wild) · sit ↔ follow (yours) · Shift+right-click: rename (yours)
    onUse(m, p, shift) {
      if (!m.pet) { this.tame(m, p); return; }
      if (shift) { this.openRename(m); return; }
      const st = P.toggle(m.pet);
      this.g.ui.hint(T(st === 'sit' ? 'g.pet.sits' : 'g.pet.follows', { name: m.pet.name }), 2400);
      this.hearts(m, 3); this.g.audio.play('pet'); this.chipT = 0;
    }
    // left-click: a pat (never a blow)
    pat(m) {
      if (m.pet) { m.pet.wig = 1.2; this.hearts(m, 3); } else if (m.ai) m.ai.flee = 2.5;   // a wild one is shy: it runs off a little
      if (m.vel) m.vel[1] = Math.max(m.vel[1], 3.2);
      this.g.audio.play('pet');
    }
    // 🐾 Pfeifen: every companion that sits or sleeps stands up and comes
    call() {
      const g = this.g, list = this.pets();
      if (!list.length) { g.ui.hint(T('g.pet.none'), 4200); return false; }
      for (const m of list) { P.call(m.pet); this.hearts(m, 4); }
      g.audio.play('pet');
      g.ui.hint(T('g.pet.called'), 2600);
      return true;
    }
    hearts(m, n) {
      const g = this.g; if (!g.particles) return;
      const x = m.pos[0], y = m.pos[1] + m.h + 0.1, z = m.pos[2];
      for (let i = 0; i < (n || 6); i++) {
        const a = Math.random() * 6.283;
        g.particles.spawn(x + Math.cos(a) * 0.12, y, z + Math.sin(a) * 0.12, Math.cos(a) * 0.35, 0.9 + Math.random() * 0.8, Math.sin(a) * 0.35,
          { life: 1.1 + Math.random() * 0.4, size: 0.13, grav: -1.2, drag: 0.6, col: [1, 0.42, 0.62], emis: 1, collide: false });
      }
    }
    // ---------------------------------------------------------------- the rename box
    mountUI() {
      const ui = this.g.ui; if (!ui || !ui.root) return;
      const old = document.getElementById('petname'); if (old) old.remove();   // a new world: a fresh box whose handlers belong to it
      const el = document.createElement('div');
      el.id = 'petname'; el.className = 'screen';
      el.innerHTML = '<div class="panel box col gap" style="min-width:min(400px,92vw)">' +
        '<h2 data-t="g.pet.renameTitle"></h2><div class="note" id="petnameNote"></div>' +
        '<input type="text" id="petnameIn" maxlength="' + P.NAME_MAX + '" autocomplete="off" spellcheck="false">' +
        '<div class="row gap"><button class="btn primary" id="petnameOk" data-t="g.pet.renameOk"></button>' +
        '<button class="btn small" id="petnameCancel" data-t="g.pet.renameCancel"></button></div></div>';
      ui.root.appendChild(el);
      if (VR.I18N && VR.I18N.retext) VR.I18N.retext(el);
      this.renameEl = el; this.renameIn = el.querySelector('#petnameIn');
      this.renameIn.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { e.preventDefault(); this.applyRename(); }
        else if (e.key === 'Escape') { e.preventDefault(); this.closeRename(); }
      });
      el.querySelector('#petnameOk').addEventListener('click', () => this.applyRename());
      el.querySelector('#petnameCancel').addEventListener('click', () => this.closeRename());
    }
    openRename(m) {
      const g = this.g; if (!this.renameEl || !m.pet) return;
      this.rename = m;
      this.renameIn.value = m.pet.name;
      this.renameEl.querySelector('#petnameNote').textContent = T('g.pet.renameNote', { kind: P.KINDS[m.kind].name });
      g.ui.typing = true;
      g.ui.show('petname');
      setTimeout(() => { try { this.renameIn.focus(); this.renameIn.select(); } catch (e) { /* no focus: the name stays */ } }, 0);
    }
    applyRename() {
      const m = this.rename;
      if (m && m.pet) m.pet.name = P.sanitizeName(this.renameIn.value, m.pet.name);
      this.chipT = 0;
      this.closeRename();
    }
    closeRename() {
      const g = this.g;
      this.rename = null;
      if (this.renameIn) this.renameIn.blur();
      g.ui.typing = false;
      g.ui.resume();
    }
    // ---------------------------------------------------------------- the 🐾 chip (name and mood of the nearest)
    chipTick(dt) {
      this.chipT -= dt; if (this.chipT > 0) return;
      this.chipT = 0.25;
      const el = document.getElementById('petchip'); if (!el || !this.g.player) return;
      const list = this.pets();
      if (!list.length) { if (this.chipText !== '') { this.chipText = ''; el.style.display = 'none'; } return; }
      const p = this.g.player, ctx = this.ctx;
      let best = list[0], bd = Infinity;
      for (const m of list) { const dx = m.pos[0] - p.pos[0], dz = m.pos[2] - p.pos[2], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = m; } }
      ctx.player[0] = p.pos[0]; ctx.player[1] = p.pos[1]; ctx.player[2] = p.pos[2];
      ctx.night = !!(this.g.env && this.g.env.E && this.g.env.E.night > 0.5);
      const text = T('g.pet.chip', { name: best.pet.name, mood: T('g.pet.m.' + P.mood(best.pet, ctx)) }) + (list.length > 1 ? '  +' + (list.length - 1) : '');
      if (text !== this.chipText) { this.chipText = text; el.textContent = text; }
      el.style.display = 'block';
    }
    // ---------------------------------------------------------------- per frame (before the mobs move)
    update(dt) {
      const g = this.g, p = g.player;
      this.budget = g.cpuBound ? 1 : 2;
      if (!p || !g.entities) return;
      // the player jumps: the companions close by jump with them
      const jumped = this.prevOnGround && !p.onGround && p.vel[1] > 2;
      this.prevOnGround = !!p.onGround;
      if (jumped) for (const m of g.entities.mobs) if (m.pet && m.pet.state === 'follow' && m.onGround) { const dx = m.pos[0] - p.pos[0], dz = m.pos[2] - p.pos[2]; if (dx * dx + dz * dz < 49) m.vel[1] = 7.4; }
      this.chipTick(dt);
    }
    // the rules think (VR.Pets.decide); this walks, following the path and the player
    steer(m, dt, d2) {
      const g = this.g, p = g.player, pet = m.pet, def = m.def, w = g.world;
      if (!pet || !p) return;
      pet.pos = m.pos;   // the record and the mob share the array (a teleport changes it in place)
      const ctx = this.ctx, pp = p.pos;
      ctx.player[0] = pp[0]; ctx.player[1] = pp[1]; ctx.player[2] = pp[2];
      ctx.night = !!(g.env && g.env.E && g.env.E.night > 0.5);
      const home = p.spawnBed || p.spawn;
      ctx.home = Array.isArray(home) && home.length >= 3 ? home : null;
      pet.idle = Math.hypot(m.vel[0], m.vel[2]) < 0.2 ? pet.idle + dt : 0;
      pet.wig = Math.max(0, (pet.wig || 0) - dt);
      // below the world, or on ground that is not loaded here: back to the player at once
      if (m.pos[1] < -4 || !w.isLoaded(Math.floor(m.pos[0]), Math.floor(m.pos[2]))) this.teleport(m);
      pet.thinkDt += dt; pet.thinkT -= dt;
      if (pet.thinkT <= 0) {
        pet.thinkT = P.thinkEvery(d2);
        const act = P.decide(pet, ctx, pet.thinkDt);
        pet.thinkDt = 0;
        if (act === 'teleport') this.teleport(m);
        else if (act === 'path') this.plan(m, pp);
        else if (act === 'bed') this.plan(m, home);
        else pet.path = null;
      }
      // the next waypoint of the path
      let tx = 0, tz = 0, go = false;
      if (pet.state === 'follow' && pet.path) {
        while (pet.pi < pet.path.length) {
          const wp = pet.path[pet.pi], dx = wp[0] + 0.5 - m.pos[0], dz = wp[2] + 0.5 - m.pos[2];
          if (dx * dx + dz * dz < 0.12 && Math.abs(m.pos[1] - wp[1]) < 1.2) pet.pi++;
          else { tx = wp[0] + 0.5; tz = wp[2] + 0.5; go = true; break; }
        }
        if (pet.pi >= pet.path.length) pet.path = null;
      }
      if (go) {
        const dx = tx - m.pos[0], dz = tz - m.pos[2], dd = Math.hypot(dx, dz) || 1;
        const want = dd > 6 ? def.speed * 1.7 : dd > 2.5 ? def.speed * 1.3 : def.speed;
        const k = Math.min(1, dt * 8);
        m.vel[0] += (dx / dd * want - m.vel[0]) * k; m.vel[2] += (dz / dd * want - m.vel[2]) * k;
        m.yaw += angDiff(Math.atan2(-dx, -dz) - m.yaw) * Math.min(1, dt * 6);
        m.ai.moving = true;
      } else {
        const damp = Math.exp(-dt * 8);
        m.vel[0] *= damp; m.vel[2] *= damp; m.ai.moving = false;
        if (pet.state !== 'sleep') {
          const dx = pp[0] - m.pos[0], dz = pp[2] - m.pos[2];
          if (dx * dx + dz * dz > 0.25) m.yaw += angDiff(Math.atan2(-dx, -dz) - m.yaw) * Math.min(1, dt * 3);
        }
      }
      const hs = Math.hypot(m.vel[0], m.vel[2]);
      m.walk += hs * dt * 2.4;
      m.walkAmt += ((hs > 0.35 ? 1 : 0) - m.walkAmt) * Math.min(1, dt * 6);
    }
    // a path to a cell, budgeted: at most `budget` searches a frame, the old path kept while the goal stays near
    plan(m, to) {
      const pet = m.pet, g = this.g;
      const gx = Math.floor(to[0]), gy = Math.floor(to[1] + 0.05), gz = Math.floor(to[2]);
      if (pet.path && pet.goal && pet.pi < pet.path.length && Math.abs(pet.goal[0] - gx) + Math.abs(pet.goal[2] - gz) <= 2) return;
      if (this.budget <= 0) return;
      this.budget--;
      const from = [Math.floor(m.pos[0]), Math.floor(m.pos[1] + 0.05), Math.floor(m.pos[2])];
      const res = VR.Folk.findPath(g.world, from, [gx, gy, gz], { kid: true, near: 2, partial: true, max: g.cpuBound ? 240 : 420 });
      if (!res || res.path.length < 2) { pet.path = null; pet.fails = (pet.fails || 0) + 1; if (pet.fails > 3) { pet.fails = 0; this.teleport(m); } return; }
      pet.path = res.path; pet.pi = 1; pet.goal = [gx, gy, gz]; pet.fails = 0;
    }
    // a standing cell next to the player (rings 2–4 blocks out), or false
    spotNear(pp) {
      const w = this.g.world, Fo = VR.Folk;
      const px = Math.floor(pp[0]), py = Math.floor(pp[1]), pz = Math.floor(pp[2]);
      for (let r = 2; r <= 4; r++) for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2 + r;
        const x = px + Math.round(Math.cos(a) * r), z = pz + Math.round(Math.sin(a) * r);
        if (!w.isLoaded(x, z)) continue;
        for (let y = py + 2; y >= py - 3; y--) {
          const below = w.getBlock(x, y - 1, z), feet = Fo.passable(w.getBlock(x, y, z)), head = Fo.passable(w.getBlock(x, y + 1, z));
          if (Fo.standable(below) && (feet === 1 || feet === 4) && (head === 1 || head === 4)) return [x, y, z];
        }
      }
      return null;
    }
    // appear next to the player (the record's place is changed in place: the mob and its record share the array)
    teleport(m) {
      const g = this.g, p = g.player, spot = this.spotNear(p.pos);
      if (g.particles) { g.particles.spark(m.pos[0], m.pos[1] + 0.5, m.pos[2], [1, 0.6, 1], 10, 2, 1); }
      // no free cell near the player (a cliff, water): right above the player, where it settles; a companion is never lost
      if (spot) { m.pos[0] = spot[0] + 0.5; m.pos[1] = spot[1]; m.pos[2] = spot[2] + 0.5; }
      else { m.pos[0] = p.pos[0]; m.pos[1] = p.pos[1] + 1.5; m.pos[2] = p.pos[2]; }
      m.vel[0] = 0; m.vel[1] = 0; m.vel[2] = 0; m.onGround = false;
      m.pet.path = null; m.pet.progD = Infinity; m.pet.progT = m.pet.clock || 0;
      if (g.particles) { g.particles.spark(m.pos[0], m.pos[1] + 0.5, m.pos[2], [1, 0.6, 1], 10, 2, 1); }
      return true;
    }
    // ---------------------------------------------------------------- the pose: idle (wag, twitch), walk, sit, sleep curl
    static poseOf(m, t) {
      const pet = m.pet || {}, st = pet.state || 'follow', out = m.posed || (m.posed = {});
      const sitK = (pet.sitK = L(pet.sitK || 0, st === 'sit' ? 1 : 0, 0.18));
      const slK = (pet.sleepK = L(pet.sleepK || 0, st === 'sleep' ? 1 : 0, 0.12));
      const kw = Math.max(0, 1 - sitK - slK);
      const ph = (m.walk || 0) * 3, wa = m.walkAmt || 0, s = Math.sin(ph) * 0.7 * wa;
      const id = m.id || 0, happy = (pet.wig || 0) > 0;
      const wag = Math.sin(t * (happy ? 14 : 5.5) + id) * (happy ? 0.55 : 0.28);
      const k = (t + id * 1.7) % 4.2, ear = k < 0.22 ? Math.sin(k / 0.22 * Math.PI) * 0.45 : 0;
      const bob = Math.sin(ph * 2) * 0.05 * wa, look = Math.sin(t * 0.8 + id) * 0.12;
      put(out, 'leg_fl', s * kw + slK, 0, 0, 0, 0, 0);
      put(out, 'leg_fr', -s * kw + slK, 0, 0, 0, 0, 0);
      put(out, 'leg_bl', -s * kw + 1.3 * sitK + 1.4 * slK, 0, 0, 0, 0, 0);
      put(out, 'leg_br', s * kw + 1.3 * sitK + 1.4 * slK, 0, 0, 0, 0, 0);
      put(out, 'body', 0.42 * sitK, 0, 0, 0, -0.9 * sitK - 2.2 * slK, 0.3 * sitK);
      put(out, 'head', 0.25 * sitK - 0.9 * slK + bob, look * (1 - slK) + 0.9 * slK, 0, 0, -0.6 * slK, 0);
      put(out, 'tail', -0.55 * (1 - slK) + 0.1 * slK, wag * (1 - slK) + 1.3 * slK, 0, 0, 0, 0);
      put(out, 'ear_l', 0, 0, ear * (1 - slK), 0, 0, 0);
      put(out, 'ear_r', 0, 0, -ear * (1 - slK), 0, 0, 0);
      return out;
    }
    pose(m, t) { return Companions.poseOf(m, t); }
    // ---------------------------------------------------------------- friends: the companions of the others (presence)
    presence() {
      const list = this.pets(); if (!list.length) return null;
      return list.slice(0, P.MAX).map(m => [KEYS.indexOf(m.kind), P.sanitizeName(m.pet.name, '').slice(0, 12), r1(m.pos[0]), r1(m.pos[1]), r1(m.pos[2]), r2(m.yaw), Math.max(0, STATES.indexOf(m.pet.state))]);
    }
    drawRemote(r, p, cam, remote) {
      const g = this.g, ent = g.entities, gl = r.gl;
      if (!ent || !remote) return;
      for (const a of remote.values()) {
        if (!a.has || a.dead) continue;
        const list = Array.isArray(a.co) ? a.co : null;
        if (!list || !list.length) { if (a.pv) a.pv.length = 0; continue; }
        if (!a.pv) a.pv = [];
        a.pv.length = Math.min(a.pv.length, list.length);
        for (let i = 0; i < list.length; i++) {
          const c = list[i]; if (!Array.isArray(c) || c.length < 7) continue;
          const kind = KEYS[c[0] | 0]; if (!kind) continue;
          let v = a.pv[i];
          if (!v || v.kind !== kind) v = a.pv[i] = { kind, def: VR.MOBS[kind], id: i + 3, pos: [c[2], c[3], c[4]], yaw: c[5], walk: 0, walkAmt: 0, pet: { state: 'follow', wig: 0 }, posed: null, h: VR.MOBS[kind].h };
          const dx = c[2] - v.pos[0], dy = c[3] - v.pos[1], dz = c[4] - v.pos[2];
          if (dx * dx + dy * dy + dz * dz > 400) { v.pos[0] = c[2]; v.pos[1] = c[3]; v.pos[2] = c[4]; }
          else { v.pos[0] += dx * 0.3; v.pos[1] += dy * 0.3; v.pos[2] += dz * 0.3; }
          const moved = Math.hypot(dx, dz);
          v.walkAmt += ((moved > 0.05 ? 1 : 0) - v.walkAmt) * 0.2;
          v.walk += moved * 2.4;
          v.yaw = c[5];
          v.pet.state = STATES[c[6] | 0] || 'follow';
          const ex = v.pos[0] - cam.x, ez = v.pos[2] - cam.z;
          if (ex * ex + ez * ez > 110 * 110) continue;
          const model = VR.getVoxModel(gl, v.def.model); if (!model) continue;
          const light = ent.lightAt(v.pos[0], v.pos[1] + 0.4, v.pos[2]);
          ent.drawModel(r, p, model, v.pos, cam, v.yaw, this.pose(v, g.time || 0), light, {});
        }
      }
    }
    // ---------------------------------------------------------------- the save (meta.companions)
    beforeSave(meta) {
      const list = this.pets();
      if (!list.length) { delete meta.companions; return; }
      meta.companions = P.serialize(list.map(m => ({ kind: m.kind, name: m.pet.name, state: m.pet.state, pos: m.pos, yaw: m.yaw, seed: m.pet.seed })));
    }
    destroy() {
      const el = document.getElementById('petchip'); if (el) el.style.display = 'none';
      const box = document.getElementById('petname'); if (box) box.remove();
      this.rename = null; this.renameEl = null; this.renameIn = null;
    }
  }
  VR.Companions = Companions;
})(VR);
