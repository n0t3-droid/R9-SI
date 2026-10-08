# Realism wave (wave 3) — „real, schön, flüssig — auch auf dem schwächsten PC"

Status: design, 8 Oct 2026, for eight parallel builders. The owner's brief, in his order of importance: extreme visual
beauty and efficiency, perfection and realism — realism that weak PCs can play too; graphics and everything that
supports it, textures, the illusion of really being there (real scale, real feel); super-satisfying sound; every
control and setting re-engineered; architecture that looks real inside and out, items that feel real; water of
indescribable beauty; view distances of 1 km and 3 km as smooth as the shortest. Everything GitHub-ready, a testable
game version after every big hurdle.

Rules that hold for every front (read before the plan): low-end PCs first — every effect has a cost tier and a switch,
the Very Low (potato) preset must get FASTER or stay equal, never slower; nothing is copied from other games or
brands (procedural, our own); block ids append-only (test/id_snapshot.js); saved worlds and the mesher's reference
hashes stay valid unless a proof and a new reference come with the change (test/mesh_same.js, gen_same.js,
light_same.js); every player-facing text via VR.I18N (German first); no external requests; every test ends with
ALL OK / FAILED n; screenshots are evidence — every front delivers before/after pictures and LOOKS at them.

**Measuring.** The headless browser renders with SwiftShader (CPU), so absolute frame times mean little; relative
costs do. Every front measures its own effect: `renderer.stats` (draw calls, tris, pass times via
`performance.now()` around passes) in a fixed scene (the Heartland plaza at noon, seed 1, 1280×720) with the
effect off and on, on Very Low and on High, and writes the numbers into its plan. A front that cannot show its
Very-Low cost is not done. Where a GPU timer is needed, `EXT_disjoint_timer_query_webgl2` when present, else the
CPU-side pass time plus the fill cost model (pixels × passes).

## F1 · Licht & Luft — the lighting and atmosphere core (most important)

The scene's light is what makes a picture real. Today: one directional sun with a shadow map (tiers 0–3), per-vertex
sky/block light from the voxel light field, fog by distance, bloom, god rays, ACES, FXAA, TSR.

Build, in cost tiers (each one a setting with a sentence of what it costs):
- **Himmel**: an analytic daylight sky (a Preetham/Hosek-style fit implemented from the formulas, our own
  coefficients) — a sun disc with limb darkening, horizon haze, aerial perspective (distant things tint toward the
  sky colour by distance, replacing flat fog), a sun-side glow, dusk and dawn with correct colour order (orange →
  magenta → blue), the moon with phases lighting the night faintly, stars that fade at dawn. Tier 0 keeps a cheaper
  version (the same formulas sampled into a 64×32 lookup per minute of game time).
- **Schatten**: soft shadows (PCF 3×3 on balanced, 5×5 rotated-poisson on high, hard 1-tap on Very Low), a second
  cascade for the near 24 blocks on high/ultra so a block's shadow on the ground is crisp, contact hardening by
  distance from the caster where cheap, no shadow acne (slope-scaled bias), and the clouds' shadows drifting over
  the ground (a 2D noise lookup in the fragment shader, tier ≥ 1).
- **Verschattung (AO)**: voxel ambient occlusion per vertex is there (check); add a cheap screen-space AO on high
  (8 taps, half resolution, bilateral upsample) and make the per-vertex AO stronger under overhangs and in room
  corners so interiors read as rooms at every tier.
- **Licht in Räumen**: emissive blocks (lamps, lanterns, Modern Living lights) throw warm light with a real falloff;
  windows glow from inside at night (a per-column "lit interior" flag from the light field); block light colour by
  source (torch orange, LED white, crystal violet) carried in the light field's spare bits if any, else as a per-type
  tint in the mesher.
- **Nachbearbeitung**: exposure that adapts (bright noon, dark cave: a 1-value running average of scene luminance,
  eased), ACES stays, a subtle filmic colour grade per time of day, a very light vignette, optional sharpen after TSR.
  No chromatic aberration, no film grain (they read as dirt).
