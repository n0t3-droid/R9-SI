# W1 „Eine Tür, eine Karte" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One start screen with four picture tiles on the game and the Studio, an Einfach / Profi switch, one „Ding" card model with five actions and a ← that restores, a Karte view that commits every placement, German UI on the replaced screens, and the first three on-boarding hints.

**Architecture:** New code lives in new files (`src/shared/uiprefs.js`, `hints.js`, `ding.js`; `src/main/start.js`; `src/studio/nav.js`, `src/studio/start.js`; `src/ui/start.css`) that hook the existing pages at runtime (prototype wrappers on `VR.UI` / `VR.Game`, `HOOK` wrappers in the Studio), so edits inside `ui.js`, `game.js`, `studio.js`, `world.js`, `spawn.js`, `projects.js`, `bridge.js`, `catalog.js`, `pack.js` stay one-liners. `build.js` bundles `i18n.js` plus the three shared UI modules into both pages ahead of `ui.js` / `studio.js`, and appends `start.css` to both stylesheets. Every new text goes through `VR.I18N.tx(key, vars, de, en)`.

**Tech Stack:** Vanilla ES2020 in IIFEs (no modules, no deps), single-file build (`node build.js`), Playwright browser tests (`bash test/wt_run.sh <file> [s]`), node unit tests for the shared modules.

**Spec:** `docs/superpowers/specs/2026-10-07-all-ages-workflow-design.md` (§2 start screen, §3 Ding, §6 vocabulary, §7 hints, §8 W1 delivery and tests). Owner decisions: both mouse buttons place; 🏗 Bauen opens the Karte view; the spawn point is „mein Platz" everywhere.

## Global Constraints

- No Claude/AI dependency for players; low-end PCs first (no per-frame DOM work; lazy pictures).
- Nothing existing is deleted — Profi shows everything that exists today; saved worlds stay valid; `README.md` / `ROADMAP.md` untouched.
- Every new text: `VR.I18N.tx(key, vars, de, en)`, German + English; one word per action (§6): **▶ Weiterspielen · ▶ Losspielen · 🏗 Bauen · ✨ Erschaffen · 🎒 Meins · 👁 Ansehen · ✏️ Bearbeiten · ☆ Favorit · 📍 Setzen · 📦 Teilen · ＋ Neue Welt · Andere Welt · 🗑 Löschen (asks twice) · ⚙ Einstellungen · 📍 Mein Platz ist hier · 🏠 Zu meinem Platz · mein Platz**.
- Do not translate existing strings outside the title / worlds / create / start screens and the pause-menu button list (another agent owns the in-game texts).
- Storage keys exactly: `r9si.ui` `{v:1, pro:false, lang, scale}` (migrates `r9si.studio.pro`, keeps mirroring it) · `r9si.hints` `{v:1, seen:{id:t}, done:{id:t}, n:{id:count}}` · `r9si.hand` `{v:1, ding, world, t}`.
- Ding ids: `b:<block> m:<model> h:<catalogue i> k:<kit id> g:<genie id> p:<Bauteil id> s:<site id>`; card actions in the fixed order 👁 ✏️ ☆ 📍 📦, a missing one absent, never disabled.
- Tiles ≥ 160 px wide, every other target ≥ 44 px, Einfach text 18 px (`--ui-scale` 1.15), one accent colour, works at 1280×720 and at phone width.
- Tests: Playwright against `dist/`; every browser test asserts no `pageerror`; one browser test at a time (`wt_run.sh` takes the lock).
- Commit messages end with the two attribution lines given in the task.

## Review Focus

1. Storage full / blocked while flipping Einfach → Profi: the switch must still work for this page and say nothing false — pinned in Task 1 (`set` returns false, state applied).
2. A `#ding/<id>` link for a thing that no longer exists (deleted design, foreign id): the Studio opens normally with a tip, no error — pinned in Task 7.
3. `r9si.hand` arriving in a Survival world or a guest world: nothing is handed out (no free creative item) — pinned in Task 6 (`VR.Start.handAllowed(meta)` unit case).
4. 🗑 on a world card: the first click only arms, a second within 4 s deletes, a click elsewhere disarms — pinned in Task 4.
5. The Karte view's click on empty sky (no ground under the pointer) or outside the loaded region places nothing and keeps the tool — pinned in Task 8.

---

## File map

