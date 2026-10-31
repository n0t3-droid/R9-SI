// e-access · the gamepad end to end with a fake pad (navigator.getGamepads stubbed), no browser:
//  (a) a frame of the standard layout through VR.Input.beginFrame: walk and look sticks, A jump, X the Aktion (V),
//      Y inventory, LT place, RT break, LB / RB and the D-pad's left / right the hotbar, Start the menu (Escape)
//  (b) menus: the pad drives nothing in the game; B goes back (Escape); the D-pad moves the focus (navNearest)
//  (c) the device: a pad press switches the prompts to the pad, a key or the mouse back
//  (d) the glyphs: one for every mapped button, our own shapes (two colours only, no brand colours or names), each
//      with its name for a screen reader; every prompt row and the Aktion have their glyph
require('./dom_stub.js');
globalThis.VR = {};
for (const f of ['i18n', 'lang_en', 'lang_de', 'settings_reg', 'binds', 'pad', 'input', 'a11y']) require('../src/main/' + f + '.js');
const fs = require('fs'), path = require('path');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const A = VR.A11y, B = VR.Binds;
B.current = new B.Bindings();

// the fake pad: 17 buttons, 4 axes, the standard mapping
const pad = { id: 'Fake Pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
globalThis.navigator.getGamepads = () => [pad];
const press = (...ids) => { for (const b of pad.buttons) { b.pressed = false; b.value = 0; } for (const i of ids) { pad.buttons[i].pressed = true; pad.buttons[i].value = 1; } };
const canvas = { addEventListener() {}, requestPointerLock: null };
const inp = new VR.Input(canvas);
const frame = (ids, axes, menu) => {
  press(...(ids || [])); pad.axes = axes || [0, 0, 0, 0]; inp.menuOpen = !!menu;
  inp.beginFrame(1 / 30);
  const r = {
    jump: inp.hit('Space'), veh: inp.hit('KeyV'), inv: inp.hit('KeyE'), map: inp.hit('KeyM'), esc: inp.hit('Escape'), sneak: inp.down('ShiftLeft'),
    place: inp.mouse.down[2], brk: inp.mouse.down[0], wheel: inp.mouse.wheel, look: [inp.mouse.dx, inp.mouse.dy], move: Object.assign({}, inp.padMove),
  };
  inp.endFrame(); return r;
};

console.log('a · the game through a fake pad');
frame([]);
let r = frame([], [0, -1, 0, 0]);
check(r.move.fwd > 0.9 && Math.abs(r.move.str) < 1e-6, `the left stick pushed up walks ahead (fwd ${r.move.fwd.toFixed(2)})`);
r = frame([], [0, 0, 1, 0]);
check(r.look[0] > 0 && r.look[1] === 0, `the right stick looks right (${r.look[0].toFixed(1)} px)`);
r = frame([0]); check(r.jump, 'A jumps (Space)');
frame([]); r = frame([2]); check(r.veh, 'X is the Aktion (V)');
frame([]); r = frame([3]); check(r.inv, 'Y opens the inventory (E)');
frame([]); r = frame([6]); check(r.place && !r.brk, 'LT places (the right mouse button)');
frame([]); r = frame([7]); check(r.brk && !r.place, 'RT breaks (the left mouse button, held)');
frame([]); r = frame([4]); const r2 = (frame([]), frame([5]));
check(r.wheel === -1 && r2.wheel === 1, 'LB / RB turn the hotbar');
frame([]); r = frame([14]); const r3 = (frame([]), frame([15]));
check(r.wheel === -1 && r3.wheel === 1, 'the D-pad\'s left / right turn the hotbar too');
frame([]); r = frame([8]); check(r.map, 'View opens the map (M)');
frame([]); r = frame([9]); check(r.esc, 'Start is the menu (Escape)');
frame([]); r = frame([1]); check(r.sneak, 'B held sneaks');
// a rebinding moves the keyboard, never the pad: the pad names the action
B.current.set('jump', 0, 'KeyK'); frame([]); r = frame([0]); check(r.jump, 'after jump is rebound to K, A still jumps'); B.current = new B.Bindings();

console.log('b · menus');
frame([]); r = frame([0], [0, -1, 0, 0], true);
check(!r.jump && r.move.fwd === 0, 'in a menu the pad drives nothing in the game');
frame([], null, true); r = frame([1], null, true); check(r.esc, 'B goes back in a menu (Escape)');
const rects = [{ x: 0, y: 0, w: 100, h: 30 }, { x: 0, y: 50, w: 100, h: 30 }, { x: 150, y: 0, w: 100, h: 30 }, { x: 150, y: 50, w: 100, h: 30 }];
check(VR.Pad.navNearest(rects, 0, 'down') === 1 && VR.Pad.navNearest(rects, 0, 'right') === 2 && VR.Pad.navNearest(rects, 3, 'up') === 2 && VR.Pad.navNearest(rects, 0, 'up') === 0, 'the D-pad moves the focus to the nearest button that way (and stays at an edge)');
const tsrc = fs.readFileSync(path.join(__dirname, '../src/main/touch.js'), 'utf8');
check(/PN\.frame = function/.test(tsrc) && /pad\.menu\.indexOf\('ok'\) >= 0 && cur\) cur\.click\(\)/.test(tsrc), 'touch.js: the menus follow the D-pad, A presses the focused button');

