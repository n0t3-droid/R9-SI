// f-polish in the browser (docs/superpowers/plans/2026-10-31-f-polish.md): every loose end before | after in one page —
// the base's look by VR.Polish.off[key] = true, then ours. A new default world (seed 4242, creative, Friedlich), 960 × 540,
// de-DE, High.
//   boss   the Kernfeuer's boss from 60 m (hull) and the arena's cracks from above (cracks)  → polish_hull_*, polish_cracks_*
//   build  a little house copied with the wand: the stamp's ghost (ghost); three blocks' pops 0.05 s old (pop)
//   port   Herzwelt's ferry port: where a-life's search found nothing, ours a site → the port founded (port)
//   lava   /dim zinn: the Glutsee's shore at night (lava)
//   exo    a world of another star with air, by day (exo)
//   cost   the frame at the spawn on Very Low and High, every switch off | on (ms, draws)
//   → test/shots/polish_*_{before,after}.png, .tmp_tests/polish_run.json, test/shots/polish_sheet_run.jpg
//   nohup bash test/wt_run.sh polish.mjs 3600 > .tmp_tests/polish.log 2>&1 &      ONLY=boss,build,port,lava,exo,cost
// regress: skip  (a showcase with pictures; the gate is test/polish.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html';
const SHOTS = ROOT + '/test/shots/';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, want = (s) => !ONLY || ONLY.includes(s);
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + ' (' + secs() + ')'); };
const run = {};
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/polish_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto(DIST);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { if (VR.Foes) VR.Foes.hp = 20; g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(3); } };
const settle = async (max = 50) => {
  let s = null;
  for (let i = 0; i < max; i++) {
    await step(20, 16);
    s = await ev(() => { const g = VR.game, w = g.world, p = g.player; if (!w || !p || g.state !== 'play') return { state: g.state }; const rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if (sc.dirty || sc.pending) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= rd * rd) dirty += n; } return { state: g.state, busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0 }; });
    if (s.state === 'play' && s.busy === 0 && s.pend === 0 && s.dirty === 0 && s.up === 0 && i > 2) break;
    await wait(30);
  }
  return s;
};
// one frame drawn and read back in the same task (keep: the pops' and the ghost's state as set)
const grab = async (name, frames = 3, keep) => {
  const url = await ev(([frames, keep]) => { try { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { if (keep) window.__keep && window.__keep(); g.last = performance.now() - (keep ? 1 : 33); g.loop(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; } catch (e) { window.__norender = true; return 'ERR ' + e.message; } }, [frames, !!keep]);
  if (url && url.length > 2000) { fs.writeFileSync(SHOTS + name, Buffer.from(url.split(',')[1], 'base64')); console.log('  📷 ' + name); return SHOTS + name; }
  console.log('  !! no picture ' + name + ' ' + String(url).slice(0, 120)); return null;
};
const off = (keys, v) => ev(([keys, v]) => { const P = VR.Polish || (VR.Polish = { off: {} }); for (const k of keys) P.off[k] = v; }, [keys, v]);
const aim = (t) => ev((t) => { const p = VR.game.player, e = [p.pos[0], p.pos[1] + 1.62, p.pos[2]], dx = t[0] - e[0], dy = t[1] - e[1], dz = t[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.viewYaw = p.yaw; p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }, t);
const tp = (x, y, z) => ev(([x, y, z]) => { const p = VR.game.player; p.flying = true; p.teleport(x, y, z); p.vel[0] = p.vel[1] = p.vel[2] = 0; }, [x, y, z]);
const rows = [];
const pair = async (label, name, keys, setup, frames = 3, keepFn) => {
  const r = {};
  for (const mode of ['before', 'after']) {
    await off(keys, mode === 'before');
    if (setup) await setup(mode);
    r[mode] = await grab(`polish_${name}_${mode}.png`, frames, keepFn);
  }
  await off(keys, false);
  if (r.before && r.after) rows.push({ label, imgs: [r.before, r.after] });
  return r;
};
const section = async (tag, fn) => { if (!want(tag)) return; console.log('— ' + tag + ' (' + secs() + ')'); try { await fn(); } catch (e) { fails++; console.log('  ✗ section ' + tag + ' stopped: ' + (e.stack || e.message).slice(0, 900)); } save(); };

for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.tsr = false; g.settings.renderDist = 6; g.applySettings('*'); if (VR.Hints) for (const h of ['play', 'move', 'fly']) VR.Hints.done(h); });
await ev(`VR.game.createWorld({name:'Feinschliff',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:false})`);
for (let i = 0; i < 200; i++) { await wait(500); if (await ev(() => VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)) break; }
check(await ev(() => VR.game.state) === 'play', 'the world is open');
await ev(() => {
  const g = VR.game; window.requestAnimationFrame = () => 0;
  g.zenFreezeWeather = true; g.zenFreezeTime = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.rain = 0; g.env.rainTarget = 0;
  const st = document.createElement('style'); st.textContent = '#hints,#lockhint,#toasts,.toast,#uxkeys,#ctxprompt,#ctxring,#advup,#rpgfind,#funkebub{display:none !important}'; document.head.appendChild(st);
  g.hideHud = false;
});
await settle(60);
const spawn = await ev(() => VR.game.player.pos.map(v => Math.round(v * 10) / 10));
run.spawn = spawn;

// ---------------------------------------------------------------- the frame: Very Low and High, the switches off | on
await section('cost', async () => {
  const C = {};
  for (const pr of ['potato', 'high']) {
    await ev((pr) => { const g = VR.game; g.applyPreset(pr); g.settings.dynRes = false; g.settings.tsr = false; g.settings.renderDist = 6; g.applySettings('*'); }, pr);
    await settle(30); await step(20);
    await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 12; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; });   // (warm: the programs built)
    const acc = { before: [], after: [] }; let draws = {};
    for (const mode of ['before', 'after', 'after', 'before', 'before', 'after']) {
      await off(['port', 'hull', 'cracks', 'lava', 'exo', 'ghost', 'pop', 'swarm'], mode === 'before');
      const r = await ev(() => { const g = VR.game, gl = g.renderer.gl, ms = []; window.__norender = false; for (let i = 0; i < 7; i++) { const t0 = performance.now(); g.last = t0 - 33; g.loop(t0); gl.finish(); ms.push(performance.now() - t0); } window.__norender = true; return { ms, draws: g.renderer.stats.draws | 0 }; });
      acc[mode].push(...r.ms); draws[mode] = r.draws;
    }
    for (const mode of ['before', 'after']) { const a = acc[mode].sort((x, y) => x - y); C[pr + '_' + mode] = { ms: +a[a.length >> 1].toFixed(1), draws: draws[mode] }; }
  }
  await off(['port', 'hull', 'cracks', 'lava', 'exo', 'ghost', 'pop', 'swarm'], false);
  await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.tsr = false; g.settings.renderDist = 6; g.applySettings('*'); }); await settle(30);
  run.cost = C; console.log('  ' + JSON.stringify(C));
  check(C.potato_after.draws === C.potato_before.draws, `Very Low: the same draws (${C.potato_before.draws} | ${C.potato_after.draws}), ${C.potato_before.ms} | ${C.potato_after.ms} ms`);
});

