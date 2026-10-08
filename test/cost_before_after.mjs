// F6 · render cost before and after, on the same three views: a villa's front (a modern town), a modern street, and the
// inside of a village home. Each view is taken on Very Low (potato) and on High, in this build and, when BASE_DIST is set,
// in the pre-F6 build (dist/index.html of commit 205d00c, built in a scratch folder). draws, tris and sections come from
// renderer.stats after one real frame (the same view gives the same counts); the frame ms are noisy on a loaded machine.
// The check: the item shadows and lamp halos are off on Very Low in this build, and no page errors.
// usage: BASE_DIST=<pre-F6 dist/index.html> bash test/wt_run.sh cost_before_after.mjs 3000
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const SEED = process.env.SEED || '424242';
const BASE = process.env.BASE_DIST || '';
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'];
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const dirFrom = (a, b) => { const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
const pct = (x, y) => y ? (((x / y) - 1) * 100).toFixed(1) + '%' : 'n/a';

async function measure(url, label) {
  const browser = await chromium.launch({ channel: 'chromium', args: ARGS });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const logs = [], kinds = new Map();
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 600)));
  page.on('console', m => { const t = m.type(); if (t !== 'error' && t !== 'warning') return; const k = `[${t}] ` + m.text().replace(/[-0-9.,]+/g, '#').slice(0, 100); kinds.set(k, (kinds.get(k) || 0) + 1); });
  await page.goto(url);
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(15); } };
  const place = async (pos, tgt) => {
    await ev(([pos, tgt]) => { const p = VR.game.player; p.teleport(pos[0], pos[1], pos[2]); p.flying = true; const dx = tgt[0] - pos[0], dy = tgt[1] - pos[1] - 1.6, dz = tgt[2] - pos[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }, [pos, tgt]);
    // the chunks of a new place come from the workers, slowly on a loaded machine: the five columns round it in, and the
    // drawn sections unchanged over three real frames
    let last = -1, still = 0;
    for (let i = 0; i < 40 && still < 2; i++) {
      await step(12); await wait(150);
      const idle = await ev(([x, z]) => { const W = VR.game.world, r = VR.game.settings.renderDist - 0.5, cx = x >> 4, cz = z >> 4, R = Math.ceil(r); for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) { if (i * i + j * j > r * r) continue; const c = W.col(cx + i, cz + j); if (!c) return false; for (const s of c.sec) if (s.dirty || s.pending) return false; } return true; }, [Math.floor(pos[0]), Math.floor(pos[2])]);
      if (!idle) { still = 0; continue; }
      const n = await ev(() => { window.__norender = false; const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; return g.renderer.stats.sections; });
      still = n >= 8 && n === last ? still + 1 : 0; last = n;
    }
    return still >= 2;   // false: the view was not complete within the rounds (its numbers say so)
  };
  const oneFrame = async () => { await ev(() => { window.__norender = false; const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }); await wait(120); return ev(() => { const r = VR.game.renderer; return { draws: r.stats.draws, tris: r.stats.tris, sections: r.stats.sections, ms: +r.stats.ms.toFixed(1), dropShadow: !!(r.q && r.q.dropShadow), lampGlow: !!(r.q && r.q.lampGlow), scale: r.q && r.q.scale }; }); };

  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(() => { const g = VR.game; g.settings.renderDist = 4; g.settings.dynRes = false; g.settings.minimap = false; g.applySettings('renderDist'); });
  await ev(`VR.game.createWorld({name:'Cost',mode:'creative',difficulty:'normal',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
  for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  await ev(() => { const g = VR.game; g.hideHud = true; document.getElementById('hud').style.visibility = 'hidden'; });
  for (let i = 0; i < 12; i++) { await step(8); await wait(300); }

  // the same places as test/architecture.mjs finds them, in this build's own plans
  const found = await ev(() => {
    const W = VR.game.world, VG = VR.VillageGen, og = new VR.OverworldGen(W.seed, W.genOpts || {});
    const sites = [];
    for (let i = -9; i <= 9; i++) for (let j = -9; j <= 9; j++) { const s = VG.site(og, i, j); if (s) sites.push(s); }
    sites.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
    const mod = sites.find(s => s.style === 'modern'), vil = sites.find(s => s.style !== 'modern');
    const out = {};
    if (mod) {
      const P = VG.plan(og, mod), villa = P.homes.find(h => h.skin && h.door && h.inside);
      if (villa) out.villa = { door: villa.door, outside: villa.outside, inside: villa.inside };
      const roads = P.roads.filter(r => r.length > 6);
      if (roads.length) out.road = roads[0].slice(0, 8);
    }
    if (vil) {
      const P = VG.plan(og, vil), home = P.homes.find(h => !h.skin && h.door && h.inside && h.beds && h.beds.length);
      if (home) out.home = { door: home.door, outside: home.outside, inside: home.inside };
    }
    return out;
  });
  const views = [];
  if (found.villa) { const V = found.villa, [dx, dz] = dirFrom(V.door, V.inside); views.push({ name: 'villa front', pos: [V.outside[0] - dx * 9, V.outside[1] + 2, V.outside[2] - dz * 9], tgt: [V.door[0], V.door[1] + 1, V.door[2]] }); }
  if (found.road) { const a = found.road[1], b = found.road[4]; views.push({ name: 'modern street', pos: [a[0] + 0.5, a[1] + 1, a[2] + 0.5], tgt: [b[0] + 0.5, b[1] + 1.5, b[2] + 0.5] }); }
  if (found.home) { const H = found.home, [dx, dz] = dirFrom(H.door, H.inside); views.push({ name: 'village home inside', pos: [H.inside[0], H.inside[1], H.inside[2]], tgt: [H.inside[0] + dx * 5, H.inside[1] + 1.1, H.inside[2] + dz * 5] }); }
  const res = {};
  for (const preset of ['potato', 'high']) {
    await ev((p) => { VR.game.applyPreset(p); }, preset);
    await step(20); await wait(200);
    for (const v of views) { const settled = await place(v.pos, v.tgt); res[`${v.name} | ${preset}`] = { ...(await oneFrame()), settled }; }
  }
  await browser.close();
  console.log(`--- ${label}: ${Object.keys(res).length} frames, page errors ${logs.length}, console errors and warnings ${[...kinds.values()].reduce((a, b) => a + b, 0)}`);
  for (const [k, n] of [...kinds].sort((a, b) => b[1] - a[1]).slice(0, 6)) console.log(`  ${String(n).padStart(5)}  ${k}`);
  for (const [k, r] of Object.entries(res)) console.log(`  ${k.padEnd(34)} draws ${String(r.draws).padStart(4)}  tris ${String(r.tris).padStart(8)}  sections ${String(r.sections).padStart(3)}  frame ${String(r.ms).padStart(6)} ms (noisy)  item shadows ${r.dropShadow}  lamp halos ${r.lampGlow}  scale ${r.scale}  settled ${r.settled}`);
  return { res, logs };
}

const after = await measure('file:///home/claude/vr/dist/index.html', 'after: this build (F6)');
if (BASE) {
  const before = await measure('file://' + BASE, 'before: pre-F6 build (205d00c)');
  console.log('--- deltas after vs before (draws, tris; the frame ms are not compared, they are noisy)');
  for (const k of Object.keys(after.res)) { const a = after.res[k], b = before.res[k]; if (!b) { console.log(`  ${k}: no pre-F6 frame`); continue; } console.log(`  ${k.padEnd(34)} draws ${b.draws} -> ${a.draws} (${pct(a.draws, b.draws)})   tris ${b.tris} -> ${a.tris} (${pct(a.tris, b.tris)})`); }
  check(before.logs.length === 0, 'no page errors in the pre-F6 build');
}
check(after.logs.length === 0, 'no page errors in this build');
const pv = after.res['villa front | potato'];
check(!!pv && !pv.dropShadow && !pv.lampGlow, 'Very Low switches the item shadows and lamp halos off');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
