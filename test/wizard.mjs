// W2 „Bauhand & ✨" (spec 2026-10-07-all-ages-workflow-design.md §5, §8) — the ✨ wizard, Was? › Wie? › Wohin?:
// the start screen's ✨ opens it (≥ 10 picture tiles, the wish line, the keyboard), „Fahrzeug" → six pictures,
// „Feuerwehrauto" → six pictures that all differ, „rotes Dach" changes the lit house, Weiter keeps a Genie thing in
// 🎒 Meins (one r9si.library item with origin.kind 'genie', a g: card), nothing touches a world's plans before Wohin?,
// „An meinem Platz" → a piece plan within 8 blocks of the spawn, built within 10 s of the world opening, g.landedBy 'new';
// in the world: ✨ from the ring → Hochhaus in three clicks → in your hand → one more click builds it; in the R9 Studio:
// the ✨ tile opens the same wizard, 🗺 puts the thing on the Karte. No page errors.
// Screenshots: w2_wiz_was, w2_wiz_wie, w2_wiz_haus, w2_wiz_wohin, w2_wiz_spot, w2_wiz_tower, w2_wiz_studio, w2_wiz_karte.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const PORT = 8765 + Math.floor(Math.random() * 200);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', '/home/claude/vr/dist'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const URL0 = `http://127.0.0.1:${PORT}`;
const NAV = { waitUntil: 'domcontentloaded', timeout: 180000 };
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
page.on('console', m => { if (m.type() === 'error' && !/favicon|404|QuotaExceeded|quota/i.test(m.text())) logs.push('[console] ' + m.text().slice(0, 300)); });
const ev = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => page.waitForTimeout(ms);
const safe = async (fn, a) => { try { return await ev(fn, a); } catch (e) { return null; } };
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const shot = (n) => page.screenshot({ path: `/home/claude/vr/test/shots/${n}.png`, timeout: 180000 }).catch(() => {});
const ONLY = (process.env.ONLY || '').split(',').map(s => s.trim()).filter(Boolean);
const want = (n) => !ONLY.length || ONLY.includes(String(n));
const section = async (n, name, fn) => { if (!want(n)) return; console.log(n + ' · ' + name); try { await fn(); } catch (e) { fails++; console.log('  ✗ ' + name + ' broke: ' + String(e && e.message || e).slice(0, 400)); } };
const until = async (fn, a, maxS = 30) => { for (let i = 0; i < maxS * 4; i++) { const r = await safe(fn, a); if (r) return r; await wait(250); } return null; };
const atTitle = async (maxS = 150) => !!(await until(() => !!(window.VR && VR.game && VR.game.state === 'title'), null, maxS));
const inPlay = async (maxS = 180) => !!(await until(() => { const g = window.VR && VR.game; return !!(g && g.state === 'play' && g.player && !g.player.hold && !g.studioOpen); }, null, maxS));
// the six pictures: drawn? their pixel hashes
const vars = () => ev(() => { const h = (cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let x = 2166136261; for (let i = 0; i < d.length; i += 4) { x ^= d[i] | (d[i + 1] << 8) | (d[i + 2] << 16); x = Math.imul(x, 16777619); } return x >>> 0; }; return [...document.querySelectorAll('#wizard .wz-var')].map(b => { const cv = b.querySelector('canvas'); return { done: cv.classList.contains('done'), hash: h(cv), name: (b.querySelector('.wz-vname') || {}).textContent || '', on: b.classList.contains('on') }; }); });
const allDrawn = async (n = 6, maxS = 45) => { for (let i = 0; i < maxS * 2; i++) { const v = await safe(() => [...document.querySelectorAll('#wizard .wz-var canvas')].map(c => c.classList.contains('done'))); if (v && v.length >= n && v.every(Boolean)) return true; await wait(500); } return false; };
const step = () => safe(() => VR.Wizard.state() ? VR.Wizard.state().step : 0);
const plansSnap = () => ev(() => JSON.stringify(Object.keys(localStorage).filter(k => /^r9si\.plans\./.test(k)).sort().map(k => [k, localStorage.getItem(k)])));
const typeWish = async (sel, text) => { await page.click(sel); await page.fill(sel, text); await page.keyboard.press('Enter'); };

await page.goto(URL0 + '/index.html', NAV);
check(await atTitle(), 'the game is at its start screen');
await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.settings.renderDist = 4; g.settings.horizon = 0; g.applySettings('*'); g.saveSettings(); });

