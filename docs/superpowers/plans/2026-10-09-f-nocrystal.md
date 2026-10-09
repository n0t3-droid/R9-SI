# F-NoCrystal · keine Kristalle — plan (9 Oct 2026)

Branch f-nocrystal, based on v0.43 (Nahtlos default, Nova Haven = vgen 8). The owner, verbatim: „alles implementieren
außer Kristalle, auch auf der World, überall — alles was Kristalle sind, einfach weg damit, ich mag die nicht, ob groß
oder klein."

## The gate

- `VR.GEN.noCry(g)` (gen_common.js) — true for a generator made with `vgen ≥ 9` (or with the option `noCrystal`, used
  by the title panorama, a vgen-5 world that is only looked at). Every generator source below asks it; nothing else
  changes for older worlds, so test/gen_same.js, mesh_same.js and light_same.js keep their references and a saved
  vgen-1…8 world keeps every chunk it ever generates (its crystals too).
- `createWorld` (src/main/game.js): the default `vgen` goes from 8 to 9 (a sibling front, t-town, moves it to 9 as well
  — the same line, the same number; the comment lists both).
- The Drift (`DriftGen`, gen_dims.js) gets the world's options like the overworld (`makeGen` passes them), so its Prism
  Reach follows the same gate.
- Random draws: where the rest of a chunk depends on a generator's random stream (the realm features, the canyon's gem
  loop, the citadel's grove loop, the Sky Isles' build, the village plan, the overworld features after a geode), the
  replacement makes the same draws, so a vgen-9 world is the vgen-8 world minus its crystals — the before/after pictures
  show the same land.

## The crystal families (from the registry; the test prints them)

| family | block types |
|---|---|
| realm prism crystals | `{violet,azure,verdant,rose,amber}_crystal_block`, `…_crystal_cluster` (VR.CRYSTALS) |
| amethyst | `amethyst_block`, `budding_amethyst`, `small/medium/large_amethyst_bud`, `amethyst_cluster` |
| ice crystal | `ice_crystal` |
| voxel crystal pieces | `vx_crystal_wall` (Prism Crystal Wall), `vx_crystal_violet/azure/rose` (Crystal Lamps), `vx_lamppost_crystal`, `vx_lantern_crystal` |

