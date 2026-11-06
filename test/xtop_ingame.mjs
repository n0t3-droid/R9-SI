// x-top (docs/superpowers/plans/2026-11-06-x-top.md): the game's look in NORMAL PLAY, not the trailer — the player's own
// first-person eye (no photo mode, no director), 1280 × 720, de-DE, seed 4242, a Kreativ world, Balanced and High
// (dynRes off, renderDist 8), each view with x-top's switches off (the picture as before) and on:
//   meadow   the spawn meadow at eye height, afternoon, the sun to the side
//   street   a village street at eye height, late afternoon (the director's group frame, brought down to the eye)
//   forest   at the wood's edge at eye height, noon
//   water    the shore over open water, afternoon
//   person   a villager close up (the villages held still while the pictures are made)
// "on" at Balanced: BAL_ON (default Tiefe 1; Klarheit needs High's soft copy); at High: the preset's defaults.
// costs: ms a drawn frame at the meadow, Very Low / Balanced / High, off and on in turns, and the full-screen passes.
// → test/shots/xt_<view>_<preset>_<cfg>_<TAG>.png, test/shots/top_compare.jpg (TAG=after) · .tmp_tests/xtop_ingame_<TAG>.json
// usage: nohup bash test/wt_run.sh xtop_ingame.mjs 3600 > .tmp_tests/xtop_ingame.log 2>&1 &   TAG · ONLY=meadow,…,cost · PRESETS=balanced,high
// regress: skip  (a showcase: the pictures are the evidence; the gate is test/xtop.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '').replace(/\/\.tmp_tests$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html', SHOTS = ROOT + '/test/shots/';
const TAG = process.env.TAG || 'after';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, want = (s) => !ONLY || ONLY.includes(s);
const PRESETS = (process.env.PRESETS || 'balanced,high').split(',');
const BAL_ON = process.env.BAL_ON ? JSON.parse(process.env.BAL_ON) : null;   // (null: the preset's own defaults)
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + ' (' + secs() + ')'); };
const N = { tag: TAG, pics: {}, cams: {}, cost: {}, q: {} };
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/xtop_ingame_' + TAG + '.json', JSON.stringify(N, null, 1)); } catch (e) { /* */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log('  !! the page crashed'); });
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const run = async (n, dtms = 33) => {
  for (let k = 0; k < n; k += 30) await ev(([m, d]) => {
    const g = VR.game;
    if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
    window.__norender = true;
    for (let i = 0; i < m; i++) { g.last = performance.now() - d; window.__step(performance.now()); }
  }, [Math.min(30, n - k), dtms]);
};
const settle = async (max = 60) => {
  let s = null;
  for (let i = 0; i < max; i++) {
    await run(20);
    s = await ev(() => { const g = VR.game, w = g.world, p = g.player; if (!w || !p || g.state !== 'play') return { state: g.state }; const rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if (sc.dirty || sc.pending) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= rd * rd) dirty += n; } return { state: g.state, busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0 }; });
    if (s.state === 'play' && s.busy === 0 && s.pend === 0 && s.dirty === 0 && s.up === 0 && i > 2) break;
    await wait(40);
  }
  return s;
};
// x-top's switches: off (the picture as before) or on (the preset's defaults; Balanced: BAL_ON when given)
const config = (c) => ev(([c, balOn]) => {
  const g = VR.game, r = g.renderer, X = VR.XTop; if (!X || !X.SW) return 'none';
  const pr = g.settings.preset, d = pr === 'balanced' && balOn ? Object.assign(X.off(), balOn) : X.defaults(pr), q = {};
  for (const k of X.SW) q[k] = c === 'on' ? d[k] : X.off()[k];
  r.setQuality(q);
  return X.SW.map(k => k + '=' + r.q[k]).join(',');
}, [c, BAL_ON]);
const preset = (p) => ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.wowMoments = false; g.applySettings('*'); }, p);
const grab = async (name, tod, K = 4) => {
  const url = await ev(([tod, K]) => { const g = VR.game; g.env.setTime(tod); for (let i = 0; i < 2; i++) { g.env.anim = 499; if (g.envFor) g.envFor(g.player.eyePos(), 1, { freezeTime: true, freezeWeather: true }); } window.__norender = false; for (let i = 0; i < K; i++) { g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; window.__step(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; }, [tod, K]);
  if (!url || url.length < 2000) { check(false, 'a picture ' + name); return null; }
  const f = SHOTS + 'xt_' + name + '_' + TAG + '.png'; fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
  N.pics[name] = f; save(); console.log('     📷 ' + name + ' (' + secs() + ')'); return f;
};
// the player's own eye at E (eye position) looking at T
const eyeAt = (E, T, tod) => ev(([E, T, tod]) => {
  const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(E[0], E[1] - 1.62, E[2]); p.vel[0] = p.vel[1] = p.vel[2] = 0;
  const dx = T[0] - E[0], dy = T[1] - E[1], dz = T[2] - E[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); g.env.setTime(tod);
}, [E, T, tod]);
const top = (x, z) => ev(([x, z]) => VR.game.world.topAt(Math.floor(x), Math.floor(z)), [x, z]);
// every preset's off/on of one view (the camera set again after a preset change: the world streams anew)
const views = async (view, E, T, tod, hold) => {
  for (const pr of PRESETS) {
    await preset(pr); await eyeAt(E, T, tod); await settle(40); await run(hold ? 2 : 20);
    for (const c of ['off', 'on']) { N.q[pr + '_' + c] = await config(c); await eyeAt(E, T, tod); await run(2); await grab(view + '_' + pr + '_' + c, tod); }
  }
};

try {
  await page.goto(DIST);
  for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title')) break; }
  await preset(PRESETS[0]);
  await ev(() => { if (VR.Hints) for (const h of ['play', 'move', 'fly', 'bauhand', 'bhring', 'bhundo', 'bhchange']) VR.Hints.done(h); });
  await ev(`VR.game.createWorld({name:'Spitzenbild',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
  for (let i = 0; i < 200; i++) { await wait(500); if (await ev(() => VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)) break; }
  check(await ev(() => VR.game.state) === 'play', 'the world is open');
  await ev(() => {
    const g = VR.game, L0 = Object.getPrototypeOf(g).loop;
    window.__step = (t) => L0.call(g, t); g.loop = function (t) { if (window.__live) return L0.call(this, t); };
    g.zenFreezeWeather = true; g.zenFreezeTime = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar');
    if (VR.UI && VR.UI.hideHud) VR.UI.hideHud(true);
  });
  await settle(80);
  const S0 = await ev(() => { const p = VR.game.player.pos; return [p[0], p[1], p[2]]; });
  N.spawn = S0;

  // ---------------------------------------------------------------- the spawn meadow, afternoon, the sun to the side
  if (want('meadow') || want('cost')) {
    const AFT = 8200;
    await ev((t) => VR.game.env.setTime(t), AFT); await run(2);
    const sun = await ev(() => VR.game.env.E.sunDir.slice());
    const a = Math.atan2(sun[2], sun[0]) + 1.3, y = (await top(S0[0], S0[2])) + 1 + 1.62;
    const E = [S0[0], y, S0[2]], T = [S0[0] + Math.cos(a) * 40, y - 3, S0[2] + Math.sin(a) * 40];
    N.cams.meadow = { E, T };
    if (want('meadow')) await views('meadow', E, T, AFT);
    if (want('cost')) {
      const ms = (n) => ev((n) => { const g = VR.game, gl = g.renderer.gl; window.__norender = false; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; window.__step(performance.now()); } gl.finish(); const t0 = performance.now(); for (let i = 0; i < n; i++) { g.last = performance.now() - 33; window.__step(performance.now()); gl.finish(); } window.__norender = true; return (performance.now() - t0) / n; }, n);
      for (const pr of ['potato', 'balanced', 'high']) {
        await preset(pr); await eyeAt(E, T, AFT); await settle(25);
        const r = { off: [], on: [] };
        for (const c of ['off', 'on', 'on', 'off', 'off', 'on']) { await config(c); r[c].push(await ms(6)); }
        r.passes = {};
        for (const c of ['off', 'on']) { await config(c); r.passes[c] = await ev(() => { const g = VR.game, rr = g.renderer; rr.passLog = true; window.__norender = false; g.last = performance.now() - 33; window.__step(performance.now()); window.__norender = true; rr.passLog = false; const L = rr.stats.fsList || []; return { n: L.length, rdMB: +(L.reduce((a, x) => a + (x.rd || 0), 0) / 1e6).toFixed(1), list: L.map(x => x.name + ' ' + x.w + 'x' + x.h).join(', ') }; }); }
        const med = (a) => { const s = a.slice().sort((x, y) => x - y); return +s[s.length >> 1].toFixed(1); };
        N.cost[pr] = { off: med(r.off), on: med(r.on), passes: r.passes };
        console.log('     cost ' + pr + ' ' + JSON.stringify({ off: N.cost[pr].off, on: N.cost[pr].on, nOff: r.passes.off.n, nOn: r.passes.on.n }) + ' (' + secs() + ')'); save();
        if (pr !== 'high') check(r.passes.off.n === r.passes.on.n, pr + ': the same full-screen passes with x-top on (' + r.passes.on.n + ')');
      }
    }
  }

  // ---------------------------------------------------------------- the nearest village: a street and a person
  const v = (want('street') || want('person')) ? await ev((S0) => { const M = VR.game.villages; let best = null, bd = 1e9; for (const v of M.known.values()) { const P = v.plan && v.plan.plaza; const c = P ? [P.x, P.z] : [v.x, v.z]; if (c[0] === undefined) continue; const d = Math.hypot(c[0] - S0[0], c[1] - S0[2]); if (d < bd) { bd = d; best = { c, d } } } return best; }, S0) : null;
  if (v) {
    await preset(PRESETS[0]); await eyeAt([v.c[0], 140, v.c[1]], [v.c[0] + 10, 130, v.c[1]], 8000); await settle(40); await run(60);
    if (want('street')) {
      const LATE = 9600;
      const f = await ev(([c]) => { const g = VR.game, F3 = VR.Folk3, y = g.world.topAt(Math.floor(c[0]), Math.floor(c[1])) + 1; const C = [c[0] + 0.5, y, c[1] + 0.5]; const fr = F3 && F3.frameGroup ? F3.frameGroup(F3.solidW(g.world), C, 6, { sun: F3.sunAngle ? F3.sunAngle(g) : null }) : null; return fr ? { P: fr.P, T: [C[0], y + 1.2, C[2]] } : { P: [C[0] + 12, y, C[2] + 5], T: [C[0], y + 1.2, C[2]] }; }, [v.c]);
      const D = [f.P[0] - f.T[0], f.P[2] - f.T[2]], L = Math.hypot(D[0], D[1]) || 1, back = Math.max(12, L * 1.6);
      const E = [f.T[0] + D[0] / L * back, 0, f.T[2] + D[1] / L * back]; E[1] = (await top(E[0], E[2])) + 1 + 1.62;
      N.cams.street = { E, T: f.T };
      await views('street', E, [f.T[0], E[1] - 0.6, f.T[2]], LATE);
    }
    if (want('person')) {
      const LATE = 9000;
      await ev(() => { const V = VR.game.villages; if (!V._xUpd) { V._xUpd = V.update; } V.update = function () {}; });
      const a = await ev((c) => { const V = VR.game.villages; let best = null, bd = 1e9; for (const a of V.agents) { if (a.pose === 'sleep') continue; const d = Math.hypot(a.pos[0] - c[0], a.pos[2] - c[1]); if (d < bd) { bd = d; best = a; } } return best ? [best.pos[0], best.pos[1], best.pos[2]] : null; }, v.c);
      if (a) {
        const sun = await ev(() => VR.game.env.E.sunDir.slice()), ang = Math.atan2(sun[2], sun[0]) + 0.7;
        const E = [a[0] + Math.cos(ang) * 2.6, a[1] + 1.55, a[2] + Math.sin(ang) * 2.6], T = [a[0], a[1] + 1.1, a[2]];
        N.cams.person = { E, T };
        await views('person', E, T, LATE, true);
      } else check(false, 'a villager');
      await ev(() => { const V = VR.game.villages; if (V._xUpd) V.update = V._xUpd; });
    }
  } else if (want('street') || want('person')) check(false, 'a village known');

  // ---------------------------------------------------------------- the forest's edge, noon
  if (want('forest')) {
    const NOON = 6000;
    const findWood = (S0) => ev((S0) => { const g = VR.game, w = g.world, R = VR.R, F = VR.F; let best = null, bn = 0;
      for (let gx = -112; gx <= 112; gx += 16) for (let gz = -112; gz <= 112; gz += 16) { const x0 = Math.floor(S0[0] + gx), z0 = Math.floor(S0[2] + gz); if (!w.isLoaded(x0, z0)) continue; let n = 0; for (let dx = 0; dx < 16; dx += 2) for (let dz = 0; dz < 16; dz += 2) { const y = w.topAt(x0 + dx, z0 + dz); const s = w.getBlock(x0 + dx, y, z0 + dz); if (s && (R.T.flags[s] & F.LEAVES)) n++; } if (n > bn) { bn = n; best = [x0 + 8, z0 + 8]; } }
      return best ? { c: best, n: bn } : null; }, S0);
    let F = null;
    for (const [ox, oz] of [[0, 0], [-200, 0], [200, 0], [0, 200], [0, -200]]) {
      const c0 = [S0[0] + ox, S0[1], S0[2] + oz];
      if (ox || oz) { await eyeAt([c0[0], 150, c0[2]], [c0[0] + 10, 140, c0[2]], NOON); await settle(40); }
      const f = await findWood(c0); if (f && (!F || f.n > F.n)) F = f; if (F && F.n >= 36) break;
    }
    console.log('     forest ' + JSON.stringify(F));
    if (F) {
      await eyeAt([F.c[0], 140, F.c[1]], [F.c[0] + 10, 130, F.c[1]], NOON); await settle(40);
      const sun = await ev(() => VR.game.env.E.sunDir.slice()), a = Math.atan2(sun[2], sun[0]) + 0.6;
      const E = [F.c[0] + Math.cos(a) * 20, 0, F.c[1] + Math.sin(a) * 20]; E[1] = (await top(E[0], E[2])) + 1 + 1.62;
      const T = [F.c[0], E[1] + 2, F.c[1]];
      N.cams.forest = { E, T };
      await views('forest', E, T, NOON);
    } else check(false, 'a wood near the spawn');
  }

  // ---------------------------------------------------------------- the water: a shore over open water, afternoon
  if (want('water')) {
    const AFT = 8800;
    const findCoast = (S0) => ev((S0) => { const g = VR.game, w = g.world, R = VR.R, F = VR.F; const wet = (x, z) => { const y = w.topAt(x, z), s = w.getBlock(x, y, z); return s && (R.T.flags[s] & F.FLUID) ? 1 : 0; };
      let best = null, bs = 0;
      for (let gx = -120; gx <= 120; gx += 8) for (let gz = -120; gz <= 120; gz += 8) { const x = Math.floor(S0[0] + gx), z = Math.floor(S0[2] + gz); if (!w.isLoaded(x, z) || wet(x, z)) continue;
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; let n = 0; for (let d = 4; d <= 40; d += 4) n += wet(Math.floor(x + Math.cos(a) * d), Math.floor(z + Math.sin(a) * d)); if (n >= 8 && wet(Math.floor(x + Math.cos(a) * 3), Math.floor(z + Math.sin(a) * 3))) { const sc = n * 10 - Math.hypot(gx, gz) * 0.05; if (sc > bs) { bs = sc; best = { x: x + 0.5, z: z + 0.5, a }; } } } }
      return best; }, S0);
    let C = null;
    for (const [ox, oz] of [[0, 0], [240, 0], [0, 240], [-240, 0], [0, -240]]) {
      const c0 = [S0[0] + ox, S0[1], S0[2] + oz];
      if (ox || oz) { await eyeAt([c0[0], 150, c0[2]], [c0[0] + 10, 140, c0[2]], AFT); await settle(40); }
      C = await findCoast(c0); if (C) break;
    }
    console.log('     water ' + JSON.stringify(C));
    if (C) {
      const y = (await top(C.x, C.z)) + 1;
      const E = [C.x - Math.cos(C.a) * 3, 0, C.z - Math.sin(C.a) * 3]; E[1] = Math.max(y, (await top(E[0], E[2])) + 1) + 1.62;
      const T = [C.x + Math.cos(C.a + 0.35) * 40, y - 2, C.z + Math.sin(C.a + 0.35) * 40];
      N.cams.water = { E, T };
      await views('water', E, T, AFT);
    } else check(false, 'a coast near the spawn');
  }
  save();
  // ---------------------------------------------------------------- the sheet
  const VN = [['meadow', 'Wiese am Spawn · Nachmittag'], ['street', 'Dorfstraße · später Nachmittag'], ['forest', 'Waldrand · Mittag'], ['water', 'Ufer und Wasser · Nachmittag'], ['person', 'Dorfbewohner aus der Nähe']];
  const PN = { balanced: 'Ausgewogen', high: 'Hoch', ultra: 'Ultra' };
  const rows = [];
  for (const [v, lab] of VN) for (const pr of PRESETS) { const imgs = ['off', 'on'].map(c => N.pics[v + '_' + pr + '_' + c]).filter(Boolean); if (imgs.length) rows.push({ label: lab + ' — ' + (PN[pr] || pr) + ': vorher | nachher', imgs }); }
  if (rows.length) {
    const spec = ROOT + '/.tmp_tests/xtop_sheet_' + TAG + '.json'; fs.writeFileSync(spec, JSON.stringify({ w: 620, rows }));
    try { console.log('     ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + (TAG === 'after' ? 'top_compare.jpg' : 'top_compare_' + TAG + '.jpg'), spec]).toString().trim()); } catch (e) { console.log('  !! sheet ' + e.message.slice(0, 200)); }
  }
} catch (e) { fails++; console.log('  ✗ ' + (e.stack || e.message).slice(0, 1200)); }
const errs = logs.filter(l => l.startsWith('[pageerror]'));
check(errs.length === 0, 'no page error' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
save();
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
