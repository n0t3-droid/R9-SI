// The boss fight as a cinematic experience in the page (a-boss2; plan docs/superpowers/plans/2026-10-30-a-boss2.md).
// One run, German UI, the same scenes twice — before (VR.RPGBoss2.off: a-rpg's fight) | after:
//   1. two outposts freed in the player's region: the Kernfeuer waits; the conquest tab → conquest_map
//   2. the boss rises: the entrance (the camera, the name banner) → boss_entrance
//   3. from 60 m: the arena, the boss's silhouette and its beam → boss_arena_far
//   4. a stomp announced: the ground's ring with its timing → boss_stomp (the ring counted in the picture)
//   5. phase 2: the shield, the drones, the bar's pips, Funke's hint → boss_phase2
//   6. the finish: the wave, the obelisk cyan, the boss bowing, the pedestal → boss_finish; the find taken: radiant
//   7. 🧸 Kindersicher: the calm version — no telegraph, the calm banner
//   8. the costs: the loop (CPU) and a drawn frame on Very Low and High, before / after
// → test/shots/boss_*_{before,after}.png, boss2_sheet.jpg, boss2_numbers.json
//   nohup bash test/wt_run.sh boss2.mjs 3600 > .tmp_tests/boss2.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
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
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /rpg boss/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
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
// warm (red-orange) pixels in the lower middle of a picture: the stomp's ground decal
const warm = async (p) => { const { data, info } = await sharp(p).raw().toBuffer({ resolveWithObject: true }); let n = 0; for (let y = Math.floor(info.height * 0.45); y < info.height; y += 2) for (let x = Math.floor(info.width * 0.15); x < info.width * 0.85; x += 2) { const o = (y * info.width + x) * info.channels, r = data[o], g = data[o + 1], b = data[o + 2]; if (r > 150 && r - g > 60 && r - b > 50) n++; } return n; };
const pics = { before: {}, after: {} };
const section = async (tag, fn) => { try { await fn(); } catch (e) { fails++; console.log('  ✗ section ' + tag + ' stopped: ' + (e.stack || e.message).slice(0, 900)); try { await release(); await page.screenshot({ path: SHOTS + 'boss2_fail_' + tag + '.png', timeout: 120000 }); } catch (e2) { /* */ } } };

