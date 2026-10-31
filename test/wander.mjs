// o-wander in the browser (docs/superpowers/plans/2026-10-31-o-wander.md): a new Kreativ world (seed 4242), 960 × 540,
// de-DE, High. A scripted walk on foot — the walker follows the Wegballon to the next place and turns to whatever the
// Wanderregisseur stages ahead (a curious walker): 5 minutes on Herzwelt (morning → noon → afternoon → a shower and its
// rainbow → dusk → night) and 3 minutes on Aquamarin. The timeline of moments (the gap ≤ 40 s), a picture every 30 s
// (aimed at the newest moment), the Wanderbuch's page; the cost on Very Low and High with the director off and on.
// → test/shots/wd_*.png, test/shots/wander_sheet.jpg, .tmp_tests/wander_run.json
//   nohup bash test/wt_run.sh wander.mjs 3600 > .tmp_tests/wander.log 2>&1 &   (ONLY=heart,aqua,cost · HEART_S, AQUA_S)
// regress: skip  (a showcase with pictures; the gate is test/wander.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '').replace(/\/\.tmp_tests$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html';
const SHOTS = ROOT + '/test/shots/';
const SEED = process.env.SEED || '4242';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, want = (s) => !ONLY || ONLY.includes(s);
const HEART_S = +(process.env.HEART_S || 300), AQUA_S = +(process.env.AQUA_S || 180);
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + ' (' + secs() + ')'); };
const run = { seed: SEED };
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/wander_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /wander/i.test(s)) logs.push(`[${t}] ${s.slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto(DIST);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); if (window.__each) window.__each(g, d / 1000); } }, [Math.min(10, n - k), dtms]); await wait(2); } };
const settle = async (max = 50) => {
  let s = null;
  for (let i = 0; i < max; i++) {
    await step(20, 16);
    s = await ev(() => { const g = VR.game, w = g.world, p = g.player; if (!w || !p || g.state !== 'play') return { state: g.state }; return { state: g.state, busy: g.pool.busy, pend: w.pending.size }; });
    if (s.state === 'play' && s.busy === 0 && s.pend === 0 && i > 2) break;
    await wait(30);
  }
  return s;
};
const grab = async (name, frames = 3) => {
  const url = await ev((frames) => { try { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/jpeg', 0.9); window.__norender = true; return u; } catch (e) { window.__norender = true; return null; } }, frames);
  if (url && url.length > 2000) { fs.writeFileSync(SHOTS + name, Buffer.from(url.split(',')[1], 'base64')); console.log('  📷 ' + name); return SHOTS + name; }
  console.log('  !! no picture ' + name); return null;
};
async function trip(to) {
  await ev((to) => VR.Travel.go(VR.game, { dim: to, via: 'cmd' }), to);
  for (let i = 0; i < 600; i++) { await step(10, 33); const s = await ev(() => ({ st: VR.game.state, dim: VR.game.dim, busy: VR.Travel.busy(VR.game) })); if (s.dim === to && s.st === 'play' && !s.busy) return true; await wait(20); }
  return false;
}
const sheet = [];
const writeSheet = () => { if (!sheet.length) return; fs.writeFileSync(ROOT + '/.tmp_tests/wander_sheet.json', JSON.stringify({ w: 620, rows: sheet })); try { console.log('  ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'wander_sheet.jpg', ROOT + '/.tmp_tests/wander_sheet.json']).toString().trim()); } catch (e) { console.log('  (no sheet: ' + String(e.message).slice(0, 120) + ')'); } };

// the curious walker (in the page): 4.3 m/s on the ground toward the newest moment not yet found within 45 m in front,
// else toward the Wegballon's place; round water and walls by turning; the eye looks where it goes
const installWalker = () => ev(() => {
  window.__walk = { on: true, sp: 4.3, turn: 0, odo: 0, stuck: 0 }; VR.game.player.flying = true;
  window.__each = (g, dt) => {
    const W = window.__walk, p = g.player, D = g.wanderer; if (!W || !W.on || !p || !D || g.state !== 'play') return;
    let tx = null, tz = null;
    for (let i = D.ms.length - 1; i >= 0; i--) { const m = D.ms[i]; if (m.found || !m.pos || m.kind === 'rainbow') continue; const d = Math.hypot(m.pos[0] - p.pos[0], m.pos[2] - p.pos[2]); if (d < 45 && d > 1.2) { tx = m.pos[0]; tz = m.pos[2]; break; } }
    if (tx === null && D.next) { tx = D.next.x; tz = D.next.z; }
    let yaw = p.yaw;
    if (tx !== null) yaw = Math.atan2(-(tx - p.pos[0]), -(tz - p.pos[2]));
    yaw += W.turn;
    const st = W.sp * dt, nx = p.pos[0] - Math.sin(yaw) * st, nz = p.pos[2] - Math.cos(yaw) * st;
    const gy = D.ground(nx, nz, p.pos[1]);
    if (gy === null || Math.abs(gy - p.pos[1]) > 2.2) { W.stuck += dt; W.turn += 0.6 * dt * 4; if (W.stuck > 2) { const t = g.world.topAt(Math.floor(nx), Math.floor(nz)); p.pos[0] = nx; p.pos[2] = nz; p.pos[1] = Math.max(t + 1, 64); W.stuck = 0; } }
    else { W.stuck = 0; W.turn *= 0.97; p.pos[0] = nx; p.pos[2] = nz; p.pos[1] += (gy - p.pos[1]) * 0.5; W.odo += st; }
    if (p.vel) { p.vel[0] = 0; p.vel[1] = 0; p.vel[2] = 0; } p.flying = true;
    p.yaw += Math.atan2(Math.sin(yaw - p.yaw), Math.cos(yaw - p.yaw)) * Math.min(1, dt * 3); p.pitch = -0.08; p.viewYaw = p.yaw;
  };
});
// one walk: dur seconds; the hours to set at given seconds; a picture every 30 s aimed at the newest moment
async function walk(tag, dur, plan) {
  await installWalker();
  const t0 = await ev(() => VR.game.wanderer ? VR.game.wanderer.time : 0);
  const row = [], R = run[tag] = { shots: [] };
  let next = 15;
  for (let s = 0; s < dur; s += 5) {
    for (const [at, fn] of plan) if (at >= s && at < s + 5) await ev(fn);
    await step(150, 33);   // 5 s of game time
    if (s + 5 >= next) {
      next += 30;
      // aim at the newest staged moment within 60 m (the picture's subject), else straight on
      const aim = await ev(() => { const g = VR.game, D = g.wanderer, p = g.player; let m = null; for (let i = D.ms.length - 1; i >= 0; i--) { const q = D.ms[i]; if (q.pos && Math.hypot(q.pos[0] - p.pos[0], q.pos[2] - p.pos[2]) < 60) { m = q; break; } } if (m) { const dx = m.pos[0] - p.pos[0], dz = m.pos[2] - p.pos[2], dy = m.pos[1] + (m.kind === 'kites' ? 12 : 1) - p.pos[1] - 1.6; p.yaw = Math.atan2(-dx, -dz); p.viewYaw = p.yaw; p.pitch = Math.atan2(dy, Math.hypot(dx, dz)) * 0.8; } return { kind: m ? m.kind : null, d: m ? Math.round(Math.hypot(m.pos[0] - p.pos[0], m.pos[2] - p.pos[2])) : null, active: D.ms.map(q => q.kind), next: D.next && D.next.name, hour: D.ctx && D.ctx.hour, at: D.ctx && D.ctx.at }; });
      const name = `wd_${tag}_${String(s + 5).padStart(3, '0')}.jpg`;
      const f = await grab(name);
      R.shots.push(Object.assign({ t: s + 5, f: name }, aim));
      if (f) row.push(f);
      if (row.length === 4) { sheet.push({ label: `${tag} ${s + 5 - 90}–${s + 5} s · ${R.shots.slice(-4).map(x => x.kind || '–').join(', ')}`, imgs: row.slice() }); row.length = 0; writeSheet(); }
    }
  }
  if (row.length) sheet.push({ label: `${tag} · ${R.shots.slice(-row.length).map(x => x.kind || '–').join(', ')}`, imgs: row.slice() });
  const S = await ev((t0) => { const D = VR.game.wanderer, st = D.stats(); st.timeline = st.timeline.filter(e => e.t >= t0); st.t0 = t0; st.t1 = D.time; st.odo = window.__walk.odo; st.book = VR.Wander.progress(VR.game.meta); return st; }, t0);
  await ev(() => { window.__walk.on = false; });
  Object.assign(R, S);
  const ts = [S.t0].concat(S.timeline.map(e => e.t)).concat([S.t1]);
  let gap = 0; for (let i = 1; i < ts.length; i++) gap = Math.max(gap, ts[i] - ts[i - 1]);
  R.maxGap = Math.round(gap * 10) / 10;
  const kinds = new Set(S.timeline.map(e => e.kind));
  console.log(`  ${tag}: ${S.timeline.length} moments, ${kinds.size} kinds (${[...kinds].join(', ')}), found ${S.found}, max gap ${R.maxGap} s, walked ${Math.round(S.odo)} m, places ${S.book.places.n}, cost ${S.cost.toFixed(3)} ms/frame`);
  console.log('  timeline: ' + S.timeline.map(e => `${Math.round(e.t - S.t0)} ${e.kind}${e.seen === false ? '(behind)' : ''}`).join(' · '));
  save(); writeSheet();
  return R;
}

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 6; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Wandern',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world');
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(2600); if (g.settings) g.settings.wow = false; });
await settle(30);
check(await ev(() => !!VR.Wander && !!VR.game.wanderer), 'the Wanderregisseur rides along (VR.game.wanderer)');

const T = (t) => () => VR.game.env.setTime(t);
const WX = (k) => () => VR.game.env.wx.force(k);
if (want('heart')) {
  console.log('== Herzwelt');
  const H = await walk('heart', HEART_S, [[0, T(2600)], [60, T(6200)], [110, WX('regen')], [125, WX('klar')], [130, T(9000)], [190, T(12300)], [250, T(15500)]]);
  check(H.timeline.length >= Math.floor(HEART_S / 40), `Herzwelt: a moment at least every 40 s (${H.timeline.length} in ${HEART_S} s)`);
  check(H.maxGap <= 40, `Herzwelt: the longest wait ${H.maxGap} s ≤ 40 s`);
  check(new Set(H.timeline.map(e => e.kind)).size >= 6, 'Herzwelt: at least six kinds of moment');
  check(H.found >= 3, `Herzwelt: the walker found ≥ 3 (${H.found})`);
  check(H.places > 3 && H.next, `Herzwelt: the places are known (${H.places}) and the Wegballon leads to one (${H.next})`);
  check(H.shots.filter(s => s.kind).length >= Math.floor(H.shots.length * 0.6), `Herzwelt: most pictures show a moment (${H.shots.filter(s => s.kind).length}/${H.shots.length})`);
  // the Wanderbuch (J)
  await ev(() => VR.Wander.open(VR.game));
  await wait(300);
  await page.screenshot({ path: SHOTS + 'wd_book.png' });
  const bk = await ev(() => ({ screen: VR.game.ui.screen, html: (document.getElementById('wanderbuch') || {}).innerText || '' }));
  check(bk.screen === 'wanderbuch' && /Wanderbuch/.test(bk.html) && /Orte/.test(bk.html), 'the Wanderbuch opens and shows its pages (German)');
  await ev(() => VR.Wander.close(VR.game));
  sheet.push({ label: 'Wanderbuch (J)', imgs: [SHOTS + 'wd_book.png'] });
}
if (want('aqua')) {
  console.log('== Aquamarin');
  const ok = await trip('aqua').catch(() => false);
  check(ok, 'the trip to Aquamarin');
  if (ok) {
    await ev(() => { const g = VR.game; if (g.ui && g.ui.show) g.ui.show(null); g.env.setTime(3600); });
    await settle(40);
    const A = await walk('aqua', AQUA_S, [[0, T(3600)], [120, T(11800)]]);
    check(A.timeline.length >= Math.floor(AQUA_S / 40), `Aquamarin: a moment at least every 40 s (${A.timeline.length} in ${AQUA_S} s)`);
    check(A.maxGap <= 40, `Aquamarin: the longest wait ${A.maxGap} s ≤ 40 s`);
    check(A.places >= 3, `Aquamarin: the town, villages, landmarks and landing are places (${A.places})`);
  }
}
if (want('cost')) {
  console.log('== cost');
  // the same spot, 40 rendered frames: Very Low / High, the director off / on (one moment staged in view)
  const cost = run.cost = {};
  for (const preset of ['potato', 'high']) for (const on of [false, true]) {
    const r = await ev(([preset, on]) => {
      const g = VR.game; g.applyPreset(preset); g.settings.dynRes = false; g.settings.wander = on; g.applySettings('*');
      const D = g.wanderer; if (D && on && !D.ms.length) { D.ctx = D.context(); D.start('shrine', 900001, true) || D.start('sign', 900002, true); }
      window.__norender = false; const times = [];
      for (let i = 0; i < 45; i++) { const a = performance.now(); g.last = a - 33; g.loop(a); times.push(performance.now() - a); }
      window.__norender = true; times.sort((x, y) => x - y);
      return { frame: +times[Math.floor(times.length / 2)].toFixed(2), upd: D ? +D.st.cost.toFixed(3) : 0, active: D ? D.ms.map(m => m.kind) : [], beacon: !!(D && D.bcOn) };
    }, [preset, on]);
    cost[preset + (on ? '_on' : '_off')] = r;
    console.log(`  ${preset} ${on ? 'on ' : 'off'}: median frame ${r.frame} ms, the director's update ${r.upd} ms (${r.active.join(',') || '–'}${r.beacon ? ', Wegballon' : ''})`);
  }
  check(cost.potato_on.upd < 0.5, `Very Low: the director's update stays small (${cost.potato_on.upd} ms)`);
  save();
}
writeSheet();
const errs = logs.filter(l => /pageerror|wander/i.test(l));
check(!errs.length, 'no page error, no warning of the director' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
save();
await browser.close();
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
