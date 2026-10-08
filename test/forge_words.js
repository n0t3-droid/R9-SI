// Words of the game's own data in German and English (i18n2): the forge's type, style, parameter and choice names
// and the Modern Living categories. The German word is the source; VR.I18N.word(de) gives the table text (g.fgw.*)
// of the language of the moment, and a word without an entry stays as it is.
//  (a) every German word that a shape, style, parameter, choice or Modern category shows has a g.fgw.* entry in both tables
//  (b) the English texts have no German letters (ä ö ü ß) and differ from the German, except the few words that read alike
//  (c) VR.I18N.word: German → German, English → English, another language → English, an unknown word → unchanged
//  (d) describe() of every type in English names no German word of the forge
// usage: node test/forge_words.js — prints ALL OK or FAILED n
const fs = require('fs'), path = require('path');
require('./load_shared.js');
const SRC = path.join(__dirname, '..', 'src', 'main');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
Object.defineProperty(globalThis, 'navigator', { value: { language: 'de-DE', languages: ['de-DE', 'de'] }, configurable: true });   // a German browser
require(path.join(SRC, 'i18n.js'));
const I = VR.I18N;
for (const f of ['lang_de.js', 'lang_en.js']) require(path.join(SRC, f));
const de = I.dict.de || {}, en = I.dict.en || {};
const SAME = ['Park', 'Tech', 'Japan', 'Deck', 'Sport', 'Pool', 'Hangar', 'Gangway', 'Shuttle', 'Interceptor', 'Gunship', 'Racer', 'Dropship', 'Helipad', 'Carport', 'Smart Home'];   // read alike in both languages
const NAMES = ['Starforge', 'Nightwing', 'Sunstrike', 'Rust Hauler', 'Arctic Survey'];   // the shuttle liveries (shipgen.js, starship.js): English names in both languages
// the German words the game's own data shows: type names, parameter labels and choices, style names, Modern categories
const words = new Set();
for (const t of VR.Forge.types) {
  words.add(t.name);
  for (const p of t.params) { words.add(p.label); for (const n of p.names || []) words.add(n); }
  for (const s of t.styles) words.add(s.name);
}
for (const v of Object.values(VR.VM.MODERN_CATS)) words.add(v);
const list = [...words].filter(w => !SAME.includes(w) && !NAMES.includes(w));
const keyOf = {}; for (const k of Object.keys(de)) if (k.indexOf('g.fgw.') === 0) keyOf[de[k]] = k;
console.log('  ' + list.length + ' German words, ' + Object.keys(keyOf).length + ' table entries (g.fgw.*)');

// ---------------------------------------------------------------- (a) every word has its entry in both tables
const missing = list.filter(w => !keyOf[w]);
check(!missing.length, 'every German word of the forge and the Modern categories has a g.fgw.* entry' + (missing.length ? ': ' + missing.join(', ') : ''));
const noEn = list.filter(w => keyOf[w] && !(keyOf[w] in en));
check(!noEn.length, 'every such entry has an English text' + (noEn.length ? ': ' + noEn.join(', ') : ''));
const orphan = Object.keys(keyOf).filter(w => !list.includes(w));
check(!orphan.length, 'no unused g.fgw.* entry' + (orphan.length ? ': ' + orphan.join(', ') : ''));

// ---------------------------------------------------------------- (b) English texts: no German letters, not the German
const umlaut = list.filter(w => keyOf[w] && /[äöüßÄÖÜ]/.test(en[keyOf[w]] || ''));
check(!umlaut.length, 'the English texts have no German letters' + (umlaut.length ? ': ' + umlaut.join(', ') : ''));
const same = list.filter(w => keyOf[w] && en[keyOf[w]] === w);
check(!same.length, 'the English texts differ from the German' + (same.length ? ': ' + same.join(', ') : ''));

// ---------------------------------------------------------------- (c) the lookup by language
I.lang = 'de';
check(I.word('Länge') === 'Länge', 'German: a word is itself (' + I.word('Länge') + ')');
I.lang = 'en';
check(I.word('Länge') === 'Length', 'English: Länge → Length');
check(I.word('Brücke') === 'Bridge' && I.word('Hängebrücke') === 'Suspension', 'English: Brücke → Bridge, Hängebrücke → Suspension');
check(I.word('Park') === 'Park', 'a word that reads alike stays (Park)');
check(I.word('Unbekanntes Wort') === 'Unbekanntes Wort', 'an unknown word stays as it is');
check(I.word(undefined) === undefined && I.word('') === '', 'no text: no text back');
I.lang = 'fr';
check(I.word('Länge') === 'Length', 'a language without a table reads the English word');
I.lang = 'de';

// ---------------------------------------------------------------- (d) describe() in English names no German word
I.lang = 'en';
const bad = [];
for (const t of VR.Forge.types) {
  const dna = VR.Forge.dna(t.id, {}, 1, t.styles[0].id);
  for (const short of [false, true]) {
    const text = VR.Forge.describe(dna, short);
    for (const w of list) {
      if (!keyOf[w] || en[keyOf[w]] === w) continue;
      const re = new RegExp('(^|[^\\p{L}])' + w.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '($|[^\\p{L}])', 'u');
      if (re.test(text)) bad.push(t.id + '/' + (short ? 'short' : 'long') + ': ' + w + ' in "' + text.slice(0, 80) + '"');
    }
  }
}
check(!bad.length, 'the English describe() of every type names no German word' + (bad.length ? ': ' + bad.slice(0, 4).join(' · ') : ''));
I.lang = 'de';

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
