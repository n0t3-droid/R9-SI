# Test suite

Every real test in this folder prints one summary line, `ALL OK` or `FAILED <n>` (n = failed checks), and exits 0 or 1. Checks print `  ✓ …` or `  ✗ …` before that line. Scripts without a summary line are debug, profiling or screenshot scripts and are listed separately.

## Run

```
node build.js                                   # browser tests need dist/ first
bash test/wt_run.sh genie_brain.js              # one node test
nohup bash test/wt_run.sh smoke.mjs 1500 > .tmp_tests/smoke.log 2>&1 &   # one browser test; poll the log
bash test/regress.sh                            # the release set (writes .tmp_tests/regress.txt)
REGRESS_ONLY=node bash test/regress.sh          # only the node part
bash test/regress.sh "" smoke.mjs               # named tests only
```

`wt_run.sh` runs a copy of the test against this checkout, so the same test works in any git worktree. Browser tests (`.mjs`) take the machine-wide browser lock (`/tmp/r9_browser.lock`), so one runs at a time; a run can wait for that lock for a long time, so start it in the background. `regress.sh` writes one line per test: `name exit-code seconds summary`. Its seconds include the wait for the lock.

## Release regression set

21 node tests and 31 browser tests (52 in all), listed as "yes" below. The four icon tests (`icon_same.js`, `icon_perf.js`, `icon_pump.js`, `icon_draw_same.js`) are new with the icon pass and have no recorded runs yet. The browser tests are the union of the two full runs in the scratchpad (`run_reg5.txt` and `run_v039.txt`); the node tests are the ones that passed in the final node run today (`f_*.log`) and in `run_reg5.txt`, plus `modern_pack.js` and `tex_check.js`, which were fixed today and pass. `frame_cost.js` is not in the set: its checks compare frame times against budgets, so they depend on the load of the machine.

Typical time of a full release run: about 127 min of browser tests (median of the recorded passing runs, plus the wait for the lock) and about 72 s of node tests.

## Tests

Typical (s): median of the recorded passing runs in the scratchpad `run_*.txt` files, range in brackets. Browser times include the wait for the browser lock when the run had to wait. † = not in any `run_*.txt`; this session's run instead. Recorded runs = passed/total in those files.

