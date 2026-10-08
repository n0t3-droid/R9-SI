// F2 · Texturen & Materialien (browser). A material gallery wall — one block of each family (stone, wood, fabric,
// metal, plaster, glass) in two rows — on a stone patch, shot from 3 blocks and from 30 blocks, dry and in rain, on the
// Very Low (potato) and the High preset: test/shots/materials_<preset>_<near|far>_<dry|rain>.png. In the rain the
// puddles fill in the hollows of the stone patch (the wet look is on the presets that have wetGround).
// Checks: the page throws nothing and the shaders compile; the puddles fill in the rain and dry afterwards (the env's
// time constants); the tiers change the picture. Costs: the median wall time of a frame (gl.finish, 12 frames after 3
// warm-ups) for the same view at each tier, printed as MEASURE lines (SwiftShader: relative numbers only).
// DIST=file:///… loads another build (the baseline of the plan); MEASURE=0 skips the timings.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const DIST = process.env.DIST || 'file:///home/claude/vr/dist/index.html';
const MEASURE = process.env.MEASURE !== '0';
const TAG = process.env.TAG || 'materials';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /shader|compile|link|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 900)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto(DIST);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
// the game steps without drawing (__norender) — the simulated time passes, the GL work does not
const step = async (n, dtms = 33) => { await ev(([n, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < n; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [n, dtms]); };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size }; }); if (s.busy === 0 && s.pend === 0 && i > 2) break; await wait(60); } };
const shot = async (name, frames = 3) => { await ev((frames) => { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, frames); await page.screenshot({ path: `/home/claude/vr/test/shots/${TAG}_${name}.png`, timeout: 180000 }); console.log('shot', name); };
const look = async (pos, yaw, pitch) => ev(([pos, yaw, pitch]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(pos[0], pos[1], pos[2]); p.yaw = yaw; p.pitch = pitch; p.fovKick = 0; }, [pos, yaw, pitch]);
// the median wall time of a frame (the GL work finished) for the current view, 12 frames after 3 warm-ups
const frameMs = () => ev(() => { const g = VR.game, gl = g.renderer.gl, t = []; window.__norender = false; for (let i = 0; i < 15; i++) { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); if (i >= 3) t.push(performance.now() - t0); } window.__norender = true; t.sort((a, b) => a - b); return t[t.length >> 1]; });
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.horizon = 1; g.settings.renderDist = 6; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Materials',mode:'creative',difficulty:'peaceful',type:'flat',seed:'31',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; g.env.setTime(6000); });

// the gallery: a stone patch (puddles collect on its top), a wall of six blocks two high, one block of each family
const base = await ev(() => {
  const g = VR.game, w = g.world, p = g.player, R = VR.R;
  const st = (n) => { const t = R.byName[n]; if (!t) throw new Error('no block ' + n); return t.defaultState; };
  const ox = Math.floor(p.pos[0]) + 4, oz = Math.floor(p.pos[2]) - 30, y0 = Math.floor(p.pos[1]) - 1;
  const list = [], put = (x, y, z, s) => list.push([ox + x, y0 + y, oz + z, typeof s === 'string' ? st(s) : s]);
  for (let x = -6; x < 14; x++) for (let z = -4; z < 14; z++) for (let y = -1; y <= 0; y++) put(x, y, z, 'stone');
  const wall = ['stone', 'oak_planks', 'red_wool', 'iron_block', 'stucco_white', 'glass'];
  for (let i = 0; i < wall.length; i++) for (let y = 1; y <= 2; y++) put(i, y, 0, wall[i]);
  for (let x = -6; x < 14; x++) for (let y = 1; y <= 4; y++) if (x < 0 || x > 6) put(x, y, -4, 'stone');
  w.bulkSet(list, false);
  return [ox, y0, oz];
});
const [ox, y0, oz] = base;
await settle(60);
const NEAR = [ox + 2.5, y0 + 2.4, oz + 3], FAR = [ox + 2.5, y0 + 3.5, oz + 30];
const views = { near: [NEAR, 0, -0.2], far: [FAR, 0, -0.12] };

// the tiers: Very Low (potato, tier 0) and High (tier 3); the rain in the same scene
const run = async (preset, wx) => {
  await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.horizon = 1; g.settings.renderDist = 6; g.applySettings('*'); }, preset);
  await settle(40);
  for (const v of ['near', 'far']) { await look(views[v][0], views[v][1], views[v][2]); await settle(10); await shot(`${preset}_${wx}_${v}`); }
  console.log(`preset ${preset} ${wx} (matTier ${await ev(() => VR.game.renderer.q.matTier)})`);
};
await run('potato', 'dry');
await run('high', 'dry');
// the rain: the weather forced to rain; the puddles fill in ~30 s, so the simulated time runs first (no drawing)
await ev(() => VR.game.env.wx.force('regen'));
await step(900, 100);
const pud = await ev(() => ({ puddle: VR.game.env.puddle, rain: VR.game.env.rain, wet: VR.game.env.E.wet, puddleE: VR.game.env.E.puddle }));
check(pud.rain > 0.5 && pud.puddle > 0.5, `puddles fill in the rain (puddle ${pud.puddle.toFixed(2)}, rain ${pud.rain.toFixed(2)})`);
await run('potato', 'rain');
await run('high', 'rain');
// the drying: the rain stops; after four minutes the puddles are at about 1/e of their fill (4-minute time constant)
await ev(() => VR.game.env.wx.force('klar'));
await step(60 * 4 * 10, 100);
const dry = await ev(() => ({ puddle: VR.game.env.puddle, rain: VR.game.env.rain }));
check(dry.puddle > 0.2 && dry.puddle < 0.5, `puddles dry over minutes (after 4 min: ${dry.puddle.toFixed(2)}, the fill was ${pud.puddle.toFixed(2)})`);

// the costs: the same near view at each tier (matTier forced), median frame wall time in ms
if (MEASURE) {
  const cost = async (label, preset, tier, rainOn) => {
    await ev(([p, t]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.horizon = 1; g.settings.renderDist = 6; g.applySettings('*'); g.renderer.setQuality({ matTier: t }); }, [preset, tier]);
    await ev((r) => VR.game.env.wx.force(r ? 'regen' : 'klar'), rainOn);
    await step(120, 100);
    await look(views.near[0], views.near[1], views.near[2]);
    await settle(10);
    const ms = await frameMs();
    const st = await ev(() => ({ draws: VR.game.renderer.stats.draws, tris: VR.game.renderer.stats.tris }));
    console.log(`MEASURE ${label} frame ${ms.toFixed(1)} ms · draws ${st.draws} · tris ${Math.round(st.tris)}`);
  };
  await cost('potato tier0 dry near', 'potato', 0, false);
  await cost('potato tier1 dry near (forced)', 'potato', 1, false);
  await cost('high tier0 dry near (forced)', 'high', 0, false);
  await cost('high tier3 dry near', 'high', 3, false);
  await cost('potato tier0 rain near', 'potato', 0, true);
  await cost('high tier3 rain near', 'high', 3, true);
}

check(logs.length === 0, 'no page errors and no shader messages' + (logs.length ? ': ' + logs.slice(0, 4).join(' | ') : ''));
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);
