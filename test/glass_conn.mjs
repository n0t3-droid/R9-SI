// Glass (v0.33.2): panes join each other, glass blocks and solid blocks (their shape); every glass block — window glass,
// plain and stained glass, panes — keeps its own frame again (the joined-up glass of v0.33 is gone), only the panorama
// glass joins its frames (as since v0.31); no glass is drawn as a recessed pane any more. Built in the flat kit world
// and photographed; collision boxes checked too.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const TAG = process.env.TAG || 'gc';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail|missing/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 16) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && i > 2) break; await wait(60); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 180000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.horizon = 1; g.settings.renderDist = 5; g.applySettings('*'); }, process.env.PRESET || 'high');
await ev(`VR.game.createWorld({name:'Glass',mode:'creative',difficulty:'peaceful',type:'flat',seed:'12',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; g.env.setTime(6000); });
await settle(60);
const base = await ev(() => {
  const g = VR.game, w = g.world, p = g.player, R = VR.R;
  const st = (n, pr) => { const t = R.byName[n]; if (!t) throw new Error('no block ' + n); return pr ? t.state(Object.assign({}, t.decode(t.defaultState), pr)) : t.defaultState; };
  const ox = Math.floor(p.pos[0]) + 4, oz = Math.floor(p.pos[2]) - 14, y0 = Math.floor(p.pos[1]);
  const list = [];
  const put = (x, y, z, s) => list.push([ox + x, y0 + y, oz + z, typeof s === 'string' ? st(s) : s]);
  // clear the area first (the kit world has things standing around)
  for (let x = -2; x < 40; x++) for (let z = -4; z < 26; z++) for (let y = 0; y < 8; y++) put(x, y, z, 0);
  // ---- row A (z = 0): panes between solid blocks, a corner and a T, panes against glass / window glass / panorama / slabs
  const W = 'vollton_white';
  put(0, 0, 0, W); put(0, 1, 0, W);
  for (let x = 1; x <= 4; x++) { put(x, 0, 0, 'glass_pane'); put(x, 1, 0, 'glass_pane'); }
  put(5, 0, 0, W); put(5, 1, 0, W);
  // corner + T
  for (let x = 7; x <= 9; x++) put(x, 0, 0, 'glass_pane'); put(9, 0, 1, 'glass_pane'); put(9, 0, 2, 'glass_pane'); put(8, 0, -1, 'glass_pane');
  // pane against glass blocks of every kind (the block on the left, the pane on its right)
  const G = ['glass', 'window_black', 'window_white', 'frosted_glass', 'panorama_black', 'light_blue_stained_glass', 'oak_slab', 'oak_stairs', 'stone_bricks'];
  G.forEach((n, k) => { const x = 12 + k * 3; put(x, 0, 0, n); put(x + 1, 0, 0, 'glass_pane'); put(x + 1, 1, 0, 'light_blue_stained_glass_pane'); put(x, 1, 0, n); });
  // iron bars and the glass balustrade between posts
  put(0, 0, 4, W); for (let x = 1; x <= 3; x++) put(x, 0, 4, 'iron_bars'); put(4, 0, 4, W);
  put(6, 0, 4, W); for (let x = 7; x <= 9; x++) put(x, 0, 4, 'glass_rail'); put(10, 0, 4, 'glass');
  // ---- wall B (z = 12): window glass in a white wall — one frame per window, not one per block
  for (let x = 0; x < 34; x++) for (let y = 0; y < 6; y++) put(x, y, 12, W);
  const win = (x0, yy, w_, h_, n) => { for (let x = x0; x < x0 + w_; x++) for (let y = yy; y < yy + h_; y++) put(x, y, 12, n); };
  win(1, 1, 3, 2, 'window_black'); win(5, 1, 2, 3, 'window_white'); win(8, 1, 2, 2, 'frosted_glass'); win(11, 1, 3, 2, 'window_warm');
  // window glass next to the panorama glass of the same style: one window
  win(15, 1, 2, 3, 'window_black'); win(17, 1, 2, 3, 'panorama_black');
  // two different styles side by side keep their own frames
  win(20, 1, 2, 2, 'window_black'); win(22, 1, 2, 2, 'window_white');
  // a free-standing glass block cube of window glass (outside a wall) and plain glass
  for (let x = 26; x < 28; x++) for (let y = 0; y < 2; y++) for (let z = 18; z < 20; z++) put(x, y, z, 'window_black');
  for (let x = 29; x < 31; x++) for (let y = 0; y < 2; y++) for (let z = 18; z < 20; z++) put(x, y, z, 'glass');
  w.bulkSet(list, false);
  return [ox, y0, oz];
});
const [ox, y0, oz] = base;
await settle(80);
const look = async (name, pos, yaw, pitch) => { await ev(([pos, yaw, pitch]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(pos[0], pos[1], pos[2]); p.yaw = yaw; p.pitch = pitch; }, [pos, yaw, pitch]); await settle(30); await step(6); await shot(TAG + '_' + name); };
// yaw 0 looks toward −z in this game
await look('1_panes', [ox + 5, y0 + 2.4, oz + 6], 0, -0.3);
await look('2_against', [ox + 22, y0 + 2.6, oz + 6.5], 0, -0.3);
await look('3_against_far', [ox + 33, y0 + 2.6, oz + 6.5], 0, -0.3);
await look('4_bars', [ox + 5, y0 + 2.2, oz + 9], 0, -0.25);
await look('5_windows', [ox + 9, y0 + 3, oz + 20], 0, -0.08);
await look('6_windows_b', [ox + 22, y0 + 3, oz + 20], 0, -0.08);
await look('7_cubes', [ox + 28.5, y0 + 3, oz + 25], 0, -0.25);
// collision: a pane between two panes and a pane next to glass get arms (physics uses the same rule as the mesher)
const col = await ev(([ox, y0, oz]) => {
  const g = VR.game, w = g.world, PH = VR.PHYS, R = VR.R;
  const boxesAt = (x, y, z) => { const s = w.getBlock(x, y, z); const nb = (d) => { const DX = [0, 1, 0, -1], DZ = [-1, 0, 1, 0]; return w.getBlock(x + DX[d], y, z + DZ[d]); }; return PH.collision(s, nb).length; };
  return { midPane: boxesAt(ox + 2, y0, oz), paneNextToGlass: boxesAt(ox + 13, y0, oz), paneNextToWindow: boxesAt(ox + 16, y0, oz) };
}, base);
console.log('collision', JSON.stringify(col));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 10)) console.log(l);
await browser.close();
