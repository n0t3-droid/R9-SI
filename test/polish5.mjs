// f-polish5 in the browser (docs/superpowers/plans/2026-11-01-f-polish5.md): the newest wonders on screen, before / after.
// A new default world (seed 4242, Kreativ, Friedlich), 960 × 540, de-DE, Balanced, your name „Mila".
//   A · Märchenorte: the Schwebegarten at sunrise, the ride up the cloud bridge, the stone circle's dance at night, a lost
//       lantern at night by the Schlummerbaum
//   B · Wanderregisseur: a moment seen from afar by day and at dusk, the Wegballon
//   C · Einzug: a cottage 130–210 m from a village — the family's arrival (wide, and the framing camera if there), three
//       homes, the festival night (dusk, night)
//   D · the frame's cost there (Very Low / High) → .tmp_tests/polish5_<TAG>.json
//   TAG=before DIST=file://…/dist_before/index.html  (the pictures p5_<name>_<TAG>.png)
//   nohup bash test/wt_run.sh polish5.mjs 3600 > .tmp_tests/polish5.log 2>&1 &
// regress: skip  (a showcase with pictures; the gates are test/polish5.js and the fronts' own node tests)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '').replace(/\/\.tmp_tests$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html';
const SHOTS = ROOT + '/test/shots/';
const SEED = process.env.SEED || '4242', TAG = process.env.TAG || 'after', AFTER = TAG !== 'before';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, want = (s) => !ONLY || ONLY.includes(s);
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + ' (' + secs() + ')'); };
const run = { seed: SEED, tag: TAG, pics: {}, cost: {} };
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/polish5_' + TAG + '.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 300)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
await page.goto(DIST);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const settle = async (max = 40) => {
  for (let i = 0; i < max; i++) {
    await step(20, 16);
    const s = await ev(() => { const g = VR.game, w = g.world; return { busy: g.pool.busy, pend: w.pending.size, up: w.uploadQ ? w.uploadQ.size : 0 }; });
    if (s.busy === 0 && s.pend === 0 && s.up === 0 && i > 2) break;
    await wait(30);
  }
};
const grab = async (key, frames = 4) => {
  const name = 'p5_' + key + '_' + TAG + '.png';
  const url = await ev((frames) => { try { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; } catch (e) { window.__norender = true; return null; } }, frames);
  if (url && url.length > 2000) { fs.writeFileSync(SHOTS + name, Buffer.from(url.split(',')[1], 'base64')); console.log('  📷 ' + name); run.pics[key] = SHOTS + name; save(); return SHOTS + name; }
  console.log('  !! no picture ' + name); return null;
};
const stand = (P, look) => ev(([P, L]) => { const p = VR.game.player; p.flying = true; p.teleport(P[0], P[1], P[2]); p.vel = [0, 0, 0]; const e = [P[0], P[1] + 1.62, P[2]], dx = L[0] - e[0], dy = L[1] - e[1], dz = L[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw; }, [P, look]);
const lookAt = (P) => ev((P) => { const p = VR.game.player, e = p.eyePos(), dx = P[0] - e[0], dy = P[1] - e[1], dz = P[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw; }, P);
const top = (x, z) => ev(([x, z]) => VR.game.world.topAt(Math.floor(x), Math.floor(z)), [x, z]);
// the frame's cost here (the median of 14 frames, the lowest of three tries) at Very Low and High
async function costHere(key) {
  const out = {}, rd = await ev(() => VR.game.settings.renderDist);
  for (const preset of ['potato', 'high']) {
    await ev((pr) => { const g = VR.game; g.applyPreset(pr); g.settings.dynRes = false; g.settings.renderDist = 6; g.applySettings('*'); }, preset);
    await settle(10);
    const tries = [];
    for (let k = 0; k < 3; k++) tries.push(await ev(() => { const g = VR.game; window.__norender = false; for (let i = 0; i < 4; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); const ms = []; for (let i = 0; i < 14; i++) { const t = performance.now(); g.last = t - 33; g.loop(t); g.renderer.gl.finish(); ms.push(performance.now() - t); } window.__norender = true; ms.sort((a, b) => a - b); return +ms[7].toFixed(1); }));
    out[preset] = Math.min(...tries);
  }
  await ev((rd) => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = rd; g.applySettings('*'); }, rd);
  await settle(8);
  run.cost[key] = out; save();
  console.log('  cost ' + key + ' ' + JSON.stringify(out));
  return out;
}

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.playerName = 'Mila'; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Politur',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:false})`);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world (' + TAG + ')');
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(6000); });
await settle(30); await step(30, 33);
const spawn = await ev(() => VR.game.player.pos.slice());

