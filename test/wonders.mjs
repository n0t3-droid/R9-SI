// ✨ Wunder der Welt end to end (German UI): a new world lists its wonder sites, the spawn's cell holds the first one
// 250–450 blocks out; near it (its lot loaded) the game plans it and it rises from the ground in a few seconds; at its
// heart a big banner „✨ Wunder entdeckt: …", the codex page, and /bau <Name> plans one (before the discovery a kind
// word, no plan); the Wunderkompass at the top points to it. Then all eight wonders are built next to each other through
// forge plans and photographed: test/shots/wonder_<type>.png by day, two of them by night (…_night.png). No pageerror.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import http from 'http';
import fs from 'fs';
import path from 'path';
const DIST = '/home/claude/vr/dist', SHOTS = '/home/claude/vr/test/shots', TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };
const srv = http.createServer((q, a) => { if (q.url === '/favicon.ico') { a.writeHead(204); a.end(); return; } const f = path.join(DIST, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'); if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { a.writeHead(404); a.end(); return; } a.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(a); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const URL0 = `http://127.0.0.1:${srv.address().port}`;
console.log('serving', DIST, 'at', URL0);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, locale: 'de-DE' });
await ctx.addInitScript(() => { try { localStorage.setItem('r9si.lang', 'de'); } catch (e) { /* */ } });
const logs = [], fails = [], T0 = Date.now();
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const crashed = async (e) => { console.log('✗ crashed: ' + String(e && e.stack || e).slice(0, 900)); fails.push('crash'); try { await finish(); } catch (e2) { process.exit(1); } };
process.on('unhandledRejection', crashed); process.on('uncaughtException', crashed);
const finish = async () => { console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 16)) console.log(l); check(!logs.some(l => /pageerror/.test(l)), 'no pageerror'); console.log('(' + ((Date.now() - T0) / 1000).toFixed(0) + ' s)'); await browser.close(); srv.close(); console.log(fails.length ? 'FAILED ' + fails.length : 'ALL OK'); process.exit(fails.length ? 1 : 0); };
const page = await ctx.newPage();
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) logs.push('[console] ' + m.text().slice(0, 300)); });
await page.goto(URL0 + '/index.html');
const ev = (fn, a) => page.evaluate(fn, a);
// the game's loop driven by hand (fixed 33 ms frames, drawing only when a picture is wanted)
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (Fr) { if (window.__norender) { this.setupCamera(Fr.cam); return; } return this._render(Fr); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await page.waitForTimeout(5); } };
const settle = async (max = 90) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && i > 3) break; await page.waitForTimeout(60); } };
const draw = async (hud) => { await ev((h) => { window.__norender = false; const g = VR.game; g.hideHud = !h; const el = document.getElementById('hud'); if (el) el.style.display = h ? '' : 'none'; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, !!hud); };
for (let i = 0; i < 120; i++) { await page.waitForTimeout(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 7; g.settings.horizon = 1; g.settings.shadows = 1; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Wunderwelt',mode:'creative',difficulty:'peaceful',type:'default',seed:'20261008',cheats:true,kit:true})`);
for (let i = 0; i < 240; i++) { await page.waitForTimeout(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world (Standard, seed 20261008) is open');
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; g.settings.wx = 'off'; g.applySettings && g.applySettings('wx'); g.env.wx && g.env.wx.force && g.env.wx.force('klar'); window.requestAnimationFrame = () => 0; g.env.setTime(5200); });
await settle(60);
// ---- the sites: the worker lists them; the spawn's cell holds the first wonder 250–450 blocks out
let info = null;
for (let i = 0; i < 80; i++) { await step(10); info = await ev(() => { const g = VR.game, W = g.wonders; if (!W) return { none: true }; const sp = g.worldSpawn(); return { n: W.sites.length, more: W.more, spawn: sp, first: W.sites.find(s => s.first) || null, sites: W.sites.map(s => s.type + '@' + Math.round(Math.hypot(s.x - sp[0], s.z - sp[2]))) }; }); if (info.first && !info.more) break; await page.waitForTimeout(200); }
console.log('sites', JSON.stringify(info && { n: info.n, spawn: info.spawn && info.spawn.map(Math.round), sites: info.sites }));
const first = info && info.first;
check(!!first && Math.hypot(first.x - info.spawn[0], first.z - info.spawn[2]) >= 250 && Math.hypot(first.x - info.spawn[0], first.z - info.spawn[2]) <= 450, 'the first wonder of the world: a ' + (first && first.type) + ' ' + (first ? Math.round(Math.hypot(first.x - info.spawn[0], first.z - info.spawn[2])) : '?') + ' blocks from the spawn');
if (!first) await finish();
const comp0 = await ev(() => { const el = document.getElementById('wcompass'); return el ? { shown: el.style.display !== 'none', text: el.textContent } : null; });
check(comp0 && comp0.shown && /^✨ [\d.]+ m [↑↗→↘↓↙←↖]$/.test(comp0.text), 'the Wunderkompass at the top points to it: ' + JSON.stringify(comp0));
// ---- go there: 46 blocks short of it on the way from the spawn, hovering, looking at it
const there = await ev((s) => { const g = VR.game, p = g.player, sp = g.worldSpawn(); const dx = sp[0] - s.x, dz = sp[2] - s.z, L = Math.hypot(dx, dz) || 1, x = s.x + dx / L * 46, z = s.z + dz / L * 46; p.flying = true; p.teleport(x, s.y + 14, z); p.yaw = Math.atan2(-(s.x - x), -(s.z - z)); p.pitch = -0.25; return [x, z]; }, first);
let st = null, risingFrames = 0, sawRise = false, shotRise = false;
for (let i = 0; i < 400; i++) {
  await step(3);
  st = await ev((k) => { const W = VR.game.wonders, e = W.st[k]; return { e: e || null, rising: !!W.rise, job: W.job ? W.job.phase : null }; }, first.key);
  if (st.rising) { sawRise = true; risingFrames += 3; }
  if (st.rising && !shotRise && risingFrames >= 60) { shotRise = true; await draw(true); await page.screenshot({ path: SHOTS + '/wonder_rising.png', timeout: 180000 }); }
  if (st.e && (st.e.status === 'built' || st.e.status === 'blocked')) break;
  if (!st.rising) await page.waitForTimeout(40);
}
console.log('the site', JSON.stringify(st));
check(st && st.e && st.e.status === 'built', 'near it the game planned it and it stands: ' + (st && st.e && st.e.status));
check(sawRise && risingFrames * 0.033 >= 2.5 && risingFrames * 0.033 <= 7, 'it rose from the ground over ' + (risingFrames * 0.033).toFixed(1) + ' s');
const heart = st && st.e && st.e.heart;
const hb = heart ? await ev((h) => { const s = VR.game.world.getBlock(h[0], h[1], h[2]); return { name: s ? VR.R.types[VR.R.T.type[s]].name : 'air', emit: s ? VR.R.T.emit[s] : 0 }; }, heart) : null;
check(hb && hb.emit > 0, 'its heart glows: ' + JSON.stringify(hb));
await settle(80);
// a picture of the first wonder in its land, from where you come
await ev(([s, h]) => { const g = VR.game, p = g.player, sp = g.worldSpawn(); const dx = sp[0] - s.x, dz = sp[2] - s.z, L = Math.hypot(dx, dz) || 1, side = [-dz / L, dx / L], d = 58; const x = s.x + dx / L * d + side[0] * 22, z = s.z + dz / L * d + side[1] * 22; p.flying = true; p.noclip = true; p.teleport(x, h[1] + 16, z); p.yaw = Math.atan2(-(s.x - x), -(s.z - z)); p.pitch = -0.12; }, [first, heart]);
await settle(40); await step(4); await draw(true);
await page.screenshot({ path: SHOTS + '/wonder_first.png', timeout: 180000 });
// ---- /bau before the discovery: a kind word, no plan
const nPlans = () => ev(() => (VR.game.gadgets.blue.plans || []).filter(q => /^wonder:/.test(q.dna)).length);
const nameDe = await ev((t) => VR.game.wonders.name(t), first.type);
const p0 = await nPlans();
await ev((nm) => VR.game.chat('/bau ' + nm), nameDe);
const said = await ev(() => [...document.querySelectorAll('#chatlog div')].map(d => d.textContent).slice(-1)[0] || '');
check((await nPlans()) === p0 && /entdeckt/.test(said), '„/bau ' + nameDe + '“ before finding it: ' + said);
// ---- the discovery: to its heart
await ev((h) => { const g = VR.game, p = g.player; p.noclip = false; p.flying = true; p.teleport(h[0] + 0.5, h[1] + 0.2, h[2] + 2.5); p.yaw = 0; p.pitch = -0.3; }, heart);
let found = null;
for (let i = 0; i < 30; i++) { await step(3); found = await ev((k) => { const g = VR.game, e = g.wonders.st[k], b = document.getElementById('wbanner'); return { found: !!(e && e.found), banner: b ? { on: b.classList.contains('on'), text: b.textContent } : null, codex: !!(g.codex.found && g.codex.found['w:' + e.type]) }; }, first.key); if (found.found) break; }
check(found && found.found, 'standing by its heart discovers it');
check(found && found.banner && found.banner.on && found.banner.text === '✨ Wunder entdeckt: ' + nameDe, 'the big banner: ' + JSON.stringify(found && found.banner));
check(found && found.codex, 'the codex has its page under ✨ Wunder');
// the picture: drawing a frame here takes a while, so the banner is shown once more for it (the moment itself was checked)
await step(2); await draw(true);
const fadeAt = Date.now();
await ev((t) => VR.game.wonders.banner(t), found && found.banner ? found.banner.text : '');
await page.waitForTimeout(800);
await page.screenshot({ path: SHOTS + '/wonder_found.png', timeout: 180000 });
let gone = false; for (let i = 0; i < 40 && !gone; i++) { gone = await ev(() => { const b = document.getElementById('wbanner'); return !b.classList.contains('on'); }); if (!gone) await page.waitForTimeout(200); }
check(gone && Date.now() - fadeAt >= 2300 && Date.now() - fadeAt < 6000, 'the banner fades after its moment (' + ((Date.now() - fadeAt) / 1000).toFixed(1) + ' s)');
// ---- /bau after it: a plan of that wonder where you look (95 blocks back towards the spawn, looking that way: away
// from the gallery further out)
await ev(([s, h]) => { const g = VR.game, p = g.player, sp = g.worldSpawn(), dx = sp[0] - s.x, dz = sp[2] - s.z, L = Math.hypot(dx, dz) || 1; p.flying = true; p.teleport(s.x + dx / L * 95, h[1] + 8, s.z + dz / L * 95); p.yaw = Math.atan2(-dx, -dz); p.pitch = -0.7; }, [first, heart]);
await settle(30);
await ev((nm) => VR.game.chat('/bau ' + nm), nameDe);
const planned = await ev(() => (VR.game.gadgets.blue.plans || []).filter(q => /^wonder:/.test(q.dna)).map(q => q.dna + ' ' + q.status));
check(planned.length === p0 + 1 && planned.some(d => d.startsWith('wonder:' + first.type + '#')), '„/bau ' + nameDe + '“ after finding it plans one: ' + planned.join(', '));
const cx = await ev(() => { const g = VR.game; return { open: !!g.codex, list: g.codex.list().filter(e => e.catKey === 'wonders').map(e => (e.found ? '✓ ' : '· ') + e.name) }; });
check(cx.list.length === 8 && cx.list.filter(s => s[0] === '✓').length === 1, 'the codex category ✨ Wunder: ' + cx.list.join(' | '));
// ---- the map: the found one as ✨ with its name, the ones not found yet within 1 km as „?"
const mk = await ev(() => { const g = VR.game, m = g.wonders.marks(); g.map.scale = 4; g.map.openBig(); return { found: m.filter(q => q.found).map(q => q.name), open: m.filter(q => !q.found).length, screen: g.ui.screen }; });
await page.waitForTimeout(300);
await page.screenshot({ path: SHOTS + '/wonder_map.png', timeout: 180000 });
check(mk.screen === 'mapscreen' && mk.found.length === 1 && mk.found[0] === nameDe, 'the map: ✨ ' + mk.found.join(', ') + ' and ' + mk.open + ' „?" within 1 km');
await ev(() => VR.game.ui.show(null));
// ---- the gallery: all eight, next to each other (forge plans like /bau's), photographed by day — two by night
// (each on a dry, gentle spot: a spot in a lake or on a cliff moves on along the line; a wider view for the pictures)
await ev(() => { const g = VR.game; g.settings.renderDist = 8; g.applySettings('renderDist'); });
const TYPES8 = await ev(() => VR.Wonders.TYPES.map(t => t.id));
const base = await ev((s) => { const g = VR.game, sp = g.worldSpawn(), dx = s.x - sp[0], dz = s.z - sp[2], L = Math.hypot(dx, dz) || 1; return { x: s.x + dx / L * 120, z: s.z + dz / L * 120, ax: -dz / L, az: dx / L, fx: dx / L, fz: dz / L, y: s.y }; }, first);
const land = (x, z, LW, LD) => ev(([x, z, LW, LD]) => {
  const g = VR.game, w = g.world, R = VR.R; let wet = 0, n = 0, lo = 1e9, hi = -1e9, miss = 0;
  for (let a = 0; a <= 6; a++) for (let b = 0; b <= 6; b++) {
    const px = Math.round(x - LW / 2 + LW * a / 6), pz = Math.round(z - LD / 2 + LD * b / 6);
    if (!w.col(px >> 4, pz >> 4)) { miss++; continue; }
    for (let y = 230; y > 1; y--) { const st = w.getBlock(px, y, pz); if (!st) continue; const nm = R.types[R.T.type[st]].name; if (/leaves|log|grass$|fern|flower|bush|vine|snow$|lily|kelp|seagrass|tulip|poppy|dandelion|orchid|allium|bluet|daisy|cornflower|lilac|peony|rose/.test(nm) && !/grass_block/.test(nm)) continue; n++; if (/water|ice/.test(nm)) wet++; lo = Math.min(lo, y); hi = Math.max(hi, y); break; }
  }
  return { wet: n ? wet / n : 1, relief: hi - lo, miss };
}, [x, z, LW, LD]);
const shots = [];
let along = 0;
for (let k = 0; k < TYPES8.length; k++) {
  const type = TYPES8[k], lot = await ev((t) => VR.Forge.meta(VR.Wonders.dna(t, 1)).lot, type);
  let gx = 0, gz = 0, spot = null;
  for (let tries = 0; tries < 6; tries++) {
    gx = Math.round(base.x + base.ax * along); gz = Math.round(base.z + base.az * along);
    await ev(([x, z, y]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x + 0.5, y + 70, z + 0.5); p.pitch = -1.2; }, [gx, gz, base.y]);
    await settle(40);
    spot = await land(gx, gz, lot[0] + 6, lot[1] + 6);
    if (spot.wet <= 0.06 && spot.relief <= 14) break;
    console.log('  (' + type + ': the spot at ' + gx + ' ' + gz + ' is ' + JSON.stringify(spot) + ' — further along)');
    along += 70;
  }
  along += 86;
  const pl = await ev(([type, x, z, k]) => {
    const g = VR.game, B = g.gadgets.blue, W = VR.Wonders, dna = W.dna(type, 0x5eed + k), M = VR.Forge.meta(dna), LW = M.lot[0], LD = M.lot[1];
    const hs = []; for (let a = 0; a <= 6; a++) for (let b = 0; b <= 6; b++) hs.push(B.groundAt(Math.round(x - LW / 2 + LW * a / 6), Math.round(z - LD / 2 + LD * b / 6), 220, 10));
    hs.sort((p1, p2) => p1 - p2);
    const F0 = hs[hs.length >> 1] + 1, pl = { id: 'gal-' + type, kind: 'forge', dna, ox: x - (LW >> 1), oz: z - (LD >> 1), F: F0, r: 0, status: 'pending', t: Date.now() };
    if (!B.plans) B.loadPlans(); B.plans.push(pl); B.planT = 0;
    return { dna, F: F0, lot: M.lot };
  }, [type, gx, gz, k]);
  let built = false; for (let i = 0; i < 300 && !built; i++) { await step(5); built = await ev((id) => { const q = (VR.game.gadgets.blue.plans || []).find(p => p.id === id); return !!(q && q.status === 'built'); }, 'gal-' + type); if (!built) await page.waitForTimeout(40); }
  const top = await ev((dna) => { const c = VR.game.gadgets.blue.cache.get('f:' + dna); return c ? c.top : 40; }, pl.dna);
  // the camera: in front of it (its entrance faces −z) and a little to the side, far enough to see all of it
  await ev(([x, z, F0, top, lot]) => { const g = VR.game, p = g.player; const d = Math.max(lot[0], lot[1]) * 0.6 + top * 0.5 + 12, px = x + d * 0.42, pz = z - d * 0.92; p.flying = true; p.noclip = true; p.teleport(px, F0 + Math.max(8, top * 0.4), pz); p.yaw = Math.atan2(-(x - px), -(z - pz)); p.pitch = -0.08 - Math.min(0.14, 6 / d); }, [gx, gz, pl.F, top, pl.lot]);
  await settle(60); await step(4);
  await ev(() => VR.game.env.setTime(5200)); await step(2); await draw(false);
  await page.screenshot({ path: SHOTS + '/wonder_' + type + '.png', timeout: 180000 });
  shots.push(type + (built ? '' : ' (not built)'));
  if (type === 'kristall' || type === 'mondtempel') {
    await ev(() => VR.game.env.setTime(18400)); await step(6); await draw(false);
    await page.screenshot({ path: SHOTS + '/wonder_' + type + '_night.png', timeout: 180000 });
    shots.push(type + ' night');
    await ev(() => VR.game.env.setTime(5200)); await step(2);
  }
  console.log('  photographed ' + type + ' (' + pl.dna + ', F ' + pl.F + ', land ' + JSON.stringify(spot) + ', built ' + built + ', ' + ((Date.now() - T0) / 1000).toFixed(0) + ' s)');
}
check(shots.filter(s => !/not built/.test(s)).length === 10, 'all eight wonders built and photographed, two by night too: ' + shots.join(' · '));
await finish();
