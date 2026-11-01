// The game's own names (f-names; plan docs/superpowers/plans/2026-10-23-f-names.md §1; review docs/reviews/v0.49.md
// R50-07). Every invented proper name a player meets is in NAMES with the day it was searched (WebSearch: as a brand,
// as a game item, as a trademark word in toys, games and software) and what was found there. Checks:
//   1. the list: a German and an English spelling, the day it was checked (YYYY-MM-DD, not in the future), by whom,
//      what was found; each spelling is still the game's (a table value or the sources) — the list stays true
//   2. the retired words — Sterntaler (the brand of a German maker of baby and children's goods and toys), Sky Ray /
//      Skyray (a creature in several games) and its German Himmelsrochen — are in no value of either table, in no item
//      name and in no string the sources write (comments aside; ids such as sky_ray stay: never shown, kept in saves)
//   3. the new names stand where the old ones stood: the Heliataler in the ring's, the banner's, the quests' and the
//      shops' texts of both tables, the Wolkenrochen / Cloud Ray in the creature's, the codex's, Funke's and the switch's
//      texts; the spawn egg reads „Cloud Ray Egg"; the coin's icon shows Helia (a sun), not a star
//   bash test/wt_run.sh names.js 300
const fs = require('fs'), path = require('path');
require('./load_shared.js');
require('../src/shared/pets.js');
require('../src/main/i18n.js');
require('../src/main/lang_en.js');
require('../src/main/lang_de.js');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };

