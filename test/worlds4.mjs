// u-worlds4 in the browser (docs/superpowers/plans/2026-10-31-u-worlds4.md): a new Kreativ world (seed 4242), 960 × 540,
// de-DE, High with the smooth people. The first jump at night (Aquamarin): it lands in the morning, the landing's garden.
// On every native world: the town (≥ 15 homes, a hall, a market, the landmark) by day from above and along its avenue,
// the routines (market by day, hall at dusk, lamplighters at night), the town at dusk, a native through the talk camera
// (the head ≥ 15 % of the frame); the cost at Ocker's town vs its plain village (Very Low / High)
// → test/shots/w4_*.png, test/shots/worlds4_sheet.jpg, .tmp_tests/worlds4_run.json
//   nohup bash test/wt_run.sh worlds4.mjs 3600 > .tmp_tests/worlds4.log 2>&1 &   (WORLDS=aqua,ocker · ONLY=worlds|cost)
// regress: skip  (a showcase with pictures; the gate is test/worlds4.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '').replace(/\/\.tmp_tests$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html';
const SHOTS = ROOT + '/test/shots/';
const SEED = process.env.SEED || '4242';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, want = (s) => !ONLY || ONLY.includes(s);
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + ' (' + secs() + ')'); };
const run = { seed: SEED };
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/worlds4_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|world eco/i.test(s)) logs.push(`[${t}] ${s.slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto(DIST);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { if (window.__each) window.__each(g); g.last = performance.now() - d; g.loop(performance.now()); if (window.__each) window.__each(g); } }, [Math.min(10, n - k), dtms]); await wait(3); } };
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
  const url = await ev((frames) => { try { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { if (window.__each) window.__each(g); g.last = performance.now() - 33; g.loop(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; } catch (e) { window.__norender = true; return null; } }, frames);
  if (url && url.length > 2000) { fs.writeFileSync(SHOTS + name, Buffer.from(url.split(',')[1], 'base64')); console.log('  📷 ' + name); return SHOTS + name; }
  console.log('  !! no picture ' + name); return null;
};
async function trip(to) {
  await ev((to) => VR.Travel.go(VR.game, { dim: to, via: 'cmd' }), to);
  for (let i = 0; i < 600; i++) { await step(10, 33); const s = await ev(() => ({ st: VR.game.state, dim: VR.game.dim, busy: VR.Travel.busy(VR.game) })); if (s.dim === to && s.st === 'play' && !s.busy) return true; await wait(20); }
  return false;
}
const lookFrom = (P, T) => ev(([P, T]) => { const p = VR.game.player; p.flying = true; p.teleport(P[0], P[1], P[2]); const e = p.eyePos(), dx = T[0] - e[0], dy = T[1] - e[1], dz = T[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw; }, [P, T]);
const loaded = async (C, r) => { for (let i = 0; i < 120; i++) { await step(10, 33); const ok = await ev(([C, r]) => { const w = VR.game.world; for (let dx = -r; dx <= r; dx += 16) for (let dz = -r; dz <= r; dz += 16) if (!w.isLoaded(C[0] + dx, C[2] + dz)) return false; return true; }, [C, r]); if (ok) return true; await wait(250); } return false; };
const acts = (vid) => ev((vid) => { const v = VR.game.villages.known.get(vid), c = {}; if (!v) return c; for (const a of v.agents) { const t = (a.act && a.act.type) || '-'; c[t] = (c[t] || 0) + 1; } return c; }, vid);
const sheet = [];
// (the sheet after every world: a run cut short keeps its pictures' sheet)
const writeSheet = () => { if (!sheet.length) return; fs.writeFileSync(ROOT + '/.tmp_tests/worlds4_sheet.json', JSON.stringify({ w: 620, rows: sheet })); try { console.log('  ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'worlds4_sheet.jpg', ROOT + '/.tmp_tests/worlds4_sheet.json']).toString().trim()); } catch (e) { console.log('  !! sheet ' + e.message); } };

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.smoothFolk = true; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Welten',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world');
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(16500); });
await settle(30);
const WORLDS = process.env.WORLDS ? process.env.WORLDS.split(',') : ['aqua', 'ocker', 'zinn', 'basalt', 'opal'];
let first = true;
for (const kind of (want('worlds') ? WORLDS : [])) {
  console.log('== ' + kind);
  const t0 = Date.now();
  const ok = await trip(kind).catch(() => false);
  check(ok, `the jump to ${kind} (${Math.round((Date.now() - t0) / 1000)} s)`);
  if (!ok) continue;
  const row = [], R = run[kind] = {};
  await ev(() => { const g = VR.game; if (g.ui && g.ui.show) g.ui.show(null); });
  await settle(40);
  for (let i = 0; i < 20; i++) { await step(10, 33); if (await ev(() => VR.WorldLife.st.said === VR.game.dim + ':' + VR.game.meta.seed)) break; }
  const tod = await ev(() => VR.game.env.timeOfDay);
  R.arrivalTod = tod;
  if (first) check(tod < 4000, `${kind}: the first jump at night lands in the morning (time ${Math.round(tod)})`);
  // the landing (the arrival's vista toward the town)
  if (kind === 'aqua') { await ev(() => { const g = VR.game; g.env.setTime(3200); const p = g.player; p.pitch = -0.1; }); await step(4); row.push(await grab('w4_aqua_land.png')); }
  first = false;
  await ev(() => VR.game.env.setTime(3600));
  // the town
  const vid = 'eco:' + kind + ':0';
  let V = null;
  for (let i = 0; i < 30; i++) { await step(20, 33); V = await ev((vid) => { const s = VR.game.villages.sites.find(q => q.id === vid); const eco = VR.WorldLife.eco(VR.game); return s ? { x: s.x, y: s.y, z: s.z, name: s.name, land: eco && eco.land } : null; }, vid); if (V) break; await wait(200); }
  if (!V) { check(false, `${kind}: the town on the map`); continue; }
  const L = V.land || [V.x - 100, V.y, V.z], dl = Math.hypot(V.x - L[0], V.z - L[2]), ux = (V.x - L[0]) / dl, uz = (V.z - L[2]) / dl;
  const OV = [V.x - ux * 58 - uz * 14, V.y + 26, V.z - uz * 58 + ux * 14], OT = [V.x + ux * 6, V.y + 2, V.z + uz * 6];
  await lookFrom(OV, OT);
  await loaded([V.x, V.y, V.z], 64);
  await settle(80);
  let vs = null;
  for (let i = 0; i < 60; i++) { await step(20, 33); vs = await ev((vid) => { const v = VR.game.villages.known.get(vid), w = VR.game.world; if (!v) return null; const P = v.plan, nm = (c) => { const s = w.getBlock(c[0], c[1], c[2]); return s ? VR.R.types[VR.R.T.type[s]].name : 'air'; }; return { active: v.active, town: !!P.town, homes: P.homes.length, people: v.people.length, agents: v.agents.length, hall: !!P.hall, stalls: P.work.filter(q => q.kind === 'stall').length, lm: P.landmark && P.landmark.shape, doors: P.homes.filter(h => /door/.test(nm(h.door))).length }; }, vid); if (vs && vs.active && vs.agents > 0 && vs.doors >= vs.homes - 1) break; await wait(200); }
  R.town = vs;
  check(vs && vs.town && vs.homes >= 15 && vs.hall && vs.stalls >= 3 && vs.lm, `${kind}: the town ${V.name} — ${vs ? vs.homes : 0} homes (${vs ? vs.doors : 0} doors in the world), a hall, ${vs ? vs.stalls : 0} stalls, the ${vs ? vs.lm : '—'}`);
  check(vs && vs.agents >= 10, `${kind}: ${vs ? vs.agents : 0} of ${vs ? vs.people : 0} people about (High wakes all)`);
  await step(300, 33);
  const day = await acts(vid); R.day = day;
  check((day.market || 0) >= 2, `${kind}: by day at the market ${day.market || 0} (${JSON.stringify(day)})`);
  await lookFrom(OV, OT); await step(4);
  row.push(await grab(`w4_${kind}_town.png`));
  // along the north avenue to the landmark
  await lookFrom([V.x + 0.5, V.y + 4, V.z - 12], [V.x + 0.5, V.y + 8, V.z - 64]);
  await loaded([V.x, V.y, V.z - 40], 32); await settle(40);
  row.push(await grab(`w4_${kind}_avenue.png`));
  // dusk: the hall fills; the town from lower down (the paving's tones)
  await ev(() => VR.game.env.setTime(11400));
  await step(600, 33);
  const dusk = await acts(vid); R.dusk = dusk;
  check((dusk.hall || 0) >= 3, `${kind}: at dusk in the hall ${dusk.hall || 0} (${JSON.stringify(dusk)})`);
  await lookFrom([V.x - ux * 22 + 3, V.y + 7, V.z - uz * 22 + 3], [V.x, V.y + 1, V.z]); await settle(20);
  row.push(await grab(`w4_${kind}_dusk.png`));
  // night: the lamplighters
  await ev(() => VR.game.env.setTime(15500));
  await step(300, 33);
  const night = await acts(vid); R.night = night;
  check((night.lantern || 0) >= 2, `${kind}: at night ${night.lantern || 0} lamplighters (${JSON.stringify(night)})`);
  // a native through the talk camera: held on the plaza's ring, the camera 2.4 m in front of it; the talk frames the head
  await ev(() => VR.game.env.setTime(3600));
  await step(60, 33);
  const nat = await ev((vid) => { const g = VR.game, v = g.villages.known.get(vid); if (!v) return null; const pz = v.plan.plaza; const ag = v.agents.filter(o => !o.kid && o.pose !== 'sleep' && o.pose !== 'sit' && o.role !== 'trader'); const a = ag[2] || ag[0]; if (!a) return null;
    window.__held = a; a.greetT = 0; const S = [pz.x + 5.5, pz.y, pz.z + 1.8];
    window.__each = () => { const pl = g.player.pos; a.act = null; a.steer = null; a.path = null; a.pose = 'stand'; if (a.vel) { a.vel[0] = 0; a.vel[2] = 0; } a.walkAmt = 0; a.pos[0] = S[0]; a.pos[1] = S[1]; a.pos[2] = S[2]; if (!(g.villages.talking === a)) a.yaw = Math.atan2(-(pl[0] - a.pos[0]), -(pl[2] - a.pos[2])) + 0.4; };
    for (const o of v.agents) if (o !== a && Math.hypot(o.pos[0] - S[0], o.pos[2] - S[2]) < 9) o.hush = { t: 40, spot: VR.Natives.hushSpot(o.pos, S) };
    const p = g.player; p.flying = true; p.teleport(S[0] - 0.6, S[1] + 0.05, S[2] - 2.4); const e = p.eyePos(); p.yaw = Math.atan2(-(S[0] - e[0]), -(S[2] - e[2])); p.pitch = -0.15; p.viewYaw = p.yaw;
    window.__each(g); return { name: a.name, species: a.p.look.species }; }, vid);
  if (nat) {
    for (let i = 0; i < 6; i++) { await step(6, 33); await ev(() => { window.__norender = false; const g = VR.game; window.__each(g); g.last = performance.now() - 33; g.loop(performance.now()); window.__norender = true; }); await wait(300); }
    await ev(() => VR.game.villages.openTalk(window.__held));
    await step(50, 33);
    await ev(() => { const el = document.getElementById('talk'); if (el) el.style.visibility = 'hidden'; });
    const pf = await ev(() => VR.Natives.last && { frac: VR.Natives.last.frac, fov: VR.Natives.last.fov * 57.3, d: VR.Natives.last.d, w: VR.Natives.last.w, kind: VR.Natives.last.kind });
    R.portrait = pf;
    row.push(await grab(`w4_${kind}_native.png`, 2));
    await ev(() => { const el = document.getElementById('talk'); if (el) el.style.visibility = ''; VR.game.villages.closeTalk(); window.__each = null; });
    check(pf && pf.kind === kind && pf.frac >= 0.15 && pf.w > 0.9, `${kind}: ${nat.name} through the talk camera — the head ${pf ? (pf.frac * 100).toFixed(0) : 0} % of the frame (fov ${pf ? pf.fov.toFixed(0) : '-'}°, ${pf ? pf.d.toFixed(1) : '-'} m)`);
    await step(60, 33);
    const back = await ev(() => VR.Natives.last ? VR.Natives.last.w : 0);
    check(back < 0.05, `${kind}: the view back to the game's own after the talk (${back.toFixed(3)})`);
  } else check(false, `${kind}: a native to talk to`);
  sheet.push({ label: `${kind}: ${kind === 'aqua' ? 'landing · ' : ''}town by day · avenue · dusk · native (talk camera)`, imgs: row.filter(Boolean) });
  save(); writeSheet();
}

