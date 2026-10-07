# Low-end PC performance & stability audit — 2026-10-07

Branch `stability` (on the v0.39 integration state). Bar: *the lowest computers get the fullest quality and the
fullest smoothness, with fullest in-game stability.* Everything below was measured in node on the 2-CPU build
machine while the regression suite ran beside it (so wall times are noisy; the numbers given are cpu time, best of
several runs, or allocation counts, which do not drift). Nothing changes what a player sees: every fix carries a
node test that hashes the old output (vertices, light, terrain, physics) against the new one.

## 1. Findings

Severity: **S1** a freeze, a loss or a hang · **S2** dropped frames on a small machine · **S3** a startup or memory
cost · **S4** small or cosmetic. Status: **fixed** (commit, test) · **browser** (fixed, needs browser verification) ·
**proposal** (documented, not changed).

| # | Sev | Where | Finding — evidence | Status |
|---|-----|-------|--------------------|--------|
| 1 | S1 | `src/shared/physics.js` P.move/gather/raycast; `src/main/player.js` update/teleport/load; `game.js` /tp | A NaN or infinite velocity moved the body to NaN (world stops loading around a player who is nowhere; the save writes `null`, the next load starts at 0,0,0). A velocity of 3000 blocks swept millions of cells: **7117 ms in one frame**. `/tp a b c` did exactly that. raycast with a zero direction walked 400 cells. | fixed `7b6d783` · test/phys_guard.js (hashed 1500-step walk unchanged; 3000-block move 7117 → 30 ms; NaN cases) |
| 2 | S1 | `src/main/world.js` WorkerPool | A worker that threw (out of memory on a small machine) was only logged: its in-flight jobs never answered — sections `pending` forever (holes that never mesh), columns never loaded, slots counted busy forever (half the pipeline gone on a 2-worker machine). A worker that died said nothing; the boot's texture job could wait forever. | fixed `d28bf46` · test/pool_recover.js (22 checks with fake workers: error → jobs answered, slots free; 45 s silence → replaced + re-told init/custom/style/look/lodinit; mesh retried 3×; gen retried after 5 s; boot retries textures once) |
| 3 | S1 | `src/main/storage.js` saveColumn/saveWorld | `col.modified = false` was set before the write; a refused write (quota, closed connection) only logged → the edits were never saved again, the column regenerated on the next visit. A closed connection failed every save from then on. | fixed `b38013b` · test/store_fail.js (full, closed, recovered) |
| 4 | S1 | `src/main/game.js` boot, `gl.js` | No `webglcontextlost` handler anywhere: after a driver reset / GPU OOM the loop kept drawing a black view forever. | **browser** `4a831fb` (saves, stops the loop, reloads) — verify with `WEBGL_lose_context` |
| 5 | S2 | `src/main/renderer.js` collectVisible | The section flood used a `Set` of big numbers + a growing array and ran **every frame while sections arrive** (visDirty on every upload): **2.9 ms** at render distance 10 (489-column world) → ×3 on a small CPU. | fixed `7834abf` · test/frame_cost.js (same sections, same order; **0.38 ms**) |
| 6 | S2 | `src/main/world.js` scheduleMeshes | Every frame sorted every dirty section (2445 after a look/style switch) to pick 20: **1.95 ms**, and scanned even when the workers were full. | fixed `7834abf` (bounded selection, early out when full; **1.17 ms**, ~0.9 of it the 20 jobs themselves) |
| 7 | S2 | `src/main/world.js` buildJob | Cell-by-cell copy of the 20³ padded section, 20 jobs a frame: 37 µs each. | fixed `7834abf` (row copies, cell-for-cell identical on 280 sections; 25 µs) |
| 8 | S2 | `src/shared/voxarch.js` VX.init | The first VX block a thread met painted **all 5381 VX states** for their full-face masks: **730 ms** here (~2 s on a small PC) — on the main thread as one frozen frame the first time the player looked at or bumped into a fence, a table, a lamp post. | fixed `043eb7d` (masks per state on first use; VX.init 730 → 8 ms; masks identical for all 1516 first-pack states, test/vx_cells.js) |
| 9 | S3 | `src/shared/voxmodel.js` registration | 135 first-pack models (voxfurn/voxhome/voxlife/voxtech) built at every start in **every thread** (main + each worker): 535–560 ms of the 870–910 ms registry load. | fixed `043eb7d` · src/shared/voxcells.js (generated) + test/vx_cells.js; load_shared 1.5–1.9 s → 0.6–0.75 s |
| 10 | S3 | `src/shared/voxarch.js` piece cache | 40 000 pieces × ~5 KB = **200 MB per worker** (measured 5.0 KB/piece), then cleared all at once → every piece repainted (cold 72 ms vs warm 11 ms per 16 town sections). | fixed `4cacd96` (two generations of 12 000; ≤ ~120 MB worst; hot pieces survive) · test/vx_cache.js |
| 11 | S2 | `src/shared/mesher.js` emit helpers, meshFluid | Per face: a box, facePos's array, a uv array, two `.slice()` copies of the corner arrays; every fluid block (the whole body of a lake) built closures and side tables before finding it had no face. 20 passes × 16 sections: scavenges land 17, sea 20. | fixed `d379e0a` · test/mesh_same.js (48 sections, both looks, hashed: identical) — scavenges land 6, sea 8; cpu land 622 → 365 ms, sea 717 → 503 |
| 12 | S2 | `src/worker/worker_main.js` toTris | Three `subarray` views per quad (60k objects for a town section), 2.5× slower than a copy loop. | fixed `e19b593` · test/worker_jobs.js (reference expansion identical; 10k quads 2.6 → 1.05 ms) |
| 13 | S2 | `src/shared/light_local.js` | 1 MB queue allocated per column; three passes over all 65536 cells though the sky above the land is empty. | fixed `93636e7` · test/light_same.js (v0.39 algorithm kept as reference: identical on 24 columns incl. 320-high, no-sky; 1.1–1.5 → 0.6 ms) |
| 14 | S3 | `src/shared/gen_realm.js`, `gen_heart.js`, `gen_overworld.js` | A block's climate looked its 4 corners up twice (800 blocks a column); the density scan started at y = 255 above the empty sky. | fixed `27ce8c5` · test/gen_same.js (23 columns, 6 world kinds: identical; 8.1 → 7.8 ms/column of plain land — small) |
| 15 | S3 | `src/main/tex_build.js`, `tex_core.js` | The block textures are forged in worker 0 at every start: **2.5 s cold / 1.0 s warm** here (1832 layers, 19 MB), 3–7 s on a small PC, the main thread waiting behind the loading screen. Profile: recipes (fbm, Img allocations, `forEach` closures) ~60 %, `toArrays` (a closure per pixel, `Math.hypot`) + mip loops ~30 %, GC 10 %. Tried: hoisting the closures and reusing the per-layer arrays — byte-identical, but only ~10 % and within this machine's noise, so **not committed**. | proposal: cache the finished arrays in IndexedDB keyed by a recipe/version hash (≈100 ms to load), or forge in two workers (split the layer range) |
| 16 | S3 | `src/main/game.js` boot | Workers = max(2, min(6, cores − 1)): a 2-core machine runs 2 workers + the main thread while the title world streams. | fixed `a9d3e1a` · test/pool_size.js, test/pool_recover.js: one worker on 1–2 cores, two on 3–4, cores − 2 above (at most 6), capped at 2 on potato and 3 on low. The frame time on a 2-core PC is not measured here (§4, item 9) |
| 17 | S3 | `src/shared/gen_village.js` VG.plan/site, `gen_temple.js` | The first column of a town costs **1.6 s in the worker** (town plan + sites + temple) — once per town per worker (each worker plans the same town again). | fixed `9959bf1` · test/town_slices.js, test/town_gen.js, test/gen_same.js: a town's plan is built in 20 ms slices and the job that needs it waits (`waiting` replies); the Gate Temple too. The chunk's own terrain (100–250 ms per chunk here) is not planning and is unchanged |
| 18 | S3 | `src/shared/gen_overworld.js` carveCaves | Generation 8–40 ms/column; caves ~25 % of plain land (3 trilinear fields per cell). | proposal: sample the cave fields per 4×4×4 cell incrementally — the terrain hash (test/gen_same.js) would move, needs a visual check |
| 19 | S4 | `src/main/horizon.js` update | Quadtree walk with string keys and per-node arrays: measured **0.17 ms/frame** at level 4, 0.06 at level 2. | fine as is |
| 20 | S4 | `src/main/renderer.js` Arena | Fragmentation under churn (3000 live meshes, 10k ops): 1.6 µs per release+alloc, ~500 free entries, 71 % used. | fine as is |
| 21 | S4 | `src/main/game.js` rain hmap | 16 384 `topAt` every 20 frames while it rains: ~0.3 ms amortised. | fine as is |
| 22 | S4 | `src/main/favs.js` | A 1 s interval reading localStorage while something listens; `F.list()` re-reads storage on every call. | fine (one small string) |
| 23 | S4 | `src/main/world.js` restyle | A style change copies every loaded column at once (350 × 128 KB) and queues 350 relight jobs: one hitch, rare. | documented |
| 24 | S4 | localStorage / IndexedDB | Every `localStorage.setItem` is wrapped; `Store.open` falls back to memory; `loadColumn` errors regenerate. | ok |
| 25 | S4 | `src/main/ui.js` icons | Palette icons paint in 6 ms batches per frame (lazy models build on first use) — the first-pack models now follow that path too; a hotbar model icon compiles once (~4 ms). | ok |

