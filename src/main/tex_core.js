// ============================================================================
// Procedural texture painter — framework & generic generators (32x32 "VR style")
// Every texture produces: albedo RGBA, height (→ normal map), roughness, emissive.
// ============================================================================
(function (VR) {
  'use strict';
  const N = 32, NN = N * N;
  const TX = VR.TX = { N };

  class Img {
    constructor() {
      this.c = new Float32Array(NN * 4); // rgba 0..1
      this.h = new Float32Array(NN).fill(0.5);
      this.ro = new Float32Array(NN).fill(0.85);
      this.em = new Float32Array(NN);
      for (let i = 0; i < NN; i++) this.c[i * 4 + 3] = 1;
    }
    i(x, y) { return (((y % N) + N) % N) * N + (((x % N) + N) % N); }
    set(x, y, col, a) {
      const i = this.i(x, y) * 4; this.c[i] = col[0]; this.c[i + 1] = col[1]; this.c[i + 2] = col[2]; if (a !== undefined) this.c[i + 3] = a;
    }
    get(x, y) { const i = this.i(x, y) * 4; return [this.c[i], this.c[i + 1], this.c[i + 2], this.c[i + 3]]; }
    alpha(x, y, a) { this.c[this.i(x, y) * 4 + 3] = a; }
    ga(x, y) { return this.c[this.i(x, y) * 4 + 3]; }
    blend(x, y, col, t) {
      const i = this.i(x, y) * 4;
      this.c[i] += (col[0] - this.c[i]) * t; this.c[i + 1] += (col[1] - this.c[i + 1]) * t; this.c[i + 2] += (col[2] - this.c[i + 2]) * t;
    }
    mul(x, y, k) { const i = this.i(x, y) * 4; this.c[i] *= k; this.c[i + 1] *= k; this.c[i + 2] *= k; }
    H(x, y, v) { this.h[this.i(x, y)] = v; }
    gH(x, y) { return this.h[this.i(x, y)]; }
    clear(a) { for (let i = 0; i < NN; i++) { this.c[i * 4] = 0; this.c[i * 4 + 1] = 0; this.c[i * 4 + 2] = 0; this.c[i * 4 + 3] = a || 0; } }
    copy(o) { this.c.set(o.c); this.h.set(o.h); this.ro.set(o.ro); this.em.set(o.em); if (o.chunky) this.chunky = true; return this; }
    clone() { return new Img().copy(this); }
    rough(v) { this.ro.fill(v); return this; }
    forEach(fn) { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) fn(x, y, y * N + x); }
  }
  TX.Img = Img;

  // colors ---------------------------------------------------------------------
  const C = TX.C = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  TX.mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  TX.scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  TX.shift = (a, dr, dg, db) => [a[0] + dr, a[1] + dg, a[2] + db];
  TX.lum = (c) => c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
  TX.gray = (c, k) => { const l = TX.lum(c); return TX.mix(c, [l, l, l], k); };
  // palette from dark to light by interpolating anchor colors
  TX.pal = function (anchors, n) {
    const cols = anchors.map(a => typeof a === 'number' ? C(a) : a);
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) * (cols.length - 1), k = Math.min(cols.length - 2, Math.floor(t));
      out.push(TX.mix(cols[k], cols[k + 1], t - k));
    }
    return out;
  };
  TX.ramp = (pal, f) => pal[Math.max(0, Math.min(pal.length - 1, Math.floor(f * pal.length)))];

  // deterministic hash & tileable noise -----------------------------------------
  const hh = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  TX.hash = hh;
  // periodic value noise with integer period p (cells)
  TX.vnoise = function (x, y, p, s) {
    const fx = x / N * p, fy = y / N * p;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    let tx = fx - ix, ty = fy - iy;
    tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    const m = (v) => ((v % p) + p) % p;
    const a = hh(m(ix), m(iy), s), b = hh(m(ix + 1), m(iy), s), c = hh(m(ix), m(iy + 1), s), d = hh(m(ix + 1), m(iy + 1), s);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
  TX.fbm = function (x, y, p, oct, s, gain) {
    let v = 0, amp = 1, tot = 0; gain = gain || 0.5;
    for (let o = 0; o < oct; o++) { v += TX.vnoise(x, y, p << o, s + o * 131) * amp; tot += amp; amp *= gain; }
    return v / tot;
  };
  // worley-ish cell noise (tileable): returns [d1, d2, cellId]
  TX.cells = function (x, y, n, s) {
    const cs = N / n;
    const cx = Math.floor(x / cs), cy = Math.floor(y / cs);
    let d1 = 1e9, d2 = 1e9, id = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const gx = cx + ox, gy = cy + oy;
      const wx = ((gx % n) + n) % n, wy = ((gy % n) + n) % n;
      const px = (gx + hh(wx, wy, s)) * cs, py = (gy + hh(wx, wy, s + 7)) * cs;
      const dx = x + 0.5 - px, dy = y + 0.5 - py;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < d1) { d2 = d1; d1 = d; id = wy * n + wx; } else if (d < d2) d2 = d;
    }
    return [d1 / cs, d2 / cs, id];
  };

  // the Klassisch look builds this recipe chunky (16×16-style texels, see tex_build.js pixelate) — the natural
  // ground, rock, wood, leaves; the built materials keep their fine lines. Nahtlos ignores the mark.
  TX.chunky = (img) => { img.chunky = true; return img; };

  // ------------------------------------------------------------------------------
  // Generic generators
  // natural rock/soil: palette ramp over fbm + specks + optional cracks
  TX.natural = function (pal, o) {
    o = o || {};
    const img = new Img(), s = o.seed || 1;
    const P = TX.pal(pal, o.shades || 6);
    img.forEach((x, y, i) => {
      let f = TX.fbm(x, y, o.period || 4, o.oct || 3, s, o.gain || 0.55);
      if (o.stretchY) f = TX.fbm(x, y * (o.stretchY), o.period || 4, o.oct || 3, s);
      if (o.cells) { const c = TX.cells(x, y, o.cells, s + 3); f = f * 0.5 + (1 - c[0]) * 0.5; if (o.cellEdge && c[1] - c[0] < o.cellEdge) f *= 0.55; }
      if (o.bands) f = f * 0.6 + (Math.sin((y + TX.fbm(x, y, 2, 2, s + 9) * o.bandWarp) * o.bands) * 0.5 + 0.5) * 0.4;
      const sp = hh(x, y, s + 99);
      if (o.speck && sp < o.speck) f = o.speckDark ? f * 0.45 : Math.min(1, f + 0.35);
      if (o.speck2 && hh(x, y, s + 199) < o.speck2) f = Math.min(1, f + 0.5);
      f = Math.max(0, Math.min(0.999, (f - 0.5) * (o.contrast || 1.6) + 0.5 + (o.bias || 0)));
      const col = TX.ramp(P, f);
      img.set(x, y, col, 1);
      img.h[i] = f;
      img.ro[i] = o.rough !== undefined ? o.rough : 0.85;
    });
    if (o.cracks) TX.cracks(img, o.cracks, s + 17, o.crackCol);
    return img;
  };
  TX.cracks = function (img, n, s, col) {
    for (let k = 0; k < n; k++) {
      let x = hh(k, 1, s) * N, y = hh(k, 2, s) * N, a = hh(k, 3, s) * 6.28;
      const len = 5 + hh(k, 4, s) * 10;
      for (let t = 0; t < len; t++) {
        const ix = Math.floor(x), iy = Math.floor(y);
        img.mul(ix, iy, 0.55); if (col) img.set(ix, iy, col);
        img.H(ix, iy, img.gH(ix, iy) * 0.3);
        a += (hh(k, t, s + 5) - 0.5) * 1.2; x += Math.cos(a); y += Math.sin(a);
      }
    }
  };
  // bevel: darken/lighten border + height falloff
  TX.bevel = function (img, x0, y0, x1, y1, k, hk) {
    k = k === undefined ? 0.18 : k; hk = hk === undefined ? 0.25 : hk;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const top = y === y0, left = x === x0, bot = y === y1, right = x === x1;
      if (top || left) { img.mul(x, y, 1 + k); }
      if (bot || right) { img.mul(x, y, 1 - k); }
      if (top || left || bot || right) img.H(x, y, img.gH(x, y) - hk);
    }
  };
  // smooth polished surface with border frame
  TX.polished = function (pal, o) {
    o = o || {};
    const img = TX.natural(pal, { period: 2, oct: 2, contrast: 0.7, seed: o.seed || 5, shades: 5, rough: 0.55 });
    const b = o.border === undefined ? 1 : o.border;
    if (b) TX.bevel(img, 0, 0, N - 1, N - 1, 0.16, 0.3);
    if (o.inner) TX.bevel(img, 3, 3, N - 4, N - 4, -0.1, -0.1);
    img.forEach((x, y, i) => { img.h[i] = img.h[i] * 0.4 + 0.5; });
    return img;
  };
  // bricks: rows of bricks with mortar
  TX.bricks = function (pal, mortar, o) {
    o = o || {};
    const img = new Img(), s = o.seed || 3;
    const rows = o.rows || 4, per = o.per || 2, mw = o.mortarW === undefined ? 1 : o.mortarW;
    const bh = N / rows, bw = N / per;
    const P = TX.pal(pal, o.shades || 6);
    const M = typeof mortar === 'number' ? C(mortar) : mortar;
    img.forEach((x, y, i) => {
      const r = Math.floor(y / bh);
      const off = (o.offset === false ? 0 : (r % 2) * bw / 2) + (o.jagged ? Math.floor(hh(r, 0, s) * 4) * 2 : 0);
      const xx = ((x + off) % N + N) % N;
      const c = Math.floor(xx / bw);
      const lx = xx - c * bw, ly = y - r * bh;
      const isM = ly < mw || lx < mw;
      if (isM && mw > 0) {
        const mm = TX.scale(M, 0.9 + hh(x, y, s + 11) * 0.2);
        img.set(x, y, mm, 1); img.h[i] = 0.15; img.ro[i] = 0.95; return;
      }
      const bid = r * 16 + ((c % per) + per) % per;
      const shade = hh(bid, 5, s) * 0.5 + 0.25;
      let f = shade + (TX.fbm(x, y, 8, 2, s + bid) - 0.5) * 0.45;
      if (o.speck && hh(x, y, s + 3) < o.speck) f -= 0.25;
      const col = TX.ramp(P, Math.max(0, Math.min(0.999, f)));
      img.set(x, y, col, 1);
      let h = 0.75 + (f - 0.5) * 0.3;
      // bevel inside brick
      if (ly === mw || lx === mw) { img.mul(x, y, 1.12); }
      if (ly === Math.floor(bh) - 1 || lx === Math.floor(bw) - 1) { img.mul(x, y, 0.85); h -= 0.1; }
      img.h[i] = h; img.ro[i] = o.rough || 0.85;
    });
    if (o.cracks) TX.cracks(img, o.cracks, s + 7);
    if (o.moss) TX.moss(img, o.moss, s + 13);
    return img;
  };
  TX.moss = function (img, amount, s) {
    const P = TX.pal([0x2f4a1c, 0x4f7a2a, 0x7fa845], 4);
    img.forEach((x, y, i) => {
      const f = TX.fbm(x, y, 4, 3, s);
      if (f > 1 - amount) { const c = TX.ramp(P, (f - (1 - amount)) / amount); img.set(x, y, c); img.h[i] = Math.max(img.h[i], 0.7); img.ro[i] = 0.9; }
    });
  };
  // tiles grid
  TX.tiles = function (pal, grout, n, o) {
    return TX.bricks(pal, grout, Object.assign({ rows: n, per: n, offset: false }, o || {}));
  };
  // chiseled: framed block with motif
  TX.chiseled = function (base, motif, o) {
    o = o || {};
    const img = base.clone();
    TX.bevel(img, 0, 0, N - 1, N - 1, 0.18, 0.3);
    TX.bevel(img, 2, 2, N - 3, N - 3, 0.12, 0.15);
    const dark = o.dark || 0.62;
    const draw = (x, y) => { img.mul(x, y, dark); img.H(x, y, 0.2); };
    if (motif === 'ring') { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.hypot(x - 15.5, y - 15.5); if (d > 6.5 && d < 8.5) draw(x, y); if (d < 3) img.mul(x, y, 1.15); } }
    else if (motif === 'diamond') { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const d = Math.abs(x - 15.5) + Math.abs(y - 15.5); if (d > 8 && d < 10.5) draw(x, y); if (d < 4) img.mul(x, y, 1.12); } }
    else if (motif === 'rune') { const pts = [[16, 6, 16, 26], [9, 11, 23, 11], [11, 21, 21, 21], [9, 11, 11, 21], [23, 11, 21, 21]]; for (const [x0, y0, x1, y1] of pts) TX.line(img, x0, y0, x1, y1, (x, y) => draw(x, y)); }
    else if (motif === 'face') { for (const [x, y] of [[11, 12], [12, 12], [20, 12], [21, 12], [11, 13], [12, 13], [20, 13], [21, 13]]) draw(x, y); for (let x = 12; x <= 20; x++) draw(x, 21); draw(11, 20); draw(21, 20); }
    else if (motif === 'bars') { for (let y = 5; y < 27; y++) for (const x of [9, 10, 15, 16, 21, 22]) draw(x, y); }
    else if (motif === 'sun') { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const dx = x - 15.5, dy = y - 15.5, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx); if (d < 4) img.mul(x, y, 1.15); else if (d < 10 && Math.abs(Math.sin(a * 4)) > 0.92) draw(x, y); } }
    else if (motif === 'layers') { for (let y = 0; y < N; y++) if (y % 8 === 4 || y % 8 === 5) for (let x = 3; x < N - 3; x++) draw(x, y); }
    return img;
  };
  TX.line = function (img, x0, y0, x1, y1, fn) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0;
    for (let k = 0; k < 200; k++) { fn(x, y); if (x === x1 && y === y1) break; const e2 = 2 * err; if (e2 > -dy) { err -= dy; x += sx; } if (e2 < dx) { err += dx; y += sy; } }
  };
  // planks
  TX.planks = function (pal, o) {
    o = o || {};
    const img = new Img(), s = o.seed || 7;
    const P = TX.pal(pal, 7);
    const boards = o.boards || 4, bh = N / boards;
    img.forEach((x, y, i) => {
      const b = Math.floor(y / bh), ly = y - b * bh;
      const seam = (x + Math.floor(hh(b, 1, s) * N)) % N;
      const grain = TX.fbm(x * 0.25, y * 2.2, 8, 2, s + b) * 0.6 + Math.sin((x + hh(b, 3, s) * 40) * 0.35 + TX.fbm(x, y, 4, 2, s) * 3) * 0.12;
      let f = 0.45 + (hh(b, 2, s) - 0.5) * 0.25 + (grain - 0.3) * 0.7;
      let h = 0.7;
      if (ly === 0) { f -= 0.28; h = 0.3; }
      if (ly === 1) f += 0.08;
      if (seam < 1 && o.seams !== false) { f -= 0.3; h = 0.35; }
      if (o.nails && (ly === 2) && (seam === 2 || seam === N - 3)) f -= 0.25;
      img.set(x, y, TX.ramp(P, Math.max(0, Math.min(0.999, f))), 1);
      img.h[i] = h + grain * 0.15; img.ro[i] = 0.8;
    });
    return img;
  };
  // log bark (vertical grain)
  TX.bark = function (pal, o) {
    o = o || {};
    const img = new Img(), s = o.seed || 9;
    const P = TX.pal(pal, 7);
    img.forEach((x, y, i) => {
      const col = TX.fbm(x * 3.0, y * 0.35, 4, 3, s);
      let f = col * 0.8 + TX.vnoise(x, y, 16, s + 3) * 0.2;
      if (o.stripes) f = f * 0.7 + (Math.sin(y * o.stripes) * 0.5 + 0.5) * 0.3; // birch-like horizontal marks
      const groove = Math.abs(Math.sin((x + TX.fbm(x, y, 4, 2, s + 5) * 6) * 0.8));
      f = f * 0.75 + groove * 0.25;
      if (o.marks && hh(Math.floor(x / 3), Math.floor(y / 2), s + 2) < o.marks) f *= 0.35;
      f = Math.max(0, Math.min(0.999, (f - 0.45) * 1.8 + 0.5));
      img.set(x, y, TX.ramp(P, f), 1);
      img.h[i] = f; img.ro[i] = 0.9;
    });
    return img;
  };
  TX.logTop = function (ringPal, barkPal, o) {
    o = o || {};
    const img = new Img(), s = o.seed || 11;
    const P = TX.pal(ringPal, 6), BP = TX.pal(barkPal, 5);
    img.forEach((x, y, i) => {
      const dx = x - 15.5, dy = y - 15.5;
      const d = Math.max(Math.abs(dx), Math.abs(dy)) * 0.6 + Math.hypot(dx, dy) * 0.4;
      if (d > 13.5) { const f = TX.fbm(x, y, 8, 2, s); img.set(x, y, TX.ramp(BP, f), 1); img.h[i] = 0.4 + f * 0.3; img.ro[i] = 0.9; return; }
      const ring = Math.sin((d + TX.fbm(x, y, 4, 2, s) * 2.5) * (o.rings || 1.35));
      const f = 0.45 + ring * 0.25 + (TX.fbm(x, y, 8, 2, s + 4) - 0.5) * 0.3;
      img.set(x, y, TX.ramp(P, Math.max(0, Math.min(0.999, f))), 1);
      img.h[i] = 0.7 + ring * 0.05; img.ro[i] = 0.8;
    });
    return img;
  };
  // leaves (cutout): clusters with holes
  TX.leaves = function (pal, o) {
    o = o || {};
    const img = new Img(), s = o.seed || 13;
    const P = TX.pal(pal, 6);
    img.forEach((x, y, i) => {
      const c = TX.cells(x, y, o.cells || 7, s);
      const inner = 1 - c[0];
      const f = inner * 0.6 + TX.fbm(x, y, 8, 2, s + 1) * 0.4;
      const hole = TX.fbm(x, y, 8, 2, s + 5) < (o.holes === undefined ? 0.3 : o.holes) && c[0] > 0.45;
      if (hole) { img.set(x, y, TX.ramp(P, 0.1), 0); img.h[i] = 0; return; }
      let col = TX.ramp(P, Math.max(0, Math.min(0.999, f)));
      if (o.flowers && hh(x, y, s + 9) < o.flowers) col = typeof o.flowerCol === 'number' ? C(o.flowerCol) : o.flowerCol;
      img.set(x, y, col, 1);
      img.h[i] = f; img.ro[i] = 0.7;
    });
    return img;
  };
  // ore overlay
  TX.ore = function (host, mineralPal, o) {
    o = o || {};
    const img = host.clone(), s = o.seed || 17;
    const P = TX.pal(mineralPal, 5);
    const n = o.count || 7;
    for (let k = 0; k < n; k++) {
      const cx = 3 + hh(k, 1, s) * 26, cy = 3 + hh(k, 2, s) * 26, r = (o.size || 2.2) * (0.7 + hh(k, 3, s) * 0.6);
      for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > r) continue;
        const shape = o.shape === 'crystal' ? (Math.abs(x - cx) + Math.abs(y - cy) < r) : true;
        if (!shape) continue;
        const f = 1 - d / r;
        const col = TX.ramp(P, Math.min(0.999, f * 0.8 + hh(x, y, s + k) * 0.3));
        img.set(x, y, col);
        img.H(x, y, 0.75 + f * 0.25);
        img.ro[img.i(x, y)] = o.rough || 0.35;
        if (o.glow) img.em[img.i(x, y)] = o.glow * (0.4 + f * 0.6);
        // dark outline under mineral
      }
      for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        const d = Math.hypot(x - cx, y - cy); if (d > r && d < r + 1 && hh(x, y, 3) > 0.3) img.mul(x, y, 0.7);
      }
    }
    return img;
  };
  // metal storage block
  TX.metal = function (pal, o) {
    o = o || {};
    const img = new Img(), s = o.seed || 19;
    const P = TX.pal(pal, 7);
    img.forEach((x, y, i) => {
      let f = 0.55 + (y / N - 0.5) * -0.25 + TX.fbm(x, y, 4, 2, s) * 0.2 - 0.1 + Math.sin((x + y) * 0.35) * 0.04;
      if (o.brushed) f += (TX.vnoise(x * 4, y * 0.2, 16, s) - 0.5) * 0.15;
      img.set(x, y, TX.ramp(P, Math.max(0, Math.min(0.999, f))), 1);
      img.h[i] = 0.6; img.ro[i] = o.rough === undefined ? 0.3 : o.rough;
    });
    TX.bevel(img, 0, 0, N - 1, N - 1, 0.22, 0.3);
    if (o.plates) { TX.bevel(img, 0, 0, 15, 15, 0.1, 0.1); TX.bevel(img, 16, 0, 31, 15, 0.1, 0.1); TX.bevel(img, 0, 16, 15, 31, 0.1, 0.1); TX.bevel(img, 16, 16, 31, 31, 0.1, 0.1); }
    if (o.rivets) for (const [x, y] of [[3, 3], [28, 3], [3, 28], [28, 28]]) { img.mul(x, y, 1.35); img.mul(x + 1, y + 1, 0.7); img.H(x, y, 0.9); }
    return img;
  };
  // gem storage block (faceted)
  TX.gem = function (pal, o) {
    o = o || {};
    const img = new Img(), s = o.seed || 23;
    const P = TX.pal(pal, 7);
    img.forEach((x, y, i) => {
      const c = TX.cells(x, y, o.cells || 4, s);
      const facet = hh(c[2], 1, s);
      let f = 0.3 + facet * 0.5 + (1 - c[0]) * 0.2;
      if (c[1] - c[0] < 0.08) f += 0.3;
      img.set(x, y, TX.ramp(P, Math.max(0, Math.min(0.999, f))), 1);
      img.h[i] = 0.5 + facet * 0.3; img.ro[i] = 0.12;
      if (o.glow) img.em[i] = o.glow * f;
    });
    TX.bevel(img, 0, 0, N - 1, N - 1, 0.2, 0.25);
    return img;
  };
  // woven wool
  TX.wool = function (col, o) {
    o = o || {};
    const img = new Img(), s = o.seed || 29;
    const base = typeof col === 'number' ? C(col) : col;
    const P = TX.pal([TX.scale(base, 0.62), TX.scale(base, 0.86), base, TX.mix(base, [1, 1, 1], 0.18)], 6);
    img.forEach((x, y, i) => {
      const weave = ((x >> 1) + (y >> 1)) % 2 ? Math.sin(y * 1.5) : Math.sin(x * 1.5);
      const f = 0.55 + weave * 0.12 + (TX.fbm(x, y, 8, 2, s) - 0.5) * 0.4;
      img.set(x, y, TX.ramp(P, Math.max(0, Math.min(0.999, f))), 1);
      img.h[i] = 0.5 + weave * 0.1; img.ro[i] = 0.98;
    });
    return img;
  };
  // flat colored (concrete) with subtle noise
  TX.flat = function (col, o) {
    o = o || {};
    const base = typeof col === 'number' ? C(col) : col;
    const img = new Img(), s = o.seed || 31;
    img.forEach((x, y, i) => {
      const n = (TX.fbm(x, y, 8, 2, s) - 0.5) * (o.noise || 0.08) + (hh(x, y, s) - 0.5) * (o.grain || 0.04);
      img.set(x, y, TX.scale(base, 1 + n), 1);
      img.h[i] = 0.5 + n; img.ro[i] = o.rough || 0.8;
    });
    return img;
  };
  // glass (frame + streaks)
  TX.glass = function (frame, tint, o) {
    o = o || {};
    const img = new Img();
    const F = typeof frame === 'number' ? C(frame) : frame, Tn = typeof tint === 'number' ? C(tint) : tint;
    img.forEach((x, y, i) => {
      const edge = x === 0 || y === 0 || x === N - 1 || y === N - 1;
      const inner = x === 1 || y === 1 || x === N - 2 || y === N - 2;
      if (edge) { img.set(x, y, F, o.frameA || 1); img.h[i] = 0.8; }
      else if (inner && o.double) { img.set(x, y, TX.mix(F, [1, 1, 1], 0.4), o.frameA || 1); }
      else {
        const streak = (x - y + 40) % 13 === 0 && x > 4 && x < 14 || (x - y + 40) % 17 === 0 && x > 18 && x < 26;
        img.set(x, y, streak ? TX.mix(Tn, [1, 1, 1], 0.6) : Tn, streak ? (o.streakA || 0.9) : (o.alpha || 0));
        img.h[i] = 0.5;
      }
      img.ro[i] = 0.05;
    });
    return img;
  };

  // sprite helpers (transparent) --------------------------------------------------------
  TX.sprite = function () { const img = new Img(); img.clear(0); img.h.fill(0.5); return img; };
  TX.dot = (img, x, y, col, h) => { if (x < 0 || y < 0 || x >= N || y >= N) return; img.set(x, y, col, 1); if (h !== undefined) img.H(x, y, h); };
  TX.disc = function (img, cx, cy, r, colFn) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= r) { const c = colFn(d / r, x, y); if (c) { img.set(x, y, c, 1); img.H(x, y, 1 - d / r * 0.5); } }
    }
  };
  TX.stroke = function (img, pts, col, w) {
    for (let k = 0; k < pts.length - 1; k++) TX.line(img, Math.round(pts[k][0]), Math.round(pts[k][1]), Math.round(pts[k + 1][0]), Math.round(pts[k + 1][1]), (x, y) => { TX.dot(img, x, y, col); if (w > 1) TX.dot(img, x + 1, y, TX.scale(col, 0.85)); });
  };
  // outline sprite pixels with darker color (pixel-art edge)
  TX.outline = function (img, k) {
    k = k || 0.6;
    const a = new Float32Array(NN); for (let i = 0; i < NN; i++) a[i] = img.c[i * 4 + 3];
    img.forEach((x, y, i) => {
      if (a[i] < 0.5) return;
      const edge = (x > 0 && a[i - 1] < 0.5) || (x < N - 1 && a[i + 1] < 0.5) || (y > 0 && a[i - N] < 0.5) || (y < N - 1 && a[i + N] < 0.5);
      if (edge) img.mul(x, y, k);
    });
  };
  // grass blade sprite
  TX.blades = function (pal, o) {
    o = o || {};
    const img = TX.sprite(), s = o.seed || 37;
    const P = TX.pal(pal, 5);
    const n = o.count || 14;
    for (let k = 0; k < n; k++) {
      let x = 2 + hh(k, 1, s) * 28, y = N - 1;
      const h = (o.minH || 10) + hh(k, 2, s) * (o.varH || 18), lean = (hh(k, 3, s) - 0.5) * (o.lean || 0.5);
      for (let t = 0; t < h; t++) {
        const f = t / h;
        TX.dot(img, Math.round(x), Math.round(y), TX.ramp(P, Math.min(0.999, 0.2 + f * 0.8)), 0.4 + f * 0.5);
        if (t < h * 0.4 && o.thick) TX.dot(img, Math.round(x) + 1, Math.round(y), TX.ramp(P, 0.3));
        y -= 1; x += lean * (0.3 + f);
      }
    }
    return img;
  };
  // normal map from height (tileable)
  TX.toArrays = function (img, albOut, matOut, o) {
    const off = o || 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const hl = img.h[y * N + ((x + N - 1) % N)], hr = img.h[y * N + ((x + 1) % N)];
      const hu = img.h[((y + N - 1) % N) * N + x], hd = img.h[((y + 1) % N) * N + x];
      let nx = (hl - hr) * 2.2, ny = (hu - hd) * 2.2;
      const len = Math.hypot(nx, ny, 1);
      nx /= len; ny /= len;
      const a = img.c[i * 4 + 3];
      const cl = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
      albOut[off + i * 4] = cl(img.c[i * 4]); albOut[off + i * 4 + 1] = cl(img.c[i * 4 + 1]); albOut[off + i * 4 + 2] = cl(img.c[i * 4 + 2]); albOut[off + i * 4 + 3] = cl(a);
      matOut[off + i * 4] = cl(nx * 0.5 + 0.5); matOut[off + i * 4 + 1] = cl(ny * 0.5 + 0.5); matOut[off + i * 4 + 2] = cl(img.ro[i]); matOut[off + i * 4 + 3] = cl(img.em[i]);
    }
  };
})(VR);
