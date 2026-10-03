// Modern Living in the browser: the creative tab "✨ Modern Living" shows the whole pack (icons painted a few per frame;
// nothing of the pack is compiled at boot), a lamp switches off and on with a right click (every part, its light
// follows), a gallery room per set (screenshots test/shots/modern_room_<set>.png), the R9 Studio's 🧱 Teile has a
// ✨ Modern chip with rendered pictures and Möbel sorts the pack into its categories; no page errors.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const PORT = 8765 + Math.floor(Math.random() * 400);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', '/home/claude/vr/dist'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const URL0 = `http://127.0.0.1:${PORT}`;
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } });
const logs = [];
const watch = (pg, tag) => { pg.on('pageerror', e => logs.push(`[${tag} pageerror] ` + (e.stack || e.message).slice(0, 900))); pg.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) logs.push(`[${tag}] ` + m.text().slice(0, 300)); }); };
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const SETS = (process.env.SETS || '').split(',').filter(Boolean);

// ---------------------------------------------------------------- the game
const game = await ctx.newPage(); watch(game, 'game');
const t0 = Date.now();
await game.goto(URL0 + '/index.html');
const ev = (fn, a) => game.evaluate(fn, a);
for (let i = 0; i < 160; i++) { await game.waitForTimeout(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
const boot = await ev(() => { const pack = VR.R.types.filter(t => t.o.modern); return { ms: Math.round(performance.now()), pack: pack.length, compiled: pack.filter(t => VR.VM.MODELS[t.name].compiled).length, late: VR.VM.stats.lateMs, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1 }; });
console.log('1 · boot', JSON.stringify(boot), 'wall', Date.now() - t0, 'ms');
check(boot.pack >= 40 && boot.compiled === 0, 'the title screen is up with ' + boot.pack + ' Modern Living items registered, none of them built yet');
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 4; g.settings.horizon = 0; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Modern',mode:'creative',difficulty:'peaceful',seed:'4711',cheats:true,kit:false})`);
for (let i = 0; i < 120; i++) { await game.waitForTimeout(1000); if (await ev(() => VR.game.state) === 'play') break; }
const inWorld = await ev(() => VR.R.types.filter(t => t.o.modern && VR.VM.MODELS[t.name].compiled).length);
check(inWorld === 0, 'in a fresh world no pack model is built (' + inWorld + ')');

console.log('2 · the creative tab');
// the main thread's first voxel icon builds the face masks of every older VX block (VX.init, not the pack): do it first
const warm = await ev(() => { const t = performance.now(); VR.VX.spec(1); return Math.round(performance.now() - t); });
console.log('  VX.init (the older blocks, before the tab)', warm, 'ms');
const tab = await ev(async () => {
  const g = VR.game, ui = g.ui;
  // time the icon painting itself, per frame
  const paint = g.icons.paint.bind(g.icons); let inFrame = 0, maxIn = 0, n = 0; const tick = () => { maxIn = Math.max(maxIn, inFrame); inFrame = 0; };
  g.icons.paint = (cv, id, size) => { const t = performance.now(); paint(cv, id, size); inFrame += performance.now() - t; n++; };
  ui.openInventory('creative');
  const btn = [...document.querySelectorAll('#invpanel .tabs button')].find(b => /Modern Living/.test(b.textContent));
  if (!btn) return { tab: false };
  const f0 = performance.now(); btn.click(); const clickMs = performance.now() - f0;
  const slots = [...document.querySelectorAll('#invpanel .palette .slot[data-id]')];
  const painted = () => slots.filter(s => { const c = s.querySelector('canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; }).length;
  let frames = 0;
  for (let k = 0; k < 400 && painted() < slots.length; k++) { await new Promise(r => requestAnimationFrame(r)); tick(); frames++; }
  tick(); g.icons.paint = paint;
  const ids = slots.map(s => s.dataset.id), pack = VR.R.types.filter(t => t.o.modern).map(t => t.name);
  return { tab: true, label: btn.textContent, slots: slots.length, all: pack.every(n => ids.includes(n)), painted: painted(), clickMs: Math.round(clickMs), frames, maxIconMsPerFrame: Math.round(maxIn), icons: n };
});
console.log('  tab', JSON.stringify(tab));
check(tab.tab && tab.all && tab.slots === boot.pack, 'the "' + tab.label + '" tab shows every item of the pack (' + tab.slots + ')');
check(tab.painted === tab.slots && tab.maxIconMsPerFrame < 120, 'every icon is painted, a few per frame (' + tab.frames + ' frames, at most ' + tab.maxIconMsPerFrame + ' ms of icons in one frame; the click itself ' + tab.clickMs + ' ms)');
await ev(() => VR.game.ui.closeInventory());

console.log('3 · a lamp switches with a right click');
const sw = await ev(() => {
  const g = VR.game, w = g.world, p = g.player, R = VR.R, VM = VR.VM;
  const x = Math.floor(p.pos[0]) + 3, z = Math.floor(p.pos[2]), y = Math.floor(p.pos[1]) + 6;
  const name = 'vm_light_floor_globe_brass', t = R.byName[name], m = VM.MODELS[name];
  for (const [dx, dy, dz, i] of VM.footprint(m, 0)) w.setBlock(x + dx, y + dy, z + dz, t.state({ facing: 0, part: i, lit: 1 }), 0);
  const lits = () => VM.footprint(m, 0).map(([dx, dy, dz]) => t.get(w.getBlock(x + dx, y + dy, z + dz), 'lit'));
  const emit = () => R.T.emit[w.getBlock(x, y + 1, z)];
  const r = { before: lits(), emitOn: emit() };
  const top = w.getBlock(x, y + 1, z);
  r.used = g.interactBlock(x, y + 1, z, top, p); r.off = lits(); r.emitOff = emit();
  r.used2 = g.interactBlock(x, y, z, w.getBlock(x, y, z), p); r.on = lits();
  return r;
});
console.log('  switch', JSON.stringify(sw));
check(sw.before.join() === '1,1' && sw.used && sw.off.join() === '0,0' && sw.emitOn > 0 && sw.emitOff === 0, 'a right click on the top part switches the whole lamp off (both parts, no light)');
check(sw.used2 && sw.on.join() === '1,1', 'a right click on the foot switches it on again');

// ---- a gallery room per set (night, lamps on): screenshots to look at. Frames are stepped without drawing while the
// world settles (software GL is slow), then one is drawn for the picture
await ev(() => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; });
const step = async (n) => { for (let k = 0; k < n; k++) await ev(() => { const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); }); };
const settle = async (max = 40) => { for (let i = 0; i < max; i++) { await step(4); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size }; }); if (s.busy === 0 && s.pend === 0 && i > 2) break; await game.waitForTimeout(150); } };
const sets = SETS.length ? SETS : await ev(() => [...new Set(VR.R.types.filter(t => t.o.modern).map(t => t.o.set))]);
for (const set of sets) {
  const room = await ev((set) => {
    const g = VR.game, w = g.world, p = g.player, R = VR.R, VM = VR.VM, L = [];
    const S = (n, pr) => { const t = R.byName[n]; return pr ? t.state(pr) : t.defaultState; };
    const x0 = Math.floor(p.pos[0]) + 20, z0 = Math.floor(p.pos[2]) + 10, y0 = 120, W = 34, D = 10;
    for (let x = -8; x < W + 8; x++) for (let z = -14; z < D + 2; z++) for (let y = y0 - 1; y < y0 + 7; y++) L.push([x0 + x, y, z0 + z, 0]);
    for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) { L.push([x0 + x, y0 - 1, z0 + z, S('vollton_light_grey')]); L.push([x0 + x, y0 + 4, z0 + z, S('vollton_white')]); }
    for (let x = 0; x < W; x++) for (let y = 0; y < 4; y++) L.push([x0 + x, y0 + y, z0 + D, S('vollton_cream')]);
    const items = R.types.filter(t => t.o.modern && t.o.set === set);
    const put = (t, x, y, z) => { const m = VM.MODELS[t.name]; for (const [dx, dy, dz, i] of VM.footprint(m, 0)) L.push([x + dx, y + dy, z + dz, t.state({ facing: 0, part: i, lit: 1 })]); };
    let xw = 1, xc = 1, xf = 1, zf = D - 1;
    for (const t of items) {
      const m = VM.MODELS[t.name], mount = t.o.mount || 'floor';
      if (mount === 'wall') { put(t, x0 + xw, y0 + (m.H > 1 ? 0 : 1), z0 + D - m.D); xw += m.W + 1; }
      else if (mount === 'ceiling') { put(t, x0 + xc, y0 + 4 - m.H, z0 + 3); xc += m.W + 1; }
      else { if (xf + m.W > W - 1) { xf = 1; zf -= 3; } put(t, x0 + xf, y0, z0 + zf - m.D + 1 - (zf === D - 1 ? 1 : 0)); xf += m.W + 1; }
    }
    w.bulkSet(L, false);
    return { x0, y0, z0, W, n: items.length };
  }, set);
  await settle(40);
  await ev(([r]) => { const g = VR.game, p = g.player; p.flying = true; p.teleport(r.x0 + r.W / 2, r.y0 + 2.4, r.z0 - 10); p.yaw = Math.PI; p.pitch = -0.14; g.env.setTime(15500); g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; }, [room]);
  await settle(30); await step(4);
  await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; });
  await game.screenshot({ path: `/home/claude/vr/test/shots/modern_room_${set}.png`, timeout: 120000 });
  console.log('  room', set, room.n, 'items → test/shots/modern_room_' + set + '.png');
}
const after = await ev(() => { const pack = VR.R.types.filter(t => t.o.modern); return { compiled: pack.filter(t => VR.VM.MODELS[t.name].compiled).length, stats: VR.VM.stats, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : -1 }; });
console.log('  after the galleries', JSON.stringify(after));