// ---------------------------------------------------------------- the list
// what: what it names in the game · by: who searched it (the critic of v0.49 or f-names) · found: what the search showed
const NAMES = [
  { de: 'Heliataler', en: 'Heliataler', role: 'currency', what: 'the Abenteuer\'s coin (after Helia, the sun)', checked: '2026-10-22', by: 'f-names', found: 'no product, game or currency of that name; game currencies called Taler/Thaler exist (a generic word), the prefix is ours. English keeps the proper noun: „Helia coin" would read like a small crypto token\'s ticker HELIA' },
  { de: 'Wolkenrochen', en: 'Cloud Ray', role: 'ray', what: 'the great rays between the Sky Isles (t-wild)', checked: '2026-10-22', by: 'f-names', found: 'no game, toy or app creature of either name; one fan-made homebrew stat block on D&D Beyond; „Cloudray" (one word) is a maker of laser-engraver parts' },
  { de: 'Helia', en: 'Helia', what: 'the sun of Herzwelt (u-orbit)', checked: '2026-10-22', by: 'critic v0.49 · f-names', found: 'a given name, an Australian mortgage insurer, a moth and a plant genus, a cartoon character\'s first name — no game or toy product' },
  { de: 'Turmalin', en: 'Tourmaline', role: 'giant', what: 'the ringed giant, Herzwelt\'s parent (n-names; replaces Amarant / Amaranth: a Final Fantasy IX character\'s name and two spellings in the English table, R54-13 / R55-14). The many-coloured gem: its bands and rings', checked: '2026-10-31', by: 'n-names', found: 'a mineral word in both languages (like Opal, Basalt); WebSearch „Turmalin" OR „Tourmaline" planet game character: only fan-made gem characters and a lore entry naming the gem — no planet, game or brand of that name' },
  { de: 'Herzwelt', en: 'Heartworld', what: 'the home world', checked: '2026-10-22', by: 'critic v0.49', found: 'no product or game of that name' },
  { de: 'Aquamarin', en: 'Aquamarine', what: 'Herzwelt\'s moon', checked: '2026-10-22', by: 'critic v0.49', found: 'a mineral word' },
  { de: 'Zinnober', en: 'Cinnabar', what: 'the volcanic moon', checked: '2026-10-22', by: 'critic v0.49', found: 'a mineral and pigment word' },
  { de: 'Opal', en: 'Opal', what: 'the ice moon', checked: '2026-10-22', by: 'f-names', found: 'a mineral word (a game\'s „Opal" item is the mineral too)' },
  { de: 'Basalt', en: 'Basalt', what: 'the cratered moon', checked: '2026-10-22', by: 'f-names', found: 'a rock word' },
  { de: 'Ocker', en: 'Ochre', what: 'the dust moon', checked: '2026-10-22', by: 'f-names', found: 'a pigment word' },
  { de: 'Glutsee', en: 'Glow Lake', what: 'Zinnober\'s lava lake by the landing (u-moons2)', checked: '2026-10-30', by: 'u-moons2', found: 'no game, product or brand of either name; a seasonal Fortnite area was called „The Glow" (another name) — a descriptive word pair' },
  { de: 'Rostschlucht', en: 'Rust Gorge', what: 'Ocker\'s canyon (u-moons2)', checked: '2026-10-30', by: 'u-moons2', found: 'no game or product of either name; „Rust" is a survival game\'s title and a town (a plain word here, as in the colour of iron oxide)' },
  { de: 'Bernstein', en: 'Amber', what: 'the hothouse planet', checked: '2026-10-22', by: 'f-names', found: 'an ordinary word' },
  { de: 'Cölestin', en: 'Celestine', what: 'the ice giant', checked: '2026-10-22', by: 'critic v0.49', found: 'a mineral word' },
  { de: 'Trümmerschwarm', en: 'Rubble Swarm', what: 'the swarm of rubble round Helia', checked: '2026-10-22', by: 'critic v0.49', found: 'no product or game of that name' },
  { de: 'Turmgänger', en: 'Tower Walker', role: 'boss', what: 'the first boss: a four-legged worker machine with a lantern tower at a region\'s Kernfeuer (a-rpg)', checked: '2026-10-30', by: 'a-rpg', found: 'no game, toy or product of either name; „Walker" machines exist in several games (Sanctum, Deadlock) and a boss called „Tower" in The House of the Dead — other names; a descriptive word pair of ours' },
  { de: 'Kernfeuer', en: 'Core Beacon', role: 'place', what: 'a region\'s central beacon the Turmgänger guards (a-rpg)', checked: '2026-10-30', by: 'a-rpg', found: 'no game, product or brand of that name (a user name on a games platform); „core beacon" a plain technical word pair' },
  { de: 'Funke', en: 'Funke', what: 'the companion drone (e-funke)', checked: '2026-10-22', by: 'f-names', found: 'no game companion of that name; an ordinary word (spark) and a surname; a German media group is called FUNKE (publishing, not games) — no action' },
  { de: 'Weißstadt', en: 'Weißstadt', what: 'the hall city (the code\'s name for it)', checked: '2026-10-22', by: 'f-names', found: 'only the Bavarian town Weißenstadt' },
  { de: 'Nova Haven', en: 'Nova Haven', what: 'the terraced city of the trailer', checked: '2026-10-22', by: 'f-names', found: 'no game place of that name' },
  { de: 'Driftinseln', en: 'Drift Isles', what: 'the gate world of drifting isles (u-dims)', checked: '2026-10-22', by: 'f-names', found: 'no German hit; in English a 2025 drift-racing game is titled DRIFT ISLAND and a fan map is called „Drift Isle" — a descriptive name of another meaning; flagged for the owner' },
  { de: 'Fotomodus', en: 'Photo mode', what: 't-first\'s photo mode', checked: '2026-10-22', by: 'critic v0.49', found: 'a generic word' },
  // v0.51's names (f-rules; review docs/reviews/v0.51.md R52-01; plan docs/superpowers/plans/2026-10-29-f-rules.md)
  { de: 'Nordwiese', en: 'Northmeadow', role: 'outpost', what: 'an outpost (replaces „Nordwind", a WWII operation\'s name — review R52-01)', checked: '2026-10-29', by: 'f-rules', found: 'no game, brand or toy of either spelling; Sternenwiese is a campsite (another word)' },
  { de: 'Kupferhang', en: 'Copperslope', role: 'outpost', what: 'an outpost', checked: '2026-10-29', by: 'f-rules', found: 'no product or game of that name' },
  { de: 'Sternwiese', en: 'Starmeadow', role: 'outpost', what: 'an outpost (replaces „Sternwacht": no watch/guard words)', checked: '2026-10-29', by: 'f-rules', found: 'no game or brand; a German campsite is called Sternenwiese — a meadow word' },
  { de: 'Frühlicht', en: 'Dawnlight', role: 'outpost', what: 'an outpost (replaces „Morgenrot", the title of a 1933 propaganda film)', checked: '2026-10-29', by: 'f-rules', found: 'ordinary words; no game place or product of note; ESO has „Dawnwood" (another word)' },
  { de: 'Silbergrat', en: 'Silverridge', role: 'outpost', what: 'an outpost', checked: '2026-10-29', by: 'f-rules', found: 'a landscape word; real places called Silver Ridge — no game or brand' },
  { de: 'Funkenfeld', en: 'Sparkfield', role: 'outpost', what: 'an outpost', checked: '2026-10-29', by: 'f-rules', found: 'no game, brand or toy' },
  { de: 'Weitblick', en: 'Farview', role: 'outpost', what: 'an outpost', checked: '2026-10-29', by: 'f-rules', found: 'ordinary words' },
  { de: 'Glimmerhöhe', en: 'Glimmerheight', role: 'outpost', what: 'an outpost', checked: '2026-10-29', by: 'f-rules', found: 'no hit; Everdell sells a „Glimmergold" pack (another word)' },
  { de: 'Abendtau', en: 'Evendew', role: 'outpost', what: 'an outpost', checked: '2026-10-29', by: 'f-rules', found: 'no hit' },
  { de: 'Wolkenrast', en: 'Cloudperch', role: 'outpost', what: 'an outpost (English not „Cloudrest": a trial in The Elder Scrolls Online)', checked: '2026-10-29', by: 'f-rules', found: 'no hit for Cloudperch' },
  { de: 'Lichtung', en: 'Brightglade', role: 'outpost', what: 'an outpost', checked: '2026-10-29', by: 'f-rules', found: 'a German forest word; no game or brand of Brightglade' },
  { de: 'Steinbogen', en: 'Stonearch', role: 'outpost', what: 'an outpost', checked: '2026-10-29', by: 'f-rules', found: 'a landscape word' },
  { de: 'Bernsteinkamm', en: 'Ambercrest', role: 'outpost', what: 'an outpost', checked: '2026-10-29', by: 'f-rules', found: 'no game or brand of note; an itch.io model is „Embercrest" (another word)' },
  { de: 'Himmelsau', en: 'Skymead', role: 'outpost', what: 'an outpost (replaces „Himmelstor": no gate/heaven cult echo)', checked: '2026-10-29', by: 'f-rules', found: 'no hit; a student itch.io project is „Project Skyvale", so not Skyvale' },
  { de: 'Westhain', en: 'Westgrove', role: 'outpost', what: 'an outpost (replaces „Westwacht": a Wehrmacht-era word)', checked: '2026-10-29', by: 'f-rules', found: 'no game place; Neverwinter Nights 2 has „Westgate" (another word)' },
  { de: 'Taufeld', en: 'Dewfield', role: 'outpost', what: 'an outpost', checked: '2026-10-29', by: 'f-rules', found: 'no hit' },
  { de: 'Ruhestrahler', en: 'Calm Beam', role: 'blaster', what: 'the tool that puts confused machines to rest (replaces „Pulse Blaster" / „Pulsblaster")', checked: '2026-10-29', by: 'f-rules', found: 'no game item, toy or brand of either spelling (calming baby toys exist, other words)' },
  { de: 'Eiswächter', en: 'Ice Keeper', role: 'keeper', what: 'the sleeper under Opal\'s ice (ch. 4; English was „Ice Warden")', checked: '2026-10-29', by: 'f-rules', found: 'no game boss of that name; „Core Keeper" is a game (another word) — no action' },
  { de: 'Wächter', en: 'Keeper', role: 'sentry', what: 'the outposts\' sentry machine (English was „Warden")', checked: '2026-10-29', by: 'f-rules', found: 'ordinary words' },
  { de: 'Bohrläufer', en: 'Drill Walker', role: 'driller', what: 'a foe machine', checked: '2026-10-29', by: 'f-rules', found: 'no game enemy of that name' },
  { de: 'Kranarm', en: 'Crane Arm', role: 'crane', what: 'a foe machine', checked: '2026-10-29', by: 'f-rules', found: 'an ordinary machine word' },
  { de: 'Dämmerdrohne', en: 'Dusk Drone', role: 'drone', what: 'a foe machine (was „Schattendrohne / Shadow Drone": a trading card of that name)', checked: '2026-10-29', by: 'f-rules', found: 'no game or card of either spelling' },
  { de: 'Schattenwesen', en: 'Dusk Wisp', role: 'wisp', what: 'a foe (English was „Shadow Wisp": ≈ „Shade Wisp" in Wildfrost)', checked: '2026-10-29', by: 'f-rules', found: 'German an ordinary word; no game enemy „Dusk Wisp"' },
  { de: 'Solgani', en: 'Solgani', role: 'speaker', what: 'a Glutani of Zinnober, keeper of the glass beacon (story ch. 5, a-story3)', checked: '2026-10-31', by: 'a-story3', found: 'no game, toy or brand of that name (searched with game/character/brand/toy: only unrelated „Sol…" figures)' },
  { de: 'Ariveli', en: 'Ariveli', role: 'speaker', what: 'a Wellari of Aquamarin (story ch. 6–8, a-story3; „Moriel" was set aside — too near a game character\'s name)', checked: '2026-10-31', by: 'a-story3', found: 'no game, toy or brand of that name; baby-name pages list similar names (Arivaali) — no action' },
  { de: 'Selkatun', en: 'Selkatun', role: 'speaker', what: 'a Regoli waiting under two suns (story ch. 8, a-story3; „Torvi" was set aside — a TV series character)', checked: '2026-10-31', by: 'a-story3', found: 'no game, toy or brand of that name (the search showed only the unrelated Selket)' },
  { de: 'Opa Anselm', en: 'Grandpa Anselm', role: 'speaker', what: 'Lumi\'s grandfather, who built Funke (story ch. 6–7, a-story3)', checked: '2026-10-31', by: 'a-story3', found: 'Anselm is an ordinary German given name — no game character of that role; no action' },
  { de: 'Lumi', en: 'Lumi', role: 'speaker', what: 'the girl from Nova Haven (story ch. 4)', checked: '2026-10-29', by: 'f-rules', found: 'a Finnish given name (snow); small indie games and a virtual actress share it — a given name, no action' },
  { de: 'Meisterin Ilka', en: 'Chief Ilka', role: 'speaker', what: 'a story speaker', checked: '2026-10-29', by: 'f-rules', found: 'a given name; no game character' },
  { de: 'Kapitän Jonte', en: 'Captain Jonte', role: 'speaker', what: 'a story speaker', checked: '2026-10-29', by: 'f-rules', found: 'a given name; no game character' },
  { de: 'Ringstation', en: 'Ringstation', role: 'station', what: 'the station over the air (story ch. 3; the geostationary wheel of u-stations)', checked: '2026-10-31', by: 'f-rules · u-stations', found: 'a generic word; searched again 2026-10-31 as a game, brand and trademark: nothing of that name (near: Ring doorbells, Ringworld, Ring of Elysium)' },
  // f-stipple2 (the owner's note: „Starforge" is also the title of a 2014 voxel game)
  { de: 'Sternglut', en: 'Sternglut', role: 'tech', what: 'the tech category, the outposts\' maker, the classic shuttle\'s livery, the title\'s edition line (replaces „Starforge"; the keys stay starforge)', checked: '2026-10-29', by: 'f-stipple2', found: 'no game, brand or product of that name (searched „Sternglut" with game/Spiel/Marke; „Zenitwerk" near the Zenit camera maker and „Funkenwerk" near our own Funke were set aside)' },
  { de: 'Ankerstiefel', en: 'anchor boots', role: 'boots', what: "the suit's boots that hold you on a rubble body (u-fields)", checked: '2026-10-30', by: 'u-fields', found: 'only historic boots with anchor decorations in museum catalogues and on eBay — no game item, toy or brand' },
  { de: 'Spaltmond', en: 'Gap Moon', role: 'moonlet', what: "the moonlet in Amarant's ring gap (u-fields)", checked: '2026-10-30', by: 'u-fields', found: 'no game, item or product of either name (results only for the Gap clothing brand and unrelated moon games)' },
  { de: 'Glimmspat', en: 'Glowspar', role: 'ore', what: "the glowing crystal ore of the rubble bodies (u-fields2)", checked: '2026-10-30', by: 'u-fields2', found: 'no game item, brand or toy of either spelling (WebSearch „Glimmspat" OR „Glowspar" game item brand: only unrelated Glimmies toys, Glowsphere and Glimmer items in other games)' },
  { de: 'Reiseantrieb', en: 'Cruise drive', role: 'drive', what: "u-cruise's drive", checked: '2026-10-29', by: 'f-rules', found: 'generic words' },
  // f-first (review v0.52 R53-01): the ship liveries that were English-only and older than the list
  { de: 'Nachtmohn', en: 'Nightpoppy', role: 'livery', what: 'a dark ship livery with magenta lights (replaces „Nightwing", a DC Comics superhero and trademark)', checked: '2026-10-30', by: 'f-first', found: 'no game, ship skin, brand or toy of either spelling (WebSearch „Nachtmohn" OR „Night Poppy" game ship skin brand; „Nightpoppy")' },
  { de: 'Mittagsglanz', en: 'Noonglow', role: 'livery', what: 'a white ship livery with red and yellow stripes (replaces „Sunstrike": a trademark of a gaming company and a role-playing setting\'s name)', checked: '2026-10-30', by: 'f-first', found: 'no game or brand of either spelling (WebSearch „Mittagsglanz" OR „Nachtmohn" Spiel Marke; „Noonglow" game brand)' },
  { de: 'Karminflotte', en: 'Carmine Fleet', role: 'livery', what: 'a red ship livery (replaces „Crimson Fleet", a pirate faction of a 2023 space game)', checked: '2026-10-30', by: 'f-first', found: 'no game or brand of either spelling (WebSearch „Carmine Fleet" OR „Karminflotte" game)' },
  { de: 'Leuchtpfad', en: 'Beacon Path', role: 'network', what: 'the gate network you travel by without piloting (e-portal: the Gate Temple\'s portal, 🌍 Reisen, K)', checked: '2026-10-31', by: 'e-portal', found: 'no game, app, toy or brand of either name; „Beacon Patrol" is a board game (a different word); the obvious „Sternentor" was not taken — it is the common German rendering of a film franchise\'s gate' },
  // a-story4: the speakers of chapters 9–12
  { de: 'Flimmi', en: 'Flimmi', role: 'speaker', what: 'a star being born in a nebula — the one the beacons were calling (story ch. 9–12, a-story4)', checked: '2026-10-31', by: 'a-story4', found: 'no game, toy or brand of that name (WebSearch „Flimmi" game OR toy OR character: only unrelated „Flim", „Glimmies", „Flummis")' },
  // a-fairy's names (docs/superpowers/plans/2026-10-31-a-fairy.md): the fairy-tale folk and the tree
  { de: 'Flausel', en: 'Flausel', role: 'folk', what: 'the small forest folk of the enchanted places (a-fairy; from German „Flausen", whims)', checked: '2026-10-31', by: 'a-fairy', found: 'no game, toy or character of that name (WebSearch „Flausel" game OR toy OR character: only unrelated plush listings)' },
  { de: 'Schlummerbaum', en: 'Slumber Tree', role: 'place', what: 'the sleeping giant tree with the tiny folk village (a-fairy)', checked: '2026-10-31', by: 'a-fairy', found: 'no game place or brand (WebSearch „Schlummerbaum" fairy game: only „Der Traumzauberbaum", a German children\'s music brand — another word, avoided)' },
  { de: 'Tüpfel', en: 'Tüpfel', role: 'speaker', what: 'the shy Flausel of the Slumber Tree (a-fairy)', checked: '2026-10-31', by: 'a-fairy', found: 'an ordinary German word (a dot); no game character (WebSearch „Tüpfel" game character fairy: no hit)' },
  { de: 'Zwirbel', en: 'Zwirbel', role: 'speaker', what: 'the cheeky Flausel of the Wishing Spring (a-fairy)', checked: '2026-10-31', by: 'a-fairy', found: 'an ordinary German word (a twirl); no game character (same search: no hit)' },
  { de: 'Dusel', en: 'Dusel', role: 'speaker', what: 'the sleepy Flausel at the cloud bridge (a-fairy)', checked: '2026-10-31', by: 'a-fairy', found: 'an ordinary German word (a doze, luck) — no action' },
  { de: 'Silbrin', en: 'Silbrin', role: 'speaker', what: 'the wise Flausel of the Moonstone Circle (a-fairy)', checked: '2026-10-31', by: 'a-fairy', found: 'no game, character or brand (WebSearch „Silbrin" game OR character OR brand: only other names such as Ibrin, Silabus)' },
  { de: 'Flöckchen', en: 'Flöckchen', role: 'speaker', what: 'the lost little spirit of the mushroom wood (a-fairy)', checked: '2026-10-31', by: 'a-fairy', found: 'an ordinary German diminutive (a little flake) — no action' },
  { de: 'Mutter Borke', en: 'Mother Bark', role: 'speaker', what: 'the elder of the tree village (a-fairy)', checked: '2026-10-31', by: 'a-fairy', found: 'ordinary words — no action' },
  { de: 'Dumarin', en: 'Dumarin', role: 'speaker', what: 'a Dunelin under the red dwarf (story ch. 10–11, a-story4; from the Dunelin\'s syllables du·mar·in)', checked: '2026-10-31', by: 'a-story4', found: 'no game character, toy or brand of that name (the search showed only unrelated Durbe, Darum, Dumon)' },
  { de: 'Ylosenis', en: 'Ylosenis', role: 'speaker', what: 'a Nivari from the ice of the night side (story ch. 10–11, a-story4; ylo·sen·is)', checked: '2026-10-31', by: 'a-story4', found: 'no result of that name at all' },
  { de: 'Die geduldige Sonne', en: 'The Patient Sun', role: 'chapter', what: 'chapter 10\'s title (a red dwarf: such stars burn for trillions of years)', checked: '2026-10-31', by: 'a-story4', found: 'no game or book of either title (only unrelated „The Patient" games and books)' },
  // u-worlds: the native species of the five worlds (worldeco.js, their names in both tables: g.eco.sp.*)
  { de: 'Wellari', en: 'Wellari', role: 'species', what: 'the shell folk of Aquamarin\'s islands (u-worlds)', checked: '2026-10-31', by: 'u-worlds', found: 'no game, species or brand of that name (WebSearch „Wellari" game OR species OR brand: only the board game Wari and unrelated words)' },
  { de: 'Dunelin', en: 'Dunelin', role: 'species', what: 'the earth folk of Ocker\'s dunes (u-worlds; replaces „Okari", near a creature name of a TV series\' wiki)', checked: '2026-10-31', by: 'u-worlds', found: 'no game, species or brand of that name (WebSearch „Dunelin" game OR species OR brand: the dunlin, a shore bird, and unrelated games)' },
  { de: 'Glimari', en: 'Glimari', role: 'species', what: 'the ember folk of Zinnober\'s sulfur plains (n-names; replaces „Glutani": a fan wiki\'s word, R55-14). After German „glimmen", to glow: their crests glimmer like embers', checked: '2026-10-31', by: 'n-names', found: 'no game, species, toy or brand of that name (WebSearch „Glimari" game OR species OR brand; „Isveli" OR „Glimari": only „Glimmer" items and games, another word). „Lohari" was set aside: too near Lohri, a harvest festival' },
  { de: 'Regoli', en: 'Regoli', role: 'species', what: 'the dome folk of Basalt\'s craters (u-worlds; after regolith)', checked: '2026-10-31', by: 'u-worlds', found: 'no game or species of that name (WebSearch „Regoli": the Italian word for rules, a toy brand „Rigolo" spelled otherwise)' },
  { de: 'Isveli', en: 'Isveli', role: 'species', what: 'the frost folk of Opal\'s ice (n-names; replaces „Nivari": „Nivarians" are a World Anvil species and it is near „Sylvari", R55-14). After „Eis", ice — crisp and clear', checked: '2026-10-31', by: 'n-names', found: 'no game, species, toy or brand of that name (WebSearch „Ysveli" OR „Isveli" game OR character OR brand: unrelated Isabelle, Isvar)' },
  { de: 'Blütenreigen', en: 'Blossom Round', what: "Herzwelt's spring festival (w-seasons)", checked: '2026-11-01', by: 'w-seasons', found: 'no game, product or brand of either name; flower board games (Blossoms, Bloom) and a Prinzessin Lillifee book „Das Blütenfest“ (why not Blütenfest)' },
  { de: 'Drachenwindtag', en: 'Kite Breeze Day', what: "Herzwelt's summer kite day (w-seasons)", checked: '2026-11-01', by: 'w-seasons', found: "no game or brand of either name; real local „Kite Day“ events (orchards, parks) and Terraria's weather event „Windy Day“ — a different name" },
  { de: 'Laubtafelfest', en: 'Harvest Table Feast', what: "Herzwelt's autumn festival of the long tables (w-seasons; not „Lantern Harvest“ — the board game „Lanterns: The Harvest Festival“)", checked: '2026-11-01', by: 'w-seasons', found: 'no game or brand of either name' },
  { de: 'Lichterbaumnacht', en: 'Night of the Light Tree', what: "Herzwelt's winter night of lights (w-seasons)", checked: '2026-11-01', by: 'w-seasons', found: 'no game or brand; generic „Lantern Night“ events (a college tradition, a Japanese light show) — a different name' },
  { de: 'Gezeitenleuchten', en: 'Tide Glow', what: "the Wellari's festival (w-seasons)", checked: '2026-11-01', by: 'w-seasons', found: 'no game or brand of the German word; „Sea Lights“ is a craft kit — a different name' },
  { de: 'Sandsternnacht', en: 'Sandstar Night', what: "the Dunelin's festival (w-seasons)", checked: '2026-11-01', by: 'w-seasons', found: 'no game, product or brand of either name' },
  { de: 'Funkelreigen', en: 'Sparkle Round', what: "the Glimari's festival (w-seasons)", checked: '2026-11-01', by: 'w-seasons', found: 'no game, product or brand of either name' },
  { de: 'Steinglut', en: 'Stone Ember', what: "the Regoli's festival (w-seasons)", checked: '2026-11-01', by: 'w-seasons', found: 'no game or brand; Noita has an item „Glowing Stone“ — a different name' },
  { de: 'Eisblütennacht', en: 'Ice Bloom Night', what: "the Isveli's festival (w-seasons; not „Frostlicht“ — a D&D one-shot „Frostlight Festival“, a card game's „Frostfestival“)", checked: '2026-11-01', by: 'w-seasons', found: 'no game or brand of either name' },
];
// the words that went: never again in a table, an item name or a string the game writes
const RETIRED = [
  { word: 'Sterntaler', re: /Sterntaler/, why: 'the brand of a German maker of baby and children\'s goods and toys (review R50-07)', now: 'Heliataler' },
  { word: 'Sky Ray', re: /\b[Ss]ky[ -][Rr]ays?\b|\bSkyrays?\b/, why: '≈ „Skyray", a flying creature in several games (review R50-07)', now: 'Cloud Ray' },
  { word: 'Himmelsrochen', re: /Himmelsrochen/, why: 'the literal German of „Sky Ray" — retired with it', now: 'Wolkenrochen' },
  // f-rules (review v0.51 R52-01)
  { word: 'Nordwind', re: /Nordwind/, why: 'the name of a WWII military operation (review R52-01)', now: 'Nordwiese' },
  { word: 'Morgenrot', re: /Morgenrot/, why: 'the title of a 1933 propaganda film', now: 'Frühlicht' },
  { word: 'Westwacht', re: /Westwacht|Sternwacht/, why: 'watch/guard words of the war years', now: 'Westhain, Sternwiese' },
  { word: 'Himmelstor', re: /Himmelstor/, why: '≈ „Heaven\'s Gate"', now: 'Himmelsau' },
  { word: 'Pulse Blaster', re: /Puls(e )?[Bb]laster/, why: 'close to known games\' and toys\' blasters (review R52-01)', now: 'Calm Beam / Ruhestrahler' },
  { word: 'Warden', re: /\bWarden\b/, why: 'Ice Warden / Warden: known game creatures (review R52-01)', now: 'Keeper / Ice Keeper' },
  { word: 'Shadow Drone', re: /Shadow Drone|Shadow Wisp|Schattendrohne/, why: 'a trading card; ≈ „Shade Wisp"', now: 'Dusk Drone, Dusk Wisp, Dämmerdrohne' },
  // f-stipple2
  { word: 'Starforge', re: /Starforge/, why: 'the title of a 2014 voxel game (StarForge); the lower-case keys starforge stay', now: 'Sternglut' },
  // f-first (review v0.52 R53-01)
  { word: 'Nightwing', re: /Nightwing/, why: 'a DC Comics superhero and trademark (review R53-01); the lower-case palette key nightwing stays (saved ships)', now: 'Nachtmohn / Nightpoppy' },
  { word: 'Sunstrike', re: /Sunstrike/, why: 'a registered games trademark and a role-playing setting\'s name; the key sunstrike stays', now: 'Mittagsglanz / Noonglow' },
  { word: 'Crimson Fleet', re: /Crimson Fleet/, why: 'a pirate faction of a 2023 space game', now: 'Karminflotte / Carmine Fleet' },
];
// n-names (docs/design/names.md): the pets' names that clashed with the story's speakers
NAMES.push(
  { de: 'Flämmchen', en: 'Flämmchen', role: 'pet', what: 'a glimmer fox\'s name (replaces „Funke": the companion drone\'s name)', checked: '2026-10-31', by: 'n-names', found: 'a German diminutive (little flame); WebSearch „Leuchti" OR „Flämmchen" Spielzeug OR Spiel OR Marke: only lamps and LED toys described with the word — no product of that name' },
  { de: 'Leuchti', en: 'Leuchti', role: 'pet', what: 'a glimmer fox\'s name (replaces „Lumi": the girl of Nova Haven)', checked: '2026-10-31', by: 'n-names', found: 'a German pet word (little light); the same search: no toy, game or brand of that name' },
  { de: 'Lindenau', en: 'Lindenau', role: 'village', what: 'Herzwelt\'s village names are German compounds (VR.Names.village: Linden·au, Mohn·brunn, Lerchen·hain …; Rosenheim, Rosenthal, Silbersee and Sternberg are blocked — a TV series\' town, a porcelain brand, a famous novel\'s lake)', checked: '2026-10-31', by: 'n-names', found: 'real small places carry some compounds (Lindenau in Leipzig) — ordinary German place words; WebSearch „Mohnbrunn" OR „Honigborn" OR „Lerchenhain" game OR Spiel: only old board games of other names' },
);
RETIRED.push(
  { word: 'Amarant', re: /\bAmarant(h|s)?\b/, why: 'a Final Fantasy IX character\'s name; two spellings (R54-13, R55-14); the id amarant stays', now: 'Turmalin / Tourmaline' },
  { word: 'Glutani', re: /Glutani/, why: 'a fan wiki\'s word (R55-14)', now: 'Glimari' },
  { word: 'Nivari', re: /Nivari/, why: '„Nivarians": a World Anvil species; ≈ Sylvari (R55-14)', now: 'Isveli' },
);
// n-names, after the merge of a-fairy and o-wander: the sites of the Heartland that had only a kind word, the Flausel's
// own names (searched 2026-10-31; the children's-book characters Fussel, Zippel, Purzel and Mörike's Wispel set aside)
NAMES.push(
  { de: 'Mohnbühl', en: 'Mohnbühl', role: 'site', what: 'the western Dome Hills village (was „Hügeldorf" / „Hill village" in the Wanderbuch)', checked: '2026-10-31', by: 'n-names', found: 'no game, brand or product; „Lerchenbühl"-like field names exist only as Franconian street and hill names' },
  { de: 'Lerchenbühl', en: 'Lerchenbühl', role: 'site', what: 'the eastern Dome Hills village', checked: '2026-10-31', by: 'n-names', found: 'a hill pass and streets in Franconia (Kulmbach, Heilsbronn) — real field names, no game or brand' },
  { de: 'Sonnenhof', en: 'Sonnenhof', role: 'site', what: 'the farm by the river (was „Bauernhof" / „Farm", four times)', checked: '2026-10-31', by: 'n-names', found: 'a common German farm and inn name — an ordinary word, no game or brand of note' },
  { de: 'Kleehof', en: 'Kleehof', role: 'site', what: 'the western farm', checked: '2026-10-31', by: 'n-names', found: 'a common farm name' },
  { de: 'Lindenhof', en: 'Lindenhof', role: 'site', what: 'the northern farm', checked: '2026-10-31', by: 'n-names', found: 'a common farm, inn and street name' },
  { de: 'Mohnhof', en: 'Mohnhof', role: 'site', what: 'the eastern farm', checked: '2026-10-31', by: 'n-names', found: 'a farm name; no game or brand' },
  { de: 'Hallklamm', en: 'Hallklamm', role: 'site', what: 'the canyon (was „Schlucht" / „Canyon"; Klamm: a gorge, Hall: its echo). „Whisper Gorge" set aside: ≈ Whispering Gorge (FFXIV), Whisper Gulch (WoW)', checked: '2026-10-31', by: 'n-names', found: 'no hit as a name; Austrian gorges are called …klamm (Höllentalklamm) — a landscape word' },
  { de: 'Morgenhain', en: 'Morgenhain', role: 'site', what: 'the grove in the east, where the sun rises (was „Hain" / „Grove")', checked: '2026-10-31', by: 'n-names', found: 'no game, brand or novel of that name' },
  { de: 'Huschel', en: 'Huschel', role: 'flausel', what: 'a Flausel\'s given name (VR.Names.PEOPLES.flausel: Tummel, Huschel, Tröpfel, Summsel …; elders Murmelbart …; families Moostupf, Tauperle …)', checked: '2026-10-31', by: 'n-names', found: 'no children\'s-book or game character (a book „Husch, die Waldfee" — another word); Fussel (a picture book), Zippel (Rühle\'s keyhole ghost), Purzel (a picture book), Wispel (Mörike) were taken out' },
);
NAMES.push(
  { de: 'Leerenschleicher', en: 'Void Slinker', role: 'slinker', what: 'the dark tall creature of the void (English was „Void Stalker": a game\'s title „Void Stalkers", a D&D monster, an ESO „Voidstalker")', checked: '2026-10-31', by: 'n-names', found: 'no game, creature or brand of either name (WebSearch „Void Slinker")' },
  { de: 'Muschelschreiter', en: 'Shell Wader', role: 'wader', what: 'Aquamarin\'s grazing shell creature (English was „Shell Strider": ≈ Horizon Zero Dawn\'s Shell-Walker and Strider)', checked: '2026-10-31', by: 'n-names', found: 'no game creature of either name' },
);
RETIRED.push(
  { word: 'Void Stalker', re: /Void ?[Ss]talker/, why: 'a game title (Void Stalkers), a D&D monster, an ESO creature; the id void_stalker stays', now: 'Void Slinker' },
  { word: 'Shell Strider', re: /Shell Strider/, why: '≈ Horizon Zero Dawn\'s Shell-Walker / Strider machines; the id shell_strider stays', now: 'Shell Wader' },
);
module.exports = { NAMES, RETIRED };
if (require.main !== module && !process.env.NAMES_RUN) return;