| File | Responsibility |
|---|---|
| `build.js` (modify) | bundle `i18n` + `uiprefs/hints/ding` ahead of `ui.js` and `studio.js`; `start` after `ui`; `src/studio/nav.js`, `src/studio/start.js` after `bridge.js`; append `src/ui/start.css` to both stylesheets; header markup: `nav.modes` keeps its 6 `[data-mode]` buttons + 🕘 + ✨, a `#tiles` slot and `#navCrumb` + `#proSwitch` slots are added. |
| `src/shared/uiprefs.js` (new) | `VR.UIPrefs` — `r9si.ui`, migration, storage sync, `--ui-scale`, `html.pro/.einfach`. |
| `src/shared/hints.js` (new) | `VR.Hints` — `r9si.hints`, one hint at a time, ✕, done. |
| `src/shared/ding.js` (new) | `VR.Ding` — ids, cards, five actions, render, favourites mapping, share pack, download, `handlers` the pages fill. |
| `src/ui/start.css` (new) | tokens + tiles, cards, hints, start/pause/meins screens, Studio header rows, breadcrumb, picker. |
| `src/main/start.js` (new) | game: start screen, worlds cards, create form (de), Einfach/Profi strip, picker, 🎒 Meins screen, pause menu list, hints 1–3, `r9si.hand`, `openStudio('karte')`. |
| `src/studio/nav.js` (new) | `VR.Nav` — the layer stack, ← / Esc, breadcrumb. |
| `src/studio/start.js` (new) | Studio: tiles, breadcrumb, Profi switch, routes `#bauen #erschaffen #ding/<id>`, Karte tab (cards + auto-commit), 🎒 Meins decoration, standalone labels. |
| `src/main/ui.js` (modify, 1 line) | `act('sethome')` hint text → „mein Platz". |
| `src/main/game.js` (modify, 1 line) | `openStudio(tab)` → `#world/<id>/<tab||'bench'>`. |
| `src/studio/studio.js` (modify, ~6 lines) | the ⚙ Profi block uses `VR.UIPrefs`. |
| `src/studio/world.js` (modify, 2 lines) | `WM.karteParts` hook in `parts()`; ⬆ label → „📍 Alle setzen". |
| `src/studio/spawn.js` (modify, ~6 lines) | `WM.landingBox = section`; label writes into `.lbl`; „mein Platz" words. |
| `src/studio/projects.js` (modify, 2 lines) | `PJ.decorate(body)` hook after render; title key `pj.title` fallback „Meins". |
| `src/studio/bridge.js` (modify, 1 line) | the 🔌 banner is not shown (kept as `BR.banner`). |
| `src/studio/catalog.js` (modify, 1 line) | ✋ Benutzen gets class `pro`. |
| `src/main/pack.js` (modify, 2 lines) | `idOK` accepts `k: g: p: s:`; `make(from, filter)`. |
| `test/uiprefs.js`, `test/hints.js`, `test/ding.js` (new) | node tests. |
| `test/start.mjs` (new) | the W1 browser test. |
| `test/spawn.mjs`, `test/studio_live.mjs` (modify) | „Platz" accepted; Profi enabled before `#studiolive`. |

Node test harness: `test/load_shared.js` loads `src/shared/*` into a VM context; the new node tests build their own tiny context (`vm.createContext` with `localStorage` stub, `document` stub, `window`, `navigator.language`) and `vm.runInContext` the files they need. Run with `bash test/wt_run.sh <file>.js`.

---

### Task 1: Build wiring, `VR.UIPrefs`, `start.css` skeleton

**Files:**
- Modify: `build.js:21,26,29,45,49,55`
- Create: `src/shared/uiprefs.js`, `src/ui/start.css`
- Test: `test/uiprefs.js`

**Interfaces:**
- Produces: `VR.UIPrefs.get() → {pro:boolean, lang:string, scale:number}` · `set(patch) → boolean` (false when storage refused; state still applied) · `on(fn(prefs)) → unsubscribe` · `apply()` (sets `document.documentElement.classList` `pro`/`einfach`, `dataset.ui`, `style --ui-scale`) · `KEY = 'r9si.ui'`. Migration: no `r9si.ui` and `r9si.studio.pro === '1'` → `pro: true`. Every `set` mirrors `r9si.studio.pro` (`'1'`/`'0'`). A `storage` event for `r9si.ui` reloads and notifies. `VR.I18N.on` → `set({lang})`.
- Build: `const UI_SHARED = js('main', ['i18n']) + '\n' + js('shared', ['uiprefs', 'hints', 'ding'])`, inserted in `mainSrc` before `js('main', MAIN)` and in `studioLibs` after `landing`; MAIN gets `'start'` after `'ui'`; `css = read('src/ui/style.css') + '\n' + read('src/ui/start.css')`, `studioCss` likewise; studio body gets `<script>nav.js</script><script>studio/start.js</script>` after `bridge.js` (files added later; `exists()` guards them in `js()`, the studio ones via a `read` guarded by `exists`).

- [ ] **Step 1: Write the failing node test `test/uiprefs.js`**

```js
// default · migration · set returns false when storage throws · storage event · mirror
const ctx = mk({ 'r9si.studio.pro': '1' });          // mk(): vm context with a Map-backed localStorage
load(ctx, 'src/main/i18n.js'); load(ctx, 'src/shared/uiprefs.js');
assert.deepEqual(pick(ctx.VR.UIPrefs.get()), { pro: true, scale: 1.15 });   // migrated
assert.equal(ctx.localStorage.getItem('r9si.ui') !== null, true);
assert.equal(ctx.VR.UIPrefs.set({ pro: false }), true);
assert.equal(ctx.localStorage.getItem('r9si.studio.pro'), '0');             // mirrored
let seen = null; ctx.VR.UIPrefs.on(p => { seen = p.pro; });
ctx.localStorage.__throw = true; assert.equal(ctx.VR.UIPrefs.set({ pro: true }), false); assert.equal(ctx.VR.UIPrefs.get().pro, true); assert.equal(seen, true);
ctx.localStorage.__throw = false;
ctx.localStorage.setItem('r9si.ui', JSON.stringify({ v: 1, pro: false, lang: 'de', scale: 1.3 })); ctx.window.dispatchEvent({ type: 'storage', key: 'r9si.ui', newValue: '…' });
assert.equal(ctx.VR.UIPrefs.get().scale, 1.3);
assert.equal(ctx.document.documentElement.style['--ui-scale'], '1.3');
console.log('ALL OK');
```

- [ ] **Step 2: Run it, expect failure** — `bash test/wt_run.sh uiprefs.js` → `Cannot find module`/`VR.UIPrefs undefined`.
- [ ] **Step 3: Implement `src/shared/uiprefs.js`** (guard `typeof document`/`window`; `apply()` is a no-op without a document) and the `build.js` changes; `start.css` starts with the tokens block (`:root{--ui-scale:1.15; --tile:160px; --accent:#3af0ff}`) only.
- [ ] **Step 4: Run the test, expect `ALL OK`; `node build.js` succeeds and `dist/index.html` contains `VR.UIPrefs`.**
- [ ] **Step 5: Commit** — `feat(ui): r9si.ui prefs, i18n and shared UI modules bundled into both pages`.