// ================================================================ A · the fairy places
async function goTo(kind) {
  for (let i = 0; i < 40; i++) {
    const s = (await ev(() => VR.Fairy.debug.sites())).find(x => x.kind === kind); if (!s) return null;
    if (s.y !== null && await ev(() => VR.Fairy.debug.near()) === s.id) return s;
    await ev((s) => { const p = VR.game.player; p.flying = true; p.teleport(s.x + 0.5, 150, s.z + 0.5); }, s);
    await settle(6); await step(20, 33);
  }
  return (await ev(() => VR.Fairy.debug.sites())).find(x => x.kind === kind);
}
const view = async (s, d, up, lookY, side) => {
  const a = s.yaw + (side || 0), e = [s.x + Math.cos(a) * d, 0, s.z + Math.sin(a) * d];
  e[1] = (await top(e[0], e[2])) + 1 + up;
  await ev((e) => { const p = VR.game.player; p.flying = true; p.teleport(e[0], e[1], e[2]); }, e);
  await settle(10); await lookAt([s.x, lookY, s.z]); await step(30, 33);
};
if (want('fairy')) {
  try {
    await ev(() => { const g = VR.game; g.settings.renderDist = 8; g.applySettings('*'); });   // (a place settles once its ring's land is loaded)
    let s = await goTo('garden');
    check(s && s.y !== null, 'garden settled at ' + (s && [s.x, s.y, s.z, s.yaw].join(', ')));
    run.garden = s;
    await ev(() => VR.game.env.setTime(23700));
    await view(s, 38, 5, s.top - 4, 0); await step(60, 33);
    await grab('garden', 4);
    // the ride: the bridge awake, step on its foot
    await ev(() => VR.Fairy.debug.wake()); await step(40, 33);
    await ev((P) => { const p = VR.game.player; p.flying = false; p.teleport(P[0], P[1] + 0.05, P[2]); }, s.foot);
    let shot = false;
    for (let k = 0; k < 40 && !shot; k++) { await step(10, 33); const u = await ev(() => VR.Fairy.debug.ride()); if (u > 0.45) { shot = true; await lookAt([s.x, s.top + 1, s.z]); await grab('ride', 4); } }
    check(shot, 'the ride up the cloud bridge is pictured');
    await step(220, 33);
    // the circle's dance on a clear night
    s = await goTo('circle');
    await ev(() => VR.game.env.setTime(18000));
    await view(s, 15, 3, s.y + 1.5, 0.2); await step(60, 33);
    await grab('circle', 4);
    await view(s, 7, 1, s.y + 1.4, 1.2); await step(40, 33);
    await grab('dance', 4);
    if (want('cost')) await costHere('circle_night');
    // a lost lantern at night by the Slumber Tree
    s = await goTo('tree');
    await ev(() => VR.game.env.setTime(17000));
    const ok = await ev(() => VR.Fairy.debug.talk('tuepfel'));
    await step(20, 33);
    const L = (await ev(() => VR.Fairy.debug.sites())).find(x => x.kind === 'tree').lanterns;
    check(ok && L && L.length === 3, 'the lantern adventure is under way: ' + JSON.stringify(L));
    if (L && L[0]) {
      const p = L[0], dx = p[0] - s.x, dz = p[2] - s.z, dl = Math.hypot(dx, dz) || 1, e = [p[0] - dx / dl * 11 + dz / dl * 3, 0, p[2] - dz / dl * 11 - dx / dl * 3];
      e[1] = (await top(e[0], e[2])) + 2.2;
      await stand(e, [p[0], p[1] + 0.4, p[2]]); await settle(8); await step(30, 33);
      await grab('lantern', 4);
    }
  } catch (e) { check(false, 'fairy: ' + e.message.slice(0, 200)); }
  await ev(() => { const g = VR.game; g.settings.renderDist = 6; g.applySettings('*'); });
}

