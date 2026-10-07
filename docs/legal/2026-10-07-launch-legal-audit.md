# R9-SI & R9 Studio — launch audit: legal and privacy (2026-10-07)

**Scope.** The game R9-SI (public claude.ai artifact) and R9 Studio (private artifact), branch `v039` at commit `a6acbfe`, for a worldwide public launch by an owner living in Germany. Read-only audit of `src/main`, `src/shared`, `src/studio`, `src/worker`, `build.js`, `README.md`, `src/studio/notes.md`, the specs under `docs/superpowers/specs/` (incl. `2026-10-07-import-atmosphere-design.md` and `2026-10-07-all-ages-workflow-design.md` in the worktrees) and the built `dist/*.html`.

> **This is research for the owner, not legal advice.** It was written by an AI assistant from the code and from public sources (listed at the end). Laws change and single cases differ; before relying on it for anything with real money or real risk, have a lawyer (Fachanwalt für IT-/Medienrecht) read the parts that matter. Nothing here is a guarantee.

---

## 0 · Summary

**What is already fine (verified in the code):**

- **Nothing leaves the player's browser except through claude.ai's own realtime room.** There is no `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `<img>` ping, `importScripts` or WebRTC anywhere in `src/` (grep over all sources); the only URLs in the sources are the OFL link in `src/ui/fonts/LICENSES.md:4` and the game's own artifact URL in `build.js:113`. The built pages `dist/artifact.html`, `dist/studio_artifact.html` and `dist/index.html` contain **zero** external URLs. The fonts are embedded as `data:` URIs (`build.js:31`, `build.js:51`, `src/ui/fonts/*.css`), so no request goes to Google any more (commit `a6acbfe`).
- **No accounts, no analytics, no cookies, no ads, no payments, no AI calls.** The only platform capabilities the code uses are `room`, `user` and `downloads` (`src/main/net.js:23-25`, `src/studio/bridge.js:33`, `src/studio/workbench.js:433`). The Genie no longer asks Claude (`sample` is not used anywhere).
- **Saves are local only**: IndexedDB `r9si` (`src/main/storage.js:7,30-31`) and `localStorage` keys `r9si.*` (settings `src/main/game.js:33,43`, favourites, projects, plans, styles, language). The settings screen already says so (`src/main/ui.js:545`).
- **No copied third-party code or assets.** No licence headers, "Copyright", "MIT", minified vendor blobs, `module.exports`/`define.amd` signatures, data-URI images or audio files exist in `src/` (only the four OFL fonts). Noise (`src/shared/noise.js`), the RNG (`src/shared/core.js:46`, mulberry32) and the CRC32/zip writer (`src/shared/schem.js:256-258`) are hand-written implementations of public-domain algorithms. Textures (`src/main/tex_*.js`), icons, models (`src/shared/vox*.js`), sounds and music (`src/main/audio.js:1-3,39-42,128-170`) are procedural.
- **Mobs and most block names are original** (`src/main/entities.js:8-18`: glimmer deer, moss boar, ember husk, void stalker …; blocks renamed: Emberrock, Voidstone, Lilacite, Tidestone, Echo Moss, Deepstone, Ashwart). No "Creeper", "Steve", "Netherite" or "Minecraft" appears in any game UI text. The title screen says "Original voxel game · inspired by the block sandbox genre" (`src/main/ui.js:62`).
- **Chat and names are rendered safely** (`textContent` / `esc()`: `src/main/ui.js:10,355,386,398,436`; names cleaned in `src/main/mp.js:38`).
- **Multiplayer is de facto invite-only.** The claude.ai `room` admits only signed-in members of the owner's organisation and people the owner invited by e-mail; a visitor of the public link (signed out or a stranger) can never connect (platform contract, `room.d.ts` "Who is here"). Chat with strangers is therefore not possible with the current sharing setup.

**Top findings (details and evidence in §2):**

1. **Impressum: yes, a minimal one is needed.** Not under § 5 DDG (a hobby game without income is not *geschäftsmäßig*), but § 18 Abs. 1 MStV requires **name and address** for every telemedium that does not serve *exclusively* personal or family purposes — a worldwide public link does not. Fine of up to €50,000 is theoretically possible (§ 115 MStV); in practice the risk for a hobby game is an Abmahnung-style letter. Effort: one screen, texts in §4.
2. **The claude.ai profile name is broadcast the moment the page opens**, before the player did anything and even when "Friends can join my worlds" is off: `src/main/game.js:154-155` → `mp.init()` → `net.js:25-27` reads `user.me().name` → `mp.js:82` `presence({ n: this.myName() })`. Everyone else with the page open (invited people only, see above) sees that name on their title screen (`ui.js:386`). This is lawful enough among invited friends, but it is not "privacy by default" (Art. 25 DSGVO) and children playing under a parent's account would broadcast the parent's real name. → one-time notice + nickname before the first `presence` (to-do 2).
3. **Real companies and their product names are in the shipped source and README**: Kern-Haus (*Signus*, *Karat*), Stilhaus (*Bel Portale*, *Sanssoucis*, *Villa am See*, *Palais Royal*, *Primavera*), OKAL (*Black Label*, *Staffel*, *Bungalow*) — `src/shared/gen_plan.js:4-20,101,182,208` (comments ship unminified inside the public HTML; skin ids `signus`/`blacklabel` at `gen_plan.js:41,60`), `src/studio/studio.js:34` (`SKIN_NAME`: "Signus · weiß/anthrazit", "Black Label" shown in the Studio), `src/studio/studio.js:23-27` (house names "Bel Portale", "Sanssoucis", "Palais Royal"), `README.md:61-97`, `src/studio/notes.md:57`. The floor plans are described as rebuilt "at real scale" after those companies' plans (`README.md:62-64`). Trademark risk is low (no use in trade, see §3.5), but the public statement "after Kern-Haus … Stilhaus …" plus their product names is the one thing in this project a rights holder could complain about cheaply. → rename three names, rewrite the comments and README (to-do 3).
4. **The block roster is a mapped copy of Minecraft's block list** with the Minecraft Wiki page name kept per block (`wiki:` on 257 definitions, e.g. `src/shared/blocks1.js:173-180,213-218,230-233`, `blocks2.js:110,234-247,296-300`), Minecraft block ids as internal ids and the `minecraft:` namespace on export (`src/shared/schem.js:73-100`), "Minecraft block names" in `README.md:209-210`, and four codex milestone titles identical to Minecraft advancement names (`src/main/codex.js:13,14,16,35`: "Stone Age", "Hot Stuff", "Diamonds!", "Sweet Dreams"). Names, lists and mechanics are not protected by copyright; the textures, sounds and models are the owner's own; so the legal exposure is low. What is missing is the disclaimer Mojang's guidelines require wherever "Minecraft" is mentioned, and a bit of distance (to-do 4).
5. **Fonts: embedded correctly, credit incomplete.** The OFL requires the copyright notice and the licence to travel with the fonts. The embedded woff2 files still carry their copyright strings and the OFL URL in their name tables (verified with fontTools), but no in-game credit exists; `src/ui/fonts/LICENSES.md:1-6` is only in the repo. → the 📜 Credits text in §4.3 (to-do 1).
6. **Sharing features have no "only what is yours" hint** (📦 r9-paket `src/studio/bridge.js:45-55`; ⬇ .schem/.vox/.json `src/studio/workbench.js:427-441`; Bild → 3D export `src/studio/imagine.js:385`), and the planned import feature (spec §1) is the first place where third-party licences enter the game. The spec's tier policy is sound; two details need care (§3.7).
7. **No LICENSE/copyright notice for the project itself.** Anyone signed in can "copy and save" a published artifact (claude.ai help centre); without a notice the code is "all rights reserved" by default, which is fine, but say so (or choose a licence) — to-do 6.

Everything else (TDDDG consent for localStorage, COPPA, UK Children's Code, GDPR-K, BFSG/European Accessibility Act, DSA, AI Act, GEMA, youth protection) is either not applicable or already satisfied — see the table.

---

## 1 · What the code actually does with data (facts, with evidence)

| Topic | Fact | Evidence |
|---|---|---|
| Network | No HTTP/WebSocket/WebRTC code of its own. Only `window.claude.use('room' / 'user' / 'downloads')`. | grep over `src/`; `src/main/net.js:21-27`; `src/studio/bridge.js:33`; `src/studio/workbench.js:433`; `dist/*.html`: 0 external URLs |
| Fonts | Orbitron + Rajdhani (game), Sora + JetBrains Mono (Studio), OFL 1.1, embedded as `data:font/woff2` (4 + 2 `@font-face`), no `url(http…)`. | `src/ui/fonts/game_fonts.css`, `studio_fonts.css`, `LICENSES.md`; `build.js:31,51` |
| Local storage | IndexedDB `r9si` (`worlds`, `chunks`); localStorage `r9si.settings`, `r9si.lang`, `r9si.favs`, `r9si.studio`, `r9si.projects`, `r9si.wip.*`, `r9si.thumb.*`, `r9si.plans.*`, `r9si.land.*`, `r9si.library`, `r9si.style.*`, `r9si.mp`, Studio prefs; sessionStorage `r9si.bridge.hide`. All wrapped in try/catch, in-memory fallback. | `src/main/storage.js:7,27-31`; `game.js:33,43`; `i18n.js:34,46`; `favs.js:20-26`; `pack.js:19-21`; `projects.js:35-50`; `studio/space.js:22-62` |
| Device reads (local only) | `navigator.hardwareConcurrency`, `deviceMemory` (preset choice), `navigator.language` (UI language), GPU renderer name (shown in Settings). None is stored beyond settings or sent anywhere. | `src/main/game.js:36,116,170`; `i18n.js:35`; `ui.js:503` |
| Multiplayer identity | Name = chosen nickname, else claude.ai profile name, else "Explorer". Published in lobby presence at boot, also when hosting is off. The durable platform id (`by`) of each guest is the key under which the host's save keeps the guest's inventory/health/xp/spawn; when `by` is null the guest's *name* becomes the key. | `src/main/mp.js:65,81-83,87`; `net.js:25-27`; `mp.js:183-184,212-214`; persisted by `game.js:510-517` |
| What presence carries (~10 Hz, to everyone in the session) | nickname, in-game position/rotation, flags (flying/sneaking/swinging/dead), held item id, mode, health, ship, avatar look indices (suit, hair, hair style, skin tone, lashes). | `src/main/mp.js:534-545` |
| What messages carry | `welcome`: world name, seed, mode, host name, host position, world style; `chat`: ≤ 200 chars, control chars stripped; `pdata`: inventory etc. guest → host; block diffs. All ≤ 4 KiB JSON through the platform's lobby room. | `src/main/mp.js:12-29,185-193,436-447,325-331` |
| Guest side | The guest's browser stores a world entry named "<world> · with <host name>". | `src/main/game.js:445` |
| Who can connect | Signed-in members of the owner's organisation and invited guests; public-link visitors cannot (`room` returns null → "Multiplayer · not available here"). Event topics are admin-only unless opened to Contributors at publish time; the code handles `not_permitted` with a hint. | platform `room.d.ts` (Who is here / Who may SEND); `src/main/mp.js:133`; `ui.js:32,384` |
| Platform side-channel | The platform may hand a viewer's **own** lobby presence object to that viewer's own Claude conversation (never to others). | `room.d.ts` header comment |
| Export / import | 📦 r9-paket = favourites + house/furniture designs + Bauteile (no names, no ids); `.schem/.vox/.json` = block data; images are processed locally (`new Image()` on the dropped file). Downloads go through the `downloads` capability (viewer confirms) or an `<a download>`. | `src/main/pack.js:45-48`; `bridge.js:27-41`; `workbench.js:427-441`; `imagine.js:44` |
| Screenshots | Overlay only on claude.ai; `<a download>` only when not embedded. | `src/main/game.js:881-893`, `build.js:39` |
| Children | No age gate, no age question, no data collection. The all-ages spec explicitly targets children and grandparents. | `all-ages-workflow-design.md:9,15` |
| Content | Cartoon combat (blasters, lasers, raider drones), death messages, hunger; no blood, no gambling, no purchases. | `README.md:589-607`; `ui.js:366` |

---

## 2 · Risk table

Risk: **none / low / medium / high** = likelihood × consequence for a free hobby game. Effort: **S** < 2 h · **M** half a day · **L** more.

| # | Area | What the code actually does (evidence) | Risk | What to change | Effort |
|---|---|---|---|---|---|
| 1 | **GDPR/DSGVO — data in the browser** | Saves, settings, favourites, drafts only in the player's own IndexedDB/localStorage (`storage.js:7-31`, `game.js:33,43`); nothing reaches the owner. The owner is not a controller for this data at all. | none | Keep. Mention it in the Datenschutzerklärung (§4.2) so the "we collect nothing" claim is explicit. Optional "delete everything" button (to-do 12). | S |
| 2 | **GDPR — multiplayer profile names** | claude.ai profile name read at boot (`net.js:25-27`) and broadcast to the lobby before any player action (`game.js:154-155`, `mp.js:69-83`); shown to the other admitted viewers (`ui.js:386`); "Friends can join" = off does not stop it (`mp.js:81-82` publishes `n` regardless). The platform's own design prefers resolving names from ids (`profiles()`), the code ships the string instead (`net.js:34` helper exists but is unused). Only invited people ever see it. | low (lawful among invitees; not privacy-by-default; real names of parents when children play) | One-time notice before the first `presence` with a nickname field and "Multiplayer aus"; publish `n` only after that; default to a nickname rather than the profile name; expose the hidden `r9si.mp=off` switch (`net.js:125`). Optionally display names via `profiles(by)` so nobody can impersonate another viewer's name. | M |
| 3 | **GDPR — host/guest sync, IP exposure, data leaving** | No peer-to-peer connection exists; everything is relayed by claude.ai's room service, so **players never see each other's IP**. Anthropic sees IPs/accounts as the hosting platform under its own privacy policy (controller for EEA users: Anthropic Ireland Ltd, Dublin). The host's save stores each guest's inventory/health/xp keyed by the guest's opaque platform id or name (`mp.js:183-184,212-214`); the guest stores the host's name in a world title (`game.js:445`). Both are private persons playing with friends → household exemption, Art. 2(2)(c) DSGVO. | low | Say in the Datenschutzerklärung what is exchanged and that it stays between the invited players and claude.ai. Surface and allow deletion of stored guest records (to-do 8). | S–M |
| 4 | **TDDDG § 25 — consent for localStorage/IndexedDB** | Storage holds only what the player explicitly asks the game to keep (worlds, settings, drafts, language, favourites). No identifiers for tracking, no third-party access, no cookies (grep: `document.cookie` absent). | none | No banner. Justification: § 25 Abs. 2 Nr. 2 TDDDG — storage "unbedingt erforderlich, damit der Anbieter … einen vom Nutzer ausdrücklich gewünschten digitalen Dienst zur Verfügung stellen kann". A game save, the chosen language and the graphics preset are exactly that; the settings page already discloses it (`ui.js:545`). Keep it that way: no analytics, no fingerprinting-style ids. | — |
| 5 | **Impressum (Germany)** | No Impressum, no Datenschutz page, no owner name anywhere in the pages (`ui.js:46-160`, `build.js` Studio header). The game is reachable by everyone with the link. | **medium** | § 5 DDG: not required (no *geschäftsmäßiges* offering: no income, no ads, no affiliate links). § 18 Abs. 1 MStV: **required** — name + ladungsfähige Anschrift, "leicht erkennbar, unmittelbar erreichbar und ständig verfügbar" (≤ 2 clicks, labelled "Impressum"), because a public game does not serve *exclusively* personal/family purposes (the exemption is read narrowly). Not required: e-mail (recommended anyway), phone, USt-ID, § 18 Abs. 2 MStV "Verantwortlicher" (not journalistic), VSBG/ODR texts (consumers' dispute bodies apply to Unternehmer only; the EU ODR platform was shut down in 2025). → 📜 screen with the §4.1 text, linked from the title screen, the pause menu and the Studio header. | S |
| 6 | **COPPA (US) / children** | The owner collects no personal information from anyone (no server). Multiplayer names/chat exist but only between people the owner invited on claude.ai, i.e. adult account holders (claude.ai requires 18+). No marketing to children, no age question. | low | No age gate is needed: COPPA duties attach to *collecting* personal information from children under 13; nothing is collected, and the game is not "directed to children" by its marketing (keep it that way: don't advertise it as "for kids" with cartoon mascots in app-store-style listings — the 2025 COPPA amendments add marketing materials and audience of similar services to the "directed to children" factors). Keep multiplayer invite-only; add a parents' note (§4.2 §7). If one day a public lobby is opened: nickname-only, chat off by default, mute/report. | S |
| 7 | **UK Children's Code / GDPR-K / other age rules** | Same facts as #6. | none | The Code applies to services that process personal data; here none is processed by the owner. Art. 8 DSGVO (consent of children) is not triggered because nothing relies on consent. Australia's under-16 rule targets social-media platforms, not games. Keep the "no data" architecture; the all-ages spec must not add accounts/analytics. | — |
| 8 | **Copyright — look-alike, block names, "Minecraft"** | 257 block definitions carry Minecraft Wiki page names (`blocks1.js:173-180,213-218`, `blocks2.js:110,234-247,296-300`); internal ids = Minecraft ids; export writes `minecraft:` (`schem.js:93-99`); README says the roster was "researched from the block wiki's navigation groups" (`README.md:6-7`) and reads "Minecraft block names" (`README.md:209-210`); Studio file dialogs name WorldEdit/Amulet/Axiom/MCEdit/MagicaVoxel (`workbench.js:3,635,639`, `imagine.js:385`); four milestone titles equal Minecraft advancements (`codex.js:13,14,16,35`); mechanics (crafting table from four planks, furnace, emerald trading, bone meal) follow the genre. Textures, models, sounds are original and procedural. | low (compilation / "clone" perception, not asset copying) | Game mechanics, rules and single names are not copyrightable (US: idea/expression; DE: § 2 UrhG protects expression, not Spielregeln). Risks sit in (a) saying publicly that the list was taken from the wiki (its texts are CC BY-NC-SA — fine as long as no wiki *text* is copied; none was found) and (b) Mojang's brand rules. Do: add the disclaimer line wherever "Minecraft" appears (README, Studio file help, Credits): *"NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT."*; reword `README.md:6-7`; rename the four milestone titles; keep tool names (nominative use for file compatibility is allowed, "Minecraft" must never be part of the game's name). Optional: rename the `wiki:` field to something neutral — it is internal (used only in `schem.js:97`). | S |
| 9 | **Trademark — real companies' product names** | "Signus", "Black Label" shown as skin names (`src/studio/studio.js:34`; ids in `gen_plan.js:41,60`), "Bel Portale", "Sanssoucis", "Palais Royal" as house names (`studio.js:23-27`, `notes.md:57`); comments naming Kern-Haus, Stilhaus, OKAL and their models ship inside the public HTML (`gen_plan.js:4-20,101,182,208`); README states the plans were rebuilt after those companies' ranges (`README.md:61-97`). | low–medium | Under § 14 MarkenG a mark is infringed only by use *im geschäftlichen Verkehr*; a free hobby game is not that, and the goods differ. But floor plans/architecture can be protected works (§ 2 Abs. 1 Nr. 4 UrhG) and naming the sources invites a letter. Rename "Signus" → own name (e.g. "Weiß · Anthrazit"), "Black Label" → e.g. "Schwarzkubus", "Bel Portale" → own name; keep "Sanssoucis"/"Palais Royal"/"Toscana" only if you accept they are also product names (they are generic words/places, lower risk). Rewrite comments and README as "inspired by typical German Stadtvillen / prefab catalogues" without company names. | S |
| 10 | **Trademark — the game's own names** | "R9-SI", "Voxel Realm", "Starforge Edition", in-game "Starforge" tech. | low | "STARFORGE" (CodeHatch's voxel game) was abandoned at the USPTO in 2016; "Starforge Systems" sells gaming PCs (different goods). No use in trade → no infringement; if the game ever becomes commercial, do a DPMA/EUIPO search first and consider dropping "Starforge" from the *title*. | — |
| 11 | **Fonts (OFL 1.1)** | Four OFL fonts embedded; copyright strings and OFL URL preserved in the woff2 name tables (checked); the subsetting was done by Google Fonts, not by the owner; no font is sold. Credit only in the repo (`LICENSES.md`). | low | OFL §2 asks that "each copy contains the above copyright notice and this license" (stand-alone text, header or metadata viewable by the user). Add the §4.3 Credits text (copyright lines + OFL link) to the 📜 screen. Never rename or sell the fonts; the CSS `font-family` names are fine. | S |
| 12 | **Other copied code/assets** | None found (see §0). The trailer video `Trailer of R9-SI.mp4` (`TRAILER.md:3`) is outside the repo. | none / unknown | If the trailer is published, confirm who made it and under which terms (a generated video's tool licence, music, voices). | — |
| 13 | **Import feature — licence tiers and credits (planned)** | Spec §1: tiers Frei (CC0/PD/own), Frei mit Namensnennung (CC-BY), Nur für dich (QAL, Sketchfab Standard, Mixamo…), refused (NC/ND/SA/unknown/rips); credits screen; 📦 carries credit; "Nur für dich" never shared (`…import-atmosphere-design.md:21-32,104`). Quaternius QAL v1.0 (28 Aug 2026) confirmed: use in projects allowed, "no credit required", no redistribution of assets as assets. | low (good design) | (a) CC-BY credit must contain **T-A-S-L**: title, author, source link, licence (with link) **and** a note that the work was modified ("als Voxelmodell umgesetzt"); store the licence *version* (3.0/4.0). (b) A voxelised model is an *adaptation*: CC-BY-SA would force SA on the pack and CC-BY-ND forbids sharing it — refusing both is right; CC-BY-NC would be usable in a free game but blocks any future commercial use — refusing it is the safe default. (c) The "Woher ist es?" answer is an attestation; keep the sentence "wir können das nicht prüfen" and show the tier on the card forever. (d) Sketchfab "Standard" also forbids giving the model to third parties → tier "Nur für dich" is correct; Sketchfab CC models carry licence metadata — pre-fill, do not trust. (e) For `.vox` files from MagicaVoxel the licence belongs to the author of the file, not the tool — same dialog. | M (in the spec) |
| 14 | **Export / share — packs, .schem, Bild → 3D** | Packs and structures are block data; a user can export block art made from someone else's photo or a voxelised third-party model and give it away; no hint exists (`bridge.js:45`, `workbench.js:427`, `imagine.js:385`). | low | One line at every export: "Teile nur, was dir gehört — Bilder und Modelle anderer brauchen deren Erlaubnis." Once imports exist: strip tier "Nur für dich" from packs (spec does this) and carry the credits block inside the pack and show it on import. The owner is not liable for what players share; the hint is good practice (and what the all-ages audience needs). | S |
| 15 | **Accessibility — EAA 2025 / BFSG** | Hobby game, free, no contract, no sales. | none | BFSG (in force 28 June 2025) covers specific products and services, among them "Dienstleistungen im elektronischen Geschäftsverkehr" = telemedia offered with a view to concluding a consumer contract; a free game concludes none, and Kleinstunternehmen (< 10 staff, ≤ €2 M) are exempt from the service duties anyway. Not applicable; the all-ages work (large text, no timers, reduced motion via `prefers-reduced-motion` in the atmosphere spec) is voluntary and good. | — |
| 16 | **claude.ai artifact terms** | Publishing is governed by Anthropic's Consumer Terms (users 18+, indemnity for IP and legal violations, "do not infringe IP … rights of publicity or privacy") and the Usage Policy (no IP infringement, no impersonation of humans, no sexualisation of minors, no deceptive content). The help centre adds: "Only open shared artifacts from people you trust", "Some artifacts save information that everyone who opens them can see", signed-in viewers can copy a published artifact. No written artifact-specific content rules beyond these were found. | low | The game complies: no impersonation of a real organisation (no Minecraft/Mojang branding, logo or textures), no data collection, no credential/payment forms. Do not advertise the game *to* children on claude.ai (accounts are 18+); the public link may be opened without an account, so children can play single-player — fine. Keep the Studio private. Put the copyright notice in the page (to-do 6) because copying is one click away. | S |
| 17 | **Chat safety / moderation** | Free text ≤ 200 chars, no filter, no mute, no report (`mp.js:436-447`). Audience: invited friends only. | low | For the all-ages goal add 🔇 mute per player and a host-side "chat off" switch; a report button is not needed while rooms stay invite-only. If a public lobby is ever opened, UK Online Safety Act / EU DSA questions appear — avoid that without a plan. | S–M |
| 18 | **Project licence / copyright notice** | No `LICENSE`, no © in the pages, no `<meta name="author">`. `release.sh` prepares a public GitHub repo. | low | Add a © line to the title footer and the Studio header, and a `LICENSE` (or `COPYRIGHT.md` with "Alle Rechte vorbehalten") before the GitHub release. If the repo goes to GitHub Pages, that site needs the same Impressum/Datenschutz screen and a line that GitHub logs IP addresses (GitHub is the hoster there). | S |
| 19 | **Inaccurate statements in texts** | README says "everyone who opens the game's link can see the worlds … and join" (`README.md:516-517`); `MP_OFF_HTML` says "open the game on claude.ai while signed in" (`ui.js:32`) — but only invited accounts can connect. | low | Reword both: "players the owner invited on claude.ai (Contributor/Editor)". Accurate texts keep the privacy notice truthful. | S |
| 20 | **Publish-time configuration not in the repo** | Which `room` topics are opened to Contributors and which `user` scopes are declared lives only in the publish call. | low | Record it in the repo (e.g. `docs/publish.md`: `room: { topics: { hello, req, edit, chat, pdata, bye: "interact" } }`, `user: { scopes: ["profile"] }`) so the Datenschutzerklärung and the code stay in sync. | S |
| 21 | **Other regimes checked** | DSA (owner is no intermediary; Anthropic hosts), EU AI Act (no AI in the product since v0.37), Cyber Resilience Act (non-commercial), P2B, Fernabsatz/consumer law (no contract), GEMA (no third-party music; the generative music is the owner's), JuSchG/JMStV (mild cartoon combat; no rating duty for free online games; nothing *entwicklungsbeeinträchtigend*), PEGI/USK (voluntary). | none | Nothing to do. | — |

---

## 3 · Notes per area

### 3.1 GDPR/DSGVO

- **Role of the owner.** Without a server the owner processes no personal data of players. For the multiplayer exchange the owner only *configured* what the page sends; the processing itself runs on Anthropic's platform between the host's and the guests' browsers. Even if a supervisory authority took the CJEU "fan page" line (joint responsibility of a page operator on a platform), the activity is a private person playing with invited friends — Art. 2(2)(c) DSGVO. The Datenschutzerklärung in §4.2 is therefore voluntary transparency, not a hard duty — but it costs nothing and answers every parent's question.
- **What a careful notice must say** (all verified in the code): local saves; no cookies/tracking; hosting by Anthropic with its own policy; multiplayer: name (profile or nickname), avatar look, in-game position, held item, chat, world name/seed, inventory of guests; only between invited players; relayed by Anthropic; not stored by the owner; the host's browser keeps guests' inventory; platform may show your own presence to your own Claude; exports are files the player creates.
- **International transfer** happens inside Anthropic's service (SCCs/adequacy per its policy) — nothing the owner transfers.
- **Privacy by default (Art. 25).** The one thing to fix is the automatic name broadcast at page open (to-do 2).

### 3.2 TDDDG (ex-TTDSG) § 25

Storing or reading information on the end-user's device needs consent **unless** it is strictly necessary for a service the user explicitly asked for (§ 25 Abs. 2 Nr. 2). Every key the game writes is a game function the player triggered (save a world, set a preset, choose a language, favourite a block, keep a draft). There is no identifier that is read for any other purpose, nobody else can read it, and nothing is sent. So: no consent banner — a banner for necessary storage is not required (DSK Orientierungshilfe Telemedien) and would only confuse players.

### 3.3 Impressum

- **§ 5 DDG** (ex-§ 5 TMG): applies to digital services offered *geschäftsmäßig, in der Regel gegen Entgelt*. A free game with no ads, no affiliate links, no donations button and no shop is not that. (The moment you add a donate link, ads or a shop, § 5 DDG applies fully: then also e-mail and, for any business, more.)
- **§ 18 Abs. 1 MStV**: every provider of telemedia "die nicht ausschließlich persönlichen oder familiären Zwecken dienen" must keep **Name und Anschrift** easily recognisable, directly reachable and permanently available. The exemption is read narrowly (private communication in other people's forums, a family site). A game link for the whole planet is a public offer → the duty applies, enforcement by the Landesmedienanstalt (Ordnungswidrigkeit, § 115 MStV).
- **Minimal content for a private person**: first and last name, a full postal address where legal documents can be served (a P.O. box is not enough), an e-mail address (recommended; required only under § 5 DDG). No phone, no USt-IdNr., no Handelsregister, no "Verantwortlicher i.S.d. § 18 Abs. 2 MStV", no VSBG/ODR sentence.
- **Placement**: a button/link labelled "Impressum" (or "📜 Rechtliches" that opens a screen whose tabs are labelled Impressum · Datenschutz · Credits) reachable from the title screen and the pause menu (≤ 2 clicks), in the Studio from the header. A link to an external page would also do, but the artifact cannot know it is reachable, so keep the text inside the page.
- **If you do not want your home address in a game for the whole planet**: the duty does not disappear, but options exist — an "ladungsfähige Anschrift" can be a c/o address you actually control (e.g. an Impressum service / a relative's address with their consent); or keep the game private/invite-only (then it serves personal purposes). Ask a lawyer about the c/o route.

### 3.4 Children (COPPA, UK Code, GDPR-K)

- COPPA applies to operators that *collect* personal information from children under 13 (or have actual knowledge of doing so). Nothing is collected; even the multiplayer exchange runs only among adult claude.ai account holders the owner invited. No verifiable parental consent, no privacy notice duties under COPPA. Caveat: the 2025 amendments (compliance by 22 April 2026) count marketing materials and the audience of similar services when judging "directed to children" — so do not market the game as a kids' product on third-party sites while it has any sharing feature.
- UK Age Appropriate Design Code: a code for services *processing* children's personal data; without processing there is nothing to conform to. Its spirit (high privacy by default, no nudging, no profiling) is met once to-do 2 is done.
- Anthropic's Consumer Terms require account holders to be 18+. A child can open the public link without an account and play single-player; multiplayer requires an adult's account. Say this in the parents' note; never ask children to sign up.
- Youth protection (JMStV): the content is mild cartoon combat; no measures needed. A voluntary note "ab 6" is fine; do not claim a USK rating you do not have.

### 3.5 Copyright and trademark

- **What is protected**: concrete expression — textures, models, sounds, music, texts, logos, the Minecraft name/logo and character names as trademarks. **Not protected**: game mechanics, rules, genre conventions, lists of block *kinds*, single descriptive names ("Smithing Table", "Lectern", "Copper Grate"), file formats.
- **Minecraft**: the only mentions are in README and the Studio's file help (tool names). Mojang's usage guidelines allow descriptive, honest references ("compatible with WorldEdit .schem files") if the disclaimer is shown prominently on "product, listing, description, website". Add it. Never put "Minecraft" into the game name, tags or keywords; never use the logo font, "Creeper", "Steve", textures or sounds (none are used).
- **Minecraft Wiki**: its text is CC BY-NC-SA 3.0. The code copies no wiki text (checked codex, tooltips, milestone texts); the `wiki:` field holds page *names*. Fine. Rewording `README.md:6-7` avoids implying the wiki's structure was copied.
- **German house companies**: see table #9. The protected thing could be the architectural design (a *Werk der Baukunst*, § 2 Abs. 1 Nr. 4 UrhG) if the game reproduces a recognisable, original design; block approximations of standard prefab villas are far from that, but publicly crediting the companies as the source is unnecessary and invites attention. Trademarks: no use in trade → no infringement; renaming three product-like names removes even the argument.
- **"Starforge"**: see #10.
- **Milestone titles**: four identical to Minecraft advancements — rename ("Stone Age" → "First Stone", "Hot Stuff" → "Fired Up", "Diamonds!" → "Blue Fire", "Sweet Dreams" → "Good Night").

### 3.6 Licences of what is bundled

Only the four fonts. OFL 1.1 in one paragraph: you may bundle, embed, subset and redistribute; you must keep the copyright notice and the licence with the font (metadata or text); you may not sell the font by itself; a *modified* font may not use the Reserved Font Name (Orbitron declares one; the Google-Fonts subset is distributed by Google with the authors' consent, you did not modify it; the CSS family name is not the font's internal name). The §4.3 Credits text satisfies the notice requirement; `LICENSES.md` already exists in the repo.

### 3.7 Import feature — details that matter

1. **Credit format** for CC-BY (one line per Ding, in the game, in the Studio and inside a shared pack):
   `„Deer" von Kenney (kenney.nl/assets/…) · CC BY 4.0 (creativecommons.org/licenses/by/4.0) · geändert: als Voxelmodell umgesetzt`
2. **Pack import** must show the credits it carries and refuse packs that contain a Ding whose tier is `local` (the spec strips it on export; a hand-edited file could still carry one).
3. **Sketchfab**: CC-licensed downloads carry `asset.extras` with author/licence — pre-fill, let the player confirm. Models under Sketchfab's "Standard" licence (paid) → tier "Nur für dich".
4. **Mixamo** characters/animations: usable in your own projects, not redistributable as assets → "Nur für dich". **Quaternius** QAL v1.0 (verified 2026-08-28): same tier; the licence requires no credit.
5. **CC0 & public domain**: no credit required; the spec lists them anyway — good practice, keep.
6. **Own photos → Blockbild / 3D aus Ansichten**: the player is the author; photos of other people or of artworks are the player's responsibility — the share hint covers it.
7. **Sound packs** ("Aufnahmen", CC0 from BigSoundBank/Freesound): CC0 — list them in Credits anyway with source links; check each file's licence individually (Freesound mixes CC0, CC-BY and CC-BY-NC).

### 3.8 claude.ai specifics worth knowing

- A published artifact can be copied by any signed-in viewer → treat the HTML as public source.
- "Anyone with the link" viewers may be signed out → no `room`, no `user`: the page must (and does) work alone.
- Guests invited by e-mail see other guests' names only when the platform shows them; the game ships name strings itself, so everyone in the lobby sees everyone's chosen/profile name.
- The platform never hands names to the owner's Claude session; only a viewer's own presence may reach that viewer's own conversation.

---

## 4 · Ready-to-paste German texts

Placeholders in square brackets must be filled by the owner — never invent them. Keep the texts in the page (a 📜 screen), not behind an external link.

### 4.1 Impressum (minimal, private person, § 18 Abs. 1 MStV)

```
Impressum

Angaben gemäß § 18 Abs. 1 Medienstaatsvertrag (MStV)

[Vorname Nachname]
[Straße Hausnummer]
[PLZ Ort]
Deutschland

Kontakt: [E-Mail-Adresse]

R9-SI und R9 Studio sind ein privates, nicht-kommerzielles Hobbyprojekt. Es gibt keine
Werbung, keine Bezahlfunktionen und keine Nutzerkonten. Die Seiten werden als „Artifact“
auf claude.ai (Anthropic) bereitgestellt; Anthropic ist nicht der Anbieter dieses Spiels.

Hinweis zu Marken: R9-SI ist ein eigenständiges Spiel. Es ist kein offizielles
Minecraft-Produkt und wird weder von Mojang noch von Microsoft genehmigt oder unterstützt.
Minecraft ist eine Marke von Mojang AB. Genannte Werkzeuge und Dateiformate (WorldEdit,
Amulet, Axiom, Litematica, MagicaVoxel) sind Marken ihrer jeweiligen Inhaber und werden nur
zur Beschreibung der Dateikompatibilität genannt.
```

If the game ever earns money (ads, donations, a shop), replace the first line by „Angaben gemäß § 5 DDG und § 18 Abs. 1 MStV“ and add what § 5 DDG requires for your legal form (at least e-mail; for a business also the rest).

### 4.2 Datenschutzerklärung

```
Datenschutzerklärung für R9-SI und R9 Studio

Stand: [Datum]

1. Verantwortlicher
[Vorname Nachname], [Straße Hausnummer], [PLZ Ort], E-Mail: [E-Mail-Adresse]

2. Das Wichtigste in Kürze
R9-SI ist ein Browserspiel ohne eigenen Server. Es gibt keine Konten, keine Anmeldung,
keine Werbung, keine Analyse- oder Tracking-Werkzeuge, keine Cookies und keine Bezahl-
funktionen. Das Spiel erhebt keine personenbezogenen Daten und sendet keine Daten an
mich. Alles, was du im Spiel machst, wird ausschließlich in deinem eigenen Browser
gespeichert. Nur wenn du mit eingeladenen Freunden zusammen spielst, werden Spieldaten
und dein Anzeigename über die Server der Plattform claude.ai zwischen den beteiligten
Spielern ausgetauscht (siehe Abschnitt 5).

3. Hosting durch claude.ai (Anthropic)
Das Spiel und das Studio werden als „Artifact“ auf claude.ai bereitgestellt. Betreiber
der Plattform ist Anthropic (für Nutzer im EWR, in Großbritannien und der Schweiz:
Anthropic Ireland, Limited, 6th Floor, South Bank House, Barrow Street, Dublin 4,
D04 TR29, Irland; sonst Anthropic PBC, 548 Market St, PMB 90375, San Francisco,
CA 94104, USA). Beim Aufruf der Seite verarbeitet Anthropic als eigenständiger
Verantwortlicher die technisch notwendigen Verbindungsdaten (z. B. IP-Adresse,
Browser- und Gerätedaten, Zeitpunkt des Aufrufs) und – sofern du dort angemeldet bist –
deine Kontodaten. Ich habe auf diese Verarbeitung keinen Einfluss und erhalte diese Daten
nicht. Es gilt die Datenschutzerklärung von Anthropic:
https://www.anthropic.com/legal/privacy (Datenschutzbeauftragter: dpo@anthropic.com).

4. Speicherung in deinem Browser (keine Cookies)
Das Spiel speichert Spielstände (Welten), Einstellungen (Grafik, Steuerung, Lautstärke,
Sprache, dein gewählter Spielername, das Aussehen deiner Spielfigur), Favoriten, Entwürfe
und Bauteile des Studios ausschließlich lokal in deinem Browser (IndexedDB „r9si“ und
localStorage mit dem Präfix „r9si.“). Diese Daten verlassen dein Gerät nicht, werden nicht
an mich oder Dritte übermittelt und dienen keiner Wiedererkennung über das Spiel hinaus.
Die Speicherung ist unbedingt erforderlich, um den von dir gewünschten Dienst – ein Spiel
mit Spielständen – bereitzustellen (§ 25 Abs. 2 Nr. 2 TDDDG); eine Einwilligung ist dafür
nicht nötig. Du kannst alle Daten jederzeit löschen: Welten über „Welt wählen → Delete“,
alles andere über die Funktion „Website-Daten löschen“ deines Browsers (oder [sobald
vorhanden: Einstellungen → „Alle Spieldaten löschen“]). Zur Wahl der Startsprache und der
Grafikvoreinstellung liest das Spiel einmalig die Sprach- und Leistungsangaben deines
Browsers (Sprache, Anzahl der Prozessorkerne, Arbeitsspeicher, Grafikchip); diese Werte
werden nur lokal verwendet.

5. Zusammen spielen (Mehrspieler) – nur mit eingeladenen Spielern
Mehrspieler ist nur möglich, wenn der Inhaber des Spiels dich auf claude.ai zu diesem
Artifact eingeladen hat und du dort angemeldet bist. Wer den öffentlichen Link ohne
Einladung öffnet, spielt allein; es werden dann keine Daten ausgetauscht.
Beim Zusammenspielen werden folgende Daten über die Echtzeit-Infrastruktur von claude.ai
zwischen den Browsern der beteiligten Spieler ausgetauscht:
– dein Anzeigename (der Name, den du in den Einstellungen wählst; ist keiner gesetzt, der
  Anzeigename deines claude.ai-Profils),
– das Aussehen deiner Spielfigur, deine Position und Blickrichtung im Spiel, das
  gehaltene Werkzeug, Lebenspunkte, Spielmodus und ein eventuell geflogenes Schiff,
– Chatnachrichten, die du im Spiel schreibst,
– Name, Startwert (Seed) und Blockänderungen der Welt sowie – bei Gästen – das eigene
  Inventar, das der Gastgeber für den nächsten Besuch in seiner Welt aufbewahrt.
Die Daten werden nicht von mir gespeichert. Sie sind nur für die Spieler sichtbar, die
dasselbe Spiel geöffnet haben, und werden gelöscht, sobald du die Seite verlässt. Der
Gastgeber speichert das Inventar seiner Gäste lokal in seinem Browser, zugeordnet zu einer
pseudonymen Kennung der Plattform; eine Welt zu löschen löscht auch diese Einträge. Es
besteht keine direkte Verbindung zwischen den Browsern der Spieler; IP-Adressen werden
anderen Spielern nicht bekannt. Die Plattform kann dir deinen eigenen Spielstatus in deinem
eigenen Claude-Gespräch anzeigen; anderen Nutzern wird er nicht weitergegeben.
Du kannst Mehrspieler in den Einstellungen ausschalten („Friends can join my worlds“ bzw.
„Multiplayer aus“) und jederzeit einen Spitznamen statt deines Profilnamens wählen.

6. Dateien, die du erzeugst
Exporte (📦 r9-paket, .schem, .vox, .json, Screenshots) sind Dateien, die du selbst
erzeugst und speicherst. Sie enthalten Spielinhalte (Blöcke, Designs, Favoriten), keine
Namen und keine Kennungen. Was du davon weitergibst, entscheidest du.

7. Kinder und Jugendliche
Das Spiel erhebt keine Daten – auch nicht von Kindern. Ein Altersnachweis ist deshalb nicht
nötig. Hinweis für Eltern: Der öffentliche Link kann ohne Konto geöffnet werden (Einzel-
spieler). Für das Zusammenspielen ist ein claude.ai-Konto nötig; Anthropic verlangt dafür
ein Mindestalter von 18 Jahren. Im Mehrspieler ist der Anzeigename für die anderen
eingeladenen Spieler sichtbar und es gibt einen Textchat zwischen diesen Spielern.

8. Deine Rechte
Da ich keine personenbezogenen Daten von dir verarbeite, kann ich dir weder Auskunft
erteilen noch Daten löschen – es gibt bei mir keine. Für die Verarbeitung durch Anthropic
(Konto, Verbindungsdaten) wende dich bitte an Anthropic (siehe Abschnitt 3). Im Übrigen
stehen dir die Rechte aus Art. 15–22 DSGVO zu; Beschwerden nimmt jede Datenschutz-
aufsichtsbehörde entgegen, z. B. die für [Bundesland] zuständige Landesbeauftragte.

9. Änderungen
Wenn das Spiel neue Funktionen bekommt, die etwas an dieser Erklärung ändern (z. B. der
geplante Import von 3D-Modellen oder ein optionales Klangpaket, das beim Einschalten von
einem Server geladen wird), wird diese Erklärung aktualisiert; das Datum oben zeigt den
Stand.
```

**English short version** (the game UI is English; show it on the same screen under the German text or as a second tab):

```
Privacy in short — R9-SI stores everything (worlds, settings, favourites, drafts) only in
your own browser (IndexedDB/localStorage). No accounts, no cookies, no analytics, no ads,
no payments; nothing is sent to the author. The page is hosted on claude.ai by Anthropic,
which processes connection data under its own policy (anthropic.com/legal/privacy).
Multiplayer works only between players the owner invited on claude.ai: your display name
(your chosen nickname, otherwise your claude.ai profile name), avatar look, in-game
position, chat messages and world data are relayed through claude.ai between those players
and are not stored by the author; the host keeps guests' inventories in the host's browser.
Players never see each other's IP address. Files you export (packs, .schem, .vox,
screenshots) are yours. Children: nothing is collected; multiplayer needs an adult's
claude.ai account. Contact: [e-mail].
```

### 4.3 📜 Credits

```
📜 Credits

R9-SI · Voxel Realm und R9 Studio
© [Jahr] [Vorname Nachname]. Alle Rechte vorbehalten.
Spielcode, Weltgenerator, Texturen, Modelle, Klänge und Musik sind selbst gemacht
und werden beim Start prozedural erzeugt. Es sind keine fremden Bibliotheken,
Bilder oder Tondateien enthalten.

Schriften (SIL Open Font License 1.1)
Die folgenden Schriften sind in die Seite eingebettet. Sie stehen unter der SIL Open
Font License, Version 1.1 (https://openfontlicense.org), die das Bündeln mit Software
erlaubt; die Schriften werden nicht verkauft und sind unverändert (Teilmenge der
Google-Fonts-Ausgabe).
– Orbitron — Copyright 2018 The Orbitron Project Authors
  (https://github.com/theleagueof/orbitron), with Reserved Font Name "Orbitron".
– Rajdhani — Copyright (c) 2014, Indian Type Foundry (info@indiantypefoundry.com).
– Sora — Copyright 2019 The Sora Project Authors (https://github.com/sora-xor/sora-font).
  (R9 Studio)
– JetBrains Mono — Copyright 2020 The JetBrains Mono Project Authors
  (https://github.com/JetBrains/JetBrainsMono). (R9 Studio)
This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is available with a FAQ at: https://openfontlicense.org

Marken und Kompatibilität
R9-SI ist ein eigenständiges Spiel, inspiriert vom Genre der Block-Sandbox-Spiele.
NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR
MICROSOFT. Minecraft ist eine Marke von Mojang AB. WorldEdit, Amulet, Axiom, Litematica
und MagicaVoxel sind Marken ihrer Inhaber; das Studio liest und schreibt ihre Dateiformate.

Importierte Dinge (deine Modelle)                              [Platzhalter – automatisch]
Hier listet das Spiel jedes importierte Modell, das du mit einer freien Lizenz übernommen
hast, in dieser Form:
– „[Titel]“ von [Autor] ([Link zur Quelle]) · [Lizenz, z. B. CC BY 4.0]
  ([Link zur Lizenz]) · geändert: als Voxelmodell umgesetzt
– „[Titel]“ · CC0 / Public Domain · von [Autor] ([Link])
– „[Titel]“ · nur lokal (Lizenz erlaubt keine Weitergabe) – erscheint nicht in 📦 Paketen
Du bist dafür verantwortlich, dass die angegebene Lizenz stimmt; das Spiel kann sie nicht
prüfen.

Klangpaket „Aufnahmen“ (optional)                              [Platzhalter]
– „[Dateiname]“ von [Autor] ([Link]) · CC0 1.0
(Wird nur geladen, wenn du es in den Einstellungen einschaltest.)

Dank
[optional: Namen von Testern, Freunden – nur mit deren Einverständnis]
```

---

## 5 · Prioritised to-do list for the code

**P0 — before the public launch**

1. **📜 Rechtliches screen** — new shared module `src/ui/legal.js` (bundled into `MAIN` and `studioLibs` in `build.js:21,45`) exporting `VR.Legal.open('impressum' | 'datenschutz' | 'credits')`; texts from §4 as `de`/`en` tables through `VR.I18N`; a `📜` button in the title menu (`src/main/ui.js:53-58`), a line in the pause menu (`ui.js:117-129`), a `📜` in the Studio header (`build.js` `studioBody` `<header>`), and the planned start screen of the all-ages spec. Impressum must be ≤ 2 clicks from everywhere and labelled "Impressum". Credits fed by `VR.Credits.list()` once the import feature exists (spec §1).
2. **Name consent before the first presence** — `src/main/mp.js:69-83`: do not publish `n` until `settings.mpNoticeSeen`; on the first `renderHosts()` with `mp.ready` show a one-time card: "Mit Freunden spielen: Dein Name „[name]“ wird für eingeladene Spieler sichtbar. [Name ändern] [OK] [Multiplayer aus]"; default the nickname to the profile name but let the player change it right there; "Multiplayer aus" sets the existing `r9si.mp = 'off'` (`net.js:125`) and gets a toggle in Settings → Game (`ui.js:542-543`). Also stop publishing `n` when `mpHost === false` and no session is active (`mp.js:81-82`). Optional: render others' names via `T.names(by)` (`net.js:34`) instead of the shipped string.
3. **Remove company/product names** — `src/shared/gen_plan.js:4-20,101,182,208` (rewrite comments without Kern-Haus/Stilhaus/OKAL and their model names), `src/studio/studio.js:34` (`SKIN_NAME.signus` → "Weiß · Anthrazit", `blacklabel` → "Schwarzkubus"; the ids `signus`/`blacklabel` in `gen_plan.js:41,60` may stay — they are saved in designs), `src/studio/studio.js:23` ("Bel Portale" → own name; `fam` ids may stay), `README.md:61-97` (replace "after the Kern-Haus range …", "(after Stilhaus)", "OKAL-style" by "inspired by typical German prefab Stadtvillen"), `src/studio/notes.md:57`. Saved worlds are unaffected (names are display strings).
4. **Minecraft wording + disclaimer** — `README.md:6-7` ("a full block roster researched from the block wiki's navigation groups" → "a full block roster of the genre"), `README.md:209-210` keep the compatibility sentence and add the disclaimer line from §4.1 under the "Files" paragraph; the same line in the Studio file help note (`src/studio/workbench.js:639`) or on the 📜 Credits tab; rename the four milestone titles (`src/main/codex.js:13,14,16,35`). Optional: rename the `wiki:` field (`registry.js:126`, `schem.js:97`, 257 definitions) to `ref:`.
5. **Share hint on every export** — one `note()` line at `src/studio/bridge.js:45` (📦), `src/studio/workbench.js:427` (⬇ .schem/.vox/.json) and `src/studio/imagine.js:385`: "Teile nur, was dir gehört — Bilder und Modelle anderer brauchen deren Erlaubnis." With the import feature: packs strip tier `local` (spec) and the pack reader (`src/main/pack.js:51-66`) shows the carried credits and refuses a `local` entry.
6. **Copyright notice** — footer line `© [Jahr] [Name]` next to "Original voxel game …" (`src/main/ui.js:62`) and in the Studio header; a `LICENSE` or `COPYRIGHT.md` in the repo ("Alle Rechte vorbehalten" or a chosen open licence) before `release.sh` publishes to GitHub; `<meta name="author">` in `build.js` heads.

**P1 — soon after**

7. **Fonts credit** — part of to-do 1 (§4.3 text); keep `src/ui/fonts/LICENSES.md` in sync.
8. **Guest records** — `src/main/mp.js:212-214`: show "Gespeicherte Gäste: n" with a delete button in the pause → Multiplayer panel (`ui.js:441-443`), and drop the name-keyed fallback (`'n:' + name`) in favour of not storing when `by` is null.
9. **Mute + chat switch** — `src/main/mp.js:441-447`: a `muted` set checked in `onChat`; a 🔇 per row in `buildMpPanel` (`ui.js:434-447`); host setting "Chat aus" that drops `chat` messages for the session.
10. **Truthful texts** — `src/main/ui.js:32` (`MP_OFF_HTML`): "Multiplayer is only available to players the game's owner invited on claude.ai."; `README.md:516-517`: same; `ui.js:545` add "Nothing is sent anywhere."
11. **Document the publish declaration** — `docs/publish.md` with the exact `capabilities` used for the artifact (`room` topics opened to `interact`, `user` scopes `["profile"]`, `downloads`), and a note that the Studio stays private.
12. **"Alle Spieldaten löschen"** — Settings → Game (`ui.js:544-545`): remove `r9si.*` localStorage keys and `indexedDB.deleteDatabase('r9si')` after a two-click confirm; the Studio's `space.js:62` already knows the keys.

**P2 — with the next features**

13. **Import feature** (per spec, plus §3.7): record licence *and version*, T-A-S-L credit with "geändert", tier shown on every card forever, `local` never in packs, pack reader shows credits, Sketchfab/`asset.extras` pre-fill with confirmation, per-file licence for `.vox`.
14. **Sound pack "Aufnahmen"** — when it ships, the page makes its first network request (`assets/sounds/` next to `dist`): update §4.2 (§9 already announces it), list every file with author/licence in Credits, and host the files where no third party logs the fetch (or inline them).
15. **Parents' note on the start screen** of the all-ages spec (one line linking to 📜 Datenschutz §7).
16. **Trailer video** — before publishing `Trailer of R9-SI.mp4`, note its origin and terms in `docs/legal/`.
17. **GitHub Pages** — if `release.sh`'s repo goes live: the same 📜 screen is inside `index.html` already; add one sentence to §4.2 §3 naming GitHub, Inc. as hoster of that copy (IP logs under GitHub's privacy statement).

---

## 6 · Verification log (what was checked, how)

- Branch `v039`, HEAD `a6acbfe`, working tree clean. Files: `src/main` (69), `src/shared` (53), `src/studio` (23), `src/worker` (1), `src/ui` (4), `build.js`, `README.md` (688 lines), `src/studio/notes.md`, specs.
- `grep -rnoE "https?://…" src build.js` → only `openfontlicense.org` and the artifact URL. `grep` for `fetch(|XMLHttpRequest|WebSocket|sendBeacon|importScripts|RTCPeerConnection|EventSource|document.cookie|geolocation|mediaDevices|speechSynthesis|Gamepad` → none (only `navigator.language/hardwareConcurrency/deviceMemory`, local use).
- `dist/artifact.html`, `dist/studio_artifact.html`, `dist/index.html`: 0 matches for `http(s)://` outside the artifact URL; 0 for `fonts.googleapis|fonts.gstatic`.
- Fonts: 4 + 2 `@font-face`, all `data:font/woff2`; name tables read with fontTools: copyright strings and `http(s)://scripts.sil.org/OFL` present in every file; glyph counts 187–394 (Google subsets).
- Licence/vendor scan: `copyright|©|licen[cs]e|MIT|BSD|GPL|Apache|@author|define.amd|module.exports|webpack|THREE|three.js|…` → no hits in `src/` except fonts; no `data:image|audio` URIs; no base64 literals > 400 chars outside the fonts; no binary assets in `src/`.
- Names: `grep -i minecraft|mojang|creeper|…` → no UI text; `wiki:` field count 257 (`blocks1.js` 37, `blocks2.js` 143, `blocks3.js` 77); `schem.js` `minecraft:` namespace; `codex.js` milestone titles.
- Companies: `kern-?haus|stilhaus|okal|signus|bel portale|sanssoucis|palais royal|black label` → `gen_plan.js`, `studio.js`, `notes.md`, `README.md` as cited.
- Capabilities: `use('room')` ×1, `use('user')` ×1, `use('downloads')` ×2; no `sample`, `db`, `mcp`, `artifact`, `sendToClaudeSession`.
- Platform contract (`room.d.ts`, `user.d.ts`, runtime 0.2.66): public-link/signed-out viewers cannot connect; event topics admin-only unless opened to `interact`; `by` is an opaque id, never an e-mail; names only via `profiles()` under scope `profile`; the viewer's own presence may be handed to the viewer's own Claude.

## 7 · Sources consulted (2026-10-07)

- Anthropic Consumer Terms (updated 2025-10-08): age 18+, IP/indemnity clauses — https://www.anthropic.com/legal/consumer-terms
- Anthropic Usage Policy — https://www.anthropic.com/legal/aup
- Anthropic Privacy Policy (effective 2026-09-10): controllers, DPO, transfers — https://www.anthropic.com/legal/privacy
- Claude Help Center, "Share artifacts" (who can view, copy, stored information warning) — https://support.claude.com/en/articles/9547008-publishing-and-sharing-artifacts
- Minecraft Usage Guidelines (naming, disclaimer, brand assets) — https://www.minecraft.net/en-us/usage-guidelines
- § 18 MStV text — https://lxgesetze.de/mstv/18 ; NLM Leitfaden Impressumspflicht 2024 (narrow private-purpose exemption, two-clicks rule, § 115 MStV) — https://www.nlm.de/fileadmin/dateien/pdf/leitfaden_impressumspflicht_2024.pdf ; WBS on § 5 DDG — https://www.wbs.legal/medienrecht/webseiten/impressum
- § 25 TDDDG text — https://lxgesetze.de/tdddg/25
- BFSG scope and micro-enterprise exemption — https://www.activemind.legal/de/guides/bfsg/
- COPPA Rule amendments 2025 (effective 2025-06-21, compliance 2026-04-22; "directed to children" factors) — https://www.kirkland.com/publications/kirkland-alert/2025/04/ftc-publishes-coppa-rule ; Federal Register — https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule
- Quaternius Asset License v1.0 (2026-08-28) — https://quaternius.com/license.html
- OFL copyright lines of the four fonts — https://github.com/google/fonts (ofl/orbitron, ofl/rajdhani, ofl/sora, ofl/jetbrainsmono `OFL.txt`)
- STARFORGE trademark (CodeHatch, serial 85956618, abandoned 2016) — https://trademarks.justia.com/859/56/starforge-85956618.html
