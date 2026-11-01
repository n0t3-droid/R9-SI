// w-seasons (docs/superpowers/plans/2026-11-01-w-seasons.md): the same village in four seasons, each festival, the
// decorating day, the activities, the Wanderbuch's Feste, the cost on Very Low and High (seasons off / on).
//   nohup bash test/wt_run.sh seasons.mjs 3600 > .tmp_tests/seasons.log 2>&1 &
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
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/seasons_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 400)}`); });
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
  const url = await ev((frames) => { try { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; } catch (e) { window.__norender = true; return null; } }, frames);
  if (url && url.length > 2000) { fs.writeFileSync(SHOTS + name, Buffer.from(url.split(',')[1], 'base64')); console.log('  📷 ' + name); return SHOTS + name; }
  console.log('  !! no picture ' + name); return null;
};
const shotDom = async (name) => { try { await ev(() => { window.__norender = false; const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); window.__norender = true; }); await page.screenshot({ path: SHOTS + name, timeout: 120000 }); console.log('  📷 ' + name); return SHOTS + name; } catch (e) { console.log('  !! ' + name + ' ' + String(e.message).slice(0, 80)); return null; } };
const lookAt = (P) => ev((P) => { const p = VR.game.player, e = p.eyePos(), dx = P[0] - e[0], dy = P[1] - e[1], dz = P[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw; }, P);
const sheet = [];
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 7; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Jahreszeiten',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '424242'}',cheats:true,kit:false})`);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world');
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(4200); });
await settle(30); await step(40, 33);
let vil0 = null;
const GOODS = /^(meadow|cherry|taiga|savanna|jungle)$/;
for (let pass = 0; pass < 2 && !vil0; pass++) for (let k = 0; k < 7; k++) {
  const t = await ev(() => VR.Seasons.Fest.debug.today());
  if (t && (pass === 1 || GOODS.test(t.style || ''))) { vil0 = t; break; }
  const kn = await ev((pass) => { const g = VR.game, V = g.villages, p = g.player.pos; const all = [...V.known.values()].filter(v => v.plan && v.plan.plaza && !v.plan.mine); const L = all.filter(v => pass === 1 || /^(meadow|cherry|taiga|savanna|jungle)$/.test(v.plan.style || '')).map(v => ({ x: v.plan.plaza.x, y: v.plan.plaza.y, z: v.plan.plaza.z, st: v.plan.style, d: Math.hypot(v.plan.plaza.x - p[0], v.plan.plaza.z - p[2]) })).sort((a, b) => a.d - b.d); return { n: all.length, styles: all.map(v => v.plan.style).join(','), v: L[0] || null, p: [p[0] | 0, p[2] | 0] }; }, pass);
  console.log('  (looking for a village: ' + JSON.stringify(kn) + ')');
  if (kn.v) await ev((v) => { const p = VR.game.player; p.flying = true; p.teleport(v.x + 6.5, v.y + 6, v.z + 6.5); }, kn.v);
  else await ev((k) => { const p = VR.game.player; p.flying = true; p.teleport(p.pos[0] + 160 * Math.cos(k * 2.4), 120, p.pos[2] + 160 * Math.sin(k * 2.4)); }, k);
  await settle(12); await step(40, 33);
}
check(!!vil0, 'a village near the start: ' + (vil0 && vil0.vil));
run.vil = vil0;
const pz = vil0.plaza;
// the view: from the plaza's corner, a little raised, over the plaza to the houses and the trees behind
// the views: inside the plaza's edge (never in a house), raised; look across the plaza (season) or down onto it (feast)
const viewAt = async (d, up, side, lookY, across) => {
  const a = 0.75 + (side || 0), R0 = (pz.r || 4) + d, e = [pz.x + 0.5 + Math.cos(a) * R0, pz.y + up, pz.z + 0.5 + Math.sin(a) * R0];
  await ev((e) => { const p = VR.game.player; p.flying = true; p.teleport(e[0], e[1], e[2]); }, e);
  await settle(8);
  const L = across ? [pz.x + 0.5 - Math.cos(a) * across, pz.y + (lookY || 1.5), pz.z + 0.5 - Math.sin(a) * across] : [pz.x + 0.5, pz.y + (lookY || 1.5), pz.z + 0.5];
  await lookAt(L); await step(20, 33);
};
const setDay = (day, tod) => ev(([d, t]) => { const g = VR.game; g.env.day = d; g.env.setTime(t); VR.Seasons.Fest.debug.reset(); return VR.Seasons.debug.cur(); }, [day, tod]);

