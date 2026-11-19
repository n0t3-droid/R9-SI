// /kosten (src/main/kosten.js): the experiments and the chat lines
//   a  every experiment has both names; the far list is the base and the far ones
//   b  the line: the base with its biggest passes, an experiment with its difference and the pass that moved most
//   c  /kosten in the Einfach mode's commands, the horizon's split knob
const V = require('./load_shared.js');
require('../src/main/kosten.js');
const K = V.Kosten; let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
check(K.LIST.every(e => e.de && e.en && e.set) && K.LIST[0].id === 'base', 'a  names in both languages, base first');
check(K.plan('geo').some(e => e.id === 'rd2') && !K.plan().some(e => e.grp === 'geo'), 'a  /kosten geo: ' + K.plan('geo').map(e => e.id).join(','));
check(K.plan('far').every(e => e.id === 'base' || e.grp === 'far') && K.plan('far').length >= 3, 'a  /kosten far: ' + K.plan('far').map(e => e.id).join(','));
const base = { total: 8.6, times: { far: 4.5, opaque: 2.0, sky: 0.8 } };
const l0 = K.fmt('de', K.LIST[0], base, base), l1 = K.fmt('de', K.LIST[1], { total: 4.2, times: { far: 0, opaque: 2.1, sky: 0.8 } }, base);
check(/8\.6 ms GPU · far 4\.5/.test(l0), 'b  ' + l0);
check(/Ferne aus: −4\.4 ms \(far −4\.5\)/.test(l1), 'b  ' + l1);
const fs = require('fs');
check(/kosten/.test(fs.readFileSync(__dirname + '/../src/main/start.js', 'utf8')) && /SPLIT_MUL/.test(fs.readFileSync(__dirname + '/../src/main/horizon.js', 'utf8')), 'c  Einfach mode command, the split knob');
console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
