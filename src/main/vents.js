// ============================================================================
// Vents & beams (TRAILER.md §2.2, §3.5, §3.7): the Ember Canyon's lava vents breathe smoke columns and drift glowing
// embers (the generator lists them as spawns of their chunks; world.js hands them over on arrival), and the Spire
// Citadel's main spire throws a blue sparkle beam into the sky. Both are particles spawned within reach of the eye
// only. The Low preset draws fewer of them and Very Low none. A fall off a floating island (vgen 9) breaks up in the
// air: its foot lists a 'mist' spawn and soft white spray puffs there (a lava fall smokes and sparks).
// ============================================================================
(function (VR) {
  'use strict';
  const HEART = VR.Heart;
  const REACH_VENT = 230, REACH_BEAM = 760, REACH_BEACON = 420, REACH_MIST = 320, BLINK = 1.6, FLASH = 0.22;
  const SPRAY = [0.92, 0.96, 1.0], SMOKE = [0.5, 0.46, 0.46], EMBER = [1, 0.55, 0.2];
  // the falls' mist, a puff at a time: where it starts (across the 2 × 2 curtain: spread; over the spawn, which lies
  // amid the ragged end: rise), how it moves (side; vy — on down the fall's way, a lava fall's smoke up), how long it
  // lives, how big it is and grows, its own opacity (beauty_rules 9: the plume's heart at most 0.7 opaque)
  const MIST = {
    water: { spread: 2.6, rise: 4, side: 1.2, vy: [-5, -3], life: [5, 6.5], size: [1.5, 2.1], grav: 0.6, drag: 0.4, grow: 1.0, alpha: 0.11 },
    lava: { spread: 2.4, rise: 3, side: 1.0, vy: [1.4, 2.4], life: [5, 7], size: [1.0, 1.5], grav: -0.15, drag: 0.35, grow: 1.2, alpha: 0.08 },
  };
  class Vents {
    constructor(game) {
      this.g = game;
      this.list = new Map();          // 'x,y,z' → [x, y, z] of the vents the loaded chunks reported
      this.beacons = new Map();       // 'x,y,z' → [x, y, z] of the red tip beacons (spires, watch towers)
      this.mists = new Map();         // 'x,y,z' → [x, y, z, lava] of the falls' feet (gen_realm.js, vgen 9)
      this.acc = 0; this.macc = 0; this.beam = 0; this.t = 0; this.lit = false;
    }
    reset() { this.list.clear(); this.beacons.clear(); this.mists.clear(); this.acc = 0; this.macc = 0; this.beam = 0; this.t = 0; this.lit = false; }
    // the chunk's spawn records: the vents, beacons and mists among them (other kinds belong to other modules)
    absorb(spawns) {
      for (const s of spawns) {
        if (!s) continue;
        if (s[0] === 'vent') this.list.set(s[1] + ',' + s[2] + ',' + s[3], [s[1], s[2], s[3]]);
        else if (s[0] === 'beacon') this.beacons.set(s[1] + ',' + s[2] + ',' + s[3], [s[1], s[2], s[3]]);
        else if (s[0] === 'mist') this.mists.set(s[1] + ',' + s[2] + ',' + s[3], [s[1], s[2], s[3], s[4] | 0]);
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
      // the falls' feet: the curtain breaks up into spray that goes on falling under its ragged end — slowing, widening
      // and thinning into a plume of mist (t1_07 · t1_09) — a puff every quarter second (Low: every 0.9 s); a lava fall's
      // end smokes upward and throws a few sparks (MIST). Run c2's first puffs, opaque discs of one or two blocks, hung
      // under the isles as white balls on strings; 902a59f's wide thin veils round the foot piled up into a white ball of
      // their own (beauty_rules 9 lays the discs over each other: 0.98 at its heart, 17 blocks across, nothing under it)
      this.macc += dt;
      if (this.macc >= (low ? 0.9 : 0.25) && this.mists.size) {
        this.macc = 0;
        const r = Math.random, o = this._mo || (this._mo = { life: 1, size: 1, grav: 0, drag: 0, col: SPRAY, alpha: 1, grow: 0, collide: false, emis: 0 });
        const e = this._eo || (this._eo = { life: 1, size: 0.08, grav: 2, drag: 0.4, col: EMBER, emis: 1, collide: false });
        for (const [x, y, z, lava] of this.mists.values()) {
          const dx = x - eye[0], dz = z - eye[2];
          if (dx * dx + dz * dz > REACH_MIST * REACH_MIST) continue;
          const M = lava ? MIST.lava : MIST.water;
          o.life = M.life[0] + r() * (M.life[1] - M.life[0]); o.size = M.size[0] + r() * (M.size[1] - M.size[0]);
          o.grav = M.grav; o.drag = M.drag; o.col = lava ? SMOKE : SPRAY; o.alpha = M.alpha; o.grow = M.grow;
          P.spawn(x + (r() - 0.5) * M.spread, y + r() * M.rise, z + (r() - 0.5) * M.spread, (r() - 0.5) * M.side, M.vy[0] + r() * (M.vy[1] - M.vy[0]), (r() - 0.5) * M.side, o);
          if (lava && !low && r() < 0.6) { e.life = 1 + r() * 0.8; P.spawn(x + (r() - 0.5) * 1.5, y + r() * 3, z + (r() - 0.5) * 1.5, (r() - 0.5) * 1.2, -1 - r(), (r() - 0.5) * 1.2, e); }
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
  Vents.MIST = MIST;
  VR.Vents = Vents;
})(VR);
