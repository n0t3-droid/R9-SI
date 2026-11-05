// f-dusk2 · the Flausellichter polished, in the browser — before (v042, built into .tmp_tests/before_src/dist when
// there) and after, in one browser, German (de-DE), the same creative flat meadow as test/dusk.mjs (flowers, a pond, a
// row of trees: a forest edge):
//   1 dusk: two swarms 18 m apart lured to one flower between them — before they drift into one patch, after they keep
//     ≥ 18 m apart and keep their hue (amber/rose/mint/violet, not pale blue-white): dusk2_meadow_{before,after}
//   2 you stand still at dusk: the ring (third person) — after: two rings at different heights, breathing; the chime once:
//     dusk2_ring_{before,after}, dusk2_ring2_after (16 s later: the rings turned, breathed)
//   3 night at the forest edge: two swarms placed 8 m apart — after they move apart, no milky patch: dusk2_edge_*
//   4 cost: dusk.frame and drawMotes on High (before | after); Very Low: no swarm, nothing handed to the renderer
//   5 no page errors. The sheet test/shots/dusk2_sheet.jpg (German captions).
// Every run ends with ALL OK / FAILED n.
//   nohup bash test/wt_run.sh dusk2.mjs 3600 > .tmp_tests/dusk2.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'test/shots');
const BEFORE = path.join(ROOT, '.tmp_tests/before_src/dist');
const PORT = 8765 + Math.floor(Math.random() * 200);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', path.join(ROOT, 'dist')], { stdio: 'ignore' });
const srvB = fs.existsSync(path.join(BEFORE, 'index.html')) ? spawn('python3', ['-m', 'http.server', String(PORT + 300), '--bind', '127.0.0.1', '--directory', BEFORE], { stdio: 'ignore' }) : null;
await new Promise(r => setTimeout(r, 900));
let browser = null, page = null;
let logs = [];
const ev = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => page.waitForTimeout(ms);
const safe = async (fn, a) => { try { return await ev(fn, a); } catch (e) { return null; } };
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const step = async (n, dtms = 33) => {
  for (let k = 0; k < n; k += 20) {
    await ev(([m, d]) => {
      const g = VR.game;
      if (!window.__noraf) { window.__noraf = true; window.requestAnimationFrame = () => 0; }
      if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
      window.__norender = true;
      for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); }
    }, [Math.min(20, n - k), dtms]);
  }
};
// a time of day by the sun's height: the dusk (after noon, the sun at y ≈ 0.04) or the darkest night
const timeFor = (what) => ev((what) => {
  const g = VR.game; let best = 6000, bs = 1e9;
  window.__norender = true;
  for (let t = what === 'dusk' ? 10000 : 0; t < (what === 'dusk' ? 14000 : 24000); t += what === 'dusk' ? 100 : 500) {
    g.env.setTime(t); g.last = performance.now() - 16; g.loop(performance.now());
    const E = g.env.E, sc = what === 'dusk' ? Math.abs(E.sunDir[1] - 0.04) : what === 'day' ? -E.sunDir[1] + E.night * 10 : -E.night - (E.sunDir[1] < 0 ? -E.sunDir[1] : 0);
    if (sc < bs) { bs = sc; best = t; }
  }
  g.env.setTime(best); return best;
}, what);
const shot = async (name, tod) => {
  const hide = (on) => ev((on) => {
    for (const el of document.querySelectorAll('#hud > *')) el.style.visibility = on ? 'hidden' : '';
    for (const id of ['lockhint', 'hint', 'hints', 'toasts', 'quiet']) { const el = document.getElementById(id); if (el) el.style.visibility = on ? 'hidden' : ''; }
  }, on);
  await hide(true);
  await ev((tod) => { window.__norender = false; const g = VR.game; if (tod !== undefined) g.env.setTime(tod); for (let i = 0; i < 2; i++) { g.last = performance.now() - 16; g.loop(performance.now()); } window.__norender = true; }, tod);
  await wait(250);
  const f = path.join(SHOTS, name + '.png');
  await page.screenshot({ path: f, timeout: 120000 });
  await hide(false);
  console.log('shot ' + name);
  return f;
};
const untilTitle = async (maxS = 150) => { for (let i = 0; i < maxS * 2; i++) { await wait(500); if (await safe(() => !!(window.VR && VR.game && VR.game.state === 'title'))) return true; } return false; };
const untilPlay = async (maxS = 150) => { for (let i = 0; i < maxS * 2; i++) { await wait(500); if (await safe(() => !!(VR.game && VR.game.state === 'play' && VR.game.companions && VR.game.player))) return true; } return false; };
const lookAt = (x, y, z) => ev(([x, y, z]) => { const p = VR.game.player, e = p.eyePos(), dx = x - e[0], dy = y - e[1], dz = z - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }, [x, y, z]);
const at = (x, z) => ev(([x, z]) => { const g = VR.game, p = g.player; p.pos[0] = x; p.pos[2] = z; p.pos[1] = g.world.topAt(Math.floor(x), Math.floor(z)) + 1; p.vel[0] = p.vel[1] = p.vel[2] = 0; }, [x, z]);
// a swarm placed for the picture (the real swarm, its rules and its draw — only where it starts is chosen)
const place = (x, z, n, attract) => ev(([x, z, n, attract]) => {
  const D = VR.Dusk, g = VR.game, y = g.world.topAt(Math.floor(x), Math.floor(z)) + 1, sd = Math.floor(x * 31 + z * 17), sw = D.swarm(sd, [x, y, z], n, D.pickHue ? D.pickHue(D.state.sw, sd) : undefined);   // (as the game makes them: f-dusk2 picks a free hue)
  sw.attract = attract || []; sw.fade = 1; D.state.sw.push(sw); return D.state.sw.length;
}, [x, z, n, attract]);

