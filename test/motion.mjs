// t-motion · WOW III · Alles bewegt sich (docs/superpowers/plans/2026-10-15-t-motion.md) — the pictures, the motion and
// the cost. A new default world (seed 53, vgen 10) of the build before (BEFORE_DIST: the base v042 build) and of this
// one, on the High preset as a player gets it (the dynamic resolution held off, the view distance 8 for both), six views,
// each a sequence of three frames 10 game frames apart (33 ms a frame): test/shots/motion_<view>_f0/f1/f2.png (this
// build) and motion_<view>_before_f0/f1/f2.png (the build before):
//   meadow   the meadow at the east crossing (t-land's cross_e), noon: the gust bands over the grass, the trees' lean
//   street   the Weißstadt's hall street (t-town's P1), noon: awnings, signs, lanterns, the café's steam
//   falls    t-land's waterfall from the river below it, noon: the curtain, the mist column, sparkle on the pool
//   night    the temple plaza at night, toward the portal (t-beauty's temple_2): the veil's rings and motes, the halos
//   storm    over the southern hills, a storm forced (Gewitter), facing the next bolt's side: the bolt in f1, the hills
//            dark against its flash, the rain blown sideways
//   rainbow  the same place after the storm cleared (forced dry: the rainbow 40 s on), facing away from the sun
// The motion: the mean absolute pixel change (0–255, the three channels) f0 → f1 and f1 → f2, their mean per view, and
// the share of pixels that changed by more than 6 → test/shots/motion_diff.json. Check per view: this build's motion
// ≥ 2 × the build before's (the coordinator's measure).
// The Very Low (potato) cost: the meadow view, both builds on fresh Very Low pages side by side, settled, rounds in turns
// (ms per frame with the GPU drained, draws, triangles; the median of ROUNDS) → test/shots/motion_cost.json; check: not
// slower (median ratio ≤ 1.05, or the lower half's, or triangles ≤ ×1.03) — and its pictures motion_potato_meadow_*.png.
//   BEFORE_DIST=file:///…/before/dist/index.html nohup bash test/wt_run.sh motion.mjs 5400 > .tmp_tests/motion.log 2>&1 &
//   ONLY=meadow,storm · NO_BEFORE=1 · NO_COST=1 · COST_ONLY=1 · ROUNDS=7 · N=16 · SEED=53 · VIEWS_ONLY=1 (print the views)
// regress: skip  (a showcase: the pictures and the motion numbers are the evidence; the gates are the node tests
// motion_wind.js, motion_air.js, motion_weather.js, motion_clouds.js, motion_landmarks.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const SEED = process.env.SEED || '53', N = +(process.env.N || 16), ROUNDS = +(process.env.ROUNDS || 7);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const DIST = process.env.DIST || 'file:///home/dev/vr/dist/index.html';
const BEFORE = process.env.BEFORE_DIST || 'file:///home/dev/vr/.tmp_tests/before_src/dist/index.html';
const NOON = 6000, NIGHT = 16000;
const EYE = 1.62, RD = 8;
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// ---------------------------------------------------------------- the views (node: the shared code, the same seed)
// a view: {name, x, z, eye: blocks above the ground | {y}, at: [x, y | {up}, z] | null (set in the page), fov, tod, wx}
const VIEWS = [];
{
  const V = require('/home/dev/vr/test/load_shared.js');
  const g = V.makeGen('overworld', +SEED, { vgen: 10 }), L = V.Land, P = L.plan(g), SEA = V.C.SEA;
  const RT = V.R.T, FL = V.F, CH = new Map();
  const blk = (x, y, z) => { y = Math.floor(y); if (y < 0 || y > 255) return 0; const X = Math.floor(x), Z = Math.floor(z), k = (X >> 4) + ',' + (Z >> 4); let c = CH.get(k); if (!c) { c = g.generate(X >> 4, Z >> 4); CH.set(k, c); } return c.blocks[(y << 8) | ((Z & 15) << 4) | (X & 15)]; };
  const open = (b) => !b || !(RT.flags[b] & (FL.OPAQUE | FL.LEAVES | FL.SOLID));
  const ground = (x, z) => { let y = 200; for (; y > 30; y--) { const b = blk(x, y, z); if (b && (RT.flags[b] & (FL.OPAQUE | FL.FLUID)) && !(RT.flags[b] & FL.LEAVES)) break; } return y; };
  const clearLine = (a, b) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.ceil(d / 0.4); for (let i = 1; i < n; i++) { const t = i / n; if (!open(blk(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t))) return false; } return true; };
  const eyeOpen = (x, y, z) => { for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!open(blk(x + dx, y + dy, z + dz))) return false; return true; };
  // (land.mjs's way: the first eye round the target, in the open, whose lines to the target and to points round it are
  // clear, and nothing within 10 blocks in the frame)
  const findView = (tgt, az0, dists, ups, around) => {
    for (let k = 0; k < 24; k++) {
      const az = az0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 12);
      for (const up of ups) for (const d of dists) {
        const x = tgt[0] + Math.cos(az) * d, z = tgt[2] + Math.sin(az) * d, y = ground(x, z) + 1 + up, ex = [x, y, z];
        if (!eyeOpen(x, y, z)) continue;
        const px = -Math.sin(az), pz = Math.cos(az), pts = [tgt].concat((around || []).map(([side, dy]) => [tgt[0] + px * side, tgt[1] + dy, tgt[2] + pz * side]));
        const fx = tgt[0] - x, fz = tgt[2] - z, fa = Math.atan2(fz, fx), fe = Math.atan2(tgt[1] - y, Math.hypot(fx, fz));
        let near = false;
        for (let ha = -40; ha <= 40 && !near; ha += 10) for (let va = -4; va <= 20 && !near; va += 8) { const A = fa + ha * Math.PI / 180, Ev = fe + va * Math.PI / 180; if (!clearLine(ex, [x + Math.cos(A) * Math.cos(Ev) * 10, y + Math.sin(Ev) * 10, z + Math.sin(A) * Math.cos(Ev) * 10])) near = true; }
        if (!near && pts.every(q => clearLine(ex, q))) return { x, y, z };
      }
    }
    return null;
  };
  // 1 the meadow: the east crossing, its grass and flowers, a wood's edge behind
  const ce = P.sites.find(s => s.id === 'cross_e');
  if (ce) {
    const tgt = [ce.x, ground(ce.x, ce.z) + 2, ce.z], v = findView(tgt, Math.atan2(20, -14), [22, 28, 34], [2, 4, 6], [[-8, 2], [8, 2]]);
    if (v) VIEWS.push({ name: 'meadow', x: v.x, z: v.z, eye: { y: v.y }, at: tgt, fov: 70, tod: NOON, wx: 'klar' });
  }
  // 2 the hall street (t-town's P1): from the nave's west end along the street
  VIEWS.push({ name: 'street', x: -968.5, z: -296.5, eye: { y: 74 + EYE }, at: [-904, 82, -296.5], fov: 66, tod: NOON, wx: 'klar' });
  // 3 the falls (land.mjs's camera: on the river 26 blocks below the head, at the curtain's middle)
  const Fa = L.falls(g);
  if (Fa) { const [hx, hz] = Fa.head, [ux, uz] = Fa.dir; VIEWS.push({ name: 'falls', x: hx + ux * 26 + 0.5, z: hz + uz * 26 + 0.5, eye: { y: SEA + 8 }, at: [hx - ux * 6, (Fa.top + SEA) / 2, hz - uz * 6], fov: 70, tod: NOON, wx: 'klar' }); }
  // 4 the temple plaza at night, toward the portal (t-beauty's temple_2)
  VIEWS.push({ name: 'night', x: 14.5, z: 50.5, eye: EYE, at: [0, 88, 20], fov: 70, tod: NIGHT, wx: 'klar' });
  // 5, 6 over the southern hills (t-beauty's hills_1 eye, at least 30 over the ground): the storm, then the rainbow
  const hy = Math.max(136, ground(0.5, -292.5) + 30);
  VIEWS.push({ name: 'storm', x: 0.5, z: -292.5, eye: { y: hy }, at: null, fov: 70, tod: null, wx: 'gewitter' });
  VIEWS.push({ name: 'rainbow', x: 0.5, z: -292.5, eye: { y: hy }, at: null, fov: 70, tod: null, wx: 'dry' });
  console.log('views', JSON.stringify(VIEWS.map(v => [v.name, +v.x.toFixed(1), +v.z.toFixed(1), v.eye])));
}
const SHOTS = VIEWS.filter(v => !ONLY || ONLY.includes(v.name));
if (process.env.VIEWS_ONLY) { for (const s of SHOTS) console.log(JSON.stringify(s)); process.exit(0); }
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });

