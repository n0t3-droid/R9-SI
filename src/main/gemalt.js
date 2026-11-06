// ============================================================================
// r-gemalt · Weiche Natur — the switch and the bodies on the drawn ground (plan docs/superpowers/plans/2026-11-07-r-gemalt.md;
// the mesh: src/shared/softnat.js; the paint: TERRAIN_* under GEMALT, shaders.js; the GL side: gemalt_gl.js).
//   gSoft  Weiche Natur (cost medium, mesh + one define): in the Nahtlos look all natural ground — grass, earth, sand,
//          gravel, snow, clay, moss, mud, the natural rocks and ores — is one sculpted, painted surface; man-made blocks
//          stay crisp cubes and the ground snaps to them. On from Balanced up (the default); Very Low and Low never (no
//          define, no program, the cube mesh). The look Klassisch brings every cube back.
// The bodies: physics keeps its blocks (and Nahtlos' height field); the drawn bodies (the player's figure, villagers,
// animals) are lifted or lowered onto the drawn surface by G.lift (at most ½ block), read from the column heights the
// mesh worker sends with each section (world.js s.softH).
// Pure but for G.lift (reads the world's sections).
// ============================================================================
(function (VR) {
  'use strict';
  const G = VR.Gemalt = VR.Gemalt || {};
  G.SW = ['gSoft'];
  const OFF = { gSoft: false }, ON = { gSoft: true };
  const TIERS = { potato: OFF, low: OFF, balanced: ON, high: ON, ultra: ON, ultraLite: ON };
  G.defaults = (preset) => Object.assign({}, TIERS[preset] || OFF);
  G.off = () => Object.assign({}, OFF);
  G.ROWS = [{ key: 'gSoft', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.gSoft', tip: 'g.set.gSoft.tip', cost: 'medium', def: false }];
  G.MAXLIFT = 0.5;
  // the mesh job's leaf mode with Weiche Natur: bit 5 (16) — the base mode as a number (bit 4, 8: the leaves not fancy)
  G.leafMode = (s, base) => {
    if (!(s && s.gSoft)) return base;
    const m = typeof base === 'number' ? base : (base ? 0 : 8);
    return m | 16;
  };
  // the shader define: the switch on and not the lite look (Very Low)
  G.shaderOn = (s) => !!(s && s.gSoft && !s.lite && s.preset !== 'potato');
  // ---- joined to q-art3's switches (game.js reads VR.QArt3.SW, .defaults, .off, .ROWS, .leafMode at load)
  const Q3 = VR.QArt3;
  if (Q3 && !Q3._gemalt) {
    Q3._gemalt = 1;
    for (const k of G.SW) if (!Q3.SW.includes(k)) Q3.SW.push(k);
    const d0 = Q3.defaults, o0 = Q3.off, l0 = Q3.leafMode;
    Q3.defaults = (p) => Object.assign(d0(p), G.defaults(p));
    Q3.off = () => Object.assign(o0(), G.off());
    Q3.ROWS = Q3.ROWS.concat(G.ROWS);
    Q3.leafMode = (s) => G.leafMode(s, l0(s));
  }
  if (VR.GL) { const prev = VR.GL.defineHook || null; VR.GL.defineHook = (name, defines) => { const d = prev ? prev(name, defines) : (defines || []); return name === 'terrain' && G.shaderOn(VR.game && VR.game.settings) && !d.includes('GEMALT') ? d.concat(['GEMALT']) : d; }; }

  // ---- the bodies on the drawn ground: the render offset at world (x, y, z) — y the feet — from the column heights of
  // the section(s) there (bilinear over the column centres, the nearest drawn top within a block of the feet); 0 where
  // nothing is drawn soft. hAt(world, x, z, y): the drawn height or NaN
  G.colH = function (world, X, Z, y) {
    if (!world || !world.cols) return NaN;
    const cx = Math.floor(X / 16), cz = Math.floor(Z / 16), c = world.cols.get(VR.ckey ? VR.ckey(cx, cz) : (cx + 32768) * 65536 + (cz + 32768));
    if (!c || !c.sec) return NaN;
    const lx = X - cx * 16, lz = Z - cz * 16, ti = lz * 16 + lx;
    let best = NaN, bd = 1.6;
    for (let sy = Math.floor((y - 2) / 16); sy <= Math.floor((y + 2) / 16); sy++) {
      const s = c.sec[sy]; if (!s || !s.softH) continue;
      const v = s.softH[ti]; if (v === -32768) continue;
      const h = v / 64, d = Math.abs(h - y); if (d < bd) { bd = d; best = h; }
    }
    return best;
  };
  G.hAt = function (world, x, z, y) {
    const fx = x - 0.5, fz = z - 0.5, x0 = Math.floor(fx), z0 = Math.floor(fz), tx = fx - x0, tz = fz - z0;
    let s = 0, w = 0;
    for (let k = 0; k < 4; k++) {
      const X = x0 + (k & 1), Z = z0 + (k >> 1), h = G.colH(world, X, Z, y);
      if (h !== h) continue;
      const wk = ((k & 1) ? tx : 1 - tx) * ((k >> 1) ? tz : 1 - tz) + 1e-4;
      s += h * wk; w += wk;
    }
    return w > 0 ? s / w : NaN;
  };
  G.lift = function (world, x, y, z) {
    const g = VR.game, st = g && g.settings;
    if (!st || !st.gSoft || (VR.LOOK && !VR.LOOK.ground)) return 0;
    const h = G.hAt(world || (g && g.world), x, z, y);
    if (h !== h) return 0;
    // (in the air — a jump, a fall — the lift fades out: a body more than a block above the drawn ground is drawn where it is)
    const d = h - y, a = Math.abs(d), f = a <= 0.6 ? 1 : a >= 1.2 ? 0 : 1 - (a - 0.6) / 0.6;
    return (d > G.MAXLIFT ? G.MAXLIFT : d < -G.MAXLIFT ? -G.MAXLIFT : d) * f;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
