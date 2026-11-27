// ============================================================================
// R9-SI Lab · PC-Emulator: das echte Spiel in einem Browser ohne Fenster, gebremst wie ein älterer Rechner.
// The PC emulator: the real game (dist/index.html) in a headless Chromium, its processor slowed by Chrome's own CPU
// throttling (the DevTools protocol, Emulation.setCPUThrottlingRate), at a laptop's or an old monitor's resolution, with
// Smart Quality on. Each profile plays the same scenes in the owner's world and records, four times a second:
//   · the frame times (every frame's interval, from a requestAnimationFrame of its own) and the HUD's frame rate
//   · Smart Quality's decisions: its ladder (game.aq.stack: g = a graphics rung, c = a processor rung), the probes, the
//     early steps (AQPredict's surprise) and the give-backs it held
//   · AQPredict's forecast half a second ahead next to what then came (the forecast's error)
// Honest limits: the picture is drawn in software (SwiftShader), so the "graphics card" is the processor too — the
// numbers compare builds and profiles with each other; they promise nothing for a real PC. The throttling slows the
// page's main thread (the game loop, the meshing it does there), not its workers.
//   bash lab/emu/run.sh [--profiles office,old-laptop,potato] [--scenes town,sea,flight] [--seconds 30] [--seed S]
//                       [--out lab/out/emu.json]          (run.sh waits for one of the machine's two browser slots)
// ============================================================================
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };

export const PROFILES = {
  // (relative to this machine: "office" is the machine as it is; the others slow its processor. The picture is small —
  // 320 × 180, EMU_W / EMU_H — because the software renderer draws every pixel on the processor: at a laptop's size the
  // run would measure SwiftShader, not the game; small, the frame is the game's own work)
  office: { cpu: 1, w: +(process.env.EMU_W || 320), h: +(process.env.EMU_H || 180), preset: 'balanced', de: 'Büro-PC', en: 'office PC' },
  'old-laptop': { cpu: 3, w: +(process.env.EMU_W || 320), h: +(process.env.EMU_H || 180), preset: 'balanced', de: 'alter Laptop', en: 'old laptop' },
  potato: { cpu: 5, w: +(process.env.EMU_W || 320), h: +(process.env.EMU_H || 180), preset: 'potato', de: 'Kartoffel-PC', en: 'potato PC' },
};
export const SCENES = {
  town: { de: 'im Dorf am Start (langsam umsehen)', en: 'in the spawn village (looking round slowly)' },
  sea: { de: 'über dem offenen Meer', en: 'over the open sea' },
  flight: { de: 'Flug über das Land (25 Blöcke/s)', en: 'flight over the land (25 blocks/s)' },
};
const PROF = opt('profiles', 'office,old-laptop,potato').split(',').filter((p) => PROFILES[p]);
const SCN = opt('scenes', 'town,sea,flight').split(',').filter((s) => SCENES[s]);
const SECS = +opt('seconds', 30), SEED = String(opt('seed', '3616214791'));
const OUT = path.resolve(opt('out', path.join(ROOT, 'lab/out/emu.json')));
const T0 = Date.now(), el = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
const log = (...a) => console.log(`[${el()}]`, ...a);

// ---------------------------------------------------------------- where the scenes are (node, before the browser)
function scenePoints() {
  const W = require(path.join(ROOT, 'lab/lib/world.js'));
  const g = W.gen(+SEED, W.newestVgen()), sp = g.findSpawn(), SEA = W.VR.C.SEA;
  let sea = null;
  for (let r = 256; r <= 4000 && !sea; r += 128) for (let a = 0; a < 24 && !sea; a++) {
    const x = Math.round(sp[0] + Math.cos(a / 24 * Math.PI * 2) * r), z = Math.round(sp[2] + Math.sin(a / 24 * Math.PI * 2) * r);
    let ok = true;
    for (let dz = -96; dz <= 96 && ok; dz += 48) for (let dx = -96; dx <= 96; dx += 48) if (g.surfaceY(x + dx, z + dz) > SEA - 6) { ok = false; break; }
    if (ok) sea = [x, SEA + 14, z];
  }
  return { vgen: W.newestVgen(), spawn: sp.slice(0, 3).map(Math.round), sea: sea || [sp[0] + 2000, SEA + 14, sp[2]] };
}

