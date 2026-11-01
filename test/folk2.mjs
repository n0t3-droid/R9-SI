// u-folk2 in the browser (docs/superpowers/plans/2026-10-31-u-folk2.md): a new Kreativ world (seed 4242), 960 × 540,
// de-DE, Balanced with the smooth people (High for its cost). Herzwelt's nearest village: a close-up resting and in joy, a parent and a child hand
// in hand, applause for a build, the grandparent's story by the fire at dusk, the dance round the player, a pet; a 60-s
// walk round the plaza (W held, two jumps, a fall, four blocks built, two pauses; offers and invitations taken with
// [use]) counting the moments (≥ 4 distinct); the cost Very Low / High with the moments on and off (FolkJoy.off);
// then Aquamarin and Ocker: a native close-up in joy and a group.
// → test/shots/f2_*.png, test/shots/folk2_sheet.jpg, .tmp_tests/folk2_run.json
//   nohup bash test/wt_run.sh folk2.mjs 3600 > .tmp_tests/folk2.log 2>&1 &   (ONLY=herz,walk,cost,worlds)
// regress: skip  (a showcase with pictures; the gate is test/folk2.js)
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
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/folk2_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
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
const sheet = [];
const writeSheet = () => { for (const r of sheet) r.imgs = r.imgs.filter(Boolean); for (let i = sheet.length - 1; i >= 0; i--) if (!sheet[i].imgs.length) sheet.splice(i, 1); if (!sheet.length) return; fs.writeFileSync(ROOT + '/.tmp_tests/folk2_sheet.json', JSON.stringify({ w: 620, rows: sheet })); try { console.log('  ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'folk2_sheet.jpg', ROOT + '/.tmp_tests/folk2_sheet.json']).toString().trim()); } catch (e) { console.log('  (no sheet: ' + String(e.message).slice(0, 200) + ')'); } };
const stats = () => ev(() => { const S = VR.FolkJoy.stats; return { n: S.n, by: Object.assign({}, S.by) }; });
const resetStats = () => ev(() => { const FJ = VR.FolkJoy; FJ.stats = FJ.newStats(); const J = VR.game.villages.joy; if (J) J.stats = FJ.stats; });
const ADULT = `(v) => v.agents.filter(a => !a.kid && !a.elder && a.pose !== 'sleep' && a.pose !== 'sit').sort((x, y) => Math.hypot(x.pos[0] - v.plan.plaza.x, x.pos[2] - v.plan.plaza.z) - Math.hypot(y.pos[0] - v.plan.plaza.x, y.pos[2] - v.plan.plaza.z))[0]`;
const KID = `(v) => v.agents.filter(a => a.kid && a.pose !== 'sleep').sort((x, y) => Math.hypot(x.pos[0] - v.plan.plaza.x, x.pos[2] - v.plan.plaza.z) - Math.hypot(y.pos[0] - v.plan.plaza.x, y.pos[2] - v.plan.plaza.z))[0]`;

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.smoothFolk = true; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Bewohner',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world');
await ev(() => { window.__home = VR.game.dim; if (VR.Portal) VR.Portal.GATE_S = 1e9; });   // (run 2: the plaza's gate opened its picker under the walk — the game stood still)
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(3000); if (g.ui && g.ui.show) g.ui.show(null); });
await settle(30);

