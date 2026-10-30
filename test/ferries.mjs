// a-life in the browser (docs/superpowers/plans/2026-10-30-a-life.md §2): a new default world (seed 4242, creative,
// Friedlich), 960 × 540, de-DE, Balanced.
//   1 · /dim basalt: the settlement founded on the landing (the terminal, the pioneers' home, the dock), then three days
//       older (VR.Ferries.age): the greenhouses, the lamps, the builders' homes → moon_village.png (day), moon_village_night.png
//   2 · the dock: a ferry on its pad with its crew → ferry_dock.png; [V] → the panel → aboard: the chase view over the lift
//       → ride_ferry.png; the trip to Herzwelt; Herzwelt's ferry port (herz_port.png when it found a place)
//   3 · /raum herz: the traffic between the worlds → space_traffic.png; the star map's home card → trade_route.png
//   4 · /dim opal: its settlement of ice-block halls → opal_village.png; the ferry Opal → Basalt (the arrival shot →
//       ride_arrive.png), then a 5-min watching
//       session at the plaza: the watcher turns toward the nearest moving craft (as a player does) — the event log's
//       weighted events per minute (sessionstats.js) ≥ 2.0
//   5 · the frame at the plaza: Very Low and High, the life on / off (ms, draws)
//   → test/shots/life_sheet.jpg, .tmp_tests/ferries_run.json
//   nohup bash test/wt_run.sh ferries.mjs 3600 > .tmp_tests/ferries.log 2>&1 &
//   ONLY=village,dock,space,pilot,cost · SEED=4242 · DUR=300
// regress: skip  (a showcase with pictures and a measured session; the gate is test/ferries.js)
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
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/ferries_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 400)}`); });
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
  await ev(start);
  for (let i = 0; i < 600; i++) { await step(10, 33); const s = await ev(() => ({ st: VR.game.state, dim: VR.game.dim, busy: VR.Travel.busy(VR.game) })); if (s.dim === to && s.st === 'play' && !s.busy) return true; await wait(20); }
  return false;
}
// look at a point from where the player stands (the eye's yaw / pitch)
const lookAt = (P) => ev((P) => { const p = VR.game.player, e = p.eyePos(), dx = P[0] - e[0], dy = P[1] - e[1], dz = P[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw; }, P);
const sheet = [];

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Leben',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world');
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(6000); });
await settle(30);

// ---------------------------------------------------------------- 1 · the settlement on Basalt
check(await trip(() => { VR.Travel.go(VR.game, { dim: 'basalt', via: 'cmd' }); }, 'basalt'), 'the trip to Basalt');
await settle(40);
let st = null;
for (let i = 0; i < 40; i++) { await step(30, 33); st = await ev(() => { const g = VR.game, L = g.life, r = g.meta.life; return { site: r && r.sites.basalt ? { x: r.sites.basalt.x, y: r.sites.basalt.y, z: r.sites.basalt.z, hm: !!r.sites.basalt.hm } : null, pre: r && r.pre.basalt ? r.pre.basalt.slice() : [], plan: !!(L && L.plan), vil: !!(L && L.vil), name: L && L.name, err: VR.Ferries.stats.err }; }); if (st.vil && st.pre.length >= 2) break; await settle(3); }
run.found = st; console.log('  ' + JSON.stringify(st));
check(st && st.site && st.plan && st.pre.indexOf(0) >= 0 && st.pre.indexOf(1) >= 0, `founded on the landing: ${st && st.name} at ${st && st.site && [st.site.x, st.site.y, st.site.z].join(', ')} — the terminal and the pioneers' home stand`);
const dockOk = await ev(() => { const L = VR.game.life, d = L && L.plan && L.plan.dock; if (!d) return null; const b = VR.game.world.getBlock(d[0], d[1], d[2]); return VR.R.types[VR.R.T.type[b]].name; });
check(dockOk === 'ferry_dock', 'the dock post stands: ' + dockOk);
await ev(() => VR.Ferries.age(VR.game, 3));
for (let i = 0; i < 30; i++) { await step(30, 33); const s = await ev(() => { const g = VR.game, L = g.life; return { pre: g.meta.life.pre.basalt.length, built: L.vil ? (L.vil.st.built || []).length : -1, lots: L.vil ? L.vil.plan.lots.length : -1, people: L.vil ? L.vil.people.length : 0, q: !!L.q }; }); st = s; if (s.pre >= 5 && !s.q && s.built >= s.lots && s.lots > 0) break; }
run.grown = st; console.log('  grown ' + JSON.stringify(st));
check(st.pre >= 5 && st.built >= 5 && st.people >= 8, `three days later: ${st.pre} prefabs (greenhouses, lamps), ${st.built}/${st.lots} homes built, ${st.people} people`);
await settle(20);
const S = await ev(() => { const s = VR.game.life.site; return [s.x + 0.5, s.y + 1, s.z + 0.5]; });
await ev((S) => { const p = VR.game.player; p.flying = true; p.teleport(S[0] - 26, S[1] + 15, S[2] + 40); VR.game.hideHud = true; }, S);
await settle(20); await lookAt([S[0] + 2, S[1] + 1, S[2] - 4]);
// (the hero shot: a moment with no craft crossing within 200 m of the eye)
await ev(() => { const g = VR.game, A = g.life.actor, pad = A.pads.get('pass'), s = g.life.site, F = VR.Ferries; for (let k = 0; k < 40; k++) { let near = false; const t = A.clock; for (let j = Math.floor(t / F.PASS.slot) - 2; j <= Math.floor(t / F.PASS.slot); j++) { const q = F.passPos(F.passAt(pad.seed, j), t, s.x, s.y, s.z, null); if (q && Math.hypot(q.pos[0] - g.player.pos[0], q.pos[2] - g.player.pos[2]) < 200) near = true; } if (!near) break; A.clock += 9; } });
await step(20, 33);
const pv = await grab('moon_village.png', 6);
await ev(() => VR.game.env.setTime(18500)); await step(10, 33);
const pvn = await grab('moon_village_night.png', 6);
await ev(() => { VR.game.env.setTime(6000); VR.game.hideHud = false; });
sheet.push({ label: 'Basalt: eine Siedlung nach drei Tagen (Tag · Nacht)', imgs: [pv, pvn].filter(Boolean) });

