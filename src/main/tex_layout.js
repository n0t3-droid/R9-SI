// ============================================================================
// Texture array layout, shared by the forge (worker: tex_build.js) and the main thread (the texture cache, tex_cache.js):
// the mip levels, the size of the noise texture, and which layers are full cube faces or cut-outs (from the block tables).
// ============================================================================
(function (VR) {
  'use strict';
  VR.TEX_LEVELS = 6;    // mip levels: 32, 16, 8, 4, 2, 1
  VR.TEX_NOISE = 256;   // the tileable noise texture (VR.buildNoiseTexture)

  // which layers are faces of full opaque cubes (they get the rim), which are cut-out (alpha-coverage mips), which
  // are the faces of leaf cubes (Klassisch: the outline on their solid texels) and which are the faces of block-like
  // models that are not cubes — a top over the whole footprint, a side over the whole width and ¾ of the height:
  // the dirt path and the farmland (Klassisch: chunky and outlined like the ground around them, when their recipe
  // is a natural one)
  // (B1 „🎨 Aussehen": the tables as shipped — a look that borrows another block's textures, and the variant slots,
  // never change which layers are cube faces or cut-outs, so the forged and cached textures never depend on a look)
  VR.textureMasks = function () {
    const R = VR.R, T = R.T, L = R.texNames.length, LK = VR.Looks;
    const cube = new Uint8Array(L), cut = new Uint8Array(L), leaf = new Uint8Array(L), block = new Uint8Array(L);
    const slot0 = LK && LK.slotRange ? LK.slotRange()[0] : -1, nS = slot0 > 0 ? slot0 : T.shape.length;
    const tx = LK && LK.origTex ? (s, f) => LK.origTex(s, f) : (s, f) => T.tex[s * 6 + f];
    const model = LK && LK.origModel ? (s) => LK.origModel(s) : (s) => R.models[s];
    for (let s = 0; s < nS; s++) {
      if (T.shape[s] === VR.SHAPE.CUBE && T.layer[s] === 0 && (T.flags[s] & VR.F.FULL)) for (let f = 0; f < 6; f++) cube[tx(s, f) & 0xfff] = 1;
      if (T.layer[s] === 1) for (let f = 0; f < 6; f++) cut[tx(s, f) & 0xfff] = 1;
      if (T.shape[s] === VR.SHAPE.CUBE && T.layer[s] === 1 && (T.flags[s] & VR.F.LEAVES)) for (let f = 0; f < 6; f++) leaf[tx(s, f) & 0xfff] = 1;
    }
    for (let s = 0; s < Math.min(nS, R.models.length); s++) {
      const md = model(s); if (!md) continue;
      if (T.layer[s] === 1) for (const f of md) cut[f.tex & 0xfff] = 1;
      if (T.layer[s] !== 0) continue;
      for (const f of md) {
        const p = f.p; if (!p || p.length < 12) continue;
        let x0 = 1, x1 = 0, y0 = 1, y1 = 0, z0 = 1, z1 = 0;
        for (let k = 0; k < 4; k++) { x0 = Math.min(x0, p[k * 3]); x1 = Math.max(x1, p[k * 3]); y0 = Math.min(y0, p[k * 3 + 1]); y1 = Math.max(y1, p[k * 3 + 1]); z0 = Math.min(z0, p[k * 3 + 2]); z1 = Math.max(z1, p[k * 3 + 2]); }
        const wx = x0 <= 0 && x1 >= 1, wz = z0 <= 0 && z1 >= 1, tall = y0 <= 0 && y1 >= 0.75;
        if (f.dir === 2 || f.dir === 3 ? wx && wz : f.dir >= 4 ? wx && tall : wz && tall) block[f.tex & 0xfff] = 1;
      }
    }
    for (let l = 0; l < L; l++) if (cube[l]) block[l] = 0;
    if (VR.CUTOUT_TEX) for (const n of VR.CUTOUT_TEX) { const i = R.texIndex[n]; if (i !== undefined) cut[i] = 1; }
    return { cube, cut, leaf, block };
  };
})(VR);
