# F6 · Architektur innen & außen, Dinge wie echt · Implementation Plan

> Spec: `docs/superpowers/specs/2026-10-08-realism-wave-design.md`, section F6 and the rules at its top
> (cost tiers with a switch, Very Low never slower, append-only block ids, saved worlds valid, German first,
> every test ends ALL OK / FAILED n, screenshots are evidence).

**Goal:** the houses and streets the generator makes look finished from outside, inside and at night, and the
dropped items sit on the ground. Only worlds made from this version on change (new detail is gated by the world's
generator version, `vgen ≥ 6`); a world made before keeps every chunk it already generated and every house it
would generate with the old code.

## What already exists (inventory, so nothing is built twice)

- **Villa catalogue** (`gen_plan.js`, `gen_villa.js`, `gen_villa_rooms.js`): every room furnished by rules
  (`PLAN.furnish`: sofas, beds, kitchens, baths, desks, lamps, plants), gutters with corner outlets and downpipes
  (`vm_gutter`, `vm_downpipe`), window sills and frames (`voxarch`), window boxes, entrance sconces and step,
  garden with loungers, pool, pergola, path lights, hedges.
- **Village homes** (`gen_village.js` `building()`): windows with sills, a doorstep, a path to the road, a chimney,
  a sized interior with beds, stove, counter, table and chairs, shelf, plant, rug, lantern; V2 yards
  (`decorateYard`): flower beds, mailbox, a little tree.
- **Streets** (modern towns): asphalt with a dashed centre line, paver sidewalks, lamp posts, benches on the
  sidewalk, street trees on the sidewalk line (fruit trees on a grass block).
- **Items**: dropped stacks bob and spin (`entities.js` `drawItems`), the first-person hand is lit by `lightAt`.
- **Particles**: `Particles.glow` (an emissive, camera-facing sprite) exists.

## Gaps this front fills

1. **Village interiors**: a placement grammar (walls → against-wall items, centre → table, corners → lamp/plant),
   zones per storey (kitchen, living, bedroom, bath, study), deterministic from the house seed, no piece inside a
   wall, none on a door or the cell in front of it.
2. **Village exteriors**: a lamp by the door, two planters at the doorstep, gutters and downpipes under the eaves
   of gable roofs (the villa's own models).
3. **Modern streets**: street trees in metal grates, a glass bus shelter at the kerb of a main road, parked
   e-bikes along the kerb in front of homes (the Modern Living pieces, aligned to the road), bins (barrels) by
   the lamps.
4. **Items**: a soft ground shadow under every dropped item (tier ≥ low), a glow sprite around lit lamps at night
   (tier ≥ balanced; Very Low draws none).

Not in this front (known gaps, reported): door swing animation, chest lid animation, a blanket on a sleeping bed,
icon lighting in the inventory, switching street lamps by time of day (lamps are emissive blocks; F1 owns light).

## Order

1. Node test first (`test/architecture.js`): furnished grammar, walls and doors, determinism, old-world hash guard
   (vgen 5 plans are byte-identical to the baseline recorded before this front), modern street pieces present at
   vgen 6 and absent at vgen 5. Red first.
2. `src/shared/gen_detail.js` (SHARED list, `test/load_shared.js`): `VR.Detail` with `VGEN = 6`, the interior
   grammar and the house exterior; hooked into `gen_village.js` `building()` and `planSteps` behind `g.vgen >= 6`.
3. Streets (same module): trees in grates, bus shelter, e-bikes, bins; yields between steps (town plans run in slices).
4. Items (client): `renderer` drop shadows and `particles` lamp glows behind `q.dropShadow` / `q.lampGlow`; the
   presets in `game.js` (potato: 0, low: 1 / 0, balanced+: 1). New worlds are made at vgen 6 (`game.js`).
5. Browser test `test/architecture.mjs`: villa outside and inside by day and night, a village street at night.
   Screenshots in `test/shots/arch_*.png`, read and iterated.
6. Regression: `REGRESS_ONLY=node bash test/regress.sh`, plus `smoke.mjs`, `spawn.mjs`, `world_mode.mjs`.

## How it is measured

- **Plan cost** (node, `test/architecture.js` prints it): the village plan time for the same 12 sites at vgen 5
  (before/after must match: the old path is unchanged) and vgen 6 (the new path). Turns of the planner stay
  within the slice budget (`town_slices.js` still green).
- **Render cost** (headless, `renderer.stats`, the Heartland plaza at noon, seed 1, 1280×720): draw calls and tris
  on Very Low (potato) and High, with the new detail on and off; the numbers go into the test output. Very Low must
  not rise: the drop shadows and glows are switched off there, and the grammar only adds blocks to chunks that are
  generated once.
- **Pictures**: the browser test writes the shots; they are read and compared before/after.

## Numbers

Measured on the 2-CPU machine while other agents' browser tests ran (load 7–12). Node timings use CPU time
(`process.cpuUsage`), the minimum of several runs; wall time under this load was 2–3 times larger and noisier.

- **Plan cost, 12 villages (seed 424242, `test/architecture.js` section 6 and a min-of-5 CPU probe):** vgen 5 1.27–1.44 s
  in all, vgen 6 1.20–1.22 s. The two versions differ by less than the run-to-run noise (single sites range from 0.67×
  to 1.77× between them). Block ops that place a block: 416,416 (vgen 5) → 423,938 (vgen 6), +1.8%: the gutters and
  downpipes of the village homes, the street pieces of the modern towns.
- **Placement grammar, 2000 homes 7×7 (min of 4):** the old interior 0.061–0.077 ms per home, the grammar 0.092–0.111 ms
  (about +0.03 ms per home; a 40-home village about +1 ms of CPU, once per chunk generation).
- **Layout kept:** every village (12/12) and modern town (2/2 in the test; the 7 nearest checked) has the same houses
  and roads at vgen 6 as at vgen 5.
- **Beds:** village homes without a bed: vgen 5 0 of 323; vgen 6 67 of 323 before the bed fix, 0 of 323 after it.
  Homes without a table: 47 → 0; without seats: 47 → 7.
- **Render cost (browser, `test/cost_before_after.mjs`: the villa's front, a modern street and a village home inside, 960×540,
  `renderer.stats` after one real frame, the preset's own settings with the smart-quality ladder off):** measured in the
  browser run that is queued at the time of writing (the numbers go in when it is in). An earlier partly loaded run
  (55 draws on Very Low, 134 on High) is not used: its views were not settled. The frame ms are noisy on this machine and
  are not compared.
- **Before and after (pre-F6 build 205d00c against this build, the same three views, `test/cost_before_after.mjs`):**
  see the probe output below (filled in when the run is in).