// ---------------------------------------------------------------- 2 · the dock, the ride
const pad = await ev(() => { const L = VR.game.life; const p = [...L.actor.pads.values()].find(q => q.kind === 'ferry' && q.to === 'overworld'); if (!p) return null; const c = VR.PadLife.visitAt(p.seed, L.actor.clock, null, p.o); L.actor.clock = c.T + 34 - (p.shift || 0); return { key: p.key, x: p.x, y: p.y, z: p.z, stand: p.stand }; });
check(!!pad, 'a pad for the ferry to Herzwelt');
if (pad) {
  await ev((S) => { const p = VR.game.player; p.flying = false; p.teleport(S[0] + 4, S[1] + 0.2, S[2] + 7); }, S);
  for (let i = 0; i < 12; i++) { await step(10, 33); await wait(150); }
  await lookAt([pad.x, pad.y + 3, pad.z]); await step(10, 33);
  const fd = await ev(() => { const st = VR.game.life.actor.stats(); return st; });
  run.dock = fd; console.log('  dock ' + JSON.stringify(fd));
  check(fd.parked >= 1, `a ferry on its pad (${fd.phases.join(' · ')}), crew out ${fd.crewOn}`);
  const pd = await grab('ferry_dock.png', 6);
  // [V] at the dock: the panel
  await ev((S) => { const g = VR.game, d = g.life.plan.dock, p = g.player; p.teleport(d[0] + 0.5, d[1], d[2] + 2.6); }, S);
  await step(5, 33); const D = await ev(() => VR.game.life.plan.dock); await lookAt([D[0] + 0.5, D[1] + 0.8, D[2] + 0.5]); await step(10, 33);
  const near = await ev(() => { const g = VR.game, C = VR.Ctx; const e = g.player.eyePos(), d = g.player.lookDir(); for (const h of C.hooks.near) { const r = h(g, e, d); if (r && r.kind === 'ferry') return true; } return false; });
  check(near, '[V] at the dock: „Fähre nehmen"');
  await ev(() => VR.Ferries.openPanel(VR.game));
  const panel = await ev(() => { const el = document.getElementById('fepanel'); return el ? el.innerText : ''; });
  run.panel = panel; console.log('  panel: ' + panel.replace(/\n+/g, ' | '));
  check(/Fähre nach Herzwelt/.test(panel) && /Einsteigen/.test(panel), 'the panel: the routes, when, Einsteigen');
  const pp = await shotDom('ferry_panel.png');
  await ev(() => { const b = [...document.querySelectorAll('#fepanel [data-fe="go"]')].find(x => /Herzwelt/.test(x.parentElement.innerText)); if (b) b.click(); });
  let rd = null;
  for (let i = 0; i < 40; i++) { await step(10, 33); rd = await ev(() => { const L = VR.game.life, R = L && L.ride; if (!R) return { ride: false, dim: VR.game.dim }; const c = R.pad.crafts.get(R.m), q = c && c.q; return { ride: true, phase: q && q.phase, u: q && q.u, S: q && q.S, cam: VR.Ferries.camOn }; }); if (rd.ride && rd.phase === 'depart' && rd.u - rd.S > 5.5) break; }
  run.ride = rd; console.log('  ride ' + JSON.stringify(rd));
  check(rd && rd.ride && rd.cam && rd.phase === 'depart', 'aboard: the ferry lifts and climbs, the chase view');
  const pr = await grab('ride_ferry.png', 4);
  sheet.push({ label: 'Der Anleger: die Fähre, ihre Crew · An Bord: die Verfolgeransicht', imgs: [pd, pr].filter(Boolean) });
  if (pp) sheet.push({ label: '[V] am Anleger: die Fähren von hier', imgs: [pp] });
  let ok = false; for (let i = 0; i < 400; i++) { await step(10, 33); const s = await ev(() => ({ st: VR.game.state, dim: VR.game.dim, busy: VR.Travel.busy(VR.game) })); if (s.dim === 'overworld' && s.st === 'play' && !s.busy) { ok = true; break; } await wait(20); }
  check(ok, 'the ferry brought us to Herzwelt');
  await settle(40);
  let hp = null; for (let i = 0; i < 20; i++) { await step(30, 33); hp = await ev(() => { const r = VR.game.meta.life.docks.overworld; return r ? { x: r.x, y: r.y, z: r.z, pre: (VR.game.meta.life.pre.overworld || []).length } : null; }); if (hp && hp.pre >= 1) break; }
  run.herzPort = hp; console.log('  Herzwelt port ' + JSON.stringify(hp) + ' ' + JSON.stringify(await ev(() => VR.Ferries.stats.herz || null)));
  if (hp) { await ev((h) => { const p = VR.game.player; p.flying = true; p.teleport(h.x - 18, h.y + 14, h.z + 26); }, hp); await settle(15); await lookAt([hp.x, hp.y + 2, hp.z]); await step(20, 33); const hpp = await grab('herz_port.png', 6); if (hpp) sheet.push({ label: 'Herzwelt: der Fährhafen (am Spawn gefunden)', imgs: [hpp] }); }
}

