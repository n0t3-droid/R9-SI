// f-polish6 (docs/superpowers/plans/2026-11-01-f-polish6.md): review v0.55's rule item and clarity items, before / after.
//   R56-18 the first 60 s of a new world (t45, t60: Funke's way ribbon and the drone; the minimap's city name, R56-14)
//   R56-13 the held block's saturation (the t60 crop)
//   R56-01 Very Low, the winter light night: seasons off / on / on without the festival's models / on without the
//          SEASON define — alternated, three rounds (and High off / on)
//   R56-05 the murmuration at dusk from 90 and 180 m: the dark-blob share
//   R56-10 Very Low in the ring (/raum ring): luma mean, sd
//   TAG=before DIST=file://…/.tmp_tests/base/dist/index.html (the base) · TAG=after (this build)
//   nohup bash test/wt_run.sh polish6.mjs 3600 > .tmp_tests/polish6.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '');
const TAG = process.env.TAG || 'after';
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html';
const SHOTS = ROOT + '/test/shots/';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, want = (s) => !ONLY || ONLY.includes(s);
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + ' (' + secs() + ')'); };
const OUT = { tag: TAG };
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/polish6_' + TAG + '.json', JSON.stringify(OUT, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const AFTER = TAG === 'after';
// a picture's statistics (python: luma mean / sd, mean HSV saturation in a box, the dark-blob share in a box)
const stats = (file, box) => { try { return JSON.parse(execFileSync('python3', ['-c', `
import sys, json
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB'); W, H = im.size
b = json.loads(sys.argv[2]) if sys.argv[2] != 'null' else [0, 0, 1, 1]
b = [int(b[0] * W), int(b[1] * H), int(b[2] * W), int(b[3] * H)]
px = list(im.crop(b).getdata()); n = len(px)
L = [0.299 * r + 0.587 * g + 0.114 * bb for r, g, bb in px]
m = sum(L) / n; sd = (sum((x - m) ** 2 for x in L) / n) ** 0.5
S = [(max(p) - min(p)) / max(p) for p in px if max(p) > 50]
dark = sum(1 for x in L if x < 45) / n
print(json.dumps({'mean': round(m, 1), 'sd': round(sd, 1), 'sat': round(sum(S) / max(1, len(S)), 3), 'dark': round(dark, 4)}))
`, file, JSON.stringify(box || null)]).toString()); } catch (e) { return { err: String(e.message).slice(0, 120) }; } };

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const logs = [];
const open = async (dist) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  const page = await ctx.newPage();
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 300)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 800)));
  await page.goto(dist || DIST);
  for (let i = 0; i < 240; i++) { await page.waitForTimeout(500); if (await page.evaluate(() => window.VR && VR.game && VR.game.state === 'title').catch(() => false)) break; }
  return { ctx, page, ev: (fn, a) => page.evaluate(fn, a), wait: (ms) => page.waitForTimeout(ms) };
};

