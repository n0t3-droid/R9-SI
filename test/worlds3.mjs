// u-worlds3 in the browser (docs/superpowers/plans/2026-10-31-u-worlds3.md): a new Kreativ world (seed 4242), 960 × 540,
// de-DE, High (the smooth people). On each native world: a native's face close up, the greeting when you talk to one
// (turned to you, the gesture, the word, the others making room), the plaza at dusk (bgen 4); on the first world the
// three quests played through and the recipe; the cost at Ocker's village alone (Very Low / High, the people off)
// → test/shots/w3_<kind>_{face,greet,plaza}.png, test/shots/worlds3_species_sheet.jpg, .tmp_tests/worlds3_run.json
//   nohup bash test/wt_run.sh worlds3.mjs 3600 > .tmp_tests/worlds3.log 2>&1 &   (WORLDS=zinn,ocker · ONLY=worlds,cost)
// regress: skip  (a showcase with pictures; the gate is test/worlds3.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
const require = createRequire(import.meta.url);
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html';
const SHOTS = ROOT + '/test/shots/';
const SEED = process.env.SEED || '4242', DUR = +(process.env.DUR || 300);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, want = (s) => !ONLY || ONLY.includes(s);
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + ' (' + secs() + ')'); };
const run = { seed: SEED };
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/worlds3_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|world eco/i.test(s) || (process.env.DIAG && t === 'warning')) logs.push(`[${t}] ${s.slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto(DIST);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); if (window.__each) window.__each(g); } }, [Math.min(10, n - k), dtms]); await wait(3); } };
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
  const url = await ev((frames) => { try { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { if (window.__each) window.__each(g); g.last = performance.now() - 33; g.loop(performance.now()); if (window.__each) window.__each(g); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; } catch (e) { window.__norender = true; return null; } }, frames);
  if (url && url.length > 2000) { fs.writeFileSync(SHOTS + name, Buffer.from(url.split(',')[1], 'base64')); console.log('  📷 ' + name); return SHOTS + name; }
  console.log('  !! no picture ' + name); return null;
};
const shotDom = async (name) => { try { await ev(() => { window.__norender = false; const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); window.__norender = true; }); await page.screenshot({ path: SHOTS + name, timeout: 120000 }); console.log('  📷 ' + name); return SHOTS + name; } catch (e) { console.log('  !! ' + name + ' ' + String(e.message).slice(0, 80)); return null; } };
async function trip(start, to) {
  await ev(start, to);
  for (let i = 0; i < 600; i++) { await step(10, 33); const s = await ev(() => ({ st: VR.game.state, dim: VR.game.dim, busy: VR.Travel.busy(VR.game) })); if (s.dim === to && s.st === 'play' && !s.busy) return true; await wait(20); }
  return false;
}
// look at a point from where the player stands (the eye's yaw / pitch)
const lookAt = (P) => ev((P) => { const p = VR.game.player, e = p.eyePos(), dx = P[0] - e[0], dy = P[1] - e[1], dz = P[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw; }, P);
const sheet = [];
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.smoothFolk = true; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Welten',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world');
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(6000); });
await settle(30);
const WORLDS = process.env.WORLDS ? process.env.WORLDS.split(',') : ['aqua', 'ocker', 'zinn', 'basalt', 'opal'];
// one native held in place (window.__each runs every frame): on the plaza's ring path east of the monument, facing the
// camera (the villages' own bearing: yaw = atan2(−dx, −dz) toward what one faces) turned by __yawOff
const hold = (vid) => ev((vid) => { const g = VR.game, v = g.villages.known.get(vid); if (!v) return null; const pz = v.plan.plaza; const ag = v.agents.filter(o => !o.kid && o.pose !== 'sleep' && o.pose !== 'sit'); const a = ag[1] || ag[0]; if (!a) return null;
  window.__held = a; a.greetT = 0; window.__yawOff = 0.35;
  const S = window.__spot = [pz.x + 5.5, pz.y, pz.z + 1.8];
  window.__each = () => { const pl = g.player.pos; a.act = null; a.steer = null; a.path = null; a.pose = 'stand'; if (a.vel) { a.vel[0] = 0; a.vel[2] = 0; } a.walkAmt = 0; a.pos[0] = S[0]; a.pos[1] = S[1]; a.pos[2] = S[2]; if (!(g.villages.talking === a)) a.yaw = Math.atan2(-(pl[0] - a.pos[0]), -(pl[2] - a.pos[2])) + window.__yawOff; };
  window.__each(g);
  // (the photo framing: the others within 9 m step back and wait — natives.js's hush)
  for (const o of v.agents) if (o !== a && Math.hypot(o.pos[0] - a.pos[0], o.pos[2] - a.pos[2]) < 9) o.hush = { t: 40, spot: VR.Natives.hushSpot(o.pos, a.pos) };
  return { name: a.name, id: a.p.id, sc: VR.Folk.SPECIES_BODY[vid.split(':')[1]].scale, species: a.p.look.species, tool: VR.Folk.toolOf(a.p.look), pos: a.pos.slice() };
}, vid);
// the camera d m north of the native (−z), the feet on the plaza (lifted by up), looking at height h (× the scale)
const frame = (d, h, up, side) => ev(([d, h, up, side]) => { const g = VR.game, a = window.__held, S = window.__spot, sc = VR.Folk.SPECIES_BODY[a.p.look.species].scale, p = g.player;
  p.flying = true; p.teleport(S[0] + (side || 0), S[1] + (up || 0.05), S[2] - d);
  const e = p.eyePos(), dx = S[0] - e[0], dy = S[1] + h * sc - e[1], dz = S[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw; }, [d, h, up, side]);
let chainDone = false;
for (const kind of WORLDS) {
  if (!want('worlds')) break;
  console.log('== ' + kind);
  const t0 = Date.now();
  const ok = await trip((d) => VR.Travel.go(VR.game, { dim: d, via: 'cmd' }), kind).catch(() => false);
  check(ok, `the jump to ${kind} (${Math.round((Date.now() - t0) / 1000)} s)`);
  if (!ok) continue;
  const row = [];
  await ev(() => { const g = VR.game; g.env.setTime(5200); if (g.ui && g.ui.show) g.ui.show(null); });
  await settle(30);
  const vid = 'eco:' + kind + ':0';
  let V = null;
  for (let i = 0; i < 30; i++) { await step(20, 33); V = await ev((vid) => { const vil = VR.game.villages.sites.find(s => s.id === vid); return vil ? { x: vil.x, y: vil.y, z: vil.z, name: vil.name } : null; }, vid); if (V) break; await wait(200); }
  if (!V) { check(false, `${kind}: the village on the map`); continue; }
  await ev((V) => { const p = VR.game.player; p.flying = true; p.teleport(V.x - 8, V.y + 3, V.z + 6); }, V);
  for (let i = 0; i < 90; i++) { await step(10, 33); const ok = await ev((V) => { const w = VR.game.world; for (const dx of [-24, 0, 24]) for (const dz of [-24, 0, 24]) if (!w.isLoaded(V.x + dx, V.z + dz)) return false; return true; }, V); if (ok) break; await wait(300); }
  await settle(60);
  let vs = null;
  for (let i = 0; i < 30; i++) { await step(20, 33); vs = await ev((vid) => { const v = VR.game.villages.known.get(vid); return v ? { active: v.active, agents: v.agents.length } : null; }, vid); if (vs && vs.active && vs.agents > 0) break; await wait(150); }
  // 1 · the face close up (High: the smooth path; its model is built in a worker — a few frames over time)
  const nat = await hold(vid);
  check(nat && nat.species === kind && nat.tool, `${kind}: a native, ${nat ? nat.name : '?'} with its ${nat ? nat.tool : '?'}`);
  if (!nat) continue;
  await frame(1.0, kind === 'ocker' ? 1.66 : 1.5, kind === 'basalt' ? -0.2 : 0.05, -0.3);
  for (let i = 0; i < 8; i++) { await step(6, 33); await frame(1.0, kind === 'ocker' ? 1.66 : 1.5, kind === 'basalt' ? -0.2 : 0.05, -0.3); await ev(() => { window.__norender = false; const g = VR.game; window.__each(g); g.last = performance.now() - 33; g.loop(performance.now()); window.__each(g); window.__norender = true; }); await wait(400); }
  const sm = await ev(() => { const a = window.__held; return a.fg ? a.fg.state : -1; });
  check(sm === 2, `${kind}: the smooth body ready (state ${sm})`);
  row.push(await grab(`w3_${kind}_face.png`, 3));
  // 2 · the greeting: talk to it — it turns to you, greets in its own way, says a word; the others make room
  await frame(3.2, 1.0, 0.05, 1.2);
  await ev(() => { const g = VR.game; for (const o of window.__held.vil.agents) if (o !== window.__held && !o.kid && Math.hypot(o.pos[0] - g.player.pos[0], o.pos[2] - g.player.pos[2]) > 7) { o.pos[0] = g.player.pos[0] + 3; o.pos[2] = g.player.pos[2] + 2.5; break; } });
  const t1 = await ev(() => { const g = VR.game, a = window.__held; g.villages.openTalk(a); const pl = g.player.pos, near = a.vil.agents.filter(o => o !== a && Math.hypot(o.pos[0] - pl[0], o.pos[2] - pl[2]) < 7).length; return { text: document.getElementById('tk_text').textContent, near, greet: a.greetT }; });
  await step(24, 33);
  await shotDom(`w3_${kind}_talk.png`);
  await ev(() => { const el = document.getElementById('talk'); if (el) el.style.visibility = 'hidden'; });
  row.push(await grab(`w3_${kind}_greet.png`, 2));
  await ev(() => { const el = document.getElementById('talk'); if (el) el.style.visibility = ''; });
  for (let i = 0; i < 6; i++) await step(20, 33);
  await ev(() => { const g = VR.game, a = window.__held; a.greetT = 0; });
  const t2 = await ev(() => { const g = VR.game, a = window.__held, pl = g.player.pos; const near = a.vil.agents.filter(o => o !== a && Math.hypot(o.pos[0] - pl[0], o.pos[2] - pl[2]) < 6.5).length, free = a.vil.agents.filter(o => o !== a && !o.hush && Math.hypot(o.pos[0] - pl[0], o.pos[2] - pl[2]) < 6.5).length, hushed = a.vil.agents.filter(o => o.hush).length; const dy = Math.atan2(-(pl[0] - a.pos[0]), -(pl[2] - a.pos[2])) - a.yaw; return { near, free, hushed, turned: Math.abs(Math.atan2(Math.sin(dy), Math.cos(dy))) }; });
  const word = await ev((k) => VR.Natives.LANG[k][0].w, kind);
  check(t1.text.includes(word) && t1.greet > 2, `${kind}: the greeting „${t1.text.slice(0, 70)}…“`);
  check(t2.turned < 0.35, `${kind}: turned to the player (${(t2.turned * 57.3).toFixed(0)}° off)`);
  check(t2.free === 0, `${kind}: the others make room (${t1.near} → ${t2.near} within 6.5 m, all of them stepping back: ${t2.hushed} waiting)`);
  // the three quests (on the first world): two more natives greeted → the gift → the culture moment → taught
  if (!chainDone) {
    const c = await ev((k) => { const g = VR.game, v = window.__held.vil; g.villages.closeTalk(); for (const o of v.agents.filter(o => o !== window.__held && !o.kid).slice(0, 2)) { g.villages.openTalk(o); g.villages.closeTalk(); } const s1 = VR.Natives.step(g.meta, k), q = VR.Natives.CHAIN[k][1]; g.player.inv.add(q.item, q.n); g.villages.openTalk(window.__held); const b = [...document.querySelectorAll('#tk_opts button')][0]; b.click(); const gb = document.querySelector('[data-natgive]'); if (gb) gb.click(); const s2 = VR.Natives.step(g.meta, k); g.villages.closeTalk(); return { s1, s2, text: document.getElementById('tk_text').textContent.slice(0, 90) }; }, kind);
    await ev(() => { window.__each = null; VR.game.env.setTime(12500); });
    await ev((V) => { const p = VR.game.player; p.flying = false; p.teleport(V.x + 5.5, V.y + 0.2, V.z + 0.5); }, V);
    for (let i = 0; i < 52; i++) await step(10, 33);
    const t = await ev((k) => { const g = VR.game, T = VR.Natives.TEACH[k]; const grid = T.ins ? T.ins.map(id => ({ id, n: 1 })) : null; const m = grid ? VR.Crafting.match(grid, 3) : null; return { s: VR.Natives.step(g.meta, k), m, favs: VR.Favs ? VR.Favs.list().length : -1 }; }, kind);
    check(c.s1 === 1 && c.s2 === 2 && t.s === 3, `${kind}: the three quests — greeted (${c.s1}), the gift (${c.s2}), the moment (${t.s}) „${c.text}“`);
    check(!!(t.m && t.m.id) || t.favs > 0, `${kind}: taught — ${JSON.stringify(t.m)} · ★ ${t.favs}`);
    chainDone = true;
    run.chain = { c, t };
  } else await ev(() => VR.game.villages.closeTalk());
  // 3 · the plaza at dusk (bgen 4: calm paving, benches, the monument's foot, lanterns)
  await ev(() => { window.__each = null; VR.game.env.setTime(12350); });
  await ev((V) => { const p = VR.game.player; p.flying = true; p.teleport(V.x + 9.5, V.y + 3.6, V.z + 9.5); }, V);
  for (let i = 0; i < 12; i++) await step(30, 33);
  await lookAt([V.x + 0.5, V.y + 2, V.z + 0.5]); await step(4);
  row.push(await grab(`w3_${kind}_plaza.png`));
  const pz = await ev((vid) => { const v = VR.game.villages.known.get(vid), pz = v.plan.plaza; const inMon = v.agents.filter(a => Math.hypot(a.pos[0] - pz.x - 0.5, a.pos[2] - pz.z - 0.5) < 2.2 && vid.indexOf('opal') < 0).length;   // (the Nivari's vault: a way under it) return { seats: (pz.seats || []).length, foot: pz.foot, inMon }; }, vid);
  check(pz.seats >= 8 && pz.foot >= 8 && pz.inMon === 0, `${kind}: the plaza — ${pz.seats} seats, the foot ${pz.foot}, ${pz.inMon} inside the monument`);
  await ev(() => VR.game.env.setTime(5200));
  sheet.push({ label: `${kind}: the face up close · the greeting · the plaza at dusk`, imgs: row.filter(Boolean) });
  run[kind] = { nat, t1, t2, pz };
  save();
}

// ---------------------------------------------------------------- the cost at Ocker's village alone (Very Low / High)
if (want('cost')) {
  const os = await import('os');
  await trip((d) => VR.Travel.go(VR.game, { dim: d, via: 'cmd' }), 'ocker');
  await settle(30);
  const V = await ev(() => { const s = VR.game.villages.sites.find(q => q.id === 'eco:ocker:0'); return s ? [s.x, s.y, s.z] : null; });
  const cost = { load: os.loadavg()[0].toFixed(2) };
  const meas = () => ev(() => { const g = VR.game; window.__norender = false; for (let i = 0; i < 6; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); const ms = []; for (let i = 0; i < 16; i++) { const t = performance.now(); g.last = t - 33; g.loop(t); g.renderer.gl.finish(); ms.push(performance.now() - t); } window.__norender = true; ms.sort((a, b) => a - b); return +ms[8].toFixed(1); });
  if (V) for (const preset of ['potato', 'high']) {
    await ev((pr) => { const g = VR.game; g.applyPreset(pr); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); }, preset);
    await ev((V) => { const g = VR.game, p = g.player; g.env.setTime(5200); p.flying = true; p.teleport(V[0] + 22, V[1] + 8, V[2] + 22); }, V);
    await settle(25);
    await lookAt([V[0], V[1], V[2]]);
    cost[preset] = await meas(); cost[preset + '_2'] = await meas();
    // (the same view without the people drawn: what the village's folk cost)
    await ev(() => { const v = VR.game.villages; v._draw0 = v.draw; v.draw = function () {}; });
    cost[preset + '_nofolk'] = await meas();
    await ev(() => { const v = VR.game.villages; v.draw = v._draw0; });
    cost[preset + '_load'] = os.loadavg()[0].toFixed(2);
  }
  run.cost = cost; console.log('  cost ' + JSON.stringify(cost));
  check(V && cost.potato, 'cost measured');
}

check(!logs.some(l => /pageerror/.test(l)), 'no page error' + (logs.length ? ': ' + logs.slice(0, 3).join(' · ') : ''));
save();
if (sheet.length) { fs.writeFileSync(ROOT + '/.tmp_tests/worlds3_sheet.json', JSON.stringify({ w: 620, rows: sheet })); try { console.log('  ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'worlds3_species_sheet.jpg', ROOT + '/.tmp_tests/worlds3_sheet.json']).toString().trim()); } catch (e) { console.log('  !! sheet ' + e.message); } }
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
