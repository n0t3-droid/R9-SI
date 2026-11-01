// x-robo · the people's motion in the game, before (VR.Robo.off) and after, in one page on Balanced (seed 424242's
// festival village, test/festival.mjs's):
//   stairs   a villager walks up a slab-and-block stair beside the plaza, seen from the side at its feet: before, the
//            feet float over the steps and the body pops; after, the feet stand on the treads — robo_stairs_<tag>.png
//   crowd    two groups of seven cross the plaza toward each other, seen from above, their 8 s trails drawn over the
//            picture (orange west → east, cyan east → west); the closest two came — robo_crowd_<tag>.png
//   stop     a skirted / robed villager walks and stops before the eye: 0.25 s after the stop, the hem and the torso —
//            robo_stop_<tag>.png
//   fest     the festival at dusk from test/festival.mjs's camera — robo_fest_<tag>.png
// and the people's CPU time a frame (VR.Villages update + the poses in view, the least of three rounds), Very Low and Balanced,
// Robo off / on. Checks: every picture, no page error, the crowd's closest approach with Robo ≥ 0.45 b, Very Low's
// people not costlier with Robo on (+0.1 ms slack, swiftshader on a shared machine).
// usage: nohup bash test/wt_run.sh robo.mjs 3600 > .tmp_tests/robo.log 2>&1 &
// regress: skip  (a showcase; the gates are test/robo.js and test/robo_cost.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'test', 'shots');
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null, want = (k) => !ONLY || ONLY.has(k);   // ONLY=stairs,crowd,stop,fest
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const page = await ctx.newPage();
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 500)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto('file://' + path.join(ROOT, 'dist', 'index.html'));
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
// game steps without drawing (the people's poses are drawn ones: `live` draws)
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const live = (n, dtms = 33) => ev(([n, d]) => { window.__norender = false; const g = VR.game; for (let i = 0; i < n; i++) { g.last = performance.now() - d; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, [n, dtms]);
// a picture straight from the game's canvas, in the same task as its frame (page.screenshot waits for a compositor
// frame, which a machine of three browsers may not give within minutes); trails: [[[x, y, z], …], …] drawn over it
const shot = async (name, clip, trails) => {
  const url = await ev(([clip, trails]) => {
    window.__norender = false; const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); window.__norender = true;
    const r = g.renderer, cv = r.canvas, sx = cv.width / cv.clientWidth, sy = cv.height / cv.clientHeight;
    const C = clip || { x: 0, y: 0, width: cv.clientWidth, height: cv.clientHeight };
    const o = document.createElement('canvas'); o.width = C.width; o.height = C.height;
    const x = o.getContext('2d'); x.drawImage(cv, C.x * sx, C.y * sy, C.width * sx, C.height * sy, 0, 0, C.width, C.height);
    if (trails) {
      const vp = r.viewProj, c = g.cam, W = cv.clientWidth, H = cv.clientHeight;
      const pr = (p) => { const X = p[0] - c.x, Y = p[1] - c.y, Z = p[2] - c.z, w = vp[3] * X + vp[7] * Y + vp[11] * Z + vp[15]; return [((vp[0] * X + vp[4] * Y + vp[8] * Z + vp[12]) / w * 0.5 + 0.5) * W - C.x, (1 - ((vp[1] * X + vp[5] * Y + vp[9] * Z + vp[13]) / w * 0.5 + 0.5)) * H - C.y]; };
      x.lineWidth = 2.5;
      trails.forEach((T, i) => { x.strokeStyle = i < 7 ? 'rgba(255,154,46,0.9)' : 'rgba(56,214,255,0.9)'; x.beginPath(); T.forEach((p, k) => { const q = pr(p); if (k) x.lineTo(q[0], q[1]); else x.moveTo(q[0], q[1]); }); x.stroke(); });
    }
    return o.toDataURL('image/png');
  }, [clip || null, trails || null]);
  fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  console.log('  shot ' + name);
};
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.renderDist = 6; g.settings.dynRes = false; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Robo',mode:'creative',difficulty:'peaceful',type:'default',seed:'424242',cheats:true,kit:false})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.env.setTime(8000); g.zenFreezeTime = true; window.requestAnimationFrame = () => 0; g.hideHud = true; g.env.rain = 0; g.env.rainTarget = 0; });
for (let i = 0; i < 90; i++) {
  await step(10); await wait(120);
  const st = await ev((i) => { const g = VR.game, V = g.villages; if (!V) return 'none'; if ([...V.known.values()].some(v => v.active)) return 'ok';
    // (no village woke near the spawn yet: go to the nearest known site)
    if (i === 30 && V.sites && V.sites.length) { const p = g.player.pos; const X = (s) => s.plaza ? s.plaza.x : s.x, Z = (s) => s.plaza ? s.plaza.z : s.z; const s = V.sites.slice().sort((a, b) => Math.hypot(X(a) - p[0], Z(a) - p[2]) - Math.hypot(X(b) - p[0], Z(b) - p[2]))[0]; g.player.teleport(X(s) + 0.5, 140, Z(s) + 0.5); g.player.flying = true; return 'moved ' + X(s) + ',' + Z(s); }
    return 'wait'; }, i);
  if (st === 'ok') break; if (st.startsWith('moved')) console.log('  ' + st);
}
// the puppets: a person with __robo walks to its target by the game's own steering (move(): ORCA, physics), nothing else
const info = await ev(() => {
  const g = VR.game, V = g.villages, vil = [...V.known.values()].find(v => v.active); if (!vil) return null;
  for (const k of ['think', 'runAct', 'social']) { const f = V[k]; V[k] = function (a) { if (a.__robo) { if (k === 'runAct') { a.steer = a.__robo.t; a.pose = 'stand'; a.lookAt = null; } return; } return f.apply(this, arguments); }; }
  const pz = vil.plan.plaza; window.__vil = vil;
  return { name: vil.name, plaza: [pz.x, pz.y, pz.z, pz.r], n: vil.agents.length };
});
console.log('village ' + JSON.stringify(info));
check(!!info && info.n >= 14, 'a village with people enough');
if (!info) { await browser.close(); console.log('FAILED ' + fails); process.exit(1); }
const [PX, PY, PZ, PR] = info.plaza;
const setRobo = (off) => ev((off) => { VR.Robo.off = off; for (const a of VR.game.villages.agents) { a.rb = null; a.rbG = null; } }, off);
const cam = (x, y, z, yaw, pitch) => ev(([x, y, z, yaw, pitch]) => { const p = VR.game.player; p.teleport(x, y, z); p.flying = true; p.vel = [0, 0, 0]; p.yaw = yaw; p.pitch = pitch; }, [x, y, z, yaw, pitch]);

// ---------------------------------------------------------------- stairs
const S0 = [PX + PR + 3, PY, PZ - 1];   // the stair's foot (x rising by half a block a step), 3 wide in z
// (the eye goes there first: a column out of reach is not loaded, and a block set into it is lost)
await cam(S0[0] + 1.7, S0[1] + 2, S0[2] + 3.2, 0, -0.2);
for (let i = 0; i < 40; i++) { await step(10); await wait(150); if (await ev(([x, z]) => VR.game.world.isLoaded(x - 6, z) && VR.game.world.isLoaded(x + 12, z), S0)) break; }
const placed = await ev(([x0, y, z0]) => {
  const g = VR.game, w = g.world, B = VR.R.byName, slab = B.oak_slab.defaultState, pl = B.oak_planks.defaultState;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -4; dx <= 9; dx++) { w.setBlock(x0 + dx, y - 1, z0 + dz, B.stone.defaultState, 4); for (let yy = y; yy <= y + 4; yy++) w.setBlock(x0 + dx, yy, z0 + dz, 0, 4); }   // a clear lane on a stone floor
    w.setBlock(x0, y, z0 + dz, slab, 4);
    w.setBlock(x0 + 1, y, z0 + dz, pl, 4);
    w.setBlock(x0 + 2, y, z0 + dz, pl, 4); w.setBlock(x0 + 2, y + 1, z0 + dz, slab, 4);
    for (let dx = 3; dx <= 9; dx++) { w.setBlock(x0 + dx, y, z0 + dz, pl, 4); w.setBlock(x0 + dx, y + 1, z0 + dz, pl, 4); }
  }
  return w.getBlock(x0, y, z0) === slab && w.getBlock(x0 + 2, y + 1, z0) === slab;
}, S0);
check(placed, 'stairs: the stair is built');
await step(20);
const stairRun = async (tag) => {
  await setRobo(tag === 'before');
  const ok = await ev(([x0, y, z0]) => {
    const V = VR.game.villages, vil = window.__vil;
    const a = window.__stairA || (window.__stairA = vil.agents.find(a => !a.kid && a.pose !== 'sleep' && a.p.look && a.p.look.role !== 'hero' && !a.p.look.species && a !== window.__stopA));
    if (!a) return false;
    a.__robo = { t: [x0 + 7.5, z0 + 0.5] }; a.pos = [x0 - 3.5, y, z0 + 0.5]; a.vel = [0, 0, 0]; a.path = null; a.yaw = -Math.PI / 2; a.walk = 0; a.walkAmt = 0;
    return true;
  }, S0);
  if (!ok) return false;
  await cam(S0[0] + 1.7, S0[1] - 0.2, S0[2] + 3.2, 0, -0.2);
  // walk on until the person's middle is over the second step
  await live(1); await wait(4000); await live(1);   // (the person's smooth body asked for and made by the worker)
  await ev(([x0, y, z0]) => { const a = window.__stairA; a.pos = [x0 - 3.5, y, z0 + 0.5]; a.vel = [0, 0, 0]; }, S0);
  // (the game steps undrawn; the last 0.4 s drawn, so the drawn root's spring and the feet are those of a walk)
  for (let i = 0; i < 240; i++) { await step(1); const x = await ev(() => window.__stairA.pos[0]); if (x >= S0[0] + 1.75 - 0.5) break; }
  for (let i = 0; i < 12; i++) { await live(1); const x = await ev(() => window.__stairA.pos[0]); if (x >= S0[0] + 1.75) break; }
  await shot('robo_stairs_' + tag, { x: 340, y: 110, width: 600, height: 560 });
  await ev(() => { window.__stairA.__robo = null; });
  return true;
};
if (want('stairs')) { check(await stairRun('before'), 'stairs: before'); check(await stairRun('after'), 'stairs: after'); }

