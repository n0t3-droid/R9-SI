// a-quest in the browser (docs/superpowers/plans/2026-11-02-a-quest.md): a new default world (seed 4242, Kreativ,
// Friedlich), 960 × 540, de-DE, Balanced, your name „Mila". Two Geschichten played end to end with pictures:
//   0 · a friend (u-gossip: Bekannt) you stand beside asks in one small bubble — by itself (tales_hook.png); [V] talk:
//       „✿ Was ist los?“ → the request (tales_offer.png) → „Ich helfe dir!“
//   1 · Das schläfrige Leuchtfeuer as a builder: the hill (the beacon, the HUD line, Funke's target), the lens found,
//       three lanterns placed through the game's own placing hook, the twist, home, the friend's ending
//       (tales_beacon_*.png); at night the woken beacon shines over the land (tales_beacon_night.png)
//   2 · Wo ist …? as an explorer at dusk: the fairy place, the footprints (tales_lost_trail.png), the child found
//       (tales_lost_found.png), a save mid-quest (the record's round trip, the tale goes on), the child follows you
//       home (tales_lost_follow.png), the ending in the friend's arms (tales_lost_end.png)
//   3 · the news reached the village (u-gossip kind 'tale'), the Wanderbuch's section „Geschichten“ with both pages
//       and their verses (tales_book.png); the frame: Very Low / High with a tale running, tales on / off (ms)
//   → test/shots/quest_sheet.jpg, .tmp_tests/tales_run.json
//   nohup bash test/wt_run.sh tales.mjs 3600 > .tmp_tests/tales.log 2>&1 &
// regress: skip  (a showcase with pictures; the gate is test/tales.js)
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
const save = () => { try { fs.writeFileSync(ROOT + '/.tmp_tests/tales_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|tales/i.test(s)) logs.push(`[${t}] ${s.slice(0, 400)}`); });
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
const shotDom = async (key, name) => { try { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } window.__norender = true; }); await page.screenshot({ path: SHOTS + name, timeout: 120000 }); console.log('  📷 ' + name); pics[key] = SHOTS + name; return SHOTS + name; } catch (e) { console.log('  !! ' + e.message); return null; } };
// stand at P (feet) looking at L
const stand = (P, look, fly = true) => ev(([P, L, fly]) => { const p = VR.game.player; p.flying = fly; p.teleport(P[0], P[1], P[2]); p.vel = [0, 0, 0]; const e = [P[0], P[1] + 1.6, P[2]], dx = L[0] - e[0], dy = L[1] - e[1], dz = L[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw; }, [P, look, fly]);
const gy = (x, z) => ev(([x, z]) => VR.Tales.ground(VR.game, x, z), [x, z]);
// walk to a point on the ground: hop there (the land loads), stand on it, let the 2-Hz look see you
const goTo = async (x, z, look, opts = {}) => {
  let y = await gy(x, z);
  if (y === null) { await stand([x, 150, z], [x, 60, z - 20]); for (let i = 0; i < 12 && y === null; i++) { await settle(6); await step(10, 33); y = await gy(x, z); } }
  if (y === null) y = 80;
  await stand([x + (opts.dx || 0), y + (opts.up || 0), z + (opts.dz || 0)], look || [x, y + 1, z - 10], !!opts.fly);
  await step(opts.frames || 24, 33);
  return y;
};
// a picture of someone's bubble: an eye 4.5 m off and over the speaker, free sight
const shotOf = async (getWho, key, name, back = 4.5) => {
  const ok = await ev(([src, back]) => {
    const b = (new Function('return ' + src))()(); if (!b) return false;
    const g = VR.game, p = g.player, W = g.world, R = VR.R, solid = (x, y, z) => { const st = W.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return !!(st && (R.T.flags[st] & VR.F.SOLID)); };
    let best = null;
    for (let k = 0; k < 16 && !best; k++) { const an = k / 16 * Math.PI * 2 + 0.3, ex = b.pos[0] + Math.cos(an) * back, ez = b.pos[2] + Math.sin(an) * back, ey = b.pos[1] + 2.6; let clear = true; for (let s2 = 0; s2 <= 1.0001 && clear; s2 += 0.1) if (solid(ex + (b.pos[0] - ex) * s2, ey + (b.pos[1] + 1.2 - ey) * s2, ez + (b.pos[2] - ez) * s2) || solid(ex, ey - 1, ez)) clear = false; if (clear) best = [ex, ey, ez]; }
    if (!best) best = [b.pos[0] + 3, b.pos[1] + 3.5, b.pos[2] + 3];
    p.flying = true; p.teleport(best[0], best[1] - 1.6, best[2]); p.vel = [0, 0, 0];
    const dx = b.pos[0] - best[0], dy = b.pos[1] + 1.0 - best[1], dz = b.pos[2] - best[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw;
    if (b.bubble) b.bubble.t = Math.max(b.bubble.t, 3); return true;
  }, [getWho.toString(), back]);
  if (!ok) { console.log('  !! nobody for ' + name); return null; }
  await step(3, 33); await ev(() => { for (const q of VR.game.villages.agents) if (q.bubble) q.bubble.t = Math.max(q.bubble.t, 2); });
  return shotDom(key, name);
};

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.playerName = 'Mila'; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Geschichten',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:false})`);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world');
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeWeather = true; g.zenFreezeTime = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.setTime(3000); });
await settle(20); await step(60, 33);
check(await ev(() => !!(VR.Tales && VR.TalesCore && VR.Tales.test)), 'VR.Tales is there');