// a world to come back to (its spawn is where „An meinem Platz" plans)
let WORLD = null, SPAWN = null;
await section(1, 'a world exists (flat, Zen); back at the start screen', async () => {
  await ev(() => VR.game.createWorld({ name: 'Wunschwelt', mode: 'zen', difficulty: 'peaceful', type: 'flat', seed: '4242', cheats: true, kit: true }));
  check(await inPlay(), 'the world is open');
  await wait(1500);
  const r = await ev(() => { const g = VR.game; return { id: g.meta.id, spawn: (g.player.spawn || g.worldSpawn()).slice(0, 3) }; });
  WORLD = r.id; SPAWN = r.spawn;
  await ev(() => VR.game.quitToTitle());
  check(await atTitle(), 'back at the start screen (spawn ' + SPAWN.map(Math.round).join(' ') + ')');
});

let SNAP = null;
await section(2, 'Was?: the ✨ tile opens the wizard — picture tiles, the wish line, the keyboard', async () => {
  SNAP = await plansSnap();
  await page.click('#title .tile[data-tile="erschaffen"]');
  const w = await until(() => { const b = document.querySelector('#wizard.on'); if (!b) return null; const tiles = [...b.querySelectorAll('.wz-tile')]; return tiles.length ? { tiles: tiles.map(t => ({ id: t.dataset.tile, w: Math.round(t.getBoundingClientRect().width), h: Math.round(t.getBoundingClientRect().height), label: t.textContent.trim() })), steps: [...b.querySelectorAll('.wz-steps li')].map(l => l.textContent + (l.classList.contains('on') ? '*' : '')), wish: !!b.querySelector('.wz-wish input'), focus: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.tile : null } : null; }, null, 20);
  console.log('  was', JSON.stringify(w && { n: w.tiles.length, steps: w.steps, focus: w.focus, first: w.tiles.slice(0, 3) }));
  check(!!w, 'the ✨ tile opens #wizard');
  check(w && w.tiles.length >= 10, '≥ 10 picture tiles (' + (w && w.tiles.length) + ')');
  check(w && w.tiles.every(t => t.w >= 150 && t.h >= 150), 'every tile is big (≥ 150 px)');
  check(w && w.steps.join(' ') === 'Was?* Wie? Wohin?', 'the steps: Was?* Wie? Wohin? (' + (w && w.steps.join(' ')) + ')');
  check(w && w.wish, 'the wish line „oder sag es: …"');
  await wait(300);
  const foc = await safe(() => document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.tile : null);
  check(w && foc === w.tiles[0].id, 'the first tile has the focus (keyboard) (' + foc + ')');
  await page.keyboard.press('ArrowRight');
  check(await safe(() => document.activeElement && document.activeElement.dataset.tile) === (w && w.tiles[1].id), 'ArrowRight moves to the next tile');
  await wait(400);
  await shot('w2_wiz_was');
  await page.keyboard.press('Escape'); await wait(300);
  check(await safe(() => !document.querySelector('#wizard.on') && !VR.Wizard.isOpen()), 'Esc closes it');
  await page.click('#title .tile[data-tile="erschaffen"]');
  check(!!(await until(() => !!document.querySelector('#wizard.on .wz-tile'), null, 10)), 'and it opens again');
});

await section(3, 'Wie?: „Fahrzeug" → six pictures', async () => {
  await page.click('#wizard .wz-tile[data-tile="fahrzeug"]');
  check(!!(await until(() => VR.Wizard.state() && VR.Wizard.state().step === 2, null, 10)), 'step 2');
  const ok = await allDrawn(6, 60);
  const v = await vars();
  console.log('  fahrzeug', JSON.stringify(v.map(x => x.name)));
  check(ok && v.length >= 6, '≥ 6 pictures, all drawn (' + v.length + ')');
  check(v.length && v[0].on, 'the first one is lit');
});

