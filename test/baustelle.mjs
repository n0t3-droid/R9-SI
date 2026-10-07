// 🏗 Baustelle in the browser (German UI): „/bau Hochhaus 20 Stockwerke" in a flat creative world → a construction
// site: the scaffold appears, the tower grows over time (its cells in the world rise with the build, many writes,
// 6–20 s), the builders work on the deck, a crane swings loads; the HUD shows „🏗 Hochhaus · n % gebaut ⏩ Fertig";
// the finished blocks are exactly what „Bauen: Sofort" builds of the same plan; one Z takes it back; „⏩ Fertig" (the HUD
// button, a real mouse click) finishes a second build at once; no page error, no GL error. Screenshots at 10 %, 40 %,
// 80 % and done: test/shots/baustelle_1..4.png. Prints what the site costs per frame (main thread).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import http from 'http';
import fs from 'fs';
import path from 'path';
const DIST = '/home/claude/vr/dist', TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };
const srv = http.createServer((q, a) => { if (q.url === '/favicon.ico') { a.writeHead(204); a.end(); return; } const f = path.join(DIST, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'); if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { a.writeHead(404); a.end(); return; } a.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(a); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const URL0 = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 820 }, locale: 'de-DE' });
const logs = [], fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const finish = async () => { console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 14)) console.log(l); check(!logs.some(l => /pageerror/.test(l)), 'no page errors'); await browser.close(); srv.close(); console.log(fails.length ? 'FAILED ' + fails.length : 'ALL OK'); process.exit(fails.length ? 1 : 0); };
const crashed = async (e) => { console.log('✗ crashed: ' + String(e && e.stack || e).slice(0, 900)); fails.push('crash'); try { await finish(); } catch (e2) { process.exit(1); } };
process.on('unhandledRejection', crashed); process.on('uncaughtException', crashed);
const game = await ctx.newPage();
game.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
game.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) logs.push('[console] ' + m.text().slice(0, 300)); });
await game.goto(URL0 + '/index.html');
const ev = (fn, a) => game.evaluate(fn, a);
// frames of the game loop at 33 ms (no drawing unless asked: swiftshader is slow), as forge.mjs does
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await game.waitForTimeout(5); } };
const settle = async (max = 90) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && i > 3) break; await game.waitForTimeout(60); } };
for (let i = 0; i < 120; i++) { await game.waitForTimeout(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.horizon = 1; g.applySettings('*'); });
check(await ev(() => VR.game.settings.bau) === 'site', 'Balanced builds as a construction site (Bauen: Baustelle)');
check(await ev(() => { const g = VR.game, s = g.settings.bau; g.applyPreset('potato'); const v = g.settings.bau; g.applyPreset('balanced'); return v === 'instant' && s === 'site'; }), 'Very Low builds at once (Bauen: Sofort)');
await ev(`VR.game.createWorld({name:'Baustellenwelt',mode:'creative',difficulty:'peaceful',type:'flat',seed:'20261008',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await game.waitForTimeout(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.env.setTime(4600); const p = g.player; p.flying = false; p.yaw = 0; p.pitch = -0.16; });
await settle(90);
const P0 = await ev(() => VR.game.player.pos.map(v => +v.toFixed(2)));
// ---- /bau Hochhaus 20 Stockwerke, looking at the ground ten blocks ahead
const box = { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0 };
await ev(() => { window.__chat = []; const ui = VR.game.ui, o = ui.chatLine.bind(ui); ui.chatLine = (t, c) => { window.__chat.push(t); return o(t, c); }; });
await ev(() => VR.game.chat('/bau Hochhaus 20 Stockwerke'));
const chat0 = await ev(() => window.__chat.join(' | '));
check(/Hochhaus/.test(chat0) && /wird gebaut/.test(chat0), 'the Forge takes the wish (German): ' + chat0.slice(0, 120));
// instrument: the site's costs per frame (main thread)
await ev(() => { const B = VR.game.gadgets.blue, M = window.__ms = { tick: [], write: [], draw: [] }; for (const [k, f] of [['tick', 'siteTick'], ['write', 'tickSlices'], ['draw', 'drawSites']]) { const o = B[f]; B[f] = function (...a) { const t = performance.now(); const r = o.apply(this, a); M[k].push(performance.now() - t); return r; }; } });
// wait for the piece (the worker builds it from the DNA) and the site
let st = null;
for (let i = 0; i < 120 && !(st && st.on); i++) { await step(2); st = await ev(() => { const B = VR.game.gadgets.blue, S = B.slices; return S ? { on: true, n: S.list.length, show: !!S.show, kind: S.kind } : { on: false }; }); }
check(st && st.on && st.show && st.kind === 'plan', 'a construction site starts (' + JSON.stringify(st) + ')');
const plan = await ev(() => { const B = VR.game.gadgets.blue, S = B.slices, pl = S.pl, o = S.o, sh = S.show; return { id: pl.id, dna: pl.dna, ox: pl.ox, oz: pl.oz, F: pl.F, r: pl.r, sbox: o.sbox, H: o.H, Te: +S.Te.toFixed(2), Tb: +S.Tb.toFixed(2), cells: S.list.length, crane: !!sh.crane, crew: sh.crew.length, scaffold: sh.scaffold, bays: sh.inst ? sh.inst.bays.length / 4 : 0 }; });
console.log('site', JSON.stringify(plan));
Object.assign(box, { x0: plan.sbox[0] - 8, x1: plan.sbox[3] + 8, z0: plan.sbox[2] - 8, z1: plan.sbox[5] + 8, y0: plan.F - 12, y1: plan.sbox[4] + 4 });
check(plan.scaffold && plan.bays > 100 && plan.crane && plan.crew === 3, 'the scaffold appears (' + plan.bays + ' bays), a crane for the tower, three builders');
// what stands in the box (the structure's cells counted; a hash of every cell)
const measure = () => ev((b) => { const w = VR.game.world; let h = 2166136261 >>> 0, n = 0; for (let y = b.y0; y <= b.y1; y++) for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) { const s = w.getBlock(x, y, z); if (s && y >= b.F) n++; h = Math.imul(h ^ (s & 0xffff), 16777619) >>> 0; } return { h, n }; }, Object.assign({ F: plan.F }, box));
// ---- the screenshots: a camera that frames what stands (and the crane), the HUD's bar on top; the build waits meanwhile
let shot = 0;
async function photo(label) {
  shot++;
  // (the build and the show hold still while the camera moves and the meshes catch up: the picture is of this moment)
  await ev(() => { const g = VR.game, B = g.gadgets.blue, S = B.slices; if (S && !S.__frozen) { S.__frozen = true; S.write = function () { }; } if (!window.__fz) { window.__fz = { tick: B.siteTick, pu: g.particles.update }; B.siteTick = function () { }; g.particles.update = function (dt, eye) { return window.__fz.pu.call(this, 0, eye); }; } });
  const cam = await ev(([pl]) => {
    const g = VR.game, p = g.player, B = g.gadgets.blue, site = (B.sites || [])[0], sh = site && site.show;
    const front = sh ? Math.max(8, sh.deck + 3) : pl.H; const sb = pl.sbox;
    const cx = (sb[0] + sb[3] + 1) / 2, cz = (sb[2] + sb[5] + 1) / 2, top = pl.F + front + (sh && sh.crane ? 8 : 2);
    const d = Math.min(100, Math.max(26, (top - pl.F) * 0.95 + 8)), ang = -0.62;   // from the front left (the player's side), a little from above
    const dx = Math.sin(ang), dz = Math.cos(ang);
    p.flying = true; p.noclip = true; p.teleport(cx + dx * d, pl.F + (top - pl.F) * 0.42 + 3, cz + dz * d);
    p.yaw = Math.atan2(-(cx - p.pos[0]), -(cz - p.pos[2])); p.pitch = Math.atan2(pl.F + (top - pl.F) * 0.45 - (p.pos[1] + 1.6), d) ;
    return { d: Math.round(d), y: Math.round(p.pos[1]) };
  }, [plan]);
  await settle(50); await step(4);
  await ev(() => { window.__norender = false; const g = VR.game; const h = document.getElementById('hud'); if (h) h.style.visibility = 'hidden'; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__glErr = g.renderer.gl.getError(); window.__norender = true; });
  const file = '/home/claude/vr/test/shots/baustelle_' + shot + '.png';
  await game.screenshot({ path: file, timeout: 180000 });
  await ev(() => { const g = VR.game, B = g.gadgets.blue, h = document.getElementById('hud'); if (h) h.style.visibility = ''; const S = B.slices; if (S && S.__frozen) { delete S.write; delete S.__frozen; } if (window.__fz) { B.siteTick = window.__fz.tick; g.particles.update = window.__fz.pu; delete window.__fz; } });
  const gl = await ev(() => window.__glErr);
  console.log('  📷 ' + file + ' · ' + label + ' · camera ' + JSON.stringify(cam) + ' · gl error ' + gl);
  return gl;
}
// ---- the build: progress over time, the world grows, the deck rises; photos at 10 / 40 / 80 %
const t0 = await ev(() => VR.game.time);
const samples = [], targets = [0.1, 0.4, 0.8];
let glErr = 0, hud = null;
for (let i = 0; i < 1400; i++) {
  await step(3);
  const s = await ev(() => { const g = VR.game, B = g.gadgets.blue, S = B.slices, sh = S && S.show; const el = document.getElementById('bauhud'); return S ? { p: S.at / S.list.length, t: g.time, deck: sh ? +sh.deck.toFixed(2) : -1, crew: sh ? sh.crew.filter(b => b.state === 'work').length : 0, crane: sh && sh.crane ? sh.crane.st : '', hud: el && el.style.display !== 'none' ? el.textContent : null } : { p: 1, t: g.time, done: true }; });
  if (s.hud && !hud) hud = s.hud;
  if (!s.done && (samples.length === 0 || s.p - samples[samples.length - 1].p > 0.05)) { const m = await measure(); samples.push(Object.assign(s, { n: m.n })); }
  if (targets.length && s.p >= targets[0] && !s.done) { targets.shift(); glErr |= await photo(Math.round(s.p * 100) + ' % gebaut'); }
  if (s.done) break;
}
const t1 = await ev(() => VR.game.time), status = await ev((id) => JSON.parse(localStorage.getItem('r9si.plans.' + VR.game.meta.id)).plans.find(p => p.id === id).status, plan.id);
console.log('samples', JSON.stringify(samples.map(s => [+(s.p * 100).toFixed(0), s.n, s.deck, s.crew, s.crane])));
check(status === 'built', 'the tower is built (plan ' + status + ', ' + (t1 - t0).toFixed(1) + ' s of game time)');
check(t1 - t0 >= 6 && t1 - t0 <= 22, 'it took 6–20 s of game time (' + (t1 - t0).toFixed(1) + ' s)');
const grow = samples.length >= 8 && samples.every((s, i) => !i || s.n >= samples[i - 1].n) && samples[samples.length - 1].n > samples[0].n * 4;
check(grow, 'the world grows over time: ' + samples.map(s => s.n).join(' → '));
check(samples.some(s => s.crew > 0) && samples.some(s => /lower|toDrop|lift|down/.test(s.crane)), 'builders hammer on the deck, the crane hauls');
check(!!hud && /Hochhaus/.test(hud) && /gebaut/.test(hud) && /Fertig/.test(hud), 'the HUD: ' + hud);
// the finale: confetti in the air, the builders cheer — the done photo
await step(30);
glErr |= await photo('fertig');
check(!glErr, 'no GL error while drawing the site');
const finale = await ev(() => { const g = VR.game, B = g.gadgets.blue, sh = B.sites && B.sites[0] && B.sites[0].show; return { confetti: g.particles.n, cheer: sh ? sh.crew.filter(b => b.state === 'cheer' || b.mode === 'cheer').length : -1 }; });
check(finale.confetti > 50, 'confetti and fireworks fly (' + finale.confetti + ' particles)');
const MB = await measure();
// one Z takes all of it back
await ev(() => VR.game.gadgets.undo());
const M0 = await measure();
check(M0.n < MB.n / 20, 'one Z takes the whole tower back (' + MB.n + ' → ' + M0.n + ' cells over the floor)');
// the same plan with Bauen: Sofort — the same blocks
await step(220);
const sofort = async (mode, skip) => {
  await ev(([pl, mode, id]) => { const g = VR.game, B = g.gadgets.blue; g.settings.bau = mode; const q = Object.assign({}, B.plans.find(p => p.id === pl.id), { id, status: 'pending', t: Date.now() }); B.plans.push(q); B.storePlans((ps) => ps.concat([q])); B.planT = 0; }, [plan, mode, 'cmp-' + mode + (skip ? '-skip' : '')]);
  let clicked = false;
  for (let i = 0; i < 400; i++) {
    await step(2);
    const s = await ev((id) => { const B = VR.game.gadgets.blue, q = B.plans.find(p => p.id === id), S = B.slices; return { st: q.status, p: S ? S.at / S.list.length : -1 }; }, 'cmp-' + mode + (skip ? '-skip' : ''));
    if (skip && !clicked && s.p > 0.15) {
      // ⏩ Fertig: the HUD's button, a real click
      const vis = await ev(() => { const el = document.getElementById('bauhud'); return !!el && el.style.display !== 'none'; });
      await game.click('#bauhud .bh-skip', { timeout: 5000 }); clicked = vis ? 'visible' : 'hidden';
      await step(1);
      const after = await ev((id) => VR.game.gadgets.blue.plans.find(p => p.id === id).status, 'cmp-' + mode + '-skip');
      check(after === 'built', '⏩ Fertig (clicked at ' + Math.round(s.p * 100) + ' %, button ' + clicked + '): built at once (' + after + ')');
    }
    if (s.st === 'built') break;
  }
  return measure();
};
const MS = await sofort('instant');
check(MS.h === MB.h && MS.n === MB.n, 'Bauen: Sofort builds exactly the same blocks (' + MS.n + ' cells, hash ' + MS.h.toString(16) + ' = ' + MB.h.toString(16) + ')');
await ev(() => VR.game.gadgets.undo()); await step(10);
const MK = await sofort('site', true);
check(MK.h === MB.h, 'the skipped construction site ends with the same blocks (hash ' + MK.h.toString(16) + ')');
// costs on the main thread while it built (ms per frame)
const ms = await ev(() => { const M = window.__ms, st = (a) => { if (!a.length) return [0, 0]; const s = a.slice().sort((x, y) => x - y); return [+(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3), +s[Math.floor(s.length * 0.99)].toFixed(2), +s[s.length - 1].toFixed(2)]; }; return { tick: st(M.tick), write: st(M.write), draw: st(M.draw), n: M.tick.length }; });
console.log('main thread per frame [mean, p99, max] ms: ' + JSON.stringify(ms));
check(ms.tick[0] < 1.5 && ms.write[0] < 4, 'the site is cheap per frame (show ' + ms.tick[0] + ' ms, writes ' + ms.write[0] + ' ms on average)');
await finish();
