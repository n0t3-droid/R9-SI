// The trailer's heroes and people (TRAILER.md shots E and F; the frames t2_14, t1_21, t2_20, t2_23, t3_05):
// the two heroes (blue and orange armour, blasters) at the console row of the Hangar Hall, at the corridor's exit
// toward the city, walking out toward the camera, and the Palm City street at dusk with its people. The game is
// photographed from the places the frames were shot from; the pictures are test/shots/trailer_<scene>_<TAG>.png.
//   TAG=base   the game as it was before this branch (no crew; the pictures are the "before")
//   TAG=after  this branch: the crew is placed by the test the way the Gate Temple's hall places it (VR.Crowd.addHero)
//   DIST_DIR   the folder with index.html to run (a snapshot of the base build for TAG=base)
// Metrics come out as METRIC lines (JSON). The checks run for TAG=after; the last line is ALL OK or FAILED n.
//   bash test/wt_run.sh trailer_heroes.mjs 1800
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const TAG = process.env.TAG || 'after';
const DIST = process.env.DIST_DIR || '/home/claude/vr/dist';
const W = +(process.env.W || 1296), H = +(process.env.H || 704);
const DUSK = +(process.env.DUSK || 11800);
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
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.horizon = 2; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Heroes',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
// one loop of our own: the animation frame is off, the renderer skips its work while __norender is set
await ev(() => {
  const g = VR.game, R = g.renderer;
  g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true;
  const h = document.getElementById('hud'); if (h) h.style.display = 'none';
  if (!R._render) { R._render = R.render; R.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
  window.__norender = true;
});
const frames = (n, dtms = 33) => ev(([n, d]) => { const g = VR.game; for (let i = 0; i < n; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [n, dtms]);
const settle = async (max = 90) => {
  for (let i = 0; i < max; i++) {
    await frames(10, 16);
    const s = await ev(() => ({ busy: VR.game.pool.busy, pend: VR.game.world.pending.size }));
    if (s.busy === 0 && s.pend === 0 && i > 3) break;
    await wait(80);
  }
};
const shot = async (name) => {
  await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; });
  await page.screenshot({ path: `/home/claude/vr/test/shots/trailer_${name}_${TAG}.png`, timeout: 180000 });
  console.log('shot', name);
};
// the camera: feet at pos, eyes 1.62 above; yaw 0 looks toward −z (the models face −z)
const setCam = (pos, tgt) => ev(([pos, tgt]) => {
  const p = VR.game.player; p.teleport(pos[0], pos[1], pos[2]); p.flying = true; p.vel = [0, 0, 0];
  const dx = tgt[0] - pos[0], dy = tgt[1] - pos[1] - 1.62, dz = tgt[2] - pos[2];
  p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz));
}, [pos, tgt]);
const setTod = (t) => ev((t) => VR.game.env.setTime(t), t);
// how many villagers stand in the camera's cone and within the folk distance (the crowd the picture shows)
const inView = () => ev(() => {
  const g = VR.game, p = g.player, V = g.villages, FD = g.folkDist || g.folkBase || 100;
  const f = [-Math.sin(p.yaw), -Math.cos(p.yaw)];
  let n = 0, near = 0, all = 0;
  for (const a of (V && V.agents) || []) {
    all++;
    const dx = a.pos[0] - p.pos[0], dz = a.pos[2] - p.pos[2], d = Math.hypot(dx, dz);
    if (d > FD || d < 0.5) continue;
    if ((dx * f[0] + dz * f[1]) / d > Math.cos(0.9)) { n++; if (d < 40) near++; }
  }
  return { villagers: all, inView: n, nearInView: near, folkDist: FD };
});
const crewInView = () => ev(() => {
  const C = VR.Crowd; if (!C || !C.heroes) return 0;
  const p = VR.game.player, f = [-Math.sin(p.yaw), -Math.cos(p.yaw)];
  let n = 0;
  for (const h of C.heroes) { const dx = h.pos[0] - p.pos[0], dz = h.pos[2] - p.pos[2], d = Math.hypot(dx, dz); if (d > 0.5 && (dx * f[0] + dz * f[1]) / d > Math.cos(0.9)) n++; }
  return n;
});
// the crew: the two suits of the trailer, blasters in hand, at the given places (the Gate Temple places them the same way)
const crew = async (list) => {
  if (TAG === 'base') return 0;
  return ev((list) => {
    const C = VR.Crowd; if (!C) return -1;
    C.clear();
    for (const c of list) C.addHero(c);
    return C.heroes.length;
  }, list);
};
const timed = (n) => ev((n) => { const g = VR.game; window.__norender = false; const t0 = performance.now(); for (let i = 0; i < n; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); const ms = (performance.now() - t0) / n; window.__norender = true; return ms; }, n);

// ---------------------------------------------------------------- the Gate Temple's hall (the console row, t2_14)
await setTod(DUSK);
await setCam([0, 81, 15], [0, 82.5, -10]);
await settle();
await frames(20);
const hallCrew = await crew([
  { id: 'blau', suit: 0, pos: [-5, 81, 0], yaw: Math.PI, act: 'hold' },
  { id: 'orange', suit: 6, pos: [5, 81, 0], yaw: Math.PI, act: 'hold' },
]);
await frames(30);
await shot('hall');
metric({ scene: 'hall', crewPlaced: hallCrew, crewInView: await crewInView(), ...(await inView()) });

