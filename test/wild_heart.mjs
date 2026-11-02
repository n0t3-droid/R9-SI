// u-wild2 · Tiere zum Liebhaben in the browser, German (de-DE), a creative flat meadow (flowers, two trees, a cottage).
//   1 Balanced: a Glimmerreh mother and three fawns get their own coats (built variants), the fawns are small with big
//     heads and walk in a line behind her; the picture test/shots/wild2_family.png
//   2 a curious Glimmerfuchs 9 blocks off comes closer while you stand still and sniffs; with sweet berries in your
//     hand it eats from it three times (trust → a friend); wild2_fox.png up close
//   3 finches hop on the grass and take off as you come near; wild2_birds.png
//   4 V pets the fawn (Aktion „Streicheln": a wiggle); at dusk the family lies down; wild2_dusk.png
//   5 the friend visits your door by day (spawn point by the cottage); wild2_door.png; the save holds meta.wildBonds
//   6 Very Low: nothing attached, no finches; no page errors. The sheet test/shots/wild2_sheet.jpg.
// Every run ends with ALL OK / FAILED n.
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'test/shots');
const PORT = 8765 + Math.floor(Math.random() * 200);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', path.join(ROOT, 'dist')], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
let browser = null, page = null;
const logs = [];
const ev = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => page.waitForTimeout(ms);
const safe = async (fn, a) => { try { return await ev(fn, a); } catch (e) { return null; } };
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const step = async (n, dtms = 33) => {
  for (let k = 0; k < n; k += 20) {
    await ev(([m, d]) => {
      const g = VR.game;
      if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
      window.__norender = true;
      for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); }
    }, [Math.min(20, n - k), dtms]);
  }
};
const shots = [];
const shot = async (name, tod) => {
  const hide = (on) => ev((on) => {
    for (const el of document.querySelectorAll('#hud > *')) el.style.visibility = on ? 'hidden' : '';
    for (const id of ['lockhint', 'hint', 'hints', 'toasts']) { const el = document.getElementById(id); if (el) el.style.visibility = on ? 'hidden' : ''; }
  }, on);
  await hide(true);
  const ms = await ev((tod) => { const t0 = performance.now(); window.__norender = false; const g = VR.game; if (tod !== undefined) g.env.setTime(tod); for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } window.__norender = true; return performance.now() - t0; }, tod);
  console.log('   (three drawn frames ' + Math.round(ms) + ' ms)');
  await wait(300);
  const f = path.join(SHOTS, name + '.png');
  await page.screenshot({ path: f, timeout: 120000 });
  await hide(false);
  shots.push(f); console.log('shot ' + name);
};
const untilTitle = async (maxS = 150) => { for (let i = 0; i < maxS * 2; i++) { await wait(500); if (await safe(() => !!(window.VR && VR.game && VR.game.state === 'title'))) return true; } return false; };
const untilPlay = async (maxS = 150) => { for (let i = 0; i < maxS * 2; i++) { await wait(500); if (await safe(() => !!(VR.game && VR.game.state === 'play' && VR.game.companions && VR.game.player))) return true; } return false; };
// the player looks at a point
const lookAt = (x, y, z) => ev(([x, y, z]) => { const p = VR.game.player, e = p.eyePos(), dx = x - e[0], dy = y - e[1], dz = z - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }, [x, y, z]);
const hold = (id, n) => ev(([id, n]) => { const inv = VR.game.player.inv; inv.add(id, n); const i = inv.slots.findIndex(s => s && s.id === id); if (i > 0) { const t = inv.slots[0]; inv.slots[0] = inv.slots[i]; inv.slots[i] = t; } inv.sel = 0; inv.changed = true; return !!inv.held && inv.held.id === id; }, [id, n]);

