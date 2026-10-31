// e-portal2 (docs/superpowers/plans/2026-10-31-e-portal2.md): the Leuchtpfad's film from the real space renderer — the
// pure part (src/main/portal_space.js), the skip's and the pad's rules (portal_core.js), the star map's first framing
//  a · which body a dim shows (Herzwelt for home, the isles, the deep, the stations; each moon itself; none for x.*)
//  b · the 3-D shots' poses: finite, an orthonormal look, outside every body, the target in the picture at every k and
//      variant; curve: the limb in the picture, the place under Helia 8–40° up; moon: the parent behind the target at the
//      start, the target swelling; ring: over the ring's lit face, Amarant in the picture
//  c · the moment of each shot: the moon's terminator crosses it (phase 40–95°), the parent lit; Helia ≥ 8° over the
//      ring's face; the film's plan (the 3-D shots get a body and a moment, the 2-D ones none)
//  d · the skip: a press before 2 s is kept and taken at 2 s; after the skip the film is at its end; the pad's A / B /
//      Start fresh presses (held buttons do not repeat)
//  e · the best hour: the next moment Helia stands 6–17° over the landing (Herzwelt, Opal, Ocker), never backwards
//  f · the star map's fit: the nearest ≥ 20 systems round Helia inside the first view, the zoom between 12 and 520 ly
//  g · the new keys in both tables
//   bash test/wt_run.sh portal2.js 300
const V = require('./load_shared.js');
const path = require('path'), fs = require('fs');
require('../src/shared/bodytex.js'); require('../src/main/space_shaders.js'); require('../src/main/spacescene.js');
require('../src/main/i18n.js'); require('../src/main/lang_en.js'); require('../src/main/lang_de.js');
require('../src/main/portal_core.js');
const psPath = path.join(__dirname, '..', 'src', 'main', 'portal_space.js');
if (fs.existsSync(psPath)) require(psPath);
require('../src/main/starmap.js');
let fails = 0;
const check = (ok, what) => { console.log((ok ? '  ✓ ' : '  ✗ ') + what); if (!ok) fails++; };
const PS = V.PortalSpace, SS = V.SpaceScene, C = V.PortalCore;
check(!!PS && typeof PS.pose === 'function', 'VR.PortalSpace loads in node');
if (!PS) { console.log('FAILED ' + fails); process.exit(1); }
const D2R = Math.PI / 180;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b)))));

console.log('a · the bodies');
{
  const want = { overworld: 'herz', flat: 'herz', drift: 'herz', underforge: 'herz', opal: 'opal', basalt: 'basalt', zinn: 'zinn', ocker: 'ocker', aqua: 'aqua', 'stn.ring': 'herz', 'x.2.1.1': null };
  check(Object.keys(want).every(d => PS.bodyOf(d) === want[d]), Object.keys(want).map(d => d + '→' + PS.bodyOf(d)).join(' '));
  check(['curve', 'ring', 'moon', 'station'].every(s => PS.GL[s]) && !PS.GL.swallow && !PS.GL.clouds && !PS.GL.tunnel && !PS.GL.arrive, 'the 3-D shots: curve, ring, moon, station');
}

