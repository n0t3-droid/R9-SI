// The block texture cache in the browser (v0.40). Start 1 forges the block textures and keeps them in IndexedDB. Start 2 is
// a new browser launch on the same profile, as a player's next start is: the textures come from the cache
// (VR.game.texFromCache), the texture step takes a fraction of the forge, and the bytes are the same. The look switch
// (Klassisch → Nahtlos → Klassisch → Nahtlos) forges each look once and reads the rest from the cache. A start with
// IndexedDB refused forges again: the same bytes, no error. Times are on each page's own clock (performance.now() counts
// from its navigation): the world store open, the texture step, the title screen, the first frame of a world.
// Run in the background (the browser lock may wait for other agents):
//   nohup bash test/wt_run.sh texcache.mjs 1500 > .tmp_tests/texcache.log 2>&1 &
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { execFileSync } from 'child_process';
import { rmSync } from 'fs';
execFileSync(process.execPath, ['build.js'], { cwd: '/home/claude/vr', stdio: 'inherit' });
const URL = 'file:///home/claude/vr/dist/index.html';
const PROFILE = '/home/claude/vr/.tmp_tests/texcache_profile';   // one profile: IndexedDB survives between the launches
rmSync(PROFILE, { recursive: true, force: true });
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'];
const VIEW = { viewport: { width: 1280, height: 720 } };
const launch = () => chromium.launchPersistentContext(PROFILE, { channel: 'chromium', args: ARGS, ...VIEW });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const check = (ok, what) => { console.log((ok ? 'OK   ' : 'FAIL ') + what); if (!ok) fail++; };
const errors = [];
const open = async (ctx, label) => {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror ${(e.stack || e.message).slice(0, 600)}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${label}] console ${m.text().slice(0, 300)}`); });
  return page;
};
async function until(page, fn, what, max = 240) {
  for (let i = 0; i < max; i++) { if (await page.evaluate(fn)) return true; await sleep(250); }
  console.log('  timeout waiting for ' + what); return false;
}
// the bytes the renderer uploads: every albedo and material level, the averages, the noise
const digest = (page) => page.evaluate(async () => {
  const t = VR.game.tex, parts = [...t.albedo, ...t.material, t.avgColor, t.noise];
  let n = 0; for (const a of parts) n += a.byteLength;
  const buf = new Uint8Array(n); let o = 0;
  for (const a of parts) { buf.set(new Uint8Array(a.buffer, a.byteOffset, a.byteLength), o); o += a.byteLength; }
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
  return Array.from(h.slice(0, 10), (b) => b.toString(16).padStart(2, '0')).join('');
});
const texState = (page) => page.evaluate(() => ({ fromCache: VR.game.texFromCache, texMs: VR.game.texMs, rim: VR.game.texRim, layers: VR.game.tex && VR.game.tex.layers }));
// the time (ms, the page's clock) when a condition first holds; -1 when it never does
async function untilAt(page, expr, what, max = 240) {
  for (let i = 0; i < max; i++) {
    const at = await page.evaluate((e) => ((new Function('return (' + e + ')'))() ? performance.now() : null), expr);
    if (at !== null) return Math.round(at);
    await sleep(250);
  }
  console.log('  timeout waiting for ' + what); return -1;
}
async function boot(page, withStore = true) {
  const storeAt = withStore ? await untilAt(page, "!!(window.VR && VR.game && VR.game.store && VR.game.store.ok)", 'the world store') : null;
  const title = await untilAt(page, "!!(window.VR && VR.game && VR.game.state === 'title' && VR.game.tex)", 'the title screen');
  const load = await page.evaluate(() => Math.round(performance.getEntriesByType('navigation')[0].loadEventEnd));
  return { storeAt, title, load, ...(await texState(page)) };
}
async function firstWorldFrame(page) {
  await page.evaluate(() => { VR.game.createWorld({ name: 'Cache', mode: 'survival', difficulty: 'normal', type: 'default', seed: '424242', cheats: true, kit: true }); });
  return untilAt(page, "VR.game.state === 'play' && VR.game.frame >= 3", 'the first frame of the world', 480);
}
// the keys of the cache database, read from the page (the same origin as the game)
const cacheKeys = (page) => page.evaluate(() => new Promise((res) => {
  try {
    const r = indexedDB.open('r9si-cache');
    r.onsuccess = () => { const db = r.result; try { const q = db.transaction('tex').objectStore('tex').getAllKeys(); q.onsuccess = () => { res(q.result); db.close(); }; q.onerror = () => res(null); } catch (e) { res(null); } };
    r.onerror = () => res(null);
  } catch (e) { res(null); }
}));

// ---- start 1: an empty profile: the textures are forged and kept
let ctx = await launch();
let page = await open(ctx, 'start1');
await page.goto(URL);
const s1 = await boot(page);
const d1 = await digest(page);
const w1 = await firstWorldFrame(page);
console.log('start 1 ' + JSON.stringify({ fromCache: s1.fromCache, texMs: s1.texMs, storeMs: s1.storeAt, titleMs: s1.title, worldMs: w1, loadMs: s1.load }));
check(s1.fromCache === false && s1.layers > 0, 'start 1 forges the block textures (nothing cached yet)');
const keys1 = await cacheKeys(page);
check(Array.isArray(keys1) && keys1.includes('rim-1'), 'the forged textures are stored in IndexedDB: ' + JSON.stringify(keys1));
await ctx.close();

// ---- start 2: a new launch on the same profile: the textures come from the cache
ctx = await launch();
page = await open(ctx, 'start2');
await page.goto(URL);
const s2 = await boot(page);
const d2 = await digest(page);
const w2 = await firstWorldFrame(page);
console.log('start 2 ' + JSON.stringify({ fromCache: s2.fromCache, texMs: s2.texMs, storeMs: s2.storeAt, titleMs: s2.title, worldMs: w2, loadMs: s2.load }));
check(s2.fromCache === true, 'a new start takes the textures from the cache (VR.game.texFromCache)');
check(d2 === d1, 'the cached textures are the same bytes as the forged ones');
check(s2.texMs < s1.texMs, 'the texture step is faster from the cache (' + s2.texMs + ' ms against ' + s1.texMs + ' ms)');
check(w2 < w1, 'the first frame of the world comes sooner (' + w2 + ' ms against ' + w1 + ' ms)');

// ---- the look switch: each look is forged once, then read from the cache (the start is Nahtlos since v0.43)
await page.evaluate(() => VR.game.lookCommand('classic'));
await until(page, () => VR.game.texRim === true, 'the Klassisch textures');
const sC = await texState(page), dC = await digest(page);
await page.evaluate(() => VR.game.lookCommand('seamless'));
await until(page, () => VR.game.texRim === false, 'the Nahtlos textures');
const sS = await texState(page), dS = await digest(page);
await page.evaluate(() => VR.game.lookCommand('classic'));
await until(page, () => VR.game.texRim === true, 'the Klassisch textures again');
const sC2 = await texState(page), dC2 = await digest(page);
console.log('looks ' + JSON.stringify({ classic: [sC.fromCache, sC.texMs], seamless: [sS.fromCache, sS.texMs], classicAgain: [sC2.fromCache, sC2.texMs] }));
check(sC.fromCache === false && sS.fromCache === true && sC2.fromCache === true, 'the look switch forges Klassisch once; Nahtlos and Klassisch again come from the cache');
check(dC !== d1 && dS === d1 && dC2 === dC, 'each look shows its own textures, the same bytes every time');
const keys2 = await cacheKeys(page);
check(Array.isArray(keys2) && keys2.includes('rim-1') && keys2.includes('seam-1'), 'both looks are kept: ' + JSON.stringify(keys2));
await page.close();
await ctx.close();

// ---- IndexedDB refused (a private window that refuses it): the textures are forged again, the same bytes, no error
const browser = await chromium.launch({ channel: 'chromium', args: ARGS });
const ctxB = await browser.newContext(VIEW);
await ctxB.addInitScript(() => {
  try { Object.defineProperty(window, 'indexedDB', { configurable: true, get: () => undefined }); } catch (e) { /* not configurable here */ }
  try { IDBFactory.prototype.open = function () { throw new DOMException('storage blocked', 'SecurityError'); }; } catch (e) { /* */ }
  window.__idbOff = typeof indexedDB === 'undefined' || (() => { try { indexedDB.open('probe'); return false; } catch (e) { return true; } })();
});
const pageB = await open(ctxB, 'blocked');
await pageB.goto(URL);
const idbOff = await pageB.evaluate(() => window.__idbOff);
const sB = await boot(pageB, false);
const dB = await digest(pageB);
const wB = await firstWorldFrame(pageB);
console.log('blocked ' + JSON.stringify({ fromCache: sB.fromCache, texMs: sB.texMs, titleMs: sB.title, worldMs: wB, loadMs: sB.load }));
check(idbOff === true, 'IndexedDB refuses to open in this context');
check(sB.fromCache === false && dB === d1, 'with IndexedDB refused the textures are forged again, the same bytes');
await pageB.close();
await ctxB.close();
await browser.close();

// ---- the errors: no page error, nothing from the texture cache
const pageErrors = errors.filter((e) => /pageerror/.test(e));
const cacheErrors = errors.filter((e) => /r9si-cache|texture|tex_cache|TexCache|Forging/i.test(e));
check(pageErrors.length === 0, 'no page errors in any start (' + pageErrors.length + ')');
check(cacheErrors.length === 0, 'the texture cache logs no error (' + cacheErrors.length + ')');
if (errors.length) console.log('--- console and page messages (' + errors.length + ')\n' + errors.slice(0, 20).join('\n'));

console.log(fail ? 'FAILED ' + fail : 'all texture cache checks passed\nALL OK');
process.exit(fail ? 1 : 0);
