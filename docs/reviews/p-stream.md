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

All in `VR.StreamPlan` (`src/shared/stream.js`, pure, `test/stream_plan.js`) and `world.js` / `horizon.js`; the setting
**„Schnell fliegen: Welt voraus zuerst"** (`streamPlan`, Bild · Qualität, on for every preset). Generation, meshing and
light output are untouched (gen/mesh/light_same ALL OK); nothing changes below 14 m/s except the rim.

1. **The rim** (walking, any speed below fast flight): the request disk reaches `rd + 0.5 + √2` instead of `rd + 1.5`, so
   every column inside the render distance has its 8 neighbours asked for and can be meshed when it comes into view —
   not a chunk later. Costs ~13 % more columns held round a standing player (they are not meshed: no draw cost).
2. **Worth it?** In fast flight (≥ 14 m/s, looking within ~45° of the way of travel) a column is asked for only if it
   will still be inside the view cone 1.5 × the learnt latency after the request (`timeLeft`: when the cone's edge passes
   it, with 1.5 chunks of slack so a shown column's neighbours are asked for too). The 3 × 3 round the player always.
3. **Stale requests cancelled**: a queued generation that stops being worth it (the player turned or flew on) is dropped
   before a worker touches it; the queued generations are re-sorted every 15 frames from where the player is.
4. **View order**: outside the view cone a column counts 2.5 × farther.
5. **The latency** is learnt from what fast flight asks for (request → shown, an average); a flight that crosses 1.5 × the
   render distance within one latency **rests the chunks** (nothing new asked for) and the latency eases back for a retry.
   (A first rule — rest when most fast-flight requests are never shown — rested at 40 m/s on Low where the chunks kept up:
   the disk's outer rim is never shown by design. Browser run 2 caught it; replaced.)
6. **The far tiles get the workers the chunks cannot use**: the far lane's share grows from 30 % to 70 % with the deficit
   (speed × latency against half the render distance); far tiles behind the camera wait.
7. **The column memory**: untouched columns unloaded a moment ago (32 + 8 × rd of them, ~130 KB each: ~9 MB on Very Low)
   come back without the worker when the player turns back; their own light is computed again (the very same light a
   fresh generation gives), at most 2 a frame.

Tried and dropped: holding back the meshes of columns the camera will leave (it starved the latency estimate of samples
and rested too little); stricter and looser worth factors (0.75, 1, 1.25 — 1.5 filled the most in the simulation).
Not done on purpose: splitting light from generation (0.4 ms of ~37 ms), more workers (the 2-core rule protects the main
thread), a finer far-tile level near the camera (lod.js/horizon.js: the next step, see the self-review).


## 4 · Before / after

Browser run 3 (`SLOW=3 bash test/wt_run.sh stream_low.mjs`, both builds in one browser, alternating; ALL OK). Time to
visible = from a column entering the view cone (inside the render distance, not shown) until it is shown; "never" = it
left the cone unshown; real = share of the cone ahead (screen-weighted) drawn with real chunks; void = neither chunk nor
far tile (a hole); made / never shown = columns generated in the 30 s / of them unloaded unseen; hitches = streaming
ticks over 16 ms (max).

| preset | m/s | time to visible med/p90 ms | never % | real % | void % | columns made | never shown | hitches (max ms) |
|---|---|---|---|---|---|---|---|---|
| Niedrig | 5 | 814/3820 → **496/943** | 13 → 4 | 99.9 → **100** | 0 → 0 | 160 → 166 | 43 → 45 | 0 → 0 (12.2 → 15.6) |
| Niedrig | 20 | 393/523 → **367/473** | 0 → 0 | 100 → **100** | 0 → 0 | 610 → 544 | 94 → 92 | 1 → 1 (20.1 → 23.2) |
| Niedrig | 40 | 262/732 → **393/764** | 22 → 38 | 99.7 → **100** | 0 → 0 | 1187 → 1000 | 212 → 206 | 2 → 1 (46.7 → 81.6) |
| Niedrig | 80 | 624/884 → **263/648** | 86 → 74 | 31.3 → **53.2** | 0 → 0 | 1371 → 1028 | 637 → 440 | 3 → 3 (23.7 → 59.5) |
| Sehr niedrig | 5 | 859/4013 → **607/1222** | 14 → 4 | 99.7 → **99.9** | 0 → 0 | 140 → 147 | 41 → 43 | 1 → 2 (37.2 → 23.2) |
| Sehr niedrig | 20 | 364/655 → **503/720** | 9 → 0 | 100 → **100** | 0 → 0 | 540 → 483 | 94 → 93 | 0 → 1 (8.1 → 28.8) |
| Sehr niedrig | 40 | 767/1165 → **206/369** | 35 → 33 | 95.1 → **100** | 0 → 0 | 1027 → 887 | 242 → 201 | 1 → 1 (19.8 → 52.8) |
| Sehr niedrig | 80 | 440/672 → **263/628** | 96 → 69 | 3.1 → **66.1** | 0 → 0 | 1550 → 1053 | 918 → 430 | 1 → 4 (65.2 → 130.6) |

(Low 40 m/s: only 79 columns came into the cone unshown after, 488 before — the few left are slower, hence the median.)

- **Walking: the land coming into view is there 3–4 × sooner** (p90 3.8 → 0.9 s Low, 4.0 → 1.2 s Very Low); columns that
  left the cone unshown 13–14 % → 4 % (the rim).
- **Fast flight: up to 21 × more real terrain ahead** at 80 m/s (Very Low 3 → 66 %, Low 31 → 53 %), 100 % at 40 m/s on both,
  with 25–32 % fewer columns made and half the wasted ones (Very Low 918 → 430 never shown).
- **No holes** before or after (void 0 %). Streaming tick median equal or lower (Low 1.8 → 1.7 ms at 40 m/s, 0.9 → 0.7 at
  20); the over-16-ms count is unchanged within noise, single maxima vary both ways (both builds 50–130 ms once in a while;
  two other agents' browsers share the 2 CPUs).
- Very Low standing still: unchanged (frame_cost, vl_budget, vl_programs ALL OK; the bigger rim disk holds ~20 more columns
  that are never meshed or drawn).
- Pictures: `test/shots/stream_sheet.jpg` — the charts (real terrain over the 30 s, walk time-to-visible, wasted columns)
  carry the mid-flight state; the pictures below them are drawn seconds after the flight stopped (software frames), when
  the old build has caught up, so they look alike.
- SLOW=3 holds each answer back 2 × its time; with two job slots per worker that is ≈ 1.5 × slower, not 3 × (see the
  self-review). Run 1 (SLOW = 1, before only) gave the same picture as the before column here.

