// Handy-Steuerung 2 (src/main/touch.js): playing with the fingers on a phone
//   a  the gestures: a short tap places (or uses), a finger held still breaks for as long as it stays, a drag only turns
//   b  the floating stick: pushed to its rim it sprints (no sprint button needed)
//   c  the style: Gesten (default: tap and hold on the picture) or Tasten (the old buttons for placing and breaking)
//   d  the texts in both tables
const V = require('./load_shared.js');
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
require('../src/main/touch.js');
const T = V.Touch; let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
check(typeof T.classify === 'function', 'a  classify exists');
if (T.classify) {
  check(T.classify(120, 3, false) === 'tap', 'a  120 ms, 3 px: tap');
  check(T.classify(T.HOLD_MS + 20, 4, false) === 'hold', 'a  held still: hold (break)');
  check(T.classify(150, 40, false) === 'drag' && T.classify(900, 40, false) === 'drag', 'a  moved: a drag (turn only)');
  check(T.classify(900, 40, true) === 'hold', 'a  once breaking, moving keeps breaking (aim while mining)');
}
check(typeof T.sprintAt === 'function' && T.sprintAt(0.97) && !T.sprintAt(0.6), 'b  the stick at its rim sprints, halfway walks');
check(T.styleOf({}) === 'gesten' && T.styleOf({ touchStyle: 'tasten' }) === 'tasten', 'c  Gesten by default, Tasten on request');
const miss = ['g.set.touchStyle', 'g.set.touchStyle.tip', 'g.set.touchStyle.gesten', 'g.set.touchStyle.tasten', 'touch.menu', 'ux.h.moveTouch2'].filter(k => !(V.I18N.dict.de[k] && V.I18N.dict.en[k]));
check(!miss.length, 'd  texts in both tables ' + miss.join(','));
console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
