// o-wander2 in the browser (docs/superpowers/plans/2026-11-01-o-wander2.md): seed 4242, 960 × 540, de-DE, High.
//   walk  · 5 minutes: on foot after the Wegballon (the walker never turns toward a moment — what is staged must be in
//           view by itself), 180–240 s a flight over the land; every weighted event in view of every source (the event
//           log): the longest gap, the pairs < 8 s; each of ours: its distance, its share of the frame; pictures of the
//           first moments and beats as they start (the view untouched)
//   dusk  · a moment at dusk (High: the halo) and at night on Very Low (the warm lamp)
//   fairy · Tüpfel steps out and talks (the share), the lanterns, the twist (the Flausel walks with you, the glow seed),
//           the companion light (its distance and angle), the tree at night (High · Very Low), every place's clearance
//   fest  · the kite day (the tethers), two peoples' festivals (their props)
//   movein· a cottage far from villages, dawn, the arrival framed close (the cart's share of the frame)
// → test/shots/w2_*.jpg, test/shots/wander2_sheet.jpg, .tmp_tests/wander2_run.json
//   nohup bash test/wt_run.sh wander2.mjs 3600 > .tmp_tests/wander2.log 2>&1 &   (ONLY=walk,dusk,fairy,fest,movein)
// regress: skip  (the proof with pictures; the gates are test/wander2.js, fairy.js, movein.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '').replace(/\/\.tmp_tests$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html';
const SHOTS = ROOT + '/test/shots/';
const SEED = process.env.SEED || '4242';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, want = (s) => !ONLY || ONLY.includes(s);
const WALK_S = +(process.env.WALK_S || 300);
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + ' (' + secs() + ')'); };
const run = { seed: SEED };
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/wander2_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /wander|fairy/i.test(s)) logs.push(`[${t}] ${s.slice(0, 400)}`); });
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
const lookAt = (P) => ev((P) => { const p = VR.game.player, e = p.eyePos(), dx = P[0] - e[0], dy = P[1] - e[1], dz = P[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw; }, P);
const stand = (P, look) => ev(([P, L]) => { const p = VR.game.player; p.flying = true; p.teleport(P[0], P[1], P[2]); p.vel = [0, 0, 0]; const e = [P[0], P[1] + 1.6, P[2]], dx = L[0] - e[0], dy = L[1] - e[1], dz = L[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw; }, [P, look]);
const walkTo = async (P, frames = 12) => { await ev((P) => { const p = VR.game.player; p.flying = false; p.teleport(P[0], P[1] + 0.05, P[2]); }, P); await step(frames, 33); };
const sheet = [];
const writeSheet = () => { if (!sheet.length) return; fs.writeFileSync(ROOT + '/.tmp_tests/wander2_sheet.json', JSON.stringify({ w: 620, rows: sheet })); try { console.log('  ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'wander2_sheet.jpg', ROOT + '/.tmp_tests/wander2_sheet.json']).toString().trim().slice(0, 200)); } catch (e) { console.log('  (sheet: ' + e.message.slice(0, 120) + ')'); } };
// the share of the frame a figure of height hgt at pos has from the camera now, and whether it is in view (event log)
const shareNow = (pos, hgt) => ev(([q, hg]) => { const g = VR.game, c = g.cam, fov = (g.settings.fov || 70) * Math.PI / 180, d = Math.hypot(q[0] - c.x, q[1] + hg / 2 - c.y, q[2] - c.z); const v = VR.EventLog && VR.EventLog.inView ? VR.EventLog.inView([q[0], q[1] + hg / 2, q[2]], 0.6, g) : { inView: null }; return { d: +d.toFixed(1), share: +(hg / (2 * d * Math.tan(fov / 2))).toFixed(3), inView: v.inView }; }, [pos, hgt]);

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.playerName = 'Mila'; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Wandern2',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world');
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(2600); if (g.settings) g.settings.wow = false; });
await settle(30);

// ---------------------------------------------------------------- the walker: after the Wegballon only (never toward a moment)
const installWalker = () => ev(() => {
  window.__walk = { on: true, sp: 4.3, turn: 0, odo: 0, stuck: 0, fly: false, tl: VR.game.wanderer.timeline.length, hold: 0 }; VR.game.player.flying = true;
  window.__each = (g, dt) => {
    const W = window.__walk, p = g.player, D = g.wanderer; if (!W || !W.on || !p || !D || g.state !== 'play') return;
    if (W.tl !== D.timeline.length) { W.tl = D.timeline.length; W.hold = 2; }
    if (W.hold > 0 && !W.fly) { W.hold -= dt; if (p.vel) { p.vel[0] = 0; p.vel[1] = 0; p.vel[2] = 0; } return; }   // (it noticed something: a short pause, the view kept)
    let yaw = p.yaw;
    if (D.next) yaw = Math.atan2(-(D.next.x - p.pos[0]), -(D.next.z - p.pos[2]));
    yaw += W.turn;
    if (W.fly) {   // a flight: 9 m/s, 30 m over the land
      const st = 9 * dt, nx = p.pos[0] - Math.sin(yaw) * st, nz = p.pos[2] - Math.cos(yaw) * st, t = g.world.topAt(Math.floor(nx), Math.floor(nz));
      p.pos[0] = nx; p.pos[2] = nz; p.pos[1] += ((Math.max(t, 63) + 30) - p.pos[1]) * Math.min(1, dt); W.odo += st;
    } else {
      const st = W.sp * dt, nx = p.pos[0] - Math.sin(yaw) * st, nz = p.pos[2] - Math.cos(yaw) * st;
      const gy = D.ground(nx, nz, p.pos[1]);
      if (gy === null || Math.abs(gy - p.pos[1]) > 2.2) { W.stuck += dt; W.turn += 0.6 * dt * 4; if (W.stuck > 2) { const t = g.world.topAt(Math.floor(nx), Math.floor(nz)); p.pos[0] = nx; p.pos[2] = nz; p.pos[1] = Math.max(t + 1, 64); W.stuck = 0; } }
      else { W.stuck = 0; W.turn *= 0.97; p.pos[0] = nx; p.pos[2] = nz; p.pos[1] += (gy - p.pos[1]) * 0.5; W.odo += st; }
    }
    if (p.vel) { p.vel[0] = 0; p.vel[1] = 0; p.vel[2] = 0; } p.flying = true;
    p.yaw += Math.atan2(Math.sin(yaw - p.yaw), Math.cos(yaw - p.yaw)) * Math.min(1, dt * 3); p.pitch = W.fly ? -0.12 : -0.08; p.viewYaw = p.yaw;
  };
});
const FIGS = { traveller: 1.8, caravan: 2.2, pet: 1.0, picnic: 1.3, musician: 1.8, kites: 1.8, crossing: 1.0, rainbow: 9, glade: 1.1, cairn: 1.5, shrine: 2.2, ruins: 3.6, scrap: 1.1, sign: 2.4, stargazer: 1.8, lanterns: 1.8, well: 2.4, 'b:bird': 0.45, 'b:flutter': 0.5, 'b:breeze': 0.9, 'b:song': 1.8, 'b:flock': 1.6, 'b:glow': 1.2 };
// a walk of dur s: pictures of new starts (≤ maxPics), the timeline, every weighted event seen
async function walk(tag, dur, plan, maxPics) {
  await installWalker();
  const g0 = await ev(() => { const st = VR.game.wanderer.stats(); return { t: VR.game.time, n: VR.EventLog ? VR.EventLog.count : 0, tl: VR.game.wanderer.timeline.length, started: st.started, beats: st.beats, outside: st.outside }; });
  const R = run[tag] = { shots: [] }; let seenTl = g0.tl, pics = 0;
  for (let s = 0; s < dur; s += 1) {
    for (const [at, fn] of plan) if (at === s) await ev(fn);
    await step(30, 33);
    const tl = await ev(() => VR.game.wanderer.timeline.length);
    if (tl > seenTl && pics < maxPics) {
      const e = await ev((i) => { const D = VR.game.wanderer, e = D.timeline[i], m = e.kind.startsWith('b:') ? D.b : D.ms.find(q => q.kind === e.kind); return Object.assign({}, e, { pos: m && m.pos ? m.pos.slice() : null }); }, tl - 1);
      seenTl = tl;
      await step(24, 33);   // (0.8 s on: it has come in)
      const pos = await ev((e) => { const D = VR.game.wanderer, m = e.kind.startsWith('b:') ? D.b : D.ms.find(q => q.kind === e.kind); return m && m.pos ? m.pos.slice() : e.pos; }, e);
      const sh = pos ? await shareNow(pos, FIGS[e.kind] || 1.6) : { d: 0, share: 0, inView: null };
      const name = `w2_${tag}_${String(s).padStart(3, '0')}_${e.kind.replace(':', '')}.jpg`, f = await grab(name);
      R.shots.push({ t: s, kind: e.kind, f: name, d: sh.d, share: sh.share, inView: sh.inView });
      if (f) { pics++; R.files = (R.files || []).concat([{ f, label: `${s} s ${e.kind} · ${sh.d} m · ${(sh.share * 100).toFixed(0)} %${sh.inView ? '' : ' ✗'}` }]); }
    } else seenTl = tl;
  }
  const S = await ev((g0) => { const g = VR.game, D = g.wanderer, st = D.stats(); st.timeline = st.timeline.filter((e, i) => i >= g0.tl - (400 - D.timeline.length > 0 ? 0 : 0)); const E = VR.EventLog ? VR.EventLog.events(g0.n).filter(e => e.w >= 2 && e.inView).map(e => ({ t: +(e.t - g0.t).toFixed(1), kind: e.kind, sub: e.sub, src: e.src, w: e.w, frac: e.frac })) : []; st.events = E; st.t1 = +(g.time - g0.t).toFixed(1); st.odo = window.__walk.odo; return st; }, g0);
  await ev(() => { window.__walk.on = false; window.__walk.fly = false; });
  S.started -= g0.started; S.beats -= g0.beats; S.outside -= g0.outside;
  Object.assign(R, { events: S.events, t1: S.t1, beats: S.beats, started: S.started, outside: S.outside, odo: S.odo, quiet: S.quiet });
  const ts = [0].concat(S.events.map(e => e.t)).concat([S.t1]);
  let gap = 0, ga = 0; for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] > gap) { gap = ts[i] - ts[i - 1]; ga = ts[i - 1]; }
  // merged: one moment told twice within 2 s counts once (as sessionstats does)
  const M = []; for (const e of S.events) { if (M.length && e.t - M[M.length - 1].t < 2) continue; M.push(e); }
  const pairs = []; for (let i = 1; i < M.length; i++) if (M[i].t - M[i - 1].t < 8) pairs.push([M[i - 1].sub, M[i].sub, +(M[i].t - M[i - 1].t).toFixed(1)]);
  R.maxGap = +gap.toFixed(1); R.gapAt = ga; R.pairs = pairs;
  const ours = S.events.filter(e => e.src === 'wander');
  console.log(`  ${tag}: ${S.events.length} weighted events seen (${ours.length} ours: ${S.started} moments + ${S.beats} beats started, ${S.outside} outside), longest gap ${R.maxGap} s at ${ga}, pairs < 8 s: ${pairs.length}, walked ${Math.round(S.odo)} m`);
  console.log('  timeline: ' + M.map(e => `${Math.round(e.t)} ${e.sub}`).join(' · '));
  console.log('  pairs: ' + JSON.stringify(pairs));
  save();
  return R;
}

