// t-folk (the owner: „natürlich keine Lego-Villagers, wir wollen schon Realismus"): the people in the game, before and
// after — one page per build, BEFORE_DIST (an earlier build: the old rig, its block people) and this checkout's dist:
//   P1        the hall city's plaza at eye height (seed 53, vgen 9, the Weißstadt of cell -2,-1; the camera of
//             test/trailer_town.mjs P1, 14:00) with its own people going about their day — test/shots/folk_real_P1_<tag>.png
//   street    a village street (the taiga village of cell 0,1): five villagers — a farmer, a gardener, a crafter, a child,
//             an elder — standing still 3 to 6 blocks before the eye, looking at it — folk_real_street_<tag>.png (and,
//             after, the same with Echte Menschen off: the new proportions as voxels, what Very Low and Low draw —
//             folk_real_street_vox_<tag>.png)
//   portrait  two people two blocks before the eye at the hall city's plaza (a Weißstadt coat, a village farmer) —
//             folk_real_portrait_<tag>.png
//   crowd     forty Weißstadt people in view, 4 to 20 blocks before the eye at P1 (Balanced) — folk_real_crowd_<tag>.png
// and the costs (swiftshader: compare within one run, not absolute numbers): the forty on Balanced — the voxel people
// (Echte Menschen off) against the smooth ones (on) — and on Very Low, against the old rig of BEFORE_DIST; ms a frame,
// draws, triangles, the villagers' draw; the smooth meshes' build (main thread) and worker time a person, their memory.
// Checks: every picture written, no page error, the smooth people drawn (the five, the forty), the smooth crowd in fewer
// draws than the voxel one, Very Low not slower than before (within the noise: 10 %), the meshes within their budget.
// usage: BEFORE_DIST=file:///…/.tmp_tests/dist_before/index.html bash test/wt_run.sh folk_real.mjs 3600
//   N=6 frames a cost round · NO_AFTER=1 · TAG=after
// regress: skip  (a showcase with two world loads; the gate is test/folk_real.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const TAG = process.env.TAG || 'after', N = +(process.env.N || 6), SEED = '53';
const DAY = 8000;
const RUNS = [];
if (process.env.BEFORE_DIST) RUNS.push(['before', process.env.BEFORE_DIST]);
if (!process.env.NO_AFTER) RUNS.push([TAG, process.env.DIST || 'file:///home/dev/vr/dist/index.html']);
const ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const costs = {};
for (const [tag, dist] of RUNS) { try { await runPage(tag, dist); } catch (e) { fails++; console.log(`  ✗ ${tag}: the page failed: ${String(e && e.stack || e).slice(0, 600)}`); } }
if (costs.before && costs[TAG]) {
  const b = costs.before.potato, a = costs[TAG].potato;
  if (b && a) check(a.msMedian <= b.msMedian * 1.1 + 2, `Very Low with the forty in view: ${a.msMedian} ms a frame against ${b.msMedian} before (never slower; the villagers' triangles ${a.folkTris} vs ${b.folkTris}, their draw ${a.folk} vs ${b.folk} ms)`);
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
  const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game, w = g.world; let dirty = 0; for (const c of w.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; const p = g.player, rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0 && i > 2) break; await wait(60); } };
  const shotPath = (name) => `/home/dev/vr/test/shots/folk_real_${name}_${tag}.png`;
  const warmVx = () => ev(() => {
    const g = VR.game, r = g.renderer, p = g.player; if (!r.vxResidency || !g.world) return -1;
    const cam = [p.pos[0], p.pos[1] + (p.eye || 1.62), p.pos[2]], list = [];
    for (const c of g.world.cols.values()) for (const s of c.sec) if (s && s.hasMesh) list.push(s);
    const D = (r.q && r.q.vxLod) || 48, up2 = D * D; let n = 0;
    for (; n < 600; n++) { let w8 = 0; for (const s of list) { if (!s.vxData || s.mesh[3]) continue; const dx = s.ox + 8 - cam[0], dy = s.oy + 8 - cam[1], dz = s.oz + 8 - cam[2]; if (dx * dx + dy * dy * 0.5 + dz * dz < up2) w8++; } if (!w8) break; r.vxResidency(list, cam); }
    return n;
  });
  // rendered frames until the smooth people in view are there (the requests go out from the draw; the worker answers
  // between frames): at most `max` rounds; → the people drawn smooth in the last frame
  const warmFolk = async (want, max = 60) => {
    let s = null;
    for (let i = 0; i < max; i++) {
      s = await ev(() => { window.__norender = false; const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); window.__norender = true; const FG = VR.FolkGPU; return FG ? { drawn: FG.stats.drawn, inflight: FG.inflight, got: FG.stats.got, asked: FG.stats.asked, on: FG.on(g) } : null; });
      if (!s || !s.on) return s;
      if (s.drawn >= want && s.inflight === 0) break;
      await wait(150);
    }
    return s;
  };
  const shot = async (name, frames = 4) => { await warmVx(); await ev((frames) => { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, frames); for (let t = 1; ; t++) { try { await page.screenshot({ path: shotPath(name), timeout: 180000 }); break; } catch (e) { console.log(`  screenshot ${name} try ${t} failed: ${String(e.message).split('\n')[0]}`); if (t >= 2) break; await wait(3000); } } const ok = fs.existsSync(shotPath(name)); console.log('shot', name, tag, ok ? '' : '(missing)'); return ok; };
  const groundY = (x, z, y0) => ev(([x, z, y0]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = y0; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & F.OPAQUE) && !(R.T.flags[s] & F.LEAVES)) return y; } return 70; }, [x, z, y0]);
  const place = async (x, z, feet, yaw, pitch, fov) => {
    await ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 140, z); }, [x, z]);
    await settle(40);
    if (typeof feet === 'function') feet = await feet();
    await ev(([x, y, z, yaw, pitch, fov]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = yaw; p.pitch = pitch; p.fovKick = 0; p.vel = [0, 0, 0]; g.settings.fov = fov; g.env.setTime(8000); const e = g.entities; if (e && e.mobs) e.mobs.length = 0; }, [x, feet, z, yaw, pitch, fov]);
    await settle(50); await step(6);
    return feet;
  };
  // the staged people: a list of [look, x, z] (the look made in the page from [seed, role, age, style]) put on the ground,
  // standing, looking at the eye; the village's own people and their day held while they stand (a test's stage)
  const stage = (list, eye) => ev(([list, eye]) => {
    const g = VR.game, V = g.villages, F = VR.Folk, w = g.world, R = VR.R, Fl = VR.F;
    if (!V._own) { V._own = V.agents; V._upd = V.update; V._bub = V.updateBubbles; }
    const ground = (x, z) => { for (let y = Math.floor(eye[1]) + 4; y > 20; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & Fl.SOLID)) return y + 1; } return eye[1] - 1.62; };
    const agents = list.map(([seed, role, age, style, x, z], i) => {
      const look = F.look(seed, role, age, null, style), y = ground(x, z);
      const yaw = Math.atan2(-(eye[0] - x), -(eye[2] - z));
      return { pos: [x, y, z], yaw, vel: [0, 0, 0], p: { look, seed, name: role, bed: null, home: 0 }, kid: age === 'child', elder: age === 'elder', walkAmt: 0, walk: 0, pose: 'stand', act: null, bubble: null, headYaw: 0, headPitch: 0, hurt: 0, talkAnim: 0, lookAt: [eye[0], eye[1], eye[2]], w: 0.3, h: 1.75, onGround: true, id: 'stage' + i };
    });
    V._staged = agents; V.update = () => {}; V.updateBubbles = () => {};
    Object.defineProperty(V, 'agents', { get() { return this._staged || this._own; }, set(v) { this._own = v; }, configurable: true });
    return agents.length;
  }, [list, eye]);
  const unstage = () => ev(() => { const V = VR.game.villages; if (!V._own) return; const own = V._own; delete V.agents; V.agents = own; V.update = V._upd; V.updateBubbles = V._bub; V._staged = null; V._own = null; });
  // a section of the page on its own: a failure is counted and logged, the stage cleared and the High preset back, and the
  // next section still runs (a browser run is scarce: one broken picture must not cost the others)
  const part = async (name, fn) => {
    try { await fn(); }
    catch (e) {
      fails++; console.log(`  ✗ ${tag}: ${name} failed: ${String(e && e.stack || e).slice(0, 900)}`);
      try { await unstage(); await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.horizon = 1; g.applySettings('*'); if (VR.Crowd && VR.Crowd.STREET && VR.Crowd.STREET._cap) { VR.Crowd.STREET.capDefault = VR.Crowd.STREET._cap; VR.Crowd.STREET.cap = VR.Crowd.STREET._capP; } }); } catch (_) { /* the page is gone */ }
    }
  };
  const measure = async () => {
    const rounds = [];
    for (let k = 0; k < 3; k++) {
      rounds.push(await ev((n) => new Promise((ok, no) => {
        const g = VR.game, gl = g.renderer.gl, V = g.villages, R = g.renderer;
        window.__norender = false;
        const acc = { folk: 0, render: 0 }, wrap = (o, name, key) => { if (!o || !o[name] || o[name].__t) return; const f0 = o[name]; const w = function (...a) { const t = performance.now(); try { return f0.apply(this, a); } finally { acc[key] += performance.now() - t; } }; w.__t = f0; o[name] = w; };
        const unwrap = (o, name) => { if (o && o[name] && o[name].__t) o[name] = o[name].__t; };
        wrap(V, 'draw', 'folk'); wrap(R, 'render', 'render');
        // (every draw call of the frame counted at the context — the people's voxel parts are drawn outside the renderer's
        // own count — with its triangles; and those inside the villagers' draw on their own)
        const cnt = { d: 0, t: 0, fd: 0, ft: 0 }, G0 = {};
        const inFolk = () => acc._in;
        const vw = V.draw; V.draw = function (...a) { acc._in = true; try { return vw.apply(this, a); } finally { acc._in = false; } }; V.draw.__t = vw.__t || vw;
        for (const [nm, ti] of [['drawArrays', (m, f, n) => n], ['drawElements', (m, n) => n], ['drawArraysInstanced', (m, f, n, k) => n * k], ['drawElementsInstanced', (m, n, ty, o, k) => n * k]]) {
          G0[nm] = gl[nm]; gl[nm] = function (...a) { const tri = a[0] === gl.TRIANGLES ? ti(...a) / 3 : a[0] === gl.TRIANGLE_STRIP ? Math.max(0, ti(...a) - 2) : 0; cnt.d++; cnt.t += tri; if (inFolk()) { cnt.fd++; cnt.ft += tri; } return G0[nm].apply(gl, a); };
        }
        const ungl = () => { for (const nm in G0) gl[nm] = G0[nm]; V.draw = V.draw.__t || V.draw; };
        let k = -2, sum = 0, d = 0, t = 0, fd = 0, ft = 0;
        const done = (r) => { ungl(); unwrap(V, 'draw'); unwrap(R, 'render'); window.__norender = true; ok(r); };
        const f = () => { try { if (k === 0) { acc.folk = acc.render = 0; } cnt.d = cnt.t = cnt.fd = cnt.ft = 0; const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); const dt = performance.now() - t0; if (k < 0) { k++; setTimeout(f, 0); return; } sum += dt; d += cnt.d; t += cnt.t; fd += cnt.fd; ft += cnt.ft; if (++k < n) setTimeout(f, 0); else { const FG = VR.FolkGPU; done({ ms: +(sum / n).toFixed(1), draws: Math.round(d / n), tris: Math.round(t / n), folkDraws: Math.round(fd / n), folkTris: Math.round(ft / n), folk: +(acc.folk / n).toFixed(2), world: +((acc.render - acc.folk) / n).toFixed(2), smooth: FG ? FG.stats.drawn : 0 }); } } catch (e) { ungl(); unwrap(V, 'draw'); unwrap(R, 'render'); window.__norender = true; no(String(e)); } };
        f();
      }), N));
    }
    const ms = rounds.map(q => q.ms).sort((a, b) => a - b), mid = rounds.find(q => q.ms === ms[1]) || rounds[1];
    return Object.assign({ msMedian: ms[1], ms }, mid);
  };

  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.horizon = 1; g.applySettings('*'); });
  await ev(`VR.game.createWorld({name:'Echte Menschen',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
  for (let i = 0; i < 120; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  check(await ev(() => VR.game.state) === 'play', `${tag}: the world is loaded`);
  await ev((tod) => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } g.env.setTime(tod); }, DAY);
  const info = await ev(() => ({ smooth: !!VR.FolkGPU, on: VR.FolkGPU ? VR.FolkGPU.on(VR.game) : false, person: !!(VR.Folk && VR.Folk.buildPerson) }));
  console.log(tag, 'build', JSON.stringify(info));
  // ---------------------------------------------------------------- the hall city and its plaza (trailer_town.mjs P1)
  const site = await ev(() => {
    const W = VR.game.world, VG = VR.VillageGen, og = new VR.OverworldGen(W.seed, W.genOpts);
    const s = VG.site(og, -2, -1); if (!s) return null;
    const P = VG.plan(og, s), h = P.hall || null;
    const t = VG.site(og, 0, 1), Pt = t ? VG.plan(og, t) : null;
    return { vgen: W.genOpts.vgen || 0, style: s.style, x: s.x, z: s.z, y: s.y, r: (s.seed >>> 3) & 3, hall: h ? { F: h.F, r: h.r } : null, village: t ? { style: t.style, x: t.x, z: t.z, y: t.y, plaza: Pt.plaza || null } : null };
  });
  console.log(tag, 'site', JSON.stringify(site));
  check(!!site && !!site.hall, `${tag}: the hall city of cell -2,-1`);
  if (!site || !site.hall) { await ctx.close(); return; }
  const r = site.hall.r, F = site.hall.F, W2 = (u, v) => { const q = ROT[r](u, v); return [site.x + q[0], site.z + q[1]]; };
  const [px, pz] = W2(0.5, -24.5), [tx, tz] = W2(0.5, 40);
  const aim = (x, z, feet, eyeH, ax, ay, az) => [Math.atan2(-(ax - x), -(az - z)), Math.atan2(ay - (feet + eyeH), Math.hypot(ax - x, az - z))];
  const feet1 = await place(px, pz, F + 1, 0, 0, 66);
  { const [yaw, pitch] = aim(px, pz, feet1, 1.62, tx, F + 1 + 8, tz); await ev(([y, p]) => { const pl = VR.game.player; pl.yaw = y; pl.pitch = p; }, [yaw, pitch]); }
  await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 6; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } window.__norender = true; });
  await wait(1500); await settle(40); await step(30);
  let pics = 0, want = 0;
  await part('P1', async () => {
    const w1 = await warmFolk(3, 40);
    want++; if (await shot('P1')) pics++;
    const p1 = await ev(() => { const g = VR.game, V = g.villages, p = g.player, FG = VR.FolkGPU; let vis = 0, drawn = 0, near = 0; for (const a of V.agents) { if (!a.vis) continue; vis++; if (a.drawn) drawn++; if (Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) < 24) near++; } return { agents: V.agents.length, inView: vis, drawn, near, smooth: FG ? FG.stats.drawn : 0, shadows: FG ? FG.stats.shadows || 0 : 0 }; });
    console.log(`  P1: ${JSON.stringify(p1)} (warm ${JSON.stringify(w1)})`);
  });
  // ---------------------------------------------------------------- the portrait: two people two blocks before the eye
  await part('the portrait', async () => {
    const yaw = await ev(() => VR.game.player.yaw), eye = [px, feet1 + 1.62, pz];
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), sx = Math.cos(yaw), sz = -Math.sin(yaw);
    const at = (d, s) => [px + fx * d + sx * s, pz + fz * d + sz * s];
    const coat = await ev(() => { for (let s = 1; s < 999; s++) { const L = VR.Folk.look(s, 'crafter', 'adult', null, 'hall'); if (L.garb === 'coat') return s; } return 1; });
    const [ax, az] = at(2, -0.42), [bx, bz] = at(2, 0.42);
    await stage([[coat, 'crafter', 'adult', 'hall', ax, az], [4242, 'farmer', 'adult', null, bx, bz]], eye);
    await ev(() => { const pl = VR.game.player; pl.pitch = -0.04; });
    const w = await warmFolk(2, 40);
    console.log(`  portrait: ${JSON.stringify(w)}`);
    want++; if (await shot('portrait')) pics++;
    if (info.on) check(w && w.drawn >= 2, `${tag}: the two at two blocks drawn smooth (${w ? w.drawn : 0})`);
    await unstage();
  });
  // ---------------------------------------------------------------- the forty: costs on Balanced (voxel, smooth) and Very Low
  await part('the forty', async () => {
    await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.horizon = 1; g.applySettings('*'); if (VR.Crowd && VR.Crowd.STREET) { VR.Crowd.STREET._cap = VR.Crowd.STREET.capDefault; VR.Crowd.STREET._capP = Object.assign({}, VR.Crowd.STREET.cap); VR.Crowd.STREET.capDefault = 64; VR.Crowd.STREET.cap.potato = 64; VR.Crowd.STREET.cap.low = 64; } });
    const [yaw, pitch] = aim(px, pz, feet1, 1.62, tx, F + 1 + 1.5, tz);
    await ev(([y, p]) => { const pl = VR.game.player; pl.yaw = y; pl.pitch = p; }, [yaw, pitch]);
    const eye = [px, feet1 + 1.62, pz], fx = -Math.sin(yaw), fz = -Math.cos(yaw), sx = Math.cos(yaw), sz = -Math.sin(yaw);
    const list = [];
    for (let row = 0; row < 5; row++) for (let col = 0; col < 8; col++) {
      const d = 4 + row * 4 + (col & 1) * 1.2, s = (col - 3.5) * (1.1 + row * 0.55);
      const i = row * 8 + col, age = i % 9 === 4 ? 'child' : i % 11 === 7 ? 'elder' : 'adult';
      list.push([7000 + i * 131, age === 'adult' ? ['crafter', 'farmer', 'gardener', 'baker', 'scholar'][i % 5] : age, age, 'hall', px + fx * d + sx * s, pz + fz * d + sz * s]);
    }
    await stage(list, eye);
    await settle(20);
    costs[tag] = {};
    const setSm = (v) => ev((v) => { const g = VR.game; g.settings.smoothFolk = v; }, v);
    if (info.smooth) await setSm(0);
    await warmFolk(0, 4);
    costs[tag].voxel = await measure();
    console.log(`measure ${tag} balanced, the forty as voxels: ${JSON.stringify(costs[tag].voxel)}`);
    if (info.smooth) {
      await setSm(1);
      const w = await warmFolk(40, 120);
      costs[tag].smooth = await measure();
      const fg = await ev(() => { const S = VR.FolkGPU.stats; return { asked: S.asked, got: S.got, failed: S.failed, people: S.people, bytes: S.bytes, mbGPU: +(S.bytes / 1048576).toFixed(2), lruMB: +((S.lru || 0) / 1048576).toFixed(2), buildMsPerPerson: +(S.buildMs / Math.max(1, S.asked)).toFixed(2), workerMsPerPerson: +(S.workerMs / Math.max(1, S.got)).toFixed(2), partsFromLRU: S.hits, partsMade: S.miss, shadows: S.shadows || 0 }; });
      costs[tag].meshes = fg;
      console.log(`measure ${tag} balanced, the forty smooth: ${JSON.stringify(costs[tag].smooth)} · the meshes ${JSON.stringify(fg)} (warm ${JSON.stringify(w)})`);
      check(costs[tag].smooth.smooth >= 36, `${tag}: the forty drawn smooth (${costs[tag].smooth.smooth})`);
      check(costs[tag].smooth.folkDraws < costs[tag].voxel.folkDraws, `${tag}: the smooth crowd in fewer draws (the villagers' ${costs[tag].smooth.folkDraws} against ${costs[tag].voxel.folkDraws} as voxels; ${costs[tag].smooth.folkTris} against ${costs[tag].voxel.folkTris} triangles)`);
      check(fg.bytes <= 32 << 20 && fg.failed === 0, `${tag}: the meshes within their budget (${fg.mbGPU} MB on the GPU for ${fg.people} people, none failed)`);
      want++; if (await shot('crowd')) pics++;
    }
    await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
    await settle(40);
    costs[tag].potato = await measure();
    console.log(`measure ${tag} potato, the forty: ${JSON.stringify(costs[tag].potato)}`);
    await unstage();
    await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.horizon = 1; g.applySettings('*'); if (VR.Crowd && VR.Crowd.STREET && VR.Crowd.STREET._cap) { VR.Crowd.STREET.capDefault = VR.Crowd.STREET._cap; VR.Crowd.STREET.cap = VR.Crowd.STREET._capP; } });
  });
  // ---------------------------------------------------------------- a village street: five villagers 3–6 blocks before the eye
  await part('the street', async () => { if (site.village && site.village.plaza) {
    const P = site.village.plaza, vx = P.x + 0.5 - 6, vz = P.z + 0.5;
    const feet = await place(vx, vz, async () => (await groundY(vx, vz, 140)) + 1, 0, 0, 62);
    const yaw = -Math.PI / 2;   // (looking toward +x, across the plaza)
    await ev(([y]) => { const pl = VR.game.player; pl.yaw = y; pl.pitch = -0.08; }, [yaw]);
    const eye = [vx, feet + 1.62, vz], fx = -Math.sin(yaw), fz = -Math.cos(yaw), sx = Math.cos(yaw), sz = -Math.sin(yaw);
    const five = [[11, 'farmer', 'adult', -1.5, 3.0], [22, 'gardener', 'adult', 0.9, 3.6], [55, 'crafter', 'adult', -0.4, 4.4], [77, 'child', 'child', 1.6, 5.1], [111, 'elder', 'elder', -1.8, 6.0]];
    await stage(five.map(([seed, role, age, s, d]) => [seed, role, age, null, vx + fx * d + sx * s, vz + fz * d + sz * s]), eye);
    await settle(30);
    const w = await warmFolk(5, 60);
    console.log(`  street (${site.village.style} at ${P.x}, ${P.z}): ${JSON.stringify(w)}`);
    want++; if (await shot('street')) pics++;
    if (info.on) check(w && w.drawn >= 5, `${tag}: the five on the street drawn smooth (${w ? w.drawn : 0})`);
    if (info.smooth) {
      await ev(() => { VR.game.settings.smoothFolk = 0; });
      await warmFolk(0, 3);
      want++; if (await shot('street_vox')) pics++;
      await ev(() => { VR.game.settings.smoothFolk = 1; });
    }
    await unstage();
  } else check(false, `${tag}: the village of cell 0,1 for the street`); });
  check(pics === want, `${tag}: every picture written (${pics} of ${want})`);
  const errs = logs.filter(l => l.startsWith('[pageerror]'));
  console.log(`--- ${tag} logs (${logs.length})`); for (const l of logs.slice(0, 12)) console.log(l);
  check(errs.length === 0, `${tag}: no page error (${errs.length})`);
  await ctx.close();
}
