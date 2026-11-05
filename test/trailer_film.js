// f-film2 · the 'welt' trailer's cinema grade, framing and music (docs/superpowers/plans/2026-11-05-f-film2.md), the pure
// parts:
//  (a) TW.FILM: the grade swapped into VR.Grade and given back exactly (gradeSwap)
//  (b) TW.fogNear: fog-bank sprites whose edge is near the lens are dropped, the far ones kept
//  (c) TW.shipSolid + clearAngle: a parked ship in the line of sight turns the camera to another side
//  (d) the outpost shot: a low, wide move looking at the beacon from the side (not down from above)
//  (e) TW.dressSpots: foreground spots ahead of the lens, in the lower corners, never in the middle of the frame
//  (f) VR.TrailerScore: the game's own themes on the film's clock — finite, in the film; quiet start, the swell at the
//      isles' reveal (the Staunen sting), the tonic landing on the title, the gain envelope from silence to silence
//  (g) the composite's FILMG pass exists only behind its define; the banner's film style
const path = require('path');
const fs = require('fs');
global.VR = {};
const ROOT = path.join(__dirname, '..');
for (const f of ['klang', 'score', 'scoresynth', 'trailer_welt', 'trailer_score']) { try { require(path.join(ROOT, 'src', 'main', f + '.js')); } catch (e) { console.log('  ! ' + f + '.js: ' + e.message); } }
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const TW = VR.TrailerWelt, TS = VR.TrailerScore;
const A = { meadow: [300, 84, 200], village: [-1, 81, -55], fairy: [74, 90, -278], outpost: [-523, 83, -497], beacon: [-529, 84, -503], isles: [330, 146, 140] };
const S = TW.plan(A);

// (a) the grade
const G = { sat: 1.12, contrast: 0.3, vignette: 0.3, fogDens: 0.00016, expo: 0.75, bloomStr: 0.1 }, G0 = Object.assign({}, G);
check(TW.FILM && TW.FILM.sat > G0.sat && TW.FILM.contrast > G0.contrast && TW.FILM.fogDens < G0.fogDens, 'TW.FILM: richer (saturation ' + (TW.FILM && TW.FILM.sat) + ', contrast ' + (TW.FILM && TW.FILM.contrast) + '), a thinner haze');
const saved = TW.gradeSwap ? TW.gradeSwap(G, TW.FILM) : null;
check(saved && G.sat === TW.FILM.sat && G.vignette === TW.FILM.vignette, 'gradeSwap puts the film grade into VR.Grade');
if (saved) TW.gradeSwap(G, saved);
check(JSON.stringify(G) === JSON.stringify(G0), 'and the swap back restores every knob exactly');
check(Array.isArray(TW.FILM_GL) && TW.FILM_GL.length === 4 && TW.FILM_GL[3] === 1, 'u_film: lift, warmth, vignette, on');

// (b) fog near the lens
const fog = [[0, 100, 30, 12, 0.5], [0, 100, 200, 20, 0.5], [50, 90, 0, 30, 0.5], [400, 100, 0, 40, 0.5]];
const kept = TW.fogNear ? TW.fogNear(fog, { x: 0, y: 100, z: 0 }, 60) : fog;
check(kept.length === 2 && kept.includes(fog[1]) && kept.includes(fog[3]), 'fogNear drops the sprites whose edge is within 60 m of the lens (' + kept.length + ' of 4 kept)');
check(TW.fogNear && TW.fogNear(fog, { x: 0, y: 100, z: 0 }, 0) === fog, 'fogNear 0: the list as it is (no copy)');

// (c) a parked ship
const ship = { pos: [0, 100, 10], yaw: 0, d: { occ: { bx: 8, by: 5, bz: 20, occ: new Uint8Array(8 * 5 * 20).fill(1) }, meta: { origin: [-4, 0, -10] } } };
const sol = TW.shipSolid ? TW.shipSolid([ship], [0, 100, 0], 80) : null;
check(sol && sol(0, 101, 10) && !sol(0, 101, 30) && !sol(20, 101, 10), 'shipSolid: inside the ship\'s box solid, outside not');
const none = () => false, solid = (x, y, z) => none(x, y, z) || (sol && sol(x, y, z));
const ang = TW.clearAngle(solid, [0, 100, 0], 0, 24, 20, 6, 5, 3, 12);
check(Math.cos(ang) < 0.5, 'clearAngle turns away from a parked ship in the line of sight (' + (ang * 180 / Math.PI).toFixed(0) + '°)');
const rot = TW.shipSolid([Object.assign({}, ship, { yaw: Math.PI / 2, pos: [10, 100, 0] })], [0, 100, 0], 80);
check(rot(10, 101, 0) && rot(19, 101, 0) && !rot(10, 101, 9), 'shipSolid: the box turns with the ship\'s yaw');

