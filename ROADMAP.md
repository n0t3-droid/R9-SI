# R9-SI Roadmap: from here to the trailer

The trailer ("Trailer of R9-SI") is the target: what the game should look like and what players
should be able to do when it's finished. This file turns it into milestones. Each milestone ships as
small playable versions (v0.9, v0.10, …) and updates the claude.ai link.

## Principles

1. **Voxel soul, beyond voxel.** The block grid stays the puzzle: every piece fills one cell (or a
   few) and snaps to the grid. The detail goes past plain cubes: mini-voxel sculptures inside blocks,
   pieces that adapt to their neighbours, glowing and animated parts, and the renderer (light, glass,
   reflections, particles).
2. **A builder's kit, not just blocks.** Players get a large catalog of furniture and parts (consoles,
   screens, lights, glass, rails, plants and more) so they can build exactly what they imagine.
3. **Low-end first, high-end glorious.** Every feature has a cheap path that keeps the Low preset
   smooth on integrated graphics, and a rich path for strong GPUs. Nothing ships that makes weak PCs
   stutter.
4. **Everything works together.** Single player and multiplayer use the same world; new features get
   synced when they matter for playing together.

## Where we are (v0.8)

Endless realm terrain (prism fields, ember canyons, aether rivers, sky islands), a far horizon out to
2.8 km, living villages of mini-voxel homes (families, jobs, festivals, kids' games, families moving
into houses you build), mini-voxel starships with cockpit and autopilot, sky traffic, hoverbikes,
jetpack, builder tools, and multiplayer v1 (join from the title screen, shared blocks, time and
weather, avatars, call and teleport).

## Milestones

| # | Milestone | Trailer shots | Status |
|---|---|---|---|
| M1 | Sharp & smooth graphics | all | in progress: sun shadows, sharpening, trailer colours done |
| M2 | The Build Kit: furniture & tech pieces | hangar, control room, city | Voxel Tech kit done |
| M3 | Trailer landscapes: islands, falls, rails, citadels, temple | aerial shots, archipelago, race | islands, falls, sky rails & trams, citadels, lava cracks done; temple open |
| M4 | Tropical Tech City | walk-out, city streets | done: city, Starbase control room & portal (spawn) |
| M5 | Heroes: player characters, armour, blasters | hangar, city | done (v1) |
| M6 | Sky & space | every shot | done (v1) |
| M7 | Ships & action: trails, formations, races, turrets | aerial, viaduct, race | in progress: engine trails done |
| M8 | Multiplayer phases 2 & 3 | two heroes together | planned |
| M9 | Cinematic camera: the trailer, in-engine | whole trailer | planned |

### M1 · Sharp & smooth graphics

The goal is a crisp, clean image with soft shadows at a steady frame rate, starting from the weakest
PCs.

- **Sharpness.** Contrast-adaptive sharpening in the final pass. Dynamic resolution that drops only
  as far as needed and recovers quickly. Better texture filtering (anisotropic where available, tuned
  mip bias). Crisp UI at any render scale.
- **Shadows for every PC.**
  - *Low:* baked voxel sun-occlusion. The mesher traces a few cells toward the sun per vertex, so
    shadows cost nothing at render time. They are refreshed when the sun moves far enough.
  - *Balanced:* one shadow cascade, cached. It is re-rendered only when the sun or the nearby world
    changes.
  - *High/Ultra:* cascaded soft shadows (blue-noise PCF). The far cascades update at a lower rate.
- **Light & colour like the trailer.** Warm key light against a cyan/magenta sky, height fog with sun
  in-scattering, a cleaner bloom, glowing blocks with a soft halo, gentle auto-exposure.
- **Frame pacing.** A frame-time governor spreads chunk uploads and meshing across frames, the
  worker queues are prioritised by what's on screen, and there are no hitches when turning.
- *Done when:* the perf test holds its frame budget on Low, and screenshots at each preset look
  clearly sharper and better lit than v0.8.

### M2 · The Build Kit: voxel furniture & tech pieces

Building is a puzzle: many pieces that fit together into anything you can imagine.

