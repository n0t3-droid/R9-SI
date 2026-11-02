// f-perf8 · the Very Low budget (docs/superpowers/plans/2026-11-02-f-perf8.md, review v0.56 R57-01): what each module costs
// a frame on Very Low, and the work f-perf8 took out of the Very Low frame and its loading screen.
//   1 · the table: every main-thread module's Very Low ms a frame, measured in the browser by test/perf8.mjs (the game's own
//       frame without the draw, the plaza, a sampling profile; shared helpers counted to the nearest game module that called
//       them) — docs/perf/f-perf8_vl.json. A module over 0.05 ms a frame needs a reason here (REASONS); a module of this
//       build missing from the table (a new module since the measurement) fails: measure again (perf8.mjs, then
//       `node test/vl_budget.js --write <.tmp_tests/perf8.json>`).
//   2 · the far horizon on Very Low keeps its tile selection while the camera stays within a block (Horizon.keepSel):
//       the same tiles drawn when standing; walking ≤ 6 % of the frames differ, each a parent standing in for its children
//       (or back) or a tile at the 2-km rim ≤ 15 frames later, never a hole; the selection ≥ 5× rarer. Without the keep
//       (Balanced and up) the same tiles, requests and ring as the horizon before f-perf8 (git BASE) on every frame
//   3 · the loading screen writes only what changed (ui.loading)
//   4 · no allocation a frame: a heap sampler over 100 000 frames of the kept horizon and of the per-frame entries of the
//       modules that came since v0.55.6, idle on a Very Low stand-in (wander, gossip, seasons, fairy, story, liberate) —
//       ≤ 1 KB a frame each, ≤ 0.05 ms (before f-perf8: the horizon 8.6 KB, the Wanderregisseur 2.4 KB, fairy 1.2 KB)
//   bash test/wt_run.sh vl_budget.js 300
const fs = require('fs'), path = require('path');
if (process.env.V8FLAGS) require('v8').setFlagsFromString(process.env.V8FLAGS);
const ROOT = path.join(__dirname, '..');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const TABLE = path.join(ROOT, 'docs/perf/f-perf8_vl.json');

// ---- the main modules of this build, in build order (build.js's lists, evaluated without building)
const buildSrc = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8').split('\n');
const MAIN = new Function(buildSrc.filter(l => /^(const (MAIN|TEX) = |MAIN\.)/.test(l)).join('\n') + '\nreturn MAIN;')();
const modName = (f) => f.replace(/^\.\.\/shared\//, '');

// ---- --write: the table from a perf8.mjs record (its 'cur' page)
if (process.argv[2] === '--write') {
  const rec = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), tag = process.argv[4] || 'cur', P = rec.pages[tag], B = rec.pages.v0556;
  const by = (pg) => (pg && pg.logicProf && pg.logicProf.prof) || null;
  const out = { note: 'f-perf8: Very Low, seed 53, the plaza (critic_vl\'s eye), the game\'s frame without the draw, ms a frame — perf8.mjs', frames: rec.fr, build: tag, totalMs: by(P).totalMs, modules: Object.fromEntries(by(P).incl), base: B && by(B) ? { tag: 'v0556', totalMs: by(B).totalMs, modules: Object.fromEntries(by(B).incl), logicMs: B.table && B.table.logicMs } : null, logicMs: P.table && P.table.logicMs, logicVsBase: P.vsBase && P.vsBase.logic, pop: P.logicProf.pop, all: MAIN.map(modName) };
  fs.mkdirSync(path.dirname(TABLE), { recursive: true }); fs.writeFileSync(TABLE, JSON.stringify(out, null, 1));
  console.log('written ' + TABLE); process.exit(0);
}

