// e-ctx · travel by intent (erlebnis §2; plan docs/superpowers/plans/2026-10-22-e-ctx.md §2.2): VR.Intent's pure parts.
//  (a) the means by distance and state: walk under 150 m, call 150 m – 8 km with a ship, fly in a ship, walk up to
//      1.5 km without one, refused beyond 8 km, another world only with a handler
//  (b) the aim: a target within 3° of the view ray snaps (a tall silhouette widens it, ≤ 8°), the nearest angle wins,
//      too near (< 20 m, or inside it) and too far (> 8 km) never
//  (c) the phases in order for walk, call and fly — never backwards
//  (d) cancel on every movement and flight key, the pad's and the touch stick; never on the mouse; a key held from
//      before the start does not cancel until it is pressed again; the 0.4-s blend back
//  (e) the called ship's way in: 10–30 s, above the ground under its route, a hover and a vertical settle, still on the
//      pad at the end; from over the horizon when it was far
//  (f) the pad: flat, dry, 12–30 m from the player, on the target's side; none on a slope or in water
//  (g) the walk: a path followed to its end (pure pursuit), the walk's stick from any view yaw
//  (h) a target source of a sibling (Intent.addSource) joins the list; the landmarks carry their phrase keys
const path = require('path');
const SRC = path.join(__dirname, '..', 'src', 'main');
global.VR = {};
Object.defineProperty(globalThis, 'navigator', { value: { language: 'de-DE', languages: ['de-DE', 'de'] }, configurable: true });
for (const f of ['i18n.js', 'lang_en.js', 'lang_de.js', 'binds.js', 'ctx.js', 'directorcam.js', 'intent.js']) { try { require(path.join(SRC, f)); } catch (e) { console.log('  ! ' + f + ': ' + e.message); } }
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const I = VR.Intent;
if (!I || typeof I.meansFor !== 'function') { console.log('  ✗ VR.Intent.meansFor missing'); console.log('FAILED 1'); process.exit(1); }
const DEG = Math.PI / 180;

console.log('a · the means');
const M = (o) => I.meansFor(Object.assign({ sameWorld: true, inShip: false, ship: true, spaceOk: false }, o));
check(M({ dist: 60 }).means === 'walk', 'a village 60 m away: walk');
check(M({ dist: 149 }).means === 'walk' && M({ dist: 151 }).means === 'call', '149 m walks, 151 m calls the ship');
check(M({ dist: 570 }).means === 'call', 'the citadel from the plaza (570 m): call the ship');
check(M({ dist: 7900 }).means === 'call' && M({ dist: 8100 }).means === null && M({ dist: 8100 }).why === 'far', '7.9 km calls, 8.1 km is too far');
check(M({ dist: 900, ship: false }).means === 'walk', 'no ship: walk 900 m');
check(M({ dist: 2000, ship: false }).means === null && M({ dist: 2000, ship: false }).why === 'noShip', 'no ship and 2 km: refused (noShip)');
check(M({ dist: 40, inShip: true }).means === 'fly' && M({ dist: 3000, inShip: true }).means === 'fly', 'in a ship: the autopilot at once, near or far');
check(M({ dist: 500, sameWorld: false }).means === null && M({ dist: 500, sameWorld: false }).why === 'other', 'another world without a handler: refused');
check(M({ dist: 500, sameWorld: false, spaceOk: true }).means === 'space', 'another world with a handler: space');

