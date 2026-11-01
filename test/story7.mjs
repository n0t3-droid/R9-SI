// regress: skip — a-story7 (docs/superpowers/plans/2026-11-01-a-story7.md): Arc 2 — „Das Lied der Wiegelind",
// chapters 13–16, one picture (or two) a chapter. One browser run, German UI, 1280 × 720, Balanced view 6, seed 4242,
// an Abenteuer world (Kreativ):
//   herz   Herzwelt at night by the Schlummerbaum: 13.1 Wiegelind blinks · 13.2 Mutter Borke's secret · 13.3 the one song;
//          15.1 the sky · 15.2 your sign and her answer · the choice (stay) → 15.3 Wiegelinds Ruh appears
//   fest   the village at nightfall on the Dreilichterfest: 16.1 the festival · 16.2 the quiet last picture; the costs
//          (ms a drawn frame) Very Low and High, outside a scene and in one
//   trip   the Ringstation's window (14.1) · Zinnober's village (14.2) · its Flausel (14.3)
// → test/shots/s7_*.png, test/shots/story7_sheet.jpg (pairs.py), .tmp_tests/story7_after.json
// usage: nohup bash test/wt_run.sh story7.mjs 3600 > .tmp_tests/story7.log 2>&1 &     ONLY=herz,fest,trip
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
const save = () => { try { fs.writeFileSync(ROOT + '.tmp_tests/story7_' + TAG + '.json', JSON.stringify(N, null, 1)); } catch (e) { /* */ } };
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
  const f = SHOTS + 's7_' + name + '.png';
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
  await ev(`VR.game.createWorld({name:'Wiegenlied',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
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

  const st = () => ev(() => { const s = VR.game.story, sc = s && s.scene; return sc ? { id: sc.b.id, t: +sc.t.toFixed(1), shot: sc.shot, fx: sc.fxKind || null, who: sc.lines.map(l => l.who).join(' '), blocked: sc.blocked ? Object.keys(sc.blocked).join(',') : '' } : null; });
  const at = async (id, ts, names, tod) => {   // one scene, a picture at each time
    await ev((id) => { VR.game.story.lastScene = null; VR.StoryPlay.debug.play(id); }, id);
    const out = [];
    for (let i = 0; i < ts.length; i++) { await sceneTo(ts[i]); await draw(tod); const f = await shot(names[i]); const s = await st(); console.log('     ' + names[i] + ' ' + JSON.stringify(s)); out.push(s); }
    await skipScene(); return out;
  };
  const NIGHT = 17500, DUSK = 12600;
  const toward = (x, y, z, d, h) => ev(([x, y, z, d, h]) => { const g = VR.game, p = g.player; let e = null;
    for (let k = 0; k < 16 && !e; k++) { const a = k * Math.PI / 8, cx = x + Math.sin(a) * d, cz = z + Math.cos(a) * d, top = g.world.topAt(Math.floor(cx), Math.floor(cz)); if (top < 0) continue; const c = [cx, top + 1 + h, cz]; let ok = true; for (let s = 1; s <= 20 && ok; s++) { const u = s / 20 * 0.85; ok = window.__ft0(c[0] + (x - c[0]) * u, c[1] + 1.6 + (y + 1 - c[1] - 1.6) * u, c[2] + (z - c[2]) * u); } if (ok) e = c; }
    if (!e) { const top = g.world.topAt(Math.floor(x + d), Math.floor(z)); e = [x + d, top + 1, z]; }
    p.flying = false; p.noclip = false; p.teleport(e[0], e[1], e[2]); const dx = x - e[0], dz = z - e[2]; p.yaw = p.viewYaw = Math.atan2(-dx, -dz); p.pitch = 0; return e.map(v => +v.toFixed(1)); }, [x, y, z, d, h]);
  const fairyAt = async (kind) => { for (let i = 0; i < 40; i++) { const s = await ev((k) => { const F = VR.Fairy, S0 = F && F.state; const s = S0 && S0.sites.find(q => (!k || q.kind === k || q.id === k) && q.y !== null); return s ? { id: s.id, kind: s.kind, x: s.x, y: s.y, z: s.z } : (S0 && S0.sites[0] ? { far: S0.sites.map(q => q.id + '@' + q.x + ',' + q.z).join(' ') } : null); }, kind); if (s && s.id) return s; if (s && s.far && i % 5 === 0) { const m = /@(-?\d+),(-?\d+)/.exec(s.far); if (m) await ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.teleport(+x + 20, 120, +z); }, [m[1], m[2]]); } await run(20); await wait(300); } return null; };
  await ev(() => { const g = VR.game, r = g.story.rec; r.choices.c6 = 'lumi'; r.choices.how = 'build'; VR.StoryPlay.debug.reach('c13.b1'); });

  // ---------------------------------------------------------------- Herzwelt by night: 13 and 15
  if (want('herz')) {
    console.log('herz · Herzwelt at night');
    const tree = await fairyAt('tree');
    check(!!tree, 'the Schlummerbaum settled (' + JSON.stringify(tree) + ')');
    if (tree) {
      console.log('     stand ' + JSON.stringify(await toward(tree.x, tree.y, tree.z, 13, 0)));
      await ev((t) => VR.game.env.setTime(t), NIGHT); await settle(20, 'the tree');
      const ctx = await ev(() => { const c = VR.StoryPlay.ctxOf(VR.game, VR.game.story); return { fairy: Math.round(c.near.fairy), home: Math.round(c.near.home), hour: c.hour, why: VR.Story.why(VR.Story.byId('c13.b1'), Object.assign(c, { calm: 30 }), VR.game.story.rec) }; });
      console.log('     ctx ' + JSON.stringify(ctx));
      check(ctx.fairy < 45 && ctx.why === null, 'by the tree at night: c13.b1 holds, a fairy place near (' + ctx.fairy + ' m, why ' + ctx.why + ')');
      await at('c13.b1', [10.5, 16], ['c13_1_wiege', 'c13_1_funke'], NIGHT);
      await ev(() => VR.StoryPlay.debug.reach('c13.b2'));
      await at('c13.b2', [3, 9.5], ['c13_2_flausel', 'c13_2_borke'], NIGHT);
      await ev(() => VR.StoryPlay.debug.reach('c13.b3'));
      await at('c13.b3', [8.5], ['c13_3_song'], NIGHT);
      await ev(() => { const s = VR.game.story; VR.StoryPlay.debug.reach('c15.b1'); });
      await at('c15.b1', [16], ['c15_1_sky'], NIGHT);
      await ev(() => { const s = VR.game.story; s.rec.choices.style = 'build'; VR.Story.markAct(s.rec, 'c15.b1'); VR.StoryPlay.debug.reach('c15.b2'); });
      await at('c15.b2', [3.5, 17], ['c15_2_sign', 'c15_2_funke'], NIGHT);
      const ch = await ev(() => { const g = VR.game, s = g.story; VR.Story.mark(s.rec, 'c15.b2'); const ok = s.choose('stay'); return { ok, gift: s.rec.gift, n: VR.StoryArc2.stats.found }; });
      console.log('     chosen ' + JSON.stringify(ch));
      check(ch.ok && ch.gift && ch.gift.place.kind === 'circle', 'chosen: she stays — Wiegelinds Ruh founded');
      if (ch.gift) {
        const pc = ch.gift.place; await ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.teleport(x + 30, 110, z + 30); }, [pc.x, pc.z]); await settle(14, 'the new place');
        const ws = await fairyAt('overworld:wiege');
        check(!!ws, 'the new place stands among the fairy places (' + JSON.stringify(ws) + ')');
        if (ws) { console.log('     stand ' + JSON.stringify(await toward(ws.x, ws.y, ws.z, 26, 0))); await settle(8, 'Wiegelinds Ruh'); }
        await at('c15.b3', [2.5, 10], ['c15_3_descend', 'c15_3_place'], NIGHT);
      }
    }
  }
  // ---------------------------------------------------------------- the Dreilichterfest at the village
  if (want('fest')) {
    console.log('fest · the village on the Dreilichterfest');
    await ev(() => { const g = VR.game, s = g.story; if (!s.rec.gift) { s.rec.choices.c15 = 'stay'; VR.Story.found(s.rec, { opt: 'stay', x: g.player.pos[0] + 60, z: g.player.pos[2] }, g.env.day | 0); } VR.StoryPlay.debug.reach('c16.b1'); });
    let V = null;
    for (let i = 0; i < 30 && !V; i++) { V = await ev(() => { const v = VR.StoryPlay.village(VR.game) || (VR.game.villages.sites[0] ? { s: VR.game.villages.sites[0] } : null); return v ? { x: v.s.x, y: v.s.y || 70, z: v.s.z } : null; }); if (!V) { await run(20); await wait(200); } }
    check(!!V, 'a village near (' + JSON.stringify(V) + ')');
    if (V) {
      await ev((V) => { const p = VR.game.player; p.flying = true; p.teleport(V.x + 10, V.y + 30, V.z + 10); }, V); await settle(20, 'the village');
      const pz = await ev(() => { const H = VR.StoryArc2.homeNear(VR.game); return H ? { x: H.at.x, y: H.at.y, z: H.at.z } : null; });
      console.log('     stand ' + JSON.stringify(await toward(pz.x, pz.y, pz.z, 18, 0)));
      await ev((t) => VR.game.env.setTime(t), DUSK - 600); await run(300); await ev((t) => VR.game.env.setTime(t), DUSK); await settle(10, 'nightfall');
      const fs0 = await ev(() => { const g = VR.game, v = [...g.villages.known.values()][0]; return { fest: v ? g.villages.festivalDay(v) : null, day: g.env.day, gift: g.story.rec.gift && g.story.rec.gift.fest, home: Math.round(VR.StoryPlay.ctxOf(g, g.story).near.home) }; });
      console.log('     festival ' + JSON.stringify(fs0));
      check(fs0.fest === true, 'the village celebrates the Dreilichterfest tonight');
      await at('c16.b1', [3, 10.5, 17], ['c16_1_fest', 'c16_1_round', 'c16_1_funke'], DUSK);
      await at('c16.b2', [4.5, 12, 20], ['c16_2_sky', 'c16_2_home', 'c16_2_funke'], DUSK);
    }
  }
  // ---------------------------------------------------------------- the journey: the Ringstation, Zinnober
  if (want('trip')) {
    console.log('trip · the Ringstation and Zinnober');
    await ev(() => VR.StoryPlay.debug.reach('c14.b1'));
    if (await trip('stn.ring')) await at('c14.b1', [9], ['c14_1_window'], null);
    await ev(() => VR.StoryPlay.debug.reach('c14.b2'));
    if (await trip('zinn')) {
      let V = null; for (let i = 0; i < 30 && !V; i++) { V = await ev(() => { const v = VR.StoryPlay.village(VR.game); return v ? { x: v.s.x, y: v.s.y || 70, z: v.s.z, d: Math.round(v.d) } : null; }); if (!V) { await run(20); await wait(200); } }
      if (V) { await ev((V) => { const p = VR.game.player; p.flying = true; p.teleport(V.x + 10, V.y + 30, V.z + 10); }, V); await settle(16, 'Zinnober\'s village'); console.log('     stand ' + JSON.stringify(await toward(V.x, V.y, V.z, 40, 0))); await run(30); }
      await at('c14.b2', [3, 15], ['c14_2_village', 'c14_2_funke'], null);
      const fz = await fairyAt(null);
      if (fz) { console.log('     stand ' + JSON.stringify(await toward(fz.x, fz.y, fz.z, 13, 0))); await settle(10, 'the far Flausel'); await at('c14.b3', [3, 9], ['c14_3_flausel', 'c14_3_funke'], null); }
      check(!!fz, 'Zinnober\'s fairy place (' + JSON.stringify(fz) + ')');
    }
  }
  // ---------------------------------------------------------------- the costs: ms a drawn frame outside a scene and in one
  if (want('cost')) {
    console.log('cost · Very Low and High, outside a scene and in one (' + secs() + ')');
    for (const pr of ['potato', 'high']) {
      await preset(pr); console.log('     preset ' + pr + ' (' + secs() + ')'); await draw(null); N['out_' + pr] = await frameMs(12); console.log('     out ' + N['out_' + pr] + ' ms (' + secs() + ')');
      await ev(() => VR.StoryPlay.debug.play('c16.b1')); await sceneTo(4); N['in_' + pr] = await frameMs(12); console.log('     in ' + N['in_' + pr] + ' ms (' + secs() + ')'); await skipScene();
    }
    N.brainMs = await ev(() => { const S0 = VR.StoryPlay.stats; return +(S0.brainMs / Math.max(1, S0.brains)).toFixed(3); });
    N.arc2 = await ev(() => VR.StoryArc2.stats);
    console.log('     costs ' + JSON.stringify({ out_potato: N.out_potato, in_potato: N.in_potato, out_high: N.out_high, in_high: N.in_high, brainMs: N.brainMs, arc2: N.arc2 }));
    save();
  }
} catch (e) { fails++; console.log('  ✗ stopped: ' + (e.stack || e.message).slice(0, 900)); }
const errs = logs.filter(l => l.startsWith('[pageerror]'));
check(errs.length === 0, 'no page error' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ').slice(0, 600) : ''));
save();
try {
  const P = (n) => SHOTS + 's7_' + n + '.png', ex = (n) => fs.existsSync(P(n));
  const rows = [['13 · Dreimal — Wiegelind blinkt · Funke', ['c13_1_wiege', 'c13_1_funke']], ['13 · die Flausel blinken zurück · Mutter Borke · das eine Lied', ['c13_2_flausel', 'c13_2_borke', 'c13_3_song']],
    ['14 · das Fenster der Ringstation · Zinnobers Dorf · Funke', ['c14_1_window', 'c14_2_village', 'c14_2_funke']], ['14 · die fernen Flausel · Funke', ['c14_3_flausel', 'c14_3_funke']],
    ['15 · der Himmel · dein Zeichen · Funke', ['c15_1_sky', 'c15_2_sign', 'c15_2_funke']], ['15 · Wiegelind sinkt herab · Wiegelinds Ruh', ['c15_3_descend', 'c15_3_place']],
    ['16 · das Dreilichterfest · im Kreis · Funke', ['c16_1_fest', 'c16_1_round', 'c16_1_funke']], ['16 · das letzte Bild: der Himmel · das Dorf · Funke', ['c16_2_sky', 'c16_2_home', 'c16_2_funke']]]
    .map(([label, ns]) => ({ label, imgs: ns.filter(ex).map(P) })).filter(r => r.imgs.length);
  fs.writeFileSync(ROOT + '.tmp_tests/story7_sheet.json', JSON.stringify({ w: 620, rows }));
  execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'story7_sheet.jpg', ROOT + '.tmp_tests/story7_sheet.json']);
  console.log('     sheet test/shots/story7_sheet.jpg');
} catch (e) { console.log('  (the sheet: ' + String(e.message || e).slice(0, 200) + ')'); }
await browser.close();
console.log((fails ? 'FAILED ' + fails : 'ALL OK') + ' (' + secs() + ')');
process.exit(fails ? 1 : 0);
