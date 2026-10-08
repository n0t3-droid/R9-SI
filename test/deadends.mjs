// v0.39 Phase A · Keine Sackgassen (no dead ends) in the R9 Studio:
// · ✏️ Bearbeiten everywhere (models, houses, blocks → Varianten), and the Crafter's ✕ / "← <Herkunft>" return to where
//   you came from with the same selection;
// · ☆ for whole houses (blueprint_<i>), a ★ chip in Architektur, Teile ★ shows every favourite with ✏️;
// · "Verbaut in" rows: ⚒ (that house in the Crafter, the piece in the hand) and 🎨 (replace all of it in that house with
//   a variant — one undo step);
// · ▶ Spielen takes the plan drafts and the 🎨 Stil preview along — from the Studio's page and from the Studio over the
//   open game — and you land in front of the new house;
// · a full browser storage shows "⚠ Browser-Speicher voll" with 🧹 Platz schaffen — never a ✓ after a failed write;
// · the developer tabs wait behind ⚙ Profi, no text says you need Claude; small ones: 🗑 asks twice, ↻ on screen,
//   ✋ Benutzen with a world open → the Werkbank's hand, a skin-only design is kept, house saves do not re-mesh the game.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import fs from 'fs';
const PORT = 8765 + Math.floor(Math.random() * 200);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', '/home/claude/vr/dist'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const URL0 = `http://127.0.0.1:${PORT}`;
// (big single-file pages on a busy 2-CPU box: do not wait for 'load', the test waits for the page itself)
const NAV = { waitUntil: 'domcontentloaded', timeout: 180000 };
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 880 }, locale: 'de-DE' });   // (the German UI: its crumbs read ← Möbel / ← Architektur / ← Teile; Playwright's default is en-US)
const page = await ctx.newPage();
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
page.on('console', m => { if (m.type() === 'error' && !/favicon|404|QuotaExceeded|quota/i.test(m.text())) logs.push('[console] ' + m.text().slice(0, 300)); });
page.on('dialog', d => d.accept('Test'));
const ev = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => page.waitForTimeout(ms);
const safe = async (fn, a) => { try { return await ev(fn, a); } catch (e) { return null; } };
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const shot = (n) => page.screenshot({ path: `/home/claude/vr/test/shots/${n}.png`, timeout: 180000 }).catch(() => {});
const done = async () => { console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 14)) console.log(l); check(!logs.some(l => /pageerror/.test(l)), 'no page errors'); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); await browser.close(); srv.kill(); process.exit(fails ? 1 : 0); };
// a section that throws counts as a failure, the test goes on
const section = async (name, fn) => { console.log(name); try { await fn(); } catch (e) { fails++; console.log('  ✗ ' + name + ' broke: ' + String(e && e.message || e).slice(0, 400)); } };

await section('0 · the built pages', async () => {
  const bad = /schick mir|Claude liest|übernehme ich/;
  const html = fs.readFileSync('/home/claude/vr/dist/studio.html', 'utf8'), sa = fs.readFileSync('/home/claude/vr/dist/studio_artifact.html', 'utf8');
  check(!bad.test(html) && !bad.test(sa), 'no text in either Studio says it needs Claude (schick mir · Claude liest · übernehme ich)');
});

// ---- the Studio, every catalogue house built
await page.goto(URL0 + '/studio.html', NAV);
async function booted() { for (let i = 0; i < 700; i++) { await wait(500); const s = await safe(() => ({ boot: document.getElementById('studio').classList.contains('boot'), houses: window.__studio ? window.__studio.HOUSE.size : -1, all: window.__studioCore ? window.__studioCore.HOUSES.length : 99, tex: !!(window.__studioCore && window.__studioCore.texInfo()) })); if (s && !s.boot && s.tex && s.houses >= s.all) return true; } return false; }
check(await booted(), 'the Studio is up, every catalogue house built');
await ev(() => { localStorage.removeItem('r9si.favs'); VR.Favs.sync(); });
const SOFA = await ev(() => Object.keys(VR.VM.MODELS).find(n => /^vm_sofa/.test(n)));

await section('1 · ⚙ Profi: the developer tabs wait behind it', async () => {
  const vis = () => ev(() => [...document.querySelectorAll('#right .tabs .tab')].filter(t => t.getClientRects().length > 0).map(t => t.textContent.trim()));
  const t0 = await vis();
  const pro = await ev(() => { const b = document.querySelector('#right .tabs .proT'); return b ? b.textContent.trim() : null; });
  const folk = await ev(() => { const b = document.querySelector('nav.modes [data-mode="folk"]'); return !!b && b.getClientRects().length > 0; });
  check(t0.join() === 'Bausteine' && /Profi/.test(pro || ''), 'only "Bausteine" shows; Quelle · Datei · Log · Sprache wait behind "' + pro + '" (' + t0.join(', ') + ')');
  check(!folk, 'no "⚇ Figuren · bald" in the top bar');
  if (pro) await page.click('#right .tabs .proT');
  const t1 = await vis(), mem = await ev(() => localStorage.getItem('r9si.studio.pro'));
  check(t1.length === 5 && mem === '1', '⚙ Profi shows all five tabs and is remembered (' + t1.join(', ') + ')');
  if (pro) await page.click('#right .tabs .proT');
  check((await vis()).join() === 'Bausteine' && await ev(() => localStorage.getItem('r9si.studio.pro')) === '0', 'and hides them again');
});