const de = VR.I18N.dict.de, en = VR.I18N.dict.en;
const vals = (d) => { const out = []; for (const k in d) for (const s of (Array.isArray(d[k]) ? d[k] : [d[k]])) out.push([k, String(s)]); return out; };
const DE = vals(de), EN = vals(en);
// every source file of the game (the main thread, the workers, the shared code, the Studio, the CSS)
const SRC = [];
const walk = (dir) => { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f), st = fs.statSync(p); if (st.isDirectory()) walk(p); else if (/\.(js|css|html)$/.test(f)) SRC.push(p); } };
walk(path.join(ROOT, 'src'));
const TEXT = SRC.map(p => [path.relative(ROOT, p), fs.readFileSync(p, 'utf8')]);
// a file's code without its comments (a // after a blank or at the line's start, and /* … */) — what it writes, not
// what it says to its developers
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').map(l => l.replace(/(^|\s)\/\/.*$/, '$1')).join('\n');

// ---------------------------------------------------------------- 1 · the list
console.log('1 · the names, each searched once');
{
  const today = new Date().toISOString().slice(0, 10);
  const bad = NAMES.filter(n => !n.de || !n.en || !/^\d{4}-\d{2}-\d{2}$/.test(n.checked || '') || n.checked > today || !n.by || !n.found || !n.what);
  check(NAMES.length >= 15 && !bad.length, NAMES.length + ' names, each with both spellings, the day it was searched, by whom and what was found' + (bad.length ? ': ' + bad.map(n => n.de).join(', ') : ''));
  const all = TEXT.map(([, s]) => s).join('\n'), tab = DE.concat(EN).map(([, s]) => s).join('\n');
  const gone = []; for (const n of NAMES) for (const w of [n.de, n.en]) if (!tab.includes(w) && !all.includes(w)) gone.push(w);
  check(!gone.length, 'every spelling in the list is still the game\'s (a table or the sources)' + (gone.length ? ': not found ' + gone.join(', ') : ''));
  const cur = NAMES.find(n => n.role === 'currency'), ray = NAMES.find(n => n.role === 'ray');
  check(cur && cur.de === 'Heliataler' && ray && ray.de === 'Wolkenrochen' && ray.en === 'Cloud Ray', 'the coin and the ray are listed: ' + (cur ? cur.de : '—') + ' · ' + (ray ? ray.de + ' / ' + ray.en : '—'));
  const dup = NAMES.map(n => n.de).filter((w, i, a) => a.indexOf(w) !== i);
  check(!dup.length, 'no name twice' + (dup.length ? ': ' + dup.join(', ') : ''));
}

