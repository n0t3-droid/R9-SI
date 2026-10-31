// a-fairy in the browser (docs/superpowers/plans/2026-10-31-a-fairy.md): a new default world (seed 4242, creative,
// Friedlich), 960 × 540, de-DE, Balanced.
//   1 · the five places of Herzwelt, each at its best hour → fairy_tree.png (golden day), fairy_shroom.png (dusk),
//       fairy_spring.png, fairy_circle.png (a clear night, the spirits' dance), fairy_garden.png (sunrise, the bridge)
//   2 · the adventures played start to end: the lanterns (talk, three lanterns found, back to Tüpfel — the bubble:
//       fairy_talk.png), the hat (three catches), the bridge (the melody, the ride up → fairy_ontop.png), the riddles,
//       Flöckchen home (escort); the rewards (pages, the building set, the companion light, the gift)
//   3 · the frame at the wood at dusk: Very Low and High, the places on / off (ms)
//   → test/shots/fairy_sheet.jpg, .tmp_tests/fairy_run.json
//   nohup bash test/wt_run.sh fairy.mjs 3600 > .tmp_tests/fairy.log 2>&1 &
//   ONLY=places,adv,cost · SEED=4242
// regress: skip  (a showcase with pictures; the gate is test/fairy.js)
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
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/fairy_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
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
  await ev(start);
  for (let i = 0; i < 600; i++) { await step(10, 33); const s = await ev(() => ({ st: VR.game.state, dim: VR.game.dim, busy: VR.Travel.busy(VR.game) })); if (s.dim === to && s.st === 'play' && !s.busy) return true; await wait(20); }
  return false;
}
// look at a point from where the player stands (the eye's yaw / pitch)
const lookAt = (P) => ev((P) => { const p = VR.game.player, e = p.eyePos(), dx = P[0] - e[0], dy = P[1] - e[1], dz = P[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw; }, P);
const sheet = [];

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Maerchen',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world');
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(6000); });
await settle(30);
await step(30, 33);
const sites0 = await ev(() => VR.Fairy && VR.Fairy.debug ? VR.Fairy.debug.sites() : null);
check(sites0 && sites0.length === 5, 'Herzwelt has five places: ' + (sites0 || []).map(s => s.kind + ' @' + s.x + ',' + s.z).join(' · '));
run.sites0 = sites0;
// go near a place and wait until it settled (its ground read, its parts built)
async function goTo(kind) {
  const s0 = (await ev(() => VR.Fairy.debug.sites())).find(s => s.kind === kind); if (!s0) return null;
  for (let i = 0; i < 40; i++) {
    const s = (await ev(() => VR.Fairy.debug.sites())).find(x => x.kind === kind);
    if (s && s.y !== null && await ev(() => VR.Fairy.debug.near()) === s.id) return s;
    await ev((s) => { const p = VR.game.player; p.flying = true; p.teleport(s.x + 0.5, 150, s.z + 0.5); }, s);   // (the spot may move while it settles: off a town, a road, the water)
    await settle(6); await step(20, 33);
  }
  return (await ev(() => VR.Fairy.debug.sites())).find(x => x.kind === kind);
}
const view = async (s, d, up, lookY, side) => {
  const a = s.yaw + (side || 0), e = [s.x + Math.cos(a) * d, 0, s.z + Math.sin(a) * d];
  e[1] = (await ev((e) => VR.game.world.topAt(Math.floor(e[0]), Math.floor(e[2])), e)) + 1 + up;
  await ev((e) => { const p = VR.game.player; p.flying = true; p.teleport(e[0], e[1], e[2]); }, e);
  await settle(10); await lookAt([s.x, lookY, s.z]); await step(30, 33);
};
const walkTo = async (P, frames = 12) => { await ev((P) => { const p = VR.game.player; p.flying = false; p.teleport(P[0], P[1] + 0.05, P[2]); }, P); await step(frames, 33); };
const rec = () => ev(() => JSON.parse(JSON.stringify(VR.Fairy.debug.rec())));
const said = () => ev(() => VR.Fairy.debug.said());
const pics = {};