try {
  browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  page = await ctx.newPage();
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) logs.push('[console] ' + m.text().slice(0, 300)); });
  page.on('dialog', d => d.accept('x'));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  check(await untilTitle(), 'the title screen opens');
  await ev(() => { const g = VR.game; g.settings.renderDist = 6; g.settings.dynRes = false; g.applySettings('renderDist'); });
  check(await ev(() => VR.I18N.lang) === 'de', 'the game speaks German (de-DE)');
  await ev(() => { VR.game.createWorld({ name: 'Wiese', mode: 'creative', difficulty: 'peaceful', type: 'flat', seed: '11', cheats: true, kit: true }); });
  check(await untilPlay(), 'the flat world opens');
  await step(60);
  // Balanced (the tier the looks start at), noon, no random spawns in the way; a meadow: flowers, grass, two trees, a cottage
  const P0 = await ev(() => {
    const g = VR.game, p = g.player, w = g.world, R = VR.R, S = (n) => (R.byName[n] ? R.S(n) : 0);
    g.settings.preset = 'balanced'; g.settings.wildHeart = true;
    g.env.setTime(5200); g.env.rain = 0; g.env.rainTarget = 0;
    g.entities.trySpawn = () => {};
    p.flying = false;
    const x0 = Math.floor(p.pos[0]), z0 = Math.floor(p.pos[2]), y0 = w.topAt(x0, z0);
    const fl = ['poppy', 'cornflower', 'oxeye_daisy', 'dandelion'].map(S).filter(Boolean), gr = S('short_grass') || S('grass') || S('tall_grass');
    for (let dz = -26; dz <= 10; dz++) for (let dx = -16; dx <= 16; dx++) {
      const h = (Math.imul(dx * 73856093 ^ dz * 19349663, 2654435761) >>> 0) % 100;
      if (w.getBlock(x0 + dx, y0 + 1, z0 + dz)) continue;
      if (h < 7 && fl.length) w.setBlock(x0 + dx, y0 + 1, z0 + dz, fl[h % fl.length], 4); else if (h < 30 && gr) w.setBlock(x0 + dx, y0 + 1, z0 + dz, gr, 4);
    }
    const tree = (tx, tz) => { const L = S('oak_log'), Lv = S('oak_leaves'); for (let y = 1; y <= 5; y++) w.setBlock(tx, y0 + y, tz, L, 4); for (let y = 4; y <= 7; y++) for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if (Math.abs(a) + Math.abs(b) <= (y === 7 ? 1 : 3) && !(a === 0 && b === 0 && y < 6)) w.setBlock(tx + a, y0 + y, tz + b, Lv, 4); };
    tree(x0 - 7, z0 - 14); tree(x0 + 8, z0 - 18);
    return [x0, y0, z0];
  });
  const [x0, y0, z0] = P0;
  await step(40);

  console.log('--- 1 · a family in a meadow');
  const fam = await ev(([x0, y0, z0]) => {
    const g = VR.game, w = g.world, E = g.entities, H = g.companions.heart;
    const mom = E.summon('glimmer_deer', x0 + 0.5, y0 + 1, z0 - 8.5); mom.yaw = Math.PI * 0.5;
    const kids = [1, 2, 3].map(i => E.summon('glimmer_deer', x0 + 0.5 + i * 1.2, y0 + 1, z0 - 8.5 + (i % 2) * 0.6));
    H.update(1.1); H.family(mom, kids);
    window.__fam = { mom: mom.id, kids: kids.map(k => k.id) };
    return { on: H.on, kids: kids.map(k => !!(k.wh && k.wh.baby && k.wscale === 0.62)) };
  }, P0);
  check(fam.on, 'Balanced: the hearts are on');
  check(fam.kids.every(Boolean), 'three fawns, 0.62× their mother');
  // the mother walks slowly along the meadow; the fawns follow
  await ev(() => { const g = VR.game, m = g.entities.mobs.find(q => q.id === window.__fam.mom); m.ai.t = 99; m.ai.target = [m.pos[0] - 9, m.pos[2] + 1]; });
  await step(240);
  const line = await ev(() => {
    const g = VR.game, ms = g.entities.mobs, mom = ms.find(q => q.id === window.__fam.mom), kids = window.__fam.kids.map(id => ms.find(q => q.id === id));
    let ahead = mom, gaps = [];
    for (const k of kids) { gaps.push(Math.hypot(k.pos[0] - ahead.pos[0], k.pos[2] - ahead.pos[2])); ahead = k; }
    return { gaps, modes: kids.map(k => k.wh.mode), coats: [mom, ...kids].map(m => m.vkey || ''), eyes: !!VR.getVoxModel(g.renderer.gl, kids[0].vkey || 'x') && !!VR.getVoxModel(g.renderer.gl, kids[0].vkey).parts.head_c };
  });
  console.log('   gaps ' + line.gaps.map(v => v.toFixed(2)).join(' ') + ' · modes ' + line.modes.join(' ') + ' · ' + line.coats.join(' '));
  check(line.coats.every(c => c.startsWith('wh:glimmer_deer:')) && line.coats.slice(1).every(c => c.endsWith(':1')), 'each has its own coat (a built variant; the fawns\' a baby\'s)');
  check(line.eyes, 'the fawn\'s model has big eyes and a closed-eye head for its blinks');
  check(line.modes.every(m => m === 'follow') && line.gaps.every(d => d < 2.2), 'the fawns walk in a line behind their mother');
  // the picture: the family from the side, a little above
  await ev(() => { const g = VR.game, ms = g.entities.mobs, mom = ms.find(q => q.id === window.__fam.mom); const p = g.player; p.pos[0] = mom.pos[0] - 0.5; p.pos[2] = mom.pos[2] + 4.2; p.pos[1] = g.world.topAt(Math.floor(p.pos[0]), Math.floor(p.pos[2])) + 1; });
  const mp = await ev(() => { const m = VR.game.entities.mobs.find(q => q.id === window.__fam.mom); return [m.pos[0] + 1.4, m.pos[1] + 0.5, m.pos[2]]; });
  await lookAt(mp[0], mp[1], mp[2]); await step(2);
  await shot('wild2_family', 5600);

  console.log('--- 2 · a curious Glimmerfuchs');
  await ev(() => { const g = VR.game, ms = g.entities.mobs; for (const m of ms) if (m.kind === 'glimmer_deer') { m.pos[0] += 14; } });
  const fox = await ev(() => { const g = VR.game, p = g.player, w = g.world; p.vel[0] = p.vel[2] = 0; const x = p.pos[0] + 9, z = p.pos[2]; const m = g.entities.summon('glimmer_fox', x, w.topAt(Math.floor(x), Math.floor(z)) + 1, z); return m.id; });
  await step(270);
  const fx = await ev((id) => { const g = VR.game, m = g.entities.mobs.find(q => q.id === id), p = g.player; return { d: Math.hypot(m.pos[0] - p.pos[0], m.pos[2] - p.pos[2]), mode: m.wh && m.wh.mode }; }, fox);
  console.log('   the fox: ' + fx.d.toFixed(2) + ' blocks, ' + fx.mode);
  check(fx.d < 3 && (fx.mode === 'sniff' || fx.mode === 'approach'), 'it came closer while you stood still and sniffs');
  check(await hold('sweet_berries', 8), 'sweet berries in your hand');
  await step(500);
  const fed = await ev((id) => { const g = VR.game, m = g.entities.mobs.find(q => q.id === id), H = g.companions.heart; return { fed: m.wh.bond ? m.wh.bond.fed : 0, state: m.wh.bond ? m.wh.bond.state : null, friends: H.friends.length, n: g.player.inv.count ? g.player.inv.count('sweet_berries') : -1 }; }, fox);
  console.log('   fed ' + fed.fed + ' · ' + fed.state + ' · friends ' + fed.friends + ' · berries left ' + fed.n);
  check(fed.fed >= 3 && fed.state === 'friend' && fed.friends === 1, 'it ate from your hand three times: a friend');
  // up close: the fox at your feet, the camera down to it
  const fp = await ev((id) => { const g = VR.game, m = g.entities.mobs.find(q => q.id === id), p = g.player; m.pos[0] = p.pos[0]; m.pos[2] = p.pos[2] - 1.9; m.yaw = Math.PI + 0.45; m.wh.mode = 'sniff'; m.wh.thinkT = 99; return [m.pos[0], m.pos[1] + 0.45, m.pos[2]]; }, fox);
  await lookAt(fp[0], fp[1], fp[2]); await step(3);
  await shot('wild2_fox', 5600);

  console.log('--- 3 · finches');
  const bx = await ev(() => { const g = VR.game, p = g.player, H = g.companions.heart; H.flock(p.pos[0] + 0.5, p.pos[2] - 5.6, 6); return [p.pos[0] + 0.5, p.pos[1] + 0.1, p.pos[2] - 5.6]; });
  await lookAt(bx[0], bx[1], bx[2]); await step(30);
  await shot('wild2_birds', 5600);
  const hop = await ev(() => VR.game.companions.heart.birds.filter(b => b.st === 'hop').length);
  await ev(() => { const g = VR.game, p = g.player, b = g.companions.heart.birds[0]; if (b) { p.pos[0] = b.x + 1.2; p.pos[2] = b.z + 0.5; } });
  await step(6);
  const fly = await ev(() => VR.game.companions.heart.birds.filter(b => b.st === 'fly').length);
  check(hop >= 4 && fly >= 1, `finches hop on the grass (${hop}) and take off as you come near (${fly})`);
  await step(10);
  await shot('wild2_takeoff', 5600);

  console.log('--- 4 · V pets the fawn; dusk');
  const pet = await ev(() => {
    const g = VR.game, ms = g.entities.mobs, k = ms.find(q => q.id === window.__fam.kids[0]), p = g.player;
    for (const m of ms) if (m.kind === 'glimmer_deer') m.pos[0] -= 14;
    p.pos[0] = k.pos[0]; p.pos[2] = k.pos[2] + 2.2;
    const e = p.eyePos(), dx = k.pos[0] - e[0], dy = k.pos[1] + k.h * 0.31 - e[1], dz = k.pos[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    const c = VR.Ctx.gather(g), res = VR.Ctx.resolve(c);
    const ok = res && res.act === 'pet' && VR.Ctx.act(g, res);
    return { act: res && res.act, ok: !!ok, wig: k.wh.wig };
  });
  check(pet.act === 'pet' && pet.ok && pet.wig > 0, `V: „Streicheln" — the fawn wiggles (${pet.act}, ${pet.wig.toFixed(2)})`);
  await ev(() => { VR.game.env.setTime(13000); });
  await step(320);
  const dusk = await ev(() => { const ms = VR.game.entities.mobs; return [window.__fam.mom, ...window.__fam.kids].map(id => ms.find(q => q.id === id).wh.mode); });
  console.log('   at dusk: ' + dusk.join(' '));
  check(dusk.filter(m => m === 'rest').length >= 3, 'at dusk the family lies down');
  const dp = await ev(() => { const g = VR.game, m = g.entities.mobs.find(q => q.id === window.__fam.mom), p = g.player; p.pos[0] = m.pos[0] + 3.5; p.pos[2] = m.pos[2] + 3.5; return [m.pos[0], m.pos[1] + 0.3, m.pos[2]]; });
  await lookAt(dp[0], dp[1], dp[2]); await step(2);
  await shot('wild2_dusk', 13000);

  console.log('--- 5 · a friend at your door');
  const door = await ev(([x0, y0, z0]) => {
    const g = VR.game, w = g.world, R = VR.R, S = (n) => (R.byName[n] ? R.S(n) : 0), p = g.player, H = g.companions.heart;
    g.env.setTime(5000);
    // a little cottage front: planks, an opening, a lantern
    const cx = x0 + 4, cz = z0 + 6;
    for (let dx = -3; dx <= 3; dx++) for (let y = 1; y <= 4; y++) { if (dx === 0 && y <= 2) continue; w.setBlock(cx + dx, y0 + y, cz, y === 4 ? S('spruce_planks') : S('oak_planks'), 4); }
    for (let dx = -3; dx <= 3; dx++) for (let dz = 1; dz <= 4; dz++) { w.setBlock(cx + dx, y0 + 4, cz + dz, S('spruce_planks'), 4); }
    if (S('lantern') && S('oak_fence')) { w.setBlock(cx + 2, y0 + 1, cz - 1, S('oak_fence'), 4); w.setBlock(cx + 2, y0 + 2, cz - 1, S('lantern'), 4); }
    p.spawn = [cx - 1, y0 + 1, cz - 2];
    p.pos[0] = cx - 3.5; p.pos[1] = y0 + 1; p.pos[2] = cz - 6.5;
    for (const m of g.entities.mobs.slice()) if (m.kind === 'glimmer_fox') { const i = g.entities.mobs.indexOf(m); g.entities.mobs.splice(i, 1); }
    for (const f of H.friends) f.nextVisit = 0;
    H.visitT = 0;
    return [cx, cz];
  }, P0);
  await step(30);
  const v0 = await ev(() => { const v = VR.game.companions.heart.visitor; return v ? v.kind : null; });
  check(v0 === 'glimmer_fox', 'your friend comes to visit (' + v0 + ')');
  await step(360);
  const v1 = await ev(() => { const g = VR.game, v = g.companions.heart.visitor, h = g.player.spawn; return v ? { mode: v.wh.mode, d: Math.hypot(v.pos[0] - h[0], v.pos[2] - h[2]), pos: [v.pos[0], v.pos[1], v.pos[2]] } : null; });
  console.log('   the visitor: ' + (v1 ? v1.mode + ' ' + v1.d.toFixed(2) : 'none'));
  check(v1 && v1.mode === 'wait' && v1.d < 3, 'it waits at your door');
  if (v1) { await ev(([x, z]) => { const p = VR.game.player; p.pos[0] = x - 1; p.pos[2] = z - 4.6; }, [v1.pos[0], v1.pos[2]]); await lookAt(v1.pos[0] + 0.6, v1.pos[1] + 0.9, v1.pos[2] + 1.6); await step(2); }
  await shot('wild2_door', 5600);
  const saved = await ev(() => { const m = {}; VR.game.companions.beforeSave(m); return m.wildBonds || null; });
  check(Array.isArray(saved) && saved.length === 1 && saved[0].kind === 'glimmer_fox' && saved[0].fed >= 3, 'the save holds your friend (meta.wildBonds)');
  const back = await ev((s) => VR.WildBond.deserialize(JSON.parse(JSON.stringify(s))).length, saved);
  check(back === 1, 'and reads it back');

  console.log('--- 6 · Very Low');
  const vl = await ev(() => {
    const g = VR.game, H = g.companions.heart; g.settings.preset = 'potato';
    for (let i = 0; i < 70; i++) { g.last = performance.now() - 33; g.loop(performance.now()); }
    const d = g.entities.summon('bloom_sheep', g.player.pos[0] + 3, g.player.pos[1], g.player.pos[2]);
    for (let i = 0; i < 40; i++) { g.last = performance.now() - 33; g.loop(performance.now()); }
    return { on: H.on, wh: g.entities.mobs.filter(m => m.wh).length, birds: H.birds.length, sheep: !d.wh };
  });
  check(!vl.on && vl.wh === 0 && vl.birds === 0 && vl.sheep, 'Very Low: off — no animal has a heart, no finches, a new sheep stays as before');

  console.log('--- logs (' + logs.length + ')');
  for (const l of logs.slice(0, 12)) console.log(l);
  check(!logs.some(l => /pageerror\]/.test(l)), 'no page errors');
  // the sheet
  try {
    const spec = { w: 620, rows: [{ label: 'u-wild2: a family in the meadow · a curious fox up close', imgs: [path.join(SHOTS, 'wild2_family.png'), path.join(SHOTS, 'wild2_fox.png')] }, { label: 'finches hop, then take off as you come', imgs: [path.join(SHOTS, 'wild2_birds.png'), path.join(SHOTS, 'wild2_takeoff.png')] }, { label: 'dusk: the family lies down · a friend at your door', imgs: [path.join(SHOTS, 'wild2_dusk.png'), path.join(SHOTS, 'wild2_door.png')] }] };
    fs.writeFileSync(path.join(SHOTS, 'wild2_sheet.json'), JSON.stringify(spec));
    execFileSync('python3', ['/root/r9coord/pairs.py', path.join(SHOTS, 'wild2_sheet.jpg'), path.join(SHOTS, 'wild2_sheet.json')]);
    console.log('sheet test/shots/wild2_sheet.jpg');
  } catch (e) { console.log('(no sheet: ' + e.message.slice(0, 120) + ')'); }
} catch (e) {
  fails++;
  console.log('  ✗ the test stopped: ' + (e.stack || e.message).slice(0, 900));
  for (const l of logs.slice(0, 8)) console.log(l);
}
try { if (browser) await browser.close(); } catch (e) { /* closed */ }
srv.kill();
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
