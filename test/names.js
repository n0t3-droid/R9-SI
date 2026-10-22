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
  { de: 'Bernstein', en: 'Amber', what: 'the hothouse planet', checked: '2026-10-22', by: 'f-names', found: 'an ordinary word' },
  { de: 'Cölestin', en: 'Celestine', what: 'the ice giant', checked: '2026-10-22', by: 'critic v0.49', found: 'a mineral word' },
  { de: 'Trümmerschwarm', en: 'Rubble Swarm', what: 'the swarm of rubble round Helia', checked: '2026-10-22', by: 'critic v0.49', found: 'no product or game of that name' },
  { de: 'Funke', en: 'Funke', what: 'the companion drone (e-funke)', checked: '2026-10-22', by: 'f-names', found: 'no game companion of that name; an ordinary word (spark) and a surname; a German media group is called FUNKE (publishing, not games) — no action' },
  { de: 'Weißstadt', en: 'Weißstadt', what: 'the hall city (the code\'s name for it)', checked: '2026-10-22', by: 'f-names', found: 'only the Bavarian town Weißenstadt' },
  { de: 'Nova Haven', en: 'Nova Haven', what: 'the terraced city of the trailer', checked: '2026-10-22', by: 'f-names', found: 'no game place of that name' },
  { de: 'Driftinseln', en: 'Drift Isles', what: 'the gate world of drifting isles (u-dims)', checked: '2026-10-22', by: 'f-names', found: 'no German hit; in English a 2025 drift-racing game is titled DRIFT ISLAND and a fan map is called „Drift Isle" — a descriptive name of another meaning; flagged for the owner' },
  { de: 'Fotomodus', en: 'Photo mode', what: 't-first\'s photo mode', checked: '2026-10-22', by: 'critic v0.49', found: 'a generic word' },
];
// the words that went: never again in a table, an item name or a string the game writes
const RETIRED = [
  { word: 'Sterntaler', re: /Sterntaler/, why: 'the brand of a German maker of baby and children\'s goods and toys (review R50-07)', now: 'Heliataler' },
  { word: 'Sky Ray', re: /\b[Ss]ky[ -][Rr]ays?\b|\bSkyrays?\b/, why: '≈ „Skyray", a flying creature in several games (review R50-07)', now: 'Cloud Ray' },
  { word: 'Himmelsrochen', re: /Himmelsrochen/, why: 'the literal German of „Sky Ray" — retired with it', now: 'Wolkenrochen' },
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

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