- **Voxel Tech family.** Mini-voxel pieces, 8³ or 16³ per block, like Voxel Homes. They face where
  you place them and connect to their neighbours:
  - tech wall panels and trims (orange/cyan), window frames, glass panels and holo glass
  - consoles with lit buttons, and holo screens (radar, map, charts) that join into big animated
    screen walls
  - hex ceiling lights, light strips, floor light lines, glowing hex landing pads
  - octagonal door and portal frames, sliding holo doors
  - railings, catwalks, stairs and steps, pipes, vents, lockers, crates
- **Furniture.** Stools, chairs, sofas, tables, desks, shelves, beds, lamps and planters, in wood,
  white-tech and stone styles.
- **Nature pieces.** Palm trees (grown from saplings or placed as pieces), ferns and bushes, glowing
  crystals in small, medium and large clusters.
- **Builder UX.** A catalog with categories, search and favourites; a ghost preview before placing;
  a key to rotate the piece; pick-block copies a piece with its rotation; blueprint stamps (hangar
  module, control room, city house) that you place and then edit freely.
- *Low-end path:* pieces are meshed once into the chunk like any block. Animated screens use a
  texture atlas animation, so there are no extra draw calls.

### M3 · Trailer landscapes

- Floating island archipelagos: grassy tops, crystal clusters, cyan aether and lava waterfalls, a
  sea of clouds below.
- Rail networks: tracks on arched viaducts and bridges between islands and towns, and trains or
  carts to ride.
- Sci-fi citadels on mountain tops, and tall tech towers with cyan windows and orange trims.
- A stone sci-fi temple with a glowing octagonal portal.
- Sharper pinnacles, glowing lava cracks, crystal groves.
- The far horizon shows all of these from kilometres away.

### M4 · Tropical Tech City

A new kind of settlement, built from the M2 pieces:

- white and grey modern buildings with cyan windows and orange trims, and terraces full of plants
- palms, ferns and flower beds; plazas and streets with glowing path lines
- mushroom-dome towers on the hillsides with curving walkways
- a spaceport with a hangar, a control room and a landing pad; saucers and shuttles coming and going
- city folk and kids who wave and greet you

### M5 · Heroes

- A player character for third person and multiplayer, with armour suits (blue/orange and more),
  hair styles and colours, and a character creator.
- Blasters with glowing parts and muzzle flashes, and animations for run, aim, shoot and wave.
- Your look is synced to friends in multiplayer.

### M6 · Sky & space

- A vivid nebula (pink, purple, cyan), a larger ringed gas giant with moons, and a galaxy band at
  night.
- Golden-hour light, clouds lit by the sun, stars with parallax.

### M7 · Ships & action

- Glowing engine exhaust with sparkles, smoke and contrails, and wing lights.
- Formations flying past, ship races through checkpoint rings (across the plaza and through the
  temple portal).
- Turrets firing lasers, explosions and debris, robot enemies, dogfights.

### M8 · Multiplayer phases 2 & 3

- Phase 2: villagers and festivals synced (the host simulates, guests see snapshots).
- Phase 3: mobs, dropped items and chest contents synced; co-op fights; riding in a friend's ship.

### M9 · Cinematic camera

- Camera paths and a trailer mode that recreate the trailer's shots in the game itself, plus photo
  mode upgrades.

## Graphics tiers

| Feature | Low | Balanced | High | Ultra |
|---|---|---|---|---|
| Resolution | dynamic, high floor + sharpening | dynamic + sharpening | native | native (supersampled when idle) |
| Shadows | baked voxel sun-occlusion | 1 cached cascade | 2 cascades, soft | 3 cascades, soft |
| Sky & fog | full nebula sky, simple fog | + sun in-scattering | + god rays | + volumetric clouds |
| Glow & bloom | glowing blocks | + bloom | + wide bloom | + lens effects |
| Water & glass | simple | reflections of the sky | + screen-space reflections | + refraction |
| Far horizon | 1 km | 1.8 km | 1.8 km | 2.8 km |
