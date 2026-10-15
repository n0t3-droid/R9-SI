// t-polish (docs/superpowers/plans/2026-10-08-t-polish.md): the four polish items in one browser run, one world (seed 53,
// a new world: vgen 10), one page of this checkout's build:
//  1 the nebula's filaments — the sky at noon over the canyon, the city and the isles (trailer_skycurve.mjs's cameras,
//    the planets pinned, the shader's clock pinned at 80 s): the top band's fine structure (test/sky_ref.js hfOf) ≥ 60 %
//    of the day frames', and t-sky2's checks kept (every band within ΔE 12, the stars and the chroma); the sky pass on
//    High and on Very Low against v0.46's sky shader (2c103e8's SKY_FS compiled in the same page, rounds in turns);
//  2 the windmill — farm_c's mill on High, two pictures 1.5 s apart: its sails turn;
//  3 the hall from inside — Very Low at P1 (t-town's camera): the frame, the triangles, and where they go (the horizon,
//    the people) in rounds in turns (item 3 is written up, not built: for the record);
//  4 the cart — the Weißstadt's street at noon (P1) and Nova Haven's avenue (t-beauty's street_3): not forced, a cart
//    within 40 s of the arrival, the picture when it is in the frame.
// Pictures: test/shots/polish_sky_<place>.png, polish_mill_a/b.png, polish_cart.png, polish_cart_nova.png,
// polish_p1_potato.png; numbers in .tmp_tests/polish.json.
// usage: nohup bash test/wt_run.sh polish.mjs 3600 > .tmp_tests/polish.log 2>&1 &   ONLY=sky,mill,cart,p1,bench
// regress: skip  (a showcase with one world and the sky bench; the gates are test/polish_mill.js, life_director.js,
// sky_ref.js and trailer_skycurve.mjs)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import SR from '/home/dev/vr/test/sky_ref.js';
const { load, curveOf, bandRows, compare, NB, REF, starsOf, chromaOf, hfOf } = SR;

