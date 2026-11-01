// u-folk3 in the browser (docs/superpowers/plans/2026-11-01-u-folk3.md): a new Kreativ world (seed 4242), 960 × 540,
// de-DE, Balanced with the smooth people. Every picture is framed by the camera director through the 📷 photo mode
// (VR.Folk3.portraitOf / groupShot — never inside a wall, checked in the page): portraits at the golden hour of a
// Herzwelt person and a native of each of the five worlds, the moods over a day (dawn / noon / dusk), the far face at
// 9 m, a family hand in hand, the children at play, the circle dance on Herzwelt, Aquamarin and Ocker (≥ 5 in the ring);
// Very Low / High cost with Folk3 on and off. → test/shots/f3_*.png, test/shots/folk3_sheet.jpg, .tmp_tests/folk3_run.json
//   nohup bash test/wt_run.sh folk3.mjs 5400 > .tmp_tests/folk3.log 2>&1 &   (ONLY=herz,worlds,cost; WORLDS=aqua,ocker,…)
// regress: skip  (a showcase with pictures; the gates are test/folk3.js and test/folk3_dance.js)
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
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/folk3_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|folkjoy/i.test(s)) logs.push(`[${t}] ${s.slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto(DIST);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } for (let i = 0; i < m; i++) { window.__norender = !(window.__rEvery && (window.__fr = (window.__fr || 0) + 1) % window.__rEvery === 0); if (window.__each) window.__each(g); g.last = performance.now() - d; g.loop(performance.now()); } window.__norender = true; }, [Math.min(10, n - k), dtms]); await wait(3); } };
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
async function trip(to) {
  await ev((to) => VR.Travel.go(VR.game, { dim: to, via: 'cmd' }), to);
  for (let i = 0; i < 600; i++) { await step(10, 33); const s = await ev(() => ({ st: VR.game.state, dim: VR.game.dim, busy: VR.Travel.busy(VR.game) })); if (s.dim === to && s.st === 'play' && !s.busy) return true; await wait(20); }
  return false;
}
// the camera pulled in front of the first wall between the subject and it (run 2: the hand-in-hand shot sat in a wall)
const clearP = (P, T) => ev(([P, T]) => { const w = VR.game.world, d = [P[0] - T[0], P[1] - T[1], P[2] - T[2]], L = Math.hypot(d[0], d[1], d[2]); let k = L; for (let s = 0.5; s < L; s += 0.25) { const x = T[0] + d[0] * s / L, y = T[1] + d[1] * s / L, z = T[2] + d[2] * s / L, b = w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); if (b && (VR.R.T.flags[b] & VR.F.OPAQUE)) { k = Math.max(1.2, s - 0.6); break; } } return [T[0] + d[0] * k / L, T[1] + d[1] * k / L, T[2] + d[2] * k / L]; }, [P, T]);
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
// the village of a site id: { plaza, agents } once active
const villageOf = (vid) => ev((vid) => { const v = VR.game.villages.known.get(vid); if (!v || !v.active) return null; const P = v.plan.plaza; return { plaza: [P.x + 0.5, P.y, P.z + 0.5], agents: v.agents.length, name: v.name || v.plan.name }; }, vid);
// a close-up: the person (picked in the page by `pick`, a function's source) held still, the camera 1.5 m before its face
const closeUp = async (vid, pick, expr, name) => {
  const at = await ev(([vid, pick, expr]) => {
    const g = VR.game, M = g.villages, v = M.known.get(vid); if (!v) return null;
    const a = window.__cu && window.__cu.vil === v ? window.__cu : (window.__cu = (0, eval)('(' + pick + ')')(v)); if (!a) return null;
    a.holdT = 60; a.expr = expr; a.exprT = expr ? 60 : 0; a.bubble = null;
    const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw), hy = a.pos[1] + (a.kid ? 1.0 : 1.62) * (a.h > 1.9 ? a.h / 1.75 : 1);
    return { P: [a.pos[0] + fx * 1.45 + fz * 0.25, hy + 0.05, a.pos[2] + fz * 1.45 - fx * 0.25], T: [a.pos[0], hy - 0.05, a.pos[2]], who: a.p.name + ' (' + a.role + (a.p.look && a.p.look.species ? ', ' + a.p.look.species : '') + ')' };
  }, [vid, pick, expr]);
  if (!at) { check(false, `${name}: a person for the close-up`); return null; }
  await lookFrom(at.P, at.T); await step(6, 33);
  await ev(([P, T]) => { const a = window.__cu; a.lookAt = [P[0], P[1] + 0.1, P[2]]; }, [at.P, at.T]);
  // its smooth mesh made and waited for (the voxel self shows until then)
  const sm = await ev(async () => { const g = VR.game, FG = VR.FolkGPU, a = window.__cu; if (!FG || !FG.on(g)) return 'off'; const rec = a.fg || (a.fg = FG.recFor(a.p.look)); const P0 = FG.PER_FRAME, I0 = FG.INFLIGHT; FG.PER_FRAME = 1e9; FG.INFLIGHT = 1e9; if (rec.state === 0) FG.want(g, rec, 0); g.world.pool.pump(); const t0 = performance.now(); while (rec.state !== 2 && performance.now() - t0 < 90000) { await new Promise(r => setTimeout(r, 250)); g.world.pool.pump(); } FG.PER_FRAME = P0; FG.INFLIGHT = I0; return rec.state; });
  await step(20, 33); await lookFrom(at.P, at.T);
  console.log('  · close-up of ' + at.who + ' (smooth mesh state ' + sm + ', gl lost ' + await ev(() => !!VR.game.glLost) + ')');
  return grab(name);
};
const stats = () => ev(() => { const S = VR.FolkJoy.stats; return { n: S.n, by: Object.assign({}, S.by) }; });
const resetStats = () => ev(() => { const FJ = VR.FolkJoy; FJ.stats = FJ.newStats(); const J = VR.game.villages.joy; if (J) J.stats = FJ.stats; });

const GOLD = 11450;
// the photo mode on, its time held at tick
const photoOn = (tick) => ev((tick) => { const g = VR.game; if (!g.photoCam || !g.photoCam.on) g.photoMode(true); const pc = g.photoCam; pc.first = false; if (tick !== null && tick !== undefined) { pc.held = tick; g.env.setTime(tick); } return !!(pc && pc.on); }, tick);
const photoOff = () => ev(() => { const g = VR.game; if (g.photoCam && g.photoCam.on) g.photoMode(false); });
// is the photo camera in the open, the face in view?
const camCheck = () => ev(() => { const g = VR.game, F3 = VR.Folk3, s = g.photoCam.s, so = F3.solidW(g.world); const f = window.__shotT; return { clear: F3.clearAt(so, s.x, s.y, s.z, 0.35), line: f ? F3.lineFirst(so, f, [s.x, s.y, s.z]) === Infinity : null, d: f ? +Math.hypot(s.x - f[0], s.y - f[1], s.z - f[2]).toFixed(2) : 0 }; });
let walls = 0, shots = 0;
const shoot = async (name, frames = 4) => { await ev(() => { const g = VR.game, s = g.photoCam.s; for (const a of g.villages.agents) if ((a.pos[0] - s.x) ** 2 + (a.pos[2] - s.z) ** 2 < 400) { a.waveT = 0; if (!(a === window.__cu && a.expr === 'wow')) a.stretchT = 0; } });   // (the steps draw nothing, so the greeting's wave never ran out: run 3 had everyone waving)
  const c = await camCheck(); shots++; if (!c.clear || c.line === false) { walls++; console.log(`  !! ${name}: the camera clear ${c.clear}, line ${c.line}`); } const r = await grab(name, frames); return r; };
// a portrait of the person `pick` picks (a function's source) in village vid: held still, smiling, the director's frame
const portrait = async (vid, pick, name, o) => {
  const who = await ev(([vid, pick, o]) => {
    const g = VR.game, v = g.villages.known.get(vid); if (!v) return null;
    const a = (0, eval)('(' + pick + ')')(v); if (!a) return null;
    window.__cu = a; a.holdT = 40; a.bubble = null;
    if (o && o.expr !== undefined) { a.expr = o.expr; a.exprT = o.expr ? 40 : 0; }
    const f = VR.Folk3.portraitOf(g.photoCam, a, o && o.frame);
    if (!f) return { who: a.p.name, f: null };
    // (run 2/3: the people came to greet the player beside the subject and stood in the picture — the player waits 16 m
    // behind the subject, away from the camera; the photo camera is free)
    const p = g.player, bx = a.pos[0] - f.P[0], bz = a.pos[2] - f.P[2], bl = Math.hypot(bx, bz) || 1; p.flying = true; p.teleport(a.pos[0] + bx / bl * 16, a.pos[1] + 6, a.pos[2] + bz / bl * 16); p.vel[0] = p.vel[1] = p.vel[2] = 0;
    for (const o2 of a.vil.agents) if (o2 !== a && Math.hypot(o2.pos[0] - a.pos[0], o2.pos[2] - a.pos[2]) < 2.5 && !o2.kid) { o2.waveT = 0; }
    window.__shotT = f.T; a.lookAt = [f.P[0], f.P[1], f.P[2]];
    return { who: a.p.name + ' (' + a.role + (a.p.look && a.p.look.species ? ', ' + a.p.look.species : '') + ')', d: +f.d.toFixed(2), off: +(f.score || 0).toFixed(2) };
  }, [vid, pick, o || null]);
  if (!who || who.f === null) { check(false, `${name}: a person and a frame (${who ? who.who + ' found, no frame' : 'nobody'})`); return null; }
  // its smooth mesh made and waited for
  await ev(async () => { const g = VR.game, FG = VR.FolkGPU, a = window.__cu; if (!FG || !FG.on(g)) return; const rec = a.fg || (a.fg = FG.recFor(a.p.look)); const P0 = FG.PER_FRAME, I0 = FG.INFLIGHT; FG.PER_FRAME = 1e9; FG.INFLIGHT = 1e9; if (rec.state === 0) FG.want(g, rec, 0); g.world.pool.pump(); const t0 = performance.now(); while (rec.state !== 2 && performance.now() - t0 < 90000) { await new Promise(r => setTimeout(r, 250)); g.world.pool.pump(); } FG.PER_FRAME = P0; FG.INFLIGHT = I0; });
  await step(12, 33);
  await ev(([o]) => { const g = VR.game, a = window.__cu, f = VR.Folk3.portraitOf(g.photoCam, a, o && o.frame); if (f) { window.__shotT = f.T; a.lookAt = [f.P[0], f.P[1], f.P[2]]; } if (o && o.expr !== undefined) { a.expr = o.expr; a.exprT = o.expr ? 40 : 0; } }, [o || null]);
  await step(3, 33);
  console.log(`  · portrait of ${who.who} at ${who.d} m`);
  return shoot(name);
};
const group = async (C, r, name, o) => {
  const f = await ev(([C, r, o]) => { const g = VR.game, f = VR.Folk3.groupShot(g.photoCam, C, r, o || {}); if (f) window.__shotT = f.T; return f ? { d: +f.d.toFixed(1), P: f.P.map(v => +v.toFixed(1)) } : null; }, [C, r, o || null]);
  if (!f) { check(false, `${name}: a frame for the group`); return null; }
  await step(2, 33);
  return shoot(name);
};
// the dance in village vid round the player standing off the plaza's middle: → {n, ring, c, r}
const danceAt = async (vid, plaza, off) => {
  await photoOff();
  await ev(([x, y, z, off]) => { const p = VR.game.player; p.flying = false; p.noclip = false; p.teleport(x + off, y + 1, z + off); p.vel[0] = p.vel[1] = p.vel[2] = 0; }, [plaza[0], plaza[1], plaza[2], off]);
  await step(30, 33);
  const inv = await ev((vid) => { const M = VR.game.villages, v = M.known.get(vid), p = VR.game.player.pos; const a = v.agents.filter(a => !a.kid && a.pose !== 'sleep' && !(a.act && a.act.type === 'joy')).sort((x, y) => ((x.pos[0] - p[0]) ** 2 + (x.pos[2] - p[2]) ** 2) - ((y.pos[0] - p[0]) ** 2 + (y.pos[2] - p[2]) ** 2))[0]; if (!a) return null; M.joyEnd(a); if (a.pose === 'sit') a.pose = 'stand'; M.joyStart(v, 'dance', { _who: { dance: a } }); window.__inv = a; return a.p.name; }, vid);
  let asked = false;
  for (let i = 0; i < 40 && !asked && inv; i++) { await step(20, 33); asked = await ev(() => !!(window.__inv.act && window.__inv.act.wait)); }
  if (asked) await ev(() => VR.game.villages.openTalk(window.__inv));
  let D = null;
  for (let i = 0; i < 30; i++) { await step(20, 33); D = await ev(() => { const D = VR.game.villages.joy && VR.game.villages.joy.dance; return D ? { n: D.n, ring: D.members.filter(a => a.dance && a.ringDance).length, c: D.c, r: D.r || 2.5, ok: !!D.ring } : null; }); if (!D || D.ring >= Math.min(D.n, 6)) break; }
  return { inv, asked, D };
};
const endDance = () => ev(() => { const D = VR.game.villages.joy && VR.game.villages.joy.dance; if (D) D.t = D.len + 1; });
const sheet = [];
const writeSheet = () => { for (const r of sheet) r.imgs = r.imgs.filter(Boolean); for (let i = sheet.length - 1; i >= 0; i--) if (!sheet[i].imgs.length) sheet.splice(i, 1); if (!sheet.length) return; fs.writeFileSync(ROOT + '/.tmp_tests/folk3_sheet.json', JSON.stringify({ w: 620, rows: sheet })); try { console.log('  ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'folk3_sheet.jpg', ROOT + '/.tmp_tests/folk3_sheet.json']).toString().trim()); } catch (e) { console.log('  (no sheet: ' + String(e.message).slice(0, 200) + ')'); } };
const ADULT = `(v) => v.agents.filter(a => !a.kid && !a.elder && a.pose !== 'sleep' && a.pose !== 'sit' && !(a.act && a.act.type === 'joy')).sort((x, y) => Math.hypot(x.pos[0] - v.plan.plaza.x, x.pos[2] - v.plan.plaza.z) - Math.hypot(y.pos[0] - v.plan.plaza.x, y.pos[2] - v.plan.plaza.z))[0] || v.agents.filter(a => !a.kid && a.pose !== 'sleep').sort((x, y) => Math.hypot(x.pos[0] - v.plan.plaza.x, x.pos[2] - v.plan.plaza.z) - Math.hypot(y.pos[0] - v.plan.plaza.x, y.pos[2] - v.plan.plaza.z))[0]`;
const portraits = [], moods = [], farRow = [], famRow = [], danceRow = [];

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.smoothFolk = true; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Bewohner',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world');
await ev(() => { window.__home = VR.game.dim; if (VR.Portal) VR.Portal.GATE_S = 1e9; });
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(3000); if (g.ui && g.ui.show) g.ui.show(null); });
await settle(30);

// ---------------------------------------------------------------- Herzwelt
let HV = null, HP = null;
if (want('herz') || want('cost')) {
  let list = null;
  for (let i = 0; i < 40 && !(list && list.length); i++) { await step(20, 33); list = await ev(() => { const g = VR.game, p = g.player.pos; return g.villages.sites.filter(s => !/^eco:/.test(s.id)).map(s => ({ id: s.id, x: s.x, y: s.y, z: s.z, name: s.name, style: s.style, d: Math.round(Math.hypot(s.x - p[0], s.z - p[2])) })).sort((a, b) => (/^(modern|tech|hall)$/.test(a.style) ? 1 : 0) - (/^(modern|tech|hall)$/.test(b.style) ? 1 : 0) || a.d - b.d).slice(0, 3); }); }
  for (const cand of list || []) {
    HV = cand; HP = null;
    await lookFrom([HV.x + 20, HV.y + 14, HV.z + 20], [HV.x, HV.y, HV.z]);
    await loaded([HV.x, HV.y, HV.z], 48); await settle(60);
    for (let i = 0; i < 40 && !HP; i++) { await step(20, 33); HP = await villageOf(HV.id); }
    const kids = HP ? await ev((vid) => VR.game.villages.known.get(vid).agents.filter(a => a.kid).length, HV.id) : 0;
    console.log(`  · ${HV.name} (${HV.style}, ${HV.d} m): ${HP ? HP.agents : 0} people, ${kids} children`);
    if (HP && kids >= 2) break;
  }
  check(!!HP && HP.agents > 4, `Herzwelt's village ${HV ? HV.name : '-'} lives (${HP ? HP.agents : 0} people)`);
  if (HP) { await ev(() => { window.__rEvery = 10; VR.game.env.setTime(7000); }); await step(240, 33); console.log('  · prewarm ' + JSON.stringify(await prewarm())); }
}
if (want('herz') && HP) {
  try {
    await ev(([x, y, z]) => { const p = VR.game.player; p.teleport(x + 4, y + 2, z + 4); }, HP.plaza);
    await photoOn(GOLD);
    portraits.push(await portrait(HV.id, ADULT, 'f3_herz_portrait.png', { expr: 'joy' }));
    // the moods of the same person: dawn, noon, dusk (the mood's own face — no expression forced)
    for (const [tick, nm] of [[600, 'dawn'], [6000, 'noon'], [GOLD, 'dusk']]) {
      await ev((t) => { const g = VR.game, pc = g.photoCam; pc.held = t; g.env.setTime(t); const a = window.__cu; a.expr = null; a.exprT = 0; a.mood = VR.Folk3.mood(t, a.p.seed); if (a.mood.k === 'cheer') { a.expr = 'joy'; a.exprT = 30; } }, tick);
      await step(4, 33);
      await ev(() => { const g = VR.game, a = window.__cu, f = VR.Folk3.portraitOf(g.photoCam, a, { d: 3, dMin: 2.4 }); if (f) { window.__shotT = f.T; a.lookAt = [f.P[0], f.P[1], f.P[2]]; } a.mood = VR.Folk3.mood(g.env.timeOfDay, a.p.seed); });
      await step(2, 33);
      moods.push(await shoot(`f3_herz_mood_${nm}.png`));
      run['mood_' + nm] = await ev(() => { const a = window.__cu; return a.mood; });
    }
    check(run.mood_dawn && run.mood_dawn.k === 'sleepy' && run.mood_noon.k === 'cheer' && run.mood_dusk.k === 'cosy', `the moods: ${run.mood_dawn && run.mood_dawn.k} / ${run.mood_noon && run.mood_noon.k} / ${run.mood_dusk && run.mood_dusk.k}`);
    // the far face: the same person at 9 m (Folk3 on / off)
    await ev((t) => { const g = VR.game; g.photoCam.held = t; g.env.setTime(t); }, GOLD);
    for (const off of [true, false]) {
      await ev((off) => { VR.Folk3.off = off; const g = VR.game, a = window.__cu; a.expr = null; const f = VR.Folk3.portraitOf(g.photoCam, a, { d: 7, dMin: 6.2, dMax: 8, fov: false }); if (f) window.__shotT = f.T; }, off);
      await step(3, 33);
      farRow.push(await shoot(`f3_herz_far_${off ? 'off' : 'on'}.png`));
    }
    await ev(() => { VR.Folk3.off = false; const a = window.__cu; a.holdT = 0; a.lookAt = null; });
    // a family: a parent and a child hand in hand
    const hand = await ev((vid) => { const M = VR.game.villages, v = M.known.get(vid); let best = null, bd = 1e9; for (const a of v.agents) { if (a.kid || a.pose === 'sleep' || a.pose === 'sit') continue; for (const b of v.agents) if (b.kid && b.p.fam === a.p.fam && b.pose !== 'sleep') { const d = Math.hypot(a.pos[0] - b.pos[0], a.pos[2] - b.pos[2]); if (d < bd) { bd = d; best = [a, b]; } } } if (!best) return null; const [a, k] = best; M.joyEnd(a); M.joyEnd(k); a.act = a.act || { type: 'stroll' }; const ok = M.joyStart(v, 'hand', { _who: { hand: [a, k] } }); window.__hand = [a, k]; return { ok, lead: a.p.name, kid: k.p.name }; }, HV.id);
    let held = 0;
    if (hand) for (let i = 0; i < 30; i++) { await step(20, 33); const h = await ev(() => { const [a, k] = window.__hand; return { k: k.joyHand, a: a.joyHand }; }); if (h.k === 'hold' && h.a === 'lead') held++; if (held >= 3) break; }
    check(!!hand && held >= 2, `a family hand in hand: ${hand ? hand.lead + ' and ' + hand.kid : '-'} (${held} checks holding)`);
    if (hand) { const C = await ev(() => { const [a, k] = window.__hand; a.holdT = 4; k.holdT = 4; a.expr = 'joy'; a.exprT = 5; k.expr = 'joy'; k.exprT = 5; return [(a.pos[0] + k.pos[0]) / 2, a.pos[1], (a.pos[2] + k.pos[2]) / 2]; }); famRow.push(await group(C, 0.9, 'f3_herz_family.png', { pref: await ev(() => { const a = window.__hand[0]; return Math.atan2(-Math.cos(a.yaw), -Math.sin(a.yaw)); }) })); }
    // the children at play: four set to play, two games
    await ev(() => { const g = VR.game; g.photoCam.held = 7000; g.env.setTime(7000); });
    const kids = await ev((vid) => { const M = VR.game.villages, v = M.known.get(vid); const ks = v.agents.filter(a => a.kid && a.pose !== 'sleep').slice(0, 5); for (const k of ks) { M.joyEnd(k); M.setAct(k, { type: 'play' }); } v.game = null; window.__kids = ks; return ks.length; }, HV.id);
    for (const k of [0, 1]) {
      await step(240, 33);
      const G = await ev(() => { const ks = window.__kids, v = ks[0].vil, G = v.game; let x = 0, z = 0, n = 0; for (const a of ks) if (a.act && a.act.type === 'play') { x += a.pos[0]; z += a.pos[2]; n++; } const C = n ? [x / n, ks[0].pos[1], z / n] : null; let r = 0; if (C) for (const a of ks) r = Math.max(r, Math.hypot(a.pos[0] - C[0], a.pos[2] - C[2])); return { type: G && G.type, n, C, r: Math.min(5, r) }; });
      console.log(`  · the children play ${G.type} (${G.n} of ${kids})`);
      run['play' + k] = G;
      if (G.C) famRow.push(await group(G.C, Math.max(1.2, G.r), `f3_herz_play_${G.type || k}.png`));
      await ev(() => { const v = window.__kids[0].vil; if (v.game) v.game.until = 0; });
    }
    check(!!(run.play0 && run.play0.n >= 2), `the children at play: ${run.play0 && run.play0.type}, ${run.play1 && run.play1.type}`);
    // the circle dance
    await ev(() => { const g = VR.game; g.env.setTime(9800); });
    const dz = await danceAt(HV.id, HP.plaza, 3);
    const D = dz.D;
    run.herzDance = D;
    check(dz.asked && !!D && D.ring >= Math.min(5, D.n), `Herzwelt: the circle dance — ${dz.inv} asks, ${D ? D.ring + ' of ' + D.n + ' in the ring (r ' + (+D.r).toFixed(2) + ')' : 'no dance'}`);
    if (D) { await photoOn(GOLD); await step(30, 33); danceRow.push(await group([D.c[0], D.c[1], D.c[2]], D.r + 0.4, 'f3_herz_dance.png')); }
    await endDance(); await photoOff(); await step(20, 33);
  } catch (e) { check(false, 'Herzwelt: ' + String(e && e.stack || e).slice(0, 500)); }
  save();
}

