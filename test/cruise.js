// u-cruise · the Reiseantrieb without a browser (docs/superpowers/plans/2026-10-29-u-cruise.md §3): the law, the trip
// times of U§5.5, the sphere-of-influence hand-over, the drop-out orbit, the climb out of a low orbit, the way round
// Amarant, travel by intent (the pick), the space presence's bytes, the lang keys.
// Run: node test/cruise.js   (bash test/wt_run.sh cruise.js 300 in a worktree)
const VR = require('./load_shared.js');
globalThis.VR = VR;
const ROOT = __dirname + '/../';
require(ROOT + 'src/main/cruise.js');
const U = VR.Universe, S = U.home, CR = VR.Cruise;
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const f1 = (x) => Number(x).toFixed(1);
const len = (a) => Math.hypot(a[0], a[1], a[2]);
check(!!CR && typeof CR.step === 'function', 'VR.Cruise is there');
if (!CR || !CR.step) { console.log('FAILED ' + fails); process.exit(1); }

console.log('(a) the law');
check(CR.speed(1000) === 250 && CR.speed(0) === 0 && CR.speed(4e6) === 1e6, 'speed = 0.25 s⁻¹ × the distance to the nearest surface, no cap');
{
  const st = S.state(0), r = st.b.opal.r, n = CR.nearest(st, [r[0] + 30e3, r[1], r[2]]);
  check(n.id === 'opal' && Math.abs(n.d - (30e3 - S.body('opal').R)) < 1, 'the nearest surface is the nearest body\'s', n.id + ' ' + f1(n.d / 1e3) + ' km');
}

console.log('(b) the trip times of U§5.5 (at the closest approach, from 2 R to 2 R)');
const SPEC = { aqua: 9.5, basalt: 27, opal: 30, zinn: 30, ocker: 33, amarant: 22.5 };
for (const to in SPEC) {
  const span = to === 'aqua' || to === 'amarant' ? 100 : 3 * 86400;
  const cl = to === 'aqua' || to === 'amarant' ? { t: 0, d: len(S.offset('herz', to, 0)) } : CR.closest('herz', to, 0, span, 600);
  const c = CR.fly('herz', to, cl.t, { twoBody: true }), c3 = CR.fly('herz', to, cl.t);
  const tc = (c.t2R !== undefined ? c.t2R : c.total) - c.times.align, t3 = (c3.t2R !== undefined ? c3.t2R : c3.total) - c3.times.align, est = CR.tripEstimate('herz', to, cl.d);
  check(c.phase === 'done' && Math.abs(tc - SPEC[to]) <= 0.1 * SPEC[to], `Herzwelt → ${to}: ${f1(tc)} s (U§5.5: ${SPEC[to]} s; the two-body estimate ${f1(est)} s)`, `${f1(cl.d / 1e3)} km apart`);
  // with every body's surface in the law (the real flight): a third body near the way slows it (Aquamarin, Opal)
  check(c3.phase === 'done' && t3 >= tc - 0.5 && t3 < 1.5 * SPEC[to] + 2, `  the same with every body: ${f1(t3)} s, all phases ${f1(c3.total)} s`);
}
{ // and at a far geometry (Basalt beyond Amarant): the way goes round the giant, slower, never through it
  const cl = CR.closest('herz', 'basalt', 0, 3 * 86400, 600), far = cl.t + 0.5 * 2 * Math.PI / Math.abs(1 / 11.35 / 3600 * 2 * Math.PI - 1 / 6.83 / 3600 * 2 * Math.PI) / 1;
  const c = CR.fly('herz', 'basalt', far);
  check(c.phase === 'done' && c.minClear > 0.4 && c.total < 90, `Herzwelt → Basalt, the far side: ${f1(c.total)} s, the nearest any other body came ${f1(c.minClear)} of its radius`);
}

console.log('(c) the spheres of influence: the state in the dominant frame is continuous at every hand-over');
{
  const cl = CR.closest('herz', 'opal', 0, 3 * 86400, 600);
  let last = null, hand = 0, worst = 0; const seq = [];
  CR.fly('herz', 'opal', cl.t, { each: (c) => {
    const dom = CR.dominant(c);
    if (last && dom !== last) {
      hand++; seq.push(dom);
      const r1 = new Float64Array(3), v1 = new Float64Array(3), r2 = new Float64Array(3), v2 = new Float64Array(3);
      CR.inFrame(c, last, r1, v1); CR.inFrame(c, dom, r2, v2);
      // both back to the system frame
      const b1 = S.toFrame(last, 'helia', r1, v1, c.t, new Float64Array(3), new Float64Array(3)), b2 = S.toFrame(dom, 'helia', r2, v2, c.t, new Float64Array(3), new Float64Array(3));
      worst = Math.max(worst, Math.hypot(b1[0] - b2[0], b1[1] - b2[1], b1[2] - b2[2]) / len(c.P));
    }
    if (!last) seq.push(dom);
    last = dom;
  } });
  check(hand >= 2 && seq[0] === 'herz' && seq[seq.length - 1] === 'opal' && seq.includes('amarant'), 'Herzwelt → Amarant → Opal', seq.join(' → '));
  check(worst < 1e-9, 'continuous to 10⁻⁹ relative', worst.toExponential(1));
}

