// u-worlds5 in the browser (docs/superpowers/plans/2026-10-31-u-worlds5.md): a new Kreativ world (seed 4242), 960 × 540,
// de-DE, High with the smooth people. On every native world (bgen 6): the town from above (the floor levelled and
// dressed, Aquamarin's pier quarter), a street between the homes (the gardens, the aprons), the view from the climbed
// landmark (the deck's toast and its reward once); the cost at Ocker's town vs its plain village (Very Low / High, the
// same spot as u-worlds4) and High's town as u-worlds4 had it (40 people at the villages' rates) for the before
// → test/shots/w5_*.png, test/shots/worlds5_sheet.jpg, .tmp_tests/worlds5_run.json
//   nohup bash test/wt_run.sh worlds5.mjs 3600 > .tmp_tests/worlds5.log 2>&1 &   (WORLDS=aqua,ocker · ONLY=worlds|cost)
// regress: skip  (a showcase with pictures; the gate is test/worlds5.js)
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
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/worlds5_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
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
const writeSheet = () => { if (!sheet.length) return; fs.writeFileSync(ROOT + '/.tmp_tests/worlds5_sheet.json', JSON.stringify({ w: 620, rows: sheet })); try { console.log('  ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'worlds5_sheet.jpg', ROOT + '/.tmp_tests/worlds5_sheet.json']).toString().trim()); } catch (e) { console.log('  !! sheet ' + e.message); } };

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.smoothFolk = true; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Welten',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world');
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(16500); });
await settle(30);