// ---------------------------------------------------------------- 1 · the first 60 s of a new world (as critic_ux: the UI's
// create dialog, seed 4242, a fresh browser profile). Under SwiftShader the game's clock hardly moves in real time, so the
// game is stepped (no rendering) to 45 s and 60 s of its own time and pictured there. SPAWN_BASE=<dist url>: the base
// build pictured the same way in this run (TAG base)
const spawn = async (dist, tag) => {
  const A = await open(dist), { page, ev, wait } = A;
  await page.click('#title [data-act="newworld"]').catch(() => {});
  await wait(1500);
  await ev(() => { const s = document.getElementById('cw_seed'); if (s) { s.value = '4242'; s.dispatchEvent(new Event('input')); } }).catch(() => {});
  await page.click('#create .btn.primary').catch(() => {});
  await wait(2000);
  if (await ev(() => VR.game.state) === 'title') await page.click('#title .tile[data-tile="play"]').catch(() => {});
  for (let i = 0; i < 600; i++) { await wait(500); if (await ev(() => VR.game.state === 'play').catch(() => false)) break; }
  check(await ev(() => VR.game.state === 'play'), 'R56-18 ' + tag + ': a new world (seed 4242) in play');
  await page.mouse.move(640, 360); await page.mouse.move(900, 330, { steps: 10 });
  const t0 = await ev(() => { window.requestAnimationFrame = () => 0; return VR.game.time || 0; });
  const S = { way: [], drawn: [], home: '' };
  // step the game to its own second s (no rendering), noting each game second Funke's ribbon (drawn) and the drone
  const until = async (s) => {
    for (let k = 0; k < 4000; k++) {
      const r = await ev(([t0, s]) => { const g = VR.game, f = g.funke, F = VR.Funke, out = []; let d0 = F && F.cost ? F.cost.draws : 0;
        for (let i = 0; i < 15; i++) { g.last = performance.now() - 33; window.__norender = false; const R = g.renderer; if (!R._r6) { R._r6 = R.render; R.render = function (F) { if (window.__nr6) { this.setupCamera(F.cam); return; } return this._r6(F); }; } window.__nr6 = true; g.loop(performance.now()); window.__nr6 = false; }
        const t = (g.time || 0) - t0; const way = !!(f && f.wayT > 0 && !(f.quietNow && f.quietNow()));
        return { t, way, home: (document.body.innerText.match(/⌂\s*([^\n]*?\d+\s*m)/) || [])[1] || '' }; }, [t0, s]);
      if (r.way) S.way.push(Math.round(r.t)); if (r.home) S.home = r.home;
      if (r.t >= s) return r.t;
      await wait(2);
    }
    return -1;
  };
  const shot = async (s, name) => { const t = await until(s); await ev(() => { const g = VR.game; window.__nr6 = false; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } }); await page.screenshot({ path: SHOTS + name, timeout: 120000 }).catch(() => {}); console.log('  📷 ' + name + ' at ' + t.toFixed(1) + ' s'); return SHOTS + name; };
  OUT['t45_' + tag] = await shot(45, `p6_t45_${tag}.png`);
  OUT['t60_' + tag] = await shot(60, `p6_t60_${tag}.png`);
  const st = await ev(() => { const g = VR.game, f = g.funke, h = g.player.inv.held, F = VR.Funke, e = g.player.eyePos(); return { held: h ? h.id : null, funkeD: f && f.pos ? +Math.hypot(f.pos[0] - e[0], f.pos[1] - e[1], f.pos[2] - e[2]).toFixed(2) : null, visible: f ? !!f.visible : null, quiet: f && f.quietNow ? f.quietNow() : null, fresh: f ? f.fresh : null, story: g.story && g.story.beat ? g.story.beat.id : null }; }).catch(e => ({ err: String(e.message) }));
  OUT['spawn_' + tag] = Object.assign(S, st);
  OUT['hand_' + tag] = stats(OUT['t60_' + tag], [840 / 1280, 560 / 720, 990 / 1280, 700 / 720]);
  console.log('  spawn ' + tag + ' ' + JSON.stringify(OUT['spawn_' + tag]) + ' · hand ' + JSON.stringify(OUT['hand_' + tag]));
  save();
  await A.ctx.close();
  return OUT['spawn_' + tag];
};
if (want('spawn')) {
  if (process.env.SPAWN_BASE) await spawn(process.env.SPAWN_BASE, 'base');
  const sp = await spawn(DIST, TAG);
  if (AFTER) {
    check(!sp.way.some(t => t < 75), 'R56-18: no way ribbon drawn in the first 75 s (' + sp.way.join(',') + ')');
    check(/Palmenhafen/.test(sp.home), 'R56-14: the minimap says „' + sp.home + '"');
    check(OUT.hand_after.sat <= 0.55 || (OUT.hand_base && OUT.hand_after.sat <= OUT.hand_base.sat * 0.85), 'R56-13: the held block\'s saturation ' + OUT.hand_after.sat + ' ≤ 0.55 (base ' + (OUT.hand_base && OUT.hand_base.sat) + ')');
  }
}