// ---------------------------------------------------------------- 3 · space and the star map
if (want('space')) {
  await ev(() => { const g = VR.game; g.raumCommand('herz'); });
  // the view is shown once the worker has baked what it asked for (spacescene.js: ready, ≤ 45 s): wait for it
  let sv = null; const tv = Date.now();
  for (let i = 0; i < 400; i++) { await step(3, 33); sv = await ev(() => { const g = VR.game, need = VR.SpaceScene.cur_need || []; return g.space ? { ready: g.space.ready, frames: g.space.frames, done: need.filter(s => s.done).length, need: need.length } : { closed: true }; }); if (sv.closed || (sv.ready && sv.done === sv.need && sv.frames >= 3)) break; if (Date.now() - tv > 150000) break; await wait(60); }
  console.log('  space view ' + JSON.stringify(sv) + ' after ' + ((Date.now() - tv) / 1000).toFixed(0) + ' s');
  await step(10, 33);
  // look where the nearest craft is (as a player turning the view would): yaw/pitch as the player's lookDir
  const aim = await ev(() => {
    const g = VR.game, S = g.space, r = g.renderer; if (!S) return null;
    const conv = [(x, z) => Math.atan2(-x, -z), (x, z) => Math.atan2(x, z), (x, z) => Math.atan2(x, -z), (x, z) => Math.atan2(-x, z)];
    let best = null;
    for (let ci = 0; ci < conv.length; ci++) {
      for (let it = 0; it < 2; it++) {
        const n = VR.Ferries.stats.near; if (!n) return null;
        S.yaw = conv[ci](n[0], n[2]); S.pitch = Math.max(-1.4, Math.min(1.4, Math.atan2(n[1], Math.hypot(n[0], n[2]))));
        window.__norender = true; g.last = performance.now() - 33; g.loop(performance.now());
      }
      const n = VR.Ferries.stats.near, M = r.viewProj; if (!n || !M) continue;
      const P = [n[0] * 50, n[1] * 50, n[2] * 50], cx = M[0] * P[0] + M[4] * P[1] + M[8] * P[2] + M[12], cy = M[1] * P[0] + M[5] * P[1] + M[9] * P[2] + M[13], cw = M[3] * P[0] + M[7] * P[1] + M[11] * P[2] + M[15];
      const q = cw > 0 ? Math.max(Math.abs(cx / cw), Math.abs(cy / cw)) : 9;
      if (!best || q < best.q) best = { ci, q: +q.toFixed(2), yaw: S.yaw, pitch: S.pitch, km: +(n[3] / 1000).toFixed(1) };
    }
    if (best) { S.yaw = best.yaw; S.pitch = best.pitch; }
    return best;
  });
  console.log('  aim ' + JSON.stringify(aim));
  await step(10, 33);
  const sp = await ev(() => Object.assign({}, VR.Ferries.stats));
  run.space = sp; console.log('  space ' + JSON.stringify(sp));
  const ps = await grab('space_traffic.png', 4);
  check(sp.space > 0 && !sp.err, `the traffic between the worlds drawn in space: ${sp.space} craft (${sp.spaceMs.toFixed(2)} ms)`);
  await ev(() => VR.game.raumCommand('aus')); await step(10, 33);
  await ev(() => { VR.StarMap.open(VR.game); }); await step(10, 33);
  const pt = await shotDom('trade_route.png');
  const hasRoutes = await ev(() => !!document.querySelector('#smOrr[data-routes]'));
  check(hasRoutes, 'the star map: Helia\'s trade routes on the home card');
  await ev(() => VR.StarMap.close(VR.game)); await step(5, 33);
  sheet.push({ label: 'Im All: Fähren, Frachter, Kleinschiffe · Sternkarte: Handelsrouten', imgs: [ps, pt].filter(Boolean) });
}

