// Palm City Nova Haven (TRAILER.md shot F; plan docs/superpowers/plans/2026-10-08-t-city2.md): the game's picture of
// every city frame at the same world cameras, one page per build — BEFORE_DIST (an earlier build, e.g. a copy of the
// v042 dist) as test/shots/trailer_city_<shot>_before.png, then this checkout's dist as …_<TAG>.png (TAG default after):
//   F1  t3_05  the fork at eye height (dusk) · F1_noon the same at noon · F1_late at the blue hour · F1_potato Very Low
//   F2  t1_24  the long villa and the tower house from the corridor's end   F3  t2_23  the corner villa (F3_late too)
//   F4  t1_22  from inside the corridor: up the avenue between the villas
//   F5  t3_07  the terraced round hills from the street     F6  t3_09  the terraced round hills from above
//   F0  the city from above the plaza (the layout)
// Dusk is 13000 (19:00 on the cockpit clock), the blue hour 13700, the ringed giant pinned in the north sky
// (env.planetsOverride, as the director's trailer shots do), seed 4242, the High preset, no HUD. Before each picture the
// detailed pieces within the detail distance are uploaded (the settling steps draw nothing) and the villagers right at
// the camera are left out. Then the Very Low (potato) cost at F1: ms per frame, draws and triangles over N frames
// (swiftshader: compare the two builds of one run, not absolute numbers).
// Checks: every picture written, no page error, and on a vgen-8 build the city's pieces at the cameras (a light line by
// the F1 road, an amber accent and a nova window near the plaza, the island's tip bed).
// usage: BEFORE_DIST=file:///…/index.html TAG=after bash test/wt_run.sh trailer_city.mjs 3600
//   ONLY=F1,F2 (shot names) · NO_AFTER=1 (only the BEFORE_DIST page) · N=8 frames per cost round · SEED=4242
// regress: skip  (a showcase with two world loads; the gate is test/trailer_city.js)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const TAG = process.env.TAG || 'after', N = +(process.env.N || 8), SEED = process.env.SEED || '4242';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const DUSK = +(process.env.TOD || 13000), NOON = 6000, LATE = 13700;
const RUNS = [];
if (process.env.BEFORE_DIST) RUNS.push(['before', process.env.BEFORE_DIST]);
if (!process.env.NO_AFTER) RUNS.push([TAG, process.env.DIST || 'file:///home/claude/vr/dist/index.html']);
// [name, x, z, eye above the ground (or {y: feet}), yaw, pitch, fov, time of day]
const SHOTS = [
  ['F1', 3.5, -96.5, 1.62, 0.3, 0.03, 60, DUSK],           // t3_05: the fork — the avenue parting round the island (the raised bed, the round tree), the villas, the round hills behind
  ['F2', 1.5, -51.5, 2.4, 0.6, -0.06, 50, DUSK],            // t1_24: from the corridor's end — the crescent sweeping across, the long villa and the tower house
  ['F3', 2.5, -58.5, 1.8, -0.9, -0.03, 50, DUSK],           // t2_23: the corner villa east of the avenue, the crescent curving away right
  ['F4', 0.5, -44.5, { y: 81 }, 0.08, -0.03, 55, DUSK],     // t1_22: from inside the corridor — up the avenue between the villas
  ['F5', -18.5, -128.5, 1.62, 0.0, 0.08, 55, DUSK],         // t3_07: on the west branch, curving right in front; the terraced round hills behind
  ['F6', 60.5, -160.5, { y: 122 }, 0.45, -0.3, 60, DUSK],   // t3_09: the terraced round hills from above — rings, stairways, villas
  ['F0', 0.5, -60.5, { y: 150 }, 0, -0.62, 70, DUSK],       // the layout from above the plaza
  ['F1_noon', 3.5, -96.5, 1.62, 0.3, 0.03, 60, NOON],
  ['F1_late', 3.5, -96.5, 1.62, 0.3, 0.03, 60, LATE],       // the blue hour (20:15): the frames' starry sky over a lit street
  ['F3_late', 2.5, -58.5, 1.8, -0.9, -0.03, 50, LATE],
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
  const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game, w = g.world; let dirty = 0; for (const c of w.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; const p = g.player, rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0 && i > 2) break; await wait(60); } };
  const shotPath = (name) => `/home/claude/vr/test/shots/trailer_city_${name}_${tag}.png`;
  // the detailed pieces (VX: the palms' crowns, the furniture, the facades' pieces) are uploaded a few sections per drawn
  // frame (renderer.vxResidency); the settling steps draw nothing, so before a picture every section within the detail
  // distance gets its pieces now — run 1's first pictures showed the averaged boxes instead of the crowns
  const warmVx = () => ev(() => {
    const g = VR.game, r = g.renderer, p = g.player; if (!r.vxResidency || !g.world) return -1;
    const cam = [p.pos[0], p.pos[1] + (p.eye || 1.62), p.pos[2]], list = [];
    for (const c of g.world.cols.values()) for (const s of c.sec) if (s && s.hasMesh) list.push(s);
    const D = (r.q && r.q.vxLod) || 48, up2 = D * D; let n = 0;
    for (; n < 600; n++) {
      let wait = 0; for (const s of list) { if (!s.vxData || s.mesh[3]) continue; const dx = s.ox + 8 - cam[0], dy = s.oy + 8 - cam[1], dz = s.oz + 8 - cam[2]; if (dx * dx + dy * dy * 0.5 + dz * dz < up2) wait++; }
      if (!wait) break;
      r.vxResidency(list, cam);
    }
    return n;
  });
  // (the villagers within 12 blocks of the camera are left out of the picture: at dusk they gather on the plaza round the
  //  player and wave into the lens — run 1's F2 and F4)
  const shot = async (name, frames = 4) => { const vx = await warmVx(); await ev((frames) => { window.__norender = false; const g = VR.game, V = g.villages, p = g.player; const keep = V && V.agents ? V.agents : null; if (keep) V.agents = keep.filter(a => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) > 12); for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); if (keep) V.agents = keep; window.__norender = true; }, frames); await page.screenshot({ path: shotPath(name), timeout: 180000 }); const ok = fs.existsSync(shotPath(name)); console.log('shot', name, tag, ok ? '' : '(missing)', 'vx warm rounds', vx); return ok; };
  // (settled: no job, no column waiting, no section to mesh, no upload waiting in the streaming queue, no column still
  //  fading in, and every column within the render distance shown — runs 2 and 3: the first two or three pictures after
  //  the world's load caught ring 1's forms still standing in for near columns the world had not asked for yet)
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
  // (a first visit to the first camera without a picture: the world, the far ring and the horizon settle there once)
  { const s0 = SHOTS.find(s => !ONLY || ONLY.some(o => s[0] === o || s[0].startsWith(o + '_'))); if (s0) { await place(s0[1], s0[2], s0[3], s0[4], s0[5], s0[6], s0[7]); await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 6; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } window.__norender = true; }); await wait(1500); await settle(40); } }
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
      return { lineF1: count(3, -100, 12, 76, 88, /^vx_floor_plaza_line$/), amber: count(0, -75, 30, 76, 88, /^vx_floor_plaza_line_amber$/), window: count(0, -85, 40, 80, 104, /^vx_nova_window$/), bed: count(0, -122, 6, 80, 84, /^podzol$/) };
    });
    console.log(tag, 'probe', JSON.stringify(probe));
    check(probe.lineF1 >= 10 && probe.amber >= 1 && probe.window >= 20 && probe.bed >= 10, `${tag}: the city stands at the cameras (light-line cells by the F1 road ${probe.lineF1}, amber accents near the plaza ${probe.amber}, nova window cells ${probe.window}, the island's tip bed ${probe.bed})`);
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
