# R9-SI — Voxel Realm · Starforge Edition

An original browser voxel sandbox with its own art style: violet prism fields with giant glowing
crystal spires, red-ochre ember canyons cut by lava rivers, glowing aether energy rivers, sky
islands with waterfalls, Starforge outposts with docked shuttles, a cosmic sky with a nebula
and a ringed gas giant — and a full block roster researched from the block wiki's navigation
groups, re-imagined with procedural textures.

## Play

- **Double-click `index.html`** — it runs in Chrome, Edge or Firefox (WebGL 2), no install.
- Or publish this repository with GitHub Pages and open the page.

Worlds are saved in your browser (IndexedDB).

## The Heartland (v0.19 — the trailer's world)
Every new world starts in the Heartland, the trailer's composition around the origin (see `TRAILER.md`
for the full concept): an eternal-dusk sky with the nebula and planets visible by day, the **Gate Temple**
home base (octagonal portal with its glowing veil, the Hangar Hall with holo screens, consoles and the
landing pad, wings with roof gardens, fluted towers, saucer landing pads, a domed hall, grand stairs to
garden terraces, and the flagstone plaza with its runway), and the Palm City *Nova Haven* right behind
the temple's back door. v0.20 adds the Spire Citadel on its mountain (fluted spire cluster, watchtower, stone-arch viaducts), the Sky
Isles (seven floating islands with waterfalls, asphalt loop roads, trestle bridges, the Isle Temple and a hoodoo arch),
the Ember Canyon's Canyon Loop sky tram, watchtowers, turret nests and a ruin village, and the Pod Hills. The
Mountain Station follows. Worlds created before v0.19 keep their old terrain.

### Smooth cities on low-end PCs (v0.20)
Mini-voxel buildings switch to averaged LOD boxes beyond the *VX detail distance* (a preset value: 28 / 44 / 64 / 96
blocks); villagers far from you think less often (near ones every frame), crowding is solved on a spatial grid, and
path-finding is budgeted per frame. Dynamic resolution now only lowers the render scale when the GPU is the
bottleneck — when the main thread is, the sim budget shrinks instead, so the picture stays sharp. If a world still
crawls at the lowest resolution, the render distance eases down for the session.

### Modern towns & the society of a real town (v0.21)
In worlds made from v0.21 on, most temperate villages are **rich modern towns** built after real reference photos:
single-storey **mono-pitch houses** (white stucco, stacked-ledgestone piers, a clerestory glazing band under the
slanted charcoal roof, a glass-strip garage with a car inside and one in the driveway, lawns, flower beds and hedges),
two-storey **villas** (cream stucco, white cornice bands, balconies with black steel railings and planters, a
wood-slat loggia, a columned porch, LED strips, a terrace with steps and urns), and a **neoclassical mansion** as the
town hall — a two-storey columned portico, pilasters, arched windows glowing warm, a balustraded roof, a dark hipped
roof, a grand hall with a double stair and chandeliers, a dining hall, a library and bedroom suites — facing the
plaza across a granite forecourt with a fountain. Streets are asphalt with yellow centre dashes, paver sidewalks,
black street lamps and cherry/apple street trees; lots sit on ledgestone retaining walls. **Every house is fully
furnished** from the new Designer Home kit (60+ pieces: modular sofas, coffee and dining tables, TV media walls,
kitchen islands with sinks and hobs, upper cabinets, fridges, wardrobes, nightstands, bathtubs, glass showers,
toilets, vanities and LED mirrors, bookshelves, wall art, tall plants, pendants, chandeliers, sconces, LED strips
and recessed spots, columns, balustrades, railings, urns, fountains, bollards, parked cars) plus 25 new materials
(stucco, ledgestone, charcoal roofing, walnut slats, black-frame glass, garage doors, marble, travertine,
herringbone oak, subway and dark tiles, terrazzo, decking, pool tiles…). A town also has a **school** (classrooms
with whiteboards and desk rows, a playground), a **factory** (machines, a conveyor, a loading dock, a stack), an
**office block**, a **café** with a terrace, a **park** with a fountain and benches, the supermarket, a clinic, and
farms with barns and pastures outside the second ring road.

**Villagers live like a town:** every person has an age. Kids walk to school in the morning and sit at their desks
while the teacher teaches (and calls on them by name), then play in the afternoon; adults are teachers, factory
workers, office clerks, baristas, shopkeepers, farmers, gardeners, healers and the mayor, and work at their
workplace; at lunch some go to the café; in the evening people stroll, sit in the park or on the plaza, elders spend
their afternoons on the park benches, and everybody sleeps in their own bed at night. Talk to anyone: they tell
you about their job, their day and their family.

### Real villas at real scale — the house catalogue (v0.22)
Homes in modern towns are no longer small painted boxes: every one comes from a **researched floor plan at real
scale**, built by a planner and furnished by an interior designer:
- **Stadtvillen** after the Kern-Haus range (Signus 8.98 × 10.23 m, Karat 12.60 × 11.85 m — scaled 13 × 13 to
  18 × 16 blocks, two full storeys): a Diele with the stair, Gäste-WC and HWR beside it, a study at the street, the
  open Wohnen/Essen/Küche across the whole garden side behind floor-to-ceiling glass and terrace doors; upstairs two
  children's rooms at the street, the gallery over the hall, the master bedroom with a dressing wall and a balcony,
  a big family bath and a guest room with its own shower bath. Under a true **22° hip roof** (new half-slope
  voxel pieces in anthracite slate or terracotta, with a white soffit) — or, in the Bauhaus variant, a flat roof with
  a glass-railed roof terrace. Skins: white/anthracite, grey, sand, mediterranean (terracotta, columns, arches,
  royal palms), Bauhaus, white clinker.
- **Bel Portale** (after Stilhaus): the classicist Stadtvilla — a 6 m twin-column portico with a pediment, two
  octagonal corner towers, balustrade balconies on columns, a mansard roof with dormers, a double-height foyer with
  the stair and a two-storey glass front, the living room with a stone fireplace and a piano, a winter-garden
  dining room, a library.
