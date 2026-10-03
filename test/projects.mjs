// v0.36 🕘 Weitermachen: Crafter work is kept as a draft two seconds after a change (with camera, floor cut, tool and
// hotbar) and never reaches the game before "Ins Spiel"; the Studio starts on the project page when there is something
// to continue; one click opens it exactly as it was; Strg+O from anywhere; a page going away keeps the last change;
// furniture drafts; 📌 ✓ ✎ 🗑; Baukasten houses (🎲 on a shaped house keeps it) and Genie designs are projects too.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const src = fs.readFileSync('/home/claude/vr/test/house_genie.mjs', 'utf8');
const MOCK = src.match(/const MOCK = `([\s\S]*?)`;/)[1];
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--allow-file-access-from-files'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 880 } });
const page = await ctx.newPage();
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
page.on('console', m => { if (m.type() === 'error') logs.push('[console] ' + m.text().slice(0, 300)); });
await page.addInitScript(MOCK);
await page.goto('file:///home/claude/vr/dist/studio.html');
const ev = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => page.waitForTimeout(ms);
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const shot = (n) => page.screenshot({ path: `/home/claude/vr/test/shots/${n}.png`, timeout: 180000, animations: 'disabled' });
async function booted(houses) { for (let i = 0; i < 300; i++) { await wait(500); const s = await ev(() => ({ boot: document.getElementById('studio').classList.contains('boot'), houses: window.__studio ? window.__studio.HOUSE.size : -1, tex: !!(window.__studioCore && window.__studioCore.texInfo()) })); if (!s.boot && s.tex && s.houses >= (houses || 1)) return true; } return false; }
async function craftOpen(i) { for (let k = 0; k < 200; k++) { await wait(400); if (await ev((ix) => !!(VR.Crafter.house && VR.Crafter.gpu && VR.Crafter.house.index === ix && window.__st.mode === 'craft'), i)) return true; } return false; }
const P = (fn, a) => ev(fn, a);

console.log('1 · a fresh Studio');
await booted(3);
const r1 = await ev(() => ({ hub: !!document.querySelector('#hub.on'), btn: !!document.querySelector('nav.modes [data-hub]'), mode: window.__studioCore.S.mode }));
check(!r1.hub && r1.btn && r1.mode === 'arch', 'nothing started yet: the Studio opens in the catalogue as before, 🕘 sits in the top bar');

console.log('2 · build in a house, leave without "Ins Spiel"');
await ev(() => { window.__studio.selectHouse(2); window.__studioCore.setMode('craft'); });
check(await craftOpen(2), 'the Crafter has house 2');
const e2 = await ev(() => {
  const CR = VR.Crafter, h = CR.house, R = VR.R, S = window.__st;
  // eight free cells in the yard, two above the ground, outside the house
  const coral = R.byName.vollton_coral.defaultState, list = [], y = h.F + 2, [hx, hz, hw, hd] = h.rect;
  for (let z = h.pad; z < h.pad + h.lot[1] && list.length < 8; z++) for (let x = h.pad; x < h.pad + h.lot[0] && list.length < 8; x++) { if (x >= hx - 1 && x <= hx + hw && z >= hz - 1 && z <= hz + hd) continue; if (!CR.gGet(x, y, z)) list.push([x, y, z, coral]); }
  CR.applyChanges(list);
  S.cam.yaw = 1.23; S.cam.pitch = 0.33; S.cam.dist = 17; S.scene.center = [S.scene.center[0] + 1.5, S.scene.center[1], S.scene.center[2] - 2];
  CR.hot[4] = 'oak_planks'; CR.slot = 4; CR.drawBar();
  return { n: list.length, pending: CR.draftPending(), center: S.scene.center.slice() };
});
await page.click('#houseTools button:has-text("Erdgeschoss")');
await page.mouse.move(700, 500); await page.keyboard.press('t');
await wait(2700);
const d2 = await ev(() => { const P = VR.Projects, d = P.data('h:2'), p = P.get('h:2'); return { d: d ? { n: d.n, tpl: !!d.tpl, skin: d.skin } : null, p: p ? { kind: p.kind, n: p.n } : null, pending: VR.Crafter.draftPending(), chip: !!document.querySelector('#hudMeta .chip.saved'), note: !!document.querySelector('#partsBody .draftNote'), game: ((JSON.parse(localStorage.getItem('r9si.studio') || '{}').houses) || {})[2] || null, tool: VR.Crafter.tool, cut: window.__st.cutLevel }; });
console.log('   draft', JSON.stringify(d2));
check(e2.pending && d2.d && d2.d.tpl && d2.d.n === e2.n && d2.p && d2.p.kind === 'house' && !d2.pending, 'two seconds after the change the house is a draft (' + e2.n + ' changes)');
check(!d2.game, 'the game does not see the draft (no design saved)');
check(d2.chip && d2.note, 'the HUD and the panel say the draft is safe');
await shot('pj_0_draft');
const d3 = await ev(() => { window.__studioCore.setMode('arch'); const p = VR.Projects.get('h:2'); return { thumb: (localStorage.getItem('r9si.thumb.h:2') || '').slice(0, 22), view: p.view, hash: location.hash }; });
console.log('   left', JSON.stringify({ thumb: d3.thumb, yaw: d3.view && d3.view.yaw, cut: d3.view && d3.view.cut, tool: d3.view && d3.view.tool, slot: d3.view && d3.view.slot, hash: d3.hash }));
check(d3.thumb === 'data:image/jpeg;base64' && d3.view && d3.view.yaw === 1.23 && d3.view.cut === 1 && d3.view.tool === 'paint' && d3.view.slot === 4, 'leaving keeps a picture and the view (camera, floor, tool, hotbar)');

