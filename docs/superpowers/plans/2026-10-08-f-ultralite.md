# F9 · Ultra für schwache PCs — „Ultra · Leicht" (plan, 9 Oct 2026)

Branch f-ultralite (on v041 + v0.43; the realism-wave spec has no F9 section: the coordinator's task is the section).
Every edit to the files other fronts touch (renderer.js, shaders.js, game.js PRESETS, settings_reg.js, world.js) is
additive and kept in its own methods or behind a switch that is off unless the new preset (or the player) turns it on.

## The machine and the goal

The owner's PC (measured by the coordinator in the built-in browser): AMD Radeon Graphics 0x1638 — an integrated Vega
of a Ryzen APU (shared memory, no own VRAM), 16 threads, 32 GB, 1920 × 1080, D3D11 through ANGLE. At 1280 × 720 the
governor dropped Balanced → Low and the game ran ~20 fps, GPU-bound: gpu 17–21 ms, js 5–6 ms. Ultra cannot be held.
He wants Ultra „super problemlos": „ich will alles super realistisch aussehen haben aber irgendwie hängt das mit der
Weltgenerierung usw. und die Schatten sind auch ziemlich belastbar — finde super intelligente Wege".

Goal: Ultra's picture (shadows 3, rays, bloom, water 2, ring 1 to 64 chunks, vxLod 96, smoothPlants 2, folk 120) as a
preset an integrated Vega holds at ≥ 50 fps at 1920 × 1080, by spending the GPU where the eye looks and reusing what did
not change. Very Low never slower; the default presets' scheduling unchanged (test/frame_cost.js EXPECT '47f25156').

## What the code does today (read before designing)

- **Shadows** (renderer.renderShadows): one map (3072² on shadows 3, ±96 blocks), cached — but redrawn WHOLE when
  (1) the sun's quantized angle steps (0.0044 rad ≈ 0.25°: the sun turns 0.3°/s, so every ~0.84 s), (2) the camera
  moved > 0.18 R (17 blocks), (3) ANY section upload/free/VX upload within R + 24 blocks (`shadowDirty`) — while one
  walks through a town the VX detail of the next houses streams in and the map is redrawn nearly every frame —
  (4) the size changes. A redraw draws every caster section within ±(R/16 + 1) columns (and the props) into the whole
  map. The PCF is already cheap: 4 hardware-filtered compare taps (2 × 2 each), not 16 separate taps.
- **Streaming** (F8, world.js + stream.js): uploads go through an UploadScheduler with a per-frame ms budget
  (q.upload: 1.5 … 3 ms) in view order; mesh-job starts share it (4 per ms); stale gen requests (beyond rd + 3 from the
  load centre) are cancelled when their turn comes. NOT budgeted: a generated column's arrival (`onColumn`: section
  counts, heights, sun-layer, seam light BFS, dirtying the neighbours) runs in the worker's message handler between two
  frames — with 6 workers several land in one frame gap, and the loop's own `jsMs` never sees them.
- **Governor** (game.js smartQuality): GPU ladder shadowEvery 2 → rays off → vxLod × 0.6 → half shadow map → simple
  clouds → scale − 0.1 → scale − 0.2; CPU ladder stream rungs → sim → folk 56 → mesh 3. Since the WIP: Ultra runs it
  (dynRes on) and the steps that held are remembered per GPU.
- **Water mirror** (reflectPass): tier 2 at ½ × ½ of the frame, sections within 160 blocks, the props as in the main pass
  (tier 2), the horizon; no folk. Sampled once, plainly bilinear, shifted by the waves.
- **Props / furniture** (drawProps): already one instanced draw per model and distance band (near, far, glass), the
  terrain's sections already multi-drawn per arena.

## Design — five switches, one preset

Each switch is a setting (Bild · Qualität, cost 🟢), off on every preset but the new one, and each has its own node test.

### 2 · Schatten-Takt (`shadowTakt`) — the owner's main complaint
The same map (3072², ±96 blocks, same texel lattice, same PCF) — only how it is kept up to date changes:
- **Toroidal map, tiles.** The map is addressed with wrap-around (texel = light-space position mod 2R, REPEAT
  sampling; one uniform offset in the shaders' lookup, 0 = today's addressing): when the camera walks, the window moves
  by whole tiles (8 × 8 tiles of 24 blocks) and only the strip of tiles that enters is drawn (scissored) — no full
  redraw every 17 blocks, no copy. Depth is measured from a fixed light-space origin (re-based, i.e. a full redraw,
  only when the camera drifts > 64 blocks from it).
