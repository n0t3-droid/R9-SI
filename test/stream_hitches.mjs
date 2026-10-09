// F10 · streaming without hitches on a weak GPU, browser test: the same 60 s flight on the build before (v042) and this
// one, in one browser, on Low and on Balanced at 1280 × 720 (seed 1, noon, frozen weather), every frame waited for with
// a one-pixel read (the frame method of test/far.mjs). Hitches = frames over 2 × the flight's median frame.
//
// The GPU here is SwiftShader (the CPU): an upload is a memcpy, invisible next to a 1 s frame. The owner's integrated GPU
// shares the system memory, and the copy into it happens in the GPU process after the JS call has returned. So both builds
// fly against the same MODEL of such an upload path, installed in the page before the game loads: every byte handed to
// the GPU (bufferData/bufferSubData/texImage/texSubImage with data) queues copy time; the frame's sync (the one-pixel read)
// and gl.finish wait for it; a fence signals only after the copies queued before it. Its rate: MS_PER_MB on the owner's
// frame (default 15 ms per MB: a 3 MB burst — what v042's budget lets through when the queue is deep — costs one 50 ms
// frame), stretched by k = the software frame ÷ the owner's frame (Low 50 ms, Balanced 70 ms; k measured at the start of
// the first build of each preset, the same k for both builds), so a copy keeps its share of the frame. v042's scheduler
// times the JS call (fast) and cannot see this; the new one sees it through finish and the fences — as on his machine.
//  1. Low and Balanced: hitches, stutters (> 1.5 ×), frame ms, upload bytes and the model's copy ms per frame, before and
//     after; the after build measured the model's rate; at the end both settle and are photographed from the same spot:
//     the same columns shown (none missing), the pictures alike (test/shots/stream_end_<preset>_<build>.png)
//  2. Very Low and High with no streaming (the settled spawn, model off): frame ms before and after (must be equal)
//   nohup bash test/wt_run.sh stream_hitches.mjs 9000 > .tmp_tests/stream_hitches.log 2>&1 &
//   BEFORE_URL / AFTER_URL (default: .tmp_tests/before_dist/index.html — build v042's dist there first — and dist/index.html)
//   MS_PER_MB · FLIGHT_FRAMES (240) · DT (0.25 s) · SPEED (15 blocks/s) · PRESETS (low,balanced) · SKIP_COST=1 · SKIP_FLIGHT=1
// regress: skip  (a before/after benchmark of an hour that needs the build before in .tmp_tests/before_dist)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/claude/.npm-global/lib/node_modules/sharp/lib/index.js';
import fs from 'fs';
const ROOT = '/home/claude/vr';
const BEFORE_URL = process.env.BEFORE_URL || 'file://' + ROOT + '/.tmp_tests/before_dist/index.html';
const AFTER_URL = process.env.AFTER_URL || 'file://' + ROOT + '/dist/index.html';
const MS_PER_MB = +(process.env.MS_PER_MB || 15);
const OWNER_MS = { low: 50, balanced: 70 };
const FLIGHT_FRAMES = +(process.env.FLIGHT_FRAMES || 240), DT = +(process.env.DT || 0.25), SPEED = +(process.env.SPEED || 15);
const PRESETS = (process.env.PRESETS || 'low,balanced').split(',');
const SHOTS = ROOT + '/test/shots', OUT = ROOT + '/.tmp_tests';
const MB = 1048576;
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  ' + info : '')); };
const median = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
const pct = (a, q) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(q * b.length))] : 0; };
if (!fs.existsSync(BEFORE_URL.replace('file://', ''))) { console.log('the build before is missing: ' + BEFORE_URL); console.log('FAILED 1'); process.exit(1); }
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const errsAll = [];