### Task 2: `VR.Hints`

**Files:** Create `src/shared/hints.js`; Test `test/hints.js`.

**Interfaces:**
- Produces: `VR.Hints.KEY = 'r9si.hints'` · `want(id) → boolean` (not done, shown < 3 times across sessions, not shown this session) · `show(id, {text, picto:[string]|'' , onDismiss}) → boolean` (false while another hint is on: never two at once; marks `seen[id]=t`, `n[id]++`) · `done(id)` (marks `done[id]=t`, hides it if showing) · `dismiss()` (✕: hides only) · `current() → id|null` · `read() → store` · `reset()`. DOM: `#hints` (created in `document.body` on first show) with `.hint` > `.picto` (spans `kbd`/`.mouse`/`.finger`), `.txt`, `button.x`; class `on` while shown. No timers.

- [ ] **Step 1: Write `test/hints.js`**: `want('move')` true → `show('move',{text:'x'})` true → `show('fly',…)` false → `current()==='move'` → `done('move')` → `current()===null`, `read().done.move > 0`, `read().seen.move > 0`, `read().n.move === 1`; `want('move')` false; after `reset()` and three `show/dismiss` cycles of `fly` in three fresh contexts (`n.fly === 3`) `want('fly')` is false.
- [ ] **Step 2: Run, expect failure.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run, expect `ALL OK`.** - [ ] **Step 5: Commit** — `feat(ui): hints store, one at a time`.

### Task 3: `VR.Ding` model, renderer, share pack

**Files:** Create `src/shared/ding.js`; Modify `src/main/pack.js` (`idOK`, `make(from, filter)`); Test `test/ding.js`.

