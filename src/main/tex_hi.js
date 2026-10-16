// ============================================================================
// t-material · hero textures (plan docs/superpowers/plans/2026-10-15-t-material.md, step 6; switch texHi, Balanced and up):
// the sixteen materials seen most round the trailer's places (counted: the faces open to the sky in the chunks round the
// test views of seed 53 — the meadows' grass and soil, sand, the rocks, the hall's floor and stone, the plaza's slate and
// pavers, marble, oak) painted once more at 64 × 64 by the same recipes: the worker evaluates the texture modules again on
// a namespace of its own with VR.TEX_N = 64 (build.js keeps them as VR.TEX_MODS in the worker; every generator keeps its
// joints, seams and grooves the same size on the block — tex_core.js SC — while its noise and specks get finer), and
// builds them with the same builder and options as the Nahtlos look's set. A second, small texture array; a table of one
// byte per layer (its hero + 1, 0: none) tells the terrain shader where to look. The Klassisch look keeps its own
// 16-texel ground (the shader never takes a hero there). Very Low and Low: none, nothing forged.
// ============================================================================
(function (VR) {
  'use strict';
  if ((VR.TEX_N || 32) !== 32) return;   // (the hero forge's own evaluation of these modules: nothing to add there)
  const HI = VR.TexHi = {
    N: 64, LEVELS: 7,
    NAMES: ['grass_top', 'grass_side', 'dirt', 'sand', 'stone', 'ochre_rock', 'umber_rock', 'quartz_block_bottom', 'travertine',
      'temple_stone', 'temple_stone_smooth', 'paver_grey', 'quartz_bricks', 'marble_white', 'log:oak', 'planks:oak'],
  };
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  // the heroes this registry has, in the table's order
  HI.names = function () { const R = VR.R; return R && R.texIndex ? HI.NAMES.filter((n) => R.texIndex[n] !== undefined) : []; };
  // the forge (worker): { albedo[7], material[7], levels, size 64, layers, names, missing, avgColor, ms }, or null when the
  // modules cannot be evaluated again here (the Studio's worker)
  HI.forge = function (o) {
    if (typeof VR.TEX_MODS !== 'function' || !VR.R || !VR.textureMasks) return null;
    const t0 = now();
    const S = Object.create(VR); S.TEX_N = HI.N;
    VR.TEX_MODS(S);
    if (!S.TX || S.TX.N !== HI.N || typeof S.buildTextureArrays !== 'function' || S.TEX_LEVELS !== HI.LEVELS) return null;
    const names = HI.names(), mk = VR.textureMasks(), idx = names.map((n) => VR.R.texIndex[n]);
    const pick = (m) => (m ? Uint8Array.from(idx.map((i) => m[i])) : null);
    const out = S.buildTextureArrays({ names, ids: idx, cubeMask: pick(mk.cube), cutoutMask: pick(mk.cut), leafMask: pick(mk.leaf), blockMask: pick(mk.block), bevel: o && o.bevel !== undefined ? o.bevel : 1, bevelAll: false, classic: false });
    out.names = names; out.ms = Math.round(now() - t0);
    return out;
  };
  // the table: per layer its hero + 1 (0: none)
  HI.map = function (texNames, names) {
    const m = new Uint8Array(texNames.length), at = new Map(texNames.map((n, i) => [n, i]));
    (names || []).forEach((n, k) => { const i = at.get(n); if (i !== undefined && k < 255) m[i] = k + 1; });
    return m;
  };
  // the memory the set takes on the GPU (albedo + material, every level)
  HI.bytes = function (layers) { let n = 0; for (let lv = 0; lv < HI.LEVELS; lv++) n += (HI.N >> lv) * (HI.N >> lv) * 4 * 2 * layers; return n; };
})(VR);
