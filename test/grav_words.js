// f-first3 (R55-01): the worlds' own words keep the owner's „same gravity" rule.
// With VR.DimReg.realGrav off (the default) no shown text — a moon's hello toast, a portal hook, a moon codex page —
// names a gravity fraction, a jump height or the suit. With it on, the real gravity facts come back.
// A text that names the ⚙ switch itself („Echte Schwerkraft der Welten" / "Real gravity of the worlds") may say what it does.
const path = require('path');
const SRC = path.join(__dirname, '..', 'src');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

global.VR = {};
Object.defineProperty(globalThis, 'navigator', { value: { language: 'de-DE', languages: ['de-DE', 'de'] }, configurable: true });
require(path.join(SRC, 'main', 'i18n.js'));
require(path.join(SRC, 'main', 'lang_en.js'));
require(path.join(SRC, 'main', 'lang_de.js'));
require(path.join(SRC, 'shared', 'dimreg.js'));
const I = VR.I18N, D = VR.DimReg;
check(typeof D.gravKey === 'function', 'VR.DimReg.gravKey(key) picks the text set for the gravity switch');

const BAD = {
  de: /Schwerkraft|Sechstel|Zwanzigstel|Fünftel|Drittel|Anzug|\d+\s*(m|Meter)\s+hoch|Sprung trägt|So leicht|wiegst|schwer,|höher als ein Haus/i,
  en: /gravity|a sixth|twentieth|a fifth|a third|\bsuit\b|\d+\s*(m|metres?)\s+high|jump carries|So light|you weigh|is heavy|higher than a house/i,
};
const MARK = /Echte Schwerkraft der Welten|Real gravity of the worlds/;
const MOONS = ['basalt', 'opal', 'zinn', 'ocker', 'aqua'];
const PAGES = ['basalt', 'opal', 'amarantrise', 'crater', 'impact', 'geyser', 'eclipse', 'jump',
  'zinn', 'ocker', 'aqua', 'plume', 'lavalake', 'devil', 'bluesunset', 'storm', 'atoll', 'herzwelt'];
const pick = (k) => (D.gravKey ? D.gravKey(k) : k);
const shown = () => {
  const out = [];
  for (const id of MOONS) out.push(['hello ' + id, I.t(pick('g.moon.hello.' + id))]);
  for (const id of PAGES) out.push(['codex ' + id, I.list(pick('g.codex.moon.' + id)).join(' | ')]);
  for (const k of Object.keys(I.dict.de)) if (k.startsWith('g.pt.hook.')) out.push([k, I.t(k)]);
  return out;
};

for (const lang of ['de', 'en']) {
  I.lang = lang;
  D.realGrav = false;
  let bad = [];
  for (const [what, s] of shown()) { if (!s) { bad.push(what + ' (empty)'); continue; } if (BAD[lang].test(s) && !MARK.test(s)) bad.push(what + ': ' + s.slice(0, 90)); }
  check(bad.length === 0, lang + ', realGrav off: no hello / hook / codex page claims low gravity, a jump height or a suit' + (bad.length ? '\n      ' + bad.join('\n      ') : ''));
  D.realGrav = true;
  const real = MOONS.filter((id) => BAD[lang].test(I.t(pick('g.moon.hello.' + id))));
  check(real.length === MOONS.length, lang + ', realGrav on: every moon hello names its real gravity (' + real.length + '/' + MOONS.length + ')');
  D.realGrav = false;
}
// both sets exist in both tables
for (const id of MOONS) check(I.dict.de['g.moon.hello.' + id + '.home'] !== undefined && I.dict.en['g.moon.hello.' + id + '.home'] !== undefined, 'g.moon.hello.' + id + '.home in de and en');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
