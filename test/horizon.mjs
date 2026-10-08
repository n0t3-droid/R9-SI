// F8 · Sichtweite, browser test. Fixed world (seed 1, noon, zen freeze, 1280x720), horizon level 3 = 3 km.
//  1. a 20 s flight at 3 km on Very Low: every frame timed; the five slowest frames are logged with what they did (upload
//     bytes and ms, queue, new GPU arenas, world and horizon update/draw ms); no frame above 2x the median among the
//     frames that uploaded meshes
//  2. every 2 s: a normal screenshot, and a probe frame where the sky paints magenta — a magenta pixel below the horizon
//     line is a hole (far tile and chunk both absent); the count must stay near zero
//  3. 3 km vistas on Very Low (potato) and High (high): test/shots/horizon_<preset>_3km.png (looked at, not just saved)
//   bash test/wt_run.sh horizon.mjs 1800      (or nohup in the background and poll the log)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const DIST = process.env.DIST_URL || 'file:///home/claude/vr/dist/index.html';
const SEED = process.env.SEED || '1';
const HZ = +(process.env.HZ || 3);
const PRESETS = (process.env.PRESETS || 'potato,high').split(',');
const FLIGHT_S = +(process.env.FLIGHT_S || 20), DT = +(process.env.DT || 0.2), SPEED = +(process.env.FLIGHT_SPEED || 11);   // 0.2 s of game time per frame (a frame is slow here); 11 blocks a second is the creative flight (player.js: 11, sprint 23)
const EVERY = Math.max(1, Math.round(2 / DT));   // frames between two checks (every 2 s of flight)
const FLY = (process.env.FLIGHT_PRESETS || 'potato').split(',');   // the flight runs on Very Low; High gets the 3 km vista
const SETTLE_S = +(process.env.SETTLE || 300);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
page.on('pageerror', e => errs.push('[pageerror] ' + (e.stack || e.message).slice(0, 800)));
page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 300)); });
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
let fails = 0;
const check = (name, ok, info) => { if (ok) console.log('ok    ' + name + (info ? '  ' + info : '')); else { fails++; console.log('FAIL  ' + name + (info ? '  ' + info : '')); } };
const median = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };

