// ============================================================================
// Texture recipes part 2: plants, flowers, crops, fungi, aquatic, functional,
// volt components, fluids & fire animation, crystals, Starforge sci-fi set
// ============================================================================
(function (VR) {
  'use strict';
  const TX = VR.TX, N = TX.N, C = TX.C, REC = VR.TEXREC, PRE = VR.TEXPRE, PAL = VR.PAL, WOOD = VR.WOODPAL;
  const hh = TX.hash;
  const K = TX.chunky;   // Klassisch: built chunky (16×16-style texels)
  const GL8 = [0x2d2d2d, 0x505050, 0x7a7a7a, 0xa6a6a6, 0xcccccc];   // grayscale (tinted) greens
  const stem = (img, x, y0, y1, col, w) => { for (let y = y0; y <= y1; y++) { TX.dot(img, x, y, col, 0.6); if (w) TX.dot(img, x + 1, y, TX.scale(col, 0.8), 0.6); } };
  const leafAt = (img, x, y, dir, col, len) => { for (let i = 0; i < (len || 4); i++) { TX.dot(img, x + dir * i, y - (i >> 1), TX.scale(col, 0.9 + i * 0.04)); TX.dot(img, x + dir * i, y - (i >> 1) + 1, TX.scale(col, 0.75)); } };

  // ---------------- grass & soil tops ----------------
  REC.grass_top = () => { const img = TX.natural([0x5c5c5c, 0x7e7e7e, 0x9c9c9c, 0xb8b8b8], { period: 8, oct: 3, seed: 2001, contrast: 1.1, speck: 0.08, speck2: 0.05, rough: 0.9 }); return K(img); };
  function sideWithFringe(base, fringeCol, depth, tintMask, seed) {
    const img = base.clone();
    const P = typeof fringeCol[0] === 'number' && fringeCol.length > 3 ? TX.pal(fringeCol, 4) : null;
    for (let x = 0; x < N; x++) {
      const d = depth + Math.floor(hh(x, 0, seed) * 4) + (x % 3 === 0 ? 2 : 0);
      for (let y = 0; y < d; y++) {
        const c = P ? TX.ramp(P, 0.3 + hh(x, y, seed + 1) * 0.6) : TX.scale(fringeCol, 0.85 + hh(x, y, seed) * 0.3);
        img.set(x, y, c, tintMask ? 1 : 1); img.H(x, y, 0.8);
      }
      if (tintMask) for (let y = d; y < N; y++) img.alpha(x, y, 0);
    }
    return img;
  }
  REC.grass_side = () => sideWithFringe(REC.dirt(), GL8, 5, true, 2003);
  REC.grass_snow_side = () => { const img = sideWithFringe(REC.dirt(), [0xdfe8f0, 0xeef4fa, 0xfafdff, 0xffffff], 7, false, 2005); img.forEach((x, y, i) => img.alpha(x, y, 1)); return img; };
  REC.mycelium_top = () => { const img = TX.natural([0x5a4a5c, 0x6f5d72, 0x857289, 0x9a879c], { period: 6, oct: 3, seed: 2007, speck: 0.1, speck2: 0.05 }); return K(img); };
  REC.mycelium_side = () => sideWithFringe(REC.dirt(), [0x5a4a5c, 0x6f5d72, 0x857289, 0x9a879c], 4, false, 2009);
  REC.podzol_top = () => K(TX.natural([0x4a3218, 0x5f4220, 0x76552c, 0x8a6938], { period: 6, oct: 3, seed: 2011, speck: 0.12, speck2: 0.06 }));
  REC.podzol_side = () => sideWithFringe(REC.dirt(), [0x4a3218, 0x5f4220, 0x76552c, 0x8a6938], 4, false, 2013);
  REC.dirt_path_top = () => K(TX.natural([0x7a5f38, 0x8f7244, 0xa38552, 0xb49763], { period: 6, oct: 2, seed: 2015, contrast: 1.0, speck: 0.05 }));
  REC.dirt_path_side = () => { const img = sideWithFringe(REC.dirt(), [0x7a5f38, 0x8f7244, 0xa38552, 0xb49763], 3, false, 2017); for (let x = 0; x < N; x++) img.alpha(x, 0, 0), img.alpha(x, 1, 0); return img; };
  REC.farmland = () => { const img = TX.natural([0x5a3d22, 0x6e4c2c, 0x805a36], { period: 4, oct: 2, seed: 2019 }); for (let y = 0; y < N; y++) if (y % 8 < 2) for (let x = 0; x < N; x++) { img.mul(x, y, 0.7); img.H(x, y, 0.3); } return K(img); };
  REC.farmland_wet = () => { const img = REC.farmland(); img.forEach((x, y, i) => { img.mul(x, y, 0.62); img.ro[i] = 0.35; }); return img; };
  const mycelTop = (pal, s) => K(TX.natural(pal, { period: 6, oct: 3, seed: s, speck: 0.14, speck2: 0.08, contrast: 1.4 }));
  REC.crimson_mycel = () => mycelTop([0x5a0e14, 0x86161e, 0xa8242a, 0xc83a36], 2021);
  REC.crimson_mycel_side = () => sideWithFringe(REC.emberrock(), [0x5a0e14, 0x86161e, 0xa8242a, 0xc83a36], 4, false, 2023);
  REC.teal_mycel = () => mycelTop([0x0e4a44, 0x166a60, 0x22887a, 0x36a898], 2025);
  REC.teal_mycel_side = () => sideWithFringe(REC.emberrock(), [0x0e4a44, 0x166a60, 0x22887a, 0x36a898], 4, false, 2027);
  REC.moss = () => K(TX.natural(PAL.moss, { period: 6, oct: 3, seed: 2029, speck: 0.08, speck2: 0.06, rough: 0.95 }));
  REC.pale_moss = () => K(TX.natural(PAL.palemoss, { period: 6, oct: 3, seed: 2031, speck: 0.08, rough: 0.95 }));
  REC.echo_moss = () => { const img = TX.natural(PAL.echo, { period: 5, oct: 3, seed: 2033, contrast: 1.5 }); img.forEach((x, y, i) => { if (hh(x, y, 2034) < 0.03) { img.set(x, y, C(0x3ae0e8)); img.em[i] = 0.8; } }); return K(img); };
  REC.skyroot_soil = () => { const img = TX.natural([0x3e2a4a, 0x523a60, 0x684c78, 0x7c5e8c], { period: 5, oct: 3, seed: 2035, speck: 0.06 }); for (let k = 0; k < 6; k++) { let x = hh(k, 1, 2036) * N; for (let y = 0; y < N; y++) { x += Math.sin(y * 0.4 + k) * 0.6; TX.dot(img, Math.floor(x), y, C(0x8a6a4a), 0.7); } } return K(img); };

  // ---------------- realm rocks ----------------
  PAL.dusk = [0x2e2438, 0x42344f, 0x584669, 0x6f5a82];
  PAL.ochre = [0x7a3a14, 0x9c4f1c, 0xbd6a2a, 0xd8883c];
  REC.duskrock = () => K(TX.natural(PAL.dusk, { period: 4, oct: 3, seed: 2041, speck: 0.05, speck2: 0.03, contrast: 1.3 }));
  REC.polished_duskrock = () => TX.polished(PAL.dusk, { seed: 2042 });
  REC.duskrock_bricks = () => TX.bricks(PAL.dusk, 0x1c1624, { rows: 4, per: 2, seed: 2043 });
  REC.ochre_rock = () => K(TX.natural(PAL.ochre, { period: 4, oct: 3, bands: 1.1, bandWarp: 3, seed: 2044, contrast: 1.2 }));
  REC.ember_ochre = () => K(TX.natural([0x5a1c10, 0x7e2a16, 0xa03a1e, 0xc0522a], { period: 4, oct: 3, bands: 0.8, bandWarp: 3, seed: 2045, contrast: 1.2 }));
  REC.umber_rock = () => K(TX.natural([0x3c2a20, 0x523a2c, 0x684c3a, 0x7c5e48], { period: 4, oct: 3, seed: 2046, speck: 0.05, contrast: 1.2 }));
  REC.ochre_bricks = () => TX.bricks(PAL.ochre, 0x3a1a0a, { rows: 4, per: 2, seed: 2047 });
  // duskrock shot through with thin glowing aether cracks (the Mountain Station's peaks)
  REC.dusk_aether = () => { const img = REC.duskrock(); img.forEach((x, y, i) => { const v = Math.abs(Math.sin(x * 0.35 + y * 0.12 + TX.fbm(x, y, 4, 3, 2049) * 6)); if (v < 0.09) { img.set(x, y, TX.mix(C(0x7af4ff), C(0x2a90e0), v * 11)); img.em[i] = 0.85 - v * 4; img.ro[i] = 0.2; } }); return img; };
  REC.aether_stone = () => { const img = REC.stone(); img.forEach((x, y, i) => { const v = Math.abs(Math.sin(x * 0.4 + TX.fbm(x, y, 4, 3, 2048) * 7)); if (v < 0.13) { img.set(x, y, TX.mix(C(0x6af0ff), C(0x2aa0ff), v * 7)); img.em[i] = 0.9 - v * 3; img.ro[i] = 0.2; } }); return img; };
  // crystals
  const CRY = { violet: [0x3a1470, 0x6a2ab8, 0xa060f0, 0xe0c0ff], azure: [0x0a3a7a, 0x1a6ad0, 0x4aaaf8, 0xc8f0ff], verdant: [0x0a5a24, 0x18a040, 0x4ae070, 0xc8ffd8], rose: [0x6a0a3a, 0xb81a6a, 0xf05aa0, 0xffd0e8], amber: [0x7a3a04, 0xc86a0a, 0xf8a82a, 0xfff0b0] };
  VR.CRYSTAL_PAL = CRY;
  PRE.crystal_block = (c) => { const img = TX.gem(CRY[c], { cells: 3, glow: 0.35, seed: 2050 + c.length }); img.forEach((x, y, i) => { img.em[i] = Math.max(img.em[i], 0.25); }); return img; };
  PRE.crystal = (c) => { const img = new TX.Img(); const P = TX.pal(CRY[c], 6); img.forEach((x, y, i) => { const f = 0.35 + (x % 16) / 16 * 0.4 + (1 - y / N) * 0.25 + (hh(x >> 2, y >> 3, 7) - 0.5) * 0.2; img.set(x, y, TX.ramp(P, Math.max(0, Math.min(0.999, f))), 1); img.em[i] = 0.55 + f * 0.4; img.ro[i] = 0.05; img.h[i] = f; if (x % 8 === 0) img.mul(x, y, 1.25); }); return img; };
  REC.aether_still = () => { const img = TX.natural([0x0a5aa0, 0x1a90e0, 0x4ad0ff, 0xb0f4ff], { period: 4, oct: 3, seed: 2060, rough: 0.05 }); img.forEach((x, y, i) => { img.em[i] = 0.8; img.alpha(x, y, 0.8); }); return img; };

  // ---------------- Starforge sci-fi ----------------
  const HULL = { white: [0xb8bcc2, 0xd4d8dc, 0xe8ebee, 0xf6f8fa], gray: [0x5e636a, 0x777d85, 0x90969e, 0xa8aeb5], dark: [0x1e2228, 0x2a2f36, 0x363c44, 0x444b54] };
  PRE.hull = (c) => {
    const img = TX.metal(HULL[c], { rough: c === 'dark' ? 0.45 : 0.35, seed: 2070 + c.length });
    // panel seams
    for (let i = 0; i < N; i++) { img.mul(i, 16, 0.72); img.H(i, 16, 0.2); img.mul(16, i, 0.78); img.H(16, i, 0.2); }
    for (const [x, y] of [[3, 3], [28, 3], [3, 28], [28, 28], [19, 3], [3, 19]]) { img.mul(x, y, 0.6); img.mul(x + 1, y, 1.2); }
    return img;
  };
  PRE.hull_stripe = (c) => { const img = PRE.hull('white'); const col = c === 'orange' ? C(0xf07a1a) : C(0x2a7af0); for (let y = 0; y < N; y++) for (let x = 11; x < 21; x++) { img.set(x, y, TX.scale(col, x === 11 || x === 20 ? 0.8 : 1)); img.ro[y * N + x] = 0.3; } return img; };
  PRE.tech_panel = (c) => {
    const img = PRE.hull('dark');
    const col = { cyan: C(0x3af0ff), amber: C(0xffb02a), violet: C(0xc06aff) }[c];
    for (let k = 0; k < 7; k++) { const y = 4 + k * 4; const len = 4 + Math.floor(hh(k, 1, 2080) * 16); const x0 = 3 + Math.floor(hh(k, 2, 2080) * 6); for (let x = x0; x < Math.min(29, x0 + len); x++) { img.set(x, y, col); img.em[y * N + x] = 1; } }
    for (const [x, y] of [[25, 5], [27, 5], [25, 9], [27, 9]]) { img.set(x, y, TX.scale(col, 0.8)); img.em[y * N + x] = 1; }
    return img;
  };
  PRE.neon = (c) => { const col = C({ cyan: 0x3af8ff, magenta: 0xff3ae0, amber: 0xffb62a, lime: 0x9aff3a, white: 0xf4f6ff }[c]); const img = new TX.Img(); img.forEach((x, y, i) => { const e = Math.min(x, y, N - 1 - x, N - 1 - y); const f = e < 2 ? 0.6 : 1 - (hh(x, y, 5) * 0.08); img.set(x, y, TX.scale(TX.mix(col, [1, 1, 1], e > 5 ? 0.35 : 0.1), f), 1); img.em[i] = e < 2 ? 0.4 : 1; img.ro[i] = 0.1; img.h[i] = e < 2 ? 0.3 : 0.7; }); return img; };
  REC.light_panel = () => { const img = new TX.Img(); img.forEach((x, y, i) => { const e = Math.min(x, y, N - 1 - x, N - 1 - y); img.set(x, y, e < 2 ? C(0x8a9098) : C(0xf4f8ff), 1); img.em[i] = e < 2 ? 0 : 1; }); return img; };
  REC.vent = () => { const img = PRE.hull('gray'); for (let y = 4; y < 28; y++) if (y % 4 < 2) for (let x = 4; x < 28; x++) { img.set(x, y, C(0x15181c)); img.H(x, y, 0.1); } return img; };
  REC.metal_grate = () => { const img = PRE.hull('gray'); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { if ((x % 6 >= 2) && (y % 6 >= 2)) img.alpha(x, y, 0); } return img; };
  REC.landing_pad = () => { const img = TX.tiles(HULL.dark, 0x101216, 2, { seed: 2090, rough: 0.5 }); for (let i = 3; i < 29; i++) { img.set(i, 3, C(0xf0c030)); img.set(3, i, C(0xf0c030)); } return img; };
  REC.hazard = () => { const img = new TX.Img(); img.forEach((x, y, i) => { const s = Math.floor((x + y) / 6) % 2; img.set(x, y, s ? C(0x1a1a1a) : C(0xf2c42a), 1); img.ro[i] = 0.5; }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.15, 0.2); return img; };
  REC.reactor_core = () => { const img = new TX.Img(); img.forEach((x, y, i) => { const d = Math.hypot(x - 15.5, y - 15.5); const ring = Math.abs(Math.sin(d * 0.9)); const f = Math.max(0, 1 - d / 17); img.set(x, y, TX.mix(C(0x0a3a6a), C(0xaaf8ff), f * (0.6 + ring * 0.4)), 1); img.em[i] = 0.4 + f * 0.6; img.ro[i] = 0.2; }); for (let i = 0; i < N; i++) { img.set(i, 0, C(0x444b54)); img.set(i, N - 1, C(0x444b54)); img.set(0, i, C(0x444b54)); img.set(N - 1, i, C(0x444b54)); img.em[i] = 0; } return img; };
  REC.viewport = () => { const img = TX.glass(0x3a4048, 0x7ab8ff, { alpha: 0.22, frameA: 1, streakA: 0.5, double: true }); return img; };
  REC.forcefield = () => { const img = new TX.Img(); img.forEach((x, y, i) => { const hex = Math.abs(Math.sin(x * 0.55) * Math.sin(y * 0.55 + (x % 2) * 0.5)); img.set(x, y, C(0x4ac8ff), 0.18 + (hex > 0.92 ? 0.5 : 0)); img.em[i] = 0.8; }); return img; };
  REC.cargo_side = () => { const img = PRE.hull('gray'); for (let y = 0; y < N; y++) for (const x of [6, 7, 24, 25]) img.mul(x, y, 0.75); return img; };
  REC.cargo_front = () => { const img = REC.cargo_side(); for (let y = 12; y < 20; y++) for (let x = 12; x < 20; x++) img.set(x, y, C(0xf07a1a)); return img; };
  REC.cargo_top = () => PRE.hull('gray');
  REC.conduit_pipe = () => { const img = TX.metal(HULL.gray, { rough: 0.35 }); return img; };
  REC.conduit_glow = () => { const img = TX.flat(0x5af0ff, { noise: 0.1 }); img.em.fill(1); return img; };
  REC.console_side = () => PRE.hull('dark');
  REC.console_desk = () => { const img = PRE.hull('dark'); const cols = [0xff3a3a, 0x3aff6a, 0xffd23a, 0x3ac8ff]; for (let k = 0; k < 10; k++) { const x = 4 + (k % 5) * 5, y = 6 + Math.floor(k / 5) * 12; for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 3; dy++) { img.set(x + dx, y + dy, C(cols[k % 4])); img.em[(y + dy) * N + x + dx] = 0.9; } } return img; };
  REC.console_screen = () => { const img = new TX.Img(); img.forEach((x, y, i) => { const e = Math.min(x, y, N - 1 - x, N - 1 - y); let c = C(0x06202a); if (e < 2) c = C(0x2a2f36); else { if (y % 5 === 0 && x > 4 && x < 4 + hh(y, 1, 3) * 24) c = C(0x5af0ff); if (Math.abs(y - 20 - Math.sin(x * 0.4) * 5) < 1) c = C(0x9aff6a); } img.set(x, y, c, 1); img.em[i] = e < 2 ? 0 : 0.95; img.ro[i] = 0.1; }); return img; };
  REC.seat = () => TX.wool(0x2a3a5a, { seed: 2101 });
  REC.helm_top = () => { const img = PRE.hull('dark'); TX.disc(img, 15.5, 15.5, 11, (d) => d > 0.85 ? C(0x7a8088) : null); for (let a = 0; a < 6; a++) TX.line(img, 16, 16, Math.round(16 + Math.cos(a * 1.047) * 10), Math.round(16 + Math.sin(a * 1.047) * 10), (x, y) => TX.dot(img, x, y, C(0x9aa0a8))); TX.disc(img, 15.5, 15.5, 3, () => C(0x5af0ff)); for (let i = 0; i < N * N; i++) if (img.c[i * 4 + 1] > 0.8 && img.c[i * 4] < 0.5) img.em[i] = 1; return img; };
  REC.thruster_side = () => { const img = PRE.hull('gray'); for (let y = 0; y < N; y++) for (let x = 0; x < N; x += 5) img.mul(x, y, 0.78); return img; };
  REC.thruster_nozzle = () => { const img = new TX.Img(); img.forEach((x, y, i) => { const d = Math.hypot(x - 15.5, y - 15.5); img.set(x, y, d > 13 ? C(0x5e636a) : C(0x15181c).map((v, k) => v + Math.max(0, (8 - d)) * 0.01), 1); img.ro[i] = 0.3; }); return img; };
  REC.thruster_glow = () => { const img = new TX.Img(); img.forEach((x, y, i) => { const d = Math.hypot(x - 15.5, y - 15.5) / 16; img.set(x, y, TX.mix(C(0xfffae0), C(0xff6a1a), d), 1); img.em[i] = 1; }); return img; };
  REC.launch_beacon_top = () => { const img = PRE.hull('dark'); TX.disc(img, 15.5, 15.5, 8, (d) => TX.mix(C(0xfff0a0), C(0xff5a1a), d)); for (let i = 0; i < N * N; i++) if (img.c[i * 4] > 0.9) img.em[i] = 1; return img; };

  // ---------------- plants ----------------
  REC.short_grass = () => TX.blades(GL8, { count: 16, minH: 8, varH: 16, seed: 2201 });
  REC.tall_grass_bottom = () => TX.blades(GL8, { count: 18, minH: 30, varH: 4, seed: 2202 });
  REC.tall_grass_top = () => TX.blades(GL8, { count: 14, minH: 8, varH: 20, seed: 2203 });
  const fernSprite = (seed, tall) => { const img = TX.sprite(), P = TX.pal(GL8, 5); for (let k = 0; k < 5; k++) { const a = -1.2 + k * 0.6 + (hh(k, 1, seed) - 0.5) * 0.3; let x = 16, y = 31; const len = tall ? 30 : 20 + hh(k, 2, seed) * 8; for (let t = 0; t < len; t++) { x += Math.sin(a) * 0.55; y -= Math.cos(a) * 0.9 - t * 0.012; TX.dot(img, Math.round(x), Math.round(y), TX.ramp(P, 0.4 + t / len * 0.5)); if (t % 2 === 0 && t > 3) { TX.dot(img, Math.round(x - 1), Math.round(y + 1), TX.ramp(P, 0.5)); TX.dot(img, Math.round(x + 1), Math.round(y + 1), TX.ramp(P, 0.6)); } } } return img; };
  REC.fern = () => fernSprite(2204);
  REC.large_fern_bottom = () => fernSprite(2205, true);
  REC.large_fern_top = () => fernSprite(2206);
  REC.bush = () => { const img = TX.sprite(); const P = TX.pal(GL8, 5); for (let k = 0; k < 60; k++) { const x = 4 + hh(k, 1, 2207) * 24, y = 8 + hh(k, 2, 2207) * 24; TX.disc(img, x, y, 2 + hh(k, 3, 2207) * 1.5, (d) => TX.ramp(P, 0.3 + (1 - d) * 0.6)); } return img; };
  REC.dead_bush = () => { const img = TX.sprite(); const col = C(0x8a6a3a); const br = (x, y, a, len, dep) => { let px = x, py = y; for (let t = 0; t < len; t++) { px += Math.sin(a); py -= Math.cos(a); TX.dot(img, Math.round(px), Math.round(py), TX.scale(col, 0.8 + t / len * 0.3)); } if (dep < 3) { br(px, py, a - 0.5, len * 0.6, dep + 1); br(px, py, a + 0.5, len * 0.6, dep + 1); } }; br(16, 31, 0, 10, 0); return img; };
  REC.short_dry_grass = () => TX.blades([0x6a5a3a, 0x8a7a50, 0xaa9a68, 0xc8b884], { count: 12, minH: 8, varH: 12, seed: 2208, lean: 0.9 });
  REC.tall_dry_grass = () => TX.blades([0x6a5a3a, 0x8a7a50, 0xaa9a68, 0xc8b884], { count: 16, minH: 14, varH: 16, seed: 2209, lean: 0.8 });
  REC.red_shrub = () => { const img = REC.bush(); img.forEach((x, y, i) => { if (img.ga(x, y) > 0.5) img.set(x, y, TX.mix(C(0x6a0e0e), C(0xd8342a), TX.lum(img.get(x, y)))); }); return img; };
  REC.firefly_bush = () => { const img = REC.bush(); img.forEach((x, y, i) => { if (img.ga(x, y) > 0.5) img.set(x, y, TX.mix(C(0x1a3a14), C(0x5a8a3a), TX.lum(img.get(x, y)))); if (hh(x, y, 2210) < 0.012 && img.ga(x, y) > 0.5) { img.set(x, y, C(0xf8ff8a)); img.em[i] = 1; } }); return img; };
  const hanging = (pal, seed, n) => { const img = TX.sprite(), P = TX.pal(pal, 4); for (let k = 0; k < (n || 7); k++) { let x = 3 + hh(k, 1, seed) * 26; const len = 10 + hh(k, 2, seed) * 22; for (let y = 0; y < len; y++) { x += (hh(k, y, seed) - 0.5) * 0.6; TX.dot(img, Math.round(x), y, TX.ramp(P, 1 - y / len * 0.7)); } } return img; };
  REC.hanging_roots = () => hanging([0x5a4028, 0x7a5a3a, 0x9a7a52], 2211);
  REC.pale_hanging_moss = () => hanging([0x7a8274, 0x9aa294, 0xbac0b2], 2212, 9);
  REC.leaf_litter = () => { const img = TX.sprite(); const P = TX.pal([0x5a4a2a, 0x8a6a3a, 0xb08a4a, 0xd0aa60], 4); for (let k = 0; k < 40; k++) { const x = hh(k, 1, 2213) * N, y = hh(k, 2, 2213) * N; TX.disc(img, x, y, 1.6 + hh(k, 3, 2213), (d) => TX.ramp(P, 0.2 + hh(k, 4, 2213) * 0.7)); } return img; };
  REC.azalea_top = () => { const img = TX.natural([0x3d5a1c, 0x587a28, 0x76983a, 0x92b24e], { period: 6, oct: 2, seed: 2214 }); return K(img); };
  REC.azalea_side = () => { const img = TX.leaves([0x3d5a1c, 0x587a28, 0x76983a, 0x92b24e], { seed: 2215, holes: 0.15 }); for (let y = 16; y < N; y++) for (let x = 0; x < N; x++) img.alpha(x, y, 0); return img; };
  REC.flowering_azalea_top = () => { const img = REC.azalea_top(); for (let k = 0; k < 14; k++) TX.disc(img, hh(k, 1, 2216) * 32, hh(k, 2, 2216) * 32, 1.8, () => C(0xd66ad8)); return img; };
  REC.flowering_azalea_side = () => { const img = REC.azalea_side(); for (let k = 0; k < 8; k++) TX.disc(img, hh(k, 1, 2217) * 32, hh(k, 2, 2217) * 14, 1.5, () => C(0xd66ad8)); return img; };
  REC.azalea_plant = () => { const img = TX.sprite(); stem(img, 15, 14, 31, C(0x6a4a2a), true); stem(img, 11, 18, 31, C(0x6a4a2a)); stem(img, 20, 20, 31, C(0x6a4a2a)); return img; };
  REC.cactus_side = () => { const img = new TX.Img(); const P = TX.pal([0x1e4a14, 0x2e6a1e, 0x3e8a28, 0x5aa83a], 5); img.forEach((x, y, i) => { const rib = Math.sin(x / N * Math.PI * 8); img.set(x, y, TX.ramp(P, 0.4 + rib * 0.3 + (hh(x, y, 5) - 0.5) * 0.1), 1); img.h[i] = 0.5 + rib * 0.3; if (x % 8 === 4 && y % 6 === 2) { img.set(x, y, C(0xe8e0b0)); img.H(x, y, 1); } }); img.forEach((x, y) => { if (x < 2 || x > 29) img.alpha(x, y, 0); }); return img; };
  REC.cactus_top = () => { const img = REC.cactus_side(); img.forEach((x, y) => img.alpha(x, y, 1)); TX.disc(img, 15.5, 15.5, 5, () => C(0x5aa83a)); return img; };
  REC.cactus_bottom = () => REC.cactus_top();
  REC.bamboo_stalk = () => { const img = new TX.Img(); img.forEach((x, y, i) => { const f = 0.5 + Math.sin((x % 6) / 6 * Math.PI) * 0.3; img.set(x, y, TX.mix(C(0x3a6a14), C(0x8ab84a), f), 1); if (y % 16 === 0) img.mul(x, y, 0.6); }); return img; };
  REC.bamboo_top = () => { const img = new TX.Img(); img.forEach((x, y) => img.set(x, y, C(0xd8c878), 1)); return img; };
  REC.bamboo_shoot = () => { const img = TX.sprite(); stem(img, 15, 18, 31, C(0x5a8a2a), true); leafAt(img, 17, 20, 1, C(0x7aaa3a), 6); leafAt(img, 14, 22, -1, C(0x7aaa3a), 6); return img; };
  const bambooLeaves = (n, s) => { const img = TX.sprite(); for (let k = 0; k < n; k++) { const x = 4 + hh(k, 1, s) * 24, y = 2 + hh(k, 2, s) * 20, dir = hh(k, 3, s) > 0.5 ? 1 : -1; leafAt(img, Math.round(x), Math.round(y), dir, TX.mix(C(0x3a7a1a), C(0x8ac84a), hh(k, 4, s)), 7); } return img; };
  REC.bamboo_leaves_small = () => bambooLeaves(6, 2218);
  REC.bamboo_leaves_large = () => bambooLeaves(12, 2219);
  REC.big_dripleaf_top = () => { const img = new TX.Img(); img.forEach((x, y, i) => { const d = Math.hypot(x - 15.5, y - 15.5); const vein = Math.abs(Math.sin(Math.atan2(y - 15.5, x - 15.5) * 5)) < 0.1; img.set(x, y, TX.mix(C(0x3a7a1a), C(0x7ac03a), 1 - d / 22), d < 16 ? 1 : 0); if (vein) img.mul(x, y, 1.2); }); return img; };
  REC.big_dripleaf_side = () => TX.flat(0x3a7a1a);
  REC.big_dripleaf_stem = () => { const img = TX.sprite(); stem(img, 15, 0, 31, C(0x4a8a24), true); return img; };
  REC.small_dripleaf = () => { const img = TX.sprite(); stem(img, 15, 12, 31, C(0x4a8a24)); for (const [x, y, d] of [[16, 12, 1], [15, 16, -1], [16, 20, 1]]) leafAt(img, x, y, d, C(0x6ab03a), 8); return img; };
  REC.mangrove_propagule = () => { const img = TX.sprite(); stem(img, 15, 8, 31, C(0x5a8a3a), true); TX.disc(img, 16, 6, 4, () => C(0x7ab04a)); return img; };
  REC.mangrove_roots = () => { const img = TX.sprite(); const col = C(0x5a3e2a); for (let k = 0; k < 6; k++) { let x = hh(k, 1, 2220) * N; for (let y = 0; y < N; y++) { x += Math.sin(y * 0.3 + k * 2) * 0.8; TX.dot(img, Math.floor(x), y, col); TX.dot(img, Math.floor(x) + 1, y, TX.scale(col, 0.8)); } } for (let k = 0; k < 4; k++) { const y = hh(k, 2, 2220) * N; for (let x = 0; x < N; x++) if (hh(x, k, 3) > 0.3) TX.dot(img, x, Math.floor(y + Math.sin(x * 0.3) * 2), col); } return img; };
  REC.mangrove_roots_top = () => REC.mangrove_roots();
  REC.muddy_mangrove_roots = () => { const img = REC.mud(); const r = REC.mangrove_roots(); img.forEach((x, y) => { if (r.ga(x, y) > 0.5) img.set(x, y, r.get(x, y)); }); return img; };
  REC.muddy_mangrove_roots_top = () => REC.muddy_mangrove_roots();
  REC.resin_clump = () => { const img = TX.sprite(); for (let k = 0; k < 5; k++) TX.disc(img, 8 + hh(k, 1, 2221) * 16, 8 + hh(k, 2, 2221) * 16, 3 + hh(k, 3, 2221) * 2, (d) => TX.mix(C(0xf8a83a), C(0xa84a0a), d)); return img; };
  REC.vine = () => { const img = TX.sprite(); const P = TX.pal(GL8, 5); for (let k = 0; k < 8; k++) { let x = 2 + k * 4; for (let y = 0; y < N; y++) { x += Math.sin(y * 0.35 + k) * 0.5; TX.dot(img, Math.round(x), y, TX.ramp(P, 0.4)); if ((y + k) % 5 === 0) { TX.disc(img, x + 1.5, y, 1.8, () => TX.ramp(P, 0.7)); } } } return img; };
  REC.pale_heart = () => { const img = PRE.log('pale_oak'); for (let y = 10; y < 22; y++) for (let x = 12; x < 20; x++) img.set(x, y, TX.scale(C(0x3a2a20), 0.8 + hh(x, y, 1) * 0.3)); return img; };
  REC.pale_heart_awake = () => { const img = REC.pale_heart(); for (let y = 12; y < 20; y++) for (let x = 14; x < 18; x++) { img.set(x, y, C(0xff8a1a)); img.em[y * N + x] = 1; } return img; };
  REC.pale_heart_top = () => PRE.log_top('pale_oak');
  REC.spore_blossom = () => { const img = TX.sprite(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; TX.line(img, 16, 4, Math.round(16 + Math.cos(a) * 12), Math.round(4 + Math.abs(Math.sin(a)) * 20 + 6), (x, y) => TX.dot(img, x, y, C(0xd84a8a))); } TX.disc(img, 16, 4, 4, () => C(0xf07ab0)); return img; };
  REC.spore_blossom_base = () => { const img = TX.sprite(); TX.disc(img, 16, 16, 10, (d) => TX.mix(C(0x5aa83a), C(0x2a6a1a), d)); return img; };
  // saplings: species-colored mini trees
  PRE.sapling = (w) => {
    const img = TX.sprite(), P = WOOD[w] || { bark: [0x9a9a92, 0x8a8a82, 0x7e7e76] };
    const leafCols = { oak: 0x4a8a2a, spruce: 0x2a5a3a, birch: 0x6aa04a, jungle: 0x2a8a1a, acacia: 0x7a9a2a, dark_oak: 0x2a5a1a, cherry: 0xf0a0c8, pale_oak: 0x9aa292, poplar: 0xe8b830, palm: 0x3aa040 };
    if (w === 'palm') { stem(img, 15, 12, 31, C(0x8a8a82), true); for (let k = 0; k < 7; k++) { const a = -Math.PI * 0.95 + k / 6 * Math.PI * 0.9; TX.line(img, 16, 12, Math.round(16 + Math.cos(a) * 12), Math.round(12 + Math.sin(a) * 10 + 6), (x, y) => TX.dot(img, x, y, C(k & 1 ? 0x3aa040 : 0x56c05a))); } TX.outline(img, 0.7); return img; }
    stem(img, 15, 14, 31, C(P.bark[2]), true);
    for (let k = 0; k < 18; k++) TX.disc(img, 10 + hh(k, 1, 2230 + w.length) * 12, 4 + hh(k, 2, 2230 + w.length) * 14, 2.2, (d) => TX.scale(C(leafCols[w] || 0x4a8a2a), 0.75 + (1 - d) * 0.4));
    TX.outline(img, 0.7);
    return img;
  };
  // ---------------- flowers ----------------
  function flower(o) {
    const img = TX.sprite();
    const stemCol = C(o.stem || 0x3a7a2a);
    const top = o.top === undefined ? 12 : o.top;
    stem(img, 15, top, 31, stemCol, true);
    if (o.leaves !== false) { leafAt(img, 17, 25, 1, TX.scale(stemCol, 1.15), 6); leafAt(img, 14, 22, -1, TX.scale(stemCol, 1.15), 5); }
    const pc = C(o.petal), cc = C(o.center || 0xf2d23a);
    const cx = 15.5, cy = top;
    switch (o.shape) {
      case 'daisy': for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; TX.disc(img, cx + Math.cos(a) * 4, cy + Math.sin(a) * 4, 2.3, () => pc); } TX.disc(img, cx, cy, 2.3, () => cc); break;
      case 'cup': for (let y = cy - 6; y <= cy + 1; y++) for (let x = cx - 4; x <= cx + 4; x++) if (Math.abs(x - cx) < 4 - Math.max(0, cy - 3 - y) * 0 && y > cy - 6 + Math.abs(x - cx) * 0.4) TX.dot(img, Math.floor(x), Math.floor(y), TX.scale(pc, 0.8 + (y - cy + 6) * 0.04)); for (let x = -4; x <= 4; x += 2) TX.dot(img, Math.floor(cx + x), Math.floor(cy - 6), TX.scale(pc, 1.1)); break;
      case 'ball': TX.disc(img, cx, cy - 2, 5.5, (d, x, y) => hh(x, y, 9) < 0.3 ? TX.scale(pc, 1.25) : TX.scale(pc, 0.85 + (1 - d) * 0.3)); break;
      case 'star': for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283; TX.line(img, Math.round(cx), Math.round(cy), Math.round(cx + Math.cos(a) * 6), Math.round(cy + Math.sin(a) * 6), (x, y) => TX.dot(img, x, y, pc)); } TX.disc(img, cx, cy, 1.5, () => cc); break;
      case 'bells': for (let k = 0; k < 4; k++) { const bx = cx + 3 + (k % 2) * 3, by = cy + k * 4; TX.disc(img, bx, by, 2, () => pc); } TX.stroke(img, [[15, cy - 2], [20, cy - 1], [22, cy + 12]], stemCol, 1); break;
      case 'orchid': for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283 + 0.3; TX.disc(img, cx + Math.cos(a) * 4, cy + Math.sin(a) * 3, 2.6, () => TX.scale(pc, 0.9 + k * 0.04)); } TX.disc(img, cx, cy, 1.6, () => cc); break;
      case 'poppy': TX.disc(img, cx, cy - 1, 5.5, (d) => TX.scale(pc, 0.85 + (1 - d) * 0.3)); TX.disc(img, cx, cy - 1, 1.8, () => C(0x1a1a1a)); break;
      case 'rose': TX.disc(img, cx, cy - 1, 5, (d, x, y) => Math.sin(Math.hypot(x - cx, y - cy + 1) * 2.5) > 0.3 ? TX.scale(pc, 0.7) : pc); break;
      case 'eye': TX.disc(img, cx, cy - 1, 5.5, () => pc); TX.disc(img, cx, cy - 1, 2.5, () => cc); if (o.glow) for (let y = cy - 4; y < cy + 2; y++) for (let x = cx - 3; x < cx + 3; x++) { const i = Math.floor(y) * N + Math.floor(x); if (i >= 0 && i < N * N && img.c[i * 4 + 3] > 0.5) img.em[i] = 0.9; } break;
      case 'torch': for (let k = 0; k < 12; k++) TX.disc(img, cx + (hh(k, 1, 3) - 0.5) * 6, cy - 2 - k * 0.6, 2.2 - k * 0.12, () => TX.mix(C(0xffe06a), pc, k / 12)); for (let i = 0; i < N * N; i++) if (img.c[i * 4] > 0.9 && img.c[i * 4 + 3] > 0.5) img.em[i] = 0.7; break;
      case 'dandelion_gold': TX.disc(img, cx, cy - 1, 5.5, (d, x, y) => hh(x, y, 5) < 0.4 ? C(0xfff4a0) : pc); for (let i = 0; i < N * N; i++) if (img.c[i * 4 + 3] > 0.5 && img.c[i * 4] > 0.9 && img.c[i * 4 + 1] > 0.8) img.em[i] = 0.25; break;
      default: TX.disc(img, cx, cy - 1, 5, () => pc); TX.disc(img, cx, cy - 1, 2, () => cc);
    }
    TX.outline(img, 0.72);
    return img;
  }
  VR.flowerSprite = flower;
  const FLW = {
    allium: { petal: 0xb05ad8, shape: 'ball', top: 10 }, azure_bluet: { petal: 0xeef0ff, center: 0xf2d23a, shape: 'daisy', top: 16 }, blue_orchid: { petal: 0x2aa8f0, center: 0xa8e0ff, shape: 'orchid' },
    cactus_flower: { petal: 0xf07ab0, center: 0xfff0a0, shape: 'daisy', top: 22, leaves: false }, cornflower: { petal: 0x4a6af0, center: 0x2a3a8a, shape: 'star' }, dandelion: { petal: 0xf8d020, shape: 'default' },
    golden_dandelion: { petal: 0xffc01a, shape: 'dandelion_gold' }, lily_of_the_valley: { petal: 0xfafaf2, shape: 'bells', top: 8 }, oxeye_daisy: { petal: 0xf6f6ee, center: 0xf2c02a, shape: 'daisy' },
    poppy: { petal: 0xe0281e, shape: 'poppy' }, torchflower: { petal: 0xf05a1a, shape: 'torch', top: 14 }, red_tulip: { petal: 0xe0281e, shape: 'cup' }, orange_tulip: { petal: 0xf07a1a, shape: 'cup' },
    white_tulip: { petal: 0xf2f2f2, shape: 'cup' }, pink_tulip: { petal: 0xf4a0c8, shape: 'cup' }, blight_rose: { petal: 0x1a1a1e, stem: 0x2a2a1e, shape: 'rose' },
    moon_eye: { petal: 0x7a7a8a, center: 0x5a5a6a, shape: 'eye' }, moon_eye_open: { petal: 0xf0f0e8, center: 0xff8a1a, shape: 'eye', glow: true },
  };
  PRE.flower = (k) => flower(FLW[k] || FLW.poppy);
  const tallFlower = (petal, center, shape, seed) => [() => { const img = TX.sprite(); stem(img, 15, 0, 31, C(0x3a7a2a), true); leafAt(img, 17, 22, 1, C(0x4a8a3a), 8); leafAt(img, 14, 14, -1, C(0x4a8a3a), 8); leafAt(img, 17, 8, 1, C(0x4a8a3a), 6); return img; }, () => flower({ petal, center, shape, top: 16 })];
  for (const [id, p, c, sh] of [['lilac', 0xc88ae0, 0xc88ae0, 'ball'], ['peony', 0xf0b0d8, 0xf0b0d8, 'ball'], ['rose_bush', 0xd8201a, 0xd8201a, 'rose'], ['sunflower', 0xf8c81a, 0x6a4a1a, 'daisy'], ['pitcher_plant', 0x3aa8a0, 0x6a3a8a, 'cup']]) {
    const [b, t] = tallFlower(p, c, sh);
    REC[id + '_bottom'] = b; REC[id + '_top'] = t;
  }
  REC.sunflower_top = () => { const img = TX.sprite(); stem(img, 15, 14, 31, C(0x3a7a2a), true); TX.disc(img, 16, 10, 9, (d) => d > 0.55 ? C(0xf8c81a) : TX.scale(C(0x5a3a14), 0.8 + (1 - d) * 0.3)); TX.outline(img, 0.75); return img; };
  REC.pink_petals = () => { const img = TX.sprite(); for (let k = 0; k < 16; k++) TX.disc(img, 3 + hh(k, 1, 2240) * 26, 3 + hh(k, 2, 2240) * 26, 2.2, () => TX.mix(C(0xf8a8d0), C(0xffd8ea), hh(k, 3, 2240))); return img; };
  REC.wildflowers = () => { const img = TX.sprite(); const cols = [0xf8e04a, 0xffffff, 0xb08ae0, 0xf8a0c0]; for (let k = 0; k < 18; k++) TX.disc(img, 3 + hh(k, 1, 2241) * 26, 3 + hh(k, 2, 2241) * 26, 1.6, () => C(cols[k % 4])); return img; };
  // ---------------- crops ----------------
  PRE.crop = (kind, age) => {
    age = +age;
    const img = TX.sprite();
    const maxA = kind === 'beetroots' ? 3 : 7, t = age / maxA;
    const h = Math.round(6 + t * 24);
    const green = TX.mix(C(0x2a8a1a), C(0x6ab82a), t);
    for (let k = 0; k < 6; k++) {
      let x = 4 + k * 5, y = 31;
      for (let s = 0; s < h * (0.7 + hh(k, 1, 7) * 0.3); s++) { TX.dot(img, Math.round(x), y, kind === 'wheat' && s > h * 0.6 && age >= 5 ? TX.mix(C(0xc8a02a), C(0xe8c84a), hh(k, s, 3)) : green); y--; x += (hh(k, 2, 7) - 0.5) * 0.4; }
    }
    if (age === maxA) {
      const fruit = kind === 'carrots' ? 0xf07a1a : kind === 'potatoes' ? 0xc8a052 : kind === 'beetroots' ? 0x9a1a3a : null;
      if (fruit) for (let k = 0; k < 4; k++) TX.disc(img, 6 + k * 7, 28, 2.4, () => C(fruit));
      if (kind === 'wheat') for (let k = 0; k < 6; k++) for (let y = 31 - h; y < 31 - h + 7; y++) TX.dot(img, 4 + k * 5, y, C(0xe0b83a));
    }
    return img;
  };
  REC.glow_vine = () => hanging([0x2a5a1a, 0x3a7a2a, 0x5a9a3a], 2250, 5);
  REC.glow_vine_tip = () => hanging([0x2a5a1a, 0x3a7a2a, 0x5a9a3a], 2251, 3);
  REC.glow_vine_berries = () => { const img = REC.glow_vine(); for (let k = 0; k < 5; k++) TX.disc(img, 6 + hh(k, 1, 2252) * 20, 6 + hh(k, 2, 2252) * 20, 2.2, (d) => TX.mix(C(0xfff08a), C(0xf8a82a), d)); for (let i = 0; i < N * N; i++) if (img.c[i * 4] > 0.95 && img.c[i * 4 + 2] < 0.6 && img.c[i * 4 + 3] > 0.5) img.em[i] = 0.9; return img; };
  REC.glow_vine_tip_berries = () => REC.glow_vine_berries();
  REC.starfruit_plant = () => { const img = TX.natural([0x3a2248, 0x5a3a6a, 0x7a5a8a, 0x9a7aa8], { period: 4, oct: 2, seed: 2253 }); return img; };
  REC.starfruit_flower = () => { const img = TX.natural([0x7a5a9a, 0x9a7ab8, 0xc8a8e0, 0xf0e0ff], { period: 3, oct: 2, seed: 2254 }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.2, 0.3); return img; };
  REC.starfruit_flower_dead = () => { const img = REC.starfruit_flower(); img.forEach((x, y) => img.mul(x, y, 0.55)); return img; };
  PRE.cocoa = (age) => { age = +age; return TX.natural([[0x4a8a2a, 0xa88a2a, 0x8a4a1a][age], [0x6aa83a, 0xc8a83a, 0xa85a2a][age]].map(v => v), { period: 4, oct: 2, seed: 2255 + age, bands: 2, bandWarp: 1 }); };
  REC.stem = () => { const img = TX.sprite(); stem(img, 15, 0, 31, C(0x9a9a9a), true); leafAt(img, 17, 20, 1, C(0xb0b0b0), 5); return img; };
  REC.stem_attached = () => { const img = TX.sprite(); TX.stroke(img, [[2, 31], [8, 20], [16, 14], [30, 12]], C(0x9a9a9a), 2); return img; };
  REC.melon_side = () => { const img = new TX.Img(); img.forEach((x, y, i) => { const s = Math.sin(x / N * Math.PI * 6); img.set(x, y, TX.mix(C(0x3a7a1a), C(0x8ac03a), s * 0.5 + 0.5), 1); img.h[i] = 0.5 + s * 0.2; }); return img; };
  REC.melon_top = () => { const img = REC.melon_side(); TX.disc(img, 15.5, 15.5, 3, () => C(0x5a4a1a)); return img; };
  REC.pumpkin_side = () => { const img = new TX.Img(); img.forEach((x, y, i) => { const s = Math.abs(Math.sin(x / N * Math.PI * 4)); img.set(x, y, TX.mix(C(0xa84a0a), C(0xf0901a), s), 1); img.h[i] = 0.3 + s * 0.6; }); return img; };
  REC.pumpkin_top = () => { const img = REC.pumpkin_side(); TX.disc(img, 15.5, 15.5, 3.5, () => C(0x5a6a1a)); return img; };
  const carve = (glow) => { const img = REC.pumpkin_side(); const face = [[9, 10], [10, 10], [11, 10], [10, 9], [20, 10], [21, 10], [22, 10], [21, 9], [15, 15], [16, 15]]; for (let x = 8; x < 24; x++) face.push([x, 21], [x, 22]); for (const x of [10, 14, 18, 22]) face.push([x, 20]); for (const [x, y] of face) { img.set(x, y, glow ? C(0xffd84a) : C(0x2a1406)); if (glow) img.em[y * N + x] = 1; } return img; };
  REC.carved_pumpkin = () => carve(false);
  REC.jack_o_lantern = () => carve(true);
  REC.sugar_cane = () => { const img = TX.sprite(); for (const x0 of [6, 15, 24]) for (let y = 0; y < N; y++) { const c = y % 10 === 0 ? 0.6 : 0.85; TX.dot(img, x0, y, C(0x9a9a9a).map(v => v * c)); TX.dot(img, x0 + 1, y, C(0xbababa).map(v => v * c)); } leafAt(img, 8, 12, 1, C(0xaaaaaa), 5); leafAt(img, 23, 22, -1, C(0xaaaaaa), 5); return img; };
  PRE.sweet_berry_bush = (age) => { age = +age; const img = REC.bush(); img.forEach((x, y) => { if (img.ga(x, y) > 0.5) img.set(x, y, TX.mix(C(0x1a4a2a), C(0x3a8a4a), TX.lum(img.get(x, y)))); }); if (age >= 2) for (let k = 0; k < (age === 3 ? 9 : 4); k++) TX.disc(img, 6 + hh(k, 1, 2260) * 20, 8 + hh(k, 2, 2260) * 20, 1.6, () => C(0xd81a3a)); return img; };
  PRE.ashwart = (age) => { age = +age; const img = TX.sprite(); for (let k = 0; k < 4 + age; k++) TX.disc(img, 6 + hh(k, 1, 2261) * 20, 30 - hh(k, 2, 2261) * (6 + age * 5), 2 + age * 0.3, () => TX.mix(C(0x6a1414), C(0xb82a2a), hh(k, 3, 2261))); return img; };
  REC.hay_side = () => { const img = TX.natural(PAL.hay, { period: 8, oct: 2, stretchY: 0.15, seed: 2262 }); for (const y of [7, 8, 23, 24]) for (let x = 0; x < N; x++) img.set(x, y, C(0x6a4a14)); return K(img); };
  REC.hay_top = () => { const img = TX.natural(PAL.hay, { period: 6, oct: 2, seed: 2263 }); return K(img); };
  // ---------------- fungi ----------------
  const mushroom = (cap, dots) => { const img = TX.sprite(); stem(img, 15, 18, 31, C(0xe8dcc0), true); TX.disc(img, 16, 16, 7, (d, x, y) => y > 17 ? null : (dots && hh(x, y, 3) < 0.15 ? C(0xffffff) : TX.scale(C(cap), 0.85 + (1 - d) * 0.25))); TX.outline(img, 0.7); return img; };
  REC.brown_mushroom = () => mushroom(0x9a6a44, false);
  REC.red_mushroom = () => mushroom(0xd81e1e, true);
  REC.shelf_mushroom = () => TX.natural([0x8a4a1a, 0xb86a2a, 0xd88a3a], { period: 4, oct: 2, bands: 3, bandWarp: 1, seed: 2270 });
  REC.shelf_mushroom_under = () => TX.flat(0xe8d8b0);
  REC.brown_mushroom_block = () => K(TX.natural([0x7a5234, 0x9a6a44, 0xb07c52], { period: 4, oct: 2, seed: 2271 }));
  REC.red_mushroom_block = () => { const img = TX.natural([0xa81414, 0xc81e1e, 0xe02a2a], { period: 4, oct: 2, seed: 2272 }); for (let k = 0; k < 7; k++) TX.disc(img, hh(k, 1, 2273) * 32, hh(k, 2, 2273) * 32, 2.5, () => C(0xf4f0e8)); return K(img); };
  REC.mushroom_stem = () => TX.natural([0xc8bca0, 0xdcd2b8, 0xece4cc], { period: 3, oct: 2, stretchY: 0.3, seed: 2274 });
  REC.mushroom_inside = () => TX.natural([0xc8a878, 0xdcc090, 0xe8d4a8], { period: 4, oct: 2, seed: 2275, speck: 0.2 });
  REC.glow_lichen = () => { const img = TX.sprite(); for (let k = 0; k < 30; k++) TX.disc(img, hh(k, 1, 2276) * 32, hh(k, 2, 2276) * 32, 1.4 + hh(k, 3, 2276), (d) => TX.mix(C(0xc8f0c0), C(0x7aa87a), d)); for (let i = 0; i < N * N; i++) if (img.c[i * 4 + 3] > 0.5 && img.c[i * 4 + 1] > 0.85) img.em[i] = 0.7; return img; };
  const fungus = (cap, stemC, spots) => { const img = TX.sprite(); stem(img, 15, 14, 31, C(stemC), true); TX.disc(img, 16, 12, 7, (d, x, y) => y > 13 ? null : (hh(x, y, 2) < 0.12 ? C(spots) : TX.scale(C(cap), 0.8 + (1 - d) * 0.3))); TX.outline(img, 0.7); return img; };
  REC.crimson_fungus = () => fungus(0xa8182a, 0xe8c8a0, 0xf8a01a);
  REC.teal_fungus = () => fungus(0x1a8a7a, 0xe8c8a0, 0xf87a1a);
  REC.crimson_roots = () => TX.blades([0x5a0a14, 0x8a141e, 0xb8202a, 0xe04038], { count: 10, minH: 10, varH: 14, seed: 2277 });
  REC.teal_roots = () => TX.blades([0x0a4a44, 0x147066, 0x1e9a88, 0x3ac8b0], { count: 10, minH: 10, varH: 14, seed: 2278 });
  REC.ember_sprouts = () => TX.blades([0x0a5a50, 0x1a8a78, 0x3ab8a0], { count: 16, minH: 4, varH: 8, seed: 2279 });
  REC.crimson_wart_block = () => K(TX.natural([0x6a0a14, 0x8e141e, 0xb01e28, 0xd02e30], { period: 5, oct: 3, seed: 2280, contrast: 1.4 }));
  REC.teal_wart_block = () => K(TX.natural([0x0a4a44, 0x126a60, 0x1a8a7a, 0x2aa894], { period: 5, oct: 3, seed: 2281, contrast: 1.4 }));
  REC.lumishroom = () => { const img = new TX.Img(); const P = TX.pal([0xa8401a, 0xf07a2a, 0xffb04a, 0xfff0a0], 5); img.forEach((x, y, i) => { const c = TX.cells(x, y, 4, 2282); const f = 1 - c[0]; img.set(x, y, TX.ramp(P, Math.min(0.999, f)), 1); img.em[i] = 0.6 + f * 0.4; img.h[i] = f; }); return img; };
  REC.weeping_vines = () => hanging([0x7a0e1a, 0xa81a26, 0xd02a32], 2283, 5);
  REC.weeping_vines_tip = () => hanging([0x7a0e1a, 0xa81a26, 0xd02a32], 2284, 3);
  REC.twisting_vines = () => { const img = hanging([0x0e6a5a, 0x1a8a78, 0x2ab09a], 2285, 5); return img; };
  REC.twisting_vines_tip = () => hanging([0x0e6a5a, 0x1a8a78, 0x2ab09a], 2286, 3);
  // ---------------- fauna ----------------
  REC.bee_nest_side = () => TX.natural([0xa87a2a, 0xc89a3a, 0xe0b84a], { period: 4, oct: 2, bands: 2.5, bandWarp: 1, seed: 2290 });
  REC.bee_nest_top = () => { const img = REC.bee_nest_side(); TX.disc(img, 15.5, 15.5, 6, (d) => TX.scale(C(0xc89a3a), 0.9 + d * 0.2)); return img; };
  REC.bee_nest_bottom = () => REC.bee_nest_top();
  REC.bee_nest_front = () => { const img = REC.bee_nest_side(); for (let y = 14; y < 20; y++) for (let x = 12; x < 20; x++) img.set(x, y, C(0x2a1a0a)); return img; };
  REC.bee_nest_front_honey = () => { const img = REC.bee_nest_front(); for (let y = 20; y < 26; y++) for (let x = 13; x < 19; x++) img.set(x, y, C(0xf8b01a)); return img; };
  REC.beehive_side = () => TX.planks(WOOD.oak.planks, { seed: 2291 });
  REC.beehive_end = () => { const img = TX.planks(WOOD.oak.planks, { seed: 2292 }); TX.bevel(img, 2, 2, 29, 29, 0.1, 0.1); return img; };
  REC.beehive_front = () => { const img = REC.beehive_end(); for (let y = 14; y < 19; y++) for (let x = 12; x < 20; x++) img.set(x, y, C(0x2a1a0a)); return img; };
  REC.beehive_front_honey = () => { const img = REC.beehive_front(); for (let y = 19; y < 25; y++) for (let x = 13; x < 19; x++) img.set(x, y, C(0xf8b01a)); return img; };
  REC.honeycomb_block = () => { const img = new TX.Img(); img.forEach((x, y, i) => { const c = TX.cells(x, y, 4, 2293); img.set(x, y, c[1] - c[0] < 0.12 ? C(0xa86a0a) : TX.mix(C(0xf0a01a), C(0xffd04a), 1 - c[0]), 1); img.h[i] = 1 - c[0]; img.ro[i] = 0.3; }); return img; };
  REC.cobweb = () => { const img = TX.sprite(); const col = C(0xe8e8e8); for (let a = 0; a < 8; a++) TX.line(img, 16, 16, Math.round(16 + Math.cos(a * 0.785) * 16), Math.round(16 + Math.sin(a * 0.785) * 16), (x, y) => TX.dot(img, x, y, col)); for (const r of [4, 8, 12]) for (let a = 0; a < 64; a++) TX.dot(img, Math.round(16 + Math.cos(a / 64 * 6.283) * r), Math.round(16 + Math.sin(a / 64 * 6.283) * r), col); return img; };
  REC.turtle_egg = () => { const img = TX.natural([0xd8d8b0, 0xe8e8c8, 0xf4f4e0], { period: 3, oct: 2, seed: 2294 }); for (let k = 0; k < 8; k++) TX.dot(img, Math.floor(hh(k, 1, 2295) * 32), Math.floor(hh(k, 2, 2295) * 32), C(0x7aa84a)); return img; };
  REC.cheese = () => { const img = TX.natural([0xe8b83a, 0xf8d04a, 0xffe07a], { period: 3, oct: 2, seed: 2296, rough: 0.6 }); for (let k = 0; k < 6; k++) TX.disc(img, hh(k, 1, 2297) * 32, hh(k, 2, 2297) * 32, 1.5 + hh(k, 3, 2297) * 2, (d) => TX.scale(C(0xc8981a), 0.8 + d * 0.2)); return img; };
  // ---------------- aquatic ----------------
  const CORAL = { tube: 0x3a5ae0, brain: 0xe06ab0, bubble: 0xb03ad0, fire: 0xe0301e, horn: 0xe8d02a };
  PRE.coral_block = (k) => { const dead = k.startsWith('dead_'); const c = CORAL[k.replace('dead_', '')]; const img = TX.natural(dead ? [0x6a6a66, 0x86867f, 0x9e9e96] : [TX.scale(C(c), 0.55), TX.scale(C(c), 0.8), C(c), TX.mix(C(c), [1, 1, 1], 0.3)], { period: 5, oct: 3, seed: 2300 + k.length, cells: 6, cellEdge: 0.08 }); return img; };
  PRE.coral = (k) => { const dead = k.startsWith('dead_'); const col = dead ? C(0x8a8a82) : C(CORAL[k.replace('dead_', '')]); const img = TX.sprite(); const br = (x, y, a, len, d) => { let px = x, py = y; for (let t = 0; t < len; t++) { px += Math.sin(a); py -= Math.cos(a); TX.disc(img, px, py, 1.3, () => TX.scale(col, 0.8 + t / len * 0.3)); } if (d < 2) { br(px, py, a - 0.6, len * 0.7, d + 1); br(px, py, a + 0.6, len * 0.7, d + 1); } }; br(16, 31, 0, 9, 0); return img; };
  PRE.coral_fan = (k) => { const dead = k.startsWith('dead_'); const col = dead ? C(0x8a8a82) : C(CORAL[k.replace('dead_', '')]); const img = TX.sprite(); for (let a = -6; a <= 6; a++) TX.line(img, 16, 31, Math.round(16 + a * 2.4), 6 + Math.abs(a), (x, y) => TX.dot(img, x, y, TX.scale(col, 0.8 + hh(x, y, 1) * 0.3))); return img; };
  REC.kelp = () => hanging([0x2a6a1a, 0x3a8a2a, 0x5aa83a], 2310, 3);
  REC.kelp_plant = () => { const img = TX.sprite(); for (let y = 0; y < N; y++) { const x = 15 + Math.round(Math.sin(y * 0.3) * 3); TX.dot(img, x, y, C(0x3a8a2a)); TX.dot(img, x + 1, y, C(0x2a6a1a)); if (y % 6 === 0) leafAt(img, x + 2, y, 1, C(0x5aa83a), 5); if (y % 6 === 3) leafAt(img, x - 1, y, -1, C(0x5aa83a), 5); } return img; };
  REC.dried_kelp_side = () => TX.natural([0x2a3a1a, 0x3a4a24, 0x4a5a2e], { period: 4, oct: 2, stretchY: 0.2, seed: 2311 });
  REC.dried_kelp_top = () => { const img = REC.dried_kelp_side(); TX.disc(img, 15.5, 15.5, 10, (d) => TX.scale(C(0x4a5a2e), 0.8 + Math.sin(d * 12) * 0.15)); return img; };
  REC.lily_pad = () => { const img = TX.sprite(); TX.disc(img, 15.5, 15.5, 14, (d, x, y) => (Math.atan2(y - 15.5, x - 15.5) > 0.2 && Math.atan2(y - 15.5, x - 15.5) < 0.9) ? null : TX.scale(C(0xbababa), 0.8 + (1 - d) * 0.3)); return img; };
  REC.sea_pickle = () => { const img = TX.natural([0x3a6a1a, 0x5a8a2a, 0x7aa83a], { period: 4, oct: 2, seed: 2312 }); for (let y = 0; y < 8; y++) for (let x = 8; x < 24; x++) { img.set(x, y, C(0xc8ffb0)); img.em[y * N + x] = 0.8; } return img; };
  REC.seagrass = () => TX.blades([0x1a5a1a, 0x2a7a2a, 0x3a9a3a, 0x5ab84a], { count: 10, minH: 14, varH: 16, seed: 2313 });
  REC.tall_seagrass_bottom = () => TX.blades([0x1a5a1a, 0x2a7a2a, 0x3a9a3a], { count: 10, minH: 31, varH: 1, seed: 2314 });
  REC.tall_seagrass_top = () => TX.blades([0x1a5a1a, 0x2a7a2a, 0x3a9a3a, 0x5ab84a], { count: 10, minH: 10, varH: 18, seed: 2315 });
  // ---------------- echo ----------------
  REC.echo_heart_side = () => { const img = REC.echo_moss(); for (let y = 8; y < 24; y++) for (let x = 8; x < 24; x++) { const d = Math.hypot(x - 15.5, y - 15.5); if (d < 7) { img.set(x, y, TX.mix(C(0xc8fff8), C(0x1ab0c0), d / 7)); img.em[y * N + x] = 1 - d / 9; } } return img; };
  REC.echo_heart_top = () => REC.echo_heart_side();
  REC.echo_sensor_top = () => { const img = REC.echo_moss(); TX.bevel(img, 0, 0, N - 1, N - 1, 0.1, 0.1); return img; };
  REC.echo_sensor_side = () => { const img = REC.echo_moss(); for (let y = 0; y < 16; y++) for (let x = 0; x < N; x++) img.alpha(x, y, 0); return img; };
  REC.echo_tendril = () => { const img = TX.sprite(); for (let k = 0; k < 4; k++) { let x = 6 + k * 6; for (let y = 31; y > 10; y--) { x += Math.sin(y * 0.4 + k) * 0.4; TX.dot(img, Math.round(x), y, C(0x1a6a7a)); } } return img; };
  REC.echo_tendril_active = () => { const img = REC.echo_tendril(); for (let i = 0; i < N * N; i++) if (img.c[i * 4 + 3] > 0.5) { img.c[i * 4] = 0.3; img.c[i * 4 + 1] = 1; img.c[i * 4 + 2] = 0.95; img.em[i] = 1; } return img; };
  REC.echo_horn_top = () => { const img = REC.echo_moss(); TX.disc(img, 15.5, 15.5, 8, (d) => TX.mix(C(0xe8e0c8), C(0x9a927a), d)); return img; };
  REC.echo_horn_side = () => { const img = REC.echo_moss(); for (let y = 0; y < 16; y++) for (let x = 0; x < N; x++) img.alpha(x, y, 0); for (let y = 16; y < 22; y++) for (let x = 0; x < N; x++) img.set(x, y, C(0xd8d0b8)); return img; };
  REC.echo_vein = () => { const img = TX.sprite(); for (let k = 0; k < 10; k++) { let x = hh(k, 1, 2320) * N, y = hh(k, 2, 2320) * N, a = hh(k, 3, 2320) * 6.28; for (let t = 0; t < 12; t++) { TX.dot(img, Math.floor(x), Math.floor(y), C(0x0e3a48)); x += Math.cos(a); y += Math.sin(a); a += (hh(k, t, 5) - 0.5); } } return img; };
  // ---------------- fluids, fire ----------------
  REC.water_still = () => { const img = TX.natural([0x9aaab8, 0xb0c0cc, 0xc8d4de], { period: 4, oct: 2, seed: 2330, rough: 0.05 }); img.forEach((x, y) => img.alpha(x, y, 0.75)); return img; };
  REC.lava_still = () => { const img = new TX.Img(); const P = TX.pal([0x9a1a04, 0xd8400a, 0xff7a1a, 0xffb83a, 0xfff08a], 6); img.forEach((x, y, i) => { const f = TX.fbm(x, y, 4, 3, 2331); img.set(x, y, TX.ramp(P, Math.min(0.999, f * 1.1)), 1); img.em[i] = 0.75 + f * 0.25; img.ro[i] = 0.6; }); return img; };
  const fireFrame = (f, cols, s) => { const img = TX.sprite(); const P = TX.pal(cols, 6); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const n = TX.fbm(x, y + f * 4, 4, 3, s) * 0.8 + TX.vnoise(x, y + f * 7, 8, s + 1) * 0.2; const hgt = 1 - y / N; const v = n * 1.25 - hgt * 0.95 + Math.sin(x / N * Math.PI) * 0.25; if (v > 0.12) { img.set(x, y, TX.ramp(P, Math.min(0.999, v * 1.3)), 1); img.em[y * N + x] = 1; } } return img; };
  for (let f = 0; f < 8; f++) {
    REC['fire#' + f] = () => fireFrame(f, [0x8a1a04, 0xd84a0a, 0xff8a1a, 0xffc83a, 0xfff4a0], 2340);
    REC['spirit_fire#' + f] = () => fireFrame(f, [0x0a3a6a, 0x1a7ab0, 0x3ac0e0, 0x8af0ff, 0xe0ffff], 2341);
    REC['campfire_fire#' + f] = () => fireFrame(f, [0x8a1a04, 0xd84a0a, 0xff8a1a, 0xffc83a, 0xfff4a0], 2342);
    REC['spirit_campfire_fire#' + f] = () => fireFrame(f, [0x0a3a6a, 0x1a7ab0, 0x3ac0e0, 0x8af0ff, 0xe0ffff], 2343);
  }
  REC['ember_gate#0'] = () => { const img = new TX.Img(); img.forEach((x, y, i) => { const f = TX.fbm(x, y, 4, 3, 2350); img.set(x, y, TX.mix(C(0x8a2a0a), C(0xffa84a), f), 0.8); img.em[i] = 1; }); return img; };
  REC['drift_gate#0'] = () => { const img = new TX.Img(); img.forEach((x, y, i) => { const f = TX.fbm(x, y, 4, 3, 2351); img.set(x, y, TX.mix(C(0x2a6ad0), C(0xc0f8ff), f), 0.8); img.em[i] = 1; }); return img; };
  REC.void_gate = () => TX.flat(0x0a0a18);
  REC.ice_crystal = () => { const img = PRE.crystal('azure'); return img; };
  PRE.drip = (fam, th) => {
    const pals = { dripstone: [0x5f4b3c, 0x86705c, 0xa89078], sulfur: [0x8d7c18, 0xc6b52e, 0xefe278], icicle: [0x8ab4ea, 0xb8d4f5, 0xe8f4ff] };
    const P = TX.pal(pals[fam], 4); const img = TX.sprite();
    const w = { tip: 3, tip_merge: 4, frustum: 6, middle: 9, base: 12 }[th];
    for (let y = 0; y < N; y++) { const ww = th === 'tip' ? Math.max(0.5, w * (1 - y / N)) : th === 'frustum' ? w * (1 - y / N * 0.5) : w; for (let x = Math.round(16 - ww); x <= Math.round(16 + ww); x++) TX.dot(img, x, y, TX.ramp(P, Math.min(0.999, 0.3 + (x - 16 + ww) / (2 * ww + 1) * 0.6))); }
    if (fam === 'icicle') for (let i = 0; i < N * N; i++) { img.ro[i] = 0.05; if (img.c[i * 4 + 3] > 0.5) img.c[i * 4 + 3] = 1; }
    return img;
  };
  PRE.amethyst = (k) => { const img = TX.sprite(); const P = TX.pal([0x4a2a7a, 0x7a4ab8, 0xb080f0, 0xe0c8ff], 5); const sizes = { small_amethyst_bud: [3, 10], medium_amethyst_bud: [4, 16], large_amethyst_bud: [5, 22], amethyst_cluster: [6, 30] }[k]; const [n, h] = sizes; for (let s = 0; s < n; s++) { const cx = 6 + s * (20 / n) + 2, hh2 = h * (0.6 + hh(s, 1, 2360) * 0.4); for (let y = 31; y > 31 - hh2; y--) { const ww = Math.max(0.5, 2.5 * (1 - (31 - y) / hh2 * 0.7)); for (let x = Math.round(cx - ww); x <= Math.round(cx + ww); x++) TX.dot(img, x, y, TX.ramp(P, Math.min(0.999, 0.3 + (31 - y) / hh2 * 0.6))); } } for (let i = 0; i < N * N; i++) if (img.c[i * 4 + 3] > 0.5) { img.em[i] = 0.35; img.ro[i] = 0.08; } return img; };
  REC.budding_amethyst = () => { const img = PRE.block('amethyst'); for (let k = 0; k < 6; k++) TX.disc(img, hh(k, 1, 2361) * 32, hh(k, 2, 2361) * 32, 2, () => C(0xe8d8ff)); return img; };
  REC.sunstone = () => { const img = new TX.Img(); const P = TX.pal([0xa8781a, 0xf0c84a, 0xfff08a, 0xffffe0], 5); img.forEach((x, y, i) => { const c = TX.cells(x, y, 5, 2362); const f = 1 - c[0]; img.set(x, y, TX.ramp(P, Math.min(0.999, f)), 1); img.em[i] = 0.55 + f * 0.45; img.h[i] = f; }); return img; };
  PRE.mire_light = (m) => { const cols = { ochre: [0xd8a83a, 0xf8e08a, 0xfff8d8], verdant: [0x6ad06a, 0xb8f8b0, 0xecffe8], pearl: [0xc86ad0, 0xf0b0f4, 0xfff0ff] }[m]; const img = new TX.Img(); const P = TX.pal(cols, 5); img.forEach((x, y, i) => { const f = 0.4 + TX.fbm(x, y, 3, 2, 2363) * 0.6; img.set(x, y, TX.ramp(P, Math.min(0.999, f)), 1); img.em[i] = 0.8; }); TX.bevel(img, 0, 0, N - 1, N - 1, 0.18, 0.2); return img; };
  PRE.mire_light_top = (m) => { const img = PRE.mire_light(m); TX.disc(img, 15.5, 15.5, 6, (d) => TX.scale(img.get(16, 16), 1.1)); return img; };
  REC.light_rod = () => { const img = TX.sprite(); for (let y = 0; y < 30; y++) for (let x = 0; x < 4; x++) { TX.dot(img, x, y, C(0xfaf8ff)); img.em[y * N + x] = 1; } for (let y = 4; y < 14; y++) for (let x = 4; x < 12; x++) TX.dot(img, x, y, C(0x9a8aa8)); return img; };
  // torches (uv: sides x 14..17 y 12..31, top 14..17 y 12..15)
  const torchTex = (stickCol, flameCols) => { const img = TX.sprite(); for (let y = 12; y < 32; y++) for (let x = 14; x < 18; x++) TX.dot(img, x, y, TX.scale(C(stickCol), 0.8 + (x - 14) * 0.08)); for (let y = 12; y < 17; y++) for (let x = 14; x < 18; x++) { TX.dot(img, x, y, C(flameCols[Math.min(flameCols.length - 1, y - 12)])); img.em[y * N + x] = 1; } return img; };
  REC.torch = () => torchTex(0x6a4a2a, [0xfffae0, 0xfff08a, 0xffc83a, 0xff8a1a, 0xd85a0a]);
  REC.copper_torch = () => torchTex(0x6a4a2a, [0xf0ffe0, 0xb8ff8a, 0x6ae05a, 0x2ab04a, 0x1a8a3a]);
  REC.spirit_torch = () => torchTex(0x5a3a2a, [0xf0ffff, 0x9af0ff, 0x3ac0e0, 0x1a8ab0, 0x0a5a8a]);
  REC.red_torch = () => torchTex(0x4a4a4a, [0xffe0e0, 0xff8a8a, 0xff3a2a, 0xd01a1a, 0x9a0a0a]);
  REC.blue_torch = () => torchTex(0x4a4a4a, [0xe0f0ff, 0x8ac0ff, 0x3a7aff, 0x1a4ad0, 0x0a2a9a]);
  REC.green_torch = () => torchTex(0x4a4a4a, [0xe8ffe0, 0x9aff8a, 0x3ae02a, 0x1ab01a, 0x0a7a0a]);
  REC.purple_torch = () => torchTex(0x4a4a4a, [0xfae0ff, 0xe08aff, 0xb03aff, 0x7a1ad0, 0x4a0a9a]);
  REC.sea_torch = () => torchTex(0x3a5a6a, [0xe0ffff, 0x9afff4, 0x3ae0d8, 0x1ab0b0, 0x0a7a8a]);
  REC.volt_torch = () => torchTex(0x6a4a2a, [0xffe0d0, 0xff6a4a, 0xe0200a, 0xa00a04, 0x6a0402]);
  REC.volt_torch_off = () => { const img = torchTex(0x6a4a2a, [0x4a0a08, 0x3a0806, 0x2a0604]); for (let i = 0; i < N * N; i++) img.em[i] = 0; return img; };
  REC.iron_bars = () => { const img = TX.sprite(); for (let y = 0; y < N; y++) for (const x of [2, 3, 12, 13, 18, 19, 28, 29]) TX.dot(img, x, y, C(x % 2 ? 0x9a9a9a : 0x6a6a6a), 0.8); for (let x = 0; x < N; x++) for (const y of [1, 2, 29, 30]) TX.dot(img, x, y, C(0x8a8a8a), 0.8); return img; };
  REC.iron_chain = () => PRE.copper('chain', 0).clone ? (() => { const img = TX.sprite(); for (let y = 0; y < N; y++) { const link = Math.floor(y / 6) % 2; const x0 = link ? 2 : 7; TX.dot(img, x0, y, C(0x9aa0a8)); TX.dot(img, x0 + 1, y, C(0x5a6068)); if (y % 6 === 0) for (let x = 1; x < 11; x++) TX.dot(img, x, y, C(0x7a8088)); } return img; })() : null;
  REC.beacon = () => { const img = TX.gem([0x3ab8b0, 0x6ae8e0, 0xb8fff8, 0xffffff], { cells: 2, glow: 0.9 }); img.em.fill(0.9); return img; };
  REC.conduit = () => { const img = TX.natural([0x6a5a3a, 0x9a8a5a, 0xc8b87a], { period: 3, oct: 2, seed: 2370 }); for (let y = 10; y < 22; y++) for (let x = 10; x < 22; x++) { img.set(x, y, TX.mix(C(0x3af0ff), C(0x0a8aa8), Math.hypot(x - 15.5, y - 15.5) / 8)); img.em[y * N + x] = 1; } return img; };
})(VR);
