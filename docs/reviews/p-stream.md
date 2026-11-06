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

A flight crosses the loading disk's front, ~15 columns wide on Low (`rd` 6): at 20 m/s that is ~19 new columns a
second, at 40 m/s ~37, at 80 m/s ~75. One worker on this server makes ~37 columns a second with their meshes (measured
below); a low-end laptop's core a third to a quarter of that. So **on the owner's PC the chunks cannot keep up from about
20 m/s, whatever the order** — and the old order still spent the worker on the whole disk:
columns beside and behind the flight that the camera had left before they were ready (generated, never shown, unloaded:
"wasted"). Meanwhile the far tiles — the only thing that can cover the land ahead at that speed — had 30 % of the worker.

Measured (`test/stream_low.mjs`, before = v042):

This server (2 cores → **one worker**; SLOW = 1, its core makes a column in ~15 ms), v042, seed 1, 30 s per run:

| preset | m/s | time-to-visible med / p90 ms | entered, never shown % | real % | coarse % | void % | columns made | made, never shown | meshes | lane-0 queue / oldest ms | upload queue max | tick p99 / max ms |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Niedrig | 5 | 1084 / 3998 | 14 | 99.9 | 0.1 | 0 | 160 | 43 (27 %) | 910 | 14 / 1644 | 14 | 10.4 / 20.5 |
| Niedrig | 20 | 262 / 531 | 10 | 100 | 0 | 0 | 605 | 93 (15 %) | 3154 | 16 / 1603 | 46 | 13 / 30 |
| Niedrig | 40 | 364 / 709 | 23 | 98.7 | 1.3 | 0 | 1116 | 212 (19 %) | 5577 | 16 / 2631 | 31 | 16.3 / 76.5 |
| Niedrig | 80 | 733 / 972 | 92 | 24.3 | 75.7 | 0 | 1463 | 735 (50 %) | 4428 | 16 / 1946 | 15 | 17.2 / 31.3 |
| Sehr niedrig | 5 | 1344 / 5197 | 18 | 99.1 | 0.9 | 0 | 138 | 39 (28 %) | 759 | 15 / 1951 | 99 | 16.8 / 254.2 |
| Sehr niedrig | 20 | 574 / 820 | 5 | 100 | 0 | 0 | 521 | 92 (18 %) | 2623 | 16 / 900 | 103 | 8.1 / 51.1 |
| Sehr niedrig | 40 | 895 / 1452 | 56 | 85.1 | 14.9 | 0 | 1035 | 269 (26 %) | 4509 | 16 / 1281 | 42 | 10.7 / 87.3 |
| Sehr niedrig | 80 | 370 / 729 | 97 | 0.1 | 99.9 | 0 | 1848 | 1243 (67 %) | 4546 | 16 / 598 | 18 | 14.9 / 69.1 |

What it says:
- **No sky holes** on either preset at any speed: the far tiles always stand in (void 0 %). The "delay" the owner feels is
  not holes — it is *coarse land* (4-block far-tile cells) close to the camera, and real chunks arriving late.
- **The chunks keep up only while the worker can**: on this fast core Low holds to 40 m/s, Very Low to ~20 m/s; at
  80 m/s 76–100 % of the cone ahead is coarse. A low-end laptop's core is 3–4 × slower — that is where the owner is.
- **Wasted work**: at 80 m/s **half (Low) to two thirds (Very Low) of the generated columns are never shown** — beside or
  behind the flight, unloaded unseen. That worker time is exactly what the far tiles ahead were missing.
- **Walking is the slowest to fill** (time-to-visible p90 4–5 s at 5 m/s, while flying at 20 m/s gets 0.5–0.8 s): the
  rim's off-axis columns inside the render distance had neighbours *outside* the request disk (rd + 1.5); a column is
  meshed only with all 8 neighbours, so they waited until the player had walked a chunk closer. Also 27 % of a walk's
  columns were never shown — the same rim.
- **Splitting light from generation would win nothing** (0.4 ms of ~37 ms); the upload queue is not the bottleneck
  (its budget drains it between bursts); the generation queue's oldest job reaches 1–2.6 s.
- Streaming ticks: p99 8–17 ms, single spikes to 77 ms (Low 40 m/s) and 254 ms (Very Low walk) — noted, not this front's
  main target (see the self-review).


## 3 · What was changed

RESULTS_FIX

## 4 · Before / after

RESULTS_TABLE
