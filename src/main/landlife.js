// ============================================================================
// Life at the land's places (t-land, vgen 10; docs/superpowers/plans/2026-10-09-t-land.md). The land generator
// (gen_land.js) lists its anchors as spawns of their chunks; the entities hand them over here when a column arrives:
//   'fauna' kind x y z n …extra — a herd of sheep in a pasture (extra: its box), deer at a wood's edge (extra: the
//            radius they keep to), ducks on a pond (extra: its radius), fish at the pier and in the falls' pool
//   'mist' x y z k — spray at the foot of a waterfall · 'lighthouse' x y z — the lamp
// Within reach of the player a group is kept at each anchor while its hour allows (VR.Land.faunaPlan: deer at dawn and
// dusk, ducks by day, the herd always — resting at night); the groups are ordinary mobs of entities.js, held to their
// place (m.home). Fish jump, the mist rises, the lighthouse's lamp pulses at night: particles, none on Very Low (the
// particle tier). No block, no save: the anchors come again with their chunks.
// ============================================================================
(function (VR) {
  'use strict';
  const REACH = 72, NEAR = 12, FX = 110, LIGHT = 420;
  class LandLife {
    constructor(game, ents) { this.g = game; this.E = ents; this.anchors = new Map(); this.fx = new Map(); this.acc = 0.5; this.t = 0; this.blink = 0; }
    // a column's spawn records: the land's among them (other kinds belong to other modules)
    absorb(spawns) {
      for (const s of spawns) {
        if (!s) continue;
        if (s[0] === 'fauna') { const key = s[1] + ':' + s[2] + ',' + s[4]; if (!this.anchors.has(key)) this.anchors.set(key, { key, kind: s[1], x: s[2], y: s[3], z: s[4], n: s[5] | 0, extra: s.slice(6), fishT: 2 + Math.random() * 4 }); }
        else if (s[0] === 'mist' || s[0] === 'lighthouse') { const key = s[0] + ':' + s[1] + ',' + s[3]; if (!this.fx.has(key)) this.fx.set(key, { kind: s[0], x: s[1], y: s[2], z: s[3], k: s[4] || 1, acc: Math.random() }); }
      }
    }
    update(dt) {
      const g = this.g; if (!g.player || !VR.Land) return;
      this.t += dt; this.acc += dt;
      const preset = g.settings ? g.settings.preset : 'balanced';
      if (this.acc >= 1) { this.acc = 0; this.herds(preset); }
      if (preset !== 'potato' && g.particles) this.effects(dt, preset);
    }
    // the groups: one pass a second
    herds(preset) {
      const g = this.g, E = this.E, p = g.player, w = g.world, ticks = g.env ? g.env.timeOfDay : 6000;
      if (!E || !w) return;
      const own = new Map();
      for (const m of E.mobs) if (m.anchor && !m.dead) { const a = own.get(m.anchor); if (a) a.push(m); else own.set(m.anchor, [m]); }
      for (const A of this.anchors.values()) {
        if (A.kind === 'fish') { const fx = A.x - p.pos[0], fz = A.z - p.pos[2]; if (fx * fx + fz * fz > 420 * 420) this.anchors.delete(A.key); continue; }
        const dx = A.x + 0.5 - p.pos[0], dz = A.z + 0.5 - p.pos[2], d2 = dx * dx + dz * dz, mine = own.get(A.key) || [];
        if (d2 > 420 * 420) { this.anchors.delete(A.key); continue; }   // (far behind: its column brings it again when it loads)
        if (d2 > REACH * REACH) continue;                     // (the entities' own despawn takes them beyond 140)
        const plan = VR.Land.faunaPlan(A.kind, ticks, preset, A.n);
        // out of their hour (or too many: the preset changed): they go while no one is looking closely
        if (mine.length > plan.n && d2 > 24 * 24) { for (let i = plan.n; i < mine.length; i++) { const k = E.mobs.indexOf(mine[i]); if (k >= 0) E.mobs.splice(k, 1); } continue; }
        if (!plan.mob || d2 < NEAR * NEAR) continue;          // (never popping up right at the player)
        if (mine.length && plan.rest !== undefined) for (const m of mine) m.rest = !!plan.rest;
        for (let k = mine.length; k < plan.n; k++) {
          const at = this.place(A, k);
          if (!at) continue;
          const m = E.summon(plan.mob, at[0], at[1], at[2]);
          if (!m || m === true) continue;
          m.anchor = A.key; m.home = this.home(A); m.rest = !!plan.rest;
          if (A.kind === 'duck') { m.waterY = A.y - 0.12; m.pos[1] = m.waterY; }
        }
      }
    }
    // the place an anchor keeps to: a box (the pasture) or a radius round its point
    home(A) {
      if (A.kind === 'sheep' && A.extra.length >= 4) return { box: A.extra.slice(0, 4), x: A.x, z: A.z };
      return { x: A.x, z: A.z, r: A.extra[0] || 6 };
    }
    // a spot for the k-th of a group: in the box, round the point, on the pond's water
    place(A, k) {
      const w = this.g.world, h = this.home(A);
      for (let tries = 0; tries < 8; tries++) {
        let x, z;
        if (h.box) { x = h.box[0] + Math.random() * (h.box[2] - h.box[0] + 1); z = h.box[1] + Math.random() * (h.box[3] - h.box[1] + 1); }
        else { const a = (k * 2.4 + tries + Math.random()) % 6.283, r = (A.kind === 'duck' ? 0.3 + Math.random() * 0.5 : 0.3 + Math.random() * 0.7) * Math.max(1, h.r - (A.kind === 'duck' ? 1.5 : 0)); x = A.x + 0.5 + Math.cos(a) * r; z = A.z + 0.5 + Math.sin(a) * r; }
        if (A.kind === 'duck') return [x, A.y - 0.12, z];
        if (!w.isLoaded || !w.isLoaded(Math.floor(x), Math.floor(z))) continue;
        const top = w.topAt(Math.floor(x), Math.floor(z)), b = w.getBlock(Math.floor(x), top, Math.floor(z));
        if (!b || !(VR.R.T.flags[b] & VR.F.SOLID) || (VR.R.T.flags[b] & VR.F.FLUID)) continue;
        return [x, top + 1, z];
      }
      return null;
    }
    // particles: fish leaping at the pier and in the pool, spray at the falls, the lighthouse's lamp at night
    effects(dt, preset) {
      const g = this.g, P = g.particles, p = g.player, low = preset === 'low', ticks = g.env ? g.env.timeOfDay : 6000, night = g.env && g.env.E ? g.env.E.night : 0;
      for (const A of this.anchors.values()) {
        if (A.kind !== 'fish') continue;
        const dx = A.x - p.pos[0], dz = A.z - p.pos[2]; if (dx * dx + dz * dz > 60 * 60) continue;
        A.fishT -= dt; if (A.fishT > 0) continue;
        const plan = VR.Land.faunaPlan('fish', ticks, preset, A.n);
        A.fishT = (low ? 7 : 3.5) + Math.random() * 5;
        if (!plan.jumps) continue;
        const r = A.extra[0] || 4, a = Math.random() * 6.283, x = A.x + 0.5 + Math.cos(a) * r * Math.random(), z = A.z + 0.5 + Math.sin(a) * r * Math.random(), y = A.y + 0.95, h = Math.random() * 6.283;
        // the fish: a silver fleck on a short arc, a ring of drops where it leaves and where it falls back
        P.spawn(x, y, z, Math.cos(h) * 1.4, 4.2, Math.sin(h) * 1.4, { life: 0.85, size: 0.13, grav: 10, col: [0.78, 0.84, 0.9], emis: 0, drag: 0, collide: false });
        for (let k = 0; k < (low ? 4 : 9); k++) { const b = Math.random() * 6.283, s = 0.8 + Math.random() * 1.2; P.spawn(x, y, z, Math.cos(b) * s, 1.6 + Math.random() * 1.6, Math.sin(b) * s, { life: 0.45 + Math.random() * 0.3, size: 0.05, grav: 14, col: [0.75, 0.88, 1], emis: 0, collide: false }); }
      }
      for (const [mk, M] of this.fx) {
        const dx = M.x - p.pos[0], dz = M.z - p.pos[2], d2 = dx * dx + dz * dz;
        if (d2 > 900 * 900) { this.fx.delete(mk); continue; }
        if (M.kind === 'mist') {
          if (d2 > FX * FX) continue;
          M.acc += dt * (low ? 2.5 : 6) * M.k;
          while (M.acc >= 1) {
            M.acc -= 1;
            P.spawn(M.x + 0.5 + (Math.random() - 0.5) * 2.4, M.y + 0.2, M.z + 0.5 + (Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 0.9, 0.5 + Math.random() * 0.7, (Math.random() - 0.5) * 0.9,
              { life: 2.2 + Math.random() * 1.6, size: 0.45 + Math.random() * 0.35, grav: -0.05, drag: 0.5, col: [0.86, 0.91, 0.96], grow: 1.1, emis: 0.15, collide: false });
          }
        } else if (M.kind === 'lighthouse') {
          if (d2 > LIGHT * LIGHT || night < 0.35) continue;
          M.acc += dt;
          if (M.acc >= 2.4) { M.acc = 0; P.glow(M.x + 0.5, M.y + 0.5, M.z + 0.5, [1, 0.93, 0.72], 1.1, 1.6, 0); if (!low) P.glow(M.x + 0.5, M.y + 0.5, M.z + 0.5, [1, 0.85, 0.55], 0.7, 2.6, 0); }
        }
      }
    }
  }
  VR.LandLife = LandLife;
  // where an anchored mob may wander: its target clamped into its pasture or round its point (entities.js asks)
  LandLife.clampHome = function (H, t) {
    if (H.box) { t[0] = Math.max(H.box[0] + 0.5, Math.min(H.box[2] + 0.5, t[0])); t[1] = Math.max(H.box[1] + 0.5, Math.min(H.box[3] + 0.5, t[1])); return t; }
    const dx = t[0] - H.x - 0.5, dz = t[1] - H.z - 0.5, d = Math.hypot(dx, dz), r = H.r || 6;
    if (d > r) { t[0] = H.x + 0.5 + dx / d * r; t[1] = H.z + 0.5 + dz / d * r; }
    return t;
  };
})(VR);