// ================================================================ B · the wander moments from afar, the Wegballon
const openSpot = () => ev(([sp]) => {
  const g = VR.game, w = g.world, V = g.villages, R = VR.R;
  for (let r = 160; r <= 420; r += 40) for (let k = 0; k < 16; k++) {
    const an = k / 16 * Math.PI * 2, x = Math.round(sp[0] + Math.cos(an) * r), z = Math.round(sp[2] + Math.sin(an) * r);
    const ns = V && V.nearestSite ? V.nearestSite(x, z) : null; if (ns && ns.dist < 120) continue;
    const fs = VR.Fairy && VR.Fairy.debug ? VR.Fairy.debug.sites() : []; if (fs.some(s => Math.hypot(s.x - x, s.z - z) < 90)) continue;
    return [x, z];
  }
  return [sp[0] + 300, sp[2]];
}, [spawn]);
if (want('wander')) {
  try {
    const o = await openSpot();
    await ev((o) => { const p = VR.game.player; p.flying = true; p.teleport(o[0] + 0.5, 150, o[1] + 0.5); }, o);
    await settle(40); await step(20, 33);
    const y0 = await top(o[0], o[1]);
    await ev(([o, y]) => { const p = VR.game.player; p.flying = false; p.teleport(o[0] + 0.5, y + 1.05, o[1] + 0.5); p.pitch = -0.05; }, [o, y0]);
    await ev(() => { const g = VR.game; g.env.setTime(5200); const D = g.wanderer; if (D) { D.auto = false; D.endAll(); } });
    await step(60, 33);
    const shotMoment = async (kinds, key) => {
      const m = await ev((kinds) => { const g = VR.game, D = g.wanderer; if (!D) return null; D.endAll(); D.ctx = D.context(); let k = 910000; for (const kind of kinds) { const m = D.start(kind, k++, true); if (m) return { kind, pos: m.pos.slice(), d: Math.round(D.dist(m.pos)) }; } return null; }, kinds);
      if (!m) { check(false, key + ': no moment found a stage'); return null; }
      await step(20, 33);
      await grab(key, 4);
      return m;
    };
    run.m1 = await shotMoment(['traveller', 'shrine', 'cairn', 'well'], 'moment_day');
    if (run.m1) check(run.m1.d >= 14, 'a moment by day: ' + JSON.stringify(run.m1));
    await ev(() => VR.game.env.setTime(12900)); await step(20, 33);
    run.m2 = await shotMoment(['lanterns', 'shrine', 'well', 'cairn'], 'moment_dusk');
    // the Wegballon: by day, ahead toward the next place
    await ev(() => { const g = VR.game; g.wanderer.endAll(); g.env.setTime(6500); });
    let bc = null;
    for (let i = 0; i < 8 && !bc; i++) {
      await ev(() => { const p = VR.game.player; p.vel[0] = -Math.sin(p.yaw) * 1.5; p.vel[2] = -Math.cos(p.yaw) * 1.5; });
      await step(20, 33);
      bc = await ev(() => { const D = VR.game.wanderer; return D && D.bcOn ? D.bcPos.slice() : null; });
    }
    check(!!bc, 'the Wegballon is up: ' + JSON.stringify(bc));
    if (bc) { await lookAt([bc[0], bc[1] - 6, bc[2]]); await step(4, 33); await grab('balloon', 4); }
  } catch (e) { check(false, 'wander: ' + e.message.slice(0, 200)); }
}

