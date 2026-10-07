// Endless height: a tower from the ground to y 470 (columns grow above 255), a platform at y 450 with a lamp,
// standing on it, the shade under it, meshing up there, and a tall column through save → load.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 16) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && i > 2) break; await wait(60); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 180000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.horizon = 1; g.settings.renderDist = 6; g.applySettings('*'); }, process.env.PRESET || 'high');
await ev(`VR.game.createWorld({name:'Height',mode:'creative',difficulty:'peaceful',type:'flat',seed:'5',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; g.env.setTime(6000); });
await settle(60);
const base = await ev(() => {
  const g = VR.game, w = g.world, p = g.player, R = VR.R, st = (n) => R.byName[n].defaultState;
  const ox = Math.floor(p.pos[0]) + 8, oz = Math.floor(p.pos[2]) - 8, y0 = Math.floor(p.pos[1]);
  // the tower (setBlock, one by one — as a player would) and a platform with a lamp on top
  for (let y = y0; y < 470; y++) w.setBlock(ox, y, oz, st(y % 20 < 10 ? 'vollton_cobalt_gloss' : 'vollton_white'), 0);
  for (let x = -6; x <= 6; x++) for (let z = -6; z <= 6; z++) w.setBlock(ox + x, 450, oz + z, st(Math.abs(x) === 6 || Math.abs(z) === 6 ? 'vollton_anthracite' : 'vollton_sand'), 0);
  w.setBlock(ox + 3, 451, oz + 3, st('lantern'), 0);
  for (let x = -6; x <= 6; x++) w.setBlock(ox + x, 451, oz - 6, st('panorama_black'), 0);
  const c = w.col(ox >> 4, oz >> 4);
  return { ox, oy: y0, oz, H: c.H, secs: c.sec.length, top: w.getBlock(ox, 469, oz), maxSec: w.maxSec };
});
console.log('built', JSON.stringify(base));
check(base.H > 256 && base.top !== 0, 'the tower reaches y 469 and its column grows above 255');
await settle(120);
const probe = await ev(([ox, y0, oz]) => {
  const g = VR.game, w = g.world, L = (x, y, z) => { const l = w.getLight(x, y, z); return [l >>> 12, (l >> 8) & 15, (l >> 4) & 15, l & 15]; };
  let meshed = 0, tall = 0; for (const c of w.cols.values()) { if (c.H > 256) tall++; for (const s of c.sec) if (s.hasMesh) meshed++; }
  return { lightBesideLamp: L(ox + 4, 451, oz + 3), skyUnderPlatform: L(ox + 2, 449, oz + 2), groundUnderPlatform: L(ox + 2, y0, oz + 2), groundOutside: L(ox + 20, y0, oz + 20), tallColumns: tall, meshedSections: meshed };
}, [base.ox, base.oy, base.oz]);
console.log('probe', JSON.stringify(probe));
// stand on the platform: fall onto it from above, walk a few steps
const stand = await ev(([ox, y0, oz]) => {
  const g = VR.game, p = g.player; p.flying = false; p.noclip = false; p.teleport(ox + 2.5, 455, oz + 2.5); p.vel[0] = p.vel[1] = p.vel[2] = 0;
  for (let i = 0; i < 160; i++) { g.last = performance.now() - 16; g.loop(performance.now()); }
  const y1 = p.pos[1];
  for (let i = 0; i < 60; i++) { p.vel[0] = 3; g.last = performance.now() - 16; g.loop(performance.now()); }
  return { y: +y1.toFixed(3), onGround: p.onGround, afterWalk: [+(p.pos[0] - ox).toFixed(2), +p.pos[1].toFixed(2)] };
}, [base.ox, base.oy, base.oz]);
check(stand.onGround && Math.abs(stand.y - 451) < 0.01, 'standing on the platform: on its top at y 451');
console.log('standing on the platform:', JSON.stringify(stand), stand.onGround && Math.abs(stand.y - 451) < 0.01 ? 'OK' : 'CHECK');
await ev(([ox, y0, oz]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(ox - 14, 458, oz + 16); p.yaw = -0.7; p.pitch = -0.32; }, [base.ox, base.oy, base.oz]);
await settle(30); await step(8); await shot('ht_1_platform');
await ev(([ox, y0, oz]) => { const g = VR.game, p = g.player; p.teleport(ox - 40, y0 + 30, oz + 60); p.yaw = -0.55; p.pitch = 0.55; }, [base.ox, base.oy, base.oz]);
await settle(30); await step(8); await shot('ht_2_tower');
// save → load the tall column
const io = await ev(async ([ox, y0, oz]) => {
  const g = VR.game, w = g.world, c = w.col(ox >> 4, oz >> 4);
  await w.store.saveColumn(w.dim, c);
  const b = await w.store.loadColumn(w.dim, c.cx, c.cz);
  return { savedH: c.H, loadedLen: b.length, H: b.length >> 8, blockAt460: b[(460 << 8) | ((oz & 15) << 4) | (ox & 15)] === c.blocks[(460 << 8) | ((oz & 15) << 4) | (ox & 15)] };
}, [base.ox, base.oy, base.oz]);
console.log('save/load', JSON.stringify(io));
check(io.H === io.savedH && io.blockAt460, 'the tall column comes back whole from the save');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 10)) console.log(l);
check(!logs.some(l => /pageerror\]/.test(l)), 'no page errors');
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
