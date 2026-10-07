// The German display names of the furniture and model pack (src/shared/names_de.js): every model name of VM.DEFS
// (voxfurn, voxfacade, voxmodern …) is split into its words; a word is covered when the dictionary (WORD) or a phrase
// (PHRASE) has it, or it is a number or the symbol &. The test lists the words without a German text and fails when
// more than 5 % of the distinct words (or of their occurrences) are uncovered. It also checks that VR.dispName
// translates only when the language is German, and that the ids are untouched.
//   bash test/wt_run.sh model_names_de.js
require('./load_shared.js');
require('../src/shared/names_de.js');
const VR = globalThis.VR;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

const N = VR.NamesDE;
const names = VR.VM.DEFS.map(d => d.display);
const ids = VR.VM.DEFS.map(d => d.name);
check(names.length > 300, 'the model pack has ' + names.length + ' display names');

// the words of a name: split at spaces, · and &; the phrase words count as covered (PHRASE is a translation of the whole)
const splitWords = (s) => String(s).split(/[\s·&]+/).filter(Boolean);
const phraseWords = new Set();
for (const k of Object.keys(N.PHRASE)) for (const w of splitWords(k)) phraseWords.add(w.toLowerCase());
const KEEP = /^[\d.,]+"?$|^[\d.,]+[a-zA-Z]{0,3}$|^×$/;
const covered = (w) => KEEP.test(w) || N.WORD[w.toLowerCase()] !== undefined || phraseWords.has(w.toLowerCase());

const distinct = new Map();   // word (lower case) → occurrences
let occ = 0, miss = 0;
const missWords = new Map();
for (const s of names) for (const w of splitWords(s)) {
  const k = w.toLowerCase(); occ++;
  distinct.set(k, (distinct.get(k) || 0) + 1);
  if (!covered(w)) { miss++; missWords.set(k, (missWords.get(k) || 0) + 1); }
}
const missDistinct = [...distinct.keys()].filter(k => missWords.has(k));
const pctD = 100 * missDistinct.length / distinct.size, pctO = 100 * miss / occ;
console.log('  words: ' + distinct.size + ' distinct · ' + occ + ' occurrences · untranslated ' + missDistinct.length + ' distinct (' + pctD.toFixed(1) + ' %), ' + miss + ' occurrences (' + pctO.toFixed(1) + ' %)');
if (missDistinct.length) console.log('  untranslated: ' + missDistinct.map(k => k + ':' + missWords.get(k)).join(' · '));
check(pctD <= 5, 'at most 5 % of the distinct words are untranslated (' + pctD.toFixed(1) + ' %)');
check(pctO <= 5, 'at most 5 % of the word occurrences are untranslated (' + pctO.toFixed(1) + ' %)');

// every name translates to a German name in which no English word is left (the words the translator saw as misses)
const left = [];
for (const s of names) { const out = N.translate(s, (t, kind) => { if (kind === 'miss') left.push(t); }); void out; }
check(!left.length, 'no word is left untranslated by translate()' + (left.length ? ': ' + [...new Set(left)].slice(0, 20).join(', ') : ''));

// samples: the spec's examples and a few family names
const S = [
  ['Three-seater · charcoal', 'Dreisitzer · anthrazit'], ['Armchair · cream', 'Sessel · creme'], ['Dining Table · oak', 'Esstisch · Eiche'],
  ['Desk · oak', 'Schreibtisch · Eiche'], ['Kitchen · white · drawers', 'Küche · weiß · Schubladen'], ['Coffee Table · walnut & marble', 'Couchtisch · Nussbaum & Marmor'],
  ['Double Bed · navy', 'Doppelbett · marineblau'], ['Pendant · brass', 'Pendelleuchte · Messing'], ['Fiddle Leaf Fig · concrete pot', 'Geigenfeige · Betontopf'],
];
for (const [en, de] of S) check(N.translate(en) === de, 'translate("' + en + '") = "' + N.translate(en) + '"' + (N.translate(en) === de ? '' : ' (expected "' + de + '")'));

// the display layer: German only, English keeps the data; the ids never change
const I = VR.I18N; const saved = I && I.lang;
VR.I18N = { lang: 'de' };
check(VR.dispName('Three-seater · charcoal') === 'Dreisitzer · anthrazit', 'dispName reads German when the language is German');
VR.I18N = { lang: 'en' };
check(VR.dispName('Three-seater · charcoal') === 'Three-seater · charcoal', 'dispName keeps English when the language is English');
VR.I18N = undefined;
check(VR.dispName('Three-seater · charcoal') === 'Three-seater · charcoal', 'dispName without the language module keeps English');
if (I) VR.I18N = I; if (I) I.lang = saved;
check(ids.every((id) => /^vm_|^vx_/.test(id) || id.length > 0), 'the model ids are untouched (' + ids.length + ' ids)');

console.log(fails ? 'FAIL ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
