// ============================================================================
// World style (v0.34) — a world's own replacements: rules "this block → that
// block" for everything the game generates (houses, streets, trees, ground, water)
// and a water colour. What you build yourself is never touched: a saved column is
// compared with the column the generator makes, and only cells that still hold
// what the generator put there (under the rules of that time) take the new rules.
//
// style = { sv, rules: [[from, to], …], water: '#rrggbb' | null, hist: { sv: rules } }
// sv: the version of the rules (0 = none); every saved column remembers the sv it
// was generated with, hist keeps the rules of earlier versions.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R;
  const WS = VR.WorldStyle = {};
  const cache = new Map();   // rules JSON → state map

  // a block of the furniture pack: its parts must line up for a rule between two of them (the same cells)
  const planOf = (t) => {
    if (!(t.has && t.has('part') && VR.VM && VR.VM.MODELS && VR.VM.MODELS[t.name])) return '';
    return VR.VM.footprint(VR.VM.MODELS[t.name], 0).map(o => o.join(',')).sort().join(';');
  };
  // can "from → to" be a rule at all (and, in multiplayer, may it)?
  WS.check = function (from, to, mp) {
    const a = R.byName[from], b = R.byName[to];
    if (!a || !b || a === b) return 'bad';
    const pa = planOf(a), pb = planOf(b);
    if ((pa || pb) && pa !== pb) return 'parts';                    // a 3-seat sofa never becomes a lamp cell by cell
    if ((a.o.kind === 'door') !== (b.o.kind === 'door') || (a.o.kind === 'bed') !== (b.o.kind === 'bed') || !!a.o.tall !== !!b.o.tall) return 'shape';
    if (mp && (!WS.mpOK(a) || !WS.mpOK(b))) return 'mp';
    return '';
  };
  // multiplayer keeps the shared land as it is: rules may change buildings, furniture, items and trees only
  WS.mpOK = function (t) {
    const T = R.T, s = t.defaultState, fl = T.flags[s], F = VR.F;
    if (fl & (F.FLUID | F.WATER | F.LAVA)) return false;
    if (/log$|_wood$|leaves$|sapling$|_stem$|hyphae$/.test(t.name)) return true;       // trees
    if (fl & F.SMOOTH) return false;                                                     // natural ground
    if (t.o.ore || /^(stone|deepslate|dirt|grass_block|sand|red_sand|gravel|clay|snow_block|ice|packed_ice|bedrock|netherrack|end_stone|tuff|calcite|mud|podzol|mycelium)$/.test(t.name)) return false;
    return true;
  };
  WS.filterMP = function (style) {
    if (!style) return style;
    return Object.assign({}, style, { rules: (style.rules || []).filter(r => !WS.check(r[0], r[1], true)), water: null });
  };
  // the state map for a rule list: every state of "from" becomes the same-looking state of "to" (its turn, half,
  // axis, slab type, hinge, part … carried over where "to" has them)
  WS.compile = function (rules) {
    if (!rules || !rules.length) return null;
    const key = JSON.stringify(rules); let m = cache.get(key); if (m) return m;
    const n = R.stateCount; m = new Uint16Array(n); for (let i = 0; i < n; i++) m[i] = i;
    let any = false;
    for (const [from, to] of rules) {
      if (WS.check(from, to)) continue;
      const a = R.byName[from], b = R.byName[to];
      for (let s = a.base; s < a.base + a.nstates; s++) {
        let st = b.defaultState;
        for (const p of Object.keys(b.propIndex || {})) {
          if (!a.has(p)) continue;
          const v = a.get(s, p); if (v < b.props[b.propIndex[p]].n) st = b.with(st, p, v);
        }
        m[s] = st; any = true;
      }
    }
    if (!any) m = null;
    if (cache.size > 24) cache.clear();
    cache.set(key, m);
    return m;
  };
  WS.applyGen = function (blocks, map) { if (!map) return blocks; for (let i = 0; i < blocks.length; i++) { const s = blocks[i]; if (s) blocks[i] = map[s]; } return blocks; };
  // a saved column (player edits kept): cells that still hold what the generator made under the old rules take the new
  WS.reconcile = function (saved, raw, oldMap, newMap) {
    const n = Math.min(saved.length, raw.length); let changed = 0;
    for (let i = 0; i < n; i++) {
      const r = raw[i], was = oldMap ? oldMap[r] : r;
      if (saved[i] !== was) continue;
      const now = newMap ? newMap[r] : r;
      if (now !== was) { saved[i] = now; changed++; }
    }
    return changed;
  };
  // the rules of version sv (negative: that version as multiplayer allows it); null when it is no longer known
  WS.rulesAt = function (style, sv) {
    if (!sv) return [];
    if (sv < 0) { const r = WS.rulesAt(style, -sv); return r ? r.filter(x => !WS.check(x[0], x[1], true)) : null; }
    if (style && style.hist && style.hist[sv]) return style.hist[sv];
    if (style && Math.abs(style.sv) === sv && !style.mp) return style.rules || [];
    return null;
  };
  // what a session uses: the world's rules, or — with friends in the world — only the ones multiplayer allows
  WS.effective = function (raw, mp) {
    if (!raw) return null;
    if (!mp) return Object.assign({}, raw, { mp: false });
    return Object.assign({}, raw, { mp: true, sv: -(raw.sv || 0), rules: (raw.rules || []).filter(r => !WS.check(r[0], r[1], true)), water: null });
  };
  // the water colour: the tint of every water cell (RGB565)
  WS.water565 = function (hex) { if (!hex) return 0; const v = parseInt(String(hex).replace('#', ''), 16); if (!(v >= 0)) return 0; return VR.rgb565((v >> 16) & 255, (v >> 8) & 255, v & 255); };
  WS.applyWater = function (water, hex) { const c = WS.water565(hex); if (c && water) water.fill(c); return water; };
  WS.key = (worldId) => 'r9si.style.' + worldId;
  WS.load = function (worldId) { try { const t = localStorage.getItem(WS.key(worldId)); return t ? JSON.parse(t) : null; } catch (e) { return null; } };
  WS.save = function (worldId, style) { try { localStorage.setItem(WS.key(worldId), JSON.stringify(style)); return true; } catch (e) { return false; } };
  // a new version of the rules (the old one goes into the history the saved columns still refer to)
  WS.next = function (style, rules, water) {
    const cur = style || { sv: 0, rules: [], water: null, hist: {} };
    const same = JSON.stringify(cur.rules || []) === JSON.stringify(rules || []);
    const hist = Object.assign({}, cur.hist || {});
    let sv = cur.sv || 0;
    if (!same) { if (sv) hist[sv] = cur.rules || []; sv = sv + 1; hist[sv] = rules || []; }
    const ks = Object.keys(hist).map(Number).sort((a, b) => a - b); while (ks.length > 40) delete hist[ks.shift()];
    return { v: 1, sv, rules: rules || [], water: water || null, hist, t: Date.now() };
  };
})(VR);