const cdist = () => ev(() => { const s = VR.Dusk.state.sw; return s.length >= 2 ? Math.hypot(s[0].cx - s[1].cx, s[0].cz - s[1].cz) : -1; });
async function scene(tag, port) {
  console.log('=== ' + tag);
  const out = {}, after = tag === 'after';
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  page = await ctx.newPage(); logs = [];
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 600)));
  page.on('dialog', d => d.accept('x'));
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  check(await untilTitle(), tag + ': the title screen opens');
  await ev(() => { const g = VR.game; g.settings.renderDist = 5; g.settings.dynRes = false; g.applySettings('renderDist'); });
  await ev(() => { VR.game.createWorld({ name: 'Abendwiese', mode: 'creative', difficulty: 'peaceful', type: 'flat', seed: '11', cheats: true, kit: true }); });
  check(await untilPlay(), tag + ': the flat world opens');
  await step(40);
  const P0 = await ev(() => {
    const g = VR.game, p = g.player, w = g.world, R = VR.R, S = (n) => (R.byName[n] ? R.S(n) : 0);
    g.settings.preset = 'balanced'; g.env.rain = 0; g.env.rainTarget = 0; g.entities.trySpawn = () => {}; p.flying = false;
    if (g.env.wx) { g.env.wx.forced = 'klar'; }
    const x0 = Math.floor(p.pos[0]), z0 = Math.floor(p.pos[2]), y0 = w.topAt(x0, z0), gr = S('short_grass') || S('grass');
    const FL = ['dandelion', 'poppy', 'cornflower', 'oxeye_daisy', 'pink_tulip', 'white_tulip'].map(S).filter(Boolean);
    const H = (dx, dz, k) => (Math.imul((dx + 99) * 73856093 ^ (dz + 99) * 19349663 ^ k * 83492791, 2654435761) >>> 0) % 1000;
    for (let dz = -34; dz <= 6; dz++) for (let dx = -16; dx <= 16; dx++) {
      const x = x0 + dx, z = z0 + dz;
      if (dx >= 5 && dx <= 10 && dz >= -15 && dz <= -10) { w.setBlock(x, y0, z, S('water'), 4); continue; }
      const h = H(dx, dz, 1);
      if (dz <= -26) continue;
      if (h < 70 && FL.length) w.setBlock(x, y0 + 1, z, FL[h % FL.length], 4); else if (h < 160 && gr) w.setBlock(x, y0 + 1, z, gr, 4);
    }
    for (let dx = -16; dx <= 16; dx += 4) {
      const x = x0 + dx + (H(dx, 0, 2) % 2), z = z0 - 28 - (H(dx, 0, 3) % 3), th = 4 + (H(dx, 0, 4) % 2);
      for (let y = 1; y <= th; y++) w.setBlock(x, y0 + y, z, S('oak_log'), 4);
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let c = 0; c <= 2; c++) { if (a * a + b * b + (c - 1) * (c - 1) * 2 > 6) continue; if (!w.getBlock(x + a, y0 + th + c, z + b)) w.setBlock(x + a, y0 + th + c, z + b, S('oak_leaves'), 4); }
    }
    return [x0, y0, z0];
  });
  const [x0, y0, z0] = P0;
  await step(30);

  // ---- 1 · dusk: two swarms 18 m apart, one flower between them
  const DUSK = await timeFor('dusk');
  await at(x0 + 0.5, z0 + 4); await lookAt(x0 + 0.5, y0 + 1.6, z0 - 14);
  await step(60);
  await ev(() => { VR.Dusk.state.sw.length = 0; VR.Dusk.state.findT = 1e9; });
  const mid = [[x0 + 0.5, y0 + 1, z0 - 13]];
  await place(x0 - 8.5, z0 - 12, 40, mid); await place(x0 + 9.5, z0 - 14, 40, mid);
  let dmin = 1e9;
  for (let k = 0; k < 12; k++) { await step(30); const d = await cdist(); if (k >= 1 && d >= 0) dmin = Math.min(dmin, d); }
  console.log(`   meadow: closest centres ${dmin.toFixed(1)} m`);
  out.dmin = dmin;
  if (after) check(dmin >= 17.5, `after: two swarms lured to one flower keep apart (closest ${dmin.toFixed(1)} m)`);
  out.dusk = await shot('dusk2_meadow_' + tag, DUSK);

  // ---- 2 · the ring at dusk (third person)
  await ev(() => { VR.Dusk.state.sw.length = 0; VR.Dusk.state.mem.night = null; VR.Dusk.state.rings = 0; });
  await at(x0 - 1.5, z0 - 7); await step(5);
  await place(x0 - 1.5 + 3, z0 - 7 - 2, 40, []);
  await ev(() => { VR.game.camMode = 1; });
  await lookAt(x0 - 1.5, y0 + 0.4, z0 - 11.5); await ev(() => { VR.game.player.pitch = -0.42; });
  await step(330);
  const r = await ev(() => { const D = VR.Dusk, sw = D.state.sw[0], p = VR.game.player.pos, q = D.ring(sw, p[0], p[1], p[2], {}); return { share: q.share, sec: q.sectors, ok: q.ok, rings: D.state.rings || 0, glow: +(D.state.glow || 0).toFixed(2) }; });
  console.log('   ring: ' + JSON.stringify(r));
  if (after) check(r.ok && r.rings === 1, `after: standing still at dusk a ring closes round you and chimes once (${Math.round(r.share * 100)} %, ${r.sec}/8, chimes ${r.rings})`);
  out.ring = await shot('dusk2_ring_' + tag, DUSK);
  if (after) {
    const rr = await ev(() => {
      const D = VR.Dusk, sw = D.state.sw[0], p = VR.game.player.pos, g = VR.game; let hl = 0, hh = 0, rmin = 1e9, rmax = 0, okN = 0;
      window.__norender = true;
      for (let f = 0; f < 480; f++) {
        g.last = performance.now() - 33; g.loop(performance.now());
        if (f % 30) continue;
        let rs = 0, yl = 0, yh = 0; for (let i = 0; i < sw.n; i++) { rs += Math.hypot(sw.p[i * 3] - p[0], sw.p[i * 3 + 2] - p[2]); if (i & 1) yh += sw.p[i * 3 + 1]; else yl += sw.p[i * 3 + 1]; }
        rs /= sw.n; rmin = Math.min(rmin, rs); rmax = Math.max(rmax, rs); hl += yl; hh += yh; if (D.ring(sw, p[0], p[1], p[2], {}).ok) okN++;
      }
      return { dh: (hh - hl) / (sw.n / 2) / 16, breathe: rmax - rmin, okN, rings: D.state.rings };
    });
    console.log('   ring over 16 s: ' + JSON.stringify(rr));
    check(rr.dh >= 0.5 && rr.breathe >= 0.25 && rr.okN >= 13 && rr.rings === 1, `after: two rings ${rr.dh.toFixed(2)} m apart in height, breathing ${rr.breathe.toFixed(2)} m, a ring all along (${rr.okN}/16), no second chime`);
    out.ring2 = await shot('dusk2_ring2_after', DUSK);
  }
  await ev(() => { VR.game.camMode = 0; VR.Dusk.state.sw.length = 0; });

  // ---- 3 · night at the forest edge: two swarms placed 8 m apart
  const NIGHT = await timeFor('night');
  await at(x0 + 0.5, z0 - 10); await lookAt(x0 + 0.5, y0 + 2.4, z0 - 28);
  await place(x0 - 2, z0 - 22, 40, [[x0 - 5, y0 + 1, z0 - 20]]); await place(x0 + 6, z0 - 24, 40, [[x0 + 8, y0 + 1, z0 - 15]]);
  await step(300);
  out.edgeD = await cdist(); console.log(`   edge: centres ${out.edgeD.toFixed(1)} m apart`);
  if (after) check(out.edgeD >= 17, `after: two swarms placed 8 m apart moved apart (${out.edgeD.toFixed(1)} m)`);
  out.night = await shot('dusk2_edge_' + tag, NIGHT);

  // ---- 4 · cost (High) and Very Low
  const cost = await ev(() => {
    const g = VR.game, D = VR.Dusk, r = g.renderer, f0 = D.frame, d0 = r.drawMotes; let tf = 0, td = 0, nd = 0;
    g.settings.preset = 'high'; D.state.tierT = 0;
    D.frame = function (...a) { const t = performance.now(); f0.apply(this, a); tf += performance.now() - t; };
    r.drawMotes = function (...a) { const t = performance.now(); d0.apply(this, a); td += performance.now() - t; nd++; };
    window.__norender = false;
    for (let i = 0; i < 60; i++) { g.last = performance.now() - 33; g.loop(performance.now()); }
    tf = 0; td = 0; nd = 0;
    for (let i = 0; i < 120; i++) { g.last = performance.now() - 33; g.loop(performance.now()); }
    const n = D.state.sw.reduce((a, s) => a + s.n, 0);
    window.__norender = true; D.frame = f0; r.drawMotes = d0;
    return { frame: tf / 120, draw: nd ? td / nd : 0, draws: nd, motes: n, tier: D.state.tier };
  });
  console.log(`   ${tag} High: dusk.frame ${cost.frame.toFixed(3)} ms, drawMotes ${cost.draw.toFixed(3)} ms (${cost.draws}/120 drawn), ${cost.motes} motes, tier ${cost.tier}`);
  out.cost = cost;
  const vl = await ev(() => {
    const g = VR.game, D = VR.Dusk, r = g.renderer; g.settings.preset = 'potato'; D.state.tierT = 0; let tf = 0; const f0 = D.frame;
    let drawn = 0; const d0 = r.drawMotes; r.drawMotes = function (...a) { drawn++; return d0.apply(this, a); };
    D.frame = function (...a) { const t = performance.now(); f0.apply(this, a); tf += performance.now() - t; };
    let passed = 0;
    for (let i = 0; i < 150; i++) { g.last = performance.now() - 33; g.loop(performance.now()); if (VR.Dusk.out.count) passed++; }
    D.frame = f0; r.drawMotes = d0;
    return { sw: D.state.sw.length, count: D.out.count, passed, drawn, tier: D.state.tier, ms: tf / 150 };
  });
  console.log(`   ${tag} Very Low: ` + JSON.stringify(vl));
  if (after) check(vl.tier === 0 && vl.sw === 0 && vl.count === 0 && vl.passed === 0 && vl.drawn === 0, `Very Low: no swarm, nothing handed to the renderer in 150 frames (dusk.frame ${vl.ms.toFixed(4)} ms)`);
  out.vl = vl;
  for (const l of logs.slice(0, 6)) console.log(l);
  if (after) check(!logs.some(l => /pageerror\]/.test(l)), 'after: no page errors');
  await ctx.close();
  return out;
}