// ---------------------------------------------------------------- the boss: hull from 60 m, the cracks
await section('boss', async () => {
  const reg = await ev(() => {
    const g = VR.game, A = VR.Adventure; A.setOn(true); A.setEnc('normal');
    const rec = A.rec, R = VR.RPG, S = R.BAL.REGION, p = g.player.pos;
    const rx = Math.floor(p[0] / S) * S, rz = Math.floor(p[2] / S) * S, cl = (v, a) => Math.min(a + S - 60, Math.max(a + 60, v));
    rec.sites = rec.sites || {}; rec.freed = rec.freed || {};
    const put = (id, dx, dz, free) => { const x = Math.round(cl(p[0] + dx, rx)), z = Math.round(cl(p[2] + dz, rz)); if (free) rec.freed[id] = { day: 1, as: 'trade', x, y: 70, z, b: null, t: Date.now() }; else rec.sites[id] = { x, y: 70, z, dir: 0, n: 3, res: 0, cal: 0, st: 'stoer', day: null, t: 0 }; };
    put('t_f1', 150, 40, true); put('t_f2', -110, 150, true); put('t_k1', 260, -220, false); put('t_k2', -330, -160, false);
    const C = R.conquest(VR.RPGame.sites(), VR.RPGame.st()), r = C.regions.find(q => q.boss === 'ready');
    return r ? { id: r.id, core: r.core } : null;
  });
  check(!!reg, 'a Kernfeuer waits ' + JSON.stringify(reg)); if (!reg) return;
  const c = reg.core;
  await ev((c) => { const p = VR.game.player; p.flying = true; p.safeTeleport(c[0] + 0.5, 140, c[1] + 40.5); }, c);
  for (let i = 0; i < 120; i++) { await step(10); await wait(150); if (await ev((c) => VR.game.world.isLoaded(c[0], c[1]) && VR.game.world.isLoaded(c[0], c[1] + 40) && VR.game.world.isLoaded(c[0] + 20, c[1] - 20) && !VR.game.player.hold, c)) break; }
  await ev((c) => { const g = VR.game, p = g.player, y = g.world.topAt(c[0], c[1] + 30) + 1; p.flying = false; p.teleport(c[0] + 0.5, y, c[1] + 30.5); g.env.setTime(5200); }, c);
  let arena = false; for (let i = 0; i < 40 && !arena; i++) { await step(5); arena = await ev(() => !!(VR.RPGBoss2.arena && VR.RPGBoss2.arena.ys && VR.RPGBoss2.arena.crk)); }
  check(arena, 'the arena stands (its ground read, the cracks laid)');
  await ev(() => VR.RPGBoss.look());
  let up = false; for (let i = 0; i < 40 && !up; i++) { await step(5); up = await ev(() => !!VR.RPGBoss.cur); }
  check(up, 'the boss rises');
  await step(200);   // (the entrance's camera hands back)
  await settle(20);
  // from 60 m on the side the player came from, a little above
  const P60 = await ev(() => { const g = VR.game, A = VR.RPGBoss2.arena, m = VR.RPGBoss.cur.m, cx = A ? A.x : m.pos[0] - 9, cz = A ? A.z : m.pos[2]; let dx = m.pos[0] - cx, dz = m.pos[2] - cz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; const ax = -dz, az = dx, x = m.pos[0] + (dx * 0.5 + ax * 0.87) * 60, z = m.pos[2] + (dz * 0.5 + az * 0.87) * 60; window.__bossAt = { p: m.pos.slice(), yaw: m.yaw }; return { x, z, y: Math.max(g.world.topAt(Math.floor(x), Math.floor(z)) + 3, m.pos[1] + 6), t: [m.pos[0], m.pos[1] + 4, m.pos[2]] }; });
  await ev(() => { const p = VR.game.player; p.inv.slots[p.inv.sel] = null; p.inv.changed = true; });
  // (only the boss: the drones and the helpers out of the picture; a 38° view so 60 m reads)
  await ev(() => { const g = VR.game, b = VR.RPGBoss.cur.m; for (let i = g.entities.mobs.length - 1; i >= 0; i--) if (g.entities.mobs[i] !== b) g.entities.mobs.splice(i, 1); window.__fov0 = g.settings.fov; g.settings.fov = 38; });
  await pair('Turmgänger aus 60 m: dunkler Unterrumpf, glühender Rand (vorher | nachher)', 'hull', ['hull'], async () => {
    await ev(() => { const g = VR.game, b = VR.RPGBoss.cur.m; for (let i = g.entities.mobs.length - 1; i >= 0; i--) if (g.entities.mobs[i] !== b) g.entities.mobs.splice(i, 1); });
    await tp(P60.x, P60.y, P60.z); await aim(P60.t); await step(2);
    await ev(() => { const B = VR.RPGBoss.cur, a = window.__bossAt; if (B && a) { B.m.pos[0] = a.p[0]; B.m.pos[1] = a.p[1]; B.m.pos[2] = a.p[2]; B.m.yaw = a.yaw; } });
  }, 1);
  await ev(() => { VR.game.settings.fov = window.__fov0 || 75; });
  // the cracks from 13 m above, 9 m off the obelisk
  const pc = await ev(() => { const A = VR.RPGBoss2.arena; return { x: A.x + 2, z: A.z + 12, y: A.y + 13, t: [A.x - 1, A.y, A.z - 2] }; });
  // a one-block step across half the ring (the arena's ground was flat here; a-boss2's pictures had hills)
  await ev(() => { const g = VR.game, A = VR.RPGBoss2.arena, w = g.world, gs = VR.R.byName.grass_block.defaultState; for (let x = Math.floor(A.x) - 12; x <= Math.floor(A.x) + 12; x++) for (let z = Math.floor(A.z) + 2; z <= Math.floor(A.z) + 12; z++) { const d = Math.hypot(x + 0.5 - A.x, z + 0.5 - A.z); if (d < 5.5 || d > 12 || ((x + z) & 7) === 0 && d > 9) continue; const t = w.topAt(x, z); w.setBlock(x, t + 1, z, gs, 4); } });
  await settle(20);
  await pair('Risse im Boden: keine Streifen mehr über Stufen (vorher | nachher)', 'cracks', ['cracks'], async () => {
    await ev(() => { VR.RPGBoss2.buildCracks(VR.game, VR.RPGBoss2.arena); });
    await tp(pc.x, pc.y, pc.z); await aim(pc.t); await step(2);
  });
  run.boss = await ev(() => ({ cracks: VR.RPGBoss2.arena && VR.RPGBoss2.arena.crk && VR.RPGBoss2.arena.crk.v.length / 30 }));
  await ev(() => { if (VR.RPGBoss.cur) VR.RPGBoss.drop(VR.game); VR.Adventure.setOn(false); });
});

