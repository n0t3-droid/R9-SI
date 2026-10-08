// ============================================================================
// Block colours (v0.35): the average colour of every plain block, from the game's own textures, and the block that
// comes nearest to a colour (OKLab, so it looks right to the eye). Used for pictures → blocks, MagicaVoxel files
// in and out, and anything else that thinks in colours.
// ============================================================================
(function () {
  'use strict';
  const C = window.__studioCore || window.__r9TexHost; if (!C) return;   // (W2: in the game, the ✨ wizard's — its textures)
  const R = VR.R, T = R.T, F = VR.F;
  const BC = VR.BlockColors = {};
  // palettes to choose from: everything plain, or a family that looks good together
  BC.SETS = [['all', 'Alle Blöcke'], ['wool', 'Wolle & Beton'], ['vollton', 'Vollton'], ['terra', 'Terrakotta'], ['nature', 'Stein & Holz']];
  const inSet = {
    all: () => true,
    wool: (n) => /_wool$|_concrete$/.test(n),
    vollton: (n) => /^vollton_/.test(n),
    terra: (n) => /terracotta$/.test(n) && !/glazed/.test(n),
    nature: (n) => /(stone|granite|diorite|andesite|deepslate|tuff|calcite|sandstone|bricks|planks|_log$|_wood$|dirt|mud|clay|gravel|sand$|basalt|blackstone|prismarine|quartz|copper|obsidian)/.test(n) && !/ore|slab|stairs|wall|button|plate|fence|door/.test(n),
  };
  // OKLab (×100): a perceptual colour space whose hues stay put — in CIELAB a bright blue drifts toward purple
  const toLab = (r, g, b) => {
    const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const R_ = f(r), G = f(g), B = f(b);
    const l = Math.cbrt(0.4122214708 * R_ + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R_ + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R_ + 0.2817188376 * G + 0.6299787005 * B);
    return [(0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s) * 100, (1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s) * 100, (0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s) * 100];
  };
  BC.toLab = toLab;
  let table = null;
  // every plain full block (no glow, no glass, no ore, no machine) with the colour of its side and its top
  function build() {
    const tex = C.texInfo && C.texInfo(); if (!tex || !tex.albedo) return null;
    const alb = tex.albedo[0], N = tex.size, out = [];
    const avg = (layer) => { let r = 0, g = 0, b = 0, n = 0; const off = layer * N * N * 4; for (let i = 0; i < N * N; i++) { const a = alb[off + i * 4 + 3]; if (a < 128) continue; r += alb[off + i * 4]; g += alb[off + i * 4 + 1]; b += alb[off + i * 4 + 2]; n++; } return n ? [r / n, g / n, b / n] : null; };
    for (const t of R.types) {
      if (!t || !t.cat || t.o.noItem || t.o.cutOf) continue;
      const s = t.defaultState, fl = T.flags[s], tint = T.tint[s];
      // nothing that changes by itself (coral dies, ice melts, grass spreads), powers circuits or glows; tints only when
      // they are one fixed colour (Vollton), never the biome's (grass, leaves, water)
      if (!(fl & F.FULL) || !(fl & F.OPAQUE) || (fl & (F.EMISSIVE | F.FLUID | F.FALLING | F.INTERACT | (F.RANDTICK || 0) | (F.POWERSRC || 0))) || (tint && tint < 8) || t.o.coral || t.o.power || t.cat === 'volt' || (T.emit && T.emit[s])) continue;
      if (t.o.ore || t.o.kind || (t.has && t.has('part')) || /ore$|command|spawner|tnt|barrier|bedrock|furnace|dispenser|dropper|observer|piston|crafting|lamp|beacon|reactor|core|engine|cargo|chest|barrel|jukebox|note_block|target|sculk|honey|slime|sponge/.test(t.name)) continue;
      // and nothing that is not a plain building material: food and plants, workstations, patterns and markings, floors
      // whose sides look nothing like their tops, glowing rocks
      if (/melon|pumpkin|hay_block|_trim$|mushroom|wart_block|lumishroom|dried_kelp|echo_|_table$|^loom$|bookshelf|lodestone|heat_block|cheese|garage_door|asphalt_|hazard|landing_pad|^vent$|kitchen|^floor_|carpet|herringbone|glazed|neon_|magma|glowing_|sunstone|mire_light|lantern|soil$|mycel|gloom_|roots$|bone_block|spire_cap|pillar|deck_wood|pool_tile/.test(t.name)) continue;
      const side = tint ? BC.colorOf(s, 'side') : avg(T.tex[s * 6 + 4] & 0xfff), top = tint ? BC.colorOf(s, 'top') : avg(T.tex[s * 6 + 2] & 0xfff);
      if (!side || !top) continue;
      out.push({ name: t.name, state: s, side, top, labS: toLab(...side), labT: toLab(...top) });
    }
    return out;
  }
  BC.ready = () => { if (!table) table = build(); return !!table; };
  BC.list = (set) => { if (!BC.ready()) return []; const f = inSet[set] || inSet.all; return table.filter(e => f(e.name)); };
  // the colour of a block for a file (top or side face)
  const memoC = new Map();
  BC.colorOf = function (s, face) {
    const k = s * 8 + (face === 'top' ? 1 : 0); if (memoC.has(k)) return memoC.get(k);
    const tex = C.texInfo && C.texInfo(); let c = [160, 160, 160];
    if (tex && tex.albedo && s) {
      const alb = tex.albedo[0], N = tex.size, layer = T.tex[s * 6 + (face === 'top' ? 2 : 4)] & 0xfff, off = layer * N * N * 4;
      let r = 0, g = 0, b = 0, n = 0; for (let i = 0; i < N * N; i++) { if (alb[off + i * 4 + 3] < 128) continue; r += alb[off + i * 4]; g += alb[off + i * 4 + 1]; b += alb[off + i * 4 + 2]; n++; }
      if (n) c = [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
      const tint = T.tint[s]; if (tint) { const TT = { 1: 0x7fbf55, 2: 0x5fa83a, 3: 0x3f76e4, 4: 0x80a755, 5: 0x619961, 6: 0xb38a55, 7: 0x7fbf2f }, h = tint < 8 ? TT[tint] : R.tintColors[tint - 8]; if (h !== undefined) c = [c[0] * ((h >> 16) & 255) / 255, c[1] * ((h >> 8) & 255) / 255, c[2] * (h & 255) / 255].map(Math.round); }
    }
    memoC.set(k, c); return c;
  };
  // the block nearest to a colour (cached per palette and 4-bit colour cell)
  const memoN = new Map();
  BC.nearest = function (r, g, b, set, face) {
    const key = (set || 'all') + (face === 'top' ? 'T' : 'S') + ((r >> 3) << 10 | (g >> 3) << 5 | (b >> 3));
    const hit = memoN.get(key); if (hit !== undefined) return hit;
    const list = BC.list(set); if (!list.length) return 0;
    const L = toLab(r, g, b); let best = list[0], bd = 1e9;
    for (const e of list) { const q = face === 'top' ? e.labT : e.labS, d = (q[0] - L[0]) ** 2 * 0.7 + (q[1] - L[1]) ** 2 + (q[2] - L[2]) ** 2; if (d < bd) { bd = d; best = e; } }
    if (memoN.size > 60000) memoN.clear();
    memoN.set(key, best.state); return best.state;
  };
})();