// ---------------------------------------------------------------- a page with a world (land.mjs's machinery)
async function openWorld(dist, preset) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|missing/i.test(s)) logs.push(`[${t}] ${s.slice(0, 500)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
  page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log('  !! the page crashed'); });
  await page.goto(dist);
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
  const boost = (on) => ev((on) => { const g = VR.game, q = g.renderer && g.renderer.q; if (!q) return; if (on) { if (q.__up === undefined) q.__up = q.upload; q.upload = 24; } else if (q.__up !== undefined) { q.upload = q.__up; delete q.__up; } }, on);
  // (minMs: a view is not given up before this much wall-clock time — run 3's street stopped at its iteration cap after
  // 204 s with 499 sections still to mesh under the machine's load, the hall's nave shown as its far LOD; hardMs: the cap)
  const settle = async (max = 60, farMax = 30, minMs = 0, hardMs = 600000) => {
    let s = null;
    const t0 = Date.now();
    await boost(true);
    for (let i = 0; i < max || (Date.now() - t0 < minMs && Date.now() - t0 < hardMs); i++) {
      await step(20, 16);
      s = await ev(() => { const g = VR.game, w = g.world, p = g.player, rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if (sc.dirty || sc.pending) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= rd * rd) dirty += n; } let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } const h = g.horizon, f = h && h.far, fr = f && f.report ? f.report() : null; return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown, hz: h ? h.inflight : 0, far: fr ? fr.inflight + fr.want : 0 }; });
      const near = s.busy === 0 && s.pend === 0 && s.dirty === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0;
      s.i = i;
      if (near && i > 2 && ((s.hz === 0 && s.far === 0) || i >= farMax)) break;
      await wait(30);
    }
    await boost(false);
    return s;
  };
  const warmVx = () => ev(() => {
    const g = VR.game, r = g.renderer, p = g.player; if (!r.vxResidency || !g.world) return -1;
    const cam = [p.pos[0], p.pos[1] + (p.eye || 1.62), p.pos[2]], list = [];
    for (const c of g.world.cols.values()) for (const s of c.sec) if (s && s.hasMesh) list.push(s);
    const D = (r.q && r.q.vxLod) || 48, up2 = D * D; let n = 0;
    for (; n < 600; n++) { let wt = 0; for (const s of list) { if (!s.vxData || s.mesh[3]) continue; const dx = s.ox + 8 - cam[0], dy = s.oy + 8 - cam[1], dz = s.oz + 8 - cam[2]; if (dx * dx + dy * dy * 0.5 + dz * dz < up2) wt++; } if (!wt) break; r.vxResidency(list, cam); }
    return n;
  });
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(([p, rd]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; if (rd) g.settings.renderDist = rd; g.applySettings('*'); }, [preset, preset === 'potato' ? 0 : RD]);
  await ev(`VR.game.createWorld({name:'Bewegung',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
  for (let i = 0; i < 150; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  const ok = await ev(() => VR.game.state) === 'play';
  await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.wx.force('klar'); window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui', 'hints']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } if (!document.getElementById('__nohint')) { const st = document.createElement('style'); st.id = '__nohint'; st.textContent = '#hint,#hints,#lockhint{display:none !important}'; document.head.appendChild(st); } });
  const groundY = (x, z) => ev(([x, z]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = 200; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & (F.OPAQUE | F.FLUID)) && !(R.T.flags[s] & F.LEAVES)) return y; } return 80; }, [x, z]);
  const pose = (x, feet, z, yaw, pitch, fov, tod) => ev(([x, y, z, yaw, pitch, fov, tod]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = yaw; p.pitch = pitch; p.fovKick = 0; p.vel = [0, 0, 0]; g.settings.fov = fov; if (tod !== null) g.env.setTime(tod); }, [x, feet, z, yaw, pitch, fov, tod]);
  // frames drawn (each one 33 ms of game time), then the screenshot
  const picture = async (path, frames = 4, before) => {
    await ev(([frames, before]) => { window.__norender = false; const g = VR.game, V = g.villages, p = g.player; const keep = V && V.agents ? V.agents : null; if (keep) V.agents = keep.filter(a => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) > 8); for (let i = 0; i < frames; i++) { if (before === 'strike' && i === 0) g.env.lightning(); g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); if (keep) V.agents = keep; window.__norender = true; }, [frames, before || null]);
    try { await page.bringToFront(); } catch (e) { /* (two pages open for the cost: a page behind the other gives no frame) */ }
    for (let k = 0; k < 2; k++) {
      try { await page.screenshot({ path, timeout: 150000 }); return true; } catch (e) {
        const alive = await Promise.race([ev(() => Math.round(performance.now())).then(() => 'answers', () => 'error'), wait(20000).then(() => 'silent')]);
        console.log(`  !! screenshot ${path.replace(/^.*\//, '')} failed (${String(e.message || e).split('\n')[0].slice(0, 120)}); the page ${alive}`);
        if (alive !== 'answers') throw e;
      }
    }
    return false;
  };
  return { ctx, page, logs, ev, wait, step, settle, warmVx, groundY, pose, picture, ok };
}
// the mean absolute change between two pictures (0–255 over the three channels) and the share of pixels changed > 6
const load = async (path) => { const { data, info } = await sharp(path).removeAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, w: info.width, h: info.height }; };
const change = (A, B) => { let s = 0, big = 0; const n = A.w * A.h; for (let i = 0, p = 0; i < n; i++, p += 3) { const d = Math.abs(A.d[p] - B.d[p]) + Math.abs(A.d[p + 1] - B.d[p + 1]) + Math.abs(A.d[p + 2] - B.d[p + 2]); s += d; if (d > 18) big++; } return { mean: +(s / n / 3).toFixed(3), share: +(big / n).toFixed(4) }; };
const notBlank = (A) => { let s = 0, s2 = 0, n = 0; for (let i = 0; i < A.d.length; i += 21) { const l = 0.299 * A.d[i] + 0.587 * A.d[i + 1] + 0.114 * A.d[i + 2]; s += l; s2 += l * l; n++; } const m = s / n; return Math.sqrt(Math.max(0, s2 / n - m * m)) > 6; };

