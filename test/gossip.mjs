// u-gossip in the browser (docs/superpowers/plans/2026-11-02-u-gossip.md): a new default world (seed 4242, Kreativ,
// Friedlich), 960 × 540, de-DE, Balanced, your name „Mila".
//   1 · an outpost freed (VR.Liberate's own moment when one is known near you, else the deed through the test API with
//       an outpost's name) → the stream holds it; the city beside it saw it at once
//   2 · three days later in a far village (500–900 m): a stranger greets you by it (gossip_greet.png), once — standing
//       there longer brings no repeat; the neighbours / children may pass it on
//   3 · Palmenhafen by day (gossip_city_day.png) and by night (gossip_city_night.png): people near the plaza, movers
//   4 · the frame at the plaza: Very Low and High, the townsfolk there / removed (ms); the record's round trip
//   → test/shots/gossip_sheet.jpg, .tmp_tests/gossip_run.json
//   nohup bash test/wt_run.sh gossip.mjs 3600 > .tmp_tests/gossip.log 2>&1 &
// regress: skip  (a showcase with pictures; the gate is test/gossip.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '').replace(/\/\.tmp_tests$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html';
const SHOTS = ROOT + '/test/shots/';
const SEED = process.env.SEED || '4242';
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + ' (' + secs() + ')'); };
const run = { seed: SEED };
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/gossip_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|gossip/i.test(s)) logs.push(`[${t}] ${s.slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto(DIST);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(3); } };
const settle = async (max = 40) => {
  for (let i = 0; i < max; i++) {
    await step(20, 16);
    const s = await ev(() => { const g = VR.game, w = g.world; return { busy: g.pool.busy, pend: w.pending.size, up: w.uploadQ ? w.uploadQ.size : 0 }; });
    if (s.busy === 0 && s.pend === 0 && s.up === 0 && i > 2) break;
    await wait(30);
  }
};
const pics = {};
const grab = async (key, name, frames = 4) => {
  const url = await ev((frames) => { try { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; } catch (e) { window.__norender = true; return null; } }, frames);
  if (url && url.length > 2000) { fs.writeFileSync(SHOTS + name, Buffer.from(url.split(',')[1], 'base64')); console.log('  📷 ' + name); pics[key] = SHOTS + name; return SHOTS + name; }
  console.log('  !! no picture ' + name); return null;
};
const shotDom = async (key, name) => { try { await ev(() => { window.__norender = false; const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); window.__norender = true; }); await page.screenshot({ path: SHOTS + name, timeout: 120000 }); console.log('  📷 ' + name); pics[key] = SHOTS + name; return SHOTS + name; } catch (e) { console.log('  !! ' + e.message); return null; } };
const stand = (P, look) => ev(([P, L]) => { const p = VR.game.player; p.flying = true; p.teleport(P[0], P[1], P[2]); p.vel = [0, 0, 0]; const e = [P[0], P[1] + 1.6, P[2]], dx = L[0] - e[0], dy = L[1] - e[1], dz = L[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw; }, [P, look]);


for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.playerName = 'Mila'; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Gerede',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:false})`);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world');
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeWeather = true; g.zenFreezeTime = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(3000); });
await settle(20); await step(60, 33);
// ---------------------------------------------------------------- 1 · an outpost freed
const free = await ev(() => {
  const g = VR.game, L = VR.Liberate, p = g.player.pos;
  let s = null; try { for (const q of L.sites().values()) if (q.st !== 'frei' && (!s || Math.hypot(q.x - p[0], q.z - p[2]) < Math.hypot(s.x - p[0], s.z - p[2]))) s = q; } catch (e) { s = null; }
  if (s && Math.hypot(s.x - p[0], s.z - p[2]) < 400) { g.player.teleport(s.x + 6, (s.y || 80) + 2, s.z + 6); const ok = L.free(g, s); return { real: ok, id: s.id, x: s.x, z: s.z }; }
  const d = VR.Gossip.test.deed('freed', { x: p[0], z: p[2], pl: L.nameOf({ id: 't-out' }), key: 't-out' });
  return { real: false, id: 't-out', x: p[0], z: p[2], deed: !!d };
});
if (free.real) for (let i = 0; i < 40; i++) { await step(10, 50); if (await ev(() => !VR.Liberate.moment)) break; }
const st1 = await ev(() => { const r = VR.Gossip.test.rec(); return { deeds: r.deeds.map(d => [d.k, d.pl, Math.round(d.x), Math.round(d.z)]), day: VR.game.env.day || 0 }; });
run.free = free; run.st1 = st1;
check(st1.deeds.some(d => d[0] === 'freed'), `the outpost freed (${free.real ? 'its own moment' : 'the test API'}): the stream holds ${JSON.stringify(st1.deeds)}`);
// ---------------------------------------------------------------- 2 · a far village, three days later
const tgt = await ev((F) => {
  const V = VR.game.villages; let best = null;
  for (const s of V.sites) { const d = Math.hypot(s.x - F.x, s.z - F.z); if (d > 480 && d < 950 && (!best || Math.abs(d - 700) < Math.abs(best.d - 700))) best = { id: s.id, x: s.x, y: s.y, z: s.z, d: Math.round(d), name: s.name }; }
  return best;
}, free);
check(!!tgt, 'a far village: ' + JSON.stringify(tgt));
if (tgt) {
  await ev((d) => { const g = VR.game; g.env.day = d + 3; g.env.setTime(3200); }, st1.day);
  await stand([tgt.x + 0.5, (tgt.y || 80) + 30, tgt.z + 0.5], [tgt.x, tgt.y || 80, tgt.z - 10]);
  for (let i = 0; i < 14; i++) { await settle(6); await step(20, 33); if (await ev((id) => { const v = VR.game.villages.known.get(id); return !!(v && v.active && v.agents.length); }, tgt.id)) break; }
  const heardAt = await ev((id) => { const G = VR.Gossip, g = VR.game, v = g.villages.known.get(id), r = G.test.rec(), d = r.deeds.find(q => q.k === 'freed'); if (!v || !d) return null; return { at: (G.heardAt(d, { id: 'overworld/' + id, x: v.plan.x, z: v.plan.z, dim: 'overworld' }) - d.t) / G.DAY, name: v.name, people: v.agents.length }; }, tgt.id);
  run.heard = heardAt;
  check(heardAt && heardAt.at < 3 && heardAt.people > 0, `the news reached ${heardAt && heardAt.name} after ${heardAt && heardAt.at.toFixed(2)} days (${heardAt && heardAt.people} people there)`);
  // stand beside a stranger
  const who = await ev(() => {
    const g = VR.game, V = g.villages; VR.Gossip.test.cool();
    const a = V.agents.find(x => !x.kid && x.pose !== 'sleep' && x.onGround !== false && !(x.act && x.act.type === 'work' && x.pose === 'sit')) || V.agents.find(x => !x.kid);
    if (!a) return null;
    g.player.flying = false; g.player.teleport(a.pos[0] + 1.6, a.pos[1] + 0.2, a.pos[2] + 1.6);
    const p = g.player, e = [p.pos[0], p.pos[1] + 1.6, p.pos[2]]; p.yaw = Math.atan2(-(a.pos[0] - e[0]), -(a.pos[2] - e[2])); p.pitch = -0.12; p.viewYaw = p.yaw;
    window.__gsWho = a; return a.name;
  });
  let greet = null;
  for (let i = 0; i < 8 && !greet; i++) { await step(10, 33); greet = await ev(() => VR.Gossip.test.log().find(l => l.what === 'greet' || l.what === 'ref') || null); }
  if (greet) { await ev(() => { const a = window.__gsWho, p = VR.game.player, gl = VR.Gossip.log; const L = gl.find(l => l.what === 'greet' || l.what === 'ref'); let b = null; for (const q of VR.game.villages.agents) if (q.p.id === L.who) b = q; if (b) { const e = [p.pos[0], p.pos[1] + 1.6, p.pos[2]]; p.yaw = Math.atan2(-(b.pos[0] - e[0]), -(b.pos[2] - e[2])); p.viewYaw = p.yaw; if (b.bubble) b.bubble.t = 4; } void a; }); await shotDom('greet', 'gossip_greet.png'); }
  run.greet = greet;
  check(!!greet && /Leuchtfeuer|Mila/.test(greet.text), `a stranger (${who}) greets you by it: „${greet && greet.text}“`);
  // longer there: no repeat by the same person
  for (let i = 0; i < 6; i++) { await ev(() => VR.Gossip.test.cool()); await step(20, 33); }
  const L2 = await ev(() => VR.Gossip.test.log());
  run.log2 = L2.map(l => [l.what, l.who, l.text]);
  const byWho = {}; for (const l of L2) if (l.what === 'greet') byWho[l.who] = (byWho[l.who] || 0) + 1;
  check(Object.values(byWho).every(n => n === 1), `no repeats: ${L2.length} lines, ${JSON.stringify(byWho)} (${L2.map(l => l.what).join(', ')})`);
}
// ---------------------------------------------------------------- 3 · Palmenhafen by day and night
const city = await ev(() => { const V = VR.game.villages; for (const v of V.known.values()) if (v.plan.nova) return { id: v.id }; const s = V.sites.find(q => Math.hypot(q.x, q.z + 140) < 20); return s ? { id: s.id } : null; });
const PZ = [0.5, 81, -49.5];
await ev(() => { const g = VR.game; g.env.setTime(3600); });
await stand([PZ[0] + 2, PZ[1] + 1, PZ[2] + 14], [PZ[0], PZ[1] + 1.5, PZ[2] - 20]);
await ev(() => { VR.game.player.flying = false; });
for (let i = 0; i < 12; i++) { await settle(6); await step(20, 33); if (await ev(() => { for (const v of VR.game.villages.known.values()) if (v.plan.nova && v.active) return true; return false; })) break; }
const census = async () => ev(() => {
  const g = VR.game, V = g.villages, p = g.player.pos; let vil = null; for (const v of V.known.values()) if (v.plan.nova) vil = v; if (!vil) return null;
  const near = vil.agents.filter(a => Math.hypot(a.pos[0] - p[0], a.pos[2] - p[2]) < 45 && a.pose !== 'sleep');
  return { all: vil.agents.length, town: (vil.town || []).length, near: near.length, pos: near.map(a => [a.pos[0], a.pos[2]]), acts: near.map(a => (a.act && a.act.type) || '-').join(','), drawn: vil.agents.filter(a => a.drawn).length };
});
for (let i = 0; i < 12; i++) await step(20, 33);   // ≈ 8 s of their walk
const c1 = await census(); for (let i = 0; i < 9; i++) await step(20, 33); const c2 = await census();
const movers = (a, b) => { if (!a || !b) return 0; let n = 0; for (const q of a.pos) { const m = Math.min(...b.pos.map(r => Math.hypot(r[0] - q[0], r[1] - q[1])), 99); if (m > 0.6 && m < 99) n++; } return n; };
run.city = { id: city && city.id, c1, c2 };
check(c1 && c1.town >= 10 && c1.near >= 3, `Palmenhafen by day: ${c1 && c1.all} people (${c1 && c1.town} townsfolk), ${c1 && c1.near} within 45 m of you (${c1 && c1.acts})`);
check(movers(c1, c2) >= 2, `they move: ${movers(c1, c2)} of ${c1 && c1.near} walked on in 6 s`);
await stand([PZ[0] + 3, PZ[1] + 3.5, PZ[2] + 20], [PZ[0], PZ[1] + 1.2, PZ[2] - 14]);
await step(6, 33);
await shotDom('day', 'gossip_city_day.png');
await grab('day3d', 'gossip_city_day_3d.png', 6);
await ev(() => { VR.game.env.setTime(14200); });
await stand([PZ[0] + 2, PZ[1] + 1, PZ[2] + 14], [PZ[0], PZ[1] + 1.5, PZ[2] - 20]); await ev(() => { VR.game.player.flying = false; });
for (let i = 0; i < 16; i++) await step(20, 33);
const cn = await census();
run.city.night = cn;
check(cn && cn.near >= 1 && /stroll/.test(cn.acts), `Palmenhafen by night: ${cn && cn.near} out within 45 m (${cn && cn.acts})`);
await stand([PZ[0] + 3, PZ[1] + 3.5, PZ[2] + 20], [PZ[0], PZ[1] + 1.2, PZ[2] - 14]);
await step(6, 33);
await shotDom('night', 'gossip_city_night.png');
// ---------------------------------------------------------------- 4 · the cost at the plaza by day; the record
await ev(() => { VR.game.env.setTime(3600); });
const cost = {};
const pull = (on) => ev((on) => { const V = VR.game.villages; let vil = null; for (const v of V.known.values()) if (v.plan.nova) vil = v; if (!vil || !vil.active) return 0;
  if (!on) { window.__gsTown = vil.agents.filter(a => a.p.town); for (const a of window.__gsTown) { vil.agents.splice(vil.agents.indexOf(a), 1); V.agents.splice(V.agents.indexOf(a), 1); } return window.__gsTown.length; }
  const L = window.__gsTown || []; for (const a of L) { vil.agents.push(a); V.agents.push(a); } window.__gsTown = null; return L.length; }, on);