// ---------------------------------------------------------------- crowd
const crowdRun = async (tag) => {
  await setRobo(tag === 'before');
  await cam(PX + 2.5, PY + 13, PZ + 0.5 + 5, 0, -1.25);
  await ev(([px, y, pz]) => {
    const vil = window.__vil, A = vil.agents.filter(a => a.pose !== 'sleep' && a.pose !== 'sit' && !a.inBoat && a !== window.__stairA).slice(0, 14);
    window.__crowd = A; window.__trail = A.map(() => []);
    A.forEach((a, i) => { const s = i < 7 ? -1 : 1, k = i % 7; a.__robo = { t: [px + 0.5 - s * 7, pz + 0.5 + (k - 3) * 0.9 + (s > 0 ? 0.3 : 0)] }; a.pos = [px + 0.5 + s * 7, y, pz + 0.5 + (k - 3) * 0.9]; a.vel = [0, 0, 0]; a.path = null; a.yaw = s > 0 ? Math.PI / 2 : -Math.PI / 2; });
  }, [PX, PY, PZ]);
  let closest = 1e9;
  for (let f = 0; f < 300; f++) {
    await step(1);
    const c = await ev(() => { const A = window.__crowd; let m = 1e9; A.forEach((a, i) => { window.__trail[i].push([a.pos[0], a.pos[1] + 0.05, a.pos[2]]); for (let j = i + 1; j < A.length; j++) m = Math.min(m, Math.hypot(a.pos[0] - A[j].pos[0], a.pos[2] - A[j].pos[2])); }); return m; });
    closest = Math.min(closest, c);
    if (f === 140) { await live(6); await shot('robo_crowdmid_' + tag); }
  }
  await live(2);
  const trails = await ev(() => window.__trail.map(T => T.filter((_, k) => k % 3 === 0)));
  await shot('robo_crowd_' + tag, null, trails);
  await ev(() => { for (const a of window.__crowd) a.__robo = null; });
  console.log(`  crowd ${tag}: the closest two came ${closest.toFixed(2)} b`);
  return closest;
};
if (want('crowd')) { const cB = await crowdRun('before'), cA = await crowdRun('after');
check(cA >= 0.45, `crowd: with Robo nobody comes closer than 0.45 b (${cA.toFixed(2)}; before ${cB.toFixed(2)})`);

// ---------------------------------------------------------------- stop
const stopRun = async (tag) => {
  await setRobo(tag === 'before');
  const ok = await ev(([px, y, pz]) => {
    const vil = window.__vil;
    const a = window.__stopA || (window.__stopA = vil.agents.find(a => !a.kid && a.gait && a.gait.skirt && a.pose !== 'sleep') || vil.agents.find(a => !a.kid && a.gait && a.gait.carry) || vil.agents.find(a => !a.kid && a.gait));
    if (!a) return false;
    a.__robo = { t: [px + 0.5, pz + 0.5] }; a.pos = [px + 0.5 + 6, y, pz + 0.5]; a.vel = [0, 0, 0]; a.path = null; a.yaw = Math.PI / 2;
    return { skirt: a.gait.skirt, carry: a.gait.carry };
  }, [PX, PY, PZ]);
  if (!ok) return false;
  console.log(`  stop ${tag}: ${JSON.stringify(ok)}`);
  await cam(PX + 0.5 + 0.5, PY + 1.0, PZ + 0.5 + 3.2, 0.15, -0.05);
  // walk until standing, then 0.25 s
  let stoppedAt = -1;
  for (let i = 0; i < 240; i++) { await step(1); const d = await ev(() => Math.hypot(window.__stopA.pos[0] - window.__stopA.__robo.t[0], window.__stopA.pos[2] - window.__stopA.__robo.t[1])); if (d < 1.3) break; }
  for (let i = 0; i < 40; i++) { await live(1); const v = await ev(() => Math.hypot(window.__stopA.vel[0], window.__stopA.vel[2])); if (v < 0.35) { stoppedAt = i; break; } }
  await live(7);
  await shot('robo_stop_' + tag, { x: 290, y: 60, width: 700, height: 640 });
  await ev(() => { window.__stopA.__robo = null; });
  return stoppedAt > 0;
};
}
if (want('stop')) { check(await stopRun('before'), 'stop: before'); check(await stopRun('after'), 'stop: after'); }
if (want('fest')) {

// ---------------------------------------------------------------- the festival at dusk, and the costs
await ev(() => VR.game.env.setTime(11250));
await step(200);
const festCam = () => cam(PX + 0.5 + PR + 7, PY + 4, PZ + 0.5 + 3, Math.atan2(-(-(PR + 7)), -(-3)), -0.28);
await ev(() => VR.game.env.setTime(12650));
for (const tag of ['before', 'after']) { await setRobo(tag === 'before'); await festCam(); await step(60); await live(8); await shot('robo_fest_' + tag); }
// the people's CPU time a frame in the page: the villages' update and a pose for each person in view, no GPU (the
// draw's GL calls are the same with Robo on or off) — the least of five rounds of 60 frames, off and on interleaved (in both orders)
const cost = (preset, off) => ev(([preset, off]) => {
  const g = VR.game, V = g.villages; VR.Robo.off = off;
  const S = g.settings; S.preset = preset; S.anim = preset !== 'potato';
  const A = V.agents.filter(a => (a.pos[0] - g.player.pos[0]) ** 2 + (a.pos[2] - g.player.pos[2]) ** 2 < 24 * 24);
  for (const a of A) a.d2v = (a.pos[0] - g.player.pos[0]) ** 2 + (a.pos[2] - g.player.pos[2]) ** 2;
  const t0 = performance.now();
  for (let i = 0; i < 60; i++) { g.time += 1 / 30; V.update(1 / 30); for (const a of A) V.pose(a, g.time); }
  return (performance.now() - t0) / 60;
}, [preset, off]);
const C = {};
await festCam();
for (const pre of ['potato', 'balanced']) {
  for (const off of [true, false]) C[pre + (off ? '_off' : '_on')] = 1e9;
  for (let r = 0; r < 5; r++) for (const off of (r & 1 ? [false, true] : [true, false])) { const v = await cost(pre, off); const k = pre + (off ? '_off' : '_on'); C[k] = Math.min(C[k], v); }
}
console.log('costs (ms a frame, the villages\' update + poses): ' + JSON.stringify(Object.fromEntries(Object.entries(C).map(([k, v]) => [k, +v.toFixed(3)]))));
check(C.potato_on <= C.potato_off + 0.1, `Very Low: the people's frame with Robo ${C.potato_on.toFixed(3)} ms ≤ without ${C.potato_off.toFixed(3)} + 0.1`);
}
const errs = logs.filter(l => /pageerror|TypeError|ReferenceError/.test(l));
check(!errs.length, `no page error (${errs.length})`);
for (const l of logs.slice(0, 12)) console.log(l);
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
