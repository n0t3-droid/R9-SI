// find a sky-rail viaduct near spawn and photograph it from the side, from the deck and at a station
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const W = +(process.env.W || 960), H = +(process.env.H || 540);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail|rail gen/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: g.world.lastWant || 0 }; }); if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && i > 3) break; await wait(100); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
const seed = process.env.SEED || '424242';
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.applySettings('*'); }, process.env.PRESET || 'high');
await ev(`VR.game.createWorld({name:'Rails',mode:'creative',difficulty:'peaceful',type:'default',seed:'${seed}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; });
const line = await ev((want) => {
  const g = VR.game, gen = new VR.OverworldGen(g.meta.seed >>> 0, {}), VG = VR.VillageGen, RG = VR.RailGen, p = g.player.pos;
  const cand = [], seen = new Set();
  for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) {
    const s = VG.site(gen, Math.floor(p[0] / VG.CELL) + i, Math.floor(p[2] / VG.CELL) + j); if (!s) continue;
    const lk = RG.linkFrom(gen, s); if (!lk || seen.has(lk.key)) continue; seen.add(lk.key);
    const L = RG.line(gen, lk); if (!L) continue;
    let bi = 0, bh = -1; for (let k = 20; k < L.pts.length - 20; k++) { const h = L.Y[k] - L.ground[k]; if (h > bh && L.pts[k][2] !== 2) { bh = h; bi = k; } }
    const d = Math.hypot(L.pts[bi][0] - p[0], L.pts[bi][1] - p[2]);
    cand.push({ key: L.key, tech: L.tech, n: L.pts.length, hi: bh, d: Math.round(d), mid: [L.pts[bi][0], L.Y[bi], L.pts[bi][1], L.pts[bi][2]], st: [L.pts[0][0], L.Y[0], L.pts[0][1], L.pts[0][2]], dir0: [Math.sign(L.pts[1][0] - L.pts[0][0]), Math.sign(L.pts[1][1] - L.pts[0][1])], corner: (L.pts.find(q => q[2] === 2) || null) });
  }
  cand.sort((a, b) => (want === 'tech' ? (b.tech - a.tech) : 0) || (b.hi > 14) - (a.hi > 14) || a.d - b.d);
  return { n: cand.length, list: cand.slice(0, 6) };
}, process.env.WANT || '');
console.log(JSON.stringify(line, null, 0));
const L = line.list[+(process.env.PICK || 0)];
if (L) {
  const [x, y, z, dir] = L.mid;
  // side view: step 36 blocks sideways from the line, a little above the deck
  const sx = dir === 1 ? 1 : 0, sz = dir === 1 ? 0 : 1;
  const cam = [x + sx * 38, y + 8, z + sz * 38];
  await ev(([c, t]) => { const p = VR.game.player; p.flying = true; p.teleport(c[0], c[1], c[2]); p.yaw = Math.atan2(-(t[0] - c[0]), -(t[2] - c[2])); p.pitch = -0.12; VR.game.env.setTime(3000); }, [cam, [x, y - 6, z]]);
  await settle(120); await step(30);
  await shot('rail_side');
  await ev(() => VR.game.env.setTime(11900)); await step(4); await shot('rail_side_dusk');
  await ev(() => VR.game.env.setTime(16000)); await step(4); await shot('rail_side_night');
  // on the deck looking along the line
  const along = dir === 1 ? [0, 1] : [1, 0];
  await ev(([x, y, z, a]) => { const p = VR.game.player; p.flying = true; p.teleport(x + 0.5 - a[0] * 12, y + 1.8, z + 0.5 - a[1] * 12); p.yaw = Math.atan2(-a[0], -a[1]); p.pitch = -0.08; VR.game.env.setTime(4200); }, [x, y, z, along]);
  await settle(60); await step(20); await shot('rail_deck');
  // the station
  const [qx, qy, qz] = L.st, d0 = L.dir0;
  await ev(([x, y, z, d]) => { const p = VR.game.player; p.flying = true; p.teleport(x + 0.5 + d[1] * 9 - d[0] * 6, y + 3, z + 0.5 + d[0] * 9 - d[1] * 6); p.yaw = Math.atan2(-(x - (x + d[1] * 9 - d[0] * 6)), -(z - (z + d[0] * 9 - d[1] * 6))); p.pitch = -0.2; }, [qx, qy, qz, d0]);
  await settle(60); await step(20); await shot('rail_station');
  if (L.corner) {
    const [cx, cz] = L.corner; const cy = await ev(([x, z]) => { const w = VR.game.world; for (let y = 200; y > 40; y--) { const b = w.getBlock(x, y, z); if (b && VR.R.byId && VR.R.types[b >> 4 >>> 0] && /rail/.test((VR.R.types[b >> 4] || {}).name || '')) return y; } return -1; }, [cx, cz]).catch(() => -1);
    await ev(([x, z, y]) => { const p = VR.game.player; p.flying = true; p.teleport(x + 18, y + 16, z + 18); p.yaw = Math.atan2(-(-18), -(-18)); p.pitch = -0.55; }, [cx, cz, L.mid[1]]);
    await settle(60); await step(20); await shot('rail_corner');
  }
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 30)) console.log(l);
await browser.close();