// ---- the model of a shared-memory upload path (in the page, before the game's scripts)
const MODEL_INIT = () => {
  const P = WebGL2RenderingContext.prototype;
  const sim = window.__sim = { on: false, msPerByte: 0, pendMs: 0, seq: 0, sub: 0, data: 0, tex: 0, waitMs: 0, total: 0 };
  const bpe = (v) => (v && v.BYTES_PER_ELEMENT) || 1;
  const viewBytes = (v, off, len) => { if (!v || typeof v === 'number') return 0; if (len !== undefined && len > 0) return len * bpe(v); if (off) return v.byteLength - off * bpe(v); return v.byteLength || 0; };
  const imgBytes = (s) => (s && s.width ? s.width * s.height * 4 : 0);
  const charge = (kind, bytes) => { if (!sim.on || !(bytes > 0)) return; sim.pendMs += bytes * sim.msPerByte; sim[kind] += bytes; sim.total += bytes; };
  const drainQ = () => { if (sim.pendMs > 0) { const t = performance.now() + sim.pendMs; while (performance.now() < t) { /* the copies */ } sim.waitMs += sim.pendMs; sim.pendMs = 0; } sim.seq++; };
  const wrap = (name, before) => { const o = P[name]; if (!o) return; P[name] = function (...a) { before(a); return o.apply(this, a); }; };
  wrap('bufferData', (a) => { if (typeof a[1] !== 'number') charge('data', viewBytes(a[1], a[3], a[4])); });
  wrap('bufferSubData', (a) => charge('sub', viewBytes(a[2], a[3], a[4])));
  wrap('texSubImage2D', (a) => charge('tex', a.length >= 9 ? (ArrayBuffer.isView(a[8]) ? a[8].byteLength : typeof a[8] === 'number' ? 0 : a[4] * a[5] * 4) : imgBytes(a[6])));
  wrap('texSubImage3D', (a) => charge('tex', ArrayBuffer.isView(a[10]) ? a[10].byteLength : typeof a[10] === 'number' ? 0 : a[5] * a[6] * a[7] * 4));
  wrap('texImage2D', (a) => charge('tex', a.length >= 9 ? (ArrayBuffer.isView(a[8]) ? a[8].byteLength : 0) : imgBytes(a[5])));
  wrap('texImage3D', (a) => charge('tex', ArrayBuffer.isView(a[9]) ? a[9].byteLength : 0));
  wrap('readPixels', () => drainQ());
  wrap('finish', () => drainQ());
  const need = new WeakMap(), oF = P.fenceSync, oW = P.clientWaitSync;
  P.fenceSync = function (...a) { const s = oF.apply(this, a); if (s) need.set(s, sim.pendMs > 0 ? sim.seq + 1 : sim.seq); return s; };
  P.clientWaitSync = function (s, f, t) { const n = need.get(s); if (n !== undefined && sim.seq < n) return this.TIMEOUT_EXPIRED; return oW.call(this, s, f, t); };
};

