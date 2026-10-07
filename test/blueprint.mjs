// Blueprints: /haus puts a catalogue villa in the hand, the ghost lot sits where the player looks (front towards
// the player), the build levels the ground (fill / cut / verge) and lays the house down, undo restores the land.
// Runs on hilly default terrain; optional DESIGN=path.json loads Studio designs first (★ houses).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const settle = async (max = 120) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty, want: g.world.lastWant || 0 }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && !s.want && i > 3) break; await wait(80); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 180000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
if (process.env.DESIGN) { const txt = fs.readFileSync(process.env.DESIGN, 'utf8'); await ev((t) => { localStorage.setItem('r9si.studio', t); VR.game.reloadCustom(); }, txt); }
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.horizon = 1; g.applySettings('*'); }, process.env.PRESET || 'high');
await ev(`VR.game.createWorld({name:'Blueprint',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '777'}',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.env.setTime(4200); });
await settle(90);
const HOUSE = +(process.env.HOUSE || 0);
if (process.env.FAR) { await ev((d) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(d, 150, d * 0.6); }, +process.env.FAR); await settle(160); await ev(() => { const g = VR.game, p = g.player, w = g.world, x = Math.floor(p.pos[0]), z = Math.floor(p.pos[2]); const c = w.col(x >> 4, z >> 4); if (c) p.teleport(p.pos[0], c.height[((z & 15) << 4) | (x & 15)] + 20, p.pos[2]); }); await settle(60); }
// the blueprint in hand; look down a slope ~28 blocks ahead
const t0 = await ev((house) => {
  const g = VR.game, p = g.player;
  g.chat('/haus'); g.chat('/haus ' + house);
  p.flying = true; p.noclip = true;
  const held = p.inv.held;
  return { held: held && held.id, name: held && VR.itemName ? VR.itemName(held.id) : held && VR.ITEMS[held.id].name, pos: p.pos.map(v => Math.round(v)) };
}, HOUSE);
console.log('in hand', JSON.stringify(t0));
// find a spot with relief: sample the terrain around and pick the direction with the biggest height spread
await ev(`window.__spread = '${process.env.SPREAD || '4,14'}'`);
const spot = await ev(() => {
  const g = VR.game, w = g.world, p = g.player, x0 = Math.floor(p.pos[0]), z0 = Math.floor(p.pos[2]), R = VR.R;
  const top = (x, z) => { const c = w.col(x >> 4, z >> 4); if (!(c && c.ready)) return -1; let y = c.height[((z & 15) << 4) | (x & 15)]; while (y > 1) { const s = w.getBlock(x, y, z), t = s && R.types[R.T.type[s]]; if (t && (R.T.flags[s] & VR.F.SOLID) && !(R.T.flags[s] & VR.F.LEAVES) && !/_log$/.test(t.name)) break; y--; } return y; };
  const natural = (x, z) => { const y = top(x, z); if (y < 0) return false; const t = R.types[R.T.type[w.getBlock(x, y, z)]]; return t && (t.cat === 'nature'); };
  let best = null;
  for (let rad = 40; rad <= 110; rad += 14) for (let a = 0; a < 24; a++) {
    const ang = a / 24 * Math.PI * 2, cx = Math.round(x0 + Math.cos(ang) * rad), cz = Math.round(z0 + Math.sin(ang) * rad);
    let lo = 1e9, hi = -1e9, ok = true, nat = 0;
    for (let dz = -18; dz <= 18; dz += 3) for (let dx = -18; dx <= 18; dx += 3) { const h = top(cx + dx, cz + dz); if (h < 0) { ok = false; continue; } lo = Math.min(lo, h); hi = Math.max(hi, h); if (natural(cx + dx, cz + dz)) nat++; }
    if (!ok || nat < 150) continue;
    const [s0, s1] = (window.__spread || '4,14').split(',').map(Number), mid = (s0 + s1) / 2;
    const sp = hi - lo, score = sp >= s0 && sp <= s1 ? 100 - Math.abs(sp - mid) : -Math.abs(sp - mid);
    if (!best || score > best.score) best = { cx, cz, spread: sp, score, y: top(cx, cz), nat };
  }
  return best;
});
console.log('slope spot', JSON.stringify(spot));
const aim = async (from, to) => ev(([c, t]) => { const p = VR.game.player; p.teleport(c[0], c[1], c[2]); p.yaw = Math.atan2(-(t[0] - c[0]), -(t[2] - c[2])); p.pitch = Math.atan2(t[1] - (c[1] + 1.62), Math.hypot(t[0] - c[0], t[2] - c[2])); }, [from, to]);
const P0 = await ev(() => VR.game.player.pos.slice());
const target = [spot.cx + 0.5, spot.y + 0.5, spot.cz + 0.5];
const dir = [target[0] - P0[0], target[2] - P0[2]], dl = Math.hypot(dir[0], dir[1]);
const eye = [target[0] - dir[0] / dl * 12, spot.y + 30, target[2] - dir[1] / dl * 12];
await aim(eye, target); await settle(60);
// wait for the worker plan, then locate like the per-frame input does
let at = null;
for (let i = 0; i < 40; i++) { await step(2); at = await ev((house) => { const g = VR.game, B = g.gadgets.blue, bp = B.get(house); if (!bp) return null; B.at = B.locate(g.player, bp); const a = B.at; return a ? { ok: a.ok, why: a.why, r: a.r, F: a.F, lot: [a.x0, a.z0, a.x1, a.z1], top: bp.top, ops: bp.ops.length / 4, custom: bp.custom, skin: bp.skin, hud: B.hud(VR.itemDef('blueprint_' + house)).replace(/<[^>]+>/g, '') } : { none: true }; }, HOUSE); if (at) break; await wait(150); }
console.log('ghost', JSON.stringify(at));
if (!at || !at.ok) { check(false, 'the ghost lot is buildable at the slope spot' + (at && at.why ? ' (' + at.why + ')' : '')); console.log('ghost not buildable here — stopping'); console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l); await browser.close(); console.log('FAILED ' + fails); process.exit(1); }
await ev(() => { VR.game.hideHud = false; });
await shot('bp_1_ghost');
// remember the land, build, measure
const before = await ev(() => { const g = VR.game, B = g.gadgets.blue, a = window.__region = Object.assign({}, B.at), w = g.world, out = []; for (let x = a.x0 - 3; x <= a.x1 + 3; x++) for (let z = a.z0 - 3; z <= a.z1 + 3; z++) for (let y = a.F - 20; y < a.F + 40; y++) out.push(w.getBlock(x, y, z)); window.__before = out; return { sum: out.reduce((s, v, i) => (s + v * (i % 9973 + 1)) % 1e9, 0), n: out.length }; });
const built = await ev((house) => {
  const g = VR.game, B = g.gadgets.blue, p = g.player, t = performance.now();
  B.build(p, house);
  const a = B.at, w = g.world, R = VR.R;
  // a few probes: the floor slab under the house, the yard grass, the air above the roof
  const [hu, hv, hw, hd] = a.bp.house, mid = a.rect(hu + (hw >> 1), hv + (hd >> 1), hu + (hw >> 1), hv + (hd >> 1));
  const nm = (s) => s ? R.types[R.T.type[s]].name : 'air';
  let solidLot = 0; for (let x = a.x0; x <= a.x1; x++) for (let z = a.z0; z <= a.z1; z++) if (w.getBlock(x, a.F - 1, z)) solidLot++;
  return { ms: Math.round(performance.now() - t), buildMs: Math.round(B.lastMs || 0), undoDepth: g.gadgets.wand.undo.length, changes: g.gadgets.wand.undo[g.gadgets.wand.undo.length - 1].length, floor: nm(w.getBlock(mid[0], a.F, mid[1])), under: nm(w.getBlock(mid[0], a.F - 1, mid[1])), groundCells: solidLot, lotCells: (a.x1 - a.x0 + 1) * (a.z1 - a.z0 + 1), hint: document.getElementById('hint').textContent };
}, HOUSE);
console.log('built', JSON.stringify(built));
// breaking one cell of a multi-block VX model (a sofa in the new house) takes the whole piece
const brk = await ev(() => {
  const g = VR.game, a = window.__region, w = g.world, R = VR.R, nm = (s) => s ? R.types[R.T.type[s]].name : 'air';
  let at = null;
  for (let x = a.x0; x <= a.x1 && !at; x++) for (let z = a.z0; z <= a.z1 && !at; z++) for (let y = a.F; y < a.F + 12 && !at; y++) { const s = w.getBlock(x, y, z); if (s && /^vm_sofa/.test(nm(s))) at = [x, y, z, s]; }
  if (!at) return { sofa: null };
  const name = nm(at[3]), count = () => { let n = 0; for (let x = at[0] - 4; x <= at[0] + 4; x++) for (let z = at[2] - 4; z <= at[2] + 4; z++) if (nm(w.getBlock(x, at[1], z)) === name) n++; return n; };
  const before = count();
  g.player.breakBlock(at[0], at[1], at[2], at[3], false);
  return { sofa: name, cellsAround: before, after: count() };
});
console.log('break a sofa cell:', JSON.stringify(brk));
await settle(120);
await ev(() => { VR.game.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; });
await shot('bp_2_built');
// a second angle: from the side, higher
const a2 = await ev(() => { const a = window.__region; return { cx: (a.x0 + a.x1) / 2, cz: (a.z0 + a.z1) / 2, F: a.F, r: a.r }; });
await aim([a2.cx + 26, a2.F + 22, a2.cz + 30], [a2.cx, a2.F + 3, a2.cz]); await settle(60); await step(6); await shot('bp_3_side');
// undo restores the land exactly
await ev(() => VR.game.gadgets.undo());
await settle(80);
const after = await ev(() => { const g = VR.game, a = window.__region, w = g.world, out = []; for (let x = a.x0 - 3; x <= a.x1 + 3; x++) for (let z = a.z0 - 3; z <= a.z1 + 3; z++) for (let y = a.F - 20; y < a.F + 40; y++) out.push(w.getBlock(x, y, z)); return { sum: out.reduce((s, v, i) => (s + v * (i % 9973 + 1)) % 1e9, 0), n: out.length }; });
console.log('diffbox', JSON.stringify(await ev(() => { const g = VR.game, a = window.__region, w = g.world; let i = 0, bb = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9], cols = new Set(); for (let x = a.x0 - 3; x <= a.x1 + 3; x++) for (let z = a.z0 - 3; z <= a.z1 + 3; z++) for (let y = a.F - 20; y < a.F + 40; y++) { const o = window.__before[i++], n = w.getBlock(x, y, z); if (o !== n) { bb = [Math.min(bb[0], x), Math.min(bb[1], y), Math.min(bb[2], z), Math.max(bb[3], x), Math.max(bb[4], y), Math.max(bb[5], z)]; cols.add((x >> 4) + ',' + (z >> 4)); } } return { bb, lot: [a.x0, a.z0, a.x1, a.z1, a.F], cols: [...cols] }; })));
console.log('diff', JSON.stringify(await ev(() => { const g = VR.game, a = window.__region, w = g.world, R = VR.R, nm = (s) => s ? R.types[R.T.type[s]].name : 'air'; let i = 0; const d = new Map(); for (let x = a.x0 - 3; x <= a.x1 + 3; x++) for (let z = a.z0 - 3; z <= a.z1 + 3; z++) for (let y = a.F - 20; y < a.F + 40; y++) { const o = window.__before[i++], n = w.getBlock(x, y, z); if (o !== n) { const k = nm(o) + '→' + nm(n); d.set(k, (d.get(k) || 0) + 1); } } return [...d.entries()].slice(0, 20); })));
const realDiff = await ev(() => { const g = VR.game, a = window.__region, w = g.world, R = VR.R, nm = (s) => s ? R.types[R.T.type[s]].name : 'air'; let i = 0, n = 0; for (let x = a.x0 - 3; x <= a.x1 + 3; x++) for (let z = a.z0 - 3; z <= a.z1 + 3; z++) for (let y = a.F - 20; y < a.F + 40; y++) { const o = window.__before[i++], nn = w.getBlock(x, y, z); if (o !== nn) { const k = nm(o) + nm(nn); if (!/^(grass_block|dirt)(grass_block|dirt)$/.test(k) && !/_leavesair$/.test(k) && nm(o) !== nm(nn)) n++; } } return n; });
console.log('undo restores the land:', realDiff === 0 ? 'OK' : 'DIFFERENT (' + realDiff + ' cells besides grass spreading / leaf decay)');
check(realDiff === 0, 'undo restores the land exactly (' + realDiff + ' other cells differ)');
await shot('bp_4_undone');
check(!logs.some(l => /pageerror\]/.test(l)), 'no page errors');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