## 2. Before / after (node, cpu time unless noted)

| What | Before | After | Test |
|------|--------|-------|------|
| Shared code load (registry; main thread and every worker) | 1.5–1.9 s | 0.6–0.75 s | scratch timing; test/vx_cells.js |
| VX.init (first VX block met by a thread) | 730 ms | 8 ms | test/vx_cells.js (masks identical) |
| collectVisible, rd 10, 489 columns | 2.92 ms/frame | 0.38 ms | test/frame_cost.js |
| scheduleMeshes, 2445 dirty sections | 1.95 ms/frame | 1.17 ms | test/frame_cost.js |
| buildJob (padded section copy) | 37 µs | 25 µs | test/frame_cost.js |
| Mesher, 20 passes × 16 sections: scavenges (land / sea / town) | 17 / 20 / 9 | 6 / 8 / 6 | scratch (--trace-gc); test/mesh_same.js |
| Mesher cpu, land / sea | 622 / 717 ms | 365 / 503 ms | scratch; test/mesh_same.js |
| quads → triangles, 10k quads | 2.6 ms | 1.05 ms | test/worker_jobs.js |
| Column light | 1.1–1.5 ms | 0.6 ms | test/light_same.js |
| P.move with a 3000-block velocity | 7117 ms | 30 ms | test/phys_guard.js |
| VX piece cache, worst case per worker | 200 MB, then a cold restart | ≤ ~120 MB, hot pieces kept | test/vx_cache.js |
| Generation, plain land | 8.1 ms/column | 7.8 ms | test/gen_same.js |
| Town plan, three modern towns (seed 424242), one job | 1.0–1.25 s (two towns), 0.4–0.6 s (one): the whole plan in one job | 20 ms turns (15–61 per town); the planner's own CPU per turn: median ~10 ms, longest ~20 ms; the sliced plan ~8 % more CPU in total (interleaved medians) | test/town_gen.js (before: HEAD 53d558c); test/town_slices.js |
| Gate Temple build, once per world per worker | one synchronous build: 280–290 ms CPU (656–953 ms wall) | 20 ms slices: median 10 ms CPU, longest 14–17 ms; the same temple (hash 31d80e01 both ways) | scratch check (not committed); test/gen_same.js |
| Worker pool, 2-core PC | 2 workers: max(2, min(6, cores − 1)) | 1 worker (the rule for 1–16 cores × presets) | test/pool_size.js |