if (want('walk')) {
  console.log('== the 5-minute walk (Herzwelt, morning → noon, a flight 180–240 s)');
  const W = await walk('walk', WALK_S, [[0, 'VR.game.env.setTime(2600)'], [120, 'VR.game.env.setTime(6200)'], [180, 'window.__walk.fly = true'], [240, 'window.__walk.fly = false']], 10);
  check(W.maxGap <= 35, `the longest gap between weighted events seen: ${W.maxGap} s (≤ 35, incl. the flight)`);
  check(W.pairs.length <= 1, `pairs closer than 8 s: ${W.pairs.length} in ${WALK_S} s (≤ 1 ≙ ≤ 2 / 10 min)`);
  const sh = W.shots.filter(x => !x.kind.startsWith('b:') && x.kind !== 'rainbow');
  const oursSeen = W.events.filter(e => e.src === 'wander').length, oursAll = (W.started | 0) + (W.beats | 0);
  // v0.56.5 · nicht vor deinen Augen (the owner: "people ... just spawn somewhere in front of us"): a moment is staged
  // beside the view, never in it — it is there when you look round; a beat comes in from outside it (or fades in)
  const momSeen = W.events.filter(e => e.src === 'wander' && e.sub && e.sub.startsWith('wd:')).length;
  check(oursAll >= 8, `ours started: ${oursAll} (${W.started} moments, ${W.beats} beats)`);
  check(momSeen <= Math.max(1, (W.started | 0) * 0.1), `no moment comes into being in view (the event log): ${momSeen} of ${W.started} seen as they start`);
  check(sh.length >= 2 && sh.filter(x => !x.inView).length >= sh.length * 0.8, `…beside the view in the picture 0.8 s on: ${sh.filter(x => !x.inView).length}/${sh.length} out of it`);
  check(W.beats > 0, `beats filled the gaps (${W.beats}), incl. the flight: ${W.events.filter(e => e.sub && e.sub.startsWith('wb:') && e.t >= 180 && e.t < 245).map(e => e.sub).join(', ')}`);
  const F = (W.files || []);
  for (let i = 0; i < F.length; i += 2) sheet.push({ label: F.slice(i, i + 2).map(x => x.label).join('  |  '), imgs: F.slice(i, i + 2).map(x => x.f) });
  writeSheet();
}
if (want('dusk')) {
  console.log('== dusk (High) and night (Very Low)');
  const D1 = await walk('dusk', 40, [[0, 'VR.game.env.setTime(11700)']], 1);
  await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.settings.renderDist = 5; g.applySettings('*'); });
  await settle(10);
  const D2 = await walk('night', 40, [[0, 'VR.game.env.setTime(15200)']], 1);
  await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 6; g.applySettings('*'); });
  await settle(10);
  const F = (D1.files || []).concat(D2.files || []);
  if (F.length) sheet.push({ label: 'Abend (Hoch) · Nacht (Sehr niedrig): ' + F.map(x => x.label).join('  |  '), imgs: F.map(x => x.f) });
  check(F.length === 2, 'a moment pictured at dusk and at night');
  writeSheet();
}

