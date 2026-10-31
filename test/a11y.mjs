// e-access · everyone can play, in the browser (plan docs/superpowers/plans/2026-10-31-e-access.md): a new default world
// (seed 4242, creative, Friedlich), Balanced, 960 × 540, de-DE.
//   pictures  test/shots/a11y_jump_normal.png vs a11y_jump_reduced.png (the star jump's transit: bunched stars, or the
//             fade with Weniger Bewegung) · a11y_markers.png and a11y_markers_deutan.png (the conquest map: disturbed ◆ „!",
//             freed ◆ ✓, the Kernfeuer; then a deuteranopia simulation of the same picture) · gamepad_prompts.png (a pad
//             in use: the Aktion prompt with X, the key strip with A / Y / View, LB / RB beside the hotbar) ·
//             high_contrast_hud.png (and _normal: the same HUD) · a11y_onehand.png (⚙ Spiel · Zugänglichkeit)
//   checks    the settings rows, the limiter refuses a storm of forced bolts, the jump fades with Weniger Bewegung,
//             the glyphs replace the key caps with a pad, high contrast and the text size reach the page, the Ein-Hand
//             keyboard overlay, mono on the real audio graph, the frame cost on Very Low and High with every switch on,
//             no page error
// usage: nohup bash test/wt_run.sh a11y.mjs 3600 > .tmp_tests/a11y.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\.tmp_tests\/$/, '');
const DIST = 'file://' + ROOT + 'dist/index.html', SHOTS = ROOT + 'test/shots/';
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg, info) => { const s = info !== undefined ? '  (' + info + ')' : ''; if (!ok) { fails++; console.log('  ✗ ' + msg + s); } else console.log('  ✓ ' + msg + s); };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error') logs.push(`[${t}] ${s.slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const shotPage = async (name) => { await wait(400); await page.screenshot({ path: SHOTS + name, timeout: 150000 }); console.log('  shot ' + name + ' (' + secs() + ')'); return SHOTS + name; };
const section = async (tag, fn) => { try { await fn(); } catch (e) { fails++; console.log('  ✗ section ' + tag + ': ' + String(e.stack || e.message).slice(0, 700)); } };
// the canvas alone (the 3-D picture), drawn now
const shotGL = async (name, n) => {
  const b64 = await ev((n) => { const g = VR.game; window.__norender = false; for (let i = 0; i < n; i++) { g.last = performance.now() - 33; window.__step(performance.now()); } g.renderer.gl.finish(); window.__norender = true; return g.canvas.toDataURL('image/png').split(',')[1]; }, n || 2);
  fs.writeFileSync(SHOTS + name, Buffer.from(b64, 'base64')); console.log('  shot ' + name + ' (' + secs() + ')'); return SHOTS + name;
};
const run = (n) => ev((n) => { const g = VR.game; window.__norender = true; for (let i = 0; i < n; i++) { g.last = performance.now() - 33; window.__step(performance.now()); } }, n);