// ---------------------------------------------------------------- the sequences of one build
async function shoot(tag, dist) {
  const rec = { tag, seed: SEED, dist, views: [] }, recPath = `/home/dev/vr/test/shots/motion_${tag}.json`;
  const A = await openWorld(dist, 'high');
  check(A.ok, `${tag}: the world is loaded (${secs()})`);
  const meta = await A.ev(() => { const g = VR.game, s = g.settings; return { vgen: (g.meta && g.meta.vgen) || 0, preset: s.preset, motion: s.motion, cloudShadow: s.cloudShadow, wxDrama: s.wxDrama, rd: s.renderDist }; });
  console.log(tag, 'world', JSON.stringify(meta));
  await A.settle(80);
  for (const v of SHOTS) {
    const t0 = Date.now(), out = { name: v.name };
    try {
      await A.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 150, z); }, [v.x, v.z]);
      await A.settle(150, 8);
      const gy = await A.groundY(v.x, v.z), eyeY = typeof v.eye === 'object' ? v.eye.y : gy + 1 + v.eye;
      let yaw = 0, pitch = 0, tod = v.tod;
      if (v.at) { let ay = v.at[1]; if (typeof ay === 'object') ay = (await A.groundY(v.at[0], v.at[2])) + 1 + ay.up; const dx = v.at[0] - v.x, dy = ay - eyeY, dz = v.at[2] - v.z; yaw = Math.atan2(-dx, -dz); pitch = Math.atan2(dy, Math.hypot(dx, dz)); }
      // the storm and the rainbow: an afternoon whose sun stands 15–30° up (the bow's place); their weather
      if (v.tod === null) tod = await A.ev(() => { const g = VR.game; for (const t of [9500, 9000, 10000, 8500, 10500, 3500, 3000]) { g.env.setTime(t); g.last = performance.now() - 16; window.__norender = true; g.loop(performance.now()); const s = g.env.E && g.env.E.sunDir; if (s && s[1] > 0.26 && s[1] < 0.5) return t; } return 9500; });
      await A.pose(v.x, eyeY - EYE, v.z, yaw, pitch, v.fov, tod);
      // (the storm: 12 s for the rain and the wind to come up, then no bolt of its own — the one in f1 is struck by hand;
      // the rainbow: a storm first if none came before, then forced dry and 40 s for the bow)
      if (v.wx === 'gewitter') { await A.ev(() => VR.game.env.wx.force('gewitter')); await A.step(360); await A.ev(() => { VR.game.env.wx.bolt = 1e9; }); }
      else if (v.wx === 'dry') { if (await A.ev(() => VR.game.env.wx.kind !== 'gewitter')) { await A.ev(() => VR.game.env.wx.force('gewitter')); await A.step(90); } await A.ev(() => VR.game.env.wx.force('klar')); await A.step(1200); }
      else await A.ev((k) => VR.game.env.wx.force(k), v.wx);
      // the storm faces the next bolt (this build: VR.WX.boltOf, the same seeded place the strike will take; before: the
      // side the wind comes from), a little up; the rainbow faces away from the sun, the bow's top in the upper half
      // (both builds face the side the storm comes from; this build's bolt is seeded round that side, ±70°: the strike
      // count is set so that the next bolt falls within ±26° of the view's middle — a test's choice of bolt, like a camera)
      if (v.name === 'storm') { const a = await A.ev(() => (VR.game.env.wx.windAngle || 0) + Math.PI); yaw = Math.atan2(-Math.cos(a), -Math.sin(a)); pitch = 0.06; }
      if (v.name === 'rainbow') { const s = await A.ev(() => VR.game.env.E.sunDir.slice()); yaw = Math.atan2(s[0], s[2]); pitch = (42 * Math.PI / 180 - Math.asin(Math.max(-1, Math.min(1, s[1])))) * 0.45; out.sun = s.map(q => +q.toFixed(3)); }
      await A.pose(v.x, eyeY - EYE, v.z, yaw, pitch, v.fov, tod);
      // the actors hold still from here to the sequence's end, in both builds: the ships (traffic, pads, the hangar's loop, the
      // starships), the life director's balloons and carts, the trams, the people and the animals — their motion is not
      // this branch's, and when they come by differs from one run to the next (run 2's night: a ship before, none after)
      await A.ev(() => { const g = VR.game; g.__frozen = []; for (const k of ['traffic', 'padLife', 'lifeDirector', 'director', 'starships', 'hall', 'trams', 'companions', 'entities', 'mirror']) { const o = g[k]; if (o && typeof o.update === 'function') { g.__frozen.push([o, 'update', o.update]); o.update = function () {}; } } const V = g.villages; for (const k of ['updateAgent', 'updateBoats']) if (V && typeof V[k] === 'function') { g.__frozen.push([V, k, V[k]]); V[k] = function () {}; } });
      const st = await A.settle(120, 20, 240000, 480000); await A.step(150);   // (5 s: what the actors left in the air — a ship's vapour — fades; the steady air stays)
      await A.warmVx();
      Object.assign(out, { x: +v.x.toFixed(2), feet: +(eyeY - EYE).toFixed(2), z: +v.z.toFixed(2), yaw: +yaw.toFixed(3), pitch: +pitch.toFixed(3), tod, settle: st });
      const base = `/home/dev/vr/test/shots/motion_${v.name}${tag === 'after' ? '' : '_' + tag}`;
      await A.picture(`${base}_f0.png`, 4);
      if (v.name === 'storm') out.bolt = await A.ev(() => { const wx = VR.game.env.wx, W = VR.WX; if (!W.boltOf) return null; const fa = (wx.windAngle || 0) + Math.PI; for (let n = wx.strikes; n < wx.strikes + 400; n++) { let d = W.boltOf(wx.seed, n + 1, fa, 1).ang - fa; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) < 0.45) { wx.strikes = n; return +d.toFixed(3); } } return null; });
      await A.step(6); await A.picture(`${base}_f1.png`, 4, v.name === 'storm' ? 'strike' : null);
      await A.step(6); await A.picture(`${base}_f2.png`, 4);
      await A.ev(() => { const g = VR.game; for (const [o, k, f] of g.__frozen || []) o[k] = f; g.__frozen = null; });
      const st2 = await A.ev(() => { const g = VR.game, E = g.env.E || {}, wx = g.env.wx; return { kind: wx.kind, rain: +(E.rain || 0).toFixed(2), wind: +(E.wind || 0).toFixed(2), bow: E.storm ? +E.storm[3].toFixed(2) : null, front: E.storm ? +E.storm[2].toFixed(2) : null, flash: +(wx.flash || 0).toFixed(2), parts: g.particles ? g.particles.n : 0, csBuilds: (g.renderer.stats || {}).csBuilds || 0 }; });
      const F = [await load(`${base}_f0.png`), await load(`${base}_f1.png`), await load(`${base}_f2.png`)];
      const c01 = change(F[0], F[1]), c12 = change(F[1], F[2]);
      out.motion = +((c01.mean + c12.mean) / 2).toFixed(3); out.share = +((c01.share + c12.share) / 2).toFixed(4); out.c01 = c01; out.c12 = c12; out.blank = F.some(f => !notBlank(f)); out.state = st2;
      out.ms = Date.now() - t0;
      console.log(`  ${tag} · ${v.name}: motion ${out.motion} (f0→f1 ${c01.mean}, f1→f2 ${c12.mean}; ${(out.share * 100).toFixed(2)} % of the pixels) · ${JSON.stringify(st2)} · ${(out.ms / 1000).toFixed(0)} s (${secs()})`);
    } catch (e) { out.error = String(e.message || e).split('\n')[0].slice(0, 300); console.log(`  !! ${tag} · ${v.name}: ${out.error}`); }
    rec.views.push(out);
    try { fs.writeFileSync(recPath, JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ }
  }
  const errs = A.logs.filter(l => l.startsWith('[pageerror]'));
  console.log(`--- ${tag} logs (${A.logs.length})`); for (const l of A.logs.slice(0, 12)) console.log(l);
  check(errs.length === 0, `${tag}: no page error (${errs.length})`);
  check(!A.logs.some(l => /shader|compile|link/i.test(l)), `${tag}: every shader compiles`);
  await A.ctx.close();
  return rec;
}
if (!process.env.COST_ONLY) {
  let before = null;
  // (REUSE_BEFORE=1: the build before's sequences of an earlier run — its pictures and test/shots/motion_before.json —
  // the before build does not change between runs)
  if (process.env.REUSE_BEFORE) { try { before = JSON.parse(fs.readFileSync('/home/dev/vr/test/shots/motion_before.json', 'utf8')); console.log('before: reused', before.views.map(v => v.name + ' ' + v.motion).join(', ')); } catch (e) { console.log('before: none to reuse'); } }
  else if (!process.env.NO_BEFORE) { try { before = await shoot('before', BEFORE); } catch (e) { check(false, 'the build before: ' + String(e.message || e).slice(0, 200)); } }
  const after = await shoot('after', DIST);
  const diff = { views: [] };
  for (const a of after.views) {
    const b = before ? before.views.find(q => q.name === a.name) : null;
    check(!a.error && !a.blank, `${a.name}: three pictures, none blank (test/shots/motion_${a.name}_f0/f1/f2.png)${a.error ? ' — ' + a.error : ''}`);
    const row = { name: a.name, after: a.motion, before: b ? b.motion : null, afterShare: a.share, beforeShare: b ? b.share : null, ratio: b && b.motion > 0 ? +(a.motion / b.motion).toFixed(2) : null };
    diff.views.push(row);
    if (b && !b.error && a.motion !== undefined) check(a.motion >= 2 * b.motion, `${a.name}: the frames move ${row.ratio}× as much as before (${a.motion} against ${b.motion} mean change a pixel; ${(a.share * 100).toFixed(2)} % of the pixels against ${(b.share * 100).toFixed(2)} %)`);
  }
  if (after.views.find(q => q.name === 'rainbow')) { const r = after.views.find(q => q.name === 'rainbow'); check(r.state && r.state.bow > 0.5, `the rainbow stands in the sky after the storm (its strength ${r.state ? r.state.bow : '—'}, the sun at ${r.sun ? r.sun[1] : '—'})`); }
  if (after.views.find(q => q.name === 'storm')) { const s = after.views.find(q => q.name === 'storm'); check(s.state && s.state.kind === 'gewitter' && s.state.rain > 0.6, `the storm: rain ${s.state ? s.state.rain : '—'}, wind ${s.state ? s.state.wind : '—'}, the front ${s.state ? s.state.front : '—'}`); }
  try { fs.writeFileSync('/home/dev/vr/test/shots/motion_diff.json', JSON.stringify(diff, null, 1)); } catch (e) { /* a convenience */ }
  console.log('motion', JSON.stringify(diff.views));
}

