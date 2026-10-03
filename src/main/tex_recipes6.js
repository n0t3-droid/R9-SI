// ============================================================================
// Texture recipes part 6 — the modern building set (v0.30): neutral Vollton
// bases (the colour is the block tint), panorama glass with connected frames
// (16 variants per style: frame only on the edges that do not join a neighbour),
// door materials (powder-coated black / anthracite, white lacquer, brushed
// steel, oak veneer, walnut slats, clear and frosted glass) and door item icons.
// ============================================================================
(function (VR) {
  'use strict';
  const TX = VR.TX, N = TX.N, C = TX.C, REC = VR.TEXREC, PRE = VR.TEXPRE, hh = TX.hash;
  const clamp = (v) => Math.max(0, Math.min(1, v));

  // ---- Vollton: almost white, seamless, so the tint shows the colour exactly (matte / lacquer gloss)
  const vollton = (seed, rough, noise) => {
    const img = new TX.Img(); img.noBevel = true;
    img.forEach((x, y, i) => {
      const n = (TX.fbm(x, y, 4, 2, seed) - 0.5) * noise + (hh(x, y, seed + 1) - 0.5) * noise * 0.5;
      const v = clamp(0.985 + n);
      img.set(x, y, [v, v, v], 1); img.h[i] = 0.5 + n * 1.5; img.ro[i] = rough;
    });
    return img;
  };
  REC.vollton_matte = () => vollton(6101, 0.84, 0.035);
  REC.vollton_gloss = () => vollton(6111, 0.12, 0.012);

  // ---- panorama glass: frame on the free edges, glass everywhere else
  const CTM = {
    black: { frame: 0x17191c, glass: 0x9fc6dc, a: 0.2 },
    white: { frame: 0xeeeee8, glass: 0x9fc6dc, a: 0.2 },
    anthracite: { frame: 0x3b4046, glass: 0x8db2c6, a: 0.26 },
    bronze: { frame: 0x5e4630, glass: 0xb4aea2, a: 0.3 },
    grid: { frame: 0x17191c, glass: 0x9fc6dc, a: 0.2, mullion: true },
    frosted: { frame: 0xa9aeb4, glass: 0xdde8ee, a: 0.86, frost: true },
    tinted: { frame: 0x17191c, glass: 0x2c3742, a: 0.6 },
  };
  PRE.ctm = (style, mask) => {
    const S = CTM[style] || CTM.black, m = (+mask) | 0, FW = 2;
    const top = !(m & 1), right = !(m & 2), bottom = !(m & 4), left = !(m & 8);
    const FR = C(S.frame), GL = C(S.glass);
    const img = new TX.Img(); img.noBevel = true;
    img.forEach((x, y, i) => {
      let fr = 99, mu = 99;
      if (top) fr = Math.min(fr, y); else mu = Math.min(mu, y);
      if (bottom) fr = Math.min(fr, N - 1 - y); else mu = Math.min(mu, N - 1 - y);
      if (left) fr = Math.min(fr, x); else mu = Math.min(mu, x);
      if (right) fr = Math.min(fr, N - 1 - x); else mu = Math.min(mu, N - 1 - x);
      if (fr < FW) {
        // the frame: a darker outer line and a lit inner bevel toward the glass
        img.set(x, y, TX.scale(FR, fr === 0 ? 0.86 : 1.06), 1); img.h[i] = fr === 0 ? 0.5 : 0.54; img.ro[i] = 0.45;
      } else if (S.mullion && mu < 1) {
        img.set(x, y, FR, 1); img.h[i] = 0.5; img.ro[i] = 0.45;
      } else {
        const n = S.frost ? (TX.fbm(x, y, 8, 2, 6201) - 0.5) * 0.08 + (hh(x, y, 6202) - 0.5) * 0.05 : (TX.fbm(x, y, 2, 2, 6203) - 0.5) * 0.03;
        img.set(x, y, TX.scale(GL, 1 + n), S.a + (S.frost ? n * 0.5 : 0)); img.h[i] = 0.5; img.ro[i] = S.frost ? 0.38 : 0.04;
        if (S.em) img.em[i] = S.em;
      }
    });
    return img;
  };

  // ---- door materials
  const flat = (hex, rough, noise, seed) => {
    const img = new TX.Img(); img.noBevel = true; const c = C(hex);
    img.forEach((x, y, i) => { const n = (TX.fbm(x, y, 8, 2, seed) - 0.5) * noise + (hh(x, y, seed + 3) - 0.5) * noise * 0.6; img.set(x, y, TX.scale(c, 1 + n), 1); img.h[i] = 0.5 + n; img.ro[i] = rough; });
    return img;
  };
  REC.mod_black = () => flat(0x1c1e21, 0.5, 0.05, 6301);
  REC.mod_white = () => flat(0xf1f0ec, 0.3, 0.02, 6302);
  REC.mod_anthracite = () => flat(0x393f44, 0.55, 0.07, 6303);
  REC.mod_steel = () => {
    const img = new TX.Img(); img.noBevel = true; const c = C(0xb9bdc2);
    img.forEach((x, y, i) => { const n = (TX.vnoise(x * 0.25, y * 6, 16, 6304) - 0.5) * 0.16 + (hh(x, y, 6305) - 0.5) * 0.04; img.set(x, y, TX.scale(c, 1 + n), 1); img.h[i] = 0.5 + n * 0.5; img.ro[i] = 0.22; });
    return img;
  };
  REC.mod_glass = () => { const img = new TX.Img(); img.noBevel = true; const c = C(0xa6cbe0); img.forEach((x, y, i) => { const n = (TX.fbm(x, y, 2, 2, 6306) - 0.5) * 0.04; img.set(x, y, TX.scale(c, 1 + n), 0.2); img.ro[i] = 0.04; }); return img; };
  REC.mod_glass_frosted = () => { const img = new TX.Img(); img.noBevel = true; const c = C(0xe8f0f3); img.forEach((x, y, i) => { const n = (TX.fbm(x, y, 8, 2, 6307) - 0.5) * 0.08 + (hh(x, y, 6308) - 0.5) * 0.05; img.set(x, y, TX.scale(c, 1 + n), 0.8 + n); img.ro[i] = 0.36; }); return img; };
  REC.mod_oak = () => {
    const img = new TX.Img(); img.noBevel = true; const P = TX.pal([0xae865a, 0xbd9667, 0xcaa474, 0xd6b282, 0xdfbd8e], 6);
    img.forEach((x, y, i) => { const g = TX.fbm(x * 2.2, y * 0.18, 8, 2, 6309) * 0.7 + Math.sin((x + TX.fbm(x, y, 4, 2, 6310) * 5) * 0.9) * 0.12; const f = clamp(0.42 + (g - 0.35) * 0.9); img.set(x, y, TX.ramp(P, Math.min(0.999, f)), 1); img.h[i] = 0.55 + g * 0.1; img.ro[i] = 0.45; });
    return img;
  };
  REC.mod_slat = () => {
    // four vertical walnut slats per block with dark shadow gaps
    const img = new TX.Img(); img.noBevel = true; const P = TX.pal([0x46291a, 0x573421, 0x6a432b, 0x7a5033, 0x87603e], 6);
    img.forEach((x, y, i) => {
      const lx = x % 8, s = Math.floor(x / 8);
      if (lx === 7) { img.set(x, y, C(0x1a1410), 1); img.h[i] = 0.15; img.ro[i] = 0.9; return; }
      const g = TX.fbm(x * 2.5, y * 0.2, 8, 2, 6311 + s * 7) * 0.7;
      let f = clamp(0.4 + hh(s, 0, 6312) * 0.2 + (g - 0.35) * 0.9);
      if (lx === 0) f *= 1.12; if (lx === 6) f *= 0.82;
      img.set(x, y, TX.ramp(P, Math.min(0.999, f)), 1); img.h[i] = lx === 0 || lx === 6 ? 0.55 : 0.7; img.ro[i] = 0.42;
    });
    return img;
  };

  // ---- door item icons: the whole door as a sprite
  const ICON = {
    door_glass_black: { frame: 0x1c1e21, fw: 1, glass: 0x9fc6dc, bar: 0xc8ccd2 },
    door_glass_white: { frame: 0xeeeee8, fw: 1, glass: 0x9fc6dc, lever: 0xb9bdc2 },
    door_pivot_anthracite: { panel: 0x3b4146, grooves: 0x1c1e21, bar: 0xc8ccd2 },
    door_slat_walnut: { panel: 0x6a432b, slats: 0x24180f, bar: 0x1c1e21 },
    door_flush_white: { panel: 0xf1f0ec, lever: 0x1c1e21, edge: 0xc8c6c0 },
    door_flush_oak: { panel: 0xc6a070, lever: 0x1c1e21, edge: 0x8e6c44 },
    door_strip_anthracite: { panel: 0x3b4146, strip: 0xe8f0f3, bar: 0xc8ccd2 },
    door_frosted_steel: { frame: 0xb9bdc2, fw: 1, glass: 0xe8f0f3, glassA: 0.95, lever: 0x9aa0a6 },
    door_loft_black: { frame: 0x1c1e21, fw: 1, glass: 0x9fc6dc, grid: true, lever: 0x1c1e21 },
  };
  PRE.door_icon = (id) => {
    const D = ICON[id] || ICON.door_flush_white;
    const img = TX.sprite();
    const X0 = 9, X1 = 22, Y0 = 1, Y1 = 30;
    for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
      const e = Math.min(x - X0, X1 - x, y - Y0, Y1 - y);
      let col, a = 1;
      if (D.frame !== undefined) {
        if (e < (D.fw || 1)) col = C(D.frame);
        else if (D.grid && ((y - Y0) % 8 === 0 || x === ((X0 + X1) >> 1))) col = C(D.frame);
        else { col = TX.mix(C(D.glass), [1, 1, 1], ((x + y) % 9 === 0) ? 0.5 : 0.1); a = D.glassA || 0.7; }
      } else {
        col = C(D.panel);
        if (D.slats && (x - X0) % 4 === 3) col = C(D.slats);
        if (D.grooves && (y - Y0) % 8 === 7) col = C(D.grooves);
        if (D.strip && x >= X0 + 2 && x <= X0 + 3 && y >= Y0 + 3 && y <= Y1 - 3) col = C(D.strip);
        if (e === 0) col = TX.scale(col, D.edge ? 0.8 : 0.75);
      }
      img.set(x, y, col, a); img.H(x, y, e === 0 ? 0.4 : 0.6);
    }
    if (D.bar) for (let y = Y0 + 6; y <= Y1 - 6; y++) img.set(X1 - 2, y, C(D.bar), 1);
    if (D.lever) { for (let x = X1 - 5; x <= X1 - 2; x++) img.set(x, 16, C(D.lever), 1); img.set(X1 - 2, 17, C(D.lever), 1); }
    TX.outline(img, 0.7);
    return img;
  };
})(VR);
