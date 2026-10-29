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
// f-wild2 (R50-10, docs/superpowers/plans/2026-10-23-f-wild2.md) adds: every shot settles where its camera stands (each
// column within 24 blocks shown, nothing fading, no section pending — t-wild's pictures caught flat stand-in ground) and
// re-aims at its subject after; the pictures start a fresh TSR history and the off picture shares the on picture's
// animation clock (the water's waves and the clouds the same: the pair's difference is the animals); the measures —
//   murm   the flock (the birds' switch alone) ≥ 3 % of the lake view, its dark core (luma ≤ 60 where the off picture
//          is lighter) ≥ 1 %
//   pass   the young ray's glide past the beach's cell at the day's moment, from the eye in the cell: ≥ 2 % of the frame
//   shoal  from the pier's end, the player still on the deck, the shoal at its shadow: ≥ 10 fish of ≥ 4 px
//   NO_BEFORE=1 skips the Very Low page of the build before (BEFORE_DIST); the cost lighter (ROUNDS 3 × N 8)
//   nohup bash test/wt_run.sh wild.mjs 3000 > .tmp_tests/wild.log 2>&1 &
//   ONLY=murm,heron · NO_COST=1 · NO_POTATO=1 · ROUNDS=3 · N=8 · SEED=53
// regress: skip  (a showcase: the pictures and the numbers are the evidence; the gates are test/wild_sim.js and test/wild_game.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import { createRequire } from 'module';
import fs from 'fs';
const sharp = createRequire(import.meta.url)('/home/dev/.npm-global/lib/node_modules/sharp');   // (the package's own entry: sharp 0.35 moved lib/ to dist/)
const require = createRequire(import.meta.url);
// (every path from this checkout: the test runs from test/ or from .tmp_tests/ — one level under the root either way)
const ROOT = new URL('../', import.meta.url).pathname;
const SEED = process.env.SEED || '53', N = +(process.env.N || 8), ROUNDS = +(process.env.ROUNDS || 3);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const DIST = process.env.DIST || 'file://' + ROOT + 'dist/index.html';
const BEFORE = process.env.BEFORE_DIST || 'file://' + ROOT + '.tmp_tests/before_dist/index.html';
const SHOTS = ROOT + 'test/shots/' + (process.env.SHOTS_SUB ? process.env.SHOTS_SUB + '/' : '');   // (SHOTS_SUB=before: the build before's pictures apart)
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (e) { /* */ }
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
  // the top under the Sky Isles (their rock starts at 115): the first block — leaves too — scanning down from yMax
  const below = (x, z, yMax) => ev(([x, z, yMax]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = yMax; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & (F.OPAQUE | F.FLUID | F.LEAVES | F.SOLID))) return y; } return 63; }, [x, z, yMax]);
  const groundY = (x, z) => ev(([x, z]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = 200; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & (F.OPAQUE | F.FLUID)) && !(R.T.flags[s] & F.LEAVES)) return y; } return 80; }, [x, z]);
  // the eye at (x, eyeY, z) looking at (tx, ty, tz)
  const look = (x, eyeY, z, tx, ty, tz, fov, tod) => ev(([x, y, z, tx, ty, tz, fov, tod]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y - 1.62, z); const dx = tx - x, dy = ty - y, dz = tz - z; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.fovKick = 0; p.vel = [0, 0, 0]; g.settings.fov = fov; if (tod !== null) g.env.setTime(tod); }, [x, eyeY, z, tx, ty, tz, fov, tod === undefined ? null : tod]);
  // the picture: the canvas itself, read in the task that drew it (the HUD is hidden, so it is the same picture) — run 2
  // lost 150 s to every page.screenshot on the loaded machine (the compositor's frame came only on the second try), as
  // material.mjs's runs had: no compositor frame is needed this way. (f-wild2: a fresh TSR history — no ghost of the
  // last picture; hold: start from the animation clock held for the pair, so on and off see the same waves and clouds)
  const picture = async (path, frames = 4, hold) => {
    const url = await ev(([frames, hold]) => { window.__norender = false; const g = VR.game, e = g.env; if (hold) { if (!window.__hold) window.__hold = { a: e.anim, cd: e.cloudDrift ? e.cloudDrift.slice() : null }; else { e.anim = window.__hold.a; if (window.__hold.cd && e.cloudDrift) { e.cloudDrift[0] = window.__hold.cd[0]; e.cloudDrift[1] = window.__hold.cd[1]; } } } g.renderer.tsrReset = true; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; }, [frames, !!hold]);
    await sharp(Buffer.from(url.split(',')[1], 'base64')).resize(1280, 720).png().toFile(path);
    return true;
  };
  const holdEnd = () => ev(() => { window.__hold = null; });
  // (f-wild2: on — every switch, or only the ones named: the flock's pair with the birds' switch alone)
  const wild = (on, only) => ev(([on, only]) => { const g = VR.game, W = VR.Wild; for (const k of W.KEYS) g.settings[k] = on && (!only || only.includes(k)); }, [on, only || null]);
  // (f-wild2) every column within rad blocks of the camera (the player stands there) shown, nothing fading, no section
  // pending there: t-wild's pictures caught the LOD's flat stand-in ground where a camera stood after its place had
  // settled elsewhere. → what was still missing when it gave up
  const settleNear = async (rad = 24, max = 300) => {
    let s = null;
    await boost(true);
    for (let i = 0; i < max; i++) {
      await step(10, 16);
      s = await ev((rad) => { const g = VR.game, w = g.world, p = g.player, R = Math.ceil(rad / 16), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let miss = 0, dirty = 0; for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) { const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) { miss++; continue; } for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; } return { miss, dirty, fading: w.fading ? w.fading.size : 0, busy: g.pool.busy }; }, rad);
      s.i = i;
      if (s.miss === 0 && s.dirty === 0 && s.fading === 0) break;
      await wait(30);
    }
    await boost(false);
    return s;
  };
  // how many blocks stand in the line from a to b (every half block; air, water and the water's plants see through)
  const blocked = (a, b) => ev(([a, b]) => { const w = VR.game.world, F = VR.F, T = VR.R.T; let n = 0, last = ''; const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); for (let t = 0.5; t < L - 1.2; t += 0.5) { const x = Math.floor(a[0] + (b[0] - a[0]) * t / L), y = Math.floor(a[1] + (b[1] - a[1]) * t / L), z = Math.floor(a[2] + (b[2] - a[2]) * t / L), k = x + ',' + y + ',' + z; if (k === last) continue; last = k; const s = w.getBlock(x, y, z); if (s && !(T.flags[s] & (F.FLUID | F.WATERLOG))) n++; } return n; }, [a, b]);
  const report = () => ev(() => (VR.game.wild ? VR.game.wild.report() : null));
  // the actors that come and go (ships, the director's acts, trams, the hall's craft) hold still through a pair
  const freeze = (on) => ev((on) => { const g = VR.game; if (on) { g.__frozen = []; for (const k of ['traffic', 'padLife', 'lifeDirector', 'director', 'starships', 'hall', 'trams']) { const o = g[k]; if (o && typeof o.update === 'function') { g.__frozen.push([o, 'update', o.update]); o.update = function () {}; } } } else { for (const [o, k, f] of g.__frozen || []) o[k] = f; g.__frozen = null; } }, on);
  return { ctx, page, logs, ev, wait, step, settle, settleNear, groundY, below, look, picture, holdEnd, wild, report, freeze, blocked, ok };
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
// (f-wild2: the camera's place settles before the pair — opts.noSettle when the setup did it at the right moment — and
//  cam.aim() points it at its subject again after; opts.only: the switches of the on picture; the pair shares its
//  animation clock; after it, opts.measure(out, on, off) — the numbers the shot is for)
async function shot(name, setup, extra, opts) {
  if (!want(name)) return;
  opts = opts || {};
  const t0 = Date.now(), out = { name };
  try {
    await A.wild(true); await A.freeze(false);
    const cam = await setup(out);
    if (!cam) { out.error = out.error || 'no camera'; console.log(`  !! ${name}: ${out.error}`); rec.shots.push(out); save(); return; }
    if (!opts.noSettle) { await A.look(cam.x, cam.y, cam.z, cam.tx, cam.ty, cam.tz, cam.fov || 70, null); out.near = await A.settleNear(24, 300); }
    if (cam.aim) { const t = await cam.aim(out); if (t) { cam.tx = t[0]; cam.ty = t[1]; cam.tz = t[2]; } }
    out.cam = Object.assign({}, cam, { aim: undefined });
    await A.freeze(true);
    await A.wild(true, opts.only);
    await A.look(cam.x, cam.y, cam.z, cam.tx, cam.ty, cam.tz, cam.fov || 70, null);
    await A.step(4);
    out.report = await A.report();
    if (opts.view) out.view = await A.ev(() => { const r = VR.game.renderer; return { vp: Array.from(r.viewProj), w: r.w, h: r.h }; });
    await A.picture(`${SHOTS}wild_${name}_on.png`, 4, true);
    if (extra) await extra(out);
    await A.wild(false); await A.step(3);
    await A.look(cam.x, cam.y, cam.z, cam.tx, cam.ty, cam.tz, cam.fov || 70, null);
    await A.picture(`${SHOTS}wild_${name}_off.png`, 4, true);
    await A.holdEnd();
    await A.wild(true); await A.freeze(false);
    const F = [await load(`${SHOTS}wild_${name}_on.png`), await load(`${SHOTS}wild_${name}_off.png`)];
    out.diff = diff(F[0], F[1]);
    if (opts.measure) out.measure = opts.measure(out, F[0], F[1]);
    out.ms = Date.now() - t0;
    console.log(`  ${name}: ${JSON.stringify(out.diff)} ${out.measure ? JSON.stringify(out.measure) : ''} · near ${JSON.stringify(out.near || null)} · ${(out.ms / 1000).toFixed(0)} s (${secs()}) · ${JSON.stringify(out.report).slice(0, 500)}`);
  } catch (e) { out.error = String(e.message || e).split('\n')[0].slice(0, 300); console.log(`  !! ${name}: ${out.error}`); try { await A.holdEnd(); await A.wild(true); await A.freeze(false); } catch (e2) { /* */ } }
  rec.shots.push(out); save();
}
// (f-wild2) the pair's numbers: luma (Rec. 709 of the sRGB values); the flock's cover (|on − off| > 24) and its dark core
// (luma ≤ 60 in on where off is lighter); fish: how many of the projected fish show (≥ 4 changed pixels round them)
const luma = (A, p) => 0.2126 * A.d[p] + 0.7152 * A.d[p + 1] + 0.0722 * A.d[p + 2];
const flockMeasure = (out, on, off) => { const n = on.w * on.h; let cover = 0, core = 0; for (let i = 0, p = 0; i < n; i++, p += 3) { const d = Math.abs(on.d[p] - off.d[p]) + Math.abs(on.d[p + 1] - off.d[p + 1]) + Math.abs(on.d[p + 2] - off.d[p + 2]); if (d > 24) cover++; if (luma(on, p) <= 60 && luma(off, p) > 60) core++; } return { cover: +(cover / n * 100).toFixed(2), core: +(core / n * 100).toFixed(2) }; };
const fishMeasure = (out, on, off) => {
  const r = out.report, v = out.view, S = r && r.shoals ? r.shoals.find(q => q.fishPos && q.fishPos.length) : null;
  if (!S || !v) return { fish: 0, seen: 0, why: !S ? 'no shoal' : 'no view' };
  const n = on.w * on.h, M = new Uint8Array(n), c = out.cam;
  for (let i = 0, p = 0; i < n; i++, p += 3) if (Math.abs(on.d[p] - off.d[p]) + Math.abs(on.d[p + 1] - off.d[p + 1]) + Math.abs(on.d[p + 2] - off.d[p + 2]) > 30) M[i] = 1;
  let seen = 0, inView = 0; const sx = on.w, sy = on.h, m = v.vp;
  for (const f of S.fishPos) {
    const x = f[0] - c.x, y = f[1] - c.y, z = f[2] - c.z;   // (the frame's world is camera-relative: the eye at the origin)
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw <= 0.05) continue;
    const px = Math.round((cx / cw * 0.5 + 0.5) * sx), py = Math.round((1 - (cy / cw * 0.5 + 0.5)) * sy);
    if (px < 3 || py < 3 || px >= sx - 3 || py >= sy - 3) continue;
    inView++;
    let k = 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) k += M[(py + dy) * sx + px + dx];
    if (k >= 4) seen++;
  }
  return { fish: S.fishPos.length, inView, seen };
};
// travel: fly there, the chunks settled
const go = async (x, y, z, tod) => { await A.ev(([x, y, z, tod]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); if (tod !== null) g.env.setTime(tod); }, [x, y, z, tod === undefined ? null : tod]); await A.settle(150, 8); };

