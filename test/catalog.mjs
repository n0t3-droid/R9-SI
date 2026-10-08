// v0.37 🧱 Teile · 🎯 Finden · ★ Favoriten: every block of the game in one catalogue by what it is for (roofs, lights,
// windows, doors …) with search; a tap on a house lights up everything of that kind and shows it on the right with
// "🔍 Im Katalog" (the catalogue opens right there, "← zurück" returns to the house, the glow stays) and "✋ Benutzen"
// (into the Crafter's hand); ★ favourites are the same everywhere (Teile, Möbel, Crafter palette, Werkbank, World,
// the game's creative inventory ★ tab).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--allow-file-access-from-files'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 880 }, locale: 'de-DE' });   // (the Studio follows the browser's language since i18n2: the checks read German)
const page = await ctx.newPage();
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) logs.push('[console] ' + m.text().slice(0, 300)); });
await page.goto('file:///home/claude/vr/dist/studio.html');
const ev = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => page.waitForTimeout(ms);
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const shot = (n) => page.screenshot({ path: `/home/claude/vr/test/shots/${n}.png`, timeout: 180000, animations: 'disabled' });
async function booted() { for (let i = 0; i < 600; i++) { await wait(500); const s = await ev(() => ({ boot: document.getElementById('studio').classList.contains('boot'), houses: window.__studio ? window.__studio.HOUSE.size : -1, all: window.__studioCore ? window.__studioCore.HOUSES.length : 99, tex: !!(window.__studioCore && window.__studioCore.texInfo()) })); if (!s.boot && s.tex && s.houses >= s.all) return true; } return false; }

console.log('1 · the 🧱 Teile catalogue');
check(await booted(), 'the Studio is up with every catalogue house built');
const c1 = await ev(async () => {
  document.querySelector('nav.modes [data-mode="parts"]').click();
  for (let i = 0; i < 60 && !(window.__st.scene && window.__st.scene.type === 'block'); i++) await new Promise(r => setTimeout(r, 200));
  const chips = [...document.querySelectorAll('#chips button')].map(b => [b.dataset.pcat, +(b.querySelector('b') || {}).textContent || 0]);
  const CAT = VR.StudioCatalog, E = CAT.entries();
  const roofs = E.filter(e => e.kinds.includes('roof')).map(e => e.id);
  return { mode: window.__st.mode, chips, n: E.length, cards: document.querySelectorAll('#list .card[data-bid]').length, scene: window.__st.scene && window.__st.scene.type,
    roofs: roofs.length, roofHas: ['vx_roof_red', 'vx_ridge_slate', 'slate_roof_stairs', 'vx_hip_shingle'].filter(x => roofs.includes(x)),
    led: CAT.kindsOf('vx_led_cove'), trim: CAT.kindsOf('white_trim'), furn: E.some(e => e.id.startsWith('vm_') && !VR.R.byName[e.id].o.modern) };   // (the ✨ Modern pack is meant to be here)
});
console.log('  parts', JSON.stringify(c1).slice(0, 700));
const chip = (k) => (c1.chips.find(c => c[0] === k) || [0, 0])[1];
check(c1.mode === 'parts' && c1.n > 900 && c1.cards > 300 && c1.scene === 'block', '🧱 Teile: ' + c1.n + ' blocks of the game in one catalogue, the first one shown');
check(chip('roof') >= 30 && chip('light') >= 40 && chip('glass') >= 20 && chip('door') >= 10 && chip('wall') >= 50 && chip('floor') >= 20 && chip('garden') >= 30, 'by what it is for: Dach ' + chip('roof') + ', Licht ' + chip('light') + ', Fenster ' + chip('glass') + ', Türen ' + chip('door') + ', Wände ' + chip('wall') + ', Böden ' + chip('floor') + ', Garten ' + chip('garden'));
check(c1.roofHas.length === 4 && c1.led.includes('light') && c1.trim.includes('wall') && !c1.furn, 'roofs are there (' + c1.roofHas.join(', ') + '), the LED strip is a light, the cornice trim a wall piece; furniture stays in Möbel');
// the roof chip and a search
const c2 = await ev(async () => {
  document.querySelector('#chips button[data-pcat="roof"]').click();
  const roofCards = [...document.querySelectorAll('#list .card[data-bid]')].map(c => c.dataset.bid);
  const s = document.getElementById('search');
  const find = (q) => { s.value = q; s.dispatchEvent(new Event('input')); return [...document.querySelectorAll('#list .card[data-bid]')].map(c => c.dataset.bid); };
  const led = find('led'), lampe = find('lampe'), dach = find('dach'), fenster = find('fenster'), weiss = find('weiße leiste');
  find('');
  let drawn = 0;
  for (let t = 0; t < 80 && drawn < 10; t++) {
    await new Promise(r => setTimeout(r, 250));
    drawn = [...document.querySelectorAll('#list .card[data-bid] canvas.th')].slice(0, 12).filter(cv => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n > 200; }).length;
  }
  const K = (id) => VR.StudioCatalog.kindsOf(id);
  return { roofCards: roofCards.length, allRoof: roofCards.every(id => K(id).includes('roof')), led: led.slice(0, 8), ledN: led.length, chiseled: led.filter(x => /chiseled/.test(x)).length,
    lampe: lampe.slice(0, 5), lampeN: lampe.length, lampeOk: lampe.slice(0, 5).filter(id => /lamp|lantern|light/i.test(id + ' ' + ((VR.R.byName[id] || {}).display || ''))).length, dach: dach.slice(0, 5), dachRoof: dach.slice(0, 20).filter(id => K(id).includes('roof')).length, fenster: fenster.slice(0, 5), fensterGlass: fenster.slice(0, 20).filter(id => K(id).includes('glass')).length, weiss: weiss.slice(0, 5), drawn };
});
console.log('  roof/search', JSON.stringify(c2).slice(0, 900));
check(c2.roofCards >= 30 && c2.allRoof, '🏠 Dach shows the ' + c2.roofCards + ' roof pieces');
check(c2.led.includes('vx_led_cove') && c2.chiseled === 0, 'the search "led" finds the LED strips and lights (' + c2.ledN + ' hits, none of them "chiseled")');
check(c2.lampeN >= 5 && c2.lampeOk >= 4 && c2.dachRoof >= 15 && c2.fensterGlass >= 15 && c2.weiss.includes('white_trim'), 'German words work: "lampe" ' + c2.lampeN + ', "dach" → roofs, "fenster" → windows, "weiße leiste" → ' + c2.weiss[0]);
check(c2.drawn >= 10, 'every card shows the block\'s picture (' + c2.drawn + ' of 12 drawn)');
await shot('cat_1_roofs');

