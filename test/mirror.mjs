// 🪞 Spiegel-Bauen in the browser, German UI (de-DE): a creative world → ⇧M (M alone stays the Weltkarte) three times →
// 4-fach, the HUD chip says „🪞 4-fach" → the hand (the game's own right click) places an oak stair and an oak door →
// four of each with mirrored facings and hinges, both door halves; the hand breaks one stair → its copies go too; the
// pause menu's 🪞 button switches to 8-fach; the axis is drawn (the renderer's draw count, and the line's pixels on the
// ground with and without it); ⇧M → aus → one stair stays one. Then a symmetric little house: a quarter placed by the
// hand's code path in 4-fach (/spiegel 4 puts the mirror on the spot looked at), a ring of lanterns in 8-fach —
// test/shots/mirror_1.png (the front, the axis glowing), mirror_2.png (from above: the axis lines, the four corners),
// mirror_3.png (the back: the door and windows the mirror made, the 8-fach ring). No page errors.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) logs.push('[console] ' + m.text().slice(0, 500)); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const wait = (ms) => page.waitForTimeout(ms), ev = (fn, a) => page.evaluate(fn, a);
await page.goto('file:///home/claude/vr/dist/index.html');
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
check(await ev(() => !!(VR.I18N && VR.I18N.lang === 'de')), 'the game speaks German (a de-DE browser)');
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.tsr = false; g.settings.renderDist = 5; g.settings.horizon = 0; g.applySettings('*'); g.createWorld({ name: 'Spiegel', mode: 'creative', difficulty: 'peaceful', type: 'flat', seed: '7070', cheats: true, kit: false }); });
for (let i = 0; i < 150; i++) { await wait(1000); if (await ev(() => VR.game.state === 'play')) break; }
check(await ev(() => VR.game.state === 'play'), 'a creative world is open');

// frames by hand (no animation-frame loop, drawn only for the pixel check and the photos), a fixed sunny morning
await ev(() => {
  const g = VR.game, r = g.renderer;
  window.requestAnimationFrame = () => 0;
  r._render = r.render; r.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); };
  window.__norender = true;
  g.env.setTime(4600); g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.rain = 0; g.env.rainTarget = 0;
  const T = window.__t = {
    frame() { g.input.dragLook = false; g.last = performance.now() - 33; g.loop(performance.now()); },
    steps(n) { for (let i = 0; i < n; i++) T.frame(); },
    look(pt) { const p = g.player, e = p.eyePos(), d = [pt[0] - e[0], pt[1] - e[1], pt[2] - e[2]]; p.yaw = Math.atan2(-d[0], -d[2]); p.pitch = Math.atan2(d[1], Math.hypot(d[0], d[2])); },
    stand(x, y, z) { const p = g.player; p.noclip = false; p.flying = true; p.pos = [x, y, z]; p.vel = [0, 0, 0]; },
    hold(id) { const p = g.player; p.inv.slots[p.inv.sel] = { id, n: 64 }; p.inv.changed = true; },
    // the game's own click: the mouse button down for one frame, then up
    click(b) { const i = g.input; i.mouse.down[b] = true; i.mouse.clicked[b] = true; T.frame(); i.mouse.down[b] = false; i.mouse.releasedBtn[b] = true; T.frame(); },
    at(x, y, z) { const s = g.world.getBlock(x, y, z), t = VR.R.types[VR.R.T.type[s]]; if (!t) return null; const o = { name: t.name }; for (const q of t.props) o[q.name] = t.getV(s, q.name); return o; },
    count(id, x0, y0, z0, x1, y1, z1) { const w = g.world, tid = VR.R.byName[id].id; let n = 0; for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (VR.R.T.type[w.getBlock(x, y, z)] === tid) n++; return n; },
    clear(x0, y0, z0, x1, y1, z1) { const w = g.world; for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) w.setBlock(x, y, z, 0, 4); },
    // one real frame, the colour around a world point (3×3 mean), and how many guide vertices were drawn
    pixel(pt) {
      window.__norender = false; T.frame(); window.__norender = true;
      const r = g.renderer, gl = r.gl, c = r.cam, m = r.viewProj, x = pt[0] - c.x, y = pt[1] - c.y, z = pt[2] - c.z;
      const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
      const sx = Math.round((cx / cw * 0.5 + 0.5) * gl.drawingBufferWidth), sy = Math.round((cy / cw * 0.5 + 0.5) * gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const buf = new Uint8Array(36); gl.readPixels(sx - 1, sy - 1, 3, 3, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      const mean = [0, 0, 0]; for (let i = 0; i < 9; i++) for (let k = 0; k < 3; k++) mean[k] += buf[i * 4 + k] / 9;
      return { rgb: mean.map(Math.round), at: [sx, sy], drawn: r.stats.guide };
    },
    chip() { const e = document.getElementById('mirrorchip'); return e ? { text: e.textContent, shown: getComputedStyle(e).display !== 'none', on: e.classList.contains('on') } : null; },
    hint() { const h = document.getElementById('hint'); return h && h.style.display !== 'none' ? h.textContent : ''; },
  };
});
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await ev(() => __t.steps(8)); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size }; }); if (s.busy === 0 && s.pend === 0 && i > 2) break; await wait(150); } };
await settle(80);
// the ground: the first air above the floor under the player
const base = await ev(() => { const g = VR.game, w = g.world, p = g.player, X = Math.floor(p.pos[0]), Z = Math.floor(p.pos[2]); let y = 200; while (y > 1 && !(VR.R.T.flags[w.getBlock(X, y - 1, Z)] & VR.F.SOLID)) y--; return { X, Y: y, Z }; });
const { X, Y, Z } = base;
console.log('ground', JSON.stringify(base));
const shift = async (n) => { for (let k = 0; k < n; k++) { await page.keyboard.down('Shift'); await page.keyboard.press('KeyM'); await ev(() => __t.frame()); await page.keyboard.up('Shift'); await ev(() => __t.frame()); } };