// the clearest view of a point from d blocks (sixteen places round it; the fewest blocks between) → {x, y, z, n}
const clearView = async (P, dd, lift, prefer) => {
  let best = null;
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2 + (prefer || 0), ex = P[0] + Math.cos(a) * dd, ez = P[2] + Math.sin(a) * dd, gy = await A.groundY(ex, ez), ey = Math.max(gy + 1 + EYE, P[1] + lift);
    const n = await A.blocked([ex, ey, ez], [P[0], P[1] + 0.4, P[2]]), score = n * 10 + Math.abs(ey - P[1] - lift) + k * 0.01;
    if (!best || score < best.score) best = { score, n, x: ex, y: ey, z: ez };
  }
  return best;
};
// 1 the murmuration at the golden hour over the lake: from the shore (the beach west of the lake), 150-190 blocks from the
// cloud — the whole of it against the evening sky, the lake and the isles behind; then 70 from it (murm_close: the birds)
await shot('murm', async (out) => {
  await go(235, 75, 35, 11600);
  await A.step(900);   // (30 s: the flock comes in from afar and swirls round its stage)
  let r = await A.report();
  if (!r || !r.murm) { out.error = 'no murmuration'; return null; }
  // (f-wild2: 145 blocks off — the beach's line, the preview's distance; aimed again at the flock after the settle)
  const c = r.murm.ctr, bx = 205 - c[0], bz = 10 - c[2], bl = Math.hypot(bx, bz) || 1, dd = Math.min(bl, 145);
  const ex = c[0] + bx / bl * dd, ez = c[2] + bz / bl * dd, gy = await A.groundY(ex, ez);
  out.murm = r.murm;
  return { x: ex, y: Math.max(gy + 1 + EYE + 1, PL.sea + 3), z: ez, tx: c[0], ty: c[1] + 4, tz: c[2], fov: 70, aim: async () => { const q = await A.report(); return q && q.murm ? [q.murm.ctr[0], q.murm.ctr[1] + 4, q.murm.ctr[2]] : null; } };
}, async (out) => {
  const r = await A.report(); if (!r || !r.murm) return;
  const c = r.murm.ctr, cam = out.cam, bx = cam.x - c[0], bz = cam.z - c[2], bl = Math.hypot(bx, bz) || 1;
  const ex = c[0] + bx / bl * 70, ez = c[2] + bz / bl * 70, top = await A.below(ex, ez, 108), ey = Math.max(top + 1 + EYE + 1, PL.sea + 3);   // (over a tree's crown, not in it; under the isles, not on one)
  out.murmClose = { cam: [+ex.toFixed(1), +ey.toFixed(1), +ez.toFixed(1)], ctr: c, spread: r.murm.spread };
  await A.look(ex, ey, ez, c[0], c[1], c[2], 70, null); await A.step(2);
  await A.picture(`${SHOTS}wild_murm_close_on.png`, 4);
}, { only: ['wildBirds'], measure: flockMeasure });
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
// 3 the shoal at the pier (f-wild2: R50-10's photo 07 — 48 fish in the lake, none in the picture): the player stands
// still on the pier's end in the late morning; the shoal comes to its shadow on the water beside the deck; the eye looks
// down at it. Counted: the fish that show in the picture (≥ 4 changed pixels round each)
await shot('shoal', async (out) => {
  const Pi = PL.pier; if (!Pi) { out.error = 'no pier'; return null; }
  const ux = Pi.dir[0], uz = Pi.dir[1], ex = Pi.x + 0.5 - ux * 1.5, ez = Pi.z + 0.5 - uz * 1.5;
  await go(ex, Pi.y + 6, ez, 5200);
  await A.ev(([x, y, z]) => { const p = VR.game.player; p.teleport(x, y, z); p.vel = [0, 0, 0]; }, [ex, Pi.y + 1, ez]);
  await A.settleNear(24, 200);
  await A.step(300);   // (10 s: the shoal comes to the shadow)
  const r = await A.report(), s = r && r.shoals && (r.shoals.find(q => !q.key.startsWith('eye:')) || r.shoals[0]);
  if (!s) { out.error = 'no shoal: ' + JSON.stringify(r && r.shoals && r.shoals.map(q => q.key)); return null; }
  out.shoal = { key: s.key, ctr: s.ctr, follow: s.follow, b: s.b };
  // (29 Oct: the shoal at a still player's noon shadow is nearly under the eye — a camera aimed straight down has no
  //  up and the picture came out as the deck's underside; the eye looks out along the pier, ≥ 2.5 ahead of the shoal's
  //  middle, about 50° down, as a player looking over the end does)
  const off = (c) => { const hx = c[0] - ex, hz = c[2] - ez, h = Math.hypot(hx, hz); return h >= 2.5 ? c : [c[0] + ux * (2.5 - h), c[1], c[2] + uz * (2.5 - h)]; };
  const t0 = off(s.ctr);
  return { x: ex, y: Pi.y + 1 + EYE, z: ez, tx: t0[0], ty: t0[1], tz: t0[2], fov: 70, aim: async () => { const q = await A.report(), t = q && q.shoals && (q.shoals.find(z => z.key === s.key) || q.shoals[0]); return t ? off(t.ctr) : null; } };
}, null, { noSettle: true, view: true, measure: fishMeasure });
// 3b the pass at dusk (f-wild2): the young ray's glide past the beach's cell at the day's moment, from the eye in the cell
// (the eye 7 blocks from the cell's middle toward the isles; the wild's clock set 115 s before the moment — the actor
// plans 10–110 s before it — the sky held at the moment's light, the clock run on to the moment)
await shot('pass', async (out) => {
  const cell = 24, cx = Math.floor(236 / cell) * cell + cell / 2, cz = Math.floor(36 / cell) * cell + cell / 2;
  const tn = await A.ev(() => VR.Wild.passTime(VR.game.wild.seed, VR.game.env.day | 0));
  await go(cx, 80, cz, tn - 60);
  const D = await A.ev(([x, z]) => { const I = VR.Heart && VR.Heart.ISLES ? VR.Heart.ISLES : { x: 330, z: 140 }, dx = x - I.x, dz = z - I.z, l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; }, [cx, cz]);
  const ex = cx + 0.5 - D[0] * 7, ez = cz + 0.5 - D[1] * 7, egy = await A.groundY(ex, ez);
  await A.ev(([x, y, z]) => { const p = VR.game.player; p.teleport(x, y, z); p.vel = [0, 0, 0]; }, [ex, egy + 1, ez]);
  out.near = await A.settleNear(24, 200);
  await A.ev((t) => { const g = VR.game; g.env.setTime(t); g.wild.clock = null; }, tn - 2300);
  await A.step(2);
  await A.ev((t) => VR.game.env.setTime(t), tn - 60);
  let r = null;
  for (let k = 0; k < 90; k++) { await A.step(20, 100); r = await A.report(); if (r && r.pass && r.pass.plan && r.clock >= r.pass.plan.Tn - 3) break; if (r && r.pass && r.pass.tried && !r.pass.plan) break; }
  for (let k = 0; k < 40 && r && r.pass && r.pass.plan && r.clock < r.pass.plan.Tn - 0.4; k++) { await A.step(3); r = await A.report(); }
  out.pass = r && r.pass; out.clock = r && r.clock;
  if (!r || !r.pass || !r.pass.plan) { out.error = 'no pass: ' + JSON.stringify(r && { pass: r.pass, clock: r.clock }); return null; }
  const R = r.rays[r.pass.plan.k];
  out.ray = R; out.dist = +Math.hypot(R[0] - ex, R[1] - (egy + 1 + EYE), R[2] - ez).toFixed(1);
  return { x: ex, y: egy + 1 + EYE, z: ez, tx: R[0], ty: R[1], tz: R[2], fov: 70 };
}, async (out) => {
  // 2.5 s on: the ray past the eye, climbing away (the picture for the sheet)
  await A.step(75); const q = await A.report(), R = q && q.pass && q.pass.plan ? q.rays[q.pass.plan.k] : null;
  if (R) { const c = out.cam; out.rayAfter = R; await A.look(c.x, c.y, c.z, R[0], R[1], R[2], 70, null); await A.step(2); await A.picture(`${SHOTS}wild_pass_after_on.png`, 4); }
  await A.ev(() => { VR.game.wild.clock = null; });   // (the clock from the world again)
}, { noSettle: true, only: ['wildRays'], measure: flockMeasure });
// 4 the butterflies on a flower drift near the meadow; then walking through them
await shot('bfly', async (out) => {
  await go(240, 90, -120, 5200);
  await A.step(120);
  const r = await A.report(), sw = r && r.swarms && r.swarms[0];
  if (!sw) { out.error = 'no swarm (drifts ' + (r && r.drifts) + ')'; return null; }
  out.swarm = sw;
  // (4.5 blocks from the drift's middle, the eye low over the flowers: run 2's six blocks made them specks)
  const [hx, hy, hz] = sw.home, ex = hx - 4, ez = hz - 2, gy = await A.groundY(ex, ez);
  return { x: ex, y: gy + 1 + EYE, z: ez, tx: hx, ty: hy + 1.0, tz: hz, fov: 66 };
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
  // what the walker sees: from its own eye, on along the way it walked, a little up — the swarm rising round it
  const p = await A.ev(() => VR.game.player.pos.slice()), wx = hx - cam.x, wz = hz - cam.z, wl = Math.hypot(wx, wz) || 1;
  await A.look(p[0], p[1] + EYE, p[2], p[0] + wx / wl * 6, p[1] + EYE + 1.2, p[2] + wz / wl * 6, 74, null);
  await A.picture(`${SHOTS}wild_bfly_rise_on.png`, 3);
});
// 5 the rays between the isles: from over the lake, the nearest ray framed (afternoon), then their lines at dusk
// (from the beach where the release's lake view stands: the isles over the lake, the rays gliding under and between them;
// the nearest pair framed when it comes within 80-170 — the game runs on until one does)
// (run 2 framed them from the beach, 150 off: two pale specks — now from the lake's south-west shore, 45-100 from the
// great ray of the nearest pair as it comes by)
const rayShot = (name, tod) => shot(name, async (out) => {
  const ex = 243, ez = 49;
  await go(ex, 75, ez, tod);
  const ey = Math.max((await A.below(ex, ez, 108)) + 1 + EYE, PL.sea + 3);
  let r = null, best = null;
  for (let k = 0; k < 30 && !best; k++) {
    await A.step(45);
    r = await A.report();
    if (!r || !r.rays || !r.rays.length) continue;
    let bd = 1e9; for (let i = 0; i < r.rays.length; i += 2) { const R = r.rays[i], d = Math.hypot(R[0] - ex, R[2] - ez); if (d > 45 && d < 100 && d < bd) { bd = d; best = R; } }
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
  // (run 2 arrived at dawn: the line formed and was walked while the chunks settled. Now the place settles in the night,
  //  with no deer about, and then the dawn comes: the group arrives, the leader walks out, the picture mid-line)
  await go(ex, D.y + 8, ez, 20500);
  await A.ev(() => VR.game.env.setTime(22500));
  let lined = 0;
  for (let k = 0; k < 8 && !lined; k++) { await A.step(45); lined = await A.ev(() => { const E = VR.game.entities; return E ? E.mobs.filter(m => m.line).length : 0; }); }
  await A.step(240);
  const deer = await A.ev(() => VR.game.entities.mobs.filter(m => m.kind === 'glimmer_deer').map(m => ({ pos: m.pos.map(v => +v.toFixed(1)), line: !!m.line, li: m.li, graze: !!m.graze })));
  out.deer = deer; out.lined = lined;
  if (!deer.length) { out.error = 'no deer came'; return null; }
  // (the line's deer if they walk one, else the group nearest the anchor; the clearest view from 15 blocks — run 2's
  //  camera stood behind a sunflower field)
  const near = deer.filter(d => d.line).length ? deer.filter(d => d.line) : deer.filter(d => Math.hypot(d.pos[0] - D.x, d.pos[2] - D.z) < 40);
  const grp = near.length ? near : deer;
  let cx = 0, cy = 0, cz = 0; for (const d of grp) { cx += d.pos[0]; cy += d.pos[1]; cz += d.pos[2]; } cx /= grp.length; cy /= grp.length; cz /= grp.length;
  const v = await clearView([cx, cy, cz], 15, 2.2);
  out.deerView = { blocked: v.n, n: grp.length };
  return { x: v.x, y: v.y, z: v.z, tx: cx, ty: cy + 0.9, tz: cz, fov: 52 };
});

// 8 rabbits at a field's edge by day (the pasture's lane by farm_c: bushes and hedges at the foot of the fields), seen
// from 12.5 blocks — near enough to see them nibble, far enough that they only sit up
await shot('rabbit', async (out) => {
  await go(240, 90, -100, 4800);
  let r = null, q = null;
  for (let k = 0; k < 6 && !q; k++) { await A.step(120); r = await A.report(); q = r && r.rabbits && r.rabbits.find(b => b.state !== 'bolt'); }
  if (!q) { out.error = 'no rabbit (cover ' + (r && r.cover) + ')'; return null; }
  out.rabbit = q;
  const v = await clearView(q.pos, 12.5, 1.9);
  out.rabbitView = { blocked: v.n };
  return { x: v.x, y: v.y, z: v.z, tx: q.pos[0], ty: q.pos[1] + 0.25, tz: q.pos[2], fov: 40 };
});
// 9 the fox at dusk along a hedge (a straight hedgerow by the way east of the origin), from its open side
await shot('fox', async (out) => {
  // (run 3 met no fox: it came while the place settled — 16 s along the hedge, the node probe has it at 0.2 s — and then
  //  rested 90 s, past the 32 s of looking. Now the place settles with the wild off, and the evening begins when the
  //  camera is there; the game clears the rest when the dusk or the switches go)
  await A.wild(false);
  await go(88, 90, 57, 11200);
  await A.wild(true);
  let r = null, f = null;
  for (let k = 0; k < 16 && !f; k++) { await A.step(60); r = await A.report(); f = r && r.fox && r.fox.state !== "slip" ? r.fox : null; }
  if (!f) { out.error = 'no fox (cover ' + (r && r.cover) + ')'; return null; }
  out.fox = f;
  const v = await clearView(f.pos, 10, 1.9);
  out.foxView = { blocked: v.n };
  return { x: v.x, y: v.y, z: v.z, tx: f.pos[0], ty: f.pos[1] + 0.4, tz: f.pos[2], fov: 44 };
});

// ---------------------------------------------------------------- the sheet: off | on per shot (and the extras)
try {
  const rows = [];
  for (const s of rec.shots) if (!s.error && fs.existsSync(`${SHOTS}wild_${s.name}_on.png`)) rows.push([s.name, `${SHOTS}wild_${s.name}_off.png`, `${SHOTS}wild_${s.name}_on.png`]);
  for (const [n, p] of [['murm_close', 'wild_murm_close_on.png'], ['pass_after', 'wild_pass_after_on.png'], ['heron_fly', 'wild_heron_fly_on.png'], ['bfly_rise', 'wild_bfly_rise_on.png']]) if (fs.existsSync(SHOTS + p)) rows.push([n, null, SHOTS + p]);
  const Wc = 640, Hc = 360, comps = [];
  for (let i = 0; i < rows.length; i++) {
    const [n, off, on] = rows[i];
    for (const [k, p] of [[0, off], [1, on]]) if (p) comps.push({ input: await sharp(p).resize(Wc, Hc).toBuffer(), left: k * Wc, top: i * Hc });
    const svg = `<svg width="${Wc * 2}" height="${Hc}"><style>.t{font:bold 22px sans-serif;fill:#fff;stroke:#000;stroke-width:3px;paint-order:stroke}</style><text x="12" y="30" class="t">${n} · off</text><text x="${Wc + 12}" y="30" class="t">${n} · on (f-wild2)</text></svg>`;
    comps.push({ input: Buffer.from(svg), left: 0, top: i * Hc });
  }
  if (rows.length) await sharp({ create: { width: Wc * 2, height: Hc * rows.length, channels: 3, background: { r: 20, g: 22, b: 30 } } }).composite(comps).jpeg({ quality: 82 }).toFile(SHOTS + 'wild_sheet.jpg');
  console.log(`sheet: ${rows.length} rows → test/shots/wild_sheet.jpg`);
} catch (e) { console.log('  !! no sheet: ' + String(e.message || e).slice(0, 200)); }

// the shots' checks: each one framed, the picture changed where the animals are
for (const s of rec.shots) check(!s.error, `${s.name}: framed and pictured (test/shots/wild_${s.name}_on.png | _off.png)${s.error ? ' — ' + s.error : ''}`);
const sm = rec.shots.find(s => s.name === 'murm');
if (sm && sm.report && sm.report.murm) check(sm.report.murm.n >= 600, `the murmuration on High: ${sm.report.murm.n} boids (2× t-wild's 300 and more)`);
// (f-wild2 · R50-10's measures)
if (sm && !sm.error) check(!!sm.measure && sm.measure.cover >= 3 && sm.measure.core >= 1, `the flock from the shore: ${sm.measure ? sm.measure.cover : '—'} % of the lake view (≥ 3), its dark core ${sm.measure ? sm.measure.core : '—'} % (luma ≤ 60, ≥ 1)`);
const sp = rec.shots.find(s => s.name === 'pass');
if (sp && !sp.error) check(!!sp.measure && sp.measure.cover >= 2 && sp.dist <= 40, `the young ray's pass at dusk: ${sp.dist} blocks from the eye (≤ 40), ${sp.measure ? sp.measure.cover : '—'} % of the frame (≥ 2), ${sp.pass && sp.pass.plan ? sp.pass.plan.scale : '—'} blocks across`);
const ss = rec.shots.find(s => s.name === 'shoal');
if (ss && !ss.error) check(!!ss.measure && ss.measure.seen >= 10, `the shoal from the pier: ${ss.measure ? ss.measure.seen : 0} fish show (≥ 4 px; ${ss.measure ? ss.measure.inView : 0} in the view, ${ss.measure ? ss.measure.fish : 0} in the shoal; at the shadow ${ss.report && ss.report.shoals ? ss.report.shoals.some(q => q.follow) : '—'})`);
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
      // (f-wild2, 29 Oct) the animals' own share, measured apart: the GPU drained before their draw, their draw's CPU
      // (its uploads included), then drained again — their GPU work alone (the median of N frames; the frame's own
      // overlap is lost in these frames, so they are not in the on/off medians above)
      await A.wild(true); await A.step(2);
      const own = await A.ev((n) => new Promise((ok, no) => { const g = VR.game, gl = g.renderer.gl, w = g.wild, W0 = w.draw, cur = { cpu: 0, all: 0 }, F = []; window.__norender = false;
        w.draw = function (r, E, layer, cam) { gl.finish(); const t0 = performance.now(); W0.call(this, r, E, layer, cam); const t1 = performance.now(); gl.finish(); const t2 = performance.now(); cur.cpu += t1 - t0; cur.all += t2 - t0; };
        let k = -2; const f = () => { try { cur.cpu = 0; cur.all = 0; g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); if (k++ >= 0) F.push([cur.cpu, cur.all, (w.stats.draws || 0) + (w.stats.drawsT || 0), w.stats.vox || 0]); if (k < n) setTimeout(f, 0); else { w.draw = W0; window.__norender = true; const md = (j) => { const v = F.map(q => q[j]).sort((a, b) => a - b); return +v[v.length >> 1].toFixed(2); }; ok({ cpu: md(0), gpu: md(1), inst: md(2), vox: md(3) }); } } catch (e) { w.draw = W0; no(String(e)); } }; f(); }), N);
      await A.step(30);
      const rep = await A.report();
      const med = (a, k) => { const v = a.map(q => q[k]).sort((p, q) => p - q); return v[v.length >> 1]; };
      out[label] = { on: { ms: med(R.on, 'ms'), draws: med(R.on, 'draws'), tris: med(R.on, 'tris') }, off: { ms: med(R.off, 'ms'), draws: med(R.off, 'draws'), tris: med(R.off, 'tris') }, own, actor: { ms: rep.ms, drawMs: rep.drawMs, draws: rep.draws, inst: rep.inst, murm: rep.murm ? rep.murm.n : 0, rays: rep.rays.length, gulls: rep.gulls, fish: rep.fish, swarms: rep.swarms.length } };
      console.log(`cost on High · ${label}: ${JSON.stringify(out[label])}`);
      const a = out[label].actor, cpu = Object.values(a.ms).reduce((p, q) => p + q, 0);
      const o = out[label].own, dd = out[label].on.draws - out[label].off.draws;
      check(cpu + o.cpu < 3.0, `High · ${label}: the actor's CPU ${cpu.toFixed(2)} ms (update) + ${o.cpu} ms (its draw, the GPU drained before) a frame on SwiftShader (per piece ${JSON.stringify(a.ms)})`);
      check(o.gpu - o.cpu <= Math.max(3, 0.15 * out[label].off.ms), `High · ${label}: the animals' GPU work ${(o.gpu - o.cpu).toFixed(2)} ms a frame (≤ 15 % of the frame without them, ${out[label].off.ms} ms)`);
      // (+6: the rays' trails and motes ride the trails' and the particles' own draws, which skip when nothing is emitted —
      //  run 3 of 29 Oct: the lake +9 = 4 instanced + 5 of those)
      check(o.inst <= 9 && dd <= o.inst + o.vox + 6, `High · ${label}: ${dd} draws more with the animals (${o.inst} instanced, ${a.inst} instances; ${o.vox} for the voxel animals' parts)`);
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
    const haveBefore = !process.env.NO_BEFORE && fs.existsSync(new URL(BEFORE).pathname);
    if (haveBefore) { const B = await openWorld(BEFORE, 'potato'); check(B.ok, `the build before on Very Low (${secs()})`); pages.push(['before', B]); await place(B); } else console.log('  · no build before (NO_BEFORE or no ' + BEFORE + '): Very Low against itself only');
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