// ---------------------------------------------------------------- 4 · Opal (its halls), by ferry back to Basalt, the watching session
let back = false;
if (await trip(() => { VR.Travel.go(VR.game, { dim: 'opal', via: 'cmd' }); }, 'opal')) {
  await settle(30);
  let so = null;
  for (let i = 0; i < 40; i++) { await step(30, 33); so = await ev(() => { const L = VR.game.life; return { vil: !!(L && L.vil), pre: ((VR.game.meta.life.pre || {}).opal || []).length }; }); if (so.vil) break; await settle(3); }
  await ev(() => VR.Ferries.age(VR.game, 3));
  for (let i = 0; i < 30; i++) { await step(30, 33); so = await ev(() => { const L = VR.game.life; return { pre: VR.game.meta.life.pre.opal.length, built: L.vil ? (L.vil.st.built || []).length : -1, q: !!L.q }; }); if (so.pre >= 5 && !so.q && so.built >= 6) break; }
  check(so.pre >= 5 && so.built >= 5, `Opal: a settlement of ice-block halls (${so.built} built, ${so.pre} prefabs)`);
  const O = await ev(() => { const s = VR.game.life.site; return [s.x + 0.5, s.y + 1, s.z + 0.5]; });
  await ev((O) => { const p = VR.game.player; p.flying = true; p.teleport(O[0] + 30, O[1] + 14, O[2] + 36); VR.game.hideHud = true; }, O);
  await settle(20); await lookAt([O[0] - 2, O[1] + 1, O[2] - 4]); await step(20, 33);
  const po = await grab('opal_village.png', 6);
  await ev(() => { VR.game.hideHud = false; });
  if (po) sheet.push({ label: 'Opal: Eisblock-Hallen, Gewächshaus, Anleger', imgs: [po] });
  await ev(() => { const L = VR.game.life, p = [...L.actor.pads.values()].find(q => q.kind === 'ferry' && q.to === 'basalt'); const c = VR.PadLife.visitAt(p.seed, L.actor.clock, null, p.o); L.actor.clock = c.T + 20 - (p.shift || 0); VR.Ferries.take(VR.game, p); });
  for (let i = 0; i < 500; i++) { await step(10, 33); const s = await ev(() => ({ st: VR.game.state, dim: VR.game.dim, busy: VR.Travel.busy(VR.game), arr: !!(VR.game.life && VR.game.life.arr) })); if (s.dim === 'basalt' && s.st === 'play' && !s.busy && s.arr) { back = true; break; } await wait(20); }
  if (back) { for (let i = 0; i < 9; i++) await step(10, 33); const pa = await grab('ride_arrive.png', 4); if (pa) sheet.push({ label: 'Mit der Fähre von Opal: Ankunft auf Basalt', imgs: [pa] }); for (let i = 0; i < 10; i++) await step(10, 33); }
  check(back, 'Opal → Basalt by ferry, the arrival shot over the pad');
}
if (!back) { await trip(() => { VR.Travel.go(VR.game, { dim: 'basalt', via: 'cmd' }); }, 'basalt'); await settle(30); }
if (want('pilot')) {
  await ev((S) => { const p = VR.game.player; p.flying = false; p.teleport(S[0] + 1, S[1] + 0.2, S[2] + 2); }, S);
  await settle(20);
  const t0 = await ev(() => VR.game.time);
  // the watcher: every half second the eye turns (eased) toward the nearest moving craft within 500 m — a ferry coming
  // in or leaving, a craft crossing the sky — else it drifts slowly round the plaza
  await ev(() => { window.__each = (g) => { const L = g.life, p = g.player; if (!L || !L.actor) return; const W = window.__w || (window.__w = { t: 0, tgt: null }); W.t -= 1 / 30; if (W.t <= 0) { W.t = 0.5; let best = null, bd = 500; for (const pad of L.actor.pads.values()) { if (!pad.live) continue; for (const q of pad.live) { if (q.phase === 'parked') continue; const d = Math.hypot(q.pos[0] - p.pos[0], q.pos[2] - p.pos[2]); if (d < bd) { bd = d; best = q.pos; } } } W.tgt = best; } const e = p.eyePos(); let yaw = p.yaw + 0.004, pitch = 0.05; if (W.tgt) { const dx = W.tgt[0] - e[0], dy = W.tgt[1] + 2 - e[1], dz = W.tgt[2] - e[2]; yaw = Math.atan2(-dx, -dz); pitch = Math.atan2(dy, Math.hypot(dx, dz)); } let dy2 = yaw - p.yaw; while (dy2 > Math.PI) dy2 -= 2 * Math.PI; while (dy2 < -Math.PI) dy2 += 2 * Math.PI; p.yaw += dy2 * 0.08; p.pitch += (pitch - p.pitch) * 0.08; p.viewYaw = p.yaw; }; });
  const N = Math.round(DUR * 30);
  for (let k = 0; k < N; k += 300) { await step(300, 33); }
  await ev(() => { window.__each = null; });
  const log = await ev((t0) => { const g = VR.game, E = VR.EventLog; return { t1: g.time, events: E.events(0).filter(e => e.t >= t0 - 1e-6), samples: E.samples(t0 - 1e-6) }; }, t0);
  const SSt = require(ROOT + '/src/shared/sessionstats.js');
  const m = SSt.analyze({ events: log.events, samples: log.samples, t0, t1: log.t1, exclude: [] });
  const subs = {}; for (const e of log.events) if (e.w >= 2) subs[e.sub] = (subs[e.sub] || 0) + (e.inView ? 1 : 0);
  run.pilot = { dur: log.t1 - t0, perMin: m.weighted.perMin, longest: m.gaps && m.gaps.longest, movers: m.movers, events: log.events.length, subs };
  console.log('  pilot ' + JSON.stringify(run.pilot));
  check(m.weighted.perMin >= 2.0, `the watching session on Basalt: ${m.weighted.perMin.toFixed(2)} weighted events seen a minute over ${((log.t1 - t0) / 60).toFixed(1)} min (target ≥ 2.0)`);
  save();
}

