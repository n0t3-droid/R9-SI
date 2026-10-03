// villages seen from afar in the far-horizon LOD: day, dusk and night views of a village ~D blocks away
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 900)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const shot = async (name, tod) => { await ev((tod) => { window.__norender = false; const g = VR.game; if (tod !== undefined) g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }, tod); await wait(150); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('shot', name); };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: g.world.lastWant || 0 }; }); if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && i > 3) break; await wait(100); } };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(([hz, rd]) => { const g = VR.game; g.settings.renderDist = rd; g.settings.dynRes = false; g.settings.minimap = false; g.settings.horizon = hz; g.applySettings('renderDist'); }, [+(process.env.HZ || 2), +(process.env.RD || 6)]);
await ev((seed) => VR.game.createWorld({ name: 'FarVillage', mode: 'creative', difficulty: 'peaceful', type: 'default', seed, cheats: true, kit: false }), process.env.SEED || '777');
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { VR.game.env.setTime(3000); VR.game.zenFreezeTime = true; window.requestAnimationFrame = () => 0; VR.game.hideHud = true; document.getElementById('hud') && (document.getElementById('hud').style.visibility = 'hidden'); });
const D = +(process.env.D || 220);
const info = await ev(([D, UP]) => {
  const w = VR.game.world, p = VR.game.player;
  const g = VR.makeGen('overworld', w.seed, w.genOpts || {});
  const VG = VR.VillageGen, C = VG.CELL;
  const ci = Math.floor(p.pos[0] / C), cj = Math.floor(p.pos[2] / C);
  const list = [];
  for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) { const s = VG.site(g, ci + di, cj + dj); if (s) list.push(s); }
  list.sort((a, b) => Math.hypot(a.x - p.pos[0], a.z - p.pos[2]) - Math.hypot(b.x - p.pos[0], b.z - p.pos[2]));
  const s = list[1] || list[0];
  // stand D blocks from its plaza on the line toward the player's spawn, above the terrain
  const dx = p.pos[0] - s.x, dz = p.pos[2] - s.z, L = Math.hypot(dx, dz) || 1;
  const ex = s.x + dx / L * D, ez = s.z + dz / L * D;
  const ey = Math.max(g.surfaceY(Math.round(ex), Math.round(ez)), s.y) + UP;
  return { site: [s.name, s.style, s.x, s.y, s.z], eye: [ex, ey, ez], yaw: Math.atan2(-(s.x - ex), -(s.z - ez)), pitch: -Math.atan2(ey - s.y - 4, D) };
}, [D, +(process.env.UP || 70)]);
console.log(JSON.stringify(info));
await ev(([e, yaw, pitch]) => { const p = VR.game.player; p.teleport(e[0], e[1], e[2]); p.flying = true; p.yaw = yaw; p.pitch = pitch; }, [info.eye, info.yaw, info.pitch]);
await wait(300);
await settle(150);
const st = await ev(() => { const h = VR.game.horizon; return { tiles: h.tiles.size, drawn: h.stats.drawn, tris: Math.round(h.stats.tris / 1000) + 'k' }; });
console.log('settled', JSON.stringify(st));
const tag = process.env.TAG || 'a';
const proj = await ev((site) => { const r = VR.game.renderer, c = r.cam, m = r.viewProj; const x = site[2] - c.x, y = site[3] + 4 - c.y, z = site[4] - c.z; const X = m[0] * x + m[4] * y + m[8] * z + m[12], Y = m[1] * x + m[5] * y + m[9] * z + m[13], W = m[3] * x + m[7] * y + m[11] * z + m[15]; return { px: Math.round((X / W * 0.5 + 0.5) * 1280), py: Math.round((1 - (Y / W * 0.5 + 0.5)) * 720), w: W, cam: [c.x, c.y, c.z].map(Math.round), yaw: VR.game.player.yaw }; }, info.site);
console.log('village on screen at', JSON.stringify(proj));
await shot(`vf_${tag}_day`, 3000);
await shot(`vf_${tag}_dusk`, 12400);
await shot(`vf_${tag}_night`, 16000);
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 25)) console.log(l);
await browser.close();
