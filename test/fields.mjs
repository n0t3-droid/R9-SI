// u-fields · the ring, the cloud tops, the swarm and a rubble body in the browser (plan
// docs/superpowers/plans/2026-10-30-u-fields.md). 1280 × 720, de-DE, seed 53. A page a preset:
//   High:     /raum ring (inside the 10-m sheet) → ring_cross; /raum cassini → ring_cassini; /raum ringschatten →
//             ring_shadow; /raum wolken → cloudtops (+ cloudtops_night, the lightning); /raum schwarm → swarm;
//             /dim brocken 1 → rubble_land, a jump measured (39 ± 2 m with the anchor boots), rubble_mine (blocks broken
//             with the hand: carbon rubble and its dust), rubble_drift (boots off: a jump drifts off, the body below)
//   Very Low: the plaza frame and the ring frame on the same page (rounds in turns, the medians): the ring ≤ the plaza;
//             ring_cross_vl; the chunk count by tier (300 / 10,000)
// → test/shots/fields_sheet.jpg, .tmp_tests/fields_run.json
//   nohup bash test/wt_run.sh fields.mjs 3600 > .tmp_tests/fields.log 2>&1 &
//   PRESETS=high,potato · ONLY=ring,cassini,shadow,clouds,swarm,rubble · ROUNDS=3
// regress: skip  (a showcase with pictures and the costs; the gate is test/fields.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import fs from 'fs';
import { execSync, execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname;
const DIST = process.env.DIST || 'file://' + ROOT + 'dist/index.html';
const SHOTS = ROOT + 'test/shots/';
const SEED = process.env.SEED || '53', RD = 8, ROUNDS = +(process.env.ROUNDS || 3), K = 3;
const PRESETS = (process.env.PRESETS || 'high,potato').split(',');
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (k) => !ONLY || ONLY.includes(k);
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const r1 = (x) => Math.round(x * 10) / 10;
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const rec = { seed: SEED, presets: {} };
const save = () => { try { fs.writeFileSync(ROOT + '.tmp_tests/fields_run.json', JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const spread = async (path) => {
  const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true });
  const C = info.channels; let s = 0, s2 = 0, n = 0;
  for (let i = 0; i < data.length; i += C * 7) { const L = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; s += L; s2 += L * L; n++; }
  const m = s / n; return { mean: r1(m), sd: r1(Math.sqrt(Math.max(0, s2 / n - m * m))) };
};
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const cpuNow = () => {
  const kids = new Map();
  for (const l of execSync('ps -e -o pid=,ppid=').toString().trim().split('\n')) { const [p, pp] = l.trim().split(/\s+/).map(Number); if (!kids.has(pp)) kids.set(pp, []); kids.get(pp).push(p); }
  let t = 0; const st = [process.pid];
  while (st.length) { for (const c of kids.get(st.pop()) || []) { st.push(c); try { const s = fs.readFileSync(`/proc/${c}/stat`, 'utf8'), f = s.slice(s.lastIndexOf(')') + 2).split(' '); t += +f[11] + +f[12]; } catch (e) { } } }
  return t * 10;
};
async function openPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
  page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log('  !! the page crashed'); });
  await page.goto(DIST);
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(() => {
    const r = VR.game.renderer, gl = r.gl;
    window.__px = new Uint8Array(4);
    window.__sync = () => { const d = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING), rd = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, window.__px); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, d); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, rd); };
    r._render = r.render;
    r.render = function (F) { if (window.__norender) { window.__F = F; this.setupCamera(F.cam); return; } return this._render(F); };
  });
  const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
  const boost = (on) => ev((on) => { const q = VR.game.renderer && VR.game.renderer.q; if (!q) return; if (on) { if (q.__up === undefined) q.__up = q.upload; q.upload = 24; } else if (q.__up !== undefined) { q.upload = q.__up; delete q.__up; } }, on);
  const settle = async (max = 400) => {
    let s = null, last = Infinity, stall = 0;
    await boost(true);
    for (let i = 0; i < max; i++) {
      await step(10);
      s = await ev(() => { const g = VR.game, w = g.world, p = g.player; if (!w || !p) return { none: true }; const rd = Math.max(1, (w.renderDist | 0) - 1), ri = Math.max(1, rd - 2), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if ((sc.dirty || sc.pending) && sc.count > 0) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= ri * ri) dirty += n; } let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown, arr: w.arrivals ? w.arrivals.length : 0 }; });
      if (s.none) { await wait(60); continue; }
      const shown = s.pend === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0 && s.arr === 0;
      stall = shown && s.dirty >= last ? stall + 1 : 0; last = s.dirty;
      s.i = i;
      if (shown && ((s.busy === 0 && s.dirty === 0) || stall >= 6)) break;
      await wait(60);
    }
    await boost(false);
    return s;
  };
  const groundY = (x, z) => ev(([x, z]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = 200; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & (F.OPAQUE | F.FLUID)) && !(R.T.flags[s] & F.LEAVES)) return y; } return 80; }, [x, z]);
  const pose = (x, feet, z, yaw, pitch, fov) => ev(([x, y, z, yaw, pitch, fov]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = yaw; p.pitch = pitch; p.viewYaw = yaw; p.fovKick = 0; p.vel = [0, 0, 0]; g.settings.fov = fov; }, [x, feet, z, yaw, pitch, fov]);
  return { ctx, page, logs, ev, wait, step, settle, groundY, pose };
}
const errsOf = (P) => P.logs.filter(l => l.startsWith('[pageerror]') || /fields shader/.test(l));
async function makeWorld(P, preset) {
  await P.ev(([p, rd]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = Math.min(rd, (VR.Game.PRESETS[p] || {}).renderDist || rd); g.applySettings('*'); }, [preset, RD]);
  await P.ev((seed) => VR.game.createWorld({ name: 'Felder', mode: 'creative', difficulty: 'peaceful', type: 'default', seed, cheats: true, kit: true }), SEED);
  for (let i = 0; i < 150; i++) { await P.wait(1000); if (await P.ev(() => VR.game.state) === 'play') break; }
  const ok = await P.ev(() => VR.game.state) === 'play';
  await P.ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui', 'hints']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } if (VR.UIPrefs) VR.UIPrefs.set({ pro: true }); const st = document.createElement('style'); st.textContent = '#hint,#hints,#lockhint,#toasts,.toast,#travelVeil{display:none !important}'; document.head.appendChild(st); VR.Fields.timeK = 0; });
  return ok;
}
const picture = async (P, key, path, k) => {
  const m = await P.ev(([key, k]) => {
    const g = VR.game, r = g.renderer, gl = r.gl, F = window[key];
    if (!F) return { err: 'no frame kept' };
    window.__norender = false;
    r.frameNo = 1000; r.tsrReset = true; r.shadowValid = false;
    try { for (let i = 0; i < k; i++) r.render(F); } catch (e) { window.__norender = true; return { err: String(e && e.stack || e).slice(0, 600) }; }
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let s = ''; const CH = 0x8000; for (let i = 0; i < px.length; i += CH) s += String.fromCharCode.apply(null, px.subarray(i, i + CH));
    window.__norender = true;
    return { png: btoa(s), W, H, draws: r.stats.draws, tris: Math.round(r.stats.tris) };
  }, [key, k]);
  if (m.err) return m;
  await sharp(Buffer.from(m.png, 'base64'), { raw: { width: m.W, height: m.H, channels: 4 } }).flip().removeAlpha().png().toFile(path);
  delete m.png;
  return m;
};
const cost = async (P, key, k, n) => {
  await P.ev(([key, k]) => { const r = VR.game.renderer, F = window[key]; window.__norender = false; r.frameNo = 1000; r.tsrReset = true; r.shadowValid = false; for (let i = 0; i < k; i++) r.render(F); window.__sync(); window.__norender = true; }, [key, k]);
  const c0 = cpuNow();
  const wall = await P.ev(([key, n]) => { const r = VR.game.renderer, F = window[key], out = []; window.__norender = false; for (let i = 0; i < n; i++) { const t0 = performance.now(); r.render(F); window.__sync(); out.push(performance.now() - t0); } window.__norender = true; return out; }, [key, n]);
  return { cpuMs: (cpuNow() - c0) / n, wallMs: med(wall) };
};
// a /raum view opened as a player opens it, stepped until it is shown with its textures, the frame kept as `key`
async function raum(P, cmd, key, setup) {
  const t1 = Date.now();
  await P.ev(([cmd, setup]) => { const g = VR.game; g.env.day = 20; g.env.ticks = 14400; if (setup) Object.assign(VR.Fields, setup); g.chat('/raum ' + cmd); }, [cmd, setup || null]);
  let st = null;
  for (let i = 0; i < 600; i++) {
    await P.step(3);
    st = await P.ev(() => { const g = VR.game, SS = VR.SpaceScene, need = SS.cur_need || []; return g.space ? { ready: g.space.ready, frames: g.space.frames, done: need.filter(s => s.done).length, need: need.length } : { closed: true }; });
    if (st.closed || (st.ready && st.done === st.need && st.frames >= 3)) break;
    if (Date.now() - t1 > 240000) break;
    await P.wait(40);
  }
  await P.ev((key) => { window[key] = window.__F; }, key);
  const S = await P.ev(() => { const F = VR.Fields, SS = VR.SpaceScene; return Object.assign({}, F.stats, { list: SS.cur ? SS.cur.draws.map(d => d.prog).join(' ') : '', progs: F.progs().join(','), failed: F.failed().join(',') }); });
  return { st, S, wallS: r1((Date.now() - t1) / 1000) };
}
async function shotRaum(P, R, id, cmd, setup, expect) {
  const v = await raum(P, cmd, '__Fv', setup);
  const path = SHOTS + id + '.png', m = await picture(P, '__Fv', path, K), sp = m.err ? { sd: 0 } : await spread(path);
  R.views[id] = { wallS: v.wallS, stats: v.S, draws: m.draws, tris: m.tris, picture: sp, err: m.err };
  console.log(`  ${id}: ${v.st && v.st.ready ? 'shown' : 'NOT shown'} after ${v.wallS} s, ${m.err ? 'ERR ' + m.err : m.draws + ' draws, ' + m.tris + ' tris'} (${v.S.list}) stats ${JSON.stringify(v.S)} L ${sp.mean} ± ${sp.sd} (${secs()})`);
  check(v.st && v.st.ready && !m.err && sp.sd > 3 && !v.S.failed && (!expect || expect(v.S)), `${id}: test/shots/${id}.png`);
  await P.ev(() => { VR.game.chat('/raum aus'); });
  return v;
}

