// 📽 Zeitraffer end to end (German UI): a flat creative world; blocks placed and broken by hand, a glass box filled
// and taken back (/undo), a house by the Forge (/bau Haus, built in the game). The history is in its own database
// (r9si-history). 📽 from the pause menu: the replay first shows the place as it was (the house's cells empty), the
// scrubber's middle shows the house half built, the end the finished build; ⏯ plays on; ⏺ gives a video/webm Blob
// > 0 bytes and ⬇ Speichern hands it over as a .webm download (or, where headless Chromium has no MediaRecorder, the
// button is off and says why). Esc: the original columns are back, the world as built, the player and the sky as
// before, the pause menu again. Numbers: the recorder's cost per change and the replay frame's main-thread time.
// Screenshots test/shots/zeitraffer_*.png.
//   nohup bash test/wt_run.sh zeitraffer.mjs 1800 > .tmp_tests/zeitraffer.log 2>&1 &
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import http from 'http';
import fs from 'fs';
import path from 'path';
const DIST = '/home/claude/vr/dist', SHOTS = '/home/claude/vr/test/shots', TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };
const srv = http.createServer((q, a) => { if (q.url === '/favicon.ico') { a.writeHead(204); a.end(); return; } const f = path.join(DIST, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'); if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { a.writeHead(404); a.end(); return; } a.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(a); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const URL0 = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE', acceptDownloads: true });
const page = await ctx.newPage();
const logs = [], fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) logs.push('[console] ' + m.text().slice(0, 400)); });
const finish = async () => {
  console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 14)) console.log(l);
  check(!logs.some(l => /pageerror/.test(l)), 'no page errors');
  await browser.close(); srv.close();
  console.log(fails.length ? 'FAILED ' + fails.length : 'ALL OK');
  process.exit(fails.length ? 1 : 0);
};
const crashed = async (e) => { console.log('  ✗ crashed: ' + String(e && e.stack || e).slice(0, 900)); fails.push('crash'); try { await finish(); } catch (e2) { process.exit(1); } };
process.on('unhandledRejection', crashed); process.on('uncaughtException', crashed);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, a) => page.evaluate(fn, a);
// the game loop by hand (rendering off unless a picture is wanted)
const step = async (n, dtms = 33, render = false) => { for (let k = 0; k < n; k += 10) { await ev(([m, d, r]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = !r; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } window.__norender = true; }, [Math.min(10, n - k), dtms, render]); await wait(5); } };
const busy = () => ev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const s of c.sec) if (s.dirty || s.pending) dirty++; return { jobs: g.pool.busy, pend: g.world.pending.size, dirty }; });
const settle = async (max = 90) => { for (let i = 0; i < max; i++) { await step(10); const s = await busy(); if (s.jobs === 0 && s.pend === 0 && s.dirty === 0 && i > 2) return true; await wait(60); } return false; };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `${SHOTS}/${name}.png`, timeout: 180000 }); console.log('  shot ' + name + '.png'); };

