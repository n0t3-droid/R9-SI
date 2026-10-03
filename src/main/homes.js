// ============================================================================
// Build a house, get neighbours: a room you build near a village — walls, a
// roof, a door and at least one bed — is noticed by the villagers, and a
// family moves in (one bed: a single villager, two: a couple, more: a couple
// with children). They sleep in your beds, eat at home and join village life.
// Extends VR.Villages (villages.js).
// ============================================================================
(function (VR) {
  'use strict';
  const Vs = VR.Villages;
  if (!Vs) return;
  const P = Vs.prototype, R = VR.R, F = VR.F;
  const isBed = (s) => { const t = s && R.types[R.T.type[s]]; return !!(t && (t.o.bed || t.o.kind === 'bed')); };
  const isDoor = (s) => { const t = s && R.types[R.T.type[s]]; return !!(t && t.o.kind === 'door'); };

  const baseChanged = P.onBlockChanged;
  P.onBlockChanged = function (x, y, z, old, s) {
    baseChanged.call(this, x, y, z, old, s);
    if (this.selfEdit) return;
    // a bed or a door placed (or any block finishing the walls around a bed we are watching)
    const bed = isBed(s), door = isDoor(s);
    const vil = this.homeVillage(x, z);
    if (!vil) return;
    const W = vil.homeWatch || (vil.homeWatch = []);
    if (bed) { const t = R.types[R.T.type[s]]; const head = t.get(s, 'part'), f = t.get(s, 'facing'); const fx = head ? x - VR.HF_DX[f] : x, fz = head ? z - VR.HF_DZ[f] : z; if (!W.some(b => b[0] === fx && b[1] === y && b[2] === fz)) W.push([fx, y, fz, f, 0]); }
    if (!W.length) return;
    // only changes around a bed we are watching count (crops growing, water flowing… don't)
    let near = false;
    for (const b of W) if (Math.abs(b[0] - x) < 14 && Math.abs(b[2] - z) < 14 && Math.abs(b[1] - y) < 10) { b[4] = 1; near = true; }
    if (near || bed) vil.homeCheckT = 1.2;
  };
  // the active village whose outskirts contain (x, z)
  P.homeVillage = function (x, z) {
    for (const vil of this.known.values()) { if (!vil.active) continue; const pz = vil.plan.plaza, RAD = vil.plan.rad || 58; if (Math.hypot(x - pz.x, z - pz.z) < RAD + 45) return vil; }
    return null;
  };
  const baseUpdateVillage = P.updateVillage;
  P.updateVillage = function (vil, dt, tod, d) {
    baseUpdateVillage.call(this, vil, dt, tod, d);
    if (vil.homeCheckT === undefined) return;
    vil.homeCheckT -= dt;
    if (vil.homeCheckT > 0) return;
    vil.homeCheckT = undefined;
    const W = vil.homeWatch || [];
    for (let i = W.length - 1; i >= 0; i--) {
      const b = W[i]; if (!b[4]) continue; b[4] = 0;
      const s = this.g.world.getBlock(b[0], b[1], b[2]);
      if (!isBed(s)) { W.splice(i, 1); continue; }
      const res = this.checkRoom(vil, b);
      if (res.ok) { W.splice(i, 1); this.registerHome(vil, res); }
      else if (res.why && (this.homeHintT || 0) < this.time) { this.homeHintT = this.time + 25; this.g.ui.hint(`${vil.name} would love new neighbours — ${res.why}`, 4200); }
    }
  };
  // flood the room around a bed: enclosed (roof above every cell), not too big, with a door
  P.checkRoom = function (vil, bed) {
    const w = this.g.world, T = R.T;
    const [bx, by, bz, bf] = bed;
    const hx = bx + VR.HF_DX[bf], hz = bz + VR.HF_DZ[bf];
    // not inside one of the village's own houses
    for (const h of vil.homes.concat(vil.plan.work || [])) { const B = h.box; if (B && bx >= B[0] && bx <= B[3] && bz >= B[2] && bz <= B[5] && by >= B[1] - 1 && by <= B[4]) return { ok: false }; }
    for (const h of vil.st.custom || []) for (const b2 of h.beds) if (b2[0] === bx && b2[1] === by && b2[2] === bz) return { ok: false };
    const passable = (s) => !s || (!(T.flags[s] & F.SOLID) && !(T.flags[s] & F.FLUID)) || ((T.flags[s] & F.REPLACE) && !(T.flags[s] & F.FLUID));
    const key = (x, y, z) => x + ',' + y + ',' + z;
    const seen = new Set(), Q = [], cells = [];
    let doors = [], beds = new Map(), open = false, big = false;
    for (const [x, z] of [[bx + 1, bz], [bx - 1, bz], [bx, bz + 1], [bx, bz - 1], [hx + 1, hz], [hx - 1, hz], [hx, hz + 1], [hx, hz - 1]]) {
      for (const y of [by, by + 1]) { const s = w.getBlock(x, y, z); if (passable(s) && !isDoor(s) && !seen.has(key(x, y, z))) { seen.add(key(x, y, z)); Q.push([x, y, z]); } }
    }
    if (!Q.length) return { ok: false, why: 'leave some space to walk next to the bed.' };
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    while (Q.length) {
      const c = Q.pop(); cells.push(c);
      const [x, y, z] = c;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
      if (cells.length > 700 || x1 - x0 > 22 || z1 - z0 > 22 || y1 - y0 > 12) { big = true; break; }
      if (w.topAt(x, z) < y) { open = true; break; } // open sky: no roof here
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]]) {
        const nx = x + dx, ny = y + dy, nz = z + dz, k = key(nx, ny, nz);
        if (seen.has(k)) continue;
        const s = w.getBlock(nx, ny, nz);
        if (isDoor(s)) { seen.add(k); const t = R.types[T.type[s]]; const lower = t.get(s, 'half') ? ny - 1 : ny; if (!doors.some(d => d[0] === nx && d[1] === lower && d[2] === nz)) doors.push([nx, lower, nz, x, z]); continue; }
        if (isBed(s)) { const t = R.types[T.type[s]]; const head = t.get(s, 'part'), f = t.get(s, 'facing'); const fx = head ? nx - VR.HF_DX[f] : nx, fz = head ? nz - VR.HF_DZ[f] : nz; beds.set(fx + ',' + ny + ',' + fz, [fx, ny, fz, f]); continue; }
        if (!passable(s)) continue;
        if (ny < 1 || ny > 250) continue;
        seen.add(k); Q.push([nx, ny, nz]);
      }
    }
    if (open) return { ok: false, why: 'the room around your bed needs a roof.' };
    if (big) return { ok: false, why: 'close the walls around your bed (and keep the room cosy).' };
    if (!doors.length) return { ok: false, why: 'put a door in the wall of the room with the bed.' };
    if (cells.length < 4) return { ok: false, why: 'the room is a bit small to live in.' };
    const d = doors[0];
    // inside: the room cell next to the door, outside: the cell beyond it
    const ix = d[3], iz = d[4], ox = d[0] * 2 - ix, oz = d[2] * 2 - iz;
    const bedList = [...beds.values()];
    if (!bedList.some(b2 => b2[0] === bx && b2[1] === by && b2[2] === bz)) bedList.unshift([bx, by, bz, bf]);
    return { ok: true, beds: bedList.slice(0, 6), door: [d[0], d[1], d[2]], inside: [ix, d[1], iz], outside: [ox, d[1], oz], box: [x0 - 1, y0 - 1, z0 - 1, x1 + 1, y1 + 1, z1 + 1], F: y0 - 1, cells: cells.length };
  };
  P.registerHome = function (vil, res) {
    const st = vil.st, w = this.g.world, T = R.T;
    st.custom = st.custom || [];
    if (st.custom.length >= 12) return;
    // the new neighbours add a doorstep if the door sits a step above the ground outside
    const o = res.outside, d = res.door;
    const step = w.getBlock(d[0], d[1] - 1, d[2]);
    const solidAt = (x, y, z) => !!(T.flags[w.getBlock(x, y, z)] & F.SOLID);
    if (!solidAt(o[0], o[1] - 1, o[2]) && !solidAt(o[0], o[1], o[2]) && !solidAt(o[0], o[1] + 1, o[2])) {
      const mat = step && (T.flags[step] & F.SOLID) && (T.flags[step] & F.FULL) ? step : (R.byName.cobblestone ? R.byName.cobblestone.defaultState : 1);
      for (let k = 1; k <= 3; k++) { if (solidAt(o[0], o[1] - k, o[2])) break; this.setBlock(o[0], o[1] - k, o[2], mat); }
    }
    st.custom.push({ kind: 'home', beds: res.beds, door: res.door, inside: res.inside, outside: res.outside, seats: [], table: null, lights: [], work: [], box: res.box, F: res.F, chimney: null });
    this.onCustomHome(vil);
  };
})(VR);
