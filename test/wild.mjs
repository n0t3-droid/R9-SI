// t-wild · WOW VI · Die Tierwelt als Spektakel (docs/superpowers/plans/2026-10-16-t-wild.md) — the pictures and the cost.
// One page of this build (seed 53, a new default world, High as a player gets it, the dynamic resolution held off, the
// view distance 8), each shot framed in the page from where the animals are (wildlife.js report()), then pictured twice
// with the same camera: the five switches on (test/shots/wild_<shot>_on.png) and off — the v0.48 look (…_off.png):
//   murm     the murmuration at the golden hour over the lake, from the shore 150-190 from the cloud; murm_close: 70 from it
//   heron    a heron in a lily pond's shallows (and carp, dragonflies); heron_fly: the eye within 7 — it takes off
//   shoal    the shoal under the pier, from the pier's end, the sun high
//   bfly     a butterfly swarm on a flower drift; bfly_rise: walking through it, the near ones rise
//   rays     the Himmelsrochen under and between the isles, from the beach (afternoon); rays_dusk: their lines and trails
//   lake     the release's lake view (wow48_lake: the beach, the isles; gulls, rays where they are)
//   deer     the deer's line at dawn crossing the meadow from a wood's edge
// → test/shots/wild_sheet.jpg (off | on per shot) and test/shots/wild.json (per shot: the camera, what the report saw).
// The cost on High (the release's lake view and the murmuration's): the actor's CPU per piece (its moving averages),
// its instanced draws and instances, and the frame with all five switches off against on (ms with the GPU drained,
// draws, triangles; the median of ROUNDS rounds of N frames, in turns).
// Very Low: this build's page and the build before's (BEFORE_DIST, default .tmp_tests/before_dist — the v0.48 base) side by
// side at the release's meadow view: not slower (median ≤ ×1.05, or the lower half's, or triangles ≤ ×1.03); on Very
// Low the five switches are off, the actor is off, no program is compiled.
//   nohup bash test/wt_run.sh wild.mjs 3000 > .tmp_tests/wild.log 2>&1 &
//   ONLY=murm,heron · NO_COST=1 · NO_POTATO=1 · ROUNDS=5 · N=12 · SEED=53
// regress: skip  (a showcase: the pictures and the numbers are the evidence; the gates are test/wild_sim.js and test/wild_game.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
// (every path from this checkout: the test runs from test/ or from .tmp_tests/ — one level under the root either way)
const ROOT = new URL('../', import.meta.url).pathname;
const SEED = process.env.SEED || '53', N = +(process.env.N || 12), ROUNDS = +(process.env.ROUNDS || 5);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const DIST = process.env.DIST || 'file://' + ROOT + 'dist/index.html';
const BEFORE = process.env.BEFORE_DIST || 'file://' + ROOT + '.tmp_tests/before_dist/index.html';
const SHOTS = ROOT + 'test/shots/';
const EYE = 1.62, RD = 8;
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const want = (n) => !ONLY || ONLY.includes(n);

// ---------------------------------------------------------------- the places (node: the shared code, the same seed)
const PL = {};
{
  const V = require(ROOT + 'test/load_shared.js');
  const g = V.makeGen('overworld', +SEED, { vgen: 11 }), L = V.Land, P = L.plan(g), SEA = V.C.SEA;
  const ponds = P.pieces.filter(p => p.kind === 'pond').sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  const pier = P.pieces.find(p => p.kind === 'pier');
  PL.pond = ponds[0]; PL.pier = pier; PL.lake = L.LAKE; PL.sea = SEA;
  PL.pasture = P.pieces.find(p => p.kind === 'pasture' && p.farm === 'farm_c');
  // the deer: an anchor whose line (the game's own W.deerPath over the generated blocks) leads 18 blocks and more into
  // the open, the nearest to the origin
  require(ROOT + 'src/main/wildsim.js'); global.window = global.window || {}; global.performance = global.performance || { now: () => Date.now() };
  require(ROOT + 'src/main/wildgpu.js'); require(ROOT + 'src/main/wildlife.js');
  const CH = new Map(), blk = (x, y, z) => { y = Math.floor(y); if (y < 0 || y > 255) return 0; const X = Math.floor(x), Z = Math.floor(z), k = (X >> 4) + ',' + (Z >> 4); let c = CH.get(k); if (!c) { c = g.generate(X >> 4, Z >> 4); CH.set(k, c); } return c.blocks[(y << 8) | ((Z & 15) << 4) | (X & 15)]; };
  const RT = V.R.T, FL = V.F;
  const top = (x, z) => { for (let y = 200; y > 30; y--) { const b = blk(x, y, z); if (b && (RT.flags[b] & (FL.SOLID | FL.LEAVES | FL.FLUID)) && !(RT.flags[b] & FL.REPLACE)) return y; } return 0; };
  const W2 = { getBlock: blk, topAt: top, isLoaded: () => true };
  const deer = [];
  for (let gz = -6; gz <= 6; gz++) for (let gx = -6; gx <= 6; gx++) { const a = L.deerAt(g, P, gx, gz); if (a) deer.push(a); }
  deer.sort((a, b) => Math.hypot(a[0], a[2]) - Math.hypot(b[0], b[2]));
  for (const a of deer.slice(0, 14)) { const path = V.Wild.deerPath(W2, { x: a[0], y: a[1], z: a[2] }, (+SEED) | 0); if (path && path.L >= 18) { PL.deer = { x: a[0], y: a[1], z: a[2], n: a[3], path: path.pts, L: path.L }; break; } }
  console.log('places', JSON.stringify({ pond: PL.pond && [PL.pond.x, PL.pond.y, PL.pond.z, +PL.pond.r.toFixed(1)], pier: PL.pier && [PL.pier.x, PL.pier.y, PL.pier.z, PL.pier.dir.map(v => +v.toFixed(2))], deer: PL.deer && [PL.deer.x, PL.deer.y, PL.deer.z, PL.deer.n, +PL.deer.L.toFixed(0)], deerTried: deer.length }));
}
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });

