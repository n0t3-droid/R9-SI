// u-folk3 · the circle dance in the villages' simulation (plan docs/superpowers/plans/2026-11-01-u-folk3.md §2):
// the first village of Aquamarin and Ocker (bgen 3, seed 4242: a monument in the plaza's middle, natives.js loaded —
// its „make room" after a talk sent the dancers 8 m away: 1 of 6 danced in u-folk2's run) and Herzwelt's Nova Haven
// (folk2_walk.js's town) on their generated blocks; villages + folklife + folkjoy + worldlife + natives + folk3 at 30 Hz,
// the afternoon. The player stands 3.5 m off the plaza's middle; the nearest grown-up invites, [use] takes it; then
//   · ≥ 5 in the ring (or all when fewer came) within 15 s, everyone in it on open ground (no wall, no monument)
//   · the ring's neighbours near enough to hold hands, everyone facing the middle
// F3OFF=1 runs it without folk3.js (the bug as it was).   usage: bash test/wt_run.sh folk3_dance.js 600
require('./dom_stub.js');
const V = require('./load_shared.js');
globalThis.VR = V;
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
require('../src/shared/smoothvox.js'); require('../src/shared/folksmooth.js');
for (const f of ['voxmodels', 'villagers', 'folkmodel', 'villages', 'folklife', 'festival', 'folkjoy', 'worldlife', 'natives']) require('../src/main/' + f + '.js');
if (!process.env.F3OFF) require('../src/main/folk3.js');
const VG = V.VillageGen, Vs = V.Villages, FJ = V.FolkJoy, R = V.R, F = V.F;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const SEED = 4242;

