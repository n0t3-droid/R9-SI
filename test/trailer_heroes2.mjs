// Round 2 of the trailer's heroes and crowd (the frames t1_16, t1_21, t2_23; TRAILER.md shots E and F).
// The game is photographed from the frames' places: eye height 1.6, FOV 70 (vertical), 4–6 blocks from the heroes,
// at the pictures' size (1296 × 704, the trailer's aspect). Three scenes:
//   hall     t1_16  the two heroes at the console row of the Hangar Hall, blasters up, facing the camera
//   walkout  t1_21  the heroes walk out of the hall toward the camera side by side, the city behind them
//   street   t2_23  the Palm City street at dusk: the heroes walk the road, the people in view are counted
// Metrics (METRIC lines, JSON): the heroes' size in the frame (fraction of the frame height, the frames: about 1/3 for
// t1_16), the people in the frame (census), the crowd's timeline at dusk, and the Very Low cost (five alternating
// rounds, the median is the number).
//   TAG=before|after   the picture's tag: test/shots/trailer_heroes2_<scene>_<TAG>.png
//   DIST_DIR           the folder with index.html (the base build's snapshot for TAG=before)
// The checks run for TAG=after; the last line is ALL OK or FAILED n.
//   bash test/wt_run.sh trailer_heroes2.mjs 2700
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const TAG = process.env.TAG || 'after';
const DIST = process.env.DIST_DIR || '/home/claude/vr/dist';
const W = 1296, H = 704, FOV = 70;
const TOD = +(process.env.TOD || 11800);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file://' + DIST + '/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const metric = (o) => console.log('METRIC ' + JSON.stringify(Object.assign({ tag: TAG }, o)));

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.horizon = 2; g.applySettings('*'); g.settings.fov = 70; });
await ev(`VR.game.createWorld({name:'Heroes2',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
// one loop of our own: the animation frame is off, the renderer skips its work while __norender is set
await ev(([W_PAGE, H_PAGE]) => {
  const g = VR.game, R = g.renderer;
  g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; g.settings.fov = 70;
  const h = document.getElementById('hud'); if (h) h.style.display = 'none';
  if (!R._render) { R._render = R.render; R.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
  window.__norender = true;
  // the view basis of the game's camera (yaw 0 looks toward −z, pitch up is positive) and the frame test of the picture
  window.__basis = (p) => {
    const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw), cp = Math.cos(p.pitch), sp = Math.sin(p.pitch);
    return { eye: [p.pos[0], p.pos[1] + (p.eye || 1.62), p.pos[2]], F: [-sy * cp, sp, -cy * cp], R: [cy, 0, -sy], U: [sy * sp, cp, cy * sp] };
  };
  // a point's screen position in pixels (null behind the camera); the focal length is the same on both axes
  window.__W = W_PAGE; window.__H = H_PAGE;
  window.__project = (B, q, fovDeg) => {
    const dx = q[0] - B.eye[0], dy = q[1] - B.eye[1], dz = q[2] - B.eye[2];
    const z = dx * B.F[0] + dy * B.F[1] + dz * B.F[2];
    if (z <= 0.2) return null;
    const x = dx * B.R[0] + dy * B.R[1] + dz * B.R[2], y = dx * B.U[0] + dy * B.U[1] + dz * B.U[2];
    const W = window.__W, H = window.__H;
    const f = (H / 2) / Math.tan(fovDeg * Math.PI / 360);
    return { x: W / 2 + f * x / z, y: H / 2 - f * y / z, z };
  };
}, [W, H]);
const frames = (n, dtms = 33) => ev(([n, d]) => { const g = VR.game; for (let i = 0; i < n; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [n, dtms]);
// the world streams its chunks from the player's place, and a setCam alone leaves part of a room unloaded for a while (the
// first hall picture had its left half missing): wait until the columns around the spot are loaded (a 5 × 5 grid of
// points, 24 blocks apart at most), then until the mesh pool is idle with nothing pending (three quiet checks in a row)
const around = async (pos) => {
  let cols = false, waits = 0;
  for (; waits < 150 && !cols; waits++) {
    await frames(4, 16);
    cols = await ev(([x, z]) => {
      const w = VR.game.world;
      for (const dx of [-24, -12, 0, 12, 24]) for (const dz of [-24, -12, 0, 12, 24]) if (!w.isLoaded(Math.floor(x + dx), Math.floor(z + dz))) return false;
      return true;
    }, [pos[0], pos[2]]);
    if (!cols) await wait(120);
  }
  let quiet = 0;
  for (let i = 0; i < 300 && quiet < 3; i++) {
    await frames(4, 16);
    const s = await ev(() => ({ busy: VR.game.pool.busy, pend: VR.game.world.pending.size }));
    quiet = s.busy === 0 && s.pend === 0 ? quiet + 1 : 0;
    if (quiet < 3) await wait(100);
  }
  return { cols, waits, quiet: quiet >= 3 };
};
const shot = async (scene) => {
  await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; });
  // the picture is the scene: the game's toasts (its hints and messages) are hidden for the shot
  await ev(() => { for (const id of ['toasts', 'chat']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; } });
  await page.screenshot({ path: `/home/claude/vr/test/shots/trailer_heroes2_${scene}_${TAG}.png`, timeout: 180000 });
  console.log('shot', scene);
};
// the camera: feet at pos, eyes 1.62 above; the target sets yaw and pitch
const setCam = (pos, tgt) => ev(([pos, tgt]) => {
  const p = VR.game.player; p.teleport(pos[0], pos[1], pos[2]); p.flying = true; p.vel = [0, 0, 0];
  const dx = tgt[0] - pos[0], dy = tgt[1] - pos[1] - 1.62, dz = tgt[2] - pos[2];
  p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz));
}, [pos, tgt]);
const setTod = (t) => ev((t) => VR.game.env.setTime(t), t);
// the people in the picture: villagers inside the frame and the draw distance, with what they do and how many stand close together
const census = () => ev(([W, H]) => {
  const g = VR.game, p = g.player, V = g.villages, FD = g.folkDist || g.folkBase || 100;
  const B = window.__basis(p), fov = g.settings.fov || 70;
  const IND = (VR.Crowd && VR.Crowd.INDOOR) || {};   // (the base build has no indoor list: every person in view counts)
  const th = Math.tan(fov * Math.PI / 360), tw = th * W / H;
  const inF = [], kinds = {}; let all = 0, runners = 0, seated = 0, far = 0, indoor = 0;
  for (const a of (V && V.agents) || []) {
    all++;
    const dx = a.pos[0] - p.pos[0], dz = a.pos[2] - p.pos[2];
    if (dx * dx + dz * dz > FD * FD) { far++; continue; }
    const q = [a.pos[0], a.pos[1] + 0.9, a.pos[2]];
    const ex = q[0] - B.eye[0], ey = q[1] - B.eye[1], ez = q[2] - B.eye[2];
    const z = ex * B.F[0] + ey * B.F[1] + ez * B.F[2];
    if (z < 0.5) continue;
    const x = ex * B.R[0] + ey * B.R[1] + ez * B.R[2], y = ex * B.U[0] + ey * B.U[1] + ez * B.U[2];
    if (Math.abs(x) > tw * z || Math.abs(y) > th * z) continue;
    const k = a.act ? a.act.type : (a.pose || '-'); kinds[k] = (kinds[k] || 0) + 1;
    if (a.pose === 'sleep' || (a.act && IND[a.act.type])) { indoor++; continue; }
    inF.push(q);
    if (a.act && a.act.run) runners++;
    if (a.pose === 'sit') seated++;
  }
  // the largest number of people outdoors in view within 6 blocks of one of them (a mob shows up here)
  let mob = 0;
  for (const q of inF) { let n = 0; for (const r of inF) if ((q[0] - r[0]) ** 2 + (q[2] - r[2]) ** 2 < 36) n++; if (n > mob) mob = n; }
  return { villagers: all, beyondDraw: far, outdoorInView: inF.length, indoorInView: indoor, mostNear6: mob, runners, seated, kinds, folkDist: FD, preset: g.settings.preset };
}, [W, H]);
const heroes = () => ev(([W, H]) => {
  const C = VR.Crowd, p = VR.game.player, B = window.__basis(p), fov = VR.game.settings.fov || 70;
  if (!C || !C.heroes) return [];
  return C.heroes.map(h => {
    const f = window.__project(B, [h.pos[0], h.pos[1], h.pos[2]], fov), t = window.__project(B, [h.pos[0], h.pos[1] + 1.9, h.pos[2]], fov);
    if (!f || !t) return { id: h.id, behind: true };
    return { id: h.id, x: Math.round(f.x), feet: Math.round(f.y), top: Math.round(t.y), frac: +((f.y - t.y) / H).toFixed(3), dist: +f.z.toFixed(2), state: h.state };
  });
}, [W, H]);
// the crew: the two suits of the trailer, blasters in hand, at the given places (the Gate Temple's hall places them the same way)
const crew = (list) => ev((list) => {
  const C = VR.Crowd; if (!C) return -1;
  C.clear();
  for (const c of list) C.addHero(c);
  return C.heroes.length;
}, list);
const timed = (n) => ev((n) => { const g = VR.game; window.__norender = false; const t0 = performance.now(); for (let i = 0; i < n; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); const ms = (performance.now() - t0) / n; window.__norender = true; return ms; }, n);
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : -1; };

// ---------------------------------------------------------------- the frames' places (the numbers come from the frames: see the plan)
const HALL_CAM = [[0, 81, 4.5], [0, 84.56, -5.5]];                 // t1_16: 4.5 blocks from the heroes, pitch 11°
const HALL_CREW = [
  { id: 'blau', suit: 0, pos: [-3.2, 81, 0], yaw: Math.PI, act: 'aim' },
  { id: 'orange', suit: 6, pos: [3.2, 81, 0], yaw: Math.PI, act: 'aim' },
];
const WALK_CAM = [[0, 81, -35], [0, 83.67, -45]];                  // t1_21: inside the door, the city beyond it
const WALK_CREW = [
  { id: 'blau', suit: 0, pos: [-0.8, 81, -44], yaw: Math.PI, act: 'walk', aim: true, walk: { to: [-0.8, 81, -39], speed: 1.9 } },
  { id: 'orange', suit: 6, pos: [0.8, 81, -44], yaw: Math.PI, act: 'walk', aim: true, walk: { to: [0.8, 81, -39], speed: 1.9 } },
];
const STREET_CAM = [[0, 81, -66], [0, 89.67, -106]];               // t2_23: the avenue, pitch 10°
const STREET_CREW = [
  { id: 'blau', suit: 0, pos: [-1.2, 81, -76], yaw: Math.PI, act: 'walk', aim: true, walk: { to: [-1.2, 81, -72], speed: 1.9 } },
  { id: 'orange', suit: 6, pos: [1.1, 81, -76], yaw: Math.PI, act: 'walk', aim: true, walk: { to: [1.1, 81, -72], speed: 1.9 } },
];
const STREET_HOLD = [
  { id: 'blau', suit: 0, pos: [-1.2, 81, -72], yaw: Math.PI, act: 'hold', aim: true },
  { id: 'orange', suit: 6, pos: [1.1, 81, -72], yaw: Math.PI, act: 'hold', aim: true },
];

// ---------------------------------------------------------------- hall
await setTod(TOD);
await setCam(HALL_CAM[0], HALL_CAM[1]);
const ldH = await around(HALL_CAM[0]);
await crew(HALL_CREW);
await frames(40);
await shot('hall');
metric({ scene: 'hall', loaded: ldH, heroes: await heroes(), ...(await census()) });

// ---------------------------------------------------------------- walkout (the heroes come toward the camera)
await setCam(WALK_CAM[0], WALK_CAM[1]);
const ldW = await around(WALK_CAM[0]);
await crew(WALK_CREW);
await frames(100);
await shot('walkout');
metric({ scene: 'walkout', loaded: ldW, heroes: await heroes(), ...(await census()) });

// ---------------------------------------------------------------- the street at dusk
await setCam(STREET_CAM[0], STREET_CAM[1]);
const ldS = await around(STREET_CAM[0]);
await crew(STREET_CREW);
await frames(100);
await shot('street');
metric({ scene: 'street', tod: TOD, loaded: ldS, heroes: await heroes(), ...(await census()) });
// the crowd over time at dusk: the same view, 150 frames apart, without drawing (the simulation runs, the picture waits)
const timeline = [];
for (let k = 0; k < 3; k++) { await frames(150); timeline.push((await census()).outdoorInView); }
metric({ scene: 'street_timeline', inViewEvery150: timeline });
// the view as the trailer shows it: the same frame at the dusk's later end, for the people's walk home
await setTod(12150);
await frames(60);
metric({ scene: 'street_late', tod: 12150, ...(await census()) });
await setTod(TOD);
await frames(60);

// ---------------------------------------------------------------- Very Low: the cost of a frame, with and without the heroes
await setCam(STREET_CAM[0], STREET_CAM[1]);
await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); g.settings.fov = 70; });
const ldV = await around(STREET_CAM[0]);
await crew(STREET_HOLD);
metric({ scene: 'verylow_people', preset: 'potato', loaded: ldV, ...(await census()) });
await ev(() => { const C = VR.Crowd; if (!C || !C.draw || C.__timedDraw) return; const d = C.draw; window.__crowdMs = 0; C.draw = function (r, E, cam) { const t0 = performance.now(); d.call(this, r, E, cam); window.__crowdMs += performance.now() - t0; }; C.__timedDraw = true; });
const off = [], on = [], crowdOff = [], crowdOn = [];
const crowdNow = () => ev(() => window.__crowdMs || 0);
const round = async (list, ms, cr) => {
  await crew(list);
  const c0 = await crowdNow();
  const t = await timed(3);
  const c1 = await crowdNow();
  ms.push(t); cr.push((c1 - c0) / 3);
};
await timed(4);
await crew(STREET_HOLD); await timed(4);
for (let r = 0; r < 5; r++) {
  await round([], off, crowdOff);
  await round(STREET_HOLD, on, crowdOn);
}
metric({ scene: 'verylow_frame', ms: +med(off).toFixed(1), rounds: off.map(x => +x.toFixed(1)), preset: 'potato', heroes: 0 });
metric({ scene: 'verylow_frame_heroes', ms: +med(on).toFixed(1), rounds: on.map(x => +x.toFixed(1)), preset: 'potato', heroes: 2 });
metric({ scene: 'verylow_crowd_draw', heroesOff: +med(crowdOff).toFixed(3), heroesOn: +med(crowdOn).toFixed(3), preset: 'potato' });
const crowdMs = await ev(() => { const C = VR.Crowd; if (!C || !C.update) return -1; const t0 = performance.now(); for (let i = 0; i < 200; i++) C.update(1 / 30); return (performance.now() - t0) / 200; });
metric({ scene: 'verylow_crowd_update', ms: +crowdMs.toFixed(3), preset: 'potato', heroes: 2 });
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.applySettings('*'); g.settings.fov = 70; });

console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 25)) console.log(l);
if (TAG === 'after') {
  check(logs.length === 0, 'no console errors or page errors');
  check(await ev(() => !!VR.Crowd && VR.Crowd.heroes.every(h => h.look && h.look.helm && h.look.tool === 'blaster')), 'both heroes wear a helmeted suit with a blaster');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);