for (const preset of ['potato', 'high']) {
  await ev((pr) => { const g = VR.game; g.applyPreset(pr); g.settings.dynRes = false; g.settings.renderDist = 6; g.applySettings('*'); }, preset);
  await settle(10);
  for (const on of [false, true, false, true, false, true]) {
    await pull(on);
    const r = await ev(() => { const g = VR.game; window.__norender = false; for (let i = 0; i < 4; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); const ms = []; for (let i = 0; i < 12; i++) { const t = performance.now(); g.last = t - 33; g.loop(t); g.renderer.gl.finish(); ms.push(performance.now() - t); } window.__norender = true; ms.sort((a, b) => a - b); return +ms[6].toFixed(1); });
    (cost[preset + (on ? '_on' : '_off')] || (cost[preset + (on ? '_on' : '_off')] = [])).push(r);
  }
}
const mn = (a) => Math.min(...a);
run.cost = cost; run.gscost = await ev(() => VR.Gossip.cost);
console.log('  cost ' + JSON.stringify(cost) + ' gossip ' + JSON.stringify(run.gscost));
check(mn(cost.potato_on) <= mn(cost.potato_off) * 1.15 + 2, `Very Low: townsfolk there ${mn(cost.potato_on)} ms, removed ${mn(cost.potato_off)} ms (High ${mn(cost.high_on)} / ${mn(cost.high_off)} ms)`);
const rt = await ev(() => { const g = VR.game, G = VR.Gossip, a = JSON.stringify(g.meta.gossip), b = JSON.stringify(G.save(G.load(JSON.parse(a)))); return { same: a === b, bytes: a.length }; });
check(rt.same, `the save record round-trips (${rt.bytes} bytes)`);
check(!logs.some(l => /pageerror|gossip|citylife/.test(l)), 'no page error' + (logs.length ? ': ' + logs.slice(0, 4).join(' · ') : ''));
save();
const row = (label, ks) => ({ label, imgs: ks.map(k => pics[k]).filter(Boolean) });
const rows = [row('Drei Tage später, ein fernes Dorf: eine Fremde grüßt dich nach deiner Tat', ['greet']), row('Palmenhafen am Tag: Händler, Spaziergänger, Kinder am Platz', ['day', 'day3d']), row('Palmenhafen in der Nacht: Nachtschwärmer auf den beleuchteten Wegen', ['night'])].filter(r => r.imgs.length);
if (rows.length) { fs.writeFileSync(ROOT + '/.tmp_tests/gossip_sheet.json', JSON.stringify({ w: 620, rows })); try { console.log('  ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'gossip_sheet.jpg', ROOT + '/.tmp_tests/gossip_sheet.json']).toString().trim()); } catch (e) { console.log('  !! sheet ' + e.message); } }
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
