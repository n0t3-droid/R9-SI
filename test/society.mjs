// modern-town society check: kids in class, workers at machines, clerks at desks, café & park use
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 800)));
page.on('console', m => { if (m.type() === 'error') logs.push('[error] ' + m.text().slice(0, 400)); });
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Soc',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.env.rain = 0; g.hideHud = true; window.requestAnimationFrame = () => 0; const R = g.renderer; R._render = R.render; R.render = function (F) { this.setupCamera(F.cam); }; const pl = g.player; pl.flying = true; pl.teleport(-740, 90, 168); });
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const run = async (tod, secs) => {
  await ev(([tod, secs]) => { const g = VR.game; g.env.setTime(tod); g.zenFreezeTime = true; let t = performance.now(); for (let i = 0; i < secs * 20; i++) { t += 50; g.last = t - 50; g.loop(t); } }, [tod, secs]);
  await wait(200);
};
// load the town, then run a school morning and an evening
for (let i = 0; i < 40; i++) { await run(3000, 1); const s = await ev(() => ({ busy: VR.game.pool.busy, pend: VR.game.world.pending.size })); if (s.busy === 0 && s.pend === 0 && i > 5) break; await wait(300); }
const report = async (label) => {
  const r = await ev(() => {
    const g = VR.game, V = g.villages; const vil = [...V.known.values()].find(v => v.plan && v.plan.style === 'modern');
    if (!vil) return { none: true, known: [...V.known.values()].map(v => v.plan && v.plan.style) };
    const acts = {}, poses = {}, roles = {};
    for (const a of vil.agents) { const k = (a.kid ? 'kid:' : a.elder ? 'elder:' : '') + (a.act ? a.act.type : '-'); acts[k] = (acts[k] || 0) + 1; poses[a.pose] = (poses[a.pose] || 0) + 1; roles[a.role] = (roles[a.role] || 0) + 1; }
    const kids = vil.agents.filter(a => a.kid), sitting = kids.filter(a => a.act && a.act.type === 'school' && a.pose === 'sit').length;
    return { name: vil.name, agents: vil.agents.length, roles, acts, poses, kidsInClassSitting: sitting + '/' + kids.length, work: Object.keys(vil.workOf), desks: (vil.workOf.teacher && vil.workOf.teacher[0].desks || []).length };
  });
  console.log(label, JSON.stringify(r));
  if (label.startsWith('school')) check(!r.none && parseInt(r.kidsInClassSitting) > 0, 'kids sit in class at school time (' + (r.kidsInClassSitting || 'no modern town') + ')');
};
await run(3000, 90); await report('school 3000');
await run(6200, 60); await report('lunch 6200');
await run(8000, 60); await report('afternoon 8000');
await run(11200, 60); await report('evening 11200');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 8)) console.log(l);
check(!logs.some(l => /pageerror\]/.test(l)), 'no page errors');
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