await section('2 · ✏️ Bearbeiten on a model → the Item-Crafter, ✕ → back where you were', async () => {
  const r = await ev(async (sofa) => {
    const sleep = (ms) => new Promise(res => setTimeout(res, ms)), C = window.__studioCore, S = window.__st, CR = VR.Crafter;
    C.setMode('furn', true); C.selectModel(sofa); await sleep(200);
    const first = document.querySelector('#partsBody button');
    const out = { first: first && first.textContent.trim(), pri: !!(first && first.classList.contains('pri')) };
    first.click();
    for (let i = 0; i < 60 && !(CR.on && CR.item); i++) await sleep(100);
    out.mode = S.mode; out.kind = CR.kind; out.item = CR.item && CR.item.name;
    const cr = document.querySelector('#crumb button'); out.crumb = cr && cr.textContent.trim();
    const x = document.querySelector('#partsBody [data-act="close"]'); out.close = !!x;
    if (x) x.click(); await sleep(400);
    const on = document.querySelector('#list .card.on');
    out.back = { mode: S.mode, scene: S.scene && S.scene.type, name: S.scene && S.scene.name, on: on && on.dataset.name };
    // the same way back with "← Möbel" in the left column
    first && document.querySelector('#partsBody button').click();
    for (let i = 0; i < 60 && !(CR.on && CR.item); i++) await sleep(100);
    const cr2 = document.querySelector('#crumb button'); if (cr2) cr2.click(); await sleep(400);
    out.back2 = { mode: S.mode, name: S.scene && S.scene.name };
    return out;
  }, SOFA);
  console.log('  model', JSON.stringify(r));
  check(r.first === '✏️ Bearbeiten' && r.pri, 'a model\'s first, primary action is "✏️ Bearbeiten"');
  check(r.mode === 'craft' && r.kind === 'item' && r.item === SOFA, '✏️ opens the Item-Crafter on it');
  check(/^← Möbel/.test(r.crumb || ''), 'the Crafter shows where you came from: "' + r.crumb + '"');
  check(r.close && r.back.mode === 'furn' && r.back.scene === 'model' && r.back.name === SOFA && r.back.on === SOFA, '✕ returns to Möbel with the same model selected');
  check(r.back2.mode === 'furn' && r.back2.name === SOFA, '"← Möbel" does the same');
});

await section('3 · Architektur: ☆ and ✏️ on every house card, a ★ Favoriten chip', async () => {
  const r = await ev(async () => {
    const sleep = (ms) => new Promise(res => setTimeout(res, ms)), C = window.__studioCore, S = window.__st, CR = VR.Crafter;
    C.setMode('arch'); await sleep(300);
    const cards = [...document.querySelectorAll('#list .card.house')];
    const out = { n: cards.length, favb: cards.every(c => c.querySelector('.favb')), editb: cards.every(c => c.querySelector('.editb')) };
    const card = document.querySelector('#list .card.house[data-house="3"]');
    card.querySelector('.favb').click();
    out.favs = VR.Favs.list();
    const chip = document.querySelector('#chips button[data-fcat="fav"]'); out.chip = chip && chip.textContent;
    if (chip) { chip.click(); await sleep(150); }
    out.shown = [...document.querySelectorAll('#list .card.house')].map(c => c.dataset.house);
    const all = document.querySelector('#chips button[data-fcat="all"]'); if (all) all.click();
    await sleep(150);
    document.querySelector('#list .card.house[data-house="3"] .editb').click();
    for (let i = 0; i < 300 && !(CR.house && CR.house.index === 3 && CR.gpu && S.mode === 'craft'); i++) await sleep(150);
    out.craft = { mode: S.mode, kind: CR.kind, idx: CR.house && CR.house.index };
    const cr = document.querySelector('#crumb button'); out.crumb = cr && cr.textContent.trim();
    if (cr) cr.click(); await sleep(400);
    out.back = { mode: S.mode, scene: S.scene && S.scene.type, idx: S.scene && S.scene.index };
    return out;
  });
  console.log('  arch', JSON.stringify(r));
  check(r.n === 11 && r.favb && r.editb, 'all 11 house cards have ☆ and ✏️');
  check(r.favs.join() === 'blueprint_3', '☆ on Villa Belfronte makes blueprint_3 a favourite (the game\'s ★ tab knows that id)');
  check(/Favoriten/.test(r.chip || '') && r.shown.join() === '3', 'the ★ Favoriten chip in Architektur shows it (' + r.shown.join() + ')');
  check(r.craft.mode === 'craft' && r.craft.kind === 'house' && r.craft.idx === 3, '✏️ on the card opens that house in the Crafter');
  check(/^← Architektur/.test(r.crumb || '') && r.back.mode === 'arch' && r.back.scene === 'house' && r.back.idx === 3, '"' + r.crumb + '" returns to that house');
});

await section('4 · 🧱 Teile → ★: every favourite (block, model, house) with a picture and ✏️', async () => {
  const r = await ev(async (sofa) => {
    const sleep = (ms) => new Promise(res => setTimeout(res, ms)), C = window.__studioCore, S = window.__st, CR = VR.Crafter;
    VR.Favs.add(sofa); VR.Favs.add('vx_led_cove');
    C.setMode('parts'); await sleep(400);
    const chip = document.querySelector('#chips button[data-pcat="fav"]'); chip.click(); await sleep(300);
    // (the pictures come as the cards scroll into view)
    for (let i = 0; i < 30 && [...document.querySelectorAll('#list .card[data-fid]')].some(c => !c.querySelector('canvas.th, img.th')); i++) await sleep(150);
    const cards = [...document.querySelectorAll('#list .card[data-fid]')];
    const out = { ids: cards.map(c => c.dataset.fid), n: +((chip.querySelector('b') || {}).textContent || 0), edit: cards.map(c => !!c.querySelector('.editb')), pic: cards.map(c => !!c.querySelector('canvas.th, img.th')) };
    const e = document.querySelector(`#list .card[data-fid="${sofa}"] .editb`); if (e) e.click();
    for (let i = 0; i < 60 && !(CR.on && CR.item); i++) await sleep(100);
    out.kind = CR.kind; out.item = CR.item && CR.item.name;
    const cr = document.querySelector('#crumb button'); out.crumb = cr && cr.textContent.trim();
    if (cr) cr.click(); await sleep(400);
    out.back = { mode: S.mode, cat: S.cat };
    return out;
  }, SOFA);
  console.log('  teile ★', JSON.stringify(r));
  check(r.ids.join() === ['vx_led_cove', SOFA, 'blueprint_3'].join() && r.n === 3, 'Teile → ★ shows all three favourites, newest first: a block, a model, a house');
  check(r.edit.length === 3 && r.edit.every(Boolean) && r.pic.every(Boolean), 'each card has a picture and ✏️');
  check(r.kind === 'item' && r.item === SOFA && /^← Teile/.test(r.crumb || '') && r.back.mode === 'parts' && r.back.cat === 'fav', '✏️ on the model opens the Item-Crafter; "' + r.crumb + '" returns to Teile ★');
});