console.log('b · the aim');
const eye = [0, 82, 40];
const T = (id, x, z, base, top, r, kind) => ({ kind: kind || 'landmark', id, name: id, pos: [x, (base + top) / 2, z], base, top, r });
const citadel = T('citadel', -420, 380, 112, 249, 30), temple = T('temple', 0, -15, 80, 167, 52), village = T('v1', 300, 40, 70, 90, 40, 'village');
const toward = (q) => { const dx = q.pos[0] - eye[0], dy = q.pos[1] - eye[1], dz = q.pos[2] - eye[2], L = Math.hypot(dx, dy, dz); return [dx / L, dy / L, dz / L]; };
const rot = (d, yawOff, pitchOff) => { const yaw = Math.atan2(-d[0], -d[2]) + yawOff, pitch = Math.asin(d[1]) + pitchOff; return [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)]; };
const list = [citadel, temple, village];
let a = I.aimAt(list, eye, toward(citadel));
check(a && a.target === citadel && a.ang < 0.1 * DEG && Math.abs(a.dist - Math.hypot(-420, 340)) < 1, `straight at the citadel: it (${a && a.dist.toFixed(0)} m)`);
a = I.aimAt(list, eye, rot(toward(village), 2.5 * DEG, 0));
check(a && a.target === village, 'the village 2.5° beside the ray: snapped');
a = I.aimAt(list, eye, rot(toward(village), 5 * DEG, 0));
check(!a, 'the village 5° beside the ray (a low, wide town): not');
a = I.aimAt(list, eye, rot(toward(citadel), 0, 6 * DEG));
check(a && a.target === citadel, 'the citadel 6° above its centre (a 137-m silhouette, 570 m away): still it');
a = I.aimAt(list, eye, rot(toward(citadel), 12 * DEG, 0));
check(!a, 'the citadel 12° aside: not');
const near = T('wp', 5, 30, 81, 83, 1, 'waypoint');
check(!I.aimAt([near], eye, toward(near)), 'a waypoint 11 m away: too near to travel');
const far = T('far', 9000, 40, 80, 300, 30);
check(!I.aimAt([far], eye, toward(far)), 'a landmark 9 km away: too far');
const inside = T('nova', 10, 30, 80, 100, 95);
check(!I.aimAt([inside], eye, toward(inside)), 'standing inside Nova Haven: it is not a travel target');
const two = [T('a', 0, -300, 80, 120, 10), T('b', 30, -1000, 80, 400, 10)];
a = I.aimAt(two, eye, toward(two[0]));
check(a && a.target.id === 'a', 'of two along the same line, the one the ray points at most exactly');

console.log('c · the phases');
const seqOf = (means, frames) => { let ph = I.firstPhase(means); const out = [ph]; for (const s of frames) { const n = I.phaseOf(ph, Object.assign({ means }, s)); if (n !== ph) { ph = n; out.push(ph); } } return out; };
check(seqOf('walk', [{ dist: 80 }, { dist: 20 }, { dist: 2.5 }, { dist: 2.4, phaseT: 0.5 }, { dist: 2.4, phaseT: 1.3 }]).join(' ') === 'walk arrive done', 'walk: walk → arrive → done');
const flyF = [
  { boarded: true, fl: { state: 'landed', auto: true, y: 82, cruise: 140 }, dist: 560, brake: 200 },
  { boarded: true, fl: { state: 'flying', auto: true, y: 100, cruise: 140 }, dist: 555, brake: 200, phaseT: 2 },
  { boarded: true, fl: { state: 'flying', auto: true, y: 130, cruise: 140 }, dist: 500, brake: 200, phaseT: 6 },
  { boarded: true, fl: { state: 'flying', auto: true, y: 140, cruise: 140 }, dist: 420, brake: 200, phaseT: 3 },
  { boarded: true, fl: { state: 'flying', auto: true, y: 140, cruise: 140 }, dist: 300, brake: 200, phaseT: 5 },
  { boarded: true, fl: { state: 'flying', auto: true, y: 125, cruise: 140 }, dist: 250, brake: 200, phaseT: 1 },
  { boarded: true, fl: { state: 'flying', auto: true, y: 140, cruise: 140 }, dist: 450, brake: 200, phaseT: 2 },   // (a detour: no way back to cruise)
  { boarded: true, fl: { state: 'landing', auto: true, landing: true, y: 120, cruise: 140 }, dist: 2, brake: 200, phaseT: 9 },
  { boarded: true, fl: { state: 'landed', auto: false, y: 113, cruise: 140 }, dist: 1, brake: 200, phaseT: 4 },
  { boarded: true, fl: { state: 'landed', auto: false, y: 113, cruise: 140 }, dist: 1, brake: 200, phaseT: 1 },
  { boarded: true, fl: { state: 'landed', auto: false, y: 113, cruise: 140 }, dist: 1, brake: 200, phaseT: 3.1 },
];
const sFly = seqOf('fly', flyF);
check(sFly.join(' ') === 'takeoff cruise approach land arrive done', 'fly: ' + sFly.join(' → '));
const sCall = seqOf('call', [{ shipLanded: false }, { shipLanded: true }, { shipLanded: true, boarded: false, phaseT: 0.8 }, { shipLanded: true, boarded: true }].concat(flyF.slice(1)));
check(sCall.join(' ') === 'call board takeoff cruise approach land arrive done', 'call: ' + sCall.join(' → '));
check(I.PHASES.indexOf('cruise') < I.PHASES.indexOf('approach') && I.phaseOf('approach', { means: 'fly', boarded: true, fl: { state: 'flying', auto: true, y: 140, cruise: 140 }, dist: 900, brake: 200 }) === 'approach', 'a phase never goes back');