if (want('cost')) {
  console.log('== cost');
  // the same spot, 12 rendered frames each to the GPU's end: Very Low / High, the director off / on (a moment and a beat in view)
  const cost = run.cost = {};
  for (const preset of ['potato', 'high']) for (const on of [false, true]) {
    const r = await ev(([preset, on]) => {
      const g = VR.game; g.applyPreset(preset); g.settings.dynRes = false; g.settings.wander = on; g.applySettings('*');
      const D = g.wanderer; if (D && on && !D.ms.length) { D.ctx = D.context(); D.start('shrine', 900001, true) || D.start('sign', 900002, true); }
      if (D && on && !D.b) D.beat(false);
      window.__norender = false; const times = [], gl = g.renderer.gl;
      for (let i = 0; i < 16; i++) { const a = performance.now(); g.last = a - 33; g.loop(a); gl.finish(); if (i >= 4) times.push(performance.now() - a); }
      window.__norender = true; times.sort((x, y) => x - y);
      return { frame: +times[Math.floor(times.length / 2)].toFixed(2), upd: D ? +D.st.cost.toFixed(3) : 0, active: D ? D.ms.map(m => m.kind).concat(D.b ? ['b:' + D.b.kind] : []) : [] };
    }, [preset, on]);
    cost[preset + (on ? '_on' : '_off')] = r;
    console.log(`  ${preset} ${on ? 'on ' : 'off'}: median frame ${r.frame} ms, the director's update ${r.upd} ms (${r.active.join(',') || '–'})`);
  }
  check(cost.potato_on.upd < 0.5, `Very Low: the director's update stays small (${cost.potato_on.upd} ms)`);
  await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.wander = true; g.applySettings('*'); });
  save();
}
// ---------------------------------------------------------------- the Flausel
async function goTo(kind) {
  const s0 = (await ev(() => VR.Fairy.debug.sites())).find(s => s.kind === kind); if (!s0) return null;
  for (let i = 0; i < 40; i++) {
    const s = (await ev(() => VR.Fairy.debug.sites())).find(x => x.kind === kind);
    if (s && s.y !== null && await ev(() => VR.Fairy.debug.near()) === s.id) return s;
    await ev((s) => { const p = VR.game.player; p.flying = true; p.teleport(s.x + 0.5, 150, s.z + 0.5); }, s);   // (the spot may move while it settles: off a town, a road, the water)
    await settle(6); await step(20, 33);
  }
  return (await ev(() => VR.Fairy.debug.sites())).find(x => x.kind === kind);
}
if (want('fairy')) {
  console.log('== the Flausel');
  const P = {};
  try {
    await ev(() => VR.game.env.setTime(5200));
    const s = await goTo('tree'); check(!!s, 'the Slumber Tree: ' + (s && s.id));
    const clr = await ev(() => VR.Fairy.debug.clear());
    console.log('  clearance (m beyond a footprint): ' + JSON.stringify(clr));
    const tc = clr.find(x => x.kind === 'tree');
    check(tc && tc.c >= 40, `the tree ${tc && tc.c} m beyond any town's footprint (≥ 40; the lanterns no longer in an alley)`);
    const tf = s.folk.find(f => f.who === 'tuepfel');
    await walkTo([tf.pos[0] + 4.5, tf.pos[1], tf.pos[2] + 1.5]); await lookAt([tf.pos[0], tf.pos[1] + 0.6, tf.pos[2]]);
    const T0g = await ev(() => VR.game.time);
    await ev(() => VR.Fairy.debug.talk('tuepfel')); await step(75, 33);
    const fp = (await ev(() => VR.Fairy.debug.sites())).find(x => x.kind === 'tree').folk.find(f => f.who === 'tuepfel').pos;
    const sh = await shareNow(fp, 0.97 * 1.3);
    P.talk = await grab('w2_fy_talk.jpg', 4);
    check(sh.share >= 0.06 && sh.inView, `Tüpfel stepped out and talks: ${sh.d} m away, ${(sh.share * 100).toFixed(0)} % of the frame (≥ 6 %)`);
    await ev(() => VR.Fairy.debug.talk('tuepfel'));
    const L = (await ev(() => VR.Fairy.debug.sites())).find(x => x.kind === 'tree').lanterns;
    let path = 0, at = [tf.pos[0] + 4.5, 0, tf.pos[2] + 1.5];
    for (const p of L) { path += Math.hypot(p[0] - at[0], p[2] - at[2]); at = p; await walkTo(p, 10); }
    path += Math.hypot(tf.pos[0] - at[0], tf.pos[2] - at[2]);
    await walkTo([tf.pos[0] + 2.5, tf.pos[1], tf.pos[2] + 1]); await ev(() => VR.Fairy.debug.talk('tuepfel')); await step(20, 33);
    let W = await ev(() => VR.Fairy.debug.twist());
    check(!!W && W.tw === 1, 'the twist: ' + (await ev(() => (VR.Fairy.debug.said() || {}).text || '')).slice(0, 90));
    if (W) {
      // walk 14 s toward the seed (4.3 m/s): the Flausel at your side
      for (let k = 0; k < 14; k++) { const p = await ev(() => VR.game.player.pos.slice()), dx = W.pos[0] - p[0], dz = W.pos[2] - p[2], d = Math.hypot(dx, dz), nx = p[0] + dx / d * 4.3, nz = p[2] + dz / d * 4.3, ny = await ev((q) => VR.game.world.topAt(Math.floor(q[0]), Math.floor(q[1])) + 1, [nx, nz]); await ev(([x, y, z, yaw]) => { const pl = VR.game.player; pl.flying = false; pl.teleport(x, y + 0.05, z); pl.yaw = yaw; pl.viewYaw = pl.yaw; pl.pitch = -0.2; }, [nx, ny, nz, Math.atan2(-dx, -dz)]); await step(30, 33); }
      const W2 = await ev(() => VR.Fairy.debug.twist());
      const pp = await ev(() => VR.game.player.pos.slice());
      check(W2 && Math.hypot(W2.f[0] - pp[0], W2.f[2] - pp[2]) < 3.5, `the Flausel walks with you (${W2 && Math.hypot(W2.f[0] - pp[0], W2.f[2] - pp[2]).toFixed(1)} m beside)`);
      P.with = await grab('w2_fy_with.jpg', 4);
      W = await ev(() => VR.Fairy.debug.twist());
      for (let k = 0; k < 6 && W && W.pos[1] === null; k++) { await ev((p) => { const pl = VR.game.player; pl.flying = true; pl.teleport(p[0] + 8, 120, p[2]); }, W.pos); await settle(4); await step(10, 33); W = await ev(() => VR.Fairy.debug.twist()); }
      if (W && W.pos[1] !== null) { const y = await ev((p) => VR.game.world.topAt(Math.floor(p[0] + 7), Math.floor(p[2] + 2)) + 1, W.pos); await walkTo([W.pos[0] + 7, y, W.pos[2] + 2], 20); await lookAt([W.pos[0], W.pos[1], W.pos[2]]); await step(20, 33); P.seed = await grab('w2_fy_seed.jpg', 4); }
      let twPath = Math.hypot(W.pos[0] - s.x, W.pos[2] - s.z) * 2 + 28;
      for (let k = 0; k < 6; k++) { W = await ev(() => VR.Fairy.debug.twist()); if (!W || W.tw !== 1) break; if (W.pos[1] === null) { await ev((p) => { const pl = VR.game.player; pl.flying = true; pl.teleport(p[0] + 6, 120, p[2]); }, W.pos); await settle(4); continue; } await walkTo([W.pos[0] + 0.6, W.pos[1] - 0.9, W.pos[2]], 12); }
      W = await ev(() => VR.Fairy.debug.twist());
      if (W) { await walkTo([W.home[0] + 3, W.home[1], W.home[2] + 3], 20); }
      const r = await ev(() => JSON.parse(JSON.stringify(VR.Fairy.debug.rec())));
      const est = (path + twPath) / 4.3 + 30;   // on foot at 4.3 m/s, plus ≈ 30 s of talk and looking
      run.fairyTime = { path: Math.round(path), twist: Math.round(twPath), est: Math.round(est), test: +((await ev(() => VR.game.time)) - T0g).toFixed(0) };
      check(r.done.includes('overworld:tree'), `the lanterns with their twist done; on foot ≈ ${Math.round(est)} s (lanterns ${Math.round(path)} m + the seed ${Math.round(twPath)} m)`);
      check(est >= 120, 'the adventure takes ≥ 2 minutes on foot');
      await step(40, 33);
      { const a = s.yaw + 0.5, e = [s.x + Math.cos(a) * 18, 0, s.z + Math.sin(a) * 18]; e[1] = await ev((e) => VR.game.world.topAt(Math.floor(e[0]), Math.floor(e[2])) + 1, e); await walkTo(e, 20); }
      await lookAt([s.x, s.y + 4, s.z]); await step(30, 33);
      const bud = await ev(() => { const g = VR.game, b = VR.Fairy.debug.bud(), e = g.player.eyePos(); if (!b) return null; const dx = b[0] - e[0], dy = b[1] - e[1], dz = b[2] - e[2], d = Math.hypot(dx, dy, dz), f = g.player.lookDir ? g.player.lookDir() : [-Math.sin(g.player.yaw), 0, -Math.cos(g.player.yaw)]; return { d: +d.toFixed(2), deg: Math.round(Math.acos((dx * f[0] + dy * f[1] + dz * f[2]) / d) * 180 / Math.PI) }; });
      check(bud && bud.d >= 1.5 && bud.deg >= 25, `the companion light beside you: ${bud && bud.d} m from the eye, ${bud && bud.deg}° off the centre`);
      P.bud = await grab('w2_fy_buddy.jpg', 4);
    }
    // the tree at night: High and Very Low
    await ev(() => VR.game.env.setTime(16500));
    { const a = s.yaw + 0.5, e = [s.x + Math.cos(a) * 20, 0, s.z + Math.sin(a) * 20]; e[1] = await ev((e) => VR.game.world.topAt(Math.floor(e[0]), Math.floor(e[2])) + 1, e); await walkTo(e, 10); } await lookAt([s.x, s.y + 2, s.z]); await step(40, 33);
    P.nightHi = await grab('w2_fy_night_high.jpg', 4);
    await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.settings.renderDist = 5; g.applySettings('*'); }); await settle(8); await step(30, 33);
    P.nightVl = await grab('w2_fy_night_vl.jpg', 4);
    await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 6; g.applySettings('*'); }); await settle(8);
  } catch (e) { check(false, 'fairy: ' + e.message.slice(0, 300)); }
  sheet.push({ label: 'Tüpfel tritt vor und spricht · der Flausel geht mit', imgs: [P.talk, P.with].filter(Boolean) }, { label: 'der Lichtsamen · das Begleitlicht neben dir', imgs: [P.seed, P.bud].filter(Boolean) }, { label: 'der Schlummerbaum nachts: Hoch · Sehr niedrig', imgs: [P.nightHi, P.nightVl].filter(Boolean) });
  writeSheet(); save();
}