console.log('1 · ⇧M switches the mirror on where you look, and on through the modes');
check((await ev(() => __t.chip())) && (await ev(() => __t.chip())).shown && /Spiegeln/.test((await ev(() => __t.chip())).text), 'Kreativ: the HUD chip „🪞 Spiegeln" is there (' + JSON.stringify(await ev(() => __t.chip())) + ')');
await ev(({ X, Y, Z }) => { __t.stand(X + 0.5, Y, Z + 3.5); __t.look([X + 0.5, Y, Z + 0.5]); __t.frame(); }, base);
await shift(1);
let st = await ev(() => { const m = VR.game.mirror; return { mode: m.mode, c2x: m.c2x, c2z: m.c2z, gy: m.gy, map: VR.game.ui.screen }; });
check(st.mode === 'x' && st.c2x === 2 * X + 1 && st.c2z === 2 * Z + 1 && st.gy === Y && st.map !== 'mapscreen', '⇧M: X, through the block looked at (' + JSON.stringify(st) + '), no map');
await shift(2);
const chip4 = await ev(() => __t.chip()), hint4 = await ev(() => __t.hint());
check((await ev(() => VR.game.mirror.mode)) === 'xz' && chip4.text === '🪞 4-fach' && chip4.on, '⇧M twice more: 4-fach, the chip says „' + chip4.text + '"');
check(/Spiegel 4-fach/.test(hint4), 'the hint says it in German („' + hint4 + '")');