console.log('d · cancel');
const fakeInput = (o) => ({ hits: new Set(o.hit || []), downs: new Set(o.down || []), hit(n) { return this.hits.has(n); }, down(n) { return this.downs.has(n); }, padMove: o.pad || { fwd: 0, str: 0 }, touchMove: o.touch || { fwd: 0, str: 0 }, mouse: { dx: o.dx || 0, dy: o.dy || 0, wheel: o.wheel || 0 } });
const fresh = () => I.cancelState(fakeInput({}));
const MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
check(MOVE.every(k => I.wantsControl(fakeInput({ hit: [k], down: [k] }), fresh(), false)), 'every movement key takes over on foot (' + MOVE.length + ')');
check(['KeyX', 'KeyB', 'KeyG', 'KeyW', 'Space'].every(k => I.wantsControl(fakeInput({ hit: [k], down: [k] }), fresh(), true)), 'the flight keys take over in a ship');
check(I.wantsControl(fakeInput({ wheel: 1 }), fresh(), true) && !I.wantsControl(fakeInput({ wheel: 1 }), fresh(), false), 'the wheel takes over in a ship (the throttle), not on foot (the hotbar)');
check(!I.wantsControl(fakeInput({ dx: 40, dy: -25 }), fresh(), false) && !I.wantsControl(fakeInput({ dx: 40 }), fresh(), true), 'the mouse only looks: never a cancel');
const stHeld = I.cancelState(fakeInput({ down: ['KeyW'] }));
check(!I.wantsControl(fakeInput({ down: ['KeyW'] }), stHeld, false), 'W held from before the start: no cancel while it stays down');
check(I.wantsControl(fakeInput({ hit: ['KeyW'], down: ['KeyW'] }), stHeld, false), '… pressed again: it takes over');
const stPad = I.cancelState(fakeInput({ pad: { fwd: 0.8, str: 0 } }));
check(!I.wantsControl(fakeInput({ pad: { fwd: 0.8, str: 0 } }), stPad, false), 'a stick pushed since before the start: no cancel …');
I.wantsControl(fakeInput({ pad: { fwd: 0.05, str: 0 } }), stPad, false);
check(I.wantsControl(fakeInput({ pad: { fwd: 0.6, str: 0 } }), stPad, false), '… once it came back to the middle, a push takes over');
check(I.wantsControl(fakeInput({ touch: { fwd: 0, str: 0.7 } }), fresh(), false), 'the touch stick takes over');
check(I.wantsControl(fakeInput({ hit: ['KeyV'], down: ['KeyV'] }), fresh(), false), 'V on foot during a trip: it stops (and V does its own thing next)');
const A0 = { x: 0, y: 100, z: 0, yaw: 3.0, pitch: 0.2, fov: 1.2 }, B0 = { x: 10, y: 80, z: 20, yaw: -3.0, pitch: -0.1, fov: 1.0 }, o = {};
I.blend(A0, B0, 0, o); const b0 = Object.assign({}, o); I.blend(A0, B0, 1, o); const b1 = Object.assign({}, o); I.blend(A0, B0, 0.5, o);
check(b0.x === 0 && b1.x === 10 && b1.y === 80 && Math.abs(b1.yaw - -3.0) < 1e-9, 'the blend starts at the travel camera and ends at your view');
check(Math.abs(Math.abs(o.yaw) - Math.PI) < 0.05, `the blend turns the short way round (half way: ${o.yaw.toFixed(2)})`);
check(I.BLEND === 0.4, 'the blend back lasts 0.4 s');