// ---------------------------------------------------------------- Herzwelt's nearest village
let HV = null, HP = null;
if (want('herz') || want('hand') || want('walk') || want('cost')) {
  // (the towns that budget their people let the children go first: a village WITH children is looked for — the classic
  // styles first, nearest first, up to three tried)
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
  check(!!HV, `Herzwelt's village ${HV ? HV.name + ' (' + HV.d + ' m)' : '-'}`);
  if (HV) {
    check(!!HP && HP.agents > 4, `${HV.name} lives (${HP ? HP.agents : 0} people about)`);
    await ev(() => { window.__rEvery = 10; VR.game.env.setTime(7000); });   // (the afternoon: the children out of school)   // (from here 1 frame in 10 drawn: the people's moments need them seen)
    await step(240, 33);   // the morning's walk out
    console.log('  · prewarm ' + JSON.stringify(await prewarm()));
  }
}
const herzRows = [];
if ((want('herz') || want('hand')) && HP) {
  if (want('herz')) try {
    const before = ['folk_sheet_faces.png', 'folk_sheet_expr.png'].map(n => fs.existsSync(SHOTS + 'folk2_before/' + n) ? SHOTS + 'folk2_before/' + n : null);
    if (before[0] && fs.existsSync(SHOTS + 'folk_sheet_faces.png')) sheet.push({ label: 'faces before / after (node sheet, the smooth path)', imgs: [before[0], SHOTS + 'folk_sheet_faces.png'] });
    if (fs.existsSync(SHOTS + 'folk_sheet_expr.png')) sheet.push({ label: 'expressions: resting / joy / surprise (node sheet)', imgs: [SHOTS + 'folk_sheet_expr.png'] });
    const c1 = await closeUp(HV.id, ADULT, null, 'f2_herz_close_rest.png');
    const c2 = await closeUp(HV.id, ADULT, 'joy', 'f2_herz_close_joy.png');
    await ev(() => { const a = window.__cu; if (a) { a.holdT = 0; a.expr = null; a.lookAt = null; } window.__cu = null; });
    const c3 = await closeUp(HV.id, KID, 'wow', 'f2_herz_close_kid.png');
    await ev(() => { const a = window.__cu; if (a) { a.holdT = 0; a.expr = null; a.lookAt = null; } window.__cu = null; });
    sheet.push({ label: 'Herzwelt close-up: resting / joy / a child in surprise', imgs: [c1, c2, c3].filter(Boolean) });
  } catch (e) { check(false, 'Herzwelt close-ups: ' + String(e && e.stack || e).slice(0, 300)); }
  try {
    // hand in hand: a family's adult and child
    const hand = await ev((vid) => { const M = VR.game.villages, v = M.known.get(vid); let best = null, bd = 1e9; for (const a of v.agents) { if (a.kid || a.pose === 'sleep' || a.pose === 'sit') continue; for (const b of v.agents) if (b.kid && b.p.fam === a.p.fam && b.pose !== 'sleep') { const d = Math.hypot(a.pos[0] - b.pos[0], a.pos[2] - b.pos[2]); if (d < bd) { bd = d; best = [a, b]; } } } for (const [a, k] of best ? [best] : []) { if (k) { M.joyEnd && M.joyEnd(a); M.joyEnd(k); a.act = a.act || { type: 'stroll' }; const ok = M.joyStart(v, 'hand', { _who: { hand: [a, k] } }); window.__hand = [a, k]; return { ok, lead: a.p.name, kid: k.p.name }; } } return null; }, HV.id);
    if (!hand) throw new Error('no family with a child about');
    let held = 0;
    for (let i = 0; i < 30; i++) { await step(20, 33); const h = await ev(() => { const [a, k] = window.__hand; return { k: k.joyHand, a: a.joyHand, d: Math.hypot(a.pos[0] - k.pos[0], a.pos[2] - k.pos[2]) }; }); if (h.k === 'hold' && h.a === 'lead') held++; if (held >= 4) break; }
    check(!!hand && held >= 2, `hand in hand: ${hand ? hand.lead + ' and ' + hand.kid : '-'} (${held} checks holding)`);
    const hv = await ev(() => { const [a] = window.__hand; const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw), rx = Math.cos(a.yaw), rz = -Math.sin(a.yaw); return { P: [a.pos[0] + fx * 4.2 + rx * 1.6, a.pos[1] + 1.7, a.pos[2] + fz * 4.2 + rz * 1.6], T: [a.pos[0] + rx * 0.3, a.pos[1] + 0.9, a.pos[2] + rz * 0.3] }; });
    await ev(() => { for (const a of window.__hand) a.holdT = 3; });
    await lookFrom(await clearP(hv.P, hv.T), hv.T); await step(4, 33);
    herzRows.push(await grab('f2_herz_hand.png'));
    // applause: four blocks placed before five people
    await ev(([x, y, z]) => { const p = VR.game.player; p.flying = false; p.noclip = false; p.teleport(x + 3, y + 1, z + 3); }, HP.plaza);
    await step(30, 33);
    const ap = await ev(() => { const g = VR.game, M = g.villages, p = g.player.pos, w = g.world, s = VR.R.byName.stone ? VR.R.byName.stone.id : 1; let n = 0; const near = M.agents.filter(a => (a.pos[0] - p[0]) ** 2 + (a.pos[2] - p[2]) ** 2 < 14 * 14).length; for (let k = 0; k < 4; k++) { const x = Math.floor(p[0]) + 2 + k, z = Math.floor(p[2]) + 2, y = Math.floor(p[1]); if (!w.getBlock(x, y, z)) { w.setBlock(x, y, z, s); n++; } } return { n, near }; });
    await step(12, 33);
    const apS = await stats();
    check((apS.by.applaud || 0) >= 1 || ap.near === 0, `applause for four blocks (${ap.n} placed, ${ap.near} people within 14 m, ${apS.by.applaud || 0} applause)`);
    const cl = await ev(() => { const M = VR.game.villages, p = VR.game.player.pos; const a = M.agents.filter(a => a.joyClip === 'clap').sort((x, y) => ((x.pos[0] - p[0]) ** 2 + (x.pos[2] - p[2]) ** 2) - ((y.pos[0] - p[0]) ** 2 + (y.pos[2] - p[2]) ** 2))[0]; return a ? [a.pos[0], a.pos[1] + 1.2, a.pos[2]] : null; });
    if (cl) { const pp = await ev(() => VR.game.player.pos.slice()); await lookFrom([pp[0], pp[1] + 1.62, pp[2]], cl); }
    herzRows.push(await grab('f2_herz_applause.png'));
    sheet.push({ label: 'Herzwelt: hand in hand / applause for a build', imgs: herzRows.splice(0) });
  } catch (e) { check(false, 'Herzwelt hand/applause: ' + String(e && e.stack || e).slice(0, 300)); if (herzRows.length) sheet.push({ label: 'Herzwelt: hand in hand / applause', imgs: herzRows.splice(0).filter(Boolean) }); }
  if (want('herz')) try {
    // the story at dusk
    await ev(() => VR.game.env.setTime(11200));
    const st = await ev((vid) => { const M = VR.game.villages, v = M.known.get(vid); const el = v.agents.find(a => a.elder && a.pose !== 'sleep') || v.agents.find(a => !a.kid); const kids = v.agents.filter(a => a.kid && a.pose !== 'sleep').slice(0, 4); for (const a of [el].concat(kids)) { M.joyEnd(a); a.pose = a.pose === 'sit' || a.pose === 'sitground' ? 'stand' : a.pose; } const ok = M.joyStart(v, 'story', { _who: { story: [el, kids] } }); window.__story = el; return { ok, el: el.p.name, kids: kids.length }; }, HV.id);
    let seated = 0;
    for (let i = 0; i < 40; i++) { await step(20, 33); seated = await ev(() => { const S = window.__story.act && window.__story.act.S; return S ? (window.__story.pose === 'sitground' ? 1 : 0) + S.kids.filter(k => k.pose === 'sitground').length : -1; }); if (seated >= 3) break; }
    check(st && st.ok && seated >= 3, `the story by the fire: ${st ? st.el : '-'} and ${st ? st.kids : 0} children (${seated} seated)`);
    const sv = await ev(() => { const S = window.__story.act.S, f = S.fire, yaw = S.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw); return { P: [f[0] + rx * 4.2 + fx * 1.0, f[1] + 2.1, f[2] + rz * 4.2 + fz * 1.0], T: [f[0], f[1] + 0.5, f[2]] }; });
    await lookFrom(sv.P, sv.T); await step(40, 33); await lookFrom(sv.P, sv.T);
    herzRows.push(await grab('f2_herz_story.png'));
    // the dance: an invitation, taken with [use]
    await ev(() => VR.game.env.setTime(9600));
    await ev(([x, y, z]) => { const p = VR.game.player; p.flying = false; p.noclip = false; p.teleport(x - 2, y + 1, z - 2); }, HP.plaza);
    await step(20, 33);
    const inv = await ev((vid) => { const M = VR.game.villages, v = M.known.get(vid), p = VR.game.player.pos; const a = v.agents.filter(a => !a.kid && a.pose !== 'sleep' && !(a.act && a.act.type === 'joy')).sort((x, y) => ((x.pos[0] - p[0]) ** 2 + (x.pos[2] - p[2]) ** 2) - ((y.pos[0] - p[0]) ** 2 + (y.pos[2] - p[2]) ** 2))[0]; if (!a) return null; M.joyEnd(a); if (a.pose === 'sit') a.pose = 'stand'; M.joyStart(v, 'dance', { _who: { dance: a } }); window.__inv = a; return a.p.name; }, HV.id);
    let asked = false;
    for (let i = 0; i < 30 && !asked; i++) { await step(20, 33); asked = await ev(() => !!(window.__inv.act && window.__inv.act.wait)); }
    const bub = await ev(() => window.__inv.bubble && window.__inv.bubble.text);
    await ev(() => VR.game.villages.openTalk(window.__inv));
    await step(150, 33);
    const D = await ev(() => { const D = VR.game.villages.joy.dance; return D ? { n: D.n, c: D.c, dancing: D.members.filter(a => a.dance).length } : null; });
    check(asked && !!D && D.dancing >= 3, `the dance: ${inv} asks „${bub}", [use] → ${D ? D.n : 0} in the ring, ${D ? D.dancing : 0} dancing`);
    if (D) { await lookFrom([D.c[0] + 5.5, D.c[1] + 3.2, D.c[2] + 5.5], [D.c[0], D.c[1] + 0.9, D.c[2]]); await step(4, 33); herzRows.push(await grab('f2_herz_dance.png')); }
    sheet.push({ label: 'Herzwelt: the grandparent\'s story by the fire at dusk / the dance round the player', imgs: herzRows.splice(0) });
  } catch (e) { check(false, 'Herzwelt story/dance: ' + String(e && e.stack || e).slice(0, 300)); if (herzRows.length) sheet.push({ label: 'Herzwelt: story / dance', imgs: herzRows.splice(0).filter(Boolean) }); }
  if (want('herz')) try {
    await ev(() => { const D = VR.game.villages.joy && VR.game.villages.joy.dance; if (D) D.t = D.len + 1; }); await step(20, 33);   // the dance ends (its 30 s cut short)
    // a pet
    await ev(() => VR.game.env.setTime(3600));
    const pet = await ev(() => { const J = VR.game.villages.joy; const q = J && J.pets[0]; return q ? { kind: q.kind, pos: q.pos.slice(), owner: q.owner.p.name, n: J.pets.length } : null; });
    check(!!pet, `village pets: ${pet ? pet.n + ' (' + pet.kind + ' with ' + pet.owner + ')' : 'none'}`);
    if (pet) {
      for (let k = 0; k < 2; k++) { const q = await ev(() => VR.game.villages.joy.pets[0].pos.slice()); await lookFrom([q[0] + 2.6, q[1] + 1.5, q[2] + 2.6], [q[0], q[1] + 0.4, q[2]]); await step(30, 33); }
      const q = await ev(() => { const J = VR.game.villages.joy; return [J.pets[0].pos.slice(), J.pets[0].owner.pos.slice()]; });
      await lookFrom([q[0][0] + 3.2, q[0][1] + 1.7, q[0][2] + 3.2], [(q[0][0] + q[1][0]) / 2, q[0][1] + 0.6, (q[0][2] + q[1][2]) / 2]);
      herzRows.push(await grab('f2_herz_pet.png'));
      check(await ev(() => VR.game.villages.joy.petsDrawn || 0) >= 1, 'the pet drawn');
    }
  } catch (e) { check(false, 'Herzwelt: ' + String(e && e.stack || e).slice(0, 500)); }
  console.log('  · gl lost after Herzwelt: ' + await ev(() => !!VR.game.glLost));
  save(); writeSheet();
}