await section(4, 'a typed wish: „Feuerwehrauto" → six pictures that all differ', async () => {
  await page.click('#wizard .wz-back'); await wait(300);
  check(await step() === 1, '← back to Was?');
  await typeWish('#wizard .wz-wish input', 'Feuerwehrauto');
  check(!!(await until(() => VR.Wizard.state() && VR.Wizard.state().step === 2, null, 10)), 'the wish goes to Wie?');
  const ok = await allDrawn(6, 60);
  const v = await vars(), hs = new Set(v.map(x => x.hash));
  console.log('  feuerwehr', JSON.stringify(v.map(x => x.name + ' #' + x.hash.toString(16))));
  check(ok && v.length === 6, 'six canvases, all drawn');
  check(hs.size === 6, 'six distinct pixel hashes (' + hs.size + ')');
  await page.keyboard.press('3'); await wait(200);
  check(await safe(() => VR.Wizard.state().lit) === 2, 'key 3 lights the third');
  await page.keyboard.press('1'); await wait(200);
  await shot('w2_wiz_wie');
});

await section(5, 'Haus: „rotes Dach" changes the lit house', async () => {
  await page.click('#wizard .wz-back'); await wait(300);
  await page.click('#wizard .wz-tile[data-tile="haus"]');
  await allDrawn(6, 60);
  const v0 = await vars(), lit0 = v0.find(x => x.on);
  const spec0 = await ev(() => JSON.stringify(VR.Wizard.state().six.things[VR.Wizard.state().lit].spec));
  await typeWish('#wizard .wz-change input', 'rotes Dach');
  await wait(400);
  await allDrawn(6, 40);
  const v1 = await vars(), lit1 = v1.find(x => x.on);
  const spec1 = await ev(() => JSON.stringify(VR.Wizard.state().six.things[VR.Wizard.state().lit].spec));
  console.log('  haus', JSON.stringify({ before: lit0 && lit0.hash, after: lit1 && lit1.hash, name: lit1 && lit1.name }));
  check(spec1 !== spec0 && /roof/.test(spec1), 'the lit house\'s choices changed');
  check(lit0 && lit1 && lit0.hash !== lit1.hash, 'its picture changed');
  await shot('w2_wiz_haus');
});

let KEPT = null;
await section(6, 'Weiter keeps a Genie thing in 🎒 Meins — nothing in a world yet', async () => {
  const lib0 = await ev(() => (VR.Pack.libLoad() || []).length);
  await page.click('#wizard .wz-back'); await wait(300);
  await typeWish('#wizard .wz-wish input', 'Feuerwehrauto');
  await allDrawn(6, 60);
  check(await plansSnap() === SNAP, 'no world\'s plans changed during Was? and Wie?');
  await page.click('#wizard .wz-btn[data-act="next"]');
  check(!!(await until(() => VR.Wizard.state() && VR.Wizard.state().step === 3, null, 15)), 'Weiter → Wohin?');
  const r = await ev((n0) => {
    const items = VR.Pack.libLoad() || [], favs = VR.Favs.list(), S = VR.Wizard.state();
    return { n: items.length - n0, item: items[0] ? { id: items[0].id, name: items[0].name, origin: items[0].origin && items[0].origin.kind } : null, gfav: favs.filter(f => /^g:/.test(f)), kept: S.kept ? { ding: S.kept.ding, project: S.kept.project } : null, card: VR.Ding.list().some(x => /^g:/.test(x.id)), wheres: [...document.querySelectorAll('#wizard .wz-where')].map(b => b.dataset.where) };
  }, lib0);
  console.log('  kept', JSON.stringify(r));
  KEPT = r.kept;
  check(r.n === 1 && r.item && r.item.origin === 'genie', 'one r9si.library item with origin.kind „genie" (' + (r.item && r.item.name) + ')');
  check(r.gfav.length >= 1 && r.card, 'a g: card in 🎒 Meins (★ ' + r.gfav.join(',') + ')');
  check(r.kept && /^p:/.test(r.kept.ding), 'the hand will hold its Bauteil (' + (r.kept && r.kept.ding) + ')');
  check(r.wheres.join() === 'hand,spot,map', 'Wohin?: 🧍 Vor mir · 📍 An meinem Platz · 🗺 Auf der Karte');
  check(await plansSnap() === SNAP, 'still no plan in any world before Wohin?');
  await wait(500);
  await shot('w2_wiz_wohin');
});

