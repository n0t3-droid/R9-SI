// Block look (v0.39): the same scene in "Klassisch" and "Nahtlos" — a grass hill, a stucco house with panorama glass
// and Vollton trim, a mini-voxel cottage (plaster, timber, stacked and side-by-side windows, a roof), tech panels,
// glass walls and plaza tiles. The look is switched live in between (re-mesh + texture rebuild), as a player would.
// In each look the player walks up the hill (terrace steps / slope) and digs a path with the shovel; the settings
// control is checked in German and English, the Studio follows the player's look.
// LOOKS=classic,seamless (default) · PRESET=high
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const TAG = process.env.TAG || 'bl';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });   // the Studio opens in the same context (same localStorage)
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail|missing/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 16) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && i > 2) break; await wait(60); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 180000 }); console.log('shot', name); };
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
const boot = await ev(() => ({ setting: VR.game.settings.look, look: VR.LOOK && VR.LOOK.mode, rim: VR.game.texRim }));
check(boot.setting === 'classic' && boot.look === 'classic' && boot.rim === true, 'a new player starts in Klassisch (setting, registry and textures): ' + JSON.stringify(boot));
// Settings → Graphics: the "Blöcke" control, in German and in English (English players never see German)
const ctl = await ev(() => {
  const u = VR.game.ui, I = VR.I18N, was = I ? I.lang : localStorage.getItem('r9si.lang'), out = {};
  const set = (lang) => { if (I) I.set(lang); else if (lang) localStorage.setItem('r9si.lang', lang); else localStorage.removeItem('r9si.lang'); };
  for (const lang of ['de', 'en']) { set(lang); u.settingsTab = 'graphics'; u.showSettings(); const bs = [...document.querySelectorAll('#setbody [data-look]')]; out[lang] = { lab: bs.length ? bs[0].closest('.field').querySelector('label').textContent : '', r: bs.map(b => b.textContent + (b.classList.contains('on') ? '*' : '')).join() }; }
  set(was); u.show('title'); return out;
});
check(ctl.de.lab === 'Blöcke' && ctl.de.r === 'Klassisch*,Nahtlos' && ctl.en.lab === 'Blocks' && ctl.en.r === 'Classic*,Seamless', 'Settings → Graphics shows "Blöcke: Klassisch / Nahtlos" (English: "Blocks: Classic / Seamless") with Klassisch on: ' + JSON.stringify(ctl));
const LOOKS = (process.env.LOOKS || 'classic,seamless').split(',');
await ev(([p, lk]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.horizon = 1; g.settings.renderDist = 6; g.settings.look = lk; g.applySettings('*'); }, [process.env.PRESET || 'high', LOOKS[0]]);
await ev(`VR.game.createWorld({name:'Blocks',mode:'creative',difficulty:'peaceful',type:'flat',seed:'31',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; g.env.setTime(5200); });
await settle(60);
const base = await ev(() => {
  const g = VR.game, w = g.world, p = g.player, R = VR.R;
  const st = (n, pr) => { const t = R.byName[n]; if (!t) throw new Error('no block ' + n); return pr ? t.state(Object.assign({}, t.decode(t.defaultState), pr)) : t.defaultState; };
  const ox = Math.floor(p.pos[0]) + 6, oz = Math.floor(p.pos[2]) - 40, y0 = Math.floor(p.pos[1]) - 1;
  const list = [], put = (x, y, z, s) => list.push([ox + x, y0 + y, oz + z, typeof s === 'string' ? st(s) : s]);
  for (let x = -4; x < 60; x++) for (let z = -4; z < 48; z++) for (let y = 1; y < 12; y++) put(x, y, z, 0);
  // the hill (as in terrain_edit / ridge_seam): a dome and a ridge, grass over dirt
  const G = st('grass_block'), D = st('dirt');
  for (let z = 0; z < 44; z++) for (let x = 0; x < 30; x++) { const h = Math.round(6 * Math.exp(-((x - 16) ** 2 + (z - 22) ** 2) / 90) + 2 * Math.exp(-((x - 6) ** 2) / 12)); for (let y = 0; y <= h; y++) put(x, y, z, y < h ? D : G); }
  // the stucco house: stucco walls, a Vollton band, panorama glass 3×2 and 2×2, a charcoal roof
  const HX = 34, HZ = 4;
  for (let x = 0; x < 9; x++) for (let z = 0; z < 7; z++) for (let y = 1; y <= 5; y++) {
    const wall = x === 0 || x === 8 || z === 0 || z === 6;
    if (y === 5) { put(HX + x, y, HZ + z, 'roof_charcoal'); continue; }
    if (!wall) continue;
    put(HX + x, y, HZ + z, y === 4 ? 'vollton_white' : 'stucco_white');
  }
  for (let x = 1; x <= 3; x++) for (let y = 2; y <= 3; y++) put(HX + x, y, HZ + 6, 'panorama_black');
  for (let x = 5; x <= 6; x++) for (let y = 2; y <= 3; y++) put(HX + x, y, HZ + 6, 'panorama_black');
  for (let z = 2; z <= 4; z++) for (let y = 2; y <= 3; y++) put(HX + 8, y, HZ + z, 'panorama_black');
  // a low wall of Vollton colours in front of it, matte and gloss
  ['cobalt', 'coral', 'sage', 'mustard', 'anthracite', 'sky', 'terracotta'].forEach((c, k) => { put(HX + 1 + k, 1, HZ + 9, 'vollton_' + c); put(HX + 1 + k, 2, HZ + 9, 'vollton_' + c + '_gloss'); });
  // the mini-voxel cottage: plaster and timber walls, windows stacked and side by side, a red roof, plaza in front
  const CX = 34, CZ = 22;
  for (let x = 0; x < 9; x++) for (let z = 0; z < 6; z++) for (let y = 1; y <= 4; y++) {
    const wall = x === 0 || x === 8 || z === 0 || z === 5;
    if (!wall) continue;
    put(CX + x, y, CZ + z, x <= 4 ? 'vx_plaster_cream' : 'vx_timber_white');
  }
  put(CX + 2, 2, CZ + 5, st('vx_window', { facing: 'south' })); put(CX + 2, 3, CZ + 5, st('vx_window', { facing: 'south' }));
  put(CX + 5, 2, CZ + 5, st('vx_window', { facing: 'south' })); put(CX + 6, 2, CZ + 5, st('vx_window', { facing: 'south' }));
  for (let x = -1; x <= 9; x++) { put(CX + x, 5, CZ + 0, st('vx_roof_red', { facing: 'south' })); put(CX + x, 5, CZ + 5, st('vx_roof_red', { facing: 'north' })); for (let z = 1; z <= 4; z++) put(CX + x, 5, CZ + z, 'vx_floor_oak'); }
  for (let x = -1; x <= 9; x++) for (let z = 6; z <= 9; z++) put(CX + x, 0, CZ + z, 'vx_floor_plaza');
  // tech panels, a glass wall and rugs beside it
  for (let x = 0; x < 6; x++) for (let y = 1; y <= 4; y++) put(CX + 12 + x, y, CZ + 5, x < 3 ? 'vx_tech_white_strip' : 'vx_tech_gray');
  for (let x = 0; x < 4; x++) for (let y = 1; y <= 3; y++) put(CX + 12 + x, y, CZ + 9, st('vx_glass_wall', { facing: 'north' }));
  for (let x = 0; x < 3; x++) for (let z = 0; z < 2; z++) put(CX + 17 + x, 1, CZ + 9 + z, 'vx_rug_red');
  w.bulkSet(list, false);
  return [ox, y0, oz];
});
const [ox, y0, oz] = base;
const look = async (name, pos, yaw, pitch) => { await ev(([pos, yaw, pitch]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(pos[0], pos[1], pos[2]); p.yaw = yaw; p.pitch = pitch; }, [pos, yaw, pitch]); await settle(30); await step(6); await shot(TAG + '_' + name); };
for (const lk of LOOKS) {
  const t0 = Date.now();
  // the first look was set before the world was made; the next ones come by chat command, as a player types it
  const sw = await ev((lk) => { const g = VR.game, before = VR.LOOK.mode; g.chat('/look ' + lk); return { before, now: VR.LOOK.mode, saved: JSON.parse(localStorage.getItem('r9si.settings') || '{}').look }; }, lk);
  // the textures come back from the worker: wait for them (the rim follows the look)
  for (let i = 0; i < 120; i++) { if (await ev(() => VR.game.texRim === VR.LOOK.rim)) break; await step(2); await wait(100); }
  await settle(80);
  const st = await ev(() => ({ look: VR.LOOK.mode, rim: VR.game.texRim, smooth: !!(VR.R.T.flags[VR.R.byName.grass_block.defaultState] & VR.F.SMOOTH) }));
  check(st.look === lk && st.rim === (lk === 'classic') && st.smooth === (lk === 'seamless'), `${lk}: switched live in ${((Date.now() - t0) / 1000).toFixed(1)} s (${JSON.stringify(sw)} → ${JSON.stringify(st)})`);
  // yaw 0 looks toward −z in this game
  await look(lk + '_1_overview', [ox + 26, y0 + 15, oz + 48], 0.2, -0.38);
  await look(lk + '_2_hill', [ox + 3, y0 + 8, oz + 46], -0.35, -0.3);
  await look(lk + '_3_stucco', [ox + 40, y0 + 3.2, oz + 17], -0.2, -0.16);
  await look(lk + '_4_cottage', [ox + 40, y0 + 4, oz + 36], 0.05, -0.18);
  await look(lk + '_5_tech', [ox + 52, y0 + 3, oz + 38], 0.2, -0.12);
  // physics: walk up the hill's flank — terrace steps (Klassisch) or the slope (Nahtlos)
  const trace = await ev(([ox, y0, oz]) => { window.__norender = true; const g = VR.game, p = g.player; p.flying = false; p.noclip = false; p.teleport(ox + 1.5, y0 + 3, oz + 22.5); p.yaw = -Math.PI / 2; p.pitch = 0; const out = []; for (let i = 0; i < 320; i++) { p.vel[0] = 4; g.last = performance.now() - 16; g.loop(performance.now()); if (i % 32 === 0 || i === 319) out.push(+(p.pos[1] - y0).toFixed(2)); } return out; }, base);
  // Klassisch steps up the one-block terraces, Nahtlos walks the slope: either way the player gets up the hill
  check(Math.max(...trace) >= 6, `${lk}: walking into the hill gets the player up it (heights ${JSON.stringify(trace)})`);
  // the shovel on grass: a path at once in Klassisch (no cut / smooth toggle there), the cut twin first in Nahtlos
  const sv = await ev(([ox, y0, oz]) => {
    const g = VR.game, w = g.world, R = VR.R, x = ox - 3 - (VR.LOOK.mode === 'classic' ? 0 : 1), z = oz - 3, y = y0;
    w.setBlock(x, y, z, R.byName.grass_block.defaultState, 0); w.setBlock(x, y + 1, z, 0, 0);
    const s = w.getBlock(x, y, z), t = R.types[R.T.type[s]];
    const used = g.sim.interact(x, y, z, s, t, { inv: { held: { id: 'iron_shovel' } }, damageHeld() {}, target: { face: 2 } });
    return { used, now: R.types[R.T.type[w.getBlock(x, y, z)]].name };
  }, base);
  check(sv.used && sv.now === (lk === 'classic' ? 'dirt_path' : 'grass_block_cut'), `${lk}: the shovel on grass makes ${sv.now}`);
}
// back with the settings button (Esc → Settings → Graphics → Blöcke: Klassisch)
const back = await ev(() => { const g = VR.game, u = g.ui; u.settingsTab = 'graphics'; u.showSettings(); const b = document.querySelector('#setbody [data-look=classic]'); if (b) b.click(); const on = document.querySelector('#setbody [data-look].on'); return { look: VR.LOOK.mode, setting: g.settings.look, on: on && on.dataset.look }; });
for (let i = 0; i < 120; i++) { if (await ev(() => VR.game.texRim === VR.LOOK.rim)) break; await step(2); await wait(100); }
const back2 = await ev(() => ({ rim: VR.game.texRim, icons: VR.game.icons.cache.size >= 0 }));
check(back.look === 'classic' && back.setting === 'classic' && back.on === 'classic' && back2.rim === true, 'the settings button switches back to Klassisch (textures with the rim again): ' + JSON.stringify([back, back2]));
// the R9 Studio takes the player's look from the same settings (here: Nahtlos)
await ev(() => { const s = JSON.parse(localStorage.getItem('r9si.settings') || '{}'); s.look = 'seamless'; localStorage.setItem('r9si.settings', JSON.stringify(s)); });
const sp = await ctx.newPage();   // the game's context: the same localStorage (browser.newPage would open a fresh one)
sp.on('pageerror', e => logs.push('[studio pageerror] ' + (e.stack || e.message).slice(0, 1500)));
sp.on('console', m => { if (m.type() === 'error') logs.push('[studio] ' + m.text().slice(0, 500)); });
await sp.goto('file:///home/claude/vr/dist/studio.html');
for (let i = 0; i < 240; i++) { await sp.waitForTimeout(500); const s = await sp.evaluate(() => ({ boot: document.getElementById('studio').classList.contains('boot'), houses: window.__studio ? window.__studio.HOUSE.size : -1 })); if (!s.boot && s.houses >= 1) break; }
const stl = await sp.evaluate(() => ({ look: VR.LOOK && VR.LOOK.mode, smooth: !!(VR.R.T.flags[VR.R.byName.grass_block.defaultState] & VR.F.SMOOTH) }));
check(stl.look === 'seamless' && stl.smooth, 'the Studio follows the player\'s look setting: ' + JSON.stringify(stl));
await sp.evaluate(() => window.__studio.selectHouse(0)); await sp.waitForTimeout(1500);
await sp.screenshot({ path: `/home/claude/vr/test/shots/${TAG}_studio_seamless.png` }); console.log('shot', TAG + '_studio_seamless');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 10)) console.log(l);
console.log(fails ? 'FAIL ' + fails : 'OK');
await browser.close();
