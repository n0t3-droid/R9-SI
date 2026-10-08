# F2 · Texturen & Materialien — plan

Spec: docs/superpowers/specs/2026-10-08-realism-wave-design.md, section F2. Branch f-materials, based on v041.

## What

1. **Normal relief for every opaque cube** (forge, tex_build.js + new tex_mat.js). Baseline (measured with
   test/… scratch script, interior 24×24 texels, rms of the normal xy): 599 cube layers; 78 have no relief at all
   (< 0.02: copper, glazed terracotta, crate sides, neon, mire light, Vollton, quartz pillar …), 48 are < 0.05,
   56 are < 0.1. Recipes that already carry relief (bricks' mortar, plank seams, tile grout, leaf clumps, log rings)
   keep it. Layers below the threshold get a family relief (stone grain, wood fibres, fabric weave, brushed metal,
   plaster pits, a faint generic grain) added to the height field before toArrays; albedo is not touched, so the
   Klassisch outline stays exactly as it is.
2. **Material families** (new tex_mat.js, shared by the worker and the main thread): VR.matFamily(name) → 0 none,
   1 stone, 2 wood, 3 fabric, 4 metal, 5 plaster. Main thread: one R8 row (1 × layers) uploaded as u_fam.
3. **Detail layer** (TERRAIN_FS, tier ≥ 1): micro detail per family at 4 cells per block (coarse) and 16 per block
   (fine), read from the existing 256² tileable noise (u_noise, no new texture); faded out between 8 and 12 blocks
   from the eye; damped to 10 % on the outermost texel line so the outline stays on top. Tier 2 adds the gradient
   normal (two more fetches); tier 3 adds the fine octave and the varnished-wood sheen.
4. **Wet look** (tier ≥ 1, only with the wetGround setting, as before): top faces lose roughness in the rain and take
   a thin sky-coloured specular layer (cheap env term from u_skyHorizon / u_skyZenith); puddles collect where a
   low-frequency noise field is low, on upward faces only; the puddle state (env.js, E.puddle) rises in ~30 s of rain
   and dries with a 4 min time constant, so it is still there minutes after the rain stopped.
5. **Material response**: metal (family 4) reflects the env term tinted by its albedo; glass gets a fresnel rim;
   fabric (family 3) is matte (roughness 0.97, no highlight); varnished wood sheen on tier 3.
6. **Normal maps on Very Low**: the LITE shader used to ignore the normal map. The baked normal is now used on every
   tier (it costs one normalize, no extra fetch). If that shows as a measurable Very Low cost, it is gated again.

## Order

1. Scratch baseline (forge time and interior normal relief per layer, before any change). Done.
2. Node tests first: test/tex_materials.js (every cube has relief ≥ 0.05 interior rms, roughness/normal/alpha sane,
   family table covers all layers with known samples). It fails on the baseline (78 flat cubes).
3. tex_mat.js + relief in tex_build.js → node test green; forge time before/after (node, same process, 3 runs).
4. Renderer plumbing: family texture, u_matTier, u_puddle; PRESETS.matTier (potato 0, low 1, balanced 2, high 3,
   ultra 3); env.js puddle state.
5. Shader: normal map on LITE, detail layer, wet look, metal/glass/fabric/wood response.
6. test/materials.mjs: gallery wall (stone, wood, fabric, metal, plaster, glass) at 3 and 30 blocks, dry and rain,
   Very Low and High → test/shots/materials_*.png; LOOK at them; iterate.
7. Regression: node set (tex_check.js included), smoke.mjs, classic_v2.mjs, texcache.mjs, materials.mjs.

## How it is measured

- Forge time: node, the same modules as the worker bundle, three runs after a warm-up, the mean. Baseline
  2998 ms (first run 4598 ms, the JIT warm-up). The relief pass must add less than 15 % of the forge time.
- Relative render cost (renderer.stats): the fixed scene of the spec (Heartland, seed 1, noon, 1280×720), 60
  frames after warm-up, the median of renderer.stats.ms and the draw/triangle counts, on Very Low (potato) and on
  High, with the new code and with the effect switched off (matTier 0 for the detail; wetGround off for the wet
  look). SwiftShader is CPU-side, so these are relative numbers only. Before/after numbers go in the "Measured"
  section below.
- Visual: test/materials.mjs writes the screenshots; they are read with the Read tool before anything is claimed.

## Known limits (written before the work)

- "Near water" wetness is not in the first cut: the shader has no per-fragment water distance. Puddles and rain only.
- The metal reflection uses the sky's two colours (horizon/zenith). F1's sky LUT replaces it when F1 lands; the
  call sites are one function (matEnv in TERRAIN_FS and TRANS_FS).
- Family rules are by name (tex_mat.js). Names that match nothing get family 0 (no detail) and only the generic relief.

## Measured

(filled in during the work: forge ms before/after; Very Low and High render costs before/after; screenshots)
