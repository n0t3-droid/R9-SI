// f-polish7 in the browser (docs/superpowers/plans/2026-11-01-f-polish7.md): seed 4242, de-DE, 800 × 450, High; each build
// in its own context — BUILDS=before,after (before = .tmp_tests/base/dist, the v042 build; after = dist/):
//   ride  · a caravan ride, a picture every 5 s of its clock (the rider's view: yaw +0.35, pitch −0.07)
//   woods · a planted wood along a 150-m corridor, walked (stepped, 2.2 m/s): every moment pictured 0.8 s after it starts,
//           its share of the frame and whether it is in view; the director's update timed every frame (Very Low, High)
//           and the rendered frame's median (12 frames, Very Low / High)
//   hand  · Very Low, the held block (sandstone, grass): its own pixels (hand on − hand off) — mean HSV saturation
//   lift  · the Himmelsleiter, a picture every 5 s of its clock (the space phase from 25 s)
// → test/shots/p7_<tag>_*.jpg, test/shots/polish7_sheet.jpg, .tmp_tests/polish7_run.json
//   nohup bash test/wt_run.sh polish7.mjs 3600 > .tmp_tests/polish7.log 2>&1 &     (ONLY=ride,woods,hand,lift)
// regress: skip  (pictures and measures; the gates are test/polish7.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '').replace(/\/\.tmp_tests$/, '');
const SHOTS = ROOT + '/test/shots/';
const BUILDS = (process.env.BUILDS || 'before,after').split(',');
const DISTS = { before: 'file://' + ROOT + '/.tmp_tests/base/dist/index.html', after: 'file://' + ROOT + '/dist/index.html' };
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, want = (s) => !ONLY || ONLY.includes(s);
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + ' (' + secs() + ')'); };
const RUN = {};
const saveRun = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/polish7_run.json', JSON.stringify(RUN, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const pystat = (args) => { try { return JSON.parse(execFileSync('python3', ['-c', `
import sys, json
from PIL import Image
a = Image.open(sys.argv[1]).convert('RGB'); W, H = a.size
b = Image.open(sys.argv[2]).convert('RGB') if sys.argv[2] != '-' else None
box = json.loads(sys.argv[3]); bx = [int(box[0] * W), int(box[1] * H), int(box[2] * W), int(box[3] * H)]
def sat(p): return (max(p) - min(p)) / max(p)
pa = a.load(); S = []; B = []
for y in range(bx[1], bx[3]):
  for x in range(bx[0], bx[2]):
    p = pa[x, y]
    if max(p) > 50: B.append(sat(p))
    if b is not None:
      q = b.load()[x, y]
      if abs(p[0] - q[0]) + abs(p[1] - q[1]) + abs(p[2] - q[2]) > 30 and max(p) > 30: S.append(sat(p))
