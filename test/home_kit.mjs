// Village Life & Supermarket kit showcase: builds a supermarket interior and a farm yard, checks every block exists, takes screenshots
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const W = +(process.env.W || 960), H = +(process.env.H || 540);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
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
await ev(`VR.game.createWorld({name:'HomeKit',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '424242'}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; });


let fails = 0; const verify = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
// ---- 1. every required block exists
const REQUIRED = ['stucco_white', 'stucco_cream', 'stacked_stone', 'roof_charcoal', 'roof_charcoal_stairs', 'wood_slat', 'garage_door', 'window_black', 'window_warm', 'glass_rail', 'concrete_smooth', 'paver_grey', 'granite_paver', 'marble_white', 'marble_dark', 'oak_herringbone', 'subway_tile', 'dark_tile', 'travertine', 'deck_wood', 'pool_tile', 'white_trim', 'black_metal', 'charcoal_panel', 'terrazzo',
  'vx_sofa_charcoal', 'vx_sofa_cream', 'vx_coffee_table', 'vx_coffee_table_marble', 'vx_tv_wall', 'vx_kitchen_island', 'vx_kitchen_sink', 'vx_kitchen_hob', 'vx_upper_cabinet', 'vx_fridge', 'vx_dining_table', 'vx_dining_chair', 'vx_wardrobe', 'vx_nightstand', 'vx_bathtub', 'vx_shower', 'vx_toilet', 'vx_vanity', 'vx_mirror', 'vx_bookshelf', 'vx_art_warm', 'vx_art_cool', 'vx_art_gold', 'vx_tall_plant', 'vx_pendant', 'vx_pendant_brass', 'vx_chandelier', 'vx_sconce', 'vx_led_strip', 'vx_led_cove', 'vx_spot', 'vx_bollard', 'vx_pillar_white', 'vx_column_classic', 'vx_balustrade', 'vx_railing_black', 'vx_railing_lit', 'vx_urn', 'vx_fountain', 'vx_car_black', 'vx_car_red', 'vx_car_white'];
const check = await ev((names) => {
  const R = VR.R, out = { missing: [] };
  let icons = 0, errs = [];
  for (const n of names) { const t = R.byName[n]; if (!t) { out.missing.push(n); continue; } if (!/^vx_/.test(n)) continue; for (let s = t.base; s < t.base + t.nstates; s++) { try { VR.VX.iconGrid(s); VR.VX.boxes(s, false); VR.VX.boxes(s, true); icons++; } catch (e) { errs.push(n + ': ' + e.message); } } }
  out.icons = icons; out.errs = errs.slice(0, 10); return out;
}, REQUIRED);
console.log('required blocks:', REQUIRED.length, 'missing:', check.missing.length ? check.missing.join(', ') : 'none', '| states painted:', check.icons, 'errors:', check.errs.length ? check.errs.join(' | ') : 'none');
verify(check.missing.length === 0, 'every required block exists');
verify(check.errs.length === 0, 'every block paints its icon and boxes');

// ---- 2. build the showcase
await ev(() => { const g = VR.game, p = g.player; p.flying = true; p.teleport(p.pos[0] + 66, 100, p.pos[2] + 4); });
await settle(80); await step(20);
await ev(() => { const g = VR.game, p = g.player; p.teleport(p.pos[0] - 66, 100, p.pos[2] - 4); });
await settle(40);
const site = await ev(() => {
  const g = VR.game, p = g.player, w = g.world, R = VR.R;
  const S = (n, props) => { const t = R.byName[n]; if (!t) throw new Error('no block ' + n); let s = t.defaultState; for (const k in (props || {})) s = t.with(s, k, props[k]); return s; };
  const x0 = Math.floor(p.pos[0]) + 40, z0 = Math.floor(p.pos[2]) - 10, y0 = 90;
  const list = [];
  const L = (x, y, z, s) => list.push([x, y, z, typeof s === 'string' ? S(s) : s]);
  for (let x = -6; x < 60; x++) for (let z = -6; z < 40; z++) { for (let y = y0 - 2; y < y0 + 16; y++) L(x0 + x, y, z0 + z, 0); L(x0 + x, y0 - 1, z0 + z, S(x < 26 ? 'concrete_smooth' : 'grass_block')); }
  // ============ HOUSE SHELL (x 0..23, z 0..15): stucco + stone piers, black-frame glass front, charcoal flat roof
  const HX = x0, HZ = z0;
  for (let x = 0; x <= 23; x++) for (let z = 0; z <= 15; z++) {
    const bath = x >= 17 && z <= 6, bed = x >= 12 && !bath && z <= 6, kitchen = x <= 11 && z <= 6;
    L(HX + x, y0 - 1, HZ + z, S(bath ? 'dark_tile' : kitchen ? 'marble_white' : bed ? 'carpet_cream' : 'oak_herringbone'));
    L(HX + x, y0 + 4, HZ + z, S('stucco_white'));
    L(HX + x, y0 + 5, HZ + z, S(x === 0 || x === 23 || z === 0 || z === 15 ? 'white_trim' : 'roof_charcoal'));
    const edge = x === 0 || x === 23 || z === 0 || z === 15;
    if (edge) for (let y = 0; y < 4; y++) {
      const front = z === 15, pier = front && (x === 0 || x === 1 || x === 11 || x === 12 || x === 22 || x === 23);
      L(HX + x, y0 + y, HZ + z, S(pier ? 'stacked_stone' : front && x > 1 && x < 22 && !(x === 6 || x === 7) ? 'window_black' : x === 0 && z > 2 && z < 13 ? 'window_black' : 'stucco_white'));
    }
  }
  // interior walls: kitchen | bedroom | bath (z 0..6) and the living room (z 8..14)
  for (let x = 0; x <= 23; x++) for (let y = 0; y < 4; y++) if (x !== 4 && x !== 5 && x !== 14 && x !== 19) L(HX + x, y0 + y, HZ + 7, S('stucco_white'));
  for (let z = 1; z <= 6; z++) for (let y = 0; y < 4; y++) { L(HX + 12, y0 + y, HZ + z, S('stucco_white')); L(HX + 17, y0 + y, HZ + z, S(z <= 3 ? 'subway_tile' : 'stucco_white')); }
  // living room: L sofa, coffee table, TV wall, art, plants, pendant, LED strips, spots
  for (let x = 3; x <= 6; x++) L(HX + x, y0, HZ + 12, S('vx_sofa_charcoal', { facing: 'south' }));
  L(HX + 7, y0, HZ + 12, S('vx_sofa_charcoal', { facing: 'east' })); L(HX + 7, y0, HZ + 11, S('vx_sofa_charcoal', { facing: 'east' }));
  L(HX + 5, y0, HZ + 10, S('vx_coffee_table', { facing: 'south' }));
  for (let x = 3; x <= 7; x++) L(HX + x, y0, HZ + 8, S('vx_tv_wall', { facing: 'south' }));
  L(HX + 1, y0 + 2, HZ + 8, S('vx_art_warm', { facing: 'south' })); L(HX + 10, y0 + 2, HZ + 8, S('vx_art_cool', { facing: 'south' }));
  L(HX + 1, y0, HZ + 9, S('vx_tall_plant')); L(HX + 10, y0, HZ + 13, S('vx_tall_plant_black'));
  L(HX + 5, y0 + 3, HZ + 10, S('vx_pendant')); L(HX + 2, y0 + 3, HZ + 11, S('vx_spot')); L(HX + 9, y0 + 3, HZ + 11, S('vx_spot'));
  for (let x = 1; x <= 10; x++) L(HX + x, y0, HZ + 14, S('vx_led_strip', { facing: 'north' }));
  L(HX + 9, y0, HZ + 9, S('vx_bookshelf', { facing: 'south' })); L(HX + 9, y0 + 1, HZ + 9, S('vx_bookshelf', { facing: 'south' }));
  L(HX + 22, y0 + 2, HZ + 12, S('vx_sconce', { facing: 'west' })); L(HX + 22, y0 + 2, HZ + 9, S('vx_sconce', { facing: 'west' }));
  // dining (x 13..21, z 9..13)
  for (let x = 15; x <= 17; x++) L(HX + x, y0, HZ + 11, S('vx_dining_table', { facing: 'south' }));
  for (let x = 15; x <= 17; x++) { L(HX + x, y0, HZ + 10, S('vx_dining_chair', { facing: 'south' })); L(HX + x, y0, HZ + 12, S('vx_dining_chair_teal', { facing: 'north' })); }
  L(HX + 16, y0 + 3, HZ + 11, S('vx_chandelier')); L(HX + 20, y0 + 2, HZ + 8, S('vx_art_gold', { facing: 'south' }));
  // kitchen (x 1..11, z 1..6): counters along the back wall, upper cabinets, island, fridge
  for (let x = 2; x <= 9; x++) L(HX + x, y0, HZ + 1, S(x === 4 ? 'vx_kitchen_sink' : x === 7 ? 'vx_kitchen_hob' : 'vx_kitchen_island', { facing: 'south' }));
  for (let x = 2; x <= 9; x++) L(HX + x, y0 + 2, HZ + 1, S('vx_upper_cabinet', { facing: 'south' }));
  L(HX + 10, y0, HZ + 1, S('vx_fridge', { facing: 'south', part: 'lower' })); L(HX + 10, y0 + 1, HZ + 1, S('vx_fridge', { facing: 'south', part: 'upper' }));
  for (let x = 4; x <= 7; x++) L(HX + x, y0, HZ + 4, S('vx_kitchen_island_dark', { facing: 'south' }));
  for (let x = 4; x <= 7; x++) L(HX + x, y0, HZ + 5, S('vx_stool'));
  L(HX + 5, y0 + 3, HZ + 4, S('vx_pendant_brass')); L(HX + 7, y0 + 3, HZ + 4, S('vx_pendant_brass'));
  // bedroom (x 13..16, z 1..6): bed, nightstands, wardrobe, art
  L(HX + 14, y0, HZ + 2, S('vx_bed_white', { facing: 'south', part: 'head' })); L(HX + 14, y0, HZ + 3, S('vx_bed_white', { facing: 'south', part: 'foot' }));
  L(HX + 13, y0, HZ + 2, S('vx_nightstand', { facing: 'south' })); L(HX + 15, y0, HZ + 2, S('vx_nightstand', { facing: 'south' }));
  L(HX + 16, y0, HZ + 5, S('vx_wardrobe', { facing: 'west', part: 'lower' })); L(HX + 16, y0 + 1, HZ + 5, S('vx_wardrobe', { facing: 'west', part: 'upper' }));
  L(HX + 14, y0 + 2, HZ + 1, S('vx_art_cool', { facing: 'south' })); L(HX + 14, y0 + 3, HZ + 4, S('vx_spot'));
  // bathroom (x 18..22, z 1..6): tub, shower, toilet, vanity + mirror
  L(HX + 19, y0, HZ + 1, S('vx_bathtub', { facing: 'south' })); L(HX + 20, y0, HZ + 1, S('vx_bathtub', { facing: 'south' }));
  L(HX + 22, y0, HZ + 1, S('vx_shower', { facing: 'south', part: 'lower' })); L(HX + 22, y0 + 1, HZ + 1, S('vx_shower', { facing: 'south', part: 'upper' }));
  L(HX + 18, y0, HZ + 5, S('vx_toilet', { facing: 'east' }));
  L(HX + 21, y0, HZ + 5, S('vx_vanity', { facing: 'north' })); L(HX + 21, y0 + 2, HZ + 5, S('vx_mirror', { facing: 'north' })); L(HX + 20, y0 + 3, HZ + 3, S('vx_spot'));
  // ============ EXTERIOR ROW (x 28..56): pillars, classical columns, balustrade, railing, urns, fountain, cars, bollards, garage & slats
  const EX = x0 + 28, EZ = z0 + 2;
  for (let y = 0; y < 3; y++) { L(EX, y0 + y, EZ, S('vx_pillar_white')); L(EX + 2, y0 + y, EZ, S('vx_column_classic')); }
  for (let x = 4; x <= 9; x++) L(EX + x, y0, EZ, S('vx_balustrade'));
  for (let x = 11; x <= 16; x++) L(EX + x, y0, EZ, S('vx_railing_black'));
  for (let x = 18; x <= 22; x++) L(EX + x, y0, EZ, S('glass_rail'));
  L(EX + 1, y0, EZ + 3, S('vx_urn')); L(EX + 3, y0, EZ + 3, S('vx_urn_white'));
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) L(EX + 7 + x, y0 - 1, EZ + 6 + z, S(x === 0 && z === 0 ? 'granite_paver' : 'water'));
  L(EX + 7, y0, EZ + 6, S('vx_fountain'));
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (Math.abs(x) === 2 || Math.abs(z) === 2) L(EX + 7 + x, y0 - 1, EZ + 6 + z, S('travertine'));
  const car = (cx, cz, col, facing) => { for (let p = 0; p < 16; p++) { const px = p & 1, py = (p >> 1) & 1, pz = p >> 2; const along = facing === 'north' || facing === 'south'; const dx = along ? px : pz, dz = along ? pz : px; L(cx + dx, y0 + py, cz + dz, S('vx_car_' + col, { facing, part: 'p' + p })); } };
  car(EX + 12, EZ + 4, 'red', 'north'); car(EX + 15, EZ + 4, 'black', 'north'); car(EX + 18, EZ + 6, 'white', 'east');
  for (let x = 0; x <= 12; x += 3) L(EX + x, y0, EZ + 12, S('vx_bollard'));
  for (let x = 0; x <= 5; x++) for (let y = 0; y < 3; y++) L(EX + x, y0 + y, EZ + 16, S('garage_door'));
  for (let x = 7; x <= 10; x++) for (let y = 0; y < 3; y++) L(EX + x, y0 + y, EZ + 16, S('wood_slat', { axis: 'y' }));
  for (let x = 12; x <= 15; x++) for (let y = 0; y < 3; y++) L(EX + x, y0 + y, EZ + 16, S(y === 2 ? 'window_warm' : 'charcoal_panel'));
  for (let x = 17; x <= 24; x++) for (let z = 14; z <= 18; z++) L(EX + x, y0 - 1, EZ + z, S(x >= 19 && x <= 22 && z >= 15 && z <= 17 ? 'water' : 'pool_tile'));
  for (const [x, y, z, s] of list) w.setBlock(x, y, z, s, 0);
  return { x0, y0, z0, n: list.length };
});
console.log('site', JSON.stringify(site));
await settle(60); await step(30);
const view = async (name, pos, yaw, pitch, tod) => { if (ONLY && !ONLY.includes(name)) return; await ev(([pos, yaw, pitch, tod]) => { const g = VR.game, p = g.player; p.flying = true; p.teleport(pos[0], pos[1], pos[2]); p.yaw = yaw; p.pitch = pitch; g.env.setTime(tod); }, [pos, yaw, pitch, tod]); await settle(20); await step(12); await shot(name); };
const { x0, y0, z0 } = site;
await view('hk_living', [x0 + 11.5, y0 + 1.6, z0 + 14.2], 0.9, -0.08, 12500);
await view('hk_kitchen', [x0 + 6, y0 + 1.6, z0 + 6.6], 0, -0.08, 12500);
await view('hk_bed', [x0 + 14.5, y0 + 1.5, z0 + 6.5], 0, -0.08, 12500);
await view('hk_bath', [x0 + 19.5, y0 + 1.5, z0 + 6.5], -0.25, -0.08, 12500);
await view('hk_outside', [x0 + 40, y0 + 5, z0 - 6], Math.PI, -0.3, 6000);
await view('hk_front', [x0 + 12, y0 + 3, z0 + 30], 0, -0.1, 12500);
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
verify(!logs.some(l => /pageerror\]/.test(l)), 'no page errors');
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
