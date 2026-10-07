# v0.41 · 📥 Import & Atmosphäre — design (2026-10-07)

For R9's review before planning. Builds on v0.39 (Studio v4.0), the Phase B spec (2026-10-03-live-loop-design.md) and the all-ages spec (2026-10-07-all-ages-workflow-design.md).

**Starting point (audited).** Models are palette-indexed volumes at 16 or 32 voxels per block (voxmodel.js:203-232); a voxel is 24-bit RGB + PRESENT/EMIS/GLASS/GLOSS + 3 material bits (voxarch.js:16-60) — no RGB565. Modern Living registers *late* and *lazy* (blocks4.js:114, voxmodel.js:252-285); the registry holds 12,427 of 65,535 states; worlds store raw ids, so ids are only appended (test/id_snapshot.js). schem.js imports files as *block* pieces; no OBJ/GLB. Villagers and creatures are rigid voxel parts with keyframe clips (folkanim.js, folkmodel.js:448-455, entities.js:409-461). Rain/snow/thunder, fog, clouds, sway, smoke, moon phases and stars exist; audio is procedural; view bob and the sprint FOV kick exist (game.js:776-778).

## 1 Goals, non-goals, success, licences

**Goals.** (1) Free models from the internet become „Dinge" in a drop and three clicks, moving figures and animals included. (2) The world feels alive: weather with sound, soundscapes by place and hour, small movements. (3) Nothing hurts „Sehr niedrig".

**Success criteria (player terms).**
- **S1** Drop `deer.glb` (Kenney) on the Studio → a voxel deer in the preview within 10 s (Balanced) → „✓ Fertig" → a card in 🎒 Meins → B, 📍, it stands in my world; Z takes it back; a reload keeps it.
- **S2** A KayKit adventurer → „🧍 Figur": it idles, walks and waves with the game's own clips. A Kenney animal → „🐘 Tier": it roams the biomes I chose.
- **S3** 📜 Credits lists every imported thing with author, licence and link; a 📦 r9-paket carries the credit; a „Nur für dich" Ding cannot be shared.
- **S4** Dusk over a meadow: crickets fade in, dawn fog lies in the valley, a storm brings lightning with delayed thunder, after rain the ground glistens under a rainbow. „Sehr niedrig" gets all but the wet look and critters.
- **S5** Every atmosphere feature has a ⚙ switch; „Aus" is today's behaviour exactly.
- **S6** Old worlds load identically; `id_snapshot.js` stays green.

