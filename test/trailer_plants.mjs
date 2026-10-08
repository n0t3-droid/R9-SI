// the trailer's vegetation as the street sees it (docs/trailer/frames, the palm city of seed 4242): four pictures from the
// places the frames were taken from, each taken twice in one run, the town of vgen 6 (before: the houses with the old palm
// trees of the yards and the avenue) and the town of vgen 7 (after: the shared palm crowns, the round trees, the tufts,
// the flowers and the blossom bushes), at the same camera place and the same look point, dusk, preset balanced, render
// distance 12. PHASES=before,after (the default) names the pictures trailer_<frame>_plants_<before|after>.png; VGEN_BEFORE
// and VGEN_AFTER change the two towns. Every shot is also counted: the plant blocks within 34 blocks of the camera.
//   nohup bash test/wt_run.sh trailer_plants.mjs 3600 > .tmp_tests/trailer_plants.log 2>&1 &
// The shots (the frame each one stands for, what it is meant to show):
//   t2_20  the palm avenue from the street: the camera between the palms, the palms on both sides
//   t3_05  a villa garden: a palm in the back corner of a lot, the flowers and the lawn
//   t3_06  a palm road: the camera between two palms, the palms ahead and behind, the hills beyond the town
//   t3_08  the hills above the town: the avenue's palms from a hill (the terraces of the frame are not in v042: a gap)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'fs';
const PHASES = (process.env.PHASES || 'before,after').split(',').map(s => s.trim()).filter(Boolean);
const VGEN = { before: +(process.env.VGEN_BEFORE || 6), after: +(process.env.VGEN_AFTER || 7) };
const W = +(process.env.W || 1296), H = +(process.env.H || 704);
const SEED = process.env.SEED || '4242';
const PRESET = process.env.PRESET || 'balanced';
const DUSK = +(process.env.DUSK || 12500);
const OUT = '/home/claude/vr/test/shots';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  x ' + msg); } else console.log('  ok ' + msg); };
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

// the shots: the camera place (the cell the camera stands in is air, its sight to the look point is clear: probed on the
// seed 4242 town) and the point it looks at
const SHOTS = [
  ['t2_20', 'palm avenue from the street: palms on both sides', [0.5, 83, -89.5], [0.5, 83, -135.5]],
  ['t3_05', 'villa garden: a palm and the flowers of the lawn', [-14.5, 83, -163.5], [-8.5, 85.5, -163.5]],
  ['t3_06', 'palm road: palms ahead and behind, hills beyond', [-51.5, 83, -169.5], [-28.5, 91.5, -159.5]],
  ['t3_08', 'hills above the town: the avenue palms, no terraces yet', [-39.5, 106, -211.5], [-2.5, 90.5, -93.5]],
];
const results = [];
for (const PHASE of PHASES) {
  const vgen = VGEN[PHASE];
  console.log('phase ' + PHASE + ' (vgen ' + vgen + ')');
  await page.goto('file:///home/claude/vr/dist/index.html');
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 12; g.settings.horizon = 2; g.applySettings('*'); }, PRESET);
  await ev(`VR.game.createWorld({name:'Trailer plants ${PHASE}',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',vgen:${vgen},cheats:true,kit:true})`);
  for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  await ev((t) => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; window.requestAnimationFrame = () => 0; const R = g.renderer; R._render = R.render; R.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; window.__norender = true; g.env.setTime(t); }, DUSK);
  for (const [frame, what, pos, tgt] of SHOTS) {
    const [yaw, pitch] = aim(pos, tgt);
    await ev(([p, yaw, pitch]) => { const g = VR.game, pl = g.player; pl.flying = true; pl.noclip = true; pl.teleport(p[0], p[1], p[2]); pl.yaw = yaw; pl.pitch = pitch; pl.fovKick = 0; const e = g.entities; if (e && e.mobs) e.mobs.length = 0; }, [pos, yaw, pitch]);
    const it = await settle();
    await step(6);
    const n = await census(pos);
    const name = `trailer_${frame}_plants_${PHASE}`;
    await shot(name);
    results.push({ phase: PHASE, frame, plants: n, settle: it });
    console.log(`  ${PHASE} ${frame}: ${what} · plant blocks within 34: ${n} · settle ${it}`);
  }
  const got = await ev(() => { const w = VR.game.world; return w && w.genOpts ? w.genOpts.vgen : (w && w.vgen) || null; });
  check(got === vgen, `the ${PHASE} town is vgen ${vgen} (the world says ${got})`);
}
check(results.length === PHASES.length * SHOTS.length, 'every shot of every phase is taken (' + results.length + ')');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
check(!logs.some(l => l.startsWith('[pageerror]')), 'no page errors');
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
await browser.close();
