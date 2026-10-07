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
await ev(`VR.game.createWorld({name:'LifeKit',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '424242'}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; });

let fails = 0; const verify = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
// ---- 1. every required block exists
const REQUIRED = [
  'vx_fruit_crown_apple', 'vx_fruit_crown_orange', 'vx_fruit_crown_cherry', 'vx_fruit_crown_plum', 'vx_fruit_trunk', 'vx_trough', 'vx_scarecrow', 'vx_pumpkin_pile', 'vx_veg_crate',
  'vx_milk_can', 'vx_wheelbarrow', 'vx_beehive', 'vx_birdbath', 'vx_mailbox', 'vx_picnic_table', 'vx_windmill_sail', 'vx_flowerbed', 'vx_flowerbed_roses', 'vx_flowerbed_tulips',
  'vx_laundry_line', 'vx_barn_door',
  ...['fruit', 'veg', 'bakery', 'pantry', 'drinks', 'snacks', 'cereal', 'sweets', 'dairy', 'flowers', 'tech', 'toys', 'home', 'pharmacy'].map(c => 'vx_shop_shelf_' + c),
  'vx_shop_fridge_drinks', 'vx_shop_fridge_dairy', 'vx_shop_freezer', 'vx_shop_produce', 'vx_shop_deli', 'vx_shop_bakery_case', 'vx_shop_checkout', 'vx_shop_checkout_end',
  'vx_shop_selfcheckout', 'vx_shop_cart_bay', 'vx_shop_basket_stack', 'vx_shop_sign', 'vx_shop_aisle_sign', 'vx_shop_floor', 'vx_shop_light', 'vx_shop_door', 'vx_shop_promo', 'vx_shop_flower_stand',
];
const check = await ev((names) => {
  const R = VR.R, out = { missing: [], info: {} };
  for (const n of names) {
    const t = R.byName[n];
    if (!t) { out.missing.push(n); continue; }
    out.info[n] = { group: t.group, cat: t.cat, props: t.props.map(p => p.name + ':' + p.n).join(','), solid: !!(R.T.flags[t.defaultState] & VR.F.SOLID), light: R.T.emit[t.defaultState] || 0 };
  }
  // icons & boxes for every state of the new blocks (catches painter exceptions)
  let icons = 0, errs = [];
  for (const n of names) {
    const t = R.byName[n]; if (!t) continue;
    for (let s = t.base; s < t.base + t.nstates; s++) { try { VR.VX.iconGrid(s); VR.VX.boxes(s, false); VR.VX.boxes(s, true); icons++; } catch (e) { errs.push(n + ': ' + e.message); } }
  }
  // door collision: closed pane vs open (no boxes)
  const D = R.byName.vx_shop_door;
  const cl = VR.VX.boxes(D.state({ facing: 0, open: 0 }), false).length, op = VR.VX.boxes(D.state({ facing: 0, open: 1 }), false).length;
  const opSel = VR.VX.boxes(D.state({ facing: 0, open: 1 }), true).length;
  out.icons = icons; out.errs = errs.slice(0, 10); out.door = { closedBoxes: cl, openBoxes: op, openSel: opSel };
  return out;
}, REQUIRED);
console.log('required blocks:', REQUIRED.length, 'missing:', check.missing.length ? check.missing.join(', ') : 'none');
console.log('states painted (icons+boxes):', check.icons, 'errors:', check.errs.length ? check.errs.join(' | ') : 'none');
console.log('door boxes:', JSON.stringify(check.door));
verify(check.missing.length === 0, 'every required block exists');
verify(check.errs.length === 0, 'every block paints its icon and boxes');
verify(check.door.closedBoxes > 0 && check.door.openBoxes === 0, 'a closed shop door has collision boxes, an open one none');
if (process.env.VERBOSE) for (const n in check.info) console.log('  ', n, JSON.stringify(check.info[n]));

// ---- 2. build the showcase (load the chunks around the site first so late terrain generation can't overwrite it)
await ev(() => { const g = VR.game, p = g.player; p.flying = true; p.teleport(p.pos[0] + 66, 100, p.pos[2] + 4); });
await settle(80); await step(20);
await ev(() => { const g = VR.game, p = g.player; p.teleport(p.pos[0] - 66, 100, p.pos[2] - 4); });
await settle(40);
const site = await ev(() => {
  const g = VR.game, p = g.player, w = g.world, R = VR.R;
  const S = (n, props) => { const t = R.byName[n]; if (!t) throw new Error('no block ' + n); let s = t.defaultState; for (const k in (props || {})) s = t.with(s, k, props[k]); return s; };
  const x0 = Math.floor(p.pos[0]) + 40, z0 = Math.floor(p.pos[2]) - 10;
  const y0 = 90;
  const list = [];
  const L = (x, y, z, s) => list.push([x, y, z, typeof s === 'string' ? S(s) : s]);
  for (let x = -4; x < 56; x++) for (let z = -4; z < 34; z++) { for (let y = y0 - 2; y < y0 + 14; y++) L(x0 + x, y, z0 + z, 0); L(x0 + x, y0 - 1, z0 + z, S(x < 24 ? 'stone' : 'grass_block')); }
  // ============ SUPERMARKET (x 0..21, z 0..17), front (doors) on the south side
  const MX = x0, MZ = z0, CAT = ['fruit', 'veg', 'bakery', 'pantry', 'drinks', 'snacks', 'cereal', 'sweets', 'dairy', 'flowers', 'tech', 'toys', 'home', 'pharmacy'];
  for (let x = 0; x <= 21; x++) for (let z = 0; z <= 17; z++) {
    L(MX + x, y0 - 1, MZ + z, S('vx_shop_floor'));
    L(MX + x, y0 + 5, MZ + z, S('vx_plaster_white'));
    const edge = x === 0 || x === 21 || z === 0 || z === 17;
    if (edge) for (let y = 0; y < 5; y++) L(MX + x, y0 + y, MZ + z, S(y === 4 ? 'vx_tech_band' : 'vx_plaster_white'));
  }
  // back wall: drinks & dairy fridges (2 high), deli, bakery
  for (let x = 2; x <= 6; x++) for (let y = 0; y < 2; y++) L(MX + x, y0 + y, MZ + 1, S('vx_shop_fridge_drinks', { facing: 'south' }));
  for (let x = 7; x <= 10; x++) for (let y = 0; y < 2; y++) L(MX + x, y0 + y, MZ + 1, S('vx_shop_fridge_dairy', { facing: 'south' }));
  for (let x = 12; x <= 14; x++) L(MX + x, y0, MZ + 1, S('vx_shop_deli', { facing: 'south' }));
  for (let x = 15; x <= 17; x++) L(MX + x, y0, MZ + 1, S('vx_shop_bakery_case', { facing: 'south' }));
  for (let x = 4; x <= 12; x++) L(MX + x, y0 + 3, MZ + 1, S('vx_shop_sign', { facing: 'south' }));
  // two aisles of back-to-back shelves (2 high), every category
  for (let x = 3; x <= 9; x++) for (let y = 0; y < 2; y++) {
    L(MX + x, y0 + y, MZ + 4, S('vx_shop_shelf_' + CAT[x - 3], { facing: 'north' }));
    L(MX + x, y0 + y, MZ + 5, S('vx_shop_shelf_' + CAT[x + 4], { facing: 'south' }));
    L(MX + x, y0 + y, MZ + 8, S('vx_shop_shelf_' + CAT[(x + 1) % 14], { facing: 'north' }));
    L(MX + x, y0 + y, MZ + 9, S('vx_shop_shelf_' + CAT[(x + 8) % 14], { facing: 'south' }));
  }
  // produce stands, freezer island, promo, flowers
  for (let x = 12; x <= 15; x++) L(MX + x, y0, MZ + 5, S('vx_shop_produce', { facing: 'south' }));
  for (let x = 12; x <= 14; x++) for (let z = 8; z <= 9; z++) L(MX + x, y0, MZ + z, S('vx_shop_freezer'));
  L(MX + 17, y0, MZ + 8, S('vx_shop_promo', { facing: 'west' }));
  L(MX + 18, y0, MZ + 11, S('vx_shop_flower_stand', { facing: 'west' }));
  L(MX + 19, y0, MZ + 12, S('vx_shop_flower_stand', { facing: 'west' }));
  // checkouts (cashier behind, customers on the south side), self checkouts, carts, baskets
  L(MX + 3, y0, MZ + 13, S('vx_shop_checkout', { facing: 'south' })); L(MX + 4, y0, MZ + 13, S('vx_shop_checkout', { facing: 'south' })); L(MX + 5, y0, MZ + 13, S('vx_shop_checkout_end', { facing: 'south' }));
  L(MX + 7, y0, MZ + 13, S('vx_shop_checkout', { facing: 'south' })); L(MX + 8, y0, MZ + 13, S('vx_shop_checkout_end', { facing: 'south' }));
  L(MX + 11, y0, MZ + 13, S('vx_shop_selfcheckout', { facing: 'south' })); L(MX + 12, y0, MZ + 13, S('vx_shop_selfcheckout', { facing: 'south' }));
  for (let x = 15; x <= 18; x++) L(MX + x, y0, MZ + 15, S('vx_shop_cart_bay', { facing: 'south' }));
  L(MX + 20, y0, MZ + 15, S('vx_shop_basket_stack')); L(MX + 20, y0, MZ + 14, S('vx_shop_basket_stack'));
  // light strips & aisle signs under the ceiling
  for (const z of [3, 7, 11, 15]) for (let x = 2; x <= 19; x++) L(MX + x, y0 + 4, MZ + z, S('vx_shop_light', { head: 1 }));
  L(MX + 6, y0 + 4, MZ + 6, S('vx_shop_aisle_sign', { n: 0 })); L(MX + 6, y0 + 4, MZ + 10, S('vx_shop_aisle_sign', { n: 1 })); L(MX + 11, y0 + 4, MZ + 6, S('vx_shop_aisle_sign', { n: 2 }));
  // sliding doors in the front wall: one open double door, one closed double door (2 high)
  for (let y = 0; y < 2; y++) { L(MX + 9, y0 + y, MZ + 17, S('vx_shop_door', { facing: 'south', open: 1 })); L(MX + 10, y0 + y, MZ + 17, S('vx_shop_door', { facing: 'south', open: 1 })); }
  for (let y = 0; y < 2; y++) { L(MX + 14, y0 + y, MZ + 17, S('vx_shop_door', { facing: 'south' })); L(MX + 15, y0 + y, MZ + 17, S('vx_shop_door', { facing: 'south' })); }
  // outside: store sign over the entrance, carts and a planter
  for (let x = 6; x <= 17; x++) L(MX + x, y0 + 3, MZ + 18, S('vx_shop_sign', { facing: 'south' }));
  for (let x = 2; x <= 4; x++) L(MX + x, y0, MZ + 19, S('vx_shop_cart_bay', { facing: 'east' }));
  // a sign on the east wall long enough to cross a chunk-section boundary (tests the sign's fallback pattern)
  for (let z = 2; z <= 14; z++) L(MX + 22, y0 + 3, MZ + z, S('vx_shop_sign', { facing: 'east' }));
  // ============ FARM YARD (x 26..52, z 0..30)
  const FX = x0 + 26, FZ = z0;
  const tree = (x, z, f, h) => { for (let y = 0; y < h; y++) L(FX + x + 1, y0 + y, FZ + z + 1, S('vx_fruit_trunk')); for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let y = 0; y < 2; y++) L(FX + x + a, y0 + h + y, FZ + z + b, S('vx_fruit_crown_' + f)); };
  tree(0, 1, 'apple', 2); tree(5, 2, 'orange', 2); tree(10, 1, 'cherry', 3); tree(15, 2, 'plum', 2);
  L(FX + 21, y0, FZ + 4, S('vx_fruit_trunk')); L(FX + 21, y0 + 1, FZ + 4, S('vx_fruit_crown_apple'));
  // barn wall with a 2×3 barn door and a 3×3 windmill sail
  for (let x = 0; x <= 16; x++) for (let y = 0; y < 5; y++) L(FX + x, y0 + y, FZ + 12, S('vx_siding_red'));
  for (let x = 2; x <= 3; x++) for (let y = 0; y < 3; y++) L(FX + x, y0 + y, FZ + 12, S('vx_barn_door', { facing: 'south' }));
  for (let x = 9; x <= 11; x++) for (let y = 1; y <= 3; y++) L(FX + x, y0 + y, FZ + 13, S('vx_windmill_sail', { facing: 'south' }));
  // props
  for (let x = 0; x <= 2; x++) L(FX + x, y0, FZ + 16, S('vx_trough', { facing: 'south' }));
  L(FX + 4, y0, FZ + 16, S('vx_scarecrow', { facing: 'south' }));
  L(FX + 6, y0, FZ + 16, S('vx_pumpkin_pile')); L(FX + 7, y0, FZ + 16, S('vx_pumpkin_pile')); L(FX + 7, y0, FZ + 17, S('vx_pumpkin_pile'));
  for (let x = 9; x <= 11; x++) L(FX + x, y0, FZ + 16, S('vx_veg_crate', { facing: 'south' })); L(FX + 10, y0 + 1, FZ + 16, S('vx_veg_crate', { facing: 'south' }));
  L(FX + 13, y0, FZ + 16, S('vx_milk_can')); L(FX + 14, y0, FZ + 16, S('vx_milk_can')); L(FX + 13, y0, FZ + 17, S('vx_milk_can'));
  L(FX + 16, y0, FZ + 16, S('vx_wheelbarrow', { facing: 'west' }));
  L(FX + 19, y0, FZ + 9, S('vx_beehive')); L(FX + 20, y0, FZ + 9, S('vx_beehive')); L(FX + 21, y0, FZ + 9, S('vx_beehive'));
  L(FX + 19, y0, FZ + 14, S('vx_birdbath')); L(FX + 21, y0, FZ + 17, S('vx_mailbox', { facing: 'south' }));
  L(FX + 1, y0, FZ + 21, S('vx_picnic_table', { facing: 'south' })); L(FX + 2, y0, FZ + 21, S('vx_picnic_table', { facing: 'south' }));
  for (let x = 5; x <= 10; x++) for (let z = 20; z <= 21; z++) L(FX + x, y0, FZ + z, S(x <= 6 ? 'vx_flowerbed_roses' : x <= 8 ? 'vx_flowerbed_tulips' : 'vx_flowerbed'));
  for (let x = 13; x <= 18; x++) L(FX + x, y0, FZ + 21, S('vx_laundry_line', { facing: 'south' }));
  for (const [x, y, z, s] of list) w.setBlock(x, y, z, s, 0);
  return { x0, y0, z0, n: list.length };
});
console.log('site', JSON.stringify(site));
await settle(60); await step(30);
const view = async (name, pos, yaw, pitch, tod) => { if (ONLY && !ONLY.includes(name)) return; await ev(([pos, yaw, pitch, tod]) => { const g = VR.game, p = g.player; p.flying = true; p.teleport(pos[0], pos[1], pos[2]); p.yaw = yaw; p.pitch = pitch; g.env.setTime(tod); }, [pos, yaw, pitch, tod]); await settle(20); await step(12); await shot(name); };
const { x0, y0, z0 } = site;
const FX = x0 + 26;
// yaw convention: yaw 0 looks toward -z (north), yaw +π/2 toward -x (west)
await view('life_shop_interior', [x0 + 16.5, y0 + 2.6, z0 + 15.5], 0.55, -0.22, 6000);
await view('life_shop_interior_night', [x0 + 16.5, y0 + 2.6, z0 + 15.5], 0.55, -0.22, 18000);
await view('life_shop_aisle', [x0 + 10.5, y0 + 0.1, z0 + 7.0], 1.35, -0.1, 6000);
await view('life_shop_shelves_close', [x0 + 6.0, y0 - 0.3, z0 + 7.6], 0.0, -0.12, 6000);
await view('life_shop_back', [x0 + 16.5, y0 + 0.3, z0 + 3.4], 1.05, -0.06, 6000);
await view('life_shop_deli', [x0 + 11.0, y0 + 0.3, z0 + 3.6], -0.75, -0.2, 6000);
await view('life_shop_lanes', [x0 + 2.5, y0 + 0.4, z0 + 15.8], -0.7, -0.3, 6000);
await view('life_shop_east_sign', [x0 + 30, y0 + 3.2, z0 + 8.5], Math.PI / 2 + 0.0, -0.05, 12800);
await view('life_shop_checkout', [x0 + 6.5, y0 + 2.4, z0 + 16.2], -0.35, -0.35, 6000);
await view('life_shop_front', [x0 + 11.5, y0 + 3.0, z0 + 27], 0, -0.08, 12800);
await view('life_farm_day', [FX + 11, y0 + 7, z0 + 30], 0, -0.3, 4200);
await view('life_farm_props', [FX + 9, y0 + 2.6, z0 + 22], 0.1, -0.3, 5000);
await view('life_farm_trees', [FX + 9, y0 + 3.2, z0 + 10.5], 0.0, -0.05, 4800);
await view('life_farm_yard', [FX + 11, y0 + 2.5, z0 + 26], 0.0, -0.3, 5200);
await view('life_farm_barn_dusk', [FX + 7, y0 + 1.2, z0 + 20], 0.0, 0.05, 12600);
await view('life_farm_night', [FX + 11, y0 + 7, z0 + 30], 0, -0.3, 18500);
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 30)) console.log(l);
verify(!logs.some(l => /pageerror\]/.test(l)), 'no page errors');
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
