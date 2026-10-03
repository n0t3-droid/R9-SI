// ============================================================================
// Texture recipes part 4 — Heartland set: temple slate stone, pilasters,
// light bars, amber windows, portal veil, spire stone, asphalt, beacons.
// ============================================================================
(function (VR) {
  'use strict';
  const TX = VR.TX, N = TX.N, C = TX.C, REC = VR.TEXREC, hh = TX.hash;
  const SLATE = [0x46505e, 0x56627a, 0x66748a, 0x78889e];
  const TAN = [0x8a6a42, 0xa8865a, 0xbe9a6c, 0xd0ae80];
  const BROWN = [0x4a3220, 0x62442c, 0x7a5636, 0x8c6640];
  const emRect = (img, x0, y0, x1, y1, col, em) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { img.set(x, y, col, 1); img.em[y * N + x] = em; img.ro[y * N + x] = 0.15; img.h[y * N + x] = 0.6; } };

  // ---- Gate Temple: blue-grey slate ----
  REC.temple_stone_smooth = () => TX.polished(SLATE, { seed: 4101, border: 1 });
  REC.temple_stone = () => {
    const img = TX.natural(SLATE, { period: 4, oct: 3, seed: 4102, contrast: 1.1, rough: 0.75 });
    // two vertical grooves per block face and a thin top seam: the trailer's ribbed masonry
    for (let y = 0; y < N; y++) for (const x of [0, 1, 16, 17]) { img.mul(x, y, x === 1 || x === 17 ? 0.62 : 0.78); img.H(x, y, 0.25); }
    for (let x = 0; x < N; x++) { img.mul(x, 0, 0.7); img.H(x, 0, 0.3); img.mul(x, 1, 1.12); }
    return img;
  };
  REC.temple_stone_band = () => {
    const img = REC.temple_stone_smooth();
    // carved band: a recessed dark channel with a bright lip, and small square studs
    for (let x = 0; x < N; x++) { img.mul(x, 12, 1.15); img.mul(x, 13, 0.6); img.mul(x, 14, 0.55); img.mul(x, 18, 0.55); img.mul(x, 19, 0.6); img.mul(x, 20, 1.15); for (let y = 13; y <= 19; y++) img.H(x, y, 0.3); }
    for (let k = 0; k < 4; k++) { const x0 = 3 + k * 8; for (let y = 15; y <= 17; y++) for (let x = x0; x <= x0 + 2; x++) { img.mul(x, y, 1.25); img.H(x, y, 0.7); } }
    return img;
  };
  REC.temple_pilaster = () => {
    const img = TX.polished(SLATE, { seed: 4103, border: 0 });
    // eight vertical flutes: cosine shading across each flute, a dark groove between them
    img.forEach((x, y, i) => { const u = (x % 4) / 4; const k = 0.78 + 0.34 * Math.cos((u - 0.5) * Math.PI); img.mul(x, y, x % 4 === 0 ? 0.55 : k); img.h[i] = x % 4 === 0 ? 0.2 : 0.5 + 0.3 * Math.cos((u - 0.5) * Math.PI); img.ro[i] = 0.6; });
    return img;
  };
  REC.temple_light_bar = () => {
    const img = REC.temple_stone_smooth();
    emRect(img, 0, 12, N - 1, 19, C(0xff8a1a), 1);
    for (let x = 0; x < N; x++) { img.set(x, 12, C(0xffc07a), 1); img.set(x, 19, C(0xd85a0a), 1); img.mul(x, 11, 0.6); img.mul(x, 20, 0.6); }
    return img;
  };
  REC.temple_slit = () => {
    const img = REC.temple_stone_smooth();
    emRect(img, 13, 0, 18, N - 1, C(0x3af0ff), 1);
    for (let y = 0; y < N; y++) { img.set(13, y, C(0xb8ffff), 1); img.set(18, y, C(0x1aa8c8), 1); img.mul(12, y, 0.6); img.mul(19, y, 0.6); }
    return img;
  };
  REC.amber_window = () => {
    const img = new TX.Img();
    img.forEach((x, y, i) => {
      const e = Math.min(x, y, N - 1 - x, N - 1 - y);
      const mull = (x === 10 || x === 11 || x === 20 || x === 21 || y === 10 || y === 11 || y === 20 || y === 21);
      if (e < 2) { img.set(x, y, C(0x3c4654), 1); img.em[i] = 0; img.ro[i] = 0.6; img.h[i] = 0.7; return; }
      if (mull) { img.set(x, y, C(0x5a4630), 1); img.em[i] = 0.05; img.ro[i] = 0.5; img.h[i] = 0.62; return; }
      const g = 0.86 + (TX.fbm(x, y, 8, 2, 4104) - 0.5) * 0.25 + (1 - y / N) * 0.12;
      img.set(x, y, TX.scale(C(0xffb02a), g), 1); img.em[i] = 0.95; img.ro[i] = 0.1; img.h[i] = 0.55;
    });
    return img;
  };
  REC.portal_veil = () => {
    const img = new TX.Img();
    img.forEach((x, y, i) => {
      const d = Math.hypot(x - 15.5, y - 15.5) / 16;
      const ring = 0.5 + 0.5 * Math.sin(d * 22 + TX.fbm(x, y, 6, 2, 4105) * 6);
      const col = TX.mix(C(0xfff0b0), C(0xff8a1a), Math.min(1, d * 1.1 + ring * 0.25));
      img.set(x, y, col, 0.62 + ring * 0.25); img.em[i] = 1; img.ro[i] = 0.1;
    });
    return img;
  };
  REC.beacon_red = () => { const img = TX.flat(0xff3a3a, { noise: 0.05 }); img.forEach((x, y, i) => { const e = Math.min(x, y, N - 1 - x, N - 1 - y); img.em[i] = e < 2 ? 0.3 : 1; if (e < 2) img.mul(x, y, 0.6); img.ro[i] = 0.1; }); return img; };

  // ---- Spire Citadel: tan / brown courses ----
  REC.spire_stone = () => { const img = TX.bricks(TAN, 0x6a5030, { rows: 4, per: 2, seed: 4111 }); img.forEach((x, y, i) => { img.ro[i] = 0.8; }); return img; };
  REC.spire_stone_dark = () => { const img = TX.bricks(BROWN, 0x3a2612, { rows: 4, per: 2, seed: 4112 }); img.forEach((x, y, i) => { img.ro[i] = 0.8; }); return img; };
  REC.spire_window = () => {
    const img = REC.spire_stone();
    emRect(img, 11, 0, 20, N - 1, C(0x3af0ff), 1);
    for (let y = 0; y < N; y++) { img.set(11, y, C(0xc8ffff), 1); img.set(20, y, C(0x1a90b0), 1); img.mul(10, y, 0.55); img.mul(21, y, 0.55); if (y % 8 === 3) for (let x = 12; x <= 19; x++) { img.set(x, y, C(0x0e3a4a), 1); img.em[y * N + x] = 0.1; } }
    return img;
  };
  REC.spire_trim = () => {
    const img = REC.spire_stone();
    emRect(img, 0, 10, N - 1, 21, C(0xff9a2a), 1);
    for (let x = 0; x < N; x++) { img.set(x, 10, C(0xffd08a), 1); img.set(x, 21, C(0xd06a0a), 1); img.mul(x, 9, 0.6); img.mul(x, 22, 0.6); }
    return img;
  };
  REC.spire_cap = () => TX.metal([0xb8bcc4, 0xd0d4dc, 0xe4e8ee, 0xf2f4f8], { rough: 0.35, seed: 4113, plates: true });

  REC.flagstone = () => { const img = TX.tiles([0x6a5a4e, 0x7e6c5e, 0x8e7c6c, 0x9c8a78], 0x3a302a, 4, { seed: 4131, jagged: true }); img.forEach((x, y, i) => { img.ro[i] = 0.8; }); return img; };
  // ---- roads ----
  REC.asphalt = () => TX.natural([0x2c2f34, 0x383b41, 0x42454c, 0x4c5058], { period: 3, oct: 3, seed: 4121, speck: 0.05, contrast: 1.1, rough: 0.9 });
  REC.asphalt_dash = () => {
    const img = REC.asphalt();
    for (let y = 3; y <= 28; y++) for (let x = 13; x <= 18; x++) { img.set(x, y, TX.scale(C(0xf2c42a), 0.9 + hh(x, y, 4122) * 0.15), 1); img.ro[y * N + x] = 0.6; }
    return img;
  };
  // zebra crossing: white bars running along the texture's y axis (the road direction), a gap between
  REC.asphalt_zebra = () => {
    const img = REC.asphalt();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const bar = (x % 8) < 5; if (bar) { img.set(x, y, TX.scale(C(0xe8e8e2), 0.85 + hh(x, y, 4123) * 0.2), 1); img.ro[y * N + x] = 0.65; } }
    return img;
  };
})(VR);
