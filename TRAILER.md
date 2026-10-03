# R9-SI · Trailer World Concept

The trailer (`Trailer of R9-SI.mp4`, 30 s, 1296×704) is the target. This document turns every frame of it
into a buildable specification: what the world around the player looks like, how big every element is,
which colours and materials it uses, and how the shots are lit. Everything in the game's home region is
generated to this spec first; the rest of the endless world blends into it beyond the Heartland.

Scale reference used throughout: a hero is 2 blocks tall, the player's shuttle ~18 blocks long,
a round tree crown ~6 blocks wide, one block = 1 m.

---

## 1. Shot list (what the trailer shows)

| t (s)       | Shot | What is on screen |
|-------------|------|-------------------|
| 0.0 – 2.75  | **A · Canyon flyover** | Aerial push over ember mesas: orange/brown strata mesas with green caps, glowing lava cracks, a cyan aether river in the canyon, rail viaducts looping around the mesas on thin pillars, crystal clusters (magenta, cyan, green), tech watchtowers with cyan lights & red beacons, turret nests, a small purple/orange ruin village, a mountain top space-station, floating islets, a shuttle + fighters with contrails, a dogfight; ringed gas giant, moons, nebula, sun on the horizon. |
| 3.0 – 5.75  | **B · The Spire Citadel** | Slow pull-back on an enormous fluted gothic-sci-fi spire cluster (tan/brown stone, cyan arched window slits, orange trim rings, red tip beacon), a watch tower with a saucer ring, two stone-arch viaducts crossing in front, forest + lava streams + giant blue crystals at its foot, clouds drifting through, a blue-green planet, a banded gas giant, ships in loose formation with contrails, a blue sparkle beam rising from the spire. |
| 6.0 – 8.75  | **C · Sky Isles** | Follow-cam behind the shuttle over an archipelago of chunky floating islands: grass domes, layered earth/rock sides, inverted-cone undersides, waterfalls and lava falls pouring off the rims, asphalt roads with yellow dashes looping across the tops, wooden trestle bridges and a stone viaduct between islands, round oaks, crystals, a hoodoo island with a cave arch, a small stone temple, fog below, sunset. |
| 9.25 – 11.0 | **D · Gate Temple approach** | The shuttle skims a flagstone plaza toward a monumental slate-blue temple: octagonal glowing portal, stepped tiers with amber windows and orange light bars, fluted towers, two saucer-pad towers, twin grand staircases to garden terraces (lawns, round trees, magenta crystals), a domed hall to the right. |
| 11.25 – 19.0| **E · Hangar Hall** | Inside: a dark-navy octagonal hall lit cyan — concentric octagon floor lines around a central landing pad, holo screens with radar/readouts, button consoles, hex light rings in the ceiling, orange accent lights; two heroes in blue/orange armour, the shuttle hovers in and settles; the far end is an octagonal door that opens onto the city. |
| 19.25 – 29.75| **F · Palm City walk** | Heroes walk out into the tropical tech city at night: white/grey stepped buildings with turquoise glass bands in amber frames and orange light strips, roof gardens and railings, tall palms and fan palms, lawns with hedges, curved light-grey streets with cyan light lines along both edges, villagers waving, green hills behind with white pod houses and white ribbon paths, nebula sky. |

Everything below is derived from these six shots.

---

## 2. Global look

### 2.1 Sky & light — "Eternal Dusk"
* The sun never climbs high: max elevation ≈ 32° (flattened arc). Daylight is a long golden hour; the
  land is lit warm and low from the side, shadows are long. Sunrise/sunset (sun within ±8° of the
  horizon) last ~2× longer than a normal cycle.
* The cosmic sky is visible all day, not only at night: nebula veil (magenta / violet / cyan) at
  ~45 % strength by day, 100 % at night; the ringed gas giant (lilac bands, ring seen at a slant,
  angular radius ≈ 7°), the blue-green cratered planet (radius ≈ 5°, brighter, upper sky), 3–4 small
  grey moons (radius ≈ 1.2–1.8°), stars from dusk on, occasional meteors at night.
