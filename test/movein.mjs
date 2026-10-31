// u-movein in the browser (docs/superpowers/plans/2026-11-01-u-movein.md): a new default world (seed 4242, Kreativ,
// Friedlich), 960 × 540, de-DE, Balanced, your name „Mila".
//   1 · far from every village, a small house built through the world API (walls, roof, a door, a bed, a light) — it is
//       noticed; you sleep in its bed; at dawn a family comes up the way with its cart (movein_arrive.png), greets you
//       by your name, unpacks; the first-time Kreativ prompt (Ja) → decor in empty cells only (movein_inside.png)
//   2 · a gift at your door (movein_gift.png), walking onto it takes it
//   3 · two more houses; their families (the second's arrival skipped); you name the settlement; the market; the
//       festival night at dusk (movein_dusk.png)
//   4 · the frame there: Very Low and High, the switch on / off (ms); the record's round trip
//   → test/shots/movein_sheet.jpg, .tmp_tests/movein_run.json
//   nohup bash test/wt_run.sh movein.mjs 3600 > .tmp_tests/movein.log 2>&1 &
// regress: skip  (a showcase with pictures; the gate is test/movein.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '').replace(/\/\.tmp_tests$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html';
const SHOTS = ROOT + '/test/shots/';
const SEED = process.env.SEED || '4242';
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + ' (' + secs() + ')'); };
const run = { seed: SEED };
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/movein_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|movein/i.test(s)) logs.push(`[${t}] ${s.slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto(DIST);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(3); } };
const settle = async (max = 40) => {
  for (let i = 0; i < max; i++) {
    await step(20, 16);
    const s = await ev(() => { const g = VR.game, w = g.world; return { busy: g.pool.busy, pend: w.pending.size, up: w.uploadQ ? w.uploadQ.size : 0 }; });
    if (s.busy === 0 && s.pend === 0 && s.up === 0 && i > 2) break;
    await wait(30);
  }
};
const pics = {};
const grab = async (key, name, frames = 4) => {
  const url = await ev((frames) => { try { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } const u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; } catch (e) { window.__norender = true; return null; } }, frames);
  if (url && url.length > 2000) { fs.writeFileSync(SHOTS + name, Buffer.from(url.split(',')[1], 'base64')); console.log('  📷 ' + name); pics[key] = SHOTS + name; return SHOTS + name; }
  console.log('  !! no picture ' + name); return null;
};
const shotDom = async (key, name) => { try { await ev(() => { window.__norender = false; const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); window.__norender = true; }); await page.screenshot({ path: SHOTS + name, timeout: 120000 }); console.log('  📷 ' + name); pics[key] = SHOTS + name; return SHOTS + name; } catch (e) { console.log('  !! ' + e.message); return null; } };
const stand = (P, look) => ev(([P, L]) => { const p = VR.game.player; p.flying = true; p.teleport(P[0], P[1], P[2]); p.vel = [0, 0, 0]; const e = [P[0], P[1] + 1.6, P[2]], dx = L[0] - e[0], dy = L[1] - e[1], dz = L[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw; }, [P, look]);
const dbg = () => ev(() => VR.MoveIn.debug(VR.game));

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.playerName = 'Mila'; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Einzug',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:false})`);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world');
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(3000); });
await settle(20); await step(60, 33);
// ---------------------------------------------------------------- far from every village
const far = await ev(() => {
  const g = VR.game, V = g.villages, p = g.player.pos;
  for (let r = 220; r <= 520; r += 60) for (let k = 0; k < 12; k++) {
    const an = k / 12 * Math.PI * 2, x = Math.round(p[0] + Math.cos(an) * r), z = Math.round(p[2] + Math.sin(an) * r);
    const ns = V.nearestSite(x, z); if (!ns || ns.dist > 230) return [x, z, ns ? Math.round(ns.dist) : -1];
  }
  return null;
});
check(!!far, 'a spot far from every village: ' + JSON.stringify(far));
await ev((f) => { const p = VR.game.player; p.flying = true; p.teleport(f[0] + 0.5, 140, f[1] + 0.5); }, far);
await settle(60); await step(40, 33); await settle(20);
// the builder (the test API): a 7 × 7 cottage — stone floor, plank walls with windows, a roof, a door south, a bed, a light
const build = (spec) => ev((spec) => {
  const g = VR.game, w = g.world, R = VR.R;
  const st = (n, p) => { const t = R.byName[n]; return t ? (p ? t.state(p) : t.defaultState) : 0; };
  const set = (x, y, z, s) => w.setBlock(x, y, z, s, 0);
  let best = null;
  for (let rr = 0; rr <= 24 && !best; rr += 3) for (let a = 0; a < 12 && !best; a++) {
    const an = a / 12 * Math.PI * 2, cx = Math.round(spec.c[0] + Math.cos(an) * rr), cz = Math.round(spec.c[1] + Math.sin(an) * rr);
    if (!w.isLoaded(cx - 6, cz - 6) || !w.isLoaded(cx + 6, cz + 6)) continue;
    let mn = 999, mx = -1, wet = 0; for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) { const h = w.topAt(cx + dx, cz + dz); mn = Math.min(mn, h); mx = Math.max(mx, h); const b = w.getBlock(cx + dx, h, cz + dz); if (b && (R.T.flags[b] & VR.F.FLUID)) wet++; }
    if (mx - mn <= 3 && !wet) best = [cx, mn + 1, cz];
  }
  if (!best) return { err: 'no flat ground' };
  const [cx, gy, cz] = best, y0 = gy;
  for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 7; dz++) { for (let y = y0; y < y0 + 16; y++) set(cx + dx, y, cz + dz, 0); for (let y = y0 - 4; y < y0; y++) if (!w.getBlock(cx + dx, y, cz + dz) || y === y0 - 1) set(cx + dx, y, cz + dz, st(y === y0 - 1 && (Math.abs(dx) > 3 || Math.abs(dz) > 3) ? 'grass_block' : 'dirt')); }
  const wall = spec.wall || 'oak_planks', roof = spec.roof || 'spruce_planks';
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) { set(cx + dx, y0 - 1, cz + dz, st('stone_bricks')); set(cx + dx, y0 + 4, cz + dz, st(roof)); }
  for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) if (Math.max(Math.abs(dx), Math.abs(dz)) === 4) set(cx + dx, y0 + 4, cz + dz, st(roof));
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) set(cx + dx, y0 + 5, cz + dz, st(roof));
  for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) { if (Math.abs(dx) !== 3 && Math.abs(dz) !== 3) continue; for (let y = y0; y <= y0 + 3; y++) set(cx + dx, y, cz + dz, st(Math.abs(dx) === 3 && Math.abs(dz) === 3 ? 'oak_log' : wall)); }
  // windows east and west
  for (const dx of [-3, 3]) for (const dz of [-1, 1]) set(cx + dx, y0 + 1, cz + dz, st('glass'));
  // the door in the south wall (+z)
  const dt = R.byName.oak_door;
  set(cx, y0, cz + 3, dt.state({ facing: 2, half: 0, open: 0, hinge: 0 })); set(cx, y0 + 1, cz + 3, dt.state({ facing: 2, half: 1, open: 0, hinge: 0 }));
  // a bed along the north wall, the light last (the home is complete with it)
  const bt = R.byName[spec.bed || 'red_bed'];
  set(cx - 2, y0, cz - 1, bt.state({ facing: 0, part: 0 })); set(cx - 2, y0, cz - 2, bt.state({ facing: 0, part: 1 }));
  if (spec.bed2) { set(cx - 1, y0, cz - 1, bt.state({ facing: 0, part: 0 })); set(cx - 1, y0, cz - 2, bt.state({ facing: 0, part: 1 })); }
  set(cx + 2, y0, cz - 2, st('vx_chair'));
  set(cx + 2, y0 + 2, cz + 2, st('torch'));
  return { c: [cx, y0, cz], door: [cx, y0, cz + 3], bed: [cx - 2, y0, cz - 1] };
}, spec);
const H1 = await build({ c: [far[0], far[1]], bed2: true });
check(H1 && !H1.err, 'the first cottage is built: ' + JSON.stringify(H1));
await step(80, 33);
let D = await dbg();
check(D.homes.length === 1 && D.homes[0].st === 'wait', 'it is noticed as a home, waiting for dawn: ' + JSON.stringify(D.homes));
run.d1 = D;
// ---------------------------------------------------------------- sleep to dawn
const day0 = await ev(() => VR.game.env.day || 0);
await ev((b) => { const g = VR.game; g.env.setTime(15000); if (g.sleep) g.sleep(b[0], b[1], b[2]); else { g.env.setTime(0); g.env.day = (g.env.day || 0) + 1; } }, H1.bed);
await wait(3500);
await ev(() => { const g = VR.game; if (g.ui && g.ui.show) g.ui.show(null); });
const t1 = await ev(() => [VR.game.env.day, Math.round(VR.game.env.timeOfDay)]);
check(t1[0] === day0 + 1 && t1[1] < 600, 'slept to dawn: day ' + t1.join(' · tod '));
// stand beside the way up to the door, looking down it
const door = H1.door;
await stand([door[0] + 5.5, door[1] + 1, door[2] + 9.5], [door[0] + 0.5, door[1] + 1, door[2] + 18]);
let arrived = null, greet = null, sawJob = false, shotAt = 0;
for (let i = 0; i < 260; i++) {
  await step(10, 50);
  D = await dbg();
  if (D.job) sawJob = true;
  for (const a of D.agents) if (a[5] && /Mila/.test(a[5])) greet = a[5];
  if (D.job && !pics.arrive) {
    const lead = D.agents.find(a => a[3] === 'arrive');
    if (lead && Math.hypot(lead[4][0] - door[0], lead[4][2] - door[2]) < 13 && i > shotAt) {
      await ev(() => { VR.game.zenFreezeTime = true; });
      await stand([door[0] + 6.5, door[1] + 1.2, door[2] + 4.5], [lead[4][0], lead[4][1] + 1, lead[4][2] + 1.5]);
      await grab('arrive', 'movein_arrive.png', 6);
      await ev(() => { VR.game.zenFreezeTime = false; });
    }
  }
  if (sawJob && !D.job) { arrived = D; break; }
}
check(sawJob, 'at dawn the family comes up the way: ' + JSON.stringify((arrived || D).agents.map(a => a.slice(0, 3))));
check(!!pics.arrive, 'the arrival is pictured');
check(!!greet, 'they greet you by your name: ' + greet);
check(!!arrived && arrived.homes[0].st === 'home' && arrived.agents.length >= 2, 'they moved in (' + (arrived ? arrived.agents.length : 0) + ' people)');
run.arrived = arrived;
// the first-time Kreativ prompt
D = await dbg();
check(D.card && /schmücken/.test(D.card), 'Kreativ: they ask first whether they may decorate: ' + D.card);
const before = await ev((H) => { const w = VR.game.world, out = []; for (let x = H.c[0] - 3; x <= H.c[0] + 3; x++) for (let y = H.c[1] - 1; y <= H.c[1] + 5; y++) for (let z = H.c[2] - 3; z <= H.c[2] + 3; z++) out.push(w.getBlock(x, y, z)); return out; }, H1);
await shotDom('ask', 'movein_ask.png');
await page.click('#mi_card button').catch(() => ev(() => VR.MoveIn.answerDecor(VR.game, true)));
await step(10, 33);
const after = await ev((H) => { const w = VR.game.world, out = []; for (let x = H.c[0] - 3; x <= H.c[0] + 3; x++) for (let y = H.c[1] - 1; y <= H.c[1] + 5; y++) for (let z = H.c[2] - 3; z <= H.c[2] + 3; z++) out.push(w.getBlock(x, y, z)); return out; }, H1);
let changed = 0, overwrote = 0; for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) { changed++; if (before[i] !== 0) overwrote++; }
D = await dbg();
check(D.decor === true && D.homes[0].decor > 0 && changed === D.homes[0].decor, `Ja: they decorate a little (${D.homes[0].decor} pieces, ${changed} cells changed)`);
check(overwrote === 0, 'not one of your blocks was replaced');
// inside
await stand([H1.c[0] + 1.5, H1.c[1] + 0.2, H1.c[2] + 2.2], [H1.c[0] - 1.5, H1.c[1] + 0.6, H1.c[2] - 2.5]);
await ev(() => { const p = VR.game.player; p.flying = false; });
await step(4, 33);
await grab('inside', 'movein_inside.png', 6);
// ---------------------------------------------------------------- a gift at your door
const gift = await ev(() => { const g = VR.game, rec = VR.MoveIn.rec(g); const h = rec.homes[0]; return VR.MoveIn.leaveGift(g.villages, h); });
check(!!gift, 'a gift at your door: ' + JSON.stringify(gift));
if (gift) {
  await stand([gift.at[0] + 1.6, gift.at[1] + 0.4, gift.at[2] + 2.0], [gift.at[0], gift.at[1] + 0.2, gift.at[2]]);
  await step(2, 33);
  await grab('gift', 'movein_gift.png', 6);
  const n0 = await ev((it) => VR.game.player.inv.count(it), gift.item);
  await ev((G) => { const p = VR.game.player; p.teleport(G.at[0], G.at[1], G.at[2]); }, gift);
  await step(20, 33);
  const n1 = await ev((it) => VR.game.player.inv.count(it), gift.item);
  D = await dbg();
  check(n1 > n0 && D.gifts.length === 0, `walking onto it takes it (${gift.item}: ${n0} → ${n1})`);
}
// ---------------------------------------------------------------- two more homes, a name, a market, a festival night
const H2 = await build({ c: [H1.c[0] + 15, H1.c[2] + 2], wall: 'birch_planks', roof: 'dark_oak_planks', bed: 'blue_bed' });
const H3 = await build({ c: [H1.c[0] - 15, H1.c[2] + 3], wall: 'stone_bricks', roof: 'spruce_planks', bed: 'yellow_bed', bed2: true });
await step(80, 33);
D = await dbg();
check(D.homes.length === 3 && D.homes.every(h => h.set === D.homes[0].set), 'two more homes, the same settlement: ' + JSON.stringify(D.homes.map(h => h.st + '@' + h.door)));
const nights = async () => { await ev(() => { const g = VR.game; g.env.setTime(23999); }); await step(4, 33); await ev(() => { const g = VR.game; g.env.setTime(200); }); };
await stand([H1.c[0] + 0.5, H1.c[1] + 2, H1.c[2] + 12], [H1.c[0], H1.c[1] + 1, H1.c[2]]);
for (let k = 0; k < 2; k++) {
  let skipped = false;
  for (let n = 0; n < 4 && !skipped; n++) {
    await nights();
    for (let i = 0; i < 12; i++) { await step(10, 50); D = await dbg(); if (D.job && !skipped) { skipped = await ev(() => VR.MoveIn.skip(VR.game)); } if (skipped) break; }
  }
  await step(10, 33);
  check(skipped, `arrival ${k + 2} started and was skipped (Rücktaste / the button)`);
  D = await dbg();
  if (k === 0) {
    check(D.card && /Namen/.test(D.card), 'the second family: a card asks for the settlement\'s name: ' + D.card);
    await shotDom('name', 'movein_name.png');
    await page.fill('#mi_name', 'Lindenhain').catch(() => {});
    await page.click('#mi_card button').catch(() => ev(() => VR.MoveIn.nameSettlement(VR.game, 'mi:1', 'Lindenhain')));
    await step(4, 33);
    D = await dbg();
    check(D.sets[0].named && D.sets[0].name === 'Lindenhain', 'named: ' + D.sets[0].name);
    if (D.card) await ev(() => VR.MoveIn.card(VR.game, null));
  }
}
D = await dbg();
check(D.homes.filter(h => h.st === 'home').length === 3 && D.sets[0].market && D.sets[0].stall, 'three families: a market stall at ' + JSON.stringify(D.sets[0].stall) + ', the first festival on day ' + D.sets[0].fest);
run.d3 = D;
// greetings by memory: stand next to someone
const greet2 = await ev(() => { const g = VR.game, V = g.villages; const a = V.agents.find(x => x.vil.plan.mine && !x.kid && x.pose !== 'sleep'); if (!a) return null; g.player.teleport(a.pos[0] + 1.5, a.pos[1], a.pos[2]); V._mi.greetT.clear(); a.bubble = null; return a.p.name; });
await step(30, 33);
D = await dbg();
const said = D.agents.map(a => a[5]).filter(Boolean);
check(said.some(s => /Mila/.test(s)), `${greet2} greets you by what they remember: ` + said.join(' | '));
// the festival night at dusk
await ev((d) => { const g = VR.game; g.env.day = d; g.env.setTime(11700); g.zenFreezeTime = false; }, D.sets[0].fest);
for (let i = 0; i < 40; i++) await step(10, 50);
const fest = await ev(() => { const g = VR.game, V = g.villages, vil = V.known.get('mi:1'); return { on: V.festivalOn(vil, g.env.timeOfDay), acts: vil.agents.map(a => a.act && a.act.type) }; });
check(fest.on && fest.acts.includes('festival'), 'the festival night: ' + JSON.stringify(fest));
const pz = await ev(() => { const p = VR.game.villages.known.get('mi:1').plan.plaza; return [p.x, p.y, p.z]; });
await ev(() => { VR.game.zenFreezeTime = true; VR.game.env.setTime(12050); });
await stand([pz[0] + 4, pz[1] + 11, pz[2] + 24], [pz[0], pz[1] + 1, pz[2] - 2]);
await step(6, 33);
await grab('dusk', 'movein_dusk.png', 8);
// ---------------------------------------------------------------- the cost here, the record
const cost = {};
for (const preset of ['potato', 'high']) {
  await ev((pr) => { const g = VR.game; g.applyPreset(pr); g.settings.dynRes = false; g.settings.renderDist = 6; g.applySettings('*'); }, preset);
  await settle(10);
  for (const on of [false, true, false, true, false, true]) {
    const r = await ev(([on]) => { const g = VR.game; g.settings.movein = on; window.__norender = false; for (let i = 0; i < 4; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); const ms = []; for (let i = 0; i < 12; i++) { const t = performance.now(); g.last = t - 33; g.loop(t); g.renderer.gl.finish(); ms.push(performance.now() - t); } window.__norender = true; ms.sort((a, b) => a - b); return +ms[6].toFixed(1); }, [on]);
    (cost[preset + (on ? '_on' : '_off')] || (cost[preset + (on ? '_on' : '_off')] = [])).push(r);
  }
}
await ev(() => { VR.game.settings.movein = true; });
const mn = (a) => Math.min(...a);
run.cost = cost;
console.log('  cost ' + JSON.stringify(cost));
check(mn(cost.potato_on) <= mn(cost.potato_off) * 1.15 + 2, `Very Low: on ${mn(cost.potato_on)} ms, off ${mn(cost.potato_off)} ms (High ${mn(cost.high_on)} / ${mn(cost.high_off)} ms)`);
const rt = await ev(() => { const g = VR.game, a = JSON.stringify(g.meta.movein), b = JSON.stringify(VR.MoveIn.save(VR.MoveIn.load(JSON.parse(a)))); const st = g.meta.villages['mi:1']; return { same: a === b, bytes: a.length, custom: st && st.custom ? st.custom.length : 0 }; });
check(rt.same && rt.custom === 3, `the save record round-trips (${rt.bytes} bytes; ${rt.custom} homes in the village's state)`);
check(!logs.some(l => /pageerror|movein/.test(l)), 'no page error' + (logs.length ? ': ' + logs.slice(0, 4).join(' · ') : ''));
save();
const row = (label, ks) => ({ label, imgs: ks.map(k => pics[k]).filter(Boolean) });
const rows = [row('Bei Sonnenaufgang: Familie kommt mit dem Karren · Drinnen nach dem Einzug', ['arrive', 'inside']), row('Ein Geschenk vor deiner Tür · Kreativ: darf geschmückt werden?', ['gift', 'ask']), row('Die Siedlung bekommt einen Namen · Festabend in der Dämmerung', ['name', 'dusk'])].filter(r => r.imgs.length);
if (rows.length) { fs.writeFileSync(ROOT + '/.tmp_tests/movein_sheet.json', JSON.stringify({ w: 620, rows })); try { console.log('  ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'movein_sheet.jpg', ROOT + '/.tmp_tests/movein_sheet.json']).toString().trim()); } catch (e) { console.log('  sheet: ' + e.message); } }
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
