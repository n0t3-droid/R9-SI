// f-folk5 in the browser (docs/superpowers/plans/2026-11-05-f-folk5.md): folk4.mjs's sequence with f-folk5 — a new Kreativ
// world (seed 4242), 960 × 540, de-DE, Balanced with the smooth people, Herzwelt's nearest village with children. The
// moments back to back, each begun right after the last ended (F4.clear): tag, the picnic, a friend's big greeting (comes
// nearer, the two-arm wave or the lean, a heart), the dusk dance with its onlooker ring (pets and passers-by kept out),
// the Laternenzug at dusk (children with lanterns in a line, the Flausellichter following); the friend's squint on Very
// Low (the voxel people); Very Low / High cost with the procession running, Folk4+Folk5 on / off interleaved (ABBA).
// → test/shots/f5_*.png, test/shots/folk5_sheet.jpg, .tmp_tests/folk5_run.json
//   nohup bash test/wt_run.sh folk5.mjs 3600 > .tmp_tests/folk5.log 2>&1 &   (ONLY=tag,picnic,friend,dance,lantern,cost,vlsquint)
// regress: skip  (pictures; the gate is test/folk5.js)
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
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/folk5_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
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
const writeSheet = () => { for (const r of sheet) r.imgs = r.imgs.filter(Boolean); for (let i = sheet.length - 1; i >= 0; i--) if (!sheet[i].imgs.length) sheet.splice(i, 1); if (!sheet.length) return; fs.writeFileSync(ROOT + '/.tmp_tests/folk5_sheet.json', JSON.stringify({ w: 620, rows: sheet })); try { console.log('  ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'folk5_sheet.jpg', ROOT + '/.tmp_tests/folk5_sheet.json']).toString().trim()); } catch (e) { console.log('  (no sheet: ' + String(e.message).slice(0, 200) + ')'); } };

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

const rows = { tag: [], pic: [], friend: [], dance: [], lant: [], vl: [] };
const C0 = HP ? HP.plaza : [0, 64, 0];
const clean = (k) => ev(() => { const V = VR.game.villages, F4 = VR.Folk4; F4.clear(V); return { m: !!V._f4M, marks: V.agents.filter(a => a._f4 || a._f5 || (a.act && /^(f4|f5look|f5hi)$/.test(a.act.type))).length, dance: !!(V.joy && V.joy.dance) }; }).then((r) => { check(!r.m && !r.marks && !r.dance, `${k}: ended cleanly before the next (marks ${r.marks})`); return r; });
// ---------------------------------------------------------------- tag
if (HP && want('tag')) {
  try {
    await photoOff(); await ev(() => VR.game.env.setTime(4000)); await stand(C0[0] + 7, C0[1], C0[2] + 7); await step(30, 33);
    const m = await beginR(HV.id, 'tag'); console.log('  · tag: ' + JSON.stringify(m));
    check(!!m && m.n >= 2, `tag: begun (${m ? m.n : 0} children)`);
    if (m) {
      await step(120, 33);
      const st = await ev(() => { const M = window.__M; let cx = 0, cz = 0; for (const k of M.members) { cx += k.pos[0]; cz += k.pos[2]; } cx /= M.members.length; cz /= M.members.length; return { play: M.members.filter(k => k.act && k.act.type === 'play').length, c: [cx, M.members[0].pos[1], cz], spread: Math.max(...M.members.map(k => Math.hypot(k.pos[0] - cx, k.pos[2] - cz))) }; });
      run.tag = st; check(st.play >= 2, `tag: they play (${st.play})`);
      await photoOn(4000); rows.tag.push(await group(st.c, Math.max(2.5, Math.min(6, st.spread + 1)), 'f5_tag.png')); await photoOff();
    }
  } catch (e) { check(false, 'tag: ' + e.message); }
  await clean('tag'); save();
}
// ---------------------------------------------------------------- picnic (u-folk4's floor fix, the onlookers)
if (HP && want('picnic')) {
  try {
    await photoOff(); await ev(() => VR.game.env.setTime(5200)); await stand(C0[0] + 6, C0[1], C0[2] - 6); await step(20, 33);
    const m = await beginR(HV.id, 'picnic'); console.log('  · picnic: ' + JSON.stringify(m));
    check(!!m && m.n === 2, 'picnic: two neighbours');
    if (m) {
      let sat = 0; for (let i = 0; i < 40 && sat < 2; i++) { await step(20, 33); sat = await ev(() => window.__M.members.filter(a => a.pose === 'sitground').length); }
      check(sat === 2, `picnic: both on the blanket (${sat})`);
      const st = await ev(() => { const g = VR.game, M = window.__M, Z = VR.Folk5.zone(g.villages), w = g.world, R = VR.R, s = M.spot; const b = w.getBlock(Math.floor(s[0]), Math.floor(s[1]), Math.floor(s[2])); return { lookers: VR.Folk5.lookers(g.villages).length, open: !b || !(R.T.flags[b] & (VR.F.SOLID | VR.F.OPAQUE)), inside: Z ? g.villages.agents.filter(a => a._f4 !== M && Math.hypot(a.pos[0] - Z.c[0], a.pos[2] - Z.c[2]) < Z.R - 0.2 && Math.abs(a.pos[1] - Z.c[1]) < 2.5).length : -1 }; });
      run.picnic = st; console.log('  · picnic ' + JSON.stringify(st));
      check(st.open && st.inside === 0, `picnic: the blanket on open ground, nobody walks over it (${st.inside})`);
      await ev(() => { for (const a of window.__M.members) { a.bubble = null; a.expr = 'joy'; a.exprT = 30; } });
      await photoOn(9200); rows.pic.push(await group(m.spot, 2.4, 'f5_picnic.png')); await photoOff();
    }
  } catch (e) { check(false, 'picnic: ' + e.message); }
  await clean('picnic'); save();
}
// ---------------------------------------------------------------- a friend's big greeting
if (HP && want('friend')) {
  try {
    await photoOff(); await ev(() => VR.game.env.setTime(4500)); await step(10, 33);
    const who = await ev((vid) => {
      const g = VR.game, V = g.villages, v = V.known.get(vid), C = v.plan.plaza;
      const a = v.agents.filter(a => !a.kid && a.pose === 'stand' && !a._f4 && !a._f5 && !(a.act && /^(joy|talk|school)$/.test(a.act.type))).sort((x, y) => Math.hypot(x.pos[0] - C.x, x.pos[2] - C.z) - Math.hypot(y.pos[0] - C.x, y.pos[2] - C.z))[0];
      if (!a) return null;
      window.__cu = a; window.__keep = [a];
      const rec = VR.Folk4.rec(g), pid = (g.dim || 'overworld') + '/' + a.p.id; rec.meet[pid] = [2, (g.env.day || 0) * 24000 + g.env.timeOfDay - 5000];
      a._f5frT = -1e9;
      // the player 4 m before them on the ground
      const p = g.player, fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw);
      p.flying = false; p.noclip = false; p.teleport(a.pos[0] + fx * 4, a.pos[1] + 0.2, a.pos[2] + fz * 4); p.vel[0] = p.vel[1] = p.vel[2] = 0;
      a.act = { type: 'stand', t: 0 }; a.path = null; a.steer = null; a.vel[0] = a.vel[2] = 0; a.greeted = false; a.bubble = null; V._f4words = -1e9;
      VR.Gossip.hello(V, a);
      return { name: a.p.name, said: a.bubble ? a.bubble.text : null, friend: VR.Folk5.friendOf(V, a), d0: +Math.hypot(p.pos[0] - a.pos[0], p.pos[2] - a.pos[2]).toFixed(1) };
    }, HV.id);
    console.log('  · friend: ' + JSON.stringify(who)); run.friend = who;
    check(!!who && who.friend && /Mira/.test(who.said || ''), `friend: the third meeting — a friend's greeting with your name (${who && who.said})`);
    if (who) {
      let st = null;
      for (let i = 0; i < 40; i++) { await step(3, 33); st = await ev(() => { const a = window.__cu, p = VR.game.player.pos; return { ph: a.act && a.act.ph, clip: a.joyClip, d: +Math.hypot(p[0] - a.pos[0], p[2] - a.pos[2]).toFixed(2) }; }); if (st.ph === 'greet') break; }
      run.friendSt = st; console.log('  · friend at greet ' + JSON.stringify(st));
      check(st && st.ph === 'greet' && st.d < who.d0 - 1, `friend: came nearer (${who.d0} → ${st && st.d} m) and greets (${st && st.clip})`);
      await step(8, 33);   // (into the gesture)
      // freeze the gesture for the pictures
      await ev(() => { const a = window.__cu, V = VR.game.villages; if (a.act && a.act.type === 'f5hi') { a.act.t = 0; a.act.t0 = 100; } a.f4sq = V.time + 60; a.expr = 'joy'; a.exprT = 60; V.hearts(a); });
      // (run 1: the portrait framed his back — now the player's own eye 2.5 m before the friend, a little to the side:
      // the friend turns to the player, so to the lens)
      const cam = await ev(() => { const a = window.__cu, p = VR.game.player.pos; let dx = p[0] - a.pos[0], dz = p[2] - a.pos[2]; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d; const c = Math.cos(0.45), s = Math.sin(0.45), rx = dx * c - dz * s, rz = dx * s + dz * c; return { P: [a.pos[0] + rx * 2.5, a.pos[1] + 1.45, a.pos[2] + rz * 2.5], T: [a.pos[0], a.pos[1] + 1.15, a.pos[2]] }; });
      await lookFrom(cam.P, cam.T); await step(6, 33);
      await ev(() => { const a = window.__cu, V = VR.game.villages; if (a.act && a.act.type === 'f5hi') { a.act.t = 0; a.act.t0 = 100; } a.f4sq = V.time + 60; V.hearts(a); });
      rows.friend.push(await snap('f5_friend.png'));
      await ev(() => { const a = window.__cu, V = VR.game.villages; if (a.act && a.act.type === 'f5hi') { a.act.t = 0; a.act.t0 = 100; } a.f4sq = V.time + 60; V.hearts(a); a.bubble = { text: '♥', t: 30, icon: true }; });
      await step(1, 33); rows.friend.push(await grab('f5_friend_side.png'));
      await photoOff();
      await ev(() => { const a = window.__cu; if (a.act && a.act.type === 'f5hi') { a.act = null; a.thinkT = 0; } a.joyClip = null; window.__keep = null; });
    }
  } catch (e) { check(false, 'friend: ' + e.message); }
  await clean('friend'); save();
}
// ---------------------------------------------------------------- the dusk dance with its onlooker ring
if (HP && want('dance')) {
  try {
    await photoOff(); await ev(() => VR.game.env.setTime(11000)); await stand(C0[0] + 5, C0[1], C0[2] + 5); await step(40, 33);
    const m = await beginR(HV.id, 'dance'); console.log('  · dance: ' + JSON.stringify(m));
    check(!!m, 'dance: begun right after the greeting');
    if (m) {
      let D = null;
      for (let i = 0; i < 30; i++) { await step(20, 33); D = await ev(() => { const g = VR.game, V = g.villages, M = window.__M, D = M && M.D, Z = VR.Folk5.zone(V); if (!D) return null; const L = VR.Folk5.lookers(V); const pets = (V.joy && V.joy.pets) || []; return { n: D.members.length, ring: D.members.filter(a => a.dance && a.ringDance).length, c: D.c, r: D.r, R: Z ? Z.R : 0, fid: !!M.fiddler.f4fiddle, lookers: L.length, there: L.filter(a => a.act && a.act.there).length, inside: V.agents.filter(a => a._f4 !== M && Math.hypot(a.pos[0] - D.c[0], a.pos[2] - D.c[2]) < Z.R - 0.2 && Math.abs(a.pos[1] - D.c[1]) < 2.5).length, petsIn: pets.filter(q => Math.hypot(q.pos[0] - D.c[0], q.pos[2] - D.c[2]) < Z.R - 0.2).length, pets: pets.length }; }); if (!D || (D.ring >= D.n && D.fid && D.there >= Math.min(2, D.lookers))) break; }
      run.dance = D; console.log('  · dance ' + JSON.stringify(D));
      check(D && D.ring >= Math.min(3, D.n) && D.fid, `dance: ${D ? D.ring : 0} of ${D ? D.n : 0} in the ring, the fiddler plays`);
      check(D && D.lookers >= 2, `dance: onlookers round it (${D ? D.lookers : 0}, ${D ? D.there : 0} at their spots)`);
      check(D && D.inside === 0 && D.petsIn === 0, `dance: nobody walks through the ring (${D ? D.inside : '-'} people, ${D ? D.petsIn : '-'} of ${D ? D.pets : 0} pets inside)`);
      const j = await ev(() => VR.Folk4.join(VR.game.villages)); check(j, 'dance: V joins');
      await ev(() => VR.game.env.setTime(12150)); await step(120, 33);
      await photoOn(12150);
      if (D) rows.dance.push(await group(D.c, D.R + 2.6, 'f5_dance.png', { keepPlayer: true }));
      await photoOff();
    }
  } catch (e) { check(false, 'dance: ' + e.message); }
  await clean('dance'); save();
}
// ---------------------------------------------------------------- the Laternenzug at dusk
if (HP && want('lantern')) {
  try {
    await photoOff(); await ev(() => { const g = VR.game; g.env.setTime(11950); }); await stand(C0[0] + 5, C0[1], C0[2] - 5); await step(30, 33);
    const m = await beginR(HV.id, 'lantern'); console.log('  · lantern: ' + JSON.stringify(m));
    if (!m) console.log('  · lantern why: ' + JSON.stringify(await ev((vid) => { const g = VR.game, V = g.villages, v = V.known.get(vid), p = g.player.pos; return v.agents.filter(a => a.kid).map(a => [a.act && a.act.type, a.pose, Math.round(Math.hypot(a.pos[0] - p[0], a.pos[2] - p[2])), a.drawn, !!a._f4]); }, HV.id)));
    check(!!m && m.n >= 3, `lantern: ${m ? m.n : 0} children set off with lanterns`);
    if (m) {
      await step(300, 33);
      const st = await ev(() => { const g = VR.game, M = window.__M, L = M.members, Lu = VR.Dusk && VR.Dusk.lure; let gap = 0; for (let i = 1; i < L.length; i++) gap = Math.max(gap, Math.hypot(L[i].pos[0] - L[i - 1].pos[0], L[i].pos[2] - L[i - 1].pos[2])); let cx = 0, cz = 0; for (const k of L) { cx += k.pos[0]; cz += k.pos[2]; } cx /= L.length; cz /= L.length; return { n: L.length, gap: +gap.toFixed(1), c: [cx, L[0].pos[1], cz], spread: Math.max(...L.map(k => Math.hypot(k.pos[0] - cx, k.pos[2] - cz))), lure: Lu ? +Math.hypot(Lu[0] - L[0].pos[0], Lu[2] - L[0].pos[2]).toFixed(1) : null, swarms: VR.Dusk && VR.Dusk.state ? VR.Dusk.state.sw.length : null, notes: VR.Folk5.stats.notes, lit: L.filter(k => k.f5lant).length, wi: M.wi }; });
      run.lantern = st; console.log('  · lantern ' + JSON.stringify(st));
      check(st.gap < 4 && st.wi >= 3, `lantern: a line walking its loop (largest gap ${st.gap} m, waypoint ${st.wi})`);
      check(st.lure !== null && st.lure < 3 && st.notes > 8, `lantern: the Flausellichter follow (${st.lure} m, ${st.swarms} swarms), they sing (${st.notes} notes)`);
      await photoOn(12350);
      rows.lant.push(await group(st.c, Math.max(2.5, st.spread + 1.2), 'f5_lantern.png'));
      await photoOff(); await step(60, 33);
      const st2 = await ev(() => { const M = window.__M, L = M.members; let cx = 0, cz = 0; for (const k of L) { cx += k.pos[0]; cz += k.pos[2]; } return { c: [cx / L.length, L[0].pos[1], cz / L.length] }; });
      await photoOn(12500); rows.lant.push(await group(st2.c, 3.2, 'f5_lantern2.png')); await photoOff();
    }
  } catch (e) { check(false, 'lantern: ' + e.message); }
  await clean('lantern'); save();
}
// ---------------------------------------------------------------- the cost: Very Low / High, the procession running, Folk4+Folk5 on / off (ABBA)
if (HP && want('cost')) {
  try {
    const cost = run.cost = {};
    const preset = (pr) => ev((pr) => { const g = VR.game; g.applyPreset(pr); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); }, pr);
    for (const pr of (process.env.COST ? process.env.COST.split(',') : ['potato', 'high'])) {
      await photoOff(); await preset(pr); await ev(() => VR.game.env.setTime(12200)); await stand(C0[0] + 5, C0[1], C0[2] - 5); await settle(20); await step(30, 33);
      let mm = null; for (const k of ['lantern', 'dance', 'picnic']) { mm = await beginR(HV.id, k); if (mm) { console.log('  · cost with ' + k); break; } }
      await step(90, 33);
      const CP = [C0[0] + 14, C0[1] + 6, C0[2] + 4];
      await lookFrom(CP, C0); await step(10, 33);
      const r = await ev(() => {
        const g = VR.game, F4 = VR.Folk4, F5 = VR.Folk5, gl = g.renderer.gl;
        const set = (m) => { F4.sw.frame = F4.sw.draw = F5.sw.frame = F5.sw.draw = F5.sw.squint = m === 'on'; };
        window.__norender = false;
        set('off'); for (let i = 0; i < 6; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } gl.finish();
        const a = [], b = [];
        for (let blk = 0; blk < 6; blk++) for (const [m, arr] of [['off', a], ['on', b], ['on', b], ['off', a]]) { set(m); for (let i = 0; i < 4; i++) { const t = performance.now(); g.last = t - 33; g.loop(t); gl.finish(); arr.push(performance.now() - t); } }
        window.__norender = true; set('on');
        const med = (q) => { q.sort((x, y) => x - y); return +q[q.length >> 1].toFixed(2); };
        // (run 1: High off 17.5 / on 23.1 ms — the frame's own CPU time measured directly too: Folk4's and Folk5's frame
        // hooks, 2000 calls each)
        const V = g.villages, cpu = (f) => { const t = performance.now(); for (let i = 0; i < 2000; i++) f(); return +((performance.now() - t) / 2000 * 1000).toFixed(2); };
        const f4us = cpu(() => F4.frame(V, 0)), f5us = cpu(() => F5.frame(V, 0));
        return { off: med(a), on: med(b), moment: V._f4M ? V._f4M.kind : null, f4us, f5us };
      });
      cost[pr] = r; console.log(`  · cost ${pr}: off ${r.off} ms | on ${r.on} ms (moment ${r.moment}; frame hooks Folk4 ${r.f4us} µs, Folk5 ${r.f5us} µs; load ${load()}; ${secs()})`);
      if (pr === 'potato') check(r.on <= r.off * 1.1 + 0.5, `Very Low not slower with Folk4+Folk5 (${r.off} → ${r.on} ms)`);
      await clean('cost ' + pr);
    }
  } catch (e) { check(false, 'cost: ' + e.message); }
  save();
}
// ---------------------------------------------------------------- the happy squint on Very Low (the voxel people)
if (HP && want('vlsquint')) {
  try {
    await photoOff();
    await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.settings.renderDist = 6; g.applySettings('*'); g.env.setTime(4500); });
    await stand(C0[0] + 4, C0[1], C0[2] + 4); await step(30, 33);
    const who = await ev(() => { const g = VR.game, V = g.villages, p = g.player.pos; const a = V.agents.filter(a => !a.kid && a.pose === 'stand' && !a._f4).sort((x, y) => Math.hypot(x.pos[0] - p[0], x.pos[2] - p[2]) - Math.hypot(y.pos[0] - p[0], y.pos[2] - p[2]))[0]; if (!a) return null; window.__cu = a; a.act = { type: 'stand', t: 0 }; a.path = null; a.steer = null; a.vel[0] = a.vel[2] = 0; return { smooth: !!(VR.FolkGPU && VR.FolkGPU.on(g)), name: a.p.name }; });
    console.log('  · vl squint ' + JSON.stringify(who));
    if (who) {
      await photoOn(4500);
      const shoot = async (name, sq) => {
        const f = await ev((sq) => { const g = VR.game, V = g.villages, a = window.__cu, f = VR.Folk3.portraitOf(g.photoCam, a, { d: 0.9, dMin: 0.7, keep: true }); if (f) { window.__shotT = f.T; a.lookAt = [f.P[0], f.P[1], f.P[2]]; a.yaw = Math.atan2(-(f.P[0] - a.pos[0]), -(f.P[2] - a.pos[2])); } a.f4sq = sq ? V.time + 60 : 0; a.blinkT = 99; a.blinkOn = false; a.bubble = null; return !!f; }, sq);
        if (!f) return null; await step(2, 33); await ev((sq) => { const a = window.__cu; a.f4sq = sq ? VR.game.villages.time + 60 : 0; a.blinkOn = false; a.blinkT = 99; }, sq); return grab(name);
      };
      rows.vl.push(await shoot('f5_vl_open.png', false));
      rows.vl.push(await shoot('f5_vl_squint.png', true));
      await photoOff();
    }
  } catch (e) { check(false, 'vlsquint: ' + e.message); }
  save();
}
sheet.push({ label: 'Fangen im Hof – direkt danach sauber beendet', imgs: rows.tag });
sheet.push({ label: 'Picknick: niemand läuft über die Decke, Zuschauer am Rand', imgs: rows.pic });
sheet.push({ label: 'Eine Freundin begrüßt Mira: kommt näher, winkt mit beiden Armen, ein Herz', imgs: rows.friend });
sheet.push({ label: 'Tanzkreis in der Dämmerung mit Zuschauerring – Tiere und Passanten bleiben draußen', imgs: rows.dance });
sheet.push({ label: 'Laternenzug: Kinder mit Laternen ziehen singend durchs Dorf, Flausellichter folgen', imgs: rows.lant });
sheet.push({ label: 'Sehr niedrig (Voxel-Leute): Augen offen / fröhliches Blinzeln', imgs: rows.vl });
writeSheet();
const errs = logs.filter(l => /pageerror|folk4|folk5|TypeError|ReferenceError/.test(l));
check(!errs.length, `no page error (${errs.slice(0, 3).join(' | ')})`);
save();
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