## 3. Node tests added (all green; `bash test/wt_run.sh <name>.js`)

mesh_same · worker_jobs · light_same · phys_guard · pool_recover · frame_cost · vx_cells (`--write` regenerates
src/shared/voxcells.js after a first-pack model's build changes — the test says so) · vx_cache · gen_same ·
store_fail · pool_size · town_slices. Still green: id_snapshot, model_smoke, housekit, villa_smoke, modern_pack, modern_sheet, look_classic,
variants, style_core, tpl_roundtrip, schem_io, heart_gen, pack, skin_design, genie_brain, genie_raster,
ridge_mesh, ridge_seam (ship_designs needs the test/ships output folder, unrelated).

## 4. Browser-verification checklist (for the coordinator)

1. **Context loss** (`4a831fb`): in play, run `VR.game.renderer.gl.getExtension('WEBGL_lose_context').loseContext()` —
   expect "Graphics were lost — saving…", a reload within ~5 s, the world and inventory as they were. Also as a
   guest (no save, just the reload).
2. **Dead worker** (`d28bf46`): in play, `VR.game.pool.workers[0].terminate()` and fly on — expect the console line
   "Worker 0 did not answer for 45 s — replaced" within ~45 s of its next job, terrain loading on, no permanent
   holes, the horizon tiles and the look (classic/seamless) right on the replacement.
3. **Textures at boot**: temporarily make the textures job throw (e.g. `VR.buildTextureArrays = null` in the worker
   source) — expect one retry then the "could not be built" screen, not a loading screen forever.
4. **Lazy first packs** (`043eb7d`): open the creative inventory's furniture/tech tabs, place a sofa, a lamp post, a
   fence, a kitchen cupboard (Modern Living); look at them, bump into them, break them — icons, collision boxes,
   culling of faces against them as in v0.39. Studio: Möbel/Fassade catalogue thumbnails, the Crafter on a
   first-pack model (vol/pal through the lazy accessors). Check the Modern Living pieces once: their full faces now
   cull the neighbour's hidden face (no visible change expected).
5. **Look switch / style change**: `/look seamless` and back on a Balanced world — the re-mesh runs through (the
   scheduler's bounded selection), no section left unmeshed, frame time under the old one during the re-mesh.
6. **Visibility walk**: fly through caves and over the surface at rd 10–16; cave culling and draw order as before
   (compare `r.stats.sections` and `draws` with v0.39 at the same spot); a world built above 256 (maxSec > 16).
7. **Physics guards**: `/tp a b c` says "/tp x y z — numbers, please"; fall from y 250 in creative; `/fly 8` at full
   speed into walls.
8. **Storage**: fill the origin's quota (DevTools → Application → Storage) and build; expect the console warning,
   the edits still there after the autosave retries once room is made.
9. **Startup timing on a 2-core / 4 GB machine** (potato preset): time to title, time to play; compare worker
   counts 2 vs 1 (finding 16); note the texture forge time (finding 15).
10. **Town plans** (`9959bf1`): fly to the nearest modern town from the spawn and walk in while its columns stream: expect
   no stall while the town is planned, no "did not answer" line in the console, and the town complete within a few
   seconds on a 2-core machine.

## 5. Merge notes

- Block-id order untouched (test/id_snapshot.js green); the first-pack models keep their part states because
  src/shared/voxcells.js lists their cells in build order — **after changing a first-pack model's build, run
  `bash test/wt_run.sh vx_cells.js`; it says when to `--write`**.
- `src/shared/voxcells.js` is new and added to build.js (SHARED and STUDIO_MAIN) and test/load_shared.js right after
  `voxmodel`.
- Behaviour deliberately changed, invisible to players: full-face masks for lazy (late) models are now real instead of
  0 (fewer hidden faces drawn against Modern Living furniture); a failed mesh job is retried 3×, a failed column after
  5 s; a save the database refuses keeps the column modified; `/tp` with non-numbers refuses.
- Worker count and town plans (`a9d3e1a`, `9959bf1`): a 1–2 core machine runs one generation worker (was two); a town's
  plan is built in 20 ms slices and a job that needs it waits (`waiting` replies; the pool keeps its slot). The output is
  unchanged: the plan hashes and test/gen_same.js are identical.
- Presets untouched. No new dependencies. README/ROADMAP untouched.
