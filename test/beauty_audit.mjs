// Beauty from every angle (plan docs/superpowers/plans/2026-10-08-t-beauty.md): an audit by pictures of a NEW world
// made with the default generator (Nova Haven, vgen 8), on the High preset as a player gets it (only the dynamic
// resolution held off, so every picture is drawn at full size), at four times of day — morning 08:00 (2000), noon
// (6000), the golden hour 18:30 (12500), night 22:00 (16000) — from the viewpoints a trailer camera would choose:
//   hills   (a) from the terraced hills down at Nova Haven, 80–250 m away
//   street  (b) at eye height in the city, along the streets and to their ends
//   backs   (c) the backs and the sides of the villas (not the fronts)
//   villa   (d) Villa Nova (the classic on the crescent) from its garden and from its roof terrace
//   temple  (e) the Gate Temple from 150 m, from the plaza, from the city side and from the west
//   water   (f) the lake under the Sky Isles (its sand shore, the reflections) and the canyon's aether river
//   far     (g) the far world from ridges: the horizon, the far ring, the sky
//   <site>_r1, <site>_r2  (h) two seeded "random" cameras per site (the same every run)
// The camera is teleported (as the other tests set the player's position); nothing is built, no setting beyond the
// preset and the time is touched. The villagers right at the lens (within 8 blocks) and the wandering animals are
// left out of the pictures. Pictures: test/shots/beauty_<site>_<n>_<TAG>.png (1280 × 720; a camera's extra times of
// day as beauty_<site>_<n>_<time>_<TAG>.png); the cameras, the ground under them and the timings in
// test/shots/beauty_<TAG>.json.
// COST=1: the Very Low (potato) cost at two scenes — ms per frame (the GPU drained), draws, triangles; the median of
// the rounds — and with COST_DIST=file:///…/index.html the same for that build, the two pages measured in turns.
// Checks: the world is vgen 8 with Nova Haven, every picture is written and not blank, no page error.
// usage: BEFORE_DIST=file:///…/index.html TAG=after nohup bash test/wt_run.sh beauty_audit.mjs 7200 > .tmp_tests/beauty_audit.log 2>&1 &
//   BEFORE_DIST: a build before, shot first (…_before.png), then DIST (default this checkout's dist) as …_<TAG>.png
//   ONLY=hills,street_1 (sites or shot names) · SEED=4242 · NO_EXTRA=1 (each camera at its own time only) · NO_AFTER=1
// regress: skip  (a showcase: the pictures are the evidence; the gates are the node tests, test/beauty_rules.js)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/claude/.npm-global/lib/node_modules/sharp/lib/index.js';
import fs from 'fs';
const TAG = process.env.TAG || 'after', SEED = process.env.SEED || '4242', N = +(process.env.N || 8);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const DIST = process.env.DIST || 'file:///home/claude/vr/dist/index.html';
const MORNING = 2000, NOON = 6000, GOLDEN = 12500, NIGHT = 16000;
const TODN = { [MORNING]: 'morning', [NOON]: 'noon', [GOLDEN]: 'golden', [NIGHT]: 'night' };
const EYE = 1.62;
// a camera: [name, [x, z], eye above the ground or {y: absolute eye height}, [look-at x, y, z], fov, time, extra times]
const CAMS = [
  // (e) the temple — first: the world starts at the temple's hangar hall
  ['temple_1', [0.5, 150.5], { y: 97 }, [0, 100, 0], 60, GOLDEN, [NIGHT]],            // 150 m south over the plaza
  ['temple_2', [14.5, 50.5], EYE, [0, 88, 20], 70, NOON, []],                          // from the plaza: the portal
  ['temple_3', [78.5, -62.5], { y: 102 }, [0, 92, -10], 60, MORNING, []],              // from the city side: its back and east side
  ['temple_4', [-150.5, 5.5], { y: 96 }, [0, 92, -10], 60, NIGHT, [NOON]],            // from the west
  // (b) the streets
  ['street_1', [-22.5, -63.5], EYE, [-70, 82.6, -72], 70, GOLDEN, [NIGHT]],           // the crescent west, into the low sun
  ['street_3', [1.5, -62.5], EYE, [1, 83, -100], 70, NOON, []],                        // up the avenue to the fork
  ['street_4', [88.5, -83.5], EYE, [113, 82.6, -97], 70, NIGHT, [NOON]],              // the crescent's east end
  // (c) the backs and sides of the villas
  ['backs_1', [24.5, -114.5], EYE, [22, 86, -95], 70, NOON, [GOLDEN]],                // the corner villa's back
  ['backs_2', [-47.5, -116.5], EYE, [-47, 86, -100], 70, MORNING, []],                 // the tower house's back
  ['backs_4', [35.5, -72.5], EYE, [35.5, 84, -100], 70, NOON, []],                     // the gap between two villas: their sides
  ['backs_5', [40.5, -111.5], EYE, [39, 85, -129], 70, MORNING, []],                   // a Palm Row villa's back from the crescent's gardens
  ['backs_3', [75.5, -136.5], EYE, [75, 88, -112], 70, GOLDEN, []],                    // the classic's back: the glass wall
  // (d) Villa Nova (the classic, lot 87/−92): from the garden and from the roof terrace
  ['villa_1', [56.5, -133.5], EYE, [76, 86, -110], 75, GOLDEN, [NIGHT]],              // from the back garden's corner, over its mounds (run 2 stood in front of one)
  ['villa_2', [69.5, -103.5], EYE, [0, 90, -10], 70, MORNING, [GOLDEN]],              // the roof terrace (its lawn at 94), over the city to the temple
  ['villa_3', [70.5, -109.5], EYE, [40, 105, -230], 70, NOON, []],                    // the roof terrace, to the terraced hills
  ['street_2', [40.5, -157.5], EYE, [84, 82.6, -171], 70, MORNING, []],               // Palm Row east to its end
  // (a) from the hills down at the city
  ['hills_1', [0.5, -292.5], { y: 136 }, [0, 84, -105], 60, GOLDEN, [NOON, NIGHT]],
  ['hills_2', [-110.5, -250.5], 30, [-10, 84, -110], 60, MORNING, []],
  ['hills_3', [115.5, -236.5], 28, [10, 84, -110], 60, NOON, []],
  // (g) the far world from ridges
  ['far_4', [0.5, -330.5], { y: 160 }, [0, 80, 100], 60, NIGHT, [GOLDEN]],          // the whole Heartland at night
  ['far_2', [0.5, -425.5], { y: 128 }, [0, 100, -1200], 70, MORNING, []],             // from the Pod Hills' crest, north
  ['far_1', [-410.5, -150.5], { y: 172 }, [-900, 120, -250], 70, GOLDEN, []],         // from the station mountain's west shoulder (run 2 stood in the station)
  ['far_3', [-470.5, 420.5], { y: 128 }, [-1000, 100, 900], 70, NOON, []],            // from the citadel's mountain, south-west
  // (f) the water line
  ['water_3', [6.5, 178.5], { y: 66 }, [0, 59, 230], 70, NIGHT, [GOLDEN]],            // the canyon's aether river
  ['water_1', [201.5, 6.5], EYE, [250, 64, 70], 70, GOLDEN, []],                      // the lake from its north end, the isles over it
  ['water_2', [222.5, 32.5], EYE, [190, 64, 40], 70, NOON, [NIGHT]],                  // from the east shore across the lake
];
// (h) two seeded "random" cameras per site: a site's area, how the camera stands there, the times it is shot at
const RSITES = {
  temple: { n: 2, tods: [MORNING, NIGHT] },
  street: { n: 2, tods: [NOON, GOLDEN] },
  backs: { n: 2, tods: [MORNING, GOLDEN] },
  villa: { n: 2, tods: [NOON, NIGHT] },
  hills: { n: 2, tods: [NOON, GOLDEN] },
  far: { n: 2, tods: [MORNING, GOLDEN] },
  water: { n: 2, tods: [NOON, GOLDEN] },
};
const hashS = (s) => { let h = 2166136261 >>> 0; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };
const rngOf = (s) => { let a = hashS(s + ':' + SEED) || 1; return () => { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; }; };
const SHOTS = [];
const want = (name) => !ONLY || ONLY.some(o => name === o || name.startsWith(o + '_'));
// (the order keeps the camera near the ground the world has loaded: each site's random cameras right after its own)
const ORDER = ['temple_1', 'temple_2', 'temple_3', 'temple_4', 'temple_r1', 'temple_r2', 'street_1', 'street_3', 'street_4', 'backs_4', 'backs_1', 'backs_5',
  'backs_2', 'street_r1', 'street_r2', 'backs_r1', 'backs_r2', 'backs_3', 'villa_1', 'villa_2', 'villa_3', 'villa_r1', 'villa_r2', 'street_2', 'hills_1',
  'hills_2', 'hills_3', 'hills_r1', 'hills_r2', 'far_4', 'far_2', 'far_1', 'far_3', 'water_3', 'water_1', 'water_2', 'water_r1', 'water_r2', 'far_r1', 'far_r2'];