console.log('2 · a stair and a door with the hand: four of each, mirrored');
await ev(({ X, Y, Z }) => { __t.stand(X + 3.5, Y, Z + 0.5); __t.hold('oak_stairs'); __t.look([X + 3.5, Y, Z - 1.5]); __t.frame(); __t.click(2); }, base);
const stairs = await ev(({ X, Y, Z }) => [[X + 3, Z - 2], [X - 3, Z - 2], [X + 3, Z + 2], [X - 3, Z + 2]].map(([x, z]) => __t.at(x, Y, z)), base);
check(stairs.every(s => s && s.name === 'oak_stairs'), 'four oak stairs: the one placed and its copies in X, Z and the half turn');
check(stairs.map(s => s && s.facing).join(' ') === 'north north south south' && stairs.every(s => s && s.half === 'bottom'), 'facings north (placed), north (X), south (Z), south (half turn) — ' + stairs.map(s => s && s.facing).join(' '));
await ev(({ X, Y, Z }) => { __t.stand(X + 2.5, Y, Z - 2.5); __t.hold('oak_door'); __t.look([X + 2.5, Y, Z - 4.5]); __t.frame(); __t.click(2); }, base);
const doors = await ev(({ X, Y, Z }) => [[X + 2, Z - 5], [X - 2, Z - 5], [X + 2, Z + 5], [X - 2, Z + 5]].map(([x, z]) => [__t.at(x, Y, z), __t.at(x, Y + 1, z)]), base);
check(doors.every(([a, b]) => a && b && a.name === 'oak_door' && b.name === 'oak_door' && a.half === 'bottom' && b.half === 'top'), 'four oak doors, each with both halves');
check(doors.map(([a]) => a && a.facing + '/' + a.hinge).join(' ') === 'north/left north/right south/right south/left', 'facing/hinge: north/left (placed), north/right (X), south/right (Z), south/left (half turn) — ' + doors.map(([a]) => a && a.facing + '/' + a.hinge).join(' '));

console.log('3 · the hand breaks one stair: its copies go too');
await ev(({ X, Y, Z }) => { __t.stand(X - 1.5, Y, Z + 0.5); __t.look([X - 2.5, Y + 0.3, Z + 2.5]); __t.frame(); }, base);
const tgt = await ev(() => { const t = VR.game.player.target; return t && [t.x, t.y, t.z]; });
check(!!tgt && tgt[0] === X - 3 && tgt[1] === Y && tgt[2] === Z + 2, 'aimed at the stair copy at ' + (X - 3) + ' ' + Y + ' ' + (Z + 2) + ' (' + JSON.stringify(tgt) + ')');
await ev(() => __t.click(0));
check((await ev(({ X, Y, Z }) => __t.count('oak_stairs', X - 6, Y, Z - 6, X + 6, Y + 2, Z + 6), base)) === 0, 'all four stairs are gone');
check((await ev(({ X, Y, Z }) => __t.count('oak_door', X - 6, Y, Z - 6, X + 6, Y + 2, Z + 6), base)) === 8, 'the doors stay (8 halves)');

console.log('4 · the pause menu: 🪞 Spiegel: 4-fach → 8-fach');
await ev(() => VR.game.ui.pause());
const pb = await ev(() => { const b = document.querySelector('#zenpanel [data-act="mirror"]'); return b ? b.textContent : null; });
check(pb === '🪞 Spiegel: 4-fach', 'the creative tools show „' + pb + '"');
await page.click('#zenpanel [data-act="mirror"]');
const pb2 = await ev(() => { const b = document.querySelector('#zenpanel [data-act="mirror"]'); return b ? b.textContent : null; });
check((await ev(() => VR.game.mirror.mode)) === 'r8' && pb2 === '🪞 Spiegel: 8-fach', 'a click: 8-fach („' + pb2 + '")');
await ev(() => { VR.game.ui.resume(); __t.frame(); });

console.log('5 · the axis is drawn: a glowing line on the ground');
const pt = await ev(({ X, Y, Z }) => { const G = VR.game.mirror.G; __t.stand(X + 0.5, Y + 3, Z + 10.5); __t.look([X + 0.5, Y, Z + 4.5]); __t.frame(); return [G.ox, G.oy + 0.04, G.oz + 4]; }, base);
const on = await ev((p) => __t.pixel(p), pt);
const off = await ev((p) => { const m = VR.game.mirror, gd = m.guide; m.guide = () => null; const r = __t.pixel(p); m.guide = gd; return r; }, pt);
console.log('  line pixel with the guide', JSON.stringify(on), 'without', JSON.stringify(off));
check(on.drawn === 72 && off.drawn === 0, '8-fach: 72 guide vertices drawn (4 lines × halo, core, plane), none without');
check(on.rgb[1] + on.rgb[2] - off.rgb[1] - off.rgb[2] > 80 && on.rgb[2] > on.rgb[0], 'the line on the ground glows cyan (' + on.rgb.join(',') + ' over ' + off.rgb.join(',') + ')');