await section(7, '📍 An meinem Platz: the world opens, you stand in front of it, it is built', async () => {
  if (!KEPT) { check(false, 'nothing kept'); return; }
  await page.click('#wizard .wz-where[data-where="spot"]');
  check(await inPlay(), 'the world opens');
  const t0 = Date.now();
  const built = await until((id) => { const ps = (JSON.parse(localStorage.getItem('r9si.plans.' + id) || 'null') || { plans: [] }).plans; const p = ps.find(q => q.kind === 'piece' && q.from === 'wizard'); return p && p.status === 'built' ? p : null; }, WORLD, 30);
  const dt = (Date.now() - t0) / 1000;
  const r = await ev((id) => { const g = VR.game, ps = (JSON.parse(localStorage.getItem('r9si.plans.' + id) || 'null') || { plans: [] }).plans; return { landed: g.landedBy, n: ps.length, plan: ps.find(q => q.from === 'wizard') || null, spawn: (g.player.spawn || []).slice(0, 3), pos: g.player.pos.slice(0, 3) }; }, WORLD);
  const p = r.plan;
  let dist = 99;
  if (p) { const it = await ev((pc) => (VR.Pack.libLoad() || []).find(x => 'p:' + x.id === pc), p.piece); const W = it ? it.sx : 1, D = it ? it.sz : 1, ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]]; const a = ROT[p.r & 3](0, 0), b = ROT[p.r & 3](W - 1, D - 1); const x0 = p.ox + Math.min(a[0], b[0]), x1 = p.ox + Math.max(a[0], b[0]), z0 = p.oz + Math.min(a[1], b[1]), z1 = p.oz + Math.max(a[1], b[1]); const sx = SPAWN[0], sz = SPAWN[2]; const dx = Math.max(x0 - sx, 0, sx - (x1 + 1)), dz = Math.max(z0 - sz, 0, sz - (z1 + 1)); dist = Math.hypot(dx, dz); }
  console.log('  spot', JSON.stringify({ landed: r.landed, plan: p && { kind: p.kind, status: p.status, ox: p.ox, oz: p.oz, F: p.F, r: p.r }, dist: dist.toFixed(1), dt: dt.toFixed(1) }));
  check(p && p.kind === 'piece', 'a piece plan in r9si.plans.<world>');
  check(dist <= 8, 'within 8 blocks of the spawn (' + dist.toFixed(1) + ')');
  check(!!built && dt <= 10, 'built within 10 s of the world opening (' + dt.toFixed(1) + ' s)');
  check(r.landed === 'new', 'g.landedBy === „new" (in front of it)');
  await wait(2500);
  await shot('w2_wiz_spot');
});

await section(8, 'in the world: ✨ from the ring, a Hochhaus in three clicks, one more click builds it', async () => {
  if (!(await inPlay(30))) { check(false, 'not in a world'); return; }
  await ev(() => { const g = VR.game, p = g.player; p.flying = false; if (VR.Hints) for (const k of ['move', 'fly', 'bauhand', 'bhring', 'bhundo', 'bhchange']) VR.Hints.done(k); });
  await page.mouse.move(640, 360);
  await page.keyboard.press('b');
  check(!!(await until(() => VR.Bauhand.state === 'open', null, 10)), 'B opens the ring');
  await page.click('#bauhand .bh-new');
  check(!!(await until(() => !!document.querySelector('#wizard.on .wz-tile'), null, 10)), '✨ Neu… opens the wizard over the world');
  // the world does not walk while you choose
  const p0 = await ev(() => VR.game.player.pos.slice());
  await page.keyboard.down('w'); await wait(600); await page.keyboard.up('w');
  const p1 = await ev(() => VR.game.player.pos.slice());
  check(Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) < 0.2, 'W does not walk while the wizard is open');
  await page.click('#wizard .wz-tile[data-tile="hochhaus"]');                       // click 1
  await allDrawn(6, 60);
  await page.click('#wizard .wz-var.on');                                           // click 2: the lit one again = Weiter
  check(!!(await until(() => VR.Wizard.state() && VR.Wizard.state().step === 3, null, 10)), 'a second click on the lit picture goes on');
  const wh = await ev(() => [...document.querySelectorAll('#wizard .wz-where')].map(b => b.dataset.where));
  check(wh[0] === 'hand', 'Wohin? in the world: 🧍 Vor mir first (' + wh.join(',') + ')');
  await page.click('#wizard .wz-where[data-where="hand"]');                         // click 3
  const H = await until(() => { const H = VR.Bauhand.holding; return H ? { ding: H.ding, kind: H.kind, name: H.name } : null; }, null, 10);
  console.log('  holding', JSON.stringify(H));
  check(H && H.kind === 'forge' && /^f:tower:/.test(H.ding), 'the Bauhand holds the skyscraper (' + (H && H.ding) + ')');
  check(await safe(() => !document.querySelector('#wizard.on')), 'the wizard is gone');
  // aim at open ground ahead (away from the fire truck), wait for a cyan ghost, click
  await ev(() => { const p = VR.game.player; p.yaw += Math.PI; p.pitch = -0.22; });
  let A = null; for (let i = 0; i < 80; i++) { A = await safe(() => { const a = VR.Bauhand.ghost; return a ? { ok: !!a.ok, why: a.why || '', prep: !!a.prep } : null; }); if (A && A.ok) break; await wait(250); }
  console.log('  ghost', JSON.stringify(A));
  check(A && A.ok, 'a cyan ghost for the skyscraper (' + (A && (A.why || 'ok')) + ')');
  if (!A || !A.ok) return;
  await page.mouse.click(640, 360);
  const pl = await until((id) => { const ps = (JSON.parse(localStorage.getItem('r9si.plans.' + id) || 'null') || { plans: [] }).plans; const p = ps.find(q => q.kind === 'forge' && q.from === 'hand'); return p && p.status === 'built' ? p : null; }, WORLD, 60);
  check(!!pl, 'the skyscraper is built (a forge plan from the hand)');
  await ev(() => { const p = VR.game.player; p.pitch = 0.12; });
  await wait(2000);
  await shot('w2_wiz_tower');
  await page.keyboard.press('Escape'); await wait(300);
});