try {
  browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const B = srvB ? await scene('before', PORT + 300) : null;
  const A = await scene('after', PORT);
  try {
    // the lights cropped 2× (the middle of the picture: the swarms and the ring)
    const CROP = { dusk: [240, 200, 800, 450], ring: [340, 200, 600, 338], night: [240, 120, 800, 450] };
    for (const O of [B, A]) if (O) for (const k in CROP) { const [x, y, w, h] = CROP[k], f = O[k].replace('.png', '_crop.png'); execFileSync('python3', ['-c', `from PIL import Image; Image.open('${O[k]}').crop((${x},${y},${x + w},${y + h})).resize((1240,${Math.round(1240 * h / w)}), Image.LANCZOS).save('${f}')`]); O[k + 'C'] = f; }
    const two = (k) => (B ? [B[k], A[k]] : [A[k]]);
    const spec = { w: 620, rows: [
      { label: 'Abenddämmerung · links vorher, rechts nachher: zwei Schwärme, eine Blume dazwischen — nachher bleiben sie getrennt und farbig', imgs: two('dusk') },
      { label: 'Ausschnitt 2× · vorher blassblau-weiß, nachher Bernstein, Rosa, Minze, Violett', imgs: two('duskC') },
      { label: 'Stillstehen in der Dämmerung: der Ring · vorher | nachher (zwei Ringe, verschiedene Höhen)', imgs: two('ringC') },
      { label: 'Derselbe Ring 16 s später: er atmet, dreht sich, kehrt langsam um', imgs: [A.ringC, A.ring2] },
      { label: 'Nachts am Waldrand · vorher | nachher (kein milchiger Fleck: Schwärme ≥ 18 m auseinander)', imgs: two('night') },
    ] };
    fs.writeFileSync(path.join(SHOTS, 'dusk2_sheet.json'), JSON.stringify(spec));
    execFileSync('python3', ['/root/r9coord/pairs.py', path.join(SHOTS, 'dusk2_sheet.jpg'), path.join(SHOTS, 'dusk2_sheet.json')]);
    console.log('sheet test/shots/dusk2_sheet.jpg');
  } catch (e) { console.log('(no sheet: ' + e.message.slice(0, 160) + ')'); }
} catch (e) {
  fails++;
  console.log('  ✗ the test stopped: ' + (e.stack || e.message).slice(0, 900));
  for (const l of logs.slice(0, 8)) console.log(l);
}
try { if (browser) await browser.close(); } catch (e) { /* closed */ }
srv.kill(); if (srvB) srvB.kill();
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
