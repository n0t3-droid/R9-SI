// r-seelen in the browser (docs/superpowers/plans/2026-11-07-r-seelen.md): a new Kreativ world (seed 4242), 960 × 540,
// de-DE, Balanced with the smooth people, Herzwelt's nearest village. Pictures at eye level, faces visible:
//   greet    a villager greets you with a memory („Danke nochmal für den Honig, Mira!“)
//   quarrel  „Streit um nichts“: the turned backs, the next evening the shared bench, the peace gift
//   book     the Wanderbuch's „Menschen“ page
//   storm    a storm-fearing villager hurries home before the storm
//   cost     Very Low / High frame time, VR.SeelenGame on / off interleaved (ABBA); its own ms per frame
// → test/shots/se_*.png, test/shots/seelen_sheet.jpg, .tmp_tests/seelen_run.json
//   nohup bash test/wt_run.sh seelen.mjs 3600 > .tmp_tests/seelen.log 2>&1 &   (ONLY=greet,quarrel,book,storm,cost)
// regress: skip  (pictures; the gates are test/seelen.js and test/seelen_sim.js)
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
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/seelen_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|seelen/i.test(s)) logs.push(`[${t}] ${s.slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto(DIST);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } for (let i = 0; i < m; i++) { window.__norender = !(window.__rEvery && (window.__fr = (window.__fr || 0) + 1) % window.__rEvery === 0); g.last = performance.now() - d; g.loop(performance.now()); } window.__norender = true; }, [Math.min(10, n - k), dtms]); await wait(3); } };
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
// a page screenshot (the speech bubbles are HTML over the canvas)
const snap = async (name) => {
  await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } window.__norender = true; });
  // (run 2: page.screenshot timed out at 30 s under load — a longer wait; else the canvas with the bubble's words written
  // on it below, marked as such)
  try { await page.screenshot({ path: SHOTS + name, timeout: 120000 }); console.log('  📷 ' + name); return SHOTS + name; }
  catch (e) {
    const txt = await ev(() => { const a = window.__cu; return a && a.bubble ? a.bubble.text : ''; });
    const r = await grab(name); if (!r) return null;
    try { execFileSync('python3', ['-c', `import sys\nfrom PIL import Image, ImageDraw, ImageFont\nim=Image.open(sys.argv[1]).convert('RGB');d=ImageDraw.Draw(im)\ntry:\n f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',22)\nexcept Exception:\n f=ImageFont.load_default()\nt=sys.argv[2];w=d.textlength(t,font=f);x=(im.width-w)/2;y=36\nd.rounded_rectangle([x-14,y-10,x+w+14,y+36],12,fill=(255,255,255),outline=(60,60,60),width=2)\nd.text((x,y),t,fill=(30,30,30),font=f)\nd.text((8,im.height-22),'(Sprechblase nachgezeichnet: page.screenshot zu langsam)',fill=(255,255,255),font=ImageFont.load_default())\nim.save(sys.argv[1])`, r, txt]); } catch (e2) { console.log('  (no overlay: ' + String(e2.message).slice(0, 120) + ')'); }
    console.log('  📷 ' + name + ' (the canvas, the words drawn on)'); return r;
  }
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
// (run 2: the player stood before the picnic's lens — the others near and the player are avoided, the player steps away
// unless o.keepPlayer)
const group = async (C, r, name, o) => {
  const f = await ev(([C, r, o]) => {
    const g = VR.game, p = g.player, M = window.__M, mem = new Set((M ? M.members : []).concat(VR.Folk5 ? VR.Folk5.lookers(g.villages) : [], window.__keep || []));
    if (!(o && o.keepPlayer)) { p.flying = true; p.noclip = true; p.teleport(C[0] - 18, C[1] + 9, C[2] - 18); p.vel[0] = p.vel[1] = p.vel[2] = 0; }
    const avoid = []; for (const a of g.villages.agents) if (!mem.has(a) && Math.hypot(a.pos[0] - C[0], a.pos[2] - C[2]) < r + 9) avoid.push([a.pos[0], a.pos[2]]);
    const f = VR.Folk3.groupShot(g.photoCam, C, r, Object.assign({ avoid }, o || {})); if (f) window.__shotT = f.T; return f ? { d: +f.d.toFixed(1), n: avoid.length } : null; }, [C, r, o || null]);
  if (!f) { check(false, `${name}: a frame for the group`); return null; }
  await step(2, 33);
  return grab(name);
};
// the player on the ground at (x, z) near height y, a moment of kind begun in village vid → its summary
const stand = (x, y, z) => ev(([x, y, z]) => { const p = VR.game.player; p.flying = false; p.noclip = false; p.teleport(x, y + 1, z); p.vel[0] = p.vel[1] = p.vel[2] = 0; }, [x, y, z]);
const begin = (vid, kind) => ev(([vid, kind]) => {
  const g = VR.game, V = g.villages, F4 = VR.Folk4, v = V.known.get(vid); F4.auto = false;
  // (run 2: a dance of folkjoy's own was still there; f-folk5: F4.clear ends the moment, a stray dance, stale marks and
  // the onlookers at once — then a retry a few frames later if the first try finds nobody free)
  if (F4.clear) F4.clear(V); else { if (V._f4M) F4.end(V); if (V.joy && V.joy.dance) { for (const o of V.joy.dance.members) if (o.act && o.act.type === 'joy') V.joyEnd(o); V.joy.dance = null; } }
  const M = F4.begin(V, v, kind); window.__M = M;
  return M ? { n: M.members.length, who: M.members.map(a => a.p.name).join(', '), spot: M.spot || (M.D && M.D.c) || null } : null;
}, [vid, kind]);
const begin1 = begin;
// (f-folk5: robust — a second try after a second of the village's own time when the first finds nobody free)
const beginR = async (vid, kind) => { let m = await begin1(vid, kind); if (!m) { await step(30, 33); m = await begin1(vid, kind); } return m; };
const sheet = [];
const writeSheet = () => { for (const r of sheet) r.imgs = r.imgs.filter(Boolean); for (let i = sheet.length - 1; i >= 0; i--) if (!sheet[i].imgs.length) sheet.splice(i, 1); if (!sheet.length) return; fs.writeFileSync(ROOT + '/.tmp_tests/seelen_sheet.json', JSON.stringify({ w: 620, rows: sheet })); try { console.log('  ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'seelen_sheet.jpg', ROOT + '/.tmp_tests/seelen_sheet.json']).toString().trim()); } catch (e) { console.log('  (no sheet: ' + String(e.message).slice(0, 200) + ')'); } };

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.smoothFolk = true; g.settings.playerName = 'Mira'; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Seelen',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
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


const rows = { greet: [], quarrel: [], book: [], storm: [] };
const C0 = HP ? HP.plaza : [0, 64, 0];
// the camera at eye level beside a villager (rot: radians round them from the player's side, d metres away)
const faceCam = async (sel, d, rot, h) => {
  const cam = await ev(([sel, d, rot, h]) => { const a = window[sel], p = VR.game.player.pos; let dx = p[0] - a.pos[0], dz = p[2] - a.pos[2]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; const c = Math.cos(rot), s = Math.sin(rot), rx = dx * c - dz * s, rz = dx * s + dz * c; return { P: [a.pos[0] + rx * d, a.pos[1] + (h || 1.5), a.pos[2] + rz * d], T: [a.pos[0], a.pos[1] + 1.2, a.pos[2]] }; }, [sel, d, rot, h]);
  await lookFrom(cam.P, cam.T);
};
// a two-shot: the camera at eye level on the side of the pair, d metres from their middle
const pairCam = async (d, side) => {
  const cam = await ev(([d, side]) => { const A = window.__A, B = window.__B; const mx = (A.pos[0] + B.pos[0]) / 2, mz = (A.pos[2] + B.pos[2]) / 2; let ax = B.pos[0] - A.pos[0], az = B.pos[2] - A.pos[2]; const l = Math.hypot(ax, az) || 1; ax /= l; az /= l; const nx = -az * side, nz = ax * side; return { P: [mx + nx * d, A.pos[1] + 1.55, mz + nz * d], T: [mx, A.pos[1] + 1.0, mz] }; }, [d, side]);
  await lookFrom(cam.P, cam.T);
};
if (HP) await ev(() => { VR.Folk4.auto = false; VR.Folk4.off = true; });   // (no moments of folk4's own in the pictures)
// ---------------------------------------------------------------- a greeting with a memory
if (HP && want('greet')) {
  try {
    await photoOff(); await ev(() => VR.game.env.setTime(4500)); await stand(C0[0] + 4, C0[1], C0[2] + 4); await step(20, 33);
    const who = await ev((vid) => {
      const g = VR.game, V = g.villages, v = V.known.get(vid), C = v.plan.plaza, S = VR.Seelen, SG = VR.SeelenGame;
      const a = v.agents.filter(a => !a.kid && a.pose === 'stand' && !(a.act && /^(talk|school|se_meet)$/.test(a.act.type))).sort((x, y) => Math.hypot(x.pos[0] - C.x, x.pos[2] - C.z) - Math.hypot(y.pos[0] - C.x, y.pos[2] - C.z))[0];
      if (!a) return null;
      window.__G = a;
      const m = SG.mind(g, a), t = SG.test.now();
      S.plMeet(m, t - 3000); S.note(m, 'gift', t - 1700, { a: 'honey_bottle', w: 'pl' }); S.plAdd(m, 'g', t - 1700);
      const p = g.player, fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
      p.flying = false; p.noclip = false; p.teleport(a.pos[0] + fx * 3.5, a.pos[1] + 0.2, a.pos[2] + fz * 3.5); p.vel[0] = p.vel[1] = p.vel[2] = 0;
      a.act = { type: 'stand', t: 0 }; a.path = null; a.steer = null; a.vel[0] = a.vel[2] = 0; a.greeted = false; a.bubble = null;
      for (const o of v.agents) if (o !== a) { o.bubble = null; o.greeted = true; }
      VR.Gossip.hello(V, a);
      return { name: a.p.name, said: a.bubble ? a.bubble.text : null };
    }, HV.id);
    run.greet = who; console.log('  · greet ' + JSON.stringify(who));
    check(!!who && /Honig/.test(who.said || ''), `greet: the greeting remembers the honey („${who && who.said}“)`);
    if (who) {
      await faceCam('__G', 2.3, 0.4, 1.5); await step(4, 33);
      await ev(() => { const a = window.__G; a.lookAt = VR.game.player.eyePos(); a.expr = 'joy'; a.exprT = 30; if (a.bubble) a.bubble.t = 30; });
      await step(6, 33);
      rows.greet.push(await snap('se_greet.png'));
    }
  } catch (e) { check(false, 'greet: ' + e.message); }
  save();
}
// ---------------------------------------------------------------- the quarrel and the reconciliation
if (HP && want('quarrel')) {
  try {
    await photoOff(); await ev(() => VR.game.env.setTime(10700)); await stand(C0[0] + 6, C0[1], C0[2] - 6); await step(10, 33);
    const q = await ev((vid) => {
      const g = VR.game, V = g.villages, v = V.known.get(vid), SG = VR.SeelenGame, C = v.plan.plaza;
      const ad = v.agents.filter(a => a.p.age === 'adult' && !a.guest && a.role !== 'ranger' && a.pose !== 'sleep');
      ad.sort((x, y) => Math.hypot(x.pos[0] - C.x, x.pos[2] - C.z) - Math.hypot(y.pos[0] - C.x, y.pos[2] - C.z));
      let A = null, B = null;
      for (let i = 0; i < ad.length && !A; i++) for (let j = i + 1; j < ad.length; j++) if (ad[i].p.fam !== ad[j].p.fam) { A = ad[i]; B = ad[j]; break; }
      if (!A) return null;
      window.__A = A; window.__B = B;
      for (const o of [A, B]) { o.pos = [C.x + 0.5 + (o === A ? 1.5 : -1.5), C.y, C.z + 0.5]; o.vel = [0, 0, 0]; o.act = null; o.thinkT = 0; o.bubble = null; }
      const qq = SG.test.quarrel(v, A, B, 'spat');
      return { a: A.p.name, b: B.p.name, ph: qq.ph, tp: qq.tp };
    }, HV.id);
    console.log('  · quarrel ' + JSON.stringify(q)); run.quarrel = q;
    check(!!q, 'quarrel: two neighbours quarrel');
    if (q) {
      let st = null;
      for (let i = 0; i < 60; i++) { await step(15, 33); st = await ev((vid) => { const A = window.__A, B = window.__B, q = VR.SeelenGame.test.R().d.q[vid]; return { ph: q.ph, ta: A.act && A.act.type, tb: B.act && B.act.type, tw: A.act && A.act.tw, back: !!(A.seBack && B.seBack), d: +Math.hypot(A.pos[0] - B.pos[0], A.pos[2] - B.pos[2]).toFixed(1), ba: A.bubble ? A.bubble.text : '', bb: B.bubble ? B.bubble.text : '' }; }, HV.id); if (st.back && (st.ba || st.bb) && st.tw > 9) break; }
      console.log('  · spat ' + JSON.stringify(st));
      check(st && st.back, `quarrel: they turn their backs (${st && st.d} m apart; „${st && (st.ba || st.bb)}“)`);
      await pairCam(4.2, 1); await step(3, 33);
      await ev(() => { for (const a of [window.__A, window.__B]) { if (a.bubble) a.bubble.t = 20; } });
      await step(3, 33);
      rows.quarrel.push(await snap('se_spat.png'));
      // the next evening: the bench
      await stand(C0[0] + 6, C0[1], C0[2] - 6);
      await ev(() => { const g = VR.game; g.env.day = (g.env.day | 0) + 1; g.env.setTime(10800); for (const a of [window.__A, window.__B]) { a.bubble = null; a.seBack = false; } });
      let sat = null;
      for (let i = 0; i < 70; i++) { await step(15, 33); sat = await ev((vid) => { const A = window.__A, B = window.__B, q = VR.SeelenGame.test.R().d.q[vid]; return { ph: q.ph, pa: A.pose, pb: B.pose, tw: A.act && A.act.tw, d: +Math.hypot(A.pos[0] - B.pos[0], A.pos[2] - B.pos[2]).toFixed(1), ba: A.bubble ? A.bubble.text : '', bb: B.bubble ? B.bubble.text : '' }; }, HV.id); if (sat.pa === 'sit' && sat.pb === 'sit' && (sat.ba || sat.bb)) break; if (sat.ph === 'gift') break; }
      console.log('  · bench ' + JSON.stringify(sat));
      check(sat && sat.pa === 'sit' && sat.pb === 'sit', `reconcile: the next evening they share a bench (${sat && sat.d} m; „${sat && (sat.ba || sat.bb)}“)`);
      await pairCam(3.4, -1); await step(3, 33);
      await ev(() => { for (const a of [window.__A, window.__B]) { if (a.bubble) a.bubble.t = 20; } });
      rows.quarrel.push(await snap('se_bench.png'));
      for (let i = 0; i < 50; i++) { const ph = await ev((vid) => VR.SeelenGame.test.R().d.q[vid].ph, HV.id); if (ph !== 'bench') break; await step(15, 33); }
      // the day after at noon: the peace gift
      await stand(C0[0] + 6, C0[1], C0[2] - 6);
      await ev(() => { const g = VR.game; g.env.day = (g.env.day | 0) + 1; g.env.setTime(5800); for (const a of [window.__A, window.__B]) a.bubble = null; });
      let gi = null;
      for (let i = 0; i < 70; i++) { await step(10, 33); gi = await ev((vid) => { const A = window.__A, B = window.__B, q = VR.SeelenGame.test.R().d.q[vid]; return { ph: q.ph, giver: q.g, tw: A.act && A.act.tw, d: +Math.hypot(A.pos[0] - B.pos[0], A.pos[2] - B.pos[2]).toFixed(1), ba: A.bubble ? A.bubble.text : '', bb: B.bubble ? B.bubble.text : '', log: VR.SeelenGame.log.slice(-3).map(l => l.kind) }; }, HV.id); if (gi.log.indexOf('q.thanks') >= 0 || gi.ph === 'done') break; }
      console.log('  · gift ' + JSON.stringify(gi));
      check(gi && (gi.log.indexOf('q.thanks') >= 0 || gi.ph === 'done'), `reconcile: a peace gift and thanks („${gi && gi.ba}“ / „${gi && gi.bb}“)`);
      await pairCam(3.4, 1); await step(2, 33);
      await ev(() => { const V = VR.game.villages; for (const a of [window.__A, window.__B]) { a.expr = 'joy'; a.exprT = 20; if (a.bubble) a.bubble.t = 20; } V.hearts(window.__A); });
      await step(2, 33);
      rows.quarrel.push(await snap('se_gift.png'));
      for (let i = 0; i < 30; i++) { const ph = await ev((vid) => VR.SeelenGame.test.R().d.q[vid].ph, HV.id); if (ph === 'done') break; await step(15, 33); }
      const end = await ev((vid) => { const g = VR.game, S = VR.Seelen, SG = VR.SeelenGame, v = g.villages.known.get(vid), A = window.__A, B = window.__B; const q = SG.test.R().d.q[vid]; return { ph: q.ph, v: +S.relV(SG.graph(g, v), SG.test.lid(A.p), SG.test.lid(B.p)).toFixed(2), mem: SG.mind(g, A).m.filter(e => e.k === 'made_up').length }; }, HV.id);
      run.quarrelEnd = end; console.log('  · after ' + JSON.stringify(end));
      check(end.ph === 'done' && end.mem >= 1, `reconciled and remembered (${end.ph}, graph ${end.v})`);
    }
  } catch (e) { check(false, 'quarrel: ' + e.message); }
  save();
}
// ---------------------------------------------------------------- the Wanderbuch's „Menschen“
if (HP && want('book')) {
  try {
    await photoOff();
    await ev((vid) => {
      const g = VR.game, S = VR.Seelen, SG = VR.SeelenGame, v = g.villages.known.get(vid), t = SG.test.now();
      const L = v.agents.filter(a => !a.guest && a.p.age !== 'child').slice(0, 4);
      L.forEach((a, k) => { const m = SG.mind(g, a); for (let n = 0; n < 2 + k * 2; n++) S.plMeet(m, t - 4000 + n * 200); if (k % 2 === 0) { S.note(m, 'gift', t - 900, { a: k ? 'bread' : 'honey_bottle', w: 'pl' }); S.plAdd(m, 'g', t - 900); } if (k === 1) { S.note(m, 'storm', t - 800, { i: 8 }); S.note(m, 'storm', t - 2000, { i: 8 }); } S.note(m, 'build', t - 600, { a: 'bakery' }); S.reflect(m, t, g.env.day | 0); });
      if (window.__G) { const m = SG.mind(g, window.__G); S.reflect(m, t, g.env.day | 0); }
      VR.Wander.open(g);
    }, HV.id);
    await wait(400);
    const txt = await ev(() => { const el = document.querySelector('#wanderbuch .sesec'); return el ? el.textContent.slice(0, 400) : null; });
    run.book = txt; console.log('  · book ' + (txt || '').slice(0, 200));
    check(!!txt && /Menschen/.test(txt) && /Honig/.test(txt), 'book: the „Menschen“ page lists the people you know, their feelings and last words');
    await ev(() => { const el = document.querySelector('#wanderbuch .sesec'); if (el) el.scrollIntoView({ block: 'start' }); });
    try { await page.screenshot({ path: SHOTS + 'se_book.png', timeout: 120000 }); rows.book.push(SHOTS + 'se_book.png'); console.log('  📷 se_book.png'); } catch (e) { check(false, 'book: picture ' + e.message); }
    await ev(() => { const g = VR.game; if (VR.Wander.close) VR.Wander.close(g); else g.ui.show(null); });
  } catch (e) { check(false, 'book: ' + e.message); }
  save();
}
// ---------------------------------------------------------------- a storm-fearing villager hurries home
if (HP && want('storm')) {
  try {
    await photoOff(); await ev(() => { const g = VR.game; g.env.setTime(3500); if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); VR.SeelenGame.test.storm(0); }); await stand(C0[0] + 5, C0[1], C0[2] + 5); await step(20, 33);
    const who = await ev((vid) => {
      const g = VR.game, S = VR.Seelen, SG = VR.SeelenGame, v = g.villages.known.get(vid), p = g.player.pos;
      const L = v.agents.filter(a => !a.guest && !a.kid && a.role !== 'ranger' && a.pose === 'stand' && a.act && !/^(home|talk|se_meet|work)$/.test(a.act.type) && v.homes[a.p.home]);
      L.sort((x, y) => Math.hypot(x.pos[0] - p[0], x.pos[2] - p[2]) - Math.hypot(y.pos[0] - p[0], y.pos[2] - p[2]));
      const a = L[0]; if (!a) return null;
      window.__S = a;
      const m = SG.mind(g, a), t = SG.test.now();
      S.note(m, 'storm', t - 900, { i: 8 }); S.note(m, 'storm', t - 2500, { i: 8 }); S.reflect(m, t, g.env.day | 0);
      return { name: a.p.name, act: a.act.type, fear: !!S.has(m, 'fearStorm') };
    }, HV.id);
    console.log('  · storm ' + JSON.stringify(who));
    check(!!who && who.fear, 'storm: a villager afraid of storms (two remembered)');
    if (who) {
      await ev(() => { const g = VR.game; if (g.env.wx && g.env.wx.force) g.env.wx.force('gewitter'); VR.SeelenGame.test.storm(0.6); });
      let st = null;
      for (let i = 0; i < 20; i++) { await step(10, 33); st = await ev(() => { const a = window.__S; return { act: a.act && a.act.type, hurry: !!a.seHurry, speed: +a.speed.toFixed(2), sp0: +(a.seSpeed0 || 0).toFixed(2), said: a.bubble ? a.bubble.text : '', v: +Math.hypot(a.vel[0], a.vel[2]).toFixed(2) }; }); if (st.hurry && st.said && st.v > 1) break; }
      run.storm = st; console.log('  · hurry ' + JSON.stringify(st));
      check(st && st.act === 'home' && st.hurry && st.speed > st.sp0, `storm: hurries home, faster (${st && st.sp0} → ${st && st.speed} m/s; „${st && st.said}“)`);
      await faceCam('__S', 3.2, 0.9, 1.55); await step(3, 33);
      await ev(() => { const a = window.__S; if (a.bubble) a.bubble.t = 20; else a.say(VR.SeelenGame.log.slice(-1)[0] ? VR.SeelenGame.log.slice(-1)[0].text : '', 20); });
      await step(2, 33);
      rows.storm.push(await snap('se_storm.png'));
      await ev(() => { const g = VR.game; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); VR.SeelenGame.test.storm(0); });
    }
  } catch (e) { check(false, 'storm: ' + e.message); }
  save();
}
// ---------------------------------------------------------------- the cost
if (HP && want('cost')) {
  try {
    const cost = run.cost = {};
    const own = await ev(() => { const c = VR.SeelenGame.cost; return { avg: +(c.ms / Math.max(1, c.frames)).toFixed(4), max: +c.max.toFixed(3), frames: c.frames, plans: c.plans, reflect: c.reflect, sensed: c.sensed }; });
    run.own = own; console.log('  · own cost over the run ' + JSON.stringify(own));
    check(own.avg <= 0.05, `main thread ≤ 0.05 ms a frame on average (${own.avg} ms; max ${own.max} ms)`);
    const preset = (pr) => ev((pr) => { const g = VR.game; g.applyPreset(pr); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); }, pr);
    for (const pr of ['potato', 'high']) {
      await photoOff(); await preset(pr); await ev(() => VR.game.env.setTime(4000)); await stand(C0[0] + 5, C0[1], C0[2] - 5); await settle(20); await step(30, 33);
      await lookFrom([C0[0] + 14, C0[1] + 6, C0[2] + 4], C0); await step(10, 33);
      const r = await ev(() => {
        const g = VR.game, SG = VR.SeelenGame, gl = g.renderer.gl;
        window.__norender = false;
        for (let i = 0; i < 6; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } gl.finish();
        const a = [], b = [];
        for (let blk = 0; blk < 6; blk++) for (const [m, arr] of [['off', a], ['on', b], ['on', b], ['off', a]]) { SG.off = m === 'off'; for (let i = 0; i < 4; i++) { const t = performance.now(); g.last = t - 33; g.loop(t); gl.finish(); arr.push(performance.now() - t); } }
        SG.off = false; window.__norender = true;
        const med = (q) => { q.sort((x, y) => x - y); return +q[q.length >> 1].toFixed(2); };
        return { off: med(a), on: med(b), programs: g.renderer.programs ? Object.keys(g.renderer.programs).length : null };
      });
      cost[pr] = r; console.log(`  · cost ${pr}: off ${r.off} ms | on ${r.on} ms (load ${load()}; ${secs()})`);
      if (pr === 'potato') check(r.on <= r.off * 1.1 + 0.5, `Very Low not slower with VR.SeelenGame (${r.off} → ${r.on} ms)`);
    }
  } catch (e) { check(false, 'cost: ' + e.message); }
  save();
}
sheet.push({ label: 'Begrüßung mit Erinnerung: „Danke nochmal für den Honig!“', imgs: rows.greet });
sheet.push({ label: 'Streit um nichts: Rücken an Rücken – am nächsten Abend dieselbe Bank – Friedensgeschenk', imgs: rows.quarrel });
sheet.push({ label: 'Wanderbuch: die Seite „Menschen“', imgs: rows.book });
sheet.push({ label: 'Angst vor Stürmen: läuft vor dem Gewitter schnell nach Hause', imgs: rows.storm });
writeSheet();
const errs = logs.filter(l => /pageerror|seelen|TypeError|ReferenceError/.test(l));
check(!errs.length, `no page error (${errs.slice(0, 3).join(' | ')})`);
save();
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