async function runPreset(preset) {
  const tag = preset === 'potato' ? 'vl' : 'high', R = rec.presets[tag] = { views: {}, cost: {} };
  console.log(`\n${tag} (${secs()})`);
  const P = await openPage();
  try {
    const ok = await makeWorld(P, preset);
    check(ok, `the world is loaded (${secs()})`);
    if (!ok) return;
    if (preset === 'potato') {
      // the plaza frame (space0.mjs's: the temple from the plaza path at noon) and the ring's frame on the same page
      const px = 4.5, pz = 74.5;
      await P.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 150, z); }, [px, pz]);
      await P.settle(1500);
      const gy = await P.groundY(px, pz), eyeY = gy + 1 + 1.62, at = [0, 93, 0];
      await P.ev(() => { const g = VR.game; g.env.day = 2; g.env.setTime(6000); });
      await P.pose(px, eyeY - 1.62, pz, Math.atan2(-(at[0] - px), -(at[2] - pz)), Math.atan2(at[1] - eyeY, Math.hypot(at[0] - px, at[2] - pz)), 70);
      await P.settle(600); await P.step(4);
      await P.ev(() => { window.__Fplaza = window.__F; });
      const pm = await picture(P, '__Fplaza', SHOTS + 'fields_plaza_vl.png', K);
      check(!pm.err, `the plaza frame (${pm.err || pm.draws + ' draws'})`);
      const v = await raum(P, 'ring', '__Fring', { fixH: 2 });
      const m = await picture(P, '__Fring', SHOTS + 'ring_cross_vl.png', K);
      check(!m.err && v.S.chunks > 0 && v.S.chunks <= 300, `Very Low in the ring: ${v.S.chunks} chunks (≤ 300), ${v.S.steps} sheet steps, test/shots/ring_cross_vl.png (${v.S.list})`);
      const cp = [], cs = [], wp = [], ws = [];
      for (let rd = 0; rd < ROUNDS; rd++) { const a = await cost(P, '__Fplaza', 2, 6), b = await cost(P, '__Fring', 2, 6); cp.push(a.cpuMs); cs.push(b.cpuMs); wp.push(a.wallMs); ws.push(b.wallMs); }
      R.cost = { plazaCpu: r1(med(cp)), ringCpu: r1(med(cs)), plazaWall: r1(med(wp)), ringWall: r1(med(ws)) };
      console.log(`  cost: plaza ${R.cost.plazaWall} ms (CPU ${R.cost.plazaCpu}) · ring ${R.cost.ringWall} ms (CPU ${R.cost.ringCpu})`);
      check(R.cost.ringWall <= R.cost.plazaWall && R.cost.ringCpu <= R.cost.plazaCpu * 1.03, `Very Low: the ring frame is not dearer than the plaza frame (${R.cost.ringWall} ≤ ${R.cost.plazaWall} ms, CPU ${R.cost.ringCpu} ≤ ${R.cost.plazaCpu})`);
      // the switch off: the ring as the annulus only
      await P.ev(() => { VR.game.settings.fields = false; });
      const v0 = await raum(P, 'ring', '__Fring0', { fixH: 2 });
      check(v0.S.chunks === 0 && !/fields_/.test(v0.S.list), `the switch off: no chunks, no sheet (${v0.S.list})`);
      await P.ev(() => { VR.game.settings.fields = true; VR.game.chat('/raum aus'); });
      return;
    }
    // ---- High: the pictures
    if (want('ring')) {
      await shotRaum(P, R, 'ring_cross', 'ring', { fixH: 2 }, (S) => S.chunks > 3000);
      await shotRaum(P, R, 'ring_above', 'ring', { fixH: 30 }, (S) => S.chunks > 0);
      const n = await P.ev(() => VR.Fields.stats.chunks);
      check(n >= 6000 && n <= 10000, `High: ${n} chunks (≤ 10,000)`);
    }
    if (want('cassini')) await shotRaum(P, R, 'ring_cassini', 'cassini', { fixH: undefined });
    if (want('shadow')) await shotRaum(P, R, 'ring_shadow', 'ringschatten');
    if (want('clouds')) {
      await shotRaum(P, R, 'cloudtops', 'wolken', null, (S) => S.decks === 2);
      // the night side: the flyover a quarter turn on (the lightning)
      await P.ev(() => { VR.Fields.timeK = 1; });
      await shotRaum(P, R, 'cloudtops_night', 'wolken', null, null);
      await P.ev(() => { VR.Fields.timeK = 0; });
    }
    if (want('swarm')) await shotRaum(P, R, 'swarm', 'schwarm', null, (S) => S.rocks === 60);
    if (want('rubble')) {
      // a rubble body: /dim brocken 1 (the big spinning top), the landing, the jump, mining, drifting off
      await P.ev(() => { VR.Fields.sunFix = [0.62, 0.42, 0.45]; VR.game.chat('/dim brocken 1'); });
      let s = null;
      for (let i = 0; i < 900; i++) { await P.step(10); s = await P.ev(() => ({ dim: VR.game.dim, state: VR.game.state })); if (s.dim === 'rock.0' && s.state === 'play') break; await P.wait(20); }
      check(s && s.dim === 'rock.0', `the trip to Brocken TS-01 (${JSON.stringify(s)}, ${secs()})`);
      await P.settle(600);
      const sp = await P.ev(() => { const g = VR.game, p = g.player, gen = new VR.RubbleGen(0, 'rock.0'), s = gen.findSpawn(); return { s, grav: p.grav, D: gen.D, big: gen.boulders[0] }; });
      // rubble_land: a few metres up behind the landing, looking over the body to its largest boulder
      const L = sp.s;
      await P.pose(L[0] + Math.sin(L[3]) * 9, L[1] + 5, L[2] + Math.cos(L[3]) * 9, L[3], -0.2, 70);
      await P.settle(200); await P.step(6);
      await P.ev(() => { window.__Fl = window.__F; });
      let m = await picture(P, '__Fl', SHOTS + 'rubble_land.png', K);
      check(!m.err && (await spread(SHOTS + 'rubble_land.png')).sd > 3, `rubble_land: test/shots/rubble_land.png (D ${sp.D} m, grav ${sp.grav && sp.grav.toFixed(3)})`);
      // the jump with the anchor boots: from the ground, the player's own physics
      const jump = await P.ev(([x, y, z]) => {
        const g = VR.game, p = g.player; p.flying = false; p.noclip = false; p.teleport(x, y, z); p.vel = [0, 0, 0];
        const stepN = (n) => { for (let i = 0; i < n; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } };
        stepN(30);
        const y0 = p.pos[1], on = p.onGround; let top = 0, t = 0, landed = 0;
        p.vel[1] = 9.1; p.onGround = false;
        for (let i = 0; i < 900; i++) { stepN(1); t += 0.033; top = Math.max(top, p.pos[1] - y0); if (i > 10 && p.onGround) { landed = t; break; } }
        return { y0, on, top, air: landed, grav: p.grav };
      }, [L[0], L[1], L[2]]);
      R.jump = jump;
      check(jump.on && Math.abs(jump.top - 39) <= 2, `a jump with the anchor boots: ${jump.top.toFixed(1)} m (39 ± 2), ${jump.air.toFixed(1)} s in the air`);
      // rubble_mine: blocks broken by hand in front of the player (the existing breaking: drops and dust)
      const mine = await P.ev(([x, y, z, yaw]) => {
        const g = VR.game, p = g.player, w = g.world, fx = -Math.sin(yaw), fz = -Math.cos(yaw), got = {};
        p.flying = true; p.noclip = true; p.teleport(x, y + 1.5, z); p.yaw = p.viewYaw = yaw; p.pitch = -0.55;
        for (let d = 2; d <= 4; d++) for (let s = -1; s <= 1; s++) for (let dy = 0; dy <= 1; dy++) {
          const bx = Math.floor(x + fx * d - fz * s), bz = Math.floor(z + fz * d + fx * s), by = Math.floor(y) - 1 - dy, st = w.getBlock(bx, by, bz);
          if (!st) continue; const nm = VR.R.types[VR.R.T.type[st]].name; got[nm] = (got[nm] || 0) + 1; p.breakBlock(bx, by, bz, st, false, true);
        }
        for (let i = 0; i < 4; i++) { g.last = performance.now() - 33; g.loop(performance.now()); }
        return got;
      }, [L[0], L[1], L[2], L[3]]);
      await P.ev(() => { window.__Fm = window.__F; });
      m = await picture(P, '__Fm', SHOTS + 'rubble_mine.png', K);
      check(!m.err && (mine.carbon_rubble || 0) > 4, `rubble_mine: broken ${JSON.stringify(mine)}, test/shots/rubble_mine.png`);
      // rubble_drift: boots off, one jump — 6 s later the player is still rising, the body below
      const drift = await P.ev(([x, y, z]) => {
        const g = VR.game, p = g.player; p.flying = false; p.noclip = false; p.teleport(x, y, z); p.vel = [0, 0, 0];
        const stepN = (n) => { for (let i = 0; i < n; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } };
        stepN(20); VR.Fields.setBoots(g, false);
        const y0 = p.pos[1]; p.vel[1] = 9.1; p.onGround = false; p.vel[0] = 1.2;
        stepN(Math.round(9 / 0.033));
        p.pitch = -1.05;
        return { up: p.pos[1] - y0, vy: p.vel[1], grav: p.grav, boots: VR.Fields.rock.boots };
      }, [L[0], L[1], L[2]]);
      await P.step(2);
      await P.ev(() => { window.__Fd = window.__F; });
      m = await picture(P, '__Fd', SHOTS + 'rubble_drift.png', K);
      R.drift = drift;
      check(!m.err && !drift.boots && drift.up > 70 && drift.vy > 8.5, `rubble_drift: boots off, ${drift.up.toFixed(0)} m up after 9 s and still rising (${drift.vy.toFixed(2)} m/s), test/shots/rubble_drift.png`);
    }
  } finally {
    const errs = errsOf(P);
    check(!errs.length, `no page error, no shader failure (${errs.length})${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);
    save();
    await P.ctx.close();
  }
}
for (const p of PRESETS) await runPreset(p);
save();
// the sheet
try {
  const S = (n) => SHOTS + n + '.png', ex = (a) => a.filter(f => fs.existsSync(f));
  const spec = { w: 620, rows: [
    { label: 'Im Ring: in der 10-m-Schicht · 30 m darüber (High)', imgs: ex([S('ring_cross'), S('ring_above')]) },
    { label: 'Cassini-Teilung · der Schatten des Rings auf Amarant', imgs: ex([S('ring_cassini'), S('ring_shadow')]) },
    { label: 'Wolkenflug: Tag · Nacht (Blitze)', imgs: ex([S('cloudtops'), S('cloudtops_night')]) },
    { label: 'Trümmerschwarm · Very Low im Ring', imgs: ex([S('swarm'), S('ring_cross_vl')]) },
    { label: 'Brocken TS-01: Landung · Abbau', imgs: ex([S('rubble_land'), S('rubble_mine')]) },
    { label: 'Stiefel aus: davontreiben · die Plaza (Very Low, Kosten)', imgs: ex([S('rubble_drift'), S('fields_plaza_vl')]) },
  ].filter(r => r.imgs.length) };
  fs.writeFileSync(ROOT + '.tmp_tests/fields_sheet.json', JSON.stringify(spec));
  execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'fields_sheet.jpg', ROOT + '.tmp_tests/fields_sheet.json']);
  console.log('  sheet: test/shots/fields_sheet.jpg');
} catch (e) { console.log('  (the sheet failed: ' + String(e.message || e).slice(0, 200) + ')'); }
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
