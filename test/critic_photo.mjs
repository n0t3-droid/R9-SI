// regress: skip — the critic's free look through the 📷 Fotomodus (docs/process/SELF-REVIEW.md §2.6, review
// docs/reviews/v0.49.md): ten SEEDED random places of the release's new content, the same ones every review.
//   The candidates are the new content's anchors in the game's own land plan of seed 53 (vgen 12; test/load_shared.js):
//   the murmuration over the lighthouse's lake at dusk, the Himmelsrochen between the Sky Isles, the shoal under the
//   pier, a heron's pond, a flower field's butterflies, the deer meadow at dawn, the fox's hedge at dusk, Weißstadt's
//   porcelain hall street at night, the Spire Citadel's night lights from 630 m, the arrival vista at the golden hour, an
//   aurora night over Nova Haven, the rain's grey deck over the canyon, a shooting star, the Driftinseln through a gate.
//   PICK_SEED (4949) shuffles them and takes ten; the same PRNG sets each place's offset, turn, pitch and hour inside the
//   content's window. The places, poses and hours are written out, so the next review stands at the same ones.
//   At each place: the player there (the world streams, the animals come round the player), 25 s of play at the hour,
//   then F8 (the real key: the bindings' photo action) opens the 📷 mode, its camera is set to the pose, three frames
//   are drawn, and the mode's own shot (F2's path: renderer.capNext at 2×, a PNG through a download link) is saved.
//   → test/shots/critic_v0.49_photo_<nn>_<kind>.png, the sheet test/shots/critic_v0.49_photo_sheet.png, and
//     test/shots/critic_v0.49_photo.json (the picks, the poses, F8 opened or not, the photo's size and name, the
//     animals' report, the picture's lightness, spread and saturation)
// usage: R9_EXCLUSIVE=1 nohup bash test/wt_run.sh critic_photo.mjs 5400 > .tmp_tests/critic_photo.log 2>&1 &
//   PICK_SEED=4949 · SEED=53 · PRESET=balanced · W=1280 H=720 · ONLY=3,7 (pick numbers) · SIM=25 (s of play before a shot)
import { createRequire } from 'module';
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import fs from 'fs';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
const DIST = process.env.DIST || 'file://' + ROOT + 'dist/index.html';
const SEED = process.env.SEED || '53', PICK_SEED = +(process.env.PICK_SEED || 4949), PRESET = process.env.PRESET || 'balanced';
const VW = +(process.env.W || 1280), VH = +(process.env.H || 720), SIM = +(process.env.SIM || 25), DL_WAIT = +(process.env.DL_WAIT || 600);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
const EYE = 1.62, T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const r1 = (x) => Math.round(x * 10) / 10, r3 = (x) => Math.round(x * 1000) / 1000;
fs.mkdirSync(SHOTS, { recursive: true });
const rec = { dist: DIST, seed: SEED, pickSeed: PICK_SEED, preset: PRESET, size: [VW, VH], picks: [] };
const save = () => { try { fs.writeFileSync(SHOTS + 'critic_v0.49_photo.json', JSON.stringify(rec, null, 1)); fs.mkdirSync(ROOT + '.tmp_tests', { recursive: true }); fs.writeFileSync(ROOT + '.tmp_tests/critic_photo.json', JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };

// ---------------------------------------------------------------- the candidates (node: the game's own land plan of the seed)
const V = require(ROOT + 'test/load_shared.js');
const gen = V.makeGen('overworld', +SEED, { vgen: 12 }), LP = V.Land.plan(gen);
const site = (id) => LP.sites.find(s => s.id === id);
const vista = (id) => LP.vistas.find(v => v.id === id);
const pieces = (kind) => (LP.pieces || []).filter(p => p.kind === kind);
const bestWow = LP.vistas.filter(v => v.wow).sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))[0];
// mulberry32: the picks and every jitter
const prng = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rnd = prng(PICK_SEED), U = (a, b) => a + (b - a) * rnd(), pickOf = (arr) => arr[Math.floor(rnd() * arr.length) % arr.length];
// a candidate: kind, the German label, how the camera stands (x, z, feet: 'ground' | number, at), the hour window,
// the weather, extra (aurora night, a gate trip)
const C = [
  { kind: 'murmuration', de: 'Starenschwarm über dem See (Dämmerung)', mk: () => { const v = vista('v2'); return { x: v.eye[0] + U(-8, 8), z: v.eye[2] + U(-6, 10), feet: 'ground', at: [v.aim[0] + U(-30, 30), v.aim[1] + U(-10, 25), v.aim[2]], tod: Math.round(U(12000, 12700)) }; } },
  { kind: 'rays', de: 'Himmelsrochen zwischen den Inseln (Tag)', mk: () => { const v = vista(rnd() < 0.5 ? 'v3' : 'v10'); return { x: v.eye[0] + U(-6, 6), z: v.eye[2] + U(-6, 6), feet: 'ground', at: [v.aim[0] + U(-20, 20), v.aim[1] + U(-15, 15), v.aim[2] + U(-20, 20)], tod: Math.round(U(6500, 10000)) }; } },
  { kind: 'shoal', de: 'Fischschwarm unter dem Steg', mk: () => { const p = pieces('pier')[0], L = p.len * U(0.55, 0.95), ex = p.from[0] + p.dir[0] * L, ez = p.from[1] + p.dir[1] * L, sd = U(-2.5, 2.5); return { x: ex - p.dir[1] * sd, z: ez + p.dir[0] * sd, feet: p.y + 2.2, at: [ex + p.dir[0] * U(2, 6), p.y - 1.5, ez + p.dir[1] * U(2, 6)], tod: Math.round(U(5000, 8500)) }; } },
  { kind: 'heron', de: 'Reiher am Teich', mk: () => { const p = pickOf(pieces('pond')), a = U(0, Math.PI * 2), d = p.r + U(6, 10); return { x: p.x + Math.cos(a) * d, z: p.z + Math.sin(a) * d, feet: 'ground', at: [p.x, p.y + 0.5, p.z], tod: Math.round(U(4500, 9000)), pond: [p.x, p.z] }; } },
  { kind: 'butterflies', de: 'Falter auf dem Blumenfeld', mk: () => { const p = pickOf(pieces('flowers')), r = p.rect, x = U(r[0] + 1, r[2] - 1), z = U(r[1] + 1, r[3] - 1), a = U(0, Math.PI * 2); return { x, z, feet: 'ground', at: [x + Math.cos(a) * 12, p.y + U(0.5, 2.5), z + Math.sin(a) * 12], tod: Math.round(U(5000, 9500)), field: p.flower }; } },
  { kind: 'deer', de: 'Hirsche auf der Wiese (Morgengrauen)', mk: () => { const s = site(rnd() < 0.5 ? 'meadow_e' : 'cross_e'), a = U(0, Math.PI * 2); return { x: s.x + U(-12, 12), z: s.z + U(-12, 12), feet: 'ground', at: [s.x + Math.cos(a) * 40, 82, s.z + Math.sin(a) * 40], tod: Math.round(U(23000, 23900)) }; } },
  { kind: 'fox', de: 'Fuchs an der Hecke (Dämmerung)', mk: () => { const o = pickOf(pieces('orchard')), a = U(0, Math.PI * 2), d = U(14, 22); return { x: o.x + Math.cos(a) * d, z: o.z + Math.sin(a) * d, feet: 'ground', at: [o.x, o.y + 1, o.z], tod: Math.round(U(11800, 12600)) }; } },
  { kind: 'hall', de: 'Weißstadt: Porzellanboden bei Nacht', mk: () => ({ hall: { u: 0.5 + U(-1.5, 1.5), v: -24.5 + U(-5, 5), at: [0.5 + U(-2, 2), 40, 8] }, tod: Math.round(U(15500, 17500)) }) },
  { kind: 'citadel_night', de: 'Turmzitadelle bei Nacht aus 630 m', mk: () => { const v = vista('v1'); return { x: v.eye[0] + U(-6, 6), z: v.eye[2] + U(-6, 6), feet: 'ground', at: [v.aim[0] + U(-15, 15), v.aim[1] - U(30, 70), v.aim[2]], tod: Math.round(U(15500, 18500)) }; } },
  { kind: 'golden_vista', de: 'Ankunftsblick zur goldenen Stunde', mk: () => { const v = bestWow; return { x: v.eye[0] + U(-4, 4), z: v.eye[2] + U(-4, 4), feet: 'ground', at: [v.aim[0] + U(-15, 15), v.aim[1] - U(10, 50), v.aim[2]], tod: Math.round(U(10400, 11200)), vista: v.id }; } },
  { kind: 'aurora', de: 'Polarlicht über Nova Haven', mk: () => { const s = site('city_e') ? { x: 0, z: -140 } : { x: 0, z: -140 }; const x = s.x + U(-25, 25), z = s.z + U(-20, 20); return { x, z, feet: 'ground', at: [x + U(-30, 30), 82 + U(40, 90), z - 160], tod: Math.round(U(17500, 20500)), aurora: true }; } },
  { kind: 'rain_deck', de: 'Regen: graue Decke über dem Canyon', mk: () => { const s = site('canyon'); return { x: s.x + U(-10, 10), z: s.z + U(-10, 10), feet: 'ground', at: [-420, 140 + U(0, 60), 380], tod: Math.round(U(6000, 9000)), wx: 'regen' }; } },
  { kind: 'meteor', de: 'Sternschnuppe über dem Canyon', mk: () => { const s = site('canyon'); return { x: s.x + U(-10, 10), z: s.z + U(-10, 10), feet: 'ground', pitch: U(0.45, 0.8), yaw: U(-Math.PI, Math.PI), tod: 'meteor' }; } },
  { kind: 'drift', de: 'Driftinseln (durchs Tor)', mk: () => ({ dim: 'drift', yaw: U(-Math.PI, Math.PI), pitch: U(-0.1, 0.15), tod: Math.round(U(6000, 9500)) }) },
];
// shuffle (Fisher–Yates with the PRNG), take ten; then each one's pose from the same PRNG, in the shuffled order
const order = C.map((c, i) => i);
for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
let picks = order.slice(0, 10).map((ci, n) => { const c = C[ci], p = c.mk(); return Object.assign({ n: n + 1, kind: c.kind, de: c.de }, p); });
// (a trip to another world goes last: the way home must not hold the others up)
picks.sort((a, b) => (a.dim ? 1 : 0) - (b.dim ? 1 : 0) || a.n - b.n);
if (ONLY) picks = picks.filter(p => ONLY.includes(p.n));
rec.picks = picks.map(p => Object.assign({}, p));
console.log('picks (PICK_SEED ' + PICK_SEED + '): ' + picks.map(p => `${p.n} ${p.kind}`).join(' · '));
if (process.env.DRY) { for (const p of picks) console.log('  ' + JSON.stringify(p, (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v))); process.exit(0); }
save();

