// v0.33.2 Spieler-Modus: the crosshair and the held block show, the player walks off the property onto the meadow
// (and stops at the garden fence), right click opens doors (both halves, no undo step, the design stays unchanged),
// the player walks through the open door, sliding glass doors open by themselves and close behind you.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--allow-file-access-from-files'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 400)); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
await page.goto('file:///home/claude/vr/dist/studio.html');
const ev = (fn, arg) => page.evaluate(fn, arg), wait = (ms) => page.waitForTimeout(ms);
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
for (let i = 0; i < 240; i++) { await wait(500); const s = await ev(() => ({ boot: document.getElementById('studio').classList.contains('boot'), houses: window.__studio ? window.__studio.HOUSE.size : -1 })); if (!s.boot && s.houses >= 2) break; }
await ev(() => window.__studio.selectHouse(0)); await wait(300);
await ev(() => window.__studioCore.setMode('craft'));
for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => !!(VR.Crafter.house && VR.Crafter.gpu && VR.Crafter.meadow))) break; }
const info = await ev(() => { const h = VR.Crafter.house; return { dims: [h.sx, h.sy, h.sz], F: h.F, lot: h.lot, pad: h.pad, meadow: VR.Crafter.meadow ? VR.Crafter.meadow.gpu.length : 0, inst: (window.__studioCore.S.scene.instances || []).length }; });
console.log('crafter', JSON.stringify(info));
check(info.meadow > 0 && info.inst === 1, 'the meadow is meshed and drawn around the lot (' + info.meadow + ' sections)');

// 1. the crosshair and the held block
await ev(() => VR.Crafter.player.enter()); await wait(400);
const ui = await ev(() => { const c = document.getElementById('pmCross'), h = document.getElementById('pmHand'); const cs = getComputedStyle(c), hs = getComputedStyle(h); return { cross: cs.display, op: cs.opacity, hand: hs.display, w: c.getBoundingClientRect().width, playing: document.getElementById('studio').classList.contains('playing'), noLock: VR.Crafter.player.noLock, fov: window.__studioCore.S.cam.fly && window.__studioCore.S.cam.fly.fov }; });
console.log('  ui', JSON.stringify(ui));
check(ui.playing && ui.cross === 'block' && ui.w >= 20 && +ui.op > 0.3, 'crosshair visible in the player view');
check(ui.hand === 'block', 'the held block shows');
check(ui.fov > 1.2 && ui.fov < 1.3, 'the game\'s field of view (72°)');

// 2. walking off the property: out over the front edge, onto the meadow, up to the fence
const walk = await ev(() => {
  const C = VR.Crafter, PM = C.player, h = C.house;
  PM.flying = false; PM.pos = [h.pad + 1.5, h.F + 0.01, 1.5]; PM.vel = [0, 0, 0]; PM.yaw = 0; PM.pitch = 0;   // yaw 0 looks toward −z (out of the grid)
  PM.keys = { w: true }; PM.step(1 / 60, 120);
  const a = PM.pos.slice();
  PM.step(1 / 60, 900);
  const b = PM.pos.slice();
  PM.keys = {};
  return { a, b, F: h.F, M: C.MEADOW };
});
console.log('  walk', JSON.stringify(walk));
check(walk.a[2] < -2 && Math.abs(walk.a[1] - walk.F) < 0.05, 'walked off the property onto the meadow at ground level (z ' + walk.a[2].toFixed(1) + ')');
check(walk.b[2] > -walk.M - 0.1 && walk.b[2] < -walk.M + 2.2 && Math.abs(walk.b[1] - walk.F) < 0.05, 'stopped by the garden fence at the meadow\'s end (z ' + walk.b[2].toFixed(1) + ')');

