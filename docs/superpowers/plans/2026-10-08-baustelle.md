# 🏗 Baustelle — the magic moment when something new appears · Design + Plan

> **For agentic workers:** test-driven, small commits. Steps use checkbox (`- [x]`) syntax.

**Goal:** a planned structure (R9 Forge `/bau` and 🏭 plans, Studio World-mode houses and models, blueprint items, Werkbank hand-overs) is not popped in at once: it is *built in front of the player* — scaffolding rises, the structure grows layer by layer from the foundation up, builders (the villagers' builder models and their hammer clip) work on the scaffold's working deck, a tower crane swings loads for anything taller than 12 blocks, dust, synthesized building sounds, a fanfare and confetti when it is finished, then the scaffold folds away and the builders walk off. „Bauen: Sofort / Baustelle" in the settings (Baustelle on Low and better, Sofort on Very Low); a click on the site, `/bau fertig` or „⏩ Fertig" skips to the finished building.

**The rule that never bends:** the final blocks are exactly what the plan builds today (`planAt` / `opsAt` lists), Z takes the whole structure back in one step, a save in the middle completes the build first, multiplayer guests get every written cell.

## Design

### 1 · One engine, three paces (`src/main/baustelle.js`, `VR.Baustelle`)
- **Order** (`Baustelle.order(list, undo, F)`, pure, node-tested): duplicates collapse (the last write per cell wins, the undo keeps the first old value — the same final world as applying the list in order). Then **earthworks**: every removal (`s = 0`) top-down, then the fill below the floor `F` bottom-up; then the **structure**: every other cell bottom-up, each layer swept around its centre. `list` and `undo` stay parallel arrays in that order, so `S.at` cells of the list are always exactly what is in the world.
- **Pace** (`Baustelle.pace`): earthworks 0.8–3.5 s (by cells), the structure 4.5–17 s (by height: `2.5 + 0.13·H`), a few layers per second, faster for tall ones; tiny pieces (< 64 cells, ≤ 4 high) 1.2 s and no scaffold; waiting plans make the next sites quicker (`1 / (1 + 0.6·queued)`, never under 2 s). **Sofort** keeps today's behaviour: small lists at once, big ones in 8 000-cell slices every 0.05 s — through the same engine (so guests get the cells too).
- **Writes** happen at most every 0.1 s (0.2 s on Low), never more than 8 000 cells, through `World.buildSet(list, a, b, touched)`: blocks, height map, sun-shadow columns, section dirty flags — no relight per write (a whole-column relight per write would remesh the world twenty times a second). A removed cell under open sky gets full sky light so a cut hill never shows black faces. The touched columns are relit once when the structure is done (`relightColumns`, exactly what `bulkSet` does after a Sofort build).
- **`this.slices`** stays the running write job (`{pl, name, list, undo, at, w, site}`; forge.mjs and the Bauhand read it), `tickSlices` writes, `planDone` is called when the last cell is in.

### 2 · Exactness, undo, saves, multiplayer
- The undo of the whole site is pushed when the site starts (one step); `Gadgets.undo` calls `undo.onUndo` → a running site stops, what was written goes back (the popped undo already did that), the scaffold folds, the plan is marked built (like Z after a Sofort build).
- `World.saveAll` asks its listeners `onBeforeSave` → every running site is finished first (the save always holds the finished building and the plan is marked built). The autosave waits while a site writes (≤ 20 s). `World.unloadColumn` asks `onColumnUnloading` → a site whose column leaves is finished first. A crash mid-build leaves the last save without it and the plan pending → it is built from scratch on the next start (same cells).
- Sites never overlap: a plan whose box meets a running site's box waits (overlapping plans read each other's ground; one after the other they give today's world).
- Every written cell (and the undo of a site) goes to `g.mp.onBlockChanged` while a session runs: guests see the same building grow and end identical.

### 3 · The show (`Baustelle.Show`, main thread only, nothing written to the world)
- **Scaffold:** per-level rings (2 blocks high) hugging the structure's bounding box at that height, built once into an instance buffer (x, y, z, quarter turn) sorted bottom-up; one instanced draw (`P.voxInst`, the vox shader with `INST`) shows the levels below the working deck. Two bay modules (brace / and \) and a working-deck module with guard rails, hazard toe boards and work lights.
- **Working deck:** rises with the build front; the builders stand on it, walk along the ring and hammer (FolkAnim `work`), facing the wall; sparks and knocks on the hit frame. Count by preset: Low 2, Balanced 3, High 4, Ultra 5 (fewer on small rings).
- **Crane** (structure top > 12 above the floor): lattice mast (instanced 2-block segments), slewing jib with counter-jib, cab and blinking red light, trolley, cables, hook and a pallet whose blocks take the colour of the layer being built; pick at the yard by the mast, drop on the deck, pendulum sway.
- **Effects:** dust puffs on writes (brown during earthworks), sparks on hammer hits, confetti and a fanfare at the end, rumble loop during earthworks, crane motor loop, metal clatter while the scaffold folds; all through the particle budget and the sound volume settings; nothing drawn beyond 220 blocks.
- **HUD:** `🏗 Name · 42 %` with a progress bar and „⏩ Fertig" (top centre); a click (left or right) on the site while it builds skips (and the held button is swallowed until it is let go); `/bau fertig`.
- **No per-frame allocations:** preallocated matrices, pose objects, option objects; `Entities.drawModel` no longer creates a matrix per call.

### 4 · Settings
`settings.bau = 'site' | 'instant'` in the presets (Very Low: instant), a seg control „Bauen" in Settings → Spiel; a choice made there survives preset changes (`bauSet`).

## Tasks

- [x] Plan (this file)
- [x] 1 · Node test `test/baustelle.js` (fails first): order (removals top-down before placements bottom-up, layers never go down), pace (6–20 s for /bau Hochhaus 20 Stockwerke), completeness (identical final world vs Sofort), undo in one step (after and during the build), resume after a reload (save mid-build = finished world + plan built; crash mid-build = rebuilt identically)
- [x] 2 · `World.buildSet`, `onBeforeSave` / `onColumnUnloading` hooks
- [x] 3 · `src/main/baustelle.js`: order, pace, the write job (`siteFor`, `tickSlices`, finish, cancel, MP), Werkbank batches merged into one site
- [x] 4 · Hooks: blueprints.js (`siteFor` before the slice lines, `tickSlices` delegates, `/bau fertig`), gadgets.js (undo hook, click skip, draw), game.js (save, autosave, unload, draw, settings), ui.js (setting), audio.js (sounds), entities.js (no allocation), shaders/renderer (`voxInst`), lang tables
- [x] 5 · The show: scaffold, deck, builders, crane, effects, HUD
- [ ] 6 · Browser test `test/baustelle.mjs` + screenshots `test/shots/baustelle_1..4.png` (10 %, 40 %, 80 %, done) — look at them, make it look great
- [ ] 7 · Regression: node set, forge.mjs, world_mode.mjs, spawn.mjs; perf numbers
- [x] Show fixes (this session): builders climb the ladder up the scaffold's outer side and reach the deck while it rises (the arrival is checked after the climb move); node test `test/baustelle.js` ALL OK (50 checks, 0 of 2166 frames hover, 454/454 deck frames)
