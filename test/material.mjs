// t-material · WOW II: Materialien und Wasser (plan docs/superpowers/plans/2026-10-15-t-material.md) — the pictures, the
// checks and the costs. A new default world (seed 53: Nova Haven, the Gate Temple and its Hangar Hall, the lake under the
// Sky Isles, the land's river, and the Weißstadt hall city of cell −2, −1) on the High preset as a player gets it (only the
// dynamic resolution held off, so every picture is drawn at full size), from:
//   plaza    the crescent's light-grey paving into the low sun (golden hour) and at night (the cyan light lines)
//   hall     Weißstadt's white stone under its glass vault (trailer_town.mjs P1; day, night)
//   hangar   the Hangar Hall's navy floor with its craft on the pad (life.mjs 'hall'; t1_13)
//   ship     a craft parked on the temple's apron in the morning sun (life.mjs 'apron'): its hull
//   villa    Villa Nova's glass back (beauty_audit.mjs backs_3; golden hour, night: the windows)
//   lake     the lake from its north end, the isles over it (beauty_audit.mjs water_1; golden hour, night)
//   beach    the lake's sand shore from the east (beauty_audit.mjs water_2; noon)
//   river    the land's river bend (land.mjs's camera, computed here for seed 53; noon, night)
//   rain     the avenue in the rain and a few minutes after it (beauty_audit.mjs street_3; noon)
// test/shots/material_<view>[_<time>]_<tag>.png (1280 × 720); with a before and an after there, the sheet
// test/shots/material_sheet.jpg (before | after, one row a picture); the cameras, the stats round every picture and the
// checks' numbers in test/shots/material_<tag>.json.
// COST=1: Very Low (potato) — this build and COST_DIST's, each in a fresh page made on Very Low, measured in turns (ms per
// frame with the GPU drained, the median of the rounds) at the plaza and the lake; and on High the gloss tiers in turns
// at the plaza (pbr 0 · 1 · 2) → test/shots/material_cost.json.
// Checks (this build, once it has them): the switches are in the settings with their texts; the gloss programs compile
// (no shader message); on High the screen-space mirror ran at the plaza; the wet ground dries over ten minutes; no page
// error; with COST: Very Low not slower (median ratio ≤ 1.03, or the triangles and draws the same and the ratio ≤ 1.06 on
// this shared machine).
// usage: BEFORE_DIST=file:///…/base/dist/index.html nohup bash test/wt_run.sh material.mjs 7200 > .tmp_tests/material.log 2>&1 &
//   NO_AFTER=1 (the before only) · ONLY=plaza,lake (views) · TAG=after · COST=1 COST_DIST=file:///…/index.html · NO_PICS=1
//   (the cost alone) · SEED=53 · CAMS_ONLY=1 (print the cameras)
// regress: skip  (a showcase: the pictures are the evidence; the gates are the node tests test/material.js, test/wet.js,
// test/water_fx.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const SEED = process.env.SEED || '53', TAG = process.env.TAG || 'after', N = +(process.env.N || 12), ROUNDS = +(process.env.ROUNDS || 7);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const DIST = process.env.DIST || 'file:///home/dev/vr/dist/index.html';
const MORNING = 2000, DAY = 8000, NOON = 6000, GOLDEN = 12500, NIGHT = 16000;
const TODN = { [MORNING]: 'morning', [DAY]: 'day', [NOON]: 'noon', [GOLDEN]: 'golden', [NIGHT]: 'night' };
const EYE = 1.62;
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const SHOTS = '/home/dev/vr/test/shots/';