// ================================================================ C · a family moves in; the settlement's festival
const dbg = () => ev(() => VR.MoveIn.debug(VR.game));
const build = (spec) => ev((spec) => {
  const g = VR.game, w = g.world, R = VR.R;
  const st = (n, p) => { const t = R.byName[n]; return t ? (p ? t.state(p) : t.defaultState) : 0; };
  const set = (x, y, z, s) => w.setBlock(x, y, z, s, 0);
  let best = null;
  for (let rr = 0; rr <= 24 && !best; rr += 3) for (let a = 0; a < 12 && !best; a++) {
    const an = a / 12 * Math.PI * 2, cx = Math.round(spec.c[0] + Math.cos(an) * rr), cz = Math.round(spec.c[1] + Math.sin(an) * rr);
    if (!w.isLoaded(cx - 6, cz - 6) || !w.isLoaded(cx + 6, cz + 6)) continue;
    let mn = 999, mx = -1, wet = 0; for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) { const h = w.topAt(cx + dx, cz + dz); mn = Math.min(mn, h); mx = Math.max(mx, h); const b = w.getBlock(cx + dx, h, cz + dz); if (b && (R.T.flags[b] & VR.F.FLUID)) wet++; }
    if (mx - mn <= 3 && !wet) best = [cx, mn + 1, cz];
  }
  if (!best) return { err: 'no flat ground' };
  const [cx, gy, cz] = best, y0 = gy;
  for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 7; dz++) { for (let y = y0; y < y0 + 16; y++) set(cx + dx, y, cz + dz, 0); for (let y = y0 - 4; y < y0; y++) if (!w.getBlock(cx + dx, y, cz + dz) || y === y0 - 1) set(cx + dx, y, cz + dz, st(y === y0 - 1 && (Math.abs(dx) > 3 || Math.abs(dz) > 3) ? 'grass_block' : 'dirt')); }
  const wall = spec.wall || 'oak_planks', roof = spec.roof || 'spruce_planks';
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) { set(cx + dx, y0 - 1, cz + dz, st('stone_bricks')); set(cx + dx, y0 + 4, cz + dz, st(roof)); }
  for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) if (Math.max(Math.abs(dx), Math.abs(dz)) === 4) set(cx + dx, y0 + 4, cz + dz, st(roof));
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) set(cx + dx, y0 + 5, cz + dz, st(roof));
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) { if (Math.abs(dx) !== 3 && Math.abs(dz) !== 3) continue; for (let y = y0; y <= y0 + 3; y++) set(cx + dx, y, cz + dz, st(Math.abs(dx) === 3 && Math.abs(dz) === 3 ? 'oak_log' : wall)); }
  for (const dx of [-3, 3]) for (const dz of [-1, 1]) set(cx + dx, y0 + 1, cz + dz, st('glass'));
  const dt = R.byName.oak_door;
  set(cx, y0, cz + 3, dt.state({ facing: 2, half: 0, open: 0, hinge: 0 })); set(cx, y0 + 1, cz + 3, dt.state({ facing: 2, half: 1, open: 0, hinge: 0 }));
  const bt = R.byName[spec.bed || 'red_bed'];
  set(cx - 2, y0, cz - 1, bt.state({ facing: 0, part: 0 })); set(cx - 2, y0, cz - 2, bt.state({ facing: 0, part: 1 }));
  if (spec.bed2) { set(cx - 1, y0, cz - 1, bt.state({ facing: 0, part: 0 })); set(cx - 1, y0, cz - 2, bt.state({ facing: 0, part: 1 })); }
  set(cx + 2, y0, cz - 2, st('vx_chair'));
  set(cx + 2, y0, cz + 2, st('lantern'));
  return { c: [cx, y0, cz], door: [cx, y0, cz + 3], bed: [cx - 2, y0, cz - 1] };
}, spec);
if (want('movein')) {
  try {
    await ev(() => { const g = VR.game; g.env.setTime(3000); if (g.wanderer) g.wanderer.auto = false; });
    const far = await ev(([sp]) => {
      const g = VR.game, V = g.villages;
      for (let r = 200; r <= 640; r += 40) for (let k = 0; k < 16; k++) {
        const an = k / 16 * Math.PI * 2, x = Math.round(sp[0] + Math.cos(an) * r), z = Math.round(sp[2] + Math.sin(an) * r);
        const ns = V.nearestSite(x, z); if (ns && ns.dist > 130 && ns.dist < 210) return [x, z, Math.round(ns.dist)];
      }
      return null;
    }, [spawn]);
    check(!!far, 'a spot 130–210 m from a village: ' + JSON.stringify(far));
    await ev((f) => { const p = VR.game.player; p.flying = true; p.teleport(f[0] + 0.5, 140, f[1] + 0.5); }, far);
    await settle(60); await step(40, 33); await settle(20);
    const H1 = await build({ c: [far[0], far[1]], bed2: true });
    check(H1 && !H1.err, 'the first cottage: ' + JSON.stringify(H1));
    await step(80, 33);
    await ev((b) => { const g = VR.game; g.env.setTime(15000); if (g.sleep) g.sleep(b[0], b[1], b[2]); else { g.env.setTime(0); g.env.day = (g.env.day || 0) + 1; } }, H1.bed);
    await wait(3500);
    await ev(() => { const g = VR.game; if (g.ui && g.ui.show) g.ui.show(null); });
    const door = H1.door;
    // the player waits by the door, looking out
    await stand([door[0] + 2.5, door[1], door[2] + 3.5], [door[0] + 0.5, door[1] + 1.5, door[2] + 20]);
    await ev(() => { const p = VR.game.player; p.flying = false; });
    let D = null, sawJob = false, wide = false, framed = false, first = null;
    for (let i = 0; i < 400; i++) {
      await step(10, 50);
      D = await dbg();
      if (D.job) sawJob = true;
      const lead = D.agents.find(a => a[3] === 'arrive');
      if (D.job && lead && !first) { first = lead[4].slice(); run.arriveFrom = first; run.way = D.job.way || null; }
      if (D.job && lead && !framed && AFTER && D.job.framing > 0.6) { framed = true; await grab('arrive_frame', 2); }
      if (D.job && lead && !wide && Math.hypot(lead[4][0] - door[0], lead[4][2] - door[2]) < 22) {
        wide = true;
        await ev(() => { VR.game.zenFreezeTime = true; });
        const dx = lead[4][0] - door[0], dz = lead[4][2] - door[2], dl = Math.hypot(dx, dz) || 1;
        const sav = await ev(() => { const p = VR.game.player; return [p.pos.slice(), p.yaw, p.pitch]; });
        await stand([door[0] + 0.5 - dz / dl * 9 - dx / dl * 3, door[1] + 4, door[2] + 0.5 + dx / dl * 9 - dz / dl * 3], [lead[4][0], lead[4][1] + 0.5, lead[4][2]]);
        await ev(() => { const J = VR.game.villages._mi && VR.game.villages._mi.job; if (J) { window.__fr = J.frame; J.frame = null; } });   // (the wide shot from the same place as before)
        await step(2, 33);
        await grab('arrive', 6);
        await ev(() => { const J = VR.game.villages._mi && VR.game.villages._mi.job; if (J && window.__fr) J.frame = window.__fr; window.__fr = null; });
        await ev((s) => { const p = VR.game.player; p.teleport(s[0][0], s[0][1], s[0][2]); p.yaw = s[1]; p.pitch = s[2]; p.viewYaw = s[1]; p.flying = false; }, sav);
        await ev(() => { VR.game.zenFreezeTime = false; });
      }
      if (sawJob && !D.job) break;
    }
    check(sawJob && wide, 'the family came, the arrival is pictured (first seen ' + Math.round(first ? Math.hypot(first[0] - door[0], first[2] - door[2]) : -1) + ' m from the door)');
    if (AFTER) check(framed, 'the gentle framing camera ran');
    run.arrival = { from: first, dist: first ? Math.round(Math.hypot(first[0] - door[0], first[2] - door[2])) : null };
    if (D.card) await ev(() => VR.MoveIn.answerDecor(VR.game, true));
    // two more homes, the second's naming card, a market, a festival
    const H2 = await build({ c: [H1.c[0] + 15, H1.c[2] + 2], wall: 'birch_planks', roof: 'dark_oak_planks', bed: 'blue_bed' });
    const H3 = await build({ c: [H1.c[0] - 15, H1.c[2] + 3], wall: 'stone_bricks', roof: 'spruce_planks', bed: 'yellow_bed', bed2: true });
    void H2; void H3;
    await step(80, 33);
    await ev(() => { const g = VR.game; g.settings.moveinCam = false; });
    const nights = async () => { await ev(() => { const g = VR.game; g.env.setTime(23999); }); await step(4, 33); await ev(() => { const g = VR.game; g.env.setTime(200); }); };
    await stand([H1.c[0] + 0.5, H1.c[1] + 2, H1.c[2] + 12], [H1.c[0], H1.c[1] + 1, H1.c[2]]);
    for (let k = 0; k < 2; k++) {
      let skipped = false;
      for (let n = 0; n < 4 && !skipped; n++) {
        await nights();
        for (let i = 0; i < 12; i++) { await step(10, 50); D = await dbg(); if (D.job && !skipped) skipped = await ev(() => VR.MoveIn.skip(VR.game)); if (skipped) break; }
      }
      await step(10, 33);
      D = await dbg();
      if (D.card && /Namen/.test(D.card)) await ev(() => VR.MoveIn.nameSettlement(VR.game, 'mi:1', 'Lindenhain'));
      await step(4, 33);
      D = await dbg(); if (D.card) await ev(() => VR.MoveIn.card(VR.game, null));
    }
    D = await dbg();
    check(D.homes.filter(h => h.st === 'home').length === 3 && D.sets[0] && D.sets[0].fest !== undefined, 'three families; the first festival on day ' + (D.sets[0] && D.sets[0].fest));
    await ev(() => { const g = VR.game; g.settings.moveinCam = true; });
    await ev((d) => { const g = VR.game; g.env.day = d; g.env.setTime(11700); g.zenFreezeTime = false; }, D.sets[0].fest);
    for (let i = 0; i < 40; i++) await step(10, 50);
    const fest = await ev(() => { const g = VR.game, V = g.villages, vil = V.known.get('mi:1'); const n = V.festivalNear && V.festivalNear(); return { on: V.festivalOn(vil, g.env.timeOfDay), music: !!n && n.id === vil.id }; });
    check(fest.on && fest.music, 'the festival night, with its music: ' + JSON.stringify(fest));
    const pz = await ev(() => { const p = VR.game.villages.known.get('mi:1').plan.plaza; return [p.x, p.y, p.z]; });
    run.plaza = pz;
    await ev(() => { VR.game.zenFreezeTime = true; VR.game.env.setTime(12100); });
    await stand([pz[0] + 4, pz[1] + 9, pz[2] + 22], [pz[0], pz[1] + 1, pz[2] - 2]);
    await step(8, 33);
    await grab('fest_dusk', 8);
    await ev(() => { VR.game.env.setTime(13600); });
    await stand([pz[0] - 6, pz[1] + 3, pz[2] + 13], [pz[0], pz[1] + 1.2, pz[2] - 2]);
    await step(8, 33);
    await grab('fest_night', 8);
    if (want('cost')) await costHere('fest_night');
    // (v0.55 review) the same frame with the move-in switch off (settings.movein = false): what the festival night itself costs
    if (want('cost') && process.env.FEST_OFF !== '0') { await ev(() => { VR.game.settings.movein = false; }); await step(4, 33); await costHere('fest_night_moveinOff'); await ev(() => { VR.game.settings.movein = true; }); }
  } catch (e) { check(false, 'movein: ' + e.message.slice(0, 300)); }
}
check(!logs.some(l => /pageerror/.test(l)), 'no page error' + (logs.length ? ': ' + logs.slice(0, 4).join(' · ') : ''));
save();
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 10)) console.log(l);
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
