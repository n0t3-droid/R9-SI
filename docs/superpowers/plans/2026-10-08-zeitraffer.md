# 📽 Zeitraffer — a time-lapse of how your world was built · Design + Implementation Plan

> **For agentic workers:** steps use checkbox (`- [ ]`) syntax; test first, commit small.

**Goal:** the game records every building change of the player's own world (hand, tools, blueprints, Forge, Werkbank,
undo, friends' edits at the host) compactly in the browser, and 📽 Zeitraffer replays the busiest place: the land as it
was, then block after block at ×10 … ×1000, a scrubber with ⏯, the director's camera orbiting and framing each burst,
the sky frozen in the golden hour. ⏺ Video records the replay (WebM) with a title and an end card and offers it as a
download. Esc returns to the game exactly as it was.

## Design

### 1 · Recording at the choke points (no sprinkled hooks)

Every building change already goes through two functions of `World` (src/main/world.js):

| change | path | recorded as |
|---|---|---|
| place / break by hand, mining laser, bucket, door/bed/model halves | `world.setBlock(…, flags | VR.SB_EDIT)` | `HAND` |
| a friend's edit applied at the host (mp.js) | `world.setBlock(…, VR.SB_EDIT | VR.SB_GUEST)` | `GUEST` |
| wand fill/paste/shape/replace, summoned ships | `gadgets.applyEdit(list, undo)` → `bulkSet(list, false, kind)` | `TOOL` |
| blueprints, Studio plans, Forge `/bau` (also every slice) | `applyEdit(…, PLAN)`, `tickSlices` → `bulkSet(…, PLAN)` | `PLAN` |
| Werkbank batches (`tickEdits`) | `applyEdit(…, BENCH)` | `BENCH` |
| Z / `/undo` | `gadgets.undo()` → `bulkSet(u, false, UNDO)` | `UNDO` |

`setBlock` and `bulkSet` already read the old state and skip no-ops, so the hook records exactly
`(time, x, y, z, old, new)` for real changes, at the cost of a few array writes. The recorder sits on the world
(`world.zr`), set only for the player's own worlds (never the title panorama or a guest world). Sim changes (water,
fire, growth), villagers, doors opening and ships lifting off are *not* building and are not recorded.

### 2 · Format (`src/main/zeit_rec.js`, `VR.ZeitRec`)

