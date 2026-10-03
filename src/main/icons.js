// ============================================================================
// Icon factory: isometric block icons & flat item sprites from texture data
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, SH = VR.SHAPE, F = VR.F;
  const TINTS = { 1: 0x7fbf55, 2: 0x5fa83a, 3: 0x3f76e4, 4: 0x80a755, 5: 0x619961, 6: 0xb38a55, 7: 0x7fbf2f };
  class Icons {
    constructor(tex) {
      this.alb = tex.albedo[0]; this.N = tex.size;
      this.cache = new Map(); this.faceCache = new Map();
    }
    tintOf(state) {
      const code = R.T.tint[state];
      if (!code) return null;
      const h = code < 8 ? TINTS[code] : R.tintColors[code - 8];
      if (h === undefined) return null;
      return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
    }
    face(layer, tint, shade, opaqueMask) {
      const key = layer + ':' + (tint ? tint.join(',') : '') + ':' + shade + ':' + (opaqueMask ? 1 : 0);
      let c = this.faceCache.get(key);
      if (c) return c;
      const N = this.N;
      c = document.createElement('canvas'); c.width = N; c.height = N;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(N, N);
      const src = this.alb, off = layer * N * N * 4;
      for (let i = 0; i < N * N; i++) {
        let r = src[off + i * 4], g = src[off + i * 4 + 1], b = src[off + i * 4 + 2], a = src[off + i * 4 + 3];
        if (tint) {
          const k = opaqueMask ? a / 255 : 1;
          r *= 1 + (tint[0] - 1) * k; g *= 1 + (tint[1] - 1) * k; b *= 1 + (tint[2] - 1) * k;
        }
        if (opaqueMask) a = 255;
        img.data[i * 4] = Math.min(255, r * shade); img.data[i * 4 + 1] = Math.min(255, g * shade); img.data[i * 4 + 2] = Math.min(255, b * shade); img.data[i * 4 + 3] = a;
      }
      ctx.putImageData(img, 0, 0);
      this.faceCache.set(key, c);
      return c;
    }
    // returns a 64x64 canvas
    get(id) {
      let c = this.cache.get(id);
      if (c) return c;
      c = document.createElement('canvas'); c.width = 64; c.height = 64;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const t = R.byName[id];
      if (t && !VR.ITEMS[id]) this.drawBlock(ctx, t);
      else {
        const d = VR.ITEMS[id];
        if (d) ctx.drawImage(this.face(d.tex, null, 1, false), 4, 4, 56, 56);
      }
      this.cache.set(id, c);
      return c;
    }
    drawBlock(ctx, t) {
      const s = t.defaultState, T = R.T;
      const shape = T.shape[s], layer = T.layer[s];
      const tint = this.tintOf(s);
      const opaque = layer === 0;
      const tex = (f) => T.tex[s * 6 + f] & 0xfff;
      if (shape === SH.VOXEL && VR.VX) { this.drawVoxels(ctx, s); return; }
      const flat = shape === SH.CROSS || shape === SH.TALLCROSS || shape === SH.CROP || shape === SH.WIRE || shape === SH.DRIP || shape === SH.FLUID || shape === SH.PANE ||
        (shape === SH.MODEL && this.thin(s)) || t.o.kind === 'torch' || t.o.kind === 'door' || t.o.kind === 'ladder' || t.o.kind === 'rail';
      if (flat) {
        let L = tex(4);
        if (t.o.itemTex !== undefined) L = t.o.itemTex;
        if (t.o.kind === 'door') L = R.texIndex[(R.texNames[L] || '').replace('door_bottom', 'door_top')] || L;
        ctx.drawImage(this.face(L, tint, 1, false), 4, 4, 56, 56);
        return;
      }
      let h = 1;
      if (shape === SH.MODEL) { const bb = VR.PHYS.selection(s)[0]; if (bb) h = Math.max(0.2, Math.min(1, bb[4] - bb[1])); }
      if (t.o.kind === 'slab') h = 0.5;
      if (T.height[s] && T.height[s] < 16 && shape !== SH.CUBE) h = Math.max(0.2, T.height[s] / 16);
      const top = this.face(tex(2), tint, 1.0, opaque), left = this.face(tex(4), (shape === SH.CUBE && t.o.soil) ? null : tint, 0.8, opaque), right = this.face(tex(0), (shape === SH.CUBE && t.o.soil) ? null : tint, 0.62, opaque);
      // soil blocks (grass): tint only the overlay parts (mask handled by alpha)
      const N = this.N;
      const dy = (1 - h) * 29;
      // top
      ctx.setTransform(28 / N, 14 / N, -28 / N, 14 / N, 32, 3 + dy);
      ctx.drawImage(top, 0, 0);
      // left (south) and right (east): draw the lower h portion of the side texture
      const sy0 = (1 - h) * N, sh = h * N;
      ctx.setTransform(28 / N, 14 / N, 0, 29 / N, 4, 17);
      ctx.drawImage(left, 0, sy0, N, sh, 0, sy0, N, sh);
      ctx.setTransform(28 / N, -14 / N, 0, 29 / N, 32, 31);
      ctx.drawImage(right, 0, sy0, N, sh, 0, sy0, N, sh);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (t.o.soil && tint) {
        // re-tint grass side overlay
        const l2 = this.face(tex(4), tint, 0.8, opaque), r2 = this.face(tex(0), tint, 0.62, opaque);
        void l2; void r2;
      }
    }
    // mini-voxel sculpture icon (Voxel Architecture blocks)
    drawVoxels(ctx, s) {
      const G = VR.VX.iconGrid(s);
      if (!G) return;
      const P = VR.VX.PRESENT, E = VR.VX.EMIS, GL = VR.VX.GLASS;
      const at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x > 7 || y > 7 || z > 7) ? 0 : G[(y * 8 + z) * 8 + x];
      const open = (v) => !(v & P) || (v & GL);
      const S = (X, Y, Z) => [32 + 28 * (X - Z) / 8, 3 + 14 * (X + Z) / 8 + 29 * (1 - Y / 8)];
      const order = [];
      for (let y = 0; y < 8; y++) for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) if (at(x, y, z) & P) order.push([x + y + z, x, y, z]);
      order.sort((a, b) => a[0] - b[0]);
      const poly = (pts, col) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 0.6; ctx.fill(); ctx.stroke(); };
      const rgb = (v, k) => { const e = (v & E) ? 1.25 : 1; return `rgb(${Math.min(255, ((v >> 16) & 255) * k * e) | 0},${Math.min(255, ((v >> 8) & 255) * k * e) | 0},${Math.min(255, (v & 255) * k * e) | 0})`; };
      for (const [, x, y, z] of order) {
        const v = at(x, y, z);
        const glass = (v & GL) !== 0;
        const col = (k) => glass ? `rgba(190,230,255,${0.35 + k * 0.2})` : rgb(v, k);
        if (open(at(x, y + 1, z)) || (glass && !(at(x, y + 1, z) & GL))) poly([S(x, y + 1, z), S(x + 1, y + 1, z), S(x + 1, y + 1, z + 1), S(x, y + 1, z + 1)], col(1));
        if (open(at(x, y, z + 1)) || (glass && !(at(x, y, z + 1) & GL))) poly([S(x, y, z + 1), S(x + 1, y, z + 1), S(x + 1, y + 1, z + 1), S(x, y + 1, z + 1)], col(0.8));
        if (open(at(x + 1, y, z)) || (glass && !(at(x + 1, y, z) & GL))) poly([S(x + 1, y, z), S(x + 1, y, z + 1), S(x + 1, y + 1, z + 1), S(x + 1, y + 1, z)], col(0.64));
      }
    }
    thin(s) {
      const bb = VR.PHYS.selection(s)[0];
      if (!bb) return true;
      const vol = (bb[3] - bb[0]) * (bb[4] - bb[1]) * (bb[5] - bb[2]);
      return vol < 0.2;
    }
    // draw into target canvas element
    paint(el, id, size) {
      const c = this.get(id);
      const ctx = el.getContext('2d');
      if (el.width !== (size || 48)) { el.width = size || 48; el.height = size || 48; }
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, el.width, el.height);
      if (c) ctx.drawImage(c, 0, 0, el.width, el.height);
    }
  }
  VR.Icons = Icons;
})(VR);

