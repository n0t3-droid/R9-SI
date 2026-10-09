// Glatt-Modelle in the game (t-form): every model piece without a hand-built mesh drawn from surface nets when „Glatte
// Möbel" is on. One world (seed 4242), the furnished villa (catalogue #0, the open-plan room), the mansion (gen_modern.js,
// the town hall's grand hall: urns, a fountain, chandeliers, sconces, the reception desks — VX pieces), and a showroom of
// Modern Living pieces and the Nova pad at dusk. Every place is shot twice at the same camera and light: before = „Glatte
// Möbel" on with the surface-nets pass held back (VR.SmoothVox.enabled false: the hand-built pieces smooth, the others
// voxel), after = with it (the meshes are made in the worker, the sections meshed again). After each shot: the pieces
// drawn from surface nets vs hand-built (the furniture pass's slots of that frame). Then Very Low (no smooth furniture):
// the frame draws the same with the pass on and held back (draws, triangles), and with OLD_DIST (the build
// before t-form) the Very Low frame cost of both builds, paired frame by frame (at most 1.06×).
// Writes test/shots/smoothvox_<place>_{before,after}.png for dining, living, hall, show, show2; smoothvox_verylow.png.
//   nohup bash test/wt_run.sh smoothvox.mjs 3000 > .tmp_tests/smoothvox.log 2>&1 &
//   OLD_DIST=/path/to/old/dist/index.html (the paired Very Low frames) · N frames (6)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'fs';
const SEED = '4242', W = 1296, H = 704, DAY = 6500, DUSK = 13200, N = +(process.env.N || 6);
const DIST = process.env.DIST || '/home/claude/vr/dist/index.html', OLD_DIST = process.env.OLD_DIST || '';
const OUT = '/home/claude/vr/test/shots';
mkdirSync(OUT, { recursive: true });
const Y0 = 86;
const VILLA = { n: 0, ox: -256, oz: -128 };            // Villa R9 180: the open-plan living / dining / kitchen (t-smooth's cameras)
const MANSION = { ox: -256, oz: -175 };                // gen_modern.js MOD.mansion (31 × 19): the grand hall (t-smooth2's camera)
const SX = -298, SZ = -86;                             // the showroom: a white marble floor, a white wall at SZ − 1, a beam for the pendants
// [name, x, dy, z, facing]: a model placed by the corner of its footprint (its smallest x, z)
const SHOW = [['vm_living_sofa3_sage', 0, 0, 1, 2], ['vm_living_lounge_shell', 4, 0, 1, 2], ['vm_living_coffeetable_travertine', 1, 0, 3, 2], ['vm_light_floor_globe_brass', 5, 0, 0, 2],
  ['vm_plant_fig_concrete', 6, 0, 0, 2], ['vm_kitchen_island_terrazzo', 8, 0, 0, 2], ['vm_sleep_boxspring_grey', 11, 0, 0, 2], ['vm_bath_tub_oval', 14, 0, 0, 2], ['vm_deco_vase_pampas', 17, 0, 0, 2],
  ['vm_office_chair_mesh', 18, 0, 2, 2], ['vm_nova_pad', 20, 0, 1, 0], ['vm_living_mediawall_oak', 24, 0, 0, 2], ['vm_piano', 8, 0, 3, 2], ['vm_fireplace', 27, 0, 0, 2],
  ['vm_light_pendant_globe_brass', 1, 3, 2, 0], ['vm_light_pendant_dome_white', 3, 3, 2, 0], ['vm_sideboard', 14, 0, 3, 2], ['vm_bunk_bed', 29, 0, 1, 2]];
const PLACES = [
  ['dining', [-235.5, 87, -109.5], { yaw: 5.1051, pitch: -0.08 }, DAY],          // the villa's dining table (t-smooth's camera)
  ['living', [-220.5, 87, -106.5], { yaw: 0.7854, pitch: -0.1 }, DAY],           // the open-plan room: the fridge, the curtains, the kitchen behind
  ['hall', [-240.5, 87, -170.6], [-240.5, 90, -158], DAY],                       // the mansion's grand hall (t-smooth2's camera)
  ['show', [SX + 14.5, Y0 + 1.5, SZ + 8.5], [SX + 14.5, Y0 + 0.6, SZ + 1], DUSK],   // the showroom at dusk: the island, the bed, the tub, the Nova pad
  ['show2', [SX + 3.5, Y0 + 1.6, SZ + 8], [SX + 3.5, Y0 + 0.9, SZ + 1], DUSK],      // its left end: the sofa, the shell chair, the lamps, the fig
];
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'];
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  x ' + msg); } else console.log('  ok ' + msg); };
const aim = ([px, py, pz], [tx, ty, tz]) => { const dx = tx - px, dy = ty - py, dz = tz - pz; return [Math.atan2(-dx, -dz), Math.atan2(dy - 1.62, Math.hypot(dx, dz))]; };
const logs = [];
const browser = await chromium.launch({ channel: 'chromium', args: ARGS });