console.log('c · the device decides the prompts');
A.setDevice('kb'); frame([]);
check(A.device === 'kb', 'a pad at rest does not take the prompts');
frame([], [0.05, 0.05, 0, 0]); check(A.device === 'kb', 'stick noise inside the dead zone neither');
let seen = []; A.onDevice((d) => seen.push(d));
frame([0]); check(A.device === 'pad' && seen[0] === 'pad', 'a pad press switches the prompts to the pad');
check(/<svg[^>]*data-b="2"/.test(A.keyHtml('veh', 'KeyV')), 'the Aktion prompt shows the X glyph');
window.dispatchEvent({ type: 'keydown', code: 'KeyW', target: { tagName: 'DIV' }, preventDefault() {} });
A.setDevice('kb');
check(A.keyHtml('veh', 'KeyV') === 'V', 'a key brings the key names back (V)');

console.log('d · the glyphs: our own shapes');
const all = []; for (let i = 0; i < 16; i++) all.push(A.glyph(i));
check(all.every(s => /^<svg class="a11y-g"/.test(s) && /aria-label="[^"]+"/.test(s)), 'a glyph for each of the 16 buttons, each named for a screen reader');
check(new Set(all).size === 16, 'every glyph is different');
const cols = new Set(); for (const s of all) for (const m of s.matchAll(/#[0-9a-fA-F]{3,6}\b/g)) cols.add(m[0].toLowerCase());
check(cols.size <= 2, `two colours only — ink and body (${[...cols].join(' ')}): no brand colour codes the buttons`);
const brand = /xbox|playstation|nintendo|sony|microsoft|dualshock|joy-?con/i;
const a11ySrc = fs.readFileSync(path.join(__dirname, '../src/main/a11y.js'), 'utf8');
check(!all.some(s => brand.test(s)) && !brand.test(a11ySrc), 'no brand name in the glyphs or the module');
const faces = all.slice(0, 4).map(s => (/<circle cx="([\d.]+)" cy="([\d.]+)" r="1.7"/.exec(s) || []).slice(1).join(','));
check(new Set(faces).size === 4, `each face button carries a notch at its place in the diamond (${faces.join(' · ')}) — the shape tells them apart, not a colour`);
const stripIds = ['up', 'down', 'fly', 'inv', 'map', 'veh'];
check(stripIds.every(id => A.padOf(id) !== null && A.glyph(A.padOf(id))), 'every row of the key strip a pad can do has its glyph');
check(A.padOf('journal') === null, 'a row the pad cannot do (the journal) is left out on the pad');
const MAP = VR.Pad.MAP;
const pairs = [['jump', 0], ['veh', 2], ['inv', 3], ['map', 8], ['sprint', 10], ['cam', 11]];
check(pairs.every(([a, i]) => MAP[i].act === a && A.padOf(a) === i) && MAP[6].mouse === 2 && A.padOf('place') === 6 && MAP[7].mouse === 0 && A.padOf('brk') === 7 && MAP[9].phys === 'Escape' && A.padOf('menu') === 9, 'the glyphs name the buttons pad.js really maps');
const ux = fs.readFileSync(path.join(__dirname, '../src/main/ux.js'), 'utf8'), ctx = fs.readFileSync(path.join(__dirname, '../src/main/ctx.js'), 'utf8');
check(/AX\.glyph\(AX\.padOf\(e\.id\)\)/.test(ux) && /VR\.A11y\.glyph\(VR\.A11y\.padOf\('veh'\)\)/.test(ctx), 'the key strip (ux.js) and the Aktion prompt (ctx.js) draw the glyphs with a pad');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