// the world part (TAG's build; BASE=<dist url>: the flock and the ring on the base build first, in this run)
const worldRun = async (dist, tag, parts) => {
// ---------------------------------------------------------------- the seasons' village world (seasons.mjs's)
const A = await open(dist), { page, ev, wait } = A;
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(3); } };
const settle = async (max = 50) => {
  for (let i = 0; i < max; i++) {
    await step(20, 16);
    const s = await ev(() => { const g = VR.game, w = g.world; if (!w || g.state !== 'play') return { ok: false }; let dirty = 0; for (const c of w.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { ok: g.pool.busy === 0 && w.pending.size === 0 && dirty === 0 }; });
    if (s.ok && i > 2) break;
    await wait(30);
  }
};
const grab = async (name, frames = 4) => {
  const url = await ev((frames) => { try { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; } catch (e) { window.__norender = true; return null; } }, frames);
  if (url && url.length > 2000) { fs.writeFileSync(SHOTS + name, Buffer.from(url.split(',')[1], 'base64')); console.log('  📷 ' + name); return SHOTS + name; }
  console.log('  !! no picture ' + name); return null;
};
const lookAt = (P) => ev((P) => { const p = VR.game.player, e = p.eyePos(), dx = P[0] - e[0], dy = P[1] - e[1], dz = P[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw; }, P);
const preset = (pr) => ev((pr) => { const g = VR.game; g.applyPreset(pr); g.settings.dynRes = false; g.settings.renderDist = 7; g.applySettings('*'); }, pr);
await preset('balanced');
await ev(`VR.game.createWorld({name:'Politur',mode:'creative',difficulty:'peaceful',type:'default',seed:'424242',cheats:true,kit:true})`);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a creative world (seed 424242)');
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(4200); g.hideHud = true; });
await settle(30); await step(40, 33);

// ---------------------------------------------------------------- 3 · R56-05: the murmuration at dusk, from 90 and 180 m
if (parts.includes('flock')) {
  await preset('balanced'); await settle(10);
  await ev(() => { const g = VR.game; g.env.day = 4; g.env.setTime(12100); const w = g.wild; if (w) { w.age = 1000; w.fresh = false; } });
  let m = null;
  for (let i = 0; i < 30 && !m; i++) { await step(20, 50); m = await ev(() => { const r = VR.game.wild && VR.game.wild.report(); return r && r.murm && r.murm.state === 'fly' ? r.murm : null; }); }
  OUT.murm = m;
  check(!!m, 'the murmuration flies at dusk ' + JSON.stringify(m && { n: m.n, ctr: m.ctr }));
  OUT['flock_' + tag] = {}; OUT.flock = OUT['flock_' + tag];
  if (m) for (const D of [90, 180]) {
    const c = m.ctr;
    await ev(([c, D]) => { const p = VR.game.player; p.flying = true; p.noclip = true; const W = VR.game.world; let y = 0; for (let k = 200; k > 0; k--) if (W.getBlock(Math.floor(c[0] + D), k, Math.floor(c[2]))) { y = k; break; } p.teleport(c[0] + D, Math.max(y + 3, c[1] - 12), c[2]); }, [c, D]);
    await settle(8); await step(10, 33);
    const c2 = await ev(() => VR.game.wild.report().murm.ctr);
    await lookAt([c2[0], c2[1] + 2, c2[2]]); await step(4, 33);
    const f = await grab(`p6_flock${D}_${tag}.png`, 4);
    OUT.flock[D] = f ? stats(f, [0.2, 0.1, 0.8, 0.6]) : null;
    // the same view without the birds: the dark share the flock adds
    await ev(() => { VR.game.settings.wildBirds = false; }); await step(2, 33);
    const f0 = await grab(`p6_flock${D}_none_${tag}.png`, 4);
    await ev(() => { VR.game.settings.wildBirds = true; }); await step(2, 33);
    if (f0) { OUT.flock[D].none = stats(f0, [0.2, 0.1, 0.8, 0.6]); OUT.flock[D].blob = +(OUT.flock[D].dark - OUT.flock[D].none.dark).toFixed(4); }
    console.log('  flock ' + D + ' m ' + JSON.stringify(OUT.flock[D]));
  }
  if (tag === 'after' && OUT.flock[180]) check(OUT.flock[90].blob < 0.005 && OUT.flock[180].blob < 0.005, `R56-05: the dusk flock adds no dark blob (dark share ${OUT.flock[90].blob} · ${OUT.flock[180].blob} < 0.005)`);
  save();
}

