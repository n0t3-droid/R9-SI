// B1 Live-Schleife (docs/superpowers/specs/2026-10-03-live-loop-design.md · plans/2026-10-08-live-loop-b1.md): a block's
// look changed in the R9 Studio over the running game is in the game at once; ⧉ Als Variante; a world keeps the variants
// it contains; a guest plays with the host's looks. German UI (locale de-DE).
//   1 the pause menu's „✏️ Aussehen ändern" (the crosshair's block) opens the Studio over the game on its 🎨 Aussehen
//   2 a colour there: the Studio's own preview shows it at once — the game not yet (a preview is not stored)
//   3 ✓ Für alle → back in the game: only the sections that show the block are meshed again (no reload, no remeshAll)
//   4 ⧉ Als Variante fills slot 0 (the source keeps its look), ✋ In die Hand puts it into the game's hand, ✏️ on the
//     block's card opens its panel again, ↺ Original reverts it
//   5 the variant placed with a right click; the world saved; a browser that lost its looks reopens it with the variant
//   6 a guest joins: the host's looks and variant reach it (the Studio-Paket); when it leaves, its own looks are back
// Screenshots (test/shots): live_rc_before · live_studio_panel · live_rc_after · live_variant · live_reload · live_guest
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/claude/.npm-global/lib/node_modules/sharp/lib/index.js';
import { spawn } from 'child_process';
const PORT = 9100 + Math.floor(Math.random() * 400), SESS = 'local:lv' + Math.floor(Math.random() * 1e6);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', '/home/claude/vr/dist'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'de-DE' });
const URL0 = `http://127.0.0.1:${PORT}/index.html?mp=${SESS}`;
const logs = [];
const watch = (P, tag) => {
  P.on('pageerror', e => logs.push(`[${tag} pageerror] ` + (e.stack || e.message).slice(0, 900)));
  P.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) logs.push(`[${tag} console] ` + m.text().slice(0, 300)); });
};
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const ev = (P, fn, a) => P.evaluate(fn, a);
// the game's frames by hand (requestAnimationFrame is off): the scene is drawn only for a screenshot
const step = async (P, n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(P, ([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
const busy = (P) => ev(P, () => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty, scan: !!(VR.LiveLoop && VR.LiveLoop.scan) }; });
const settle = async (P, max = 60, other) => { for (let i = 0; i < max; i++) { await step(P, 10); if (other) await step(other, 5); const s = await busy(P); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && !s.scan && i > 2) return i; await wait(60); } return -1; };
// (F8: a chunk fades in over 300 ms after its upload — the picture waits until nothing is fading, else a fresh wall is dithered away)
const shot = async (P, name) => { for (let i = 0; i < 40 && await ev(P, () => { const w = VR.game.world; return !!(w && w.fading && w.fading.size); }); i++) { await step(P, 2); await wait(50); } await ev(P, () => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); const path = `/home/claude/vr/test/shots/${name}.png`; await P.screenshot({ path, timeout: 180000 }); console.log('  shot ' + path); return path; };
// world points → screen pixels (the camera of the last frame: the player's eyes)
const proj = (P, pts) => ev(P, (pts) => { const g = VR.game, r = g.renderer, p = g.player, m = r.vpNJ || r.viewProj, ex = p.pos[0], ey = p.pos[1] + p.eye, ez = p.pos[2]; return pts.map(([X, Y, Z]) => { const x = X - ex, y = Y - ey, z = Z - ez, cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15]; return [Math.round((cx / cw * 0.5 + 0.5) * innerWidth), Math.round((0.5 - cy / cw * 0.5) * innerHeight)]; }); }, pts);
// the average colour of a few boxes of a screenshot
const avg = async (path, pts, r = 10) => { const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true }); const ch = info.channels; return pts.map(([x, y]) => { const s = [0, 0, 0]; let n = 0; for (let yy = Math.max(0, y - r); yy <= Math.min(info.height - 1, y + r); yy++) for (let xx = Math.max(0, x - r); xx <= Math.min(info.width - 1, x + r); xx++) { const o = (yy * info.width + xx) * ch; s[0] += data[o]; s[1] += data[o + 1]; s[2] += data[o + 2]; n++; } return s.map(v => Math.round(v / Math.max(1, n))); }); };
const near = (a, b, d) => a.every((v, i) => Math.abs(v - b[i]) <= d);
const freeze = (P) => ev(P, () => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.env.setTime(6000); g.env.rain = 0; g.env.rainTarget = 0; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; });
const waitState = async (P, st, sec = 120) => { for (let i = 0; i < sec * 2; i++) { await wait(500); if (await ev(P, (s) => !!(window.VR && VR.game && VR.game.state === s), st)) return true; } return false; };
// the Studio over the game (its iframe)
const frameReady = (P, sel) => ev(P, (sel) => { const f = document.getElementById('studioFrame'); try { const w = f && f.contentWindow; return !!(w && w.VR && w.VR.LookPanel && w.document.querySelector(sel)); } catch (e) { return false; } }, sel);
const waitFrame = async (P, sel, sec = 200) => { for (let i = 0; i < sec * 2; i++) { if (await frameReady(P, sel)) return true; await wait(500); } return false; };
const BLUE = '#3f63a8', RED = '#b5423a';