**Interfaces:**
- Produces: `VR.Ding.parse(id) → {kind:'b'|'m'|'h'|'k'|'g'|'p'|'s', key} | null` · `of(kind, key)` · `favId(id)` (`b:`/`m:` → bare name, `h:` → `blueprint_<i>`, others → id) · `fromFav(favId) → id` (bare block/item → `b:`, VM model name → `m:`, `blueprint_<i>` → `h:`, `k:…` etc. unchanged) · `isFav(id)` · `toggleFav(id) → boolean` · `name(id)` (block display / `VM.MODELS[n].display` / catalogue house name via `VR.Ding.houseName(i)` set by the Studio, else `Haus <i>` / project or library names from storage) · `state(id)` (`'✎ Entwurf'` for a project draft, `'✓ im Spiel'` for a saved design, `''`) · `actions(id, ctx) → ['view','edit','fav','set','share']` subset in that order, from `VR.Ding.handlers` availability: `handlers.view/edit/set(id) → boolean|undefined` where a handler returning `false` for `can(id)` removes it (`handlers.canView(id)`, `canEdit(id)`, `canSet(id)`, `canShare(id)` optional predicates); `share` present for `b: m: h: p:` only · `list(filter) → [{id, t}]` newest first from favourites, `VR.Custom.load()` designs, `VR.Pack.libLoad()` Bauteile, `localStorage['r9si.projects']` kit/genie/site entries (`k:`/`g:`/`s:` = `'<kind>:' + p.id`? **No:** project ids already start with `k`/`g`/`s`; the Ding id is `'k:' + p.id` etc.) · `render(id, opts) → HTMLElement` (`.ding[data-ding=id]` > `.pic`, `.cap` (`.n` name, `.st` state), `.dacts` with `button[data-da=view|edit|fav|set|share]` texts `👁 Ansehen` `✏️ Bearbeiten` `☆ Favorit`/`★ Favorit` `📍 Setzen` `📦 Teilen` via `tx`; `opts.setLabel` overrides the 📍 text (standalone „🎒 Merken"); click → `handlers.<act>(id, el)`, ☆ toggles and repaints; pictures lazy through `handlers.pic(id, w, h) → canvas|HTMLImageElement|null` called when the card first intersects the viewport (IntersectionObserver, `rootMargin 240px`), fallback immediate) · `sharePack(id) → pack|null` (`VR.Pack.make(from, filter)` with exactly one entry: the design when `h:`/`m:` has one, else the favourite id; `p:` → the library item) · `download(name, text) → Promise<boolean>` (host `window.claude.use('downloads')` / parent's, else `<a download>`; `VR.Ding.download` replaceable for tests) · `share(id)` = `sharePack` + `download(VR.Pack.fileName() with the Ding name)`.
- `VR.Pack.idOK` additionally accepts `/^[kgps]:[A-Za-z0-9_.:-]{1,80}$/`; `VR.Pack.make(from, filter)` with `filter = {favs:[id], houses:[i], models:[name], lib:[id]}` keeps only those entries (no filter → everything, as today).

- [ ] **Step 1: Write `test/ding.js`** (vm context with `src/main/i18n.js`, `favs.js`, `pack.js`, `custom.js`-free stubs: `VR.R.byName`, `VR.VM.MODELS`, `VR.ITEMS`, `VR.Custom.load/save`): `parse('h:3')` → `{kind:'h', key:'3'}`; `favId('h:3') === 'blueprint_3'`; `fromFav('vm_sofa_x') === 'm:vm_sofa_x'`; `toggleFav('k:kabc')` → `localStorage r9si.favs` contains `k:kabc`; `VR.Pack.idOK('k:kabc') === true`, `idOK('x:1') === false`; `actions('h:3')` with handlers `{view, edit, set}` → `['view','edit','fav','set','share']`; `actions('k:kabc')` → no `share`; `sharePack('b:oak_planks')` → `summary(pk).favs === 1`, houses/models/lib 0; `sharePack('m:vm_sofa_x')` with a custom model design → `models === 1`, `favs === 0`; `sharePack('p:b1')` → `lib === 1`; `render('b:oak_planks').querySelectorAll('.dacts button')` texts start with `👁`, `✏️`, `☆`, `📍`, `📦` and none `disabled` (a minimal `document.createElement` stub that records children and attributes).
- [ ] **Step 2: Run, expect failure.** - [ ] **Step 3: Implement `ding.js` and the `pack.js` edits.** - [ ] **Step 4: Run, expect `ALL OK`; also `bash test/wt_run.sh pack.js` still `OK`.** - [ ] **Step 5: Commit** — `feat(ding): one card model with five actions, favourites and packs for k: g: p: s:`.

### Task 4: The game's start screen (tiles, worlds, create, Profi strip, picker)

**Files:** Create `src/main/start.js`; grow `src/ui/start.css`; Create `test/start.mjs` (sections 1, 4 of its final shape); Modify `src/main/ui.js:245` (sethome hint).

**Interfaces:**
- Consumes: `VR.UIPrefs`, `VR.Hints`, `VR.I18N.tx/picker/on`, `game.store.listWorlds/saveWorld/deleteWorld`, `game.createWorld/loadWorld/quitToTitle`, `ui.show/act/showSettings/titleNote/studioNote/renderHosts`.
- Produces: `VR.Start` — `mount(ui)` (called from a `VR.UI.prototype.build` wrapper) · `render()` (re-renders `#title` keeping `#splash #studionote #mphosts #titlenote #gpuinfo` ids) · `play()` (no world → `createWorld({name: tx('start.myWorld',…,'Meine Welt','My World') + (n ? ' ' + (n+1) : ''), mode:'zen', difficulty:'peaceful', type:'default', seed:'', cheats:true, kit:true})`; else `loadWorld(last by lastPlayed)`) · `worlds()` (overrides `UI.prototype.showWorlds`: `#worldlist` gets `.wcard` per world with `button[data-w=play|bauen|rename|del]`, below: `＋ Neue Welt` (Einfach: creates like `play()` without loading? **No** — creates and enters; Profi: `show('create')`), `← Zurück`) · `createForm()` (re-renders `#create` with German labels, same ids/data-acts, rebinds the `.seg` toggles) · `bauen()` (`location.href = 'studio.html' + search + '#world/<id>/karte'`, no world → `'#bauen'`) · `erschaffen()` (`'studio.html…#erschaffen'`) · `tileLabels()` for the test: `[...document.querySelectorAll('#title .tile .lbl')].map(t => t.textContent)`.
- DOM: `#title` > `.start` > `.tiles` with exactly four `button.tile[data-tile=play|bauen|erschaffen|meins]` (each: inline SVG `.pic` ≥ 64 px, `span.lbl`), `.sub` under play (`Andere Welt · ＋ Neue Welt` as two `button.lnk`), `.strip` top-right: `#proSwitch` (`button[data-pro=0|1]` pair „Einfach | Profi"), `.langpick`, `button[data-act=settings]` „⚙ Einstellungen", `button[data-scale]` „Aa". Footer keeps `#gpuinfo`, `#studionote` (📦 drop-in as today, in Einfach as a single „📦 R9-Paket" button), `#mphosts`, `#titlenote`.
- The ▶ tile carries class `pulse` while `VR.Hints.want('play')`; `play()` calls `VR.Hints.done('play')`.
- German create form: Weltname · Spielart (Überleben / Kreativ / Zen-Baumeister) · Schwierigkeit (Friedlich / Leicht / Normal / Schwer) · Welttyp (Realm / Große Biome / Verstärkt / Flach) · Seed (optional) · Befehle · Inventar behalten · Starter-Kit · „Welt erstellen" / „Abbrechen" — all through `tx`.
- Phone width (≤ 700 px): the tiles form a 2×2 grid, 16 px gutters, no horizontal scroll.

- [ ] **Step 1: Write `test/start.mjs` sections 1 and 4** (harness like `deadends.mjs`: http server, `locale: 'de-DE'`, viewport 1280×720, `ONLY=` env picks sections, `done()` asserts no pageerror):
  - §1 game title: `document.querySelectorAll('.tile').length === 4`; `documentElement.lang === 'de'`; the play tile's `.lbl` is „▶ Losspielen"; it has class `pulse`; `#proSwitch` present; `.langpick` present; `#title` text contains no „Play"/„Settings"/„Quick Start".
  - §4 worlds: after a world exists (created in §2 by the ▶ click, see Task 5): click „Andere Welt" → `#worlds.on`, one `.wcard` with four buttons ▶ 🏗 ✎ 🗑; 🗑 once → button text contains „Sicher"; a click elsewhere (`#worlds .panel`) → disarmed; „← Zurück" → `#title.on`; picker: click `.langpick .lp-btn`, then `.lp-item` whose text is `English` → the play tile's `.lbl` is „▶ Play on"; `documentElement.lang === 'en'`; back to Deutsch → „▶ Weiterspielen"; Profi: click `[data-pro="1"]` → `localStorage r9si.ui` has `pro:true` → the `#title .sub` shows „＋ Neue Welt" opening `#create` (`show('create')`, German label „Welt erstellen"); back to Einfach.
- [ ] **Step 2: Run `ONLY=1 bash test/wt_run.sh start.mjs 600`, expect ✗ (no tiles).**
- [ ] **Step 3: Implement `src/main/start.js` (mount/render/play/worlds/createForm/bauen/erschaffen + act wrapper) and the CSS.** Tiles: `min-width: var(--tile)`, square, dark translucent, cyan focus ring and hover, `@keyframes pulse` on `.pulse`, labels `calc(18px * var(--ui-scale))` bold white.
- [ ] **Step 4: Run §1 (and §4 once Task 5 exists), expect ✓; `node build.js`; look at `test/shots/start_1_title.png`.**
- [ ] **Step 5: Commit** — `feat(start): the game's start screen — four tiles, worlds as cards, German create form, Einfach/Profi`.

### Task 5: ▶ one click into a Zen world, the pause menu, 🏗 Bauen over the game, „mein Platz"

**Files:** Modify `src/main/start.js`; Modify `src/main/game.js:329` (`openStudio(tab)`); Modify `src/main/ui.js:245` (sethome hint via `tx`); Modify `src/studio/spawn.js` (labels „an meinem Platz", „Mein Platz", „Mein Platz ist jetzt hier", `.lbl` write); Modify `test/spawn.mjs` (regexes `/Spawn|Platz/i`), `test/studio_live.mjs` (Profi on before the world); Test `test/start.mjs` §2, §3.

**Interfaces:**
- Produces: pause panel re-rendered by `VR.Start.pauseMenu()` (called from a `VR.UI.prototype.pause` wrapper before the original runs) keeping ids `#studiolive #mppanel #zenpanel #pausenote` and data-acts `resume studiolive gohome sethome codex photo settings quit`; order: `▶ Weiterspielen` (data-act resume) · `🏗 Bauen` (`data-act=bauenlive` → `g.openStudio('karte')`) · `🎒 Meins` (`data-act=meins`) · `#mppanel` · `🏠 Zu meinem Platz` (gohome) · `📍 Mein Platz ist hier` (sethome) · `#zenpanel` · Profi only (class `pro`): `🧰 Werkbank · diese Welt` (`#studiolive`, studiolive → `openStudio('bench')`), `📖 Codex`, `📷 Fotomodus` · `⚙ Einstellungen` · `⏏ Speichern & zum Start` (quit) · `#proSwitch` clone · `#pausenote`. `html:not(.pro) .pro { display:none }` in `start.css`.
- `Game.prototype.openStudio(tab)`: URL `'#world/' + id + '/' + (tab || 'bench')`.
- `ui.act('sethome')` hint: `tx('start.spawnSet', null, '📍 Dein Platz ist jetzt hier — 🏠 bringt dich zurück', '📍 Your spot is here now — 🏠 brings you back')`.
- Chat commands in Einfach: a `Game.prototype.chat` wrapper answers `/…` with `tx('start.cmdPro', null, 'Befehle gibt es im Profi-Modus (Start · Profi).', 'Commands are a Profi thing (Start · Profi).')` and returns; Profi passes through.

- [ ] **Step 1: Write §2, §3 of `test/start.mjs`**: §2: `applyPreset('potato')`, `renderDist 4`, `horizon 0`; click `#title .tile[data-tile=play]` once → state reaches `'play'` within 150 s, `meta.mode === 'zen'`, `meta.name` starts with „Meine Welt", `localStorage r9si.hints` has `done.play`. §3: `ui.pause()` → first `#pause button` text „▶ Weiterspielen"; texts include „🏗 Bauen", „🎒 Meins", „🏠 Zu meinem Platz", „📍 Mein Platz ist hier", „⚙ Einstellungen", „⏏ Speichern & zum Start"; `#studiolive` not visible, no „Codex" visible; `VR.UIPrefs.set({pro:true})` → `#studiolive` visible and „Codex" visible; back to Einfach; click `[data-act=sethome]` → `#hint` text contains „Platz"; click „🏗 Bauen" → within 240 s the frame's `VR.StudioWorld.tab === 'karte'` and `g.studioOpen`; `g.closeStudio(true)`; `g.quitToTitle()` → title, play tile „▶ Weiterspielen".
- [ ] **Step 2: Run `ONLY=2,3`, expect ✗.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run `ONLY=1,2,3,4`, expect ✓; then `bash test/wt_run.sh spawn.mjs` and `studio_live.mjs` → `ALL OK`.**
- [ ] **Step 5: Commit** — `feat(start): ▶ Losspielen in one click, the Einfach pause menu, 🏗 Bauen opens the Karte over the game, "mein Platz"`.

### Task 6: Hints 1–3 in the game, `r9si.hand`

**Files:** Modify `src/main/start.js`; Test `test/start.mjs` §2b.

**Interfaces:**
- Produces: `VR.Start.hintTick()` on a 250 ms interval while `g.state === 'play'` and no screen is open: hint `move` after 5 s with no position change since entry (`text: tx('hint.move', null, '🖱 bewegen = umschauen · W A S D = gehen', '🖱 move = look around · W A S D = walk')`, picto `['W','A','S','D','mouse']`; touch: „👆 ziehen = umschauen · laufen"); `done('move')` when the player moved ≥ 1.5 blocks or any of W/A/S/D was pressed; hint `fly` once `done.move` and `player.mode !== 'survival'` (`'Leertaste 2× = fliegen'`, picto `['Space','Space']`); `done('fly')` when `player.flying`. `VR.Start.handAllowed(meta) → boolean` (`meta` not guest and mode `creative`/`zen`). On entering play, `r9si.hand` is read once: allowed and `ding` is `b:`/`m:`/`h:` → `p.inv.slots[p.inv.sel] = {id: item, n: maxStack}` (`h:i` → `blueprint_i`), `inv.changed = true`, toast `tx('hand.toast', {n}, '🖐 {n} in der Hand — Rechtsklick setzt es', '🖐 {n} in hand — right click places it')`; the key is removed in every case.
- [ ] **Step 1: Write §2b**: after §2's world is open (no screen): wait 6 s → `#hints.on` and its text contains „W A S D"; `VR.Hints.current() === 'move'`; press `w` for 700 ms → `r9si.hints.seen.move > 0`, `done.move > 0`; within 2 s `current() === 'fly'`, and at every 250 ms sample `document.querySelectorAll('#hints .hint').length <= 1`; double-tap Space → `done.fly`; `#hints` not `on`. Also: `localStorage.setItem('r9si.hand', JSON.stringify({v:1, ding:'b:oak_planks', world: id, t}))` then `g.quitToTitle()` + ▶ → in play the selected hotbar slot holds `oak_planks` and the key is gone. Unit: `VR.Start.handAllowed({mode:'survival'}) === false`, `({mode:'zen'}) === true`, `({mode:'zen', guest:true}) === false` (via `page.evaluate`).
- [ ] **Step 2: Run, expect ✗.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run §1–§4, expect ✓.** - [ ] **Step 5: Commit** — `feat(hints): the first three hints — move, fly, the ▶ pulse; a Ding handed into the world`.

### Task 7: The Studio's header: tiles, breadcrumb, Profi switch, routes; `VR.Nav`

**Files:** Modify `build.js:55` (header markup), `src/studio/studio.js:941-946` (⚙ Profi via `VR.UIPrefs`), `src/studio/bridge.js:162`, `src/studio/catalog.js:287` (`pro` class); Create `src/studio/nav.js`, `src/studio/start.js`; grow `start.css`; Test `test/start.mjs` §5, §9.

**Interfaces:**
- Header markup: `<header><div class="brand">…</div><div id="tiles"></div><div id="navCrumb"></div><div id="proSwitch"></div><nav class="modes">…6 data-mode buttons + 🕘 + ✨ as today…</nav><!--GAMELINK--><div class="sys">…</div></header>`; `#studio:not(.pro) nav.modes { display:none }`; the header wraps (`flex-wrap`), `nav.modes` takes a full row in Profi; `#studio` row heights `auto`.
- `VR.Nav`: `push({kind:'view'|'editor'|'meins', label, restore(), escapable}) → layer` (depth capped at 3: the bottom layer is dropped) · `pop() → boolean` (runs `restore`) · `top()` · `depth()` · `clear()` · `crumb()` renders `#navCrumb` as `span.c` per layer joined by `›` with a leading `button.back` „←" (hidden at depth 0) · Esc (capture) pops when `depth() > 0`, `top().escapable !== false`, active element not INPUT/TEXTAREA, and none of `#imagine.on, #hub.on, #packDlg.on, #imPad` exist.
- `VR.StudioStart` (`src/studio/start.js`): `tiles()` renders four `button.tile[data-tile]` into `#tiles` (▶ is `id="playBtn"` with class `gamelink playb` so `spawn.js` keeps working, label in `span.lbl`; standalone: „🎮 Zum Spiel" → `VR.StudioBridge.toGame`) · `go(tile)`: `bauen` → world open → `C.setMode('world')`, `WM.tab='karte'`, `WM.refresh()`; else `WM.openId(lastId, 'karte')`; no world → `C.setMode('arch')` + `VR.Projects.toast(tx('st.firstWorld', null, 'Erst eine Welt: ▶ Losspielen im Spiel', 'A world first: ▶ Play in the game'))`; `erschaffen` → `WM.imagine.open(null, IM.aiOK ? 'genie' : 'house')`; `meins` → `VR.Projects.show(true)` · routes on load (after `PJ.whenReady`): `#bauen` → `go('bauen')`, `#erschaffen` → `go('erschaffen')`, `#ding/<id>` → `view(id)` (unknown id → toast `tx('st.gone', …, 'Das gibt es hier nicht (mehr)', 'That is not here (any more)')`, no throw) · `applyPro(p)` mirrors `#studio.pro`, lights the tile of the current mode (`on`) · the mode-bar buttons' `onclick` are rebound to `Nav.clear(); C.setMode(m)`.
- `studio.js` ⚙ block: `pb.onclick = () => VR.UIPrefs.set({ pro: !VR.UIPrefs.get().pro })`; `VR.UIPrefs.on(p => set(p.pro))`; `set(VR.UIPrefs.get().pro)` at boot (the old `r9si.studio.pro` read stays as the fallback when `VR.UIPrefs` is missing).
- `bridge.js`: `BR.banner = banner;` instead of `banner();`.

- [ ] **Step 1: Write §5 and §9**: §5: `goto studio.html` → `document.querySelectorAll('.tile').length === 4`; `nav.modes` has `getClientRects().length === 0`; `#playBtn` exists inside a tile; `VR.UIPrefs.set({pro:true})` → `nav.modes button[data-mode]` count 6, visible, `#studio.pro`; the right `.proT` is `.on`; `set({pro:false})` → hidden again; `#bridgeBar` absent (also on `studio_artifact.html` loaded over http). §9 (routes): `goto studio.html#ding/h:99` → no pageerror, `#pjToast` text contains „nicht"; `goto studio.html#ding/h:3` → after boot `S.scene.type === 'house' && S.scene.index === 3`.
- [ ] **Step 2: Run `ONLY=5,9`, expect ✗.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run §5, §9 ✓; `bash test/wt_run.sh deadends.mjs 1200` §1 still ✓ (⚙ Profi, `r9si.studio.pro` mirrored); `projects.mjs` ✓.**
- [ ] **Step 5: Commit** — `feat(studio): one front door — tiles in the header, breadcrumb stack, one Einfach/Profi switch`.

### Task 8: The Karte view: Ding cards, 📍 Setzen = ghost, every click commits

**Files:** Modify `src/studio/start.js`; Modify `src/studio/world.js` (parts hook line; ⬆ label); Modify `src/studio/spawn.js` (`WM.landingBox = section`); Test `test/start.mjs` §6, §7.

**Interfaces:**
- `WM.tab === 'karte'`: `HOOK.chips` wrapper (runs first): Einfach → chips `★ Favoriten · 🏠 Häuser · 🪑 Möbel` (`WM.karteCat` ∈ `fav|house|furn`, default `house` unless favourites exist); Profi → the world tabs as today with `🗺 Karte` prepended. `HOOK.list` wrapper: `.ding` cards via `VR.Ding.render` for `h:<i>` (all 11) / `m:<name>` (own designs first, then every non-facade model), favourites first within the chosen chip; `handlers.set(id)` → `WM.tool = h: ? WM.houseItem(i) : {kind:'model', name}`, `WM.ghost = null`, `WM.meshFor(tool)`, `WM.refresh()`, tip `tx('karte.aim', null, 'Zeig auf den Boden — Klick setzt es · R dreht · Esc fertig', 'Point at the ground — a click places it · R turns · Esc done')`. `HOOK.pointer` wrapper on `'up'` with `WM.tool` and `WM.tab === 'karte'` and a click (no drag): `WM.placeNow()`; returns true. `WM.placeNow() → plan|null` (exposed for tests): ghost missing or `!ghost.ok` → tip `tx('karte.noGround', …, 'Zeig auf den Boden', 'Point at the ground')`, returns null; else `WM.change(() => push {…ghost, id, status:'draft', t})`, then `WM.commit(true)` → status `pending`, toast `tx('karte.set', {n}, '✓ {n} gesetzt — ▶ bringt dich hin', '✓ {n} placed — ▶ takes you there')`, the tool stays in hand. Both mouse buttons place (`b === 0 || b === 2`); right click no longer cancels in the Karte (Esc / ✕ do). `WM.karteParts(el)` (world.js calls it for the karte tab): the chosen card (`VR.Ding.render(toolId, {compact:true})`) with `↻ Drehen · R`, `◐ Fassade · F` (houses, not own designs), `✕ Fertig`; without a tool: „Tipp 📍 Setzen auf einer Karte links"; then the selection block as today (reused via `WM.selectionPanel(el)` **extracted?** No — keep it simple: the selection shows name + `✕ Löschen` + `↻ Drehen`); `WM.landingBox(el)` at the top; no ⬆ button, no „So geht's" notes.
- Profi (`houses`/`furn`/`plan` tabs): unchanged flow; the ⬆ button reads `📍 Alle setzen (n)`.

- [ ] **Step 1: Write §6, §7**: §6 `goto studio.html#world/<id>/karte` (the world from §2) → wait `WM.world.id === id && !WM.loading`; `WM.tab === 'karte'`; `#list .ding` count ≥ 11 (Einfach, chip Häuser); the first card's `.dacts button` texts start with `👁 ✏️ ☆ 📍 📦` in order, none disabled; no `#partsBody` button text contains „übernehmen"/„In die Welt". Click the first card's `[data-da=set]` → `WM.tool.kind === 'house'`; `page.mouse.click` at the view's centre → within 3 s `r9si.plans.<id>` has one plan with `status === 'pending'`, `WM.tool` still set, `#worldTip` text contains „gesetzt"; `page.mouse.click` at the view's top-left corner (sky) → the plan count stays 1 and `#worldTip` text contains „Boden"; `Escape` → `WM.tool === null`. §7 Profi: `VR.UIPrefs.set({pro:true})`, `WM.tab='plan'; WM.refresh()` → `#partsBody` has a button starting with „📍 Alle setzen"; back to Einfach.
- [ ] **Step 2: Run `ONLY=6,7`, expect ✗.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run ✓; `bash test/wt_run.sh world_mode.mjs 1200` ✓; `deadends.mjs` ✓.**
- [ ] **Step 5: Commit** — `feat(karte): the Karte view — cards left, ghost on the map, every click commits`.

### Task 9: 🎒 Meins — Studio (hub) and game (screen); 📦 Teilen; 👁 / ✏️ routes

**Files:** Modify `src/studio/projects.js` (`PJ.decorate` hook; title); Modify `src/studio/start.js`, `src/main/start.js`; Test `test/start.mjs` §8 (Studio), §4b (game).

**Interfaces:**
- Studio: `PJ.decorate(body, {q, f})` is called by `renderBody` after `body.innerHTML = h`; `VR.StudioStart` sets it: every `.pj` card gets class `ding` and a `.dacts` row from `VR.Ding.render` (`h:`/`m:` for house/item drafts, `k:`/`g:`/`s:` for kit/genie/site, world cards get none); after the grids a section `<h4>★ Favoriten</h4><div class="grid dings">` with `VR.Ding.render` for every favourite Ding not already shown, then `<h4>🧱 Bauteile</h4>` for `p:` items; standalone adds a footer button „📦 Alles mitnehmen" (`BR.exportPack`). Handlers in the Studio: `view(id)`: `h:` → `C.setMode('arch', true); C.selectHouse(i)` · `m:` → `C.setMode(isFacade ? 'facade' : 'furn', true); C.selectModel(n)` · `b:` → `VR.StudioCatalog.open('block', n)` · `k:/g:/s:` → `VR.Projects.open(pid)` · `p:` → a `#dingView` layer (the thumb large, name, size) — each pushes a `Nav` `view` layer whose restore reopens what was open (hub open/closed + its scroll, mode, tab, `#list.scrollTop`, selected card); `edit(id)`: `h:` → `C.editHouse(i)`, `m:` → `C.editModel(n)`, `b:` → `CAT.open('block', n)` + `CAT.edit = true`, `k:/g:/s:` → `VR.Projects.open(pid)`, `p:` → Profi only: `WM.tab='bench'` with the piece selected (`canEdit` false in Einfach) — pushes an `editor` layer (`escapable:false`); `set(id)`: a world open → `WM.tab='karte'`, `C.setMode('world')`, `handlers.set` of Task 8; no world → `WM.openId(last, 'karte')` then the same; standalone → the 📍 button is labelled „🎒 Merken" (`opts.setLabel`) and `handlers.set` is `VR.Ding.toggleFav`. `share(id)` → `VR.Ding.share(id)`. `pic(id, w, h)`: `h:` → `C.HOUSE.get(i).thumb` copy · `m:` → `C.thumbOf(n)` copy · `b:` → `CAT.picture(id, w, h)` · `k:/g:/s:` → `<img src=PJ.thumbURL(pid)>` · `p:` → `<img src=item.thumb>`.
- `VR.Crafter.back` wrapper: when `Nav.top()` is an `editor` layer → `Nav.pop()`.
- Game: `#meins` screen (`.screen` appended to `#ui`): header „🎒 Meins" + `← Zurück` (data-act `meinsback` → the screen it came from: `title` or `pause`), chips `Alles · ★ · 🏠 Häuser · 🪑 Möbel · 🧱 Bauteile · 🌍 Welten`, a grid of `.ding` cards (`VR.Ding.list()`), worlds as `.wcard` rows; empty → `tx('meins.empty', …, 'Noch nichts hier — ✨ Erschaffen macht dein erstes Ding.', 'Nothing here yet — ✨ Create makes your first thing.')`. Game handlers: `view(id)` → `location.href = 'studio.html' + search + '#ding/' + id`; `edit(id)` → same route with `/edit`; `set(id)`: in play (from the pause menu) → the item into the selected hotbar slot and `resume()`; at the title → write `r9si.hand` and `VR.Start.play()`; `canSet` only for `b: m: h:`; `pic` → `g.icons.paint` on a 56×56 canvas for `b: m: h:` (`h:i` → `blueprint_i`), data-URL thumbs for the rest; `share` → `VR.Ding.share`.
- `pj.title` fallback „Meins" (the hub's header reads „🎒 Meins").

- [ ] **Step 1: Write §8 and §4b**: §8 (Studio, Einfach, `goto studio.html`, booted): create a kit project (`VR.StudioWorld.imagine.open(null,'house')`, click `#imagine [data-hs="style"][data-v="modern"]`, wait 2.5 s, `imagine.close()`); `VR.Favs.add('oak_planks')`; click the 🎒 tile → `#hub.on`, header text contains „Meins"; a `.pj.ding[data-id^="k"]` card with five-or-fewer `.dacts` buttons in order (no 📦 for `k:`); click its `[data-da=fav]` → `JSON.parse(localStorage r9si.favs).items` contains `'k:' + id`; a `★ Favoriten` section with a `.ding[data-ding="b:oak_planks"]` card having all five actions; `VR.Ding.download = (n, t) => { window.__pack = t; return Promise.resolve(true); }`; click its `[data-da=share]` → `VR.Pack.summary(VR.Pack.read(window.__pack))` totals exactly 1. §4b (game): `VR.Favs.add('oak_planks')`; click the 🎒 tile → `#meins.on`, a `.ding[data-ding="b:oak_planks"]` with five actions in order; `← Zurück` → `#title.on`.
- [ ] **Step 2: Run `ONLY=8,4`, expect ✗.** - [ ] **Step 3: Implement.** - [ ] **Step 4: Run ✓; `projects.mjs` ✓.** - [ ] **Step 5: Commit** — `feat(meins): 🎒 Meins — your things as cards in the game and the Studio, 📦 Teilen one thing`.

### Task 10: ← restores (✏️ from a card → editor → ←)

**Files:** Modify `src/studio/start.js`; Test `test/start.mjs` §10.

- [ ] **Step 1: Write §10**: Karte view open (§6's world), chip Möbel; `#list.scrollTop = 140`; the card at index 3 → `const id = card.dataset.ding`; click its `[data-da=edit]` → within 60 s `S.mode === 'craft'`, `VR.Nav.depth() === 1`, `#navCrumb` text contains „🗺 Karte" and „✏️"; click `#navCrumb .back` → `S.mode === 'world'`, `S.scene.type === 'world'`, `WM.tab === 'karte'`, `#list.scrollTop === 140` (±2), the card `[data-ding=id]` has class `on`, `VR.Nav.depth() === 0`. Then from 🎒 Meins: open the hub, scroll `.hubBody` to 200, click a `.pj.ding` card's 👁 → hub closed, `Nav.depth() === 1`; `Escape` → `#hub.on` again, `.hubBody.scrollTop === 200` (±2).
- [ ] **Step 2: Run `ONLY=10`, expect ✗.** - [ ] **Step 3: Implement the restore closures (mode, tab, `#list.scrollTop`, the `.on` card, hub open + scroll, `S.cam`).** - [ ] **Step 4: Run ✓.** - [ ] **Step 5: Commit** — `feat(nav): ← and Esc pop one layer and put you back where you were`.

### Task 11: Whole-suite check, screenshots, report

- [ ] `node build.js`; `bash test/wt_run.sh start.mjs 1500` (all sections) → `ALL OK`.
- [ ] One at a time: `spawn.mjs`, `studio_live.mjs`, `deadends.mjs`, `projects.mjs`, `world_mode.mjs` → `ALL OK` each; node: `uiprefs.js hints.js ding.js pack.js favs.mjs`.
- [ ] Screenshots: `test/shots/start_game_einfach.png`, `start_game_profi.png`, `start_studio_einfach.png`, `start_studio_profi.png`, `start_phone.png` (390×844) — taken by `start.mjs`; look at them (big tiles, one accent, readable German, nothing clipped).
- [ ] Final commit if anything moved; the report.