All stay registered (ids are append-only, saved worlds keep them, builders still find them in the catalogue).
Not crystals, kept: the quartz building stones (smooth white stone), ores (diamond, emerald, ember quartz: specks in
stone, the players' resources), tidestone, sunstone (a glowing lamp stone), the aether fluid and the aether-veined
stones (glowing veins in rock), calcite, lilacite, the chandelier's glass drops (furniture). Items (shards), the pets
(Kristallwelpe) and creatures (Kristallkrabbe) are not this front.

## Every crystal source and what replaces it

| # | where | crystal (vgen ≤ 8) | vgen ≥ 9 |
|---|---|---|---|
| 1 | gen_realm.js `realmPost` · Prism Fields / Crystal Highlands vegetation | small clusters on 1.8 % of the violet grass | violet flowers: a lilac (tall, two blocks) where the cluster would have been big, else an allium |
| 2 | gen_realm.js `realmFeatures` · Prism Fields (32 %/chunk) and Crystal Highlands (55 %) | giant faceted glowing spires 12–47 tall with side spires and shards | **rock pinnacles of the biome's stone** (`GEN.pinnacle`): round, gently tapering duskrock needles, blunt mossy tops with a bush, thin aether-vein lines (`dusk_aether`, glowing texels, no block light), two to four smaller needles round the foot, boulders where the shards lay |
| 3 | gen_realm.js `realmFeatures` · random sky islands over prism land (35 %) | small spires on the island tops | a blossom tree (the realm's `prismTree`) |
| 4 | gen_realm.js `realmPost` · random sky-island undersides | crystal-block tips (5 % of the bottom rows) | the tuff they would have replaced (the island's hanging roots stay) |
| 5 | gen_realm.js `crater` · meteor craters (28 % of 256-cells) | a 3×3 crystal column with clusters in the middle, small clusters on the floor | a dark meteorite lump (basalt and smooth basalt round a magma core) in the middle; the small clusters become glowing magma spots in the crater floor |
| 6 | gen_canyon.js `CAN.build` · 14 giant gems on the Ember Canyon's mesa tops | crystal columns 9–20 tall + clusters | **hoodoos**: banded ochre/umber columns of the same heights (the canyon's own strata), a darker cap rock, two shorter companions |
| 7 | gen_canyon.js · the ruin village's well | a crystal block pillar + cluster in an ochre rim | a water well: the ochre rim round water, two posts and a slab roof |
| 8 | gen_citadel.js `CIT.apply` · crystal groves round every citadel terrace; the Heartland citadel's three giants (25, 16, 12) | crystal columns + clusters | the giants: rock pinnacles of the mountain's stone (stone, andesite, a tuff foot, a mossy top); the big ones smaller pinnacles; the small ones boulders. The citadel keeps its tan fluted spires, slits, trim, beacons and steam |
| 9 | gen_isles.js `ISLES.build` · 1–3 crystal clusters on every Sky Isle | crystal columns 5–13 tall | a big round tree (`vm_tree_round_l`, the isles' own trees), not on roads, the temple or the hoodoo |
| 10 | gen_isles.js · the hanging crystals under the Sky Isles | crystal stalactites 4–9 long | hanging vines with glow berries (warm light) and hanging roots beside them |
| 11 | gen_temple.js · the Gate Plaza's four corners | crystal pillar + clusters | a palm in a tech planter with two hedges at its foot |
| 12 | gen_temple.js · the terrace gardens (3 a side) | a crystal block + cluster | a hedge with a lantern on it |
| 13 | gen_common.js `STRUCT.geode` · geodes in the caves (4.5 % of chunks) | amethyst shell, budding amethyst, buds and clusters on the inner surface | a dripstone pocket: the same calcite and basalt shells round a dripstone lining, stalagmites on the floor, stalactites from the ceiling |
| 14 | gen_overworld.js · ice caves' floor | ice crystals on 6 % of the floor | snow layers |
| 15 | gen_dims.js · the Drift's Prism Reach | amethyst blocks in the island rock, amethyst/calcite spires with a cluster tip and ice crystals round them | stone; white calcite pinnacles (`GEN.pinnacle`) with small calcite rocks round them |
| 16 | gen_village.js · prism-style villages (in prism land) | crystal walls, crystal street lamps, crystal lanterns indoors, an aether fountain with a crystal lamp, a crystal lamp in every lot | lavender plaster, white hull and white timber walls; street lamps; lanterns; the aether pool with a stone fountain centre; a flowerbed in every lot |
| 17 | wonders_build.js · 💎 Kristallkathedrale (all worlds: the game builds wonders when you come near, the chunk generator never does) | crystal spires, clusters, a crystal garden, amethyst inlays, crystal lanterns | ⛪ **Lichtkathedrale / Cathedral of Light**: Gothic pinnacles of white quartz with gold tips, lilacite inlays, a flower garden, lanterns, a glowing sunstone in the rose window; the type id stays `kristall` (DNA, gifts) |
| 18 | wonders_build.js · Regenbogenbrücke, Wolkenleuchtturm, Labyrinthgarten, Sonnenpyramide, Mondtempel | crystal lanterns, crystal street lamps, amber clusters | lanterns and street lamps |
| 19 | forge_civic.js · 🏰 Burg „Dunkel" | crystal lanterns | lanterns |
| 20 | shipgen.js · the Prism Guild's ships | violet/azure crystal blocks as accent and glow | violet tech panels and cyan neon |
| 21 | gadgets.js `impact` · a meteor in a vgen-9 world | crystal blocks in the rim, a crystal core and clusters | basalt in the rim, a magma core under smooth basalt, no clusters |
| 22 | game.js `giveKit` · the creative kit of a vgen-9 world | a violet crystal block, an azure crystal cluster | neon magenta, a street lamp |
| 23 | lod.js · the horizon tiles' giant crystal spires | read from the realm features | follow the generator: no crystal columns in a vgen-9 world, the pinnacles drawn in their stone colour instead |
| 24 | far.js · ring 1's skylines | read from the canyon, isles and temple ops | follow (no change needed) |

## Texts (keys kept, the promise changed)

`g.load.tips` (the crystal spires tip, the crystal craters tip), `g.title.splashes` („Kristalltürme voraus!"),
`g.codex.m.crystal` (the hint), `g.codex.w.kristall` + `g.wonder.n.kristall` (Lichtkathedrale), the biome names
`g.biome.prism_fields` / `crystal_highlands` / `prism_reach` (Lavendelfelder, Lavendelhochland, Kreideweite),
the villagers' lines `g.talk.kidSays`, `g.talk.moons`, `g.fact.more`, `g.likes.crystals` (Glühwürmchen), wonders.js's
names (de/en, icon ⛪). German first.

## Tests

- `test/nocrystal.js` (node, written first, fails before): the families from the registry (printed); for seeds 4242 and
  20261009 at vgen 9 versus 8: the Heartland's set pieces (canyon, Sky Isles, temple plaza: their ops and their chunks;
  the citadel's foot), prism fields and highlands (patches found by climate), meteor craters (the sites from their
  hash), a cave section (geodes, ice caves), the Drift's Prism Reach, a prism village plan, the realm features as the
  horizon reads them — zero crystal blocks at vgen 9, crystals still at vgen 8 (old worlds keep their look); something
  stands where the big crystals stood (pinnacles, hoodoos, trees); the eight wonders × 12 seeds, the Burg in every
  style and the ship palettes place none; the texts; the gate and the default; the CPU time of the prism patch at
  vgen 9 is not above vgen 8's (fewer blocks).
- `test/nocrystal.mjs` (browser, one run, TAG before = vgen 8 / after = vgen 9 in one browser): a vgen-9 world flies the
  prism fields, the canyon, the citadel, the Sky Isles, the temple plaza and a cave, counts crystal blocks in the
  loaded columns (0), a meteor strikes (still 0), the creative kit has no crystal; the same cameras in vgen 8 for the
  before pictures (`test/shots/nocrystal_<place>_before.png` / `_after.png`).
- Kept green: id_snapshot, lang, gen_same / mesh_same / light_same (unchanged), trailer_world_gen.js (vgen 5 keeps its
  crystals), wonders.js, forge.js, the node regression; smoke.mjs.

## Results — the continuation (9 Oct, from 13:57)

The first agent was stopped at 13:23; its browser run had finished by then. The continuation read its logs and
pictures, ran the node gate, the node regression and smoke.mjs, made the pinnacles cheaper, made two checks robust and
rehearsed the merges.

### nocrystal.mjs (the first agent's run — not run again: the generator's output is the same since, see Speed)
- 12:44–13:18, ALL OK: crystal blocks in the loaded columns, vgen 8 → vgen 9 — prism 8454 → 0 · prism by night
  8454 → 0 · prism from afar 2429 → 0 · highlands 32017 → 0 · canyon 2294 → 0 · citadel 1941 → 0 · Sky Isles
  2357 → 0 · under the isles 3823 → 0 · Gate Plaza 2289 → 0 · prism village 4284 → 0 · cave 2215 → 0; a meteor beside
  the Gate Plaza 2458 → 2470 at vgen 8, 0 → 0 at vgen 9; the creative kit: none; the title panorama: 0 in its loaded
  columns; no page or shader errors.
- 13:36–13:40, the cave camera again (a sunstone behind the camera once its column is there): ALL OK, 2215 → 0.
- At every camera the settle ran out its 300 rounds (settled -1): the pictures were taken after 60–120 s there (the
  game's loop keeps water flowing and the 5 km horizon's jobs coming); a later version could freeze the fluids while
  it settles.

### The pictures (test/shots/nocrystal_<place>_<before|after>.png): nothing empty or broken where a crystal stood
- prism, prism_night: the 47-high azure spire is a duskrock needle with moss in its ledges and a mossy top, the spires
  behind it smaller needles; at night the aether veins glimmer and the meadow is darker without the spires' light.
- prism_far: the horizon tiles' coloured spires are gone; their pinnacles are dark like the land round them.
- highlands: a forest of lavender-grey needles with mossy tops where the crystal forest stood.
- canyon: the two violet gems are banded ochre hoodoos with dark cap rocks and grass hats.
- citadel: the azure giant is a grey stone pinnacle with a mossy top; the far giants are stone too.
- isles: a big round tree where the violet crystal stood.
- isles_under: tuff where the coloured tips were, glow-berry vines (warm lights) and roots where the stalactites hung;
  the underside is dark without the crystals' light. Its left third differs by a waterfall's water: the 13 × 13
  chunks round the camera differ only in crystal cells (3512: crystal → tuff, dirt, vines, roots, trees, dripstone,
  air) and hold the same water (15708 cells) — that water is the waterfall's flow while the game ran, not the generator.
- temple: a palm in a white planter with two hedges at the plaza's corner.
- village: black street lamps for the white crystal lamps, lavender plaster for the crystal walls, a fountain.
- cave: the amethyst geode is a dripstone pocket, warm brown under the sunstone, with stalactites and stalagmites.
- meteor: a basalt lump on a magma core; the crater is darker without the crystals' light.
- title_after: the start screen over the panorama, no crystal.

### Node and smoke
- test/nocrystal.js: ALL OK, 90 checks (two seeds: canyon 490/505 crystal cells in its ops at vgen 8 → 0, its chunks
  671/505 → 0, 43/43 columns stand; Sky Isles 895/904 → 0, chunks 2386/3272 → 0, 42 of 44 and 31 of 32 standing (the
  other three sit a block off: roots hang from their own column's underside, a fern on its own ground — checked),
  133/133 and 135/135 hanging; Gate Plaza 40 → 0, 18/18;
  citadel foot 1314/969 → 0, giants 11/11 and 10/10, 7181/1691 spire blocks unchanged; prism fields 2526/3585 → 0,
  highlands 6715/1236 → 0, the horizon's realm features 2748/7259/3125/1183 → 0; craters 148/147 → 0 with a meteorite
  in 3 of 3; geodes and an ice cave → 0, +295/+386 dripstone; the Drift 1566/1590 → 0; prism villages 2487/3934 crystal
  pieces → 0, 188/204 lamps; wonders 8 × 8, the Burg, the ships 0; the texts; the gate and the default).
- New: `pinnacle` — a rock two chunks away asks the chunk's writer about no cell (it asked 2922 before), a rock on the
  chunk's edge asks only the chunk's own columns (1545 beyond the edge before) and writes there exactly what a writer
  that sees everything gets (444 cells).
- Robust: `cost` warms each fresh generator with a chunk a kilometre away (the cold start spread the runs by 50 % and
  failed it once in a rehearsed merge); `villages` asks t-town's aired-out layout once VG.townFountain exists.
- REGRESS_ONLY=node, before the speed-up: 103 tests, 102 ALL OK, far_forms.js FAILED 1 on timing (the Sky Isles' form
  22 ms = 19.3 % of its chunks' generation; a vgen-6 world, which this branch leaves alone) — on its own: ALL OK
  (6.9 ms, 3.5 %). After the speed-up (14:43–15:24): 103 tests, 102 ALL OK, modern_pack.js FAILED 1 on timing
  (registering the pack 52.1 ms, its cap 50 ms; it passed in both runs before) — under the machine's load then (load
  average 9.5 on 2 CPUs) the base commit 441658d misses it too, back to back with this branch: 87.5 / 69.6 ms there,
  68.9 / 248.8 ms here. nocrystal.js, gen_same, mesh_same, light_same, lod_same, id_snapshot, lang, far_forms,
  trailer_city, trailer_world_gen, heart_gen: ALL OK.
- smoke.mjs: ALL OK (a new survival world, now vgen 9: spawn in the Gate Temple, inventory, palette, night mobs).

### Speed (the world must not hang while it generates)
- GEN.pinnacle visits a chunk's ColumnWriter over its own 16 × 16 columns only and skips a rock whose reach misses the
  chunk: the realm features run for a chunk and its eight neighbours, so eight of nine passes over every pinnacle
  cost nothing now. The output is the same: the vgen-9 chunks of prism fields, highlands, the citadel's foot and the
  canyon and the horizon's recorded features hash the same before and after (two seeds).
- Warm 3 × 3 highlands patch (CPU, the least of six): vgen 9 55–56 ms, vgen 8 57–67 ms (before the speed-up vgen 9
  was 59–72 ms); the pinnacles' share 1–9 ms of it. 5823 glowing blocks for 8850 (fewer lights to spread); Very Low
  draws 0.89× the vertices there.
- The horizon's realm-feature pass (lod.js, the recorder without x0: unchanged) costs 9–16 ms per 81 chunks once their
  terrain is cached (vgen 8: 3–7 ms; the terrain itself 53–133 ms).

### The far ring and the horizon follow the generator
- far.js builds ring 1's skylines from the set pieces' own ops (CanyonGen / IslesGen / TempleGen.build(g)) and the
  islands from their shapes: a vgen-9 world's ops hold no crystal (nocrystal.js), the workers get the world's options
  (worker_main.js makeGen(dim, seed, opts) — the Drift too now).
- lod.js: the horizon tiles record duskrock and aether-veined duskrock from the realm features at vgen 9 and draw the
  pinnacles ≥ 3 high in their stone's colour, not glowing; 0 crystal from the features at vgen 9.

### Gaps
- Items, pets, creatures and the Erfinderwerkstatt keep their crystal names and looks (shards, Kristallwelpe,
  Kristallkrabbe, erf.i.kristall / rosenkristall / prismenherz …); the catalogue still offers the crystal blocks to
  builders (ids append-only).
- Old worlds (vgen ≤ 8) keep their crystals, as planned; a meteor in an old world still leaves crystals.
- Under the floating islands it is dark now (no crystal light); the dripstone pocket is one colour.
- nocrystal.mjs never settled (above); its isles_under pair differs by the waterfall's flow.

### Merge notes
- v042 (a00fd82): merges cleanly (git merge-tree: no conflict); nocrystal.js ALL OK on the merged tree.
- t-town (9c4ab38, the Weißstadt, also vgen 9 and also "no crystals anywhere"): three conflicts —
  - src/main/game.js createWorld: both make 9 the default; keep one line, both comments.
  - src/shared/gen_village.js planSteps: keep t-town's `const AIRY = …` and this branch's
    `const S = VG.styleOf(g, site.style)` (STYLES.prism9 is the crystal-free style of every vgen-9 prism village —
    flowerbeds where the crystal lamps stood; t-town's STYLES.prism_clear then goes unused), and the building's
    `style: S === STYLES.prism9 ? 'prism9' : site.style`.
  - test/trailer_city.js: the same check twice (vgen 8 or newer); keep one.
  Rehearsed in a scratch copy with these resolutions: it builds; nocrystal.js (its village check meets the aired-out
  layout), t-town's hallcity.js (its 8th part: nine aired-out villages of six climates, the prism ones among them, no
  crystal), trailer_city.js and town_folk.js all ALL OK.
- GEN.NOCRY_VGEN = 9 is the one number: if the release gives the Weißstadt and the crystal-free worlds different
  numbers, change it, createWorld's default and the two regexes of test/nocrystal.js.
