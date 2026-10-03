// world survey: photographs the places the trailer shows — spawn/base, the home city, the nearest citadel,
// sky islands and ember canyons — so a build can be compared against the trailer frames side by side.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const W = +(process.env.W || 1296), H = +(process.env.H || 704);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const settle = async (max = 120) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: g.world.lastWant || 0 }; }); if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && i > 3) break; await wait(100); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 180000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = +(window.__rd || 10); g.settings.horizon = 2; g.applySettings('*'); }, process.env.PRESET || 'high');
await ev(`window.__rd=${process.env.RD || 10}; window.__tod=${process.env.TOD || 3200}`);
await ev(`VR.game.createWorld({name:'Town',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '4242'}',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; g.env.setTime(+(window.__tod || 3200)); });

const tag = process.env.TAG || 'town';
const look = async (from, to) => { await ev(([c, t]) => { const pl = VR.game.player; pl.flying = true; pl.teleport(c[0], c[1], c[2]); pl.yaw = Math.atan2(-(t[0] - c[0]), -(t[2] - c[2])); const dh = Math.hypot(t[0] - c[0], t[2] - c[2]); pl.pitch = Math.atan2(t[1] - c[1], dh); }, [from, to]); await settle(120); await step(20); };
// the modern town: site cell from env (CELL="i,j"), else the first modern site near the origin
const site = await ev((cell) => {
  const g = VR.game, gen = new VR.OverworldGen(g.meta.seed >>> 0, { vgen: g.meta.vgen || 3 }), VG = VR.VillageGen;
  let s = null;
  if (cell) { const [i, j] = cell.split(',').map(Number); s = VG.site(gen, i, j); }
  else for (let r = 1; r <= 5 && !s; r++) for (let i = -r; i <= r && !s; i++) for (let j = -r; j <= r && !s; j++) { const c = VG.site(gen, i, j); if (c && c.style === 'modern') s = c; }
  if (!s) return null;
  const plan = VG.plan(gen, s);
  const hall = plan.work.find(w => w.kind === 'hall'), school = plan.work.find(w => w.kind === 'school'), fac = plan.work.find(w => w.kind === 'factory');
  const home = plan.homes[0], homeB = plan.homes.find(h => h.w === 18) || plan.homes[1];
  const c = (b) => b ? [(b.box[0] + b.box[3]) / 2, b.box[1], (b.box[2] + b.box[5]) / 2, b.box[3] - b.box[0], b.box[5] - b.box[2], b.r, b.outside] : null;
  return { x: s.x, z: s.z, y: plan.center[1], name: s.name, homes: plan.homes.length, hall: c(hall), school: c(school), fac: c(fac), home: c(home), homeB: c(homeB), plaza: plan.plaza };
}, process.env.CELL || null);
console.log('site', JSON.stringify(site));
if (site) {
  const Y = site.y;
  await look([site.x + 110, Y + 90, site.z + 150], [site.x, Y, site.z]); await shot(`tn_${tag}_1_aerial`);
  await look([site.x + 3, Y + 1.6, site.z + 14], [site.x, Y + 2, site.z - 20]); await shot(`tn_${tag}_2_plaza`);
  const front = (b, dist, h) => { if (!b) return null; const o = b[6]; const dir = [[0, -1], [1, 0], [0, 1], [-1, 0]][b[5]]; return [[o[0] + 0.5 + dir[0] * dist, o[1] + h, o[2] + 0.5 + dir[1] * dist], [b[0], b[1] + 2, b[2]]]; };
  const h = front(site.hall, 26, 6); if (h) { await look(h[0], h[1]); await shot(`tn_${tag}_3_mansion`); }
  const a = front(site.homeB || site.home, 11, 3); if (a) { await look([a[0][0] + 6, a[0][1], a[0][2]], a[1]); await shot(`tn_${tag}_4_house`); }
  const b = front(site.home, 16, 4); if (b) { await look(b[0], b[1]); await shot(`tn_${tag}_5_villa`); }
  const s2 = front(site.school, 18, 4); if (s2) { await look(s2[0], s2[1]); await shot(`tn_${tag}_6_school`); }
  const f = front(site.fac, 20, 5); if (f) { await look(f[0], f[1]); await shot(`tn_${tag}_7_factory`); }
  // inside a home: living room
  if (site.home) { const o = site.home[6]; const dir = [[0, -1], [1, 0], [0, 1], [-1, 0]][site.home[5]]; await look([o[0] + 0.5 - dir[0] * 5, o[1] + 2.6, o[2] + 0.5 - dir[1] * 5], [o[0] + 0.5 - dir[0] * 9 - dir[1] * 4, o[1] + 1.5, o[2] + 0.5 - dir[1] * 9 + dir[0] * 4]); await shot(`tn_${tag}_8_inside`); }
  await look([site.x - 40, Y + 1.7, site.z + 45], [site.x + 10, Y + 3, site.z + 10]); await shot(`tn_${tag}_9_street`);
  const budget = await ev(() => { const w = VR.game.world; const tot = [0, 0, 0, 0, 0]; let secs = 0, ram = 0; for (const c of w.cols.values()) for (const s of (c.sec || [])) { if (!s || !s.mesh) continue; secs++; for (let l = 0; l < 5; l++) if (s.mesh[l]) tot[l] += s.mesh[l].cap * 16; if (s.vxData) ram += s.vxData.byteLength; } return { secs, MB: tot.map(b => (b / 1048576).toFixed(1)), vxRamMB: (ram / 1048576).toFixed(1), gpuMB: VR.game.renderer.gpuMemoryMB().toFixed(1) }; });
  console.log('geometry MB on GPU [opaque, cutout, trans, vxDetail(resident), vxFar]:', JSON.stringify(budget));
  await ev(() => VR.game.env.setTime(15500)); await look([site.x - 40, Y + 1.7, site.z + 45], [site.x + 10, Y + 3, site.z + 10]); await shot(`tn_${tag}_10_night`);
  const h2 = front(site.hall, 30, 5); if (h2) { await look(h2[0], h2[1]); await shot(`tn_${tag}_11_mansion_night`); }
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
await browser.close();