async function open(dist, tag) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|shader/i.test(s)) logs.push(`[${tag} ${t}] ${s.slice(0, 600)}`); });
  page.on('pageerror', e => logs.push(`[${tag} pageerror] ` + (e.stack || e.message).slice(0, 1200)));
  const P = { ctx, page, ev: (fn, arg) => page.evaluate(fn, arg), wait: (ms) => page.waitForTimeout(ms) };
  await page.goto('file://' + dist);
  for (let i = 0; i < 120; i++) { await P.wait(500); if (await P.ev(() => VR.game && VR.game.state === 'title')) break; }
  return P;
}
async function world(P, name) {
  await P.ev(`VR.game.createWorld({name:'${name}',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',vgen:7,cheats:true,kit:true})`);
  for (let i = 0; i < 120; i++) { await P.wait(1000); if (await P.ev(() => VR.game.state) === 'play') break; }
}
// the frozen frame (trailer_props.mjs): the test draws the frames; HUD, hints and people out of the picture
async function freeze(P, t) {
  await P.ev((t) => {
    const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; g.hideHud = true;
    const h = document.getElementById('hud'); if (h) h.style.display = 'none';
    const st = document.createElement('style'); st.textContent = '#hints, #hint, #aqhint, .toast, #toasts { display: none !important; }'; document.head.appendChild(st);
    window.requestAnimationFrame = () => 0; const R = g.renderer; R._render = R.render;
    R.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); };
    window.__norender = true; g.env.setTime(t);
    if (g.villages) g.villages.draw = () => {};
    if (VR.Crowd) VR.Crowd.draw = () => {};
  }, t);
}
const step = (P, n, dtms = 50) => P.ev(([m, d]) => { const g = VR.game; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [n, dtms]);
// quiet: no mesh pending, no job busy, no upload waiting, no smooth mesh asked for and not come (three checks in a row)
async function settle(P, max = 120) {
  let quiet = 0;
  for (let i = 0; i < max; i++) {
    await step(P, 3, 50); await P.wait(250);
    // (the steps schedule what is dirty within the mesh radius: an idle pool three times running means all of it is
    // meshed — dirty columns beyond the radius are never meshed and are not waited for)
    const s = await P.ev(() => { const g = VR.game, w = g.world, b = g.pool.busy; const q = w.uploadQ || {}, u = typeof q.size === 'number' ? q.size : 0; return { b: typeof b === 'number' ? b : 0, u }; });
    if (s.b === 0 && s.u === 0) { if (++quiet >= 3) return i; } else quiet = 0;
  }
  return max;
}
async function place(P, [name, pos, tgt, tod], max) {
  const [yaw, pitch] = Array.isArray(tgt) ? aim(pos, tgt) : [tgt.yaw, tgt.pitch];
  await P.ev(([p, y, pt, t]) => { const g = VR.game, pl = g.player; pl.flying = true; pl.noclip = true; pl.teleport(p[0], p[1], p[2]); pl.yaw = y; pl.pitch = pt; pl.fovKick = 0; g.env.setTime(t); const e = g.entities; if (e && e.mobs) e.mobs.length = 0; }, [pos, yaw, pitch, tod]);
  return settle(P, max);
}
// a picture, then what the furniture pass drew in that frame: pieces from surface nets (slots 'auto:…') and hand-built
async function shot(P, name) {
  await P.ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; });
  await P.page.screenshot({ path: `${OUT}/${name}.png`, timeout: 180000 });
  console.log('  shot ' + name);
  // (the slots keep the counts of the last frame that drew the pass: without smooth furniture nothing of it was drawn)
  return P.ev(() => { const r = VR.game.renderer, on = !!(r.q.smoothFurn || r.q.smoothProps), sl = on ? r.furnSlots || [] : []; let auto = 0, hand = 0, ak = 0, hk = 0; for (const s of sl) { const n = (s.nn | 0) + (s.nf | 0); if (!n) continue; if (s.key.indexOf('auto:') === 0) { auto += n; ak++; } else { hand += n; hk++; } } return { auto, hand, autoModels: ak, handModels: hk, draws: r.stats.draws, tris: r.stats.tris }; });
}
const measure = (n, warm = 2) => new Promise((res, rej) => {
  const g = VR.game, gl = g.renderer.gl, px = new Uint8Array(4), raf = window.requestAnimationFrame;
  window.requestAnimationFrame = () => 0;
  const finish = (fn, v) => { window.requestAnimationFrame = raf; window.__norender = true; fn(v); };
  let k = -warm, sum = 0, draws = 0, tris = 0; const all = [];
  window.__norender = false;
  const frame = () => {
    try {
      const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now());
      gl.finish(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const dt = performance.now() - t0;
      if (k < 0) { k++; setTimeout(frame, 0); return; }
      const st = g.renderer.stats || {}; sum += dt; draws += st.draws || 0; tris += st.tris || 0; all.push(dt);
      if (++k < n) setTimeout(frame, 0); else { all.sort((a, b) => a - b); finish(res, { ms: +(sum / n).toFixed(1), med: +all[n >> 1].toFixed(1), min: +all[0].toFixed(1), draws: Math.round(draws / n), tris: Math.round(tris / n) }); }
    } catch (e) { finish(rej, String(e && e.stack || e)); }
  };
  frame();
});
// the sites: flat ground (grass over dirt, air above), the villa, the mansion, the showroom
async function buildSites(P) {
  return P.ev(([V, M, SX, SZ, Y0, SHOW]) => {
    const g = VR.game, w = g.world, VG = VR.VillageGen, PLAN = VG.plan2, VM = VR.VM, R = VR.R;
    const S = (n, pr) => { const t = R.byName[n]; return t ? (pr ? t.state(pr) : t.defaultState) : 0; };
    const set = (x, y, z, s) => w.setBlock(x, y, z, s, 0);
    const ground = (x0, z0, x1, z1) => { for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { for (let y = Y0 - 3; y < Y0 + 30; y++) set(x, y, z, 0); set(x, Y0 - 1, z, S('grass_block')); for (let y = Y0 - 6; y < Y0 - 1; y++) set(x, y, z, S('dirt')); } };
    const rec = (list) => (x, y, z, s) => list.push(x, y, z, s);
    const lay = (list) => { for (let k = 0; k < list.length; k += 4) set(list[k], list[k + 1], list[k + 2], list[k + 3]); return list.length / 4; };
    const out = {};
    const cat = PLAN.CATALOGUE[V.n];
    ground(V.ox - 2, V.oz - 4, V.ox + cat.lot[0] + 2, V.oz + cat.lot[1] + 4);
    { const list = []; const L = VG.makeLot(rec(list), V.ox, V.oz, 0); const info = PLAN.build(L, { w: cat.lot[0], d: cat.lot[1], F: Y0, r: 0, ox: V.ox, oz: V.oz, kind: 'home' }, { rng: new VR.RNG(1000 + V.n * 17), ground: () => Y0 - 1, beds: 3 }); out.villa = lay(list); out.skin = info.skin; }
    ground(M.ox - 3, M.oz - 5, M.ox + 33, M.oz + 20);
    { const list = []; const L = VG.makeLot(rec(list), M.ox, M.oz, 0); VG.modern.mansion(L, { w: 31, d: 19, F: Y0, r: 0, ox: M.ox, oz: M.oz, kind: 'hall' }, { rng: new VR.RNG(77), ground: () => Y0 - 1 }); out.mansion = lay(list); }
    ground(SX - 4, SZ - 3, SX + 34, SZ + 20);
    for (let x = SX - 2; x <= SX + 32; x++) for (let z = SZ - 1; z <= SZ + 12; z++) set(x, Y0 - 1, z, S('marble_white'));
    for (let x = SX - 2; x <= SX + 32; x++) for (let y = Y0; y <= Y0 + 3; y++) set(x, y, SZ - 1, S('stucco_white'));
    for (let x = SX; x <= SX + 5; x++) set(x, Y0 + 4, SZ + 2, S('white_concrete'));
    out.placed = 0; out.missing = [];
    for (const [name, x, dy, z, f] of SHOW) {
      const m = VM.MODELS[name]; if (!m) { out.missing.push(name); continue; }
      const fp = VM.footprint(m, f | 0); let du = 0, dv = 0; for (const c of fp) { du = Math.min(du, c[0]); dv = Math.min(dv, c[2]); }
      VM.put((xx, yy, zz, nm, pr) => set(xx, yy, zz, S(nm, pr)), SX + x - du, Y0 + dy, SZ + z - dv, name, f | 0); out.placed++;
    }
    return out;
  }, [VILLA, MANSION, SX, SZ, Y0, SHOW]);
}
const setAuto = async (P, on) => { await P.ev((on) => { VR.SmoothVox.enabled = on; VR.game.remeshAll(); }, on); return settle(P, 200); };