// ---------------------------------------------------------------- the festivals
if (want('fest')) {
  console.log('== the festivals');
  const P = {};
  try {
    await ev(() => VR.game.env.setTime(4200));
    let vil0 = null;
    for (let k = 0; k < 8 && !vil0; k++) {
      const t = await ev(() => VR.Seasons.Fest.debug.today());
      if (t) { vil0 = t; break; }
      const kn = await ev(() => { const g = VR.game, V = g.villages, p = g.player.pos; const all = [...V.known.values()].filter(v => v.plan && v.plan.plaza && !v.plan.mine).map(v => ({ x: v.plan.plaza.x, y: v.plan.plaza.y, z: v.plan.plaza.z, d: Math.hypot(v.plan.plaza.x - p[0], v.plan.plaza.z - p[2]) })).sort((a, b) => a.d - b.d); return all[0] || null; });
      if (kn) await ev((v) => { const p = VR.game.player; p.flying = true; p.teleport(v.x + 6.5, v.y + 6, v.z + 6.5); }, kn);
      else await ev((k) => { const p = VR.game.player; p.flying = true; p.teleport(p.pos[0] + 160 * Math.cos(k * 2.4), 120, p.pos[2] + 160 * Math.sin(k * 2.4)); }, k);
      await settle(12); await step(40, 33);
    }
    check(!!vil0, 'a village: ' + (vil0 && vil0.vil));
    const pz = vil0.plaza;
    const viewAt = async (d, up, side, lookY, across) => {
      const a = 0.75 + (side || 0), R0 = (pz.r || 4) + d, e = [pz.x + 0.5 + Math.cos(a) * R0, pz.y + up, pz.z + 0.5 + Math.sin(a) * R0];
      await ev((e) => { const p = VR.game.player; p.flying = true; p.teleport(e[0], e[1], e[2]); }, e);
      await settle(8);
      const L = across ? [pz.x + 0.5 - Math.cos(a) * across, pz.y + (lookY || 1.5), pz.z + 0.5 - Math.sin(a) * across] : [pz.x + 0.5, pz.y + (lookY || 1.5), pz.z + 0.5];
      await lookAt(L); await step(20, 33);
    };
    const setDay = (day, tod) => ev(([d, t]) => { const g = VR.game; g.env.day = d; g.env.setTime(t); VR.Seasons.Fest.debug.reset(); return VR.Seasons.debug.cur(); }, [day, tod]);
    await setDay(5, 12100); for (let k = 0; k < 10; k++) { await step(40, 33); await wait(20); }
    const t = await ev(() => VR.Seasons.Fest.debug.today());
    check(t.id === 'drachen' && t.kites === 6, `the kite day (${t.id}, ${t.kites} kites)`);
    await viewAt(-1, 2, 0.3, 14, 6); await step(30, 33);
    P.kites = await grab('w2_fest_kites.jpg', 4);
    for (const [id, sp] of [['gezeiten', 'aqua'], ['steinglut', 'basalt']]) {
      await ev((sp) => { const vil = VR.Seasons.Fest.debug.vil(); vil.plan.species = sp; }, sp);
      await setDay(2, 13600); await step(80, 33);
      const t2 = await ev(() => VR.Seasons.Fest.debug.today());
      check(t2.id === id && t2.deco === 11, `${id}: their own festival (${t2.deco} pieces: six bowls, their five props)`);
      await viewAt(1, 6, 0.3, 1); await step(30, 33);
      P[id] = await grab('w2_fest_' + id + '.jpg', 6);
    }
    await ev(() => { const vil = VR.Seasons.Fest.debug.vil(); delete vil.plan.species; });
  } catch (e) { check(false, 'fest: ' + e.message.slice(0, 300)); }
  sheet.push({ label: 'Drachenwindtag: die Drachen an ihren Schnüren', imgs: [P.kites].filter(Boolean) }, { label: 'Gezeitenleuchten · Steinglut (eigene Requisiten, eigener Tanz)', imgs: [P.gezeiten, P.steinglut].filter(Boolean) });
  writeSheet(); save();
}