async function open(build, preset) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  await ctx.addInitScript(MODEL_INIT);
  const page = await ctx.newPage();
  page.on('pageerror', e => errsAll.push('[pageerror] ' + build.label + ': ' + (e.stack || e.message).slice(0, 600)));
  page.on('console', m => { if (m.type() === 'error') errsAll.push('[console] ' + build.label + ': ' + m.text().slice(0, 300)); });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  await page.goto(build.url);
  for (let i = 0; i < 240; i++) { await page.waitForTimeout(500); if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'title'))) break; }
  await ev(() => VR.game.createWorld({ name: 'Ruckler', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: '1', cheats: true, kit: false }));
  for (let i = 0; i < 240; i++) { await page.waitForTimeout(1000); if (await ev(() => VR.game.state) === 'play') break; }
  await ev((p) => {
    const g = VR.game;
    window.requestAnimationFrame = () => 0;
    g.hideHud = true; for (const id of ['hud', 'ui']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; }
    g.applyPreset(p); const S = g.settings; S.dynRes = false; S.minimap = false; S.clouds = 0; S.airLife = false; g.applySettings('*');
    g.env.setTime(6000); g.zenFreezeTime = true; g.zenFreezeWeather = true;
    if (g.env.wx && g.env.wx.setMode) g.env.wx.setMode('off');
    const pl = g.player; pl.flying = true; pl.noclip = true;
    window.__px = new Uint8Array(4);
    window.__place = (x, y, z, yaw, pitch) => { const q = VR.game.player; q.teleport(x, y, z); q.yaw = yaw; q.pitch = pitch; q.viewYaw = yaw; q.fovKick = 0; if (q.vel) { q.vel[0] = 0; q.vel[1] = 0; q.vel[2] = 0; } };
    // one frame, waited for: g.loop, then the one-pixel read (the GPU and the model's copies finish inside the timing)
    window.__frame = (dtS) => {
      const gg = VR.game, gl = gg.renderer.gl, sim = window.__sim, w = gg.world, rs = gg.renderer.stats;
      sim.sub = 0; sim.data = 0; sim.tex = 0; const w0 = sim.waitMs, up0 = w.stats.uploaded || 0;
      gg.last = performance.now() - dtS * 1000;
      const t0 = performance.now(); gg.loop(t0); const t1 = performance.now();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, window.__px);
      const t2 = performance.now();
      const q = w.uploadQ;
      return { ms: t2 - t0, js: t1 - t0, sync: t2 - t1, sub: sim.sub, data: sim.data, tex: sim.tex, copyMs: sim.waitMs - w0, ran: (w.stats.uploaded || 0) - up0, queue: q ? q.size : 0,
        kb: rs.uploadKB, budgetKB: rs.upBudgetKB, mbs: rs.upMBs, hitches: rs.hitches, scale: q && q.scale, mpb: q && q.msPerByte };
    };
    // streaming without drawing (between two drawn frames the world goes on: a frame costs seconds here)
    window.__tick = () => { const gg = VR.game, p2 = gg.player, now = performance.now(); gg.world.update(p2.pos[0], p2.pos[1], p2.pos[2], now); if (gg.horizon) gg.horizon.update({ x: p2.pos[0], y: p2.pos[1] + p2.eye, z: p2.pos[2], yaw: p2.yaw, pitch: p2.pitch, fov: gg.settings.fov * Math.PI / 180 }); gg.pool.pump(); };
    window.__quiet = () => { const gg = VR.game, h = gg.horizon, w = gg.world, f = h && h.far, fr = f && f.report ? f.report() : null; return gg.pool.busy === 0 && w.pending.size === 0 && (!h || h.inflight === 0) && !((w.lastWant || 0) + (h ? h.stats.want || 0 : 0)) && !(w.fading && w.fading.size) && !(w.uploadQ && w.uploadQ.size) && (!fr || (fr.inflight === 0 && fr.want === 0)); };
    window.__cols = () => { const w = VR.game.world, p = VR.game.player, cx = Math.floor(p.pos[0]) >> 4, cz = Math.floor(p.pos[2]) >> 4, rd = w.renderDist, out = []; for (const c of w.cols.values()) { const dx = c.cx - cx, dz = c.cz - cz; if (dx * dx + dz * dz <= (rd + 0.5) * (rd + 0.5) && c.shownAt >= 0 && c.sec.every(s => s.meshed)) out.push(c.cx + ',' + c.cz); } return out.sort(); };
  }, preset);
  return { build, ctx, page, ev };
}
async function settle(P, maxS) {
  const t0 = Date.now(); let quiet = 0;
  while (Date.now() - t0 < maxS * 1000) {
    await P.ev(() => window.__frame(0.05));
    for (let k = 0; k < 60; k++) { await P.page.waitForTimeout(50); await P.ev(() => window.__tick()); }
    if (await P.ev(() => window.__quiet())) quiet++; else quiet = 0;
    if (quiet >= 3) break;
  }
  return +((Date.now() - t0) / 1000).toFixed(1);
}
const setModel = (P, on, msPerByte) => P.ev(([on, r]) => { window.__sim.on = on; window.__sim.msPerByte = r; window.__sim.pendMs = 0; }, [on, msPerByte]);

