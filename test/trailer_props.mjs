// The smooth props (t-smooth) as the trailer shows them: the palms of the trailer's town (seed 4242, vgen 7, preset
// balanced, dusk) and real furniture in a catalogue villa (the open-plan living room at eye height, by day) and in a
// showroom of the ten furniture kinds (sofa, armchair, dining table and chairs, bed, floor and arc lamp, pendant,
// kitchen, bookshelf, planters, TV board). Every place is shot twice in one world: before = Glatte Pflanzen and Glatte
// Möbel off (the voxel palms and furniture), after = on (the smooth props). The settings change in the running game
// (the loaded world is remeshed), so both pictures stand at the same camera, look point and light.
// The places were probed on the generated town and villa (node, the generator code): the camera's cells are air, the
// sight to the look point is clear and the palms / pieces stand in the view.
// Also measured: the frame cost with the props off and on (SwiftShader CPU frames, the method of plants_cost.mjs), and,
// with OLD_DIST naming a build from before the pass (the commit ea240cf), the Very Low (potato) frame cost of both builds
// (AGENTS.md rule 5: the new build at most 6 % slower; Very Low has no prop pass).
// Writes test/shots/trailer_props_<place>_{before,after}.png for the places avenue, garden, road (the town), living,
// dining (the villa), show, showclose (the showroom), village (the villages' own pieces: joined sofas, table, chairs, bed).
//   nohup bash test/wt_run.sh trailer_props.mjs 3000 > .tmp_tests/trailer_props.log 2>&1 &
//   OLD_DIST=/path/to/old/dist/index.html  (optional, the potato comparison) · ONLY=town|villa (one half) · N frames
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'fs';
const SEED = process.env.SEED || '4242', VGEN = +(process.env.VGEN || 7), PRESET = process.env.PRESET || 'balanced';
const DUSK = +(process.env.DUSK || 12500), DAY = +(process.env.DAY || 6500), W = +(process.env.W || 1296), H = +(process.env.H || 704);
const N = +(process.env.N || 4);
const DIST = process.env.DIST || '/home/claude/vr/dist/index.html';
const OLD_DIST = process.env.OLD_DIST || '';
const ONLY = process.env.ONLY || '';
const OUT = '/home/claude/vr/test/shots';
mkdirSync(OUT, { recursive: true });
// the town: feet (the camera stands 1.6–1.8 blocks above the street, as the trailer's camera) → look point
const TOWN = [
  ['road', [0.5, 82.8, -150.5], [0.5, 92, -100.5], DUSK],        // t3_06: the palm road, palms on both sides receding
  ['avenue', [-14.5, 82.8, -141.5], [20.5, 88.5, -141.5], DUSK], // t3_05: a street with palms of several heights
  ['garden', [27.5, 81.6, -114.5], [-2.5, 87, -144.5], DUSK],    // t2_20: the palm city over a lawn
];
// the villa (catalogue #0, Villa R9 180, the lot at OX, OZ, its ground floor at Y0) and the showroom west of it
const VILLA = { n: 0, ox: -256, oz: -128, y0: 86 };
const SX = VILLA.ox - 30, SZ = VILLA.oz + 4, SY = VILLA.y0;
// the showroom (probed: no two pieces share a cell): [name, x, dy, z, facing] — the anchor (part 0) of each piece
const SHOW = [['vm_bookshelf', 0, 0, 0, 2], ['vm_bookshelf', 1, 0, 0, 2], ['vm_kitchen_white_tall', 3, 0, 0, 2], ['vm_kitchen_white_sink', 4, 0, 0, 2], ['vm_kitchen_white_hob', 5, 0, 0, 2], ['vm_kitchen_white_cabinet', 6, 0, 0, 2], ['vm_kitchen_white_upper', 4, 2, 0, 2], ['vm_kitchen_white_upper', 6, 2, 0, 2], ['vm_lowboard', 10, 0, 0, 2], ['vm_tv', 9, 1, 0, 2], ['vm_floor_lamp', 12, 0, 0, 2], ['vm_monstera', 13, 0, 0, 2], ['vm_arc_lamp', 16, 0, 0, 2], ['vm_planter', 17, 0, 0, 2], ['vm_bed_grey', 1, 0, 3, 2], ['vm_nightstand', 2, 0, 3, 2], ['vm_armchair_cream', 4, 0, 4, 2], ['vm_sofa_navy', 8, 0, 4, 2], ['vm_coffee_table_glass', 8, 0, 6, 2], ['vm_dining_table_oak', 13, 0, 4, 2], ['vm_dining_chair_oak', 11, 0, 3, 2], ['vm_dining_chair_oak', 13, 0, 3, 2], ['vm_dining_chair_oak', 12, 0, 5, 0], ['vm_dining_chair_oak', 10, 0, 4, 1], ['vm_dining_chair_oak', 14, 0, 4, 3], ['vm_pendant', 11, 3, 4, 0], ['vm_pendant', 13, 3, 4, 0], ['vm_olive', 16, 0, 4, 2],
  // the villages' pieces to the right: a row of three white sofas (they join: arms at the ends), a table with two chairs,
  // a blue bed (its head east of its foot)
  ['vx_sofa_white', 20, 0, 1, 2], ['vx_sofa_white', 21, 0, 1, 2], ['vx_sofa_white', 22, 0, 1, 2], ['vx_table', 24, 0, 2, 0], ['vx_chair', 24, 0, 1, 2], ['vx_chair', 25, 0, 2, 3],
  ['vx_bed_blue', 26, 0, 4, 1, 0], ['vx_bed_blue', 27, 0, 4, 1, 1]];
