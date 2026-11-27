// Sofort spielen (v0.56.9): a first visit goes straight into „Meine Welt" — no start screen, no click, no slow arrival;
// a second visit shows the start screen as before. (An automated browser keeps the start screen unless the page sets
// window.R9_AUTOSTART: this test sets it, as a person's browser behaves.)
//  a · the first visit: boot → loading → play, never the start screen, no click; the world „Meine Welt" (Zen); within a
//      second of play the player moves (no arrival holding the view); the welcome line, not the Zen explanation
//  b · the same browser again: the start screen, no new world
//   nohup bash test/wt_run.sh instant.mjs 900 > .tmp_tests/instant.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
const ROOT = new URL('../', import.meta.url).pathname;
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, locale: 'de-DE' });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));
await ctx.addInitScript(() => {
  window.R9_AUTOSTART = true;
  window.__states = []; window.__chat = [];
  const iv = setInterval(() => {
    const g = window.VR && VR.game; if (!g) return;
    const st = g.state; if (window.__states[window.__states.length - 1] !== st) window.__states.push(st);
    if (g.ui && !g.ui.__hk && VR.UI) { g.ui.__hk = true; const f = g.ui.chatLine.bind(g.ui); g.ui.chatLine = (t, c) => { window.__chat.push(String(t)); return f(t, c); }; }
  }, 25);
});
const T0 = Date.now();
await page.goto('file://' + ROOT + 'dist/index.html', { waitUntil: 'commit', timeout: 120000 });
console.log('a · the first visit');
let play = false;
for (let i = 0; i < 600; i++) { await page.waitForTimeout(250); if (await page.evaluate(() => !!(window.VR && VR.game && VR.game.state === 'play')).catch(() => false)) { play = true; break; } }
const tPlay = (Date.now() - T0) / 1000;
const r = await page.evaluate(() => ({ states: window.__states.join(' → '), name: VR.game.meta && VR.game.meta.name, mode: VR.game.player && VR.game.player.mode, inst: !!VR.game.instantStart }));
check(play, `in play without a click (${tPlay.toFixed(1)} s on this software GPU)`, r.states);
check(!/title/.test(r.states), 'never the start screen', r.states);
check(r.name === 'Meine Welt' && r.mode === 'zen' && r.inst, `the world „${r.name}", ${r.mode}`);
// the arrival lets go at once: the player moves under a held W within about a second of play
const mv = await page.evaluate(async () => {
  const g = VR.game, p = g.player, x0 = p.pos[0], z0 = p.pos[2];
  const t0 = performance.now(); let held = 0;
  while (g.arrival && g.arrival.holds && g.arrival.holds() && performance.now() - t0 < 5000) { await new Promise((res) => setTimeout(res, 50)); held = performance.now() - t0; }
  return { held: Math.round(held), x0, z0 };
});
check(mv.held < 1500, `the arrival holds the view ${mv.held} ms at most (no swing to wait through)`);
await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
const moved = await page.evaluate(([x0, z0]) => Math.hypot(VR.game.player.pos[0] - x0, VR.game.player.pos[2] - z0), [mv.x0, mv.z0]);
check(moved > 0.5, `W walks at once (${moved.toFixed(1)} blocks)`);
const chat = await page.evaluate(() => window.__chat.slice());
check(chat.some((l) => /Willkommen|Welcome/.test(l)) && !chat.some((l) => /Zen-Bauen|Zen building/.test(l)), 'the welcome line, not the Zen explanation', chat.join(' | ').slice(0, 160));

console.log('b · the same browser again');
await page.evaluate(() => VR.game.saveAndQuit ? VR.game.saveAndQuit() : null).catch(() => null);
await page.waitForTimeout(1500);
const page2 = await ctx.newPage();
page2.on('pageerror', (e) => errs.push(String(e.message).slice(0, 200)));
await page.close();
await page2.goto('file://' + ROOT + 'dist/index.html', { waitUntil: 'commit', timeout: 120000 });
let title = false;
for (let i = 0; i < 240; i++) { await page2.waitForTimeout(250); const st = await page2.evaluate(() => window.VR && VR.game && VR.game.state).catch(() => null); if (st === 'title') { title = true; break; } if (st === 'play' || st === 'loading') break; }
check(title, 'the start screen again (something was played here)', await page2.evaluate(() => window.__states.join(' → ')).catch(() => '?'));
check(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '));
await browser.close();
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