// ---------------------------------------------------------------- 2 · the retired words
console.log('2 · the retired words are gone from everything a player reads');
for (const r of RETIRED) {
  const inDe = DE.filter(([, s]) => r.re.test(s)).map(([k]) => k), inEn = EN.filter(([, s]) => r.re.test(s)).map(([k]) => k);
  check(!inDe.length && !inEn.length, '„' + r.word + '" (' + r.why + ') is in no table value' + (inDe.length + inEn.length ? ': de ' + inDe.slice(0, 8).join(', ') + ' · en ' + inEn.slice(0, 8).join(', ') + ' (' + (inDe.length + inEn.length) + ')' : ''));
  const inSrc = [];
  for (const [f, s] of TEXT) { if (/lang_(de|en)\.js$|shared\/names\.js$/.test(f)) continue;   // (n-names: names.js is the table of the renames itself)
    const c = code(s).split('\n'); c.forEach((l, i) => { if (r.re.test(l)) inSrc.push(f + ':' + (i + 1)); }); }
  check(!inSrc.length, '„' + r.word + '" is in no string the sources write (comments aside)' + (inSrc.length ? ': ' + inSrc.slice(0, 8).join(', ') + (inSrc.length > 8 ? ' … (' + inSrc.length + ')' : '') : ''));
}
{
  const items = (VR.ITEM_LIST || []).filter(it => RETIRED.some(r => r.re.test(String(it.name || ''))));
  check(VR.ITEM_LIST && VR.ITEM_LIST.length > 100 && !items.length, 'no item is named with a retired word (' + (VR.ITEM_LIST ? VR.ITEM_LIST.length : 0) + ' items)' + (items.length ? ': ' + items.map(i => i.id + ' = ' + i.name).join(', ') : ''));
}

