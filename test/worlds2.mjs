// u-worlds2 in the browser (docs/superpowers/plans/2026-10-31-u-worlds2.md): a new Kreativ world (seed 4242), 960 × 540,
// de-DE, Balanced. On each native world: the arrival's view (the first village and its monument), the village from
// 100 m, every column round it shown (Zinnober's bug), a native up close, the culture moment at dusk and the player
// joining it (the gift); the cost at Ocker's village (Very Low / High, and Very Low in the moment)
// → test/shots/w2_<kind>_{arrive,far,native,culture}.png, test/shots/worlds2_species_sheet.jpg, .tmp_tests/worlds2_run.json
//   nohup bash test/wt_run.sh worlds2.mjs 3600 > .tmp_tests/worlds2.log 2>&1 &   (WORLDS=zinn,ocker · ONLY=cost)
// regress: skip  (a showcase with pictures; the gate is test/worlds2.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
const require = createRequire(import.meta.url);
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html';
const SHOTS = ROOT + '/test/shots/';
const SEED = process.env.SEED || '4242', DUR = +(process.env.DUR || 300);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, want = (s) => !ONLY || ONLY.includes(s);
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + ' (' + secs() + ')'); };
const run = { seed: SEED };
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/worlds2_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|world eco/i.test(s) || (process.env.DIAG && t === 'warning')) logs.push(`[${t}] ${s.slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto(DIST);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); if (window.__each) window.__each(g); } }, [Math.min(10, n - k), dtms]); await wait(3); } };
const settle = async (max = 50) => {
  let s = null;
  for (let i = 0; i < max; i++) {
    await step(20, 16);
    s = await ev(() => { const g = VR.game, w = g.world, p = g.player; if (!w || !p || g.state !== 'play') return { state: g.state }; const rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if (sc.dirty || sc.pending) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= rd * rd) dirty += n; } return { state: g.state, busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0 }; });
    if (s.state === 'play' && s.busy === 0 && s.pend === 0 && s.dirty === 0 && s.up === 0 && i > 2) break;
    await wait(30);
  }
  return s;
};
const grab = async (name, frames = 4) => {
  const url = await ev((frames) => { try { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; } catch (e) { window.__norender = true; return null; } }, frames);
  if (url && url.length > 2000) { fs.writeFileSync(SHOTS + name, Buffer.from(url.split(',')[1], 'base64')); console.log('  📷 ' + name); return SHOTS + name; }
  console.log('  !! no picture ' + name); return null;
};
const shotDom = async (name) => { try { await ev(() => { window.__norender = false; const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); window.__norender = true; }); await page.screenshot({ path: SHOTS + name, timeout: 120000 }); console.log('  📷 ' + name); return SHOTS + name; } catch (e) { console.log('  !! ' + name + ' ' + String(e.message).slice(0, 80)); return null; } };
async function trip(start, to) {
  await ev(start, to);
  for (let i = 0; i < 600; i++) { await step(10, 33); const s = await ev(() => ({ st: VR.game.state, dim: VR.game.dim, busy: VR.Travel.busy(VR.game) })); if (s.dim === to && s.st === 'play' && !s.busy) return true; await wait(20); }
  return false;
}
// look at a point from where the player stands (the eye's yaw / pitch)
const lookAt = (P) => ev((P) => { const p = VR.game.player, e = p.eyePos(), dx = P[0] - e[0], dy = P[1] - e[1], dz = P[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw; }, P);
const sheet = [];


for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Welten',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world');
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(6000); });
await settle(30);
const WORLDS = process.env.WORLDS ? process.env.WORLDS.split(',') : ['zinn', 'aqua', 'ocker', 'basalt', 'opal'];
const unshownNear = (V) => ev((V) => { const w = VR.game.world, cx0 = V.x >> 4, cz0 = V.z >> 4; let n = 0, all = 0; for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const c = w.col(cx0 + dx, cz0 + dz); all++; if (!c || c.shownAt < 0) n++; } return { n, all }; }, V);
for (const kind of WORLDS) {
  if (!want('worlds')) break;
  console.log('== ' + kind);
  const t0 = Date.now();
  const ok = await trip((d) => VR.Travel.go(VR.game, { dim: d, via: 'cmd' }), kind).catch(() => false);
  check(ok, `the jump to ${kind} (${Math.round((Date.now() - t0) / 1000)} s)`);
  if (!ok) continue;
  const row = [];
  await ev(() => { const g = VR.game; g.env.setTime(5200); if (g.ui && g.ui.show) g.ui.show(null); });
  await settle(40);
  // 1 · the arrival: the eye turned to the first village (worldlife.js), the landing's garden in front
  const ar = await ev(() => { const g = VR.game, p = g.player, e = VR.WorldLife.eco(g); return { yaw: p.yaw, land: e && e.land, s0: e && e.sites[0] && [e.sites[0].x, e.sites[0].y, e.sites[0].z], p: p.pos.map(Math.round) }; });
  const toV = ar.s0 ? Math.atan2(-(ar.s0[0] - ar.p[0]), -(ar.s0[2] - ar.p[2])) : 0;
  let dy = Math.abs(((ar.yaw - toV) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
  check(dy < 0.3, `${kind}: the arrival looks toward the first village (${(dy * 57.3).toFixed(0)}° off, ${ar.s0 ? Math.hypot(ar.s0[0] - ar.p[0], ar.s0[2] - ar.p[2]).toFixed(0) : '?'} m)`);
  await ev(() => { const p = VR.game.player; p.flying = true; p.pitch = -0.04; });
  await step(20);
  row.push(await grab(`w2_${kind}_arrive.png`));
  const vid = 'eco:' + kind + ':0';
  let V = null;
  for (let i = 0; i < 30; i++) { await step(20, 33); V = await ev((vid) => { const vil = VR.game.villages.sites.find(s => s.id === vid); return vil ? { x: vil.x, y: vil.y, z: vil.z, name: vil.name } : null; }, vid); if (V) break; await wait(200); }
  if (!V) { check(false, `${kind}: the village on the map`); continue; }
  // 2 · the village from 100 m (from the landing's side, 14 m up)
  if (!process.env.NATIVE) {
  const fx = ar.land ? ar.land[0] - V.x : 1, fz = ar.land ? ar.land[2] - V.z : 0, fl = Math.hypot(fx, fz) || 1;
  await ev(([V, ux, uz]) => { const p = VR.game.player; p.flying = true; p.teleport(V.x + ux * 100, V.y + 14, V.z + uz * 100); }, [V, fx / fl, fz / fl]);
  for (let i = 0; i < 60; i++) { await step(10, 33); if (await ev((V) => VR.game.world.isLoaded(V.x, V.z), V)) break; await wait(200); }
  await settle(60);
  await lookAt([V.x, V.y + 6, V.z]); await step(10);
  row.push(await grab(`w2_${kind}_far.png`));
  }
  // 3 · close by: every column round the village shown (the u-worlds bug on Zinnober)
  await ev((V) => { const p = VR.game.player; p.flying = true; p.teleport(V.x + 22, V.y + 11, V.z + 20); }, V);
  for (let i = 0; i < 90; i++) { await step(10, 33); const ok = await ev((V) => { const w = VR.game.world; for (const dx of [-24, 0, 24]) for (const dz of [-24, 0, 24]) if (!w.isLoaded(V.x + dx, V.z + dz)) return false; return true; }, V); if (ok) break; await wait(300); }
  await settle(60);
  let us = null;
  for (let i = 0; i < 20; i++) { us = await unshownNear(V); if (!us.n) break; await step(30, 33); await wait(100); }
  check(us && us.n === 0, `${kind}: every column round ${V.name} shown (${us ? us.all - us.n : 0} of ${us ? us.all : 0})`);
  // 4 · a native up close (the face and the body plan)
  let vs = null;
  for (let i = 0; i < 30; i++) { await step(20, 33); vs = await ev((vid) => { const v = VR.game.villages.known.get(vid); return v ? { active: v.active, agents: v.agents.length } : null; }, vid); if (vs && vs.active && vs.agents > 0) break; await wait(150); }
  // (one native posed and photographed in the same call — the village's life moves them between two calls: placed in
  // the open west of the plaza, standing, facing the camera 2.3 m off at a three-quarter angle; then from the side)
  const pose1 = (vid, side) => ev(([vid, side]) => { const g = VR.game, v = g.villages.known.get(vid); if (!v) return null; const pz = v.plan.plaza; const ag = v.agents.filter(o => !o.kid && o.pose !== 'sleep' && o.pose !== 'sit'); const a = ag[1] || ag[0] || v.agents[0]; if (!a) return null; const sc = VR.Folk.SPECIES_BODY[vid.split(':')[1]].scale;
    a.act = null; a.steer = null; a.pose = 'stand'; if (a.vel) { a.vel[0] = 0; a.vel[2] = 0; } a.walkAmt = 0; a.lookAt = null;
    a.pos[0] = pz.x - 8.5; a.pos[1] = pz.y; a.pos[2] = pz.z + 0.5; a.yaw = Math.PI / 2;
    const p = g.player, d = side ? 2.6 : 2.3, ang = side ? -Math.PI / 2 + 0.25 : 0.38;   // (the camera's bearing from the native's front)
    const fx = -Math.sin(a.yaw + ang), fz = -Math.cos(a.yaw + ang), hy = a.pos[1] + (side ? 1.0 : 1.45) * sc;
    p.flying = true; p.teleport(a.pos[0] + fx * d, hy - 1.62 + 0.15, a.pos[2] + fz * d);
    const e = p.eyePos(), dx = a.pos[0] - e[0], dy = hy - e[1], dz = a.pos[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw;
    window.__norender = false; for (let i = 0; i < 3; i++) { a.pos[0] = pz.x - 8.5; a.pos[2] = pz.z + 0.5; a.yaw = Math.PI / 2; a.act = null; a.steer = null; g.last = performance.now() - 33; g.loop(performance.now()); }
    const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true;
    return { url: u, name: a.name, sc, species: a.p.look.species };
  }, [vid, side]);
  const nat = await pose1(vid, false);
  check(nat && nat.species === kind, `${kind}: a native, ${nat ? nat.name : '?'} (×${nat ? nat.sc : '?'})`);
  for (const [n, side] of [['native', false], ['native_side', true]]) { const r = side ? await pose1(vid, true) : nat; if (r && r.url && r.url.length > 2000) { fs.writeFileSync(SHOTS + `w2_${kind}_${n}.png`, Buffer.from(r.url.split(',')[1], 'base64')); row.push(SHOTS + `w2_${kind}_${n}.png`); console.log('  📷 w2_' + kind + '_' + n + '.png'); } }
  if (nat) delete nat.url;
  if (process.env.NATIVE) { run[kind] = { native: nat }; save(); continue; }
  // 5 · the culture moment at dusk: the villagers gather in the ring round the monument; the player joins
  await ev(() => VR.game.env.setTime(12500));
  await ev((V) => { const p = VR.game.player; p.flying = true; p.teleport(V.x + 0.5, V.y + 2.4, V.z + 10.5); }, V);
  for (let i = 0; i < 25; i++) await step(40, 33);
  const fest = await ev((vid) => { const g = VR.game, v = g.villages.known.get(vid), F = v && v.fest; const pz = v.plan.plaza; const n = v.agents.filter(a => Math.hypot(a.pos[0] - pz.x, a.pos[2] - pz.z) < (pz.r || 4) + 4).length; return { on: g.villages.festivalOn(v, g.env.timeOfDay), n, agents: v.agents.length }; }, vid);
  await lookAt([V.x + 0.5, V.y + 2.5, V.z + 0.5]); await step(6);
  row.push(await grab(`w2_${kind}_culture.png`));
  check(fest.on && fest.n >= 4, `${kind}: the moment is on, ${fest.n} of ${fest.agents} in the ring`);
  await ev((V) => { const p = VR.game.player; p.flying = false; p.teleport(V.x + 5.5, V.y + 0.2, V.z + 0.5); }, V);
  for (let i = 0; i < 52; i++) { await step(10, 33); }
  const joined = await ev((vid) => { const g = VR.game; return { n: g.meta.ecoCult ? g.meta.ecoCult[vid] : 0, inv: VR.WorldLife.CULTURE[vid.split(':')[1]].gift.map(([id]) => g.player.inv.count ? g.player.inv.count(id) : -1) }; }, vid);
  check(joined.n === 1, `${kind}: joined the moment, the gift in the bag (${JSON.stringify(joined)})`);
  await ev(() => VR.game.env.setTime(5200));
  sheet.push({ label: `${kind}: arrival · village from 100 m · a native · its side · the culture moment`, imgs: row.filter(Boolean) });
  run[kind] = { arrive: dy, cols: us, native: nat, fest, joined };
  save();
}

// ---------------------------------------------------------------- the cost at Ocker's village (Very Low / High)
if (want('cost')) {
  await trip((d) => VR.Travel.go(VR.game, { dim: d, via: 'cmd' }), 'ocker');
  await settle(30);
  const V = await ev(() => { const s = VR.game.villages.sites.find(q => q.id === 'eco:ocker:0'); return s ? [s.x, s.y, s.z] : null; });
  const cost = {};
  const meas = () => ev(() => { const g = VR.game; window.__norender = false; for (let i = 0; i < 6; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); const ms = []; for (let i = 0; i < 16; i++) { const t = performance.now(); g.last = t - 33; g.loop(t); g.renderer.gl.finish(); ms.push(performance.now() - t); } window.__norender = true; ms.sort((a, b) => a - b); return { ms: +ms[8].toFixed(1), agents: g.villages.agents.length }; });
  if (V) for (const preset of ['potato', 'high']) {
    await ev((pr) => { const g = VR.game; g.applyPreset(pr); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); }, preset);
    for (const at of ['village', 'culture']) {
      if (at === 'culture' && preset === 'high') continue;
      await ev(([V, at]) => { const g = VR.game, p = g.player; g.env.setTime(at === 'culture' ? 12500 : 5200); p.flying = true; p.teleport(V[0] + 22, V[1] + 8, V[2] + 22); }, [V, at]);
      await settle(25);
      await lookAt([V[0], V[1], V[2]]);
      cost[preset + '_' + at] = await meas();
    }
  }
  run.cost = cost; console.log('  cost ' + JSON.stringify(cost));
  check(V && cost.potato_village, 'cost measured');
}

check(!logs.some(l => /pageerror/.test(l)), 'no page error' + (logs.length ? ': ' + logs.slice(0, 3).join(' · ') : ''));
save();
if (process.env.NATIVE) { sheet.length = 0; for (const k of WORLDS) { const imgs = ['arrive', 'far', 'native', 'native_side', 'culture'].map(n => SHOTS + `w2_${k}_${n}.png`).filter(f => fs.existsSync(f)); sheet.push({ label: `${k}: arrival · village from 100 m · a native · its side · the culture moment`, imgs }); } }
if (sheet.length) { fs.writeFileSync(ROOT + '/.tmp_tests/worlds2_sheet.json', JSON.stringify({ w: 620, rows: sheet })); try { console.log('  ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'worlds2_species_sheet.jpg', ROOT + '/.tmp_tests/worlds2_sheet.json']).toString().trim()); } catch (e) { console.log('  !! sheet ' + e.message); } }
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
