# Phase B · Live-Schleife — design (2026-10-03)

Direction approved by R9; this spec is for R9's review before planning. Assumes Phase A has shipped (✏️ cards, ☆ houses, „Verbaut in", transfer file).

**Starting point (audited).** Only models are live: Item-Crafter overrides reach the game through a storage event (game.js:69-82, 101-102), also from the overlay iframe (game.js:285).
- **Blocks** are fixed at load (blocks4.js:113-117) in one immutable texture array (tex_build.js:88, renderer.js:81).
- **Saved columns** store raw state ids (storage.js:70, 84-85), so ids may only be appended.
- **Designs** are unversioned (crafter.js:766-780, custom.js:111-133). Towns change only in new columns (worker_main.js:72-74); built plans are read-only (blueprints.js:265-297, studio/world.js:553).
- **Deep links** #m/, #h/, #craft/… exist (studio.js:899-901, crafter.js:1489-1494), but the game only sends #world/…/bench, and the overlay reboots the Studio on every open (game.js:268-293, studio.js:904-911).
- **Precedent:** the world style updates generated content and keeps the player's (per-column version + reconcile, style.js:71-111, worker_main.js:85-108). Phase B reuses it.

## 1 Goals, non-goals, success criteria

Goals: (1) from anything in the game to its editor and back in one step, live; (2) change a block's look everywhere or as a copy („Variante"); (3) standing houses follow their design and keep the player's work.

Success criteria (existing world, overlay Studio):
- **S1** Look at a sofa, wall or villa, press **B** → „✏️ Bearbeiten" → the Studio opens on exactly that. From the second open: ≤ 0.5 s on a low-end PC.
- **S2** „Weißer Putz" → sand „Für alle" → „▶ Spielen": every such wall is sand, no reload. „Original wiederherstellen" restores it byte-identically.
- **S3** Beautify a villa → „Ins Spiel" → every standing copy (plans, Baupläne, towns) is renewed. My edits on a copy stay, one **Z** undoes it, and a toast says „Villa ‹Name› erneuert · n Blöcke · m deine Änderungen behalten".
- **S4** „⚒ Nur dieses Haus" edits one standing house's real blocks (one undo step).
- **S5** „Als Variante": „Eiche hell" is its own block, and Eiche is unchanged. Use it „In diesem Haus", „In meiner Welt" or „In die Hand".
- **S6** Worlds saved before Phase B load bit-identical.
- **S7** Friends in my world see my looks, variants and designs.