console.log('3 · the Studio starts on 🕘 Weitermachen');
await page.reload();
for (let i = 0; i < 40; i++) { await wait(250); if (await ev(() => !!document.querySelector('#hub.on .pj'))) break; }
const r3 = await ev(() => { const hero = document.querySelector('#hub .pj.hero'); return { on: !!document.querySelector('#hub.on'), hero: hero && hero.dataset.id, img: !!(hero && hero.querySelector('.im img')), chip: hero && hero.querySelector('.st') ? hero.querySelector('.st').textContent : '', sub: hero ? hero.querySelector('.sb').textContent : '', boot: document.getElementById('studio').classList.contains('boot'), badge: document.querySelector('nav.modes [data-hub] .hubN').textContent }; });
console.log('   hub', JSON.stringify(r3));
check(r3.on && r3.hero === 'h:2' && r3.img && /✎/.test(r3.chip) && /noch nicht im Spiel/.test(r3.sub), 'right away (even while the Studio boots): the house, big, with its picture and "✎ in Arbeit"');
check(r3.badge === '1', 'the 🕘 button counts what is unfinished');
await booted(1);       // (SwiftShader blocks the page for long stretches while it boots; a real GPU does not)
await shot('pj_1_hub');
await page.click('#hub .pj.hero [data-a="go"]');
check(await craftOpen(2), 'one click: the Crafter opens that house');
await wait(1000);
const r4 = await ev(() => { const CR = VR.Crafter, h = CR.house, S = window.__st; let n = 0; for (let i = 0; i < h.blocks.length; i++) if (h.blocks[i] !== h.base[i]) n++; return { hub: !!document.querySelector('#hub.on'), n, dirty: h.dirty, yaw: S.cam.yaw, pitch: S.cam.pitch, dist: S.cam.dist, center: S.scene.center, cut: S.cutLevel, tool: CR.tool, slot: CR.slot, hot4: CR.hot[4], tip: (document.getElementById('craftTip') || {}).textContent }; });
console.log('   resumed', JSON.stringify(r4));
check(!r4.hub && r4.n === e2.n && r4.dirty, 'every change is there, still marked "not in the game"');
check(Math.abs(r4.yaw - 1.23) < 1e-6 && Math.abs(r4.pitch - 0.33) < 1e-6 && r4.dist === 17 && r4.cut === 1 && Math.abs(r4.center[0] - e2.center[0]) < 1e-6, 'the camera and the floor cut exactly as left');
check(r4.tool === 'paint' && r4.slot === 4 && r4.hot4 === 'oak_planks', 'the tool and the hotbar exactly as left');
const r4u = await ev(() => { const CR = VR.Crafter, h = CR.house, cnt = () => { let n = 0; for (let i = 0; i < h.blocks.length; i++) if (h.blocks[i] !== h.base[i]) n++; return n; }; const steps = CR.undo.length; CR.undoStep(false); const a = cnt(); CR.undoStep(true); return { steps, a, b: cnt() }; });
check(r4u.steps >= 1 && r4u.a === 0 && r4u.b === e2.n, 'Strg+Z goes on where it stopped (' + r4u.steps + ' step back, and forth again)');
await shot('pj_2_resumed');

