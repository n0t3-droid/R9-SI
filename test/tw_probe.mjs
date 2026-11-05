// t-film probe (regress: skip): the Heartland's anchors for the 'welt' trailer — the spawn, the nearest village and
// outpost, the fairy places, the Sky Isles — each photographed once (High, 1280 × 720), and the cost of one frame
// captured by canvas.toDataURL vs page.screenshot. Exploration only, no checks.
//   nohup bash test/wt_run.sh tw_probe.mjs 3600 > .tmp_tests/tw_probe.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = ROOT + '/test/shots/';
const W = +(process.env.W || 1280), H = +(process.env.H || 720);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, locale: 'de-DE' });
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 600)));
await page.goto('file://' + ROOT + '/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title').catch(() => false)) break; }
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 12; g.settings.horizon = 2; g.applySettings('*'); }, process.env.PRESET || 'high');
await ev(`VR.game.createWorld({name:'Welt',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '4242'}',cheats:true,kit:true})`);
for (let i = 0; i < 120; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.rain = 0; g.env.rainTarget = 0; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(6000); g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.visibility = 'hidden'; const R = g.renderer; R._render = R.render; R.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; window.__norender = true; if (VR.Adventure) { VR.Adventure.setOn(true); VR.Adventure.setEnc('off'); } });
const step = async (n, d = 50) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), d]); await wait(3); } };
const settle = async (max = 200) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0 }; }); if (s.busy === 0 && s.pend === 0 && !s.lod && i > 3) break; await wait(80); } };
const look = async (c, t) => { await ev(([c, t]) => { const pl = VR.game.player; pl.flying = true; pl.noClip = true; pl.teleport(c[0], c[1] - pl.eye, c[2]); pl.yaw = Math.atan2(-(t[0] - c[0]), -(t[2] - c[2])); pl.pitch = Math.atan2(t[1] - c[1], Math.hypot(t[0] - c[0], t[2] - c[2])); }, [c, t]); await settle(); };
const grab = async (name) => {
  const t0 = Date.now();
  const url = await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/jpeg', 0.9); window.__norender = true; return u; });
  fs.writeFileSync(SHOTS + name + '.jpg', Buffer.from(url.split(',')[1], 'base64'));
  console.log('  shot ' + name + ' ' + (Date.now() - t0) + ' ms');
};
const locate = (kind) => ev((kind) => new Promise((res) => { const g = VR.game, p = g.player; g.pool.direct(0, { type: 'locate', dim: 'overworld', biome: kind, x: Math.floor(p.pos[0]), z: Math.floor(p.pos[2]) }, null, (m) => res(m && m.pos)); setTimeout(() => res(null), 20000); }), kind);
await settle();
const sp = await ev(() => VR.game.player.pos.map(Math.round));
const vil = await locate('village'), out = await locate('outpost');
const fairy = await ev(() => VR.Fairy && VR.Fairy.debug ? VR.Fairy.debug.sites().map(s => ({ kind: s.kind, x: s.x, y: s.y, z: s.z })) : null);
console.log('spawn', JSON.stringify(sp), 'village', JSON.stringify(vil), 'outpost', JSON.stringify(out));
console.log('fairy', JSON.stringify(fairy));
// timing: screenshot vs toDataURL
let t0 = Date.now();
await ev(() => { window.__norender = false; const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; });
await page.screenshot({ path: SHOTS + 'tw_probe_ss.png', timeout: 240000 }); console.log('screenshot ms', Date.now() - t0);
await grab('tw_probe_spawn');
t0 = Date.now(); await step(10, 42); console.log('10 steps ms (no render)', Date.now() - t0);
const ty = (x, z) => ev(([x, z]) => VR.game.world.topAt(Math.floor(x), Math.floor(z)), [x, z]);
if (vil) { const y = await ty(vil[0], vil[2]); await look([vil[0] + 34, (y || vil[1]) + 16, vil[2] + 34], [vil[0], (y || vil[1]) + 2, vil[2]]); await grab('tw_probe_village'); const vs = await ev(() => { const V = VR.game.villages; const out = []; if (V && V.known) for (const v of V.known.values()) out.push({ name: v.name, plaza: v.plan && v.plan.plaza, n: (v.people || v.folk || []).length }); return out; }); console.log('villages', JSON.stringify(vs).slice(0, 600)); }
if (out) { const y = await ty(out[0], out[2]); await look([out[0] + 24, (y || out[1]) + 10, out[2] + 24], [out[0], (y || out[1]) + 2, out[2]]); await grab('tw_probe_outpost'); const ss = await ev(() => [...VR.Liberate.sites().values()].map(s => ({ id: s.id, st: s.st, b: s.beacon, known: s.known }))); console.log('sites', JSON.stringify(ss).slice(0, 500)); }
for (const f of (fairy || [])) { if (f.y === null) continue; await look([f.x + 22, f.y + 9, f.z + 22], [f.x, f.y + 3, f.z]); await grab('tw_probe_fairy_' + f.kind); }
await look([175, 150, 150], [330, 146, 140]); await grab('tw_probe_isles');
const vl = await ev(() => { const g = VR.game; return { vgen: g.meta.vgen, type: g.meta.type }; }); console.log('meta', JSON.stringify(vl));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 8)) console.log(l);
await browser.close();