// ---------------------------------------------------------------- the cost at Ocker's town vs its plain village
if (want('cost')) {
  if (await ev(() => VR.game.dim) !== 'ocker') console.log('  · to ocker ' + await trip('ocker') + ' (' + secs() + ')');
  await settle(30);
  const S = await ev(() => VR.game.villages.sites.filter(q => /^eco:ocker:[01]$/.test(q.id)).map(s => [s.x, s.y, s.z, s.id]));
  const cost = {};
  await ev(() => VR.game.env.setTime(3600));
  for (const preset of ['potato', 'high']) {
    await ev((pr) => { const g = VR.game; g.applyPreset(pr); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); }, preset);
    for (const V of S) {
      const at = V[3].endsWith(':0') ? 'town' : 'village';
      await lookFrom([V[0] + 22, V[1] + 8, V[2] + 22], [V[0], V[1], V[2]]);
      const ld = await loaded(V, 32); await settle(25); await step(90, 33);
      console.log(`  · ${preset} ${at}: loaded ${ld} (${secs()})`);
      await lookFrom([V[0] + 22, V[1] + 8, V[2] + 22], [V[0], V[1], V[2]]);
      const r = await ev(() => { const g = VR.game; window.__norender = false; for (let i = 0; i < 8; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); const ms = []; for (let k = 0; k < 3; k++) for (let i = 0; i < 16; i++) { const t = performance.now(); g.last = t - 33; g.loop(t); g.renderer.gl.finish(); ms.push(performance.now() - t); } window.__norender = true; ms.sort((a, b) => a - b); return { ms: +ms[ms.length >> 1].toFixed(2), p25: +ms[ms.length >> 2].toFixed(2), agents: g.villages.agents.length }; });
      cost[preset + '_' + at] = r;
    }
  }
  run.cost = cost; run.load = fs.readFileSync('/proc/loadavg', 'utf8').trim();
  console.log('  cost ' + JSON.stringify(cost) + ' load ' + run.load);
  const dv = cost.potato_town && cost.potato_village ? cost.potato_town.ms - cost.potato_village.ms : 99;
  check(cost.potato_town && cost.potato_town.agents <= 14, `Very Low: the town ${cost.potato_town && cost.potato_town.ms} ms vs the village ${cost.potato_village && cost.potato_village.ms} ms (Δ ${dv.toFixed(2)} ms; agents ${cost.potato_town && cost.potato_town.agents})`);
  check(dv <= 1.0, `Very Low: the town costs ≤ 1 ms more than a village (${dv.toFixed(2)})`);
}

check(!logs.some(l => /pageerror/.test(l)), 'no page error' + (logs.length ? ': ' + logs.slice(0, 3).join(' · ') : ''));
save();
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
