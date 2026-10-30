// regress: skip — f-first2 debug probe: why W does not move the player after a fresh „Neue Welt" (seed 4242)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
const ROOT = new URL('../', import.meta.url).pathname;
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
await ctx.addInitScript(() => { try { if (!localStorage.getItem('r9si.settings')) localStorage.setItem('r9si.settings', JSON.stringify({ preset: 'balanced', dynRes: false })); } catch (e) { /* */ } });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('  pageerror ' + String(e.message).slice(0, 200)));
const ev = (fn, a) => page.evaluate(fn, a); const wait = (ms) => page.waitForTimeout(ms);
const until = async (st, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(() => VR.game && VR.game.state).catch(() => null) === st) return true; await wait(400); } return false; };
await page.goto('file://' + ROOT + 'dist/index.html'); await until('title', 240000); await wait(3000);
await page.click('#title [data-act="newworld"]'); await wait(1500);
await ev(() => { const s = document.getElementById('cw_seed'); if (s) { s.value = '4242'; s.dispatchEvent(new Event('input')); } });
await page.click('#create .btn.primary'); await until('play', 300000);
await ev(() => { window.__raf = 0; const f = () => { window.__raf++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
const diag = () => ev(() => { const g = VR.game, p = g.player, i = g.input, a = document.activeElement;
  const R = VR.R, w = g.world, f = (x, y, z) => { const b = w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return R.T.name ? R.T.name[b] : b; };
  return { st: g.state, scr: g.ui.screen, typ: g.ui.typing, blk: g.ui.blocking, menu: i.menuOpen, en: i.enabled, cap: i.captured, keys: [...i.keys], downW: i.down('KeyW'),
    pos: p.pos.map(v => +v.toFixed(2)), vel: p.vel.map(v => +v.toFixed(2)), yaw: +p.yaw.toFixed(2), arr: !!g.arrival, wow: !!(g.wow && g.wow.active), focus: a && a.tagName + '#' + a.id,
    f2: VR.First2 && VR.First2.moved, feet: f(p.pos[0], p.pos[1] + 0.1, p.pos[2]), below: f(p.pos[0], p.pos[1] - 0.5, p.pos[2]), loaded: w.isLoaded && w.isLoaded(Math.floor(p.pos[0]), Math.floor(p.pos[2])),
    flags: Object.keys(p).filter(k => typeof p[k] === 'boolean' && p[k]).join(','), seat: !!(p.seat || p.sitting || p.riding || p.vehicle), frame: g.frame, glLost: !!g.glLost, raf: window.__raf, ctxLost: g.gl && g.gl.isContextLost && g.gl.isContextLost(), mode: g.mode || (g.meta && g.meta.mode), fps: g.fps || null }; });
for (let t = 0; t < 3; t++) {
  console.log('  t' + t * 5 + ' ' + JSON.stringify(await diag()).slice(0, 900));
  await page.keyboard.down('KeyW'); await wait(1500); console.log('  W  ' + JSON.stringify(await diag()).slice(0, 500)); await page.keyboard.up('KeyW'); await wait(3500);
}

await browser.close(); console.log('ALL OK');
