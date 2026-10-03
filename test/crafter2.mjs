// v0.33 Crafter: edit around the lot (what the house puts outside its lot — bay windows, steps — and 4 blocks of the
// ring), the replace tool (one piece / every piece of a kind, keeping place and turn: blocks, glass, doors, furniture
// models, stairs), the Spieler-Modus (first person with the game's physics: walk, jump, fly, build at the crosshair, no
// block into yourself), connected glass in the Studio's renderer, and Update ins Spiel with all of it.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--allow-file-access-from-files'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { if (m.type() === 'error' || /error|fail/i.test(m.text())) logs.push(m.text().slice(0, 400)); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
await page.goto('file:///home/claude/vr/dist/studio.html');
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const shot = (n) => page.screenshot({ path: `/home/claude/vr/test/shots/${n}.png`, timeout: 180000 });
const t0 = Date.now();
await ev(() => { try { localStorage.removeItem('r9si.studio'); } catch (e) { /* */ } });
for (let i = 0; i < 240; i++) { await wait(500); const s = await ev(() => ({ boot: document.getElementById('studio').classList.contains('boot'), houses: window.__studio ? window.__studio.HOUSE.size : -1 })); if (!s.boot && s.houses >= 2) break; }
console.log('studio up after', ((Date.now() - t0) / 1000).toFixed(1), 's');
await ev(() => window.__studio.selectHouse(0)); await wait(500);
await ev(() => window.__studioCore.setMode('craft'));
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => !!(VR.Crafter.house && VR.Crafter.gpu))) break; }
await wait(1500);
const info = await ev(() => { const h = VR.Crafter.house; return { name: h.name, dims: [h.sx, h.sy, h.sz], F: h.F, lot: h.lot, pad: h.pad }; });
console.log('crafter open', JSON.stringify(info));
const settle = async () => { for (let i = 0; i < 40; i++) { await wait(250); } };

// ---------------------------------------------------------------- 1. around the lot
console.log('1 · edit around the lot');
const ring = await ev(() => {
  const C = VR.Crafter, h = C.house, R = VR.R, idx = (x, y, z) => (y * h.sz + z) * h.sx + x, nm = (s) => s ? R.types[R.T.type[s]].name : 'air';
  // something the house itself put outside its lot (a bay window, front steps)
  let out = null;
  for (let y = h.F; y < h.sy && !out; y++) for (let z = 0; z < h.sz && !out; z++) for (let x = 0; x < h.sx && !out; x++) {
    if (x >= h.pad && z >= h.pad && x < h.pad + h.lot[0] && z < h.pad + h.lot[1]) continue;
    const i = idx(x, y, z); if (h.wrote[i] && h.blocks[i]) out = [x, y, z, nm(h.blocks[i])];
  }
  const res = {};
  if (out) { C.breakAt({ x: out[0], y: out[1], z: out[2] }); res.house = out; res.houseOutsideNow = nm(h.blocks[idx(out[0], out[1], out[2])]); }
  // the ring: 3 blocks in front of the lot is fine, 5 is too far
  const near = [h.pad + 2, h.F, h.pad - 3], far = [h.pad + 2, h.F, h.pad - 5];
  C.hot[C.slot] = 'vollton_mint';
  C.placeAt({ x: near[0], y: near[1] - 1, z: near[2], face: 2, px: near[0] + 0.5, py: near[1], pz: near[2] + 0.5, state: h.blocks[idx(near[0], near[1] - 1, near[2])] });
  C.placeAt({ x: far[0], y: far[1] - 1, z: far[2], face: 2, px: far[0] + 0.5, py: far[1], pz: far[2] + 0.5, state: h.blocks[idx(far[0], far[1] - 1, far[2])] });
  res.near = nm(h.blocks[idx(near[0], near[1], near[2])]); res.far = nm(h.blocks[idx(far[0], far[1], far[2])]); res.tip = document.getElementById('craftTip').textContent;
  return res;
});
console.log('  ', JSON.stringify(ring));
check(!ring.house || ring.houseOutsideNow === 'air', 'a piece the house put outside its lot can be removed (' + (ring.house ? ring.house[3] : 'none found') + ')');
check(ring.near === 'vollton_mint', 'a block 3 in front of the lot can be placed');
check(ring.far === 'air' && /weit/.test(ring.tip), 'a block 5 in front of the lot is refused with a message');

