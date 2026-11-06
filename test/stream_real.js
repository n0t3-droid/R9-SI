// p-stream2 · fast flight with the REAL worker (node, no browser): the game's World and WorkerPool, one worker that runs
// the real worker code (src/worker/worker_main.js: generation with its town plans in slices, light, meshing) in this
// process, in virtual time — each job advances the worker's clock by its measured ms × K (K = the weaker PC: this node
// core makes a column in ~37 ms; K 1.2 ≈ a low-end laptop core with SLOW = 3). The far lane is modelled by a steady
// stream of 40 ms × K tile jobs (they take the far lane's share of the worker, as the horizon does in flight).
// Flies seed 1 (vgen 17) from the spawn in the four directions stream_low.mjs flies, and records every 100 ms:
//   real % of the cone ahead (the same polar 1/d grid as stream_low.mjs, inside the render distance; a shown column),
//   and the worker log: job kind, chunk, ms, queue age — the stretches with no real terrain are explained from it.
//   bash test/wt_run.sh stream_real.js 1200     ·  env: K (1.2) · SPEEDS (80) · RD (6) · DIRS (0,1,2,3) · SECS (24)
//   PROFILE=1: only the per-column generation cost along each path (no flight)
// Checks: at 80 m/s the cone ahead is ≥ 85 % real on Low (rd 6) and Very Low (rd 4) (mean of the directions' steady part);
// walking 5 m/s the columns coming into view are there within 1 s (p90).
// regress: skip  (a benchmark in measured time: under a loaded machine every job takes longer — run it alone)
const V = require('./load_shared.js');
global.window = undefined;
require('../src/main/gl.js'); require('../src/main/shaders.js'); require('../src/main/ultralite.js'); require('../src/main/renderer.js');
const K = +(process.env.K || 1.2);
const SIM = { now: 0, workers: [] };
// ---- the real worker, in this process
const WK = { out: null, later: null };
global.self = { postMessage: (m) => { WK.out.push(m); } };
const realSetTimeout = global.setTimeout;
require('../src/worker/worker_main.js');
const workerRun = (m) => {   // one turn of the worker: its answers and the turns it scheduled (a park: setTimeout 0)
  WK.out = []; WK.later = [];
  global.setTimeout = (f) => { WK.later.push(f); return 0; };
  const t0 = performance.now();
  try { self.onmessage({ data: m }); } finally { global.setTimeout = realSetTimeout; }
  return { ms: performance.now() - t0, out: WK.out, later: WK.later };
};
const LOG = [];
global.Worker = class {
  constructor() { this.inbox = []; this.free = 0; SIM.workers.push(this); }
  postMessage(m) { if (m && m.type) this.inbox.push({ m, at: SIM.now }); }
  terminate() {}
  // run the worker until the virtual clock: one task at a time, answers delivered when the task ends
  step() {
    while (this.inbox.length && this.free <= SIM.now) {
      const it = this.inbox.shift(), m = it.m;
      if (m.type === 'lodsim') { const ms = m.ms || 40; this.free = Math.max(this.free, SIM.now) + ms * K; this.deliver({ type: 'lodsim', id: m.id, ms }); LOG.push({ t: SIM.now, k: 'lod', ms: ms * K }); continue; }
      if (typeof m === 'function') { const r = workerRun0(m); this.after(r, { type: 'park' }, it); continue; }
      const r = workerRun(m);
      this.after(r, m, it);
    }
  }
  after(r, m, it) {
    const dt = r.ms * K;
    this.free = Math.max(this.free, SIM.now) + dt;
    LOG.push({ t: SIM.now, k: m.type === 'park' ? 'slice' : m.type, cx: m.cx !== undefined ? m.cx : m.ox !== undefined ? m.ox >> 4 : undefined, cz: m.cz !== undefined ? m.cz : m.oz !== undefined ? m.oz >> 4 : undefined, sy: m.sy, ms: dt, age: SIM.now - (it.at || SIM.now) });
    for (const o of r.out) this.deliver(o);
    for (const f of r.later) this.inbox.push({ m: f, at: SIM.now });
    SIM.pending.push({ at: this.free, f: () => {} });   // (the worker looks at its inbox again when the task ends)
  }
  deliver(o) { const w = this; const at = this.free; (SIM.pending || (SIM.pending = [])).push({ at, f: () => w.onmessage({ data: o }) }); }
};
function workerRun0(f) { WK.out = []; WK.later = []; global.setTimeout = (g) => { WK.later.push(g); return 0; }; const t0 = performance.now(); try { f(); } finally { global.setTimeout = realSetTimeout; } return { ms: performance.now() - t0, out: WK.out, later: WK.later }; }
global.Blob = class {}; global.URL = { createObjectURL: () => 'blob:x' };
require('../src/main/world.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const OPTS = { worldType: 'default', vgen: 17 };
const G = V.makeGen('overworld', 1, OPTS);
const SPAWN = process.env.SPAWN ? process.env.SPAWN.split(',').map(Number) : G.findSpawn();
const DIRS = (process.env.DIRS || '0,1,2,3').split(',').map(Number);
const yawOf = (si) => si * Math.PI / 2 + 0.35;
const hHalf = Math.atan(Math.tan(75 * Math.PI / 360) * 16 / 9), cosH = Math.cos(hHalf);
console.log(`spawn ${SPAWN.map(v => Math.round(v)).join(', ')} · K ${K}`);

if (process.env.PROFILE) {
  // the cost of the columns along each path (a 5-column wide corridor), per 80 m
  const g = V.makeGen('overworld', 1, OPTS);
  for (const si of DIRS) {
    const yaw = yawOf(si), fx = -Math.sin(yaw), fz = -Math.cos(yaw), seen = new Set(), seg = [];
    for (let s = 0; s <= 80 * (+process.env.SECS || 24); s += 8) for (let o = -2; o <= 2; o++) {
      const x = SPAWN[0] + fx * s - fz * o * 16, z = SPAWN[2] + fz * s + fx * o * 16, cx = Math.floor(x) >> 4, cz = Math.floor(z) >> 4, k = cx * 65536 + cz;
      if (seen.has(k)) continue; seen.add(k);
      const t0 = performance.now(); const col = g.generate(cx, cz); const ms = performance.now() - t0;
      let ne = 0; for (let i = 0; i < col.blocks.length; i++) if (col.blocks[i]) ne++;
      const b = Math.floor(s / 80); (seg[b] || (seg[b] = { n: 0, ms: 0, max: 0, solid: 0 })); seg[b].n++; seg[b].ms += ms; seg[b].max = Math.max(seg[b].max, ms); seg[b].solid += ne;
    }
    console.log(`dir ${si}: per 80 m (1 s at 80 m/s): columns · ms sum · max · blocks/col`);
    console.log(seg.map((x, i) => `  ${String(i * 80).padStart(5)} m  ${x.n} · ${x.ms.toFixed(0).padStart(5)} · ${x.max.toFixed(0).padStart(4)} · ${(x.solid / x.n / 1000).toFixed(1)}k`).join('\n'));
  }
  console.log('ALL OK'); process.exit(0);
}

// ---- the flight
function fly(o) {
  SIM.now = 0; SIM.workers.length = 0; SIM.pending = []; LOG.length = 0;
  const pool = new V.WorkerPool('', 1);
  pool.maxInflight = o.inflight || 2;   // (as game.js)
  pool.broadcast({ type: 'init', seed: 1, opts: OPTS });
  const renderer = { freeSection() {}, uploadSection() {}, q: { vxLod: o.rd <= 4 ? 8 : 12, upload: 2 } };
  const w = new V.World({ vents: null }, { dim: 'overworld', seed: 1, genOpts: OPTS, pool, renderer, renderDist: o.rd });
  if (o.setup) o.setup(w, pool);
  if (o.rd <= 5) { w.fancyLeaves = false; renderer.q.vxLod = 12; }   // (Very Low's mesher flags: game.js PRESETS.potato)
  w.streamPlan = true; w.viewCos = cosH;
  w.uploadQ.cpuEst = w.uploadQ.msPerByte = 1e-9;
  const fx = -Math.sin(o.yaw), fz = -Math.cos(o.yaw);
  w.viewDir = [fx, fz];
  let farQ = 0;
  const step = (x, y, z) => {
    w.update(x, y, z, SIM.now);
    // the far lane: tile jobs while flying (the horizon keeps a few queued)
    // (the horizon asks for ~5 tiles each time the camera has crossed a fifth of a 128-block tile, and the coarser levels
    // half as many each: about one 40 ms tile per 16 blocks of travel)
    if (o.far && o.flying && !o.farBusy) while (o.farOwed >= 16) { o.farOwed -= 16; farQ++; pool.submit({ type: 'lodsim', lane: 1 }, null, () => { farQ--; }, 0); }
    // p-stream3 · FARQ: the far lane as the browser's horizon keeps it in flight — always FARQ tiles asked for (its
    // maxInflight 4 + 2 per worker), each costing what the browser's log showed (stream_low.mjs, Low at 80 m/s: 448 tiles,
    // 23 ms mean in the worker: most 8–15 ms, a quarter ~40 ms, one in twenty 150–320 ms) — the far lane takes its whole
    // share of the worker, as in the browser.
    if (o.far && o.flying && o.farBusy && o.v >= 14) while (farQ < o.farBusy) { farQ++; const r = (o.farN = (o.farN || 0) + 1) * 0.6180339887 % 1; pool.submit({ type: 'lodsim', lane: 1, ms: r < 0.05 ? 150 + r * 3400 : r < 0.3 ? 40 : 11 }, null, () => { farQ--; }, 0); }
    pool.pump();
    const end = SIM.now + 33.3;
    while (true) {
      for (const wk of SIM.workers) wk.step();
      SIM.pending.sort((a, b) => a.at - b.at);
      if (!SIM.pending.length || SIM.pending[0].at > end) break;
      const p = SIM.pending.shift(); const keep = SIM.now; SIM.now = Math.max(SIM.now, p.at); p.f(); pool.pump(); SIM.now = keep > SIM.now ? keep : SIM.now;
    }
    SIM.now = end;
  };
  const x0 = SPAWN[0], z0 = SPAWN[2];
  o.flying = false;
  const settled = () => { if (pool.busy || w.pending.size) return false; const pcx = Math.floor(x0) >> 4, pcz = Math.floor(z0) >> 4, rd = w.renderDist; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.cols.get(V.ckey(pcx + dx, pcz + dz)); if (!c || c.shownAt < 0) return false; } return true; };
  for (let f = 0; f < 30 * 60 && !(f > 60 && f % 15 === 0 && settled()); f++) step(x0, G.surfaceY(Math.floor(x0), Math.floor(z0)) + 30, z0);   // the spawn settled (every column within the render distance shown)
  o.flying = true;
  const t0 = SIM.now, F = Math.round(o.secs * 30), rec = [];
  const pathY = (x, z) => G.surfaceY(Math.floor(x), Math.floor(z)) + (o.v <= 6 ? 2 : 35);
  const ent = new Map(), ttv = []; let missed = 0;
  let s = 0;
  for (let f = 0; f < F; f++) {
    s += o.v / 30; o.farOwed = (o.farOwed || 0) + o.v / 30 * (o.farK || 1);
    const x = x0 + fx * s, z = z0 + fz * s;
    step(x, pathY(x, z), z);
    if (f % 3) continue;
    // the cone ahead, as stream_low.mjs measures it (inside the render distance)
    let nr = 0, nw = 0;
    const rdB = w.renderDist * 16;
    for (let ai = 0; ai <= 10; ai++) {
      const a = -hHalf + 2 * hHalf * ai / 10, ca = Math.cos(a), sa = Math.sin(a), dx = fx * ca - fz * sa, dz = fx * sa + fz * ca;
      for (let d = 8; d <= rdB; d *= 1.12) { const c = w.cols.get(V.ckey(Math.floor(x + dx * d) >> 4, Math.floor(z + dz * d) >> 4)); nw += 1 / d; if (c && c.shownAt >= 0) nr += 1 / d; }
    }
    { // time to visible: the columns entering the cone inside the render distance (as stream_low.mjs)
      const rd = w.renderDist, pcx = Math.floor(x) >> 4, pcz = Math.floor(z) >> 4, seen = new Set();
      for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) {
        if (dx * dx + dz * dz > (rd + 0.5) * (rd + 0.5) || (Math.abs(dx) <= 1 && Math.abs(dz) <= 1)) continue;
        const ex = (pcx + dx) * 16 + 8 - x, ez = (pcz + dz) * 16 + 8 - z, d = Math.hypot(ex, ez);
        if ((ex * fx + ez * fz) / d < cosH) continue;
        const k = V.ckey(pcx + dx, pcz + dz), c = w.cols.get(k), sh = c && c.shownAt >= 0; seen.add(k);
        const e = ent.get(k); if (e === undefined) { ent.set(k, sh ? -1 : SIM.now); if (!sh && process.env.TTVDBG) console.log(`      enter ${((SIM.now - t0) / 1000).toFixed(1)}s ${dx},${dz} d ${Math.hypot(dx, dz).toFixed(1)} gen ${!!c} sec ${c ? c.sec.map(q => q.meshed ? 1 : q.pending ? 'p' : q.dirty ? 'd' : 0).join('') : ''}`); } else if (e >= 0 && sh) { ttv.push(SIM.now - e); ent.set(k, -1); if (process.env.TTVDBG && SIM.now - e > 900) console.log(`      late ${((SIM.now - t0) / 1000).toFixed(1)}s ${dx},${dz} ${Math.round(SIM.now - e)} ms`); }
      }
      for (const [k, e] of ent) if (!seen.has(k)) { if (e >= 0) missed++; ent.delete(k); }
    }
    rec.push({ t: (SIM.now - t0) / 1000, real: nr / nw, q0: pool.queue.length, lat: +(w.lat || 0).toFixed(2), pend: w.pending.size, want: w.lastWant, pos: [Math.floor(x) >> 4, Math.floor(z) >> 4] });
  }
  const steady = rec.filter(r => r.t >= 3);
  const real = steady.reduce((a, r) => a + r.real, 0) / Math.max(1, steady.length);
  // the worst 3 s window and what the worker did in it
  let worst = { real: 2, t: 0 };
  for (let i = 0; i + 30 <= rec.length; i += 5) { const m = rec.slice(i, i + 30).reduce((a, r) => a + r.real, 0) / 30; if (m < worst.real) worst = { real: m, t: rec[i].t }; }
  const ws = t0 + worst.t * 1000, we = ws + 3000, kinds = {};
  for (const L of LOG) if (L.t >= ws && L.t < we) { const k = kinds[L.k] || (kinds[L.k] = { n: 0, ms: 0, max: 0, age: 0 }); k.n++; k.ms += L.ms; k.max = Math.max(k.max, L.ms); k.age = Math.max(k.age, L.age || 0); }
  const heavy = LOG.filter(L => L.t >= ws && L.t < we && L.ms > 60).slice(0, 8).map(L => `${L.k} ${L.cx},${L.cz}${L.sy !== undefined ? '/' + L.sy : ''} ${L.ms.toFixed(0)}ms`);
  const gens = LOG.filter(L => L.t >= t0 && L.k === 'gen').length;
  const tot = {}; for (const L of LOG) if (L.t >= t0) tot[L.k] = Math.round((tot[L.k] || 0) + L.ms);
  if (process.env.VERBOSE) for (let sec = 0; sec < o.secs; sec++) {
    const a = t0 + sec * 1000, b = a + 1000, kk = {}; let idle = 1000;
    for (const L of LOG) if (L.t >= a && L.t < b) { kk[L.k] = (kk[L.k] || 0) + L.ms; idle -= L.ms; }
    const rr = rec.filter(x => x.t >= sec && x.t < sec + 1), last = rr[rr.length - 1] || {};
    const sh = rr.length ? Math.round(100 * rr.reduce((s2, x) => s2 + x.real, 0) / rr.length) : 0;
    const big = LOG.filter(L => L.t >= a && L.t < b && L.ms > 50).map(L => `${L.k}${L.cx !== undefined ? ' ' + L.cx + ',' + L.cz : ''}${L.sy !== undefined ? '/' + L.sy : ''}:${L.ms.toFixed(0)}`).slice(0, 5).join(' ');
    console.log(`   ${sec}s real ${sh}% q0 ${last.q0} lat ${last.lat} pend ${last.pend} want ${last.want} at ${last.pos} · ${Object.entries(kk).map(([k, v]) => k + ' ' + v.toFixed(0)).join(' · ')} · idle ${Math.max(0, idle).toFixed(0)} · ${big}`);
  }
  ttv.sort((a, b) => a - b);
  return { ttvP90: Math.round(ttv[Math.floor(ttv.length * 0.9)] || 0), ttvN: ttv.length, missed, tot, real: +(100 * real).toFixed(1), worst: { t: +worst.t.toFixed(1), real: +(100 * worst.real).toFixed(1), kinds: Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, `${v.n}× ${v.ms.toFixed(0)}ms max ${v.max.toFixed(0)} age ${(v.age / 1000).toFixed(1)}s`])), heavy }, gens, rec, lat: +(w.lat || 0).toFixed(2), share: +pool.farShare.toFixed(2) };
}
module.exports = { fly, SPAWN, yawOf, LOG };
if (require.main === module) {
  const SPEEDS = (process.env.SPEEDS || '80,5').split(',').map(Number), SECS = +(process.env.SECS || 24);
  const RDS = (process.env.RD || '6,4').split(',').map(Number);
  const res = {};
  const SP = V.StreamPlan, W0 = SP.worth;
  const corr = (W, cap) => () => { SP.REST = 1e9; SP.worth = function (ex, ez, ux, uz, sp, lat, cot) {
    if (!(sp >= SP.FAST)) return true; if (ex * ex + ez * ez <= SP.KEEP * SP.KEEP) return true;
    const a = ex * ux + ez * uz, l = Math.abs(ex * uz - ez * ux); if (l > W || a < -0.5) return false;
    return SP.timeLeft(ex, ez, ux, uz, sp / 16, cot) >= SP.WORTH * Math.min(lat, cap); }; };
  const EXP = { norest: () => { SP.REST = 1e9; }, c3: corr(+(process.env.W || 3.5), +(process.env.CAP || 0.8)) };
  EXP.nodet = (w) => { const wd = w.wantDetail.bind(w); w.wantDetail = function (c, sy, pos) { return !this.planFast && wd(c, sy, pos); }; const dr = w.detailReturn.bind(w); w.detailReturn = function (...a) { if (!this.planFast) dr(...a); }; };
  EXP.share5 = () => { SP.SHARE_MAX = 0.5; };
  EXP.share3 = () => { SP.SHARE_MAX = SP.SHARE_BASE; };
  EXP.share2 = () => { const s0 = SP.share; SP.share = (sp, lat, rd) => (sp >= 60 ? 0.2 : Math.min(SP.SHARE_BASE, s0(sp, lat, rd))); };
  EXP.reach = () => { SP.REACH = +(process.env.REACH || 3); };
  EXP.c3nd = (w) => { EXP.c3(w); const wd = w.wantDetail.bind(w); w.wantDetail = function (c, sy, pos) { return !this.planFast && wd(c, sy, pos); }; };
  for (const rd of RDS) for (const v of SPEEDS) for (const si of DIRS) {
    const r = fly({ rd, v, yaw: yawOf(si), secs: SECS, far: !process.env.NOFAR, farK: +(process.env.FARK || 1), farBusy: +(process.env.FARQ || 0), setup: EXP[process.env.EXP] });
    res[`${rd}_${v}_${si}`] = r;
    console.log(`rd ${rd} · ${v} m/s · dir ${si}: real ${r.real} % · ttv p90 ${r.ttvP90} ms (${r.ttvN}, missed ${r.missed}) · gens ${r.gens} · lat ${r.lat} · share ${r.share} · worker ms ${JSON.stringify(r.tot)} · worst 3 s at ${r.worst.t} s: ${r.worst.real} % ${JSON.stringify(r.worst.kinds)} ${r.worst.heavy.join(' | ')}`);
    console.log('   timeline (real % per s): ' + Array.from({ length: SECS }, (_, i) => { const a = r.rec.filter(x => x.t >= i && x.t < i + 1); return a.length ? Math.round(100 * a.reduce((s, x) => s + x.real, 0) / a.length) : '-'; }).join(' '));
  }
  if (process.env.JSON) require('fs').writeFileSync(process.env.JSON, JSON.stringify(Object.fromEntries(Object.entries(res).map(([k, r]) => [k, { real: r.real, gens: r.gens, tl: r.rec.map(x => +x.real.toFixed(3)) }]))));
  for (const rd of RDS) for (const v of SPEEDS) if (v >= 80) {
    const all = DIRS.map(si => res[`${rd}_${v}_${si}`].real), m = all.reduce((a, b) => a + b, 0) / all.length;
    check(m >= 85, `rd ${rd} · ${v} m/s: the cone ahead real ≥ 85 % (mean of the directions)`, all.join(' / ') + ' → ' + m.toFixed(1));
  }
  for (const rd of RDS) if (SPEEDS.includes(5)) { const p = DIRS.map(si => res[`${rd}_5_${si}`].ttvP90); check(Math.max(...p) <= 1000, `rd ${rd} · walking 5 m/s: the land coming into view is there within 1 s (p90)`, p.join(' / ') + ' ms'); }
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
}
