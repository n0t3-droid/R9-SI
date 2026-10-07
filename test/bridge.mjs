// v0.39 📦 the bridge between the standalone R9 Studio (published as its own artifact: another web origin, its own
// storage — it can never reach the game's) and the game:
// · the standalone says so: the ▶ tile reads 🎮 Zum Spiel (W1: the four tiles are the front door, no 🔌 banner), 💾
//   Speichern instead of "Ins Spiel", no message claims "im Spiel", the brand without "▶ Spielen", the Welt mode explains
//   where the worlds are;
// · 📦 Mitnehmen saves favourites + designs + Werkbank Bauteile as ONE file (r9-paket-YYYY-MM-DD.json);
// · in the game's Studio 📥 Übernehmen (🕘 Weitermachen, or dropping the file anywhere) shows what is in it and takes it
//   over; the game sees it; the game's title screen takes the same file's text (item ids like blueprint_2 included).
// Two http servers on two ports = two origins, as on claude.ai.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
const P1 = 8765 + Math.floor(Math.random() * 200), P2 = P1 + 300;
const srv1 = spawn('python3', ['-m', 'http.server', String(P1), '--bind', '127.0.0.1', '--directory', '/home/claude/vr/dist'], { stdio: 'ignore' });
const srv2 = spawn('python3', ['-m', 'http.server', String(P2), '--bind', '127.0.0.1', '--directory', '/home/claude/vr/dist'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1000));
const GAME = `http://127.0.0.1:${P1}`, ALONE = `http://127.0.0.1:${P2}`;
const GAME_URL = 'https://claude.ai/artifact/EP9fJV6R8Grw4ev5RVUP4r';
// (big single-file pages on a busy 2-CPU box: do not wait for 'load', the test waits for the page itself)
const NAV = { waitUntil: 'domcontentloaded', timeout: 180000 };
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 880 }, acceptDownloads: true });
const logs = [];
const watch = (pg, tag) => { pg.on('pageerror', e => logs.push(`[${tag} pageerror] ` + (e.stack || e.message).slice(0, 900))); pg.on('console', m => { if (m.type() === 'error' && !/favicon|404|ERR_|net::/i.test(m.text())) logs.push(`[${tag}] ` + m.text().slice(0, 300)); }); pg.on('dialog', d => d.accept('Test')); };
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const done = async () => { console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 14)) console.log(l); check(!logs.some(l => /pageerror/.test(l)), 'no page errors'); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); await browser.close(); srv1.kill(); srv2.kill(); process.exit(fails ? 1 : 0); };
const section = async (name, fn) => { console.log(name); try { await fn(); } catch (e) { fails++; console.log('  ✗ ' + name + ' broke: ' + String(e && e.message || e).slice(0, 400)); } };
const SP = fs.mkdtempSync(path.join(os.tmpdir(), 'r9-bridge-'));   // (the downloaded r9-paket lands here)
const up = async (pg, all) => { for (let i = 0; i < 700; i++) { await pg.waitForTimeout(500); try { if (await pg.evaluate((all) => !!(window.__studioCore && window.__studioCore.texInfo() && !document.getElementById('studio').classList.contains('boot') && window.__studio.HOUSE.size >= (all ? window.__studioCore.HOUSES.length : 1)), all)) return true; } catch (e) { /* loading */ } } return false; };

