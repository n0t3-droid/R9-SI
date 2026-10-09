// A living world without combat (docs/superpowers/plans/2026-10-09-t-life.md): the game's pictures of four scenes, one
// page per build — BEFORE_DIST (the build before t-life) as test/shots/life_<scene>_before.png, then this checkout's
// dist as …_<TAG>.png (TAG default after):
//   hangar      the owner's view of the Gate Temple (feet at −42, 89, 26, looking at the portal): a craft parked on the
//               apron with its crew, the hangar's shuttle on its pad, a second one holding over the canyon
//   plaza_dusk  Nova Haven's arrival plaza at dusk (time 12600): the lantern lighter lights the lamps one by one
//   street_noon the Weißstadt's street at noon (seed 53, cell −2,−1; time 6000): pigeons on the plaza, a hover-cart
//   hills       the Pod Hills in the morning (time 4500): the hot-air balloon over the terraces
// Per scene the actors in view are counted (sky craft, pad craft, hangar craft, crew, the director's acts, particles);
// at the plaza the sky craft within 550 blocks are sampled once a second for 60 s of game time (the owner: "immer etwas
// los"; after: never fewer than one). The Very Low cost (ms per frame, draws) is measured at the hangar view and at the
// plaza, and the High cost at the hangar view (swiftshader: compare the two builds of one run, never absolute numbers).
// Checks: every picture written, no page error; on the after build the apron has a craft parked with its crew out, the
// lantern lighter has lit lamps, the pigeons and the cart are there, the balloon flies, and the plaza's sky is never
// empty of craft.
// usage: BEFORE_DIST=file:///…/index.html TAG=after nohup bash test/wt_run.sh life.mjs 3600 > .tmp_tests/life.log 2>&1 &
//   NO_AFTER=1 (only the BEFORE_DIST page) · ONLY=hangar,hills · N=8 frames per cost round · NOCOST=1 · SEED=53
// regress: skip  (a showcase with two world loads; the gates are test/life_sched.js, life_director.js, life_peace.js)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const TAG = process.env.TAG || 'after', N = +(process.env.N || 8), SEED = process.env.SEED || '53';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const RUNS = [];
if (process.env.BEFORE_DIST) RUNS.push(['before', process.env.BEFORE_DIST]);
if (!process.env.NO_AFTER) RUNS.push([TAG, process.env.DIST || 'file:///home/claude/vr/dist/index.html']);
// the hall city of seed 53 (cell −2, −1): its centre, its floor F (gen_hallcity.js plan.hall), frame r = 3: world = (cx + v, cz − u)
const HALL = { cx: -944, cz: -296, F: 73 };
// [name, feet [x, y, z] (y null: on the ground + up), look-at [x, y, z] (y null: the ground there + up), time, fov, force]
const SCENES = [
  { name: 'hangar', feet: [-42, 89, 26], at: [0.5, 87, 20], tod: 4000, fov: 74 },
  { name: 'plaza_dusk', feet: [-8, 82.5, -52], at: [6, 82.6, -80], tod: 12600, fov: 72, force: ['lanterns'] },
  { name: 'street_noon', feet: [HALL.cx - 24.5, HALL.F + 1, HALL.cz - 0.5], at: [HALL.cx + 40, HALL.F + 9, HALL.cz - 0.5], tod: 6000, fov: 66, force: ['pigeons', 'cart'] },
  { name: 'hills', feet: [30, null, -196], up: 14, at: [0, null, -330], atUp: 34, tod: 4500, fov: 70, force: ['balloon'] },
];
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const counts = {}, costs = {}, skies = {};
for (const [tag, dist] of RUNS) await runPage(tag, dist);
for (const k of Object.keys(counts)) console.log(`counts ${k}: ${JSON.stringify(counts[k])}`);
for (const k of Object.keys(costs)) console.log(`costs ${k}: ${JSON.stringify(costs[k])}`);
for (const k of Object.keys(skies)) console.log(`sky craft over the plaza ${k}: ${JSON.stringify(skies[k])}`);
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