// ---------------------------------------------------------------- building: the ghost's edges, the pop's rim
await section('build', async () => {
  await tp(spawn[0], spawn[1] + 2, spawn[2]); await settle(30);
  const base = await ev(() => { const g = VR.game, w = g.world, p = g.player, X = Math.floor(p.pos[0]) + 4, Z = Math.floor(p.pos[2]) - 6; let y = 200; while (y > 1 && !(VR.R.T.flags[w.getBlock(X, y - 1, Z)] & VR.F.SOLID)) y--; return { X, Y: y + 6, Z }; });
  // a little house on a stone floor in the air (clear of the trees): planks, glass, a slab roof
  const H = { x0: base.X, z0: base.Z, Y: base.Y };
  await ev((H) => {
    const g = VR.game, set = (x, y, z, n, pr) => { const t = VR.R.byName[n]; let s = t.defaultState; for (const k in pr || {}) s = t.with(s, k, pr[k]); g.world.setBlock(x, y, z, s, 4); };
    for (let x = -1; x < 6; x++) for (let z = -1; z < 6; z++) set(H.x0 + x, H.Y - 1, H.z0 + z, 'stone_bricks');
    for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++) for (let y = 0; y < 3; y++) if (x === 0 || x === 4 || z === 0 || z === 4) set(H.x0 + x, H.Y + y, H.z0 + z, y === 1 && (x === 2 || z === 2) ? 'glass' : 'oak_planks');
    for (let x = -1; x < 6; x++) for (let z = -1; z < 6; z++) set(H.x0 + x, H.Y + 3, H.z0 + z, 'oak_slab');
    const gad = g.gadgets; gad.wand.a = [H.x0 - 1, H.Y - 1, H.z0 - 1]; gad.wand.b = [H.x0 + 5, H.Y + 3, H.z0 + 5]; gad.wandCopy();
    const p = g.player; p.inv.slots[p.inv.sel] = { id: 'builder_wand', n: 1 }; p.inv.changed = true;
  }, H);
  await settle(30);
  // look at a free spot beside the house (the ghost goes where V would stamp)
  await tp(H.x0 - 8.5, H.Y + 4, H.z0 + 10.5); await aim([H.x0 - 8.5, H.Y - 1, H.z0 + 2.5]); await step(3); await settle(20);
  const gh = await pair('Bauplan-Geist: Kanten als Linien (vorher | nachher)', 'ghost', ['ghost'], async () => { await step(2); });
  const st = await ev(() => ({ ghost: VR.game.renderer.stats.ghost | 0, edges: VR.game.renderer.stats.ghostEdges | 0, clip: (() => { const c = VR.game.gadgets.wand.clip; return c && [c.sx, c.sy, c.sz]; })() }));
  run.ghost = st; check(st.ghost > 50 && st.edges > 20, 'the ghost drawn with its edges ' + JSON.stringify(st));
  await ev(() => { const p = VR.game.player; p.inv.slots[p.inv.sel] = null; p.inv.changed = true; VR.game.gadgets.wand.clip = null; });
  // three pops on the floor's edge, 0.05 s old, the camera 3.5 m off
  const pb = { x: H.x0 + 1, y: H.Y + 4, z: H.z0 + 7 };
  await ev((pb) => { const g = VR.game, set = (x, y, z, n) => g.world.setBlock(x, y, z, VR.R.byName[n].defaultState, 4); for (let x = -2; x < 5; x++) set(pb.x + x, pb.y - 1, pb.z, 'stone_bricks'); }, pb);
  await tp(pb.x + 1.5, pb.y + 0.6, pb.z + 4.2); await aim([pb.x + 1.5, pb.y + 0.3, pb.z + 0.5]); await settle(20);
  await ev((pb) => { window.__keep = () => { const g = VR.game; for (const q of g._bfPops || []) if (q.on) q.t = g.time - 0.05; }; }, pb);
  await pair('Setzen: heller Rand am Pop (vorher | nachher)', 'pop', ['pop'], async () => {
    await ev((pb) => { const g = VR.game, s = VR.R.byName.oak_planks.defaultState; for (let k = 0; k < 3; k++) { g.world.setBlock(pb.x + k, pb.y, pb.z, s, 4); VR.BuildFx.pop(g, pb.x + k, pb.y, pb.z, s); } }, pb);
    await step(1, 1);
  }, 1, true);
  run.pop = await ev(() => ({ pops: VR.game.renderer.stats.pops | 0, rims: VR.game.renderer.stats.popRims | 0 }));
  check(run.pop.rims >= 1, 'the pop\'s rim drawn ' + JSON.stringify(run.pop));
  await ev(() => { window.__keep = null; });
});