- **Very Low gets prettier, not slower**: the analytic sky LUT, per-vertex AO, hard shadows only near, exposure.
  Measure: Very Low frame cost must not rise.

Tests: node tests for the sky model (sun at noon brighter than at dusk, dusk is orange, night is dark blue, the LUT
matches the formula within 2 %), the exposure easing; browser test/light.mjs with screenshots at 06:00, 12:00, 18:30,
23:00 outdoors and inside a lit house, Very Low and High — LOOK and iterate until they are beautiful.

## F2 · Texturen & Materialien

Every block's look up close. Today: procedural 16/32 px albedo + material (normal.xy / roughness / emissive) in a
texture array, Klassisch v2 outlines.
- A **detail layer**: a per-material procedural micro-texture (stone grain, wood fibres, fabric weave, brushed
  metal, plaster roughness) sampled at 4× the block frequency and blended in only within 12 blocks (fades out), so
  blocks stop looking flat up close without changing the far look; tier ≥ 1; the classic outline stays on top.
- **Normal maps for every block** that lacks one (bricks' mortar grooves, planks' gaps, tiles' joints, leaves' depth);
  the light then models them (F1's sun) — this is the single biggest realism win per cost; stored in the existing
  material channel.
- **Wet look**: in rain and near water the roughness drops and a thin specular layer appears on stone, paths and
  roofs (already partly: wetGround — finish it: puddles in low spots from a per-column noise, drying over minutes).
- **Material response**: metals (brass, steel, chrome in Modern Living) reflect the sky colour (a cheap
  environment term from F1's sky LUT), glass gets a fresnel rim, fabrics are matte, varnished wood a soft sheen.
- The texture cache (tex_cache.js) and the forge in the worker must stay fast: measure the forge time before/after.

Tests: node test comparing per-type material statistics (every opaque type has a non-flat normal), tex_check; browser
test/materials.mjs: a material gallery wall (one block of each family) at 3 blocks and at 30 blocks, dry and in rain,
Very Low and High — LOOK.

## F3 · Da-Sein — scale, presence, illusion

What makes the player feel inside the world rather than looking at a screen:
- **Real scale**: the player's eye at 1.62 blocks, FOV default 75 (settable 60–110) with a sprint FOV kick (+8,
  eased 150 ms), a gentle head bob (toggle) and hand sway tied to walking speed, landing dip after a fall, camera
  inertia on turning (very small, optional), a crouch that really lowers the eye.
- **Air alive**: dust motes in sunbeams indoors, pollen in meadows by day, fireflies in grass at night, falling
  leaves under trees in wind, snowflakes that settle, birds (a flock of 5–9 silhouettes) crossing the sky now and
  then, butterflies over flowers — all from the existing particle system with a budget per tier (Very Low: fireflies
  and snow only).
- **Wind**: leaves, grass, crops and flags sway with the weather's wind (the mesher's sway channel exists — tie its
  strength and direction to weather.js, gusts included).
- **Depth cues**: aerial perspective from F1, a subtle distance blur on high only (never on text), parallax between
  the far horizon tiles and the near chunks must be seamless (F8).