// 3. a door: right click opens both halves, no undo step, the design stays unchanged; the player walks through
const door = await ev(() => {
  const C = VR.Crafter, PM = C.player, h = C.house, R = VR.R, T = R.T, idx = (x, y, z) => (y * h.sz + z) * h.sx + x;
  let d = null;
  for (let i = 0; i < h.blocks.length && !d; i++) { const s = h.blocks[i]; if (!s) continue; const t = R.types[T.type[s]]; if (t.o.kind === 'door' && !t.get(s, 'half') && !t.get(s, 'open') && !t.o.ironDoor) { const x = i % h.sx, z = Math.floor(i / h.sx) % h.sz, y = Math.floor(i / (h.sx * h.sz)); if (y <= h.F + 1) d = { x, y, z, s, name: t.name, facing: t.get(s, 'facing') }; } }
  if (!d) return { none: true };
  const undo0 = C.undo.length, dirty0 = h.dirty;
  const used = C.useAt({ x: d.x, y: d.y, z: d.z, face: 2, state: d.s });
  const lo = h.blocks[idx(d.x, d.y, d.z)], hi = h.blocks[idx(d.x, d.y + 1, d.z)], t = R.types[T.type[lo]];
  const tpl = VR.Custom.makeTemplate({ sx: h.sx, sy: h.sy, sz: h.sz, pad: h.pad, F: h.F, lot: h.lot, blocks: h.blocks, base: h.base, wrote: h.wrote });
  return { d, used, openLo: t.get(lo, 'open'), openHi: R.types[T.type[hi]].get(hi, 'open'), undo: C.undo.length - undo0, dirty: h.dirty !== dirty0 ? 'changed' : 'same', changed: tpl ? tpl.changed : 0 };
});
console.log('  door', JSON.stringify(door));
if (door.none) check(false, 'a door found in the house');
else {
  check(door.used && door.openLo === 1 && door.openHi === 1, 'right click opened both halves of ' + door.d.name);
  check(door.undo === 0 && door.dirty === 'same' && door.changed === 0, 'opening a door is not a design change (no undo step, nothing to save)');
  // the open door lets you through: a player-wide box swept straight through the doorway (along the door's facing)
  // hits the closed door's panel and not the open one
  const pass = await ev((d) => {
    const C = VR.Crafter, h = C.house, R = VR.R, T = R.T, PH = VR.PHYS, idx = (x, y, z) => (y * h.sz + z) * h.sx + x;
    const s = h.blocks[idx(d.x, d.y, d.z)], t = R.types[T.type[s]], f = t.get(s, 'facing');
    const alongZ = f === 0 || f === 2;   // facing north / south: you walk along z through it
    const blocks = (st) => PH.collision(st, null).some(b => alongZ ? (b[3] > 0.2 && b[0] < 0.8) : (b[5] > 0.2 && b[2] < 0.8));
    return { open: blocks(t.with(s, 'open', 1)), closed: blocks(t.with(s, 'open', 0)), facing: f };
  }, door.d);
  console.log('  pass', JSON.stringify(pass));
  check(!pass.open && pass.closed, 'an open door lets the player through, a closed one does not');
  // close it again
  const closed = await ev((d) => { const C = VR.Crafter, h = C.house, R = VR.R; C.useAt({ x: d.x, y: d.y + 1, z: d.z, face: 2 }); const s = h.blocks[(d.y * h.sz + d.z) * h.sx + d.x]; return R.types[R.T.type[s]].get(s, 'open'); }, door.d);
  check(closed === 0, 'right click on the upper half closes the door again');
}

// 3b. into the house through the front: from the street side, walk (and jump) toward the entry until inside the house
const enter = await ev(() => {
  const C = VR.Crafter, PM = C.player, h = C.house, R = VR.R, T = R.T, idx = (x, y, z) => (y * h.sz + z) * h.sx + x;
  const [hx, hz, hw, hd] = h.rect;
  const inside = (p) => p[0] > hx + 1 && p[0] < hx + hw - 1 && p[2] > hz + 1 && p[2] < hz + hd - 1;
  // entry candidates: door cells (any kind) in the outer wall at the lowest floor
  const tries = [];
  for (let i = 0; i < h.blocks.length; i++) {
    const s = h.blocks[i]; if (!s) continue; const t = R.types[T.type[s]];
    if (!(t.o.kind === 'door' || (t.o.vx && /door/.test(t.o.vx.kind || '')))) continue;
    const x = i % h.sx, z = Math.floor(i / h.sx) % h.sz, y = Math.floor(i / (h.sx * h.sz));
    if (y > h.F + 2 || (t.has('half') && t.get(s, 'half'))) continue;
    for (const [dx, dz] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      // outward: two cells out is outside the house rectangle
      const ox = x + dx * 3, oz = z + dz * 3;
      if (ox > hx && ox < hx + hw && oz > hz && oz < hz + hd) continue;
      tries.push({ x, y, z, dx, dz, name: t.name });
    }
  }
  const res = [];
  for (const tr of tries.slice(0, 12)) {
    // stand 4 blocks out on whatever is there, face the door
    PM.flying = false; PM.vel = [0, 0, 0];
    let px = tr.x + 0.5 + tr.dx * 4, pz = tr.z + 0.5 + tr.dz * 4, py = h.F;
    for (let yy = h.F + 6; yy >= 0; yy--) { const s = PM.getState(Math.floor(px), yy, Math.floor(pz)); if (s && (T.flags[s] & VR.F.SOLID)) { py = yy + 1; break; } }
    PM.pos = [px, py + 0.01, pz];
    if (!PM.fitsAt(PM.pos)) continue;
    PM.yaw = Math.atan2(tr.dx, tr.dz);
    // walk in, jumping now and then (steps), opening what is in the way like a player would (right click)
    for (let k = 0; k < 8; k++) {
      PM.keys = { w: true, ' ': k % 2 === 1 }; PM.step(1 / 60, 30);
      const fx = Math.floor(PM.pos[0] - tr.dx * 0.8), fz = Math.floor(PM.pos[2] - tr.dz * 0.8);
      for (const yy of [Math.floor(PM.pos[1]), Math.floor(PM.pos[1]) + 1]) { const s = C.gGet(fx, yy, fz); const t = s && R.types[T.type[s]]; if (t && C.OPENABLE(t) && !t.get(s, 'open')) C.useAt({ x: fx, y: yy, z: fz }); }
    }
    PM.keys = {}; PM.step(1 / 60, 30);
    res.push({ door: tr.name, at: [tr.x, tr.y, tr.z], pos: PM.pos.map(v => +v.toFixed(1)), inside: inside(PM.pos) });
    if (inside(PM.pos)) return { ok: true, res };
  }
  return { ok: false, res };
});
console.log('  enter', JSON.stringify(enter).slice(0, 900));
check(enter.ok, 'walked into the house through its entry from outside');