let before = null;
await section('5 · a block: ✏️ → Varianten; "Verbaut in" ⚒ and 🎨', async () => {
  const r = await ev(async () => {
    const sleep = (ms) => new Promise(res => setTimeout(res, ms)), S = window.__st, CAT = VR.StudioCatalog;
    CAT.open('block', 'vx_roof_slate'); await sleep(700);
    const ed = document.querySelector('#partsBody [data-act="edit"]');
    const out = { edit: ed && ed.textContent.trim() };
    if (ed) ed.click(); await sleep(150);
    out.vars = [...document.querySelectorAll('#partsBody .varStrip [data-var]')].map(b => b.dataset.var);
    const red = document.querySelector('#partsBody .varStrip [data-var="vx_roof_red"]'); if (red) red.click();
    await sleep(700);
    out.sel = S.scene && S.scene.name; out.strip = !!document.querySelector('#partsBody .varStrip');
    CAT.open('block', 'vx_roof_slate'); await sleep(700);
    out.rows = [...document.querySelectorAll('#partsBody .part[data-house]')].map(p => ({ h: p.dataset.house, craft: !!p.querySelector('[data-act="usedCraft"]'), paint: !!p.querySelector('[data-act="usedPaint"]') }));
    return out;
  });
  console.log('  block', JSON.stringify(r));
  check(r.edit === '✏️ Bearbeiten', 'a block has "✏️ Bearbeiten"');
  check(r.vars.length === 12 && r.vars.includes('vx_roof_red'), '✏️ shows the Varianten: the 12 roof colours');
  check(r.sel === 'vx_roof_red' && r.strip, 'a click on a variant selects it (the strip stays open)');
  check(r.rows.some(x => x.h === '7') && r.rows.length && r.rows.every(x => x.craft && x.paint), '"Verbaut in": every house row has ⚒ and 🎨 (' + r.rows.map(x => x.h).join(',') + ')');
  await shot('deadends_1_block');
  // 🎨 on Palais Étoile: pick the red roof → all slate roofs there are red, as one undo step, turned as before
  const p = await ev(async () => {
    const sleep = (ms) => new Promise(res => setTimeout(res, ms)), S = window.__st, CR = VR.Crafter, R = VR.R, T = R.T;
    const b = document.querySelector('#partsBody .part[data-house="7"] [data-act="usedPaint"]'); if (b) b.click(); await sleep(200);
    const out = { pick: [...document.querySelectorAll('#partsBody .varPick [data-var]')].map(x => x.dataset.var) };
    const red = document.querySelector('#partsBody .varPick [data-var="vx_roof_red"]'); if (red) red.click();
    for (let i = 0; i < 400; i++) { await sleep(200); if (S.mode === 'craft' && CR.house && CR.house.index === 7 && CR.gpu && CR.undo.length) break; }
    const h = CR.house; if (!h) return out;
    const fac = (arr, name) => { const t = R.byName[name], id = t.id, f = [0, 0, 0, 0]; let n = 0; for (let i = 0; i < arr.length; i++) { const s = arr[i]; if (s && T.type[s] === id) { n++; f[t.get(s, 'facing')]++; } } return { n, f: f.join(',') }; };
    out.base = { slate: fac(h.base, 'vx_roof_slate'), red: fac(h.base, 'vx_roof_red') };
    out.now = { slate: fac(h.blocks, 'vx_roof_slate'), red: fac(h.blocks, 'vx_roof_red') };
    out.mode = S.mode; out.idx = h.index; out.undo = CR.undo.length; out.dirty = !!h.dirty; out.tip = document.getElementById('craftTip').textContent;
    CR.undoStep(false); await sleep(200);
    out.undone = { slate: fac(h.blocks, 'vx_roof_slate').n, red: fac(h.blocks, 'vx_roof_red').n, undo: CR.undo.length };
    CR.undoStep(true); await sleep(200);
    return out;
  });
  console.log('  🎨', JSON.stringify(p));
  before = p.base;
  check(p.pick && p.pick.length === 11 && p.pick.includes('vx_roof_red') && !p.pick.includes('vx_roof_slate'), '🎨 offers the Varianten to choose from (the other 11 roof colours)');
  check(p.mode === 'craft' && p.idx === 7 && p.base && p.base.slate.n > 50 && p.now.slate.n === 0 && p.now.red.n === p.base.red.n + p.base.slate.n, '🎨 → Rotes Dach: every slate roof of Palais Étoile is red now (' + (p.base && p.base.slate.n) + ' → 0)');
  check(p.now && p.now.red.f === p.base.slate.f, 'each roof piece keeps its direction (facings ' + (p.now && p.now.red.f) + ')');
  check(p.undo === 1 && p.undone && p.undone.slate === p.base.slate.n && p.undone.red === p.base.red.n && p.dirty, 'ONE undo step takes all of it back; the house waits for "Ins Spiel"');
  await shot('deadends_2_painted');
  // ⚒: that house in the Crafter, the roof in the hand, ready to paint with it
  const k = await ev(async () => {
    const sleep = (ms) => new Promise(res => setTimeout(res, ms)), S = window.__st, CR = VR.Crafter, C = window.__studioCore;
    C.setMode('parts'); VR.StudioCatalog.open('block', 'vx_roof_slate'); await sleep(600);
    const b = document.querySelector('#partsBody .part[data-house="7"] [data-act="usedCraft"]'); if (b) b.click();
    for (let i = 0; i < 400; i++) { await sleep(200); if (S.mode === 'craft' && CR.house && CR.house.index === 7 && CR.gpu) break; }
    return { mode: S.mode, idx: CR.house && CR.house.index, hand: CR.hot[CR.slot], tool: CR.tool };
  });
  console.log('  ⚒', JSON.stringify(k));
  check(k.mode === 'craft' && k.idx === 7 && k.hand === 'vx_roof_slate' && k.tool === 'paint', '⚒ opens Palais Étoile in the Crafter with the slate roof in the hand, 🖌 Malen ready');
});