// ---------------------------------------------------------------- the five worlds: a native's portrait, the dance on two
const WORLDS = process.env.WORLDS ? process.env.WORLDS.split(',') : ['aqua', 'ocker', 'zinn', 'basalt', 'opal'];
for (const kind of (want('worlds') ? WORLDS : [])) {
  try {
    console.log('== ' + kind + ' (' + secs() + ', load ' + fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0] + ')');
    await photoOff();
    const ok = await trip(kind).catch(() => false);
    check(ok, `the jump to ${kind}`);
    if (!ok) continue;
    await ev(() => { const g = VR.game; if (g.ui && g.ui.show) g.ui.show(null); g.env.setTime(4000); window.__rEvery = 20; if (g.settings.renderDist !== 4) { g.settings.renderDist = 4; g.applySettings('*'); } });   // (run 2: Aquamarin's settling took over 18 min under load — a shorter view)
    await settle(15);
    const vid = 'eco:' + kind + ':0';
    let Vt = null;
    for (let i = 0; i < 30 && !Vt; i++) { await step(20, 33); Vt = await ev((vid) => { const s = VR.game.villages.sites.find(q => q.id === vid); return s ? { x: s.x, y: s.y, z: s.z, name: s.name } : null; }, vid); }
    if (!Vt) { check(false, `${kind}: the town`); continue; }
    await lookFrom([Vt.x + 18, Vt.y + 12, Vt.z + 18], [Vt.x, Vt.y, Vt.z]);
    await loaded([Vt.x, Vt.y, Vt.z], 24); await settle(25);
    let P = null; for (let i = 0; i < 40 && !P; i++) { await step(20, 33); P = await villageOf(vid); }
    if (!P) { check(false, `${kind}: the town lives`); continue; }
    await step(120, 33);
    await ev(([x, y, z]) => { const p = VR.game.player; p.teleport(x + 5, y + 2, z + 5); }, P.plaza);
    console.log('  · prewarm ' + JSON.stringify(await prewarm()));
    await photoOn(GOLD);
    portraits.push(await portrait(vid, ADULT, `f3_${kind}_portrait.png`, { expr: 'joy' }));
    await ev(() => { const a = window.__cu; if (a) { a.holdT = 0; a.expr = null; a.lookAt = null; } window.__cu = null; });
    if (kind === 'aqua' || kind === 'ocker') {
      await ev(() => VR.game.env.setTime(9800));
      const dz = await danceAt(vid, P.plaza, 3.5);
      const D = dz.D; run[kind + 'Dance'] = D;
      check(dz.asked && !!D && D.ring >= Math.min(5, D.n), `${kind}: the natives' circle dance — ${D ? D.ring + ' of ' + D.n + ' in the ring' + (D.ok ? '' : ' (no open ring)') : 'no dance'}`);
      if (D) { await photoOn(GOLD); await step(30, 33); danceRow.push(await group([D.c[0], D.c[1], D.c[2]], D.r + 0.4, `f3_${kind}_dance.png`)); }
      await endDance(); await photoOff(); await step(20, 33);
    }
  } catch (e) { check(false, kind + ': ' + String(e && e.stack || e).slice(0, 500)); }
  save();
}
await photoOff();
const rows = () => { sheet.length = 0; const pr = portraits.filter(Boolean); if (pr.length) sheet.push({ label: 'portraits at the golden hour (the camera director): Herzwelt, Aquamarin, Ocker', imgs: pr.slice(0, 3) }); if (pr.length > 3) sheet.push({ label: 'portraits: Zinnober, Basalt, Opal', imgs: pr.slice(3) }); sheet.push({ label: 'the moods of one person: sleepy at dawn / cheerful at noon / cosy at dusk', imgs: moods }); sheet.push({ label: 'the far face at 9 m: off / on', imgs: farRow }); sheet.push({ label: 'a family hand in hand / the children at play', imgs: famRow }); sheet.push({ label: 'the circle dance: Herzwelt / Aquamarin / Ocker', imgs: danceRow }); };
rows(); writeSheet();
check(walls === 0, `the camera never inside a wall (${walls} of ${shots} shots)`);