// ---------------------------------------------------------------- 3 · the new names where the old ones stood
console.log('3 · the Heliataler and the Wolkenrochen / Cloud Ray');
{
  const has = (d, k, w) => (Array.isArray(d[k]) ? d[k] : [d[k] || '']).some(s => String(s).includes(w));
  const COIN = ['g.adv.pauseTip', 'g.adv.taler', 'g.adv.up.gift', 'g.adv.welcomeSub', 'g.adv.offNote', 'g.adv.teaser', 'g.set.advHud', 'g.set.advHud.tip', 'g.q.reward', 'g.shop.have', 'g.shop.note', 'g.shop.each', 'g.shop.poor', 'g.shop.bought', 'g.shop.sold'];
  const missDe = COIN.filter(k => !has(de, k, 'Heliataler')), missEn = COIN.filter(k => !has(en, k, 'Heliataler'));
  check(!missDe.length && !missEn.length, 'the Heliataler in the ring, the banner, the card, the quests\' reward and the shops (' + COIN.length + ' texts, both tables)' + (missDe.length + missEn.length ? ': de ' + missDe.join(', ') + ' · en ' + missEn.join(', ') : ''));
  check(de['g.adv.taler'] === '{n} Heliataler' && en['g.adv.taler'] === '{n} Heliataler', 'the ring\'s and the card\'s amount: „{n} Heliataler" in both languages');
  const nDe = DE.filter(([, s]) => /Heliataler/.test(s)).length, nEn = EN.filter(([, s]) => /Heliataler/.test(s)).length;
  check(nDe >= 15 && nEn >= 15, 'Heliataler in ' + nDe + ' German and ' + nEn + ' English texts');
  check(de['g.mob.sky_ray'] === 'Wolkenrochen' && en['g.mob.sky_ray'] === 'Cloud Ray', 'the creature: „' + de['g.mob.sky_ray'] + '" / "' + en['g.mob.sky_ray'] + '"');
  check(Array.isArray(de['erf.i.himmelsrochen']) && de['erf.i.himmelsrochen'][0] === 'Wolkenrochen' && en['erf.i.himmelsrochen'][0] === 'Cloud Ray', 'the codex\'s invention card: „' + (de['erf.i.himmelsrochen'] || [])[0] + '" / "' + (en['erf.i.himmelsrochen'] || [])[0] + '"');
  check(/^Wolkenrochen/.test(de['g.set.wildRays'] || '') && /^Cloud rays/.test(en['g.set.wildRays'] || '') && /Wolkenrochen/.test(de['g.set.wildRays.tip'] || '') && /cloud rays/.test(en['g.set.wildRays.tip'] || ''), 'the ⚙ switch and its tip: „' + de['g.set.wildRays'] + '" / "' + en['g.set.wildRays'] + '"');
  check(has(de, 'g.funke.wow.skyray', 'Wolkenrochen') && has(en, 'g.funke.wow.skyray', 'cloud ray') && has(de, 'g.funke.wow.rays', 'Wolkenrochen') && has(en, 'g.funke.wow.rays', 'cloud rays'), 'Funke\'s calls: „' + de['g.funke.wow.skyray'][0] + '" / "' + en['g.funke.wow.skyray'][0] + '"');
  check(VR.itemName && VR.itemName('egg_sky_ray') === 'Cloud Ray Egg', 'the spawn egg: „' + (VR.itemName ? VR.itemName('egg_sky_ray') : '—') + '" (its id egg_sky_ray stays: it lives in saved inventories)');
  check(VR.MOB_EGGS && VR.MOB_EGGS.includes('sky_ray'), 'the creature\'s id sky_ray stays (saved entities, codex pages c:sky_ray)');
  // the coin's icon: Helia, a sun with rays — no five-pointed star (the old Sterntaler's mark)
  const STAR = 'M12 5.8L13.47 9.98', icons = [];
  for (const f of ['src/main/adventure.js', 'src/main/shop.js', 'src/main/quests.js']) { const s = fs.readFileSync(path.join(ROOT, f), 'utf8'); icons.push([f, /class="coin"/.test(s), s.includes(STAR), /data-coin="helia"/.test(s)]); }
  check(icons.every(([, c, star, sun]) => c && !star && sun), 'the coin\'s icon is Helia\'s sun in the HUD, the shops and the Tagebuch\'s rewards, the star is gone (' + icons.map(([f, c, star, sun]) => f.split('/').pop() + (sun ? ' sun' : '') + (star ? ' STAR' : '')).join(', ') + ')');
}