for (const name of ORDER) {
  if (!want(name)) continue;
  const c = CAMS.find(q => q[0] === name);
  if (c) { SHOTS.push({ name, x: c[1][0], z: c[1][1], eye: c[2], at: c[3], fov: c[4], tod: c[5], extra: process.env.NO_EXTRA ? [] : c[6] }); continue; }
  const m = /^(\w+)_r(\d)$/.exec(name), site = m && m[1], i = m && +m[2];
  if (site && RSITES[site]) SHOTS.push({ name, random: site, rnd: rngOf(name), fov: 70, tod: RSITES[site].tods[(i - 1) % RSITES[site].tods.length], extra: [] });
}
// the random cameras by site, placed in the page once the ground round them is there (a road cell, a sand cell …)
const placeRandom = async (ev, s) => {
  const r = s.rnd, site = s.random;
  const q = { site, r: [r(), r(), r(), r(), r(), r()] };
  return ev((q) => {
    const g = VR.game, w = g.world, R = VR.R, F = VR.F, nm = (b) => b ? R.types[R.T.type[b]].name : 'air', [a, b, c, d, e, f] = q.r;
    const solid = (x, y, z) => { const s0 = w.getBlock(Math.floor(x), y, Math.floor(z)); return s0 && (R.T.flags[s0] & F.OPAQUE); };
    const top = (x, z, y0 = 200) => { for (let y = y0; y > 30; y--) { const s0 = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s0 && (R.T.flags[s0] & (F.OPAQUE | F.FLUID)) && !(R.T.flags[s0] & F.LEAVES)) return y; } return 80; };
    const look = (x, y, z, tx, ty, tz) => { const dx = tx - x, dy = ty - y, dz = tz - z; return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) }; };
    const NH = VR.VillageGen && VR.VillageGen.NOVA_HAVEN;
    if (q.site === 'street' && NH) {
      // a point on one of the roads, looking along it one way or the other
      const rds = NH.ROADS.filter(x => x.name !== 'hillroad'), rd = rds[Math.floor(a * rds.length)];
      let x, z, tx, tz;
      if (rd.arc) { const A = rd.arc, f0 = Math.asin((A.x0 - A.x) / A.R), f1 = Math.asin((A.x1 - A.x) / A.R), fa = f0 + (f1 - f0) * (0.1 + 0.8 * b), fb = fa + (c < 0.5 ? -0.12 : 0.12); x = A.x + A.R * Math.sin(fa); z = A.z - A.R + A.R * Math.cos(fa); tx = A.x + A.R * Math.sin(fb); tz = A.z - A.R + A.R * Math.cos(fb); }
      else { const P = rd.ctrl, t = b * (P.length - 1.001), k = Math.floor(t), u = t - k; x = P[k][0] + (P[k + 1][0] - P[k][0]) * u; z = P[k][1] + (P[k + 1][1] - P[k][1]) * u; const dir = c < 0.5 ? -1 : 1, kk = Math.max(0, Math.min(P.length - 1, k + (dir > 0 ? 1 : 0))); tx = P[kk][0] + (P[kk][0] - x) * 2; tz = P[kk][1] + (P[kk][1] - z) * 2; if (Math.hypot(tx - x, tz - z) < 2) { tx = x; tz = z - 20; } }
      x += (d - 0.5) * 3; const y = top(x, z, 100) + 1 + 1.62, L = look(x, y, z, tx, y + (e - 0.6) * 4, tz);
      return { x, y: y - 1.62, z, yaw: L.yaw + (f - 0.5) * 0.5, pitch: L.pitch - 0.02, what: rd.name };
    }
    if (q.site === 'backs') {
      // between the crescent's villas and Palm Row's, on the lawn, looking about
      for (let k = 0; k < 40; k++) {
        const x = -100 + ((a + k * 0.618) % 1) * 200, z = -140 + ((b + k * 0.382) % 1) * 40, y = top(x, z, 110);
        if (nm(w.getBlock(Math.floor(x), y, Math.floor(z))) !== 'grass_block' || solid(x, y + 1, z) || solid(x, y + 2, z)) continue;
        return { x, y: y + 1, z, yaw: c * Math.PI * 2, pitch: -0.05 + d * 0.15, what: 'lawn' };
      }
    }
    if (q.site === 'villa') {
      // in the classic's lot (87/−92, r 2: x 63–87, z −122 … −92): on the lawn or on a roof
      const roof = a < 0.5;
      for (let k = 0; k < 40; k++) {
        const x = 63 + ((b + k * 0.618) % 1) * 24, z = -122 + ((c + k * 0.382) % 1) * 30, y = top(x, z, roof ? 104 : 86);
        if (solid(x, y + 1, z) || solid(x, y + 2, z) || y < 80) continue;
        return { x, y: y + 1, z, yaw: d * Math.PI * 2, pitch: -0.15 + e * 0.2, what: roof ? 'roof' : 'garden' };
      }
    }
    if (q.site === 'temple') {
      const ang = a * Math.PI * 2, dist = 50 + b * 120, x = Math.sin(ang) * dist, z = -10 + Math.cos(ang) * dist, y = Math.max(top(x, z, 140) + 2, top(x, z, 140) + 2 + c * 28);
      const L = look(x, y + 1.62, z, (d - 0.5) * 20, 95, -10 + (e - 0.5) * 20);
      return { x, y, z, yaw: L.yaw, pitch: L.pitch, what: 'around' };
    }
    if (q.site === 'hills') {
      const x = -150 + a * 300, z = -290 + b * 75, y = top(x, z, 170) + 25 + c * 35;
      return { x, y, z, yaw: Math.PI + (d - 0.5) * 1.2, pitch: -0.12 - e * 0.23, what: 'above the terraces' };
    }
    if (q.site === 'far') {
      const ang = a * Math.PI * 2, dist = 350 + b * 270, x = Math.sin(ang) * dist, z = Math.cos(ang) * dist, y = top(x, z, 230) + 30;
      return { x, y, z, yaw: c * Math.PI * 2, pitch: -0.06, what: 'ridge' };
    }
    if (q.site === 'water') {
      // a cell of the lake's shore (sand or grass by the water), looking across the lake
      const isW = (x, z) => nm(w.getBlock(Math.floor(x), 63, Math.floor(z))) === 'water';
      for (let k = 0; k < 60; k++) {
        const x0 = 192 + ((a + k * 0.618) % 1) * 93, z0 = 5 + ((b + k * 0.382) % 1) * 83;
        for (let rr = 0; rr <= 12; rr++) for (let t = 0; t < 16; t++) {
          const x = x0 + Math.cos(t / 16 * Math.PI * 2) * rr, z = z0 + Math.sin(t / 16 * Math.PI * 2) * rr;
          if (isW(x, z)) continue;
          if (!(isW(x + 1, z) || isW(x - 1, z) || isW(x, z + 1) || isW(x, z - 1))) continue;
          const y = top(x, z, 90); if (y < 62 || y > 66 || solid(x, y + 1, z)) continue;
          const L = look(x, y + 2.6, z, 235 + (c - 0.5) * 40, 63, 48 + (d - 0.5) * 40);
          return { x, y: y + 1, z, yaw: L.yaw, pitch: L.pitch, what: nm(w.getBlock(Math.floor(x), y, Math.floor(z))) };
        }
      }
    }
    return null;
  }, q);
};

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';