// ---------------------------------------------------------------- the move-in arrival
if (want('movein')) {
  console.log('== the move-in arrival');
  const P = {};
  try {
    await ev(() => { const g = VR.game; g.env.setTime(3000); g.zenFreezeTime = false; });
    const far = await ev(() => {
  const g = VR.game, V = g.villages, p = g.player.pos;
  for (let r = 220; r <= 520; r += 60) for (let k = 0; k < 12; k++) {
    const an = k / 12 * Math.PI * 2, x = Math.round(p[0] + Math.cos(an) * r), z = Math.round(p[2] + Math.sin(an) * r);
    const ns = V.nearestSite(x, z); if (!ns || ns.dist > 230) return [x, z, ns ? Math.round(ns.dist) : -1];
  }
  return null;
});
    check(!!far, 'a spot far from every village: ' + JSON.stringify(far));
    await ev((f) => { const p = VR.game.player; p.flying = true; p.teleport(f[0] + 0.5, 140, f[1] + 0.5); }, far);
    await settle(60); await step(40, 33); await settle(20);
    const build = (spec) => ev((spec) => {
  const g = VR.game, w = g.world, R = VR.R;
  const st = (n, p) => { const t = R.byName[n]; return t ? (p ? t.state(p) : t.defaultState) : 0; };
  const set = (x, y, z, s) => w.setBlock(x, y, z, s, 0);
  let best = null;
  for (let rr = 0; rr <= 24 && !best; rr += 3) for (let a = 0; a < 12 && !best; a++) {
    const an = a / 12 * Math.PI * 2, cx = Math.round(spec.c[0] + Math.cos(an) * rr), cz = Math.round(spec.c[1] + Math.sin(an) * rr);
    if (!w.isLoaded(cx - 6, cz - 6) || !w.isLoaded(cx + 6, cz + 6)) continue;
    let mn = 999, mx = -1, wet = 0; for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) { const h = w.topAt(cx + dx, cz + dz); mn = Math.min(mn, h); mx = Math.max(mx, h); const b = w.getBlock(cx + dx, h, cz + dz); if (b && (R.T.flags[b] & VR.F.FLUID)) wet++; }
    if (mx - mn <= 3 && !wet) best = [cx, mn + 1, cz];
  }
  if (!best) return { err: 'no flat ground' };
  const [cx, gy, cz] = best, y0 = gy;
  for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 7; dz++) { for (let y = y0; y < y0 + 16; y++) set(cx + dx, y, cz + dz, 0); for (let y = y0 - 4; y < y0; y++) if (!w.getBlock(cx + dx, y, cz + dz) || y === y0 - 1) set(cx + dx, y, cz + dz, st(y === y0 - 1 && (Math.abs(dx) > 3 || Math.abs(dz) > 3) ? 'grass_block' : 'dirt')); }
  const wall = spec.wall || 'oak_planks', roof = spec.roof || 'spruce_planks';
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) { set(cx + dx, y0 - 1, cz + dz, st('stone_bricks')); set(cx + dx, y0 + 4, cz + dz, st(roof)); }
  for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) if (Math.max(Math.abs(dx), Math.abs(dz)) === 4) set(cx + dx, y0 + 4, cz + dz, st(roof));
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) set(cx + dx, y0 + 5, cz + dz, st(roof));
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) { if (Math.abs(dx) !== 3 && Math.abs(dz) !== 3) continue; for (let y = y0; y <= y0 + 3; y++) set(cx + dx, y, cz + dz, st(Math.abs(dx) === 3 && Math.abs(dz) === 3 ? 'oak_log' : wall)); }
  // windows east and west
  for (const dx of [-3, 3]) for (const dz of [-1, 1]) set(cx + dx, y0 + 1, cz + dz, st('glass'));
  // the door in the south wall (+z)
  const dt = R.byName.oak_door;
  set(cx, y0, cz + 3, dt.state({ facing: 2, half: 0, open: 0, hinge: 0 })); set(cx, y0 + 1, cz + 3, dt.state({ facing: 2, half: 1, open: 0, hinge: 0 }));
  // a bed along the north wall, the light last (the home is complete with it)
  const bt = R.byName[spec.bed || 'red_bed'];
  set(cx - 2, y0, cz - 1, bt.state({ facing: 0, part: 0 })); set(cx - 2, y0, cz - 2, bt.state({ facing: 0, part: 1 }));
  if (spec.bed2) { set(cx - 1, y0, cz - 1, bt.state({ facing: 0, part: 0 })); set(cx - 1, y0, cz - 2, bt.state({ facing: 0, part: 1 })); }
  set(cx + 2, y0, cz - 2, st('vx_chair'));
  set(cx + 2, y0, cz + 2, st('lantern'));   // (a torch in the air falls off: the lantern stands on the floor)
  return { c: [cx, y0, cz], door: [cx, y0, cz + 3], bed: [cx - 2, y0, cz - 1] };
}, spec);
    const H1 = await build({ c: [far[0], far[1]], bed2: true });
    check(H1 && !H1.err, 'a cottage: ' + JSON.stringify(H1));
    await step(120, 33);
    await ev((b) => { const g = VR.game; g.env.setTime(15000); if (g.sleep) g.sleep(b[0], b[1], b[2]); else { g.env.setTime(0); g.env.day = (g.env.day || 0) + 1; } }, H1.bed);
    await wait(3500);
    await ev(() => { const g = VR.game; if (g.ui && g.ui.show) g.ui.show(null); });
    const door = H1.door;
    await stand([door[0] + 5.5, door[1] + 1, door[2] + 9.5], [door[0] + 0.5, door[1] + 1, door[2] + 18]);
    let framed = null;
    for (let i = 0; i < 300 && !framed; i++) {
      await step(6, 50);
      const f = await ev(() => { const g = VR.game, J = g.villages && g.villages._mi && g.villages._mi.job; if (!J) return { job: false }; if (!J.frame) return { job: true, done: J.frameDone }; return { job: true, k: VR.MoveIn.frameK(J.frame.t), cart: J.cart.slice() }; });
      if (f.k > 0.97) {
        const sh = await ev((cart) => { const g = VR.game, c = g.cam, fov = (g.settings.fov || 70) * Math.PI / 180, asp = 960 / 540, ty = Math.tan(fov / 2), tx = ty * asp; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch); for (const ox of [-1, 1]) for (const oy of [0, 2]) for (const oz of [-1.37, 1.37]) { const dx = cart[0] + ox - c.x, dy = cart[1] + oy - c.y, dz = cart[2] + oz - c.z, xa = dx * cy - dz * sy, za = dx * sy + dz * cy, yb = dy * cp + za * sp, zb = -dy * sp + za * cp, f = -zb; if (f <= 0.1) continue; x0 = Math.min(x0, xa / (f * tx)); x1 = Math.max(x1, xa / (f * tx)); y0 = Math.min(y0, yb / (f * ty)); y1 = Math.max(y1, yb / (f * ty)); } return +((Math.max(0, Math.min(1, x1) - Math.max(-1, x0)) * Math.max(0, Math.min(1, y1) - Math.max(-1, y0)) / 4)).toFixed(3); }, f.cart);
        P.arrive = await grab('w2_movein_arrive.jpg', 3);
        framed = { share: sh };
      }
      if (f.job === false && i > 40) break;
    }
    check(!!framed && framed.share >= 0.08, `the arrival framed close: the cart ${framed ? (framed.share * 100).toFixed(1) : '–'} % of the frame (≥ 8 %)`);
    run.movein = framed;
  } catch (e) { check(false, 'movein: ' + e.message.slice(0, 300)); }
  sheet.push({ label: 'Der Einzug: der Karren nah im Bild', imgs: [P.arrive].filter(Boolean) });
  writeSheet(); save();
}

const errs = logs.filter(l => /pageerror|\[error\]/.test(l));
check(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
if (logs.length) console.log(logs.slice(0, 8).join('\n'));
save(); writeSheet();
await browser.close();
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
