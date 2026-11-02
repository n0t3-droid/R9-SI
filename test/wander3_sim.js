// o-wander3 · a walk in node: the real Wanderregisseur (W.Actor), the real Regie and the real event log over a
// synthetic world (flat grass · a forest · sky-isle planks), a walker heading on, the other sources as a busy Herzwelt
// has them (the pads' visitors and the sky traffic note starts that are not always seen; craft closing in). Used by
// test/wander3.js; WALK=1 node test/wander3_sim.js prints one walk's refusals (the instrument).
const V = require('./load_shared.js');
const M = __dirname + '/../src/main/';
for (const f of ['i18n', 'lang_en', 'lang_de']) require(M + f + '.js');
global.window = global.window || {}; global.performance = global.performance || { now: () => Date.now() };
for (const f of ['lifekit', 'lifedirector', 'eventlog', 'regie', 'wander']) require(M + f + '.js');
const W = V.Wander, R = V.R;
const id = (n) => { const b = R.byName[n]; return b ? (b.defaultState !== undefined ? b.defaultState : b.base) | 0 : 0; };
const B = { grass: id('grass_block'), dirt: id('dirt'), log: id('oak_log'), leaves: id('oak_leaves'), tall: id('tall_grass'), plank: id('oak_planks') };
// terrain: 'flat' · 'forest' (a trunk every 6 m, crowns) · 'isle' (a plank isle 40 m wide at y 140, air around: the walker
// circles on it) · 'mixed' (60 m of each in turn)
function world(kind) {
  const top = (x, z) => kind === 'isle' ? 140 : 64;
  const tree = (x, z) => { const k = kind === 'mixed' ? Math.floor(x / 60) % 3 : -1; if (!(kind === 'forest' || k === 1)) return false; return ((x % 6) + 6) % 6 === 0 && ((z % 7) + 7) % 7 === 0; };
  return {
    col() { return null; },   // (the event log's line of sight: no shadow map here — the frustum decides)
    getBlock(x, y, z) {
      const t = top(x, z);
      if (kind === 'isle' && Math.hypot(x, z) > 22) return 0;
      if (y < t - 3) return kind === 'isle' ? 0 : B.dirt;
      if (y < t) return kind === 'isle' ? B.plank : (y === t - 1 ? B.grass : B.dirt);
      if (tree(x, z) && y < t + 5) return B.log;
      for (const [ox, oz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (tree(x + ox, z + oz) && y >= t + 4 && y < t + 7) return B.leaves;
      return 0;
    },
    topAt(x, z) { return top(x, z) - 1; },
  };
}
// one walk: dur s at 30 fps; o: {terrain, tier, ext: [{t, seen}] the other sources' notes, ships: true}
function walk(o) {
  o = o || {};
  const L = V.EventLog; L.on = true;
  const g = { state: 'play', time: 0, meta: { seed: o.seed || 4242, id: 'w' }, dim: 'overworld', settings: { preset: o.tier === 0 ? 'potato' : 'balanced', fov: 70 }, env: { timeOfDay: 9000 }, ui: {}, world: world(o.terrain || 'flat'), player: { pos: [0, 64, 0], yaw: 0, flying: false }, cam: null, particles: null, audio: null };
  if (o.terrain === 'isle') g.player.pos[1] = 140;
  V.game = g; L.bind(g); L.reset(g.world);
  const D = new W.Actor(g); g.wanderer = D;
  const dt = 1 / 30, dur = o.dur || 300, sp = 4.3; let ang = 0;
  const ext = (o.ext || []).slice(); let ei = 0; const ships = [];
  if (o.ships) g.traffic = { ships };
  for (let t = 0; t < dur; t += dt) {
    g.time = t;
    const p = g.player.pos;
    if (o.terrain === 'isle') { ang += sp * dt / 15; p[0] = Math.cos(ang) * 15; p[2] = Math.sin(ang) * 15; g.player.yaw = -ang + Math.PI; }   // (round the isle, ahead along the circle)
    else { p[2] -= sp * dt; if (Math.floor(t / 40) % 2) p[0] += sp * dt * 0.3; }
    const yaw = o.terrain === 'isle' ? Math.atan2(Math.sin(ang), Math.cos(ang)) - Math.PI / 2 + Math.PI : 0;
    g.cam = { x: p[0], y: p[1] + 1.62, z: p[2], yaw: o.terrain === 'isle' ? Math.atan2(-(-Math.sin(ang)), -(Math.cos(ang))) : 0, pitch: -0.05 };
    if (o.terrain === 'isle') g.player.yaw = g.cam.yaw;
    while (ei < ext.length && ext[ei].t <= t) { const e = ext[ei++]; if (V.Regie.allow(g, 2, 'ambient', e.act || 'x' + ei) || e.force) { V.Regie.note(g, 2, 'ambient', e.act || 'x' + ei); if (e.seen) L.emit('ambient', 'ext', 2, null, 'ext'); } }
    // (far: small things seen far off — a craft over the horizon, a bird 150 m away: in view, a sliver of the frame)
    if (o.far && Math.floor(t / o.far) !== Math.floor((t - dt) / o.far)) { const c = g.cam, f = [-Math.sin(c.yaw), -Math.cos(c.yaw)]; L.emit('sky', 'far', 2, [c.x + f[0] * 160, c.y + 12, c.z + f[1] * 160], 'far', 1); }
    if (o.ships) { if (ships.length === 0 || t % 20 < dt) ships.push({ pos: [p[0] + 300, p[1] + 40, p[2] - 50], speed: 25, wing: false }); for (const s of ships) { const dx = p[0] - s.pos[0], dz = p[2] - s.pos[2], d = Math.hypot(dx, dz) || 1; s.pos[0] += dx / d * s.speed * dt; s.pos[2] += dz / d * s.speed * dt; } while (ships.length > 3) ships.shift(); }
    V.Regie.frame(g, dt);
    D.update(dt);
  }
  const st = D.stats(), tl = st.timeline.filter(e => !String(e.kind).startsWith('b:')), beats = st.timeline.filter(e => String(e.kind).startsWith('b:'));
  const ts = [0].concat(st.timeline.map(e => e.t), [dur]); let gap = 0; for (let i = 1; i < ts.length; i++) gap = Math.max(gap, ts[i] - ts[i - 1]);
  const mt = tl.map(e => e.t); let mgap = 0; { const a = [0].concat(mt, [dur]); for (let i = 1; i < a.length; i++) mgap = Math.max(mgap, a[i] - a[i - 1]); }
  let close = Infinity; for (let i = 1; i < st.timeline.length; i++) close = Math.min(close, st.timeline[i].t - st.timeline[i - 1].t);
  return { moments: tl.length, beats: beats.length, gap: +gap.toFixed(1), mgap: +mgap.toFixed(1), close: +close.toFixed(1), why: st.why || null, stage: st.stage || null, timeline: st.timeline, regie: V.Regie.stats(g) };
}
module.exports = { walk, world };
if (require.main === module && process.env.WALK) {
  const ext = []; for (let t = 5; t < 300; t += 11) ext.push({ t, seen: (t | 0) % 3 === 0 });
  for (const terrain of ['flat', 'forest', 'isle', 'mixed']) for (const busy of [0, 1]) {
    const r = walk({ terrain, ext: busy ? ext : [], ships: !!busy });
    console.log(terrain, busy ? 'busy' : 'calm', JSON.stringify({ moments: r.moments, beats: r.beats, gap: r.gap, mgap: r.mgap, close: r.close, why: r.why, stage: r.stage, rg: r.regie && r.regie.st }));
  }
}