// ---------------------------------------------------------------- the corridor's exit toward the city (t1_21)
await setCam([0, 81, -24], [0, 82.5, -70]);
await settle();
const exitCrew = await crew([
  { id: 'blau', suit: 0, pos: [-1.6, 81, -46], yaw: Math.PI, act: 'hold' },
  { id: 'orange', suit: 6, pos: [1.6, 81, -46], yaw: Math.PI, act: 'hold' },
]);
await frames(30);
await shot('exit');
metric({ scene: 'exit', crewPlaced: exitCrew, crewInView: await crewInView(), ...(await inView()) });

// ---------------------------------------------------------------- walking out toward the camera (t2_20)
await setCam([0, 81, -34], [0, 82.5, -62]);
const walkCrew = await crew([
  { id: 'blau', suit: 0, pos: [-1.6, 81, -50], yaw: Math.PI, act: 'walk', walk: { to: [-1.6, 81, -36], speed: 1.9 } },
  { id: 'orange', suit: 6, pos: [1.6, 81, -50], yaw: Math.PI, act: 'walk', walk: { to: [1.6, 81, -36], speed: 1.9 } },
]);
await frames(70);
await shot('walkout');
metric({ scene: 'walkout', crewPlaced: walkCrew, crewInView: await crewInView(), ...(await inView()) });

// ---------------------------------------------------------------- the Palm City at dusk (t2_23, t3_05)
await setCam([0, 84, -118], [0, 80, -140]);
await settle(120);
const plaza = await ev(() => {
  const V = VR.game.villages; let best = null, bd = 1e9;
  for (const v of V.known.values()) { const pz = v.plan && v.plan.plaza; if (!pz) continue; const d = Math.hypot(pz.x, pz.z + 140); if (d < bd) { bd = d; best = pz; } }
  return best ? [best.x, best.y, best.z] : null;
});
console.log('plaza', JSON.stringify(plaza));
check(!!plaza, 'the Palm City plaza is known (the city is generated at the Heartland centre)');
if (plaza) {
  await setCam([plaza[0] + 11, plaza[1] + 2, plaza[2] + 11], [plaza[0], plaza[1] + 1.2, plaza[2]]);
  await settle(60);
  const streetCrew = await crew([]);
  await frames(60);
  await shot('street');
  metric({ scene: 'street', tod: DUSK, ...(await inView()) });
  await setCam([plaza[0] - 26, plaza[1] + 16, plaza[2] + 24], [plaza[0], plaza[1], plaza[2]]);
  await frames(40);
  await shot('dusk');
  metric({ scene: 'dusk', tod: DUSK, ...(await inView()) });
}

// ---------------------------------------------------------------- Very Low: the cost of a frame and of the crowd
// The street's view, first without the crew (the base has none: this is the comparison), then with the two heroes
// placed in view (the worst case: both drawn and posed). The crowd update is timed with the two heroes.
if (plaza) await setCam([plaza[0] + 11, plaza[1] + 2, plaza[2] + 11], [plaza[0], plaza[1] + 1.2, plaza[2]]);
await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
await settle(60);
await crew([]);
metric({ scene: 'verylow_people', preset: 'potato', ...(await inView()) });
await timed(4);
const vlMs = await timed(8);
metric({ scene: 'verylow_frame', ms: +vlMs.toFixed(1), preset: 'potato', heroes: 0 });
if (TAG !== 'base' && plaza) {
  await crew([
    { id: 'blau', suit: 0, pos: [plaza[0] - 1.6, plaza[1], plaza[2]], yaw: Math.PI, act: 'hold' },
    { id: 'orange', suit: 6, pos: [plaza[0] + 1.6, plaza[1], plaza[2]], yaw: Math.PI, act: 'hold' },
  ]);
  await timed(4);
  const vlHeroMs = await timed(8);
  metric({ scene: 'verylow_frame_heroes', ms: +vlHeroMs.toFixed(1), preset: 'potato', heroes: 2 });
  const crowdMs = await ev(() => { const C = VR.Crowd; if (!C || !C.update) return -1; const t0 = performance.now(); for (let i = 0; i < 200; i++) C.update(1 / 30); return (performance.now() - t0) / 200; });
  metric({ scene: 'verylow_crowd_update', ms: +crowdMs.toFixed(3), preset: 'potato', heroes: 2 });
}
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.applySettings('*'); });

console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 25)) console.log(l);
if (TAG !== 'base') {
  check(logs.length === 0, 'no console errors or page errors');
  check(hallCrew === 2 && exitCrew === 2 && walkCrew === 2, 'the crew stands where the frames put it (two heroes each time)');
  check(await ev(() => !!VR.Crowd && VR.Crowd.heroes.every(h => h.look && h.look.helm && h.look.tool === 'blaster')), 'both heroes wear a helmeted suit with a blaster');
  check(await ev(() => VR.Folk.HERO_SUITS[0].name === 'Blau' && VR.Folk.HERO_SUITS[6].name === 'Orange'), 'the presets Blau and Orange are the first and seventh suits');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);
