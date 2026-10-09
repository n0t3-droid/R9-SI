// F5 · Einstellungen (spec 2026-10-08 realism wave, §F5): the settings registry (src/main/settings_reg.js) with the two
// language tables loaded (src/main/lang_de.js, lang_en.js), no DOM.
//  (a) three groups in order (Bild · Klang · Spiel), each with its heading in both languages
//  (b) every entry: a known group and section, a unique key, a known type, a label and a one-line tip in both languages
//  (c) every graphics option (slider, switch, choice) carries a cost badge 🟢 kaum / 🟡 etwas / 🔴 viel; the other
//      groups carry none; all three tiers are in use
//  (d) sliders: the range is ordered, the step is positive, the default lies in the range and snaps onto the step;
//      the value names of a slider (vals) exist in both languages with one name per step
//  (e) choices: at least two options, each with a value and label and tip keys in both languages; the default is one of them
//  (f) add() appends a new key and refuses a key that exists; defaults() covers every setting with a default
require('./dom_stub.js');
globalThis.VR = {};
require('../src/main/i18n.js');
require('../src/main/lang_en.js');
require('../src/main/lang_de.js');
require('../src/main/settings_reg.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const S = VR.Settings;
const DE = VR.I18N.dict.de || {}, EN = VR.I18N.dict.en || {};
const hasBoth = (k) => typeof k === 'string' && DE[k] !== undefined && EN[k] !== undefined;
if (!S || !S.ITEMS) { console.log('VR.Settings missing'); console.log('FAILED 1'); process.exit(1); }

console.log('a · groups');
check(S.GROUPS.map(g => g.id).join() === 'img,snd,play', 'three groups in order: Bild (img), Klang (snd), Spiel (play)');
check(S.GROUPS.every(g => hasBoth(g.lab) && g.de && g.en && S.SECTIONS[g.id]), 'every group has its heading in both languages and a section list');
check(S.GROUPS[0].de === 'Bild' && S.GROUPS[1].de === 'Klang' && S.GROUPS[2].de === 'Spiel', 'the German group names are Bild, Klang, Spiel');

console.log('b · entries');
const TYPES = ['slider', 'switch', 'choice', 'preset', 'action', 'info'];
const groupIds = S.GROUPS.map(g => g.id);
check(S.ITEMS.every(x => groupIds.includes(x.g)), 'every entry belongs to a known group');
check(S.ITEMS.every(x => S.SECTIONS[x.g].includes(x.sec)), 'every entry sits in a known section of its group');
const keys = S.ITEMS.map(x => x.key);
check(new Set(keys).size === keys.length, 'keys are unique (' + keys.length + ' entries)');
check(S.ITEMS.every(x => TYPES.includes(x.t)), 'every entry has a known type');
check(S.ITEMS.filter(x => x.t !== 'action').every(x => hasBoth(x.lab) && hasBoth(x.tip)), 'every label and one-line tip exists in both languages');
check(S.ITEMS.filter(x => x.t === 'action').every(x => hasBoth(x.lab) && hasBoth(x.tip) && typeof x.act === 'string'), 'every action has a label, a tip and a handler name');
check(S.ITEMS.filter(x => x.t === 'switch').every(x => typeof x.def === 'boolean'), 'every switch defaults to true or false');

console.log('c · cost badges');
// the graphics options: the picture's settings in the light, quality and object sections (the display switches and the Automatik are not)
const graphics = S.ITEMS.filter(x => x.g === 'img' && ['light', 'quality', 'objects'].includes(x.sec) && ['slider', 'switch', 'choice'].includes(x.t));
check(graphics.length >= 18 && graphics.every(x => S.COST[x.cost]), 'every graphics option has a cost badge (' + graphics.length + ' options)');
check(S.byKey('showFps').cost === undefined && S.byKey('showFps').sec === 'show', 'the FPS display is a display switch, not a graphics option: no badge');
check(['low', 'mid', 'high'].every(t => graphics.some(x => x.cost === t)), 'all three cost tiers are in use');
check(['low', 'mid', 'high'].every(t => hasBoth(S.COST[t].lab) && S.COST[t].icon), 'each tier has an icon and a word in both languages');
check(S.COST.low.icon === '🟢' && S.COST.mid.icon === '🟡' && S.COST.high.icon === '🔴', 'the icons are 🟢 🟡 🔴');
check(S.ITEMS.filter(x => x.g !== 'img').every(x => x.cost === undefined), 'the sound and game settings carry no cost badge');

console.log('d · sliders');
const sliders = S.ITEMS.filter(x => x.t === 'slider');
check(sliders.every(x => x.min < x.max && x.step > 0 && x.def >= x.min && x.def <= x.max), 'every slider: min < max, step > 0, default inside the range');
check(sliders.every(x => S.snap(x, x.def) === x.def), 'every default sits on its step');
const vol = S.byKey('volMaster');
check(S.snap(vol, 0.333) === 0.35 && S.snap(vol, 2) === 1 && S.snap(vol, -4) === 0 && S.snap(vol, 'x') === 0.8, 'snap: 0.333 → 0.35 on a 0.05 step, clamped at both ends, a non-number gives the default');
const rd = S.byKey('renderDist');
check(S.snap(rd, 9.6) === 10 && S.snap(rd, 99) === 24 && S.snap(rd, 0) === 3, 'snap to whole chunks within 3–24');
check(sliders.filter(x => x.vals).every(x => Array.isArray(DE[x.vals]) && Array.isArray(EN[x.vals]) && DE[x.vals].length === x.max - x.min + 1 && EN[x.vals].length === x.max - x.min + 1), 'named steps: one name per step in both languages');
check(sliders.filter(x => x.fmt === 'chunks').length === 1 && sliders.filter(x => x.fmt === 'pct').length >= 4 && S.byKey('fov').fmt === 'deg', 'value formats: chunks, percent, degrees');

console.log('e · choices');
const choices = S.ITEMS.filter(x => x.t === 'choice');
check(choices.length >= 6, 'choices exist (' + choices.length + ')');
check(choices.every(x => x.opts.length >= 2 && x.opts.every(o => Array.isArray(o) && o.length === 3 && hasBoth(o[1]) && hasBoth(o[2]))), 'every option has a value, a label and a tip in both languages');
check(choices.every(x => x.opts.some(o => o[0] === x.def)), 'every default is one of the options');
check(S.byKey('autoJump').def === 'auto' && S.byKey('touch').def === 'auto' && S.byKey('sprintMode').def === 'hold', 'auto-jump follows the mode (auto), touch auto-detects, sprint is hold by default');

console.log('f · add and defaults');
const before = S.ITEMS.length;
check(S.add({ key: 'testOnlyNew', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.kids', tip: 'g.set.kids.tip', def: false }) === true && S.ITEMS.length === before + 1, 'add() appends a new key');
check(S.add({ key: 'fov', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.kids', tip: 'g.set.kids.tip', def: false }) === false && S.ITEMS.length === before + 1, 'add() refuses a key that exists');
check(S.add(null) === false && S.add({ g: 'play' }) === false, 'add() refuses an entry without a key');
S.ITEMS.splice(S.ITEMS.findIndex(x => x.key === 'testOnlyNew'), 1);
const d = S.defaults();
check(d.renderDist === 10 && d.fov === 75 && d.rawInput === true && d.mouseSmooth === false && d.sprintMode === 'hold', 'defaults(): the numbers of the registry (raw input on, smoothing off, hold to sprint)');
check(!('bench' in d) && !('keys' in d) && d.autoJump === 'auto', 'defaults(): actions have no default; auto-jump follows the mode');
check(S.items('img', 'auto').map(x => x.key).join() === 'preset,bench', 'the Automatik section holds the preset and the Automatik button, in that order');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
if (fails) process.exit(1);
