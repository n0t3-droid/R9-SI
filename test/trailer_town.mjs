// Weißstadt, the hall city (docs/refs/weissstadt/*: the owner's reference pictures; plan
// docs/superpowers/plans/2026-10-08-t-town.md): the game's picture of every view of the references at the same world
// cameras, one page per build — BEFORE_DIST (an earlier build: the v042 village at the same site) as
// test/shots/trailer_town_<shot>_before.png, then this checkout's dist as …_<TAG>.png (TAG default after):
//   P1  innenstadt_full.jpg  the plaza at eye height: the fountain in the centre, shop fronts left and right, the vault
//       above (P1_dusk at dusk, P1_potato on Very Low)
//   P2  v3_05.jpg  a shop street along the nave, toward the hall's entrance end (P2_dusk)
//   P3  hall_full.jpg (left)  the market side aisle: stalls with awnings, barrels and crates, the arcade, the windows
//   P4  hall_full.jpg (centre)  the apse with the grand staircase and the balustraded gallery
//   P5  the hall from outside: its long wall, a gate and the tall windows
//   P6  a house close-up: arched windows, the awning over the storefront, the sign, flower boxes
//   P0  the hall from above its entrance end (the layout)
// The cameras are in the hall's own frame (u across, v along the nave from the plaza at the site's centre; the apse at
// +v): the frame of the site is r = (site.seed >>> 3) & 3, the same in both builds, so a before and an after picture show
// the same place. 14:00 is time 8000, dusk 13000; seed 53, the meadow site of cell (-2, -1), the High preset, no HUD.
// The villagers in view at P1 are counted (the owner: the villages were crowded), and the Very Low cost is measured at P1
// (ms per frame, draws and triangles over N frames; swiftshader: compare the two builds of one run, not absolute numbers).
// Checks: every picture written, no page error; on a vgen-9 build the site is a hall city, the hall stands at the
// cameras (glass in the vault over the street, the fountain at the plaza, lamps along the street), the plaza is bright
// (sky light through the glass), and the villagers in view at P1 stay within the town's budget.
// usage: BEFORE_DIST=file:///…/index.html TAG=after bash test/wt_run.sh trailer_town.mjs 3600
//   ONLY=P1,P2 (shot names) · NO_AFTER=1 (only the BEFORE_DIST page) · N=8 frames per cost round · SEED=53 · CELL=-2,-1
// regress: skip  (a showcase with two world loads; the gate is test/hallcity.js)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const TAG = process.env.TAG || 'after', N = +(process.env.N || 8), SEED = process.env.SEED || '53';
const CELL = (process.env.CELL || '-2,-1').split(',').map(Number);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const DAY = 8000, DUSK = 13000;
const RUNS = [];
if (process.env.BEFORE_DIST) RUNS.push(['before', process.env.BEFORE_DIST]);
if (!process.env.NO_AFTER) RUNS.push([TAG, process.env.DIST || 'file:///home/claude/vr/dist/index.html']);
// [name, u, v, eye (above the floor; {up: n} above the outside ground), look-at [u, v, height above the floor], fov, time]
const SHOTS = [
  ['P1', 0.5, -24.5, 1.62, [0.5, 40, 8], 66, DAY],         // innenstadt_full.jpg: the fountain ahead, shop fronts both sides, the vault
  ['P2', -1.5, 36.5, 1.62, [0, -80, 9], 60, DAY],          // v3_05.jpg: the shop street along the nave toward the entrance end
  ['P3', 36.5, -62.5, 1.62, [36, 50, 5], 60, DAY],         // hall_full.jpg left: the market aisle
  ['P4', 0.5, 26.5, 1.62, [0, 72, 12], 64, DAY],           // hall_full.jpg centre: the grand staircase, the gallery
  ['P5', 104.5, -34.5, { up: 6 }, [47, 0, 14], 60, DAY],   // outside: the long wall, a gate, the windows
  ['P6', -1.5, -44.5, 1.62, [8, -44, 5], 60, DAY],         // a house close-up
  ['P0', 0.5, -150.5, { up: 60 }, [0, 0, 10], 66, DAY],    // the layout from above the entrance end
  ['P1_dusk', 0.5, -24.5, 1.62, [0.5, 40, 8], 66, DUSK],
  ['P2_dusk', -1.5, 36.5, 1.62, [0, -80, 9], 60, DUSK],
];
const ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const costs = {}, folk = {};
for (const [tag, dist] of RUNS) await runPage(tag, dist);
if (costs.before && costs[TAG]) console.log(`very low at P1: before ${JSON.stringify(costs.before)} · ${TAG} ${JSON.stringify(costs[TAG])}`);
if (folk.before && folk[TAG]) console.log(`villagers at P1: before ${JSON.stringify(folk.before)} · ${TAG} ${JSON.stringify(folk[TAG])}`);
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
  const shotPath = (name) => `/home/claude/vr/test/shots/trailer_town_${name}_${tag}.png`;
  // the detailed pieces within the detail distance are uploaded before a picture (the settling steps draw nothing)
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
  // the villagers in the picture (after a drawn frame): in the view (the renderer's frustum, within the folk distance),
  // and the ones drawn — the street's budget draws the nearest outdoor ones up to the preset's cap (src/shared/folkcrowd.js)
  const inView = () => ev(() => {
    const g = VR.game, V = g.villages, p = g.player; if (!V || !V.agents) return { agents: 0, inView: 0, drawn: 0 };
    const C = VR.Crowd, cap = C.streetCap(g.settings && g.settings.preset);
    let vis = 0, out = 0, ind = 0, near = 0;
    for (const a of V.agents) {
      if (!a.vis) continue; vis++;
      if (Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) < 24) near++;
      if (a.pose === 'sleep' || (a.act && C.INDOOR[a.act.type])) ind++; else out++;
    }
    return { agents: V.agents.length, inView: vis, drawn: Math.min(out, cap) + ind, cap, near };
  });
  const shot = async (name, frames = 4) => { const vx = await warmVx(); await ev((frames) => { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, frames); for (let t = 1; ; t++) { try { await page.screenshot({ path: shotPath(name), timeout: 180000 }); break; } catch (e) { console.log(`  screenshot ${name} try ${t} failed: ${String(e.message).split('\n')[0]}`); if (t >= 2) break; await wait(3000); } } const ok = fs.existsSync(shotPath(name)); console.log('shot', name, tag, ok ? '' : '(missing)', 'vx warm rounds', vx); return ok; };
  // the top of the solid ground under (x, z) from y0 down: the highest opaque block that is not leaves
  const groundY = (x, z, y0) => ev(([x, z, y0]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = y0; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & F.OPAQUE) && !(R.T.flags[s] & F.LEAVES)) return y; } return 70; }, [x, z, y0]);
  const place = async (x, z, feet, yaw, pitch, fov, tod) => {
    await ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 140, z); }, [x, z]);
    await settle(40);
    if (typeof feet === 'function') feet = await feet();
    await ev(([x, y, z, yaw, pitch, fov, tod]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = yaw; p.pitch = pitch; p.fovKick = 0; p.vel = [0, 0, 0]; g.settings.fov = fov; g.env.setTime(tod); const e = g.entities; if (e && e.mobs) e.mobs.length = 0; }, [x, feet, z, yaw, pitch, fov, tod]);
    await settle(50); await step(6);
    return feet;
  };
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.horizon = 1; g.applySettings('*'); });
  await ev(`VR.game.createWorld({name:'Weissstadt',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
  for (let i = 0; i < 120; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  check(await ev(() => VR.game.state) === 'play', `${tag}: the world is loaded`);
  await ev((tod) => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } g.env.setTime(tod); }, DAY);
  // the site and its frame (the plan's hall record on a build that has hall cities)
  const site = await ev((cell) => {
    const W = VR.game.world, VG = VR.VillageGen, og = new VR.OverworldGen(W.seed, W.genOpts);
    const s = VG.site(og, cell[0], cell[1]); if (!s) return null;
    const P = VG.plan(og, s), h = P.hall || null;
    return { vgen: W.genOpts.vgen || 0, id: s.id, style: s.style, x: s.x, z: s.z, y: s.y, seed: s.seed, r: (s.seed >>> 3) & 3, homes: P.homes.length, plaza: P.plaza, hall: h ? { F: h.F, r: h.r, cx: h.cx, cz: h.cz } : null, folkCap: P.folkCap || null };
  }, CELL);
  console.log(tag, 'site', JSON.stringify(site));
  check(!!site, `${tag}: the site of cell ${CELL} exists`);
  if (!site) { await ctx.close(); return; }
  if (site.vgen >= 9) check(!!site.hall && site.style === 'hall', `${tag}: the site is a hall city (style ${site.style})`);
  const r = site.hall ? site.hall.r : site.r, cx = site.x, cz = site.z, F = site.hall ? site.hall.F : null;
  const W2 = (u, v) => { const q = ROT[r](u, v); return [cx + q[0], cz + q[1]]; };
  await settle(60);
  let pics = 0, want = 0;
  const camOf = async (s) => {
    const [name, u, v, eye, tgt, fov, tod] = s;
    const [x, z] = W2(u, v), [tx, tz] = W2(tgt[0], tgt[1]);
    const inside = typeof eye === 'number';
    // feet: on the hall's floor inside it (a build with hall cities), else on the ground (outside, or the before build's village)
    const feet = async () => inside && F !== null ? F + 1 : (await groundY(x, z, 140)) + 1 + (inside ? 0 : eye.up);
    const ty = (F !== null ? F + 1 : site.y + 1) + tgt[2];
    return { name, x, z, feet, tx, tz, ty, fov, tod, eye: inside ? eye : 1.62 };
  };
  const aim = (c, feet) => { const dx = c.tx - c.x, dz = c.tz - c.z, dy = c.ty - (feet + c.eye); return [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))]; };
  // (a first visit to the first camera without a picture: the world, the far ring and the horizon settle there once)
  { const c = await camOf(SHOTS[0]); const f0 = await place(c.x, c.z, c.feet, 0, 0, c.fov, c.tod); const [yaw, pitch] = aim(c, f0); await ev(([y, p]) => { const pl = VR.game.player; pl.yaw = y; pl.pitch = p; }, [yaw, pitch]); await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 6; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } window.__norender = true; }); await wait(1500); await settle(40); }
  for (const s of SHOTS) {
    if (ONLY && !ONLY.some(o => s[0] === o || s[0].startsWith(o + '_'))) continue;
    want++;
    const c = await camOf(s);
    const feet0 = await place(c.x, c.z, c.feet, 0, 0, c.fov, c.tod);
    const [yaw, pitch] = aim(c, feet0);
    await ev(([y, p]) => { const pl = VR.game.player; pl.yaw = y; pl.pitch = p; }, [yaw, pitch]);
    await step(4);
    console.log(`  ${c.name}: feet ${feet0} at (${c.x}, ${c.z}) yaw ${yaw.toFixed(2)} pitch ${pitch.toFixed(2)} fov ${c.fov} tod ${c.tod}`);
    if (await shot(c.name)) pics++;
    if (c.name === 'P1' || c.name === 'P1_dusk') { const f = await inView(); console.log(`  villagers at ${c.name}: ${JSON.stringify(f)}`); if (c.name === 'P1') folk[tag] = f; }
  }
  check(pics === want && want > 0, `${tag}: every picture is written (${pics} of ${want})`);
  // the hall at the cameras (a vgen-9 build): glass in the vault over P1, the fountain at the plaza, lamps along the street,
  // and the plaza bright with sky light through the glass
  if (site.hall) {
    const probe = await ev(([cx, cz, r, F]) => {
      const w = VR.game.world, R = VR.R, nm = (s) => s ? R.types[R.T.type[s]].name : 'air';
      const ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
      const at = (u, v) => { const q = ROT[r](u, v); return [cx + q[0], cz + q[1]]; };
      let glass = 0, fountain = 0, lamps = 0;
      for (let v = -30; v <= -18; v++) { const [x, z] = at(1, v); for (let y = F + 20; y <= F + 44; y++) if (/glass/.test(nm(w.getBlock(x, y, z)))) { glass++; break; } }
      for (let du = -2; du <= 2; du++) for (let dv = -2; dv <= 2; dv++) { const [x, z] = at(du, dv); for (let y = F + 1; y <= F + 6; y++) if (/fountain/.test(nm(w.getBlock(x, y, z)))) fountain++; }
      for (let v = -60; v <= -14; v++) for (const u of [-4, -3, 3, 4]) { const [x, z] = at(u, v); for (let y = F + 1; y <= F + 3; y++) if (/lamp/.test(nm(w.getBlock(x, y, z)))) lamps++; }
      // the sky light at eye height over the street and the plaza (the best of five cells, and the column's story if it is low)
      const cells = [[0, -24], [0, -8], [6, -6], [-6, 6], [2, -40]].map(([u, v]) => { const [x, z] = at(u, v), c = w.col(x >> 4, z >> 4); return { u, v, sky: w.getLight(x, F + 2, z) >>> 12, ready: !!c, top: (() => { for (let y = F + 44; y > F; y--) { const b = w.getBlock(x, y, z); if (b) return (y - F) + ':' + nm(b) + ':' + (w.getLight(x, y - 1, z) >>> 12); } return 'none'; })() }; });
      const sky = Math.max(...cells.map(c => c.sky));
      return { glass, fountain, lamps, sky, cells };
    }, [cx, cz, r, F]);
    console.log(tag, 'probe', JSON.stringify(probe));
    check(probe.glass >= 8 && probe.fountain >= 1 && probe.lamps >= 4, `${tag}: the hall stands at the cameras (vault glass over the street at ${probe.glass} of 13 cells, fountain cells ${probe.fountain}, lamp cells along the street ${probe.lamps})`);
    check(probe.sky >= 12, `${tag}: the plaza is bright (sky light ${probe.sky} of 15 at eye height)`);
    if (folk[tag] && site.folkCap) check(folk[tag].drawn <= folk[tag].cap + 4 && folk[tag].agents <= site.folkCap.max, `${tag}: the town's people fit its budget (${folk[tag].agents} ≤ ${site.folkCap.max}) and at most the street's cap of them are drawn at P1 (${folk[tag].drawn} of ${folk[tag].inView} in view, cap ${folk[tag].cap})`);
  }
  // the Very Low (potato) preset at P1: its picture and its frame cost
  if (!ONLY || ONLY.includes('P1')) {
    try {
      await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
      const c = await camOf(SHOTS[0]);
      const feet0 = await place(c.x, c.z, c.feet, 0, 0, c.fov, DAY);
      const [yaw, pitch] = aim(c, feet0);
      await ev(([y, p]) => { const pl = VR.game.player; pl.yaw = y; pl.pitch = p; }, [yaw, pitch]);
      await settle(80);
      if (await shot('P1_potato', 16)) console.log('  P1_potato written');
      const rounds = [];
      for (let k = 0; k < 3; k++) {
        await ev(() => { window.__norender = false; });
        rounds.push(await ev((n) => new Promise((ok, no) => { const g = VR.game, gl = g.renderer.gl; let k = -2, sum = 0, d = 0, t = 0; const f = () => { try { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); const dt = performance.now() - t0; if (k < 0) { k++; setTimeout(f, 0); return; } const st = g.renderer.stats || {}; sum += dt; d += st.draws || 0; t += st.tris || 0; if (++k < n) setTimeout(f, 0); else ok({ ms: +(sum / n).toFixed(1), draws: Math.round(d / n), tris: Math.round(t / n) }); } catch (e) { no(String(e)); } }; f(); }), N));
        await ev(() => { window.__norender = true; });
      }
      const ms = rounds.map(q => q.ms).sort((a, b) => a - b);
      costs[tag] = { msMedian: ms[1], ms, draws: rounds[1].draws, tris: rounds[1].tris };
      console.log(`measure ${tag} potato at P1: ${JSON.stringify(costs[tag])}`);
    } catch (e) { console.log(`measure ${tag} failed: ${String(e.message || e).slice(0, 200)}`); }
  }
  const errs = logs.filter(l => l.startsWith('[pageerror]'));
  console.log(`--- ${tag} logs (${logs.length})`); for (const l of logs.slice(0, 12)) console.log(l);
  check(errs.length === 0, `${tag}: no page error (${errs.length})`);
  await ctx.close();
}