try {
  await page.goto(DIST);
  for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title')) break; }
  check(await ev(() => !!(VR.RPGBoss && VR.RPGBoss2 && VR.RPGBoss2.drawMap)), 'VR.RPGBoss2 is in the page');
  await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.wowMoments = true; g.applySettings('*'); g.audio.resume(); if (VR.Hints) for (const h of ['play', 'move', 'fly']) VR.Hints.done(h); });
  await ev(`VR.game.createWorld({name:'Kernfeuer',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
  for (let i = 0; i < 200; i++) { await wait(500); if (await ev(() => VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)) break; }
  check(await ev(() => VR.game.state) === 'play', 'the world is open (' + secs() + ')');
  await ev(() => {
    const g = VR.game, L0 = Object.getPrototypeOf(g).loop;
    window.__step = (t) => L0.call(g, t); g.loop = function (t) { if (window.__live) return L0.call(this, t); };
    g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar');
    const st = document.createElement('style'); st.textContent = '#hints,#lockhint,#toasts,.toast,#uxkeys,#ctxprompt,#ctxring,#advup,#rpgfind{display:none !important}'; document.head.appendChild(st);
    const A = VR.Adventure; A.setOn(true); A.setEnc('normal');
    window.__says = []; const BS = VR.RPGBoss, o = BS.say; BS.say = function (g, t) { window.__says.push(t); return o.apply(this, arguments); };
    window.__c = {
      boss: () => !!VR.RPGBoss.cur,
      bossSt: (s) => !!VR.RPGBoss.cur && VR.RPGBoss.cur.b.st === s,
      teleStomp: () => !!VR.RPGBoss.cur && VR.RPGBoss.cur.b.st === 'tele' && VR.RPGBoss.cur.b.att === 'stomp' && VR.RPGBoss.cur.tele > 0.45,
      won: () => !!VR.RPGBoss.cur && VR.RPGBoss.cur.b.st === 'won',
      camOff: () => !VR.Liberate.mcam,
      arena: () => !!(VR.RPGBoss2.arena && VR.RPGBoss2.arena.ys),
    };
    window.__cam = (d, side, up, ty) => {
      const m = VR.RPGBoss.cur.m, p = g.player, t = [m.pos[0], m.pos[1] + (ty || 3.4), m.pos[2]];
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
    // the region: two freed outposts and a third known one round the player, the Kernfeuer between them
    const rec = A.rec, R = VR.RPG, S = R.BAL.REGION, p = g.player.pos;
    const rx = Math.floor(p[0] / S) * S, rz = Math.floor(p[2] / S) * S, cl = (v, a) => Math.min(a + S - 60, Math.max(a + 60, v));
    rec.sites = rec.sites || {}; rec.freed = rec.freed || {};
    const put = (id, dx, dz, free) => { const x = Math.round(cl(p[0] + dx, rx)), z = Math.round(cl(p[2] + dz, rz)); if (free) rec.freed[id] = { day: 1, as: 'trade', x, y: 70, z, b: null, t: Date.now() }; else rec.sites[id] = { x, y: 70, z, dir: 0, n: 3, res: 0, cal: 0, st: 'stoer', day: null, t: 0 }; };
    put('t_f1', 150, 40, true); put('t_f2', -110, 150, true); put('t_k1', 260, -220, false); put('t_k2', -330, -160, false);
    const C = R.conquest(VR.RPGame.sites(), VR.RPGame.st()); window.__reg = C.regions.find(q => q.boss === 'ready');
  });
  const reg = await ev(() => window.__reg && { id: window.__reg.id, core: window.__reg.core });
  check(!!reg, 'the region\'s Kernfeuer waits (' + JSON.stringify(reg) + ')');

  for (const mode of ['before', 'after']) {
    console.log('==== ' + mode);
    const P = pics[mode];
    await ev((off) => { const B2 = VR.RPGBoss2; B2.off = off; const g = VR.game, s = VR.RPGame.st(); if (VR.RPGBoss.cur) VR.RPGBoss.drop(g); for (const k in s.won) delete s.won[k]; for (const k in s.healed) delete s.healed[k]; for (const k in s.seen) if (k.indexOf('ped:') === 0 || k.indexOf('b:') === 0) delete s.seen[k]; B2.wave = null; B2.ped = null; VR.RPGBoss.healT = -1; window.__says.length = 0; if (VR.Liberate.mcam) VR.Liberate.camEnd(g); const p = g.player, c = window.__reg.core; p.flying = true; p.teleport(c[0] + 0.5, p.pos[1] + 20, c[1] + 160.5); }, mode === 'before');

    // ---------------------------------------------------------------- 1 · the map
    await section(mode + '1', async () => {
      const r = await ev(() => { VR.RPGame.open('map'); VR.RPGame.render(); return { goal: (document.querySelector('#rpgchar .rgoal b') || {}).textContent || '', leg: document.querySelectorAll('#rpgchar .rleg span').length }; });
      if (mode === 'after') check(/Kernfeuer/.test(r.goal) && r.leg === 6, 'the map: the next goal „' + r.goal + '", a legend of ' + r.leg);
      await ev(() => { const e = document.getElementById('funkebub'); if (e) e.style.visibility = 'hidden'; });
      await hold(1500);
      P.map = await shot('conquest_map_' + mode);
      await release(); await ev(() => { VR.RPGame.close(); const e = document.getElementById('funkebub'); if (e) e.style.visibility = ''; });
    });

    // ---------------------------------------------------------------- 2 · the entrance
    await section(mode + '2', async () => {
      const c = reg.core;
      await ev((c) => { const p = VR.game.player; p.flying = true; p.safeTeleport(c[0] + 0.5, 140, c[1] + 40.5); }, c);
      for (let i = 0; i < 120; i++) { await run(10); await wait(200); if (await ev((c) => VR.game.world.isLoaded(c[0], c[1]) && VR.game.world.isLoaded(c[0], c[1] + 40) && VR.game.world.isLoaded(c[0] + 20, c[1] - 20) && !VR.game.player.hold, c)) break; }
      await ev((c) => { const g = VR.game, p = g.player, y = g.world.topAt(c[0], c[1] + 30) + 1; p.flying = false; p.teleport(c[0] + 0.5, y, c[1] + 30.5); p.vel[0] = p.vel[1] = p.vel[2] = 0; g.env.setTime(5200); window.__aim([c[0], y + 4, c[1]]); }, c);
      if (mode === 'after') { const a = await run(40, 33, 'arena'); check(a.hit, 'the arena stands at the Kernfeuer (its ground read)'); }
      await ev(() => VR.RPGBoss.look());
      const r = await run(20, 33, 'boss');
      check(r.hit, 'it rises');
      await run(mode === 'after' ? 75 : 45);
      const e = await ev(() => ({ cam: !!(VR.Liberate.mcam && VR.Liberate.mcam.boss2), title: (document.querySelector('#rpgintro.on .big') || {}).textContent || '', st: VR.RPGBoss.cur.b.st, rise: VR.RPGBoss.cur.rise }));
      if (mode === 'after') check(e.cam && /Turmgänger/i.test(e.title) && e.st === 'intro', 'the entrance: the camera, the banner „' + e.title + '", the fight waits (' + e.st + ')');
      else await ev(() => { const C = VR.RPGBoss.cur, g = VR.game; window.__aim([C.m.pos[0], C.m.pos[1] + 4, C.m.pos[2]]); });
      await draw(); await draw();
      await hold(1300);
      P.entr = await shot('boss_entrance_' + mode);
      await release();
      if (mode === 'after') { const k = await run(260, 33, 'camOff'); check(k.hit, 'the camera hands back (' + k.n + ' frames)'); }
    });

    // ---------------------------------------------------------------- 3 · from 60 m
    await section(mode + '3', async () => {
      await run(40);
      await ev(() => { const g = VR.game, A = VR.RPGBoss2.arena, m = VR.RPGBoss.cur.m, cx = A ? A.x : m.pos[0], cz = A ? A.z : m.pos[2], p = g.player; const a = Math.atan2(p.pos[0] - cx, p.pos[2] - cz), x = cx + Math.sin(a) * 60, z = cz + Math.cos(a) * 60, y = Math.max(g.world.topAt(Math.floor(x), Math.floor(z)) + 3, m.pos[1] + 9); p.flying = true; p.teleport(x, y, z); p.vel[0] = p.vel[1] = p.vel[2] = 0; window.__aim([cx, m.pos[1] + 4, cz]); VR.RPGBoss.cur.b.st = 'idle'; VR.RPGBoss.cur.b.t = 0; VR.RPGBoss.cur.b.cool = 9; });
      await run(6); await draw(); await draw();
      P.far = await shot('boss_arena_far_' + mode);
      if (mode === 'after') { const n = await ev(() => ({ vox: VR.RPGBoss2.cost.vox, dec: VR.RPGBoss2.cost.decals })); check(n.vox > 10 && n.dec > 5, 'the arena drawn (voxel draws ' + n.vox + ', decal draws ' + n.dec + ' so far)'); }
    });

    // ---------------------------------------------------------------- 4 · a stomp
    await section(mode + '4', async () => {
      await ev(() => { const g = VR.game, C = VR.RPGBoss.cur, m = C.m, p = g.player; p.flying = false; const a = m.yaw; p.teleport(m.pos[0] - Math.sin(a) * 4.5, m.pos[1] + 0.2, m.pos[2] - Math.cos(a) * 4.5); p.vel[0] = p.vel[2] = 0; C.b.cool = 0.2; });
      const t = await run(400, 33, 'teleStomp');
      check(t.hit, 'a stomp announced');
      await ev(() => window.__cam(15, 0.6, 5, 0.5));
      await ev(() => { const C = VR.RPGBoss.cur; C.fxT = 0; VR.RPGBoss.fx(VR.game, C, 0.1, 10); VR.RPGBoss.bar(true); });
      await draw(); await draw();
      P.stomp = await shot('boss_stomp_' + mode);
      N['warm_' + mode] = await warm(P.stomp);
      if (mode === 'after') check(N.warm_before > 300 && N.warm_after > 1500, 'the ground\'s ring shows in the picture, before and after (' + N.warm_before + ' → ' + N.warm_after + ' warm pixels)');
    });

    // ---------------------------------------------------------------- 5 · phase 2
    await section(mode + '5', async () => {
      await ev(() => { const C = VR.RPGBoss.cur, b = C.b; b.st = 'recover'; b.t = 0; b.hit(1e6, 'weak'); });
      await run(130);
      const r = await ev(() => { const C = VR.RPGBoss.cur, b = C.b; let n = 0; for (const m of VR.game.entities.mobs) if (m.foe && m.foe.rpgAdd) n++; VR.RPGBoss.bar(true); return { ph: b.ph, shield: b.shield, adds: n, pips: [...document.querySelectorAll('#rpgbossbar .pips i')].map(i => i.className).join(','), says: window.__says.slice() }; });
      if (mode === 'after') {
        check(r.ph === 2 && r.shield && r.adds === 3, 'phase 2: the shield, three drones');
        check(r.pips === 'done,on,', 'the bar\'s pips: I done, II on (' + r.pips + ')');
        const hints = r.says.filter(s => /Phase 2|Schild hält/.test(s)).length;
        check(hints === 1 && !r.says.some(s => /^Schild! Bring/.test(s)), 'Funke: one hint for phase 2 (' + r.says.length + ' said: ' + r.says.map(s => s.slice(0, 24)).join(' | ') + ')');
      }
      await ev(() => window.__cam(VR.RPGBoss2.off ? 16 : 19, 0.4, 4, 4));
      await ev(() => { const fk = VR.game.funke; if (fk && fk.show) fk.show(VR.I18N.t(VR.RPGBoss2.off ? 'g.rpg.boss.shield' : 'g.rpg.boss2.hint2')); });
      await run(4); await draw(); await draw();
      await hold(600);
      P.p2 = await shot('boss_phase2_' + mode);
      await release();
    });

    // ---------------------------------------------------------------- 6 · the finish
    await section(mode + '6', async () => {
      await ev(() => { const b = VR.RPGBoss.cur.b; b.shield = false; b.ph = 3; b.st = 'recover'; b.hp = 1; b.hit(10, 'weak'); });
      await ev(() => { window.__lf = VR.RPGame.lastFind; });
      const w = await run(260, 33, 'won');
      check(w.hit, 'it powers down');
      await ev(() => { const A = VR.RPGBoss2.arena; window.__cam(VR.RPGBoss2.off ? 16 : 30, 0.9, VR.RPGBoss2.off ? 4 : 10, 3); const fb = document.getElementById('funkebub'); if (fb) fb.style.visibility = 'hidden'; if (A && !VR.RPGBoss2.off) window.__aim([(A.x + VR.RPGBoss.cur.m.pos[0]) / 2, A.y + 5, (A.z + VR.RPGBoss.cur.m.pos[2]) / 2]); });
      await run(mode === 'after' ? 40 : 20);
      await draw(); await draw();
      await ev(() => { const el = document.getElementById('rpgwon'); if (el) { el.className = ''; void el.offsetWidth; el.className = 'on'; } });
      await hold(1200);
      P.fin = await shot('boss_finish_' + mode);
      await release(); await ev(() => { const fb = document.getElementById('funkebub'); if (fb) fb.style.visibility = ''; });
      if (mode === 'before') await wait(5600);   // (a-rpg's boss find comes 5.2 s after the finish)
      if (mode === 'after') {
        const s = await ev(() => { const B2 = VR.RPGBoss2; return { wave: !!B2.wave, heal: B2.arena && B2.arena.heal, ped: !!B2.ped && !B2.ped.taken, sub: (document.querySelector('#rpgwon .sub') || {}).textContent }; });
        check(s.wave && s.heal > 0.9 && s.ped, 'the wave runs, the obelisk heals, the find waits on the pedestal (' + JSON.stringify(s) + ')');
        await wait(5600);
        const f0 = await ev(() => VR.RPGame.lastFind !== window.__lf);
        check(!f0, 'no find before the pedestal is reached');
        await ev(() => { const P = VR.RPGBoss2.ped, p = VR.game.player; p.flying = false; p.teleport(P.x + 1, P.y + 0.1, P.z + 1); });
        await run(25);
        const r = await ev(() => VR.RPGame.lastFind && VR.RPGame.lastFind.id.indexOf('b:') === 0 ? VR.RPGame.lastFind.r : -1);
        check(r === 4, 'the pedestal\'s find: radiant (' + r + ')');
      }
    });
  }

  // ---------------------------------------------------------------- 7 · Kindersicher
  await section('7', async () => {
    await ev(() => { const g = VR.game, s = VR.RPGame.st(); if (VR.RPGBoss.cur) VR.RPGBoss.drop(g); for (const k in s.won) delete s.won[k]; VR.RPGBoss2.wave = null; g.settings.kids = true; const A = VR.RPGBoss2.arena, p = g.player; p.flying = false; p.teleport(A.x + 18, g.world.topAt(Math.floor(A.x + 18), Math.floor(A.z)) + 1, A.z); });
    await ev(() => VR.RPGBoss.look());
    await run(20, 33, 'boss');
    await run(300);
    const r = await ev(() => { const C = VR.RPGBoss.cur; return { calm: C && C.b.calm, sub: (document.querySelector('#rpgintro .sub') || {}).textContent || '', st: C && C.b.st }; });
    check(r.calm && /beruhige/.test(r.sub) && r.st !== 'tele', 'Kindersicher: the calm version, its banner „' + r.sub + '", never a telegraph');
    await ev(() => { VR.game.settings.kids = false; if (VR.Liberate.mcam) VR.Liberate.camEnd(VR.game); });
  });

  // ---------------------------------------------------------------- 8 · the costs
  await section('8', async () => {
    console.log('8 · the costs');
    const loop = (n) => ev((n) => { window.__norender = true; const g = VR.game; let best = 1e9; for (let r = 0; r < 3; r++) { const t0 = performance.now(); for (let i = 0; i < n / 3; i++) { g.last = performance.now() - 33; window.__step(performance.now()); } best = Math.min(best, (performance.now() - t0) / (n / 3)); } return best; }, n);   // (the best of three: the machine is shared)
    const frame = (n) => ev((n) => { window.__norender = false; const g = VR.game; let s = 0; for (let i = 0; i < n; i++) { const t0 = performance.now(); g.last = performance.now() - 33; window.__step(performance.now()); g.renderer.gl.finish(); s += performance.now() - t0; } window.__norender = true; return s / n; }, n);
    for (const pre of ['potato', 'high']) {
      await ev((p) => { VR.game.applyPreset(p); VR.game.applySettings('*'); }, pre);
      N[pre] = {};
      for (const mode of ['before', 'after']) {
        await ev((off) => { const g = VR.game, s = VR.RPGame.st(), B2 = VR.RPGBoss2; B2.off = off; if (VR.RPGBoss.cur) VR.RPGBoss.drop(g); for (const k in s.won) delete s.won[k]; B2.wave = null; if (VR.Liberate.mcam) VR.Liberate.camEnd(g); const A = B2.arena || { x: window.__reg.core[0], z: window.__reg.core[1] }, p = g.player; p.flying = true; p.teleport(A.x + 14, g.world.topAt(Math.floor(A.x + 14), Math.floor(A.z)) + 3, A.z); window.__aim([A.x, p.pos[1], A.z]); }, mode === 'before');
        await loop(20); const noBoss = await loop(80);
        await ev(() => VR.RPGBoss.look()); await run(40); await ev(() => { if (VR.Liberate.mcam) VR.Liberate.camEnd(VR.game); });
        await ev(() => { const c = VR.RPGBoss2.cost; c.frames = 0; c.ms = 0; });
        await loop(20); const boss = await loop(80);
        const own = await ev(() => { const c = VR.RPGBoss2.cost; return c.frames ? +(c.ms / c.frames).toFixed(3) : 0; });
        await frame(4); const drawn = await frame(12);
        N[pre][mode] = { noBoss: +noBoss.toFixed(2), boss: +boss.toFixed(2), frame: +drawn.toFixed(1), b2ms: own };
      }
      console.log('     ' + pre + ': ' + JSON.stringify(N[pre]));
    }
    N.b2 = await ev(() => { const c = VR.RPGBoss2.cost; return { msPerFrame: c.frames ? +(c.ms / c.frames).toFixed(3) : 0, verts: c.verts }; });
    check(N.potato.after.b2ms <= 0.15 && N.potato.after.boss <= N.potato.before.boss * 1.5 + 1, 'Very Low: a-boss2\'s own work ' + N.potato.after.b2ms + ' ms a frame; the loop with the boss ' + N.potato.before.boss + ' → ' + N.potato.after.boss + ' ms (best of three)');
    check(N.potato.after.frame <= N.potato.before.frame * 1.3 + 4, 'Very Low: a drawn frame at the arena ' + N.potato.before.frame + ' → ' + N.potato.after.frame + ' ms (SwiftShader)');
  });
  check(!logs.some(l => /pageerror|rpg boss/.test(l)), 'no page error, no boss warning' + (logs.length ? ' — ' + logs.slice(0, 3).join(' | ') : ''));
} catch (e) { fails++; console.log('  ✗ ' + (e.stack || e.message)); }
fs.writeFileSync(SHOTS + 'boss2_numbers.json', JSON.stringify(N, null, 1));
try {
  const L = { far: 'Aus 60 m: Arena, Silhouette, Suchstrahl', entr: 'Der Auftritt: Kamera, Name, Musik', stomp: 'Stampfer: Bodenring mit Zeitring', p2: 'Phase 2: Schild, Drohnen, Phasen-Leiste, Funkes Tipp', fin: 'Das Finale: Welle, Kernfeuer cyan, Sockel', map: 'Eroberungskarte: Symbole, Farben, nächstes Ziel' };
  const spec = { w: 620, rows: [] };
  for (const k of ['far', 'entr', 'stomp', 'p2', 'fin', 'map']) { const a = pics.before[k], b = pics.after[k]; if (a || b) spec.rows.push({ label: L[k] + ' — vorher | nachher', imgs: [a, b].filter(Boolean) }); }
  fs.writeFileSync(SHOTS + 'boss2_sheet.json', JSON.stringify(spec));
  execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'boss2_sheet.jpg', SHOTS + 'boss2_sheet.json']);
  console.log('sheet test/shots/boss2_sheet.jpg');
} catch (e) { console.log('  (no sheet: ' + e.message.slice(0, 200) + ')'); }
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