const ROOT = '/home/dev/vr', DIST = process.env.DIST || ROOT + '/dist/index.html', SEED = process.env.SEED || '53';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, on = (k) => !ONLY || ONLY.includes(k);
const ref = JSON.parse(fs.readFileSync(REF, 'utf8')), dayT = ref.targets.day;
// v0.46's sky shader (the base of the sky pass's A/B): its shaders.js evaluated with a bare VR
let BASE_SKY = null;
try { const src = execFileSync('git', ['-C', ROOT, 'show', '2c103e8:src/main/shaders.js'], { maxBuffer: 1 << 26 }).toString(); const ctx = { VR: {} }; vm.runInNewContext(src, ctx); BASE_SKY = { vs: ctx.VR.SHADERS.FS_VS, fs: ctx.VR.SHADERS.SKY_FS }; } catch (e) { console.log('no base sky shader: ' + String(e.message).split('\n')[0]); }

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctxB.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const out = { sky: [], bench: {}, mill: null, cart: [], p1: null };
const save = () => fs.writeFileSync(ROOT + '/.tmp_tests/polish.json', JSON.stringify(out, null, 1));
// the game loop by hand: dt per step, nothing drawn (the camera still set up, so the frustum is right)
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(2); } };
// the land round the eye built: every column within the view distance (less half a column) generated, meshed, uploaded,
// twice in a row; nothing pending (at most `ms`)
const settle = async (ms = 240000) => {
  const t0 = Date.now(); let calm = 0, s = null;
  for (let i = 0; Date.now() - t0 < ms; i++) {
    await step(10);
    s = await ev(() => { const g = VR.game, w = g.world, p = g.player.pos, pcx = Math.floor(p[0]) >> 4, pcz = Math.floor(p[2]) >> 4, rd = w.renderDist, r2 = (rd - 0.5) * (rd - 0.5); let dirty = 0, miss = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > r2) continue; const c = w.col(pcx + dx, pcz + dz); if (!c) { miss++; continue; } for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; } return { miss, dirty, up: w.uploadQ ? w.uploadQ.size : 0, busy: g.pool.busy, lod: g.horizon ? g.horizon.inflight || 0 : 0 }; });
    if (!s.miss && !s.dirty && !s.up) { if (++calm >= 2 && i > 3) break; } else calm = 0;
    await wait(60);
  }
  return Object.assign({ s: Math.round((Date.now() - t0) / 1000) }, s);
};
const shotPath = (name) => `${ROOT}/test/shots/${name}.png`;
// frames drawn, then the screenshot; probe: the sky painted magenta (the god rays off); clock: the shader's clock pinned
const draw = (probe, clock) => ev(([probe, clock]) => {
  const g = VR.game, R = g.renderer;
  if (!document.getElementById('__nohint')) { const st = document.createElement('style'); st.id = '__nohint'; st.textContent = '#hint,#hints{display:none !important}'; document.head.appendChild(st); }
  R.skyProbe = !!probe;
  const G = VR.Grade || {}; const rays = G.rays; if (probe) G.rays = 0;
  if (clock !== null && clock !== undefined) g.env.anim = clock;
  window.__norender = false;
  for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); }
  R.gl.finish(); window.__norender = true;
  R.skyProbe = false; if (probe) G.rays = rays;
}, [probe, clock]);
const shoot = async (name) => { for (let t = 1; ; t++) { try { await page.screenshot({ path: shotPath(name), timeout: 240000 }); break; } catch (e) { console.log(`  screenshot ${name} try ${t}: ${String(e.message).split('\n')[0]}`); if (t >= 2) break; await wait(3000); } } return fs.existsSync(shotPath(name)); };
const teleport = (x, y, z, yaw, pitch, fov, tod) => ev(([x, y, z, yaw, pitch, fov, tod]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = yaw; p.pitch = pitch; p.fovKick = 0; p.vel = [0, 0, 0]; if (fov) g.settings.fov = fov; if (tod !== null) g.env.setTime(tod); }, [x, y, z, yaw, pitch, fov, tod]);
const aimAt = (feet, at, eye = 1.62) => { const dx = at[0] - feet[0], dz = at[2] - feet[2]; return [Math.atan2(-dx, -dz), Math.atan2(at[1] - (feet[1] + eye), Math.hypot(dx, dz))]; };
const groundY = (x, z, y0) => ev(([x, z, y0]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = y0; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & F.OPAQUE) && !(R.T.flags[s] & F.LEAVES)) return y; } return 70; }, [x, z, y0]);

// ------------------------------------------------------------ the world
for (let attempt = 1; ; attempt++) { try { await page.goto('file://' + DIST, { waitUntil: 'domcontentloaded', timeout: 180000 }); break; } catch (e) { if (attempt >= 2) throw e; console.log('goto failed once, again'); } }
for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title').catch(() => false)) break; }
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Politur',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
for (let i = 0; i < 120; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'the world is loaded');
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.wx.force('klar'); g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } });
console.log('world', JSON.stringify(await ev(() => ({ vgen: VR.game.meta.vgen, seed: VR.game.meta.seed }))));