console.log('(d) the drop-out: a circular orbit round the target');
for (const to of ['opal', 'basalt', 'aqua', 'amarant']) {
  const c = CR.fly('herz', to, 1000), e = c.end, B = S.body(to);
  if (!e) { check(false, to + ': no end'); continue; }
  const el = U.stateToEl ? U.stateToEl(e.r, e.v, B.mu) : null, r = len(e.r), want = CR.arrivalK(to) * B.R;
  check(e.frame === to && Math.abs(r - want) / want < 0.03 && (!el || el.e < 0.02), `${to}: radius ${f1(r / B.R * 100) / 100} R (want ${f1(CR.arrivalK(to) * 100) / 100}), e ${el ? el.e.toFixed(4) : '?'}`);
  // the velocity hand-over in the last step: the arrival burn ends where the orbit starts (no jump > 5 %)
  const vc = Math.sqrt(B.mu / r);
  check(Math.abs(len(e.v) - vc) / vc < 1e-6, `${to}: at the circular speed ${f1(vc)} m/s`);
}

console.log('(e) the climb out of a low orbit (3 km over Herzwelt) toward a target below the horizon');
{
  const t = 2000, st = S.state(t), H = S.body('herz'), rf = st.b.herz.r, ro = st.b.opal.r;
  const away = [rf[0] - ro[0], rf[1] - ro[1], rf[2] - ro[2]], l = len(away);   // (the side of Herzwelt away from Opal)
  const r = H.R + 3000, P = [rf[0] + away[0] / l * r, rf[1] + away[1] / l * r, rf[2] + away[2] / l * r];
  const tang = [-away[1] / l, away[0] / l, 0], vc = Math.sqrt(H.mu / r), V = [st.b.herz.v[0] + tang[0] * vc, st.b.herz.v[1] + tang[1] * vc, st.b.herz.v[2] + tang[2] * vc];
  let minH = Infinity;
  const c = CR.fly('herz', 'opal', t, { P, V, nose: tang, each: (c) => { const q = c.st.b.herz.r; minH = Math.min(minH, Math.hypot(c.P[0] - q[0], c.P[1] - q[1], c.P[2] - q[2]) - H.R); } });
  check(c.phase === 'done' && minH > 1500, `never into the ground (lowest ${f1(minH)} m)`);
  check(c.times.align + c.times.punch + c.times.depart < 12, `the climb out (align ${f1(c.times.align)} + punch ${f1(c.times.punch)} + depart ${f1(c.times.depart)} s) under 12 s; all ${f1(c.total)} s`);
}

console.log('(f) travel by intent: the body the camera looks at');
{
  const st = S.state(500), P = Array.from(st.b.herz.r).map((x, i) => x + [200e3, 0, 0][i]);
  const to = (id) => { const r = st.b[id].r, d = [r[0] - P[0], r[1] - P[1], r[2] - P[2]], l = len(d); return [d[0] / l, d[1] / l, d[2] / l]; };
  const p1 = CR.pick(st, P, to('opal'), 'herz');
  check(p1 && p1.id === 'opal', 'looking at Opal picks Opal', p1 && p1.id);
  const d = to('amarant'); const p2 = CR.pick(st, P, d, 'herz');
  check(p2 && p2.id === 'amarant', 'looking at Amarant picks Amarant', p2 && p2.id);
  const off = [-d[0], -d[1], -d[2]]; const p3 = CR.pick(st, P, off, 'herz', ['amarant']);
  check(!p3, 'looking away picks nothing');
}

console.log('(g) multiplayer: the space presence and the travel message');
{
  const st = { frame: 'opal', r: [23456.78, -1234.5, 99.9], v: [12.345, -80.12, 0.5], t: 12345.678, coast: false };
  const sp = CR.spOf(st, [0.12345678, 0.5, -0.5, 0.7]), rate = CR.presenceRate(sp);
  check(rate <= 2048, `a guest's space presence ${Math.round(rate)} B/s at 10 Hz (≤ 2 KB/s)`, JSON.stringify(sp));
  st.coast = true; check(CR.presenceRate(CR.spOf(st, [0, 0, 0, 1])) < 30, 'a coasting ship: its conic once in ten seconds');
  const m = CR.travelMsg('opal', [12.345, 80, -3.21], 'h1');
  check(m.type === 'travel' && m.dim === 'opal' && m.at[0] === 12.3, 'the host\'s travel message {dim, at}', JSON.stringify(m));
}

console.log('(h) the words');
{
  require(ROOT + 'src/main/i18n.js'); require(ROOT + 'src/main/lang_de.js'); require(ROOT + 'src/main/lang_en.js');
  const D = VR.I18N && VR.I18N.dict.de, E = VR.I18N && VR.I18N.dict.en;
  const keys = ['g.cr.arm', 'g.cr.go', 'g.cr.hud', 'g.cr.arrived', 'g.cr.off', 'g.cr.survey', 'g.cr.descent', 'g.cr.armJump', 'g.cr.along', 'g.cr.alongQ', 'g.cr.firstStep', 'g.cr.look'];
  const has = (tab, k) => !!(tab && tab[k]);
  const miss = keys.filter(k => !has(D, k) || !has(E, k));
  check(!!D && !!E && miss.length === 0, 'the cruise\'s texts in German and English', miss.join(', ') || 'all ' + keys.length);
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