// ---------------------------------------------------------------- the standalone Studio (its own origin)
const sa = await ctx.newPage(); watch(sa, 'alone');
const sev = (fn, a) => sa.evaluate(fn, a);
await sa.goto(ALONE + '/studio_artifact.html', NAV);
let SOFA = null, file = null, pack = null;
await section('1 · the standalone says it is not connected', async () => {
  check(await up(sa, true), 'the standalone Studio is up, every catalogue house built');
  SOFA = await sev(() => Object.keys(VR.VM.MODELS).find(n => /^vm_sofa/.test(n)));
  const r = await sev(() => {
    const bar = document.getElementById('bridgeBar'), vis = (e) => !!e && e.getClientRects().length > 0, tile = document.querySelector('#tiles .tile[data-tile="play"]');
    return { flags: [window.__R9_STANDALONE === true, window.__R9_GAME_URL], bar: vis(bar) ? bar.textContent : null, tiles: document.querySelectorAll('#tiles .tile').length, tile: tile ? tile.querySelector('.lbl').textContent.trim() : null, gameBtn: !!document.getElementById('gameBtn'), brand: document.querySelector('.brand .v').textContent, play: !!document.getElementById('playBtn') };
  });
  console.log('  front door', JSON.stringify(r));
  check(r.flags[0] && r.flags[1] === GAME_URL, 'the standalone build knows it is standalone and where the game is');
  check(!r.bar && r.tiles === 4 && r.tile === '🎮 Zum Spiel' && r.gameBtn, 'no 🔌 banner (W1): the four tiles are the front door, ▶ reads „🎮 Zum Spiel"');
  check(!/Spielen/.test(r.brand) && !r.play, 'the brand without "▶ Spielen" (' + r.brand + '), no ▶ button');
  // 🎮 Zum Spiel: a new tab with the game, or (blocked) the link to copy
  const g = await sev(async () => {
    const calls = []; const real = window.open; window.open = (...a) => { calls.push(a); return null; };
    const tile = document.querySelector('#tiles .tile[data-tile="play"]');
    tile.click(); await new Promise(r => setTimeout(r, 100));
    const first = !document.querySelector('#tiles .gameLink');   // one click: the tab opens, no link box yet
    tile.click(); await new Promise(r => setTimeout(r, 100));   // a second click soon after: it evidently did not open
    window.open = real;
    const inp = document.querySelector('.gameLink input');
    return { calls, first, link: inp ? inp.value : null };
  });
  check(g.calls.length === 2 && g.calls[0][0] === GAME_URL && g.calls[0][1] === '_blank' && /noopener/.test(g.calls[0][2] || '') && g.first, '🎮 Zum Spiel opens the game in a new tab (noopener), no link box on the first click');
  check(g.link === GAME_URL, 'a second click soon after (no tab came): the link is there to copy');
});