// ---------------------------------------------------------------- 2. replace
console.log('2 · replace');
const repl = await ev(() => {
  const C = VR.Crafter, h = C.house, R = VR.R, T = R.T, idx = (x, y, z) => (y * h.sz + z) * h.sx + x, nm = (s) => s ? R.types[T.type[s]].name : 'air';
  const find = (re, from) => { for (let i = from || 0; i < h.blocks.length; i++) { const s = h.blocks[i]; if (s && re.test(nm(s))) { const x = i % h.sx, z = Math.floor(i / h.sx) % h.sz, y = Math.floor(i / (h.sx * h.sz)); if (C.inLot(x, z)) return { x, y, z, state: s, name: nm(s) }; } } return null; };
  const count = (n) => { let k = 0; for (let i = 0; i < h.blocks.length; i++) if (h.blocks[i] && nm(h.blocks[i]) === n) k++; return k; };
  const out = {};
  // a window block → panorama glass (one), then every window of that kind
  const win = find(/^window_(black|white)$/);
  if (win) {
    const before = count(win.name);
    C.hot[C.slot] = 'panorama_black'; C.replaceAt(win, false);
    out.one = { from: win.name, now: nm(h.blocks[idx(win.x, win.y, win.z)]), left: count(win.name), before };
    const w2 = find(new RegExp('^' + win.name + '$'));
    if (w2) { C.replaceAt(w2, true); out.all = { left: count(win.name), panorama: count('panorama_black'), tip: document.getElementById('craftTip').textContent }; }
    // one undo step takes the whole "replace all" back
    C.undoStep(false); out.undoAll = count(win.name);
    C.undoStep(true);
  }
  // a furniture model → another model: same anchor, same facing, every part
  const sofa = find(/^vm_sofa/);
  if (sofa) {
    const t = R.types[T.type[sofa.state]], f = t.get(sofa.state, 'facing');
    const other = Object.keys(VR.VM.MODELS).find(n => /^vm_sofa/.test(n) && n !== sofa.name && VR.VM.footprint(VR.VM.MODELS[n], 0).length <= VR.VM.footprint(VR.VM.MODELS[sofa.name], 0).length) || Object.keys(VR.VM.MODELS).find(n => /armchair|chair/.test(n));
    const partsBefore = count(sofa.name), newBefore = count(other), fpOld = VR.VM.footprint(VR.VM.MODELS[sofa.name], f).length;
    C.hot[C.slot] = other; const r = C.replaceAt(sofa, false);
    const nt = R.byName[other]; let parts = 0; const facings = new Set();
    for (let i = 0; i < h.blocks.length; i++) if (T.type[h.blocks[i]] === nt.id) { parts++; facings.add(nt.get(h.blocks[i], 'facing')); }
    out.model = { from: sofa.name, to: other, r, partsBefore, fpOld, oldLeft: count(sofa.name), newParts: parts - newBefore, footprint: VR.VM.footprint(VR.VM.MODELS[other], f).length, facing: [...facings], wantFacing: f };
  }
  // stairs keep their direction and half
  const stair = find(/_stairs$/);
  if (stair) {
    const t = R.types[T.type[stair.state]], want = [t.get(stair.state, 'facing'), t.get(stair.state, 'half')];
    const to = stair.name === 'vollton_coral_stairs' ? 'vollton_mint_stairs' : 'vollton_coral_stairs';
    C.hot[C.slot] = to; C.replaceAt(stair, false);
    const s = h.blocks[idx(stair.x, stair.y, stair.z)], nt = R.types[T.type[s]];
    out.stairs = { from: stair.name, to: nm(s), want, got: nt.has('facing') ? [nt.get(s, 'facing'), nt.get(s, 'half')] : null };
  }
  // a door → a modern door: both halves, same facing
  const door = find(/door/);
  if (door) {
    const t = R.types[T.type[door.state]];
    const lowY = t.has('half') ? (t.get(door.state, 'half') ? door.y - 1 : door.y) : (R.T.type[h.blocks[idx(door.x, door.y - 1, door.z)]] === t.id ? door.y - 1 : door.y);
    const want = t.has('facing') ? t.get(door.state, 'facing') : -1;
    C.hot[C.slot] = 'door_glass_white'; C.replaceAt(door, false);
    const a = h.blocks[idx(door.x, lowY, door.z)], b = h.blocks[idx(door.x, lowY + 1, door.z)], nt = R.byName.door_glass_white;
    out.door = { from: door.name, lower: nm(a), upper: nm(b), halves: T.type[a] === nt.id && T.type[b] === nt.id ? [nt.get(a, 'half'), nt.get(b, 'half')] : null, facing: T.type[a] === nt.id ? nt.get(a, 'facing') : -1, oldFacing: want, tip: document.getElementById('craftTip').textContent };
  }
  // a plain block replaced by a model needs room: a 3-wide sofa into a 1-wide gap is refused, nothing changes
  return out;
});
console.log('  ', JSON.stringify(repl));
if (repl.one) check(repl.one.now === 'panorama_black' && repl.one.left === repl.one.before - 1, 'one window block replaced');
if (repl.all) check(repl.all.left === 0, 'every window of that kind replaced (' + repl.all.panorama + ' panorama blocks)');
if (repl.one) check(repl.undoAll === repl.one.before - 1, 'one undo takes "replace all" back');
if (repl.model) check(repl.model.oldLeft === repl.model.partsBefore - repl.model.fpOld && repl.model.newParts === repl.model.footprint && repl.model.facing.includes(repl.model.wantFacing), 'furniture model replaced whole, same facing (' + repl.model.from + ' → ' + repl.model.to + ')');
if (repl.stairs) check(repl.stairs.got && repl.stairs.got[0] === repl.stairs.want[0] && repl.stairs.got[1] === repl.stairs.want[1], 'stairs keep direction and half');
if (repl.door) check(repl.door.halves && repl.door.halves[0] === 0 && repl.door.halves[1] === 1 && repl.door.facing === repl.door.oldFacing, 'door replaced by both halves of the new door, same direction (' + repl.door.from + ')');
await wait(1500);