// ---------------------------------------------------------------- a page with a world (motion.mjs's machinery)
async function openWorld(dist, preset) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|missing/i.test(s)) logs.push(`[${t}] ${s.slice(0, 500)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
  page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log('  !! the page crashed'); });
  await page.goto(dist);
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
  const boost = (on) => ev((on) => { const g = VR.game, q = g.renderer && g.renderer.q; if (!q) return; if (on) { if (q.__up === undefined) q.__up = q.upload; q.upload = 24; } else if (q.__up !== undefined) { q.upload = q.__up; delete q.__up; } }, on);
  const settle = async (max = 60, farMax = 30) => {
    let s = null;
    await boost(true);
    for (let i = 0; i < max; i++) {
      await step(20, 16);
      s = await ev(() => { const g = VR.game, w = g.world, p = g.player, rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if (sc.dirty || sc.pending) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= rd * rd) dirty += n; } let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } const h = g.horizon, f = h && h.far, fr = f && f.report ? f.report() : null; return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown, hz: h ? h.inflight : 0, far: fr ? fr.inflight + fr.want : 0 }; });
      const near = s.busy === 0 && s.pend === 0 && s.dirty === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0;
      s.i = i;
      if (near && i > 2 && ((s.hz === 0 && s.far === 0) || i >= farMax)) break;
      await wait(30);
    }
    await boost(false);
    return s;
  };
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(([p, rd]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; if (rd) g.settings.renderDist = rd; g.applySettings('*'); }, [preset, preset === 'potato' ? 0 : RD]);
  await ev(`VR.game.createWorld({name:'Tierwelt',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
  for (let i = 0; i < 150; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  const ok = await ev(() => VR.game.state) === 'play';
  await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.wx.force('klar'); window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui', 'hints']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } if (!document.getElementById('__nohint')) { const st = document.createElement('style'); st.id = '__nohint'; st.textContent = '#hint,#hints,#lockhint{display:none !important}'; document.head.appendChild(st); } });
  const groundY = (x, z) => ev(([x, z]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = 200; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & (F.OPAQUE | F.FLUID)) && !(R.T.flags[s] & F.LEAVES)) return y; } return 80; }, [x, z]);
  // the eye at (x, eyeY, z) looking at (tx, ty, tz)
  const look = (x, eyeY, z, tx, ty, tz, fov, tod) => ev(([x, y, z, tx, ty, tz, fov, tod]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y - 1.62, z); const dx = tx - x, dy = ty - y, dz = tz - z; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.fovKick = 0; p.vel = [0, 0, 0]; g.settings.fov = fov; if (tod !== null) g.env.setTime(tod); }, [x, eyeY, z, tx, ty, tz, fov, tod === undefined ? null : tod]);
  const picture = async (path, frames = 4) => {
    await ev((frames) => { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, frames);
    try { await page.bringToFront(); } catch (e) { /* (two pages open for the cost) */ }
    for (let k = 0; k < 2; k++) {
      try { await page.screenshot({ path, timeout: 150000 }); return true; } catch (e) {
        const alive = await Promise.race([ev(() => Math.round(performance.now())).then(() => 'answers', () => 'error'), wait(20000).then(() => 'silent')]);
        console.log(`  !! screenshot ${path.replace(/^.*\//, '')} failed (${String(e.message || e).split('\n')[0].slice(0, 120)}); the page ${alive}`);
        if (alive !== 'answers') throw e;
      }
    }
    return false;
  };
  const wild = (on) => ev((on) => { const g = VR.game, W = VR.Wild; for (const k of W.KEYS) g.settings[k] = on; }, on);
  // how many blocks stand in the line from a to b (every half block; air, water and the water's plants see through)
  const blocked = (a, b) => ev(([a, b]) => { const w = VR.game.world, F = VR.F, T = VR.R.T; let n = 0, last = ''; const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); for (let t = 0.5; t < L - 1.2; t += 0.5) { const x = Math.floor(a[0] + (b[0] - a[0]) * t / L), y = Math.floor(a[1] + (b[1] - a[1]) * t / L), z = Math.floor(a[2] + (b[2] - a[2]) * t / L), k = x + ',' + y + ',' + z; if (k === last) continue; last = k; const s = w.getBlock(x, y, z); if (s && !(T.flags[s] & (F.FLUID | F.WATERLOG))) n++; } return n; }, [a, b]);
  const report = () => ev(() => (VR.game.wild ? VR.game.wild.report() : null));
  // the actors that come and go (ships, the director's acts, trams, the hall's craft) hold still through a pair
  const freeze = (on) => ev((on) => { const g = VR.game; if (on) { g.__frozen = []; for (const k of ['traffic', 'padLife', 'lifeDirector', 'director', 'starships', 'hall', 'trams']) { const o = g[k]; if (o && typeof o.update === 'function') { g.__frozen.push([o, 'update', o.update]); o.update = function () {}; } } } else { for (const [o, k, f] of g.__frozen || []) o[k] = f; g.__frozen = null; } }, on);
  return { ctx, page, logs, ev, wait, step, settle, groundY, look, picture, wild, report, freeze, blocked, ok };
}
const load = async (path) => { const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, w: info.width, h: info.height }; };
const diff = (A, B) => { let s = 0, big = 0; const n = A.w * A.h; for (let i = 0, p = 0; i < n; i++, p += 3) { const d = Math.abs(A.d[p] - B.d[p]) + Math.abs(A.d[p + 1] - B.d[p + 1]) + Math.abs(A.d[p + 2] - B.d[p + 2]); s += d; if (d > 24) big++; } return { mean: +(s / n / 3).toFixed(3), share: +(big / n).toFixed(4) }; };

