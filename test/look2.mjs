// v-look2 (docs/superpowers/plans/2026-11-01-v-look2.md): the Filmblick at night and on the other worlds, the calm
// meadow, the wrap into the sun — eight views, 1280 × 720, de-DE, High (dynRes off), seed 4242, a Kreativ world, each
// 'before' (v-look as merged: lvTone and lvMeadow off) and 'after' (the preset's defaults) in the same run:
//   meadow   a Herzwelt meadow at night from the spawn
//   fairy    a fairy place at night, framed by the camera director (VR.Folk3.frameGroup on the site's middle)
//   village  a village's plaza at night (the director's group frame, pulled back)
//   ridge    a ridge with its crowns against the low sun (into the light: the wrap)
//   aqua     Aquamarin by day · ocker  Ocker by day · zinn  Zinnober at night · cafe  the Ringstation's café
// costs: ms a drawn frame at the ridge view, Very Low and High, before / after alternated (A B B A A B); the passes
// → test/shots/lv2_<view>_<cfg>_<TAG>.png, test/shots/look2_sheet.jpg, .tmp_tests/look2_<TAG>.json
// usage: nohup bash test/wt_run.sh look2.mjs 3600 > .tmp_tests/look2.log 2>&1 &   TAG=run1 · ONLY=meadow,…,cost
// regress: skip  (a showcase: the pictures are the evidence; the gate is test/look2.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '').replace(/\/\.tmp_tests$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html', SHOTS = ROOT + '/test/shots/';
const TAG = process.env.TAG || 'after', PRESET = process.env.PRESET || 'high';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, want = (s) => !ONLY || ONLY.includes(s);
const CONFIGS = ['before', 'after'];
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + ' (' + secs() + ')'); };
const N = { tag: TAG, pics: {}, cams: {}, cost: {} };
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/look2_' + TAG + '.json', JSON.stringify(N, null, 1)); } catch (e) { /* */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
page.on('console', m => { if (m.type() === 'error' && /shader|program|GLSL|compile/i.test(m.text())) logs.push('[pageerror] ' + m.text().slice(0, 600)); });
page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log('  !! the page crashed'); });
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const run = async (n, dtms = 33) => {
  for (let k = 0; k < n; k += 30) {
    await ev(([m, d]) => {
      const g = VR.game;
      if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
      window.__norender = true;
      for (let i = 0; i < m; i++) { g.last = performance.now() - d; window.__step(performance.now()); }
    }, [Math.min(30, n - k), dtms]);
  }
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
// before: v-look as merged (its four on by the preset, the two new off); after: the preset's defaults
const config = (c) => ev((c) => {
  const g = VR.game, r = g.renderer, L = VR.Look, d = L.defaults(g.settings.preset), q = {};
  for (const k of L.SW) q[k] = c === 'before' && (k === 'lvTone' || k === 'lvMeadow') ? false : d[k];
  r.setQuality(q);
  return L.SW.map(k => k + '=' + (r.q[k] ? 1 : 0)).join(',');
}, c);
const preset = (p) => ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.wowMoments = false; g.applySettings('*'); }, p);
const grab = async (name, tod, K = 4) => {
  const url = await ev(([tod, K]) => { const g = VR.game; if (tod !== null) { g.env.setTime(tod); for (let i = 0; i < 2; i++) { g.env.anim = 499; if (g.envFor) g.envFor(g.player.eyePos(), 1, { freezeTime: true, freezeWeather: true }); } } window.__norender = false; for (let i = 0; i < K; i++) { if (tod !== null) { g.env.setTime(tod); if (g.photoCam && g.photoCam.on) g.photoCam.held = tod; } g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; window.__step(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; }, [tod, K]);
  if (!url || url.length < 2000) { check(false, 'a picture ' + name); return null; }
  const f = SHOTS + 'lv2_' + name + '_' + TAG + '.png'; fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
  N.pics[name] = f; save(); console.log('     📷 ' + name + ' (' + secs() + ')'); return f;
};
const camAt = async (P, T, tod) => {
  await ev(([P, T, tod]) => {
    const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(P[0], P[1] - 1.62, P[2]); p.vel[0] = p.vel[1] = p.vel[2] = 0;
    if (!g.photoCam || !g.photoCam.on) g.photoMode(true);
    const pc = g.photoCam, s = pc.s; pc.first = false; pc.held = tod; if (tod !== null) g.env.setTime(tod);
    const dx = T[0] - P[0], dy = T[1] - P[1], dz = T[2] - P[2];
    s.x = P[0]; s.y = P[1]; s.z = P[2]; s.yaw = Math.atan2(-dx, -dz); s.pitch = Math.atan2(dy, Math.hypot(dx, dz)); s.roll = 0; s.vel[0] = s.vel[1] = s.vel[2] = 0;
  }, [P, T, tod]);
};
const shots = async (view, tod) => { for (const c of CONFIGS) { N.q = await config(c); await run(4); await grab(view + '_' + c, tod); } await config('after'); };
const photoOff = () => ev(() => { const g = VR.game; if (g.photoCam && g.photoCam.on) g.photoMode(false); });
const top = (x, z) => ev(([x, z]) => VR.game.world.topAt(Math.floor(x), Math.floor(z)), [x, z]);
const NIGHT = 18000, GOLD = 11300;
// the director's frame round C (feet), pulled back k times along its line and raised
const director = async (C, r, k, up) => {
  const f = await ev(([C, r]) => { const g = VR.game, F3 = VR.Folk3; const fr = F3 && F3.frameGroup(F3.solidW(g.world), C, r, {}); return fr ? fr.P : null; }, [C, r]);
  const T = [C[0], C[1] + 1.6, C[2]];
  if (!f) return { P: [C[0] + 12, C[1] + 5, C[2] + 6], T, dir: false };
  const D = [f[0] - T[0], f[2] - T[2]], L = Math.hypot(D[0], D[1]) || 1, back = Math.max(10, L * k);
  const P = [T[0] + D[0] / L * back, f[1] + up, T[2] + D[1] / L * back];
  P[1] = Math.max(P[1], (await top(P[0], P[2])) + 2.4);
  return { P, T, dir: true };
};
const travel = async (dim) => {
  await photoOff();
  await ev((d) => { window.__lastTrip = VR.Travel.last; VR.Travel.go(VR.game, { dim: d, via: 'cmd' }); }, dim);
  for (let i = 0; i < 900; i++) { await run(10); const st = await ev((d) => { const g = VR.game, L = VR.Travel.last; return g.dim === d && g.state === 'play' && !!(L && L !== window.__lastTrip && L.to === d); }, dim); if (st) { await settle(50); return true; } await wait(20); }
  return false;
};
// a time on this world: the sun at about el (sin) up, or the night (night: true)
const pickTime = (o) => ev(async (o) => { const g = VR.game; let best = null, bs = 1e9; for (let t = 0; t < 24000; t += 1000) { g.env.setTime(t); g.last = performance.now() - 33; window.__step(performance.now()); const E = g.env.E; const sc = o.night ? -(E.night || 0) * 10 + Math.max(0, E.sunDir[1]) : Math.abs(E.sunDir[1] - o.el) + (E.night > 0.3 ? 5 : 0); if (sc < bs) { bs = sc; best = t; } } return best; }, o);
// natural ground: a grass (or leaves, dirt, stone, snow) top
const meadowAt = (S0, o) => ev(([S0, o]) => { const g = VR.game, w = g.world, R = VR.R; const nm = (x, z) => { const y = w.topAt(x, z), s = w.getBlock(x, y, z); return { y, n: s ? R.types[R.T.type[s]].name : '' }; };
  let best = null, bd = 1e9;
  for (let gx = -128; gx <= 128; gx += 8) for (let gz = -128; gz <= 128; gz += 8) { const x = Math.floor(S0[0] + gx), z = Math.floor(S0[2] + gz), d = Math.hypot(gx, gz); if (d < 16 || d > bd || !w.isLoaded(x, z)) continue;
    const c = nm(x, z); if (!/grass/.test(c.n)) continue; let ok = true;
    for (let dx = -3; dx <= 3 && ok; dx++) for (let dz = -3; dz <= 3 && ok; dz++) { const q = nm(x + dx, z + dz); if (!/grass/.test(q.n) || Math.abs(q.y - c.y) > 2) ok = false; }
    if (ok) { bd = d; best = [x + 0.5, z + 0.5]; } }
  return best; }, [S0, o || {}]);
const natural = (x, z) => ev(([x, z]) => { const g = VR.game, w = g.world, R = VR.R, y = w.topAt(Math.floor(x), Math.floor(z)), s = w.getBlock(Math.floor(x), y, Math.floor(z)); const n = s ? R.types[R.T.type[s]].name : ''; return /grass|leaves|dirt|stone|snow|sand|moss|podzol|log/.test(n) && !/brick|slab|stairs|polished|smooth|tile|vx_/.test(n); }, [x, z]);
const sunNow = () => ev(() => VR.game.env.E.sunDir.slice());

try {
  await page.goto(DIST);
  for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title')) break; }
  await preset(PRESET);
  await ev(() => { if (VR.Hints) for (const h of ['play', 'move', 'fly', 'bauhand', 'bhring', 'bhundo', 'bhchange']) VR.Hints.done(h); });
  await ev(`VR.game.createWorld({name:'Filmblick2',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
  for (let i = 0; i < 200; i++) { await wait(500); if (await ev(() => VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)) break; }
  check(await ev(() => VR.game.state) === 'play', 'the world is open');
  await ev(() => {
    const g = VR.game, L0 = Object.getPrototypeOf(g).loop;
    window.__step = (t) => L0.call(g, t); g.loop = function (t) { if (window.__live) return L0.call(this, t); };
    g.zenFreezeWeather = true; g.zenFreezeTime = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar');
  });
  console.log('after: ' + await config('after'));
  await settle(80);
  const S0 = await ev(() => { const p = VR.game.player.pos; return [p[0], p[1], p[2]]; });
  N.spawn = S0;

  // ---------------------------------------------------------------- a meadow at night
  if (want('meadow')) {
    await ev((t) => VR.game.env.setTime(t), NIGHT); await run(2);
    // (run 1: the spawn stands on a city roof — the nearest open grass instead: 7 × 7 grass tops within 2 m of height)
    const G = await meadowAt(S0);
    console.log('     meadow ' + JSON.stringify(G));
    const C = G || [S0[0], S0[2]];
    const m = await ev(() => VR.game.env.E.moonDir.slice()), a = Math.atan2(m[2], m[0]) + 0.6, y = (await top(C[0], C[1])) + 1 + 1.9;
    const P = [C[0], y, C[1]], T = [C[0] + Math.cos(a) * 60, y - 5, C[1] + Math.sin(a) * 60];
    await camAt(P, T, NIGHT); await settle(40);
    N.cams.meadow = { P, T }; await shots('meadow', NIGHT);
  }
  // ---------------------------------------------------------------- the ridge into the low sun (and the costs there)
  if (want('ridge') || want('cost')) {
    await photoOff(); await ev((t) => VR.game.env.setTime(t), GOLD); await run(2);
    const sun = await sunNow(), a = Math.atan2(sun[2], sun[0]);
    // the highest ground 40 … 140 m toward the sun (a little left and right too), the eye 40 m before it and lower
    let R = null;
    // (run 1: the highest 'ridge' was the city's tower — natural tops only, from a meadow away from the city)
    const G = (await meadowAt(S0)) || [S0[0], S0[2]];
    for (const da of [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9]) for (let d = 30; d <= 130; d += 10) { const x = G[0] + Math.cos(a + da) * d, z = G[1] + Math.sin(a + da) * d, h = await top(x, z); if ((!R || h > R.h) && await natural(x, z)) R = { x, z, h, d, da }; }
    if (!R) R = { x: G[0] + Math.cos(a) * 60, z: G[1] + Math.sin(a) * 60, h: (await top(G[0], G[1])) + 10, d: 60, da: 0 };
    const ex = R.x - Math.cos(a + R.da) * Math.min(45, R.d), ez = R.z - Math.sin(a + R.da) * Math.min(45, R.d), eh = await top(ex, ez);
    const P = [ex, eh + 1 + 1.7, ez], T = [R.x, Math.max(R.h + 3, eh + 6), R.z];
    console.log('     ridge ' + JSON.stringify({ R, P }));
    await camAt(P, T, GOLD); await settle(40);
    N.cams.ridge = { P, T };
    if (want('ridge')) await shots('ridge', GOLD);
    if (want('cost')) {
      const ms = (n) => ev((n) => { const g = VR.game, gl = g.renderer.gl; window.__norender = false; for (let i = 0; i < 8; i++) { g.last = performance.now() - 33; window.__step(performance.now()); } gl.finish(); const t0 = performance.now(); for (let i = 0; i < n; i++) { g.last = performance.now() - 33; window.__step(performance.now()); gl.finish(); } window.__norender = true; return (performance.now() - t0) / n; }, n);
      const passes = () => ev(() => { const g = VR.game, rr = g.renderer; rr.passLog = true; window.__norender = false; g.last = performance.now() - 33; window.__step(performance.now()); window.__norender = true; rr.passLog = false; const L = rr.stats.fsList || []; return { n: L.length, rdMB: +(L.reduce((a, x) => a + (x.rd || 0), 0) / 1e6).toFixed(1), list: L.map(x => x.name + ' ' + x.w + 'x' + x.h).join(', ') }; });
      for (const pr of ['potato', 'high']) {
        await preset(pr); await camAt(P, T, GOLD); await settle(25);
        const r = { before: [], after: [] };
        // (run 1: a shared machine — single samples from 3.7 to 32 ms: ten alternations (A B B A …), 8 frames after 8
        // warm-up frames each (the rebuilt programs compiled), min and median)
        for (let i = 0; i < 10; i++) { const c = (i % 4 === 0 || i % 4 === 3) ? 'before' : 'after'; await config(c); await run(2); r[c].push(await ms(8)); }
        r.passes = {}; for (const c of CONFIGS) { await config(c); r.passes[c] = await passes(); }
        r.prog = await ev(() => { const P = VR.game.renderer.P; return { comp: P.composite && P.composite.key || null, n: Object.keys(P).length }; });
        const med = (a) => { const s = a.slice().sort((x, y) => x - y); return +((s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2).toFixed(1); };
        const mn = (a) => +Math.min(...a).toFixed(1);
        N.cost[pr] = { before: med(r.before), after: med(r.after), minBefore: mn(r.before), minAfter: mn(r.after), all: r };
        console.log('     cost ' + pr + ' ' + JSON.stringify({ before: N.cost[pr].before, after: N.cost[pr].after, min: [N.cost[pr].minBefore, N.cost[pr].minAfter], passes: { before: r.passes.before.n, after: r.passes.after.n, rdMB: [r.passes.before.rdMB, r.passes.after.rdMB] } }) + ' (' + secs() + ')'); save();
      }
      const P0 = N.cost.potato.all.passes; check(JSON.stringify(P0.before) === JSON.stringify(P0.after), 'Very Low: the same passes and bytes after (' + P0.after.n + ' passes)');
      check(await ev(() => { const L = VR.Look, d = L.defaults('potato'); return !d.lvTone && !d.lvMeadow; }), 'Very Low: neither new switch');
      await preset(PRESET); await config('after');
    }
  }
  // ---------------------------------------------------------------- a fairy place at night (the director's frame)
  if (want('fairy')) {
    let s = null; await photoOff();
    for (const kind of ['shroom', 'circle', 'spring', 'tree', 'garden']) {
      for (let i = 0; i < 12; i++) {
        s = (await ev(() => VR.Fairy && VR.Fairy.debug ? VR.Fairy.debug.sites() : [])).find(x => x.kind === kind);
        if (!s) break;
        if (s.y !== null && await ev(() => VR.Fairy.debug.near()) === s.id) break;
        await ev((s) => { const p = VR.game.player; p.flying = true; p.teleport(s.x + 0.5, 150, s.z + 0.5); }, s); await settle(8); await run(20);
      }
      if (s && s.y !== null) { N.fairyKind = kind; break; }
    }
    console.log('     fairy ' + JSON.stringify(s && { kind: s.kind, x: s.x, y: s.y, z: s.z }));
    if (s && s.y !== null) {
      await camAt([s.x + 0.5, s.y + 30, s.z + 0.5], [s.x + 6, s.y, s.z], NIGHT); await settle(30); await run(30);
      // (run 1: pulled back 1.7× the camera stood behind a giant mushroom's cap — the farthest pull-back with a clear line)
      let f = null;
      for (const k of [1.6, 1.3, 1.0]) { f = await director([s.x + 0.5, s.y, s.z + 0.5], 3.5, k, 1.5); const clear = await ev(([P, T]) => { const F3 = VR.Folk3, so = F3.solidW(VR.game.world); return F3.lineFirst(so, T, P) === Infinity && F3.lineFirst(so, [T[0], T[1] - 1.2, T[2]], P) === Infinity; }, [f.P, f.T]); if (clear) { f.k = k; break; } }
      await camAt(f.P, f.T, NIGHT); await settle(20); await run(60);
      N.cams.fairy = f; await shots('fairy', NIGHT);
    } else check(false, 'a fairy place settled');
  }
  // ---------------------------------------------------------------- a village at night
  if (want('village')) {
    await photoOff();
    const v = await ev((S0) => { const M = VR.game.villages; let best = null, bd = 1e9; for (const v of M.known.values()) { const P = v.plan && v.plan.plaza; const c = P ? [P.x, P.z] : [v.x, v.z]; if (c[0] === undefined) continue; const d = Math.hypot(c[0] - S0[0], c[1] - S0[2]); if (d < bd) { bd = d; best = { c, d }; } } return best; }, S0);
    console.log('     village ' + JSON.stringify(v));
    if (v) {
      await camAt([v.c[0], 140, v.c[1]], [v.c[0] + 10, 130, v.c[1]], NIGHT); await settle(40); await run(60);
      const y = (await top(v.c[0], v.c[1])) + 1;
      const f = await director([v.c[0] + 0.5, y, v.c[1] + 0.5], 6, 2.2, 4);
      await camAt(f.P, f.T, NIGHT); await settle(30); await run(30);
      N.cams.village = f; await shots('village', NIGHT);
    } else check(false, 'a village known');
  }
  // ---------------------------------------------------------------- the worlds
  const world = async (dim, view, o) => {
    const ok = await travel(dim); check(ok, 'the trip to ' + dim); if (!ok) return;
    const t = o.cafe ? null : await pickTime(o);
    if (o.cafe) {
      const P = [-6.5, 66.3, 2.5], T = [-15.5, 65.0, 10.5];
      await camAt(P, T, null); await settle(30); await run(20);
      N.cams[view] = { P, T }; await shots(view, null); return;
    }
    await ev((t) => VR.game.env.setTime(t), t); await run(3);
    const sun = await sunNow(), S = await ev(() => { const p = VR.game.player.pos; return [p[0], p[1], p[2]]; });
    const a = Math.atan2(sun[2], sun[0]) + (o.night ? 2.6 : 1.3), y = (await top(S[0], S[2])) + 1 + 3.5;
    const P = [S[0], y, S[2]], T = [S[0] + Math.cos(a) * 80, y - 7, S[2] + Math.sin(a) * 80];
    await camAt(P, T, t); await settle(40);
    N.cams[view] = { P, T, t }; await shots(view, t);
  };
  if (want('aqua')) await world('aqua', 'aqua', { el: 0.3 });
  if (want('ocker')) await world('ocker', 'ocker', { el: 0.25 });
  if (want('zinn')) await world('zinn', 'zinn', { night: true });
  if (want('cafe')) await world('stn.ring', 'cafe', { cafe: true });
  save();
  // ---------------------------------------------------------------- the sheet
  const pairs = [['meadow', 'Wiese bei Nacht'], ['fairy', 'Märchenort bei Nacht'], ['village', 'Dorf bei Nacht'], ['ridge', 'Grat gegen die tiefe Sonne'], ['aqua', 'Aquamarin'], ['ocker', 'Ocker'], ['zinn', 'Zinnober bei Nacht'], ['cafe', 'Stationscafé']];
  const rows = [];
  for (const [v, lab] of pairs) { const imgs = CONFIGS.map(c => N.pics[v + '_' + c]).filter(Boolean); if (imgs.length) rows.push({ label: lab + ' — vorher | nachher', imgs }); }
  if (rows.length) {
    const spec = ROOT + '/.tmp_tests/look2_sheet_' + TAG + '.json'; fs.writeFileSync(spec, JSON.stringify({ w: 620, rows }));
    try { console.log('     ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'look2_sheet' + (TAG === 'after' ? '' : '_' + TAG) + '.jpg', spec]).toString().trim()); } catch (e) { console.log('  !! sheet ' + e.message.slice(0, 200)); }
  }
} catch (e) { fails++; console.log('  ✗ ' + (e.stack || e.message).slice(0, 1200)); }
const errs = logs.filter(l => l.startsWith('[pageerror]'));
check(errs.length === 0, 'no page error' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
save();
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