await section('6 · a full browser storage: the banner, no ✓, 🧹 Platz schaffen', async () => {
  const r = await ev(async (sofa) => {
    const sleep = (ms) => new Promise(res => setTimeout(res, ms)), CR = VR.Crafter;
    for (let i = 0; i < 3; i++) localStorage.setItem('r9si.thumb.test' + i, 'data:image/jpeg;base64,' + 'A'.repeat(30000));
    CR.open.item(sofa); await sleep(300);
    const it = CR.item, i0 = it.V.findIndex(v => v);
    CR.vApply([[i0 % it.VW, Math.floor(i0 / (it.VW * it.VD)), Math.floor(i0 / it.VW) % it.VD, VR.VM.M.matte(0xd02020) >>> 0]]);
    window.__realSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function () { throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); };
    const sv = document.querySelector('#partsBody [data-act="save"]'); const out = { save: sv && sv.textContent.trim() };
    if (sv) sv.click(); await sleep(250);
    const tip = document.getElementById('craftTip'); out.tip = tip.textContent; out.err = tip.classList.contains('err');
    const bar = document.getElementById('fullBar'); out.bar = bar && bar.getClientRects().length ? bar.textContent : null;
    // a ☆ while it is full: kept for now, but not reported as done
    window.__studioCore.setMode('parts'); await sleep(300);
    const fb = document.querySelector('#list .card[data-bid] .favb'); if (fb) fb.click();
    out.sys = document.getElementById('sysText').textContent; out.sysErr = document.getElementById('sysDot').classList.contains('err');
    Storage.prototype.setItem = window.__realSet;
    const keep = { studio: localStorage.getItem('r9si.studio'), favs: localStorage.getItem('r9si.favs'), lib: localStorage.getItem('r9si.library') };
    const free = document.querySelector('#fullBar [data-act="free"]'); if (free) free.click(); await sleep(200);
    const list = document.querySelector('#fullBar .freeList'); out.list = list && list.textContent;
    const go = document.querySelector('#fullBar [data-act="freeGo"]'); if (go) go.click(); await sleep(200);
    out.thumbs = Object.keys(localStorage).filter(k => k.startsWith('r9si.thumb.')).length;
    out.kept = localStorage.getItem('r9si.studio') === keep.studio && localStorage.getItem('r9si.favs') === keep.favs && localStorage.getItem('r9si.library') === keep.lib;
    out.after = document.getElementById('fullBar') ? document.getElementById('fullBar').textContent : null;
    return out;
  }, SOFA);
  console.log('  full', JSON.stringify(r));
  check(r.err && !/✓/.test(r.tip), '"Ins Spiel" with a full storage says it failed — no ✓ (' + r.tip + ')');
  check(r.bar && /Browser-Speicher voll/.test(r.bar) && /Platz schaffen/.test(r.bar), 'the banner shows: ⚠ Browser-Speicher voll · 🧹 Platz schaffen');
  check(r.sysErr && !/✓/.test(r.sys), 'a ☆ that could not be stored is not reported as done (' + r.sys + ')');
  check(/Bild/.test(r.list || ''), '🧹 lists what it would delete before it does: ' + r.list);
  check(r.thumbs === 0 && r.kept, '🧹 frees the pictures — designs, favourites and Bauteile stay');
  await shot('deadends_3_full');
});

