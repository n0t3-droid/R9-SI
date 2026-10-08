// F6 · Architektur innen & außen — the browser check: a new creative world (vgen 6), a villa of a modern town seen
// from outside and inside by day and at night, a furnished village home inside, and a modern street at night.
// The pictures go to test/shots/arch_*.png (they are the evidence: read them and iterate on what looks wrong).
// Checks: no page errors, the villa and the village home have their furniture and outside detail in the plan, the
// street has its bus shelter and e-bikes. usage: bash test/wt_run.sh architecture.mjs 1500
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const SEED = process.env.SEED || '424242';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [], kinds = new Map();   // page errors; console errors and warnings counted by kind (numbers and coordinates removed)
page.on('console', m => { const t = m.type(); if (t !== 'error' && t !== 'warning') return; const k = `[${t}] ` + m.text().replace(/[-0-9.,]+/g, '#').slice(0, 100); kinds.set(k, (kinds.get(k) || 0) + 1); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(15); } };
const shot = async (name, tod) => { await ev((tod) => { window.__norender = false; const g = VR.game; g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }, tod); await wait(150);
  // a screenshot can take minutes on this loaded machine: two tries with long timeouts; a shot that never comes is a failed check
  for (let t = 1; ; t++) { try { await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 180000 }); break; } catch (e) { console.log(`  screenshot ${name} try ${t} failed: ${String(e.message).split('\n')[0]}`); if (t >= 2) { fails++; break; } await wait(3000); } }
  console.log('shot', name, 'tod', tod); };
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.renderDist = +(window.__RD || 4); g.settings.dynRes = false; g.settings.minimap = false; g.applySettings('renderDist'); });
await ev(`VR.game.createWorld({name:'Arch',mode:'creative',difficulty:'normal',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.hideHud = true; document.getElementById('hud').style.visibility = 'hidden'; });
for (let i = 0; i < 12; i++) { await step(8); await wait(300); }

// the plan of the nearest modern town (a villa catalogue town) and of a village, both at the world's own generator settings
const found = await ev(() => {
  const W = VR.game.world, VG = VR.VillageGen, og = new VR.OverworldGen(W.seed, W.genOpts);
  const nm = (s) => (s && VR.R.types[VR.R.T.type[s]]) ? VR.R.types[VR.R.T.type[s]].name : '';
  const sites = [];
  for (let i = -9; i <= 9; i++) for (let j = -9; j <= 9; j++) { const s = VG.site(og, i, j); if (s) sites.push(s); }
  sites.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  const mod = sites.find(s => s.style === 'modern'), vil = sites.find(s => s.style !== 'modern');
  const out = { vgen: W.genOpts.vgen };
  if (mod) {
    const P = VG.plan(og, mod), villa = P.homes.find(h => h.skin && h.door && h.inside);
    // the cells of a state name in the town's ops (x, y, z per cell)
    const at = (want) => { const L = []; for (const [, b] of P.chunks) for (let i = 0; i < b.o.length; i += 4) if (nm(b.o[i + 3]) === want) L.push([b.o[i], b.o[i + 1], b.o[i + 2]]); return L; };
    const shelter = at('vm_mobility_busshelter_glass'), bikes = at('vm_mobility_ebike_city');
    out.mod = { x: mod.x, z: mod.z, homes: P.homes.length, shelters: shelter.length, bikes: bikes.length };
    if (villa) out.villa = { door: villa.door, outside: villa.outside, inside: villa.inside, skin: villa.skin, beds: villa.beds.length, seats: villa.seats.length, lamps: (villa.lights || []).length };
    const roads = P.roads.filter(r => r.length > 6);
    if (roads.length) out.road = roads[0].slice(0, 8);
    out.bus = out.mod.shelters > 0;
    out.ebike = out.mod.bikes > 0;
    // the street aimed at the bus shelter (its centre, and the e-bike nearest to it when that is within 14 cells, in view):
    // the camera stands 8 cells back along the road nearest to that point, 2 above it
    if (shelter.length) {
      const mid = (L) => { let x = 0, y = 1e9, z = 0; for (const p of L) { x += p[0]; z += p[2]; if (p[1] < y) y = p[1]; } return [x / L.length, y, z / L.length]; };
      const S = mid(shelter), d2 = (p) => (p[0] - S[0]) ** 2 + (p[2] - S[2]) ** 2;
      let M = S;
      if (bikes.length) { const bk = bikes.reduce((b, p) => (d2(p) < d2(b) ? p : b)); if (d2(bk) < 14 * 14) M = [(S[0] + bk[0]) / 2, S[1], (S[2] + bk[2]) / 2]; }
      let best = null;
      for (const r of P.roads) for (let k = 0; k < r.length; k++) { const q = (r[k][0] - M[0]) ** 2 + (r[k][2] - M[2]) ** 2; if (!best || q < best.q) best = { q, r, k }; }
      if (best) {
        const { r, k } = best, a = r[Math.max(0, k - 1)], b = r[Math.min(r.length - 1, k + 1)];
        const tl = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1, tx = (b[0] - a[0]) / tl, tz = (b[2] - a[2]) / tl;
        out.street = { cam: [r[k][0] - tx * 8, r[k][1] + 2, r[k][2] - tz * 8], tgt: [M[0], S[1] + 1.5, M[2]] };
      }
    }
  }
  if (vil) {
    const P = VG.plan(og, vil);
    const home = P.homes.find(h => !h.skin && h.door && h.inside && h.beds && h.beds.length);
    out.vil = { x: vil.x, z: vil.z, style: vil.style, plaza: P.plaza, homes: P.homes.length };
    if (home) out.home = { door: home.door, outside: home.outside, inside: home.inside, beds: home.beds, seats: home.seats, table: home.table, lights: home.lights };
    out.lampsVil = (P.lamps || []).length;
  }
  return out;
});
console.log('plan', JSON.stringify(found).slice(0, 900));
const dirFrom = (a, b) => { const dx = b[0] - a[0], dz = b[2] - a[2], l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
const place = async (pos, tgt, tod, name) => {
  await ev(([pos, tgt]) => { const p = VR.game.player; p.teleport(pos[0], pos[1], pos[2]); p.flying = true; const dx = tgt[0] - pos[0], dy = tgt[1] - pos[1] - 1.6, dz = tgt[2] - pos[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }, [pos, tgt]);
  // the chunks of a new place come from the workers, slowly on a loaded machine: wait until the five columns round it are in
  // and the number of drawn sections has stopped changing (real frames, so the renderer's count is current)
  let last = -1, still = 0, n = 0;
  for (let i = 0; i < 40 && still < 2; i++) {
    await step(12); await wait(150);
    // the work is done when every column within the loaded circle is in and none of its sections waits for a worker or a mesh
    const idle = await ev(([x, z]) => { const W = VR.game.world, r = VR.game.settings.renderDist - 0.5, cx = x >> 4, cz = z >> 4, R = Math.ceil(r); for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) { if (i * i + j * j > r * r) continue; const c = W.col(cx + i, cz + j); if (!c) return false; for (const s of c.sec) if (s.dirty || s.pending) return false; } return true; }, [Math.floor(pos[0]), Math.floor(pos[2])]);
    if (!idle) { still = 0; continue; }
    n = await realFrame();   // the meshes reach the GPU in a real frame: two equal counts in a row are the settled view
    still = n >= 8 && n === last ? still + 1 : 0; last = n;
  }
  console.log('  ' + name + ': player at ' + (await ev(() => VR.game.player.pos.map(v => +v.toFixed(1)))).join(' ') + ', drawn sections ' + n + ', settled ' + (still >= 2));
  await shot(name, tod);
};

// the render cost of the two ends of the quality range, in the same view (renderer.stats after one real frame)
const realFrame = () => ev(() => { window.__norender = false; const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; return g.renderer.stats.sections; });
const oneFrame = async () => { await ev(() => { window.__norender = false; const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }); await wait(120); return ev(() => { const r = VR.game.renderer; return { draws: r.stats.draws, tris: r.stats.tris, sections: r.stats.sections, ms: +r.stats.ms.toFixed(1), dropShadow: !!r.q.dropShadow, lampGlow: !!r.q.lampGlow, shadows: r.q.shadows, scale: r.q.scale }; }); };
const costs = {};
if (found.villa) {
  const V = found.villa, [dx, dz] = dirFrom(V.door, V.inside);            // inward: from the door into the house
  // outside: 9 cells out in front of the door (against the inward direction), the facade and the door in view
  const out = [V.outside[0] - dx * 9, V.outside[1] + 2, V.outside[2] - dz * 9];
  const doorC = [V.door[0], V.door[1] + 1, V.door[2]];
  await place(out, doorC, 6000, 'arch_villa_out_day');
  await place(out, doorC, 18600, 'arch_villa_out_night');
  // inside: standing at the door looking into the rooms, by day and at night
  const inP = [V.inside[0], V.inside[1] + 0, V.inside[2]], inT = [V.inside[0] + dx * 7, V.inside[1] + 1.2, V.inside[2] + dz * 7];
  await place(inP, inT, 6000, 'arch_villa_in_day');
  await place(inP, inT, 18600, 'arch_villa_in_night');
  check(V.beds >= 1 && V.seats >= 1, `villa in the plan has beds (${V.beds}) and seats (${V.seats})`);
  // the same view on Very Low (potato) and on High: what the frame costs (the item shadows and lamp halos switch off on potato)
  for (const preset of ['potato', 'high']) {
    await ev((p) => { VR.game.applyPreset(p); }, preset);
    await step(20); await wait(200);
    await place(out, doorC, 6000, 'arch_cost_' + preset);
    costs[preset] = await oneFrame();
  }
  console.log('  render cost, the same villa view by day:', JSON.stringify(costs));
  check(costs.potato && !costs.potato.dropShadow && !costs.potato.lampGlow, 'Very Low switches the item shadows and lamp halos off');
  // a dropped item on the ground in front of the villa, by night, on Very Low and on High: the item's ground shadow and the
  // halos round the lit lamps (Very Low: neither; High: both)
  const itemTgt = await ev(([out, doorC]) => {
    const g = VR.game, t = 4 / 9;
    const x = Math.floor(out[0] + (doorC[0] - out[0]) * t) + 0.5, z = Math.floor(out[2] + (doorC[2] - out[2]) * t) + 0.5;
    const y = g.world.topAt(Math.floor(x), Math.floor(z)) + 1;
    const it = g.dropStack({ id: 'vx_barrel', n: 1 }, false, [x, y, z]);
    if (it) it.vel = [0, 0, 0];
    return [x, y + 0.2, z];
  }, [out, doorC]);
  for (const preset of ['potato', 'high']) {
    await ev((p) => { VR.game.applyPreset(p); }, preset);
    await step(20); await wait(200);
    await place(out, itemTgt, 18600, 'arch_item_night_' + preset);
  }
  await ev(() => VR.game.applyPreset('balanced'));
} else check(false, 'a modern town with a villa exists near the spawn');

// the modern street (the same town as the villa, so no long move): the bus shelter with the nearest e-bike, by day and by night
if (found.road) {
  const r = found.road, a = r[1], b = r[4];
  if (found.street) {
    await place(found.street.cam, found.street.tgt, 6000, 'arch_street_day');
    await place(found.street.cam, found.street.tgt, 18600, 'arch_street_night');
  } else await place([a[0] + 0.5, a[1] + 1, a[2] + 0.5], [b[0] + 0.5, b[1] + 1.5, b[2] + 0.5], 18600, 'arch_street_night');
  check(found.bus && found.ebike, `the modern street has a bus shelter and e-bikes in the plan (${found.bus}/${found.ebike}: ${found.mod.shelters} shelter cells, ${found.mod.bikes} e-bike cells)`);
} else check(false, 'a modern street with a road exists near the spawn');

// a village home (another place, far off): one step in from the door looking down the room, and the house from outside at night
if (found.home) {
  const H = found.home, [dx, dz] = dirFrom(H.door, H.inside);            // inward
  // one step in from the door, looking down the room (the back wall and the furniture on both sides)
  const inP = [H.inside[0] + dx, H.inside[1], H.inside[2] + dz], inT = [H.inside[0] + dx * 7, H.inside[1] + 0.6, H.inside[2] + dz * 7];
  await place(inP, inT, 6000, 'arch_home_in_day');
  const out = [H.outside[0] - dx * 9, H.outside[1] + 2, H.outside[2] - dz * 9];
  await place(out, [H.door[0], H.door[1] + 1, H.door[2]], 18600, 'arch_home_out_night');
  check(H.beds.length >= 1 && (H.seats || []).length >= 1, `village home in the plan has a bed and seats (${H.beds.length}/${(H.seats || []).length})`);
} else check(false, 'a village home with a bed exists near the spawn');
console.log('--- console errors and warnings by kind (' + [...kinds.values()].reduce((a, b) => a + b, 0) + ' in all)'); for (const [k, n] of [...kinds].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${String(n).padStart(5)}  ${k}`);
console.log('--- page errors (' + logs.length + ')'); for (const l of logs.slice(0, 8)) console.log(l);
check(!logs.some(l => /pageerror/.test(l)), 'no page errors');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);