// ---------------------------------------------------------------- Herzwelt's ferry port
await section('port', async () => {
  await tp(spawn[0], spawn[1] + 2, spawn[2]); await settle(40);
  const q = await ev(() => { const g = VR.game, Fe = VR.Ferries; VR.Polish.off.port = true; const a = Fe.herzSiteOf(g), sa = Object.assign({}, Fe.stats.herz); VR.Polish.off.port = false; const b = Fe.herzSiteOf(g); return { base: a, baseStats: sa, ours: b, stats: Object.assign({}, Fe.stats.herz) }; });
  run.port = q; console.log('  ' + JSON.stringify(q));
  check(!!q.ours, 'our search finds a place for the port ' + JSON.stringify(q.ours && { x: q.ours.x, y: q.ours.y, z: q.ours.z, how: q.stats.found }));
  if (!q.ours) return;
  const s = q.ours, ux = s.x - spawn[0], uz = s.z - spawn[2], ul = Math.hypot(ux, uz) || 1, cam = [s.x + ux / ul * 42, s.y + 24, s.z + uz / ul * 42], tgt = [s.x - ux / ul * 6, s.y + 1, s.z - uz / ul * 6];
  await ev(() => { const p = VR.game.player; p.noclip = true; p.inv.slots[p.inv.sel] = null; p.inv.changed = true; });
  await off(['port'], true); await tp(...cam); await settle(30); await aim(tgt); await step(2);
  const b = await grab('polish_port_before.png', 3);
  // a moon visited (the port waits for that), then a second of the life's tick: the port founded and its day-0 prefab
  await off(['port'], false);
  await ev(() => { const g = VR.game, m = g.meta; m.life = m.life || { v: 1, sites: {}, docks: {}, pre: {} }; m.life.sites = m.life.sites || {}; if (!Object.keys(m.life.sites).length) m.life.sites.basalt = { x: 0, y: 70, z: 0, day0: 0, id: 'life:basalt:test' }; });
  let hp = null; for (let i = 0; i < 40; i++) { await step(30, 33); hp = await ev(() => { const r = VR.game.meta.life.docks.overworld; return r ? { x: r.x, y: r.y, z: r.z, pre: (VR.game.meta.life.pre.overworld || []).length } : null; }); if (hp && hp.pre >= 1) break; }
  run.portFounded = hp; check(!!hp && hp.pre >= 1, 'the port founded, its first part built ' + JSON.stringify(hp));
  await ev(() => { if (VR.Ferries.age) VR.Ferries.age(VR.game, 3); }); for (let i = 0; i < 10; i++) await step(30, 33);
  await settle(30); await tp(...cam); await aim(tgt); await step(2);
  const a = await grab('polish_port_after.png', 3);
  if (b && a) rows.push({ label: 'Herzwelt: der Fährhafen am Spawn (vorher keiner gefunden | nachher)', imgs: [b, a] });
});