// ---------------------------------------------------------------- 3. connected glass in the Studio
console.log('3 · glass in the Studio');
await ev(() => {
  const C = VR.Crafter, h = C.house, R = VR.R, st = (n) => R.byName[n].defaultState;
  const L = [], x0 = h.pad + 2, z0 = h.pad - 1, y0 = h.F;
  for (let x = 0; x < 9; x++) for (let y = 0; y < 4; y++) L.push([x0 + x, y0 + y, z0, st('vollton_white')]);
  for (let x = 1; x < 4; x++) for (let y = 1; y < 3; y++) L.push([x0 + x, y0 + y, z0, st('window_black')]);
  for (let x = 5; x < 8; x++) for (let y = 1; y < 3; y++) L.push([x0 + x, y0 + y, z0, st('glass')]);
  for (let x = 0; x < 9; x++) L.push([x0 + x, y0, z0 - 2, x === 0 || x === 8 ? st('vollton_white') : st('glass_pane')]);
  for (let x = 1; x < 8; x++) L.push([x0 + x, y0 + 1, z0 - 2, st('light_blue_stained_glass_pane')]);
  L.push([x0, y0 + 1, z0 - 2, st('vollton_white')], [x0 + 8, y0 + 1, z0 - 2, st('vollton_white')]);
  C.applyChanges(L);
  const sc = window.__st.scene; sc.center = [x0 + 4.5, y0 + 1.5, z0 - 1]; window.__st.cam.yaw = 3.14159 + 0.25; window.__st.cam.pitch = 0.18; window.__st.cam.dist = 13;
});
await wait(4000);
await shot('cr2_glass');