await section('2 · honest labels: 💾 Speichern, no "im Spiel"', async () => {
  const r = await sev(async (sofa) => {
    const sleep = (ms) => new Promise(res => setTimeout(res, ms)), C = window.__studioCore, CR = VR.Crafter, out = {};
    // ★ texts before there are any favourites
    C.setMode('parts'); await sleep(300);
    document.querySelector('#chips button[data-pcat="fav"]').click(); await sleep(150);
    out.favNote = (document.querySelector('#list .note') || {}).textContent || '';
    // the item: 💾 Speichern, a voxel, saved — "gespeichert", not "im Spiel"
    CR.open.item(sofa); await sleep(300);
    const sv = document.querySelector('#partsBody [data-act="save"]');
    out.itemBtn = sv ? [sv.textContent.trim(), sv.title] : null;
    const it = CR.item, i0 = it.V.findIndex(v => v);
    CR.vApply([[i0 % it.VW, Math.floor(i0 / (it.VW * it.VD)), Math.floor(i0 / it.VW) % it.VD, VR.VM.M.matte(0xd02020) >>> 0]]);
    if (sv) document.querySelector('#partsBody [data-act="save"]').click(); await sleep(300);
    out.itemTip = document.getElementById('craftTip').textContent;
    out.hud = document.getElementById('hudMeta').textContent;
    out.saved = !!(CR.store().models || {})[sofa];
    // the house: the same big button
    CR.open.house(0); for (let i = 0; i < 300 && !(CR.house && CR.house.index === 0 && CR.gpu); i++) await sleep(150);
    const hb = document.querySelector('#partsBody [data-act="save"]'); out.houseBtn = hb ? [hb.textContent.trim(), hb.title] : null;
    // 🕘: the item is "💾 gespeichert"
    VR.Projects.show(true); await sleep(300);
    out.hub = document.querySelector('#hub .hubBody') ? document.querySelector('#hub .hubBody').textContent : '';
    VR.Projects.show(false);
    // Welt: where the worlds are
    C.setMode('world'); for (let i = 0; i < 40 && !VR.StudioWorld.worlds; i++) await sleep(150); await sleep(200);
    out.world = document.getElementById('list').textContent; out.worldBtn = !!document.querySelector('#list [data-act="game"]');
    // ✨ Erschaffen without a world
    VR.StudioWorld.imagine.open(null, 'house'); await sleep(500);
    out.create = document.getElementById('imagine') ? document.getElementById('imagine').textContent : '';
    VR.StudioWorld.imagine.open(null, 'genie'); await sleep(500);
    out.genie = document.getElementById('imagine') ? document.getElementById('imagine').textContent : '';
    VR.StudioWorld.imagine.close();
    C.setMode('arch'); await sleep(200);
    return out;
  }, SOFA);
  console.log('  labels', JSON.stringify(r).slice(0, 1600));
  check(!/im Spiel/.test(r.favNote) && /Mitnehmen/.test(r.favNote), '★ empty: no promise of the game, 📦 Mitnehmen instead (' + r.favNote + ')');
  check(r.itemBtn && /💾 Speichern/.test(r.itemBtn[0]) && r.itemBtn[1] === 'Gespeichert in diesem Studio — 📦 Mitnehmen bringt es ins Spiel', 'the item\'s button: 💾 Speichern (' + (r.itemBtn && r.itemBtn.join(' / ')) + ')');
  check(r.saved && /gespeichert/i.test(r.itemTip) && !/im Spiel/.test(r.itemTip) && !/im Spiel/.test(r.hud), 'saved: "' + r.itemTip + '" — nothing says "im Spiel"');
  check(r.houseBtn && /💾 Speichern/.test(r.houseBtn[0]) && r.houseBtn[1] === 'Gespeichert in diesem Studio — 📦 Mitnehmen bringt es ins Spiel', 'the house\'s button: 💾 Speichern');
  check(/💾 gespeichert/.test(r.hub) && !/im Spiel/.test(r.hub), '🕘 shows "💾 gespeichert", never "im Spiel"');
  check(r.worldBtn && /Welten/.test(r.world) && /⏸ → 🏗 Bauen/.test(r.world), 'Welt explains that the worlds live in the game (⏸ → 🏗 Bauen), with 🎮 Zum Spiel: ' + r.world.slice(0, 160));
  check(!/Im Spiel \(Pause → R9 Studio\)/.test(r.create) && /Mitnehmen/.test(r.create), '✨ Erschaffen promises no game it cannot reach');
  check(/Genie/.test(r.genie) && !/im Spiel/.test(r.genie), '✨ Genie: no "hier im Spiel" in a Studio that is not the game');
});

await section('3 · 📦 Mitnehmen: one file with favourites, designs and Bauteile', async () => {
  await sev(async () => {
    const sleep = (ms) => new Promise(res => setTimeout(res, ms)), C = window.__studioCore;
    C.setMode('arch'); await sleep(300);
    document.querySelector('#list .card.house[data-house="2"] .favb').click();
    C.setMode('parts'); await sleep(300);
    document.querySelector('#chips button[data-pcat="all"]').click();
    const s = document.getElementById('search'); s.value = 'led cove'; s.dispatchEvent(new Event('input'));
    document.querySelector('#list .card[data-bid="vx_led_cove"] .favb').click();
    s.value = ''; s.dispatchEvent(new Event('input'));
    // a Bauteil (as "🧩 Als Bauteil behalten" keeps one)
    localStorage.setItem('r9si.library', JSON.stringify({ v: 1, t: Date.now(), items: [{ id: 'bt1', name: 'Säule', t: Date.now(), sx: 1, sy: 3, sz: 1, dy: 0, pal: [0, 'air', ['stone']], rle: VR.Custom.b64(VR.Custom.vrle(Uint16Array.from([2, 2, 2]))) }] }));
  });
  // 📦 Alles mitnehmen lives in 🎒 Meins (W1: the hub's footer)
  await sev(() => VR.Projects.show(true)); await sa.waitForTimeout(300);
  const outBtn = await sev(() => (document.querySelector('#hub footer [data-pack="out"]') || {}).textContent || '');
  check(/Alles mitnehmen/.test(outBtn), '🎒 Meins offers „📦 Alles mitnehmen" (' + outBtn.trim() + ')');
  const [dl] = await Promise.all([sa.waitForEvent('download', { timeout: 30000 }), sev(() => document.querySelector('#hub footer [data-pack="out"]').click())]);
  await sev(() => VR.Projects.show(false));
  file = SP + '/' + dl.suggestedFilename();
  await dl.saveAs(file);
  pack = JSON.parse(fs.readFileSync(file, 'utf8'));
  console.log('  file', dl.suggestedFilename(), JSON.stringify({ favs: pack.favs, houses: Object.keys((pack.studio || {}).houses || {}), models: Object.keys((pack.studio || {}).models || {}), lib: (pack.lib || []).length, from: pack.from }));
  check(/^r9-paket-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), 'the file: ' + dl.suggestedFilename());
  check(pack.r9pack === 1 && pack.from === 'standalone' && pack.at > 0, 'r9pack 1, from the standalone');
  check(pack.favs.join() === 'vx_led_cove,blueprint_2', 'the favourites (a house among them): ' + pack.favs.join(', '));
  check(pack.studio && pack.studio.models && pack.studio.models[SOFA] && pack.lib.length === 1 && pack.lib[0].name === 'Säule', 'the sofa design and the Bauteil are in it');
});