// ---------------------------------------------------------------- the village nearest the fairy places, with children
const places = await ev(() => { const g = VR.game, F = VR.Fairy && VR.Fairy.state; return { fairy: F && F.sites ? F.sites.map(s => ({ id: s.id, kind: s.kind, x: Math.round(s.x), z: Math.round(s.z) })) : [], sites: g.villages.sites.map(s => ({ id: s.id, x: s.x, y: s.y, z: s.z, name: s.name })), spawn: g.player.pos.map(Math.round) }; });
run.places = places;
console.log('  fairy ' + JSON.stringify(places.fairy) + ' · villages ' + places.sites.length);
const pickVil = async () => ev(() => {
  const g = VR.game, V = g.villages, F = VR.Fairy && VR.Fairy.state, fs = F && F.sites ? F.sites : [];
  const L = V.sites.map(s => ({ id: s.id, x: s.x, y: s.y, z: s.z, name: s.name, d: fs.length ? Math.min(...fs.map(f => Math.hypot(f.x - s.x, f.z - s.z))) : 1e9 })).filter(s => s.d < 640).sort((a, b) => a.d - b.d);
  return L;
});
let cands = await pickVil();
for (const [dx, dz] of [[500, 0], [0, 500], [-500, 0], [0, -500], [700, 700], [-700, -700]]) {
  if (cands.length >= 3) break;
  await stand([places.spawn[0] + dx, 170, places.spawn[2] + dz], [places.spawn[0] + dx, 100, places.spawn[2] + dz - 30]);
  for (let i = 0; i < 6; i++) { await step(20, 50); await wait(200); }
  cands = await pickVil();
}
run.cands = cands.slice(0, 6);
check(cands.length > 0, 'villages within 640 m of a fairy place: ' + cands.slice(0, 4).map(c => `${c.name} ${Math.round(c.d)} m`).join(', '));
// stand in a village until its people are out; a grown-up whose family has children
let giver = null, vilId = null;
for (const c of cands.slice(0, 5)) {
  await stand([c.x + 0.5, (c.y || 80) + 30, c.z + 0.5], [c.x, c.y || 80, c.z - 10]);
  for (let i = 0; i < 14; i++) { await settle(6); await step(20, 33); if (await ev((id) => { const v = VR.game.villages.known.get(id); return !!(v && v.active && v.agents.length); }, c.id)) break; }
  giver = await ev((id) => {
    const g = VR.game, V = g.villages, v = V.known.get(id); if (!v || !v.active) return null;
    const kidsOf = (a) => (v.people || []).filter(q => q.age === 'child' && q.fam === a.p.fam).length;
    const L = v.agents.filter(a => !a.kid && a.p && a.pose !== 'sleep' && !a.p.town && kidsOf(a) > 0);
    const a = L[0]; if (!a) return null;
    return { id: a.p.id, name: a.p.name, kids: kidsOf(a), vil: v.name, vid: v.id };
  }, c.id);
  if (giver) { vilId = c.id; break; }
}
run.giver = giver;
check(!!giver, `a friend-to-be: ${giver && giver.name} in ${giver && giver.vil} (${giver && giver.kids} children)`);
if (!giver) { save(); await browser.close(); console.log('FAILED ' + (fails + 1)); process.exit(1); }
// befriend (u-gossip: talks and gifts over days → Bekannt), then stand beside them
await ev((id) => VR.Gossip.test.friend('overworld/' + id, 6), giver.id);
const beside = () => ev((id) => { const g = VR.game, a = g.villages.agents.find(x => x.p && String(x.p.id) === String(id)); if (!a) return false; g.player.flying = false; g.player.teleport(a.pos[0] + 1.8, a.pos[1] + 0.2, a.pos[2] + 1.2); const e = g.player.eyePos(); g.player.yaw = Math.atan2(-(a.pos[0] - e[0]), -(a.pos[2] - e[2])); g.player.pitch = -0.1; g.player.viewYaw = g.player.yaw; a.path = null; a.goal = null; a.vel[0] = 0; a.vel[2] = 0; return true; }, giver.id);

