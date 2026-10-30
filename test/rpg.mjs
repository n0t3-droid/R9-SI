// Der Weg des Abenteurers in the page (a-rpg; plan docs/superpowers/plans/2026-10-30-a-rpg.md). One run, German UI:
//   1. an Abenteuer world with Begegnungen; XP to level 7 (Anfängerglück counted), finds of every rarity; [O] opens the
//      character screen (level, XP bar, the five stats with ＋, the gear on the figure) → rpg_character_screen.png
//   2. a radiant find: its card, the bag in rarity colours → rpg_gear_rarity.png
//   3. the nearest outpost freed (VR.Liberate.free): an outpost find follows; a second freed and two known outposts in
//      the region → the boss ready; the conquest tab: regions, the world's percentage, the tribute claimed → rpg_conquest_map.png
//   4. Der Turmgänger rises at the Kernfeuer; phase 1, a stomp telegraphed (the ring, the warning) → rpg_boss_phase1.png;
//      the weak points count double only when open; phase 2's shield holds; drones as adds
//   5. the finish: the region healed, the banner, the boss's XP and Taler, a boss find → rpg_boss_finish.png
//   6. the loot burst: coins in flight to the HUD's coin → rpg_loot_burst.png
//   7. the costs: the game loop (CPU, no drawing) on Very Low and High — the Abenteuer on, no boss / the boss fighting
// → test/shots/rpg_*.png, rpg_sheet.jpg, rpg_numbers.json
//   nohup bash test/wt_run.sh rpg.mjs 3600 > .tmp_tests/rpg.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
const DIST = 'file://' + ROOT + 'dist/index.html';
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const N = {};
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /rpg/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const run = async (n, dtms = 33, until, arg) => {
  let done = 0;
  for (let k = 0; k < n; k += 30) {
    const r = await ev(([m, d, u, a]) => {
      const g = VR.game;
      if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
      window.__norender = true;
      for (let i = 0; i < m; i++) { if (VR.Foes) VR.Foes.hp = 20; g.last = performance.now() - d; window.__step(performance.now()); if (u && window.__c[u](a)) return { n: i + 1, hit: true }; }
      return { n: m, hit: false };
    }, [Math.min(30, n - k), dtms, until || null, arg === undefined ? null : arg]);
    done += r.n; if (r.hit) return { n: done, hit: true };
  }
  return { n: done, hit: false };
};
const draw = () => ev(() => { window.__norender = false; const g = VR.game; g.env.rain = 0; g.env.rainTarget = 0; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; window.__step(performance.now()); } g.renderer.gl.finish(); window.__norender = true; });
const hold = (ms) => ev((ms) => { for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = ms; } catch (e) { /* */ } } }, ms);
const release = () => ev(() => { for (const a of document.getAnimations()) { try { a.play(); } catch (e) { /* */ } } });
const shot = async (name) => { await wait(150); await page.screenshot({ path: SHOTS + name + '.png', timeout: 120000 }); console.log('shot ' + name + ' (' + secs() + ')'); return SHOTS + name + '.png'; };
const pics = {};
const section = async (tag, fn) => { try { await fn(); } catch (e) { fails++; console.log('  ✗ section ' + tag + ' stopped: ' + (e.stack || e.message).slice(0, 900)); try { await release(); await page.screenshot({ path: SHOTS + 'rpg_fail_' + tag + '.png', timeout: 120000 }); } catch (e2) { /* */ } } };