// ---------------------------------------------------------------- the cost: Very Low / High, Folk3 on and off
if (want('cost') && HP) {
  try {
    const home = await ev(() => window.__home); if (await ev(() => VR.game.dim) !== home && !(await trip(home).catch(() => false))) throw new Error('no way back to Herzwelt');
    await lookFrom([HP.plaza[0] + 14, HP.plaza[1] + 6, HP.plaza[2] + 14], HP.plaza); await loaded(HP.plaza, 48); await settle(40);
    const cost = {};
    const measure0 = () => ev(() => { const g = VR.game; window.__norender = false; for (let i = 0; i < 8; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); const ms = []; for (let k = 0; k < 3; k++) for (let i = 0; i < 16; i++) { const t = performance.now(); g.last = t - 33; g.loop(t); g.renderer.gl.finish(); ms.push(performance.now() - t); } window.__norender = true; ms.sort((a, b) => a - b); return { ms: +ms[ms.length >> 1].toFixed(2) }; });
    const measure = async (name) => { const r1 = await measure0(); await step(20, 33); const r2 = await measure0(); const r = r2.ms < r1.ms ? r2 : r1; r.runs = [r1.ms, r2.ms]; cost[name] = r; console.log(`  · ${name}: ${JSON.stringify(r)} (${secs()}, load ${fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0]})`); return r; };
    const preset = (pr) => ev((pr) => { const g = VR.game; g.applyPreset(pr); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); }, pr);
    await ev(() => VR.game.env.setTime(4000));
    const V0 = [HP.plaza[0], HP.plaza[1], HP.plaza[2]], CP = [V0[0] + 8, V0[1] + 3, V0[2] + 8];
    for (const pr of ['potato', 'high']) {
      await preset(pr); await settle(20); await step(60, 33);
      for (const off of [true, false, true, false]) {
        await ev((off) => { VR.Folk3.off = off; }, off);
        await lookFrom(CP, V0); await step(10, 33);
        await measure(`${pr}_${off ? 'off' : 'on'}${cost[pr + '_' + (off ? 'off' : 'on')] ? '2' : ''}`);
      }
    }
    await ev(() => { VR.Folk3.off = false; });
    const best = (k) => Math.min(cost[k] ? cost[k].ms : 999, cost[k + '2'] ? cost[k + '2'].ms : 999);
    run.cost = cost;
    console.log(`  cost Very Low off ${best('potato_off')} / on ${best('potato_on')} ms · High off ${best('high_off')} / on ${best('high_on')} ms`);
    check(best('potato_on') <= best('potato_off') * 1.1 + 0.5, `Very Low not slower with Folk3 (${best('potato_off')} → ${best('potato_on')} ms)`);
  } catch (e) { check(false, 'cost: ' + String(e && e.stack || e).slice(0, 500)); }
  save();
}

const errs = logs.filter(l => /pageerror|folkjoy|folk3|TypeError|ReferenceError/.test(l));
for (const l of logs.slice(0, 12)) console.log('  log ' + l);
check(errs.length === 0, `no page error (${errs.length})`);
run.logs = logs.slice(0, 40); save();
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
