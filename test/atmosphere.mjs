// Atmosphere (A1 Wetter & Klang) in the browser, against dist/:
//  - every weather state renders without page or WebGL errors and is shot to test/shots/atmo_<state>.png
//  - a bolt lights the sky and its thunder is counted; the Audio tab switches turn the effects off
//  - Very Low (potato): the extra game-loop time of rain and ambience is at most 0.5 ms. This is CPU time only
//    (the loop without drawing, alternating blocks); GPU time under SwiftShader is not meaningful here.
//  - no page errors
//   nohup bash test/wt_run.sh atmosphere.mjs 1500 > .tmp_tests/atmosphere.log 2>&1 &
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || t === 'warning') logs.push(`[${t}] ${s.slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 800)));
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ok    ' : '  FAIL  ') + msg); };
const errorsSince = (k) => logs.slice(k).filter(l => l.startsWith('[error]') || l.startsWith('[pageerror]'));

try {
  await page.goto('file:///home/claude/vr/dist/index.html');
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(() => { const g = VR.game; g.settings.renderDist = 7; g.settings.dynRes = false; g.applySettings('renderDist'); });
  await ev(`VR.game.createWorld({name:'Atmo',mode:'survival',difficulty:'normal',type:'default',seed:'424242',cheats:true,kit:true})`);
  for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  // Balanced for the look (a two-core machine boots on Very Low, which has no wet ground); the audio starts as a click would start it
  await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.renderDist = 7; g.settings.dynRes = false; g.applySettings('renderDist'); g.audio.resume(); });
  await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.setTime(6000); });
  // the test drives the loop itself: game.loop() schedules its own animation frame, so every manual call would start
  // another chain of frames; the browser's own chain is ended here (its last callback finds no requestAnimationFrame)
  await ev(() => { window.requestAnimationFrame = () => 0; });

  // the game loop without drawing (the world, the sky, the sound and the rain's bookkeeping all run); the
  // renderer's render() is skipped while window.__norender is set, as in smoke.mjs
  const loops = async (n) => {
    for (let k = 0; k < n; k += 60) await ev(([m]) => {
      const g = VR.game, R = g.renderer;
      if (!R._render) { R._render = R.render; R.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
      window.__norender = true;
      for (let i = 0; i < m; i++) { g.last = performance.now() - 33; g.loop(performance.now()); }
    }, [Math.min(60, n - k)]);
  };
  // the same, counting the bolts and the highest flash
  const watch = async (n) => {
    let maxFlash = 0, strikes = 0, thunders = 0;
    for (let k = 0; k < n; k += 300) {
      const r = await ev(([m]) => { const g = VR.game, W = g.env.wx; window.__norender = true; let mf = 0; for (let i = 0; i < m; i++) { g.last = performance.now() - 33; g.loop(performance.now()); if (W.flash > mf) mf = W.flash; } return { mf, strikes: W.strikes, thunders: g.ambience ? g.ambience.thunders : 0 }; }, [Math.min(300, n - k)]);
      maxFlash = Math.max(maxFlash, r.mf); strikes = r.strikes; thunders = r.thunders;
    }
    return { maxFlash, strikes, thunders };
  };
  const state = () => ev(() => { const g = VR.game, W = g.env.wx; return { kind: W.kind, forced: W.forced, rain: +g.env.rain.toFixed(3), snow: +g.env.snow.toFixed(3), fog: +W.v.fog.toFixed(3), wet: +g.env.E.wet.toFixed(3), flash: +W.flash.toFixed(3), strikes: W.strikes, thunders: g.ambience ? g.ambience.thunders : 0, fogDens: +g.env.E.fog[2].toExponential(2), exp: +W.v.exp.toFixed(2) }; });
  const glErrors = () => ev(() => { const gl = VR.game.renderer.gl, out = []; for (let i = 0; i < 20; i++) { const e = gl.getError(); if (e === gl.NO_ERROR) break; out.push(e); } return out; });
  const view = async (name) => {
    await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; });
    await wait(200);
    await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 });
  };

  // the pictures need open sky: the spawn is inside a hall, so the player flies up above its roof (creative, in the air)
  const up = await ev(() => {
    const g = VR.game, w = g.world, p = g.player, x = Math.floor(p.pos[0]), z = Math.floor(p.pos[2]);
    let y0 = -1;
    for (let y = Math.floor(p.pos[1]) + 1; y < 240; y++) if ((w.getLight(x, y, z) >>> 12) >= 15 && !w.getBlock(x, y, z) && !w.getBlock(x, y + 1, z)) { y0 = y; break; }
    p.setMode('creative');
    if (y0 > 0) p.teleport(x + 0.5, y0 + 3, z + 0.5);
    p.flying = true;
    return y0;
  });
  check(up > 0, `an open sky above the spawn (y ${up})`);
  await loops(120);

  // ---- the states: each one settles for ~24 s of game time, renders, and shows its own look
  await loops(240);
  // the world around the view loaded first (on a loaded machine the streaming lags, and an unsettled view shows the
  // coarse far tiles near by: the pictures would not compare with the reference shots)
  const settle = async (max) => {
    for (let i = 0; i < max; i++) {
      await loops(10);
      const st = await ev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty }; });
      if (st.busy === 0 && st.pend === 0 && st.dirty === 0 && i > 3) return;
      await wait(80);
    }
  };
  await settle(150);
  const STATES = [['klar', 'klar'], ['bewoelkt', 'bewölkt'], ['nebel', 'nebel'], ['regen', 'regen'], ['gewitter', 'gewitter'], ['schnee', 'schnee']];
  const rows = [];
  for (const [kind, word] of STATES) {
    const k0 = logs.length;
    await ev((w) => VR.game.chat('/wetter ' + w), word);
    await loops(720);
    await settle(40);
    const s = await state();
    await glErrors();
    await view('atmo_' + kind);
    const gl = await glErrors();
    const errs = errorsSince(k0);
    check(s.kind === kind && gl.length === 0 && errs.length === 0, `${kind}: renders (kind ${s.kind}, WebGL errors ${gl.length}, page or console errors ${errs.length})`);
    rows.push({ kind, ...s, shot: `test/shots/atmo_${kind}.png` });
  }
  const byKind = Object.fromEntries(rows.map(r => [r.kind, r]));
  check(byKind.regen.rain > 0.9 && byKind.regen.snow < 0.05, `regen eases to full rain (rain ${byKind.regen.rain})`);
  check(byKind.schnee.snow > 0.9 && byKind.schnee.rain < 0.05, `schnee eases to snow (snow ${byKind.schnee.snow})`);
  check(byKind.nebel.fog > 0.9 && byKind.nebel.fogDens !== byKind.klar.fogDens, `nebel thickens the fog (fog ${byKind.nebel.fog} · density ${byKind.nebel.fogDens} vs klar ${byKind.klar.fogDens})`);
  check(byKind.klar.rain === 0 && byKind.klar.snow === 0 && byKind.klar.fog < 0.05, 'klar has no rain, no snow, no fog');
  check(byKind.regen.wet > 0.9 && byKind.klar.wet === 0, `the ground is wet in the rain (${byKind.regen.wet}), dry in the sun (${byKind.klar.wet})`);

  // ---- lightning in a storm: bolts every 8–25 s, the thunder counted as it is heard
  await ev((w) => VR.game.chat('/wetter ' + w), 'gewitter');
  await loops(360);
  const b0 = await state();
  const w = await watch(1800);                  // 60 s of game time
  const bolts = w.strikes - b0.strikes;
  check(bolts >= 2 && bolts <= 9, `gewitter: ${bolts} bolts in 60 s (every 8–25 s: 2 to 9 in a minute)`);
  check(w.maxFlash > 0.3, `gewitter: the sky flashes (highest flash ${w.maxFlash.toFixed(2)})`);
  check(w.thunders > b0.thunders, `gewitter: thunder is heard (${w.thunders - b0.thunders} rumbles)`);

  // ---- the switches turn the effects off
  // Wetter Aus: a /wetter gewitter shows clear sky, no bolts, no rain, no thunder
  await ev(() => { const g = VR.game; g.settings.wx = 'off'; g.applySettings('wx'); });
  await ev((w) => VR.game.chat('/wetter ' + w), 'gewitter');
  await loops(360);
  const a0 = await state();
  const a1 = await watch(900);
  const aus = await state();
  check(aus.kind === 'klar' && aus.rain < 0.01 && aus.flash === 0 && a1.strikes === a0.strikes && a1.thunders === a0.thunders,
    `Wetter Aus: no storm (kind ${aus.kind}, rain ${aus.rain}), no bolt (${a1.strikes - a0.strikes}), no thunder (${a1.thunders - a0.thunders})`);
  // Wetter Ruhig: /wetter regen shows cloudy only
  await ev(() => { const g = VR.game; g.settings.wx = 'calm'; g.applySettings('wx'); });
  await ev((w) => VR.game.chat('/wetter ' + w), 'regen');
  await loops(720);
  const ruhig = await state();
  check(ruhig.kind === 'bewoelkt' && ruhig.rain < 0.01, `Wetter Ruhig: /wetter regen shows bewölkt, no rain (kind ${ruhig.kind}, rain ${ruhig.rain})`);
  await ev(() => { const g = VR.game; g.settings.wx = 'normal'; g.applySettings('wx'); g.env.wx.force('regen'); });
  await loops(720);
  // Nasser Boden: off keeps the ground dry in the rain, on wets it
  await ev(() => { const g = VR.game; g.settings.wetGround = false; g.applySettings('wetGround'); });
  await loops(30);
  const dry = await state();
  check(dry.rain > 0.9 && dry.wet === 0, `Nasser Boden aus: it rains and the ground stays dry (rain ${dry.rain}, wet ${dry.wet})`);
  await ev(() => { const g = VR.game; g.settings.wetGround = true; g.applySettings('wetGround'); });
  await loops(30);
  const wetOn = await state();
  check(wetOn.wet > 0.9, `Nasser Boden an: the ground is wet in the rain (wet ${wetOn.wet})`);

  // Natur-Klänge: the nature layers fall silent and come back; needs the audio clock to run
  // (the gains glide to their targets over ~0.4 s of audio time, so the page waits 2.5 s of real time before reading)
  const clockNow = () => ev(() => { const c = VR.game.audio.ctx; return c ? { t: c.currentTime, st: c.state } : null; });
  const gains = () => ev(() => { const L = VR.game.ambience && VR.game.ambience.L; if (!L) return null; const o = {}; for (const k of ['wind', 'birds', 'crickets', 'water']) o[k] = +L[k].g.gain.value.toFixed(3); return o; });
  await ev(() => { const g = VR.game; g.audio.resume(); g.env.wx.force('klar'); g.settings.natSound = 'off'; g.applySettings('natSound'); });
  await loops(60); const c1 = await clockNow(); await wait(2500); await loops(10); const c2 = await clockNow();
  const audioRuns = !!(c1 && c2 && c2.t - c1.t > 1);
  if (!audioRuns) console.log('  skip  Natur-Klänge gains: the audio clock does not run in this browser (' + JSON.stringify(c2) + ')');
  if (audioRuns) {
    const off = await gains();
    check(off && Object.values(off).every(v => v < 0.02), `Natur-Klänge Aus: the nature layers are silent (${JSON.stringify(off)})`);
    await ev(() => { const g = VR.game; g.settings.natSound = 'synth'; g.applySettings('natSound'); });
    await loops(60); await wait(2500); await loops(10);
    const on = await gains();
    check(on && on.wind > 0.03, `Natur-Klänge Synthetisch: the wind is back (${JSON.stringify(on)})`);
  }
  await ev(() => { VR.game.env.wx.force(null); });

  // ---- Very Low: the extra game-loop time of the weather, alternating blocks of 200 frames
  await ev(() => VR.game.applyPreset('potato'));
  // the mean over a block of frames (the browser's timer steps 0.1 ms, so single frames are too coarse)
  const frames = (n) => ev((n) => {
    const g = VR.game; window.__norender = true;
    const a = performance.now();
    for (let i = 0; i < n; i++) { g.last = performance.now() - 33; g.loop(performance.now()); }
    return (performance.now() - a) / n;
  }, n);
  const quietOn = () => ev(() => { const g = VR.game; g.settings.wx = 'off'; g.applySettings('wx'); g.settings.natSound = 'off'; g.applySettings('natSound'); g.env.wx.force(null); });
  const rainOn = () => ev(() => { const g = VR.game; g.settings.wx = 'normal'; g.applySettings('wx'); g.settings.natSound = 'synth'; g.applySettings('natSound'); g.env.wx.force('regen'); });
  const quiet = [], rainy = [];
  await quietOn(); await loops(120);
  for (let r = 0; r < 3; r++) {
    await quietOn(); await loops(20); quiet.push(await frames(300));
    await rainOn(); await loops(600); rainy.push(await frames(300));
  }
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const dq = mean(quiet), dr = mean(rainy), delta = dr - dq;
  const drops = await ev(() => { const g = VR.game, R = g.renderer; return { count: R.rainCount, budget: [0.3, 0.6, 1][VR.game.settings.particles | 0] }; });
  check(delta <= 0.5, `Very Low: the weather costs ${delta.toFixed(3)} ms a frame (quiet ${dq.toFixed(3)} ms, rain ${dr.toFixed(3)} ms; drops ${Math.floor(drops.count * drops.budget)} of ${drops.count}); CPU only`);
  const potato = await ev(() => ({ wetGround: VR.game.settings.wetGround, preset: VR.game.settings.preset, particles: VR.game.settings.particles }));
  check(potato.preset === 'potato' && potato.wetGround === false, 'Very Low turns the wet ground off');

  // ---- no page errors at all
  const pageErrs = logs.filter(l => l.startsWith('[pageerror]'));
  check(pageErrs.length === 0, `no page errors (${pageErrs.length})`);
  console.log('states: ' + JSON.stringify(rows.map(r => ({ kind: r.kind, rain: r.rain, snow: r.snow, fog: r.fog, wet: r.wet, shot: r.shot }))));
  console.log('quiet ' + JSON.stringify(quiet) + ' rain ' + JSON.stringify(rainy));
  const consoleErrs = logs.filter(l => l.startsWith('[error]'));
  console.log('console errors: ' + consoleErrs.length + (consoleErrs.length ? '\n' + consoleErrs.slice(0, 8).join('\n') : ''));
} catch (e) {
  fails++; console.log('  FAIL  the run stopped: ' + (e.stack || e.message).slice(0, 800));
} finally {
  await browser.close();
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exitCode = fails ? 1 : 0;
}