// ---------------------------------------------------------------- the 60-s walk round the plaza
if (want('walk') && HP) {
  try {
    await ev(() => VR.game.env.setTime(7200));
    console.log('  · gl lost before the walk: ' + await ev(() => !!VR.game.glLost));
    await ev(([x, y, z]) => { const p = VR.game.player; p.flying = false; p.noclip = false; p.teleport(x + 7, y + 1.2, z); }, HP.plaza);
    await step(40, 33); await resetStats();
    // W held toward a point 2 m ahead on the circle round the plaza; at 12 s and 33 s a jump, at 20 s and 44 s a pause of
    // 4 s; at 27 s four blocks; at 50 s a fall of 6 blocks; an offer or an invitation that waits is taken with [use]
    const shotsAt = [];
    let last = 0;
    for (let s = 0; s < 60; s += 1) {
      const r = await ev(([s, C]) => {
        const g = VR.game, p = g.player, M = g.villages, inp = g.input, out = { use: [] };
        for (let i = 0; i < 30; i++) {
          const t = s + i / 30;
          const pause = (t >= 20 && t < 24) || (t >= 44 && t < 48);
          const an = Math.atan2(p.pos[2] - C[2], p.pos[0] - C[0]) + 0.28, tx = C[0] + Math.cos(an) * 7, tz = C[2] + Math.sin(an) * 7;
          p.yaw = Math.atan2(-(tx - p.pos[0]), -(tz - p.pos[2])); p.viewYaw = p.yaw; p.pitch = -0.08;
          if (pause) inp.keys.delete('KeyW'); else inp.keys.add('KeyW');
          if ((t >= 12 && t < 12.1) || (t >= 33 && t < 33.1)) inp.keys.add('Space'); else inp.keys.delete('Space');
          if (t >= 27 && t < 27.04) { const w = g.world, st = VR.R.byName.stone ? VR.R.byName.stone.id : 1; for (let k = 0; k < 4; k++) { const x = Math.floor(p.pos[0]) + 2, y = Math.floor(p.pos[1]) + k, z = Math.floor(p.pos[2]) + 2; if (!w.getBlock(x, y, z)) w.setBlock(x, y, z, st); } }
          if (t >= 50 && t < 50.04) p.teleport(p.pos[0], p.pos[1] + 6.5, p.pos[2]);
          for (const a of M.agents) if (a.act && a.act.type === 'joy' && a.act.wait && !a.act.done && (a.pos[0] - p.pos[0]) ** 2 + (a.pos[2] - p.pos[2]) ** 2 < 9) { out.use.push(a.act.kind); M.openTalk(a); }
          window.__norender = (i % 8) !== 0;
          g.last = performance.now() - 33; g.loop(performance.now());
        }
        window.__norender = true; inp.keys.delete('KeyW'); inp.keys.delete('Space');
        const S = VR.FolkJoy.stats; out.n = S.n; out.by = Object.assign({}, S.by); out.pos = p.pos.map(v => +v.toFixed(1));
        return out;
      }, [s, HP.plaza]);
      if (r.use.length) console.log(`  · ${s} s: [use] → ${r.use.join(', ')}`);
      if (r.n > last && shotsAt.length < 3 && (shotsAt.length === 0 || s - shotsAt[shotsAt.length - 1] > 8)) { shotsAt.push(s); const nm = await grab(`f2_walk_${shotsAt.length}.png`, 2); herzRows.push(nm); }
      last = r.n;
      if (s % 10 === 9) console.log(`  · walk ${s + 1} s: ${r.n} moments ${JSON.stringify(r.by)} at ${r.pos.join(', ')}`);
    }
    const S = await stats(); run.walk = S;
    const kinds = Object.keys(S.by).filter(k => k !== 'copy');
    check(kinds.length >= 4, `the 60-s walk: ${S.n} moments, ${kinds.length} distinct warm ones (${JSON.stringify(S.by)})`);
    sheet.push({ label: `the 60-s walk round the plaza: ${S.n} moments, ${kinds.length} kinds`, imgs: herzRows.splice(0) });
  } catch (e) { check(false, 'the walk: ' + String(e && e.stack || e).slice(0, 500)); }
  save(); writeSheet();
}

