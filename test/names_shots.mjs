// n-names: the names in the game (docs/superpowers/plans/2026-10-31-n-names.md): a Herzwelt village with its people's
// name tags (their speech bubbles carry the name), the talk card of an elder and their family, a Glimari village on
// Zinnober, the star map's labels, the codex's page „Völker" and the Wanderbuch's sites → test/shots/names_*.png, test/shots/names_sheet.jpg
//   nohup bash test/wt_run.sh names_shots.mjs 3600 > .tmp_tests/names_shots.log 2>&1 &
// regress: skip  (a showcase with pictures; the gate is test/names.js)
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
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/names_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
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
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('low'); g.settings.dynRes = false; g.settings.renderDist = 6; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Namen',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world');
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(5000); });
await settle(30);
const pics = {};
// a village's people near the camera say hello: the bubbles carry their names (the game's own name tags)
async function village(vid, tag) {
  let V = null;
  for (let i = 0; i < 40; i++) { await step(20, 33); V = await ev((vid) => { const S = VR.game.villages.sites; const s = vid ? S.find(s => s.id === vid) : S.filter(s => !/Nova Haven|Weißstadt/.test(s.name || '')).sort((a, b) => Math.hypot(a.x - VR.game.player.pos[0], a.z - VR.game.player.pos[2]) - Math.hypot(b.x - VR.game.player.pos[0], b.z - VR.game.player.pos[2]))[0]; return s ? { id: s.id, x: s.x, y: s.y, z: s.z, name: s.name } : null; }, vid); if (V) break; await wait(200); }
  if (!V) { check(false, tag + ': a village'); return null; }
  await ev((V) => { const p = VR.game.player; p.flying = true; p.teleport(V.x - 8, V.y + 4, V.z + 8); }, V);
  for (let i = 0; i < 90; i++) { await step(10, 33); const ok = await ev((V) => { const w = VR.game.world; for (const dx of [-24, 0, 24]) for (const dz of [-24, 0, 24]) if (!w.isLoaded(V.x + dx, V.z + dz)) return false; return true; }, V); if (ok) break; await wait(300); }
  await settle(60);
  let vs = null;
  for (let i = 0; i < 40; i++) { await step(20, 33); vs = await ev((id) => { const v = VR.game.villages.known.get(id); return v ? { active: v.active, agents: v.agents.length, name: v.name } : null; }, V.id); if (vs && vs.active && vs.agents > 0) break; await wait(150); }
  check(vs && vs.agents > 0, tag + ': „' + V.name + '" with ' + (vs ? vs.agents : 0) + ' people');
  // gather five of them in a loose arc in front of the camera, each saying hello
  const who = await ev((id) => { const g = VR.game, v = g.villages.known.get(id), pz = v.plan.plaza || { x: v.plan.x, y: v.plan.y, z: v.plan.z };
    const ag = v.agents.filter(a => a.pose !== 'sleep'), pick = [];
    for (const k of ['elder', 'child', null]) for (const a of ag) if (pick.length < 6 && !pick.includes(a) && (k === null ? true : (a.role === k || (k === 'child' && a.kid)))) { pick.push(a); if (k) break; }
    const spots = pick.map((a, i) => [pz.x - 3 + i * 1.6, pz.y, pz.z - 1 + (i % 2) * 1.2]);
    window.__each = () => { pick.forEach((a, i) => { a.act = null; a.steer = null; a.path = null; a.pose = 'stand'; a.walkAmt = 0; if (a.vel) { a.vel[0] = 0; a.vel[2] = 0; } a.pos[0] = spots[i][0]; a.pos[1] = spots[i][1]; a.pos[2] = spots[i][2]; a.yaw = 0; }); };
    window.__each(g);
    pick.forEach((a, i) => a.say(VR.I18N.tx('n.names.hello' + (i % 3), null, ['Hallo!', 'Schön, dass du da bist!', 'Willkommen!'][i % 3], ['Hello!', 'Lovely to see you!', 'Welcome!'][i % 3]), 60));
    const p = g.player; p.flying = true; p.teleport(pz.x + 1, pz.y + 1.2, pz.z + 7.5); const e = p.eyePos(); p.yaw = Math.atan2(-(pz.x + 1 - e[0]), -(pz.z - 0.4 - e[2])); p.pitch = -0.12; p.viewYaw = p.yaw;
    return pick.map(a => a.name + (a.kid ? ' (Kind)' : a.role === 'elder' ? ' (Ältere)' : ''));
  }, V.id);
  console.log('  ' + tag + ' people: ' + who.join(', '));
  run[tag] = { village: V.name, people: who }; save();
  for (let i = 0; i < 6; i++) { await step(4, 33); }
  pics[tag] = await shotDom('names_' + tag + '_village.png');
  return V;
}
const H = await village(null, 'herz');
check(H && /^[A-ZÄÖÜ][a-zäöüß]+$/.test(H.name) && !/water|haven|brook|vale|hollow/.test(H.name), 'Herzwelt\'s village has a German name: „' + (H ? H.name : '?') + '"');
// the talk card: an elder and their family
const card = await ev(() => { const g = VR.game, V = g.villages; window.__each = null; const v = [...V.known.values()].find(v => v.active); const a = v.agents.find(a => a.role === 'elder') || v.agents.find(a => !a.kid); V.openTalk(a); return { name: a.name, fam: (document.getElementById('tk_rel') || {}).textContent || '' }; });
console.log('  talk: ' + JSON.stringify(card));
for (let i = 0; i < 3; i++) await step(2, 33);
pics.talk = await shotDom('names_herz_talk.png');
await ev(() => { VR.game.villages.closeTalk(); });
// Zinnober's Glimari
const ok = await trip((d) => VR.Travel.go(VR.game, { dim: d, via: 'cmd' }), 'zinn').catch(() => false);
check(ok, 'the jump to Zinnober');
if (ok) { await ev(() => VR.game.env.setTime(5200)); await settle(30); const Z = await village('eco:zinn:0', 'zinn'); check(Z && !/Glutani/.test(Z.name), 'a Glimari village: „' + (Z ? Z.name : '?') + '"'); }
// the codex's page „Völker" (codex.js): every people found, its sound and a few of its names
await ev(() => { const g = VR.game; for (const k of VR.Names.PEOPLE_ORDER) g.codex.unlock('p:' + k, true); g.ui.showCodex(); const c = [...document.querySelectorAll('#codexgrid .codexcat')].find(e => /Völker/.test(e.textContent)); if (c) c.scrollIntoView({ block: 'start' }); });
for (let i = 0; i < 3; i++) await step(2, 33);
const cx = await ev(() => VR.game.codex.list().filter(e => e.catKey === 'peoples').map(e => e.found + ' ' + e.name + ': ' + e.desc.slice(-70)));
console.log('  codex: ' + cx.join(' | '));
check(cx.length === 7 && cx.every(l => /^true /.test(l) && /So heißen sie: /.test(l)), 'the codex shows the seven peoples with their names');
pics.codex = await shotDom('names_codex.png');
await ev(() => VR.game.ui.show(null));
// the Wanderbuch: the Heartland's sites by their new names (the book stored the old words at the visit)
await ev(() => { const g = VR.game, W = VR.Wander; for (const [id, old] of [['l:hills_w', 'Hügeldorf'], ['l:canyon', 'Schlucht'], ['l:farm_c', 'Bauernhof'], ['l:farm_n', 'Bauernhof'], ['l:east', 'Hain'], ['l:citadel', 'Turmzitadelle'], ['l:temple_w', 'Tor-Tempel']]) W.note(g.meta, 'places', id, old); if (g.villages && g.villages.sites[0]) W.note(g.meta, 'places', 'v:' + g.villages.sites[0].id, g.villages.sites[0].name); W.note(g.meta, 'people', 'Greta Lindenblatt'); W.open(g); });
for (let i = 0; i < 3; i++) await step(2, 33);
const wb = await ev(() => (document.querySelector('#wanderbuch .wdl') || {}).textContent || '');
console.log('  wanderbuch: ' + wb);
check(/Mohnbühl/.test(wb) && /Hallklamm/.test(wb) && /Sonnenhof/.test(wb) && !/Hügeldorf|Bauernhof/.test(wb), 'the Wanderbuch reads the sites\' new names');
pics.book = await shotDom('names_wanderbuch.png');
// the star map (last: its first draw of ~1500 stars is the slowest step on SwiftShader; a bounded wait)
const race = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r('timeout'), ms))]);
let stars = [];
const smOk = await race((async () => {
  await ev(() => { VR.game.ui.show && VR.game.ui.show(null); VR.StarMap.open(VR.game); });
  for (let i = 0; i < 4; i++) await step(2, 33);
  stars = await ev(() => VR.Starjump ? VR.Starjump.hood(VR.game).list.slice(1, 9).map(s => s.name) : (VR.StarJump ? VR.StarJump.hood(VR.game).list.slice(1, 9).map(s => s.name) : []));
  console.log('  stars: ' + stars.join(', '));
  pics.stars = await shotDom('names_starmap.png');
  await ev(() => VR.StarMap.close(VR.game));
  for (let i = 0; i < 3; i++) await step(2, 33);
  return 'ok';
})(), 240000).catch(e => 'error ' + e.message);
check(smOk === 'ok' && stars.length >= 6, 'the star map with its names (' + smOk + ')');
const spec = { w: 620, rows: [{ label: 'Herzwelt: ein Dorf mit deutschem Namen, die Leute tragen ihre Namen · die Karte einer Älteren', imgs: [pics.herz, pics.talk].filter(Boolean) }, { label: 'Zinnober: ein Glimari-Dorf · die Sternkarte mit den neuen Sternnamen', imgs: [pics.zinn, pics.stars].filter(Boolean) }, { label: 'Der Kodex: die Seite „Völker" · das Wanderbuch mit den Orten des Herzlands', imgs: [pics.codex, pics.book].filter(Boolean) }].filter(r => r.imgs.length) };
fs.writeFileSync(ROOT + '/.tmp_tests/names_sheet.json', JSON.stringify(spec));
try { console.log(execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'names_sheet.jpg', ROOT + '/.tmp_tests/names_sheet.json']).toString().trim()); } catch (e) { console.log('  !! sheet ' + e.message); }
const errs = logs.filter(l => /pageerror/.test(l));
for (const l of logs.slice(0, 12)) console.log(l);
check(!errs.length, 'no page errors');
await race(browser.close(), 15000);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
