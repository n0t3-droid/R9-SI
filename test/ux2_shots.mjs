// f-ux2 in the browser (docs/superpowers/plans/2026-11-02-f-ux2.md): a new default world (seed 4242, Kreativ,
// Friedlich), 960 × 540, de-DE, Balanced, your name „Mila". Before / after by the module's own switches (the f-ux
// trail: D.paths / D.decals off; the f-ux book: D.bookV 1; the gossip before: VR.Gossip.hello off, the visit a note):
//   1 · a wall 7 m ahead, the goal 50 m beyond: the trail as round dots through the wall (before) → soles along a
//       walkable way round its end, a Wegweiser at the bend (after) — ux2_trail_{before,after}.png
//   2 · the Wanderbuch: one section a page (before) → two a page with ink doodles (after), the leaf mid-turn
//   3 · Palmenhafen: the deed greeting with the neighbours' „Hallo" (before) → alone, the neighbours wave (after);
//       the children's play staged (the machine kneels, the hero taps it); a friend's visit in person at your door;
//       the bard's verse at the night's festival (if the musician is near and drawn)
//   4 · the cost: VR.Diegetic per frame and the path searches on Very Low and High, the frame with the trail on / off
//   → test/shots/ux2_*.png, sheet test/shots/ux2_sheet.jpg, .tmp_tests/ux2_run.json
//   nohup bash test/wt_run.sh ux2_shots.mjs 3600 > .tmp_tests/ux2_shots.log 2>&1 &
// regress: skip  (a showcase with pictures; the gates are test/diegetic.js, ux2_trail.js, ux2_gossip.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '').replace(/\/\.tmp_tests$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html';
const SHOTS = ROOT + '/test/shots/';
const SEED = process.env.SEED || '4242';
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + ' (' + secs() + ')'); };
const run = { seed: SEED };
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/ux2_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|gossip|diegetic|book/i.test(s)) logs.push(`[${t}] ${s.slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto(DIST);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(3); } };
const settle = async (max = 40) => {
  for (let i = 0; i < max; i++) {
    await step(20, 16);
    const s = await ev(() => { const g = VR.game, w = g.world; return { busy: g.pool.busy, pend: w.pending.size, up: w.uploadQ ? w.uploadQ.size : 0 }; });
    if (s.busy === 0 && s.pend === 0 && s.up === 0 && i > 2) break;
    await wait(30);
  }
};
const pics = {};
const grab = async (key, name, frames = 4) => {
  const url = await ev((frames) => { try { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; } catch (e) { window.__norender = true; return null; } }, frames);
  if (url && url.length > 2000) { fs.writeFileSync(SHOTS + name, Buffer.from(url.split(',')[1], 'base64')); console.log('  📷 ' + name); pics[key] = SHOTS + name; return SHOTS + name; }
  console.log('  !! no picture ' + name); return null;
};
const shotDom = async (key, name) => { try { await ev(() => { window.__norender = false; const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); window.__norender = true; }); await page.screenshot({ path: SHOTS + name, timeout: 120000 }); console.log('  📷 ' + name); pics[key] = SHOTS + name; return SHOTS + name; } catch (e) { console.log('  !! ' + e.message); return null; } };
const stand = (P, look) => ev(([P, L]) => { const p = VR.game.player; p.flying = true; p.teleport(P[0], P[1], P[2]); p.vel = [0, 0, 0]; const e = [P[0], P[1] + 1.6, P[2]], dx = L[0] - e[0], dy = L[1] - e[1], dz = L[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw; }, [P, look]);

const shotLine = async (what, key) => {   // the moment a kind of line is said: look at the speaker, a picture
  // (an eye 4.5 m from the speaker and 1.6 m over its head, on the side where the line of sight is free air)
  const ok = await ev((w) => { const L = VR.Gossip.log.filter(l => l.what === w).pop(); if (!L || (Date.now() - L.t) > 6000) return false; let b = null; for (const q of VR.game.villages.agents) if (q.p.id === L.who) b = q; if (!b || !b.bubble) return false;
    const g = VR.game, p = g.player, W = g.world, R = VR.R, solid = (x, y, z) => { const st = W.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return !!(st && (R.T.flags[st] & VR.F.SOLID)); };
    let best = null;
    for (let k = 0; k < 16 && !best; k++) { const an = k / 16 * Math.PI * 2 + 0.3, ex = b.pos[0] + Math.cos(an) * 4.5, ez = b.pos[2] + Math.sin(an) * 4.5, ey = b.pos[1] + 3.2; let clear = true; for (let s2 = 0; s2 <= 1.0001 && clear; s2 += 0.1) if (solid(ex + (b.pos[0] - ex) * s2, ey + (b.pos[1] + 1.4 - ey) * s2, ez + (b.pos[2] - ez) * s2) || solid(ex, ey - 1, ez)) clear = false; if (clear) best = [ex, ey, ez]; }
    if (!best) best = [b.pos[0] + 3, b.pos[1] + 4, b.pos[2] + 3];
    p.flying = true; p.teleport(best[0], best[1] - 1.6, best[2]); p.vel = [0, 0, 0];
    const dx = b.pos[0] - best[0], dy = b.pos[1] + 1.3 - best[1], dz = b.pos[2] - best[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw;
    b.bubble.t = Math.max(b.bubble.t, 3); return true; }, what);
  if (ok) { await step(4, 33); await ev(() => { for (const q of VR.game.villages.agents) if (q.bubble) q.bubble.t = Math.max(q.bubble.t, 2); }); await shotDom(key, 'ux2_' + key + '.png'); return true; } return false;
};

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.playerName = 'Mila'; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Wege',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:false})`);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world');
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeWeather = true; g.zenFreezeTime = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(3000); if (VR.Folk && VR.Folk.warm) VR.Folk.warm(); });
await settle(20); await step(60, 33);
const S0 = await ev(() => VR.game.player.pos.slice());
// ---------------------------------------------------------------- 1 · the trail round a wall
const W1 = await ev(() => {
  const g = VR.game, p = g.player, W = g.world, R = VR.R, st = (R.byName.stone_bricks || R.byName.stone).base;
  p.flying = false; const fx = Math.floor(p.pos[0]), fz = Math.floor(p.pos[2]);
  const fy = Math.floor(p.pos[1] + 0.1); for (let x = fx - 8; x <= fx + 8; x++) for (let y = fy; y <= fy + 3; y++) W.setBlock(x, y, fz - 7, st);
  VR.Diegetic.setGoal({ x: fx + 0.5, z: fz - 50, label: 'Aussichtspunkt' });
  g.camMode = 1; p.yaw = 0.25; p.pitch = -0.52; p.viewYaw = p.yaw;
  return { fx, fz, y: p.pos[1] };
});
await settle(10);
const trailState = () => ev((W1) => { const D = VR.Diegetic, S = D.state; return { onPath: !!S.onPath, pts: S.pts.length, soles: S.soleN, inWall: S.pts.filter(q => Math.floor(q.z) === W1.fz - 7 && Math.floor(q.x) >= W1.fx - 8 && Math.floor(q.x) <= W1.fx + 8).length, forks: S.forks.length, forkShown: S.forkEls.filter(e => e._on).length, sign: !!S.signShown, maxX: Math.max(0, ...S.pts.map(q => Math.abs(q.x - W1.fx - 0.5))).toFixed(1), path: D.cost.pathN || 0, pathMs: +(D.cost.pathMs || 0).toFixed(2), draws: D.cost.soleDraws || 0, wallOk: VR.game.world.getBlock(W1.fx, Math.floor(VR.game.player.pos[1] + 0.1) + 1, W1.fz - 7) !== 0 }; }, W1);
await ev(() => { const D = VR.Diegetic; D.paths = false; D.decals = false; D.state.pathT = -1e9; });
await step(40, 33); await wait(300); await step(20, 33);
const tb = await trailState(); run.trailBefore = tb; console.log('  before ' + JSON.stringify(tb));
await shotDom('trail_before', 'ux2_trail_before.png');
await ev(() => { const D = VR.Diegetic; D.paths = true; D.decals = true; D.state.pathT = -1e9; D.state.pFrom = null; });
await step(40, 33); await wait(300); await step(20, 33);
const ta = await trailState(); run.trailAfter = ta; console.log('  after ' + JSON.stringify(ta));
await shotDom('trail_after', 'ux2_trail_after.png');
check(tb.inWall > 0 && !tb.onPath, `before: the straight trail runs through the wall (${tb.inWall} steps in it)`);
check(ta.onPath && ta.inWall === 0 && ta.pts >= 8, `after: ${ta.pts} steps along a walkable way, none in the wall (round its end, |x| ≤ ${ta.maxX} m)`);
check(ta.soles >= 8, `after: the steps are soles (${ta.soles} decals)`);
check(ta.forks >= 1, `after: a Wegweiser at the bend (${ta.forks}, ${ta.forkShown} in view; end sign ${ta.sign})`);
// a look from above (the 3D picture, no HUD)
await ev((W1) => { const g = VR.game; g.camMode = 0; window.__ux2cam = { x: W1.fx + 0.5 - 1, y: W1.y + 8.5, z: W1.fz + 3.5 }; }, W1);
await ev((W1) => { const g = VR.game, p = g.player; const o = g.renderer.setupCamera; if (!g.renderer.__ux2) { g.renderer.__ux2 = o; g.renderer.setupCamera = function (c) { const k = window.__ux2cam; if (k) { c.x = k.x; c.y = k.y; c.z = k.z; c.yaw = k.yaw; c.pitch = k.pitch; } return o.call(this, c); }; } const k = window.__ux2cam, dx = W1.fx + 0.5 - 6 - k.x, dy = W1.y - k.y, dz = W1.fz - 6 - k.z; k.yaw = Math.atan2(-dx, -dz); k.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }, W1);
await grab('trail_top', 'ux2_trail_top.png', 3);
await ev(() => { window.__ux2cam = null; VR.game.camMode = 0; VR.Diegetic.setGoal(null); });
// ---------------------------------------------------------------- 2 · the Wanderbuch
await ev(() => { const g = VR.game, W = VR.Wander, m = g.meta;
  W.note(m, 'places', 'v:a', 'Nordwiese'); W.note(m, 'places', 'v:b', 'Talheim'); W.note(m, 'places', 'x:turm', 'Alter Turm'); W.note(m, 'places', 'x:brunnen', 'Brunnenhof');
  W.note(m, 'people', 'Ida'); W.note(m, 'people', 'Bruno'); W.note(m, 'people', 'Tomek');
  W.note(m, 'creatures', 'fox'); W.note(m, 'creatures', 'rabbit'); W.note(m, 'creatures', 'pup');
  for (const n of ['well', 'kites', 'crossing', 'rainbow', 'glade', 'lanterns']) W.note(m, 'stickers', n);
  W.note(m, 'recipes', 'herbsoup'); W.note(m, 'recipes', 'applecake'); });