console.log('2 · ★ Favoriten');
const f1 = await ev(() => {
  localStorage.removeItem('r9si.favs');
  const card = (id) => document.querySelector(`#list .card[data-bid="${id}"]`);
  const s = document.getElementById('search'); s.value = 'led cove'; s.dispatchEvent(new Event('input'));
  const c = card('vx_led_cove'); c.querySelector('.favb').click();
  s.value = 'white cornice'; s.dispatchEvent(new Event('input'));
  card('white_trim').querySelector('.favb').click();
  s.value = ''; s.dispatchEvent(new Event('input'));
  document.querySelector('#chips button[data-pcat="fav"]').click();
  const favCards = [...document.querySelectorAll('#list .card[data-bid]')].map(c => c.dataset.bid);
  const n = +(document.querySelector('#chips button[data-pcat="fav"] b') || {}).textContent;
  return { favs: VR.Favs.list(), favCards, n, stored: JSON.parse(localStorage.getItem('r9si.favs') || '{}').items };
});
console.log('  favs', JSON.stringify(f1));
check(f1.favs.join() === 'white_trim,vx_led_cove' && f1.favCards.join() === 'white_trim,vx_led_cove' && f1.n === 2 && f1.stored.length === 2, '☆ on a card makes it a favourite: ★ Favoriten shows both, newest first, kept in this browser');

