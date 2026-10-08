// ============================================================================
// Companions (🐾 Begleiter): the rules, with no game in them. Three species (Glimmerfuchs, Mooskätzchen,
// Kristallwelpe), their names and treats, the decision a companion makes each time it thinks (follow, sit, sleep,
// the walk to its bed, teleport back to its player), the moods of the 🐾 chip and the save format (meta.companions).
// The game glue (src/main/companions.js) does the walking, the drawing and the taming.
// ============================================================================
(function (VR) {
  'use strict';
  const P = VR.Pets = {};
  P.MAX = 3;                  // companions per player
  P.NAME_MAX = 16;            // characters in a name
  P.TELEPORT = 24;            // blocks (3-D): a follower this far away appears next to its player
  P.STUCK_S = 3.5;            // seconds without getting closer before a follower appears next to its player
  P.NEAR = 2.2;               // blocks: close enough to stand still
  P.BED_IDLE_S = 6;           // seconds standing still at night before the walk to bed
  P.BED_REACH = 22;           // blocks: the bed (or spawn) must be this close for the walk
  P.LIMIT = 3e7;              // coordinates beyond this are not saved (corrupt records)

  // the species: German name, the treat that tames it (an existing item), names it can be given
  P.KINDS = {
    glimmer_fox: { name: 'Glimmerfuchs', treat: 'glow_berries', names: ['Funke', 'Lumi', 'Feuerle', 'Glimmi', 'Flitze', 'Sonnu', 'Lichtle', 'Fuchsi', 'Mondi', 'Schimmi'] },
    moss_cat: { name: 'Mooskätzchen', treat: 'raw_cod', names: ['Moosi', 'Flocke', 'Samtpfote', 'Mümmel', 'Tatze', 'Wolli', 'Grünauge', 'Puschel', 'Fellchen', 'Tüpfel'] },
    crystal_pup: { name: 'Kristallwelpe', treat: 'bone', names: ['Kiesel', 'Splitter', 'Klinke', 'Bergi', 'Prisma', 'Glitzi', 'Fünkchen', 'Quarzi', 'Schnuffel', 'Eisi'] },
  };
  P.STATES = ['follow', 'sit', 'sleep'];
  P.isKind = (k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(P.KINDS, k);
  P.pickName = (kind, seed) => { const L = P.KINDS[kind].names; const i = (seed | 0) % L.length; return L[i < 0 ? i + L.length : i]; };
  // a name as typed or loaded: no control characters, no < >, at most NAME_MAX characters; blank → the fallback
  P.sanitizeName = (s, fb) => {
    const t = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, P.NAME_MAX).trim();
    return t || (fb == null ? '' : String(fb));
  };
  const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  P.dist = d3;

  // how often a companion thinks (seconds): near its player often, far away rarely (a few times a second at most)
  P.thinkEvery = (d2) => (d2 < 144 ? 0.2 : d2 < 1600 ? 0.4 : 1.0);

  // A companion record: {kind, name, state, pos (the mob's own array), yaw, seed} plus the runtime fields the
  // rules keep: idle (s standing still), clock (s of its own time), progD / progT (its best distance and when it
  // last got closer). ctx: {player: [x,y,z], night: bool, home: [x,y,z] | null} (home = bed or spawn point).
  // decide() moves the record's state on and returns what the game should do: 'none' (stand, sit or sleep),
  // 'path' (walk toward the player), 'bed' (walk toward home), 'teleport' (appear next to the player).
  P.decide = function (pet, ctx, dt) {
    dt = dt > 0 ? dt : 0;
    pet.clock = (pet.clock || 0) + dt;
    const pos = pet.pos, pl = ctx.player;
    const d = d3(pos, pl);
    if (pet.state === 'sleep') {
      if (!ctx.night) { pet.state = 'follow'; pet.progD = Infinity; pet.progT = pet.clock; return 'none'; }
      if (d > P.TELEPORT) { pet.state = 'follow'; pet.progD = Infinity; pet.progT = pet.clock; return 'teleport'; }
      return 'none';
    }
    if (pet.state === 'sit') return 'none';
    // following
    if (d > P.TELEPORT) { pet.progD = Infinity; pet.progT = pet.clock; return 'teleport'; }
    if (ctx.night && ctx.home && pet.idle >= P.BED_IDLE_S) {
      const dh = d3(pos, ctx.home);
      if (dh < 1.5) { pet.state = 'sleep'; return 'none'; }
      if (dh < P.BED_REACH && d3(pl, ctx.home) < 8) return 'bed';
    }
    // stuck: no closer for STUCK_S seconds (a fence in the way, a hole) → next to its player
    if (d < pet.progD - 0.4 || d <= P.NEAR) { pet.progD = d; pet.progT = pet.clock; }
    else if (pet.clock - pet.progT > P.STUCK_S) { pet.progD = Infinity; pet.progT = pet.clock; return 'teleport'; }
    return d <= P.NEAR ? 'none' : 'path';
  };
  // a right-click: sit ↔ follow (a sleeper gets up and follows). Returns the new state.
  P.toggle = (pet) => { pet.state = pet.state === 'follow' ? 'sit' : 'follow'; if (pet.state === 'follow') { pet.progD = Infinity; pet.clock = pet.clock || 0; pet.progT = pet.clock; } return pet.state; };
  // Pfeifen: a sitter or a sleeper stands up and follows. True when it changed.
  P.call = (pet) => {
    if (pet.state === 'follow') return false;
    pet.state = 'follow'; pet.progD = Infinity; pet.progT = pet.clock || 0;
    return true;
  };
  // the 🐾 chip's mood
  P.mood = (pet, ctx) => {
    if (pet.state === 'sleep') return 'asleep';
    if (pet.state === 'sit') return 'waiting';
    if (ctx.night) return 'sleepy';
    if (d3(pet.pos, ctx.player) > 10) return 'coming';
    return 'happy';
  };

  // ---------------------------------------------------------------- the save format (meta.companions)
  const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;
  const okPos = (p) => Array.isArray(p) && p.length >= 3 && [0, 1, 2].every(i => Number.isFinite(p[i]) && Math.abs(p[i]) <= P.LIMIT);
  // companions → plain records (at most MAX; a record without a valid species or place is left out)
  P.serialize = (list) => {
    const out = [];
    if (!Array.isArray(list)) return out;
    for (const c of list) {
      if (out.length >= P.MAX) break;
      if (!c || !P.isKind(c.kind) || !okPos(c.pos)) continue;
      out.push({
        kind: c.kind, name: P.sanitizeName(c.name, P.pickName(c.kind, c.seed)),
        state: P.STATES.includes(c.state) ? c.state : 'follow',
        pos: [r1(c.pos[0]), r1(c.pos[1]), r1(c.pos[2])], yaw: r2(Number.isFinite(c.yaw) ? c.yaw : 0), seed: (c.seed | 0),
      });
    }
    return out;
  };
  // saved records → companion records (never throws: anything wrong is dropped; an old 'wild' state follows)
  P.deserialize = (list) => {
    const out = [];
    if (!Array.isArray(list)) return out;
    for (const r of list) {
      if (out.length >= P.MAX) break;
      if (!r || typeof r !== 'object' || !P.isKind(r.kind) || !okPos(r.pos)) continue;
      const seed = Number.isFinite(r.seed) ? (r.seed | 0) : 0;
      out.push({
        kind: r.kind, name: P.sanitizeName(r.name, P.pickName(r.kind, seed)),
        state: P.STATES.includes(r.state) ? r.state : 'follow',
        pos: [Number(r.pos[0]), Number(r.pos[1]), Number(r.pos[2])], yaw: Number.isFinite(r.yaw) ? r.yaw : 0, seed,
        idle: 0, clock: 0, progD: Infinity, progT: 0,
      });
    }
    return out;
  };
})(VR);
