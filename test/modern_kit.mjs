// v0.30 modern building set: Vollton colours (matte, gloss, slabs, stairs), panorama glass with connected frames,
// and the nine modern doors (closed / open, both hinges) — built in the flat kit world and photographed.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
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
const missing = await ev(() => VR.game && VR.game.texMissing ? VR.game.texMissing : null);
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.horizon = 1; g.settings.renderDist = 6; g.applySettings('*'); }, process.env.PRESET || 'high');
await ev(`VR.game.createWorld({name:'Modern',mode:'creative',difficulty:'peaceful',type:'flat',seed:'11',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; g.env.setTime(6000); });
await settle(60);
const base = await ev(() => {
  const g = VR.game, w = g.world, p = g.player, R = VR.R;
  const st = (n, pr) => { const t = R.byName[n]; if (!t) throw new Error('no block ' + n); return pr ? t.state(Object.assign({}, t.decode(t.defaultState), pr)) : t.defaultState; };
  const ox = Math.floor(p.pos[0]) + 6, oz = Math.floor(p.pos[2]) - 14, y0 = Math.floor(p.pos[1]);
  const list = [];
  const put = (x, y, z, s) => list.push([ox + x, y0 + y, oz + z, s]);
  // ---- wall A (z = 0, facing the camera at +z): white Vollton with panorama windows of every style
  const W = st('vollton_white');
  for (let x = 0; x < 34; x++) for (let y = 0; y < 7; y++) put(x, y, 0, W);
  const win = (x0, y0w, w_, h_, n) => { for (let x = x0; x < x0 + w_; x++) for (let y = y0w; y < y0w + h_; y++) put(x, y, 0, st(n)); };
  win(1, 1, 3, 2, 'panorama_black'); win(5, 1, 2, 4, 'panorama_grid'); win(8, 2, 1, 1, 'panorama_white'); win(10, 1, 2, 2, 'panorama_frosted');
  win(13, 2, 3, 1, 'panorama_tinted'); win(17, 1, 2, 3, 'panorama_bronze'); win(20, 1, 3, 3, 'panorama_anthracite');
  // an L-shaped black window (inner corner)
  win(24, 1, 3, 1, 'panorama_black'); win(24, 2, 1, 2, 'panorama_black');
  // ---- doors along the same wall (x = 28..33 region gets a second row further right), and a door wall B
  const DOORS = VR.MODERN_DOORS.map(d => d.id);
  // wall B (z = 6): anthracite with nine doors: closed-left, open-left, closed-right, open-right …
  const A = st('vollton_stone_grey');
  for (let x = 0; x < 28; x++) for (let y = 0; y < 3; y++) put(x, y, 16, A);
  DOORS.forEach((id, k) => {
    const x = 1 + k * 3, open = k % 2, hinge = (k >> 1) % 2;
    put(x, 0, 16, st(id, { facing: 0, half: 0, open, hinge })); put(x, 1, 16, st(id, { facing: 0, half: 1, open, hinge }));
  });
  // ---- the palette: 40 columns (matte below, gloss above), slabs and stairs in front
  VR.VOLLTON.forEach(([id], k) => {
    const x = k % 20, z = 30 + (k >= 20 ? 4 : 0);
    put(x, 0, z, st('vollton_' + id)); put(x, 1, z, st('vollton_' + id)); put(x, 2, z, st('vollton_' + id + '_gloss')); put(x, 3, z, st('vollton_' + id + '_gloss'));
    put(x, 0, z + 1, st('vollton_' + id + '_slab')); put(x, 0, z + 2, st('vollton_' + id + '_stairs', { facing: 0 }));
  });
  w.bulkSet(list, false);
  return [ox, y0, oz];
});
const [ox, y0, oz] = base;
await settle(80);
const look = async (name, pos, yaw, pitch) => { await ev(([pos, yaw, pitch]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(pos[0], pos[1], pos[2]); p.yaw = yaw; p.pitch = pitch; }, [pos, yaw, pitch]); await settle(30); await step(6); await shot(name); };
// yaw 0 looks toward −z in this game
await look('mk_1_windows', [ox + 14, y0 + 3.2, oz + 13], 0, -0.06);
await look('mk_2_windows_close', [ox + 5, y0 + 2.6, oz + 4.5], 0.25, -0.08);
await look('mk_3_doors_a', [ox + 6, y0 + 1.6, oz + 21.5], 0, -0.04);
await look('mk_4_doors_b', [ox + 15, y0 + 1.6, oz + 21.5], 0, -0.04);
await look('mk_4_doors_c', [ox + 24, y0 + 1.6, oz + 21.5], 0, -0.04);
await look('mk_4_doors_side', [ox + 12.5, y0 + 1.7, oz + 18.6], 0.85, -0.1);
await look('mk_5_palette', [ox + 10, y0 + 5, oz + 46], 0, -0.3);
// interaction: open / close a door like the player does (both halves follow)
const inter = await ev(([ox, y0, oz]) => {
  const g = VR.game, w = g.world, R = VR.R;
  const x = ox + 1, y = y0, z = oz + 16, s0 = w.getBlock(x, y, z), t = R.types[R.T.type[s0]];
  const before = [t.get(w.getBlock(x, y, z), 'open'), t.get(w.getBlock(x, y + 1, z), 'open')];
  g.interactBlock(x, y + 1, z, w.getBlock(x, y + 1, z), g.player);
  const after = [t.get(w.getBlock(x, y, z), 'open'), t.get(w.getBlock(x, y + 1, z), 'open')];
  g.interactBlock(x, y, z, w.getBlock(x, y, z), g.player);
  const back = [t.get(w.getBlock(x, y, z), 'open'), t.get(w.getBlock(x, y + 1, z), 'open')];
  const icons = ['door_glass_black', 'panorama_grid', 'vollton_coral', 'vollton_coral_stairs'].map(id => { try { const c = g.icons && g.icons.get ? g.icons.get(id) : null; return id + ':' + (c ? 'ok' : 'none'); } catch (e) { return id + ':ERR ' + e.message; } });
  return { name: t.name, before, after, back, icons };
}, base);
console.log('door interaction', JSON.stringify(inter));
console.log('texture problems:', JSON.stringify(missing));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 10)) console.log(l);
await browser.close();
