// v-look (docs/superpowers/plans/2026-11-01-v-look.md): the film look — the same six views with the look's switches off
// (the picture as before) and on, 1280 × 720, de-DE, High (dynRes off), seed 4242, a Kreativ world. Every view is
// framed through the 📷 photo mode (the camera director VR.Folk3.frameGroup for the village; the others by a scan):
//   spawn   the vista from where the world starts, toward the sun at the golden hour
//   village a Herzwelt village's plaza at dusk (the director's group frame)
//   forest  under the trees at noon (the densest crowns within 160 m of the spawn)
//   coast   the shore over the water in the afternoon
//   fairy   the Mondsteinkreis (VR.Fairy) at night
//   nebula  ch. 9's nebula (a-story6: a world inside a nebula, c9.b1)
// costs: ms a drawn frame at the spawn view, Very Low / Balanced / High, the look off and on in turns (A B B A …)
// → test/shots/lv_<view>_<cfg>_<TAG>.png, test/shots/look_sheet.jpg, .tmp_tests/look_v_<TAG>.json
// usage: nohup bash test/wt_run.sh look_v.mjs 3600 > .tmp_tests/look_v.log 2>&1 &   TAG=after · ONLY=spawn,…,cost · CONFIGS=off,on
// regress: skip  (a showcase: the pictures are the evidence; the gate is test/look_v.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '').replace(/\/\.tmp_tests$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html', SHOTS = ROOT + '/test/shots/';
const TAG = process.env.TAG || 'after', PRESET = process.env.PRESET || 'high';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, want = (s) => !ONLY || ONLY.includes(s);
let CONFIGS = (process.env.CONFIGS || 'off,on').split(',');
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + ' (' + secs() + ')'); };
const N = { tag: TAG, pics: {}, cams: {}, cost: {} };
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/look_v_' + TAG + '.json', JSON.stringify(N, null, 1)); } catch (e) { /* */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log('  !! the page crashed'); });
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
// n game steps without drawing (the world streams, the people walk); until: a name in window.__c
const run = async (n, dtms = 33, until, arg) => {
  let done = 0;
  for (let k = 0; k < n; k += 30) {
    const r = await ev(([m, d, u, a]) => {
      const g = VR.game;
      if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
      window.__norender = true;
      for (let i = 0; i < m; i++) { g.last = performance.now() - d; window.__step(performance.now()); if (u && window.__c[u](a)) return { n: i + 1, hit: true }; }
      return { n: m, hit: false };
    }, [Math.min(30, n - k), dtms, until || null, arg === undefined ? null : arg]);
    done += r.n; if (r.hit) return { n: done, hit: true };
  }
  return { n: done, hit: false };
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
// the look's switches: off (all off: the picture as before), on (the preset's defaults); a build without VR.Look: off only
const config = (c) => ev((c) => {
  const g = VR.game, r = g.renderer, L = VR.Look; if (!L || !L.SW) return 'none';
  const d = L.defaults(g.settings.preset), q = {};
  for (const k of L.SW) q[k] = c === 'on' ? d[k] : (typeof d[k] === 'number' ? 0 : false);
  r.setQuality(q);
  return L.SW.map(k => k + '=' + r.q[k]).join(',');
}, c);
const preset = (p) => ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.wowMoments = false; g.applySettings('*'); }, p);
// K drawn frames at the held time, then the canvas → a PNG
const grab = async (name, tod, K = 4) => {
  const url = await ev(([tod, K]) => { const g = VR.game; if (tod !== null) { g.env.setTime(tod); for (let i = 0; i < 2; i++) { g.env.anim = 499; if (g.envFor) g.envFor(g.player.eyePos(), 1, { freezeTime: true, freezeWeather: true }); } } window.__norender = false; for (let i = 0; i < K; i++) { if (tod !== null) { g.env.setTime(tod); if (g.photoCam && g.photoCam.on) g.photoCam.held = tod; } g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; window.__step(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; }, [tod, K]);
  if (!url || url.length < 2000) { check(false, 'a picture ' + name); return null; }
  const f = SHOTS + 'lv_' + name + '_' + TAG + '.png'; fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
  N.pics[name] = f; save(); console.log('     📷 ' + name + ' (' + secs() + ')'); return f;
};
// the photo camera at P looking at T (the player stands there too, so the world streams round it)
const camAt = async (P, T, tod) => {
  await ev(([P, T, tod]) => {
    const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(P[0], P[1] - 1.62, P[2]); p.vel[0] = p.vel[1] = p.vel[2] = 0;
    if (!g.photoCam || !g.photoCam.on) g.photoMode(true);
    const pc = g.photoCam, s = pc.s; pc.first = false; pc.held = tod; g.env.setTime(tod);
    const dx = T[0] - P[0], dy = T[1] - P[1], dz = T[2] - P[2];
    s.x = P[0]; s.y = P[1]; s.z = P[2]; s.yaw = Math.atan2(-dx, -dz); s.pitch = Math.atan2(dy, Math.hypot(dx, dz)); s.roll = 0; s.vel[0] = s.vel[1] = s.vel[2] = 0;
  }, [P, T, tod]);
};
// both configurations of one view
const shots = async (view, tod) => {
  const out = {};
  for (const c of CONFIGS) { N.q = await config(c); await run(4); out[c] = await grab(view + '_' + c, tod); }
  await config('on');
  return out;
};
const photoOff = () => ev(() => { const g = VR.game; if (g.photoCam && g.photoCam.on) g.photoMode(false); });
const top = (x, z) => ev(([x, z]) => VR.game.world.topAt(Math.floor(x), Math.floor(z)), [x, z]);

try {
  await page.goto(DIST);
  for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title')) break; }
  await preset(PRESET);
  await ev(() => { if (VR.Hints) for (const h of ['play', 'move', 'fly', 'bauhand', 'bhring', 'bhundo', 'bhchange']) VR.Hints.done(h); });
  await ev(`VR.game.createWorld({name:'Filmblick',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
  for (let i = 0; i < 200; i++) { await wait(500); if (await ev(() => VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)) break; }
  check(await ev(() => VR.game.state) === 'play', 'the world is open');
  await ev(() => {
    const g = VR.game, L0 = Object.getPrototypeOf(g).loop;
    window.__step = (t) => L0.call(g, t); g.loop = function (t) { if (window.__live) return L0.call(this, t); };
    g.zenFreezeWeather = true; g.zenFreezeTime = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar');
    window.__c = { sceneT: (t) => { const s = g.story; return !s || !s.scene || s.scene.t >= t; } };
  });
  if (!(await ev(() => !!(VR.Look && VR.Look.SW)))) CONFIGS = ['off'];
  console.log('configs ' + CONFIGS.join(',') + ' · ' + await config('on'));
  await settle(80);
  const S0 = await ev(() => { const p = VR.game.player.pos; return [p[0], p[1], p[2]]; });
  N.spawn = S0;

  // ---------------------------------------------------------------- spawn vista, golden hour, toward the sun
  if (want('spawn') || want('cost')) {
    const GOLD = 10800;
    await ev((t) => VR.game.env.setTime(t), GOLD); await run(2);
    const sun = await ev(() => VR.game.env.E.sunDir.slice());
    const a = Math.atan2(sun[2], sun[0]) + 0.5, y = (await top(S0[0], S0[2])) + 7;
    const P = [S0[0] - Math.cos(a) * 6, y, S0[2] - Math.sin(a) * 6], T = [S0[0] + Math.cos(a) * 80, y - 6, S0[2] + Math.sin(a) * 80];
    await camAt(P, T, GOLD); await settle(40);
    N.cams.spawn = { P, T };
    if (want('spawn')) N.spawnPics = await shots('spawn', GOLD);
    // ---------------------------------------------------------------- the costs (ms a drawn frame, gl.finish each)
    if (want('cost')) {
      const ms = (n) => ev((n) => { const g = VR.game, gl = g.renderer.gl; window.__norender = false; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; window.__step(performance.now()); } gl.finish(); const t0 = performance.now(); for (let i = 0; i < n; i++) { g.last = performance.now() - 33; window.__step(performance.now()); gl.finish(); } window.__norender = true; return (performance.now() - t0) / n; }, n);
      for (const pr of ['potato', 'balanced', 'high']) {
        await preset(pr); await camAt(P, T, GOLD); await settle(25);
        const r = { off: [], on: [] };
        for (const c of CONFIGS.length > 1 ? ['off', 'on', 'on', 'off', 'off', 'on'] : ['off', 'off', 'off']) { await config(c); r[c].push(await ms(6)); }
        const med = (a) => { const s = a.slice().sort((x, y) => x - y); return +s[s.length >> 1].toFixed(1); };
        N.cost[pr] = { off: med(r.off), on: r.on.length ? med(r.on) : null, all: r };
        console.log('     cost ' + pr + ' ' + JSON.stringify({ off: N.cost[pr].off, on: N.cost[pr].on }) + ' (' + secs() + ')'); save();
      }
      if (N.cost.potato.on !== null) check(N.cost.potato.on <= N.cost.potato.off * 1.05 + 1, 'Very Low not slower: ' + N.cost.potato.on + ' / ' + N.cost.potato.off + ' ms');
      await preset(PRESET); await config('on');
    }
  }

  // ---------------------------------------------------------------- a village at dusk (the director's group frame)
  if (want('village')) {
    const DUSK = 12450;
    const v = await ev((S0) => { const M = VR.game.villages; let best = null, bd = 1e9; for (const v of M.known.values()) { const P = v.plan && v.plan.plaza; const c = P ? [P.x, P.z] : [v.x, v.z]; if (c[0] === undefined) continue; const d = Math.hypot(c[0] - S0[0], c[1] - S0[2]); if (d < bd) { bd = d; best = { id: v.id || null, c, y: P ? P.y : null, d } } } return best; }, S0);
    console.log('     village ' + JSON.stringify(v));
    if (v) {
      await camAt([v.c[0], 140, v.c[1]], [v.c[0] + 10, 130, v.c[1]], DUSK); await settle(40); await run(60);
      const f = await ev(([c]) => { const g = VR.game, F3 = VR.Folk3, y = g.world.topAt(Math.floor(c[0]), Math.floor(c[1])) + 1; const C = [c[0] + 0.5, y, c[1] + 0.5]; const fr = F3 && F3.frameGroup(F3.solidW(g.world), C, 6, { sun: F3.sunAngle ? F3.sunAngle(g) : null }); return fr ? { P: fr.P, T: [C[0], y + 2.5, C[2]] } : { P: [C[0] + 14, y + 6, C[2] + 6], T: [C[0], y + 2, C[2]] }; }, [v.c]);
      // (the director frames the group close: the plaza wanted — 2.2× farther back along the same line, raised)
      const D = [f.P[0] - f.T[0], f.P[2] - f.T[2]], L = Math.hypot(D[0], D[1]) || 1, back = Math.max(14, L * 2.2);
      const P = [f.T[0] + D[0] / L * back, f.T[1] + 4, f.T[2] + D[1] / L * back];
      P[1] = Math.max(P[1], (await top(P[0], P[2])) + 2.6);
      await camAt(P, f.T, DUSK); await settle(30); await run(30);
      N.cams.village = { P, T: f.T };
      await shots('village', DUSK);
    } else check(false, 'a village known');
  }

  // ---------------------------------------------------------------- the forest at noon: the densest crowns near the spawn
  if (want('forest')) {
    const NOON = 6000;
    const findWood = (S0) => ev((S0) => { const g = VR.game, w = g.world, R = VR.R, F = VR.F; let best = null, bn = 0;
      for (let gx = -112; gx <= 112; gx += 16) for (let gz = -112; gz <= 112; gz += 16) { const x0 = Math.floor(S0[0] + gx), z0 = Math.floor(S0[2] + gz); if (!w.isLoaded(x0, z0)) continue; let n = 0; for (let dx = 0; dx < 16; dx += 2) for (let dz = 0; dz < 16; dz += 2) { const y = w.topAt(x0 + dx, z0 + dz); const s = w.getBlock(x0 + dx, y, z0 + dz); if (s && (R.T.flags[s] & F.LEAVES)) n++; } if (n > bn) { bn = n; best = [x0 + 8, z0 + 8]; } }
      return best ? { c: best, n: bn } : null; }, S0);
    let F = null; await photoOff();
    for (const [ox, oz] of [[0, 0], [-200, 0], [200, 0], [0, 200], [0, -200]]) {
      const c0 = [S0[0] + ox, S0[1], S0[2] + oz];
      if (ox || oz) { await ev((c) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(c[0], 150, c[2]); }, c0); await settle(40); }
      const f = await findWood(c0); if (f && (!F || f.n > F.n)) F = f; if (F && F.n >= 36) break;
    }
    console.log('     forest ' + JSON.stringify(F));
    if (F) {
      await camAt([F.c[0], 140, F.c[1]], [F.c[0] + 10, 130, F.c[1]], NOON); await settle(40);
      // the eye under the crowns: the ground below the canopy (the first open air above the ground), looking along the wood
      const G = await ev(([x, z]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let i = 0; i < 40; i++) { const xx = Math.floor(x + (i % 7) - 3), zz = Math.floor(z + ((i / 7) | 0) - 3); for (let y = w.topAt(xx, zz); y > 40; y--) { const s = w.getBlock(xx, y, zz); if (s && (R.T.flags[s] & F.OPAQUE) && !(R.T.flags[s] & F.LEAVES)) { const a = w.getBlock(xx, y + 1, zz), b = w.getBlock(xx, y + 2, zz), c2 = w.getBlock(xx, y + 3, zz); if ((!a || !(R.T.flags[a] & F.SOLID)) && (!b || !(R.T.flags[b] & F.SOLID)) && (!c2 || !(R.T.flags[c2] & F.SOLID))) return [xx + 0.5, y + 1, zz + 0.5]; break; } } } return null; }, F.c);
      const P = G ? [G[0], G[1] + 1.7, G[2]] : [F.c[0], (await top(F.c[0], F.c[1])) + 3, F.c[1]];
      const sun = await ev(() => VR.game.env.E.sunDir.slice()), a = Math.atan2(sun[2], sun[0]) + 1.4;
      const T = [P[0] + Math.cos(a) * 30, P[1] + 1.5, P[2] + Math.sin(a) * 30];
      await camAt(P, T, NOON); await settle(30);
      N.cams.forest = { P, T, under: !!G };
      await shots('forest', NOON);
    } else check(false, 'a wood near the spawn');
  }

  // ---------------------------------------------------------------- the coast: a shore over open water, afternoon
  if (want('coast')) {
    const AFT = 9000;
    const findCoast = (S0) => ev((S0) => { const g = VR.game, w = g.world, R = VR.R, F = VR.F; const wet = (x, z) => { const y = w.topAt(x, z), s = w.getBlock(x, y, z); return s && (R.T.flags[s] & F.FLUID) ? 1 : 0; };
      let best = null, bs = 0;
      for (let gx = -120; gx <= 120; gx += 8) for (let gz = -120; gz <= 120; gz += 8) { const x = Math.floor(S0[0] + gx), z = Math.floor(S0[2] + gz); if (!w.isLoaded(x, z) || wet(x, z)) continue;
        for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; let n = 0; for (let d = 4; d <= 40; d += 4) n += wet(Math.floor(x + Math.cos(a) * d), Math.floor(z + Math.sin(a) * d)); if (n >= 8 && wet(Math.floor(x + Math.cos(a) * 3), Math.floor(z + Math.sin(a) * 3))) { const sc = n * 10 - Math.hypot(gx, gz) * 0.05; if (sc > bs) { bs = sc; best = { x: x + 0.5, z: z + 0.5, a }; } } } }
      return best; }, S0);
    let C = null; await photoOff();
    for (const [ox, oz] of [[0, 0], [240, 0], [0, 240], [-240, 0], [0, -240]]) {
      const c0 = [S0[0] + ox, S0[1], S0[2] + oz];
      if (ox || oz) { await ev((c) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(c[0], 150, c[2]); }, c0); await settle(40); }
      C = await findCoast(c0); if (C) break;
    }

    console.log('     coast ' + JSON.stringify(C));
    if (C) {
      const y = (await top(C.x, C.z)) + 1;
      const P = [C.x - Math.cos(C.a) * 4, y + 3.2, C.z - Math.sin(C.a) * 4], T = [C.x + Math.cos(C.a + 0.35) * 40, y - 1, C.z + Math.sin(C.a + 0.35) * 40];
      P[1] = Math.max(P[1], (await top(P[0], P[2])) + 2.5);
      await camAt(P, T, AFT); await settle(40);
      N.cams.coast = { P, T };
      await shots('coast', AFT);
    } else check(false, 'a coast near the spawn');
  }

  // ---------------------------------------------------------------- a fairy place at night (Mondsteinkreis)
  if (want('fairy')) {
    const NIGHT = 18000;
    let s = null; await photoOff();
    for (let i = 0; i < 30; i++) {
      s = (await ev(() => VR.Fairy && VR.Fairy.debug ? VR.Fairy.debug.sites() : [])).find(x => x.kind === 'circle');
      if (!s) break;
      if (s.y !== null && await ev(() => VR.Fairy.debug.near()) === s.id) break;
      await ev((s) => { const p = VR.game.player; p.flying = true; p.teleport(s.x + 0.5, 150, s.z + 0.5); }, s); await settle(8); await run(20);
    }
    console.log('     fairy ' + JSON.stringify(s && { x: s.x, y: s.y, z: s.z }));
    if (s && s.y !== null) {
      const a = (s.yaw || 0) + 0.2, P = [s.x + Math.cos(a) * 15, 0, s.z + Math.sin(a) * 15];
      P[1] = (await top(P[0], P[2])) + 1 + 3;
      const T = [s.x, s.y + 1.5, s.z];
      await camAt(P, T, NIGHT); await settle(20); await run(60);
      N.cams.fairy = { P, T };
      await shots('fairy', NIGHT);
    } else check(false, 'the Mondsteinkreis');
  }

  // ---------------------------------------------------------------- the nebula (ch. 9, a-story6)
  if (want('nebula')) {
    await ev(() => { const g = VR.game; if (g.photoCam && g.photoCam.on) g.photoMode(false); const A = VR.Adventure; if (A) { A.setOn(true); A.setEnc('normal'); } });
    const W = await ev(() => { const G = VR.Galaxy, M = G.build((VR.game.meta.seed >>> 0) || 0x5eed); for (let i = 1; i < M.list.length; i++) { const st = M.list[i]; if (!st || !(st.neb >= 0)) continue; const sy = G.system(M, i), p = sy && sy.bodies.find(b => b.landable && !b.locked && /aqua|ocker|basalt|opal/.test(b.dim || '')); if (p) return p.dim; } return null; });
    let ok = false;
    if (W) {
      await ev((d) => { window.__lastTrip = VR.Travel.last; VR.Travel.go(VR.game, { dim: d, via: 'cmd' }); }, W);
      for (let i = 0; i < 900; i++) { await run(10); const st = await ev((d) => { const g = VR.game, L = VR.Travel.last; return g.dim === d && g.state === 'play' && !!(L && L !== window.__lastTrip && L.to === d); }, W); if (st) { ok = true; break; } await wait(20); }
    }
    check(ok, 'the trip into the nebula: ' + W);
    if (ok) {
      await settle(40);
      await ev(() => { const g = VR.game, p = g.player, y = g.world.topAt(Math.floor(p.pos[0]), Math.floor(p.pos[2])) + 1; p.flying = false; p.noclip = false; p.teleport(p.pos[0], Math.max(y, p.pos[1]), p.pos[2]); p.pitch = 0; g.story.rec.choices.c6 = 'lumi'; });
      let td = null; for (const t of [18000, 15000, 21000, 12000, 0, 3000]) { await ev((t) => VR.game.env.setTime(t), t); await run(3); if (await ev(() => VR.StoryPlay.ctx3(VR.game).sunUp) === false) { td = t; break; } }
      await ev(() => VR.StoryPlay.debug.reach('c9.b1')); await ev(() => VR.StoryPlay.debug.play('c9.b1'));
      await run(Math.ceil(10 / 0.033) + 60, 33, 'sceneT', 10);
      await shots('nebula', td);
    }
  }
  save();
  // ---------------------------------------------------------------- the sheet
  const pairs = [['spawn', 'Spawn-Blick · goldene Stunde'], ['village', 'Dorf in der Dämmerung'], ['forest', 'Wald am Mittag'], ['coast', 'Küste am Nachmittag'], ['fairy', 'Mondsteinkreis bei Nacht'], ['nebula', 'Der Nebel (Kap. 9)']];
  const rows = [];
  for (const [v, lab] of pairs) { const imgs = CONFIGS.map(c => N.pics[v + '_' + c]).filter(Boolean); if (imgs.length) rows.push({ label: lab + (imgs.length > 1 ? ' — vorher | nachher (Filmblick)' : ''), imgs }); }
  if (rows.length) {
    const spec = ROOT + '/.tmp_tests/look_sheet_' + TAG + '.json'; fs.writeFileSync(spec, JSON.stringify({ w: 620, rows }));
    try { console.log('     ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + (TAG === 'after' ? 'look_sheet.jpg' : 'look_sheet_' + TAG + '.jpg'), spec]).toString().trim()); } catch (e) { console.log('  !! sheet ' + e.message.slice(0, 200)); }
  }
} catch (e) { fails++; console.log('  ✗ ' + (e.stack || e.message).slice(0, 1200)); }
const errs = logs.filter(l => l.startsWith('[pageerror]'));
check(errs.length === 0, 'no page error' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
save();
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
