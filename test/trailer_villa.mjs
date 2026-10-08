// Villa Nova — THE house of the trailer (gen_nova.js, voxnova.js; plan docs/superpowers/plans/2026-10-08-t-villa.md) in the
// game: a flat creative world, the house placed through the blueprint path the 🖐 Bauhand uses (g.gadgets.blue: the
// worker builds the catalogue house, planAt levels the lot, buildAt lays it down, Sofort), and next to it the closest
// house of the catalogue before this branch (Villa R9 140 in the Glashaus skin) at the same cameras:
//   front  (t3_05)  the facade from the street            corner (t1_26)  the box bay and the slab edge at dusk
//   garden (t2_23)  the stepped house from the garden       stair  (t1_29)  the white hall: the stairs, the pad, the glass wall
//   pad    (t1_30)  the pad and the stairs from above
// → test/shots/trailer_villa_<shot>.png (after) and trailer_villa_<shot>_before.png, plus a few views of the villa alone
// (back, foyer, aerial, front_day). Then the Very Low (potato) frame cost at the front camera, both houses, alternating.
// Checks: both houses stand (probes: a nova window in the bay, the pad, a stair tread, the glass wall), every picture is
// written, no page error.   bash test/wt_run.sh trailer_villa.mjs 2400 · PRESET=high · N=6 frames per cost round
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const TAG = process.env.TAG || 'trailer_villa', N = +(process.env.N || 6);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail|missing/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const step = async (n, dtms = 16) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && i > 2) break; await wait(60); } };
const shotPath = (name) => `/home/claude/vr/test/shots/${name}.png`;
const shot = async (name, frames = 4) => { await ev((frames) => { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, frames); await page.screenshot({ path: shotPath(name), timeout: 180000 }); const ok = fs.existsSync(shotPath(name)); console.log('shot', name, ok ? '' : '(missing)'); return ok; };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.horizon = 1; g.settings.renderDist = 6; g.settings.bau = 'instant'; g.applySettings('*'); }, process.env.PRESET || 'high');
await ev(`VR.game.createWorld({name:'Villa Nova',mode:'creative',difficulty:'peaceful',type:'flat',seed:'26',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } g.env.setTime(6000); });
await settle(60);

// ---------------------------------------------------------------- the two houses through the blueprint path
const PLACES = { after: { ox: -12, oz: -12 }, before: { ox: -100, oz: -14 } };
const place = async (which, index, skin) => {
  const P = PLACES[which];
  await ev(([i, skin]) => { const B = VR.game.gadgets.blue, vs = B.variants(i); B.variant[i] = Math.max(0, vs.findIndex(v => v.skin === skin && !v.mirror)); B.get(i); }, [index, skin]);
  let bp = null;
  for (let k = 0; k < 160 && !bp; k++) { await step(2); bp = await ev((i) => { const b = VR.game.gadgets.blue.get(i); return b ? { lot: b.lot, house: b.house, top: b.top, skin: b.skin, n: b.ops.length / 4 } : null; }, index); if (!bp) await wait(250); }
  if (!bp) { check(false, which + ': the worker built blueprint ' + index); return null; }
  // the ground must be loaded under the lot before it is levelled
  await ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 30, z); }, [P.ox + bp.lot[0] / 2, P.oz + bp.lot[1] / 2]);
  await settle(80);
  const r = await ev(([i, ox, oz, name]) => {
    const g = VR.game, B = g.gadgets.blue, bp = B.get(i), W = bp.lot[0], D = bp.lot[1];
    const gy = B.groundAt(ox + (W >> 1), oz + (D >> 1), 120, 0), F = gy + 1;
    const rect = (u0, v0, u1, v1) => [ox + Math.min(u0, u1), oz + Math.min(v0, v1), ox + Math.max(u0, u1), oz + Math.max(v0, v1)];
    const at = { bp, r: 0, ox, oz, F, x0: ox, z0: oz, x1: ox + W - 1, z1: oz + D - 1, rect, ok: true, why: '' };
    const t0 = performance.now(), n = B.buildAt(at, name);
    if (B.finishSites) B.finishSites('skip');
    return { F, n, ms: Math.round(performance.now() - t0), lot: [W, D], house: bp.house, skin: bp.skin };
  }, [index, P.ox, P.oz, which === 'after' ? 'Villa Nova' : 'Villa R9 140']);
  await settle(120);
  console.log(which, JSON.stringify(r));
  check(r.n > 1000, `${which}: the blueprint path laid the house down (${r.n} cells, ${r.ms} ms)`);
  return Object.assign({}, P, r, bp);
};
const idx = await ev(() => ({ nova: VR.VillageGen.plan2.TRAILER, glas: 2 }));
const A = await place('after', idx.nova, 'nova');
const Bf = await place('before', idx.glas, 'glas');
if (A) {
  const probe = await ev(([ox, oz, F]) => {
    const w = VR.game.world, R = VR.R, nm = (x, y, z) => { const s = w.getBlock(x, y, z); return s ? R.types[R.T.type[s]].name : 'air'; };
    return { bay: nm(ox + 5, F + 3, oz + 5), pad: nm(ox + 12, F + 1, oz + 16), tread: nm(ox + 5, F + 1, oz + 19), glass: nm(ox + 9, F + 3, oz + 20), band: nm(ox + 12, F + 6, oz + 4), door: nm(ox + 12, F + 1, oz + 5) };
  }, [A.ox, A.oz, A.F]);
  console.log('probe', JSON.stringify(probe));
  check(probe.bay === 'vx_nova_window' && probe.pad === 'vm_nova_pad' && probe.tread === 'vm_nova_tread' && probe.glass === 'panorama_white' && probe.band === 'vx_nova_band' && /door/.test(probe.door), 'Villa Nova stands in the world: the bay window, the pad, a stair tread, the glass wall, the slab edge, the door');
}

// ---------------------------------------------------------------- the cameras (relative to the house's front centre, eye heights)
// hc: the middle of the house's street front (lot ox + house u0 + w/2, oz + house v0); eye → target
const CAMS = {
  front: { t: 12350, eye: [5, 2.0, -21], at: [0, 6.5, 6] },
  corner: { t: 12600, eye: [-12.5, 2.3, -6.5], at: [-6.5, 3.4, 0] },
  garden: { t: 12350, eye: [19, 9, -15], at: [0, 6, 7] },
  stair: { t: 6000, eye: [0, 2.6, 5.4], at: [0, 3.0, 14] },
  pad: { t: 6000, eye: [0, 5.0, 5.6], at: [0, 1.2, 11.5] },
};
const EXTRA = {
  back: { t: 6500, eye: [0, 3.2, 25], at: [0, 5, 10] },
  foyer: { t: 6000, eye: [-3, 2.6, 2.4], at: [2, 3.0, 14] },
  aerial: { t: 11800, eye: [24, 26, -20], at: [0, 6, 8] },
  front_day: { t: 9000, eye: [5, 2.0, -21], at: [0, 6.5, 6] },
};
const aim = async (H, cam) => {
  const hc = [H.ox + H.house[0] + H.house[2] / 2, H.oz + H.house[1]];
  const eye = [hc[0] + cam.eye[0], H.F + cam.eye[1], hc[1] + cam.eye[2]], at = [hc[0] + cam.at[0], H.F + cam.at[1], hc[1] + cam.at[2]];
  await ev(([eye, at, t]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(eye[0], eye[1] - 1.62, eye[2]); p.yaw = Math.atan2(-(at[0] - eye[0]), -(at[2] - eye[2])); p.pitch = Math.atan2(at[1] - eye[1], Math.hypot(at[0] - eye[0], at[2] - eye[2])); p.fovKick = 0; g.env.setTime(t); const e = g.entities; if (e && e.mobs) e.mobs.length = 0; }, [eye, at, cam.t]);
  await settle(40); await step(6);
};
let pics = 0, want = 0;
for (const [name, cam] of Object.entries(CAMS)) {
  if (A) { want++; await aim(A, cam); if (await shot(`${TAG}_${name}`)) pics++; }
  if (Bf) { want++; await aim(Bf, cam); if (await shot(`${TAG}_${name}_before`)) pics++; }
}
for (const [name, cam] of Object.entries(EXTRA)) if (A) { want++; await aim(A, cam); if (await shot(`${TAG}_${name}`)) pics++; }
check(pics === want && want >= 10, `every picture is written (${pics} of ${want})`);

// ---------------------------------------------------------------- the Very Low frame cost at the front camera, both houses
const measure = (n, warm = 2) => new Promise((res, rej) => {
  const g = VR.game, gl = g.renderer.gl;
  let k = -warm, sum = 0, draws = 0, tris = 0;
  const frame = () => {
    try {
      const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish();
      const dt = performance.now() - t0;
      if (k < 0) { k++; setTimeout(frame, 0); return; }
      const st = g.renderer.stats || {};
      sum += dt; draws += st.draws || 0; tris += st.tris || 0;
      if (++k < n) setTimeout(frame, 0); else res({ ms: +(sum / n).toFixed(1), draws: Math.round(draws / n), tris: Math.round(tris / n) });
    } catch (e) { rej(e); }
  };
  frame();
});
if (A && Bf) {
  await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
  await settle(80);
  const res = { after: [], before: [] };
  for (let round = 0; round < 2; round++) for (const [k, H] of [['before', Bf], ['after', A]]) {
    await aim(H, CAMS.front);
    await ev(() => { window.__norender = false; });
    res[k].push(await ev((n) => new Promise((ok, no) => { const g = VR.game, gl = g.renderer.gl; let k = -2, sum = 0, d = 0, t = 0; const f = () => { try { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); const dt = performance.now() - t0; if (k < 0) { k++; setTimeout(f, 0); return; } const st = g.renderer.stats || {}; sum += dt; d += st.draws || 0; t += st.tris || 0; if (++k < n) setTimeout(f, 0); else ok({ ms: +(sum / n).toFixed(1), draws: Math.round(d / n), tris: Math.round(t / n) }); } catch (e) { no(String(e)); } }; f(); }), N));
    await ev(() => { window.__norender = true; });
  }
  const avg = (a) => +(a.reduce((s, r) => s + r.ms, 0) / a.length).toFixed(1);
  console.log('very low · front camera · before', JSON.stringify(res.before), 'after', JSON.stringify(res.after));
  console.log(`very low frame: before (Villa R9 140 Glashaus) ${avg(res.before)} ms · after (Villa Nova) ${avg(res.after)} ms`);
  void measure;
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
check(!logs.some(l => /pageerror/.test(l)), 'no page error');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);