// ---------------------------------------------------------------- the Studio
console.log('4 · the R9 Studio');
const st = await ctx.newPage(); watch(st, 'studio');
await st.goto(URL0 + '/studio.html');
const sev = (fn, a) => st.evaluate(fn, a);
for (let i = 0; i < 400; i++) { await st.waitForTimeout(500); if (await sev(() => !!(window.__studioCore && window.__studioCore.texInfo() && !document.getElementById('studio').classList.contains('boot')))) break; }
const s1 = await sev(async () => {
  const lazy = Object.values(VR.VM.MODELS).filter(m => m.lazy), built = lazy.filter(m => m.compiled).length;
  document.querySelector('nav.modes [data-mode="parts"]').click();
  await new Promise(r => setTimeout(r, 400));
  const chip = document.querySelector('#chips button[data-pcat="modern"]');
  if (!chip) return { chip: false };
  chip.click();
  const cards = [...document.querySelectorAll('#list .card[data-bid]')];
  const lit = () => cards.slice(0, 12).filter(c => { const cv = c.querySelector('canvas.th'); if (!cv) return false; const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; }).length;
  for (let k = 0; k < 400 && lit() < Math.min(12, cards.length); k++) await new Promise(r => setTimeout(r, 100));   // software GL renders a picture in about a second
  const r = { chip: chip.textContent, cards: cards.length, pictures: lit(), lazy: lazy.length, builtAtBoot: built };
  cards[0].click(); await new Promise(res => setTimeout(res, 300));
  r.scene = window.__st.scene && window.__st.scene.type; r.sceneName = window.__st.scene && window.__st.scene.name;
  return r;
});
console.log('  teile', JSON.stringify(s1));
check(s1.chip && s1.cards >= 40, '🧱 Teile has a ✨ Modern chip with the pack (' + s1.cards + ' cards)');
check(s1.pictures >= Math.min(12, s1.cards), 'the cards get rendered pictures (' + s1.pictures + ' of the first 12)');
check(s1.scene === 'model' && /^vm_/.test(s1.sceneName || ''), 'a click shows the whole model (' + s1.sceneName + ')');
check(s1.lazy >= 40 && s1.builtAtBoot <= 12, 'the Studio builds the pack lazily too (' + s1.builtAtBoot + ' of ' + s1.lazy + ' built at boot)');
await st.screenshot({ path: '/home/claude/vr/test/shots/modern_studio_teile.png' });
const s2 = await sev(async () => {
  document.querySelector('nav.modes [data-mode="furn"]').click();
  await new Promise(r => setTimeout(r, 300));
  const chips = [...document.querySelectorAll('#chips button')].map(b => [b.dataset.fcat, +(b.querySelector('b') || {}).textContent || 0]);
  const C = window.__studioCore;
  return { chips, light: C.catsOf('vm_light_pendant_globe_brass'), smart: C.catsOf('vm_smart_speaker_sand'), old: C.catsOf('vm_pendant') };
});
console.log('  möbel', JSON.stringify(s2).slice(0, 600));
const chipN = (k) => (s2.chips.find(c => c[0] === k) || [0, 0])[1];
check(chipN('modern') >= 40 && chipN('smart') >= 18 && chipN('light') >= 24, 'Möbel: ✨ Modern Living ' + chipN('modern') + ', Smart Home ' + chipN('smart') + ', Licht ' + chipN('light'));
check(s2.light.includes('light') && s2.smart.includes('smart') && s2.old.includes('light'), 'categories come from the definitions (the older pack keeps its own)');

console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
check(!logs.some(l => /pageerror/.test(l)), 'no page errors');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close(); srv.kill(); process.exit(fails ? 1 : 0);