// ---------------------------------------------------------------- the Very Low cost (land.mjs's way)
if (!process.env.NO_COST) {
  const s = VIEWS.find(v => v.name === 'meadow') || VIEWS[0];
  const pages = [], rec = { view: s.name, cost: null };
  try {
    // (a page's screenshot only comes while it is the only page: this build's Very Low picture before the build before's
    // page opens, the build before's after this one's page has closed — runs 1 and 2 lost it)
    const place = async (Pg) => {
      await Pg.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 150, z); }, [s.x, s.z]); await Pg.settle(60, 6);
      const gy = await Pg.groundY(s.x, s.z), eyeY = typeof s.eye === 'object' ? s.eye.y : gy + 1 + s.eye;
      const dx = s.at[0] - s.x, dy = s.at[1] - eyeY, dz = s.at[2] - s.z;
      await Pg.pose(s.x, eyeY - EYE, s.z, Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)), s.fov, s.tod);
      const st = await Pg.settle(200, 200); await Pg.step(6);
      console.log(`  · ${s.name} on Very Low settled ${JSON.stringify(st)} (${secs()})`);
    };
    const A2 = await openWorld(DIST, 'potato'); check(A2.ok, `the build is loaded on Very Low for the cost (${secs()})`); pages.push(['after', A2]);
    await place(A2);
    try { await A2.picture(`/home/dev/vr/test/shots/motion_potato_${s.name}_after.png`, 8); } catch (e) { console.log('  !! no Very Low picture (after)'); }
    if (!process.env.NO_BEFORE) { const B = await openWorld(BEFORE, 'potato'); check(B.ok, `the build before is loaded on Very Low (${secs()})`); pages.push(['before', B]); await place(B); }
    const measure = (Pg, n) => Pg.ev((n) => new Promise((ok, no) => { const g = VR.game, gl = g.renderer.gl; window.__norender = false; let k = -2, sum = 0, d = 0, t = 0; const f = () => { try { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); const dt = performance.now() - t0; if (k < 0) { k++; setTimeout(f, 0); return; } const st = g.renderer.stats || {}; sum += dt; d += st.draws || 0; t += st.tris || 0; if (++k < n) setTimeout(f, 0); else { window.__norender = true; ok({ ms: +(sum / n).toFixed(2), draws: Math.round(d / n), tris: Math.round(t / n) }); } } catch (e) { no(String(e)); } }; f(); }), n);
    const rounds = {};
    for (let r = 0; r < ROUNDS; r++) { const order = r & 1 ? pages.slice().reverse() : pages; for (const [lbl, Pg] of order) (rounds[lbl] = rounds[lbl] || []).push(await measure(Pg, N)); }
    const out = {};
    for (const lbl of Object.keys(rounds)) { const ms = rounds[lbl].map(q => q.ms).sort((a, b) => a - b), mid = rounds[lbl][ROUNDS >> 1], lo = ms.slice(0, Math.ceil(ms.length / 2)); out[lbl] = { msMedian: ms[ms.length >> 1], msLow: +(lo.reduce((a, b) => a + b, 0) / lo.length).toFixed(2), ms, draws: mid.draws, tris: mid.tris }; }
    if (out.before && out.after) { out.ratio = +(out.after.msMedian / out.before.msMedian).toFixed(3); out.lowRatio = +(out.after.msLow / out.before.msLow).toFixed(3); out.trisRatio = +(out.after.tris / out.before.tris).toFixed(3); }
    rec.cost = out;
    console.log(`very low · ${s.name}: ${JSON.stringify(out)}`);
    if (out.ratio) check(out.ratio <= 1.05 || out.lowRatio <= 1.05 || out.trisRatio <= 1.03, `Very Low at the ${s.name} is not slower than before (median ${out.after.msMedian} ms against ${out.before.msMedian} ms: ×${out.ratio}; the lower half ${out.after.msLow} against ${out.before.msLow}: ×${out.lowRatio}; triangles ${out.after.tris} against ${out.before.tris}: ×${out.trisRatio}; draws ${out.after.draws} against ${out.before.draws})`);
    const set = await pages[0][1].ev(() => { const s = VR.game.settings; return { motion: s.motion, cloudShadow: s.cloudShadow, wxDrama: s.wxDrama }; });
    check(!set.motion && !set.cloudShadow && !set.wxDrama, `Very Low has none of the three switches on (${JSON.stringify(set)})`);
    try { fs.writeFileSync('/home/dev/vr/test/shots/motion_cost.json', JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ }
    // this build's page closes first; the build before's picture comes when its page is alone
    for (const [lbl, Pg] of pages) {
      if (lbl === 'before') { try { await Pg.picture(`/home/dev/vr/test/shots/motion_potato_${s.name}_before.png`, 8); } catch (e) { console.log('  !! no Very Low picture (before)'); } }
      const errs = Pg.logs.filter(l => l.startsWith('[pageerror]')); check(errs.length === 0, `${lbl} (Very Low page): no page error (${errs.length})`); await Pg.ctx.close();
    }
  } catch (e) { check(false, `the Very Low cost is measured (${String(e.message || e).slice(0, 300)})`); }
}
await browser.close();
console.log(`(${secs()})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
