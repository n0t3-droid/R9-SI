// W1 · 🧭 Hints (VR.Hints, src/shared/hints.js): one line at a time, never on a timer. A hint leaves when its action
// was done (done) or ✕ was pressed (dismiss); an undone one may return next session, at most three times in all.
// 'r9si.hints' = { v:1, seen:{id:t}, done:{id:t}, n:{id:count} }
const { store } = require('./dom_stub.js');
globalThis.VR = {};
require('../src/main/i18n.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

require('../src/shared/hints.js');
const H = VR.Hints;
console.log('1 · one hint at a time');
check(!!H && ['want', 'show', 'done', 'dismiss', 'current', 'read', 'reset'].every(k => typeof H[k] === 'function') && H.KEY === 'r9si.hints', 'VR.Hints: want / show / done / dismiss / current / read / reset, key r9si.hints');
if (!H) { console.log('FAILED ' + fails); process.exit(1); }
check(H.want('move') === true && H.current() === null, 'a fresh store wants "move"; nothing is showing');
check(H.show('move', { text: '🖱 bewegen = umschauen · W A S D = gehen', picto: ['W', 'A', 'S', 'D', 'mouse'] }) === true, 'show("move") → true');
const box = document.getElementById('hints');
check(!!box && box.classList.contains('on') && box.textContent.includes('W A S D'), '#hints is on and carries the text');
check(box.querySelectorAll('.hint').length === 1 && box.querySelectorAll('kbd').length === 4 && box.querySelectorAll('.mouse').length === 1, 'one .hint with the pictograms: four key caps and a mouse');
check(H.show('fly', { text: 'Leertaste 2× = fliegen' }) === false && H.current() === 'move', 'a second hint while one shows is refused (never two at once)');
const st1 = H.read();
check(st1.seen.move > 0 && st1.n.move === 1 && !st1.done.move && !st1.seen.fly, 'seen.move and n.move = 1 are stored; fly was never shown');
check(JSON.parse(store.get('r9si.hints')).v === 1, 'the record is r9si.hints v1');

console.log('2 · done hides it; dismiss (✕) only hides');
H.done('move');
check(H.current() === null && !box.classList.contains('on') && H.read().done.move > 0, 'done("move") hides the hint and stores done.move');
check(H.want('move') === false, 'a done hint is never wanted again');
check(H.show('fly', { text: 'Leertaste 2× = fliegen', picto: ['Space', 'Space'] }) === true && H.current() === 'fly', 'the next hint can show now');
const x = box.querySelector('.x');
check(!!x, 'the hint has a ✕');
x.click();
check(H.current() === null && !box.classList.contains('on') && !H.read().done.fly && H.read().n.fly === 1, '✕ hides it, fly is not done');
check(H.want('fly') === false, 'but not again in this session');
H.done('fly');
check(H.read().done.fly > 0, 'done after a dismiss still counts');

console.log('3 · at most three times across sessions');
H.reset();
check(H.read().n.fly === undefined && H.want('fly') === true, 'reset() clears the record');
for (let s = 0; s < 3; s++) { H._newSession(); check(H.want('fly') === true && H.show('fly', { text: 'x' }) === true, 'session ' + (s + 1) + ': shown'); H.dismiss(); }
H._newSession();
check(H.read().n.fly === 3 && H.want('fly') === false, 'after three dismissals it stays away (n.fly = 3)');
check(H.show('fly', { text: 'x' }) === false, 'show() refuses it too');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
