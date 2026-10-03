import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n) => { for (let k = 0; k < n; k += 10) { await ev((m) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { this.setupCamera(F.cam); }; } for (let i = 0; i < m; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } }, Math.min(10, n - k)); await wait(20); } };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.renderDist = 5; g.settings.dynRes = false; g.settings.minimap = false; g.applySettings('renderDist'); });
await ev(`VR.game.createWorld({name:'Ship',mode:'creative',difficulty:'normal',type:'default',seed:'${process.env.SEED || '424242'}',cheats:true,kit:true})`);
for (let i = 0; i < 40; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
const out = await ev(() => new Promise((res) => { const g = VR.game, p = g.player; g.pool.direct(0, { type: 'locate', dim: 'overworld', biome: 'outpost', x: Math.floor(p.pos[0]), z: Math.floor(p.pos[2]) }, null, (m) => res(m.pos)); }));
console.log('outpost', JSON.stringify(out));
await ev((o) => { const p = VR.game.player; p.teleport(o[0] + 0.5, o[1] + 14, o[2] + 26.5); p.flying = true; }, out);
for (let i = 0; i < 12; i++) { await step(20); await wait(300); }
const res = await ev((o) => {
  const g = VR.game, w = g.world, R = VR.R, T = R.T, F = VR.F;
  const id = R.byName.helm.id; let helm = null;
  for (let y = o[1] - 3; y < o[1] + 12 && !helm; y++) for (let z = o[2] - 16; z <= o[2] + 16 && !helm; z++) for (let x = o[0] - 16; x <= o[0] + 16; x++) { const s = w.getBlock(x, y, z); if (s && T.type[s] === id) { helm = [x, y, z]; break; } }
  if (!helm) return 'no helm';
  // replicate exclusion
  const ex = new Uint8Array(R.types.length);
  const keep = /^(cobblestone|mossy_cobblestone|sandstone|red_sandstone|terracotta|obsidian|snow_block|moss_block|clay)$/;
  const S = VR.GEN.S(); for (const k in S) { const s = S[k]; if (s) { const t = R.types[T.type[s]]; if (t && !keep.test(t.name)) ex[t.id] = 1; } }
  for (const t of R.types) { if (t.group && /^Natural/.test(t.group) && !/crystal/.test(t.name)) ex[t.id] = 1; if (/_ore$|^bedrock$|^landing_pad$|^launch_beacon$/.test(t.name)) ex[t.id] = 1; }
  const K = (x, y, z) => x + ',' + y + ',' + z;
  const par = new Map([[K(...helm), null]]); const q = [helm];
  const NB = []; for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (dx || dy || dz) NB.push([dx, dy, dz]);
  let found = null;
  while (q.length && !found) { const c = q.shift(); for (const d of NB) { const n = [c[0] + d[0], c[1] + d[1], c[2] + d[2]]; const k = K(...n); if (par.has(k)) continue; const s = w.getBlock(...n); if (!s || (T.flags[s] & F.FLUID) || ex[T.type[s]]) continue; par.set(k, c); q.push(n); if (R.types[T.type[s]].name === 'hazard_stripes' || R.types[T.type[s]].name === 'ladder') { found = n; break; } } }
  if (!found) return 'no path';
  const chain = []; let c = found; while (c) { chain.push(c.map(v => v).join(' ') + ' ' + R.types[T.type[w.getBlock(...c)]].name + ' rel ' + (c[0] - o[0]) + ',' + (c[1] - o[1]) + ',' + (c[2] - o[2])); c = par.get(K(...c)); }
  return chain.slice(0, 30).join('\n');
}, out);
console.log(res);
await browser.close();
