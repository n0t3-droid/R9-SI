// two players, one world: host + guest in two pages (BroadcastChannel transport over a local http server)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8765', '--bind', '127.0.0.1'], { cwd: '/home/claude/vr/dist', stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
const logs = [];
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const mk = async (tag) => {
  const page = await ctx.newPage();
  page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail|mp /i.test(s)) logs.push(`[${tag} ${t}] ${s.slice(0, 500)}`); });
  page.on('pageerror', e => logs.push(`[${tag} pageerror] ` + (e.stack || e.message).slice(0, 1200)));
  await page.goto('http://127.0.0.1:8765/index.html?mp=local:t1');
  return page;
};
const A = await mk('A');
const B = await mk('B');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const step = async (page, n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(page, ([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); } };
const both = async (n) => { for (let i = 0; i < n; i++) { await step(A, 10); await step(B, 10); await wait(30); } };
const shot = async (page, name) => { await ev(page, () => { window.__norender = false; const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }); await wait(150); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(A, () => VR.game && VR.game.state === 'title') && await ev(B, () => VR.game && VR.game.state === 'title')) break; }
for (const p of [A, B]) await ev(p, () => { const g = VR.game; g.settings.renderDist = 5; g.settings.dynRes = false; g.settings.horizon = 1; g.applySettings('*'); });
await ev(A, () => { VR.game.settings.playerName = 'R9'; });
await ev(B, () => { VR.game.settings.playerName = 'Buddy'; });
// 👥 both answer the one-time name notice (before it the lobby sees „Explorer“ only; test/legal.mjs checks the card)
console.log('notice before', JSON.stringify(await ev(A, () => ({ ok: VR.game.mp.noticeOk(), card: !!document.getElementById('r9mpcard') }))));
await ev(A, () => VR.game.mp.confirmNotice());
await ev(B, () => VR.game.mp.confirmNotice());
// host creates a world
await ev(A, () => VR.game.createWorld({ name: 'Our World', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: '424242', cheats: true, kit: true }));
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(A, () => VR.game.state) === 'play') break; }
await ev(A, () => { window.requestAnimationFrame = () => 0; VR.game.env.setTime(3000); });
await ev(B, () => { window.requestAnimationFrame = () => 0; });
for (let i = 0; i < 10; i++) { await step(A, 10); await wait(100); }
console.log('A', JSON.stringify(await ev(A, () => ({ role: VR.game.mp.role, ready: VR.game.mp.ready, session: VR.game.mp.session, pos: VR.game.player.pos.map(Math.round) }))));
// host edits a column before the guest arrives (should reach the guest as a diff)
const edit0 = await ev(A, () => { const g = VR.game, p = g.player, w = g.world; const x = Math.floor(p.pos[0]) + 3, z = Math.floor(p.pos[2]) + 3, y = Math.floor(p.pos[1]); const s = VR.R.byName.gold_block.defaultState; for (let k = 0; k < 4; k++) w.setBlock(x, y + k, z, s, 0); return [x, y, z, s]; });
for (let i = 0; i < 5; i++) { await step(A, 10); await wait(100); }
// guest sees the host in the lobby and joins
for (let i = 0; i < 20; i++) { const n = await ev(B, () => VR.game.mp.hostList().length); if (n) break; await wait(500); }
console.log('B hosts', JSON.stringify(await ev(B, () => VR.game.mp.hostList())));
await ev(A, () => { const mp = VR.game.mp; mp._helloN = 0; const o = mp.onHello.bind(mp); mp.onHello = (m) => { mp._helloN++; mp._helloLast = JSON.stringify(m).slice(0, 300); return o(m); }; });
// the guest's own block look is Nahtlos, the host plays Klassisch: in the host's world the host's look applies
await ev(B, () => { VR.game.settings.look = 'seamless'; VR.game.applySettings('look'); });
await ev(B, () => { const mp = VR.game.mp; mp._welN = 0; const o = mp.onWelcome.bind(mp); mp.onWelcome = (m) => { mp._welN++; mp._welLast = JSON.stringify(m).slice(0, 400); return o(m); }; const h = VR.game.mp.hostList()[0]; VR.game.mp.join(h); });
for (let i = 0; i < 160; i++) { await step(A, 5); await step(B, 10); const st = await ev(B, () => VR.game.state); if (st === 'play') break; await wait(200); }
const joined = await ev(B, () => ({ state: VR.game.state, role: VR.game.mp.role, guest: !!VR.game.meta.guest, name: VR.game.meta.name, pos: VR.game.player.pos.map(Math.round), mods: VR.game.mp.modKeys.size }));
console.log('B joined', JSON.stringify(joined));
check(joined.state === 'play' && joined.guest, 'the guest joins the host world');
await both(12);
const lk1 = await ev(B, () => ({ look: VR.LOOK.mode, own: VR.game.settings.look, host: VR.game.hostLook }));
check(lk1.look === 'seamless', 'the guest sees the host\'s block look (Nahtlos, the default since v0.43): ' + JSON.stringify(lk1));
// the host switches to Klassisch: the guest follows within a few seconds (the look rides along with the env sync)
await ev(A, () => VR.game.chat('/look classic'));
await both(14);
const lk2 = await ev(B, () => ({ look: VR.LOOK.mode, host: VR.game.hostLook, smooth: !!(VR.R.T.flags[VR.R.byName.grass_block.defaultState] & VR.F.SMOOTH) }));
check(lk2.look === 'classic' && !lk2.smooth, 'the host\'s switch reaches the guest: ' + JSON.stringify(lk2));
await ev(A, () => VR.game.chat('/look seamless'));
await both(14);
const lk3 = await ev(B, () => VR.LOOK.mode);
console.log('guest look back with the host', lk3);
check(lk3 === 'seamless', 'the guest is back on the host\'s Nahtlos look');
// the pre-join gold pillar reached the guest?
const diff = await ev(B, (e) => { const w = VR.game.world; return [0, 1, 2, 3].map(k => w.getBlock(e[0], e[1] + k, e[2]) === e[3]); }, edit0);
console.log('diff applied', JSON.stringify(diff));
check(diff.every(Boolean), 'the host\'s pre-join edit reached the guest as a diff');
// live edits both ways
const eb = await ev(B, () => { const g = VR.game, p = g.player, w = g.world; const x = Math.floor(p.pos[0]) - 2, z = Math.floor(p.pos[2]) - 2, y = Math.floor(p.pos[1]) + 1; const s = VR.R.byName.diamond_block.defaultState; w.setBlock(x, y, z, s, 0); return [x, y, z, s]; });
const ea = await ev(A, () => { const g = VR.game, p = g.player, w = g.world; const x = Math.floor(p.pos[0]) + 2, z = Math.floor(p.pos[2]) - 3, y = Math.floor(p.pos[1]) + 1; const s = VR.R.byName.emerald_block.defaultState; w.setBlock(x, y, z, s, 0); return [x, y, z, s]; });
await both(8);
const gh = await ev(A, (e) => VR.game.world.getBlock(e[0], e[1], e[2]) === e[3], eb);
console.log('guest→host edit', gh);
check(gh, 'a live edit goes from the guest to the host');
const hg = await ev(B, (e) => VR.game.world.getBlock(e[0], e[1], e[2]) === e[3], ea);
console.log('host→guest edit', hg);
check(hg, 'a live edit goes from the host to the guest');
// edits high above the generated terrain (columns grow past y 255) travel both ways
const hb = await ev(B, () => { const g = VR.game, p = g.player, w = g.world; const x = Math.floor(p.pos[0]) + 1, z = Math.floor(p.pos[2]) + 1, s = VR.R.byName.vollton_coral.defaultState; w.setBlock(x, 333, z, s, 0); return [x, 333, z, s]; });
const ha = await ev(A, () => { const g = VR.game, p = g.player, w = g.world; const x = Math.floor(p.pos[0]) - 1, z = Math.floor(p.pos[2]) + 2, s = VR.R.byName.vollton_cobalt.defaultState; w.setBlock(x, 600, z, s, 0); return [x, 600, z, s]; });
await both(8);
const tall1 = await ev(A, (e) => VR.game.world.getBlock(e[0], e[1], e[2]) === e[3], hb);
const tall2 = await ev(B, (e) => VR.game.world.getBlock(e[0], e[1], e[2]) === e[3], ha);
console.log('tall edits: guest→host y333', tall1, '· host→guest y600', tall2);
check(tall1 && tall2, 'edits above the generated terrain (y 333 and y 600) travel both ways');
console.log('A sees', JSON.stringify(await ev(A, () => VR.game.mp.players())));
console.log('B sees', JSON.stringify(await ev(B, () => VR.game.mp.players())));
// chat
await ev(A, () => VR.game.chat('hello buddy!'));
await both(3);
console.log('B chat', JSON.stringify(await ev(B, () => [...document.querySelectorAll('#chatlog div')].map(d => d.textContent).slice(-3))));
// the guest wanders off, the host calls them back
await ev(B, () => { const p = VR.game.player; p.teleport(p.pos[0] + 60, p.pos[1] + 10, p.pos[2] + 40); });
await both(6);
await ev(A, () => { const q = VR.game.mp.players()[0]; if (q) VR.game.mp.summon(q.peer); });
await both(10);
console.log('after summon', JSON.stringify({ A: await ev(A, () => VR.game.player.pos.map(Math.round)), B: await ev(B, () => VR.game.player.pos.map(Math.round)) }));
// look at each other
await ev(A, () => { const g = VR.game, q = g.mp.players()[0]; if (!q) return; const p = g.player; p.yaw = Math.atan2(-(q.pos[0] - p.pos[0]), -(q.pos[2] - p.pos[2])); p.pitch = -0.1; });
await ev(B, () => { const g = VR.game, q = g.mp.players()[0]; if (!q) return; const p = g.player; p.teleport(p.pos[0] - 2, p.pos[1], p.pos[2] - 3); p.yaw = Math.atan2(-(q.pos[0] - p.pos[0]), -(q.pos[2] - p.pos[2])); p.pitch = -0.1; });
await both(6);
await shot(A, 'mp_host_view');
await shot(B, 'mp_guest_view');
// guest leaves (with something special in their pocket), host keeps playing
await ev(B, () => { VR.game.player.inv.slots[30] = { id: 'diamond', n: 7 }; VR.game.player.inv.changed = true; VR.game.quitToTitle(); });
await both(4);
console.log('after leave', JSON.stringify({ A: await ev(A, () => ({ role: VR.game.mp.role, players: VR.game.mp.players().length, guests: Object.keys(VR.game.meta.guests || {}) })), B: await ev(B, () => ({ state: VR.game.state, role: VR.game.mp.role, look: VR.LOOK.mode })) }));
// the guest comes back: their things were kept by the host
for (let i = 0; i < 20; i++) { const n = await ev(B, () => VR.game.mp.hostList().length); if (n) break; await step(A, 5); await wait(400); }
await ev(B, () => { const h = VR.game.mp.hostList()[0]; if (h) VR.game.mp.join(h); });
for (let i = 0; i < 160; i++) { await step(A, 5); await step(B, 10); const st = await ev(B, () => VR.game.state); if (st === 'play') break; await wait(200); }
await both(6);
const rej = await ev(B, () => ({ state: VR.game.state, slot30: VR.game.player.inv.slots[30] }));
console.log('rejoined, pocket kept', JSON.stringify(rej));
check(rej.state === 'play' && !!rej.slot30 && rej.slot30.id === 'diamond' && rej.slot30.n === 7, 'the guest rejoins and the host kept their pocket (7 diamonds)');
// the host closes the world: the guest is brought back to the title screen
await ev(A, () => VR.game.quitToTitle());
for (let i = 0; i < 20; i++) { await step(B, 10); await wait(500); if (await ev(B, () => VR.game.state) === 'title') break; }
const closed = await ev(B, () => ({ state: VR.game.state, role: VR.game.mp.role, hosts: VR.game.mp.hostList().length }));
console.log('host closed', JSON.stringify(closed));
check(closed.state === 'title', 'the guest is brought back to the title screen when the host closes the world');
check(!logs.some(l => /pageerror\]/.test(l)), 'no page errors');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 40)) console.log(l);
await browser.close();
srv.kill();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