A segment is a self-contained byte stream (positions and states restart at zero, times from the segment's `t0`):

```
0x00–0x07  change; bit0 = position is the previous + (1,0,0), bit1 = old as before, bit2 = new as before
           then [zz dx, zz dy, zz dz] [uv old] [uv new] for the bits that are clear (zz = zigzag varint)
0x08       run: uv n — n changes of kind 0x07 (a row of the same block over the same ground)
0x09       batch: uv dt (ms since the previous batch), kind byte, uv dim index, uv ticks/10 (the sky's time)
```

A filled 32³ box packs to ≈ 0.2 B per change, a catalogue house ≈ 2–3 B, a hand placement ≈ 12 B with its header.

**Storage:** a database of its own, `r9si-history` (the world database `r9si` is never touched): store `seg`
`[world, id] → {v, t0, t1, n, nb, dims, b}` and store `idx` `[world, id] → {t0, t1, n, bytes}` (small, for the cap).
The open segment is check-pointed under its key every 5 s while it changes and sealed at 128 KB; ids are start
times, so two tabs never collide. After every seal the oldest segments go until the world holds ≤ 2 M changes and
≤ 20 MB (ring buffer). Writes run from timers, never inside the frame; the frame only appends bytes. No IndexedDB
(a private window): the history lives in memory for the session. Deleting a world deletes its history.

### 3 · Replay — the robust choice: a replay copy of the area swapped into the live world's column map

Options weighed:

* **Replay in place in the live world** (undo the changes in the real columns, redo them): every live system would see
  the temporary state — the autosave, the column unload save, block ticks, villagers, multiplayer broadcasts, pending
  Werkbank edits. One slip and the saved world is wrong. Rejected.
* **A separate replay `World`** (own column map, rendered instead): the area would be an island in the void, or the
  whole loaded neighbourhood (hundreds of columns, ~50 MB) would have to be copied and meshed again. Rejected.
* **A separate mesh layer** drawn over hidden live sections: needs new renderer paths (masking, a second draw list,
  shadows, light) for little gain.
* **Chosen: replay columns.** For the columns of the area (≤ 64, only those with changes, inside the render radius) a
  replay copy is made (`blocks` copied, tints shared, fresh sections), the recorded changes are undone newest→oldest
  in the copy (= the land as it was), its light computed in the workers, and then the copies *replace* the originals
  in `world.cols` while the replay runs. Everything else — the rest of the world, the horizon, sky, shadows, the
  renderer, mesher and light code — is the game's own, unchanged; the area sits in its real surroundings.
  Safety: the originals are kept untouched aside (meshes and all); the world and the player meta are saved before the
  swap; replay columns carry `zr = true` and are never saved (`saveAll`, `unloadColumn` and `Store.saveColumn` skip
  them); the game's own frame (player, sim, entities, villages, gadgets, autosave) does not run during the replay —
  the replay frame only streams/meshes, animates and renders; multiplayer with friends present is refused.
  On Esc the originals go back into the map (their meshes were never freed: the view is instant), the replay meshes
  are freed, the light of the ring of neighbour columns (which the seam light touched) is restored, sections remeshed
  during the replay are marked again, and time, weather, HUD and the menu are as before.

**Playback.** The area's changes become arrays (x, y, z, old, new) with batches (time, kind, ticks). The timeline is
the recorded time with idle gaps capped at 3 s; batches bigger than 4 changes are spread at 3 ms per change (a 50 000
block tower: 150 s, i.e. 1.5 s at ×100). Speed ×10 … ×1000 (default: the whole replay in ~30 s). The cursor moves
forward (new states) or back (old states) to the clock; the scrubber seeks; ⏯ pauses. Changed columns are relit in
the workers at most every 150 ms; only sections whose blocks or light changed are re-meshed (after the light), so the
frame never meshes twice.

**Camera** (`director.js`): an orbit rig around the area's centre; the focus follows the centroid of the changes of
the last moments (spring-damped), the distance frames the burst's extent within the area; the camera stays above
the ground. At the end a slower orbit over the whole build. Day/night: 🌅 golden hour (default, frozen) or the sky
as it was when each block was set (the recorded ticks).

### 4 · ⏺ Video

The replay restarts from the land as it was; each frame is drawn into a 2D canvas (1280×720 when the canvas is at
least that big *and* the replay ran at ≥ 30 fps, else 854×480; letterboxed), with a title card „R9-SI · <Weltname>"
for 2 s and an end card (blocks, days) for 2.5 s, captured with `captureStream(30)` and `MediaRecorder`
(WebM VP9 at 720p on a fast machine, else VP8). The body is at most 45 s (the speed rises when needed). The Blob is
offered through the artifact runtime's `downloads` capability (`claude.use('downloads')`), else as a Blob
`<a download>`; without MediaRecorder the button explains that the browser cannot record.

### 5 · Low-end

Recording: a few comparisons and byte writes per change (measured in the node test: far below 0.1 ms). Replay: at most
64 copied columns, the decode in slices of ~8 ms, relight throttled, meshing through the world's own budgeted queue,
rendering at the current preset. Video: 480p VP8 unless the machine keeps 30 fps.

## Global constraints

No new block ids (test/id_snapshot.js stays ALL OK) · no AI account or `sample` · no external requests · saved worlds
stay valid (the world database is never written by the replay) · all new player-facing text through
`VR.I18N.tx(key, vars, de, en)` with keys in `lang_de.js` / `lang_en.js` (test/lang.js stays OK) · German first ·
README.md / ROADMAP.md untouched.

## Files

- Create `src/main/zeit_rec.js` — format, recorder, ring buffer, IndexedDB + memory backends, scan/decode helpers.
- Create `src/main/zeitraffer.js` — the replay (`VR.Zeit`), overlay UI, ⏺ video, game wrappers (attach the recorder,
  flush on save, close on teardown, the replay frame).
- Modify `src/main/world.js` (`VR.SB_EDIT`/`VR.SB_GUEST`/`VR.EDIT`, the two hooks, skip `zr` columns when saving),
  `src/main/storage.js` (never save a `zr` column; delete the history with the world), `player.js`, `game.js`
  (breakMulti, bucket), `gadgets.js` (applyEdit kind, undo, mining laser), `blueprints.js` (PLAN, BENCH, slices),
  `mp.js` (GUEST), `sim.js` (path, farmland, stripped log), `director.js` (orbit rig), `start.js` (📽 in the pause
  menu and on the world cards in 🎒 Meins), `lang_de.js` / `lang_en.js`, `src/ui/style.css`, `build.js` (MAIN).
- Tests: `test/zeitraffer.js` (node), `test/zeitraffer.mjs` (browser), screenshots `test/shots/zeitraffer_*.png`.

## Tasks

- [x] **1 · Recorder + format (node, test first).** `test/zeitraffer.js`: round trip of random changes (positions,
  states, kinds, dims, times, ticks); packing sizes (fill, house, hand); runs; ring-buffer cap with small limits (the
  newest changes survive as a contiguous suffix); persistence format (seg / idx records, check-points, reopen continues);
  world choke points in node (a `World` with a fake pool: `setBlock` with `SB_EDIT`, `bulkSet` with kinds, an UNDO
  batch mirrors its edit); cost per change < 0.1 ms; scan (counts per column) and timeline (gaps capped, bursts
  spread, monotonic); start-state reconstruction (undo newest→oldest, then forward = current). Then `zeit_rec.js`.
- [x] **2 · Choke points.** world.js hooks + call sites; save guards; history deleted with the world.
- [x] **3 · Replay engine + camera.** `zeitraffer.js` (area pick, copies, undo, light, swap, playback, relight
  throttle, restore), `director.js` orbit rig.
- [x] **4 · UI.** Overlay (⏯, scrubber, speeds, 🌅, ⏺, ✕, time label, counts), pause-menu button, 🎒 Meins world
  cards (a world not open: it opens and the replay starts when it is ready), texts in both tables, styles.
- [x] **5 · ⏺ Video.** Recording canvas, cards, MediaRecorder, downloads capability / Blob fallback.
- [x] **6 · Browser test** `test/zeitraffer.mjs` (German UI): hand placements and `/bau`, a fill and `/undo`; 📽 from
  the pause menu; the replay shows the land as it was (the tower's cells empty), the scrubber's middle a part, the end
  the finished build; ⏯ advances; ⏺ gives a `video/webm` Blob > 0 bytes (or the fallback when headless has no
  MediaRecorder — said so); Esc: the original columns are back, the player and the sky as before; no page errors.
  Screenshots looked at.
- [ ] **7 · Regression.** `REGRESS_ONLY=node bash test/regress.sh`, test/lang.js, test/id_snapshot.js, the browser
  tests the change touches (smoke.mjs, blueprint-adjacent: forge.mjs, workbench.mjs).

## Status (after the machine restart)

- Tasks 1–5 were written by the first session (commits 4d5b23f … 04e0579, dc04baa, 094a793, 7f59afc, 004d8e0, 04072a2, 99ac89c). This session ran them for the first time and fixed what the runs showed.
- Task 6: `test/zeitraffer.mjs` ALL OK on the final build (27 checks, no page errors). Pictures looked at: `test/shots/zeitraffer_1_start.png` (the land as it was), `_2_mid` (34 of 81 cells built), `_3_end` (finished), `_4_rec` (the recording overlay), `_4b_card_title` and `_4c_card_end` (the video's own cards, drawn on the recording canvas), `_5_video` (the preview: a black lead frame, the size in KB), `_6_back` (the pause menu again).
- Video: a black lead until the copies are lit and meshed, then the title card, the body, the end card. The download goes as bytes to the host's `downloads`; a Blob `<a download>` otherwise.
- Task 7: `REGRESS_ONLY=node` ALL OK (18 tests, `zeitraffer.js` included); `test/lang.js` OK; `test/id_snapshot.js` ALL OK; `test/smoke.mjs` ALL OK on the final build. `test/forge.mjs` and `test/workbench.mjs` fail in the same checks on the base commit 49c086d (checked in a copy of that commit), so they are not caused by this branch.