// ---------------------------------------------------------------- the shots
const rec = { seed: SEED, dist: DIST, places: PL, shots: [], cost: null, potato: null };
const recPath = SHOTS + 'wild.json', save = () => { try { fs.writeFileSync(recPath, JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };
const A = await openWorld(DIST, 'high');
check(A.ok, `the world is loaded on High (${secs()})`);
const meta = await A.ev(() => { const g = VR.game, s = g.settings; return { vgen: g.meta.vgen, preset: s.preset, wild: VR.Wild.KEYS.map(k => s[k]), actor: !!g.wild }; });
console.log('world', JSON.stringify(meta));
check(meta.actor && meta.wild.every(v => v === true), `High: the actor is there and the five switches are on (${meta.wild.join(' ')})`);
await A.settle(80);
// a shot: set up (returns the camera, or null), then the pair on/off with the same camera
async function shot(name, setup, extra) {
  if (!want(name)) return;
  const t0 = Date.now(), out = { name };
  try {
    await A.wild(true); await A.freeze(false);
    const cam = await setup(out);
    if (!cam) { out.error = out.error || 'no camera'; console.log(`  !! ${name}: ${out.error}`); rec.shots.push(out); save(); return; }
    out.cam = cam;
    await A.freeze(true);
    await A.look(cam.x, cam.y, cam.z, cam.tx, cam.ty, cam.tz, cam.fov || 70, null);
    await A.step(4);
    out.report = await A.report();
    await A.picture(`${SHOTS}wild_${name}_on.png`, 4);
    if (extra) await extra(out);
    await A.wild(false); await A.step(3);
    await A.look(cam.x, cam.y, cam.z, cam.tx, cam.ty, cam.tz, cam.fov || 70, null);
    await A.picture(`${SHOTS}wild_${name}_off.png`, 4);
    await A.wild(true); await A.freeze(false);
    const F = [await load(`${SHOTS}wild_${name}_on.png`), await load(`${SHOTS}wild_${name}_off.png`)];
    out.diff = diff(F[0], F[1]);
    out.ms = Date.now() - t0;
    console.log(`  ${name}: ${JSON.stringify(out.diff)} · ${(out.ms / 1000).toFixed(0)} s (${secs()}) · ${JSON.stringify(out.report).slice(0, 600)}`);
  } catch (e) { out.error = String(e.message || e).split('\n')[0].slice(0, 300); console.log(`  !! ${name}: ${out.error}`); try { await A.wild(true); await A.freeze(false); } catch (e2) { /* */ } }
  rec.shots.push(out); save();
}
// travel: fly there, the chunks settled
const go = async (x, y, z, tod) => { await A.ev(([x, y, z, tod]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); if (tod !== null) g.env.setTime(tod); }, [x, y, z, tod === undefined ? null : tod]); await A.settle(150, 8); };

// 1 the murmuration at the golden hour over the lake: from the shore (the beach west of the lake), 150-190 blocks from the
// cloud — the whole of it against the evening sky, the lake and the isles behind; then 70 from it (murm_close: the birds)
await shot('murm', async (out) => {
  await go(235, 75, 35, 11600);
  await A.step(900);   // (30 s: the flock comes in from afar and swirls round its stage)
  let r = await A.report();
  if (!r || !r.murm) { out.error = 'no murmuration'; return null; }
  const c = r.murm.ctr, bx = 205 - c[0], bz = 10 - c[2], bl = Math.hypot(bx, bz) || 1, dd = Math.min(bl, 170);
  const ex = c[0] + bx / bl * dd, ez = c[2] + bz / bl * dd, gy = await A.groundY(ex, ez);
  out.murm = r.murm;
  return { x: ex, y: Math.max(gy + 1 + EYE + 1, PL.sea + 3), z: ez, tx: c[0], ty: c[1] + 4, tz: c[2], fov: 70 };
}, async (out) => {
  const r = await A.report(); if (!r || !r.murm) return;
  const c = r.murm.ctr, cam = out.cam, bx = cam.x - c[0], bz = cam.z - c[2], bl = Math.hypot(bx, bz) || 1;
  const ex = c[0] + bx / bl * 70, ez = c[2] + bz / bl * 70, gy = await A.groundY(ex, ez), ey = Math.max(gy + 1 + EYE + 1, PL.sea + 3);
  out.murmClose = { cam: [+ex.toFixed(1), +ey.toFixed(1), +ez.toFixed(1)], ctr: c, spread: r.murm.spread };
  await A.look(ex, ey, ez, c[0], c[1], c[2], 70, null); await A.step(2);
  await A.picture(`${SHOTS}wild_murm_close_on.png`, 4);
});
// 2 the heron at the nearest lily pond (and carp, dragonflies), morning; then within 7 — it takes off
await shot('heron', async (out) => {
  const P0 = PL.pond; if (!P0) { out.error = 'no pond'; return null; }
  await go(P0.x + 40, P0.y + 6, P0.z, 3600);
  await A.step(150);
  let r = await A.report();
  const h = r && r.herons && r.herons[0];
  if (!h) { out.error = 'no heron: ' + JSON.stringify(r && { herons: r.herons, cap: r.cap.heron }); return null; }
  out.heron = h;
  // the clearest view of it from 9-13 blocks (sixteen places round it; the fewest blocks — reeds, bamboo, a bank —
  // between the eye and the bird; over the pond's water first)
  let best = null;
  for (const dd of [10, 12.5, 9]) for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2, ex = h.pos[0] + Math.cos(a) * dd, ez = h.pos[2] + Math.sin(a) * dd, gy = await A.groundY(ex, ez), ey = Math.max(gy + 1 + EYE + 0.4, h.pos[1] + 1.8);
    const n = await A.blocked([ex, ey, ez], [h.pos[0], h.pos[1] + 1.0, h.pos[2]]), score = n * 10 + Math.abs(ey - (h.pos[1] + 2.4));
    if (!best || score < best.score) best = { score, n, ex, ey, ez };
    if (best.n === 0 && best.score < 2) break;
  }
  out.heronView = { blocked: best.n, at: [+best.ex.toFixed(1), +best.ey.toFixed(1), +best.ez.toFixed(1)] };
  return { x: best.ex, y: best.ey, z: best.ez, tx: h.pos[0], ty: h.pos[1] + 0.9, tz: h.pos[2], fov: 58 };
}, async (out) => {
  // within 7: it takes off — the camera stays, the eye (the player) steps in; 2.4 s later, mid-air
  const h = out.heron, cam = out.cam;
  await A.ev(([x, y, z]) => { const p = VR.game.player; p.teleport(x, y, z); }, [h.pos[0] + 4, cam.y - EYE, h.pos[2] + 3]);
  await A.step(75);
  const r = await A.report(), h2 = r.herons[0];
  out.heronFly = h2 || null;
  if (h2) { await A.look(cam.x, cam.y, cam.z, h2.pos[0], h2.pos[1] + 0.8, h2.pos[2], 62, null); await A.picture(`${SHOTS}wild_heron_fly_on.png`, 4); }
});
// 3 the shoal under the pier, from its end, the sun high
await shot('shoal', async (out) => {
  const Pi = PL.pier; if (!Pi) { out.error = 'no pier'; return null; }
  const ux = Pi.dir[0], uz = Pi.dir[1];
  await go(Pi.x - ux * 3, Pi.y + 6, Pi.z - uz * 3, 6000);
  await A.step(120);
  const r = await A.report(), s = r && r.shoals && (r.shoals.find(q => !q.key.startsWith('eye:')) || r.shoals[0]);
  if (!s) { out.error = 'no shoal: ' + JSON.stringify(r && r.shoals); return null; }
  out.shoal = s;
  return { x: Pi.x - ux * 2.5, y: Pi.y + 1 + EYE, z: Pi.z - uz * 2.5, tx: s.ctr[0], ty: s.ctr[1], tz: s.ctr[2], fov: 66 };
});
// 4 the butterflies on a flower drift near the meadow; then walking through them
await shot('bfly', async (out) => {
  await go(240, 90, -120, 5200);
  await A.step(120);
  const r = await A.report(), sw = r && r.swarms && r.swarms[0];
  if (!sw) { out.error = 'no swarm (drifts ' + (r && r.drifts) + ')'; return null; }
  out.swarm = sw;
  const [hx, hy, hz] = sw.home, ex = hx - 6, ez = hz - 3, gy = await A.groundY(ex, ez);
  return { x: ex, y: gy + 1 + EYE, z: ez, tx: hx, ty: hy + 0.8, tz: hz, fov: 66 };
}, async (out) => {
  // walking through: the player steps into the drift (1.6 blocks a step), the camera with it
  const [hx, hy, hz] = out.swarm.home, cam = out.cam;
  for (let k = 0; k < 4; k++) {
    const u = (k + 1) / 5, x = cam.x + (hx - cam.x) * u, z = cam.z + (hz - cam.z) * u;
    await A.ev(([x, y, z]) => { const p = VR.game.player; p.teleport(x, y, z); p.vel = [2.2, 0, 1.1]; }, [x, cam.y - EYE, z]);
    await A.step(10);
  }
  const r = await A.report(); out.rise = r.swarms[0] ? r.swarms[0].up : 0;
  await A.ev(() => { VR.game.player.vel = [0, 0, 0]; });
  const p = await A.ev(() => VR.game.player.pos.slice());
  await A.look(p[0] - (hx - cam.x) * 0.25, p[1] + EYE, p[2] - (hz - cam.z) * 0.25, hx, hy + 1.6, hz, 70, null);
  await A.picture(`${SHOTS}wild_bfly_rise_on.png`, 3);
});
// 5 the rays between the isles: from over the lake, the nearest ray framed (afternoon), then their lines at dusk
// (from the beach where the release's lake view stands: the isles over the lake, the rays gliding under and between them;
// the nearest pair framed when it comes within 80-170 — the game runs on until one does)
const rayShot = (name, tod) => shot(name, async (out) => {
  const ex = 201.5, ez = 6.5;
  await go(ex, 70, ez, tod);
  const ey = (await A.groundY(ex, ez)) + 1 + EYE;
  let r = null, best = null;
  for (let k = 0; k < 24 && !best; k++) {
    await A.step(60);
    r = await A.report();
    if (!r || !r.rays || !r.rays.length) continue;
    let bd = 1e9; for (let i = 0; i < r.rays.length; i += 2) { const R = r.rays[i], d = Math.hypot(R[0] - ex, R[2] - ez); if (d > 80 && d < 170 && d < bd) { bd = d; best = R; } }
  }
  if (!r || !r.rays || !r.rays.length) { out.error = 'no rays'; return null; }
  if (!best) best = r.rays[0];
  out.ray = best; out.rays = r.rays;
  return { x: ex, y: ey, z: ez, tx: best[0], ty: best[1] + 2, tz: best[2], fov: 62 };
});
await rayShot('rays', 9800);
await rayShot('rays_dusk', 13300);
// 6 the release's lake view (wow48_lake: the beach, the isles above): gulls, the rays where they are
await shot('lake', async () => {
  await go(201.5, 66, 6.5, 10800);
  await A.step(120);
  return { x: 201.5, y: 64 + EYE, z: 6.5, tx: 201.5 - Math.sin(-2.49) * 50, ty: 64 + EYE - 0.02 * 50, tz: 6.5 - Math.cos(-2.49) * 50, fov: 70 };
});
// 7 the deer's line at dawn: the anchor's group comes, the leader walks out; the camera from the side of the line
await shot('deer', async (out) => {
  const D = PL.deer; if (!D) { out.error = 'no deer anchor with an open line'; return null; }
  const end = D.path[D.path.length - 1], mx = (D.x + end[0]) / 2, mz = (D.z + end[1]) / 2, dx = end[0] - D.x, dz = end[1] - D.z, dl = Math.hypot(dx, dz) || 1;
  const ex = mx - dz / dl * 20, ez = mz + dx / dl * 20;
  await go(ex, D.y + 8, ez, 23300);
  await A.step(60);
  // the group comes (landlife once a second) and the line forms; 9 s of walking
  let lined = 0;
  for (let k = 0; k < 6 && !lined; k++) { await A.step(60); lined = await A.ev(() => { const E = VR.game.entities; return E ? E.mobs.filter(m => m.line).length : 0; }); }
  await A.step(270);
  const deer = await A.ev(() => VR.game.entities.mobs.filter(m => m.kind === 'glimmer_deer').map(m => ({ pos: m.pos.map(v => +v.toFixed(1)), line: !!m.line, li: m.li, graze: !!m.graze })));
  out.deer = deer; out.lined = lined;
  if (!deer.length) { out.error = 'no deer came'; return null; }
  let cx = 0, cy = 0, cz = 0; for (const d of deer) { cx += d.pos[0]; cy += d.pos[1]; cz += d.pos[2]; } cx /= deer.length; cy /= deer.length; cz /= deer.length;
  const gy = await A.groundY(ex, ez);
  return { x: ex, y: gy + 1 + EYE + 1, z: ez, tx: cx, ty: cy + 0.9, tz: cz, fov: 58 };
});

