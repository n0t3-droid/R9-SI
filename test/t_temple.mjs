// Trailer shots D (Gate Temple approach) and E (Hangar Hall), framed in the game (TRAILER.md §1 and §4; the frames in
// docs/trailer/frames). One browser run photographs every shot: test/shots/trailer_<shot>_<TAG>.png
// (TAG=base before the wave, TAG=after later). PRESET=high, TOD=3200 (dusk), SEED=4242 by default.
// SHOTS=approach,approach2,portal,veil,mouth,hall,pad,pad2,walkout,backdoor,exit,window,city (default: all) · VERYLOW=1 adds
// the Very Low cost measure and pictures of the hall view.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const W = +(process.env.W || 1296), H = +(process.env.H || 704);
const TAG = process.env.TAG || 'base';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
// DIST=<dir> loads another build (the before picture is built from git HEAD); default: this checkout's dist
await page.goto('file://' + (process.env.DIST || '/home/claude/vr/dist') + '/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const settle = async (max = 400) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: g.world.lastWant || 0 }; }); if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && i > 3) break; await wait(100); } };
// a picture; on the shared machine a screenshot can stall (run 3's verylow_hall timed out after 180 s): one more try,
// then the run goes on without it (the verdict still prints)
const shot = async (name) => {
  for (let k = 0; k < 2; k++) {
    try {
      await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; });
      await page.screenshot({ path: `/home/claude/vr/test/shots/trailer_${name}_${TAG}.png`, timeout: 180000 });
      console.log('shot', name); return true;
    } catch (e) { console.log('shot', name, 'failed (' + (k ? 'gave up' : 'trying again') + '):', String(e.message || e).split('\n')[0]); }
  }
  missed.push(name); return false;
};
const missed = [];
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(`window.__hz=${process.env.HZ === undefined ? 2 : +process.env.HZ}`);
const PRESET = process.env.PRESET || 'high';
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 16; g.settings.horizon = window.__hz === undefined ? 2 : window.__hz; g.applySettings('*'); }, PRESET);
await ev(`VR.game.createWorld({name:'TrailerD',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '4242'}',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev((tod) => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; g.env.setTime(tod); }, +(process.env.TOD || 3200));
// a camera place (from), a target (to), an optional pitch (null: aim at the target)
const look = async (from, to, pitch) => { await ev(([c, t, p]) => { const pl = VR.game.player; pl.flying = true; pl.teleport(c[0], c[1], c[2]); pl.yaw = Math.atan2(-(t[0] - c[0]), -(t[2] - c[2])); pl.pitch = p !== null ? p : Math.atan2(t[1] - c[1], Math.hypot(t[0] - c[0], t[2] - c[2])); }, [from, to, pitch]); await settle(200); await step(20); };
const ALL = ['approach', 'approach2', 'portal', 'veil', 'mouth', 'hall', 'pad', 'pad2', 'walkout', 'backdoor', 'exit', 'window', 'city', 'approach2_dusk', 'portal_dusk', 'window_dusk'];
const shots = (process.env.SHOTS || ALL.join(',')).split(',');
// from, to, pitch (null: aim at the target); fly: where the Gate Temple's shuttle is in its loop (hangarflight.js: a leg and
// a fraction of it, or the approach where it crosses z heading north); pt: where the crew is in its walk (hall.js)
const SHOT = {
  // D: the temple from the far end of the plaza, the shuttle skimming in down the runway (t3_03 / t1_10 framing)
  approach: { from: [0.5, 83, 132], to: [0, 88, 6], fly: { phase: 'air', z: 92 }, pt: 8 },
  // D (t3_03 / t1_10, new): behind the shuttle, low over the plaza, as it flies at the hangar mouth
  approach2: { from: [0.5, 86, 104], to: [0.5, 88, 20], fly: { phase: 'air', z: 80 }, pt: 8 },
  // D (t1_11): the octagonal portal from the plaza, the shuttle half way through it
  portal: { from: [0.5, 83, 40], to: [0, 88, 20], fly: { phase: 'in', at: 0.36 }, pt: 8 },
  // D (t3_04 colours): through the gate's veil down the hall, the shuttle on the pad beyond it
  veil: { from: [0.5, 83.6, 34], to: [0, 88, -80], fly: { phase: 'pad', at: 0.5 }, pt: 8 },
  // E (t1_19, new): from the pad end past the heroes at the consoles to the mouth, the shuttle hovering in it
  mouth: { from: [0.5, 82.2, -8], to: [0.5, 85.5, 20], fly: { phase: 'in', at: 0.22 }, pt: 8 },
  // E: the hall from the front end down the axis, the shuttle settling onto the pad
  hall: { from: [0.5, 83.2, 16], to: [0, 86, -36], fly: { phase: 'settle', at: 0.4 }, pt: 8 },
  // E (t1_16 / t1_17): the pad from the front end, the heroes at the sides, the shuttle lifting and turning
  pad: { from: [0.5, 82.8, 10], to: [0, 82.6, -10], fly: { phase: 'turn', at: 0.95 }, pt: 8 },
  // E (t1_16 / t1_17, new): closer, the shuttle hovering over the pad nose to the camera, its jets burning
  pad2: { from: [0.5, 83.6, 6.5], to: [0.5, 85.5, -10], fly: { phase: 'turn', at: 0.97 }, pt: 8 },
  // E (t2_20, new): the heroes walking toward the back door, their backs to the camera
  walkout: { from: [0.5, 84, -24], to: [0.5, 84, -45], fly: { phase: 'air', z: 400 }, pt: 57 },
  // E: the octagonal back door, the corridor out to the city (the heroes walking out in it)
  backdoor: { from: [0.5, 83.5, -36], to: [0, 88, -80], fly: { phase: 'air', z: 400 }, pt: 64.3 },
  // E (t1_21, new): in the corridor behind the heroes as they walk out to the veil and the city
  exit: { from: [0.5, 82.6, -41.5], to: [0.5, 84, -60], pt: 64.3 },
  // D (t3_04, new): the portal as a window — the corridor's veil with the palm city through it
  window: { from: [0.5, 83.4, -43.2], to: [0.5, 84.5, -60], pt: 8 },
  // E: out of the back door, the palm city close up (t1_24)
  city: { from: [0.5, 83.5, -50], to: [0, 90, -110], pt: 8 },
  // the frames' hour: just after sunset (tod 12350), the lights and the veil glowing against a violet sky
  approach2_dusk: { from: [0.5, 86, 104], to: [0.5, 88, 20], fly: { phase: 'air', z: 80 }, pt: 8, tod: 12350 },
  portal_dusk: { from: [0.5, 83, 40], to: [0, 88, 20], fly: { phase: 'in', at: 0.36 }, pt: 8, tod: 12350 },
  window_dusk: { from: [0.5, 83.4, -43.2], to: [0.5, 84.5, -60], pt: 8, tod: 12350 },
};
// diagnostics, printed per shot: the hall's crew and draw calls, the pad ship (state, GPU upload, design build), the flight
await ev(() => {
  const h = VR.game.hall; if (h && !h.__counted) { h.__counted = true; const d0 = h.draw.bind(h); h.draw = (r, E, c) => { window.__hallDraws = (window.__hallDraws || 0) + 1; return d0(r, E, c); }; }
  // the pad shuttle's draw calls: how often drawOne runs for it, and where its model matrix puts it
  const S = VR.game.starships; if (S && !S.__counted) { S.__counted = true; const o = S.drawOne.bind(S); S.drawOne = function (r, prog, s, cam, layer, light, stretch, hide) {
    if (s.hangar) { window.__hangarDraws = (window.__hangarDraws || 0) + 1; const M = this.modelMat(s, cam, stretch); window.__hangarMT = [layer, Array.from(M).slice(12, 15).map(v => +v.toFixed(1))]; }
    return o(r, prog, s, cam, layer, light, stretch, hide); }; }
  // put the shuttle at a moment of its loop: a leg and a fraction of it, or the approach where it crosses z heading north
  window.__flightTo = (o) => {
    const HF = VR.HangarFlight, f = VR.game.hall && VR.game.hall.flight;
    if (!f || !f.active || !f.plan) return 'flight not active';
    const plan = f.plan; let t = null;
    if (o.phase !== 'air') { const L = plan.legs.find(l => l.name === o.phase); if (L) t = L.t0 + L.T * o.at; }
    else for (let tt = plan.ground; tt < plan.T; tt += 0.02) { const s = HF.at(plan, tt); if (Math.cos(s.yaw) > 0.9 && s.pos[2] <= o.z) { t = tt; break; } }
    if (t === null) return 'no such moment';
    f.jump(t - (o.lead || 0));
    return f.variant + ' ' + o.phase + ' t ' + t.toFixed(2);
  };
});
const diags = {};
const diag = async (name) => { const d = await ev(() => {
  const g = VR.game, h = g.hall, S = g.starships, pl = g.player, f = h && h.flight;
  return {
    crew: h ? h.crew.map(c => c.pos.map(v => +v.toFixed(1))) : null, crewAt: h ? h.crew.map(c => [c.cur[0], c.cur[1], c.cur[2]].map(v => +v.toFixed(1)).concat(c.moving)) : null,
    hallDraws: window.__hallDraws || 0, player: pl.pos.map(v => +v.toFixed(1)),
    ships: S.ships.filter(s => s.hangar).map(s => ({ pos: s.pos.map(v => +v.toFixed(1)), state: s.state, gpu: !!s.d.gpu, arch: s.d.meta && s.d.meta.arch, hidden: !!s.hidden, hull: s.d.gpu && s.d.gpu.hull ? s.d.gpu.hull.count : null, gear: s.gear })),
    flight: f ? { active: f.active, variant: f.variant, phase: f.st && f.st.phase, t: +(f.t || 0).toFixed(2), pos: f.inst.pos.map(v => +v.toFixed(1)), yaw: +f.inst.yaw.toFixed(2), gear: +(f.inst.gear || 0).toFixed(2), draws: f.draws || 0, built: !!(f.d && f.d.gpu) } : null,
    hangarDraws: window.__hangarDraws || 0,
    designs: [...S.designs.values()].map(d => (d.meta ? 'm' : '-') + (d.gpu ? 'g' : '-')).join(' '),
  };
}); diags[name] = d; console.log('diag', name, JSON.stringify(d)); };
for (const name of shots) {
  const S = SHOT[name]; if (!S) continue;
  await ev((t) => VR.game.env.setTime(t), S.tod || +(process.env.TOD || 3200));
  await look(S.from, S.to, S.pitch === undefined ? null : S.pitch);
  // the moment: the crew's walk and the shuttle's loop, then 6 frames (0.2 s) so the engine plumes and the dust build up
  if (S.pt !== undefined) await ev((pt) => { const h = VR.game.hall; if (h && h.jump) h.jump(pt); }, S.pt - 0.2);
  if (S.fly) console.log('fly', name, await ev((o) => window.__flightTo(o), Object.assign({ lead: 0.2 }, S.fly)));
  await step(6);
  await diag(name);
  await shot(name);
}
// VERYLOW=1: the cost of the same hall view on the High preset and on Very Low (render on, 6 frames each; the
// Very Low preset has Animierte Anzeigen off), then Very Low with the animation forced on
if (process.env.VERYLOW) try {
  // five blocks of six frames (each after three warm-up frames); the minimum is the cost, since the machine is shared
  const timeFrames = async (label) => {
    const runs = [];
    for (let k = 0; k < 5; k++) runs.push(await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); const t0 = performance.now(); for (let i = 0; i < 6; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); return (performance.now() - t0) / 6; }));
    await ev(() => { window.__norender = true; });   // the page's flag: the shots below are rendered again
    const ms = Math.min(...runs), med = runs.slice().sort((x, y) => x - y)[2];
    console.log('cost', label, ms.toFixed(0) + ' ms/frame min, ' + med.toFixed(0) + ' median (blocks ' + runs.map(v => v.toFixed(0)).join(', ') + ')'); return ms;
  };
  const hallView = SHOT.hall;
  await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.applySettings('*'); });
  await ev((t) => VR.game.env.setTime(t), +(process.env.TOD || 3200)); await look(hallView.from, hallView.to, null);
  await timeFrames('High (' + TAG + ')');
  await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
  await ev((t) => VR.game.env.setTime(t), +(process.env.TOD || 3200)); await look(hallView.from, hallView.to, null);
  await timeFrames('Very Low (' + TAG + ', animation ' + (await ev(() => VR.game.settings.anim === false ? 'off' : 'on')) + ')');
  await shot('verylow_hall');
  await ev(() => { const g = VR.game; g.settings.anim = true; g.applySettings('anim'); });
  await ev((t) => VR.game.env.setTime(t), +(process.env.TOD || 3200)); await look(hallView.from, hallView.to, null);
  await timeFrames('Very Low (' + TAG + ', animation forced on)');
  await shot('verylow_hall_anim');
} catch (e) { console.log('VERYLOW pass broke off:', String(e.message || e).split('\n')[0]); missed.push('verylow'); }
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
// the verdict (only when the shots were taken, so a picture-only run prints no verdict): no page errors, the two heroes
// stand in the hall, the shuttle on the pad is built and uploaded
if (diags.hall && diags.pad) {
  let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log((c ? '  ok   ' : '  FAIL ') + m); };
  ok(!logs.some(l => l.startsWith('[pageerror]')), 'no page errors in the run');
  ok(diags.hall.crew && diags.hall.crew.length === 2, `two heroes stand in the hall (${diags.hall.crew ? diags.hall.crew.length : 'none'})`);
  ok(diags.pad.ships.some(s => s.gpu), `the shuttle on the pad is built and uploaded (${JSON.stringify(diags.pad.ships)})`);
  // the Gate Temple's shuttle flies its loop (hangarflight.js): built, drawn, the hall variant (the parked one is out)
  const fl = diags.pad.flight;
  ok(fl && fl.active && fl.built && fl.variant === 'hall' && fl.draws > 0 && diags.pad.ships.every(s => s.hidden), `the shuttle flies and is drawn; the parked one is out meanwhile (${JSON.stringify(fl)})`);
  // the crew walks out to the corridor's city end (hall.js)
  if (diags.exit) ok(diags.exit.crewAt.every(c => c[1] < -42 && c[3] === 1), `the heroes walk out through the corridor (${JSON.stringify(diags.exit.crewAt)})`);
  ok(!missed.length, `every picture was taken (${missed.length ? 'missing: ' + missed.join(' ') : shots.length + ' shots' + (process.env.VERYLOW ? ' and the Very Low pass' : '')})`);
  console.log(bad ? `FAILED ${bad}` : 'ALL OK');
  process.exitCode = bad ? 1 : 0;
}
await browser.close();