console.log('4 · Strg+O from anywhere');
await page.mouse.move(700, 500);
await page.keyboard.press('Control+o'); await wait(500);
const k1 = await ev(() => ({ on: !!document.querySelector('#hub.on'), hero: (document.querySelector('#hub .pj.hero') || {}).dataset }));
await page.keyboard.press('Escape'); await wait(300);
const k2 = await ev(() => ({ on: !!document.querySelector('#hub.on'), tool: VR.Crafter.tool }));
check(k1.on && !k2.on && k2.tool === 'paint', 'Strg+O opens it over the Crafter, Esc closes it (and only it)');

console.log('5 · "Ins Spiel"');
const r5 = await ev(async () => { VR.Crafter.update.house(); await new Promise(r => setTimeout(r, 400)); return { draft: VR.Projects.hasData('h:2'), game: !!((JSON.parse(localStorage.getItem('r9si.studio') || '{}').houses || {})[2]), dirty: VR.Crafter.house.dirty }; });
const r5b = await ev(async () => { VR.Projects.show(true); await new Promise(r => setTimeout(r, 400)); const c = document.querySelector('#hub .pj[data-id="h:2"] .st'); const t = c ? c.textContent : ''; const b = document.querySelector('nav.modes [data-hub] .hubN').textContent; VR.Projects.show(false); return { t, b }; });
check(!r5.draft && r5.game && !r5.dirty, '"Ins Spiel" puts it into the game; the draft has done its job');
check(/im Spiel/.test(r5b.t) && r5b.b === '', '🕘 shows it "✓ im Spiel", nothing unfinished');

console.log('6 · the page goes away right after a change');
const n6 = await ev(() => { const CR = VR.Crafter, h = CR.house, s = VR.R.byName.vollton_anthracite.defaultState, list = [], y = h.F + 3, [hx, hz, hw, hd] = h.rect; for (let z = h.pad; z < h.pad + h.lot[1] && list.length < 4; z++) for (let x = h.pad; x < h.pad + h.lot[0] && list.length < 4; x++) { if (x >= hx - 1 && x <= hx + hw && z >= hz - 1 && z <= hz + hd) continue; if (!CR.gGet(x, y, z)) list.push([x, y, z, s]); } CR.applyChanges(list); return { pending: VR.Crafter.draftPending(), n: list.length, hash: location.hash }; });
await page.reload();
const r6 = await ev(() => { const d = VR.Projects.data('h:2'); return d ? d.n : -1; });
check(n6.pending && r6 === e2.n + n6.n, 'reloaded within two seconds: the last change was kept anyway (' + r6 + ')');
await booted(1);
check(await craftOpen(2), 'a link into the Crafter (' + n6.hash + ') goes straight back to the house');
const r6b = await ev(() => { const h = VR.Crafter.house; let n = 0; for (let i = 0; i < h.blocks.length; i++) if (h.blocks[i] !== h.base[i]) n++; return { n, dirty: h.dirty, hub: !!document.querySelector('#hub.on') }; });
check(r6b.n === e2.n + n6.n && r6b.dirty && !r6b.hub, 'with the draft, no list in the way');

console.log('7 · furniture');
const it = await ev(async () => {
  const name = Object.keys(VR.VM.MODELS).find(n => /sofa/.test(n) && !VR.Projects.get('m:' + n));
  VR.Crafter.resume({ kind: 'item', name });
  for (let i = 0; i < 40 && !(VR.Crafter.item && VR.Crafter.item.name === name); i++) await new Promise(r => setTimeout(r, 100));
  const I = VR.Crafter.item; let i0 = -1; for (let i = 0; i < I.V.length; i++) if (I.V[i]) { i0 = i; break; }
  const v = (VR.VM.M.matte(0xff00ff) >>> 0), x = i0 % I.VW, z = Math.floor(i0 / I.VW) % I.VD, y = Math.floor(i0 / (I.VW * I.VD));
  VR.Crafter.vApply([[x, y, z, v]]);
  I.tool = 'erase'; I.brush = 3;
  return { name, i0, v, house: !!VR.Crafter.house, gpu: !!VR.Crafter.gpu, changed: I.changed };
});
await wait(2600);
const r7 = await ev((it) => { const d = VR.Projects.data('m:' + it.name); window.__studioCore.setMode('furn'); return { d: d ? { n: d.n, rle: !!d.rle } : null, house: !!VR.Crafter.house, gpu: !!VR.Crafter.gpu }; }, it);
check(it.changed === 1 && r7.d && r7.d.rle && r7.d.n === 1 && !it.house && !it.gpu, 'a repainted sofa is a draft too (and the house before it was put away cleanly)');
await ev((n) => VR.Projects.open('m:' + n), it.name);
for (let i = 0; i < 40; i++) { await wait(250); if (await ev((n) => !!(VR.Crafter.item && VR.Crafter.item.name === n), it.name)) break; }
const r7b = await ev((it) => { const I = VR.Crafter.item; return { v: I && I.V[it.i0], dirty: I && I.dirty, tool: I && I.tool, brush: I && I.brush }; }, it);
check(r7b.v === it.v && r7b.dirty && r7b.tool === 'erase' && r7b.brush === 3, 'opened from 🕘: the voxel, the tool and the brush are back');

