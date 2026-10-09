// ✦ Formen and ✦ Glatt in the R9 Studio (t-form), German: the shape tools in the Crafter and the smooth look.
//   1. Möbel: every model card has its ✦; on the sofa card it turns the picture smooth (the surface-nets mesh from the
//      Studio's worker), the 3-D view follows, ✦ in the view's bar turns it back
//   2. the Crafter on a small model: emptied, a vase from the Drehkörper (a point dragged in the profile panel, then
//      ✦ Anwenden): rotationally symmetric; Strg+Z takes it back, Strg+Y brings it again; ✦ Glatt shows it smooth
//   3. a box, then Abrunden with radius 4 (the panel's buttons): exactly the voxels the bevel function names go
//   4. an Extrusion along a path and Kugel · Zylinder · Kegel placed by a click on the model
//   5. the design stays voxel: ✦ Glatt changes no voxel; the German words of the tools are on the page
// Writes test/shots/formtools_{card_voxel,card_glatt,view_glatt,view_voxel,lathe,lathe_glatt,bevel,bevel_glatt,shapes,shapes_glatt}.png
//   nohup bash test/wt_run.sh formtools.mjs 1500 > .tmp_tests/formtools.log 2>&1 &
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { mkdirSync } from 'fs';
const OUT = '/home/claude/vr/test/shots';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--allow-file-access-from-files'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { if (m.type() === 'error' || /error|fail/i.test(m.text())) logs.push(m.text().slice(0, 400)); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const shot = (n, el) => (el ? el.screenshot({ path: `${OUT}/${n}.png`, timeout: 180000 }) : page.screenshot({ path: `${OUT}/${n}.png`, timeout: 180000 })).then(() => console.log('   shot ' + n));
const until = async (fn, arg, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(fn, arg)) return true; await wait(250); } return false; };
const SOFA = 'vm_sofa_cream', ITEM = 'vm_deco_vases_trio';
try {
  await page.goto('file:///home/claude/vr/dist/studio.html');
  await ev(() => { try { localStorage.removeItem('r9si.studio'); localStorage.removeItem('r9si.studio.glatt'); } catch (e) { /* */ } });
  for (let i = 0; i < 240; i++) { await wait(500); const s = await ev(() => ({ boot: document.getElementById('studio').classList.contains('boot'), houses: window.__studio ? window.__studio.HOUSE.size : -1 })); if (!s.boot && s.houses >= 1) break; }
  check(await ev(() => !!(VR.FormTools && VR.FormTools.ops && VR.SmoothVox)), 'the Studio has ✦ Formen and the mesher');
  check(await ev(() => VR.I18N.lang === 'de'), 'the Studio speaks German');

  // ---------------------------------------------------------------- 1. ✦ on the cards, the view
  console.log('1 · ✦ Glatt on the sofa card and in the view');
  await ev(() => window.__studioCore.setMode('furn')); await wait(800);
  const cards = await ev(() => ({ cards: document.querySelectorAll('#list .card[data-name]').length, glatt: document.querySelectorAll('#list .card[data-name] .glattb').length }));
  check(cards.cards > 50 && cards.glatt === cards.cards, `every model card has its ✦ (${cards.glatt} of ${cards.cards})`);
  await ev((n) => { const c = document.querySelector(`#list .card[data-name="${n}"]`); c.scrollIntoView({ block: 'center' }); }, SOFA);
  check(await until((n) => { const c = document.querySelector(`#list .card[data-name="${n}"] canvas.th`); return !!c; }, SOFA, 60000), 'the sofa card has its picture');
  const card = await page.$(`#list .card[data-name="${SOFA}"]`);
  const pic0 = await ev((n) => document.querySelector(`#list .card[data-name="${n}"] canvas.th`).toDataURL(), SOFA);
  await shot('formtools_card_voxel', card);
  await page.click(`#list .card[data-name="${SOFA}"] .glattb`);
  const changed = await until(([n, p]) => { const c = document.querySelector(`#list .card[data-name="${n}"]`); const cv = c && c.querySelector('canvas.th'); return c.classList.contains('glatt') && cv && cv.toDataURL() !== p; }, [SOFA, pic0], 60000);
  check(changed, 'a click on ✦: the card shows the smooth sofa');
  check(await ev((n) => VR.FormTools.isGlatt(n) && JSON.parse(localStorage.getItem('r9si.studio.glatt') || '[]').includes(n), SOFA), 'the look is remembered in this browser');
  await shot('formtools_card_glatt', await page.$(`#list .card[data-name="${SOFA}"]`));
  await page.click(`#list .card[data-name="${SOFA}"] .cap`); await wait(500);
  check(await until((n) => { const S = window.__st; return S.scene && S.scene.name === n && S.scene.mesh && S.scene.mesh.smooth; }, SOFA, 60000), 'the 3-D view shows the sofa smooth');
  const vs = await ev(() => { const S = window.__st, m = S.scene.mesh; return { tri: m.tri, verts: m.verts.length / 15, btn: !!document.querySelector('#glattT.on'), label: document.getElementById('glattT').textContent }; });
  check(vs.btn && /Glatt/.test(vs.label), `✦ Glatt is on in the view's bar ("${vs.label}"), ${vs.tri} triangles`);
  await wait(400); await shot('formtools_view_glatt');
  await page.click('#glattT'); await wait(300);
  check(await until(() => { const S = window.__st; return S.scene && S.scene.mesh && !S.scene.mesh.smooth; }), '✦ in the view turns it back to voxels');
  await shot('formtools_view_voxel');

  // ---------------------------------------------------------------- 2. the Crafter: a vase from the Drehkörper
  console.log('2 · Drehkörper');
  await ev((n) => window.__studioCore.editModel(n), ITEM);
  check(await until((n) => !!(VR.Crafter.item && VR.Crafter.item.name === n), ITEM, 60000), 'the Crafter opens the small model');
  await wait(800);
  const count = () => ev(() => { const V = VR.Crafter.item.V; let n = 0; for (let i = 0; i < V.length; i++) if (V[i]) n++; return n; });
  await ev(() => { const it = VR.Crafter.item, l = []; for (let i = 0; i < it.V.length; i++) if (it.V[i]) { const x = i % it.VW, z = Math.floor(i / it.VW) % it.VD, y = Math.floor(i / (it.VW * it.VD)); l.push([x, y, z, 0]); } VR.Crafter.vApply(l); it.color = '#e8e2d4'; it.mat = 'gloss'; window.__studioCore.list(); });
  check(await count() === 0, 'emptied (one undo step)');
  await page.click('#list button[data-ft="lathe"]'); await wait(300);
  const panel = await ev(() => document.getElementById('list').innerText);
  check(['Formen', 'Drehkörper', 'Extrusion', 'Abrunden', 'Kugel', 'Zylinder', 'Kegel', 'Anwenden'].every(w => panel.includes(w)), 'the panel names the tools in German');
  // drag the belly point out by two voxels in the profile panel
  const cv = await page.$('#list canvas[data-ft="profile"]'); await cv.scrollIntoViewIfNeeded(); await wait(200);
  const bb = await cv.boundingBox();
  const p3 = await ev(() => VR.FormTools.state.profile[3].slice());
  const it0 = await ev(() => ({ VW: VR.Crafter.item.VW, VH: VR.Crafter.item.VH, VD: VR.Crafter.item.VD }));
  const R0 = Math.min(it0.VW, it0.VD) / 2, sx = (220 - 24) / R0, sy = (180 - 24) / it0.VH, k = bb.width / 220;
  const px = bb.x + (12 + p3[0] * sx) * k, py = bb.y + (180 - 12 - p3[1] * sy) * k;
  await page.mouse.move(px, py); await page.mouse.down(); await page.mouse.move(px + 2 * sx * k, py, { steps: 4 }); await page.mouse.up();
  const p3b = await ev(() => VR.FormTools.state.profile[3].slice());
  check(p3b[0] > p3[0] + 1.5, `the dragged point moved out (${p3[0]} → ${p3b[0]})`);
  await page.click('#list button[data-act="ft-apply"]'); await wait(500);
  const nVase = await count();
  const sym = await ev(() => { const it = VR.Crafter.item, N = it.VW; let bad = 0; for (let y = 0; y < it.VH; y++) for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) { const a = !!it.V[(y * it.VD + z) * N + x], b = !!it.V[(y * it.VD + x) * N + (N - 1 - z)]; if (a !== b) bad++; } return bad; });
  check(nVase > 1500 && sym === 0, `a vase of ${nVase} voxels, rotationally symmetric (${sym} differ under a quarter turn)`);
  await shot('formtools_lathe');
  await page.keyboard.press('Control+z'); await wait(400);
  check(await count() === 0, 'Strg+Z takes the vase back');
  await page.keyboard.press('Control+y'); await wait(400);
  check(await count() === nVase, 'Strg+Y brings it again');
  await page.click('#glattT');
  check(await until(() => { const S = window.__st; return S.scene && S.scene.type === 'vedit' && S.scene.mesh && S.scene.mesh.smooth; }, null, 60000), '✦ Glatt shows the vase smooth in the Crafter');
  check(await count() === nVase, 'the smooth look changes no voxel: the design stays voxel');
  await wait(300); await shot('formtools_lathe_glatt');

  // ---------------------------------------------------------------- 3. a bevelled box
  console.log('3 · Abrunden');
  await page.click('#glattT');   // first the voxels, then ✦ on again
  check(await until(() => { const S = window.__st; return S.scene && S.scene.mesh && !S.scene.mesh.smooth; }), '✦ off: the voxels again');
  await ev(() => { const it = VR.Crafter.item, l = []; for (let i = 0; i < it.V.length; i++) { const x = i % it.VW, z = Math.floor(i / it.VW) % it.VD, y = Math.floor(i / (it.VW * it.VD)); const inBox = x >= 6 && x <= 25 && y <= 13 && z >= 8 && z <= 23; const v = inBox ? (VR.VM.M.wood(0xB89262) >>> 0) : 0; if (it.V[i] !== v) l.push([x, y, z, v]); } VR.Crafter.vApply(l); });
  const nBox = await count();
  check(nBox === 20 * 14 * 16, `a box of ${nBox} voxels`);
  await page.click('#list button[data-ft="bevel"]'); await wait(300);
  const expect = await ev(() => { const it = VR.Crafter.item; return VR.FormTools.ops.bevel(it.V, { VW: it.VW, VH: it.VH, VD: it.VD }, [0, 0, 0, it.VW - 1, it.VH - 1, it.VD - 1], 4).length; });
  await ev(() => { const b = [...document.querySelectorAll('#list .ftbox .seg button')].find(x => x.textContent.trim() === '4'); b.click(); });
  check(await ev(() => VR.FormTools.state.r === 4), 'radius 4 chosen in the panel');
  await page.click('#list button[data-act="ft-apply"]'); await wait(500);
  const nBev = await count();
  check(expect > 100 && nBev === nBox - expect, `Abrunden took exactly the convex edges (${nBox - nBev} voxels, the function names ${expect})`);
  await wait(300); await shot('formtools_bevel');
  await page.click('#glattT');
  check(await until(() => { const S = window.__st; return S.scene && S.scene.mesh && S.scene.mesh.smooth; }, null, 60000), 'the bevelled box smooth (✦ on again)');
  await wait(300); await shot('formtools_bevel_glatt');

  // ---------------------------------------------------------------- 4. an extrusion, a sphere, a cylinder, a cone
  console.log('4 · Extrusion · Kugel · Zylinder · Kegel');
  await ev(() => { const it = VR.Crafter.item, l = []; for (let i = 0; i < it.V.length; i++) if (it.V[i]) { const x = i % it.VW, z = Math.floor(i / it.VW) % it.VD, y = Math.floor(i / (it.VW * it.VD)); l.push([x, y, z, 0]); } VR.Crafter.vApply(l); });
  await page.click('#list button[data-ft="extrude"]'); await wait(300);
  // the path: three clicks into the top view
  const pc = await page.$('#list canvas[data-ft="path"]'); await pc.scrollIntoViewIfNeeded(); await wait(200);
  const pb = await pc.boundingBox();
  for (const [fx, fz] of [[0.15, 0.2], [0.5, 0.75], [0.85, 0.3]]) { await page.mouse.click(pb.x + pb.width * fx, pb.y + pb.height * fz); await wait(120); }
  await ev(() => { VR.FormTools.state.level = 2; VR.FormTools.state.w = 3; VR.FormTools.state.shape = 'circle'; VR.Crafter.item.color = '#3af0ff'; VR.Crafter.item.mat = 'light'; });
  const path = await ev(() => VR.FormTools.state.path.length);
  check(path === 3, 'three points clicked into the top view (' + path + ')');
  await page.click('#list button[data-act="ft-apply"]'); await wait(400);
  const nEx = await count();
  check(nEx > 150, `a light line along the path: ${nEx} voxels`);
  await ev(() => { const it = VR.Crafter.item; it.color = '#c9a24a'; it.mat = 'metal'; });
  for (const [tool, at] of [['sphere', [8, 9, 24]], ['cylinder', [24, 3, 24]], ['cone', [16, 3, 8]]]) {
    await page.click(`#list button[data-ft="${tool}"]`); await wait(200);
    const before = await count();
    await ev(([t, a]) => { VR.FormTools.state.pr = t === 'sphere' ? 4.25 : 3.5; VR.FormTools.state.ph = 10; VR.FormTools.click({ x: a[0], y: a[1] - 1, z: a[2], face: 2 }, 0); }, [tool, at]);
    const after = await count();
    check(after > before + 50, `${tool}: ${after - before} voxels where the click was`);
  }
  check(await until(() => { const S = window.__st; return S.scene && S.scene.mesh && S.scene.mesh.smooth; }, null, 60000), 'the shapes smooth (✦ on)');
  await wait(300); await shot('formtools_shapes_glatt');
  await page.click('#glattT');
  check(await until(() => { const S = window.__st; return S.scene && S.scene.mesh && !S.scene.mesh.smooth; }), '✦ off: the shapes as voxels');
  await wait(300); await shot('formtools_shapes');
  // the undo stack holds every tool
  const undos = await ev(() => VR.Crafter.item.vundo.length);
  check(undos >= 8, `every tool is one undo step (${undos} on the stack)`);

  console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
  check(!logs.some(l => /pageerror/.test(l)), 'no page errors');
} catch (e) {
  fails++; console.log('  ✗ exception: ' + String(e && e.stack || e).slice(0, 1500));
  for (const l of logs.slice(0, 12)) console.log(l);
} finally {
  await browser.close();
}
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