console.log('e · the called ship');
const hill = (x, z) => 70 + 25 * Math.exp(-((x - 200) ** 2 + (z - 40) ** 2) / 3000);   // a hill on the route
const sample = (P, n) => { const out = []; for (let i = 0; i <= n; i++) out.push(I.arrivalAt(P, P.dur * i / n, {})); return out; };
for (const [label, from, parked] of [['a ship parked 300 m away', [300, 71, 40], true], ['a shuttle 3 km out', [3000, 140, 40], false], ['a ship 160 m away', [-160, 81, 40], true]]) {
  const P = I.arrival({ pos: from, yaw: 0, parked }, [10.5, 82, 52.5], { ground: hill, faceYaw: 1.2, size: 7 });
  const pts = sample(P, 600);
  let clear = Infinity, drift = 0, end = pts[pts.length - 1];
  for (const q of pts) { const gnd = hill(q.pos[0], q.pos[2]); if (Math.hypot(q.pos[0] - 10.5, q.pos[2] - 52.5) > 30 && Math.hypot(q.pos[0] - P.start[0], q.pos[2] - P.start[2]) > 30) clear = Math.min(clear, q.pos[1] - gnd); if (q.stage === 'settle' || q.stage === 'down') drift = Math.max(drift, Math.hypot(q.pos[0] - 10.5, q.pos[2] - 52.5)); }
  check(P.dur >= 10 && P.dur <= 30, `${label}: ${P.dur.toFixed(1)} s (10–30)`);
  check(clear >= 12, `${label}: ≥ 12 m over the ground on the way, away from its start and the pad (${clear.toFixed(1)} m)`);
  check(drift <= 0.6 && P.hoverY - 82 >= 18, `${label}: the last ${(P.hoverY - 82).toFixed(0)} m straight down (drift ${drift.toFixed(2)} m)`);
  check(Math.abs(end.pos[0] - 10.5) < 0.01 && Math.abs(end.pos[1] - 82) < 0.01 && Math.abs(end.pos[2] - 52.5) < 0.01 && end.speed < 0.05 && end.gear === 1, `${label}: on the pad at the end, still, gear down`);
  check(Math.abs(((end.yaw - 1.2 + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI) < 0.02, `${label}: facing the way to the target (${end.yaw.toFixed(2)})`);
  if (!parked) check(Math.hypot(P.start[0] - 10.5, P.start[2] - 52.5) <= 401, `${label}: it comes in over the horizon (from ${Math.hypot(P.start[0] - 10.5, P.start[2] - 52.5).toFixed(0)} m)`);
}

console.log('f · the pad');
const flat = (x, z) => 81;
const pad = I.pickPad(flat, [0.5, 82, 40.5], { toward: [-420, 380], ext: [5, 8] });
const dp = pad && Math.hypot(pad[0] - 0.5, pad[2] - 40.5), side = pad && ((pad[0] - 0.5) * -420 + (pad[2] - 40.5) * 340) / (dp * Math.hypot(420, 340));
check(pad && dp >= 12 && dp <= 30 && pad[1] === 82, `a flat plaza: a pad ${dp && dp.toFixed(1)} m away at y ${pad && pad[1]}`);
check(side > 0.5, `on the target's side (cos ${side && side.toFixed(2)})`);
const slope = (x, z) => 81 + Math.round(x * 0.4);
check(!I.pickPad(slope, [0.5, 82, 40.5], { toward: [-420, 380], ext: [5, 8] }), 'a steep slope all round: no pad');
const pond = (x, z) => (Math.hypot(x + 25, z - 60) < 22 ? -1 : 81);   // a pond 10 m from the player, toward the target
const pp = I.pickPad(pond, [0.5, 82, 40.5], { toward: [-420, 380], ext: [5, 8] });
check(pp && Math.hypot(pp[0] + 25, pp[2] - 60) >= 22 + 5, `a pond on the target side: the pad is on dry land (${pp && Math.hypot(pp[0] + 25, pp[2] - 60).toFixed(1)} m from its middle)`);
check(!I.pickPad((x, z) => null, [0.5, 82, 40.5], { toward: [-420, 380], ext: [5, 8] }), 'nothing loaded: no pad (yet)');

console.log('g · the walk');
const pathL = [[0, 0], [10, 0], [10, 10], [20, 10]];
let pos = [0, 0], fin = false, steps = 0, fst = I.followState();
for (; steps < 400 && !fin; steps++) { const f = I.follow(pathL, pos, fst); if (f.done) { fin = true; break; } const dx = f.tx - pos[0], dz = f.tz - pos[1], L = Math.hypot(dx, dz) || 1; pos = [pos[0] + dx / L * 0.15, pos[1] + dz / L * 0.15]; }
check(fin && Math.hypot(pos[0] - 20, pos[1] - 10) < 2, `an L-shaped path followed to its end in ${steps} steps`);
const st2 = I.stickFor(0.7, [1, 0]);   // looking 0.7 rad left of north, walking east
const yaw = 0.7, sy = Math.sin(yaw), cy = Math.cos(yaw), wx = -sy * st2.fwd + cy * st2.str, wz = -cy * st2.fwd - sy * st2.str;
check(Math.abs(wx - 1) < 1e-6 && Math.abs(wz) < 1e-6, 'the walk stick moves east whatever way the player looks');

console.log('h · the targets');
const extra = () => [{ kind: 'quest', id: 'q1', name: 'Mehl für Mara', pos: [50, 80, 50], r: 2 }];
I.addSource(extra);
const fakeG = { state: 'play', dim: 'overworld', meta: { vgen: 11, type: 'default' }, player: { pos: [0, 82, 40] }, villages: { list: () => [{ id: 'v1', name: 'Lindenau', x: 300, y: 70, z: 40, rad: 40 }] }, gadgets: { waypoints: [{ x: 20, y: 81, z: -60, name: 'Mein Haus' }] }, wonders: null };
const tl = I.collect(fakeG);
const ids = tl.map(q => q.kind + ':' + q.id);
check(['landmark:citadel', 'landmark:temple', 'landmark:isles', 'landmark:nova', 'landmark:station', 'landmark:hills', 'village:v1', 'waypoint:wp0', 'quest:q1'].every(k => ids.includes(k)), 'the Heartland\'s landmarks, the village, the waypoint and the sibling\'s quest: ' + ids.join(', '));
const cq = tl.find(q => q.id === 'citadel');
check(cq && cq.toKey === 'g.ctx.to.citadel' && cq.name && cq.top > 200 && cq.r === 30, `the citadel: „${cq && cq.name}", its phrase key, its silhouette (top ${cq && cq.top})`);
const vq = tl.find(q => q.id === 'v1');
check(vq && vq.toKey === 'g.ctx.toPlace' && vq.name === 'Lindenau', 'a village: nach ‹Name›');
check(I.collect(Object.assign({}, fakeG, { meta: { vgen: 11, type: 'flat' } })).every(q => q.kind !== 'landmark'), 'a flat world has no Heartland landmarks');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
