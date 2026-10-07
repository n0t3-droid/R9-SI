// ============================================================================
// Texture array layout, shared by the forge (worker: tex_build.js) and the main thread (the texture cache, tex_cache.js):
// the mip levels, the size of the noise texture, and which layers are full cube faces or cut-outs (from the block tables).
// ============================================================================
(function (VR) {
  'use strict';
  VR.TEX_LEVELS = 6;    // mip levels: 32, 16, 8, 4, 2, 1
  VR.TEX_NOISE = 256;   // the tileable noise texture (VR.buildNoiseTexture)

  // which layers are faces of full opaque cubes (they get the rim) and which are cut-out (alpha-coverage mips)
  VR.textureMasks = function () {
    const R = VR.R, T = R.T, L = R.texNames.length;
    const cube = new Uint8Array(L), cut = new Uint8Array(L);
    for (let s = 0; s < T.shape.length; s++) {
      if (T.shape[s] === VR.SHAPE.CUBE && T.layer[s] === 0 && (T.flags[s] & VR.F.FULL)) for (let f = 0; f < 6; f++) cube[T.tex[s * 6 + f] & 0xfff] = 1;
      if (T.layer[s] === 1) for (let f = 0; f < 6; f++) cut[T.tex[s * 6 + f] & 0xfff] = 1;
    }
    for (let s = 0; s < R.models.length; s++) { const md = R.models[s]; if (md && T.layer[s] === 1) for (const f of md) cut[f.tex & 0xfff] = 1; }
    if (VR.CUTOUT_TEX) for (const n of VR.CUTOUT_TEX) { const i = R.texIndex[n]; if (i !== undefined) cut[i] = 1; }
    return { cube, cut };
  };
})(VR);
