// Village life: kids' games, a family hike and a boat trip (headless)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail|existing/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const TOD = +(process.env.TOD || 2600);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d, tod]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms, TOD]); await wait(5); } };
const shot = async (name, tod) => { await ev((tod) => { window.__norender = false; const g = VR.game; if (tod !== undefined) g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }, tod); await wait(150); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 90000 }); console.log('shot', name); };
const lookAt = async (pos, tgt) => { await ev(([pos, tgt]) => { const p = VR.game.player; p.teleport(pos[0], pos[1], pos[2]); p.flying = true; p.vel = [0, 0, 0]; const dx = tgt[0] - pos[0], dy = tgt[1] - pos[1] - 1.6, dz = tgt[2] - pos[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }, [pos, tgt]); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.renderDist = 6; g.settings.dynRes = false; g.settings.minimap = false; g.applySettings('renderDist'); });
await ev(`VR.game.createWorld({name:'Life',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '777'}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev((t) => { VR.game.env.setTime(t); VR.game.zenFreezeTime = true; window.requestAnimationFrame = () => 0; }, TOD);
await wait(300);
for (let i = 0; i < 25; i++) { await step(10); await wait(60); }
const vinfo = await ev(() => { const V = VR.game.villages; const vil = [...V.known.values()].find(v => v.active); if (!vil) return null; const sh = V.shoreOf(vil); const hs = V.hikeSpots(vil); return { name: vil.name, plaza: vil.plan.plaza, kids: vil.agents.filter(a => a.kid).length, shore: sh ? { water: sh.water, shore: sh.shore, loop: sh.loop.length } : null, hikes: hs.map(h => [h.x, h.y, h.z]) }; });
console.log('village', JSON.stringify(vinfo));
if (!vinfo) { console.log(logs.join('\n')); await browser.close(); process.exit(0); }
// ---- kids at play
await ev(() => { const V = VR.game.villages; for (const a of V.agents) if (a.kid) { V.setAct(a, { type: 'play' }); a.thinkT = 99; } });
const kidPos = async () => ev(() => VR.game.villages.agents.filter(a => a.kid).map(a => [a.pos[0], a.pos[2]]));
const k0 = await kidPos();
for (let i = 0; i < 12; i++) { await step(10); }
const k1 = await kidPos();
const moved = k0.map((p, i) => Math.hypot(p[0] - k1[i][0], p[1] - k1[i][1]).toFixed(1));
const game = await ev(() => { const V = VR.game.villages; const vil = [...V.known.values()].find(v => v.active); return vil.game ? { type: vil.game.type, it: vil.game.it && vil.game.it.p.name, seeker: vil.game.seeker && vil.game.seeker.p.name, phase: vil.game.phase } : null; });
console.log('kids moved in 4s:', moved.join(' '), 'game', JSON.stringify(game));
const pz = vinfo.plaza;
await lookAt([pz.x + 9, pz.y + 7, pz.z + 9], [pz.x, pz.y, pz.z]);
await step(2);
await shot('life_play');
// ---- family hike
const O = await ev(() => { const V = VR.game.villages; const vil = [...V.known.values()].find(v => v.active); for (const a of V.agents) if (a.kid) { a.thinkT = 0; } if (vil.outing) { console.log('existing outing ' + vil.outing.type + ' ' + vil.outing.phase); V.endOuting(vil); } vil.outT = 1e9; const o = V.startOuting(vil, 'hike'); return o ? { type: o.type, fam: o.fam.surname, n: o.agents.length, dest: o.dest } : null; });
console.log('outing', JSON.stringify(O));
if (O) {
  for (let s = 0; s < 8; s++) {
    for (let i = 0; i < 6; i++) await step(10);
    const st = await ev(() => { const V = VR.game.villages; const vil = [...V.known.values()].find(v => v.active); const o = vil.outing; if (!o) return null; return { phase: o.phase, pos: o.agents.map(a => a.pos.map(v => v.toFixed(0)).join(',') + ':' + a.pose + ':' + (a.path ? 'p' : a.steer ? 's' : '-')) }; });
    console.log('hike', s, JSON.stringify(st));
    if (!st) break;
    if (s === 2 || s === 7 || st.phase === 'picnic') {
      const L = await ev(() => { const V = VR.game.villages; const vil = [...V.known.values()].find(v => v.active); const o = vil.outing; return o ? o.leader.pos.slice() : null; });
      if (L) { await lookAt([L[0] + 5, L[1] + 3.5, L[2] + 5], L); await step(1); await shot('life_hike_' + s); }
      if (st.phase === 'picnic' && s > 3) break;
    }
  }
  await ev(() => { const V = VR.game.villages; const vil = [...V.known.values()].find(v => v.active); if (vil.outing) V.endOuting(vil); });
}
// ---- boat trip
if (vinfo.shore) {
  const B = await ev(() => { const V = VR.game.villages; const vil = [...V.known.values()].find(v => v.active); if (vil.outing) V.endOuting(vil); const o = V.startOuting(vil, 'boat'); return o ? { type: o.type, fam: o.fam.surname, n: o.agents.length } : null; });
  console.log('boat', JSON.stringify(B));
  for (let s = 0; s < 14 && B; s++) {
    for (let i = 0; i < 8; i++) await step(10);
    const st = await ev(() => { const V = VR.game.villages; const vil = [...V.known.values()].find(v => v.active); const o = vil.outing; if (!o) return null; return { phase: o.phase, wp: o.boat ? o.boat.wp + '/' + o.route.length : '-', boat: o.boat ? o.boat.pos.map(v => v.toFixed(1)) : null, lead: o.leader.pos.map(v => v.toFixed(0)) }; });
    console.log('boat', s, JSON.stringify(st));
    if (!st) break;
    if (st.boat && (s % 3 === 1)) { const b = st.boat.map(Number); await lookAt([b[0] + 6, b[1] + 4, b[2] + 6], b); await step(1); await shot('life_boat_' + s); }
  }
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 25)) console.log(l);
await browser.close();
