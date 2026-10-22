// u-home · neues Leben in the browser (docs/superpowers/plans/2026-10-22-u-home.md): Heimkehr timed before / after, the
// story with its pictures, the frame before / after.
//  1 · pages B (BEFORE_DIST — v042 @ 6a3abce, default .tmp_tests/before_src/dist) and A (this build), Balanced, view 8,
//      seed 4242, at Herzwelt's spawn; Heimkehr Driftinseln → Herzwelt timed in turns: B, A (keep on), A (keep off) ×
//      ROUNDS — VR.Travel.last (veil, load, total) and VR.NewLife.lastTrip's phases (start, first column, near generated /
//      meshed / up, play; adopted columns)
//  2 · page A, the story: a shuttle left on Herzwelt's apron; /dim drift; ⏸ → 📍 „Hier wohne ich" (the button) →
//      newlife_pause.png (🏠 Zuhause (Driftinseln) · 🌍 Herzwelt · 📍); 🌍 (the button) → Herzwelt, the compass
//      „🏠 ↑ Driftinseln — zum Schiff" (newlife_compass.png), ⏸ (newlife_pause_herz.png); 🏠 (the button) → the trip
//      home, the shuttle recalled to the home pad (newlife_recall.png); 40 m off and a death → newlife_respawn_drift.png
//      at home; 🌍 → Herzwelt
//  3 · the frame at Herzwelt's spawn in both builds, Very Low and High (rounds in turns: ms, draws, triangles)
//  4 · page A: ⏏ to the title, the worlds: newlife_card.png („Wohnt auf den Driftinseln · zuletzt auf Herzwelt" with the
//      disc), newlife_worlds.png, every world's disc (newlife_discs.png); the sheet newlife_sheet.jpg
//   nohup bash test/wt_run.sh newlife.mjs 4800 > .tmp_tests/newlife.log 2>&1 &
//   ROUNDS=2 · NO_COST=1 · N=8 · SEED=4242 · BEFORE_DIST=file:///…/index.html
// regress: skip  (a showcase with pictures and the time against the build before; the gate is test/newlife.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html';
const BEFORE = process.env.BEFORE_DIST || 'file://' + ROOT + '/.tmp_tests/before_src/dist/index.html';
const SHOTS = ROOT + '/test/shots/';
const SEED = process.env.SEED || '4242', ROUNDS = +(process.env.ROUNDS || 2), N = +(process.env.N || 8);
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const rec = { seed: SEED, heimkehr: [], story: {}, cost: {}, card: null };
const save = () => { try { fs.writeFileSync(SHOTS + 'newlife.json', JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });

// ---------------------------------------------------------------- a page with a world (dims.mjs's machinery)
async function openWorld(dist, preset, rd) {
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
  const settle = async (max = 60, farMax = 30) => {
    let s = null;
    await boost(true);
    for (let i = 0; i < max; i++) {
      await step(20, 16);
      s = await ev(() => { const g = VR.game, w = g.world, p = g.player; if (!w || !p || g.state !== 'play') return { state: g.state }; const rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if (sc.dirty || sc.pending) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= rd * rd) dirty += n; } let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } const h = g.horizon, f = h && h.far, fr = f && f.report ? f.report() : null; return { state: g.state, busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, unshown, hz: h && h.enabled() ? h.inflight : 0, far: fr ? fr.inflight + fr.want : 0, hold: !!p.hold }; });
      const near = s.state === 'play' && s.busy === 0 && s.pend === 0 && s.dirty === 0 && s.up === 0 && s.unshown === 0 && !s.hold;
      s.i = i;
      if (near && i > 2 && ((s.hz === 0 && s.far === 0) || i >= farMax)) break;
      await wait(30);
    }
    await boost(false);
    return s;
  };
  const picture = async (path, frames = 4, clip) => {
    await ev((frames) => { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, frames);
    for (let k = 0; k < 2; k++) {
      try { await page.screenshot(Object.assign({ path, timeout: 150000 }, clip ? { clip } : {})); return true; } catch (e) { console.log(`  !! screenshot ${path.replace(/^.*\//, '')} failed (${String(e.message || e).split('\n')[0].slice(0, 120)})`); }
    }
    return false;
  };
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(([p, rd]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; if (rd) g.settings.renderDist = rd; g.applySettings('*'); }, [preset, rd]);
  await ev(`VR.game.createWorld({name:'Neues Leben',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
  for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  const ok = await ev(() => VR.game.state) === 'play';
  await ev(() => { const g = VR.game; window.__raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.wx.force('klar'); g.env.setTime(6000); if (!document.getElementById('__nohint')) { const st = document.createElement('style'); st.id = '__nohint'; st.textContent = '#hints,#lockhint{display:none !important}'; document.head.appendChild(st); } });
  return { ctx, page, logs, ev, wait, step, settle, picture, ok };
}
// a trip started by `start` (in the page): the frames stepped until the first frame in `to`
async function trip(A, to, start, label) {
  await A.ev(() => { window.__lastTrip = VR.Travel.last; });
  const t0 = Date.now();
  await A.ev(start);
  let s = null;
  for (let i = 0; i < 900; i++) {
    await A.step(10, 33);
    s = await A.ev((to) => { const g = VR.game, L = VR.Travel.last; return { state: g.state, dim: g.dim, busy: VR.Travel.busy(g), arrived: !!(L && L !== window.__lastTrip && L.to === to), last: L, nl: VR.NewLife ? VR.NewLife.lastTrip : null }; }, to);
    if (s.arrived && s.state === 'play') break;
    await A.wait(20);
  }
  s.wallMs = Date.now() - t0;
  console.log(`  trip ${label}: ${JSON.stringify(s.last)} · ${s.wallMs} ms wall (stepped)${s.nl && s.nl.to === to ? ' · phases ' + JSON.stringify(s.nl) : ''} (${secs()})`);
  return s;
}
const click = (A, act) => A.ev((act) => { const b = document.querySelector('#pause [data-act="' + act + '"]'); if (!b) return false; b.click(); return true; }, act);
const pauseRow = (A) => A.ev(() => [...document.querySelectorAll('#pause [data-act="gohome"], #pause [data-act="goherz"], #pause [data-act="sethome"]')].map(b => ({ act: b.dataset.act, text: b.textContent, shown: getComputedStyle(b).display !== 'none' })));
const toSpawn = (A) => A.ev(() => { const g = VR.game, p = g.player, sp = p.spawn; p.flying = false; p.teleport(sp[0], sp[1], sp[2]); p.yaw = Math.PI; p.pitch = -0.05; return sp; });
const median = (a) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; };

// ================================================================ 1 · Heimkehr before / after
const beforeOk = fs.existsSync(BEFORE.replace(/^file:\/\//, ''));
check(beforeOk, `the build before is there (${BEFORE.replace(ROOT, '.')})`);
const B = beforeOk ? await openWorld(BEFORE, 'balanced', 8) : null;
if (B) { check(B.ok, `page B (the build before) has its world (${secs()})`); console.log('  B settled', JSON.stringify(await B.settle(120, 20))); }
const A = await openWorld(DIST, 'balanced', 8);
check(A.ok, `page A (this build) has its world (${secs()})`);
console.log('  A settled', JSON.stringify(await A.settle(120, 20)));
const info = await A.ev(() => { const g = VR.game, p = g.player; return { dim: g.dim, spawn: p.spawn.map(v => +v.toFixed(1)), newlife: !!VR.NewLife, keep: g.settings.homeKeep !== false, workers: g.pool.workers.length }; });
console.log('  A', JSON.stringify(info));
check(info.newlife && info.dim === 'overworld', 'this build has VR.NewLife, the game starts on Herzwelt');
async function heimkehr(Pg, label, keep) {
  if (keep !== undefined) await Pg.ev((k) => { VR.game.settings.homeKeep = k; }, keep);
  await toSpawn(Pg);
  await Pg.settle(60, 8);   // (the ring round the spawn is in when the trip leaves)
  await trip(Pg, 'drift', () => { VR.Travel.go(VR.game, { dim: 'drift', via: 'cmd' }); }, label + ': /dim drift');
  await Pg.settle(40, 4);
  const s = await trip(Pg, 'overworld', () => { VR.game.goHome(); }, label + ': Heimkehr');
  const r = { label, keep, totalMs: s.last && s.last.totalMs, loadMs: s.last && s.last.loadMs, veilMs: s.last && s.last.veilMs, wallMs: s.wallMs, phases: s.nl && s.nl.to === 'overworld' ? s.nl : null, arrived: s.arrived };
  rec.heimkehr.push(r); save();
  await Pg.settle(120, 20);
  return r;
}
const runs = { before: [], on: [], off: [] };
for (let r = 0; r < ROUNDS; r++) {
  if (B) runs.before.push(await heimkehr(B, `round ${r + 1} · before`));
  runs.on.push(await heimkehr(A, `round ${r + 1} · after, keep on`, true));
  runs.off.push(await heimkehr(A, `round ${r + 1} · after, keep off`, false));
}
await A.ev(() => { VR.game.settings.homeKeep = true; });
const mB = median(runs.before.map(x => x.totalMs)), mOn = median(runs.on.map(x => x.totalMs)), mOff = median(runs.off.map(x => x.totalMs));
rec.heimkehrMedian = { before: mB, keepOn: mOn, keepOff: mOff }; save();
console.log('  Heimkehr medians (ms)', JSON.stringify(rec.heimkehrMedian));
check(runs.on.every(x => x.arrived) && runs.off.every(x => x.arrived) && runs.before.every(x => x.arrived), 'every Heimkehr arrived (both builds)');
check(runs.on.every(x => x.phases && x.phases.adopted >= 20), `keep on: the home's columns are adopted (${runs.on.map(x => x.phases && x.phases.adopted).join(', ')})`);
check(runs.off.every(x => x.phases && x.phases.adopted === 0), 'keep off: nothing adopted');
if (B) check(mOn !== null && mB !== null && mOn < mB * 0.5, `Heimkehr with the home kept: ${mOn} ms against ${mB} ms before (×${mB ? (mOn / mB).toFixed(2) : '?'}); keep off ${mOff} ms (×${mB ? (mOff / mB).toFixed(2) : '?'})`);

// ================================================================ 2 · the story (page A)
console.log(`the story (${secs()})`);
const S = rec.story;
// a shuttle left on Herzwelt's apron
await A.ev(() => { const g = VR.game; g.starships.spawn(7777, 'shuttle', null, [0.5, 81, 34.5], 0, null); });
for (let i = 0; i < 120; i++) { await A.step(10, 33); if (await A.ev(() => { const s = VR.game.starships.ships.find(q => q.d.seed === 7777); return !!(s && s.d.meta); })) break; await A.wait(200); }   // (its design built: a ship without one is not in the save yet)
S.shipOnHerz = await A.ev(() => { const s = VR.game.starships.ships.find(q => q.d.seed === 7777); return s ? { pos: s.pos.map(v => +v.toFixed(1)), built: !!s.d.meta } : null; });
check(!!S.shipOnHerz, `a shuttle stands on Herzwelt's apron (${JSON.stringify(S.shipOnHerz)})`);
await trip(A, 'drift', () => { VR.Travel.go(VR.game, { dim: 'drift', via: 'cmd' }); }, 'story: /dim drift');
await A.settle(80, 8);
// in the drift: ⏸ shows „📍 Hier wohne ich"; the button makes the drift the home
await A.ev(() => { const g = VR.game, p = g.player; p.pitch = -0.1; g.env.setTime(6000); g.ui.pause(); });
S.rowDriftBefore = await pauseRow(A);
console.log('  pause in the drift (Herzwelt home)', JSON.stringify(S.rowDriftBefore));
check(S.rowDriftBefore.some(b => b.act === 'sethome' && b.text === '📍 Hier wohne ich') && !S.rowDriftBefore.some(b => b.act === 'goherz' && b.shown), 'in the drift with the home on Herzwelt: „📍 Hier wohne ich", no 🌍 yet');
await A.picture(SHOTS + 'newlife_pause_drift0.png', 3);
check(await click(A, 'sethome'), 'the 📍 button is clicked');
await A.step(4, 33);
S.home = await A.ev(() => { const g = VR.game; return { home: g.meta.universe && g.meta.universe.home, chat: [...document.querySelectorAll('#chatlog div')].slice(-2).map(d => d.textContent) }; });
console.log('  home', JSON.stringify(S.home));
check(S.home.home && S.home.home.dim === 'drift', 'the drift is the home now (meta.universe.home)');
S.rowDrift = await pauseRow(A);
console.log('  pause in the drift (drift home)', JSON.stringify(S.rowDrift));
check(S.rowDrift.some(b => b.act === 'gohome' && b.text === '🏠 Zuhause (Driftinseln)') && S.rowDrift.some(b => b.act === 'goherz' && b.shown && b.text === '🌍 Herzwelt'), 'the pause menu: 🏠 Zuhause (Driftinseln) · 🌍 Herzwelt');
check(await A.picture(SHOTS + 'newlife_pause.png', 3), 'test/shots/newlife_pause.png — the two buttons (in the drift, the new home)');
// 🌍 Herzwelt (the button)
const sH = await trip(A, 'overworld', () => { const b = document.querySelector('#pause [data-act="goherz"]'); b.click(); }, 'story: 🌍 Herzwelt');
check(sH.arrived, '🌍 Herzwelt travels to Herzwelt');
await A.settle(80, 8);
S.atHerz = await A.ev(() => { const g = VR.game, p = g.player, sp = p.spawn; return { dim: g.dim, d: +Math.hypot(p.pos[0] - sp[0], p.pos[2] - sp[2]).toFixed(1), keep: VR.NewLife.keepInfo(g) }; });
console.log('  on Herzwelt', JSON.stringify(S.atHerz));
check(S.atHerz.dim === 'overworld' && S.atHerz.d < 4, `🌍 lands at Herzwelt's spot (${S.atHerz.d} blocks)`);
check(S.atHerz.keep && S.atHerz.keep.drift && S.atHerz.keep.drift.cols >= 20, `the drift home's columns are kept while away (${JSON.stringify(S.atHerz.keep)})`);
// the compass on Herzwelt: up, to the ship
await A.ev(() => { const g = VR.game, p = g.player; p.yaw = 0; p.pitch = 0.02; g.settings.minimap = true; });
await A.step(20, 33);
S.compass = await A.ev(() => document.getElementById('compass').innerText);
console.log('  compass', JSON.stringify(S.compass));
check(/↑/.test(S.compass) && /Driftinseln/.test(S.compass) && /zum Schiff/.test(S.compass), 'the compass on Herzwelt: „🏠 ↑ Driftinseln — zum Schiff"');
check(await A.picture(SHOTS + 'newlife_compass.png', 3), 'test/shots/newlife_compass.png');
await A.ev(() => VR.game.ui.pause());
S.rowHerz = await pauseRow(A);
check(S.rowHerz.some(b => b.act === 'sethome' && b.text === '📍 Hier wohne ich') && S.rowHerz.some(b => b.act === 'goherz' && b.shown), 'on Herzwelt with the home in the drift: 🏠 Zuhause · 🌍 Herzwelt · 📍 Hier wohne ich');
await A.picture(SHOTS + 'newlife_pause_herz.png', 3);
// 🏠 Zuhause (the button): the trip home, the shuttle comes too
const sHome = await trip(A, 'drift', () => { const b = document.querySelector('#pause [data-act="gohome"]'); b.click(); }, 'story: 🏠 Zuhause (Driftinseln)');
S.homeTrip = sHome.nl;
check(sHome.arrived && sHome.nl && sHome.nl.via === 'home', '🏠 travels home to the drift (Heimkehr)');
check(sHome.nl && sHome.nl.adopted >= 20, `the drift home's columns are adopted (${sHome.nl && sHome.nl.adopted}; ${sHome.last && sHome.last.totalMs} ms)`);
await A.settle(80, 8);
await A.step(60, 33);   // (the shuttle's design, set down on the ground under the pad)
S.recall = await A.ev(() => { const g = VR.game, p = g.player, h = g.meta.universe.home, s = g.starships.ships.find(q => q.d.seed === 7777); g.saveMeta(); const e = (g.meta.starships || []).find(q => q.seed === 7777); return { home: h.pos, player: p.pos.map(v => +v.toFixed(1)), ship: s ? s.pos.map(v => +v.toFixed(1)) : null, built: !!(s && s.d.meta), saved: e ? e.dim : null, chat: [...document.querySelectorAll('#chatlog div')].slice(-3).map(d => d.textContent) }; });
console.log('  recall', JSON.stringify(S.recall));
check(S.recall.ship && Math.hypot(S.recall.ship[0] - S.recall.home[0], S.recall.ship[2] - S.recall.home[2]) < 30 && S.recall.saved === 'drift', 'the shuttle left on Herzwelt is at the drift home\'s pad (and saved there)');
// look at the shuttle for the picture
await A.ev(() => { const g = VR.game, p = g.player, s = g.starships.ships.find(q => q.d.seed === 7777); if (s) { const dx = s.pos[0] - p.pos[0], dz = s.pos[2] - p.pos[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = -0.08; } g.env.setTime(6000); });
await A.step(10, 33);
check(await A.picture(SHOTS + 'newlife_recall.png', 4), 'test/shots/newlife_recall.png — the shuttle at the home pad');
// a death 40 m off: back at home, in the drift
S.death = await A.ev(() => { const g = VR.game, p = g.player, h = g.meta.universe.home; p.teleport(h.pos[0] + 40, h.pos[1], h.pos[2]); p.die('void'); return { dead: p.dead, screen: g.ui.screen }; });
await A.step(4, 33);
await A.ev(() => { const b = document.querySelector('#death [data-act="respawn"]'); if (b) b.click(); else { VR.game.player.respawn(); VR.game.ui.resume(); } });
await A.step(30, 33);
await A.settle(30, 4);
S.respawn = await A.ev(() => { const g = VR.game, p = g.player, h = g.meta.universe.home; return { dim: g.dim, dead: p.dead, d: +Math.hypot(p.pos[0] - h.pos[0], p.pos[2] - h.pos[2]).toFixed(1), busy: VR.Travel.busy(g) }; });
console.log('  respawn', JSON.stringify(S.respawn));
check(S.respawn.dim === 'drift' && !S.respawn.dead && S.respawn.d < 4, `a death in the drift: back at the home there (${S.respawn.d} blocks, no trip)`);
await A.ev(() => { const g = VR.game, p = g.player, s = g.starships.ships.find(q => q.d.seed === 7777); if (s) { const dx = s.pos[0] - p.pos[0], dz = s.pos[2] - p.pos[2]; p.yaw = Math.atan2(-dx, -dz) + 0.5; p.pitch = -0.04; } });
check(await A.picture(SHOTS + 'newlife_respawn_drift.png', 4), 'test/shots/newlife_respawn_drift.png — awake at home on the Driftinseln');
// 🌍 back to Herzwelt (the card's „zuletzt auf Herzwelt")
await A.ev(() => VR.game.ui.pause());
await trip(A, 'overworld', () => { document.querySelector('#pause [data-act="goherz"]').click(); }, 'story: 🌍 Herzwelt again');
await A.settle(100, 10);
save();

// ================================================================ 3 · the frame before / after (Herzwelt's spawn)
if (B && !process.env.NO_COST) {
  const measure = (Pg, n) => Pg.ev((n) => new Promise((ok, no) => { const g = VR.game, gl = g.renderer.gl; window.__norender = false; let k = -2, sum = 0, d = 0, t = 0; const f = () => { try { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); const dt = performance.now() - t0; if (k < 0) { k++; setTimeout(f, 0); return; } const st = g.renderer.stats || {}; sum += dt; d += st.draws || 0; t += st.tris || 0; if (++k < n) setTimeout(f, 0); else { window.__norender = true; ok({ ms: +(sum / n).toFixed(2), draws: Math.round(d / n), tris: Math.round(t / n) }); } } catch (e) { no(String(e)); } }; f(); }), n);
  const hold = (Pg) => Pg.ev(() => { const g = VR.game; for (const k of ['traffic', 'padLife', 'lifeDirector', 'director', 'starships', 'hall', 'trams', 'companions', 'entities', 'mirror', 'wow', 'wild']) { const o = g[k]; if (o && typeof o.update === 'function' && !o.__held) { o.__up = o.update; o.update = function () {}; o.__held = true; } } const V = g.villages; for (const k of ['updateAgent', 'updateBoats']) if (V && typeof V[k] === 'function') V[k] = function () {}; });
  for (const [preset, rd] of [['potato', 0], ['high', 6]]) {
    for (const Pg of [B, A]) { await Pg.ev(([p, rd]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; if (rd) g.settings.renderDist = rd; g.applySettings('*'); }, [preset, rd]); await toSpawn(Pg); }
    for (const Pg of [B, A]) { await Pg.page.bringToFront(); const st = await Pg.settle(preset === 'high' ? 90 : 60, 10); console.log(`  ${preset} settled`, JSON.stringify(st)); await hold(Pg); }
    const rounds = { before: [], after: [] };
    for (let r = 0; r < 3; r++) for (const [lbl, Pg] of (r & 1 ? [['after', A], ['before', B]] : [['before', B], ['after', A]])) { await Pg.page.bringToFront(); await Pg.wait(100); rounds[lbl].push(await measure(Pg, N)); }
    const out = {};
    for (const lbl of ['before', 'after']) { const ms = rounds[lbl].map(q => q.ms).sort((a, b) => a - b), mid = rounds[lbl][1]; out[lbl] = { msMedian: ms[1], ms, draws: mid.draws, tris: mid.tris }; }
    const pr = rounds.after.map((q, i) => q.ms / rounds.before[i].ms).sort((a, b) => a - b);
    out.pairRatio = +pr[1].toFixed(3); out.ratio = +(out.after.msMedian / out.before.msMedian).toFixed(3);
    out.sameWork = out.after.draws === out.before.draws && Math.abs(out.after.tris - out.before.tris) <= 0.002 * Math.max(1, out.before.tris);
    rec.cost[preset] = out; save();
    console.log(`  ${preset} · spawn`, JSON.stringify(out));
    if (preset === 'potato') check(out.sameWork && out.pairRatio <= 1.10, `Very Low at the spawn: the same work (draws ${out.after.draws}/${out.before.draws}, triangles ${out.after.tris}/${out.before.tris}), the frame ×${out.pairRatio} (pairs), ${out.after.msMedian} against ${out.before.msMedian} ms`);
    else console.log(`  (High at the spawn: draws ${out.after.draws}/${out.before.draws}, triangles ${out.after.tris}/${out.before.tris}, the frame ×${out.pairRatio} (pairs), ${out.after.msMedian} against ${out.before.msMedian} ms — reported)`);
  }
}
if (B) {
  const errs = B.logs.filter(l => l.startsWith('[pageerror]'));
  check(errs.length === 0, `page B: no page error (${errs.length})`);
  await B.ctx.close();
}

// ================================================================ 4 · the world card on the start screen
console.log(`the world card (${secs()})`);
await A.page.bringToFront();
await A.ev(() => VR.game.quitToTitle());
for (let i = 0; i < 60; i++) { await A.wait(500); if (await A.ev(() => VR.game.state === 'title')) break; }
await A.ev(() => { const g = VR.game; g.ui.showWorlds(); });
await A.wait(1500);
rec.card = await A.ev(() => { const c = document.querySelector('#worldlist .wcard'); if (!c) return null; const r = c.getBoundingClientRect(), wl = c.querySelector('.wl'), cv = wl && wl.querySelector('canvas'); return { text: wl ? wl.textContent : null, disc: !!cv, box: [r.x, r.y, r.width, r.height] }; });
console.log('  card', JSON.stringify(rec.card));
check(rec.card && rec.card.text === 'Wohnt auf den Driftinseln · zuletzt auf Herzwelt' && rec.card.disc, 'the world card: „Wohnt auf den Driftinseln · zuletzt auf Herzwelt" with the body\'s disc');
await A.ev((frames) => { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, 4);
await A.page.screenshot({ path: SHOTS + 'newlife_worlds.png' });
if (rec.card) { const b = rec.card.box; await A.page.screenshot({ path: SHOTS + 'newlife_card.png', clip: { x: Math.max(0, b[0] - 8), y: Math.max(0, b[1] - 8), width: Math.min(1280, b[2] + 16), height: b[3] + 16 } }); }
check(fs.existsSync(SHOTS + 'newlife_card.png'), 'test/shots/newlife_card.png');
// every world's disc, 96 px each, on one strip
await A.ev(() => {
  const ids = ['overworld', 'drift', 'underforge', 'hollow', 'flat', 'opal', 'basalt', 'aqua', 'zinn', 'ocker'], n = 96;
  const box = document.createElement('div'); box.id = '__discs'; box.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;background:#0a0c14;padding:10px;display:flex;gap:10px';
  for (const id of ids) { const c = document.createElement('canvas'); c.width = n; c.height = n; const ctx = c.getContext('2d'), img = ctx.createImageData(n, n); img.data.set(VR.NewLife.discPixels(id, n)); ctx.putImageData(img, 0, 0); box.appendChild(c); }
  document.body.appendChild(box);
});
await A.page.screenshot({ path: SHOTS + 'newlife_discs.png', clip: { x: 0, y: 0, width: 10 * 106 + 10, height: 116 } });
{
  const errs = A.logs.filter(l => l.startsWith('[pageerror]'));
  console.log(`--- page A logs (${A.logs.length})`); for (const l of A.logs.slice(0, 12)) console.log(l);
  check(errs.length === 0, `page A: no page error (${errs.length})`);
  check(!A.logs.some(l => /shader|compile|link/i.test(l)), 'page A: every shader compiles');
}
await A.ctx.close();
await browser.close();
save();
// the sheet
try {
  const spec = { cols: [], w: 560, rows: [
    { label: '', labels: ['Pause im Drift (Herzwelt-Zuhause)', 'Pause: 🏠 Zuhause (Driftinseln) · 🌍 Herzwelt'], imgs: [SHOTS + 'newlife_pause_drift0.png', SHOTS + 'newlife_pause.png'] },
    { label: '', labels: ['Herzwelt: Kompass ↑ Driftinseln', 'Herzwelt: Pause, 📍 Hier wohne ich'], imgs: [SHOTS + 'newlife_compass.png', SHOTS + 'newlife_pause_herz.png'] },
    { label: '', labels: ['Heimkehr: das Shuttle am Landeplatz', 'Tod im Drift: wach zu Hause'], imgs: [SHOTS + 'newlife_recall.png', SHOTS + 'newlife_respawn_drift.png'] },
    { label: '', labels: ['Weltenliste', 'die Weltkarte'], imgs: [SHOTS + 'newlife_worlds.png', SHOTS + 'newlife_card.png'] },
  ] };
  fs.writeFileSync(SHOTS + 'newlife_sheet.json', JSON.stringify(spec));
  console.log('  ' + execFileSync('python3', ['/root/r9coord/sheet.py', SHOTS + 'newlife_sheet.jpg', SHOTS + 'newlife_sheet.json']).toString().trim());
} catch (e) { console.log('  (no sheet: ' + String(e.message || e).slice(0, 160) + ')'); }
console.log(`(${secs()})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
