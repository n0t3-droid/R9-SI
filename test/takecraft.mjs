// v0.56.2 · „Einsteigen und losfliegen": a visiting craft parked on the Gate Temple's apron can be boarded with the
// Aktion (V) — it becomes a ship of yours (Starships), you sit at its controls, its visit is struck from the pad.
//   bash test/wt_run.sh takecraft.mjs 900
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
await ev(`VR.game.createWorld({name:'Flug',mode:'creative',difficulty:'peaceful',type:'default',seed:'53',cheats:true,kit:true})`);
for (let i = 0; i < 120; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { window.requestAnimationFrame = () => 0; const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(50, 89, 30); });
let parked = null;
for (let k = 0; k < 60 && !parked; k++) {
  await step(10);
  if (k === 2) await ev(() => VR.game.padLife.jump('apron', 'crew'));
  parked = await ev(() => { const A = VR.game.padLife, pad = A && A.pads.get('apron'); if (!pad || !pad.live) return null; const q = pad.live.find(q => q.phase === 'parked'); const c = q && pad.crafts.get(q.m); return c && c.d && c.d.meta && c.d.cells ? { m: q.m, pos: c.inst.pos.slice(), len: c.d.meta.length } : null; });
}
check(!!parked, 'a craft is parked on the apron with its design built', parked && JSON.stringify(parked));
if (parked) {
  // stand 3 m off its hull (walk out from its middle along +x until clear), look at its middle
  const res = await ev((P) => {
    const g = VR.game, p = g.player, A = g.padLife, pad = A.pads.get('apron'), c = pad.crafts.get(P.m), I = c.inst, SS = g.starships, m = c.d.meta;
    const cy = I.pos[1] + m.height * 0.4; let x = I.pos[0];
    while (x < I.pos[0] + 60 && (SS.inOcc(I, Math.floor(x), Math.floor(cy), Math.floor(I.pos[2])) || SS.inOcc(I, Math.floor(x), Math.floor(cy) - 1, Math.floor(I.pos[2])))) x += 0.5;
    x += 3; p.teleport(x, cy - 1.62, I.pos[2] + 0.5); p.yaw = Math.PI / 2; p.pitch = 0;
    const cg = VR.Ctx.gather(g), r = VR.Ctx.resolve(cg);
    return { kind: cg.near && cg.near.kind, key: r.key, hooked: !!VR.PadLife.__ctx, n: A.nearCrafts(p.eyePos ? p.eyePos() : [x, cy, I.pos[2]], []).length, x, eye: p.eyePos && p.eyePos(), dir: p.lookDir && p.lookDir() };
  }, parked);
  console.log('   ', JSON.stringify(res));
  check(res.kind === 'craft' && res.key === 'g.ctx.takeCraft', 'the Aktion offers „Einsteigen und losfliegen"', res.kind + ' · ' + res.key);
  const after = await ev(() => { const g = VR.game, c = VR.Ctx.gather(g), r = VR.Ctx.resolve(c); const ok = VR.Ctx.act(g, r); const pad = g.padLife.pads.get('apron'); return { ok, pilot: !!(g.starships && g.starships.pilot), key: g.starships.pilot && g.starships.pilot.key, taken: pad.taken ? [...pad.taken] : [], live: pad.live.map(q => q.m) }; });
  check(after.ok && after.pilot, 'V takes the pilot seat of a ship of yours', JSON.stringify(after));
  check(after.taken.includes(parked.m) && !after.live.includes(parked.m), 'its visit is struck from the pad (no second craft drawn in its place)');
  await step(20);
  const kept = await ev(() => { const g = VR.game; g.starships.beforeSave(g.meta); return (g.meta.starships || []).some(s => /^pl-apron-/.test(s.key)); });
  check(kept, 'the ship is kept with the world\'s ships');
}
check(!errs.length, 'no page error', errs[0]);
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