// ---------------------------------------------------------------- in the page, before the game starts
const PROBE = (o) => {
  try { localStorage.setItem('r9si.settings', o.settings); localStorage.removeItem('r9si.aqmem'); } catch (e) { /* private mode */ }
  const E = window.__emu = { dts: [], last: 0, err: [] };
  const raf = window.requestAnimationFrame.bind(window);
  const tick = (t) => { if (E.last) E.dts.push(t - E.last); E.last = t; raf(tick); };
  raf(tick);
  const iv = setInterval(() => {
    const g = window.VR && window.VR.game;
    if (g && g.state === 'title' && !E.created) { E.created = true; try { const p = g.createWorld(o.create); if (p && p.catch) p.catch((e) => E.err.push(String(e.message))); } catch (e) { E.err.push(String(e.message)); } }
    if (g && g.state === 'play') clearInterval(iv);
  }, 50);
};
// one sample: the frames since the last one and the game's state
const SAMPLE = () => {
  const g = VR.game, E = window.__emu, aq = g.aq || {}, AP = VR.AQPredict, pp = aq.pp;
  const dts = E.dts; E.dts = [];
  const tr = pp && AP ? AP.trend(pp) : null;
  // the land within the view distance that is drawn whole (every section meshed — else the far stand-in shows there)
  let want = 0, shown = 0;
  const w = g.world, pl = g.player;
  if (w && pl && VR.ckey) {
    const rd = w.renderDist | 0, pcx = Math.floor(pl.pos[0]) >> 4, pcz = Math.floor(pl.pos[2]) >> 4;
    for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; want++; const c = w.cols.get(VR.ckey(pcx + dx, pcz + dz)); if (c && c.shownAt >= 0) shown++; }
  }
  return {
    t: g.time, dts, fps: g.fps || 0, fpsWin: aq.fpsWin || 0, jsMs: g.jsMs || 0, gpuMs: g.renderer.gpuMs === undefined ? null : g.renderer.gpuMs,
    stack: (aq.stack || []).join(''), g: aq.g | 0, c: aq.c | 0, probe: aq.probe ? aq.probe.kind : '', hold: aq.hold || 0,
    early: aq.earlyN | 0, held: aq.heldN | 0, gpuBound: !!aq.gpuBound, cpuBound: !!aq.cpuBound,
    pred: pp && AP ? AP.predict(pp) : null, mean: tr ? tr.mean : null, surprise: pp && AP ? AP.surprise(pp) : null,
    cols: g.world && g.world.cols ? g.world.cols.size : 0, pos: g.player ? g.player.pos.map((v) => Math.round(v)) : null,
    shown: want ? shown / want : null,
  };
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// the world settled: nothing more asked of the workers and nothing waiting for upload, the columns' count steady for 2 s
// (at most maxS seconds) → the seconds it took
async function settle(page, maxS) {
  const t0 = Date.now(); let last = -1, same = 0;
  while ((Date.now() - t0) / 1000 < maxS) {
    await sleep(500);
    const st = await page.evaluate(() => { const w = VR.game.world; return { n: w.cols.size, p: w.pending.size, q: w.uploadQ && w.uploadQ.size !== undefined ? w.uploadQ.size : (w.uploadQ && w.uploadQ.q ? w.uploadQ.q.length : 0) }; }).catch(() => null);
    if (!st) continue;
    if (st.n === last && st.p === 0 && !st.q) same += 0.5; else same = 0;
    last = st.n;
    if (same >= 2) break;
  }
  return r1((Date.now() - t0) / 1000);
}
const q = (a, f) => { const s = a.filter(Number.isFinite).slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))] : null; };
const r1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);

