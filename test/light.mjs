// v-light · Lichtpfützen (docs/superpowers/plans/2026-11-02-v-light.md): nights that glow — six night views, 1280 × 720,
// de-DE, High (dynRes off), seed 4242, a Kreativ world, each 'before' (lfPools off) and 'after' (on), all befores first
// (one program rebuild each way, not one a view):
//   street    a village street in the evening (people out, one in three grown-ups with a lantern)
//   festival  the festival plaza at the fireworks (the nearest village's festival made today's)
//   fairy     a fairy place at night (the director's frame)
//   haven     Palmenhafen (the Heartland's city) at night
//   home      the player's own settlement: a hut with a window and its lamp, a fence with lanterns on its posts, a fire
//   carry     close by a lantern-bearer in the street (the light walks with them)
// costs: ms a drawn frame at the street view, Very Low and High, before / after A B B A; the field's own JS ms (High)
// → test/shots/lf_<view>_<cfg>.png, test/shots/light_sheet.jpg, .tmp_tests/light_<TAG>.json
// usage: nohup bash test/wt_run.sh light.mjs 3600 > .tmp_tests/light.log 2>&1 &   TAG=run1 · ONLY=street,…,cost
// regress: skip  (a showcase: the pictures are the evidence; the gate is test/lightfield.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '').replace(/\/\.tmp_tests$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html', SHOTS = ROOT + '/test/shots/';
const TAG = process.env.TAG || 'after', PRESET = process.env.PRESET || 'high';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, want = (s) => !ONLY || ONLY.includes(s);
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + ' (' + secs() + ')'); };
const N = { tag: TAG, pics: {}, cams: {}, cost: {}, stats: {} };
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/light_' + TAG + '.json', JSON.stringify(N, null, 1)); } catch (e) { /* */ } };
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
// (run 2: the pictures right after the switch lacked the near chunks — the rebuilt programs still compiling: frames
// drawn until every deferred program is ready)
const config = (c) => ev((c) => { const g = VR.game, r = g.renderer; r.setQuality({ lfPools: c === 'after' && VR.LField.defaults(g.settings.preset).lfPools }); window.__norender = false; let i = 0; for (; i < 40 && (i < 3 || VR.GL.pending.size); i++) { g.last = performance.now() - 33; window.__step(performance.now()); } window.__norender = true; return 'lfPools=' + (r.q.lfPools ? 1 : 0) + ' (' + i + ' frames, ' + VR.GL.pending.size + ' pending)'; }, c);
const preset = (p) => ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.wowMoments = false; g.applySettings('*'); }, p);
const grab = async (name, tod, K = 4) => {
  const url = await ev(([tod, K]) => { const g = VR.game; if (tod !== null) { g.env.setTime(tod); for (let i = 0; i < 2; i++) { g.env.anim = 499; if (g.envFor) g.envFor(g.player.eyePos(), 1, { freezeTime: true, freezeWeather: true }); } } window.__norender = false; for (let i = 0; i < K; i++) { if (tod !== null) { g.env.setTime(tod); if (g.photoCam && g.photoCam.on) g.photoCam.held = tod; } g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; window.__step(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; }, [tod, K]);
  if (!url || url.length < 2000) { check(false, 'a picture ' + name); return null; }
  const f = SHOTS + 'lf_' + name + (TAG === 'after' ? '' : '_' + TAG) + '.png'; fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
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
const meadowAt = (S0, o) => ev(([S0, o]) => { const g = VR.game, w = g.world, R = VR.R; const nm = (x, z) => { const y = w.topAt(x, z), s = w.getBlock(x, y, z); return { y, n: s ? R.types[R.T.type[s]].name : '' }; };
  let best = null, bd = 1e9;
  // (run 2: a 7 × 7 lawn was a city yard between walls — 25 × 25 m of open grass now, sampled every 3 m)
  for (let gx = -240; gx <= 240; gx += 12) for (let gz = -240; gz <= 240; gz += 12) { const x = Math.floor(S0[0] + gx), z = Math.floor(S0[2] + gz), d = Math.hypot(gx, gz); if (d < 40 || d > bd || !w.isLoaded(x, z)) continue;
    const c = nm(x, z); if (!/grass/.test(c.n) || /vx_/.test(c.n)) continue; let ok = true;
    for (let dx = -12; dx <= 12 && ok; dx += 3) for (let dz = -12; dz <= 12 && ok; dz += 3) { if (!w.isLoaded(x + dx, z + dz)) { ok = false; break; } const q = nm(x + dx, z + dz); if (!/grass|flower|fern/.test(q.n) || Math.abs(q.y - c.y) > 3) ok = false; }
    if (ok) { bd = d; best = [x + 0.5, z + 0.5]; } }
  return best; }, [S0, o || {}]);
const natural = (x, z) => ev(([x, z]) => { const g = VR.game, w = g.world, R = VR.R, y = w.topAt(Math.floor(x), Math.floor(z)), s = w.getBlock(Math.floor(x), y, Math.floor(z)); const n = s ? R.types[R.T.type[s]].name : ''; return /grass|leaves|dirt|stone|snow|sand|moss|podzol|log/.test(n) && !/brick|slab|stairs|polished|smooth|tile|vx_/.test(n); }, [x, z]);
const sunNow = () => ev(() => VR.game.env.E.sunDir.slice());
const EVE = 13900;
// (run 3: a near column re-shown after a long trip grows from the ground and fades in: pictures caught it half there,
// before as after — the near columns (5 chunks round the eye) all shown, grown and faded in first, frames drawn meanwhile)
const shown = async (max = 30) => {
  let bad = -1;
  for (let i = 0; i < max; i++) {
    bad = await ev(() => { const g = VR.game, w = g.world, s = g.photoCam && g.photoCam.on ? g.photoCam.s : { x: g.player.pos[0], z: g.player.pos[2] }, cx = Math.floor(s.x) >> 4, cz = Math.floor(s.z) >> 4; let b = 0; for (const c of w.cols.values()) { if (Math.abs(c.cx - cx) > 5 || Math.abs(c.cz - cz) > 5) continue; if (!c.ready || c.shownAt < 0 || (c.fade !== undefined && c.fade < 1) || (c.grow !== undefined && c.grow < 1)) b++; } return b; });
    if (!bad) return 0;
    await ev(() => { const g = VR.game; window.__norender = false; for (let k = 0; k < 3; k++) { g.last = performance.now() - 33; window.__step(performance.now()); } window.__norender = true; });
    await run(10);
  }
  return bad;
};
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
const meanL = async (f) => { try { const s = await sharp(f).stats(); return +(0.2126 * s.channels[0].mean + 0.7152 * s.channels[1].mean + 0.0722 * s.channels[2].mean).toFixed(2); } catch (e) { return null; } };
const stat = () => ev(() => { const g = VR.game, r = g.renderer, f = r.lfField, E = g.env.E, V = g.villages; let car = 0; if (V) for (const a of V.agents) if (a.drawn && a.street && VR.LField.carrier(a)) car++; return { lights: f ? f.stats.lights : 0, dyn: f ? f.stats.dyn : 0, night: +(E.night || 0).toFixed(2), carriers: car, live: !!r.lfLive, jsms: VR.LField.cost.last ? +VR.LField.cost.last.toFixed(2) : null, jsAvg: +(VR.LField.cost.ms || 0).toFixed(2), tod: g.env.timeOfDay | 0, err: VR.LField.err || null, kinds: (() => { if (!f) return null; const c = {}; for (let i = 0; i < f.em.length; i++) if (f.em[i]) { const s = g.world.getBlock(f.tx[i], f.emY[i], f.tz[i]), n = s ? VR.R.types[VR.R.T.type[s]].name : '?'; c[n] = (c[n] || 0) + 1; } return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 6).map(e => e[0] + ' ' + e[1]).join(', '); })() }; });
const fest = (on, off) => ev(([on, off]) => { const g = VR.game, M = g.villages, day = g.env.day || 0; for (const v of M.known.values()) { if (v.id === on) v.festOff = (3 - (day % 3)) % 3; else if (off === 'all' || v.id === off) v.festOff = (4 - (day % 3)) % 3; } }, [on, off]);
const carrierNear = (C) => ev((C) => { const g = VR.game, V = g.villages; let best = null, bd = 1e9; for (const a of V.agents) { if (!a.street || a.kid || !VR.LField.carrier(a)) continue; if ((g.world.getLight(Math.floor(a.pos[0]), Math.floor(a.pos[1]) + 1, Math.floor(a.pos[2])) >>> 12) < 13) continue;   // (run 3: one in a bedroom — out under the sky only) const d = Math.hypot(a.pos[0] - C[0], a.pos[2] - C[1]); if (d < bd) { bd = d; best = { p: a.pos.slice(), yaw: a.yaw, d }; } } return best; }, C);

try {
  await page.goto(DIST);
  for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title')) break; }
  await preset(PRESET);
  await ev(() => { if (VR.Hints) for (const h of ['play', 'move', 'fly', 'bauhand', 'bhring', 'bhundo', 'bhchange']) VR.Hints.done(h); });
  await ev(`VR.game.createWorld({name:'Lichtpfuetzen',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
  for (let i = 0; i < 200; i++) { await wait(500); if (await ev(() => VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)) break; }
  check(await ev(() => VR.game.state) === 'play', 'the world is open');
  await ev(() => {
    const g = VR.game, L0 = Object.getPrototypeOf(g).loop;
    window.__step = (t) => L0.call(g, t); g.loop = function (t) { if (window.__live) return L0.call(this, t); };
    g.zenFreezeWeather = true; g.zenFreezeTime = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar');
    if (g.player && g.player.inv && g.player.inv.slots) g.player.inv.slots[g.player.inv.sel] = null;   // (an empty hand: no lamp in it)
  });
  console.log('before: ' + await config('before'));
  await settle(80);
  const S0 = await ev(() => { const p = VR.game.player.pos; return [p[0], p[1], p[2]]; });
  N.spawn = S0;
  const views = [];
  // ---------------------------------------------------------------- the villages: the nearest one's festival, the next one's street
  const vils = await ev((S0) => { const M = VR.game.villages, out = []; for (const v of M.known.values()) { const P = v.plan && v.plan.plaza; if (!P) continue; const hs = (v.plan.homes || []).map(h => (h && Array.isArray(h.outside) ? h.outside : h && Array.isArray(h.door) ? h.door : null)).filter(d => d && isFinite(d[0]) && isFinite(d[2])).sort((a, b) => Math.hypot(a[0] - P.x, a[2] - P.z) - Math.hypot(b[0] - P.x, b[2] - P.z)); const hc = hs.length ? [hs[Math.min(2, hs.length - 1)][0], hs[Math.min(2, hs.length - 1)][2]] : null; out.push({ id: v.id, c: [P.x, P.z], y: P.y, d: Math.hypot(P.x - S0[0], P.z - S0[2]), h: hc }); } return out.sort((a, b) => a.d - b.d).slice(0, 4); }, S0);
  console.log('     villages ' + JSON.stringify(vils));
  const vF = vils[0], vS = vils[1] || vils[0];
  if (vF && want('festival')) {
    await camAt([vF.c[0], 140, vF.c[1]], [vF.c[0] + 10, 130, vF.c[1]], EVE); await settle(40);
    const y = (await top(vF.c[0], vF.c[1])) + 1;
    const f = await director([vF.c[0] + 0.5, y, vF.c[1] + 0.5], 6, 2.0, 4);
    views.push({ name: 'festival', P: f.P, T: f.T, tod: 14000, prep: async () => { await fest(vF.id, vS.id === vF.id ? null : vS.id); await run(90); } });
  }
  if (vS && want('street')) {
    await camAt([vS.c[0], 140, vS.c[1]], [vS.c[0] + 10, 130, vS.c[1]], EVE); await settle(40);
    const C = vS.h ? [vS.h[0] + 0.5, vS.h[1] + 0.5] : [vS.c[0] + 8, vS.c[1]];
    const y = (await top(C[0], C[1])) + 1;
    const f = await director([C[0], y, C[1]], 4, 1.4, 1.5);
    views.push({ name: 'street', P: f.P, T: f.T, tod: EVE, prep: async () => { await fest(vF && vF.id !== vS.id ? vF.id : null, vS.id); await run(60); } });   // (the street's village not celebrating)
    if (want('carry')) views.push({ name: 'carry', tod: EVE, dyn: async () => {
      const a = await carrierNear(C); if (!a) return null;
      // (run 2: the eye stood in a wall — a ring of places 4 m out, 2 m up: the first in the air that sees the bearer)
      const T = [a.p[0], a.p[1] + 0.8, a.p[2]];
      for (let j = 0; j < 12; j++) { const an = (a.yaw || 0) + Math.PI + j / 12 * Math.PI * 2, P = [a.p[0] + Math.sin(an) * 4.2, a.p[1] + 2.0, a.p[2] + Math.cos(an) * 4.2]; const ok = await ev(([P, T]) => { const w = VR.game.world, F3 = VR.Folk3, so = F3.solidW(w); for (let dy = -1; dy <= 1; dy++) if (w.getBlock(Math.floor(P[0]), Math.floor(P[1]) + dy, Math.floor(P[2]))) return false; return F3.lineFirst(so, T, P) === Infinity && F3.lineFirst(so, P, T) === Infinity; }, [P, T]); if (ok) return { P, T }; }
      return { P: [a.p[0], a.p[1] + 6, a.p[2] + 4], T };
    }, prep: async () => { await run(30); } });
  }
  // ---------------------------------------------------------------- a fairy place
  if (want('fairy')) {
    let s = null; await photoOff();
    for (const kind of ['shroom', 'circle', 'spring', 'tree', 'garden']) {
      for (let i = 0; i < 12; i++) {
        s = (await ev(() => VR.Fairy && VR.Fairy.debug ? VR.Fairy.debug.sites() : [])).find(x => x.kind === kind);
        if (!s) break;
        if (s.y !== null && await ev(() => VR.Fairy.debug.near()) === s.id) break;
        await ev((s) => { const p = VR.game.player; p.flying = true; p.teleport(s.x + 0.5, 150, s.z + 0.5); }, s); await settle(8); await run(20);
      }
      if (s && s.y !== null) break;
    }
    if (s && s.y !== null) {
      await camAt([s.x + 0.5, s.y + 30, s.z + 0.5], [s.x + 6, s.y, s.z], NIGHT); await settle(30); await run(30);
      // (run 1: the director's frame stood inside a mushroom's cap — a ring of places 12 m out, 6 m up: the first whose
      // eye is in the air and sees the site's middle)
      let f = null;
      for (let j = 0; j < 12 && !f; j++) { const a = j / 12 * Math.PI * 2, P = [s.x + 0.5 + Math.cos(a) * 12, s.y + 6, s.z + 0.5 + Math.sin(a) * 12], T = [s.x + 0.5, s.y + 1, s.z + 0.5]; const ok = await ev(([P, T]) => { const g = VR.game, w = g.world, F3 = VR.Folk3, so = F3.solidW(w); for (let dy = -1; dy <= 1; dy++) if (w.getBlock(Math.floor(P[0]), Math.floor(P[1]) + dy, Math.floor(P[2]))) return false; return F3.lineFirst(so, T, P) === Infinity && F3.lineFirst(so, P, T) === Infinity; }, [P, T]); if (ok) f = { P, T }; }
      if (!f) f = { P: [s.x + 0.5, s.y + 14, s.z + 12.5], T: [s.x + 0.5, s.y + 1, s.z + 0.5] };
      views.push({ name: 'fairy', P: f.P, T: f.T, tod: NIGHT, prep: async () => { await run(60); } });
    } else check(false, 'a fairy place');
  }
  // ---------------------------------------------------------------- Palmenhafen
  if (want('haven')) {
    const C = await ev(() => VR.Heart && VR.Heart.CITY ? [VR.Heart.CITY.x, VR.Heart.CITY.z] : null);
    if (C) {
      await camAt([C[0], 150, C[1]], [C[0] + 10, 140, C[1]], NIGHT); await settle(50);
      const y = (await top(C[0], C[1])) + 1;
      const f = await director([C[0] + 0.5, y, C[1] + 0.5], 8, 1.8, 5);
      views.push({ name: 'haven', P: f.P, T: f.T, tod: NIGHT, prep: async () => { await run(20); } });
    } else check(false, 'Palmenhafen known');
  }
  // ---------------------------------------------------------------- the player's own settlement
  if (want('home')) {
    await photoOff();
    const G = (await meadowAt(S0)) || [S0[0] + 30, S0[2] + 30];
    await camAt([G[0], (await top(G[0], G[1])) + 20, G[1]], [G[0] + 5, (await top(G[0], G[1])) + 10, G[1]], NIGHT); await settle(30);
    const B = await ev(([x0, z0]) => {
      const g = VR.game, w = g.world, R = VR.R, S = (n) => (R.byName[n] ? R.S(n) : 0);
      x0 = Math.floor(x0); z0 = Math.floor(z0);
      const y0 = w.topAt(x0, z0) + 1, wall = S('oak_planks') || S('stone_bricks'), glass = S('glass'), lan = S('lantern'), fence = S('oak_fence') || S('cobblestone_wall'), fire = S('campfire'), roof = S('spruce_planks') || wall;
      let n = 0; const put = (x, y, z, s) => { if (s && w.setBlock(x, y, z, s)) n++; };
      // the hut 7 × 5, walls 3 high, a door and two windows toward the street (−z), a lamp under the roof
      for (let dx = 0; dx < 7; dx++) for (let dz = 0; dz < 5; dz++) {
        put(x0 + dx, y0 - 1, z0 + dz, wall);
        for (let dy = 0; dy < 3; dy++) { const edge = dx === 0 || dx === 6 || dz === 0 || dz === 4; if (!edge) { put(x0 + dx, y0 + dy, z0 + dz, 0); continue; } const door = dz === 0 && dx === 3 && dy < 2, win = dz === 0 && (dx === 1 || dx === 5) && dy === 1; if (door) { w.setBlock(x0 + dx, y0 + dy, z0 + dz, 0); continue; } put(x0 + dx, y0 + dy, z0 + dz, win ? glass : wall); }
        put(x0 + dx, y0 + 3, z0 + dz, roof);
      }
      put(x0 + 3, y0, z0 + 2, lan);
      // the fence along the street with lanterns on every second post, 6 m before the hut
      for (let dx = -5; dx <= 12; dx++) { const x = x0 + dx, z = z0 - 6, y = w.topAt(x, z) + 1; put(x, y, z, fence); if ((dx & 1) === 0) put(x, y + 1, z, lan); }
      put(x0 + 9, w.topAt(x0 + 9, z0 + 1) + 1, z0 + 1, fire);
      return { x0, z0, y0, n, have: { wall: !!wall, glass: !!glass, lan: !!lan, fence: !!fence, fire: !!fire } };
    }, G);
    console.log('     home ' + JSON.stringify(B));
    await settle(40);
    const P = [B.x0 - 2, Math.max(B.y0 + 5, (await top(B.x0 - 2, B.z0 - 14)) + 3.5), B.z0 - 14], T = [B.x0 + 4, B.y0 + 0.5, B.z0 - 1];
    views.push({ name: 'home', P, T, tod: NIGHT, prep: async () => { await run(10); } });
  }
  // ---------------------------------------------------------------- the pictures: all befores, then all afters
  for (const c of ['before', 'after']) {
    console.log(c + ': ' + await config(c));
    for (const v of views) {
      await photoOff();
      if (v.prep) await v.prep();
      let P = v.P, T = v.T;
      if (v.dyn) { const d = await v.dyn(); if (!d) { console.log('     ' + v.name + ': nobody'); continue; } P = d.P; T = d.T; }
      await camAt(P, T, v.tod); await settle(25); await run(10);
      const nb = await shown(); if (nb) console.log('     ' + v.name + ': ' + nb + ' near columns not shown');
      if (v.dyn) { const d = await v.dyn(); if (d) { P = d.P; T = d.T; await camAt(P, T, v.tod); } }   // (the bearer walked on while the place settled: the frame again, at once)
      N.cams[v.name + '_' + c] = { P, T };
      const f = await grab(v.name + '_' + c, v.tod, 6);
      const st = await stat(); st.L = f ? await meanL(f) : null; N.stats[v.name + '_' + c] = st;
      console.log('     ' + v.name + ' ' + c + ' ' + JSON.stringify(st));
    }
  }
  for (const v of views) {
    const a = N.stats[v.name + '_after'], b = N.stats[v.name + '_before']; if (!a || !b) continue;
    if (v.name !== 'carry') check(a.live && a.lights > 0, v.name + ': the field live, ' + a.lights + ' lights, ' + a.dyn + ' moving');
    if (v.name === 'home' || v.name === 'street' || v.name === 'haven') check(a.L > b.L, v.name + ': brighter with the pools (L ' + b.L + ' → ' + a.L + ')');
  }
  // ---------------------------------------------------------------- the costs (the street view, A B B A)
  if (want('cost') && N.cams.street_after) {
    const { P, T } = N.cams.street_after;
    const ms = (n) => ev((n) => { const g = VR.game, gl = g.renderer.gl; window.__norender = false; for (let i = 0; i < 8; i++) { g.last = performance.now() - 33; window.__step(performance.now()); } gl.finish(); const t0 = performance.now(); for (let i = 0; i < n; i++) { g.last = performance.now() - 33; window.__step(performance.now()); gl.finish(); } window.__norender = true; return (performance.now() - t0) / n; }, n);
    const passes = () => ev(() => { const g = VR.game, rr = g.renderer; rr.passLog = true; window.__norender = false; g.last = performance.now() - 33; window.__step(performance.now()); window.__norender = true; rr.passLog = false; const L = rr.stats.fsList || []; return { n: L.length, rdMB: +(L.reduce((a, x) => a + (x.rd || 0), 0) / 1e6).toFixed(1), list: L.map(x => x.name + ' ' + x.w + 'x' + x.h).join(', ') }; });
    for (const pr of ['potato', 'high']) {
      await photoOff(); await preset(pr); await camAt(P, T, EVE); await settle(25);
      const r = { before: [], after: [], passes: {} };
      for (const c of ['before', 'after', 'after', 'before']) { if (r.cur !== c) { await config(c); await run(2); r.cur = c; } if (!r.passes[c]) r.passes[c] = await passes(); for (let k = 0; k < 3; k++) r[c].push(await ms(6)); }
      delete r.cur;
      r.jsms = await ev(() => VR.LField.cost.ms ? +VR.LField.cost.ms.toFixed(3) : 0);
      r.prog = await ev(() => Object.keys(VR.game.renderer.P).length);
      const med = (a) => { const s = a.slice().sort((x, y) => x - y); return +((s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2).toFixed(1); };
      N.cost[pr] = { before: med(r.before), after: med(r.after), minBefore: +Math.min(...r.before).toFixed(1), minAfter: +Math.min(...r.after).toFixed(1), jsms: r.jsms, all: r };
      console.log('     cost ' + pr + ' ' + JSON.stringify({ before: N.cost[pr].before, after: N.cost[pr].after, min: [N.cost[pr].minBefore, N.cost[pr].minAfter], jsms: r.jsms, passes: [r.passes.before.n, r.passes.after.n] }));
      save();
    }
    const P0 = N.cost.potato.all.passes; check(JSON.stringify(P0.before) === JSON.stringify(P0.after), 'Very Low: the same passes and bytes (' + P0.after.n + ' passes)');
    check(await ev(() => !VR.LField.defaults('potato').lfPools && !VR.LField.defaults('low').lfPools), 'Very Low and Low: the switch off');
  }
  save();
  // ---------------------------------------------------------------- the sheet
  const labs = { street: 'Dorfstraße am Abend', carry: 'Laternenträger', festival: 'Festplatz beim Feuerwerk', fairy: 'Märchenort bei Nacht', haven: 'Palmenhafen bei Nacht', home: 'Eigene Siedlung mit Laternenzaun' };
  const rows = [];
  for (const v of ['street', 'carry', 'festival', 'fairy', 'haven', 'home']) { const imgs = ['before', 'after'].map(c => N.pics[v + '_' + c]).filter(Boolean); if (imgs.length) rows.push({ label: labs[v] + ' — vorher | Lichtpfützen', imgs }); }
  if (rows.length) {
    const spec = ROOT + '/.tmp_tests/light_sheet_' + TAG + '.json'; fs.writeFileSync(spec, JSON.stringify({ w: 620, rows }));
    try { console.log('     ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'light_sheet' + (TAG === 'after' ? '' : '_' + TAG) + '.jpg', spec]).toString().trim()); } catch (e) { console.log('  !! sheet ' + e.message.slice(0, 200)); }
  }
} catch (e) { fails++; console.log('  ✗ ' + (e.stack || e.message).slice(0, 1200)); }
const errs = logs.filter(l => l.startsWith('[pageerror]'));
check(errs.length === 0, 'no page error' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
save();
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
