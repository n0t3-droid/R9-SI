// F5 · Steuerung (spec 2026-10-08 realism wave, §F5): the key-binding model (src/main/binds.js), no DOM.
//  (a) every game key name the code asks for is owned by exactly one action; the defaults reproduce today's keys
//  (b) set / swap / clear: a conflict is reported (both actions named); a swap hands the other action our old key;
//      reserved and invalid codes are refused with a reason; the slot stays as it was
//  (c) reset of one action and of all actions; the defaults come back and the conflicts disappear
//  (d) serialization: toJSON keeps only what differs from the defaults, fromJSON sanitises (unknown actions, bad
//      codes, reserved codes, garbage input), and a round trip is exact
//  (e) labels for the keys in German and English
//  (f) codesFor(name) is what input.js translates through: the physical codes of the owning action, [] when unbound,
//      null for a name the game does not bind (Escape and Enter stay as they are)
const { store } = require('./dom_stub.js');
globalThis.VR = {};
require('../src/main/binds.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const B = VR.Binds;
if (!B || typeof B.Bindings !== 'function') { console.log('VR.Binds with Bindings missing'); console.log('FAILED 1'); process.exit(1); }
const { Bindings } = B;
const sameArr = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);

console.log('a · names and defaults');
const GAME_NAMES = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'ArrowLeft', 'ArrowRight',
  'KeyE', 'KeyM', 'KeyN', 'KeyT', 'Slash', 'KeyQ', 'KeyP', 'KeyC', 'KeyV', 'KeyG', 'KeyF', 'KeyH', 'KeyX', 'KeyR', 'KeyZ',
  'F1', 'F2', 'F3', 'F5', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'];
check(GAME_NAMES.every(n => B.byName(n) !== null), 'every key name the game asks for belongs to an action (' + GAME_NAMES.length + ' names)');
check(['Escape', 'Enter', 'Tab', 'Delete', 'Digit0', 'KeyY'].every(n => B.byName(n) === null), 'Escape, Enter, Tab, Delete and unused keys are not bound names');
const ids = B.ACTIONS.map(a => a.id);
check(new Set(ids).size === ids.length, 'action ids are unique');
const names = B.ACTIONS.flatMap(a => a.names);
check(new Set(names).size === names.length, 'a key name belongs to one action only');
const d = new Bindings();
check(sameArr(d.slots('fwd'), ['KeyW', '']) && sameArr(d.slots('sneak'), ['ShiftLeft', 'ShiftRight']) && sameArr(d.slots('sprint'), ['ControlLeft', 'ControlRight']), 'defaults: W forward; Shift and Ctrl left and right');
check(sameArr(d.codesFor('KeyW'), ['KeyW']) && sameArr(d.codesFor('ShiftRight'), ['ShiftLeft', 'ShiftRight']), 'codesFor a default name gives its physical codes');
check(d.codesFor('Escape') === null && d.conflicts().length === 0, 'an unbound name gives null; the defaults have no conflicts');
check(B.ACTIONS.every(a => ['move', 'act', 'hotbar', 'view'].includes(a.group)), 'every action has a group (move, act, hotbar, view)');

console.log('b · set, conflicts, swap, refusals');
const b = new Bindings();
let r = b.set('fwd', 0, 'KeyI');
check(r.ok === true && sameArr(b.codesFor('KeyW'), ['KeyI']) && sameArr(b.codesFor('KeyS'), ['KeyS']), 'rebind forward to I: the game asks for W and gets I; S stays back');
check(b.codesFor('KeyI') === null, 'I is no game name: the physical key I is not special');
r = b.set('back', 0, 'KeyI');
check(r.ok === true && sameArr(r.conflicts, ['fwd']), 'a second action on I is accepted and names the first (conflicts)');
const cf = b.conflicts();
check(cf.length === 1 && cf[0].code === 'KeyI' && sameArr(cf[0].actions.slice().sort(), ['back', 'fwd']), 'conflicts(): one code, both actions');
check(sameArr(b.conflictsOf('fwd'), ['back']) && b.conflictsOf('jump').length === 0, 'conflictsOf names the other action only');
r = b.set('back', 0, 'KeyS');
check(r.ok && b.conflicts().length === 0 && sameArr(b.slots('back'), ['KeyS', '']), 'moving back to S clears the conflict');
r = b.set('fwd', 0, 'KeyS', { swap: true });
check(r.ok === true && r.swapped === 'back' && sameArr(b.slots('fwd'), ['KeyS', '']) && sameArr(b.slots('back'), ['KeyI', '']), 'swap: forward takes S and back takes forward\'s old key I');
check(b.conflicts().length === 0, 'after a swap there is no conflict');
r = b.set('jump', 0, 'Escape');
check(r.ok === false && r.reason === 'reserved' && sameArr(b.slots('jump'), ['Space', '']), 'Escape is refused (reserved) and the slot is unchanged');
check(['Enter', 'Tab', 'F12', 'MetaLeft', 'AltLeft'].every(c => b.set('jump', 1, c).reason === 'reserved') && sameArr(b.slots('jump'), ['Space', '']), 'Enter, Tab, F12, Win and Alt are refused too');
check(['a b', 'Key W;', 42, null, undefined, 'x'.repeat(40)].every(c => { const q = b.set('jump', 1, c); return q.ok === false && q.reason === 'invalid'; }), 'spaced, punctuated, non-string, over-long codes are refused as invalid');
check(b.set('jump', 1, 'KeyJ').ok === true && sameArr(b.slots('jump'), ['Space', 'KeyJ']), 'the second slot takes an alternative key');
check(b.set('jump', 1, '').ok === true && sameArr(b.slots('jump'), ['Space', '']), 'an empty code clears a slot');
check(b.clear('jump', 0).ok === true && sameArr(b.slots('jump'), ['', '']) && sameArr(b.codesFor('Space'), []), 'an action with no key at all: codesFor gives []');
check(new Bindings().set('fwd', 0, 'KeyW').conflicts.length === 0, 'setting an action to its own key is no conflict');
check(new Bindings().set('nosuch', 0, 'KeyQ').ok === false, 'an unknown action is refused');
check(new Bindings().set('fwd', 5, 'KeyQ').ok === false, 'a slot other than 0 or 1 is refused');

