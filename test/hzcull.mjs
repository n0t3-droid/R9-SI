// Horizontschatten in the real game (a headless browser, SwiftShader): from a valley, a walker's spot and the town of
// the owner's world (seed 3616214791, Fliederfeld), the picture with the culling is the picture without it — pixel for
// pixel (beyond the frames' own noise: the same frame drawn twice) — while fewer sections and triangles are drawn.
// Very Low (potato) and Balanced. The world is frozen as in the golden shots (clock, weather, animals, people, craft).
//   nohup bash test/wt_run.sh hzcull.mjs 1500 > .tmp_tests/hzcull.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import fs from 'fs';
import { createRequire } from 'module';
const ROOT = new URL('../', import.meta.url).pathname;
const require = createRequire(import.meta.url);
const G = require(ROOT + 'test/golden_wait.js');
const W = 480, H = 270, OUT = ROOT + 'test/shots/';
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-background-timer-throttling'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, locale: 'de-DE' });
await page.addInitScript(() => { let a = 0x9e3779b9; Math.random = function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; });
await page.addInitScript(() => { const iv = setInterval(() => { const g = window.VR && window.VR.game; if (g && g.state === 'title') { clearInterval(iv); g.createWorld({ name: 'Horizont', mode: 'creative', difficulty: 'peaceful', seed: 3616214791 }); } }, 200); });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
await page.goto('file://' + ROOT + 'dist/index.html', { waitUntil: 'commit', timeout: 120000 });
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
let started = false;
for (let i = 0; i < 400; i++) { await wait(500); if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'play')).catch(() => false)) { started = true; break; } }
check(started, 'the world started');
// (golden.mjs's stepping: the clock frozen, the game stepped by hand, drawn only for the pictures)
const step = async (n, dt = 33) => { for (let k = 0; k < n; k += 20) await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(20, n - k), dt]); };
const settle = async (max = 60) => {
  let s = null;
  for (let i = 0; i < max; i++) {
    await step(20, 16);
    s = await ev(() => { const g = VR.game, w = g.world, p = g.player; if (!w || !p || g.state !== 'play') return { state: g.state }; const rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if (sc.dirty || sc.pending) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= rd * rd) dirty += n; } return { state: g.state, busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, lod: g.horizon ? g.horizon.inflight || 0 : 0 }; });
    if (G.settledOk(s, i)) { s.ok = true; break; }
    await wait(30);
  }
  return s;
};
const lookFrom = (P, T) => ev(([P, T]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(P[0], P[1] - (p.eye || 1.62), P[2]); p.vel[0] = p.vel[1] = p.vel[2] = 0; const e = p.eyePos(), dx = T[0] - e[0], dy = T[1] - e[1], dz = T[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw; }, [P, T]);
const freeze = () => ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.rain = 0; g.env.rainTarget = 0; g.hideHud = true; g.camMode = 0; });
const preset = (p, rd) => ev(([p, rd]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = rd; g.settings.particles = false; g.applySettings('*'); }, [p, rd]);
// a frame's picture (the moving things not drawn, as in golden.mjs) and the renderer's counts; hz: the culling on or off
const grab = (hz) => ev((hz) => {
  const g = VR.game, r = g.renderer, E = g.entities, V = g.villages, keep = [E && E.draw, E && E.drawTranslucent, V && V.draw];
  const mov = [[g, 'starships'], [g, 'traffic'], [g, 'padLife'], [g, 'lifeDirector'], [g, 'wild'], [g.hall || {}, 'flight'], [g, 'trails']].map(([o, k]) => o[k] && o[k].draw ? [o[k], o[k].draw] : null).filter(Boolean);
  for (const m of mov) m[0].draw = () => {};
  const P = g.particles, spawn0 = P && P.spawn;
  try {
    if (E) { E.draw = () => {}; if (E.drawTranslucent) E.drawTranslucent = () => {}; } if (V) V.draw = () => {};
    g.env.anim = 600; g.env.cloudDrift = [540, 0];
    if (P) { P.n = 0; P.count = 0; P.spawn = () => -1; }
    r.q.hzCull = hz; VR.HzGame.prev = null; VR.HzGame.speed = 0;
    window.__norender = false;
    let tris = 0, hid = 0, of = 0;
    for (let i = 0; i < 10; i++) { g.last = performance.now() - 33; r.stats.tris = 0; g.loop(performance.now()); tris = r.stats.tris; hid = VR.HzGame.stats.hidden; of = VR.HzGame.stats.of; if (P) { P.n = 0; P.count = 0; } }
    return { png: r.gl.canvas.toDataURL('image/png'), tris, hid: hz ? hid : 0, of, off: VR.HzGame.stats.off, occ: VR.HzGame.stats.occ, ms: VR.HzGame.stats.ms, delta: VR.HzGame.stats.delta };
  } finally { window.__norender = true; r.q.hzCull = true; if (E) { E.draw = keep[0]; if (keep[1]) E.drawTranslucent = keep[1]; } if (V) V.draw = keep[2]; if (P) P.spawn = spawn0; for (const m of mov) m[0].draw = m[1]; }
}, hz);
const raw = async (b64) => (await sharp(Buffer.from(b64.split(',')[1], 'base64')).removeAlpha().raw().toBuffer({ resolveWithObject: true }));
const diff = (a, b) => { let n = 0, big = 0; for (let i = 0; i < a.data.length; i += 3) { const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]); if (d > 6) n++; if (d > 60) big++; } return { n, big }; };

