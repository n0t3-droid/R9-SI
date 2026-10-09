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