const INSIDE = [
  // the villa's open-plan room at eye height (feet on the floor): the living group in front, the dining tables and the kitchen behind
  ['living', [-220.5, 87, -106.5], { yaw: 0.7854, pitch: -0.1 }, DAY],
  ['dining', [-235.5, 87, -109.5], { yaw: 5.1051, pitch: -0.08 }, DAY],
  // the showroom: all ten kinds from eight blocks, then the living group up close at dusk (the lamps glow)
  ['show', [SX + 9, SY, SZ + 11.5], [SX + 9, SY + 1, SZ + 2.5], DAY],
  ['showclose', [SX + 7, SY + 0.2, SZ + 8.6], [SX + 7, SY + 0.5, SZ + 4.5], 13200],
  ['village', [SX + 23.5, SY, SZ + 9.5], [SX + 23.5, SY + 0.5, SZ + 2], DAY],
];
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'];
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  x ' + msg); } else console.log('  ok ' + msg); };
// the camera: yaw 0 looks along −z, pitch is up positive
const aim = ([px, py, pz], [tx, ty, tz]) => { const dx = tx - px, dy = ty - py, dz = tz - pz; return [Math.atan2(-dx, -dz), Math.atan2(dy - 1.62, Math.hypot(dx, dz))]; };
const logs = [];
const browser = await chromium.launch({ channel: 'chromium', args: ARGS });

