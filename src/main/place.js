// ============================================================================
// Block placement: derive the right state from the click context
// (facing, axis, half, slab stacking, wall/floor/ceiling, multi-block parts)
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, F = VR.F, SH = VR.SHAPE;
  const FACE_FACING6 = [1, 3, 4, 5, 2, 0]; // face index → FACING6 value
  const P = VR.Place = {};

  P.playerFacing = (yaw) => ((Math.round(-yaw / (Math.PI / 2)) % 4) + 4) % 4;
  // look direction as FACING6 (0 n,1 e,2 s,3 w,4 up,5 down)
  P.lookFacing6 = (yaw, pitch) => pitch > 0.85 ? 4 : pitch < -0.85 ? 5 : P.playerFacing(yaw);

  const supportTop = (world, x, y, z) => { const s = world.getBlock(x, y - 1, z); return s && (R.T.flags[s] & F.SOLID) && R.T.shape[s] !== SH.FENCE ? true : !!(s && (R.T.flags[s] & F.OPAQUE)); };
  const solidAt = (world, x, y, z) => { const s = world.getBlock(x, y, z); return !!(s && (R.T.flags[s] & F.OPAQUE)); };
  P.soilOK = function (type, world, x, y, z) {
    const below = world.getBlock(x, y - 1, z);
    if (!below) return false;
    const bt = R.types[R.T.type[below]];
    const o = type.o;
    if (o.needsWater) return !!(R.T.flags[below] & F.WATER);
    if (o.onSand) return bt && (bt.o.soil || /sand/.test(bt.name));
    if (o.anySolid) return !!(R.T.flags[below] & F.SOLID);
    return !!(bt && (bt.o.soil || bt.name === 'farmland' || bt.name === 'moss_block' || bt.name === 'mud' || bt.name === 'clay' || /dirt|grass|podzol|mycel|moss|soil/.test(bt.name)));
  };

  // returns array of {x,y,z,state} or null
  P.compute = function (type, ctx) {
    const { world, face, fx, fy, fz, yaw, pitch } = ctx;
    let { x, y, z } = ctx;
    let s = type.defaultState;
    const o = type.o;
    const pf = P.playerFacing(yaw);
    const has = (p) => type.has(p);
    const out = [];
    const kind = o.kind;
    // FACING (4 or 6)
    if (has('facing')) {
      const vals = type.props[type.propIndex.facing].values;
      if (vals.length >= 5) {
        // 6-way: clusters/rods/lights grow out of the clicked face; machines face the player
        const grow = /cluster|bud|rod|light_panel|end_rod|chain|thruster|lightning/.test(type.name) || o.crystal;
        let f6 = grow ? FACE_FACING6[face] : P.lookFacing6(yaw, pitch);
        if (!grow) f6 = f6 === 4 ? 5 : f6 === 5 ? 4 : (f6 + 2) % 4; // front toward player
        if (vals.length === 5) f6 = Math.min(f6, 4);
        s = type.with(s, 'facing', f6);
      } else {
        let f = (pf + 2) % 4; // face toward player
        if (kind === 'stairs' || kind === 'vxroof' || kind === 'door' || kind === 'gate' || kind === 'bed' || kind === 'repeater' || kind === 'comparator' || /anvil/.test(type.name)) f = pf;
        if (kind === 'ladder' || kind === 'wallsign' || kind === 'tripwire_hook' || type.name === 'tripwire_hook') { if (face < 2 || face > 3) f = VR.FACE_HF[face]; else return null; }
        if (kind === 'wallmount' && (face < 2 || face > 3)) f = VR.FACE_HF[face]; // screens & fronds hang on the clicked side
        if (kind === 'trapdoor') f = face >= 2 && face <= 3 ? (pf + 2) % 4 : VR.FACE_HF[face];
        s = type.with(s, 'facing', f);
      }
    }
    if (has('axis')) s = type.with(s, 'axis', face <= 1 ? 1 : face <= 3 ? 0 : 2);
    if (kind === 'hanglight' && has('head')) s = type.with(s, 'head', face === 3 ? 1 : 0); // under a ceiling: hangs; on a floor: stands
    if (has('half') && !o.tall && kind !== 'door') {
      const top = face === 3 || (face !== 2 && fy > 0.5);
      s = type.with(s, 'half', top ? 1 : 0);
    }
    if (kind === 'slab') {
      const top = face === 3 || (face !== 2 && fy > 0.5);
      s = type.with(s, 'type', top ? 1 : 0);
    }
    if (has('face') && (kind === 'button' || kind === 'lever')) {
      if (face === 2) s = type.with(type.with(s, 'face', 0), 'facing', pf);
      else if (face === 3) s = type.with(type.with(s, 'face', 2), 'facing', pf);
      else s = type.with(type.with(s, 'face', 1), 'facing', VR.FACE_HF[face]);
    }
    if (kind === 'torch') {
      if (face === 3) return null;
      if (face === 2) { if (!supportTop(world, x, y, z)) return null; s = type.with(s, 'face', 0); }
      else s = type.with(s, 'face', 1 + VR.FACE_HF[face]);
    }
    if (type.name === 'lantern' || type.name === 'spirit_lantern' || /lantern/.test(type.name)) { if (type.has('hanging')) s = type.with(s, 'hanging', face === 3 ? 1 : 0); }
    if (has('rotation')) s = type.with(s, 'rotation', ((Math.round((-yaw) / (Math.PI * 2) * 16) % 16) + 24) % 16);
    // plants need soil
    if (R.T.flags[s] & F.PLANT) { if (!P.soilOK(type, world, x, y, z)) return null; }
    // multi-block parts
    if (kind === 'door') {
      if (!supportTop(world, x, y, z)) return null;
      const up = world.getBlock(x, y + 1, z);
      if (up && !(R.T.flags[up] & F.REPLACE)) return null;
      // hinge on the side with a solid neighbor
      const left = (s0) => type.with(s0, 'hinge', 0);
      s = left(type.with(s, 'half', 0));
      const f = type.get(s, 'facing');
      const rx = VR.HF_DX[(f + 1) % 4], rz = VR.HF_DZ[(f + 1) % 4];
      if (solidAt(world, x + rx, y, z + rz)) s = type.with(s, 'hinge', 1);
      out.push({ x, y, z, state: s }, { x, y: y + 1, z, state: type.with(s, 'half', 1) });
      return out;
    }
    if (o.tall && has('half')) {
      const up = world.getBlock(x, y + 1, z);
      if (up && !(R.T.flags[up] & F.REPLACE)) return null;
      out.push({ x, y, z, state: type.with(s, 'half', 0) }, { x, y: y + 1, z, state: type.with(s, 'half', 1) });
      return out;
    }
    if ((kind === 'model' || o.vxModel) && VR.VM && VR.VM.MODELS[type.name]) {
      // a VX16 / VX32 model (sofas, beds, tables …): every part goes in, anchored on the clicked cell, rotated with the
      // player (v0.33: the furniture pack's models are vxModel blocks — they used to get only their first part)
      const f = type.get(s, 'facing'), m = VR.VM.MODELS[type.name];
      for (const [dx, dy, dz, i] of VR.VM.footprint(m, f)) {
        const px = x + dx, py = y + dy, pz = z + dz, cur = world.getBlock(px, py, pz);
        if (cur && !(R.T.flags[cur] & F.REPLACE)) return null;
        out.push({ x: px, y: py, z: pz, state: type.with(s, 'part', i) });
      }
      return out;
    }
    if (kind === 'bed') {
      const f = type.get(s, 'facing');
      const hx = x + VR.HF_DX[f], hz = z + VR.HF_DZ[f];
      const hb = world.getBlock(hx, y, hz);
      if (hb && !(R.T.flags[hb] & F.REPLACE)) return null;
      out.push({ x, y, z, state: type.with(s, 'part', 0) }, { x: hx, y, z: hz, state: type.with(s, 'part', 1) });
      return out;
    }
    out.push({ x, y, z, state: s });
    return out;
  };

  // Try to merge into an existing slab (clicked slab of same type) → double slab
  P.slabMerge = function (type, hitState, face, fy) {
    if (type.o.kind !== 'slab') return -1;
    if (R.T.type[hitState] !== type.id) return -1;
    const t = type.get(hitState, 'type');
    if (t === 0 && face === 2) return type.with(hitState, 'type', 2);
    if (t === 1 && face === 3) return type.with(hitState, 'type', 2);
    void fy;
    return -1;
  };
})(VR);