// ---------------------------------------------------------------- 0 · the offer comes by itself
await ev(() => { VR.Tales.test.cool(); VR.Gossip.test.cool(); VR.game.env.setTime(3200); });
let offer = null;
for (let i = 0; i < 30 && !offer; i++) { await beside(); await step(10, 33); await ev(() => VR.Gossip.test.cool()); offer = await ev(() => VR.Tales.test.offer()); }
run.offer = offer;
check(!!offer, `standing beside a friend, an offer comes by itself: ${offer && offer.who} — ${offer && offer.t}:${offer && offer.v}`);
if (offer) await shotOf(() => { const o = VR.Tales.state.offer; return o && o.a; }, 'hook', 'tales_hook.png');
const hookLine = await ev(() => { const o = VR.Tales.state.offer; return o && o.a.bubble ? o.a.bubble.text : null; });
check(!!hookLine && /Mila|Moment|fragen|vertraue/.test(hookLine), `one small bubble: „${hookLine}“`);
// one offer at a time: no second friend asks while it stands
const others = await ev(() => VR.Tales.test.log().filter(l => l.what === 'offer').length);
check(others === 1, 'one offer at a time (' + others + ')');

// ---------------------------------------------------------------- 1 · the sleepy beacon (as a builder: a Kreativ world)
const mk1 = await ev((id) => VR.Tales.test.make(id, 'beacon'), giver.id);
run.mk1 = mk1;
check(mk1 && mk1.t === 'beacon', 'the friend asks about the sleepy beacon: ' + JSON.stringify(mk1));
await beside();
await ev((id) => { const g = VR.game, V = g.villages, a = V.agents.find(x => x.p && String(x.p.id) === String(id)); V.openTalk(a); }, giver.id);
await step(4, 33);
await ev(() => { const b = document.querySelector('[data-tl="tloffer"]'); if (b) b.click(); });
await step(2, 33);
const askT = await ev(() => { const el = document.getElementById('tk_text'); return el ? el.textContent : ''; });
check(/Leuchtfeuer/.test(askT) && !!(await ev(() => document.querySelector('[data-tl="tlyes"]'))), `„✿ Was ist los?“ tells it: „${askT.slice(0, 90)}…“, Ja / Ein andermal`);
await shotDom('offer', 'tales_offer.png');
await ev(() => { const b = document.querySelector('[data-tl="tlyes"]'); if (b) b.click(); });
await step(30, 33); await wait(1700); await step(30, 33);
let cur = await ev(() => VR.Tales.test.cur());
check(cur && cur.t === 'beacon' && cur.st === 'on' && cur.role === 'builder', `accepted: ${JSON.stringify(cur && { step: cur.step, role: cur.role, line: cur.line })}`);
const hud1 = await ev(() => { const el = document.getElementById('tlline'); return el && el.style.display !== 'none' ? el.textContent : ''; });
check(/✿/.test(hud1), 'one calm line on the HUD: „' + hud1 + '“');
const funke = await ev(() => { const t = VR.Tales.test.cur(); return t ? t.target : null; });
// the hill
await goTo(cur.target[0], cur.target[1], null, { frames: 30 });
cur = await ev(() => VR.Tales.test.cur());
if (cur.step === 'hill') { await goTo(cur.target[0], cur.target[1], null, { frames: 30 }); cur = await ev(() => VR.Tales.test.cur()); }
run.beaconRefine = await ev(() => VR.Tales.test.log().filter(l => l.what === 'refine'));
check(cur.step === 'lens', `on the hill (the beacon at its top: ${JSON.stringify(run.beaconRefine.map(l => l.text))}); next: the lens`);
const hill = await ev(() => { const t = VR.Tales.test.tale(); return t.steps.find(s => s.at === 'hill').p; });
const hy = await gy(hill[0], hill[1]);
await stand([hill[0] + 9, hy + 3.5, hill[1] + 9], [hill[0], hy + 2.5, hill[1]]);
await step(6, 33);
await shotDom('bhill', 'tales_beacon_hill.png');
// the lens (a mark down the slope)
await goTo(cur.target[0], cur.target[1], null, { frames: 4, dx: 2.5, dz: 2.5 });
await stand(await ev(() => { const p = VR.game.player.pos; return [p[0], p[1] + 1.5, p[2]]; }), [cur.target[0], (await gy(cur.target[0], cur.target[1])) || 80, cur.target[1]]);
await step(4, 33); await grab('blens', 'tales_beacon_lens.png', 4);
await goTo(cur.target[0], cur.target[1], null, { frames: 24 });
cur = await ev(() => VR.Tales.test.cur());
check(cur.step === 'lights', 'the lens found (its line: ' + JSON.stringify(await ev(() => VR.Tales.test.log().filter(l => l.what === 'say' || l.what === 'note').slice(-1).map(l => l.text))) + ')');
// three lanterns by the beacon, placed through the game's own hook
const placed = await ev((hill) => {
  const g = VR.game, R = VR.R, st = (R.byName.lantern || R.byName.torch).defaultState, out = [];
  for (let k = 0; k < 1; k++) {
    const a = k * 2.1 + 0.5, x = Math.floor(hill[0] + Math.cos(a) * 5), z = Math.floor(hill[1] + Math.sin(a) * 5), y = VR.Tales.ground(g, x + 0.5, z + 0.5);
    if (y === null) continue; g.world.setBlock(x, y, z, st); if (g.onBlockPlaced) g.onBlockPlaced(x, y, z, st, g.player); out.push([x, y, z]);
  }
  return { out, hooked: !!(g.onBlockPlaced && g.onBlockPlaced.__tl) };
}, hill);
// (f-polish8: the beacon stirs with the first light — its lens brighter, a lamp on its rim: a picture at dusk)
run.stage1 = await ev(() => VR.Tales.test.diag().stage);
await ev(() => VR.game.env.setTime(12600));
await stand([hill[0] + 7, hy + 3, hill[1] + 6], [hill[0], hy + 3, hill[1]]);
await step(8, 33);
await grab('bstage', 'tales_beacon_stage.png', 4);
await ev(() => VR.game.env.setTime(9600));
{ const more = await ev((hill) => {
  const g = VR.game, R = VR.R, st = (R.byName.lantern || R.byName.torch).defaultState, out = [];
  for (let k = 1; k < 3; k++) {
    const a = k * 2.1 + 0.5, x = Math.floor(hill[0] + Math.cos(a) * 5), z = Math.floor(hill[1] + Math.sin(a) * 5), y = VR.Tales.ground(g, x + 0.5, z + 0.5);
    if (y === null) continue; g.world.setBlock(x, y, z, st); if (g.onBlockPlaced) g.onBlockPlaced(x, y, z, st, g.player); out.push([x, y, z]);
  }
  return out;
}, hill); placed.out.push(...more); }
check(run.stage1 === 2, 'one light brought: the beacon stirs (stage ' + run.stage1 + ' of 4)');
await step(30, 33);
cur = await ev(() => VR.Tales.test.cur());
run.beaconPlaced = placed;
check(placed.hooked && placed.out.length === 3 && cur && cur.step !== 'lights', `three lanterns placed (the placing hook chained) → the beacon stirs; the twist: ${cur && cur.v}, next ${cur && cur.step}`);
await ev(() => VR.game.env.setTime(9600));
await stand([hill[0] + 8, hy + 3, hill[1] + 7], [hill[0], hy + 2.5, hill[1]]);
await step(8, 33);
await shotDom('blit', 'tales_beacon_lights.png');
if (cur && (cur.step === 'hum' || cur.step === 'owl')) { await goTo(hill[0] + 1.5, hill[1] + 1.5, null, { frames: 24 }); cur = await ev(() => VR.Tales.test.cur()); }
check(cur && cur.step === 'home', 'the twist played (' + (await ev(() => VR.Tales.test.log().filter(l => l.what === 'twist' || l.what === 'step').map(l => l.text).join(' › '))) + ')');
// home: the friend's ending
const vpos = await ev((id) => { const v = VR.game.villages.known.get(id); return [v.plan.x, v.plan.z]; }, vilId);
await goTo(vpos[0] + 4, vpos[1] + 4, null, { frames: 10 });
for (let i = 0; i < 8; i++) { await step(10, 33); if (await ev(() => !!VR.Tales.test.last())) break; await goTo(vpos[0] + 2, vpos[1] + 2, null, { frames: 6 }); }
const end1 = await ev(() => VR.Tales.test.last());
run.end1 = end1;
check(end1 && /beacon\.end/.test(end1.key), `the ending: „${end1 && end1.text}“ (${end1 && end1.item ? 'a gift: ' + end1.item : 'no gift'})`);
await shotOf(() => { const g = VR.game; return g.villages.agents.find(a => a.bubble && a.bubble.text && a.bubble.text.length > 30 && !a.kid) || null; }, 'bend', 'tales_beacon_end.png');
await step(90, 33);   // (the toast)
// at night the woken beacon shines over the land
await ev(() => { VR.game.env.setTime(16500); });
// (f-polish8: run 1 of a-quest missed it from 26 m — now 15 m, and the numbers of the draw logged)
const litPre = await ev(() => VR.Tales.test.diag());
console.log('     lit before the night picture: ' + JSON.stringify(litPre).slice(0, 300));
const LB = litPre.lit[0] || { x: hill[0], z: hill[1], y: hy };
const lby = Number.isFinite(LB.y) ? LB.y : hy;
{ const dx = vpos[0] - LB.x, dz = vpos[1] - LB.z, L = Math.hypot(dx, dz) || 1; await stand([LB.x + dx / L * 15, lby + 4, LB.z + dz / L * 15], [LB.x, lby + 4.5, LB.z]); }
await settle(6); await step(10, 33);
await grab('bnight', 'tales_beacon_night.png', 6);
run.litDiag = await ev(() => { const d = VR.Tales.test.diag(), g = VR.game, L = d.lit[0], R = VR.R; let names = ''; if (L && Number.isFinite(L.y)) for (let y = L.y - 2; y <= L.y + 1; y++) { const s = g.world.getBlock(Math.floor(L.x), y, Math.floor(L.z)); names += y + ':' + (s ? R.types[R.T.type[s]].name : 'air') + ' '; } return Object.assign(d, { column: names, tod: g.env.timeOfDay | 0 }); });
console.log('     the night picture: ' + JSON.stringify(run.litDiag).slice(0, 400));
check(run.litDiag.litDrawn > 0 && !run.litDiag.err, 'the woken beacon drawn at night (' + run.litDiag.litDrawn + ' draws, ' + run.litDiag.glows + ' glows)');
const lit = await ev(() => VR.Tales.test.rec().lit);
check(lit.length === 1 && lit[0].k === 'beacon', 'the beacon stays awake: ' + JSON.stringify(lit));