Non-goals:
- No new pixel textures and zero new GPU texture layers (1,802 are in use).
- No change to block behaviour.
- No per-world looks (Welt-Stil rules do that).
- No renewal of hand-built houses, lot homes or non-catalogue buildings.
- The LOD horizon updates only after a reload.
- No live loop for the standalone artifact (Phase A's transfer file gains the new sections).

## 2 Block looks („🎨 Aussehen")

The look editor is a panel on every „🧱 Teile" card (route `look/<name>`).

- **VX blocks** (308; spec `t.o.vx`, voxarch.js:721-723):
  - Real colours per role that the spec has: Grundfarbe, Zweitfarbe, Kante, Sockel, Ecke, Sturz, Laibung, Rahmen, Fensterbank, Abdeckung, Leuchtfarbe, Polster, Platte (col, col2, trim, plinth, corner, lintel, jamb, frame, sill, cap, glow, cushion, top).
  - Walls and floors also get „Material" = their pattern (Putz, Fachwerk, Ziegel, Dielen …).
  - Applied in place on the spec (identity kept for wall/window borders), then VX.clearCache (voxarch.js:957), as custom.js:175-182 does for models.
- **Textured blocks** (cubes, slabs, stairs, fences, panes, model faces, plants):
  - **„Farbe".** Today's tint only multiplies, so it can only darken (shaders.js:500-505).
    - New per-state table `T.rc` (RGB565, 0 = none). The mesher writes it as the vertex tint and sets the free w5 bit 15 (bits ≤ 14 are used, mesher.js:4-6, 314).
    - Both shaders (one shared snippet) draw `luminance(albedo) / avgLuminance(layer) × colour`, alpha-masked as today. The face's average becomes the chosen colour and the detail stays.
    - avgLuminance comes from a 64×64 R8 table built from the texture build's `avgColor`, rebuilt with the textures (Klassisch/Nahtlos).
  - **„Oberfläche"** (cube families only) borrows another full cube's face textures, per face (oben/unten/Seite). They go into `T.tex` and the baked faces of slab halves.
- **Models** keep the Item-Crafter override. **Fluids** are not offered (water colour is Welt-Stil).

„Für alle übernehmen" writes an override. „Original wiederherstellen" deletes it, and the built-in values return from a snapshot taken before the first override. Dragging a colour previews in the Studio only; the game gets the committed value.

**Scope: global** (this browser, all worlds), like designs and Favoriten. You edit a block, not a world, and Studio previews (no world) must match the game. Per-world change already exists safely as Welt-Stil rules, which from B3 can target variants. Variants don't inherit their source's „Für alle" look.

**Multiplayer: everyone sees the host's world.** Before the column diffs, the host sends a „Studio-Paket" (looks, variants, model overrides, current house designs). Guests use it for the session, then get their own back. This also fixes a bug: today guests generate villas with their own designs, so host diffs (mp.js:255-276) land on wrong houses. Host changes during play go out as deltas.

## 3 Variants („Als Variante")

A variant is a new block identity whose look is an edited copy; the original stays.

**Slots.** B3 appends 256 slot types `var_0…var_255` of 64 states (16,384 states) as the last `VR.BL.late` set (blocks4.js:113-114), after the modern items pack.
- 64 states fit every block except copper_door, copper_trapdoor, lightning_rod and the 28-part vm_garage_door7 (134 of 135 models fit). Those show „Zu groß für eine Variante".
- The registry grows from 10,003 states to ≈ 28,500 of 65,535.
- Slots are handed out in order and never reused. „Löschen" only hides a variant, because worlds may contain it.

**`VR.Variants.fill(k, def)`**, identical on every thread:
- The slot takes the source's props (get/with/decode/facing work) and copies its `T` rows and `R.models` entries.
- `t.o` = the source's copy + {display, variantOf, variantSlot, drops itself}, then the variant's own look.
- A model variant gets its own `VM.MODELS['var_k']` and voxel override, so VM.put, footprints and Welt-Stil part checks work.
- Missing definitions and surplus states render as a grey „Fehlende Variante" cube, never as air.
- These caches register refresh hooks: VX tables (new `VX.refreshStates`), VX/mesher caches, VX.boxes, WorldStyle, blueprint NAT/GROUND, icons, items. Lazily compiled source models (modern pack) are compiled first.

**Threads.** The main thread fills slots at boot. Workers and the Studio worker get a `looks` message in broadcast order with `init`/`custom`, ahead of the next mesh jobs; guests get the Studio-Paket. Each world's meta copies every definition its saved columns use (slot-id scan, ≈ 0.1 ms per column), which restores a lost global entry. Names like `var_17` are stable, so designs, batches and Welt-Stil rules keep working (they store names, custom.js:47-48).

**Use** („Als Variante …"):
- „In diesem Haus": one Crafter step replaces every source cell of the open house; „Ins Spiel" makes a new design version, and standing houses follow (§4).
- „In meiner Welt": a Welt-Stil rule source → variant (its reconcile keeps player blocks).
- „In die Hand": the Studio hotbar and, in Creative/Zen, the game's selected slot.

Slots full: „Alle 256 Variantenplätze sind belegt — ändere eine Variante oder den Block ‚Für alle'." Later releases may append more; slots never move.

## 4 Standing houses follow their design

**Versions.** A design's version id is its save time `t`, already stored (crafter.js:772); 0 is the catalogue original. „Ins Spiel" moves the previous entry to `r9si.studio.hist`. Kept: the current version and 2 previous ones, plus versions a world still references (pinned via `r9si.inst.*`, max 6 per house). „↺ Original" + „Ins Spiel" sets version 0, and copies follow back.

**Instances.** The game records each house it builds in a per-world list: World-mode plans (blueprints.js:289), Blaupause right-click (blueprints.js:140), and later Forge plans. Each entry holds ref, version, skin/mirror (for version 0), transform (ox, oz, F, r) and box. Plans built before B2 become instances at the current version, which is safe (see below). Older Blaupause houses were never recorded and stay as they are.

**Renewal rule**, per cell of old ∪ new build:
- old = new → nothing.
- world = old → write new. A cell left out of the new version becomes air inside the lot; outside the lot it is left alone.
- world ≠ old → keep; it is a player change (counted as *m*). Doors only opened or closed count as equal (custom.js:105-110).
- A cell only the new version has → written only onto free cells (air, replaceable, natural ground); otherwise kept (*m*).

It writes only where the world still equals the assumed old version, so a wrong or legacy assumption never destroys player work; at worst a house renews partially.

**Execution.**
- The worker's `blueprint` job takes an explicit design entry, which gives both builds.
- Each house is one `gadgets.applyEdit` undo step (gadgets.js:340-345); its `onUndo` resets the instance version.
- applyEdit passes `bulkSet(…, false)` (gadgets.js:342), which keeps multiplayer from hearing about it. Renewals and Werkbank batches now pass `notify`.
- `tickRenew` (next to tickPlans, gadgets.js:139) renews one house per 0.5 s once its columns are loaded. Closed worlds renew when opened.
- If the old version is unknown, nothing is written. Toast: „Villa ‹Name›: alte Version unbekannt — nichts überschrieben. ⚒ Nur dieses Haus passt sie an."
- The World mode shows „im Spiel gebaut · Version ‹Datum›".

**Town villas.**
- Village plans know every home's lot (gen_village.js:1071-1079); homes also record catalogue index `ci` and version.
- Each generated column records `dvs = {ci: version}` for the villa lots it touches, stored next to `sv` (storage.js:70).
- Generators take their design set as an option (gen_villa.js:90 stops reading the global), so a worker can generate a column with one house's old design.
- Merging applies the rule, limited to that house's lot boxes + 4:
  - saved, unloaded columns merge silently in the worker's relight path, like the style reconcile (worker_main.js:91-95), with one summary toast per design;
  - loaded columns (found via `c.dvs`) get one `redesign` job each; each design's changes form one undo step with the S3 toast;
  - if the old version is unknown, the column is untouched and keeps its `dvs` (never merged against a wrong base), with one toast per session;
  - columns saved before B2 take the current versions as their baseline.

**„⚒ Nur dieses Haus".** The overlay Studio opens the house box (+3) in the Crafter's new „Bestand" mode, where grid and base are the same real blocks, so only your edits count. There are two exits:
- „✓ Nur dieses Haus ins Spiel" makes one Werkbank batch (edits.js), which tickEdits builds as one undo step (blueprints.js:303-330).
- „★ Als Design für alle" turns the lot's cells (lot-local, un-rotated) into a new design version, so every copy follows.

**Forge.** A `forge` instance (ref = DNA, version = recipe version) renews by the same rule. The Forge registers `build(ref, ver)` and `current(ref)` with shared/renew.js (no house code).

## 5 Game → Studio („✏️ Bearbeiten")

**B** opens a menu for the target (keys 1–4, Esc). It works on foot in your own world (not as a guest), is ignored in vehicles and the cockpit (the shuttle overhaul keeps its keys), and is mirrored in the pause menu.
- Entries:
  - „▣ Möbel ‹Name› bearbeiten" → `craft/m/<name>`
  - „🎨 Aussehen von ‹Block›" (not for fluids) → `look/<name>`
  - inside an instance or town home box:
    - „🏠 Design ‹Villa› bearbeiten (alle Häuser)" → `craft/h/<ci>`
    - „⚒ Nur dieses Haus" → `world/<id>/house/<x0,y0,z0,x1,y1,z1,r,F,ci>`

**Keep-alive.**
- Closing hides the iframe instead of blanking it (game.js:293) and posts `{r9:'pause'}`; a paused Studio runs no frames and no worker jobs.
- Reopening saves the world as today (game.js:282), then posts `{r9:'resume', route, changed}` (`changed` = columns saved since the last open). The Studio re-reads designs and looks, reloads only those columns, and navigates via a new route handler.
- The cold path is today's URL with the route as hash.
- The Studio unloads after 10 min hidden (2 min on „Sehr niedrig"/deviceMemory ≤ 2) and at once on WebGL context loss.
- Studio → game: `{r9:'ready'}`, `{r9:'close', play}`, `{r9:'hand', id}`; same origin only.

## 6 Architecture

### 6.1 Components

| File | Change |
|---|---|
| shared/looks.js (new) | `VR.Looks`: apply/restore, snapshots, refresh hooks |
| shared/blocks_var.js, variants.js (new) | slots (last late set), `Variants.fill`, world copies |
| shared/renew.js (new) | pure renewal rule, kinds (house, forge), column merge |
| registry · mesher · voxarch | `T.rc`; bit 15; `VX.refreshStates` |
| shaders · studio.js | shared recolour snippet, luminance table |
| custom · gen_villa · gen_village | `houseFor(index, designs)`; `ci`; `dvs` |
| worker_main | `looks`, `redesign`, relight merge, explicit `blueprint` |
| storage · blueprints · gadgets | `dvs`, `vars`; instances, `tickRenew`, `onUndo`, notify |
| game · ui · mp | B menu, routes, keep-alive, `pack`, PROTO 2 |
| studio/route.js (new) · crafter · world · catalog | routes, „Bestand", „🎨 Aussehen", „Als Variante" |

### 6.2 Data formats

```js
// localStorage 'r9si.looks' (Studio writes)
{ "v": 1, "t": 1791000000000,
  "looks": { "vx_plaster_white": { "vx": { "col": "#e2c995", "trim": "#5a3f2a", "pat": "bricks" } },
             "oak_planks": { "rc": "#e6cfa4" },
             "stone_bricks": { "rc": "#9aa0a8", "tex": "polished_andesite" } },
  "slots": { "0": { "src": "oak_planks", "name": "Eiche hell", "look": { "rc": "#e6cfa4" }, "t": 1791000000000 },
             "1": { "src": "vm_sofa_navy", "name": "Sofa Petrol", "look": {}, "model": true, "hidden": true } },
  "next": 2 }
// model-variant voxels: 'r9si.studio'.models["var_1"], today's override format (custom.js:150-159)

// localStorage 'r9si.studio.hist' (entries as crafter.js:772 without name/index/n)
{ "v": 1, "houses": { "4": [ { "t": 1790000000000, "skin": "bauhaus", "mirror": false, "seed": 7, "beds": 3, "tpl": {}, "top": 12 } ] } }

// localStorage 'r9si.inst.<worldId>' (game writes)
{ "v": 1, "t": 1791000000000,
  "inst": [ { "id": "i1x2", "kind": "house", "ref": 4, "ver": 1790000000000, "skin": "bauhaus", "mirror": false,
              "ox": 120, "oz": -48, "F": 71, "r": 1, "box": [104, 70, -60, 140, 92, -30], "from": "plan", "plan": "p9a" } ],
  "town": { "4": [1790000000000] } }          // versions its saved town columns hold (pins)

// IndexedDB chunk: { b, h, be, sv, "dvs": { "4": 1790000000000 } } · world meta: "vars": { "17": <slot def> }

// worker: {type:'looks', looks, models}
//         {type:'redesign', id, cx, cz, blocks, dvs, jobs:[{ci, oldT, old: designEntry|null}]}
//           → {type:'redesign', id, changes:Int32Array[idx, state…], kept:{ci:m}, dvs}
//         relight takes `jobs`; gen/relight replies carry `dvs`
//         {type:'blueprint', index, design: designEntry|null, skin, mirror}
// iframe: game→Studio {r9:'pause'} · {r9:'resume', route, changed:[[cx,cz],…]}
//         Studio→game {r9:'ready'} · {r9:'close', play} · {r9:'hand', id}
// MP:     topic 'pack' {to?, part, of, b64}; payload JSON {looks, models, houses}; no `to` = delta
```

### 6.3 Data flow

- **Look:** the pane saves `r9si.looks` and the Studio applies it at once. The game takes it on the storage event or on overlay resume/close (debounced 300 ms): `Looks.apply` → broadcast `looks` → remesh only sections holding affected states (plus neighbours) → clear icons → pack delta to guests.
- **Design:** „Ins Spiel" → hist → `reloadCustom` → `Renew.scan` → queue instances and loaded town columns; saved columns merge on load.
- **✏️:** B → menu → route → resume or cold load.

### 6.4 Error handling

- **Storage full:** free space in the existing order (thumbnails → drafts, projects.js:113), then unpinned history. If that fails: „Speichern fehlgeschlagen (Browser-Speicher voll oder gesperrt).", and nothing reaches the game. Designs win over history.
- **Unknown names** (removed block, missing variant source) stay stored and are ignored; slots show „Fehlende Variante". Every entry is applied in its own try/catch (custom.js:189).
- **Conflicts:** decided per cell. Batches and renewals run serially on the main thread, batches first.
- **Studio-Paket timeout (15 s):** guests keep their own looks; hint „Looks des Hosts nicht geladen". Unknown route: „Nicht gefunden: ‹…›".

### 6.5 Performance budgets („Sehr niedrig": 2 cores, render distance 4)

- **Look change:** tables ≤ 2 ms; a Uint8 state-mask scan (≤ 20 ms per 81 columns, 8 columns per frame) instead of `remeshAll`.
- **Shader:** one branch and one texelFetch, on recoloured faces only.
- **Overlay:** resume ≤ 0.5 s; a paused Studio uses 0 % CPU.
- **Renewal:** one house per 0.5 s; main-thread merge ≤ 10 ms per house, sliced beyond that.
- **Town merge:** ≤ 2 extra generations per affected saved column, in workers; ≤ 2 old-design generators per worker.
- **Slots:** ≈ 0.5 MB of tables per thread; no GPU textures.
- **Studio-Paket:** ≤ 512 KB, newest designs first (host told what was left out), paced by the send queue.

### 6.6 Testing

Node tests (`test/*.js`) and Playwright browser tests (`*.mjs` against dist):

| Test | Proves |
|---|---|
| registry_ids.js + .json | append-only ids; slots last (B1, extended in B3) |
| looks_core.js | VX roles/pattern + exact restore; rc mesh output; „Original" byte-identical |
| variants_core.js | stairs/door/model variants decode like the source; Welt-Stil check; fallback; exhaustion; no reuse |
| renew_core.js | the rule in 4 rotations; n/m; doors; unknown version → no write |
| town_redesign.js | real town v1→v2: 20 edits kept, outside lots unchanged, `dvs`; unknown → untouched; legacy baseline |
| hist_core.js | keep-3, pins, pruning under a fake quota |
| look_live.mjs | overlay look change recolours the game, no reload; „Original" restores |
| edit_from_game.mjs | menu per target; second open ≤ 0.5 s, same Studio boot id |
| renew_live.mjs | plan → built → 5 edits → new design → toast, 5 kept, Z restores |
| this_house.mjs | Bestand batch = one undo; „Als Design für alle" renews another copy |
| mp.mjs (extended) | guest sees host looks/variants/designs, own back after leaving; PROTO 1 refused |

Existing suites stay green (studio_live, world_style, style_core, tpl_roundtrip, crafter*).

### 6.7 Delivery

Each phase ships on its own, after the full suite and a build.

- **B1 „Bearbeiten & Aussehen"** (S1, S2, S7 looks): routes, B menu, keep-alive; looks „Für alle" + „Original wiederherstellen"; Studio-Paket + PROTO 2; registry_ids test.
- **B2 „Häuser folgen"** (S3, S4, S6): versions, instances, renewal engine (notify, onUndo), town villas, ⚒ with both exits, Forge hook.
- **B3 „Varianten"** (S5, S7 variants): slots, fill, world copies, „Als Variante", pack extension.

### 6.8 Risks

1. **Registry order vs. the parallel modern pack:** slots go last, merged after it; registry_ids.js fails any reorder.
2. **Two WebGL contexts on weak PCs:** timed unload, a stricter „Sehr niedrig" limit, unload on context loss.
3. **localStorage quota:** history is pruned first; designs are never dropped.
4. **Self-changing generated blocks** (crops, leaves, furnaces) count as player changes. Harmless; *m* just runs high.
5. **Town merge needs deterministic generation:** town_redesign.js tests real towns.
6. **Renderer drift:** both renderers share one GLSL snippet.
7. **Big packs slow MP joins:** capped and paced.