const WORLDS = process.env.WORLDS ? process.env.WORLDS.split(',') : ['aqua', 'ocker', 'zinn', 'basalt', 'opal'];
const LMN = { aqua: 'lighthouse', ocker: 'windcatcher', zinn: 'obelisk', basalt: 'observatory', opal: 'frost spire' };
for (const kind of (want('worlds') ? WORLDS : [])) {
  console.log('== ' + kind);
  const t0 = Date.now();
  const ok = await trip(kind).catch(() => false);
  check(ok, `the jump to ${kind} (${Math.round((Date.now() - t0) / 1000)} s)`);
  if (!ok) continue;
  const row = [], R = run[kind] = {};
  await ev(() => { const g = VR.game; if (g.ui && g.ui.show) g.ui.show(null); g.env.setTime(3600); });
  await settle(40);
  const vid = 'eco:' + kind + ':0';
  let V = null;
  for (let i = 0; i < 30; i++) { await step(20, 33); V = await ev((vid) => { const s = VR.game.villages.sites.find(q => q.id === vid); const eco = VR.WorldLife.eco(VR.game); return s ? { x: s.x, y: s.y, z: s.z, name: s.name, land: eco && eco.land } : null; }, vid); if (V) break; await wait(200); }
  if (!V) { check(false, `${kind}: the town on the map`); continue; }
  // the town from above: high on the landing's side, looking down over the plaza
  const L = V.land || [V.x - 100, V.y, V.z], dl = Math.hypot(V.x - L[0], V.z - L[2]), ux = (V.x - L[0]) / dl, uz = (V.z - L[2]) / dl;
  const OV = [V.x - ux * 70 - uz * 20, V.y + 48, V.z - uz * 70 + ux * 20], OT = [V.x + ux * 4, V.y, V.z + uz * 4];
  await lookFrom(OV, OT);
  await loaded([V.x, V.y, V.z], 80);
  await settle(80);
  let P = null;
  for (let i = 0; i < 60; i++) { await step(20, 33); P = await ev((vid) => { const v = VR.game.villages.known.get(vid); if (!v || !v.active) return null; const P = v.plan; return { town: !!P.town, homes: P.homes.length, agents: v.agents.length, people: v.people.length, dress: !!P.dress, climb: P.landmark && P.landmark.climb, lm: P.landmark && [P.landmark.x, P.landmark.y, P.landmark.z], F: P.y - 1 }; }, vid); if (P) break; await wait(150); }
  R.town = P;
  check(P && P.town && P.dress && P.climb, `${kind}: the town ${V.name} (bgen 6: dressed ${P && P.dress}, the ${LMN[kind]} climbable ${!!(P && P.climb)}; ${P ? P.agents : 0} of ${P ? P.people : 0} people about)`);
  check(P && P.agents <= 30, `${kind}: High wakes at most 30 (${P ? P.agents : '-'})`);
  // the floor in the world: columns on a grid inside the town at the floor (no hole, no raw hill, no open water)
  const fl = await ev(([X, Z, F]) => { const w = VR.game.world, R = VR.R; let n = 0, bad = 0, water = 0; const nm = {}; for (let dx = -60; dx <= 60; dx += 6) for (let dz = -60; dz <= 60; dz += 6) { if (!w.isLoaded(X + dx, Z + dz)) continue; const s = w.getBlock(X + dx, F, Z + dz); n++; const f = s ? R.T.flags[s] : 0; const below = w.getBlock(X + dx, F - 1, Z + dz), lag = !s && below && (R.T.flags[below] & VR.F.FLUID); if ((!s || !(f & VR.F.SOLID)) && !lag) { bad++; (nm.__bad = nm.__bad || []).push([dx, dz, s ? R.types[R.T.type[s]].name : 'air', below ? R.types[R.T.type[below]].name : 'air']); } if (f & VR.F.FLUID) water++; const k = s ? R.types[R.T.type[s]].name : 'air'; nm[k] = (nm[k] || 0) + 1; } const badL = nm.__bad || []; delete nm.__bad; return { n, bad, water, badL, top: Object.entries(nm).sort((a, b) => b[1] - a[1]).slice(0, 5) }; }, [V.x, V.z, P ? P.F : V.y]);
  R.floor = fl;
  check(fl.bad <= 2 && fl.water === 0, `${kind}: the floor in the world (${fl.n - fl.bad}/${fl.n}: ${fl.top.map(q => q.join(' ')).join(', ')})${fl.bad ? ' — not solid: ' + JSON.stringify(fl.badL) : ''}`);
  await step(60, 33);
  await lookFrom(OV, OT); await step(4);
  row.push(await grab(`w5_${kind}_town.png`));
  // a street: between the north homes, along the avenue's side at eye height (the gardens, the aprons, the doors)
  const F = P ? P.F : V.y;
  await lookFrom([V.x + 2.5, F + 2.7, V.z - 25], [V.x - 30, F + 0.6, V.z - 25]);   // (west through the gap between two homes)
  await loaded([V.x - 16, V.y, V.z - 25], 32); await settle(30); await step(20, 33);
  row.push(await grab(`w5_${kind}_street.png`));
  // the landmark: up its ladder's top onto the deck, looking back over the town; the view's toast once
  if (P && P.climb) {
    const C = P.climb;
    await ev(() => { const g = VR.game; g.ui.toasts = []; window.__toasts = []; if (!g.ui.__t5) { const t0 = g.ui.toast.bind(g.ui); g.ui.__t5 = true; g.ui.toast = (a, b, c) => { (window.__toasts = window.__toasts || []).push([a, b]); return t0(a, b, c); }; } });
    await ev((C) => { const p = VR.game.player; p.flying = false; p.teleport(C.x + 0.5, C.deck + 0.05, C.z + 2.5 > C.z + 2 ? C.z + (C.how === 'top' || C.how === 'dome' ? 1.5 : 2.5) : C.z + 1.5); p.vel && (p.vel[0] = p.vel[1] = p.vel[2] = 0); }, C);
    await step(60, 33);
    const vw = await ev(() => ({ last: VR.Towns.last || null, toasts: (window.__toasts || []).map(t => t.join(' — ')), pos: VR.game.player.pos.map(v => +v.toFixed(1)) }));
    R.view = vw;
    check(vw.last && vw.last.kind === kind && vw.last.first && vw.toasts.some(t => /erklommen/.test(t)), `${kind}: on the ${LMN[kind]}'s deck — ${vw.toasts.filter(t => /erklommen/.test(t)).join(' | ') || 'no toast'} (${vw.pos.join(', ')})`);
    await ev(([C, X, Z, F]) => { const p = VR.game.player; p.flying = true; if (C.how === 'dome') p.teleport(C.x + 0.5, C.deck + 0.05, C.z + 3.6); else p.teleport(p.pos[0], p.pos[1] + 1.6, p.pos[2]); const e = p.eyePos(), dx = X - e[0], dz = Z - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(F - e[1], Math.hypot(dx, dz)); p.viewYaw = p.yaw; }, [C, V.x, V.z, F]);
    await loaded([V.x, V.y, V.z], 64); await settle(30); await step(10, 33);
    await ev(() => { const el = document.querySelector('#toasts, .toasts'); if (el) el.style.visibility = 'hidden'; });
    row.push(await grab(`w5_${kind}_view.png`));
    await ev(() => { const el = document.querySelector('#toasts, .toasts'); if (el) el.style.visibility = ''; });
    // the ladder: from its foot inside the entrance, pressing forward, the player rises
    const up = await ev(async (C) => { const g = VR.game, p = g.player; p.flying = false; p.teleport(C.x + 0.5, C.y0 + 0.02, C.z + 1.6); p.yaw = 0; p.viewYaw = 0; p.pitch = 0; const y0 = p.pos[1]; const inp = g.input; const K = inp && inp.keys; if (K && K.add) K.add('KeyW'); else if (K) K['KeyW'] = true; for (let i = 0; i < 90; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } if (K && K.delete) K.delete('KeyW'); else if (K) K['KeyW'] = false; return { y0, y1: p.pos[1], ladder: p.onLadder }; }, C);
    R.ladder = up;
    console.log('  · ladder ' + JSON.stringify(up));
  }
  sheet.push({ label: `${kind}: town from above · a street · the view from the ${LMN[kind]}`, imgs: row.filter(Boolean) });
  save(); writeSheet();
}

