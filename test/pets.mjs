// v0.41 🐾 Begleiter in the browser, German (de-DE), a creative flat world. A wild Glimmerfuchs stands 2.5 blocks ahead; a
// left-click pat never hurts it (it is startled and runs off, so the test takes it out of the world); a second wild one
// stands in front, and a right-click with glow berries tames it (hearts, the 🐾 toast, the name box, where "Pfotenfritz"
// is typed); the player walks 40 blocks and it follows close behind; a right-click sits it down; the pause menu's 🐾
// Pfeifen and /pfeifen call it back to the player; the world is saved and opened again: still yours, with its name,
// sitting. Then each species sits 2.2 blocks ahead for the pictures test/shots/pets_1..3.png (Glimmerfuchs, Mooskätzchen,
// Kristallwelpe). No page errors. Every run ends with ALL OK / FAILED n: a step that cannot run counts as a failed check.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import fs from 'fs';

const PORT = 8765 + Math.floor(Math.random() * 200);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', '/home/claude/vr/dist'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const URL0 = `http://127.0.0.1:${PORT}/index.html`;
let browser = null, page = null;
const logs = [];
const ev = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => page.waitForTimeout(ms);
const safe = async (fn, a) => { try { return await ev(fn, a); } catch (e) { return null; } };   // (a page that is reloading answers nothing)
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// the game advances in 33 ms frames without drawing (the smoke test's helper): quick and deterministic
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
// a picture: the game draws for two frames, then the page is captured (the smoke test's helper)
// (the HUD and the tips are hidden for the picture, except the 🐾 chip: the animal is the picture)
const shot = async (name, tod) => {
  const hide = (on) => ev((on) => {
    for (const el of document.querySelectorAll('#hud > *')) if (el.id !== 'petchip') el.style.visibility = on ? 'hidden' : '';
    for (const id of ['lockhint', 'hint', 'hints', 'toasts']) { const el = document.getElementById(id); if (el) el.style.visibility = on ? 'hidden' : ''; }   // the start-up tip ("Leertaste 2× = fliegen") too
  }, on);
  await hide(true);
  await ev((tod) => { window.__norender = false; const g = VR.game; if (tod !== undefined) g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, tod);
  await wait(200);
  await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 });
  await hide(false);
  console.log('shot ' + name);
};
const untilTitle = async (maxS = 120) => { for (let i = 0; i < maxS * 2; i++) { await wait(500); if (await safe(() => !!(window.VR && VR.game && VR.game.state === 'title'))) return true; } return false; };
const untilPlay = async (maxS = 120) => { for (let i = 0; i < maxS * 2; i++) { await wait(500); if (await safe(() => !!(VR.game && VR.game.state === 'play' && VR.game.companions && VR.game.player))) return true; } return false; };
// the player turns to look at a companion (the same angles as the game's look direction)
const aimAt = (id) => ev((id) => {
  const g = VR.game, p = g.player, m = g.entities.mobs.find(q => q.id === id); if (!m) return false;
  const e = p.eyePos(), dx = m.pos[0] - e[0], dy = m.pos[1] + m.h * 0.5 - e[1], dz = m.pos[2] - e[2];
  p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  return true;
}, id);
// a mouse button: the game reads the flag once a frame (as on a real click); returns whether the ray hits that companion
const click = (id, button) => ev(([id, button]) => {
  const g = VR.game, p = g.player, m = g.entities.mobs.find(q => q.id === id);
  const hit = g.entities.rayEntity(p.eyePos(), p.lookDir(), 4.2);
  const hits = !!(hit && m && hit.ent === m);
  g.input.mouse.clicked[button] = true;
  return hits;
}, [id, button]);
const petState = (id) => ev((id) => { const m = VR.game.entities.mobs.find(q => q.id === id); return m && m.pet ? m.pet.state : null; }, id);
// a wild Glimmerfuchs 2.5 blocks in front of the player, facing it (returns its id)
const summonFoxAhead = () => ev(() => {
  const g = VR.game, p = g.player, w = g.world;
  p.yaw = 0; p.pitch = 0;
  const x = Math.floor(p.pos[0]) + 0.5, z = Math.floor(p.pos[2]) - 2.5;
  const m = g.entities.summon('glimmer_fox', x, w.topAt(Math.floor(x), Math.floor(z)) + 1, z);
  return m ? m.id : null;
});