// the summary of a scene's samples
export function summarize(samples) {
  const dts = samples.flatMap((s) => s.dts).filter((d) => d > 0 && d < 5000);
  const med = q(dts, 0.5);
  const steps = [];
  for (let i = 1; i < samples.length; i++) if (samples[i].stack !== samples[i - 1].stack) steps.push({ t: r1(samples[i].t - samples[0].t), from: samples[i - 1].stack, to: samples[i].stack, kind: samples[i].stack.length > samples[i - 1].stack.length ? 'down' : 'up' });
  // the forecast: each sample's prediction against the trend's mean half a second later
  const errs = [];
  for (let i = 0; i < samples.length; i++) {
    const a = samples[i]; if (!Number.isFinite(a.pred)) continue;
    const b = samples.find((s) => s.t >= a.t + 0.5); if (!b || !Number.isFinite(b.mean)) continue;
    errs.push(a.pred - b.mean);
  }
  const mae = errs.length ? errs.reduce((x, e) => x + Math.abs(e), 0) / errs.length : null, bias = errs.length ? errs.reduce((x, e) => x + e, 0) / errs.length : null;
  return {
    frames: dts.length, fps: r1(dts.length ? 1000 / (dts.reduce((a, b) => a + b, 0) / dts.length) : 0),
    frameP50: r1(med), frameP95: r1(q(dts, 0.95)), frameP99: r1(q(dts, 0.99)), hitches: med ? dts.filter((d) => d > Math.max(50, 2.5 * med)).length : 0,
    fpsHudMed: r1(q(samples.map((s) => s.fps), 0.5)), steps, stackEnd: samples.length ? samples[samples.length - 1].stack : '',
    early: samples.length ? samples[samples.length - 1].early - samples[0].early : 0, held: samples.length ? samples[samples.length - 1].held - samples[0].held : 0,
    cpuBoundShare: r1(samples.filter((s) => s.cpuBound).length / Math.max(1, samples.length) * 100),
    forecast: { n: errs.length, maeMs: r1(mae), biasMs: r1(bias) }, cols: samples.length ? samples[samples.length - 1].cols : 0,
    shownMin: r1(Math.min(...samples.map((s) => (Number.isFinite(s.shown) ? s.shown * 100 : 100)))), shownMean: r1(samples.filter((s) => Number.isFinite(s.shown)).reduce((a, s, i, A) => a + s.shown * 100 / A.length, 0)),
  };
}

