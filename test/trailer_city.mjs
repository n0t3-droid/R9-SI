// Palm City Nova Haven (TRAILER.md shot F; plan docs/superpowers/plans/2026-10-08-t-city2.md): the game's picture of
// every city frame at the same world cameras, one page per build — BEFORE_DIST (an earlier build, e.g. a copy of the
// v042 dist) as test/shots/trailer_city_<shot>_before.png, then this checkout's dist as …_<TAG>.png (TAG default after):
//   F1  t3_05  the avenue at eye height (dusk) · F1_noon the same at noon · F1_potato the Very Low picture
//   F2  t1_24  the tower house from the corridor's end      F3  t2_23  the corner villa from the plaza
//   F4  t1_22  the long villa with the big tree, from inside the corridor
//   F5  t3_07  the terraces from the street                 F6  t3_09  the terraces from above
//   F0  the city from above the plaza (the layout)
// Dusk is 13000 (19:00 on the cockpit clock), the ringed giant pinned in the north sky (env.planetsOverride, as the
// director's trailer shots do), seed 4242, the High preset, no HUD. Then the Very Low (potato) cost at F1: ms per
// frame, draws and triangles over N frames (swiftshader: compare the two builds of one run, not absolute numbers).
// Checks: every picture written, no page error, and on a vgen-8 build the city's pieces at the cameras (a light line by
// the F1 road, an amber accent and a nova window near the plaza).
// usage: BEFORE_DIST=file:///…/index.html TAG=after bash test/wt_run.sh trailer_city.mjs 3600
//   ONLY=F1,F2 (shot names) · NO_AFTER=1 (only the BEFORE_DIST page) · N=8 frames per cost round · SEED=4242
// regress: skip  (a showcase with two world loads; the gate is test/trailer_city.js)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const TAG = process.env.TAG || 'after', N = +(process.env.N || 8), SEED = process.env.SEED || '4242';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const DUSK = +(process.env.TOD || 13000), NOON = 6000;
const RUNS = [];
if (process.env.BEFORE_DIST) RUNS.push(['before', process.env.BEFORE_DIST]);
if (!process.env.NO_AFTER) RUNS.push([TAG, process.env.DIST || 'file:///home/claude/vr/dist/index.html']);
// [name, x, z, eye above the ground (or {y: feet}), yaw, pitch, fov, time of day]
const SHOTS = [
  ['F1', -5.5, -147.5, 1.62, 0.32, -0.03, 55, DUSK],
  ['F2', 1.5, -51.5, 2.4, 0.45, -0.06, 50, DUSK],
  ['F3', 6.5, -53.5, 1.8, 0.95, -0.04, 50, DUSK],
  ['F4', 0.5, -44.5, { y: 81 }, 0, -0.03, 55, DUSK],
  ['F5', 11.5, -226.5, 1.62, 0.05, 0.05, 55, DUSK],
  ['F6', 70.5, -235.5, 40, 0.75, -0.32, 60, DUSK],
  ['F0', 0.5, -60.5, { y: 150 }, 0, -0.62, 70, DUSK],
  ['F1_noon', -5.5, -147.5, 1.62, 0.32, -0.03, 55, NOON],
];
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const costs = {};
for (const [tag, dist] of RUNS) await runPage(tag, dist);
if (costs.before && costs[TAG]) console.log(`very low at F1: before ${JSON.stringify(costs.before)} · ${TAG} ${JSON.stringify(costs[TAG])}`);
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