// ---------------------------------------------------------------- 3 · the frame's cost in the wood at dusk (from where the picture was taken)
async function costHere() {
  const cost = {};
  for (const preset of ['potato', 'high']) {
    await ev((pr) => { const g = VR.game; g.applyPreset(pr); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); }, preset);
    await settle(12);
    for (const on of [false, true, false, true]) {
      const r = await ev(([on]) => { const g = VR.game; g.settings.fairy = on; window.__norender = false; for (let i = 0; i < 6; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); const ms = []; let draws = 0; for (let i = 0; i < 16; i++) { const t = performance.now(); g.last = t - 33; g.loop(t); g.renderer.gl.finish(); ms.push(performance.now() - t); draws = g.renderer.stats.draws; } window.__norender = true; ms.sort((a, b) => a - b); return { ms: +ms[8].toFixed(1), draws, js: +VR.Fairy.debug.cost().ms.toFixed(3) }; }, [on]);
      const k = preset + (on ? '_on' : '_off'); (cost[k] || (cost[k] = [])).push(r);
    }
    console.log('  cost ' + preset + ' ' + JSON.stringify(cost) + ' (' + secs() + ')');
  }
  await ev(() => { const g = VR.game; g.settings.fairy = true; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); });
  run.cost = cost;
  const med = (a) => a.map(x => x.ms).sort((x, y) => x - y)[0];
  check(med(cost.potato_on) <= med(cost.potato_off) * 1.15 + 2, `Very Low in the wood: on ${med(cost.potato_on)} ms, off ${med(cost.potato_off)} ms (High ${med(cost.high_on)} / ${med(cost.high_off)} ms; draws ${cost.high_on[0].draws} / ${cost.high_off[0].draws})`);
  await settle(10);
}

// ---------------------------------------------------------------- 1 · the places at their hours
if (want('places')) {
  const H = { tree: [5200, 30, 4, 12, 0.5], shroom: [12700, 15, 1.5, 2.5, 0.3], spring: [11400, 11, 2.5, 0.8, 0.6], circle: [18000, 15, 3, 1.5, 0.2], garden: [23700, 38, 5, 0, 0.35] };
  for (const kind of ['tree', 'shroom', 'spring', 'circle', 'garden']) {
    try {
      const s = await goTo(kind);
      check(s && s.y !== null, kind + ': settled at ' + (s && [s.x, s.y, s.z].join(', ')));
      if (!s || s.y === null) continue;
      const [t, d, up, ly, side] = H[kind];
      await ev((t) => { VR.game.env.setTime(t); }, t);
      await view(s, d, up, kind === 'garden' ? s.top - 4 : s.y + ly, side);
      await step(60, 33);   // (the fireflies gather, the dancers turn, the bridge rises)
      pics[kind] = await grab('fairy_' + kind + '.png', 4);
      const c = await ev(() => VR.Fairy.debug.cost()); console.log('  ' + kind + ' parts ' + c.parts + ' · ' + c.ms.toFixed(3) + ' ms');
      if (kind === 'shroom' && want('cost')) await costHere();
      if (kind === 'shroom') { await ev(() => VR.game.env.setTime(17500)); await step(40, 33); pics.shroomN = await grab('fairy_shroom_night.png', 4); }
      if (kind === 'tree') { await ev(() => VR.game.env.setTime(13800)); await step(30, 33); pics.treeN = await grab('fairy_tree_night.png', 4); }
      if (kind === 'circle') { await view(s, 6, 1, s.y + 1.4, 1.2); await step(40, 33); pics.circle2 = await grab('fairy_circle_dance.png', 4); }
    } catch (e) { check(false, kind + ': ' + e.message.slice(0, 200)); }
  }
}

