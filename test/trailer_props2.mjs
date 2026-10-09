// Echte Möbel, round II (t-smooth2): the furnished rooms with NO voxel piece left in view — the villa's living room, its
// dining zone, its kitchen (fridge, dishwasher, range hood), its master bedroom (wardrobes, curtains, mirror, dresser), the
// mansion's grand hall and its dining wing (the vx_ pieces of gen_modern.js), Villa Nova's white hall (shot G: t1_29,
// t1_30, t2_28, t3_10), a village bedroom (wardrobe, curtains, lantern, rug), a showroom of every new piece in three bays,
// the villa's pool and a lake shore with palms (the water's planar reflection draws the props). Seed 4242, vgen 7,
// preset high (renderDist 8, no far ring), by day. Every place is shot twice in one world: `voxel` = Glatte Pflanzen /
// Möbel off (the voxel pieces, what Very Low shows) and `<TAG>` = on (the smooth props). The settings change in the
// running game (the loaded world is remeshed), so both pictures stand at the same camera and light.
// Also measured: the frame cost of the living room with the props off and on, the cost of the props in the water's
// reflection at the pool and the lake (renderer.noReflProps on / off, High), and — with OLD_DIST naming the v042 build —
// the Very Low (potato) frame cost of both builds side by side, frames alternating (AGENTS.md rule 5).
// Writes test/shots/trailer_props2_<place>_{voxel,<TAG>}.png
//   nohup bash test/wt_run.sh trailer_props2.mjs 3600 > .tmp_tests/trailer_props2.log 2>&1 &
//   TAG=before|after|run3 · DIST=… (the build to shoot) · OLD_DIST=… (the potato comparison) · VOXEL=all|some|none
//   ONLY=place,place (a subset) · N frames per cost round
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { mkdirSync, existsSync } from 'fs';
const TAG = process.env.TAG || 'after', SEED = process.env.SEED || '4242', VGEN = +(process.env.VGEN || 7), PRESET = process.env.PRESET || 'high';
const DAY = +(process.env.DAY || 6500), W = +(process.env.W || 1296), H = +(process.env.H || 704), N = +(process.env.N || 5);
const DIST = process.env.DIST || '/home/claude/vr/dist/index.html';
const OLD_DIST = process.env.OLD_DIST || '';
const VOXEL = process.env.VOXEL || 'all';
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
const OUT = '/home/claude/vr/test/shots';
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- the sites (world blocks; y0 = the floor level, the ground block at y0 − 1)
const Y0 = 86;
const VILLA = { n: 0, ox: -256, oz: -128 };                 // Villa R9 180 (blacklabel): open-plan living / dining / kitchen, master bedroom upstairs, a pool
const MANSION = { ox: -256, oz: -175 };                     // gen_modern.js MOD.mansion (31 × 19): the grand hall, the dining wing, the library
const NOVA = { ox: -300, oz: -175 };                        // Villa Nova (catalogue 11, 25 × 31): the white hall of shot G
const SX = -298, SZ = -86;                                  // the showroom (south of the villa): the back wall at SZ − 1, three bays and the village room
const LAKE = { x0: -292, z0: -110, x1: -277, z1: -101 };    // a pond west of the villa: palms, loungers, a planter, a monstera and a sofa on its far bank
// the showroom: [name, x, dy, z, facing, part] — a VM model is placed by the corner of its footprint (its smallest x, z),
// a block by its cell (a two-part block: part 0 below, part 1 above)
const SHOW = [
  // bay 1 · kitchen and bath (x 0–16), fronts to +z, the back wall behind
  ['vm_fridge', 0, 0, 0, 2], ['vm_kitchen_white_hob', 1, 0, 0, 2], ['vm_range_hood', 1, 2, 0, 2], ['vm_dishwasher', 2, 0, 0, 2], ['vm_kitchen_white_sink', 3, 0, 0, 2],
  ['vm_kitchen_white_upper', 3, 2, 0, 2], ['vm_kitchen_fridge_french', 4, 0, 0, 2], ['vm_kitchen_shelf', 2, 1, 0, 2],
  ['vx_kitchen_sink', 6, 0, 0, 2], ['vx_kitchen_hob', 7, 0, 0, 2], ['vx_kitchen_island', 8, 0, 0, 2], ['vx_upper_cabinet', 6, 2, 0, 2], ['vx_upper_cabinet', 7, 2, 0, 2], ['vx_upper_cabinet', 8, 2, 0, 2],
  ['vx_fridge', 9, 0, 0, 2, 0], ['vx_fridge', 9, 1, 0, 2, 1], ['vx_vanity', 11, 0, 0, 2], ['vx_mirror', 11, 1, 0, 2], ['vx_toilet', 12, 0, 0, 2], ['vx_bathtub', 13, 0, 0, 2], ['vx_bathtub', 14, 0, 0, 2],
  ['vm_vanity', 15, 0, 0, 2], ['vm_toilet', 16, 0, 0, 2], ['vx_kitchen_island_dark', 7, 0, 3, 0], ['vx_kitchen_island_dark', 8, 0, 3, 0], ['vx_stool', 7, 0, 4], ['vx_stool_orange', 8, 0, 4],
  ['vx_tall_plant', 0, 0, 3], ['vx_tall_plant_black', 16, 0, 3],
  // bay 2 · living and study (x 19–33): a sideboard with art, desks, a TV wall, a bookcase, wall art, an L-sofa round a
  // 3 × 4 rug with an armchair and a coffee table standing on it (the rug continues under them)
  ['vm_sideboard', 19, 0, 0, 2], ['vm_art_landscape', 20, 1, 0, 2], ['vm_desk', 22, 0, 0, 2], ['vm_office_chair', 22, 0, 1, 0], ['vx_tech_desk', 24, 0, 0, 2], ['vx_tech_desk', 25, 0, 0, 2],
  ['vx_school_desk', 27, 0, 0, 2], ['vx_tv_wall', 28, 0, 0, 2], ['vx_tv_wall', 29, 0, 0, 2], ['vx_bookshelf', 31, 0, 0, 2], ['vx_bookshelf', 31, 1, 0, 2], ['vx_bookshelf_walnut', 32, 0, 0, 2], ['vx_bookshelf_walnut', 32, 1, 0, 2],
  ['vm_art_abstract', 23, 1, 0, 2], ['vx_art_warm', 24, 1, 0, 2], ['vx_art_cool', 26, 1, 0, 2], ['vx_art_gold', 27, 1, 0, 2], ['vx_sconce', 25, 1, 0, 2], ['vm_art_photo', 30, 1, 0, 2], ['vm_wall_shelf', 33, 1, 0, 2],
  ['vx_sofa_corner_cream', 24, 0, 4, 2], ['vx_sofa_cream', 23, 0, 4, 2], ['vx_sofa_cream', 22, 0, 4, 2], ['vx_sofa_cream', 24, 0, 5, 3], ['vx_sofa_cream', 24, 0, 6, 3],
  ['vx_rug_blue', 20, 0, 5], ['vx_rug_blue', 21, 0, 5], ['vx_rug_blue', 22, 0, 5], ['vx_rug_blue', 20, 0, 6], ['vx_rug_blue', 22, 0, 6], ['vx_rug_blue', 20, 0, 7], ['vx_rug_blue', 21, 0, 7],
  ['vx_rug_blue', 20, 0, 8], ['vx_rug_blue', 21, 0, 8], ['vx_rug_blue', 22, 0, 8], ['vm_armchair_sage', 21, 0, 6, 1], ['vx_coffee_table_marble', 22, 0, 7, 0],
  ['vx_coffee_table', 26, 0, 3, 0], ['vx_dining_table', 28, 0, 4, 1], ['vx_dining_table', 28, 0, 5, 1], ['vx_dining_table', 28, 0, 6, 1], ['vx_dining_chair', 27, 0, 4, 1], ['vx_dining_chair', 27, 0, 6, 1],
  ['vx_dining_chair_teal', 29, 0, 5, 3], ['vx_dining_table_white', 31, 0, 4, 0], ['vx_bench', 31, 0, 6, 0], ['vx_urn_white', 33, 0, 3],
  // bay 3 · bedroom (x 36–52): wardrobes, curtains beside two windows, a mirror, a dresser with a round mirror, a bench,
  // lights under a beam (chandelier, lanterns, pendants)
  ['vm_wardrobe', 36, 0, 0, 2], ['vm_wardrobe_walnut', 38, 0, 0, 2], ['vx_wardrobe', 40, 0, 0, 2, 0], ['vx_wardrobe', 40, 1, 0, 2, 1], ['vx_wardrobe_walnut', 41, 0, 0, 2, 0], ['vx_wardrobe_walnut', 41, 1, 0, 2, 1],
  ['vm_curtain', 42, 0, 0, 2], ['vm_curtain', 45, 0, 0, 2], ['vx_curtain', 46, 0, 0, 2, 0], ['vx_curtain', 46, 1, 0, 2, 1], ['vx_curtain_grey', 49, 0, 0, 2, 0], ['vx_curtain_grey', 49, 1, 0, 2, 1],
  ['vm_mirror', 50, 0, 0, 2], ['vm_dresser', 51, 0, 0, 2], ['vm_mirror_round', 51, 1, 0, 2], ['vx_nightstand', 53, 0, 0, 2], ['vm_bench', 37, 0, 4, 0], ['vm_bed_single', 39, 0, 4, 2],
  ['vx_chandelier', 38, 3, 3], ['vx_lantern', 41, 3, 3], ['vx_lantern_crystal', 43, 3, 3], ['vx_pendant', 45, 3, 3], ['vx_pendant_brass', 47, 3, 3], ['vx_floorlamp', 52, 0, 3], ['vx_arc_lamp', 49, 0, 4, 2],
];
const WINDOWS = [[43, 44], [47, 48]];                       // bay 3: window openings in the back wall (glass, two high)
// the village bedroom (x 56–63, z 0–6, walls round it, a window in the back wall, a ceiling slab, the front open to +z)
const VROOM = { x0: 56, x1: 63, z0: 0, z1: 6 };
const VILLAGE = [['vx_bed_blue', 58, 0, 1, 0, 0], ['vx_bed_blue', 58, 0, 0, 0, 1], ['vx_nightstand', 57, 0, 0, 2], ['vx_nightstand', 59, 0, 0, 2],
  ['vx_curtain', 60, 0, 0, 2, 0], ['vx_curtain', 60, 1, 0, 2, 1], ['vx_curtain', 63, 0, 0, 2, 0], ['vx_curtain', 63, 1, 0, 2, 1],
  ['vx_wardrobe', 63, 0, 3, 3, 0], ['vx_wardrobe', 63, 1, 3, 3, 1], ['vx_wardrobe', 63, 0, 4, 3, 0], ['vx_wardrobe', 63, 1, 4, 3, 1],
  ['vx_rug_red', 57, 0, 3], ['vx_rug_red', 58, 0, 3], ['vx_rug_red', 59, 0, 3], ['vx_rug_red', 57, 0, 4], ['vx_rug_red', 59, 0, 4], ['vx_rug_red', 57, 0, 5], ['vx_rug_red', 58, 0, 5], ['vx_rug_red', 59, 0, 5],
  ['vx_table', 58, 0, 4], ['vx_lantern', 59, 3, 3], ['vx_art_warm', 56, 1, 3, 1], ['vx_bookshelf', 61, 0, 6, 0], ['vx_potplant', 56, 0, 6]];
