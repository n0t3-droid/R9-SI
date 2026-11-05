// u-folk4 in the browser (docs/superpowers/plans/2026-11-05-u-folk4.md): a new Kreativ world (seed 4242), 960 × 540,
// de-DE, Balanced with the smooth people, Herzwelt's nearest village with children. The moments staged by VR.Folk4
// beside the player and framed by u-folk3's camera director (📷 photo mode): children playing tag in the yard, two
// neighbours' picnic on the blanket, the dusk dance circle with the fiddler, the player joined and the Flausellichter
// gathered, a greeting close-up (the wave, the happy squint, the words with the player's name — a page screenshot: the
// bubble is HTML); Very Low / High cost with a moment running, Folk4 on / off interleaved (ABBA).
// → test/shots/f4_*.png, test/shots/folk4_sheet.jpg, .tmp_tests/folk4_run.json
//   nohup bash test/wt_run.sh folk4.mjs 3600 > .tmp_tests/folk4.log 2>&1 &   (ONLY=tag,picnic,greet,dance,cost)
// regress: skip  (pictures; the gate is test/folk4.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '').replace(/\/\.tmp_tests$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html';
const SHOTS = ROOT + '/test/shots/';
const SEED = process.env.SEED || '4242';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, want = (s) => !ONLY || ONLY.includes(s);
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
const load = () => fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0];
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + ' (' + secs() + ')'); };
const run = { seed: SEED };
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/folk4_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|folk4/i.test(s)) logs.push(`[${t}] ${s.slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto(DIST);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } for (let i = 0; i < m; i++) { window.__norender = !(window.__rEvery && (window.__fr = (window.__fr || 0) + 1) % window.__rEvery === 0); g.last = performance.now() - d; g.loop(performance.now()); } window.__norender = true; }, [Math.min(10, n - k), dtms]); await wait(3); } };
const settle = async (max = 50) => {
  let s = null;
  for (let i = 0; i < max; i++) {
    await step(20, 16);
    s = await ev(() => { const g = VR.game, w = g.world, p = g.player; if (!w || !p || g.state !== 'play') return { state: g.state }; let dirty = 0; for (const c of w.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { state: g.state, dirty, busy: w.pool && w.pool.busy ? w.pool.busy() : 0 }; });
    if (s.state === 'play' && !s.dirty && i > 2) break;
    await wait(30);
  }
  return s;
};
const grab = async (name, frames = 4) => {
  const url = await ev((frames) => { try { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; } catch (e) { window.__norender = true; return null; } }, frames);
  if (url && url.length > 2000) { fs.writeFileSync(SHOTS + name, Buffer.from(url.split(',')[1], 'base64')); console.log('  📷 ' + name); return SHOTS + name; }
  console.log('  !! no picture ' + name); return null;
};
// a page screenshot (the speech bubbles are HTML over the canvas)
const snap = async (name) => {
  await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } window.__norender = true; });
  await page.screenshot({ path: SHOTS + name }); console.log('  📷 ' + name); return SHOTS + name;
};
const lookFrom = (P, T) => ev(([P, T]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(P[0], P[1] - (p.eye || 1.62), P[2]); p.vel[0] = p.vel[1] = p.vel[2] = 0; const e = p.eyePos(), dx = T[0] - e[0], dy = T[1] - e[1], dz = T[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw; }, [P, T]);
const loaded = async (C, r) => { for (let i = 0; i < 120; i++) { await step(10, 33); const ok = await ev(([C, r]) => { const w = VR.game.world; for (let dx = -r; dx <= r; dx += 16) for (let dz = -r; dz <= r; dz += 16) if (!w.isLoaded(C[0] + dx, C[2] + dz)) return false; return true; }, [C, r]); if (ok) return true; await wait(25); } return false; };
const prewarm = (maxMs = 120000) => ev(async (maxMs) => {
  const g = VR.game, FG = VR.FolkGPU, V = g.villages; if (!FG || !FG.on(g)) return null;
  const P0 = FG.PER_FRAME, I0 = FG.INFLIGHT; FG.PER_FRAME = 1e9; FG.INFLIGHT = 1e9;
  const p = g.player.pos; let asked = 0;
  for (const a of V.agents) { if (Math.hypot(a.pos[0] - p[0], a.pos[2] - p[2]) > 60) continue; const rec = a.fg || (a.fg = FG.recFor(a.p.look)); if (rec.state === 0 && FG.want(g, rec, 0)) asked++; }
  g.world.pool.pump();
  const t0 = performance.now();
  while (FG.inflight > 0 && performance.now() - t0 < maxMs) await new Promise((r) => setTimeout(r, 200));
  FG.PER_FRAME = P0; FG.INFLIGHT = I0;
  return { asked, ms: Math.round(performance.now() - t0) };
}, maxMs);
const photoOn = (tick) => ev((tick) => { const g = VR.game; if (!g.photoCam || !g.photoCam.on) g.photoMode(true); const pc = g.photoCam; pc.first = false; if (tick !== null && tick !== undefined) { pc.held = tick; g.env.setTime(tick); } return !!(pc && pc.on); }, tick);
const photoOff = () => ev(() => { const g = VR.game; if (g.photoCam && g.photoCam.on) g.photoMode(false); });
const group = async (C, r, name, o) => {
  const f = await ev(([C, r, o]) => { const g = VR.game, f = VR.Folk3.groupShot(g.photoCam, C, r, o || {}); if (f) window.__shotT = f.T; return f ? { d: +f.d.toFixed(1) } : null; }, [C, r, o || null]);
  if (!f) { check(false, `${name}: a frame for the group`); return null; }
  await step(2, 33);
  return grab(name);
};
// the player on the ground at (x, z) near height y, a moment of kind begun in village vid → its summary
const stand = (x, y, z) => ev(([x, y, z]) => { const p = VR.game.player; p.flying = false; p.noclip = false; p.teleport(x, y + 1, z); p.vel[0] = p.vel[1] = p.vel[2] = 0; }, [x, y, z]);
const begin = (vid, kind) => ev(([vid, kind]) => {
  const g = VR.game, V = g.villages, F4 = VR.Folk4, v = V.known.get(vid); F4.auto = false; if (V._f4M) F4.end(V);
  if (V.joy && V.joy.dance) V.joy.dance.t = V.joy.dance.len + 1;
  const M = F4.begin(V, v, kind); window.__M = M;
  return M ? { n: M.members.length, who: M.members.map(a => a.p.name).join(', '), spot: M.spot || (M.D && M.D.c) || null } : null;
}, [vid, kind]);
const sheet = [];
const writeSheet = () => { for (const r of sheet) r.imgs = r.imgs.filter(Boolean); for (let i = sheet.length - 1; i >= 0; i--) if (!sheet[i].imgs.length) sheet.splice(i, 1); if (!sheet.length) return; fs.writeFileSync(ROOT + '/.tmp_tests/folk4_sheet.json', JSON.stringify({ w: 620, rows: sheet })); try { console.log('  ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'folk4_sheet.jpg', ROOT + '/.tmp_tests/folk4_sheet.json']).toString().trim()); } catch (e) { console.log('  (no sheet: ' + String(e.message).slice(0, 200) + ')'); } };

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.smoothFolk = true; g.settings.playerName = 'Mira'; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Dorfleben',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world');
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(3000); if (g.ui && g.ui.show) g.ui.show(null); if (VR.Portal) VR.Portal.GATE_S = 1e9; });
await settle(30);

let HV = null, HP = null;
{
  let list = null;
  for (let i = 0; i < 40 && !(list && list.length); i++) { await step(20, 33); list = await ev(() => { const g = VR.game, p = g.player.pos; return g.villages.sites.filter(s => !/^eco:/.test(s.id)).map(s => ({ id: s.id, x: s.x, y: s.y, z: s.z, name: s.name, style: s.style, d: Math.round(Math.hypot(s.x - p[0], s.z - p[2])) })).sort((a, b) => (/^(modern|tech|hall)$/.test(a.style) ? 1 : 0) - (/^(modern|tech|hall)$/.test(b.style) ? 1 : 0) || a.d - b.d).slice(0, 3); }); }
  for (const cand of list || []) {
    HV = cand; HP = null;
    await lookFrom([HV.x + 20, HV.y + 14, HV.z + 20], [HV.x, HV.y, HV.z]);
    await loaded([HV.x, HV.y, HV.z], 48); await settle(60);
    for (let i = 0; i < 40 && !HP; i++) { await step(20, 33); HP = await ev((vid) => { const v = VR.game.villages.known.get(vid); if (!v || !v.active) return null; const P = v.plan.plaza; return { plaza: [P.x + 0.5, P.y, P.z + 0.5], agents: v.agents.length, kids: v.agents.filter(a => a.kid).length }; }, HV.id); }
    console.log(`  · ${HV.name} (${HV.style}, ${HV.d} m): ${HP ? HP.agents : 0} people, ${HP ? HP.kids : 0} children`);
    if (HP && HP.kids >= 2) break;
  }
  check(!!HP && HP.agents > 4, `the village ${HV ? HV.name : '-'} lives (${HP ? HP.agents : 0} people)`);
  if (HP) { await ev(() => { window.__rEvery = 10; VR.game.env.setTime(4000); }); await step(200, 33); console.log('  · prewarm ' + JSON.stringify(await prewarm())); }
}
const rows = { tag: [], pic: [], dance: [], greet: [] };
const C0 = HP ? HP.plaza : [0, 64, 0];
// ---------------------------------------------------------------- tag
if (HP && want('tag')) {
  try {
    await photoOff(); await ev(() => VR.game.env.setTime(4000)); await stand(C0[0] + 7, C0[1], C0[2] + 7); await step(30, 33);
    const m = await begin(HV.id, 'tag'); console.log('  · tag: ' + JSON.stringify(m));
    check(!!m && m.n >= 2, `tag: begun (${m ? m.n : 0} children)`);
    if (m) {
      await step(150, 33);
      const st = await ev(() => { const M = window.__M, v = M.vil, A = v._f4area; let cx = 0, cz = 0; for (const k of M.members) { cx += k.pos[0]; cz += k.pos[2]; } cx /= M.members.length; cz /= M.members.length; return { game: v.game && v.game.type, play: M.members.filter(k => k.act && k.act.type === 'play').length, c: [cx, M.members[0].pos[1], cz], spread: Math.max(...M.members.map(k => Math.hypot(k.pos[0] - cx, k.pos[2] - cz))), area: A ? [A.cx, A.cz] : null }; });
      run.tag = st; check(st.game === 'tag' && st.play >= 2, `tag: they play tag (${st.play})`);
      await photoOn(4000);
      rows.tag.push(await group(st.c, Math.max(2.5, Math.min(6, st.spread + 1)), 'f4_tag.png'));
      await photoOff();
    }
  } catch (e) { check(false, 'tag: ' + e.message); }
  save();
}
// ---------------------------------------------------------------- picnic
if (HP && want('picnic')) {
  try {
    await photoOff(); await ev(() => VR.game.env.setTime(5200)); await stand(C0[0] + 6, C0[1], C0[2] - 6); await step(20, 33);
    const m = await begin(HV.id, 'picnic'); console.log('  · picnic: ' + JSON.stringify(m));
    check(!!m && m.n === 2, 'picnic: two neighbours');
    if (m) {
      let sat = 0; for (let i = 0; i < 40 && sat < 2; i++) { await step(20, 33); sat = await ev(() => window.__M.members.filter(a => a.pose === 'sitground').length); }
      check(sat === 2, `picnic: both on the blanket (${sat})`);
      await ev(() => { for (const a of window.__M.members) { a.bubble = null; a.expr = 'joy'; a.exprT = 30; } });
      await photoOn(9200);
      rows.pic.push(await group(m.spot, 1.6, 'f4_picnic.png', { d: 4.2 }));
      await photoOff();
    }
  } catch (e) { check(false, 'picnic: ' + e.message); }
  save();
}
// ---------------------------------------------------------------- the greeting close-up
if (HP && want('greet')) {
  try {
    await photoOff(); await ev(() => { const g = VR.game, V = g.villages; if (V._f4M) VR.Folk4.end(V); g.env.setTime(4500); }); await step(10, 33);
    const who = await ev((vid) => {
      const g = VR.game, V = g.villages, v = V.known.get(vid), C = v.plan.plaza;
      const a = v.agents.filter(a => !a.kid && a.pose !== 'sleep' && a.pose !== 'sit' && !(a.act && a.act.type === 'joy')).sort((x, y) => Math.hypot(x.pos[0] - C.x, x.pos[2] - C.z) - Math.hypot(y.pos[0] - C.x, y.pos[2] - C.z))[0];
      if (!a) return null;
      window.__cu = a; a.holdT = 60;
      // two earlier meetings: the third greeting is a friend's, with the name
      const rec = VR.Folk4.rec(g), pid = (g.dim || 'overworld') + '/' + a.p.id; rec.meet[pid] = [2, (g.env.day || 0) * 24000 + g.env.timeOfDay - 5000];
      return { name: a.p.name, pos: a.pos.slice() };
    }, HV.id);
    check(!!who, 'greet: someone to meet');
    if (who) {
      // the player 2.4 m before them, at eye height; they greet
      const said = await ev(() => {
        const g = VR.game, V = g.villages, a = window.__cu, p = g.player, fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
        p.flying = true; p.noclip = true; p.teleport(a.pos[0] + fx * 2.4, a.pos[1] + 0.1, a.pos[2] + fz * 2.4); p.vel[0] = p.vel[1] = p.vel[2] = 0;
        const e = p.eyePos(); p.yaw = Math.atan2(-(a.pos[0] - e[0]), -(a.pos[2] - e[2])); p.pitch = Math.atan2(a.pos[1] + 1.5 - e[1], Math.hypot(a.pos[0] - e[0], a.pos[2] - e[2])); p.viewYaw = p.yaw;
        a.act = { type: 'stand', t: 0 }; a.path = null; a.steer = null; a.vel[0] = a.vel[2] = 0; a.greeted = false; a.bubble = null; V._f4words = -1e9;
        VR.Gossip.hello(V, a);
        a.f4sq = V.time + 60; a.waveT = 60; a.bubble && (a.bubble.t = 60);
        return a.bubble ? a.bubble.text : null;
      });
      console.log('  · greet: ' + said);
      run.greet = said;
      check(!!said && said.indexOf('Mira') >= 0, `greet: the friend line with the name (${said})`);
      await ev(async () => { const g = VR.game, FG = VR.FolkGPU, a = window.__cu; if (!FG || !FG.on(g)) return; const rec = a.fg || (a.fg = FG.recFor(a.p.look)); if (rec.state === 0) FG.want(g, rec, 0); g.world.pool.pump(); const t0 = performance.now(); while (rec.state !== 2 && performance.now() - t0 < 60000) { await new Promise(r => setTimeout(r, 250)); g.world.pool.pump(); } });
      await step(6, 33);
      await ev(() => { const g = VR.game, V = g.villages, a = window.__cu, p = g.player.pos; a.f4sq = V.time + 60; a.waveT = 60; a.lookAt = [p[0], p[1] + 1.6, p[2]]; a.yaw = Math.atan2(-(p[0] - a.pos[0]), -(p[2] - a.pos[2])); a.expr = 'joy'; a.exprT = 60; });
      rows.greet.push(await snap('f4_greet.png'));
      // the close-up of the face (the canvas): the squint and the smile
      await photoOn(4500);
      const f = await ev(() => { const g = VR.game, a = window.__cu, f = VR.Folk3.portraitOf(g.photoCam, a, { d: 1.6, dMin: 1.2, keep: true }); if (f) window.__shotT = f.T; a.f4sq = g.villages.time + 60; a.expr = 'joy'; a.exprT = 60; a.waveT = 60; return !!f; });
      if (f) { await step(2, 33); await ev(() => { const g = VR.game, a = window.__cu; a.f4sq = g.villages.time + 60; a.waveT = 60; }); rows.greet.push(await grab('f4_greet_face.png')); }
      await photoOff();
    }
  } catch (e) { check(false, 'greet: ' + e.message); }
  save();
}
// ---------------------------------------------------------------- the dusk dance
if (HP && want('dance')) {
  try {
    await photoOff(); await ev(() => VR.game.env.setTime(11000)); await stand(C0[0] + 5, C0[1], C0[2] + 5); await step(40, 33);
    const m = await begin(HV.id, 'dance'); console.log('  · dance: ' + JSON.stringify(m));
    check(!!m, 'dance: begun');
    if (m) {
      let D = null;
      for (let i = 0; i < 30; i++) { await step(20, 33); D = await ev(() => { const M = window.__M, D = M && M.D; return D ? { n: D.members.length, ring: D.members.filter(a => a.dance && a.ringDance).length, c: D.c, r: D.r, fid: !!M.fiddler.f4fiddle } : null; }); if (!D || (D.ring >= D.n && D.fid)) break; }
      run.dance = D; check(D && D.ring >= Math.min(3, D.n) && D.fid, `dance: ${D ? D.ring : 0} of ${D ? D.n : 0} in the ring, the fiddler plays`);
      const j = await ev(() => VR.Folk4.join(VR.game.villages)); check(j, 'dance: V joins');
      await ev(() => VR.game.env.setTime(12150)); await step(240, 33);
      const lights = await ev(() => { const S = VR.Dusk; return S ? { lure: S.lure, out: S.out ? S.out.count : null } : null; });
      run.lights = lights; console.log('  · lights ' + JSON.stringify(lights));
      const beat = await ev(() => { const V = VR.game.villages, b = 60 / VR.Folk4.BPM; return VR.Folk4.press(V, Math.round(V.time / b) * b); });
      check(beat === 'beat', 'dance: V on the beat');
      await photoOn(12150);
      if (D) rows.dance.push(await group(D.c, D.r + 2.2, 'f4_dance.png', { d: 7.5 }));
      await photoOff();
    }
  } catch (e) { check(false, 'dance: ' + e.message); }
  save();
}
// ---------------------------------------------------------------- the cost: Very Low / High, a picnic running, Folk4 on / off (ABBA)
if (HP && want('cost')) {
  try {
    const cost = run.cost = {};
    const preset = (pr) => ev((pr) => { const g = VR.game; g.applyPreset(pr); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); }, pr);
    for (const pr of (process.env.COST ? process.env.COST.split(',') : ['potato', 'high'])) {
      await photoOff(); await preset(pr); await ev(() => VR.game.env.setTime(5200)); await stand(C0[0] + 6, C0[1], C0[2] - 6); await settle(20); await step(30, 33);
      await begin(HV.id, 'picnic'); await step(200, 33);
      const CP = [C0[0] + 14, C0[1] + 6, C0[2] + 4];
      await lookFrom(CP, C0); await step(10, 33);
      const r = await ev(() => {
        const g = VR.game, F4 = VR.Folk4, gl = g.renderer.gl;
        const set = (m) => { F4.sw.frame = F4.sw.draw = m === 'on'; };
        window.__norender = false;
        set('off'); for (let i = 0; i < 6; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } gl.finish();
        const a = [], b = [];
        for (let blk = 0; blk < 10; blk++) for (const [m, arr] of [['off', a], ['on', b], ['on', b], ['off', a]]) { set(m); for (let i = 0; i < 4; i++) { const t = performance.now(); g.last = t - 33; g.loop(t); gl.finish(); arr.push(performance.now() - t); } }
        window.__norender = true; set('on');
        const med = (q) => { q.sort((x, y) => x - y); return +q[q.length >> 1].toFixed(2); };
        return { off: med(a), on: med(b), moment: !!g.villages._f4M };
      });
      cost[pr] = r; console.log(`  · cost ${pr}: Folk4 off ${r.off} ms | on ${r.on} ms (moment ${r.moment}; load ${load()}; ${secs()})`);
      if (pr === 'potato') check(r.on <= r.off * 1.1 + 0.5, `Very Low not slower with Folk4 (${r.off} → ${r.on} ms)`);
    }
  } catch (e) { check(false, 'cost: ' + e.message); }
  save();
}
sheet.push({ label: 'Fangen spielen im Hof nahe beim Spieler', imgs: rows.tag });
sheet.push({ label: 'Picknick zweier Nachbarn auf der karierten Decke', imgs: rows.pic });
sheet.push({ label: 'Tanzkreis in der Abenddämmerung: Geiger, Flausellichter, Mira tanzt mit', imgs: rows.dance });
sheet.push({ label: 'Begrüßung: „Schön, dich wiederzusehen, Mira!" – Winken, fröhliches Blinzeln', imgs: rows.greet });
writeSheet();
const errs = logs.filter(l => /pageerror|folk4|TypeError|ReferenceError/.test(l));
check(!errs.length, `no page error (${errs.slice(0, 3).join(' | ')})`);
save();
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
