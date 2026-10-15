// The land between (t-land, vgen 10; plan docs/superpowers/plans/2026-10-09-t-land.md) — the pictures and the cost.
// A new default world (seed 4242) of the build before (BEFORE_DIST: v0.44's generator, vgen 9) and of this one (vgen 10)
// on the High preset as a player gets it (only the dynamic resolution held off), from:
//   the six audit cameras of t-beauty's test/beauty_audit.mjs (copied, read-only there): hills_1, hills_2, far_2,
//   far_3, water_1, backs_1 — and the land's own: a walk on a way out of the temple, a river bend, a farm at the golden
//   hour, the lookout tower at dusk, the waterfall (their places from the land's plan, computed here in node: the same
//   seed, the same plan as the page's workers)
// test/shots/land_<shot>_{before,after}.png (1280 × 720), and per shot the counts round the camera (canopy columns, way
// columns, flower and grass columns, crop columns, lanterns, water) in test/shots/land_<tag>.json.
// The Very Low (potato) cost: the hills view (hills_1) and the walk, both builds open side by side and measured in turns
// (ms per frame with the GPU drained, draws, triangles; the median of five rounds).
// Checks: the after world is vgen 10 and has the land (VR.Land on), every picture is written and not blank, the land's
// counts rise where the land is (the walk: way and canopy columns), Very Low at the hills view not slower than before
// (median ratio ≤ 1.05), no page error.
//   BEFORE_DIST=file:///…/before/dist/index.html nohup bash test/wt_run.sh land.mjs 7200 > .tmp_tests/land.log 2>&1 &
//   ONLY=hills_1,walk (shots) · NO_BEFORE=1 · NO_COST=1 · SEED=4242
// regress: skip  (a showcase: the pictures are the evidence; the gates are the node tests, test/land.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const SEED = process.env.SEED || '4242', N = +(process.env.N || 8);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const DIST = process.env.DIST || 'file:///home/dev/vr/dist/index.html';
const MORNING = 2000, NOON = 6000, GOLDEN = 12500, DUSK = 12950, NIGHT = 16000;
const EYE = 1.62;
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// ---------------------------------------------------------------- the cameras
// [name, [x, z], eye above the ground or {y: absolute eye height}, [look-at x, y, z] (y: absolute, or {up: above the
// ground there}), fov, time of day]
const CAMS = [
  ['hills_1', [0.5, -292.5], { y: 136 }, [0, 84, -105], 60, GOLDEN],
  ['hills_2', [-110.5, -250.5], 30, [-10, 84, -110], 60, MORNING],
  ['far_2', [0.5, -425.5], { y: 128 }, [0, 100, -1200], 70, MORNING],
  ['far_3', [-470.5, 420.5], { y: 128 }, [-1000, 100, 900], 70, NOON],
  ['water_1', [201.5, 6.5], EYE, [250, 64, 70], 70, GOLDEN],
  ['backs_1', [24.5, -114.5], EYE, [22, 86, -95], 70, NOON],
];
// the land's own places, from its plan (node: the shared code, the same seed)
{
  const V = require('/home/dev/vr/test/load_shared.js');
  const g = V.makeGen('overworld', +SEED, { vgen: 10 }), L = V.Land, P = L.plan(g), SEA = V.C.SEA;
  // the walk: the longest way out of a temple anchor, 60 blocks along it, looking 30 ahead
  let walk = null;
  for (const Ln of P.lines) { const a = P.sites[Ln.a]; if (a.kind !== 'temple' || Ln.pts.length < 120) continue; if (!walk || Ln.pts.length > walk.pts.length) walk = Ln; }
  if (walk) { const p = walk.pts[60], q = walk.pts[90]; CAMS.push(['walk', [p[0], p[1]], EYE + 0.3, [q[0], { up: 2.2 }, q[1]], 70, GOLDEN]); }
  // a second step of the walk, further out
  if (walk && walk.pts.length > 170) { const p = walk.pts[150], q = walk.pts[175]; CAMS.push(['walk_2', [p[0], p[1]], EYE + 0.3, [q[0], { up: 2.2 }, q[1]], 70, MORNING]); }
  // the river bend: the sharpest bend between its head and its mouth, from its outer bank, looking downstream
  const Rv = L.river(g);
  let bend = null; for (let i = 70; i < Rv.pts.length - 70; i++) { const a = Rv.pts[i - 12], b = Rv.pts[i], c = Rv.pts[i + 12]; let k = Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]); while (k > Math.PI) k -= 2 * Math.PI; while (k < -Math.PI) k += 2 * Math.PI; if (!bend || Math.abs(k) > Math.abs(bend.k)) bend = { i, k }; }
  if (bend) { const b = Rv.pts[bend.i], a = Rv.pts[bend.i - 8], c = Rv.pts[bend.i + 30], tx = c[0] - a[0], tz = c[1] - a[1], tl = Math.hypot(tx, tz), sd = bend.k > 0 ? -1 : 1; const cx = b[0] - tz / tl * 14 * sd - tx / tl * 10, cz = b[1] + tx / tl * 14 * sd - tz / tl * 10; CAMS.push(['river', [cx, cz], 4, [c[0], SEA + 1, c[1]], 70, NOON]); }
  // the farm nearest the city at the golden hour: from 28 blocks off, 9 above the ground, at its yard
  const fc = P.sites.find(s => s.id === 'farm_c');
  if (fc) { const house = P.pieces.find(p => p.kind === 'farmhouse' && p.farm === 'farm_c'), fx = house ? house.x : fc.x, fz = house ? house.z : fc.z, a = Math.atan2(fz + 60 - fz, fx - 30 - fx); CAMS.push(['farm', [fc.x - 26, fc.z - 22], 9, [fx, { up: 3 }, fz], 70, GOLDEN]); void a; }
  // the lookout tower at dusk: from the way below it, 34 blocks off
  const lk = P.pieces.find(p => p.kind === 'lookout');
  if (lk) CAMS.push(['lookout', [lk.x + 30, lk.z + 16], 3, [lk.x, lk.top + 2, lk.z], 70, DUSK]);
  // the waterfall: from the river 26 blocks below its head, at the curtain's middle
  const Fa = L.falls(g);
  if (Fa) { const [hx, hz] = Fa.head, [ux, uz] = Fa.dir; CAMS.push(['falls', [hx + ux * 26 + 0.5, hz + uz * 26 + 0.5], { y: SEA + 8 }, [hx - ux * 6, (Fa.top + SEA) / 2, hz - uz * 6], 70, NOON]); }
  // the woods from afar: high over Nova Haven's east end, over the land to the north-east woods 400–700 blocks off —
  // beyond the chunks (High: 14), the far ring and the horizon draw them (lod.js, far.js: VR.Land.lodTree's canopies)
  CAMS.push(['lod', [119.5, -96.5], { y: 205 }, [470, 92, -520], 60, MORNING]);
  console.log('cameras', JSON.stringify(CAMS.map(c => [c[0], c[1].map(v => +(+v).toFixed(1))])));
}
// (the land's own first: a run that stops early still has them)
const OWN = ['walk', 'walk_2', 'river', 'farm', 'lookout', 'falls', 'lod'];
CAMS.sort((a, b) => (OWN.includes(a[0]) ? OWN.indexOf(a[0]) : 99) - (OWN.includes(b[0]) ? OWN.indexOf(b[0]) : 99));
const SHOTS = CAMS.filter(c => !ONLY || ONLY.includes(c[0])).map(c => ({ name: c[0], x: c[1][0], z: c[1][1], eye: c[2], at: c[3], fov: c[4], tod: c[5] }));
// BEFORE_ONLY=lod,…: the build before shoots only these (the others' before pictures kept from an earlier run)
const BONLY = process.env.BEFORE_ONLY ? process.env.BEFORE_ONLY.split(',') : null;

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });

