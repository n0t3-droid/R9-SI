// w-golden · golden shots (docs/superpowers/plans/2026-11-02-w-golden.md): deterministic pictures of the places that
// must never vanish, each compared with its reference in test/golden/ by a windowed SSIM (test/golden_ssim.js: luma,
// chroma and the worst tile of an 8 × 8 grid, so a landmark gone from a wide view fails even when the mean stays high).
// One page, 640 × 360, de-DE, Math.random seeded in the page, a new default world (seed 4242, creative, peaceful), the
// clock and the weather frozen (clear), the HUD hidden, animals and people not drawn (their walk is not deterministic).
//   shots  Very Low: vista_vl (from 14 m over the spawn, away from the gate), citadel_vl (the Turmzitadelle from 90 m);
//          Balanced: vista, citadel, plaza (the nearest village's plaza), fairy (the fairy tree by day), starmap (the
//          star map, DOM), cafe (the Ringstation café), aqua (Aquamarin's town)
//   pass   every shot ≥ its thresholds (THR below); a failure writes test/shots/golden_<id>_diff.png (reference · now ·
//          the SSIM map, dark = different) and the scores; all scores → .tmp_tests/golden_run.json
//   UPDATE=1 writes the references test/golden/<id>.png (commit them); ONLY=vista,cafe · DIST=file:///…/index.html
//   UPDATE_IDS=hud,starmap (with UPDATE=1): writes only those references, compares the rest (f-ux: an intended change)
//   hud (f-ux): the page with the HUD at spawn (Balanced; the compass rose, the hotbar, no minimap) — a page screenshot
//   usage: nohup bash test/wt_run.sh golden.mjs 1200 > .tmp_tests/golden.log 2>&1 &   (≤ 6 min on the 2-CPU machine)
// regress: skip  (the release gate runs it: test/release_gate.sh; UPDATE=1 is a choice a person makes)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import fs from 'fs';
import { createRequire } from 'module';
const ROOT = new URL('../', import.meta.url).pathname;   // this checkout (the test runs from test/ or from .tmp_tests/)
const require = createRequire(import.meta.url);
const S = require(ROOT + 'test/golden_ssim.js');
const G = require(ROOT + 'test/golden_wait.js');   // (f-quiet3: when the world counts as settled)
const DIST = process.env.DIST || 'file://' + ROOT + 'dist/index.html';
const GOLD = ROOT + 'test/golden/', SHOTS = ROOT + 'test/shots/';
const UPDATE = process.env.UPDATE === '1', UPD_IDS = process.env.UPDATE_IDS ? process.env.UPDATE_IDS.split(',') : null, ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (id) => !ONLY || ONLY.includes(id);
const W = 640, H = 360, CW = 320, CH = 180;   // (the page, the comparison)
// the thresholds a shot: luma, chroma, the worst tile (the DOM map is exact; the station and the town settle less alike)
const THR = {
  vista_vl: { y: 0.80, c: 0.85, tile: 0.45 }, citadel_vl: { y: 0.80, c: 0.85, tile: 0.45 },
  vista: { y: 0.80, c: 0.85, tile: 0.45 }, citadel: { y: 0.80, c: 0.85, tile: 0.45 }, plaza: { y: 0.75, c: 0.85, tile: 0.40 },
  hud: { y: 0.75, c: 0.80, tile: 0.35 },
  fairy: { y: 0.75, c: 0.85, tile: 0.40 }, starmap: { y: 0.95, c: 0.95, tile: 0.80 }, cafe: { y: 0.75, c: 0.85, tile: 0.40 },
  aqua: { y: 0.70, c: 0.80, tile: 0.35 },
};
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const run = { dist: DIST, update: UPDATE, shots: {} };
const save = () => { try { fs.writeFileSync(ROOT + '.tmp_tests/golden_run.json', JSON.stringify(run, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(GOLD, { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, locale: 'de-DE' });
// Math.random seeded before the game's first line (mulberry32): the same clouds, birds, villagers' choices each run
await page.addInitScript(() => { let a = 0x9e3779b9; Math.random = function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; });
const logs = [];
page.on('console', m => { if (m.type() === 'error') logs.push('[error] ' + m.text().slice(0, 400)); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto(DIST);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
// the game stepped by hand (the clock frozen, 33 ms a frame), drawn only for the pictures
const step = async (n, dt = 33) => { for (let k = 0; k < n; k += 20) await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(20, n - k), dt]); };
const settle = async (max = 50) => {
  let s = null;
  for (let i = 0; i < max; i++) {
    await step(20, 16);
    s = await ev(() => { const g = VR.game, w = g.world, p = g.player; if (!w || !p || g.state !== 'play') return { state: g.state }; const rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if (sc.dirty || sc.pending) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= rd * rd) dirty += n; } return { state: g.state, busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, lod: g.horizon ? g.horizon.inflight || 0 : 0 }; });
    if (G.settledOk(s, i)) { s.ok = true; break; }   // (f-quiet3: the condition in test/golden_wait.js, pinned by its node test)
    await wait(30);
  }
  return s;
};
const lookFrom = (P, T) => ev(([P, T]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(P[0], P[1] - (p.eye || 1.62), P[2]); p.vel[0] = p.vel[1] = p.vel[2] = 0; const e = p.eyePos(), dx = T[0] - e[0], dy = T[1] - e[1], dz = T[2] - e[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); p.viewYaw = p.yaw; }, [P, T]);
// every column within r of C loaded (settle alone counts the dirty sections of the columns there are: a picture taken
// before the far columns arrived had the lower half of the spawn black — run 2)
const loaded = async (C, r) => { for (let i = 0; i < 150; i++) { await step(10, 16); const ok = await ev(([C, r]) => { const w = VR.game.world; for (let dx = -r; dx <= r; dx += 16) for (let dz = -r; dz <= r; dz += 16) if (dx * dx + dz * dz <= r * r && !w.isLoaded(Math.floor(C[0] + dx), Math.floor(C[2] + dz))) return false; return true; }, [C, r]); if (ok) return true; await wait(30); } return false; };
// f-quiet3: ready until the world has settled — a settle that ran out of rounds returned an unsettled world (a section
// still meshing, far tiles in flight: under load the vista's foreground had a black hole, worst tile 0.337); now it
// keeps settling up to G.READY_MS of real time and the shot's note says when it never settled
let unsettled = false;
const ready = async (C, r = 48) => { await settle(30); await loaded(C, r); const t0 = Date.now(); let s = await settle(80); while (!(s && s.ok) && Date.now() - t0 < G.READY_MS) s = await settle(40); await step(20); s = await settle(20); for (let k = 0; k < 6 && !(s && s.ok); k++) s = await settle(40); unsettled = !(s && s.ok); return !unsettled; };
const freeze = () => ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.rain = 0; g.env.rainTarget = 0; g.hideHud = true; g.camMode = 0; g.settings.fov = 75; if (VR.Seasons && VR.Seasons.at && g.meta && g.meta.mode === 'creative' && (!g.settings.seasonPick || g.settings.seasonPick === 'auto')) g.settings.seasonPick = VR.Seasons.NAMES[VR.Seasons.at(g.env.day || 0, g.env.timeOfDay, -1).idx];   /* (f-polish8: the season held — the calendar's season of the frozen day, the same picture) */ const h = document.getElementById('hud'); if (h) h.style.display = 'none'; });
const preset = (p, rd) => ev(([p, rd]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = rd; g.settings.particles = false; g.applySettings('*'); }, [p, rd]);
async function trip(to) {
  await ev((to) => VR.Travel.go(VR.game, { dim: to, via: 'cmd' }), to);
  for (let i = 0; i < 600; i++) { await step(10, 33); const s = await ev(() => ({ st: VR.game.state, dim: VR.game.dim, busy: VR.Travel.busy(VR.game) })); if (s.dim === to && s.st === 'play' && !s.busy) return true; await wait(20); }
  return false;
}
// the world's picture from the canvas (animals and people not drawn: their walk differs run to run)
const grabGL = () => ev(() => {
  const g = VR.game, E = g.entities, V = g.villages, keep = [E && E.draw, E && E.drawTranslucent, V && V.draw];
  const P = g.particles, spawn0 = P && P.spawn;
  try {
    if (E) { E.draw = () => {}; if (E.drawTranslucent) E.drawTranslucent = () => {}; } if (V) V.draw = () => {};
    // the shader clock and the clouds' drift set: both run on with every stepped frame, and how many frames a settle
    // takes differs run to run (run 5: the Very Low pixel clouds over the spawn had moved, worst tile 0.34)
    g.env.anim = 600; g.env.cloudDrift = [540, 0];
    // (f-polish8: the fairy shot flickered in the tree's crown — its blossoms are sub-pixel voxels and the tree breathes
    // with the fairies' clock (frames played so far); fireflies, spring petals and sparks are particles whose number and
    // place follow how many frames a settle took: the fairies' clock set, no particle spawned or drawn in a picture)
    if (VR.Fairy && VR.Fairy.state) VR.Fairy.state.t = 0;
    if (P) { P.n = 0; P.count = 0; P.spawn = () => -1; }
    window.__norender = false; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); if (VR.Fairy && VR.Fairy.state) VR.Fairy.state.t = 0; if (P) { P.n = 0; P.count = 0; } }
    return g.renderer.gl.canvas.toDataURL('image/png');
  } catch (e) { return null; }
  finally { window.__norender = true; if (E) { E.draw = keep[0]; if (keep[1]) E.drawTranslucent = keep[1]; } if (V) V.draw = keep[2]; if (P) P.spawn = spawn0; }
});
const small = (buf) => sharp(buf).resize(CW, CH, { fit: 'fill' }).removeAlpha().raw().toBuffer();
// one shot: write it, compare it (or make it the reference)
async function judge(id, png, note) {
  const t = Date.now();
  if (unsettled) note = (note || '') + ' · UNSETTLED';   // (f-quiet3: the world never settled before this picture)
  if (!png) { check(false, `${id}: no picture (${note || ''})`); return; }
  const now = SHOTS + 'golden_' + id + '.png', ref = GOLD + id + '.png';
  try { fs.unlinkSync(SHOTS + 'golden_' + id + '_diff.png'); } catch (e) { /* none from an earlier run */ }
  fs.writeFileSync(now, png);
  if (UPDATE && (!UPD_IDS || UPD_IDS.includes(id))) { await sharp(png).resize(CW, CH, { fit: 'fill' }).removeAlpha().png({ compressionLevel: 9 }).toFile(ref);   // (the references at the comparison's size: ~0.1 MB a shot in git)
    run.shots[id] = { ref: 'written', note }; console.log(`  ⟳ ${id}: reference written (${note || ''})`); save(); return; }
  if (!fs.existsSync(ref)) { check(false, `${id}: no reference test/golden/${id}.png — run UPDATE=1 once`); return; }
  const a = await small(fs.readFileSync(ref)), b = await small(png);
  const s = S.compare(a, b, CW, CH, { ch: 3 }), bad = S.verdict(s, THR[id]);
  run.shots[id] = { y: +s.y.toFixed(4), c: +s.c.toFixed(4), tile: +s.tile.toFixed(4), tileAt: s.tileAt, bad, note, ms: Date.now() - t }; save();
  check(!bad.length, `${id}: luma ${s.y.toFixed(3)} · chroma ${s.c.toFixed(3)} · worst tile ${s.tile.toFixed(3)} [${s.tileAt}]${bad.length ? ' — ' + bad.join('; ') : ''} (${note || ''})`);
  if (bad.length) {   // the diff: reference | now | the SSIM map (white = alike, dark = different), each 320 × 180
    const m = Buffer.alloc(s.mw * s.mh); for (let i = 0; i < m.length; i++) m[i] = Math.max(0, Math.min(255, Math.round(255 * s.map[i])));
    const map = await sharp(m, { raw: { width: s.mw, height: s.mh, channels: 1 } }).resize(CW, CH, { kernel: 'nearest', fit: 'fill' }).toColourspace('srgb').png().toBuffer();
    const tile = (buf) => sharp(buf).resize(CW, CH, { fit: 'fill' }).png().toBuffer();
    await sharp({ create: { width: CW * 3 + 8, height: CH, channels: 3, background: { r: 200, g: 0, b: 60 } } })
      .composite([{ input: await tile(fs.readFileSync(ref)), left: 0, top: 0 }, { input: await tile(png), left: CW + 4, top: 0 }, { input: map, left: 2 * CW + 8, top: 0 }])
      .png().toFile(SHOTS + 'golden_' + id + '_diff.png');
    console.log('    diff → test/shots/golden_' + id + '_diff.png');
  }
}
const b64 = (u) => (u && u.length > 2000 ? Buffer.from(u.split(',')[1], 'base64') : null);
const timed = async (id, fn) => { if (!want(id)) return; const t = Date.now(); unsettled = false; try { await fn(); } catch (e) { check(false, `${id}: ${String(e && e.message || e).slice(0, 200)}`); } console.log(`    (${id} ${((Date.now() - t) / 1000).toFixed(0)} s, at ${secs()})`); };

