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
check(v1.a > 0 && v2.a > v1.a && v2.a <= 0.8, 'lower health: a stronger edge (0.4 → ' + v1.a.toFixed(2) + ', 0.15 → ' + v2.a.toFixed(2) + ')');
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

// ---- f-ux2: the trail along a walkable path, the soles, the forks, the doodles, the book's pairs
if (typeof D.trailPath === 'function') {
  // a path that goes 10 m north (−z), then turns east (+x) around a wall
  const poly = []; for (let i = 0; i <= 10; i++) poly.push([0, -i]); for (let i = 1; i <= 20; i++) poly.push([i, -10]);
  const tp = D.trailPath(poly);
  check(tp.length >= 10 && tp.length <= 14, 'trailPath: 10–14 steps along a bent path (' + tp.length + ')');
  check(tp.every(q => Math.abs(q.x) < 0.5 || Math.abs(q.z + 10) < 0.5), 'every step on the path (±0.5 m), none cuts the corner');
  check(tp.some(q => q.x > 3), 'the steps follow the turn east');
  check(tp.every((q, i) => i === 0 || q.side === -tp[i - 1].side), 'left, right, left along the path');
  const n0 = tp.find(q => q.s < 6), e0 = tp.find(q => q.s > 13);
  check(n0 && Math.abs(Math.sin(n0.h)) < 0.2 && e0 && Math.abs(Math.sin(e0.h) - 1) < 0.2, 'each step faces along its stretch (north, then east)');
  check(D.trailPath([[0, 0]]).length === 0 && D.trailPath(null).length === 0, 'no path: no steps');
  const fk = D.forks(poly, 40);
  check(fk.length === 1 && Math.abs(fk[0].x) < 2 && Math.abs(fk[0].z + 10) < 2, 'one Wegweiser at the turn (' + JSON.stringify(fk.map(f => [f.x.toFixed(1), f.z.toFixed(1)])) + ')');
  const straight = []; for (let i = 0; i <= 30; i++) straight.push([i * 0.7, -i]);
  check(D.forks(straight, 40).length === 0, 'no Wegweiser on a straight way');
  const jag = []; for (let i = 0; i <= 30; i++) jag.push([(i >> 1), -i]);   // (the grid's staircase: not a fork)
  check(D.forks(jag, 40).length === 0, 'the grid\'s staircase is no fork');
  const zig = [[0, 0]]; for (let i = 1; i <= 8; i++) zig.push([0, -i]); for (let i = 1; i <= 10; i++) zig.push([i, -8]); for (let i = 1; i <= 12; i++) zig.push([10, -8 - i]); for (let i = 1; i <= 12; i++) zig.push([10 + i, -20]);
  check(D.forks(zig, 40).length <= 2, 'at most two signs on the way');
  const buf = new Float32Array(400), n = D.sole(buf, 0, 0, 0, 0, 0, 1, 1);
  let ax = 0, az = 0; for (let i = 0; i < n; i += 3) { ax = Math.max(ax, Math.abs(buf[i])); az = Math.max(az, Math.abs(buf[i + 2])); }
  check(n > 0 && n % 9 === 0 && n <= D.SOLE_FLOATS, 'a sole: whole triangles (' + n / 9 + ')');
  check(az > ax * 1.8, 'the sole is stretched along its heading (' + az.toFixed(2) + ' × ' + ax.toFixed(2) + ' m)');
  const nL = D.sole(buf, 0, 0, 0, 0, 0, -1, 1); let cx = 0; for (let i = 0; i < nL; i += 3) cx += buf[i]; const nR = D.sole(buf, 0, 0, 0, 0, 0, 1, 1); let cr = 0; for (let i = 0; i < nR; i += 3) cr += buf[i];
  check(Math.sign(cx) !== Math.sign(cr), 'left and right soles are mirrored');
}
else check(false, 'D.trailPath missing');
if (typeof D.doodle === 'function') {
  let okAll = true, bad = '';
  for (const k of D.DOODLES) { const d = D.doodle(k, 7); const fl = d.flat(2); if (d.length < 3 || fl.some(v => !(v >= 0 && v <= 1))) { okAll = false; bad = k; } }
  check(okAll && D.DOODLES.length >= 10, 'every doodle (' + D.DOODLES.length + ') draws ≥ 3 pen strokes inside its box' + (bad ? ' — not ' + bad : ''));
  check(JSON.stringify(D.doodle('fox', 3)) === JSON.stringify(D.doodle('fox', 3)) && JSON.stringify(D.doodle('fox', 3)) !== JSON.stringify(D.doodle('fox', 4)), 'a doodle is the same for its seed, a little different for another (the hand)');
  check(D.doodleKind('creatures', 'fox') === 'fox' && D.doodleKind('creatures', 'pup') === 'pup' && D.doodleKind('people', 'Ida') === 'person' && D.doodleKind('recipes', 'herbsoup') === 'pot', 'the doodle for an entry: fox, pup, a person, a pot');
  check(D.DOODLES.indexOf(D.doodleKind('places', 'v:12')) >= 0 && D.DOODLES.indexOf(D.doodleKind('stickers', 'well')) >= 0, 'places and stickers find a doodle');
} else check(false, 'D.doodle missing');
if (typeof D.pairPages === 'function') {
  const pg = D.pairPages(['a', 'b', 'c', 'd', 'e']);
  check(pg.length === 5 && pg[0].map && pg[4].board && pg[1].html === 'ab' && pg[3].html === 'e', 'two sections a page: map · ab · cd · e · board');
} else check(false, 'D.pairPages missing');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
