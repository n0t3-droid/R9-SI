// regress: skip — f-polish4 (docs/superpowers/plans/2026-10-31-f-polish4.md): the open visual items of the last fronts,
// one browser run, German UI, 1280 × 720, Balanced view 6, seed 4242, an Abenteuer world (Kreativ):
//   spawn  a new world through the create dialog: the spawn picture at 15 s, First2.vistaBack's step back (fired? why not)
//   cafe   the Ringstation's café (u-stations2's view) + who spawned the particles there (the white orbs' source);
//          ch. 7's window (c7.b2): the beams' arrow
//   neb    ch. 9 on the nebula's world: c9_nebula, c9_flimmi + Flimmi's brightness against the frame's
//   town   Aquamarin's town at night: a lamplighter close (the held lantern)
// TAG=before|after names the pictures (test/shots/p4_<name>_<TAG>.png); ONLY=spawn,cafe,neb,town
// usage: nohup bash test/wt_run.sh polish4.mjs 3600 > .tmp_tests/polish4.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
const DIST = 'file://' + ROOT + 'dist/index.html';
const TAG = process.env.TAG || 'after';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const N = { tag: TAG, pics: {} };
const save = () => { try { fs.writeFileSync(ROOT + '.tmp_tests/polish4_' + TAG + '.json', JSON.stringify(N, null, 1)); } catch (e) { /* */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const want = (s) => !ONLY || ONLY.includes(s);

// ---------------------------------------------------------------- spawn: a new world as a player makes it
if (want('spawn')) {
  console.log('spawn · a new world through the create dialog');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('r9si.settings')) localStorage.setItem('r9si.settings', JSON.stringify({ preset: 'balanced', dynRes: false })); } catch (e) { /* */ } });
  const page = await ctx.newPage();
  const ev = (fn, a) => page.evaluate(fn, a), wait = (ms) => page.waitForTimeout(ms);
  const untilState = async (st, ms) => { const t = Date.now(); while (Date.now() - t < ms) { const s = await ev(() => VR.game && VR.game.state).catch(() => null); if (s === st) return Date.now() - t; await wait(400); } return -1; };
  await page.goto(DIST);
  if (await untilState('title', 240000) >= 0) {
    await wait(3000);
    try { await page.click('#title [data-act="newworld"]', { timeout: 8000 }); } catch (e) { await ev(() => document.querySelector('#title [data-act="newworld"]').click()).catch(() => {}); }
    await wait(1500);
    await ev(() => { const s = document.getElementById('cw_seed'); if (s) { s.value = '4242'; s.dispatchEvent(new Event('input')); } }).catch(() => {});
    // the spawn's record while the world loads: the feet before any move
    await ev(() => { window.__sp = []; window.__spIv = setInterval(() => { const g = VR.game, p = g.player; if (g.state === 'play' && p && window.__sp.length < 400) window.__sp.push([+(performance.now() / 1000).toFixed(1), p.pos.map(v => +v.toFixed(2))]); }, 250); }).catch(() => {});
    try { await page.click('#create .btn.primary', { timeout: 8000 }); } catch (e) { await ev(() => document.querySelector('#create .btn.primary').click()).catch(() => {}); }
    const lt = await untilState('play', 300000);
    await wait(15000);
    const pr = await ev(() => {
      const g = VR.game, m = g.meta, F = VR.First2, p = g.player, A = g.arrival, v = (A && A.v) || null, R = VR.R, w = g.world;
      const nm = (x, y, z) => { const b = w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return b ? R.types[R.T.type[b]].name : 'air'; };
      const o = { vistaId: m.vistaId || null, f4back: m.f4back || 0, backed: F && F.backed || null, moved: F && F.moved ? F.moved.pos : null, pos: p.pos.map(x => +x.toFixed(2)), spawn: p.spawn, u: v && v.u, yaw: +p.yaw.toFixed(3), first: window.__sp.slice(0, 3), last: window.__sp.slice(-1) };
      if (v && v.u && p.spawn) { const s = p.spawn, cells = []; for (let k = 0; k <= 4; k++) { const x = s[0] - v.u[0] * k, z = s[2] - v.u[1] * k; cells.push([k, nm(x, s[1] - 1, z), nm(x, s[1], z), nm(x, s[1] + 1, z)]); } o.behind = cells; }
      return o;
    }).catch(e => ({ err: String(e).slice(0, 200) }));
    N.spawn = pr; console.log('     ' + JSON.stringify(pr).slice(0, 1400));
    try { await page.screenshot({ path: SHOTS + 'p4_spawn_' + TAG + '.png', timeout: 120000 }); N.pics.spawn = SHOTS + 'p4_spawn_' + TAG + '.png'; } catch (e) { console.log('  !! no spawn shot'); }
    check(lt >= 0, 'spawn: the world opened');
    if (TAG === 'after') check(pr && pr.f4back === 1 && !!pr.backed, 'spawn: First2.vistaBack stepped back on the way (' + JSON.stringify(pr && pr.backed) + ')');
  } else check(false, 'spawn: the start screen');
  save();
  await ctx.close();
}