// ---------------------------------------------------------------- 2 · the lost child at dusk (as an explorer)
await ev(() => { VR.game.env.setTime(10600); VR.Tales.test.cool(); });
await goTo(vpos[0] + 3, vpos[1] + 3, null, { frames: 30 });
await beside();
const mk2 = await ev((id) => VR.Tales.test.make(id, 'lost'), giver.id);
run.mk2 = mk2;
check(mk2 && mk2.t === 'lost', 'towards dusk the friend asks: where is the child? ' + JSON.stringify(mk2));
let lostOk = !!(mk2 && mk2.t === 'lost');
if (lostOk) {
  await ev(() => { VR.Tales.test.accept(); const t = VR.Tales.test.tale(); t.role = 'explorer'; });
  await step(20, 33);
  cur = await ev(() => VR.Tales.test.cur());
  await goTo(cur.target[0], cur.target[1], null, { frames: 30 });
  cur = await ev(() => VR.Tales.test.cur());
  check(cur.step === 'trail', 'at the fairy place; the trail: ' + cur.line);
  const T1 = await ev(() => { const t = VR.Tales.test.tale(); const s = t.steps.find(q => q.id === 'trail').of[0]; return { prints: s.pts, hide: t.steps.find(q => q.id === 'find').p, place: t.steps[0].p }; });
  const py = await gy(T1.prints[0][0], T1.prints[0][1]);
  await stand([T1.place[0], (py || 80) + 2.2, T1.place[1]], [T1.prints[0][0], (py || 80) + 0.2, T1.prints[0][1]]);
  await settle(4); await step(6, 33);
  await shotDom('ltrail', 'tales_lost_trail.png');
  await goTo(T1.place[0], T1.place[1], null, { frames: 24 });
  const T2 = await ev(() => { const t = VR.Tales.test.tale(); const s = t.steps.find(q => q.id === 'trail').of[0]; return { prints: s.pts, hide: t.steps.find(q => q.id === 'find').p, safe: VR.Tales.test.log().filter(l => l.what === 'safe').map(l => l.text) }; });
  run.safe = T2.safe; T1.prints = T2.prints; T1.hide = T2.hide;
  for (let k = 0; k < T1.prints.length; k++) { await goTo(T1.prints[k][0], T1.prints[k][1], null, { frames: 24 }); }
  cur = await ev(() => VR.Tales.test.cur());
  check(cur.step === 'find', 'three footprints followed; the child is near: ' + cur.line);
  // the save mid-quest: the record through JSON and back, the game reads it anew
  const rt = await ev(() => { const g = VR.game, a = JSON.stringify(g.meta.tales); g.meta.tales = JSON.parse(a); g._tlLoaded = null; const r = VR.Tales.rec(g); return { same: JSON.stringify(r) === a, i: r.cur && r.cur.i, bytes: a.length }; });
  check(rt.same && rt.i === 2, `saved mid-quest and loaded again: the same record (${rt.bytes} bytes), step ${rt.i + 1}`);
  await goTo(T1.hide[0], T1.hide[1], null, { frames: 6, dx: 3, dz: 3 });
  await step(20, 33);
  const kid0 = await ev(() => VR.Tales.test.kid());
  run.kid0 = kid0;
  check(!!kid0, 'the child waits at the hide: ' + JSON.stringify(kid0));
  await goTo(T1.hide[0], T1.hide[1], null, { frames: 30, dx: 1.5, dz: 1.5 });
  cur = await ev(() => VR.Tales.test.cur());
  check(cur && cur.step !== 'find' && cur.step !== 'trail', `found! the twist: ${cur && cur.v}; next ${cur && cur.step}`);
  await shotOf(() => VR.Tales.state.kid && VR.Tales.state.kid.a, 'lfound', 'tales_lost_found.png', 3.6);
  await step(110, 33);   // (the twist's line comes after the first)
  await shotOf(() => VR.Tales.state.kid && VR.Tales.state.kid.a, 'ltwist', 'tales_lost_twist.png', 3.6);
  // the twist's extra step
  for (let r = 0; r < 4; r++) {
    cur = await ev(() => VR.Tales.test.cur()); if (!cur || cur.step === 'home') break;
    if (cur.step === 'light' || cur.step === 'gather' || cur.step === 'flhome') { const tg = cur.target; await goTo(tg[0], tg[1], null, { frames: 24 }); }
  }
  cur = await ev(() => VR.Tales.test.cur());
  check(cur && cur.step === 'home', 'the twist done; now home with the child: ' + (cur && cur.line));
  // walk home in hops; the child follows
  const from = await ev(() => VR.game.player.pos.slice()), N = 6;
  for (let k = 1; k <= N; k++) {
    const x = from[0] + (vpos[0] + 3 - from[0]) * k / N, z = from[2] + (vpos[1] + 3 - from[2]) * k / N;
    await goTo(x, z, null, { frames: 40 });
    if (k === 2) { const kd = await ev(() => VR.Tales.test.kid()); if (kd) { await stand([kd.pos[0] + 5, kd.pos[1] + 2.4, kd.pos[2] + 5], [kd.pos[0], kd.pos[1] + 0.8, kd.pos[2]]); await step(2, 33); await grab('lfollow', 'tales_lost_follow.png', 4); await goTo(x, z, null, { frames: 6 }); } }
  }
  for (let i = 0; i < 8; i++) { if (await ev(() => VR.Tales.test.last() && /lost\.end/.test(VR.Tales.test.last().key))) break; await goTo(vpos[0] + 1, vpos[1] + 1, null, { frames: 12 }); }
  const end2 = await ev(() => VR.Tales.test.last());
  run.end2 = end2;
  check(end2 && /lost\.end/.test(end2.key), `home: „${end2 && end2.text}“`);
  // (f-polish8: the ending pictured — the friend says it in person with the child beside her: wait for her bubble)
  let hug = null;
  for (let i = 0; i < 14; i++) { await step(10, 33); hug = await ev((gid) => { const g = VR.game, a = g.villages.agents.find(x => x.p && String(x.p.id) === String(gid) && !x.tlKid), k = VR.Tales.state.kid && VR.Tales.state.kid.a; if (!a) return null; return { bubble: !!(a.bubble && a.bubble.text && a.bubble.text.length > 20), text: a.bubble ? a.bubble.text : '', d: k ? +Math.hypot(k.pos[0] - a.pos[0], k.pos[2] - a.pos[2]).toFixed(1) : null }; }, giver.id); if (hug && hug.bubble && hug.d !== null && hug.d < 3) break; }
  run.hug = hug;
  await ev((id) => { window.__gid = id; }, giver.id);
  await shotOf(() => { const g = VR.game; return g.villages.agents.find(a => a.p && String(a.p.id) === String(window.__gid) && !a.tlKid && a.bubble) || g.villages.agents.find(a => a.bubble && a.bubble.text && a.bubble.text.length > 30 && !a.kid) || (VR.Tales.state.kid && VR.Tales.state.kid.a) || null; }, 'lend', 'tales_lost_end.png', 3.8);
  check(!!(hug && hug.bubble && hug.d !== null && hug.d < 3), 'the ending in person: the friend speaks it, the child beside her (' + JSON.stringify(hug).slice(0, 200) + ')');
  lostOk = !!(end2 && /lost\.end/.test(end2.key));
}

