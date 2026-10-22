// e-ctx · the HUD that fades (erlebnis §4; plan docs/superpowers/plans/2026-10-22-e-ctx.md §2.4): VR.HudFade.rules over a
// scripted minute of Überleben, in each of the three modes (Automatisch · Immer · Minimal) and during a trip.
//  hotbar 4 s after a slot change / pickup / use, while building · hearts & food changed in the last 6 s, below 50 %, a
//  fight, 5 s after entering · XP 4 s after a gain · minimap & compass faster than 6 m/s, a target set, 8 s after loading,
//  M held · the crosshair a dot, a ring on something to do · the vehicle HUD hidden in the cockpit after its 9-s hint ·
//  never hidden: hearts below 30 %, the air running out — in every mode, and during a trip.
//  Then the game side on a stand-in HUD: the classes change only when a rule does (no DOM work in between).
const path = require('path');
require('./dom_stub.js');
global.VR = {};
try { require(path.join(__dirname, '..', 'src', 'main', 'hudfade.js')); } catch (e) { console.log('  ! hudfade.js: ' + e.message); }
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const H = VR.HudFade;
if (!H || typeof H.rules !== 'function') { console.log('  ✗ VR.HudFade.rules missing'); console.log('FAILED 1'); process.exit(1); }

// the minute: s(t) → the state the game would read at t
const base = { slotT: -99, useT: -99, pickT: -99, building: false, statT: -99, hp: 1, food: 1, air: 1, fight: false, enterT: 0, loadT: 0, xpT: -99, speed: 0, target: false, mHeld: false, cockpit: false, cockpitT: 0, interact: false, survival: true, travel: false };
const S = (t, o) => Object.assign({}, base, { t }, o || {});
const R = (t, o, mode) => H.rules(S(t, o), mode || 'auto');

console.log('Automatisch');
let r = R(2);
check(r.stats && r.map && !r.hotbar && !r.xp && r.cross === 'dot', 'entering a world: hearts (5 s) and the map (8 s) show, the hotbar does not, a dot for a crosshair');
r = R(9);
check(!r.stats && !r.map && !r.hotbar && !r.xp, '9 s later, nothing to say: all faded');
check(R(12, { slotT: 10 }).hotbar && !R(14.5, { slotT: 10 }).hotbar, 'a slot change: the hotbar for 4 s');
check(R(21, { pickT: 20 }).hotbar && R(22, { useT: 20 }).hotbar && R(30, { building: true }).hotbar, 'a pickup, a use, building: the hotbar');
check(R(25, { statT: 20, hp: 0.8 }).stats && !R(26.5, { statT: 20, hp: 0.8 }).stats, 'hurt a little: the hearts for 6 s');
check(R(40, { hp: 0.45 }).stats && R(40, { food: 0.4 }).stats && R(40, { air: 0.9 }).stats && R(40, { fight: true }).stats, 'below half, hungry, under water, in a fight: the hearts stay');
check(R(41, { xpT: 38 }).xp && !R(42.5, { xpT: 38 }).xp, 'an XP gain: the bar for 4 s');
check(R(45, { speed: 8 }).map && !R(45, { speed: 5 }).map && R(45, { target: true }).map && R(45, { mHeld: true }).map, 'fast, a target, M held: the map; walking slowly: not');
check(R(50, { interact: true }).cross === 'ring', 'something to do in reach: the ring');
check(R(60, { cockpit: true, cockpitT: 3 }).vehicle && !R(60, { cockpit: true, cockpitT: 10 }).vehicle && R(60, { cockpit: false }).vehicle, 'the vehicle HUD: its 9-s hint in the cockpit, then the instruments say it');
check(!R(30, { survival: false, statT: 29, hp: 0.2 }).stats && !R(30, { survival: false, xpT: 29 }).xp, 'Kreativ: no hearts, no XP');

console.log('never hidden');
for (const mode of ['auto', 'always', 'minimal']) {
  check(R(33, { hp: 0.25 }, mode).stats && R(33, { air: 0.2 }, mode).stats && R(33, { hp: 0.25, travel: true }, mode).stats, `${mode}: hearts below 30 % and the air running out show — also during a trip`);
}

console.log('Immer · Minimal');
r = R(9, {}, 'always');
check(r.stats && r.map && r.hotbar && r.xp && r.vehicle && r.cross === 'full', 'Immer: everything stays, the full crosshair');
r = R(12, { slotT: 10, pickT: 11, statT: 11, hp: 0.6, speed: 9, xpT: 11 }, 'minimal');
check(r.hotbar && !r.stats && !r.map && !r.xp && r.cross === 'dot', 'Minimal: the hotbar on the slot keys, no hearts unless danger, no map, a dot');
check(!R(12, { pickT: 11 }, 'minimal').hotbar && R(12, { mHeld: true }, 'minimal').map, 'Minimal: a pickup alone does not show the hotbar; M held shows the map');

console.log('a trip');
r = R(20, { travel: true, slotT: 19, speed: 40, target: true, statT: 19, interact: true });
check(!r.hotbar && !r.stats && !r.map && !r.xp && !r.vehicle && r.cross === 'none', 'during a trip the picture is the film: all faded (danger aside)');

console.log('the game side');
const hud = document.createElement('div'); hud.setAttribute('id', 'hud'); document.body.appendChild(hud);
const ids = ['hotbar', 'itemname', 'stats', 'air', 'xpbar', 'xplvl', 'minimap', 'compass', 'vehiclehud', 'crosshair'];
const el = {}; for (const id of ids) { const e = document.createElement('div'); e.setAttribute('id', id); hud.appendChild(e); el[id] = e; }
let writes = 0; for (const id of ids) { const t = el[id].classList.toggle; el[id].classList.toggle = (c, on) => { writes++; return t(c, on); }; }
const st = S(9);
H.apply(H.rules(st, 'auto'));
const w0 = writes;
H.apply(H.rules(st, 'auto'));
check(writes === w0, `the same rules again: no DOM writes (${writes - w0})`);
check(el.hotbar.classList.contains('hf-off') && el.stats.classList.contains('hf-off') && el.minimap.classList.contains('hf-off') && el.crosshair.classList.contains('hf-dot'), 'faded elements carry hf-off, the crosshair hf-dot');
H.apply(H.rules(S(12, { slotT: 10 }), 'auto'));
check(!el.hotbar.classList.contains('hf-off') && el.itemname && !el.itemname.classList.contains('hf-off'), 'the hotbar (and the item\'s name) come back');
H.apply(H.rules(S(12), 'always'));
check(ids.filter(i => i !== 'crosshair').every(i => !el[i].classList.contains('hf-off')) && !el.crosshair.classList.contains('hf-dot'), 'Immer: no element faded, the full crosshair');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
