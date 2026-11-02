// f-wild3 · the u-wild2 animals polished — before (v042, built into .tmp_tests/before_src/dist when there) and after,
// in one browser, German (de-DE), a creative flat meadow at noon:
//   1 six kinds in a row (adults behind, babies in front), facing left and a little toward you: at 8 m
//     (wild3_8m_{before,after}.png) and up close (wild3_close_{before,after}.png: a fawn and a fox kit; wild3_adult_*:
//     the doe and the fox) — the coats read, the eyes are soft (a half-voxel catchlight, its glint part drawn near)
//   2 finches hop; you come near: they fly a short arc (wild3_takeoff_*.png 0.45 s after) and land again on a fence top,
//     a leaf or the grass within 3.5 s (wild3_landed_*.png) — before, they were gone
//   3 Very Low: nothing attached; no page errors. The sheet test/shots/wild3_sheet.jpg (German captions).
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
      if (!window.__noraf) { window.__noraf = true; window.requestAnimationFrame = () => 0; }   // (the game moves only when the test steps it)
      if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
      window.__norender = true;
      for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); }
    }, [Math.min(20, n - k), dtms]);
  }
};
const pickTime = () => ev(() => {
  const g = VR.game; let best = 6000, bs = 1e9;
  window.__norender = true;
  for (let t = 0; t < 24000; t += 500) { g.env.setTime(t); g.last = performance.now() - 16; g.loop(performance.now()); const sc = g.env.E.night * 10 - g.env.E.sunDir[1]; if (sc < bs) { bs = sc; best = t; } }
  g.env.setTime(best); return best;
});
const shot = async (name, tod) => {
  const hide = (on) => ev((on) => {
    for (const el of document.querySelectorAll('#hud > *')) el.style.visibility = on ? 'hidden' : '';
    for (const id of ['lockhint', 'hint', 'hints', 'toasts']) { const el = document.getElementById(id); if (el) el.style.visibility = on ? 'hidden' : ''; }
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

async function scene(tag, port) {
  console.log('=== ' + tag);
  const out = {};
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  page = await ctx.newPage(); logs = [];
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 600)));
  page.on('dialog', d => d.accept('x'));
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  check(await untilTitle(), tag + ': the title screen opens');
  await ev(() => { const g = VR.game; g.settings.renderDist = 5; g.settings.dynRes = false; g.applySettings('renderDist'); });
  await ev(() => { VR.game.createWorld({ name: 'Wiese', mode: 'creative', difficulty: 'peaceful', type: 'flat', seed: '11', cheats: true, kit: true }); });
  check(await untilPlay(), tag + ': the flat world opens');
  await step(40);
  const P0 = await ev(() => {
    const g = VR.game, p = g.player, w = g.world, R = VR.R, S = (n) => (R.byName[n] ? R.S(n) : 0);
    g.settings.preset = 'balanced'; g.settings.wildHeart = true; g.env.rain = 0; g.env.rainTarget = 0; g.entities.trySpawn = () => {}; p.flying = false;
    const x0 = Math.floor(p.pos[0]), z0 = Math.floor(p.pos[2]), y0 = w.topAt(x0, z0), gr = S('short_grass') || S('grass');
    for (let dz = -30; dz <= 8; dz++) for (let dx = -14; dx <= 14; dx++) { const h = (Math.imul(dx * 73856093 ^ dz * 19349663, 2654435761) >>> 0) % 100; if (h < 9 && gr && !w.getBlock(x0 + dx, y0 + 1, z0 + dz)) w.setBlock(x0 + dx, y0 + 1, z0 + dz, gr, 4); }
    return [x0, y0, z0];
  });
  const [x0, y0, z0] = P0;
  const DAY = await pickTime();
  await step(30);

  // 1 · the row: adults at z0-8, babies at z0-6.3, 2.5 blocks apart, facing left and a little toward you
  const KINDS = ['glimmer_deer', 'glimmer_fox', 'moss_cat', 'moss_boar', 'bloom_sheep', 'crystal_pup'];
  const row = await ev(([x0, y0, z0, KINDS]) => {
    const g = VR.game, E = g.entities, H = g.companions.heart, gl = g.renderer.gl, ids = [];
    H.update(1.1);
    KINDS.forEach((k, i) => for2(k, i));
    function for2(k, i) {
      for (const baby of [false, true]) {
        const x = x0 - 6.25 + i * 2.5, z = z0 - (baby ? 6.3 : 8.2);
        // (the grass where they stand: cleared, so the legs show)
        g.world.setBlock(Math.floor(x), y0 + 1, Math.floor(z), 0, 4);
        const m = E.summon(k, x, y0 + 1, z); if (!m) continue;
        const h = m.wh || H.attach(m);
        h.baby = baby; m.wscale = baby ? 0.62 : 1; h.mode = 'stay'; h.thinkT = 1e9; h.blinkT = 1e9; h.bl = 0;
        const key = VR.WildHeart.vkey(k, ids.length % 4, baby); VR.getVoxModel(gl, key); m.vkey = key; H.built.add(key);
        m.yaw = Math.PI / 2 + 0.45; m.ai = m.ai || {}; ids.push(m.id);
      }
    }
    window.__row = ids;
    return { n: ids.length, glint: !!(VR.getVoxModel(gl, VR.WildHeart.vkey('glimmer_deer', 0, true)).parts.glint) };
  }, [x0, y0, z0, KINDS]);
  check(row.n === 12, tag + ': twelve animals in the row (' + row.n + ')');
  if (tag === 'after') check(row.glint, 'after: the models carry the catchlight part');
  await step(6);
  await at(x0 + 0.5, z0 + 0.4); await lookAt(x0 + 0.5, y0 + 0.9, z0 - 7.2); await step(2);
  out.far = await shot('wild3_8m_' + tag, DAY);
  // up close: the fawn and the fox kit (babies 0 and 1), ~2.4 m off, a little above
  const bpos = await ev(() => { const ms = VR.game.entities.mobs, q = window.__row.map(id => ms.find(m => m.id === id)); return [q[1].pos, q[3].pos].map(p => [p[0], p[1], p[2]]); });
  await at((bpos[0][0] + bpos[1][0]) / 2 - 0.2, bpos[0][2] + 2.5); await lookAt((bpos[0][0] + bpos[1][0]) / 2 - 0.3, bpos[0][1] + 0.55, bpos[0][2]); await step(2);
  out.close = await shot('wild3_close_' + tag, DAY);
  if (tag === 'after') {
    const near = await ev(() => { const ms = VR.game.entities.mobs, q = window.__row.map(id => ms.find(m => m.id === id)); return [q[1], q[3]].map(m => !!(m.whide && !m.whide.glint && m.whide.head_o)); });
    check(near.every(Boolean), 'after: near, the open head with its glint is drawn');
  }
  // the adults up close: the babies step aside
  await ev(() => { const ms = VR.game.entities.mobs, q = window.__row.map(id => ms.find(m => m.id === id)); for (let i = 1; i < q.length; i += 2) q[i].pos[0] += 40; });
  const apos = await ev(() => { const ms = VR.game.entities.mobs, q = window.__row.map(id => ms.find(m => m.id === id)); return [q[0].pos, q[2].pos].map(p => [p[0], p[1], p[2]]); });
  await at((apos[0][0] + apos[1][0]) / 2 - 0.3, apos[0][2] + 3.4); await lookAt((apos[0][0] + apos[1][0]) / 2 - 0.4, apos[0][1] + 0.85, apos[0][2]); await step(2);
  out.adult = await shot('wild3_adult_' + tag, DAY);
  if (tag === 'after') {
    // a blink: half lid → shut → half lid, in the pose
    const bl = await ev(() => { const g = VR.game, m = g.entities.mobs.find(q => q.id === window.__row[0]), H = g.companions.heart, seq = []; m.wh.bl = VR.WildBond.BLINK; m.wh.lt = -1; let t = 100; for (let i = 0; i < 12; i++) { t += 0.02; H.pose(m, t, {}); seq.push(m.whide.head_h ? (m.whide.head_c ? (m.whide.glint ? 'f' : 'o') : 's') : 'h'); } return seq.join(''); });
    console.log('   a blink: ' + bl);
    check(/^h+s+h+[o]/.test(bl), 'after: a blink goes half lid → shut → half lid → open');
  }

  // 2 · finches: a fence post and a little bush ahead of the flock, you come near
  await ev(() => { const ms = VR.game.entities.mobs; for (const m of ms) m.pos[0] += 60; });
  const F = await ev(([x0, y0, z0]) => {
    const g = VR.game, w = g.world, R = VR.R, S = (n) => (R.byName[n] ? R.S(n) : 0), H = g.companions.heart;
    const fx = x0, fz = z0 - 14;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -8; dx <= 8; dx++) if (w.getBlock(fx + dx, y0 + 1, fz + dz) === S('short_grass')) w.setBlock(fx + dx, y0 + 1, fz + dz, 0, 4);
    w.setBlock(fx + 1, y0 + 1, fz - 1, S('oak_fence'), 4); w.setBlock(fx + 2, y0 + 1, fz - 1, S('oak_fence'), 4); w.setBlock(fx + 3, y0 + 1, fz - 1, S('oak_fence'), 4);
    for (const [a, b] of [[-3, -2], [-4, -2], [-3, -3], [-4, -3]]) { w.setBlock(fx + a, y0 + 1, fz + b, S('oak_leaves'), 4); }
    w.setBlock(fx - 3, y0 + 2, fz - 2, S('oak_leaves'), 4);
    H.flock(fx + 0.5, fz + 5.5, 6);
    return [fx, fz];
  }, P0);
  await at(F[0] + 0.5, F[1] + 16); await step(20);
  const hop = await ev(() => VR.game.companions.heart.birds.filter(b => b.st === 'hop').length);
  await at(F[0] + 0.7, F[1] + 9.2); await lookAt(F[0] + 0.3, y0 + 1.6, F[1] + 1.5);
  await step(14);
  const mid = await ev(() => VR.game.companions.heart.birds.map(b => b.st));
  out.takeoff = await shot('wild3_takeoff_' + tag, DAY);
  for (let k = 0; k < 8; k++) { await step(12); const st = await ev(() => VR.game.companions.heart.birds.map(b => b.st)); if (st.every(s => s === 'hop' || s === 'perch')) break; }
  const land = await ev(([fx, fz]) => { const L = VR.game.companions.heart.birds; return { st: L.map(b => b.st), n: L.length, far: Math.max(0, ...L.map(b => Math.hypot(b.x - fx - 0.5, b.z - fz - 5.5))) }; }, F);
  console.log('   ' + tag + ' finches: hop ' + hop + ' · in the air ' + mid.join(' ') + ' · after ' + land.st.join(' ') + ' (' + land.n + ', within ' + land.far.toFixed(1) + ' blocks)');
  await lookAt(F[0] + 0.3, y0 + 1.4, F[1] - 0.5); await step(1);
  out.landed = await shot('wild3_landed_' + tag, DAY);
  if (tag === 'after') {
    check(hop >= 4 && mid.filter(s => s === 'fly').length >= 2, `after: finches hop (${hop}) and take off as you come (${mid.filter(s => s === 'fly').length} in the air)`);
    check(land.n >= 4 && land.st.every(s => s === 'hop' || s === 'perch') && land.st.some(s => s === 'perch') && land.far < 12, 'after: within 3.5 s they landed again, some on the fence or the bush, all near');
    // 3 · Very Low
    const vl = await ev(() => {
      const g = VR.game, H = g.companions.heart; g.settings.preset = 'potato';
      for (let i = 0; i < 70; i++) { g.last = performance.now() - 33; g.loop(performance.now()); }
      const d = g.entities.summon('bloom_sheep', g.player.pos[0] + 3, g.player.pos[1], g.player.pos[2]);
      for (let i = 0; i < 40; i++) { g.last = performance.now() - 33; g.loop(performance.now()); }
      return { on: H.on, wh: g.entities.mobs.filter(m => m.wh).length, birds: H.birds.length, sheep: !d.wh };
    });
    check(!vl.on && vl.wh === 0 && vl.birds === 0 && vl.sheep, 'Very Low: off — no animal has a heart, no finches');
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
    const two = (k) => (B ? [B[k], A[k]] : [A[k]]);
    const spec = { w: 620, rows: [
      { label: 'Nahaufnahme · Kitz und Fuchswelpe — links vorher, rechts nachher (Fell, sanfte Augen)', imgs: two('close') },
      { label: 'Nahaufnahme · Ricke und Fuchs — vorher | nachher (kleiner Lichtpunkt, dunkle warme Iris)', imgs: two('adult') },
      { label: 'Aus 8 m · alle sechs Arten, Eltern und Junge — vorher | nachher (Muster lesbar)', imgs: two('far') },
      { label: 'Finken heben ab (0,45 s) — vorher | nachher (kurzer Bogen)', imgs: two('takeoff') },
      { label: 'Nach 3 s · vorher fort | nachher gelandet (Zaun, Busch, Wiese)', imgs: two('landed') },
    ] };
    fs.writeFileSync(path.join(SHOTS, 'wild3_sheet.json'), JSON.stringify(spec));
    execFileSync('python3', ['/root/r9coord/pairs.py', path.join(SHOTS, 'wild3_sheet.jpg'), path.join(SHOTS, 'wild3_sheet.json')]);
    console.log('sheet test/shots/wild3_sheet.jpg');
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
