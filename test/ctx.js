// e-ctx · the action key (erlebnis §1; plan docs/superpowers/plans/2026-10-22-e-ctx.md §2.1): VR.Ctx.resolve is pure —
// the six rows, the first match wins — and every label it can show is in both tables.
//  (a) 44 situations through Ctx.resolve: a tool claims V, the vehicles (ship flying / landed / landing, bike, seat,
//      tram, a cabin aboard, space: bay, body, escape), a story beat, something in reach (villager, quest giver, door
//      open / shut, gate, chest, bed, ship, bike, beacon, machine, shop, portal, vista bench, pet, seat) — out of reach and
//      out of the 6° cone fall through —, a travel target in the aim, Funke, nothing
//  (b) every key resolve returns, and every key of Ctx.LABELS, is in the de and the en table with the same placeholders
//  (c) the prompt: „[V] Mit Mara reden", „[V] Reise zur Turmzitadelle · 1,2 km", English, a rebound key, distances
//  (d) Ctx.pickNear: the nearest thing in the cone within reach; Ctx.press: a tap acts on release, a hold fills the
//      Heimkehr ring 0.3 → 1.5 s and fires once, letting go early cancels, no ring in a vehicle
//  (e) resolve ≤ 0.05 ms (10,000 calls over the situations)
const path = require('path');
const SRC = path.join(__dirname, '..', 'src', 'main');
global.VR = {};
Object.defineProperty(globalThis, 'navigator', { value: { language: 'de-DE', languages: ['de-DE', 'de'] }, configurable: true });
for (const f of ['i18n.js', 'lang_en.js', 'lang_de.js', 'binds.js', 'ctx.js']) { try { require(path.join(SRC, f)); } catch (e) { console.log('  ! ' + f + ': ' + e.message); } }
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const C = VR.Ctx, I = VR.I18N;
if (!C || typeof C.resolve !== 'function') { console.log('  ✗ VR.Ctx.resolve missing'); console.log('FAILED 1'); process.exit(1); }
const DEG = Math.PI / 180;