console.log('3 · 🎯 a tap on the house finds what is there');
// an LED strip that is the first thing a ray meets from some view (house skins are chosen at random, so look around)
const tap = await ev(async () => {
  const C = window.__studioCore, S = window.__st, IDS = ['vx_led_cove', 'vx_led_strip_warm', 'vx_led_strip'];
  document.querySelector('nav.modes [data-mode="arch"]').click();
  const cv = C.view(), r = cv.getBoundingClientRect();
  const VIEWS = [[0.72, 0.06], [2.3, 0.06], [-0.9, 0.06], [3.9, 0.06], [0.72, -0.08], [2.3, -0.08], [-0.9, -0.08], [3.9, -0.08], [1.5, -0.15], [5.0, -0.15], [0.72, 0.14], [2.3, 0.14]];
  for (const rec of [...window.__studio.HOUSE.values()]) {
    const counts = IDS.map(id => (rec.data.blocks.find(([n]) => n === id) || [0, 0])[1]);
    if (!counts.some(Boolean)) continue;
    window.__studio.selectHouse(rec.index); await new Promise(r2 => setTimeout(r2, 150));
    const sc = S.scene, d = sc.data, [sx, sy, sz] = d.dims, types = IDS.map(id => VR.R.T.type[VR.R.byName[id].defaultState]);
    for (const [yaw, pitch] of VIEWS) {
      S.cam.yaw = yaw; S.cam.pitch = pitch; S.cam.dist = 0;
      const vp = C.camFor(sc, S.cam, r.width, r.height).vp;
      for (let i = 0; i < d.grid.length; i++) {
        const s = d.grid[i]; if (!s || !types.includes(VR.R.T.type[s])) continue;
        const x = i % sx, z = Math.floor(i / sx) % sz, y = Math.floor(i / (sx * sz));
        const b = VR.PHYS.selection(s)[0] || [0, 0, 0, 1, 1, 1];
        const p = [x + (b[0] + b[3]) / 2, y + (b[1] + b[4]) / 2, z + (b[2] + b[5]) / 2, 1], q = [0, 0, 0, 0];
        for (let k = 0; k < 4; k++) q[k] = vp[k] * p[0] + vp[4 + k] * p[1] + vp[8 + k] * p[2] + vp[12 + k] * p[3];
        if (q[3] <= 0) continue;
        const cx = r.left + (q[0] / q[3] * 0.5 + 0.5) * r.width, cy = r.top + (1 - (q[1] / q[3] * 0.5 + 0.5)) * r.height;
        if (cx < r.left + 20 || cy < r.top + 20 || cx > r.right - 20 || cy > r.bottom - 20) continue;
        const id = VR.StudioCatalog.probe({ clientX: cx, clientY: cy });
        if (IDS.includes(id)) return { house: rec.index, name: rec.name, id, count: counts[IDS.indexOf(id)], display: VR.R.byName[id].display, yaw, pitch, x: cx, y: cy };
      }
    }
  }
  return null;
});
console.log('  tap', JSON.stringify(tap));
check(!!tap, 'the pointer over an LED strip on a house finds it: ' + (tap ? tap.display + ' in ' + tap.name : '—'));
if (!tap) { console.log('FAILED ' + fails); await browser.close(); process.exit(1); }
// now through real mouse events: the name floats at the pointer, a short click picks it
await ev((t) => { window.__studio.selectHouse(t.house); window.__st.cam.yaw = t.yaw; window.__st.cam.pitch = t.pitch; window.__st.cam.dist = 0; }, tap);
await wait(200);
await page.mouse.move(tap.x - 30, tap.y - 30); await wait(120); await page.mouse.move(tap.x, tap.y); await wait(250);
const tip = await ev(() => { const t = document.getElementById('pickTip'); return t && t.classList.contains('on') ? t.textContent : null; });
check(tip && tip.includes(tap.display), 'with the mouse over it, its name floats next to the pointer: ' + tip);
await page.mouse.down(); await page.mouse.up();
await wait(300);
const p2 = await ev(() => {
  const P = VR.StudioCatalog.pick, card = document.querySelector('#partsBody .pickCard');
  return { id: P && P.id, count: P && P.count, cells: P && P.cells, quads: P && P.mesh ? P.mesh.n : 0, card: card ? card.innerText.replace(/\s+/g, ' ') : null,
    btns: [...document.querySelectorAll('#partsBody .catAct button')].map(b => b.textContent.trim()) };
});
console.log('  pick', JSON.stringify(p2));
check(p2.id === tap.id && p2.count === tap.count && p2.quads > 0, 'a click: all ' + p2.count + ' of them in the house light up (' + p2.quads + ' glow quads)');
const isFav = tap.id === 'vx_led_cove';
check(p2.card && p2.card.includes(tap.display) && /in diesem Haus/.test(p2.card) && p2.btns.some(b => /Im Katalog/.test(b)) && p2.btns.some(b => /Benutzen/.test(b)) && p2.btns.some(b => (isFav ? /★ Favorit/ : /☆ Favorit/).test(b)), 'the right side shows it: picture, name, how many, 🔍 Im Katalog, ✋ Benutzen, ' + (isFav ? '★ (already a favourite)' : '☆ Favorit'));
await shot('cat_2_pick');
// 🔍 Im Katalog → the catalogue on it, ← zurück → the house, still glowing
const p3 = await ev(async () => {
  [...document.querySelectorAll('#partsBody .catAct button')].find(b => /Im Katalog/.test(b.textContent)).click();
  await new Promise(r => setTimeout(r, 500));
  const S = window.__st, on = document.querySelector('#list .card.on');
  const r = { mode: S.mode, scene: S.scene && S.scene.type, name: S.scene && S.scene.name, on: on && on.dataset.bid, chip: ((document.querySelector('#chips button.on') || {}).dataset || {}).pcat, crumb: (document.querySelector('#crumb button') || {}).textContent };
  document.querySelector('#crumb button').click();
  await new Promise(r2 => setTimeout(r2, 300));
  r.back = { mode: S.mode, scene: S.scene && S.scene.type, pick: VR.StudioCatalog.pick && VR.StudioCatalog.pick.id, card: !!document.querySelector('#partsBody .pickCard') };
  return r;
});
console.log('  find', JSON.stringify(p3));
check(p3.mode === 'parts' && p3.scene === 'block' && p3.name === tap.id && p3.on === tap.id && p3.chip === 'light' && /zurück/.test(p3.crumb || ''), '🔍 Im Katalog: 🧱 Teile opens on it (💡 Licht), with "' + p3.crumb + '"');
check(p3.back.mode === 'arch' && p3.back.scene === 'house' && p3.back.pick === tap.id && p3.back.card, '← zurück: the house again, still glowing');
// a furniture piece: the whole piece lights up, 🔍 opens it in Möbel
const p4 = await ev(async () => {
  const S = window.__st, C = window.__studioCore, d = S.scene.data;
  const name = (d.models.find(([n]) => !C.isFacade(n)) || [])[0];
  VR.StudioCatalog.pickId(name);
  const P = VR.StudioCatalog.pick;
  const r = { name, isModel: P.isModel, count: P.count, quads: P.mesh ? P.mesh.n : 0 };
  [...document.querySelectorAll('#partsBody .catAct button')].find(b => /Im Katalog/.test(b.textContent)).click();
  await new Promise(r2 => setTimeout(r2, 400));
  r.mode = S.mode; r.scene = S.scene && S.scene.type; r.sel = S.scene && S.scene.name; r.crumb = !!document.querySelector('#crumb button');
  r.acts = [...document.querySelectorAll('#partsBody .catAct button')].map(b => b.textContent.trim());
  document.querySelector('#crumb button').click();
  return r;
});
console.log('  model', JSON.stringify(p4));
check(p4.isModel && p4.count >= 1 && p4.quads > 0 && p4.mode === 'furn' && p4.sel === p4.name && p4.crumb && p4.acts.some(b => /Favorit/.test(b)), 'furniture: the whole piece lights up, 🔍 opens it in Möbel with ← zurück and ☆ Favorit');
// a hover over a row of the house's list lights that part up; a click on a block row opens 🧱 Teile on it
const p5 = await ev(async () => {
  const S = window.__st; await new Promise(r => setTimeout(r, 200));
  const row = document.querySelector('#partsBody .part[data-bid]'); const id = row.dataset.bid;
  row.dispatchEvent(new MouseEvent('mouseenter')); await new Promise(r => setTimeout(r, 200));
  const pre = VR.StudioCatalog.pick;
  row.dispatchEvent(new MouseEvent('mouseleave')); await new Promise(r => setTimeout(r, 200));
  row.click(); await new Promise(r => setTimeout(r, 500));
  const res = { id, mode: S.mode, scene: S.scene && S.scene.name, crumb: !!document.querySelector('#crumb button') };
  document.querySelector('#crumb button').click(); await new Promise(r => setTimeout(r, 200));
  res.back = S.mode;
  return res;
});
console.log('  rows', JSON.stringify(p5));
check(p5.mode === 'parts' && p5.scene === p5.id && p5.crumb && p5.back === 'arch', 'a block row of the house opens 🧱 Teile on it (and ← zurück)');

