// ============================================================================
// 📐 Bauplan-Stempel (a-builder; plan docs/superpowers/plans/2026-10-30-a-builder.md §2.3): the pure part — a stamp is a
// box of block states {sx, sy, sz, data: Uint16Array, index (y·sz + z)·sx + x}, made by the wand's copy (C). Turned in
// quarter turns clockwise seen from above and mirrored along x; every state turns and mirrors with VR.Mirror's tables
// (stairs, doors and their hinges, logs, rails …). Kept in this browser as a short text (runs of states, base 36) in a
// library of 12 (r9si.stamps). The ghost: the faces of the stamp's blocks that touch air, as triangles, grouped by
// colour into ≤ 16 translucent parts (renderer.drawGhost draws them, one draw a part).
// VR.Stamp: make · transform(clip, rot, flip) · count · encode · decode · ghost(clip, colourOf, maxFaces) · libAdd ·
// origin(clip, x, y, z) · lib() · save(entry) · MAX_CODE. Saved ids are raw states: block ids are append-only.
// ============================================================================
(function (VR) {
  'use strict';
  const ST = VR.Stamp = {};
  ST.MAX_CODE = 240000;   // characters a stamp may take in the browser's storage (~ a 60 × 40 × 60 build)
  ST.MAX_CELLS = 1000000;
  ST.make = (sx, sy, sz, data) => ({ sx, sy, sz, data: data || new Uint16Array(sx * sy * sz) });
  ST.count = (c) => { let n = 0; for (let i = 0; i < c.data.length; i++) if (c.data[i]) n++; return n; };
  const stateOf = (t, s) => (VR.Mirror && s ? VR.Mirror.state(t, s) : s);

  // flip first (x → sx − 1 − x, the 'fx' mirror), then rot quarter turns clockwise ((x, z) → (sz − 1 − z, x), 'r90')
  ST.transform = function (c, rot, flip) {
    let cur = c;
    if (flip) {
      const out = ST.make(cur.sx, cur.sy, cur.sz), memo = new Map();
      for (let y = 0; y < cur.sy; y++) for (let z = 0; z < cur.sz; z++) for (let x = 0; x < cur.sx; x++) {
        const s = cur.data[(y * cur.sz + z) * cur.sx + x]; if (!s) continue;
        let m = memo.get(s); if (m === undefined) { m = stateOf('fx', s); memo.set(s, m); }
        out.data[(y * cur.sz + z) * cur.sx + (cur.sx - 1 - x)] = m;
      }
      cur = out;
    }
    const k = (((rot | 0) % 4) + 4) % 4;
    for (let r = 0; r < k; r++) {
      const nsx = cur.sz, nsz = cur.sx, out = ST.make(nsx, cur.sy, nsz), memo = new Map();
      for (let y = 0; y < cur.sy; y++) for (let z = 0; z < cur.sz; z++) for (let x = 0; x < cur.sx; x++) {
        const s = cur.data[(y * cur.sz + z) * cur.sx + x]; if (!s) continue;
        let m = memo.get(s); if (m === undefined) { m = stateOf('r90', s); memo.set(s, m); }
        out.data[(y * nsz + x) * nsx + (cur.sz - 1 - z)] = m;
      }
      cur = out;
    }
    return cur === c ? ST.make(c.sx, c.sy, c.sz, c.data.slice()) : cur;
  };

  // ---- the text: S1|sx|sy|sz|state*run,state,…  (base 36)
  ST.encode = function (c) {
    const parts = [], d = c.data;
    for (let i = 0; i < d.length;) {
      let j = i + 1; while (j < d.length && d[j] === d[i]) j++;
      const n = j - i; parts.push(d[i].toString(36) + (n > 1 ? '*' + n.toString(36) : ''));
      i = j;
    }
    return 'S1|' + c.sx + '|' + c.sy + '|' + c.sz + '|' + parts.join(',');
  };
  ST.decode = function (str) {
    if (typeof str !== 'string' || str.slice(0, 3) !== 'S1|') return null;
    const f = str.split('|'); if (f.length !== 5) return null;
    const sx = +f[1], sy = +f[2], sz = +f[3];
    if (![sx, sy, sz].every(v => Number.isInteger(v) && v > 0 && v <= 512) || sx * sy * sz > ST.MAX_CELLS) return null;
    const c = ST.make(sx, sy, sz), types = VR.R && VR.R.T ? VR.R.T.type : null;
    let i = 0;
    for (const p of f[4].split(',')) {
      const a = p.split('*'), s = parseInt(a[0], 36), n = a.length > 1 ? parseInt(a[1], 36) : 1;
      if (!(s >= 0 && s < 65536) || !(n >= 1) || i + n > c.data.length || (types && s && types[s] === undefined)) return null;
      c.data.fill(s, i, i + n); i += n;
    }
    return i === c.data.length ? c : null;
  };

  // ---- where it lands: centred on the cell (x, z), its floor at y
  ST.origin = (c, x, y, z) => [x - (c.sx >> 1), y, z - (c.sz >> 1)];

  // ---- the ghost: exposed faces, grouped by colour
  const FACES = [
    [1, 0, 0, [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]], [-1, 0, 0, [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]]],
    [0, 1, 0, [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]]], [0, -1, 0, [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]],
    [0, 0, 1, [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]], [0, 0, -1, [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]]],
  ];
  const ORDER = [0, 1, 2, 0, 2, 3];
  ST.ghost = function (c, colourOf, maxFaces) {
    const max = maxFaces || 60000, at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= c.sx || y >= c.sy || z >= c.sz ? 0 : c.data[(y * c.sz + z) * c.sx + x]);
    // the colour groups: 4 levels a channel, the 15 biggest kept, the rest to the nearest kept
    const keyOf = new Map(), groups = new Map();
    const faces = [];   // [x, y, z, face, key]
    for (let y = 0; y < c.sy && faces.length < max; y++) for (let z = 0; z < c.sz && faces.length < max; z++) for (let x = 0; x < c.sx && faces.length < max; x++) {
      const s = c.data[(y * c.sz + z) * c.sx + x]; if (!s) continue;
      let key = keyOf.get(s);
      if (key === undefined) {
        const rgb = colourOf ? colourOf(s) : [0.6, 0.6, 0.6];
        key = (Math.round(rgb[0] * 3) << 4) | (Math.round(rgb[1] * 3) << 2) | Math.round(rgb[2] * 3);
        keyOf.set(s, key);
        if (!groups.has(key)) groups.set(key, { key, n: 0, r: 0, g: 0, b: 0, rgb });
      }
      for (let f = 0; f < 6 && faces.length < max; f++) {
        const F = FACES[f];
        if (at(x + F[0], y + F[1], z + F[2])) continue;
        faces.push(x, y, z, f, key);
        const gr = groups.get(key); gr.n++; gr.r += gr.rgb[0]; gr.g += gr.rgb[1]; gr.b += gr.rgb[2];
      }
    }
    const nF = faces.length / 5;
    const list = [...groups.values()].filter(g => g.n).sort((a, b) => b.n - a.n);
    const kept = list.slice(0, 15), map = new Map();
    for (const g of kept) map.set(g.key, g);
    for (const g of list.slice(15)) {
      let best = kept[0], bd = 1e9;
      for (const k of kept) { const d = (k.rgb[0] - g.rgb[0]) ** 2 + (k.rgb[1] - g.rgb[1]) ** 2 + (k.rgb[2] - g.rgb[2]) ** 2; if (d < bd) { bd = d; best = k; } }
      map.set(g.key, best);
    }
    // the vertices, part by part
    const verts = new Float32Array(nF * 18), parts = [];
    let v = 0;
    for (const g of kept) {
      const start = v / 3;
      for (let i = 0; i < faces.length; i += 5) {
        if (map.get(faces[i + 4]) !== g) continue;
        const q = FACES[faces[i + 3]][3];
        for (const k of ORDER) { verts[v++] = faces[i] + q[k][0]; verts[v++] = faces[i + 1] + q[k][1]; verts[v++] = faces[i + 2] + q[k][2]; }
      }
      const n = v / 3 - start;
      if (n) parts.push({ at: start, n, c: [g.rgb[0], g.rgb[1], g.rgb[2], 0.5] });
    }
    // f-polish: the stamp's edges — every face edge where the surface folds (no coplanar exposed face goes on across
    // it): a box's twelve, a window's rim; as line pairs (lines: x, y, z per end), one draw
    const seen = new Set(), ev = [];
    for (let i = 0; i < faces.length && ev.length < 120000; i += 5) {
      const x = faces[i], y = faces[i + 1], z = faces[i + 2], F = FACES[faces[i + 3]], q = F[3];
      const cx = (q[0][0] + q[2][0]) / 2, cy = (q[0][1] + q[2][1]) / 2, cz = (q[0][2] + q[2][2]) / 2;
      for (let k = 0; k < 4; k++) {
        const a = q[k], b = q[(k + 1) & 3];
        const ex = Math.round((a[0] + b[0]) - 2 * cx), ey = Math.round((a[1] + b[1]) - 2 * cy), ez = Math.round((a[2] + b[2]) - 2 * cz);
        if (at(x + ex, y + ey, z + ez) && !at(x + ex + F[0], y + ey + F[1], z + ez + F[2])) continue;   // the face goes on flat
        const ax = x + a[0], ay = y + a[1], az = z + a[2], bx = x + b[0], by = y + b[1], bz = z + b[2];
        const k1 = ax + ',' + ay + ',' + az, k2 = bx + ',' + by + ',' + bz, key = k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1;
        if (seen.has(key)) continue; seen.add(key);
        ev.push(ax, ay, az, bx, by, bz);
      }
    }
    return { verts, parts, faces: nF, lines: new Float32Array(ev) };
  };

  // ---- the library
  ST.LIB_MAX = 12;
  ST.libAdd = function (list, entry, max) {
    if (!entry || typeof entry.code !== 'string' || entry.code.length > ST.MAX_CODE) return list;
    const out = [entry]; for (const e of list) if (out.length < (max || ST.LIB_MAX)) out.push(e);
    return out;
  };
  const KEY = 'r9si.stamps';
  ST.lib = function () {
    try { const o = JSON.parse((typeof localStorage !== 'undefined' && localStorage.getItem(KEY)) || '[]'); return Array.isArray(o) ? o.filter(e => e && typeof e.code === 'string') : []; } catch (e) { return []; }
  };
  // → true when it reached the browser's storage (false: full — the stamp holds for this page only)
  ST.save = function (entry) {
    let list = ST.libAdd(ST.lib(), entry, ST.LIB_MAX);
    for (let tries = 0; tries < 6; tries++) {
      try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { list = list.slice(0, Math.max(1, list.length - 3)); }
    }
    return false;
  };
})(VR);
