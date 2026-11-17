// f-kino · Bildstile und Licht im Takt — the pure parts (src/main/photofx.js)
//   a six styles, T cycles through them and back to Natur
//   b the beat's swell: 1 at the end of a beat, the most at its start, the bar's first beat stronger
//   c the texts in both tables
const V = require('./load_shared.js');
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
require('../src/main/photofx.js');
const PF = V.PhotoFx;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
check(PF && PF.STYLES.length === 6 && PF.STYLES[0] === 'nature', 'a  six styles, the first Natur');
let i = 0; const seen = []; for (let k = 0; k < 6; k++) { i = PF.next(i); seen.push(PF.STYLES[i]); }
check(seen.join() === 'mini,pixel,film,aqua,comic,nature', 'a  T cycles and comes back (' + seen.join(' → ') + ')');
check(Math.abs(PF.pulse(0, false, 0.2) - 1.2) < 1e-9 && PF.pulse(1, false, 0.2) < 1.001 && PF.pulse(0, true, 0.2) > PF.pulse(0, false, 0.2), 'b  the swell: strongest at the beat, gone by its end, the bar\'s first beat more');
check(PF.pulse(-1, false, 0.2) === PF.pulse(0, false, 0.2) && PF.pulse(0, false, 0) === 1, 'b  clamped; strength 0 is no change');
const L = V.I18N, miss = [];
for (const lang of ['de', 'en']) for (const k of PF.STYLES.map(s => 'g.pfx.' + s).concat(['g.pfx.key', 'g.set.lightBeat', 'g.set.lightBeat.tip'])) if (!(L.dict[lang] && L.dict[lang][k])) miss.push(lang + ':' + k);
check(!miss.length, 'c  every text in both tables' + (miss.length ? ' — ' + miss.join(', ') : ''));
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
