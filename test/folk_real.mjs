// t-folk (the owner: „natürlich keine Lego-Villagers, wir wollen schon Realismus"): the people in the game, before and
// after — one page per build, BEFORE_DIST (an earlier build: the old rig, its block people) and this checkout's dist,
// both on Balanced (the smooth people's tier; the pictures at the trailer's places):
//   street    a village street (the taiga village of cell 0,1, its plaza, the fountain behind them): five villagers — a
//             farmer, a child, a gardener, a crafter, an elder — standing 3 to 6 blocks before the eye, looking at it —
//             test/shots/folk_real_street_<tag>.png (and, after, the same with Echte Menschen off: the new proportions as
//             voxels, what Very Low and Low draw — folk_real_street_vox_<tag>.png)
//   portrait  two people two blocks before the eye in the hall city's street (a Weißstadt coat, a village farmer) —
//             folk_real_portrait_<tag>.png
//   P1        the hall city's street at eye height (seed 53, vgen 9, the Weißstadt of cell -2,-1; the camera of
//             test/trailer_town.mjs P1) with its own people going about their day — folk_real_P1_<tag>.png
//   crowd     forty Weißstadt people in view, 4 to 20 blocks before the eye at P1 — folk_real_crowd_<tag>.png
// and the costs (swiftshader on a shared machine: compare within one page, rounds interleaved so the machine's load
// drifts out): the forty on Balanced — the frame without the people, with them as voxels (Echte Menschen off) and smooth
// (on), three rounds each, interleaved; the villagers' draw time, draws and triangles; the frame's other parts (the
// water's mirror, the props, the mobs, the hall, the crowd, the ships) to see where a slow frame goes — and on Very Low
// against BEFORE_DIST (the villagers' own cost: their draw time and triangles, the frame reported); the smooth meshes'
// build (main thread) and worker time a person, their memory.
// Checks: every picture written, no page error, the smooth people drawn (the five, the two, the forty), the smooth crowd in
// fewer draws, the meshes within their budget, Very Low's villagers not costlier than before.
// usage: BEFORE_DIST=file:///…/.tmp_tests/dist_before/index.html bash test/wt_run.sh folk_real.mjs 5400
//   N=4 frames a cost round · NO_AFTER=1 · TAG=after · DIST=file:///… (another build than this checkout's dist)
// regress: skip  (a showcase with two world loads; the gate is test/folk_real.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const TAG = process.env.TAG || 'after', N = +(process.env.N || 4), SEED = '53';
const DAY = 8000, RD = 7;
const RUNS = [];
if (process.env.BEFORE_DIST) RUNS.push(['before', process.env.BEFORE_DIST]);
if (!process.env.NO_AFTER) RUNS.push([TAG, process.env.DIST || 'file:///home/dev/vr/dist/index.html']);
const ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const costs = {};
for (const [tag, dist] of RUNS) { try { await runPage(tag, dist); } catch (e) { fails++; console.log(`  ✗ ${tag}: the page failed: ${String(e && e.stack || e).slice(0, 600)}`); } }
if (costs.before && costs[TAG] && costs.before.potato && costs[TAG].potato) {
  // Very Low: the villagers' own cost (their draw's time on the main thread and their triangles) — the frame's time is
  // reported (two pages minutes apart on a shared machine: its load is not the same)
  const b = costs.before.potato, a = costs[TAG].potato;
  check(a.voxel.folk <= b.voxel.folk * 1.15 + 0.3 && a.voxel.folkTris <= b.voxel.folkTris, `Very Low, the forty in view: the villagers' draw ${a.voxel.folk} ms and ${a.voxel.folkTris} triangles against ${b.voxel.folk} ms and ${b.voxel.folkTris} before (the frame ${a.voxel.ms} ms against ${b.voxel.ms}; without the people ${a.none.ms} against ${b.none.ms})`);
}
console.log('costs ' + JSON.stringify(costs));
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
  // (→ the last state seen and the rounds it took: a place not settled within `max` rounds is logged, not hidden)
  const settle = async (max = 60) => { let s = null, i = 0; for (; i < max; i++) { await step(10); s = await ev(() => { const g = VR.game, w = g.world; let dirty = 0; for (const c of w.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; const p = g.player, rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0 && i > 2) break; await wait(60); } return Object.assign({ rounds: i }, s); };
  const shotPath = (name) => `/home/dev/vr/test/shots/folk_real_${name}_${tag}.png`;
  const warmVx = () => ev(() => {
    const g = VR.game, r = g.renderer, p = g.player; if (!r.vxResidency || !g.world) return -1;
    const cam = [p.pos[0], p.pos[1] + (p.eye || 1.62), p.pos[2]], list = [];
    for (const c of g.world.cols.values()) for (const s of c.sec) if (s && s.hasMesh) list.push(s);
    const D = (r.q && r.q.vxLod) || 48, up2 = D * D; let n = 0;
    for (; n < 600; n++) { let w8 = 0; for (const s of list) { if (!s.vxData || s.mesh[3]) continue; const dx = s.ox + 8 - cam[0], dy = s.oy + 8 - cam[1], dz = s.oz + 8 - cam[2]; if (dx * dx + dy * dy * 0.5 + dz * dz < up2) w8++; } if (!w8) break; r.vxResidency(list, cam); }
    return n;
  });
  // the smooth meshes of the people near the eye, asked for all at once and waited for (no frame drawn: the worker
  // answers between the page's tasks) → { asked, ready, inflight, ms } or null without Echte Menschen
  const prewarm = (maxMs = 180000) => ev(async (maxMs) => {
    const g = VR.game, FG = VR.FolkGPU, V = g.villages; if (!FG || !FG.on(g)) return null;
    const P0 = FG.PER_FRAME, I0 = FG.INFLIGHT; FG.PER_FRAME = 1e9; FG.INFLIGHT = 1e9;
    const p = g.player.pos; let asked = 0, near = 0;
    for (const a of V.agents) { if (Math.hypot(a.pos[0] - p[0], a.pos[2] - p[2]) > FG.ASK) continue; near++; const rec = a.fg || (a.fg = FG.recFor(a.p.look)); if (rec.state === 0 && FG.want(g, rec, 0)) asked++; }
    g.world.pool.pump();
    const t0 = performance.now();
    while (FG.inflight > 0 && performance.now() - t0 < maxMs) await new Promise((r) => setTimeout(r, 200));
    FG.PER_FRAME = P0; FG.INFLIGHT = I0;
    let ready = 0; for (const a of V.agents) if (a.fg && a.fg.state === 2 && Math.hypot(a.pos[0] - p[0], a.pos[2] - p[2]) <= FG.ASK) ready++;
    return { near, asked, ready, inflight: FG.inflight, ms: Math.round(performance.now() - t0) };
  }, maxMs);
  const frames = (n) => ev((n) => { window.__norender = false; const g = VR.game; for (let i = 0; i < n; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; const FG = VR.FolkGPU; return FG && FG.on(g) ? FG.stats.drawn : 0; }, n);
  const shot = async (name, n = 3) => { await warmVx(); const sm = await frames(n); for (let t = 1; ; t++) { try { await page.screenshot({ path: shotPath(name), timeout: 240000 }); break; } catch (e) { console.log(`  screenshot ${name} try ${t} failed: ${String(e.message).split('\n')[0]}`); if (t >= 2) break; await wait(3000); } } const ok = fs.existsSync(shotPath(name)); console.log('shot', name, tag, ok ? '' : '(missing)', `smooth people in the frame: ${sm}`); return { ok, smooth: sm }; };
  const groundY = (x, z, y0) => ev(([x, z, y0]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = y0; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & F.OPAQUE) && !(R.T.flags[s] & F.LEAVES)) return y; } return 70; }, [x, z, y0]);
  const place = async (x, z, feet, yaw, pitch, fov) => {
    await ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 140, z); }, [x, z]);
    await settle(40);
    if (typeof feet === 'function') feet = await feet();
    await ev(([x, y, z, yaw, pitch, fov]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = yaw; p.pitch = pitch; p.fovKick = 0; p.vel = [0, 0, 0]; g.settings.fov = fov; g.env.setTime(8000); const e = g.entities; if (e && e.mobs) e.mobs.length = 0; }, [x, feet, z, yaw, pitch, fov]);
    const st = await settle(150); await step(6);
    console.log(`  settled at (${x.toFixed(1)}, ${feet}, ${z.toFixed(1)}): ${JSON.stringify(st)}`);
    return feet;
  };
  // the town's own people out: the villages are polled every 6 s of game time — a teleport outruns that (poll now, step
  // until a town near the eye is active and its people are out, then a second of their day)
  const townOut = async () => {
    let n = 0;
    for (let i = 0; i < 40; i++) {
      n = await ev(() => { const V = VR.game.villages; return V ? V.agents.length : -1; }).catch(() => -1);
      if (n > 0) break;
      await ev(() => { const V = VR.game.villages; V.siteT = 0; V.siteAt = null; });
      await step(20); await wait(250);
    }
    await step(60);
    return n;
  };
  // the staged people: [seed, role, age, style, x, z] put on the floor the eye stands over, standing, looking at the eye;
  // the town's own people and their day held while they stand (a test's stage)
  const stage = (list, eye, floorY) => ev(([list, eye, floorY]) => {
    const g = VR.game, V = g.villages, F = VR.Folk, w = g.world, R = VR.R, Fl = VR.F;
    if (!V._own) { V._own = V.agents; V._upd = V.update; V._bub = V.updateBubbles; }
    // (down from a block over the eye's own floor: an awning or a balcony overhead is not the street)
    const ground = (x, z) => { for (let y = Math.floor(floorY) + 1; y > floorY - 6; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & Fl.SOLID)) return y + 1; } return floorY; };
    const agents = list.map(([seed, role, age, style, x, z], i) => {
      const look = F.look(seed, role, age, null, style), y = ground(x, z);
      const yaw = Math.atan2(-(eye[0] - x), -(eye[2] - z));
      return { pos: [x, y, z], yaw, vel: [0, 0, 0], p: { look, seed, name: role, bed: null, home: 0 }, kid: age === 'child', elder: age === 'elder', walkAmt: 0, walk: 0, pose: 'stand', act: null, bubble: null, headYaw: 0, headPitch: 0, hurt: 0, talkAnim: 0, lookAt: [eye[0], eye[1], eye[2]], w: 0.3, h: 1.75, onGround: true, id: 'stage' + i, blinkT: 99 };
    });
    V._staged = agents; V.update = () => {}; V.updateBubbles = () => {};
    Object.defineProperty(V, 'agents', { get() { return this._staged || this._own; }, set(v) { this._own = v; }, configurable: true });
    return agents.map(a => a.pos[1]);
  }, [list, eye, floorY]);
  const unstage = () => ev(() => { const V = VR.game.villages; if (!V._own) return; const own = V._own; delete V.agents; V.agents = own; V.update = V._upd; V.updateBubbles = V._bub; V._staged = null; V._own = null; });
  const preset = (name) => ev(([name, rd]) => { const g = VR.game; g.applyPreset(name); g.settings.dynRes = false; if (name !== 'potato') { g.settings.renderDist = rd; g.settings.horizon = 1; } g.applySettings('*'); }, [name, RD]);
  // a section of the page on its own: a failure is counted and logged, the stage cleared and Balanced back, and the next
  // section still runs (a browser run is scarce: one broken picture must not cost the others)
  const part = async (name, fn) => {
    try { await fn(); }
    catch (e) {
      fails++; console.log(`  ✗ ${tag}: ${name} failed: ${String(e && e.stack || e).slice(0, 900)}`);
      try { await unstage(); await preset('balanced'); } catch (_) { /* the page is gone */ }
    }
  };
  // one cost round: n frames (after two to warm) in a mode — 'none' the frame without the people's draw, 'voxel' the
  // people as voxels (Echte Menschen off), 'smooth' (on: one draw a person, the bones' matrices indexed in the vertex
  // shader), 'split' (on, a draw a part with its matrix: folkgpu.js FG.SPLIT). → the frame's ms, draws, triangles, the
  // people's draw (ms, draws, triangles), the frame's parts (ms), the smooth people drawn
  const round = (n, mode) => ev(([n, mode]) => new Promise((ok, no) => {
    const g = VR.game, gl = g.renderer.gl, V = g.villages, R = g.renderer, FG = VR.FolkGPU;
    if (FG) { g.settings.smoothFolk = mode === 'smooth' || mode === 'split' ? 1 : 0; FG.SPLIT = mode === 'split'; }
    window.__norender = false;
    const acc = {}, wrapped = [];
    const wrap = (o, name, key) => { if (!o || typeof o[name] !== 'function') return; const f0 = o[name]; o[name] = function (...a) { const t = performance.now(); try { return f0.apply(this, a); } finally { acc[key] = (acc[key] || 0) + performance.now() - t; } }; wrapped.push([o, name, f0]); };
    wrap(R, 'render', 'render'); wrap(R, 'reflectPass', 'mirror'); wrap(R, 'drawProps', 'props'); wrap(g.entities, 'draw', 'mobs'); wrap(g.hall, 'draw', 'hall');
    wrap(VR.Crowd, 'draw', 'crowd'); wrap(g.starships, 'draw', 'ships'); wrap(g.traffic, 'draw', 'traffic'); wrap(g.particles, 'draw', 'particles');
    const vd = V.draw; let inFolk = false;
    V.draw = function (...a) { if (mode === 'none') return; inFolk = true; const t = performance.now(); try { return vd.apply(this, a); } finally { inFolk = false; acc.folk = (acc.folk || 0) + performance.now() - t; } };
    // (every draw call of the frame counted at the context, with its triangles; those inside the villagers' draw apart)
    const cnt = { d: 0, t: 0, fd: 0, ft: 0 }, G0 = {};
    for (const [nm, ti] of [['drawArrays', (m, f, n) => n], ['drawElements', (m, n) => n], ['drawArraysInstanced', (m, f, n, k) => n * k], ['drawElementsInstanced', (m, n, ty, o, k) => n * k]]) {
      G0[nm] = gl[nm]; gl[nm] = function (...a) { const tri = a[0] === gl.TRIANGLES ? ti(...a) / 3 : a[0] === gl.TRIANGLE_STRIP ? Math.max(0, ti(...a) - 2) : 0; cnt.d++; cnt.t += tri; if (inFolk) { cnt.fd++; cnt.ft += tri; } return G0[nm].apply(gl, a); };
    }
    const restore = () => { for (const [o, nm, f0] of wrapped) o[nm] = f0; V.draw = vd; for (const nm in G0) gl[nm] = G0[nm]; window.__norender = true; if (FG) FG.SPLIT = false; };
    let k = -2, sum = 0, d = 0, t = 0, fd = 0, ft = 0;
    const f = () => {
      try {
        if (k === 0) for (const key in acc) acc[key] = 0;
        cnt.d = cnt.t = cnt.fd = cnt.ft = 0;
        const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); const dt = performance.now() - t0;
        if (k < 0) { k++; setTimeout(f, 0); return; }
        sum += dt; d += cnt.d; t += cnt.t; fd += cnt.fd; ft += cnt.ft;
        if (++k < n) { setTimeout(f, 0); return; }
        const parts = {}; for (const key of ['mirror', 'props', 'mobs', 'hall', 'crowd', 'ships', 'traffic', 'particles']) if (acc[key]) parts[key] = +(acc[key] / n).toFixed(1);
        restore();
        ok({ ms: +(sum / n).toFixed(1), draws: Math.round(d / n), tris: Math.round(t / n), folk: +((acc.folk || 0) / n).toFixed(2), folkDraws: Math.round(fd / n), folkTris: Math.round(ft / n), render: +((acc.render || 0) / n).toFixed(1), parts, smooth: (mode === 'smooth' || mode === 'split') && FG ? FG.stats.drawn : 0, particles: g.particles ? g.particles.n : -1 });
      } catch (e) { restore(); no(String(e && e.stack || e)); }
    };
    f();
  }), [n, mode]);
  const median = (rs) => { const out = {}; for (const key of ['ms', 'draws', 'tris', 'folk', 'folkDraws', 'folkTris', 'render', 'smooth', 'particles']) { const v = rs.map(q => q[key]).sort((a, b) => a - b); out[key] = v[(v.length - 1) >> 1]; } out.rounds = rs.map(q => q.ms); out.parts = rs[(rs.length - 1) >> 1].parts; return out; };
  // interleaved rounds of the modes (the machine's load drifts out); → { mode: medians }
  const costRounds = async (modes, rounds = 3) => { const R = {}; for (const m of modes) R[m] = []; for (let k = 0; k < rounds; k++) for (const m of modes) R[m].push(await round(N, m)); const out = {}; for (const m of modes) out[m] = median(R[m]); return out; };

  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await preset('balanced');
  await ev(`VR.game.createWorld({name:'Echte Menschen',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
  for (let i = 0; i < 120; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  check(await ev(() => VR.game.state) === 'play', `${tag}: the world is loaded`);
  await ev((tod) => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } g.env.setTime(tod); }, DAY);
  await preset('balanced');
  const info = await ev(() => ({ smooth: !!VR.FolkGPU, on: VR.FolkGPU ? VR.FolkGPU.on(VR.game) : false, fine: !!(VR.Folk && VR.Folk.buildFine), preset: VR.game.settings.preset, renderDist: VR.game.settings.renderDist }));
  console.log(tag, 'build', JSON.stringify(info));
  const site = await ev(() => {
    const W = VR.game.world, VG = VR.VillageGen, og = new VR.OverworldGen(W.seed, W.genOpts);
    const s = VG.site(og, -2, -1); if (!s) return null;
    const P = VG.plan(og, s), h = P.hall || null;
    const t = VG.site(og, 0, 1), Pt = t ? VG.plan(og, t) : null;
    return { vgen: W.genOpts.vgen || 0, style: s.style, x: s.x, z: s.z, y: s.y, r: (s.seed >>> 3) & 3, hall: h ? { F: h.F, r: h.r } : null, village: t ? { style: t.style, x: t.x, z: t.z, y: t.y, plaza: Pt.plaza || null } : null };
  });
  console.log(tag, 'site', JSON.stringify(site));
  let pics = 0, want = 0;
  // ---------------------------------------------------------------- a village street: five villagers 3–6 blocks before the eye
  await part('the street', async () => { if (site && site.village && site.village.plaza) {
    // (from the plaza's +z side looking −z: the fountain behind the five, the benches and the stalls aside)
    const P = site.village.plaza, vx = P.x + 0.5, vz = P.z + 0.5 + 6;
    const feet = await place(vx, vz, async () => (await groundY(vx, vz, 140)) + 1, 0, 0, 62);
    const yaw = 0;
    await ev(([y]) => { const pl = VR.game.player; pl.yaw = y; pl.pitch = -0.08; }, [yaw]);
    const eye = [vx, feet + 1.62, vz], fx = -Math.sin(yaw), fz = -Math.cos(yaw), sx = Math.cos(yaw), sz = -Math.sin(yaw);
    const five = [[11, 'farmer', 'adult', -1.6, 3.2], [77, 'child', 'child', -0.35, 3.3], [22, 'gardener', 'adult', 0.85, 3.8], [55, 'crafter', 'adult', -1.0, 5.0], [111, 'elder', 'elder', 1.8, 5.6]];
    const ys = await stage(five.map(([seed, role, age, s, d]) => [seed, role, age, null, vx + fx * d + sx * s, vz + fz * d + sz * s]), eye, feet);
    const w = await prewarm();
    console.log(`  street (${site.village.style} at ${P.x}, ${P.z}; the five stand at ${ys.join(', ')}, the eye's floor ${feet}): ${JSON.stringify(w)}`);
    want++; const s1 = await shot('street'); if (s1.ok) pics++;
    if (info.on) check(s1.smooth >= 5, `${tag}: the five on the street drawn smooth (${s1.smooth})`);
    if (info.smooth) {
      await ev(() => { VR.game.settings.smoothFolk = 0; });
      want++; if ((await shot('street_vox')).ok) pics++;
      await ev(() => { VR.game.settings.smoothFolk = 1; });
    }
    await unstage();
  } else check(false, `${tag}: the village of cell 0,1 for the street`); });
  if (!site || !site.hall) { check(false, `${tag}: the hall city of cell -2,-1`); await ctx.close(); return; }
  check(true, `${tag}: the hall city of cell -2,-1`);
  const r = site.hall.r, F = site.hall.F, W2 = (u, v) => { const q = ROT[r](u, v); return [site.x + q[0], site.z + q[1]]; };
  const [px, pz] = W2(0.5, -24.5), [tx, tz] = W2(0.5, 40);
  const aim = (x, z, feet, eyeH, ax, ay, az) => [Math.atan2(-(ax - x), -(az - z)), Math.atan2(ay - (feet + eyeH), Math.hypot(ax - x, az - z))];
  const feet1 = await place(px, pz, F + 1, 0, 0, 66);
  const out = await townOut();
  console.log(`  the hall city's people out: ${out}`);
  // ---------------------------------------------------------------- the portrait: two people two blocks before the eye
  await part('the portrait', async () => {
    const [yaw] = aim(px, pz, feet1, 1.62, tx, F + 1 + 8, tz), eye = [px, feet1 + 1.62, pz];
    await ev(([y]) => { const pl = VR.game.player; pl.yaw = y; pl.pitch = -0.04; }, [yaw]);
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), sx = Math.cos(yaw), sz = -Math.sin(yaw);
    const at = (d, s) => [px + fx * d + sx * s, pz + fz * d + sz * s];
    // (a Weißstadt crafter in a coat — seed 6: a coat in both builds, the hair darker than the skin — and a village farmer)
    const [ax, az] = at(2, -0.42), [bx, bz] = at(2, 0.42);
    await stage([[6, 'crafter', 'adult', 'hall', ax, az], [4242, 'farmer', 'adult', null, bx, bz]], eye, feet1);
    const w = await prewarm();
    console.log(`  portrait: ${JSON.stringify(w)}`);
    want++; const s1 = await shot('portrait'); if (s1.ok) pics++;
    if (info.on) check(s1.smooth >= 2, `${tag}: the two at two blocks drawn smooth (${s1.smooth})`);
    await unstage();
  });
  // ---------------------------------------------------------------- P1: the hall city's street with its own people
  await part('P1', async () => {
    const [yaw, pitch] = aim(px, pz, feet1, 1.62, tx, F + 1 + 8, tz);
    await ev(([y, p]) => { const pl = VR.game.player; pl.yaw = y; pl.pitch = p; }, [yaw, pitch]);
    await step(10);
    const w = await prewarm();
    want++; const s1 = await shot('P1'); if (s1.ok) pics++;
    const p1 = await ev(() => { const g = VR.game, V = g.villages, p = g.player, FG = VR.FolkGPU; let vis = 0, drawn = 0, near = 0; for (const a of V.agents) { if (!a.vis) continue; vis++; if (a.drawn) drawn++; if (Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) < 24) near++; } return { agents: V.agents.length, inView: vis, drawn, near, shadows: FG ? FG.stats.shadows || 0 : 0 }; });
    console.log(`  P1: ${JSON.stringify(p1)}, smooth ${s1.smooth} (prewarm ${JSON.stringify(w)})`);
  });
  // ---------------------------------------------------------------- the forty: costs on Balanced and Very Low
  await part('the forty', async () => {
    await ev(() => { if (VR.Crowd && VR.Crowd.STREET) { VR.Crowd.STREET._cap = VR.Crowd.STREET.capDefault; VR.Crowd.STREET._capP = Object.assign({}, VR.Crowd.STREET.cap); VR.Crowd.STREET.capDefault = 64; for (const k in VR.Crowd.STREET.cap) VR.Crowd.STREET.cap[k] = 64; } });
    const [yaw, pitch] = aim(px, pz, feet1, 1.62, tx, F + 1 + 1.5, tz);
    await ev(([y, p]) => { const pl = VR.game.player; pl.yaw = y; pl.pitch = p; }, [yaw, pitch]);
    const eye = [px, feet1 + 1.62, pz], fx = -Math.sin(yaw), fz = -Math.cos(yaw), sx = Math.cos(yaw), sz = -Math.sin(yaw);
    const list = [];
    for (let row = 0; row < 5; row++) for (let col = 0; col < 8; col++) {
      const d = 4 + row * 4 + (col & 1) * 1.2, s = (col - 3.5) * (1.1 + row * 0.55);
      const i = row * 8 + col, age = i % 9 === 4 ? 'child' : i % 11 === 7 ? 'elder' : 'adult';
      list.push([7000 + i * 131, age === 'adult' ? ['crafter', 'farmer', 'gardener', 'baker', 'scholar'][i % 5] : age, age, 'hall', px + fx * d + sx * s, pz + fz * d + sz * s]);
    }
    await stage(list, eye, feet1);
    const w = await prewarm();
    await frames(2);
    costs[tag] = {};
    const modes = info.smooth ? ['none', 'voxel', 'smooth', 'split'] : ['none', 'voxel'];
    costs[tag].balanced = await costRounds(modes);
    console.log(`measure ${tag} balanced, the forty: ${JSON.stringify(costs[tag].balanced)}`);
    if (info.smooth) {
      const B = costs[tag].balanced;
      const fg = await ev(() => { const S = VR.FolkGPU.stats; return { asked: S.asked, got: S.got, failed: S.failed, people: S.people, bytes: S.bytes, mbGPU: +(S.bytes / 1048576).toFixed(2), lruMB: +((S.lru || 0) / 1048576).toFixed(2), buildMsPerPerson: +(S.buildMs / Math.max(1, S.got)).toFixed(2), workerMsPerPerson: +(S.workerMs / Math.max(1, S.got)).toFixed(2), partsFromLRU: S.hits, partsMade: S.miss, shadows: S.shadows || 0 }; });
      costs[tag].meshes = fg;
      console.log(`  the meshes ${JSON.stringify(fg)} (prewarm ${JSON.stringify(w)})`);
      check(B.smooth.smooth >= 36, `${tag}: the forty drawn smooth (${B.smooth.smooth})`);
      check(B.smooth.folkDraws < B.voxel.folkDraws, `${tag}: the smooth crowd in fewer draws (the villagers' ${B.smooth.folkDraws} against ${B.voxel.folkDraws} as voxels; ${B.smooth.folkTris} against ${B.voxel.folkTris} triangles; their draw ${B.smooth.folk} against ${B.voxel.folk} ms; the frame ${B.smooth.ms} / ${B.voxel.ms} / without them ${B.none.ms} ms)`);
      check(fg.bytes <= 32 << 20 && fg.failed === 0, `${tag}: the meshes within their budget (${fg.mbGPU} MB on the GPU for ${fg.people} people, none failed)`);
      await ev(() => { VR.game.settings.smoothFolk = 1; });
      want++; if ((await shot('crowd')).ok) pics++;
    }
    await preset('potato');
    await settle(40);
    await frames(2);
    costs[tag].potato = await costRounds(['none', 'voxel']);
    console.log(`measure ${tag} potato, the forty: ${JSON.stringify(costs[tag].potato)}`);
    await unstage();
    await preset('balanced');
    await ev(() => { if (VR.Crowd && VR.Crowd.STREET && VR.Crowd.STREET._cap) { VR.Crowd.STREET.capDefault = VR.Crowd.STREET._cap; VR.Crowd.STREET.cap = VR.Crowd.STREET._capP; } });
  });
  check(pics === want, `${tag}: every picture written (${pics} of ${want})`);
  const errs = logs.filter(l => l.startsWith('[pageerror]'));
  console.log(`--- ${tag} logs (${logs.length})`); for (const l of logs.slice(0, 12)) console.log(l);
  check(errs.length === 0, `${tag}: no page error (${errs.length})`);
  await ctx.close();
}
