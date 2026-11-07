// r-gemalt · Weiche Natur in the game (plan docs/superpowers/plans/2026-11-07-r-gemalt.md; harness from
// test/qart3_ingame.mjs): seed 4242, a Kreativ world, 1280 × 720, de-DE, dynRes off, renderDist 8. Views WITH SLOPES,
// found by scanning the loaded land: a rolling hill, a cliff face, a riverbank/shore, the spawn meadow, a village street
// (crisp house on soft ground), a cave mouth, a far vista — each at Balanced and High, Weiche Natur off (the cubes, the
// look Nahtlos as before) | on (the preset's default). Costs: ms a drawn frame at the hill view, Very Low / Balanced /
// High, off and on; the opaque vertices of the loaded sections off | on.
// → test/shots/gm_<view>_<preset>_<off|on>_<TAG>.png, test/shots/gemalt_compare.jpg, test/shots/gemalt_thumbs.jpg (320 px)
// usage: nohup bash test/wt_run.sh gemalt_ingame.mjs 3600 > .tmp_tests/gemalt_ingame.log 2>&1 &   TAG · ONLY=hill,…,cost · PRESETS
// regress: skip  (a showcase: the pictures are the evidence; the gate is test/gemalt.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '').replace(/\/\.tmp_tests$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html', SHOTS = ROOT + '/test/shots/';
const TAG = process.env.TAG || 'after';
const ONLY = (process.env.ONLY || 'meadow,hill,cliff,shore,cave,vista,street,cost').split(','), want = (s) => ONLY.includes(s);
const PRESETS = (process.env.PRESETS || 'balanced,high').split(',');
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + ' (' + secs() + ')'); };
const N = { tag: TAG, pics: {}, cams: {}, cost: {}, verts: {}, q: {} };
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/gemalt_ingame_' + TAG + '.json', JSON.stringify(N, null, 1)); } catch (e) { /* */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
page.on('console', m => { if (m.type() === 'error') logs.push('[console] ' + m.text().slice(0, 600)); });
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
// Weiche Natur off (the cubes) or on (the preset's default); every other switch as the preset has it
const config = async (c) => { const r = await ev((c) => {
  const g = VR.game, d = VR.Gemalt.defaults(g.settings._pr || g.settings.preset);
  g.settings.gSoft = c === 'on' ? d.gSoft : false; g.applySettings('gSoft');
  g.settings.preset = g.settings._pr || g.settings.preset;
  return 'gSoft=' + g.settings.gSoft + ' leaf=' + g.world.fancyLeaves + ' look=' + VR.LOOK.mode;
}, c); await run(4); let st = null; for (let k = 0; k < 6; k++) { st = await settle(150); if (st && !st.dirty && !st.busy) break; } if (st && st.dirty) console.log('     (not settled after a remesh: ' + JSON.stringify(st) + ')'); return r; };
const preset = (p) => ev((p) => { const g = VR.game; g.applyPreset(p); g.settings._pr = p; g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.wowMoments = false; g.applySettings('*'); }, p);
const grab = async (name, tod, K = 4) => {
  const url = await ev(([tod, K]) => { const g = VR.game; g.env.setTime(tod); for (let i = 0; i < 2; i++) { g.env.anim = 499; if (g.envFor) g.envFor(g.player.eyePos(), 1, { freezeTime: true, freezeWeather: true }); } window.__norender = false; for (let i = 0; i < K; i++) { g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; window.__step(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; }, [tod, K]);
  if (!url || url.length < 2000) { check(false, 'a picture ' + name); return null; }
  const f = SHOTS + 'gm_' + name + '_' + TAG + '.png'; fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
  N.pics[name] = f; save(); console.log('     📷 ' + name + ' (' + secs() + ')'); return f;
};
const eyeAt = (E, T, tod) => ev(([E, T, tod]) => {
  const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(E[0], E[1] - 1.62, E[2]); p.vel[0] = p.vel[1] = p.vel[2] = 0;
  const dx = T[0] - E[0], dy = T[1] - E[1], dz = T[2] - E[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); g.env.setTime(tod);
}, [E, T, tod]);
const top = (x, z) => ev(([x, z]) => VR.game.world.topAt(Math.floor(x), Math.floor(z)), [x, z]);
const views = async (view, E, T, tod) => {
  for (const pr of PRESETS) {
    await preset(pr); await eyeAt(E, T, tod); await settle(40); await run(20);
    for (const c of ['on', 'off']) { N.q[pr + '_' + c] = await config(c); await eyeAt(E, T, tod); await run(2); await grab(view + '_' + pr + '_' + c, tod); }
  }
};
// the land around c: heights (topAt) and whether the top is natural ground, on a grid
const scan = (c, R, step) => ev(([c, R, step]) => {
  const g = VR.game, w = g.world, SN = VR.SoftNat, T = SN.tables(), F = VR.F, RR = VR.R, out = [];
  for (let gx = -R; gx <= R; gx += step) for (let gz = -R; gz <= R; gz += step) {
    const x = Math.floor((c[0] + gx) / step) * step, z = Math.floor((c[2] + gz) / step) * step;
    if (!w.isLoaded(x, z)) continue;
    const y = w.topAt(x, z), s = w.getBlock(x, y, z);
    out.push([x, z, y, T.soft[s] ? 1 : (s && (RR.T.flags[s] & F.FLUID)) ? 2 : 0]);
  }
  return out;
}, [c, R, step]);

try {
  await page.goto(DIST);
  for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title')) break; }
  await preset(PRESETS[0]);
  await ev(() => { if (VR.Hints) for (const h of ['play', 'move', 'fly', 'bauhand', 'bhring', 'bhundo', 'bhchange']) VR.Hints.done(h); });
  await ev(`VR.game.createWorld({name:'Weiche Natur',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
  for (let i = 0; i < 200; i++) { await wait(500); if (await ev(() => VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)) break; }
  check(await ev(() => VR.game.state) === 'play', 'the world is open');
  await ev(() => {
    const g = VR.game, L0 = Object.getPrototypeOf(g).loop;
    window.__step = (t) => L0.call(g, t); g.loop = function (t) { if (window.__live) return L0.call(this, t); };
    g.zenFreezeWeather = true; g.zenFreezeTime = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar');
    if (VR.UI && VR.UI.hideHud) VR.UI.hideHud(true);
    // the opaque vertices of every uploaded section (renderer.uploadSection)
    const R = VR.Renderer.prototype, u0 = R.uploadSection; R.uploadSection = function (sec, col, sy, opaque) { sec._gmN = opaque ? opaque.length >> 3 : 0; return u0.apply(this, arguments); };
  });
  await settle(80);
  check(await ev(() => VR.game.settings.gSoft === true && VR.game.world.fancyLeaves & 16), 'Balanced: Weiche Natur on by default (the leaf mode carries bit 16)');
  const S0 = await ev(() => { const p = VR.game.player.pos; return [p[0], p[1], p[2]]; });
  N.spawn = S0;
  const AFT = 8400, LATE = 9600;
  // the land: a 3 × 3 tour of 200 m (the scan reads what is loaded at each stop)
  const land = new Map();
  for (const [ox, oz] of [[0, 0], [160, 0], [-160, 0], [0, 160], [0, -160]]) {
    const c0 = [S0[0] + ox, S0[1], S0[2] + oz];
    if (ox || oz) { await eyeAt([c0[0], 160, c0[2]], [c0[0] + 10, 150, c0[2]], AFT); await settle(40); }
    for (const p of await scan(c0, 120, 2)) land.set(p[0] + ',' + p[1], p);
    if (land.size > 30000) break;
  }
  console.log('     scanned ' + land.size + ' columns');
  const H = (x, z) => { const p = land.get(x + ',' + z); return p ? p : null; };
  const near = (x, z) => -Math.hypot(x - S0[0], z - S0[2]) * 0.01;
  // a rolling hill: 5–14 m of rise over a 16 m window, natural tops, no step over 2 between columns 2 apart
  let hill = null, cliff = null, shore = null, meadow = null;
  for (const p of land.values()) {
    const [x, z, y, k] = p; if (k !== 1) continue;
    let lo = 999, hi = -999, maxStep = 0, nat = 0, n = 0, wet = 0;
    for (let dx = -8; dx <= 8; dx += 2) for (let dz = -8; dz <= 8; dz += 2) { const q = H(x + dx, z + dz); if (!q) continue; n++; lo = Math.min(lo, q[2]); hi = Math.max(hi, q[2]); if (q[3] === 1) nat++; if (q[3] === 2) wet++; const r = H(x + dx + 2, z + dz); if (r && r[3] === 1 && q[3] === 1) maxStep = Math.max(maxStep, Math.abs(r[2] - q[2])); }
    if (n < 70) continue;
    const rise = hi - lo;
    if (rise >= 5 && rise <= 14 && maxStep <= 2 && nat > n * 0.85 && !wet) { const sc = rise + near(x, z); if (!hill || sc > hill.sc) hill = { x, z, y, sc, lo, hi }; }
    if (rise >= 2 && rise <= 5 && maxStep <= 1 && nat > n * 0.95 && !wet) { const sc = near(x, z) * 10; if (!meadow || sc > meadow.sc) meadow = { x, z, y, sc, lo, hi }; }
    if (maxStep >= 5 && maxStep <= 24 && nat > n * 0.7 && !wet) { const sc = maxStep + near(x, z) * 2; if (!cliff || sc > cliff.sc) cliff = { x, z, y, sc }; }
    if (wet > n * 0.25 && wet < n * 0.6 && rise >= 2 && nat > n * 0.3) { const sc = rise * 0.5 + near(x, z) * 3; if (!shore || sc > shore.sc) shore = { x, z, y, sc }; }
  }
  console.log('     hill ' + JSON.stringify(hill) + ' · cliff ' + JSON.stringify(cliff) + ' · shore ' + JSON.stringify(shore));
  N.found = { hill, cliff, shore };
  // a camera looking at (x, z) from distance D on the side the sun lights (a little across), eye `up` over the ground
  const sunA = async () => { const s = await ev(() => VR.game.env.E.sunDir.slice()); return Math.atan2(s[2], s[0]); };
  const camAt = async (P, D, up, aOff, tY) => {
    await eyeAt([P.x, 160, P.z], [P.x + 10, 150, P.z], AFT); await settle(40);
    const a = (await sunA()) + aOff;
    const E = [P.x + 0.5 + Math.cos(a) * D, 0, P.z + 0.5 + Math.sin(a) * D];
    const T = [P.x + 0.5, (tY !== undefined ? tY : (await top(P.x, P.z)) + 1), P.z + 0.5];
    // (r1: the eye stood in the hill's flank — never below the ground between it and the target)
    let gmax = 0; for (let k = 0; k <= 8; k++) { const f = k / 8; gmax = Math.max(gmax, await top(E[0] + (T[0] - E[0]) * f * 0.6, E[2] + (T[2] - E[2]) * f * 0.6)); }
    E[1] = Math.max((await top(E[0], E[2])) + 1 + up, gmax + 2.5);
    return { E, T };
  };
  // ---------------------------------------------------------------- the spawn meadow (a little above the eye, looking over its slopes)
  // (r1: the spawn stands on the kit's platform — the meadow nearest the spawn instead: a gentle rise of 2–5 m)
  if (want('meadow')) {
    if (meadow) { const c = await camAt(meadow, 22, 2.2, 1.3, meadow.lo + 1); N.cams.meadow = c; await views('meadow', c.E, c.T, AFT); }
    else check(false, 'a meadow near the spawn');
  }
  if (want('hill')) { if (hill) { const c = await camAt(hill, 34, 3, 0.9, hill.lo + (hill.hi - hill.lo) * 0.6); N.cams.hill = c; await views('hill', c.E, c.T, AFT); } else check(false, 'a rolling hill near the spawn'); }
  if (want('cliff')) { if (cliff) { const c = await camAt(cliff, 16, 2, 0.6); c.T[1] -= 2; N.cams.cliff = c; await views('cliff', c.E, c.T, AFT); } else check(false, 'a cliff near the spawn'); }
  if (want('shore')) {
    if (shore) {
      // on the land side, low, looking along the bank toward the water
      const r2 = (v) => Math.floor(v / 2) * 2;
      let best = null; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, q = H(r2(shore.x + Math.cos(a) * 10), r2(shore.z + Math.sin(a) * 10)); if (q && q[3] === 1 && (!best || q[2] > best.y)) best = { a, y: q[2] }; }
      const a = best ? best.a : 0;
      await eyeAt([shore.x, 160, shore.z], [shore.x + 10, 150, shore.z], AFT); await settle(40);
      const E = [shore.x + Math.cos(a) * 16, 0, shore.z + Math.sin(a) * 16]; E[1] = Math.max((await top(E[0], E[2])) + 1 + 4, (await top(shore.x, shore.z)) + 6);
      const T = [shore.x - Math.cos(a + 0.4) * 22, (await top(shore.x, shore.z)) - 1, shore.z - Math.sin(a + 0.4) * 22];
      N.cams.shore = { E, T }; await views('shore', E, T, AFT);
    } else check(false, 'a shore near the spawn');
  }
  // ---------------------------------------------------------------- a cave mouth: air under a slope that opens to the side
  if (want('cave')) {
    let cave = null;
    if (hill || cliff) {
      for (const P of [cliff, hill].filter(Boolean)) {
        await eyeAt([P.x, 160, P.z], [P.x + 10, 150, P.z], AFT); await settle(40);
        const f = await ev((P) => { const w = VR.game.world, F = VR.F, R = VR.R; const op = (x, y, z) => { const s = w.getBlock(x, y, z); return s && (R.T.flags[s] & F.OPAQUE); };
          let best = null;
          for (let dx = -60; dx <= 60; dx++) for (let dz = -60; dz <= 60; dz++) { const x = P.x + dx, z = P.z + dz; if (!w.isLoaded(x, z)) continue; const t = w.topAt(x, z);
            for (let y = t - 3; y > t - 14; y--) { if (op(x, y, z) || op(x, y + 1, z) || !op(x, y - 1, z) || !op(x, y + 2, z)) continue;
              for (let k = 0; k < 4; k++) { const ex = x + [1, -1, 0, 0][k] * 3, ez = z + [0, 0, 1, -1][k] * 3; if (w.isLoaded(ex, ez) && w.topAt(ex, ez) < y && !op(x + [1, -1, 0, 0][k], y, z + [0, 0, 1, -1][k])) { let air = 0; for (let a = -2; a <= 2; a++) for (let b = 0; b <= 2; b++) for (let c = -2; c <= 2; c++) if (!op(x + a, y + b, z + c)) air++; const sc = air + Math.min(8, t - y) - Math.hypot(dx, dz) * 0.02; if (air >= 30 && (!best || sc > best.sc)) best = { x, y, z, k, sc, air }; } } break; } }
          return best; }, { x: Math.floor(P.x), z: Math.floor(P.z) });
        if (f && (!cave || f.sc > cave.sc)) cave = f;
      }
    }
    console.log('     cave ' + JSON.stringify(cave));
    if (cave) {
      const dx = [1, -1, 0, 0][cave.k], dz = [0, 0, 1, -1][cave.k];
      const E = [cave.x + 0.5 + dx * 10 + dz * 2, cave.y + 2.6, cave.z + 0.5 + dz * 10 + dx * 2], T = [cave.x + 0.5 - dx * 2, cave.y + 1.0, cave.z + 0.5 - dz * 2];
      N.cams.cave = { E, T }; await views('cave', E, T, AFT);
    } else check(false, 'a cave mouth near the spawn');
  }
  // ---------------------------------------------------------------- the far vista: high over the hills, the near ground and the far tiles
  if (want('vista')) {
    const P = hill || { x: Math.floor(S0[0]), z: Math.floor(S0[2]) };
    await eyeAt([P.x, 160, P.z], [P.x + 10, 150, P.z], AFT); await settle(40);
    const a = (await sunA()) + 2.3;
    const E = [P.x + Math.cos(a) * 30, 0, P.z + Math.sin(a) * 30]; E[1] = (await top(E[0], E[2])) + 1 + 22;
    const T = [P.x - Math.cos(a) * 160, E[1] - 30, P.z - Math.sin(a) * 160];
    N.cams.vista = { E, T }; await views('vista', E, T, AFT);
  }
  // ---------------------------------------------------------------- the village street: crisp houses on soft ground
  if (want('street')) {
    const v = await ev((S0) => { const M = VR.game.villages; let best = null, bd = 1e9; for (const v of M.known.values()) { const P = v.plan && v.plan.plaza; const c = P ? [P.x, P.z] : [v.x, v.z]; if (c[0] === undefined) continue; const d = Math.hypot(c[0] - S0[0], c[1] - S0[2]); if (d < bd) { bd = d; best = { c, d } } } return best; }, S0);
    if (v) {
      await eyeAt([v.c[0], 140, v.c[1]], [v.c[0] + 10, 130, v.c[1]], 8000); await settle(40); await run(60);
      const f = await ev(([c]) => { const g = VR.game, F3 = VR.Folk3, y = g.world.topAt(Math.floor(c[0]), Math.floor(c[1])) + 1; const C = [c[0] + 0.5, y, c[1] + 0.5]; const fr = F3 && F3.frameGroup ? F3.frameGroup(F3.solidW(g.world), C, 6, { sun: F3.sunAngle ? F3.sunAngle(g) : null }) : null; return fr ? { P: fr.P, T: [C[0], y + 1.2, C[2]] } : { P: [C[0] + 12, y, C[2] + 5], T: [C[0], y + 1.2, C[2]] }; }, [v.c]);
      const D = [f.P[0] - f.T[0], f.P[2] - f.T[2]], L = Math.hypot(D[0], D[1]) || 1, back = Math.max(14, L * 1.8);
      const E = [f.T[0] + D[0] / L * back, 0, f.T[2] + D[1] / L * back]; E[1] = (await top(E[0], E[2])) + 1 + 3.5;
      N.cams.street = { E, T: f.T };
      await views('street', E, [f.T[0], E[1] - 2.5, f.T[2]], LATE);
    } else check(false, 'a village known');
  }
  save();
  // ---------------------------------------------------------------- costs at the hill (or the meadow)
  if (want('cost')) {
    const C = N.cams.hill || N.cams.meadow;
    const ready = async () => { for (let i = 0; i < 120; i++) { const n = await ev(() => { const g = VR.game; window.__norender = false; g.last = performance.now() - 33; window.__step(performance.now()); g.renderer.gl.finish(); window.__norender = true; return VR.GL.pending ? VR.GL.pending.size : 0; }); if (!n) return; await wait(250); } check(false, 'the programs compiled'); };
    const ms = (n) => ev((n) => { const g = VR.game, gl = g.renderer.gl; window.__norender = false; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; window.__step(performance.now()); } gl.finish(); const t0 = performance.now(); for (let i = 0; i < n; i++) { g.last = performance.now() - 33; window.__step(performance.now()); gl.finish(); } window.__norender = true; return (performance.now() - t0) / n; }, n);
    const verts = () => ev(() => { let n = 0, s = 0; for (const c of VR.game.world.cols.values()) for (const sc of c.sec) if (sc._gmN) { n += sc._gmN; s++; } return { verts: n, sections: s }; });
    const med = (a) => { const s = a.slice().sort((x, y) => x - y); return +s[s.length >> 1].toFixed(1); };
    for (const pr of ['potato', 'balanced', 'high']) {
      await preset(pr); await eyeAt(C.E, C.T, AFT); await settle(25);
      const r = { off: [], on: [], verts: {} };
      for (let round = 0; round < 2; round++) for (const c of ['on', 'off']) { N.q['cost_' + pr + '_' + c] = await config(c); await eyeAt(C.E, C.T, AFT); await run(2); await ready(); await ms(4); r[c].push(await ms(6)); if (!round) r.verts[c] = await verts(); }
      N.cost[pr] = { off: med(r.off), on: med(r.on), offAll: r.off.map(v => +v.toFixed(1)), onAll: r.on.map(v => +v.toFixed(1)), verts: r.verts };
      console.log('     cost ' + pr + ': off ' + N.cost[pr].off + ' ms · on ' + N.cost[pr].on + ' ms · opaque verts ' + JSON.stringify(r.verts));
      save();
    }
    check(N.cost.potato && JSON.stringify(N.cost.potato.verts.on) === JSON.stringify(N.cost.potato.verts.off), 'Very Low: the same mesh with the switch as without (the preset never asks)');
  }
  // ---------------------------------------------------------------- the sheets
  const VN = [['meadow', 'Wiese am Spawn'], ['hill', 'Sanfter Hügel'], ['cliff', 'Klippe'], ['shore', 'Ufer'], ['street', 'Dorfstraße: Haus auf weichem Boden'], ['cave', 'Höhleneingang'], ['vista', 'Fernblick']];
  const PN = { balanced: 'Ausgewogen', high: 'Hoch', ultra: 'Ultra' };
  const rows = [];
  for (const [v, lab] of VN) for (const pr of PRESETS) { const imgs = ['off', 'on'].map(c => N.pics[v + '_' + pr + '_' + c]).filter(Boolean); if (imgs.length) rows.push({ label: lab + ' — ' + (PN[pr] || pr) + ': Würfel | Weiche Natur', imgs }); }
  if (rows.length) {
    const spec = ROOT + '/.tmp_tests/gemalt_sheet_' + TAG + '.json'; fs.writeFileSync(spec, JSON.stringify({ w: 620, rows }));
    const tspec = ROOT + '/.tmp_tests/gemalt_thumbs_' + TAG + '.json'; fs.writeFileSync(tspec, JSON.stringify({ w: 320, rows: rows.filter(r => r.label.includes('Ausgewogen') || PRESETS.length === 1).map(r => ({ label: r.label.replace(' — Ausgewogen', ' · Ausgewogen'), imgs: r.imgs })) }));
    try { console.log('     ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + (TAG === 'after' ? 'gemalt_thumbs.jpg' : 'gemalt_thumbs_' + TAG + '.jpg'), tspec]).toString().trim()); } catch (e) { console.log('  !! thumbs ' + e.message.slice(0, 200)); }
    try { console.log('     ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + (TAG === 'after' ? 'gemalt_compare.jpg' : 'gemalt_compare_' + TAG + '.jpg'), spec]).toString().trim()); } catch (e) { console.log('  !! sheet ' + e.message.slice(0, 200)); }
  }
} catch (e) { fails++; console.log('  ✗ ' + (e.stack || e.message).slice(0, 1200)); }
const errs = logs.filter(l => l.startsWith('[pageerror]'));
check(errs.length === 0, 'no page error' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
const cerr = logs.filter(l => l.startsWith('[console]') && /shader|program|GLSL|compile/i.test(l));
check(cerr.length === 0, 'no shader error in the console' + (cerr.length ? ': ' + cerr.slice(0, 2).join(' | ') : ''));
save();
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
