// ============================================================================
// Texture array builder: resolves recipes, applies the "voxel-art" stylization
// to full-cube faces, builds alpha-coverage-preserving mip chains.
// Runs inside a worker (pure JS, no DOM). Output: per-level RGBA8 arrays.
// ============================================================================
(function (VR) {
  'use strict';
  const TX = VR.TX, N = TX.N;
  const LEVELS = 6; // 32,16,8,4,2,1

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
  const LUM = (c, i) => 0.2126 * c[i] + 0.7152 * c[i + 1] + 0.0722 * c[i + 2];
  // Klassisch v2: the outline — one texel around the tile, darker and a touch greyer (the brighter the material,
  // the darker: a sunlit surface sits on the tone curve's shoulder), and a milder second texel — on top of the gentle
  // rim of stylize(), so a field of one material still shows every block. Cut-outs (leaves) get it on their solid
  // texels only; a texture whose alpha is a tint mask (grass sides) on all of them.
  function outline(img, strength, cut) {
    let lum = 0, n = 0;
    for (let i = 0; i < N * N; i++) { if (cut && img.c[i * 4 + 3] < 0.5) continue; lum += LUM(img.c, i * 4); n++; }
    lum = n ? Math.min(1, lum / n) : 0.5;
    const k0 = (0.13 + 0.09 * lum) * strength, k1 = k0 * 0.35, ds = 0.3 * strength;   // dark: ×0.87 / ×0.95 · white: ×0.78 / ×0.92
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const e = Math.min(x, y, N - 1 - x, N - 1 - y);
      if (e > 1) continue;
      const i = y * N + x, o = i * 4;
      if (cut && img.c[o + 3] < 0.5) continue;
      const l = LUM(img.c, o), m = 1 - (e === 0 ? k0 : k1), g = e === 0 ? ds : ds * 0.5;
      img.c[o] = (img.c[o] + (l - img.c[o]) * g) * m; img.c[o + 1] = (img.c[o + 1] + (l - img.c[o + 1]) * g) * m; img.c[o + 2] = (img.c[o + 2] + (l - img.c[o + 2]) * g) * m;
      img.h[i] -= (e === 0 ? 0.12 : 0.05) * strength;
    }
    // every edge line is either distinctly brighter than the two lines inside it (a bevel highlight, as on the metal
    // blocks) or at least a tenth darker — an edge that sits in a bright band of its own texture (deepstone's
    // stripes) is pushed down; and a recipe with a bright frame of its own (bookshelf, furnace, vent …) still ends
    // up with its whole edge ring at least a tenth darker than its inside
    const solid = (i) => !cut || img.c[i * 4 + 3] >= 0.5, kk = 0.1 * strength;
    const at = [(t, d) => d * N + t, (t, d) => (N - 1 - d) * N + t, (t, d) => t * N + d, (t, d) => t * N + (N - 1 - d)];
    const lineMean = (e, d) => { let s = 0, w = 0; for (let t = 1; t < N - 1; t++) { const i = at[e](t, d); if (!solid(i)) continue; s += LUM(img.c, i * 4); w++; } return w ? s / w : -1; };
    const f = [1, 1, 1, 1];
    for (let e = 0; e < 4; e++) {
      const l0 = lineMean(e, 0), l1 = lineMean(e, 1), l2 = lineMean(e, 2), inner = l1 >= 0 && l2 >= 0 ? (l1 + l2) / 2 : Math.max(l1, l2);
      if (l0 > 0 && inner > 0 && l0 > inner * (1 - kk) && l0 < inner * (1 + kk)) f[e] = inner * (1 - kk) / l0;
    }
    const factor = (x, y) => Math.min(y === 0 ? f[0] : 1, y === N - 1 ? f[1] : 1, x === 0 ? f[2] : 1, x === N - 1 ? f[3] : 1);
    let rl = 0, rw = 0, il = 0, iw = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = y * N + x; if (!solid(i)) continue; const l = LUM(img.c, i * 4); if (x === 0 || y === 0 || x === N - 1 || y === N - 1) { rl += l * factor(x, y); rw++; } else { il += l; iw++; } }
    const cap = rw && iw && rl / rw > (il / iw) * (1 - kk) ? (il / iw) * (1 - kk) / (rl / rw) : 1;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (x > 0 && y > 0 && x < N - 1 && y < N - 1) continue;
      const i = y * N + x; if (!solid(i)) continue;
      const m = factor(x, y) * cap; if (m === 1) continue;
      img.c[i * 4] *= m; img.c[i * 4 + 1] *= m; img.c[i * 4 + 2] *= m;
    }
  }
  // Klassisch v2: the chunky build of a natural recipe — 16×16-style texels (every 2×2 cell takes its first texel's
  // colour, height, roughness, glow and alpha), the same palette, so the ground looks the same from afar but blocky
  // up close, as in the original game. Recipes opt in with img.chunky (TX.chunky); Nahtlos never pixelates.
  function pixelate(img) {
    for (let y = 0; y < N; y += 2) for (let x = 0; x < N; x += 2) {
      const i = y * N + x;
      for (const j of [i + 1, i + N, i + N + 1]) {
        img.c[j * 4] = img.c[i * 4]; img.c[j * 4 + 1] = img.c[i * 4 + 1]; img.c[j * 4 + 2] = img.c[i * 4 + 2]; img.c[j * 4 + 3] = img.c[i * 4 + 3];
        img.h[j] = img.h[i]; img.ro[j] = img.ro[i]; img.em[j] = img.em[i];
      }
    }
  }
  // Klassisch v2: the outline in the mips — the box filter averages a one-texel line away by mip 2, which is what a
  // block 20 blocks away is drawn with. Each of the level's four edge lines is darkened to (1 − k) of the two lines
  // inside it again (its own neighbourhood: a grass side is bright on top and dark below), then the whole level is
  // brightened back to its mean, so a block never gets darker with distance. Solid texels only on cut-outs; levels
  // of 2×2 and smaller are all edge and stay as they are.
  function mipOutline(fa, n, k, cut) {
    if (n < 4) return;
    const solid = (i) => !cut || fa[i * 4 + 3] >= 0.5;
    const at = [(t, d) => d * n + t, (t, d) => (n - 1 - d) * n + t, (t, d) => t * n + d, (t, d) => t * n + (n - 1 - d)];   // top, bottom, left, right: texel t of line d
    const lineMean = (e, d) => { let s = 0, w = 0; for (let t = 1; t < n - 1; t++) { const i = at[e](t, d); if (!solid(i)) continue; s += LUM(fa, i * 4); w++; } return w ? s / w : -1; };   // without the corners
    // (ii) each edge line against the two lines inside it
    const f = [1, 1, 1, 1];
    for (let e = 0; e < 4; e++) {
      const l0 = lineMean(e, 0), l1 = lineMean(e, 1), l2 = lineMean(e, 2);
      const inner = l1 >= 0 && l2 >= 0 ? (l1 + l2) / 2 : Math.max(l1, l2);
      if (!(l0 > 0) || !(inner > 0)) continue;
      const target = inner * (1 - k);
      if (l0 > target) f[e] = target / l0;
    }
    const isEdge = (x, y) => x === 0 || y === 0 || x === n - 1 || y === n - 1;
    const factor = (x, y) => Math.min(y === 0 ? f[0] : 1, y === n - 1 ? f[1] : 1, x === 0 ? f[2] : 1, x === n - 1 ? f[3] : 1);
    // (i) the whole ring against the whole inside
    let rl = 0, rw = 0, il = 0, iw = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const i = y * n + x; if (!solid(i)) continue; const l = LUM(fa, i * 4); if (isEdge(x, y)) { rl += l * factor(x, y); rw++; } else { il += l; iw++; } }
    if (!rw || !iw) return;
    const ring = rl / rw > (il / iw) * (1 - k) ? (il / iw) * (1 - k) / (rl / rw) : 1;
    if (ring === 1 && f[0] === 1 && f[1] === 1 && f[2] === 1 && f[3] === 1) return;
    // keep the level's mean: before = Σ l (solid), after = Σ l · factor · ring (edge) + Σ l (inside)
    let before = 0, after = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const i = y * n + x; if (!solid(i)) continue; const l = LUM(fa, i * 4); before += l; after += l * (isEdge(x, y) ? factor(x, y) * ring : 1); }
    const norm = after > 0 ? before / after : 1;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x; if (!solid(i)) continue;
      const o = i * 4, m = (isEdge(x, y) ? factor(x, y) * ring : 1) * norm;
      fa[o] = Math.min(1, fa[o] * m); fa[o + 1] = Math.min(1, fa[o + 1] * m); fa[o + 2] = Math.min(1, fa[o + 2] * m);
    }
  }
  const MIP_OUTLINE = [0, 0.12, 0.12, 0.06];   // k per mip level (32, 16, 8, 4)

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

  // which layers are faces of full opaque cubes (they get the rim), which are cut-out (alpha-coverage mips) and which
  // are the faces of leaf cubes (Klassisch: the outline on their solid texels)
  VR.textureMasks = function () {
    const R = VR.R, T = R.T, L = R.texNames.length;
    const cube = new Uint8Array(L), cut = new Uint8Array(L), leaf = new Uint8Array(L);
    for (let s = 0; s < T.shape.length; s++) {
      if (T.shape[s] === VR.SHAPE.CUBE && T.layer[s] === 0 && (T.flags[s] & VR.F.FULL)) for (let f = 0; f < 6; f++) cube[T.tex[s * 6 + f] & 0xfff] = 1;
      if (T.layer[s] === 1) for (let f = 0; f < 6; f++) cut[T.tex[s * 6 + f] & 0xfff] = 1;
      if (T.shape[s] === VR.SHAPE.CUBE && T.layer[s] === 1 && (T.flags[s] & VR.F.LEAVES)) for (let f = 0; f < 6; f++) leaf[T.tex[s * 6 + f] & 0xfff] = 1;
    }
    for (let s = 0; s < R.models.length; s++) { const md = R.models[s]; if (md && T.layer[s] === 1) for (const f of md) cut[f.tex & 0xfff] = 1; }
    if (VR.CUTOUT_TEX) for (const n of VR.CUTOUT_TEX) { const i = R.texIndex[n]; if (i !== undefined) cut[i] = 1; }
    return { cube, cut, leaf };
  };
  // Build all layers. opts: {names, cubeMask (Uint8Array per layer), cutoutMask, leafMask, bevel (0..1), bevelAll (the
  // Klassisch look: the seamless materials get the rim too, so every block shows its edges), classic (Klassisch v2,
  // defaults to bevelAll: chunky natural recipes, the outline on every cube and leaf texture, kept through the mips)}
  VR.buildTextureArrays = function (opts) {
    const names = opts.names, L = names.length;
    const classic = opts.classic !== undefined ? !!opts.classic : !!opts.bevelAll;
    const leafMask = opts.leafMask || (classic && VR.R && VR.R.texNames === names ? VR.textureMasks().leaf : null);
    const albedo = [], material = [];
    for (let lv = 0; lv < LEVELS; lv++) { const n = N >> lv; albedo.push(new Uint8Array(n * n * 4 * L)); material.push(new Uint8Array(n * n * 4 * L)); }
    const missing = [];
    const avgColor = new Float32Array(L * 4);
    const alb0 = new Uint8Array(N * N * 4), mat0 = new Uint8Array(N * N * 4);
    for (let l = 0; l < L; l++) {
      let img = null;
      try { img = resolve(names[l]); } catch (e) { img = null; missing.push(names[l] + ' (error: ' + e.message + ')'); }
      if (!img) { if (!missing.length || missing[missing.length - 1].indexOf(names[l]) !== 0) missing.push(names[l]); img = missingTex(); }
      const isCube = !!(opts.cubeMask && opts.cubeMask[l]), isLeaf = !!(leafMask && leafMask[l]);
      // Klassisch v2: the natural recipes chunky (before the rim, which stays one texel)
      if (classic && img.chunky && (isCube || isLeaf)) pixelate(img);
      // seamless materials (stucco, marble…) opt out of the rim — in the Klassisch look they get the edge line instead
      if (isCube && opts.bevel > 0) { if (!img.noBevel) stylize(img, opts.bevel); else if (opts.bevelAll) edgeLine(img, opts.bevel); }
      // Klassisch v2: the outline on every cube texture (the seamless materials have their stronger edge line) and leaf
      const outlined = classic && ((isCube && !img.noBevel) || isLeaf);
      if (outlined) outline(img, 1, isLeaf);
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
      const keepEdge = classic && (isCube || isLeaf);
      let n = N;
      for (let lv = 1; lv < LEVELS; lv++) {
        fa = downsample(fa, n, cut, cov0); fm = downsampleMat(fm, n); n >>= 1;
        if (keepEdge && MIP_OUTLINE[lv]) mipOutline(fa, n, MIP_OUTLINE[lv], isLeaf);
        const A = albedo[lv], Mt = material[lv], off = l * n * n * 4;
        for (let i = 0; i < n * n * 4; i++) { A[off + i] = Math.round(Math.min(1, fa[i]) * 255); Mt[off + i] = Math.round(Math.min(1, fm[i]) * 255); }
      }
    }
    return { albedo, material, levels: LEVELS, size: N, layers: L, missing, avgColor };
  };

  // 256x256 tileable noise: R fbm(8), G fbm(16), B smooth waves(4+8), A white noise
  VR.buildNoiseTexture = function () {
    const S = 256, out = new Uint8Array(S * S * 4);
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
