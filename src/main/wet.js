// ============================================================================
// t-material · the wet world (plan docs/superpowers/plans/2026-10-15-t-material.md, step 3). How wet the ground is and
// how full its puddles are, from the rain over time — pure (env.js keeps one state and hands it to the shaders as u_wet
// and u_puddle): the surface wets within ~20 s of rain (a drizzle wets less), puddles fill within ~45 s of a proper rain,
// and after the rain both dry over ten minutes (a time constant of 200 s: 5 % left at 10 min). The puddles' size follows
// their fill (the shader's mask threshold), so they shrink from their edges and the small ones go first.
// And the drops from the eaves: while the roofs are wet, drops fall from the edges of overhangs near the player
// (a scan every 2 s; particles from Low up — Very Low has no wet ground).
// ============================================================================
(function (VR) {
  'use strict';
  const W = VR.Wet = {
    TAU_WET: 8,       // s: the surface wets
    TAU_FILL: 25,     // s: the puddles fill (at full rain)
    TAU_DRY: 200,     // s: both dry (10 min → 5 %)
    PUD_RAIN: 0.2,    // a rain weaker than this forms no puddles
  };
  W.state = () => ({ wet: 0, pud: 0 });
  // one step: rain 0..1 (the weather's eased strength), dt in seconds
  W.step = function (s, rain, dt) {
    const r = Math.max(0, Math.min(1, rain || 0)), d = Math.max(0, Math.min(10, dt || 0));
    const tw = Math.min(1, r * 1.6);                                   // a drizzle wets the surface less
    s.wet += (tw - s.wet) * (1 - Math.exp(-d / (tw > s.wet ? W.TAU_WET : W.TAU_DRY)));
    const tp = r > W.PUD_RAIN ? Math.min(1, (r - W.PUD_RAIN) / (1 - W.PUD_RAIN) * 1.25) : 0;
    s.pud += (tp - s.pud) * (1 - Math.exp(-d / (tp > s.pud ? W.TAU_FILL / Math.max(0.3, r) : W.TAU_DRY)));
    if (s.wet < 1e-4) s.wet = 0; if (s.pud < 1e-4) s.pud = 0;
    return s;
  };
  // how much a material darkens when wet, by its roughness and coat (the shader's rule, for the tests): soil, sand,
  // stone and wood soak water and darken; tiles, polish, metal and glass shed it
  W.darken = (rough, coat) => 0.42 * Math.max(0, Math.min(1, (rough - 0.45) / 0.45)) ** 2 * (3 - 2 * Math.max(0, Math.min(1, (rough - 0.45) / 0.45))) * (1 - (coat || 0));
  // the puddle mask's threshold for a fill (the shader: a hollow is under water where the noise is below it)
  W.edge = (pud) => 0.31 + 0.13 * pud;

  // ---- rain under roofs (t-polish2, t-material's gap): the wet look asked the sky light, and glass passes it — a street
  // under a glass vault (Weißstadt's) got wet and grew puddles though no rain reaches it. A column is open to the rain
  // above its top rain-stopping block: anything solid (glass is solid), a fluid, leaves — the column heights world.js keeps
  // (topAt) and the rain's particles stop at. The terrain reads the rain's height map round the camera (game.js keeps it
  // while it rains and while the ground is wet; TERRAIN_FS rainOpen: the same rule)
  W.blocksRain = (s) => !!s && (VR.R.T.flags[s] & (VR.F.SOLID | VR.F.FLUID | VR.F.LEAVES)) !== 0;
  // the column's top rain-stopping block between yLo and yHi (yLo − 1: none)
  W.rainTop = function (getBlock, x, z, yHi, yLo) { for (let y = yHi; y >= yLo; y--) if (W.blocksRain(getBlock(x, y, z))) return y; return yLo - 1; };
  // the face of the block at (x, y, z) that faces (nx, ny, nz) gets the rain where the air cell in front of it lies above
  // its column's top (top(x, z))
  W.faceOpen = (top, x, y, z, nx, ny, nz) => y + ny > top(x + nx, z + nz);
  // the map: 128 × 128 columns from (hx, hz), each its top clamped to the R8 range (the old fill wrapped above y 255) —
  // read a chunk column at a time (81 lookups instead of 16 384)
  W.MAP = 128;
  W.fillMap = function (w, hx, hz, out) {
    const N = W.MAP;
    for (let cz = hz >> 4; cz <= (hz + N - 1) >> 4; cz++) for (let cx = hx >> 4; cx <= (hx + N - 1) >> 4; cx++) {
      const c = w.col ? w.col(cx, cz) : null, H = c && c.height;
      const x0 = Math.max(hx, cx << 4), x1 = Math.min(hx + N - 1, (cx << 4) + 15), z0 = Math.max(hz, cz << 4), z1 = Math.min(hz + N - 1, (cz << 4) + 15);
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const y = H ? H[((z & 15) << 4) | (x & 15)] : 0; out[(z - hz) * N + (x - hx)] = y > 255 ? 255 : y < 0 ? 0 : y; }
    }
    return out;
  };

  // ---- the drops from the eaves (main thread). g: the game; dt: seconds
  W.drips = function (g, dt) {
    const E = g.env && g.env.E, P = g.particles, w = g.world, p = g.player;
    if (!E || !P || !w || !p || !(E.wet > 0.25) || (g.settings && (g.settings.particles | 0) < 1)) { if (g._eaves) g._eaves.length = 0; return; }
    const R = VR.R, F = VR.F;
    g._eavesT = (g._eavesT || 0) - dt;
    if (g._eavesT <= 0 || !g._eaves) {
      g._eavesT = 2;
      const out = g._eaves || (g._eaves = []); out.length = 0;
      const px = Math.floor(p.pos[0]), py = Math.floor(p.pos[1]), pz = Math.floor(p.pos[2]);
      const solid = (s) => s && (R.T.flags[s] & F.SOLID) && !(R.T.flags[s] & F.LEAVES);
      for (let dz = -12; dz <= 12 && out.length < 48; dz++) for (let dx = -12; dx <= 12 && out.length < 48; dx++) {
        const x = px + dx, z = pz + dz;
        if (!w.isLoaded(x, z)) continue;
        // an eave: a solid block with air under it, open to the sky over it (its top is the roof's), with a wall or
        // ground within reach below — the drop has somewhere to fall to; within 10 blocks above or below the eye
        for (let y = py + 10; y >= py - 4; y--) {
          const s = w.getBlock(x, y, z);
          if (!solid(s)) continue;
          if (w.getBlock(x, y - 1, z) || w.getBlock(x, y + 1, z)) break;   // not an overhang (a wall under it, a stack)
          if (w.topAt && w.topAt(x, z) > y) break;                        // under something else: no rain on it
          // the roof's edge: open air beside it, where the drop falls (not the ceiling over a room)
          for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!w.getBlock(x + ox, y, z + oz) && !w.getBlock(x + ox, y - 1, z + oz)) { out.push([x + 0.5 + ox * 0.42, y, z + 0.5 + oz * 0.42, ox, oz]); break; }
          break;
        }
      }
    }
    const list = g._eaves; if (!list.length) return;
    const rate = E.wet * (E.rain > 0.05 ? 7 : 2.5) * dt;   // drops a second over all the eaves near the player
    for (let k = 0; k < list.length; k++) {
      if (Math.random() > rate / list.length * 3) continue;
      const e = list[k], a = Math.random() - 0.5;   // along the edge
      P.spawn(e[0] + (e[4] ? a * 0.8 : 0), e[1] - 0.02, e[2] + (e[3] ? a * 0.8 : 0), 0, -0.5, 0, { life: 1.6, size: 0.035, grav: 14, drag: 0.1, col: [0.78, 0.86, 0.95], emis: 0.05, alpha: 0.85 });
    }
  };
})(VR);
