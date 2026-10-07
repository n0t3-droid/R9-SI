// ============================================================================
// VR.IsoPic (W2): a cheap isometric picture of blocks — the wizard's six variant
// pictures and the Bauhand's ring pictures, the same in the game and the Studio,
// on a slow PC too: no WebGL, no canvas calls per block. The cells (ops
// [x, y, z, state …] or a grid {sx, sy, sz, blocks}) are drawn as little cubes
// straight into an RGBA buffer (painter's order, three faces, a one-pixel
// silhouette), the front (z = 0) toward you, the right side (+x) on the right.
// A structure too big for the picture is drawn with merged cells (the top block
// of each wins), so a 160-high tower stays a few milliseconds.
// VR.IsoPic.render(src, W, H, colorOf(state, face) → [r, g, b, a?], opts) →
//   {w, h, data: Uint8ClampedArray}   (face: 'top' · 'front' · 'right')
// · toCanvas(img, canvas?) · hash(img) · texColors(avgColor) → colorOf from the
// game's texture averages (both pages have them).
// ============================================================================
(function (VR) {
  'use strict';
  const IP = VR.IsoPic = {};
  const KEEP = 0xffff, HR = 2.3;   // a block's height on the picture, in half-widths (2u wide steps, h = 2.3u tall)

  // ---------------------------------------------------------------- the cells
  // → {c: Int32Array [x, y, z, state]…, n}
  function cellsOf(src) {
    let n = 0, c;
    if (src && src.ops) {
      const o = src.ops;
      for (let i = 0; i + 3 < o.length; i += 4) { const s = o[i + 3]; if (s > 0 && s !== KEEP) n++; }
      c = new Int32Array(n * 4); let k = 0;
      for (let i = 0; i + 3 < o.length; i += 4) { const s = o[i + 3]; if (!(s > 0) || s === KEEP) continue; c[k++] = o[i]; c[k++] = o[i + 1]; c[k++] = o[i + 2]; c[k++] = s; }
    } else if (src && src.blocks) {
      const { sx, sy, sz, blocks } = src, dy = src.dy | 0;
      for (let i = 0; i < blocks.length; i++) { const s = blocks[i]; if (s && s !== KEEP) n++; }
      c = new Int32Array(n * 4); let k = 0;
      for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) { const s = blocks[(y * sz + z) * sx + x]; if (!s || s === KEEP) continue; c[k++] = x; c[k++] = y + dy; c[k++] = z; c[k++] = s; }
    } else c = new Int32Array(0);
    return { c, n };
  }
  // the colours of a painter, per state and face, kept with it (a WeakMap: one table per colour function)
  const PALS = new WeakMap(), SHADE = [1, 0.8, 0.64];
  function palOf(colorOf) {
    let P = PALS.get(colorOf); if (P) return P;
    P = { known: new Uint8Array(65536), rgba: new Uint8Array(65536 * 12) };
    PALS.set(colorOf, P); return P;
  }
  function fill(P, colorOf, s) {
    for (let f = 0; f < 3; f++) {
      let v = null; try { v = colorOf(s, f === 0 ? 'top' : f === 1 ? 'front' : 'right'); } catch (e) { v = null; }
      if (!v) v = [150, 150, 150, 255];
      const o = s * 12 + f * 4;
      P.rgba[o] = Math.min(255, v[0] * SHADE[f]); P.rgba[o + 1] = Math.min(255, v[1] * SHADE[f]); P.rgba[o + 2] = Math.min(255, v[2] * SHADE[f]); P.rgba[o + 3] = v[3] === undefined ? 255 : v[3];
    }
    P.known[s] = 1;
  }

  // ---------------------------------------------------------------- one cube's pixels at a scale (u half-width, h height)
  // corners P(a, b, c) = ((a + c)·2u, (a − c)·u − b·h); the cube's pixels belong to its top, its front (z = 0 side) or
  // its right (+x) face — a pixel centre inside the face's quad (half-open: neighbours tile without gaps)
  const SPR = new Map();
  function sprite(u, h) {
    const key = u + ':' + h; let sp = SPR.get(key); if (sp) return sp;
    const P = (a, b, c) => [(a + c) * 2 * u, (a - c) * u - b * h];
    const faces = [
      [P(0, 1, 0), P(1, 1, 0), P(1, 1, 1), P(0, 1, 1)],   // 0 top
      [P(0, 0, 0), P(1, 0, 0), P(1, 1, 0), P(0, 1, 0)],   // 1 front (z = 0)
      [P(1, 0, 0), P(1, 0, 1), P(1, 1, 1), P(1, 1, 0)],   // 2 right (+x)
    ];
    // inside a convex quad (either winding), and how far from its nearest edge
    const inside = (q, x, y) => {
      let pos = 0, neg = 0, dmin = 1e9;
      for (let i = 0; i < 4; i++) {
        const a = q[i], b = q[(i + 1) & 3], ex = b[0] - a[0], ey = b[1] - a[1], cr = ex * (y - a[1]) - ey * (x - a[0]);
        if (cr > 1e-9) pos++; else if (cr < -1e-9) neg++; else return -1;
        const L = Math.hypot(ex, ey) || 1; dmin = Math.min(dmin, Math.abs(cr) / L);
      }
      return pos === 4 || neg === 4 ? dmin : -1;
    };
    const px = [], py = [], pf = [], pe = [];
    for (let y = -u - h - 1; y <= u + 1; y++) for (let x = -1; x <= 4 * u + 1; x++) {
      for (let f = 0; f < 3; f++) { const d = inside(faces[f], x + 0.5, y + 0.5); if (d >= 0) { px.push(x); py.push(y); pf.push(f); pe.push(d < 0.75 ? 1 : 0); break; } }
    }
    sp = { n: px.length, x: Int16Array.from(px), y: Int16Array.from(py), f: Uint8Array.from(pf), e: Uint8Array.from(pe) };
    SPR.set(key, sp); return sp;
  }

  // ---------------------------------------------------------------- the picture
  IP.render = function (src, W, H, colorOf, opts) {
    opts = opts || {};
    W = Math.max(8, W | 0); H = Math.max(8, H | 0);
    const img = { w: W, h: H, data: new Uint8ClampedArray(W * H * 4) };
    const C = cellsOf(src); if (!C.n) return img;
    const cc = C.c;
    let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
    for (let i = 0; i < cc.length; i += 4) { const x = cc[i], y = cc[i + 1], z = cc[i + 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    const pad = opts.pad === undefined ? 3 : opts.pad;
    // the scale: whole pixels per half-width (gapless cubes); too big → cells merged k at a time
    let k = 1, u = 0, dx, dy, dz;
    for (;;) {
      dx = Math.ceil((x1 - x0 + 1) / k); dy = Math.ceil((y1 - y0 + 1) / k); dz = Math.ceil((z1 - z0 + 1) / k);
      u = Math.floor(Math.min((W - 2 * pad) / (2 * (dx + dz)), (H - 2 * pad) / ((dx + dz) + HR * dy)));
      if (opts.maxU) u = Math.min(u, opts.maxU);
      if (u >= 1 || k > 64) break;
      k++;
    }
    u = Math.max(1, u);
    const h = Math.max(1, Math.round(HR * u));
    // the merged grid: per cell the state of its highest block (the roof is what you see)
    const N = dx * dy * dz, occ = new Uint16Array(N), topY = new Int32Array(N).fill(-2147483647);
    const SX = dx, SXZ = dx * dz;
    for (let i = 0; i < cc.length; i += 4) {
      const bx = ((cc[i] - x0) / k) | 0, by = ((cc[i + 1] - y0) / k) | 0, bz = ((cc[i + 2] - z0) / k) | 0, j = by * SXZ + bz * SX + bx;
      if (cc[i + 1] >= topY[j]) { topY[j] = cc[i + 1]; occ[j] = cc[i + 3]; }
    }
    // colours: per state and face, once per painter; solid (opaque) cells hide what is behind them
    const P = palOf(colorOf), RG = P.rgba, solid = new Uint8Array(N);
    for (let j = 0; j < N; j++) { const s = occ[j]; if (!s) continue; if (!P.known[s]) fill(P, colorOf, s); if (RG[s * 12 + 3] >= 255) solid[j] = 1; }
    // the visible cells (a cell whose top, front and right all have a solid neighbour is never seen), painter's order:
    // key x − z + y from far to near (counting sort: keys are small integers)
    // (the faces to draw per cell: bit 0 top, 1 front, 2 right — 0 = hidden)
    const faces = new Uint8Array(N);
    let nv = 0;
    for (let y = 0; y < dy; y++) for (let z = 0; z < dz; z++) for (let x = 0; x < dx; x++) {
      const j = y * SXZ + z * SX + x; if (!occ[j]) continue;
      const m = (y + 1 < dy && solid[j + SXZ] ? 0 : 1) | (z > 0 && solid[j - SX] ? 0 : 2) | (x + 1 < dx && solid[j + 1] ? 0 : 4);
      if (m) { faces[j] = m; nv++; }
    }
    const vis = new Int32Array(nv * 4);
    let kmin = 1e9, kmax = -1e9, w = 0;
    for (let y = 0; y < dy; y++) for (let z = 0; z < dz; z++) for (let x = 0; x < dx; x++) {
      const j = y * SXZ + z * SX + x; if (!faces[j]) continue;
      const key = x - z + y; vis[w * 4] = j; vis[w * 4 + 1] = faces[j]; vis[w * 4 + 2] = key; w++;
      if (key < kmin) kmin = key; if (key > kmax) kmax = key;
    }
    if (!nv) return img;
    const nb = kmax - kmin + 1, cnt = new Int32Array(nb + 1);
    for (let i = 0; i < nv; i++) cnt[vis[i * 4 + 2] - kmin + 1]++;
    for (let i = 1; i <= nb; i++) cnt[i] += cnt[i - 1];
    const order = new Int32Array(nv);
    for (let i = 0; i < nv; i++) order[cnt[vis[i * 4 + 2] - kmin]++] = i;
    // where the picture's origin goes: centred
    const spanX = (dx + dz) * 2 * u, top = -dz * u - dy * h, bot = dx * u;
    const OX = Math.floor((W - spanX) / 2), OY = Math.floor((H - (bot - top)) / 2) - top;
    const sp = sprite(u, h), D = img.data, edges = u >= 3 && !opts.noEdges, spx = sp.x, spy = sp.y, spf = sp.f, spe = sp.e;
    for (let q = 0; q < nv; q++) {
      const vi = order[q] * 4, j = vis[vi], show = vis[vi + 1], s = occ[j];
      const x = j % SX, z = ((j / SX) | 0) % dz, y = (j / SXZ) | 0;
      const bx = OX + (x + z) * 2 * u, by = OY + (x - z) * u - y * h, cb = s * 12;
      for (let p = 0; p < sp.n; p++) {
        const f = spf[p]; if (!(show & (1 << f))) continue;
        const X = bx + spx[p], Y = by + spy[p]; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        const o = (Y * W + X) * 4, c = cb + f * 4, e = edges && spe[p] ? 0.86 : 1, ca = RG[c + 3];
        if (ca >= 255) { D[o] = RG[c] * e; D[o + 1] = RG[c + 1] * e; D[o + 2] = RG[c + 2] * e; D[o + 3] = 255; }
        else { const a = ca / 255, b = 1 - a, a0 = D[o + 3] / 255, ao = a + a0 * b, n = ao || 1; D[o] = (RG[c] * e * a + D[o] * a0 * b) / n; D[o + 1] = (RG[c + 1] * e * a + D[o + 1] * a0 * b) / n; D[o + 2] = (RG[c + 2] * e * a + D[o + 2] * a0 * b) / n; D[o + 3] = ao * 255; }
      }
    }
    // a soft dark line around it: the shape reads on any background
    if (opts.outline !== false) {
      const A = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) A[i] = D[i * 4 + 3] > 40 ? 1 : 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x; if (A[i]) continue;
        if ((x > 0 && A[i - 1]) || (x < W - 1 && A[i + 1]) || (y > 0 && A[i - W]) || (y < H - 1 && A[i + W])) { const o = i * 4; D[o] = 12; D[o + 1] = 16; D[o + 2] = 28; D[o + 3] = 110; }
      }
    }
    img.k = k; img.u = u;
    return img;
  };

  // FNV-1a over the pixels
  IP.hash = function (img) { let h = 2166136261; const d = img.data; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 16777619); } return h >>> 0; };
  IP.toCanvas = function (img, cv) {
    if (typeof document === 'undefined') return null;
    cv = cv || document.createElement('canvas');
    if (cv.width !== img.w || cv.height !== img.h) { cv.width = img.w; cv.height = img.h; }
    const x = cv.getContext('2d'); if (!x) return cv;
    x.putImageData(new ImageData(img.data, img.w, img.h), 0, 0);
    return cv;
  };

  // ---------------------------------------------------------------- colours from the game's texture averages
  // (Float32Array, 4 per texture layer, 0…1, alpha-weighted): a little lighter than the raw average, the biome tints at
  // their default greens and blues, glass and water see-through, glowing blocks brighter
  const TINT = { 1: 0x7fbf55, 2: 0x5fa83a, 3: 0x3f76e4, 4: 0x80a755, 5: 0x619961, 6: 0xb38a55, 7: 0x7fbf2f };
  IP.texColors = function (avg) {
    const R = VR.R, T = R.T, F = VR.F;
    const FACE = { top: 2, front: 5, right: 0 };
    const memo = new Map();
    return function (s, face) {
      const f = FACE[face] === undefined ? 4 : FACE[face], key = s * 8 + f;
      let c = memo.get(key); if (c) return c;
      const layer = T.tex[s * 6 + f] & 0xfff, g = (v) => Math.round(Math.pow(Math.max(0, Math.min(1, v)), 1 / 1.6) * 255);
      let r = g(avg[layer * 4]), gg = g(avg[layer * 4 + 1]), b = g(avg[layer * 4 + 2]);
      const tint = T.tint ? T.tint[s] : 0;
      if (tint) { const hx = tint < 8 ? TINT[tint] : (R.tintColors || [])[tint - 8]; if (hx !== undefined) { r = r * ((hx >> 16) & 255) / 255 * 1.25; gg = gg * ((hx >> 8) & 255) / 255 * 1.25; b = b * (hx & 255) / 255 * 1.25; } }
      if (T.emit && T.emit[s]) { r *= 1.25; gg *= 1.25; b *= 1.25; }
      // see-through: glass and water; a cutout texture (a plant, a fence) by how much of it is there
      const fl = T.flags[s], t = R.types[T.type[s]], nm = t ? t.name : '';
      const glass = (T.layer && T.layer[s] === 2) || /glass|pane/.test(nm), water = F && (fl & F.WATER), cov = avg[layer * 4 + 3];
      const a = glass || water ? 150 : T.layer && T.layer[s] === 1 && cov < 0.9 ? Math.round(110 + 145 * Math.max(0, cov)) : 255;
      c = [Math.min(255, r), Math.min(255, gg), Math.min(255, b), a];
      memo.set(key, c); return c;
    };
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