// ---------------------------------------------------------------- Zinnober's Glutsee at night
await section('lava', async () => {
  await ev(() => { window.__lt = VR.Travel.last; VR.Travel.go(VR.game, { dim: 'zinn', via: 'cmd' }); });
  let s = null; for (let i = 0; i < 600; i++) { await step(10, 33); s = await ev(() => { const g = VR.game, L = VR.Travel.last; return { st: g.state, dim: g.dim, ok: !!(L && L !== window.__lt && L.to === 'zinn') }; }); if (s.ok && s.st === 'play') break; await wait(20); }
  check(s && s.dim === 'zinn', 'on Zinnober ' + JSON.stringify(s)); if (!s || s.dim !== 'zinn') return;
  const Z = await ev(() => { const g = new VR.BodyGen(VR.game.meta.seed >>> 0, 'zinn', {}); return { x: g.glut.x, z: g.glut.z, R: g.glut.R }; });
  const tn = await ev(([x, z]) => { const BS = VR.BodySky; let best = 0, bv = 1e9, prev = null; for (let t = 10; t < 9000; t += 10) { const v = BS.compute('zinn', [x, 70, z], t, { tier: 0 }).light.sunEl * 57.3; if (prev !== null && v < prev && Math.abs(v + 40) < bv) { bv = Math.abs(v + 40); best = t; } prev = v; } return best; }, [Z.x, Z.z]);
  const y = await ev(([x, z]) => new VR.BodyGen(VR.game.meta.seed >>> 0, 'zinn', {}).surfaceY(Math.floor(x), Math.floor(z)), [Z.x + Z.R + 22, Z.z + 18]);
  await ev((t) => { const e = VR.game.env, k = Math.round(t * 20); e.day = Math.floor(k / 24000); e.ticks = k - e.day * 24000; }, tn);
  await ev(([x, y, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = Math.atan2(1, 0.15); p.pitch = -0.3; p.vel = [0, 0, 0]; }, [Z.x + Z.R + 22.5, y + 15, Z.z + 18.5]);
  await settle(60); await step(60);
  await pair('Zinnober nachts: die Glut tief orange statt gelbweiß (vorher | nachher)', 'lava', ['lava'], async () => { await step(30); });
  run.lava = { t: tn, at: [Z.x + Z.R + 22, y, Z.z + 18] };
});

// ---------------------------------------------------------------- a world of another star, by day
await section('exo', async () => {
  const w = await ev(() => {
    const g = VR.game, G = VR.Galaxy, E = VR.Exo, N = VR.StarJump.hood(g), L = N.list, d0 = (s) => Math.hypot(...s.p);
    const pick = (fn) => { const out = []; for (const s of L) { if (s.home) continue; const d = G.system(N, s.idx); for (const b of d.bodies) if (b.planet && fn(s, d, b)) out.push({ idx: s.idx, f: b.id, dim: b.dim, base: b.base, d: d0(s), T: s.T, sig: E.signature(d, b) }); } out.sort((a, b) => a.d - b.d); return out[0] || null; };
    return pick((s, d, b) => E.signature(d, b) === 'violet' && b.base === 'aqua') || pick((s, d, b) => b.landable && b.base === 'aqua' && s.T < 3900) || pick((s, d, b) => b.landable && b.base === 'aqua');
  });
  run.exoWorld = w; check(!!w, 'a world with air under another star ' + JSON.stringify(w)); if (!w) return;
  const ok = await ev(([i, f]) => { const g = VR.game; VR.StarJump.enter(g, i, { quiet: true, focus: f }); return VR.StarJump.land(g); }, [w.idx, w.f]);
  let d = null; for (let i = 0; i < 200; i++) { await step(10, 33); d = await ev(() => ({ dim: VR.game.dim, st: VR.game.state, trip: !!(VR.game.travel && VR.game.travel.trip) })); if (d.st === 'play' && d.dim === w.dim && !d.trip) break; await wait(100); }
  check(d && d.dim === w.dim, 'landed on ' + w.dim + ' ' + JSON.stringify({ ok, d })); if (!d || d.dim !== w.dim) return;
  await settle(80);
  const b = await ev(() => {
    const g = VR.game, U = VR.Universe, p = g.player, eye = [p.pos[0], p.pos[1] + 1.6, p.pos[2]]; let best = null;
    for (let day = 1; day < 9; day++) for (let tk = 0; tk < 24000; tk += 150) { const r = VR.BodySky.compute(g.dim, eye, U.worldSeconds(day, tk), {}); if (!r) continue; const el = Math.asin(Math.max(-1, Math.min(1, r.light.sunDir[1]))); if (el < 0.3 || el > 0.7) continue; const sc = Math.abs(el - 0.5); if (!best || sc < best.sc) best = { day, tk, sc, dir: r.light.sunDir }; if (best.sc < 0.02) break; }
    if (best) { g.env.day = best.day; g.env.setTime(best.tk); const p2 = g.player; p2.yaw = p2.viewYaw = Math.atan2(-best.dir[0], -best.dir[2]) + 0.6; p2.pitch = -0.12; p2.flying = true; }
    return best;
  });
  check(!!b, 'a day found ' + JSON.stringify(b && { day: b.day, tk: b.tk }));
  await pair('Welt eines Roten Zwergs am Tag: Belichtung nach dem Himmel des Sterns (vorher | nachher)', 'exo', ['exo'], async () => { await step(240, 33); });
  run.exo = await ev(() => ({ expo: +VR.game.env.E.exposure.toFixed(3) }));
  console.log('  exposure after ' + JSON.stringify(run.exo));
});

save();
try { const spec = ROOT + '/.tmp_tests/polish_sheet.json'; fs.writeFileSync(spec, JSON.stringify({ w: 620, rows })); console.log(execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'polish_sheet_run.jpg', spec]).toString().trim()); } catch (e) { console.log('  (sheet: ' + e.message.slice(0, 200) + ')'); }
const errs = logs.filter(l => !/favicon|DevTools|Autoplay|AudioContext/i.test(l));
if (errs.length) console.log('page logs:\n' + errs.slice(0, 12).join('\n'));
check(!errs.some(l => /pageerror/.test(l)), 'no page errors');
await browser.close();
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