// a page on one build, at the title (the same boot as trailer_plants.mjs and plants_cost.mjs)
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
async function world(P, name, vgen) {
  await P.ev(`VR.game.createWorld({name:'${name}',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',vgen:${vgen},cheats:true,kit:true})`);
  for (let i = 0; i < 120; i++) { await P.wait(1000); if (await P.ev(() => VR.game.state) === 'play') break; }
}
// the frozen frame of trailer_plants.mjs: the game's own loop is stopped, the frames are the test's (step, shot, measure);
// the HUD, the hint strip and the people are out of the picture (the props are the subject: the villages' and the crowd's
// draws are switched off, run 1 had a festival crowd in front of the palms)
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
// the world is quiet: no mesh pending, no job busy, no upload waiting (three quiet checks in a row)
async function settle(P, max = 90) {
  let quiet = 0;
  for (let i = 0; i < max; i++) {
    await step(P, 3, 50); await P.wait(250);
    const s = await P.ev(() => { const g = VR.game, w = g.world, b = g.pool.busy; const q = w.uploadQ || {}, u = typeof q.size === 'number' ? q.size : typeof q.count === 'number' ? q.count : typeof q.length === 'number' ? q.length : 0; return { p: w.pending ? w.pending.size : 0, b: typeof b === 'number' ? b : (b && b.size) || 0, u }; });
    if (s.p === 0 && s.b === 0 && s.u === 0) { if (++quiet >= 3) return i; } else quiet = 0;
  }
  return max;
}
// a place: [name, feet, look point or {yaw, pitch}, time of day]
async function place(P, [name, pos, tgt, tod], max) {
  const [yaw, pitch] = Array.isArray(tgt) ? aim(pos, tgt) : [tgt.yaw, tgt.pitch];
  await P.ev(([p, y, pt, t]) => { const g = VR.game, pl = g.player; pl.flying = true; pl.noclip = true; pl.teleport(p[0], p[1], p[2]); pl.yaw = y; pl.pitch = pt; pl.fovKick = 0; g.env.setTime(t); const e = g.entities; if (e && e.mobs) e.mobs.length = 0; }, [pos, yaw, pitch, tod || DUSK]);
  return settle(P, max);
}
// one picture: the frame is drawn for the screenshot (the trick of trailer_plants.mjs), then the prop state of that frame
async function shot(P, name) {
  await P.ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; });
  await P.page.screenshot({ path: `${OUT}/${name}.png`, timeout: 180000 });
  console.log('  shot ' + name);
  return P.ev(() => { const r = VR.game.renderer, q = r.q; return { plants: q.smoothProps | 0, furn: q.smoothFurn | 0, secs: r.propSecs ? r.propSecs.size : -1, na: r.propNA | 0, nb: r.propNB | 0, nf: r.propNF | 0, draws: r.stats.draws, tris: r.stats.tris }; });
}
// the settings, in the running game: a change remeshes the loaded world
const setProps = async (P, on) => { await P.ev((on) => { const g = VR.game; g.settings.smoothPlants = on ? 2 : 0; g.settings.smoothFurn = on ? 1 : 0; g.applySettings('*'); }, on); return settle(P, 160); };
// the frame cost inside the page (plants_cost.mjs): warm frames, then n frames with the GPU drained after each one
// (gl.finish and a one-texel readPixels: finish alone returned before the GPU process had drawn the frame)
const measure = (n, warm = 2) => new Promise((res, rej) => {
  const g = VR.game, gl = g.renderer.gl, px = new Uint8Array(4);
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = () => 0;
  const finish = (fn, v) => { window.requestAnimationFrame = raf; window.__norender = true; fn(v); };
  let k = -warm, sum = 0, draws = 0, tris = 0;
  window.__norender = false;
  const frame = () => {
    try {
      const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now());
      gl.finish(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const dt = performance.now() - t0;
      if (k < 0) { k++; setTimeout(frame, 0); return; }
      const st = g.renderer.stats || {};
      sum += dt; draws += st.draws || 0; tris += st.tris || 0;
      if (++k < n) setTimeout(frame, 0);
      else finish(res, { ms: +(sum / n).toFixed(1), draws: Math.round(draws / n), tris: Math.round(tris / n) });
    } catch (e) { finish(rej, String(e && e.stack || e)); }
  };
  frame();
});
async function costs(P, label, spots) {
  const out = {};
  for (const sp of spots) {
    await place(P, sp); await step(P, 4);
    out[sp[0]] = await P.page.evaluate(measure, N);
    console.log(`  ${label} · ${sp[0]}: ${JSON.stringify(out[sp[0]])}`);
  }
  return out;
}
// the villa site: a flat lawn (grass over dirt, air above), the catalogue villa on its lot, the showroom west of it
// (a white marble floor, a white wall behind the back row, a beam over the dining table for the pendants)
async function buildSite(P) {
  return P.ev(([V, show, SX, SY, SZ]) => {
    const g = VR.game, w = g.world, VG = VR.VillageGen, PLAN = VG.plan2, VM = VR.VM, R = VR.R;
    const S = (n, pr) => { const t = R.byName[n]; return t ? (pr ? t.state(pr) : t.defaultState) : 0; };
    const cat = PLAN.CATALOGUE[V.n], y0 = V.y0;
    let n = 0;
    for (let x = V.ox - 38; x < V.ox + cat.lot[0] + 8; x++) for (let z = V.oz - 12; z < V.oz + cat.lot[1] + 12; z++) {
      for (let y = y0 - 3; y < y0 + 28; y++) { w.setBlock(x, y, z, 0, 0); n++; }
      w.setBlock(x, y0 - 1, z, S('grass_block'), 0);
      for (let y = y0 - 6; y < y0 - 1; y++) w.setBlock(x, y, z, S('dirt'), 0);
    }
    const rec = [];
    const L = VG.makeLot((x, y, z, s) => rec.push(x, y, z, s), V.ox, V.oz, 0);
    const lot = { w: cat.lot[0], d: cat.lot[1], F: y0, r: 0, ox: V.ox, oz: V.oz, kind: 'home' };
    const info = PLAN.build(L, lot, { rng: new VR.RNG(1000 + V.n * 17), ground: () => y0 - 1, beds: 3 });
    for (let k = 0; k < rec.length; k += 4) w.setBlock(rec[k], rec[k + 1], rec[k + 2], rec[k + 3], 0);
    // the showroom
    for (let x = SX - 2; x <= SX + 29; x++) for (let z = SZ - 1; z <= SZ + 8; z++) w.setBlock(x, SY - 1, z, S('marble_white'), 0);
    for (let x = SX - 2; x <= SX + 29; x++) for (let y = SY; y <= SY + 3; y++) w.setBlock(x, y, SZ - 1, S('stucco_white'), 0);
    for (let x = SX + 10; x <= SX + 14; x++) w.setBlock(x, SY + 4, SZ + 4, S('white_concrete'), 0);
    let placed = 0;
    for (const [name, x, dy, z, f, part] of show) {
      if (VM.MODELS[name]) VM.put((xx, yy, zz, nm, pr) => w.setBlock(xx, yy, zz, S(nm, pr), 0), SX + x, SY + dy, SZ + z, name, f);
      else if (R.byName[name]) w.setBlock(SX + x, SY + dy, SZ + z, S(name, R.byName[name].has('part') ? { facing: f, part: part | 0 } : { facing: f }), 0);
      else continue;
      placed++;
    }
    return { cleared: n, villa: rec.length / 4, family: info.plan.family, skin: info.skin, placed };
  }, [VILLA, SHOW, SX, SY, SZ]);
}

