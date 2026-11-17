// f-album · 📒 Fotoalbum — the pure parts (src/main/album.js)
//   a trim keeps the newest MAX, drops the oldest
//   b the label: the world's name, the day and the time
//   c the texts in both tables
const V = require('./load_shared.js');
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
require('../src/main/album.js');
const AL = V.Album;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const recs = Array.from({ length: 6 }, (_, i) => ({ id: 'p' + i, when: 1000 + i * 10 }));
const drop = AL.trim(recs, 4);
check(drop.length === 2 && drop.includes('p0') && drop.includes('p1'), 'a  six photos, room for four: the two oldest go (' + drop + ')');
check(AL.trim(recs, 10).length === 0, 'a  room for all: nothing goes');
const t = new Date(2026, 10, 17, 14, 5).getTime();
check(AL.label({ world: 'Wiesental', when: t }, 'de') === 'Wiesental · 17.11. 14:05', 'b  ' + AL.label({ world: 'Wiesental', when: t }, 'de'));
check(AL.label({ world: 'Vale', when: t }, 'en') === 'Vale · 17/11 14:05', 'b  ' + AL.label({ world: 'Vale', when: t }, 'en'));
const miss = []; for (const lang of ['de', 'en']) for (const k of ['btn', 'title', 'empty', 'count', 'dl', 'del', 'close', 'back']) if (!(V.I18N.dict[lang] && V.I18N.dict[lang]['g.album.' + k])) miss.push(lang + ':' + k);
check(!miss.length, 'c  every text in both tables' + (miss.length ? ' — ' + miss.join(', ') : ''));
check(AL.due(100, 30, 60) && !AL.due(100, 50, 60), 'd  the moments: at most one a minute');
check(['g.set.moments', 'g.set.moments.tip'].every(k => V.I18N.dict.de[k] && V.I18N.dict.en[k]), 'd  the switch\'s texts in both tables');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