await page.goto(DIST);
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
const pics = {};
await section('setup', async () => {
  check(await ev(() => !!(VR.A11y && VR.A11y.glyph && VR.Settings.byKey('lessMotion'))), 'VR.A11y and its rows are in the page');
  await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.camShake = false; g.applySettings('*'); if (VR.Hints) for (const h of ['play', 'move', 'fly', 'look', 'v']) { try { VR.Hints.done && VR.Hints.done(h); } catch (e) { /* */ } } });
  await ev(`VR.game.createWorld({name:'Zugang',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
  for (let i = 0; i < 200; i++) { await wait(500); if (await ev(() => VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)) break; }
  check(await ev(() => VR.game.state) === 'play', 'the world is open (' + secs() + ')');
  await ev(() => {
    const g = VR.game, L0 = Object.getPrototypeOf(g).loop;
    window.__step = (t) => L0.call(g, t); g.loop = function (t) { if (window.__live) return L0.call(this, t); };
    if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
    g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(5200); g.zenFreezeTime = true;
    if (g.renderer.q) g.renderer.q.upload = 24;
  });
  await run(90);
});

// ---------------------------------------------------------------- 1 · the limiter and the rows (numbers)
await section('limiter', async () => {
  const r = await ev(() => {
    const A = VR.A11y, w = VR.game.env.wx; A.limiter.reset(); let lit = 0;
    for (let i = 0; i < 10; i++) { w.strike(); if (w.flashK === 1) lit++; }
    const rows = A.ROWS.map(x => !!VR.Settings.byKey(x.key)).every(Boolean);
    return { lit, rows, mono: !!(VR.game.audio && (VR.game.audio.monoNode || !VR.game.audio.ctx)) };
  });
  check(r.lit === 1 && r.rows, `ten bolts forced at once: ${r.lit} lit (the stroke and its flicker are two of three)`, JSON.stringify(r));
});

// ---------------------------------------------------------------- 2 · the star jump, normal and with Weniger Bewegung
await section('jump', async () => {
  const C = await ev(() => {
    const g = VR.game, G = VR.Galaxy, N = VR.StarJump.hood(g), L = N.list, d0 = (s) => Math.hypot(...s.p);
    const k = L.filter(s => !s.home && !s.bin && s.neb < 0).sort((a, b) => d0(a) - d0(b))[0];
    const from = G.systemsNear(N, k.p, 30).find(q => q.idx !== k.idx && q.idx !== 0 && q.s.neb < 0);
    return { k: k.idx, from: from ? from.idx : 0 };
  });
  for (const mode of ['normal', 'reduced']) {
    const ok = await ev(([a, b, less]) => { const g = VR.game; g.settings.lessMotion = less; g.settings.fov = 75; if (g.stars && g.stars.on) VR.StarJump.leave(g); VR.StarJump.enter(g, a, { quiet: true }); return VR.StarJump.jump(g, b); }, [C.from, C.k, mode === 'reduced']);
    await run(2);
    const J = await ev(() => { const S = VR.game.stars; return { spin: S.J.spin, transit: S.J.transit, fade: !!S.fade }; });
    await run(Math.round((J.spin + J.transit * 0.5) / 0.033) - 2);
    const uf = await ev(() => ({ beta: VR.StarJump.UF.jump[0], black: VR.StarJump.UF.jump[3] }));
    if (mode === 'reduced') check(ok && J.fade && uf.beta === 0 && uf.black > 0.9, 'Weniger Bewegung: the jump is a fade (no bunching, the screen dark)', JSON.stringify(uf));
    else check(ok && !J.fade && uf.beta > 0.5, 'normal: the stars bunch (β at the transit)', JSON.stringify(uf));
    pics['jump_' + mode] = await shotGL('a11y_jump_' + mode + '.png', 2);
    await ev(() => { const g = VR.game; for (let n = 0; n < 900 && g.stars && g.stars.J; n++) { g.last = performance.now() - 33; window.__step(performance.now()); } if (g.stars && g.stars.on) VR.StarJump.leave(g); g.settings.lessMotion = false; });
  }
  await run(30);
});

// ---------------------------------------------------------------- 3 · the markers on the conquest map (and deuteranopia)
await section('markers', async () => {
  const ok = await ev(() => {
    const g = VR.game, A = VR.Adventure; if (!A || !VR.RPGame) return false;
    A.setOn(true); A.setEnc('normal');
    const rec = A.rec, R = VR.RPG, S = R.BAL.REGION, p = g.player.pos;
    const rx = Math.floor(p[0] / S) * S, rz = Math.floor(p[2] / S) * S, cl = (v, a) => Math.min(a + S - 60, Math.max(a + 60, v));
    rec.sites = rec.sites || {}; rec.freed = rec.freed || {};
    const put = (id, dx, dz, free) => { const x = Math.round(cl(p[0] + dx, rx)), z = Math.round(cl(p[2] + dz, rz)); if (free) rec.freed[id] = { day: 1, as: 'trade', x, y: 70, z, b: null, t: Date.now() }; else rec.sites[id] = { x, y: 70, z, dir: 0, n: 3, res: 0, cal: 0, st: 'stoer', day: null, t: 0 }; };
    put('t_f1', 150, 40, true); put('t_f2', -110, 150, true); put('t_k1', 260, -220, false); put('t_k2', -330, -160, false);
    VR.RPGame.open('map'); VR.RPGame.render(); return true;
  });
  check(ok, 'the conquest map is open (two freed, two disturbed outposts)');
  pics.markers = await shotPage('a11y_markers.png');
  await ev(() => { const g = VR.game; try { if (VR.RPGame.close) VR.RPGame.close(); } catch (e) { /* */ } g.ui.show(null); });
});

// ---------------------------------------------------------------- 4 · the HUD: a pad in use, high contrast
const stageHud = () => ev(() => {
  const g = VR.game, C = VR.Ctx;
  if (g.ui && g.ui.screen) g.ui.show(null);
  g.settings.hudMode = 'always'; g.hideHud = false;
  // the Aktion prompt: a villager to talk to (the thing in reach staged; the words and the key are the game's)
  C.gather = () => [];
  C.resolve = () => ({ id: 'talk', key: 'g.ctx.talk', vars: { name: 'Mara' }, row: 2 });
  VR.UX && VR.UX.tick && VR.UX.tick();
  for (let i = 0; i < 6; i++) { g.last = performance.now() - 33; window.__norender = i < 4; window.__step(performance.now()); }
  window.__norender = true; VR.A11y.tick(); VR.UX && VR.UX.tick && VR.UX.tick();
});
await section('pad', async () => {
  await ev(() => VR.A11y.setDevice('pad'));
  await stageHud(); await wait(600); await stageHud();
  const r = await ev(() => ({
    ctx: !!document.querySelector('#ctxprompt b.pad svg[data-b="2"]'), strip: document.querySelectorAll('#keystrip kbd.pad svg').length, keys: document.querySelectorAll('#keystrip kbd:not(.pad)').length,
    bump: !!document.querySelector('#a11ybump.on'), cls: document.documentElement.classList.contains('a11y-pad'),
  }));
  check(r.ctx && r.strip >= 2 && r.keys === 0 && r.bump && r.cls, 'a pad in use: the Aktion with X, the strip with glyphs only, LB / RB beside the hotbar', JSON.stringify(r));
  pics.pad = await shotPage('gamepad_prompts.png');
  await ev(() => VR.A11y.setDevice('kb')); await stageHud(); await wait(300);
  const k = await ev(() => ({ ctx: (document.querySelector('#ctxprompt b') || {}).textContent || '', bump: !!document.querySelector('#a11ybump.on') }));
  check(k.ctx === '[V]' && !k.bump, 'a key again: [V] and no bumpers', JSON.stringify(k));
});
await section('contrast', async () => {
  pics.hcNormal = await shotPage('high_contrast_hud_normal.png');
  await ev(() => { const g = VR.game; g.settings.highContrast = true; g.settings.textSize = 1.25; VR.A11y.tick(); });
  await stageHud(); await wait(300);
  const r = await ev(() => { const de = document.documentElement, p = document.getElementById('ctxprompt'), cs = p ? getComputedStyle(p) : null; return { hc: de.classList.contains('a11y-hc'), text: de.classList.contains('a11y-text'), bg: cs ? cs.backgroundColor : '', zoom: cs ? cs.zoom : '' }; });
  check(r.hc && r.text && /rgb\(0, 0, 0\)/.test(r.bg) && +r.zoom > 1.2, 'high contrast and Aa 125 %: the prompt on black, bigger', JSON.stringify(r));
  pics.hc = await shotPage('high_contrast_hud.png');
  await ev(() => { const g = VR.game; g.settings.highContrast = false; g.settings.textSize = 1; VR.A11y.tick(); });
});

// ---------------------------------------------------------------- 5 · ⚙ Zugänglichkeit, Ein-Hand, mono
await section('onehand', async () => {
  const r = await ev(() => {
    const g = VR.game, A = VR.A11y; g.settings.oneHand = 'keys'; A.tick();
    const k = VR.Binds.current.slots('fwd')[0]; g.settings.oneHand = 'off'; A.tick();
    const back = VR.Binds.current.slots('fwd')[0];
    g.settings.monoAudio = true; A.tick(); const au = g.audio, mono = au && au.monoNode ? au.monoNode.channelCount : -1; g.settings.monoAudio = false; A.tick();
    return { k, back, mono, hasCtx: !!(au && au.ctx) };
  });
  check(r.k === 'ArrowUp' && r.back === 'KeyW', 'Ein-Hand · Tastatur: the arrows walk; off: W again', JSON.stringify(r));
  check(!r.hasCtx || r.mono === 1, 'mono: the master bus has one channel', JSON.stringify(r));
  await ev(() => { const g = VR.game; g.settings.oneHand = 'mouse'; g.settings.lessMotion = true; g.ui.showSettings('play'); });
  await wait(500);
  await ev(() => { const h = [...document.querySelectorAll('#ui h3')].find(e => /Zugänglichkeit/.test(e.textContent)); if (h) h.scrollIntoView({ block: 'start' }); });
  const has = await ev(() => [...document.querySelectorAll('#ui h3')].some(e => /Zugänglichkeit/.test(e.textContent)));
  check(has, '⚙ Spiel shows the section „Zugänglichkeit"');
  pics.onehand = await shotPage('a11y_onehand.png');
  await ev(() => { const g = VR.game; g.settings.oneHand = 'off'; g.settings.lessMotion = false; g.ui.show(null); });
});

// ---------------------------------------------------------------- 6 · the frame's cost: every switch on vs off, Very Low and High
const cost = {};
await section('cost', async () => {
  for (const preset of ['potato', 'high']) {
    cost[preset] = await ev((p) => {
      const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.applySettings('*'); window.__norender = false;
      const on = (v) => { Object.assign(g.settings, { lessMotion: v, highContrast: v, textSize: v ? 1.25 : 1, monoAudio: v, oneHand: v ? 'mouse' : 'off', subSpeed: v ? 1.5 : 1 }); VR.A11y.tick(); };
      const one = (n) => { const t = []; for (let i = 0; i < n; i++) { const t0 = performance.now(); g.last = t0 - 33; window.__step(t0); g.renderer.gl.finish(); t.push(performance.now() - t0); } t.sort((a, b) => a - b); return +t[t.length >> 1].toFixed(1); };
      one(6); const R = { off: [], on: [] };
      for (let k = 0; k < 2; k++) { on(false); R.off.push(one(10)); on(true); R.on.push(one(10)); }
      on(false); window.__norender = true;
      const med = (a) => +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(1);
      return { off: med(R.off), on: med(R.on) };
    }, preset);
    console.log(`  cost ${preset}: frame ${cost[preset].off} ms off · ${cost[preset].on} ms with every switch on (${secs()})`);
  }
  check(cost.potato && cost.potato.on <= cost.potato.off * 1.08 + 2, `Very Low does not get slower with the switches (${JSON.stringify(cost.potato)})`);
});

// ---------------------------------------------------------------- the deutan picture and the sheet (python, after the browser)
await browser.close();
try {
  if (pics.markers) {
    const py = `import sys\nfrom PIL import Image\nimport numpy as np\nM=np.array([[0.367322,0.860646,-0.227968],[0.280085,0.672501,0.047413],[-0.011820,0.042940,0.968881]])\nim=np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(np.float64)/255\nl=np.where(im<=0.04045,im/12.92,((im+0.055)/1.055)**2.4)\nd=np.clip(l@M.T,0,1)\ns=np.where(d<=0.0031308,d*12.92,1.055*d**(1/2.4)-0.055)\nImage.fromarray((s*255+0.5).astype(np.uint8)).save(sys.argv[2])\n`;
    fs.writeFileSync(ROOT + '.tmp_tests/deutan.py', py);
    execFileSync('python3', [ROOT + '.tmp_tests/deutan.py', pics.markers, SHOTS + 'a11y_markers_deutan.png']);
    pics.deutan = SHOTS + 'a11y_markers_deutan.png'; console.log('  shot a11y_markers_deutan.png (simulated)');
  }
  const rows = [];
  if (pics.jump_normal || pics.jump_reduced) rows.push({ label: 'Sternsprung — normal | Weniger Bewegung (Überblendung)', imgs: [pics.jump_normal, pics.jump_reduced].filter(Boolean) });
  if (pics.markers) rows.push({ label: 'Eroberungskarte — normal | Deuteranopie simuliert (◆ „!" gestört, ◆ ✓ befreit)', imgs: [pics.markers, pics.deutan].filter(Boolean) });
  if (pics.pad) rows.push({ label: 'Controller: X = Aktion, A / Y / Ansicht in der Leiste, LB / RB an der Leiste', imgs: [pics.pad] });
  if (pics.hc) rows.push({ label: 'HUD — normal | hoher Kontrast + Text 125 %', imgs: [pics.hcNormal, pics.hc].filter(Boolean) });
  if (pics.onehand) rows.push({ label: '⚙ Spiel · Zugänglichkeit (Ein-Hand: Nur Maus, Weniger Bewegung an)', imgs: [pics.onehand] });
  fs.writeFileSync(ROOT + '.tmp_tests/a11y_sheet.json', JSON.stringify({ w: 620, rows }));
  execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'a11y_sheet.jpg', ROOT + '.tmp_tests/a11y_sheet.json']);
  check(fs.existsSync(SHOTS + 'a11y_sheet.jpg'), 'the sheet test/shots/a11y_sheet.jpg');
} catch (e) { fails++; console.log('  ✗ the deutan picture / the sheet: ' + String(e.message || e).slice(0, 400)); }
fs.writeFileSync(ROOT + '.tmp_tests/a11y_run.json', JSON.stringify({ cost, pics }, null, 1));
console.log(`--- logs (${logs.length})`); for (const l of logs.slice(0, 12)) console.log(l);
check(!logs.some(l => l.startsWith('[pageerror]')), `no page error (${logs.filter(l => l.startsWith('[pageerror]')).length})`);
console.log(`(${secs()})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