// ---------------------------------------------------------------- 4 · the outposts' names (f-rules, R52-01)
console.log('4 · the outposts\' names: keys in both tables, each one listed');
{
  require('../src/main/liberate.js');
  const L = VR.Liberate, K = L.NAME_KEYS || [];
  check(K.length === 16, '16 outpost name keys (the count stays: an outpost keeps its place in the list) — ' + K.length);
  const miss = K.filter(k => typeof de['g.lib.n.' + k] !== 'string' || typeof en['g.lib.n.' + k] !== 'string');
  check(K.length && !miss.length, 'each key g.lib.n.* in both tables' + (miss.length ? ': ' + miss.join(', ') : ''));
  const unl = K.filter(k => !NAMES.some(n => n.role === 'outpost' && n.de === de['g.lib.n.' + k] && n.en === en['g.lib.n.' + k]));
  check(K.length && !unl.length, 'each outpost name is in the list with its search' + (unl.length ? ': ' + unl.join(', ') : ''));
  const I = VR.I18N, was = I.lang, s = { id: '12_-40' };
  I.lang = 'en'; const nEn = L.nameOf(s); I.lang = 'de'; const nDe = L.nameOf(s); I.lang = was;
  check(nEn && nDe && K.some(k => en['g.lib.n.' + k] === nEn && de['g.lib.n.' + k] === nDe), 'nameOf speaks the player\'s language: „' + nDe + '" / "' + nEn + '"');
  const ids = ['0_0', '5_9', '-120_44', '300_-7', '17_17'], idx = ids.map(id => Math.floor(L.rng('name:' + id)() * 16));
  I.lang = 'de'; const same = ids.every((id, i) => L.nameOf({ id }) === de['g.lib.n.' + K[idx[i]]]); I.lang = was;
  check(same, 'the same outpost picks the same slot as before (rng by its id; saves keep only the id)');
  check(en['g.foe.name.sentry'] === 'Keeper' && /Ice Keeper/.test(en['story.c4.b2.3']) && VR.itemName('laser_blaster') === 'Calm Beam' && /Ruhestrahler/.test(de['g.foe.gift']), 'the Keeper, the Ice Keeper, the Calm Beam (id laser_blaster stays), the Ruhestrahler');
}