const open = () => false, avoid = [{ p: [0, 102, 12], r: 5 }];   // a ship parked between the +z side and the target
const angA = TW.clearAngle(open, [0, 100, 0], 0, 24, 18, 3, 2.5, 6, 12, avoid);
check(Math.cos(angA) < 0.6, 'clearAngle(avoid): a ship that would stand in the frame before the target turns the camera (' + (angA * 180 / Math.PI).toFixed(0) + '°)');
check(TW.clearAngle(open, [0, 100, 0], 0, 24, 18, 3, 2.5, 6, 12) === 0, 'without it the first angle stays');
const fr = S.filter(s => s.fogR !== undefined).map(s => s.name + ' ' + s.fogR);
check(S.find(s => s.name === 'abend').fogR >= 1000 && S.find(s => s.name === 'titel').fogR >= 1000 && S.find(s => s.name === 'inseln').fogR > 70, 'no fog banks in the night shots, none at mid distance by the isles (' + fr.join(', ') + ')');
check(TW.isMist && TW.isMist({ grow: 0.9, emis: 0.15, col: [0.9, 0.94, 0.98] }) && !TW.isMist({ grow: 0.8, emis: 1, col: [1, 0.6, 0.25] }) && !TW.isMist({ grow: 0.25, col: [0.75, 0.75, 0.78] }) && !TW.isMist({ size: 0.1 }), 'isMist: the falls\' white growing puffs, not sparks, not smoke wisps');
// (d) the outpost shot
const lib = S.find(s => s.stage === 'liberate');
const k0 = lib.keys[0], k1 = lib.keys[lib.keys.length - 1], B = A.beacon;
const r0 = Math.hypot(k0[1][0] - B[0], k0[1][2] - B[2]), h0 = k0[1][1] - B[1], h1 = k1[1][1] - B[1];
check(h0 <= 9 && h1 <= 8 && h0 >= 3, 'the outpost: a low camera (' + h0.toFixed(1) + ' → ' + h1.toFixed(1) + ' m over the beacon)');
check(r0 >= 22 && Math.hypot(k1[1][0] - B[0], k1[1][2] - B[2]) >= 16, 'a wide move: the beacon and its beam in the frame (r ' + r0.toFixed(1) + ')');
check(k0[2][1] - B[1] >= 4, 'looking at the beacon\'s top and beam, not down at the pad');
check(TW.BANNER_LATE === undefined || TW.FREE_AT <= 1.2, 'the freeing starts early in its shot (the banner follows 2.4 s later)');

// (e) dressing
const top = () => 80, can = () => true;
const cam = [0, 82, 0], look = [0, 82, -20];   // looking along −z
const spots = TW.dressSpots ? TW.dressSpots(cam, look, top, can, 12, 58) : [];
check(spots.length >= 6, 'dressSpots: a dozen foreground spots (' + spots.length + ')');
let inBand = true, centre = 0;
for (const p of spots) {
  const ahead = -(p[2] - cam[2]), side = p[0] - cam[0];
  if (ahead < 2 || ahead > 7.5 || p[1] !== 81) inBand = false;
  if (Math.abs(side) < ahead * 0.25) centre++;
}
check(inBand, 'every spot just past the frame\'s bottom edge (2–7.5 m ahead here), on the ground (y = top + 1)');
check(centre === 0, 'none in the middle of the frame (the subject stays free)');
check(TW.dressSpots && TW.dressSpots([0, 120, 0], [0, 80, -20], top, can, 12).length === 0, 'a high camera: no dressing (the ground is far)');

