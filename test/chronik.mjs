// r-chronik in the browser (docs/superpowers/plans/2026-11-07-r-chronik.md): a new default world (seed 4242, Kreativ,
// Friedlich), 960 × 540, de-DE, Balanced. The Chronik starts in worker 0; three game days run accelerated (2-hour steps,
// the clock set by the test); then pictures:
//   chronik_book.png    the Wanderbuch with its „Chronik" page (the last events with icons)
//   chronik_built.png   a building a village finished in the Chronik, built on its lot when the village was near
//   chronik_family.png  a family (a fox family when there is one) where the Chronik placed it, mother and young
//   chronik_gossip.png  a villager quoting a Chronik event in a speech bubble
//   → test/shots/chronik_sheet.jpg (German captions), .tmp_tests/chronik_run.json (costs, events)
//   nohup bash test/wt_run.sh chronik.mjs 3600 > .tmp_tests/chronik.log 2>&1 &
// regress: skip  (a showcase with pictures; the gate is test/chronik.js)
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
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/chronik_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|chronik/i.test(s)) logs.push(`[${t}] ${s.slice(0, 400)}`); });
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

const stand = (P, look) => ev(([P, L]) => { const p = VR.game.player; p.flying = true; p.teleport(P[0], P[1], P[2]); p.vel = [0, 0, 0]; const e = [P[0], P[1] + 1.6, P[2]], dx = L[0] - e[0], dy = L[1] - e[1], dz = L[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw; }, [P, look]);
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.playerName = 'Mila'; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Chronik',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:false})`);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world');
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeWeather = true; g.zenFreezeTime = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(3000); });
await settle(20); await step(30, 33);
// ---------------------------------------------------------------- the Chronik starts
const CGs = () => ev(() => { const g = VR.game, R = g._chr; return R ? { st: R.st, busy: R.busy, n: R.view ? R.view.ev.length : 0, day: R.view ? R.view.day : -1 } : null; });
for (let i = 0; i < 60; i++) { await step(10, 50); await wait(200); const s = await CGs(); if (s && s.st !== 'new' && !s.busy) break; }
const s0 = await CGs();
run.init = await ev(() => ({ st: VR.game._chr && VR.game._chr.st, workerMs: VR.ChronikGame.cost.workerMs, sim: VR.ChronikGame.cost.workerSim, vil: VR.game._chr && VR.game._chr.view ? VR.game._chr.view.vil.map(v => v.name) : [] }));
check(s0 && s0.st === 'ready', 'the Chronik runs in the worker (init ' + Math.round(run.init.workerMs || 0) + ' ms round trip; villages in the region: ' + (run.init.vil || []).join(', ') + ')');
// ---------------------------------------------------------------- three game days, accelerated
const advanceTo = async (day, ticks) => {
  await ev(([d, t]) => { const g = VR.game; g.env.day = d; g.env.setTime(t); VR.ChronikGame.stepNow(g); }, [day, ticks]);
  for (let i = 0; i < 40; i++) { await step(2, 50); const s = await CGs(); if (s && !s.busy && s.day >= day) return true; await wait(40); }
  return false;
};
const tA = Date.now();
for (let h = 2; h <= 72; h += 2) await advanceTo(Math.floor(h / 24), (h % 24) * 1000);
let v1 = await ev(() => { const v = VR.game._chr.view; return { day: v.day, ev: v.ev.map(e => [e.k, e.imp, e.d]), fam: v.fam, vil: v.vil.map(x => [x.id, x.name, x.built.join(','), x.proj && x.proj.k]), out: VR.game._chr.took.length, texts: v.ev.slice(-8).map(e => VR.Chronik.text(e, v)) }; });
run.days3 = { ms: Date.now() - tA, events: v1.ev.length, fam: v1.fam.length, vil: v1.vil, texts: v1.texts };
check(v1.day >= 3 && v1.ev.length >= 4, `three game days later: ${v1.ev.length} events, ${v1.fam.length} families (${((Date.now() - tA) / 1000).toFixed(0)} s)`);
for (const t of v1.texts) console.log('      · ' + t);
// which villages have a free lot to build on (the worker's village plans; a village without one keeps its building in
// the ledger only) — then on, day by day (≤ day 14), until one of them finished a project and a fox family lives
const lots = await ev(async () => { const g = VR.game, out = {}; for (const v of g._chr.view.vil) out[v.id] = await new Promise((res) => g.pool.direct(0, { type: 'villageplan', dim: 'overworld', vid: v.id }, null, (m) => res(m.plan ? m.plan.lots.length : 0))); return out; });
run.lots = lots;
console.log('    lots per village: ' + JSON.stringify(lots));
let extra = 0;
for (let d = 4; d <= 14; d++) {
  const has = await ev((L) => { const v = VR.game._chr.view; return { b: v.vil.some(x => x.built.length && L[x.id] > 0), f: v.fam.some(f => f.sp === 'fox') }; }, lots);
  if (has.b && has.f) break;
  for (let h = 2; h <= 24; h += 2) await advanceTo(d - 1 + Math.floor(h / 24), (h % 24) * 1000);
  extra = d;
}
if (extra) console.log('    (ran on to day ' + extra + ' for a building on a lot and a fox family)');
run.extraDays = extra;
v1 = await ev(() => { const v = VR.game._chr.view; return { day: v.day, ev: v.ev.map(e => [e.k, e.imp, e.d, e.v.vil || '', e.v.b || '']), fam: v.fam, vil: v.vil.map(x => ({ id: x.id, name: x.name, x: x.x, z: x.z, built: x.built })) }; });
// ---------------------------------------------------------------- the newly built building
const builtV = v1.vil.filter(x => x.built.length && lots[x.id] > 0).sort((p, q) => Math.hypot(p.x, p.z) - Math.hypot(q.x, q.z))[0];
if (builtV) {
  await stand([builtV.x + 0.5, 140, builtV.z + 0.5], [builtV.x, 80, builtV.z - 20]);
  for (let i = 0; i < 20; i++) { await settle(6); await step(10, 33); if (await ev((id) => { const v = VR.game.villages.known.get(id); return !!(v && v.active); }, builtV.id)) break; }
  let lb = null;
  for (let i = 0; i < 20 && !lb; i++) { await ev(() => VR.ChronikGame.stepNow(VR.game)); await ev(() => { VR.game.env.setTime(VR.game.env.ticks + 120); }); await step(4, 50); await wait(100); lb = await ev(() => VR.ChronikGame.lastBuilt); }
  run.built = lb;
  check(!!lb && lb.vid === builtV.id, 'a finished project built on its lot: ' + JSON.stringify(lb));
  if (lb && lb.at) {
    const at = lb.at;
    await settle(10);
    await ev(() => { VR.game.env.setTime(4200); VR.game.hideHud = true; });
    await stand([at[0] + 11, at[1] + 7, at[2] + 11], [at[0], at[1] + 2, at[2]]);
    await settle(10); await step(10, 33);
    await grab('built', 'chronik_built.png', 6);
    await ev(() => { VR.game.hideHud = false; });
  }
} else check(false, 'no village finished a building in ' + v1.day + ' days');
// ---------------------------------------------------------------- a family where the Chronik placed it
const fam = v1.fam.find(f => f.sp === 'fox') || v1.fam[v1.fam.length - 1];
if (fam) {
  const cell = await ev((f) => { const v = VR.game._chr.view, C = VR.Chronik; return [v.ox + ((f.c % 25) - C.R) * C.CELL + C.CELL / 2, v.oz + (Math.floor(f.c / 25) - C.R) * C.CELL + C.CELL / 2]; }, fam);
  await stand([cell[0] + 20, 130, cell[1] + 20], [cell[0], 70, cell[1]]);
  await settle(12);
  let sp = null;
  for (let i = 0; i < 20 && !sp; i++) { await ev(() => { VR.game.env.setTime(VR.game.env.ticks + 120); VR.ChronikGame.stepNow(VR.game); }); await step(4, 50); await wait(100); sp = await ev((fi) => { const s = VR.ChronikGame.spawned.find(q => q.i === fi); return s ? { at: s.at, sp: s.sp, kids: s.kids.length, mom: [s.mom.pos[0], s.mom.pos[1], s.mom.pos[2]] } : null; }, fam.i); }
  run.family = { fam, cell, sp };
  check(!!sp && Math.hypot(sp.at[0] - cell[0], sp.at[2] - cell[1]) < 50, `${fam.sp === 'fox' ? 'the fox family' : 'a ' + fam.sp + ' family'} is where the Chronik placed it: ${JSON.stringify(sp)}`);
  if (sp) {
    await step(20, 33);
    const m = await ev((fi) => { const s = VR.ChronikGame.spawned.find(q => q.i === fi); return s ? [s.mom.pos[0], s.mom.pos[1], s.mom.pos[2]] : null; }, fam.i);
    if (m) { await ev(() => { VR.game.env.setTime(4600); VR.game.hideHud = true; }); await stand([m[0] + 2.6, m[1] + 0.4, m[2] + 2.6], [m[0], m[1] + 0.2, m[2]]); await grab('family', 'chronik_family.png', 2); await ev(() => { VR.game.hideHud = false; }); }
  }
} else check(false, 'no family in the Chronik');
// ---------------------------------------------------------------- gossip quoting the Chronik
let said = null;
const vg = builtV || v1.vil.slice().sort((p, q) => Math.hypot(p.x, p.z) - Math.hypot(q.x, q.z)).find(x => lots[x.id] > 0);
if (vg) {
  await ev(() => { VR.game.env.setTime(3600); });
  await stand([vg.x + 0.5, 120, vg.z + 0.5], [vg.x, 80, vg.z - 10]);
  for (let i = 0; i < 12; i++) { await settle(6); await step(10, 33); if (await ev((id) => { const v = VR.game.villages.known.get(id); return !!(v && v.active && v.agents.length); }, vg.id)) break; }
  for (let tries = 0; tries < 30 && !said; tries++) {
    // stand 6 m beside a grown-up, then let the gossip look
    await ev((id) => { const g = VR.game, V = g.villages, v = V.known.get(id); if (!v) return; const as = v.agents.filter(a => !a.kid && a.pose !== 'sleep'); const a = as[(Date.now() >> 10) % Math.max(1, as.length)]; if (!a) return; const p = g.player; p.flying = false; p.teleport(a.pos[0] + 5, a.pos[1] + 0.2, a.pos[2] + 3); p.vel = [0, 0, 0]; VR.Gossip.lastSay = -1e9; }, vg.id);
    await step(30, 50);
    said = await ev(() => { const L = VR.ChronikGame.said; const s = L[L.length - 1]; return s && Date.now() - s.t < 8000 ? s : null; });
  }
  run.said = said;
  if (!said) run.gossipDiag = await ev((id) => { const g = VR.game, G = VR.Gossip, V = g.villages, v = V.known.get(id), p = g.player.pos; return { why: G.why, ticks: G.cost.ticks, on: G.on(g), act: v && v.active, n: v && v.agents.length, dPlan: v && Math.round(Math.hypot(p[0] - v.plan.x, p[2] - v.plan.z)), news: v ? VR.ChronikGame.newsFor(g, v, () => false) : null, near: v ? v.agents.map(a => [Math.round(Math.hypot(a.pos[0] - p[0], a.pos[2] - p[2])), a.kid ? 'k' : '', a.pose, !!a.bubble]).slice(0, 12) : null, talking: !!V.talking, blocking: g.ui && g.ui.blocking }; }, vg.id);
  if (!said) console.log('    diag ' + JSON.stringify(run.gossipDiag));
  check(!!said, 'a villager quotes the Chronik: ' + (said ? '„' + said.text + '"' : 'nothing said'));
  if (said) {
    await ev((who) => {
      const g = VR.game, p = g.player; let b = null; for (const q of g.villages.agents) if (q.p.id === who) b = q; if (!b) return;
      p.flying = true; const an = 0.6; const ex = b.pos[0] + Math.cos(an) * 4.2, ez = b.pos[2] + Math.sin(an) * 4.2, ey = b.pos[1] + 2.4; p.teleport(ex, ey - 1.6, ez); p.vel = [0, 0, 0];
      const dx = b.pos[0] - ex, dy = b.pos[1] + 1.4 - ey, dz = b.pos[2] - ez; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw; if (b.bubble) b.bubble.t = Math.max(b.bubble.t, 4);
    }, said.who);
    await step(3, 33);
    await shotDom('gossip', 'chronik_gossip.png');
  }
}
// ---------------------------------------------------------------- the Wanderbuch's Chronik page
const opened = await ev(() => VR.Wander && VR.Wander.open(VR.game));
await wait(300);
const bookTxt = await ev(() => { const el = document.querySelector('#wanderbuch .chsec'); return el ? el.innerText.slice(0, 600) : ''; });
check(opened && /Chronik/.test(bookTxt) && (bookTxt.match(/\n/g) || []).length > 3, 'the Wanderbuch has its Chronik page');
console.log('      ' + bookTxt.split('\n').slice(0, 7).join('\n      '));
await shotDom('book', 'chronik_book.png');
await ev(() => VR.Wander.close(VR.game));
// ---------------------------------------------------------------- costs and the save
const cost = await ev(() => {
  const g = VR.game, CG = VR.ChronikGame, R = g._chr; const keep = R.acc;
  const t0 = performance.now(); for (let i = 0; i < 20000; i++) { R.acc = 0; CG.frame(g, 0.0001); } const per = (performance.now() - t0) / 20000; R.acc = keep;
  return { frameMs: per, replies: CG.cost.replies, replyMs: CG.cost.replyMs / Math.max(1, CG.cost.replies), workerMs: CG.cost.workerMs, sim: CG.cost.workerSim, amortised: per + (CG.cost.replyMs / Math.max(1, CG.cost.replies)) / (CG.STEP * 60) };
});
run.cost = cost;
check(cost.amortised <= 0.05, `main thread: ${cost.frameMs.toFixed(5)} ms a frame + a reply ${cost.replyMs.toFixed(3)} ms every ${3} s → ${cost.amortised.toFixed(4)} ms a frame (≤ 0.05)`);
const sv = await ev(async () => { await VR.game.saveMeta(); const c = VR.game.meta.chronik; return c ? { v: c.v, len: JSON.stringify(c).length, ev: c.ev.length } : null; });
run.save = sv;
check(!!sv && sv.v === 1 && sv.len < 60000, 'saved in the world meta: ' + JSON.stringify(sv));
// ---------------------------------------------------------------- the sheet
const rows = [];
if (pics.book) rows.push({ label: 'Das Wanderbuch: die Chronik — was in der Welt geschah', imgs: [pics.book] });
if (pics.built) rows.push({ label: 'Ein Dorf hat sein neues Gebäude fertig (aus der Chronik gebaut)', imgs: [pics.built] });
if (pics.family) rows.push({ label: 'Eine Tierfamilie, genau dort, wo die Chronik sie geboren hat', imgs: [pics.family] });
if (pics.gossip) rows.push({ label: 'Dorfklatsch zitiert die Chronik', imgs: [pics.gossip] });
if (rows.length) { fs.writeFileSync(ROOT + '/.tmp_tests/chronik_sheet.json', JSON.stringify({ w: 620, rows })); try { console.log('  ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'chronik_sheet.jpg', ROOT + '/.tmp_tests/chronik_sheet.json']).toString().trim()); } catch (e) { console.log('  !! sheet ' + e.message); } }
const errs = logs.filter(l => /pageerror|\[error\]/.test(l) && !/favicon|ERR_FILE/.test(l));
run.logs = logs.slice(0, 20);
check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
save();
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