await page.goto(DIST);
for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev((seed) => VR.game.createWorld({ name: 'Horizon', mode: 'creative', difficulty: 'peaceful', type: 'default', seed, cheats: true, kit: false }), SEED);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
// the page's own loop stops; every frame is one g.loop call (timed in the page)
await ev(() => {
  const g = VR.game;
  window.requestAnimationFrame = () => 0;
  g.hideHud = true; const hud = document.getElementById('hud'); if (hud) hud.style.visibility = 'hidden';
  g.env.setTime(6000); g.zenFreezeTime = true; g.player.flying = true;
  // timing wrappers (set once): the world's update and the horizon's update and draw, in ms, for the frame in progress
  window.__t = { wu: 0, hu: 0, hd: 0, rr: 0 };
  {
    const w = g.world, hz = g.horizon;
    const wrap = (o, name, key) => { const f = o[name].bind(o); o[name] = (...a) => { const t0 = performance.now(); const r = f(...a); window.__t[key] += performance.now() - t0; return r; }; };
    wrap(w, 'update', 'wu'); if (hz) { wrap(hz, 'update', 'hu'); wrap(hz, 'draw', 'hd'); }
    wrap(g.renderer, 'render', 'rr');   // the whole render call (sections, sky, horizon, post)
  }
  window.__frame = (dtS, mx, mz) => {
    const gg = VR.game, p = gg.player, w = gg.world;
    const up0 = w.stats.uploaded || 0, ar0 = gg.renderer.arenas.length, me0 = w.stats.mesh || 0;
    window.__t.wu = 0; window.__t.hu = 0; window.__t.hd = 0; window.__t.rr = 0;
    if (mx || mz) p.teleport(p.pos[0] + mx, p.pos[1], p.pos[2] + mz);
    gg.last = performance.now() - dtS * 1000;
    const t = performance.now(); gg.loop(t); const ms = performance.now() - t;
    return { ms, up: (w.stats.uploaded || 0) - up0, upMs: +(w.stats.uploadMs || 0).toFixed(2), q: w.uploadQ ? w.uploadQ.size : -1,
      arenas: gg.renderer.arenas.length - ar0, mesh: (w.stats.mesh || 0) - me0, wu: window.__t.wu, hu: window.__t.hu, hd: window.__t.hd,
      rr: window.__t.rr, rung: w.streamRung || 0 };
  };
  // where the horizon is on screen (row from the top): the sky shader's projection, applied to a far point ahead
  window.__horizonRow = () => {
    const g = VR.game, r = g.renderer, p = g.player, M = r.viewProj, h = r.gl.drawingBufferHeight;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), k = 1e5;
    const qx = fx * k, qz = fz * k;
    const cx = M[0] * qx + M[8] * qz + M[12], cy = M[1] * qx + M[9] * qz + M[13], cw = M[3] * qx + M[11] * qz + M[15];
    const ndcY = cy / cw;
    return { top: (1 - ndcY) / 2 * h, h };
  };
  // a probe frame: the sky paints magenta; count magenta pixels below the horizon line (holes) and above it (calibration)
  window.__probe = () => {
    const g = VR.game, r = g.renderer, gl = r.gl;
    r.skyProbe = true;
    g.last = performance.now() - 100; g.loop(performance.now());
    r.skyProbe = false;
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const buf = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    const hr = window.__horizonRow();
    const hy = Math.round(hr.top);             // row from the top
    let below = 0, above = 0, belowN = 0, aboveN = 0;
    for (let row = 0; row < h; row++) {       // GL rows run bottom-up
      const yTop = h - 1 - row;
      const isBelow = yTop > hy + 6, isAbove = yTop < hy - 6;
      if (!isBelow && !isAbove) continue;
      for (let x = 0; x < w; x += 2) {
        const o = (row * w + x) * 4, rr = buf[o], gg = buf[o + 1], bb = buf[o + 2];
        const mag = rr > 150 && gg < 100 && bb > 150;
        if (isBelow) { belowN++; if (mag) below++; } else { aboveN++; if (mag) above++; }
      }
    }
    return { below, belowN, above, aboveN, horizonTop: hy, h, w };
  };
  // where a hole can come from: the camera's section, the meshed sections in reach, and how many of them the renderer lists
  // for this frame (the far mask cuts only the listed ones); the far mask's cut cells
  window.__diag = () => {
    const g = VR.game, w = g.world, r = g.renderer, p = g.player;
    const scx = Math.floor(p.pos[0]) >> 4, scy = Math.floor(p.pos[1]) >> 4, scz = Math.floor(p.pos[2]) >> 4;
    const st = w.sectionAt(scx, scy, scz);
    const listed = new Set(r.visList), rd2 = (w.renderDist + 0.5) * (w.renderDist + 0.5);
    let inReach = 0, meshedIn = 0, listedIn = 0;
    for (const c of w.cols.values()) {
      const dx = c.cx - scx, dz = c.cz - scz;
      if (dx * dx + dz * dz > rd2) continue;
      inReach++;
      for (const s of c.sec) if (s.hasMesh) { meshedIn++; if (listed.has(s)) listedIn++; }
    }
    const hz = g.horizon;
    return { pos: [+p.pos[0].toFixed(1), +p.pos[1].toFixed(1), +p.pos[2].toFixed(1)],
      start: st ? { count: st.count, vis: st.vis, meshed: !!st.meshed, hasMesh: !!st.hasMesh } : null,
      columnsInReach: inReach, meshedSections: meshedIn, listedSections: listedIn, listLength: r.visList.length,
      shownColumns: [...w.cols.values()].filter(c => c.shownAt >= 0).length, fading: w.fading ? w.fading.size : -1,
      maskCells: hz && hz.mask ? hz.mask.reduce((a, v) => a + (v > 0 ? 1 : 0), 0) : -1 };
  };
});
const settle = async (maxS) => {
  const t0 = Date.now(); let quiet = 0;
  while (Date.now() - t0 < maxS * 1000) {
    await ev(() => { const g = VR.game; for (let i = 0; i < 4; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } });
    const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: (g.world.lastWant || 0) + (g.horizon ? (g.horizon.stats.want || 0) : 0), fading: g.world.fading ? g.world.fading.size : 0, q: g.world.uploadQ ? g.world.uploadQ.size : 0 }; });
    if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && !s.fading && !s.q) quiet++; else quiet = 0;
    if (quiet >= 5) break;
    await wait(60);
  }
  return +((Date.now() - t0) / 1000).toFixed(1);
};
const shot = async (path) => { await ev(() => { const g = VR.game; g.last = performance.now() - 100; g.loop(performance.now()); }); await wait(120); await page.screenshot({ path, timeout: 900000 }); };   // a frame behind a long GPU queue can take minutes here
const SHOTS = '/home/claude/vr/test/shots';