// (f) the music
check(!!TS && typeof TS.parts === 'function', 'VR.TrailerScore.parts');
if (TS) {
  const P = TS.parts(S), total = S.reduce((a, s) => a + s.dur, 0);
  const at = (name) => { let t = 0; for (const s of S) { if (s.name === name) return t; t += s.dur; } return -1; };
  const reveal = at('inseln'), title = at('titel');
  check(P.length === 3 && P[0].at === 0 && Math.abs(P[1].at - reveal) < 1e-6 && P[2].at < title && P[2].at > title - 2, 'three parts: the opening at 0, the reveal at ' + reveal + ' s, the outro just before the title (' + (P[2] && P[2].at.toFixed(2)) + ')');
  const all = TS.events(S);
  check(all.length > 80 && all.every(e => Number.isFinite(e.t) && Number.isFinite(e.dur) && e.dur > 0 && e.t >= 0 && e.t < total && Number.isFinite(e.gain) && e.gain > 0), 'every note finite and inside the film (' + all.length + ' notes)');
  check(all.every(e => !e.midi || (e.midi >= 24 && e.midi <= 108)), 'every pitch in range');
  check(new Set(all.map(e => e.inst)).size >= 4, 'the game\'s own instruments (' + [...new Set(all.map(e => e.inst))].join(', ') + ')');
  const before = all.filter(e => e.t < reveal), after = all.filter(e => e.t >= reveal && e.t < title);
  const dens = (L, a, b) => L.reduce((s, e) => s + e.gain, 0) / (b - a);
  check(dens(after, reveal, title) > dens(before, 0, reveal) * 1.2, 'the swell: more sound after the reveal (' + dens(before, 0, reveal).toFixed(3) + ' → ' + dens(after, reveal, title).toFixed(3) + ' a second)');
  const bells = all.filter(e => e.inst === 'bell' && e.t >= reveal - 0.01 && e.t < reveal + 3);
  check(bells.length >= 5 && bells.slice(1).every((e, i) => e.t >= bells[i].t), 'the Staunen sting\'s bell climb starts on the reveal (' + bells.length + ' bells in its first 3 s)');
  const tonic = TS.ROOT % 12, last = all.filter(e => e.midi && e.t >= title - 0.1 && e.t < title + 1.5);
  check(last.length >= 3 && last.some(e => e.midi % 12 === tonic) && last.every(e => [0, 4, 7].includes(((e.midi - TS.ROOT) % 12 + 12) % 12)), 'the title lands on the tonic chord (' + last.map(e => e.midi).join(' ') + ')');
  check(all.filter(e => e.t >= title + 1.5).length === 0 && all.some(e => e.tail >= 2 && e.t >= title - 0.1), 'after the title nothing new: the last chord rings out');
  const env = TS.envelope(S);
  check(env[0][0] === 0 && env[0][1] < 0.01 && env[env.length - 1][0] === total && env[env.length - 1][1] < 0.01 && env.every((p, i) => !i || p[0] >= env[i - 1][0]), 'the envelope: from silence, back to silence at ' + total + ' s');
  const g = (t) => { for (let i = 1; i < env.length; i++) if (t <= env[i][0]) { const a = env[i - 1], b = env[i]; return a[1] + (b[1] - a[1]) * (t - a[0]) / Math.max(1e-6, b[0] - a[0]); } return 0; };
  check(g(reveal + 1.5) > g(reveal - 1) + 0.1, 'the bus swells at the reveal (' + g(reveal - 1).toFixed(2) + ' → ' + g(reveal + 1.5).toFixed(2) + ')');
  const S2 = TW.plan({ meadow: [300, 84, 200], isles: [330, 146, 140] });
  check(TS.events(S2).every(e => Number.isFinite(e.t)) && TS.parts(S2).length === 3, 'a plan without village or outpost: the music still fits');
}
// (g) the shader and the banner
const sh = fs.readFileSync(path.join(ROOT, 'src', 'main', 'shaders.js'), 'utf8');
const ci = sh.indexOf('S.COMPOSITE_FS'), comp = sh.slice(ci, sh.indexOf('S.TSR_FS', ci));
check(/#ifdef FILMG[\s\S]*uniform vec4 u_film;[\s\S]*#endif/.test(comp) && /#ifdef FILMG\s*\n\s*c = filmGrade\(c, v_uv\);/.test(comp), 'the composite has the FILMG pass behind its define');
const src = fs.readFileSync(path.join(ROOT, 'src', 'main', 'trailer_welt.js'), 'utf8');
check(/body\.r9film #libban/.test(src) && /body\.r9film #libban \.sub\{display:none/.test(src), 'the BEFREIT banner: small in the top band, no reward line during the film');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