// Isometric preview of a ship blueprint (shipyard cards)
(function (VR) {
  'use strict';
  VR.drawBlueprint = function (cv, bp, avg) {
    const ctx = cv.getContext('2d'), W = cv.width, H = cv.height, R = VR.R, T = R.T;
    ctx.clearRect(0, 0, W, H);
    const { sx, sy, sz, blocks } = bp;
    const idx = (x, y, z) => (y * sz + z) * sx + x;
    const c30 = Math.cos(Math.PI / 6), s30 = 0.5;
    const proj = (x, y, z, S) => [(x + z) * c30 * S, (x - z) * s30 * S - y * S];
    // fit
    let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9;
    for (const [x, y, z] of [[0, 0, 0], [sx, 0, 0], [0, sy, 0], [0, 0, sz], [sx, sy, 0], [sx, 0, sz], [0, sy, sz], [sx, sy, sz]]) { const p = proj(x, y, z, 1); minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); miny = Math.min(miny, p[1]); maxy = Math.max(maxy, p[1]); }
    const S = Math.min((W - 30) / (maxx - minx), (H - 30) / (maxy - miny));
    const ox = (W - (maxx - minx) * S) / 2 - minx * S, oy = (H - (maxy - miny) * S) / 2 - miny * S;
    const col = (s, f, k) => {
      const l = T.tex[s * 6 + f] & 0xfff; let r = avg[l * 4], g = avg[l * 4 + 1], b = avg[l * 4 + 2];
      if (T.emit && T.emit[s]) k *= 1.35;
      const a = T.layer[s] === 2 ? 0.55 : 1;
      return `rgba(${Math.min(255, r * 255 * k) | 0},${Math.min(255, g * 255 * k) | 0},${Math.min(255, b * 255 * k) | 0},${a})`;
    };
    // painter's order: view from +x, +y, -z so the nose (at -z) faces the viewer
    const cells = [];
    for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) { const s = blocks[idx(x, y, z)]; if (s) cells.push(x, y, z, s); }
    const order = []; for (let i = 0; i < cells.length; i += 4) order.push(i);
    order.sort((a, b) => (cells[a] + cells[a + 1] - cells[a + 2]) - (cells[b] + cells[b + 1] - cells[b + 2]));
    const solid = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < sx && y < sy && z < sz && blocks[idx(x, y, z)] && T.layer[blocks[idx(x, y, z)]] !== 2;
    const quad = (pts, fill) => { ctx.beginPath(); ctx.moveTo(ox + pts[0][0], oy + pts[0][1]); for (let k = 1; k < 4; k++) ctx.lineTo(ox + pts[k][0], oy + pts[k][1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
    for (const i of order) {
      const x = cells[i], y = cells[i + 1], z = cells[i + 2], s = cells[i + 3];
      const P = (a, b, c) => proj(x + a, y + b, z + c, S);
      if (!solid(x, y + 1, z)) quad([P(0, 1, 0), P(1, 1, 0), P(1, 1, 1), P(0, 1, 1)], col(s, 2, 1));
      if (!solid(x + 1, y, z)) quad([P(1, 0, 0), P(1, 1, 0), P(1, 1, 1), P(1, 0, 1)], col(s, 0, 0.84));
      if (!solid(x, y, z - 1)) quad([P(0, 0, 0), P(1, 0, 0), P(1, 1, 0), P(0, 1, 0)], col(s, 5, 0.68));
    }
  };
})(VR);