console.log('8 · 📌 ✓ ✎ 🗑');
await ev(() => VR.Projects.show(true)); await wait(500);
const sel = `#hub .pj[data-id="m:${it.name}"]`;
await page.hover(sel); await page.click(sel + ' [data-a="pin"]'); await wait(400);
const p1 = await ev((n) => ({ pin: VR.Projects.get('m:' + n).pin, under: [...document.querySelectorAll('#hub h4')].map(h => h.textContent.trim()), inGrid: !!document.querySelector(`#hub .grid .pj[data-id="m:${n}"]`) || !!document.querySelector(`#hub .pj.hero[data-id="m:${n}"]`) }), it.name);
check(p1.pin && p1.inGrid, '📌 pins it (' + p1.under.join(' / ') + ')');
await page.hover(sel); await page.click(sel + ' [data-a="ren"]'); await wait(200);
await page.keyboard.type('Mein Sofa'); await page.keyboard.press('Enter'); await wait(400);
const p2 = await ev((n) => ({ label: VR.Projects.get('m:' + n).label, shown: (document.querySelector(`#hub .pj[data-id="m:${n}"] .nm`) || {}).textContent, hub: !!document.querySelector('#hub.on') }), it.name);
check(p2.label === 'Mein Sofa' && p2.shown === 'Mein Sofa' && p2.hub, '✎ renames it, the page stays open');
await page.hover(sel); await page.click(sel + ' [data-a="done"]'); await wait(400);
const p3 = await ev((n) => ({ done: VR.Projects.get('m:' + n).done, visible: !!document.querySelector(`#hub .pj[data-id="m:${n}"]`), tog: !!document.querySelector('#hub h4.tog') }), it.name);
check(p3.done && !p3.visible && p3.tog, '✓ moves it to "Fertig" (folded away)');
await page.click('#hub h4.tog'); await wait(300);
await page.hover(sel); await page.click(sel + ' [data-a="del"]'); await wait(150); await page.click(sel + ' [data-a="del"]'); await wait(500);
const p4 = await ev((n) => ({ hide: VR.Projects.get('m:' + n) && VR.Projects.get('m:' + n).hide, draft: VR.Projects.hasData('m:' + n), visible: !!document.querySelector(`#hub .pj[data-id="m:${n}"]`), item: VR.Crafter.item && VR.Crafter.item.name === n, dirty: VR.Crafter.item && VR.Crafter.item.dirty }), it.name);
check(p4.hide && !p4.draft && !p4.visible && p4.item && !p4.dirty, '🗑 (twice) drops the draft and the card; the open sofa is back as the game has it');
await ev(() => VR.Projects.show(false));

console.log('9 · Baukasten houses');
await ev(() => VR.StudioWorld.imagine.open(null, 'house')); await wait(900);
await page.click('#imagine [data-hs="style"][data-v="modern"]'); await wait(2500);
const kits = () => ev(() => Object.values(JSON.parse(localStorage.getItem('r9si.projects')).items).filter(p => p.kind === 'kit').map(p => ({ id: p.id, name: p.name, manual: p.manual, style: (VR.Projects.data(p.id) || { spec: {} }).spec.style, thumb: !!localStorage.getItem('r9si.thumb.' + p.id) })));
const k9a = await kits();
console.log('   kits', JSON.stringify(k9a));
check(k9a.length === 1 && k9a[0].style === 'modern' && k9a[0].manual && k9a[0].thumb, 'a change in the Baukasten makes it a project, with a picture');
await page.click('#imagine [data-hk="random"]'); await wait(1500);
const k9b = await kits();
await page.click('#imagine [data-hk="random"]'); await wait(1500);
const k9c = await kits();
check(k9b.length === 2 && k9c.length === 2 && k9c.some(k => k.style === 'modern' && k.manual), '🎲 on the shaped house starts a new one (yours stays), 🎲 again only rolls that one');
await ev((id) => { VR.StudioWorld.imagine.close(); VR.Projects.open(id); }, k9a[0].id); await wait(1200);
const r9 = await ev(() => { const IM = VR.StudioWorld.imagine; return { on: document.getElementById('imagine').classList.contains('on'), mode: IM.mode, style: IM.house && IM.house.style, pj: IM.pj.kit }; });
check(r9.on && r9.mode === 'house' && r9.style === 'modern' && r9.pj === k9a[0].id, 'opened from 🕘: the Baukasten has that house again');

