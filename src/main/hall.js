// ============================================================================
// The Hangar Hall's life (TRAILER.md §4, shot E): the two heroes in blue and orange armour who stand in front of the
// console rows with their blasters up, and the console lights that blink. Presentation only: no block, no save, no
// collision. The crew comes from the temple's chunks ('hallcrew' spawns, gen_temple.js TEMPLE.crew), so it is there
// wherever the hall loads and a chunk that loads again does not duplicate it. The blinks and the idle head turns run
// only with Animierte Anzeigen (settings.anim) and only near the hall; with the animation off the heroes stand still.
// ============================================================================
(function (VR) {
  'use strict';
  const Hall = VR.Hall = class {
    constructor(game) {
      this.game = game;
      this.crew = [];          // {pos, yaw, look, seed}
      this.keys = new Set();   // crew already placed
      this.blinkT = 0;
      this.hall = null;        // the hall's centre (set when the first crew member loads)
    }
    onColumnLoaded(c) {
      if (!c.spawns) return;
      for (const s of c.spawns) if (s[0] === 'hallcrew') {
        const key = s[1] + ',' + s[2] + ',' + s[3];
        if (this.keys.has(key)) continue;
        this.keys.add(key);
        const Folk = VR.Folk;
        if (!Folk || !Folk.heroLook) continue;
        this.crew.push({ pos: [s[1], s[2], s[3]], yaw: s[4], look: Folk.heroLook({ suit: s[5], hair: s[6], hs: s[7], skin: s[8], tool: 'blaster' }), seed: s[1] * 0.37 + s[3] * 0.11 });
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
      if (!this.crew.length || !pl || !g.particles || (g.settings && g.settings.anim === false)) return;
      const hx = this.crew[0].pos[0], hz = this.crew[0].pos[2];
      if (Math.hypot(pl.pos[0] - hx, pl.pos[2] - hz) > 36) return;
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
      if (!this.crew.length) return;
      const g = this.game, ent = g.entities, Folk = VR.Folk;
      if (!ent || !Folk || !VR.mat4) return;
      const gl = r.gl, t = g.time, anim = !(g.settings && g.settings.anim === false);
      const p = ent.beginVox(r, E);
      for (const c of this.crew) {
        const dx = c.pos[0] - cam.x, dy = c.pos[1] - cam.y, dz = c.pos[2] - cam.z;
        if (dx * dx + dz * dz > 70 * 70) continue;
        if (!VR.mat4.boxInFrustum(r.planes, dx - 2, dy - 1, dz - 2, dx + 2, dy + 3, dz + 2)) continue;
        const model = Folk.model(gl, c.look, dx * dx + dz * dz > 24 * 24);
        if (!model) continue;
        // a standing hero with the blaster raised (heroPose 'aim'); the head turns to look about, now and then
        const pose = Folk.heroPose({ aim: true, walk: 0, walkAmt: 0, pitch: 0 });
        if (anim) { pose.head[1] = Math.sin(t * 0.45 + c.seed) * 0.32; pose.body[1] = Math.sin(t * 0.3 + c.seed) * 0.03; }
        const light = ent.lightAt(c.pos[0], c.pos[1] + 1.2, c.pos[2]);
        ent.drawModel(r, p, model, c.pos, cam, c.yaw, pose, light, { hide: { lids: !anim, mouth: true } });
      }
    }
  };
})(VR);