- **Incremental by section.** A section upload/free marks only the tiles under its light-space footprint dirty
  (instead of `shadowDirty` = all). Dirty tiles are redrawn with the casters that overlap them (scissor + clear + draw
  culled by the tile's sub-frustum).
- **Cadence by ring** (the task's cascades, mapped onto the tiles): dirty tiles in ring 0 (the 2 × 2 around the eye) are
  redrawn the same frame, ring 1 every 2nd frame, ring 2 (the outer tiles) every 4th.
- **Sun steps without a hitch.** When the quantized sun angle steps (> 0.25°), the new map is built in a second buffer
  over K = 4 frames — a quarter of the casters each frame (depth is order-independent: no overlap cost) — while the old
  one is sampled; then the two swap. A full redraw's work, spread over 4 frames, once per ~0.84 s.
- Measured: shadow redraws per second and shadow ms per frame (min / mean / max) standing and walking at the hall, the
  plaza and a village, Ultra vs Ultra-Lite.
- (c) the two-rate map (far half at half resolution) and (d) 16 → 9 taps: see "decisions" below.

### 5 · Weltgenerierung im Takt (`streamTakt`)
- **Arrivals queued**: a generated column waits in a queue and is integrated (`onColumn`) in the frame, within the
  frame's streaming budget — at least one per frame, so the world never stalls.
- **Budget from headroom**: per frame the mesh-job starts and the column integrations get
  `clamp((budget − gpuMs − jsMs) × k, min, max)` ms (budget = 1000/55 ms); a frame already over budget streams the
  minimum, an idle one streams fast. Pure function `VR.UL.streamBudget`, node-tested.
- **Bytes**: uploads also stop at 2 MB per frame (the F8 scheduler's ms budget stays; a byte cap is added beside it).
- **Away from**: queued gen jobs whose column is now outside the load radius around the player AND behind the direction
  of travel are cancelled at once (not only beyond rd + 3); the queue is re-prioritized by the current position every
  half second, so what lies ahead goes first.
- Measured: frames over 40 ms (main-thread loop + worker-message time) while walking 200 m, Ultra vs Ultra-Lite.

### 1 · Fern-Cache (`farCache`)
The sky, the sections beyond renderDist/2 chunks, ring 1 and the horizon tiles are drawn into a cached colour + depth
target and re-composited (reprojected with the cached depth: exact for turning, a two-step fixed-point search for the
small translations) while the camera stays within 1.5 m and 6° of the cache's camera, for at most 500 ms, and the time
of day moved < 2 game minutes; the near world is drawn live over it with the depth test (the composite writes the
reprojected depth). Pure staleness rule `VR.UL.farStale`, node-tested. Measured: GPU (SwiftShader) ms saved at the
hall, plaza and village, cached frame vs refresh frame vs Ultra.

### 4 · Möbel-Bündelung (`furnBatch`)
Count first: draw calls by kind at the villa and the Nova Haven plaza (terrain multi-draws, props by model, folk,
horizon, ring 1, entities). If the furniture's per-model draws are a real share: one multi-draw-instanced call for all
near furniture models (instance data from a float texture indexed by gl_DrawID + gl_InstanceID), the same for the far
boxes and the glass. The VX detail meshes are unchanged.

### 3 · Spiegelung leicht (`reflLite`)
The water mirror at ¼ × ¼ of the frame instead of ½ × ½, sharpened by a depth-aware 4-tap upsample in the water shader
(the mirror's nearest surface wins at an edge, so silhouettes stay crisp); sections only within 96 blocks (the horizon
covers beyond); the props at their far forms only; no folk (as today). Measured: reflMs at a lake, before/after.

### 6 · The preset „Ultra · Leicht" (`ultraLite`)
Ultra's look values + farCache, shadowTakt, streamTakt, reflLite, furnBatch on. The governor on Ultra and Ultra-Lite
takes cheap rungs first — far-cache refresh (500 → 1000 ms), shadow cadence (rings × 2), mirror ¼, folk 72 — before
rays, VX detail, shadow size, clouds and only then resolution; the view distance never. The ladders only list rungs that
change something with the current settings (a no-op rung would fail its probe and block the ladder for 30 s).
⚡ Automatik: on an integrated GPU (`VR.GL.rendererName` with Radeon Graphics, Vega, Iris, UHD, Intel, Adreno, Mali,
Apple M) the top of the ladder is Ultra-Lite and the run starts there, then measures; a dedicated GPU keeps Ultra.
Settings: the preset in the list with its tip; settings_reg rows for the switches (Bild · Qualität, cost low); all texts
in lang_de.js / lang_en.js.

### 7 · Tests
Node: ultralite_shadow.js (tile/wrap math, ring cadence, footprint → tiles, sun-step key, rebuild progress),
ultralite_far.js (staleness rules), ultralite_stream.js (budget rule, byte cap, cancel-away rule), ultralite_preset.js
(preset values, rung order, Automatik choice by a stubbed renderer name, settings rows, texts), ultra_smart.js (kept
green). Browser: test/ultralite.mjs — Ultra vs Ultra-Lite at the hall, the plaza and a village (gpu ms, draws, shadow ms,
long frames while walking 200 m), the same view shot in both (test/shots/ultralite_*.png), Very Low before/after.

## Measuring

SwiftShader renders on the CPU: absolute times mean little, relative costs do. Passes are timed with
`renderer.timePasses` (test only: gl.finish() at each pass boundary, ms per pass in `renderer.stats.passMs`); frames
with gl.finish(). The same scenes, seed 4242 (vgen 8), noon, 1280 × 720: the hall (0.5, 81, −9.5), the Nova Haven fork
(F1 of trailer_city), a village street. Very Low before (v0.43 dist built in the scratchpad) and after.
The owner's saving is estimated from the measured shares (stated as an estimate: a real GPU weighs vertex work less).

## Decisions taken up front

- Cascades are not added: a second and third map would change the shadows' look and double the sampling. The tiled
  map gives the same thing the cascades were asked for (near updated every frame, far less often) with the same picture.
- (c) A two-rate map would need a second texture or an atlas and a second lookup per pixel; with the incremental map the
  redraws are rare and local, so half-resolution far tiles would save little — not done (measured share in the results).
- (d) The PCF is 4 hardware-bilinear taps already (16 texel compares in 4 fetches); "9 rotated taps" would be more
  fetches, and per-pixel noise rotation flickers without TSR (Ultra renders at 100 %: no TSR). Not done.

## Order and commits

WIP split (done: 6ef16a5, 18e2918) → plan → baseline probe → 2 → 5 → 1 → 4 → 3 → 6 → 7 full run. Commit after each.

Done: 5476fd8 Schatten-Takt · 43d309d Weltgenerierung im Takt · f52be05 Fern-Cache · 1d1ec48 Spiegelung leicht ·
88ea20e the preset, rungs, Automatik, settings · d3b303a the measuring browser test. Step 4 (furniture batching): see
the decision below.

## As built (where it differs from the design above)

- Shadow tiles: 16 × 16 tiles of 12 blocks (finer than 8 × 8 × 24: a section's footprint redraws less); window
  hysteresis 0.75 tile; depth origin re-based after 64 blocks; a sun step is built over **6** frames (not 4); the
  casters' light-space boxes are cached per section; the VX/props flips (near ↔ far forms at 28 blocks) mark their tiles.
- Stream budget: `VR.UL.Stream.budget(gpu, js) = clamp((max(1000/55, gpu) − js) × 0.6, 0.75, 4)` ms — the CPU and the
  GPU work in parallel, so the main thread's headroom is the longer of the two minus the loop's own time (the
  design's `budget − gpu − js` would give a GPU-bound frame no streaming at all — the very frames that have CPU to
  spare). Half of it integrates arrivals, half spreads seam light; mesh-job starts 4 per ms of it.
- Seam light: deferred (the design only queued the arrivals; the seam light's walk was the heavy tail).
- Far cache: drawn a vertical strip a frame (4 strips: in each the sky, the far sections culled by the strip's frustum,
  ring 1 and the horizon tiles — run 1 drew the sky with the first third of the sections and the horizon alone in the
  last slice: those two frames cost as much as Ultra's whole frame, 10.3 and 10.1 s against 11.4 s at the plaza, the
  middle ones 4.7 and 5.0 s); the near radius max(48, rd × 8) blocks; the cache is overscanned by the view's cone
  widened 7.5° (not per axis), drawn at the screen's pixel density; stale after 1.5 m / **4°** (3.5° of the overscan
  left while the next is drawn) / 500 ms / the sun 0.5° (≈ 2 game minutes) / a resize. Nothing to show (the first
  frames, a jump) → the frames draw live while the cache is drawn (never the whole cache in one frame); running faster
  than 10 m/s or turning faster than 90°/s → live, and no cache is drawn that would be off before it is done.
- Furniture batching (step 4) is not built — see Results.
- The light mirror reaches 96 blocks with the props' far forms; a governor rung draws it every other frame.

## What the baseline showed (v0.43 dist, Ultra, render distance 8, SwiftShader)

- Walking 60 m with the day running (420 frames, shadow work only): **188 full shadow-map redraws** — the cached
  map was redrawn on 45 % of the frames (section and VX uploads near the eye, the sun's 0.25° steps, 17-block moves).
- Walking 200 m (1 397 frames, nothing drawn): 5 frames over 40 ms, the longest 86 ms; the worker messages handled
  between two frames took up to 61 ms — a column's arrival (counts, heights, seam light) in the message handler.
- (The first baseline timed passes with gl.finish, which returns before the GPU process has drawn; the test now syncs
  with a one-texel read, as test/materials.mjs and far.mjs do.)

## Node-test results (stub GL where the renderer is involved)

| switch | test | what it shows |
|---|---|---|
| Schatten-Takt | ultralite_shadow.js | the toroidal map is exact (a point drawn into its tile lands on the texel the lookup reads: worst error 0.0000 texels over 391 points; the same depth); a changed section near the eye redraws 230 of 1 115 section draws (21 %, scissored) instead of the whole map; walking 40 blocks costs 210 section draws in all (the old cache: a full map every 17 blocks and on every upload); a sun step is drawn over 6 frames (164 · 211 · 207 · 203 · 177 · 113 draws), then the maps swap; standing still draws nothing |
| Weltgenerierung im Takt | ultralite_stream.js | six columns answered between two frames wait and go in one a frame (budget 1 ms), nearest first, never asked twice; a GPU-bound frame (gpu 22, js 5 ms) streams at the most (4 ms), a CPU-bound one (js ≥ 17.5 ms) at the least (0.75 ms); 10 uploads of 600 KB: 3 a frame (2 MB); queued generations behind a walking player near the edge are cancelled (cx −1 … −7), the queue re-ordered to where the player is (4 5 3 6 first); the seam light spread over frames (the seeds at the arrival, the light-increase walk a little a frame, its end independent of order): nine town columns identical cell for cell (589 824 cells), the median step 0.4–0.5 ms at a 0.3 ms budget; the columns round a spreading seam wait to be meshed, at most 8 frames; a block edit finishes the spreading first |
| (measurement) | ultralite_arrival.js | 25 Nova Haven columns in a walk's order, each the least of 3 runs: the old arrival 0.3 ms median, the heaviest 1.7 ms, all 9 ms; in the takt 0.2 ms median, the heaviest 0.4 ms, all 6 ms, plus 2 ms of spreading in 24 steps; the light identical (1 638 400 cells). Single runs on this shared machine scatter to 13–159 ms (GC, scheduling, the first JIT run) — the takt's gain is that such work no longer lands in one frame |
| Fern-Cache | ultralite_far.js | stale after 1.56 m (not 1.4), 6.5° (not 5.5°), 501 ms, the sun 0.6°; the cache 1.38 × 1.48 the screen (every screen edge turned 7.5° any way stays inside, worst ndc 0.999) at the screen's pixels per unit of view; the first frame builds it whole (429 far sections in view, the horizon once); standing 20 frames: 0 far draws; a 2 m step: 146 · 146 · 137 far draws then ring 1 and the tiles, one slice a frame; a 60 m/s run draws live |
| Spiegelung leicht | ultralite_refl.js | the mirror 320 × 180 (Ultra 640 × 360) at 1280 × 720, 113 sections (Ultra 317) within 96 blocks, the props' far forms, read edge-aware; water 1 unchanged |
| preset | ultralite_preset.js | Ultra · Leicht = Ultra's look + the four switches; the other presets off; the rungs (below); Automatik by GPU name |

Governor ladders (aqGpuRungs), from ultralite_preset.js:
- Ultra · Leicht: far cache ×2 patient → shadow tiles ½ as often → the mirror every other frame → folk to 72 blocks →
  rays off → VX detail 0.6 → half shadow map → simple clouds → resolution −10 % → −20 %. The view distance never.
- Ultra: shadow tiles/map ½ as often → the light mirror → folk to 72 → rays → … → resolution. High and below: unchanged.

## Results

(browser measurements: filled in from test/ultralite.mjs)

## Known gaps

(filled in at the end)

## Merge notes

(filled in at the end)