// ---------------------------------------------------------------- 0 the host: a flat Creative world with an oak wall
const A = await ctx.newPage(); watch(A, 'A');
// (diagnostic) in the Studio frame every WebGL2 call is checked: the first failing calls are listed with the panel picture
await A.addInitScript(() => {
  if (!/studio\.html/.test(location.pathname)) return;
  const ERR = { 1280: 'INVALID_ENUM', 1281: 'INVALID_VALUE', 1282: 'INVALID_OPERATION', 1285: 'OUT_OF_MEMORY', 1286: 'INVALID_FRAMEBUFFER_OPERATION' };
  const orig = HTMLCanvasElement.prototype.getContext; window.__glerrs = [];
  HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
    const gl = Reflect.apply(orig, this, [kind, ...rest]);
    if (!gl || kind !== 'webgl2' || gl.__wrapped) return gl;
    gl.__wrapped = true; const proto = Object.getPrototypeOf(gl);
    for (const k of Object.getOwnPropertyNames(proto)) {
      const d = Object.getOwnPropertyDescriptor(proto, k); if (k === 'getError' || !d || typeof d.value !== 'function') continue;
      const f = d.value;
      gl[k] = function (...a) { const r = Reflect.apply(f, gl, a); const e = Reflect.apply(proto.getError, gl, []); if (e && window.__glerrs.length < 30) { const desc = a.map(x => (x && x.constructor && !/Number|String|Boolean/.test(x.constructor.name)) ? x.constructor.name + (x.length !== undefined ? '[' + x.length + ']' : '') : String(x)).join(', '); window.__glerrs.push(k + '(' + desc.slice(0, 140) + ') → ' + (ERR[e] || e)); } return r; };
    }
    return gl;
  };
});
await A.goto(URL0);
check(await waitState(A, 'title'), 'the game starts');
const lang = await ev(A, () => ({ lang: VR.I18N && VR.I18N.lang, nav: navigator.language }));
console.log('  language', JSON.stringify(lang));
await ev(A, () => { const g = VR.game; g.settings.renderDist = 4; g.settings.dynRes = false; g.settings.horizon = 1; g.settings.playerName = 'R9'; g.applySettings('*'); if (g.mp && g.mp.confirmNotice) g.mp.confirmNotice(); });
await ev(A, () => VR.game.createWorld({ name: 'Farbwelt', mode: 'creative', difficulty: 'peaceful', type: 'flat', seed: '808', cheats: true, kit: false }));
check(await waitState(A, 'play', 120), 'a flat Creative world is open');
await freeze(A);
await step(A, 20);
const W0 = await ev(A, () => {
  const g = VR.game, w = g.world, p = g.player, R = VR.R;
  const px = Math.floor(p.pos[0]), py = Math.floor(p.pos[1] + 0.01), pz = Math.floor(p.pos[2]);
  const oak = R.byName.oak_planks.defaultState, vx = R.byName.vx_plaster_cream.defaultState, list = [];
  for (let x = px - 7; x <= px + 7; x++) for (let y = py; y <= py + 7; y++) for (let z = pz - 6; z <= pz + 6; z++) list.push([x, y, z, 0]);
  // the oak wall, its left column a mini-voxel plaster wall (VX: colour roles)
  for (let x = px - 4; x <= px + 4; x++) for (let y = py; y <= py + 4; y++) list.push([x, y, pz - 4, x === px - 4 ? vx : oak]);
  w.bulkSet(list, false);
  g._remeshAllN = 0; const ra = g.remeshAll.bind(g); g.remeshAll = function () { g._remeshAllN++; return ra.apply(null, arguments); };
  // what an apply costs this page (the plan's budget: ≤ 2 ms on „Sehr niedrig")
  const L = VR.Looks, ap = L.apply; window.__applyMs = []; L.apply = function () { const t0 = performance.now(), r = ap.apply(this, arguments); if (r.length) window.__applyMs.push(Math.round((performance.now() - t0) * 100) / 100); return r; };
  return { px, py, pz, oak, id: g.meta.id, name: VR.itemName ? VR.itemName('oak_planks') : 'oak_planks' };
});
const { px, py, pz } = W0;
console.log('  world', JSON.stringify(W0));
// two places to stand: the photo (a few steps back) and close to the wall (within reach)
const photo = (P) => ev(P, ([px, py, pz]) => { const p = VR.game.player; p.flying = false; p.teleport(px + 0.5, py, pz + 4.5); p.yaw = 0; p.pitch = -0.08; }, [px, py, pz]);
const close = (P) => ev(P, ([px, py, pz]) => { const p = VR.game.player; p.flying = false; p.teleport(px + 0.5, py, pz + 0.5); p.yaw = 0; p.pitch = 0; }, [px, py, pz]);
const WALL = [px - 1.5, py + 2.5, pz - 3], WALL2 = [px - 2.5, py + 1.5, pz - 3], VAR = [px + 3, py + 2, pz - 2], VXW = [px - 3.5, py + 2.5, pz - 3];
await photo(A);
// (the flat world is meshed at the game's own pace: the wall's sections are what matters, not the whole world's queue)
let wOK = false;
for (let i = 0; i < 400 && !wOK; i++) {
  await step(A, 10);
  wOK = await ev(A, ([px, py, pz]) => { const w = VR.game.world; for (let x = px - 4; x <= px + 4; x += 4) for (let y = py; y <= py + 4; y += 4) { const s = w.sectionAt(x >> 4, y >> 4, (pz - 4) >> 4); if (!s || !(s.meshVer > 0) || s.dirty || s.pending) return false; } return true; }, [px, py, pz]);
  if (!wOK) await wait(40);
}
check(wOK, 'the wall is meshed (' + JSON.stringify(await busy(A)) + ')');
const pBefore = await shot(A, 'live_rc_before');
const scr = await proj(A, [WALL, WALL2, VAR, VXW]);
const c0 = await avg(pBefore, scr);
console.log('  screen points', JSON.stringify(scr), 'colours before', JSON.stringify(c0));
check(c0[0][0] > c0[0][2] + 15, 'before: the oak wall is oak-coloured (more red than blue): ' + JSON.stringify(c0[0]));

