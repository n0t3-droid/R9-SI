// u-worlds in the browser (docs/superpowers/plans/2026-10-31-u-worlds.md): a new Kreativ world (seed 4242), 960 × 540, de-DE,
// Balanced. The 🪐 Welten panel; a Kreativ jump to every world (Aquamarin by the panel's button, then Ocker, Zinnober,
// Basalt, Opal and a world of Ocker's kind under another star); on each: Herzwelt's gravity, the landing's land, the
// first village of its natives (people about), a native up close, its creatures, the spawner; the cost at Ocker's
// village (Very Low / High) → test/shots/world_*.png, test/shots/worlds_rich_sheet.jpg, .tmp_tests/worlds_rich_run.json
//   nohup bash test/wt_run.sh worlds_rich.mjs 3600 > .tmp_tests/worlds_rich.log 2>&1 &   (WORLDS=aqua,ocker · ONLY=cost)
// regress: skip  (a showcase with pictures; the gate is test/worlds_eco.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
const require = createRequire(import.meta.url);
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html';
const SHOTS = ROOT + '/test/shots/';
const SEED = process.env.SEED || '4242', DUR = +(process.env.DUR || 300);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null, want = (s) => !ONLY || ONLY.includes(s);
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + ' (' + secs() + ')'); };
const run = { seed: SEED };
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/worlds_rich_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto(DIST);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); if (window.__each) window.__each(g); } }, [Math.min(10, n - k), dtms]); await wait(3); } };
const settle = async (max = 50) => {
  let s = null;
  for (let i = 0; i < max; i++) {
    await step(20, 16);
    s = await ev(() => { const g = VR.game, w = g.world, p = g.player; if (!w || !p || g.state !== 'play') return { state: g.state }; const rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if (sc.dirty || sc.pending) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= rd * rd) dirty += n; } return { state: g.state, busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0 }; });
    if (s.state === 'play' && s.busy === 0 && s.pend === 0 && s.dirty === 0 && s.up === 0 && i > 2) break;
    await wait(30);
  }
  return s;
};
const grab = async (name, frames = 4) => {
  const url = await ev((frames) => { try { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; } catch (e) { window.__norender = true; return null; } }, frames);
  if (url && url.length > 2000) { fs.writeFileSync(SHOTS + name, Buffer.from(url.split(',')[1], 'base64')); console.log('  📷 ' + name); return SHOTS + name; }
  console.log('  !! no picture ' + name); return null;
};
const shotDom = async (name) => { try { await ev(() => { window.__norender = false; const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); window.__norender = true; }); await page.screenshot({ path: SHOTS + name, timeout: 120000 }); console.log('  📷 ' + name); return SHOTS + name; } catch (e) { console.log('  !! ' + name + ' ' + String(e.message).slice(0, 80)); return null; } };
async function trip(start, to) {
  await ev(start, to);
  for (let i = 0; i < 600; i++) { await step(10, 33); const s = await ev(() => ({ st: VR.game.state, dim: VR.game.dim, busy: VR.Travel.busy(VR.game) })); if (s.dim === to && s.st === 'play' && !s.busy) return true; await wait(20); }
  return false;
}
// look at a point from where the player stands (the eye's yaw / pitch)
const lookAt = (P) => ev((P) => { const p = VR.game.player, e = p.eyePos(), dx = P[0] - e[0], dy = P[1] - e[1], dz = P[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw; }, P);
const sheet = [];

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Welten',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world');
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(6000); });
await settle(30);

