// ============================================================================
// e-portal · VR.PortalFilm — the journey you watch (docs/superpowers/plans/2026-10-31-e-portal.md): a 2D canvas over
// the game that draws the film PortalCore.film chose, shot by shot, procedural and our own: the gate's light swallowing
// you, up through the clouds (or off an airless ground), down through glowing rock, a glide over the land, the curve of
// the world, Amarant's ring sliding by, a moon swelling, a station's wheel, the star-jump tunnel, the arrival in the
// destination's light. Letterboxed like a film; the shots cross-fade.
//   VR.PortalFilm.make(film, pal) → a player; player.draw(ctx, W, H, t) (t: s since the start; past the end it holds the
//   arrival's last look) · player.len · VR.PortalFilm.card(ctx, W, H, kind, pal, t) — the picker's live postcard.
//   pal: {a, b, c} the destination's colours (DimReg veil: light, mid, deep), from: the colours of the world you leave,
//   kind / fromKind (PortalCore.kindOf).
// Cost: one canvas, drawn at a fraction of the screen (High 0.75, Very Low 0.4 — CSS scales it up), particles bounded
// (Very Low: 40 %); nothing is allocated per frame (the stars, clouds and craters are made once per film).
// ============================================================================
(function (VR) {
  'use strict';
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ease = (t) => t * t * (3 - 2 * t);
  const easeOut = (t) => 1 - (1 - t) * (1 - t);
  const lerp = (a, b, t) => a + (b - a) * t;
  // '#rrggbb' → [r, g, b]; mix two colours; rgba string
  const hex = (h) => { const s = String(h || '#888888').replace('#', ''); const n = parseInt(s.length === 3 ? s.replace(/./g, (c) => c + c) : s, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const css = (c, al) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (al === undefined ? 1 : +al.toFixed(3)) + ')';
  // the three palettes a shot's variant picks (the light of dawn, day and dusk)
  const SKIES = [
    { top: hex('#2a2f6b'), mid: hex('#f39a8b'), low: hex('#ffd9a8'), sun: hex('#fff1c9') },   // dawn
    { top: hex('#1e5fb4'), mid: hex('#6fb6f0'), low: hex('#d8f0ff'), sun: hex('#ffffff') },   // day
    { top: hex('#3a2350'), mid: hex('#e0784e'), low: hex('#ffc66b'), sun: hex('#ffe2a0') },   // dusk
  ];
  const GATE = [hex('#ffc978'), hex('#7fe8ff'), hex('#c9a7ff')];
  const rnd = (s) => { let a = (s >>> 0) || 7; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  const F = VR.PortalFilm = {};
  F.LETTERBOX = 0.085;
  F.FADE = 0.35;   // s of cross-fade between two shots

  // ---------------------------------------------------------------- the things a film is made of (once per film)
  function props(seed, q) {
    const r = rnd(seed), n = Math.round(260 * q), nc = Math.round(26 * Math.max(0.5, q)), np = Math.round(140 * q);
    const stars = new Float32Array(n * 3); for (let i = 0; i < n; i++) { stars[i * 3] = r(); stars[i * 3 + 1] = r(); stars[i * 3 + 2] = 0.3 + r() * 0.7; }
    const clouds = new Float32Array(nc * 4); for (let i = 0; i < nc; i++) { clouds[i * 4] = r(); clouds[i * 4 + 1] = r(); clouds[i * 4 + 2] = 0.4 + r() * 0.8; clouds[i * 4 + 3] = r(); }
    const parts = new Float32Array(np * 3); for (let i = 0; i < np; i++) { parts[i * 3] = r() * TAU; parts[i * 3 + 1] = r(); parts[i * 3 + 2] = 0.4 + r() * 0.6; }
    const craters = new Float32Array(22 * 3); for (let i = 0; i < 22; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 0.85; craters[i * 3] = Math.cos(a) * d; craters[i * 3 + 1] = Math.sin(a) * d; craters[i * 3 + 2] = 0.03 + r() * 0.12; }
    const hills = new Float32Array(3 * 9); for (let i = 0; i < hills.length; i++) hills[i] = r();
    return { stars, clouds, parts, craters, hills, r };
  }
  // a soft cloud puff, drawn once into a small canvas and stamped many times
  let PUFF = null;
  function puff() {
    if (PUFF || typeof document === 'undefined') return PUFF;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); if (!x) return null;
    for (let i = 0; i < 7; i++) {
      const cx = 30 + (i * 37) % 70, cy = 56 + ((i * 53) % 30) - 10, rr = 26 + (i * 13) % 18;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, rr); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.6, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rr, 0, TAU); x.fill();
    }
    return (PUFF = c);
  }

  // ---------------------------------------------------------------- the painters' tools
  function vgrad(X, W, H, y0, y1, stops) { const g = X.createLinearGradient(0, y0, 0, y1); for (const s of stops) g.addColorStop(s[0], s[1]); X.fillStyle = g; X.fillRect(0, 0, W, H); }
  function starfield(X, W, H, P, alpha, drift, tw) {
    if (alpha <= 0.01) return;
    const s = P.stars, n = s.length / 3;
    X.fillStyle = '#ffffff';
    for (let i = 0; i < n; i++) {
      const b = s[i * 3 + 2], a = alpha * b * (0.75 + 0.25 * Math.sin(tw * 3 + i));
      if (a < 0.04) continue;
      X.globalAlpha = a;
      const x = ((s[i * 3] + drift * b) % 1 + 1) % 1 * W, y = s[i * 3 + 1] * H, z = b > 0.85 ? 2 : 1;
      X.fillRect(x, y, z, z);
    }
    X.globalAlpha = 1;
  }
  function disc(X, cx, cy, R, base, light, lx, ly, rim) {
    if (R <= 0.5) return;
    const g = X.createRadialGradient(cx + lx * R * 0.5, cy + ly * R * 0.5, R * 0.05, cx, cy, R);
    g.addColorStop(0, css(light)); g.addColorStop(0.55, css(base)); g.addColorStop(1, css(mix(base, [0, 0, 10], 0.75)));
    X.fillStyle = g; X.beginPath(); X.arc(cx, cy, R, 0, TAU); X.fill();
    if (rim) { const h = X.createRadialGradient(cx, cy, R * 0.96, cx, cy, R * 1.12); h.addColorStop(0, css(rim, 0.55)); h.addColorStop(1, css(rim, 0)); X.fillStyle = h; X.beginPath(); X.arc(cx, cy, R * 1.12, 0, TAU); X.fill(); }
  }
  function glow(X, x, y, r, c, a) { const g = X.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, css(c, a)); g.addColorStop(1, css(c, 0)); X.fillStyle = g; X.fillRect(x - r, y - r, r * 2, r * 2); }

  // ---------------------------------------------------------------- the shots: (X, W, H, k 0…1, v, S) — S the film's state
  const SHOT = {};
  // the gate's light swallows you: rings rush outward from the centre, motes fall in, the light fills everything
  SHOT.swallow = function (X, W, H, k, v, S) {
    const c = GATE[v % 3], cx = W / 2, cy = H / 2, M = Math.hypot(W, H) / 2;
    X.fillStyle = css(mix([8, 10, 30], c, 0.15), clamp(k * 1.6, 0, 0.85)); X.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) {
      const p = ((k * 1.8 + i / 6) % 1), r = p * p * M * 1.2;
      X.strokeStyle = css(mix(c, [255, 255, 255], p), (1 - p) * 0.8 * Math.min(1, k * 4)); X.lineWidth = Math.max(1, (1 - p) * W * 0.012);
      X.beginPath(); X.arc(cx, cy, r, 0, TAU); X.stroke();
    }
    const P = S.P, n = P.parts.length / 3;
    X.fillStyle = css(mix(c, [255, 255, 255], 0.5));
    for (let i = 0; i < n; i++) {
      const a = P.parts[i * 3], d = (1 - ((k * 1.4 + P.parts[i * 3 + 1]) % 1)) * M, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.8;
      X.globalAlpha = 0.8 * P.parts[i * 3 + 2]; X.fillRect(x, y, 2, 2 + (M - d) * 0.02);
    }
    X.globalAlpha = 1;
    glow(X, cx, cy, M * (0.2 + k * 1.3), mix(c, [255, 255, 255], 0.6), clamp(k * 1.2, 0, 1));
    if (k > 0.72) { X.fillStyle = css([255, 252, 240], (k - 0.72) / 0.28); X.fillRect(0, 0, W, H); }
  };
  // up through the clouds: the sky deepens to space, puffs rush past and under you, the first stars
  SHOT.clouds = function (X, W, H, k, v, S) {
    const sk = SKIES[v % 3], up = ease(k), top = mix(sk.top, [3, 4, 16], up), mid = mix(sk.mid, sk.top, up * 0.9);
    vgrad(X, W, H, 0, H, [[0, css(top)], [0.6, css(mid)], [1, css(mix(sk.low, sk.mid, up * 0.6))]]);
    starfield(X, W, H, S.P, clamp((up - 0.45) * 2, 0, 1), 0, S.t);
    glow(X, W * (0.25 + 0.5 * (v / 2)), H * (0.75 + up * 0.3), W * 0.35, sk.sun, 0.6 * (1 - up * 0.5));
    const pf = puff(); if (!pf) return;
    const C = S.P.clouds, n = C.length / 4;
    for (let i = 0; i < n; i++) {
      const z = (C[i * 4 + 3] + k * 1.6) % 1, sc = 0.25 + z * z * 3.2, x = (C[i * 4] - 0.5) * W * (1 + z * 2) + W / 2, y = H * (0.15 + C[i * 4 + 1] * 0.5) + z * z * H * 1.4;
      const w = W * 0.22 * sc * C[i * 4 + 2];
      X.globalAlpha = clamp(Math.sin(z * PI) * 1.2, 0, 0.92) * (1 - up * 0.55);
      X.drawImage(pf, x - w / 2, y - w * 0.3, w, w * 0.6);
    }
    X.globalAlpha = 1;
  };
  // off an airless ground: the grey horizon falls away under you, dust drifts, the stars are there at once
  SHOT.rise = function (X, W, H, k, v, S) {
    X.fillStyle = '#04050c'; X.fillRect(0, 0, W, H);
    starfield(X, W, H, S.P, 1, k * 0.05 * (v - 1), S.t);
    const g = S.from.b, y = H * (0.55 + easeOut(k) * 0.65), R = W * (1.4 + k * 0.6);
    disc(X, W / 2, y + R, R, g, mix(g, [255, 255, 255], 0.5), -0.3, -0.9, null);
    const P = S.P, n = (P.parts.length / 3) | 0;
    X.fillStyle = css(mix(g, [255, 255, 255], 0.4));
    for (let i = 0; i < n; i++) { const x = (P.parts[i * 3] / TAU) * W, yy = y - (P.parts[i * 3 + 1] * H * 0.5) - k * H * 0.3 * P.parts[i * 3 + 2]; X.globalAlpha = 0.5 * (1 - k); X.fillRect(x, yy, 2, 2); }
    X.globalAlpha = 1;
  };
  // down (or up) through the deep rock: glowing strata rise past, embers float
  SHOT.deep = function (X, W, H, k, v, S) {
    const c = S.pal.b, dark = mix(S.pal.c, [0, 0, 0], 0.6);
    X.fillStyle = css(dark); X.fillRect(0, 0, W, H);
    const P = S.P, h = P.hills;
    for (let i = 0; i < 9; i++) {
      const y = ((h[i] + k * (0.9 + v * 0.25)) % 1) * H * 1.3 - H * 0.15, th = H * (0.02 + h[i + 9] * 0.05);
      const g = X.createLinearGradient(0, y - th, 0, y + th); g.addColorStop(0, css(c, 0)); g.addColorStop(0.5, css(mix(c, [255, 240, 200], h[i + 18] * 0.5), 0.75)); g.addColorStop(1, css(c, 0));
      X.fillStyle = g;
      X.beginPath(); X.moveTo(0, y);
      for (let x = 0; x <= W; x += W / 8) X.lineTo(x, y + Math.sin(x / W * TAU * (1 + h[i]) + i) * th * 1.4);
      X.lineTo(W, y + th * 2); X.lineTo(0, y + th * 2); X.closePath(); X.fill();
    }
    const n = P.parts.length / 3;
    for (let i = 0; i < n; i++) { const x = (P.parts[i * 3] / TAU) * W, y = (1 - ((P.parts[i * 3 + 1] + k * 0.7 * P.parts[i * 3 + 2]) % 1)) * H; X.fillStyle = css(mix(c, [255, 255, 220], 0.6), 0.7 * P.parts[i * 3 + 2]); X.fillRect(x, y, 2, 2); }
    glow(X, W / 2, H / 2, W * 0.5, c, 0.25 + 0.15 * Math.sin(k * TAU));
  };
  // a glide over the land: three ranges of hills scroll past at their own speeds under the day's sky
  SHOT.glide = function (X, W, H, k, v, S) {
    const sk = SKIES[v % 3], c = S.pal.b;
    vgrad(X, W, H, 0, H * 0.75, [[0, css(sk.top)], [0.7, css(sk.mid)], [1, css(sk.low)]]);
    glow(X, W * (0.7 - 0.4 * (v / 2)), H * 0.42, W * 0.3, sk.sun, 0.75);
    const pf = puff();
    if (pf) { const C = S.P.clouds; for (let i = 0; i < 6; i++) { const x = ((C[i * 4] - k * 0.25) % 1 + 1) % 1 * W * 1.3 - W * 0.15, y = H * (0.1 + C[i * 4 + 1] * 0.25), w = W * 0.25 * C[i * 4 + 2]; X.globalAlpha = 0.8; X.drawImage(pf, x, y, w, w * 0.45); } X.globalAlpha = 1; }
    const h = S.P.hills;
    for (let L = 0; L < 3; L++) {
      const base = H * (0.6 + L * 0.13), sp = (L + 1) * 0.35, col = mix(mix(c, sk.mid, 0.55 - L * 0.22), [10, 20, 30], L * 0.22);
      X.fillStyle = css(col); X.beginPath(); X.moveTo(0, H);
      for (let i = 0; i <= 24; i++) { const x = i / 24 * W, u = x / W + k * sp; X.lineTo(x, base - H * 0.08 * (Math.sin(u * TAU * (1 + h[L]) + h[L + 3] * 9) * 0.6 + Math.sin(u * TAU * 3.1 + L) * 0.3 + 0.4)); }
      X.lineTo(W, H); X.closePath(); X.fill();
    }
  };
  // the curve of the world: you rise, the horizon bends into an arc with its thin bright air, the sun at the limb
  SHOT.curve = function (X, W, H, k, v, S) {
    X.fillStyle = '#03040b'; X.fillRect(0, 0, W, H);
    starfield(X, W, H, S.P, 1, 0.02 * k, S.t);
    const w = S.curveFrom || S.from, R = W * lerp(2.6, 1.0, ease(k)), cx = W * (0.5 + (v - 1) * 0.12), cy = H * 0.72 + R - lerp(0, H * 0.18, k);
    disc(X, cx, cy, R, w.b, mix(w.a, [255, 255, 255], 0.3), (v - 1) * 0.4, -0.95, mix(w.a, [140, 200, 255], 0.5));
    const sx = cx + (v - 1) * W * 0.35, sy = cy - R;
    glow(X, sx, sy, W * 0.12, [255, 245, 220], 0.9 * (0.6 + 0.4 * Math.sin(k * PI)));
    X.fillStyle = 'rgba(255,250,235,.85)'; X.fillRect(sx - W * 0.25 * k, sy - 1, W * 0.5 * k, 2);
  };
  // Amarant's ring: a giant's banded edge behind, the ring's bright bands sweep across, ice motes glint
  SHOT.ring = function (X, W, H, k, v, S) {
    X.fillStyle = '#04040a'; X.fillRect(0, 0, W, H);
    starfield(X, W, H, S.P, 0.8, -0.04 * k, S.t);
    disc(X, W * (0.85 - (v * 0.2)), H * 1.25, H * 0.95, hex('#c98a5a'), hex('#ffd9a8'), -0.5, -0.7, hex('#ffb070'));
    X.save(); X.translate(W / 2, H * 0.55); X.rotate(-0.22 + (v - 1) * 0.12);
    const slide = lerp(W * 0.6, -W * 0.6, ease(k));
    const bands = [[0, 0.06, '#e8d6b8', 0.8], [0.07, 0.03, '#b89c78', 0.5], [0.11, 0.08, '#f4e6cc', 0.9], [0.2, 0.02, '#8a7458', 0.4], [0.23, 0.05, '#dcc6a4', 0.7]];
    for (const b of bands) { X.fillStyle = b[2]; X.globalAlpha = b[3]; X.fillRect(-W * 2 + slide, H * (b[0] - 0.12), W * 4, H * b[1]); }
    X.globalAlpha = 1;
    const P = S.P, n = (P.parts.length / 3) | 0; X.fillStyle = '#ffffff';
    for (let i = 0; i < n; i++) { const x = ((P.parts[i * 3] / TAU) * 2 - 1) * W + slide * 1.4, y = (P.parts[i * 3 + 1] - 0.5) * H * 0.3; X.globalAlpha = 0.6 * P.parts[i * 3 + 2] * (0.5 + 0.5 * Math.sin(S.t * 6 + i)); X.fillRect(x, y, 2, 2); }
    X.globalAlpha = 1; X.restore();
  };
  // a moon (or a world) swells ahead: its craters, its terminator, its thin air when it has one
  SHOT.moon = function (X, W, H, k, v, S) {
    X.fillStyle = '#03040a'; X.fillRect(0, 0, W, H);
    starfield(X, W, H, S.P, 1 - k * 0.3, 0, S.t);
    const R = lerp(H * 0.06, H * 0.95, Math.pow(k, 1.6)), cx = W * lerp(0.5 + (v - 1) * 0.2, 0.5, k), cy = H * lerp(0.42, 0.75, k);
    const p = S.pal, lx = (v - 1) * 0.6 - 0.3;
    disc(X, cx, cy, R, p.b, mix(p.a, [255, 255, 255], 0.4), lx, -0.6, S.air ? mix(p.a, [150, 210, 255], 0.4) : null);
    const C = S.P.craters, n = C.length / 3;
    for (let i = 0; i < n; i++) { const x = cx + C[i * 3] * R, y = cy + C[i * 3 + 1] * R, r = C[i * 3 + 2] * R; X.fillStyle = css(mix(p.c, p.b, 0.5), 0.35); X.beginPath(); X.arc(x, y, r, 0, TAU); X.fill(); X.fillStyle = css(mix(p.a, [255, 255, 255], 0.5), 0.25); X.beginPath(); X.arc(x - r * 0.15, y - r * 0.15, r * 0.7, 0, TAU); X.fill(); }
    // the night side
    const g = X.createLinearGradient(cx + lx * R, cy - R * 0.6, cx - lx * R * 1.4, cy + R * 0.6); g.addColorStop(0, 'rgba(0,0,10,0)'); g.addColorStop(1, 'rgba(0,0,10,.55)');
    X.fillStyle = g; X.beginPath(); X.arc(cx, cy, R, 0, TAU); X.fill();
  };
  // a station's wheel turns closer, its red beacon blinking
  SHOT.station = function (X, W, H, k, v, S) {
    X.fillStyle = '#03040a'; X.fillRect(0, 0, W, H);
    starfield(X, W, H, S.P, 1, 0.01 * k, S.t);
    disc(X, W * (0.15 + v * 0.3), H * 1.35, H * 0.8, S.curveFrom ? S.curveFrom.b : hex('#4a7ab8'), hex('#bfe0ff'), 0, -1, hex('#9ad0ff'));
    const R = lerp(H * 0.08, H * 0.6, Math.pow(k, 1.4)), cx = W / 2, cy = H * 0.46, rot = S.t * 0.4 + v;
    X.save(); X.translate(cx, cy); X.scale(1, 0.42 + 0.1 * v); X.rotate(rot);
    X.strokeStyle = '#cfd8e6'; X.lineWidth = Math.max(2, R * 0.12); X.beginPath(); X.arc(0, 0, R, 0, TAU); X.stroke();
    X.strokeStyle = '#ffe2a0'; X.lineWidth = Math.max(1, R * 0.03); X.setLineDash([R * 0.08, R * 0.06]); X.beginPath(); X.arc(0, 0, R, 0, TAU); X.stroke(); X.setLineDash([]);
    X.strokeStyle = '#9aa6b8'; X.lineWidth = Math.max(1, R * 0.04); for (let i = 0; i < 4; i++) { const a = i * PI / 2; X.beginPath(); X.moveTo(0, 0); X.lineTo(Math.cos(a) * R, Math.sin(a) * R); X.stroke(); }
    X.restore();
    X.fillStyle = '#dfe6f0'; X.beginPath(); X.arc(cx, cy, R * 0.14, 0, TAU); X.fill();
    if (Math.sin(S.t * 5) > 0.2) glow(X, cx, cy - R * 0.32, R * 0.25 + 6, [255, 60, 50], 0.9);
  };
  // the star-jump tunnel: streaks rush from the centre, the colour turns to the far star's
  SHOT.tunnel = function (X, W, H, k, v, S) {
    const c0 = [160, 200, 255], c1 = S.pal.a, c = mix(c0, c1, k);
    X.fillStyle = css(mix([2, 3, 12], c, 0.08)); X.fillRect(0, 0, W, H);
    const cx = W / 2 + Math.sin(S.t * 0.7 + v) * W * 0.02, cy = H / 2, M = Math.hypot(W, H) * 0.6, P = S.P, n = P.parts.length / 3, sp = 0.6 + ease(k) * 1.8;
    X.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const a = P.parts[i * 3], z = (P.parts[i * 3 + 1] + S.t * sp * P.parts[i * 3 + 2]) % 1, d0 = z * z * M, d1 = d0 + (8 + z * M * 0.18) * sp;
      X.strokeStyle = css(mix(c, [255, 255, 255], P.parts[i * 3 + 2] * 0.6), z); X.lineWidth = 1 + z * 2;
      X.beginPath(); X.moveTo(cx + Math.cos(a) * d0, cy + Math.sin(a) * d0); X.lineTo(cx + Math.cos(a) * d1, cy + Math.sin(a) * d1); X.stroke();
    }
    glow(X, cx, cy, W * (0.1 + 0.1 * k), mix(c, [255, 255, 255], 0.7), 0.9);
  };
  // the arrival: you come down into the destination's own light, its horizon rises, the light opens onto the world
  SHOT.arrive = function (X, W, H, k, v, S) {
    const p = S.pal, sk = SKIES[v % 3], air = S.air;
    const top = air ? mix(p.c, sk.top, 0.5) : mix(p.c, [2, 3, 10], 0.7), lo = air ? mix(p.a, sk.low, 0.4) : p.b;
    vgrad(X, W, H, 0, H, [[0, css(top)], [0.65, css(mix(top, lo, 0.7))], [1, css(lo)]]);
    if (!air) starfield(X, W, H, S.P, 1 - k, 0, S.t);
    const y = H * lerp(1.1, 0.62, easeOut(k));
    glow(X, W * (0.3 + v * 0.2), y - H * 0.05, W * 0.45, mix(p.a, [255, 255, 255], 0.5), 0.7);
    const h = S.P.hills;
    X.fillStyle = css(mix(p.b, p.c, 0.35)); X.beginPath(); X.moveTo(0, H);
    for (let i = 0; i <= 20; i++) { const x = i / 20 * W; X.lineTo(x, y - H * 0.05 * (Math.sin(i * 0.9 + h[0] * 9) * 0.5 + 0.5)); }
    X.lineTo(W, H); X.closePath(); X.fill();
    if (k > 0.78) { X.fillStyle = css(mix(p.a, [255, 255, 255], 0.6), (k - 0.78) / 0.22 * 0.9); X.fillRect(0, 0, W, H); }
  };
  F.SHOT = SHOT;

  // ---------------------------------------------------------------- the player
  F.make = function (film, pal, from, o) {
    o = o || {};
    const q = film.low ? 0.4 : 1, seed = (VR.PortalCore ? VR.PortalCore.hash(film.id) : 1) ^ (o.seed | 0);
    const S = { P: props(seed, q), pal: { a: hex(pal[0]), b: hex(pal[1]), c: hex(pal[2]) }, from: { a: hex(from[0]), b: hex(from[1]), c: hex(from[2]) }, air: !!o.air, t: 0 };
    if (o.curveFrom) S.curveFrom = { a: hex(o.curveFrom[0]), b: hex(o.curveFrom[1]), c: hex(o.curveFrom[2]) };
    const starts = []; let acc = 0; for (const s of film.shots) { starts.push(acc); acc += s.dur; }
    const len = acc;
    const which = (t) => { let i = film.shots.length - 1; while (i > 0 && starts[i] > t) i--; return i; };
    return {
      len, film, S,
      shotAt: (t) => film.shots[which(t)].id,
      // t: s since the start; hold: the arrival's last look stays while the world still loads
      draw(X, W, H, t) {
        S.t = t;
        const tt = Math.min(t, len - 0.001), i = which(tt), s = film.shots[i], k = clamp((tt - starts[i]) / s.dur, 0, 1);
        const f = SHOT[s.id] || SHOT.arrive;
        X.save(); X.globalAlpha = 1;
        if (i > 0 && tt - starts[i] < F.FADE) {   // the cross-fade: the shot before, then this one over it
          const p = film.shots[i - 1]; (SHOT[p.id] || SHOT.arrive)(X, W, H, 1, p.v, S);
          X.globalAlpha = (tt - starts[i]) / F.FADE;
          X.save(); f(X, W, H, k, s.v, S); X.restore();
        } else f(X, W, H, k, s.v, S);
        X.restore();
        // the letterbox: it is a film
        if (i > 0 || k > 0.3) { const b = Math.round(H * F.LETTERBOX * (i === 0 ? clamp((k - 0.3) / 0.4, 0, 1) : 1)); X.fillStyle = '#000'; X.fillRect(0, 0, W, b); X.fillRect(0, H - b, W, b); }
      },
    };
  };

  // ---------------------------------------------------------------- the picker's postcards
  F.card = function (X, W, H, kind, pal, t, seed) {
    const a = hex(pal[0]), b = hex(pal[1]), c = hex(pal[2]), r = rnd(seed || 3);
    const sky = (top, low) => vgrad(X, W, H, 0, H, [[0, css(top)], [1, css(low)]]);
    const dots = (n, al) => { X.fillStyle = '#fff'; for (let i = 0; i < n; i++) { X.globalAlpha = al * (0.5 + 0.5 * Math.sin(t * 2 + i * 1.7)); X.fillRect(r() * W, r() * H * 0.7, 1, 1); } X.globalAlpha = 1; };
    const land = (col, base, amp, ph) => { X.fillStyle = css(col); X.beginPath(); X.moveTo(0, H); for (let i = 0; i <= 12; i++) X.lineTo(i / 12 * W, H * base - H * amp * (0.5 + 0.5 * Math.sin(i * 0.8 + ph))); X.lineTo(W, H); X.closePath(); X.fill(); };
    if (kind === 'surprise') {
      vgrad(X, W, H, 0, H, [[0, '#2b1f5c'], [1, '#d65a8f']]); dots(30, 0.9);
      X.fillStyle = '#fff'; X.font = 'bold ' + Math.round(H * 0.5) + 'px sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle';
      X.globalAlpha = 0.9; X.fillText('?', W / 2 + Math.sin(t * 2) * 4, H / 2); X.globalAlpha = 1; return;
    }
    if (kind === 'deep') { X.fillStyle = css(mix(c, [0, 0, 0], 0.5)); X.fillRect(0, 0, W, H); for (let i = 0; i < 4; i++) { X.fillStyle = css(b, 0.5); X.fillRect(0, ((i * 0.27 + t * 0.03) % 1) * H, W, 2); } glow(X, W * 0.5, H * 0.6, W * 0.4, b, 0.5); land(mix(c, [0, 0, 0], 0.3), 0.9, 0.12, 1); return; }
    if (kind === 'moon' || kind === 'station' || kind === 'exo') {
      X.fillStyle = '#04050c'; X.fillRect(0, 0, W, H); dots(26, 0.9);
      if (kind === 'station') { disc(X, W * 0.5, H * 1.5, H * 0.9, hex('#3d6fae'), hex('#bfe0ff'), 0, -1, hex('#9ad0ff')); X.save(); X.translate(W * 0.55, H * 0.42); X.scale(1, 0.45); X.rotate(t * 0.4); X.strokeStyle = '#cfd8e6'; X.lineWidth = 3; X.beginPath(); X.arc(0, 0, H * 0.28, 0, TAU); X.stroke(); X.restore(); if (Math.sin(t * 4) > 0) glow(X, W * 0.55, H * 0.3, 6, [255, 60, 50], 1); return; }
      if (kind === 'exo') glow(X, W * 0.78, H * 0.25, W * 0.25, a, 0.9);
      disc(X, W * 0.42, H * 0.55, H * 0.36, b, mix(a, [255, 255, 255], 0.4), -0.4, -0.5, kind === 'exo' ? a : null);
      return;
    }
    // worlds with sky: home, isles, world
    sky(mix(c, [40, 80, 160], 0.4), mix(a, [255, 255, 255], 0.3));
    glow(X, W * 0.75, H * 0.35, W * 0.3, [255, 240, 200], 0.6);
    const pf = puff(); if (pf) { X.globalAlpha = 0.85; X.drawImage(pf, ((t * 6) % (W + 60)) - 60, H * 0.12, 60, 26); X.globalAlpha = 1; }
    if (kind === 'isles') { for (let i = 0; i < 3; i++) { const x = W * (0.2 + i * 0.3), y = H * (0.5 + 0.08 * Math.sin(t + i)); X.fillStyle = css(mix(b, [60, 140, 60], 0.5)); X.beginPath(); X.ellipse(x, y, W * 0.11, H * 0.06, 0, 0, TAU); X.fill(); X.fillStyle = css(mix(c, [0, 0, 0], 0.3)); X.beginPath(); X.moveTo(x - W * 0.1, y); X.lineTo(x, y + H * 0.2); X.lineTo(x + W * 0.1, y); X.fill(); } return; }
    land(mix(b, [60, 120, 70], kind === 'home' ? 0.6 : 0.1), 0.78, 0.12, 0.5);
    land(mix(b, [40, 90, 50], kind === 'home' ? 0.7 : 0.2), 0.9, 0.08, 2);
    if (kind === 'home') { X.fillStyle = '#3a4a6a'; X.fillRect(W * 0.42, H * 0.56, W * 0.16, H * 0.24); X.fillStyle = '#ffc978'; X.beginPath(); X.arc(W * 0.5, H * 0.7, H * 0.07, 0, TAU); X.fill(); }
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