// ---- 1. the flight
const results = {}, paths = {};
const BUILDS = [{ label: 'before', url: BEFORE_URL }, { label: 'after', url: AFTER_URL }];
if (!process.env.SKIP_FLIGHT) for (let pi = 0; pi < PRESETS.length; pi++) {
  const preset = PRESETS[pi];
  const order = pi % 2 === 0 ? BUILDS : BUILDS.slice().reverse();   // (the order alternates: the machine's load drifts)
  let k = 0, path = null;
  for (const build of order) {
    const P = await open(build, preset);
    // the path: from the spawn north, a right turn, west, a left turn, north again; 40 blocks over the land
    if (!path) path = await P.ev(([N, dt, v]) => {
      const g = VR.game, w = g.world, p = g.player, gen = VR.makeGen ? VR.makeGen('overworld', w.seed, w.genOpts) : null;
      const ground = (x, z) => { if (!gen || !gen.surfaceY) return 70; let h = 0; for (const [ox, oz] of [[0, 0], [24, 0], [-24, 0], [0, 24], [0, -24]]) h = Math.max(h, gen.surfaceY(Math.floor(x + ox), Math.floor(z + oz))); return h; };
      let x = p.pos[0], z = p.pos[2], yaw = 0, y = ground(x, z) + 40;
      const out = [];
      for (let i = 0; i < N; i++) {
        const t = i * dt, T = N * dt;
        const target = t < T * 0.33 ? 0 : t < T * 0.36 ? -Math.PI / 2 * (t - T * 0.33) / (T * 0.03) : t < T * 0.66 ? -Math.PI / 2 : t < T * 0.69 ? -Math.PI / 2 + Math.PI / 2 * (t - T * 0.66) / (T * 0.03) : 0;
        yaw = target;
        x += -Math.sin(yaw) * v * dt; z += -Math.cos(yaw) * v * dt;
        const yy = ground(x, z) + 40; y += (yy - y) * 0.15;
        out.push([+x.toFixed(2), +y.toFixed(2), +z.toFixed(2), +yaw.toFixed(4), -0.3]);
      }
      return out;
    }, [FLIGHT_FRAMES, DT, SPEED]);
    paths[preset] = path;
    const [x0, y0, z0, yaw0, pitch0] = path[0];
    await P.ev((c) => window.__place(...c), [x0, y0, z0, yaw0, pitch0]);
    // the start settles with the model off in both builds (the settle's ticks are no frames: a stretched rate would make the
    // after build crawl through them); then k (the first build of the preset), then the model on for the flight. The after
    // build calibrates whenever the model switches — in the game the calibration runs as the world starts, at the
    // machine's own rate
    const recal = () => P.ev(() => { const g = VR.game, r = g.renderer, q = g.world.uploadQ; if (!r.calibrateUploads || !q.calibrate) return null; const c = r.calibrateUploads(); q.calibrate(c.ms, c.bytes); return { ms: +c.ms.toFixed(2), mpb: q.msPerByte }; });
    await setModel(P, false, 0); await recal();
    const settleS = await settle(P, 600);
    if (!k) {
      const ms = []; for (let i = 0; i < 9; i++) { const f = await P.ev(() => window.__frame(0.05)); if (i) ms.push(f.ms); }
      k = median(ms) / OWNER_MS[preset];
      console.log(`  ${preset}: the software frame ${median(ms).toFixed(0)} ms ≈ ${k.toFixed(1)} × the owner's ${OWNER_MS[preset]} ms — the model copies ${(MS_PER_MB * k).toFixed(0)} ms per MB here`);
    }
    const rate = MS_PER_MB * k / MB;
    await setModel(P, true, rate);
    const cal = await recal();
    // the flight
    const rec = [];
    for (let i = 0; i < path.length; i++) {
      await P.ev((c) => window.__place(...c), path[i]);
      rec.push(await P.ev((dt) => window.__frame(dt), DT));
    }
    const end = path[path.length - 1];
    const fin = await P.ev(() => { const rs = VR.game.renderer.stats, q = VR.game.world.uploadQ; return { hitchMeter: rs.hitches, mpb: q && q.msPerByte, line: VR.game.upLine ? VR.game.upLine(VR.game.renderer) : null }; });
    // the end: the model off again, settle (streaming ticks), then the picture from the last spot
    await setModel(P, false, 0); await recal();
    const endSettle = await settle(P, 900);
    await P.ev((c) => window.__place(...c), end);
    for (let i = 0; i < 4; i++) await P.ev(() => window.__frame(0.05));
    const shot = `${SHOTS}/stream_end_${preset}_${build.label}.png`;
    await P.page.screenshot({ path: shot, timeout: 900000 });
    const cols = await P.ev(() => window.__cols());
    const ms = rec.map(r => r.ms), med = median(ms);
    const up = rec.map(r => r.sub + r.data + r.tex), copy = rec.map(r => r.copyMs);
    const out = { build: build.label, preset, frames: rec.length, settleS, endSettleS: endSettle, k: +k.toFixed(2), medianMs: +med.toFixed(0), p95Ms: +pct(ms, 0.95).toFixed(0), maxMs: +Math.max(...ms).toFixed(0),
      hitches: ms.filter(m => m > 2 * med).length, stutters: ms.filter(m => m > 1.5 * med).length,
      upMedianKB: +(median(up) / 1024).toFixed(0), upP95KB: +(pct(up, 0.95) / 1024).toFixed(0), upMaxKB: +(Math.max(...up) / 1024).toFixed(0), upTotalMB: +(up.reduce((a, b) => a + b, 0) / MB).toFixed(1),
      copyMedianMs: +median(copy).toFixed(0), copyMaxMs: +Math.max(...copy).toFixed(0), ownerCopyMaxMs: +(Math.max(...copy) / k).toFixed(1), ownerCopyP95Ms: +(pct(copy, 0.95) / k).toFixed(1),
      jsMedianMs: +median(rec.map(r => r.js)).toFixed(0), jsMaxMs: +Math.max(...rec.map(r => r.js)).toFixed(0),
      queueMax: Math.max(...rec.map(r => r.queue)), cols: cols.length, cal, fin, modelRate: rate };
    console.log('FLIGHT ' + JSON.stringify(out));
    const worst = rec.map((r, i) => ({ i, ...r })).sort((a, b) => b.ms - a.ms).slice(0, 4).map(r => ({ i: r.i, ms: +r.ms.toFixed(0), js: +r.js.toFixed(0), copy: +r.copyMs.toFixed(0), subKB: +(r.sub / 1024).toFixed(0), dataKB: +(r.data / 1024).toFixed(0), texKB: +(r.tex / 1024).toFixed(0), q: r.queue }));
    console.log('WORST ' + JSON.stringify(worst));
    results[preset + '_' + build.label] = { out, cols, shot, rec };
    await P.ctx.close();
  }
  const b = results[preset + '_before'], a = results[preset + '_after'];
  console.log(`--- ${preset}: hitches ${b.out.hitches} → ${a.out.hitches}, stutters ${b.out.stutters} → ${a.out.stutters}, copy per frame (owner ms) max ${b.out.ownerCopyMaxMs} → ${a.out.ownerCopyMaxMs}, p95 ${b.out.ownerCopyP95Ms} → ${a.out.ownerCopyP95Ms}`);
  check(a.out.hitches < b.out.hitches || (a.out.hitches === 0 && b.out.hitches === 0 && a.out.stutters < b.out.stutters), preset + ': fewer hitches (frames over 2 × the median) than the build before', `${b.out.hitches} → ${a.out.hitches} (stutters ${b.out.stutters} → ${a.out.stutters})`);
  check(a.out.ownerCopyMaxMs < b.out.ownerCopyMaxMs, preset + ': the worst frame\'s uploads cost less GPU time', `${b.out.ownerCopyMaxMs} → ${a.out.ownerCopyMaxMs} ms on the owner's frame`);
  check(a.out.cal && a.out.fin.mpb >= 0.5 * a.out.modelRate, preset + ': the after build sees the slow upload path (its estimate within reach of the model\'s rate)', a.out.fin.mpb ? `${(a.out.fin.mpb * MB).toFixed(0)} ms/MB measured, model ${(a.out.modelRate * MB).toFixed(0)} ms/MB` : '');
  const miss = b.cols.filter(c => !a.cols.includes(c));
  check(miss.length === 0 && a.cols.length > 0, preset + ': at the end the after build shows every column the build before shows', `${a.cols.length} / ${b.cols.length} columns` + (miss.length ? ', missing ' + miss.slice(0, 8).join(' ') : ''));
  const img = async (f) => (await sharp(f).resize(160, 90, { fit: 'fill' }).removeAlpha().raw().toBuffer());
  const ia = await img(a.shot), ib = await img(b.shot);
  let d = 0; for (let i = 0; i < ia.length; i++) d += Math.abs(ia[i] - ib[i]);
  const mad = d / ia.length;
  check(mad < 8, preset + ': the end pictures alike (no hole, no column missing)', 'mean difference ' + mad.toFixed(2) + ' of 255 (test/shots/stream_end_' + preset + '_{before,after}.png)');
  if (a.out.fin.line) check(/Hochladen .* ms .* KB .* MB\/s .* Ruckler \d+ \(10 s\)/.test(a.out.fin.line), preset + ': the ⚙ line (German) shows the streaming', a.out.fin.line);
}

