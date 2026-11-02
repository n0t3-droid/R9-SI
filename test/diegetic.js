// f-ux · information lives in the world (plan docs/superpowers/plans/2026-11-02-f-ux.md): VR.Diegetic's pure parts.
//  trail(px, pz, tx, tz) — footprints 2..16 m toward the goal, alternating sides, lanterns every 6th, none when near
//  sign(d) — the Wegweiser at the trail's end (shown beyond 20 m) · vitals(hp, food, air) — the vignette's strength and
//  colour (none when healthy, more the lower), the breath under 35 % · pick(dx, dy, n) — the radial's slice (a dead zone)
//  · wheelStep(sel, d, n) · capNear(near, 24) — the star map's labels · the settings rows and the language keys
const path = require('path');
require('./dom_stub.js');
global.VR = {};
const SRC = path.join(__dirname, '..', 'src', 'main');
for (const f of ['i18n.js', 'lang_de.js', 'lang_en.js', 'settings_reg.js', 'diegetic.js']) { try { require(path.join(SRC, f)); } catch (e) { console.log('  ! ' + f + ': ' + e.message); } }
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const D = VR.Diegetic;
if (!D || typeof D.trail !== 'function') { console.log('  ✗ VR.Diegetic.trail missing'); console.log('FAILED 1'); process.exit(1); }

// ---- the trail
const t = D.trail(0, 0, 0, -100);
check(t.length >= 10 && t.length <= 14, 'a far goal: 10–14 footprints (' + t.length + ')');
check(t.every(p => p.z < -1.5 && p.z > -16.5), 'all between 2 and 16 m ahead, toward the goal (−z)');
check(t.every((p, i) => i === 0 || p.z < t[i - 1].z), 'in order, nearest first');
check(t.some(p => p.x > 0) && t.some(p => p.x < 0), 'left, right, left — a walker\'s steps');
check(t.filter(p => p.lantern).length >= 2, 'a lantern among them every few steps');
check(t[0].k > t[t.length - 1].k || t[0].k === t[t.length - 1].k, 'the far ones no brighter than the near ones');
check(D.trail(0, 0, 0, -1.5).length === 0, 'at the goal (1.5 m): no trail');
const s = D.trail(0, 0, 0, -6);
check(s.length >= 2 && s.every(p => p.z > -6), 'a near goal (6 m): the trail stops short of it');
check(D.trail(0, 0, NaN, 3).length === 0, 'no goal: no trail');

// ---- the Wegweiser
check(D.sign(12) === null, 'no signpost under 20 m (the trail says it)');
const sg = D.sign(240);
check(sg && sg.at === 16, 'a far goal: the signpost at the trail\'s end (16 m)');

// ---- the vitals
const v0 = D.vitals(1, 1, 1);
check(v0.a === 0 && !v0.breath, 'healthy: no vignette, no breath');
const v1 = D.vitals(0.4, 1, 1), v2 = D.vitals(0.15, 1, 1);
check(v1.a > 0 && v2.a > v1.a && v2.a <= 0.7, 'lower health: a stronger edge (0.4 → ' + v1.a.toFixed(2) + ', 0.15 → ' + v2.a.toFixed(2) + ')');
check(v2.breath && !v1.breath, 'the breath under 35 %');
check(v2.kind === 'hurt', 'health low: the hurt edge');
const vf = D.vitals(1, 0.2, 1);
check(vf.a > 0 && vf.kind === 'hungry', 'hungry: its own edge (a cool one, not red)');
check(D.vitals(1, 1, 0.2).kind === 'air' && D.vitals(1, 1, 0.2).a > 0, 'the air running out: an edge too');
check(D.vitals(NaN, undefined, null).a === 0, 'nonsense in: nothing');

// ---- the radial
check(D.pick(0, 0, 8) === -1 && D.pick(0.1, 0.05, 8) === -1, 'the centre: nothing picked (a dead zone)');
check(D.pick(0, -1, 8) === 0, 'up: the first slice');
check(D.pick(1, 0, 8) === 2, 'right: the third of eight (clockwise)');
check(D.pick(0, 1, 8) === 4 && D.pick(-1, 0, 8) === 6, 'down: the fifth, left: the seventh');
check(D.wheelStep(0, -1, 8) === 7 && D.wheelStep(7, 1, 8) === 0 && D.wheelStep(-1, 1, 8) === 0, 'the wheel walks round the ring');
check(Array.isArray(D.RADIAL) && D.RADIAL.length === 8 && D.RADIAL.every(r => r.id && r.ico), 'eight things on the ring, each with an icon');

// ---- the star map's labels
const near = []; for (let i = 0; i < 1518; i++) near.push({ idx: i, d: (i * 7919) % 1500 + 1 });
const cap = D.capNear(near, 24);
check(cap.length === 24, 'creative\'s 1518 in reach → 24 labelled');
const kept = new Set(cap.map(q => q.idx)), maxIn = Math.max(...cap.map(q => q.d)), minOut = Math.min(...near.filter(q => !kept.has(q.idx)).map(q => q.d));
check(maxIn <= minOut && cap.every((q, i) => i === 0 || q.d >= cap[i - 1].d), 'the nearest ones, nearest first');
const few = [{ idx: 1, d: 3 }, { idx: 2, d: 1 }];
check(D.capNear(few, 24).length === 2, 'fewer than 24: all of them');

// ---- the settings and the words
const SR = VR.Settings;
for (const k of ['goalTrail', 'mapRose', 'bookStyle', 'satchel', 'vitals', 'radial']) {
  const it = SR && SR.byKey && SR.byKey(k);
  check(!!it, '⚙ ' + k + ' is a setting');
  if (it) check(VR.I18N.dict.de[it.lab] && VR.I18N.dict.en[it.lab] && VR.I18N.dict.de[it.tip] && VR.I18N.dict.en[it.tip], '  its label and tip in both languages');
}
check(SR.byKey('vitals').def === 'world' && SR.byKey('mapRose').def === true && SR.byKey('goalTrail').def === true, 'the calm defaults');
check(SR.SECTIONS.play.indexOf('ux') >= 0 && VR.I18N.dict.de['g.set.sec.ux'], 'its own section in ⚙ Spiel');
const keys = D.KEYS || [];
check(keys.length > 10 && keys.every(k => VR.I18N.dict.de[k] && VR.I18N.dict.en[k]), 'every text it shows in de and en (' + keys.length + ' keys)');
check(D.RADIAL.every(r => VR.I18N.dict.de[r.lab] && VR.I18N.dict.en[r.lab]), 'the ring\'s labels in both languages');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