console.log('4 · ✋ Benutzen');
const u1 = await ev(async (ix) => {
  const S = window.__st; window.__studio.selectHouse(ix); await new Promise(r => setTimeout(r, 200));
  const id = S.scene.data.blocks.find(([n]) => n === 'white_trim') ? 'white_trim' : S.scene.data.blocks[1][0];
  VR.StudioCatalog.pickId(id);
  [...document.querySelectorAll('#partsBody .catAct button')].find(b => /Benutzen/.test(b.textContent)).click();
  for (let i = 0; i < 160; i++) { await new Promise(r => setTimeout(r, 250)); if (VR.Crafter.house && VR.Crafter.gpu && S.mode === 'craft') break; }
  const CR = VR.Crafter;
  return { id, mode: S.mode, house: CR.house && CR.house.index, hand: CR.hot[CR.slot] };
}, tap.house);
console.log('  use', JSON.stringify(u1));
check(u1.mode === 'craft' && u1.house === tap.house && u1.hand === u1.id, '✋ Benutzen: the Crafter opens this house with ' + u1.id + ' in the hand');
// the LED strip has a box to point at in the Crafter too (it had none before v0.37: it could not be broken there)
const u2 = await ev(() => { const b = VR.PHYS.selection(VR.R.byName.vx_led_cove.defaultState); return b.length; });
check(u2 >= 1, 'LED strips, pictures, pendant lamps … can be pointed at (a selection box from their voxels)');

console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
check(!logs.some(l => /pageerror/.test(l)), 'no page errors');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);