// ---------------------------------------------------------------- 2 · R56-01: Very Low, the winter light night
if (parts.includes('cost')) {
  // (seasons.mjs's village: a meadow, cherry, taiga, savanna or jungle one — its festival decor stands on the plaza)
  let vil = null;
  for (let k = 0; k < 9 && !vil; k++) {
    vil = await ev((k) => { const t = VR.Seasons.Fest.debug.today(); return t && t.plaza && (k >= 3 || /^(meadow|cherry|taiga|savanna|jungle)$/.test(t.style || '')) ? t : null; }, k);
    if (vil) break;
    const kn = await ev((k) => { const g = VR.game, V = g.villages, p = g.player.pos; const L = [...V.known.values()].filter(v => v.plan && v.plan.plaza && !v.plan.mine && (k >= 3 || /^(meadow|cherry|taiga|savanna|jungle)$/.test(v.plan.style || ''))).map(v => ({ x: v.plan.plaza.x, y: v.plan.plaza.y, z: v.plan.plaza.z, d: Math.hypot(v.plan.plaza.x - p[0], v.plan.plaza.z - p[2]) })).sort((a, b) => a.d - b.d); return L[0] || null; }, k);
    if (kn) await ev((v) => { const p = VR.game.player; p.flying = true; p.teleport(v.x + 6.5, v.y + 6, v.z + 6.5); }, kn);
    else await ev((k) => { const p = VR.game.player; p.flying = true; p.teleport(p.pos[0] + 160 * Math.cos(k * 2.4), 120, p.pos[2] + 160 * Math.sin(k * 2.4)); }, k);
    await settle(12); await step(40, 33);
  }
  check(!!vil, 'a village: ' + (vil && vil.vil));
  if (vil) {
    const pz = vil.plaza, a = 1.05, R0 = (pz.r || 4) + 1, e = [pz.x + 0.5 + Math.cos(a) * R0, pz.y + 7, pz.z + 0.5 + Math.sin(a) * R0];
    await ev(([d, t]) => { const g = VR.game; g.env.day = d; g.env.setTime(t); VR.Seasons.Fest.debug.reset(); }, [11, 13900]);
    await ev((e) => { const p = VR.game.player; p.flying = true; p.teleport(e[0], e[1], e[2]); }, e);
    await settle(8); await lookAt([pz.x + 0.5, pz.y + 1, pz.z + 0.5]); await step(20, 33);
    OUT.fest = await ev(() => VR.Seasons.Fest.debug.today());
    const cost = {};
    // off · on · deco (on, the festival's models drawn as before f-polish6: ssDraw with the tier read as Low)
    const MODES = ['off', 'on', 'deco'];
    for (const pr of (process.env.NO_HIGH ? ['potato'] : ['potato', 'high'])) {
      await preset(pr); await settle(12);
      for (let round = 0; round < (pr === 'potato' ? 4 : 1); round++) for (const mode of (pr === 'potato' ? (round % 2 ? MODES.slice().reverse() : MODES) : ['off', 'on'])) {
        const r = await ev((mode) => {
          const g = VR.game, S = VR.Seasons, V = g.villages, R = g.renderer;
          g.settings.seasons = mode !== 'off';
          const P0 = Object.getPrototypeOf(V).ssDraw, LK = VR.LifeKit;
          V.ssDraw = mode === 'deco' ? function () { const t = LK.tierOf; LK.tierOf = () => 1; try { return P0.apply(this, arguments); } finally { LK.tierOf = t; } } : P0;
          window.__norender = false;
          for (let i = 0; i < 6; i++) { g.last = performance.now() - 33; g.loop(performance.now()); }
          for (let i = 0; i < 20; i++) { g.last = performance.now() - 33; g.loop(performance.now()); }
          R.gl.finish();
          const ms = []; let draws = 0;
          for (let i = 0; i < 16; i++) { const t = performance.now(); g.last = t - 33; g.loop(t); R.gl.finish(); ms.push(performance.now() - t); draws = R.stats.draws; }
          const models = VR.Seasons.Fest.debug.cost().models;
          V.ssDraw = Object.getPrototypeOf(V).ssDraw;
          window.__norender = true; ms.sort((a, b) => a - b);
          return { ms: +ms[8].toFixed(1), draws, models: mode === 'off' ? 0 : models };
        }, mode);
        (cost[pr + '_' + mode] || (cost[pr + '_' + mode] = [])).push(r);
      }
      console.log('  cost ' + pr + ' ' + JSON.stringify(Object.fromEntries(Object.entries(cost).filter(([k]) => k.startsWith(pr)))));
      if (pr === 'potato') { await ev(() => { VR.game.settings.seasons = true; }); await step(6, 33); OUT.vlNight = await grab(`p6_vl_night_${tag}.png`, 6); }
    }
    const best = (k) => cost[k] ? Math.min(...cost[k].map(x => x.ms)) : null;
    OUT['cost_' + tag] = OUT.cost = { raw: cost, best: Object.fromEntries(Object.keys(cost).map(k => [k, best(k)])) };
    console.log('  best ' + JSON.stringify(OUT.cost.best));
    if (tag === 'after') check(best('potato_on') <= best('potato_off') * 1.1 + 0.5, `R56-01: Very Low winter light night: on ${best('potato_on')} ms ≤ off ${best('potato_off')} ms × 1.1 + 0.5`);
  }
  await ev(() => { VR.game.settings.seasons = true; });
  save();
}