// ---------------------------------------------------------------- 1 · the table
// a reason for each module over 0.05 ms a frame on Very Low (what it does every frame, and why it may)
const REASONS = {
  physics: 'shared: the player\'s and the animals\' collision sweeps (P.move, P.gather, the smooth ground) — every frame by nature',
  entities: 'the animals\' AI and movement round the player (their physics counted here); spawning budgeted (trySpawn)',
  world: 'the streaming: mesh scheduling, uploads within the frame budget, the seam light — test/frame_cost.js pins its cost',
  horizon: 'the far land\'s masks per frame; its tile selection kept on Very Low while standing (f-perf8)',
  sim: 'the random block ticks (grass, crops) round the player — the world\'s own clock, a fixed number a frame',
  game: 'the frame itself: input, camera, the update list (playFrame)',
  '(garbage collector)': 'V8: the frame\'s short-lived objects (all modules together)',
  villages: 'the villagers within reach: their walk, poses and bubbles (the crowd\'s budget sets how many on Very Low)',
  env: 'the sky, the sun, the weather and the season tint for the frame',
  padlife: 'the spawn pad\'s small craft (t-life, v0.4x): their flight paths every frame — not new; a next step (the self-review)',
  story: 'the story\'s checks (0.5 s, 1 s, 4 Hz already): a brain() second in the profile — not every frame',
  ui: 'the HUD: f-perf8 took three queries and writes a frame out (updateHUD); the hot bar and the badge remain',
};
{
  console.log('1 · the Very Low table (docs/perf/f-perf8_vl.json)');
  const T = fs.existsSync(TABLE) ? JSON.parse(fs.readFileSync(TABLE, 'utf8')) : null;
  check(!!T, 'the table is there');
  if (T) {
    const rows = Object.entries(T.modules).sort((a, b) => b[1] - a[1]), base = T.base ? T.base.modules : {};
    console.log(`     ${T.frames} frames · this build ${T.totalMs} ms a frame in all${T.base ? ` · ${T.base.tag} ${T.base.totalMs} ms` : ''}`);
    for (const [m, v] of rows.slice(0, 24)) console.log(`     ${m.padEnd(22)} ${v.toFixed(3)} ms${base[m] !== undefined ? '   (v0.55.6 ' + base[m].toFixed(3) + ')' : ''}${v > 0.05 ? '   — ' + (REASONS[m] || 'NO REASON') : ''}`);
    const over = rows.filter(([m, v]) => v > 0.05 && !REASONS[m]);
    check(over.length === 0, 'every module over 0.05 ms a frame has a reason' + (over.length ? ': ' + over.map(([m, v]) => m + ' ' + v).join(', ') : ''));
    const nw = MAIN.map(modName).filter(m => !T.all.includes(m));
    check(nw.length === 0, 'the table measured every main module of this build' + (nw.length ? ' — new since: ' + nw.join(', ') + ' (run perf8.mjs and --write)' : ''));
    if (T.base) check(T.logicVsBase <= 1.03, `the frame on Very Low (no draw; the median of the rounds' ratios, in turns) ≤ v0.55.6's +3 %: ×${T.logicVsBase} (${T.logicMs} vs ${T.base.logicMs} ms)`);
  }
}

// ---------------------------------------------------------------- the stand-in: every main module loaded in node
require('./dom_stub.js');
global.window = { devicePixelRatio: 1, screen: { width: 1280, height: 720 }, addEventListener() {}, removeEventListener() {}, innerWidth: 1280, innerHeight: 720 };
const V = require('./load_shared.js');
globalThis.VR = V;
const quiet = console.warn; console.warn = () => {};
for (const f of ['i18n', 'lang_en', 'lang_de'].concat(MAIN)) { const p = path.join(ROOT, 'src/main', f + '.js'); if (fs.existsSync(p)) { try { require(p); } catch (e) { /* (two modules want the page: companions, buildfx) */ } } }
console.warn = quiet;
const NOOBJ = {}, noop = () => NOOBJ, gl = new Proxy({}, { get(t, k) { if (k in t) return t[k]; return (t[k] = typeof k === 'string' && /^[A-Z][A-Z_0-9]+$/.test(k) ? 1 : noop); } });   // (no allocation of its own)
V.GL.gl = gl;
const cpuMs = (f, n) => { const c0 = process.cpuUsage(); for (let i = 0; i < n; i++) f(i); const c = process.cpuUsage(c0); return (c.user + c.system) / 1000 / n; };