* Day sky gradient: horizon peach/pink → mid violet-blue → zenith deep blue. Night: navy with the
  nebula band. Clouds: puffy white, sparse (cover 0.2), drifting at y 200–215 — they wrap around the
  citadel spires and hang below the sky isles as fog banks (fog band at y 100–120 under the islands).

### 2.2 Palette
| Use | Colour |
|-----|--------|
| Grass (Heartland) | saturated green `#5FD13A` top, `#3F9A2A` shade; lawns `#6EDB48` |
| Round tree crowns | `#2F8A34` / `#4AB046`, trunks `#6A4A2A` |
| Mesa strata | ochre `#BD6A2A`, umber `#7C5E48`, orange terracotta `#D8883C`, red band `#A03A1E`; green caps |
| Canyon rock (dark) | slate `#4A5568`, blue-grey `#5C6C82` with cyan veins |
| Lava | core `#FFE066`, body `#FF7A1A`, rim basalt `#2A2530`, glow radius 3 |
| Aether water | `#3AC8FF` glowing, cyan-white foam |
| Crystals | magenta `#E040FF`/`#8A2AD0`, cyan `#40D8FF`/`#1A6AD0`, green `#4AE070`, rose `#F05AA0` |
| Temple stone | slate blue `#6C7A8C`, groove `#46505E`, highlight `#8C9AAC` |
| Temple lights | amber window `#FFB02A` (glow), orange strip `#FF7A1A`, cyan slit `#3AF0FF` |
| Citadel stone | tan `#C9A97E`, brown flute `#8A6640`, dark seam `#5A4028`; trims `#FF9A2A`; slits `#3AF0FF`; tip beacon `#FF3A3A` |
| Hangar hall | navy panels `#1E2A3C`/`#2C3A50`, cyan `#3AF0FF`, cyan-white `#C8FFFF`, amber accents `#FF9A2A`, floor `#3A4658` |
| City buildings | white `#E9EDF2`, light grey `#D2D9E1`, dark trim `#5A6472`, window glass `#9AF4FF`, frames `#FF9A2A` |
| Streets | pavement `#D6DBE2`, road `#C4CBD4`, light line `#3AF0FF`, curb `#AAB2BC` |
| Pod houses | white `#F2F4F8`, cyan-green glow dots `#5AFFB0` |
| Ships | white `#E8ECF0` + orange stripes `#FF7A1A`, blue canopy `#4A8AFF`, engine glow cyan-white, contrail white → grey smoke, sparkle stream `#7AD0FF` |

---

## 3. The Heartland — layout

The Heartland is the designed region around the world origin. Every new world starts here; it is the
same composition in every seed (details vary with the seed). The **Gate Temple faces south (+z)**.

```
                    z −400 ┌──────────── Pod Hills (y 90→118) ────────────┐
                           │  white pod houses, tube houses, ribbon paths   │
                    z −220 ├──────────────── Palm City ───────────────────┤   ┌ Mountain Station (−380, −150)
                           │  stepped tech buildings, palms, lawns, streets │   │  jagged peaks y 150–175
                    z −45  ├───────────── GATE TEMPLE (0,0) ───────────────┤   │
                           │  110 × 70 footprint, portal faces +z          │
                    z +20  ├──────────── Gate Plaza & runway ──────────────┤          Sky Isles (east)
                    z +140 ├──────────── Ember Canyon (mesas) ─────────────┤   ┌ 7 islands around (330, 155, 140)
                           │  lava cracks, aether river, crystals, towers   │   │  r 22–45, roads + bridges
                    z +520 └───────────────────────────────────────────────┘
       Spire Citadel (−420, 112, +380) on its mountain, viaducts toward the plaza
       beyond r ≈ 700 the Heartland blends into the procedural world (r 700 → 900)
```

Ground level of the plateau: **y = 80**. Sea/aether level of the canyon floor: y = 58.

