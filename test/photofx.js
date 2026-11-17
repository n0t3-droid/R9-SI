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
// d  Kinoflug: four shots, each pose looks at the point, the shots join smoothly at their ends
{
  const base = { t: [100, 70, -40], yaw: 0.3 };
  let okLook = true, okEase = true;
  for (let k = 0; k < 4; k++) for (const t of [0, 1.7, 3.3, 5]) {
    const p = PF.shot(k, t, base), fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    const dx = base.t[0] - p.x, dz = base.t[2] - p.z, dl = Math.hypot(dx, dz) || 1;
    if ((fx * dx + fz * dz) / dl < 0.95) okLook = false;
    if (![p.x, p.y, p.z, p.yaw, p.pitch].every(Number.isFinite)) okLook = false;
  }
  const a = PF.shot(0, 0, base), b = PF.shot(0, 0.05, base);
  if (Math.hypot(a.x - b.x, a.z - b.z) > 0.05) okEase = false;   // (eased: it starts slowly)
  check(okLook, 'd  every pose of the four shots faces the point');
  check(okEase, 'd  a shot starts slowly (eased)');
  check(PF.SHOT * 4 >= 16 && PF.SHOT * 4 <= 30, 'd  the film is 16–30 s long (' + PF.SHOT * 4 + ' s)');
}
const miss2 = []; for (const lang of ['de', 'en']) for (const k of ['g.pfx.film0', 'g.pfx.film1']) if (!(V.I18N.dict[lang] && V.I18N.dict[lang][k])) miss2.push(lang + ':' + k);
check(!miss2.length, 'd  the film\'s texts in both tables');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