- **Feel**: block placing/breaking has a tiny camera nudge and a hand animation; the first-person hand/held block is
  lit by the scene (it is drawn with the scene's light, not flat).

Tests: node test for the FOV/bob/sway curves (bounded, smooth, zero at rest); browser test/presence.mjs with
screenshots of a sunbeam room, a meadow at noon, a field at night; a 10 s sprint-and-jump sequence screenshot pair.

## F4 · Klang — super-satisfying sound (synthesized, our own)

- **Footsteps by material**: grass, dirt, stone, wood, sand, snow, gravel, metal, carpet, water splash — each a
  small synthesized family with pitch and timbre variation, speed-dependent tempo, softer when crouching.
- **Place/break by material**: a satisfying "thock" for wood, "clack" for stone, "tink" for glass, "thud" for dirt,
  "ding" for metal; breaking progress crackles; the last hit pops with a short particle burst (already) and a pitch
  rise.
- **UI**: a soft click on buttons, a "pling" on confirm, a muted "bonk" on refusal, an inventory rustle — tiny, never
  annoying (≤ 60 ms, -18 dB).
- **Space**: 3D positional audio for mobs, villagers, doors, machines (StereoPannerNode + distance gain); a reverb
  send indoors and in caves (a convolver with a synthesized impulse, or a feedback-delay network), muffling under
  water and behind walls (a lowpass by the light field's occlusion) — the ambience module has the sampling already.
- **Music**: a generative, calm, pentatonic soundtrack layer (two or three voices, seeded by the day, never the same)
  that fades out when things get tense (a mob near) and in villages picks up a gentle rhythm; a volume slider; off
  by default on Very Low? No — audio costs little; on everywhere, the slider rules.

Tests: node test with a stubbed AudioContext (every material has a family, pitch variation bounded, the graph stays
under N nodes, reverb send only indoors); browser test/sound.mjs: walk on four materials, place/break three, open a
door, go indoors (the analyser sees the lowpass / reverb change); no page errors.

## F5 · Steuerung & Einstellungen — re-engineered

- **Controls**: a key-binding screen (every action rebindable, conflicts shown, reset), mouse smoothing (off by
  default) and raw input, a gamepad (standard mapping: sticks, buttons, the ring and inventory navigable, vibration
  on landing), touch controls on phones (a left stick, look by dragging, big buttons for jump/place/break/inventory,
  the ring) — W3 of the all-ages spec; sprint toggle/hold; auto-jump (on in Einfach); a "safe mode" for small
  children (no fall damage prompts, no hostile mobs — that is Zen already; make it one tap).
- **Settings**: three groups (Bild · Klang · Spiel) with a one-line explanation and a cost badge (🟢 kaum, 🟡 etwas,
  🔴 viel) per graphics option, a live preview thumbnail of the current scene when a graphics option changes, an
  **Automatik** button: a 3 s benchmark (fixed scene, measured frame time) that picks the preset and the view
  distance so the game holds 60 fps (or 30 on weak machines) — and a running quality governor that already exists
  (aq) made visible: a small "⚙ passt an" hint when it lowers something, never a surprise.
- Every slider snaps to sane steps, shows its value, every switch says what it does in one sentence in both languages.

Tests: node tests for the binding model (conflicts, reset, serialization) and the benchmark's decision table;
browser test/controls.mjs (rebind a key and use it; gamepad via a simulated Gamepad object; the settings' cost badges
all present; Automatik picks a preset).

## F6 · Architektur innen & außen, Dinge wie echt

- **Outside**: generated houses and villas get real detail — window frames with sills, gutters and downpipes, door
  steps, planters, roof ridges and chimney caps, garden paths, fences, a lamp by the door, the Modern Living pieces
  outdoors (benches, bikes, wallboxes, pool loungers) placed by the generator with the house's style.
- **Inside**: every generated house is furnished room by room with the Modern Living pack and the furniture packs
  (a kitchen with a cooker, a fridge, an island; a living room with sofa, table, TV, lamps; bedrooms with beds,
  wardrobes; bathrooms; an office) — by a small placement grammar (walls → against-wall items, centre → table, corner
  → lamp/plant), per style, deterministic from the house seed; lights on at night (F1's interiors).
- **Items real**: dropped items spin and bob with a shadow, held items are lit by the scene, block icons in the
  inventory get the same light; chests open with a lid animation; doors swing (already: make the swing animate);
  beds have a blanket you can see move when sleeping; lamps have a visible glow sprite.
- **Streets**: lamps on at night, road markings, benches, trees in grates, a bus stop, bins (all existing or
  Modern Living pieces), parked e-bikes.

Tests: node test that every generated house type is furnished (≥ N pieces per room kind, no piece inside a wall, no
piece blocking a door); browser test/architecture.mjs: screenshots of a villa inside and out by day and night, a
village street at night — LOOK and iterate.

## F7 · Wasser, das unbeschreiblich schön ist

Today: refraction with depth-based absorption, sky reflection by fresnel, sun glints, foam at shores, Klassisch seam.
- **Reflection of the world**: a planar reflection pass for the water plane the player looks at (the dominant water
  level: render the scene mirrored at reduced resolution, 1/4 on balanced, 1/2 on high, only the near chunks and
  the horizon, once per frame when water is visible) — trees, houses and the sky mirror in lakes; on Very Low the sky
  LUT reflection only.
- **Surface**: layered gerstner-like waves (3 octaves, direction from the wind, amplitude by water body size: ponds
  calm, seas rolling), the normal built in the shader from the same functions (no texture lookups for the shape),
  sparkle from the sun by a specular distribution, a smooth shoreline blend (depth-fade alpha) so edges never cut.
- **Below and through**: caustics on the floor under shallow water (a projected animated pattern, tier ≥ 1), light
  shafts under water (tier 2), bubbles when diving, a water-surface distortion when the camera crosses it, the
  underwater fog by depth and the water's colour by biome (clear lagoon, murky swamp, deep navy sea).
- **Behaviour**: rivers flow (a flow direction per column from the world generator or from a slope rule, the
  surface's texture drifting with it), waterfalls splash with mist at the foot, rain makes ripples (rings) on the
  surface, boats and the player bob with the waves.

Tests: node test for the wave functions (bounded height, normals normalized, deterministic); browser test/water.mjs
with screenshots at a lake shore (noon, sunset, night), underwater, a river, a waterfall — Very Low and High.

## F8 · Sichtweite — 1 km and 3 km as smooth as 100 m

Today: horizon LOD tiles (4/8/16/32/64-block cells) out to 5 km with a chunk mask; near chunks to renderDist.
- **No pops**: new near chunks fade in over 300 ms (alpha or a dissolve by noise), LOD tiles crossfade with the
  chunks that replace them (the mask gets a soft edge), tile level changes blend; the horizon's colours match the
  near terrain exactly (the same tint/albedo averages, the same fog and aerial perspective from F1).
- **Smoothness**: a frame-time budget for streaming: at most N ms of chunk upload per frame (measured), meshing in
  workers never blocks, tile builds spread; a priority by view direction; when the frame time rises the streaming
  rate drops first, the resolution second, the view distance never (it stays what the player set).
- **Detail at distance**: trees and houses beyond renderDist as cheap impostors on the LOD tiles (a few quads per
  village, tree clusters as billboards cross-faded with the real chunks), so a 3 km view shows a living landscape
  rather than bare heightfields; lights of villages at night as points.
- **Cost**: the LOD tiles' triangle count by distance (the far rings at 64-block cells merge flat areas), the whole
  horizon at 3 km under 2 ms CPU per frame and under 40 MB on balanced; Very Low keeps 1 km with 2 ms.
- **Occlusion**: cave occlusion exists; add a coarse hierarchical occlusion for the near chunks behind big hills
  (the LOD heightfield as an occluder) so city scenes cost less.

Tests: node test for the mask's soft edge and the streaming budget scheduler (never exceeds N ms, priority order);
browser test/horizon.mjs: a 20 s flight at 3 km view distance with the frame times logged (no frame above 2× the
median from streaming; no visible hole: a screenshot every 2 s checked for sky-coloured pixels below the horizon
line), screenshots of a 3 km vista on Very Low and High — LOOK.

## Order and releases

Integration order (the owner's order of importance): F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8. Each front lands as its
own branch; the coordinator merges in that order into the next release branch, runs the release regression and
publishes a testable version after every two or three fronts ("after every big hurdle").
