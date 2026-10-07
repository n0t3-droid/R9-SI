# New era · Wave 2 — ✨ Wunder, 💡 Erfinden, 🪞 Zauberbauen

Status: design (8 Oct 2026), written for three parallel builders. The owner asked for wonders, magic, discoveries and
inventions that players of every age love, easy and straightforward; he gave free rein ("continue without my
permission"). Constraints that always hold: low-end PCs first (no per-frame allocations, budgets for every job),
saved worlds keep working (block ids are append-only, `VR.BL.late`; `test/id_snapshot.js` is updated only by
appending), German and English texts in `lang_de.js` / `lang_en.js` (tx(key, vars, de, en) at the call), Einfach and
Profi both work, nothing ever needs Claude (no `sample`), nothing is copied from other games or companies (all names,
shapes and recipes are our own), every real test ends with `ALL OK` / `FAILED n`.

## W-A ✨ Wunder der Welt — wonders to discover

**Why.** The world is big and beautiful but gives few reasons to set out. Wonders are rare, hand-shaped landmarks you
see from afar, walk into and *discover* — a banner, a sound, a codex page and a gift: you can build that wonder
yourself afterwards.

**Sites.** Deterministic from the world seed: a grid of 640 × 640-block cells, one candidate per cell from a hash of
(seed, cell) with 60 % chance, kept ≥ 160 blocks from village sites, the Heartland/temple centre and the world spawn.
The first wonder of a world is guaranteed: the cell holding the spawn puts its candidate 250–450 blocks from the spawn,
so a new player finds one in the first session. A site's type comes from the hash with a preference by the biome at
the site (crystal → prism fields, giant tree → forests …), any type as the fallback.

**Types (v1: eight).** Kristallkathedrale (violet crystal spires around a glass nave full of light), Regenbogenbrücke
(an arch of coloured glass over a valley or water), Sternwarte (a domed observatory with a telescope and a star-map
floor), Riesenbaum (a giant tree with lantern-lit platforms and a spiral stair), Wolkenleuchtturm (a lighthouse on a
rock with a turning light), Labyrinthgarten (a hedge maze with a fountain at its heart), Sonnenpyramide (a step
pyramid with a lit inner chamber), Mondtempel (columns around a reflecting pool). Each ≤ 64 × 64 footprint, ≤ 120
high, built from existing blocks (Vollton, glass, crystals, lanterns, leaves …) with the Forge kit's helpers.

**Generators.** `src/shared/wonders.js` (worker side, after the forge files in build.js' SHARED list): `VR.Wonders`
with `sites(seed, cx, cz)`, `typeAt(...)` and `build(type, seed)` returning the same grid shape a Forge structure
returns (lot, layers / ops), so the game's existing planner/placer (blueprints.js: levelled lot, slices) builds it.
Budgets like the Forge's: deterministic, < 1 s CPU, < 16 MB per wonder.

**Built when you come near.** Wonders are not part of the terrain generator (old worlds' chunks stay byte-identical):
when the player is within 160 blocks of an unbuilt site and its lot is loaded, the game plans it through the
blueprint placer — but only on untouched ground: a lot with any player edit is marked `blocked` and never built.
The build is a moment: it rises bottom-up in slices over a few seconds with sparkles and a soft chime (reuse the
Baustelle reveal when present). `meta.wonders = {key: {type, at, status: 'built'|'found'|'blocked'}}` is saved with
the world. In multiplayer only the host builds; guests get the blocks as edits and discover on their own.

**Discovery.** Each wonder has a heart: a glowing block at its centre (an existing glowing block, or one new
`wonder_core` appended late). Standing within 4 blocks of it: a big banner „✨ Wunder entdeckt: Sternwarte" (not the
small toast), a fanfare, a codex entry in a new category ✨ Wunder (g.codex.cat.wonders, one entry per type), and the
gift: the wonder joins the Forge — `/bau Sternwarte` and a ✨ Wunder chip in the Studio's Forge build it anywhere.

**Wunderkompass.** A small HUD line under the crosshair's top edge: „✨ 340 m ↗" to the nearest undiscovered site
(built or not), an arrow relative to the view; hidden while a screen is open; a switch in ⚙ (on by default, both
Einfach and Profi). The map (map.js) shows found wonders as ✨, undiscovered sites within 1 km as „?".

**Tests.** Node: sites are deterministic, spaced, the spawn cell's guarantee holds over 200 seeds, every type builds
within budget over 50 seeds and is walkable from its entrance to the heart; a lot with an edit is blocked. Browser:
a new world → teleport near the first site → it rises → walk to the heart → banner + codex + `/bau <name>` works.

## W-B 💡 Erfinderwerkstatt — invent things by combining

**Why.** Discovery for every age without reading recipes: put two things together and see what you invented.

**Screen.** 💡 Erfinden — from the start screen's 🎒 Meins, the pause menu and a key (I). Big cards: six to start
(Holz, Stein, Feuer, Wasser, Erde, Luft). Drag one card onto another, or tap two: a match shows the invention big —
its 3D icon (the game's item/block icons, VX models' thumbnails), its name, one friendly line („Licht + Glas =
Laterne: Licht, das der Wind nicht ausbläst") — with confetti and a jingle; it becomes a card for new combinations.
No match: the two cards wobble, nothing is lost. 💡 Tipp reveals one combination that works (free). A counter
„37 / 160 erfunden" and a book of all discoveries (found ones with their line, the rest as silhouettes).

**Data.** `src/main/inventions.js`: ~160 recipes (unordered pair → result), every result an existing item, block or
VX model id (no new ids), the Modern Living pieces among them (Strom + Licht = Lampe, Lampe + Zeit = Smart-Lampe …);
de/en names and lines in the language tables. A node test checks: every result id exists, every recipe reachable
from the six starters, no duplicate pairs, every text in both tables.

**Rewards.** Creative and Zen: the invention is put into the hotbar/inventory (one stack). Survival: it unlocks the
codex entry and, when the item has a crafting recipe, shows that recipe. Progress is per profile
(`localStorage r9si.inventions`, guarded with try/catch), so a child keeps its discoveries across worlds.

## W-C 🪞 Zauberbauen — mirror building

**Why.** Symmetric houses, castles and round towers are what everyone wants to build and few manage by hand.

**Mode.** 🪞 Spiegel (key M, and a HUD button in Einfach): turning it on puts the mirror through the block you look at
(or under you); modes cycle X → Z → X+Z (4-way) → radial 8 → off. A faint glowing line on the ground and a thin
translucent plane show the axis; the HUD says „🪞 4-fach". Every block the player places or breaks is mirrored with
its state mirrored too (stairs, doors, logs, directional blocks: facing flipped; two-block blocks whole). Creative and
Zen only (survival: the hint says so). The mirrored edits go through the normal edit path (saved, sent in
multiplayer, one undo group when the game's undo covers player edits). Budget: at most 8 copies per action.

**Tests.** Node: the facing/state mirror table for every directional block kind; browser: place a stair and a door
with 4-way on → four mirrored stairs/doors with the right facings; break one → all four gone; off → single again.