// ---------------------------------------------------------------- the cost at Ocker's town vs its plain village (the same spot as u-worlds4)
if (want('cost')) {
  if (await ev(() => VR.game.dim) !== 'ocker') console.log('  · to ocker ' + await trip('ocker') + ' (' + secs() + ')');
  await settle(30);
  const S = await ev(() => VR.game.villages.sites.filter(q => /^eco:ocker:[01]$/.test(q.id)).map(s => [s.x, s.y, s.z, s.id]));
  const cost = {};
  await ev(() => VR.game.env.setTime(3600));
  const measure0 = () => ev(() => { const g = VR.game; window.__norender = false; for (let i = 0; i < 8; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); const ms = []; for (let k = 0; k < 3; k++) for (let i = 0; i < 16; i++) { const t = performance.now(); g.last = t - 33; g.loop(t); g.renderer.gl.finish(); ms.push(performance.now() - t); } window.__norender = true; ms.sort((a, b) => a - b); return { ms: +ms[ms.length >> 1].toFixed(2), p25: +ms[ms.length >> 2].toFixed(2), agents: g.villages.agents.length }; });
  const once = () => Promise.race([measure0(), new Promise(res => setTimeout(() => res({ ms: 999, timeout: true }), 240000))]);
  const measure = async (name) => { const t = Date.now(); const r1 = await once(); await step(20, 33); const r2 = await once(); const r = r2.ms < r1.ms ? r2 : r1; r.runs = [r1.ms, r2.ms];   // (the lower of two medians: the machine is shared)
    cost[name] = r; console.log(`  · ${name}: ${JSON.stringify(r)} (${((Date.now() - t) / 1000).toFixed(0)} s, ${secs()}, load ${fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0]})`); return r; };
  const preset = (pr) => ev((pr) => { const g = VR.game; g.applyPreset(pr); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); }, pr);
  // the town first (Very Low, High, High broken down, High as u-worlds4 had it: 40 people at the villages' rates), then the village
  for (const V of S) {
    const at = V[3].endsWith(':0') ? 'town' : 'village';
    await preset('potato');
    await lookFrom([V[0] + 22, V[1] + 8, V[2] + 22], [V[0], V[1], V[2]]);
    const ld = await loaded(V, 32); await settle(25); await step(90, 33);
    console.log(`  · ${at}: loaded ${ld} (${secs()})`);
    await lookFrom([V[0] + 22, V[1] + 8, V[2] + 22], [V[0], V[1], V[2]]);
    await measure('potato_' + at);
    await preset('high'); await settle(20); await step(90, 33);
    await lookFrom([V[0] + 22, V[1] + 8, V[2] + 22], [V[0], V[1], V[2]]);
    await measure('high_' + at);
    if (at === 'town') {
      // (u-worlds5 run 2: replacing the villages' draw or update for a breakdown stalled the page — left out)
      await ev(() => { const N = VR.Natives; N.__c = N.CAP_TOP; N.__r = N.LOD_R; N.CAP_TOP = 99; N.LOD_R = 1e6; for (const v of VR.game.villages.known.values()) v._capP = null; });
      await step(60, 33);
      await lookFrom([V[0] + 22, V[1] + 8, V[2] + 22], [V[0], V[1], V[2]]);
      await measure('high_town_before');
      await ev(() => { const N = VR.Natives; N.CAP_TOP = N.__c; N.LOD_R = N.__r; for (const v of VR.game.villages.known.values()) v._capP = null; });
      await step(30, 33);
    }
  }
  run.cost = cost; run.load = fs.readFileSync('/proc/loadavg', 'utf8').trim();
  console.log('  cost ' + JSON.stringify(cost) + ' load ' + run.load);
  const dv = cost.potato_town && cost.potato_village ? cost.potato_town.ms - cost.potato_village.ms : 99;
  check(dv <= 1.0, `Very Low: the town ${cost.potato_town && cost.potato_town.ms} ms vs the village ${cost.potato_village && cost.potato_village.ms} ms (Δ ${dv.toFixed(2)} ≤ 1 ms; agents ${cost.potato_town && cost.potato_town.agents})`);
  check(cost.high_town && cost.high_town.ms <= 11, `High: the town ${cost.high_town && cost.high_town.ms} ms ≤ 11 (village ${cost.high_village && cost.high_village.ms}; agents ${cost.high_town && cost.high_town.agents})`);
}

check(!logs.some(l => /pageerror/.test(l)), 'no page error' + (logs.length ? ': ' + logs.slice(0, 3).join(' · ') : ''));
save();
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
