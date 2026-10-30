// u-moons2 · Zinnober, Ocker and Aquamarin in the browser (docs/superpowers/plans/2026-10-30-u-moons2.md §2): the
// pictures, the LUTs' cost in the page, Very Low's three-stop skies and their frame.
//  1 · page A (High, view 8 → 12 on the worlds, seed 4242, no HUD): the cruise can land on all three (spaceflight's
//      landable); /dim zinn → zinn_plume (an umbrella from 10 km, Helia behind it), zinn_lava_night (the Glutsee's
//      shore at night), zinn_amarant37 (Amarant over the landing); /dim ocker → ocker_noon (from the Rostschlucht's
//      rim), ocker_sunset_blue (Helia 2° up: the blue round it — b* near vs 30° away measured from the LUT in the page),
//      ocker_dustdevil, ocker_storm (τ 4.5, the front); /dim aqua → aqua_atoll (from 110 m), aqua_waves (the sea toward
//      a low Helia), aqua_herzwelt (Herzwelt overhead at dusk); the LUTs' CPU time a frame at Balanced and High
//  2 · Very Low (potato): zinn_lava_night_vl, ocker_sunset_blue_vl, aqua_herzwelt_vl; the frame on Ocker with the
//      air's three stops against the same view airless (BS.noAir): no dearer
//   nohup bash test/wt_run.sh worlds2.mjs 3600 > .tmp_tests/worlds2.log 2>&1 &
//   ONLY=zinn|ocker|aqua · NO_VL=1 · SEED=4242
// regress: skip  (a showcase with pictures and the costs; the gates are test/bodies2.js, atmo_lut.js, body_same.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html';
const SHOTS = ROOT + '/test/shots/';
const SEED = process.env.SEED || '4242';
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
const BUDGET = +(process.env.BUDGET || 3400), left = () => BUDGET - (Date.now() - T0) / 1000;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const rec = { seed: SEED, pictures: {}, lut: null, bstar: null, vl: null };
const save = () => { try { fs.writeFileSync(SHOTS + 'worlds2.json', JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });

// ---------------------------------------------------------------- a page with a world (dims.mjs's machinery)
async function openWorld(dist, preset, rd, extra) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 500)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
  page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log('  !! the page crashed'); });
  await page.goto(dist);
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
  const boost = (on) => ev((on) => { const g = VR.game, q = g.renderer && g.renderer.q; if (!q) return; if (on) { if (q.__up === undefined) q.__up = q.upload; q.upload = 24; } else if (q.__up !== undefined) { q.upload = q.__up; delete q.__up; } }, on);
  // (maxS: past `max` rounds, keep streaming until the near world is shown or maxS seconds passed — run 2's crater and
  // night pictures were taken on a machine at load 12 after 80 and 20 rounds, the crater's walls and the landing unshown)
  const settle = async (max = 60, farMax = 30, maxS = 0) => {
    let s = null; const t0 = Date.now();
    await boost(true);
    for (let i = 0; i < max || (maxS && (Date.now() - t0) / 1000 < maxS); i++) {
      await step(20, 16);
      s = await ev(() => { const g = VR.game, w = g.world, p = g.player; if (!w || !p || g.state !== 'play') return { state: g.state }; const rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if (sc.dirty || sc.pending) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= rd * rd) dirty += n; } let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } const h = g.horizon, f = h && h.far, fr = f && f.report ? f.report() : null; return { state: g.state, busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown, hz: h && h.enabled() ? h.inflight : 0, far: fr ? fr.inflight + fr.want : 0, hold: !!p.hold }; });
      const near = s.state === 'play' && s.busy === 0 && s.pend === 0 && s.dirty === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0 && !s.hold;
      s.i = i;
      s.near = near;
      if (near && i > 2 && ((s.hz === 0 && s.far === 0) || i >= farMax)) break;
      await wait(30);
    }
    await boost(false);
    if (s && !s.near) console.log(`  (the near world not yet all shown: ${JSON.stringify(s)})`);
    return s;
  };
  const picture = async (path, frames = 4) => {
    await ev((frames) => { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, frames);
    for (let k = 0; k < 2; k++) {
      try { await page.screenshot({ path, timeout: 150000 }); return true; } catch (e) { console.log(`  !! screenshot ${path.replace(/^.*\//, '')} failed (${String(e.message || e).split('\n')[0].slice(0, 120)})`); }
    }
    return false;
  };
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(([p, rd, ex]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; if (rd) g.settings.renderDist = rd; if (ex) Object.assign(g.settings, ex); g.applySettings('*'); }, [preset, rd, extra || null]);
  await ev(`VR.game.createWorld({name:'Welten',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
  for (let i = 0; i < 180; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  const ok = await ev(() => VR.game.state) === 'play';
  await ev(() => { const g = VR.game; window.__raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.wx.force('klar'); if (!document.getElementById('__nohint')) { const st = document.createElement('style'); st.id = '__nohint'; st.textContent = '#hint,#hints,#lockhint,#toasts,.toast{display:none !important}'; document.head.appendChild(st); } g.hideHud = true; const hud = document.getElementById('hud'); if (hud) hud.style.visibility = 'hidden'; });   // (postcards: no HUD, no hand)
  return { ctx, page, logs, ev, wait, step, settle, picture, ok };
}
// a trip to `to` (/dim), the frames stepped until the first frame there
async function trip(A, to) {
  await A.ev(() => { window.__lastTrip = VR.Travel.last; });
  await A.ev((to) => { VR.Travel.go(VR.game, { dim: to, via: 'cmd' }); }, to);
  let s = null;
  for (let i = 0; i < 900; i++) {
    await A.step(10, 33);
    s = await A.ev((to) => { const g = VR.game, L = VR.Travel.last; return { state: g.state, dim: g.dim, arrived: !!(L && L !== window.__lastTrip && L.to === to), last: L }; }, to);
    if (s.arrived && s.state === 'play') break;
    await A.wait(20);
  }
  console.log(`  trip → ${to}: ${JSON.stringify(s && s.last)} (${secs()})`);
  return s;
}
// the world clock set so that VR.Universe's time is t seconds (frozen: zenFreezeTime)
const setT = (A, t) => A.ev((t) => { const e = VR.game.env, k = Math.round(t * 20); e.day = Math.floor(k / 24000); e.ticks = k - e.day * 24000; }, t);
// the camera: flying in place at (x, y, z) looking at yaw / pitch (radians)
const place = (A, x, y, z, yaw, pitch) => A.ev(([x, y, z, yaw, pitch]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = yaw; p.pitch = pitch; p.vel = [0, 0, 0]; }, [x, y, z, yaw, pitch]);
const shot = async (A, name, frames = 6) => { await A.page.bringToFront(); await A.step(60, 33);
  const ok = await A.picture(SHOTS + name + '.png', frames);
  const info = await A.ev(() => { const B = VR.BodySky, c = B && B.cur, g = VR.game; return c ? { exposure: +g.env.E.exposure.toFixed(2), sunEl: +(c.light.sunEl * 57.3).toFixed(1), lightK: +c.light.lightK.toFixed(2), parEl: +(c.light.parEl * 57.3).toFixed(1), plumes: B.plumes.length, air: c.sky.airK[0], airTier: c.sky.airK[2], tau: +B.dustTau.toFixed(2), fov: g.settings.fov, pos: g.player.pos.map(v => Math.round(v)) } : null; });
  rec.pictures[name] = info; save(); check(ok, `test/shots/${name}.png ${JSON.stringify(info)}`); return ok; };
// the moment the sun stands at el (degrees) on the way up (dir 1) or down (−1) — or the extreme (dir 0: the highest)
const findT = (A, dim, eye, el, dir, from = 0, span = 9000) => A.ev(([dim, eye, el, dir, from, span]) => {
  // (by day never inside an eclipse: Aquamarin's near side sees Herzwelt cover Helia every orbit at noon)
  const BS = VR.BodySky, f = (t) => { const L = BS.compute(dim, eye, t, { tier: 0 }).light; return [L.sunEl * 57.2958, L.eclipse]; };
  let best = from, bv = 1e9, prev = f(from)[0];
  for (let t = from + 10; t < from + span; t += 10) { const [v, ec] = f(t), up = v > prev; prev = v; if (el > 0 && ec > 0.02) continue; if (dir === 0) { if (-v < bv) { bv = -v; best = t; } continue; } if ((dir > 0) !== up) continue; const d = Math.abs(v - el); if (d < bv) { bv = d; best = t; } }
  return best;
}, [dim, eye, el, dir, from, span]);
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
const groundAt = (A, id, x, z) => A.ev(([id, x, z]) => new VR.BodyGen(VR.game.meta.seed >>> 0, id, {}).surfaceY(Math.floor(x), Math.floor(z)), [id, x, z]);
const view = async (A, id, x, z, up, yaw, pitch, t, settle = 30) => { const y = await groundAt(A, id, x, z); await setT(A, t); await place(A, x + 0.5, y + 1 + up, z + 0.5, yaw, pitch); await A.settle(60, 3, settle); return y; };
const ONLY = process.env.ONLY || '';

// ================================================================ 1 · page A
const A = await openWorld(DIST, 'high', 8, { far: 0 });
check(A.ok, `page A: the world is loaded (High, view 8, ${secs()})`);
await A.settle(40, 4);
{
  const L = await A.ev(() => ({ zinn: VR.SpaceFlight ? VR.SpaceFlight.landable('zinn') : null, ocker: VR.SpaceFlight ? VR.SpaceFlight.landable('ocker') : null, aqua: VR.SpaceFlight ? VR.SpaceFlight.landable('aqua') : null, cruise: VR.Cruise ? VR.Cruise.TO.join(',') : null }));
  check(L.zinn && L.ocker && L.aqua && /zinn/.test(L.cruise) && /ocker/.test(L.cruise) && /aqua/.test(L.cruise), `the cruise reaches all three and V lands there: ${JSON.stringify(L)}`);
}
const B2 = (A, k, v) => A.ev(([k, v]) => { VR.BodyLife2.force[k] = v; if (v === undefined) delete VR.BodyLife2.force[k]; }, [k, v]);
const wide = (A) => A.ev(() => { const g = VR.game; g.settings.renderDist = 12; g.applySettings('renderDist'); });

if (!ONLY || ONLY === 'zinn') {
  const s = await trip(A, 'zinn'); await wide(A); await A.settle(60, 4);
  await A.step(30, 33); await shot(A, 'zinn_arrival');   // (u-moons3: the first frame on arrival — the landing faces the best view)
  check(s && s.arrived, 'with /dim to Zinnober');
  const Z = await A.ev(() => { const g = new VR.BodyGen(VR.game.meta.seed >>> 0, 'zinn', {}); const v = g.vents()[0]; return { v: { x: v.x, z: v.z, y: v.y }, G: { x: g.glut.x, z: g.glut.z, R: g.glut.R }, sp: g.findSpawn() }; });
  // a firing vent with Helia 12–30° up, the camera 10 km from it with Helia behind the plume
  const tp = await A.ev(([v]) => { const BS = VR.BodySky, P = VR.Bodies.profile('zinn'), vent = new VR.BodyGen(VR.game.meta.seed >>> 0, 'zinn', {}).vents()[0];
    for (let t = 200; t < 60000; t += 5) { const pl = VR.BodyLife2.plume(vent, t, P, 1.8); if (pl.k < 0.6 || pl.top < 0.9 * pl.H) continue; const L = BS.compute('zinn', [v.x, 70, v.z], t, { tier: 0 }).light; const h = Math.hypot(L.sunDir[0], L.sunDir[2]); if (h < 0.1) continue;
      const cx = v.x + L.sunDir[2] / h * 17000, cz = v.z - L.sunDir[0] / h * 17000,   /* (17 km off, Helia to the side: run 4 found no moment with Helia behind the plume that far) */ Lc = BS.compute('zinn', [cx, 70, cz], t, { tier: 0 }).light; if (Lc.sunEl > 0.2 && Lc.sunEl < 0.6) return { t, cx, cz }; } return null; }, [Z.v]);
  if (tp) {
    const cx = tp.cx, cz = tp.cz, ux = Z.v.x - cx, uz = Z.v.z - cz;
    await view(A, 'zinn', cx, cz, 40, yawTo(ux, uz), 0.16, tp.t, 120);
    await shot(A, 'zinn_plume');
  } else check(false, 'a firing plume by day found');
  const tn = await findT(A, 'zinn', [Z.G.x, 70, Z.G.z], -40, -1);
  await view(A, 'zinn', Z.G.x + Z.G.R + 22, Z.G.z + 18, 14, yawTo(-1, -0.15), -0.3, tn, 120);
  await shot(A, 'zinn_lava_night');
  const td = await findT(A, 'zinn', [0.5, 66, 0.5], 22, 1);
  await setT(A, td); await place(A, Z.sp[0], Z.sp[1] + 1.62, Z.sp[2], 0, 0); await A.settle(30, 2, 40);
  const par = await A.ev(() => VR.BodySky.cur.sky.par.slice(0, 3));
  await place(A, Z.sp[0], Z.sp[1] + 1.62, Z.sp[2], yawTo(par[0], par[2]), Math.asin(par[1]) - 0.12); await A.settle(30, 2, 60);
  await shot(A, 'zinn_amarant37');
}
if (!ONLY || ONLY === 'ocker') {
  const s = await trip(A, 'ocker'); await wide(A); await A.settle(60, 4);
  await A.step(30, 33); await shot(A, 'ocker_arrival');   // (u-moons3: the first frame on arrival — the landing faces the best view)
  check(s && s.arrived, 'with /dim to Ocker');
  await B2(A, 'storm', 0); await B2(A, 'front', 0);
  const O = await A.ev(() => { const g = new VR.BodyGen(VR.game.meta.seed >>> 0, 'ocker', {}); return { sp: g.findSpawn() }; });
  const tNoon = await findT(A, 'ocker', [0.5, 152, 0.5], 0, 0, 0, 2400);
  // (on the Rostschlucht's floor by its north wall: 145 m of layered rock over you)
  const fl = await A.ev(() => { const g = new VR.BodyGen(VR.game.meta.seed >>> 0, 'ocker', {}); return g.canyonZ(0) - 0.6 * g.canyonHalf(0); });
  await view(A, 'ocker', 0, fl, 3, 0, 0.3, tNoon, 120);
  await shot(A, 'ocker_noon');
  const tSet = await findT(A, 'ocker', [0.5, 152, 0.5], 2, -1, 0, 2400);
  await setT(A, tSet); await place(A, O.sp[0], O.sp[1] + 1.62, O.sp[2], 0, 0); await A.settle(20, 2, 30);
  const sd = await A.ev(() => VR.BodySky.cur.light.sunDir);
  await place(A, O.sp[0], O.sp[1] + 3, O.sp[2], yawTo(sd[0], sd[2]), 0.07); await A.settle(30, 2, 60);
  // the blue round Helia, measured on the LUT the page draws: within 10° of Helia against 30° away (CIE b*)
  rec.bstar = await A.ev(() => { const A2 = VR.AtmoLUT, st = VR.BodySky.airState, sd = VR.BodySky.cur.light.sunDir, el = Math.asin(sd[1]), az = Math.atan2(sd[2], sd[0]);
    const dir = (dEl, dAz) => { const e = el + dEl, a = az + dAz; return [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)]; };
    const near = A2.sample(st.C, dir(0.05, 0.1), sd, [0, 0, 0]), far = A2.sample(st.C, dir(0.05, 0.52), sd, [0, 0, 0]);
    return { near: A2.lab(near)[2], far: A2.lab(far)[2], el: el * 57.3, W: st.C.W }; });
  save();
  check(rec.bstar.far - rec.bstar.near >= 8, `Ocker's sunset: b* within 10° of Helia ${rec.bstar.near.toFixed(0)}, 30° away ${rec.bstar.far.toFixed(0)} — bluer near Helia by ${(rec.bstar.far - rec.bstar.near).toFixed(0)} (≥ 8)`);
  await shot(A, 'ocker_sunset_blue');
  const tAft = await findT(A, 'ocker', [0.5, 152, 0.5], 25, -1, 0, 2400);
  await setT(A, tAft); await A.step(20);
  const sd2 = await A.ev(() => VR.BodySky.cur.light.sunDir), hh = Math.hypot(sd2[0], sd2[2]), px = -sd2[2] / hh, pz = sd2[0] / hh;
  await B2(A, 'devil', { x: O.sp[0] + px * 380, z: O.sp[2] + pz * 380, top: 650 });
  await place(A, O.sp[0], O.sp[1] + 2.5, O.sp[2], yawTo(px, pz), 0.18); await A.settle(30, 2, 60);
  await shot(A, 'ocker_dustdevil');
  await B2(A, 'devil', undefined);
  await B2(A, 'storm', 1); await B2(A, 'front', 0.7);
  await place(A, O.sp[0], O.sp[1] + 2.5, O.sp[2], yawTo(-px, -pz), 0.02); await A.step(300, 33); await A.settle(30, 2, 60);
  await shot(A, 'ocker_storm');
  await B2(A, 'storm', undefined); await B2(A, 'front', undefined);
  await A.ev(() => { VR.BodySky.dustTau = 0.6; VR.BodyLife2.state.tau = 0.6; });
  // the LUTs' CPU time a frame in the page: Balanced (48 × 24) and High (96 × 50), 0.6 ms budget a frame
  rec.lut = await A.ev(() => { const BS = VR.BodySky, out = {}; for (const [k, tier] of [['balanced', 2], ['high', 3], ['low', 1]]) { BS.airState = null; BS.airFor('ocker', 2, 0.3, tier); let s = 0, n = 0, mx = 0; for (let i = 0; i < 120; i++) { const t0 = performance.now(); BS.airFor('ocker', 2, 0.3 + i * 0.0004, tier); const d = performance.now() - t0; s += d; n++; mx = Math.max(mx, d); } out[k] = { ms: +(s / n).toFixed(3), max: +mx.toFixed(2) }; } BS.airState = null; return out; });
  save();
  check(rec.lut.balanced.ms <= 1 && rec.lut.high.ms <= 1.2 && rec.lut.low.ms < 0.2, `the LUTs a frame in the page: Balanced ${rec.lut.balanced.ms} ms, High ${rec.lut.high.ms} ms, Low (frozen) ${rec.lut.low.ms} ms`);
}
if (!ONLY || ONLY === 'aqua') {
  const s = await trip(A, 'aqua'); await wide(A); await A.settle(60, 4);
  await A.step(30, 33); await shot(A, 'aqua_arrival');   // (u-moons3: the first frame on arrival — the landing faces the best view)
  check(s && s.arrived, 'with /dim to Aquamarin');
  const Q = await A.ev(() => { const g = new VR.BodyGen(VR.game.meta.seed >>> 0, 'aqua', {}); return { L: g.prof.landmark, sp: g.findSpawn() }; });
  const tDay = await findT(A, 'aqua', [0.5, 75, 0.5], 40, 1, 0, 8000);
  await A.ev(() => { const g = VR.game; g.settings.renderDist = 16; g.applySettings('renderDist'); });
  const ax = Q.L.x - Q.L.R - 70, az = Q.L.z + 40;
  await setT(A, tDay); await place(A, ax, 63 + 62, az, yawTo(1, -0.15), -0.42); await A.settle(120, 6, 420);
  await shot(A, 'aqua_atoll');
  const tLow = await findT(A, 'aqua', [0.5, 75, 0.5], 9, -1, 0, 8000);
  await setT(A, tLow); await A.step(10);
  const sd = await A.ev(() => VR.BodySky.cur.light.sunDir), h = Math.hypot(sd[0], sd[2]);
  const coast = await A.ev(([ux, uz]) => { const g = new VR.BodyGen(VR.game.meta.seed >>> 0, 'aqua', {}); for (let r = 0; r < 900; r += 2) { const x = ux * r, z = uz * r; if (g.heightAt(x, z) < 62.5) return [ux * (r - 6), uz * (r - 6)]; } return [0, 0]; }, [sd[0] / h, sd[2] / h]);
  await place(A, coast[0] + 0.5, 63 + 4, coast[1] + 0.5, yawTo(sd[0], sd[2]), -0.06); await A.settle(60, 3, 90);
  await shot(A, 'aqua_waves');
  const tDusk = await findT(A, 'aqua', [0.5, 75, 0.5], -5, -1, 0, 8000);
  await setT(A, tDusk); await place(A, Q.sp[0], Q.sp[1] + 1.62, Q.sp[2], 0, 0); await A.step(20);
  const hz = await A.ev(() => VR.BodySky.cur.sky.hz.slice(0, 4));
  await place(A, Q.sp[0], Q.sp[1] + 1.62, Q.sp[2], yawTo(hz[0], hz[2]), Math.min(1.2, Math.asin(hz[1]) - 0.15)); await A.settle(30, 2, 60);
  await shot(A, 'aqua_herzwelt');
}
{
  const errs = A.logs.filter(l => l.startsWith('[pageerror]'));
  console.log(`--- page A logs (${A.logs.length})`); for (const l of A.logs.slice(0, 12)) console.log(l);
  check(errs.length === 0, `page A: no page error (${errs.length})`);
  check(!A.logs.some(l => /shader|compile|link/i.test(l)), 'page A: every shader compiles (BODYSKY with air too)');
}
await A.ctx.close();

// ================================================================ 2 · Very Low
if (!process.env.NO_VL && left() > 500) {
  const P = await openWorld(DIST, 'potato', 0);
  check(P.ok, `page VL (Very Low) is loaded (${secs()})`);
  await trip(P, 'ocker'); await P.settle(60, 4);
  const sp = await P.ev(() => new VR.BodyGen(VR.game.meta.seed >>> 0, 'ocker', {}).findSpawn());
  await P.ev(() => { VR.BodyLife2.force.storm = 0; VR.BodyLife2.force.front = 0; });
  const tSet = await findT(P, 'ocker', [0.5, 152, 0.5], 2, -1, 0, 2400);
  await setT(P, tSet); await place(P, sp[0], sp[1] + 1.62, sp[2], 0, 0); await P.step(20);
  const sd = await P.ev(() => VR.BodySky.cur.light.sunDir);
  await place(P, sp[0], sp[1] + 3, sp[2], Math.atan2(-sd[0], -sd[2]), 0.07); await P.settle(30, 2, 60);
  await shot(P, 'ocker_sunset_blue_vl');
  await trip(P, 'zinn'); await P.settle(60, 4);
  const G = await P.ev(() => { const g = new VR.BodyGen(VR.game.meta.seed >>> 0, 'zinn', {}); return { x: g.glut.x, z: g.glut.z, R: g.glut.R }; });
  const tn = await findT(P, 'zinn', [G.x, 70, G.z], -40, -1);
  const y = await groundAt(P, 'zinn', G.x + G.R + 22, G.z + 18);
  await setT(P, tn); await place(P, G.x + G.R + 22.5, y + 15, G.z + 18.5, Math.atan2(1, 0.15), -0.3); await P.settle(60, 3, 120);
  await shot(P, 'zinn_lava_night_vl');
  await trip(P, 'aqua'); await P.settle(60, 4);
  const q = await P.ev(() => new VR.BodyGen(VR.game.meta.seed >>> 0, 'aqua', {}).findSpawn());
  const tD = await findT(P, 'aqua', [0.5, 75, 0.5], -5, -1, 0, 8000);
  await setT(P, tD); await place(P, q[0], q[1] + 1.62, q[2], 0, 0); await P.step(20);
  const hz = await P.ev(() => VR.BodySky.cur.sky.hz.slice(0, 4));
  await place(P, q[0], q[1] + 1.62, q[2], Math.atan2(-hz[0], -hz[2]), Math.min(1.2, Math.asin(hz[1]) - 0.15)); await P.settle(30, 2, 60);
  await shot(P, 'aqua_herzwelt_vl');
  // the frame (after the pictures: a page measured in a tight loop answered no screenshot after it in runs 1–3): the
  // same view on Ocker with the air's three stops and airless (BS.noAir)
  await trip(P, 'ocker'); await P.settle(40, 3);
  await setT(P, tSet); await place(P, sp[0], sp[1] + 3, sp[2], Math.atan2(-sd[0], -sd[2]), 0.07); await P.settle(20, 2, 30);
  const meas = (n) => P.ev((n) => { const g = VR.game, gl = g.renderer.gl; window.__norender = false; let s = 0; for (let k = -3; k < n; k++) { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); if (k >= 0) s += performance.now() - t0; } window.__norender = true; return +(s / n).toFixed(2); }, n);
  const air = [], noair = [];
  for (let r = 0; r < 5; r++) { await P.ev(() => { VR.BodySky.noAir = false; }); air.push(await meas(12)); await P.ev(() => { VR.BodySky.noAir = true; }); noair.push(await meas(12)); }
  await P.ev(() => { VR.BodySky.noAir = false; });
  air.sort((a, b) => a - b); noair.sort((a, b) => a - b);
  rec.vl = { air, noair, ratio: +(air[2] / noair[2]).toFixed(3) }; save();
  check(rec.vl.ratio <= 1.03, `Very Low on Ocker: the frame with the air's three stops ${air[2]} ms against airless ${noair[2]} ms (×${rec.vl.ratio})`);
  const errs = P.logs.filter(l => l.startsWith('[pageerror]'));
  for (const l of P.logs.slice(0, 8)) console.log(l);
  check(errs.length === 0 && !P.logs.some(l => /shader|compile|link/i.test(l)), `page VL: no page error, every shader compiles (${errs.length})`);
  await P.ctx.close();
} else if (!process.env.NO_VL) check(false, `Very Low not measured: ${left().toFixed(0)} s left`);
await browser.close();
console.log(`(${secs()})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
