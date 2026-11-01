// o-seamless (docs/superpowers/plans/2026-11-01-o-seamless.md): the pure part of the journeys (src/main/journey_core.js)
//  a · the Himmelsleiter: phases board → ground → space → arrive → done, 40–70 s, the height rises steadily, the hand-off
//      and the world switch under the space phase, the arrival waits for the station
//  b · the Lichtbrücke: the walk (W faster, S slower, never a stop), 21–50 s, the world switch at 18 m, the arrival waits
//  c · the caravan: the next place, the path, the ride's position and heading, the lines, the moment, getting off
//  d · skip: after 2 s to the end (lift, bridge); a ride's skip gets you off
//  e · save / resume mid-journey (and odd records)
//  f · the rules: who may start a journey, film or walk (Very Low keeps the film)
//  g · every text key in both tables
//   bash test/wt_run.sh journey.js 300
const V = require('./load_shared.js');
const path = require('path'), fs = require('fs');
require('../src/main/i18n.js'); require('../src/main/lang_en.js'); require('../src/main/lang_de.js');
const corePath = path.join(__dirname, '..', 'src', 'main', 'journey_core.js');
if (fs.existsSync(corePath)) require(corePath);
let fails = 0;
const check = (ok, what) => { console.log((ok ? '  ✓ ' : '  ✗ ') + what); if (!ok) fails++; };
const K = V.JourneyCore;
check(!!K && typeof K.start === 'function', 'VR.JourneyCore loads in node');
if (!K) { console.log('FAILED 1'); process.exit(1); }
const run = (st, inp, dtS, maxT) => { const ev = []; let t = 0; const dt = dtS || 0.05; while (st.ph !== 'done' && t < (maxT || 400)) { const i = typeof inp === 'function' ? inp(st, t) : inp; for (const e of K.step(st, dt, i)) ev.push([+(t + dt).toFixed(2), e]); t += dt; } return { ev, t }; };
const first = (r, name) => { const e = r.ev.find(x => x[1] === name || String(x[1]).indexOf(name + ':') === 0); return e ? e[0] : null; };

console.log('a · the Himmelsleiter');
{
  const st = K.start('lift', { from: 'overworld', to: 'stn.ring', top: 52900, seed: 7 });
  check(st.ph === 'board' && st.kind === 'lift', 'a lift starts boarding');
  let mono = true, last = -1, alt24 = 0;
  const r = run(st, (s) => { const a = K.at(s).alt; if (a < last - 1e-6) mono = false; last = a; if (Math.abs(s.t - 24) < 0.03) alt24 = a; return { loaded: s.t > 40 }; });
  check(r.t >= 40 && r.t <= 70, 'it takes ' + r.t.toFixed(1) + ' s (40–70)');
  check(mono, 'the cabin only rises');
  check(Math.abs(last - (52900 - K.LIFT.stop)) < 1, 'it stops ' + K.LIFT.stop + ' m under the station (' + last.toFixed(0) + ' m)');
  const hand = first(r, 'handoff'), dep = first(r, 'depart'), arr = first(r, 'arrive');
  check(hand !== null && Math.abs(hand - K.LIFT.ground) < 0.1, 'the hand-off to space at ' + hand + ' s');
  check(dep !== null && dep === hand, 'the world switch starts under the space phase (' + dep + ' s)');
  check(alt24 > 2000 && alt24 <= K.LIFT.hand + 1, 'at the hand-off the cabin is ' + alt24.toFixed(0) + ' m up (the climb band\'s top)');
  const a5 = K.liftAlt(K.LIFT.board + 5, 52900), a10 = K.liftAlt(K.LIFT.board + 10, 52900);
  check(a5 < 150 && a10 > 200 && a10 < 600, 'a slow start: the land shrinks (5 s: ' + a5.toFixed(0) + ' m, 10 s: ' + a10.toFixed(0) + ' m)');
  check(arr !== null && arr >= K.LIFT.len, 'the arrival at ' + arr + ' s');
  const st2 = K.start('lift', { from: 'overworld', to: 'stn.ring', top: 52900 });
  const r2 = run(st2, { loaded: false }, 0.1, 90);
  check(st2.ph === 'space' && !r2.ev.some(e => e[1] === 'arrive') && Math.abs(K.at(st2).alt - (52900 - K.LIFT.stop)) < 1, 'the arrival waits for the station (the cabin holds at the top)');
  check(K.at(st2).phase === 'space' && K.at(K.start('lift', { top: 52900 })).phase === 'board', 'K.at tells the phase');
}