console.log('c · reset');
const c = new Bindings();
c.set('fwd', 0, 'KeyI'); c.set('back', 0, 'KeyI'); c.set('jump', 1, 'KeyJ');
check(c.conflicts().length === 1 && !c.isDefault('fwd') && !c.isDefault('jump') && c.isDefault('left'), 'a changed action is not default; an untouched one is');
c.reset('back');
check(sameArr(c.slots('back'), ['KeyS', '']) && c.conflicts().length === 0 && sameArr(c.slots('fwd'), ['KeyI', '']), 'reset(back) restores S; the conflict is gone; forward keeps I');
c.resetAll();
check(Object.keys(c.toJSON().map || {}).length === 0 && B.ACTIONS.every(a => c.isDefault(a.id)), 'resetAll: every action is default again');
check(sameArr(c.codesFor('KeyW'), ['KeyW']) && c.conflicts().length === 0, 'after resetAll W is W and nothing conflicts');

console.log('d · serialization');
const e = new Bindings();
e.set('fwd', 0, 'KeyI'); e.set('sprint', 1, 'KeyK');
const js = e.toJSON();
check(js.v === 1 && js.map && Object.keys(js.map).sort().join() === 'fwd,sprint' && sameArr(js.map.fwd, ['KeyI', '']), 'toJSON keeps only the changed actions, versioned (v 1)');
check(JSON.parse(JSON.stringify(js)).map.sprint[1] === 'KeyK', 'toJSON survives JSON.stringify');
const back = Bindings.fromJSON(JSON.parse(JSON.stringify(js)));
check(JSON.stringify(back.toJSON()) === JSON.stringify(js) && back.codesFor('KeyI') === null && sameArr(back.codesFor('KeyW'), ['KeyI']), 'a round trip is exact and behaves the same');
const dirty = Bindings.fromJSON({ v: 1, map: { nosuch: ['KeyQ', ''], fwd: ['Escape', 'KeyY'], back: [42, 'KeyS bad'], jump: 'Space', left: ['KeyA', 'KeyA'], right: null } });
check(sameArr(dirty.slots('fwd'), ['KeyW', 'KeyY']), 'a reserved code in the record falls back to the default for its slot; the other slot is kept');
check(sameArr(dirty.slots('back'), ['KeyS', '']) && sameArr(dirty.slots('jump'), ['Space', '']) && sameArr(dirty.slots('right'), ['KeyD', '']), 'bad codes, a non-array entry and null fall back to the defaults');
check(dirty.slots('nosuch') === null && dirty.isDefault('drop') && !dirty.isDefault('fwd'), 'an unknown action in the record is dropped; the others are read');
check(sameArr(dirty.slots('left'), ['KeyA', 'KeyA']) && dirty.conflicts().length === 0, 'the same key twice in one action is harmless (no conflict)');
for (const junk of [null, undefined, 'x', 7, [], { v: 9, map: {} }, { v: 1, map: 'no' }]) {
  const j = Bindings.fromJSON(junk);
  check(j instanceof Bindings && B.ACTIONS.every(a => j.isDefault(a.id)), 'garbage ' + JSON.stringify(junk) + ' gives the defaults');
}
check(Object.keys(new Bindings().toJSON().map || {}).length === 0, 'the defaults serialize to an empty map');
const KEY = 'r9si.controls';
localStorage.setItem(KEY, JSON.stringify(e.toJSON()));
check(Bindings.fromJSON(JSON.parse(localStorage.getItem(KEY))).codesFor('KeyI') === null && store.has(KEY), 'stored under ' + KEY + ' and read back');

console.log('e · labels');
check(B.label('KeyW') === 'W' && B.label('Space', 'de') === 'Leertaste' && B.label('Space', 'en') === 'Space', 'letters and Space in both languages');
check(B.label('ShiftLeft', 'de') === 'Umschalt links' && B.label('ShiftLeft', 'en') === 'Left Shift', 'shift keys in both languages');
check(B.label('ControlLeft', 'de') === 'Strg links' && B.label('ControlRight', 'en') === 'Right Ctrl', 'ctrl keys in both languages');
check(B.label('Digit7') === '7' && B.label('ArrowLeft') === '←' && B.label('Slash') === '/' && B.label('F5') === 'F5', 'digits, arrows, slash, function keys');
check(B.label('') === '—' && B.label(null) === '—', 'an empty slot reads as a dash');

console.log('f · what input.js asks');
const f = new Bindings();
f.set('jump', 0, 'KeyJ');
check(sameArr(f.codesFor('Space'), ['KeyJ']) && f.codesFor('KeyJ') === null, 'the game still asks for Space; it gets J (Space no longer jumps by itself)');
check(sameArr(f.codesFor('KeyE'), ['KeyE']) && sameArr(f.codesFor('Digit3'), ['Digit3']), 'other names keep their defaults');
check(B.byName('Digit9') !== B.byName('Digit8') && B.byName('Digit1') !== null, 'hotbar keys are separate actions');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
if (fails) process.exit(1);