await section('7 · the small ones: 🗑 asks twice, ↻ on screen, ✋ Benutzen says right click, a skin-only design is kept', async () => {
  const r = await ev(async (sofa) => {
    const sleep = (ms) => new Promise(res => setTimeout(res, ms)), C = window.__studioCore, S = window.__st, CR = VR.Crafter;
    const out = {};
    // the sofa design goes in now (storage is back), then 🗑 in "Meine Designs" needs a second click
    CR.open.item(sofa); await sleep(300);
    const it = CR.item, i0 = it.V.findIndex(v => v);
    CR.vApply([[i0 % it.VW, Math.floor(i0 / (it.VW * it.VD)), Math.floor(i0 / it.VW) % it.VD, VR.VM.M.matte(0x20d020) >>> 0]]);
    document.querySelector('#partsBody [data-act="save"]').click(); await sleep(300);
    out.saved = !!(CR.store().models || {})[sofa];
    const del = () => [...document.querySelectorAll('#partsBody .design')].find(d => d.textContent.includes((VR.dispName ? VR.dispName(VR.VM.MODELS[sofa].display) : VR.VM.MODELS[sofa].display).split(' ·')[0]));   // (the card shows the player's language: VR.dispName since i18n2)
    const d1 = del(), tb = d1 && d1.querySelector('[data-act="del"]');
    if (tb) { tb.dataset.probe = '1'; tb.click(); } await sleep(100);
    out.after1 = !!(CR.store().models || {})[sofa];
    const d2 = del(), tb2 = d2 && d2.querySelector('[data-act="del"]');
    out.del = { d1: !!d1, tb: !!tb, armed: !!(tb && tb.classList.contains('arm')), same: !!(tb2 && tb2.dataset.probe === '1'), tb2: !!tb2, designs: document.querySelectorAll('#partsBody .design').length };   // (which button the second click hits: the armed one, or a fresh one after a re-render)
    if (tb2) tb2.click(); await sleep(200);
    out.after2 = !!(CR.store().models || {})[sofa];
    // ↻ on the house Crafter's bar turns the next piece (R without a keyboard)
    CR.open.house(7); for (let i = 0; i < 300 && !(CR.house && CR.house.index === 7 && CR.gpu); i++) await sleep(150);
    const rot0 = CR.rot, rb = document.querySelector('#craftBar .rotb'); if (rb) rb.click();
    out.rot = [rot0, CR.rot, !!rb];
    // ✋ Benutzen without a world: into the Crafter, and it says the right mouse button places it
    C.setMode('parts'); await sleep(300);
    VR.StudioCatalog.use('vollton_coral'); await sleep(300);
    out.use = { sys: document.getElementById('sysText').textContent, mode: S.mode, hand: CR.hot[CR.slot] };
    // a skin-only design: Villa R9 160 in another facade, no block changed → kept, the game builds it in that facade
    C.setMode('arch'); await sleep(200);
    const rec = window.__studio.HOUSE.get(1), skins = rec.data.skins.filter((v, i, a) => a.indexOf(v) === i), other = skins.find(s => s !== rec.data.skin);
    await C.rebuildHouse(1, { skin: other, mirror: false }); window.__studio.selectHouse(1); await sleep(200);
    CR.want = { kind: 'house', idx: 1 }; C.setMode('craft');
    for (let i = 0; i < 300 && !(CR.house && CR.house.index === 1 && CR.gpu && S.mode === 'craft'); i++) await sleep(150);
    out.skin = { want: other, crafter: CR.house && CR.house.skin };
    document.querySelector('#partsBody [data-act="save"]').click(); await sleep(400);
    const h1 = (CR.store().houses || {})[1];
    out.design = h1 ? { skin: h1.skin, tpl: !!h1.tpl, n: h1.n } : null;
    out.houseFor = !!(VR.Custom.houseFor && (VR.Custom.apply(VR.Custom.load()), VR.Custom.houseFor(1)));
    out.tip = document.getElementById('craftTip').textContent;
    return out;
  }, SOFA);
  console.log('  small', JSON.stringify(r));
  check(r.saved && r.after1 && !r.after2, '🗑 in "Meine Designs" removes a design only on the second click');
  check(r.rot[2] && r.rot[1] === ((r.rot[0] + 1) & 3), '↻ on the Crafter\'s bar turns the next piece (R)');
  check(/Rechtsklick/.test(r.use.sys) && r.use.mode === 'craft' && r.use.hand === 'vollton_coral', '✋ Benutzen: in the hand, "Rechtsklick setzt es" (' + r.use.sys + ')');
  check(r.design && r.design.skin === r.skin.want && !r.design.tpl && r.houseFor, 'a design that only changes the facade is kept (' + JSON.stringify(r.design) + ') — the game builds it that way');
  check(/neue Städte/.test(r.tip) && /stehende Häuser bleiben/.test(r.tip) && !/ist im Spiel/.test(r.tip), '"Ins Spiel" says what happens: ' + r.tip);
});

