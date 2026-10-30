// a-konvoi · two players across worlds in the browser (docs/superpowers/plans/2026-10-30-a-konvoi.md §3): host and guest in
// two pages of one browser (?mp=local — BroadcastChannel over a local http server of this checkout), 960 × 540, de-DE.
//   1 an outpost freed together: the host frees it, the guest sees the moment (freed_together.png)
//   2 the Konvoi: both in orbit over the Heartland, the host engages the Reiseantrieb to Opal, the guest says Ja and flies
//     beside it (konvoi.png, konvoi_host.png); the bytes the guest sends a second in the cruise (≤ 2 KB/s)
//   3 landing together: the host lands, the guest goes down with it into Opal's world (landed_together.png)
//   4 Nein: the host goes home, the guest stays on Opal, kindly told, still in the session
// → .tmp_tests/konvoi_run.json.   usage: nohup bash test/wt_run.sh konvoi.mjs 3600 > .tmp_tests/konvoi.log 2>&1 &
// regress: skip  (a showcase with two pages; the gates are test/konvoi.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\.tmp_tests\/$/, '');
const R0 = fs.existsSync(ROOT + 'dist/index.html') ? ROOT : new URL('../../', import.meta.url).pathname;
const SHOTS = R0 + 'test/shots/', PORT = 8790 + Math.floor(Math.random() * 150);
fs.mkdirSync(SHOTS, { recursive: true });
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: R0 + 'dist', stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0; const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const rec = {};
const save = () => { try { fs.writeFileSync(R0 + '.tmp_tests/konvoi_run.json', JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
const logs = [];
const wait = (ms) => new Promise(r => setTimeout(r, ms));
async function mk(tag) {
  const page = await ctx.newPage();
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${tag} ${t}] ${s.slice(0, 400)}`); });
  page.on('pageerror', e => logs.push(`[${tag} pageerror] ` + (e.stack || e.message).slice(0, 1200)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html?mp=local:kv${PORT}`);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(() => { const g = VR.game, r = g.renderer; r._render = r.render; r.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; window.__norender = true; });
  const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) await ev(([m, d]) => { const g = VR.game; window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); };
  return { tag, page, ev, step };
}
const A = await mk('host'), B = await mk('guest');
const both = async (n, dtms = 33) => { for (let i = 0; i < n; i += 5) { await A.step(Math.min(5, n - i), dtms); await B.step(Math.min(5, n - i), dtms); await wait(5); } };
// a real frame drawn, then the screen (the HUD's roster, cards and banner with it)
const shot = async (P, name) => { await P.ev(() => { window.__norender = false; const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); g.loop(performance.now() + 1); g.renderer.gl.finish(); window.__norender = true; }); await wait(120); await P.page.screenshot({ path: SHOTS + name, timeout: 120000 }); console.log('  shot ' + name + ' (' + secs() + ')'); };
const view = (P, v, hp, hy) => P.ev(([v, hp, hy]) => { const fl = VR.game.flight; if (!fl) return; fl.view = v; VR.game.camMode = v === 0 ? 0 : 1; fl.headPitch = hp; fl.headYaw = hy || 0; fl.backT = 0; fl.recenter = false; fl.mouseIdle = 0; fl.chaseYaw = null; fl.shot = null; fl.shakeAmp = 0; fl.bump = 0; }, [v, hp, hy]);
const crs = (P) => P.ev(() => { const g = VR.game, fl = g.flight, a = fl && fl.asc, c = a && a.cruise, L = g.cruiseLand; return { state: g.state, dim: g.dim, regime: fl ? fl.regime || 'air' : null, frame: a ? a.st.frame : null, phase: c ? c.phase || c.kind : null, dist: c && c.dist, total: c && c.total, fl: fl ? fl.state : null, land: L ? Math.round(L.alt) : null }; });

