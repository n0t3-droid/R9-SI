// w-golden · the monkey (docs/superpowers/plans/2026-11-02-w-golden.md): a bot that plays like a child at the keyboard —
// seeded random input (MONKEY_SEED, default 1) on the real game loop (the page's own frames, not stepped): walk (WASD,
// held 0.2–1.5 s), sprint, jump, fly (creative: double Space), look (mouse moves), break / place (left / right click,
// only while no menu is open — a click in a menu might quit or delete), the keys E (inventory), V (the action key),
// M (the map), J (the journal), O (the star map), Esc (pause / close), F5 (the camera), number keys; MONKEY_S seconds
// (default 180) on a new default world (seed 4242, creative, peaceful, Very Low, view 3, 640 × 360, de-DE — run 1 at
// 960 × 540, view 5 drew 46 frames in two minutes on SwiftShader: the bot pressed keys into a slide show); then a marker block set,
// the world saved, the page reloaded, the world opened again from the list, the marker and the position checked, and
// 30 s more of the same.
//   fail on: a page error; a soft-lock (the game drew no frame for 10 s, or the page did not answer); a NaN position
//   or velocity; the world missing from the list after the reload, the marker gone, the player > 3 m from where he was
//   saved; the game not in play at the end (a menu open is fine).   → .tmp_tests/monkey_run.json, test/shots/monkey_*.png
//   usage: nohup bash test/wt_run.sh monkey.mjs 1200 > .tmp_tests/monkey.log 2>&1 &   (MONKEY_S=60 for a short one)
// regress: skip  (the release gate runs it: test/release_gate.sh)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname;
const DIST = process.env.DIST || 'file://' + ROOT + 'dist/index.html';
const SHOTS = ROOT + 'test/shots/';
const SEED = +(process.env.MONKEY_SEED || 1), DUR = +(process.env.MONKEY_S || 180), DUR2 = +(process.env.MONKEY_S2 || 30);
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let a = SEED >>> 0 || 1;
const rnd = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const run = { seed: SEED, actions: {}, worst: 0, errors: [] };
const save = () => { try { fs.writeFileSync(ROOT + '.tmp_tests/monkey_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 }, locale: 'de-DE' });
page.on('pageerror', e => { run.pageErrors = (run.pageErrors || 0) + 1; run.errors.push('pageerror: ' + (e.stack || e.message).slice(0, 1200)); console.log('  [pageerror] ' + (e.message || '').slice(0, 300)); });
page.on('dialog', d => d.dismiss().catch(() => {}));   // (a confirm() the bot opened: no)
await page.goto(DIST);
const wait = (ms) => page.waitForTimeout(ms);
// an evaluate that may not hang the bot: a page that does not answer in 10 s is a soft-lock
const ev = (fn, arg, ms = 10000) => Promise.race([page.evaluate(fn, arg), new Promise((_, rej) => setTimeout(() => rej(new Error('the page did not answer in ' + ms / 1000 + ' s')), ms))]);
const untilState = async (st, s = 120) => { for (let i = 0; i < s * 2; i++) { await wait(500); try { if (await ev((st) => !!VR.game && VR.game.state === st, st)) return true; } catch (e) { /* booting */ } } return false; };
// the frame counter: every game frame the page draws (the instance's loop, which the rAF chain calls)
const hook = () => ev(() => { const g = VR.game; if (g.__mk) return; g.__mk = true; window.__gf = 0; const o = g.loop; g.loop = function (t) { window.__gf++; return o.call(this, t); }; });
const probe = () => ev(() => { const g = VR.game, p = g.player; return { f: window.__gf, st: g.state, screen: g.ui ? g.ui.screen || null : null, pos: p ? Array.from(p.pos) : null, vel: p && p.vel ? Array.from(p.vel) : null, dim: g.dim }; });
const KEYS = { E: 'KeyE', V: 'KeyV', M: 'KeyM', J: 'KeyJ', O: 'KeyO', Esc: 'Escape', F5: 'F5', n: 'Digit3' };
const MOVES = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
let lastF = -1, lastFT = Date.now(), soft = 0, nan = 0;
async function watch(tag) {
  let s;
  try { s = await probe(); } catch (e) { soft++; run.errors.push(tag + ': ' + e.message); console.log('  !! ' + tag + ': ' + e.message); return null; }
  const now = Date.now();
  if (s.f !== lastF) { lastF = s.f; lastFT = now; }
  else if (now - lastFT > 10000 && s.st === 'play') { soft++; run.errors.push(`${tag}: no frame for ${((now - lastFT) / 1000).toFixed(0)} s (state ${s.st}, screen ${s.screen})`); console.log('  !! no frame for 10 s'); lastFT = now; }
  run.worst = Math.max(run.worst, now - lastFT);
  const bad = (v) => v && v.some(x => !Number.isFinite(x));
  if (bad(s.pos) || bad(s.vel)) { nan++; run.errors.push(`${tag}: NaN ${JSON.stringify(s.pos)} ${JSON.stringify(s.vel)}`); console.log('  !! NaN', JSON.stringify(s)); }
  return s;
}
async function act(s) {
  const r = rnd(), count = (k) => { run.actions[k] = (run.actions[k] || 0) + 1; };
  const menu = s && s.screen && s.screen !== 'hud';   // ('hud' is the game itself, no menu)
  if (r < 0.34) { const k = pick(MOVES); count('walk'); await page.keyboard.down(k); if (rnd() < 0.3) await page.keyboard.down('ControlLeft'); await wait(200 + rnd() * 1300); await page.keyboard.up(k); await page.keyboard.up('ControlLeft'); }
  else if (r < 0.46) { count('look'); const dx = (rnd() - 0.5) * 300, dy = (rnd() - 0.5) * 120; await page.mouse.move(320, 180); await page.mouse.move(320 + dx, 180 + dy, { steps: 6 }); }
  else if (r < 0.55) { count('jump'); await page.keyboard.press('Space'); if (rnd() < 0.3) { await wait(120); await page.keyboard.press('Space'); count('fly'); } }
  else if (r < 0.67) { if (menu) { count('menu-skip-click'); await page.keyboard.press('Escape'); } else { const b = rnd() < 0.5 ? 'left' : 'right'; count(b === 'left' ? 'break' : 'place'); await page.mouse.click(320, 180, { button: b }); } }
  else if (r < 0.95) { const k = pick(Object.keys(KEYS)); count('key ' + k); await page.keyboard.press(KEYS[k]); await wait(150 + rnd() * 900); }
  else { count('idle'); await wait(500 + rnd() * 1500); }
}
async function monkey(sec, tag) {
  const end = Date.now() + sec * 1000; let n = 0, s = await watch(tag);
  while (Date.now() < end) {
    try { await act(s); } catch (e) { run.errors.push(tag + ' input: ' + String(e.message).slice(0, 200)); }
    s = await watch(tag); n++;
    if (s && s.st === 'title') { run.errors.push(tag + ': the game fell back to the title'); console.log('  !! at the title'); break; }
    if (n % 40 === 0) { console.log(`  ${tag} ${n} actions · ${secs()} · ${s ? s.st + ' ' + (s.screen || '-') + ' ' + (s.pos || []).map(Math.round) : '?'} · frames ${lastF}`); save(); }
  }
  for (const k of [...MOVES, 'ControlLeft']) await page.keyboard.up(k).catch(() => {});
  return n;
}

// ---------------------------------------------------------------- 1 · a new world, the monkey
check(await untilState('title'), 'the title at ' + secs());
await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.renderDist = 3; g.settings.dynRes = false; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Monkey',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
check(await untilState('play', 240), 'a new world at ' + secs());
await hook();
await wait(3000);
await page.mouse.click(320, 180).catch(() => {});   // (the page's focus and the mouse, as a player's first click)
run.n1 = await monkey(DUR, 'run');
await page.screenshot({ path: SHOTS + 'monkey_1.png' }).catch(() => {});
// ---------------------------------------------------------------- 2 · save → reload → open → check
const before = await ev(() => {
  const g = VR.game, ui = g.ui; if (ui && ui.show && ui.screen) { try { if (ui.closeInventory) ui.closeInventory(); ui.show(null); } catch (e) { } }
  const p = g.player, x = Math.floor(p.pos[0]) + 3, z = Math.floor(p.pos[2]) + 3, y = Math.min(250, Math.max(2, Math.floor(p.pos[1]) + 6));
  const st = VR.R.byName.gold_block ? VR.R.byName.gold_block.defaultState : VR.R.byName.stone.defaultState;
  g.world.setBlock(x, y, z, st);
  return { id: g.meta.id, dim: g.dim, pos: Array.from(p.pos), mark: [x, y, z], st, got: g.world.getBlock(x, y, z) };
});
run.before = before; console.log('  before ' + JSON.stringify(before));
await ev(async () => { await VR.game.saveMeta(); await VR.game.world.saveAll(); }, null, 60000);
await page.reload();
check(await untilState('title'), 'the page comes back at the title (' + secs() + ')');
await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.renderDist = 3; g.settings.dynRes = false; g.applySettings('*'); });
const opened = await ev(async (id) => { const ws = await VR.game.store.listWorlds(); const m = ws.find(w => w.id === id); if (!m) return false; await VR.game.loadWorld(m); return true; }, before.id, 60000);
check(opened, 'the saved world is in the list and opens');
check(await untilState('play', 240), 'the world is played again (' + secs() + ')');
let after = null;
for (let i = 0; i < 60; i++) { await wait(500); after = await ev((m) => { const g = VR.game, w = g.world; if (!w.isLoaded(m[0], m[2])) return null; return { dim: g.dim, pos: Array.from(g.player.pos), got: w.getBlock(m[0], m[1], m[2]) }; }, before.mark); if (after) break; }
run.after = after; console.log('  after ' + JSON.stringify(after));
check(after && after.dim === before.dim, `the same world (${after && after.dim})`);
check(after && after.got === before.st, `the marker block is still there (${after && after.got} = ${before.st})`);
const moved = after ? Math.hypot(after.pos[0] - before.pos[0], after.pos[1] - before.pos[1], after.pos[2] - before.pos[2]) : 1e9;
check(moved <= 3, `the player where he was saved (${moved.toFixed(2)} m off)`);
await hook(); lastF = -1; lastFT = Date.now();
run.n2 = await monkey(DUR2, 'again');
await page.screenshot({ path: SHOTS + 'monkey_2.png' }).catch(() => {});
const end = await watch('end');
// ---------------------------------------------------------------- the verdict
run.secs = (Date.now() - T0) / 1000; save();
console.log('  actions ' + JSON.stringify(run.actions) + ' · worst frame gap ' + run.worst + ' ms');
check(run.n1 > 50 && run.n2 > 5, `the monkey acted: ${run.n1} + ${run.n2} times`);
check(!run.pageErrors, `no page errors: ${run.pageErrors || 0}`);
check(soft === 0, `no soft-lock (no frame for 10 s / no answer): ${soft}`);
check(nan === 0, `no NaN position or velocity: ${nan}`);
check(end && end.st === 'play', `still playing at the end (${end && end.st}, ${end && end.screen})`);
for (const e of run.errors.slice(0, 12)) console.log('    · ' + e.slice(0, 300));
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
