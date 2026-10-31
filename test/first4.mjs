// f-first4 — the far landmark in a new world's first minutes (docs/superpowers/plans/2026-10-31-f-first4.md).
// A new world (seed 4242, Balanced, the create dialog as a player uses it), no input: at 15 / 60 / 120 s a picture of the
// spawn's own view (it faces the vista's landmark) and the far state: the horizon's coarse ring and drawn tiles, whether a
// drawn horizon tile (or a loaded chunk) holds the landmark's aim point, its place on the screen.
// Checks (the regression of f-first3, v0.54.9): by 60 s the landmark's aim is on the screen and drawn (a horizon tile
// or chunks hold it), the coarse ring whole.
// VARIANTS=A:path/to/dist/index.html,B:... compares several builds in one run (the bisect); default: this checkout's dist.
// usage: nohup bash test/wt_run.sh first4.mjs 3600 > .tmp_tests/first4.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
fs.mkdirSync(SHOTS, { recursive: true });
const VARS = (process.env.VARIANTS || ('now:' + ROOT + 'dist/index.html')).split(',').map(s => { const i = s.indexOf(':'); return [s.slice(0, i), s.slice(i + 1)]; });
const TIMES = (process.env.TIMES || '15,60,120').split(',').map(Number);
let fails = 0; const check = (ok, m) => { console.log((ok ? '  ok   ' : '  FAIL ') + m); if (!ok) fails++; };
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const PROBE = () => {
  const g = VR.game, hz = g.horizon, c = g.cam, p = g.player, A = window.__aim;
  const o = { pos: p.pos.map(v => +v.toFixed(1)), yaw: +c.yaw.toFixed(3), pitch: +c.pitch.toFixed(3), frame: g.frame, cols: g.world && g.world.cols ? g.world.cols.size : -1 };
  if (hz) { const s = hz.stats; o.hz = { r: hz.radius, lv: hz.level, coarse: +(s.coarse || 0).toFixed(2), tiles: s.tiles, drawn: s.drawn, want: s.want, done: s.done, inflight: hz.inflight }; if (hz.far) o.far = { on: hz.farOn(), ready: hz.far.stats.ready, drawn: hz.far.stats.drawn }; }
  if (A) {
    o.lm = A.lm; o.aim = A.aim;
    let inHz = false; for (const t of hz ? hz.drawList : []) { const S = 32 * (4 << t.L); if (A.aim[0] >= t.tx * S && A.aim[0] < (t.tx + 1) * S && A.aim[2] >= t.tz * S && A.aim[2] < (t.tz + 1) * S) { inHz = true; break; } }
    o.lmHz = inHz; o.lmCol = !!(g.world && g.world.cols && g.world.cols.get(VR.ckey(Math.floor(A.aim[0] / 16), Math.floor(A.aim[2] / 16))));
    o.lmD = Math.round(Math.hypot(A.aim[0] - c.x, A.aim[2] - c.z));
    const cp = Math.cos(c.pitch), f = [-Math.sin(c.yaw) * cp, Math.sin(c.pitch), -Math.cos(c.yaw) * cp], r = [Math.cos(c.yaw), 0, -Math.sin(c.yaw)], u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const dx = A.aim[0] - c.x, dy = A.aim[1] - c.y, dz = A.aim[2] - c.z, ah = dx * f[0] + dy * f[1] + dz * f[2];
    const fov = c.fov > 4 ? c.fov * Math.PI / 180 : (c.fov || 75 * Math.PI / 180), t = Math.tan(fov / 2), asp = innerWidth / innerHeight;
    o.lmScr = ah > 0 ? [+((dx * r[0] + dz * r[2]) / ah / t / asp).toFixed(2), +((dx * u[0] + dy * u[1] + dz * u[2]) / ah / t).toFixed(2)] : null;
    o.lmOn = !!(o.lmScr && Math.abs(o.lmScr[0]) < 1 && Math.abs(o.lmScr[1]) < 1);
  }
  o.fog = g.renderer && g.renderer.fogEnd ? Math.round(g.renderer.fogEnd) : undefined;
  return o;
};
const RES = {};
for (const [tag, dist] of VARS) {
  console.log('== ' + tag + ' ' + dist.replace(ROOT, ''));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('r9si.settings')) localStorage.setItem('r9si.settings', JSON.stringify({ preset: 'balanced', dynRes: false })); } catch (e) { /* */ } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  const ev = (fn, a) => page.evaluate(fn, a), wait = (ms) => page.waitForTimeout(ms);
  const untilState = async (st, ms) => { const t = Date.now(); while (Date.now() - t < ms) { const s = await ev(() => VR.game && VR.game.state).catch(() => null); if (s === st) return Date.now() - t; await wait(400); } return -1; };
  await page.goto('file://' + dist);
  if (await untilState('title', 240000) < 0) { check(false, tag + ': the start screen'); await ctx.close(); continue; }
  await wait(3000);
  try { await page.click('#title [data-act="newworld"]', { timeout: 8000 }); } catch (e) { await ev(() => document.querySelector('#title [data-act="newworld"]').click()).catch(() => {}); }
  await wait(1500);
  await ev(() => { const s = document.getElementById('cw_seed'); if (s) { s.value = '4242'; s.dispatchEvent(new Event('input')); } }).catch(() => {});
  try { await page.click('#create .btn.primary', { timeout: 8000 }); } catch (e) { await ev(() => document.querySelector('#create .btn.primary').click()).catch(() => {}); }
  // the vista's record (the arrival's landmark) while the world loads
  await ev(() => { window.__aimIv = setInterval(() => { const g = VR.game, v = (g.arrival && g.arrival.v) || (g.arrivalPending && g.arrivalPending.vista); if (v && v.aim) { window.__aim = { lm: v.lm, aim: v.aim.slice(), id: v.id }; clearInterval(window.__aimIv); } }, 100); }).catch(() => {});
  const tc = Date.now(), lt = await untilState('play', 300000);
  console.log('  load ' + (Date.now() - tc) + ' ms');
  const tPlay = Date.now(); RES[tag] = {};
  for (const T of TIMES) {
    await wait(Math.max(0, T * 1000 - (Date.now() - tPlay)));
    const pr = await ev(PROBE).catch(e => ({ err: String(e).slice(0, 120) }));
    try { await page.screenshot({ path: SHOTS + 'first4_' + tag + '_t' + T + '.png', timeout: 120000 }); } catch (e) { console.log('  (no shot)'); }
    RES[tag][T] = pr; console.log('  t' + T + ' ' + JSON.stringify(pr));
  }
  if (errs.length) console.log('  page errors: ' + errs.slice(0, 3).join(' | '));
  const r60 = RES[tag][60] || RES[tag][TIMES[TIMES.length - 1]];
  check(lt >= 0 && r60 && r60.lmOn && (r60.lmHz || r60.lmCol), tag + ': by 60 s the landmark (' + (r60 && r60.lm) + ', ' + (r60 && r60.lmD) + ' m) is on the screen ' + JSON.stringify(r60 && r60.lmScr) + ' and drawn (horizon ' + (r60 && r60.lmHz) + ', chunks ' + (r60 && r60.lmCol) + ')');
  check(r60 && r60.hz && r60.hz.coarse >= 0.99, tag + ': by 60 s the horizon\'s coarse ring is whole (' + (r60 && r60.hz && r60.hz.coarse) + ')');
  await ctx.close();
}
fs.writeFileSync(ROOT + '.tmp_tests/first4.json', JSON.stringify(RES));
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