| File | Kind | Coverage | Typical (s) | Recorded runs | Release set |
|---|---|---|---|---|---|
| frame_cost.js | node | Main-thread budgets per frame: mesh scheduling, visibility walk, buildJob against the v0.39 loop (timing). | 6 † | – | no (timing) |
| gen_same.js | node | Generated terrain is unchanged when the generator loops are tuned (hash of blocks, biomes and tints). | 7 † | – | yes |
| genie_brain.js | node | The Genie without Claude: wishes become houses and things (geometry and words). | 4 (4–5) | 2/2 | yes |
| genie_raster.js | node | Genie answer parser and the shape-to-block rasteriser (geometry only). | 1 (1–1) | 3/3 | yes |
| heart_gen.js | node | Heartland generator smoke test: climate and biome at key points, temple, chunk timings; every chunk has blocks. | 3 † | – | no |
| housekit.js | node | The Haus-Baukasten: every roof, wall, window and extra builds; doors, stairs and furniture land where they belong. | 2 (2–2) | 3/3 | yes |
| icon_perf.js | node | Modern Living icon work stays cheap, in CPU time (the wall clock fails under load): every pack model builds in under 60 ms on first use, the pack's icons take under 150 ms in all (best of three runs), the cloth extrude under 60 ms for ten builds. | 2 † | – | yes |
| icon_pump.js | node | The palette's icon pump: 6 ms of paints per frame, a voxel picture drawn in slices and painted once complete, detached slots skipped; the idle warm starts after 10 s of play, one picture per slice, largest first. | 1 † | – | yes |
| icon_draw_same.js | node | The voxel icons' canvas calls are the same as the drawing they replaced, in one go and one voxel per step (679 items, 913,770 calls; the Modern pack 236 of 236); stepIcon paints the same picture. | – | – | yes |
| icon_same.js | node | Every VM model keeps its voxels and its 8³ icon cell for cell (baseline test/icon_same.json, from before the icon pass and extrude speed-ups). | 3 † | – | yes |
| id_snapshot.js | node | Every shipped block type keeps its state-id range (saved worlds store raw ids). | 1 † | – | yes |
| light_same.js | node | Column light equals the v0.39 algorithm's output (the reference is kept in the test). | 6 † | – | yes |
| look_classic.js | node | Klassisch block look (the default): each block a cube with its own edges and patterns; mesh checks. | 5 † | – | no |
| mesh_same.js | node | Mesher output is unchanged when its loops are tuned: every vertex stream, for two looks. | 13 † | – | yes |
| model_smoke.js | node | Every VM model compiles, paints and meshes; boxes exist; reports the mesh cost per state. | 80 † | – | no |
| modern_pack.js | node | Modern Living pack: ids append-only after the older states, every item registered after Vollton, set counts and palette. | 10 † | – | yes |
| pack.js | node | r9-paket (VR.Pack): favourites, designs and Werkbank parts travel as one file. | 1 † | – | no |
| phys_guard.js | node | Physics and the player survive bad numbers; move, gather and raycast keep their results. | 3 † | – | yes |
| pool_recover.js | node | The worker pool survives a worker that dies or throws; its in-flight jobs get an answer. | 1 † | – | yes |
| ridge_seam.js | node | Seam check at the test hill's ridge end for every section alignment: the top must meet the flat ground. | 3 † | – | no |
| schem_io.js | node | Piece files: .schem and .vox round trips keep every state (stairs, doors, logs) and every colour. | 1 (1–1) | 2/3 | yes |
| ship_designs.js | node | Starship designs build with their blocks, sizes and thrusters; writes test/ships/designs.json. | 5 † | – | no |
| skin_design.js | node | A design that only changes the facade (skin) or mirrors the plan is still kept as a design. | 1 † | – | no |
| store_fail.js | node | Saving survives a failing database: a refused column stays modified and is saved later. | 1 † | – | yes |
| style_core.js | node | World style core: rules on generated columns, player edits kept on reconcile, prop carry. | 4 (3–4) | 2/3 | yes |
| tex_check.js | node | Every texture name of the main bundle resolves to a recipe and builds an image (1832 names). | 3 † | – | yes |
| tpl_roundtrip.js | node | Design format v2: a Crafter grid becomes a template (VR.Custom.makeTemplate) and the edits survive. | 5 † | – | no |
| variants.js | node | Edit, then Varianten (VR.Variants): the same block family in other colours and shapes. | 1 † | – | no |
| villa_smoke.js | node | Every catalogue house builds (both mirror states): block names, room overlaps, door reachability. | 2 † | – | no |
| vx_cache.js | node | The mini-voxel painter's piece cache is bounded and keeps what is in use. | 5 † | – | yes |
| vx_cells.js | node | The first packs' models are built from src/shared/voxcells.js and register as before. | 4 † | – | yes |
| worker_jobs.js | node | Worker job handling in node with a fake self: a mesh job answers with the quads of meshSection. | 6 † | – | yes |
| blocklook.mjs | browser | v0.39 block look: the same scene in Klassisch and Nahtlos (hill, stucco house, glass, mini-voxel cottage), switched live. | 312 (175–448) | 2/2 | yes |
| blueprint.mjs | browser | Blueprints: /haus puts a villa in hand; the ghost lot sits on a slope; the build levels the ground; undo restores the land. | – | – | no |
| bridge.mjs | browser | v0.39 the standalone Studio (another origin, own storage) and the game: banner, Zum Spiel, Mitnehmen, Speichern. | 750 (290–1209) | 2/4 | yes |
| cam_feel.mjs | browser | v0.33.1 camera feel in the Studio Crafter: wheel zoom to the pointer block, 1:1 drag turn, Shift-drag pan, double-click fly. | – | – | no |
| catalog.mjs | browser | v0.37 catalogue (Teile, Finden, Favoriten): blocks by what they are for, search, LED strips, "Im Katalog" from a house. | 90 (84–151) | 6/11 | yes |
| crafter.mjs | browser | Studio Crafter: a catalogue house is built through the real mouse path, saved as an item design, read back by the game. | 130 (126–134) | 4/4 | yes |
| crafter2.mjs | browser | v0.33 Crafter: edits around the lot (bay windows, steps), the replace tool, player-mode physics. | 88 (86–122) | 4/4 | yes |
| crafter3.mjs | browser | v0.33 Crafter UI: icon tool strip, mouse legend, paint tool (one piece, a surface, a kind), hold-to-confirm, one undo. | 92 (89–103) | 3/3 | yes |
| create_standalone.mjs | browser | v0.35 Erschaffen in the standalone Studio (its own artifact, no game worlds): the result is kept as a Bauteil or saved as a file. | 18 (15–27) | 4/4 | yes |
| deadends.mjs | browser | v0.39 phase A: no dead ends (Keine Sackgassen) in the Studio; Bearbeiten everywhere; the Crafter return keeps the selection. | 450 (446–1712) | 3/4 | yes |
| favs.mjs | browser | v0.37 favourites shared by the Studio and the game (creative star tab, F over an item, the star on each slot). | 718 (284–787) | 3/10 | yes |
| glass_conn.mjs | browser | Glass (v0.33.2): panes join each other and solid blocks; every glass keeps its frame; collision follows the shape. | 118 (118–118) | 1/1 | yes |
| grocery_icons.mjs | browser | Every grocery icon renders on a sheet; every catalogue product resolves to an item. | – | – | no |
| height.mjs | browser | Endless height: a tower to y 470 (columns grow above 255), a platform at y 450, and a save and load round trip. | 69 (69–69) | 1/1 | yes |
| home_kit.mjs | browser | Village Life and Supermarket kit showcase: a supermarket interior and a farm yard; every block exists. | – | – | no |
| house_genie.mjs | browser | v0.35 Erschaffen: the Haus-Baukasten and the Genie end to end, including the 'not granted' case. | 199 (174–858) | 7/8 | yes |
| imagine.mjs | browser | v0.35 picture to 3D: a picture becomes a Blockbild with the background removed; files round-trip. | 74 (64–75) | 4/4 | yes |
| life_kit.mjs | browser | Village Life and Supermarket kit showcase: the same builds; every block exists and door boxes match open or closed. | – | – | no |
| modern_kit.mjs | browser | v0.30 modern building set: Vollton colours, panorama glass with connected frames, the nine modern doors. | 114 (114–114) | 1/1 | yes |
| modern_pack.mjs | browser | Modern Living in the browser: the creative tab shows the whole pack; icons are painted a few per frame (the icon work of one frame, the pump's step and paint, under 120 ms). | 1256 (1188–1323) | 2/4 | yes |
| mp.mjs | browser | Two players, one world: host and guest in two pages; look sync, edits both ways, tall edits, summon, leave and rejoin, host closes. | 392 (141–642) | 2/2 | yes |
| player2.mjs | browser | v0.33.2 player mode: crosshair and held block; walking off the property stops at the fence; doors open and the player walks through. | 44 (39–383) | 6/6 | yes |
| projects.mjs | browser | v0.36 Weitermachen: the Crafter draft is kept two seconds after a change and reopens exactly; never reaches the game before Ins Spiel. | 304 (290–325) | 6/7 | yes |
| revisit.mjs | browser | A column changed and left far behind comes back from its save with the change (vollton_coral kept). | – | – | no |
| ship_test.mjs | browser | Starship: an outpost's helm, take-off (state flying), landing (the pilot steps out), hoverbike ride. | 55 (55–55) | 1/1 | yes |
| site_plan.mjs | browser | v0.37 Ort planen on natural terrain: houses, fields with a fence, market stalls, a campfire, lamps, benches. | 245 (225–271) | 5/6 | yes |
| slide_doors.mjs | browser | Voxel sliding glass doors open by themselves when the player comes close (shops, modern houses). | – | – | no |
| slopes.mjs | browser | Smooth ground: a grass hill and a road ramp in the flat kit world, shot from low angles; checks only for page errors. | 143 (138–148) | 2/2 | yes |
| smoke.mjs | browser | Title screen, new survival world, village life, inventory and mouse capture (the game wants the mouse back after the inventory closes, also 900 ms later), creative palette, night mobs; no page errors. | 113 (104–421) | 8/8 | yes |
| society.mjs | browser | Modern-town society: kids sit in class at school time. | – | – | no |
| spawn.mjs | browser | v0.38 spawn point and Spielen: you never land in a wall; ▶ Spielen takes you to the thing you stand in front of, else to the spawn point. | 428 (294–844) | 4/4 | yes |
| star_test.mjs | browser | Starships at the outpost: ships exist, a pilot takes the helm, traffic ships are in the sky. | 66 (66–66) | 1/1 | yes |
| studio2.mjs | browser | Model Studio v2: boot, textures, every catalogue house built, the furniture catalogue, deep links. | – | – | no |
| studio_drag.mjs | browser | Studio camera drags: Architektur and Crafter orbit turn the right way; a right-drag places nothing; the inverted-Y setting flips. | 94 (93–95) | 4/4 | yes |
| studio_live.mjs | browser | v0.35 the R9 Studio over the running game: pause menu, 'R9 Studio · this world' opens it in a layer. | 65 (56–916) | 6/6 | yes |
| terrain_edit.mjs | browser | Smooth Ground v2: stand and walk on a slope without jitter; dig, place and cut blocks on a hill. | 204 (89–320) | 2/2 | yes |
| tpl_upgrade.mjs | browser | Studio start-up upgrades designs saved by older Studios (v1 changed cells to v2 templates), same house. | 40 (36–41) | 4/5 | yes |
| workbench.mjs | browser | v0.35 Welt to Werkbank: the game saves a world and the Studio opens it; fill, replace, copy, paste, carve, raise ground, undo and redo go to the game. | 112 (107–118) | 5/5 | yes |
| world_mode.mjs | browser | Studio World mode end to end: the game saves a world with a player-built tower; the Studio opens the region. | 583 (543–654) | 6/6 | yes |
| world_style.mjs | browser | v0.34 Welt to Stil: the Studio opens the region, lists what it is made of and applies rules (grass to moss, oak to spruce planks). | 254 (236–1265) | 6/6 | yes |

## Debug, profiling and screenshot scripts

No summary line, no exit code, not run by `regress.sh`. They print numbers, write screenshots into `test/shots/`, or profile; run them by hand with `wt_run.sh`.

| File | Kind | What it shows |
|---|---|---|
| autopilot.mjs | browser | village shuttle autopilot: board, fly to the next village, land (observes only) |
| browser.mjs | browser | generic probe runner: evaluates probes in the game and prints the page log |
| citadel.mjs | browser | citadels: flies to the nearest one, photographs it from the side, the terrace and afar |
| cityperf.mjs | browser | where the frames go in the city: sim CPU cost and the draw and triangle load |
| cockpit.mjs | browser | cockpit screenshots |
| col_prof.js | node | per-column cost: generate, light, mesh (node only); calibrates the streaming design |
| dbg.mjs | browser | frame timing and page log for one play session |
| festival.mjs | browser | Lantern Festival: villagers dance, lanterns, fireworks (screenshots) |
| fly_look.mjs | browser | a flight view 1.2 km ahead, taken at once (far LOD stands in) |
| folk_anim.mjs | browser | villager animation gallery: one per animation state, two moments in time |
| folk_day.mjs | browser | villager stats over a day, and the frame time of 600 frames |
| folk_hero.mjs | browser | hero portraits and environment settings (screenshots) |
| folk_life.mjs | browser | village life: kids' games, a family hike, a boat trip (headless) |
| folk_lineup.mjs | browser | villager model lineup: roles and ages in a flat world |
| folk_look.mjs | browser | villager talk and trade views (screenshots) |
| gfx.mjs | browser | the same views at each graphics preset: screenshots and render cost |
| glass_pop.mjs | browser | does breaking glass in the Crafter make anything appear next to it |
| glass_studio.mjs | browser | glass in the Studio's own renderer (screenshots) |
| gltest.mjs | browser | one JSON result from a GL probe |
| ground.mjs | browser | the 'bug with the ground': looks straight down the way the report did |
| hang.mjs | browser | finds where the page hangs (main-thread CPU profile) |
| hang2.mjs | browser | like hang.mjs, in batches of frames |
| heroes.mjs | browser | hero looks in third person, each suit with and without a blaster |
| homes.mjs | browser | builds a little house near a village; a family should move in |
| horizon.mjs | browser | the far horizon settles; screenshots and its state |
| islands.mjs | browser | sky islands near spawn, from the side and from above |
| kit.mjs | browser | Voxel Tech kit showcase: a hangar, a control room, a tropical plaza (screenshots) |
| load_shared.js | node | helper: loads the shared modules for the node tests (not a test) |
| lod_prof.js | node | LOD tile build profile per level |
| look.mjs | browser | look-dev: the same views under environment tweaks (reads look_variants*.json) |
| mesh_test.js | node | mesher speed and size for one overworld column |
| modern_sheet.js | node | thumbnail sheets of the Modern Living pack (node only) |
| path_test.mjs | browser | finds an outpost and prints a path probe result |
| perf.mjs | browser | main-thread CPU profile of one play frame |
| plan_kit.mjs | browser | Village Life and Supermarket kit showcase (screenshots) |
| pm_dbg.mjs | browser | Crafter player model: prints page errors and the player state |
| rails.mjs | browser | a sky-rail viaduct near spawn: from the side, the deck, a station (screenshots) |
| realm_test.js | node | generation time per column and the biome count at spawn |
| ride.mjs | browser | asks the village pilot for a ride (observes only) |
| ridge_mesh.js | node | meshes the ridge end and prints every quad around it (the stray face in te_2_edits.png) |
| simprof.mjs | browser | main-thread time of the city street over 120 sim frames |
| sky.mjs | browser | the sky at four times of day, 60 blocks above spawn (screenshots) |
| smartq.mjs | browser | Smart Quality controller driven by fake frame times: ladders climb and recover |
| star_look.mjs | browser | starship looks (screenshots) |
| starbase.mjs | browser | the Starbase: control room, portal, consoles, apron (screenshots) |
| stream_prof.mjs | browser | how long gen, mesh and lod jobs take until the render radius and horizon are full |
| studio.mjs | browser | the Studio's model statistics |
| survey.mjs | browser | photographs the places the trailer shows: spawn, home city, nearest citadel |
| techcity.mjs | browser | a tropical tech city near spawn: day, dusk, night (screenshots) |
| temple.mjs | browser | the Gate Temple from the plaza, the air, its hall and the city side |
| tex_dump.js | node | builds the texture layers and prints the time |
| tour.mjs | browser | visual tour: cockpit at altitude, dusk plaza, night plaza |
| town.mjs | browser | the same places as survey.mjs: spawn, home city, citadel |
| town_gen.js | node | plans a modern town in node: lots by kind, ops, time |
| trailer.mjs | browser | the director's trailer: each shot at a few moments |
| trails.mjs | browser | engine trails: a starship in chase view with thrust; sky traffic passes |
| tram.mjs | browser | sky tram: a line, the tram at a station, a ride across the viaduct |
| tsr.mjs | browser | R9 Super Resolution: the same view native, at 50% without and with upscaling |
| tsr_motion.mjs | browser | R9 Super Resolution while walking and turning at 60 fps |
| vil_far.mjs | browser | villages seen from afar (far-horizon LOD): day, dusk, night |
| vil_look.mjs | browser | village views (screenshots) |
| villa_dump.js | node | one villa's furniture room by room as an ASCII floor map |
| villa_kit.mjs | browser | every catalogue house on flat ground: front, garden, foyer, upper floor (screenshots) |
| village2.mjs | browser | v2 villages: fly over the spawn village, market, farmstead, streets (screenshots) |
| vx_look.mjs | browser | voxel model views and their info (screenshots) |
| water_look.mjs | browser | ocean and water views (screenshots) |

## Other files in test/

- `wt_run.sh`: runs one test against this checkout (copy with the path rewritten; browser lock for `.mjs`).
- `regress.sh`: the release set above.
- `run_suite.sh`, `snap_suite.sh`, `live.sh`: older runners that write into the scratchpad and do not use the summary line; `regress.sh` replaces them.
- `id_snapshot.json`: the shipped state ids (read by `id_snapshot.js` and `modern_pack.js`). `modern_ids.json`: the Modern Living ids (read by `modern_pack.js`).
- `look_variants*.json`: look-dev inputs for `look.mjs`. `research_blocks.json`: not read by any test.
- `dbg_log.txt`, `hang*_log*.txt`, `look_log.txt`, `ship_log.txt`, `star_log.txt`: logs of debug runs, kept in the repository.
- `load_shared.js`: loads the shared modules for the node tests. It skips `groceries.js`, which `build.js` bundles; no node test in the set needs it.

## Open findings

- `ridge_seam.js` FAILS (688 seam problems, 240 of 256 section alignments): the top of the hill's last row does not meet the flat ground at x 4.25, 4.5 and 16.25 (relative to the alignment origin OX), the stray face `ridge_mesh.js` was written for (`te_2_edits.png`). A real defect; not fixed here (it is game code).
- `frame_cost.js` FAILS once (`buildJob is faster than the cell-by-cell loop`: 39 µs against 38 µs). The comparison is at noise level; it passed in the 12:25 run today. Left out of the release set. A margin or more repetitions would make it stable.
- Browser tests in the set that failed or timed out in some recorded runs, with the result of their latest recorded run: `bridge.mjs` (passed), `catalog.mjs` (passed), `deadends.mjs` (passed), `favs.mjs` (passed), `house_genie.mjs` (passed), `modern_pack.mjs` (passed), `projects.mjs` (passed), `site_plan.mjs` (passed), `tpl_upgrade.mjs` (passed). Early runs predate later fixes; see the Recorded runs column.

## Fixed in this change (node tests that failed for harness reasons)

- `modern_pack.js`: the "pack is appended after the last shipped state" check took its reference from the id snapshot, which already lists the pack's own items, so it could never pass. It now leaves the pack's items out.
- `tex_check.js`: loaded seven of the ten texture modules of the main bundle (no `tex_recipes6`, `tex_groceries`, `tex_vox`), so 465 names looked missing. It now loads the same modules as `build.js`; all 1832 names resolve.
- `ship_test.mjs` and `blueprint.mjs`: when the outpost or the ghost lot was missing they exited 0 without a verdict; they now report `FAILED 1`.

## Not yet run since their checks were added

These browser tests got new checks in this change and have not been run since (only `smoke.mjs` was run). A first run may show new failures.

- `blocklook.mjs`
- `blueprint.mjs`
- `cam_feel.mjs`
- `crafter.mjs`
- `crafter2.mjs`
- `crafter3.mjs`
- `glass_conn.mjs`
- `grocery_icons.mjs`
- `height.mjs`
- `home_kit.mjs`
- `life_kit.mjs`
- `modern_kit.mjs`
- `mp.mjs`
- `revisit.mjs`
- `ship_test.mjs`
- `slide_doors.mjs`
- `slopes.mjs`
- `society.mjs`
- `star_test.mjs`
- `studio2.mjs`
- `studio_drag.mjs`
- `terrain_edit.mjs`
- `tpl_upgrade.mjs`
- `world_mode.mjs`

Browser tests that already printed a summary before this change and were not run here: `bridge.mjs`, `catalog.mjs`, `create_standalone.mjs`, `deadends.mjs`, `favs.mjs`, `house_genie.mjs`, `imagine.mjs`, `modern_pack.mjs`, `player2.mjs`, `projects.mjs`, `site_plan.mjs`, `spawn.mjs`, `studio_live.mjs`, `workbench.mjs`, `world_style.mjs`.