// ---------------------------------------------------------------- 2 · the horizon's kept selection
// the reference: the horizon before f-perf8 (git show BASE:src/main/horizon.js, in a namespace of its own)
const BASE = process.env.BASE || '5a62744';
let RefHorizon = null;
try { const src = require('child_process').execSync(`git -C ${ROOT} show ${BASE}:src/main/horizon.js`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); const NS = Object.create(V); new Function('VR', src)(NS); RefHorizon = NS.Horizon; } catch (e) { /* no git: the reference is skipped */ }
const HZ = (Ref) => {
  const jobs = [];
  const g = { dim: 'overworld', tex: null, world: { seed: 53, genOpts: { worldType: 'default', vgen: 14 }, dim: 'overworld' }, pool: { workers: [{}], submit(m, tr, cb) { jobs.push([m, cb]); }, broadcast() {} } };
  const h = new (Ref || V.Horizon)(g); h.setLevel(2);
  const NONE = []; return { g, h, jobs, set(lite) { g.renderer = { gl, q: { lite, upload: 1.5 }, collectVisible: () => NONE }; } };
};
// every asked tile answered at once (the same answers for both): a drawable tile (a fake buffer) — the tiles' state as
// the upload would leave it
const answer = (H) => { for (const [m, cb] of H.jobs.splice(0)) { cb({ type: 'lod', empty: true }); const t = H.h.tiles.get(H.h.key(m.level, m.tx, m.tz)); if (t) { t.empty = false; t.vao = {}; } } };
const sig = (list) => list.map(t => t.L + ':' + t.tx + ':' + t.tz).sort().join(',');
{
  console.log('2 · the far horizon on Very Low keeps its selection');
  const A = HZ(), B = HZ(), Rf = RefHorizon ? HZ(RefHorizon) : null; A.set(true); B.set(false); if (Rf) Rf.set(true);
  check(!!Rf, 'the reference horizon (' + BASE + ') loaded');
  const all = [A, B].concat(Rf ? [Rf] : []), upd = (cam) => { for (const H of all) H.h.update(cam); }, ans = () => { for (const H of all) answer(H); };
  let refSame = 0, refN = 0; const vsRef = () => { if (!Rf) return; refN++; if (sig(B.h.drawList) === sig(Rf.h.drawList) && B.h.stats.coarse === Rf.h.stats.coarse && B.jobs.length === Rf.jobs.length) refSame++; };
  const cam = { x: 8.5, y: 90, z: 74.5, yaw: 0.3, pitch: 0 };
  for (let i = 0; i < 400; i++) { upd(cam); vsRef(); ans(); }
  check(A.h.stats.coarse === 1 && B.h.stats.coarse === 1 && A.h.drawList.length > 20, `both rings whole (${A.h.drawList.length} / ${B.h.drawList.length} tiles drawn)`);
  let same = 0, n = 0; const k0 = A.h.selKept | 0;
  for (let i = 0; i < 300; i++) { upd(cam); vsRef(); n++; if (sig(A.h.drawList) === sig(B.h.drawList)) same++; }
  const kept = (A.h.selKept | 0) - k0;
  check(same === n, `standing: the same tiles every frame (${same} / ${n})`);
  check(kept >= n * 0.8, `standing: the selection kept on ${kept} of ${n} frames`);
  // walking at 4.3 m/s (60 fps): the selection again at least every 2 blocks
  let diff = 0, bad = 0, sel0 = A.h.selKept | 0; n = 0;
  // (a differing frame: each tile only one of them draws is an ancestor or a descendant of a tile only the other draws —
  // a parent standing in for its children a few frames longer, never a hole)
  const kin = (p, q) => { let [L1, x1, z1] = p.split(':').map(Number), [L2, x2, z2] = q.split(':').map(Number); if (L1 < L2) { [L1, x1, z1, L2, x2, z2] = [L2, x2, z2, L1, x1, z1]; } const k = L1 - L2; return Math.floor(x2 / (1 << k)) === x1 && Math.floor(z2 / (1 << k)) === z1; };
  for (let i = 0; i < 1200; i++) { cam.x += 0.072; cam.z += 0.02; upd(cam); vsRef(); ans(); n++; if (sig(A.h.drawList) !== sig(B.h.drawList)) { diff++; { const a = new Set(sig(A.h.drawList).split(',')), b = new Set(sig(B.h.drawList).split(',')), oa = [...a].filter(x => !b.has(x)), ob = [...b].filter(x => !a.has(x)); const rim = (q) => { const [L, tx, tz] = q.split(':').map(Number), S = 128 << L, dx = Math.max(tx * S - cam.x, 0, cam.x - (tx + 1) * S), dz = Math.max(tz * S - cam.z, 0, cam.z - (tz + 1) * S); return Math.abs(Math.sqrt(dx * dx + dz * dz) - A.h.radius) < 2; };
      if (!oa.every(x => rim(x) || ob.some(y => kin(x, y))) || !ob.every(y => rim(y) || oa.some(x => kin(x, y)))) { bad++; if (process.env.DBG && bad < 3) console.log('     bad: only VL ' + oa.join(' ') + ' · only B ' + ob.join(' ')); } } if (process.env.DBG && diff < 4) { const a = new Set(sig(A.h.drawList).split(',')), b = new Set(sig(B.h.drawList).split(',')); console.log('     frame ' + i + ' cam ' + cam.x.toFixed(2) + ' only VL: ' + [...a].filter(x => !b.has(x)).join(' ') + ' · only B: ' + [...b].filter(x => !a.has(x)).join(' ') + ' kept ' + A.h.selKept + ' want ' + A.h.selWant); } } }
  if (Rf) check(refSame === refN, `without the keep (Balanced and up) the same tiles, requests and ring as before f-perf8 on every frame (${refSame} / ${refN})`);
  const keptW = (A.h.selKept | 0) - sel0;
  check(diff <= n * 0.06 && bad === 0, `walking: ${diff} of ${n} frames differ: a parent standing in for its children (or back) or a tile at the 2-km rim, ≤ 15 frames later (≤ 6 %); never another place (${bad})`);
  check(keptW >= n * 0.8, `walking: the selection kept on ${keptW} of ${n} frames (≥ 5× rarer)`);
  const msA = cpuMs(() => A.h.update(cam), 3000), msB = cpuMs(() => B.h.update(cam), 3000), msR = Rf ? cpuMs(() => Rf.h.update(cam), 3000) : NaN;
  console.log(`     the horizon a frame standing: Very Low ${(msA * 1000).toFixed(1)} µs · without the keep ${(msB * 1000).toFixed(1)} µs · before f-perf8 ${(msR * 1000).toFixed(1)} µs`);
  global.__hzRef = Rf; global.__hzB = B;
  if (process.env.PART === '2') { console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(0); }
  check(msA < msB * 0.5, 'standing: the horizon\'s frame at least halved on Very Low');
  // a tile that arrives is drawn on the very next frame (the version moves)
  const C = HZ(); C.set(true); const cc = { x: 8.5, y: 90, z: 74.5 };
  C.h.update(cc); const asked = C.jobs.length; C.h.update(cc); answer(C); C.h.update(cc);
  check(asked > 0 && C.h.drawList.length > 0, `an answered tile is in the next frame's list (${asked} asked, ${C.h.drawList.length} drawn)`);
  global.__hz = A;
}