const res = { before: {}, after: {}, cost: {}, stats: null, verylow: {} };
try {
  const P = await open(DIST, 'new');
  await P.ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.horizon = 2; g.applySettings('*'); });
  await world(P, 'Glatt-Modelle');
  await freeze(P, DAY);
  const q = await P.ev(() => ({ furn: VR.game.renderer.q.smoothFurn | 0, sv: !!VR.SmoothVox, entries: VR.SmoothVox ? VR.SmoothVox.autoTables().n : 0 }));
  check(q.furn === 1 && q.sv && q.entries > 300, `„Glatte Möbel" is on in Ausgewogen, smoothvox.js is there (${q.entries} entries)`);
  await place(P, PLACES[0], 160);
  const built = await buildSites(P);
  console.log('  sites ' + JSON.stringify(built));
  check(built.villa > 2000 && built.mansion > 2000 && built.placed === SHOW.length, `the villa (${built.villa} blocks), the mansion (${built.mansion}) and the showroom (${built.placed} of ${SHOW.length} pieces) stand`);
  // before: the pass held back
  console.log('phase before (the surface-nets pass held back)');
  await setAuto(P, false);
  for (const sp of PLACES) { await place(P, sp); await step(P, 6); res.before[sp[0]] = await shot(P, `smoothvox_${sp[0]}_before`); }
  for (const sp of PLACES) check(res.before[sp[0]].auto === 0, `${sp[0]} before: no piece from surface nets (${res.before[sp[0]].hand} hand-built pieces drawn)`);
  await place(P, PLACES[0]); await step(P, 4); res.cost.before = await P.page.evaluate(measure, N); console.log('  cost before · dining ' + JSON.stringify(res.cost.before));
  // after: the pass on — the meshes come from the worker, the sections are meshed again
  console.log('phase after (Glatt-Modelle)');
  const t0 = Date.now(); const it = await setAuto(P, true);
  console.log(`  settled in ${((Date.now() - t0) / 1000).toFixed(0)} s (${it} rounds)`);
  for (const sp of PLACES) {
    await place(P, sp, 200); await step(P, 6);
    const st = res.after[sp[0]] = await shot(P, `smoothvox_${sp[0]}_after`);
    console.log(`    ${sp[0]}: ${st.auto} pieces from surface nets (${st.autoModels} models), ${st.hand} hand-built (${st.handModels} models); ${st.draws} draws, ${st.tris} triangles`);
    check(st.auto > 0, `${sp[0]} after: pieces drawn from surface nets (${st.auto})`);
  }
  check(res.after.hall.auto >= 8, `the mansion's hall: its urns, fountain, chandeliers, sconces and desks are smooth (${res.after.hall.auto} pieces)`);
  check(res.after.show.autoModels + res.after.show2.autoModels >= 12, `the showroom: the Modern Living pieces and the Nova pad (${res.after.show.autoModels} + ${res.after.show2.autoModels} models in the two pictures)`);
  check(res.after.dining.hand === res.before.dining.hand, `the hand-built pieces stay what they were (${res.after.dining.hand} = ${res.before.dining.hand} at the dining table)`);
  await place(P, PLACES[0]); await step(P, 4); res.cost.after = await P.page.evaluate(measure, N); console.log('  cost after · dining ' + JSON.stringify(res.cost.after));
  res.stats = await P.ev(() => { const M = VR.SmoothVox.main; return Object.assign({ ready: M.asked.size, cacheMain: Object.keys(VR.Props.AUTO).length }, M.stats); });
  console.log('  meshes ' + JSON.stringify(res.stats) + ` · ${(res.stats.ms / Math.max(1, res.stats.got)).toFixed(1)} ms a model in the worker, ${(res.stats.bytes / 1048576).toFixed(1)} MB`);
  check(res.stats.got > 30 && res.stats.got === res.stats.asked, `every mesh asked for came (${res.stats.got} of ${res.stats.asked})`);
  // Very Low: no smooth furniture — the same picture with the pass on and held back
  console.log('phase Very Low');
  await P.ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
  await place(P, PLACES[0], 200); await step(P, 6);
  // (the meshes of every loaded section, summed: the clouds drift, so the frame's totals are not the measure)
  const meshSum = () => P.ev(() => { let n = 0, k = 0; for (const c of VR.game.world.cols.values()) for (const sc of c.sec) if (sc.mesh) for (const m of sc.mesh) if (m) { n += m.count | 0; k++; } return n + ' vertices in ' + k + ' meshes'; });
  const vlOn = await shot(P, 'smoothvox_verylow'), msOn = await meshSum();
  await setAuto(P, false); await place(P, PLACES[0], 200); await step(P, 6);
  const vlOff = await shot(P, 'smoothvox_verylow_held'), msOff = await meshSum();
  check(msOn === msOff && vlOn.auto === 0 && vlOn.hand === 0, `Very Low: the same meshes with the pass on and held back (${msOn} / ${msOff}), no smooth piece drawn`);
  const vq = await P.ev(() => VR.game.renderer.q.smoothFurn | 0);
  check(vq === 0, 'Very Low draws no smooth furniture');
  await P.ctx.close();
  // Very Low, this build against the build before t-form: two pages, their frames alternating (trailer_props.mjs)
  if (OLD_DIST) {
    const Q = {}, NP = 10;
    for (const [tag, dist] of [['old', OLD_DIST], ['new', DIST]]) {
      Q[tag] = await open(dist, tag);
      await Q[tag].ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.settings.minimap = false; g.applySettings('*'); });
      await world(Q[tag], 'Glatt potato ' + tag); await freeze(Q[tag], DAY);
      await buildSites(Q[tag]);
    }
    const one = `(${measure.toString()})(1, 0)`;
    for (const sp of [PLACES[0], PLACES[2]]) {
      for (const tag of ['old', 'new']) { await place(Q[tag], sp, 200); await step(Q[tag], 4); await Q[tag].page.evaluate(`(${measure.toString()})(2, 1)`); }
      const t = { old: [], new: [] }, dr = { old: [], new: [] }, tr = { old: [], new: [] };
      for (let k = 0; k < NP; k++) for (const tag of (k & 1 ? ['new', 'old'] : ['old', 'new'])) { const r = await Q[tag].page.evaluate(one); t[tag].push(r.ms); dr[tag].push(r.draws); tr[tag].push(r.tris); }
      const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
      const r = med(t.new.map((v, i) => v / t.old[i]));
      res.verylow[sp[0]] = { old: med(t.old), new: med(t.new), pair: +r.toFixed(3), draws: [med(dr.old), med(dr.new)], tris: [med(tr.old), med(tr.new)] };
      console.log(`  potato ${sp[0]}: old ${t.old.map(Math.round).join(' ')} · new ${t.new.map(Math.round).join(' ')} ms; draws ${med(dr.old)} / ${med(dr.new)}, triangles ${med(tr.old)} / ${med(tr.new)}`);
      // the same frame: the same draws and triangles (nothing of t-form runs on Very Low); the time paired frame by frame
      // (this 2-CPU machine is shared by three agents: the time is noisy, the work is not)
      check(med(dr.new) === med(dr.old) && Math.abs(med(tr.new) - med(tr.old)) <= 0.01 * med(tr.old), `Very Low ${sp[0]}: the same work — ${med(dr.new)} draws, ${med(tr.new)} triangles (the build before: ${med(dr.old)}, ${med(tr.old)})`);
      check(r <= 1.10, `Very Low ${sp[0]}: new over old, the median of ${NP} pairs ${r.toFixed(3)}× (at most 1.10 on this shared machine)`);
    }
    for (const tag of ['old', 'new']) await Q[tag].ctx.close();
  }
  console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
  check(!logs.some(l => /pageerror/.test(l)), 'no page errors');
  check(!logs.some(l => /shader|compile|link/i.test(l)), 'no shader errors');
  console.log('RESULT ' + JSON.stringify(res));
} catch (e) {
  fails++; console.log('  x exception: ' + String(e && e.stack || e).slice(0, 1500));
  for (const l of logs.slice(0, 12)) console.log(l);
} finally {
  await browser.close();
}
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