// ---- the game: a flat world, then the Studio's Welt mode on it
const inGame = async (id, maxS = 180) => { for (let i = 0; i < maxS * 2; i++) { await wait(500); if (await safe((id) => { const g = window.VR && VR.game; return !!(g && g.state === 'play' && g.meta && g.meta.id === id && g.player && !g.player.hold && !g.studioOpen && !g.revealPending && !(g.director && g.director.active)); }, id)) return true; } return false; };
const atTitle = async (maxS = 120) => { for (let i = 0; i < maxS * 2; i++) { await wait(500); if (await safe(() => !!(window.VR && VR.game && VR.game.state === 'title'))) return true; } return false; };
const inStudio = async (id, maxS = 240) => { for (let i = 0; i < maxS * 2; i++) { await wait(500); if (await safe((id) => { const WM = window.VR && VR.StudioWorld; return !!(WM && WM.world && WM.world.id === id && !WM.loading && WM.cols.size && WM.wb && WM.wb.region === WM.region && document.getElementById('playBtn')); }, id)) return true; } return false; };
// a planned piece: its status in the browser's storage, and whether the game has it in its own plan list
const planNow = (id, pid) => safe(([id, pid]) => { const d = JSON.parse(localStorage.getItem('r9si.plans.' + id) || '{"plans":[]}'), q = d.plans.find(x => x.id === pid), bp = VR.game.gadgets && VR.game.gadgets.blue; return { status: q ? q.status : null, game: !!(bp && bp.plans && bp.plans.some(x => x.id === pid)) }; }, [id, pid]);
let W = null;
await section('8 · a world: Welt → Häuser ★, placing with buttons, ✋ Benutzen → the Werkbank, a full storage there', async () => {
  await page.goto(URL0 + '/index.html', NAV);
  check(await atTitle(), 'the game is at its title');
  await ev(() => { if (VR.UIPrefs) VR.UIPrefs.set({ pro: true }); });   // (W1: the Werkbank, ✋ Benutzen and the Plan tab are Profi things)
  // (render distance 6: a planned house and the ground around it are loaded from where you land, 24 blocks in front of it)
  await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.horizon = 0; g.applySettings('*'); g.saveSettings(); });
  await ev(`VR.game.createWorld({name:'Sackgasse',mode:'creative',difficulty:'peaceful',seed:'4711',type:'flat',cheats:true,kit:false})`);
  for (let i = 0; i < 240; i++) { await wait(500); if (await safe(() => VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)) break; }
  W = await ev(async () => { const g = VR.game, p = g.player; const w = { id: g.meta.id, P: p.pos.map(v => Math.floor(v)) }; await g.quitToTitle(); return w; });
  check(await atTitle(), 'saved and back at the title');
  await page.goto(URL0 + '/studio.html#world/' + encodeURIComponent(W.id) + '/houses', NAV);
  check(await inStudio(W.id), 'the Studio opens the world');
  const r = await ev(async (P) => {
    const sleep = (ms) => new Promise(res => setTimeout(res, ms)), C = window.__studioCore, S = window.__st, WM = VR.StudioWorld, CR = VR.Crafter;
    for (let i = 0; i < 600 && !window.__studio.HOUSE.get(6); i++) await sleep(200);   // (the Architektur view builds the houses first)
    WM.tab = 'houses'; WM.refresh(); await sleep(300);
    const out = {};
    const first = document.querySelector('#list .grp'); out.grp = first && first.textContent;
    const firstCard = first && first.nextElementSibling; out.firstCard = firstCard && firstCard.querySelector('.n') ? firstCard.querySelector('.n').textContent : null;
    out.pencil = /✎/.test(document.getElementById('list').textContent);
    { const c = document.querySelector('#list .card.house[data-house="1"]'); out.own = c && c.querySelector('.cap') ? c.querySelector('.cap').textContent : null; }
    // a house in hand: ↻ and ◐ as buttons too
    WM.tool = WM.houseItem(6); WM.meshFor(WM.tool); WM.refresh(); await sleep(200);
    const rb = document.querySelector('#partsBody [data-act="wrot"]'), fb = document.querySelector('#partsBody [data-act="wfac"]');
    const r0 = WM.rot; if (rb) rb.click(); out.wrot = [!!rb, r0, WM.rot];
    const s0 = WM.tool.skin + (WM.tool.mirror ? '*' : ''); if (fb) fb.click(); out.wfac = [!!fb, s0, WM.tool.skin + (WM.tool.mirror ? '*' : '')];
    WM.tool = null; WM.ghost = null; WM.refresh();
    // ✋ Benutzen from Teile with this world open: into the Werkbank's hand, not into a Crafter house
    C.setMode('parts'); await sleep(300);
    VR.StudioCatalog.use('vollton_coral'); await sleep(500);
    out.use = { mode: S.mode, tab: WM.tab, hand: CR.hot[CR.slot], craft: !!CR.on };
    // the Werkbank's 🖌 Malen keeps the turn: stairs facing east painted with other stairs still face east
    {
      const WB = WM.wb, t0 = VR.R.byName.oak_stairs, x = P[0] + 6, y = P[1], z = P[2] + 6;
      WB.edit([[x, y, z, t0.with(t0.defaultState, 'facing', 1)]], 'Treppe');
      CR.hot[CR.slot] = 'vollton_white_stairs'; WB.brush.mode = 'paint'; WB.brush.r = 0;
      WB.stroke = { cells: new Map(), undo: new Map(), last: null }; WB.brushAt({ x, y, z }); WB.strokeEnd();
      const s = WM.getBlock(x, y, z), t = VR.R.types[VR.R.T.type[s]];
      out.paint = { name: t.name, facing: t.get(s, 'facing') };
      CR.hot[CR.slot] = 'vollton_coral';
    }
    // the Werkbank and the spawn point with a full storage: no "✓ Alles ist im Spiel", no "Spawnpunkt gesetzt"
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function () { throw new DOMException('The quota has been exceeded.', 'QuotaExceededError'); };
    const st = VR.R.byName.stone.defaultState, n = WM.wb.edit([[P[0] - 30, P[1] + 3, P[2] - 30, st]], 'Test');
    await sleep(400); WM.refresh(); await sleep(100);
    out.wb = { n, live: (document.querySelector('#partsBody .wbLive') || {}).textContent || '', panel: document.getElementById('partsBody').textContent.slice(0, 400) };
    const sp = WM.setSpawn([P[0] + 0.5, P[1], P[2] + 0.5]);
    out.spawn = { ret: sp, tip: (document.getElementById('worldTip') || {}).textContent || '' };
    // a ☆ on the Werkbank's palette: kept for now, but not reported as done
    const wt = document.querySelector('#list .tile .favb'); if (wt) wt.click();
    const wtip = document.getElementById('worldTip');
    out.wfav = { btn: !!wt, tip: wtip ? wtip.textContent : '', err: !!(wtip && wtip.classList.contains('err')) };
    out.bar = (document.getElementById('fullBar') || {}).textContent || '';
    Storage.prototype.setItem = real;
    return out;
  }, W.P);
  console.log('  world', JSON.stringify(r));
  check(/Favoriten/.test(r.grp || '') && /Villa Belfronte/.test(r.firstCard || ''), 'Welt → Häuser: ★ Favoriten first, with Villa Belfronte (' + r.firstCard + ')');
  check(!r.pencil && /✏️/.test(r.own || '') && /dein Design/.test(r.own || ''), 'your own design (the facade-only Villa R9 160) is marked ✏️, no ✎ left (' + r.own + ')');
  check(r.wrot[0] && r.wrot[2] === ((r.wrot[1] + 1) & 3), 'placing: ↻ Drehen as a button (R)');
  check(r.wfac[0] && r.wfac[1] !== r.wfac[2], 'placing: ◐ Fassade as a button (F): ' + r.wfac[1] + ' → ' + r.wfac[2]);
  check(r.use.mode === 'world' && r.use.tab === 'bench' && r.use.hand === 'vollton_coral' && !r.use.craft, '✋ Benutzen with a world open puts it into the Werkbank\'s hand');
  check(r.paint && r.paint.name === 'vollton_white_stairs' && r.paint.facing === 1, 'the Werkbank\'s 🖌 Malen keeps the turn: painted stairs still face east (' + JSON.stringify(r.paint) + ')');
  check(r.wb.n === 1 && !/Alles ist im Spiel/.test(r.wb.panel) && /Speicher/.test(r.wb.live + r.wb.panel), 'the Werkbank with a full storage: no "✓ Alles ist im Spiel", it says why (' + r.wb.live + ')');
  check(r.spawn.ret === false && !/gesetzt/.test(r.spawn.tip), 'the spawn point with a full storage: not "gesetzt" (' + r.spawn.tip + ')');
  check(r.wfav.btn && r.wfav.err && /Browser-Speicher voll/.test(r.wfav.tip), 'a ☆ in the Werkbank with a full storage is not reported as done (' + r.wfav.tip + ')');
  check(/Browser-Speicher voll/.test(r.bar), 'the banner is there in the Welt mode too');
});