console.log('a · the situations (first match wins)');
const vil = { kind: 'villager', name: 'Mara', dist: 3, ang: 2 * DEG };
const cit = { kind: 'landmark', id: 'citadel', name: 'Turmzitadelle', toKey: 'g.ctx.to.citadel', dist: 1204 };
const town = { kind: 'village', id: 'v3', name: 'Lindenau', toKey: 'g.ctx.toPlace', dist: 640 };
const S = [
  // [name, context, expected {row, id, key, act}]
  ['nothing, no Funke', {}, { row: 6, id: 'none', key: null, act: 'whisper' }],
  ['nothing, Funke there', { funke: true }, { row: 6, id: 'funke', key: 'g.ctx.funke', act: 'funke' }],
  ['the wand holds a copy', { tool: { id: 'paste' } }, { row: 1, id: 'tool', key: 'g.ctx.paste', act: 'tool' }],
  ['the wand + a villager in reach', { tool: { id: 'paste' }, near: vil }, { row: 1, id: 'tool', key: 'g.ctx.paste', act: 'tool' }],
  ['a ship in the air', { vehicle: { kind: 'ship', state: 'flying' } }, { row: 2, id: 'vehicle', key: 'g.ctx.land', act: 'vehicle' }],
  ['a ship on the ground', { vehicle: { kind: 'ship', state: 'landed' } }, { row: 2, id: 'vehicle', key: 'g.ctx.getOut', act: 'vehicle' }],
  ['a ship landing', { vehicle: { kind: 'ship', state: 'landing' } }, { row: 2, id: 'vehicle', key: 'g.ctx.landCancel', act: 'vehicle' }],
  ['a block ship in the air', { vehicle: { kind: 'blockship', state: 'flying' } }, { row: 2, id: 'vehicle', key: 'g.ctx.land', act: 'vehicle' }],
  ['on the hoverbike', { vehicle: { kind: 'bike' } }, { row: 2, id: 'vehicle', key: 'g.ctx.dismount', act: 'vehicle' }],
  ['on a seat', { vehicle: { kind: 'seat' } }, { row: 2, id: 'vehicle', key: 'g.ctx.standUp', act: 'vehicle' }],
  ['in the tram', { vehicle: { kind: 'tram' } }, { row: 2, id: 'vehicle', key: 'g.ctx.getOut', act: 'vehicle' }],
  ['walking aboard a shuttle', { vehicle: { kind: 'cabin' } }, { row: 2, id: 'vehicle', key: 'g.ctx.pilotSeat', act: 'vehicle' }],
  ['in space at a bay', { vehicle: { kind: 'ship', state: 'flying', space: 'bay' } }, { row: 2, id: 'vehicle', key: 'g.ctx.dock', act: 'dock' }],
  ['in space over a body', { vehicle: { kind: 'ship', state: 'flying', space: 'body' } }, { row: 2, id: 'vehicle', key: 'g.ctx.landOn', act: 'landBody' }],
  ['in space on an escape path', { vehicle: { kind: 'ship', state: 'flying', space: 'escape' } }, { row: 2, id: 'vehicle', key: 'g.ctx.orbit', act: 'orbit' }],
  ['a ship in the air, the citadel in the aim', { vehicle: { kind: 'ship', state: 'flying' }, aim: cit }, { row: 2, id: 'vehicle', key: 'g.ctx.land', act: 'vehicle' }],
  ['a story beat offered', { story: { id: 'ch1' } }, { row: 3, id: 'story', key: 'g.ctx.watch', act: 'story' }],
  ['a story beat + a villager in reach', { story: { id: 'ch1' }, near: vil }, { row: 3, id: 'story', key: 'g.ctx.watch', act: 'story' }],
  ['Mara 3 m ahead', { near: vil }, { row: 4, id: 'near', key: 'g.ctx.talk', act: 'talk' }],
  ['Mara 5 m ahead: out of reach', { near: Object.assign({}, vil, { dist: 5 }) }, { row: 6, id: 'none', key: null, act: 'whisper' }],
  ['Mara 3 m but 10° aside: out of the cone', { near: Object.assign({}, vil, { ang: 10 * DEG }) }, { row: 6, id: 'none', key: null, act: 'whisper' }],
  ['a quest giver', { near: { kind: 'quest', name: 'Ole', dist: 2.5, ang: 1 * DEG } }, { row: 4, id: 'near', key: 'g.ctx.quest', act: 'talk' }],
  ['a shut door', { near: { kind: 'door', open: false, dist: 2, ang: 0 } }, { row: 4, id: 'near', key: 'g.ctx.open', act: 'use' }],
  ['an open door', { near: { kind: 'door', open: true, dist: 2, ang: 0 } }, { row: 4, id: 'near', key: 'g.ctx.close', act: 'use' }],
  ['a gate', { near: { kind: 'gate', open: false, dist: 3, ang: 0 } }, { row: 4, id: 'near', key: 'g.ctx.open', act: 'use' }],
  ['a chest', { near: { kind: 'chest', dist: 2, ang: 0 } }, { row: 4, id: 'near', key: 'g.ctx.chest', act: 'use' }],
  ['a bed', { near: { kind: 'bed', dist: 2, ang: 0 } }, { row: 4, id: 'near', key: 'g.ctx.sleep', act: 'use' }],
  ['a parked ship', { near: { kind: 'ship', name: 'Kestrel', dist: 4, ang: 3 * DEG } }, { row: 4, id: 'near', key: 'g.ctx.board', act: 'board' }],
  ['a hoverbike', { near: { kind: 'vehicle', dist: 2, ang: 0 } }, { row: 4, id: 'near', key: 'g.ctx.board', act: 'board' }],
  ['a broken beacon', { near: { kind: 'beacon', broken: true, dist: 3, ang: 0 } }, { row: 4, id: 'near', key: 'g.ctx.repair', act: 'beacon' }],
  ['a freed beacon', { near: { kind: 'beacon', broken: false, dist: 3, ang: 0 } }, { row: 4, id: 'near', key: 'g.ctx.fast', act: 'beacon' }],
  ['a stray machine', { near: { kind: 'machine', dist: 4, ang: 0 } }, { row: 4, id: 'near', key: 'g.ctx.calm', act: 'calm' }],
  ['a shop counter', { near: { kind: 'shop', dist: 2, ang: 0 } }, { row: 4, id: 'near', key: 'g.ctx.shop', act: 'shop' }],
  ['a portal', { near: { kind: 'portal', dist: 3, ang: 0 } }, { row: 4, id: 'near', key: 'g.ctx.portal', act: 'portal' }],
  ['a vista bench', { near: { kind: 'bench', dist: 2, ang: 0 } }, { row: 4, id: 'near', key: 'g.ctx.view', act: 'vista' }],
  ['a pet', { near: { kind: 'pet', name: 'Fips', dist: 1.5, ang: 0 } }, { row: 4, id: 'near', key: 'g.ctx.pet', act: 'pet' }],
  ['a seat', { near: { kind: 'seat', dist: 2, ang: 0 } }, { row: 4, id: 'near', key: 'g.ctx.sit', act: 'use' }],
  ['the citadel in the aim, 1.2 km', { aim: cit }, { row: 5, id: 'travel', key: 'g.ctx.travel', act: 'travel' }],
  ['a village in the aim, 640 m', { aim: town }, { row: 5, id: 'travel', key: 'g.ctx.travel', act: 'travel' }],
  ['Mara in reach + the citadel in the aim', { near: vil, aim: cit }, { row: 4, id: 'near', key: 'g.ctx.talk', act: 'talk' }],
  ['Mara out of reach + the citadel in the aim', { near: Object.assign({}, vil, { dist: 6 }), aim: cit }, { row: 5, id: 'travel', key: 'g.ctx.travel', act: 'travel' }],
  ['a target 12 m away: too near to travel', { aim: Object.assign({}, town, { dist: 12 }) }, { row: 6, id: 'none', key: null, act: 'whisper' }],
  ['a target 9 km away: too far', { aim: Object.assign({}, cit, { dist: 9000 }) }, { row: 6, id: 'none', key: null, act: 'whisper' }],
  ['Funke + the citadel in the aim', { funke: true, aim: cit }, { row: 5, id: 'travel', key: 'g.ctx.travel', act: 'travel' }],
];
check(S.length >= 40, `${S.length} situations`);
for (const [name, c, want] of S) {
  const r = C.resolve(c);
  const ok = r && r.row === want.row && r.id === want.id && r.key === want.key && r.act === want.act;
  check(ok, `${name} → row ${want.row} ${want.key || '(no prompt)'} · ${want.act}` + (ok ? '' : ` — got ${JSON.stringify(r)}`));
}
const rt = C.resolve({ near: vil }), rtr = C.resolve({ aim: cit });
check(rt.vars && rt.vars.name === 'Mara', 'the villager row carries the name');
check(rtr.vars && rtr.vars.toKey === 'g.ctx.to.citadel' && rtr.vars.m === 1204 && rtr.target === cit, 'the travel row carries the phrase key, the metres and the target');
check(C.resolve(null).id === 'none' && C.resolve(undefined).id === 'none', 'no context at all: nothing');
check(S.every(([, c]) => { const r = C.resolve(c); return typeof r.icon === 'string' && r.icon.length > 0; }), 'every row has an icon for the touch button');