const VWIN = [61, 62];

// ---------------------------------------------------------------- the cameras: eye → target (or {yaw, pitch} from the feet, run 1 of round I), time
const CAMS = [
  ['living', { feet: [-220.5, 87, -106.5], yaw: 0.7854, pitch: -0.1 }],          // round I's living camera: the reading corner, the sofa group, the TV wall, the curtain, the kitchen far left
  ['living2', { eye: [-224.5, 89.85, -117.55], at: [-225.5, 87.2, -110.5] }],     // over the TV, looking down: the coffee table on its rug, armchairs, sofa, chaise, the dining zone (run 1 stood beside the floor lamp)
  ['dining', { feet: [-235.5, 87, -109.5], yaw: 5.1051, pitch: -0.08 }],         // round I's dining camera: the oak table under the chandelier, art, bar cart
  ['kitchen', { eye: [-238.5, 88.62, -112.5], at: [-240.5, 88.2, -106] }],        // the black kitchen: sink, dishwasher, hob under the range hood, the fridge, the island
  ['bedroom', { eye: [-224.5, 93.62, -114.5], at: [-222.5, 92.9, -106] }],        // the master bedroom: wardrobes, the curtain by the glass, dresser and round mirror, armchair
  ['hall', { eye: [-240.5, 88.62, -170.6], at: [-240.5, 90, -158] }],            // the mansion's grand hall: reception desk, fountain, urns, sconces, gold art, chandeliers
  ['mdining', { eye: [-247.5, 88.62, -167.5], at: [-253.5, 88, -160] }],          // the mansion's dining wing: the long table, chairs, chandeliers, tall plants, the kitchen run
  ['nova', { eye: [-287, 88.4, -166.6], at: [-287.5, 88.6, -155] }],              // Villa Nova's hall from the foyer (t3_10): the glass wall, the pad, plants
  ['show1', { eye: [SX + 8.5, Y0 + 2.2, SZ + 9.5], at: [SX + 8.5, Y0 + 1, SZ + 0.5] }],   // bay 1
  ['show2', { eye: [SX + 26.5, Y0 + 2.4, SZ + 11], at: [SX + 26.5, Y0 + 0.8, SZ + 2] }],  // bay 2
  ['show3', { eye: [SX + 44.5, Y0 + 2.2, SZ + 9.5], at: [SX + 44.5, Y0 + 1.6, SZ + 0.5] }],// bay 3
  ['vroom', { eye: [SX + 62.4, Y0 + 1.7, SZ + 6.4], at: [SX + 58.5, Y0 + 0.8, SZ + 0.5] }],// the village bedroom
  ['pool', { eye: [-236.6, 87.3, -97.6], at: [-226.5, 86.9, -101] }],            // over the pool's west end, low: the water, the path lights, the palm and its reflection (run 1's camera stood behind the lounger, its ray met the deck before the water: no reflection)
  ['lake', { eye: [-284.5, 86.9, -100.2], at: [-284.5, 89.5, -116] }],            // the pond: palms, loungers and a sofa on its banks, mirrored
];
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'];
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  x ' + msg); } else console.log('  ok ' + msg); };
const logs = [];
const browser = await chromium.launch({ channel: 'chromium', args: ARGS });