for (const preset of PRESETS) {
  await ev(([p, hz]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.minimap = false; g.settings.horizon = hz; g.applySettings('*'); g.env.setTime(6000); }, [preset, HZ]);
  await wait(200);
  const sec = await settle(SETTLE_S);
  const st = await ev(() => { const g = VR.game, h = g.horizon; return { radius: h.radius, tiles: h.tiles.size, enabled: h.enabled(), cols: g.world.cols.size, rd: g.world.renderDist }; });
  console.log(`--- ${preset} · horizon ${HZ} (${st.radius} blocks) · settled in ${sec} s · ${st.tiles} tiles · ${st.cols} columns · renderDist ${st.rd}`);
  check(preset + ': the 3 km horizon is on', st.enabled && st.radius >= 3072 && HZ >= 3, JSON.stringify(st));

  if (FLY.includes(preset)) {
  // ---- 1 + 2: the flight, a probe and a screenshot every 2 s
  await ev(() => { const p = VR.game.player; p.yaw = 0.6; p.pitch = -0.03; p.flying = true; p.teleport(p.pos[0], p.pos[1] + 30, p.pos[2]); });
  await settle(90);
  const frames = [], uploadFrames = [], probes = [];
  const flightFrames = Math.round(FLIGHT_S / DT);
  const mx = Math.sin(0.6) * -SPEED * DT, mz = Math.cos(0.6) * -SPEED * DT;   // flight along the view (flat)
  const rec = [];
  for (let k = 0; k < flightFrames; k++) {
    const r = await ev(([d, x, z]) => window.__frame(d, x, z), [DT, mx, mz]);
    rec.push({ k, ...r });
    frames.push(r.ms); if (r.up > 0) uploadFrames.push(r.ms);
    if (k % EVERY === EVERY - 1) {                // every 2 s of flight
      const pr = await ev(() => window.__probe());
      const dg = await ev(() => window.__diag());
      const tt = +((k + 1) * DT).toFixed(1);
      probes.push({ t: tt, below: pr.below, belowN: pr.belowN, above: pr.above, aboveN: pr.aboveN, horizonTop: pr.horizonTop });
      console.log('DIAG ' + JSON.stringify({ t: tt, below: pr.below, ...dg }));
      if (preset === 'potato') await shot(`${SHOTS}/horizon_flight_${((k + 1) * DT).toFixed(1).replace('.', '_')}s.png`);
    }
  }
  const med = median(frames), medUp = median(uploadFrames);
  const worst5 = rec.slice().sort((a, b) => b.ms - a.ms).slice(0, 5).map(r => ({ k: r.k, ms: +r.ms.toFixed(1), up: r.up, upMs: r.upMs, q: r.q, arenas: r.arenas, mesh: r.mesh, wu: +r.wu.toFixed(1), hu: +r.hu.toFixed(1), hd: +r.hd.toFixed(1), rr: +r.rr.toFixed(1), rung: r.rung }));
  console.log('WORST ' + JSON.stringify(worst5));
  const noUp = rec.filter(r => !(r.up > 0)), withUp = rec.filter(r => r.up > 0);
  console.log('SPLIT ' + JSON.stringify({ medianNoUploadMs: +median(noUp.map(r => r.ms)).toFixed(1), medianUploadMs: +median(withUp.map(r => r.ms)).toFixed(1), uploadMsMedian: +median(withUp.map(r => r.upMs)).toFixed(2), uploadMsMax: +Math.max(0, ...withUp.map(r => r.upMs)).toFixed(2), uploadFramesN: withUp.length, newArenas: rec.reduce((a, r) => a + r.arenas, 0), meshesTotal: rec.reduce((a, r) => a + r.mesh, 0), hzUpdateMedian: +median(rec.map(r => r.hu)).toFixed(2), hzDrawMedian: +median(rec.map(r => r.hd)).toFixed(2), worldUpdateMedian: +median(rec.map(r => r.wu)).toFixed(2), renderMedianNoUpload: +median(noUp.map(r => r.rr)).toFixed(1), renderMedianUpload: +median(withUp.map(r => r.rr)).toFixed(1), worldUpdateMedianUpload: +median(withUp.map(r => r.wu)).toFixed(2), rungMax: Math.max(0, ...rec.map(r => r.rung)) }));
  const worst = frames.reduce((a, b) => (b > a ? b : a), 0);
  const over = uploadFrames.filter(ms => ms > 2 * med).length;
  console.log('FLIGHT ' + JSON.stringify({ preset, frames: frames.length, medianMs: +med.toFixed(1), uploadMedianMs: +medUp.toFixed(1), worstMs: +worst.toFixed(1), uploadFrames: uploadFrames.length, overTwiceMedianWithUploads: over, uploadMsNow: await ev(() => +(VR.game.world.stats.uploadMs || 0).toFixed(2)), queue: await ev(() => VR.game.world.uploadQ ? VR.game.world.uploadQ.size : -1) }));
  check(preset + ': no frame above 2x the median from streaming', over === 0, `${over} of ${uploadFrames.length} upload frames over ${(2 * med).toFixed(0)} ms`);
  const holes = probes.reduce((a, p) => Math.max(a, p.below), 0);
  console.log('PROBE ' + JSON.stringify(probes));
  check(preset + ': no hole below the horizon (magenta sky pixels) in ' + probes.length + ' checks', holes <= 200, 'max ' + holes + ' px');
  const cal = probes.reduce((a, p) => a + p.above / Math.max(1, p.aboveN), 0) / Math.max(1, probes.length);
  check(preset + ': the probe paints the sky (calibration above the horizon)', cal > 0.5, 'magenta share above ' + cal.toFixed(2));
  }

  // ---- 3: the 3 km vista, looked at afterwards
  await ev(() => { const p = VR.game.player; p.yaw = 2.2; p.pitch = -0.02; p.teleport(p.pos[0], p.pos[1] + 12, p.pos[2]); });
  await settle(120);
  await shot(`${SHOTS}/horizon_${preset === 'potato' ? 'very_low' : preset}_3km.png`);
  console.log('VISTA ' + preset + ' → test/shots/horizon_' + (preset === 'potato' ? 'very_low' : preset) + '_3km.png');
}
console.log('--- errors (' + errs.length + ')'); for (const e of errs.slice(0, 12)) console.log(e);
check('no page errors', errs.filter(e => e.startsWith('[pageerror]')).length === 0, errs.length + ' logged');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close();