// ---------------------------------------------------------------- 1 · the same view in four seasons
const S4 = ['spring', 'summer', 'autumn', 'winter'], pics = {};
await viewAt(0.5, 4, 0, 3, 22);
for (let i = 0; i < 4; i++) {
  await setDay(i * 3, 4200);
  await step(60, 33);   // (the air's leaves and petals drift in)
  const c = await ev(() => VR.Seasons.debug.cur());
  check(c.cur.idx === i && c.U.season[i] === 1, `${S4[i]}: the season on Herzwelt (day ${i * 3}, weights ${c.U.season.join(',')}, fx ${c.U.fx.map(v => v.toFixed(2)).join(',')})`);
  pics[S4[i]] = await grab('ss_' + S4[i] + '.png');
}
const cover = await ev(() => VR.game.env.E.snowCover);
check(cover > 0.8, 'winter: the snow cover on the open tops (' + cover.toFixed(2) + ')');
const parts = await ev(() => VR.Seasons.debug.cost().parts);
check(parts > 0, 'leaves and petals fell near the player (' + parts + ')');
// Very Low: the tint alone, the same view in winter and autumn
await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.settings.renderDist = 7; g.applySettings('*'); });
await settle(12); await setDay(9, 4200); await step(20, 33);
pics.vlWinter = await grab('ss_vl_winter.png');
await setDay(6, 4200); await step(20, 33);
pics.vlAutumn = await grab('ss_vl_autumn.png');
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 7; g.applySettings('*'); });
await settle(12);
sheet.push({ label: 'Dieselbe Stelle: Frühling · Sommer', imgs: [pics.spring, pics.summer] }, { label: 'Herbst · Winter', imgs: [pics.autumn, pics.winter] }, { label: 'Sehr niedrig (nur Farben): Herbst · Winter', imgs: [pics.vlAutumn, pics.vlWinter] });
save();

// ---------------------------------------------------------------- 2 · the festivals
const FE = [['bluete', 0, 12400], ['drachen', 1, 12100], ['tafel', 2, 12900], ['lichter', 3, 13900]];
const said = [];
for (const [id, si, tod] of FE) {
  // the day before: the decorating
  if (id === 'lichter' || id === 'bluete') {
    await setDay(si * 3 + 1, 5600); await step(80, 33);
    const t = await ev(() => VR.Seasons.Fest.debug.today());
    check(t.phase === 'prep' && t.id === id, `${id}: the day before, the plaza is being decorated (${t.deco} pieces)`);
    const work = await ev(() => VR.game.villages.agents.filter(a => a.act && a.act.type === 'ssdeco').length);
    check(work >= 1, `${id}: villagers at work on the plaza (${work})`);
    await viewAt(1, 7, 0.3, 1);
    pics[id + '_prep'] = await grab('ss_' + id + '_prep.png');
  }
  await setDay(si * 3 + 2, tod);
  for (let k = 0; k < 10; k++) { await step(40, 33); await wait(20); }
  const t = await ev(() => VR.Seasons.Fest.debug.today());
  const on = await ev(() => { const g = VR.game, V = g.villages, vil = VR.Seasons.Fest.debug.vil(); return { on: V.festivalOn(vil, g.env.timeOfDay), at: vil.agents.filter(a => Math.hypot(a.pos[0] - vil.plan.plaza.x, a.pos[2] - vil.plan.plaza.z) < vil.plan.plaza.r + 6).length, of: vil.agents.length, sit: vil.agents.filter(a => a.pose === 'sit').length }; });
  check(t.phase === 'fest' && t.id === id && on.on, `${id}: the festival is on (${on.at} of ${on.of} on the plaza, ${on.sit} sitting, ${t.deco} decorations, ${t.kites} kites)`);
  if (id === 'tafel') check(on.sit >= 4, 'tafel: the grown-ups sit at the long tables (' + on.sit + ')');
  if (id === 'drachen') {
    check(t.kites === 6, 'drachen: six kites in the sky');
    await ev(() => VR.Seasons.Fest.debug.drop()); await step(300, 33);
    const f = await ev(() => VR.Seasons.Fest.debug.today());
    check(f.fallen === 1, 'drachen: a kite broke loose and came down');
    check(await ev(() => VR.Seasons.Fest.debug.catchAny()), 'drachen: caught it');
  }
  const act = { bluete: 'blossom', tafel: 'food', lichter: 'lantern' }[id];
  if (act) { for (let k = 0; k < (act === 'lantern' ? 5 : 2); k++) check(await ev((a) => VR.Seasons.Fest.debug.act(a), act), `${id}: [V] ${act}`); }
  await viewAt(id === 'drachen' ? -1 : 1, id === 'drachen' ? 2 : 7, 0.3, id === 'drachen' ? 14 : 1, id === 'drachen' ? 6 : 0);
  await step(30, 33);
  pics[id] = await grab('ss_fest_' + id + '.png');
  said.push(await ev(() => (VR.Quiet && VR.Quiet.debug && VR.Quiet.debug.recent ? VR.Quiet.debug.recent() : null)));
}
sheet.push({ label: 'Blütenreigen: der Tag davor · das Fest', imgs: [pics.bluete_prep, pics.bluete] }, { label: 'Drachenwindtag · Laubtafelfest', imgs: [pics.drachen, pics.tafel] }, { label: 'Lichterbaumnacht: der Tag davor · die Nacht', imgs: [pics.lichter_prep, pics.lichter] });
const seen = await ev(() => VR.Seasons.seen(VR.game.meta));
check(['bluete', 'drachen', 'tafel', 'lichter'].every(id => seen.includes(id)), 'the Wanderbuch knows all four: ' + seen.join(', '));
save();