// ---------------------------------------------------------------- the game's Studio (the game's origin)
const gs = await ctx.newPage(); watch(gs, 'studio');
const gev = (fn, a) => gs.evaluate(fn, a);
await gs.goto(GAME + '/studio.html', NAV);
await section('4 · 📥 Übernehmen in the game\'s Studio', async () => {
  check(await up(gs), 'the game\'s Studio is up');
  const r0 = await gev(() => ({ bar: !!(document.getElementById('bridgeBar') && document.getElementById('bridgeBar').getClientRects().length), favs: VR.Favs.list(), models: Object.keys((VR.Custom.load() || {}).models || {}) }));
  check(!r0.bar && !r0.favs.length && !r0.models.length, 'the game\'s Studio has no banner, and nothing of the standalone yet (another origin)');
  // dropping the file anywhere shows what is in it; Abbrechen changes nothing
  const d = await gev(async (text) => {
    const sleep = (ms) => new Promise(res => setTimeout(res, ms));
    const f = new File([text], 'r9-paket.json', { type: 'application/json' }), dt = new DataTransfer(); dt.items.add(f);
    for (const t of ['dragenter', 'dragover', 'drop']) document.getElementById('list').dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt }));
    for (let i = 0; i < 30 && !document.querySelector('#packDlg.on'); i++) await sleep(100);
    const dlg = document.getElementById('packDlg'), out = { sum: dlg && dlg.classList.contains('on') ? dlg.textContent : null };
    const c = document.querySelector('#packDlg [data-act="cancel"]'); if (c) c.click(); await sleep(100);
    out.closed = !document.querySelector('#packDlg.on'); out.favs = VR.Favs.list().length;
    return out;
  }, fs.readFileSync(file, 'utf8'));
  console.log('  drop', JSON.stringify(d));
  check(d.sum && /2 Favoriten · 1 Möbel · 1 Bauteil/.test(d.sum), 'dropping the file shows what is in it: ' + (d.sum || '').replace(/\s+/g, ' ').slice(0, 120));
  check(d.closed && d.favs === 0, 'Abbrechen: nothing changes');
  // 🕘 Weitermachen → 📥 Übernehmen → pick the file → ✓ Übernehmen
  await gev(() => VR.Projects.show(true));
  await gs.waitForTimeout(300);
  const [fc] = await Promise.all([gs.waitForEvent('filechooser', { timeout: 15000 }), gev(() => document.querySelector('#hub [data-pack="in"]').click())]);
  await fc.setFiles(file);
  for (let i = 0; i < 30 && !(await gev(() => !!document.querySelector('#packDlg.on'))); i++) await gs.waitForTimeout(100);
  const r = await gev(async (sofa) => {
    const sleep = (ms) => new Promise(res => setTimeout(res, ms)), out = {};
    out.sum = (document.getElementById('packDlg') || {}).textContent || '';
    document.querySelector('#packDlg [data-act="ok"]').click(); await sleep(400);
    out.favs = VR.Favs.list(); out.model = !!((VR.Custom.load() || {}).models || {})[sofa];
    out.lib = JSON.parse(localStorage.getItem('r9si.library') || '{"items":[]}').items.map(x => x.name);
    out.applied = !!(VR.CUSTOM && VR.CUSTOM.models && VR.CUSTOM.models[sofa]);
    out.msg = document.getElementById('sysText').textContent + ' | ' + ((document.getElementById('pjToast') || {}).textContent || '');
    return out;
  }, SOFA);
  console.log('  import', JSON.stringify(r));
  check(/2 Favoriten · 1 Möbel · 1 Bauteil/.test(r.sum), '📥 Übernehmen in 🕘 shows the same summary');
  check(r.favs.join() === 'vx_led_cove,blueprint_2' && r.model && r.applied && r.lib.join() === 'Säule', '✓ Übernehmen: the favourites, the sofa design and the Bauteil are here now');
  check(/Übernommen/.test(r.msg), 'and it says so: ' + r.msg.slice(0, 160));
});

