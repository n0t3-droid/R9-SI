// r-gemalt 2 · Gemaltes Licht in the game (plan docs/superpowers/plans/2026-11-07-r-gemalt2.md; harness and pinned views
// from test/gemalt_ingame.mjs): seed 4242, Kreativ, 1280 × 720, de-DE, renderDist 8. Views: the spawn's meadows, the rolling
// meadow, a lawn up close (with a trampled path), the shore and its water, the vista (the air in bands), the meadow at dusk,
// the village street — Balanced and High, Gemaltes Licht / Pinselgras / Gemaltes Wasser off (v0.55.46's picture, Weiche
// Natur on as the preset has it) | on. Costs: ms a frame at the meadow and the lawn, Very Low / Balanced / High, off | on.
// → test/shots/gm2_<view>_<preset>_<off|on>_<TAG>.png, test/shots/gemalt2_compare.jpg, test/shots/gemalt2_thumbs.jpg (320 px)
// usage: nohup bash test/wt_run.sh gemalt2_ingame.mjs 5400 > .tmp_tests/gemalt2_ingame.log 2>&1 &   TAG · ONLY · PRESETS · COSTP · DUSK
// regress: skip  (a showcase: the pictures are the evidence; the gate is test/gemalt2.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '').replace(/\/\.tmp_tests$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html', SHOTS = ROOT + '/test/shots/';
const TAG = process.env.TAG || 'after';
const ONLY = (process.env.ONLY || 'spawn,meadow,lawn,shore,vista,dusk,street,cost').split(','), want = (s) => ONLY.includes(s);
const PRESETS = (process.env.PRESETS || 'balanced,high').split(',');
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + ' (' + secs() + ')'); };
const N = { tag: TAG, pics: {}, cams: {}, cost: {}, verts: {}, q: {} };
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/gemalt2_ingame_' + TAG + '.json', JSON.stringify(N, null, 1)); } catch (e) { /* */ } };
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
// Gemaltes Licht off (v0.55.46's picture: Weiche Natur as the preset has it) | on (the preset's defaults)
const config = async (c) => { const r = await ev((c) => {
  const g = VR.game, pr = g.settings._pr || g.settings.preset, d = VR.Gemalt2.defaults(pr);
  for (const k of VR.Gemalt2.SW) { g.settings[k] = c === 'on' ? d[k] : false; g.applySettings(k); }
  g.settings.preset = pr;
  return VR.Gemalt2.key(g.settings) + ' gSoft=' + g.settings.gSoft + ' look=' + VR.LOOK.mode;
}, c); await run(4); let st = null; for (let k = 0; k < 4; k++) { st = await settle(150); if (st && !st.dirty && !st.busy) break; } return r; };
const preset = (p) => ev((p) => { const g = VR.game; g.applyPreset(p); g.settings._pr = p; g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.wowMoments = false; g.applySettings('*'); }, p);
const grab = async (name, tod, K = 4) => {
  const url = await ev(([tod, K]) => { const g = VR.game; g.env.setTime(tod); for (let i = 0; i < 2; i++) { g.env.anim = 499; if (g.envFor) g.envFor(g.player.eyePos(), 1, { freezeTime: true, freezeWeather: true }); } window.__norender = false; for (let i = 0; i < K; i++) { g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; window.__step(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; }, [tod, K]);
  if (!url || url.length < 2000) { check(false, 'a picture ' + name); return null; }
  const f = SHOTS + 'gm2_' + name + '_' + TAG + '.png'; fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
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

try {
  await page.goto(DIST);
  for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title')) break; }
  await preset(PRESETS[0]);
  await ev(() => { if (VR.Hints) for (const h of ['play', 'move', 'fly', 'bauhand', 'bhring', 'bhundo', 'bhchange']) VR.Hints.done(h); });
  await ev(`VR.game.createWorld({name:'Gemaltes Licht',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
  for (let i = 0; i < 200; i++) { await wait(500); if (await ev(() => VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)) break; }
  check(await ev(() => VR.game.state) === 'play', 'the world is open');
  await ev(() => {
    const g = VR.game, L0 = Object.getPrototypeOf(g).loop;
    window.__step = (t) => L0.call(g, t); g.loop = function (t) { if (window.__live) return L0.call(this, t); };
    g.zenFreezeWeather = true; g.zenFreezeTime = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar');
    if (VR.UI && VR.UI.hideHud) VR.UI.hideHud(true);
  });
  await settle(80);
  check(await ev(() => VR.Gemalt2.key(VR.game.settings) === '111' && VR.game.settings.gSoft === true), 'Balanced: Gemaltes Licht, Pinselgras, Gemaltes Wasser on by default (Weiche Natur too)');
  const AFT = 8400, LATE = 9600, DUSK = +(process.env.DUSK || 11500);
  const PINS = {
    spawn: { E: [0.5, 127.4, 4.5], T: [-28.56, 122.4, -22.98] },
    meadow: { E: [-89.47, 99, 177.58], T: [-73.5, 94, 178.5] },
    shore: { E: [188.53, 72, 99.58], T: [204.5, 64, 100.5] },
    vista: { E: [47.57, 103, 138.52], T: [12.3, 73, 325.22] },
    street: { E: [-16.7, 84.5, -54.5], T: [-0.5, 82.2, -54.5] },
    dusk: { E: [-89.47, 99, 177.58], T: [-73.5, 94, 178.5] },
  };
  const order = ['spawn', 'meadow', 'lawn', 'shore', 'vista', 'dusk', 'street'];
  for (const v of order) {
    if (!want(v)) continue;
    if (v === 'lawn') {
      // the lawn up close: the flattest grass near the meadow's view, the eye 1.7 above it, looking 6 m along it
      await eyeAt([-73.5, 140, 178.5], [-63.5, 130, 178.5], AFT); await settle(40);
      const L = await ev(() => { const w = VR.game.world, TB = VR.SoftNat.tables(); let best = null;
        for (let x = -100; x <= -50; x++) for (let z = 150; z <= 205; z++) { const t = w.topAt(x, z); if (TB.mat[w.getBlock(x, t, z)] !== 1) continue; let flat = 0, n = 0; for (let k = 1; k <= 8; k++) { const t2 = w.topAt(x + k, z); n++; if (Math.abs(t2 - t) <= 1 && TB.mat[w.getBlock(x + k, t2, z)] === 1 && !w.getBlock(x + k, t2 + 1, z)) flat++; } const sc = flat - Math.hypot(x + 73.5, z - 178.5) * 0.02; if (!best || sc > best.sc) best = { x, z, t, sc }; }
        return best; });
      console.log('     lawn ' + JSON.stringify(L));
      if (!L) { check(false, 'a lawn'); continue; }
      const E = [L.x + 0.5, L.t + 1 + 1.7, L.z + 0.5], T = [L.x + 7.5, L.t + 1, L.z + 0.5];
      N.cams.lawn = { E, T };
      for (const pr of PRESETS) {
        await preset(pr); await eyeAt(E, T, AFT); await settle(40); await run(20);
        for (const c of ['on', 'off']) { N.q[pr + '_' + c] = await config(c); await eyeAt(E, T, AFT); await run(2);
          // a body walked across the lawn just now (the trampled marks: Pinselgras lays the clumps flat there)
          await ev(([x, z]) => { const G2 = VR.Gemalt2, now = performance.now() / 1000; G2.marks.length = 0; for (let k = 0; k < 8; k++) G2.step(G2.marks, x + 3 + k * 0.4, z - 1.2 + k * 0.35, now); }, [L.x, L.z]);
          await grab('lawn_' + pr + '_' + c, AFT);
          const n = await ev(() => VR.game.renderer.gmT ? VR.game.renderer.gmT.n : 0); N.tufts = N.tufts || {}; N.tufts[pr + '_' + c] = n;
          if (c === 'on') check(n > 50, pr + ': the grass clumps on the lawn (' + n + ')'); }
      }
      continue;
    }
    const c = PINS[v]; N.cams[v] = c; await views(v, c.E, c.T, v === 'street' ? LATE : v === 'dusk' ? DUSK : AFT);
  }
  save();
  const VN = [['spawn', 'Spawn: Blick über die Wiesen'], ['meadow', 'Sanfte Hügel'], ['lawn', 'Wiese aus der Nähe (Pinselgras, ein Trampelpfad)'], ['shore', 'Ufer und Wasser'], ['vista', 'Fernblick: Luft in Schichten'], ['dusk', 'Abenddämmerung: warmes Licht, violette Schatten'], ['street', 'Dorfstraße: ein Licht für Haus und Land']];
  const PN = { balanced: 'Ausgewogen', high: 'Hoch', ultra: 'Ultra' };
  const rows = [];
  for (const [v, lab] of VN) for (const pr of PRESETS) { const imgs = ['off', 'on'].map(c => N.pics[v + '_' + pr + '_' + c]).filter(Boolean); if (imgs.length) rows.push({ label: lab + ' — ' + (PN[pr] || pr) + ': vorher | Gemaltes Licht', imgs }); }
  if (rows.length) {
    const spec = ROOT + '/.tmp_tests/gemalt2_sheet_' + TAG + '.json'; fs.writeFileSync(spec, JSON.stringify({ w: 620, rows }));
    const tspec = ROOT + '/.tmp_tests/gemalt2_thumbs_' + TAG + '.json'; fs.writeFileSync(tspec, JSON.stringify({ w: 320, rows: rows.filter(r => r.label.includes('Ausgewogen') || PRESETS.length === 1).map(r => ({ label: r.label.replace(' — Ausgewogen', ' · Ausgewogen'), imgs: r.imgs })) }));
    try { console.log('     ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + (TAG === 'after' ? 'gemalt2_thumbs.jpg' : 'gemalt2_thumbs_' + TAG + '.jpg'), tspec]).toString().trim()); } catch (e) { console.log('  !! thumbs ' + e.message.slice(0, 200)); }
    try { console.log('     ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + (TAG === 'after' ? 'gemalt2_compare.jpg' : 'gemalt2_compare_' + TAG + '.jpg'), spec]).toString().trim()); } catch (e) { console.log('  !! sheet ' + e.message.slice(0, 200)); }
  }
  // ---------------------------------------------------------------- costs at the meadow (and the lawn): off | on
  if (want('cost')) {
    const ready = async () => { for (let i = 0; i < 120; i++) { const n = await ev(() => { const g = VR.game; window.__norender = false; g.last = performance.now() - 33; window.__step(performance.now()); g.renderer.gl.finish(); window.__norender = true; return VR.GL.pending ? VR.GL.pending.size : 0; }); if (!n) return; await wait(250); } check(false, 'the programs compiled'); };
    const ms = (n) => ev((n) => { const g = VR.game, gl = g.renderer.gl; window.__norender = false; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; window.__step(performance.now()); } gl.finish(); const t0 = performance.now(); for (let i = 0; i < n; i++) { g.last = performance.now() - 33; window.__step(performance.now()); gl.finish(); } window.__norender = true; return (performance.now() - t0) / n; }, n);
    const best = (a) => +Math.min(...a).toFixed(1);
    const CP = (process.env.COSTP || 'potato,balanced,high').split(',');
    for (const view of ['meadow', 'lawn']) {
      const C = N.cams[view]; if (!C) continue;
      for (const pr of CP) {
        if (view === 'lawn' && pr === 'potato') continue;
        await preset(pr); await eyeAt(C.E, C.T, AFT); await settle(25);
        const r = { off: [], on: [] };
        for (let round = 0; round < 3; round++) for (const c of (round & 1 ? ['off', 'on'] : ['on', 'off'])) { await config(c); await eyeAt(C.E, C.T, AFT); await run(2); await ready(); await ms(3); r[c].push(await ms(6)); }
        const tufts = await ev(() => VR.game.renderer.gmT ? VR.game.renderer.gmT.n : 0);
        N.cost[view + '_' + pr] = { off: best(r.off), on: best(r.on), offAll: r.off.map(v => +v.toFixed(1)), onAll: r.on.map(v => +v.toFixed(1)), tufts };
        console.log('     cost ' + view + ' ' + pr + ': off ' + N.cost[view + '_' + pr].off + ' ms · on ' + N.cost[view + '_' + pr].on + ' ms · clumps ' + tufts + ' (' + secs() + ')');
        save();
      }
    }
    const b = N.cost.meadow_balanced; if (b) check(b.on - b.off <= 3, 'Balanced at the meadow: ≤ +3 ms (' + b.off + ' → ' + b.on + ')');
    const p = N.cost.meadow_potato; if (p) check(p.on - p.off <= 1.5, 'Very Low: unchanged within noise (' + p.off + ' | ' + p.on + ' — the switches never on)');
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
