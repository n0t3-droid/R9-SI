// Languages (v0.40): the game speaks German first, English second — through VR.I18N and the two tables
// src/main/lang_en.js (today's English strings, nothing lost) and src/main/lang_de.js.
//  (a) the module and both tables load in node; every key in `de` has a counterpart in `en` and the other way round
//  (b) no untranslated English UI words in the `de` table ("Settings", "Inventory", "Play" …); German texts are short
//  (c) the {placeholders} of every key match between the languages (lists: the union over all lines)
//  (d) t() / tx() / list() fall back correctly: de → the de table, en → the en table, fr (no table) → English,
//      a missing key → the call's fallback, then the key; the first visit follows the browser language
//  (e) every key used in the game's sources exists in the `en` table (a typo in a key would show the key itself)
//  (f) W1 — the start screen, the pause menu, 🎒 Meins, the Ding cards, the hints and the R9 Studio's front door
//      (src/main/start.js, src/shared/{ding,hints,tiles,uiprefs}.js, src/studio/{start,nav}.js): every key they use is in
//      both tables, the German and English texts written at a tx() call are the tables' texts (the Studio reads the
//      same tables, so both pages say the same words), no W1 key in the tables is unused, and no older Studio
//      L('key', '…') text is changed by a table key of the same name
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