// ---------------------------------------------------------------- the page
const ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
const aimAt = (x, y, z, at) => { const dx = at[0] - x, dy = at[1] - y, dz = at[2] - z; return [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))]; };
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, locale: 'de-DE', acceptDownloads: true });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|missing|incomplete/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log('  !! the page crashed'); });
await page.goto(DIST);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title').catch(() => false)) break; }
await ev(() => { const r = VR.game.renderer; if (!r._render) { r._render = r.render; r.render = function (F) { if (window.__norender) { window.__F = F; this.setupCamera(F.cam); return; } return this._render(F); }; } });
const step = async (n, dtms = 33, draw = false) => { for (let k = 0; k < n; k += 10) { await ev(([m, d, draw]) => { const g = VR.game; window.__norender = !draw; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } window.__norender = true; }, [Math.min(10, n - k), dtms, draw]); await wait(4); } };
const boost = (on) => ev((on) => { const q = VR.game.renderer && VR.game.renderer.q; if (!q) return; if (on) { if (q.__up === undefined) q.__up = q.upload; q.upload = 24; } else if (q.__up !== undefined) { q.upload = q.__up; delete q.__up; } }, on);
const holdFar = (on) => ev((on) => { const pool = VR.game.pool; if (!pool || !pool.queueFar) return 0; if (on) pool.__heldFar = (pool.__heldFar || []).concat(pool.queueFar.splice(0)); else if (pool.__heldFar) { for (const j of pool.__heldFar) pool.queueFar.push(j); pool.__heldFar = null; pool.queueDirty = true; if (pool.pump) pool.pump(); } return 0; }, on);
const settle = async (maxS, farS = 0) => {
  let s = null, last = Infinity, stall = 0, nearAt = -1; const t0 = Date.now();
  await boost(true);
  for (let i = 0; ; i++) {
    await step(10);
    s = await ev(() => { const g = VR.game, w = g.world, p = g.player; if (!w || !p) return { none: true }; const rd = Math.max(1, (w.renderDist | 0) - 1), ri = Math.max(1, rd - 2), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if ((sc.dirty || sc.pending) && sc.count > 0) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= ri * ri) dirty += n; } let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } const h = g.horizon, f = h && h.far, fr = f && f.report ? f.report() : null; return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown, arr: w.arrivals ? w.arrivals.length : 0, hz: h ? h.inflight : 0, far: fr ? fr.inflight + fr.want : 0 }; });
    if (s.none) { if ((Date.now() - t0) / 1000 >= maxS) break; await wait(500); continue; }
    const shown = s.pend === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0 && s.arr === 0;
    stall = shown && s.dirty >= last ? stall + 1 : 0; last = s.dirty;
    const near = shown && ((s.busy === 0 && s.dirty === 0) || stall >= 6), el = (Date.now() - t0) / 1000;
    s.i = i; s.s = Math.round(el);
    if (near && i > 2) { if (nearAt < 0) nearAt = el; if (!farS || (s.hz === 0 && s.far === 0) || el - nearAt >= farS) break; }
    if (el >= maxS) break;
    await wait(60);
  }
  await boost(false);
  if (s) s.near = nearAt < 0 ? -1 : Math.round(nearAt);
  return s;
};
const groundY = (x, z) => ev(([x, z]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = 230; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & (F.OPAQUE | F.FLUID)) && !(R.T.flags[s] & F.LEAVES)) return y; } return 80; }, [x, z]);
// nothing solid round the eye (wow48.mjs's rule): up a block at a time, else back along the view
const clearEye = (x, y, z, yaw, pitch, need) => ev(([x, y, z, yaw, pitch, need]) => {
  const w = VR.game.world, R = VR.R, F = VR.F;
  const fl = (x, y, z) => { const s = w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return s ? R.T.flags[s] : 0; };
  const cp = Math.cos(pitch), dx = -Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = -Math.cos(yaw) * cp, hx = Math.hypot(dx, dz) || 1;
  const box = (x, y, z) => { for (const b of [-0.6, 0, 0.9]) for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) if (fl(x + a * 0.9, y + b, z + c * 0.9) & F.SOLID) return false; return true; };
  const ray = (x, y, z) => { for (let t = 0.5; t <= need; t += 0.25) if (fl(x + dx * t, y + dy * t, z + dz * t) & (t <= 2.5 ? F.SOLID : F.OPAQUE | F.LEAVES)) return false; return true; };
  for (let back = 0; back <= 12; back += 2) { const bx = x - dx / hx * back, bz = z - dz / hx * back; for (let up = 0; up <= 24; up++) if (box(bx, y + up, bz) && ray(bx, y + up, bz)) return { x: bx, y: y + up, z: bz, up, back }; }
  return { x, y, z, up: 0, back: 0, stuck: true };
}, [x, y, z, yaw, pitch, need]);
// the world: the preset as a player gets it (the dynamic resolution off: the same pixels every time), a new default world
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.applySettings('*'); }, PRESET);
await ev((seed) => VR.game.createWorld({ name: 'Kritik Foto', mode: 'creative', difficulty: 'peaceful', type: 'default', seed, cheats: true, kit: true }), SEED);
for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state).catch(() => '') === 'play') break; }
const okWorld = await ev(() => VR.game.state) === 'play';
check(okWorld, `a new default world on ${PRESET} (${secs()})`);
await ev(() => {
  const g = VR.game; g.zenFreezeTime = true; g.settings.wowMoments = false;
  if (g.arrival && g.arrival.skip) { try { g.arrival.skip(); } catch (e) { /* none */ } }
  window.requestAnimationFrame = () => 0;
  if (VR.UIPrefs) VR.UIPrefs.set({ pro: true });
  const ui = VR.game.ui, cl = ui.chatLine.bind(ui); window.__lines = []; ui.chatLine = (t, c) => { window.__lines.push(String(t)); return cl(t, c); };
  if (!document.getElementById('__nohint')) { const st = document.createElement('style'); st.id = '__nohint'; st.textContent = '#hint,#hints,#lockhint{display:none !important}'; document.head.appendChild(st); }
});
rec.info = await ev(() => { const g = VR.game; return { vgen: g.meta && g.meta.vgen, preset: g.settings.preset, rd: g.settings.renderDist, wx: g.env.wx ? g.env.wx.seed : null }; });
// an aurora night for this world (sky3.js: the night of day n has one when S3.auroraNight(seed, n) > 0)
const auroraDay = await ev(() => { const S3 = VR.Sky3, s = VR.game.env.wx ? VR.game.env.wx.seed : 0; if (!S3 || !S3.auroraNight) return null; for (let n = 1; n < 80; n++) if (S3.auroraNight(s, n) > 0) return n; return null; });
rec.auroraDay = auroraDay;
const stat = async (path) => { const { data, info } = await sharp(path).resize(640).raw().toBuffer({ resolveWithObject: true }); let s = 0, s2 = 0, sat = 0, n = 0; for (let i = 0; i < data.length; i += info.channels) { const r = data[i], g = data[i + 1], b = data[i + 2], L = 0.2126 * r + 0.7152 * g + 0.0722 * b, mx = Math.max(r, g, b), mn = Math.min(r, g, b); s += L; s2 += L * L; sat += mx ? (mx - mn) / mx : 0; n++; } const m = s / n; return { L: r1(m), sd: r1(Math.sqrt(Math.max(0, s2 / n - m * m))), sat: r3(sat / n) }; };

