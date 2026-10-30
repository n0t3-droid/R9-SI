// regress: skip — f-hud's before | after probe (plan docs/superpowers/plans/2026-10-31-f-hud.md): the Abenteuer start after a
// first world where the player pressed F1 (critic_ux's order), pictures at 4 s and 25 s; then (the build under test only)
// the first fight: a Wächter 4 m ahead, three hits (sparks, the rock back, the clank), the power-down (the XP pop).
// German UI, 1280 × 720, Balanced. env: BEFORE (a dist folder's index.html for the before pictures; none: after only)
//   nohup bash test/wt_run.sh hud_probe.mjs 3600 > .tmp_tests/hud_probe.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0; const check = (ok, m) => { console.log((ok ? '  ok   ' : '  FAIL ') + m); if (!ok) fails++; };
const OUT = {};
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
async function run(tag, url, fight) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('r9si.settings')) localStorage.setItem('r9si.settings', JSON.stringify({ preset: 'balanced', dynRes: false })); } catch (e) { /* */ } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  const wait = (ms) => page.waitForTimeout(ms), ev = (fn, a) => page.evaluate(fn, a);
  const until = async (fn, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(fn).catch(() => false)) return Date.now() - t; await wait(400); } return -1; };
  const shot = async (n) => { try { await page.screenshot({ path: SHOTS + 'hud_' + tag + '_' + n + '.png', timeout: 120000 }); } catch (e) { console.log('  (no shot ' + n + ')'); } };
  const frames = async (n) => { const f0 = await ev(() => VR.game.frame).catch(() => 0); await until(new Function('return VR.game.frame >= ' + (f0 + n)), 90000); };
  const hudState = () => ev(() => { const g = VR.game, h = document.getElementById('hud'), cs = getComputedStyle(h), fk = g.funke, c = g.cam; return { vis: cs.visibility, op: +cs.opacity, hideHud: !!g.hideHud, arrival: g.arrival ? g.arrival.phase : null, funkeD: fk && fk.pos && c ? +Math.hypot(fk.pos[0] - c.x, fk.pos[1] - c.y, fk.pos[2] - c.z).toFixed(2) : -1, funkeVis: !!(fk && fk.visible), wow: !!(g.wow && g.wow.active), moved: VR.First2 && VR.First2.moved ? { r: VR.First2.moved.r, phase: VR.First2.moved.phase || 'after' } : null }; }).catch(e => ({ err: String(e) }));
  const newWorld = async (way) => {
    await page.click('#title [data-act="newworld"]', { timeout: 15000 }).catch(() => ev(() => document.querySelector('#title [data-act="newworld"]').click()));
    await wait(1500);
    await ev(() => { const s = document.getElementById('cw_seed'); if (s) { s.value = '4242'; s.dispatchEvent(new Event('input')); } });
    if (way) await ev((w) => { const b = document.querySelector('#cw_way [data-v="' + w + '"]'); if (b) b.click(); }, way);
    await wait(400);
    await ev(() => document.querySelector('#create .btn.primary').click());
    return until(() => VR.game && VR.game.state === 'play', 300000);
  };
  await page.goto(url);
  await until(() => VR.game && VR.game.state === 'title', 240000); await wait(3000);
  // the first world: in, the arrival over, F1 (the HUD hidden), out to the title
  check(await newWorld(null) >= 0, tag + ': the first world');
  await until(() => !VR.game.arrival, 90000); await frames(2);
  await page.keyboard.press('F1'); await frames(2);
  OUT[tag + '_f1'] = await ev(() => ({ hideHud: !!VR.game.hideHud, toast: [...document.querySelectorAll('.toast')].map(e => e.textContent.trim()).slice(-2) }));
  console.log('  ' + tag + ' after F1: ' + JSON.stringify(OUT[tag + '_f1']));
  await ev(() => { VR.game.ui.show('pause'); }); await wait(500);
  await ev(() => { const b = document.querySelector('#pause [data-act="quit"]'); if (b) b.click(); });
  await until(() => VR.game.state === 'title', 120000); await wait(3000);
  // the Abenteuer world
  check(await newWorld('gentle') >= 0, tag + ': the Abenteuer world');
  const tp = Date.now();
  await wait(4000); OUT[tag + '_t4'] = await hudState(); await shot('t4');
  console.log('  ' + tag + ' 4 s: ' + JSON.stringify(OUT[tag + '_t4']));
  await wait(Math.max(0, 25000 - (Date.now() - tp))); await frames(1); OUT[tag + '_t25'] = await hudState(); await shot('t25');
  console.log('  ' + tag + ' 25 s: ' + JSON.stringify(OUT[tag + '_t25']));
  if (fight) {
    const s25 = OUT[tag + '_t25'];
    check(s25.vis !== 'hidden' && s25.op > 0.5 && !s25.hideHud, tag + ': the HUD up at 25 s');
    check(!s25.funkeVis || s25.funkeD >= 0.6, tag + ': Funke not in the face (' + s25.funkeD + ' m)');
    // the first fight: a Wächter 4 m ahead, facing the player
    const spawned = await ev(() => { const g = VR.game, p = g.player, En = g.entities, F = VR.Foes; const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw), x = p.pos[0] + fx * 4, z = p.pos[2] + fz * 4;
      let y = Math.floor(p.pos[1]) + 3; while (y > p.pos[1] - 6 && !(VR.R.T.flags[g.world.getBlock(Math.floor(x), y - 1, Math.floor(z))] & VR.F.SOLID)) y--;
      const m = En.summon('foe_sentry', x, y, z); if (!m) return null; m.foe = F.make('sentry', m.id, [x, y, z]); m.yaw = p.yaw + Math.PI; window.__m = m; p.pitch = -0.08; return [x, y, z]; }).catch(e => String(e));
    console.log('  foe: ' + JSON.stringify(spawned));
    check(Array.isArray(spawned), tag + ': a Wächter ahead');
    await frames(2);
    for (let i = 1; i <= 3; i++) {
      await ev(() => { const g = VR.game; g.entities.hurtMob(window.__m, 3, g.player.pos); }); await frames(1); await shot('hit' + i);
    }
    OUT.hit = await ev(() => ({ stats: VR.HitFeel && VR.HitFeel.stats, hitT: window.__m.foe.hitT, st: window.__m.foe.st, vel: window.__m.vel.map(v => +v.toFixed(2)), particles: VR.game.particles && VR.game.particles.count !== undefined ? VR.game.particles.count : null, clank: VR.HitFeel && VR.HitFeel.clankN }));
    console.log('  hits: ' + JSON.stringify(OUT.hit));
    check(OUT.hit.stats && OUT.hit.stats.hits >= 3 && OUT.hit.clank >= 3, tag + ': three hits felt (' + JSON.stringify(OUT.hit.stats) + ', clank ' + OUT.hit.clank + ')');
    await ev(() => { const g = VR.game; g.entities.hurtMob(window.__m, 60, g.player.pos); });
    await until(() => document.querySelector('.hfpop') || (VR.HitFeel && VR.HitFeel.stats.pops > 0), 60000); await shot('pop');
    OUT.pop = await ev(() => ({ pops: VR.HitFeel.stats.pops, el: [...document.querySelectorAll('.hfpop')].map(e => e.textContent) }));
    console.log('  pop: ' + JSON.stringify(OUT.pop));
    check(OUT.pop.pops >= 1, tag + ': the XP pop where it stood');
    // ⚙ Einfach: the switch
    await ev(() => { VR.game.ui.show('pause'); }); await wait(600);
    await ev(() => { const b = document.querySelector('#pause [data-act="settings"]'); if (b) b.click(); }); await wait(2500); await shot('settings');
    OUT.set = await ev(() => { const r = document.querySelector('#setbody .hfrow'); return { row: r ? r.textContent.trim().slice(0, 80) : null, checked: r ? r.querySelector('input').checked : null, controls: [...document.querySelectorAll('#settings input, #settings select, #settings button')].filter(e => e.offsetParent !== null).length }; });
    console.log('  settings: ' + JSON.stringify(OUT.set));
    check(OUT.set.row && /Bildschirmwackeln/.test(OUT.set.row) && OUT.set.checked === false && OUT.set.controls <= 20, tag + ': Einfach has „Bildschirmwackeln", off');
  }
  OUT[tag + '_errors'] = errs;
  check(!fight || errs.length === 0, tag + ': no page errors (' + errs.length + ')' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
  await ctx.close();
}
if (process.env.BEFORE) await run('before', 'file://' + process.env.BEFORE, false);
await run('after', 'file://' + ROOT + 'dist/index.html', true);
fs.writeFileSync(SHOTS + 'hud_probe.json', JSON.stringify(OUT, null, 1));
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
