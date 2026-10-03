// streaming profile: how long do gen / mesh / lod jobs take, how long until the render radius and the horizon are
// full, and does the world keep up with a flight? The loop is stepped without rendering (SwiftShader would hog the
// CPU), so the workers are the bottleneck as on a real machine; worker-side job times are reported by the workers.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 900)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 16) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(2); } };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
// hook the pool: per-job-type timing (worker-side ms where reported)
await ev(() => {
  const g = VR.game, P = g.pool;
  const prof = window.__prof = { t: {}, n: {}, wall: {}, sent: new Map(), cancelled: 0 };
  const onMsg = P.onMsg.bind(P);
  P.onMsg = (w, m) => {
    const s = prof.sent.get(m.id);
    if (s) { prof.sent.delete(m.id); const k = s.type; prof.n[k] = (prof.n[k] || 0) + 1; prof.wall[k] = (prof.wall[k] || 0) + performance.now() - s.t0; if (m.ms !== undefined) prof.t[k] = (prof.t[k] || 0) + m.ms; }
    onMsg(w, m);
  };
  for (const w of P.workers) { const pm = w.postMessage.bind(w); w.postMessage = (msg, tr) => { if (msg && msg.id) prof.sent.set(msg.id, { type: msg.type + (msg.level !== undefined ? msg.level : ''), t0: performance.now() }); return pm(msg, tr); }; }
  const nx = P._next.bind(P); P._next = () => { const q = P.queue.length + P.queueFar.length; const j = nx(); const q2 = P.queue.length + P.queueFar.length; prof.cancelled += Math.max(0, (q - q2) - (j ? 1 : 0)); return j; };
});
const preset = process.env.PRESET || 'balanced';
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.applySettings('*'); }, preset);
await ev(() => { window.requestAnimationFrame = () => 0; });
const t0 = Date.now();
await ev((seed) => VR.game.createWorld({ name: 'Prof', mode: 'creative', difficulty: 'peaceful', type: 'default', seed, cheats: true, kit: false }), process.env.SEED || '4242');
for (let i = 0; i < 400; i++) { await step(10); if (await ev(() => VR.game.state) === 'play') break; await wait(20); }
const tPlay = (Date.now() - t0) / 1000;
await ev(() => { VR.game.env.setTime(3000); VR.game.zenFreezeTime = true; });
const stat = () => ev(() => { const g = VR.game, w = g.world, p = window.__prof; const out = { cols: w.cols.size, pend: w.pending.size, busy: g.pool.busy, hz: g.horizon ? g.horizon.tiles.size : 0, hzIn: g.horizon ? g.horizon.inflight : 0, hzCoarse: g.horizon ? +(g.horizon.stats.coarse || 0).toFixed(2) : 0, hzProg: g.horizon ? +g.horizon.progress().toFixed(2) : 0, rd: w.renderDist, cancelled: p.cancelled }; let meshed = 0, dirty = 0, noDetail = 0; const pc = w.center || [0, 0], rd2 = w.renderDist * w.renderDist; for (const c of w.cols.values()) { const inR = (c.cx - pc[0]) ** 2 + (c.cz - pc[1]) ** 2 <= rd2; for (const s of c.sec) { if (s.meshed) meshed++; if (s.dirty && inR) dirty++; if (s.vxDropped) noDetail++; } } out.meshed = meshed; out.dirty = dirty; out.noDetail = noDetail; out.jobs = {}; for (const k in p.n) out.jobs[k] = { n: p.n[k], avgMs: +(p.t[k] ? p.t[k] / p.n[k] : p.wall[k] / p.n[k]).toFixed(1) }; out.gpuMB = +g.renderer.gpuMemoryMB().toFixed(0); out.lanes = g.pool.laneMs.map(v => Math.round(v)); return out; });
const brief = (s) => JSON.stringify({ cols: s.cols, pend: s.pend, busy: s.busy, meshed: s.meshed, dirty: s.dirty, noDet: s.noDetail, hz: s.hz, hzC: s.hzCoarse, hzP: s.hzProg, canc: s.cancelled, gpuMB: s.gpuMB });
console.log('preset', preset, 'workers', await ev(() => VR.game.pool.workers.length), 'play after', tPlay.toFixed(1), 's', brief(await stat()));
// let it stream (stepped at a nominal 60 fps) until the radius and the horizon are full
const tFull0 = Date.now();
let full = null, tRadius = null;
for (let i = 0; i < 600; i++) {
  await step(10); await wait(10);
  const s = await stat();
  if (tRadius === null && s.pend === 0 && s.dirty === 0 && i > 2) { tRadius = (Date.now() - tFull0) / 1000; console.log('  chunk radius full after', tRadius.toFixed(1), 's', brief(s)); }
  if (s.pend === 0 && s.busy === 0 && s.dirty === 0 && s.hzIn === 0 && s.hzProg >= 1 && i > 2) { full = s; break; }
  if (i % 20 === 0) console.log('  t+' + ((Date.now() - tFull0) / 1000).toFixed(1) + 's', brief(s));
}
const sf = full || await stat();
console.log('all full after', ((Date.now() - tFull0) / 1000).toFixed(1), 's', brief(sf));
console.log('jobs', JSON.stringify(sf.jobs), 'lanes', JSON.stringify(sf.lanes));
// a flight: straight ahead at SPEED blocks/s for 20 s of game time (stepped); how far behind does the world fall?
const speed = +(process.env.SPEED || 30);
await ev(() => { const p = VR.game.player; p.flying = true; p.noclip = true; p.pos[1] = Math.max(p.pos[1], 120); });
const tf0 = Date.now();
let worst = 0;
for (let i = 0; i < 20; i++) {
  // real time, one frame at a time (worker replies arrive between frames as in a real session)
  const ts = Date.now();
  for (let k = 0; k < 50; k++) { await ev((sp) => { const g = VR.game, p = g.player; p.pos[0] += sp / 50; g.last = performance.now() - 20; g.loop(performance.now()); }, speed); await wait(12); }
  const left = 1000 - (Date.now() - ts); if (left > 0) await wait(left);
  const s = await stat();
  const behind = await ev(() => { const g = VR.game, w = g.world, p = g.player, rd = w.renderDist; const pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let miss = 0, n = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; n++; const c = w.col(pcx + dx, pcz + dz); if (!c) { miss++; continue; } for (const s of c.sec) if (s.dirty || s.pending) { miss++; break; } } return +(miss / n).toFixed(2); });
  worst = Math.max(worst, behind);
  if (i % 4 === 3) console.log('  fly t+' + (i + 1) + 's  missing in radius ' + Math.round(behind * 100) + '%', brief(s), 'lanes', JSON.stringify(s.lanes));
}
console.log('flight at', speed, 'b/s done in', ((Date.now() - tf0) / 1000).toFixed(1), 's wall; worst missing', Math.round(worst * 100) + '%');
console.log('jobs', JSON.stringify((await stat()).jobs));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 25)) console.log(l);
await browser.close();