console.log('b · the poses');
{
  const t0 = SS.worldTime(3, 2000);
  const inView = (v, p, R) => { const d = sub(p, v.pos), a = ang(v.fwd, d), r = Math.asin(Math.min(1, R / len(d))); return a < v.fov * 0.62 + r; };
  const outside = (v, eph) => Object.keys(SS.BODIES).every(id => id === 'helia' || len(sub(v.pos, eph.bodies[id].p)) > SS.BODIES[id].R * 1.001);
  let bad = [];
  for (const [shot, id] of [['arrive', 'opal'], ['arrive', 'zinn'], ['curve', 'herz'], ['curve', 'opal'], ['curve', 'ocker'], ['moon', 'opal'], ['moon', 'herz'], ['moon', 'aqua'], ['moon', 'zinn'], ['ring', 'amarant'], ['station', 'herz']]) {
    const t = PS.when(shot, id, t0), eph = SS.ephemeris(t, {});
    for (let v = 0; v < 3; v++) for (const k of [0, 0.5, 1]) {
      const p = PS.pose(shot, k, v, id, eph), tag = shot + '/' + id + ' v' + v + ' k' + k;
      if (!p) { bad.push(tag + ' none'); continue; }
      const fin = [...p.pos, ...p.fwd, ...p.up].every(Number.isFinite);
      if (!fin || Math.abs(len(p.fwd) - 1) > 1e-6 || Math.abs(len(p.up) - 1) > 1e-6 || Math.abs(dot(p.fwd, p.up)) > 1e-6) { bad.push(tag + ' frame'); continue; }
      if (!outside(p, eph)) bad.push(tag + ' inside a body');
      const tgt = shot === 'ring' ? 'amarant' : id;
      if (!inView(p, eph.bodies[tgt].p, SS.BODIES[tgt].R)) bad.push(tag + ' target out of the picture');
      if (!p.ref || !eph.bodies[p.ref]) bad.push(tag + ' ref');
    }
  }
  check(bad.length === 0, 'every pose valid, the target in the picture' + (bad.length ? ': ' + bad.slice(0, 6).join(', ') : ''));
  // curve: the limb in the picture (the horizon's dip within the lower half), Helia's height over the place
  {
    const eph = SS.ephemeris(PS.when('curve', 'herz', t0), {}), b = eph.bodies.herz, R = SS.BODIES.herz.R; let ok = true, info = [];
    for (let v = 0; v < 3; v++) for (const k of [0, 1]) {
      const p = PS.pose('curve', k, v, 'herz', eph), up = norm(sub(p.pos, b.p)), alt = len(sub(p.pos, b.p)) - R;
      const dip = Math.acos(R / (R + alt)), pitch = Math.asin(dot(p.fwd, up)), below = pitch + dip;   // the limb's angle under the view's centre
      const el = Math.asin(dot(up, norm(sub(eph.bodies.helia.p, b.p)))) / D2R;
      info.push('v' + v + 'k' + k + ' limb ' + (below / D2R).toFixed(0) + '° sun ' + el.toFixed(0) + '°');
      if (!(below > 0 && below < p.fov * 0.5) || !(el > 8 && el < 40)) ok = false;
    }
    check(ok, 'curve: the limb in the lower half, Helia 8–40° over the place (' + info.join(' · ') + ')');
    const a0 = len(sub(PS.pose('curve', 0, 1, 'herz', eph).pos, b.p)) - R, a1 = len(sub(PS.pose('curve', 1, 1, 'herz', eph).pos, b.p)) - R;
    check(a0 < 0.1 * R && a1 > 0.8 * R, 'curve: rising from ' + (a0 / 1000).toFixed(0) + ' km to ' + (a1 / 1000).toFixed(0) + ' km');
  }
  // moon: the parent behind the target at the start, the target swelling
  {
    const ok = [];
    for (const id of ['opal', 'zinn', 'herz', 'aqua']) {
      const eph = SS.ephemeris(PS.when('moon', id, t0), {}), par = PS.parentOf(id), p0 = PS.pose('moon', 0, 1, id, eph), p1 = PS.pose('moon', 1, 1, id, eph);
      const dT = sub(eph.bodies[id].p, p0.pos), dP = sub(eph.bodies[par].p, p0.pos);
      const behind = len(dP) > len(dT) && ang(dT, dP) < p0.fov * 0.6, rT0 = SS.BODIES[id].R / len(dT), rT1 = SS.BODIES[id].R / len(sub(eph.bodies[id].p, p1.pos));
      ok.push([id, behind && rT1 > rT0 * 4, (ang(dT, dP) / D2R).toFixed(0) + '° ×' + (rT1 / rT0).toFixed(1)]);
    }
    check(ok.every(o => o[1]), 'moon: the parent behind, the target swelling (' + ok.map(o => o[0] + ' ' + o[2]).join(' · ') + ')');
  }
}