// ---------------------------------------------------------------- two other worlds: Aquamarin and Ocker
for (const kind of (want('worlds') ? ['aqua', 'ocker'] : [])) {
  try {
    console.log('== ' + kind);
    const ok = await trip(kind).catch(() => false);
    check(ok, `the jump to ${kind}`);
    if (!ok) continue;
    await ev(() => { const g = VR.game; if (g.ui && g.ui.show) g.ui.show(null); g.env.setTime(3600); });
    await settle(40);
    const vid = 'eco:' + kind + ':0';
    let V = null;
    for (let i = 0; i < 30 && !V; i++) { await step(20, 33); V = await ev((vid) => { const s = VR.game.villages.sites.find(q => q.id === vid); return s ? { x: s.x, y: s.y, z: s.z, name: s.name } : null; }, vid); }
    if (!V) { check(false, `${kind}: the town`); continue; }
    await lookFrom([V.x + 18, V.y + 12, V.z + 18], [V.x, V.y, V.z]);
    await loaded([V.x, V.y, V.z], 40); await settle(60);
    let P = null; for (let i = 0; i < 40 && !P; i++) { await step(20, 33); P = await villageOf(vid); }
    if (!P) { check(false, `${kind}: the town lives`); continue; }
    await step(200, 33);
    await ev(([x, y, z]) => { const p = VR.game.player; p.teleport(x + 4, y + 2, z + 4); }, P.plaza);
    console.log('  · prewarm ' + JSON.stringify(await prewarm()));
    const row = [];
    row.push(await closeUp(vid, ADULT, 'joy', `f2_${kind}_close.png`));
    await ev(() => { const a = window.__cu; if (a) { a.holdT = 0; a.expr = null; a.lookAt = null; } window.__cu = null; });
    // a group: the dance round the player on the plaza (an invitation taken at once)
    await ev(([x, y, z]) => { const p = VR.game.player; p.flying = false; p.noclip = false; p.teleport(x - 3, y + 1.5, z - 3); }, P.plaza);
    await step(20, 33);
    const inv = await ev((vid) => { const M = VR.game.villages, v = M.known.get(vid), p = VR.game.player.pos; const a = v.agents.filter(a => !a.kid && a.pose !== 'sleep' && !(a.act && a.act.type === 'joy')).sort((x, y) => ((x.pos[0] - p[0]) ** 2 + (x.pos[2] - p[2]) ** 2) - ((y.pos[0] - p[0]) ** 2 + (y.pos[2] - p[2]) ** 2))[0]; if (!a) return null; M.joyEnd(a); if (a.pose === 'sit') a.pose = 'stand'; M.joyStart(v, 'dance', { _who: { dance: a } }); window.__inv = a; return a.p.name; }, vid);
    let asked = false;
    for (let i = 0; i < 30 && !asked && inv; i++) { await step(20, 33); asked = await ev(() => !!(window.__inv.act && window.__inv.act.wait)); }
    if (asked) await ev(() => VR.game.villages.openTalk(window.__inv));
    await step(150, 33);
    const D = await ev(() => { const D = VR.game.villages.joy && VR.game.villages.joy.dance; return D ? { n: D.n, c: D.c, dancing: D.members.filter(a => a.dance).length } : null; });
    check(!!D && D.dancing >= 2, `${kind}: the natives dance round the player (${D ? D.dancing + ' of ' + D.n : 'no dance'})`);
    if (D) { await lookFrom([D.c[0] + 5.5, D.c[1] + 3.2, D.c[2] + 5.5], [D.c[0], D.c[1] + 0.9, D.c[2]]); await step(4, 33); row.push(await grab(`f2_${kind}_dance.png`)); }
    sheet.push({ label: `${kind}: a native in joy / dancing round the player`, imgs: row.filter(Boolean) });
    await ev(() => { const D = VR.game.villages.joy && VR.game.villages.joy.dance; if (D) D.t = D.len + 1; }); await step(20, 33);
  } catch (e) { check(false, kind + ': ' + String(e && e.stack || e).slice(0, 500)); }
  save(); writeSheet();
}

