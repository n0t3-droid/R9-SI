// build a little house near a village: a family should move in
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }); await wait(150); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.renderDist = 6; g.settings.dynRes = false; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Homes',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '424242'}',cheats:true,kit:false})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { VR.game.env.setTime(3200); VR.game.zenFreezeTime = true; window.requestAnimationFrame = () => 0; });
for (let i = 0; i < 12; i++) { await step(10); await wait(80); }
const r = await ev(() => {
  const g = VR.game, V = g.villages, w = g.world, R = VR.R;
  const vil = [...V.known.values()].find(v => v.active); if (!vil) return null;
  const pz = vil.plan.plaza;
  // find a flat-ish free spot ~70 blocks out
  let best = null;
  for (let a = 0; a < 16 && !best; a++) {
    const an = a / 16 * Math.PI * 2, cx = Math.round(pz.x + Math.cos(an) * 72), cz = Math.round(pz.z + Math.sin(an) * 72);
    if (!w.isLoaded(cx, cz)) continue;
    let mn = 999, mx = -1; for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) { const h = w.topAt(cx + dx, cz + dz); mn = Math.min(mn, h); mx = Math.max(mx, h); }
    if (mx - mn <= 3 || a === 15) best = [cx, Math.min(mx, mn + 3), cz];
  }
  if (!best) return { err: 'no spot' };
  const [cx, gy, cz] = best, y0 = gy + 1;
  const st = (n, p) => { const t = R.byName[n]; return p ? t.state(p) : t.defaultState; };
  const set = (x, y, z, s) => w.setBlock(x, y, z, s, 0);
  // clear, floor, walls, roof
  for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) { for (let y = y0; y < y0 + 14; y++) set(cx + dx, y, cz + dz, 0); for (let y = y0 - 3; y < y0; y++) set(cx + dx, y, cz + dz, st('dirt')); }
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) { set(cx + dx, y0, cz + dz, st('stone_bricks')); set(cx + dx, y0 + 4, cz + dz, st('oak_planks')); }
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) { if (Math.abs(dx) !== 3 && Math.abs(dz) !== 3) continue; for (let y = y0 + 1; y <= y0 + 3; y++) set(cx + dx, y, cz + dz, st('oak_planks')); }
  // door in the south wall (+z), facing south
  const dt = R.byName.oak_door;
  set(cx, y0 + 1, cz + 3, dt.state({ facing: 2, half: 0, open: 0, hinge: 0 })); set(cx, y0 + 2, cz + 3, dt.state({ facing: 2, half: 1, open: 0, hinge: 0 }));
  // two beds along the north wall, heads north (facing 0)
  const bt = R.byName.red_bed;
  for (const bx of [cx - 1, cx + 1]) { set(bx, y0 + 1, cz - 1, bt.state({ facing: 0, part: 0 })); set(bx, y0 + 1, cz - 2, bt.state({ facing: 0, part: 1 })); }
  set(cx + 2, y0 + 3, cz + 2, st('torch') || 0);
  return { vil: vil.name, at: [cx, y0, cz], people: vil.people.length };
});
console.log(JSON.stringify(r));
for (let i = 0; i < 6; i++) { await step(10); await wait(60); }
const r2 = await ev(() => { const g = VR.game, V = g.villages; const vil = [...V.known.values()].find(v => v.active); return { custom: (vil.st.custom || []).map(h => ({ beds: h.beds.length, door: h.door, inside: h.inside, outside: h.outside })), people: vil.people.length, agents: vil.agents.length, fam: vil.fams[vil.fams.length - 1].members.map(m => m.name + '/' + m.age + '/' + m.role) }; });
console.log(JSON.stringify(r2));
console.log('DBG', JSON.stringify(await ev(() => { const g = VR.game, V = g.villages; const vil = [...V.known.values()].find(v => v.active); const W = vil.homeWatch || []; return { watch: W, t: vil.homeCheckT, res: W.length ? (() => { const r = V.checkRoom(vil, W[0]); return Object.assign({}, r, { cells: r.cells }); })() : null, hint: (document.getElementById('hint') || {}).textContent }; })));
if (r && r.at) {
  await ev((at) => { const p = VR.game.player; p.teleport(at[0] + 0.5, at[1] + 3, at[2] + 11); p.flying = true; p.yaw = 0; p.pitch = -0.2; }, r.at);
  for (let i = 0; i < 4; i++) { await step(10); await wait(60); }
  await shot('homes_family');
  // at night they sleep in the beds we placed
  await ev(() => VR.game.env.setTime(15000));
  for (let i = 0; i < 20; i++) { await step(20); await wait(40); }
  console.log(JSON.stringify(await ev(() => { const g = VR.game, V = g.villages; const vil = [...V.known.values()].find(v => v.active); const fam = vil.fams[vil.fams.length - 1]; return vil.agents.filter(a => a.p.fam === fam.id).map(a => [a.p.name, a.pose, a.act && a.act.type, a.pos.map(Math.round)]); })));
}
console.log('PATH', JSON.stringify(await ev(() => { const g = VR.game, V = g.villages; const vil = [...V.known.values()].find(v => v.active); const fam = vil.fams[vil.fams.length - 1]; const a = vil.agents.find(x => x.p.fam === fam.id); if (!a) return null; const b = a.p.bed; const f = b[3]; const sx = b[0] - VR.HF_DX[f], sz = b[2] - VR.HF_DZ[f]; const from = [Math.floor(a.pos[0]), Math.floor(a.pos[1] + 0.05), Math.floor(a.pos[2])]; const res = VR.Folk.findPath(g.world, from, [sx, b[1], sz], { near: 1, partial: true, max: 2400 }); const w = g.world; const blk = (x, y, z) => { const s = w.getBlock(x, y, z); return s ? VR.R.types[VR.R.T.type[s]].name + JSON.stringify(VR.R.types[VR.R.T.type[s]].decode(s)) : 'air'; }; return { from, to: [sx, b[1], sz], bed: b, res: res && { complete: res.complete, len: res.path.length, last: res.path[res.path.length - 1] }, door: blk(196, 91, 75), doorUp: blk(196, 92, 75), below: blk(196, 90, 76), goal: a.goal, fails: a.fails, act: a.act && a.act.type, pose: a.pose }; })));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 25)) console.log(l);
await browser.close();