// a page on one build, at the title (the boot of trailer_props.mjs)
async function open(dist, tag) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|shader/i.test(s)) logs.push(`[${tag} ${t}] ${s.slice(0, 600)}`); });
  page.on('pageerror', e => logs.push(`[${tag} pageerror] ` + (e.stack || e.message).slice(0, 1200)));
  const P = { ctx, page, ev: (fn, arg) => page.evaluate(fn, arg), wait: (ms) => page.waitForTimeout(ms) };
  await page.goto('file://' + dist);
  for (let i = 0; i < 120; i++) { await P.wait(500); if (await P.ev(() => VR.game && VR.game.state === 'title')) break; }
  return P;
}
async function world(P, name) {
  await P.ev(`VR.game.createWorld({name:'${name}',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',vgen:${VGEN},cheats:true,kit:true})`);
  for (let i = 0; i < 120; i++) { await P.wait(1000); if (await P.ev(() => VR.game.state) === 'play') break; }
}
// the frozen frame: the game's own loop is stopped, the frames are the test's; no HUD, no hints, no people (the props are the subject)
async function freeze(P, t) {
  await P.ev((t) => {
    const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; g.hideHud = true;
    const h = document.getElementById('hud'); if (h) h.style.display = 'none';
    const st = document.createElement('style'); st.textContent = '#hints, #hint, #aqhint, .toast, #toasts { display: none !important; }'; document.head.appendChild(st);
    window.requestAnimationFrame = () => 0; const R = g.renderer; R._render = R.render;
    R.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); };
    window.__norender = true; g.env.setTime(t);
    if (g.villages) g.villages.draw = () => {};
    if (VR.Crowd) VR.Crowd.draw = () => {};
  }, t);
}
const step = (P, n, dtms = 50) => P.ev(([m, d]) => { const g = VR.game; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [n, dtms]);
async function settle(P, max = 90) {
  let quiet = 0;
  for (let i = 0; i < max; i++) {
    await step(P, 3, 50); await P.wait(250);
    const s = await P.ev(() => { const g = VR.game, w = g.world, b = g.pool.busy; const q = w.uploadQ || {}, u = typeof q.size === 'number' ? q.size : typeof q.count === 'number' ? q.count : typeof q.length === 'number' ? q.length : 0; return { p: w.pending ? w.pending.size : 0, b: typeof b === 'number' ? b : (b && b.size) || 0, u }; });
    if (s.p === 0 && s.b === 0 && s.u === 0) { if (++quiet >= 3) return i; } else quiet = 0;
  }
  return max;
}
// a camera: the eye and its target (yaw 0 looks along −z, pitch up positive), or the feet with a yaw and a pitch
async function aim(P, cam, t, max) {
  let feet, yaw, pitch;
  if (cam.eye) { const [ex, ey, ez] = cam.eye, [tx, ty, tz] = cam.at; feet = [ex, ey - 1.62, ez]; yaw = Math.atan2(-(tx - ex), -(tz - ez)); pitch = Math.atan2(ty - ey, Math.hypot(tx - ex, tz - ez)); }
  else { feet = cam.feet; yaw = cam.yaw; pitch = cam.pitch; }
  await P.ev(([p, y, pt, t]) => { const g = VR.game, pl = g.player; pl.flying = true; pl.noclip = true; pl.teleport(p[0], p[1], p[2]); pl.yaw = y; pl.pitch = pt; pl.fovKick = 0; g.settings.fov = 70; g.env.setTime(t); const e = g.entities; if (e && e.mobs) e.mobs.length = 0; }, [feet, yaw, pitch, t || DAY]);
  return settle(P, max);
}
// one picture (the frame is drawn for the screenshot), then the prop state of that frame
async function shot(P, name) {
  await P.ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; });
  await P.page.screenshot({ path: `${OUT}/${name}.png`, timeout: 180000 });
  console.log('  shot ' + name);
  return P.ev(() => { const r = VR.game.renderer, q = r.q, s = r.stats; return { plants: q.smoothProps | 0, furn: q.smoothFurn | 0, secs: r.propSecs ? r.propSecs.size : -1, na: r.propNA | 0, nb: r.propNB | 0, nf: r.propNF | 0, draws: s.draws, tris: s.tris, refl: !!r.reflOn, reflMs: +(s.reflMs || 0).toFixed(1), reflDraws: s.reflDraws | 0, reflProps: s.reflProps | 0 }; });
}
const setProps = async (P, on) => { await P.ev((on) => { const g = VR.game; g.settings.smoothPlants = on ? 2 : 0; g.settings.smoothFurn = on ? 1 : 0; g.applySettings('*'); }, on); return settle(P, 200); };
// the frame cost inside the page (plants_cost.mjs): warm frames, then n frames with the GPU drained after each one
const measure = (n, warm = 2) => new Promise((res, rej) => {
  const g = VR.game, gl = g.renderer.gl, px = new Uint8Array(4);
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = () => 0;
  const finish = (fn, v) => { window.requestAnimationFrame = raf; window.__norender = true; fn(v); };
  let k = -warm, sum = 0, draws = 0, tris = 0, refl = 0; const all = [];
  window.__norender = false;
  const frame = () => {
    try {
      const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now());
      gl.finish(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const dt = performance.now() - t0;
      if (k < 0) { k++; setTimeout(frame, 0); return; }
      const st = g.renderer.stats || {};
      sum += dt; draws += st.draws || 0; tris += st.tris || 0; refl += st.reflMs || 0; all.push(dt);
      if (++k < n) setTimeout(frame, 0);
      else { all.sort((a, b) => a - b); finish(res, { ms: +(sum / n).toFixed(1), med: +all[n >> 1].toFixed(1), min: +all[0].toFixed(1), draws: Math.round(draws / n), tris: Math.round(tris / n), reflMs: +(refl / n).toFixed(1) }); }
    } catch (e) { finish(rej, String(e && e.stack || e)); }
  };
  frame();
});