function worldOf(gen) {
  const cols = new Map();
  const col = (cx, cz) => { const k = cx * 65536 + cz; let c = cols.get(k); if (!c) { const ch = gen.generate(cx, cz); c = { b: ch.blocks, h: ch.height }; cols.set(k, c); } return c; };
  return {
    getBlock(x, y, z) { if (y < 0 || y > 255) return 0; const c = col(x >> 4, z >> 4); return c.b[(y << 8) | ((z & 15) << 4) | (x & 15)]; },
    isLoaded() { return true; },
    nbFn() { return this._nb || (this._nb = (x, y, z, d) => this.getBlock(x + V.HF_DX[d], y, z + V.HF_DZ[d])); },
    topAt(x, z) { const c = col(x >> 4, z >> 4); if (c.h) return c.h[((z & 15) << 4) | (x & 15)]; for (let y = 200; y > 0; y--) if (this.getBlock(x, y, z)) return y; return 64; },
    setBlock() {}, getLight() { return 0xf000; },
  };
}
function dance(name, world, sum) {
  let rs = 11; const r0 = Math.random; Math.random = () => { rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0; return rs / 4294967296; };
  try {
    const pz = sum.plaza, C = [pz.x + 0.5, pz.y, pz.z + 0.5];
    const player = { pos: [C[0] + 2.5, pz.y, C[2] + 2.5], vel: [0, 0, 0], onGround: true, flying: false, mode: 'creative', yaw: 0, pitch: 0,
      eyePos() { return [this.pos[0], this.pos[1] + 1.62, this.pos[2]]; }, lookDir() { return [0, 0, -1]; }, inv: { add() { return true; } } };
    const g = { world, player, env: { timeOfDay: 7400, day: 1, rain: 0 }, settings: { preset: 'balanced', toasts: false }, meta: {}, entities: { mobs: [] },
      particles: new Proxy({}, { get: () => () => {} }), audio: { play() {}, tone() {} }, ui: { chatLine() {}, toast() {} }, codex: null, pool: { direct() {} }, mp: null, folkBase: 100 };
    const mgr = Object.create(Vs.prototype);
    Object.assign(mgr, { g, meta: g.meta, known: new Map(), pending: new Set(), agents: [], sites: [], siteT: 1e9, siteAt: [player.pos[0], player.pos[2]], doors: new Map(), selfEdit: false, pathBudget: 0, time: 0, bubs: [] });
    mgr.meta.villages = mgr.meta.villages || {}; mgr.st = mgr.meta.villages; mgr.updateBubbles = () => {}; mgr.chirp = () => {}; mgr.talkText = () => {};
    mgr.joyTier = () => 2;
    mgr.addVillage(sum);
    const dt = 1 / 30;
    for (let f = 0; f < 240; f++) mgr.update(dt);
    const vil = mgr.agents[0] && mgr.agents[0].vil;
    if (!vil) { check(false, name + ': the village lives'); return; }
    // the nearest grown-up invites
    const pp = player.pos;
    const inv = vil.agents.filter(a => !a.kid && a.pose !== 'sleep' && !(a.act && a.act.type === 'joy')).sort((x, y) => ((x.pos[0] - pp[0]) ** 2 + (x.pos[2] - pp[2]) ** 2) - ((y.pos[0] - pp[0]) ** 2 + (y.pos[2] - pp[2]) ** 2))[0];
    mgr.joyEnd(inv); if (inv.pose === 'sit') inv.pose = 'stand';
    mgr.joyStart(vil, 'dance', { _who: { dance: inv } });
    let asked = false;
    for (let f = 0; f < 900 && !asked; f++) { mgr.update(dt); asked = !!(inv.act && inv.act.wait); }
    mgr.openTalk(inv);
    const D = mgr.joy && mgr.joy.dance;
    if (!asked || !D) { check(false, `${name}: an invitation taken (asked ${asked}, dance ${!!D})`); return; }
    let best = 0, at = -1, snap = null, plain = 0, hushed = 0, allAt = -1;
    for (let f = 0; f < 450; f++) {
      mgr.update(dt);
      const n = D.members.filter(a => a.dance && a.ringDance).length;
      if (n > best) { best = n; at = f * dt; }
      plain = Math.max(plain, D.members.filter(a => a.dance).length); hushed = Math.max(hushed, D.members.filter(a => a.hush).length);
      if (n === D.n && allAt < 0) allAt = f;
      if (!snap && (f === 449 || (allAt >= 0 && f === allAt + 45))) snap = D.members.map(a => ({ pos: a.pos.slice(), yaw: a.yaw, ring: !!(a.dance && a.ringDance), hush: !!a.hush }));
    }
    const want = Math.min(5, D.n);
    const sol = (x, y, z) => { const s = world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return !!(s && (R.T.flags[s] & F.SOLID)); };
    const inR = snap.filter(s => s.ring);
    const onOpen = inR.filter(s => !sol(s.pos[0], s.pos[1] + 0.1, s.pos[2]) && !sol(s.pos[0], s.pos[1] + 1.2, s.pos[2]) && sol(s.pos[0], s.pos[1] - 0.2, s.pos[2])).length;
    const facing = inR.filter(s => { const t = Math.atan2(-(D.c[0] - s.pos[0]), -(D.c[2] - s.pos[2])); return Math.abs(Math.atan2(Math.sin(t - s.yaw), Math.cos(t - s.yaw))) < 0.5; }).length;
    console.log(`  · ${name}: ${vil.agents.length} people, ring ${D.f3 ? (D.ring ? 'r ' + D.r.toFixed(2) + ' m at ' + Math.hypot(D.c[0] - C[0], D.c[2] - C[2]).toFixed(1) + ' m from the middle' : 'none (in place)') : '(folkjoy\'s)'}; ${best} of ${D.n} dancing in the ring (the most at ${at.toFixed(1)} s; any dance at most ${plain}), at most ${hushed} sent away`);
    check(best >= want, `${name}: ${best} of ${D.n} in the ring within 15 s (≥ ${want})`);
    check(inR.length && onOpen === inR.length, `${name}: everyone in the ring on open ground (${onOpen} of ${inR.length})`);
    check(inR.length && facing === inR.length, `${name}: everyone facing the middle (${facing} of ${inR.length})`);
    check(D.chord > 0 && D.chord <= 1.5, `${name}: neighbours near enough to hold hands (${(D.chord || 0).toFixed(2)} m)`);
  } finally { Math.random = r0; }
}

for (const k of ['aqua', 'ocker']) {
  const gen = V.DimReg.get(k).gen(SEED, { bgen: { [k]: 3 } }), eco = V.WorldEco.of(gen), s0 = eco.sites[0], sum = eco.plan(s0.id);
  console.log(k + ' · ' + (sum && sum.name));
  if (!sum) { check(false, k + ': the first village\'s plan'); continue; }
  dance(k, worldOf(gen), sum);
}
{
  console.log('Herzwelt · Nova Haven');
  const gen = new V.OverworldGen(SEED, { worldType: 'default', vgen: 14 });
  const site = VG.site(gen, 0, -1), plan = VG.plan(gen, site), sum = VG.summary(plan);
  dance('herz', worldOf(gen), sum);
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