// ---------------------------------------------------------------- 1 the pause menu → the Studio on the crosshair's block
await close(A);
await step(A, 6);
const tgt = await ev(A, () => ({ t: VR.LiveLoop.lastTarget, n: VR.LiveLoop.lastTarget ? VR.LiveLoop.nameOf(VR.LiveLoop.lastTarget) : null }));
check(tgt.n === 'oak_planks', 'the crosshair points at the oak wall: ' + JSON.stringify(tgt));
await ev(A, () => VR.game.ui.pause());
const pb = await ev(A, () => { const b = document.getElementById('lookedit'); return b ? { text: b.textContent, shown: b.style.display !== 'none' && !!b.offsetParent } : null; });
check(!!pb && pb.shown && pb.text.startsWith('✏️ Aussehen ändern') && pb.text.includes(W0.name), 'the pause menu shows „✏️ Aussehen ändern · ' + W0.name + '": ' + JSON.stringify(pb));
await A.click('#lookedit');
const up1 = await waitFrame(A, '.lookBox[data-look="oak_planks"]');
const st1 = await ev(A, () => { const f = document.getElementById('studioFrame'), w = f.contentWindow, d = w.document; return { on: f.classList.contains('on'), open: VR.game.studioOpen, src: f.getAttribute('src'), world: w.VR.LookPanel.world, mode: w.__st.mode, head: (d.querySelector('.lookBox .lookH') || {}).textContent, input: !!d.querySelector('.lookBox input[type=color][data-role=rc]'), btns: [...d.querySelectorAll('.lookBox .lookAct button')].map(b => b.textContent) }; });
console.log('  studio', JSON.stringify(st1));
check(up1 && st1.on && st1.open && /#look\/oak_planks\/w\//.test(st1.src || '') && st1.world === W0.id && st1.mode === 'parts', 'the Studio opened over the game on #look/oak_planks/w/<this world> (🧱 Teile)');
check(st1.input && /🎨 Aussehen/.test(st1.head || '') && st1.btns.join('|') === '✓ Für alle|↺ Original|⧉ Als Variante', 'its 🎨 Aussehen: a colour, ✓ Für alle · ↺ Original · ⧉ Als Variante: ' + JSON.stringify(st1.btns));

// ---------------------------------------------------------------- 2 a colour: the Studio's preview at once, the game not yet
const pv = await ev(A, async (c) => {
  const fw = document.getElementById('studioFrame').contentWindow, d = fw.document;
  const inp = d.querySelector('.lookBox[data-look="oak_planks"] input[type=color][data-role=rc]');
  inp.value = c; inp.dispatchEvent(new fw.Event('input'));
  await new Promise(r => setTimeout(r, 700));
  const L = fw.VR.Looks, s = fw.VR.R.byName.oak_planks.defaultState;
  return { studio: fw.VR.R.T.rc[s], want: L.to565(L.hex2int(c)), game: VR.R.T.rc[VR.R.byName.oak_planks.defaultState], stored: localStorage.getItem('r9si.looks'), scene: fw.__st.scene && fw.__st.scene.type + ':' + fw.__st.scene.name, msg: (d.querySelector('.lookBox .lookMsg') || {}).textContent };
}, BLUE);
console.log('  preview', JSON.stringify(pv));
check(pv.studio === pv.want && pv.scene === 'block:oak_planks', 'the Studio previews the colour at once (its registry and its block view)');
check(pv.game === 0 && !pv.stored, 'the game does not take a preview (nothing stored yet)');
await A.screenshot({ path: '/home/claude/vr/test/shots/live_studio_panel_early.png', timeout: 180000 });   // (diagnostic: the view before the Studio's idle work)
await wait(1500);   // (the Studio's own frames draw the block again)
console.log('  studio gl', await ev(A, () => { const fw = document.getElementById('studioFrame').contentWindow, v = fw.document.getElementById('view'), gl = v.getContext('webgl2'); return JSON.stringify({ viewport: gl && Array.from(gl.getParameter(gl.VIEWPORT)), fbo: !!(gl && gl.getParameter(gl.FRAMEBUFFER_BINDING)), canvas: [v.width, v.height], css: [v.clientWidth, v.clientHeight], dpr: fw.devicePixelRatio, err: gl && gl.getError(), glerrs: (fw.__glerrs || []).slice(0, 12) }); }));
const pPanel = await A.screenshot({ path: '/home/claude/vr/test/shots/live_studio_panel.png', timeout: 180000 }).then(() => '/home/claude/vr/test/shots/live_studio_panel.png');
console.log('  shot ' + pPanel);
console.log('  studio cam', await ev(A, () => { const fw = document.getElementById('studioFrame').contentWindow, st = fw.__st; return JSON.stringify({ cam: st && st.cam, scene: st && st.scene && { type: st.scene.type, name: st.scene.name, span: st.scene.span, center: st.scene.center, off: st.scene.off }, view: (() => { const v = fw.document.getElementById('view'); return v && [v.width, v.height, v.clientWidth, v.clientHeight]; })() }); }));
const vc = await ev(A, () => { const f = document.getElementById('studioFrame'), fr = f.getBoundingClientRect(), v = f.contentWindow.document.getElementById('view'), r = v.getBoundingClientRect(); return [Math.round(fr.left + r.left + r.width / 2), Math.round(fr.top + r.top + r.height / 2)]; });
const cs = (await avg(pPanel, [vc], 14))[0];
console.log('  studio view centre', JSON.stringify(vc), JSON.stringify(cs));
check(cs[2] > cs[0] + 15, 'the Studio\'s block view shows the oak planks in blue: ' + JSON.stringify(cs));

// ---------------------------------------------------------------- 3 ✓ Für alle → in the game, one remesh of its sections
const secs = await ev(A, ([px, py, pz]) => { const w = VR.game.world, out = new Map(); for (let x = px - 4; x <= px + 4; x++) for (let y = py; y <= py + 4; y++) { const k = (x >> 4) + ',' + (y >> 4) + ',' + (pz - 4 >> 4); if (!out.has(k)) { const s = w.sectionAt(x >> 4, y >> 4, (pz - 4) >> 4); out.set(k, s ? s.meshVer : -1); } } return [...out]; }, [px, py, pz]);
const ok3 = await ev(A, () => { const fw = document.getElementById('studioFrame').contentWindow; fw.document.querySelector('.lookBox[data-look="oak_planks"] [data-act=lookAll]').click(); return { msg: (fw.document.querySelector('.lookBox .lookMsg') || {}).textContent }; });
await wait(400);
const g3 = await ev(A, () => { const L = VR.Looks, s = VR.R.byName.oak_planks.defaultState, st = L.load(); return { rc: VR.R.T.rc[s], want: L.to565(L.hex2int('#3f63a8')), stored: st.looks.oak_planks || null, scan: !!VR.LiveLoop.scan, applies: VR.LiveLoop.stats.applies }; });
console.log('  ✓ Für alle', JSON.stringify(ok3), JSON.stringify(g3));
check(g3.stored && g3.stored.rc === BLUE && g3.rc === g3.want, '✓ Für alle stores the look and the game\'s registry has it at once (the game under the Studio)');
check(/Im Spiel/.test(ok3.msg || ''), 'the panel says so: ' + ok3.msg);
// back with the Studio's ▶ (the layer closes): the sections showing the wall are meshed again within a few frames
await ev(A, () => { document.getElementById('studioFrame').contentWindow.document.querySelector('.gamelink').click(); });
await wait(300);
let frames = 0, done3 = false;
for (; frames < 400 && !done3; frames += 5) { await step(A, 5); done3 = await ev(A, (secs) => secs.every(([k, v]) => { const [cx, sy, cz] = k.split(',').map(Number), s = VR.game.world.sectionAt(cx, sy, cz); return s && s.meshVer > v && !s.dirty && !s.pending; }), secs); }
for (let i = 0; i < 80 && (await ev(A, () => !!VR.LiveLoop.scan)); i++) await step(A, 2);   // the scan goes on a few columns a frame: read its stats when it is done
const st3 = await ev(A, () => ({ open: VR.game.studioOpen, remeshAll: VR.game._remeshAllN, stats: VR.LiveLoop.stats, screen: VR.game.ui.screen }));
console.log('  remesh', JSON.stringify({ frames, done3, secs, ...st3 }));
check(!st3.open && done3 && st3.remeshAll === 0, `back in the game the wall's sections are meshed again after ${frames} frames — no reload, no remeshAll`);
check(st3.stats.lastScanMs !== undefined && st3.stats.scanMs < 20 && st3.stats.frameMax < 10, 'the scan for the changed block is cheap: ' + Math.round(st3.stats.scanMs * 10) / 10 + ' ms in all, ' + Math.round(st3.stats.frameMax * 10) / 10 + ' ms at most in one frame, for ' + (await ev(A, () => VR.game.world.cols.size)) + ' columns (8 a frame)');
await photo(A);
await settle(A, 40);
const pAfter = await shot(A, 'live_rc_after');
const c1 = await avg(pAfter, scr);
console.log('  colours after', JSON.stringify(c1));
check(c1[0][2] > c1[0][0] + 15 && c1[1][2] > c1[1][0] + 15, 'the game shows the oak wall in blue: ' + JSON.stringify(c1.slice(0, 2)));

// ---------------------------------------------------------------- 4 ⧉ Als Variante · ✋ In die Hand · ✏️ · ↺ Original
await close(A);
await step(A, 6);
await ev(A, () => VR.game.ui.pause());
await A.click('#lookedit');
check(await waitFrame(A, '.lookBox[data-look="oak_planks"]'), 'the Studio opens again on the oak planks');
const v4 = await ev(A, async (c) => {
  const fw = document.getElementById('studioFrame').contentWindow, d = fw.document;
  const inp = d.querySelector('.lookBox[data-look="oak_planks"] input[type=color][data-role=rc]');
  const shown = inp.value;
  inp.value = c; inp.dispatchEvent(new fw.Event('input'));
  await new Promise(r => setTimeout(r, 400));
  d.querySelector('.lookBox[data-look="oak_planks"] [data-act=lookVar]').click();
  for (let i = 0; i < 40 && !d.querySelector('.lookBox[data-look="var_0"]'); i++) await new Promise(r => setTimeout(r, 250));
  const st = fw.VR.Looks.load();
  return { shown, slot: st.slots[0] || null, next: st.next, src: st.looks.oak_planks || null, panel: !!d.querySelector('.lookBox[data-look="var_0"]'), vbox: (d.querySelector('.lookVar .ph') || {}).textContent, msg: (d.querySelector('.lookBox .lookMsg') || {}).textContent };
}, RED);
console.log('  Als Variante', JSON.stringify(v4));
check(v4.shown === BLUE, 'the panel shows the stored colour');
check(!!v4.slot && v4.slot.src === 'oak_planks' && v4.slot.look && v4.slot.look.rc === RED && v4.next === 1 && v4.panel, '⧉ Als Variante fills slot 1 of 256 with the red copy and opens it: ' + JSON.stringify(v4.slot));
check(!!v4.src && v4.src.rc === BLUE, 'the source keeps its stored look (the red preview was not stored for it)');
check(/Platz 1 von 256/.test(v4.msg || '') && /Platz 1\/256/.test(v4.vbox || ''), 'the panel names the slot: ' + JSON.stringify([v4.msg, v4.vbox]));
const g4 = await ev(A, () => { const R = VR.R, t = R.byName.var_0, L = VR.Looks; return { variantOf: t.o.variantOf, display: t.display, item: !!(VR.itemDef && VR.itemDef('var_0')), rc: R.T.rc[t.defaultState], want: L.to565(L.hex2int('#b5423a')), oakRc: R.T.rc[R.byName.oak_planks.defaultState] }; });
console.log('  game var_0', JSON.stringify(g4), 'apply ms', JSON.stringify(await ev(A, () => window.__applyMs)));
const apMs = await ev(A, () => window.__applyMs);
check(apMs.length >= 2 && Math.max(...apMs) <= 6, 'an apply in the game (a colour, a new variant) takes ' + JSON.stringify(apMs) + ' ms');
check(g4.variantOf === 'oak_planks' && g4.item && g4.rc === g4.want && g4.oakRc === L565(BLUE), 'the game has the variant at once (an item, red) and the oak planks stay blue');
// ✋ In die Hand → the game's selected hotbar slot (the storage event)
const h4 = await ev(A, async () => { const fw = document.getElementById('studioFrame').contentWindow; fw.document.querySelector('.lookBox[data-look="var_0"] [data-act=varHand]').click(); await new Promise(r => setTimeout(r, 600)); const inv = VR.game.player.inv; return { held: inv.slots[inv.sel], msg: (fw.document.querySelector('.lookBox .lookMsg') || {}).textContent }; });
console.log('  hand', JSON.stringify(h4));
check(!!h4.held && h4.held.id === 'var_0', '✋ In die Hand puts the variant into the game\'s hand: ' + JSON.stringify(h4.held));
// ✏️ on the oak card (the panel without ✏️ first), then ↺ Original
const o4 = await ev(A, async () => {
  const fw = document.getElementById('studioFrame').contentWindow, d = fw.document, CAT = fw.VR.StudioCatalog;
  CAT.edit = false; CAT.open('block', 'oak_planks');
  await new Promise(r => setTimeout(r, 600));
  const before = !!d.querySelector('.lookBox[data-look="oak_planks"]');
  const pen = d.querySelector('#list .card[data-bid="oak_planks"] [data-act=lookCard]');
  if (pen) pen.click(); else { CAT.edit = true; CAT.open('block', 'oak_planks'); }
  for (let i = 0; i < 40 && !d.querySelector('.lookBox[data-look="oak_planks"]'); i++) await new Promise(r => setTimeout(r, 250));
  const after = !!d.querySelector('.lookBox[data-look="oak_planks"]');
  d.querySelector('.lookBox[data-look="oak_planks"] [data-act=lookOrig]').click();
  await new Promise(r => setTimeout(r, 500));
  const st = fw.VR.Looks.load();
  return { pen: !!pen, before, after, look: st.looks.oak_planks || null, slot: !!st.slots[0], game: VR.R.T.rc[VR.R.byName.oak_planks.defaultState], studio: fw.VR.R.T.rc[fw.VR.R.byName.oak_planks.defaultState] };
});
console.log('  original', JSON.stringify(o4));
check(o4.pen && !o4.before && o4.after, '✏️ on the oak planks\' card opens their 🎨 Aussehen');
check(!o4.look && o4.slot && o4.game === 0 && o4.studio === 0, '↺ Original: the oak planks are original again — in the Studio and in the game; the variant stays');
// the panel of a mini-voxel piece (its colour roles and Material) and of a piece of furniture (▣ Möbel: its main
// colours and their materials) — previews only, nothing stored
const x4 = await ev(A, async () => {
  const fw = document.getElementById('studioFrame').contentWindow, d = fw.document, CAT = fw.VR.StudioCatalog, C = fw.__studioCore, out = {};
  try {
    CAT.edit = true; CAT.open('block', 'vx_plaster_cream');
    for (let i = 0; i < 40 && !d.querySelector('.lookBox[data-look="vx_plaster_cream"]'); i++) await new Promise(r => setTimeout(r, 250));
    const box = d.querySelector('.lookBox[data-look="vx_plaster_cream"]');
    out.roles = box ? [...box.querySelectorAll('input[type=color]')].map(i => i.dataset.role) : null;
    out.pats = box ? box.querySelectorAll('.lookPats button[data-pat]').length : 0;
    const b = box && box.querySelector('.lookPats button[data-pat="bricks"]');
    if (b) { b.click(); await new Promise(r => setTimeout(r, 500)); }
    out.pat = fw.VR.R.byName.vx_plaster_cream.o.vx.pat;
    out.gamePat = VR.R.byName.vx_plaster_cream.o.vx.pat;
    // leave without ✓: the preview goes back
    CAT.edit = false; CAT.open('block', 'stone');
    await new Promise(r => setTimeout(r, 500));
    out.back = fw.VR.R.byName.vx_plaster_cream.o.vx.pat;
    const name = Object.keys(fw.VR.VM.MODELS).find(n => !C.isFacade(n) && !/^var_/.test(n) && fw.VR.R.byName[n] && fw.VR.Looks.kindOf(n) === 'model');
    out.model = name;
    if (name) {
      C.setMode('furn', true); C.selectModel(name);
      await new Promise(r => setTimeout(r, 600));
      const mb = d.querySelector('#partsBody [data-act=lookModel]'); out.modelBtn = !!mb;
      if (mb) { mb.click(); await new Promise(r => setTimeout(r, 400)); }
      const box2 = d.querySelector('.lookBox[data-look="' + name + '"]');
      out.modelCols = box2 ? box2.querySelectorAll('input[type=color]').length : 0;
      out.modelMats = box2 ? box2.querySelectorAll('select.lookMat').length : 0;
      out.modelActs = box2 ? [...box2.querySelectorAll('.lookAct button')].map(x => x.textContent) : null;
    }
  } catch (e) { out.err = String(e && e.stack || e).slice(0, 300); }
  return out;
});
console.log('  vx + model panels', JSON.stringify(x4));
check(!x4.err && x4.roles && x4.roles[0] === 'col' && x4.roles.length >= 3 && x4.pats >= 5, 'a mini-voxel wall: its colour roles and 🧱 Material in the panel: ' + JSON.stringify([x4.roles, x4.pats]));
check(x4.pat === 'bricks' && x4.gamePat !== 'bricks' && x4.back !== 'bricks', 'a Material preview in the Studio only — and gone when you leave without ✓');
check(!!x4.model && x4.modelBtn && x4.modelCols >= 1 && x4.modelMats === x4.modelCols && (x4.modelActs || []).join('|') === '✓ Für alle|↺ Original|⧉ Als Variante', '▣ Möbel: 🎨 Aussehen shows the main colours with their materials: ' + JSON.stringify([x4.model, x4.modelCols]));
// ⧉ Als Variante of a piece of furniture: a slot of its own, with its own model (var_1), the source keeps its look
const mv = await ev(A, async (name) => {
  const fw = document.getElementById('studioFrame').contentWindow, d = fw.document;
  const vb = name && d.querySelector('.lookBox[data-look="' + name + '"] [data-act=lookVar]');
  if (!vb) return { none: true };
  vb.click();
  for (let i = 0; i < 60 && !fw.VR.R.byName.var_1; i++) await new Promise(r => setTimeout(r, 250));
  await new Promise(r => setTimeout(r, 800));
  const st = fw.VR.Looks.load(), t = fw.VR.R.byName.var_1 || null;
  return { slot: st.slots[1] || null, next: st.next, kind: t && t.o.vx ? t.o.vx.kind : null, model: !!(fw.VR.VM.MODELS.var_1), of: t ? t.o.variantOf : null, msg: (d.querySelector('.lookBox .lookMsg') || {}).textContent };
}, x4.model);
console.log('  Als Variante (Möbel)', JSON.stringify(mv));
check(!mv.none && !!mv.slot && mv.slot.model === true && mv.slot.src === x4.model && mv.next === 2 && mv.kind === 'model' && mv.model && mv.of === x4.model, 'Als Variante on a piece of furniture: its own slot (var_1) with its own model — the source stays: ' + JSON.stringify(mv.slot));
await ev(A, () => { document.getElementById('studioFrame').contentWindow.document.querySelector('.gamelink').click(); });
await wait(300);

// ---------------------------------------------------------------- 5 placing the variant · save · a browser that lost its looks
await close(A);
await ev(A, ([px, py, pz]) => { const p = VR.game.player, ex = p.pos[0], ey = p.pos[1] + p.eye, ez = p.pos[2], X = px + 2.5, Y = py + 1.5, Z = pz - 3; p.yaw = Math.atan2(-(X - ex), -(Z - ez)); p.pitch = Math.atan2(Y - ey, Math.hypot(X - ex, Z - ez)); }, [px, py, pz]);
await step(A, 4);
const pl = await ev(A, ([px, py, pz]) => {
  const g = VR.game, p = g.player, inv = p.inv, held = inv.slots[inv.sel], t = p.target;
  const tg = t ? [t.x, t.y, t.z, t.face] : null;
  const did = held ? p.use(VR.itemDef(held.id), held) : false;
  const s = g.world.getBlock(px + 2, py + 1, pz - 3), v = VR.R.byName.var_0;
  // three more, for the picture
  for (const [x, y] of [[3, 1], [2, 2], [3, 2]]) g.world.setBlock(px + x, py + y, pz - 3, v.defaultState, 0);
  return { tg, did, s, base: v.base, n: v.nstates, held: held && held.id };
}, [px, py, pz]);
console.log('  place', JSON.stringify(pl));
check(pl.did && pl.s >= pl.base && pl.s < pl.base + pl.n, 'a right click places the variant (its own state, slot 0): ' + JSON.stringify(pl.tg));
await photo(A);
await settle(A, 60);
const pVar = await shot(A, 'live_variant');
const c2 = await avg(pVar, scr);
console.log('  colours with the variant', JSON.stringify(c2));
check(near(c2[0], c0[0], 18) && near(c2[1], c0[1], 18), 'the oak wall looks as before (Original): ' + JSON.stringify([c0[0], c2[0]]));
check(c2[2][0] > c2[2][1] + 30 && c2[2][0] > c2[2][2] + 30, 'the variant is red in front of it: ' + JSON.stringify(c2[2]));
// save, forget this browser's looks, load the page again, open the world
await ev(A, async () => { const g = VR.game; await g.saveMeta(); await g.world.saveAll(); });
const sv = await ev(A, async (id) => { const m = (await VR.game.store.listWorlds()).find(w => w.id === id); return m ? m.vars || null : null; }, W0.id);
console.log('  meta.vars', JSON.stringify(sv));
check(!!sv && !!sv[0] && sv[0].src === 'oak_planks' && sv[0].look.rc === RED, 'the saved world keeps a copy of its variant (meta.vars)');
await ev(A, () => localStorage.removeItem('r9si.looks'));
await A.reload();
check(await waitState(A, 'title'), 'the page loads again — without any looks: ' + JSON.stringify(await ev(A, () => localStorage.getItem('r9si.looks'))));
const fresh = await ev(A, () => ({ v: !!VR.R.byName.var_0.o.variantOf }));
check(!fresh.v, 'slot 0 is empty in this browser now');
await ev(A, async (id) => { const g = VR.game; g.settings.renderDist = 4; g.settings.dynRes = false; g.settings.horizon = 1; g.applySettings('*'); const ot = g.ui.toast.bind(g.ui); window.__toasts = []; g.ui.toast = function (a, b) { window.__toasts.push(String(a) + ' · ' + String(b)); return ot.apply(null, arguments); }; const m = (await g.store.listWorlds()).find(w => w.id === id); await g.loadWorld(m); }, W0.id);
check(await waitState(A, 'play', 120), 'the world opens again');
await freeze(A);
await photo(A);
await settle(A, 80);
const r5 = await ev(A, ([px, py, pz]) => { const g = VR.game, R = VR.R, L = VR.Looks, st = L.load(), v = R.byName.var_0, s = g.world.getBlock(px + 2, py + 1, pz - 3); return { slot: st.slots[0] || null, s, inSlot: s >= v.base && s < v.base + v.nstates, variantOf: v.o.variantOf, rc: R.T.rc[v.defaultState], want: L.to565(L.hex2int('#b5423a')), toast: (window.__toasts || []).find(t => /wiederhergestellt/.test(t)) || null }; }, [px, py, pz]);
console.log('  reload', JSON.stringify(r5));
check(!!r5.slot && r5.slot.src === 'oak_planks' && r5.inSlot && r5.variantOf === 'oak_planks' && r5.rc === r5.want, 'the world brings its variant back: slot 0 restored, the placed blocks are the red variant');
check(/Eine Variante aus dieser Welt wiederhergestellt/.test(r5.toast || ''), 'and says so: ' + r5.toast);
const pRe = await shot(A, 'live_reload');
const c3 = await avg(pRe, scr);
console.log('  colours after reload', JSON.stringify(c3));
check(c3[2][0] > c3[2][1] + 30 && c3[2][0] > c3[2][2] + 30 && near(c3[0], c0[0], 18), 'after the reload: the variant red, the wall original');

// ---------------------------------------------------------------- 6 a guest: the host's looks for the session
// the host colours the oak planks blue again and the plaster green (as ✓ Für alle does) — its variant is still red
await ev(A, () => { const L = VR.Looks, d = L.load(); d.looks.oak_planks = { rc: '#3f63a8' }; d.looks.vx_plaster_cream = { vx: { col: '#5e9a6a' } }; L.save(d); VR.LiveLoop.apply(VR.game); });
await settle(A, 40);
const host = await ev(A, () => ({ role: VR.game.mp.role, oak: VR.R.T.rc[VR.R.byName.oak_planks.defaultState], v: VR.R.T.rc[VR.R.byName.var_0.defaultState] }));
console.log('  host', JSON.stringify(host));
check(host.role === 'host', 'the world is open for friends (host)');
// the guest: another browser — none of the host's stored looks (its storage hides them)
const B = await ctx.newPage(); watch(B, 'B');
await B.addInitScript(() => { const gi = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return k === 'r9si.looks' ? null : gi.call(this, k); }; });
await B.goto(URL0);
check(await waitState(B, 'title'), 'the guest\'s game starts');
await ev(B, () => { const g = VR.game; g.settings.playerName = 'Gast'; if (g.mp && g.mp.confirmNotice) g.mp.confirmNotice(); window.requestAnimationFrame = () => 0; });
const own = await ev(B, () => ({ oak: VR.R.T.rc[VR.R.byName.oak_planks.defaultState], v: !!VR.R.byName.var_0.o.variantOf }));
check(own.oak === 0 && !own.v, 'the guest has no looks of its own: ' + JSON.stringify(own));
for (let i = 0; i < 30; i++) { if (await ev(B, () => VR.game.mp.hostList().length)) break; await step(A, 5); await wait(400); }
await ev(B, () => { const h = VR.game.mp.hostList()[0]; if (h) VR.game.mp.join(h); });
for (let i = 0; i < 200; i++) { await step(A, 5); await step(B, 10); if (await ev(B, () => VR.game.state) === 'play') break; await wait(150); }
let pk = null;
for (let i = 0; i < 80; i++) { await step(A, 5); await step(B, 5); pk = await ev(B, () => ({ got: !!VR.game.mp.packGot, session: !!VR.Looks.session })); if (pk.got && pk.session) break; await wait(150); }
await freeze(B);
await photo(B);
for (let i = 0; i < 40; i++) { await step(A, 5); await step(B, 10); const s = await busy(B); const ok = await ev(B, ([px, py, pz]) => { const v = VR.R.byName.var_0, s = VR.game.world.getBlock(px + 2, py + 1, pz - 3); return s >= v.base && s < v.base + v.nstates; }, [px, py, pz]); if (ok && s.busy === 0 && s.pend === 0 && s.dirty === 0 && i > 3) break; await wait(150); }
const g6 = await ev(B, ([px, py, pz]) => { const R = VR.R, v = R.byName.var_0, s = VR.game.world.getBlock(px + 2, py + 1, pz - 3); return { state: VR.game.state, guest: !!(VR.game.meta && VR.game.meta.guest), oak: R.T.rc[R.byName.oak_planks.defaultState], v: R.T.rc[v.defaultState], variantOf: v.o.variantOf, display: v.display, placed: s >= v.base && s < v.base + v.nstates }; }, [px, py, pz]);
console.log('  guest', JSON.stringify({ pk, ...g6 }));
check(g6.state === 'play' && g6.guest && pk.got, 'the guest joins and gets the Studio-Paket');
check(g6.oak === host.oak && g6.v === host.v && g6.variantOf === 'oak_planks' && g6.placed, 'the guest sees the host\'s looks: the blue oak planks and the red variant (its blocks in the world)');
const pG = await shot(B, 'live_guest');
const cg = await avg(pG, await proj(B, [WALL, WALL2, VAR, VXW]));
console.log('  guest colours', JSON.stringify(cg), 'plaster before', JSON.stringify(c0[3]));
check(cg[0][2] > cg[0][0] + 15 && cg[2][0] > cg[2][2] + 30, 'the guest\'s picture: the wall blue, the variant red');
check(cg[3][1] > cg[3][0] + 15 && cg[3][1] > cg[3][2] + 10 && !(c0[3][1] > c0[3][0] + 15), 'and the mini-voxel plaster green (its colour role; it was cream): ' + JSON.stringify([c0[3], cg[3]]));
await ev(B, () => VR.game.quitToTitle());
for (let i = 0; i < 20; i++) { await step(A, 5); await wait(300); if (await ev(B, () => VR.game.state) === 'title') break; }
const back = await ev(B, () => ({ state: VR.game.state, session: !!VR.Looks.session, oak: VR.R.T.rc[VR.R.byName.oak_planks.defaultState], v: !!VR.R.byName.var_0.o.variantOf }));
console.log('  guest left', JSON.stringify(back));
check(back.state === 'title' && !back.session && back.oak === 0 && !back.v, 'leaving, the guest has its own looks again (none)');
check(!logs.some(l => /pageerror\]/.test(l)), 'no page errors');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 20)) console.log(l);
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
await browser.close(); srv.kill();
process.exit(fails ? 1 : 0);
function L565(hex) { const c = parseInt(hex.slice(1), 16), v = (((c >> 19) & 31) << 11) | (((c >> 10) & 63) << 5) | ((c >> 3) & 31); return v || 0x0821; }
