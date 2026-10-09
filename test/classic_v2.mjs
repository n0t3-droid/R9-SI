// Klassisch v2 (v0.39.1): every block visibly its own cube — the scenes of blocklook.mjs (grass hill, stucco house,
// mini-voxel cottage, tech panels) plus a forest edge, a stone cliff with ores, a village street, a furnished
// interior, a sand / snow patch, a pond and the flat grass at eye level, shot in both looks (switched live, as a
// player would), then Klassisch on the Very Low preset (cl2_potato_*). In Klassisch the block grid must be
// measurable on flat grass: rows of pixels 9–13 blocks away in the hill and the flat-grass scenes show darker lines
// at a regular period (≥ 8 % luminance dips at the block borders the camera geometry predicts) — the same analysis
// must find no grid in the Nahtlos shots. Shots: test/shots/cl2_<look>_<n>_<scene>.png
// LOOKS=classic,seamless (default) · PRESET=high · TAG=cl2 · NO_POTATO=1 skips the Very Low shots
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/claude/.npm-global/lib/node_modules/sharp/lib/index.js';
const TAG = process.env.TAG || 'cl2';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail|missing/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 16) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && i > 2) break; await wait(60); } };
const shotPath = (name) => `/home/claude/vr/test/shots/${name}.png`;
const shot = async (name, frames = 3) => { await ev((frames) => { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, frames); await page.screenshot({ path: shotPath(name), timeout: 180000 }); console.log('shot', name); };
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
const LOOKS = (process.env.LOOKS || 'classic,seamless').split(',');
await ev(([p, lk]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.horizon = 1; g.settings.renderDist = 6; g.settings.look = lk; g.settings.fov = 72; g.applySettings('*'); }, [process.env.PRESET || 'high', LOOKS[0]]);   // fov 72: the grid analysis (FOCAL) assumes it; the game's default is 75 since F3
await ev(`VR.game.createWorld({name:'Blocks v2',mode:'creative',difficulty:'peaceful',type:'flat',seed:'31',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; g.env.setTime(5200); });
await settle(60);
console.log('gpu', JSON.stringify(await ev(() => { const gl = VR.game.renderer.gl, e = gl.getExtension('EXT_texture_filter_anisotropic'); const d = gl.getExtension('WEBGL_debug_renderer_info'); return { aniso: e ? gl.getParameter(e.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 0, renderer: d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : '?' }; })));
// ---------------------------------------------------------------- the scenes (relative to ox, y0, oz: y0 is the ground block, its top at y0 + 1)
const base = await ev(() => {
  const g = VR.game, w = g.world, p = g.player, R = VR.R;
  const st = (n, pr) => { const t = R.byName[n]; if (!t) throw new Error('no block ' + n); return pr ? t.state(Object.assign({}, t.decode(t.defaultState), pr)) : t.defaultState; };
  const ox = Math.floor(p.pos[0]) + 6, oz = Math.floor(p.pos[2]) - 40, y0 = Math.floor(p.pos[1]) - 1;
  const list = [], put = (x, y, z, s) => list.push([ox + x, y0 + y, oz + z, typeof s === 'string' ? st(s) : s]);
  for (let x = -34; x < 74; x++) for (let z = -20; z < 64; z++) for (let y = 1; y < 14; y++) put(x, y, z, 0);
  const G = st('grass_block'), D = st('dirt');
  // the hill (as in blocklook): a dome and a ridge, grass over dirt
  for (let z = 0; z < 44; z++) for (let x = 0; x < 30; x++) { const h = Math.round(6 * Math.exp(-((x - 16) ** 2 + (z - 22) ** 2) / 90) + 2 * Math.exp(-((x - 6) ** 2) / 12)); for (let y = 0; y <= h; y++) put(x, y, z, y < h ? D : G); }
  // the stucco house with panorama glass and a Vollton band
  const HX = 34, HZ = 4;
  for (let x = 0; x < 9; x++) for (let z = 0; z < 7; z++) for (let y = 1; y <= 5; y++) {
    const wall = x === 0 || x === 8 || z === 0 || z === 6;
    if (y === 5) { put(HX + x, y, HZ + z, 'roof_charcoal'); continue; }
    if (!wall) continue;
    put(HX + x, y, HZ + z, y === 4 ? 'vollton_white' : 'stucco_white');
  }
  for (let x = 1; x <= 3; x++) for (let y = 2; y <= 3; y++) put(HX + x, y, HZ + 6, 'panorama_black');
  for (let x = 5; x <= 6; x++) for (let y = 2; y <= 3; y++) put(HX + x, y, HZ + 6, 'panorama_black');
  // the mini-voxel cottage, plaza, tech panels, glass wall and rugs (as in blocklook)
  const CX = 34, CZ = 22;
  for (let x = 0; x < 9; x++) for (let z = 0; z < 6; z++) for (let y = 1; y <= 4; y++) { const wall = x === 0 || x === 8 || z === 0 || z === 5; if (wall) put(CX + x, y, CZ + z, x <= 4 ? 'vx_plaster_cream' : 'vx_timber_white'); }
  put(CX + 2, 2, CZ + 5, st('vx_window', { facing: 'south' })); put(CX + 2, 3, CZ + 5, st('vx_window', { facing: 'south' }));
  put(CX + 5, 2, CZ + 5, st('vx_window', { facing: 'south' })); put(CX + 6, 2, CZ + 5, st('vx_window', { facing: 'south' }));
  for (let x = -1; x <= 9; x++) { put(CX + x, 5, CZ + 0, st('vx_roof_red', { facing: 'south' })); put(CX + x, 5, CZ + 5, st('vx_roof_red', { facing: 'north' })); for (let z = 1; z <= 4; z++) put(CX + x, 5, CZ + z, 'vx_floor_oak'); }
  for (let x = -1; x <= 9; x++) for (let z = 6; z <= 9; z++) put(CX + x, 0, CZ + z, 'vx_floor_plaza');
  for (let x = 0; x < 6; x++) for (let y = 1; y <= 4; y++) put(CX + 12 + x, y, CZ + 5, x < 3 ? 'vx_tech_white_strip' : 'vx_tech_gray');
  for (let x = 0; x < 4; x++) for (let y = 1; y <= 3; y++) put(CX + 12 + x, y, CZ + 9, st('vx_glass_wall', { facing: 'north' }));
  for (let x = 0; x < 3; x++) for (let z = 0; z < 2; z++) put(CX + 17 + x, 1, CZ + 9 + z, 'vx_rug_red');
  // the forest edge: oaks, a birch and a spruce west of the hill, short grass and flowers under them
  const tree = (x, z, kind, h) => {
    const log = st(kind + '_log'), leaves = st(kind + '_leaves');
    for (let y = 1; y <= h; y++) put(x, y, z, log);
    if (kind === 'spruce') { for (let dy = -4; dy <= 1; dy++) { const r = dy === 1 ? 0 : dy === 0 || dy === -2 ? 1 : 2; for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) if (Math.abs(dx) + Math.abs(dz) <= r + 1 && (dx || dz || dy >= 0)) put(x + dx, h + dy, z + dz, leaves); } return; }
    for (let dy = -2; dy <= 1; dy++) { const r = dy === 1 ? 1 : 2; for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) { if (Math.abs(dx) === r && Math.abs(dz) === r && (dy !== -1 || (dx + dz) % 2)) continue; if (dx === 0 && dz === 0 && dy < 1) continue; put(x + dx, h + dy, z + dz, leaves); } }
  };
  tree(-14, 6, 'oak', 5); tree(-20, 12, 'oak', 6); tree(-12, 16, 'birch', 6); tree(-24, 4, 'spruce', 8); tree(-18, 22, 'oak', 5); tree(-26, 18, 'spruce', 9);
  for (let i = 0; i < 40; i++) { const x = -30 + (i * 7) % 24, z = 2 + (i * 11) % 28; if (!list.find(e => e[0] === ox + x && e[2] === oz + z && e[1] === y0 + 1 && e[3])) put(x, 1, z, i % 5 === 0 ? 'poppy' : 'short_grass'); }
  // the stone cliff north of the hill: stone, andesite, granite, gravel and dirt bands, ores, grass on top
  for (let x = 0; x < 30; x++) for (let z = -16; z <= -6; z++) for (let y = 0; y <= 6; y++) {
    const h = (x * 7 + z * 3) % 11, band = y <= 1 ? 'stone' : y === 2 ? (x % 5 === 2 ? 'gravel' : 'stone') : y <= 4 ? (h < 3 ? 'andesite' : 'stone') : y === 5 ? (h < 4 ? 'granite' : h < 6 ? 'dirt' : 'stone') : 'stone';
    put(x, y, z, (y === 3 && h === 7) ? 'coal_ore' : (y === 1 && h === 5) ? 'iron_ore' : band);
  }
  for (let x = 0; x < 30; x++) for (let z = -16; z <= -6; z++) put(x, 7, z, (x + z) % 9 === 0 ? 'dirt' : 'grass_block');
  // the village street: a cobblestone road, a planks house and a stone-brick house, fences, a lantern
  for (let x = 34; x < 62; x++) for (let z = 40; z <= 41; z++) put(x, 0, z, (x * 3 + z) % 7 === 0 ? 'gravel' : 'cobblestone');
  for (let x = 34; x < 62; x++) { put(x, 0, 39, 'dirt_path'); put(x, 0, 42, 'dirt_path'); }
  const house = (x0, z0, wall, corner, roof) => {
    for (let x = 0; x < 7; x++) for (let z = 0; z < 5; z++) { put(x0 + x, 0, z0 + z, 'oak_planks'); for (let y = 1; y <= 3; y++) { const isWall = x === 0 || x === 6 || z === 0 || z === 4; if (!isWall) continue; const isCorner = (x === 0 || x === 6) && (z === 0 || z === 4); put(x0 + x, y, z0 + z, isCorner ? corner : wall); } }
    for (let x = -1; x <= 7; x++) for (let z = -1; z <= 5; z++) put(x0 + x, 4, z0 + z, roof);
    for (let x = 0; x <= 6; x++) put(x0 + x, 5, z0 + 2, roof);
  };
  house(36, 34, 'oak_planks', 'oak_log', 'oak_planks');
  put(38, 2, 34, 'glass'); put(39, 2, 34, 'glass'); put(41, 2, 34, 'glass'); put(39, 1, 38, 'glass'); put(39, 2, 38, 'glass');
  house(46, 43, 'stone_bricks', 'oak_log', 'cobblestone');
  put(48, 2, 43, 'glass'); put(49, 2, 43, 'glass'); put(50, 2, 43, 'glass'); put(52, 2, 45, 'glass');
  for (let x = 44; x <= 52; x++) if (x !== 48) put(x, 1, 48, 'oak_fence');
  put(56, 1, 38, 'oak_fence'); put(56, 2, 38, 'lantern'); put(44, 1, 43, 'cobblestone_wall'); put(44, 1, 44, 'cobblestone_wall');
  // the interior: a stone-brick room with a planks floor, a window, a bed, bookshelves, a table and a carpet
  const IX = 60, IZ = 50;
  for (let x = 0; x < 9; x++) for (let z = 0; z < 9; z++) { put(IX + x, 0, IZ + z, 'oak_planks'); for (let y = 1; y <= 4; y++) { const isWall = x === 0 || x === 8 || z === 0 || z === 8; if (isWall) put(IX + x, y, IZ + z, y === 4 ? 'oak_planks' : 'stone_bricks'); if (y === 4 && !isWall) put(IX + x, y, IZ + z, 'oak_planks'); } }
  put(IX + 3, 2, IZ, 'glass'); put(IX + 4, 2, IZ, 'glass'); put(IX + 5, 2, IZ, 'glass'); put(IX + 8, 2, IZ + 4, 'glass');
  put(IX + 1, 1, IZ + 1, 'bookshelf'); put(IX + 2, 1, IZ + 1, 'bookshelf'); put(IX + 1, 2, IZ + 1, 'bookshelf'); put(IX + 6, 1, IZ + 1, 'crafting_table'); put(IX + 7, 1, IZ + 1, 'chest');
  for (let x = 3; x <= 5; x++) for (let z = 3; z <= 5; z++) put(IX + x, 1, IZ + z, 'red_carpet');
  put(IX + 4, 3, IZ + 4, 'lantern'); put(IX + 1, 1, IZ + 7, 'red_wool'); put(IX + 2, 1, IZ + 7, 'red_wool'); put(IX + 7, 1, IZ + 7, 'oak_log');
  // a pond east of the hill (water: a seamless surface in both looks, its banks blocks)
  for (let x = 40; x <= 46; x++) for (let z = 50; z <= 53; z++) { put(x, 0, z, 'water'); if (x === 40 || x === 46 || z === 50 || z === 53) put(x, 0, z, (x + z) % 3 ? 'sand' : 'gravel'); }
  for (let x = 41; x <= 45; x++) for (let z = 51; z <= 52; z++) { put(x, -1, z, 'water'); }
  for (let x = 40; x <= 46; x++) for (let z = 50; z <= 53; z++) if (x === 40 || x === 46 || z === 50 || z === 53) put(x, -1, z, 'dirt');
  // sand and snow, side by side, south-west
  for (let x = -30; x < -8; x++) for (let z = 34; z < 48; z++) { const sand = x < -19; put(x, 0, z, sand ? 'sand' : 'snow_block'); if (sand && ((x * 5 + z * 3) % 13 === 0)) put(x, 1, z, 'sandstone'); if (!sand && ((x * 3 + z * 5) % 17 === 0)) put(x, 1, z, 'snow_block'); }
  w.bulkSet(list, false);
  return [ox, y0, oz];
});
const [ox, y0, oz] = base;
const EYE = 1.62, FOCAL = 360 / Math.tan(36 * Math.PI / 180);   // vertical fov 72° at 720 px
const look = async (name, pos, yaw, pitch, frames) => { await ev(([pos, yaw, pitch]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(pos[0], pos[1], pos[2]); p.yaw = yaw; p.pitch = pitch; p.fovKick = 0; }, [pos, yaw, pitch]); await settle(30); await ev(() => { const e = VR.game.entities; if (e && e.mobs) e.mobs.length = 0; }); await step(6); await shot(TAG + '_' + name, frames); };   // (the sheep that wander in would sit in the analysed rows)
// ---------------------------------------------------------------- the grid analysis: a row of pixels across flat grass
// The camera looks along −z (yaw 0) from an integer x (so block borders sit at screen x = 640 ± k · period) with
// pitch pt from a height h above the grass. A row is chosen by the ground distance D it sees (D + ½: never along a
// z-border line): row = 360 + f · tan(atan(h / D) + pt); the depth along the view axis there is h·sin(−pt) + D·cos(−pt),
// so a block is f / depth px wide. The row's luminance over the 12 blocks around the centre is folded by that period
// into 32 phase bins (the texture's own noise averages out, a border line does not): the grid shows as a dip of the
// two border bins (31 and 0) against the fold's mean, with the darkest bin at the border. The period is searched
// within ±2 % (sub-pixel camera geometry). Nahtlos' gentle rim groove stays under the threshold at these distances.
async function gridOn(name, h, pitch, dists) {
  const { data, info } = await sharp(shotPath(name)).raw().toBuffer({ resolveWithObject: true });
  const W = info.width, C = info.channels;
  const out = [];
  for (const D0 of dists) {
    const ys = Math.round(360 + FOCAL * Math.tan(Math.atan(h / D0) + pitch));
    const v = ys - 360, th = -pitch + Math.atan(v / FOCAL), D = h / Math.tan(th), depth = h * Math.sin(-pitch) + D * Math.cos(-pitch), pred = FOCAL / depth;
    const L = new Float32Array(W);
    for (let x = 0; x < W; x++) { let s = 0; for (let dy = -1; dy <= 1; dy++) { const o = ((ys + dy) * W + x) * C; s += 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]; } L[x] = s / 3; }
    const x0 = Math.max(0, Math.round(640 - 6 * pred)), x1 = Math.min(W, Math.round(640 + 6 * pred));
    const fold = (P) => {
      const bins = new Float64Array(32), cnt = new Float64Array(32);
      for (let x = x0; x < x1; x++) { let ph = ((x + 0.5 - 640) / P) % 1; if (ph < 0) ph += 1; const b = Math.min(31, Math.floor(ph * 32)); bins[b] += L[x]; cnt[b]++; }
      let mean = 0; for (let b = 0; b < 32; b++) { bins[b] = cnt[b] ? bins[b] / cnt[b] : 0; mean += bins[b]; } mean /= 32;
      let darkest = 0; for (let b = 1; b < 32; b++) if (bins[b] < bins[darkest]) darkest = b;
      return { border: 1 - (bins[31] + bins[0]) / 2 / mean, darkest, darkDip: 1 - bins[darkest] / mean };
    };
    let best = null;
    for (let P = pred * 0.98; P <= pred * 1.02; P += pred * 0.002) { const r = fold(P); if (!best || r.border > best.border) best = Object.assign({ P }, r); }
    const atBorder = best.darkest >= 30 || best.darkest <= 1;
    const grid = best.border >= 0.08 && atBorder;
    out.push({ row: ys, D: +D.toFixed(1), period: +pred.toFixed(1), bestPeriod: +best.P.toFixed(1), borderDip: +(best.border * 100).toFixed(1), darkestBin: best.darkest, darkestDip: +(best.darkDip * 100).toFixed(1), grid });
  }
  return out;
}
const HILL = { pos: [ox + 16, y0 + 1 + 3.4, oz + 52], pitch: -0.6, h: 3.4 + EYE };
const GRASS = { pos: [ox + 16, y0 + 1 + 4.0, oz + 62], pitch: -0.85, h: 4.0 + EYE };
const gridResults = {};
for (const lk of LOOKS) {
  const sw = await ev((lk) => { const g = VR.game, before = VR.LOOK.mode; g.chat('/look ' + lk); return { before, now: VR.LOOK.mode }; }, lk);
  for (let i = 0; i < 120; i++) { if (await ev(() => VR.game.texRim === VR.LOOK.rim)) break; await step(2); await wait(100); }
  await settle(80);
  const st = await ev(() => ({ look: VR.LOOK.mode, rim: VR.game.texRim, vary: VR.LOOK.vary }));
  check(st.look === lk && st.rim === (lk === 'classic') && st.vary === (lk === 'classic'), `${lk}: switched live (${JSON.stringify(sw)} → ${JSON.stringify(st)})`);
  await look(lk + '_1_hill', HILL.pos, 0, HILL.pitch);
  await look(lk + '_2_grass', GRASS.pos, 0, GRASS.pitch);
  await look(lk + '_3_forest', [ox - 17, y0 + 1 + 1.2, oz + 34], 0.15, -0.08);
  await look(lk + '_4_cliff', [ox + 15, y0 + 1 + 2.2, oz + 7], 0, -0.06);
  await look(lk + '_5_street', [ox + 60, y0 + 1 + 1.0, oz + 40.5], Math.PI / 2, -0.1);
  await look(lk + '_6_interior', [ox + 64.5, y0 + 1 + 0.1, oz + 57.2], 0, -0.12);
  await look(lk + '_7_sandsnow', [ox - 19, y0 + 1 + 2.5, oz + 54], 0, -0.5);
  await look(lk + '_8_far', [ox + 16, y0 + 1 + 24, oz + 118], 0, -0.16);
  await look(lk + '_9_pond', [ox + 43, y0 + 1 + 2.2, oz + 58.5], 0, -0.42);
  await look(lk + '_10_eye', [ox + 20.5, y0 + 1, oz + 90.5], 0.35, -0.05);   // standing on the flat grass, looking across it
  // the grid on flat grass: the hill scene's foreground rows and the flat-grass scene
  const hill = await gridOn(TAG + '_' + lk + '_1_hill', HILL.h, HILL.pitch, [9.5, 10.5, 11.5, 12.5]);
  const grass = await gridOn(TAG + '_' + lk + '_2_grass', GRASS.h, GRASS.pitch, [9.5, 10.5, 11.5, 12.5]);
  gridResults[lk] = { hill, grass };
  const found = (r) => r.filter(x => x.grid);
  if (lk === 'classic') {
    check(found(hill).length >= 3, `classic: the block grid is found on the flat grass of the hill scene in ${found(hill).length} of ${hill.length} rows (9–13 blocks away) — ${JSON.stringify(hill)}`);
    check(found(grass).length >= 3, `classic: and on the flat grass scene in ${found(grass).length} of ${grass.length} rows — ${JSON.stringify(grass)}`);
  } else {
    check(found(hill).length === 0 && found(grass).length === 0, `seamless: no block grid on the flat grass (${found(hill).length} + ${found(grass).length} rows with one) — hill ${JSON.stringify(hill)} grass ${JSON.stringify(grass)}`);
  }
}
// the Very Low preset (flat materials, 55 % Super Resolution): the same look on the weakest PCs — the frames build up
// the full-resolution image, so a shot takes a few more of them
if (LOOKS.includes('classic') && !process.env.NO_POTATO) {
  await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.settings.look = 'classic'; g.settings.fov = 72; g.applySettings('*'); g.chat('/look classic'); });
  for (let i = 0; i < 120; i++) { if (await ev(() => VR.game.texRim === VR.LOOK.rim && VR.LOOK.mode === 'classic')) break; await step(2); await wait(100); }
  await settle(80);
  const q = await ev(() => ({ lite: VR.game.renderer.q.lite, tsr: VR.game.renderer.q.tsr, w: VR.game.renderer.w, W: VR.game.renderer.W }));
  console.log('potato', JSON.stringify(q));
  await look('potato_1_hill', HILL.pos, 0, HILL.pitch, 16);
  await look('potato_3_forest', [ox - 17, y0 + 1 + 1.2, oz + 34], 0.15, -0.08, 16);
  await look('potato_10_eye', [ox + 20.5, y0 + 1, oz + 90.5], 0.35, -0.05, 16);
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 10)) console.log(l);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);