// ---------------------------------------------------------------- (f) W1: the start screen and the cards, game and Studio
// a small reader for tx( … ) calls: the arguments split at the top level, a pure string literal read as its value
function calls(src, name) {
  const out = [], re = new RegExp('\\b' + name + '\\(', 'g'); let m;
  while ((m = re.exec(src))) {
    const args = []; let i = m.index + m[0].length, depth = 0, cur = '', lits = [];
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === "'" || c === '"' || c === '`') {
        let j = i + 1, val = '';
        while (j < src.length && src[j] !== c) { if (src[j] === '\\') { val = val === null ? null : val + src[j + 1]; j += 2; continue; } if (c === '`' && src[j] === '$' && src[j + 1] === '{') val = null; if (val !== null) val += src[j]; j++; }
        cur += src.slice(i, j + 1); lits.push(val); i = j; continue;
      }
      if ('([{'.includes(c)) depth++;
      if (')]}'.includes(c)) { if (!depth) { args.push({ raw: cur.trim(), lits }); break; } depth--; }
      if (c === ',' && !depth) { args.push({ raw: cur.trim(), lits }); cur = ''; lits = []; continue; }
      cur += c;
    }
    const lit = (a) => (a && /^(['"`])[\s\S]*\1$/.test(a.raw) && a.lits.length === 1 && a.lits[0] !== null ? a.lits[0] : undefined);
    out.push({ line: src.slice(0, m.index).split('\n').length, key: lit(args[0]), keyRaw: args[0] && args[0].raw, args: args.map(lit), de: lit(args[2]), en: lit(args[3]), n: args.length });
  }
  return out;
}
const ROOT = path.join(__dirname, '..');
const W1 = ['src/main/start.js', 'src/shared/ding.js', 'src/shared/hints.js', 'src/shared/tiles.js', 'src/shared/uiprefs.js', 'src/studio/start.js', 'src/studio/nav.js'];
// the texts written at a tx() call must be the tables' texts everywhere in the game, not only in W1
const TXFILES = W1.concat(files.map(f => 'src/main/' + f).filter(f => !W1.includes(f)));
const W1PRE = /^(start|meins|ding|hand|hint|st|karte|nav|mode|cat)\./;
const w1used = new Set(), w1miss = [], w1diff = [], w1dyn = [], w1g = new Set();
for (const f of TXFILES) {
  if (!fs.existsSync(path.join(ROOT, f))) continue;
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8'), isW1 = W1.includes(f);
  for (const c of calls(src, 'tx')) {
    if (c.key === undefined) { if (isW1 && !/^(k|key|T\[k\]\[0\])$/.test(c.keyRaw || '')) w1dyn.push(f + ':' + c.line + ' ' + c.keyRaw); continue; }   // (the helpers forward a key)
    if (!isW1 && !(c.key in en)) continue;   // ((e) reports a missing game key)
    if (isW1) w1used.add(c.key);
    if (!(c.key in de) || !(c.key in en)) { w1miss.push(c.key); continue; }
    if (c.de !== undefined && c.de !== de[c.key]) w1diff.push(f + ':' + c.line + ' ' + c.key + ' de ' + JSON.stringify(c.de) + ' ≠ ' + JSON.stringify(de[c.key]));
    if (c.en !== undefined && c.en !== en[c.key]) w1diff.push(f + ':' + c.line + ' ' + c.key + ' en ' + JSON.stringify(c.en) + ' ≠ ' + JSON.stringify(en[c.key]));
  }
  if (!isW1) continue;
  // a [key, de, en] triple (the tile labels) is a call written as a list
  for (const m of src.matchAll(/\[\s*'([a-z]+\.[\w.]+)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*\]/g)) {
    const [, k, d, e] = m; if (!W1PRE.test(k)) continue; w1used.add(k);
    if (!(k in de) || !(k in en)) { w1miss.push(k); continue; }
    if (d !== de[k] || e !== en[k]) w1diff.push(f + ' ' + k + ' [' + d + ' | ' + e + '] ≠ [' + de[k] + ' | ' + en[k] + ']');
  }
  for (const m of src.matchAll(/\b(?:t|T|tx)\(\s*'(g\.[\w.]*\w)'/g)) w1g.add(m[1]);
  for (const m of src.matchAll(/data-t[ht]?="([\w.]+)"/g)) w1g.add(m[1]);
  for (const m of src.matchAll(/'(g\.mode\.(?:zen|creative|survival))'/g)) w1g.add(m[1]);
}
const w1gMiss = [...w1g].filter(k => !(k in de) || !(k in en));
console.log('  W1: ' + w1used.size + ' keys of its own, ' + w1g.size + ' game keys');
check(w1used.size > 100, 'the W1 screens read the tables (' + w1used.size + ' keys)');
check(!w1miss.length, 'every W1 key is in both tables' + (w1miss.length ? ': ' + [...new Set(w1miss)].slice(0, 15).join(', ') : ''));
check(!w1gMiss.length, 'every game key the W1 screens use (the pause menu, the modes) is in both tables' + (w1gMiss.length ? ': ' + w1gMiss.join(', ') : ''));
check(!w1diff.length, 'the texts written at a tx() call are the tables\' texts' + (w1diff.length ? ':\n      ' + w1diff.slice(0, 12).join('\n      ') : ''));
check(!w1dyn.length, 'no W1 key is put together at run time (a test could not see it)' + (w1dyn.length ? ': ' + w1dyn.join(', ') : ''));
const w1dead = enKeys.filter(k => W1PRE.test(k) && !w1used.has(k));
check(!w1dead.length, 'no unused W1 key in the tables' + (w1dead.length ? ': ' + w1dead.join(', ') : ''));
// the R9 Studio's own texts (L('key', 'Deutsch')) must not change because the game's tables are loaded there too
const clash = [];
for (const f of fs.readdirSync(path.join(ROOT, 'src/studio')).filter(x => /\.js$/.test(x))) {
  const src = fs.readFileSync(path.join(ROOT, 'src/studio', f), 'utf8');
  for (const c of calls(src, 'L')) { const k = c.key, d = c.args[1]; if (k === undefined || d === undefined || !(k in de)) continue; if (d !== de[k]) clash.push(f + ':' + c.line + ' ' + k + ' Studio "' + d + '" vs table "' + de[k] + '"'); }
}
check(!clash.length, 'no Studio text is changed by a table key of the same name' + (clash.length ? ': ' + clash.join(' · ') : ''));
// the vocabulary (§6): one word per action — and the old words are gone from the German screens
const DE_OLD = /Nach Hause|Spawnpunkt|Zen-Baumeister|Weitermachen|In die Welt übernehmen/;
const old = deKeys.filter(k => (Array.isArray(de[k]) ? de[k] : [de[k]]).some(s => DE_OLD.test(s)));
check(!old.length, 'no old word (Nach Hause, Spawnpunkt, Zen-Baumeister, Weitermachen …) in the de table' + (old.length ? ': ' + old.join(', ') : ''));
check(de['g.pause.resume'] === de['start.play'] && de['g.pause.bauen'] === de['start.bauen'] && de['g.pause.meins'] === de['start.meins'] && en['g.pause.resume'] === en['start.play'] && en['g.pause.meins'] === en['start.meins'], 'the pause menu and the start screen use the same words (▶ Weiterspielen, 🏗 Bauen, 🎒 Meins)');
check(de['ding.edit'] === '✏️ Bearbeiten' && de['ding.set'] === '📍 Setzen' && de['ding.share'] === '📦 Teilen' && de['ding.fav'] === 'Favorit' && de['g.pause.spawn'] === '📍 Mein Platz ist hier' && de['g.pause.home'] === '🏠 Zu meinem Platz', 'the card actions and „mein Platz" read as in the spec');

console.log(fails ? 'FAIL ' + fails : 'OK');
process.exit(fails ? 1 : 0);
