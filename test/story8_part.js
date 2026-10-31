// a-story6 · test/story.js section 21 (plan docs/superpowers/plans/2026-10-31-a-story6.md): ch. 9 owns its frame — the
// nebula's layers (pillars toward the star, near clouds framing it, shafts, Flimmi with a face; 9.1 the star still in
// its cocoon), Very Low cheaper, parallax between the layers as the sky shot trucks, the scene's night (Helia under the
// horizon, the light from Flimmi's side, E's own arrays untouched), nothing outside ch. 9; ch. 7's window on the true
// beacons; Aquamarin's night and the lamplighters' halo. Required by test/story.js.
const path = require('path');
module.exports = function (S, SP, tr, calm, check) {
  console.log('21 · a-story6: ch. 9 — the nebula owns the frame');
  try { require(path.join(__dirname, '../src/main/story_neb.js')); } catch (e) { check(false, 'story_neb.js loads: ' + e.message); return; }
  const SN = VR.StoryNeb, e = [0, 71.6, 0], F0 = [0, 131.6, -60], fwd = [0, 0, -1];
  const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
  const FD = nrm([F0[0] - e[0], F0[1] - e[1], F0[2] - e[2]]);
  const ang = (p, from) => { const d = nrm([p[0] - (from || e)[0], p[1] - (from || e)[1], p[2] - (from || e)[2]]); return Math.acos(Math.max(-1, Math.min(1, d[0] * FD[0] + d[1] * FD[1] + d[2] * FD[2]))) * 180 / Math.PI; };
  const Lh = SN.layers(e, 0, F0, 11, 'c9.b2', 2), Lb = SN.layers(e, 0, F0, 11, 'c9.b2', 1), Lv = SN.layers(e, 0, F0, 11, 'c9.b2', 0), L1 = SN.layers(e, 0, F0, 10, 'c9.b1', 2);
  const of = (L, k) => L.filter(q => q.kind === k);
  // the pillars: far, from below the horizon, each pointing toward the star (its +y axis along the way to it)
  const P3 = of(Lh, 3), G = VR.StoryGlow;
  const pOk = P3.every(q => {
    const rel = [q.p[0] - e[0], q.p[1] - e[1], q.p[2] - e[2]], A = G.axes(rel, 1, 1, q.rot), ay = [A[3], A[4], A[5]];
    const toF = nrm([FD[0] * 400 - rel[0], FD[1] * 400 - rel[1], FD[2] * 400 - rel[2]]), base = q.p[1] - q.s[1] * Math.abs(ay[1]);
    return q.far && Math.hypot(rel[0], rel[1], rel[2]) > 200 && ay[0] * toF[0] + ay[1] * toF[1] + ay[2] * toF[2] > 0.5 && base < e[1] && q.col2[0] < 0.05;
  });
  check(P3.length === 5 && pOk, `five pillars of dust (High), far (${P3.map(q => Math.round(Math.hypot(q.p[0], q.p[1] - e[1], q.p[2]))).join(' ')} m), rising from below the horizon toward the star, dark bodies`);
  check(P3.every(q => q.ld && Math.abs(Math.hypot(q.ld[0], q.ld[1]) - 1) < 1e-6 && q.ld[1] > 0.5 && q.col[0] > 1), '… their rim lit on the side facing the star (the light in the quad\'s own axes), gold and magenta (HDR)');
  const C4 = of(Lh, 4);
  check(C4.length === 4 && C4.every(q => ang(q.p) > 22 && Math.hypot(q.p[0] - e[0], q.p[1] - e[1], q.p[2] - e[2]) < 200 && q.far), `near clouds framing the picture (${C4.map(q => Math.round(ang(q.p)) + '°').join(' ')} from the star, under 200 m) — never over it`);
  const F5 = of(Lh, 5);
  check(F5.length === 1 && F5[0].p === F0 && !F5[0].far && F5[0].face > 0.9 && of(Lh, 6).length === 5, 'Flimmi where the sky shot looks: a star with a face, five motes circling it');
  check(SN.layers(e, 0, F0, 0.2, 'c9.b2', 2).filter(q => q.kind === 5)[0].face < 0.05, '… its face opens after the first half second (it wakes)');
  check(of(Lh, 7).length === 6 && of(Lb, 7).length === 4 && of(Lv, 7).length === 0, `shafts of light from the star in front of the pillars: High 6, Balanced 4, Very Low none`);
  check(of(L1, 5).length === 0 && of(L1, 7).length === 0 && of(L1, 3).length === 5, '9.1: the star still in its cocoon — no Flimmi, no shafts; the pillars already there');
  check(Lv.length <= 9 && Lv.length < Lh.length && of(Lv, 3).length === 3 && of(Lv, 4).length === 2, `Very Low: fewer layers (${Lv.length} vs ${Lh.length}; 3 pillars, 2 clouds)`);
  check(SN.layers(e, 0, F0, 0.01, 'c9.b2', 2).filter(q => q.kind !== 5).every(q => q.a < 0.01), 'eased in from nothing at the scene\'s start');
  // parallax: the sky shot trucks 16 m — the near clouds move against the pillars, the pillars against the far gas (∞)
  { const c0 = [-8, 71.3, 1.5], c1 = [8, 74.3, 1.5], dA = (p) => { const a = nrm([p[0] - c0[0], p[1] - c0[1], p[2] - c0[2]]), b = nrm([p[0] - c1[0], p[1] - c1[1], p[2] - c1[2]]); return Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 180 / Math.PI; };
    const cl = Math.min(...C4.map(q => dA(q.p))), pi = Math.max(...P3.map(q => dA(q.p)));
    check(cl > 2 * pi && pi > 1.2, `parallax: over the shot the near clouds shift ${cl.toFixed(1)}°, the pillars ≤ ${pi.toFixed(1)}°, the backdrop 0°`); }
  // the scene's frame: on only in ch. 9, with the switch, while story_neb compiles
  const mk = (id, t, preset, lights) => ({ g: { settings: { preset: preset || 'high', storyLights: lights !== false }, meta: { seed: 4242 }, time: t }, sc: { b: S.byId(id), t, eye0: e, yaw0: 0, fwd, tg: { sky: F0 } } });
  { const a = mk('c9.b2', 5), b = mk('c10.b1', 5), c = mk('c9.b2', 5, 'high', false);
    check(SP.neb6On(a.g, a.sc) && !SP.neb6On(b.g, b.sc) && !SP.neb6On(c.g, c.sc) && !SP.neb6On(a.g, null), 'the nebula takes the frame only in ch. 9\'s scenes, with „Lichter der Geschichte" on');
    SN.off = true; const off = SP.neb6On(a.g, a.sc); SN.off = false;
    check(!off && SN.quality('potato') === 0 && SN.quality('balanced') === 1 && SN.quality('high') === 2, '… a debug switch (the pictures before/after), quality by preset (Very Low 0, Balanced 1, High 2)');
    const at = S.shotAt(a.sc.b, 11), o = SP.fx3d(a.g, a.sc, at);
    check(o && o.neb6 === true, 'the film\'s flat nebula and Flimmi step aside (o.neb6)'); }
  // the night of the scene: E's light and haze, its own arrays untouched
  { const sd = [0.3, 0.8, 0.5], sc0 = [3, 2.8, 2.5], fog = [50, 150, 0, 0], E = { sunDir: sd, sunColor: sc0, moonDir: [0, 1, 0], moonColor: [0.1, 0.1, 0.1], ambSky: [1, 1, 1], zenith: [0.4, 0.5, 0.9], skyMid: [0.6, 0.6, 0.8], horizon: [1, 0.8, 0.7], fogColor: [1, 0.8, 0.7], fog, exposure: 0.8, night: 0, bodySky: {} };
    const a = mk('c9.b2', 5); SP.night6(E, a.sc);
    const md = E.moonDir, lumA = 0.2126 * E.ambSky[0] + 0.7152 * E.ambSky[1] + 0.0722 * E.ambSky[2];
    check(E.sunDir[1] < -0.5 && E.sunColor.every(v => v < 1e-6) && E.night === 1, 'the scene\'s night: Helia under the horizon, its light off (no glare, no flare), the night\'s grade');
    check(md[0] * FD[0] + md[1] * FD[1] + md[2] * FD[2] > 0.95 && E.moonColor[0] > E.moonColor[2] * 2 && lumA < 0.06 && E.ambSky[2] > E.ambSky[0], 'the land lit from Flimmi\'s side (warm gold), an indigo shade');
    check(E.fog[0] < 50 && E.fogColor[2] > E.fogColor[0] && Math.abs(E.exposure - 1.05) < 1e-6, `the haze nearer (${E.fog[0].toFixed(0)} m, was 50) and indigo; the exposure fixed`);
    check(sd[1] === 0.8 && sc0[0] === 3 && fog[0] === 50, 'E\'s own arrays untouched (fixed arrays of the scene)');
    const b = mk('c9.b1', 5), E1 = Object.assign({}, E, { moonColor: [0.1, 0.1, 0.1] }); SP.night6(E1, b.sc);
    check(E1.moonColor[0] < 0.6 && E1.moonColor[2] > 0.2, '9.1: a dim rose light (the star still hidden)'); }
  // the sky shot trucks sideways and cranes up, still aimed at the star
  { const PL = SP.Player && SP.Player.prototype; if (!PL || !PL.pose0) check(false, 'Player.pose0');
    else {
      const a = mk('c9.b2', 11); a.g.player = { pos: [0, 70, 0] }; a.sc.free = () => true;
      const me = { g: a.g, target: PL.target }, sh = { cam: 'up', target: 'sky', dur: 9 };
      const p0 = PL.pose0.call(me, a.sc, sh, 0, {}), p1 = PL.pose0.call(me, a.sc, sh, 1, {});
      const aim = (p) => { const dx = F0[0] - p.x, dz = F0[2] - p.z; return Math.abs(Math.atan2(Math.sin(p.yaw - Math.atan2(-dx, -dz)), Math.cos(p.yaw - Math.atan2(-dx, -dz)))); };
      check(Math.abs((p1.x - p0.x) - 16) < 0.01 && p1.y - p0.y > 2.5 && aim(p0) < 1e-6 && aim(p1) < 1e-6, `the sky shot trucks ${(p1.x - p0.x).toFixed(1)} m and cranes ${(p1.y - p0.y).toFixed(1)} m, still aimed at Flimmi`);
      const c = mk('c9.b2', 11, 'high', false); c.g.player = a.g.player; const q0 = PL.pose0.call({ g: c.g, target: PL.target }, c.sc, sh, 0, {}), q1 = PL.pose0.call({ g: c.g, target: PL.target }, c.sc, sh, 1, {});
      check(Math.abs(q1.x - q0.x) < 1e-6, '… and stands still with the switch off (the old shot)');
    } }
};
module.exports.arrow = function (S, SP, check) {
  console.log('21b · a-story6: ch. 7 — the window\'s arrow on the true beacons');
  const path = require('path');
  try { if (!VR.BodyTex) require(path.join(__dirname, '../src/shared/bodytex.js')); } catch (e) { check(false, 'bodytex.js loads: ' + e.message); return; }
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const nrm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
  const had = VR.SpaceScene;
  VR.SpaceScene = { BODIES: { herz: { R: 99550 } }, frame: (b) => { const k = dot(b.xb, b.axis), x = nrm([b.xb[0] - b.axis[0] * k, b.xb[1] - b.axis[1] * k, b.xb[2] - b.axis[2] * k]), y = b.axis; return [x, y, cross(x, y)]; },
    toSys: (F, v) => [F[0][0] * v[0] + F[1][0] * v[1] + F[2][0] * v[2], F[0][1] * v[0] + F[1][1] * v[1] + F[2][1] * v[2], F[0][2] * v[0] + F[1][2] * v[1] + F[2][2] * v[2]] };
  const BT = VR.BodyTex, R = 99550, hb = { p: [0, 0, 0], xb: [1, 0, 0], axis: [0, 1, 0] }, F = VR.SpaceScene.frame(hb);
  // the camera 30 km over a known beacon, looking straight down at it (the scene's axes: x east-ish, y up = away from Herzwelt)
  const x0 = BT.CHART.Px !== undefined ? BT.CHART.Px + 20000 : 20000, z0 = BT.CHART.Pz !== undefined ? BT.CHART.Pz : 0;
  const sp = BT.toSphere(x0, z0), n = VR.SpaceScene.toSys(F, BT.normal(sp[0], sp[1])), pos = n.map(v => v * (R + 30000));
  const ax = nrm(cross([0, 0, 1], n)), az = cross(ax, n), fr = { pos, axes: [ax, n, az], t: 0 };   // (rows: the scene's x, y, z in the system)
  const pts = [[x0, z0, 'a'], [x0 + 3000, z0, 'b'], [x0, z0 + 3000, 'c'], [2 * (BT.CHART.Px || 0) - x0 + 9e5, z0, 'far']];
  const L = SP.trueArrow(fr, hb, pts, null, null), a = L.find(q => q.id === 'a');
  check(L.length === 3 && !L.find(q => q.id === 'far'), `the beacons on the near side are found (${L.map(q => q.id).join(' ')}), the one on the far side is not`);
  check(a && a.d[1] < -0.999 && a.n[1] > 0.999, 'the beacon straight below: straight down in the view, its beam standing up from the ground (scene axes)');
  const b = L.find(q => q.id === 'b'), sep = Math.acos(Math.max(-1, Math.min(1, dot(a.d, b.d)))) * 180 / Math.PI;
  check(sep > 4 && sep < 7.5, `two beacons 3 km apart seen 30 km up: ${sep.toFixed(1)}° apart (atan 3/30 = 5.7°)`);
  check(SP.trueArrow(fr, hb, pts, [0, 0, -1], 10 * Math.PI / 180).length === 0, 'only those inside the window\'s view');
  check(SP.trueArrow(null, hb, pts, null, null).length === 0 && SP.trueArrow(fr, null, pts, null, null).length === 0, 'no frame, no planet: none (the film\'s arrow then)');
  VR.SpaceScene = had;
};
