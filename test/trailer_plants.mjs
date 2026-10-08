// the trailer's vegetation (docs/trailer/frames t1_05, t1_11, t1_26, t2_20, t2_23, t3_05–t3_08): the game's pictures of
// the palm avenue, the palm close-up, the villa garden, the hills with villas and terraces, the temple plaza and the
// citadel's forest, framed from the same kind of places the frames were taken from. PHASE=before|after names the pictures.
//   nohup bash test/wt_run.sh trailer_plants.mjs 1800 > .tmp_tests/trailer_plants.log 2>&1 &
// Every shot is also counted: how many plant blocks (palms, hedges, bushes, trees, crops) stand within 34 blocks of the
// camera, so the pictures can be read against numbers.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'fs';
const PHASE = process.env.PHASE || 'before';
const W = +(process.env.W || 1296), H = +(process.env.H || 704);
const SEED = process.env.SEED || '4242';
const VGEN = +(process.env.VGEN || (PHASE === 'after' ? 7 : 5));   // before: the v041 town (vgen 5); after: the plants (vgen 7)
const DUSK = +(process.env.DUSK || 12500);
const OUT = '/home/claude/vr/test/shots';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  x ' + msg); } else console.log('  ok ' + msg); };

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 12; g.settings.horizon = 2; g.applySettings('*'); }, process.env.PRESET || 'high');
await ev(`VR.game.createWorld({name:'Trailer plants',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',vgen:${VGEN},cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev((t) => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; window.requestAnimationFrame = () => 0; const R = g.renderer; R._render = R.render; R.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; window.__norender = true; g.env.setTime(t); }, DUSK);
const step = async (n, dtms = 50) => { await ev(([m, d]) => { const g = VR.game; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [n, dtms]); };
const settle = async (max = 90) => {
  let quiet = 0;
  for (let i = 0; i < max; i++) {
    await step(3, 50); await wait(250);
    const s = await ev(() => { const g = VR.game; const b = g.pool.busy; return { p: g.world.pending ? g.world.pending.size : 0, b: typeof b === 'number' ? b : (b && b.size) || 0 }; });
    if (s.p === 0 && s.b === 0) { if (++quiet >= 3) return i; } else quiet = 0;
  }
  return max;
};
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `${OUT}/${name}.png`, timeout: 180000 }); console.log('shot', name); };
// the camera: yaw 0 looks along −z, pitch is up positive; aim() turns a camera place and a target into yaw and pitch
const aim = ([px, py, pz], [tx, ty, tz]) => { const dx = tx - px, dy = ty - py, dz = tz - pz; return [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))]; };
// the plant blocks near the camera (palms, hedges, bushes, trees, crops): a number to read beside the picture
const PLANT = /palm|hedge|bush|flowerbed|fern|crop|tree|oak|birch|cherry|short_grass|tuft|flower|leaves/;
const census = (pos) => ev(([p, re]) => {
  const g = VR.game, R = VR.R, rx = new RegExp(re), hit = new Uint8Array(R.stateCount + 1);
  for (const t of R.types) if (rx.test(t.name)) for (let s = t.base; s < t.base + t.nstates; s++) hit[s] = 1;
  let n = 0; const r = 34;
  for (let x = Math.floor(p[0] - r); x <= p[0] + r; x += 2) for (let z = Math.floor(p[2] - r); z <= p[2] + r; z += 2) for (let y = Math.floor(p[1] - 6); y <= p[1] + 10; y += 2) { const s = g.world.getBlock(x, y, z); if (s && hit[s]) n++; }
  return n;
}, [pos, PLANT.source]);

// the shots: the frame each one stands for, what it shows, the camera place and the point it looks at (dusk, seed 4242)
const SHOTS = [
  ['t2_20', 'palm avenue at dusk', [1, 84, -78], [1, 88, -130]],
  ['t1_26', 'palm close-up beside the stepped house', [-10, 84, -84], [-14, 92, -94]],
  ['t2_23', 'street with palms, bushes and villas', [30, 84, -132], [-6, 86, -160]],
  ['t3_05', 'villa garden with palms and flowers', [-58, 86, -186], [-52, 88, -160]],
  ['t3_06', 'palm road with the hills behind', [0, 84, -196], [0, 90, -260]],
  ['t3_07', 'palms over the lawn, villas on the hills', [26, 86, -200], [-10, 90, -240]],
  ['t3_08', 'terraced hills with villas and round trees', [0, 98, -250], [0, 92, -330]],
  ['t1_05', 'temple plaza: round trees, lawns, crystals', [-8, 83, 62], [0, 86, 0]],
  ['t1_11', 'spire cluster: forest on the mountain foot', [-330, 100, 300], [-420, 112, 380]],
];
const results = [];
for (const [frame, what, pos, tgt] of SHOTS) {
  const [yaw, pitch] = aim(pos, tgt);
  await ev(([p, yaw, pitch]) => { const g = VR.game, pl = g.player; pl.flying = true; pl.noclip = true; pl.teleport(p[0], p[1], p[2]); pl.yaw = yaw; pl.pitch = pitch; pl.fovKick = 0; const e = g.entities; if (e && e.mobs) e.mobs.length = 0; }, [pos, yaw, pitch]);
  const it = await settle();
  await step(6);
  const n = await census(pos);
  const name = `trailer_${frame}_plants_${PHASE}`;
  await shot(name);
  results.push({ frame, what, plants: n, settle: it });
  console.log(`  ${frame}: ${what} · plant blocks within 34: ${n} · settle ${it}`);
}
const vgen = await ev(() => { const w = VR.game.world; return w && w.genOpts ? w.genOpts.vgen : (w && w.vgen) || null; });
console.log('phase', PHASE, 'seed', SEED, 'vgen', vgen, 'shots', results.length);
check(results.length === SHOTS.length, 'every shot is taken');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
check(!logs.some(l => l.startsWith('[pageerror]')), 'no page errors');
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
await browser.close();