// ---------------------------------------------------------------- the sheet: off | on per shot (and the extras)
try {
  const rows = [];
  for (const s of rec.shots) if (!s.error && fs.existsSync(`${SHOTS}wild_${s.name}_on.png`)) rows.push([s.name, `${SHOTS}wild_${s.name}_off.png`, `${SHOTS}wild_${s.name}_on.png`]);
  for (const [n, p] of [['murm_close', 'wild_murm_close_on.png'], ['heron_fly', 'wild_heron_fly_on.png'], ['bfly_rise', 'wild_bfly_rise_on.png']]) if (fs.existsSync(SHOTS + p)) rows.push([n, null, SHOTS + p]);
  const Wc = 640, Hc = 360, comps = [];
  for (let i = 0; i < rows.length; i++) {
    const [n, off, on] = rows[i];
    for (const [k, p] of [[0, off], [1, on]]) if (p) comps.push({ input: await sharp(p).resize(Wc, Hc).toBuffer(), left: k * Wc, top: i * Hc });
    const svg = `<svg width="${Wc * 2}" height="${Hc}"><style>.t{font:bold 22px sans-serif;fill:#fff;stroke:#000;stroke-width:3px;paint-order:stroke}</style><text x="12" y="30" class="t">${n} · off (v0.48)</text><text x="${Wc + 12}" y="30" class="t">${n} · on (t-wild)</text></svg>`;
    comps.push({ input: Buffer.from(svg), left: 0, top: i * Hc });
  }
  if (rows.length) await sharp({ create: { width: Wc * 2, height: Hc * rows.length, channels: 3, background: { r: 20, g: 22, b: 30 } } }).composite(comps).jpeg({ quality: 82 }).toFile(SHOTS + 'wild_sheet.jpg');
  console.log(`sheet: ${rows.length} rows → test/shots/wild_sheet.jpg`);
} catch (e) { console.log('  !! no sheet: ' + String(e.message || e).slice(0, 200)); }