console.log('b · the Lichtbrücke');
{
  const glide = run(K.start('bridge', { from: 'overworld', to: 'aqua' }), { loaded: true });
  const walk = run(K.start('bridge', { from: 'overworld', to: 'aqua' }), { fwd: true, loaded: true });
  check(glide.t >= 21 && glide.t <= 50, 'carried along: ' + glide.t.toFixed(1) + ' s (21–50)');
  check(walk.t >= 21 && walk.t <= 50 && walk.t < glide.t - 15, 'walking (W): ' + walk.t.toFixed(1) + ' s');
  const st = K.start('bridge', { from: 'overworld', to: 'aqua' });
  for (let i = 0; i < 100; i++) K.step(st, 0.05, { back: true });
  check(st.s > 0 && st.s < 5, 'S slows, never stops (' + st.s.toFixed(2) + ' m after 5 s)');
  const dep = walk.ev.find(e => e[1] === 'depart');
  check(!!dep && walk.ev.filter(e => e[1] === 'depart').length === 1, 'the world switch once (at ' + (dep && dep[0]) + ' s)');
  const st2 = K.start('bridge', { from: 'overworld', to: 'aqua' });
  run(st2, { fwd: true, loaded: false }, 0.1, 80);
  check(st2.ph === 'way' && st2.s === K.BRIDGE.len, 'the gate at the end waits for the world');
  K.step(st2, 0.1, { loaded: true });
  check(st2.ph === 'arrive', '… then the arrival');
  check(K.at(st2).k === 1, 'K.at: the walk\'s share');
}

console.log('c · the caravan');
{
  const places = [{ id: 'a', x: 0, z: 0 }, { id: 'b', x: 60, z: 0 }, { id: 'c', x: 400, z: 0 }, { id: 'd', x: 0, z: 300 }, { id: 'e', x: 5000, z: 0 }];
  const pk = K.pickRide(places, [0, 0], {});
  check(pk && pk.id === 'd', 'the next place: the nearest 150–900 m away (' + (pk && pk.id) + ')');
  const pk2 = K.pickRide(places, [0, 0], { d: 1 });
  check(pk2 && pk2.id === 'c', 'a place not yet seen first (' + (pk2 && pk2.id) + ')');
  check(K.pickRide(places.slice(0, 2), [0, 0], {}) === null, 'nothing in reach: no ride');
  const P = K.ridePath([0, 0], [400, 0], 11), L = K.rideLen(P);
  check(P.length > 40 && L >= 400 && L < 440, 'the path: ' + P.length + ' points, ' + L.toFixed(0) + ' m (a gentle bend)');
  check(JSON.stringify(P) === JSON.stringify(K.ridePath([0, 0], [400, 0], 11)), 'the same seed, the same path');
  const o = K.rideAt(P, L / 2, {}), e = K.rideAt(P, L + 50, {});
  check(Math.abs(o.x - 200) < 30 && Math.abs(e.x - 400) < 0.01 && Number.isFinite(o.yaw) && Math.abs(Math.abs(o.yaw) - Math.PI / 2) < 0.4, 'the ride\'s place and heading along it');
  const st = K.start('ride', { from: 'overworld', to: 'c', path: P, seed: 3 });
  const r = run(st, (s) => ({ slow: s.s > 100 && s.s < 120 }));
  const lines = r.ev.filter(x => String(x[1]).indexOf('line:') === 0);
  check(lines.length === 2 && lines.every(l => K.keys().indexOf(String(l[1]).slice(5)) >= 0), 'two lines from the driver: ' + lines.map(l => l[1]).join(', '));
  check(r.ev.filter(x => x[1] === 'moment').length === 1, 'one moment on the way');
  check(r.t > L / K.RIDE.speed && r.t < L / K.RIDE.speed + 15, 'the ride takes ' + r.t.toFixed(1) + ' s (' + K.RIDE.speed + ' m/s, slower near a moment)');
  check(r.ev.some(x => x[1] === 'arrive') && r.ev.some(x => x[1] === 'done'), 'the arrival, then off the cart');
}

