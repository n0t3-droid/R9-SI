// r-wunder in the browser (docs/superpowers/plans/2026-11-07-r-wunder.md): a new default world (seed 4242, Kreativ,
// Friedlich), 960 × 540, de-DE, Balanced. Pictures of the three Wundertiere:
//   wunder_whale.png   the Himmelswal over the Sky Isles at dusk (its visit evening)
//   wunder_ride.png    the flute's answer (1 · 3 · 2) brings it down; on its back, the chase view
//   wunder_tree.png    the Wanderbaum at dawn, the ring of blossoms where it stood
//   wunder_deer.png    the Laternenhirsch leading at night
//   wunder_vl.png      Very Low: the whale's far silhouette (voxel model, no new program)
//   → test/shots/wunder_sheet.jpg (German captions), .tmp_tests/wunder_run.json (costs)
//   nohup bash test/wt_run.sh wunder.mjs 3600 > .tmp_tests/wunder.log 2>&1 &
// regress: skip  (a showcase with pictures; the gate is test/wunder.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '').replace(/\/\.tmp_tests$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html';
const SHOTS = ROOT + '/test/shots/';
const SEED = process.env.SEED || '4242';
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + ' (' + secs() + ')'); };
const run = { seed: SEED };
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/wunder_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|wunder/i.test(s)) logs.push(`[${t}] ${s.slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto(DIST);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(3); } };
const settle = async (max = 40) => {
  for (let i = 0; i < max; i++) {
    await step(20, 16);
    const s = await ev(() => { const g = VR.game, w = g.world; return { busy: g.pool.busy, pend: w.pending.size, up: w.uploadQ ? w.uploadQ.size : 0 }; });
    if (s.busy === 0 && s.pend === 0 && s.up === 0 && i > 2) break;
    await wait(30);
  }
};
const pics = {};
const grab = async (key, name, frames = 4) => {
  const url = await ev((frames) => { try { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; } catch (e) { window.__norender = true; return null; } }, frames);
  if (url && url.length > 2000) { fs.writeFileSync(SHOTS + name, Buffer.from(url.split(',')[1], 'base64')); console.log('  📷 ' + name); pics[key] = SHOTS + name; return SHOTS + name; }
  console.log('  !! no picture ' + name); return null;
};
const shotDom = async (key, name) => { try { await ev(() => { window.__norender = false; const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); window.__norender = true; }); await page.screenshot({ path: SHOTS + name, timeout: 120000 }); console.log('  📷 ' + name); pics[key] = SHOTS + name; return SHOTS + name; } catch (e) { console.log('  !! ' + e.message); return null; } };

const stand = (P, L) => ev(([P, L]) => { const p = VR.game.player; p.flying = true; p.teleport(P[0], P[1], P[2]); p.vel = [0, 0, 0]; const e = [P[0], P[1] + 1.62, P[2]], dx = L[0] - e[0], dy = L[1] - e[1], dz = L[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw; }, [P, L]);
const setT = (day, t) => ev(([d, t]) => { const g = VR.game; g.env.day = d; g.env.setTime(t); }, [day, t]);
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.playerName = 'Mila'; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Wunder',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:false})`);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world');
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.rain = 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; });
check(await ev(() => !!(VR.Wunder && VR.WunderGame && VR.WildGPU.KINDS.wwhale)), 'VR.Wunder, VR.WunderGame and the models are there');
// ---------------------------------------------------------------- golden's rule: time frozen → nothing
await ev(() => { VR.game.zenFreezeTime = true; });
await step(20);
check(await ev(() => !VR.WunderGame.on(VR.game)), 'time frozen (golden\'s worlds): the Wundertiere are off');
await ev(() => { VR.game.zenFreezeTime = false; });
// ---------------------------------------------------------------- 1 · the whale over the isles at dusk
const info = await ev(() => { const g = VR.game, R = VR.WunderGame.state(g), WU = VR.Wunder; let d = 2; while (!WU.whaleVisit(R.seed, d)) d++; return { d, seed: R.seed, name: R.names }; });
run.names = info.name;
console.log('    names: ' + JSON.stringify(info.name) + ' · visit evening: day ' + info.d);
// a moment when the whale glides over an isle at dusk; the camera on that isle's outer rim, looking up at it
const pose = await ev(([d]) => {
  const g = VR.game, R = VR.WunderGame.state(g), WU = VR.Wunder;
  if (!R.loop) R.loop = WU.whaleRoute(R.seed, VR.IslesGen.list({ seed: g.meta.seed }));
  const L = VR.IslesGen.list({ seed: g.meta.seed }), C = R.loop.C, o = new Float32Array(10);
  let best = null;
  for (let t = 11500; t <= 12700; t += 20) {
    WU.whaleAt(R.seed, R.loop, d * 24000 + t, o); if (!o[7] || o[8] < 0.99) continue;
    for (const I of L) { const dd = Math.hypot(o[0] - I.x, o[2] - I.z); if (dd < I.r * 0.5 && (!best || dd < best.dd)) best = { t, dd, p: [o[0], o[1], o[2]], isle: { x: I.x, z: I.z, y: I.y + (I.dome || 4), r: I.r } }; }
  }
  return { best, C };
}, [info.d]);
const B = pose.best;
check(!!B, 'a dusk moment over an isle (tick ' + (B && B.t) + ')');
let wp = null;
if (B) {
  const I = B.isle; let ox = I.x - pose.C[0], oz = I.z - pose.C[1]; const ol = Math.hypot(ox, oz) || 1; ox /= ol; oz /= ol;
  // (the whale a few seconds ahead of the camera's moment: it glides into the frame over the isle)
  const cam = [I.x + ox * I.r * 1.05 - oz * 8, I.y + 4, I.z + oz * I.r * 1.05 + ox * 8];
  await setT(info.d, B.t);
  await stand(cam, [B.p[0], B.p[1] - 6, B.p[2]]);
  await settle(80); await setT(info.d, B.t); await step(10);
  wp = await ev(() => { const W = VR.WunderGame.state(VR.game).whale; return { vis: W.vis, mode: W.mode, p: Array.from(W.p).map(Math.round), glow: W.glow }; });
  check(wp.vis === 1 && wp.mode === 'route', 'the whale is there on its loop at dusk ' + JSON.stringify(wp));
  await stand(cam, [wp.p[0], wp.p[1] - 4, wp.p[2]]);
  await grab('whale', 'wunder_whale.png', 6);
}
// ---------------------------------------------------------------- 2 · the flute, the answer, the ride
const fl = await ev(() => { const g = VR.game; VR.WunderGame.learn(g, null); const inv = g.player.inv; const i = inv.slots.findIndex(s => s && s.id === 'wunder_flute'); if (i >= 0 && i < 9) inv.sel = i; else { inv.slots[0] = { id: 'wunder_flute', n: 1 }; inv.sel = 0; } return { learned: g.meta.wunder.learned, held: inv.held && inv.held.id }; });
check(fl.learned && fl.held === 'wunder_flute', 'the flute learnt and held');
if (B) {
  // stand on the nearest isle's crown, under the whale's loop, at a song
  const spot = await ev(([d]) => {
    const g = VR.game, R = VR.WunderGame.state(g), WU = VR.Wunder, W = WU.WHALE, o = new Float32Array(10), L = VR.IslesGen.list({ seed: g.meta.seed });
    const t = W.songFrom + W.songEvery * 1 + 10; WU.whaleAt(R.seed, R.loop, d * 24000 + t, o);
    let best = null, bd = 1e9; for (const I of L) { const dd = Math.hypot(I.x - o[0], I.z - o[2]); if (dd < bd) { bd = dd; best = I; } }
    return { t, w: [o[0], o[1], o[2]], isle: { x: best.x, z: best.z, y: best.y, r: best.r } };
  }, [info.d]);
  const I = spot.isle;
  await setT(info.d, spot.t);
  await stand([I.x + 4, I.y + 12, I.z + 4], spot.w);
  await settle(50);
  await ev(() => { const p = VR.game.player; p.flying = false; });
  await step(40);
  await setT(info.d, spot.t + 130);   // (the song has ended: the answer's window)
  await step(4);
  const before = await ev(() => { const g = VR.game, R = VR.WunderGame.state(g); return { song: R.song, mode: R.whale.mode, d: Math.round(Math.hypot(R.whale.p[0] - g.player.pos[0], R.whale.p[1] - g.player.pos[1], R.whale.p[2] - g.player.pos[2])) }; });
  await ev(() => { const g = VR.game; for (const k of [2, 1, 3, 2]) VR.WunderGame.play(g, k); });
  const after = await ev(() => VR.WunderGame.state(VR.game).whale.mode);
  check(after === 'descend', 'the flute\'s answer (1 · 3 · 2) after its song brings it down (before: ' + JSON.stringify(before) + ' → ' + after + ')');
  for (let i = 0; i < 60; i++) { await step(10, 50); if (await ev(() => VR.WunderGame.state(VR.game).whale.mode) === 'wait') break; }
  const waitP = await ev(() => { const g = VR.game, W = VR.WunderGame.state(g).whale; return { mode: W.mode, d: Math.round(Math.hypot(W.p[0] - g.player.pos[0], W.p[2] - g.player.pos[2])) }; });
  check(waitP.mode === 'wait' && waitP.d < 20, 'it waits beside you ' + JSON.stringify(waitP));
  // the [V] row offers to climb on
  const ctxTxt = await ev(() => { const g = VR.game, W = VR.WunderGame.state(g).whale, p = g.player; const e = p.eyePos(), dx = W.p[0] - e[0], dy = W.p[1] - e[1], dz = W.p[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); const r = VR.Ctx.resolve(VR.Ctx.gather(g)); return VR.Ctx.text(r); });
  check(/Himmelswal/.test(ctxTxt), '[V] offers: „' + ctxTxt + '"');
  await grab('wait', 'wunder_wait.png', 4);
  const boarded = await ev(() => VR.WunderGame.board(VR.game));
  check(boarded, 'aboard: it carries you');
  for (let i = 0; i < 12; i++) await step(10, 50);
  await grab('ride', 'wunder_ride.png', 6);
  let fin = null;
  for (let i = 0; i < 200; i++) { await step(10, 100); fin = await ev(() => { const g = VR.game, W = VR.WunderGame.state(g).whale; return { mode: W.mode, cam: VR.WunderGame.camOn, p: g.player.pos.map(Math.round) }; }); if (fin.mode !== 'ride') break; }
  check(fin && fin.mode === 'rejoin' && !fin.cam, 'it set you down in the valley and flies back to its loop ' + JSON.stringify(fin));
}
// ---------------------------------------------------------------- 3 · the Wanderbaum at dawn, its ring
const meadow = await ev(() => {
  const g = VR.game, w = g.world, R = VR.R, p = g.player.pos, F = VR.F;
  const nm = (x, y, z) => R.types[R.T.type[w.getBlock(x, y, z)]].name;
  const open = (x, z, r, y0) => { for (let dz = -r; dz <= r; dz += 3) for (let dx = -r; dx <= r; dx += 3) { const X = x + dx, Z = z + dz; if (!w.isLoaded(X, Z)) return false; let y = w.topAt(X, Z); while (y > 1 && !(R.T.flags[w.getBlock(X, y, Z)] & F.SOLID)) y--; if (nm(X, y, Z) !== 'grass_block' || Math.abs(y - y0) > 1 || w.topAt(X, Z) > y + 2) return false; } return true; };
  for (let r = 0; r < 220; r += 8) for (let k = 0; k < 24; k++) {
    const a = k / 24 * Math.PI * 2, x = Math.floor(p[0] + Math.cos(a) * r), z = Math.floor(p[2] + Math.sin(a) * r);
    if (!w.isLoaded(x, z)) continue;
    let y = w.topAt(x, z); while (y > 1 && !(R.T.flags[w.getBlock(x, y, z)] & F.SOLID)) y--;
    if (nm(x, y, z) !== 'grass_block') continue;
    if (open(x, z, 12, y) && open(x - 14, z, 6, y) && open(x + 6, z + 16, 9, y)) return [x + 0.5, y, z + 0.5];
  }
  return null;
});
check(!!meadow, 'a meadow near the valley spot ' + JSON.stringify(meadow));
if (meadow) {
  run.ring = await ev(([m]) => { const g = VR.game, WGm = VR.WunderGame; WGm.test.tree(g, m[0], m[2]); return WGm.test.ring(g, m[0] - 14, m[2]); }, [meadow]);
  await setT(info.d + 1, 600);
  await stand([meadow[0] - 26, meadow[1] + 2.5, meadow[2] + 18], [meadow[0] - 6, meadow[1] + 5, meadow[2]]);
  await settle(30); await setT(info.d + 1, 600); await step(6);
  const flowers = await ev(([m]) => { const w = VR.game.world, R = VR.R; let n = 0; for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) { const x = Math.floor(m[0] - 14 + dx), z = Math.floor(m[2] + dz), y = w.topAt(x, z); const nm = R.types[R.T.type[w.getBlock(x, y, z)]].name; if (/poppy|cornflower|daisy|allium|bluet|dandelion|lily/.test(nm)) n++; } return n; }, [meadow]);
  check(flowers >= 8, 'the ring of blossoms where it stood (' + flowers + ' flowers, placed ' + run.ring + ')');
  await grab('tree', 'wunder_tree.png', 6);
  const sit = await ev(() => { const g = VR.game, n0 = g.player.inv.count('lantern_seed'); VR.WunderGame.sit(g); return [n0, g.player.inv.count('lantern_seed')]; });
  check(sit[1] === sit[0] + 1, 'sitting under it by day: a lantern seed (' + sit.join(' → ') + ')');
  // it walks at night, never near you
  const walk = await ev(() => { const g = VR.game, m = g.meta.wunder, tr = m.tree, WU = VR.Wunder; tr.planned = -1; tr.tx = null; g.env.setTime(16000); const x0 = tr.x, z0 = tr.z; const p = g.player; p.teleport(tr.x + 5, p.pos[1], tr.z + 5); return { x0, z0 }; });
  await step(30, 100);
  const w1 = await ev(() => { const tr = VR.game.meta.wunder.tree; return { x: tr.x, z: tr.z, tx: tr.tx, walking: tr.walking }; });
  check(Math.hypot(w1.x - walk.x0, w1.z - walk.z0) < 0.01, 'at night it stands still while you are near ' + JSON.stringify(w1));
}
// ---------------------------------------------------------------- 4 · the Laternenhirsch leading at night
if (meadow) {
  await setT(info.d + 1, 18000);
  await ev(([m]) => { const g = VR.game; VR.WunderGame.test.deer(g, m[0] + 7, m[2] + 18, m[0] + 40, m[2] + 160); }, [meadow]);
  await stand([meadow[0] + 4, meadow[1] + 1, meadow[2] + 8], [meadow[0] + 7.5, meadow[1] + 2.4, meadow[2] + 18]);
  await ev(() => { const p = VR.game.player; p.flying = false; });
  await step(10, 33);
  const dd = await ev(() => { const D = VR.WunderGame.state(VR.game).deer; return D ? { x: D.x.toFixed(1), walking: D.walking } : null; });
  check(dd && dd.walking, 'the stag walks ahead ' + JSON.stringify(dd));
  await grab('deer', 'wunder_deer.png', 6);
  const van = await ev(() => { const g = VR.game, D = VR.WunderGame.state(g).deer; g.player.teleport(D.x + 1, D.y, D.z + 1); return true; });
  await step(4, 33);
  check(await ev(() => { const D = VR.WunderGame.state(VR.game).deer; return !D || D.gone > 0; }), 'within 3 m it vanishes in a swirl of Flausel' + (van ? '' : ''));
}
// ---------------------------------------------------------------- costs (Balanced), then Very Low's silhouette
const cost = async () => ev(() => { const g = VR.game, WGm = VR.WunderGame; const c0 = WGm.cost.ms, f0 = WGm.cost.frames; for (let i = 0; i < 2000; i++) WGm.frame(g, 0.0001); return { frameMs: (WGm.cost.ms - c0) / Math.max(1, WGm.cost.frames - f0), drawMs: WGm.cost.drawMs, draws: WGm.cost.draws }; });
run.costBal = await cost();
console.log('    Balanced: ' + JSON.stringify(run.costBal));
check(run.costBal.frameMs < 0.05, 'Balanced: ' + run.costBal.frameMs.toFixed(4) + ' ms a frame (< 0.05)');
if (B) {
  await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
  const out = [B.p[0] - pose.C[0], B.p[2] - pose.C[1]], ol = Math.hypot(out[0], out[1]) || 1;
  const cam = [B.p[0] + out[0] / ol * 300, B.p[1] - 60, B.p[2] + out[1] / ol * 300];
  await ev(() => { const W = VR.WunderGame.state(VR.game).whale; W.mode = 'route'; });
  await setT(info.d, B.t);
  await stand(cam, B.p);
  await settle(40); await setT(info.d, B.t); await step(6);
  await grab('vl', 'wunder_vl.png', 4);
  run.costVL = await cost();
  console.log('    Very Low: ' + JSON.stringify(run.costVL));
  check(run.costVL.draws >= 1 && run.costVL.draws <= 3, 'Very Low: the whale as a voxel silhouette, ' + run.costVL.draws + ' draw(s) through the voxel program');
}
// ---------------------------------------------------------------- the sheet
const rows = [];
if (pics.whale) rows.push({ label: 'Der Himmelswal zieht in der Dämmerung über die Himmelsinseln', imgs: [pics.whale] });
if (pics.wait || pics.ride) rows.push({ label: 'Mit der Flöte geantwortet (1 · 3 · 2): er sinkt herab — und trägt dich auf seinem Rücken', imgs: [pics.wait, pics.ride].filter(Boolean) });
if (pics.tree) rows.push({ label: 'Der Wanderbaum im Morgenlicht — wo er stand, blüht ein Ring', imgs: [pics.tree] });
if (pics.deer) rows.push({ label: 'Der Laternenhirsch führt dich durch die Nacht', imgs: [pics.deer] });
if (pics.vl) rows.push({ label: 'Sehr niedrig: der Himmelswal als ferne Silhouette', imgs: [pics.vl] });
if (rows.length) { fs.writeFileSync(ROOT + '/.tmp_tests/wunder_sheet.json', JSON.stringify({ w: 620, rows })); try { console.log('  ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'wunder_sheet.jpg', ROOT + '/.tmp_tests/wunder_sheet.json']).toString().trim()); } catch (e) { console.log('  !! sheet: ' + e.message); } }
const errs = logs.filter(l => /pageerror|\[error\]/.test(l) && !/favicon|ERR_FILE/.test(l));
run.logs = logs.slice(0, 20);
check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
save();
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