// the shots' checks: each one framed, the picture changed where the animals are
for (const s of rec.shots) check(!s.error, `${s.name}: framed and pictured (test/shots/wild_${s.name}_on.png | _off.png)${s.error ? ' — ' + s.error : ''}`);
const sm = rec.shots.find(s => s.name === 'murm');
if (sm && sm.report && sm.report.murm) check(sm.report.murm.n >= 240 && sm.diff && sm.diff.share > 0.002, `the murmuration: ${sm.report.murm.n} birds, ${(sm.diff ? sm.diff.share * 100 : 0).toFixed(2)} % of the picture changed`);
const sh = rec.shots.find(s => s.name === 'heron');
if (sh && !sh.error) check(!!sh.heronFly && sh.heronFly.state !== 'stand', `the heron takes off within 7 (${sh.heronFly ? sh.heronFly.state : '—'})`);
const sb = rec.shots.find(s => s.name === 'bfly');
if (sb && !sb.error) check((sb.rise || 0) >= 5, `walking through the drift, ${sb.rise || 0} butterflies rise`);
const sd = rec.shots.find(s => s.name === 'deer');
if (sd && !sd.error) check(sd.lined >= 2, `the deer walk in a line (${sd.lined} in it; ${JSON.stringify(sd.deer).slice(0, 200)})`);