- **Sanssoucis** (after Stilhaus' "Villa am See"): white clinker with quoins on a bossed stone base, natural slate
  roof, six two-storey marble columns across the garden front with a balustraded balcony between, a curved
  balustraded terrace with a fountain, the grand checkered hall with a double staircase and chandelier.
- **Toscana**: an ochre mediterranean villa with a round tower under a terracotta cone, arched windows, an arcaded
  loggia with a terrace above, palms.
Every house has a **double garage (42 m²)** with a roof terrace reached from the bedroom above, or a carport, a
driveway, a front garden with path lights and a mailbox, and a back garden with a travertine terrace, a pergola
over the outdoor dining table, a BBQ, loungers, a **pool** on the big lots, lawns, beds, hedges, trees and royal
palms. Inside: accent walls in walnut, ledgestone or micro-cement, LED coves, backsplash tiles, L-shaped sofas,
arc lamps, curtains, fireplaces, tall cabinet columns, washers, coat racks, floating shelves — different in every
house. Towns grew to a 120-block radius with ring roads at 40 and 82 so the villa lots fit, and got **zebra
crossings** at every junction, **bus shelters** and benches along the ring roads. A **Royal Palm sapling** is a new
item: plant it (or bone-meal it) and a tall royal palm grows. Parked cars are off for now.

**OKAL-style variants (v0.23):** the **Pultdach** house (a stepped mono-pitch roof with glazed clerestory bands,
high at the street), **Black Label** cubes (anthracite bands, a glass box cantilevered over the entrance, and on half
of them a **Staffelgeschoss** — the upper floor steps back over the garage side, the rest becomes a railed roof
terrace) and a single-storey **Bungalow** under a hip roof (two children's rooms, master with dressing wall, bath,
utility, the open living/dining/kitchen along the garden). And the rarest lot of all: the **Palais Royal** (v0.24, after
Stilhaus) — a 25-block-wide palace with a twin-column portico, balustrade balconies, quoins and a mansard roof, a
grand checkered hall with a double staircase under a two-storey glass front, salon with fireplace and piano, dining
hall, library or home cinema, a bar, and a **glass swimming hall** with a tiled pool behind the dining wing.

### 📍 Where you land, ▶ Spielen from the Studio (v0.38)
**▶ Spielen** (the Studio's top bar, in the Studio that belongs to the game) opens the world you are working on directly —
no title screen in between — and puts you where it makes sense: if you set something new into the world in the Studio
(Werkbank, a Baukasten house, the Genie, a planned place, a handed-over plan), you stand **in front of it, looking at
it**; otherwise you land at your **📍 spawn point**. Over the open game (Pause → 🧰 R9 Studio · this world) ▶ shows you
the new thing, or lets you play on where you were. The button says where you will land (*▶ Spielen · ✨ beim Neuen*,
*· 📍 am Spawnpunkt*, *▶ Weiterspielen*).

**The arrival** — with something new, a short camera flight swings in from above and shows it whole, then hands you the
view (any key or click skips it). The spot in front of it is chosen so that nothing stands between you and it: the
sides facing where you came from first, at a few distances, each checked for a clear line of sight.

**📍 The spawn point** — set it in the game's pause menu (**📍 Set Spawn Here**, beside 🏠 Go Home; beds still work) or
in the Studio's World view (📍 in the panel, then a click on the ground). The view shows 📍 your spawn point, 🧍 where you
were last and ✨ the new thing as markers, each with 👁 to look at it.

**Never in a wall** — every way into a world checks the spot: from the title you play on where you were, but if the
Studio built something there meanwhile you step out to the nearest free spot (beside it, under the open sky, rather
than inside or on top). The same happens the moment the game builds a Werkbank change or a plan where you stand.
Storage: `r9si.land.<world>` (the newest thing and a spawn point set in the Studio); the world's save remembers what it
has already shown you, so a thing is new only once.

### 🧱 Teile, 🎯 Finden, ★ Favoriten — and the Genie needs no account (v0.37)
**Everything runs in the game itself.** The ✨ Genie and 🏘 Ort planen no longer ask Claude: there is no account, no
sign-in and no usage limit, and every player gets the same results. The Genie's own library knows 177 things (cars,
ships, castles, lighthouses, windmills, a Ferris wheel, animals, statues, …) with their variants, reads colours, sizes,
numbers and changes ("rotes Dach", "größer", "ohne Kamin"), turns photos into reliefs and house wishes into Baukasten
houses. The place planner reads the wish ("Dorf Lindenhof mit Marktplatz, Kirche, Feldern mit Zaun …"), fits it to the
surveyed ground and gives the landmarks you name (church, castle, tower, Ferris wheel) their ground first.

**🧱 Teile** (top bar) — every block of the game in one catalogue, by what it is for: ★ Favoriten, roofs, lights,
windows & glass, doors, walls, floors, stairs & slabs, rails & columns, garden & nature, decoration, colours. Every
card shows the block's picture; the search understands whole words and German ("lampe", "dach", "weiße leiste"). On
the right: where it is built (a click opens that house with it lit up), **✋ Benutzen** (into the Crafter's hand) and
**☆ Favorit**.

**🎯 Finden** (Architektur) — tap anything in a house: all of it lights up (through walls too) and the right side shows
it — picture, name, *27× in diesem Haus*, **🔍 Im Katalog** (the catalogue opens right there; *← zurück* returns to the
house, still lit), ✋ Benutzen, ☆ Favorit. With a mouse its name floats next to the pointer before you click; a second
tap or Esc lets go; pointing at a row of the house's parts list lights that part up. Thin decorations without a
collision box (LED strips, pictures, mirrors, pendant lamps, curtains, wall shelves, boards, pergolas) can now be
pointed at everywhere — 🎯, the Crafter, the Werkbank and the game (break, pick block) — and you still walk through them.

**★ Favoriten everywhere** — one list (`r9si.favs`, in this browser) shared by 🧱 Teile, Möbel, Fassade, the Crafter's
palette (☆ on a tile or a right click), the Werkbank's blocks, the World's furniture (★ first) and the game's creative
inventory (**★ Favorites** tab, **F** over an item, ☆ in a slot's corner). A change in one shows in the others at once,
and Crafter → Export / the game's Studio import carry them along. Werkbank pieces are now marked 🧩 (Bauteile) and your
own designs in the World lists ✎, so ★ always means a favourite.

### 🕘 Weitermachen — nothing you start in R9 Studio gets lost (v0.36)
**Drafts** — every house and every piece of furniture you change in the Crafter is kept as a draft two seconds after
each change (at most eight while you keep building), together with the camera, the floor cut, the tool, the hotbar and
the last 30 steps of Strg+Z. The game sees it only when you press **Ins Spiel**, exactly as before; until then the
HUD shows 💾 and the panel says the draft is safe. A page that closes, reloads or loses the game's overlay keeps the
last change too. **⟲ Spielversion laden** throws a draft away and loads the house as the game has it.

**🕘 Weitermachen** (top bar, or **Strg+O** from anywhere) — all your projects as big pictures, the last one first and
largest with one **▶ Weitermachen** button: Crafter houses (*✎ 342 · noch nicht im Spiel* or *✓ im Spiel*), furniture,
Baukasten houses, Genie designs, planned places (*geplant* / *✓ gebaut*) and the worlds you worked in. One click and you
are back exactly there — the house with every change, the camera where it was, the paint brush in your hand; the
Baukasten with that house; the Genie with that design and your words; the world with its plan on the same spot. Filter
by kind, type to search, 📌 pin, ✓ done (folded away below), ✎ rename, 🗑 remove (a Crafter house only leaves the list
and drops its draft — what is in the game stays). Designs saved before this version appear on their own. The Studio
**opens on this page** whenever there is something to continue (a link into a world or the Crafter still goes straight
there). In the Baukasten, **＋** starts a new house (the current one stays in the list) and 🎲 on a house you shaped by
hand starts a new one instead of rolling over yours. **Strg+S** saves on the spot (no browser dialog).
Storage: `r9si.projects` (the list), `r9si.wip.<id>` (each project's data), `r9si.thumb.<id>` (pictures, the first
thing to go when the browser's storage is full — the designs the game reads always come first).

### R9 Studio becomes a world editor: 🧰 Werkbank, live in the game, files and pictures → 3D (v0.35)
**🧰 Werkbank** (Studio → *Welt* → open a world; it is the first tab) — edit the world itself, the way MCEdit, Amulet,
WorldEdit or Axiom do it, with the Crafter's pictures and hotbar: **⛏ Bauen** (left breaks, right places the hotbar
block on the face you point at — stairs, doors and furniture turn like in the game — middle takes a block),
**⬚ Auswahl** (two clicks make a box, Bild ↑/↓ its height), **🪄 Zauberstab** (everything of one kind that hangs
together, up to 60 000 blocks, Shift adds), then **Füllen** (F), **Ersetzen** (G — pick which kind in the selection,
the hotbar block takes its place and turn), **Wände** (J), **Hohl** (H), **Leeren** (Entf), **Kopieren** /
**Ausschneiden** (Strg+C / X). **📋 Einfügen** (V, Strg+V): the piece follows the pointer as a ghost, R or right
click turns it, M mirrors it (furniture stays whole), Bild ↑/↓ lifts it, a click puts it down. **🖌 Pinsel**: paint
the surface, add, carve, smooth, raise and lower the ground ([ ] size). **🧩 Bauteile** keep a piece for every world.
Strg+Z / Strg+Y take every step back and forth.

**Live in the game** — every change goes to the game as a batch the moment you make it: an open world builds it at once
(with its own /undo), otherwise it is built when the world opens; the Werkbank shows what is still waiting (⏳) and
shows your changes even before the game has them. **Pause menu → 🧰 R9 Studio · this world** opens the Studio *over*
the running game on that world's Werkbank; *◂ Spiel* closes it and everything you did is already there.

**Files** — 📂 open (or drop on the view) structures from **WorldEdit / Amulet / Axiom (.schem)**, **vanilla structure
files (.nbt)**, **Litematica (.litematic)**, **MagicaVoxel (.vox)** and R9 Bauteile (.json): Minecraft block names and
their properties (facing, half, hinge, open, axis …) become R9 blocks, unknown blocks are listed. The piece in hand goes
out as **.schem**, **.vox** or **.json** (on claude.ai through the page's download prompt, .schem / .vox packed in a .zip).

**🖼 Bild → 3D** — 🧱 **Blockbild**: a photo, pixel art or logo becomes a wall or a floor of blocks in the colours that
fit best (all blocks, wool & concrete, Vollton, terracotta, stone & wood; matched in OKLab so blue stays blue), the
background cut away (transparency, or the colour around the border), optional dithering and relief (bright = closer).
🧊 **3D aus Ansichten**: the front, the side and (if you have it) the top of something — drawn in the Studio's pad
(pen, fill, eraser, mirror) or photographed — and the Studio carves the shape (what every view sees as inside stays)
and paints it with the views' colours; with only a front it is cut out like a cookie. The preview turns when you drag
it; *✓ In die Werkbank* puts the result in your hand to place, *★ Als Bauteil* keeps it. Pictures can also be pasted
(Strg+V) or dropped.

**✨ Erschaffen** (top bar, any mode; in the Werkbank under ✨) — one dialog for everything new:
- **🏠 Haus-Baukasten** — a whole house from buttons: style (Landhaus, Modern, Klassisch, Hütte), width × depth,
  1–4 floors (normal or tall rooms), roof (Sattel-, Walm-, Flach-, Pult-, Zeltdach, Mansarde; gable to the side or to
  the front) in any colour, walls (Putz, Ziegel, Holz, Stein, Fachwerk, Blockhaus, Beton, Glas) in any colour, accent,
  windows (klein, normal, hoch, breit, Panorama, Bogen, rund; white / black / wood frames; shutters), door (left /
  middle / right; wood, glass, double, modern) and extras: 🔥 chimney, ⛱ porch, 🌅 balcony, 🚗 garage with a car,
  🪑 terrace with a barbecue (a roof terrace on a flat roof), 🚧 fence with a path and flower beds, 🏛 portico columns,
  🌼 window boxes, 🪟 dormers, 🌳 garden with fruit trees, 🏊 pool, ☀️ solar. Every house comes **furnished**: a
  staircase up through every floor (with head room and a railing), the ground floor open — kitchen with upper cabinets
  and a hood, an island, a dining table under a pendant, a sofa on a rug facing the TV or the fireplace, plants, art, a
  coat rack — upstairs a **tiled bathroom** (shower, toilet, vanity, tub), the master bedroom (bed, nightstands with
  lamps, art, wardrobe, dresser), a kids' room or a study, lights in every room; gutters and downpipes outside, the
  house number and a letterbox at the door. Every choice rebuilds it at once; 🎲 throws a new one. In the hand it sits
  one block into the ground so its floor meets the grass; R turns it, furniture and all.
- **✨ Genie** (built into the game since v0.37 — no account) — a **photo, a sketch or a sentence** → the Genie answers
  with a *plan*, never with blocks: a house becomes a Baukasten house (and stays tunable there), anything else — a car, a ship, a
  tree, a lighthouse, a statue — a set of shapes (boxes, cylinders, balls, cones, ramps, rods; mirrored left ↔ right;
  glass, lamps, metal, wood, leaves) that the Studio turns into blocks. **✏️ Ändern** sends the current design back with
  what should change ("größere Räder", "Dach blau", "eine Etage mehr"), **⟲** goes back a version; in 🏠 Haus a ✨ line
  changes the house you are tuning. Ideas to click show what it knows; an unknown word gets close suggestions.
- **🏘 Ort planen** (with a world open) — **a whole place from one sentence**: the Studio surveys the piece of the world
  you look at (or your selection, 48–96 blocks): heights, water, sand, rock, trees and what is already built; the
  planner reads that map and plans a settlement that fits it — houses facing their streets (each a furnished Baukasten house),
  paths, a plaza, fields with water channels, trees, lamps, benches, a well or a fountain, market stalls, docks and boats
  on the water, landmarks — drawn as a map to look at first. **✓ Bauen** levels the ground under every house (terraces
  on slopes), lays the paths on the terrain (boardwalks over water) and builds everything as **one Werkbank step** that
  goes live to the game; ⟲ takes the whole place back. ✏️ Ändern / ⟲ like the Genie; **🎲 Dorf würfeln** plans a village
  by itself (one style, on the flattest dry spots round a plaza).
- Without a world (the standalone Studio) the result is kept as a 🧩 Bauteil or saved as .schem / .vox / .json.

### The player view like the game, glass back to single blocks, the world's own style (v0.34)
**🧍 Spieler, like in the game** — the crosshair and the block in your hand show (a CSS slip had hidden both); with
the mouse caught the crosshair sits in the middle, without pointer lock it follows the pointer. The lot lies in a
**meadow** now: walk off the property, round the house, up to a garden fence 40 blocks out; a blue line on the ground
shows how far you can build. **Right click opens doors** (both halves), trapdoors and gates, and **sits you down** on
chairs, sofas, benches and stools (Shift stands up) — Shift + right click places a block instead. The voxel glass
**sliding doors open by themselves** as you come and close behind you. Opening a door is not a change to your design
(no undo step, the design keeps its doors as the house came). Daylight sky and the game's field of view (Settings →
Field of view).

**In the game** — the sliding glass doors of shops and modern houses open by themselves for the player too.

**Glass is single blocks again** — the joined-up glass of v0.33 is gone: window glass (black, white, frosted, warm),
plain and stained glass, glass panes, the glass balustrade and iron bars all keep their own frame per block. The
panorama glass of the *Modern* tab joins its frames as since v0.31. No glass is drawn as a recessed pane in the
middle of a wall any more — that pane jumped to the block's face when a neighbour changed, which looked like glass
popping up next to a block you broke.

**🎨 Welt → Stil** — a world's own look. Open a world in the Studio's *Welt* mode, tab **🎨 Stil**: the left side lists
what the region is made of, in groups (🏠 houses & paths · 🌳 trees & plants · ⛰ ground & stone · 💧 water) with
counts. Point at anything in the world — a roof, a wall, a tree, the meadow, the water — and everything of that kind
nearby lights up, a badge at the pointer names it. Click it, then pick what it should be instead: the best matches
first (planks for planks, leaves for leaves, stairs for stairs), every block below, for water also a colour. The
region shows it at once. **⬆ In die Welt** hands the style to the game, which changes everything it generated —
houses, streets, trees, ground, water colour — right away when the world is open there, otherwise when it opens.
**What you built yourself stays exactly as it is** (a saved column is compared with what the generator makes; only
cells that still hold the generator's block take the rule). With friends in the world only the rules for buildings,
furniture, items and trees count (👥); ground and water rules (👤) come back when you play alone. ⟲ / ⟳ (Strg+Z/Y) go
through every step, *↺ Alles Original* (two clicks) clears the style, and a draft stays in the browser until it goes
into the world.

### The Crafter in pictures, a paint brush that cannot slip, build as the player, glass that joins up (v0.33)
**Pictures instead of text** — the Crafter now explains itself with icons: a tool strip at the left edge of the view
(🔨 **Bauen** · 🖌 **Malen** · ▭ **Bereich** · 🧍 **Spieler** · **?**), each with one word and its key; a mouse
picture in the corner shows what the left and right button, the middle button and the wheel do right now (⛏ break,
▣ place, pipette: take the block); the panel is one big *Ins Spiel* button, four icon buttons (back, forward, original
— a second click confirms — and close), three chips (changes, height, facade) and your designs. **?** opens a card
that shows every tool as a picture with one line. The long help lines are gone.

**🖌 Malen (T)** — repaint a facade, a window, a floor with another block: pick the new block in the hotbar, point at
the old one — and before anything happens, what would change **glows**, and a badge at the pointer shows
*[old] → [new] ×n*. Three reaches (Tab cycles): **1 Teil** (one block or one whole piece), **Fläche** (the
connected surface on the side you point at — a whole wall of the facade, one window, a floor) and **Alle** (every
piece of that kind in the house, shown through the walls too). Small changes go with a click; big ones need the
button **held until the ring is full** — a quick click does nothing, so nothing big changes by accident. One Strg+Z
takes it all back. Pieces keep their place and turn: a sofa becomes the other sofa (whole, facing the same way), a
door the modern door (both halves, same hinge, open or shut), stairs keep direction and half, slabs top or bottom.
Right click takes a block's colour into the hotbar.

**Navigation that follows you (v0.33.1)** — the wheel zooms *to the spot under the pointer* (it stays under the pointer
and becomes the centre the view turns about), so you get close to the corner you work on with a few notches; dragging
turns the view evenly, Shift- or middle-drag pans so the ground follows the pointer, the arrow keys turn and Bild ↑/↓
zoom without the mouse, and in the other views a double-click flies there. The 🖱 button sets the mouse speed (five
steps, click faster, right click slower; it also sets the speed of looking around as the player). A click may wobble
a few pixels and still build, and the Studio lowers its resolution on a slow PC so the view keeps up with the mouse.

**🧍 Spieler (P)** — build in the house in first person, the way you play: WASD walks with the game's own physics,
Space jumps, Space twice flies (Space up, Shift down, landing ends the flight), Shift sneaks without falling off
edges, Strg sprints. A click into the view catches the mouse: the crosshair aims, left breaks, right places (never
into yourself), middle picks, holding keeps going, the wheel picks the hotbar slot; every tool works here too (paint
a wall from the inside). E or Esc frees the mouse, P goes back to the Studio camera — same house, same undo, same
*Ins Spiel*. The backpack next to the hotbar takes the blocks from the hotbar of the world you played last. The
physics runs in 1/60 s steps, so a jump is as high on a slow PC as on a fast one.

**Around the lot** — what the house builds outside its lot (bay windows, front steps, garden lamps) can be changed,
and you can build up to 4 blocks past the lot line; the design keeps all of it in every town and every rotation.

**Glass joins up** *(removed again in v0.34 — every glass block keeps its own frame)* — window glass (black, white, frosted, warm) gets *one* frame around a whole window instead of
one per block and continues the panorama glass of its style; set in a wall it sits as a recessed pane with the wall's
reveals around it (a sofa or desk right behind it does not matter). Plain and stained glass hide the frame between
neighbouring blocks, and glass panes, the glass balustrade and iron bars form one sheet with a frame only at the ends
(no little ticks inside any more). Panes attach to every full block — stone, planks, Vollton, glass blocks, window and
panorama glass — and the collision follows what you see.

**Furniture placed whole** — placing one of the furniture pack's models (sofas, beds, tables …) by hand put down only
its first part; it now places the whole piece, in the game and in the Crafter.

**Your changes stay when you come back** — a part of the world you had changed, then left far behind and visited again
in the same session, was generated anew (the change seemed gone, and building there again could overwrite it for
good). It now comes back from the save.

### R9 Studio World mode — plan your world, the game builds it (v0.32)
The Studio inside the game (title → *R9 Studio*, or *Select World* → **Plan in R9 Studio**) now opens your saved
R9-SI worlds: the **◍ Welt** tab lists them, and opening one shows the land around where you last stood — 9 × 9 chunks
read from your save (everything you built is there) and from the world's own generator, meshed with the game's
mesher. Pick a catalogue house (or your ★ design of it) or any piece of furniture (your own designs first) and it
glides over the ground with the mouse — every piece is meshed once and then only moved and turned on the GPU, so it
follows the cursor without a hitch. R (or Shift + wheel) turns it, F changes the facade, a click puts it down, and
you can keep placing. Click a placed piece to select it: drag it, Alt-drag a clone off it, R turns it about its
middle, Strg+D clones it beside itself, Bild ↑/↓ raises or lowers it, the arrow keys nudge it, Entf removes it,
Strg+Z / Strg+Y undo and redo — drafts survive a reload. **In die Welt übernehmen** hands the plan to the game
(per world in the browser's storage): the game builds every piece as soon as its ground is loaded — at once when that
world is open in the game, next to the Studio — with the same earthworks as a blueprint, as one undo step, and the
Studio marks it *gebaut*. The game stays the only one that writes the world, so a save can't be corrupted by two
writers.

### Blueprints, glass villas and designs that last (v0.31)
**Blueprints** — every catalogue villa is now an item (creative tab *Blueprints*, or `/haus` lists them and
`/haus <n>` puts one in your hand). Hold it and the lot appears where you look, its street side (orange) facing you;
R turns it, F flips through the facades (every skin, plain and mirrored). A right click levels the ground the way a
town does it — the lot is filled up to the yard (a stacked-stone retaining wall where it stands high), hills on the
lot are cut away, a stepped verge blends small slopes into the lawn and a big hill gets a stone wall to hold it back
(only natural blocks are ever touched outside the lot) — and lays the whole house down at once, furnished, with its
garden and pool. **Z** (or `/undo`) takes the house *and* the earthworks back exactly. When you have built your own
design of that house in the R9 Studio Crafter, the blueprint carries a ★ and builds *your* house. Creative and Zen
Builder only.

**Glass villas** — two new facades for the Stadtvillen (and the bungalow): *Glashaus* in white Vollton with graphite
bands and *Glashaus Anthrazit* with white bands — floor-to-ceiling panorama glass whose frames join over whole
window runs (frosted panorama glass in the baths), a cantilevered glass box over the entrance, a roof terrace, flush
white or oak interior doors, a pivot or loft front door and modern glass doors to the garden. They appear in modern
towns and in the Studio's facade swatches.

**Designs that survive updates** — the Crafter now saves a house as the whole edited lot (a palette and runs of
every cell the house or you put there, air included; cells nobody touched stay as they are). The villa builder still
runs for the villagers' rooms, beds and doors, but everything it would generate inside your lot is replaced by your
template — so a design looks exactly as saved, in every rotation, even after future versions change the villa
builder. Beds, seats, desks and lamps only stay villager spots where your design kept them. Designs saved by v0.30
are converted automatically when the Studio starts (same house). In the Crafter, **B** switches on the **area
tool**: click and right-click two corners, + / − sets the height, then F fills, G builds walls, H a hollow box, X
clears it — a piece of furniture cut by the box goes as a whole. In the Studio, dragging up and down now moves the
view the same way as left and right; the new ⇅ button flips it if you prefer the other way (the browser remembers).

Fixed: breaking one cell of a multi-block VX furniture model (sofas, beds, tables, kitchens …) now removes the whole
piece — before, the other cells stayed behind (and dropped again).

**R9 Studio · Crafter** (title screen → *R9 Studio · Crafter*, or the Studio's ⚒ tab): open any catalogue house and
re-build it with *every* item of the game — the palette has all blocks, furniture and facade pieces by category
(Modern & Vollton, Bauen, Voxel Homes, Möbel & Technik …) with search and a 9-slot hotbar. It plays like the game:
left click breaks, right click places (doors, beds and multi-block furniture as a whole, turned toward you, R turns
the next piece), middle click picks, drag orbits, Shift-drag pans, F switches to a free fly camera (WASD, Q/E), the
section cut opens a floor, Ctrl+Z / Ctrl+Y undo and redo. The house can grow as high as you like — the grid adds
room above while you build. **Update ins Spiel** stores the house; from then on every town builds this catalogue
house exactly as edited (the same variant, in every rotation — new towns at once, unchanged towns after reloading
the world), and the title screen lists the active designs with a way back to the originals. Furniture and facade
models open in the **item crafter**: paint, add and erase voxels at 1/32 block (brush 1–8, cube or sphere, mirror
X), pick colours, and *recolour* a whole material at once (the sofa's fabric, a table's wood) in any material —
fabric, velvet, leather, wood, marble, metal, stone, glass, light. Update ins Spiel re-draws that item everywhere in
the game. The Studio inside the game shares its storage with the game; the separate Studio page exports and imports
designs as text.

**Endless height**: the build limit is now 4096 instead of 256. Generated terrain still fills y 0–255; a column's
storage grows upward 16 blocks at a time where you build higher, so empty sky costs nothing. Light, shadows of
platforms, meshing, collision, saving and multiplayer edits all work up there.

**Vollton** — 40 clean solid colours (whites, greys, anthracite and black, sand to chocolate, reds and pinks, orange
and yellow, greens, blues, violets), each as a matte block, a lacquer-gloss block, a slab and stairs; in survival two
concretes mix into a colour and honeycomb lacquers it. **Panorama glass** in seven styles (black, white, anthracite,
bronze frames, a curtain wall with mullions, frosted, smoked): neighbouring panes merge into one big window framed
only at its outside edge, and a pane set in a wall becomes a single sheet of glass in the middle of the wall's depth
with real reveals around it. **Nine modern doors** (glass with black or white frame, an anthracite pivot door with
shadow grooves and a long steel bar, walnut slats, white and oak flush doors with black levers, a front door with a
frosted glass strip, frosted steel, a black steel loft door) are built from real 3D parts — frames, glass, bar
handles, levers — and swing open and shut like every door in the game (villagers use them too). The new
*Modern & Vollton* creative tab holds them all. Glass no longer shows thin seam lines between blocks (the shader
took the 1×1 mip level at every block edge), and scheduled ticks no longer merge at nearby heights (their key lost
its low bits beyond 2^53).

### Ground that behaves — walk, dig and rebuild a hill (v0.29)
Bodies now **follow** the sloped ground instead of falling a little and being lifted back every frame: you, the
villagers and the animals stand perfectly still on a slope triangle (the old fast up-and-down jitter is gone) and
walk over a hill without ever leaving the ground. What the player does to the land is crisp and buildable:
**dug** natural blocks leave clean voxel edges around the hole, and natural blocks you **place** by hand (dirt,
grass, sand, gravel, snow …) keep their cube shape — so a house foundation, a wall or a terrace on the hillside is a
real block wall, and dirt put back into a hole fits exactly. The game keeps these as "kantig" (cut) twins of the
same block (same item, same drops). The **shovel** shapes the land: right-click turns a natural block crisp,
**Shift + right-click** smooths it back into the hill — together with every connected crisp block around it (up to
160) — so a repaired slope flows into the hillside again. Lone one-block pits and bumps in natural terrain stay
blocky (a dimple would hide a hole), every bigger shape stays smooth, and the slope corners next to a two-block cliff
always meet the cliff face (no more slivers of sky at a ridge's end). The mesher reads two blocks of border around a
section for this, so slopes join seamlessly across chunk borders.

### 5 km horizon, preloaded — and a loader that keeps up with a flight (v0.28)
The far-terrain horizon now reaches **5 km** (new level-4 tiles of 2 km with 64-block cells; the settings offer
1 / 2 / 3 / 5 km) and the coarse ring of the whole radius is **preloaded** before a world opens — the loading screen
waits for it (at most a few seconds), so the first frame already shows the land to the horizon. From there the
quadtree refines inward (32 → 16 → 8 → 4-block cells, villages at 1 block) while the real chunks fill the render
radius; after a long jump the coarse tile under you stands in right down to the ground until the chunks arrive.

Loading itself is much faster. The worker pool runs two lanes — terrain (generate, light, mesh) and horizon tiles —
with a guaranteed share for the horizon, so it keeps filling in during a flight instead of waiting behind every
chunk. Meshing is throttled by the workers' real capacity (two frames of work in flight per worker) instead of a
fixed number per frame, so a slow frame never starves them; the loading centre runs ahead of a moving player
(up to half the radius, in the direction of travel), generation and meshing are ordered nearest-first on one
scale, and requests you have flown away from cancel themselves before a worker touches them. Sections outside the
furniture-detail radius are meshed **without** their mini-voxel detail (the averaged boxes draw there anyway; the
far box now comes straight from the voxels, never from the fine quads) and get it back as you approach — a town
column costs a few milliseconds instead of a hundred. Horizon tiles build ~40 % faster (typed vertex buffers,
numeric merge keys, climate corners without density until needed), and buried grass no longer turns to dirt one
block per tick (that storm re-meshed and re-saved whole towns for nothing). Balanced now renders 10 chunks, High 14.

### R9 Smooth Ground — hills and roads as real slopes, and a bounded video-memory budget (v0.27)
Natural ground (grass, dirt, sand, gravel, snow, mud, moss) and the road and path surfaces (asphalt, pavers,
gravel) now render as a **height field**: every top corner sits at the average surface height of the four
columns meeting there, so one-block steps become smooth slopes with true surface normals (the shader takes them
from the geometry), the plants and flowers sit on the slope, side faces under a joined slope vanish, and a corner
touching anything hard — a cliff of two blocks or more, water, a building, a tree trunk — keeps the block height so
nothing is ever left open. The world stays block-based for building and breaking; movement walks the slope:
the collision box of smooth ground under your feet uses its lowest corner and the body is lifted onto the bilinear
surface every step, so you, the villagers and the animals climb a hill or a sloping road without stairs.

Video memory is bounded now: the detailed mini-voxel furniture and facade meshes are uploaded to the GPU only for
sections within the preset's detail distance (and released beyond it, with a hysteresis band), the averaged boxes
draw the rest, the RAM copies live in a wider ring and sections re-mesh when you come back. On Low a whole town
keeps around 8 MB of furniture detail on the GPU instead of several hundred.

### Designer furniture at 1/32 block — the VX32 model language & the Model Studio (v0.25)
The furniture inside the villas is no longer made of 8³ voxel pieces. **VX32** models are built from 32×32×32
mini-voxels per block (the volume may span several blocks; placing one places all its parts, breaking any part
removes the whole piece and drops one item) and every surface carries the **texture of its material** — fabric
weave, pebbled leather, wood grain (upright on tall faces), marble veins, brushed steel, leaf veins, stone — with
normal maps and roughness, world-aligned so patterns run seamlessly across faces; lacquer and enamel stay smooth.
The models are written in a small **model language** (`src/shared/voxmodel.js`: boxes, rounded boxes, cylinders,
tubes, spheres, lathes, extruded profiles, rods, tapered legs, cushions with piping seams, cuts and mirrors) and
compiled once into palette-indexed volumes (one byte per voxel), meshed by the same greedy mesher and cached like
any VX block, drawn as one box per part in the distance. The **R9 Model Studio** (`dist/studio.html`, published
alongside the game) renders every model with the game's mesher and textures, lets you edit a definition and
re-run it.

The pack (`src/shared/voxfurn.js`, 101 models): sofas with piping, throw pillows and a blanket, shell armchairs,
coffee/side/dining/console tables with place settings and vases, spindle-back and leather chairs, bar stools,
desks with monitors, office chairs, lowboards with sound bars, wall TVs showing a landscape, bookcases with leaning
books, floating shelves, sliding and walnut wardrobes, nightstands with drum-shade lamps, dressers with mirrors,
sideboards, coat racks, three kitchen lines (grip-rail fronts, undermount sinks with mixer taps, induction hobs
with a pan, glass-door ovens, tall units, wall cabinets) plus range hood, dishwasher, island with fruit board,
fridge, washer and a shelf of jars; beds with channel-tufted headboards, folded duvets, pillows and bolsters,
single and bunk beds, benches, floor mirrors, wave-fold curtains; freestanding tubs with a floor-standing tap,
vanities with countertop basins and LED mirrors, wall-hung toilets, walk-in showers, heated towel rails, laundry
baskets; arc, tripod, table and pendant lamps, ring chandeliers; monstera and olive trees, fireplaces with logs
and flames, a grand piano, art in three motifs, round mirrors, a bronze sculpture, a bar cart, a toy box; and the
garden set — loungers, teak table and chairs, outdoor sofa, gas BBQ, cantilever parasol, fire pit and planters.
The villa interiors use all of it: seating groups with flanking armchairs, consoles and reading corners, dining
sets with benches and head chairs, L-shaped kitchens with breakfast tables, dressing walls, kids' rooms with bunk
beds, and gardens with a teak dining terrace, loungers under a parasol and a fire-pit lounge.

**The facade kit** (`src/shared/voxfacade.js`) does the same for the outside: window assemblies one to three
blocks wide in four kinds (floor-to-ceiling, standard, clerestory band, round-headed for the arched skins) with
anthracite or white frames — one frame around the whole opening, slim mullions and a transom, a casement with its
handle, a stone sill outside and a window board inside, a roller-shutter box over the modern frames, glazing bars
on the classic white ones, the reveal left to the wall around — plus frosted bathroom lights, half-round gutters
with corner outlets and downpipes at the wall corners under the hip roofs, wall lanterns, a backlit house number,
a letterbox and a sectional garage door. The villa builder splits every window run into 3/2/1-wide units.

### Sharp on weak PCs: R9 Smart Quality (v0.21)
The old dynamic resolution blurred the picture whenever frames dropped — and near villages that often did not even
help, because the main thread (villagers, meshing) was the bottleneck, not the GPU. **Smart Quality** measures both
sides (GPU time via the browser's timer-query extension where available, main-thread time always) and climbs two
ladders instead: on the GPU side it first updates the shadow map every other frame, then drops god rays, shortens
the furniture-detail radius, halves the shadow map, simplifies clouds — and only then takes one small, sharpened
resolution step (never below ~78 %); on the CPU side it shrinks the sim and meshing budgets and draws villagers
closer only. Every step is probed: if it does not buy frame rate it is undone and the other ladder is tried, and
everything is restored when the frame rate has been fine for a while. Your settings never change. Villager
shadows are cached and furniture detail only casts shadows close by, so towns cost less to begin with.

## Modes

| Mode | What it is |
|---|---|
| Survival | Gather, mine with tiers of tools, eat, stay alive |
| Creative | Every block and item, flight, instant breaking |
| **Zen Builder** | Creative without anything to bother you: no mobs, raids, damage or hunger; freeze time and weather from the pause menu, ghost mode for flying through terrain |

## Multiplayer — play together

The claude.ai version of the game is multiplayer: everyone who opens the game's link can see the
worlds that are being played right now and join them.

| Step | How |
|---|---|
| **Invite a friend** | In claude.ai open the game → **Share** → invite your friend's account as *Contributor* (or *Editor*) — viewers can watch but not play along. You both need to be signed in. The link always opens the newest version of the game. |
| **Host** | Just play a world (Settings → Game → *Friends can join my worlds* is on by default). |
| **Join** | Your friend opens the link — your world shows up on the title screen with a **Join** button. They spawn right next to you. |
| **Find each other** | **Esc → Multiplayer**: the host can **Call here** any player, a guest can **Teleport to host**. Names float over heads and friends show on the minimap. `/players` lists who is on, `/tphost` and `/call <name>` do the same from chat. |
| **Chat** | **T**, type, Enter — plain text goes to everyone in the world. |
| What is shared | The world itself (every block anyone builds or breaks, also while the other one is far away), time of day and weather, each other's avatar, ships you fly, inventory and health of a guest (the host keeps them for the next visit). |
| Guests' own worlds | A guest can still create and play their own worlds (Survival, Creative, Zen) — and host them for you. |

Not shared yet: villagers, animals and monsters are simulated by each player on their own, and
chest contents stay with the host. Offline copies of `index.html` play single-player.

## Your hero

You are an armoured explorer like the heroes in the trailer: a suit with chest and back plates, shoulder
pads, knee pads and boots in an accent colour, a glowing core on the chest, gloves — and when you hold
a blaster, you carry it aiming. Pick your look in **Settings → Game → Your hero** (8 suits, hair colour
and style, skin); press **F5** to see yourself. Friends in multiplayer see you exactly like this.

## Getting home

Dying or getting lost in the endless world is no problem: you always come back to solid ground.

- **Respawn** at your bed if you slept in one (and it still stands), otherwise at the world's spawn —
  the game waits until the ground there has loaded, so you never fall through the world.
- **Esc → 🏠 Go Home** (or `/home`) takes you back to your bed or the world spawn at any time;
  `/sethome` makes the spot you're standing on your home, `/spawn` goes to the world spawn.

## Villages & mini-voxel homes

| Thing | How it works |
|---|---|
| **Villages everywhere** | A village sits roughly every 200 blocks on friendly land — and your world starts in one. Follow the chimney smoke and the glowing street lamps — with the far horizon on you can spot
villages' colourful roofs (and their lit windows at night) hundreds of blocks away; the compass under the minimap always points to the nearest village (⌂), and the world map (**M**) names them all. `/locate village` works too. |
| **Voxel Architecture** | Every building is made of *Voxel Homes* blocks: each block is an 8×8×8 mini-voxel sculpture that details itself from its neighbours — timber braces, brick bonds and quoins, tiled roof courses with ridge caps and barge boards, windows that merge when stacked, shutters and flower boxes beside windows, door jambs and lintels, fences that connect, rugs that join into one big rug. They light, shadow, collide and mine like normal blocks. Creative tab **Voxel Homes**; villagers trade them too. |
| **Tropical tech cities** | Some villages — most in the jungle, a share everywhere else — are built from the Voxel Tech kit, like the city in the trailer: white panel buildings two storeys high with glowing cyan window bands and orange floor bands, roof gardens and domes, plaza lanes with a glowing light-line down the middle, palms along the streets, a holo table on the plaza ringed by palms, and a spaceport with a landing ring. At night the whole city glows. |
| **Villagers** | Every home has a family — partners, kids, grandparents — each with a name, a job, a personality and a favourite thing. They're hi-res mini-voxel characters (1/32-block voxels): expressive faces that blink and talk, hair styles, role outfits (overalls, aprons, robes, hi-vis vests, flight suits), hats and tools. They wake up and have breakfast together, farm (harvest & replant), bake and deliver bread, forge, read, garden, chat and hug, gather in the evening and sleep in their own beds. Rangers keep watch at night and shoot monsters. |
| **Kids at play** | Children really play: tag (the one who's "it" counts, then chases), hide & seek (the seeker counts at the well, the others hide behind houses), and hopping games at the plaza. |
| **Lantern Festival** | Every third evening a village celebrates — and the village you start in does so on your very first night. Everyone gathers on the plaza: a circle dance around the well (the children dance their own ring), musicians strum by the bell, grandparents watch from the benches, sky lanterns drift up at dusk and fireworks burst over the roofs after dark (peonies, rings, willows, palms, crossettes), with a festive village band when you're there. A toast in the morning tells you which village celebrates tonight. |
| **Family outings** | Families go on hikes to hilltops and have a picnic with a view, and villages near a lake or the sea take their little sailboat out for a trip. |
| **Build a house, get neighbours** | Build a room near a village — walls, a roof, a door and at least one bed — and a family moves in (one bed: a single villager, two: a couple, more: a couple with children). They add a doorstep if needed, sleep in your beds, eat at home and join village life; the whole village likes you a little more. |
| **A village that grows** | Builders raise brand-new homes on the village's free plots, block by block — when a house is done a new family moves in. Knock something down and the builders come and repair it. |
| **Talk** | Right-click anyone: chat, ask about the village (they'll mark the next village on your map), help with a request for a reward, trade (emeralds) or give a gift. Friendship hearts grow with every kind deed. |
| **The Starbase** | Every new world starts inside a tech city's Starbase: a control room with a holo wall, curved consoles staffed by flight controllers, lockers, a holo table, and a glowing octagonal portal that opens onto the landing apron where the city's ship waits — the trailer's walk-out shot. |
| **Citadels** | Sci-fi citadels crown the mountain tops: clusters of tall fluted spires with cyan window slits, orange trim rings at every setback, antenna masts with red beacons, a dish tower, a paved terrace with a landing pad and crystal groves on the slopes. You can see them from kilometres away. |
| **Lava cracks** | Glowing magma seams run across the mesa tops of the Ember Canyons, with open lava pools where two cracks meet. |
| **Bigger villages** | New worlds have villages roughly every 320 blocks with wide streets, a ring lane, up to ~40 homes with front and back yards (flower beds, fruit trees, laundry lines, picnic tables, mailboxes), farmsteads (fenced pastures with a shelter and animals' troughs, orchards, red barns with hay lofts, windmills) and a supermarket. |
| **Sky rails & trams** | Neighbouring villages are linked by sky rails, like in the trailer: arched viaducts on tall pillars that climb high above valleys, lakes and forests, with lamps along the parapet and a station with a canopy and benches outside each town (stone brick for classic towns, white panels for tech cities). A two-car sky tram shuttles between the stations on a timetable. Right-click a car to ride, **F5** to watch it from outside, **Shift** at a station to get off (between stations a second Shift puts you on the roof). |

## Voxel Tech — the builder's kit

A creative tab full of mini-voxel pieces for building hangars, control rooms and a tropical tech
city — each piece fills one block and snaps to the grid, and most of them join up with their
neighbours:

| Piece | Joins up how |
|---|---|
| **Tech walls** (white panels, orange trim, light strips, hangar panels, hex walls) | Big two-by-two panels; light strips run on around the room |
| **Holo screens** (cyan, amber) | Placed side by side or stacked they become one big screen with one frame; radar, charts, maps and text shimmer with scanlines |
| **Control consoles** | Join into long desks with rows of lit buttons |
| **Hex lights** | Hang under a ceiling (or stand on a floor); neighbours link with light bars |
| **Plaza tiles & light-lines** | Light-lines follow each other into glowing paths and curve round corners |
| **Landing pad ring** | A 3×3 draws one big glowing ring with a hazard rim |
| **Glass walls** | Merge into one glazing with a frame only round the outside |
| **Octagon portal frame** | Build a ring round an opening: the corners chamfer into an octagonal portal |
| **Glass railing**, **lounge sofas** (join into long sofas), stools, desk, suit locker, holo table, tropical planter | |
| **Palms** (trunk, crown, fronds), ferns | Stack trunks, put a crown on top and click fronds onto its sides |
| **Domes** | One block is a small dome; two-by-two make one big dome for mushroom towers |

## Starforge tech

| Thing | How it works |
|---|---|
| **Cockpit view** | Fly any ship in first person (F5 cycles views) and you sit behind a jet-style instrument panel — radar, navigation and systems screens, a side-stick and throttle that move with you, a slim canopy frame that keeps the view wide open — with a glowing heads-up display: pitch ladder, heading tape, speed, altitude, throttle and boost. |
| **Autopilot** | Sitting in a starship, press **G**: the ship climbs to a safe cruising height, flies you to the nearest village, finds a clear landing field outside the houses and touches down ("Welcome to …!"). Press G again to pick the next village, any flight key takes the controls back. Look around freely while it flies — the heads-up display shows the destination marker, distance and ETA. In villages with a landing pad, the village pilot lends you their shuttle: talk to them and choose **Fly me to another village**. |
| **Mini-voxel starships** | Detailed ships built from cubes a quarter of a block: shuttles, interceptors, racers, gunships, dropships, freighters, cruisers and capital carriers, grown from seeds with panel seams, framed canopies, glowing engine bells, stripes and the ship's code stencilled on the hull. Every outpost has one parked on its pad — right-click to board, mouse to steer, **V** to land. Creative: the **Shipyard** (Shuttle Beacon item or `/ship`) previews and launches any design. |
| Sky traffic | Ships drop out of hyperspace, cross the sky in formations and jump away; when raiders attack at night a defence wing arrives. |
| **Ships you build** | Build any hull around a **Ship Helm** and right-click the helm: every block connected to it lifts off as one ship (thrusters and reactor cores make it faster, heavier ships turn slower). Steer with the mouse, W/S thrust, A/D strafe, Space/Shift climb/descend, Ctrl boost, left-click fires nose lasers, F5 switches cockpit/chase view, **V lands** — the ship snaps back into the world as blocks, chests and all. Landing Pads and terrain are never lifted. |
| Shuttles | Every Starforge outpost has one docked on its pad. In Creative, the **Shuttle Beacon** item (or `/shuttle`) conjures one in front of you. |
| Hoverbike | Right-click to ride (outposts keep one parked), W/S throttle, mouse or A/D steer, Space hops, Ctrl boost, left-click blasters, Shift to get off. Sneak + right-click picks it up. |
| Jetpack | Wear it (chest slot) or hold it: jump and hold Space. Fuel refills on the ground. |
| Pulse Blaster / Mining Laser | Left-click fires; the blaster overheats, the laser mines anything it touches. |
| **Builder Wand** | Left/right-click two corners, then: **F** fill · **H** hollow box · **G** walls · **X** clear · **C** copy · **V** paste · **R** rotate clipboard · **Z** undo. It builds with the block in the hotbar slot to the right of the wand. |
| Geo Scanner | Right-click to see ores through walls for a few seconds. |
| Waypoints | **N** drops one, the Waypoint Marker item places one where you look; they show as light beams, on the minimap and on the world map (**M**, click to add, right-click to remove). |
| Photo Drone | Right-click to fly a free camera; left-click takes a picture. |
| Turrets | Pulse Turrets shoot hostile creatures on their own — outposts have them, you can craft them. |
| Nights | In Survival, raider drones sometimes attack at night, and meteors can crash nearby — the craters hold crystals and a Star Core. |

The **Discovery Codex** (pause menu) tracks biomes, creatures and milestones.

## Controls

| Key | Action |
|---|---|
| WASD / Space / Shift | Move / jump · fly up / sneak · fly down |
| Ctrl or double-tap W | Sprint |
| Double-tap Space | Toggle flight (Creative, Zen Builder) |
| Mouse | Look (click the view to capture the mouse — if the browser refuses, drag to look and click again to recapture) |
| Left / right / middle click | Break / place or use / pick block |
| Shovel: right-click · Shift + right-click | Make a natural block crisp (cube) · smooth it and its crisp neighbours back into the slope |
| 1–9, mouse wheel | Hotbar |
| E | Inventory (creative palette with search) |
| Q | Drop item |
| T or / | Chat & commands (`/help`) |
| F1 / F2 / F3 / F5 | Hide HUD / screenshot / debug / camera |
| P | Photo mode |
| M / N | World map / drop a waypoint |
| V | Land a ship / get off a vehicle |
| G | Autopilot to the next village (in a starship) |
| Blueprint in hand: right-click · R · F · Z | Build the house where you look · turn it · next facade · take it back |
| Esc | Pause · settings · Zen tools |

Useful commands: `/time set night`, `/weather rain`, `/gamemode zen`, `/locate outpost`,
`/locate prism_fields`, `/give laser_blaster`, `/tp x y z`, `/render 12`, `/ship`, `/ship cruiser`,
`/traffic carrier`, `/shuttle`, `/bike`, `/meteor`, `/wp home`.

Building commands (Creative / Zen Builder): `/pos1`, `/pos2`, `/fill <block>`, `/walls <block>`,
`/hollow <block>`, `/clear`, `/replace <from> <to>`, `/copy`, `/paste`, `/rotate`, `/undo`,
`/sphere <block> <radius>`, `/hsphere …`, `/cyl <block> <radius> <height>`, `/hcyl …`.

Houses: `/haus` lists the villa catalogue (★ = your R9 Studio design), `/haus <n>` puts its blueprint in your hand.

## Graphics presets

**R9 Super Resolution** (on in every preset): the scene is rendered at a reduced resolution (Low: half width and height) with a tiny sub-pixel offset that changes every frame; a temporal upscaler reprojects the previous full-size image with the depth buffer, keeps what still matches and blends in the new samples, so the picture builds up to near full sharpness and is anti-aliased at the same time. Sun shadows use the same trick (half the ray steps, dithered, averaged over frames). Toggle it under Settings → Graphics.


Settings → Graphics: **Low / Balanced / High / Ultra**. Low lowers render distance and skips the
heavy effects so it runs on integrated GPUs; Smart Quality keeps the frame rate smooth without blurring.

- **Soft sun shadows on every preset** — even Low: the sun's rays are traced through a height map of
  the loaded land (a few texture reads per pixel, no extra geometry pass), so trees, houses and
  mountains cast soft shadows with penumbras, all the way out to the edge of the loaded world. On
  Balanced and up, a cached shadow map adds exact close-range shadows; it is only redrawn when the sun
  moves or blocks nearby change, not every frame. Villagers and friends are shaded too when they
  stand in the shade.
- **Sharpening** — contrast-adaptive sharpening keeps the image crisp, especially when dynamic
  resolution renders below screen size; anti-aliasing only smooths real edges and leaves textures sharp.
- **Colour** — a vivid tone curve keeps glowing crystals, lava and sunsets coloured instead of
  washing them out to white; the nebula fades in over the sky at golden hour.

**Far horizon** (Settings → Graphics): beyond the loaded chunks the world keeps going as a
light-weight distance model built from the same terrain generator — mountains, mesas, forests
with real tree silhouettes, snow caps, lava and aether rivers, crystal spires, sky islands,
villages (every house, roof colour and street lamp, windows lit at night) and the open sea, out to 1, 2, 3 or
**5 km** (Low and up; Very Low starts at 2 km). The coarse ring is preloaded before the world opens, the finer
rings stream in behind it, and nearby it hands over seamlessly to the real blocks as they load; it costs very
little, so leave it on even on weak laptops.

## Build from source

```
node build.js        # writes dist/index.html (copy it to the repo root as index.html)
```

The engine is plain JavaScript + WebGL 2 with Web Workers — no dependencies:

- `src/shared` — block registry (1000+ blocks, ~6000 states), models, world generation
  (multi-noise terrain, caves, biomes, realm layer, structures), lighting, meshing, physics
- `src/main` — renderer (multi-draw, cave culling, shadows, HDR, bloom, god rays, water,
  aether, clouds, cosmic sky), world streaming & light propagation, player, UI, audio, particles,
  procedural textures and item sprites
- `src/worker` — worker entry (generation, lighting, meshing, texture forging)

## Old version

The previous **voxel-realm** project is kept in `legacy/voxel-realm/` (and in git history under
the tag `v0-voxel-realm`). To play it: double-click `legacy/voxel-realm/start.bat` (Node.js 20+).