// ---------------------------------------------------------------- 4. Spieler-Modus
console.log('4 · Spieler-Modus');
await ev(() => { window.__st.cam.dist = 0; });
const pm0 = await ev(() => { const P = VR.Crafter.player; P.noLock = true; P.enter(); return { on: P.on, pos: P.pos.map(v => +v.toFixed(2)), fly: !!(window.__st.cam.fly && window.__st.cam.fly.player), tool: (document.querySelector('#craftTools button[data-fn="player"]') || {}).innerText, keys: !!document.querySelector('#craftLegend .keys') }; });
console.log('  ', JSON.stringify(pm0));
check(pm0.on && pm0.fly && pm0.keys, 'player mode on, the camera at the player, the keys in the legend');
await wait(800);
await shot('cr2_player_1');
// the keys reach the player (through the page, like a player types) — software rendering is slow, so the physics
// is then driven in fixed steps (PM.step) for exact checks
const p1 = await ev(() => VR.Crafter.player.pos.slice());
// (software rendering draws slowly: keep W down until a few frames have passed)
await page.keyboard.down('w');
for (let i = 0; i < 40; i++) { await wait(300); const d = await ev((a) => Math.hypot(VR.Crafter.player.pos[0] - a[0], VR.Crafter.player.pos[2] - a[2]), p1); if (d > 0.5) break; }
await page.keyboard.up('w'); await wait(300);
const p1b = await ev(() => VR.Crafter.player.pos.slice());
const movedRT = Math.hypot(p1b[0] - p1[0], p1b[2] - p1[2]);
check(movedRT > 0.3, 'W through the keyboard moves the player (' + movedRT.toFixed(2) + ' blocks in real time)');
// a test platform above the roof (free space all around), the player on it looking along +x
await ev(() => {
  const C = VR.Crafter, h = C.house, P = C.player, st = VR.R.byName.vollton_stone_grey.defaultState;
  const cx = h.pad + Math.floor(h.lot[0] / 2), cz = h.pad + Math.floor(h.lot[1] / 2), y = (h.roofTop || h.sy - 10) + 3, L = [];
  for (let x = cx - 7; x <= cx + 7; x++) for (let z = cz - 2; z <= cz + 2; z++) L.push([x, y, z, st]);
  C.applyChanges(L);
  P.pos = [cx - 5 + 0.5, y + 1, cz + 0.5]; P.vel = [0, 0, 0]; P.flying = false; P.yaw = -Math.PI / 2; P.pitch = 0; P.step(1 / 60, 30);
  window.__plat = { cx, cz, y };
});
const walk = await ev(() => { const P = VR.Crafter.player; P.keys = { w: true }; const a = P.pos.slice(); P.step(1 / 60, 30); P.keys = {}; P.step(1 / 60, 30); return { moved: Math.hypot(P.pos[0] - a[0], P.pos[2] - a[2]), onGround: P.onGround, y: P.pos[1] }; });
console.log('   walked', walk.moved.toFixed(2), 'blocks in 0.5 s (+ stopping) · on ground', walk.onGround);
check(walk.moved > 1.6 && walk.moved < 2.9 && walk.onGround, 'walking speed like the game (4.3 blocks/s)');
const jump = await ev(() => { const P = VR.Crafter.player, y0 = P.pos[1]; let top = y0; P.keys = { ' ': true }; P.step(1 / 60); P.keys = {}; for (let i = 0; i < 90; i++) { P.step(1 / 60); top = Math.max(top, P.pos[1]); } return { h: top - y0, onGround: P.onGround }; });
console.log('   jump height', jump.h.toFixed(2));
check(jump.h > 1.1 && jump.h < 1.5 && jump.onGround, 'Space jumps over a block and lands');
// double Space: fly, Space rises; F lands again
await page.keyboard.press(' '); await wait(100); await page.keyboard.press(' '); await wait(150);
const fl = await ev(() => { const P = VR.Crafter.player, y0 = P.pos[1], was = P.flying; P.keys = { ' ': true }; P.step(1 / 60, 60); P.keys = {}; P.step(1 / 60, 15); return { was, up: P.pos[1] - y0, flying: P.flying }; });
check(fl.was && fl.up > 3, 'double Space flies, Space rises (' + fl.up.toFixed(1) + ' up)');
await page.keyboard.press('f'); await wait(150);
const landed = await ev(() => { const P = VR.Crafter.player; P.step(1 / 60, 180); return { flying: P.flying, onGround: P.onGround, y: P.pos[1] }; });
check(!landed.flying && landed.onGround, 'F lands the player again');
// build at the crosshair: look at the ground ahead, place, break
const build = await ev(() => {
  const C = VR.Crafter, P = C.player, h = C.house, R = VR.R, nm = (s) => s ? R.types[R.T.type[s]].name : 'air';
  P.locked = true; P.yaw = -Math.PI / 2; P.pitch = -0.6; P.step(0.05); C.hot[C.slot] = 'vollton_cobalt'; P.aim();
  const hv = C.hover; if (!hv) return { none: true };
  const g = C.ghost.slice();
  P.act(2);
  const placed = nm(C.gGet(g[0], g[1], g[2]));
  P.aim(); const hv2 = C.hover;
  P.act(0);
  const broken = nm(C.gGet(hv2.x, hv2.y, hv2.z));
  // straight down: the block would go into the player — refused
  P.pitch = -1.55; P.step(0.05); P.aim(); const g2 = C.ghost ? C.ghost.slice() : null; P.act(2);
  const intoSelf = g2 ? nm(C.gGet(g2[0], g2[1], g2[2])) : 'n/a';
  P.locked = false;
  return { target: [hv.x, hv.y, hv.z, nm(hv.state)], placed, brokeAgain: broken, intoSelf, tip: document.getElementById('craftTip').textContent };
});
console.log('  ', JSON.stringify(build));
check(build.placed === 'vollton_cobalt', 'right click places at the crosshair');
check(build.brokeAgain === 'air', 'left click breaks at the crosshair');
check(build.intoSelf === 'air', 'no block into the player');
// look at the house and take the screenshot from the player's eyes
await ev(() => { const P = VR.Crafter.player, h = VR.Crafter.house; P.spawn(); P.pos[2] -= 0.6; P.pitch = 0.12; P.step(0.05, 4); P.locked = true; document.getElementById('studio').classList.add('pmlocked'); });
await wait(900);
await shot('cr2_player_2');
await ev(() => { VR.Crafter.player.locked = false; });
const hb = await ev(async () => { const n = await VR.Crafter.player.gameHotbar(); return { n, tip: document.getElementById('craftTip').textContent }; });
console.log('   hotbar from the game:', JSON.stringify(hb));
await page.keyboard.press('p'); await wait(500);
const off = await ev(() => ({ on: VR.Crafter.player.on, fly: !!window.__st.cam.fly }));
check(!off.on && !off.fly, 'P returns to the Studio camera');
await wait(1200);
await shot('cr2_player_3_back');

// ---------------------------------------------------------------- 5. Update ins Spiel: the ring edits are part of the design
await ev(() => VR.Crafter.update.house()); await wait(1500);
const saved = await ev(() => { const d = JSON.parse(localStorage.getItem('r9si.studio') || '{}'); const h = d.houses && d.houses[0]; return h ? { v: h.v, n: h.n, box: h.tpl && h.tpl.box, off: h.tpl && h.tpl.off } : null; });
console.log('saved', JSON.stringify(saved));
check(saved && saved.off && saved.off[1] <= -3, 'the design reaches into the ring in front of the lot');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
console.log(fails ? 'FAIL ' + fails : 'OK');
await browser.close();