// ---------------------------------------------------------------- 2 · the adventures
if (want('adv')) {
  await ev(() => VR.game.env.setTime(5200));
  // the lanterns at the Slumber Tree
  try {
    const s = await goTo('tree');
    const tf = s.folk.find(f => f.who === 'tuepfel');
    await walkTo([tf.pos[0] + 2.5, tf.pos[1], tf.pos[2] + 1]); await lookAt([tf.pos[0], tf.pos[1] + 0.5, tf.pos[2]]);
    await step(12, 33);
    const near = await ev(() => { const g = VR.game, p = g.player, r = VR.Ctx && VR.Ctx.current ? VR.Ctx.current() : null, h = VR.Fairy.near(g, p.eyePos(), p.lookDir ? p.lookDir() : [-Math.sin(p.yaw), 0, -Math.cos(p.yaw)]); return { cur: r ? { key: r.key, kind: r.kind, vars: r.vars } : null, hook: h ? { name: h.name, dist: +h.dist.toFixed(2) } : null }; });
    check(near.hook && /Tüpfel/.test(near.hook.name), 'the Aktion key: „' + (near.hook && near.hook.name) + '" (the prompt: ' + JSON.stringify(near.cur) + ')');
    console.log('  the Aktion key offers: ' + JSON.stringify(near));
    await ev(() => VR.Fairy.debug.talk('tuepfel')); const a1 = await said();
    await step(4, 33); pics.talk = await shotDom('fairy_talk.png');
    await ev(() => VR.Fairy.debug.talk('tuepfel'));
    let r = await rec(); const id = 'overworld:tree';
    check(r.q[id] && r.q[id].s === 1 && /Laterne/.test(a1 && a1.text), 'lanterns: Tüpfel asks (' + (a1 && a1.text.slice(0, 50)) + '…), the adventure begins');
    const L = (await ev(() => VR.Fairy.debug.sites())).find(x => x.kind === 'tree').lanterns;
    { const p = L[0], e = [p[0] + (s.x - p[0]) * 0.12, 0, p[2] + (s.z - p[2]) * 0.12]; e[1] = await ev((e) => VR.game.world.topAt(Math.floor(e[0]), Math.floor(e[2])) + 2.6, e); await ev((e) => { const pl = VR.game.player; pl.flying = true; pl.teleport(e[0], e[1], e[2]); }, e); await settle(6); await lookAt([p[0], p[1] + 0.3, p[2]]); await ev(() => VR.game.env.setTime(13300)); await step(20, 33); pics.lantern = await grab('fairy_lantern.png', 4); await ev(() => VR.game.env.setTime(5200)); }
    for (const p of L) { await walkTo(p, 10); }
    r = await rec(); check(r.q[id].s === 2 && r.q[id].m === 7, 'lanterns: three found by walking to them (mask ' + r.q[id].m + ')');
    await walkTo([tf.pos[0] + 2.5, tf.pos[1], tf.pos[2] + 1]); await ev(() => VR.Fairy.debug.talk('tuepfel'));
    r = await rec();
    const inv = await ev(() => VR.game.player.inv.count('b:spirit_lantern'));
    check(r.done.includes(id) && r.pages.includes('lanterns') && r.buddy && inv >= 6, `lanterns: done — a Wanderbuch page, the companion light, ${inv} spirit lanterns`);
    await step(30, 33); pics.buddy = await grab('fairy_buddy.png', 4);
  } catch (e) { check(false, 'lanterns: ' + e.message.slice(0, 300)); }
  // the hat at the Wishing Spring
  try {
    const s = await goTo('spring'); const z = s.folk.find(f => f.who === 'zwirbel');
    await walkTo([z.pos[0] + 4, z.pos[1], z.pos[2]]);
    await ev(() => VR.Fairy.debug.talk('zwirbel')); await ev(() => VR.Fairy.debug.talk('zwirbel'));
    for (let k = 0; k < 3; k++) { const c = await ev(() => VR.Fairy.debug.chase()); if (!c) break; await walkTo([c.pos[0] + 0.8, c.pos[1] - 0.1, c.pos[2]], 6); await step(40, 33); }
    const r = await rec();
    check(r.done.includes('overworld:spring'), 'hat: Zwirbel caught three times, the hat given back');
    await ev(() => VR.Fairy.debug.wish(2)); const r2 = await rec();
    check(r2.trail > 0, 'the spring: a wish — the flower trail');
    await walkTo([s.x + 8, s.y, s.z + 8], 2); for (let k = 0; k < 20; k++) await walkTo([s.x + 8 + k * 0.5, s.y + 0.0, s.z + 8], 2);
  } catch (e) { check(false, 'hat: ' + e.message.slice(0, 300)); }
  // the bridge at the Floating Garden
  try {
    const s = await goTo('garden'); const d = s.folk.find(f => f.who === 'dusel');
    await walkTo([d.pos[0] + 2, d.pos[1], d.pos[2] + 2]);
    for (let k = 0; k < 3; k++) await ev(() => VR.Fairy.debug.talk('dusel'));
    const mel = await ev(() => VR.Fairy.debug.melody());
    await step(120, 33);
    for (const n of mel) { await ev((n) => VR.Fairy.debug.play(n), n); await step(8, 33); }
    await step(120, 33);
    let r = await rec();
    check(r.done.includes('overworld:garden'), 'bridge: the melody ' + mel.join('-') + ' played on the singing stones, the bridge wakes');
    await walkTo(s.foot, 4);
    let u0 = -1, shot = false, tr = [];
    for (let k = 0; k < 40; k++) { await step(10, 33); const u = await ev(() => VR.Fairy.debug.ride()); tr.push(u < 0 ? -1 : +u.toFixed(2)); if (u >= 0) u0 = Math.max(u0, u); if (u > 0.45 && !shot) { shot = true; await lookAt([s.x, s.top + 1, s.z]); pics.ride = await grab('fairy_ride.png', 4); } if (u0 >= 0 && u < 0) break; }
    console.log('  the ride: ' + tr.join(' ') + ' · bridge ' + (await ev(() => VR.Fairy.debug.bridge())).toFixed(2));
    const p = await ev(() => VR.game.player.pos.slice());
    check(u0 > 0.9 && Math.abs(p[1] - s.top) < 1.2, `bridge: the clouds carried the player up (y ${p[1].toFixed(1)}, the garden ${s.top})`);
    await step(60, 33);
    const p2 = await ev(() => VR.game.player.pos.slice());
    check(Math.abs(p2[1] - s.top) < 0.3, 'the garden holds the player (y ' + p2[1].toFixed(2) + ')');
    await lookAt([s.x + 30, s.top - 12, s.z - 30]); await step(10, 33); pics.ontop = await grab('fairy_ontop.png', 4);
  } catch (e) { check(false, 'bridge: ' + e.message.slice(0, 300)); }
  // the riddles at the Moonstone Circle
  try {
    const s = await goTo('circle'); const f = s.folk.find(x => x.who === 'silbrin');
    await walkTo([f.pos[0] + 2, s.y, f.pos[2] + 2]);
    await ev(() => VR.Fairy.debug.talk('silbrin')); await ev(() => VR.Fairy.debug.talk('silbrin'));
    const R = await ev(() => VR.Fairy.debug.riddles());
    const q1 = await said();
    const wrong = await ev((j) => VR.Fairy.debug.answer(j), (R[0].order.indexOf(0) + 1) % 3);
    for (let k = 0; k < 3; k++) await ev((j) => VR.Fairy.debug.answer(j), R[k].order.indexOf(0));
    const r = await rec();
    check(r.done.includes('overworld:circle'), 'riddle: three answered (the first: „' + (q1 && q1.text.slice(0, 60)) + '…")');
  } catch (e) { check(false, 'riddle: ' + e.message.slice(0, 300)); }
  // Flöckchen home
  try {
    const s = await goTo('shroom'); const f = s.folk.find(x => x.who === 'flocke');
    await walkTo([f.pos[0] + 2, f.pos[1], f.pos[2]]);
    await ev(() => VR.Fairy.debug.talk('flocke')); await ev(() => VR.Fairy.debug.talk('flocke'));
    let E = await ev(() => VR.Fairy.debug.escort());
    check(!!E, 'lost: Flöckchen follows');
    for (let k = 0; k < 120 && E; k++) {
      const p = await ev(() => VR.game.player.pos.slice()), dx = E.to[0] - p[0], dz = E.to[2] - p[2], d = Math.hypot(dx, dz), st = Math.min(4, d);
      const nx = p[0] + dx / d * st, nz = p[2] + dz / d * st, ny = await ev((q) => VR.game.world.topAt(Math.floor(q[0]), Math.floor(q[1])) + 1, [nx, nz]);
      await walkTo([nx, ny, nz], 18);
      if (k === 6) pics.escort = await grab('fairy_escort.png', 3);
      E = await ev(() => VR.Fairy.debug.escort());
    }
    const r = await rec();
    check(r.done.includes('overworld:shroom'), 'lost: Flöckchen brought home to the stone circle');
  } catch (e) { check(false, 'lost: ' + e.message.slice(0, 300)); }
  const r = await rec(); run.rec = r;
  check(r.done.length === 5 && r.pages.length === 5, 'all five adventures done, five Wanderbuch pages: ' + r.pages.join(', '));
}