try {
  for (const P of [A, B]) await P.ev(() => { const g = VR.game; g.settings.renderDist = 5; g.settings.dynRes = false; g.settings.camShake = false; g.applySettings('*'); window.requestAnimationFrame = () => 0; });
  await A.ev(() => { VR.game.settings.playerName = 'R9'; VR.game.mp.confirmNotice(); });
  await B.ev(() => { VR.game.settings.playerName = 'Buddy'; VR.game.mp.confirmNotice(); });
  // ---- the host's Abenteuer world, the guest joins
  await A.ev(() => { if (VR.Adventure) VR.Adventure.pendingCreate = { at: Date.now(), band: 'normal', enc: 'on' }; return VR.game.createWorld({ name: 'Konvoi', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: '53', cheats: true, kit: true }); });
  for (let i = 0; i < 90; i++) { await wait(1000); if (await A.ev(() => VR.game.state) === 'play') break; }
  await A.step(30);
  for (let i = 0; i < 30; i++) { if (await B.ev(() => VR.game.mp.hostList().length)) break; await A.step(5); await wait(400); }
  await B.ev(() => VR.game.mp.join(VR.game.mp.hostList()[0]));
  for (let i = 0; i < 200; i++) { await A.step(5); await B.step(10); if (await B.ev(() => VR.game.state) === 'play') break; await wait(150); }
  await both(40);
  const j = await B.ev(() => ({ state: VR.game.state, guest: !!(VR.game.meta && VR.game.meta.guest), dim: VR.game.dim, kv: !!VR.Konvoi }));
  check(j.state === 'play' && j.guest && j.kv, `the guest joins the host's world (${JSON.stringify(j)}) (${secs()})`);
  const adv = await A.ev(() => !!(VR.Adventure && VR.Adventure.on && VR.Adventure.on()));
  console.log('  the host\'s Abenteuer on: ' + adv);

  // ---- 1 · an outpost freed together
  const site = await A.ev(() => {
    const g = VR.game, p = g.player, w = g.world, L = VR.Liberate;
    const x = Math.floor(p.pos[0]) + 9, z = Math.floor(p.pos[2]) - 4; let y = 200; while (y > 20 && !w.getBlock(x, y, z)) y--;
    const s = L.site({ x, y, z, dir: 0, strays: 0 }); s.id = x + '_' + z; s.beacon = [x, y + 1, z]; s.known = true; s.tier = 3;
    L.W.sites.set(s.id, s);
    return { id: s.id, b: s.beacon };
  });
  // the guest beside the host, both looking at the beacon
  await B.ev((b) => { const g = VR.game, h = g.mp.players()[0], p = g.player; p.flying = true; p.teleport(h.pos[0] - 6, b[1] + 3, h.pos[2] + 10); p.yaw = Math.atan2(-(b[0] - p.pos[0]), -(b[2] - p.pos[2])); p.pitch = -0.2; }, site.b);
  await A.ev((b) => { const g = VR.game, p = g.player; p.flying = true; p.teleport(p.pos[0], b[1] + 2, p.pos[2]); p.yaw = Math.atan2(-(b[0] - p.pos[0]), -(b[2] - p.pos[2])); }, site.b);
  await both(30);
  const freed = await A.ev((id) => VR.Liberate.free(VR.game, VR.Liberate.siteOf(id)), site.id);
  check(freed, 'the host frees the outpost (VR.Liberate.free)');
  let gm = null;
  for (let i = 0; i < 40; i++) { await both(5); gm = await B.ev(() => { const M = VR.Konvoi.S.moment; return M ? { id: M.id, t: +M.t.toFixed(2), r: M.r, ban: M.bannered } : null; }); if (gm && gm.t > 2.5) break; }
  rec.freed = gm;
  check(!!gm && gm.id === site.id, `the guest sees the moment (${JSON.stringify(gm)})`);
  await shot(B, 'freed_together.png');
  await shot(A, 'freed_host.png');
  for (let i = 0; i < 12; i++) { await both(5); const g2 = await B.ev(() => !!(VR.Konvoi.S.moment && VR.Konvoi.S.moment.r)); if (g2) break; }
  const lf = await B.ev((b) => VR.game.world.getBlock(b[0], b[1], b[2]) === VR.R.byName.leuchtfeuer.state({ frei: 1 }), site.b);
  rec.freedBeacon = lf;
  console.log(`  the beacon cyan at the guest: ${lf}; the reward there: ${JSON.stringify(await B.ev(() => VR.Konvoi.S.moment && VR.Konvoi.S.moment.r))}`);
  save();

  // ---- 2 · the Konvoi: both in orbit, the host's Reiseantrieb to Opal, the guest along
  for (const P of [A, B]) await P.ev((seed) => { const g = VR.game, p = g.player; p.flying = false; g.starships.placeInFront(seed, 'shuttle', null, p); }, P === A ? 4242 : 4343);
  for (let i = 0; i < 90; i++) { await both(5); const ok = await A.ev(() => !!VR.game.starships.ships.find(q => q.d.seed === 4242 && q.d.cells)) && await B.ev(() => !!VR.game.starships.ships.find(q => q.d.seed === 4343 && q.d.cells)); if (ok) break; await wait(100); }
  for (const P of [A, B]) await P.ev((seed) => { const g = VR.game, s = g.starships.ships.find(q => q.d.seed === seed && !q.hangar); g.starships.board(s, g.player); s.flight.power = 'running'; s.flight.startT = 3; }, P === A ? 4242 : 4343);
  await both(20);
  // the hour Opal is lit from Herzwelt's side (as test/cruise.mjs), on both pages
  for (const P of [A, B]) await P.ev(() => {
    const U = VR.Universe, S = U.home; let best = null;
    for (let day = 2; day < 30; day++) for (let tk = 0; tk < 24000; tk += 1200) { const st = S.state(U.worldSeconds(day, tk)), o = st.b.opal.r, h = st.b.herz.r, sun = st.b.helia.r; const u = (p, q) => { const d = [p[0] - q[0], p[1] - q[1], p[2] - q[2]], l = Math.hypot(...d); return [d[0] / l, d[1] / l, d[2] / l]; }; const a = u(sun, o), b = u(h, o), lit = a[0] * b[0] + a[1] * b[1] + a[2] * b[2], D = Math.hypot(o[0] - h[0], o[1] - h[1], o[2] - h[2]); const sc = lit * 2 - D / 1.2e7; if (!best || sc > best.sc) best = { day, tk, sc }; }
    const g = VR.game; g.env.day = best.day; g.env.setTime(best.tk); g.zenFreezeTime = true;
  });
  for (const P of [A, B]) await P.ev(() => VR.SpaceFlight.debug.orbit(VR.game, 0, 40, 3063));
  for (let i = 0; i < 60; i++) { await both(6, 1); const r = await B.ev(() => { const n = VR.SpaceScene && VR.SpaceScene.cur_need || []; return n.length && n.every(s => s.done); }); if (r) break; await wait(80); }
  const sp0 = [await crs(A), await crs(B)];
  console.log('  in orbit: ' + JSON.stringify(sp0));
  check(sp0[0].regime === 'space' && sp0[1].regime === 'space', 'both ships in orbit over the Heartland');
  const started = await A.ev(() => VR.Cruise.start(VR.game.flight, 'opal'));
  check(started, 'the host engages the Reiseantrieb to Opal');
  let asked = null;
  for (let i = 0; i < 20; i++) { await A.step(1); await B.step(1); await wait(30); asked = await B.ev(() => VR.Konvoi.S.ask && { kind: VR.Konvoi.S.ask.kind, card: (document.getElementById('kvask') || {}).textContent || '' }); if (asked) break; }
  check(!!asked && asked.kind === 'cruise' && /Mitreisen/.test(asked.card), `the guest is asked „Mitreisen?" (${JSON.stringify(asked)})`);
  await shot(B, 'konvoi_ask.png');
  await B.ev(() => { VR.Konvoi.answer(true); VR.Konvoi.rateReset(); window.__kvB0 = VR.Konvoi.S.sent.bytes; window.__kvT0 = VR.game.flight.asc.st.t; });
  await both(4);
  const f0 = await B.ev(() => ({ form: VR.Konvoi.S.form, phase: VR.game.flight.asc.cruise && VR.game.flight.asc.cruise.phase }));
  const fh = await A.ev(() => [...VR.Konvoi.S.followers.entries()]);
  check(!!f0.form && !!f0.phase && fh.length === 1, `the guest flies in formation (${JSON.stringify(f0)}; the host's followers ${JSON.stringify(fh)})`);
  let s = await crs(A), sb = await crs(B), D0 = s.dist, pic = false;
  for (let i = 0; i < 900 && (s.phase || sb.phase); i++) {
    await both(5); s = await crs(A); sb = await crs(B);
    if (!pic && sb.phase === 'cruise' && sb.dist < 0.55 * D0) {
      await view(B, 1, 0.12, 0.45); await view(A, 1, 0.12, -0.45); await B.step(1); await A.step(1);
      const seen = await B.ev(() => { const a = [...VR.game.mp.remote.values()][0]; return { ship: !!(a && a.ship), pos: a && a.ship && a.ship.pos.map(Math.round), me: VR.game.flight.b.pos.map(Math.round), away: a && a.away, d: a && a.d }; });
      rec.konvoiSeen = seen; console.log('  the host as the guest sees it: ' + JSON.stringify(seen));
      check(seen.ship && !seen.away, 'the guest draws the host\'s ship beside its own in the cruise');
      await shot(B, 'konvoi.png'); await shot(A, 'konvoi_host.png'); pic = true;
      await view(B, 1, 0.1, 0); await view(A, 1, 0.1, 0);
    }
  }
  const bw = await B.ev(() => ({ bytes: VR.Konvoi.S.sent.bytes - window.__kvB0, simS: VR.game.flight.asc.st.t - window.__kvT0, n: VR.Konvoi.S.sent.n }));
  bw.bps = Math.round(bw.bytes / Math.max(1, bw.simS));
  rec.bandwidth = bw;
  console.log(`  the guest sent ${bw.bytes} B in ${bw.simS.toFixed(1)} s of the cruise (${bw.n} sends): ${bw.bps} B/s (${secs()})`);
  check(bw.simS > 10 && bw.bps <= 2048, `a guest in the Konvoi sends ≤ 2 KB/s (${bw.bps} B/s)`);
  check(s.frame === 'opal' && sb.frame === 'opal', `both arrive in orbit round Opal (${s.frame}, ${sb.frame})`);
  save();

  // ---- 3 · landing together on Opal
  await both(60);
  await A.ev(() => VR.SpaceFlight.land(VR.game.flight));
  let a3 = null, b3 = null;
  for (let i = 0; i < 500; i++) {
    await both(5); await wait(30);
    a3 = await crs(A); b3 = await crs(B);
    if (i % 40 === 0) console.log(`    host ${a3.state} ${a3.dim} ${a3.fl} ${a3.land} · guest ${b3.state} ${b3.dim} ${b3.fl} ${b3.land} (${secs()})`);
    if (a3.dim === 'opal' && b3.dim === 'opal' && a3.fl === 'landed' && b3.fl === 'landed' && a3.state === 'play' && b3.state === 'play') break;
  }
  rec.landed = { host: a3, guest: b3 };
  check(a3.dim === 'opal' && b3.dim === 'opal' && b3.state === 'play', `both in Opal's world (${a3.dim}/${a3.fl}, ${b3.dim}/${b3.fl})`);
  check(a3.fl === 'landed' && b3.fl === 'landed', 'both ships landed on Opal');
  const mods = await B.ev(() => ({ mods: VR.game.mp.modKeys.size, role: VR.game.mp.role, see: VR.game.mp.players().length, away: [...VR.game.mp.remote.values()].map(a => a.away) }));
  console.log('  the guest on Opal: ' + JSON.stringify(mods));
  check(mods.role === 'client' && mods.see === 1 && !mods.away[0], 'still in the session on Opal, the host seen there');
  // the guest looks at the host's ship
  await B.ev(() => { const g = VR.game, a = [...g.mp.remote.values()][0], fl = g.flight; if (!a || !fl) return; const sp = a.ship && a.ship.pos || a.pos; const dx = sp[0] - fl.b.pos[0], dz = sp[2] - fl.b.pos[2]; fl.view = 1; g.camMode = 1; fl.headYaw = Math.atan2(-dx, -dz) - fl.b.heading; fl.headPitch = 0.18; fl.chaseYaw = null; fl.recenter = false; fl.mouseIdle = 0; });
  await both(30);
  await shot(B, 'landed_together.png'); await shot(A, 'landed_host.png');
  save();

  // ---- 4 · Nein: the host goes home, the guest stays (kindly told, still in the session)
  await A.ev(() => VR.game.goHome());
  let q4 = null;
  for (let i = 0; i < 60; i++) { await both(5); await wait(60); q4 = await B.ev(() => VR.Konvoi.S.ask && VR.Konvoi.S.ask.kind); if (q4) break; }
  check(q4 === 'travel', 'the guest is asked again when the host goes home');
  await B.ev(() => VR.Konvoi.answer(false));
  for (let i = 0; i < 160; i++) { await both(5); await wait(60); if (await A.ev(() => VR.game.state === 'play' && VR.game.dim === 'overworld')) break; }
  await both(40);
  const st4 = await B.ev(() => ({ state: VR.game.state, dim: VR.game.dim, role: VR.game.mp.role, stay: !!document.getElementById('kvstay'), away: [...VR.game.mp.remote.values()].map(a => [a.d, a.away]) }));
  const h4 = await A.ev(() => ({ dim: VR.game.dim, role: VR.game.mp.role, guests: VR.game.mp.remote.size }));
  rec.stay = { guest: st4, host: h4 };
  console.log('  after Nein: ' + JSON.stringify(rec.stay));
  check(st4.state === 'play' && st4.dim === 'opal' && st4.role === 'client' && st4.stay && h4.role === 'host' && h4.dim === 'overworld' && h4.guests === 1, 'Nein: the guest stays on Opal with Heimkehr / Nachreisen, the host home, both still in the session');
  await shot(B, 'konvoi_stay.png');
} catch (e) { fails++; console.log('  ✗ the run broke: ' + (e.stack || e).toString().slice(0, 800)); }
save();
const errs = logs.filter(l => /pageerror/.test(l));
check(!errs.length, `no page errors (${errs.length})`);
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 30)) console.log(l);
await browser.close(); srv.kill();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