console.log('6 · ⇧M → aus: one stair stays one');
await shift(1);
check((await ev(() => VR.game.mirror.mode)) === null && (await ev(() => __t.chip())).text === '🪞 Spiegeln', 'aus, the chip says „🪞 Spiegeln" again');
await ev(({ X, Y, Z }) => { __t.stand(X + 3.5, Y, Z + 0.5); __t.hold('oak_stairs'); __t.look([X + 3.5, Y, Z - 1.5]); __t.frame(); __t.click(2); }, base);
check((await ev(({ X, Y, Z }) => __t.count('oak_stairs', X - 6, Y, Z - 6, X + 6, Y + 2, Z + 6), base)) === 1, 'one stair placed, no copies');
check((await ev(() => __t.pixel([0, 0, 0]).drawn)) === 0, 'and no axis drawn');

console.log('7 · a symmetric little house: a quarter by hand in 4-fach, a lantern ring in 8-fach');
await ev(({ X, Y, Z }) => __t.clear(X - 12, Y, Z - 12, X + 12, Y + 8, Z + 12), base);
// /spiegel 4: the mirror on the block looked at (the command re-centres)
await ev(({ X, Y, Z }) => { __t.stand(X + 0.5, Y + 1, Z + 7.5); __t.look([X + 0.5, Y, Z + 0.5]); __t.frame(); VR.game.chat('/spiegel 4'); __t.frame(); }, base);
st = await ev(() => { const m = VR.game.mirror; return { mode: m.mode, c2x: m.c2x, c2z: m.c2z }; });
check(st.mode === 'xz' && st.c2x === 2 * X + 1 && st.c2z === 2 * Z + 1, '/spiegel 4: 4-fach through the block looked at (' + JSON.stringify(st) + ')');
const built = await ev(({ X, Y, Z }) => {
  const g = VR.game, p = g.player, w = g.world, R = VR.R;
  p.noclip = true; p.flying = true; p.pos = [X + 0.5, Y + 14, Z + 14.5];
  let n = 0;
  // the hand's own placement (player.placeFromHit) into a free cell: face 2 = on the top of what is below
  const put = (id, x, y, z, yaw, face) => { p.inv.slots[p.inv.sel] = { id, n: 64 }; p.yaw = yaw || 0; p.pitch = -0.3; const f = face === undefined ? 2 : face; if (p.placeFromHit(R.byName[id], { x, y, z, face: f, state: w.getBlock(x, y, z), px: x + 0.5, py: y + 0.5, pz: z + 0.5 })) n++; };
  // the quarter x X..X+4, z Z..Z+3: a stone base, plank walls, log corners, windows, the door in the middle of the front
  for (let y = Y; y <= Y + 2; y++) put('oak_log', X + 4, y, Z + 3);
  for (let x = X; x <= X + 3; x++) for (let y = Y; y <= Y + 2; y++) { if (x === X && y < Y + 2) continue; put(y === Y ? 'stone_bricks' : (x === X + 2 && y === Y + 1) ? 'glass_pane' : 'oak_planks', x, y, Z + 3); }
  for (let z = Z; z <= Z + 2; z++) for (let y = Y; y <= Y + 2; y++) put(y === Y ? 'stone_bricks' : (z !== Z + 2 && y === Y + 1) ? 'glass_pane' : 'oak_planks', X + 4, y, z);
  put('oak_door', X, Y, Z + 3, 0);
  put('torch', X + 1, Y + 1, Z + 4, 0, 4);
  // the roof: spruce stairs rising to the ridge (facing north on this side), the gable, the ridge
  for (let k = 0; k <= 3; k++) for (let x = X; x <= X + 5; x++) put('spruce_stairs', x, Y + 3 + k, Z + 4 - k, 0);
  for (let k = 0; k <= 2; k++) for (let z = Z; z <= Z + 3 - k; z++) put('spruce_planks', X + 4, Y + 3 + k, z);
  for (let x = X; x <= X + 5; x++) put('spruce_planks', x, Y + 6, Z);
  // the garden: fence posts with lanterns at the corners, flowers by the door
  put('oak_fence', X + 6, Y, Z + 5); put('lantern', X + 6, Y + 1, Z + 5);
  put('poppy', X + 2, Y, Z + 5); put('dandelion', X + 3, Y, Z + 5);
  return n;
}, base);
const house = await ev(({ X, Y, Z }) => ({
  logs: __t.count('oak_log', X - 5, Y, Z - 5, X + 5, Y + 3, Z + 5), doors: __t.count('oak_door', X - 5, Y, Z - 5, X + 5, Y + 3, Z + 5), panes: __t.count('glass_pane', X - 5, Y, Z - 5, X + 5, Y + 3, Z + 5),
  stairs: __t.count('spruce_stairs', X - 6, Y, Z - 6, X + 6, Y + 8, Z + 6), lanterns: __t.count('lantern', X - 7, Y, Z - 7, X + 7, Y + 2, Z + 7), torches: __t.count('torch', X - 5, Y, Z - 5, X + 5, Y + 3, Z + 5),
  front: __t.at(X, Y, Z + 3), back: __t.at(X, Y, Z - 3), torchN: __t.at(X - 1, Y + 1, Z - 4), roofN: __t.at(X + 2, Y + 3, Z - 4),
}), base);
console.log('  placed by hand', built, '·', JSON.stringify(house));
check(house.logs === 12 && house.doors === 4 && house.panes === 10, 'four log corners (12 logs), a front and a back door (4 halves; the door on the X axis has no X copy), 10 window panes (the side window on the Z axis twice) — ' + [house.logs, house.doors, house.panes].join(' '));
check(house.stairs === 88 && house.lanterns === 4 && house.torches === 4, 'a whole roof (8 rows × 11 = 88 stairs: ' + house.stairs + '), four lanterns (' + house.lanterns + '), four torches (' + house.torches + ')');
check(house.front && house.back && house.front.facing === 'north' && house.back.facing === 'south' && house.roofN && house.roofN.facing === 'south' && house.torchN && house.torchN.face === 1, 'the back door, the back roof and the back torch face the other way (' + [house.front && house.front.facing, house.back && house.back.facing, house.roofN && house.roofN.facing, house.torchN && house.torchN.face].join(' ') + ')');
await settle(80);
const shot = async (name, pos, look) => {
  await ev(([pos, look]) => { const g = VR.game, p = g.player; p.noclip = true; p.flying = true; p.pos = pos.slice(); p.vel = [0, 0, 0]; __t.look(look); __t.steps(3); }, [pos, look]);
  await settle(40);
  await ev(() => { window.__norender = false; __t.steps(2); VR.game.renderer.gl.finish(); window.__norender = true; });
  await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 });
  console.log('  shot', name);
};
await shot('mirror_1', [X - 6.5, Y + 3.2, Z + 13.5], [X + 0.5, Y + 2, Z + 0.5]);
await shot('mirror_2', [X + 0.5, Y + 22, Z + 13.5], [X + 0.5, Y, Z + 0.5]);
// 8-fach: a ring of lanterns on posts around the house
await ev(({ X, Y, Z }) => {
  const g = VR.game, p = g.player, w = g.world, R = VR.R;
  g.mirror.set('r8');
  const put = (id, x, y, z) => { p.inv.slots[p.inv.sel] = { id, n: 64 }; p.placeFromHit(R.byName[id], { x, y, z, face: 2, state: w.getBlock(x, y, z), px: x + 0.5, py: y + 0.5, pz: z + 0.5 }); };
  put('oak_fence', X + 9, Y, Z + 4); put('lantern', X + 9, Y + 1, Z + 4);
  put('rose_bush', X + 8, Y, Z + 7);
}, base);
const ring = await ev(({ X, Y, Z }) => __t.count('lantern', X - 10, Y, Z - 10, X + 10, Y + 2, Z + 10), base);
check(ring === 4 + 8, '8-fach: one lantern post becomes eight around the house (' + ring + ' lanterns in all)');
await shot('mirror_3', [X + 11.5, Y + 9, Z - 12.5], [X + 0.5, Y + 1, Z + 0.5]);

console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
check(!logs.some(l => /pageerror\]/.test(l)), 'no page errors');
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