async function main() {
  const dist = path.join(ROOT, 'dist/index.html');
  if (!fs.existsSync(dist)) { log('building dist/ …'); execSync('node build.js', { cwd: ROOT, stdio: 'ignore' }); }
  let version = '?'; try { version = execSync('git describe --tags --always --dirty', { cwd: ROOT, encoding: 'utf8' }).trim(); } catch (e) { /* no git */ }
  const P = scenePoints();
  log(`R9-SI PC emulator · ${version} · seed ${SEED} (vgen ${P.vgen}) · spawn ${P.spawn.join(' ')} · sea ${P.sea.join(' ')} · ${PROF.join(', ')} × ${SCN.join(', ')} · ${SECS} s each`);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const out = { made: new Date().toISOString(), version, seed: SEED, vgen: P.vgen, seconds: SECS, points: P, profiles: [] };
  try {
    for (const pid of PROF) {
      const pr = PROFILES[pid];
      log(`— ${pid}: CPU ÷${pr.cpu}, ${pr.w}×${pr.h}, ${pr.preset}`);
      // the preset's settings with Smart Quality on (read from the game itself)
      const c0 = await browser.newContext({ viewport: { width: 640, height: 360 }, locale: 'de-DE' }), p0 = await c0.newPage();
      await p0.goto('file://' + dist, { waitUntil: 'commit', timeout: 120000 });
      for (let i = 0; i < 400; i++) { await sleep(500); if (await p0.evaluate(() => !!(window.VR && VR.game && VR.game.state === 'title')).catch(() => false)) break; }
      const settings = await p0.evaluate((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = true; g.settings.autoPreset = false; return JSON.stringify(g.settings); }, pr.preset);
      await c0.close();
      const ctx = await browser.newContext({ viewport: { width: pr.w, height: pr.h }, locale: 'de-DE' });
      await ctx.addInitScript(PROBE, { settings, create: { name: 'Emulator', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: SEED, cheats: true, kit: false } });
      const page = await ctx.newPage(), errs = [];
      page.on('pageerror', (e) => errs.push(String(e.stack || e.message).slice(0, 400)));
      const tLoad = Date.now();
      await page.goto('file://' + dist, { waitUntil: 'commit', timeout: 180000 });
      let ok = false;
      for (let i = 0; i < 600; i++) { await sleep(500); if (await page.evaluate(() => !!(window.VR && VR.game && VR.game.state === 'play')).catch(() => false)) { ok = true; break; } }
      const prof = { id: pid, ...pr, loadS: r1((Date.now() - tLoad) / 1000), scenes: [], errors: errs };
      out.profiles.push(prof);
      if (!ok) { log('  the world did not start'); await ctx.close(); continue; }
      const cdp = await ctx.newCDPSession(page);
      if (pr.cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: pr.cpu });
      await page.evaluate(() => { const g = VR.game; g.env.setTime(6000); g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.setMode) g.env.wx.setMode('off'); const p = g.player; p.flying = true; p.noclip = true; });
      await settle(page, 90);   // (the first land round the spawn)
      for (const sid of SCN) {
        const start = sid === 'sea' ? P.sea : sid === 'flight' ? [P.spawn[0], 150, P.spawn[2]] : [P.spawn[0], P.spawn[1] + 2, P.spawn[2]];
        await page.evaluate(([x, y, z, sid]) => {
          const g = VR.game, p = g.player; clearInterval(window.__mv);
          p.teleport(x, y, z); p.yaw = 0; p.pitch = sid === 'flight' ? -0.25 : -0.08; if (p.vel) { p.vel[0] = p.vel[1] = p.vel[2] = 0; }
          let last = performance.now();
          window.__mv = setInterval(() => {
            const now = performance.now(), dt = Math.min(0.2, (now - last) / 1000); last = now;
            if (sid === 'flight') p.teleport(p.pos[0] + 25 * dt, p.pos[1], p.pos[2]);   // (east, 25 blocks a second, high over the land)
            else p.yaw += dt * Math.PI * 2 / 30;                                          // (a slow look round: a turn in 30 s)
            if (sid === 'flight') p.yaw = -Math.PI / 2;
          }, 50);
        }, [...start, sid]);
        // (town, sea: measured once the land round the spot has come in — the steady state; the flight starts moving at once:
        // the streaming ahead of it is what it measures)
        const settleS = sid === 'flight' ? 0 : await settle(page, 60);
        await page.evaluate(() => { window.__emu.dts = []; });
        const samples = [];
        const tEnd = Date.now() + SECS * 1000;
        while (Date.now() < tEnd) { await sleep(250); try { samples.push(await page.evaluate(SAMPLE)); } catch (e) { errs.push('sample: ' + e.message); } }
        const sum = summarize(samples);
        prof.scenes.push({ id: sid, settleS, samples, summary: sum });
        log(`  ${sid.padEnd(6)} ${String(sum.fps).padStart(5)} fps · frame p50 ${sum.frameP50} ms, p95 ${sum.frameP95} ms · hitches ${sum.hitches} · steps ${sum.steps.map((s) => s.to || '∅').join(' → ') || '–'} · forecast ±${sum.forecast.maeMs} ms · land drawn ${sum.shownMean} % (least ${sum.shownMin} %)`);
      }
      await page.evaluate(() => clearInterval(window.__mv)).catch(() => {});
      await ctx.close();
    }
  } finally { await browser.close(); }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  log('wrote', path.relative(ROOT, OUT));
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main().catch((e) => { console.error(e); process.exit(1); });