// ------------------------------------------------------------ 1 the sky at noon: the filaments
const PITCH = 12 * Math.PI / 180, W = 640, H = 360;
const azOf = (yaw) => Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
const matVec = (m, v) => [0, 1, 2, 3].map(i => m[i] * v[0] + m[4 + i] * v[1] + m[8 + i] * v[2] + m[12 + i] * v[3]);
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
const normv = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
// a picture and its sky probe measured as trailer_skycurve.mjs measures (the sun's 30° cone and the bodies left out)
async function measureSky(name, geo) {
  const img = await load(shotPath(name), W, H), pr = await load(ROOT + '/.tmp_tests/skyprobe_' + name + '.png', W, H);
  const sky = new Uint8Array(W * H), mask = new Uint8Array(W * H);
  const bodies = [[geo.sun, 30 * Math.PI / 180], [geo.giant, geo.rg * 2.6], [geo.blue, geo.rb * 1.6], ...geo.moons.map(m => [[m[0], m[1], m[2]], m[3] * 1.8])];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = (y * W + x) * 3, R = pr.d[p], G = pr.d[p + 1], B = pr.d[p + 2];
    if (!(R > 140 && B > 140 && G < 0.55 * Math.min(R, B))) continue;
    sky[y * W + x] = 1;
    const c = matVec(geo.inv, [(x + 0.5) / W * 2 - 1, 1 - (y + 0.5) / H * 2, 1, 1]);
    const dir = normv([c[0] / c[3], c[1] / c[3], c[2] / c[3]]);
    let ok = true; for (const [d, r] of bodies) if (ang(dir, d) < r) { ok = false; break; }
    if (ok) mask[y * W + x] = 1;
  }
  const f = (H / 2) / Math.tan(36 * Math.PI / 180), y0 = Math.round(H / 2 + f * Math.tan(PITCH)), lows = [];
  for (let x = 0; x < W; x++) { let low = -1; for (let y = 0; y < Math.min(H, y0 + 40); y++) if (sky[y * W + x]) low = y; if (low > 5) lows.push(low + 1); }
  lows.sort((a, b) => a - b);
  const Hl = lows.length > W * 0.2 ? lows[Math.floor(lows.length * 0.8)] : y0;
  const inMask = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] === 1;
  const curve = curveOf(img, Hl, inMask);
  const stars = [NB - 3, NB - 2, NB - 1].map(k => { const [a, b] = bandRows(Hl, k); return starsOf(img, a, b, inMask); });
  const chroma = chromaOf(img, 0, bandRows(Hl, NB - 3)[1], inMask);
  const hf = (() => { const [a, b] = bandRows(Hl, NB - 1); return hfOf(img, a, b, inMask); })();
  return { H: Hl, curve, stars, chroma, hf, dE: compare(curve, dayT) };
}
const geoOf = () => ev(() => { const g = VR.game, R = g.renderer, E = g.env.E, B = E.bodies; return { inv: Array.from(R.invVPNJ || R.invViewProj), sun: E.sunDir, giant: E.planetDir, blue: E.planet2Dir, rg: B ? B.radius.giant : 0.122, rb: B ? B.radius.blue : 0.085, moons: B ? B.moons : [] }; });
if (on('sky')) {
  const PLACES = [{ name: 'canyon', cam: [250, 150, 380], yaw: 1.36 }, { name: 'city', cam: [0, 100, -90], yaw: -0.35 }, { name: 'isles', cam: [565, 195, 190], yaw: 1.36 }];
  for (const P of PLACES) {
    try {
      await ev(([cam, yaw, pitch, pins]) => { const g = VR.game, p = g.player; g.env.setTime(6000); g.env.planetsOverride = pins; p.flying = true; p.noclip = true; p.teleport(cam[0], cam[1] - p.eye, cam[2]); p.yaw = yaw; p.pitch = pitch; p.fovKick = 0; p.vel = [0, 0, 0]; g.settings.fov = 72; }, [P.cam, P.yaw, PITCH, { az: azOf(P.yaw - 30 * Math.PI / 180), el: 24, az2: azOf(P.yaw + 30 * Math.PI / 180), el2: 36 }]);
      const st = await settle(180000);
      await ev(() => { const e = VR.game.entities; if (e && e.mobs) e.mobs.length = 0; });
      await step(6);
      const name = 'polish_sky_' + P.name;
      await draw(false, 80); await shoot(name);
      const geo = await geoOf();
      await draw(true, 80); await page.screenshot({ path: ROOT + '/.tmp_tests/skyprobe_' + name + '.png', timeout: 240000 });
      const m = await measureSky(name, geo);
      out.sky.push(Object.assign({ place: P.name, settle: st }, m)); save();
      console.log(`sky ${P.name} noon (settled ${st.s} s): fine ${m.hf} (frames ${dayT.hf})  stars ${m.stars.join(' ')}  chroma ${m.chroma ? m.chroma.mean + ' / ' + m.chroma.var : '—'}  ΔE ${m.dE.map(v => (v === null ? '—' : v.toFixed(0))).join(' ')}`);
      check(m.hf !== null && m.hf >= 0.6 * dayT.hf, `${P.name} noon: the top band's fine structure ${m.hf} ≥ 60 % of the frames' ${dayT.hf} (the nebula's filaments; v0.46 in t-sky2's run 3: canyon 112, city 57, isles 106)`);
      const bad = m.dE.filter((v, k) => v !== null && m.curve[k].n >= 100 && v > 12);
      check(!bad.length && m.stars[2] !== null && m.stars[2] >= 0.6 * dayT.stars[2] && m.chroma && m.chroma.mean >= 0.7 * dayT.chroma.mean && m.chroma.var >= 0.7 * dayT.chroma.var, `${P.name} noon: t-sky2's sky kept — every band within ΔE 12 (${m.dE.map(v => (v === null ? '—' : v.toFixed(0))).join(' ')}), the top band's stars ${m.stars[2]}, the chroma ${m.chroma ? m.chroma.mean : '—'} (variance ${m.chroma ? m.chroma.var : '—'})`);
    } catch (e) { check(false, `sky ${P.name}: ${String(e.message || e).slice(0, 200)}`); }
  }
}

