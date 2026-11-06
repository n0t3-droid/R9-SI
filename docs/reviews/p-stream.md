# p-stream · the world keeps up on Low and Very Low (review: measure first)

The owner: „Auf niedrigen Einstellungen fühlt sich die Welt beim schnellen Fliegen oder beim Laufen in ungeladenes Land
super verzögert an." This review reads the streaming pipeline, measures where the time goes and says what was changed.

## 1 · The pipeline (v042, as read)

| stage | where | what it costs |
|---|---|---|
| request | `world.update` every 2nd frame: the disk of radius `rd + 1` round the loading centre (up to `rd/2` chunks ahead of the motion, 1.6 s of travel), nearest first, the distance discounted ahead; at most `max(6, 4 × workers)` requests in flight | — |
| generate + light | worker `gen`: `generate(cx, cz)` then `computeColumnLight` | **≈ 37 ms** a column (node, seed 1, vgen 16; towns up to 270 ms); the light only **0.4 ms** — splitting it off would save nothing |
| integrate | `onColumn`: section counts, height map, shadow heights, seam light with the 8 neighbours | main thread, ~1 ms |
| mesh | one job per non-empty section, only once all 8 neighbours are generated; nearest first, ≤ 10 jobs in flight per worker | ~5–15 ms a section, 4–8 sections a column |
| upload | `UploadScheduler`: Very Low 1.5 ms, Low 2 ms a frame (F10, measured per byte), in view order | — |
| shown | a column is shown (and fades in) only when *every* section is meshed: until then the far tiles stand in under the chunk mask | — |
| far tiles | `horizon.js`: a quadtree of LOD tiles (4-block cells near, 64 far), lane 1 of the pool with **30 %** of the workers while chunks wait; coarse and near first, ≤ `4 + 2 × workers` in flight | **≈ 40 ms a 128 × 128 tile** = 64 columns' worth of land: ~60 × cheaper per area than chunks |

Workers: `VR.poolSize` = 1 on a 2-core machine, 2 on 4 cores (Very Low capped at 2, Low at 3).

## 2 · Where the latency goes (arithmetic, then measured)

One worker makes ≈ 12–25 columns a second (generation + meshes). A flight crosses the loading disk's front, ~15 columns
wide on Low (`rd` 6): at 20 m/s that is ~19 new columns a second, at 40 m/s ~37, at 80 m/s ~75. So **from about 20 m/s
the chunks cannot keep up on Low, whatever the order** — and the old order still spent the worker on the whole disk:
columns beside and behind the flight that the camera had left before they were ready (generated, never shown, unloaded:
"wasted"). Meanwhile the far tiles — the only thing that can cover the land ahead at that speed — had 30 % of the worker.

Measured (`test/stream_low.mjs`, before = v042):

RESULTS_BEFORE

## 3 · What was changed

RESULTS_FIX

## 4 · Before / after

RESULTS_TABLE