console.log('b · the labels in both tables');
const en = I.dict.en || {}, de = I.dict.de || {};
const keys = new Set(Object.keys(C.LABELS || {}));
for (const [, c] of S) { const r = C.resolve(c); if (r.key) keys.add(r.key); if (r.vars && r.vars.toKey) keys.add(r.vars.toKey); }
for (const k of ['ctl.veh', 'g.ctx.home', 'g.ctx.whisper', 'g.ctx.nothing', 'touch.act']) keys.add(k);
const ph = (v) => { const set = new Set(); for (const m of String(v).matchAll(/\{(\w+)\}/g)) set.add(m[1]); return [...set].sort().join(','); };
const miss = [...keys].filter(k => !(k in de) || !(k in en));
check(!miss.length, `${keys.size} labels, each in de and en` + (miss.length ? ': missing ' + miss.join(', ') : ''));
const phBad = [...keys].filter(k => k in de && k in en && ph(de[k]) !== ph(en[k]));
check(!phBad.length, 'their {placeholders} match' + (phBad.length ? ': ' + phBad.join(', ') : ''));
const labBad = Object.keys(C.LABELS || {}).filter(k => k in de && (C.LABELS[k][0] !== de[k] || C.LABELS[k][1] !== en[k]));
check(!labBad.length, 'Ctx.LABELS say the same words as the tables' + (labBad.length ? ': ' + labBad.join(', ') : ''));
check(de['ctl.veh'] === 'Aktion (Kontext)', `the key's label: „${de['ctl.veh']}" (the id stays veh)`);
check(VR.Binds && VR.Binds.byId('veh') && VR.Binds.byId('veh').names[0] === 'KeyV', 'binds.js keeps the id veh on KeyV (saved bindings keep working)');

console.log('c · the prompt');
I.lang = 'de';
const tx = (c) => C.text(C.resolve(c), 'KeyV');
check(tx({ near: vil }) === '[V] Mit Mara reden', `„${tx({ near: vil })}"`);
check(tx({ aim: cit }) === '[V] Reise zur Turmzitadelle · 1,2 km', `„${tx({ aim: cit })}"`);
check(tx({ aim: town }) === '[V] Reise nach Lindenau · 640 m', `„${tx({ aim: town })}"`);
check(tx({ near: { kind: 'ship', dist: 3, ang: 0 } }) === '[V] Einsteigen', `„${tx({ near: { kind: 'ship', dist: 3, ang: 0 } })}"`);
check(tx({}) === '', 'nothing (no Funke): no prompt');
check(C.text(C.resolve({ near: vil }), 'KeyB') === '[B] Mit Mara reden', 'a rebound key shows its own letter');
I.lang = 'en';
check(tx({ near: vil }) === '[V] Talk to Mara', `English: „${tx({ near: vil })}"`);
check(tx({ aim: cit }) === '[V] Travel to the Spire Citadel · 1.2 km', `English: „${tx({ aim: cit })}"`);
I.lang = 'de';
const dist = (m, l) => C.dist(m, l);
check(dist(640, 'de') === '640 m' && dist(1204, 'de') === '1,2 km' && dist(1204, 'en') === '1.2 km' && dist(12400, 'de') === '12 km' && dist(23, 'de') === '20 m' && dist(996, 'de') === '1,0 km', `distances: ${[640, 1204, 12400, 23, 996].map(m => dist(m, 'de')).join(' · ')}`);