await section('5 · the game sees it', async () => {
  const game = await ctx.newPage(); watch(game, 'game');
  await game.goto(GAME + '/index.html', NAV);
  let ok = false; for (let i = 0; i < 240 && !ok; i++) { await game.waitForTimeout(500); try { ok = await game.evaluate(() => !!(VR.game && VR.game.state === 'title')); } catch (e) { /* */ } }
  const r = await game.evaluate((sofa) => ({ favs: VR.Favs.list(), model: !!(VR.CUSTOM && VR.CUSTOM.models && VR.CUSTOM.models[sofa]), note: (document.getElementById('studionote') || {}).textContent || '' }), SOFA);
  console.log('  game', JSON.stringify(r));
  check(ok && r.favs.includes('blueprint_2') && r.favs.includes('vx_led_cove'), 'the game\'s favourites are the Studio\'s (blueprint_2 included)');
  check(r.model, 'and the sofa design is in the game');
  await game.close();
});

await section('6 · the game\'s title screen takes the file\'s text too', async () => {
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const game = await ctx2.newPage(); watch(game, 'title');
  await game.goto(GAME + '/index.html', NAV);
  let ok = false; for (let i = 0; i < 240 && !ok; i++) { await game.waitForTimeout(500); try { ok = await game.evaluate(() => !!(VR.game && VR.game.state === 'title')); } catch (e) { /* */ } }
  const r = await game.evaluate(async ([text, sofa]) => {
    const sleep = (ms) => new Promise(res => setTimeout(res, ms));
    const b = document.querySelector('#studionote [data-act="studioimport"]'); if (b) b.click(); await sleep(100);
    const ta = document.querySelector('#studionote textarea'); ta.value = text;
    const file = !!document.querySelector('#studionote [data-act="studiofile"]');
    const ok = [...document.querySelectorAll('#studionote button')].find(x => /Übernehmen/.test(x.textContent)); if (ok) ok.click(); await sleep(300);
    return { favs: VR.Favs.list(), model: !!(VR.CUSTOM && VR.CUSTOM.models && VR.CUSTOM.models[sofa]), lib: JSON.parse(localStorage.getItem('r9si.library') || '{"items":[]}').items.length, note: (document.getElementById('titlenote') || {}).textContent || '', file };
  }, [fs.readFileSync(file, 'utf8'), SOFA]);
  console.log('  title', JSON.stringify(r));
  check(ok && r.favs.join() === 'vx_led_cove,blueprint_2', 'the title import keeps every favourite, the house (blueprint_2) too: ' + r.favs.join(', '));
  check(r.model && r.lib === 1, 'the design and the Bauteil come along');
  check(/übernommen/i.test(r.note) && r.file, 'it says what it took (' + r.note + '), and offers 📂 a file too');
  await ctx2.close();
});
await done();
