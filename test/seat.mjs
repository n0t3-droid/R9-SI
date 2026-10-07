// Seats: right-clicking any part of a multi-part seat model (gaming chair, egg chair, daybed) seats the player at the
// height of the model's lowest cell (its anchor). Before, the seat read the clicked block, so the top half of a two-block
// chair seated the player one block too high. Checks every part of the three models, in all four facings: the feet
// (player.pos) and the eye (the seated camera, game.cam) sit at anchor + 0.4 / anchor + 1.45 whichever part was clicked.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const PORT = 8765 + Math.floor(Math.random() * 400);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', '/home/claude/vr/dist'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const URL0 = `http://127.0.0.1:${PORT}`;
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } });
const game = await ctx.newPage();
const logs = [];
game.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const ev = (fn, a) => game.evaluate(fn, a);

await game.goto(URL0 + '/index.html');
for (let i = 0; i < 160; i++) { await game.waitForTimeout(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 4; g.settings.horizon = 0; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Seats',mode:'creative',difficulty:'peaceful',seed:'4711',cheats:true,kit:false})`);
for (let i = 0; i < 120; i++) { await game.waitForTimeout(1000); if (await ev(() => VR.game.state) === 'play') break; }

const res = await ev(() => {
  const g = VR.game, w = g.world, p = g.player, R = VR.R, VM = VR.VM;
  // frames without drawing (software GL is slow); the seated camera is still set up for each frame (game.cam)
  if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
  window.__norender = true;
  const frame = () => { g.last = performance.now() - 33; g.loop(performance.now()); };
  const models = ['vm_office_chair_gaming', 'vm_garden_eggchair_rattan', 'vm_garden_daybed_canopy'];
  const x0 = Math.floor(p.pos[0]) + 3, z0 = Math.floor(p.pos[2]) - 4, y0 = Math.floor(p.pos[1]) + 7;   // in the air, above the player
  const out = []; let j = 0;
  for (const name of models) for (const f of [0, 1, 2, 3]) {
    const t = R.byName[name], m = VM.MODELS[name];
    const x = x0 + (j % 6) * 4, z = z0 + Math.floor(j / 6) * 4; j++;
    const fp = VM.footprint(m, f);
    for (const [dx, dy, dz, i] of fp) w.setBlock(x + dx, y0 + dy, z + dz, t.state({ facing: f, part: i }), 0);
    const rows = [];
    for (const [dx, dy, dz, i] of fp) {
      if (g.gadgets.riding) g.gadgets.dismount();
      const bx = x + dx, by = y0 + dy, bz = z + dz;
      const used = g.interactBlock(bx, by, bz, w.getBlock(bx, by, bz), p);
      frame(); frame();
      rows.push({ part: i, dy, used, seated: !!(g.gadgets.riding && g.gadgets.riding.type === 'seat'), feet: +p.pos[1].toFixed(3), eye: +g.cam.y.toFixed(3) });
    }
    if (g.gadgets.riding) g.gadgets.dismount();
    out.push({ name, f, anchor: y0, rows });
  }
  return out;
});

for (const { name, f, anchor, rows } of res) {
  const want = { feet: anchor + 0.4, eye: anchor + 1.45 };
  const bad = rows.filter(q => !q.used || !q.seated || Math.abs(q.feet - want.feet) > 0.01 || Math.abs(q.eye - want.eye) > 0.01);
  const top = rows.filter(q => q.dy > 0).map(q => `part ${q.part} (+${q.dy}) feet ${q.feet}`).join(', ') || 'no upper part';
  check(rows.length > 0 && bad.length === 0, `${name} facing ${f}: all ${rows.length} parts seat at anchor ${anchor}: feet ${want.feet}, eye ${want.eye}` +
    (bad.length ? ' — off: ' + bad.map(q => `part ${q.part} (+${q.dy}) feet ${q.feet} eye ${q.eye}${q.used && q.seated ? '' : ' not seated'}`).join(', ') : ' (' + top + ')'));
}
const gaming = res.find(r => r.name === 'vm_office_chair_gaming' && r.f === 0);
if (gaming) {
  const bottom = gaming.rows.find(q => q.dy === 0), upper = gaming.rows.find(q => q.dy > 0);
  check(bottom && upper && Math.abs(upper.feet - bottom.feet) < 0.01 && Math.abs(upper.eye - bottom.eye) < 0.01, `the gaming chair's top half seats the player as high as its foot (feet ${upper && upper.feet} vs ${bottom && bottom.feet}, eye ${upper && upper.eye} vs ${bottom && bottom.eye})`);
}

console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
check(!logs.some(l => /pageerror/.test(l)), 'no page errors');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close(); srv.kill(); process.exit(fails ? 1 : 0);
