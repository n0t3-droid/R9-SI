// Klassisch v2 frame cost on the potato preset: the same grass scene rendered from two builds (DIST_A, DIST_B: paths
// of dist/index.html, e.g. the v0.39 baseline and this branch), interleaved A B A B … so the machine's load drifts
// over both alike. SwiftShader rasterises on the CPU, so the per-frame time with gl.finish() includes the fragment
// work — a relative measure of the shader and texture changes, not a GPU number. N=40 frames per pass, PASSES=3.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const A = process.env.DIST_A, B = process.env.DIST_B;
if (!A || !B) { console.log('usage: DIST_A=<index.html> DIST_B=<index.html> node cl2_perf.mjs'); process.exit(2); }
const N = +(process.env.N || 40), PASSES = +(process.env.PASSES || 3);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
async function open(dist) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', e => console.log('[pageerror]', (e.stack || e.message).slice(0, 300)));
  await page.goto('file://' + dist);
  const ev = (fn, arg) => page.evaluate(fn, arg), wait = (ms) => page.waitForTimeout(ms);
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.settings.horizon = 1; g.settings.renderDist = 4; g.settings.look = 'classic'; g.applySettings('*'); });
  await ev(`VR.game.createWorld({name:'Perf v2',mode:'creative',difficulty:'peaceful',type:'flat',seed:'31',cheats:true,kit:true})`);
  for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  await ev(() => {
    const g = VR.game, w = g.world, p = g.player, R = VR.R; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.env.setTime(5200);
    const st = (n) => R.byName[n].defaultState;
    const ox = Math.floor(p.pos[0]), oz = Math.floor(p.pos[2]) - 40, y0 = Math.floor(p.pos[1]) - 1, list = [];
    const G = st('grass_block'), D = st('dirt'), S = st('stone'), L = st('oak_log'), LV = st('oak_leaves');
    for (let z = 0; z < 44; z++) for (let x = -20; x < 30; x++) { const h = Math.round(6 * Math.exp(-((x - 10) ** 2 + (z - 22) ** 2) / 90)); for (let y = 0; y <= h; y++) list.push([ox + x, y0 + y, oz + z, y < h ? (y < h - 2 ? S : D) : G]); }
    for (let k = 0; k < 6; k++) { const x = -12 + k * 5, z = 6 + (k * 7) % 20; for (let y = 1; y <= 5; y++) list.push([ox + x, y0 + y, oz + z, L]); for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 4; dy <= 6; dy++) if (dx || dz || dy > 5) list.push([ox + x + dx, y0 + dy, oz + z + dz, LV]); }
    w.bulkSet(list, false);
    p.flying = true; p.noclip = true; p.teleport(ox + 4, y0 + 1 + 3.4, oz + 52); p.yaw = 0; p.pitch = -0.45;
  });
  for (let i = 0; i < 40; i++) { await ev(() => { const g = VR.game; for (let k = 0; k < 10; k++) { g.last = performance.now() - 16; g.loop(performance.now()); } }); const s = await ev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return g.pool.busy + g.world.pending.size + dirty; }); if (!s && i > 3) break; await wait(100); }
  const measure = () => ev((n) => { const g = VR.game, gl = g.renderer.gl; g.last = performance.now() - 16; g.loop(performance.now()); gl.finish(); const t0 = performance.now(); for (let i = 0; i < n; i++) { g.last = performance.now() - 16; g.loop(performance.now()); gl.finish(); } return { ms: +((performance.now() - t0) / n).toFixed(2), look: VR.LOOK.mode, vary: VR.LOOK.vary, lite: g.renderer.q.lite, w: g.renderer.w, h: g.renderer.h, draws: g.renderer.stats.draws, tris: g.renderer.stats.tris }; }, N);
  return { page, measure };
}
const pa = await open(A), pb = await open(B);
const res = { A: [], B: [] };
for (let p = 0; p < PASSES; p++) { const a = await pa.measure(); const b = await pb.measure(); res.A.push(a.ms); res.B.push(b.ms); console.log(`pass ${p + 1}: A ${a.ms} ms  B ${b.ms} ms   (A ${JSON.stringify(a)})  (B ${JSON.stringify(b)})`); }
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
console.log(`A median ${med(res.A)} ms · B median ${med(res.B)} ms · B − A = ${(med(res.B) - med(res.A)).toFixed(2)} ms per frame (${N} frames × ${PASSES} passes, potato preset, ${A === B ? 'same build' : 'two builds'})`);
await browser.close();