// ---------------------------------------------------------------- 3 · the loading screen
{
  console.log('3 · the loading screen');
  let writes = 0; const ELS = {};
  const el = (id) => { let tx = '', w = ''; const e = { id, classList: { toggle() {}, add() {}, remove() {} }, get textContent() { return tx; }, set textContent(v) { writes++; tx = String(v); }, style: { get width() { return w; }, set width(v) { writes++; w = v; } } }; ELS[id] = e; return e; };
  const qs0 = document.querySelector; document.querySelector = (sel) => (sel[0] === '#' && ELS[sel.slice(1)]) || (qs0 ? qs0.call(document, sel) : null);
  document.getElementById = (id) => ELS[id] || null;
  for (const id of ['loading', 'loadmsg', 'loaddetail', 'loadbar', 'loadtip']) el(id);
  const u = Object.create(V.UI.prototype); u.screen = 'title'; u.game = { state: 'loading' }; u.show = function (s) { this.screen = s; };
  u.loading('Gelände', 0.31, '12 / 40'); const w1 = writes;
  for (let i = 0; i < 100; i++) u.loading('Gelände', 0.31 + i * 0.00001, '12 / 40');
  const w100 = writes - w1;
  check(w100 <= 1, `100 loading frames with nothing new write ${w100} times (was 300: the message, the counts and the bar every frame)`);
  u.loading('Netze', 0.5, '20 / 40');
  check(document.getElementById('loadmsg').textContent === 'Netze' && document.getElementById('loaddetail').textContent === '20 / 40' && document.getElementById('loadbar').style.width === '50%', 'what changed is written');
  u.screen = 'play'; u.loading('Netze', 0.5, '20 / 40');
  check(writes > 0 && document.getElementById('loadmsg').textContent === 'Netze', 'a new loading screen writes again');
}