// ---- 2. the steady cost with no streaming: Very Low side by side (frames in turn), High one after the other
if (!process.env.SKIP_COST) {
  const cost = {};
  const frameMs = async (P, n) => { const ms = []; for (let i = 0; i < n + 2; i++) { const f = await P.ev(() => window.__frame(0.033)); if (i >= 2) ms.push(f.ms); } return ms; };
  {
    const pages = [];
    for (const build of BUILDS) { const P = await open(build, 'potato'); pages.push(P); }
    for (const P of pages) { const s = await settle(P, 420); console.log('  ' + P.build.label + ' Very Low settled in ' + s + ' s'); }
    const ms = pages.map(() => []);
    for (let i = 0; i < 26; i++) for (let j = 0; j < pages.length; j++) { const f = await pages[j].ev(() => window.__frame(0.033)); if (i >= 2) ms[j].push(f.ms); }
    for (let j = 0; j < pages.length; j++) { cost['potato_' + pages[j].build.label] = +median(ms[j]).toFixed(1); await pages[j].page.screenshot({ path: `${SHOTS}/stream_cost_verylow_${pages[j].build.label}.png`, timeout: 900000 }); }
    for (const P of pages) await P.ctx.close();
  }
  for (const build of BUILDS) {
    const P = await open(build, 'high');
    await settle(P, 600);
    cost['high_' + build.label] = +median(await frameMs(P, 12)).toFixed(1);
    await P.page.screenshot({ path: `${SHOTS}/stream_cost_high_${build.label}.png`, timeout: 900000 });
    await P.ctx.close();
  }
  console.log('COST ' + JSON.stringify(cost));
  const dv = cost.potato_after / cost.potato_before - 1, dh = cost.high_after / cost.high_before - 1;
  check(dv <= 0.05, 'Very Low with no streaming: not slower (frames in turn, ±5 %)', `${cost.potato_before} → ${cost.potato_after} ms (${(dv * 100).toFixed(1)} %)`);
  console.log(`  High with no streaming: ${cost.high_before} → ${cost.high_after} ms (${(dh * 100).toFixed(1)} %, one after the other: the machine's load drifts)`);
  results.cost = cost;
}
try { fs.writeFileSync(`${OUT}/stream_hitches.json`, JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v && v.out ? { out: v.out, cols: v.cols.length, rec: v.rec } : v])), null, 1)); } catch (e) { /* ignore */ }
console.log('--- errors (' + errsAll.length + ')'); for (const e of errsAll.slice(0, 12)) console.log(e);
check(errsAll.filter(e => e.startsWith('[pageerror]')).length === 0, 'no page errors');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);