if (started) {
  await freeze();
  // the spots (found in node with the same generator, the lab's way: test/hzcull.js's scene): three where much lies behind
  // hills near Fliederfeld, looking toward the town; and the town itself
  // (all within a few hundred blocks of each other: a long teleport leaves the streaming's look-ahead far away for a while)
  const views = [
    ['valley', [562.5, 69.62, -1359.5], [294, 70, -1044]],
    ['lowland', [450.5, 69.62, -1285.5], [294, 70, -1044]],
    ['slope', [708.5, 131.62, -1389.5], [500, 90, -1300]],
    ['town', [294.5, 0, -1043.5], [340, 0, -1000]],
  ];
  for (const [name, P, T] of views) {
    for (const pr of [['potato', 6], ['balanced', 6]]) {
      await preset(pr[0], pr[1]); await freeze();
      if (name === 'town') { await lookFrom([294.5, 160, -1043.5], [300, 100, -1040]); await step(30, 16); for (let k = 0; k < 40; k++) { if (await ev(() => VR.game.world.isLoaded(294, -1044))) break; await step(10, 16); } const y = await ev(() => { const w = VR.game.world, c = w.col(294 >> 4, -1044 >> 4); return c && c.ready ? c.height[((-1044 & 15) << 4) | (294 & 15)] : 80; }); P[1] = y + 2.62; T[1] = y + 2; }
      await lookFrom(P, T);
      // settled (golden.mjs's rule) with the game running by itself (its drawn frames upload the meshes), however long
      // it takes on a loaded machine (up to 4 minutes)
      await ev(() => { window.__norender = false; });
      const t0 = Date.now(); let s = null, n = 0;
      while (Date.now() - t0 < 240000) {
        await wait(2000);
        s = await ev(() => { const g = VR.game, w = g.world, p = g.player; const rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let k = 0; for (const sc of c.sec) if (sc.dirty || sc.pending) k++; const ex = c.cx - pcx, ez = c.cz - pcz; if (k && ex * ex + ez * ez <= rd * rd) dirty += k; } return { state: g.state, busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, lod: g.horizon ? g.horizon.inflight || 0 : 0 }; });
        if (G.settledOk(s, n++)) { s.ok = true; break; }
      }
      if (!(s && s.ok)) console.log('    (not settled: ' + JSON.stringify(s) + ')');
      await wait(3000);   // (the columns' fade-in done)
      // the eye stands: the speed the teleport left behind forgotten (the slack δ would follow it)
      await ev(() => { VR.HzGame.prev = null; VR.HzGame.speed = 0; VR.HzGame.last = null; });
      await step(10, 33);
      const a = await grab(true), b = await grab(false), a2 = await grab(true);
      const A = await raw(a.png), B = await raw(b.png), A2 = await raw(a2.png);
      const noise = diff(A, A2), d = diff(A, B);
      fs.writeFileSync(OUT + `hz_${pr[0]}_${name}_on.png`, Buffer.from(a.png.split(',')[1], 'base64'));
      fs.writeFileSync(OUT + `hz_${pr[0]}_${name}_off.png`, Buffer.from(b.png.split(',')[1], 'base64'));
      const saved = b.tris ? 1 - a.tris / b.tris : 0;
      console.log(`  · ${pr[0]} ${name}: settled ${!!(s && s.ok)}; ${a.hid}/${a.of} sections hidden${a.off ? ' (off: ' + a.off + ')' : ''}, ${a.occ} occluders, δ ${a.delta && a.delta.toFixed(2)}, cull ${a.ms && a.ms.toFixed(2)} ms; triangles ${b.tris} → ${a.tris} (−${(saved * 100).toFixed(1)} %); pixels differing: on/off ${d.n} (big ${d.big}), on/on ${noise.n} (big ${noise.big})`);
      check(d.big <= noise.big + 2 && d.n <= noise.n + Math.max(20, noise.n * 0.5), `${pr[0]} ${name}: the same picture with and without (beyond the frames' own noise)`, `${d.n}/${d.big} vs ${noise.n}/${noise.big}`);
      if (name !== 'town') check(a.tris <= b.tris, `${pr[0]} ${name}: never more triangles`);
      views.find((v) => v[0] === name).saved = (views.find((v) => v[0] === name).saved || []).concat([saved]);
    }
  }
  const any = views.some((v) => (v.saved || []).some((x) => x > 0.03));
  check(any, 'somewhere the culling saves more than 3 % of the triangles');
}
check(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '));
await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
