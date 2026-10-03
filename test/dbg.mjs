import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const logs = [];
page.on('console', m => { logs.push(`[${m.type()}] ${m.text().slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.renderDist = 5; g.applySettings('renderDist'); });
await ev(`VR.game.createWorld({name:'Ship',mode:'creative',difficulty:'normal',type:'default',seed:'424242',cheats:true,kit:true})`);
for (let i = 0; i < 40; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
console.log('play');
await ev(() => { const g = VR.game; g.settings.dynRes = false; const p = g.player; p.teleport(168.5, 109, -242.5); p.flying = true; p.yaw = 0; p.pitch = -0.35; });
for (let k = 0; k < 40; k++) {
  const t = await ev(() => { const g = VR.game; const t0 = performance.now(); const prof = {}; const wrap = (o, n, label) => { const f = o[n]; o[n] = function (...a) { const s = performance.now(); try { return f.apply(this, a); } finally { prof[label] = (prof[label] || 0) + performance.now() - s; o[n] = f; } }; };
    wrap(g, 'playFrame', 'playFrame'); wrap(g.gadgets, 'tick', 'gad.tick'); wrap(g.map, 'update', 'map'); wrap(g.world, 'update', 'world'); wrap(g.renderer, 'render', 'render'); wrap(g.entities, 'update', 'ents'); wrap(g.codex, 'update', 'codex'); wrap(g.renderer, 'resize', 'resize'); wrap(g.gadgets, 'outlines', 'outl'); wrap(g, 'saveMeta', 'saveMeta'); wrap(g.world, 'saveAll', 'saveAll'); wrap(g.world, 'getLight', 'getLight'); wrap(g, 'debugText', 'dbg'); wrap(g.gadgets, 'vehicleCam', 'vcam'); wrap(VR.PHYS, 'raycast', 'ray'); wrap(g.sim, 'update', 'sim'); wrap(g.player, 'update', 'player'); wrap(g.particles, 'update', 'parts'); wrap(g.ui, 'updateHUD', 'hud'); wrap(g, 'envFor', 'env'); wrap(g.audio, 'updateMusic', 'music'); wrap(g.gadgets, 'preUpdate', 'pre'); wrap(g, 'handleKeys', 'keys'); wrap(g.entities, 'playerAttack', 'atk'); if (g.tickFurnaces) wrap(g, 'tickFurnaces', 'furn');
    g.last = performance.now() - 33; g.loop(performance.now()); return JSON.stringify({ total: (performance.now() - t0).toFixed(1), prof }); });
  const tt = JSON.parse(t); if (+tt.total > 50) console.log(k, t); else if (k % 10 === 0) console.log(k, 'ok', tt.total);
  await wait(300);
}
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