// ---------------------------------------------------------------- the cost on High: the actor, and the frame off against on
if (!process.env.NO_COST) {
  try {
    const out = {};
    for (const [label, x, y, z, tod, yaw, pitch] of [['lake', 201.5, 64, 6.5, 10800, -2.49, -0.02], ['murm', 235, 72, 35, 11600, -2.4, 0.18]]) {
      await A.ev(([x, y, z, tod, yaw, pitch]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = yaw; p.pitch = pitch; g.env.setTime(tod); }, [x, y, z, tod, yaw, pitch]);
      await A.settle(100, 6); await A.wild(true); await A.step(300);
      const measure = (n) => A.ev((n) => new Promise((ok, no) => { const g = VR.game, gl = g.renderer.gl; window.__norender = false; let k = -2, sum = 0, d = 0, t = 0; const f = () => { try { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); const dt = performance.now() - t0; if (k < 0) { k++; setTimeout(f, 0); return; } const st = g.renderer.stats || {}; sum += dt; d += st.draws || 0; t += st.tris || 0; if (++k < n) setTimeout(f, 0); else { window.__norender = true; ok({ ms: +(sum / n).toFixed(2), draws: Math.round(d / n), tris: Math.round(t / n) }); } } catch (e) { no(String(e)); } }; f(); }), n);
      const R = { on: [], off: [] };
      for (let r = 0; r < ROUNDS; r++) for (const on of r & 1 ? [false, true] : [true, false]) { await A.wild(on); await A.step(2); R[on ? 'on' : 'off'].push(await measure(N)); }
      await A.wild(true); await A.step(30);
      const rep = await A.report();
      const med = (a, k) => { const v = a.map(q => q[k]).sort((p, q) => p - q); return v[v.length >> 1]; };
      out[label] = { on: { ms: med(R.on, 'ms'), draws: med(R.on, 'draws'), tris: med(R.on, 'tris') }, off: { ms: med(R.off, 'ms'), draws: med(R.off, 'draws'), tris: med(R.off, 'tris') }, actor: { ms: rep.ms, drawMs: rep.drawMs, draws: rep.draws, inst: rep.inst, murm: rep.murm ? rep.murm.n : 0, rays: rep.rays.length, gulls: rep.gulls, fish: rep.fish, swarms: rep.swarms.length } };
      console.log(`cost on High · ${label}: ${JSON.stringify(out[label])}`);
      const a = out[label].actor, cpu = Object.values(a.ms).reduce((p, q) => p + q, 0);
      check(cpu + a.drawMs < 3.0, `High · ${label}: the actor's CPU ${cpu.toFixed(2)} ms (update) + ${a.drawMs} ms (draw) a frame on SwiftShader's CPU (per piece ${JSON.stringify(a.ms)})`);
      check(out[label].on.draws - out[label].off.draws <= 8, `High · ${label}: ${out[label].on.draws - out[label].off.draws} draws more with the animals (${a.draws} instanced, ${a.inst} instances)`);
    }
    rec.cost = out; save();
  } catch (e) { check(false, 'the cost on High is measured: ' + String(e.message || e).slice(0, 300)); }
}
const errs = A.logs.filter(l => l.startsWith('[pageerror]'));
console.log(`--- logs (${A.logs.length})`); for (const l of A.logs.slice(0, 14)) console.log(l);
check(errs.length === 0, `no page error (${errs.length})`);
check(!A.logs.some(l => /shader|compile|link/i.test(l)), 'every shader compiles');
await A.ctx.close();