await section('9 · ▶ Spielen takes the plan draft along: the game has it, you land in front of it', async () => {
  if (!W) { check(false, 'no world'); return; }
  const p = await ev(async (P) => {
    const sleep = (ms) => new Promise(res => setTimeout(res, ms)), WM = VR.StudioWorld, C = window.__studioCore;
    C.setMode('world'); WM.tab = 'houses'; WM.refresh(); await sleep(200);
    const it = WM.houseItem(6); WM.tool = it; WM.meshFor(it);
    for (let i = 0; i < 150 && !WM.meshFor(it); i++) await sleep(200);
    const m = WM.meshFor(it); if (!m) return { err: 'no mesh' };
    const hit = WM.pickGround({ o: [P[0] + 30.5, 300, P[2] + 0.5], d: [0, -1, 0] }), gp = WM.ghostAt(hit, it, m);
    WM.change(() => { const q = Object.assign({}, gp, { id: 'dead-1', status: 'draft', t: Date.now() }); delete q.ok; WM.plans.push(q); });
    WM.tool = null; WM.ghost = null; WM.refresh();
    const q = WM.plans.find(x => x.id === 'dead-1'), L = WM.placeOf(q, m).lot;
    const stored = JSON.parse(localStorage.getItem('r9si.plans.' + WM.world.id) || '{"plans":[]}').plans.length;
    return { status: q.status, stored, keepNow: typeof WM.keepNow, box: [L[0], q.F, L[1], L[2], q.F + Math.max(3, m.top || 8), L[3]] };
  }, W.P);
  console.log('  plan', JSON.stringify(p));
  check(p.status === 'draft' && p.stored === 0 && p.keepNow === 'function', 'a house planned, still a draft (nothing handed over yet)');
  await ev(() => document.getElementById('playBtn').click());
  check(await inGame(W.id), '▶ starts the world');
  // the draft went along: handed to the game, and the game has it in its plan list. (Building it is the game's own
  // business, tested in world_mode.mjs: this flat world's floor, y 4, is too close to the bedrock for a catalogue house —
  // the game's builder wants 48 blocks of ground below a floor (blueprints.js DEPTH) and leaves such a plan unbuilt.)
  let handed = null;
  for (let i = 0; i < 20 && !(handed && handed.game); i++) { await wait(500); handed = await planNow(W.id, 'dead-1'); }
  check(handed && (handed.status === 'pending' || handed.status === 'built') && handed.game, 'the draft went along: handed to the game, in its plan list (' + JSON.stringify(handed) + ')');
  await wait(1200);
  const me = await ev(() => { const g = VR.game, p = g.player, w = g.world, T = VR.R.T, F = VR.F; const solid = (x, y, z) => !!(T.flags[w.getBlock(x, y, z)] & F.SOLID); const fx = Math.floor(p.pos[0]), fy = Math.floor(p.pos[1] + 0.01), fz = Math.floor(p.pos[2]); return { pos: p.pos.map(v => +v.toFixed(2)), yaw: p.yaw, wall: solid(fx, fy, fz) || solid(fx, fy + 1, fz), ground: solid(fx, fy - 1, fz) }; });
  const b = p.box, [x, , z] = me.pos, cx = (b[0] + b[3] + 1) / 2, cz = (b[2] + b[5] + 1) / 2;
  const dx = Math.max(b[0] - x, 0, x - (b[3] + 1)), dz = Math.max(b[2] - z, 0, z - (b[5] + 1)), dist = Math.hypot(dx, dz);
  const vx = cx - x, vz = cz - z, vl = Math.hypot(vx, vz) || 1, look = -Math.sin(me.yaw) * vx / vl - Math.cos(me.yaw) * vz / vl;
  console.log('  landed', JSON.stringify(me), dist.toFixed(1), look.toFixed(2));
  check(dist >= 2 && dist <= 30 && !me.wall && me.ground && look > 0.7, 'you land in front of the new house, looking at it (' + dist.toFixed(1) + ' blocks, view ' + look.toFixed(2) + ')');
  await shot('deadends_4_landed');
  // the game: a house design saved in the Studio does not re-mesh the whole world, a furniture design does
  const rm = await ev((sofa) => {
    const g = VR.game; let n = 0; const real = g.remeshAll.bind(g); g.remeshAll = () => { n++; real(); };
    const st = VR.Custom.load() || { v: 1, houses: {}, models: {} };
    st.houses = st.houses || {}; st.houses[2] = { v: 2, name: 'Villa R9 140', index: 2, seed: 7, beds: 3, skin: 'grey', mirror: true, n: 0, t: Date.now() };
    g.reloadCustom(st); const house = n;
    const m = VR.VM.MODELS[sofa], idx = new Uint16Array(m.VW * m.VH * m.VD); for (let i = 0; i < idx.length; i++) idx[i] = m.vol[i] ? 1 : 0;
    const st2 = JSON.parse(JSON.stringify(st));
    st2.models = st2.models || {}; st2.models[sofa] = { v: 1, W: m.W, H: m.H, D: m.D, res: m.res, pal: [0, (VR.VM.M.matte(0x3060ff) >>> 0)], rle: VR.Custom.b64(new Uint8Array(VR.Custom.rle(idx).buffer)), t: Date.now() };
    g.reloadCustom(st2); const model = n - house;
    g.remeshAll = real;
    return { house, model };
  }, SOFA);
  console.log('  remesh', JSON.stringify(rm));
  check(rm.house === 0 && rm.model === 1, 'the game: a house design does not re-mesh the world, a furniture design does');
});

