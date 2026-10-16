// ============================================================================
// Life at the land's places (t-land, vgen 10; docs/superpowers/plans/2026-10-09-t-land.md). The land generator
// (gen_land.js) lists its anchors as spawns of their chunks; the entities hand them over here when a column arrives:
//   'fauna' kind x y z n …extra — a herd of sheep in a pasture (extra: its box), deer at a wood's edge (extra: the
//            radius they keep to), ducks on a pond (extra: its radius), fish at the pier and in the falls' pool
//   'mist' x y z k — spray at the foot of a waterfall · 'lighthouse' x y z — the lamp
//   'windmill' x y z f — a farm's windmill: its hub (the sails' pivot) and the facing of its sails (t-polish)
// Within reach of the player a group is kept at each anchor while its hour allows (VR.Land.faunaPlan: deer at dawn and
// dusk, ducks by day, the herd always — resting at night); the groups are ordinary mobs of entities.js, held to their
// place (m.home). Fish jump, the mist rises, the lighthouse's lamp pulses at night: particles, none on Very Low (the
// particle tier). The windmills' sails (t-polish): a model round each hub (life_sails, below), turned in the world's wind
// (LandLife.millSpeed: proportional to the wind, gusts add, under 0.1 they stop) through the sails' inertia (a lag of
// 2.5 s: the speed never jumps; the angle integrates real seconds, so it never jumps at midnight); on Very Low they stand
// still (the light model, no turning). A mill whose hub stands among sail blocks (a column saved before the sails became
// the game's) keeps those and gets no model. No block, no save: the anchors come again with their chunks.
// ============================================================================
(function (VR) {
  'use strict';
  const REACH = 72, NEAR = 12, FX = 110, LIGHT = 420;
  const MILL_FAR = 260, MILL_FINE = 48;    // the sails drawn within 260 blocks (the hub's column loaded), the lattice within 48
  const DIR4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // a facing's outward direction (0 north … 3 west, as the blocks' FACING4)
  class LandLife {
    constructor(game, ents) { this.g = game; this.E = ents; this.anchors = new Map(); this.fx = new Map(); this.mills = new Map(); this.acc = 0.5; this.t = 0; this.blink = 0; }
    // a column's spawn records: the land's among them (other kinds belong to other modules)
    absorb(spawns) {
      for (const s of spawns) {
        if (!s) continue;
        if (s[0] === 'fauna') { const key = s[1] + ':' + s[2] + ',' + s[4]; if (!this.anchors.has(key)) this.anchors.set(key, { key, kind: s[1], x: s[2], y: s[3], z: s[4], n: s[5] | 0, extra: s.slice(6), fishT: 2 + Math.random() * 4 }); }
        else if (s[0] === 'mist' || s[0] === 'lighthouse') { const key = s[0] + ':' + s[1] + ',' + s[3]; if (!this.fx.has(key)) this.fx.set(key, { kind: s[0], x: s[1], y: s[2], z: s[3], k: s[4] || 1, acc: Math.random() }); }
        else if (s[0] === 'windmill') { const key = 'mill:' + s[1] + ',' + s[2] + ',' + s[3]; if (!this.mills.has(key)) this.mills.set(key, { key, x: s[1], y: s[2], z: s[3], f: (s[4] | 0) & 3, ang: 0, w: 0, state: 0, chk: 0 }); }
      }
    }
    update(dt) {
      const g = this.g; if (!g.player || !VR.Land) return;
      this.t += dt; this.acc += dt;
      const preset = g.settings ? g.settings.preset : 'balanced';
      if (this.acc >= 1) { this.acc = 0; this.herds(preset); this.millCheck(); }
      if (this.mills.size) this.millTurn(dt, preset);
      if (preset !== 'potato' && g.particles) this.effects(dt, preset);
    }
    // ---- the windmills (t-polish): the sails turn in the wind (Very Low: they stand still)
    millTurn(dt, preset) {
      const E = this.g.env && this.g.env.E, still = preset === 'potato';
      const wind = E && Number.isFinite(E.wind) ? E.wind : 1, gust = E && Number.isFinite(E.gust) ? E.gust : 0;
      for (const m of this.mills.values()) if (m.state === 1) LandLife.millStep(m, wind, gust, dt, still);
    }
    // once a second: is the hub there (a log), and are the sails the game's? (a column saved with t-land's sail blocks
    // keeps them: no model then); mills far behind are forgotten (their column brings them again)
    millCheck() {
      const g = this.g, w = g.world, p = g.player, R = VR.R; if (!w || !w.getBlock || !R) return;
      const nm = (x, y, z) => { const s = w.getBlock(x, y, z); return s ? R.types[R.T.type[s]].name : ''; };
      for (const [k, m] of this.mills) {
        const dx = m.x - p.pos[0], dz = m.z - p.pos[2];
        if (dx * dx + dz * dz > 900 * 900) { this.mills.delete(k); continue; }
        if (dx * dx + dz * dz > (MILL_FAR + 40) * (MILL_FAR + 40)) continue;
        if (!w.isLoaded || !w.isLoaded(m.x, m.z)) { m.state = 0; continue; }
        const d = DIR4[m.f], ax = -d[1], az = d[0];
        if (!/_log$|_wood$/.test(nm(m.x, m.y, m.z))) { m.state = 3; continue; }   // (the hub is gone: no sails in the air)
        let sail = false;
        for (const [ox, oy, oz] of [[ax, 0, az], [-ax, 0, -az], [0, 1, 0], [0, -1, 0]]) if (nm(m.x + ox, m.y + oy, m.z + oz) === 'vx_windmill_sail') { sail = true; break; }
        m.state = sail ? 2 : 1;
      }
    }
    // the sails, drawn in the entities' voxel pass: the fine model within MILL_FINE (not on Very Low), the light one beyond
    draw(r, E, cam, prog) {
      if (!this.mills.size || !this.E || !VR.getVoxModel) return;
      const g = this.g, preset = g.settings ? g.settings.preset : 'balanced', ents = this.E, mat4 = VR.mat4;
      for (const m of this.mills.values()) {
        if (m.state !== 1) continue;
        const d = DIR4[m.f], px = m.x + 0.5, py = m.y + 0.5, pz = m.z + 0.5;
        const dx = px - cam.x, dy = py - cam.y, dz = pz - cam.z, d2 = dx * dx + dz * dz;
        if (d2 > MILL_FAR * MILL_FAR) continue;
        if (!mat4.boxInFrustum(r.planes, dx - 5, dy - 5, dz - 5, dx + 5, dy + 5, dz + 5)) continue;
        const fine = preset !== 'potato' && d2 < MILL_FINE * MILL_FINE;
        const model = VR.getVoxModel(r.gl, fine ? 'life_sails' : 'life_sails_far'); if (!model) continue;
        const light = ents.lightAt(m.x + d[0], m.y, m.z + d[1]);
        const pos = m.pos || (m.pos = [0, 0, 0]); pos[0] = px; pos[1] = py; pos[2] = pz;
        ents.drawModel(r, prog, model, pos, cam, Math.atan2(-d[0], -d[1]), null, light, { roll: m.ang, shade: 0 });
      }
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
          // t-motion · with Wind in allem the foot of a fall throws up a billowing column of mist: thinner, bigger puffs that
          // rise higher, churn (turbulence) and drift with the wind, and a fine spray of droplets bursting out of the pool
          // (VR.Motion.FALLS; the third browser run's falls showed a thin wisp — the column game.js waterFx was meant to
          // throw never came: the land's falls are stacked falling water, its scan never finds a foot)
          const FM = g.settings && g.settings.motion && VR.Motion && VR.Motion.FALLS;
          M.acc += dt * (FM ? (low ? FM.rate[0] : FM.rate[1]) : (low ? 2.5 : 6)) * M.k;
          while (M.acc >= 1) {
            M.acc -= 1;
            if (FM) {
              const r = Math.random;
              P.spawn(M.x + 0.5 + (r() - 0.5) * FM.spread, M.y + 0.2 + r() * 0.8, M.z + 0.5 + (r() - 0.5) * FM.spread, (r() - 0.5) * 1.2, FM.vy[0] + r() * (FM.vy[1] - FM.vy[0]), (r() - 0.5) * 1.2,
                { life: FM.life[0] + r() * (FM.life[1] - FM.life[0]), size: FM.size[0] + r() * (FM.size[1] - FM.size[0]), grav: -0.18, drag: 0.8, col: [0.9, 0.94, 0.98], grow: FM.grow, emis: 0.15, collide: false, alpha: FM.alpha, turb: FM.turb, wind: FM.wind });
              if (!low && r() < FM.spray) { const a = r() * 6.283, s = 1.6 + r() * 1.8; P.spawn(M.x + 0.5 + (r() - 0.5) * 1.6, M.y + 0.5, M.z + 0.5 + (r() - 0.5) * 1.6, Math.cos(a) * s, 1.8 + r() * 1.8, Math.sin(a) * s, { life: 0.8 + r() * 0.5, size: 0.05 + r() * 0.04, grav: 7, drag: 0.4, col: [0.86, 0.93, 1], emis: 0.3, collide: false }); }
              continue;
            }
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
  // ---- the sails' turning (pure: test/polish_mill.js). The speed the wind asks (rad/s): K per unit of the world's wind
  // (weather.js: clear 1, overcast 1.1, fog 0.7, rain 2.6, storm 3), a gust (0…1) adds up to 45 %, capped at MAX; under
  // CALM none. The sails follow it with a lag of TAU seconds (their inertia), so the speed never jumps and the angle — the
  // integral of the speed over real seconds — is continuous (at midnight too: the day's clock is not in it)
  LandLife.MILL = { K: 0.85, MAX: 1.8, CALM: 0.1, TAU: 2.5 };
  LandLife.millSpeed = function (wind, gust) {
    const M = LandLife.MILL;
    if (!(wind >= M.CALM)) return 0;
    return Math.min(M.MAX, M.K * wind * (1 + 0.45 * Math.max(0, Math.min(1, gust || 0))));
  };
  // one step of a mill {ang, w}: still (Very Low) holds the sails where they stand
  LandLife.millStep = function (m, wind, gust, dt, still) {
    if (still || !(dt > 0)) { if (still) m.w = 0; return m.ang; }
    const M = LandLife.MILL, tgt = LandLife.millSpeed(wind, gust);
    m.w += (tgt - m.w) * (1 - Math.exp(-dt / M.TAU));
    m.ang += m.w * dt;
    if (m.ang >= Math.PI * 2) m.ang -= Math.PI * 2;
    return m.ang;
  };

  // ---- the sails' models (our own; VR.VOXMODELS, built on first use): four blades round a hub, 9 m across (1 voxel =
  // 1/8 m) in the plane of the hub's front, the axle along the model's −z (out of the wall). A blade, one voxel thick (a
  // flat board merges into a few faces): a dark stock from the hub to the tip and on its trailing side cream canvas in a
  // light lattice (a rail, cross bars every 3½ voxels, a middle bar); the hub a dark boss with a brass cap. The far model:
  // the stocks and plain canvas — Very Low's, and everyone's beyond MILL_FINE
  const M = VR.VOXMODELS, Grid = VR.VoxGrid;
  if (M && Grid) {
    const N = 71, C = 35, R = 35, PZ = 8;   // the grid 71 × 71 × 4 voxels, the hub at its centre, the blades 0.75–0.875 m out
    const STOCK = 0x4E3622, LATT = 0xA87444, CANVAS = 0xF2E8D2, BOSS = 0x3A2A1E, CAP = 0xD8A83A;
    // the colour at blade-local (u across, v along the blade from the hub; the trailing side u > 0), or 0
    const blade = (u, v, fine) => {
      if (v < 2.5 || v > R) return 0;
      if (Math.abs(u) < 1.05) return STOCK;
      if (u < 1 || u > 9.2 || v < 6 || v > R - 1) return 0;
      if (!fine) return CANVAS;
      const rail = u > 8.1, end = v < 7 || v > R - 2, bar = ((v - 6) % 3.5) < 0.9, mid = Math.abs(u - 5) < 0.5;
      return rail || end || bar || mid ? LATT : CANVAS;
    };
    const sails = (fine) => {
      const gr = new Grid(N, N, 4, C + 0.5, C + 0.5, PZ);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const a = x - C, b = y - C;   // (voxel centres at integer offsets from the hub)
        // the four blades: rotate the cell into each blade's frame (v outward, u its trailing side)
        for (const [u, v] of [[a, b], [-b, a], [-a, -b], [b, -a]]) { const c = blade(u, v, fine); if (c) gr.set(x, y, 1, c, 0); }
        const rr = Math.hypot(a, b);
        if (rr <= 3.2) for (let z = 1; z <= (fine ? 3 : 1); z++) gr.set(x, y, z, BOSS, 0);   // the boss, back to the hub log's face
        if (fine && rr <= 1.6) gr.set(x, y, 0, CAP, 0);                                 // the brass cap in front
      }
      return { unit: 8, radius: 4.6, parts: { body: { grid: gr, pivot: [0, 0, 0] } }, layout: { body: [0, 0, 0] } };
    };
    M.life_sails = () => sails(true);
    M.life_sails_far = () => sails(false);
  }
  // where an anchored mob may wander: its target clamped into its pasture or round its point (entities.js asks)
  LandLife.clampHome = function (H, t) {
    if (H.box) { t[0] = Math.max(H.box[0] + 0.5, Math.min(H.box[2] + 0.5, t[0])); t[1] = Math.max(H.box[1] + 0.5, Math.min(H.box[3] + 0.5, t[1])); return t; }
    const dx = t[0] - H.x - 0.5, dz = t[1] - H.z - 0.5, d = Math.hypot(dx, dz), r = H.r || 6;
    if (d > r) { t[0] = H.x + 0.5 + dx / d * r; t[1] = H.z + 0.5 + dz / d * r; }
    return t;
  };
})(VR);