// ------------------------------------------------------------ the sky pass: this build's against v0.46's, in turns
// the sky drawn alone N times into the scene target at the preset's size, the GPU waited for with a one-pixel read; the
// two programs in the same page and the same state, the order alternating round by round; the verdict the median of the
// rounds' ratios (one load spike moves one round, not it)
const SKYBENCH = ([N, cam, yaw, pitch, tod, base]) => {
  const g = VR.game, R = g.renderer, gl = R.gl;
  if (!window.__baseSky || window.__baseSky.lite !== !!R.q.lite) window.__baseSky = { lite: !!R.q.lite, p: VR.GL.program(base.vs, base.fs, 'sky_base', R.q.lite ? ['LITE'] : []) };
  g.env.setTime(tod); g.env.anim = 80;
  const E = g.env.update(0, { dim: 'overworld', biome: null, eyeSky: 1, renderDist: 4, horizon: 0, freezeTime: true, freezeWeather: true });
  R.setupCamera({ x: cam[0], y: cam[1], z: cam[2], yaw, pitch, fov: 72 * Math.PI / 180 });
  const sync = () => { gl.bindFramebuffer(gl.FRAMEBUFFER, null); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  const once = (p) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, R.sceneFB); gl.viewport(0, 0, R.w, R.h);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.useProgram(p.p); R.common(p, E);
    if (p.u.u_skyProbe) gl.uniform1f(p.u.u_skyProbe, 0);
    gl.uniformMatrix4fv(p.u.u_invViewProj, false, R.invViewProj);
    if (p.u.u_cirrus) gl.uniform1f(p.u.u_cirrus, R.q.clouds >= 2 ? 1 : 0);
    R.fs(p);
  };
  const time = (p) => { once(p); once(p); sync(); const t0 = performance.now(); for (let i = 0; i < N; i++) once(p); sync(); return (performance.now() - t0) / N; };
  const A = window.__baseSky.p, B = R.P.sky, flip = (window.__benchRound = (window.__benchRound || 0) + 1) % 2;
  let a, b; if (flip) { a = time(A); b = time(B); } else { b = time(B); a = time(A); }
  return { a, b, w: R.w, h: R.h, lite: !!R.q.lite };
};
const bench = async (label, rounds, args) => {
  const r = []; for (let i = 0; i < rounds; i++) r.push(await ev(SKYBENCH, args));
  const med = (v) => { const s = [...v].sort((x, y) => x - y); return s[s.length >> 1]; };
  const res = { size: r[0].w + 'x' + r[0].h, lite: r[0].lite, base: +med(r.map(x => x.a)).toFixed(2), now: +med(r.map(x => x.b)).toFixed(2), ratio: +med(r.map(x => x.b / x.a)).toFixed(3), ratios: r.map(x => +(x.b / x.a).toFixed(3)) };
  out.bench[label] = res; save();
  console.log(`sky pass ${label}: ${JSON.stringify(res)}`);
  return res;
};
if (on('bench') && BASE_SKY) {
  try {
    const hi = await bench('high_canyon_noon', 9, [12, [250, 150, 380], 1.36, PITCH, 6000, BASE_SKY]);
    check(hi.ratio <= 1.05, `High: the sky pass with the filaments ${hi.now} ms against v0.46's ${hi.base} ms (${hi.size}; the rounds' median ratio ${hi.ratio} ≤ 1.05)`);
    const up = await bench('high_canyon_noon_up', 7, [12, [250, 150, 380], 1.36, 0.9, 6000, BASE_SKY]);
    console.log(`  (looking up into the nebula: ${up.ratio})`);
  } catch (e) { check(false, 'the High sky bench: ' + String(e.message || e).slice(0, 200)); }
}

