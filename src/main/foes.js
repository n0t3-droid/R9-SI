// ============================================================================
// Maschinen und Schatten — the Abenteuer's foes (a-foes; plan docs/superpowers/plans/2026-10-23-a-foes.md §2.1, spec
// docs/superpowers/specs/2026-10-22-abenteuer-design.md §5, §12, §14). Three families of our own design:
//   Irrläufer       worker machines of the old beacon network whose cores were disturbed — the Bohrläufer (a four-legged
//                   drill walker), the Wächter (a two-legged sentry with a shield plate), the Kranarm (a crane turret on
//                   the outpost's tower). They patrol their outpost, telegraph every attack (the optic flares, a rising
//                   tone), and their core is the weak point
//   Schattendrohnen small white drones in a violet-black smoke halo, in swarms of 3–6: slow glowing bolts you can step
//                   aside from; at most two attack at once, the rest circle
//   Schattenwesen   shapeless living shadows with two soft eyes, at night near ruins, shy of light: a touch chills
// Nothing here bleeds or dies: a machine powers down into parts (sparks, steam, clattering plates, light motes), a
// shadow dissolves into motes that drift up — healed, not hurt. People and animals are never touched: the player's
// pulse stays harmless light for them (peace.js); only a foe takes it. Falling to zero hearts is an Ohnmacht.
// Pure core (node-tested, test/foes.js): the kinds, the attack tokens (≤ 2), the telegraph (≥ 0.6 s), the encounter
// rules (contested zones only; never within 48 blocks of a village, the home or a freed site; Bauruhe; Begegnungen aus
// and Kindersicher never), Spannung's scaling, the power-down's drops, the Ohnmacht's waking place, the foe topic's
// message (≤ 1 KB) and the host's check of a guest's hit, and the AI itself (F.step) over a small world interface.
// The game (below): entities.js calls F.tick, F.ai, F.hurtMob, F.gone and F.draw (one marked line each); the director
// places the guardians of an outpost and the shadows of a night; bolts, shed parts, the hearts, the Ohnmacht; the
// host-run topic `foe` (mp.js). Only in an Abenteuer world (VR.Adventure) with its Begegnungen read from the switch.
// Cost 🟡: nothing outside an Abenteuer world; ≤ 20 µs a foe's step, ≤ 8 draws a machine, the particles from the
// shared, budgeted pool; F.cost measures it.
// ============================================================================
(function (VR) {
  'use strict';
  const F = VR.Foes = VR.Foes || {};
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const Adv = () => VR.Adv;

  // ================================================================ the rules (pure)
  F.MIN_TELE = 0.6;    // s: every attack is announced at least this long
  F.MAX_ATT = 2;       // at most two attack at the same time
  F.SAFE_R = 48;       // blocks: never a foe this near a village, the home or a freed site
  F.BAURUHE = 20000;   // ms: a block placed this recently pauses the spawns
  F.REST = { normal: 150, rare: 400 };   // s a zone rests after an encounter (2–4 encounters per 10 min at most)
  F.DOWN_T = { stray: 2.4, drone: 1.3, shadow: 1.4 };   // s of the power-down (the dissolving)
  F.ZONE_R = { outpost: 40, ruin: 32 };
  const PAD_R = 8.5;   // blocks: the outpost's pad and its parked ship — the strays walk round it
  // the kinds (hp in half-hearts: A§5's hearts × 2). att: kind, tele (the warning), strike, recover, cool [a, b] s,
  // dmg (half-hearts), range (m). keep [a, b]: the distance it likes; notice: how far it sees
  F.KINDS = {
    driller: { fam: 'stray', model: 'foe_driller', hp: 16, speed: 3.0, w: 0.55, h: 1.15, notice: 18, keep: [3, 6], weak: 'back', kneel: 4,
      att: { kind: 'charge', tele: 0.8, strike: 0.5, recover: 1.3, cool: [2.5, 4.0], dmg: 2, range: 8, dash: 12 } },
    sentry: { fam: 'stray', model: 'foe_sentry', hp: 24, speed: 2.4, w: 0.45, h: 1.9, notice: 22, keep: [8, 13], weak: 'core', kneel: 7,
      att: { kind: 'bolt', tele: 0.7, strike: 0.25, recover: 0.9, cool: [2.8, 4.2], dmg: 2, range: 20 } },
    crane: { fam: 'stray', model: 'foe_crane', hp: 20, speed: 0, w: 0.6, h: 1.4, notice: 24, keep: [0, 99], weak: 'joint', fixed: true, kneel: 3,
      att: { kind: 'drop', tele: 0.9, strike: 0.35, recover: 1.2, cool: [3.5, 5.0], dmg: 2, range: 22, r: 1.8 } },
    drone: { fam: 'drone', model: 'foe_drone', hp: 6, speed: 5.5, w: 0.35, h: 0.6, fly: 'hover', notice: 26, keep: [7, 11], alt: [3, 6], weak: 'eye', kneel: 0,
      att: { kind: 'bolt', tele: 0.6, strike: 0.15, recover: 0.8, cool: [3.0, 5.0], dmg: 1, range: 18 } },
    wisp: { fam: 'shadow', model: 'foe_wisp', hp: 8, speed: 1.8, w: 0.4, h: 1.2, fly: 'hover', notice: 16, keep: [1.2, 3.5], weak: 'light', night: true, shy: 10, kneel: 0,
      att: { kind: 'touch', tele: 0.6, strike: 0.35, recover: 1.4, cool: [3.0, 5.0], dmg: 2, range: 2.6, chill: true } },
  };
  F.KIND_LIST = ['driller', 'sentry', 'crane', 'drone', 'wisp'];
  F.STRAYS = ['driller', 'sentry', 'crane'];
  // the mob kinds entities.js knows them by (foe, never hostile: an Abenteuer world is peaceful, A§1 — the legacy
  // hostiles are removed there, these are not). Not enumerable: the codex's creature pages (for…in VR.MOBS) stay as
  // they are for every builder, who never meets a foe; summon('foe_…') still finds them
  VR.MOBS = VR.MOBS || {};
  for (const k of F.KIND_LIST) { const K = F.KINDS[k]; Object.defineProperty(VR.MOBS, 'foe_' + k, { value: { model: K.model, hp: K.hp, speed: K.speed, w: K.w, h: K.h, fly: K.fly, foe: true, foeKind: k, drops: [], xp: 0 }, enumerable: false, writable: true, configurable: true }); }

  // the warning: never shorter than 0.6 s; Leicht gives a quarter more time. Spannung changes the pauses, the counts
  // and the bolts' speed — never the warning
  F.teleOf = (k, band) => { const K = F.KINDS[k]; return Math.max(F.MIN_TELE, (K ? K.att.tele : F.MIN_TELE) * (band === 'easy' ? 1.25 : 1)); };
  const scale = (s) => (Adv() ? Adv().scale(s) : 0.6 + 0.8 * clamp(s, 0, 1));
  const mid = (band) => { const B = Adv() && Adv().BANDS[band] ? Adv().BANDS[band] : [0.3, 0.7]; return (B[0] + B[1]) / 2; };
  F.coolScale = (s) => 1 / scale(s);
  F.BOLT = { easy: 6, normal: 8, hard: 11 };   // m/s at the band's middle (A§5)
  F.boltSpeed = (band, s) => (F.BOLT[band] || F.BOLT.normal) * scale(s) / scale(mid(band));
  F.GROUP = { easy: [1, 2], normal: [2, 4], hard: [3, 6] };
  F.SWARM = { easy: [3, 3], normal: [3, 4], hard: [4, 6] };
  const sized = (R, band, s, rnd, lo, hi) => { const r = R[band] || R.normal, n = r[0] + Math.floor((rnd ? rnd() : Math.random()) * (r[1] - r[0] + 1)); return clamp(Math.round(n * scale(s) / scale(mid(band))), lo, hi); };
  F.groupSize = (band, s, rnd) => sized(F.GROUP, band, s, rnd, 1, 6);
  F.swarmSize = (band, s, rnd) => sized(F.SWARM, band, s, rnd, 3, 6);
  F.expected = (n) => 15 + 8 * (n | 0);

  // ---------------------------------------------------------------- where foes may be (A§5)
  // zones: [{kind: 'outpost' | 'ruin', x, z, r}]; an outpost is contested day and night (its machines; its shadows at
  // night), a ruin only at night and only for the shadows
  F.zoneAt = function (pt, zones, night, kind) {
    const shadow = kind === 'wisp';
    for (const z of zones || []) {
      if (!z) continue;
      const dx = pt[0] - z.x, dz = pt[2] - z.z, r = z.r || F.ZONE_R[z.kind] || 32;
      if (dx * dx + dz * dz > r * r) continue;
      if (z.kind === 'outpost' && (!shadow || night)) return z;
      if (z.kind === 'ruin' && night && shadow) return z;   // (a ruin's night belongs to the shadows; the machines to the outposts)
    }
    return null;
  };
  // ctx: {enc, kids, villages: [{x, z}], homes: [[x, y, z]], freed: [[x, z]], lastBuild (ms), now (ms), zones, night}
  F.spawnOk = function (pt, ctx, kind) {
    const c = ctx || {};
    if (c.kids || c.enc === 'off') return { ok: false, why: 'enc' };
    const k = kind || 'driller';
    if (F.KINDS[k] && F.KINDS[k].night && !c.night) return { ok: false, why: 'night' };
    if (!F.zoneAt(pt, c.zones, !!c.night, k)) return { ok: false, why: 'zone' };
    const R2 = F.SAFE_R * F.SAFE_R, x = pt[0], z = pt[2];
    for (const v of c.villages || []) if (v && (v.x - x) * (v.x - x) + (v.z - z) * (v.z - z) < R2) return { ok: false, why: 'village' };
    for (const h of c.homes || []) if (h && (h[0] - x) * (h[0] - x) + (h[2] - z) * (h[2] - z) < R2) return { ok: false, why: 'home' };
    for (const f of c.freed || []) if (f && (f[0] - x) * (f[0] - x) + (f[1] - z) * (f[1] - z) < R2) return { ok: false, why: 'freed' };
    if (Number.isFinite(c.lastBuild) && Number.isFinite(c.now) && c.now - c.lastBuild < F.BAURUHE) return { ok: false, why: 'bauruhe' };
    return { ok: true, why: 'ok' };
  };

  // ---------------------------------------------------------------- the power-down's drops (A§5)
  const rint = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));
  F.drops = function (k, rnd) {
    rnd = rnd || Math.random;
    const out = { items: [], taler: 0, parts: [], motes: 0 };
    const add = (id, n) => { if (n > 0) out.items.push([id, n]); };
    if (k === 'wisp') { out.motes = 24; return out; }
    if (k === 'drone') { out.parts.push('shard', 'shard', 'shard'); out.motes = 16; add('energy_cell', rint(rnd, 0, 1)); out.taler = rint(rnd, 0, 1); return out; }
    const plates = k === 'sentry' ? 3 : 2 + rint(rnd, 0, 1);
    for (let i = 0; i < plates; i++) out.parts.push('plate');
    out.parts.push('gear'); if (k === 'crane') out.parts.push('gear');
    add('iron_nugget', k === 'sentry' ? rint(rnd, 2, 4) : rint(rnd, 1, 3));
    add('energy_cell', k === 'sentry' ? 1 : rint(rnd, 0, 1));
    add('copper_ingot', k === 'driller' ? rint(rnd, 0, 1) : k === 'crane' ? 1 : 0);
    out.taler = k === 'sentry' ? rint(rnd, 2, 4) : rint(rnd, 1, 3);
    out.motes = 6;
    return out;
  };

  // ---------------------------------------------------------------- Spannung, the Ohnmacht (A§5, §12)
  F.after = (rec, o) => Adv().encounter(rec, { lost: +o.lost || 0, max: +o.max || 20, dur: +o.dur || 0, expected: F.expected(o.n) });
  F.faint = (rec, t) => Adv().faint(rec, t);
  F.wake = function (o) {
    let best = null;
    for (const f of (o && o.freed) || []) if (f && Array.isArray(f.pos) && (!best || (+f.t || 0) > (+best.t || 0))) best = f;
    if (best) return { pos: best.pos.slice(0, 3), why: 'beacon', id: best.id };
    const h = o && Array.isArray(o.home) ? o.home : [0.5, 100, 0.5];
    return { pos: h.slice(0, 3), why: 'home' };
  };
  F.lostTaler = (band, taler) => (band === 'hard' ? Math.floor(Math.max(0, taler | 0) * 0.05) : 0);
  // a hit in half-hearts on the 20 of survival: Ausdauer's extra hearts make it a smaller bite
  F.dmgFor = (dmg, mode, hpMax) => (mode === 'survival' ? dmg * 20 / Math.max(20, hpMax || 20) : dmg);

  // ---------------------------------------------------------------- the attack tokens (≤ 2 attackers)
  class Tokens {
    constructor(cap) { this.cap = cap || F.MAX_ATT; this.held = new Set(); }
    take(id) { if (this.held.has(id)) return true; if (this.held.size >= this.cap) return false; this.held.add(id); return true; }
    give(id) { this.held.delete(id); }
    has(id) { return this.held.has(id); }
    get count() { return this.held.size; }
    clear() { this.held.clear(); }
  }
  F.Tokens = Tokens;

  // ---------------------------------------------------------------- a foe's state
  F.make = (k, id, pos) => ({
    k, id, st: 'patrol', t: 0, cool: 1.2, tok: false, hp: F.KINDS[k].hp, max: F.KINDS[k].hp, flare: 0, home: [pos[0], pos[1], pos[2]],
    tgt: null, wait: 0, lock: [0, 0, 0], ldir: [0, -1], hitDone: false, hitT: 0, calm: 0, kneel: 0, gone: false, helper: false, zone: null,
    site: null, spin: 0, walk: 0, orbit: ((id * 2.39996) % TAU), why: '', burn: 0, fx: 0, shed: 0,
  });
  // the weak points: the Bohrläufer's vent at its back, the Wächter's core (its shield holds from the front unless it is
  // swung aside to shoot), the Kranarm's joint while it recovers, the drone's eye; a shadow takes the light whole
  F.hitFactor = function (m, from) {
    const f = m.foe, K = F.KINDS[f.k]; if (!from || K.fam === 'shadow') return 1;
    const dx = from[0] - m.pos[0], dz = from[2] - m.pos[2], l = Math.hypot(dx, dz) || 1;
    const c = (dx / l) * -Math.sin(m.yaw) + (dz / l) * -Math.cos(m.yaw);   // 1: in front, −1: behind
    switch (K.weak) {
      case 'back': return c < -0.5 ? 2 : 1;
      case 'core': if (c > 0.5) return f.st === 'tele' || f.st === 'strike' ? 1 : 0.25; return 2;
      case 'joint': return f.st === 'recover' ? 2 : 1;
      case 'eye': return c > 0.5 ? 2 : 1;
      default: return 1;
    }
  };
  // the optic's colour: red-violet when disturbed (brighter in the telegraph), green when calmed or a Helfer; in a
  // power-down it flickers between the two and settles green
  const OPT = [0, 0, 0], RV = [1.0, 0.16, 0.8], GN = [0.28, 1.0, 0.46];
  F.optic = function (m) {
    const f = m.foe; let g = 0;
    if (f.helper || f.st === 'helper') g = 1;
    else if (f.st === 'calm') g = clamp(f.calm, 0, 1);
    else if (f.st === 'down' || f.st === 'leave') g = f.t > 0.8 ? 1 : ((f.t * 11) | 0) & 1;
    // (the flare brightens the colour's own channels; the weak one stays low, so a warning glows red-violet, not white)
    const b = 1 + 2.4 * clamp(f.flare, 0, 1);
    for (let i = 0; i < 3; i++) { const c = RV[i] + (GN[i] - RV[i]) * g; OPT[i] = c * (c >= 0.5 ? b : Math.min(b, 1.25)); }
    return OPT;
  };

  // ---------------------------------------------------------------- the AI (pure over a world interface)
  // W: {t, enc, band, s, night, rnd, tokens, player, players: [{pos, dead, light}], ground(x, z) → y | null,
  // light(x, y, z) → 0…15, out: {hits, bolts, events}}. The step sets m.vel and m.yaw; the game's physics moves it.
  function nearest(m, W) {
    const L = W.players; let best = null, bd = Infinity;
    for (let i = 0; i < L.length; i++) { const q = L[i]; if (!q || q.dead || !q.pos) continue; const dx = q.pos[0] - m.pos[0], dz = q.pos[2] - m.pos[2], d = dx * dx + dz * dz; if (d < bd) { bd = d; best = q; } }
    return best;
  }
  function faceTo(m, dx, dz, dt, rate) { if (!dx && !dz) return; let a = Math.atan2(-dx, -dz) - m.yaw; while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; m.yaw += a * Math.min(1, dt * rate); }
  function steer(m, tx, tz, speed, dt, face) {
    const dx = tx - m.pos[0], dz = tz - m.pos[2], d = Math.sqrt(dx * dx + dz * dz);
    let vx = 0, vz = 0; if (d > 0.2) { vx = dx / d * speed; vz = dz / d * speed; }
    const k = Math.min(1, dt * 8); m.vel[0] += (vx - m.vel[0]) * k; m.vel[2] += (vz - m.vel[2]) * k;
    if (face !== false && d > 0.2) faceTo(m, dx, dz, dt, 6);
  }
  function stop(m, dt) { const k = Math.min(1, dt * 10); m.vel[0] -= m.vel[0] * k; m.vel[2] -= m.vel[2] * k; }
  function hover(m, W, f, K, dt) {
    if (!K.fly) return;
    const gy = W.ground ? W.ground(Math.floor(m.pos[0]), Math.floor(m.pos[2])) : null, base = gy === null || gy === undefined ? m.pos[1] - 1 : gy + 1;
    const want = K.alt ? K.alt[0] + (K.alt[1] - K.alt[0]) * (0.5 + 0.5 * Math.sin(f.spin * 0.7 + f.id)) : 0.35 + 0.25 * Math.sin(f.spin * 1.3 + f.id);
    m.vel[1] += ((base + want - m.pos[1]) * 2 - m.vel[1]) * Math.min(1, dt * 3);
  }
  function to(m, W, st) {
    const f = m.foe; f.st = st; f.t = 0;
    if (st === 'notice' || st === 'tele' || st === 'strike' || st === 'down' || st === 'calm') W.out.events.push({ k: st, id: m.id, f: f.k });
  }
  function release(m, W) { const f = m.foe; if (f.tok) { W.tokens.give(m.id); f.tok = false; } }
  function toDown(m, W, why) { release(m, W); m.foe.why = why; m.vel[0] = 0; m.vel[2] = 0; to(m, W, 'down'); }
  function hit(m, W, P, dmg, kind) { W.out.hits.push({ id: m.id, f: m.foe.k, p: P, dmg, kind, chill: !!F.KINDS[m.foe.k].att.chill, x: m.pos[0], y: m.pos[1], z: m.pos[2] }); }
  function strikeStart(m, W, pp) {
    const f = m.foe, K = F.KINDS[f.k], A = K.att;
    if (A.kind !== 'bolt' || !pp) return;
    const ox = m.pos[0] - Math.sin(m.yaw) * K.w, oy = m.pos[1] + K.h * 0.8, oz = m.pos[2] - Math.cos(m.yaw) * K.w;
    const dx = pp[0] - ox, dy = pp[1] + 1.1 - oy, dz = pp[2] - oz, l = Math.hypot(dx, dy, dz) || 1, v = F.boltSpeed(W.band, W.s);
    W.out.bolts.push({ pos: [ox, oy, oz], vel: [dx / l * v, dy / l * v, dz / l * v], dmg: A.dmg, k: f.k, owner: m.id });
  }
  F.step = function (m, dt, W) {
    const f = m.foe; if (!f || f.gone) return;
    const K = F.KINDS[f.k], A = K.att;
    f.t += dt; f.cool -= dt; f.spin += dt; if (f.hitT > 0) f.hitT -= dt;
    const P = nearest(m, W), pp = P ? P.pos : null;
    let dx = 0, dz = 0, dist = Infinity;
    if (pp) { dx = pp[0] - m.pos[0]; dz = pp[2] - m.pos[2]; dist = Math.sqrt(dx * dx + dz * dz); }
    // a shadow: the day takes it, a lamp dissolves it (it flees the light while it burns)
    if (K.fam === 'shadow' && f.st !== 'down' && f.st !== 'leave') {
      if (W.night < 0.3) toDown(m, W, 'dawn');
      else {
        const L = W.light ? W.light(m.pos[0], m.pos[1] + 0.6, m.pos[2]) : 0;
        if (L >= K.shy) {
          f.hp -= dt * 4; f.burn = 1;
          if (f.hp <= 0) toDown(m, W, 'light');
          else if (f.st !== 'tele' && f.st !== 'strike') {
            const gx = W.light(m.pos[0] + 1, m.pos[1] + 0.6, m.pos[2]) - W.light(m.pos[0] - 1, m.pos[1] + 0.6, m.pos[2]), gz = W.light(m.pos[0], m.pos[1] + 0.6, m.pos[2] + 1) - W.light(m.pos[0], m.pos[1] + 0.6, m.pos[2] - 1);
            if (gx || gz) { steer(m, m.pos[0] - gx * 4, m.pos[2] - gz * 4, K.speed * 1.4, dt); hover(m, W, f, K, dt); return; }
          }
        } else if (f.burn > 0) f.burn = Math.max(0, f.burn - dt * 2);
      }
    }
    // listening ([V] Beruhigen, the timing ring open): it holds still and looks at the one who speaks to it, no attack
    if (f.listen && (f.st === 'patrol' || f.st === 'notice' || f.st === 'approach' || f.st === 'tele' || f.st === 'recover' || f.st === 'stagger')) {
      release(m, W); if (f.st === 'tele') { f.st = 'approach'; f.t = 0; }
      stop(m, dt); hover(m, W, f, K, dt); if (pp) faceTo(m, dx, dz, dt, 5);
      f.flare = Math.max(0, f.flare - dt * 3); f.cool = Math.max(f.cool, 1.5);
      return;
    }
    switch (f.st) {
      case 'patrol': {
        if (!f.tgt || f.t >= f.wait) {
          const a = W.rnd() * TAU, r = K.fixed ? 0 : 2 + W.rnd() * 5; f.tgt = [f.home[0] + Math.cos(a) * r, f.home[2] + Math.sin(a) * r]; f.wait = 2.5 + W.rnd() * 4; f.t = 0;
          const z = f.zone; if (z && z.kind === 'outpost' && !K.fixed) { const zx = f.tgt[0] - z.x, zz = f.tgt[1] - z.z, zd = Math.hypot(zx, zz) || 1; if (zd < PAD_R) { f.tgt[0] = z.x + zx / zd * PAD_R; f.tgt[1] = z.z + zz / zd * PAD_R; } }   // (round the pad, not through the parked ship)
        }
        if (K.fixed) { stop(m, dt); m.yaw += dt * 0.35; }
        else steer(m, f.tgt[0], f.tgt[1], K.speed * 0.45, dt);
        hover(m, W, f, K, dt);
        f.flare = Math.max(0, f.flare - dt * 2);
        if (W.enc !== 'off' && pp && dist <= K.notice) { stop(m, dt); to(m, W, 'notice'); }
        break;
      }
      case 'notice': {
        stop(m, dt); if (pp) faceTo(m, dx, dz, dt, 7); hover(m, W, f, K, dt);
        f.flare = 0.35 * Math.max(0, 1 - f.t / 0.5);
        if (f.t >= 0.5) to(m, W, 'approach');
        break;
      }
      case 'approach': {
        if (!pp || dist > K.notice + 14 || W.enc === 'off') { release(m, W); to(m, W, 'patrol'); break; }
        let a = K.keep[0], b = K.keep[1];
        const shy = K.fam === 'shadow' && (P.light || 0) >= 8;
        if (shy) { a = 5.5; b = 7.5; }
        if (K.fixed) { stop(m, dt); faceTo(m, dx, dz, dt, 3); }
        else if (f.k === 'drone') {
          f.orbit += dt * 0.55 * ((f.id & 1) ? 1 : -1);
          const r = (a + b) / 2; steer(m, pp[0] + Math.cos(f.orbit) * r, pp[2] + Math.sin(f.orbit) * r, K.speed, dt, false); faceTo(m, dx, dz, dt, 5);
        } else if (dist > b) steer(m, pp[0], pp[2], K.speed, dt);
        else if (dist < a) { steer(m, m.pos[0] - dx, m.pos[2] - dz, K.speed * 0.8, dt, false); faceTo(m, dx, dz, dt, 6); }
        else { const side = (f.id & 1) ? 1 : -1, sx = -dz / dist * side, sz = dx / dist * side; steer(m, m.pos[0] + sx * 2, m.pos[2] + sz * 2, K.speed * 0.3, dt, false); faceTo(m, dx, dz, dt, 6); }
        hover(m, W, f, K, dt);
        f.flare = Math.max(0, f.flare - dt * 2);
        if (!shy && f.cool <= 0 && dist <= A.range && W.tokens.take(m.id)) {
          f.tok = true; f.hitDone = false;
          f.lock[0] = pp[0]; f.lock[1] = pp[1]; f.lock[2] = pp[2];
          f.ldir[0] = dx / (dist || 1); f.ldir[1] = dz / (dist || 1);
          to(m, W, 'tele');
        }
        break;
      }
      case 'tele': {
        stop(m, dt); hover(m, W, f, K, dt);
        const Tt = F.teleOf(f.k, W.band);
        f.flare = Math.min(1, f.t / Tt);
        if (A.kind === 'charge' || A.kind === 'drop') faceTo(m, f.ldir[0], f.ldir[1], dt, 8); else if (pp) faceTo(m, dx, dz, dt, 8);
        if (f.t >= Tt) { to(m, W, 'strike'); strikeStart(m, W, pp); }
        break;
      }
      case 'strike': {
        f.flare = 1;
        if (A.kind === 'charge' || A.kind === 'touch') {
          const v = A.kind === 'charge' ? A.dash : 2.4 / A.strike;
          m.vel[0] = f.ldir[0] * v; m.vel[2] = f.ldir[1] * v;
          const R = A.kind === 'charge' ? 1.25 : 1.0;
          if (!f.hitDone && pp && Math.abs(pp[0] - m.pos[0]) < R && Math.abs(pp[2] - m.pos[2]) < R && Math.hypot(pp[0] - m.pos[0], pp[2] - m.pos[2]) < R && Math.abs(pp[1] + (K.fly ? 0.8 : 0) - m.pos[1]) < 2) { f.hitDone = true; hit(m, W, P, A.dmg, A.kind); }
        } else stop(m, dt);
        hover(m, W, f, K, dt);
        if (f.t >= A.strike) {
          if (A.kind === 'drop') {
            W.out.events.push({ k: 'slam', id: m.id, f: f.k, x: f.lock[0], y: f.lock[1], z: f.lock[2] });
            if (pp && Math.hypot(pp[0] - f.lock[0], pp[2] - f.lock[2]) <= A.r && Math.abs(pp[1] - f.lock[1]) < 2.5) hit(m, W, P, A.dmg, 'drop');
          }
          stop(m, 1); to(m, W, 'recover');
        }
        break;
      }
      case 'recover': {
        stop(m, dt); hover(m, W, f, K, dt);
        f.flare = Math.max(0, f.flare - dt * 3);
        if (f.t >= A.recover) { release(m, W); f.cool = (A.cool[0] + W.rnd() * (A.cool[1] - A.cool[0])) * F.coolScale(W.s); to(m, W, 'approach'); }
        break;
      }
      case 'stagger': {
        const k = Math.min(1, dt * 6); m.vel[0] -= m.vel[0] * k; m.vel[2] -= m.vel[2] * k; hover(m, W, f, K, dt);
        f.flare = Math.max(0, f.flare - dt * 4);
        if (f.t >= 0.35) to(m, W, 'approach');
        break;
      }
      case 'down': {
        stop(m, dt); f.flare = Math.max(0, f.flare - dt * 3);
        f.kneel = Math.min(1, f.t / 0.8);
        if (K.fam === 'drone') m.vel[1] -= 18 * dt; else if (K.fam === 'shadow') m.vel[1] = 0.6;
        if (f.t >= F.DOWN_T[K.fam]) { f.gone = true; W.out.events.push({ k: 'gone', id: m.id, f: f.k, why: f.why }); }
        break;
      }
      case 'calm': {
        stop(m, dt); hover(m, W, f, K, dt);
        f.flare = Math.max(0, f.flare - dt * 3); f.calm = Math.min(1, f.calm + dt); f.kneel = Math.min(1, f.kneel + dt * 1.5);
        break;
      }
      case 'leave': {
        stop(m, dt); f.flare = 0; f.kneel = Math.min(1, f.t / 1.2);
        if (K.fam === 'drone') m.vel[1] = 1.5; else hover(m, W, f, K, dt);
        if (f.t >= 2) { f.gone = true; W.out.events.push({ k: 'gone', id: m.id, f: f.k, why: 'leave' }); }
        break;
      }
      case 'helper': {
        f.helper = true; f.calm = 1; f.flare = 0;
        const hp = f.follow ? f.follow : pp, near = f.sit ? 0.8 : 4.2;   // (at night by the home's door: close, and it sits)
        let sat = false;
        if (hp && !K.fixed) {
          const hx = hp[0] - m.pos[0], hz = hp[2] - m.pos[2], d = Math.hypot(hx, hz);
          if (d > near) steer(m, f.sit ? hp[0] : hp[0] - hx / d * 3, f.sit ? hp[2] : hp[2] - hz / d * 3, Math.min(K.speed * 1.4, 0.8 + d * 0.5), dt);
          else { stop(m, dt); if (!f.sit) faceTo(m, hx, hz, dt, 3); sat = !!f.sit; }
        } else stop(m, dt);
        f.kneel = sat ? Math.min(1, f.kneel + dt * 2) : Math.max(0, f.kneel - dt * 1.5);
        hover(m, W, f, K, dt);
        break;
      }
      default: to(m, W, 'patrol');
    }
  };
  // a hit on a foe: its weak point doubles; zero → the power-down; a hit in its warning cancels the attack
  F.hurt = function (m, dmg, from, W) {
    const f = m.foe;
    if (!f || f.gone || !(dmg > 0) || f.st === 'down' || f.st === 'leave' || f.st === 'calm' || f.st === 'helper') return 0;
    const k = F.hitFactor(m, from), d = dmg * k;
    f.hp -= d; f.hitT = 0.25; f.lastK = k;
    if (f.hp <= 0) { toDown(m, W, 'hit'); return d; }
    if (f.st === 'tele') { release(m, W); to(m, W, 'stagger'); f.cool = Math.max(f.cool, 0.8); }
    else if (f.st === 'patrol' || f.st === 'notice') to(m, W, 'approach');
    return d;
  };
  F.calm = function (m, W) { const f = m.foe; if (!f || f.gone || f.st === 'down' || f.st === 'leave') return false; release(m, W); m.vel[0] = 0; m.vel[2] = 0; to(m, W, 'calm'); return true; };
  F.leaveAll = function (list, W) { for (const m of list) { const f = m && m.foe; if (!f || f.gone || f.helper || f.st === 'down' || f.st === 'leave' || f.remote) continue; release(m, W); to(m, W, 'leave'); } };

  // ================================================================ the foe topic (pure)
  const SIDX = ['patrol', 'notice', 'approach', 'tele', 'strike', 'recover', 'stagger', 'down', 'calm', 'leave', 'helper'];
  F.MSG_R = 64; F.MSG_MAX = 24;
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  F.b64 = function (u8) { let s = ''; for (let i = 0; i < u8.length; i += 3) { const a = u8[i], b = i + 1 < u8.length ? u8[i + 1] : 0, c = i + 2 < u8.length ? u8[i + 2] : 0, n = (a << 16) | (b << 8) | c; s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < u8.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < u8.length ? B64[n & 63] : '='); } return s; };
  F.unb64 = function (s) {
    s = String(s || '').replace(/[^A-Za-z0-9+/]/g, ''); const out = new Uint8Array(Math.floor(s.length * 3 / 4)); let o = 0;
    for (let i = 0; i + 1 < s.length; i += 4) { const n = (B64.indexOf(s[i]) << 18) | (B64.indexOf(s[i + 1]) << 12) | ((i + 2 < s.length ? B64.indexOf(s[i + 2]) : 0) << 6) | (i + 3 < s.length ? B64.indexOf(s[i + 3]) : 0); if (o < out.length) out[o++] = (n >> 16) & 255; if (i + 2 < s.length && o < out.length) out[o++] = (n >> 8) & 255; if (i + 3 < s.length && o < out.length) out[o++] = n & 255; }
    return out.subarray(0, o);
  };
  const q16 = (v) => clamp(Math.round(v * 16), -32768, 32767);
  const SEL = [];
  // the host's message: ≤ 24 foes within 64 blocks of a player (12 bytes each, against a rounded origin), the bolts in
  // flight (10 bytes each), a few events and the hits on guests
  F.message = function (list, origin, extra) {
    const players = (extra && extra.players) || [origin], R2 = F.MSG_R * F.MSG_R;
    SEL.length = 0;
    for (const m of list) {
      if (!m || !m.foe || m.foe.gone || m.foe.remote) continue;
      let near = false; for (const q of players) { const dx = q[0] - m.pos[0], dz = q[2] - m.pos[2]; if (dx * dx + dz * dz <= R2) { near = true; break; } }
      if (!near) continue; SEL.push(m); if (SEL.length >= F.MSG_MAX) break;
    }
    const o = [Math.round(origin[0]), Math.round(origin[1]), Math.round(origin[2])];
    const buf = new Uint8Array(SEL.length * 12), dv = new DataView(buf.buffer);
    for (let i = 0; i < SEL.length; i++) {
      const m = SEL[i], f = m.foe, b = i * 12;
      dv.setUint16(b, m.id & 0xffff); dv.setUint8(b + 2, F.KIND_LIST.indexOf(f.k) & 15); dv.setUint8(b + 3, (SIDX.indexOf(f.st) & 15) | (f.helper ? 0x80 : 0) | (f.flare > 0.5 ? 0x40 : 0));
      dv.setInt16(b + 4, q16(m.pos[0] - o[0])); dv.setInt16(b + 6, q16(m.pos[1] - o[1])); dv.setInt16(b + 8, q16(m.pos[2] - o[2]));
      dv.setUint8(b + 10, Math.round((((m.yaw % TAU) + TAU) % TAU) / TAU * 256) & 255); dv.setUint8(b + 11, clamp(Math.round(f.hp), 0, 255));
    }
    const msg = { n: SEL.length, o, f: F.b64(buf) };
    const bolts = extra && extra.bolts;
    if (bolts && bolts.length) {
      const n = Math.min(12, bolts.length), bb = new Uint8Array(n * 10), bv = new DataView(bb.buffer);
      for (let i = 0; i < n; i++) { const q = bolts[i], b = i * 10; bv.setInt16(b, q16(q.pos[0] - o[0])); bv.setInt16(b + 2, q16(q.pos[1] - o[1])); bv.setInt16(b + 4, q16(q.pos[2] - o[2])); for (let k = 0; k < 3; k++) bv.setInt8(b + 6 + k, clamp(Math.round(q.vel[k] * 4), -127, 127)); bv.setUint8(b + 9, F.KIND_LIST.indexOf(q.k) & 15); }
      msg.b = F.b64(bb);
    }
    if (extra && extra.events && extra.events.length) msg.e = extra.events.slice(0, 16);
    if (extra && extra.hits && extra.hits.length) msg.h = extra.hits.slice(0, 8);
    return msg;
  };
  // a guest reads it (untrusted: every field checked)
  F.unpack = function (msg) {
    const out = { n: 0, origin: [0, 0, 0], foes: [], bolts: [], events: [], hits: [] };
    if (!msg || typeof msg !== 'object' || !Array.isArray(msg.o) || msg.o.length !== 3) return out;
    const o = msg.o.map(v => (Number.isFinite(+v) ? +v : 0)); out.origin = o;
    const fb = typeof msg.f === 'string' && msg.f.length <= 4 * F.MSG_MAX * 4 ? F.unb64(msg.f) : new Uint8Array(0), dv = new DataView(fb.buffer, fb.byteOffset, fb.byteLength);
    for (let b = 0; b + 12 <= fb.length && out.foes.length < F.MSG_MAX; b += 12) {
      const k = F.KIND_LIST[dv.getUint8(b + 2) & 15], s = dv.getUint8(b + 3); if (!k) continue;
      out.foes.push({ id: dv.getUint16(b), k, st: SIDX[s & 15] || 'patrol', helper: !!(s & 0x80), flare: s & 0x40 ? 1 : 0, pos: [o[0] + dv.getInt16(b + 4) / 16, o[1] + dv.getInt16(b + 6) / 16, o[2] + dv.getInt16(b + 8) / 16], yaw: dv.getUint8(b + 10) / 256 * TAU, hp: dv.getUint8(b + 11) });
    }
    out.n = out.foes.length;
    if (typeof msg.b === 'string' && msg.b.length <= 220) {
      const bb = F.unb64(msg.b), bv = new DataView(bb.buffer, bb.byteOffset, bb.byteLength);
      for (let b = 0; b + 10 <= bb.length; b += 10) out.bolts.push({ pos: [o[0] + bv.getInt16(b) / 16, o[1] + bv.getInt16(b + 2) / 16, o[2] + bv.getInt16(b + 4) / 16], vel: [bv.getInt8(b + 6) / 4, bv.getInt8(b + 7) / 4, bv.getInt8(b + 8) / 4], k: F.KIND_LIST[bv.getUint8(b + 9) & 15] || 'drone' });
    }
    if (Array.isArray(msg.e)) for (const e of msg.e.slice(0, 16)) if (Array.isArray(e) && Number.isFinite(+e[0]) && typeof e[1] === 'string') out.events.push([+e[0] & 0xffff, e[1].slice(0, 12)]);
    if (Array.isArray(msg.h)) for (const h of msg.h.slice(0, 8)) if (Array.isArray(h) && typeof h[0] === 'string' && Number.isFinite(+h[1])) out.hits.push([h[0].slice(0, 64), clamp(+h[1], 0, 6), !!h[2]]);
    return out;
  };
  // the host's check of a guest's hit: the foe in range of where the guest is, the shot from there, a clear line, a
  // possible damage, and no more than the blaster's rate (6 a second, a burst of 6)
  F.bucket = () => ({ t: null, n: 6 });
  F.checkHit = function (h) {
    if (!h || !Array.isArray(h.foe) || !Array.isArray(h.shooter) || !Array.isArray(h.origin)) return { ok: false, why: 'shape' };
    const range = h.kind === 'melee' ? 5 : 48;
    if (Math.hypot(h.foe[0] - h.shooter[0], h.foe[1] - h.shooter[1], h.foe[2] - h.shooter[2]) > range + 1) return { ok: false, why: 'range' };
    if (Math.hypot(h.origin[0] - h.shooter[0], h.origin[1] - h.shooter[1] - 1.5, h.origin[2] - h.shooter[2]) > 3) return { ok: false, why: 'origin' };
    if (!(h.dmg > 0) || h.dmg > 12) return { ok: false, why: 'dmg' };
    if (h.solid) {
      const ex = h.foe[0] - h.origin[0], ey = h.foe[1] - h.origin[1], ez = h.foe[2] - h.origin[2], L = Math.hypot(ex, ey, ez), n = Math.ceil(L / 0.5);
      for (let i = 1; i < n; i++) { const t = i / n; if (L * (1 - t) < 0.8) break; if (h.solid(Math.floor(h.origin[0] + ex * t), Math.floor(h.origin[1] + ey * t), Math.floor(h.origin[2] + ez * t))) return { ok: false, why: 'sight' }; }
    }
    const B = h.bucket || F.bucket(), t = +h.now || 0;
    if (B.t !== null) B.n = Math.min(6, B.n + Math.max(0, t - B.t) / 1000 * 6);
    B.t = t;
    if (B.n < 1) return { ok: false, why: 'rate' };
    B.n -= 1;
    return { ok: true, why: 'ok' };
  };

  // every text key the foes use (test/foes.js checks both tables)
  F.KEYS = ['g.foe.name.driller', 'g.foe.name.sentry', 'g.foe.name.crane', 'g.foe.name.drone', 'g.foe.name.wisp', 'g.foe.hearts',
    'g.foe.funke.first', 'g.foe.funke.weak', 'g.foe.funke.calm', 'g.foe.funke.drones', 'g.foe.funke.wisps', 'g.foe.funke.gift', 'g.foe.funke.faint', 'g.foe.funke.easier', 'g.foe.funke.core',
    'g.foe.faint', 'g.foe.wake.beacon', 'g.foe.wake.home', 'g.foe.easier.q', 'g.foe.easier.yes', 'g.foe.easier.no', 'g.foe.easier.done', 'g.foe.pile', 'g.foe.pileBack', 'g.foe.gift',
    'g.foe.leave', 'g.adv.taler'];

  // ================================================================================ the game
  const game = () => VR.game || null;
  F.cost = { frames: 0, ms: 0, worst: 0, ai: 0, aiMs: 0, draws: 0, drawMs: 0, spawned: 0, hits: 0, bolts: 0 };
  F.stats = { encounters: 0, faints: 0, downs: 0, calms: 0, helpers: 0 };
  F.advOn = (g) => !!(VR.Adventure && VR.Adventure.on && VR.Adventure.on() && !(g && g.meta && g.meta.guest));
  F.enc = () => (VR.Adventure && VR.Adventure.enc ? VR.Adventure.enc() : 'off');
  F.on = function (g) {
    g = g || game(); if (!g || !g.player || g.state !== 'play' || !F.advOn(g)) return false;
    return !VR.DimReg || !VR.DimReg.actorsHome || VR.DimReg.actorsHome(g.dim);   // (Herzwelt: the moons' foes come with u-moons2)
  };
  const kids = (g) => !!(g && g.settings && g.settings.kids);
  const rec = () => (VR.Adventure && VR.Adventure.rec) || null;
  // the world the AI sees (one object, refreshed once a frame)
  const GW = F.W = { t: 0, enc: 'off', band: 'normal', s: 0.4, night: 0, rnd: Math.random, tokens: new Tokens(F.MAX_ATT), player: { pos: [0, 0, 0], dead: false, light: 0 }, players: [], ground: null, light: null, out: { hits: [], bolts: [], events: [] } };
  GW.players.push(GW.player);
  let GWorld = null;
  GW.ground = (x, z) => (GWorld ? GWorld.topAt(x, z) : null);
  GW.light = (x, y, z) => { if (!GWorld) return 0; const l = GWorld.getLight(Math.floor(x), Math.floor(y), Math.floor(z)); return Math.max((l >> 8) & 15, (l >> 4) & 15, l & 15); };
  function heldLight(p) {
    const h = p.inv && p.inv.held; if (!h || !VR.R) return 0;
    const t = VR.R.byName[h.id]; if (!t) return 0;
    const e = VR.R.T.emit[t.defaultState] | 0; return Math.max((e >> 8) & 15, (e >> 4) & 15, e & 15);
  }
  function refresh(g) {
    const p = g.player, r0 = rec();
    GWorld = g.world; GW.t = g.time || 0; GW.enc = kids(g) ? 'off' : F.enc(); GW.band = r0 ? r0.band : 'normal'; GW.s = r0 ? r0.tension : 0.4;
    GW.night = g.env && g.env.E ? g.env.E.night : 0;
    GW.player.pos = p.pos; GW.player.dead = !!p.dead || !!F.fainting || !!(g.ui && g.ui.screen === 'death'); GW.player.light = heldLight(p);
    GW.players.length = 1;
    const mp = g.mp; if (mp && mp.role === 'host' && mp.remote) for (const a of mp.remote.values()) if (a && a.has && !a.dead) { const q = a.__fp || (a.__fp = { pos: null, dead: false, light: 0, peer: null }); q.pos = a.pos; q.peer = a.peer; GW.players.push(q); }
  }
  F.hpMax = () => { const r0 = rec(); return Adv() && r0 ? Adv().effects(r0.me.pts).hp : 20; };
  F.hp = null;   // the Abenteuer's own hearts outside survival (half-hearts)

  // ---------------------------------------------------------------- the frame (entities.js update → F.tick)
  F.count = 0; F.dirT = 0; F.bolts = []; F.bits = []; F.motes = 0;
  F.tick = function (En, dt) {
    const g = En.game, t0 = now();
    if (!g || !g.player) return;
    const on = F.on(g);
    if (F.fainting) F.stepFaint(g, dt);   // (a guest too: the host's foes reach it, its Ohnmacht ends here)
    if (!on) {
      if (F.count) { refresh(g); F.leaveAll(En.mobs, GW); let n = 0; for (const m of En.mobs) if (m.foe && !m.foe.gone) n++; F.count = n; }
      if (F.bolts.length) F.bolts.length = 0;
      if (F.net.proxies.size) F.stepHearts(g, dt); else F.hud(g, false);   // (a guest among the host's foes keeps its hearts)
      if (VR.Liberate && VR.Liberate.tick) VR.Liberate.tick(g, dt, false);
      return;
    }
    refresh(g);
    if ((F.dirT -= dt) <= 0) { F.dirT = 0.5; try { F.director(g, En); } catch (e) { if (!F.warned) { F.warned = true; console.warn('foes', e); } } }
    F.stepBolts(g, dt); F.stepBits(g, dt); F.stepHearts(g, dt);
    if (VR.Liberate && VR.Liberate.tick) VR.Liberate.tick(g, dt, true);
    const ms = now() - t0, C = F.cost; C.frames++; C.ms += ms; if (ms > C.worst) C.worst = ms;
  };
  // entities.js ai → a foe's step (a guest's copy only follows the host)
  F.ai = function (En, m, dt) {
    const t0 = now(), f = m.foe || (m.foe = F.make(m.def.foeKind, m.id, m.pos));
    if (f.remote) { F.follow(m, dt); return; }
    if (!GWorld) refresh(En.game);
    F.step(m, dt, GW);
    const K = F.KINDS[f.k];
    // the foe's own life: walking, the drill, the smoke, the mist, the telegraph's sparks, a power-down's parts
    const hs = Math.hypot(m.vel[0], m.vel[2]); f.walk += hs * dt * 2.4; m.walk = f.walk; m.walkAmt = hs > 0.3 ? 1 : 0;
    F.life(En, m, f, K, dt);
    if (GW.out.hits.length || GW.out.bolts.length || GW.out.events.length) F.flush(En.game);
    const C = F.cost; C.ai++; C.aiMs += now() - t0;
  };
  // what a step produced → the game
  F.flush = function (g) {
    const O = GW.out;
    for (const h of O.hits) F.hitPlayer(g, h);
    for (const b of O.bolts) { b.t = 0; F.bolts.push(b); F.cost.bolts++; if (g.audio) F.sound(g, 'bolt', b.pos); }
    for (const e of O.events) F.event(g, e);
    O.hits.length = 0; O.bolts.length = 0; O.events.length = 0;
  };
  F.sound = function (g, what, at) {
    const au = g.audio; if (!au || !au.ctx || !au.tone) return;
    const p = g.player.pos, d = at ? Math.hypot(at[0] - p[0], at[1] - p[1], at[2] - p[2]) : 0, v = clamp(1 - d / 48, 0, 1); if (v <= 0.02) return;
    const t = au.ctx.currentTime;
    if (what === 'tele') { const o = au.tone(210, 0.07 * v, 0.7, 'sawtooth', false, t); if (o && o.frequency) { o.frequency.setValueAtTime(210, t); o.frequency.exponentialRampToValueAtTime(680, t + 0.62); } au.tone(1320, 0.03 * v, 0.6, 'sine', false, t + 0.05); }
    else if (what === 'bolt') { const o = au.tone(880, 0.06 * v, 0.25, 'triangle', true, t); if (o && o.frequency) o.frequency.exponentialRampToValueAtTime(330, t + 0.25); }
    else if (what === 'down') { const o = au.tone(420, 0.09 * v, 1.4, 'sawtooth', false, t); if (o && o.frequency) o.frequency.exponentialRampToValueAtTime(70, t + 1.3); if (au.play) au.play('clatter', { vol: v }); }
    else if (what === 'calm') { [523, 659, 784].forEach((f2, i) => au.tone(f2, 0.07 * v, 0.9, 'sine', true, t + i * 0.09)); }
    else if (what === 'motes') { if (au.play) au.play('twinkle', { vol: 0.6 * v }); }
    else if (what === 'clang') { if (au.play) au.play('clang', { vol: 0.8 * v }); }
  };
  F.event = function (g, e) {
    const En = g.entities, m = En ? F.byId(En, e.id) : null;
    switch (e.k) {
      case 'notice': F.encStart(g, m); break;
      case 'tele': if (m) F.sound(g, 'tele', m.pos); if (m) F.mark(g, m); break;
      case 'strike': break;
      case 'slam': if (g.particles) { g.particles.spark(e.x, e.y + 0.2, e.z, [1, 0.35, 0.9], 22, 4); g.particles.smoke(e.x, e.y + 0.2, e.z, 6, false); } if (g.audio && g.audio.play) g.audio.play('thump', { vol: 0.5 }); break;
      case 'down': F.stats.downs++; if (m) F.sound(g, F.KINDS[m.foe.k].fam === 'stray' ? 'down' : 'motes', m.pos); break;
      case 'calm': F.stats.calms++; if (m) F.sound(g, 'calm', m.pos); break;
      case 'gone': if (m) { m.foe.gone = true; m.dead = true; m.deathT = 99; } break;
    }
    if (F.net && F.net.ev && (e.k === 'down' || e.k === 'calm' || e.k === 'tele')) F.net.ev.push([e.id & 0xffff, e.k]);
  };
  F.byId = (En, id) => { for (const m of En.mobs) if (m.id === id) return m; return null; };

  // ---------------------------------------------------------------- its life: smoke, mist, sparks, steam, parts
  F.life = function (En, m, f, K, dt) {
    const g = En.game, P = g.particles; if (!P) return;
    const p = g.player.pos, far = Math.abs(m.pos[0] - p[0]) > 70 || Math.abs(m.pos[2] - p[2]) > 70; if (far) return;
    const lite = !!(g.renderer && g.renderer.q && g.renderer.q.lite);   // (Very Low: half the smoke and mist)
    f.fx -= dt;
    if (f.fx > 0) return;
    f.fx = lite ? 0.16 : 0.08;
    const y = m.pos[1];
    if (K.fam === 'drone' && f.st !== 'down' && f.st !== 'leave') {   // the violet-black smoke halo
      const a = Math.random() * TAU, r = 0.35 + Math.random() * 0.25;
      P.spawn(m.pos[0] + Math.cos(a) * r, y + 0.35 + (Math.random() - 0.5) * 0.3, m.pos[2] + Math.sin(a) * r, Math.cos(a) * 0.3, 0.15, Math.sin(a) * 0.3, { life: 0.9, size: 0.22 + Math.random() * 0.12, grav: -0.2, col: [0.16, 0.08, 0.26], emis: 0.08, drag: 1.2, collide: false, grow: 0.35, alpha: 0.7 });
    } else if (K.fam === 'shadow' && f.st !== 'down') {   // the dark mist; the eyes glow in it
      const a = Math.random() * TAU, r = 0.25 + Math.random() * 0.45;
      P.spawn(m.pos[0] + Math.cos(a) * r, y + 0.1 + Math.random() * 0.9, m.pos[2] + Math.sin(a) * r, Math.cos(a) * 0.12, 0.08, Math.sin(a) * 0.12, { life: 1.4, size: 0.3 + Math.random() * 0.2, grav: -0.05, col: [0.07, 0.06, 0.16], emis: 0.12, drag: 0.8, collide: false, grow: 0.4, alpha: 0.55 });
      if (f.burn > 0) P.glow(m.pos[0], y + 0.8, m.pos[2], [0.9, 1, 0.75], 1.2, 0.05, 0.6);
    }
    if (f.st === 'tele') {   // the telegraph: a halo growing round the optic, sparks off it
      const oa = OPTIC_AT[f.k], oy = y + (oa ? oa[0] : K.h * 0.8), of = oa ? oa[1] : K.w * 1.2, ox = m.pos[0] - Math.sin(m.yaw) * of, oz = m.pos[2] - Math.cos(m.yaw) * of;
      // a-foes2: ONE soft red-violet halo a fx tick (its life the tick), its size bounded by the distance to the eye and
      // never opaque — the lost run of 23 Oct saw three stacked opaque lilac discs over a quarter of the screen up close
      const cm = g.cam, hd = cm ? Math.hypot(ox - cm.x, oy - cm.y, oz - cm.z) : 8, H = F.teleHalo(hd, f.flare), HO = F._ho || (F._ho = { life: 0, size: 0, grav: 0, col: [0.55, 0.12, 0.42], emis: 1, drag: 0, collide: false, alpha: 0, fade: false });
      HO.life = f.fx * 1.15; HO.size = H.size; HO.alpha = H.alpha;
      P.spawn(ox, oy, oz, 0, 0, 0, HO);
      if (Math.random() < 0.6) { const c = F.optic(m); P.spark(ox, oy, oz, [Math.min(1, c[0] * 0.5), Math.min(1, c[1] * 0.5), Math.min(1, c[2] * 0.5)], 3, 1.6, 1); }
    }
    if (f.st === 'down') {
      if (K.fam === 'stray') {
        if (Math.random() < 0.7) P.spawn(m.pos[0] + (Math.random() - 0.5) * 0.6, y + K.h * 0.6, m.pos[2] + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4, 1.4, (Math.random() - 0.5) * 0.4, { life: 1.6, size: 0.18, grav: -0.6, col: [0.86, 0.88, 0.9], emis: 0.15, drag: 1, collide: false, grow: 0.5, alpha: 0.6 });   // steam
        if (Math.random() < 0.5) P.spark(m.pos[0], y + K.h * 0.5, m.pos[2], [1, 0.65, 0.25], 4, 3, 1);   // sparks
        const n = Math.floor(f.t / 0.45); if (n > f.shed && f.shed < 3) { f.shed = n; F.shed(g, m, 'plate'); if (g.audio && g.audio.play && f.shed === 1) g.audio.play('clank', { vol: 0.5 }); }
      } else {   // light motes drifting up: the smoke torn into light, the shadow healed
        for (let i = 0; i < 3; i++) P.spawn(m.pos[0] + (Math.random() - 0.5) * 0.8, y + Math.random() * K.h, m.pos[2] + (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.3, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 0.3, { life: 2.2, size: 0.05 + Math.random() * 0.03, grav: -0.25, col: K.fam === 'shadow' ? [0.85, 1, 0.6] : [0.7, 0.9, 1], emis: 1, drag: 0.4, collide: false });
      }
    }
    if (f.st === 'calm' && f.t < 1.4 && Math.random() < 0.6) P.glow(m.pos[0] + (Math.random() - 0.5) * 0.8, y + K.h * 0.7, m.pos[2] + (Math.random() - 0.5) * 0.8, [0.5, 1, 0.75], 1.4, 0.05, 0.5);
  };
  // a-foes2 · the telegraph's halo: size (the quad's half side, blocks) ≤ 6 % of the distance to the eye (≤ ~7 % of the
  // view's height at 70°), at most 0.2; alpha ≤ 0.55 (never opaque); it grows with the flare
  F.teleHalo = (dist, flare) => { const fl = Math.max(0, Math.min(1, +flare || 0)); return { size: Math.min(0.06 + 0.14 * fl, 0.06 * Math.max(0, +dist || 0)), alpha: 0.3 + 0.25 * fl }; };
  // where the optic sits: [height, forward] in blocks (the models' layouts; the Kranarm's moves with its arm: by its size)
  const OPTIC_AT = { driller: [13 / 16, 9.5 / 16], sentry: [29 / 16, 5.5 / 16], drone: [4.5 / 16, 6 / 16], wisp: [13 / 16, 5 / 16] };
  // a plate, a gear, a shard: tumbling with a little bounce, gone in five seconds
  F.shed = function (g, m, what) {
    if (F.bits.length >= 24) F.bits.shift();
    const a = Math.random() * TAU, s = 2 + Math.random() * 2.5;
    F.bits.push({ model: 'foe_' + what, pos: [m.pos[0], m.pos[1] + F.KINDS[m.foe.k].h * 0.6, m.pos[2]], vel: [Math.cos(a) * s, 3.5 + Math.random() * 2, Math.sin(a) * s], rot: [Math.random() * 6, Math.random() * 6], spin: [(Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14], t: 0 });
  };
  F.stepBits = function (g, dt) {
    const w = g.world;
    for (let i = F.bits.length - 1; i >= 0; i--) {
      const b = F.bits[i]; b.t += dt;
      if (b.t > 5) { F.bits.splice(i, 1); continue; }
      b.vel[1] -= 20 * dt; b.pos[0] += b.vel[0] * dt; b.pos[1] += b.vel[1] * dt; b.pos[2] += b.vel[2] * dt;
      const gy = w ? w.topAt(Math.floor(b.pos[0]), Math.floor(b.pos[2])) + 1 : -1e9;
      if (b.pos[1] < gy + 0.06) { b.pos[1] = gy + 0.06; if (b.vel[1] < -1.5) { b.vel[1] *= -0.35; b.vel[0] *= 0.6; b.vel[2] *= 0.6; b.spin[0] *= 0.5; b.spin[1] *= 0.5; } else { b.vel[1] = 0; b.vel[0] *= 0.8; b.vel[2] *= 0.8; b.spin[0] *= 0.8; b.spin[1] *= 0.8; } }
      b.rot[0] += b.spin[0] * dt; b.rot[1] += b.spin[1] * dt;
    }
  };

  // ---------------------------------------------------------------- the bolts: slow, glowing, you can step aside
  F.stepBolts = function (g, dt) {
    const p = g.player, w = g.world, P = g.particles, PH = VR.PHYS;
    for (let i = F.bolts.length - 1; i >= 0; i--) {
      const b = F.bolts[i]; b.t += dt;
      if (b.t > 4) { F.bolts.splice(i, 1); continue; }
      const sx = b.vel[0] * dt, sy = b.vel[1] * dt, sz = b.vel[2] * dt, len = Math.hypot(sx, sy, sz) || 1e-6;
      // the player (and, at the host, a guest): a body 0.7 wide and 1.8 tall
      let hitP = null;
      for (const q of GW.players) { if (!q || q.dead || !q.pos) continue; const cx = q.pos[0] - b.pos[0], cy = q.pos[1] + 0.9 - b.pos[1], cz = q.pos[2] - b.pos[2]; const tt = clamp((cx * sx + cy * sy + cz * sz) / (len * len), 0, 1); const ex = cx - sx * tt, ey = cy - sy * tt, ez = cz - sz * tt; if (ex * ex + ez * ez < 0.45 * 0.45 && Math.abs(ey) < 0.95) { hitP = q; break; } }
      if (hitP) { F.hitPlayer(g, { id: b.owner, f: b.k, p: hitP, dmg: b.dmg, kind: 'bolt', x: b.pos[0], y: b.pos[1], z: b.pos[2] }); if (P) P.spark(b.pos[0], b.pos[1], b.pos[2], [0.9, 0.4, 1], 10, 2.5, 1); F.bolts.splice(i, 1); continue; }
      const hit = PH && w ? PH.raycast((x, y, z) => w.getBlock(x, y, z), b.pos[0], b.pos[1], b.pos[2], sx / len, sy / len, sz / len, len) : null;
      if (hit) { if (P) P.spark(hit.px, hit.py, hit.pz, [0.9, 0.4, 1], 8, 2, 1); F.bolts.splice(i, 1); continue; }
      b.pos[0] += sx; b.pos[1] += sy; b.pos[2] += sz;
      if (P && Math.random() < 0.8) P.spawn(b.pos[0], b.pos[1], b.pos[2], 0, 0, 0, { life: 0.35, size: 0.09, grav: 0, col: [0.85, 0.35, 1], emis: 1, collide: false, grow: -0.15 });
    }
  };

  // ---------------------------------------------------------------- the player's hearts and the Ohnmacht
  F.enc0 = null;   // the encounter: {t0, lost, n, zone}
  F.hitPlayer = function (g, h) {
    const P = h.p;
    if (P && P !== GW.player) { if (F.net && P.peer) F.net.hits.push([P.peer, h.dmg, h.chill ? 1 : 0]); return; }   // a guest's hearts are its own
    const p = g.player; if (!p || p.dead || F.fainting) return;
    F.cost.hits++;
    const max = F.hpMax(), src = [h.x, h.y, h.z];
    if (F.enc0) F.enc0.lost += h.dmg;
    if (h.chill) F.chill(g);
    if (p.mode === 'survival') {
      const d = F.dmgFor(h.dmg, 'survival', max);
      if (p.health - d <= 0.01) { F.faintStart(g); return; }
      p.damage(d, 'foe', src);
      return;
    }
    if (F.hp === null || F.hp > max) F.hp = max;
    F.hp = Math.max(0, F.hp - h.dmg); F.hpT = 0;
    g.damageFlash = 0.8; if (g.audio && g.audio.play) g.audio.play('hurt');
    if (F.hp <= 0) F.faintStart(g);
    F.hud(g, true);
  };
  F.stepHearts = function (g, dt) {
    const p = g.player, max = F.hpMax(), fight = !!F.enc0;
    if (p.mode === 'survival') { if (fight) p.regenTimer = 0; F.hp = null; }   // (the peaceful regeneration waits for the fight's end)
    else {
      if (F.hp === null) F.hp = max;
      F.hpT = (F.hpT || 0) + dt;
      if (!fight && F.hp < max && F.hpT > 4) { F.hp = Math.min(max, F.hp + dt * 2); }
    }
    if ((F.hudT = (F.hudT || 0) - dt) <= 0) { F.hudT = 0.25; F.hud(g, true); F.marks(g); }
  };
  F.chill = function (g) {
    if (typeof document === 'undefined' || !document.createElement) return;
    let el = document.getElementById('foechill');
    if (!el) { css(); el = document.createElement('div'); el.id = 'foechill'; (document.getElementById('app') || document.body).appendChild(el); }
    el.className = ''; void el.offsetWidth; el.className = 'on';
  };
  // Ohnmacht: a fade; waking at the last freed beacon or at home with everything kept (Schwer: a few Taler stay behind)
  F.fainting = null;
  F.faintStart = function (g) {
    if (F.fainting) return;
    const p = g.player, r0 = rec();
    F.stats.faints++;
    F.fainting = { t: 0, moved: false, at: [p.pos[0], p.pos[1], p.pos[2]] };
    if (r0) {
      const lost = F.lostTaler(r0.band, r0.me.taler | 0);
      if (lost > 0 && Adv().pay(r0.me, lost)) { F.pile = { pos: [p.pos[0], p.pos[1], p.pos[2]], n: lost }; if (VR.Adventure.renderHud) VR.Adventure.renderHud(); }
      const q = F.faint(r0, Date.now()); F.fainting.offer = !!(q && q.offer);
    }
    if (F.enc0) { F.encEnd(g, true); }
    F.leaveAll(g.entities ? g.entities.mobs : [], GW);
    F.veil(true);
  };
  F.stepFaint = function (g, dt) {
    const S = F.fainting; if (!S) return;
    S.t += dt;
    const p = g.player;
    p.vel[0] = 0; p.vel[2] = 0;
    if (S.t >= 1.1 && !S.moved) {
      S.moved = true;
      const L = VR.Liberate, r0 = rec(), freed = [];
      if (L && L.freedList && r0) for (const s of L.freedList(r0)) freed.push({ id: s.id, pos: s.beacon ? [s.beacon[0] + 0.5, s.beacon[1] + 1, s.beacon[2] + 2.5] : [s.x, s.y + 2, s.z], t: s.t || s.day || 0 });
      const NL = VR.NewLife, h = NL && NL.home ? NL.home(g) : null;
      const home = h && h.dim === g.dim && Array.isArray(h.pos) ? h.pos : (Array.isArray(p.spawn) && p.spawn.every(Number.isFinite) ? p.spawn : g.worldSpawn ? g.worldSpawn() : [0.5, 100, 0.5]);
      const wk = F.wake({ freed, home }); S.why = wk.why;
      try { p.safeTeleport(wk.pos[0], wk.pos[1], wk.pos[2]); } catch (e) { p.pos = wk.pos.slice(); }
      if (p.mode === 'survival') { p.health = 20; if (g.ui && g.ui.updateHUD) g.ui.updateHUD(true); }
      F.hp = F.hpMax();
    }
    if (S.t >= 2.2) {
      F.fainting = null; F.veil(false);
      const fk = g.funke;
      const say = (txt) => { if (fk && fk.on && fk.on() && fk.show) fk.show(txt); else if (g.ui && g.ui.toast) g.ui.toast(txt, '', null); };
      say(T('g.foe.funke.faint') + ' ' + T(S.why === 'beacon' ? 'g.foe.wake.beacon' : 'g.foe.wake.home'));
      if (F.pile) setTimeout(() => { if (g.ui && g.ui.hint) g.ui.hint(T('g.foe.pile', { taler: T('g.adv.taler', { n: F.pile ? F.pile.n : 0 }) }), 4200); }, 3200);
      if (S.offer) setTimeout(() => F.easier(g), 4500);
    }
  };
  F.stepPile = function (g) {
    const P = F.pile; if (!P) return;
    const p = g.player.pos;
    if (Math.hypot(p[0] - P.pos[0], p[1] - P.pos[1], p[2] - P.pos[2]) < 1.6) {
      const r0 = rec(); if (r0) { Adv().earn(r0.me, P.n); if (VR.Adventure.renderHud) VR.Adventure.renderHud(); }
      if (g.ui && g.ui.hint) g.ui.hint(T('g.foe.pileBack', { taler: T('g.adv.taler', { n: P.n }) }), 2600);
      if (g.audio && g.audio.play) g.audio.play('pop');
      F.pile = null;
    }
  };
  // two faints in ten minutes: Funke asks — a band down only on yes (never silently)
  F.easier = function (g) {
    if (typeof document === 'undefined' || !document.createElement) return;
    css();
    let el = document.getElementById('foeeasy');
    if (!el) { el = document.createElement('div'); el.id = 'foeeasy'; (document.getElementById('app') || document.body).appendChild(el); }
    el.innerHTML = `<div class="q">${esc(T('g.foe.easier.q'))}</div><div class="r"><button type="button" class="btn primary" data-v="yes">${esc(T('g.foe.easier.yes'))}</button><button type="button" class="btn small" data-v="no">${esc(T('g.foe.easier.no'))}</button></div>`;
    el.className = 'on';
    const fk = g.funke; if (fk && fk.on && fk.on() && fk.show) fk.show(T('g.foe.funke.easier'));
    for (const b of el.querySelectorAll('button')) b.onclick = () => {
      el.className = '';
      if (b.getAttribute('data-v') === 'yes') { const r0 = rec(); const nb = r0 ? Adv().easier(r0) : null; if (nb && g.ui && g.ui.toast) g.ui.toast(T('g.foe.easier.done', { band: T('g.adv.band.' + nb) }), '', null); if (g.saveMeta) { try { const q = g.saveMeta(); if (q && q.catch) q.catch(() => {}); } catch (e) { /* the autosave keeps it */ } } }
    };
  };
  F.veil = function (on) {
    if (typeof document === 'undefined' || !document.createElement) return;
    let el = document.getElementById('foeveil');
    if (!el) { css(); el = document.createElement('div'); el.id = 'foeveil'; el.innerHTML = '<span></span>'; (document.getElementById('app') || document.body).appendChild(el); }
    const sp = el.querySelector('span'); if (sp) sp.textContent = on ? T('g.foe.faint') : '';
    el.className = on ? 'on' : '';
  };

  // ---------------------------------------------------------------- the encounter: Spannung, the event log, Funke
  F.encStart = function (g, m) {
    if (F.enc0 || !m) return;
    const f = m.foe, z = f.zone;
    F.enc0 = { t0: g.time || 0, lost: 0, n: 0, zone: z ? z.id : null, quiet: 0, kind: f.k };
    F.stats.encounters++;
    const A = VR.Adventure; if (z && z.id && A && A.sess && Adv().provoke) Adv().provoke(A.sess, z.id, Date.now());
    if (VR.EventLog && VR.EventLog.emit) VR.EventLog.emit('encounter', f.k, 4, [m.pos[0], m.pos[1] + 1, m.pos[2]], 'foes', 8);
    F.funkeOnce(g, F.KINDS[f.k].fam === 'drone' ? 'drones' : F.KINDS[f.k].fam === 'shadow' ? 'wisps' : 'first');
    F.gift(g);
  };
  F.encTick = function (g, En) {
    const E = F.enc0; if (!E) return;
    let n = 0; const p = g.player.pos;
    for (const m of En.mobs) { const f = m.foe; if (!f || f.gone || f.remote || f.helper) continue; if (f.st === 'notice' || f.st === 'approach' || f.st === 'tele' || f.st === 'strike' || f.st === 'recover' || f.st === 'stagger') { if (Math.abs(m.pos[0] - p[0]) < 64 && Math.abs(m.pos[2] - p[2]) < 64) n++; } }
    E.n = Math.max(E.n, n);
    E.quiet = n ? 0 : E.quiet + 0.5;
    if (E.quiet >= 3) F.encEnd(g, false);
  };
  F.encEnd = function (g, fainted) {
    const E = F.enc0; if (!E) return; F.enc0 = null;
    const r0 = rec(); if (!r0) return;
    const dur = Math.max(1, (g.time || 0) - E.t0 - (fainted ? 0 : 3));
    F.after(r0, { lost: fainted ? F.hpMax() : E.lost, max: F.hpMax(), dur, n: Math.max(1, E.n) });
    if (F.zoneRest && E.zone) F.zoneRest[E.zone] = (g.time || 0) + (F.enc() === 'rare' ? F.REST.rare : F.REST.normal);
  };
  F.zoneRest = {};
  // Funke's word, once a world for each kind of thing (the record's flags)
  F.funkeOnce = function (g, kind) {
    const r0 = rec(); if (!r0) return false;
    const fl = r0.foeSaid || (r0.foeSaid = {}); if (fl[kind]) return false; fl[kind] = 1;
    const fk = g.funke, key = VR.Binds && VR.Binds.label ? VR.Binds.label('KeyV', VR.I18N && VR.I18N.lang) : 'V';
    const txt = T('g.foe.funke.' + kind, { key });
    if (fk && fk.on && fk.on() && fk.show) fk.show(txt); else if (g.ui && g.ui.hint) g.ui.hint(txt, 4200);
    return true;
  };
  // the first encounter: a Pulse Blaster if the player has none (it never harms people or animals)
  F.gift = function (g) {
    const p = g.player, inv = p && p.inv; if (!inv || !VR.itemDef || !VR.itemDef('laser_blaster')) return;
    const r0 = rec(); if (!r0 || (r0.foeSaid && r0.foeSaid.gift)) return;
    let has = false; for (const s of inv.slots || []) if (s && s.id === 'laser_blaster') has = true;
    (r0.foeSaid || (r0.foeSaid = {})).gift = 1;
    if (has) return;
    if (inv.add && inv.add('laser_blaster', 1) > 0) { inv.changed = true; setTimeout(() => F.funkeOnce(g, 'gift'), 2600); if (g.ui && g.ui.hint) g.ui.hint(T('g.foe.gift'), 3600); }
  };

  // ---------------------------------------------------------------- a hit on a foe, a foe gone (entities.js)
  F.hurtMob = function (En, m, dmg, from) {
    const g = En.game, f = m.foe; if (!f) return;
    if (f.remote) { if (F.netHit) F.netHit(g, m, dmg, from); if (g.particles) g.particles.spark(m.pos[0], m.pos[1] + m.h * 0.6, m.pos[2], [1, 0.75, 0.4], 6, 2.5, 1); return; }
    refresh(g);
    const d = F.hurt(m, dmg, from, GW);
    if (d > 0) {
      const K = F.KINDS[f.k], strong = f.lastK >= 2;
      if (g.particles) g.particles.spark(m.pos[0], m.pos[1] + K.h * 0.6, m.pos[2], strong ? [0.6, 1, 0.9] : K.fam === 'shadow' ? [0.8, 1, 0.7] : [1, 0.7, 0.35], strong ? 16 : 8, 3, 1);
      F.sound(g, K.fam === 'stray' ? 'clang' : 'motes', m.pos);
      if (strong) F.funkeOnce(g, 'core');
    } else if (f.lastK < 0.5 && g.particles) g.particles.spark(m.pos[0], m.pos[1] + 1, m.pos[2], [0.8, 0.85, 1], 5, 1.5, 1);   // (the shield holds)
    F.flush(g);
  };
  F.gone = function (En, m) {
    const g = En.game, f = m.foe; if (!f || f.remote) return;
    const K = F.KINDS[f.k], P = g.particles;
    if (f.why === 'hit' || f.why === 'light') {
      const d = F.drops(f.k, Math.random);
      for (const [id, n] of d.items) if (VR.itemDef(id) || (VR.R && VR.R.byName[id])) En.dropStack({ id, n }, false, [m.pos[0], m.pos[1] + 0.5, m.pos[2]]);
      for (const what of d.parts) F.shed(g, m, what);
      if (P) for (let i = 0; i < d.motes; i++) P.spawn(m.pos[0] + (Math.random() - 0.5), m.pos[1] + Math.random() * K.h, m.pos[2] + (Math.random() - 0.5), (Math.random() - 0.5) * 0.4, 0.7 + Math.random() * 0.8, (Math.random() - 0.5) * 0.4, { life: 2.6, size: 0.05 + Math.random() * 0.03, grav: -0.2, col: K.fam === 'shadow' ? [0.85, 1, 0.55] : [0.6, 0.95, 1], emis: 1, drag: 0.35, collide: false });
      const A = VR.Adventure;
      if (A && A.award) A.award('foe', { kind: f.k, zone: f.zone ? f.zone.id : undefined });
      const r0 = rec(); if (r0 && d.taler > 0 && A) { Adv().earn(r0.me, d.taler); A.floatTaler = (A.floatTaler || 0) + d.taler; if (A.schedule) A.schedule(); }
      if (f.site && !f.wave && K.fam === 'stray' && VR.Liberate && VR.Liberate.resolved) VR.Liberate.resolved(g, f.site, 'down');
    }
  };
  // a calmed stray (liberate.js's timing ring)
  F.calmMob = function (g, m) { refresh(g); const ok = F.calm(m, GW); if (ok && VR.Adventure && VR.Adventure.award) VR.Adventure.award('foe', { kind: m.foe.k, zone: m.foe.zone ? m.foe.zone.id : undefined }); F.flush(g); return ok; };

  // ---------------------------------------------------------------- the director: guardians, swarms, shadows
  F.ctx = function (g) {
    const p = g.player, A = VR.Adventure, r0 = rec(), L = VR.Liberate, V = g.villages;
    const homes = [], freed = [];
    const NL = VR.NewLife, h = NL && NL.home ? NL.home(g) : null; if (h && h.dim === g.dim && Array.isArray(h.pos)) homes.push(h.pos);
    if (Array.isArray(p.spawn) && p.spawn.every(Number.isFinite)) homes.push(p.spawn);
    if (L && L.freedList && r0) for (const s of L.freedList(r0)) freed.push([s.x, s.z]);
    return { enc: kids(g) ? 'off' : F.enc(), kids: kids(g), villages: (V && V.sites) || [], homes, freed, lastBuild: A && A.lastBuildAt ? A.lastBuildAt : -1e12, now: Date.now(), zones: L && L.zones ? L.zones(g) : [], night: !!(g.env && g.env.E && g.env.E.night > 0.5) };
  };
  F.director = function (g, En) {
    let n = 0; for (const m of En.mobs) if (m.foe && !m.foe.gone) n++;
    F.count = n;
    F.encTick(g, En);
    F.stepPile(g);
    const L = VR.Liberate; if (!L || !L.zones || F.fainting) return;
    const ctx = F.ctx(g), p = g.player.pos;
    for (const z of ctx.zones) {
      const d = Math.hypot(p[0] - z.x, p[2] - z.z);
      if (ctx.kids && z.site && L.state(z.site) === 'stoer' && d < 140) { L.setStrays(z.site, z.site.res | 0); L.save(null, z.site); continue; }   // (Kindersicher: no machine at all — the Lichtleiter alone frees it)
      if (z.kind === 'outpost' && z.site && L.state(z.site) === 'stoer' && d < 76 && !ctx.kids) F.guardians(g, En, z, ctx);
      if (ctx.enc !== 'off' && ctx.night && d < 52 && (z.kind === 'ruin' || (z.kind === 'outpost' && z.site && L.state(z.site) !== 'frei'))) F.shadows(g, En, z, ctx);
    }
  };
  const mine = (En, siteId, pred) => { let n = 0; for (const m of En.mobs) { const f = m.foe; if (f && !f.gone && !f.remote && f.site === siteId && (!pred || pred(f))) n++; } return n; };
  F.spot = function (g, x, z, r, rnd, rmin) {
    const w = g.world, r0 = rmin || 0;
    for (let k = 0; k < 10; k++) {
      const a = rnd() * TAU, d = r0 + (r - r0) * Math.sqrt(rnd()), xx = Math.floor(x + Math.cos(a) * d), zz = Math.floor(z + Math.sin(a) * d);
      if (!w.isLoaded(xx, zz)) continue;
      const y = w.topAt(xx, zz), b = w.getBlock(xx, y, zz), R = VR.R, Fl = VR.F;
      if (!b || !(R.T.flags[b] & Fl.SOLID) || (R.T.flags[b] & Fl.FLUID)) continue;
      if (w.getBlock(xx, y + 1, zz) || w.getBlock(xx, y + 2, zz)) continue;
      return [xx + 0.5, y + 1, zz + 0.5];
    }
    return null;
  };
  // the outpost's guardians: its strays (with Begegnungen aus they wait, confused, to be calmed) — the calmed ones kneel
  // where they were calmed; the powered-down ones are gone for good (site.res counts both, site.cal the calmed)
  F.guardians = function (g, En, z, ctx) {
    const L = VR.Liberate, s = z.site;
    if (typeof s.strays !== 'number') { L.setStrays(s, F.groupSize(GW.band, GW.s, L.rng(s.id))); L.save(null, s); }   // (null ≥ 0 is true in JS: the type decides; kept in the record from now on)
    let liveD = 0, liveC = 0;   // (one powering down still counts until it is gone and resolved: no stand-in meanwhile)
    for (const m of En.mobs) { const f = m.foe; if (!f || f.gone || f.remote || f.site !== s.id || f.wave || f.helper) continue; if (f.st === 'calm') liveC++; else liveD++; }
    const wantD = Math.max(0, s.strays - s.res), wantC = Math.max(0, s.cal | 0);
    if (liveD >= wantD && liveC >= wantC) return;
    const pctx = Object.assign({}, ctx, { enc: 'normal' });   // (guardians stand in their outpost also without Begegnungen; the 48-block rule and Bauruhe hold)
    for (let i = liveD; i < wantD; i++) F.guard(g, En, s, i + s.res, false, pctx);
    for (let i = liveC; i < wantC; i++) F.guard(g, En, s, i, true, pctx);
  };
  // one guardian: the first a Kranarm on the tower (from 4×4 sites on), then Bohrläufer and Wächter in turn
  F.guard = function (g, En, s, idx, calm, ctx) {
    const L = VR.Liberate;
    const kind = !calm && idx === 0 && s.tier >= 4 && L.towerSpot ? 'crane' : (idx % 2 ? 'sentry' : 'driller');
    const pt = kind === 'crane' ? L.towerSpot(s, g) : F.spot(g, s.x, s.z, 14, Math.random, PAD_R);   // (round the pad: its middle holds the parked ship)
    if (!pt || !F.spawnOk(pt, ctx, kind).ok) return null;
    const m = En.summon('foe_' + kind, pt[0], pt[1], pt[2]); if (!m) return null;
    m.foe = F.make(kind, m.id, pt); m.foe.site = s.id; m.foe.zone = { id: 'o:' + s.id, kind: 'outpost', x: s.x, z: s.z, r: F.ZONE_R.outpost };
    if (calm) { m.foe.st = 'calm'; m.foe.calm = 1; m.foe.kneel = 1; }
    m.yaw = Math.random() * TAU;
    F.cost.spawned++;
    return m;
  };
  // a swarm of shadow drones (the capture ring's waves)
  F.swarm = function (g, x, y, z, siteId) {
    const En = g.entities; if (!En || F.enc() === 'off' || kids(g)) return 0;
    const n = F.swarmSize(GW.band, GW.s, Math.random), a0 = Math.random() * TAU;
    let k = 0;
    for (let i = 0; i < n; i++) {
      const a = a0 + i * 0.5, r = 22 + Math.random() * 6, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      const gy = g.world.isLoaded(Math.floor(px), Math.floor(pz)) ? g.world.topAt(Math.floor(px), Math.floor(pz)) : y;
      const m = En.summon('foe_drone', px, Math.max(gy + 7, y + 4), pz); if (!m) continue;
      m.foe = F.make('drone', m.id, m.pos); m.foe.site = siteId || null; m.foe.wave = true; m.foe.zone = siteId ? { id: 'o:' + siteId, kind: 'outpost', x, z, r: 40 } : null;
      m.foe.st = 'approach'; m.foe.cool = 1.5 + i * 0.6; k++;
    }
    F.cost.spawned += k;
    return k;
  };
  // the night's shadows round a ruin or a disturbed outpost (a group by band, then the zone rests)
  F.shadows = function (g, En, z, ctx) {
    const key = z.id || (z.x + '_' + z.z), t = g.time || 0;
    if ((F.zoneRest[key] || 0) > t) return;
    let have = 0; for (const m of En.mobs) if (m.foe && !m.foe.gone && m.foe.k === 'wisp' && Math.abs(m.pos[0] - z.x) < 60 && Math.abs(m.pos[2] - z.z) < 60) have++;
    if (have) return;
    const n = Math.min(3, F.groupSize(GW.band, GW.s, Math.random));
    let k = 0;
    for (let i = 0; i < n; i++) {
      const pt = F.spot(g, z.x, z.z, (z.r || 32) * 0.8, Math.random); if (!pt) continue;
      if (!F.spawnOk(pt, ctx, 'wisp').ok) continue;
      if (GW.light(pt[0], pt[1] + 0.5, pt[2]) >= 8) continue;
      const m = En.summon('foe_wisp', pt[0], pt[1] + 0.3, pt[2]); if (!m) continue;
      m.foe = F.make('wisp', m.id, pt); m.foe.zone = { id: key, kind: z.kind, x: z.x, z: z.z, r: z.r }; k++;
    }
    F.zoneRest[key] = t + (k ? 30 : 10);
    F.cost.spawned += k;
  };

  // ---------------------------------------------------------------- drawing (entities.js draw → F.draw; the vox program is bound)
  const mat4 = VR.mat4, M1 = mat4 ? mat4.create() : null, MB = mat4 ? mat4.create() : null, IDENT = mat4 ? mat4.create() : null;
  const ONE = [1, 1, 1];
  // the tint and the flash a part sets only when they change (a part: three GL calls, not five); NaN: not known yet
  let T0 = NaN, T1 = NaN, T2 = NaN, FL = NaN;
  const glUnknown = () => { T0 = T1 = T2 = FL = NaN; };
  function tintTo(gl, p, c) { if (c[0] !== T0 || c[1] !== T1 || c[2] !== T2) { T0 = c[0]; T1 = c[1]; T2 = c[2]; gl.uniform3f(p.u.u_tint, T0, T1, T2); } }
  function flashTo(gl, p, v) { if (v !== FL) { FL = v; gl.uniform1f(p.u.u_flash, v); } }
  function part(r, p, model, name, base, L, rx, ry, rz, tint, flash) {
    const pr = model.parts[name]; if (!pr) return;
    const gl = r.gl, t = M1; t.set(base);
    const lay = model.def.layout[name] || [0, 0, 0];
    mat4.translate(t, t, L ? L[0] : lay[0], L ? L[1] : lay[1], L ? L[2] : lay[2]);
    if (ry) mat4.rotY(t, t, ry); if (rx) mat4.rotX(t, t, rx); if (rz) mat4.rotZ(t, t, rz);
    tintTo(gl, p, tint || ONE); flashTo(gl, p, flash || 0);
    gl.uniformMatrix4fv(p.u.u_model, false, t);
    gl.bindVertexArray(pr.vao); gl.drawArrays(gl.TRIANGLES, 0, pr.count);
    F.cost.draws++;
  }
  // a machine at rest is drawn whole (one mesh, foemodels.js) on Very Low — the animation is off there — and beyond
  // LOD_D; its warning, strike, power-down and kneeling keep every part (the warning has to read)
  const LOD_D = 28, REST = { patrol: 1, notice: 1, approach: 1, helper: 1, calm: 1 };
  const LP = [0, 0, 0], CORE = [0, 0, 0];
  F.draw = function (En, r, p, m, cam, time) {
    const t0 = now(), f = m.foe; if (!f || !mat4) return;
    const K = F.KINDS[f.k], gl = r.gl, model = VR.getVoxModel(gl, K.model); if (!model) return;
    const light = En.lightAt(m.pos[0], m.pos[1] + K.h * 0.6, m.pos[2]);
    gl.uniform1f(p.u.u_sky, light.sky); gl.uniform3f(p.u.u_blockLight, light.bl[0], light.bl[1], light.bl[2]);
    // (the terrain's shade toward the sun: a ray through the height map, so once every few frames per foe)
    if (p.u.u_sunShadow) { if (!((f.shadeN = (f.shadeN | 0) - 1) > 0)) { f.shade = En.sunShade ? En.sunShade(m.pos, K.h * 0.6) : 0; f.shadeN = 6; } gl.uniform1f(p.u.u_sunShadow, f.shade || 0); }
    gl.uniform1f(p.u.u_noFog, 0);
    glUnknown();
    const B = MB; B.set(IDENT);
    const kn = f.kneel || 0, bob = K.fly ? Math.sin(f.spin * 2.2 + f.id) * 0.05 : 0;
    mat4.translate(B, B, m.pos[0] - cam.x, m.pos[1] - cam.y + bob - kn * K.kneel / 16, m.pos[2] - cam.z);
    mat4.rotY(B, B, m.yaw);
    if (f.st === 'tele' && f.k === 'driller') mat4.rotX(B, B, -0.1 * f.flare);
    if (f.st === 'recover' && f.k === 'driller') mat4.rotX(B, B, -0.22);
    if (kn && f.k !== 'drone') mat4.rotX(B, B, -0.12 * kn);
    if (f.k === 'drone') { mat4.rotZ(B, B, clamp(m.vel[0] * 0.05, -0.3, 0.3)); if (f.st === 'down') mat4.rotX(B, B, f.t * 4); }
    const sc = f.st === 'down' && K.fam === 'shadow' ? Math.max(0.05, 1 - f.t / F.DOWN_T.shadow) : f.st === 'leave' && K.fam !== 'stray' ? Math.max(0.05, 1 - f.t / 2) : 1;
    mat4.scale(B, B, sc / 16, sc / 16, sc / 16);
    const opt = F.optic(m), fl = f.hitT > 0 ? 0.7 : 0;
    // the core: red-violet like the optic, cyan in a Helfer, brighter where Funke marks it (hints, Spürsinn)
    const hint = (Adv() && rec() ? Adv().hints(rec().tension) : 0) + ((rec() && rec().me.pts.spu >= 3) ? 1 : 0), glow = hint ? 1.6 : 1;
    if (f.helper || f.st === 'helper') { CORE[0] = 0.35; CORE[1] = 1.2; CORE[2] = 1.4; } else { CORE[0] = opt[0] * glow; CORE[1] = opt[1] * glow; CORE[2] = opt[2] * glow; }
    const s = Math.sin(f.walk * 3) * 0.6 * (m.walkAmt || 0);
    const st = En.game && En.game.settings, cdx = m.pos[0] - cam.x, cdz = m.pos[2] - cam.z;
    if (model.parts.whole && REST[f.st] && kn < 0.02 && ((st && st.anim === false) || cdx * cdx + cdz * cdz > LOD_D * LOD_D)) {
      part(r, p, model, 'whole', B, null, 0, 0, 0, null, fl);
      part(r, p, model, 'optic', B, null, 0, 0, 0, opt, 0);
      if (model.parts.core) part(r, p, model, 'core', B, null, 0, 0, 0, CORE, 0);
    } else switch (f.k) {
      case 'driller': {
        const sp = kn * 0.75;
        part(r, p, model, 'leg_fl', B, null, s, 0, -sp, null, fl); part(r, p, model, 'leg_br', B, null, s, 0, sp, null, fl);
        part(r, p, model, 'leg_fr', B, null, -s, 0, sp, null, fl); part(r, p, model, 'leg_bl', B, null, -s, 0, -sp, null, fl);
        part(r, p, model, 'body', B, null, 0, 0, 0, null, fl);
        f.drill = (f.drill || 0) + (f.st === 'tele' ? 26 : f.st === 'strike' ? 34 : f.st === 'down' || f.st === 'calm' || f.helper ? 0 : 5) * 0.016;
        part(r, p, model, 'drill', B, null, 0, 0, f.drill, null, fl);
        part(r, p, model, 'optic', B, null, 0, 0, 0, opt, 0);
        part(r, p, model, 'core', B, null, 0, 0, 0, CORE, 0);
        break;
      }
      case 'sentry': {
        const bend = kn * 0.9;
        part(r, p, model, 'leg_l', B, null, s - bend, 0, 0, null, fl); part(r, p, model, 'leg_r', B, null, -s - bend, 0, 0, null, fl);
        part(r, p, model, 'body', B, null, 0, 0, 0, null, fl); part(r, p, model, 'head', B, null, 0, 0, 0, null, fl);
        part(r, p, model, 'optic', B, null, 0, 0, 0, opt, 0); part(r, p, model, 'core', B, null, 0, 0, 0, CORE, 0);
        const aside = f.st === 'tele' ? Math.min(1, f.t / 0.35) : f.st === 'strike' ? 1 : f.st === 'recover' ? Math.max(0, 1 - f.t / 0.5) : 0;
        part(r, p, model, 'arm', B, null, -0.4 * aside + s * 0.3, 0, 0, null, fl);
        part(r, p, model, 'shield', B, null, kn * 0.6, -1.25 * aside, 0, null, fl);
        break;
      }
      case 'crane': {
        part(r, p, model, 'base', B, null, 0, 0, 0, null, fl); part(r, p, model, 'core', B, null, 0, 0, 0, CORE, 0);
        const ax = f.st === 'tele' ? -0.45 * f.flare : f.st === 'strike' ? 0.35 : f.st === 'recover' ? 0.3 * Math.max(0, 1 - f.t / A0(f)) : kn * 0.5;
        part(r, p, model, 'arm', B, null, ax, 0, 0, null, fl);
        const la = model.def.layout.arm; LP[0] = 0; LP[1] = la[1] + 22 * Math.sin(ax) - 1; LP[2] = la[2] - 22 * Math.cos(ax);
        part(r, p, model, 'head', B, LP, 0, 0, 0, null, fl);
        LP[1] += 3; LP[2] -= 4.5; part(r, p, model, 'optic', B, LP, 0, 0, 0, opt, 0);
        break;
      }
      case 'drone': {
        part(r, p, model, 'shell', B, null, 0, 0, 0, null, fl); part(r, p, model, 'optic', B, null, 0, 0, 0, opt, 0);
        if (f.st !== 'down') part(r, p, model, 'ring', B, null, 0, f.spin * 2.4, 0, null, 0);
        break;
      }
      case 'wisp': {
        const br = 1 + Math.sin(f.spin * 1.7 + f.id) * 0.04;
        mat4.scale(B, B, br, 1 / br, br);
        part(r, p, model, 'body', B, null, 0, Math.sin(f.spin * 0.6) * 0.2, 0, null, 0);
        const eye = f.st === 'tele' || f.st === 'strike' ? 1 + f.flare * 1.6 : 1;
        LP[0] = 0.75 * eye; LP[1] = 0.95 * eye; LP[2] = 1.05 * eye;
        part(r, p, model, 'optic', B, null, 0, 0, 0, LP, 0);
        break;
      }
    }
    tintTo(gl, p, ONE); flashTo(gl, p, 0);   // (the program's tint as the next model expects it)
    F.cost.drawMs += now() - t0;
  };
  const A0 = (f) => F.KINDS[f.k].att.recover;
  // the shed parts, the bolts and a pile of Taler (after the mobs, the same program)
  F.drawExtra = function (En, r, p, cam) {
    if (!mat4 || (!F.bits.length && !F.bolts.length && !F.pile && !(F.rbolts && F.rbolts.length))) return;
    const gl = r.gl, t0 = now();
    glUnknown();
    const one = (name, pos, rx, ry, sc, tint) => {
      const md = VR.getVoxModel(gl, name); if (!md) return;
      const B = MB; B.set(IDENT); mat4.translate(B, B, pos[0] - cam.x, pos[1] - cam.y, pos[2] - cam.z); if (ry) mat4.rotY(B, B, ry); if (rx) mat4.rotX(B, B, rx); mat4.scale(B, B, sc / 16, sc / 16, sc / 16);
      const L = En.lightAt(pos[0], pos[1] + 0.2, pos[2]); gl.uniform1f(p.u.u_sky, L.sky); gl.uniform3f(p.u.u_blockLight, L.bl[0], L.bl[1], L.bl[2]); if (p.u.u_sunShadow) gl.uniform1f(p.u.u_sunShadow, 0);
      part(r, p, md, 'p', B, null, 0, 0, 0, tint, 0);
    };
    for (const b of F.bits) one(b.model, b.pos, b.rot[0], b.rot[1], b.t > 4 ? Math.max(0.05, 5 - b.t) : 1, null);
    const BT = [1.6, 0.55, 2.0];
    for (const b of F.bolts) one('foe_bolt', b.pos, 0, b.t * 6, 1.1, BT);
    if (F.rbolts) for (const b of F.rbolts) one('foe_bolt', b.pos, 0, 0, 1.1, BT);
    if (F.pile) one('foe_pile', F.pile.pos, 0, (r.frame || 0) * 0.02, 1.2, null);
    tintTo(gl, p, ONE); flashTo(gl, p, 0);
    F.cost.drawMs += now() - t0;
  };

  // ---------------------------------------------------------------- the HUD: hearts outside survival, warnings off-screen
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let hudEl = null, hudKey = '';
  F.hud = function (g, on) {
    if (typeof document === 'undefined' || !document.createElement) return;
    const p = g && g.player, show = !!(on && p && p.mode !== 'survival' && F.hp !== null && (F.enc0 || F.hp < F.hpMax() - 0.01) && !g.hideHud);
    if (!hudEl && !show) return;
    if (!hudEl) { css(); hudEl = document.createElement('div'); hudEl.id = 'foehearts'; const host = document.getElementById('hud') || document.body; host.appendChild(hudEl); }
    const max = F.hpMax(), hp = Math.max(0, F.hp || 0), key = show ? Math.ceil(hp) + '/' + max : 'off';
    if (key === hudKey) return; hudKey = key;
    if (!show) { hudEl.style.display = 'none'; return; }
    let h = '';
    for (let i = 0; i < max / 2; i++) { const v = hp - i * 2; h += `<i class="${v >= 2 ? 'f' : v >= 1 ? 'h' : 'e'}"></i>`; }
    hudEl.innerHTML = h; hudEl.style.display = '';
    hudEl.setAttribute('aria-label', T('g.foe.hearts') + ' ' + Math.ceil(hp / 2) + '/' + (max / 2));
  };
  // an attack being announced outside the view: a small red-violet chevron at the screen's edge toward it
  const MARKS = [];
  F.mark = function (g, m) { if (MARKS.length < 4) MARKS.push({ m, t: 1.1 }); };
  F.marks = function (g) {
    if (typeof document === 'undefined' || !document.createElement) return;
    const r = g.renderer, vp = r && r.viewProj, cam = g.cam; if (!vp || !cam) return;
    let box = document.getElementById('foemarks');
    if (!MARKS.length) { if (box && box.childElementCount) box.innerHTML = ''; return; }
    if (!box) { css(); box = document.createElement('div'); box.id = 'foemarks'; (document.getElementById('app') || document.body).appendChild(box); }
    let h = '';
    for (let i = MARKS.length - 1; i >= 0; i--) {
      const q = MARKS[i]; q.t -= 0.25; const m = q.m;
      if (q.t <= 0 || !m.foe || m.foe.gone || (m.foe.st !== 'tele' && m.foe.st !== 'strike')) { MARKS.splice(i, 1); continue; }
      const x = m.pos[0] - cam.x, y = m.pos[1] + 1 - cam.y, z = m.pos[2] - cam.z;
      const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15], cx = (vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / (cw || 1e-6), cy = (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / (cw || 1e-6);
      if (cw > 0 && Math.abs(cx) < 0.92 && Math.abs(cy) < 0.92) continue;   // (in view: the flare says it)
      let ax = cw > 0 ? cx : -cx, ay = cw > 0 ? cy : -cy; const l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l;
      h += `<i style="left:${(50 + ax * 44).toFixed(1)}%;top:${(50 - ay * 40).toFixed(1)}%;transform:translate(-50%,-50%) rotate(${(Math.atan2(-ay, ax) * 180 / Math.PI).toFixed(0)}deg)"></i>`;
    }
    box.innerHTML = h;
  };

  // ---------------------------------------------------------------- multiplayer: the host's topic `foe` (8 Hz), a guest's copies
  F.net = { t: 0, ev: [], hits: [], proxies: new Map(), lastHit: 0 };
  F.rbolts = [];
  F.netTick = function (mp, dt) {
    const g = mp.g; if (!g || mp.role !== 'host' || !mp.remote || !mp.remote.size || !F.on(g)) { F.net.ev.length = 0; F.net.hits.length = 0; return; }
    if ((F.net.t -= dt) > 0) return;
    F.net.t = 0.125;
    const p = g.player.pos, players = [p]; for (const a of mp.remote.values()) if (a && a.has) players.push(a.pos);
    const msg = F.message(g.entities ? g.entities.mobs : [], p, { players, bolts: F.bolts, events: F.net.ev, hits: F.net.hits });
    F.net.ev.length = 0; F.net.hits.length = 0;
    if (msg.n || msg.b || msg.e || msg.h) mp.send('foe', msg);
  };
  F.onNet = function (mp, m) {
    const g = mp.g, En = g && g.entities; if (!En || mp.role !== 'client' || m.peer !== mp.hostPeer) return;
    const u = F.unpack(m.data), seen = new Set();
    for (const q of u.foes) {
      seen.add(q.id);
      let x = F.net.proxies.get(q.id);
      if (!x || x.foe.gone || En.mobs.indexOf(x) < 0) { x = En.summon('foe_' + q.k, q.pos[0], q.pos[1], q.pos[2]); if (!x) continue; x.foe = F.make(q.k, x.id, q.pos); x.foe.remote = true; x.foe.wire = q.id; F.net.proxies.set(q.id, x); }
      const f = x.foe; f.tp = q.pos; f.ty = q.yaw; f.hp = q.hp; f.helper = q.helper; f.flare = q.flare;
      if (f.st !== q.st) { f.st = q.st; f.t = 0; }
      f.seen = g.time || 0;
    }
    for (const [id, x] of F.net.proxies) if (!seen.has(id) && (g.time || 0) - (x.foe.seen || 0) > 1.5) { x.foe.gone = true; x.dead = true; x.deathT = 99; F.net.proxies.delete(id); }
    F.rbolts = u.bolts;
    for (const [id, k] of u.events) { const x = F.net.proxies.get(id); if (x && k === 'down') F.sound(g, 'down', x.pos); if (x && k === 'tele') F.sound(g, 'tele', x.pos); }
    const me = mp.myPeer ? mp.myPeer() : null;
    for (const [peer, dmg, chill] of u.hits) if (peer === me) F.hitPlayer(g, { p: GW.player, dmg, chill: !!chill, x: g.player.pos[0], y: g.player.pos[1], z: g.player.pos[2], kind: 'net' });
  };
  // a guest's copy follows the host's place and turn
  F.follow = function (m, dt) {
    const f = m.foe; if (!f.tp) return;
    const k = 1 - Math.exp(-dt * 10);
    for (let i = 0; i < 3; i++) m.pos[i] += (f.tp[i] - m.pos[i]) * k;
    m.vel[0] = 0; m.vel[1] = 0; m.vel[2] = 0;
    let a = (f.ty || 0) - m.yaw; while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; m.yaw += a * k;
    f.t += dt; f.spin += dt; if (f.st === 'down') f.kneel = Math.min(1, f.t / 0.8);
  };
  // a guest's hit on a copy → the host checks it
  F.netHit = function (g, m, dmg, from) {
    const mp = g.mp, t = Date.now(); if (!mp || mp.role !== 'client' || t - F.net.lastHit < 140) return;
    F.net.lastHit = t;
    const p = g.player, held = p.inv && p.inv.held, hd = held && VR.itemDef ? VR.itemDef(held.id) : null;
    mp.send('foehit', { i: m.foe.wire, d: Math.min(12, dmg), o: from ? [+from[0].toFixed(2), +from[1].toFixed(2), +from[2].toFixed(2)] : [p.pos[0], p.pos[1] + 1.6, p.pos[2]], k: hd && hd.use === 'laser' ? 'pulse' : 'melee' });
  };
  F.onNetHit = function (mp, m) {
    const g = mp.g, En = g && g.entities, d = m.data || {}; if (!En || mp.role !== 'host' || !F.on(g)) return;
    const a = mp.remote.get(m.peer); if (!a || !a.has) return;
    const id = (+d.i) & 0xffff; let foe = null; for (const x of En.mobs) if (x.foe && !x.foe.gone && (x.id & 0xffff) === id) { foe = x; break; }
    if (!foe) return;
    const B = a.__foeB || (a.__foeB = F.bucket()), w = g.world;
    const o = Array.isArray(d.o) && d.o.length === 3 && d.o.every(v => Number.isFinite(+v)) ? d.o.map(Number) : null; if (!o) return;
    const r = F.checkHit({ foe: [foe.pos[0], foe.pos[1] + foe.h * 0.5, foe.pos[2]], shooter: a.pos, origin: o, kind: d.k === 'melee' ? 'melee' : 'pulse', dmg: +d.d, now: Date.now(), bucket: B, solid: (x, y, z) => { const b = w.getBlock(x, y, z); return !!(b && (VR.R.T.flags[b] & VR.F.OPAQUE)); } });
    if (!r.ok) return;
    refresh(g); F.hurt(foe, +d.d, o, GW); F.flush(g);
  };

  // ---------------------------------------------------------------- the look (injected once)
  let cssDone = false;
  function css() {
    if (cssDone || typeof document === 'undefined' || !document.head) return; cssDone = true;
    const s = document.createElement('style'); s.id = 'foecss'; s.textContent = CSS; document.head.appendChild(s);
  }
  F.css = css;
  const CSS = `
#foehearts { position: absolute; left: 16px; top: 80px; display: flex; gap: 3px; pointer-events: none; filter: drop-shadow(0 1px 3px rgba(0,0,0,.7)); }
#foehearts i { width: 16px; height: 14px; display: block; background: radial-gradient(circle at 30% 30%, #ff9ab8, #e2365f 60%, #8a1434); -webkit-mask: radial-gradient(circle at 30% 35%, #000 29%, transparent 30%), radial-gradient(circle at 70% 35%, #000 29%, transparent 30%), linear-gradient(45deg, transparent 49%, #000 50%) 0 0 / 50% 100% no-repeat, linear-gradient(-45deg, transparent 49%, #000 50%) 100% 0 / 50% 100% no-repeat; mask: radial-gradient(circle at 30% 35%, #000 29%, transparent 30%), radial-gradient(circle at 70% 35%, #000 29%, transparent 30%); clip-path: polygon(50% 100%, 0 38%, 12% 6%, 34% 0, 50% 14%, 66% 0, 88% 6%, 100% 38%); }
#foehearts i.h { background: linear-gradient(90deg, #e2365f 50%, rgba(40, 20, 30, .7) 50%); }
#foehearts i.e { background: rgba(40, 20, 30, .7); }
#foechill { position: absolute; inset: 0; pointer-events: none; z-index: 30; opacity: 0; background: radial-gradient(ellipse at center, rgba(180, 230, 255, 0) 55%, rgba(170, 225, 255, .55) 100%); box-shadow: inset 0 0 90px rgba(200, 240, 255, .7); }
#foechill.on { animation: foeChill 1.6s ease-out; }
@keyframes foeChill { 0% { opacity: 0; } 12% { opacity: 1; } 100% { opacity: 0; } }
#foeveil { position: absolute; inset: 0; z-index: 45; pointer-events: none; background: radial-gradient(ellipse at center, #120a22, #04030a 70%); opacity: 0; transition: opacity 1s ease-in-out; display: grid; place-items: center; }
#foeveil.on { opacity: 1; }
#foeveil span { font: 700 26px/1.2 var(--display, sans-serif); color: #d9ccff; letter-spacing: 2px; text-shadow: 0 0 18px rgba(170, 120, 255, .8); }
#foemarks { position: absolute; inset: 0; pointer-events: none; z-index: 29; }
#foemarks i { position: absolute; width: 0; height: 0; border-top: 13px solid transparent; border-bottom: 13px solid transparent; border-left: 22px solid #ff4fd8; filter: drop-shadow(0 0 8px rgba(255, 60, 220, .9)); animation: foeMark .5s ease-in-out infinite alternate; }
@keyframes foeMark { from { opacity: .55; } to { opacity: 1; } }
#foeeasy { position: absolute; left: 50%; bottom: 22%; transform: translateX(-50%); z-index: 40; display: none; padding: 14px 18px; border-radius: 16px; background: rgba(10, 14, 30, .92); border: 1px solid rgba(110, 230, 255, .6); box-shadow: 0 10px 30px rgba(0,0,0,.45), 0 0 18px rgba(80, 220, 255, .25); color: #eef6ff; font: 600 17px/1.3 var(--font, sans-serif); text-align: center; }
#foeeasy.on { display: block; }
#foeeasy .r { display: flex; gap: 10px; justify-content: center; margin-top: 10px; }
`;
})(VR);
