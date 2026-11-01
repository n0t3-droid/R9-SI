// a-story8 · test/story.js section 23 (plan docs/superpowers/plans/2026-11-01-a-story8.md): Arc 2's beauty — the
// Dreilichterfest's people (the cast, the ring, the gathering spot, the glows; Very Low fewer), Wiegelind resting at her
// place (the model, the breath, the far Flausel at the Saatwiese, their lines in both tables), Funke's close camera
// (from in front, at his eye height). Pure parts and the glue on stand-ins (src/main/story_arc2b.js). Required by
// test/story.js after story9_part.js (its stand-in game).
module.exports = function (S, SP, tr, calm, check) {
  console.log('23 · a-story8: Arc 2\'s beauty');
  const path = require('path'), SRC = path.join(__dirname, '../src/');
  const TAU = Math.PI * 2;
  // stand-ins the glue wraps: fairy.js's frame and draw, a world
  const F = VR.Fairy || (VR.Fairy = { state: { key: '', sites: [] } }); F.state = F.state || { key: '', sites: [] }; let drawn = 0;
  F.frame = function () { return 1; }; F.draw = function () { drawn++; return 1; };
  F.state.t = 0;
  require(SRC + 'main/fairy_models.js');
  require(SRC + 'main/story_arc2b.js');
  const B = VR.StoryArc2b;
  check(!!B && typeof B.stage === 'function' && typeof B.extra === 'function', 'VR.StoryArc2b loads');
  // ---- the cast and the ring
  const hi = B.cast(9, false), lo = B.cast(9, true);
  check(hi.filter(q => q.role === 'ring').length === 10 && hi.filter(q => q.kid).length === 4 && lo.length === 8 && lo.length < hi.length, 'the cast: ten dancers and four children (Very Low six and two)');
  check(new Set(hi.map(q => q.seed)).size === hi.length && hi.filter(q => !q.kid).every(q => q.fam === q.i >> 1) && hi.filter(q => q.kid).every(q => q.fam < 5), 'families: couples, each child of one, every look its own');
  const C = [10, 66, -4], r = B.ringR(10), at = [];
  for (const q of hi) at.push(B.at(q, q.kid ? 4 : 10, C, r, 3.3).slice());
  const ringOk = hi.every((q, k) => { const a = at[k], d = Math.hypot(a[0] - C[0], a[1] - C[2]); if (q.role !== 'ring') return Math.abs(d - (r + 1.7)) < 1e-6; const fx = -Math.sin(a[2]), fz = -Math.cos(a[2]); return Math.abs(d - r) < 1e-6 && (fx * (C[0] - a[0]) + fz * (C[2] - a[1])) / d > 0.999; });
  check(ringOk && Math.abs(2 * r * Math.sin(Math.PI / 10) - B.CHORD) < 0.01, 'the ring: hands joined (' + r.toFixed(2) + ' m), every dancer facing its middle; the children walk round it');
  const k0 = hi.find(q => q.kid), a0 = B.at(k0, 4, C, r, 1).slice(), a1 = B.at(k0, 4, C, r, 1.05);
  const mv = [a1[0] - a0[0], a1[1] - a0[1]], fw = [-Math.sin(a0[2]), -Math.cos(a0[2])];
  check((mv[0] * fw[0] + mv[1] * fw[1]) / Math.hypot(mv[0], mv[1]) > 0.99, 'a child faces the way it walks (its lantern ahead)');
  const ring0 = B.at(hi[0], 10, C, r, 0).slice(), ring1 = B.at(hi[0], 10, C, r, 1), turn = (Math.atan2(ring1[1] - C[2], ring1[0] - C[0]) - Math.atan2(ring0[1] - C[2], ring0[0] - C[0]));
  const kTurn = (Math.atan2(a1[1] - C[2], a1[0] - C[0]) - Math.atan2(a0[1] - C[2], a0[0] - C[0]));
  check(turn > 0 && kTurn < 0, 'the ring turns one way, the children the other');
  // the middle: a well in the plaza's middle and a house on one side
  const open = (x, z) => !(Math.hypot(x - 0, z - 0) < 1.2) && !(x > 1.5 && x < 4 && Math.abs(z) < 3);
  const c0 = B.centre(open, 0, 0, 2.3), c1 = B.centre((x, z) => !(x > -1 && x < 1), 0, 0, 2.3);
  check(c0[2] && B.ringOpen(open, c0[0], c0[1], 2.3) && Math.hypot(c0[0], c0[1]) <= 6 && c1[2] && Math.hypot(c1[0], c1[1]) > 2, 'the ring finds open floor near the plaza\'s middle (' + c0.slice(0, 2).map(v => v.toFixed(1)).join(', ') + ')');
  // ---- the glows: the lanterns flare three times together
  const Fh = { c: C, r, n: B.N(false), cast: hi }, Fl = { c: C, r, n: B.N(true), cast: lo };
  const gh = B.festGlows(Fh, 0.15, false), gl = B.festGlows(Fl, 0.15, true), gRest = B.festGlows(Fh, 2.5, false);
  check(gh.length === 4 + 8 + 1 && gl.length === 2 + 4 + 1 && gl.length < gh.length && gh.every(q => q.a > 0 && q.s[0] > 0 && q.kind === 0), 'the festival\'s glows: a lantern each child, the Flausel lights, the warm air (Very Low ' + gl.length + ' vs ' + gh.length + ')');
  check(gh[0].a > gRest[0].a + 0.3, 'the lanterns flare with her three blinks (' + gh[0].a.toFixed(2) + ' vs ' + gRest[0].a.toFixed(2) + ' at rest)');
  // ---- the gathering spot on the stand-in game: the celebrating village's plaza, else your settlement's
  const g = VR.game;
  if (!VR.LifeKit) VR.LifeKit = { folk: (seed, role, age) => ({ seed, role, age }) };   // (the looks: a stand-in)
  g.dim = 'overworld'; g.player.pos = [300, 70, 300];
  const vil = { active: true, plan: { plaza: { x: 330, y: 66, z: 300, r: 4 } }, agents: [] };
  let feast = true;
  g.villages = { known: new Map([[1, vil]]), festivalDay: () => feast };
  const sp = B.spot(g);
  check(sp && sp.x === 330.5 && sp.vil === vil, 'the spot: the plaza of the village that celebrates tonight');
  feast = false; const sp2 = B.spot(g);
  check(!sp2 || sp2.vil === null, 'a village without its festival is not the spot (' + (sp2 ? 'your settlement' : 'none') + ')');
  feast = true;
  const sc = { b: S.byId('c16.b1'), t: 0, tg: {}, eye0: [300, 71.6, 300], fwd: [1, 0, 0], ground: () => 66, free: (Q) => !(Math.hypot(Q[0] - 330.5, Q[2] - 300.5) < 1.1) };
  A2r(g, sc);
  function A2r(g0, s0) { VR.StoryArc2.resolve(g0, s0); }
  const Fs = sc.fest;
  check(Fs && Fs.folk.length === 14 && Math.hypot(Fs.c[0] - 330.5, Fs.c[2] - 300.5) < 6.5 && Fs.c[1] === 66 && sc.tg.home && Math.abs(sc.tg.home[0] - Fs.c[0]) < 1e-6 && sc.tg.home[1] === 68, 'c16.b1 stages the festival: 14 people at the plaza, the scene\'s home target its middle');
  vil.agents = [0, 1, 2, 3, 4].map(i => ({ festRole: 'dance', pos: [330.5 + Math.cos(i) * 3, 66, 300.5 + Math.sin(i) * 3] }));
  const sc2 = Object.assign({}, sc, { tg: {} }); A2r(g, sc2);
  const dC = sc2.fest ? Math.hypot(sc2.fest.c[0] - 330.5, sc2.fest.c[2] - 300.5) : 0;
  check(sc2.fest && sc2.fest.real === 5 && Math.abs(sc2.fest.r - B.ringR(10)) < 1e-6 && dC >= 4 + 1.2 + sc2.fest.r - 1e-6, 'the village\'s own dancers hold the plaza: our ring dances beside theirs (' + dC.toFixed(1) + ' m off)');
  const sc2b = Object.assign({}, sc, { tg: {}, ground: (x, z) => (Math.hypot(x - 330.5, z - 300.5) < 8 ? 66 : null) }); A2r(g, sc2b);
  check(sc2b.fest && sc2b.fest.r >= 4 + 2.6 && Math.abs(sc2b.fest.c[0] - 330.5) < 1e-6, 'no room beside: round theirs (r ' + (sc2b.fest && sc2b.fest.r.toFixed(1)) + ' m)');
  g.settings.preset = 'potato'; const sc3 = Object.assign({}, sc, { tg: {} }); A2r(g, sc3); g.settings.preset = 'high';
  check(sc3.fest && sc3.fest.folk.length === 8, 'Very Low: eight people');
  const sc4 = { b: S.byId('c15.b1'), t: 0, tg: {}, eye0: sc.eye0, fwd: sc.fwd, ground: sc.ground, free: sc.free }; A2r(g, sc4);
  check(!sc4.fest, 'other scenes stage nothing');
  // the glow list: the festival's lights in its scene, nothing more outside Arc 2
  const L16 = SP.glowList(g, sc), L5 = SP.glowList(g, { b: S.byId('c5.b1'), t: 1, tg: {}, eye0: sc.eye0, fwd: sc.fwd });
  check(L16.length >= 13 && L5.length === 0, 'the scene\'s glow list carries the festival\'s lights (' + L16.length + '); an old chapter\'s none');
  // ---- Funke's close camera: in front of him, at his eye height, about two metres
  const Q = [5, 70, 5], cc = B.closeCam(Q, [0, 0, -1], 2.1, 0), dv = [cc.C[0] - Q[0], cc.C[1] - Q[1], cc.C[2] - Q[2]];
  check(dv[2] < -1.5 && Math.abs(dv[1]) < 0.2 && Math.hypot(dv[0], dv[1], dv[2]) > 1.8 && Math.hypot(dv[0], dv[1], dv[2]) < 2.4 && Math.abs(dv[0]) > 0.5, 'Funke\'s close-up: from in front (the scene\'s forward), at his eye height, a little to the side');
  // ---- Wiegelind at her place
  const br = [0, 1.4, 2.75, 4.1, 5.5].map(B.breath);
  check(br.every(b => b.s > 0.96 && b.s < 1.04 && b.a > 0.3 && b.a < 0.9) && Math.abs(br[0].s - br[4].s) < 1e-6 && br[1].s > br[0].s && br[3].s < br[0].s, 'her breath: 5.5 s in and out (size and glow)');
  const site = { kind: 'circle', x: 40, z: 60, y: 66, yaw: 0.3, story: true, parts: [{ m: 'fy_altar', pos: [40, 65.9, 60], yaw: 0, o: {} }] };
  const ex = B.extra(site, () => 66);
  check(ex.parts.length === 1 && ex.parts[0].m === 'fy_wiege' && Math.abs(ex.parts[0].pos[1] - 66.85) < 1e-6 && ex.folk.length === 0, 'Wiegelinds Ruh: Wiegelind rests over the altar');
  const ex2 = B.extra({ kind: 'shroom', x: 0, z: 0, y: 66, yaw: 0, story: true, parts: [] }, () => 66);
  check(ex2.folk.length === 3 && ex2.folk[0].who === 'saemli' && ex2.parts.filter(q => /^fy_house_/.test(q.m)).length === 3 && ex2.parts.some(q => q.m === 'fy_seed'), 'Wiegelinds Saatwiese: Sämli and two far Flausel settled, their three little houses, glow seeds');
  check(['saemli', 'fern0', 'fern1'].every(w => [0, 1, 2].every(i => tr('de', 'g.fairy.chat.' + w + '.' + i) && tr('en', 'g.fairy.chat.' + w + '.' + i) && tr('de', 'g.fairy.chat.' + w + '.' + i) !== tr('en', 'g.fairy.chat.' + w + '.' + i))), 'the far Flausel talk (both tables, German first)');
  const M = VR.VOXMODELS && VR.VOXMODELS.fy_wiege && VR.VOXMODELS.fy_wiege();
  let vox = 0, emis = 0, face = 0, gold = 0;
  if (M) { const gr = M.parts.body.grid; for (let i = 0; i < gr.c.length; i++) { const v = gr.c[i]; if (!v) continue; vox++; if (v >> 24 & 1) emis++; const c = v & 0xffffff; if (c === 0x6a5a8c || c === 0xf6a8be) face++; if (((c >> 16) & 255) > 230 && ((c >> 8) & 255) > 190 && (c & 255) < 170) gold++; } }
  check(M && vox > 900 && emis === vox && face >= 10 && gold > 12, 'fy_wiege: a glowing pearl moon with a sleeping face in a crescent cradle (' + vox + ' voxels, face ' + face + ', cradle gold ' + gold + ')');
  // the place's frame: once injected, her breath moves her; the halo not on Very Low
  F.state.near = site; site.folk = [];
  g.world = { isLoaded: () => true, topAt: () => 65 }; g.player.pos = [50, 66, 60];
  F.frame(g, 0.1); F.state.t = 1.4; F.frame(g, 0.1);
  const wq = site.parts.find(q => q.o.wiege);
  check(wq && site.parts._a8 && wq.o.scale > 1.01 && wq.yaw !== 0.3, 'at her place: Wiegelind injected once, breathing, turning to her visitor');
  F.frame(g, 0.1); check(site.parts.filter(q => q.o.wiege).length === 1, 'only once');
  F.state.near = null;
};