await page.goto(URL0 + '/index.html');
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.horizon = 1; g.applySettings('*'); if (VR.UIPrefs) VR.UIPrefs.set({ pro: true }); });
check(await ev(() => !!(VR.ZeitRec && VR.Zeit && VR.SB_EDIT && VR.EDIT)), 'the game has the recorder and the replay (VR.ZeitRec, VR.Zeit)');
await ev(`VR.game.createWorld({name:'Zeitrafferwelt',mode:'creative',difficulty:'peaceful',type:'flat',seed:'20261008',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.env.setTime(6000); });
await settle(90);
const W = await ev(() => { const g = VR.game, p = g.player, x = Math.floor(p.pos[0]), z = Math.floor(p.pos[2]); return { id: g.meta.id, x, z, gy: g.world.topAt(x, z), pos: p.pos.slice(), rec: !!g.world.zr }; });
console.log('world', JSON.stringify(W));
check(W.rec, 'the player\'s own world records (world.zr is set)');

// ---- by hand: a row of planks (one at a time), one of them broken again
for (let i = 0; i < 12; i++) {
  await ev(([w, i]) => { const g = VR.game, p = g.player, R = VR.R, x = w.x + 5 + (i % 6), z = w.z + 5 + Math.floor(i / 6), y = w.gy;
    p.placeFromHit(R.byName.oak_planks, { x, y, z, face: 2, px: x + 0.5, py: y + 1, pz: z + 0.5, state: g.world.getBlock(x, y, z) }); }, [W, i]);
  await wait(60);
}
await ev((w) => { const g = VR.game, x = w.x + 7, y = w.gy + 1, z = w.z + 5; g.player.breakBlock(x, y, z, g.world.getBlock(x, y, z), false); }, W);
// ---- the wand: a glass box, then /undo
await ev((w) => { const g = VR.game, G = g.gadgets; G.wand.a = [w.x - 12, w.gy + 1, w.z + 4]; G.wand.b = [w.x - 8, w.gy + 4, w.z + 8]; g.chat('/fill glass'); });
await wait(80);
await ev(() => VR.game.chat('/undo'));
// ---- the Forge: a house where the player looks
await ev((w) => { const g = VR.game, p = g.player; p.flying = true; p.teleport(w.x + 0.5, w.gy + 8, w.z + 8.5); const t = [w.x + 0.5, w.gy, w.z - 18.5], e = [p.pos[0], p.pos[1] + p.eye, p.pos[2]]; p.yaw = Math.atan2(-(t[0] - e[0]), -(t[2] - e[2])); p.pitch = Math.atan2(t[1] - e[1], Math.hypot(t[0] - e[0], t[2] - e[2])); }, W);
await step(4);
await ev(() => VR.game.chat('/bau Haus'));
let built = '';
for (let i = 0; i < 120; i++) { await step(10); built = await ev((id) => { try { return JSON.parse(localStorage.getItem('r9si.plans.' + id)).plans.map(p => p.kind + ':' + p.status).join(','); } catch (e) { return ''; } }, W.id); if (/built/.test(built)) break; await wait(100); }
check(/forge:built/.test(built), 'the Forge built the house in the game (' + built + ')');
await settle(60);

// ---- what the recorder holds, and that it is in its own database
const H = await ev(async () => {
  const g = VR.game, Z = VR.ZeitRec, segs = await g.zeitRec.snapshot();
  const rows = []; let k = 0;
  for (const s of segs) Z.decode(s, { batch(t, kind) { k = kind; }, change(x, y, z, o, n) { rows.push([k, x, y, z, o, n]); } });
  const kinds = {}; for (const r of rows) kinds[r[0]] = (kinds[r[0]] || 0) + 1;
  const plan = rows.filter(r => r[0] === Z.K.PLAN && r[5] && !r[4] && g.world.getBlock(r[1], r[2], r[3]) === r[5]);
  const pick = []; for (let i = 0; i < plan.length; i += Math.max(1, Math.floor(plan.length / 80))) pick.push(plan[i].slice(1));
  await g.zeitRec.flush(); await g.zeitRec.idle();
  const db = await new Promise((res) => { const q = indexedDB.open(Z.DB); q.onsuccess = () => res(q.result); q.onerror = () => res(null); });
  let stored = 0, bytes = 0;
  if (db) { const idx = await new Promise((res) => { const r = db.transaction('idx').objectStore('idx').getAll(IDBKeyRange.bound([g.meta.id, -Infinity], [g.meta.id, Infinity])); r.onsuccess = () => res(r.result); r.onerror = () => res([]); }); for (const v of idx) { stored += v.n; bytes += v.bytes; } db.close(); }
  const worlds = await new Promise((res) => { const q = indexedDB.open('r9si'); q.onsuccess = () => { const d = q.result; res([...d.objectStoreNames]); d.close(); }; q.onerror = () => res([]); });
  return { n: rows.length, kinds, pick, planN: plan.length, stored, bytes, worlds };
});
console.log('history', JSON.stringify({ n: H.n, kinds: H.kinds, planN: H.planN, stored: H.stored, bytes: H.bytes, worlds: H.worlds }));
check(H.kinds[1] >= 12 && H.kinds[2] >= 60 && H.kinds[5] >= 60 && H.kinds[3] > 200, 'recorded: the hand (' + H.kinds[1] + '), the wand\'s fill (' + H.kinds[2] + '), its undo (' + H.kinds[5] + '), the Forge house (' + H.kinds[3] + ')');
check(H.stored === H.n && H.bytes > 0 && H.bytes / H.n < 6, 'in the database r9si-history: ' + H.stored + ' changes in ' + H.bytes + ' bytes (' + (H.bytes / H.n).toFixed(2) + ' B per change); the worlds\' database keeps its own stores (' + H.worlds.join(', ') + ')');
// the recorder's cost here, in the browser
const cost = await ev(() => { const Z = VR.ZeitRec, r = new Z.Rec('perf', new Z.MemBackend(), { checkMs: 1e9, segBytes: 1 << 30 }); const N = 300000, t0 = performance.now(); r.begin(3, 'overworld'); for (let i = 0; i < N; i++) r.add((i & 63) - 32, 64 + ((i >> 12) & 63), (i >> 6) & 63, 0, (i * 13) & 4095); r.end(); const bulk = (performance.now() - t0) / N; const M = 20000, t1 = performance.now(); for (let i = 0; i < M; i++) r.one(i & 255, 70, i >> 8, 0, 5, 'overworld', 1); return { bulkUs: bulk * 1000, handUs: (performance.now() - t1) / M * 1000 }; });
console.log('recorder cost: bulk ' + cost.bulkUs.toFixed(3) + ' µs, hand ' + cost.handUs.toFixed(3) + ' µs per change');
check(cost.bulkUs < 100 && cost.handUs < 100, 'recording costs < 0.1 ms per change in the page (bulk ' + cost.bulkUs.toFixed(2) + ' µs, hand ' + cost.handUs.toFixed(2) + ' µs)');

// ---- 📽 from the pause menu
const before = await ev((pick) => { const g = VR.game; return { pos: g.player.pos.slice(), ticks: g.env.ticks, cols: [...g.world.cols.keys()].length, cells: pick.map(([x, y, z]) => g.world.getBlock(x, y, z)) }; }, H.pick);
await ev(() => { VR.game.ui.pause(); });
const label = await ev(() => { const b = document.querySelector('#pause [data-act="zeitraffer"]'); return b ? b.textContent : null; });
check(label === '📽 Zeitraffer', 'the pause menu has „📽 Zeitraffer“ (' + label + ')');
await page.click('#pause [data-act="zeitraffer"]');
for (let i = 0; i < 120; i++) { await wait(250); if (await ev(() => VR.Zeit.active || (VR.Zeit.ui && /empty|far/.test(VR.Zeit.ui.mode || '')))) break; }
const R0 = await ev(() => { const Z = VR.Zeit, S = Z.S; return { active: Z.active, mode: Z.ui && Z.ui.mode, n: S && S.C.n, cols: S && S.cols.size, zr: S ? [...S.cols.keys()].every(k => VR.game.world.cols.get(k).zr) : false, total: S && S.T.total, speed: S && S.speed, screen: VR.game.ui.screen, hud: document.getElementById('hud').style.visibility }; });
console.log('replay', JSON.stringify(R0));
check(R0.active && R0.n <= H.n && R0.n > 300 && R0.zr && R0.screen === 'zeitraffer', 'the replay is open: ' + R0.n + ' changes of the place in ' + R0.cols + ' replay columns, ×' + R0.speed + ', ' + ((R0.total || 0) / 1000).toFixed(1) + ' s at ×1');
if (!R0.active) await finish();
// the place as it was: the house's cells empty
await ev(() => { const Z = VR.Zeit; Z.S.playing = false; Z.S.phase = 'play'; Z.seek(0); });
const cellsAt = () => ev((pick) => pick.map(([x, y, z, o, n]) => { const s = VR.game.world.getBlock(x, y, z); return s === n ? 1 : s === o ? 0 : -1; }), H.pick);
let st = await cellsAt();
check(st.every(v => v === 0), 'at the start the place is as it was: ' + st.filter(v => v === 0).length + '/' + st.length + ' of the house\'s cells empty');
await settle(80); await step(6, 33);
await shot('zeitraffer_1_start');
// the middle of the house: half built
const mid = await ev(() => { const S = VR.Zeit.S, C = S.C; let b0 = -1; for (let b = 0; b < C.nb; b++) if (C.bk[b] === 3) { b0 = b; break; } let b1 = b0; while (b1 + 1 < C.nb && C.bk[b1 + 1] === 3) b1++; const i0 = C.bi[b0], i1 = C.bi[b1 + 1]; const t = S.T.at(Math.floor((i0 + i1) / 2)); VR.Zeit.seek(t); return { i0, i1, cur: S.cursor, t }; });
st = await cellsAt();
const half = st.filter(v => v === 1).length;
check(mid.cur > mid.i0 && mid.cur < mid.i1 && half > 0 && half < st.length, 'the scrubber\'s middle of the house: ' + half + '/' + st.length + ' cells built (cursor ' + mid.cur + ' between ' + mid.i0 + ' and ' + mid.i1 + ')');
await settle(80); await step(6, 33);
await shot('zeitraffer_2_mid');
// the scrubber as the player drags it (the range input)
const drag = await ev(() => { const s = document.querySelector('#zr .zr-scrub'); s.value = '250'; s.dispatchEvent(new Event('input', { bubbles: true })); const S = VR.Zeit.S; return { clock: S.clock, total: S.T.total, cur: S.cursor }; });
check(Math.abs(drag.clock - drag.total * 0.25) < 1 && drag.cur > 0, 'the scrubber (dragged to ¼) moves the replay there (' + (drag.clock / 1000).toFixed(1) + ' s, change ' + drag.cur + ')');
// the end: the finished build
await ev(() => VR.Zeit.seek(VR.Zeit.S.T.total));
st = await cellsAt();
check(st.every(v => v === 1), 'at the end the build is finished: ' + st.filter(v => v === 1).length + '/' + st.length + ' of the house\'s cells');
await settle(80); await step(20, 33);
await shot('zeitraffer_3_end');
// ⏯ plays on from the start, at ×100
await ev(() => VR.Zeit.seek(0));
await page.click('#zr [data-zr="sp"][data-v="100"]');
await page.click('#zr [data-zr="play"]');
const c0 = await ev(() => VR.Zeit.S.cursor);
await step(30, 33);
const P1 = await ev(() => ({ cur: VR.Zeit.S.cursor, playing: VR.Zeit.S.playing, speed: VR.Zeit.S.speed, btn: document.querySelector('#zr .zr-play').textContent }));
check(P1.speed === 100 && P1.cur > c0 && (P1.playing || P1.cur === R0.n), '⏯ plays (×100): change ' + c0 + ' → ' + P1.cur + ', button ' + P1.btn);
// the replay frame's main-thread time (the picture off: what the replay itself costs)
const fr = await ev(() => { const g = VR.game, Z = VR.Zeit; Z.seek(0); Z.S.playing = true; Z.S.speed = 300; window.__norender = true; const ts = []; for (let i = 0; i < 60; i++) { const t0 = performance.now(); g.last = t0 - 33; g.loop(t0); ts.push(performance.now() - t0); } ts.sort((a, b) => a - b); return { med: ts[30], p90: ts[54], cur: Z.S.cursor }; });
console.log('replay frame (no picture): median ' + fr.med.toFixed(2) + ' ms, p90 ' + fr.p90.toFixed(2) + ' ms');
check(fr.med < 16, 'a replay frame costs ' + fr.med.toFixed(2) + ' ms on the main thread without the picture (median, ×300)');

// ---- ⏺ Video
const canRec = await ev(() => VR.Zeit.canRecord());
console.log('MediaRecorder here: ' + canRec);
if (canRec) {
  await ev(() => { VR.Zeit.cfg.titleS = 1; VR.Zeit.cfg.endS = 1; VR.Zeit.cfg.maxBodyS = 3; });
  await page.click('#zr [data-zr="rec"]');
  let shotRec = false, done = false;
  for (let i = 0; i < 400 && !done; i++) {
    await step(1, 40, true);
    await wait(40);
    if (!shotRec && i >= 3) { shotRec = true; await page.screenshot({ path: `${SHOTS}/zeitraffer_4_rec.png`, timeout: 180000 }); console.log('  shot zeitraffer_4_rec.png'); }
    done = await ev(() => !!VR.Zeit.lastVideo);
  }
  for (let i = 0; i < 40 && !done; i++) { await wait(250); done = await ev(() => !!VR.Zeit.lastVideo); }
  const V = await ev(() => { const b = VR.Zeit.lastVideo, I = VR.Zeit.lastVideoInfo || {}; return b ? { type: b.type, size: b.size, w: I.w, h: I.h, mime: I.mime, s: I.s, mode: VR.Zeit.ui.mode } : null; });
  console.log('video', JSON.stringify(V));
  check(V && V.type === 'video/webm' && V.size > 0, '⏺ Video gives a video/webm Blob of ' + (V ? V.size : 0) + ' bytes (' + (V ? V.w + '×' + V.h + ', ' + V.mime + ', ' + V.s + ' s' : '—') + ')');
  check(V && V.mode === 'video', 'the finished video is shown with ⬇ Speichern');
  await step(2, 33, true);
  await page.screenshot({ path: `${SHOTS}/zeitraffer_5_video.png`, timeout: 180000 }); console.log('  shot zeitraffer_5_video.png');
  const dlP = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);
  await page.click('#zr [data-zr="save"]');
  const dl = await dlP;
  let dsize = 0, dname = '';
  if (dl) { dname = dl.suggestedFilename(); const fp = await dl.path().catch(() => null); if (fp) dsize = fs.statSync(fp).size; }
  check(dl && /^R9-SI_Zeitraffer_.*\.webm$/.test(dname) && dsize === (V ? V.size : -1), '⬇ Speichern: the download ' + dname + ' (' + dsize + ' bytes) — without the host\'s downloads capability the Blob <a download> path');
  await page.keyboard.press('Escape'); await step(2);
  check(await ev(() => VR.Zeit.active && VR.Zeit.ui.mode === 'play'), 'Esc on the video message: back to the replay');
} else {
  const b = await ev(() => { const r = document.querySelector('#zr [data-zr="rec"]'); return { disabled: r.disabled, title: r.title }; });
  check(b.disabled, 'no MediaRecorder in this headless browser: ⏺ is off (' + b.title + ') — the fallback path, not the recording, is tested here');
}

// ---- Esc: the game exactly as it was
await page.keyboard.press('Escape'); await step(3);
const back = await ev((pick) => { const g = VR.game; return { active: VR.Zeit.active, zr: [...g.world.cols.values()].some(c => c.zr), screen: g.ui.screen, pos: g.player.pos.slice(), ticks: g.env.ticks, hud: document.getElementById('hud').style.visibility, ov: document.getElementById('zr').className, cells: pick.map(([x, y, z]) => g.world.getBlock(x, y, z)) }; }, H.pick);
check(!back.active && !back.zr, 'Esc: the replay is closed, no replay column left in the world');
check(back.cells.every((v, i) => v === before.cells[i]), 'the world as built (' + back.cells.filter((v, i) => v === before.cells[i]).length + '/' + back.cells.length + ' cells as before)');
check(back.pos.every((v, i) => Math.abs(v - before.pos[i]) < 1e-9) && back.ticks === before.ticks, 'the player where he was, the sky as before');
check(back.screen === 'pause', 'back in the pause menu (' + back.screen + ')');
await settle(60);
// the world saved after the replay still has the house (nothing of the replay reached the save)
const saved = await ev(async (pick) => { const g = VR.game; await g.saveMeta(); await g.world.saveAll(); const cols = new Map(); let ok = 0; for (const [x, y, z, o, n] of pick) { const k = (x >> 4) + ',' + (z >> 4); if (!cols.has(k)) cols.set(k, await g.store.loadColumn(g.world.dim, x >> 4, z >> 4)); const b = cols.get(k); if (b && b[(y << 8) | ((z & 15) << 4) | (x & 15)] === n) ok++; } return { ok, n: pick.length }; }, H.pick);
check(saved.ok === saved.n, 'the saved world has the finished house (' + saved.ok + '/' + saved.n + ' cells from the save)');
await shot('zeitraffer_6_back');
// ---- 🎒 Meins: the world's card has 📽 (not the worlds screen's); it plays, Esc returns to 🎒 Meins
await ev(() => { if (VR.game.ui.screen !== 'pause') VR.game.ui.pause(); });
await page.click('#pause [data-act="meins"]'); await wait(500);
const mz = await ev((id) => { const b = document.querySelector('#meins .wcard[data-id="' + id + '"] [data-w="zeit"]'); return b ? b.textContent : null; }, W.id);
check(mz === '📽 Zeitraffer', '🎒 Meins: the world\'s card has „📽 Zeitraffer“ (' + mz + ')');
if (mz) {
  await page.click('#meins .wcard[data-id="' + W.id + '"] [data-w="zeit"]');
  for (let i = 0; i < 80; i++) { await wait(250); if (await ev(() => VR.Zeit.active)) break; }
  const ok = await ev(() => VR.Zeit.active && VR.Zeit.from === 'meins');
  await page.keyboard.press('Escape'); await step(2);
  const back2 = await ev(() => ({ active: VR.Zeit.active, screen: VR.game.ui.screen, zr: [...VR.game.world.cols.values()].some(c => c.zr) }));
  check(ok && !back2.active && !back2.zr && back2.screen === 'meins', '📽 from 🎒 Meins plays; Esc returns to 🎒 Meins (' + back2.screen + ')');
}
await finish();