// ---------------------------------------------------------------- the cost: Very Low / High, the moments on and off
if (want('cost') && HP) {
  try {
    const home = await ev(() => window.__home); if (await ev(() => VR.game.dim) !== home && !(await trip(home).catch(() => false))) throw new Error('no way back to Herzwelt');
    await lookFrom([HP.plaza[0] + 14, HP.plaza[1] + 6, HP.plaza[2] + 14], HP.plaza); await loaded(HP.plaza, 48); await settle(40);
    const cost = {};
    const measure0 = () => ev(() => { const g = VR.game; window.__norender = false; for (let i = 0; i < 8; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); const ms = []; for (let k = 0; k < 3; k++) for (let i = 0; i < 16; i++) { const t = performance.now(); g.last = t - 33; g.loop(t); g.renderer.gl.finish(); ms.push(performance.now() - t); } window.__norender = true; ms.sort((a, b) => a - b); return { ms: +ms[ms.length >> 1].toFixed(2), p25: +ms[ms.length >> 2].toFixed(2), agents: g.villages.agents.length, pets: g.villages.joy ? g.villages.joy.petsDrawn || 0 : 0 }; });
    const measure = async (name) => { const r1 = await measure0(); await step(20, 33); const r2 = await measure0(); const r = r2.ms < r1.ms ? r2 : r1; r.runs = [r1.ms, r2.ms]; cost[name] = r; console.log(`  · ${name}: ${JSON.stringify(r)} (${secs()}, load ${fs.readFileSync('/proc/loadavg', 'utf8').split(' ')[0]})`); return r; };
    const preset = (pr) => ev((pr) => { const g = VR.game; g.applyPreset(pr); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); }, pr);
    await ev(() => VR.game.env.setTime(4000));
    const V = [HP.plaza[0], HP.plaza[1], HP.plaza[2]], CP = [V[0] + 14, V[1] + 6, V[2] + 14];
    for (const pr of ['potato', 'high']) {
      await preset(pr); await settle(20); await step(60, 33);
      for (const off of [true, false, true, false]) {
        await ev((off) => { VR.FolkJoy.off = off; }, off);
        await lookFrom(CP, V); await step(10, 33);
        await measure(`${pr}_${off ? 'off' : 'on'}${cost[pr + '_' + (off ? 'off' : 'on')] ? '2' : ''}`);
      }
    }
    await ev(() => { VR.FolkJoy.off = false; });
    const best = (k) => Math.min(cost[k] ? cost[k].ms : 999, cost[k + '2'] ? cost[k + '2'].ms : 999);
    run.cost = cost;
    console.log(`  cost Very Low off ${best('potato_off')} / on ${best('potato_on')} ms · High off ${best('high_off')} / on ${best('high_on')} ms`);
    check(best('potato_on') <= best('potato_off') * 1.1 + 0.5, `Very Low not slower with the moments (${best('potato_off')} → ${best('potato_on')} ms)`);
    await preset('balanced'); await ev(() => { VR.game.settings.smoothFolk = true; VR.game.applySettings('*'); }); await settle(20);
  } catch (e) { check(false, 'cost: ' + String(e && e.stack || e).slice(0, 500)); }
  save();
}

const errs = logs.filter(l => /pageerror|folkjoy|TypeError|ReferenceError/.test(l));
for (const l of logs.slice(0, 12)) console.log('  log ' + l);
console.log('  · gl lost at the end: ' + await ev(() => !!VR.game.glLost));
check(errs.length === 0, `no page error (${errs.length})`);
run.logs = logs.slice(0, 40); save(); writeSheet();
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
