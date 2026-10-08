// ============================================================================
// Vents & beams (TRAILER.md §2.2, §3.5, §3.7): the Ember Canyon's lava vents breathe smoke columns and drift glowing
// embers (the generator lists them as spawns of their chunks; world.js hands them over on arrival), and the Spire
// Citadel's main spire throws a blue sparkle beam into the sky. Both are particles spawned within reach of the eye
// only. The Low preset draws fewer of them and Very Low none.
// ============================================================================
(function (VR) {
  'use strict';
  const HEART = VR.Heart;
  const REACH_VENT = 230, REACH_BEAM = 760, REACH_BEACON = 420, BLINK = 1.6, FLASH = 0.22;
  class Vents {
    constructor(game) {
      this.g = game;
      this.list = new Map();          // 'x,y,z' → [x, y, z] of the vents the loaded chunks reported
      this.beacons = new Map();       // 'x,y,z' → [x, y, z] of the red tip beacons (spires, watch towers)
      this.acc = 0; this.beam = 0; this.t = 0; this.lit = false;
    }
    reset() { this.list.clear(); this.beacons.clear(); this.acc = 0; this.beam = 0; this.t = 0; this.lit = false; }
    // the chunk's spawn records: the vents and beacons among them (other kinds belong to other modules)
    absorb(spawns) {
      for (const s of spawns) {
        if (!s) continue;
        if (s[0] === 'vent') this.list.set(s[1] + ',' + s[2] + ',' + s[3], [s[1], s[2], s[3]]);
        else if (s[0] === 'beacon') this.beacons.set(s[1] + ',' + s[2] + ',' + s[3], [s[1], s[2], s[3]]);
      }
    }
    update(dt, eye) {
      const g = this.g, P = g.particles, preset = g.settings && g.settings.preset;
      if (!P || !eye || preset === 'potato') return;
      const low = preset === 'low';
      this.acc += dt;
      if (this.acc >= (low ? 0.8 : 0.3) && this.list.size) {
        this.acc = 0;
        for (const [x, y, z] of this.list.values()) {
          const dx = x - eye[0], dz = z - eye[2];
          if (dx * dx + dz * dz > REACH_VENT * REACH_VENT) continue;
          // a grey smoke puff rising off the vent (it grows as it climbs, the column breaks up near the top)
          P.spawn(x + (Math.random() - 0.5) * 0.9, y + 0.1, z + (Math.random() - 0.5) * 0.9,
            (Math.random() - 0.5) * 0.25, 1.4 + Math.random() * 0.8, (Math.random() - 0.5) * 0.25,
            { life: 5 + Math.random() * 2.5, size: 0.7 + Math.random() * 0.35, grav: -0.25, drag: 0.35, col: [0.7, 0.66, 0.66], grow: 0.9, collide: false, emis: 0 });
          // a warm ember now and then: the heat shimmer over the seam
          if (!low && Math.random() < 0.6) P.spawn(x, y + 0.2, z, (Math.random() - 0.5) * 0.6, 1.2 + Math.random() * 1.2, (Math.random() - 0.5) * 0.6,
            { life: 1.2 + Math.random() * 0.8, size: 0.07, grav: -0.1, drag: 0.3, col: [1, 0.62, 0.22], emis: 1, collide: false });
        }
      }
      // the red tip beacons blink: one flash every 1.6 s, a glow burst off each beacon cell within reach (TRAILER §3.7)
      this.t += dt;
      const on = this.t % BLINK < FLASH;
      if (on && !this.lit) {
        this.lit = true;
        for (const [x, y, z] of this.beacons.values()) {
          const dx = x - eye[0], dz = z - eye[2];
          if (dx * dx + dz * dz > REACH_BEACON * REACH_BEACON) continue;
          P.glow(x, y + 0.5, z, [1, 0.2, 0.18], 0.9, 0.42, 0.9);
          if (!low) for (let k = 0; k < 3; k++) P.glow(x, y + 0.5, z, [1, 0.35, 0.3], 0.5, 0.2, 0.6 + Math.random());
        }
      } else if (!on) this.lit = false;
      // the citadel's blue sparkle beam: from the spire's mid-height up into the sky (the Heartland's fixed citadel)
      const C = HEART && HEART.CITADEL;
      if (C && !low) {
        const dx = C.x - eye[0], dz = C.z - eye[2];
        if (dx * dx + dz * dz < REACH_BEAM * REACH_BEAM) {
          this.beam += dt * 46;
          while (this.beam >= 1) {
            this.beam -= 1;
            const a = Math.random() * 6.283, r = Math.random() * 1.6, y = C.y + 40 + Math.random() * 110;
            P.spawn(C.x + Math.cos(a) * r, y, C.z + Math.sin(a) * r, (Math.random() - 0.5) * 0.6, 5 + Math.random() * 5, (Math.random() - 0.5) * 0.6,
              { life: 2.2 + Math.random() * 1.2, size: 0.16 + Math.random() * 0.12, grav: 0, drag: 0.05, col: [0.45, 0.86, 1.0], emis: 1, collide: false });
          }
        } else this.beam = 0;
      }
    }
  }
  VR.Vents = Vents;
})(VR);
