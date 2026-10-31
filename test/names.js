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
  { de: 'Amarant', en: 'Amaranth', what: 'the ringed giant', checked: '2026-10-22', by: 'critic v0.49', found: 'a plant word; a character\'s first name in Final Fantasy IX — no action' },
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
  for (const [f, s] of TEXT) { if (/lang_(de|en)\.js$/.test(f)) continue; const c = code(s).split('\n'); c.forEach((l, i) => { if (r.re.test(l)) inSrc.push(f + ':' + (i + 1)); }); }
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

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
