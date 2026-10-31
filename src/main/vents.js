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
    water: { spread: 2.6, rise: 4, side: 1.2, vy: [-5, -3], life: [5, 6.5], size: [1.5, 2.1], grav: 0.6, drag: 0.4, grow: 1.0, alpha: 0.11, turb: 1.4, wind: 0.12 },
    lava: { spread: 2.4, rise: 3, side: 1.0, vy: [1.4, 2.4], life: [5, 7], size: [1.0, 1.5], grav: -0.15, drag: 0.35, grow: 1.2, alpha: 0.08, turb: 0.9, wind: 0.2 },
  };
  // t-motion: a water fall's stream on into the void (Wind in allem, Balanced and up): a puff 4–12 blocks under the foot,
  // falling on at 5–8 blocks a second, bigger and thinner than the mist (the plume reaches some 40 blocks further down)
  const STREAM = { below: [4, 12], vy: [-8, -5], life: [6, 8.5], size: [2.0, 3.0], grav: 0.4, drag: 0.25, grow: 1.4, alpha: 0.06, turb: 1.8, wind: 0.2 };
  const REACH_RING = 520;   // (t-motion: the watchtowers' ring lights, seen from afar)
  class Vents {
    constructor(game) {
      this.g = game;
      this.list = new Map();          // 'x,y,z' → [x, y, z] of the vents the loaded chunks reported
      this.beacons = new Map();       // 'x,y,z' → [x, y, z] of the red tip beacons (spires, watch towers)
      this.mists = new Map();         // 'x,y,z' → [x, y, z, lava] of the falls' feet (gen_realm.js, vgen 9)
      this.acc = 0; this.macc = 0; this.beam = 0; this.t = 0; this.lit = false;
    }
    // the Heartland's own world: a generated (not flat) overworld of vgen 3 and up (quests.js heartOn)
    static heartOn(g) { const m = g && g.meta; return !!g && (g.dim || 'overworld') === 'overworld' && (!m || ((m.vgen | 0) >= 3 && m.type !== 'flat')); }   // (no record: a test's stand-in game, the overworld)
    reset() { this.list.clear(); this.beacons.clear(); this.mists.clear(); this.acc = 0; this.macc = 0; this.beam = 0; this.t = 0; this.lit = false; }
    // the chunk's spawn records: the vents, beacons and mists among them (other kinds belong to other modules)
    absorb(spawns) {
      for (const s of spawns) {
        if (!s) continue;
        if (s[0] === 'vent') this.list.set(s[1] + ',' + s[2] + ',' + s[3], [s[1], s[2], s[3]]);
        else if (s[0] === 'beacon') this.beacons.set(s[1] + ',' + s[2] + ',' + s[3], [s[1], s[2], s[3], 0, -1, 0]);   // (t-motion: its kind — 0 not yet known, 1 a spire's, 2 a watchtower's —, the ring chase's last light, the next look)
        else if (s[0] === 'mist') this.mists.set(s[1] + ',' + s[2] + ',' + s[3], [s[1], s[2], s[3], s[4] | 0]);
      }
    }
    update(dt, eye) {
      const g = this.g, P = g.particles, preset = g.settings && g.settings.preset;
      if (!P || !eye || preset === 'potato') return;
      const low = preset === 'low', Mo = VR.Motion, mo = !!(g.settings && g.settings.motion && Mo && Mo.BEAM);   // (t-motion: the living landmarks, Low and up)
      this.acc += dt;
      if (this.acc >= (low ? 0.8 : 0.3) && this.list.size) {
        this.acc = 0;
        for (const [x, y, z] of this.list.values()) {
          const dx = x - eye[0], dz = z - eye[2];
          if (dx * dx + dz * dz > REACH_VENT * REACH_VENT) continue;
          // a grey smoke puff rising off the vent (it grows as it climbs, the column breaks up near the top)
          P.spawn(x + (Math.random() - 0.5) * 0.9, y + 0.1, z + (Math.random() - 0.5) * 0.9,
            (Math.random() - 0.5) * 0.25, 1.4 + Math.random() * 0.8, (Math.random() - 0.5) * 0.25,
            { life: 5 + Math.random() * 2.5, size: 0.7 + Math.random() * 0.35, grav: -0.25, drag: 0.35, col: [0.7, 0.66, 0.66], grow: 0.9, collide: false, emis: 0, wind: 0.22, turb: 0.5 });   // (t-motion: the column leans with the wind and churns)
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
          o.grav = M.grav; o.drag = M.drag; o.col = lava ? SMOKE : SPRAY; o.alpha = M.alpha; o.grow = M.grow; o.turb = M.turb || 0; o.wind = M.wind || 0;   // (t-motion: the plume billows and drifts)
          P.spawn(x + (r() - 0.5) * M.spread, y + r() * M.rise, z + (r() - 0.5) * M.spread, (r() - 0.5) * M.side, M.vy[0] + r() * (M.vy[1] - M.vy[0]), (r() - 0.5) * M.side, o);
          if (lava && !low && r() < 0.6) { e.life = 1 + r() * 0.8; P.spawn(x + (r() - 0.5) * 1.5, y + r() * 3, z + (r() - 0.5) * 1.5, (r() - 0.5) * 1.2, -1 - r(), (r() - 0.5) * 1.2, e); }
          // t-motion: the fall streams on into the void — a long thin plume under the foot, falling, widening and fading
          // (STREAM: one more puff a quarter second per water fall, Balanced and up)
          if (mo && !lava && !low) {
            const s = this._so || (this._so = { life: 1, size: 1, grav: STREAM.grav, drag: STREAM.drag, col: SPRAY, alpha: STREAM.alpha, grow: STREAM.grow, collide: false, emis: 0, turb: STREAM.turb, wind: STREAM.wind });
            s.life = STREAM.life[0] + r() * (STREAM.life[1] - STREAM.life[0]); s.size = STREAM.size[0] + r() * (STREAM.size[1] - STREAM.size[0]);
            P.spawn(x + (r() - 0.5) * M.spread * 1.4, y - STREAM.below[0] - r() * (STREAM.below[1] - STREAM.below[0]), z + (r() - 0.5) * M.spread * 1.4, (r() - 0.5) * M.side, STREAM.vy[0] + r() * (STREAM.vy[1] - STREAM.vy[0]), (r() - 0.5) * M.side, s);
            this.streams = (this.streams | 0) + 1;
          }
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
      if (mo) this.ringLights(P, eye);
      // the citadel's blue sparkle beam: from the spire's mid-height up into the sky (the Heartland's fixed citadel)
      // (f-polish4: only on the Heartland itself — the citadel's place is a fixed point of the overworld, and in the
      // Ringstation's hall, near the same numbers, its sparks rose as a column of white orbs through the café)
      const C = HEART && HEART.CITADEL && Vents.heartOn(g) ? HEART.CITADEL : null;
      if (C && !low) {
        const dx = C.x - eye[0], dz = C.z - eye[2];
        if (dx * dx + dz * dz < REACH_BEAM * REACH_BEAM) {
          if (mo) this.pulseBeam(dt, P, C);
          else this.beam += dt * 46;
          while (!mo && this.beam >= 1) {
            this.beam -= 1;
            const a = Math.random() * 6.283, r = Math.random() * 1.6, y = C.y + 40 + Math.random() * 110;
            P.spawn(C.x + Math.cos(a) * r, y, C.z + Math.sin(a) * r, (Math.random() - 0.5) * 0.6, 5 + Math.random() * 5, (Math.random() - 0.5) * 0.6,
              { life: 2.2 + Math.random() * 1.2, size: 0.16 + Math.random() * 0.12, grav: 0, drag: 0.05, col: [0.45, 0.86, 1.0], emis: 1, collide: false });
          }
        } else this.beam = 0;
      }
    }
    // t-motion · the citadel's beam breathes (VR.Motion.BEAM): the stream runs at 0.45 … 1.55 of its old rate on a 4 s cycle
    // (the same sparks a second on average), brighter at the peak, and at each peak a ring of sparks shoots up the beam,
    // widening as it climbs
    pulseBeam(dt, P, C) {
      const Mo = VR.Motion, B = Mo.BEAM, pulse = Mo.beamPulse(this.t), k = B.bright[0] + B.bright[1] * pulse;
      const o = this._bo || (this._bo = { life: 1, size: 0.2, grav: 0, drag: 0.05, col: [0, 0, 0], emis: 1, collide: false });
      o.col[0] = 0.45 * k; o.col[1] = 0.86 * k; o.col[2] = 1.0 * k;
      this.beam += dt * 46 * (B.rate[0] + B.rate[1] * pulse);
      while (this.beam >= 1) {
        this.beam -= 1; this.beamSparks = (this.beamSparks | 0) + 1;
        const a = Math.random() * 6.283, r = Math.random() * 1.6, y = C.y + 40 + Math.random() * 110;
        o.life = 2.2 + Math.random() * 1.2; o.size = 0.16 + Math.random() * 0.12;
        P.spawn(C.x + Math.cos(a) * r, y, C.z + Math.sin(a) * r, (Math.random() - 0.5) * 0.6, 5 + Math.random() * 5, (Math.random() - 0.5) * 0.6, o);
      }
      const ph = ((this.t / B.period) % 1 + 1) % 1;
      if (this.beamPh !== undefined && this.beamPh < 0.5 && ph >= 0.5) {
        const ro = this._ro || (this._ro = { life: B.ringLife, size: 0.24, grav: 0, drag: 0.05, col: [0.7, 1.15, 1.5], emis: 1, collide: false, force: true });
        for (let q = 0; q < B.ring; q++) { const a = q / B.ring * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a); P.spawn(C.x + ca * B.ringR, C.y + 40, C.z + sa * B.ringR, ca * B.ringOut, B.ringV, sa * B.ringOut, ro); }
        this.rings = (this.rings | 0) + 1;
      }
      this.beamPh = ph;
    }
    // t-motion · the watchtowers' saucer rings: a chase of running lights round the rim (VR.Motion.RING) within REACH_RING.
    // A beacon is a watchtower's when the beacon block sits one above its spawn (gen_citadel.js: the spike's tip; a spire's
    // spawn is the beacon cell itself) — looked up once its chunk is there
    ringLights(P, eye) {
      const Mo = VR.Motion, RG = Mo.RING, w = this.g.world, R = VR.R, bt = R && R.byName && R.byName.beacon_red;
      if (!w || !bt) return;
      const o = this._lo || (this._lo = { life: RG.tail, size: RG.size, grav: 0, drag: 0, col: RG.col, emis: 1, collide: false, force: true }), pt = this._lp || (this._lp = [0, 0, 0]);
      for (const b of this.beacons.values()) {
        const dx = b[0] - eye[0], dz = b[2] - eye[2];
        if (dx * dx + dz * dz > REACH_RING * REACH_RING) continue;
        if (b[3] === 0) {
          if (this.t < b[5]) continue;
          const at = (y) => { const s = w.getBlock(b[0], y, b[2]); return s ? (R.T.type[s] === bt.id ? 1 : 2) : 0; };
          const here = at(b[1]), up = at(b[1] + 1);
          if (here === 1) b[3] = 1; else if (here === 2 && up === 1) b[3] = 2; else { b[5] = this.t + 2; continue; }   // (not there yet: look again in 2 s)
        }
        if (b[3] !== 2) continue;
        const h = Mo.ringHead(this.t, Mo.hash3(b[0], b[1], b[2]));
        if (h === b[4]) continue;
        b[4] = h; this.ringSpawns = (this.ringSpawns | 0) + 1;
        Mo.ringLight(h, b[0], b[1], b[2], pt);
        P.spawn(pt[0], pt[1], pt[2], 0, 0, 0, o);
      }
    }
  }
  Vents.MIST = MIST; Vents.STREAM = STREAM; Vents.REACH_RING = REACH_RING;
  VR.Vents = Vents;
})(VR);