// ---------------------------------------------------------------- each place
for (const P of picks) {
  const t1 = Date.now(), out = { n: P.n, kind: P.kind };
  rec.picks[rec.picks.findIndex(q => q.n === P.n)].result = out;
  console.log(`\n${P.n} · ${P.kind} — ${P.de} (${secs()})`);
  try {
    let x, z, feet, yaw, pitch, fov = 70, tod = P.tod;
    if (P.dim) {
      // a gate's trip (the travel command: the same trip as a gate's veil): there, the arrival point and a seeded turn
      await ev((d) => VR.game.chat('/dim ' + d), P.dim);
      for (let i = 0; i < 300; i++) { await step(3); const st = await ev(() => ({ state: VR.game.state, dim: VR.game.dim })); if (st.state === 'play' && st.dim === P.dim) break; await wait(200); }
      await settle(200, 10);
      const p0 = await ev(() => VR.game.player.pos.slice()); x = p0[0]; z = p0[2]; feet = p0[1]; yaw = P.yaw; pitch = P.pitch;
      out.dim = await ev(() => VR.game.dim);
    } else if (P.hall) {
      const s0 = await ev(() => { try { const W = VR.game.world, VG = VR.VillageGen, og = new VR.OverworldGen(W.seed, W.genOpts); const s = VG.site(og, -2, -1); if (!s) return null; const Pl = VG.plan(og, s), h = Pl.hall || null; return h ? { x: s.x, z: s.z, r: h.r, F: h.F } : { x: s.x, z: s.z, r: (s.seed >>> 3) & 3, F: s.y }; } catch (e) { return { err: String(e.message || e) }; } });
      const S = s0 && !s0.err ? s0 : { x: -944, z: -296, r: 3, F: 73 };
      const q = ROT[S.r](P.hall.u, P.hall.v), t = ROT[S.r](P.hall.at[0], P.hall.at[1]);
      x = S.x + q[0]; z = S.z + q[1]; feet = S.F + 1; [yaw, pitch] = aimAt(x, feet + EYE, z, [S.x + t[0], S.F + 1 + P.hall.at[2], S.z + t[1]]); fov = 66;
    } else { x = P.x; z = P.z; }
    if (!P.dim) {
      await ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 170, z); }, [x, z]);
      await holdFar(true); const s0 = await settle(220, 0); await holdFar(false);
      if (feet === undefined) feet = typeof P.feet === 'number' ? P.feet : (await groundY(x, z)) + 1;
      if (yaw === undefined) { if (P.at) [yaw, pitch] = aimAt(x, feet + EYE, z, P.at); else { yaw = P.yaw; pitch = P.pitch; } }
      if (P.pitch !== undefined && !P.at) pitch = P.pitch;
      const C2 = await clearEye(x, feet + EYE, z, yaw, pitch, 5);
      if (C2.up || C2.back) { out.moved = { up: C2.up, back: C2.back }; x = C2.x; z = C2.z; feet = C2.y - EYE; if (P.at) [yaw, pitch] = aimAt(x, feet + EYE, z, P.at); }
      out.settle0 = s0 && s0.s;
    }
    // the hour (a shooting star: the next seeded one, at the middle of its flight), the night (an aurora night), the weather
    const hour = await ev(([tod, aur, auroraDay, wx]) => {
      const g = VR.game, E = g.env;
      if (aur && auroraDay) E.day = auroraDay;
      let dir = null;
      if (tod === 'meteor' && VR.Sky3 && VR.Sky3.meteorNext) {
        // the next seeded shooting star after 15 000 (a dark sky), held at the middle of its flight; the camera looks at it
        const s = E.wx ? E.wx.seed : 0; let A0 = (E.day | 0) * 24000 + 15000, m = null;
        for (let k = 0; k < 40 && !m; k++) { const q = VR.Sky3.meteorNext(s, A0, 2); const tq = q ? ((q.A % 24000) + 24000) % 24000 : 0; if (q && tq > 14000 && tq < 21500) m = q; else A0 = q ? q.A + 40 : A0 + 3200; }
        if (m) { const A = m.A + m.dur * 20 * 0.5; E.day = Math.floor(A / 24000); tod = A - E.day * 24000; const a = m.from, b = m.to; dir = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; } else tod = 17000;
      }
      E.setTime(tod);
      if (E.wx && E.wx.force) E.wx.force(wx || 'klar');
      if (!wx) { E.rain = 0; E.rainTarget = 0; }
      return { tod: Math.round(tod * 10) / 10, day: E.day, dir };
    }, [tod, !!P.aurora, auroraDay, P.wx || null]);
    out.hour = hour;
    if (hour.dir) { const d = hour.dir, l = Math.hypot(d[0], d[1], d[2]) || 1; yaw = Math.atan2(-d[0], -d[2]); pitch = Math.asin(Math.max(-1, Math.min(1, d[1] / l))) * 0.85; }
    await ev(([x, y, z, yaw, pitch]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = yaw; p.pitch = pitch; p.viewYaw = yaw; p.vel = [0, 0, 0]; }, [x, feet, z, yaw, pitch]);
    const s1 = await settle(200, 25); out.settle1 = s1 && s1.s;
    // 25 s of play at the hour (the hour held): the animals come and move, the weather settles
    await ev((tod) => { VR.game.env.setTime(tod); }, hour.tod);
    await step(Math.round(SIM * 30));
    await ev((tod) => { VR.game.env.setTime(tod); }, hour.tod);
    // F8 — the photo action's second key
    await page.keyboard.down('F8'); await step(1, 33, true); await page.keyboard.up('F8'); await step(1, 33, true);
    out.f8 = await ev(() => !!(VR.game.photoCam && VR.game.photoCam.on));
    if (!out.f8) { await ev(() => VR.game.photoMode(true)); out.fallback = await ev(() => !!(VR.game.photoCam && VR.game.photoCam.on)); }
    await ev(([x, y, z, yaw, pitch, tod, fov]) => { const g = VR.game, c = g.photoCam; if (!c || !c.s) return; c.s.x = x; c.s.y = y; c.s.z = z; c.s.yaw = yaw; c.s.pitch = pitch; c.s.roll = 0; c.s.vel = [0, 0, 0]; c.held = tod; g.settings.fov = fov; }, [x, feet + EYE, z, yaw, pitch, hour.tod, fov]);
    await step(3, 33, true);
    out.wild = await ev(() => { try { const r = VR.game.wild && VR.game.wild.report ? VR.game.wild.report() : null; if (!r) return null; return { on: r.on, murm: r.murm && { n: r.murm.n, state: r.murm.state, spread: r.murm.spread }, gulls: r.gulls, herons: r.herons.length, fish: r.fish, carp: r.carp, swarms: r.swarms.length, dflies: r.dflies, rays: r.rays.length, rabbits: r.rabbits.length, fox: r.fox && r.fox.state, drifts: r.drifts }; } catch (e) { return { err: String(e.message || e) }; } });
    out.sky = await ev(() => { const s = VR.game.env.E && VR.game.env.E.sky3; return s ? { aurora: +(s.aurora || 0).toFixed(2), meteor: !!s.meteor } : null; });
    // the mode's own shot: renderer.capNext at 2×, the PNG through the download link. On a loaded machine the 2× frame and
    // the PNG take minutes (v0.49's review: the downloads came 2–5 min after the click, after a 120-s wait had given up —
    // the files were rescued from Playwright's temporary folder), so the page's own blob (PhotoMode.last.url, revoked after
    // 60 s) is read as soon as it is there; the download still happens as a player gets it
    const before = await ev(() => (VR.PhotoMode && VR.PhotoMode.last ? VR.PhotoMode.last.name : null));
    const dl = page.waitForEvent('download', { timeout: DL_WAIT * 1000 }).catch(() => null);
    const tShot = Date.now();
    await ev(() => { const c = VR.game.photoCam; if (c && c.on) c.shoot(); });
    await step(1, 33, true);
    const path = SHOTS + `critic_v0.49_photo_${String(P.n).padStart(2, '0')}_${P.kind}.png`;
    let L = null;
    for (;;) {
      L = await ev(() => (VR.PhotoMode && VR.PhotoMode.last ? { name: VR.PhotoMode.last.name, url: VR.PhotoMode.last.url, w: VR.PhotoMode.last.w, h: VR.PhotoMode.last.h, bytes: VR.PhotoMode.last.bytes } : null)).catch(() => null);
      if (L && L.name !== before) break;
      if (Date.now() - tShot > DL_WAIT * 1000) { L = null; break; }
      await wait(2000);
    }
    if (L) {
      const b64 = await ev(async (url) => { const r = await fetch(url); const u8 = new Uint8Array(await r.arrayBuffer()); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }, L.url).catch(() => null);
      if (b64) { fs.writeFileSync(path, Buffer.from(b64, 'base64')); out.file = path.replace(ROOT, ''); out.name = L.name; }
    }
    out.shotS = Math.round((Date.now() - tShot) / 1000);
    out.last = L && { name: L.name, w: L.w, h: L.h, bytes: L.bytes };
    if (out.file && fs.existsSync(path)) out.pic = await stat(path);
    dl.then((d) => { if (d) out.downloaded = d.suggestedFilename(); });
    check(!!out.file && !!out.last && out.last.w >= VW * 1.5, `${P.n} ${P.kind}: the 📷 shot saved (${out.last ? out.last.w + '×' + out.last.h + ', ' + Math.round(out.last.bytes / 1024) + ' KB' : 'none'} after ${out.shotS} s; F8 ${out.f8 ? 'opened the mode' : 'did NOT open the mode'})`);
    // out of the mode (Escape, as a player leaves it)
    await page.keyboard.down('Escape'); await step(1); await page.keyboard.up('Escape'); await step(1);
    if (await ev(() => !!(VR.game.photoCam && VR.game.photoCam.on))) await ev(() => VR.game.photoMode(false));
    out.pose = { x: r1(x), feet: r1(feet), z: r1(z), yaw: r3(yaw), pitch: r3(pitch), fov };
    out.s = Math.round((Date.now() - t1) / 1000);
    console.log(`  ${JSON.stringify({ pose: out.pose, hour: out.hour, f8: out.f8, wild: out.wild, sky: out.sky, pic: out.pic, s: out.s })}`);
  } catch (e) { out.err = String(e.stack || e.message || e).slice(0, 500); check(false, `${P.n} ${P.kind}: ${out.err}`); }
  save();
}
const errs = logs.filter(l => l.startsWith('[pageerror]'));
check(errs.length === 0, `no page error (${errs.length})` + (errs.length ? ': ' + errs[0].slice(0, 300) : ''));
rec.errors = logs.slice(0, 40);
await ctx.close().catch(() => {}); await browser.close();

