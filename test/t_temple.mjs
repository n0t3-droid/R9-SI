// Trailer shots D (Gate Temple approach) and E (Hangar Hall), framed in the game (TRAILER.md §1 and §4; the frames in
// docs/trailer/frames). One browser run photographs every shot: test/shots/trailer_<shot>_<TAG>.png
// (TAG=base before the wave, TAG=after later). PRESET=high, TOD=3200 (dusk), SEED=4242 by default.
// SHOTS=approach,portal,veil,hall,pad,backdoor,city (default: all) · VERYLOW=1 adds the Very Low pass of the same shots.
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
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/trailer_${name}_${TAG}.png`, timeout: 180000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(`window.__hz=${process.env.HZ === undefined ? 2 : +process.env.HZ}`);
const PRESET = process.env.PRESET || 'high';
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 16; g.settings.horizon = window.__hz === undefined ? 2 : window.__hz; g.applySettings('*'); }, PRESET);
await ev(`VR.game.createWorld({name:'TrailerD',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '4242'}',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev((tod) => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; g.env.setTime(tod); }, +(process.env.TOD || 3200));
// a camera place (from), a target (to), an optional pitch (null: aim at the target)
const look = async (from, to, pitch) => { await ev(([c, t, p]) => { const pl = VR.game.player; pl.flying = true; pl.teleport(c[0], c[1], c[2]); pl.yaw = Math.atan2(-(t[0] - c[0]), -(t[2] - c[2])); pl.pitch = p !== null ? p : Math.atan2(t[1] - c[1], Math.hypot(t[0] - c[0], t[2] - c[2])); }, [from, to, pitch]); await settle(200); await step(20); };
const ALL = ['approach', 'portal', 'veil', 'hall', 'pad', 'backdoor', 'city'];
const shots = (process.env.SHOTS || ALL.join(',')).split(',');
const SHOT = {
  // D: the shuttle skims the plaza toward the monumental temple (t3_03)
  approach: [[0.5, 83, 132], [0, 88, 6], null],
  // D: the octagonal portal from the plaza (t3_03 framing)
  portal: [[0.5, 83, 40], [0, 88, 20], null],
  // D (t3_04): from the plaza through the gate's veil, down the hall over the pad shuttle, out of the back door to the
  // palm city (the line of sight crosses the veil in the foreground, the shuttle in the middle, the city at the end)
  veil: [[0.5, 83.6, 34], [0, 88, -80], null],
  // E: the hall from the front end (z 20 is the front wall), the pad and the back door ahead (t1_19 framing), a low view
  // down the axis; the camera stands clear of the shuttle's tail (its aft end is at z 2)
  hall: [[0.5, 83.2, 16], [0, 86, -36], null],
  // E: the pad from the front end, the two heroes at the sides and the consoles behind them (t1_16 / t1_17)
  pad: [[0.5, 82.8, 10], [0, 82.6, -10], null],
  // E: the octagonal back door, the corridor out to the city (t1_21 / t1_22)
  backdoor: [[0.5, 83.5, -36], [0, 88, -80], null],
  // E: out of the back door, the palm city close up (t1_24)
  city: [[0.5, 83.5, -50], [0, 90, -110], null],
};
// diagnostics, printed per shot: the hall's crew and draw calls, the pad ship (state, GPU upload, design build)
await ev(() => {
  const h = VR.game.hall; if (h && !h.__counted) { h.__counted = true; const d0 = h.draw.bind(h); h.draw = (r, E, c) => { window.__hallDraws = (window.__hallDraws || 0) + 1; return d0(r, E, c); }; }
  // the pad shuttle's draw calls: how often drawOne runs for it, and where its model matrix puts it
  const S = VR.game.starships; if (S && !S.__counted) { S.__counted = true; const o = S.drawOne.bind(S); S.drawOne = function (r, prog, s, cam, layer, light, stretch, hide) {
    if (s.hangar) { window.__hangarDraws = (window.__hangarDraws || 0) + 1; const M = this.modelMat(s, cam, stretch); window.__hangarMT = [layer, Array.from(M).slice(12, 15).map(v => +v.toFixed(1))]; }
    return o(r, prog, s, cam, layer, light, stretch, hide); }; }
});
const diags = {};
const diag = async (name) => { const d = await ev(() => {
  const g = VR.game, h = g.hall, S = g.starships, pl = g.player;
  return {
    crew: h ? h.crew.map(c => c.pos.map(v => +v.toFixed(1))) : null, hallDraws: window.__hallDraws || 0, player: pl.pos.map(v => +v.toFixed(1)),
    ships: S.ships.filter(s => s.hangar).map(s => ({ pos: s.pos.map(v => +v.toFixed(1)), state: s.state, gpu: !!s.d.gpu, arch: s.d.meta && s.d.meta.arch, hidden: !!s.hidden, hull: s.d.gpu && s.d.gpu.hull ? s.d.gpu.hull.count : null, gear: s.gear, bounds: s.d.meta && s.d.meta.bounds.map(v => +v.toFixed(1)) })),
    hangarDraws: window.__hangarDraws || 0, hangarMT: window.__hangarMT || null,
    designs: [...S.designs.values()].map(d => (d.meta ? 'm' : '-') + (d.gpu ? 'g' : '-')).join(' '),
  };
}); diags[name] = d; console.log('diag', name, JSON.stringify(d)); };
for (const name of shots) {
  if (!SHOT[name]) continue;
  const [c, t, p] = SHOT[name];
  await look(c, t, p);
  await diag(name);
  await shot(name);
}
// VERYLOW=1: the cost of the same hall view on the High preset and on Very Low (render on, 6 frames each; the
// Very Low preset has Animierte Anzeigen off), then Very Low with the animation forced on
if (process.env.VERYLOW) {
  // three blocks of six frames (each after three warm-up frames); the minimum is the cost, since the machine is shared
  const timeFrames = async (label) => {
    const runs = [];
    for (let k = 0; k < 3; k++) runs.push(await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); const t0 = performance.now(); for (let i = 0; i < 6; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); return (performance.now() - t0) / 6; }));
    await ev(() => { window.__norender = true; });   // the page's flag: the shots below are rendered again
    const ms = Math.min(...runs);
    console.log('cost', label, ms.toFixed(0) + ' ms/frame (blocks ' + runs.map(v => v.toFixed(0)).join(', ') + ')'); return ms;
  };
  const hallView = SHOT.hall;
  await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.applySettings('*'); });
  await look(hallView[0], hallView[1], hallView[2]);
  await timeFrames('High (' + TAG + ')');
  await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
  await look(hallView[0], hallView[1], hallView[2]);
  await timeFrames('Very Low (' + TAG + ', animation ' + (await ev(() => VR.game.settings.anim === false ? 'off' : 'on')) + ')');
  await shot('verylow_hall');
  await ev(() => { const g = VR.game; g.settings.anim = true; g.applySettings('anim'); });
  await look(hallView[0], hallView[1], hallView[2]);
  await timeFrames('Very Low (' + TAG + ', animation forced on)');
  await shot('verylow_hall_anim');
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
// the verdict (only when the shots were taken, so a picture-only run prints no verdict): no page errors, the two heroes
// stand in the hall, the shuttle on the pad is built and uploaded
if (diags.hall && diags.pad) {
  let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log((c ? '  ok   ' : '  FAIL ') + m); };
  ok(!logs.some(l => l.startsWith('[pageerror]')), 'no page errors in the run');
  ok(diags.hall.crew && diags.hall.crew.length === 2, `two heroes stand in the hall (${diags.hall.crew ? diags.hall.crew.length : 'none'})`);
  ok(diags.pad.ships.some(s => s.gpu), `the shuttle on the pad is built and uploaded (${JSON.stringify(diags.pad.ships)})`);
  console.log(bad ? `FAILED ${bad}` : 'ALL OK');
  process.exitCode = bad ? 1 : 0;
}
await browser.close();
