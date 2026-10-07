// The block texture cache in the browser (v0.40). Start 1 forges the block textures and keeps them in IndexedDB. A reload
// takes them from there (VR.game.texFromCache): the texture step and the first frame of a world come sooner, and the
// bytes are the same. A start with IndexedDB blocked forges again: the same bytes, no error. A look switch
// (Klassisch → Nahtlos → Klassisch → Nahtlos) forges each look once and reads the rest from the cache.
// Times: VR.game.texMs (the texture step), navigation → title screen, navigation → first frame of a world.
// Run in the background (the browser lock may wait for other agents):
//   nohup bash test/wt_run.sh texcache.mjs 1500 > .tmp_tests/texcache.log 2>&1 &
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { execFileSync } from 'child_process';
execFileSync(process.execPath, ['build.js'], { cwd: '/home/claude/vr', stdio: 'inherit' });
const URL = 'file:///home/claude/vr/dist/index.html';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const VIEW = { viewport: { width: 1280, height: 720 } };
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
async function boot(page, t0) {
  await until(page, () => !!(window.VR && VR.game && VR.game.state === 'title' && VR.game.tex), 'the title screen');
  return { title: Date.now() - t0, ...(await texState(page)) };
}
async function firstWorldFrame(page, t0) {
  await page.evaluate(() => { VR.game.createWorld({ name: 'Cache', mode: 'survival', difficulty: 'normal', type: 'default', seed: '424242', cheats: true, kit: true }); });
  await until(page, () => VR.game.state === 'play' && VR.game.frame >= 3, 'the first frame of the world', 480);
  return Date.now() - t0;
}
// the keys of the cache database, read from the page (the same origin as the game)
const cacheKeys = (page) => page.evaluate(() => new Promise((res) => {
  try {
    const r = indexedDB.open('r9si-cache');
    r.onsuccess = () => { const db = r.result; try { const q = db.transaction('tex').objectStore('tex').getAllKeys(); q.onsuccess = () => { res(q.result); db.close(); }; q.onerror = () => res(null); } catch (e) { res(null); } };
    r.onerror = () => res(null);
  } catch (e) { res(null); }
}));

// ---- start 1: nothing cached yet, the textures are forged and kept
const ctx = await browser.newContext(VIEW);
let page = await open(ctx, 'start1');
let t0 = Date.now();
await page.goto(URL);
const s1 = await boot(page, t0);
const d1 = await digest(page);
const w1 = await firstWorldFrame(page, t0);
console.log('start 1 ' + JSON.stringify({ fromCache: s1.fromCache, texMs: s1.texMs, titleMs: s1.title, worldMs: w1, layers: s1.layers }));
check(s1.fromCache === false && s1.layers > 0, 'start 1 forges the block textures (nothing cached yet)');
const keys1 = await cacheKeys(page);
check(Array.isArray(keys1) && keys1.includes('rim-1'), 'the forged textures are stored in IndexedDB: ' + JSON.stringify(keys1));

// ---- start 2: the same page reloaded: the textures come from the cache
t0 = Date.now();
await page.reload();
const s2 = await boot(page, t0);
const d2 = await digest(page);
const w2 = await firstWorldFrame(page, t0);
console.log('start 2 ' + JSON.stringify({ fromCache: s2.fromCache, texMs: s2.texMs, titleMs: s2.title, worldMs: w2, layers: s2.layers }));
check(s2.fromCache === true, 'a reload takes the textures from the cache (VR.game.texFromCache)');
check(d2 === d1, 'the cached textures are the same bytes as the forged ones');
check(s2.texMs < s1.texMs, 'the texture step is faster from the cache (' + s2.texMs + ' ms against ' + s1.texMs + ' ms)');
check(w2 < w1, 'the first frame of the world comes sooner (' + w2 + ' ms against ' + w1 + ' ms)');

// ---- the look switch: each look is forged once, then read from the cache
await page.evaluate(() => VR.game.lookCommand('seamless'));
await until(page, () => VR.game.texRim === false, 'the Nahtlos textures');
const sS = await texState(page), dS = await digest(page);
await page.evaluate(() => VR.game.lookCommand('classic'));
await until(page, () => VR.game.texRim === true, 'the Klassisch textures');
const sC = await texState(page), dC = await digest(page);
await page.evaluate(() => VR.game.lookCommand('seamless'));
await until(page, () => VR.game.texRim === false, 'the Nahtlos textures again');
const sS2 = await texState(page), dS2 = await digest(page);
console.log('looks ' + JSON.stringify({ seamless: [sS.fromCache, sS.texMs], classic: [sC.fromCache, sC.texMs], seamlessAgain: [sS2.fromCache, sS2.texMs] }));
check(sS.fromCache === false && sC.fromCache === true && sS2.fromCache === true, 'the look switch forges Nahtlos once; Klassisch and Nahtlos again come from the cache');
check(dS !== d1 && dC === d1 && dS2 === dS, 'each look shows its own textures, the same bytes every time');
const keys2 = await cacheKeys(page);
check(Array.isArray(keys2) && keys2.includes('rim-1') && keys2.includes('seam-1'), 'both looks are kept: ' + JSON.stringify(keys2));
await page.close();

// ---- IndexedDB blocked (a private window that refuses it): the textures are forged again, the same bytes, no error
const ctxB = await browser.newContext(VIEW);
await ctxB.addInitScript(() => {
  try { Object.defineProperty(window, 'indexedDB', { configurable: true, get: () => undefined }); } catch (e) { /* not configurable here */ }
  try { IDBFactory.prototype.open = function () { throw new DOMException('storage blocked', 'SecurityError'); }; } catch (e) { /* */ }
  window.__idbOff = typeof indexedDB === 'undefined' || (() => { try { indexedDB.open('probe'); return false; } catch (e) { return true; } })();
});
const pageB = await open(ctxB, 'blocked');
t0 = Date.now();
await pageB.goto(URL);
const idbOff = await pageB.evaluate(() => window.__idbOff);
const sB = await boot(pageB, t0);
const dB = await digest(pageB);
const wB = await firstWorldFrame(pageB, t0);
console.log('blocked ' + JSON.stringify({ fromCache: sB.fromCache, texMs: sB.texMs, titleMs: sB.title, worldMs: wB }));
check(idbOff === true, 'IndexedDB refuses to open in this context');
check(sB.fromCache === false && dB === d1, 'with IndexedDB refused the textures are forged again, the same bytes');
await pageB.close();
await ctxB.close();
await ctx.close();

// ---- the errors: no page error, nothing from the texture cache
const pageErrors = errors.filter((e) => /pageerror/.test(e));
const cacheErrors = errors.filter((e) => /r9si-cache|texture|tex_cache|TexCache|Forging/i.test(e));
check(pageErrors.length === 0, 'no page errors in any start (' + pageErrors.length + ')');
check(cacheErrors.length === 0, 'the texture cache logs no error (' + cacheErrors.length + ')');
if (errors.length) console.log('--- console and page messages (' + errors.length + ')\n' + errors.slice(0, 20).join('\n'));

await browser.close();
console.log(fail ? fail + ' FAILED' : 'all texture cache checks passed');
process.exit(fail ? 1 : 0);