// far from every place: nothing
await ev(() => { const p = VR.game.player; p.flying = true; p.teleport(p.pos[0] + 900, 150, p.pos[2] + 900); }); await step(30, 33);
check(await ev(() => VR.Fairy.debug.near()) === null, 'far from every place: nothing near, nothing drawn');

check(!logs.some(l => /pageerror/.test(l)), 'no page error' + (logs.length ? ': ' + logs.slice(0, 3).join(' · ') : ''));
save();
const row = (label, ks) => ({ label, imgs: ks.map(k => pics[k]).filter(Boolean) });
const rows = [row('Schlummerbaum: golden day · dusk', ['tree', 'treeN']), row('Leuchtpilzwald: dusk · night', ['shroom', 'shroomN']), row('Wunschquelle · Mondsteinkreis (clear night)', ['spring', 'circle']), row('Der Tanz · Schwebegarten at sunrise', ['circle2', 'garden']), row('Talk (bubble) · a lost lantern', ['talk', 'lantern']), row('The cloud bridge carries you · on the garden', ['ride', 'ontop']), row('Flöckchen follows · the companion light', ['escort', 'buddy'])].filter(r => r.imgs.length);
if (rows.length) { fs.writeFileSync(ROOT + '/.tmp_tests/fairy_sheet.json', JSON.stringify({ w: 620, rows })); try { console.log('  ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'fairy_sheet.jpg', ROOT + '/.tmp_tests/fairy_sheet.json']).toString().trim()); } catch (e) { console.log('  sheet: ' + e.message.slice(0, 200)); } }
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
