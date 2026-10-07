// ============================================================================
// Texture array builder: resolves recipes, applies the "voxel-art" stylization
// to full-cube faces, builds alpha-coverage-preserving mip chains.
// Runs inside a worker (pure JS, no DOM). Output: per-level RGBA8 arrays.
// ============================================================================
(function (VR) {
  'use strict';
  const TX = VR.TX, N = TX.N;
  const LEVELS = VR.TEX_LEVELS;   // tex_layout.js: 32,16,8,4,2,1

  function resolve(name) {
    const REC = VR.TEXREC, PRE = VR.TEXPRE;
    if (REC[name]) return REC[name]();
    const base = name.split('#')[0];
    const fr = name.indexOf('#') >= 0 ? +name.split('#')[1] : 0;
    if (REC[base]) return REC[base](fr);
    const p = base.split(':');
    if (PRE[p[0]]) return PRE[p[0]](...p.slice(1), fr);
    return null;
  }
  VR.resolveTexture = resolve;

  function missingTex() {
    const img = new TX.Img();
    img.forEach((x, y) => img.set(x, y, ((x >> 3) + (y >> 3)) & 1 ? [0.9, 0.1, 0.9] : [0.1, 0.1, 0.1], 1));
    return img;
  }

  // the Klassisch look's edge on the seamless materials (stucco, Vollton, marble, tiles …): a darker border two texels
  // wide (one pixel of a 16-pixel block) and a groove — the gentle rim of stylize() vanishes on bright surfaces (tone
  // mapping and bloom swallow a few percent). The brighter the material, the darker its border: a sunlit white wall
  // sits on the tone curve's shoulder, where only a strong line still shows (measured in the game: ~9 grey levels on
  // white stucco in the sun, ~24 on grey stucco up close). Mips fade it out with distance.
  function edgeLine(img, strength) {
    const s = strength;
    let lum = 0; for (let i = 0; i < N * N; i++) lum += 0.2126 * img.c[i * 4] + 0.7152 * img.c[i * 4 + 1] + 0.0722 * img.c[i * 4 + 2];
    lum = Math.min(1, lum / (N * N));
    const k0 = (0.14 + 0.22 * lum) * s, k1 = (0.08 + 0.12 * lum) * s;   // white: ×0.65 / ×0.81 · dark: ×0.82 / ×0.9
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const e = Math.min(x, y, N - 1 - x, N - 1 - y);
      if (e > 1) continue;
      const i = y * N + x, m = 1 - (e === 0 ? k0 : k1);
      img.h[i] -= (e === 0 ? 0.2 : 0.1) * s;
      img.c[i * 4] *= m; img.c[i * 4 + 1] *= m; img.c[i * 4 + 2] *= m;
    }
  }
  // soft bevel + edge definition for cube faces (normal-mapped groove, gentle AO rim)
  function stylize(img, strength) {
    const s = strength;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const e = Math.min(x, y, N - 1 - x, N - 1 - y);
      if (e > 1) continue;
      const i = y * N + x;
      const k = e === 0 ? 1 : 0.4;
      img.h[i] -= 0.22 * k * s;
      const m = 1 - 0.07 * k * s;
      img.c[i * 4] *= m; img.c[i * 4 + 1] *= m; img.c[i * 4 + 2] *= m;
    }
  }

  // alpha-coverage preserving downsample
  function coverage(a, n, ref) { let c = 0; for (let i = 0; i < n * n; i++) if (a[i] >= ref) c++; return c / (n * n); }
  function downsample(src, n, cutout, targetCov) {
    const m = n >> 1, out = new Float32Array(m * m * 4);
    for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) {
      let r = 0, g = 0, b = 0, a = 0, wsum = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const i = ((y * 2 + dy) * n + (x * 2 + dx)) * 4;
        const w = src[i + 3] + 0.001;
        r += src[i] * w; g += src[i + 1] * w; b += src[i + 2] * w; wsum += w; a += src[i + 3];
      }
      const o = (y * m + x) * 4;
      out[o] = r / wsum; out[o + 1] = g / wsum; out[o + 2] = b / wsum; out[o + 3] = a / 4;
    }
    if (cutout && targetCov > 0) {
      // scale alpha so that coverage at 0.5 threshold matches level 0
      const alpha = new Float32Array(m * m);
      for (let i = 0; i < m * m; i++) alpha[i] = out[i * 4 + 3];
      let lo = 0.5, hi = 4;
      for (let it = 0; it < 10; it++) {
        const k = (lo + hi) / 2; let c = 0;
        for (let i = 0; i < m * m; i++) if (alpha[i] * k >= 0.5) c++;
        if (c / (m * m) < targetCov) lo = k; else hi = k;
      }
      const k = (lo + hi) / 2;
      for (let i = 0; i < m * m; i++) out[i * 4 + 3] = Math.min(1, alpha[i] * k);
    }
    return out;
  }
  function downsampleMat(src, n) {
    const m = n >> 1, out = new Float32Array(m * m * 4);
    for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) {
      const o = (y * m + x) * 4;
      for (let c = 0; c < 4; c++) {
        let v = 0;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) v += src[((y * 2 + dy) * n + (x * 2 + dx)) * 4 + c];
        out[o + c] = v / 4;
      }
      // flatten normals toward distance (reduces shimmering)
      out[o] = 0.5 + (out[o] - 0.5) * 0.85; out[o + 1] = 0.5 + (out[o + 1] - 0.5) * 0.85;
    }
    return out;
  }

  // Build all layers. opts: {names, cubeMask (Uint8Array per layer), cutoutMask, bevel (0..1), bevelAll (the Klassisch
  // look: the seamless materials get the rim too, so every block shows its edges)}
  VR.buildTextureArrays = function (opts) {
    const names = opts.names, L = names.length;
    const albedo = [], material = [];
    for (let lv = 0; lv < LEVELS; lv++) { const n = N >> lv; albedo.push(new Uint8Array(n * n * 4 * L)); material.push(new Uint8Array(n * n * 4 * L)); }
    const missing = [];
    const avgColor = new Float32Array(L * 4);
    const alb0 = new Uint8Array(N * N * 4), mat0 = new Uint8Array(N * N * 4);
    for (let l = 0; l < L; l++) {
      let img = null;
      try { img = resolve(names[l]); } catch (e) { img = null; missing.push(names[l] + ' (error: ' + e.message + ')'); }
      if (!img) { if (!missing.length || missing[missing.length - 1].indexOf(names[l]) !== 0) missing.push(names[l]); img = missingTex(); }
      // seamless materials (stucco, marble…) opt out of the rim — in the Klassisch look they get the edge line instead
      if (opts.cubeMask && opts.cubeMask[l] && opts.bevel > 0) { if (!img.noBevel) stylize(img, opts.bevel); else if (opts.bevelAll) edgeLine(img, opts.bevel); }
      TX.toArrays(img, alb0, mat0, 0);
      albedo[0].set(alb0, l * N * N * 4); material[0].set(mat0, l * N * N * 4);
      // mips
      let fa = new Float32Array(N * N * 4), fm = new Float32Array(N * N * 4);
      let r = 0, g = 0, b = 0, wa = 0;
      for (let i = 0; i < N * N * 4; i++) { fa[i] = alb0[i] / 255; fm[i] = mat0[i] / 255; }
      for (let i = 0; i < N * N; i++) { const a = fa[i * 4 + 3]; r += fa[i * 4] * a; g += fa[i * 4 + 1] * a; b += fa[i * 4 + 2] * a; wa += a; }
      avgColor[l * 4] = wa ? r / wa : 0; avgColor[l * 4 + 1] = wa ? g / wa : 0; avgColor[l * 4 + 2] = wa ? b / wa : 0; avgColor[l * 4 + 3] = wa / (N * N);
      const cut = opts.cutoutMask ? !!opts.cutoutMask[l] : false;
      const cov0 = cut ? coverage(fa.filter((_, i) => (i & 3) === 3), N, 0.5) : 0;
      let n = N;
      for (let lv = 1; lv < LEVELS; lv++) {
        fa = downsample(fa, n, cut, cov0); fm = downsampleMat(fm, n); n >>= 1;
        const A = albedo[lv], Mt = material[lv], off = l * n * n * 4;
        for (let i = 0; i < n * n * 4; i++) { A[off + i] = Math.round(Math.min(1, fa[i]) * 255); Mt[off + i] = Math.round(Math.min(1, fm[i]) * 255); }
      }
    }
    return { albedo, material, levels: LEVELS, size: N, layers: L, missing, avgColor };
  };

  // 256x256 tileable noise: R fbm(8), G fbm(16), B smooth waves(4+8), A white noise
  VR.buildNoiseTexture = function () {
    const S = VR.TEX_NOISE, out = new Uint8Array(S * S * 4);
    const hh = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
    const vn = (x, y, p, s) => {
      const fx = x / S * p, fy = y / S * p, ix = Math.floor(fx), iy = Math.floor(fy);
      let tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
      const m = (v) => ((v % p) + p) % p;
      const a = hh(m(ix), m(iy), s), b = hh(m(ix + 1), m(iy), s), c = hh(m(ix), m(iy + 1), s), d = hh(m(ix + 1), m(iy + 1), s);
      return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    };
    const fbm = (x, y, p, oct, s) => { let v = 0, amp = 1, tot = 0; for (let o = 0; o < oct; o++) { v += vn(x, y, p << o, s + o * 17) * amp; tot += amp; amp *= 0.5; } return v / tot; };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      out[i] = Math.round(fbm(x, y, 8, 4, 1) * 255);
      out[i + 1] = Math.round(fbm(x, y, 16, 3, 2) * 255);
      out[i + 2] = Math.round((vn(x, y, 4, 3) * 0.6 + vn(x, y, 8, 4) * 0.4) * 255);
      out[i + 3] = Math.round(hh(x, y, 5) * 255);
    }
    return out;
  };
})(VR);