// ---------------------------------------------------------------- 4 · R56-10: Very Low in the ring
if (parts.includes('ring')) {
  await preset('potato'); await settle(10);
  await ev(() => { const g = VR.game; g.hideHud = true; g.env.day = 2; g.env.ticks = 6000; if (VR.Fields) VR.Fields.fixH = 2; g.chat('/raum ring'); });
  const t1 = Date.now();
  for (let i = 0; i < 400; i++) {
    await step(3);
    const st = await ev(() => { const g = VR.game, SS = VR.SpaceScene, need = (SS && SS.cur_need) || []; return g.space ? { ready: g.space.ready, frames: g.space.frames, done: need.filter(s => s.done).length, need: need.length } : { closed: true }; });
    if (st.closed || (st.ready && st.done === st.need && st.frames >= 3)) break;
    if (Date.now() - t1 > 300000) break;
    await wait(40);
  }
  const f = await grab(`p6_vl_ring_${tag}.png`, 3);
  OUT.ring = OUT['ring_' + tag] = f ? stats(f) : null;
  if (tag === 'after') { OUT.ringSweep = {}; for (const k of [0.35, 0.8]) { await ev((k) => { VR.Fields.__l0 = VR.Fields.__l0 || VR.Fields.VL_LIFT; VR.Fields.VL_LIFT = k; }, k); const f2 = await grab(`p6_vl_ring_${tag}_${k}.png`, 3); OUT.ringSweep[k] = f2 ? stats(f2) : null; } await ev(() => { VR.Fields.VL_LIFT = VR.Fields.__l0; }); console.log('  ring sweep ' + JSON.stringify(OUT.ringSweep)); }
  OUT.ringStats = await ev(() => VR.Fields && VR.Fields.stats ? Object.assign({}, VR.Fields.stats) : null).catch(() => null);
  console.log('  ring ' + JSON.stringify(OUT.ring) + ' ' + JSON.stringify(OUT.ringStats));
  if (tag === 'after') check(OUT.ring && OUT.ring.sd > 25, 'R56-10: Very Low ring luma sd ' + (OUT.ring && OUT.ring.sd) + ' > 25');
  save();
}

  await A.ctx.close();
};
if (process.env.BASE) await worldRun(process.env.BASE, 'base', ['flock', 'ring']);
await worldRun(DIST, TAG, ['flock', 'cost', 'ring'].filter(want));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
check(!logs.some(l => /pageerror|Shader|compile|Link failed/i.test(l)), 'no page or shader errors');
save();
await browser.close();
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
