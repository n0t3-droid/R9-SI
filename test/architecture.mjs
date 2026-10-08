// F6 · Architektur innen & außen — the browser check: a new creative world (vgen 6), a villa of a modern town seen
// from outside and inside by day and at night, a furnished village home inside, and a modern street at night.
// The pictures go to test/shots/arch_*.png (they are the evidence: read them and iterate on what looks wrong).
// Checks: no page errors, the villa and the village home have their furniture and outside detail in the plan, the
// street has its bus shelter and e-bikes. usage: bash test/wt_run.sh architecture.mjs 1500
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const SEED = process.env.SEED || '424242';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(15); } };
const shot = async (name, tod) => { await ev((tod) => { window.__norender = false; const g = VR.game; g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }, tod); await wait(150); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 90000 }); console.log('shot', name, 'tod', tod); };
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.renderDist = +(window.__RD || 6); g.settings.dynRes = false; g.settings.minimap = false; g.applySettings('renderDist'); });
await ev(`VR.game.createWorld({name:'Arch',mode:'creative',difficulty:'normal',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.hideHud = true; document.getElementById('hud').style.visibility = 'hidden'; });
for (let i = 0; i < 12; i++) { await step(8); await wait(300); }

// the plan of the nearest modern town (a villa catalogue town) and of a village, both at the world's own generator settings
const found = await ev(() => {
  const W = VR.game.world, VG = VR.VillageGen, og = new VR.OverworldGen(W.seed, W.genOpts);
  const sites = [];
  for (let i = -9; i <= 9; i++) for (let j = -9; j <= 9; j++) { const s = VG.site(og, i, j); if (s) sites.push(s); }
  sites.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
  const mod = sites.find(s => s.style === 'modern'), vil = sites.find(s => s.style !== 'modern');
  const out = { vgen: W.genOpts.vgen };
  if (mod) {
    const P = VG.plan(og, mod), villa = P.homes.find(h => h.skin && h.door && h.inside);
    out.mod = { x: mod.x, z: mod.z, homes: P.homes.length, shelters: 0 };
    if (villa) out.villa = { door: villa.door, outside: villa.outside, inside: villa.inside, skin: villa.skin, beds: villa.beds.length, seats: villa.seats.length, lamps: (villa.lights || []).length };
    const roads = P.roads.filter(r => r.length > 6);
    if (roads.length) out.road = roads[0].slice(0, 8);
    out.bus = !!P.homes.length && JSON.stringify(P).includes('vm_mobility_busshelter_glass');
    out.ebike = JSON.stringify(P).includes('vm_mobility_ebike_city');
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
  for (let i = 0; i < 6; i++) { await step(4); await wait(250); }
  await shot(name, tod);
};

if (found.villa) {
  const V = found.villa, [dx, dz] = dirFrom(V.inside, V.door);            // into the house: from the door to the inside cell
  // outside: from the street side, the facade and the door in view
  const out = [V.outside[0] - dx * 9, V.outside[1] + 2, V.outside[2] - dz * 9];
  const doorC = [V.door[0], V.door[1] + 1, V.door[2]];
  await place(out, doorC, 6000, 'arch_villa_out_day');
  await place(out, doorC, 18600, 'arch_villa_out_night');
  // inside: standing at the door looking into the rooms, by day and at night
  const inP = [V.inside[0], V.inside[1] + 0, V.inside[2]], inT = [V.inside[0] + dx * 7, V.inside[1] + 1.2, V.inside[2] + dz * 7];
  await place(inP, inT, 6000, 'arch_villa_in_day');
  await place(inP, inT, 18600, 'arch_villa_in_night');
  check(V.beds >= 1 && V.seats >= 1, `villa in the plan has beds (${V.beds}) and seats (${V.seats})`);
} else check(false, 'a modern town with a villa exists near the spawn');

if (found.home) {
  const H = found.home, [dx, dz] = dirFrom(H.inside, H.door);
  const inP = [H.inside[0], H.inside[1], H.inside[2]], inT = [H.inside[0] + dx * 5, H.inside[1] + 1.1, H.inside[2] + dz * 5];
  await place(inP, inT, 6000, 'arch_home_in_day');
  const out = [H.outside[0] - dx * 9, H.outside[1] + 2, H.outside[2] - dz * 9];
  await place(out, [H.door[0], H.door[1] + 1, H.door[2]], 18600, 'arch_home_out_night');
  check(H.beds.length >= 1 && (H.seats || []).length >= 1, `village home in the plan has a bed and seats (${H.beds.length}/${(H.seats || []).length})`);
} else check(false, 'a village home with a bed exists near the spawn');

if (found.road) {
  const r = found.road, a = r[1], b = r[4];
  const pos = [a[0] + 0.5, a[1] + 1, a[2] + 0.5];
  await place(pos, [b[0] + 0.5, b[1] + 1.5, b[2] + 0.5], 18600, 'arch_street_night');
  check(found.bus && found.ebike, `the modern street has a bus shelter and e-bikes in the plan (${found.bus}/${found.ebike})`);
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 16)) console.log(l);
check(!logs.some(l => /pageerror/.test(l)), 'no page errors');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);