console.log('c · the moments');
{
  const t0 = SS.worldTime(5, 9000);
  const ph = [];
  for (const id of ['opal', 'basalt', 'zinn', 'ocker', 'herz', 'aqua']) {
    const t = PS.when('moon', id, t0), eph = SS.ephemeris(t, {}), p = PS.pose('moon', 0.6, 1, id, eph), b = eph.bodies[id];
    const phase = ang(sub(eph.bodies.helia.p, b.p), sub(p.pos, b.p)) / D2R;
    const par = PS.parentOf(id), pp = ang(sub(eph.bodies.helia.p, eph.bodies[par].p), sub(p.pos, eph.bodies[par].p)) / D2R;
    ph.push([id, t >= t0, phase, pp]);
  }
  {
    const ar = [];
    for (const id of ['opal', 'basalt', 'zinn']) {
      const t = PS.when('arrive', id, t0), eph = SS.ephemeris(t, {}), p = PS.pose('arrive', 1, 1, id, eph), b = eph.bodies[id], N = norm(sub(p.pos, b.p));
      const el = Math.asin(dot(N, norm(sub(eph.bodies.helia.p, b.p)))) / D2R, par = eph.bodies[PS.parentOf(id)];
      ar.push([id, el, ang(p.fwd, sub(par.p, p.pos)) / D2R]);
    }
    check(ar.every(q => q[1] > 3 && q[1] < 30 && q[2] < 30), 'arrive (airless): Helia low over the landing, the parent in the picture (' + ar.map(q => q[0] + ' sun ' + q[1].toFixed(0) + '° parent ' + q[2].toFixed(0) + '° off the middle').join(' · ') + ')');
  }
  check(ph.every(q => q[1] && q[2] > 40 && q[2] < 95 && q[3] < 110), 'moon: the terminator across the target, the parent lit (' + ph.map(q => q[0] + ' ' + q[2].toFixed(0) + '°/' + q[3].toFixed(0) + '°').join(' · ') + ')');
  const eph = SS.ephemeris(PS.when('ring', 'amarant', t0), {}), A = eph.bodies.amarant, s = norm(sub(eph.bodies.helia.p, A.p)), open = Math.asin(Math.abs(dot(s, A.axis))) / D2R;
  const p = PS.pose('ring', 0.5, 1, 'amarant', eph), side = Math.sign(dot(sub(p.pos, A.p), A.axis)) === Math.sign(dot(s, A.axis));
  check(open >= 8 && side, 'ring: Helia ' + open.toFixed(1) + '° over the ring\'s face, the camera on the lit side');
  const F = C.film(C.rec({}), 7, 'overworld', 'opal', {});
  const plan = PS.plan(F, 'overworld', 'opal', t0);
  check(plan.length === F.shots.length && F.shots.every((s, i) => !!plan[i].gl === (!!PS.GL[s.id] || s.id === 'arrive') && (!PS.GL[s.id] || (plan[i].id && Number.isFinite(plan[i].t)))), 'the plan of ' + F.id + ': ' + plan.map((q, i) => F.shots[i].id + (q.gl ? '=' + q.id : '')).join(' '));
  const Fh = C.film(C.rec({}), 7, 'opal', 'overworld', {}), ph2 = PS.plan(Fh, 'opal', 'overworld', t0);
  check(!ph2[ph2.length - 1].gl, 'home (air): the arrival stays the painted descent through the sky');
  const Fx = C.film(C.rec({}), 3, 'overworld', 'x.2.1.1', {}), px = PS.plan(Fx, 'overworld', 'x.2.1.1', t0);
  check(px.every((q, i) => Fx.shots[i].id !== 'moon' || !q.gl), 'another star: no 3-D moon of ours (' + Fx.shots.map(s => s.id).join(' ') + ')');
}

console.log('d · the skip and the pad');
{
  check(C.skipTo(1.0, 13, 2) === null && C.skipTo(2.0, 13, 2) === 13 && C.skipTo(12.9, 13, 2) === 13, 'skipTo: before 2 s kept (null), from 2 s on the film at its end');
  const st = {};
  const pad = (b) => [{ connected: true, buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: b.includes(i) })) }];
  const seq = [C.padSkip(pad([]), st), C.padSkip(pad([0]), st), C.padSkip(pad([0]), st), C.padSkip(pad([]), st), C.padSkip(pad([1]), st), C.padSkip(pad([]), st), C.padSkip(pad([9]), st), C.padSkip(null, st), C.padSkip([null], st)];
  check(seq.join(',') === 'false,true,false,false,true,false,true,false,false', 'padSkip: A, B, Start fresh presses only (' + seq.join(',') + ')');
}

console.log('e · the best hour');
{
  const U = V.Universe, sec = (d, t) => U.worldSeconds(d, t), res = [];
  for (const [dim, pos] of [['overworld', [0, 80, 0]], ['opal', [0, 70, 0]], ['ocker', [0, 70, 0]]]) {
    const t0 = sec(2, 6000), t = PS.bestHour(dim, pos, t0);
    const el = t === null ? null : Math.asin(U.localSky(dim, pos, t).sun.dir[1]) / D2R;
    res.push([dim, t !== null && t >= t0 && el >= 6 && el <= 17, el === null ? 'none' : el.toFixed(1) + '° +' + ((t - t0) / 60).toFixed(0) + ' min']);
  }
  check(res.every(r => r[1]), 'the next golden moment at the landing: ' + res.map(r => r[0] + ' ' + r[2]).join(' · '));
}

console.log('f · the star map\'s first view');
{
  const N = V.Galaxy.build(53), fit = V.StarMapFit && V.StarMapFit(N, 0, 24);
  check(!!fit && fit.labels.length >= 20 && fit.dist >= 12 && fit.dist <= 520, 'fit: ' + (fit && fit.labels.length) + ' systems, zoom ' + (fit && fit.dist.toFixed(0)) + ' ly');
  if (fit) { const far = Math.max(...fit.labels.map(i => V.Galaxy.dist(N.list[i], N.list[0]))); check(far * 0.95 / fit.dist < 0.45, 'the farthest labelled (' + far.toFixed(1) + ' ly) inside the view (' + (far * 0.95 / fit.dist).toFixed(2) + ' of its height)'); }
}

console.log('g · the texts');
{
  const de = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'lang_de.js'), 'utf8'), en = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'lang_en.js'), 'utf8');
  const keys = ['g.pt.skipWait', 'g.pt.bestHour'];
  check(keys.every(k => de.includes('"' + k + '"') && en.includes('"' + k + '"')), 'keys in both tables: ' + keys.join(', '));
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