// ---------------------------------------------------------------- a page with a world
async function openWorld(dist, preset) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|missing/i.test(s)) logs.push(`[${t}] ${s.slice(0, 500)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
  await page.goto(dist);
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  // a step of the game without drawing (the world streams, the horizon and the far ring build)
  const step = async (n, dtms = 16) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
  // settled: no job, no column waiting, nothing to mesh or upload or fading in, every column within the render
  // distance shown, the horizon and the far ring quiet (the far ring at most `farMax` rounds). While it settles, the
  // world may start more mesh jobs and uploads per frame than the preset's streaming rate (renderer.q.upload, which
  // only paces the loading; run 1 of this test spent 100 s a camera with 7 000 sections still waiting at 12 jobs a
  // frame): the rate is the preset's again for every drawn picture and for the cost
  const boost = (on) => ev((on) => { const g = VR.game, q = g.renderer && g.renderer.q; if (!q) return; if (on) { if (q.__up === undefined) q.__up = q.upload; q.upload = 24; } else if (q.__up !== undefined) { q.upload = q.__up; delete q.__up; } }, on);
  const settle = async (max = 60, farMax = 30) => {
    let s = null;
    await boost(true);
    for (let i = 0; i < max; i++) {
      await step(20);
      s = await ev(() => { const g = VR.game, w = g.world, p = g.player, rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0, dirtyAll = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if (sc.dirty || sc.pending) n++; dirtyAll += n; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= rd * rd) dirty += n; } let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } const h = g.horizon, f = h && h.far, fr = f && f.report ? f.report() : null; return { busy: g.pool.busy, pend: w.pending.size, dirty, dirtyAll, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown, hz: h ? h.inflight : 0, far: fr ? fr.inflight + fr.want : 0 }; });
      const near = s.busy === 0 && s.pend === 0 && s.dirty === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0;
      s.i = i;
      if (near && i > 2 && ((s.hz === 0 && s.far === 0) || i >= farMax)) break;
      await wait(30);
    }
    await boost(false);
    return s;
  };
  // the detailed pieces (VX: crowns, furniture, facade pieces) within the detail distance, uploaded before a picture
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
  await ev(`VR.game.createWorld({name:'Beauty',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
  for (let i = 0; i < 150; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  const ok = await ev(() => VR.game.state) === 'play';
  await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui', 'hints']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } });
  const groundY = (x, z) => ev(([x, z]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = 200; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & (F.OPAQUE | F.FLUID)) && !(R.T.flags[s] & F.LEAVES)) return y; } return 80; }, [x, z]);
  const pose = (x, feet, z, yaw, pitch, fov, tod) => ev(([x, y, z, yaw, pitch, fov, tod]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = yaw; p.pitch = pitch; p.fovKick = 0; p.vel = [0, 0, 0]; g.settings.fov = fov; g.env.setTime(tod); const e = g.entities; if (e && e.mobs) e.mobs.length = 0; }, [x, feet, z, yaw, pitch, fov, tod]);
  // a picture: the frames drawn with the villagers at the lens left out; the time of day set first
  const picture = async (path, tod, frames = 4) => {
    const vx = await warmVx();
    await ev(([frames, tod]) => { window.__norender = false; const g = VR.game, V = g.villages, p = g.player; g.env.setTime(tod); const keep = V && V.agents ? V.agents : null; if (keep) V.agents = keep.filter(a => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) > 8); for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); if (keep) V.agents = keep; window.__norender = true; }, [frames, tod]);
    await page.screenshot({ path, timeout: 180000 });
    return vx;
  };
  return { ctx, page, logs, ev, wait, step, settle, warmVx, groundY, pose, picture, ok };
}