// ---------------------------------------------------------------- a page with a world (t-beauty's machinery)
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
  const step = async (n, dtms = 16) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
  const boost = (on) => ev((on) => { const g = VR.game, q = g.renderer && g.renderer.q; if (!q) return; if (on) { if (q.__up === undefined) q.__up = q.upload; q.upload = 24; } else if (q.__up !== undefined) { q.upload = q.__up; delete q.__up; } }, on);
  const settle = async (max = 60, farMax = 30) => {
    let s = null;
    await boost(true);
    for (let i = 0; i < max; i++) {
      await step(20);
      s = await ev(() => { const g = VR.game, w = g.world, p = g.player, rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if (sc.dirty || sc.pending) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= rd * rd) dirty += n; } let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } const h = g.horizon, f = h && h.far, fr = f && f.report ? f.report() : null; return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown, hz: h ? h.inflight : 0, far: fr ? fr.inflight + fr.want : 0 }; });
      const near = s.busy === 0 && s.pend === 0 && s.dirty === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0;
      s.i = i;
      if (near && i > 2 && ((s.hz === 0 && s.far === 0) || i >= farMax)) break;
      await wait(30);
    }
    await boost(false);
    return s;
  };
  const warmVx = () => ev(() => {
    const g = VR.game, r = g.renderer, p = g.player; if (!r.vxResidency || !g.world) return -1;
    const cam = [p.pos[0], p.pos[1] + (p.eye || 1.62), p.pos[2]], list = [];
    for (const c of g.world.cols.values()) for (const s of c.sec) if (s && s.hasMesh) list.push(s);
    const D = (r.q && r.q.vxLod) || 48, up2 = D * D; let n = 0;
    for (; n < 600; n++) { let wt = 0; for (const s of list) { if (!s.vxData || s.mesh[3]) continue; const dx = s.ox + 8 - cam[0], dy = s.oy + 8 - cam[1], dz = s.oz + 8 - cam[2]; if (dx * dx + dy * dy * 0.5 + dz * dz < up2) wt++; } if (!wt) break; r.vxResidency(list, cam); }
    return n;
  });
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.applySettings('*'); }, preset);
  await ev(`VR.game.createWorld({name:'Land',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
  for (let i = 0; i < 150; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  const ok = await ev(() => VR.game.state) === 'play';
  await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui', 'hints']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } });
  const groundY = (x, z) => ev(([x, z]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = 200; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & (F.OPAQUE | F.FLUID)) && !(R.T.flags[s] & F.LEAVES)) return y; } return 80; }, [x, z]);
  const pose = (x, feet, z, yaw, pitch, fov, tod) => ev(([x, y, z, yaw, pitch, fov, tod]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = yaw; p.pitch = pitch; p.fovKick = 0; p.vel = [0, 0, 0]; g.settings.fov = fov; g.env.setTime(tod); }, [x, feet, z, yaw, pitch, fov, tod]);
  const picture = async (path, tod, frames = 4) => {
    const vx = await warmVx();
    await ev(([frames, tod]) => { window.__norender = false; const g = VR.game, V = g.villages, p = g.player; g.env.setTime(tod); const keep = V && V.agents ? V.agents : null; if (keep) V.agents = keep.filter(a => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) > 8); for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); if (keep) V.agents = keep; window.__norender = true; }, [frames, tod]);
    // (run 1 lost its last shots to one screenshot that never came: try twice, say whether the page still answers)
    for (let k = 0; k < 2; k++) {
      try { await page.screenshot({ path, timeout: 150000 }); return vx; } catch (e) {
        const alive = await Promise.race([ev(() => Math.round(performance.now())).then(() => 'answers', () => 'error'), wait(20000).then(() => 'silent')]);
        console.log(`  !! screenshot ${path.replace(/^.*\//, '')} failed (${String(e.message || e).split('\n')[0].slice(0, 120)}); the page ${alive}`);
        if (alive !== 'answers') throw e;
      }
    }
    return vx;
  };
  // the counts round a point: canopy, way, plant, crop and water columns, lanterns (every column within r)
  const counts = (x, z, r) => ev(([x, z, r]) => {
    const w = VR.game.world, R = VR.R, F = VR.F, nm = (s) => s ? R.types[R.T.type[s]].name : 'air';
    const o = { cols: 0, canopy: 0, way: 0, plants: 0, flowers: 0, crops: 0, water: 0, lanterns: 0, logs: 0 };
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dz * dz > r * r) continue;
      const X = Math.floor(x) + dx, Z = Math.floor(z) + dz;
      if (w.isLoaded && !w.isLoaded(X, Z)) continue;
      let y = 200; while (y > 30 && !w.getBlock(X, y, Z)) y--;
      if (y <= 30) continue;
      o.cols++;
      const top = w.getBlock(X, y, Z), n = nm(top), fl = R.T.flags[top];
      if (fl & F.LEAVES) o.canopy++;
      else if (n === 'water') o.water++;
      else if (/wheat|carrots|potatoes|beetroots/.test(n)) o.crops++;
      else if (fl & F.PLANT) { o.plants++; if (/poppy|daisy|cornflower|dandelion|bluet|allium|tulip|wildflowers|lily_of|orchid|sunflower/.test(n)) o.flowers++; }
      else if (/dirt_path|flagstone/.test(n)) o.way++;
      for (let yy = y - 6; yy <= y + 1; yy++) { const b = nm(w.getBlock(X, yy, Z)); if (b === 'lantern') o.lanterns++; else if (/_log$/.test(b)) o.logs++; }
    }
    return o;
  }, [x, z, r]);
  return { ctx, page, logs, ev, wait, step, settle, warmVx, groundY, pose, picture, counts, ok };
}
const notBlank = async (path) => { try { const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true }); let s = 0, s2 = 0, n = 0; for (let i = 0; i < data.length; i += info.channels * 7) { const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; s += l; s2 += l * l; n++; } const m = s / n; return Math.sqrt(Math.max(0, s2 / n - m * m)) > 6; } catch (e) { return false; } };

