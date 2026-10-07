# All-ages workflow · R9-SI & R9 Studio — design (2026-10-07)

For R9's review before planning. Based on v0.39 (Studio v4.0) and the Phase B spec (2026-10-03-live-loop-design.md), which this fits and does not replace.

**Starting point (audited).** The game is English with German bits (ui.js:54-127), the Studio German (build.js:55); `src/main/i18n.js` is bundled nowhere (build.js:21, 45). Six hand-over words: „Ins Spiel" (Crafter), „⬆ In die Welt übernehmen" (world.js:579), „⬆ In die Welt" (Stil), „✓ In die Werkbank" (imagine.js:385), „✓ Bauen" (Ort), „✋ Benutzen" (catalog.js:287); ✨ marks four things; a house into the world takes six steps. R, F, Z have no on-screen twins; B is announced (ui.js:507) but bound nowhere. Landing, plans (blueprints.js:231-297), edits, projects and the pack are reused unchanged.

## 1 Problem, personas, goals

**Problem.** A child or grandparent cannot get a thing they like into their world without reading mixed German and English, learning keys and six hand-over words; the Studio's best parts go unused by the people they were built for.

| Persona | Top 3 tasks | Success, in their words |
|---|---|---|
| **Lena, 9** (reads slowly; mouse or tablet) | a Feuerwehrauto or a castle in her world · build a house and walk in · find her things tomorrow | „▶, dann B, aufs Bild tippen, auf den Boden klicken — es steht da." Nothing to read, nothing lost after a reload. |
| **Jonas, 15** (builder, keyboard) | design a villa in detail, every copy follows · shape terrain, import .schem · play with friends | All v0.39 tools one tap away (Profi), one hand-over word, designs reach guests (B1). |
| **Helga, 71** (big text, no hurry) | stroll the town, sit on a bench · the house from her photo, set at her spot · give the grandchildren her things | Large buttons, no timers, no aiming („An meinem Platz"), one file to pass on. |

**Goals** (each a Playwright assertion in §8). **G1** first start → standing in a world in ≤ 2 taps, 0 forms. **G2** a ★ thing into the world: B + 2 clicks, ≤ 10 s; Z takes it back. **G3** an idea → standing in front of it: 3 steps, no account. **G4** every thing is one card with the same 5 actions; ← always restores where you were. **G5** one German word per action; English complete as the second language. **G6** one hint at a time, never on a timer; the first five minutes cover move · fly · place · undo · ✨. **G7** Profi users lose nothing.

**Non-goals.** No new generators or content. No languages beyond de/en in W1–W3. No cross-tab undo of built plans (Z in the game, as today). No cloud, account or voice input. No mobile re-layout of the Profi editors. No multiplayer sharing beyond Phase B's Studio-Paket.

## 2 One front door

The game's title screen and the Studio's header become **one start screen** (`src/ui/start.js`, rendered by both pages). Four picture tiles, ≥ 160 px, one line each:

| Tile | Opens | No world yet |
|---|---|---|
| **▶ Weiterspielen** | the last world, where you were (`playWorldId`, entry `title`). Small below: „Andere Welt · ＋ Neue Welt" (world cards: ▶ · 🏗 · ✎ · 🗑). | **▶ Losspielen** creates „Meine Welt" (Zen Builder, Realm) and enters it; the create form is Profi. |
| **🏗 Bauen** | the Studio on the last world in the **Karte view** = today's World mode: cards left, map centre, the chosen card right; 📍 Setzen = ghost, a click sets and commits at once (§3). Over the open game: the overlay (`openStudio`). | the house catalogue cards; „Erst eine Welt: ▶ Losspielen" |
| **✨ Erschaffen** | the 3-step wizard (§5), over whatever is open. | same |
| **🎒 Meins** | your things as cards (§3), the last one touched first and large with its primary action (today's 🕘 data plus ★, designs, Bauteile, places), chips, search. | „Noch nichts hier — ✨ Erschaffen macht dein erstes Ding." |

Worlds are containers, not things: a world card has ▶, 🏗, ✎, 🗑 only. **Weitermachen** lives on as the order of 🎒 Meins and as „▶ Weiter" on a card with a draft (resumes exactly there). The **standalone Studio** shows the same screen: ▶ reads „🎮 Zum Spiel", 🏗 Bauen opens the catalogue cards, 📍 Setzen offers only „🎒 Merken", 🎒 Meins gets „📦 Alles mitnehmen"; the 🔌 banner goes.

**Einfach / Profi** — one switch on the start screen, the Studio header and the pause menu; `r9si.ui.pro` (migrates `r9si.studio.pro`), shared by storage event; default Einfach, remembered. **Profi adds:** the mode bar (Architektur · Möbel · Fassade · Teile · Crafter · Welt), the full Werkbank strip, Welt-Stil, Dateien, Bild → 3D sliders, the full Baukasten panel, the create-world form, chat commands, F3, ⚙ dev tabs, Codex, Photo mode, .schem/.vox export. **Einfach keeps:** tiles, cards, Bauhand, wizard, ▶, settings (preset, language, text size, sound), multiplayer join and invite, „☀️ Immer Tag".

**Pause menu (Einfach):** ▶ Weiterspielen · 🏗 Bauen · 🎒 Meins · 🏠 Zu meinem Platz · 📍 Mein Platz ist hier · ⚙ Einstellungen · ⏏ Speichern & zum Start.

## 3 One „Ding" model

Every block, variant (B3), furniture piece, house (catalogue or Baukasten), Genie thing, Bauteil, place and future Forge object is a **Ding** with an id and a card (`src/shared/ding.js`):

```
b:<block>  m:<model>  h:<catalogue i>  k:<kit id>  g:<genie id>  p:<Bauteil id>  s:<site id>  f:<forge DNA>
VR.Ding.card(id) → { id, kind, name, pic(canvas), state, actions, route } · set(id, where) · list(filter) · share(id)
```

**The card** (picture ≥ 56 px, name, one state line: „✎ Entwurf" · „✓ im Spiel" · „3× in Meine Welt") carries up to five actions in this fixed order; a missing one is absent, never greyed:

| Action | Does | Not for |
|---|---|---|
| **👁 Ansehen** | turns it in 3D (Studio viewer, route `ding/<id>`; in the game the Bauhand card, §4) | — |
| **✏️ Bearbeiten** | the right editor: `b:` → look/ (B1) · `m:` → craft/m/ · `h:` → craft/h/ · `k:` `g:` `s:` → wizard step Wie? · `p:` → Werkbank with it in hand | `p:` in Einfach |
| **☆ Favorit** | `VR.Favs.toggle(id)`; favs.js and pack.js accept `k: g: p: s:` | — |
| **📍 Setzen** | into the world: in the game the Bauhand holds it; in the Karte view the ghost (`WM.tool`), every click commits (no ⬆ in Einfach; Profi's Plan tab keeps „📍 Alle setzen (n)"); from the start screen → Wohin? (§5) | standalone: „🎒 Merken" only |
| **📦 Teilen** | one r9-paket with this Ding (`VR.Pack.make` filtered); a dropped file imports | — |

Cards appear in 🎒 Meins, the catalogue (Profi: Teile · Häuser · Möbel; Einfach: the wizard's 🧱 Katalog tile), the Bauhand ring and target card, the wizard's variants and „Verbaut in" rows. **Back rule:** every card or editor opens as a layer on one stack (`src/studio/nav.js`, Phase B's route.js merged in): `push(route, restore)`; ← and Esc pop one layer and run `restore` (selection, scroll, lit part, camera); depth ≤ 3; the breadcrumb shows the stack („🎒 Meins › Sofa Petrol › ✏️"); a card never replaces the page under it.

## 4 In-game Bauhand

**One key, B**, or the 🖐 button bottom-right (always on in Einfach). It hosts Phase B's target menu: the card of what you look at on top, its actions = that spec's entries (✏️ Bearbeiten, 🎨 Aussehen, 🏠 Design für alle Häuser, ⚒ Nur dieses Haus); below it the **ring**: 8 slots of ★ favourites (newest first), „✨ Neu…" at the top, „▸ alle" when there are more (a grid by kind). Empty favourites show a **starter set** (Bank, Laterne, Apfelbaum, Blumenbeet, Zaun, Bungalow) marked ☆, so the ring is never empty. Pictures only; the name shows under the hovered slot.

**States.** `closed` → `open` (mouse free, the world keeps running) → `holding` (ring hidden; a strip above the hotbar shows pictograms: „Klick setzt · Rad dreht · Z zurück · Esc weg") → `placed` (toast; the Ding stays in hand) → `closed` on Esc/✕/B. Blocks stay the game's own: a `b:` card goes into the selected hotbar slot and closes the ring; the strip then shows the game's rule (Rechtsklick setzt · Linksklick nimmt weg).

**Ghost.** Furniture and pieces snap to the face you point at (floor or wall); houses to the ground with the lot's earthworks (`Blueprints.locate`, `buildAt`). W1 draws the lot outline + footprint box + the card at the pointer; W2 adds a translucent mesh ghost: the worker's `place_mesh` job, drawn with the Studio shader's instance pair (`u_rc`, `u_t`, studio.js:177-182) ported into renderer.js. Quarter turns. ok = cyan solid outline + ✓; not ok = red dashed + ✕ and one reason — shape and glyph, not colour alone.

**Placing** is the game's own build: a house via `buildAt` (earthworks, one undo step), a model via the `planPiece` ops, a Bauteil via its cells (plan kind `piece`, §8); recorded as a `built` plan in `r9si.plans.<w>` and, from B2, as an instance in `r9si.inst.<w>`, so standing houses follow their design. Creative and Zen, own world only, like blueprints today.

| | Mouse | Keyboard | Touch | Gamepad (W3) |
|---|---|---|---|---|
| open · put away | 🖐 · ✕ | B · Esc | 🖐 · ✕ | Y · B |
| pick | hover + click | 1–8, arrows, Enter | tap | d-pad, A |
| rotate | wheel (hotbar scroll off while holding) | R | ↻ | bumpers |
| place | left **or** right click (LMB never breaks while holding) | Enter | ✓ at the crosshair | RT |
| undo | ⟲ in the strip | Z | ⟲ | X |

**Feedback.** `click` on pick, `audio.place(state)` on set, `pop` on undo. Toasts (6 s in Einfach): „✓ Bank gesetzt · Z nimmt es zurück", „⟲ Bank weg", „✓ Villa Toscana gebaut · 2 340 Blöcke".

**Failure cases** (strip text, red, never a modal): no ground under the pointer → „Zeig auf den Boden"; you stand on the lot → „Tritt einen Schritt zurück"; blocks in the way or inside a wall → „Kein Platz hier — such eine freie Stelle" (red ghost, a click does nothing); ground loading → „Boden lädt noch — gleich"; Survival → the card, no ring: „Bauen geht im Kreativ- oder Zen-Modus" + „Zen einschalten"; guest world → no 📍: „In fremden Welten baust du mit Blöcken"; vehicle → B ignored; storage full → built anyway, toast „⚠ Gebaut, aber nicht gemerkt — Browser-Speicher voll", ⚠ on the card.

## 5 The ✨ wizard

One dialog (the `#imagine` shell re-skinned; `src/studio/wizard.js` owns the steps), a progress row „Was? › Wie? › Wohin?", ← on every step, nothing touches the world before step 3.

**Was?** — ten picture tiles: 🏠 Haus · 🚗 Fahrzeug · 🏰 Gebäude · 🌳 Natur · 🐘 Tier · 🧍 Figur · 🧸 Ding · 🏘 Ort · 📷 Foto · 🧱 Katalog — the Genie library's six `cat`s (genie_brain.js:303-1954), HouseKit, GenieSite, Bild → 3D and the catalogue. A tile opens up to 12 picture tiles of that kind (thumbs from `GN().raster`). Above, one optional line „oder sag es: …" — a typed wish goes to `G.ask`, which picks the kind.

**Wie?** — **six variant pictures**, one lit, 🎲 „andere sechs": Genie things = the base plus five deterministic variants (seeds 1–5 over the thing's slot colours and `feats`); Haus = six `HK.random` specs of the chosen style; Ort = three „🎲 Dorf würfeln" maps; Foto = the picture slot (📂 · 📷 · ✏️ Skizze) with Wand · Boden · Relief · 3D; Katalog = the Variants strip. Below: „✨ Sag, was anders sein soll" (= ✏️ Ändern / `hkWish`) and ⟲; Profi adds „Mehr einstellen ▸" = the full Baukasten panel. Default: the first variant. **Weiter** saves the thing into 🎒 Meins first — a Baukasten house as `k:` (stays tunable), a Genie thing as `g:` plus its blocks as `p:` (a Bauteil in `r9si.library`), a place as `s:` — named „Feuerwehrauto 2".

**Wohin?** — three big buttons: **🧍 Vor mir** (default with a world open: the Bauhand holds it; from the start screen `r9si.hand` makes ▶ open the world with it in hand), **📍 An meinem Platz** (no aiming: the plan goes 6 blocks in front of the spawn point facing it, settled by `WM.viewpoint`'s rules; ▶ lands you before it — Helga's path), **🗺 Auf der Karte** (the Karte view with the ghost). Ort offers only 🗺; standalone only „🎒 Nur merken". A toast names the next step.

## 6 Vocabulary

| Today (where) | New |
|---|---|
| Ins Spiel · Update ins Spiel (Crafter), ⬆ In die Welt (Stil), ⬆ In die Welt übernehmen (Plan), ✓ In die Werkbank, ✓ Bauen (Ort), ✋ Benutzen | **📍 Setzen** = into a world. Editors leave with **✓ Fertig** (saved and live; Profi sub-label „ins Spiel") or **← Zurück** (draft kept, card says „✎ Entwurf") |
| ▶ Play · Back to Game (pause); ▶ Spielen · Weiterspielen (Studio) | **▶ Weiterspielen** in the game; **▶ Spielen** only when the Studio leaves for a world |
| 🧰 R9 Studio · this world (pause) | **🏗 Bauen** |
| 🕘 Weitermachen | **🎒 Meins**; **▶ Weiter** on a card |
| 📍 Set Spawn Here · 🏠 Go Home · Spawnpunkt | **📍 Mein Platz ist hier · 🏠 Zu meinem Platz · mein Platz** |
| ✨ Erschaffen · ✨ Genie · ✨ Modern · „✨ beim Neuen" | ✨ only for **Erschaffen**; 🛋 Modern; „· beim Neuen" |
| ☆ Favorit · ★ Favorites · F | **☆ Favorit** everywhere (game tab „★ Favoriten") |
| Crafter · Werkbank · Baukasten · Genie · Ort planen | unseen in Einfach (✏️ / ✨ open them); Profi keeps the names as tool labels |
| Create New World · Quick Start · Select World · Delete · Settings | **＋ Neue Welt · ▶ Losspielen · Andere Welt · 🗑 Löschen** (asks twice) **· ⚙ Einstellungen** |

**Making the game German, English second.** (1) Bundle `i18n.js` into `MAIN` and `studioLibs` ahead of `ui.js` / `studio.js` (build.js:21, 45). (2) `src/ui/lang_de.js`, `lang_en.js`: every game string (≈ 350 keys, chat replies included) via `VR.I18N.add`; the Studio already calls `L(key, de)` everywhere — its en table (≈ 900 keys) lands in W3. (3) Static markup in ui.js gets `data-t="key"` and one `retext()` pass, re-run by `I.on`; dynamic strings use `I.t`. (4) The existing picker sits on the start screen and under ⚙ Spiel; the first visit follows the browser (`detect()`). (5) Other languages read en until their table exists.

## 7 On-boarding and accessibility

**🧭 Hints** (`src/shared/hints.js`, `r9si.hints` {seen, done}): one line, bottom centre, 20 px, with a pictogram row (key caps, a mouse with the lit button, a finger) so a non-reader follows the picture. **One at a time, never on a timer** — a hint leaves when its action was done or ✕ is pressed; an undone action's hint returns next session, at most three times. In order: 1 first visit: the ▶ tile pulses · 2 after 5 s standing: „🖱 bewegen = umschauen · W A S D = gehen" (touch: „👆 ziehen") · 3 after the first steps: „Leertaste 2× = fliegen" · 4 20 s later: „B = 🖐 Bauhand — setz etwas in deine Welt" (🖐 pulses) · 5 ring open: „Tipp auf ein Bild, dann auf den Boden" · 6 first placement: „Z nimmt es zurück · ✨ macht Neues" · 7 a ✨ thing stands: „Drück B darauf — ✏️ ändert es" · 8 Profi on: „⚙ zeigt die Entwickler-Reiter".

**Accessibility.** Tiles ≥ 160 px, every other target ≥ 44 px, Einfach text 18 px (`r9si.ui.scale` 1.15; „Große Schrift" 1.3); contrast ≥ 4.5:1; ok/not-ok and the landing markers differ by shape and glyph; **no time pressure** (toasts 6 s, kept in the 📜 log; the arrival flight skippable, off under `prefers-reduced-motion`); **reading-free path**: pictures on tiles, ring and variants, pictograms in strips; **keyboard-only**: every screen tabbable with a visible focus ring, ring 1–8 / arrows / Enter, Esc pops a layer; **mouse-only and touch**: every key has an on-screen twin (B 🖐 · R ↻ · Z ⟲ · F ◐ · Esc ✕ · Enter ✓). P1: „Hinweise vorlesen" via `speechSynthesis`.

## 8 Architecture and delivery

**Reused as is:** Favs, Projects (data), Landing, Pack, Edits, Blueprints (plans, earthworks, `tickPlans` / `tickEdits`), gadgets `applyEdit` / `undo`, HouseKit, Genie/GenieSite, StudioWorld's ghost placement, every Studio mode (Catalog, Variants, Crafter, Workbench, WorldStyle), the overlay iframe with Phase B's routes and keep-alive, I18N. **Replaced:** ui.js title / worlds / create screens → `src/ui/start.js`; the Studio header (build.js:55) → tiles + breadcrumb (+ mode bar in Profi); `#imagine`'s mode tabs → the wizard; the 🕘 hub rendering → 🎒 Meins cards; Phase B's B-menu → the Bauhand card. **New:** `src/shared/ding.js`, `hints.js`, `src/main/bauhand.js`, `src/ui/start.js`, `lang_de.js`, `lang_en.js`, `src/studio/wizard.js`, `meins.js`, `nav.js`; CSS tokens: tile, card, ring, strip.

```js
// 'r9si.ui' { v:1, pro:false, lang:'de', scale:1.15 } · 'r9si.hints' { v:1, seen:{ move:t }, done:{ place:t } }
// 'r9si.hand'           { v:1, ding:'p:x7', world:'w…', t }        // read once on entry
// 'r9si.favs'           today's names + 'k:…' 'g:…' 'p:…' 's:…'
// 'r9si.library' item   { id, name, t, sx, sy, sz, boxes:[Edits.pack boxes], origin:{ kind:'kit'|'genie'|'photo'|'bench', spec }, thumb }
// 'r9si.plans.<w>'      { id, kind:'piece', piece:'p:x7', ox, oz, F, r, dy, status, t, from:'hand'|'wizard'|'map' }
```

**Coexistence with Phase B.** bauhand.js owns B (one dispatcher in game.js) and shows Phase B's menu entries as card actions on its routes and keep-alive; W1 ships before B1 on cold routes and turns warm with it. House placement writes B2's instances; B3 variants are `b:var_k` cards for free; 📦 Teilen uses the pack sections B1 adds; guest 📍 Setzen (W3) needs B1's `notify`.

**Risks.** (1) Two owners of B → one dispatcher, tested. (2) The mesh ghost in the game's renderer → the box ghost stays as fallback. (3) Pieces in localStorage → RLE boxes, 64³ per Ding in Einfach, a warning beyond. (4) Einfach hides a tool someone relies on → Profi one tap away, remembered. (5) The Studio's slow boot behind 🏗 Bauen → the Karte view shows before any catalogue house is built; textures ≤ 2 s.

**Delivery** — each phase ships alone after the suite and a build; Playwright against `dist/` like `test/deadends.mjs`; every test also asserts no `pageerror`.

- **W1 „Eine Tür, eine Karte"** — start screen, Einfach / Profi, 🎒 Meins, cards + nav stack, Karte auto-commit, German game UI, hints 1–3. `test/start.mjs`: exactly 4 `.tile` on both pages; no world → ▶ reaches `state === 'play'` in one click, `meta.mode === 'zen'`; `pro` false → `nav.modes` hidden, true → 6 mode buttons; pause menu's first button „▶ Weiterspielen"; `documentElement.lang === 'de'`; picker → en → the tile reads „Play on"; `hints.seen.move` set after WASD, never two hints at once. `test/ding.mjs`: every `.ding` lists its actions in the order 👁 ✏️ ☆ 📍 📦, none disabled; ☆ on a `k:` card reaches `r9si.favs` and the game's ★ tab; 📍 Setzen on a house card writes a `pending` plan with no further button; ✏️ then ← restores `S.scene`, scroll and the lit part; 📦 Teilen yields a one-entry pack.
- **W2 „Bauhand & ✨"** — bauhand.js, `piece` plans in blueprints.js, the wizard, hints 4–7, the starter set. `test/bauhand.mjs`: B → `#bauhand.on` with ≥ 6 slots on empty favs; key 1 → `g.bauhand.holding`, strip contains „Klick setzt"; click → one `built` plan, > 0 blocks changed in the ghost box; Z → 0 changed, toast contains „zurück"; wheel → `holding.rot` + 1, hotbar unchanged; Survival → card, no ring, text „Kreativ"; sofa in view → its card, ✏️ → hash `craft/m/vm_sofa…`; standing on the lot → red ghost, click changes nothing. `test/wizard.mjs`: 10 tiles; „Fahrzeug" → ≥ 6 pictures; „Feuerwehrauto" → 6 canvases with distinct pixel hashes; „rotes Dach" changes the lit house variant; Weiter → one `r9si.library` item with `origin.kind === 'genie'` and a `g:` card; „An meinem Platz" → a `piece` plan within 8 blocks of the spawn, `built` within 10 s of opening the world, `g.landedBy === 'new'`; plans untouched before step 3.
- **W3 „Alle Hände"** — mesh ghost, touch and gamepad (Gamepad API in input.js; the §4 mapping, sticks to move and look), the Studio's en table, speech hints, guest Setzen with B1 `notify`, 📦 drop-in on the start screen. `test/hands.mjs`: `page.touchscreen` — 🖐 opens, ✓ places; a `getGamepads` stub — Y opens, A places; `I18N.set('en')` → tiles „Mine" / „Create"; `prefers-reduced-motion` → `g.lastReveal` null after a landing; `ghost.mesh` truthy within 2 s on Low.

## Decisions for R9

1. **Click to place.** Default: both mouse buttons place a held Ding (LMB cannot break while holding). Alternative: right click only, like blocks and blueprints today.
2. **🏗 Bauen's face.** Default: the Karte view (cards + ghost from above). Alternative: 🏗 opens the world with the ring already open, and the Karte view stays Profi.
3. **„Mein Platz" for the spawn point.** Default: Einfach and Profi alike. Alternative: Profi keeps „Spawnpunkt".

Everything else above is the plan unless R9 redirects it.