// ---------------------------------------------------------------- 0 · Kreativ: the worlds panel, every world listed
const ws = await ev(() => VR.Travel.worlds(VR.game).map(w => w.dim));
run.worlds = ws;
check(['basalt', 'opal', 'zinn', 'ocker', 'aqua'].every(k => ws.includes(k)) && ws.some(d => /^x\./.test(d)), 'Kreativ: every world in the list (' + ws.join(', ') + ')');
check(await ev(() => VR.DimReg.realGrav === false && Math.abs(VR.game.player.grav - 30) < 1e-6 || !VR.game.player.grav), 'the gravity switch off by default');
await ev(() => VR.WorldLife.openWorlds(VR.game));
await wait(300);
const panel = await shotDom('worlds_panel.png');
const nBtn = await ev(() => document.querySelectorAll('#ecoWorlds [data-eco]').length);
check(nBtn >= ws.length, `the panel shows ${nBtn - 1} worlds`);
const EXO = ws.find(d => /^x\..*\.ocker$/.test(d)) || ws.find(d => /^x\./.test(d));
const WORLDS = (process.env.WORLDS ? process.env.WORLDS.split(',') : ['aqua', 'ocker', 'zinn', 'basalt', 'opal', EXO]).filter(Boolean);
const trips = [];
let first = true;
for (const dim of WORLDS) {
  console.log('== ' + dim);
  const t0 = Date.now();
  const ok = await trip(first ? () => { document.querySelector('#ecoWorlds [data-eco="' + 'aqua' + '"]').click(); } : (d) => VR.Travel.go(VR.game, { dim: d, via: 'cmd' }), dim).catch(() => false);
  first = false;
  trips.push({ dim, ok, s: Math.round((Date.now() - t0) / 1000) });
  check(ok, `the Kreativ jump to ${dim} (${Math.round((Date.now() - t0) / 1000)} s)`);
  if (!ok) continue;
  await ev(() => { const g = VR.game; g.env.setTime(5200); if (g.ui && g.ui.screen && g.ui.show) g.ui.show(null); });
  await settle(40);
  const gr = await ev(() => ({ grav: VR.game.player.grav || VR.DimReg.walkGravity(VR.game.dim), real: VR.DimReg.gravity(VR.game.dim), kind: VR.WorldLife.kindOf(VR.game) }));
  check(Math.abs(gr.grav - 30) < 1e-6 && gr.kind, `${dim}: Herzwelt's gravity (${gr.grav}; real ${gr.real.toFixed(2)}), the ecosystem ${gr.kind}`);
  const kind = gr.kind || dim.split('.').pop();
  // the landing's land
  await ev(() => { const p = VR.game.player; p.flying = true; p.pitch = -0.12; });
  await step(20);
  const land = await grab(`world_${kind}${dim.startsWith('x.') ? '_exo' : ''}_land.png`);
  // the first village: discovered, its people about
  let V = null;
  const vid = 'eco:' + kind + ':0';
  await ev((vid) => { const g = VR.game; g.villages.siteAt = null; g.villages.siteT = 0; }, vid);
  for (let i = 0; i < 30; i++) { await step(20, 33); V = await ev((vid) => { const vil = VR.game.villages.sites.find(s => s.id === vid); return vil ? { x: vil.x, y: vil.y, z: vil.z, name: vil.name } : null; }, vid); if (V) break; await wait(200); }
  check(!!V, `${dim}: the village ${V ? V.name : '?'} on the map`);
  if (!V) continue;
  await ev((V) => { const p = VR.game.player; p.flying = true; p.teleport(V.x + 22, V.y + 11, V.z + 20); }, V);
  // (the village's columns loaded and meshed before the picture: the far land alone shows nothing of it)
  for (let i = 0; i < 90; i++) { await step(10, 33); const ok = await ev((V) => { const w = VR.game.world; for (const dx of [-24, 0, 24]) for (const dz of [-24, 0, 24]) if (!w.isLoaded(V.x + dx, V.z + dz)) return false; return true; }, V); if (ok) break; await wait(300); }
  await settle(60);
  let vs = null;
  for (let i = 0; i < 30; i++) { await step(20, 33); vs = await ev((vid) => { const v = VR.game.villages.known.get(vid); return v ? { active: v.active, agents: v.agents.length, homes: v.plan.homes.length, style: v.plan.style, people: v.people ? v.people.length : 0, name: v.name, first: v.people && v.people[0] ? v.people[0].name : '' } : null; }, vid); if (vs && vs.active && vs.agents > 0) break; await wait(150); }
  check(vs && vs.active && vs.agents >= 4 && vs.style === 'sp:' + kind, `${dim}: ${vs ? vs.name : '?'} — ${vs ? vs.homes : 0} homes, ${vs ? vs.agents : 0} people about (${vs ? vs.first : ''} …), style ${vs ? vs.style : ''}`);
  await lookAt([V.x, V.y + 1, V.z]);
  await step(30);
  const vshot = await grab(`world_${kind}${dim.startsWith('x.') ? '_exo' : ''}_village.png`);
  // a native up close
  const nat = await ev((vid) => { const g = VR.game, v = g.villages.known.get(vid); const P = v.plan; const far = (o) => Math.hypot(o.pos[0] - P.x, o.pos[2] - P.z); const ag = v ? v.agents.filter(o => !o.kid && o.pose !== 'sleep').sort((a, b) => far(b) - far(a)) : []; const a = ag[0] || (v && v.agents[0]); if (!a) return null; const p = g.player; const yaw = a.yaw || 0; p.flying = true; p.teleport(a.pos[0] - Math.sin(yaw) * 2.6, a.pos[1] + 0.2, a.pos[2] - Math.cos(yaw) * 2.6); a.freeze = 3; return { pos: a.pos.slice(), name: a.name, feat: a.p.look && a.p.look.feat, skin: a.p.look && a.p.look.skin }; }, vid);
  check(nat && nat.feat, `${dim}: a native, ${nat ? nat.name : '?'} (feature ${nat ? nat.feat : '-'})`);
  let nshot = null;
  if (nat) { await lookAt([nat.pos[0], nat.pos[1] + 1.4, nat.pos[2]]); await step(6); nshot = await grab(`world_${kind}${dim.startsWith('x.') ? '_exo' : ''}_native.png`); }
  // the creatures: one of each in a row before the eye
  const fa = await ev((kind) => {
    const g = VR.game, p = g.player, E = VR.WorldEco.KINDS[kind].fauna, out = [];
    for (const m of g.entities.mobs.slice()) if (m.def && m.def.eco) m.dead = true;
    // (an open place 40 m off the plaza, the eye 2.5 m over the ground looking a little down; the creatures in a row 5 m ahead on the ground)
    const v = g.villages.known.get('eco:' + kind + ':0'), P = v.plan, w = g.world; const ax = P.x + 40, az = P.z + 6; const gy = w.topAt(ax, az);
    p.flying = true; p.teleport(ax + 0.5, gy + 1.6, az + 0.5); p.yaw = 0; p.pitch = -0.22; const e = p.pos; const yaw = 0;
    E.forEach((f, i) => { const s = (i - (E.length - 1) / 2) * 2.4, fx = -Math.sin(yaw) * 5.5 + Math.cos(yaw) * s, fz = -Math.cos(yaw) * 5.5 - Math.sin(yaw) * s; const gx = Math.floor(e[0] + fx), gz = Math.floor(e[2] + fz), ty = w.topAt(gx, gz); const m = g.entities.summon(f.id, e[0] + fx, (f.does === 'fly' ? e[1] + 0.8 : ty + 1.05), e[2] + fz); if (m) { m.ai.t = 30; m.ai.state = 'idle'; } if (m) { m.alt = m.pos[1]; m.home = { x: m.pos[0] - 0.5, z: m.pos[2] - 0.5, r: 0.5 }; m.waterY = m.pos[1]; m.vel = [0, 0, 0]; out.push(f.id); } });
    return out;
  }, kind);
  check(fa.length >= 2, `${dim}: its creatures ${fa.join(', ')}`);
  await step(3);
  const fshot = await grab(`world_${kind}${dim.startsWith('x.') ? '_exo' : ''}_fauna.png`);
  // the spawner keeps life round the player
  await ev(() => { for (const m of VR.game.entities.mobs) if (m.def && m.def.eco) m.dead = true; VR.WorldLife.st.t = 0; });
  for (let i = 0; i < 16; i++) { await ev(() => { VR.WorldLife.st.t = 0; }); await step(10, 33); }
  const alive = await ev(() => VR.game.entities.mobs.filter(m => m.def && m.def.eco && !m.dead).length);
  check(alive >= 2, `${dim}: the spawner keeps ${alive} creatures about`);
  sheet.push({ label: `${dim}: land · village · native · creatures`, imgs: [land, vshot, nshot, fshot].filter(Boolean) });
  run[dim] = { grav: gr, village: vs, native: nat, fauna: fa, alive };
  save();
}
run.trips = trips;