// ------------------------------------------------------------ 2 the windmill (farm_c): the sails turn
if (on('mill')) {
  try {
    await teleport(206.5, 92, -60, 0, 0, 70, 6000);
    let st = await settle(180000); await step(40);
    const mill = await ev(() => { const L = VR.game.entities.land; if (!L) return null; let best = null; for (const m of L.mills.values()) { const d = Math.hypot(m.x - 206, m.z + 43); if (!best || d < best.d) best = { d, x: m.x, y: m.y, z: m.z, f: m.f, state: m.state }; } return best; });
    console.log('mill', JSON.stringify(mill), 'settled', st.s, 's');
    if (mill) {
      const D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]][mill.f];
      const feet = [mill.x + 0.5 + D4[0] * 15 + D4[1] * 4, mill.y - 1, mill.z + 0.5 + D4[1] * 15 - D4[0] * 4], at = [mill.x + 0.5, mill.y + 0.5, mill.z + 0.5];
      const [yaw, pitch] = aimAt(feet, at);
      await teleport(feet[0], feet[1], feet[2], yaw, pitch, 70, 6000);
      st = await settle(120000); await step(10);
      const a0 = await ev(() => { const L = VR.game.entities.land; const m = [...L.mills.values()].sort((p, q) => Math.hypot(p.x - 206, p.z + 43) - Math.hypot(q.x - 206, q.z + 43))[0]; return { ang: m.ang, w: m.w, state: m.state }; });
      await draw(false, null); await shoot('polish_mill_a');
      await step(45);   // 1.5 s
      const a1 = await ev(() => { const L = VR.game.entities.land; const m = [...L.mills.values()].sort((p, q) => Math.hypot(p.x - 206, p.z + 43) - Math.hypot(q.x - 206, q.z + 43))[0]; return { ang: m.ang, w: m.w, state: m.state, wind: VR.game.env.E.wind }; });
      await draw(false, null); await shoot('polish_mill_b');
      let turned = a1.ang - a0.ang; if (turned < 0) turned += Math.PI * 2;
      // the pictures differ round the hub (the sails moved)
      const A = await load(shotPath('polish_mill_a'), W, H), B = await load(shotPath('polish_mill_b'), W, H);
      let diff = 0, n = 0; for (let y = 60; y < 300; y++) for (let x = 180; x < 460; x++) { const p = (y * W + x) * 3; n++; if (Math.abs(A.d[p] - B.d[p]) + Math.abs(A.d[p + 1] - B.d[p + 1]) + Math.abs(A.d[p + 2] - B.d[p + 2]) > 30) diff++; }
      out.mill = { mill, a0, a1, turned, diffShare: +(diff / n).toFixed(3) }; save();
      check(a0.state === 1 && turned > 0.6 && diff / n > 0.01, `farm_c's mill (${mill.x}, ${mill.y}, ${mill.z}, facing ${mill.f}): its sails turn — ${turned.toFixed(2)} rad in 1.5 s at wind ${a1.wind} (${a1.w.toFixed(2)} rad/s), ${(diff / n * 100).toFixed(1)} % of the pixels round the hub changed between polish_mill_a and _b`);
    } else check(false, 'farm_c\'s mill was not absorbed');
  } catch (e) { check(false, 'the windmill: ' + String(e.message || e).slice(0, 200)); }
}