// ---------------------------------------------------------------- the game, in German
try {
  browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  page = await ctx.newPage();
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) logs.push('[console] ' + m.text().slice(0, 300)); });
  page.on('dialog', d => d.accept('x'));

  await page.goto(URL0);
  check(await untilTitle(), 'the title screen opens');
  await ev(() => { const g = VR.game; g.settings.renderDist = 6; g.settings.dynRes = false; g.applySettings('renderDist'); });
  check(await ev(() => VR.I18N.lang) === 'de', 'the game speaks German (de-DE)');

  console.log('--- a creative flat world, a wild Glimmerfuchs 2.5 blocks ahead');
  await ev(() => { VR.game.createWorld({ name: 'Begleiter', mode: 'creative', difficulty: 'peaceful', type: 'flat', seed: '7', cheats: true, kit: true }); });
  check(await untilPlay(), 'the flat world opens');
  await step(80);
  const worldId = await ev(() => VR.game.meta.id);
  check(await ev(() => VR.game.player.mode === 'creative'), 'the player is in creative mode');
  const fox = await summonFoxAhead();
  check(fox !== null, 'a wild Glimmerfuchs stands in front of the player');
  await step(10);
  check(await ev(() => VR.game.companions.pets().length === 0), 'a wild one is nobody’s yet');

  // the glow berries in the hand (the first slot)
  await ev(() => { const inv = VR.game.player.inv; inv.add('glow_berries', 4); const i = inv.slots.findIndex(s => s && s.id === 'glow_berries'); if (i > 0) { const t = inv.slots[0]; inv.slots[0] = inv.slots[i]; inv.slots[i] = t; } inv.sel = 0; inv.changed = true; });
  check(await ev(() => { const h = VR.game.player.inv.held; return !!h && h.id === 'glow_berries'; }), 'the glow berries are in the hand');

  // a pat (left click) is never a blow: the wild one is startled and runs off, unhurt
  await aimAt(fox); await step(2);
  const patHit = await click(fox, 0); await step(3);
  check(patHit && await ev((id) => { const m = VR.game.entities.mobs.find(q => q.id === id); return !!m && m.hp === m.def.hp && !m.dead; }, fox), 'a pat does not hurt the wild Glimmerfuchs');
  // it has run off out of reach: the test takes it out of the world, and a second wild one stands 2.5 blocks ahead
  await ev((id) => { const ms = VR.game.entities.mobs, k = ms.findIndex(q => q.id === id); if (k >= 0) ms.splice(k, 1); }, fox);
  const fox2 = await summonFoxAhead();
  check(fox2 !== null, 'a second wild Glimmerfuchs stands in front of the player');
  await step(10);

  // the right-click with the treat tames it
  await aimAt(fox2); await step(2);
  const tameHit = await click(fox2, 2); await step(4);
  check(tameHit, 'the right-click hits the Glimmerfuchs');
  check(await ev(() => VR.game.companions.pets().length === 1), 'with the glow berries it is yours: one companion');
  check(await ev(() => document.getElementById('toasts').textContent.includes('ist jetzt dein Begleiter')), 'the toast says 🐾 … ist jetzt dein Begleiter!');
  check(await ev(() => VR.game.ui.screen === 'petname'), 'the name box opens');

  // the name: typed as a German player types it
  await wait(300);
  await page.keyboard.type('Pfotenfritz');
  await page.keyboard.press('Enter');
  await step(20);
  const pet = await ev(() => { const m = VR.game.companions.pets()[0]; return m ? { id: m.id, name: m.pet.name, state: m.pet.state } : null; });
  check(!!pet && pet.name === 'Pfotenfritz', 'the name box gives it the name Pfotenfritz');
  check(await ev(() => VR.game.ui.screen !== 'petname'), 'the game is back in play after the name');
  const chip = await ev(() => { const el = document.getElementById('petchip'); return el ? { text: el.textContent, shown: el.style.display === 'block' } : null; });
  check(!!chip && chip.shown && chip.text.includes('Pfotenfritz'), 'the 🐾 chip shows the name: ' + (chip ? chip.text : '-'));

  // ---------------------------------------------------------------- the walk: 40 blocks, and it follows
  console.log('--- walking 40 blocks');
  await ev(() => { const p = VR.game.player; p.yaw = 0; p.pitch = 0; window.__walk0 = p.pos.slice(); VR.game.input.keys.add('KeyW'); });
  let walked = 0;
  for (let i = 0; i < 400 && walked < 40; i++) {
    await step(10); await wait(15);
    walked = await ev(() => Math.hypot(VR.game.player.pos[0] - window.__walk0[0], VR.game.player.pos[2] - window.__walk0[2]));
  }
  await ev(() => VR.game.input.keys.delete('KeyW'));
  await step(40); await wait(100);
  check(walked >= 40, 'the player walked ' + walked.toFixed(1) + ' blocks');
  const follow = await ev(() => { const g = VR.game, p = g.player, m = g.companions.pets()[0]; return m ? { d: Math.hypot(m.pos[0] - p.pos[0], m.pos[1] - p.pos[1], m.pos[2] - p.pos[2]), state: m.pet.state } : null; });
  check(!!follow && follow.d < 6, 'Pfotenfritz follows, ' + (follow ? follow.d.toFixed(1) : '?') + ' blocks behind');

  // ---------------------------------------------------------------- sit, save, reload: still yours, with its name
  await aimAt(pet.id); await step(2);
  const sitHit = await click(pet.id, 2); await step(4);
  check(sitHit && await petState(pet.id) === 'sit', 'a right-click sits Pfotenfritz down');
  console.log('--- save, reload, open the world again');
  await ev(async () => { await VR.game.saveMeta(); await VR.game.world.saveAll(); });
  await page.reload();
  check(await untilTitle(), 'the page comes back at the title');
  await ev(() => { const g = VR.game; g.settings.renderDist = 6; g.settings.dynRes = false; g.applySettings('renderDist'); });
  const opened = await ev(async (id) => { const ws = await VR.game.store.listWorlds(); const meta = ws.find(w => w.id === id); if (!meta) return false; await VR.game.loadWorld(meta); return true; }, worldId);
  check(opened, 'the saved world is in the list and opens');
  check(await untilPlay(), 'the world is played again');
  await step(80);
  const back = await ev(() => { const ps = VR.game.companions.pets(); const m = ps[0]; return m ? { n: ps.length, id: m.id, name: m.pet.name, state: m.pet.state } : null; });
  check(!!back && back.n === 1 && back.name === 'Pfotenfritz' && back.state === 'sit', 'after the reload it is still yours: Pfotenfritz, sitting');

  // ---------------------------------------------------------------- 🐾 Pfeifen: the pause menu's button, and /pfeifen
  console.log('--- Pfeifen');
  await ev(() => VR.game.ui.pause()); await step(2);
  const label = await ev(() => { const b = document.querySelector('#pause [data-act="pfeifen"]'); return b ? b.textContent.trim() : null; });
  check(!!label && label.includes('Pfeifen'), 'the pause menu has the button "' + label + '"');
  await ev(() => VR.game.ui.act('pfeifen')); await step(4);
  const called = await ev(() => { const m = VR.game.companions.pets()[0]; return { st: m ? m.pet.state : null, screen: VR.game.ui.screen }; });
  check(called.st === 'follow' && called.screen !== 'pause', 'the 🐾 Pfeifen button calls the sitting companion back');
  await aimAt(back.id); await step(2); await click(back.id, 2); await step(4);
  check(await petState(back.id) === 'sit', 'it sits again');
  await ev(() => VR.game.chat('/pfeifen')); await step(4);
  check(await petState(back.id) === 'follow', '/pfeifen calls it back as well');

  // ---------------------------------------------------------------- the three species, for the pictures
  console.log('--- the three species');
  const SPECIES = [['glimmer_fox', 'Lumi'], ['moss_cat', 'Flocke'], ['crystal_pup', 'Kiesel']];
  for (let i = 0; i < SPECIES.length; i++) {
    const [kind, name] = SPECIES[i];
    await ev(([kind, name, i]) => {
      const g = VR.game, p = g.player, ent = g.entities;
      for (let k = ent.mobs.length - 1; k >= 0; k--) if (ent.mobs[k].def && ent.mobs[k].def.companion) ent.mobs.splice(k, 1);
      // 2.2 blocks ahead, the camera tilted down to it: the animal large in the picture, a little below the middle
      p.yaw = 0; p.pitch = -0.42;
      const x = Math.floor(p.pos[0]) + 0.5, z = Math.floor(p.pos[2]) - 2.2;
      const y = g.world.topAt(Math.floor(x), Math.floor(z)) + 1;
      g.companions.adopt({ kind, name, state: 'sit', seed: i + 1, pos: [x, y, z], yaw: Math.PI - 0.35 });
    }, [kind, name, i]);
    await step(60);
    await shot(`pets_${i + 1}`, 4500);
    check(fs.existsSync(`/home/claude/vr/test/shots/pets_${i + 1}.png`), `${kind} picture saved`);
  }

  console.log('--- logs (' + logs.length + ')');
  for (const l of logs.slice(0, 12)) console.log(l);
  check(!logs.some(l => /pageerror\]/.test(l)), 'no page errors');
} catch (e) {
  fails++;
  console.log('  ✗ the test stopped early: ' + String((e && e.message) || e).split('\n')[0].slice(0, 300));
} finally {
  if (browser) await browser.close().catch(() => {});
  srv.kill();
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