// ---------------------------------------------------------------- 5 · the frame's cost at the plaza
if (want('cost')) {
  await ev((S) => { const g = VR.game, p = g.player; p.flying = false; p.teleport(S[0] + 1, S[1] + 0.2, S[2] + 6); if (g.ui && g.ui.screen && g.ui.show) g.ui.show(null); }, S);
  await settle(15); await lookAt([S[0] + 1, S[1] + 2, S[2] - 10]);
  const cost = {};
  for (const preset of ['potato', 'high']) {
    await ev((pr) => { const g = VR.game; g.applyPreset(pr); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); }, preset);
    await settle(20);
    for (const life of [false, true, false, true]) {
      const r = await ev(([life]) => { const g = VR.game; g.settings.spaceLife = life; window.__norender = false; for (let i = 0; i < 6; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); const ms = []; let draws = 0; for (let i = 0; i < 16; i++) { const t = performance.now(); g.last = t - 33; g.loop(t); g.renderer.gl.finish(); ms.push(performance.now() - t); draws = g.renderer.stats.draws; } window.__norender = true; ms.sort((a, b) => a - b); return { ms: +ms[8].toFixed(1), draws, tris: g.renderer.stats.tris, state: g.state, screen: g.ui && g.ui.screen }; }, [life]);
      const k = preset + (life ? '_on' : '_off'); (cost[k] || (cost[k] = [])).push(r);
    }
  }
  await ev(() => { VR.game.settings.spaceLife = true; });
  run.cost = cost; console.log('  cost ' + JSON.stringify(cost));
  const med = (a) => a.map(x => x.ms).sort((x, y) => x - y)[0];
  check(med(cost.potato_on) <= med(cost.potato_off) * 1.15 + 2, `Very Low at the plaza: life on ${med(cost.potato_on)} ms, off ${med(cost.potato_off)} ms (High ${med(cost.high_on)} / ${med(cost.high_off)} ms)`);
}

check(!logs.some(l => /pageerror/.test(l)), 'no page error' + (logs.length ? ': ' + logs.slice(0, 3).join(' · ') : ''));
const err = await ev(() => VR.Ferries.stats.err); check(!err, 'ferries ran without an error' + (err ? ': ' + err.slice(0, 300) : ''));
save();
if (sheet.length) { fs.writeFileSync(ROOT + '/.tmp_tests/life_sheet.json', JSON.stringify({ w: 620, rows: sheet })); try { console.log('  ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'life_sheet.jpg', ROOT + '/.tmp_tests/life_sheet.json']).toString().trim()); } catch (e) { console.log('  !! sheet ' + e.message); } }
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
