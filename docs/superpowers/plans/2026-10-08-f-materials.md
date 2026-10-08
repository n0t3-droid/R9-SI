# F2 · Texturen & Materialien — plan

Spec: docs/superpowers/specs/2026-10-08-realism-wave-design.md, section F2. Branch f-materials, based on v041.

## What

1. **Normal relief for every opaque cube** (forge, tex_build.js + new tex_mat.js). Baseline (measured with a
   scratch script outside the repo, scratchpad/f2/interior.js: interior texels 4…27, rms of the normal xy): 599 cube layers; 78 have no relief at all
   (< 0.02: copper, glazed terracotta, crate sides, neon, mire light, Vollton, quartz pillar …), 48 are < 0.05,
   56 are < 0.1. Recipes that already carry relief (bricks' mortar, plank seams, tile grout, leaf clumps, log rings)
   keep it. Layers below the threshold get a family relief (stone grain, wood fibres, fabric weave, brushed metal,
   plaster pits, a faint generic grain) added to the height field before toArrays; albedo is not touched, so the
   Klassisch outline stays exactly as it is.
2. **Material families** (new tex_mat.js, shared by the worker and the main thread): VR.matFamily(name) → 0 none,
   1 stone, 2 wood, 3 fabric, 4 metal, 5 plaster. Main thread: one R8 row (1 × layers) uploaded as u_fam.
3. **Detail layer** (TERRAIN_FS, tier ≥ 1): micro detail per family at 4 cells per block (the 16-per-block fine octave is not in this build), read from the existing 256² tileable noise (u_noise, no new texture); faded out between 8 and 12 blocks
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

Forge (node, test/tex_materials.js, one process, 1832 layers, on the shared 2-CPU machine): 3716 ms with the relief,
of which the relief calls are 117 ms; 3420 ms without. The rest of the difference is the re-encoding of the relieved
layers. The scratch baseline (scratchpad/f2/base.js, not in the repo) gave 2905 ms on average and 2220 ms in one later
run: the spread here is 30–50 %, so the forge is reported as "the relief is about 3 % of it", not as a ratio.

Render (test/materials.mjs, MEASURE, SwiftShader, 1280×720, the gallery's near view, median of 12 frames after 3
warm-ups, gl.finish plus a one-texel readPixels). Deviation from the spec: the measured scene is the flat-world
gallery (seed 31), not the Heartland plaza (that needs the 'default' world type and the origin from gen_heart.js).
The first run gave 0.3–0.6 ms frames, too fast for a full frame, so the timing was redone with the readPixels sync.
- after (69cfebf): Very Low tier 0 dry 1611.6 ms, tier 1 forced 1611.2 ms · High tier 0 forced 3344.6 ms, tier 3
  3420.8 ms (+2.3 %) · rain: Very Low 1531.7 ms, High tier 3 3493.6 ms. Draws 2 and 1156 tris in every case.
- before (the build of 205d00c, DIST=scratchpad/f2/base/dist, TAG=materials_base, the same test): Very Low dry near
  2388.9 ms (tris 1040), High dry near 4558.1 ms; rain Very Low 1560.1 ms, High 3063.8 ms. That build has no tiers
  and no puddle state, so its two puddle checks fail there (NaN) by design, and its shots are the before look.
- Noise, which decides what these numbers can say: the same Very Low config reads 1611.6 ms in the after run and
  2388.9 ms in the before run (−33 %), and two identical configs in one run differ by 2–5 % (Very Low tier 0 against
  tier 1 forced: 2388.9 and 2447.7 ms). The triangle counts differ too (1156 after, 1040 before: the chunks loaded
  at the time of the measure). So this run does not show the Very Low normal map to be free, and the tier 3 cost
  (+2.3 % inside one run) is inside the noise. A paired run (two builds interleaved in one browser run) would be
  needed for "Very Low never slower"; it was not done.

Shots (test/shots/materials_<preset>_<dry|rain>_<near|far>.png; potato = Very Low, high = High):
- High dry near: the two-high wall reads as stone (chunky speckle), oak planks (seams, grain), red wool (matte, no
  highlight), iron block (steel-blue, sky reflection), stucco (cream), glass (frame lines), the stone patch in front.
- Very Low dry near: the same blocks with less surface detail; the iron block is cream (no metal response at tier 0).
- High rain far: puddles in the hollows of the grass and of the patch, about a sixth of a flat ground: grey reflective
  patches. They read as wet, not as glossy water (no sun glint, no ripples, no dark rim).
- Very Low rain: no puddles (the Very Low preset has wetGround off), the overcast sky only.
- materials.mjs checks, final run: puddles fill (0.94 after 90 s of rain), dry to 0.36 after 4 min; no page errors
  and no shader messages.
- Tests on 69cfebf: materials.mjs ALL OK (exit 0); node set REGRESS_ONLY=node 19 tests, 0 failed.
- classic_v2.mjs on 69cfebf: ALL OK. The Klassisch block grid is found on the flat grass (hill: 3 of 4 rows; grass
  scene: 3 of 4 rows, 9–13 blocks away); no grid in the Nahtlos shots; 0 page errors and no shader messages.
- smoke.mjs on 69cfebf: ALL OK, no page errors.
- texcache.mjs on 69cfebf: ALL OK. The second start takes the textures from the cache (texMs 110 against 3299 ms
  forged), the first world frame comes at 33.3 s against 38.0 s, the look switch forges Nahtlos once, and with
  IndexedDB refused the textures are forged again with the same bytes.
- before (materials_base): pending in the browser queue at the time of writing.
