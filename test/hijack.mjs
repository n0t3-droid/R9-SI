// v0.56.5 · Kapern: a craft of the sky traffic passing close in front of you can be taken with the Aktion (V) — it becomes
// a ship of yours at the same pose, you sit at its controls and it flies on at its speed; the traffic craft is gone.
//   bash test/wt_run.sh hijack.mjs 900
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e.stack || e.message).slice(0, 600)));
await page.goto(process.env.DIST || 'file:///home/dev/vr/dist/index.html');
const ev = (fn, a) => page.evaluate(fn, a), wait = (ms) => page.waitForTimeout(ms);
const step = (n) => ev((n) => { const g = VR.game; for (let i = 0; i < n; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } }, n);
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('low'); g.settings.renderDist = 4; g.settings.horizon = 0; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Kapern',mode:'creative',difficulty:'peaceful',type:'default',seed:'53',cheats:true,kit:true})`);
for (let i = 0; i < 120; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { window.requestAnimationFrame = () => 0; const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(0, 150, 0); p.yaw = 0; p.pitch = 0; VR.game.traffic.ships.length = 0; VR.game.traffic.spawnFlight({ arch: 'shuttle' }); });
let ready = false;
for (let k = 0; k < 60 && !ready; k++) { await step(5); ready = await ev(() => VR.game.traffic.ships.some(s => s.d && s.d.cells && s.d.occ)); }
check(ready, 'a craft of the sky traffic is in the air with its design built');
if (ready) {
  // the craft 9 m in front of the eye, crossing the view; look at its middle
  const r = await ev(() => {
    const g = VR.game, p = g.player, Tr = g.traffic, s = Tr.ships.find(q => q.d && q.d.cells), e = p.eyePos(), d = p.lookDir();
    for (const q of Tr.ships) if (q !== s) q.dead = true;
    s.pos = [e[0] + d[0] * 9, e[1] + d[1] * 9, e[2] + d[2] * 9]; s.heading = Math.PI / 2; s.alpha = 1; s.t = 0.5; s.speed = 30;
    const c = VR.Ctx.gather(g), res = VR.Ctx.resolve(c);
    return { kind: c.near && c.near.kind, key: res.key };
  });
  check(r.kind === 'hijack' && r.key === 'g.ctx.hijack', 'the Aktion offers „Kapern"', r.kind + ' · ' + r.key);
  const a = await ev(() => { const g = VR.game, c = VR.Ctx.gather(g), res = VR.Ctx.resolve(c), ok = VR.Ctx.act(g, res), P = g.starships.pilot, fl = P && P.flight; return { ok, pilot: !!P, key: P && P.key, vF: fl ? fl.vF : 0, thr: fl ? fl.throttle : 0, state: fl ? fl.state : null, left: g.traffic.ships.filter(s => !s.dead).length }; });
  check(a.ok && a.pilot && /^tr-/.test(a.key || ''), 'V takes the controls of a ship of yours made from the craft', JSON.stringify(a));
  check(a.vF > 20 && a.thr > 0.2 && a.state === 'flying', 'it keeps flying at the craft\'s speed (the lever set to it)', `vF ${a.vF.toFixed(1)} · lever ${a.thr.toFixed(2)} · ${a.state}`);
  check(a.left === 0, 'the traffic craft is gone (no twin flies on)');
  await step(20);
  const after = await ev(() => { const g = VR.game, P = g.starships.pilot; g.starships.beforeSave(g.meta); return { y: P ? P.pos[1] : null, kept: (g.meta.starships || []).some(s => /^tr-/.test(s.key)) }; });
  check(after.y !== null && after.y > 100, 'it flies on in the air (no drop to the ground)', after.y);
  check(after.kept, 'the ship is kept with the world\'s ships');
}
check(!errs.length, 'no page error', errs[0]);
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
