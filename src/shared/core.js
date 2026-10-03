// ============================================================================
// VOXEL REALM — shared core (runs in main thread and workers)
// ============================================================================
var VR = (typeof globalThis !== 'undefined' ? globalThis : self).VR || {};
(typeof globalThis !== 'undefined' ? globalThis : self).VR = VR;

(function (VR) {
  'use strict';
  const C = VR.C = {
    CHUNK: 16,
    HEIGHT: 256,
    SECTIONS: 16,
    SEA: 63,
    COL_VOL: 16 * 16 * 256,
    SEC_VOL: 4096,
    TICK_RATE: 20,
    DAY_TICKS: 24000,
  };

  const M = VR.M = {};
  M.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  M.lerp = (a, b, t) => a + (b - a) * t;
  M.smooth = (t) => t * t * (3 - 2 * t);
  M.smoothstep = (e0, e1, x) => { let t = (x - e0) / (e1 - e0); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  M.fract = (x) => x - Math.floor(x);
  M.mod = (a, n) => ((a % n) + n) % n;
  M.dist2 = (ax, ay, az, bx, by, bz) => { const dx = ax - bx, dy = ay - by, dz = az - bz; return dx * dx + dy * dy + dz * dz; };

  // Integer hashing -----------------------------------------------------------
  M.hash2 = function (x, z, s) {
    let h = (x | 0) * 374761393 + (z | 0) * 668265263 + (s | 0) * 2147483647;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return h >>> 0;
  };
  M.hash3 = function (x, y, z, s) {
    let h = (x | 0) * 374761393 + (y | 0) * 1103515245 + (z | 0) * 668265263 + (s | 0) * 2246822519;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h = Math.imul(h ^ (h >>> 15), 2654435761);
    h ^= h >>> 16;
    return h >>> 0;
  };
  M.hashf2 = (x, z, s) => M.hash2(x, z, s) / 4294967296;
  M.hashf3 = (x, y, z, s) => M.hash3(x, y, z, s) / 4294967296;

  // Seeded RNG (mulberry32) ----------------------------------------------------
  class RNG {
    constructor(seed) { this.s = (seed >>> 0) || 0x9E3779B9; }
    next() {
      let t = (this.s += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    int(n) { return (this.next() * n) | 0; }
    range(a, b) { return a + this.next() * (b - a); }
    irange(a, b) { return a + ((this.next() * (b - a + 1)) | 0); }
    chance(p) { return this.next() < p; }
    pick(arr) { return arr[(this.next() * arr.length) | 0]; }
  }
  VR.RNG = RNG;

  // String → 32-bit seed
  VR.seedFromString = function (str) {
    if (str === undefined || str === null || str === '') return (Math.random() * 4294967296) >>> 0;
    const n = Number(str);
    if (Number.isFinite(n) && String(n) === String(str).trim()) return (n | 0) >>> 0;
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  // Column key helpers ---------------------------------------------------------
  VR.colKey = (cx, cz) => ((cx + 32768) * 65536 + (cz + 32768));
  // the build height: generated terrain fills y 0…255, a column's storage grows upward (16 blocks at a time) where
  // the player builds higher — up to MAXY. SECS: sections per column at most (keys multiply by it)
  VR.MAXY = 4096; VR.SECS = 256;
  VR.colKeyX = (k) => Math.floor(k / 65536) - 32768;
  VR.colKeyZ = (k) => (k % 65536) - 32768;

  // Face directions: 0 +X east, 1 -X west, 2 +Y up, 3 -Y down, 4 +Z south, 5 -Z north
  VR.FACE = { E: 0, W: 1, U: 2, D: 3, S: 4, N: 5 };
  VR.DX = [1, -1, 0, 0, 0, 0];
  VR.DY = [0, 0, 1, -1, 0, 0];
  VR.DZ = [0, 0, 0, 0, 1, -1];
  VR.OPP = [1, 0, 3, 2, 5, 4];
  // horizontal facing order used by block states: 0 north(-z) 1 east(+x) 2 south(+z) 3 west(-x)
  VR.HF_DX = [0, 1, 0, -1];
  VR.HF_DZ = [-1, 0, 1, 0];
  VR.HF_FACE = [5, 0, 4, 1]; // facing index → face index
  VR.FACE_HF = [1, 3, -1, -1, 2, 0]; // face index → facing index

  // Colors -------------------------------------------------------------------
  VR.hex = function (h) { return [(h >> 16) & 255, (h >> 8) & 255, h & 255]; };
  VR.rgb565 = function (r, g, b) { return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3); };
  VR.packLight = (r, g, b) => ((r & 15) << 8) | ((g & 15) << 4) | (b & 15);

  // Mat4 (column-major Float32Array) -------------------------------------------
  const mat4 = VR.mat4 = {
    create() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
    perspective(out, fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      out.fill(0);
      out[0] = f / aspect; out[5] = f; out[10] = (far + near) * nf; out[11] = -1; out[14] = 2 * far * near * nf;
      return out;
    },
    ortho(out, l, r, b, t, n, f) {
      const lr = 1 / (l - r), bt = 1 / (b - t), nf = 1 / (n - f);
      out.fill(0);
      out[0] = -2 * lr; out[5] = -2 * bt; out[10] = 2 * nf; out[12] = (l + r) * lr; out[13] = (t + b) * bt; out[14] = (f + n) * nf; out[15] = 1;
      return out;
    },
    lookAt(out, ex, ey, ez, cx, cy, cz, ux, uy, uz) {
      let zx = ex - cx, zy = ey - cy, zz = ez - cz;
      let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
      let xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx;
      l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
      out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
      out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
      out[12] = -(xx * ex + xy * ey + xz * ez); out[13] = -(yx * ex + yy * ey + yz * ez); out[14] = -(zx * ex + zy * ey + zz * ez); out[15] = 1;
      return out;
    },
    mul(out, a, b) {
      const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
      for (let i = 0; i < 4; i++) {
        const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
        out[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        out[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        out[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        out[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
      }
      return out;
    },
    invert(out, a) {
      const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
      const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11,
        b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30,
        b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
      let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
      if (!det) return null;
      det = 1 / det;
      out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
      out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
      out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
      out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
      out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
      out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
      out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
      out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
      return out;
    },
    translate(out, a, x, y, z) {
      if (out !== a) out.set(a);
      out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
      out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
      out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
      out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
      return out;
    },
    scale(out, a, x, y, z) {
      for (let i = 0; i < 4; i++) { out[i] = a[i] * x; out[4 + i] = a[4 + i] * y; out[8 + i] = a[8 + i] * z; out[12 + i] = a[12 + i]; }
      return out;
    },
    rotX(out, a, r) {
      const s = Math.sin(r), c = Math.cos(r);
      const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7], a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
      if (out !== a) { out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; out[3] = a[3]; out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15]; }
      out[4] = a10 * c + a20 * s; out[5] = a11 * c + a21 * s; out[6] = a12 * c + a22 * s; out[7] = a13 * c + a23 * s;
      out[8] = a20 * c - a10 * s; out[9] = a21 * c - a11 * s; out[10] = a22 * c - a12 * s; out[11] = a23 * c - a13 * s;
      return out;
    },
    rotY(out, a, r) {
      const s = Math.sin(r), c = Math.cos(r);
      const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
      if (out !== a) { out[4] = a[4]; out[5] = a[5]; out[6] = a[6]; out[7] = a[7]; out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15]; }
      out[0] = a00 * c - a20 * s; out[1] = a01 * c - a21 * s; out[2] = a02 * c - a22 * s; out[3] = a03 * c - a23 * s;
      out[8] = a00 * s + a20 * c; out[9] = a01 * s + a21 * c; out[10] = a02 * s + a22 * c; out[11] = a03 * s + a23 * c;
      return out;
    },
    rotZ(out, a, r) {
      const s = Math.sin(r), c = Math.cos(r);
      const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
      if (out !== a) { out[8] = a[8]; out[9] = a[9]; out[10] = a[10]; out[11] = a[11]; out[12] = a[12]; out[13] = a[13]; out[14] = a[14]; out[15] = a[15]; }
      out[0] = a00 * c + a10 * s; out[1] = a01 * c + a11 * s; out[2] = a02 * c + a12 * s; out[3] = a03 * c + a13 * s;
      out[4] = a10 * c - a00 * s; out[5] = a11 * c - a01 * s; out[6] = a12 * c - a02 * s; out[7] = a13 * c - a03 * s;
      return out;
    },
    // Extract 6 frustum planes (a,b,c,d normalized) from view-projection
    frustum(planes, m) {
      const p = planes;
      const set = (i, a, b, c, d) => { const l = Math.hypot(a, b, c); p[i * 4] = a / l; p[i * 4 + 1] = b / l; p[i * 4 + 2] = c / l; p[i * 4 + 3] = d / l; };
      set(0, m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]);
      set(1, m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]);
      set(2, m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]);
      set(3, m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]);
      set(4, m[3] + m[2], m[7] + m[6], m[11] + m[10], m[15] + m[14]);
      set(5, m[3] - m[2], m[7] - m[6], m[11] - m[10], m[15] - m[14]);
      return p;
    },
    boxInFrustum(p, x0, y0, z0, x1, y1, z1) {
      for (let i = 0; i < 6; i++) {
        const a = p[i * 4], b = p[i * 4 + 1], c = p[i * 4 + 2], d = p[i * 4 + 3];
        if (a * (a > 0 ? x1 : x0) + b * (b > 0 ? y1 : y0) + c * (c > 0 ? z1 : z0) + d < 0) return false;
      }
      return true;
    }
  };

  // Simple priority queue (binary heap on numeric priority, min first)
  class Heap {
    constructor() { this.items = []; this.pri = []; }
    get size() { return this.items.length; }
    push(item, p) {
      const it = this.items, pr = this.pri; it.push(item); pr.push(p);
      let i = it.length - 1;
      while (i > 0) {
        const j = (i - 1) >> 1; if (pr[j] <= pr[i]) break;
        [it[i], it[j]] = [it[j], it[i]]; [pr[i], pr[j]] = [pr[j], pr[i]]; i = j;
      }
    }
    peekPri() { return this.pri[0]; }
    pop() {
      const it = this.items, pr = this.pri; if (!it.length) return undefined;
      const top = it[0]; const li = it.pop(), lp = pr.pop();
      if (it.length) {
        it[0] = li; pr[0] = lp; let i = 0; const n = it.length;
        for (;;) {
          const l = i * 2 + 1, r = l + 1; let m = i;
          if (l < n && pr[l] < pr[m]) m = l; if (r < n && pr[r] < pr[m]) m = r;
          if (m === i) break;
          [it[i], it[m]] = [it[m], it[i]]; [pr[i], pr[m]] = [pr[m], pr[i]]; i = m;
        }
      }
      return top;
    }
    clear() { this.items.length = 0; this.pri.length = 0; }
  }
  VR.Heap = Heap;
})(VR);