**Non-goals.** No FBX/DAE/STL/.bbmodel (Blender exports GLB). No skinned deformation, morph targets, cloth or faces — rigid voxel limbs like the villagers. No new GPU texture layers. No imports to multiplayer guests yet (a grey „Fehlendes Ding" cube; Phase B's Studio-Paket carries them later).

**Licence policy.** Step 1 asks „Woher ist es?"; the dialog cannot verify; it records and shows the answer forever.

| Tier | Accepted | 📦 Teilen | Credits |
|---|---|---|---|
| ✅ **Frei** — CC0, Public Domain, „Selbst gemacht" | yes | yes | listed |
| ✅ **Frei mit Namensnennung** — CC-BY 3.0/4.0; author + link required | yes | yes, credit travels | mandatory |
| ⚠️ **Nur für dich** — use in your own game allowed, passing the file on not (Quaternius QAL v1.0, Fab/Sketchfab Standard, free3d, Mixamo) | yes | **no** („‹Name› darf nicht weitergegeben werden") | „nur lokal" |
| ❌ CC-BY-NC / -ND / -SA, „weiß ich nicht", game rips | refused | — | — |

Refusal: „Das kann ich nicht übernehmen: Es braucht eine freie Lizenz (CC0 oder CC BY) — oder eine, die das Benutzen im eigenen Spiel erlaubt. Schau auf der Seite nach ‚CC0' oder ‚CC BY'. Bei Kenney, KayKit und Poly Pizza ist fast alles frei." Sketchfab GLBs carry author/licence/source in `asset.extras`: pre-filled, the player confirms.

**📜 Credits** — game: ⚙ Einstellungen → „📜 Credits"; Studio: 🎒 Meins → „📜 Quellen": picture, name, „von ‹author›", licence, link, then the bundled sound credits (§4); `VR.Credits.list()` feeds both and the r9-paket.

## 2 Import pipeline (I1)

**Entry.** „📥 Datei" is the eleventh tile of ✨ Erschaffen's *Was?*, a button and drop zone in 🎒 Meins, and any `.obj .mtl .glb .gltf .vox .png .zip` dropped on the Studio (or the game's start screen → the overlay). Several files at once or one .zip (`DecompressionStream('deflate-raw')`).

**Dialog „Datei › Größe & Aussehen › Fertig"** (`studio/importer.js`, the wizard shell):
1. **Datei** — names, format, triangles, materials, „📐 2,1 m hoch", animations; licence tier, author and link pre-filled from the file.
2. **Größe & Aussehen** — live preview in the Studio's own viewer (the draft fills the free slot and is meshed like any model: the preview is the game). **Größe** S · M · L · XL = longest edge 1 · 2 · 3 · 4 blocks. **Fein** 16 (default) / 32 — 32 only up to 8 parts, so an import never exceeds 262,144 voxels. **Vorne** ↻. **Steht auf dem Boden** (default) / **An der Wand**. **Innen** Massiv / Hohl. **Farben** 16 · 32 · 64 (default) · 256. A chip per source material (the 11 VM materials), pre-set from the file. Rigged files: **Art** 🧸 Ding (still, in the first frame of its first idle/walk clip, never the T-pose) · 🧍 Figur · 🐘 Tier (§3). Every change re-voxelizes in the worker (≤ 2 s for M; progress bar, „Abbrechen").
3. **Fertig** — name, the Ding card (👁 ✏️ ☆ 📍 📦), „📍 Setzen" / „🎒 Nur merken"; toast „✓ ‹Name› importiert · Platz 7 von 32".

**Formats** (`shared/mesh_obj.js`, `shared/mesh_gltf.js`, schem.js):
- **OBJ + MTL**: v/vt/vn/f, usemtl/mtllib, `Kd`, `map_Kd`; `d`/`Tr` < 0.9 → Glas, `Ke` > 0 → Leuchtet, `Ns` > 200 → Lack. Missing textures: „3 Texturen fehlen — zieh den ganzen Ordner oder ein .zip hinein".
- **GLB / glTF** (embedded or sidecar buffers): node transforms, the standard attributes incl. COLOR_0 and JOINTS/WEIGHTS, quantized accessors; colour = `baseColorFactor` × texture × COLOR_0; metallic > 0.5 → Metall, roughness < 0.35 → Lack, emissive → Leuchtet, BLEND or transmission → Glas, material names → wood/fabric/leather/marble/stone/leaf bits; skins + animations (§3). Draco or Basis → „Komprimiert exportiert — bitte ohne Draco/Basis speichern (Sketchfab: ‚glTF' statt ‚GLB komprimiert')".
- **VOX**: 1 vox voxel = 1 mini-voxel or scaled to the size; scenes by `nTRN` as today; `MATL` metal/glass/emit → Metall/Glas/Leuchtet; the block path stays as „🧩 Als Bauteil (Blöcke)".
- **PNG** → „🖼 Bild an die Wand": a 2×2-block plaque at Fein 32 with a 1-voxel relief from luminance; „Als Blockbild" → Bild → 3D as today.

**Voxelizer** (`shared/voxelize.js`, pure; run by `studio/import_worker.js`, a Blob worker from its own `import-src` script, one per import, killed by „Abbrechen"):
1. Triangles in model space (transforms applied, skins in bind pose), scaled, up +Y, front turn, ground snap.
2. **Surface**: conservative triangle–voxel overlap (separating-axis test over each triangle's voxel box) — a thin leaf or sail is never lost. Up to 4 colour samples per voxel: closest point → barycentric UV → bilinear read from a mip at ≈ 2× voxel density (textures ≤ 1024²) × vertex colour × material; albedo only.
3. **Solid fill**: 6-connected flood from outside the padded grid; unreached cells become interior in the nearest surface colour (Massiv) or stay empty (Hohl).
4. **Colours**: median cut in OKLab to the chosen count, ≤ 255 so the volume stays Uint8; material bits per palette entry; emissive and glass never merge. Output `{ W, H, D, res, pal, rle, parts, col, vox }` in VM part order, plus rig data (§3).

**Budgets.** File ≤ 50 MB, ≤ 1,000,000 triangles, ≤ 8 textures; potato (≤ 2 GB or ≤ 2 cores): 20 MB, 300,000, XL greyed „XL braucht einen stärkeren PC". Worker ≤ 100 MB, ≤ 10 s at XL on 2 cores. Over a cap: „‹n› Dreiecke sind zu viel — bitte eine Low-Poly-Version (höchstens 1 Mio.)".

**Registration — slots, like Phase B's variants.** `shared/imports.js` appends **32 slot types `imp_0…imp_31`** as its own `VR.BL.late` set after every existing set (after B3's `var_*` if that ships first; `id_snapshot.js` pins the order). A slot: `kind: 'model'`, `lazy: true`, props `[FACING4, ['part', 'p0'…'p63']]` = 256 states, `cat: 'import'`; 8,192 states, ≈ 37,000 with B3. Spec and model object exist from boot; **`Imports.fill(k, rec)`** mutates them in place and clears the VX, icon and tab caches; surplus part states paint nothing; each thread decodes the RLE on first paint. The game fills at boot from IndexedDB; every worker gets `{type:'imports'}` ahead of its next mesh job. The Studio writes a record and bumps `r9si.imports.t`; the game takes the storage event, fills, broadcasts, and remeshes only loaded sections whose state scan hits the slot. **Limit: 32 Dinge per browser** („Alle 32 Plätze sind belegt — lösche ein Ding, das keine Welt mehr braucht"); figures and animals are entities, no slot. „🗑 Löschen" frees a slot only when no world's meta lists the import id; otherwise the Ding is hidden and the slot kept, so saved worlds never change meaning; a missing record renders the grey cube. Filled slots show in the creative tab „📥 Importiert", ★ Favoriten, the Bauhand ring, 🎒 Meins and 🧱 Teile (card `m:imp_k`; ✏️ = the Item-Crafter).

## 3 Figures and animals (I2)

**Bones → parts.** Each voxel takes the dominant joint of its triangle (majority of the vertices' highest weights); a joint's voxels form one part grid, pivot = the joint's bind-pose position — the villagers' format. Joints merge into their parent until ≤ 16 parts remain (fingers → hand; the smallest first). Limbs bend at voxel joints like the villagers: that is the look.

**Rig map** (`voxelize.rigMap`): joint names (Mixamo/VRM/KayKit: Hips, Spine, Head, LeftArm …) → `body head arm_l arm_r fore_l fore_r leg_l leg_r shin_l shin_r`; a quadruped (four leaf chains at the bottom) → `body head leg_fl leg_fr leg_bl leg_br tail`; wings → the `wings` gait. A mapped humanoid uses **the game's own clips** (idle, parametric walk/run, sit, wave, talk, dance …) through `FolkAnim.pose`; a quadruped the `quad` gait. Chips in the dialog fix a wrong map.

**Own clips.** Unmapped rigs, or „Eigene Bewegungen", keep the GLB's animations: sampled at 10 Hz (≤ 64 keys per track) into FolkAnim tracks with quaternions (`clip.quat`; `FA.sample` nlerps, `drawModel` applies them), named idle/walk/run by heuristics, else `clip0…`. No map and no clips → a 🧸 Ding (§2): the fallback always works.

**In the game** (`main/importmobs.js`). A **🧍 Figur** is a friendly ambient mob (`VR.MOBS['imp_<id>']`, biped): wanders within 12 blocks of where it was set, looks at you within 6, waves once when you arrive. A **🐘 Tier** gets „Wo lebt es?" (Wiese · Wald · Wüste · Schnee · Strand · Überall → biome regex), „Wie viele" (group 1–4), speed by size, no drops, flees like passive mobs; „Frei in der Welt" spawns through `trySpawn`, „Nur wo ich es setze" does not. 📍 Setzen summons one at the pointer; placed ones persist per world (`r9si.critters.<w>`, ≤ 64). Models build into `VR.VOXMODELS` from the record's part grids, with a half-res LOD.

## 4 Atmosphere package (A1, A2)

| Feature | What, where | potato | ⚙ |
|---|---|---|---|
| **Weather kinds** | `main/weather.js` replaces Env's two-state machine: Klar · Bewölkt · Nebel · Regen · Gewitter · Schnee, weighted per climate in biomes.js `wx` (dry 85/10/5/0/0, temperate 45/25/10/15/5, wet 30/25/10/25/10; cold: snow), 5–20 min each. **Nebel**: dawn (22,000–2,500 ticks) in valleys or near water: fog density ×3, fogEnd ≥ 48. **Gewitter**: rain 1, wind 3, exposure −0.3, lightning every 8–25 s, thunder 0.5–4 s later by distance. **Bewölkt**: cloudCover 0.8, sun ×0.6. **Schnee**: today's particles + a `snow` layer laid by random ticks on sky-lit grass and leaves. | free | Wetter: Normal · Ruhig (Klar/Bewölkt) · Aus |
| **Wet look, rainbow** | `u_wet` fades 0→1 after rain over 2 min: up faces albedo ×(1−0.15·wet), specular ×(1+2·wet). Sky FS: an arc 42° from the anti-solar point, 6 bands, alpha ≤ 0.35·sun while wet > 0.3 and rain < 0.2. | off (lite) | with Wetter |
| **Ambience** | `main/ambience.js` mixes layers from a context sampled every 0.5 s: hour, biome, weather, altitude, cave, **indoors** (sky light at eye < 4 under a roof → outside layers lowpass 800 Hz, −9 dB), water within 12 blocks, village near. Layers: wind, rain, thunder, **birds** (day; 3–6 FM-chirp voices, random glides, panned), **crickets** (night, warm, dry; 4.2 kHz pulse chirps, 35 Hz AM), frogs, leaves, water, town murmur with a bell at 12:00 and 18:00, owl, seagulls, cave, fire. All synthesized (zero bytes). **Aufnahmen**: an optional CC0 pack (≤ 14 mono 22 kHz Opus loops ≤ 20 s, ≈ 0.8 MB; BigSoundBank / Freesound) at `assets/sounds/`, fetched when chosen, cached, ≤ 4 clips decoded (≈ 7 MB); offline → synthesized. | audio thread only | Natur-Klänge: Synthetisch · Aufnahmen (~1 MB) · Aus |
| **Day & night** | Golden hour, moon phases, stars and nebula exist. **Himmel** per world: „Ewige Dämmerung" (today) or „Echter Tag" — sun to 70°, golden hour only ±1.5 h of sunrise/sunset, a blue hour before, nights 40 % darker. **City glow**: a warm dome toward the nearest village at night (one vec4 uniform). | free | Himmel (world) |
| **Critters** | `main/critters.js`: **birds** — ambient mob `bird` (3 parts, wings gait, biome colourings) by day in forest/meadow/town/beach, flying between perches (tree tops, roofs, lamps), perching 5–20 s, startled within 4 blocks, ≤ 12 near. **Butterflies** (2-frame sprite particles over flowers by day, ≤ 24), **fireflies** (night near water, ≤ 40), **falling leaves / petals** (under leaves when wind > 1.3; always in cherry groves, ≤ 30), **rain ripples** (water FS: ring normals per 0.5 m cell while `u_rain` > 0). | birds ≤ 4, particles off | Vögel & Tiere · Kleine Bewegungen |
| **Camera feel** | Bob, roll and the sprint FOV kick exist. New: a landing dip after a fall ≥ 3 blocks (−0.08 blocks, 0.25 s, by height); „Kamera-Gefühl" Aus · Leicht (×0.5) · Normal scales bob, roll and dip; `prefers-reduced-motion` → Aus. | free | Kamera-Gefühl |

⚙ group „🌦 Atmosphäre"; „☀️ Immer Tag" and Zen's freezes stay. Defaults: Wetter Normal, Klänge Synthetisch, critters on, Kamera Normal, Himmel Ewige Dämmerung.

## 5 Architecture

**New.** `shared/mesh_obj.js`, `mesh_gltf.js`, `voxelize.js`, `imports.js`, `credits.js`; `studio/importer.js`, `import_worker.js`; `main/importmobs.js`, `weather.js`, `ambience.js`, `critters.js`. **Changed.** storage.js (DB_VER 2, store `imports`, `versionchange` reload), env.js, shaders.js (`u_wet`, rainbow, ripples, city glow), renderer.js, folkanim.js (quaternion tracks), entities.js (`fromQuat`), game.js, ui.js, mp.js, biomes.js, pack.js, projects.js, workbench.js, build.js (`import-src`, `assets/sounds` beside dist).

**Data formats.**

```js
// IndexedDB 'r9si' store 'imports' (keyPath id)
{ id: 'im_k7f2a9', v: 1, t: 1791000000000, name: 'Hirsch', kind: 'ding' | 'figur' | 'tier', slot: 7 | null,
  src: { file: 'deer.glb', format: 'glb', title: 'Deer', author: 'Kenney', url: 'https://kenney.nl/…', license: 'CC0', tier: 'free' | 'by' | 'local' },
  opts: { size: 'M', res: 16, front: 0, ground: true, hollow: false, colors: 64, pose: 'idle0', mats: { Body: 'fabric' } },
  vol: { W: 2, H: 2, D: 3, pal: [packedVoxel…], rle: '<b64 vrle of palette indices, y·z·x order>' },        // Dinge
  rig: { unit: 16, gait: 'quad', parts: { body: { box: [x0, y0, z0, x1, y1, z1], pivot: [x, y, z], pal, rle }, … }, layout: {}, rig: {}, order: [],
         map: { Hips: 'body', … }, clips: { walk: { len: 1.2, loop: true, quat: true, tracks: { body: [[t, qx, qy, qz, qw, tx, ty, tz], …] } } } },   // Figur / Tier
  tier: { biomes: 'forest|meadow', group: [1, 3], speed: 2.2, w: 0.5, h: 1.4, roam: true },
  thumb: 'data:image/jpeg;base64,…' }                                                                 // ≤ 12 KB
// localStorage 'r9si.imports' — the index both pages read; its storage event wakes the game
{ v: 1, t, slots: { "7": { id: 'im_k7f2a9', name: 'Hirsch', t } }, mobs: ['im_…'], next: 8 }
// 'r9si.critters.<w>' { v: 1, list: [{ id, x, y, z, yaw }] } · world meta: imports: ['im_…']
// import worker: Studio → { type: 'load', id, files: [{ name, buf }], opts } · { type: 'cancel' }
//   worker → { type: 'info' | 'progress' | 'done' | 'error', id, … }   (info: format, tris, materials, bbox, skins, clips, meta)
// to every worker: { type: 'imports', recs: [{ id, slot, vol }] } · MP 'env': + { wx: 'storm', ws: 183400 }
// r9-paket: + imports: [record without thumb; tier 'local' left out]
```

**Error handling.** Unreadable → „📂 ‹Datei›: nicht lesbar"; a dying worker → one retry at Fein 16 / Farben 32, then „Import abgebrochen — die Datei ist zu schwer für diesen PC"; storage full → „Speichern fehlgeschlagen (Browser-Speicher voll oder gesperrt)", the slot stays free, nothing shown as ✓; a record missing at boot → grey cube + one toast.

**Performance budgets** (potato). Fill ≤ 5 ms per record, boot ≤ 100 ms for 32; a 16³ part paints ≤ 1 ms, meshed once; figures ≤ 16 draw calls, ≤ 24 critters in view; weather/ambience context ≤ 0.2 ms per frame; shader additions a few ALU ops per pixel, no new texture reads; ≤ 12 Web Audio nodes.

**Testing.** Node: `import_core.js` — an OBJ cube + MTL → one part, exact colours and GLOSS; a thin quad → a one-voxel sheet; a GLB built in the test (textured triangle, 2-joint skin, one clip) → parts split by joint, pivots at joints, quaternion keys; a VOX with `MATL` → EMIS/GLASS bits; caps refused with the right message. `imports_slots.js` — 32 slots last; fill → decode → `VM.footprint` in 4 facings; limit at 33; free/reuse rule; missing record → grey cube. `id_snapshot.js` extended. `rigmap.js` — Mixamo, VRM and KayKit names, a quadruped by geometry. `weather_core.js`, `ambience_core.js` — seeded, deterministic. Playwright against `dist/`: `import.mjs` — fixture GLB → three steps → card → 📍 → the slot's states in the world → reload keeps it → credits lists it → 📦 carries it, not for tier `local`. `figur.mjs` — the KayKit fixture walks (joint angles change over 2 s), its static Ding is not in T-pose. `weather.mjs` — `/weather fog` raises fog density, `storm` flashes, „Aus" spawns no particles. `ambience.mjs` — night meadow: crickets gain > 0; indoors: lowpass. `critters.mjs` — birds by day, none at night or on potato.

**Delivery** — each phase ships alone after the suite and a build:
- **I1 „Dinge aus Dateien"** (S1, S3, S6): OBJ/MTL, static GLB, VOX fine path, PNG plaque, slots + fill + threads, dialog, credits, pack section.
- **I2 „Figuren & Tiere"** (S2): skins, rig map, own clips, importmobs, per-world critters.
- **A1 „Wetter & Klang"** (S4 part, S5): weather.js, wet look, rainbow, ambience + Aufnahmen, Himmel, ⚙ group.
- **A2 „Kleine Bewegungen"** (S4 rest): critters, ripples, city glow, camera feel.

**Risks.** (1) Licences are attested, not verified → unknowns refused, the tier shown everywhere, no sharing for „Nur für dich". (2) Memory and page size → hard caps, Fein 32 only small, lazy decode, synthesized sound by default. (3) Rig maps fail on odd skeletons → the static fallback always works. (4) Registry order with B3 → both append-only, pinned by `id_snapshot.js`.

## Decisions for R9

1. **„Nur für dich" tier.** Default: offered — Quaternius moved from CC0 to its own licence on 28 Aug 2026; Fab Standard, free3d and Mixamo are alike: usable in your worlds, never shareable. Alternative: strict CC0/CC-BY, those files refused.
2. **Himmel.** Default: a per-world choice, new worlds keep „Ewige Dämmerung" (the trailer). Alternative: „Echter Tag" as the default for new worlds, the trailer look one switch away.
3. **Slots.** Default: 32 Dinge of up to 4×4×4 blocks (8,192 states). Alternative: 64 Dinge of up to 2×4×2 blocks (16 parts, 4,096 states) — more things, no XL.

Everything else is the plan unless R9 redirects it.