// ---------------------------------------------------------------- Very Low against the build before (the release's meadow view)
if (!process.env.NO_POTATO) {
  const pages = [];
  try {
    const s = { x: 226.5, feet: 81.38, z: -122.15, yaw: -0.61, pitch: -0.03, tod: 6000 };
    const place = async (Pg) => { await Pg.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 150, z); }, [s.x, s.z]); await Pg.settle(60, 6); await Pg.ev(([x, y, z, yaw, pitch, tod]) => { const g = VR.game, p = g.player; p.teleport(x, y, z); p.yaw = yaw; p.pitch = pitch; g.env.setTime(tod); }, [s.x, s.feet, s.z, s.yaw, s.pitch, s.tod]); const st = await Pg.settle(200, 200); await Pg.step(6); console.log(`  · Very Low settled ${JSON.stringify(st)} (${secs()})`); };
    const P2 = await openWorld(DIST, 'potato'); check(P2.ok, `this build on Very Low (${secs()})`); pages.push(['after', P2]); await place(P2);
    const vl = await P2.ev(() => { const g = VR.game, s = g.settings; return { sw: VR.Wild.KEYS.map(k => s[k]), on: g.wild ? g.wild.on : null, prog: g.renderer.P.wild === undefined ? 'none' : 'compiled', rep: g.wild ? g.wild.report() : null }; });
    check(vl.sw.every(v => !v) && vl.on === false && vl.prog === 'none' && vl.rep && vl.rep.inst === 0, `Very Low: the five switches off, the actor off, no program compiled, nothing drawn (${JSON.stringify({ sw: vl.sw, on: vl.on, prog: vl.prog })})`);
    try { await P2.picture(`${SHOTS}wild_potato_meadow_after.png`, 6); } catch (e) { console.log('  !! no Very Low picture'); }
    const B = await openWorld(BEFORE, 'potato'); check(B.ok, `the build before on Very Low (${secs()})`); pages.push(['before', B]); await place(B);
    const measure = (Pg, n) => Pg.ev((n) => new Promise((ok, no) => { const g = VR.game, gl = g.renderer.gl; window.__norender = false; let k = -2, sum = 0, d = 0, t = 0; const f = () => { try { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); const dt = performance.now() - t0; if (k < 0) { k++; setTimeout(f, 0); return; } const st = g.renderer.stats || {}; sum += dt; d += st.draws || 0; t += st.tris || 0; if (++k < n) setTimeout(f, 0); else { window.__norender = true; ok({ ms: +(sum / n).toFixed(2), draws: Math.round(d / n), tris: Math.round(t / n) }); } } catch (e) { no(String(e)); } }; f(); }), n);
    const rounds = {};
    for (let r = 0; r < ROUNDS + 2; r++) { const order = r & 1 ? pages.slice().reverse() : pages; for (const [lbl, Pg] of order) (rounds[lbl] = rounds[lbl] || []).push(await measure(Pg, 16)); }
    const out = {};
    for (const lbl of Object.keys(rounds)) { const ms = rounds[lbl].map(q => q.ms).sort((a, b) => a - b), mid = rounds[lbl][rounds[lbl].length >> 1], lo = ms.slice(0, Math.ceil(ms.length / 2)); out[lbl] = { msMedian: ms[ms.length >> 1], msLow: +(lo.reduce((a, b) => a + b, 0) / lo.length).toFixed(2), ms, draws: mid.draws, tris: mid.tris }; }
    if (out.before && out.after) { out.ratio = +(out.after.msMedian / out.before.msMedian).toFixed(3); out.lowRatio = +(out.after.msLow / out.before.msLow).toFixed(3); out.trisRatio = +(out.after.tris / out.before.tris).toFixed(3); }
    rec.potato = out; save();
    console.log(`very low · meadow: ${JSON.stringify(out)}`);
    if (out.ratio) check(out.ratio <= 1.05 || out.lowRatio <= 1.05 || out.trisRatio <= 1.03, `Very Low is not slower than v0.48 (median ${out.after.msMedian} ms against ${out.before.msMedian}: ×${out.ratio}; the lower half ×${out.lowRatio}; triangles ×${out.trisRatio}; draws ${out.after.draws} against ${out.before.draws})`);
    if (out.after && out.before) check(out.after.draws === out.before.draws, `Very Low draws the same (${out.after.draws} against ${out.before.draws})`);
    for (const [lbl, Pg] of pages) { const e = Pg.logs.filter(l => l.startsWith('[pageerror]')); check(e.length === 0, `${lbl} (Very Low): no page error (${e.length})`); await Pg.ctx.close(); }
  } catch (e) { check(false, 'Very Low is measured: ' + String(e.message || e).slice(0, 300)); for (const [, Pg] of pages) { try { await Pg.ctx.close(); } catch (e2) { /* */ } } }
}
await browser.close();
save();
console.log(`(${secs()})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