console.log('d · near and press');
const eye = [0, 1.6, 0], fwd = [0, 0, -1];
const things = [
  { kind: 'villager', name: 'Mara', pos: [0.2, 1.4, -3] },     // 3 m ahead, a few degrees off
  { kind: 'villager', name: 'Ben', pos: [0, 1.4, -4.2] },      // farther along the same line
  { kind: 'pet', name: 'Fips', pos: [2.5, 0.6, -2] },          // 40° aside
  { kind: 'ship', name: 'Kestrel', pos: [0, 2, -8], r: 5 },   // its hull's centre 8 m, its side within reach
];
const n1 = C.pickNear(eye, fwd, things);
check(n1 && n1.name === 'Mara' && n1.dist < 3.2 && n1.ang < 6 * DEG, `the nearest in the cone: ${n1 && n1.name} (${n1 && n1.dist.toFixed(2)} m, ${n1 && (n1.ang / DEG).toFixed(1)}°)`);
const n2 = C.pickNear(eye, [Math.sin(-40 * DEG), 0, -Math.cos(40 * DEG)], [things[2]]);
check(!n2, 'a thing 40° aside is not picked');
const n3 = C.pickNear(eye, [0, 0, -1], [things[3]]);
check(n3 && n3.name === 'Kestrel' && n3.dist <= 4.5, `a ship: its hull counts (the surface, not the centre): ${n3 && n3.dist.toFixed(1)} m`);
// a parked ship's hull as cells x 2..9, y 0..3, z −6..−2 (turned: its box reaches round you), you stand at the box's corner
const hull = (x, y, z) => x >= 2 && x <= 9 && y >= 0 && y <= 3 && z >= -6 && z <= -2;
const eyeS = [0.5, 1.6, -0.5];
const hTo = C.hullAlong(eyeS, [1, 0, -1], 4.5, hull), hAway = C.hullAlong(eyeS, [-1, 0.2, 0.3], 4.5, hull), hPast = C.hullAlong(eyeS, [0, 0.1, -1], 4.5, hull);
check(hTo !== null && hTo > 1.5 && hTo < 3.5, `beside a parked ship, looking at its hull: hit at ${hTo !== null ? hTo.toFixed(1) : '—'} m`);
check(hAway === null && hPast === null, 'looking away from it, or along it past its nose: no hit (its box would say 0 m — after a trip every V boarded)');
// press: tap, hold, cancel
const run = (seq, ring) => { const st = C.pressState(), out = []; for (const [down, dt] of seq) { const r = C.press(st, down, dt, ring); out.push(r); } return out; };
let o = run([[true, 0], [true, 0.1], [false, 0.016]], true);
check(o[2].act === 'tap' && o.slice(0, 2).every(r => !r.act && r.ring === 0), 'a tap of 0.1 s acts on release, no ring shown');
const hold = []; for (let i = 0; i < 100; i++) hold.push([true, 1 / 60]);
o = run(hold.concat([[false, 1 / 60]]), true);
const fired = o.filter(r => r.act === 'home'), firstHome = o.findIndex(r => r.act === 'home');
check(fired.length === 1 && Math.abs(firstHome / 60 - 1.5) < 0.04, `held: Heimkehr once at ${(firstHome / 60).toFixed(2)} s`);
check(o[30].ring > 0 && o[30].ring < 0.25 && o[80].ring > 0.8, `the ring fills (0.5 s: ${o[30].ring.toFixed(2)}, 1.33 s: ${o[80].ring.toFixed(2)})`);
check(!o[o.length - 1].act, 'letting go after Heimkehr does nothing more');
o = run(hold.slice(0, 50).concat([[false, 1 / 60]]), true);
check(!o.some(r => r.act), 'let go at 0.83 s: cancelled, no action and no Heimkehr');
o = run(hold, false);
check(!o.some(r => r.act === 'home') && o.every(r => r.ring === 0), 'in a vehicle (no ring): holding never goes home');

console.log('e · cost');
const ctxs = S.map(s => s[1]);
let t0 = process.hrtime.bigint(), sink = 0;
for (let i = 0; i < 10000; i++) sink += C.resolve(ctxs[i % ctxs.length]).row;
const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 10000;
check(ms <= 0.05 && sink > 0, `resolve: ${(ms * 1000).toFixed(2)} µs a call (≤ 50 µs)`);

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