async function runPage(tag, dist) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
  await page.goto(dist);
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  // the game loop by hand: dt per step, no picture drawn (the camera is still set up, so the frustum is right)
  const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
  const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game, w = g.world; let dirty = 0; for (const c of w.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0 }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && s.up === 0 && i > 2) break; await wait(60); } };
  const shotPath = (name) => `/home/claude/vr/test/shots/life_${name}_${tag}.png`;
  const shot = async (name, frames = 4) => {
    await ev((frames) => { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, frames);
    for (let t = 1; ; t++) { try { await page.screenshot({ path: shotPath(name), timeout: 180000 }); break; } catch (e) { console.log(`  screenshot ${name} try ${t} failed: ${String(e.message).split('\n')[0]}`); if (t >= 2) break; await wait(3000); } }
    const ok = fs.existsSync(shotPath(name)); console.log('shot', name, tag, ok ? '' : '(missing)'); return ok;
  };
  const groundY = (x, z, y0) => ev(([x, z, y0]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = y0; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & F.OPAQUE) && !(R.T.flags[s] & F.LEAVES)) return y; } return 70; }, [x, z, y0]);
  // the actors in view (the same counter on both builds: what a build does not have counts 0)
  const count = () => ev(() => {
    const g = VR.game, r = g.renderer, p = g.player, cam = g.cam || { x: p.pos[0], y: p.pos[1] + 1.62, z: p.pos[2] };
    const inView = (q, rad) => { const dx = q[0] - cam.x, dy = q[1] - cam.y, dz = q[2] - cam.z; return !r.planes || VR.mat4.boxInFrustum(r.planes, dx - rad, dy - rad, dz - rad, dx + rad, dy + rad, dz + rad); };
    let sky = 0, skyView = 0;
    for (const s of (g.traffic ? g.traffic.ships : [])) { if (s.t < 0 || s.dead || s.dock) continue; const d = Math.hypot(s.pos[0] - cam.x, s.pos[2] - cam.z); if (d < 550 && (s.alpha === undefined || s.alpha > 0.5)) { sky++; if (inView(s.pos, 12)) skyView++; } }
    let dock = 0; for (const s of (g.traffic ? g.traffic.ships : [])) if (s.dock && !s.dead && s.t >= 0) dock++;
    const pad = g.padLife && g.padLife.stats ? g.padLife.stats() : null;
    const hf = g.hall && g.hall.flight;
    const hang = hf ? (hf.crafts ? hf.crafts.filter(c => c.on).length : (hf.active ? 1 : 0)) : 0;
    const life = g.lifeDirector && g.lifeDirector.stats ? g.lifeDirector.stats() : null;
    const vil = g.villages ? g.villages.agents.filter(a => a.drawn).length : 0;
    return { sky, skyInView: skyView, dock, pad, hangarCraft: hang, life, particles: g.particles ? g.particles.n : 0, villagersDrawn: vil, difficulty: g.difficulty };
  });
  // the sky craft within 550 blocks of the eye, once a second for `sec` seconds of game time
  const skySample = async (sec) => { const n = []; for (let i = 0; i < sec; i++) { await step(30); n.push((await count()).sky); } return { min: Math.min(...n), mean: +(n.reduce((a, b) => a + b, 0) / n.length).toFixed(2), max: Math.max(...n), zeroSeconds: n.filter(v => v === 0).length }; };
  // the frame cost: n frames drawn, 3 rounds, the median round (ms per frame, draws)
  const measure = async (n) => {
    const rounds = [];
    for (let k = 0; k < 3; k++) {
      rounds.push(await ev((n) => new Promise((ok) => {
        const g = VR.game, gl = g.renderer.gl; window.__norender = false;
        let k = -2, sum = 0, d = 0;
        const f = () => { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); const dt = performance.now() - t0; if (k < 0) { k++; setTimeout(f, 0); return; } const st = g.renderer.stats || {}; sum += dt; d += st.draws || 0; if (++k < n) setTimeout(f, 0); else { window.__norender = true; ok({ ms: +(sum / n).toFixed(1), draws: Math.round(d / n) }); } };
        f();
      }), n));
    }
    rounds.sort((a, b) => a.ms - b.ms);
    return Object.assign({ rounds: rounds.map(r => r.ms) }, rounds[1]);
  };
  const place = async (sc) => {
    let feet = sc.feet.slice(), at = sc.at.slice();
    await ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 140, z); }, [feet[0], feet[2]]);
    await settle(40);
    if (feet[1] === null) feet[1] = (await groundY(feet[0], feet[2], 160)) + 1 + (sc.up || 0);
    if (at[1] === null) at[1] = (await groundY(at[0], at[2], 180)) + 1 + (sc.atUp || 0);
    const eye = feet[1] + 1.62, dx = at[0] - feet[0], dz = at[2] - feet[2];
    const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(at[1] - eye, Math.hypot(dx, dz));
    await ev(([f, yaw, pitch, fov, tod]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(f[0], f[1], f[2]); p.yaw = yaw; p.pitch = pitch; p.fovKick = 0; p.vel = [0, 0, 0]; g.settings.fov = fov; g.env.setTime(tod); }, [feet, yaw, pitch, sc.fov, sc.tod]);
    await settle(50); await step(10);
    return { feet, at };
  };
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.horizon = 1; g.applySettings('*'); });
  await ev(`VR.game.createWorld({name:'Lebendig',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
  for (let i = 0; i < 120; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  check(await ev(() => VR.game.state) === 'play', `${tag}: the world is loaded`);
  await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } });
  const has = await ev(() => ({ pad: !!VR.game.padLife, dir: !!VR.game.lifeDirector, hold: !!(VR.game.hall && VR.game.hall.flight && VR.game.hall.flight.crafts) }));
  console.log(tag, 'features', JSON.stringify(has));
  let pics = 0, want = 0;
  for (const sc of SCENES) {
    if (ONLY && !ONLY.includes(sc.name)) continue;
    want++;
    const pl = await place(sc);
    console.log(`  ${sc.name}: feet ${pl.feet.map(v => +v.toFixed(1))} looking at ${pl.at.map(v => +v.toFixed(1))} tod ${sc.tod}`);
    // the after build: the scene's moment (the apron's visit with the crew out, the hangar's craft on the pad and the second
    // one holding; the director's acts of the scene started where the camera looks)
    if (sc.name === 'hangar') await ev(() => { const g = VR.game; if (g.padLife && g.padLife.jump) g.padLife.jump('apron', 'crew'); if (g.hall && g.hall.flight && g.hall.flight.jumpPhase) g.hall.flight.jumpPhase('pad'); });
    if (sc.force) await ev(([kinds, at]) => { const g = VR.game; if (!g.lifeDirector || !g.lifeDirector.force) return; for (const k of kinds) g.lifeDirector.force(k, { look: at }); }, [sc.force, pl.at]);
    await step(sc.name === 'plaza_dusk' ? 260 : 90);   // the lighter has walked a few lamps, the cart rolls into view, the crew is out
    const c = await count(); counts[`${sc.name}/${tag}`] = c;
    console.log(`  ${sc.name} ${tag}: ${JSON.stringify(c)}`);
    if (await shot(sc.name)) pics++;
    if (has.pad && sc.name === 'hangar') {
      const p = c.pad || {};
      check(p.parked >= 1 && p.crew >= 2, `${tag}: a craft stands on the apron with its crew out (parked ${p.parked}, crew ${p.crew}, drones ${p.drones})`);
    }
    if (has.dir && sc.name === 'plaza_dusk') check(c.life && c.life.kinds && c.life.kinds.lanterns && c.life.lit >= 2, `${tag}: the lantern lighter has lit lamps one by one (${c.life && c.life.lit} lit of ${c.life && c.life.lamps})`);
    if (has.dir && sc.name === 'street_noon') check(c.life && c.life.kinds && c.life.kinds.pigeons && c.life.kinds.cart, `${tag}: pigeons and a cart in the street (${JSON.stringify(c.life && c.life.kinds)})`);
    if (has.dir && sc.name === 'hills') check(c.life && c.life.kinds && c.life.kinds.balloon, `${tag}: the balloon flies over the hills (${JSON.stringify(c.life && c.life.kinds)})`);
    if (sc.name === 'plaza_dusk') {
      skies[tag] = await skySample(60);
      console.log(`  sky craft over the plaza (${tag}, 60 s): ${JSON.stringify(skies[tag])}`);
      if (has.pad) check(skies[tag].min >= 1, `${tag}: the plaza's sky always has a craft in it (min ${skies[tag].min}, mean ${skies[tag].mean})`);
    }
  }
  check(pics === want && want > 0, `${tag}: every picture is written (${pics} of ${want})`);
  // the costs: Very Low at the hangar view and the plaza, High at the hangar view
  if (!process.env.NOCOST && (!ONLY || ONLY.includes('hangar'))) {
    const C = costs[tag] = {};
    for (const [preset, scs] of [['potato', ['hangar', 'plaza_dusk']], ['high', ['hangar']]]) {
      await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.horizon = 1; g.applySettings('*'); }, preset);
      for (const name of scs) {
        const sc = SCENES.find(s => s.name === name);
        await place(sc);
        if (name === 'hangar') await ev(() => { const g = VR.game; if (g.padLife && g.padLife.jump) g.padLife.jump('apron', 'crew'); });
        await step(30);
        C[preset + '/' + name] = await measure(N);
        console.log(`  cost ${tag} ${preset} ${name}: ${JSON.stringify(C[preset + '/' + name])} counts ${JSON.stringify(await count())}`);
      }
    }
  }
  const errs = logs.filter(l => /pageerror|TypeError|ReferenceError/.test(l));
  if (errs.length) console.log(errs.slice(0, 6).join('\n'));
  check(!errs.length, `${tag}: no page error (${errs.length})`);
  await ctx.close();
}
