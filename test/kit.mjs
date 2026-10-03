// Voxel Tech kit showcase: builds a hangar / control room and a tropical tech plaza, takes screenshots
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const W = +(process.env.W || 960), H = +(process.env.H || 540);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: g.world.lastWant || 0 }; }); if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && i > 3) break; await wait(100); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.applySettings('*'); }, process.env.PRESET || 'high');
await ev(`VR.game.createWorld({name:'Kit',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '424242'}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; });
// build site: 60 blocks away from spawn, flattened
const site = await ev(() => {
  const g = VR.game, p = g.player, w = g.world, R = VR.R;
  const S = (n, props) => { const t = R.byName[n]; if (!t) throw new Error('no block ' + n); let s = t.defaultState; for (const k in (props || {})) s = t.with(s, k, props[k]); return s; };
  const x0 = Math.floor(p.pos[0]) + 40, z0 = Math.floor(p.pos[2]) - 10;
  const y0 = 90;
  const set = (x, y, z, s) => w.setBlock(x, y, z, s, 0);
  const list = [];
  const L = (x, y, z, s) => list.push([x, y, z, s]);
  // clear a volume and lay a base
  for (let x = -4; x < 44; x++) for (let z = -4; z < 30; z++) { for (let y = y0 - 2; y < y0 + 14; y++) L(x0 + x, y, z0 + z, 0); L(x0 + x, y0 - 1, z0 + z, S('stone')); }
  // ---- hangar (x 0..14, z 0..14)
  const HX = x0, HZ = z0;
  for (let x = 0; x <= 14; x++) for (let z = 0; z <= 14; z++) {
    L(HX + x, y0 - 1, HZ + z, S('vx_floor_hex'));
    L(HX + x, y0 + 6, HZ + z, S('vx_floor_deck'));
    const edge = x === 0 || x === 14 || z === 0 || z === 14;
    if (edge) for (let y = 0; y < 6; y++) L(HX + x, y0 + y, HZ + z, S(y === 0 || y === 5 ? 'vx_tech_gray' : 'vx_tech_dark_strip'));
  }
  // landing pad 3×3 in the middle
  for (let x = 6; x <= 8; x++) for (let z = 6; z <= 8; z++) L(HX + x, y0 - 1, HZ + z, S('vx_floor_pad'));
  // hex lights on the ceiling, linked in a plus
  for (const [x, z] of [[4, 4], [5, 4], [6, 4], [4, 10], [5, 10], [6, 10], [10, 4], [10, 5], [10, 6], [10, 10], [10, 9], [10, 8], [7, 7]]) L(HX + x, y0 + 5, HZ + z, S('vx_hex_light', { head: 1 }));
  // big holo screens on the back wall (z = 14 inside face → screens at z = 13, facing north)
  for (let x = 2; x <= 5; x++) for (let y = 2; y <= 3; y++) L(HX + x, y0 + y, HZ + 13, S('vx_holo_screen', { facing: 'north' }));
  for (let x = 9; x <= 12; x++) for (let y = 2; y <= 3; y++) L(HX + x, y0 + y, HZ + 13, S('vx_holo_screen', { facing: 'north' }));
  // consoles below the screens, operator side north
  for (let x = 2; x <= 5; x++) L(HX + x, y0, HZ + 12, S('vx_console', { facing: 'north' }));
  for (let x = 9; x <= 12; x++) L(HX + x, y0, HZ + 12, S('vx_console_dark', { facing: 'north' }));
  L(HX + 3, y0, HZ + 10, S('vx_stool')); L(HX + 10, y0, HZ + 10, S('vx_stool_orange'));
  // amber side screens on the west wall (x = 0 inside face → screen at x = 1 facing east)
  for (let z = 4; z <= 6; z++) L(HX + 1, y0 + 2, HZ + z, S('vx_holo_screen_amber', { facing: 'east' }));
  L(HX + 1, y0, HZ + 3, S('vx_locker', { facing: 'east' })); L(HX + 1, y0, HZ + 2, S('vx_locker', { facing: 'east' }));
  L(HX + 7, y0, HZ + 4, S('vx_holo_table'));
  // portal frame in the front wall (z = 0): 5 wide, 5 high ring around a 3×3 opening
  for (let x = 5; x <= 9; x++) for (let y = 0; y <= 4; y++) {
    const ring = x === 5 || x === 9 || y === 4;
    L(HX + x, y0 + y, HZ, ring ? S('vx_portal_frame', { facing: 'north' }) : 0);
  }
  // glass wall section on the east wall
  for (let z = 4; z <= 10; z++) for (let y = 1; y <= 3; y++) L(HX + 14, y0 + y, HZ + z, S('vx_glass_wall_dark', { facing: 'east' }));
  // ---- plaza outside to the north (z -? ) and east: x 16..42, z 0..28
  const PX = x0 + 17, PZ = z0;
  for (let x = 0; x < 26; x++) for (let z = 0; z < 28; z++) L(PX + x, y0 - 1, PZ + z, S('vx_floor_plaza'));
  // glowing path with a curve
  for (let x = 0; x <= 10; x++) L(PX + x, y0 - 1, PZ + 6, S('vx_floor_plaza_line'));
  for (let z = 6; z <= 20; z++) L(PX + 10, y0 - 1, PZ + z, S('vx_floor_plaza_line'));
  for (let x = 10; x <= 20; x++) L(PX + x, y0 - 1, PZ + 20, S('vx_floor_plaza_line_amber'));
  // palms
  const palm = (x, z, h) => { for (let y = 0; y < h; y++) L(PX + x, y0 + y, PZ + z, S('vx_palm_trunk')); L(PX + x, y0 + h, PZ + z, S('vx_palm_crown')); L(PX + x + 1, y0 + h, PZ + z, S('vx_palm_frond', { facing: 'east' })); L(PX + x - 1, y0 + h, PZ + z, S('vx_palm_frond', { facing: 'west' })); L(PX + x, y0 + h, PZ + z + 1, S('vx_palm_frond', { facing: 'south' })); L(PX + x, y0 + h, PZ + z - 1, S('vx_palm_frond', { facing: 'north' })); };
  palm(3, 10, 5); palm(14, 12, 6); palm(7, 24, 4); palm(20, 8, 5);
  for (const [x, z] of [[2, 12], [4, 9], [13, 14], [16, 11], [6, 22], [9, 25], [19, 10], [21, 6]]) L(PX + x, y0, PZ + z, S((x + z) & 1 ? 'vx_fern' : 'vx_fern_lush'));
  for (const [x, z] of [[12, 3], [13, 3], [12, 16], [18, 22]]) L(PX + x, y0, PZ + z, S('vx_tech_planter'));
  // a little tower with a dome
  for (let x = 16; x <= 17; x++) for (let z = 14; z <= 15; z++) { for (let y = 0; y < 5; y++) L(PX + x, y0 + y, PZ + z, S(y === 2 ? 'vx_tech_white_strip' : 'vx_tech_white')); L(PX + x, y0 + 5, PZ + z, S('vx_dome_white')); }
  L(PX + 22, y0, PZ + 16, S('vx_dome_glass'));
  // sofa row and railing
  for (let x = 2; x <= 5; x++) L(PX + x, y0, PZ + 16, S('vx_sofa_orange', { facing: 'south' }));
  for (let x = 0; x <= 8; x++) L(PX + x, y0, PZ + 27, S('vx_tech_railing'));
  L(PX + 5, y0, PZ + 14, S('vx_tech_desk', { facing: 'north' }));
  for (const [x, y, z, s] of list) set(x, y, z, s);
  return { x0, y0, z0, n: list.length };
});
console.log('site', JSON.stringify(site));
await settle(60); await step(30);
const view = async (name, pos, yaw, pitch, tod) => { await ev(([pos, yaw, pitch, tod]) => { const g = VR.game, p = g.player; p.flying = true; p.teleport(pos[0], pos[1], pos[2]); p.yaw = yaw; p.pitch = pitch; g.env.setTime(tod); }, [pos, yaw, pitch, tod]); await settle(20); await step(12); await shot(name); };
const { x0, y0, z0 } = site;
// yaw convention: yaw 0 looks toward -z (north), yaw +π/2 toward -x (west)
await view('kit_hangar_screens', [x0 + 7.5, y0 + 1.2, z0 + 5.5], Math.PI, -0.08, 15000);
await view('kit_hangar_portal', [x0 + 7.5, y0 + 1.6, z0 + 11.5], 0, -0.05, 15000);
await view('kit_plaza_day', [x0 + 17 + 2, y0 + 3.5, z0 + 3], Math.PI + 0.6, -0.22, 4200);
await view('kit_plaza_dusk', [x0 + 17 + 2, y0 + 3.5, z0 + 3], Math.PI + 0.6, -0.22, 12600);
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 30)) console.log(l);
await browser.close();