// ---------------------------------------------------------------- the views
// { name, feet: [x, y, z] (y null: on the ground there), eye (above the feet), at: [x, y, z], times: [first, …], fov,
//   prep: what the page does before the picture (the hall's craft to its pad, the apron's crew out, the rain) }
const HALL = { cx: -944, cz: -296, F: 73 };   // Weißstadt of seed 53 (life.mjs): world = (cx + v, cz − u)
const VIEWS = [
  { name: 'hangar', feet: [0.5, 82.4, 9], at: [0.5, 83.2, -10], times: [4000], fov: 74, prep: 'hangar' },
  { name: 'ship', feet: [50, 89, 30], at: [46.5, 82, 61], times: [MORNING], fov: 70, prep: 'apron' },
  { name: 'plaza', feet: [-22.5, null, -63.5], at: [-70, 82.6, -72], times: [GOLDEN, NIGHT], fov: 70 },
  { name: 'rain', feet: [1.5, null, -62.5], at: [1, 83, -100], times: [NOON], fov: 70, prep: 'rain' },
  { name: 'rain_after', feet: [1.5, null, -62.5], at: [1, 83, -100], times: [NOON], fov: 70, prep: 'after' },
  { name: 'villa', feet: [75.5, null, -136.5], at: [75, 88, -112], times: [GOLDEN, NIGHT], fov: 70 },
  { name: 'lake', feet: [201.5, null, 6.5], at: [250, 64, 70], times: [GOLDEN, NIGHT], fov: 70 },
  { name: 'beach', feet: [222.5, null, 32.5], at: [190, 64, 40], times: [NOON], fov: 70 },
  { name: 'hall', feet: [HALL.cx - 24.5, HALL.F + 1, HALL.cz - 0.5], at: [HALL.cx + 40, HALL.F + 9, HALL.cz - 0.5], times: [DAY, NIGHT], fov: 66 },
];
// the river bend of this seed's land (land.mjs: the sharpest bend between its head and its mouth, from upstream over the
// water, as low as the trees on its banks let the eye see through the bend) — computed in node from the same plan
{
  const V = require('/home/dev/vr/test/load_shared.js');
  const g = V.makeGen('overworld', +SEED, { vgen: 10 }), L = V.Land, SEA = V.C.SEA;
  const RT = V.R.T, FL = V.F, CH = new Map();
  const blk = (x, y, z) => { y = Math.floor(y); if (y < 0 || y > 255) return 0; const X = Math.floor(x), Z = Math.floor(z), k = (X >> 4) + ',' + (Z >> 4); let c = CH.get(k); if (!c) { c = g.generate(X >> 4, Z >> 4); CH.set(k, c); } return c.blocks[(y << 8) | ((Z & 15) << 4) | (X & 15)]; };
  const open = (b) => !b || !(RT.flags[b] & (FL.OPAQUE | FL.LEAVES | FL.SOLID));
  const clearLine = (a, b) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.ceil(d / 0.4); for (let i = 1; i < n; i++) { const t = i / n; if (!open(blk(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t))) return false; } return true; };
  const eyeOpen = (x, y, z) => { for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!open(blk(x + dx, y + dy, z + dz))) return false; return true; };
  const Rv = L && L.river ? L.river(g) : null;
  let bend = null;
  if (Rv) for (let i = 70; i < Rv.pts.length - 70; i++) { const a = Rv.pts[i - 12], b = Rv.pts[i], c = Rv.pts[i + 12]; let k = Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]); while (k > Math.PI) k -= 2 * Math.PI; while (k < -Math.PI) k += 2 * Math.PI; if (!bend || Math.abs(k) > Math.abs(bend.k)) bend = { i, k }; }
  if (bend) {
    const c = Rv.pts[bend.i + 30], tgt = [c[0], SEA + 1, c[1]]; let cam = null;
    for (let j = bend.i - 8; j >= bend.i - 40 && !cam; j -= 4) for (let up = 3; up <= 14 && !cam; up++) { const p = Rv.pts[j], y = SEA + up; if (eyeOpen(p[0], y, p[1]) && clearLine([p[0], y, p[1]], tgt)) cam = [p[0], y, p[1]]; }
    if (cam) VIEWS.splice(VIEWS.findIndex(v => v.name === 'hall'), 0, { name: 'river', feet: [cam[0], cam[1] - EYE, cam[2]], at: tgt, times: [NOON, NIGHT], fov: 70 });
  }
  console.log('views', JSON.stringify(VIEWS.map(v => [v.name, v.feet.map(q => q === null ? null : +(+q).toFixed(1))])));
}
if (process.env.CAMS_ONLY) process.exit(0);
const want = (v) => !ONLY || ONLY.includes(v.name) || ONLY.includes(v.name.split('_')[0]);

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });

