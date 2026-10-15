// t-folk2 (the owner, round II: the arms hang like posts, mitten hands, the shadows are blots, one draw a person, amber
// eyes, nobody sits right): the people in the game, before (BEFORE_DIST — the v0.46 build) and after, on Balanced:
//   street    the taiga village of cell 0,1 (the road south of its plaza, looking up it): five villagers 3–6 blocks away,
//             in the sun — their arms, their hands, their shadows on the road — folk_real2_street_<tag>.png
//   portrait  two people two blocks before the eye in the hall city's street (a Weißstadt coat with a basket, a village
//             farmer, one hand on his hip) — folk_real2_portrait_<tag>.png
//   cafe      a guest seated at one of the café's marble tables, close (the knees, the feet on the floor, a forearm on the
//             table) — folk_real2_cafe_<tag>.png
//   pair      two people talking, seen from the side at three blocks (the speaker's gestures, the listener's clasped hands)
//             — folk_real2_pair_<tag>.png
//   P1        the hall city's street at eye height with its own people (the camera of test/trailer_town.mjs P1) —
//             folk_real2_P1_<tag>.png
//   crowd     forty Weißstadt people in view, 4 to 20 blocks before the eye at P1 — folk_real2_crowd_<tag>.png
// and the costs with the forty in view (swiftshader on a shared machine: rounds interleaved, the least and the median):
// Balanced — without the people, smooth with their shadows in the map and smooth without (the switch off): the frame,
// the people's draw (ms, draws — a multi-draw counts one —, triangles), the shadow pass; Very Low — the voxel people
// before and after (their draw, triangles, the frame). A round stops after 15 s of frames (a stalled frame is the
// machine's or the old page's, not a cost).
// Checks: every picture written, no page error, the smooth people drawn, the forty in ≤ 12 draws, the shadow pass ran,
// Very Low's people not costlier than before.
// usage: BEFORE_DIST=file:///…/.tmp_tests/base_src/dist/index.html bash test/wt_run.sh folk_real2.mjs 5400
//   N=4 frames a cost round · NO_AFTER=1 · TAG=after · DIST=file:///… · ONLY=street,cafe (the sections to run)
// regress: skip  (a showcase with two world loads; the gate is test/folk_real2.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import os from 'os';
const TAG = process.env.TAG || 'after', N = +(process.env.N || 4), SEED = '53';
const DAY = 8000, RD = 7;
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null, want = (k) => !ONLY || ONLY.has(k);
// (this build's page first: a run cut short by its time limit still has this build's pictures)
const RUNS = [];
if (!process.env.NO_AFTER) RUNS.push([TAG, process.env.DIST || 'file:///home/dev/vr/dist/index.html']);
if (process.env.BEFORE_DIST) RUNS.push(['before', process.env.BEFORE_DIST]);
const ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const costs = {};
for (const [tag, dist] of RUNS) { try { await runPage(tag, dist); } catch (e) { fails++; console.log(`  ✗ ${tag}: the page failed: ${String(e && e.stack || e).slice(0, 600)}`); } }
if (costs.before && costs[TAG]) {
  const b = costs.before, a = costs[TAG];
  if (b.balanced && a.balanced && b.balanced.smooth && a.balanced.smooth) console.log(`  the forty on Balanced, smooth: the people's draw ${a.balanced.smooth.folkMin} ms (median ${a.balanced.smooth.folk}) in ${a.balanced.smooth.folkDraws} draws against ${b.balanced.smooth.folkMin} ms (${b.balanced.smooth.folk}) in ${b.balanced.smooth.folkDraws} before; the frame ${a.balanced.smooth.msMin} against ${b.balanced.smooth.msMin} ms`);
  if (b.potato && a.potato) check(a.potato.voxel.folkFrameMin <= b.potato.voxel.folkFrameMin * 1.15 + 0.3 && a.potato.voxel.folkTris <= b.potato.voxel.folkTris * 1.02, `Very Low, the forty in view: the villagers' draw ${a.potato.voxel.folkFrameMin} ms in the least frame (rounds: least ${a.potato.voxel.folkMin}, median ${a.potato.voxel.folk}) and ${a.potato.voxel.folkTris} triangles against ${b.potato.voxel.folkFrameMin} ms (${b.potato.voxel.folkMin}, ${b.potato.voxel.folk}) and ${b.potato.voxel.folkTris} before (the frame ${a.potato.voxel.frameMin} / ${a.potato.voxel.ms} against ${b.potato.voxel.frameMin} / ${b.potato.voxel.ms}; without the people ${a.potato.none.frameMin} against ${b.potato.none.frameMin})`);
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
  // (done when the pool is idle and every column in reach is shown; sections left dirty that no longer change for six
  // rounds do not hold it — the hall city keeps a thousand of them out of reach)
  const settle = async (max = 60) => { let s = null, i = 0, same = 0, d0 = -1; for (; i < max; i++) { await step(10); s = await ev(() => { const g = VR.game, w = g.world; let dirty = 0; for (const c of w.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; const p = g.player, rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown }; }); same = s.dirty === d0 ? same + 1 : 0; d0 = s.dirty; if (s.busy === 0 && s.pend === 0 && (s.dirty === 0 || same >= 6) && s.up === 0 && s.fading === 0 && s.unshown === 0 && i > 2) break; await wait(60); } return Object.assign({ rounds: i }, s); };
  const shotPath = (name) => `/home/dev/vr/test/shots/folk_real2_${name}_${tag}.png`;
  const warmVx = () => ev(() => {
    const g = VR.game, r = g.renderer, p = g.player; if (!r.vxResidency || !g.world) return -1;
    const cam = [p.pos[0], p.pos[1] + (p.eye || 1.62), p.pos[2]], list = [];
    for (const c of g.world.cols.values()) for (const s of c.sec) if (s && s.hasMesh) list.push(s);
    const D = (r.q && r.q.vxLod) || 48, up2 = D * D; let n = 0;
    for (; n < 600; n++) { let w8 = 0; for (const s of list) { if (!s.vxData || s.mesh[3]) continue; const dx = s.ox + 8 - cam[0], dy = s.oy + 8 - cam[1], dz = s.oz + 8 - cam[2]; if (dx * dx + dy * dy * 0.5 + dz * dz < up2) w8++; } if (!w8) break; r.vxResidency(list, cam); }
    return n;
  });
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
  // n frames drawn (the people's pose and their shadow pass need two frames: the pass draws last frame's casters)
  const frames = (n) => ev((n) => { window.__norender = false; const g = VR.game; for (let i = 0; i < n; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; const FG = VR.FolkGPU; return FG && FG.on(g) ? { smooth: FG.stats.drawn, draws: FG.stats.draws === undefined ? FG.stats.drawn : FG.stats.draws, cast: FG.stats.casters || 0, castMs: FG.stats.castMs || 0, read: !!g.renderer.shadowRead } : { smooth: 0 }; }, n);
  const shot = async (name, n = 3) => { await warmVx(); const sm = await frames(n); for (let t = 1; ; t++) { try { await page.screenshot({ path: shotPath(name), timeout: 150000 }); break; } catch (e) { console.log(`  screenshot ${name} try ${t} failed: ${String(e.message).split('\n')[0]}`); if (t >= 2) break; await wait(3000); } } const ok = fs.existsSync(shotPath(name)); console.log('shot', name, tag, ok ? '' : '(missing)', `people: ${JSON.stringify(sm)}`); return Object.assign({ ok }, sm); };
  const groundY = (x, z, y0) => ev(([x, z, y0]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = y0; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & F.OPAQUE) && !(R.T.flags[s] & F.LEAVES)) return y; } return 70; }, [x, z, y0]);
  const place = async (x, z, feet, yaw, pitch, fov) => {
    await ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 140, z); }, [x, z]);
    await settle(40);
    if (typeof feet === 'function') feet = await feet();
    await ev(([x, y, z, yaw, pitch, fov]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = yaw; p.pitch = pitch; p.fovKick = 0; p.vel = [0, 0, 0]; g.settings.fov = fov; g.env.setTime(8000); const e = g.entities; if (e && e.mobs) e.mobs.length = 0; }, [x, feet, z, yaw, pitch, fov]);
    const st = await settle(400); await step(6);
    console.log(`  settled at (${x.toFixed(1)}, ${feet}, ${z.toFixed(1)}): ${JSON.stringify(st)}`);
    return feet;
  };
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
  // the staged people: [seed, role, age, style, x, z, extra] on the eye's floor, standing and looking at the eye (or as
  // extra says: { look: [x, y, z], pose, talk (speaking), hip ('l' | 'r': a hand on the hip), sit: seat [x, y, z, f] });
  // the town's own people and their day held while they stand (a test's stage)
  const stage = (list, eye, floorY) => ev(([list, eye, floorY]) => {
    const g = VR.game, V = g.villages, F = VR.Folk, w = g.world, R = VR.R, Fl = VR.F;
    if (!V._own) { V._own = V.agents; V._upd = V.update; V._bub = V.updateBubbles; }
    const ground = (x, z) => { for (let y = Math.floor(floorY) + 1; y > floorY - 6; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & Fl.SOLID)) return y + 1; } return floorY; };
    const spot = (x, z) => { for (const [dx, dz] of [[0, 0], [0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8], [1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]]) { if (ground(x + dx, z + dz) <= floorY) return [x + dx, z + dz]; } return [x, z]; };
    const agents = list.map(([seed, role, age, style, x0, z0, ex], i) => {
      ex = ex || {};
      const [x, z] = ex.sit ? [x0, z0] : spot(x0, z0), look = F.look(seed, role, age, null, style), y = ex.sit ? floorY : ground(x, z);
      const tgt = ex.look || eye, yaw = Math.atan2(-(tgt[0] - x), -(tgt[2] - z));
      const a = { pos: [x, y, z], yaw, vel: [0, 0, 0], p: { look, seed, name: role, bed: null, home: 0 }, kid: age === 'child', elder: age === 'elder', walkAmt: 0, walk: 0, pose: ex.pose || 'stand', act: null, bubble: null, headYaw: 0, headPitch: 0, hurt: 0, talkAnim: ex.talk ? 1e6 : 0, lookAt: [tgt[0], tgt[1], tgt[2]], w: 0.3, h: 1.75, onGround: true, id: 'stage' + i, blinkT: 99, seedW: (seed % 97) };
      // (the free hand on the hip, as the game picks it: what the right holds keeps it off, the cane the left)
      const G0 = ex.hip && F.gaitFor ? F.gaitFor(look) : null, side = G0 && G0.item && G0.item !== 'cane' ? 'l' : G0 && G0.cane ? 'r' : ex.hip;
      // (the person already in its state: run 2's café guest was drawn three frames into the quarter second's blend from
      // standing — the pose is made only in the frames drawn — and stood before the chair)
      a.anim = { cur: ex.sit ? 'sit' : ex.pose || 'idle', t: 1 + (seed % 7) * 0.4, prev: null, prevT: 0, fade: 1, fadeLen: 0.25, tw: 0 };
      if (ex.hip) a.anim.hh = { t: 50, next: 40, until: 1e9, side, k: 1 };
      if (ex.sit && V.sit) { V.sit(a, ex.sit); a.lookAt = ex.look || null; }
      return a;
    });
    V._staged = agents; V.update = () => {}; V.updateBubbles = () => {};
    Object.defineProperty(V, 'agents', { get() { return this._staged || this._own; }, set(v) { this._own = v; }, configurable: true });
    return agents.map(a => [+a.pos[1].toFixed(2), a.pose, a.sitO ? JSON.stringify(a.sitO) : '']);
  }, [list, eye, floorY]);
  const unstage = () => ev(() => { const V = VR.game.villages; if (!V._own) return; const own = V._own; delete V.agents; V.agents = own; V.update = V._upd; V.updateBubbles = V._bub; V._staged = null; V._own = null; });
  const preset = (name) => ev(([name, rd]) => { const g = VR.game; g.applyPreset(name); g.settings.dynRes = false; if (name !== 'potato') { g.settings.renderDist = rd; g.settings.horizon = 1; } g.applySettings('*'); }, [name, RD]);
  const part = async (name, fn) => {
    if (!want(name)) return;
    try { await fn(); }
    catch (e) {
      fails++; console.log(`  ✗ ${tag}: ${name} failed: ${String(e && e.stack || e).slice(0, 900)}`);
      try { await unstage(); await preset('balanced'); } catch (_) { /* the page is gone */ }
    }
  };
  // one cost round: n frames (after two to warm) in a mode — 'none' without the people's draw, 'voxel' (Echte Menschen
  // off), 'smooth' (on, their shadows in the map), 'flat' (on, the shadow switch off: the pass's cost apart). Every draw
  // call counted at the context with its triangles (a multi-draw one call, its ranges' triangles), those inside the
  // villagers' draw apart; the people's shadow pass's ms
  const round = (n, mode) => ev(([n, mode]) => new Promise((ok, no) => {
    const g = VR.game, gl = g.renderer.gl, V = g.villages, R = g.renderer, FG = VR.FolkGPU, MD = VR.GL.ext && VR.GL.ext.multiDraw;
    if (FG) g.settings.smoothFolk = mode === 'smooth' || mode === 'flat' ? 1 : 0;
    g.settings.folkShadow = mode === 'flat' ? 0 : 1;
    window.__norender = false;
    const acc = {}, wrapped = [];
    const wrap = (o, name, key) => { if (!o || typeof o[name] !== 'function') return; const f0 = o[name]; o[name] = function (...a) { const t = performance.now(); try { return f0.apply(this, a); } finally { acc[key] = (acc[key] || 0) + performance.now() - t; } }; wrapped.push([o, name, f0]); };
    wrap(R, 'render', 'render'); wrap(R, 'reflectPass', 'mirror'); wrap(R, 'drawProps', 'props'); wrap(g.entities, 'draw', 'mobs'); wrap(g.hall, 'draw', 'hall');
    if (FG && FG.castShadows) wrap(FG, 'castShadows', 'cast');
    const vd = V.draw; let inFolk = false;
    V.draw = function (...a) { if (mode === 'none') return; inFolk = true; const t = performance.now(); try { return vd.apply(this, a); } finally { inFolk = false; acc.folk = (acc.folk || 0) + performance.now() - t; } };
    const cnt = { d: 0, t: 0, fd: 0, ft: 0 }, G0 = {};
    for (const [nm, ti] of [['drawArrays', (m, f, n) => n], ['drawElements', (m, n) => n], ['drawArraysInstanced', (m, f, n, k) => n * k], ['drawElementsInstanced', (m, n, ty, o, k) => n * k]]) {
      G0[nm] = gl[nm]; gl[nm] = function (...a) { const tri = a[0] === gl.TRIANGLES ? ti(...a) / 3 : a[0] === gl.TRIANGLE_STRIP ? Math.max(0, ti(...a) - 2) : 0; cnt.d++; cnt.t += tri; if (inFolk) { cnt.fd++; cnt.ft += tri; } return G0[nm].apply(gl, a); };
    }
    let M0 = null;
    if (MD && MD.multiDrawElementsWEBGL) { M0 = MD.multiDrawElementsWEBGL; MD.multiDrawElementsWEBGL = function (mode, counts, co, type, offs, oo, k) { let tri = 0; for (let i = 0; i < k; i++) tri += counts[co + i] / 3; cnt.d++; cnt.t += tri; if (inFolk) { cnt.fd++; cnt.ft += tri; } return M0.apply(MD, arguments); }; }
    const restore = () => { for (const [o, nm, f0] of wrapped) o[nm] = f0; V.draw = vd; for (const nm in G0) gl[nm] = G0[nm]; if (M0) MD.multiDrawElementsWEBGL = M0; window.__norender = true; g.settings.folkShadow = 1; };
    // (a round ends after 15 s of frames: run 1's v0.46 page stalled 10–117 s a frame with the forty as voxels on
    // Balanced, and the rest of the run waited on it)
    let k = -2, sum = 0, d = 0, t = 0, fd = 0, ft = 0, m = 0, fmin = 1e9, folkF = 1e9;
    const T0 = performance.now(), BUDGET = 15000;
    const f = () => {
      try {
        if (k === 0) for (const key in acc) acc[key] = 0;
        cnt.d = cnt.t = cnt.fd = cnt.ft = 0;
        const fo0 = acc.folk || 0;
        const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); const dt = performance.now() - t0;
        if (k < 0) { k++; if (performance.now() - T0 > BUDGET) k = 0; setTimeout(f, 0); return; }
        sum += dt; d += cnt.d; t += cnt.t; fd += cnt.fd; ft += cnt.ft; m++; fmin = Math.min(fmin, dt); folkF = Math.min(folkF, (acc.folk || 0) - fo0);
        if (++k < n && performance.now() - T0 < BUDGET) { setTimeout(f, 0); return; }
        const parts = {}; for (const key of ['mirror', 'props', 'mobs', 'hall', 'cast']) if (acc[key]) parts[key] = +(acc[key] / m).toFixed(2);
        restore();
        ok({ ms: +(sum / m).toFixed(1), draws: Math.round(d / m), tris: Math.round(t / m), folk: +((acc.folk || 0) / m).toFixed(2), folkDraws: Math.round(fd / m), folkTris: Math.round(ft / m), cast: +((acc.cast || 0) / m).toFixed(2), render: +((acc.render || 0) / m).toFixed(1), parts, smooth: (mode === 'smooth' || mode === 'flat') && FG ? FG.stats.drawn : 0, casters: FG && FG.stats.casters || 0, frames: m, stalled: m < n, fmin: +fmin.toFixed(1), folkF: +folkF.toFixed(2) });
      } catch (e) { restore(); no(String(e && e.stack || e)); }
    };
    f();
  }), [n, mode]);
  const median = (rs) => { const out = {}; for (const key of ['ms', 'draws', 'tris', 'folk', 'folkDraws', 'folkTris', 'cast', 'render', 'smooth', 'casters']) { const v = rs.map(q => q[key]).sort((a, b) => a - b); out[key] = v[(v.length - 1) >> 1]; } out.msMin = Math.min(...rs.map(q => q.ms)); out.folkMin = Math.min(...rs.map(q => q.folk)); out.castMin = Math.min(...rs.map(q => q.cast)); out.frameMin = Math.min(...rs.map(q => q.fmin)); out.folkFrameMin = Math.min(...rs.map(q => q.folkF)); out.stalls = rs.filter(q => q.stalled).length; out.rounds = rs.map(q => q.ms); out.parts = rs[(rs.length - 1) >> 1].parts; return out; };
  const costRounds = async (modes, rounds = 4) => { const R = {}; for (const m of modes) R[m] = []; for (let k = 0; k < rounds; k++) for (const m of modes) R[m].push(await round(N, m)); const out = {}; for (const m of modes) out[m] = median(R[m]); return out; };

  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await preset('balanced');
  await ev(`VR.game.createWorld({name:'Echte Menschen II',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
  for (let i = 0; i < 120; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  check(await ev(() => VR.game.state) === 'play', `${tag}: the world is loaded`);
  await ev((tod) => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } g.env.setTime(tod); }, DAY);
  await preset('balanced');
  const info = await ev(() => ({ smooth: !!VR.FolkGPU, on: VR.FolkGPU ? VR.FolkGPU.on(VR.game) : false, mode: VR.FolkGPU && VR.FolkGPU.shadowMode ? VR.FolkGPU.shadowMode(VR.game.settings, VR.game.renderer.q) : '-', multi: !!(VR.GL.ext && VR.GL.ext.multiDraw), arena: !!(VR.FolkGPU && VR.FolkGPU.Ranges), preset: VR.game.settings.preset, renderDist: VR.game.settings.renderDist }));
  console.log(tag, 'build', JSON.stringify(info));
  const site = await ev(() => {
    const W = VR.game.world, VG = VR.VillageGen, og = new VR.OverworldGen(W.seed, W.genOpts);
    const s = VG.site(og, -2, -1); if (!s) return null;
    const P = VG.plan(og, s), h = P.hall || null, cafe = (P.work || []).find(w => w.kind === 'cafe');
    const t = VG.site(og, 0, 1), Pt = t ? VG.plan(og, t) : null;
    return { vgen: W.genOpts.vgen || 0, style: s.style, x: s.x, z: s.z, y: s.y, r: (s.seed >>> 3) & 3, hall: h ? { F: h.F, r: h.r } : null, cafeSeats: cafe && cafe.seats ? cafe.seats : [], village: t ? { style: t.style, x: t.x, z: t.z, y: t.y, plaza: Pt.plaza || null } : null };
  });
  console.log(tag, 'site', JSON.stringify(Object.assign({}, site, { cafeSeats: site && site.cafeSeats.length })));
  let pics = 0, wanted = 0;
  const pic = async (name, minSmooth) => { wanted++; const s = await shot(name); if (s.ok) pics++; if (info.on && minSmooth) check(s.smooth >= minSmooth, `${tag}: ${name} — ${s.smooth} drawn smooth (≥ ${minSmooth})`); return s; };
  // ---------------------------------------------------------------- the street: five villagers in the sun
  await part('street', async () => { if (site && site.village && site.village.plaza) {
    const P = site.village.plaza, vx = P.x + 6.5, vz = P.z + 29.5;
    const feet = await place(vx, vz, async () => (await groundY(vx, vz, 140)) + 1, 0, 0, 62);
    const yaw = 0;
    await ev(([y]) => { const pl = VR.game.player; pl.yaw = y; pl.pitch = -0.1; }, [yaw]);
    const eye = [vx, feet + 1.62, vz], fx = -Math.sin(yaw), fz = -Math.cos(yaw), sx = Math.cos(yaw), sz = -Math.sin(yaw);
    const five = [[11, 'farmer', 'adult', -1.6, 3.2, { hip: 'l' }], [77, 'child', 'child', -0.35, 3.3], [22, 'gardener', 'adult', 0.85, 3.8], [55, 'crafter', 'adult', -1.0, 5.0], [111, 'elder', 'elder', 1.8, 5.6]];
    const ys = await stage(five.map(([seed, role, age, s, d, ex]) => [seed, role, age, null, vx + fx * d + sx * s, vz + fz * d + sz * s, ex]), eye, feet);
    const w = await prewarm();
    console.log(`  street (${site.village.style}; the five at ${JSON.stringify(ys)}, the eye's floor ${feet}): ${JSON.stringify(w)}`);
    const s = await pic('street', 5);
    if (tag !== 'before' && info.mode === 'map') {
      check(s.read && s.cast >= 5, `${tag}: the street's people in the shadow map (${s.cast} drawn into it, ${s.castMs.toFixed(1)} ms; the frame reads the copy: ${s.read})`);
      // the people in the copy where the ground looks for them: for each of the five, three points on the ground along its
      // shadow (0.6, 1.2 and 2.4 blocks from its feet away from the sun — under its shins, its hips, its chest) and one
      // 2 blocks to its side, each looked up in the people's copy of the map and in the map itself as the terrain looks it
      // up (a 1×1 draw: the comparison at the ground's depth less the receivers' bias) — in the copy in shadow, in the map
      // lit (run 3: the picture showed no shadow of theirs, and a one-frame picture difference drowned in the temporal
      // upscaler's jitter)
      const pr = await ev(() => {
        const g = VR.game, r = g.renderer, gl = r.gl, FG = VR.FolkGPU, SM = FG.sm, E = g.env.E, V = g.villages;
        window.__norender = false; for (let i = 0; i < 2; i++) { g.last = performance.now() - 16; g.loop(performance.now()); } gl.finish(); window.__norender = true;
        const copy = r.shadowRead, map = r.shadowTex, M = r.shadowMat;
        if (!copy || !map) return { err: `no copy (${!!copy}) or no map (${!!map})` };
        let P; try { P = VR.GL.program('void main() { gl_Position = vec4(0.0, 0.0, 0.0, 1.0); gl_PointSize = 1.0; }', 'uniform highp sampler2DShadow u_m;\nuniform vec3 u_q;\nout vec4 o;\nvoid main() { o = vec4(texture(u_m, u_q), 0.0, 0.0, 1.0); }', 'folkProbe'); } catch (e) { return { err: 'probe program: ' + String(e).slice(0, 300) }; }
        const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
        gl.viewport(0, 0, 1, 1); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.disable(gl.SCISSOR_TEST); gl.colorMask(true, true, true, true);
        gl.useProgram(P.p); gl.bindVertexArray(null);
        const px = new Uint8Array(4);
        const look = (tex, q) => { gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(P.u.u_m, 5); gl.uniform3f(P.u.u_q, q[0], q[1], q[2]); gl.drawArrays(gl.POINTS, 0, 1); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); return +(px[0] / 255).toFixed(2); };
        // (the shadow matrix takes positions relative to the frame's eye: SM.cam, the eye of the frame the people were drawn in)
        const cx = SM.cam[0], cy = SM.cam[1], cz = SM.cam[2];
        const proj = (x, y, z) => { const X = x - cx, Y = y - cy, Z = z - cz, w = M[3] * X + M[7] * Y + M[11] * Z + M[15]; return [((M[0] * X + M[4] * Y + M[8] * Z + M[12]) / w) * 0.5 + 0.5, ((M[1] * X + M[5] * Y + M[9] * Z + M[13]) / w) * 0.5 + 0.5, ((M[2] * X + M[6] * Y + M[10] * Z + M[14]) / w) * 0.5 + 0.5 - 0.0006]; };
        const L = E.sunDir, hl = Math.hypot(L[0], L[2]) || 1, sx = -L[0] / hl, sz = -L[2] / hl;
        const out = [], side = [];
        for (const a of V.agents) {
          const row = [];
          for (const d of [0.6, 1.2, 2.4]) { const q = proj(a.pos[0] + sx * d, a.pos[1] + 0.04, a.pos[2] + sz * d); row.push([look(copy, q), look(map, q)]); }
          out.push(row);
          const q = proj(a.pos[0] - sz * 2, a.pos[1] + 0.04, a.pos[2] + sx * 2); side.push([look(copy, q), look(map, q)]);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); gl.deleteTexture(t);
        return { sun: L.map(v => +v.toFixed(2)), n: SM.n, out, side };
      });
      if (pr.err) check(false, `${tag}: the probe of the people's copy of the map: ${pr.err}`);
      else {
        let lit = 0, hit = 0, sideOk = 0, sideLit = 0;
        for (const row of pr.out) for (const [c, m] of row) if (m > 0.5) { lit++; if (c < 0.5) hit++; }
        for (const [c, m] of pr.side) if (m > 0.5) { sideLit++; if (c > 0.5) sideOk++; }
        console.log(`  the probe (the sun ${JSON.stringify(pr.sun)}, ${pr.n} people in the copy): along each one's shadow [copy, map] ${JSON.stringify(pr.out)}; beside them ${JSON.stringify(pr.side)}`);
        check(lit >= 4 && hit >= Math.ceil(lit * 0.6) && sideOk === sideLit, `${tag}: the people's shadows in their copy of the map — ${hit} of the ${lit} ground points along their shadows that the map lights are in shadow in the copy; beside them ${sideOk} of ${sideLit} lit in both`);
      }
      // the picture without their shadows, for the eye (the pass switched off for 9 frames — the upscaler's history
      // settled — then the people's shadows back for the next pictures): folk_real2_street_noshadow_<tag>.png
      await ev(() => { const FG = VR.FolkGPU; FG._cast0 = FG.castShadows; FG.castShadows = function (r) { r.shadowRead = null; return false; }; });
      try { await frames(9); await page.screenshot({ path: shotPath('street_noshadow'), timeout: 150000 }); } catch (e) { console.log('  the picture without their shadows failed: ' + String(e.message).split('\n')[0]); }
      await ev(() => { const FG = VR.FolkGPU; if (FG._cast0) { FG.castShadows = FG._cast0; delete FG._cast0; } });
    }
    await unstage();
  } else check(false, `${tag}: the village of cell 0,1 for the street`); });
  if (!site || !site.hall) { check(false, `${tag}: the hall city of cell -2,-1`); await ctx.close(); return; }
  check(true, `${tag}: the hall city of cell -2,-1`);
  const r = site.hall.r, F = site.hall.F, W2 = (u, v) => { const q = ROT[r](u, v); return [site.x + q[0], site.z + q[1]]; };
  const [px, pz] = W2(0.5, -24.5), [tx, tz] = W2(0.5, 40);
  const aim = (x, z, feet, eyeH, ax, ay, az) => [Math.atan2(-(ax - x), -(az - z)), Math.atan2(ay - (feet + eyeH), Math.hypot(ax - x, az - z))];
  const feet1 = await place(px, pz, F + 1, 0, 0, 66);
  // (the café's picture moves the eye: the pair, P1 and the crowd are seen from P1 again)
  const atP1 = async () => { await ev(([x, y, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.vel = [0, 0, 0]; }, [px, feet1, pz]); await step(6); };
  const out = await townOut();
  console.log(`  the hall city's people out: ${out}`);
  // ---------------------------------------------------------------- the portrait: two people at two blocks
  await part('portrait', async () => {
    const [yaw] = aim(px, pz, feet1, 1.62, tx, F + 1 + 8, tz), eye = [px, feet1 + 1.62, pz];
    await ev(([y]) => { const pl = VR.game.player; pl.yaw = y; pl.pitch = -0.06; }, [yaw]);
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), sx = Math.cos(yaw), sz = -Math.sin(yaw);
    const at = (d, s) => [px + fx * d + sx * s, pz + fz * d + sz * s];
    const [ax, az] = at(2, -0.42), [bx, bz] = at(2, 0.42);
    await stage([[6, 'crafter', 'adult', 'hall', ax, az], [4242, 'farmer', 'adult', null, bx, bz, { hip: 'l' }]], eye, feet1);
    const w = await prewarm();
    console.log(`  portrait: ${JSON.stringify(w)}`);
    await pic('portrait', 2);
    await unstage();
  });
  // ---------------------------------------------------------------- a café guest, close
  await part('cafe', async () => {
    const seats = (site.cafeSeats || []).slice().sort((a, b) => Math.hypot(a[0] - px, a[2] - pz) - Math.hypot(b[0] - px, b[2] - pz));
    const seat = seats[0];
    if (!seat) { check(false, `${tag}: a café seat in the hall city`); return; }
    // the guest faces the table (the seat's facing f); the eye 2.4 blocks off, 55° round from the guest's front, at a seated
    // person's eye height and a little over it
    const f = seat[3] || 0, fy0 = [0, -Math.PI / 2, Math.PI, Math.PI / 2][f], fwdX = -Math.sin(fy0), fwdZ = -Math.cos(fy0);
    const gx = seat[0] + 0.5, gz = seat[2] + 0.5, an = 0.95, cx = gx + (fwdX * Math.cos(an) - fwdZ * Math.sin(an)) * 2.4, cz = gz + (fwdZ * Math.cos(an) + fwdX * Math.sin(an)) * 2.4;
    const feet = await place(cx, cz, seat[1], 0, 0, 60);
    const [yaw, pitch] = aim(cx, cz, feet, 1.62, gx, seat[1] + 0.75, gz);
    await ev(([y, p]) => { const pl = VR.game.player; pl.yaw = y; pl.pitch = p; }, [yaw, pitch]);
    const tbl = [seat[0] + 0.5 + fwdX * 1.0, seat[1] + 1.1, seat[2] + 0.5 + fwdZ * 1.0];
    // (a Weißstadt coat: its skirt lies on the thighs, the knees and the shins show — run 2's robe hid them to the floor)
    const ys = await stage([[3304, 'crafter', 'adult', 'hall', seat[0] + 0.5, seat[2] + 0.5, { sit: seat, look: tbl }]], [cx, feet + 1.62, cz], seat[1]);
    const w = await prewarm();
    console.log(`  café (the seat ${JSON.stringify(seat)}; the guest ${JSON.stringify(ys)}): ${JSON.stringify(w)}`);
    await pic('cafe', 1);
    await unstage();
  });
  // ---------------------------------------------------------------- two people talking, from the side
  await part('pair', async () => {
    await atP1();
    const [yaw0] = aim(px, pz, feet1, 1.62, tx, F + 1 + 8, tz);
    const fx = -Math.sin(yaw0), fz = -Math.cos(yaw0), sx = Math.cos(yaw0), sz = -Math.sin(yaw0);
    // the pair 3 blocks ahead, 1.1 apart across the view, facing each other; the eye looks at their middle
    const mx = px + fx * 3, mz = pz + fz * 3, A = [mx - sx * 0.55, mz - sz * 0.55], B = [mx + sx * 0.55, mz + sz * 0.55];
    await ev(([y]) => { const pl = VR.game.player; pl.yaw = y; pl.pitch = -0.12; }, [yaw0]);
    const eye = [px, feet1 + 1.62, pz];
    await stage([[812, 'crafter', 'adult', 'hall', A[0], A[1], { pose: 'talk', talk: true, look: [B[0], feet1 + 1.5, B[1]] }], [913, 'crafter', 'adult', 'hall', B[0], B[1], { pose: 'talk', look: [A[0], feet1 + 1.5, A[1]] }]], eye, feet1);
    const w = await prewarm();
    console.log(`  pair: ${JSON.stringify(w)}`);
    await step(12);
    await pic('pair', 2);
    await unstage();
  });
  // ---------------------------------------------------------------- P1: the hall city's street with its own people
  await part('P1', async () => {
    await atP1();
    const [yaw, pitch] = aim(px, pz, feet1, 1.62, tx, F + 1 + 8, tz);
    await ev(([y, p]) => { const pl = VR.game.player; pl.yaw = y; pl.pitch = p; }, [yaw, pitch]);
    await step(10);
    const w = await prewarm();
    const s = await pic('P1', 0);
    const p1 = await ev(() => { const g = VR.game, V = g.villages, p = g.player; let vis = 0, drawn = 0, near = 0, sit = 0; for (const a of V.agents) { if (!a.vis) continue; vis++; if (a.drawn) drawn++; if (a.pose === 'sit') sit++; if (Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) < 24) near++; } return { agents: V.agents.length, inView: vis, drawn, near, seated: sit }; });
    console.log(`  P1: ${JSON.stringify(p1)}, people ${JSON.stringify(s)} (prewarm ${JSON.stringify(w)})`);
  });
  // ---------------------------------------------------------------- the forty: the picture and the costs
  await part('crowd', async () => {
    await ev(() => { if (VR.Crowd && VR.Crowd.STREET) { VR.Crowd.STREET._cap = VR.Crowd.STREET.capDefault; VR.Crowd.STREET._capP = Object.assign({}, VR.Crowd.STREET.cap); VR.Crowd.STREET.capDefault = 64; for (const k in VR.Crowd.STREET.cap) VR.Crowd.STREET.cap[k] = 64; } });
    await atP1();
    const [yaw, pitch] = aim(px, pz, feet1, 1.62, tx, F + 1 + 1.5, tz);
    await ev(([y, p]) => { const pl = VR.game.player; pl.yaw = y; pl.pitch = p; }, [yaw, pitch]);
    const eye = [px, feet1 + 1.62, pz], fx = -Math.sin(yaw), fz = -Math.cos(yaw), sx = Math.cos(yaw), sz = -Math.sin(yaw);
    const list = [];
    for (let row = 0; row < 5; row++) for (let col = 0; col < 8; col++) {
      // (all forty within the smooth people's 24 blocks — FG.NEAR: run 2's farthest corner stood 24.1 blocks off and was
      // drawn as voxels, its eleven parts eleven draws)
      const d = 4 + row * 3.8 + (col & 1) * 1.2, s = (col - 3.5) * (1.1 + row * 0.5);
      const i = row * 8 + col, age = i % 9 === 4 ? 'child' : i % 11 === 7 ? 'elder' : 'adult';
      list.push([7000 + i * 131, age === 'adult' ? ['crafter', 'farmer', 'gardener', 'baker', 'scholar'][i % 5] : age, age, 'hall', px + fx * d + sx * s, pz + fz * d + sz * s, i % 7 === 3 ? { hip: i & 1 ? 'r' : 'l' } : null]);
    }
    await stage(list, eye, feet1);
    const w = await prewarm();
    await frames(2);
    // (the picture before the costs; Balanced measured without the voxel people: run 1's v0.46 page stalled on them, and
    // Balanced draws the people smooth — the voxels are Very Low's and Low's, measured on Very Low below)
    if (info.smooth) await pic('crowd', 36);
    costs[tag] = {};
    const modes = info.smooth ? (info.mode === 'map' ? ['none', 'smooth', 'flat'] : ['none', 'smooth']) : ['none', 'voxel'];
    const load0 = os.loadavg()[0];
    costs[tag].balanced = await costRounds(modes);
    costs[tag].load = [+load0.toFixed(1), +os.loadavg()[0].toFixed(1)];
    console.log(`measure ${tag} balanced, the forty (the machine's load ${costs[tag].load.join(' → ')} on ${os.cpus().length} CPUs): ${JSON.stringify(costs[tag].balanced)}`);
    if (info.smooth) {
      const B = costs[tag].balanced;
      const fg = await ev(() => { const S = VR.FolkGPU.stats; return { asked: S.asked, got: S.got, failed: S.failed, people: S.people, mbGPU: +(S.bytes / 1048576).toFixed(2), lruMB: +((S.lru || 0) / 1048576).toFixed(2), grown: S.grown || 0, full: S.full || 0, workerMsPerPerson: +(S.workerMs / Math.max(1, S.got)).toFixed(2), castRects: S.castRects || 0 }; });
      costs[tag].meshes = fg;
      console.log(`  the meshes ${JSON.stringify(fg)} (prewarm ${JSON.stringify(w)})`);
      check(B.smooth.smooth >= 36, `${tag}: the forty drawn smooth (${B.smooth.smooth})`);
      if (info.arena) check(B.smooth.folkDraws <= 12, `${tag}: the forty in ${B.smooth.folkDraws} draws (≤ 12; the contact shadows one of them) — their draw ${B.smooth.folkMin} ms (median ${B.smooth.folk}, the least frame's ${B.smooth.folkFrameMin}), ${B.smooth.folkTris} triangles`);
      if (B.flat) check(B.smooth.casters >= 36, `${tag}: the forty in the shadow map (${B.smooth.casters} drawn into it, the pass ${B.smooth.castMin} ms at least, median ${B.smooth.cast}; the frame ${B.smooth.msMin} ms with it, ${B.flat.msMin} with the switch off)`);
      await ev(() => { VR.game.settings.smoothFolk = 1; VR.game.settings.folkShadow = 1; });
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
  check(pics === wanted, `${tag}: every picture written (${pics} of ${wanted})`);
  const errs = logs.filter(l => l.startsWith('[pageerror]'));
  console.log(`--- ${tag} logs (${logs.length})`); for (const l of logs.slice(0, 14)) console.log(l);
  check(errs.length === 0, `${tag}: no page error (${errs.length})`);
  await ctx.close();
}