// ---------------------------------------------------------------- 3 · the news, the book, the cost
const news = await ev(() => VR.Gossip.test.rec().deeds.filter(d => d.k === 'tale').map(d => d.pl));
run.news = news;
check(news.length >= (lostOk ? 2 : 1), 'the news travels (u-gossip): ' + JSON.stringify(news));
const book = await ev(() => { const g = VR.game; const h = VR.Wander && VR.Wander.html ? VR.Wander.html(g.meta) : ''; return { has: /tlsec/.test(h), pages: VR.Tales.test.rec().pages.map(p => p.t + ':' + p.v), opened: !!(VR.Wander && VR.Wander.open && (VR.Wander.open(g), true)) }; });
await step(4, 33);
for (let i = 0; i < 8; i++) { const on = await ev(() => !!document.querySelector('#wanderbuch .tlsec')); if (on) break; await ev(() => { const b = [...document.querySelectorAll('#wanderbuch button')].find(x => /▶|›|→/.test(x.textContent)); if (b) b.click(); }); await wait(700); }
book.shown = await ev(() => !!document.querySelector('#wanderbuch .tlsec'));
await shotDom('book', 'tales_book.png');
await ev(() => { const g = VR.game; if (VR.Wander.close) VR.Wander.close(g); });
check(book.has && book.shown && book.pages.length >= (lostOk ? 2 : 1), 'the Wanderbuch: „Geschichten“ (on its page: ' + book.shown + ') with ' + JSON.stringify(book.pages));
run.tlcost = await ev(() => VR.Tales.test.cost());
check(run.tlcost.avg < 3, `the 2-Hz look: ${run.tlcost.avg.toFixed(3)} ms average, worst ${run.tlcost.worst.toFixed(2)} ms (${run.tlcost.ticks} ticks)`);
// the frame near the woken beacon at night with a tale running (marks drawn): Very Low and High, tales on / off
await ev(() => { VR.game.env.setTime(16500); VR.Tales.test.cool(); });
await beside();
await ev((id) => { VR.Tales.test.make(id, 'home'); VR.Tales.test.accept(); }, giver.id);
await stand([vpos[0] + (hill[0] - vpos[0]) * 0.55, hy + 14, vpos[1] + (hill[1] - vpos[1]) * 0.55], [hill[0], hy + 3, hill[1]]);
const cost = {};
for (const preset of process.env.SKIP_COST ? [] : ['potato', 'high']) {
  await ev((pr) => { const g = VR.game; g.applyPreset(pr); g.settings.dynRes = false; g.settings.renderDist = 6; g.applySettings('*'); }, preset);
  await settle(10);
  for (const on of [false, true, true, false, false, true]) {
    await ev((on) => { VR.game.settings.tales = on; }, on);
    const r = await ev(() => { const g = VR.game; window.__norender = false; for (let i = 0; i < 8; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); const ms = []; for (let i = 0; i < 9; i++) { const t = performance.now(); g.last = t - 33; g.loop(t); g.renderer.gl.finish(); ms.push(performance.now() - t); } window.__norender = true; ms.sort((a, b) => a - b); return +ms[4].toFixed(1); });
    (cost[preset + (on ? '_on' : '_off')] || (cost[preset + (on ? '_on' : '_off')] = [])).push(r);
  }
}
await ev(() => { VR.game.settings.tales = true; });
const md = (a) => { const q = (a || [0]).slice().sort((x, y) => x - y); return q[q.length >> 1]; };
run.cost = cost; run.costMed = { potato_on: md(cost.potato_on), potato_off: md(cost.potato_off), high_on: md(cost.high_on), high_off: md(cost.high_off) };
if (!process.env.SKIP_COST) check(run.costMed.potato_on <= run.costMed.potato_off * 1.15 + 2, `Very Low (medians, ABBA): tales on ${run.costMed.potato_on} ms, off ${run.costMed.potato_off} ms (High ${run.costMed.high_on} / ${run.costMed.high_off} ms)`);
check(!logs.some(l => /pageerror|tales/i.test(l)), 'no page error' + (logs.length ? ': ' + logs.slice(0, 4).join(' · ') : ''));
run.log = await ev(() => VR.Tales.test.log().map(l => l.what + ': ' + l.text));
save();
const row = (label, ks) => ({ label, imgs: ks.map(k => pics[k]).filter(Boolean) });
const rows = [
  row('Ein Freund fragt — eine kleine Blase, dann im Gespräch: „✿ Was ist los?“', ['hook', 'offer']),
  row('Das schläfrige Leuchtfeuer: der Hügel, die Linse am Hang', ['bhill', 'blens']),
  row('Die erste Laterne: das Leuchtfeuer regt sich (Linse heller, eine Lampe am Rand) · alle drei: es erwacht', ['bstage', 'blit']),
  row('Das Ende beim Freund', ['bend']),
  row('Nachts leuchtet das geweckte Feuer über dem Land · das Wanderbuch', ['bnight', 'book']),
  row('Wo ist …? In der Dämmerung am Feenort: die Fußspuren · gefunden', ['ltrail', 'lfound']),
  row('Die Wendung · das Kind läuft dir nach', ['ltwist', 'lfollow']),
  row('Daheim: das Ende in den Armen des Freundes', ['lend']),
].filter(r => r.imgs.length);
if (rows.length) { fs.writeFileSync(ROOT + '/.tmp_tests/quest_sheet.json', JSON.stringify({ w: 620, rows })); try { console.log('  ' + execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'quest_sheet.jpg', ROOT + '/.tmp_tests/quest_sheet.json']).toString().trim()); } catch (e) { console.log('  !! sheet ' + e.message); } }
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