// ---------------------------------------------------------------- the main page (story.mjs's harness)
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log('  !! the page crashed'); });
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
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
    done += r.n;
    if (r.hit) return { n: done, hit: true };
  }
  return { n: done, hit: false };
};
const draw = (tod, dtms = 33) => ev(([tod, d]) => { window.__norender = false; const g = VR.game; if (tod !== null && tod !== undefined) g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; for (let i = 0; i < 2; i++) { g.last = performance.now() - d; window.__step(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, [tod === undefined ? null : tod, dtms]);
const shot = async (name) => {
  await ev(() => { for (const a of document.getAnimations()) { try { if (a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming().iterations !== Infinity) a.finish(); } catch (e) { /* */ } } }); await wait(200);
  const f = SHOTS + 'p4_' + name + '_' + TAG + '.png';
  try { await page.screenshot({ path: f, timeout: 150000 }); } catch (e) { console.log('  !! screenshot ' + name); fails++; return null; }
  console.log('     shot ' + name + ' (' + secs() + ')'); N.pics[name] = f; save(); return f;
};
const settle = async (sec, tag) => { const t = Date.now(); let n = 0; while (Date.now() - t < sec * 1000) { n += (await run(4)).n; await wait(300); } console.log('     settled ' + sec + ' s (' + n + ' frames' + (tag ? ', ' + tag : '') + ', ' + secs() + ')'); };
const sceneTo = (t) => run(Math.ceil(t / 0.033) + 60, 33, 'sceneT', t);
const nightTod = async () => { for (const tod of [18000, 15000, 21000, 12000, 0, 3000]) { await ev((t) => VR.game.env.setTime(t), tod); await run(3); const up = await ev(() => VR.StoryPlay.ctx3(VR.game).sunUp); if (up === false) return tod; } return null; };
const trip = async (dim) => {
  await ev((d) => { window.__lastTrip = VR.Travel.last; VR.Travel.go(VR.game, { dim: d, via: 'cmd' }); }, dim);
  let s = null;
  for (let i = 0; i < 900; i++) { await run(10); s = await ev((d) => { const g = VR.game, L = VR.Travel.last; return { state: g.state, dim: g.dim, arrived: !!(L && L !== window.__lastTrip && L.to === d) }; }, dim); if (s.arrived && s.state === 'play') break; await wait(20); }
  check(s && s.dim === dim, 'the trip to ' + dim + ' (' + secs() + ')');
  if (s && s.dim === dim) await settle(18, dim);
  return s && s.dim === dim;
};
const play = async (id, t, name, tod) => {
  await ev((id) => VR.StoryPlay.debug.play(id), id);
  await sceneTo(t);
  const st = await ev(() => { const sc = VR.game.story.scene; return sc ? { id: sc.b.id, shot: sc.shot, fx: sc.fxKind || null, who: sc.lines.map(l => l.who).join(' ') } : null; });
  await draw(tod); const f = await shot(name);
  console.log('     ' + name + ' ' + JSON.stringify(st).slice(0, 300));
  return { st, f };
};
const skipScene = async () => { while (await ev(() => VR.StoryPlay.holds(VR.game))) { await ev(() => VR.game.story.skip()); await run(5); } };
// the drawn frame's luminance: its mean, the share of near-white pixels, the brightest 0.2 %'s place (x, y in 0…1)
const lum = () => ev(() => {
  const gl = VR.game.renderer.gl, W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4);
  window.__norender = false; const g = VR.game; g.last = performance.now() - 33; window.__step(performance.now()); window.__norender = true;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  let s = 0, n = 0, wh = 0; const hist = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 16) { const L = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) | 0; s += L; n++; hist[L]++; if (px[i] > 235 && px[i + 1] > 235 && px[i + 2] > 235) wh++; }
  let c = 0, p998 = 255; for (let L = 255; L >= 0; L--) { c += hist[L]; if (c > n * 0.002) { p998 = L; break; } }
  let p50 = 0; c = 0; for (let L = 0; L < 256; L++) { c += hist[L]; if (c > n * 0.5) { p50 = L; break; } }
  return { mean: +(s / n).toFixed(1), p50, p998, white: +(wh / n * 100).toFixed(2) };
});

