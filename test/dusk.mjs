// v-dusk · the Flausellichter and the last animal nits in the browser — before (v042, built into
// .tmp_tests/before_src/dist when there) and after, in one browser, German (de-DE), a creative flat meadow with flowers,
// a pond and a row of trees (a forest edge):
//   1 the animals by day: the fawn and the fox kit up close, the fox, the kittens on the grass from 8 m (before | after)
//   2 dusk: swarms find the meadow by themselves (≥ 1 within 6 s, on grass); the meadow at dusk (before | after)
//   3 you stand still: a ring closes round you (third person), the chime once — standing on, no second chime
//   4 you walk through a swarm: they part (the nearest mote ≥ 1 m on average)
//   5 night: the forest edge (before | after)
//   6 cost: dusk.js's frame and the draw's submit on High (ms a frame); Very Low: no swarm, nothing handed to the renderer
//   7 no page errors. The sheet test/shots/dusk_sheet.jpg (German captions).
// Every run ends with ALL OK / FAILED n.
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
  const D = VR.Dusk, g = VR.game, y = g.world.topAt(Math.floor(x), Math.floor(z)) + 1, sw = D.swarm(Math.floor(x * 31 + z * 17), [x, y, z], n);
  sw.attract = attract || []; sw.fade = 1; D.state.sw.push(sw); return D.state.sw.length;
}, [x, z, n, attract]);

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
  // the meadow: flowers and grass tufts, a pond to the right, a row of trees behind (the forest edge)
  const P0 = await ev(() => {
    const g = VR.game, p = g.player, w = g.world, R = VR.R, S = (n) => (R.byName[n] ? R.S(n) : 0);
    g.settings.preset = 'balanced'; g.env.rain = 0; g.env.rainTarget = 0; g.entities.trySpawn = () => {}; p.flying = false;
    if (g.env.wx) { g.env.wx.forced = 'klar'; }
    const x0 = Math.floor(p.pos[0]), z0 = Math.floor(p.pos[2]), y0 = w.topAt(x0, z0), gr = S('short_grass') || S('grass');
    const FL = ['dandelion', 'poppy', 'cornflower', 'oxeye_daisy', 'pink_tulip', 'white_tulip'].map(S).filter(Boolean);
    const H = (dx, dz, k) => (Math.imul((dx + 99) * 73856093 ^ (dz + 99) * 19349663 ^ k * 83492791, 2654435761) >>> 0) % 1000;
    for (let dz = -34; dz <= 6; dz++) for (let dx = -16; dx <= 16; dx++) {
      const x = x0 + dx, z = z0 + dz;
      if (dx >= 5 && dx <= 10 && dz >= -15 && dz <= -10) { w.setBlock(x, y0, z, S('water'), 4); continue; }   // the pond
      const h = H(dx, dz, 1);
      if (dz <= -26) continue;
      if (h < 70 && FL.length) w.setBlock(x, y0 + 1, z, FL[h % FL.length], 4); else if (h < 160 && gr) w.setBlock(x, y0 + 1, z, gr, 4);
    }
    // the trees: trunks every 4 blocks along z0-28, round crowns
    for (let dx = -16; dx <= 16; dx += 4) {
      const x = x0 + dx + (H(dx, 0, 2) % 2), z = z0 - 28 - (H(dx, 0, 3) % 3), th = 4 + (H(dx, 0, 4) % 2);
      for (let y = 1; y <= th; y++) w.setBlock(x, y0 + y, z, S('oak_log'), 4);
      for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) for (let c = 0; c <= 2; c++) { if (a * a + b * b + (c - 1) * (c - 1) * 2 > 6) continue; if (!w.getBlock(x + a, y0 + th + c, z + b)) w.setBlock(x + a, y0 + th + c, z + b, S('oak_leaves'), 4); }
    }
    return [x0, y0, z0];
  });
  const [x0, y0, z0] = P0;
  await step(30);

  // ---- 1 · the animals by day
  const DAY = await timeFor('day');
  await step(10);
  const row = await ev(([x0, y0, z0]) => {
    const g = VR.game, E = g.entities, H = g.companions.heart, gl = g.renderer.gl, ids = [];
    g.settings.wildHeart = true; H.update(1.1);
    const put = (k, baby, x, z, yaw) => {
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) g.world.setBlock(Math.floor(x) + a, y0 + 1, Math.floor(z) + b, 0, 4);   // (the grass round it cleared: legs and chest show)
      const m = E.summon(k, x, y0 + 1, z); if (!m) return;
      const h = m.wh || H.attach(m); if (!h) return;
      h.baby = baby; m.wscale = baby ? 0.62 : 1; h.mode = 'stay'; h.thinkT = 1e9; h.blinkT = 1e9; h.bl = 0;
      const key = VR.WildHeart.vkey(k, 1, baby); VR.getVoxModel(gl, key); m.vkey = key; H.built.add(key);
      m.yaw = yaw; m.ai = m.ai || {}; ids.push(m.id);
    };
    // up close: fawn and fox kit; the fox; three kittens in the grass further on
    // (models face -z: yaw π looks toward +z, where the camera stands — three-quarter views)
    put('glimmer_deer', true, x0 - 0.55, z0 - 4, Math.PI - 0.55); put('glimmer_fox', true, x0 + 0.75, z0 - 4, Math.PI + 0.55);
    put('glimmer_fox', false, x0 - 8, z0 - 4, Math.PI - 0.6);
    put('moss_cat', true, x0 + 13, z0 - 8, Math.PI / 2 + 0.4); put('moss_cat', true, x0 + 14.6, z0 - 8.6, Math.PI - 0.5); put('moss_cat', false, x0 + 16, z0 - 7.6, Math.PI / 2 + 0.6);
    window.__row = ids; return ids.length;
  }, P0);
  check(row === 6, tag + ': six animals placed (' + row + ')');
  await step(4);
  await at(x0 + 0.1, z0 - 2.1); await lookAt(x0 + 0.1, y0 + 1.3, z0 - 4); await step(2);
  out.close = await shot('dusk_close_' + tag, DAY);
  await at(x0 - 8.2, z0 - 1.9); await lookAt(x0 - 8, y0 + 1.5, z0 - 4); await step(2);
  out.fox = await shot('dusk_fox_' + tag, DAY);
  await at(x0 + 14.5, z0); await lookAt(x0 + 14.5, y0 + 1.2, z0 - 8); await step(2);
  out.kit8 = await shot('dusk_kitten8m_' + tag, DAY);
  await ev(() => { const ms = VR.game.entities.mobs; for (const m of ms) m.pos[0] += 80; });

  // ---- 2 · dusk: the swarms find the meadow by themselves
  const DUSK = await timeFor('dusk');
  await at(x0 + 0.5, z0 + 2.5); await lookAt(x0 + 0.5, y0 + 1.3, z0 - 14);
  await step(180);
  if (after) {
    const found = await ev(() => { const D = VR.Dusk, g = VR.game, R = VR.R, gt = R.T.type[R.S('grass_block')]; return { n: D.state.sw.length, tier: D.state.tier, glow: +(D.state.glow || 0).toFixed(2), onGrass: D.state.sw.every(s => R.T.type[g.world.getBlock(Math.floor(s.home[0]), Math.floor(s.home[1]) - 1, Math.floor(s.home[2]))] === gt), att: D.state.sw.map(s => s.attract.length) }; });
    console.log('   swarms found: ' + JSON.stringify(found));
    check(found.n >= 1 && found.onGrass, `after: swarms find the meadow at dusk by themselves (${found.n}, on grass, flowers/water near: ${found.att.join(' ')})`);
    // for the picture: two swarms in front of you (where they start chosen; their flight their own)
    await ev(() => { VR.Dusk.state.sw.length = 0; });
    await place(x0 - 3.5, z0 - 8, 40, [[x0 - 6.5, y0 + 1, z0 - 12], [x0 + 1.5, y0 + 1, z0 - 6]]);
    await place(x0 + 5, z0 - 13, 40, [[x0 + 7.5, y0 + 0.8, z0 - 12.5]]);
    await step(200);
  }
  out.dusk = await shot('dusk_meadow_' + tag, DUSK);

  // ---- 3 · the ring (after only): you stand still beside a swarm
  if (after) {
    await ev(() => { VR.Dusk.state.sw.length = 0; VR.Dusk.state.mem.night = null; VR.Dusk.state.rings = 0; });
    const NIGHT0 = await timeFor('night');
    await at(x0 - 1.5, z0 - 7); await step(5);
    await place(x0 - 1.5 + 3, z0 - 7 - 2, 40, []);
    await ev(() => { VR.game.camMode = 1; });
    await lookAt(x0 - 1.5, y0 + 0.4, z0 - 11.5); await ev(() => { VR.game.player.pitch = -0.42; });
    await step(330);
    const r = await ev(([px, pz]) => { const D = VR.Dusk, sw = D.state.sw[0], p = VR.game.player.pos, q = D.ring(sw, p[0], p[1], p[2], {}); return { share: q.share, sec: q.sectors, ok: q.ok, rings: D.state.rings || 0, still: +D.state.still.toFixed(1) }; }, [x0, z0]);
    console.log('   ring: ' + JSON.stringify(r));
    check(r.ok && r.rings === 1, `after: standing still a ring closes round you and chimes once (${Math.round(r.share * 100)} %, ${r.sec}/8, chimes ${r.rings})`);
    out.ring = await shot('dusk_ring_after', NIGHT0);
    await step(300);
    check(await ev(() => VR.Dusk.state.rings) === 1, 'after: standing on, no second chime this night');
    // ---- 4 · you walk through: they part
    const walk = await ev(() => {
      const g = VR.game, p = g.player, D = VR.Dusk, sw = D.state.sw[0]; p.pos[0] -= 12; let s = 0, n = 0;
      window.__norender = true;
      for (let i = 0; i < 200; i++) { p.pos[0] += 4 / 30; p.vel[0] = 4; g.last = performance.now() - 33; g.loop(performance.now()); p.vel[0] = 0; const dx = p.pos[0] - sw.cx; if (Math.abs(dx) < 3) { let b = 1e9; for (let k = 0; k < sw.n; k++) b = Math.min(b, Math.hypot(sw.p[k * 3] - p.pos[0], sw.p[k * 3 + 2] - p.pos[2])); s += b; n++; } }
      return { mean: n ? s / n : -1, n };
    });
    console.log('   walk: ' + JSON.stringify(walk));
    check(walk.n > 0 && walk.mean >= 1, `after: walking through they part (nearest mote ${walk.mean.toFixed(2)} m on average)`);
    await ev(() => { VR.game.camMode = 0; VR.Dusk.state.sw.length = 0; });
  }

  // ---- 5 · night: the forest edge
  const NIGHT = await timeFor('night');
  await at(x0 + 0.5, z0 - 12); await lookAt(x0 + 0.5, y0 + 2.6, z0 - 28);
  if (after) { await place(x0 - 2, z0 - 22, 40, [[x0 - 5, y0 + 1, z0 - 20]]); await place(x0 + 6, z0 - 24, 40, [[x0 + 8, y0 + 1, z0 - 15]]); }
  await step(200);
  out.night = await shot('dusk_edge_' + tag, NIGHT);

  // ---- 6 · cost and Very Low
  if (after) {
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
    console.log(`   High: dusk.frame ${cost.frame.toFixed(3)} ms, drawMotes ${cost.draw.toFixed(3)} ms (${cost.draws}/120 frames drawn), ${cost.motes} motes, tier ${cost.tier}`);
    out.cost = cost;
    const vl = await ev(() => {
      const g = VR.game, D = VR.Dusk, r = g.renderer; g.settings.preset = 'potato'; D.state.tierT = 0; let tf = 0; const f0 = D.frame;
      // (the frames not drawn: a preset switch without applySettings rebuilt programs in SwiftShader — run 1 sat there
      // for minutes; what Very Low would draw is decided by D.out.count: 0 = the renderer gets no motes)
      let drawn = 0; const d0 = r.drawMotes; r.drawMotes = function (...a) { drawn++; return d0.apply(this, a); };
      D.frame = function (...a) { const t = performance.now(); f0.apply(this, a); tf += performance.now() - t; };
      let passed = 0;
      for (let i = 0; i < 150; i++) { g.last = performance.now() - 33; g.loop(performance.now()); if (VR.Dusk.out.count) passed++; }
      D.frame = f0; r.drawMotes = d0;
      return { sw: D.state.sw.length, count: D.out.count, passed, drawn, tier: D.state.tier, ms: tf / 150 };
    });
    console.log('   Very Low: ' + JSON.stringify(vl));
    check(vl.tier === 0 && vl.sw === 0 && vl.count === 0 && vl.passed === 0 && vl.drawn === 0, `Very Low: no swarm, nothing handed to the renderer in 150 frames (dusk.frame ${vl.ms.toFixed(4)} ms)`);
    out.vl = vl;
    for (const l of logs.slice(0, 6)) console.log(l);
    check(!logs.some(l => /pageerror\]/.test(l)), 'after: no page errors');
  }
  await ctx.close();
  return out;
}