// the sheet: two columns, a label over each photo
try {
  const rows = rec.picks.filter(p => p.result && p.result.file).map(p => ({ file: ROOT + p.result.file, label: `${p.n} ${p.de} · ${p.result.hour ? 'Uhr ' + p.result.hour.tod : ''} · F8 ${p.result.f8 ? 'ja' : 'nein'}` }));
  fs.writeFileSync(ROOT + '.tmp_tests/critic_photo_sheet.json', JSON.stringify(rows));
  const py = `import json,sys\nfrom PIL import Image, ImageDraw\nR=json.load(open(sys.argv[1]));W,H=800,450;cols=2;rows=(len(R)+1)//2\nout=Image.new('RGB',(W*cols+12,(H+26)*max(1,rows)),(14,14,20));d=ImageDraw.Draw(out)\nfor i,r in enumerate(R):\n  x=(i%cols)*(W+12);y=(i//cols)*(H+26);d.text((x+6,y+6),r['label'],fill=(240,240,245))\n  try: im=Image.open(r['file']).convert('RGB').resize((W,H)); out.paste(im,(x,y+26))\n  except Exception as e: d.text((x+6,y+40),str(e),fill=(255,120,120))\nout.save(sys.argv[2])\n`;
  fs.writeFileSync(ROOT + '.tmp_tests/critic_photo_sheet.py', py);
  execSync(`python3 -I ${ROOT}.tmp_tests/critic_photo_sheet.py ${ROOT}.tmp_tests/critic_photo_sheet.json ${SHOTS}critic_v0.49_photo_sheet.png`);
  console.log('  sheet test/shots/critic_v0.49_photo_sheet.png');
} catch (e) { console.log('  (no sheet: ' + String(e.message || e).slice(0, 200) + ')'); }
save();
console.log(`\n${fails ? 'FAILED ' + fails : 'ALL OK'} (${secs()})`);
process.exit(fails ? 1 : 0);
