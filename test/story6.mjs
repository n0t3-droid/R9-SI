// regress: skip — a-story6 (docs/superpowers/plans/2026-10-31-a-story6.md): ch. 9's nebula owns the frame, ch. 7's
// window on the true beacons, Aquamarin's night and the lamplighter's halo. One browser run, German UI, 1280 × 720,
// Balanced view 6, seed 4242, an Abenteuer world (Kreativ):
//   c7    the Ringstation's window (c7.b2): the film's arrow (before) · the arrow on the true beacons (after)
//   neb   ch. 9 on the nebula's world: c9_nebula, c9_flimmi before/after (the switch VR.StoryNeb.off), a frame 4 s later
//         (the camera trucked), Very Low; the costs (ms a drawn frame) High and Very Low, in the scene and outside it
//   town  Aquamarin's deep night (its own: Helia under −15°): the street and a lamplighter, before (BodySky.night6 off, no
//         halo) and after
// → test/shots/s6_*.png, test/shots/story6_sheet.jpg (pairs.py), .tmp_tests/story6_after.json
// usage: nohup bash test/wt_run.sh story6.mjs 3600 > .tmp_tests/story6.log 2>&1 &     ONLY=c7,neb,town
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
const save = () => { try { fs.writeFileSync(ROOT + '.tmp_tests/story6_' + TAG + '.json', JSON.stringify(N, null, 1)); } catch (e) { /* */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const want = (s) => !ONLY || ONLY.includes(s);

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
  const f = SHOTS + 's6_' + name + '.png';
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
  await ev(`VR.game.createWorld({name:'Nebelstern',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
  for (let i = 0; i < 200; i++) { await wait(500); if (await ev(() => VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)) break; }
  check(await ev(() => VR.game.state) === 'play', 'the world is open (' + secs() + ')');
  await ev(() => {
    const g = VR.game, L0 = Object.getPrototypeOf(g).loop;
    window.__step = (t) => L0.call(g, t); g.loop = function (t) { if (window.__live) return L0.call(this, t); };
    g.zenFreezeWeather = true; g.env.wx.force('klar');
    const st = document.createElement('style'); st.textContent = '#hints,#lockhint,#toasts,.toast{display:none !important}'; document.head.appendChild(st);
    const A = VR.Adventure; A.setOn(true); A.setEnc('normal');
    window.__ft0 = (x, y, z) => { const b = g.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return !b || !(VR.R.T.flags[b] & VR.F.SOLID); };
    window.__c = { sceneT: (t) => { const s = g.story; return !s || !s.scene || s.scene.t >= t; } };
  });
  await settle(20, 'the world opened');


  // the frame's time: n drawn frames (gl.finish each), ms a frame
  const frameMs = (n) => ev((n) => { const g = VR.game, gl = g.renderer.gl; window.__norender = false; const t0 = performance.now(); for (let i = 0; i < n; i++) { g.last = performance.now() - 33; window.__step(performance.now()); gl.finish(); } window.__norender = true; return +((performance.now() - t0) / n).toFixed(1); }, n);
  const preset = async (p) => { await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.horizon = 1; g.settings.wowMoments = false; g.applySettings('*'); }, p); await run(20); };
  const off6 = (on) => ev((on) => { VR.StoryNeb.off = !on; }, on);

  // ---------------------------------------------------------------- ch. 7's window: the arrow on the true beacons
  if (want('c7')) {
    // the beacons the player knows (the Abenteuer's record): ten outposts round the landing, an arrow's line and head
    const known = await ev(() => { const A = VR.Adventure, R0 = A.rec || (A.rec = {}); R0.sites = R0.sites || {}; const p = VR.game.player.pos, out = [];
      for (let i = 0; i < 7; i++) out.push([p[0] - 3000 + i * 900, p[2] + 1800 - i * 520]);
      out.push([p[0] + 2600, p[2] - 900], [p[0] + 2700, p[2] - 2600], [p[0] + 1600, p[2] - 2400]);
      for (const [x, z] of out) { const id = Math.round(x) + '_' + Math.round(z); R0.sites[id] = { x: Math.round(x), y: 70, z: Math.round(z), dir: 0, st: 'frei' }; }
      return VR.StoryPlay.beaconXZ().length; });
    console.log('     known beacons ' + known);
    if (await trip('stn.ring')) {
      await ev(() => { VR.game.story.rec.choices.c6 = 'lumi'; VR.StoryPlay.debug.reach('c7.b2'); });
      await off6(false); await play('c7.b2', 12.5, 'c7_window_before'); await skipScene();
      await off6(true); await ev(() => { VR.StoryPlay.stats.arrowTrue = 0; VR.StoryPlay.debug.reach('c7.b2'); });
      const r7 = await play('c7.b2', 12.5, 'c7_window');
      N.c7 = await ev(() => ({ visible: VR.StoryPlay.stats.arrow6, trueFrames: VR.StoryPlay.stats.arrowTrue || 0, near: VR.StoryPlay.stats.arrowNear || 0, cos: VR.StoryPlay.stats.arrowCos, beams: VR.StoryPlay.stats.beams || 0, fr: !!(VR.SpaceFlight && VR.SpaceFlight.cur && VR.SpaceFlight.cur.axes), sky: VR.StoryPlay.station ? 1 : 0 }));
      console.log('     c7 ' + JSON.stringify(N.c7));
      check(r7.st && r7.st.fx === 'beacons', 'c7.b2 plays');
      check(N.c7.visible >= 3 ? N.c7.trueFrames > 0 : true, 'the arrow on the true beacons when three or more show in the window (' + N.c7.visible + ' visible)');
      await skipScene(); save();
    }
  }

  // ---------------------------------------------------------------- ch. 9 inside the nebula
  if (want('neb')) {
    const W = await ev(() => { const G = VR.Galaxy, N = G.build((VR.game.meta.seed >>> 0) || 0x5eed); for (let i = 1; i < N.list.length; i++) { const st = N.list[i]; if (!st || !(st.neb >= 0)) continue; const sy = G.system(N, i), p = sy && sy.bodies.find(b => b.landable && !b.locked && /aqua|ocker|basalt|opal/.test(b.dim || '')); if (p) return p.dim; } return null; });
    check(!!W, 'a world inside a nebula: ' + W);
    if (W && await trip(W)) {
      console.log('neb · ' + W);
      await ev(() => { const g = VR.game, p = g.player, y = g.world.topAt(Math.floor(p.pos[0]), Math.floor(p.pos[2])) + 1; p.flying = false; p.noclip = false; p.teleport(p.pos[0], Math.max(y, p.pos[1]), p.pos[2]); p.pitch = 0; g.story.rec.choices.c6 = 'lumi'; });
      const td = await nightTod(); console.log('     night at ' + td);
      const T = td === null ? undefined : td;
      // before (a-story5 + f-polish4's look: the switch off)
      await off6(false);
      await ev(() => VR.StoryPlay.debug.reach('c9.b1')); await play('c9.b1', 10, 'c9_nebula_before', T); N.c9a0 = await lum(); await skipScene();
      await ev(() => VR.StoryPlay.debug.reach('c9.b2')); await play('c9.b2', 11, 'c9_flimmi_before', T); N.c9b0 = await lum(); await skipScene();
      // after
      await off6(true);
      await ev(() => VR.StoryPlay.debug.reach('c9.b1')); await play('c9.b1', 10, 'c9_nebula', T); N.c9a = await lum();
      N.neb6 = await ev(() => ({ neb6: VR.StoryPlay.stats.neb6 || 0, night6: VR.StoryPlay.stats.night6 || 0, compiled: VR.StoryNeb.compiled(), draws: VR.StoryNeb.stats.draws }));
      check(N.neb6.neb6 > 0 && N.neb6.night6 > 0 && N.neb6.compiled, 'c9.b1: the nebula owns the frame (' + JSON.stringify(N.neb6) + ')');
      await skipScene();
      await ev(() => VR.StoryPlay.debug.reach('c9.b2')); const s2 = await play('c9.b2', 11, 'c9_flimmi', T); N.c9b = await lum();
      check(s2.st && s2.st.fx === 'flimmi', 'c9.b2 plays (Flimmi)');
      // mid-motion: the same shot 4 s later (the camera trucked 7 m and craned)
      await sceneTo(15); await draw(T); await shot('c9_flimmi_mid'); N.c9m = await lum();
      await skipScene();
      // Very Low's picture, and the costs in the scene (ms a drawn frame, SwiftShader: warmed up, the switch off and on
      // twice in turn, the lower of each) and outside it
      const both = async () => { await frameMs(4); const r = { before: 1e9, after: 1e9 }; for (let k = 0; k < 2; k++) { await off6(false); await frameMs(1); r.before = Math.min(r.before, await frameMs(3)); await off6(true); await frameMs(1); r.after = Math.min(r.after, await frameMs(3)); } return r; };
      N.cost = {}; N.costOut = {};
      for (const pr of ['potato', 'high']) {
        await preset(pr);
        await ev(() => VR.StoryPlay.debug.reach('c9.b2')); await off6(true); await play('c9.b2', 11, pr === 'potato' ? 'c9_flimmi_vl' : 'c9_flimmi_high', T);
        if (pr === 'potato') N.c9vl = await lum();
        N.cost[pr] = await both(); await skipScene();
        N.costOut[pr] = await both();
      }
      console.log('     costs in the scene ' + JSON.stringify(N.cost) + ' · outside ' + JSON.stringify(N.costOut));
      await preset('balanced');
      console.log('     lum ' + JSON.stringify({ a0: N.c9a0, a: N.c9a, b0: N.c9b0, b: N.c9b, m: N.c9m, vl: N.c9vl }));
      save();
    }
  }

  // ---------------------------------------------------------------- Aquamarin's night: a lamplighter
  if (want('town') && await trip('aqua')) {
    console.log('town · Aquamarin at night');
    let V = null;
    for (let i = 0; i < 30 && !V; i++) { await run(20); V = await ev(() => { const s = VR.game.villages.sites.find(q => q.id === 'eco:aqua:0'); return s ? { x: s.x, y: s.y, z: s.z } : null; }); await wait(200); }
    check(!!V, 'the town on the map');
    if (V) {
      await ev((V) => { const g = VR.game, p = g.player; p.flying = true; p.teleport(V.x + 8, V.y + 6, V.z + 8); }, V);
      await settle(25, 'the town');
      // Aquamarin's deep night (its day is a week of the clock): Helia under −15°
      const nt = await ev(() => { const g = VR.game, E = g.env; for (let d = 0; d < 14; d++) for (let t = 0; t < 24000; t += 1000) { E.day = d; E.setTime(t); g.last = performance.now() - 33; window.__norender = true; window.__step(performance.now()); const L = VR.BodySky.cur && VR.BodySky.cur.light; if (L && L.sunEl < -0.26) return { d, t, el: +(L.sunEl * 57.3).toFixed(1) }; } return null; });
      console.log('     deep night ' + JSON.stringify(nt));
      check(!!nt, 'Aquamarin\'s deep night found');
      if (nt) {
        await ev((nt) => { VR.game.env.day = nt.d; VR.game.env.setTime(nt.t); }, nt);
        await run(400);
        const a = await ev(() => { let best = null; for (const v of VR.game.villages.known.values()) { const L = v.agents.filter(o => o.act && o.act.type === 'lantern'); const o = L.find(q => q.pose !== 'sit') || L[0]; if (o && !best) best = { o, n: L.length }; } if (!best) return { n: 0 }; window.__lampA = best.o; return { n: best.n, pos: best.o.pos.slice(), tool: best.o.p.look.tool }; });
        console.log('     lamplighters ' + JSON.stringify(a).slice(0, 300));
        check(a && a.n >= 2, 'in Aquamarin\'s night the lamplighters walk (' + (a && a.n) + ')');
        // the street wide (the night itself), then the lamplighter close: before (the old night, no halo) and after
        const look = async (close) => ev((close) => { const g = VR.game, o = window.__lampA, p = g.player; if (!o) return; const d = close ? 2.8 : 10, h = close ? 1.6 : 3.4; let e = null;
          for (let k = 0; k < 16 && !e; k++) { const yw = o.yaw + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 8, c = [o.pos[0] + Math.sin(yw) * d, o.pos[1] + h, o.pos[2] + Math.cos(yw) * d]; let ok = true; for (let s = 0; s <= 20 && ok; s++) { const u = s / 20 * 0.9; ok = window.__ft0(c[0] + (o.pos[0] - c[0]) * u, c[1] + (o.pos[1] + 1 - c[1]) * u, c[2] + (o.pos[2] - c[2]) * u); } if (ok) e = c; }
          if (!e) { const fx = Math.sin(o.yaw), fz = Math.cos(o.yaw); e = [o.pos[0] + fx * d, o.pos[1] + h, o.pos[2] + fz * d]; }
          p.flying = true; p.noclip = true; p.teleport(e[0], e[1] - 1.62, e[2]); const dx = o.pos[0] - e[0], dy = o.pos[1] + 0.8 - e[1], dz = o.pos[2] - e[2]; p.yaw = p.viewYaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }, close);
        if (a && a.n) {
          for (const tag of ['before', 'after']) {
            await ev((on) => { VR.BodySky.night6 = on; VR.Natives.lant6Off = !on; }, tag === 'after');
            await look(false); await run(40); await look(false); await draw(); await shot(tag === 'after' ? 'aqua_night' : 'aqua_night_before'); N['aqua_' + tag] = await lum();
            await look(true); await run(6); await look(true); await draw(); await shot(tag === 'after' ? 'lamplighter' : 'lamplighter_before'); N['lamp_' + tag] = await lum();
          }
          N.lantN = await ev(() => VR.game.particles.lantN || 0);
          check(N.lantN >= 1, 'the lantern\'s halo drawn (' + N.lantN + ' carriers)');
          console.log('     ' + JSON.stringify({ wide0: N.aqua_before, wide: N.aqua_after, lamp0: N.lamp_before, lamp: N.lamp_after }));
        }
      }
    }
    save();
  }
} catch (e) { fails++; console.log('  ✗ stopped: ' + (e.stack || e.message).slice(0, 900)); }
const errs = logs.filter(l => l.startsWith('[pageerror]'));
check(errs.length === 0, 'no page error' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ').slice(0, 600) : ''));
save();
try {
  const P = (n) => SHOTS + 's6_' + n + '.png', ex = (n) => fs.existsSync(P(n));
  const rows = [['Kapitel 9 · im Nebel (9.1, der Stern noch im Kokon) — vorher · nachher', ['c9_nebula_before', 'c9_nebula']], ['Kapitel 9 · Flimmi — vorher · nachher', ['c9_flimmi_before', 'c9_flimmi']], ['Flimmi in Bewegung (4 s später: Kamera gefahren) · Sehr niedrig · Hoch', ['c9_flimmi_mid', 'c9_flimmi_vl', 'c9_flimmi_high']], ['Kapitel 7 · das Fenster: der Film-Pfeil · die wahren Leuchtfeuer', ['c7_window_before', 'c7_window']], ['Aquamarins Nacht — vorher · nachher', ['aqua_night_before', 'aqua_night']], ['der Laternenanzünder — vorher · nachher (der Schein)', ['lamplighter_before', 'lamplighter']]]
    .map(([label, ns]) => ({ label, imgs: ns.filter(ex).map(P) })).filter(r => r.imgs.length);
  fs.writeFileSync(ROOT + '.tmp_tests/story6_sheet.json', JSON.stringify({ w: 620, rows }));
  execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'story6_sheet.jpg', ROOT + '.tmp_tests/story6_sheet.json']);
  console.log('     sheet test/shots/story6_sheet.jpg');
} catch (e) { console.log('  (the sheet: ' + String(e.message || e).slice(0, 200) + ')'); }
await browser.close();
console.log((fails ? 'FAILED ' + fails : 'ALL OK') + ' (' + secs() + ')');
process.exit(fails ? 1 : 0);