const book = async (v, tag) => {
  await ev((v) => { VR.Diegetic.bookV = v; VR.Diegetic.book.page = 0; VR.Wander.open(VR.game); }, v); await wait(900);
  await shotDom('book_' + tag, 'ux2_book_' + tag + '.png');
  await ev(() => VR.Diegetic.turn(VR.game, 1)); await wait(1200);
  await shotDom('book_' + tag + '2', 'ux2_book_' + tag + '2.png');
};
await book(1, 'before');
await ev(() => VR.Wander.close(VR.game)); await wait(300);
await book(2, 'after');
const bk = await ev(() => ({ pages: VR.Diegetic.book.pages.length, doodles: document.querySelectorAll('#wanderbuch canvas[data-k]').length, secs: document.querySelectorAll('#wanderbuch .dgpage .wdsec').length }));
run.book = bk;
check(bk.pages === 5 && bk.secs >= 3 && bk.doodles >= 6, `the book: ${bk.pages} pages, ${bk.secs} sections on this spread, ${bk.doodles} doodles`);
// the leaf mid-turn (frozen: a leaf of our own, its animation paused half way)
await ev(() => { const st = document.createElement('style'); st.textContent = '#wanderbuch .dgleaf.ux2{animation-play-state:paused!important;animation-delay:-0.3s!important}'; document.head.appendChild(st); const l = document.createElement('div'); l.className = 'dgleaf fw ux2'; document.querySelector('#wanderbuch .dgbook').appendChild(l); });
await wait(300); await shotDom('book_turn', 'ux2_book_turn.png');
await ev(() => { const l = document.querySelector('.dgleaf.ux2'); if (l) l.remove(); VR.Wander.close(VR.game); }); await wait(300);
// ---------------------------------------------------------------- 3 · Palmenhafen: the greeting, the play, the visit
const PZ = [0.5, 81, -49.5];
await stand([PZ[0] + 2, PZ[1] + 1, PZ[2] - 6], [PZ[0], PZ[1] + 1.5, PZ[2] - 40]);
await ev(() => { VR.game.player.flying = false; VR.game.env.setTime(3400); });
for (let i = 0; i < 12; i++) { await settle(6); await step(20, 33); if (await ev(() => { for (const v of VR.game.villages.known.values()) if (v.plan.nova && v.active && v.agents.length > 6) return true; return false; })) break; }
await ev(() => { const g = VR.game, p = g.player.pos; VR.Gossip.test.deed('freed', { x: p[0], z: p[2], pl: VR.Liberate && VR.Liberate.nameOf ? VR.Liberate.nameOf({ id: 'ux2-out' }) : 'Funkturm', key: 'ux2-out' }); });
// the greeting: walk up to a group (the first hello of each) — before without VR.Gossip.hello, after with it
const greetScene = async (tag, on) => {
  const r = await ev((on) => {
    const g = VR.game, V = g.villages, G = VR.Gossip; G.test.cool();
    if (!window.__gsHello) window.__gsHello = G.hello; G.hello = on ? window.__gsHello : null; G.calm = on;
    // a grown-up with two others within 6 m, none greeted yet
    let best = null; for (const a of V.agents) { if (a.kid || a.pose === 'sleep' || a.guest) continue; let n = 0; for (const b of V.agents) if (b !== a && !b.kid && Math.hypot(b.pos[0] - a.pos[0], b.pos[2] - a.pos[2]) < 6) n++; if (n >= 2 && (!best || n > best.n)) best = { a, n }; }
    if (!best) return null;
    const a = best.a; for (const b of V.agents) { b.greeted = false; b.bubble = null; }
    const rec = G.test.rec(); rec.greeted = {};
    g.player.flying = false; g.player.teleport(a.pos[0] + 2.4, a.pos[1] + 0.2, a.pos[2] + 2.4);
    const p = g.player, e = [p.pos[0], p.pos[1] + 1.6, p.pos[2]]; p.yaw = Math.atan2(-(a.pos[0] - e[0]), -(a.pos[2] - e[2])); p.pitch = -0.1; p.viewYaw = p.yaw;
    window.__gsA = a; return { name: a.name, n: best.n };
  }, on);
  for (let i = 0; i < 8; i++) await step(5, 33);
  const bub = await ev(() => { const g = VR.game, p = g.player.pos; return VR.game.villages.agents.filter(a => a.bubble && Math.hypot(a.pos[0] - p[0], a.pos[2] - p[2]) < 14).map(a => a.bubble.text.slice(0, 60)); });
  await ev(() => { for (const q of VR.game.villages.agents) if (q.bubble) q.bubble.t = Math.max(q.bubble.t, 2); });
  await shotDom('greet_' + tag, 'ux2_greet_' + tag + '.png');
  return { who: r, bubbles: bub };
};
const gb = await greetScene('before', false), ga = await greetScene('after', true);
run.greet = { before: gb, after: ga }; console.log('  greet ' + JSON.stringify(run.greet));
const deedish = (t) => /Mila|gehört|Licht|Leucht|frei/i.test(t);
check(ga.bubbles.length >= 1 && ga.bubbles.length <= Math.max(1, gb.bubbles.length - 1) && ga.bubbles.some(deedish), `after: the deed greeting alone (${ga.bubbles.length} bubbles: ${JSON.stringify(ga.bubbles)}; before ${gb.bubbles.length})`);
// the children's play
const kids = await ev(() => { const g = VR.game, V = g.villages, G = VR.Gossip; const K = V.agents.filter(a => a.kid && a.pose !== 'sleep'); if (K.length < 2) return null;
  const k1 = K[0]; let k2 = K[1], bd = 1e9; for (const k of K.slice(1)) { const d = Math.hypot(k.pos[0] - k1.pos[0], k.pos[2] - k1.pos[2]); if (d < bd && d > 2) { bd = d; k2 = k; } }
  if (bd > 12) { k2.pos = [k1.pos[0] + 5, k1.pos[1], k1.pos[2] + 1]; }
  for (const a of V.agents) a.bubble = null; G.test.cool();
  const d = G.test.rec().deeds.find(q => q.k === 'freed'); G.stagePlay(V, k1, k2, d);
  const p = g.player; p.flying = true; const mx = (k1.pos[0] + k2.pos[0]) / 2, mz = (k1.pos[2] + k2.pos[2]) / 2; p.teleport(mx + 3.2, k1.pos[1] + 0.6, mz + 3.2); p.vel = [0, 0, 0];
  const e = [p.pos[0], p.pos[1] + 1.6, p.pos[2]]; p.yaw = Math.atan2(-(mx - e[0]), -(mz - e[2])); p.pitch = Math.atan2(k1.pos[1] + 0.6 - e[1], Math.hypot(mx - e[0], mz - e[2])); p.viewYaw = p.yaw;
  window.__k = [k1, k2]; return { d: Math.round(bd) };
});
const playPh = []; let shotPlay = 0;
if (kids) for (let i = 0; i < 60; i++) {
  await step(5, 33); const s = await ev(() => VR.Gossip.test.play()); const ph = s ? s.ph : 'done'; if (playPh[playPh.length - 1] !== ph) playPh.push(ph);
  if (ph === 'walk' && !shotPlay) { shotPlay = 1; await shotDom('play1', 'ux2_play_machine.png'); }
  if (ph === 'tap' && shotPlay < 2) { shotPlay = 2; await step(4, 33); await shotDom('play2', 'ux2_play_tap.png'); }
  if (ph === 'rise' && shotPlay < 3) { shotPlay = 3; await step(6, 33); await shotDom('play3', 'ux2_play_rise.png'); }
  if (ph === 'done') break;
}
run.play = playPh; check(playPh.join(',') === 'walk,tap,rise,done', 'the children\'s play: ' + playPh.join(' → '));

