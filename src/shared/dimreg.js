// ============================================================================
// VR.DimReg — the worlds of one save as dims (u-dims, docs/superpowers/specs/2026-10-22-universe-design.md §6.1).
// One registry replaces the facts that were written into the code: which dim has a sky (world.js, the worker's column
// light), its u_dim code (env.js → the sky shader), its gravity (player.js: 30 × g / 9.81, the genre's 30 at home), where
// the actors live, the far horizon, hosting, and its world generator (gen_dims.js makeGen). Runs in the main thread and
// in the workers (src/shared). The five dims of today keep their exact values; a dim this build does not know answers
// the values the old code gave it (no sky, code 0, home's gravity, the overworld generator).
// Ids: 'overworld' (Herzwelt), 'flat' (a flat world's home), 'underforge', 'hollow', 'drift'; later bodies 'opal' …,
// small bodies 'rock.<k>', stations 'stn.<k>' — never a ':' (storage keys are world:dim:cx:cz, storage.js:70).
// ============================================================================
(function (VR) {
  'use strict';
  const G_HOME = 9.81, GRAV_HOME = 30;   // the player's gravity at home (player.js) — every other world scales it by g
  const DIMS = new Map();
  const CODES = {};                       // id → u_dim, kept live as dims are added (env.js reads it as its DIM_ID)
  const DEF = { sky: false, code: 0, g: G_HOME, ceiling: false, air: null, actors: 'none', horizon: false, mp: 'none', home: false, travel: false, gen: null, veil: null, name: null };
  const DimReg = VR.DimReg = {
    CODES,
    // def: {sky, code (u_dim), g (m/s²), ceiling, air, actors ('home' | 'none'), horizon, mp ('host' | 'none' | 'convoy'),
    //       home (a save's home dim), travel (reachable by gates and /dim), gen (seed, opts) → generator, veil (the
    //       travel veil's colours, travel.js), name [key, de, en]}
    add(id, def) {
      if (!id || /:/.test(id)) throw new Error('DimReg: a dim id without ":" — ' + id);
      const d = Object.assign({ id }, DEF, def || {});
      DIMS.set(id, d); CODES[id] = d.code | 0;
      return d;
    },
    get(id) { return DIMS.get(id) || null; },
    has(id) { return DIMS.has(id); },
    list() { return [...DIMS.keys()]; },
    sky(id) { const d = DIMS.get(id); return d ? !!d.sky : false; },
    code(id) { const d = DIMS.get(id); return d ? d.code | 0 : 0; },
    g(id) { const d = DIMS.get(id); return d && d.g > 0 ? d.g : G_HOME; },
    // the player's gravity there: the genre's 30 at home, every world in its true ratio (spec §4.3)
    gravity(id) { return GRAV_HOME * (DimReg.g(id) / G_HOME); },
    actorsHome(id) { const d = DIMS.get(id); return !!(d && d.actors === 'home'); },
    horizon(id) { const d = DIMS.get(id); return !!(d && d.horizon); },
    mp(id) { const d = DIMS.get(id); return d ? d.mp : 'none'; },
    gen(id) { const d = DIMS.get(id); return d && d.gen ? d.gen : null; },
    name(id) { const d = DIMS.get(id); return d && d.name ? d.name : ['g.dim.unknown', id, id]; },
    // a save's home dim: a flat world lives on its flat land, every other on Herzwelt
    home(meta) { return meta && meta.type === 'flat' ? 'flat' : 'overworld'; },
    // the dim a save opens: the one it was left in when this build knows it, else home (a save of a newer build left on
    // a world this one does not have opens at home, never on a half-made world); every old save opens as before
    dimOf(meta) {
      const home = DimReg.home(meta), d = meta && meta.dim;
      if (!d || d === 'overworld' || d === 'flat' || !DIMS.has(d)) return home;
      return d;
    },
    // where a save can travel: its home and every dim marked travel
    travelable(meta) { const home = DimReg.home(meta), out = [home]; for (const [id, d] of DIMS) if (d.travel && id !== home) out.push(id); return out; },
  };
  // the generator of Herzwelt — or of a flat world's land: the world type decides, as makeGen always did
  const homeGen = (seed, opts) => (opts && opts.worldType === 'flat' ? new VR.FlatGen() : new VR.OverworldGen(seed, opts));
  DimReg.add('overworld', { sky: true, code: 0, g: G_HOME, actors: 'home', horizon: true, mp: 'host', home: true, gen: homeGen, name: ['g.dim.overworld', 'Herzwelt', 'Heartworld'], veil: ['#fff4d6', '#ffc978', '#3b2a5c'] });
  DimReg.add('flat', { sky: true, code: 0, g: G_HOME, mp: 'host', home: true, gen: homeGen, name: ['g.dim.flat', 'Flachwelt', 'Flat world'], veil: ['#f4ffe8', '#b8e08a', '#24402a'] });
  DimReg.add('underforge', { sky: false, code: 1, g: G_HOME, ceiling: true, travel: true, gen: (seed) => new VR.UnderforgeGen(seed), name: ['g.dim.underforge', 'Unterschmiede', 'Underforge'], veil: ['#ffe0b0', '#ff8a3a', '#3a0d06'] });
  DimReg.add('hollow', { sky: false, code: 2, g: G_HOME, travel: true, gen: (seed) => new VR.HollowGen(seed), name: ['g.dim.hollow', 'Hohlwelt', 'The Hollow'], veil: ['#efe4ff', '#9a7ae0', '#120a24'] });
  DimReg.add('drift', { sky: true, code: 3, g: G_HOME, travel: true, gen: (seed, opts) => new VR.DriftGen(seed, opts), name: ['g.dim.drift', 'Driftinseln', 'Drift Isles'], veil: ['#f2feff', '#9ee6ff', '#173a66'] });
})(VR);