try {
  browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const B = srvB ? await scene('before', PORT + 300) : null;
  const A = await scene('after', PORT);
  try {
    // the animals cropped (2–3×: their faces are a few dozen pixels in the full picture)
    const CROP = { close: [380, 230, 520, 292], fox: [400, 200, 480, 270], kit8: [480, 270, 320, 180] };
    for (const O of [B, A]) if (O) for (const k in CROP) { const [x, y, w, h] = CROP[k], f = O[k].replace('.png', '_crop.png'); execFileSync('python3', ['-c', `from PIL import Image; Image.open('${O[k]}').crop((${x},${y},${x + w},${y + h})).resize((1240,${Math.round(1240 * h / w)}), Image.LANCZOS).save('${f}')`]); O[k] = f; }
    const two = (k) => (B ? [B[k], A[k]] : [A[k]]);
    const spec = { w: 620, rows: [
      { label: 'Abendwiese · links vorher, rechts nachher: Flausellichter schweben über Blumen und Teich', imgs: two('dusk') },
      { label: 'Nachts am Waldrand · vorher | nachher', imgs: two('night') },
      { label: 'Stillstehen: die Lichter tanzen einen Ring um dich (einmal pro Nacht ein Glockenspiel)', imgs: [A.ring] },
      { label: 'Kitz und Fuchswelpe · vorher | nachher (Kitzkopf in Körperfarbe, hellere Bernstein-Iris)', imgs: two('close') },
      { label: 'Fuchs · vorher | nachher (keine dunkle Braue über den Augen)', imgs: two('fox') },
      { label: 'Kätzchen aus 8 m im Gras · vorher | nachher (helle Brust und Flanken)', imgs: two('kit8') },
    ] };
    fs.writeFileSync(path.join(SHOTS, 'dusk_sheet.json'), JSON.stringify(spec));
    execFileSync('python3', ['/root/r9coord/pairs.py', path.join(SHOTS, 'dusk_sheet.jpg'), path.join(SHOTS, 'dusk_sheet.json')]);
    console.log('sheet test/shots/dusk_sheet.jpg');
  } catch (e) { console.log('(no sheet: ' + e.message.slice(0, 120) + ')'); }
} catch (e) {
  fails++;
  console.log('  ✗ the test stopped: ' + (e.stack || e.message).slice(0, 900));
  for (const l of logs.slice(0, 8)) console.log(l);
}
try { if (browser) await browser.close(); } catch (e) { /* closed */ }
srv.kill(); if (srvB) srvB.kill();
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