// ---------------------------------------------------------------- 5 · the ship liveries (f-first, R53-01)
console.log('5 · the ship liveries: a name of the tables in each language, the invented ones listed');
{
  const pals = [];
  for (const P of [VR.Starship && VR.Starship.PAL, VR.ShipGen && (VR.ShipGen.PALETTES || VR.ShipGen.PAL)]) if (Array.isArray(P)) for (const p of P) pals.push(p);
  check(pals.length >= 9, pals.length + ' liveries read (starship.js' + (VR.ShipGen && (VR.ShipGen.PALETTES || VR.ShipGen.PAL) ? ', shipgen.js' : '') + ')');
  const miss = pals.filter(p => typeof de['g.pal.' + p.key] !== 'string' || typeof en['g.pal.' + p.key] !== 'string');
  check(!miss.length, 'every livery has g.pal.<key> in both tables' + (miss.length ? ': ' + miss.map(p => p.key).join(', ') : ''));
  const I = VR.I18N, was = I.lang; I.lang = 'de'; const nDe = VR.palName('nightwing', 'x'); I.lang = 'en'; const nEn = VR.palName('nightwing', 'x'); I.lang = was;
  check(nDe === 'Nachtmohn' && nEn === 'Nightpoppy', 'VR.palName speaks the player\'s language: „' + nDe + '" / "' + nEn + '"');
  const inv = ['nightwing', 'sunstrike', 'crimson'].filter(k => !NAMES.some(n => n.role === 'livery' && n.de === de['g.pal.' + k] && n.en === en['g.pal.' + k]));
  check(!inv.length, 'the invented livery names are listed with their search' + (inv.length ? ': ' + inv.join(', ') : ''));
  const styles = []; for (const t of (VR.Forge && VR.Forge.types) || []) for (const st of t.styles || []) styles.push(st.name);
  const bad = styles.filter(n => RETIRED.some(r => r.re.test(n)));
  check(styles.length > 20 && !bad.length, 'no Forge style is named with a retired word (' + styles.length + ' styles)' + (bad.length ? ': ' + bad.join(', ') : ''));
}