try {
  await page.goto(DIST);
  const atTitle = () => ev(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title');
  for (let i = 0; i < 160; i++) { await wait(500); if (await atTitle()) break; }
  await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.horizon = 1; g.settings.wowMoments = false; g.applySettings('*'); if (VR.Hints) for (const h of ['play', 'move', 'fly', 'bauhand', 'bhring', 'bhundo', 'bhchange']) VR.Hints.done(h); });
  await ev(`VR.game.createWorld({name:'Feinschliff',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
  for (let i = 0; i < 200; i++) { await wait(500); if (await ev(() => VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)) break; }
  check(await ev(() => VR.game.state) === 'play', 'the world is open (' + secs() + ')');
  await ev(() => {
    const g = VR.game, L0 = Object.getPrototypeOf(g).loop;
    window.__step = (t) => L0.call(g, t); g.loop = function (t) { if (window.__live) return L0.call(this, t); };
    g.zenFreezeWeather = true; g.env.wx.force('klar');
    const st = document.createElement('style'); st.textContent = '#hints,#lockhint,#toasts,.toast{display:none !important}'; document.head.appendChild(st);
    const A = VR.Adventure; A.setOn(true); A.setEnc('normal');
    window.__c = { sceneT: (t) => { const s = g.story; return !s || !s.scene || s.scene.t >= t; } };
  });
  await settle(20, 'the world opened');

  // ---------------------------------------------------------------- the café, ch. 7's window
  if (want('cafe') && await trip('stn.ring')) {
    console.log('cafe · the Ringstation');
    // who spawns particles here (the column of white orbs): the spawner's caller, counted
    await ev(() => { const P = VR.game.particles; if (P.__sp0) return; P.__sp0 = P.spawn; window.__who = {}; P.spawn = function () { const s = (new Error().stack || '').split('\n')[2] || '?'; const k = s.trim().replace(/\(.*\//, '(').slice(0, 90); window.__who[k] = (window.__who[k] || 0) + 1; return P.__sp0.apply(this, arguments); }; });
    await ev(() => { const g = VR.game, p = g.player; g.camMode = 0; p.flying = true; p.noclip = true; p.teleport(-5.5, 65.4 - 1.62, 3.0); p.yaw = p.viewYaw = Math.atan2(9.5, -5.5); p.pitch = -0.16; g.settings.fov = 75; window.__who = {}; });
    await settle(14, 'the café');
    const d = await ev(() => { const g = VR.game, E = g.env.E || {}, P = g.particles, w = g.world, R = VR.R, L = P.lamps || [], ln = []; for (let i = 0; i < L.length && ln.length < 24; i += 4) ln.push([L[i], L[i + 1], L[i + 2], R.types[R.T.type[L[i + 3]]].name].join(' ')); return { night: +(E.night || 0).toFixed(2), count: P.count, who: window.__who, lamps: ln, falls: (g.waterFalls || []).length, funke: !!(g.funke && g.funke.on && g.funke.on()), wayT: g.funke ? g.funke.wayT : null }; });
    N.cafe = d; console.log('     ' + JSON.stringify(d).slice(0, 2400));
    await draw(); await shot('cafe');
    N.cafeLum = await lum(); console.log('     café ' + JSON.stringify(N.cafeLum));
    // c7.b2 (the window: the beacons' arrow)
    await ev(() => { const p = VR.game.player; p.noclip = false; VR.game.story.rec.choices.c6 = 'lumi'; VR.StoryPlay.debug.reach('c7.b2'); });
    const r7 = await play('c7.b2', 12.5, 'c7_window');
    N.c7 = await ev(() => ({ beams: VR.StoryPlay.stats.beams || 0, at: VR.StoryPlay.stats.beamAt || null }));
    console.log('     c7 ' + JSON.stringify(N.c7));
    check(r7.st && r7.st.fx === 'beacons', 'c7.b2 plays (the beacons\' arrow)');
    await skipScene();
    save();
  }

  // ---------------------------------------------------------------- ch. 9 inside the nebula
  if (want('neb')) {
    const W = await ev(() => { const G = VR.Galaxy, N = G.build((VR.game.meta.seed >>> 0) || 0x5eed); for (let i = 1; i < N.list.length; i++) { const st = N.list[i]; if (!st || !(st.neb >= 0)) continue; const sy = G.system(N, i), p = sy && sy.bodies.find(b => b.landable && !b.locked && /aqua|ocker|basalt|opal/.test(b.dim || '')); if (p) return p.dim; } return null; });
    check(!!W, 'a world inside a nebula: ' + W);
    if (W && await trip(W)) {
      console.log('neb · ' + W);
      await ev(() => { const g = VR.game, p = g.player, y = g.world.topAt(Math.floor(p.pos[0]), Math.floor(p.pos[2])) + 1; p.flying = false; p.noclip = false; p.teleport(p.pos[0], Math.max(y, p.pos[1]), p.pos[2]); p.pitch = 0; g.story.rec.choices.c6 = 'lumi'; VR.StoryPlay.debug.reach('c9.b1'); });
      const td = await nightTod();
      await play('c9.b1', 10, 'c9_nebula', td === null ? undefined : td);
      N.c9a = await lum(); console.log('     c9_nebula ' + JSON.stringify(N.c9a));
      await skipScene();
      await ev(() => VR.StoryPlay.debug.reach('c9.b2'));
      await play('c9.b2', 11, 'c9_flimmi', td === null ? undefined : td);
      N.c9b = await lum(); console.log('     c9_flimmi ' + JSON.stringify(N.c9b));
      N.c9fl = await ev(() => { const s = VR.StoryPlay.stats; return { flimmi: s.flimmiPx || null, glows: s.glows || 0 }; });
      await skipScene();
      save();
    }
  }

  // ---------------------------------------------------------------- Aquamarin's town at night: a lamplighter
  if (want('town') && await trip('aqua')) {
    console.log('town · Aquamarin at night');
    let V = null;
    for (let i = 0; i < 30 && !V; i++) { await run(20); V = await ev(() => { const s = VR.game.villages.sites.find(q => q.id === 'eco:aqua:0'); return s ? { x: s.x, y: s.y, z: s.z } : null; }); await wait(200); }
    check(!!V, 'the town on the map');
    if (V) {
      await ev((V) => { const g = VR.game, p = g.player; p.flying = true; p.teleport(V.x + 8, V.y + 6, V.z + 8); g.env.setTime(15500); }, V);
      await settle(30, 'the town');
      await run(400);
      const a = await ev(() => { const v = VR.game.villages.known.get('eco:aqua:0'); if (!v) return null; const L = v.agents.filter(o => o.act && o.act.type === 'lantern'); const o = L.find(q => q.pose !== 'sit') || L[0]; if (!o) return { n: 0, acts: v.agents.map(q => q.act && q.act.type).join(',') }; window.__lampA = o; return { n: L.length, pos: o.pos.slice(), yaw: o.yaw, tool: o.p.look.tool }; });
      console.log('     lamplighters ' + JSON.stringify(a).slice(0, 400));
      check(a && a.n >= 2, 'at night the lamplighters walk (' + (a && a.n) + ')');
      if (a && a.n) {
        // the camera 2.6 m before the lamplighter, a little above the head; the figure held still
        await ev(() => { const g = VR.game, o = window.__lampA, p = g.player, fx = -Math.sin(o.yaw), fz = -Math.cos(o.yaw); p.flying = true; p.noclip = true; const e = [o.pos[0] + fx * 2.6 + fz * 0.8, o.pos[1] + 1.9, o.pos[2] + fz * 2.6 - fx * 0.8]; p.teleport(e[0], e[1] - 1.62, e[2]); const dx = o.pos[0] - e[0], dy = o.pos[1] + 0.9 - e[1], dz = o.pos[2] - e[2]; p.yaw = p.viewYaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); window.__hold = o.pos.slice(); });
        await run(6);
        await ev(() => { const o = window.__lampA, g = VR.game, p = g.player, e = [p.pos[0], p.pos[1] + 1.62, p.pos[2]], dx = o.pos[0] - e[0], dy = o.pos[1] + 0.9 - e[1], dz = o.pos[2] - e[2]; p.yaw = p.viewYaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); });
        await draw(); await shot('lamplighter');
        N.lamp = await ev(() => ({ tool: window.__lampA.p.look.tool, act: window.__lampA.act && window.__lampA.act.type }));
        console.log('     ' + JSON.stringify(N.lamp));
        if (TAG === 'after') check(N.lamp.tool === 'lantern', 'the lamplighter holds a lantern at night (' + N.lamp.tool + ')');
      }
    }
    save();
  }
} catch (e) { fails++; console.log('  ✗ stopped: ' + (e.stack || e.message).slice(0, 900)); }
const errs = logs.filter(l => l.startsWith('[pageerror]'));
check(errs.length === 0, 'no page error' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ').slice(0, 600) : ''));
save();
// the sheet: before | after per item (whatever exists)
try {
  const P = (n, t) => SHOTS + 'p4_' + n + '_' + t + '.png';
  const rows = [['1 · das Café der Ringstation (vorher · nachher)', 'cafe'], ['2 · Kapitel 9 · im Nebel', 'c9_nebula'], ['2 · Kapitel 9 · Flimmi', 'c9_flimmi'], ['3 · der Laternenanzünder bei Nacht', 'lamplighter'], ['4 · das Startbild', 'spawn'], ['5 · Kapitel 7 · das Fenster', 'c7_window']]
    .map(([label, n]) => ({ label, imgs: ['before', 'after'].map(t => P(n, t)).filter(f => fs.existsSync(f)) })).filter(r => r.imgs.length);
  fs.writeFileSync(ROOT + '.tmp_tests/polish4_sheet.json', JSON.stringify({ w: 620, rows }));
  execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'polish4_sheet.jpg', ROOT + '.tmp_tests/polish4_sheet.json']);
  console.log('     sheet test/shots/polish4_sheet.jpg');
} catch (e) { console.log('  (the sheet: ' + String(e.message || e).slice(0, 200) + ')'); }
await browser.close();
console.log((fails ? 'FAILED ' + fails : 'ALL OK') + ' (' + secs() + ')');
process.exit(fails ? 1 : 0);
