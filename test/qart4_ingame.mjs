// q-art4 · Runde Inseln and the round crowns' polish (plan docs/superpowers/plans/2026-11-07-q-art4.md), in the game:
// the player's own eye, 1280 × 720, de-DE, seed 4242, a Kreativ world, Balanced and High, dynRes off, renderDist 8.
// Views (each off | on): isles — the nearest big isle from the ground, looking up; meadow — the spawn meadow; vista — a
// far view over the land toward the isles; cliff and hill — a stone cliff and a rolling hill, PINNED by coordinates
// (.tmp_tests/qart4_cams.json: found in the first run, reused after), with Runde Hänge (qHill) off | on — the decision.
// "off" = q-art4 off (qIsleForm false, the crowns' polish off: VR.QArt4.polish); "on" = the preset's defaults.
// cost: ms a drawn frame at the meadow, Very Low / Balanced / High, off and on; the full-screen passes the same.
// → test/shots/qa4_<view>_<preset>_<off|on>_<TAG>.png, test/shots/qart4_compare.jpg, test/shots/qart4_thumbs.jpg (320 px)
// usage: nohup bash test/wt_run.sh qart4_ingame.mjs 3600 > .tmp_tests/qart4_ingame.log 2>&1 &   TAG · ONLY=isles,… · PRESETS=balanced,high
// regress: skip  (a showcase: the pictures are the evidence; the gate is test/qart4.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '').replace(/\/\.tmp_tests$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html', SHOTS = ROOT + '/test/shots/';
const TAG = process.env.TAG || 'after';
const ONLY = (process.env.ONLY || 'isles,meadow,vista,cliff,hill,cost').split(','), want = (s) => ONLY.includes(s);
const PRESETS = (process.env.PRESETS || 'balanced,high').split(',');
const CAMS = ROOT + '/.tmp_tests/qart4_cams.json';
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + ' (' + secs() + ')'); };
const N = { tag: TAG, pics: {}, cams: {}, cost: {}, q: {} };
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/qart4_ingame_' + TAG + '.json', JSON.stringify(N, null, 1)); } catch (e) { /* */ } };
let PIN = {}; try { PIN = JSON.parse(fs.readFileSync(CAMS, 'utf8')); } catch (e) { PIN = {}; }
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
// settled: the chunks meshed and uploaded, and the far land's tiles (horizon, ring 1) all in
const settle = async (max = 60) => {
  let s = null;
  for (let i = 0; i < max; i++) {
    await run(20);
    s = await ev(() => {
      const g = VR.game, w = g.world, p = g.player; if (!w || !p || g.state !== 'play') return { state: g.state };
      const rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4;
      let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if (sc.dirty || sc.pending) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= rd * rd) dirty += n; }
      const hz = g.horizon, hb = hz ? (hz.inflight | 0) + (hz.far ? hz.far.inflight | 0 : 0) + (hz.stats.want | 0) + (hz.stats.coarse < 1 ? 1 : 0) : 0;   // (run 2: the vista's 'on' frame had no far land — the tiles wanted were not asked for yet)
      return { state: g.state, busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, hz: hb };
    });
    if (s.state === 'play' && s.busy === 0 && s.pend === 0 && s.dirty === 0 && s.up === 0 && s.hz <= 2 && i > 2) break;
    await wait(40);
  }
  return s;
};
// kind 'isle': q-art4 off | on (the preset's defaults); kind 'hill': Runde Hänge off | on (the decision)
const config = async (c, kind) => { const r = await ev(([c, kind]) => {
  const g = VR.game, X = VR.QArt4, S = g.settings;
  if (kind === 'hill') { S.qHill = c === 'on'; g.applySettings('qHill'); }
  else { const d = X.defaults(S._pr || S.preset); X.polish = c === 'on'; S.qIsleForm = c === 'on' ? d.qIsleForm : false; g.applySettings('qIsleForm'); }
  S.preset = S._pr || S.preset;
  return 'isle=' + S.qIsleForm + ' polish=' + X.polish + ' hill=' + !!S.qHill + ' leaf=' + g.world.fancyLeaves + ' hz=' + !!(g.horizon && g.horizon.isleForm);
}, [c, kind]); await run(4); let st = null; for (let k = 0; k < 3; k++) { st = await settle(70); if (st && !st.dirty && !st.busy && st.hz <= 2) break; } if (st && (st.dirty || st.hz)) console.log('     (not settled: ' + JSON.stringify(st) + ')'); return r; };   // (run 2: High's far tiles kept a few in flight — waiting for none took 10 min a switch)
const preset = (p) => ev((p) => { const g = VR.game; g.applyPreset(p); g.settings._pr = p; g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.wowMoments = false; g.settings.qHill = false; if (VR.QArt4) VR.QArt4.polish = true; g.applySettings('*'); }, p);
const grab = async (name, tod, K = 4) => {
  const url = await ev(([tod, K]) => { const g = VR.game; g.env.setTime(tod); for (let i = 0; i < 2; i++) { g.env.anim = 499; if (g.envFor) g.envFor(g.player.eyePos(), 1, { freezeTime: true, freezeWeather: true }); } window.__norender = false; for (let i = 0; i < K; i++) { g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; window.__step(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; }, [tod, K]);
  if (!url || url.length < 2000) { check(false, 'a picture ' + name); return null; }
  const f = SHOTS + 'qa4_' + name + '_' + TAG + '.png'; fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
  N.pics[name] = f; save(); console.log('     📷 ' + name + ' (' + secs() + ')'); return f;
};
const eyeAt = (E, T, tod) => ev(([E, T, tod]) => {
  const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(E[0], E[1] - 1.62, E[2]); p.vel[0] = p.vel[1] = p.vel[2] = 0;
  const dx = T[0] - E[0], dy = T[1] - E[1], dz = T[2] - E[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); g.env.setTime(tod);
}, [E, T, tod]);
const top = (x, z) => ev(([x, z]) => VR.game.world.topAt(Math.floor(x), Math.floor(z)), [x, z]);
// (run 1: the meadow's eye stood at y 2 — the spawn's chunks were not loaded while the eye was at the isles) the ground
// at (x, z) with its chunks loaded: the eye above it first
const ground = async (x, z) => { await eyeAt([x, 150, z], [x + 10, 140, z], 6000); await settle(40); return top(x, z); };
const views = async (view, E, T, tod, kind) => {
  for (const pr of PRESETS) {
    await preset(pr); await eyeAt(E, T, tod); await settle(40); await run(20);
    for (const c of ['on', 'off']) { N.q[view + '_' + pr + '_' + c] = await config(c, kind); await eyeAt(E, T, tod); await run(2); await grab(view + '_' + pr + '_' + c, tod); }
  }
};

try {
  await page.goto(DIST);
  for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title')) break; }
  await preset(PRESETS[0]);
  await ev(() => { if (VR.Hints) for (const h of ['play', 'move', 'fly', 'bauhand', 'bhring', 'bhundo', 'bhchange']) VR.Hints.done(h); });
  await ev(`VR.game.createWorld({name:'Bildregie',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
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
  // the isles round the spawn (the generator's own pure functions, qart2.js), nearest first
  const isles = await ev((S0) => { const Q2 = VR.QArt2, L = (Q2 && Q2.islesNear(Q2.gen(VR.game), S0)) || []; return L.map(I => ({ x: I.x, z: I.z, r: I.r, y: I.y, deep: I.deep, d: Math.hypot(I.x - S0[0], I.z - S0[2]) })); }, S0);
  console.log('     isles ' + isles.length + ' ' + JSON.stringify(isles.slice(0, 4)));
  const sunA = async () => { const s = await ev(() => VR.game.env.E.sunDir.slice()); return Math.atan2(s[2], s[0]); };

  // ---------------------------------------------------------------- an isle from the ground, looking up
  if (want('isles')) {
    const TOD = 7200, I = isles.filter(J => J.r >= 12).sort((a, b) => (a.d - a.r * 4) - (b.d - b.r * 4))[0];
    if (I) {
      await eyeAt([I.x, 150, I.z - 30], [I.x, 140, I.z], TOD); await settle(40);
      // (run 1: from r·1.25 the eye looked straight up into the undersides — now from about 2.6 r, the silhouettes)
      const a = (await sunA()) + 2.4, R = I.r * 2.6 + 18;
      const E = [I.x + Math.cos(a) * R, 0, I.z + Math.sin(a) * R]; E[1] = (await ground(E[0], E[2])) + 1 + 1.62;
      const T = [I.x, I.y - I.r * I.deep * 0.5, I.z];
      N.cams.isles = PIN.isles || { E, T };
      await views('isles', N.cams.isles.E, N.cams.isles.T, TOD, 'isle');
    } else check(false, 'a big isle near the spawn');
  }
  // ---------------------------------------------------------------- the spawn meadow, afternoon, toward the isles
  const AFT = 8200;
  if (want('meadow') || want('cost')) {
    let cam = PIN.meadow;
    if (!cam) {
      // (run 2: 14 m from the spawn the eye faced a station's wall — the spawn stands in a town) the open grass nearest the
      // spawn whose ground stays level for 40 m toward the isles: the meadow
      const far = isles.filter(J => J.d > 60 && J.d < 400), J = far[0] || isles[0];
      const a = J ? Math.atan2(J.z - S0[2], J.x - S0[0]) : 0;
      await ground(S0[0], S0[2]);
      const M0 = await ev(([S0, a]) => {
        const g = VR.game, w = g.world, R = VR.R; let best = null;
        const nm = (x, z) => { const y = w.topAt(Math.floor(x), Math.floor(z)), s = w.getBlock(Math.floor(x), y, Math.floor(z)), t = s ? R.types[R.T.type[s]] : null; return [y, t ? t.name : '']; };
        for (let gx = -104; gx <= 104; gx += 8) for (let gz = -104; gz <= 104; gz += 8) {
          const x = S0[0] + gx, z = S0[2] + gz; if (!w.isLoaded(Math.floor(x), Math.floor(z))) continue;
          const [h, n] = nm(x, z); if (n !== 'grass_block') continue;
          let ok = 0; for (let d = 4; d <= 40; d += 4) { const [y2, n2] = nm(x + Math.cos(a) * d, z + Math.sin(a) * d); if (Math.abs(y2 - h) <= 3 && /grass|leaves|flower|fern|dirt/.test(n2)) ok++; }
          const sc = ok * 10 - Math.hypot(gx, gz) * 0.08; if (ok >= 8 && (!best || sc > best.sc)) best = { x, z, h, sc };
        }
        return best;
      }, [S0, a]);
      console.log('     meadow ' + JSON.stringify(M0));
      const M = M0 ? [M0.x, M0.h + 1 + 1.62, M0.z] : [S0[0] - Math.cos(a) * 14, 0, S0[2] - Math.sin(a) * 14]; if (!M0) M[1] = (await ground(M[0], M[2])) + 1 + 1.62;
      cam = { E: M, T: [M[0] + Math.cos(a) * 40, M[1] + 4, M[2] + Math.sin(a) * 40] };
    }
    N.cams.meadow = cam;
    if (want('meadow')) await views('meadow', cam.E, cam.T, AFT, 'isle');
    if (want('cost')) {
      const ready = async () => { for (let i = 0; i < 120; i++) { const n = await ev(() => { const g = VR.game; window.__norender = false; g.last = performance.now() - 33; window.__step(performance.now()); g.renderer.gl.finish(); window.__norender = true; return VR.GL.pending ? VR.GL.pending.size : 0; }); if (!n) return; await wait(250); } check(false, 'the programs compiled'); };
      const ms = (n) => ev((n) => { const g = VR.game, gl = g.renderer.gl; window.__norender = false; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; window.__step(performance.now()); } gl.finish(); const t0 = performance.now(); for (let i = 0; i < n; i++) { g.last = performance.now() - 33; window.__step(performance.now()); gl.finish(); } window.__norender = true; return (performance.now() - t0) / n; }, n);
      const passes = () => ev(() => { const g = VR.game, rr = g.renderer; rr.passLog = true; window.__norender = false; g.last = performance.now() - 33; window.__step(performance.now()); window.__norender = true; rr.passLog = false; const L = rr.stats.fsList || []; return { n: L.length }; });
      const tris = () => ev(() => { const h = VR.game.horizon; return h ? { tris: h.stats.tris | 0, drawn: h.stats.drawn | 0, tiles: h.tiles.size, mb: +(h.stats.mb || 0).toFixed(1) } : null; });
      // (run 4: High's 'on' sample had the horizon still rebuilding — drawn 0 tiles, 50 ms of uploads: wait for the far land back)
      const hzWait = async () => { for (let i = 0; i < 90; i++) { await run(20); const s = await ev(() => { const h = VR.game.horizon; return !h || ((h.stats.drawn | 0) > 0 && !(h.inflight | 0) && !(h.far && h.far.inflight | 0) && !(h.stats.want | 0)); }); if (s) return; await wait(500); } console.log('     (the far land not back after the switch)'); };
      for (const pr of ['potato', 'balanced', 'high']) {
        await preset(pr); await eyeAt(cam.E, cam.T, AFT); await settle(25);
        const r = { off: [], on: [], p: {}, hz: {} };
        for (const c of ['on', 'off', 'on', 'off']) { await config(c, 'isle'); await hzWait(); await ready(); await ms(4); r[c].push(await ms(6)); r.p[c] = (await passes()).n; r.hz[c] = await tris(); }
        const med = (a) => +Math.min.apply(null, a).toFixed(1);   // (run 2: the median of two took a compile-laden 41.6 ms — the best of the samples)
        N.cost[pr] = { off: med(r.off), on: med(r.on), all: r, passes: r.p, horizon: r.hz };
        console.log('     cost ' + pr + ' ' + JSON.stringify(N.cost[pr]) + ' (' + secs() + ')'); save();
        check(r.p.off === r.p.on, pr + ': the same full-screen passes with q-art4 on (' + r.p.on + ')');
      }
    }
  }
  // ---------------------------------------------------------------- a far view over the land toward the isles
  if (want('vista')) {
    const TOD = 7600;
    let cam = PIN.vista;
    if (!cam && N.cams.isles) {
      // (run 2: from beside the spawn a station's towers filled the frame) from above the isle view's eye, 25 m up, past the
      // Sky Isles' side over the field of isles beyond them
      const E0 = N.cams.isles.E, T0 = N.cams.isles.T, a = Math.atan2(T0[2] - E0[2], T0[0] - E0[0]) - 0.6;
      const E = [E0[0], E0[1] + 25, E0[2]];
      cam = { E, T: [E[0] + Math.cos(a) * 400, 150, E[2] + Math.sin(a) * 400] };
    }
    if (!cam) { check(false, 'a vista camera (the isle view first)'); cam = { E: [S0[0], 140, S0[2]], T: [S0[0] + 300, 140, S0[2]] }; }
    N.cams.vista = cam;
    await views('vista', cam.E, cam.T, TOD, 'isle');
  }
  // ---------------------------------------------------------------- Runde Hänge: a stone cliff and a rolling hill, pinned
  if (want('cliff') || want('hill')) {
    const NOON = 6400;
    // (run 2: none within 112 m of the spawn — the Heartland's town; now from five probes 0 / ±220 m, the rocks Runde Hänge
    //  rounds: VR.RoundCrown.ROCK)
    for (const [ox, oz] of [[0, 0], [220, 0], [-220, 0], [0, 220], [0, -220]]) {
      if (PIN.cliff && PIN.hill) break;
      const P0 = [S0[0] + ox, S0[1], S0[2] + oz];
      await ground(P0[0], P0[2]);
      const found = await ev((S0) => {
        const g = VR.game, w = g.world, R = VR.R; const ROCK = VR.RoundCrown && VR.RoundCrown.ROCK ? VR.RoundCrown.ROCK : /^(stone|granite|diorite|andesite|tuff|.*terracotta)$/;
        const nm = (x, z) => { const y = w.topAt(x, z), s = w.getBlock(x, y, z), t = s ? R.types[R.T.type[s]] : null; return [y, t ? t.name : '']; };
        let cliff = null, hill = null;
        for (let gx = -112; gx <= 112; gx += 3) for (let gz = -112; gz <= 112; gz += 3) {
          const x = Math.floor(S0[0] + gx), z = Math.floor(S0[2] + gz); if (!w.isLoaded(x, z) || !w.isLoaded(x + 14, z + 14) || !w.isLoaded(x - 14, z - 14)) continue;
          const [h, n] = nm(x, z);
          if (ROCK.test(n)) for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, [h2] = nm(Math.floor(x + Math.cos(a) * 4), Math.floor(z + Math.sin(a) * 4)); const drop = h - h2; if (drop >= 6 && (!cliff || drop > cliff.drop)) cliff = { x, z, h, a, drop, n }; }
          if (n === 'grass_block') {
            let lo = 1e9, hi = -1e9, step = 0;
            for (let d = -12; d <= 12; d += 3) for (let e = -12; e <= 12; e += 3) { const [y] = nm(x + d, z + e); lo = Math.min(lo, y); hi = Math.max(hi, y); const [y2] = nm(x + d + 1, z + e); step = Math.max(step, Math.abs(y2 - y)); }
            const rel = hi - lo; if (rel >= 6 && rel <= 16 && step <= 1 && h === hi && (!hill || rel > hill.rel)) hill = { x, z, h, rel };
          }
        }
        return { cliff, hill };
      }, P0);
      console.log('     found ' + JSON.stringify(found));
      if (found.cliff && !PIN.cliff) { const c = found.cliff, D = 18; const E = [c.x + Math.cos(c.a) * D, 0, c.z + Math.sin(c.a) * D]; E[1] = (await ground(E[0], E[2])) + 1 + 1.62 + 2; PIN.cliff = { E, T: [c.x, c.h - c.drop * 0.4, c.z], at: c }; }
      if (found.hill && !PIN.hill) { const c = found.hill, a = (await sunA()) + 1.2, D = 30; const E = [c.x + Math.cos(a) * D, 0, c.z + Math.sin(a) * D]; E[1] = (await ground(E[0], E[2])) + 1 + 1.62; PIN.hill = { E, T: [c.x, c.h, c.z], at: c }; }
    }
    for (const v of ['cliff', 'hill']) {
      if (!want(v)) continue;
      if (!PIN[v]) { check(false, 'a ' + v + ' near the spawn'); continue; }
      N.cams[v] = PIN[v];
      await views(v, PIN[v].E, PIN[v].T, NOON, 'hill');
    }
  }
  // pin what was found (the next runs use the same cameras)
  try { const keep = Object.assign({}, N.cams, PIN); fs.writeFileSync(CAMS, JSON.stringify(keep, null, 1)); } catch (e) { /* */ }
  save();
  // ---------------------------------------------------------------- the sheets
  const VN = [['isles', 'Schwebeinsel vom Boden aus, nach oben', 'Runde Inseln'], ['meadow', 'Wiese am Spawn · Nachmittag', 'Runde Inseln + Kronen'], ['vista', 'Weite Sicht zu den Inseln', 'Runde Inseln'], ['cliff', 'Felswand (fest gesetzt)', 'Runde Hänge'], ['hill', 'Sanfter Hügel (fest gesetzt)', 'Runde Hänge']];
  const PN = { balanced: 'Ausgewogen', high: 'Hoch', ultra: 'Ultra' };
  const rows = [];
  for (const [v, lab, sw] of VN) for (const pr of PRESETS) { const imgs = ['off', 'on'].map(c => N.pics[v + '_' + pr + '_' + c]).filter(Boolean); if (imgs.length) rows.push({ label: lab + ' — ' + (PN[pr] || pr) + ': ' + sw + ' aus | an', imgs }); }
  if (rows.length) {
    const spec = ROOT + '/.tmp_tests/qart4_sheet_' + TAG + '.json'; fs.writeFileSync(spec, JSON.stringify({ w: 620, rows }));
    const tspec = ROOT + '/.tmp_tests/qart4_thumbs_' + TAG + '.json'; fs.writeFileSync(tspec, JSON.stringify({ w: 320, rows: rows.map(r => ({ label: r.label.replace(/ — .*/, '') + ' · ' + r.label.split(' — ')[1], imgs: r.imgs })) }));
    try { console.log('     ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + (TAG === 'after' ? 'qart4_thumbs.jpg' : 'qart4_thumbs_' + TAG + '.jpg'), tspec]).toString().trim()); } catch (e) { console.log('  !! thumbs ' + e.message.slice(0, 200)); }
    try { console.log('     ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + (TAG === 'after' ? 'qart4_compare.jpg' : 'qart4_compare_' + TAG + '.jpg'), spec]).toString().trim()); } catch (e) { console.log('  !! sheet ' + e.message.slice(0, 200)); }
  }
} catch (e) { fails++; console.log('  ✗ ' + (e.stack || e.message).slice(0, 1200)); }
const errs = logs.filter(l => l.startsWith('[pageerror]'));
check(errs.length === 0, 'no page error' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
save();
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