### 3.1 Gate Plateau (r ≤ 140 around the origin)
Flat (±1) green plateau at y 80, lawns and pavements, no caves under the temple, no trees except the
designed ones. Edges drop with terraces (2–3 steps of 4) into the canyon on the south and rise gently
into the city on the north.

### 3.2 Palm City (z −45 … −220, x ±180)
* Terrain y 80–84, green lawns everywhere the streets and lots are not.
* Streets: light-grey pavement 5 wide, **cyan light line along both edges**, curved (crescents and
  S-bends), a main avenue running north from the temple's back door, two crescents crossing it, side
  lanes; curb strips; lawns with hedges (dark green box hedges 1 high), fan palms and planters at
  the street islands; tall palms (trunk 8–12) every ~9 blocks alternating sides.
* Buildings (40–60): 2–4 storeys, **stepped** — each upper storey set back 1–2 blocks on one or two
  sides so terraces with glass railings and roof gardens appear; footprints 8–14 × 8–14; walls white
  tech panels; **turquoise window bands** (whole storeys of `vx_window_tech`, amber frames) on the
  street sides; thin orange light strips under every floor edge; flat roofs with round bushes,
  planters and a small dome on some. Cantilevered balconies (2 deep) on the top floor.
* Lamps: tech lampposts; plaza in the middle of the city with palms and a holo table.

### 3.3 Pod Hills (z −220 … −400)
Grass hills rising to y 118 (soft, rounded). On them: white **pod houses** (2×2 dome on a 1-wide stem,
4 tall, glowing cyan-green door dot), white **tube houses** (3-wide half-cylinders 8–14 long, lying on
the slope), white 3-wide ribbon paths winding up the hill with light dots, a few palms and round trees.

