// ============================================================================
// The Hangar Hall's life (TRAILER.md §4, shot E): the two heroes in blue and orange armour who stand at the console rows
// with their blasters up, walk out through the back door and the hex corridor to its city end (t2_20, t1_21) and back,
// the console lights that blink, and the Gate Temple's shuttle that flies in and out (hangarflight.js). Presentation
// only: no block, no save, no collision. The crew comes from the temple's chunks ('hallcrew' spawns, gen_temple.js
// TEMPLE.crew), so it is there wherever the hall loads and a chunk that loads again does not duplicate it. The walks,
// the blinks and the head turns run only with Animierte Anzeigen (settings.anim) and only near the hall; with the
// animation off the heroes stand still at the consoles.
// ============================================================================
(function (VR) {
  'use strict';
  const TAU = Math.PI * 2;
  const yawOf = (dx, dz) => Math.atan2(-dx, -dz);
  // the crew's walk, per side (+1 the orange hero at x 4.9, −1 the blue one at x −3.9: mirror images about x 0.5): from the console spot back past
  // the console row, along the wall (clear of the pad shuttle's wings), to the back door, through the corridor to its
  // city end; a pause there looking out at the city, and the same way back. [x, z] on the hall floor (y 81)
  const ROUTE = {
    1: [[4.9, 0.5], [4.9, 9.5], [9.0, 9.5], [9.0, -33], [2.0, -38.5], [2.0, -46.5]],
    '-1': [[-3.9, 0.5], [-3.9, 9.5], [-8.0, 9.5], [-8.0, -33], [-1.0, -38.5], [-1.0, -46.5]],
  };
  const WALK = 1.6, AT_CONSOLE = 20, AT_EXIT = 15;
  const routeLen = (R) => { let L = 0; for (let i = 1; i < R.length; i++) L += Math.hypot(R[i][0] - R[i - 1][0], R[i][1] - R[i - 1][1]); return L; };
  // the point d metres along the route (and the heading there)
  const along = (R, d) => {
    for (let i = 1; i < R.length; i++) {
      const a = R[i - 1], b = R[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d <= L || i === R.length - 1) { const u = Math.max(0, Math.min(1, d / L)); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, yawOf(b[0] - a[0], b[1] - a[1])]; }
      d -= L;
    }
    return [R[0][0], R[0][1], 0];
  };
  const Hall = VR.Hall = class {
    constructor(game) {
      this.game = game;
      this.crew = [];          // {pos, yaw, look, seed, side, cur:[x, z, yaw]}
      this.keys = new Set();   // crew already placed
      this.blinkT = 0;
      this.pt = 0;             // the walk's clock (s)
      this.flight = VR.HangarFlight && VR.HangarFlight.Actor ? new VR.HangarFlight.Actor(game) : null;
    }
    // the crew's place at time t of the walk: {x, z, yaw, walk (metres walked: the stride phase), moving, phase}
    static patrol(t, side, yaw0) {
      const R = ROUTE[side > 0 ? 1 : '-1'], L = routeLen(R), Tw = L / WALK, T = AT_CONSOLE + Tw + AT_EXIT + Tw;
      t = ((t % T) + T) % T;
      if (t < AT_CONSOLE) return { x: R[0][0], z: R[0][1], yaw: yaw0 || 0, walk: 0, moving: 0, phase: 'console', T };
      t -= AT_CONSOLE;
      if (t < Tw) { const d = t * WALK, p = along(R, d); return { x: p[0], z: p[1], yaw: p[2], walk: d, moving: 1, phase: 'out', T }; }
      t -= Tw;
      if (t < AT_EXIT) { const e = R[R.length - 1]; return { x: e[0], z: e[1], yaw: 0, walk: 0, moving: 0, phase: 'exit', T }; }
      t -= AT_EXIT;
      const d = t * WALK, p = along(R, L - d);
      return { x: p[0], z: p[1], yaw: p[2] + Math.PI, walk: d, moving: 1, phase: 'back', T };
    }
    static get route() { return ROUTE; }
    onColumnLoaded(c) {
      if (!c.spawns) return;
      for (const s of c.spawns) if (s[0] === 'hallcrew') {
        const key = s[1] + ',' + s[2] + ',' + s[3];
        if (this.keys.has(key)) continue;
        this.keys.add(key);
        const Folk = VR.Folk;
        if (!Folk || !Folk.heroLook) continue;
        this.crew.push({ pos: [s[1], s[2], s[3]], yaw: s[4], look: Folk.heroLook({ suit: s[5], hair: s[6], hs: s[7], skin: s[8], tool: 'blaster' }), seed: s[1] * 0.37 + s[3] * 0.11, side: s[1] > 0 ? 1 : -1, cur: [s[1], s[3], s[4]], walk: 0, moving: 0 });
      }
    }
    // the console-top lights of the hall (gen_temple.js TEMPLE.consoleLights, at the temple's floor level)
    lights() {
      if (this._lights) return this._lights;
      const TG = VR.TempleGen, Y = VR.Heart ? VR.Heart.PLAT : 80;
      this._lights = TG && TG.consoleLights ? TG.consoleLights(Y) : [];
      return this._lights;
    }
    update(dt) {
      const g = this.game, pl = g.player;
      if (this.flight) this.flight.update(dt);
      const anim = !(g.settings && g.settings.anim === false);
      if (!this.crew.length || !pl) return;
      const hx = this.crew[0].pos[0], hz = this.crew[0].pos[2], dist = Math.hypot(pl.pos[0] - hx, pl.pos[2] - hz);
      // the walk: only with the animation on and the player near enough to see it (else the crew stands at its post)
      if (anim && dist < 90) {
        this.pt += dt;
        for (const c of this.crew) {
          const p = Hall.patrol(this.pt, c.side, c.yaw);
          let dy = p.yaw - c.cur[2]; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU;
          c.cur[0] = p.x; c.cur[1] = p.z; c.cur[2] += Math.max(-dt * 5, Math.min(dt * 5, dy));
          c.walk = p.walk; c.moving = p.moving;
        }
      } else if (!anim) for (const c of this.crew) { c.cur[0] = c.pos[0]; c.cur[1] = c.pos[2]; c.cur[2] = c.yaw; c.moving = 0; }
      if (!anim || !g.particles || dist > 36) return;
      this.blinkT -= dt;
      if (this.blinkT > 0) return;
      this.blinkT = 0.12;
      for (const p of this.lights()) {
        if (Math.random() > 0.22) continue;
        const warm = Math.random() < 0.3;   // most lights cyan, a few amber
        g.particles.glow(p[0], p[1], p[2], warm ? [1, 0.62, 0.2] : [0.35, 0.95, 1], 0.2 + Math.random() * 0.12, 0.07, 0);
      }
    }
    draw(r, E, cam) {
      if (this.flight) this.flight.draw(r, E, 'opaque');
      if (!this.crew.length) return;
      const g = this.game, ent = g.entities, Folk = VR.Folk;
      if (!ent || !Folk || !VR.mat4) return;
      const t = g.time, anim = !(g.settings && g.settings.anim === false);
      const p = ent.beginVox(r, E);
      for (const c of this.crew) {
        const pos = c.at || (c.at = [0, 0, 0]);
        pos[0] = c.cur[0]; pos[1] = c.pos[1]; pos[2] = c.cur[1];
        const dx = pos[0] - cam.x, dy = pos[1] - cam.y, dz = pos[2] - cam.z;
        if (dx * dx + dz * dz > 70 * 70) continue;
        if (!VR.mat4.boxInFrustum(r.planes, dx - 2, dy - 1, dz - 2, dx + 2, dy + 3, dz + 2)) continue;
        const model = Folk.model(r.gl, c.look, dx * dx + dz * dz > 24 * 24);
        if (!model) continue;
        // the blaster raised (heroPose 'aim'); walking, the legs stride (walk = metres walked); standing, the head turns
        // to look about now and then
        const pose = Folk.heroPose({ aim: true, walk: c.moving ? c.walk * 0.9 : 0, walkAmt: c.moving ? 1 : 0, pitch: 0 });
        if (anim && !c.moving) { pose.head[1] = Math.sin(t * 0.45 + c.seed) * 0.32; pose.body[1] = Math.sin(t * 0.3 + c.seed) * 0.03; }
        const light = ent.lightAt(pos[0], pos[1] + 1.2, pos[2]);
        ent.drawModel(r, p, model, pos, cam, c.cur[2], pose, light, { hide: { lids: !anim, mouth: true } });
      }
    }
    // the shuttle's canopy glass (the translucent pass)
    drawTrans(r, E) { if (this.flight) this.flight.draw(r, E, 'trans'); }
    // put the crew at time pt of their walk, facing where they go there (a camera director, the picture tests)
    jump(pt) {
      this.pt = pt;
      for (const c of this.crew) { const p = Hall.patrol(pt, c.side, c.yaw); c.cur[0] = p.x; c.cur[1] = p.z; c.cur[2] = p.yaw; c.walk = p.walk; c.moving = p.moving; }
    }
    destroy() { if (this.flight) this.flight.destroy(); }
  };
})(VR);