try {
  await page.goto(DIST);
  for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title')) break; }
  check(await ev(() => !!(VR.RPG && VR.RPGame && VR.RPGBoss)), 'VR.RPG, VR.RPGame and VR.RPGBoss are in the page');
  await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.wowMoments = false; g.applySettings('*'); g.audio.resume(); if (VR.Hints) for (const h of ['play', 'move', 'fly']) VR.Hints.done(h); });
  await ev(`VR.game.createWorld({name:'Turmgang',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
  for (let i = 0; i < 200; i++) { await wait(500); if (await ev(() => VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)) break; }
  check(await ev(() => VR.game.state) === 'play', 'the world is open (' + secs() + ')');
  await ev(() => {
    const g = VR.game, L0 = Object.getPrototypeOf(g).loop;
    window.__step = (t) => L0.call(g, t); g.loop = function (t) { if (window.__live) return L0.call(this, t); };
    g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar');
    const st = document.createElement('style'); st.textContent = '#hints,#lockhint,#toasts,.toast,#uxkeys,#ctxprompt,#ctxring{display:none !important}'; document.head.appendChild(st);
    const A = VR.Adventure; A.setOn(true); A.setEnc('normal');
    window.__c = {
      known: () => !!window.__site && !!VR.Liberate.siteOf(window.__site) && VR.Liberate.siteOf(window.__site).known,
      momentEnd: () => !VR.Liberate.moment && !!window.__site && VR.Liberate.siteOf(window.__site).st === 'frei',
      boss: () => !!VR.RPGBoss.cur,
      bossSt: (s) => !!VR.RPGBoss.cur && VR.RPGBoss.cur.b.st === s,
      teleStomp: () => !!VR.RPGBoss.cur && VR.RPGBoss.cur.b.st === 'tele' && VR.RPGBoss.cur.b.att === 'stomp' && VR.RPGBoss.cur.tele > 0.6,
      won: () => !!VR.RPGBoss.cur && VR.RPGBoss.cur.b.st === 'won',
    };
    // the shots' camera: in front of the boss and a little aside, two blocks over the ground; the Helfer out of the frame
    window.__cam = (d, side, up) => {
      const m = VR.RPGBoss.cur.m, p = g.player, t = [m.pos[0], m.pos[1] + 3.4, m.pos[2]];
      for (let i = g.entities.mobs.length - 1; i >= 0; i--) { const f = g.entities.mobs[i].foe; if (f && (f.mine || f.helper)) g.entities.mobs.splice(i, 1); }
      const air = (x, y, z) => { const b = g.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return !b || !(VR.R.T.flags[b] & VR.F.SOLID); };
      let best = null;
      for (let k = 0; k < 24 && !best; k++) {
        const a = m.yaw + side + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * Math.PI / 10, cx = m.pos[0] - Math.sin(a) * d, cz = m.pos[2] - Math.cos(a) * d;
        const cy = Math.max(g.world.topAt(Math.floor(cx), Math.floor(cz)) + up, t[1] - 1);
        let ok = air(cx, cy, cz) && air(cx, cy + 1.62, cz);
        for (let s2 = 1; s2 < 24 && ok; s2++) { const u = s2 / 24; if (u > 0.8) break; if (!air(cx + (t[0] - cx) * u, cy + 1.62 + (t[1] - cy - 1.62) * u, cz + (t[2] - cz) * u)) ok = false; }
        if (ok) best = [cx, cy, cz];
      }
      if (!best) { const a = m.yaw + side; best = [m.pos[0] - Math.sin(a) * d, m.pos[1] + 6, m.pos[2] - Math.cos(a) * d]; }
      p.flying = true; p.teleport(best[0], best[1], best[2]); p.vel[0] = p.vel[1] = p.vel[2] = 0; window.__aim(t);
    };
    window.__aim = (t) => { const p = g.player, e = [p.pos[0], p.pos[1] + 1.62, p.pos[2]], dx = t[0] - e[0], dy = t[1] - e[1], dz = t[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.viewYaw = p.yaw; p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); };
  });

  // ---------------------------------------------------------------- 1 · the character screen
  await section('1', async () => {
    console.log('1 · the character screen');
    const r = await ev(() => {
      const A = VR.Adventure, me = A.rec.me, out = [];
      const a = A.award('biome', { id: 'test-biome' }); out.push(a ? a.xp : -1);
      for (let i = 0; i < 14; i++) A.award('quest', { size: 'M', id: 'q' + i });
      A.addPoint('aus'); A.addPoint('aus'); A.addPoint('ges'); A.addPoint('spu');
      const st = VR.RPGame.st();
      for (const [seed, src] of [['c:a', 'chest'], ['o:b', 'outpost'], ['o:c', 'outpost'], ['c:d', 'chest']]) VR.RPGame.find(seed, src);
      return { boost: out[0], level: me.level, pts: VR.Adv.points(me), worn: Object.values(st.eq).filter(Boolean).length, bag: st.bag.length };
    });
    console.log('     ' + JSON.stringify(r));
    check(r.boost === 30, 'Anfängerglück: a first biome gives 30 XP at level 0 (15 × 2)');
    check(r.level >= 6 && r.worn >= 2, 'level ' + r.level + ', ' + r.worn + ' pieces worn');
    await ev(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyO', key: 'o', bubbles: true })));
    const open = await ev(() => VR.game.ui.screen);
    check(open === 'rpgchar', '[O] opens the character screen (' + open + ')');
    const dom = await ev(() => ({ slots: document.querySelectorAll('#rpgchar .rslot.has').length, stats: document.querySelectorAll('#rpgchar .rstat').length, bar: !!document.querySelector('#rpgchar .rbar i'), plus: document.querySelectorAll('#rpgchar [data-rp="pt"]:not([disabled])').length }));
    check(dom.slots >= 2 && dom.stats === 5 && dom.bar && dom.plus === 5, 'the figure with its gear, the XP bar, five stats with ＋ (' + JSON.stringify(dom) + ')');
    const before = await ev(() => VR.Adventure.rec.me.pts.ene);
    await page.click('#rpgchar [data-rp="pt"][data-stat="ene"]');
    check(await ev(() => VR.Adventure.rec.me.pts.ene) === before + 1, 'a point given right on the screen');
    await hold(2000);
    pics.char = await shot('rpg_character_screen');
    await release();
  });

  // ---------------------------------------------------------------- 2 · gear rarity
  await section('2', async () => {
    console.log('2 · rarities');
    const r = await ev(() => {
      const R = VR.RPG, st = VR.RPGame.st(), have = new Set(st.bag.map(i => i.r));
      for (let i = 0; i < 400 && have.size < 5; i++) { const it = R.roll('pick' + i, i % 2 ? 'boss' : 'chest', 7, 0); if (!have.has(it.r) && st.bag.length < 11) { R.give(st, it); have.add(it.r); } }
      const rad = st.bag.find(i => i.r === 4);
      VR.RPGame.sel = st.bag.indexOf(rad); VR.RPGame.render();
      VR.RPGame.card(rad, false, true);
      return { rar: [...have].sort().join(''), bag: st.bag.length };
    });
    check(r.rar === '01234', 'all five rarities in the bag (' + r.rar + ')');
    await hold(900);
    pics.gear = await shot('rpg_gear_rarity');
    await release();
    await ev(() => VR.RPGame.close());
  });

  // ---------------------------------------------------------------- 3 · the conquest
  let core = null;
  await section('3', async () => {
    console.log('3 · the conquest');
    const out = await ev(() => new Promise((res) => { const g = VR.game, p = g.player; g.pool.direct(0, { type: 'locate', dim: 'overworld', biome: 'outpost', x: Math.floor(p.pos[0]), z: Math.floor(p.pos[2]) }, null, (m) => res(m && m.pos)); }));
    console.log('     the nearest outpost: ' + JSON.stringify(out));
    if (!Array.isArray(out)) { check(false, 'the worker found an outpost'); return; }
    await ev((o) => { const p = VR.game.player; p.flying = true; p.safeTeleport(o[0] + 0.5, o[1] + 8, o[2] + 30.5); }, out);
    let pad = null;
    for (let i = 0; i < 120 && !pad; i++) { await run(10); await wait(200); pad = await ev((o) => { const g = VR.game, w = g.world, L = VR.Liberate; for (const [dx, dz] of [[-8, -8], [8, 8], [-8, 8], [8, -8]]) if (!w.isLoaded(o[0] + dx, o[2] + dz)) return null; return L.probeAt((x, y, z) => w.getBlock(x, y, z), o[0], o[1], o[2]) || { none: 1 }; }, out); }
    check(!!pad && !pad.none, 'its pad (' + JSON.stringify(pad && pad.beacon) + ')');
    if (!pad || pad.none) return;
    await ev((id) => { window.__site = id; }, pad.id);
    await run(300, 33, 'known');
    const tal0 = await ev(() => VR.Adventure.rec.me.taler);
    await ev(() => { const g = VR.game, s = VR.Liberate.siteOf(window.__site); return VR.Liberate.free(g, s); });
    const m = await run(600, 33, 'momentEnd');
    check(m.hit, 'freed (the moment ran ' + m.n + ' frames)');
    await wait(5200);
    const f = await ev(() => ({ found: !!VR.RPGame.lastFind && VR.RPGame.lastFind.id.indexOf('o:') === 0, taler: VR.Adventure.rec.me.taler, bursts: VR.RPGame.stats.bursts }));
    check(f.found, 'an outpost find followed the freeing');
    check(f.taler > tal0 && f.bursts >= 1, 'the Taler burst flew (' + (f.taler - tal0) + ' Taler)');
    // a second freed outpost and two known ones in the same region (the world's own outposts are far apart): the boss ready
    core = await ev((id) => {
      const A = VR.Adventure, rec = A.rec, s = VR.Liberate.siteOf(id), R = VR.RPG, S = R.BAL.REGION;
      const rx = Math.floor(s.x / S) * S, rz = Math.floor(s.z / S) * S, cl = (v, a) => Math.min(a + S - 40, Math.max(a + 40, v));
      const ox = cl(s.x + 90, rx), oz = cl(s.z + 70, rz);
      rec.freed['t_' + ox + '_' + oz] = { day: 1, as: 'trade', x: ox, y: s.y, z: oz, b: null, t: Date.now() };
      rec.sites['t_k1'] = { x: cl(s.x - 260, rx), y: s.y, z: cl(s.z + 300, rz), dir: 0, n: 3, res: 0, cal: 0, st: 'stoer', day: null, t: 0 };
      rec.sites['t_k2'] = { x: cl(s.x + 380, rx), y: s.y, z: cl(s.z - 240, rz), dir: 0, n: 3, res: 0, cal: 0, st: 'stoer', day: null, t: 0 };
      const C = R.conquest(VR.RPGame.sites(), VR.RPGame.st()), reg = C.regions.find(g => g.id === R.regionOf(s.x, s.z));
      return reg ? { id: reg.id, boss: reg.boss, core: reg.core, pct: C.pct, regPct: reg.pct } : null;
    }, pad.id);
    console.log('     ' + JSON.stringify(core));
    check(!!core && core.boss === 'ready', 'two freed in the region: the Kernfeuer wakes');
    const cl = await ev(() => { VR.RPGame.open('map'); const n = VR.RPGame.claim(); VR.RPGame.render(); return { n, c: !!document.getElementById('rpgmapc'), regs: document.querySelectorAll('#rpgchar .rreg').length, pct: (document.querySelector('#rpgchar .rworld b') || {}).textContent }; });
    check(cl.n > 0 && cl.c && cl.regs >= 1, 'the map: ' + cl.regs + ' region(s), ' + cl.pct + ', the tribute claimed (+' + cl.n + ')');
    await ev(() => { for (const id of ['advup', 'funkebub', 'rpgfind']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; } });
    await hold(1500);
    pics.map = await shot('rpg_conquest_map');
    await ev(() => { for (const id of ['advup', 'funkebub', 'rpgfind']) { const e = document.getElementById(id); if (e) e.style.visibility = ''; } });
    await release();
    await ev(() => VR.RPGame.close());
  });

  // ---------------------------------------------------------------- 4 · Der Turmgänger
  await section('4', async () => {
    console.log('4 · Der Turmgänger');
    if (!core || !core.core) { check(false, 'no Kernfeuer'); return; }
    await ev((c) => { const p = VR.game.player; p.flying = true; p.safeTeleport(c[0] + 0.5, 140, c[1] + 22.5); }, core.core);
    for (let i = 0; i < 120; i++) { await run(10); await wait(200); if (await ev((c) => VR.game.world.isLoaded(c[0], c[1]) && VR.game.world.isLoaded(c[0], c[1] + 22) && !VR.game.player.hold, core.core)) break; }
    await ev((c) => { const g = VR.game, p = g.player, y = g.world.topAt(c[0], c[1] + 18) + 1; p.flying = false; p.teleport(c[0] + 0.5, y, c[1] + 18.5); p.vel[0] = p.vel[1] = p.vel[2] = 0; g.env.setTime(5200); }, core.core);
    await ev(() => VR.RPGBoss.look());
    const r = await run(60, 33, 'boss');
    check(r.hit, 'it rises at the Kernfeuer');
    await run(200, 33, 'bossSt', 'idle');
    // the weak points: a hit on a closed knee counts as body (×0.35); in recover ×2
    const wk = await ev(() => { const C = VR.RPGBoss.cur, b = C.b; const st0 = b.st; const closed = b.open ? -1 : b.hit(10, 'weak'); return { st0, closed }; });
    check(wk.closed === 3.5, 'a closed weak point counts as body (' + JSON.stringify(wk) + ')');
    // bring the player near so it stomps; hold the frame at the warning
    await ev(() => { const g = VR.game, m = VR.RPGBoss.cur.m, p = g.player; const a = m.yaw; p.teleport(m.pos[0] - Math.sin(a) * 4.5, p.pos[1], m.pos[2] - Math.cos(a) * 4.5); p.vel[0] = p.vel[2] = 0; });
    const t = await run(400, 33, 'teleStomp');
    check(t.hit, 'a stomp telegraphed (the ring on the ground, the warning)');
    N.teleMin = await ev(() => VR.RPG.teleOf('stomp', VR.RPGBoss.cur.b.band));
    // the camera: back and up, the boss and its ring in view (the player stands still: the simulation is held)
    await ev(() => window.__cam(12, 0.5, 2));
    await ev(() => { const C = VR.RPGBoss.cur; C.fxT = 0; VR.RPGBoss.fx(VR.game, C, 0.1, 10); VR.RPGBoss.bar(true); });
    await draw(); await draw();
    await hold(500);
    pics.p1 = await shot('rpg_boss_phase1');
    await release();
    // phase 2: the shield holds, drones are up
    const p2 = await ev(() => { const C = VR.RPGBoss.cur, b = C.b; b.st = 'recover'; b.t = 0; b.hit(1e6, 'weak'); return b.st; });
    await run(130);
    const sh = await ev(() => { const C = VR.RPGBoss.cur, b = C.b; let n = 0; for (const m of VR.game.entities.mobs) if (m.foe && m.foe.rpgAdd) n++; return { ph: b.ph, shield: b.shield, held: b.hit(50, 'weak'), adds: n }; });
    check(p2 === 'stagger' && sh.ph === 2 && sh.shield && sh.held === 0 && sh.adds === 3, 'phase 2: the shield holds every hit, three drones (' + JSON.stringify(sh) + ')');
  });

  // ---------------------------------------------------------------- 5 · the finish
  await section('5', async () => {
    console.log('5 · the finish');
    const a0 = await ev(() => ({ xp: VR.Adventure.rec.me.xp, t: VR.Adventure.rec.me.taler }));
    await ev(() => { const b = VR.RPGBoss.cur.b; b.shield = false; b.ph = 3; b.st = 'recover'; b.hp = 1; b.hit(10, 'weak'); });
    const w = await run(260, 33, 'won');
    check(w.hit, 'it powers down and the region heals');
    await ev(() => window.__cam(14, 0.45, 2));
    await run(20);
    const r = await ev(() => { const st = VR.RPGame.st(), C = VR.RPGBoss.cur; return { won: !!st.won[C.rid], healed: !!st.healed[C.rid], xp: VR.Adventure.rec.me.xp, t: VR.Adventure.rec.me.taler, ban: (document.querySelector('#rpgwon .big') || {}).textContent }; });
    check(r.won && r.healed && r.xp > a0.xp + 500 && r.t > a0.t + 700, 'the boss reward and the healed region (' + JSON.stringify({ dxp: r.xp - a0.xp, dt: r.t - a0.t }) + ')');
    check(/atmet auf/.test(r.ban || ''), 'the banner „' + r.ban + '"');
    await draw(); await draw();
    await ev(() => { const el = document.getElementById('rpgwon'); if (el) { el.className = ''; void el.offsetWidth; el.className = 'on'; } });
    await hold(1200);
    pics.fin = await shot('rpg_boss_finish');
    await release();
    await wait(5600);
    const bf = await ev(() => VR.RPGame.lastFind && VR.RPGame.lastFind.id.indexOf('b:') === 0 ? VR.RPGame.lastFind.r : -1);
    check(bf >= 3, 'the boss find: splendid or radiant (' + bf + ')');
  });

  // ---------------------------------------------------------------- 6 · the loot burst
  await section('6', async () => {
    console.log('6 · the loot burst');
    await ev(() => { document.querySelectorAll('.rpgcoin,.rpgplus').forEach(e => e.remove()); const w = document.getElementById('rpgwon'); if (w) w.className = ''; const f = document.getElementById('rpgfind'); if (f) f.className = ''; });
    await ev(() => { if (VR.RPGBoss.cur) window.__cam(13, -0.4, 2); }); await draw();
    const n = await ev(() => VR.RPGame.burst(640, 0));
    check(n >= 20, 'a burst of ' + n + ' coins');
    await hold(650);
    pics.loot = await shot('rpg_loot_burst');
    await release();
  });

  // ---------------------------------------------------------------- 7 · the costs (CPU: the loop without drawing)
  await section('7', async () => {
    console.log('7 · the costs');
    const loop = (n) => ev((n) => { window.__norender = true; const g = VR.game; const t0 = performance.now(); for (let i = 0; i < n; i++) { g.last = performance.now() - 33; window.__step(performance.now()); } return (performance.now() - t0) / n; }, n);
    for (const pre of ['potato', 'high']) {
      await ev((p) => { VR.game.applyPreset(p); VR.game.applySettings('*'); }, pre);
      await ev(() => { if (VR.RPGBoss.cur) VR.RPGBoss.drop(VR.game); });
      await loop(30); const off = await loop(120);
      await ev(() => { const st = VR.RPGame.st(), C = VR.RPGBoss; for (const k in st.won) delete st.won[k]; C.look(); });
      await run(40); const on = await ev(() => !!VR.RPGBoss.cur);
      await loop(30); const fight = await loop(120);
      N[pre] = { noBoss: +off.toFixed(2), boss: +fight.toFixed(2), bossUp: on };
      console.log('     ' + pre + ': ' + JSON.stringify(N[pre]));
    }
    N.bossCost = await ev(() => { const c = VR.RPGBoss.cost; return { msPerFrame: c.frames ? +(c.ms / c.frames).toFixed(3) : 0, draws: c.draws, sparks: c.sparks }; });
    check(N.potato.boss <= N.potato.noBoss * 1.25 + 1, 'Very Low: the boss costs little on the CPU (' + N.potato.noBoss + ' → ' + N.potato.boss + ' ms)');
  });
  check(!logs.some(l => /pageerror/.test(l)), 'no page error' + (logs.length ? ' — ' + logs.slice(0, 3).join(' | ') : ''));
} catch (e) { fails++; console.log('  ✗ ' + (e.stack || e.message)); }
fs.writeFileSync(SHOTS + 'rpg_numbers.json', JSON.stringify(N, null, 1));
try {
  const rows = [['Charakter (O): Stufe, EP, Werte, Ausrüstung', pics.char], ['Seltenheiten: der Fund, der Rucksack', pics.gear], ['Eroberung: Gegenden, Prozent, Tagesbonus', pics.map], ['Der Turmgänger: Phase 1, Stampfer angekündigt', pics.p1], ['Die Gegend atmet auf', pics.fin], ['Heliataler fliegen zur Anzeige', pics.loot]].filter(r => r[1]);
  const spec = { w: 620, rows: [] }; for (let i = 0; i < rows.length; i += 2) spec.rows.push({ label: rows[i][0] + (rows[i + 1] ? ' · ' + rows[i + 1][0] : ''), imgs: [rows[i][1]].concat(rows[i + 1] ? [rows[i + 1][1]] : []) });
  fs.writeFileSync(SHOTS + 'rpg_sheet.json', JSON.stringify(spec));
  execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'rpg_sheet.jpg', SHOTS + 'rpg_sheet.json']);
  console.log('sheet test/shots/rpg_sheet.jpg');
} catch (e) { console.log('  (no sheet: ' + e.message.slice(0, 200) + ')'); }
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