// ---------------------------------------------------------------- building the sites (one evaluate: the blocks go straight into the loaded world)
async function buildSites(P, villaOnly) {
  return P.ev(([V, MANSION, NOVA, SX, SZ, Y0, SHOW, WINDOWS, VROOM, VILLAGE, VWIN, LAKE, villaOnly]) => {
    const g = VR.game, w = g.world, VG = VR.VillageGen, PLAN = VG.plan2, VM = VR.VM, R = VR.R;
    const S = (n, pr) => { const t = R.byName[n]; return t ? (pr ? t.state(pr) : t.defaultState) : 0; };
    const set = (x, y, z, s) => w.setBlock(x, y, z, s, 0);
    const out = { missing: [] };
    // flat ground: grass over dirt at y0 − 1, air above, for a box
    const ground = (x0, z0, x1, z1) => { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { for (let y = Y0 - 3; y < Y0 + 30; y++) set(x, y, z, 0); set(x, Y0 - 1, z, S('grass_block')); for (let y = Y0 - 6; y < Y0 - 1; y++) set(x, y, z, S('dirt')); } };
    const rec = (list) => (x, y, z, s) => list.push(x, y, z, s);
    const lay = (list) => { for (let k = 0; k < list.length; k += 4) set(list[k], list[k + 1], list[k + 2], list[k + 3]); return list.length / 4; };
    // the villa
    const cat = PLAN.CATALOGUE[V.n];
    ground(V.ox - 2, V.oz - 4, V.ox + cat.lot[0] + 2, V.oz + cat.lot[1] + 4);
    { const list = []; const L = VG.makeLot(rec(list), V.ox, V.oz, 0); const lot = { w: cat.lot[0], d: cat.lot[1], F: Y0, r: 0, ox: V.ox, oz: V.oz, kind: 'home' };
      const info = PLAN.build(L, lot, { rng: new VR.RNG(1000 + V.n * 17), ground: () => Y0 - 1, beds: 3 }); out.villa = lay(list); out.villaSkin = info.skin; out.pool = info.pool; }
    // a palm by the pool (its reflection), north-east of the water
    if (VR.GEN && VR.GEN.palmTree) VR.GEN.palmTree((x, y, z, n, pr) => set(x, y, z, typeof n === 'number' ? n : S(n, pr)), -228, Y0, -101, 9, new VR.RNG(5));
    if (villaOnly) return out;
    // the mansion (the town hall of a modern town)
    ground(MANSION.ox - 3, MANSION.oz - 5, MANSION.ox + 33, MANSION.oz + 20);
    { const list = []; const L = VG.makeLot(rec(list), MANSION.ox, MANSION.oz, 0); VG.modern.mansion(L, { w: 31, d: 19, F: Y0, r: 0, ox: MANSION.ox, oz: MANSION.oz, kind: 'hall' }, { rng: new VR.RNG(77), ground: () => Y0 - 1 }); out.mansion = lay(list); }
    // Villa Nova
    ground(NOVA.ox - 2, NOVA.oz - 2, NOVA.ox + 27, NOVA.oz + 33);
    { const list = []; const L = VG.makeLot(rec(list), NOVA.ox, NOVA.oz, 0); const idx = PLAN.TRAILER !== undefined ? PLAN.TRAILER : PLAN.CATALOGUE.length - 1, nc = PLAN.CATALOGUE[idx];
      PLAN.build(L, { w: nc.lot[0], d: nc.lot[1], F: Y0, r: 0, ox: NOVA.ox, oz: NOVA.oz, kind: 'home' }, { index: idx, rng: new VR.RNG(26), ground: () => Y0 - 1, beds: 3 }); out.nova = lay(list); }
    // the showroom: a marble floor, a white wall behind, window openings in bay 3, a beam for the lights, then the pieces
    ground(SX - 4, SZ - 3, SX + 66, SZ + 12);
    for (let x = SX - 2; x <= SX + 55; x++) for (let z = SZ - 1; z <= SZ + 10; z++) set(x, Y0 - 1, z, S('marble_white'));
    for (let x = SX - 2; x <= SX + 55; x++) for (let y = Y0; y <= Y0 + 3; y++) set(x, y, SZ - 1, S('stucco_white'));
    for (const [a, b] of WINDOWS) for (let x = SX + a; x <= SX + b; x++) for (let y = Y0; y <= Y0 + 1; y++) set(x, y, SZ - 1, S('window_black') || S('glass'));
    for (let x = SX + 36; x <= SX + 54; x++) set(x, Y0 + 4, SZ + 3, S('white_concrete'));
    // the village bedroom: plaster walls on three sides, a window, a timber ceiling, oak floor
    { const { x0, x1, z0, z1 } = VROOM;
      for (let x = x0 - 1; x <= x1 + 1; x++) for (let z = z0 - 1; z <= z1 + 1; z++) { set(SX + x, Y0 - 1, SZ + z, S('oak_planks') || S('marble_white')); set(SX + x, Y0 + 4, SZ + z, S('oak_planks') || S('white_concrete')); }
      for (let y = Y0; y <= Y0 + 3; y++) { for (let x = x0 - 1; x <= x1 + 1; x++) set(SX + x, y, SZ + z0 - 1, S('vx_plaster_cream') || S('stucco_white')); for (let z = z0; z <= z1; z++) { set(SX + x0 - 1, y, SZ + z, S('vx_plaster_cream') || S('stucco_white')); set(SX + x1 + 1, y, SZ + z, S('vx_plaster_cream') || S('stucco_white')); } }
      for (const x of VWIN) for (let y = Y0 + 1; y <= Y0 + 2; y++) set(SX + x, y, SZ + z0 - 1, S('glass')); }
    const place = (name, x, dy, z, f, part) => {
      const m = VM.MODELS[name];
      if (m) { const fp = VM.footprint(m, f | 0); let du = 0, dv = 0; for (const c of fp) { du = Math.min(du, c[0]); dv = Math.min(dv, c[2]); } VM.put((xx, yy, zz, nm, pr) => set(xx, yy, zz, S(nm, pr)), SX + x - du, Y0 + dy, SZ + z - dv, name, f | 0); return true; }
      const t = R.byName[name]; if (!t) { out.missing.push(name); return false; }
      const pr = {}; if (t.has('facing')) pr.facing = f | 0; if (t.has('part')) pr.part = part | 0;
      set(SX + x, Y0 + dy, SZ + z, Object.keys(pr).length ? S(name, pr) : S(name)); return true;
    };
    out.show = 0; for (const p of SHOW) if (place(...p)) out.show++;
    out.village = 0; for (const p of VILLAGE) if (place(...p)) out.village++;
    // the pond: water two deep, sand banks; two palms on the far bank, loungers, a planter, a monstera and a garden sofa on the near one
    { const { x0, z0, x1, z1 } = LAKE, water = S('water');
      ground(x0 - 3, z0 - 3, x1 + 3, z1 + 3);
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { set(x, Y0 - 1, z, water); set(x, Y0 - 2, z, water); set(x, Y0 - 3, z, S('sand')); }
      for (let x = x0 - 1; x <= x1 + 1; x++) for (const z of [z0 - 1, z1 + 1]) set(x, Y0 - 1, z, S('sand'));
      for (let z = z0; z <= z1; z++) for (const x of [x0 - 1, x1 + 1]) set(x, Y0 - 1, z, S('sand'));
      if (VR.GEN && VR.GEN.palmTree) { VR.GEN.palmTree((x, y, z, n, pr) => set(x, y, z, typeof n === 'number' ? n : S(n, pr)), x0 + 2, Y0, z0 - 2, 10, new VR.RNG(11)); VR.GEN.palmTree((x, y, z, n, pr) => set(x, y, z, typeof n === 'number' ? n : S(n, pr)), x0 + 8, Y0, z0 - 2, 8, new VR.RNG(12)); }
      const put2 = (name, x, z, f) => { const m = VM.MODELS[name]; if (m) VM.put((xx, yy, zz, nm, pr) => set(xx, yy, zz, S(nm, pr)), x, Y0, z, name, f | 0); else if (R.byName[name]) set(x, Y0, z, R.byName[name].has('facing') ? S(name, { facing: f | 0 }) : S(name)); };
      put2('vm_lounger', x0 + 4, z0 - 2, 2); put2('vm_lounger', x0 + 5, z0 - 2, 2); put2('vm_monstera', x0 + 10, z0 - 2); put2('vm_planter', x0 + 12, z0 - 2); put2('vx_sofa_white', x0 + 13, z0 - 2, 2); put2('vx_sofa_white', x0 + 14, z0 - 2, 2);
      out.lake = true; }
    return out;
  }, [VILLA, MANSION, NOVA, SX, SZ, Y0, SHOW, WINDOWS, VROOM, VILLAGE, VWIN, LAKE, !!villaOnly]);
}

