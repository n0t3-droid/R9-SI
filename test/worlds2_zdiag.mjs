// u-worlds in the browser (docs/superpowers/plans/2026-10-31-u-worlds.md): a new Kreativ world (seed 4242), 960 × 540, de-DE,
// Balanced. The 🪐 Welten panel; a Kreativ jump to every world (Aquamarin by the panel's button, then Ocker, Zinnober,
// Basalt, Opal and a world of Ocker's kind under another star); on each: Herzwelt's gravity, the landing's land, the
// first village of its natives (people about), a native up close, its creatures, the spawner; the cost at Ocker's
// village (Very Low / High) → test/shots/world_*.png, test/shots/worlds_rich_sheet.jpg, .tmp_tests/worlds_rich_run.json
//   nohup bash test/wt_run.sh worlds_rich.mjs 3600 > .tmp_tests/worlds_rich.log 2>&1 &   (WORLDS=aqua,ocker · ONLY=cost)
// regress: skip  (u-worlds2: the diagnosis of Zinnober's unshown village columns)
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
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/worlds_rich_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
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
  const url = await ev((frames) => { try { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; } catch (e) { window.__norender = true; return null; } }, frames);
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
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Welten',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.env.setTime(6000); });
await settle(30);
const dim = process.env.DIM || 'zinn', kind = dim.split('.').pop();
const ok = await trip((d) => VR.Travel.go(VR.game, { dim: d, via: 'cmd' }), dim);
console.log('trip', ok, secs());
await ev(() => { const g = VR.game, P = g.pool, o = P.onMsg.bind(P); window.__err = []; P.onMsg = function (w, m) { if (m && m.type === 'error') window.__err.push(String(m.msg).slice(0, 300)); return o(w, m); }; });
await settle(40);
const vid = 'eco:' + kind + ':0';
let V = null;
for (let i = 0; i < 30; i++) { await step(20, 33); V = await ev((vid) => { const vil = VR.game.villages.sites.find(s => s.id === vid); return vil ? { x: vil.x, y: vil.y, z: vil.z } : null; }, vid); if (V) break; await wait(200); }
console.log('village', JSON.stringify(V));
await ev((V) => { const p = VR.game.player; p.flying = true; p.teleport(V.x + 22, V.y + 11, V.z + 20); }, V);
for (let i = 0; i < 90; i++) { await step(10, 33); const ok = await ev((V) => { const w = VR.game.world; for (const dx of [-24, 0, 24]) for (const dz of [-24, 0, 24]) if (!w.isLoaded(V.x + dx, V.z + dz)) return false; return true; }, V); if (ok) break; await wait(300); }
await settle(60);
for (let k = 0; k < 3; k++) {
  await step(60, 33); await wait(500);
  const d = await ev((V) => { const g = VR.game, w = g.world, cx0 = V.x >> 4, cz0 = V.z >> 4, out = { cols: [], unshown: 0 };
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const c = w.col(cx0 + dx, cz0 + dz); if (!c) { out.cols.push([dx, dz, 'none']); continue; } if (c.shownAt >= 0) continue; out.unshown++;
      out.cols.push([dx, dz, { r: c.ready, H: c.H, hold: w.seamHold ? w.seamHold.get(c.key) : null, secs: c.sec.map((s, i) => (s.meshed ? '' : i + ':' + (s.dirty ? 'd' : '') + (s.pending ? 'p' : '') + (s.fails ? 'f' + s.fails : '') + 'c' + s.count + 'v' + s.ver + '/' + s.meshVer)).filter(Boolean).join(' ') }]); }
    const nb = (cx, cz) => { let n = 0; for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) if (w.col(cx + ox, cz + oz)) n++; return n; };
    out.nb = out.cols.filter(c => c[2] !== 'none').map(c => nb(cx0 + c[0], cz0 + c[1]));
    out.pool = { q: g.pool.queue.length, qf: g.pool.queueFar.length, started: g.pool.started.size, infl: w.meshInflight, up: w.uploadQ.items.length, pend: w.pending.size, sqT: w.sqT, sqH: w.sqH, holdN: w.seamHold ? w.seamHold.size : 0, frame: w.frame, rd: w.renderDist, p: g.player.pos.map(Math.round), changed: w.changed ? w.changed.size : -1 };
    out.err = window.__err.slice(0, 5); out.nerr = window.__err.length; return out; }, V);
  console.log('diag ' + k + ' ' + JSON.stringify(d));
}
console.log(logs.slice(0, 12).join('\n'));
await browser.close();
console.log('ALL OK');