console.log('d · skip');
{
  const st = K.start('lift', { from: 'overworld', to: 'stn.ring', top: 52900 });
  K.step(st, 1, {}); check(!K.skip(st), 'not in the first 2 s');
  K.step(st, 1.5, {}); check(K.skip(st) && st.t === K.LIFT.len, 'after 2 s: to the top');
  const ev = K.step(st, 0.05, { loaded: false });
  check(ev.indexOf('handoff') >= 0 && ev.indexOf('depart') >= 0, 'a skipped lift still switches the world');
  const b = K.start('bridge', { from: 'overworld', to: 'aqua' }); K.step(b, 3, {});
  check(K.skip(b) && b.s === K.BRIDGE.len, 'a bridge skips to its gate');
  const rd = K.start('ride', { from: 'overworld', to: 'c', path: K.ridePath([0, 0], [300, 0], 1) }); K.step(rd, 3, {});
  check(K.skip(rd) && rd.ph === 'done' && rd.off, 'a ride\'s skip: you get off where you are');
}

console.log('e · save / resume');
{
  const P = K.ridePath([0, 0], [400, 0], 11);
  const st = K.start('ride', { from: 'overworld', to: 'c', path: P, seed: 3 }); run(st, {}, 0.1, 20);
  const rec = JSON.parse(JSON.stringify(K.snap(st)));
  check(JSON.stringify(rec).length < 4000, 'the record is small (' + JSON.stringify(rec).length + ' B)');
  const R = K.resume(rec, 'overworld');
  check(R && R.act === 'ride' && Math.abs(R.st.s - st.s) < 1e-6 && R.st.ph === 'way' && K.rideAt(R.st.path, R.st.s, {}).x === K.rideAt(P, st.s, {}).x, 'a ride resumes on the cart where it was (' + (R && R.st.s.toFixed(1)) + ' m)');
  check(K.resume(rec, 'aqua') === null, '… only on its world');
  const L = K.start('lift', { from: 'overworld', to: 'stn.ring', top: 52900 }); run(L, {}, 0.1, 12);
  const RL = K.resume(JSON.parse(JSON.stringify(K.snap(L))), 'overworld');
  check(RL && RL.act === 'again' && Math.abs(K.at(RL.st).alt - K.at(L).alt) < 1e-6, 'a lift resumes in the cabin at its height (' + K.at(L).alt.toFixed(0) + ' m)');
  const L2 = K.start('lift', { from: 'overworld', to: 'stn.ring', top: 52900 }); run(L2, {}, 0.1, 30);
  const RL2 = K.resume(K.snap(L2), 'overworld');
  check(RL2 && RL2.st.t === K.LIFT.ground && !RL2.st.went, 'a lift saved in space before the switch: again from the hand-off');
  check(K.resume(K.snap(L2), 'stn.ring').act === 'arrived', 'a crossing that reached its world: the arrival');
  const B = K.start('bridge', { from: 'overworld', to: 'aqua' }); run(B, { fwd: true }, 0.1, 6);
  const RB = K.resume(K.snap(B), 'overworld');
  check(RB && RB.act === 'again' && RB.st.s > 0 && RB.st.s < K.BRIDGE.depart && !RB.st.went, 'a bridge on the world it left: on the path again before the switch');
  const odd = [null, 5, 'x', {}, { v: 9, kind: 'lift' }, { v: 1, kind: 'boat' }, { v: 1, kind: 'ride', from: 'overworld', path: 'no' }, { v: 1, kind: 'ride', from: 'overworld', path: [[0, 0]], s: NaN }];
  check(odd.every(o => K.resume(o, 'overworld') === null), 'odd records resume as nothing');
}

console.log('f · the rules');
{
  check(K.ok({}, 'lift') === null && K.ok({ guest: true }, 'lift') === 'guest' && K.ok({ guest: true }, 'ride') === null, 'a guest rides a caravan, but starts no crossing');
  check(K.ok({ flight: true }, 'ride') === 'busy' && K.ok({ off: true }, 'bridge') === 'off', 'not while flying; the switch off');
  check(K.mode({ potato: true }) === 'film' && K.mode({ off: true }) === 'film' && K.mode({}) === 'walk', 'Very Low or off: the film as before');
}

console.log('g · keys');
{
  const de = V.I18N && V.I18N.dict.de, en = V.I18N && V.I18N.dict.en;
  const ks = K.keys(), miss = ks.filter(k => !(de && de[k]) || !(en && en[k]));
  check(ks.length >= 20 && miss.length === 0, ks.length + ' keys in both tables' + (miss.length ? ' — missing ' + miss.slice(0, 6).join(', ') : ''));
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