const res = { tag: TAG, shots: {}, cost: {}, refl: {}, potato: {} };
const want = (name) => !ONLY || ONLY.has(name);
try {
  const P = await open(DIST, 'shoot');
  await P.ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.far = 0; g.settings.horizon = 2; g.settings.smoothPlants = 0; g.settings.smoothFurn = 0; g.applySettings('*'); }, PRESET);
  await world(P, 'Trailer props 2');
  await freeze(P, DAY);
  // the chunks round the sites first, then the sites
  await aim(P, { feet: [-262, 100, -140], yaw: 0, pitch: 0 }, DAY, 200);
  const built = await buildSites(P);
  console.log('  sites ' + JSON.stringify(built));
  check(built.villa > 2000 && built.mansion > 2000 && built.nova > 2000, `the villa (${built.villa} blocks, ${built.villaSkin}), the mansion (${built.mansion}) and Villa Nova (${built.nova}) stand`);
  check(built.show === SHOW.length && built.village === VILLAGE.length && !built.missing.length, `the showroom (${built.show} of ${SHOW.length}) and the village room (${built.village} of ${VILLAGE.length}) are furnished${built.missing.length ? ' — missing ' + built.missing.join(', ') : ''}`);
  await settle(P, 200);
  // 1. the voxel pieces (Glatte Pflanzen / Möbel off: the voxel path every preset had before, and Very Low keeps)
  const voxelSet = VOXEL === 'none' ? new Set() : VOXEL === 'some' ? new Set(['living', 'hall', 'show2', 'lake']) : null;
  console.log('phase voxel (props off)');
  for (const [name, cam] of CAMS) {
    if (!want(name) || (voxelSet && !voxelSet.has(name))) continue;
    await aim(P, cam); await step(P, 4);
    const st = await shot(P, `trailer_props2_${name}_voxel${TAG === 'before' ? '' : '_' + TAG}`);
    res.shots[name + '_voxel'] = st;
    check(st.furn === 0 && st.nf === 0, `${name} voxel: the furniture pass is off (furniture ${st.furn}, ${st.nf} pieces)`);
  }
  if (want('living')) { await aim(P, CAMS[0][1]); res.cost.off = await P.page.evaluate(measure, N); console.log('  cost living off ' + JSON.stringify(res.cost.off)); }
  // 2. the smooth props
  await setProps(P, true);
  console.log('phase smooth (props on)');
  for (const [name, cam] of CAMS) {
    if (!want(name)) continue;
    await aim(P, cam, DAY, 160); await step(P, 4);
    const st = await shot(P, `trailer_props2_${name}_${TAG}`);
    res.shots[name] = st;
    check(st.furn >= 1 && st.nf + st.na + st.nb > 0, `${name}: the prop pass is on and draws here (${st.nf} pieces, ${st.na} palms, ${st.nb} far crosses; ${st.draws} draws, ${Math.round(st.tris / 1000)} k triangles${st.refl ? `; reflection ${st.reflMs} ms, ${st.reflDraws} draws, ${st.reflProps} prop draws` : ''})`);
  }
  if (want('living')) { await aim(P, CAMS[0][1]); res.cost.on = await P.page.evaluate(measure, N); console.log('  cost living on ' + JSON.stringify(res.cost.on)); }
  // 3. the props in the water's reflection (High): at the pool and the lake, frames with the reflection's props off and on
  for (const name of ['pool', 'lake']) {
    if (!want(name)) continue;
    const cam = CAMS.find(c => c[0] === name)[1];
    await aim(P, cam, DAY, 120);
    const r = {};
    for (const off of [true, false]) { await P.ev((off) => { VR.game.renderer.noReflProps = off; }, off); await step(P, 2); r[off ? 'without' : 'with'] = await P.page.evaluate(measure, N); }
    await P.ev(() => { VR.game.renderer.noReflProps = false; });
    res.refl[name] = r;
    console.log(`  reflection ${name}: without props ${JSON.stringify(r.without)} · with props ${JSON.stringify(r.with)}`);
    check(r.with.reflMs > 0, `${name}: the planar reflection runs here (${r.with.reflMs} ms)`);
  }
  await P.ctx.close();

  // 4. Very Low (potato): the v042 build and this one side by side, frames alternating (old, new, new, old …), the villa
  // built in both pages; the paired ratio is the comparison (the machine is shared with other browser tests)
  if (OLD_DIST) {
    const Q = {}, NP = 8;
    for (const [tag, dist] of [['old', OLD_DIST], ['new', DIST]]) {
      Q[tag] = await open(dist, tag);
      await Q[tag].ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.settings.minimap = false; g.applySettings('*'); });
      await world(Q[tag], 'Props2 potato ' + tag);
      await freeze(Q[tag], DAY);
      await aim(Q[tag], { feet: [-240, 100, -115], yaw: 0, pitch: 0 }, DAY, 160);
      const b = await buildSites(Q[tag], true);
      console.log(`  potato ${tag}: villa ${b.villa} blocks`);
      await settle(Q[tag], 160);
    }
    const one = `(${measure.toString()})(1, 0)`;
    for (const name of ['living', 'kitchen', 'pool']) {
      const cam = CAMS.find(c => c[0] === name)[1];
      for (const tag of ['old', 'new']) { await aim(Q[tag], cam); await step(Q[tag], 4); await Q[tag].page.evaluate(`(${measure.toString()})(2, 1)`); }
      const t = { old: [], new: [] }, last = {};
      for (let k = 0; k < NP; k++) for (const tag of (k & 1 ? ['new', 'old'] : ['old', 'new'])) { const r = await Q[tag].page.evaluate(one); t[tag].push(r.ms); last[tag] = r; }
      const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
      const pairs = t.new.map((v, i) => v / t.old[i]), r = med(pairs);
      res.potato[name] = { old: { med: med(t.old), min: Math.min(...t.old), draws: last.old.draws, tris: last.old.tris }, new: { med: med(t.new), min: Math.min(...t.new), draws: last.new.draws, tris: last.new.tris }, pair: +r.toFixed(3) };
      console.log(`  potato ${name}: old ${t.old.map(Math.round).join(' ')} · new ${t.new.map(Math.round).join(' ')} ms`);
      check(r <= 1.06, `potato ${name}: the paired frames, new over old, median ${r.toFixed(3)}× (medians ${med(t.new).toFixed(0)} vs ${med(t.old).toFixed(0)} ms) — at most 1.06×`);
      check(last.new.draws === last.old.draws && last.new.tris === last.old.tris, `potato ${name}: the same scene in both builds (draws ${last.new.draws} / ${last.old.draws}, triangles ${last.new.tris} / ${last.old.tris})`);
    }
    for (const tag of ['old', 'new']) await Q[tag].ctx.close();
  }
  // 5. the logs: no page error, no shader error
  console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 14)) console.log(l);
  check(!logs.some(l => /pageerror/.test(l)), 'no page errors');
  check(!logs.some(l => /shader|compile|link/i.test(l)), 'no shader compile or link errors');
  console.log('RESULT ' + JSON.stringify(res));
} catch (e) {
  fails++; console.log('  x exception: ' + String(e && e.stack || e).slice(0, 1500));
  for (const l of logs.slice(0, 14)) console.log(l);
} finally {
  await browser.close();
}
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