// ---------------------------------------------------------------- a page with a world (beauty_audit.mjs's helpers)
async function openWorld(dist, preset) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|missing|shader/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
  await page.goto(dist);
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const step = async (n, dtms = 16) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
  const boost = (on) => ev((on) => { const g = VR.game, q = g.renderer && g.renderer.q; if (!q) return; if (on) { if (q.__up === undefined) q.__up = q.upload; q.upload = 24; } else if (q.__up !== undefined) { q.upload = q.__up; delete q.__up; } }, on);
  const settle = async (max = 60, farMax = 30) => {
    let s = null, last = Infinity, stall = 0;
    await boost(true);
    for (let i = 0; i < max; i++) {
      await step(20);
      s = await ev(() => { const g = VR.game, w = g.world, p = g.player, rd = Math.max(1, (w.renderDist | 0) - 1), ri = Math.max(1, rd - 2), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if ((sc.dirty || sc.pending) && sc.count > 0) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= ri * ri) dirty += n; } let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } const h = g.horizon, f = h && h.far, fr = f && f.report ? f.report() : null; return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown, hz: h ? h.inflight : 0, far: fr ? fr.inflight + fr.want : 0 }; });
      const shown = s.pend === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0;
      stall = shown && s.dirty >= last ? stall + 1 : 0; last = s.dirty;
      const near = shown && ((s.busy === 0 && s.dirty === 0) || stall >= 4);
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
    for (; n < 600; n++) {
      let wt = 0; for (const s of list) { if (!s.vxData || s.mesh[3]) continue; const dx = s.ox + 8 - cam[0], dy = s.oy + 8 - cam[1], dz = s.oz + 8 - cam[2]; if (dx * dx + dy * dy * 0.5 + dz * dz < up2) wt++; }
      if (!wt) break;
      r.vxResidency(list, cam);
    }
    return n;
  });
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.applySettings('*'); }, preset);
  await ev(`VR.game.createWorld({name:'Material',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
  for (let i = 0; i < 150; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  const ok = await ev(() => VR.game.state) === 'play';
  await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui', 'hints']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } });
  const groundY = (x, z) => ev(([x, z]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = 200; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & (F.OPAQUE | F.FLUID)) && !(R.T.flags[s] & F.LEAVES)) return y; } return 80; }, [x, z]);
  const pose = (x, feet, z, yaw, pitch, fov, tod) => ev(([x, y, z, yaw, pitch, fov, tod]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = yaw; p.pitch = pitch; p.fovKick = 0; p.vel = [0, 0, 0]; g.settings.fov = fov; g.env.setTime(tod); const e = g.entities; if (e && e.mobs) e.mobs.length = 0; }, [x, feet, z, yaw, pitch, fov, tod]);
  // the weather of a view: dry (the default), in the rain (puddles full), or after it (a few minutes later: the ground
  // still wet, the puddles shrinking). The wet state is set directly where the build has it (env.wetS: this branch;
  // env.puddle: F2's), so both builds show the same moment
  const weather = (kind) => ev((kind) => {
    const g = VR.game, E = g.env, wx = E.wx;
    const rain = kind === 'rain' ? 1 : 0, wet = kind === 'rain' ? 1 : kind === 'after' ? 0.7 : 0, pud = kind === 'rain' ? 1 : kind === 'after' ? 0.75 : 0;
    if (wx && wx.force) wx.force(kind === 'rain' ? 'regen' : 'klar');
    if (wx) { wx.frozen = null; if (wx.v) { wx.v.rain = rain; if (kind === 'rain') { wx.v.cloud = 0.9; wx.v.sun = 0.35; wx.v.dark = 0.3; } else { wx.v.dark = 0; wx.v.sun = 1; } } }
    E.puddle = pud; if (E.wetS) { E.wetS.wet = wet; E.wetS.pud = pud; }
    return { rain, wet, pud, has: !!E.wetS };
  }, kind);
  // a picture: the frames drawn with the villagers at the lens left out; the time of day set first. Returns the
  // renderer's stats of the last frame
  const picture = async (path, tod, frames = 4) => {
    await warmVx();
    const st = await ev(([frames, tod]) => { window.__norender = false; const g = VR.game, V = g.villages, p = g.player; g.env.setTime(tod); const keep = V && V.agents ? V.agents : null; if (keep) V.agents = keep.filter(a => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) > 8); for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); if (keep) V.agents = keep; window.__norender = true; const s = g.renderer.stats || {}; return { draws: s.draws, tris: s.tris, ms: +(s.ms || 0).toFixed(1), refl: s.reflSecs || 0, ssr: s.ssr || null, pbr: g.renderer.q.pbr, fs: s.fsPasses }; }, [frames, tod]);
    await page.bringToFront().catch(() => {});
    await page.screenshot({ path, timeout: 180000 });
    return st;
  };
  return { ctx, page, logs, ev, wait, step, settle, warmVx, groundY, pose, picture, weather, ok };
}
const notBlank = async (path) => { try { const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true }); let s = 0, s2 = 0, n = 0; for (let i = 0; i < data.length; i += info.channels * 7) { const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; s += l; s2 += l * l; n++; } const m = s / n; return Math.sqrt(Math.max(0, s2 / n - m * m)) > 6; } catch (e) { return false; } };

// ---------------------------------------------------------------- the pictures of one build
async function shoot(tag, dist) {
  const record = { tag, seed: SEED, dist, views: [] }, recPath = `${SHOTS}material_${tag}.json`;
  const A = await openWorld(dist, 'high');
  check(A.ok, `${tag}: the world is loaded (${secs()})`);
  const meta = await A.ev(() => { const g = VR.game, q = g.renderer.q; return { vgen: g.meta && g.meta.vgen, preset: g.settings.preset, pbr: q.pbr, ssr: q.ssr, texHi: q.texHi, water: q.water, matTier: q.matTier }; });
  console.log(tag, 'world', JSON.stringify(meta));
  await A.settle(80);
  let pics = 0, wanted = 0; const blank = [];
  for (const v of VIEWS.filter(want)) {
    const t0 = Date.now();
    const [fx, fy, fz] = v.feet;
    await A.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 150, z); }, [fx, fz]);
    await A.settle(150, 8);
    const feet = fy === null ? (await A.groundY(fx, fz)) + 1 : fy, eyeY = feet + EYE;
    const dx = v.at[0] - fx, dy = v.at[1] - eyeY, dz = v.at[2] - fz;
    const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(dy, Math.hypot(dx, dz));
    await A.pose(fx, feet, fz, yaw, pitch, v.fov, v.times[0]);
    await A.weather(v.prep === 'rain' ? 'rain' : v.prep === 'after' ? 'after' : 'dry');
    const st0 = await A.settle(150, 30); await A.step(6);
    // the scene's moment: the hall's craft on its pad with the crew out; the apron's craft parked with its crew
    if (v.prep === 'hangar') await A.ev(() => { const g = VR.game; if (g.hall && g.hall.flight && g.hall.flight.jumpPhase) { g.hall.flight.update(0.03); const L = g.hall.flight.plan && g.hall.flight.plan.legs.find(l => l.name === 'pad'); g.hall.flight.jumpPhase('pad', L ? Math.min(0.6, 21 / L.T) : 0.3); } if (g.hall && g.hall.jump) g.hall.jump(8); });
    if (v.prep === 'apron') await A.ev(() => { const g = VR.game; if (g.padLife && g.padLife.jump) g.padLife.jump('apron', 'crew'); });
    if (v.prep === 'hangar' || v.prep === 'apron') await A.step(4);
    const rec = { name: v.name, feet: [fx, +feet.toFixed(2), fz], yaw: +yaw.toFixed(3), pitch: +pitch.toFixed(3), fov: v.fov, pics: [] };
    for (let k = 0; k < v.times.length; k++) {
      const path = `${SHOTS}material_${v.name}${k ? '_' + TODN[v.times[k]] : ''}_${tag}.png`;
      wanted++;
      const st = await A.picture(path, v.times[k]);
      if (fs.existsSync(path)) { pics++; if (!(await notBlank(path))) blank.push(path); }
      rec.pics.push({ path: path.replace(/^.*test\/shots\//, 'test/shots/'), tod: v.times[k], st });
      console.log(`  ${v.name} ${TODN[v.times[k]]}: ${JSON.stringify(st)}`);
    }
    await A.weather('dry');
    rec.ms = Date.now() - t0;
    console.log(`  ${v.name}: (${fx}, ${feet.toFixed(1)}, ${fz}) yaw ${rec.yaw} pitch ${rec.pitch} · ${(rec.ms / 1000).toFixed(0)} s · settle ${JSON.stringify(st0)} (${secs()})`);
    record.views.push(rec);
    try { fs.writeFileSync(recPath, JSON.stringify(record, null, 1)); } catch (e) { /* the record is a convenience */ }
  }
  check(pics === wanted && wanted > 0, `${tag}: every picture is written (${pics} of ${wanted})`);
  check(blank.length === 0, `${tag}: no picture is blank (${blank.length}${blank.length ? ': ' + blank.join(', ') : ''})`);
  const errs = A.logs.filter(l => l.startsWith('[pageerror]')), shaderMsgs = A.logs.filter(l => /shader|compile|link/i.test(l));
  console.log(`--- ${tag} logs (${A.logs.length})`); for (const l of A.logs.slice(0, 12)) console.log(l);
  check(errs.length === 0, `${tag}: no page error (${errs.length})`);
  check(shaderMsgs.length === 0, `${tag}: no shader message (${shaderMsgs.length})`);
  return { A, record, recPath };
}

// ---------------------------------------------------------------- the checks of this build (its own switches)
async function ownChecks(A, record) {
  const has = await A.ev(() => { const S = VR.Settings, g = VR.game; return { pbr: !!(S && S.byKey('pbr')), texHi: !!(S && S.byKey('texHi')), wet: !!(VR.Wet && VR.Wet.step), q: g.renderer.q.pbr }; });
  if (!has.pbr && !has.wet) { console.log('  (this build has no gloss switches yet: its own checks are skipped)'); return; }
  const out = record.checks = {};
  if (has.pbr) {
    const s = await A.ev(() => { const S = VR.Settings, I = VR.I18N; const lab = (k) => I ? [I.t(k)] : [k]; const it = S.byKey('pbr'); return { cost: it.cost, max: it.max, lab: lab(it.lab), tip: lab(it.tip), presets: ['potato', 'low', 'balanced', 'high', 'ultra'].map(p => VR.game.presetValue ? VR.game.presetValue(p, 'pbr') : null) }; });
    out.pbr = s; console.log('  pbr', JSON.stringify(s));
    check(s.lab[0] && s.lab[0] !== 'g.set.pbr' && s.tip[0] !== 'g.set.pbr.tip', `the gloss switch has its label and tip (${s.lab[0]})`);
  }
  if (has.wet) {
    // the drying curve in the page: an hour of rain, then the sky clears — wet after 2, 5, 10 minutes
    const d = await A.ev(() => { const W = VR.Wet, s = W.state(); for (let t = 0; t < 600; t++) W.step(s, 1, 1); const at = {}; for (let t = 1; t <= 600; t++) { W.step(s, 0, 1); if (t === 120 || t === 300 || t === 600) at[t] = +s.wet.toFixed(3); } return at; });
    out.dry = d; console.log('  drying', JSON.stringify(d));
    check(d[120] > 0.4 && d[600] < 0.08, `the ground dries over ten minutes after the rain (wet ${JSON.stringify(d)})`);
  }
}

// ---------------------------------------------------------------- the sheet: before | after, one row a picture
async function sheet() {
  const rows = [];
  for (const v of VIEWS) for (let k = 0; k < v.times.length; k++) {
    const base = `material_${v.name}${k ? '_' + TODN[v.times[k]] : ''}`;
    const b = `${SHOTS}${base}_before.png`, a = `${SHOTS}${base}_${TAG}.png`;
    if (fs.existsSync(b) && fs.existsSync(a)) rows.push([base.replace('material_', ''), b, a]);
  }
  if (!rows.length) return false;
  const W = 640, H = 360, L = 22, rowH = H + L;
  const label = (t) => Buffer.from(`<svg width="${W}" height="${L}"><rect width="100%" height="100%" fill="#1d1f24"/><text x="8" y="16" font-family="sans-serif" font-size="14" fill="#e8ecf0">${t}</text></svg>`);
  const comps = [];
  for (let i = 0; i < rows.length; i++) {
    const [name, b, a] = rows[i], y = i * rowH;
    comps.push({ input: label(name + ' · before'), left: 0, top: y }, { input: label(name + ' · after'), left: W + 6, top: y });
    comps.push({ input: await sharp(b).resize(W, H).toBuffer(), left: 0, top: y + L }, { input: await sharp(a).resize(W, H).toBuffer(), left: W + 6, top: y + L });
  }
  await sharp({ create: { width: W * 2 + 6, height: rows.length * rowH, channels: 3, background: '#111' } }).composite(comps).jpeg({ quality: 82 }).toFile(`${SHOTS}material_sheet.jpg`);
  console.log(`sheet: test/shots/material_sheet.jpg (${rows.length} rows)`);
  return true;
}

// ---------------------------------------------------------------- the costs (COST=1)
async function costs() {
  const out = {};
  const measure = (P, n) => P.ev((n) => new Promise((ok, no) => { const g = VR.game, gl = g.renderer.gl; window.__norender = false; let k = -2, sum = 0, d = 0, t = 0; const f = () => { try { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); const dt = performance.now() - t0; if (k < 0) { k++; setTimeout(f, 0); return; } const st = g.renderer.stats || {}; sum += dt; d += st.draws || 0; t += st.tris || 0; if (++k < n) setTimeout(f, 0); else { window.__norender = true; ok({ ms: +(sum / n).toFixed(2), draws: Math.round(d / n), tris: Math.round(t / n) }); } } catch (e) { no(String(e)); } }; f(); }), n);
  const SCENES = [['plaza', -22.5, -63.5, [-70, 82.6, -72]], ['lake', 201.5, 6.5, [250, 64, 70]]];
  const poseAt = async (P, x, z, at) => {
    const gy = await P.groundY(x, z), eyeY = gy + 1 + EYE, dx = at[0] - x, dy = at[1] - eyeY, dz = at[2] - z;
    await P.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 150, z); }, [x, z]); await P.settle(40, 4);
    await P.pose(x, eyeY - EYE, z, Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)), 70, GOLDEN);
    await P.settle(80, 4); await P.step(6);
  };
  // Very Low: this build and the build before, in turns
  const pages = [];
  const T = await openWorld(DIST, 'potato'); check(T.ok, `this build is loaded on Very Low for the cost (${secs()})`); pages.push(['this', T]);
  if (process.env.COST_DIST) { const B = await openWorld(process.env.COST_DIST, 'potato'); check(B.ok, `the build before is loaded on Very Low (${secs()})`); pages.push(['before', B]); }
  out.potato = {};
  for (const [scene, x, z, at] of SCENES) {
    for (const [, P] of pages) await poseAt(P, x, z, at);
    const rounds = {};
    for (let r = 0; r < ROUNDS; r++) { const order = r & 1 ? pages.slice().reverse() : pages; for (const [lbl, P] of order) (rounds[lbl] = rounds[lbl] || []).push(await measure(P, N)); }
    const o = {};
    for (const lbl of Object.keys(rounds)) { const ms = rounds[lbl].map(q => q.ms).sort((a, b) => a - b); o[lbl] = { msMedian: ms[ms.length >> 1], ms, draws: rounds[lbl][1].draws, tris: rounds[lbl][1].tris }; }
    if (o.before && o.this) o.ratio = +(o.this.msMedian / o.before.msMedian).toFixed(3);
    out.potato[scene] = o;
    console.log(`very low · ${scene}: ${JSON.stringify(o)} (${secs()})`);
    if (o.ratio) check(o.ratio <= 1.03 || (o.ratio <= 1.06 && o.this.tris === o.before.tris && o.this.draws === o.before.draws), `Very Low at the ${scene} is not slower (×${o.ratio}; draws ${o.this.draws} / ${o.before.draws}, triangles ${o.this.tris} / ${o.before.tris})`);
  }
  // the shader programs of Very Low carry none of the new code (the gloss define is not in its list)
  const vlDefs = await T.ev(() => { const r = VR.game.renderer; return { pbr: r.q.pbr || 0, ssr: !!r.ssrOn, texHi: !!r.q.texHi }; });
  out.potatoQ = vlDefs; check(!vlDefs.pbr && !vlDefs.ssr && !vlDefs.texHi, `Very Low runs none of the new effects (${JSON.stringify(vlDefs)})`);
  for (const [lbl, P] of pages) { const errs = P.logs.filter(l => l.startsWith('[pageerror]')); check(errs.length === 0, `${lbl} (Very Low): no page error (${errs.length})`); await P.ctx.close(); }
  // High: the gloss tiers in turns at the plaza (one page; pbr 0 · 1 · 2 switched by hand)
  const H = await openWorld(DIST, 'high');
  const hasPbr = await H.ev(() => !!(VR.Settings && VR.Settings.byKey('pbr')));
  if (hasPbr) {
    await poseAt(H, SCENES[0][1], SCENES[0][2], SCENES[0][3]);
    const set = (v) => H.ev((v) => { const g = VR.game; g.settings.pbr = v; g.applySettings('pbr'); g.settings.dynRes = false; }, v);
    const rounds = { 0: [], 1: [], 2: [] };
    for (let r = 0; r < 5; r++) for (const v of (r & 1 ? [2, 1, 0] : [0, 1, 2])) { await set(v); await H.step(2); rounds[v].push(await measure(H, Math.max(4, N >> 1))); }
    out.high = {};
    for (const v of [0, 1, 2]) { const ms = rounds[v].map(q => q.ms).sort((a, b) => a - b); out.high['pbr' + v] = { msMedian: ms[ms.length >> 1], ms, draws: rounds[v][1].draws }; }
    out.high.ssrMs = await H.ev(() => (VR.game.renderer.stats.ssr || {}).ms || null);
    console.log(`high · plaza · gloss tiers: ${JSON.stringify(out.high)} (${secs()})`);
  }
  await H.ctx.close();
  try { fs.writeFileSync(`${SHOTS}material_cost.json`, JSON.stringify(out, null, 1)); } catch (e) { /* convenience */ }
  return out;
}

// ---------------------------------------------------------------- the run
if (!process.env.NO_PICS) {
  if (process.env.BEFORE_DIST) { const B = await shoot('before', process.env.BEFORE_DIST); await B.A.ctx.close(); }
  if (!process.env.NO_AFTER) {
    const A = await shoot(TAG, DIST);
    await ownChecks(A.A, A.record);
    try { fs.writeFileSync(A.recPath, JSON.stringify(A.record, null, 1)); } catch (e) { /* convenience */ }
    await A.A.ctx.close();
    await sheet();
  }
}
if (process.env.COST) { try { await costs(); } catch (e) { check(false, `the costs (${String(e.message || e).slice(0, 300)})`); } }
await browser.close();
console.log(`(${secs()})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