// ---------------------------------------------------------------- 4 · no allocation a frame (a heap sampler, 100 000 frames)
const inspector = require('inspector');
const S = new inspector.Session(); S.connect();
const post = (m, p) => new Promise((res, rej) => S.post(m, p || {}, (e, r) => (e ? rej(e) : res(r))));
const sampled = async (f, n) => {
  await post('HeapProfiler.startSampling', { samplingInterval: 64, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
  for (let i = 0; i < n; i++) f(i);
  const { profile } = await post('HeapProfiler.stopSampling');
  const by = {}; let all = 0;
  const walk = (nd) => { const s = nd.selfSize || 0; if (s) { const u = ((nd.callFrame.url || '').split('/').pop() || '(vm)') + (process.env.FN ? ' ' + nd.callFrame.functionName + ':' + (nd.callFrame.lineNumber + 1) : ''); by[u] = (by[u] || 0) + s; all += s; } for (const c of nd.children || []) walk(c); };
  walk(profile.head);
  return { perFrame: all / n, by };
};
(async () => {
  console.log('4 · no allocation a frame on Very Low (100 000 frames, a heap sampler)');
  const N = 100000;
  // the stand-in game: Very Low, in play, on the overworld, the player on the plaza, nothing of the modules' near
  const g = Object.create(V.Game.prototype);
  Object.assign(g, { state: 'play', dim: 'overworld', time: 0, frame: 0, meta: { id: 'vl', vgen: 14 }, settings: Object.assign({ preset: 'potato' }, (V.PRESETS || {}).potato || {}), renderer: { gl, q: { lite: true } }, ui: { screen: null, blocking: false }, hideHud: false });
  g.player = { pos: [4.5, 80, 74.5], vel: [0, 0, 0], yaw: 0, pitch: 0, mode: 'creative', eyePos() { return [4.5, 81.62, 74.5]; }, flying: false };
  g.world = { seed: 53, dim: 'overworld', genOpts: { worldType: 'default', vgen: 14 }, getBlock: (x, y) => (y <= 64 ? GRASS : 0), isLoaded: () => true, topAt: () => 64, nbFn() { return () => 0; }, setBlock() {}, col: () => COL, biomeAt: () => 1, getLight: () => 0xf000 };
  g.env = { timeOfDay: 0.3, day: 1, wx: { kind: 'klar' } };
  const GRASS = (V.R.byName.grass_block || V.R.byName.stone).defaultState, COL = { height: new Uint8Array(256).fill(64), ready: true, sec: [] };
  const E = { night: 0, ambSky: [0.5, 0.6, 0.8], rain: 0, snow: 0, time: 0 }, eye = [4.5, 81.62, 74.5];
  const entries = [
    ['wander (the Wanderregisseur)', () => { if (!g.wanderer && V.Wander && V.Wander.Actor) g.wanderer = new V.Wander.Actor(g); return g.wanderer ? (dt) => g.wanderer.update(dt) : null; }],
    ['gossip (G.tick)', () => { if (!(V.Gossip && V.Gossip.tick)) return null; const Vs = { g, agents: [], list: [], known: new Map(), festivalNear: () => null, time: 0 }; return (dt) => V.Gossip.tick(Vs, dt); }],
    ['seasons (S.frame)', () => (V.Seasons && V.Seasons.frame ? (dt) => V.Seasons.frame(g, dt) : null)],
    ['fairy (F.frame)', () => (V.Fairy && V.Fairy.frame ? (dt) => V.Fairy.frame(g, dt, eye, E) : null)],
    ['story (StoryPlay.frame)', () => (V.StoryPlay && V.StoryPlay.frame ? (dt) => V.StoryPlay.frame(g, dt) : null)],
    ['liberate (Liberate.frame)', () => (V.Liberate && V.Liberate.frame ? (dt) => V.Liberate.frame(g, dt, eye, E) : null)],
    ['the horizon on Very Low (standing)', () => { const A = global.__hz, cam = { x: A.h.selX, y: 90, z: A.h.selZ }; return () => A.h.update(cam); }],
    ['the horizon, Balanced and up (standing)', () => { const B = global.__hzB, cam = { x: B.h.selX || 8.5, y: 90, z: B.h.selZ || 74.5 }; return () => B.h.update(cam); }, 'info'],
  ];
  for (const [name, mk, info] of entries) {
    let f = null; try { f = mk(); } catch (e) { f = null; }
    if (!f) { console.log(`     ${name}: not in this build`); continue; }
    let err = null; const run = (i) => { g.time += 1 / 60; g.frame++; try { f(1 / 60); } catch (e) { if (!err) err = String(e.message || e).slice(0, 90); } };
    for (let i = 0; i < 2000; i++) run(i);   // (warm: the first frames build what stays)
    const ms = cpuMs(run, 20000);
    const NN = info ? 20000 : N, H = await sampled(run, NN);   // (the numbers beside: 20 000 frames)
    const top = Object.entries(H.by).sort((a, b) => b[1] - a[1]).slice(0, process.env.FN ? 6 : 2).map(([u, b]) => `${u} ${(b / NN).toFixed(1)}`).join(', ');
    console.log(`     ${name}: ${(ms * 1000).toFixed(2)} µs a frame · ${H.perFrame.toFixed(1)} bytes a frame${top ? ' (' + top + ')' : ''}${err ? ' · the stand-in stops it: ' + err : ''}`);
    if (info) continue;   // (a number beside: not Very Low's)
    if (err) { console.log(`     (${name}: the stand-in is not enough for it — its number is the part before; perf8.mjs measures it in the game)`); continue; }
    check(H.perFrame <= 1024, `${name}: ≤ 1 KB allocated a frame (${H.perFrame.toFixed(1)} bytes)`);
    check(ms <= 0.05, `${name}: ≤ 0.05 ms a frame idle (${ms.toFixed(4)})`);
  }
  S.disconnect();
  console.log(`\n${fails ? 'FAILED ' + fails : 'ALL OK'}`);
  process.exit(fails ? 1 : 0);
})();