// ---------------------------------------------------------------- the pictures of one build
async function shoot(tag, dist, keepOpen) {
  const record = { tag, seed: SEED, dist, shots: [] }, recPath = `/home/dev/vr/test/shots/land_${tag}.json`;
  const LIST = tag === 'before' && BONLY ? SHOTS.filter(s => BONLY.includes(s.name)) : SHOTS;
  // (BEFORE_ONLY: the earlier run's before record keeps its other shots)
  if (tag === 'before' && BONLY) { try { const old = JSON.parse(fs.readFileSync(recPath, 'utf8')); record.shots = (old.shots || []).filter(q => !BONLY.includes(q.name)); } catch (e) { /* none yet */ } }
  const A = await openWorld(dist, 'high');
  check(A.ok, `${tag}: the world is loaded (${secs()})`);
  const meta = await A.ev(() => { const g = VR.game; return { vgen: (g.meta && g.meta.vgen) || 0, land: !!(VR.Land && VR.Land.on && g.world && VR.Land.on({ vgen: g.meta.vgen, singleBiome: -1, flat: false })), preset: g.settings.preset }; });
  console.log(tag, 'world', JSON.stringify(meta));
  if (tag !== 'before') check(meta.vgen >= 10 && meta.land, `${tag}: a new default world is vgen ${meta.vgen} with the land between`);
  await A.settle(80);
  let pics = 0, wanted = 0; const blank = [];
  for (const s0 of LIST) {
    const s = Object.assign({}, s0), t0 = Date.now();
    await A.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 150, z); }, [s.x, s.z]);
    s.s1 = await A.settle(150, 8);
    const gy = await A.groundY(s.x, s.z);
    const eyeY = typeof s.eye === 'object' ? s.eye.y : gy + 1 + s.eye;
    let ay = s.at[1]; if (typeof ay === 'object') ay = (await A.groundY(s.at[0], s.at[2])) + 1 + ay.up;
    const dx = s.at[0] - s.x, dy = ay - eyeY, dz = s.at[2] - s.z;
    s.feet = +(eyeY - EYE).toFixed(2); s.yaw = +Math.atan2(-dx, -dz).toFixed(3); s.pitch = +Math.atan2(dy, Math.hypot(dx, dz)).toFixed(3); s.ground = gy;
    await A.pose(s.x, s.feet, s.z, s.yaw, s.pitch, s.fov, s.tod);
    const st = await A.settle(150, 30); await A.step(6);
    const path = `/home/dev/vr/test/shots/land_${s.name}_${tag}.png`;
    wanted++;
    console.log(`  · ${s.name}: settled ${JSON.stringify(st)} (${secs()}), the picture…`);
    try { await A.picture(path, s.tod); } catch (e) { console.log(`  !! ${s.name}: no picture (${String(e.message || e).split('\n')[0].slice(0, 160)})`); break; }
    if (fs.existsSync(path)) { pics++; if (!(await notBlank(path))) blank.push(path); }
    s.counts = await A.counts(s.x, s.z, 72);
    s.counts.simQ = await A.ev(() => { const S = VR.game.sim; return S && S.sched ? S.sched.size : -1; });   // (the fluid sim's queue: a woken fall that grew showed here)
    s.ms = Date.now() - t0;
    console.log(`  ${s.name}: (${(+s.x).toFixed(1)}, ${s.feet}, ${(+s.z).toFixed(1)}) yaw ${s.yaw} pitch ${s.pitch} · ${JSON.stringify(s.counts)} · ${(s.ms / 1000).toFixed(0)} s · settle ${JSON.stringify(st)} (${secs()})`);
    record.shots.push({ name: s.name, x: s.x, z: s.z, feet: s.feet, yaw: s.yaw, pitch: s.pitch, tod: s.tod, counts: s.counts, ms: s.ms, path: path.replace(/^.*test\/shots\//, 'test/shots/') });
    try { fs.writeFileSync(recPath, JSON.stringify(record, null, 1)); } catch (e) { /* a convenience */ }
  }
  check(pics === wanted && wanted > 0, `${tag}: every picture is written (${pics} of ${wanted})`);
  check(blank.length === 0, `${tag}: no picture is blank (${blank.length}${blank.length ? ': ' + blank.join(', ') : ''})`);
  A.record = record;
  if (keepOpen) return A;
  const errs = A.logs.filter(l => l.startsWith('[pageerror]'));
  console.log(`--- ${tag} logs (${A.logs.length})`); for (const l of A.logs.slice(0, 10)) console.log(l);
  check(errs.length === 0, `${tag}: no page error (${errs.length})`);
  await A.ctx.close();
  return record;
}
let before = null;
if (process.env.BEFORE_DIST && !process.env.NO_BEFORE) before = await shoot('before', process.env.BEFORE_DIST, false);
const A = await shoot('after', DIST, true);
// the land's counts where the land is: the walk (way and canopy columns, lanterns), the farm (crops)
const cnt = (rec, name) => { const s = rec && rec.shots.find(q => q.name === name); return s ? s.counts : null; };
const aw = cnt(A.record, 'walk'), bw = cnt(before, 'walk');
if (aw) check(aw.way > 100 && aw.canopy + aw.logs > 50 && aw.lanterns >= 2, `the walk: a way (${aw.way} way columns), woods and groves (${aw.canopy} canopy columns), lanterns (${aw.lanterns}) round the camera${bw ? ` (before: ${bw.way}, ${bw.canopy}, ${bw.lanterns})` : ''}`);
const af = cnt(A.record, 'farm'); if (af) check(af.crops > 100, `the farm: ${af.crops} crop columns round the camera`);

// ---------------------------------------------------------------- the Very Low cost
if (!process.env.NO_COST) {
  const SCENES = [['hills_1'], ['walk']].map(([nm]) => SHOTS.find(s => s.name === nm)).filter(Boolean);
  const pages = [['after', A]];
  try {
    await A.ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
    if (process.env.BEFORE_DIST) { const B = await openWorld(process.env.BEFORE_DIST, 'potato'); check(B.ok, `the build before is loaded for the cost (${secs()})`); pages.push(['before', B]); }
    const measure = (Pg, n) => Pg.ev((n) => new Promise((ok, no) => { const g = VR.game, gl = g.renderer.gl; window.__norender = false; let k = -2, sum = 0, d = 0, t = 0; const f = () => { try { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); const dt = performance.now() - t0; if (k < 0) { k++; setTimeout(f, 0); return; } const st = g.renderer.stats || {}; sum += dt; d += st.draws || 0; t += st.tris || 0; if (++k < n) setTimeout(f, 0); else { window.__norender = true; ok({ ms: +(sum / n).toFixed(2), draws: Math.round(d / n), tris: Math.round(t / n) }); } } catch (e) { no(String(e)); } }; f(); }), n);
    A.record.cost = {};
    for (const s of SCENES) {
      for (const [, Pg] of pages) {
        await Pg.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 150, z); }, [s.x, s.z]); await Pg.settle(40, 4);
        const gy = await Pg.groundY(s.x, s.z), eyeY = typeof s.eye === 'object' ? s.eye.y : gy + 1 + s.eye;
        let ay = s.at[1]; if (typeof ay === 'object') ay = (await Pg.groundY(s.at[0], s.at[2])) + 1 + ay.up;
        const dx = s.at[0] - s.x, dy = ay - eyeY, dz = s.at[2] - s.z;
        await Pg.pose(s.x, eyeY - EYE, s.z, Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)), s.fov, s.tod);
        await Pg.settle(90, 6); await Pg.step(6);
      }
      const rounds = {};
      for (let r = 0; r < 5; r++) { const order = r & 1 ? pages.slice().reverse() : pages; for (const [lbl, Pg] of order) (rounds[lbl] = rounds[lbl] || []).push(await measure(Pg, N)); }
      const out = {};
      for (const lbl of Object.keys(rounds)) { const ms = rounds[lbl].map(q => q.ms).sort((a, b) => a - b); out[lbl] = { msMedian: ms[ms.length >> 1], ms, draws: rounds[lbl][2].draws, tris: rounds[lbl][2].tris }; }
      if (out.before && out.after) out.ratio = +(out.after.msMedian / out.before.msMedian).toFixed(3);
      A.record.cost[s.name] = out;
      console.log(`very low · ${s.name}: ${JSON.stringify(out)}`);
      for (const [lbl, Pg] of pages) await Pg.picture(`/home/dev/vr/test/shots/land_potato_${s.name}_${lbl}.png`, s.tod, 12);
      if (s.name === 'hills_1' && out.ratio) check(out.ratio <= 1.05, `Very Low at the hills view is not slower than before (${out.after.msMedian} ms against ${out.before.msMedian} ms: ×${out.ratio}; triangles ${out.after.tris} against ${out.before.tris})`);
    }
    try { fs.writeFileSync('/home/dev/vr/test/shots/land_after.json', JSON.stringify(A.record, null, 1)); } catch (e) { /* a convenience */ }
    for (const [lbl, Pg] of pages) if (lbl !== 'after') { const errs = Pg.logs.filter(l => l.startsWith('[pageerror]')); check(errs.length === 0, `${lbl} (cost page): no page error (${errs.length})`); await Pg.ctx.close(); }
  } catch (e) { check(false, `the Very Low cost is measured (${String(e.message || e).slice(0, 300)})`); }
}
{
  const errs = A.logs.filter(l => l.startsWith('[pageerror]'));
  console.log(`--- after logs (${A.logs.length})`); for (const l of A.logs.slice(0, 12)) console.log(l);
  check(errs.length === 0, `after: no page error (${errs.length})`);
  await A.ctx.close();
}
await browser.close();
console.log(`(${secs()})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
