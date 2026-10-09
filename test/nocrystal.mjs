// F-NoCrystal in the browser (docs/superpowers/plans/2026-10-09-f-nocrystal.md): one browser, two worlds of one seed —
// TAG before = vgen 8 (an old world: it keeps its crystals), after = vgen 9 (a new world: none) — flown to the same
// cameras over the Heartland's set pieces and the realm: the prism fields (by day, by night, from afar over the horizon
// tiles), the crystal highlands, the Ember Canyon's gem site, the Spire Citadel's giants, the Sky Isles from above and
// from below, the Gate Plaza's corner, a prism village and a geode in the caves. At every camera the crystal blocks of
// every loaded column are counted (vgen 9: none, ever; vgen 8: the pictures before) and the picture is written as
// test/shots/nocrystal_<place>_<tag>.png. The vgen-9 world also takes a meteor (its crater has no crystal), its creative
// kit holds none, the title panorama shows none; no page errors.
//   bash test/wt_run.sh nocrystal.mjs 2400      · SEED=4242 (the cameras were found for it) · ONLY=canyon,isles
//   NO_BEFORE=1 (only the vgen-9 world) · RD=6 (render distance) · SETTLE=300 (settling rounds a camera may take)
// regress: skip  (two world loads and eleven cameras; the gate is test/nocrystal.js)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const SEED = process.env.SEED || '4242', RD = +(process.env.RD || 6);
const DIST = process.env.DIST || 'file:///home/claude/vr/dist/index.html';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const NOON = 6000, NIGHT = 18000;
const RUNS = []; if (!process.env.NO_BEFORE) RUNS.push(['before', 8]); RUNS.push(['after', 9]);
// the cameras (seed 4242, from the vgen-8 generator: each place's tallest crystal, the camera where the land is low):
// [name, camera, look-at, time of day, what stands there at vgen 9]
const PLACES = [
  ['prism', [-862.5, 100, 751.5], [-886.5, 94, 727.5], NOON, 'Lavendelfelder: Felsnadeln aus Dämmerstein statt der Kristallspitzen'],
  ['prism_night', [-862.5, 100, 751.5], [-886.5, 94, 727.5], NIGHT, 'dieselben bei Nacht: die Äther-Adern glimmen'],
  ['prism_far', [-760.5, 190, 860.5], [-886.5, 100, 727.5], NOON, 'aus der Ferne: die Horizont-Kacheln zeigen Felsnadeln'],
  ['highlands', [-1069.5, 170.5, 1143.5], [-1069.5, 162.5, 1099.5], NOON, 'Lavendelhochland: hohe Felsnadeln'],
  ['canyon', [-1.5, 111, 208.5], [28.5, 105, 208.5], NOON, 'Glutschlucht: ein Hoodoo statt des Kristall-Edelsteins'],
  ['citadel', [-358.5, 110, 438.5], [-398.5, 100, 438.5], NOON, 'Spitzen-Zitadelle: Felsnadeln am Fuß statt der Riesenkristalle'],
  ['isles', [267.5, 184, 59.5], [293.5, 173, 33.5], NOON, 'Himmelsinseln: ein runder Baum statt des Kristalls'],
  ['isles_under', [288.5, 118, 157.5], [310.5, 134, 139.5], NOON, 'unter den Inseln: Leuchtbeeren-Ranken und Wurzeln statt der Kristallzapfen'],
  ['temple', [30.5, 92, 150.5], [57.5, 84, 136.5], NOON, 'Torplatz: eine Palme im Pflanzkübel mit Hecken statt der Kristallsäule'],
  ['village', [317.5, 90, 1698.5], [299.5, 77, 1680.5], NOON, 'ein Prisma-Dorf: Lavendelputz, Laternen, ein Ätherbrunnen'],
  ['cave', [-11.5, 42, 74.5], [-6.5, 42, 74.5], NOON, 'eine Druse: Tropfsteintasche statt Amethyst'],
];
const want = (name) => !ONLY || ONLY.some(o => name === o || name.startsWith(o + '_'));
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const counts = {};
try { for (const [tag, vgen] of RUNS) await runPage(tag, vgen); } catch (e) { fails++; console.log('  ✗ crashed: ' + String(e && e.stack || e).slice(0, 1200)); }
if (counts.before && counts.after) for (const [name] of PLACES) if (counts.before[name] !== undefined && counts.after[name] !== undefined) console.log(`  ${name.padEnd(12)} crystal blocks in the loaded columns: vgen 8 ${counts.before[name]} · vgen 9 ${counts.after[name]}`);
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