// ------------------------------------------------------------ 4 the cart: not forced, within 40 s, in the frame
const HALL = { cx: -944, cz: -296, F: 73 };
if (on('cart')) {
  const SC = [
    { name: 'polish_cart', what: 'the Weißstadt\'s street', feet: [HALL.cx - 24.5, HALL.F + 1, HALL.cz - 0.5], at: [HALL.cx + 40, HALL.F + 9, HALL.cz - 0.5], fov: 66 },
    { name: 'polish_cart_nova', what: 'Nova Haven\'s avenue', feet: [1.5, null, -62.5], at: [1, 83, -100], fov: 70 },
  ];
  for (const sc of SC) {
    try {
      await teleport(sc.feet[0], 140, sc.feet[2], 0, 0, sc.fov, 6000); await settle(120000);
      const feet = sc.feet.slice(); if (feet[1] === null) feet[1] = (await groundY(feet[0], feet[2], 140)) + 1;
      const [yaw, pitch] = aimAt(feet, sc.at);
      await teleport(feet[0], feet[1], feet[2], yaw, pitch, sc.fov, 6000);
      const st = await settle(180000);
      // (the villages known here: the director's place needs them)
      for (let i = 0; i < 40 && !(await ev(() => { const g = VR.game, p = g.player.pos; return [...g.villages.known.values()].some(v => Math.hypot(v.plan.x - p[0], v.plan.z - p[2]) < 300); })); i++) await step(30);
      // the arrival: from here the director runs as in play (a frame every 33 ms of game time)
      await ev(() => { const L = VR.game.lifeDirector; if (L) L.events.length = 0; });
      let t = 0, ev0 = null, inView = null;
      for (; t < 45; t += 0.5) {
        await step(15);
        const s = await ev(() => { const g = VR.game, L = g.lifeDirector, R = g.renderer; const e = L && L.events.find(x => x.kind === 'cart'); if (!e || !e.pos) return { place: L && L.st.place, cart: false }; const c = R.viewProj, x = e.pos[0] - R.cam.x, y = e.pos[1] + 0.8 - R.cam.y, z = e.pos[2] - R.cam.z; const cx = c[0] * x + c[4] * y + c[8] * z + c[12], cy = c[1] * x + c[5] * y + c[9] * z + c[13], cw = c[3] * x + c[7] * y + c[11] * z + c[15]; return { place: L.st.place, cart: true, age: e.age, sx: cw > 0 ? cx / cw : 9, sy: cw > 0 ? cy / cw : 9, d: Math.hypot(x, z) }; });
        if (s.cart && !ev0) ev0 = { t, place: s.place };
        if (s.cart && Math.abs(s.sx) < 0.7 && Math.abs(s.sy) < 0.8) { inView = Object.assign({ t }, s); break; }
        if (ev0 && t - ev0.t > 14) break;
      }
      if (inView) { await draw(false, null); await shoot(sc.name); }
      out.cart.push({ name: sc.name, settle: st, started: ev0, inView }); save();
      check(!!ev0 && ev0.t <= 40 && !!inView && fs.existsSync(shotPath(sc.name)), `${sc.what} at noon (place ${ev0 ? ev0.place : '—'}): a cart ${ev0 ? 'started ' + ev0.t.toFixed(1) + ' s after the arrival' : 'never came'}${inView ? `, in the frame ${(inView.t - ev0.t).toFixed(1)} s later (${inView.d.toFixed(0)} m, at ${inView.sx.toFixed(2)}, ${inView.sy.toFixed(2)}): test/shots/${sc.name}.png` : ''}`);
    } catch (e) { check(false, `${sc.what}: ${String(e.message || e).slice(0, 200)}`); }
  }
}