// ---------------------------------------------------------------- the cost at Ocker's village (Very Low / High)
if (want('cost') && WORLDS.includes('ocker')) {
  await trip((d) => VR.Travel.go(VR.game, { dim: d, via: 'cmd' }), 'ocker');
  await settle(30);
  const V = await ev(() => { const s = VR.game.villages.sites.find(q => q.id === 'eco:ocker:0'); return s ? [s.x, s.y, s.z] : null; });
  const cost = {};
  if (V) for (const preset of ['potato', 'high']) {
    await ev((pr) => { const g = VR.game; g.applyPreset(pr); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); }, preset);
    for (const at of ['landing', 'village']) {
      await ev(([V, at]) => { const g = VR.game, p = g.player; p.flying = true; if (at === 'village') p.teleport(V[0] + 22, V[1] + 8, V[2] + 22); else { const sp = VR.DimReg.get('ocker').gen((g.meta.seed >>> 0), { bgen: VR.Bodies.bgenOf(g.meta) }).findSpawn(VR.Bodies.profile('ocker').spawn.x, VR.Bodies.profile('ocker').spawn.z); p.teleport(sp[0], sp[1] + 2, sp[2]); } }, [V, at]);
      await settle(25);
      if (at === 'village') await lookAt([V[0], V[1], V[2]]);
      const r = await ev(() => { const g = VR.game; window.__norender = false; for (let i = 0; i < 6; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); const ms = []; for (let i = 0; i < 16; i++) { const t = performance.now(); g.last = t - 33; g.loop(t); g.renderer.gl.finish(); ms.push(performance.now() - t); } window.__norender = true; ms.sort((a, b) => a - b); return { ms: +ms[8].toFixed(1), mobs: g.entities.mobs.length, agents: g.villages.agents.length }; });
      cost[preset + '_' + at] = r;
    }
  }
  run.cost = cost; console.log('  cost ' + JSON.stringify(cost));
  check(V && cost.potato_village, 'cost measured: ' + JSON.stringify(cost));
}

check(!logs.some(l => /pageerror/.test(l)), 'no page error' + (logs.length ? ': ' + logs.slice(0, 3).join(' · ') : ''));
save();
if (sheet.length) { if (panel) sheet.unshift({ label: 'Kreativ: 🪐 Welten', imgs: [panel] }); fs.writeFileSync(ROOT + '/.tmp_tests/worlds_rich_sheet.json', JSON.stringify({ w: 620, rows: sheet })); try { console.log('  ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'worlds_rich_sheet.jpg', ROOT + '/.tmp_tests/worlds_rich_sheet.json']).toString().trim()); } catch (e) { console.log('  !! sheet ' + e.message); } }
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