// a picture is not blank: the luminance spreads (a black or a one-colour frame fails)
const notBlank = async (path) => { try { const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true }); let s = 0, s2 = 0, n = 0; for (let i = 0; i < data.length; i += info.channels * 7) { const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; s += l; s2 += l * l; n++; } const m = s / n; return Math.sqrt(Math.max(0, s2 / n - m * m)) > 6; } catch (e) { return false; } };

// ---------------------------------------------------------------- the audit of one build
// (the random cameras' first guesses: the middle of their site)
const MID = { temple: [0, -10], street: [0, -100], backs: [0, -120], villa: [75, -107], hills: [0, -250], far: [0, -400], water: [235, 45] };
async function audit(tag, dist, keepOpen) {
  const record = { tag, seed: SEED, dist, shots: [], cost: null }, recPath = `/home/claude/vr/test/shots/beauty_${tag}.json`;
  const A = await openWorld(dist, 'high');
  check(A.ok, `${tag}: the world is loaded (${secs()})`);
  const meta = await A.ev(() => { const g = VR.game, w = g.world, gen = w && w.genOpts; const VG = VR.VillageGen; return { vgen: (g.meta && g.meta.vgen) || (gen && gen.vgen) || 0, preset: g.settings.preset, rd: w.renderDist, far: g.settings.far, look: VR.LOOK ? VR.LOOK.mode : '?', nh: !!(VG && VG.NOVA_HAVEN) }; });
  console.log(tag, 'world', JSON.stringify(meta));
  check(meta.vgen >= 8 && meta.nh && meta.preset === 'high', `${tag}: a new default world (vgen ${meta.vgen}) with Nova Haven on High (${JSON.stringify(meta)})`);
  await A.settle(80);
  let pics = 0, wanted = 0;
  const blank = [];
  const place = async (s) => {
    await A.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 150, z); }, [s.x !== undefined ? s.x : 0, s.z !== undefined ? s.z : 0]);
    s.s1 = await A.settle(150, 8);
    if (s.random) {
      // the random cameras: a first guess of the area's middle to load it, then the camera placed on what is there
      const P = await placeRandom(A.ev, s);
      if (!P) return null;
      await A.ev(([x, z]) => { const p = VR.game.player; p.teleport(x, 150, z); }, [P.x, P.z]);
      await A.settle(120, 8);
      s.x = +P.x.toFixed(2); s.z = +P.z.toFixed(2); s.feet = +P.y.toFixed(2); s.yaw = +P.yaw.toFixed(3); s.pitch = +P.pitch.toFixed(3); s.what = P.what;
    } else {
      const gy = await A.groundY(s.x, s.z);
      s.ground = gy;
      const eyeY = typeof s.eye === 'object' ? s.eye.y : gy + 1 + s.eye;
      s.feet = +(eyeY - EYE).toFixed(2);
      const dx = s.at[0] - s.x, dy = s.at[1] - eyeY, dz = s.at[2] - s.z;
      s.yaw = +Math.atan2(-dx, -dz).toFixed(3); s.pitch = +Math.atan2(dy, Math.hypot(dx, dz)).toFixed(3);
    }
    await A.pose(s.x, s.feet, s.z, s.yaw, s.pitch, s.fov, s.tod);
    // (the far cameras' columns load slowly — run 2 left 200 … 350 of them unshown after 60 rounds: up to 150 now, a
    //  camera whose near world is all there stops as soon as it is)
    const st = await A.settle(150, 30); await A.step(6);
    return st;
  };
  // every build starts its random cameras afresh (the same seeded draws, the same first guesses)
  const shots = SHOTS.map(s0 => { const s = Object.assign({}, s0); if (s.random) { s.rnd = rngOf(s.name); s.x = MID[s.random][0]; s.z = MID[s.random][1]; } return s; });
  // (a first visit to the first camera without a picture: the world, the far ring and the horizon settle there once —
  //  t-city2 found the first pictures after a world's load unusable)
  if (shots.length) { const s0 = Object.assign({}, shots[0]); if (s0.random) s0.rnd = rngOf(s0.name); await place(s0); await A.ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 4; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } window.__norender = true; }); await A.settle(30); }
  console.log(`${tag}: warm-up done (${secs()})`);
  for (const s of shots) {
    const t0 = Date.now();
    const st = await place(s);
    if (!st) { console.log(`  ${s.name}: no place found`); wanted++; continue; }
    const times = [s.tod].concat(s.extra || []);
    s.pics = [];
    for (let k = 0; k < times.length; k++) {
      const path = `/home/claude/vr/test/shots/beauty_${s.name}${k ? '_' + TODN[times[k]] : ''}_${tag}.png`;
      wanted++;
      const vx = await A.picture(path, times[k]);
      const ok = fs.existsSync(path);
      if (ok) { pics++; if (!(await notBlank(path))) blank.push(path); }
      s.pics.push({ path: path.replace(/^.*test\/shots\//, 'test/shots/'), tod: times[k], vx });
    }
    s.ms = Date.now() - t0;
    console.log(`  ${s.name}${s.random ? ' (' + s.what + ')' : ''}: (${s.x}, ${s.feet}, ${s.z}) yaw ${s.yaw} pitch ${s.pitch} fov ${s.fov} · ${times.map(t => TODN[t]).join(', ')} · ${(s.ms / 1000).toFixed(0)} s · load ${s.s1 ? s.s1.i + 1 : '?'} rounds · settle ${JSON.stringify(st)} (${secs()})`);
    record.shots.push({ name: s.name, site: s.random || s.name.split('_')[0], x: s.x, feet: s.feet, z: s.z, yaw: s.yaw, pitch: s.pitch, fov: s.fov, ground: s.ground, what: s.what, pics: s.pics, ms: s.ms });
    try { fs.writeFileSync(recPath, JSON.stringify(record, null, 1)); } catch (e) { /* the record is a convenience */ }
  }
  check(pics === wanted && wanted > 0, `${tag}: every picture is written (${pics} of ${wanted})`);
  check(blank.length === 0, `${tag}: no picture is blank (${blank.length}${blank.length ? ': ' + blank.join(', ') : ''})`);
  A.record = record; A.recPath = recPath; A.tag = tag;
  if (keepOpen) return A;
  const errs = A.logs.filter(l => l.startsWith('[pageerror]'));
  console.log(`--- ${tag} logs (${A.logs.length})`); for (const l of A.logs.slice(0, 12)) console.log(l);
  check(errs.length === 0, `${tag}: no page error (${errs.length})`);
  await A.ctx.close();
  return null;
}
// BEFORE_DIST (optional): the build before, shot first as …_before.png; then this checkout's dist as …_<TAG>.png
if (process.env.BEFORE_DIST) await audit('before', process.env.BEFORE_DIST, false);
const A = process.env.NO_AFTER ? null : await audit(TAG, DIST, true);
const record = A ? A.record : { cost: null }, recPath = A ? A.recPath : `/home/claude/vr/test/shots/beauty_${TAG}.json`;

// ---------------------------------------------------------------- the Very Low cost (COST=1)
// two scenes of the city at eye height (the crescent's west end, the lawn between the rows), the GPU drained after each
// frame; with COST_DIST the build before is opened beside it and the two are measured in turns
if (process.env.COST && A) {
  const SCENES = [['crescent_end', -100.5, -91.5, [-125, 82, -100]], ['between_rows', 20.5, -116.5, [20, 84, -95]]];
  const pages = [['this', A]];
  try {
    await A.ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
    if (process.env.COST_DIST) { const B = await openWorld(process.env.COST_DIST, 'potato'); check(B.ok, `the build before is loaded for the cost (${secs()})`); pages.push(['before', B]); }
    const measure = (P, n) => P.ev((n) => new Promise((ok, no) => { const g = VR.game, gl = g.renderer.gl; window.__norender = false; let k = -2, sum = 0, d = 0, t = 0; const f = () => { try { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); const dt = performance.now() - t0; if (k < 0) { k++; setTimeout(f, 0); return; } const st = g.renderer.stats || {}; sum += dt; d += st.draws || 0; t += st.tris || 0; if (++k < n) setTimeout(f, 0); else { window.__norender = true; ok({ ms: +(sum / n).toFixed(2), draws: Math.round(d / n), tris: Math.round(t / n) }); } } catch (e) { no(String(e)); } }; f(); }), n);
    record.cost = {};
    for (const [scene, x, z, at] of SCENES) {
      for (const [, P] of pages) {
        const gy = await P.groundY(x, z), eyeY = gy + 1 + EYE, dx = at[0] - x, dy = at[1] - eyeY, dz = at[2] - z;
        await P.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 150, z); }, [x, z]); await P.settle(40, 4);
        await P.pose(x, eyeY - EYE, z, Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz)), 70, GOLDEN);
        await P.settle(80, 4); await P.step(6);
      }
      const rounds = {};
      for (let r = 0; r < 5; r++) {
        const order = r & 1 ? pages.slice().reverse() : pages;
        for (const [lbl, P] of order) { (rounds[lbl] = rounds[lbl] || []).push(await measure(P, N)); }
      }
      const out = {};
      for (const lbl of Object.keys(rounds)) { const ms = rounds[lbl].map(q => q.ms).sort((a, b) => a - b); out[lbl] = { msMedian: ms[ms.length >> 1], ms, draws: rounds[lbl][2].draws, tris: rounds[lbl][2].tris }; }
      if (out.before && out.this) out.ratio = +(out.this.msMedian / out.before.msMedian).toFixed(3);
      record.cost[scene] = out;
      console.log(`very low · ${scene}: ${JSON.stringify(out)}`);
      await A.picture(`/home/claude/vr/test/shots/beauty_potato_${scene}_${TAG}.png`, GOLDEN, 16);
    }
    try { fs.writeFileSync(recPath, JSON.stringify(record, null, 1)); } catch (e) { /* the record is a convenience */ }
    for (const [lbl, P] of pages) if (lbl !== 'this') { const errs = P.logs.filter(l => l.startsWith('[pageerror]')); check(errs.length === 0, `${lbl}: no page error (${errs.length})`); await P.ctx.close(); }
  } catch (e) { check(false, `the Very Low cost is measured (${String(e.message || e).slice(0, 300)})`); }
}
if (A) {
  const errs = A.logs.filter(l => l.startsWith('[pageerror]'));
  console.log(`--- ${TAG} logs (${A.logs.length})`); for (const l of A.logs.slice(0, 12)) console.log(l);
  check(errs.length === 0, `${TAG}: no page error (${errs.length})`);
  await A.ctx.close();
}
await browser.close();
console.log(`(${secs()})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