console.log('10 · Genie designs');
const CAR = { kind: 'model', name: 'Feuerwehrauto', notes: 'Rot.', size: [7, 7, 16], parts: [{ box: [0, 1, 0, 6, 3, 15], color: '#c0392b' }, { cyl: [0, 1, 3, 1.2, 7], axis: 'x', color: '#202020' }] };
const g1 = await ev(async (car) => {
  const IM = VR.StudioWorld.imagine;
  for (let i = 0; i < 40 && !IM.aiOK; i++) await new Promise(r => setTimeout(r, 200));
  window.__genie.answer = car; IM.open(null, 'genie'); IM.genie.text = 'Feuerwehrauto'; document.getElementById('gnText').value = 'Feuerwehrauto'; await IM.wish('new');
  await new Promise(r => setTimeout(r, 2600));
  const g = Object.values(JSON.parse(localStorage.getItem('r9si.projects')).items).filter(p => p.kind === 'genie');
  return { ai: !!IM.aiOK, g: g.map(p => ({ id: p.id, name: p.name, thumb: !!localStorage.getItem('r9si.thumb.' + p.id) })) };
}, CAR);
console.log('   genie', JSON.stringify(g1));
check(g1.ai && g1.g.length === 1 && g1.g[0].name === 'Feuerwehrauto' && g1.g[0].thumb, 'a Genie design is a project with its picture');
// (a Crafter link would reopen the sofa directly: start like the game's title menu does, without one)
await ev(() => history.replaceState(null, '', location.pathname));
await page.reload();
for (let i = 0; i < 40; i++) { await wait(250); if (await ev(() => !!document.querySelector('#hub.on .pj'))) break; }
const r10 = await ev(() => ({ cards: [...document.querySelectorAll('#hub .pj')].map(c => c.dataset.id), hero: (document.querySelector('#hub .pj.hero') || { dataset: {} }).dataset.id }));
check(r10.hero === g1.g[0].id && r10.cards.includes('h:2') && r10.cards.length >= 4, 'after a reload: the Genie design first, the house, the Baukasten houses (' + r10.cards.length + ' cards)');
await booted(1);
await shot('pj_3_hub_all');
await page.click('#hub .pj.hero');
for (let i = 0; i < 30; i++) { await wait(300); if (await ev(() => !!(VR.StudioWorld.imagine.result && VR.StudioWorld.imagine.result.n))) break; }
const r10b = await ev(() => { const IM = VR.StudioWorld.imagine; return { on: document.getElementById('imagine').classList.contains('on'), mode: IM.mode, name: IM.genie.last && IM.genie.last.name, text: IM.genie.text, n: IM.result && IM.result.n }; });
check(r10b.on && r10b.mode === 'genie' && r10b.name === 'Feuerwehrauto' && r10b.text === 'Feuerwehrauto' && r10b.n > 50, 'one click: the Genie shows the fire engine again, with the words you used');
await shot('pj_4_genie_back');
// the Baukasten on its own after a reload: the house you worked on last
const r10c = await ev(async () => { const IM = VR.StudioWorld.imagine; document.querySelector('#imagine .imModes [data-mode="house"]').click(); await new Promise(r => setTimeout(r, 400)); return { style: IM.house && IM.house.style, pj: IM.pj.kit }; });
check(!!r10c.pj, 'the Baukasten tab has your last house again (' + r10c.style + ')');
await ev(() => VR.StudioWorld.imagine.close());

console.log('11 · Strg+S');
await page.keyboard.press('Control+s'); await wait(300);
const r11 = await ev(() => { const t = document.getElementById('pjToast'); return t && t.classList.contains('on') ? t.textContent : ''; });
check(/Gespeichert/.test(r11), 'Strg+S says everything is saved (no browser "save page")');

console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
check(!logs.length, 'no page errors');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);