// ---------------------------------------------------------------- the world
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await preset('potato', 5);
await ev(`VR.game.createWorld({name:'Golden',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a new world (seed 4242) at ' + secs());
await ev(() => { window.requestAnimationFrame = () => 0; });   // (the game is stepped by hand from here)
await freeze(); await ev(() => VR.game.env.setTime(5200));
const spawn = await ev(() => { const p = VR.game.player; return { pos: p.pos.slice(), yaw: p.yaw, pitch: p.pitch }; });
const cit = await ev(() => { const g = VR.game, gen = new VR.OverworldGen(g.meta.seed >>> 0, { vgen: g.meta.vgen || 3 }), p = g.player.pos, s = gen.nearestCitadel(p[0], p[2], 1500); return s ? { x: s.x, y: s.y, z: s.z, R: s.R, h: s.towers[0].h } : null; });
run.spawn = spawn; run.citadel = cit; console.log('  spawn ' + spawn.pos.map(Math.round) + ' · citadel ' + JSON.stringify(cit));
const atSpawn = async () => { await ev((s) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(s.pos[0], s.pos[1] + 14, s.pos[2]); p.vel[0] = p.vel[1] = p.vel[2] = 0; p.yaw = p.viewYaw = s.yaw + Math.PI; p.pitch = -0.12; }, spawn); await ready(spawn.pos); };
// the citadel from 90 m on the spawn's side, 30 m over its foot, looking at the middle of its towers
const citEye = cit ? (() => { const dx = spawn.pos[0] - cit.x, dz = spawn.pos[2] - cit.z, L = Math.hypot(dx, dz) || 1, d = Math.max(90, (cit.R || 30) + 60); return [cit.x + dx / L * d, cit.y + 30, cit.z + dz / L * d]; })() : null;
const atCitadel = async () => { await lookFrom(citEye, [cit.x, cit.y + Math.min(40, (cit.h || 40) * 0.5), cit.z]); await ready(citEye); };

for (const tag of ['vl', 'bal']) {
  const sfx = tag === 'vl' ? '_vl' : '';
  if (tag === 'bal') { await preset('balanced', 5); await freeze(); }
  await timed('vista' + sfx, async () => { await atSpawn(); await judge('vista' + sfx, b64(await grabGL()), 'spawn ' + spawn.pos.map(Math.round)); });
  await timed('citadel' + sfx, async () => { if (!cit) throw new Error('no citadel within 1500 m'); await atCitadel(); await judge('citadel' + sfx, b64(await grabGL()), 'eye ' + citEye.map(Math.round)); });
}
// ---------------------------------------------------------------- Balanced: the places
await timed('hud', async () => {   // f-ux: the HUD at spawn, as a player sees it (the page, not the GL canvas alone)
  await atSpawn();
  await ev(() => { const g = VR.game; g.hideHud = false; const h = document.getElementById('hud'); if (h) h.style.display = ''; const n = document.getElementById('notes'); if (n) n.style.visibility = 'hidden'; const f = document.getElementById('funkebub'); if (f) f.style.visibility = 'hidden'; });
  // f-quiet3: the calm HUD pinned — the ✨/⚔ pointers faded and no 🧭 hint card (f-quiet2: the pointers show for a few
  // real seconds for a new goal or after a long idle, a hint for 12 s: when the picture fell in one of those depended
  // on the machine's speed — run 5 had the pill, run 4 the hint card)
  const calm = () => ev(() => { const Q = VR.Quiet; if (Q && Q.pointers) for (const k in Q.pointers) { Q.pointers[k].until = -Infinity; Q.pointers[k].idled = true; } });
  await ev(() => { const Hn = VR.Hints; if (Hn && Hn.current && Hn.current() && Hn.dismiss) Hn.dismiss(); if (Hn && Hn.show && !Hn.__gold) { const os = Hn.show; Hn.show = function () { return VR.game && VR.game.__goldHud ? false : os.apply(this, arguments); }; Hn.__gold = true; } VR.game.__goldHud = true; });
  await step(20); await wait(500); await step(4);
  await calm(); await wait(1300); await step(4);   // (the HUD just shown is a new goal for the pointers: faded after it, 0.8 s)
  // f-quiet3: the world drawn here, at the spawn, before the page's picture — the stepped frames draw nothing, so the
  // canvas used to hold the shot before (a full run: the citadel's towers; ONLY=hud,…: whatever came last — the order
  // dependence)
  await grabGL();
  if (process.env.HUD_DEBUG) console.log('HUDDBG ' + JSON.stringify(await ev(() => { const el = document.getElementById('wcompass'), Q = VR.Quiet; return { cls: el && el.className, disp: el && el.style.display, goal: el && el.dataset.goal, txt: el && el.textContent, op: el && getComputedStyle(el).opacity, P: Q && Q.pointers ? JSON.stringify(Q.pointers.wcompass) : null, lvl: Q && Q.level ? Q.level() : null, hint: VR.Hints && VR.Hints.current ? String(VR.Hints.current()) : null }; })));
  const png = await page.screenshot({ type: 'png' });
  await ev(() => { const g = VR.game; g.hideHud = true; g.__goldHud = false; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; });
  await judge('hud', png, 'the HUD at spawn');
});
await timed('plaza', async () => {
  const site = await ev((P) => { let b = null; for (const s of VR.game.villages.sites) { const d = Math.hypot(s.x - P[0], s.z - P[2]); if (!b || d < b.d) b = { id: s.id, x: s.x, y: s.y, z: s.z, d }; } return b; }, spawn.pos);
  if (!site) throw new Error('no village');
  await lookFrom([site.x + 14, site.y + 12, site.z + 14], [site.x, site.y, site.z]); await settle(40);
  let P = null; for (let i = 0; i < 40 && !P; i++) { await step(20); P = await ev((id) => { const v = VR.game.villages.known.get(id); if (!v || !v.active) return null; const q = v.plan.plaza; return [q.x + 0.5, q.y, q.z + 0.5]; }, site.id); }
  if (!P) throw new Error('the village ' + site.id + ' did not come alive');
  await lookFrom([P[0] + 15, P[1] + 16, P[2] + 15], [P[0], P[1] + 1, P[2]]); await ready(P);
  await judge('plaza', b64(await grabGL()), site.id + ' plaza ' + P.map(Math.round));
});
await timed('fairy', async () => {
  let s = null;
  for (let i = 0; i < 30; i++) {
    s = await ev(() => (VR.Fairy && VR.Fairy.debug ? VR.Fairy.debug.sites() : []).find(x => x.kind === 'tree'));
    if (!s) throw new Error('no fairy tree');
    if (s.y !== null && await ev(() => VR.Fairy.debug.near()) === s.id) break;
    await ev((s) => { const p = VR.game.player; p.flying = true; p.teleport(s.x + 0.5, 150, s.z + 0.5); }, s); await settle(6); await step(20);
  }
  if (!s || s.y === null) throw new Error('the fairy tree did not settle');
  const a = s.yaw + 0.5, e = [s.x + Math.cos(a) * 30, s.y + 6, s.z + Math.sin(a) * 30];
  await loaded(e, 32);   // (run 2: topAt of a column not yet there put the eye somewhere over the clouds)
  const top = await ev((e) => VR.game.world.topAt(Math.floor(e[0]), Math.floor(e[2])), e);
  if (Number.isFinite(top) && top > 0 && Math.abs(top - s.y) < 40) e[1] = top + 5 + 1.62;
  await lookFrom(e, [s.x, s.y + 12, s.z]); await ready([s.x, s.y, s.z], 40);
  await judge('fairy', b64(await grabGL()), 'tree ' + [s.x, s.y, s.z].join(','));
});
await timed('starmap', async () => {
  const ok = await ev(() => VR.StarMap.open(VR.game)); if (!ok) throw new Error('the star map did not open');
  await step(3); await wait(300);
  await judge('starmap', b64(await ev(() => { VR.StarMap.st.dirty = true; VR.StarMap.frame(VR.game, 0.016); const c = document.getElementById('smCv'); return c ? c.toDataURL('image/png') : null; })), 'the map canvas, here selected');   // (page.screenshot waits for a compositor frame: minutes with the loop stepped by hand)
  await ev(() => VR.StarMap.close(VR.game)); await step(3);
});
await timed('cafe', async () => {
  if (!await trip('stn.ring')) throw new Error('no trip to the Ringstation');
  await freeze(); await ev(() => { VR.Stations.DECK_BUILD = 99; });
  await ev(() => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(-5.5, 65.4, 3.0); p.yaw = p.viewYaw = Math.atan2(9.5, -5.5); p.pitch = -0.16; });
  await settle(80); await step(20); await settle(20);
  await judge('cafe', b64(await grabGL()), 'the deck, toward the counter');
});
await timed('aqua', async () => {
  await preset('balanced', 4);
  if (!await trip('aqua')) throw new Error('no trip to Aquamarin');
  await freeze(); await ev(() => VR.game.env.setTime(4000));
  await settle(30);
  let T = null; for (let i = 0; i < 30 && !T; i++) { await step(20); T = await ev(() => { const s = VR.game.villages.sites.find(q => q.id === 'eco:aqua:0'); return s ? [s.x, s.y, s.z] : null; }); }
  if (!T) throw new Error("Aquamarin's town not found");
  await lookFrom([T[0] + 22, T[1] + 14, T[2] + 22], [T[0], T[1] + 2, T[2]]); await ready(T, 40);
  await judge('aqua', b64(await grabGL()), 'eco:aqua:0 ' + T.map(Math.round));
});

run.secs = (Date.now() - T0) / 1000; save();
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 20)) console.log(l);
check(!logs.some(l => /^\[pageerror\]/.test(l)), 'no page errors');
check(run.secs <= 360 || !!ONLY, `the run took ${run.secs.toFixed(0)} s (≤ 360 s)`);
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