await section(9, 'the R9 Studio: the ✨ tile opens the same wizard; 🗺 puts it on the Karte', async () => {
  await ev(() => { try { VR.game.saveMeta(); } catch (e) { /* */ } });
  await page.goto(URL0 + '/studio.html', NAV);
  const up = await until(() => { const st = document.getElementById('studio'); return !!(st && !st.classList.contains('boot') && window.__studioCore && window.__studioCore.texInfo() && VR.Wizard && VR.Wizard.host && VR.Wizard.host.name === 'studio'); }, null, 240);
  check(up, 'the Studio is up, the wizard\'s host is the Studio');
  if (!up) return;
  await ev(() => { if (VR.Projects.isOpen()) VR.Projects.show(false); });
  await page.click('#tiles .tile[data-tile="erschaffen"]');
  const w = await until(() => { const b = document.querySelector('#wizard.on'); return b && b.querySelector('.wz-tile') ? { studio: b.classList.contains('studio'), n: b.querySelectorAll('.wz-tile').length, lit: !!document.querySelector('#tiles .tile[data-tile="erschaffen"].on') } : null; }, null, 20);
  console.log('  studio', JSON.stringify(w));
  check(w && w.n >= 10, 'the ✨ tile opens the same wizard (' + (w && w.n) + ' tiles)');
  await wait(500);
  await shot('w2_wiz_studio');
  await page.click('#wizard .wz-tile[data-tile="haus"]');
  await allDrawn(6, 60);
  await page.click('#wizard .wz-btn[data-act="next"]');
  const wh = await until(() => { const b = [...document.querySelectorAll('#wizard .wz-where')].map(x => x.dataset.where); return b.length ? b : null; }, null, 15);
  check(wh && wh.join() === 'hand,spot,map', 'Wohin? in the Studio: 🧍 · 📍 · 🗺 (' + (wh && wh.join()) + ')');
  await page.click('#wizard .wz-where[data-where="map"]');
  const k = await until(() => { const W = VR.StudioWorld; return W && W.world && W.tool && W.tool.kind === 'piece' ? { tool: W.tool.piece, tab: W.tab, mode: window.__studioCore.S.mode } : null; }, null, 120);
  console.log('  karte', JSON.stringify(k));
  check(k && k.mode === 'world' && /^p:/.test(k.tool), '🗺 → the Karte with the house in hand (a Bauteil tool)');
  const m = await until(() => { const W = VR.StudioWorld; return W.tool && W.meshFor(W.tool) ? true : null; }, null, 60);
  check(!!m, 'its mesh is ready to place');
  await wait(1200);
  await shot('w2_wiz_karte');
});

console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 14)) console.log(l);
check(!logs.some(l => /pageerror/.test(l)), 'no page errors');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close(); srv.kill();
process.exit(fails ? 1 : 0);