// 3c. sit on a sofa or chair (right click), Shift stands up next to it
const sit = await ev(() => {
  const C = VR.Crafter, PM = C.player, h = C.house, R = VR.R, T = R.T;
  let seat = null;
  for (let i = 0; i < h.blocks.length && !seat; i++) { const s = h.blocks[i]; if (!s) continue; const t = R.types[T.type[s]]; if (t.o.seat || t.o.kind === 'seat') { const x = i % h.sx, z = Math.floor(i / h.sx) % h.sz, y = Math.floor(i / (h.sx * h.sz)); seat = { x, y, z, name: t.name }; } }
  if (!seat) return { none: true };
  const ok = PM.sitAt({ x: seat.x, y: seat.y, z: seat.z, face: 2 });
  PM.keys = {}; PM.step(1 / 60, 60);
  const seated = { pos: PM.pos.map(v => +v.toFixed(2)), eye: +PM.eye.toFixed(2), on: !!PM.seat };
  PM.keys = { shift: true }; PM.step(1 / 60, 2); PM.keys = {}; PM.step(1 / 60, 30);
  return { seat, ok, seated, stood: !PM.seat, fits: PM.fitsAt(PM.pos), pos: PM.pos.map(v => +v.toFixed(2)) };
});
console.log('  sit', JSON.stringify(sit));
check(!sit.none && sit.ok && sit.seated.on && Math.abs(sit.seated.pos[1] - (sit.seat.y + 0.4)) < 0.01 && Math.abs(sit.seated.eye - 1.05) < 0.05, 'right click sits you down on ' + (sit.seat ? sit.seat.name : '—'));
check(sit.stood && sit.fits, 'Shift stands you up next to it');

// 4. sliding glass doors open by themselves
const slide = await ev(() => {
  const C = VR.Crafter, PM = C.player, h = C.house, R = VR.R, T = R.T, idx = (x, y, z) => (y * h.sz + z) * h.sx + x;
  const t = R.byName.vx_glass_door_black; if (!t) return { none: true };
  // two panels side by side, two high, in the ring in front of the lot
  const z = h.pad - 2, x0 = h.pad + 3, y = h.F;
  const st = t.with(t.defaultState, 'open', 0);
  for (const dx of [0, 1]) for (const dy of [0, 1]) { const i = idx(x0 + dx, y + dy, z); h.blocks[i] = st; }
  const get = () => [0, 1].map(dx => [0, 1].map(dy => t.get(h.blocks[idx(x0 + dx, y + dy, z)], 'open')).join('')).join('|');
  const before = get();
  PM.flying = false; PM.pos = [x0 + 1, y + 0.01, z + 1.6]; PM.autoDoors(0.016);
  const near = get();
  PM.pos = [x0 + 1, y + 0.01, z + 6]; for (let k = 0; k < 20; k++) PM.autoDoors(0.05);
  const after = get();
  return { before, near, after };
});
console.log('  slide', JSON.stringify(slide));
check(!slide.none && slide.before === '00|00' && slide.near === '11|11' && slide.after === '00|00', 'the sliding glass door opens as you come and closes behind you');

await page.screenshot({ path: '/home/claude/vr/test/shots/player2.png' });
await ev(() => VR.Crafter.player.exit());
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 8)) console.log(l);
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);