### 3.4 Gate Plaza & runway (z +20 … +140, x ±40)
Brown-grey flagstones (`vx_floor_stone`); a central **runway** 9 wide of dark deck plates with a cyan
light line down each edge, running from the portal to the plaza's south rim where the plateau drops
into the canyon (the shuttle's approach path); lamp posts every 12 blocks; two rows of round trees and
hedges at the plaza sides; magenta crystal clusters in the corners.

### 3.5 Ember Canyon (z +140 … +520, x ±350)
* Mesas: flat-topped, y 92–106, sides banded ochre/umber/terracotta, tops capped with green grass
  and scattered round trees / dry grass; mesa diameters 30–90; canyon floors at y 58–62 with a
  glowing **aether river** and lava streams (magma banks, basalt rims).
* **Lava cracks**: bright seams 1–2 wide across the mesa tops (existing crack noise), pools where
  cracks cross, scorched basalt rims, lava glow.
* **Crystals**: clusters 8–22 tall (violet/rose = magenta, azure = cyan, verdant = green) — 1 per
  mesa on average, plus small clusters on ledges.
* **Watchtowers**: cylinder r 2.5, 22 tall, dark hull with cyan light strips, a wider top deck with
  a red beacon and an antenna; 1 per ~2 mesas. **Turret nests**: 5×5 hull pads with 2 turrets.
* **The Canyon Loop** (sky rail): a closed loop ~600 long around three mesas, deck 3 wide on thin
  pillars (1×1 dark hull, every 6 blocks) 6–18 above the mesa tops, S-curves, a station at the plaza's
  south-east rim; trams run on it.
* Basalt pillars, ember ochre veins, a small ruin village of purple/orange stone (pink windows) on
  one mesa (the trailer's first frame).

### 3.6 Sky Isles (centre (330, 155, 140))
* 7 islands: C (r 42, top 158), N (r 30, 164), NE (r 26, 150), E (r 34, 156), S (r 36, 152),
  SW (r 24, 166, the hoodoo island: a 28-tall banded rock mesa with a 5×7 cave arch through it),
  W (r 28, 160). Gaps between islands 12–30 blocks.
* Form: grass dome +3, 4 blocks of dirt, then 6–10 blocks of ochre/umber strata, then grey stone,
  inverted cone underside to depth 0.8 r with jagged edges, hanging roots and moss; 2–4 waterfalls
  per island from rim pools (existing system), the S island carries a lava river and a lava fall.
* On top: round oaks (crown 5–7), bushes, flowers, 1–3 crystal clusters 8–20 tall, ferns.
* **Roads**: 3-wide asphalt with a yellow centre dash, looping across the tops (S-bends), linking
  island to island over **trestle bridges** (plank deck 3 wide, wooden railings, 2×2 log pillars every
  6 blocks reaching 20 below the deck) and one **stone-arch viaduct** carrying the Isles rail loop
  (C → N → E → S → C).
* The **Isle Temple** on C: 15×15, three stepped tiers, 22 tall, grey stone with cyan slits and a
  small octagon portal facing the road.

### 3.7 Spire Citadel (−420, 112, +380)
* Mountain: a rounded summit at y 112, r 60, flanks to the canyon floor; forest of round oaks on the
  lower flanks, three lava streams, six giant crystals (azure 25 tall, violet 16, verdant 12).
* Plinth: r 34 stone terrace at y 112 with a ribbed rim.
* **Main spire**: base r 13, height 140 (tip y 252), radius profile r(t)=13·(1−t)^0.7+0.6, 8 flutes
  (ribs +1–2 blocks every 45°, alternating tan/brown colour per flute); cyan window slits (1×4, dark
  mullion) at t 0.15/0.30/0.45/0.60/0.75 on 4 sides; orange trim rings at t 0.2/0.42/0.62/0.8;
  small buttress pinnacles r 2–3, h 20–35 around the base; white cap + red beacon.
* **Five secondary spires** around it (distance 14–22, r 6–9, heights 0.45–0.7 of the main) with the
  same fluting, windows and trims — the cluster reads as one cathedral mass.
* **Watchtower** 60 blocks north-east: fluted shaft r 5, h 62; a **saucer ring** at h 48 (disc r 10,
  3 thick, cyan rim windows); spike +14 with a red beacon.
* **Viaducts**: two stone-arch viaducts (deck 5 wide: rail track + walkway, glass railing with cyan
  line; piers 3×3 tan brick every 10 blocks, round arches; orange lamps on every pier) leaving the
  plinth northward toward the plaza rim and eastward into the canyon, decks 30–40 above the ground.
* A blue **sparkle beam** (particles) rises from the main spire's mid-height at night.

### 3.8 Mountain Station (−380, 150–175, −150)
Jagged dark blue-grey peaks (aether veins glowing cyan in the rock) with a station grown onto the
summit: central hull tower r 6, h 40; three levels of radial modules (9×5×7 boxes with viewports and
cyan strips) cantilevered off the rock; an antenna mast h 25 with a saucer r 6; two landing pads on
stems (r 6) off the flanks; an octagonal hangar mouth facing the plateau; red/orange beacons.

### 3.9 Beyond the Heartland
From r 700 the designed terrain blends over 200 blocks into the procedural biome world (villages,
outposts, citadels, islands, canyons keep spawning there as before).

---

## 4. The Gate Temple (home base)

Footprint 110 (x) × 70 (z), centred at (0, −10); front face at z = +20; symmetric about x = 0.
Ground y = 80 (F). All dimensions in blocks.

* **Central block** (x ±22, z −10…+20): three tiers — tier 1 y 81–96 full width 44; tier 2 y 97–108
  width 32; tier 3 y 109–116 width 20; crown antenna + beacon to y 124. Fluted pilasters every 6
  blocks on every tier face (1-block ribs), orange light bar on every tier's top edge, amber windows
  (3 wide × 5 tall, mullioned) in the bays between pilasters, cyan slits at the corners.
* **Portal**: octagon 13 wide × 13 tall, opening y 81–93, framed by a 2-thick octagon ring of slate
  frame blocks with an amber glowing inner edge; the opening is filled with the **portal veil** (a
  translucent amber-yellow energy field, non-solid, animated; ships and people pass through).
* **Wings** (x ±22…±55, z −25…+15): 24 tall, tall amber windows in bays, pilasters, a top band of
  orange light, glass railings on the roof edge; inner courtyards with lawns.
* **Fluted towers**: four at the back corners of the wings (r 4, h 60, cyan slits, orange rings,
  pointed caps) and two at the central block's back corners (r 3.5, h 48).
* **Pad towers**: two at x ±40, z +8: stem r 2.5, h 40; saucer disc r 7, 3 thick, cyan rim lights,
  landing ring on top; an amber light ring under the disc.
* **Domed hall** at x +62, z −5: r 12 dome on a 6-tall drum with cyan bands and a spire.
* **Grand stairs**: two, 8 wide, from the plaza (y 80) up to terraces at y 88 at x ±26…±34,
  flanking the portal; terraces 22 × 16 with lawns, a round tree, hedges, magenta crystals, lamps.
* **Hangar Hall** (interior): axis along z from the portal (z +20) to the back door (z −40);
  octagonal cross-section 21 wide × 15 tall (chamfers 4); floor dark hex deck with **concentric
  octagon light lines** around a central **landing pad** (11 wide ring) at z −10; walls navy panels
  with cyan strips; on each side a 9 × 5 **holo screen** over a curved row of 6 **consoles** with
  stools (at z −2 … +8); lockers and amber accent lights between; ceiling: an **octagonal light
  ring** of cyan hex lights at the centre, hex lights every 4 blocks; **back door**: octagon 9 × 9
  opening onto the city's main avenue. The player spawns on the pad facing the portal.

---

## 5. Living things & vehicles in the shots
* Ships: the white/orange shuttle and squadrons of fighters (existing designs) with white contrails
  fading to grey smoke and the cyan sparkle exhaust stream; formations of 3–5.
* Villagers in casual clothes waving (existing folk), heroes in blue/orange armour (existing suits).

---

## 6. Gap analysis (v0.18 → trailer) and build order

| # | Element | Now | Target | Status |
|---|---------|-----|--------|--------|
| 1 | Sky & light | nebula/planets mostly at night; sun climbs to zenith | eternal dusk, cosmic sky by day, planet sizes as in §2.1 | done v0.19 |
| 2 | Heartland terrain | random biome at origin (prism/beach), purple grass | designed plateau/canyon/hills, green Heartland | done v0.19 |
| 3 | Gate Temple | 15×22 starbase lot | 110×70 monumental temple + hangar hall | done v0.19 (refining) |
| 4 | Palm City | tech village v2 (white boxes, centre lines, purple ground) | stepped buildings, edge light lines, lawns, palms, hedges | green lawns & avenue v0.19; stepped buildings to do |
| 5 | Pod Hills | none | pods, tube houses, ribbon paths | done v0.20 |
| 6 | Ember Canyon | ember biome by noise, cracks | designed mesa field with loop rail, towers, crystals, ruin village | done v0.20 (Canyon Loop tram, watchtowers, turret nests, ruins) |
| 7 | Sky Isles | random islands r 8–32 | designed archipelago with roads, bridges, viaduct, temple, hoodoo arch | done v0.20 (rail viaduct to do) |
| 8 | Spire Citadel | thin towers h 72–105 | fluted spire cluster h 140, watchtower, viaducts | done v0.19.1 |
| 9 | Mountain Station | none | hull modules on a jagged peak | done v0.21 (dusk-rock peaks with aether veins, clouds raised above the mast) |
| 10 | Blocks | — | temple stone set, amber windows, light bars, spire stone, asphalt + dash, hedges, pods, tubes, portal veil, saucer discs | done v0.19 |
| 11 | Trailer camera | none | cinematic fly-through of shots A–F | after the world |

Build order: 1 → 10 (blocks) → 2 → 3 → 4 → 8 → 6 → 7 → 5 → 9 → 11. Each step is verified with
`test/survey.mjs` screenshots placed beside the trailer frames.
