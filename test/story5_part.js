// a-story5 · test/story.js section 18 (plan docs/superpowers/plans/2026-10-31-a-story5.md): the finale's pictures — the
// nebula from inside as 3-D lights and the air sky's stops turned, 10.3's beam over the Dunelin's beacon seen from the
// village, Echo a soft light with the five peoples standing round it, 12.1's skyline toward the Tortempel, the film's
// 2-D pictures stepping aside, the streaked fireworks. Required by test/story.js.
const path = require('path');
module.exports = function (S, SP, tr, calm, check, rnd) {
  console.log('18 · a-story5: the finale\'s pictures');
  try { require(path.join(__dirname, '../src/main/story_glow.js')); } catch (e) { check(false, 'story_glow.js loads: ' + e.message); }
  const G = VR.StoryGlow;
  check(!!G && typeof G.draw === 'function' && typeof G.axes === 'function', 'VR.StoryGlow: the soft lights\' drawer');
  const sh = (id, i) => S.byId(id).scene.shots[i];
  check(sh('c10.b3', 0).cam === 'skyline' && sh('c10.b3', 0).target === 'lit', '10.3 opens on the skyline toward the lit beacon (no empty up-shot)');
  check(sh('c12.b1', 0).cam === 'skyline' && sh('c12.b1', 0).target === 'temple', '12.1 opens on the skyline toward the Tortempel');
  // a stand-in scene
  const e = [0, 71.6, 0], fwd = [0, 0, -1];
  const mk = (id, t, low) => ({ g: { settings: { preset: low ? 'potato' : 'high', storyLights: true }, time: t }, sc: { b: S.byId(id), t, eye0: e, yaw0: 0, fwd, tg: { sky: [0, 131.6, -60], echo: [0, 70.1, -10], lit: [30, 70, -40], vista: [0, 75, -90] }, ground: () => 70 } });
  const L = (id, t, low) => { const o = mk(id, t, low); return SP.glowList(o.g, o.sc); };
  const n9 = L('c9.b1', 5), n9l = L('c9.b1', 5, true);
  const walls = n9.filter(q => q.kind === 1), dust = n9.filter(q => q.kind === 2), stars = n9.filter(q => q.kind === 0);
  check(walls.length >= 12 && dust.length >= 4 && stars.length >= 15, `ch. 9: the nebula's walls (${walls.length}), dust lanes (${dust.length}), newborn stars (${stars.length})`);
  const far = walls.map(q => Math.hypot(q.p[0] - e[0], q.p[1] - e[1], q.p[2] - e[2]));
  check(Math.min(...far) >= 600 && walls.every(q => q.far && q.s[0] > 150), `… the walls are huge and far in the world (${Math.round(Math.min(...far))}–${Math.round(Math.max(...far))} m, ≥ ${Math.round(Math.min(...walls.map(q => q.s[0])))} m wide), not a picture on the screen`);
  const ahead = walls.filter(q => (q.p[0] - e[0]) * fwd[0] + (q.p[2] - e[2]) * fwd[2] > 0).length;
  check(ahead >= walls.length * 0.55, `… most of them ahead, where the scene looks (${ahead}/${walls.length})`);
  check(n9l.length < n9.length * 0.5 && n9l.length >= 12, `Very Low: fewer lights (${n9l.length} < ${n9.length})`);
  check(L('c9.b1', 0.01).every(q => q.a < 0.01), '… eased in from nothing at the scene\'s start');
  const fl = L('c9.b2', 9).filter(q => Math.hypot(q.p[0], q.p[1] - 131.6, q.p[2] + 60) < 0.01);
  check(fl.length === 3, 'c9.b2: Flimmi is a light in the sky where the sky shot looks (halo, disc, the bright point)');
  // the air sky's stops
  const U = { airK: [1, 2, 1, 0.75], air3: [0.4, 0.6, 1.2, 1.4, 1.0, 0.6, 2.0, 1.4, 0.8], airB: [1.2, 0.9, 0.5] }, lum = (v, o) => 0.2126 * v[o] + 0.7152 * v[o + 1] + 0.0722 * v[o + 2];
  const l0 = [0, 3, 6].map(o => lum(U.air3, o));
  check(SP.tintAir(U, 0.9) && U.airK[2] === 0, 'ch. 9 on an airy world: the air sky drawn from its three stops (not the LUT) while the scene plays');
  check(U.air3[3] > U.air3[4] && U.air3[5] > U.air3[4] && U.air3[2] > U.air3[1], `… turned to the nebula's colours: a pink horizon (${U.air3.slice(3, 6).map(v => v.toFixed(2))}), a violet top`);
  check(lum(U.air3, 3) / l0[1] <= 0.48, '… darker than the day\'s air: a dusk for the walls to glow in (the horizon ×' + (lum(U.air3, 3) / l0[1]).toFixed(2) + '; f-polish4 darker still)');
  check(!SP.tintAir({ airK: [0, 0, 1, 0], air3: null }, 0.9), '… an airless world keeps its veil (E.nebula)');
  // 10.3: the beam over the beacon, bending toward home
  { const o = mk('c10.b3', 6); o.sc.homeDir = [0.6, 0, -0.8]; const B = SP.beamList(o.g, o.sc);
    check(B.length === 2 && B[0].p === o.sc.tg.lit && B[0].len > 200 && B[1].seg && B[1].up[1] > 0, `10.3: a real beam over the lit beacon (${B.length ? Math.round(B[0].len) : 0} m) and its bend toward home`);
    check(SP.BEAM_BEATS['c10.b3'] === 1 && L('c10.b3', 6).length === 2, '… drawn in its scene, its foot and its top aglow'); }
  // 11: Echo
  { const o = mk('c11.b1', 4), B = SP.beamList(o.g, o.sc), Lg = SP.glowList(o.g, o.sc);
    check(B.length <= 1 && (!B.length || B[0].w < 0.3), 'c11: the ring of pale boxes and the lantern columns are gone (' + B.length + ' thread of light)');
    check(Lg.filter(q => q.kind === 0 && q.s[0] >= 4).length === 1 && Lg.length >= 13, `… Echo a soft breathing light with orbs round it (${Lg.length} glows)`);
    check(SP.PEOPLES.length === 5 && SP.PEOPLES.map(q => q[1]).sort().join() === 'aqua,basalt,ocker,opal,zinn' && (!VR.Folk || !VR.Folk.SPECIES_BODY || SP.PEOPLES.every(q => VR.Folk.SPECIES_BODY[q[1]])), 'the five peoples as their natives (folkmodel SPECIES_BODY): ' + SP.PEOPLES.map(q => q[0] + '=' + q[1]).join(' '));
    const Lk0 = VR.LifeKit; VR.LifeKit = { folk: (s, r, a, st) => ({ seed: s, style: st }), yawOf: (dx, dz) => Math.atan2(-dx, -dz) };
    const o2 = mk('c11.b2', 2), pe = SP.peoples(o2.sc); VR.LifeKit = Lk0;
    const E0 = o2.sc.tg.echo, d = pe.map(q => Math.hypot(q.pos[0] - E0[0], q.pos[2] - E0[2])), behind = pe.filter(q => q.pos[2] < E0[2] + 1).length;
    const facing = pe.every(q => { const fx = -Math.sin(q.yaw), fz = -Math.cos(q.yaw); return fx * (E0[0] - q.pos[0]) + fz * (E0[2] - q.pos[2]) > 0; });
    check(pe.length === 5 && d.every(v => v > 3.5 && v < 5) && behind >= 4 && facing && pe.every(q => /^sp:/.test(q.look.style)), `… standing round Echo (${d.map(v => v.toFixed(1)).join(' ')} m), on its far side (${behind}/5), facing it`); }
  check(L('c12.b1', 3).length === 0 && L('c8.b1', 3).length === 0, 'no lights outside their scenes');
  // the film's 2-D pictures step aside where the world shows the thing; the fireworks streak
  const Fx = VR.StoryFx;
  if (Fx) {
    let n = 0, lines = 0; const grad = { addColorStop() {} };
    const mc = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (k === 'createRadialGradient' || k === 'createLinearGradient') ? () => grad : k === 'lineTo' ? () => { n++; lines++; } : () => { n++; }), set: (o, k, v) => { o[k] = v; return true; } });
    const cnt = (k, o) => { const c0 = n; Fx.draw(mc, k, 3, 0.5, 640, 360, o); return n - c0; };
    check(cnt('nebin', { neb3d: true }) < cnt('nebin', {}) * 0.5, 'nebin: with the 3-D walls the film keeps only a few twinkles');
    { const c3 = ['beam', 'echo', 'flimmi'].map(k => [cnt(k, { beam3d: true, echo3d: true, flimmi3d: true }), cnt(k, {})]); check(c3.every(([a, b]) => a < b), 'beam, echo, flimmi: the flat pictures step aside for the world\'s own (' + c3.map(q => q.join('<')).join(' ') + ' calls)'); }
    lines = 0; for (let t = 0.5; t < 12; t += 0.7) Fx.draw(mc, 'finale', t, (t / 12) % 1, 640, 360, {});
    check(lines > 150, `the fireworks are streaked sparks (${lines} streaks over 17 frames)`);
  }
  // the quad's axes: broad side to the camera, square to the view
  { const A = G.axes([300, 400, -500], 10, 5, 0.7, new Float32Array(6)), v = [300, 400, -500], dot = (a, o, b) => a[o] * b[0] + a[o + 1] * b[1] + a[o + 2] * b[2];
    check(Math.abs(dot(A, 0, v)) < 1e-3 && Math.abs(dot(A, 3, v)) < 1e-3 && Math.abs(Math.hypot(A[0], A[1], A[2]) - 10) < 1e-4 && Math.abs(Math.hypot(A[3], A[4], A[5]) - 5) < 1e-4, 'a light\'s quad faces the camera (its axes square to the view, its own size)'); }
  const o3 = mk('c9.b1', 5); o3.g.settings.storyLights = false;
  check(!SP.lightsOn(o3.g) && SP.fx3d(o3.g, o3.sc, { shot: { cam: 'up' } }) === null, 'the switch (storyLights off): no lights, the film\'s own pictures');
};