// a friend's visit: a person (from a village far away: a guest with a basket) walks up to a door beside you
const vis = await ev((PZ0) => {
  const g = VR.game, V = g.villages, G = VR.Gossip, MI = VR.MoveIn, p = g.player;
  let vil = null; for (const v of V.known.values()) if (!v.active && v.people && v.people.length && v.fams && Math.hypot(v.plan.x - p.pos[0], v.plan.z - p.pos[2]) > 200) { vil = v; break; }
  if (!vil) for (const v of V.known.values()) if (v.people && v.people.length && v.fams) { vil = v; break; }
  let person = vil ? (vil.people.find(q => q.age !== 'child') || vil.people[0]) : null;
  if (!vil) { const a = V.agents.find(q => !q.kid && q.pose !== 'sleep' && q.vil && q.vil.fams && Math.hypot(q.pos[0] - p.pos[0], q.pos[2] - p.pos[2]) > 25); if (a) { vil = a.vil; person = a.p; } }
  if (!vil || !person) return { err: 'no village with people (' + V.known.size + ' known)' };
  const pid = (g.dim || 'overworld') + '/' + person.id, f = { name: person.name, sur: vil.fams && vil.fams[person.fam] ? vil.fams[person.fam].surname : '', vid: vil.id, vn: vil.name, likes: person.likes || '' };
  G.befriend(G.test.rec(), pid, 12, f);
  p.flying = false; p.teleport(PZ0[0] + 2, PZ0[1] + 1, PZ0[2] - 6);
  const dx = Math.floor(p.pos[0]) + 3, dz = Math.floor(p.pos[2]), dy = MI.groundAt(g.world, dx, Math.floor(p.pos[1]) + 4, dz, 10);
  if (dy === null) return { err: 'no ground for the door' };
  const ok = G.startVisit(V, pid, f, [dx, dy, dz], { at: [dx + 0.5, dy, dz + 0.5], item: 'bread', n: 2, fam: f.sur, name: f.name });
  const J = V._gsVisit; if (!ok || !J) return { err: 'not started' };
  // you: 5 m on the far side of the door, looking down the way they come
  const ux = J.start[0] - (dx + 0.5), uz = J.start[2] - (dz + 0.5), L = Math.hypot(ux, uz) || 1;
  p.flying = true; p.teleport(dx + 0.5 - ux / L * 5, dy + 1.2, dz + 0.5 - uz / L * 5); p.vel = [0, 0, 0];
  const e = [p.pos[0], p.pos[1] + 1.6, p.pos[2]], tx = dx + 0.5 + ux / L * 8, tz = dz + 0.5 + uz / L * 8; p.yaw = Math.atan2(-(tx - e[0]), -(tz - e[2])); p.pitch = -0.12; p.viewYaw = p.yaw;
  return { name: f.name, from: f.vn, guest: J.guest, d: Math.round(L) };
}, PZ);
run.visit = { start: vis }; console.log('  visit ' + JSON.stringify(vis));
const visPh = []; let vShot = 0;
if (vis && !vis.err) for (let i = 0; i < 260; i++) {
  await step(10, 33); const s = await ev(() => VR.Gossip.test.visit()); const ph = s ? s.ph : 'done'; if (visPh[visPh.length - 1] !== ph) visPh.push(ph);
  if (s && ph === 'walk' && !vShot && Math.hypot(s.pos[0] - s.door[0], s.pos[2] - s.door[2]) < 6.5) { vShot = 1; await shotDom('visit1', 'ux2_visit_walk.png'); }
  if (s && ph === 'wait' && vShot < 2) { await ev(() => { const p = VR.game.player, J = VR.game.villages._gsVisit; p.teleport(J.door[0] + 0.5 + 2.6, J.door[1] + 0.3, J.door[2] + 0.5 + 2.6); const e = [p.pos[0], p.pos[1] + 1.6, p.pos[2]], a = J.a; p.yaw = Math.atan2(-(a.pos[0] - e[0]), -(a.pos[2] - e[2])); p.pitch = -0.12; p.viewYaw = p.yaw; }); }
  if (s && ph === 'chat' && vShot < 2) { vShot = 2; await step(6, 33); await shotDom('visit2', 'ux2_visit_chat.png'); }
  if (s && ph === 'chat' && vShot < 3 && await ev(() => VR.Gossip.log.filter(l => l.what === 'visit').length >= 2)) { vShot = 3; await shotDom('visit3', 'ux2_visit_chat2.png'); }
  if (ph === 'done') break;
}
const vend = await ev(() => ({ gifts: (VR.MoveIn.rec(VR.game).gifts || []).length, lines: VR.Gossip.log.filter(l => l.what === 'visit').map(l => l.text) }));
run.visit.ph = visPh; run.visit.end = vend;
check(visPh.slice(0, 3).join(',') === 'walk,wait,chat' && vend.gifts >= 1, `a friend's visit in person: ${visPh.join(' → ')}; ${vend.gifts} gift at the door; „${vend.lines.join('“ · „')}“`);
// the bard's verse at the night's festival
await ev(() => { VR.game.env.setTime(14200); });
await stand([PZ[0] + 2, PZ[1] + 1, PZ[2] - 6], [PZ[0], PZ[1] + 1.5, PZ[2] - 40]); await ev(() => { VR.game.player.flying = false; VR.Gossip.test.cool(); });
let verse = false;
for (let i = 0; i < 40 && !verse; i++) { await step(10, 33); verse = await shotLine('verse', 'verse'); }
run.verse = verse; console.log('  verse ' + (verse ? 'shown' : 'not said (no musician near and drawn)'));
// ---------------------------------------------------------------- 4 · the cost
await ev(() => { const g = VR.game; g.env.setTime(3000); });
await stand([S0[0], S0[1] + 1, S0[2]], [S0[0], S0[1], S0[2] - 30]);
await ev((W1) => { const g = VR.game, p = g.player; p.flying = false; p.teleport(W1.fx + 0.5, W1.y, W1.fz + 0.5); p.yaw = 0.25; p.pitch = -0.3; p.viewYaw = p.yaw; VR.Diegetic.setGoal({ x: W1.fx + 0.5, z: W1.fz - 50, label: 'Aussichtspunkt' }); }, W1);
const cost = {};
for (const preset of process.env.SKIP_COST ? [] : ['potato', 'high']) {
  await ev((pr) => { const g = VR.game; g.applyPreset(pr); g.settings.dynRes = false; g.settings.renderDist = 6; g.applySettings('*'); }, preset);
  await settle(10);
  for (const on of [true, false, false, true, true, false]) {
    const r = await ev((on) => { const g = VR.game, D = VR.Diegetic; g.settings.goalTrail = on; D.state.pathT = -1e9; D.state.pFrom = null; window.__norender = false; for (let i = 0; i < 10; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); D.resetCost(); const ms = []; for (let i = 0; i < 12; i++) { const t = performance.now(); g.last = t - 33; g.loop(t); g.renderer.gl.finish(); ms.push(performance.now() - t); } window.__norender = true; ms.sort((a, b) => a - b); const S = D.state; return { ms: +ms[6].toFixed(1), dg: +D.costPerFrame().toFixed(3), worst: +D.cost.worst.toFixed(2), soles: S.soleN, onPath: !!S.onPath, path: D.cost.pathN || 0 }; }, on);
    (cost[preset + (on ? '_on' : '_off')] || (cost[preset + (on ? '_on' : '_off')] = [])).push(r);
  }
}
await ev(() => { VR.game.settings.goalTrail = true; });
run.cost = cost; save(); console.log('  cost ' + JSON.stringify(cost));
if (!process.env.SKIP_COST) {
const md = (a, k) => { const q = a.map(x => x[k]).sort((x, y) => x - y); return q[q.length >> 1]; };
run.costMed = { potato_on: md(cost.potato_on, 'ms'), potato_off: md(cost.potato_off, 'ms'), high_on: md(cost.high_on, 'ms'), high_off: md(cost.high_off, 'ms'), dg_potato: md(cost.potato_on, 'dg'), dg_high: md(cost.high_on, 'dg') };
console.log('  cost medians ' + JSON.stringify(run.costMed));
check(cost.potato_on.every(r => !r.onPath && r.soles === 0), 'Very Low: no path search, no soles (particles 0) — as before');
check(run.costMed.dg_potato < 0.15 && run.costMed.dg_high < 0.5, `VR.Diegetic per frame: Very Low ${run.costMed.dg_potato} ms, High ${run.costMed.dg_high} ms`);
}
check(!logs.some(l => /pageerror|gossip|diegetic/i.test(l)), 'no page error' + (logs.length ? ': ' + logs.slice(0, 4).join(' · ') : ''));
save();
const row = (label, ks) => ({ label, imgs: ks.map(k => pics[k]).filter(Boolean) });
const rows = [row('Vorher: die Spur als Punkte geradeaus durch die Mauer · Nachher: Fußsohlen auf dem begehbaren Weg, ein Wegweiser an der Biegung', ['trail_before', 'trail_after']), row('Von oben: die Spur geht um das Mauerende', ['trail_top']),
  row('Wanderbuch vorher: ein Abschnitt pro Seite, leer', ['book_before', 'book_before2']), row('Wanderbuch nachher: zwei Abschnitte pro Seite, Tuschezeichnungen', ['book_after', 'book_after2']), row('Das Umblättern (das Blatt in der Mitte der Drehung)', ['book_turn']),
  row('Gruß vorher (die Nachbarn sagen „Hallo“ daneben) · nachher (nur der Gruß zur Tat, die anderen winken)', ['greet_before', 'greet_after']),
  row('Das Kinderspiel: die „Maschine“ kniet, der „Held“ tippt sie an, sie steht auf', ['play1', 'play2', 'play3']), row('Ein Freund kommt mit dem Korb zur Tür, plaudert', ['visit1', 'visit2', 'visit3']), row('Das Fest: der Musikant singt von deiner Tat', ['verse'])].filter(r => r.imgs.length);
if (rows.length) { fs.writeFileSync(ROOT + '/.tmp_tests/ux2_sheet.json', JSON.stringify({ w: 620, rows })); try { console.log('  ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'ux2_sheet.jpg', ROOT + '/.tmp_tests/ux2_sheet.json']).toString().trim()); } catch (e) { console.log('  !! sheet ' + e.message); } }
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