// ---- the other way out: ▶ in the Studio over the open game (the game's overlay)
const frameStudio = () => page.frames().find(f => /studio\.html/.test(f.url()));
const fev = (fn, a) => frameStudio().evaluate(fn, a);
await section('10 · the Studio over the open game: ▶ takes the plan draft and the 🎨 Stil preview along', async () => {
  if (!W) { check(false, 'no world'); return; }
  // a 🎨 Stil preview waiting for this world (the Stil tab keeps one like this), then the Studio over the game
  await ev((id) => localStorage.setItem('r9si.styledraft.' + id, JSON.stringify({ rules: [['oak_planks', 'spruce_planks']], water: null })), W.id);
  await ev(() => VR.game.openStudio());
  let ready = false;
  for (let i = 0; i < 480 && !ready; i++) { await wait(500); const f = frameStudio(); if (!f) continue; try { ready = await f.evaluate((id) => { const WM = window.VR && VR.StudioWorld; return !!(WM && WM.world && WM.world.id === id && !WM.loading && WM.cols.size && WM.st && WM.st.region === WM.region && document.getElementById('playBtn')); }, W.id); } catch (e) { /* loading */ } }
  check(ready, 'the Studio opens over the game, on this world');
  if (!ready) return;
  const p = await fev(async (P) => {
    const sleep = (ms) => new Promise(res => setTimeout(res, ms)), WM = VR.StudioWorld;
    const out = { style: WM.styleDraft ? WM.styleDraft.rules : null };
    const it = WM.houseItem(6);
    for (let i = 0; i < 600 && !WM.meshFor(it); i++) await sleep(200);
    const m = WM.meshFor(it); if (!m) return Object.assign(out, { err: 'no mesh' });
    const hit = WM.pickGround({ o: [P[0] - 40.5, 300, P[2] + 0.5], d: [0, -1, 0] }), gp = WM.ghostAt(hit, it, m);
    WM.change(() => { const q = Object.assign({}, gp, { id: 'dead-2', status: 'draft', t: Date.now() }); delete q.ok; WM.plans.push(q); });
    WM.refresh();
    const q = WM.plans.find(x => x.id === 'dead-2'), L = WM.placeOf(q, m).lot;
    return Object.assign(out, { status: q.status, box: [L[0], q.F, L[1], L[2], q.F + Math.max(3, m.top || 8), L[3]] });
  }, W.P);
  console.log('  overlay plan', JSON.stringify(p));
  check(p.status === 'draft' && JSON.stringify(p.style) === '[["oak_planks","spruce_planks"]]', 'a house planned (a draft) and a 🎨 Stil preview waiting');
  await fev(() => document.getElementById('playBtn').click());
  check(await inGame(W.id), '▶: back in the game');
  let handed = null;
  for (let i = 0; i < 20 && !(handed && handed.game); i++) { await wait(500); handed = await planNow(W.id, 'dead-2'); }
  const st = await ev((id) => ({ saved: (JSON.parse(localStorage.getItem('r9si.style.' + id) || '{}').rules) || [], draft: localStorage.getItem('r9si.styledraft.' + id), game: (VR.game.style && VR.game.style.rules) || [] }), W.id);
  console.log('  overlay ▶', JSON.stringify(handed), JSON.stringify(st));
  check(handed && (handed.status === 'pending' || handed.status === 'built') && handed.game, 'the plan draft went along: handed to the game, in its plan list');
  const rule = (a) => a.some(x => x[0] === 'oak_planks' && x[1] === 'spruce_planks');
  check(rule(st.saved) && !st.draft && rule(st.game), 'the 🎨 Stil preview went into the world: saved, no draft left, the game has the rule');
  const me = await ev(() => { const g = VR.game, p = g.player; return { pos: p.pos.map(v => +v.toFixed(2)), by: g.landedBy }; });
  const b = p.box || [0, 0, 0, 0, 0, 0], [x, , z] = me.pos, dist = Math.hypot(Math.max(b[0] - x, 0, x - (b[3] + 1)), Math.max(b[2] - z, 0, z - (b[5] + 1)));
  console.log('  overlay landed', JSON.stringify(me), dist.toFixed(1));
  check(me.by === 'new' && dist >= 2 && dist <= 30, 'and you land in front of the new house (the 📍 landing still fires: ' + dist.toFixed(1) + ' blocks)');
});

await done();