// ---------------------------------------------------------------- 6 · n-names: one table of names (VR.Names)
console.log('6 · n-names: the peoples\' names, the villages, the stars, the renames (VR.Names)');
{
  const N = VR.Names, E = VR.WorldEco, I = VR.I18N;
  check(!!(N && N.pool && N.place && N.village && N.star && N.blocked && N.PEOPLES), 'VR.Names is there (pool, place, village, star, blocked, PEOPLES)');
  const KINDS = ['herz', 'aqua', 'ocker', 'zinn', 'basalt', 'opal'];
  const word = /^[A-ZÄÖÜ][a-zäöüß]{1,11}$/;
  const given = {};
  for (const k of KINDS) {
    const P = N.pool(k), all = P.first.concat(P.kids, P.elders, P.sur);
    const full = new Set(); for (const f of P.first.concat(P.elders)) for (const s of P.sur) full.add(f + ' ' + s);
    check(full.size >= 200 && P.kids.length >= 16 && P.elders.length >= 16 && P.sur.length >= 16, k + ': ' + full.size + ' distinct full names (' + P.first.length + ' given, ' + P.elders.length + ' elders, ' + P.kids.length + ' children, ' + P.sur.length + ' families) — e.g. ' + P.first[0] + ' ' + P.sur[0] + ', ' + P.kids[0] + ', ' + P.elders[0]);
    const odd = all.filter(w => !word.test(w)), bad = all.filter(w => N.blocked(w)), res = all.filter(w => N.reserved(w));
    check(!odd.length && !bad.length && !res.length, k + ': every name one readable word, none on the block list, none a name of the story or the sky' + (odd.length + bad.length + res.length ? ': ' + odd.concat(bad, res).slice(0, 8).join(', ') : ''));
    const sep = P.kids.filter(w => P.first.includes(w) || P.elders.includes(w)).concat(P.elders.filter(w => P.first.includes(w)));
    check(!sep.length, k + ': children and elders have their own names' + (sep.length ? ': ' + sep.join(', ') : ''));
    given[k] = new Set(P.first.concat(P.kids, P.elders));
    const pl = new Set(); for (let i = 0; i < 400; i++) pl.add(N.place(k, i * 7919 + 13));
    const plBad = [...pl].filter(w => !word.test(w.replace(/ /g, '')) || N.blocked(w) || N.reserved(w));
    check(pl.size >= 120 && !plBad.length, k + ': ' + pl.size + ' place names from 400 seeds (' + [...pl].slice(0, 4).join(', ') + ')' + (plBad.length ? ': bad ' + plBad.slice(0, 6).join(', ') : ''));
  }
  const cross = []; for (let a = 0; a < KINDS.length; a++) for (let b = a + 1; b < KINDS.length; b++) for (const w of given[KINDS[a]]) if (given[KINDS[b]].has(w)) cross.push(KINDS[a] + '/' + KINDS[b] + ' ' + w);
  check(!cross.length, 'each people sounds like itself: no given name shared by two peoples' + (cross.length ? ': ' + cross.slice(0, 6).join(', ') : ''));
  // the native villages use the pools (WorldEco.names → VR.Names.pool), the site names VR.Names.place
  const en0 = E.names('zinn'), p0 = N.pool('zinn');
  check(en0.first === p0.first && en0.elders === p0.elders && en0.sur === p0.sur && E.word('zinn', 77, 2) === N.place('zinn', 77), 'WorldEco.names / word speak through VR.Names (' + E.word('aqua', 5, 2) + ', ' + E.word('zinn', 77, 2) + ', ' + E.word('opal', 9, 3) + ')');
  // Herzwelt's villages
  const vil = new Set(); for (let i = 0; i < 500; i++) vil.add(VR.VillageGen.name(i * 104729 + 7));
  const vBad = [...vil].filter(w => !word.test(w) || N.blocked(w) || N.reserved(w));
  check(vil.size >= 200 && !vBad.length, 'Herzwelt\'s villages: ' + vil.size + ' names from 500 seeds (' + [...vil].slice(0, 5).join(', ') + ')' + (vBad.length ? ': bad ' + vBad.join(', ') : ''));
  check(![...vil].some(w => /water|haven|hollow|brook|shire|field/.test(w)), 'no English village names any more (Brightwater, Oakhaven … went)');
  // the stars
  const NB = VR.Galaxy.build(53), names = NB.list.filter(s => !s.home).map(s => s.name), seen = new Set(names);
  const sBad = names.filter(n => !/^[A-Z][a-z]{3,10}$/.test(n) || N.blocked(n) || VR.Galaxy.blocked(n) || N.reserved(n));
  check(seen.size === names.length && !sBad.length, names.length + ' star names, unique, soft and clean (' + names.slice(0, 6).join(', ') + ')' + (sBad.length ? ': bad ' + sBad.slice(0, 6).join(', ') : ''));
  const NB2 = VR.Galaxy.build(53);
  check(NB2.list.every((s, i) => s.name === NB.list[i].name), 'a star keeps its name (seeded by the system)');
  check(N.blocked('Ussr') && N.blocked('Nemo') && N.blocked('Paul') && N.blocked('Amarant') && !N.blocked('Lindenau'), 'the block list catches Ussr, Nemo, Paul, Amarant; Lindenau passes');
  // the renames, in both tables and in the fallbacks
  check(de['g.eco.sp.zinn'] === 'Glimari' && en['g.eco.sp.zinn'] === 'Glimari' && de['g.eco.sp.opal'] === 'Isveli' && en['g.eco.sp.opal'] === 'Isveli', 'the peoples: „' + de['g.eco.sp.zinn'] + '" (was Glutani), „' + de['g.eco.sp.opal'] + '" (was Nivari)');
  check(de['story.c4.title'] === 'Die Monde von Turmalin' && /Tourmaline/.test(en['story.c4.title']), 'the ringed giant: „' + de['story.c4.title'] + '" / „' + en['story.c4.title'] + '"');
  const OLD = /\bAmarant(h|s|s')?\b|Glutani|Nivari/;
  const left = DE.concat(EN).filter(([, s]) => OLD.test(s)).map(([k]) => k);
  check(!left.length, 'no table value says Amarant, Amaranth, Glutani or Nivari any more' + (left.length ? ': ' + left.slice(0, 8).join(', ') + ' (' + left.length + ')' : ''));
  const was = I.lang; I.lang = 'en'; const fb = I.tx('n.names.test', null, 'die Glutani bei Amarant', 'the Glutani by Amaranth'); I.lang = was;
  check(fb === 'the Glimari by Tourmaline', 'a fallback text is renamed too: „' + fb + '"');
  const giant = VR.Universe.HELIA.bodies.find(b => b.id === 'amarant'), sp = E.KINDS.zinn.species, sp2 = E.KINDS.opal.species;
  check(giant && giant.name.de === 'Turmalin' && giant.name.en === 'Tourmaline' && sp.de === 'Glimari' && sp2.de === 'Isveli', 'the data: the giant „' + (giant && giant.name.de) + '" / „' + (giant && giant.name.en) + '" (its id amarant stays), the peoples ' + sp.de + ', ' + sp2.de);
  // no two shown proper names collide: the sky, the peoples, the story's speakers, the outposts, the nebulae, the pets
  const shown = [];
  for (const b of VR.Universe.HELIA.bodies) shown.push(['body', b.name.de], ['body', b.name.en]);
  for (const k of ['aqua', 'ocker', 'zinn', 'basalt', 'opal']) shown.push(['people', de['g.eco.sp.' + k]]);
  for (const k in de) if (/^story\.who\./.test(k)) shown.push(['speaker', String(de[k]).replace(/^(Opa|Meisterin|Kapitän) /, '')]);
  for (const k in de) if (/^g\.lib\.n\./.test(k)) shown.push(['outpost', de[k]]);
  for (const n of VR.Galaxy.NEB_NAMES) shown.push(['nebula', n.de]);
  const byWord = {}; for (const [what, w] of shown) { const l = String(w).toLowerCase(); (byWord[l] = byWord[l] || new Set()).add(what); }
  const clash = Object.keys(byWord).filter(w => byWord[w].size > 1);
  check(!clash.length, shown.length + ' fixed names: no word names two different things' + (clash.length ? ': ' + clash.join(', ') : ''));
  const pets = []; for (const k in VR.Pets.KINDS) for (const n of VR.Pets.KINDS[k].names) if (byWord[n.toLowerCase()] || N.reserved(n)) pets.push(n);
  check(!pets.length, 'no pet is called like a speaker, a world or a people (Funke and Lumi went)' + (pets.length ? ': ' + pets.join(', ') : ''));
  const gen = []; for (const k of KINDS) for (const w of given[k]) if (byWord[w.toLowerCase()]) gen.push(k + ' ' + w);
  check(!gen.length, 'no villager is called like a speaker, a world, a people or an outpost' + (gen.length ? ': ' + gen.join(', ') : ''));
  const vsrc = fs.readFileSync(path.join(ROOT, 'src/main/villagers.js'), 'utf8'), vgs = fs.readFileSync(path.join(ROOT, 'src/main/villages.js'), 'utf8');
  check(/VR\.Names\.pool\('herz'\)/.test(vsrc) && /elders/.test(vgs), 'Herzwelt\'s villagers take their names from VR.Names (villagers.js), the elders their own (villages.js)');
}

// ---------------------------------------------------------------- 7 · after a-fairy and o-wander: the Flausel, the sites, the codex
console.log('7 · the Flausel\'s names, the Heartland\'s sites in the Wanderbuch, the codex\'s peoples');
{
  const N = VR.Names, src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const P = N.pool('flausel'), full = new Set(); for (const f of P.first.concat(P.elders)) for (const s of P.sur) full.add(f + ' ' + s);
  const all = P.first.concat(P.kids, P.elders, P.sur), bad = all.filter(w => N.blocked(w) || N.reserved(w) || !/^[A-ZÄÖÜ][a-zäöüß]{2,11}$/.test(w));
  check(full.size >= 200 && P.kids.length >= 16 && P.elders.length >= 16 && !bad.length, 'the Flausel: ' + full.size + ' full names (' + N.sample('flausel', 3).join(', ') + ')' + (bad.length ? ': bad ' + bad.join(', ') : ''));
  const others = new Set(); for (const k of ['herz', 'aqua', 'ocker', 'zinn', 'basalt', 'opal']) { const Q = N.pool(k); for (const w of Q.first.concat(Q.kids, Q.elders)) others.add(w); }
  const sh = P.first.concat(P.kids, P.elders).filter(w => others.has(w));
  check(!sh.length, 'no Flausel shares a given name with another people' + (sh.length ? ': ' + sh.join(', ') : ''));
  const fy = src('src/main/fairy.js');
  check(/VR\.Names\.flausel\(/.test(fy) && /whoName\(f\)/.test(fy) && !/T\(nameKey\(f\.who\)\)/.test(fy), 'the tree village\'s folk have names of their own (fairy.js: VR.Names.flausel, not „Ein Flausel")');
  check(N.flausel(77, 0) === N.flausel(77, 0) && N.flausel(77, 0) !== N.flausel(77, 1) || N.flausel(78, 1) !== N.flausel(77, 0), 'a Flausel keeps its name (seeded by the place): ' + N.flausel(77, 0) + ', ' + N.flausel(77, 1));
  // the sites: every Wanderbuch site has a name of its own in both tables; the trailer's landmarks read as the quests read
  const W = src('src/main/wander.js'), L = VR.Land || {};
  const ids = Object.keys(N.SITES), miss = ids.filter(id => de['g.wd.site.' + id] !== N.SITES[id] || en['g.wd.site.' + id] !== N.SITES[id]);
  check(ids.length >= 8 && !miss.length, ids.length + ' sites named (' + ids.map(id => N.SITES[id]).join(', ') + ')' + (miss.length ? ': not in the tables ' + miss.join(', ') : ''));
  check(/T\('g\.wd\.site\.' \+ id, null, T\('g\.wd\.site\.' \+ kind\)\)/.test(W), 'wander.js names a site by its id first, its kind\'s word only as the fallback');
  const same = [['temple', 'temple'], ['citadel', 'citadel'], ['station', 'station'], ['hills', 'hills'], ['lookout', 'lookout']].filter(([a, b]) => de['g.wd.site.' + a].toLowerCase() !== String(de['g.q.pl.' + b]).toLowerCase() || en['g.wd.site.' + a].toLowerCase() !== String(en['g.q.pl.' + b]).toLowerCase());
  check(!same.length, 'the Wanderbuch calls the landmarks what the quests call them (Turmzitadelle / Spire Citadel, Kuppelhügel / Dome Hills …)' + (same.length ? ': ' + same.map(x => x[0]).join(', ') : ''));
  check(!/'Fiete'|'Paul'|'Mira'|'Emil'/.test(W) && /VR\.Names\.pool\('herz'\)/.test(W), 'the wanderers are called like Herzwelt\'s folk (VR.Names), no Mira, Paul, Emil or Fiete');
  check(/W\.placeName/.test(W), 'the Wanderbuch shows a site\'s name in the language of the moment (W.placeName), not the word stored at the visit');
  // the codex: a page „Völker" with every people, its sound and a few of its names
  const cx = src('src/main/codex.js');
  check(/'peoples'/.test(cx) && /N\.PEOPLE_ORDER|Names\.PEOPLE_ORDER/.test(cx) && de['g.codex.cat.peoples'] === 'Völker' && en['g.codex.cat.peoples'] === 'Peoples', 'the codex has a page „' + de['g.codex.cat.peoples'] + '" / „' + en['g.codex.cat.peoples'] + '"');
  const card = N.PEOPLE_ORDER.filter(k => !de['g.codex.p.' + k] || !en['g.codex.p.' + k] || de['g.codex.p.' + k].length < 3 || en['g.codex.p.' + k].length < 3);
  check(N.PEOPLE_ORDER.length === 7 && !card.length, 'each of the ' + N.PEOPLE_ORDER.length + ' peoples has its card in both tables (' + (de['g.codex.p.flausel'] || [])[0] + ')' + (card.length ? ': missing ' + card.join(', ') : ''));
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