const res = { town: { before: {}, after: {} }, villa: { before: {}, after: {} }, cost: { off: {}, on: {} }, potato: {} };
try {
  const P = await open(DIST, 'new');
  await P.ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 12; g.settings.horizon = 2; g.settings.smoothPlants = 0; g.settings.smoothFurn = 0; g.applySettings('*'); }, PRESET);
  await world(P, 'Trailer props', VGEN);
  const got = await P.ev(() => { const w = VR.game.world; return w && w.genOpts ? w.genOpts.vgen : (w && w.vgen) || null; });
  check(got === VGEN, `the town is vgen ${VGEN} (the world says ${got})`);
  await freeze(P, DUSK);
  // 1. the town with the props off (before), and its frame cost
  if (ONLY !== 'villa') {
    console.log('phase town before (Glatte Pflanzen / Möbel off)');
    for (const sp of TOWN) {
      await place(P, sp); await step(P, 6);
      const st = await shot(P, `trailer_props_${sp[0]}_before`);
      res.town.before[sp[0]] = st;
      check(st.plants === 0 && st.secs === 0, `${sp[0]} before: the prop pass is off and holds no anchors (plants ${st.plants}, sections ${st.secs})`);
    }
    res.cost.off.town = await costs(P, 'props off', TOWN);
  }
  // 2. the villa and the showroom, props off then on, and their frame cost
  if (ONLY !== 'town') {
    console.log('phase villa (the site, then before / after)');
    await place(P, INSIDE[0], 160);
    const built = await buildSite(P);
    console.log('  site ' + JSON.stringify(built));
    check(built.villa > 2000 && built.placed === SHOW.length, `the villa (${built.villa} blocks, ${built.family} ${built.skin}) and the showroom (${built.placed} of ${SHOW.length} pieces) stand`);
    await settle(P, 160);
    for (const sp of INSIDE) { await place(P, sp); await step(P, 6); res.villa.before[sp[0]] = await shot(P, `trailer_props_${sp[0]}_before`); }
    res.cost.off.villa = await costs(P, 'props off', INSIDE.slice(0, 1));
    await setProps(P, true);
    for (const sp of INSIDE) {
      await place(P, sp); await step(P, 6);
      const st = await shot(P, `trailer_props_${sp[0]}_after`);
      res.villa.after[sp[0]] = st;
      check(st.furn >= 1 && st.nf > 0, `${sp[0]} after: the furniture pass is on and draws pieces here (furniture ${st.furn}, ${st.nf} pieces)`);
    }
    res.cost.on.villa = await costs(P, 'props on', INSIDE.slice(0, 1));
  } else await setProps(P, true);
  // 3. the town with the props on (after), and its frame cost
  if (ONLY !== 'villa') {
    console.log('phase town after (Glatte Pflanzen / Möbel on)');
    for (const sp of TOWN) {
      await place(P, sp, 160); await step(P, 6);
      const st = await shot(P, `trailer_props_${sp[0]}_after`);
      res.town.after[sp[0]] = st;
      check(st.plants === 2 && st.secs > 0, `${sp[0]} after: the pass is on and the loaded sections hold anchors (plants ${st.plants}, sections ${st.secs})`);
      check(st.na + st.nb > 0, `${sp[0]} after: palms are drawn at this place (${st.na} full, ${st.nb} far crosses)`);
    }
    res.cost.on.town = await costs(P, 'props on', TOWN);
  }
  await P.ctx.close();

  // 4. the potato preset (Very Low: no prop pass) on the build before the pass and on this one, at the town places
  if (OLD_DIST) {
    for (const [tag, dist] of [['old', OLD_DIST], ['new', DIST]]) {
      const Q = await open(dist, tag);
      await Q.ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.settings.minimap = false; g.applySettings('*'); });
      await world(Q, 'Props potato ' + tag, VGEN);
      await freeze(Q, DUSK);
      res.potato[tag] = await costs(Q, 'potato ' + tag, TOWN);
      await Q.ctx.close();
    }
    for (const sp of TOWN) {
      const a = res.potato.old[sp[0]].ms, b = res.potato.new[sp[0]].ms, r = b / a;
      check(r <= 1.06, `potato ${sp[0]}: ${b} ms new vs ${a} ms old (${r.toFixed(2)}×, draws ${res.potato.new[sp[0]].draws} vs ${res.potato.old[sp[0]].draws}) — at most 1.06×`);
    }
  }
  // 5. the logs: no page error, no shader error
  console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
  check(!logs.some(l => /pageerror/.test(l)), 'no page errors');
  check(!logs.some(l => /shader|compile|link/i.test(l)), 'no shader compile or link errors');
  console.log('RESULT ' + JSON.stringify(res));
} catch (e) {
  fails++; console.log('  x exception: ' + String(e && e.stack || e).slice(0, 1500));
  for (const l of logs.slice(0, 12)) console.log(l);
} finally {
  await browser.close();
}
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