async function runPage(tag, dist) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|missing/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
  await page.goto(dist);
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const step = async (n, dtms = 16) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
  const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && i > 2) break; await wait(60); } };
  const shotPath = (name) => `/home/claude/vr/test/shots/trailer_city_${name}_${tag}.png`;
  const shot = async (name, frames = 4) => { await ev((frames) => { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, frames); await page.screenshot({ path: shotPath(name), timeout: 180000 }); const ok = fs.existsSync(shotPath(name)); console.log('shot', name, tag, ok ? '' : '(missing)'); return ok; };
  // the top of the ground under (x, z): the highest opaque block below y 140 that is not leaves
  const groundY = (x, z) => ev(([x, z]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = 140; y > 40; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & F.OPAQUE) && !(R.T.flags[s] & F.LEAVES)) return y; } return 80; }, [x, z]);
  const place = async (x, z, eye, yaw, pitch, fov, tod) => {
    // load the ground first (flying high over the spot), then stand at the eye height above it
    await ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 120, z); }, [x, z]);
    await settle(40);
    const feet = typeof eye === 'object' ? eye.y : (await groundY(x, z)) + 1 + (eye - 1.62);
    await ev(([x, y, z, yaw, pitch, fov, tod]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = yaw; p.pitch = pitch; p.fovKick = 0; p.vel = [0, 0, 0]; g.settings.fov = fov; g.env.setTime(tod); const e = g.entities; if (e && e.mobs) e.mobs.length = 0; }, [x, feet, z, yaw, pitch, fov, tod]);
    await settle(50); await step(6);
    return feet;
  };
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.horizon = 1; g.applySettings('*'); });
  await ev(`VR.game.createWorld({name:'Nova Haven',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
  for (let i = 0; i < 120; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  check(await ev(() => VR.game.state) === 'play', `${tag}: the world is loaded`);
  await ev((tod) => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } g.env.setTime(tod); g.env.planetsOverride = { az: -2.0, el: 22, az2: -1.1, el2: 42 }; }, DUSK);
  await settle(60);
  const meta = await ev(() => { const g = VR.game, w = g.world; const gen = w && w.genOpts; return { vgen: (g.meta && g.meta.vgen) || (gen && gen.vgen) || 0 }; });
  console.log(tag, 'world', JSON.stringify(meta));
  let pics = 0, want = 0;
  for (const [name, x, z, eye, yaw, pitch, fov, tod] of SHOTS) {
    if (ONLY && !ONLY.some(o => name === o || name.startsWith(o + '_'))) continue;
    want++;
    const feet = await place(x, z, eye, yaw, pitch, fov, tod);
    console.log(`  ${name}: feet ${feet.toFixed ? feet.toFixed(1) : feet} at (${x}, ${z}) yaw ${yaw} pitch ${pitch} fov ${fov} tod ${tod}`);
    if (await shot(name)) pics++;
  }
  check(pics === want && want > 0, `${tag}: every picture is written (${pics} of ${want})`);
  // the city's pieces at the cameras (a vgen-8 build): a light line by the F1 road, the amber accent and a nova window near the plaza
  if (meta.vgen >= 8) {
    const probe = await ev(() => {
      const w = VR.game.world, R = VR.R, nm = (s) => s ? R.types[R.T.type[s]].name : 'air';
      const count = (x0, z0, r, y0, y1, re) => { let n = 0; for (let x = x0 - r; x <= x0 + r; x++) for (let z = z0 - r; z <= z0 + r; z++) for (let y = y0; y <= y1; y++) if (re.test(nm(w.getBlock(x, y, z)))) n++; return n; };
      return { lineF1: count(-6, -148, 12, 76, 88, /^vx_floor_plaza_line$/), amber: count(0, -70, 30, 76, 88, /^vx_floor_plaza_line_amber$/), window: count(0, -80, 40, 80, 104, /^vx_nova_window$/) };
    });
    console.log(tag, 'probe', JSON.stringify(probe));
    check(probe.lineF1 >= 10 && probe.amber >= 1 && probe.window >= 20, `${tag}: the city stands at the cameras (light-line cells by the F1 road ${probe.lineF1}, amber accents near the plaza ${probe.amber}, nova window cells ${probe.window})`);
  }
  // the Very Low (potato) preset at F1: its picture and its frame cost
  if (!ONLY || ONLY.includes('F1')) {
    try {
      await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
      const [, x, z, eye, yaw, pitch, fov] = SHOTS[0];
      await place(x, z, eye, yaw, pitch, fov, DUSK);
      await settle(80);
      if (await shot('F1_potato', 16)) console.log('  F1_potato written');
      const rounds = [];
      for (let r = 0; r < 3; r++) {
        await ev(() => { window.__norender = false; });
        rounds.push(await ev((n) => new Promise((ok, no) => { const g = VR.game, gl = g.renderer.gl; let k = -2, sum = 0, d = 0, t = 0; const f = () => { try { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); const dt = performance.now() - t0; if (k < 0) { k++; setTimeout(f, 0); return; } const st = g.renderer.stats || {}; sum += dt; d += st.draws || 0; t += st.tris || 0; if (++k < n) setTimeout(f, 0); else ok({ ms: +(sum / n).toFixed(1), draws: Math.round(d / n), tris: Math.round(t / n) }); } catch (e) { no(String(e)); } }; f(); }), N));
        await ev(() => { window.__norender = true; });
      }
      const ms = rounds.map(r => r.ms).sort((a, b) => a - b);
      costs[tag] = { msMedian: ms[1], ms, draws: rounds[1].draws, tris: rounds[1].tris };
      console.log(`measure ${tag} potato at F1: ${JSON.stringify(costs[tag])}`);
    } catch (e) { console.log(`measure ${tag} failed: ${String(e.message || e).slice(0, 200)}`); }
  }
  const errs = logs.filter(l => l.startsWith('[pageerror]'));
  console.log(`--- ${tag} logs (${logs.length})`); for (const l of logs.slice(0, 12)) console.log(l);
  check(errs.length === 0, `${tag}: no page error (${errs.length})`);
  await ctx.close();
}
