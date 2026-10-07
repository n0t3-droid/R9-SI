// Languages (v0.40): the game speaks German first, English second — through VR.I18N and the two tables
// src/main/lang_en.js (today's English strings, nothing lost) and src/main/lang_de.js.
//  (a) the module and both tables load in node; every key in `de` has a counterpart in `en` and the other way round
//  (b) no untranslated English UI words in the `de` table ("Settings", "Inventory", "Play" …); German texts are short
//  (c) the {placeholders} of every key match between the languages (lists: the union over all lines)
//  (d) t() / tx() / list() fall back correctly: de → the de table, en → the en table, fr (no table) → English,
//      a missing key → the call's fallback, then the key; the first visit follows the browser language
//  (e) every key used in the game's sources exists in the `en` table (a typo in a key would show the key itself)
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..', 'src', 'main');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

global.VR = {};
Object.defineProperty(globalThis, 'navigator', { value: { language: 'de-DE', languages: ['de-DE', 'de'] }, configurable: true });   // a German browser: the first visit is German
require(path.join(SRC, 'i18n.js'));
const I = VR.I18N;
check(I && typeof I.t === 'function' && typeof I.tx === 'function', 'VR.I18N loads in node');
check(I.lang === 'de', 'the first visit follows the browser language (de → ' + I.lang + ')');
for (const f of ['lang_en.js', 'lang_de.js']) { check(fs.existsSync(path.join(SRC, f)), 'src/main/' + f + ' exists'); if (fs.existsSync(path.join(SRC, f))) require(path.join(SRC, f)); }
const en = I.dict.en || {}, de = I.dict.de || {};
const enKeys = Object.keys(en), deKeys = Object.keys(de);
console.log('  en keys ' + enKeys.length + ' · de keys ' + deKeys.length);
check(enKeys.length > 300, 'the en table covers the game (' + enKeys.length + ' keys)');

// ---------------------------------------------------------------- (a) the same keys in both tables
const missDe = enKeys.filter(k => !(k in de)), missEn = deKeys.filter(k => !(k in en));
check(!missDe.length, 'every en key has a German text' + (missDe.length ? ': missing ' + missDe.slice(0, 12).join(', ') + (missDe.length > 12 ? ' … (' + missDe.length + ')' : '') : ''));
check(!missEn.length, 'every de key has an English text' + (missEn.length ? ': extra ' + missEn.slice(0, 12).join(', ') : ''));
const typeMismatch = enKeys.filter(k => k in de && Array.isArray(en[k]) !== Array.isArray(de[k]));
check(!typeMismatch.length, 'lists are lists in both languages' + (typeMismatch.length ? ': ' + typeMismatch.join(', ') : ''));
const empty = deKeys.filter(k => Array.isArray(de[k]) ? !de[k].length || de[k].some(s => !String(s).trim()) : !String(de[k]).trim());
check(!empty.length, 'no empty German texts' + (empty.length ? ': ' + empty.join(', ') : ''));

// ---------------------------------------------------------------- (b) untranslated English in the German table
// whole English UI words that have no place in a German sentence (item names like "Builder Wand" stay English on purpose)
const ENGLISH = /\b(Settings|Inventory|Play|Paused|Resume|Back to Game|Save|Quit|Graphics|Controls|Crafting|Furnace|Chest|Hotbar|Welcome|Done|Close|Search|Favorites|Favourites|Respawn|Unknown|Nothing|Teleported|Removed|Selection|Render distance|Shadow quality|Mouse sensitivity|Field of view|Minimap|Show|coordinates|Discovery|Milestone|Milestones|Creatures|Shipyard|World Map|Photo Mode|Master|Effects|Music|Ambience|Quality preset|Clouds|Particles|Materials|Building|Nature|Tools|Combat|Food|Spawn|Spawn point|Go Home|Set Spawn|Time of day|Weather|Ghost|frozen|flowing|Joined|Friends|Connecting|arriving|Blueprint failed|paste|copied|Copied|Pasted|Placed|Cleared|blocks|corners|first|again|Give|Trade|Goodbye|Help|How are you|Tell me|Thank you|Hello|Hi there|Good morning|Fresh bread|Monsters|Festival tonight|Lantern Festival|has landed|has begun|Right-click|Left-click|Click to|Press|hold|Type|Language)\b/;
const strip = (s) => String(s).replace(/\/\w+/g, '');   // /commands keep their English names
const bad = deKeys.filter(k => (Array.isArray(de[k]) ? de[k] : [de[k]]).some(s => ENGLISH.test(strip(s))));
check(!bad.length, 'no untranslated English UI words in the de table' + (bad.length ? ': ' + bad.slice(0, 15).map(k => k + ' = ' + JSON.stringify(Array.isArray(de[k]) ? de[k].find(s => ENGLISH.test(s)) : de[k]).slice(0, 70)).join(' · ') : ''));
// identical texts are fine only for names and symbols (R9 Studio, Zen, OK, m/s …): everything with three or more words must differ
const NAMES = ['g.cat.modern', 'g.cat.vmodern', 'g.set.gpuTsr', 'g.star.autoHud'];   // product names and symbols that read the same in both languages
const same = enKeys.filter(k => k in de && !Array.isArray(en[k]) && en[k] === de[k] && String(en[k]).split(/\s+/).length >= 3 && !NAMES.includes(k));
check(!same.length, 'longer German texts differ from the English' + (same.length ? ': ' + same.slice(0, 10).join(', ') : ''));

