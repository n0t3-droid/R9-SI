// trailer infrastructure (docs/superpowers/plans/2026-10-08-t-infra.md): the moving things of the trailer's shots,
// framed in the game at the trailer's places and times (dusk), before and after the change:
//   viaduct  · t1_05 — a stone-arch viaduct of the Spire Citadel with a tram on its track at dusk
//   station  · t1_01 / t1_03 — the Gate Plaza's canyon-loop station with its tram
//   street   · t3_05 — the Palm City avenue: cyan light lines along both edges, lamps, the street at dusk
//   ride     · the player rides the citadel tram (chase camera, then from inside); after only
// Pictures: test/shots/trailer_infra_<PHASE>_<shot>.png (PHASE = before | after). Also measured: the tram update cost
// on Very Low (potato) per call, and the viaduct shot again on Very Low. PHASE=before frames the same shots without
// the new lines (the picture of the game as it stood); TIME=12100 is dusk (the trailer's sky).
//   PHASE=after bash test/wt_run.sh trailer_infra.mjs 1800   (never in the foreground: see the run notes in the plan)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const PHASE = process.env.PHASE || 'after', W = +(process.env.W || 960), H = +(process.env.H || 540);
const DUSK = +(process.env.TIME || 12100), SEED = process.env.SEED || '424242';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /rail gen|citadel gen|tram|trail/i.test(s) && t !== 'log') logs.push(`[${t}] ${s.slice(0, 600)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto(process.env.DIST || 'file:///home/claude/vr/dist/index.html');   // DIST: another build (the before picture uses HEAD's)
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: g.world.lastWant || 0 }; }); if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && i > 3) break; await wait(100); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/trailer_infra_${PHASE}_${name}.png`, timeout: 120000 }); console.log('shot', name); };
// the camera at c looking at t (the player's look convention: pitch up is positive)
const frame = async (c, t, extra) => { await ev(([c, t]) => { const p = VR.game.player; p.flying = true; p.teleport(c[0], c[1], c[2]); const dx = t[0] - c[0], dy = t[1] - c[1], dz = t[2] - c[2], h = Math.hypot(dx, dz) || 1; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, h); }, [c, t]); await settle(80); if (extra) await extra(); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
const preset = process.env.PRESET || 'high';
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.applySettings('*'); }, preset);
await ev(`VR.game.createWorld({name:'Infra',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev((t) => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; g.env.setTime(t); }, DUSK);

// the citadel viaduct (gen_citadel.js heartSite: a = atan2(-230, 420) from the plinth rim at (-392, 365), y 113)
const VIA = { c: [-251, 121, 328], t: [-268, 106, 298] };
const CAN = { c: [30, 90, 176], t: [62, 82, 140] };
const STREET = { c: [4, 86, -90], t: [0, 82, -150] };
const res = {};
await frame([-300, 130, 330], VIA.t, () => step(4));
await frame(VIA.c, VIA.t, () => step(4));
res.night = await ev(() => VR.game.env.night);   // the headlights glint from 0.12 up (trams.js atmosphere)
await shot('viaduct_dusk');
await frame(CAN.c, CAN.t, () => step(4));
await shot('station_dusk');
await frame(STREET.c, STREET.t, () => step(4));
await shot('street_dusk');
// the player's own tram (the citadel viaduct's line, if the world has it)
const lines = await ev(() => { const T = VR.game.trams; return T ? [...T.lines.values()].map(L => ({ key: L.key, names: L.names, L: Math.round(L.L), stop: L.stop })) : []; });
res.lines = lines.length; console.log('lines', JSON.stringify(lines.slice(0, 12)));
const cit = await ev(() => { const T = VR.game.trams; if (!T) return null; const L = [...T.lines.values()].find(l => /viaduct/.test(l.key) || (l.names || []).some(n => /Citadel|Zitadel/.test(n))); return L ? { key: L.key, L: L.L, T: L.T, period: L.period, off: L.off, p0: L.p[0], p1: L.p[L.p.length - 1] } : null; });
res.citadelLine = !!cit;
if (cit) {
  const dpt = cit.p0;
  await frame([dpt[0] + 14, dpt[1] + 6, dpt[2] - 14], [dpt[0] + 40, dpt[1], dpt[2] + 10], () => step(3));
  await ev(([k]) => { const T = VR.game.trams, L = T.lines.get(k); T.clock = L.period * 40 - L.off + 3; }, [cit.key]);
  await step(2); await shot('viaduct_tram_at_station');
  await ev(([k]) => { const T = VR.game.trams, L = T.lines.get(k); T.clock = L.period * 40 - L.off + 10 + L.T * 0.5; }, [cit.key]);
  await step(2); await shot('viaduct_tram_passing');
  // ride: board at the plinth, chase camera, then from inside
  await ev(([k]) => { const g = VR.game, T = g.trams, L = T.lines.get(k); T.clock = L.period * 41 - L.off + 6; T.update(0); g.player.flying = false; T.board(L.cars[1]); g.camMode = 1; }, [cit.key]);
  await step(30);
  res.riding = await ev(() => { const r = VR.game.gadgets.riding; return r && r.type; });
  await ev(([k]) => { const T = VR.game.trams, L = T.lines.get(k); T.clock = L.period * 41 - L.off + 10 + L.T * 0.45; }, [cit.key]);
  await step(4); await shot('ride_chase');
  await ev(() => { VR.game.camMode = 0; });
  await step(4); await shot('ride_inside');
  await ev(() => { const g = VR.game; if (g.gadgets && g.gadgets.riding) g.gadgets.dismount(); });
}
// the cost of the tram update on Very Low (the same lines, the same clock): ms per call, measured in the page
res.perfHigh = await ev(() => { const T = VR.game.trams; if (!T) return null; const t0 = performance.now(); for (let i = 0; i < 300; i++) T.update(1 / 30); return (performance.now() - t0) / 300; });
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.applySettings('*'); }, 'potato');
await step(10);
res.perfPotato = await ev(() => { const T = VR.game.trams; if (!T) return null; const t0 = performance.now(); for (let i = 0; i < 300; i++) T.update(1 / 30); return (performance.now() - t0) / 300; });
await frame(VIA.c, VIA.t, () => step(4));
await shot('viaduct_dusk_potato');
console.log('perf ms per update: high ' + (res.perfHigh || 0).toFixed(4) + ' · potato ' + (res.perfPotato || 0).toFixed(4));
console.log(JSON.stringify(res));
const bad = logs.filter(l => /pageerror|\[error\]/.test(l));
if (bad.length) console.log(bad.slice(0, 8).join('\n'));
await browser.close();
console.log(bad.length ? 'FAILED ' + bad.length : 'ALL OK');