print(json.dumps({'box': round(sum(B) / max(1, len(B)), 3), 'block': round(sum(S) / max(1, len(S)), 3) if S else None, 'px': len(S)}))
`, ...args]).toString()); } catch (e) { return { err: String(e.message).slice(0, 160) }; } };
const sheet = [];
const ORDER = ['ride', 'lift', 'woods', 'hand'];
const writeSheet = () => { if (!sheet.length) return; const spec = ROOT + '/.tmp_tests/polish7_sheet.json'; const rows = sheet.map((r, i) => [r, i]).sort((a, b) => (ORDER.indexOf(a[0].scene) - ORDER.indexOf(b[0].scene)) || (a[0].part - b[0].part) || (a[0].tag === b[0].tag ? a[1] - b[1] : a[0].tag === 'before' ? -1 : 1)).map(r => ({ label: r[0].label, imgs: r[0].imgs })); fs.writeFileSync(spec, JSON.stringify({ w: 620, rows })); try { console.log('  ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'polish7_sheet.jpg', spec]).toString().trim().slice(0, 160)); } catch (e) { console.log('  (no sheet: ' + e.message.slice(0, 100) + ')'); } };
const strip = (scene, tag, label, imgs) => { imgs = imgs.filter(Boolean); for (let i = 0; i < imgs.length; i += 6) sheet.push({ scene, tag, part: i / 6, label: label + (imgs.length > 6 ? ' ' + (i / 6 + 1) : ''), imgs: imgs.slice(i, i + 6) }); };

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
for (const TAG of BUILDS) {
  const R = RUN[TAG] = {};
  console.log('== ' + TAG + ' (' + DISTS[TAG] + ')');
  const ctx = await browser.newContext({ viewport: { width: 800, height: 450 }, locale: 'de-DE' });
  const page = await ctx.newPage();
  const logs = [];
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 600)));
  page.on('console', m => { if (m.type() === 'error') logs.push('[error] ' + m.text().slice(0, 300)); });
  const wait = (ms) => page.waitForTimeout(ms);
  let where = 'boot';
  const ev = (fn, a) => Promise.race([page.evaluate(fn, a), new Promise((_, rej) => setTimeout(() => rej(new Error('evaluate timeout at ' + where)), 180000))]);
  const tick = setInterval(() => console.log('    … ' + secs() + ' at ' + where), 60000);
  const pshot = async (name) => { await ev(() => VR.Journey && VR.Journey.pause(true)); await wait(150); const f = SHOTS + 'p7_' + TAG + '_' + name; try { await page.screenshot({ path: f, type: 'jpeg', quality: 82, timeout: 240000 }); console.log('  📷 ' + name); } catch (e) { console.log('  (no picture ' + name + ')'); } await ev(() => VR.Journey && VR.Journey.pause(false)); return f; };
  const jst = () => ev(() => Object.assign(VR.Journey.stats(), { dim: VR.game.dim, state: VR.game.state, pj: !!(VR.Portal && VR.Portal.J && VR.Portal.J()) }));
  // stepped mode (no rAF): n frames of dtms, rendering skipped unless asked
  const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._r7) { g.renderer._r7 = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._r7(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { if (window.__each) window.__each(g, d / 1000); g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(2); } };
  const grab = async (name, frames = 3) => {
    const url = await ev((frames) => { try { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/jpeg', 0.9); window.__norender = true; return u; } catch (e) { window.__norender = true; return null; } }, frames);
    if (url && url.length > 2000) { const f = SHOTS + 'p7_' + TAG + '_' + name; fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); console.log('  📷 ' + name); return f; }
    console.log('  !! no picture ' + name); return null;
  };
  const settle = async (max = 40) => { for (let i = 0; i < max; i++) { await step(20, 16); const s = await ev(() => { const g = VR.game, w = g.world; return { busy: g.pool.busy, pend: w ? w.pending.size : -1, st: g.state }; }); if (s.st === 'play' && s.busy === 0 && s.pend === 0 && i > 2) return true; await wait(30); } return false; };

  await page.goto(DISTS[TAG]);
  for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => window.VR && VR.game && VR.game.state === 'title').catch(() => false)) break; }
  await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 5; g.applySettings('*'); });
  await ev(() => VR.game.createWorld({ name: 'Polish7', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: '4242', cheats: true, kit: true }));
  for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  check(await ev(() => VR.game.state) === 'play', TAG + ': a new world');
  await ev(() => { const g = VR.game; if (g.ui.screen) g.ui.resume(); g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(2600); if (g.settings) g.settings.wow = false; if (VR.Journey) VR.Journey.forceGL = true; });
  await wait(6000);

  // ---------------------------------------------------------------- 1 · the caravan (real time)
  if (want('ride')) {
    where = 'ride';
    await ev(() => { const p = VR.game.player; p.flying = true; p.safeTeleport(-112, 100, -90); });
    let carts = [];
    for (let i = 0; i < 90 && !carts.length; i++) { await wait(1000); carts = await ev(() => VR.Journey.carts()); }
    for (let i = 0; i < 40; i++) { if (!(await ev(() => !!VR.game.player.hold))) break; await wait(1000); }
    const imgs = [];
    if (carts.length) {
      const c = carts[0];
      await ev((c) => { const p = VR.game.player; p.flying = false; p.pos = [c.x + 1.2, c.y + 0.2, c.z + 0.6]; p.vel = [0, 0, 0]; }, c);
      let off = null; for (let i = 0; i < 24 && !off; i++) { await wait(500); off = (await jst()).offer; }
      if (off) await page.keyboard.press('v'); else await ev(() => VR.Journey.ride && VR.Journey.ride(VR.game));
      await wait(800);
      const on = (await jst()).kind === 'ride';
      check(on, TAG + ': on the cart (' + (off ? '[V]' : 'JY.ride') + ')');
      let next = 0; const t0 = Date.now();
      while (on && (Date.now() - t0) / 1000 < 420 && imgs.length < 7) {
        await wait(300); const s = await jst(); if (!s.kind) break;
        if (s.t >= next) { await ev(() => { const J = VR.Journey.M.J; if (J && J.at) { const p = VR.game.player; p.yaw = J.at.yaw + 0.35; p.pitch = -0.07; } }); await wait(120); imgs.push(await pshot('ride_' + String(Math.round(next)).padStart(2, '0') + '.jpg')); next += 5; }
      }
      await ev(() => VR.Journey.skip());
      await wait(3000);
    }
    R.ride = imgs.length;
    check(imgs.length >= 5, TAG + ': ' + imgs.length + ' ride pictures');
    strip('ride', TAG, (TAG === 'before' ? 'VORHER' : 'NACHHER') + ' · Karawane, Blick vom Kutschbock (alle 5 s)', imgs);
    saveRun(); writeSheet();
  }

  // ---------------------------------------------------------------- 2 · a wood, walked (stepped)
  if (want('woods') || want('hand')) {
    where = 'woods';
    await ev(() => { window.__raf = window.__raf || window.requestAnimationFrame; window.requestAnimationFrame = () => 0; });
    // a land spot for the corridor: firm ground, no water, ≤ 8 m of relief along 120 m (render distance 7 meanwhile, the
    // player over the corridor's middle: all of it loaded)
    let base = null; const tried = [];
    await ev(() => { const g = VR.game; g.settings.renderDist = 7; g.applySettings('*'); });
    for (const [x, z] of [[150, 40], [-60, 160], [220, -120], [-240, 60], [60, -260], [320, 200], [-20, -200], [400, -40]]) {
      await ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.teleport(x + 60.5, 140, z + 0.5); }, [x, z]);
      await settle(60);
      const r = await ev(([x, z]) => { const w = VR.game.world, R = VR.R, F = VR.F; const ys = []; for (let dx = 0; dx <= 120; dx += 10) { const t = w.topAt(x + dx, z); const b = t > 0 ? w.getBlock(x + dx, t, z) : 0; if (!b) return 'unloaded ' + dx; if ((R.T.flags[b] & F.WATER) || t < 63) return 'water ' + dx; ys.push(t); } return Math.max(...ys) - Math.min(...ys) <= 8 ? ys[0] : 'relief ' + (Math.max(...ys) - Math.min(...ys)); }, [x, z]);
      tried.push(x + ',' + z + ': ' + r);
      if (typeof r === 'number') { base = [x, r, z]; break; }
    }
    console.log('  corridor: ' + tried.join(' · '));
    check(!!base, TAG + ': a land corridor for the wood ' + JSON.stringify(base));
    if (base) {
      const info = await ev(([x0, y0, z0]) => {
        const g = VR.game, w = g.world, R = VR.R, F = VR.F, st = (n) => (R.byName[n] ? R.byName[n].defaultState : 0);
        const hh = (x, z, s) => { let v = (x * 374761393 + z * 668265263 + s * 982451653) | 0; v = Math.imul(v ^ (v >>> 13), 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
        const gy = (x, z) => { for (let y = 160; y > 30; y--) { const s = w.getBlock(x, y, z); if (s && (R.T.flags[s] & F.OPAQUE) && !(R.T.flags[s] & F.LEAVES)) return y; } return -1; };
        const list = [], put = (x, y, z, s) => list.push([x, y, z, s]), log = st('oak_log'), lv = st('oak_leaves'), gr = st('short_grass');
        let trees = 0;
        for (let x = x0 - 6; x < x0 + 126; x += 5) for (let z = z0 - 22; z <= z0 + 22; z += 5) {
          const tx = x + Math.floor(hh(x, z, 3) * 3), tz = z + Math.floor(hh(x, z, 4) * 3);
          if (Math.abs(tz - z0) < 3 || hh(x, z, 1) > 0.72) continue;   // (the path free)
          if (tx > x0 + 62 && tx < x0 + 76 && Math.abs(tz - z0) < 9) continue;   // (a clearing on the way)
          const y = gy(tx, tz); if (y < 0) continue; const h = 4 + Math.floor(hh(x, z, 5) * 3);
          for (let k = 1; k <= h; k++) put(tx, y + k, tz, log);
          for (let dy = -2; dy <= 1; dy++) { const r = dy === 1 ? 1 : 2; for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) { if (Math.abs(dx) === r && Math.abs(dz) === r) continue; if (dx === 0 && dz === 0 && dy < 1) continue; put(tx + dx, y + h + dy, tz + dz, lv); } }
          trees++;
        }
        const set = new Set(list.map(e => e[0] + ',' + e[1] + ',' + e[2]));
        for (let x = x0 - 6; x < x0 + 126; x++) for (let z = z0 - 22; z <= z0 + 22; z++) { if (hh(x, z, 2) > 0.35) continue; const y = gy(x, z); if (y < 0 || set.has(x + ',' + (y + 1) + ',' + z) || w.getBlock(x, y + 1, z)) continue; put(x, y + 1, z, gr); }
        w.bulkSet(list, false);
        return { trees, blocks: list.length };
      }, base);
      console.log('  the wood: ' + JSON.stringify(info));
      await settle(60);
      // the walker: along the corridor at 2.2 m/s, gently weaving; the director's update timed every frame
      const walkWood = async (preset, dur, pics) => {
        await ev(([p0, preset]) => {
          const g = VR.game; g.applyPreset(preset); g.settings.dynRes = false; g.settings.renderDist = 7; g.settings.wander = true; g.applySettings('*');
          const pl = g.player; pl.flying = false; pl.teleport(p0[0] + 0.5, p0[1] + 1.05, p0[2] + 0.5);
          const D = g.wanderer; if (D && !D.__t7) { const u = D.update.bind(D); D.__t7 = { n: 0, ms: 0, max: 0, fr: [] }; D.update = function (dt) { const t0 = performance.now(); const r = u(dt); const e = performance.now() - t0; const T = this.__t7; T.n++; T.ms += e; if (e > T.max) T.max = e; if (T.fr.length < 20000) T.fr.push(e); return r; }; }
          if (D) { D.__t7.n = 0; D.__t7.ms = 0; D.__t7.max = 0; D.__t7.fr = []; }
          window.__w7 = { x: p0[0] + 0.5, z0: p0[2] + 0.5, t: 0 };
          window.__each = (g, dt) => { const W = window.__w7, p = g.player; if (!W || g.state !== 'play') return; W.t += dt; W.x += 2.2 * dt; const z = W.z0 + Math.sin(W.t * 0.15) * 1.2; const t = g.world.topAt(Math.floor(W.x), Math.floor(z)); p.pos[0] = W.x; p.pos[2] = z; p.pos[1] = Math.max(t, 60) + 1.02; if (p.vel) { p.vel[0] = p.vel[1] = p.vel[2] = 0; } p.flying = true; p.yaw = -Math.PI / 2 + Math.sin(W.t * 0.15) * 0.12; p.pitch = -0.06; p.viewYaw = p.yaw; };
          return true;
        }, [base, preset]);
        const shots = [];
        let seen = await ev(() => VR.game.wanderer ? VR.game.wanderer.timeline.length : 0);
        for (let s = 0; s < dur; s++) {
          await step(30, 33);
          if (!pics) continue;
          const tl = await ev(() => VR.game.wanderer.timeline.length);
          if (tl > seen) {
            const e = await ev((i) => { const D = VR.game.wanderer; return Object.assign({}, D.timeline[i]); }, tl - 1); seen = tl;
            if (String(e.kind).startsWith('b:') || shots.length >= pics) continue;
            await step(24, 33);
            const sh = await ev((kind) => { const g = VR.game, D = g.wanderer, m = D.ms.find(q => q.kind === kind), c = g.cam; if (!m || !m.pos) return null; const fig = { pet: 1.0, crossing: 0.7, scrap: 0.95 }[kind] || (VR.Wander.KINDS[kind] ? VR.Wander.KINDS[kind].fig : 1.6); const sc = (VR.Wander.KINDS[kind] && VR.Wander.KINDS[kind].fam === 'animal') ? VR.Wander.STAGE.animal : kind === 'scrap' ? (VR.Wander.SCRAP_S || 1) : 1; const hg = fig * sc; const q = m.Q ? m.Q[0].pos : m.pos; const d = Math.hypot(q[0] - c.x, q[1] + hg / 2 - c.y, q[2] - c.z); const v = VR.EventLog && VR.EventLog.inView ? VR.EventLog.inView([q[0], q[1] + hg / 2, q[2]], 0.6, g) : { inView: null }; return { d: +d.toFixed(1), share: +(hg / (2 * d * Math.tan((g.settings.fov || 70) * Math.PI / 360))).toFixed(3), inView: v.inView, ctx: D.ctx ? D.ctx.at : null }; }, e.kind);
            const f = await grab('wood_' + String(s).padStart(2, '0') + '_' + e.kind + '.jpg');
            shots.push({ s, kind: e.kind, f, sh });
            console.log(`    ${s} s ${e.kind}: ${JSON.stringify(sh)}`);
          }
        }
        const T = await ev(() => { const D = VR.game.wanderer, T = D && D.__t7; if (!T) return null; const fr = T.fr.slice().sort((a, b) => a - b); return { n: T.n, mean: +(T.ms / Math.max(1, T.n)).toFixed(4), p99: +(fr[Math.floor(fr.length * 0.99)] || 0).toFixed(3), max: +T.max.toFixed(2), started: D.st.started }; });
        // the rendered frame's median (12 frames to the GPU's end), the director on
        const frame = await ev(() => { const g = VR.game, gl = g.renderer.gl, times = []; window.__norender = false; for (let i = 0; i < 16; i++) { const a = performance.now(); g.last = a - 33; g.loop(a); gl.finish(); if (i >= 4) times.push(performance.now() - a); } window.__norender = true; times.sort((x, y) => x - y); return +times[Math.floor(times.length / 2)].toFixed(2); });
        return { T, frame, shots };
      };
      if (want('woods')) {
        const hi = await walkWood('high', 52, 5);
        R.woodsHigh = { T: hi.T, frame: hi.frame, shots: hi.shots.map(s => ({ s: s.s, kind: s.kind, sh: s.sh })) };
        console.log('  High: the director ' + JSON.stringify(hi.T) + ', frame median ' + hi.frame + ' ms');
        const vl = await walkWood('potato', 40, 0);
        R.woodsVL = { T: vl.T, frame: vl.frame };
        console.log('  Very Low: the director ' + JSON.stringify(vl.T) + ', frame median ' + vl.frame + ' ms');
        const inv = hi.shots.filter(s => s.sh && s.sh.inView), big = hi.shots.filter(s => s.sh && s.sh.share >= 0.06);
        check(hi.shots.length >= 2, TAG + ': moments in the wood (' + hi.shots.map(s => s.kind).join(', ') + ')');
        if (TAG === 'after') {
          check(vl.T && vl.T.mean <= 0.05, 'after: Very Low, the director ≤ 0.05 ms a frame (' + (vl.T && vl.T.mean) + ' ms, p99 ' + (vl.T && vl.T.p99) + ')');
          check(inv.length === hi.shots.length && big.length === hi.shots.length, 'after: every moment in view and ≥ 6 % of the frame (' + inv.length + ' / ' + big.length + ' of ' + hi.shots.length + ')');
        }
        strip('woods', TAG, (TAG === 'before' ? 'VORHER' : 'NACHHER') + ' · Momente im Wald (0,8 s nach dem Start)', hi.shots.map(s => s.f));
        saveRun(); writeSheet();
      }
      // ---------------------------------------------------------------- 3 · the held block on Very Low
      if (want('hand')) {
        where = 'hand';
        await ev(([p0]) => { const g = VR.game; window.__each = null; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); const pl = g.player; pl.teleport(p0[0] + 69.5, p0[1] + 1.05, p0[2] + 0.5); pl.yaw = -Math.PI / 2; pl.pitch = -0.35; pl.viewYaw = pl.yaw; }, [base]);
        await settle(20);
        const H = {};
        for (const id of ['sandstone', 'grass_block']) {
          await ev((id) => { const g = VR.game, inv = g.player.inv; inv.slots[inv.sel] = { id, n: 1 }; inv.changed = true; g.hideHud = false; }, id);
          await step(10, 33);
          const on = await grab('hand_' + id + '.jpg', 4);
          await ev(() => { VR.game.hideHud = true; });
          const off = await grab('hand_' + id + '_off.jpg', 4);
          await ev(() => { VR.game.hideHud = false; });
          H[id] = Object.assign(pystat([on, off, JSON.stringify([0.55, 0.6, 1, 1])]), pystat([on, '-', JSON.stringify([840 / 1280, 560 / 720, 990 / 1280, 700 / 720])]).box !== undefined ? { critic: pystat([on, '-', JSON.stringify([840 / 1280, 560 / 720, 990 / 1280, 700 / 720])]).box } : {});
          H[id].f = on;
        }
        R.hand = H;
        console.log('  Very Low, the held block: ' + JSON.stringify(H, (k, v) => (k === 'f' ? undefined : v)));
        if (TAG === 'after') check(H.sandstone && H.sandstone.block !== null && H.sandstone.block <= 0.55 && H.grass_block.block <= 0.55, 'after: R56-13 the held block\'s own pixels ≤ 0.55 saturated on Very Low (sandstone ' + (H.sandstone && H.sandstone.block) + ', grass ' + (H.grass_block && H.grass_block.block) + ')');
        strip('hand', TAG, (TAG === 'before' ? 'VORHER' : 'NACHHER') + ' · Sehr niedrig: der Block in der Hand (Sandstein, Gras)', [H.sandstone && H.sandstone.f, H.grass_block && H.grass_block.f]);
        await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 5; g.applySettings('*'); });
        saveRun(); writeSheet();
      }
    }
    await ev(() => { window.__each = null; window.__norender = false; if (window.__raf) window.requestAnimationFrame = window.__raf; const g = VR.game; g.last = performance.now(); requestAnimationFrame((t) => g.loop(t)); });
    await wait(3000);
  }

  // ---------------------------------------------------------------- 4 · die Himmelsleiter (real time)
  if (want('lift')) {
    where = 'lift';
    await ev(() => { const p = VR.game.player; p.flying = true; p.safeTeleport(-283.5, 120, -126.5); });
    let base = null;
    for (let i = 0; i < 90 && !base; i++) { await wait(1000); base = await ev(() => { const b = VR.Journey.M.base; return b && b.y !== null ? { x: b.x, y: b.y, z: b.z } : null; }); }
    for (let i = 0; i < 40; i++) { if (!(await ev(() => !!VR.game.player.hold))) break; await wait(1000); }
    if (base) await ev((b) => { const p = VR.game.player; p.flying = false; p.pos = [b.x, b.y + 0.2, b.z]; p.vel = [0, 0, 0]; p.yaw = 0.6; p.pitch = -0.12; }, base);
    let started = false; for (let i = 0; i < 30 && !started; i++) { await wait(500); started = (await jst()).kind === 'lift'; }
    if (!started) await ev(() => VR.Journey.lift(VR.game));
    const imgs = []; let next = 0; const t0 = Date.now(), log = [];
    while ((Date.now() - t0) / 1000 < 1500) {
      await wait(300);
      const s = await jst(); if (!s.kind && !s.pj) break;
      if (s.kind && s.t >= next) {
        if (s.ph !== 'space') await ev((k) => { const p = VR.game.player; p.yaw = 0.6 + k * 0.8; p.pitch = -0.12 - k * 0.35; }, Math.min(1, s.t / 24));
        imgs.push(await pshot('lift_' + String(Math.round(next)).padStart(2, '0') + '.jpg')); log.push(next + ' s ' + s.ph + ' ' + Math.round(s.alt || 0) + ' m'); next += 5;
      }
    }
    R.lift = log;
    console.log('  the lift: ' + log.join(' · '));
    check(imgs.length >= 9, TAG + ': ' + imgs.length + ' lift pictures');
    strip('lift', TAG, (TAG === 'before' ? 'VORHER' : 'NACHHER') + ' · Himmelsleiter (alle 5 s; ab 25 s der Raum)', imgs.slice(4));
    saveRun(); writeSheet();
  }
  if (logs.length) console.log('  page: ' + logs.slice(0, 5).join('\n  '));
  clearInterval(tick);
  await ctx.close();
}
await browser.close();
saveRun(); writeSheet();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
