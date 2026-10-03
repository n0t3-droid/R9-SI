// main-thread CPU profile of a play frame: where do the milliseconds go? (SwiftShader: GPU numbers are meaningless,
// but JS time per subsystem is representative)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 900)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(([p]) => { const g = VR.game; g.settings.preset = p; g.applyPreset ? g.applyPreset(p) : 0; g.settings.dynRes = false; g.applySettings('*'); }, [process.env.PRESET || 'low']);
await ev(() => VR.game.createWorld({ name: 'Perf', mode: 'survival', difficulty: 'normal', type: 'default', seed: '424242', cheats: true, kit: true }));
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { window.requestAnimationFrame = () => 0; });
const run = async (n, tod, label) => {
  return await ev(([n, tod]) => {
    const g = VR.game, T = {}, C = {};
    const wraps = [];
    const wrap = (obj, name, label) => { if (!obj || !obj[name]) return; const f = obj[name]; obj[name] = function (...a) { const t0 = performance.now(); const r = f.apply(this, a); T[label] = (T[label] || 0) + performance.now() - t0; C[label] = (C[label] || 0) + 1; return r; }; wraps.push(() => { obj[name] = f; }); };
    wrap(g.player, 'update', 'player'); wrap(g.sim, 'update', 'sim'); wrap(g.entities, 'update', 'entities'); wrap(g.villages, 'update', 'villages');
    wrap(g.gadgets, 'tick', 'gadgets'); wrap(g.starships, 'update', 'starships'); wrap(g.traffic, 'update', 'traffic'); wrap(g.world, 'update', 'world');
    wrap(g.env, 'update', 'env'); wrap(g.particles, 'update', 'particles'); wrap(g.horizon, 'update', 'horizon'); wrap(g.renderer, 'render', 'render');
    wrap(g.ui, 'updateHUD', 'hud'); wrap(g.map, 'update', 'map'); wrap(g.audio, 'updateMusic', 'music'); wrap(g.cockpit, 'updateHud', 'cockpitHud');
    wrap(g.entities, 'draw', 'draw.entities'); wrap(g.villages, 'draw', 'draw.villages'); wrap(g.starships, 'draw', 'draw.ships'); wrap(g.traffic, 'draw', 'draw.traffic');
    wrap(g.horizon, 'draw', 'draw.horizon'); wrap(g.particles, 'draw', 'draw.particles');
    if (tod !== undefined) g.env.setTime(tod);
    // count GL calls per frame (one rendered frame), then time the JS side with rendering stubbed out
    const gl = g.renderer.gl, GC = {}, saved = {};
    for (const k of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'uniform1f', 'uniform1i', 'uniform2f', 'uniform3f', 'uniform4f', 'uniform3fv', 'uniform4fv', 'uniformMatrix4fv', 'uniform3i', 'bindVertexArray', 'useProgram', 'bindTexture', 'bufferData', 'bufferSubData', 'texSubImage2D', 'texImage2D', 'bindFramebuffer', 'enable', 'disable', 'blendFunc', 'depthMask', 'multiDrawArraysWEBGL', 'multiDrawElementsWEBGL']) {
      if (!gl[k]) continue; saved[k] = gl[k]; const f = gl[k]; gl[k] = function (...a) { GC[k] = (GC[k] || 0) + 1; return f.apply(this, a); };
    }
    const md = g.renderer.md || g.renderer.multiDraw; 
    g.last = performance.now() - 16.7; g.loop(performance.now());
    for (const k in saved) gl[k] = saved[k];
    const r0 = g.renderer.render; g.renderer.render = function (F) { this.setupCamera(F.cam); };
    const t0 = performance.now();
    for (let i = 0; i < n; i++) { g.last = performance.now() - 16.7; g.loop(performance.now()); }
    g.renderer.render = r0;
    const total = performance.now() - t0;
    for (const u of wraps) u();
    const out = { frames: n, msPerFrame: +(total / n).toFixed(2) };
    for (const k of Object.keys(T).sort((a, b) => T[b] - T[a])) out[k] = +(T[k] / n).toFixed(2);
    out.gl = GC;
    out.agents = g.villages.agents.length; out.mobs = g.entities.mobs.length; out.particles = g.particles.count || (g.particles.list && g.particles.list.length);
    return out;
  }, [n, tod]);
};
await run(30, 4500); // warm-up (JIT, chunk loading)
for (let i = 0; i < 10; i++) { await ev(() => { for (let k = 0; k < 20; k++) { VR.game.last = performance.now() - 33; VR.game.loop(performance.now()); } }); await wait(300); }
console.log('day  ', JSON.stringify(await run(+(process.env.N || 40), 4500)));
console.log('night', JSON.stringify(await run(+(process.env.N || 40), 15000)));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 25)) console.log(l);
await browser.close();