async function runPage(tag, vgen) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  await ctx.addInitScript(() => { try { localStorage.setItem('r9si.lang', 'de'); } catch (e) { /* */ } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|shader/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
  await page.goto(DIST);
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const step = async (n, dtms = 16) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
  // settled: no job, no column waiting, no section to mesh or upload, nothing fading in, every column within the render
  // distance shown (and, for a far view, the horizon built)
  const settle = async (max = 60, horizon = false) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game, w = g.world; let dirty = 0; for (const c of w.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; const p = g.player, rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown, hz: g.horizon && g.horizon.progress ? g.horizon.progress() : 1 }; }); if (s.pend === 0 && s.dirty === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0 && (!horizon || s.hz >= 0.98) && i > 2) return i; await wait(60); } return -1; };   // (the pool stays busy with the 5 km horizon's tiles: the columns' own queues decide)
  const warmVx = () => ev(() => {
    const g = VR.game, r = g.renderer, p = g.player; if (!r.vxResidency || !g.world) return -1;
    const cam = [p.pos[0], p.pos[1] + (p.eye || 1.62), p.pos[2]], list = [];
    for (const c of g.world.cols.values()) for (const s of c.sec) if (s && s.hasMesh) list.push(s);
    const D = (r.q && r.q.vxLod) || 48, up2 = D * D; let n = 0;
    for (; n < 600; n++) { let w8 = 0; for (const s of list) { if (!s.vxData || s.mesh[3]) continue; const dx = s.ox + 8 - cam[0], dy = s.oy + 8 - cam[1], dz = s.oz + 8 - cam[2]; if (dx * dx + dy * dy * 0.5 + dz * dz < up2) w8++; } if (!w8) break; r.vxResidency(list, cam); }
    return n;
  });
  const shotPath = (name) => `/home/claude/vr/test/shots/nocrystal_${name}_${tag}.png`;
  const shot = async (name) => { await warmVx(); await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 4; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: shotPath(name), timeout: 180000 }); return fs.existsSync(shotPath(name)); };
  // the crystal blocks of every loaded column, by name (the families of test/nocrystal.js)
  const countCry = () => ev(() => {
    const R = VR.R, TT = R.T.type, w = VR.game.world;
    if (!window.__cry) { const a = new Uint8Array(R.types.length + 1); for (const t of R.types) if (t && /crystal|amethyst|prism|(^|_)gems?($|_)|geode/.test(t.name)) a[t.id] = 1; window.__cry = a; }
    const C = window.__cry; let n = 0, cols = 0; const by = {};
    for (const c of w.cols.values()) { const b = c.blocks; if (!b) continue; cols++; for (let i = 0; i < b.length; i++) { const s = b[i]; if (s && C[TT[s]]) { n++; const nm = R.types[TT[s]].name; by[nm] = (by[nm] || 0) + 1; } } }
    return { n, cols, by };
  });
  const look = async (pos, at, tod) => {
    await ev(([pos, at, tod]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(pos[0], pos[1], pos[2]); const dx = at[0] - pos[0], dy = at[1] - (pos[1] + 1.62), dz = at[2] - pos[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.vel = [0, 0, 0]; p.fovKick = 0; g.env.setTime(tod); const e = g.entities; if (e && e.mobs) e.mobs.length = 0; }, [pos, at, tod]);
  };

  // ---- the title panorama: a vgen-5 world without crystals
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  check(await ev(() => VR.game.state) === 'title', `${tag}: the start screen is up`);
  await ev((rd) => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = rd; g.applySettings('*'); }, RD);
  for (let i = 0; i < 40; i++) { await wait(500); const c = await ev(() => { let n = 0; for (const c of VR.game.world.cols.values()) if (c.blocks) n++; return n; }); if (c >= 40) break; }
  const tc = await countCry();
  const topt = await ev(() => VR.game.world && VR.game.world.genOpts);
  check(tc.cols > 0 && tc.n === 0 && topt && topt.noCrystal === true, `${tag}: the title panorama (vgen ${topt && topt.vgen}, noCrystal) has no crystal in its ${tc.cols} loaded columns (${tc.n})` + (tc.n ? ' ' + JSON.stringify(tc.by) : ''));
  if (tag === 'after') { await ev(() => { window.__norender = false; }); await wait(1500); await page.screenshot({ path: shotPath('title'), timeout: 180000 }); console.log('shot title', tag); }

  // ---- the world
  await ev(([seed, vgen]) => VR.game.createWorld({ name: 'Keine Kristalle ' + vgen, mode: 'creative', difficulty: 'peaceful', type: 'default', seed, vgen, cheats: true, kit: true }), [SEED, vgen]);
  for (let i = 0; i < 150; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  check(await ev(() => VR.game.state) === 'play', `${tag}: the world is loaded`);
  const meta = await ev(() => ({ vgen: VR.game.meta && VR.game.meta.vgen, gen: VR.game.world.genOpts.vgen }));
  check(meta.vgen === vgen && meta.gen === vgen, `${tag}: the world runs vgen ${vgen} (${JSON.stringify(meta)})`);
  await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } });
  // the creative kit
  const kit = await ev(() => VR.game.player.inv.slots.filter(s => s && /crystal|amethyst/.test(s.id)).map(s => s.id));
  if (vgen >= 9) check(kit.length === 0, `${tag}: the creative kit holds no crystal (${kit.join(' ') || 'none'})`);
  else console.log(`  ${tag}: the creative kit's crystals: ${kit.join(' ') || 'none'}`);
  counts[tag] = {};
  let pics = 0, wanted = 0, worst = 0;
  for (const [name, pos, at, tod, what] of PLACES) {
    if (!want(name)) continue;
    wanted++;
    const t0 = Date.now();
    // the camera, then the land round it settles (a camera a kilometre away waits for every column of the render
    // distance: run 1's first prism picture caught the horizon tiles standing in for the near land)
    await look(pos, at, tod);
    if (name === 'cave') {
      // the geode's hollow is dark (no sky reaches it): once its column is loaded, a sunstone behind the camera lights it
      // the same way at both vgens (run 1 placed it before the column had come: the vgen-9 pocket stayed black)
      await settle(+(process.env.SETTLE || 300));
      const lit = await ev(([x, y, z]) => { const w = VR.game.world, R = VR.R; for (let k = 1; k <= 3; k++) { const s = w.getBlock(Math.floor(x) - k, Math.floor(y) + 1, Math.floor(z)); if (!s) return w.setBlock(Math.floor(x) - k, Math.floor(y) + 1, Math.floor(z), R.S('sunstone')) ? k : -k; } return 0; }, pos);
      console.log(`  ${tag} cave: a sunstone ${lit > 0 ? lit + ' behind the camera' : 'not placed (' + lit + ')'}`);
    }
    const st = await settle(+(process.env.SETTLE || 300), name === 'prism_far');
    const c = await countCry();
    counts[tag][name] = c.n;
    if (c.n > worst) worst = c.n;
    if (vgen >= 9) check(c.n === 0, `${tag} ${name}: no crystal block in the ${c.cols} loaded columns (${c.n})` + (c.n ? ' ' + JSON.stringify(c.by) : ''));
    else console.log(`  ${tag} ${name}: ${c.n} crystal blocks in the ${c.cols} loaded columns ${JSON.stringify(c.by)}`);
    if (await shot(name)) pics++;
    console.log(`  shot ${name} ${tag} (${what}; settled ${st}, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  check(pics === wanted && wanted > 0, `${tag}: every picture is written (${pics} of ${wanted})`);
  if (vgen < 9) check(worst > 0, `${tag}: the old world keeps its crystals (up to ${worst} in the loaded columns)`);
  // ---- a meteor strikes beside the Gate Plaza: its crater holds no crystal in a vgen-9 world
  if (!ONLY || ONLY.includes('meteor')) {
    await ev(() => { const p = VR.game.player; p.teleport(20.5, 120, 175.5); });
    await settle(30);
    const before = (await countCry()).n;
    const at = await ev(() => { const w = VR.game.world, R = VR.R, F = VR.F; let y = 160; while (y > 40 && !(w.getBlock(20, y, 175) && (R.T.flags[w.getBlock(20, y, 175)] & F.SOLID))) y--; VR.game.gadgets.impact([20.5, y + 1, 175.5], {}); return y; });
    await step(20); await settle(20);
    const after = (await countCry()).n;
    if (vgen >= 9) check(after === 0, `${tag}: a meteor's crater (ground y ${at}) has no crystal (${before} → ${after})`);
    else console.log(`  ${tag}: a meteor's crater (ground y ${at}): ${before} → ${after} crystal blocks`);
    await look([30.5, at + 9, 190.5], [20.5, at - 2, 175.5], NOON); await settle(20);
    if (await shot('meteor')) console.log('  shot meteor', tag);
  }
  check(logs.length === 0, `${tag}: no page or shader errors` + (logs.length ? ' — ' + logs.slice(0, 3).join(' | ') : ''));
  await ctx.close();
}