// ---------------------------------------------------------------- 3 · the other peoples' festivals (their decor on this plaza: the village posing as theirs)
const NAT = ['gezeiten', 'sandstern', 'funkel', 'steinglut', 'eisbluete'], SP = { gezeiten: 'aqua', sandstern: 'ocker', funkel: 'zinn', steinglut: 'basalt', eisbluete: 'opal' };
const natPics = [];
for (const id of NAT) {
  await ev((sp) => { const V = VR.game.villages; const vil = VR.Seasons.Fest.debug.vil(); vil.plan.species = sp; }, SP[id]);
  await setDay(2, 13600); await step(80, 33);
  const t = await ev(() => VR.Seasons.Fest.debug.today());
  check(t.id === id && t.phase === 'fest' && t.deco === 11, `${id}: the ${SP[id]} people's festival (${t.deco}: six bowls and their own five props)`);
  check(await ev(() => VR.Seasons.Fest.debug.act('native')), id + ': [V] celebrate with them');
  await viewAt(1, 6, 0.3, 1);
  natPics.push(await grab('ss_fest_' + id + '.png', 6));
}
await ev(() => { const V = VR.game.villages; const vil = VR.Seasons.Fest.debug.vil(); delete vil.plan.species; });
sheet.push({ label: 'Gezeitenleuchten · Sandsternnacht', imgs: natPics.slice(0, 2) }, { label: 'Funkelreigen · Steinglut', imgs: natPics.slice(2, 4) }, { label: 'Eisblütennacht · das Wanderbuch', imgs: [natPics[4]] });
check((await ev(() => VR.Seasons.seen(VR.game.meta))).length === 9, 'the Wanderbuch: nine festivals');
// the Wanderbuch's page
await ev(() => { VR.Wander.open(VR.game); const c = document.querySelector('#wanderbuch .wdcard'); if (c) c.scrollTop = 1e5; });
const book = await shotDom('ss_wanderbuch.png');
const bookTxt = await ev(() => (document.getElementById('wanderbuch') || {}).innerText || '');
check(/Feste/.test(bookTxt) && /Lichterbaumnacht/.test(bookTxt) && /Gezeitenleuchten/.test(bookTxt), 'the Wanderbuch\'s page „Feste" names them (German)');
sheet[sheet.length - 1].imgs.push(book);
await ev(() => VR.Wander.close(VR.game));
save();

// ---------------------------------------------------------------- 4 · the cost: Very Low and High, seasons off / on (winter, the light night's plaza)
await setDay(11, 13900); await viewAt(1, 7, 0.3, 1);
const cost = {};
for (const preset of ['potato', 'high']) {
  await ev((pr) => { const g = VR.game; g.applyPreset(pr); g.settings.dynRes = false; g.settings.renderDist = 7; g.applySettings('*'); }, preset);
  await settle(12);
  for (const on of [false, false, false, true, true, true]) {
    const r = await ev(([on]) => { const g = VR.game; g.settings.seasons = on; window.__norender = false; for (let i = 0; i < 24; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); const ms = []; let draws = 0; for (let i = 0; i < 16; i++) { const t = performance.now(); g.last = t - 33; g.loop(t); g.renderer.gl.finish(); ms.push(performance.now() - t); draws = g.renderer.stats.draws; } window.__norender = true; ms.sort((a, b) => a - b); return { ms: +ms[8].toFixed(1), draws }; }, [on]);
    (cost[preset + (on ? '_on' : '_off')] || (cost[preset + (on ? '_on' : '_off')] = [])).push(r);
  }
  console.log('  cost ' + preset + ' ' + JSON.stringify(cost));
}
run.cost = cost;
const best = (a) => Math.min(...a.map(x => x.ms));
check(best(cost.potato_on) <= best(cost.potato_off) * 1.1 + 1.5, `Very Low: on ${best(cost.potato_on)} ms, off ${best(cost.potato_off)} ms · High: on ${best(cost.high_on)} ms, off ${best(cost.high_off)} ms`);
save();
fs.writeFileSync(ROOT + '/.tmp_tests/seasons_sheet.json', JSON.stringify({ w: 620, rows: sheet.filter(r => r.imgs.every(Boolean)) }));
try { execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'seasons_sheet.jpg', ROOT + '/.tmp_tests/seasons_sheet.json']); console.log('  📋 test/shots/seasons_sheet.jpg'); } catch (e) { console.log('  !! sheet ' + e.message); }
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 20)) console.log(l);
check(!logs.some(l => /pageerror|Shader|compile|Link failed/i.test(l)), 'no page or shader errors');
await browser.close();
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
