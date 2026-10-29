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

console.log('(i) the wiring: a shuttle in orbit, the cruise to Opal through flight.js, G by intent, Landen there');
{
  // the game's glue in node: a page-less Game (spaceflight.js and cruise.js wire themselves to it), ascent.js's harness
  global.window = global.window || {};
  global.document = global.document || { getElementById: () => null, createElement: () => ({ style: {}, getContext: () => null }), body: { appendChild() { } } };
  global.performance = global.performance || { now: () => Date.now() };
  VR.SHADERS = VR.SHADERS || {};
  VR.Game = VR.Game || function () { }; VR.Game.prototype.playFrame = VR.Game.prototype.playFrame || function () { };
  const trips = [];
  VR.Travel = { canGo: () => null, go: (g, o) => { trips.push(o); return Promise.resolve(true); } };
  delete VR.Cruise; delete require.cache[require.resolve(ROOT + 'src/main/cruise.js')];
  for (const f of ['voxmodels', 'flight', 'cockpit', 'starships', 'gadgets', 'skybodies', 'ascent', 'spaceflight', 'entry', 'cruise']) require(ROOT + 'src/main/' + f + '.js');
  const R = VR.R, A = VR.Ascent, SF = VR.SpaceFlight, CRg = VR.Cruise;
  check(!!CRg.page, 'the glue is wired (VR.Cruise.page)', String(!!CRg.page));
  const G = 64, STONE = R.byName.stone.defaultState;
  class World { constructor() { this.cols = new Map(); } col(cx, cz) { const k = cx + ',' + cz; let c = this.cols.get(k); if (!c) { c = { cx, cz, ready: true, H: 256, height: new Uint8Array(256).fill(G - 1), blocks: new Uint16Array(256 * 256), blockEntities: new Map(), sec: [] }; for (let y = 0; y < G; y++) for (let i = 0; i < 256; i++) c.blocks[(y << 8) | i] = STONE; this.cols.set(k, c); } return c; }
    nbFn() { return this._nb || (this._nb = (x, y, z, d) => this.getBlock(x + VR.HF_DX[d], y, z + VR.HF_DZ[d])); }
    getBlock(x, y, z) { if (y < 0 || y >= 256) return 0; const c = this.col(x >> 4, z >> 4); return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]; } setBlock() { } getLight() { return 0xf000; } }
  const hints = [], chats = [];
  const ui = { hint(t) { hints.push(t); }, chatLine(t) { chats.push(t); }, typing: false, vehicleHud() { } };
  const g = { world: new World(), frame: 0, renderer: { gl: null, uploadShip: () => [], freeShip() { } }, particles: { spawn() { }, smoke() { }, spark() { }, explosion() { } }, settings: { camShake: true }, ui, audio: { play() { }, loop() { }, turbine() { }, tone() { } }, trails: null, time: 0, meta: {}, player: { pos: [0, G, 0], eye: 1.62, yaw: 0, pitch: 0, teleport(x, y, z) { this.pos = [x, y, z]; }, lookDir() { return [0, 0, -1]; } } };
  g.pool = { workers: [{ inflight: 0 }], direct(i, msg, tr, cb) { if (msg.type === 'surface') { cb({ res: msg.points.map(() => G - 1) }); return; } if (msg.type === 'shipmesh') { cb({ type: 'shipmesh', sections: [] }); return; } const r = VR.Starship.build(msg.seed, msg.arch); cb({ type: 'starship', meta: r.meta, occ: r.occ, hull: { count: 0 }, glass: { count: 0 }, gear: { count: 0 } }); } };
  VR.C = VR.C || {}; if (VR.C.SEA === undefined) VR.C.SEA = 40;
  if (!VR.ckey) VR.ckey = (cx, cz) => cx + ',' + cz;
  g.villages = { list: () => [] };
  const mgr = new VR.Starships(g, { title: true });
  mgr.g.gadgets = { riding: null, freeSpot: (c) => c[0] };
  const input = { keys: new Set(), pressed: new Set(), captured: true, sensitivity: 0.0024, invertY: false, dragLook: false, mouse: { dx: 0, dy: 0, down: [false, false, false], clicked: [false, false, false], wheel: 0 }, down(c) { return this.keys.has(c); }, hit(c) { return this.pressed.has(c); }, clickAction() { return false; } };
  const frame = (dt) => { g.time += dt; mgr.drive(dt, input, false); input.pressed.clear(); };
  const s = mgr.spawn(4242, 'shuttle', null, [0.5, G, 0.5], 0);
  mgr.board(s, g.player);
  const fl = s.flight; fl.power = 'running'; fl.startT = 3; fl.state = 'flying';
  A.orbitAt(fl, [0, 3063, 0], 0);
  check(fl.regime === 'space' && fl.asc.st.frame === 'herz', 'the shuttle in a low orbit', fl.regime + ' ' + fl.asc.st.frame);
  const t0 = fl.asc.st.t, ok = CRg.start(fl, 'opal');
  check(ok && fl.auto && fl.auto.space === 'cruise' && fl.asc.cruise, 'the Reiseantrieb to Opal starts (fl.auto.space = cruise)');
  let n = 0, maxFov = 1, frames = [], lastP = null, worstJump = 0;
  while (fl.asc.cruise && n++ < 60 * 120) {
    frame(1 / 60); maxFov = Math.max(maxFov, fl.fovK || 1);
    const st = fl.asc.st, S2 = U.home, pf = S2.pos(st.frame, st.t, new Float64Array(3)), P = [pf[0] + st.r[0], pf[1] + st.r[1], pf[2] + st.r[2]];
    if (lastP) worstJump = Math.max(worstJump, Math.hypot(P[0] - lastP[0], P[1] - lastP[1], P[2] - lastP[2]) - (len(st.v) + 6000) / 60);
    lastP = P;
  }
  const st = fl.asc.st, el = U.stateToEl(st.r, st.v, U.home.body('opal').mu), dt = st.t - t0;
  check(!fl.asc.cruise && st.frame === 'opal' && fl.regime === 'space' && el.e < 0.03, `arrived: in orbit round Opal after ${f1(dt)} s of flight (e ${el.e.toFixed(3)}, ${f1(len(st.r) / U.home.body('opal').R * 100) / 100} R)`, chats.slice(-1)[0]);
  check(maxFov > 1.08, 'the punch: the FOV kick', 'fovK max ' + maxFov.toFixed(3));
  check(worstJump < 50, 'no jump in the ship\'s place along the way', f1(worstJump) + ' m beyond v·dt');
  check(CRg.last && CRg.last.t2R > 25 && CRg.last.t2R < 70, `the trip's time to 2 R of Opal ${f1(CRg.last && CRg.last.t2R)} s (the phases ${CRg.last && JSON.stringify(Object.fromEntries(Object.entries(CRg.last.phases).map(([k, v]) => [k, +v.toFixed(1)])))})`);
  // G by intent: the camera looking at Herzwelt from Opal's orbit → the cruise armed, G again → the jump there, again → off
  for (let i = 0; i < 300; i++) frame(1 / 60);   // (the frame's turn from the ecliptic's into Opal's)
  const S2 = U.home, st2 = fl.asc.st, ph = S2.pos('opal', st2.t, new Float64Array(3)), hz = S2.pos('herz', st2.t, new Float64Array(3));
  const dSys = [hz[0] - ph[0] - st2.r[0], hz[1] - ph[1] - st2.r[1], hz[2] - ph[2] - st2.r[2]], l = len(dSys);
  const M9 = A.localFrame(st2, new Float64Array(9)), dm = [0, 1, 2].map(i => (M9[i] * dSys[0] + M9[3 + i] * dSys[1] + M9[6 + i] * dSys[2]) / l);   // (system → map: Mᵀ)
  g.cam = { x: 0, y: 0, z: 0, yaw: Math.atan2(-dm[0], -dm[2]), pitch: Math.asin(dm[1]) };
  const pk = CRg.lookPick(g, fl);
  check(pk && pk.id === 'herz', 'looking at Herzwelt from Opal\'s orbit picks Herzwelt', pk && pk.id);
  SF.toggle(fl);
  check(fl.auto && fl.auto.space === 'arm' && fl.auto.cruiseTo === 'herz', 'G: the cruise to Herzwelt armed', hints.slice(-1)[0]);
  SF.toggle(fl);
  check(fl.auto && fl.auto.space === 'arm' && !fl.auto.cruiseTo && fl.auto.to === 'herz', 'G again: the Reisesprung there instead', hints.slice(-1)[0]);
  SF.toggle(fl);
  check(!fl.auto, 'G a third time: off');
  // Landen round Opal: the descent (five seconds down), then the trip into Opal's world with the ship
  const landable = SF.landable('opal');
  if (landable) {
    SF.land(fl);
    check(fl.asc.cruise && fl.asc.cruise.kind === 'descent', 'V round Opal: the descent starts');
    for (let i = 0; i < 60 * 6 && fl.asc.cruise; i++) frame(1 / 60);
    check(trips.length === 1 && trips[0].dim === 'opal' && trips[0].via === 'ship', 'then VR.Travel.go({dim: opal, via: ship}) — the ship along', JSON.stringify(trips));
  } else check(false, 'Opal is landable (u-moons1 registers its dim)');
  // a flight key during a cruise drops out where the ship is (coasting in the frame it is in)
  A.orbitAt(fl, [0, 3063, 0], fl.asc.st.t); CRg.start(fl, 'basalt');
  for (let i = 0; i < 60 * 8; i++) frame(1 / 60);
  input.keys.add('KeyW'); frame(1 / 60); frame(1 / 60); input.keys.delete('KeyW');
  check(!fl.asc.cruise && fl.asc.st.coast !== undefined && ['herz', 'amarant', 'aqua'].includes(fl.asc.st.frame), 'a flight key: the drive off, the ship coasting where it is', fl.asc.st.frame);
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