// ---------------------------------------------------------------- (c) placeholders
const ph = (v) => { const set = new Set(); for (const s of (Array.isArray(v) ? v : [v])) for (const m of String(s).matchAll(/\{(\w+)\}/g)) set.add(m[1]); return [...set].sort().join(','); };
const phBad = enKeys.filter(k => k in de && ph(en[k]) !== ph(de[k]));
check(!phBad.length, 'the {placeholders} match between the languages' + (phBad.length ? ': ' + phBad.slice(0, 10).map(k => k + ' en{' + ph(en[k]) + '} de{' + ph(de[k]) + '}').join(' · ') : ''));

// ---------------------------------------------------------------- (d) lookups and fallbacks
I.lang = 'de';
check(I.t('g.pause.title') === de['g.pause.title'] && de['g.pause.title'] !== en['g.pause.title'], 't() reads the German table (' + I.t('g.pause.title') + ')');
check(I.t('g.no.such.key') === 'g.no.such.key', 'a missing key without a fallback shows the key');
check(I.t('g.no.such.key', null, 'Fallback') === 'Fallback', 'a missing key shows the fallback written at the call');
check(I.tx('g.no.such.key', { n: 3 }, '{n} Blöcke', '{n} blocks') === '3 Blöcke', 'tx() in German uses the German text written at the call');
check(I.tx('g.pause.title', null, 'XX', 'YY') === de['g.pause.title'], 'tx() prefers the table over the texts at the call');
I.lang = 'en';
check(I.t('g.pause.title') === en['g.pause.title'], 't() reads the English table');
check(I.tx('g.no.such.key', { n: 3 }, '{n} Blöcke', '{n} blocks') === '3 blocks', 'tx() in English uses the English text written at the call');
check(I.tx('g.no.such.key', null, 'nur deutsch') === 'nur deutsch', 'tx() without an English text falls back to the German one (never empty)');
I.lang = 'fr';
check(I.t('g.pause.title') === en['g.pause.title'], 'a language without a table reads the English table');
check(I.tx('g.no.such.key', null, 'DE', 'EN') === 'EN', 'tx() in a language without a table uses the English text');
I.lang = 'de';
const tips = I.list('g.load.tips');
check(Array.isArray(tips) && tips.length >= 10 && tips[0] !== en['g.load.tips'][0], 'list() gives the German tips (' + tips.length + ')');
I.lang = 'fr';
check(I.list('g.load.tips')[0] === en['g.load.tips'][0], 'list() falls back to the English list');
check(I.list('g.no.such.list').length === 0, 'list() of a missing key is empty');
I.lang = 'de';
check(I.t('g.wand.placed', { n: '12', what: 'Placed' }).indexOf('12') >= 0, 'placeholders are filled');
// set(): listeners fire, an unknown code is ignored
let heard = null; I.on((c) => { heard = c; });
I.set('en'); check(I.lang === 'en' && heard === 'en', 'set() switches and tells the listeners');
I.set('xx'); check(I.lang === 'en', 'an unknown language code is ignored');
I.set('de');

// ---------------------------------------------------------------- (e) keys used in the sources exist
const used = new Set(), files = fs.readdirSync(SRC).filter(f => /\.js$/.test(f) && !/^lang_|^i18n/.test(f));
for (const f of files) {
  const src = fs.readFileSync(path.join(SRC, f), 'utf8');
  for (const m of src.matchAll(/\b(?:T|TL|t|tx|list|L)\(\s*'(g\.[\w.]*\w)'/g)) used.add(m[1]);
  for (const m of src.matchAll(/data-t[ht]?="(g\.[\w.]*\w)"/g)) used.add(m[1]);
}
const undefinedKeys = [...used].filter(k => !(k in en));
check(used.size > 200, 'the sources use the tables (' + used.size + ' keys found)');
check(!undefinedKeys.length, 'every key used in the sources is in the en table' + (undefinedKeys.length ? ': ' + undefinedKeys.slice(0, 15).join(', ') : ''));

console.log(fails ? 'FAIL ' + fails : 'OK');
process.exit(fails ? 1 : 0);