// ------------------------------------------------------------ Very Low: the sky pass, and P1 (item 3, for the record)
await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
if (on('bench') && BASE_SKY) {
  try {
    const lo = await bench('potato_canyon_dusk', 11, [24, [250, 150, 380], 1.36, PITCH, 13000, BASE_SKY]);
    check(lo.ratio <= 1.05, `Very Low: the sky pass ${lo.now} ms against v0.46's ${lo.base} ms (${lo.size}, LITE ${lo.lite}; the rounds' median ratio ${lo.ratio} ≤ 1.05 — the same shader: the filaments are not in it)`);
  } catch (e) { check(false, 'the Very Low sky bench: ' + String(e.message || e).slice(0, 200)); }
}
if (on('p1')) {
  try {
    const feet = [HALL.cx - 24.5, HALL.F + 1, HALL.cz - 0.5], at = [HALL.cx + 40, HALL.F + 9, HALL.cz - 0.5], [yaw, pitch] = aimAt(feet, at);
    await teleport(feet[0], feet[1], feet[2], yaw, pitch, 66, 8000);
    const st = await settle(240000); await step(120);
    await draw(false, null); await shoot('polish_p1_potato');
    // rounds of N frames in turns: as it is · without the horizon · without the people (the villagers and the crowd)
    const N = 8, R = { all: [], noHorizon: [], noPeople: [] };
    let parts = null;
    for (let k = 0; k < 5; k++) for (const mode of ['all', 'noHorizon', 'noPeople']) {
      const r = await ev(([n, mode]) => new Promise((ok) => {
        const g = VR.game, gl = g.renderer.gl, H = g.horizon, V = g.villages, C = VR.Crowd;
        const hd = H && H.draw, vd = V && V.draw, cd = C && C.draw;
        if (mode === 'noHorizon' && H) H.draw = () => {};
        if (mode === 'noPeople') { if (V) V.draw = () => {}; if (C) C.draw = () => {}; }
        window.__norender = false; let i = -2, sum = 0, tris = 0, draws = 0, ht = 0;
        const f = () => { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); const dt = performance.now() - t0; if (i >= 0) { sum += dt; tris += g.renderer.stats.tris; draws += g.renderer.stats.draws; ht += H && H.stats ? H.stats.tris || 0 : 0; } if (++i < n) setTimeout(f, 0); else { window.__norender = true; if (H) H.draw = hd; if (V) V.draw = vd; if (C) C.draw = cd; ok({ ms: sum / n, tris: Math.round(tris / n), draws: Math.round(draws / n), horizonTris: Math.round(ht / n), people: V ? V.agents.filter(a => a.drawn).length : 0 }); } };
        f();
      }), [N, mode]);
      R[mode].push(r.ms); if (mode === 'all') parts = r;
    }
    const med = (v) => { const s = [...v].sort((a, b) => a - b); return +s[s.length >> 1].toFixed(2); };
    out.p1 = { settle: st, ms: med(R.all), noHorizon: med(R.noHorizon), noPeople: med(R.noPeople), rounds: R, last: parts }; save();
    console.log(`very low at P1: ${JSON.stringify(out.p1)}`);
    check(out.p1.ms > 0, `Very Low at P1 (for the record; item 3 written up, not built): ${out.p1.ms} ms a frame (${parts.tris} triangles, of them the horizon ${parts.horizonTris}; ${parts.draws} draws; ${parts.people} people drawn) — without the horizon ${out.p1.noHorizon} ms, without the people ${out.p1.noPeople} ms`);
  } catch (e) { check(false, 'Very Low at P1: ' + String(e.message || e).slice(0, 200)); }
}
const errs = logs.filter(l => /pageerror/.test(l));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
check(errs.length === 0, `no page error (${errs.length})`);
save();
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
