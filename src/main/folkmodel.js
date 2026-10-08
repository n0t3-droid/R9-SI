// ============================================================================
// Hi-res villager rig — 1 voxel = 1/32 block (twice the detail of creatures).
// Rounded heads with expressive faces (glinting eyes, brows, button nose,
// ears, cheeks, freckles), volumetric hair styles, role outfits with seams,
// buttons, pockets and aprons, hands with thumbs, shoes with soles, baked
// tools, blink lids + talking mouth parts, and an automatic half-res LOD.
// ============================================================================
(function (VR) {
  'use strict';
  const V = VR.Folk;
  if (!V) return;
  const H3 = (x, y, z, s) => VR.M.hash3(x, y, z, s) / 4294967296;
  const c255 = (v) => v < 0 ? 0 : v > 255 ? 255 : v | 0;
  const mul = (c, k) => (c255(((c >> 16) & 255) * k) << 16) | (c255(((c >> 8) & 255) * k) << 8) | c255((c & 255) * k);
  const mix = (a, b, t) => (c255(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t) << 16) | (c255(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t) << 8) | c255((a & 255) * (1 - t) + (b & 255) * t);
  const fab = (c, amt, seed) => (x, y, z) => mul(c, 1 + (H3(x, y, z, seed) - 0.5) * amt);
  const strHash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

  // part with pivot-relative coordinates
  function mk(x0, x1, y0, y1, z0, z1) {
    const g = new VR.VoxGrid(x1 - x0 + 1, y1 - y0 + 1, z1 - z0 + 1, -x0, -y0, -z0);
    const P = {
      g,
      set(x, y, z, c, e) { if (typeof c === 'function') c = c(x, y, z); if (c === null || c === undefined) return; g.set(x - x0, y - y0, z - z0, c, e); },
      del(x, y, z) { const X = x - x0, Y = y - y0, Z = z - z0; if (g.in(X, Y, Z)) g.c[g.i(X, Y, Z)] = 0; },
      has(x, y, z) { return !!g.get(x - x0, y - y0, z - z0); },
      box(ax, ay, az, bx, by, bz, c, e) { for (let y = ay; y <= by; y++) for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) P.set(x, y, z, c, e); },
      // rounded box: the 4 vertical edges are chamfered, optionally the top / bottom rims too
      rbox(ax, ay, az, bx, by, bz, c, o) {
        o = o || {};
        for (let y = ay; y <= by; y++) for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) {
          const ex = x === ax || x === bx, ez = z === az || z === bz;
          if (ex && ez) continue;
          if (o.top && y === by && (ex || ez)) continue;
          if (o.bottom && y === ay && (ex || ez)) continue;
          P.set(x, y, z, c, o.e);
        }
      },
      paint(x, y, z, c, e) { if (P.has(x, y, z)) P.set(x, y, z, c, e); },
      ell(cx, cy, cz, rx, ry, rz, c, keep) {
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2;
          if (d > 1) continue;
          if (keep && !keep(x, y, z)) continue;
          P.set(x, y, z, c);
        }
      },
    };
    return P;
  }

  const LIP = 0xB04C58, LASH = 0x2A1D1C, WHITE = 0xFFFFFF;

  function build(L) {
    const kid = L.age === 'child', elder = L.age === 'elder';
    const role = V.ROLES[L.role] || V.ROLES.farmer;
    const sd = strHash(V.lookKey(L));
    const rnd = (k) => H3(sd & 0xffff, k, sd >>> 16, 4242);
    const skin = L.skin, hc = L.hair, shoes = L.shoes;
    let shirt = L.shirt, pants = L.pants;
    const acc = kid ? null : role.acc;
    if (acc === 'overalls') pants = 0x3A5A9A;
    // proportions (model units = 1/32 block)
    // the trailer heroes are chunkier: shorter legs, broader shoulders, the same torso (two blocks tall in all)
    const hero = L.role === 'hero';
    const legH = kid ? 13 : elder ? 22 : hero ? 22 : 24, bodyH = kid ? 13 : 18, armLen = kid ? 13 : hero ? 18 : 19, handH = kid ? 4 : 5;
    const bw = kid ? 6 : hero ? 8 : 7, bz0 = kid ? -3 : -4, bz1 = kid ? 2 : 3;
    const legW = kid ? 2 : 3, legX = kid ? 3 : 4, armX = bw + 3;
    const HT = kid || hero ? 14 : 13;   // head y ∈ [0, HT] (the heroes' heads are a little bigger)
    const eyeY = kid ? 5 : 5;
    const top = bodyH - 1;

    // ============================== head
    const head = mk(-13, 13, -14, 27, -13, 12);
    const skinF = (x, y, z) => mul(skin, (y < 2 ? 0.92 : y < 4 ? 0.97 : 1) * (1 + (H3(x, y, z, 5) - 0.5) * 0.025));
    head.rbox(-7, 0, -6, 7, HT, 6, skinF, { top: true, bottom: true });
    for (const sx of [-1, 1]) { head.del(sx * 7, 1, -5); head.del(sx * 6, 0, -6); head.del(sx * 7, 0, -4); head.del(sx * 7, 1, 5); }
    const F = (x, y, c, e) => head.set(x, y, -6, c, e);
    // eyes: dark iris/pupil with a glint, lash line above
    for (const s of [-1, 1]) {
      const mid = s * 4, inner = s * 3, outer = s * 5;
      // white | iris with a glint | pupil — readable on every skin tone
      F(outer, eyeY + 1, 0xF6F4F0); F(outer, eyeY, 0xE6E2DC);
      F(mid, eyeY + 1, mul(L.eye, 0.32)); F(inner, eyeY + 1, mul(L.eye, 0.25));
      F(mid, eyeY, L.eye); F(inner, eyeY, mul(L.eye, 0.7));
      F(outer, eyeY + 2, LASH); F(mid, eyeY + 2, LASH); F(inner, eyeY + 2, LASH);
      if (!kid && (rnd(1) < 0.5 || L.lashes)) head.set(s * 6, eyeY + 2, -6, LASH);
      // brows
      const bc = elder ? mix(hc, 0xffffff, 0.2) : mul(hc, 0.72);
      F(outer, eyeY + 4, bc); F(mid, eyeY + 4, bc); F(inner, eyeY + (elder ? 3 : 4), bc);
      // ears
      head.box(s * 8, eyeY - 1, -1, s * 8, eyeY + 1, 1, mul(skin, 0.97));
      head.set(s * 8, eyeY, -1, mul(skin, 0.84));
      // cheeks
      if (kid || L.freckles || rnd(2) < 0.35) F(s * 5, eyeY - 2, mix(skin, 0xFF7E86, kid ? 0.42 : 0.28));
      if (L.freckles) { F(s * 4, eyeY - 1, mul(skin, 0.8)); F(s * 3, eyeY - 2, mul(skin, 0.82)); F(s * 6, eyeY - 1, mul(skin, 0.84)); }
    }
    // button nose (protrudes one voxel) and a smile
    // (one small voxel with a soft highlight — no dark underside, which read as a moustache)
    head.set(0, eyeY - 1, -7, mul(skin, 1.03));
    const my = eyeY - 3;
    F(-1, my, LIP); F(0, my, mul(LIP, 0.92)); F(1, my, LIP);
    // smile corners: soft rosy, not dark
    const corner = mix(skin, LIP, 0.4);
    if (elder) { F(-2, my, corner); F(2, my, corner); }
    else { F(-2, my + 1, corner); F(2, my + 1, corner); }
    // ---- hair
    const hcF = (x, y, z) => mul(hc, 0.88 + H3(x, y >> 1, z, 91) * 0.16 + (y > HT ? 0.05 : 0));
    // a helmeted suit (the trailer's two) has no hair: the helmet's shell takes the head's top and back
    const helm = !!L.helm && !kid;
    const bald = helm || L.hs === 'bald';
    if (!bald) {
      // scalp: top rows, back of the head, upper sides
      for (let y = 0; y <= HT; y++) for (let z = -6; z <= 6; z++) for (let x = -7; x <= 7; x++) {
        if (!head.has(x, y, z)) continue;
        if (y >= HT - 1 || (z >= 2 && y >= eyeY + 1) || (Math.abs(x) === 7 && y >= eyeY + 4 && z >= -4)) head.set(x, y, z, hcF);
      }
      // outer shell for volume
      for (let z = -6; z <= 6; z++) for (let x = -7; x <= 7; x++) if (!((Math.abs(x) === 7) && (Math.abs(z) === 6))) head.set(x, HT + 1, z, hcF);
      for (const s of [-1, 1]) for (let y = eyeY + 3; y <= HT; y++) for (let z = -5; z <= 6; z++) head.set(s * 8, y, z, hcF);
      for (let y = 3; y <= HT; y++) for (let x = -7; x <= 7; x++) head.set(x, y, 7, hcF);
      // fringe with a ragged edge
      for (let x = -7; x <= 7; x++) { head.set(x, HT, -7, hcF); if (H3(x, 1, 3, sd & 255) < 0.55 || Math.abs(x) >= 6) head.set(x, HT - 1, -7, hcF); if (Math.abs(x) >= 6 && H3(x, 2, 3, sd & 255) < 0.6) head.set(x, HT - 2, -7, hcF); }
    } else if (!helm) {
      for (const s of [-1, 1]) for (let y = eyeY; y <= eyeY + 4; y++) for (let z = -3; z <= 6; z++) head.set(s * 8, y, z, hcF);
      for (let y = eyeY - 1; y <= eyeY + 5; y++) for (let x = -7; x <= 7; x++) head.set(x, y, 7, hcF);
    }
    const hsty = helm ? '' : L.hs;
    if (hsty === 'long') {
      for (let y = -10; y <= HT; y++) for (let x = -7; x <= 7; x++) { if (y < -6 && H3(x, y, 1, 7) < 0.3) continue; head.set(x, y, 7, hcF); if (y < HT - 1) head.set(x, y, 8, hcF); }
      for (const s of [-1, 1]) for (let y = -6; y <= HT; y++) for (let z = -3; z <= 7; z++) { if (y < -3 && H3(z, y, s, 8) < 0.35) continue; head.set(s * 8, y, z, hcF); }
    } else if (hsty === 'bob') {
      for (let y = 1; y <= HT; y++) for (let x = -8; x <= 8; x++) head.set(x, y, 7, hcF);
      for (const s of [-1, 1]) { for (let y = 1; y <= HT; y++) for (let z = -5; z <= 7; z++) head.set(s * 8, y, z, hcF); for (let y = 1; y <= 3; y++) for (let z = -4; z <= 6; z++) head.set(s * 9, y, z, hcF); }
    } else if (hsty === 'bun') {
      head.ell(0, HT + 3.5, 3, 3.2, 2.8, 3.2, hcF);
      for (let x = -3; x <= 3; x++) head.set(x, HT + 1, 5, mul(hc, 0.7));
    } else if (hsty === 'pony') {
      const tie = [0xE84A6A, 0x4AA0E8, 0xF0C040, 0x7AD07A][(sd >> 3) & 3];
      for (let x = -1; x <= 1; x++) { head.set(x, HT - 3, 8, tie); head.set(x, HT - 3, 9, tie); }
      for (let y = -6; y <= HT - 4; y++) { const w = y < -2 ? 0 : 1; for (let x = -w; x <= w; x++) { head.set(x, y, 8, hcF); head.set(x, y, 9, hcF); } }
    } else if (hsty === 'curly') {
      for (let y = eyeY + 1; y <= HT + 2; y++) for (let z = -7; z <= 8; z++) for (let x = -9; x <= 9; x++) {
        if (head.has(x, y, z)) continue;
        if (z < -5 && y < HT) continue;
        let nb = 0; for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) if (head.has(x + dx, y + dy, z + dz)) nb++;
        if (nb >= 1 && H3(x, y, z, 31) < 0.45 && !(y < HT - 1 && z <= -6)) head.set(x, y, z, hcF);
      }
    } else if (hsty === 'spiky') {
      for (let k = 0; k < 9; k++) { const x = -6 + Math.floor(H3(k, 1, 2, sd) * 13), z = -5 + Math.floor(H3(k, 3, 4, sd) * 11), h = 1 + Math.floor(H3(k, 5, 6, sd) * 3); for (let y = 1; y <= h; y++) { head.set(x, HT + 1 + y, z, hcF); if (y < h) { head.set(x + 1, HT + 1 + y, z, hcF); head.set(x, HT + 1 + y, z + 1, hcF); } } }
    } else if (hsty === 'braids') {
      for (const s of [-1, 1]) {
        for (let y = -8; y <= eyeY + 2; y++) { const c = ((y & 3) < 2) ? hc : mul(hc, 0.75); head.set(s * 9, y, 1, c); head.set(s * 9, y, 2, c); if ((y & 3) === 0) head.set(s * 10, y, 1, mul(hc, 0.85)); }
        head.set(s * 9, -9, 1, 0xE84A6A); head.set(s * 9, -9, 2, 0xE84A6A);
      }
    } else if (hsty === 'afro') {
      head.ell(0, HT - 2, 1.5, 10.5, 9, 9.5, hcF, (x, y, z) => !(z <= -5 && y < HT - 1 && Math.abs(x) <= 7) && !(y < eyeY - 1));
    }
    // the trailer's helmet: a shell over the top and the back in the suit's armour colour, a cyan visor across the eyes
    // (a glowing line on dark glass) and a crest in the accent colour (the blue hero's is orange, the orange hero's blue)
    if (helm) {
      const shell = (x, y, z) => mul(shirt, 0.9 + H3(x, y, z, 33) * 0.12);
      for (let y = 0; y <= HT + 1; y++) for (let z = -6; z <= 6; z++) for (let x = -7; x <= 7; x++) {
        if (!head.has(x, y, z)) continue;
        if (y >= eyeY + 2 || (z >= 1 && y >= eyeY - 1)) head.set(x, y, z, shell);
      }
      for (let z = -5; z <= 5; z++) for (let x = -6; x <= 6; x++) if (!(Math.abs(x) >= 6 && Math.abs(z) >= 5)) head.set(x, HT + 1, z, shell);
      for (let z = -5; z <= 4; z++) for (let x = -1; x <= 1; x++) head.set(x, HT + 2, z, L.suit2 || 0xFF7A1A);
      for (let x = -6; x <= 6; x++) { head.set(x, eyeY, -6, 0x1B2A44); head.set(x, eyeY + 1, -6, 0x3AF0FF, 1); }
    }
    // beard & moustache
    if (L.beard && !kid) {
      for (let y = 0; y <= 1; y++) for (let x = -5; x <= 5; x++) F(x, y, hcF(x, y, -6));
      for (const s of [-1, 1]) for (let y = 0; y <= eyeY; y++) { F(s * 6, y, hcF(s, y, 0)); head.paint(s * 7, y, -5, hcF(s, y, 1)); }
      for (let x = -2; x <= 2; x++) F(x, my + 1, mul(hc, 0.9));
      for (let x = -3; x <= 3; x++) { head.set(x, 0, -7, hcF(x, 0, -7)); if (Math.abs(x) <= 2) head.set(x, 1, -7, hcF(x, 1, -7)); }
      F(-1, my, LIP); F(0, my, mul(LIP, 0.9)); F(1, my, LIP);
    }
    // glasses (scholars, some elders)
    if (role.glasses || (elder && rnd(3) < 0.45)) {
      const fr = elder ? 0x8A7A5A : 0x2E2E36;
      for (const s of [-1, 1]) {
        const cx = s * 4;
        for (let x = cx - 2; x <= cx + 2; x++) { head.set(x, eyeY - 1, -7, fr); head.set(x, eyeY + 3, -7, fr); }
        for (let y = eyeY - 1; y <= eyeY + 3; y++) { head.set(cx - 2, y, -7, fr); head.set(cx + 2, y, -7, fr); }
        for (let z = -6; z <= -2; z++) head.set(s * 8, eyeY + 2, z, fr);
      }
      head.set(0, eyeY + 2, -7, fr); head.set(-1, eyeY + 2, -7, fr); head.set(1, eyeY + 2, -7, fr);
    }
    // ---- hats
    const hat = kid ? L.kidHat : (elder ? (L.elderHat || role.hat) : role.hat);
    const H1 = HT + (bald ? 1 : 2);
    const disc = (y, r, c, hole) => { for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) { const d = x * x + (z - 0.5) * (z - 0.5); if (d > r * r + 0.5) continue; if (hole && d < hole * hole) continue; head.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c); } };
    if (hat === 'straw') {
      const straw = (x, y, z) => mul(0xE6C466, 0.9 + (((x + z) & 1) ? 0.1 : 0) + H3(x, y, z, 12) * 0.06);
      disc(H1, 11, straw);
      for (let y = H1 + 1; y <= H1 + 4; y++) disc(y, 7, straw);
      for (let y = H1 + 1; y <= H1 + 1; y++) disc(y, 7, 0xB04A36, 6);
    } else if (hat === 'chef') {
      for (let y = HT - 1; y <= H1 + 1; y++) disc(y, 8, 0xFFFFFF, 7);
      head.ell(0, H1 + 5, 0.5, 9, 5.5, 8.5, (x, y, z) => mul(0xF8F8F4, 0.93 + H3(x, y, z, 14) * 0.1), (x, y) => y >= H1 + 1);
    } else if (hat === 'hard') {
      head.ell(0, HT - 1, 0.5, 9, 7.5, 8.5, (x, y, z) => (x === 0 || x === 1) && y > HT + 2 ? 0xF8C84A : mul(0xF0A020, 0.94 + H3(x, y, z, 15) * 0.1), (x, y, z) => y >= HT - 1 && !(z <= -6 && y < HT + 1));
      for (let x = -8; x <= 8; x++) for (let z = -11; z <= -7; z++) head.set(x, HT - 1, z, 0xE89418);
    } else if (hat === 'top') {
      disc(H1, 10, 0x1A1A22);
      for (let y = H1 + 1; y <= H1 + 10; y++) disc(y, 6, y <= H1 + 2 ? 0x8A2A3A : mul(0x22222A, 0.95 + H3(0, y, 0, 3) * 0.1));
    } else if (hat === 'visor') {
      head.ell(0, HT - 3, 0.5, 9, 9, 8.5, (x, y, z) => mul(0x3A4A3A, 0.92 + H3(x, y, z, 16) * 0.12), (x, y, z) => y >= eyeY - 1 && !(z <= -5 && y < HT - 2 && Math.abs(x) < 8));
      for (let x = -7; x <= 7; x++) for (let y = eyeY; y <= eyeY + 2; y++) head.set(x, y, -8, y === eyeY + 1 ? 0x3AF0FF : 0x1C2A2C, y === eyeY + 1 ? 1 : 0);
    } else if (hat === 'goggles') {
      for (let z = -6; z <= 7; z++) for (const s of [-1, 1]) head.set(s * 8, HT - 3, z, 0x5A3A2A);
      for (let x = -7; x <= 7; x++) head.set(x, HT - 3, 8, 0x5A3A2A);
      for (const s of [-1, 1]) for (let y = HT - 4; y <= HT - 1; y++) for (let x = s * 2; x !== s * 7; x += s) { const edge = y === HT - 4 || y === HT - 1 || x === s * 2 || x === s * 6; head.set(x, y, -7, edge ? 0xB07A3A : 0x8AD8FF, edge ? 0 : 1); }
    } else if (hat === 'cap') {
      for (let y = HT - 1; y <= H1 + 2; y++) disc(y, 7, 0xF6F6F2);
      for (let x = -1; x <= 1; x++) head.set(x, HT + 1, -8, 0xE04040); head.set(0, HT + 2, -8, 0xE04040); head.set(0, HT, -8, 0xE04040);
    } else if (hat === 'sun') {
      const sc = 0xF2E4C4;
      for (let z = -12; z <= 12; z++) for (let x = -12; x <= 12; x++) { const d = Math.hypot(x, z - 0.5); if (d > 12.3) continue; head.set(x, d > 9 ? H1 - 1 : H1, z, mul(sc, 0.95 + H3(x, 0, z, 17) * 0.08)); }
      for (let y = H1 + 1; y <= H1 + 3; y++) disc(y, 7, y === H1 + 1 ? 0x7AB05A : sc);
      head.set(6, H1 + 2, -4, 0xE84A6A); head.set(7, H1 + 2, -4, 0xE84A6A); head.set(6, H1 + 3, -4, 0xF6D23A); head.set(7, H1 + 1, -3, 0x6AA04A);
    } else if (hat === 'beanie') {
      const bc = [0xE84A4A, 0x4A8AE8, 0xF0C040, 0x6AC06A, 0xC070E0][(sd >> 5) % 5];
      head.ell(0, HT - 1, 0.5, 8.5, 5.5, 8, (x, y) => (y & 1) ? bc : mul(bc, 0.82), (x, y, z) => y >= HT - 1 && !(z <= -6 && y < HT + 1));
      head.ell(0, HT + 5.5, 0.5, 2, 2, 2, 0xFFFFFF);
    } else if (hat === 'kidcap') {
      const bc = [0xE84A4A, 0x4A8AE8, 0x40C0C0, 0xF08A30][(sd >> 7) & 3];
      for (let y = HT; y <= H1 + 1; y++) disc(y, 7, bc);
      for (let x = -4; x <= 4; x++) for (let z = 7; z <= 10; z++) head.set(x, HT, z, mul(bc, 0.8));
    } else if (hat === 'bow') {
      const bc = [0xF06A9A, 0xE84A4A, 0x9A6AF0][(sd >> 9) % 3];
      for (let x = 2; x <= 7; x++) for (let y = HT; y <= HT + 2; y++) if (!(x === 4 && y !== HT + 1)) head.set(x, y + (x === 4 ? 0 : 0), -4, x === 4 ? mul(bc, 0.8) : bc);
    } else if (hat === 'flat') {
      for (let y = HT; y <= HT + 2; y++) disc(y, 8, mul(0x6A5A4A, 0.95 + (y & 1) * 0.08));
      for (let x = -6; x <= 6; x++) for (let z = -10; z <= -7; z++) head.set(x, HT, z, 0x5A4A3A);
    }

    // blink lids & talking mouth (drawn only while blinking / speaking)
    const lids = mk(-8, 8, eyeY - 1, eyeY + 3, -9, -6);
    for (const s of [-1, 1]) { const mid = s * 4, inner = s * 3; for (const x of [mid, inner]) { lids.set(x, eyeY + 1, -7, mul(skin, 0.93)); lids.set(x, eyeY, -7, LASH); } }
    const mouth = mk(-3, 3, my - 2, my + 1, -9, -6);
    for (let x = -1; x <= 1; x++) { mouth.set(x, my, -7, 0x5A1E26); mouth.set(x, my - 1, -7, x === 0 ? 0xD86A7A : 0x5A1E26); }
    mouth.set(0, my + 1, -7, 0xF4F4F0);

    // ============================== body
    const body = mk(-12, 12, -17, bodyH + 3, -8, 7);
    const shF = fab(shirt, 0.07, 11);
    body.rbox(-bw, 0, bz0, bw, top, bz1, shF, { top: true });
    for (let y = 0; y <= 1; y++) for (let z = bz0; z <= bz1; z++) for (let x = -bw; x <= bw; x++) body.paint(x, y, z, fab(pants, 0.05, 12)(x, y, z));
    // neck
    body.box(-2, top + 1, -2, 2, top + 2, 1, mul(skin, 0.9));
    // shoulder slope
    for (const s of [-1, 1]) for (let z = bz0; z <= bz1; z++) body.del(s * bw, top, z);
    if (!kid) {
      // belt + buckle
      for (let z = bz0; z <= bz1; z++) for (let x = -bw; x <= bw; x++) body.paint(x, 2, z, 0x4A3222);
      body.box(-1, 2, bz0 - 1, 1, 2, bz0 - 1, 0xD8B24A); body.set(0, 2, bz0 - 1, 0x8A6A2A);
      // collar / neckline
      const coll = mul(shirt, 1.12);
      for (let x = -3; x <= 3; x++) body.set(x, top, bz0, Math.abs(x) <= 1 ? mul(skin, 0.95) : coll);
      body.set(0, top - 1, bz0, mul(skin, 0.92));
      body.set(-2, top - 1, bz0 - 1, coll); body.set(2, top - 1, bz0 - 1, coll);
    } else {
      for (let x = -2; x <= 2; x++) body.set(x, top, bz0, Math.abs(x) <= 1 ? mul(skin, 0.95) : mul(shirt, 1.12));
    }
    const front = (x, y, c, e) => body.set(x, y, bz0 - 1, c, e);
    const back = (x, y, c, e) => body.set(x, y, bz1 + 1, c, e);
    const skirt = (y0, flare, col) => { for (let y = y0; y <= -1; y++) { const f = 1 + Math.round((-y) * flare); for (let z = bz0 - f; z <= bz1 + f; z++) for (let x = -bw - f; x <= bw + f; x++) { const ex = x === -bw - f || x === bw + f, ez = z === bz0 - f || z === bz1 + f; if (!(ex || ez)) continue; if (ex && ez) continue; body.set(x, y, z, typeof col === 'function' ? col(x, y, z) : col); } } for (let z = bz0; z <= bz1; z++) for (let x = -bw; x <= bw; x++) body.set(x, -1, z, typeof col === 'function' ? col(x, -1, z) : col); };
    switch (acc) {
      case 'overalls': {
        const den = fab(0x3A5A9A, 0.08, 13);
        for (let y = 2; y <= top - 6; y++) for (let x = -4; x <= 4; x++) front(x, y, den(x, y, 0));
        for (const s of [-1, 1]) for (let y = top - 5; y <= top; y++) { front(s * 4, y, den(s, y, 1)); front(s * 3, y, den(s, y, 2)); back(s * 4, y, den(s, y, 3)); }
        front(-4, top - 6, 0xE0C060); front(4, top - 6, 0xE0C060);
        for (let x = -2; x <= 2; x++) front(x, 5, mul(0x3A5A9A, 0.8));
        break;
      }
      case 'apron': case 'apron2': case 'leather': {
        const ac = acc === 'apron' ? 0xFFFFFF : acc === 'apron2' ? 0x7AB05A : 0x6A4028;
        const aF = fab(ac, acc === 'leather' ? 0.14 : 0.05, 14);
        for (let y = -8; y <= top - 5; y++) for (let x = -5; x <= 5; x++) { if (y < -6 && Math.abs(x) === 5) continue; front(x, y, aF(x, y, 0)); }
        for (const s of [-1, 1]) for (let y = top - 4; y <= top; y++) front(s * 3, y, aF(s, y, 1));
        for (let x = -2; x <= 2; x++) front(x, -3, mul(ac, 0.88));
        if (acc === 'leather') for (const [x, y] of [[-4, 6], [4, 6], [-4, -4], [4, -4]]) front(x, y, 0xC8A050);
        if (acc === 'apron2') { front(-3, -2, 0xE84A6A); front(-2, -1, 0xF6D23A); }
        if (acc === 'apron') { for (let x = -3; x <= 3; x++) body.set(x, top + 1, bz0 - 1, 0xE84A4A); }
        break;
      }
      case 'robe': {
        const rF = fab(shirt, 0.07, 15);
        skirt(-15, 0.07, rF);
        for (let y = -15; y <= top - 1; y++) front(0, y, 0xE0C060);
        for (let x = -bw; x <= bw; x++) body.paint(x, 2, bz0, 0xE0C060);
        break;
      }
      case 'sash': {
        const vest = mul(shirt, 0.72);
        for (let y = 3; y <= top - 1; y++) for (let x = -bw; x <= bw; x++) if (Math.abs(x) >= 3) front(x, y, vest);
        for (let y = 0; y <= top; y++) { const x = Math.round(-bw + (y / top) * (2 * bw)); front(x, y, 0xE0B040); front(x + 1, y, 0xD0A030); }
        front(-4, top - 5, 0xF6D23A); front(-4, top - 6, 0xE8A020); front(-5, top - 6, 0xF6D23A); front(-3, top - 6, 0xF6D23A); front(-4, top - 7, 0xF6D23A);
        break;
      }
      case 'cross': {
        skirt(-9, 0.04, 0xF6F6F2);
        for (let y = 3; y <= top - 1; y++) for (let x = -bw; x <= bw; x++) if (Math.abs(x) >= 2) front(x, y, 0xF6F6F2);
        front(-4, top - 4, 0xE04040); front(-4, top - 5, 0xE04040); front(-4, top - 6, 0xE04040); front(-5, top - 5, 0xE04040); front(-3, top - 5, 0xE04040);
        break;
      }
      case 'armor': {
        const pl = (x, y, z) => mul(0x5E6E5E, 0.9 + H3(x, y, z, 18) * 0.16);
        for (let y = 4; y <= top - 1; y++) for (let x = -5; x <= 5; x++) front(x, y, pl(x, y, 0));
        for (let x = -5; x <= 5; x++) front(x, 9, 0x3AF0FF, 1);
        for (let y = 4; y <= top - 1; y++) for (let x = -5; x <= 5; x++) back(x, y, pl(x, y, 1));
        break;
      }
      case 'suit': {
        // trailer armour: chest & back plates, accent shoulders and side stripes, a glowing core, utility belt
        const P1 = shirt, P2 = L.suit2 || 0xFF7A1A, P3 = L.suit3 || 0xF4F6FA, D = 0x2A2E38;
        const plate = fab(P1, 0.05, 31), white = fab(P3, 0.03, 34);
        // the chest: a white panel down the middle (the glowing core sits in it), accent shoulders, armour around
        // (the white panel is the trailer suits' only: suit3 is set for them; the other suits keep the centre line)
        for (let y = 5; y <= top - 1; y++) for (let x = -5; x <= 5; x++) { front(x, y, (Math.abs(x) >= 4 && y >= top - 3) ? P2 : (L.suit3 && Math.abs(x) <= 2 && y >= 5 && y <= 12) ? white(x, y, 0) : (x === 0 && y < 9) ? mul(P1, 0.82) : plate(x, y, 0)); back(x, y, (y === top - 2) ? P2 : plate(x, y, 1)); }
        for (let y = 3; y <= top - 1; y++) for (let z = bz0; z <= bz1; z++) for (const sx of [-bw, bw]) body.paint(sx, y, z, (z === 0 || z === -1) ? P2 : ((y & 3) === 0 ? mul(P1, 0.84) : P1));
        for (let y = 9; y <= 11; y++) for (let x = -1; x <= 1; x++) body.set(x, y, bz0 - 2, (x === 0 && y === 10) ? 0xFFFFFF : 0x3AF0FF, 1);
        for (let x = -4; x <= 4; x++) body.set(x, top, bz0 - 1, D);
        for (let x = -bw; x <= bw; x++) front(x, 2, D);
        for (let z = bz0; z <= bz1; z++) { body.set(-bw - 1, 2, z, D); body.set(bw + 1, 2, z, D); }
        front(-1, 2, P2); front(0, 2, 0xFFE07A, 1); front(1, 2, P2);
        for (let y = 3; y <= 4; y++) for (let x = -4; x <= 4; x++) front(x, y, (x & 1) ? mul(P1, 0.7) : mul(P1, 0.8));
        body.set(bw + 1, 1, -1, D); body.set(bw + 1, 0, -1, mul(D, 1.3)); body.set(bw + 1, 1, 0, P2); // holster
        break;
      }
      case 'flight': {
        for (let x = -bw; x <= bw; x++) { body.paint(x, 10, bz0, 0xFF7A1A); body.paint(x, 11, bz0, 0xFF7A1A); body.paint(x, 8, bz0, 0x2A7AE0); }
        for (let y = 3; y <= top - 1; y++) body.paint(0, y, bz0, mul(shirt, 0.82));
        front(-4, 13, 0x2A7AE0); front(-5, 13, 0xF6F6F2); front(-4, 14, 0xFF7A1A); front(4, 13, 0x3AF0FF, 1);
        break;
      }
      case 'belt': {
        if (L.role === 'builder') {
          const vest = (x, y, z) => mul(0xFF8A1A, 0.95 + H3(x, y, z, 19) * 0.08);
          for (let y = 3; y <= top - 1; y++) for (let x = -bw; x <= bw; x++) if (Math.abs(x) >= 2) { front(x, y, (y === 7 || y === 12) ? 0xF4F4D0 : vest(x, y, 0)); back(x, y, (y === 7 || y === 12) ? 0xF4F4D0 : vest(x, y, 1)); }
        } else for (let y = 3; y <= top - 1; y++) for (let x = -bw; x <= bw; x++) if (Math.abs(x) >= 3) front(x, y, mul(shirt, 0.75));
        for (let z = bz0 - 1; z <= bz1 + 1; z++) for (const s of [-1, 1]) body.set(s * (bw + 1), 2, z, 0x5A3A22);
        for (let x = -bw; x <= bw; x++) front(x, 2, 0x5A3A22);
        front(-5, 1, 0x7A5A3A); front(-5, 0, 0x7A5A3A); front(5, 1, 0x9AA0A8); front(5, 0, 0x6A6E76); front(6, 1, 0x9AA0A8);
        break;
      }
      case 'shawl': {
        const sc = mul(shirt, 1.3);
        for (let y = top - 4; y <= top; y++) for (let z = bz0 - 1; z <= bz1 + 1; z++) for (let x = -bw - 1; x <= bw + 1; x++) { if (!(Math.abs(x) === bw + 1 || z === bz0 - 1 || z === bz1 + 1 || y === top)) continue; if (z === bz0 - 1 && Math.abs(x) <= 2 && y < top) continue; body.set(x, y, z, ((x + y) & 1) ? sc : mul(sc, 0.88)); }
        break;
      }
      default: {
        if (kid) {
          // t-shirt emblem
          const em = L.emblem || 0;
          const ec = [0xFFFFFF, 0xF6D23A, 0xFF7E9A, 0x7AE0FF][em & 3];
          if ((em >> 2) === 0) { front(0, 7, ec); front(-1, 6, ec); front(0, 6, ec); front(1, 6, ec); front(0, 5, ec); front(-1, 8, ec); front(1, 8, ec); }
          else if ((em >> 2) === 1) { front(-1, 7, ec); front(1, 7, ec); front(-1, 6, ec); front(0, 6, ec); front(1, 6, ec); front(0, 5, ec); }
          else for (let x = -bw; x <= bw; x++) { body.paint(x, 6, bz0, ec); body.paint(x, 8, bz0, ec); }
        } else if (!acc) {
          for (const y of [5, 8, 11]) body.paint(0, y, bz0, mul(shirt, 0.72));
          for (let y = 10; y <= 12; y++) for (let x = 3; x <= 5; x++) body.paint(x, y, bz0, mul(shirt, 0.9));
        }
      }
    }
    if (L.dress) skirt(kid ? -6 : -10, 0.12, fab(L.dressCol || shirt, 0.06, 20));

    // ============================== arms (pivot at the shoulder)
    const sleeveLen = armLen - handH;
    const rolled = L.role === 'smith' || L.role === 'builder' || L.role === 'farmer';
    const shortSl = kid && !L.longSleeves;
    function arm(right) {
      const a = mk(-6, 6, -44, 1, -19, 7);
      const s = right ? 1 : -1;
      const sleeveBottom = shortSl ? -Math.round(sleeveLen * 0.45) : rolled ? -Math.round(sleeveLen * 0.62) : -sleeveLen;
      a.rbox(-2, -sleeveLen, -2, 2, 0, 2, (x, y, z) => y >= sleeveBottom ? shF(x, y + 40, z) : mul(skin, 0.97), { top: true });
      if (acc === 'armor') a.rbox(-3, -4, -3, 3, 1, 3, (x, y, z) => mul(0x5E6E5E, 0.9 + H3(x, y, z, 21) * 0.16), { top: true });
      if (acc === 'suit') {
        const P2 = L.suit2 || 0xFF7A1A;
        a.rbox(-3, -5, -3, 3, 1, 3, (x, y, z) => y >= 0 ? mul(shirt, 1.08) : y === -5 ? P2 : shirt, { top: true });
        for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) a.paint(x, -Math.round(sleeveLen * 0.55), z, P2);
      }
      if (acc === 'flight') for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) a.paint(x, -5, z, 0xFF7A1A);
      if (acc === 'cross' || acc === 'robe') for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) a.paint(x, sleeveBottom, z, acc === 'robe' ? 0xE0C060 : 0xE8E8E4);
      // cuff
      if (!rolled && !shortSl) for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) a.paint(x, sleeveBottom, z, mul(shirt, 0.85));
      if (rolled) for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) a.paint(x, sleeveBottom, z, mul(shirt, 1.12));
      // hand + thumb
      const handC = acc === 'suit' ? 0x2A2E38 : skin;
      if (acc === 'suit') for (let z = -3; z <= 3; z++) for (let x = -3; x <= 3; x++) if (Math.abs(x) === 3 || Math.abs(z) === 3) a.set(x, -sleeveLen + 1, z, L.suit2 || 0xFF7A1A); // cuff
      a.rbox(-2, -armLen, -2, 2, -sleeveLen - 1, 2, (x, y, z) => mul(handC, y === -armLen ? 0.9 : 1), { bottom: true });
      a.set(-s * 2, -sleeveLen - 2, -3, mul(handC, 0.95)); a.set(-s * 2, -sleeveLen - 3, -3, mul(handC, 0.92));
      for (let x = -1; x <= 1; x++) a.set(x, -armLen + 1, -3, mul(handC, 0.86));
      const fy = -armLen + 2; // fist centre
      if (right && !kid) {
        const tool = L.tool !== undefined && L.tool !== null ? L.tool : (L.role === 'hero' ? null : role.tool);
        const wood = (x, y, z) => mul(0x8A5A3A, 0.9 + H3(x, y, z, 22) * 0.14), metal = (x, y, z) => mul(0x9AA0A8, 0.9 + H3(x, y, z, 23) * 0.14);
        if (tool === 'hammer') { for (let z = -11; z <= -3; z++) a.set(0, fy, z, wood); a.box(-1, fy - 3, -13, 1, fy + 3, -11, metal); a.set(0, fy + 3, -12, 0xC8CCD4); }
        else if (tool === 'hoe') { for (let y = fy - 16; y <= fy + 12; y++) a.set(0, y, -3, wood); for (let z = -8; z <= -3; z++) a.set(0, fy + 12, z, metal); a.box(0, fy + 10, -8, 0, fy + 11, -8, metal); }
        else if (tool === 'rifle') { a.box(-1, fy - 1, -17, 1, fy + 2, -2, (x, y, z) => mul(0x3A3E46, 0.9 + H3(x, y, z, 24) * 0.12)); for (let z = -15; z <= -4; z++) a.set(0, fy + 2, z, 0x3AF0FF, 1); a.set(0, fy + 1, -18, 0x3AF0FF, 1); a.box(0, fy - 4, -6, 0, fy - 2, -4, 0x2A2E36); }
        else if (tool === 'blaster') {
          // trailer blaster, modelled along the arm (the hero aims: arm forward → barrel forward, local −z is up)
          const gm = (x, y, z) => mul(0x3A3F4A, 0.9 + H3(x, y, z, 29) * 0.12);
          const b0 = -armLen + 3, b1 = -armLen - 11;           // breech … muzzle along −y
          a.box(-2, b1, -6, 2, b0, -3, gm);                    // body above the fist
          for (let y = b1 + 1; y <= b0 - 2; y++) { a.set(0, y, -7, 0x3AF0FF, 1); if (y & 1) { a.set(-3, y, -4, 0x3AF0FF, 1); a.set(3, y, -4, 0x3AF0FF, 1); } }
          a.box(-1, b1 - 3, -5, 1, b1 - 1, -4, 0x2A2E36); a.set(0, b1 - 4, -5, 0xBFFBFF, 1); a.set(0, b1 - 4, -4, 0x3AF0FF, 1);
          for (const x of [-2, 2]) { a.set(x, b0 - 3, -7, 0xFF7A1A); a.set(x, b0 - 4, -7, 0xFF7A1A); }
          a.box(0, b0 - 3, -2, 0, b0 - 1, -1, 0x2A2E36);       // grip into the hand
        }
        else if (tool === 'book') { a.box(-3, fy - 3, -6, 2, fy + 3, -4, (x, y, z) => z === -6 || x === -3 ? 0x3F63A8 : 0xF0EAD8); a.set(-3, fy, -7, 0xE0C060); }
        else if (tool === 'bread') { a.box(-3, fy - 6, -4, 3, fy - 2, 3, (x, y, z) => (x + y + z) & 1 ? 0xA07040 : 0x8A5A30); a.ell(-1, fy - 1, -1, 2, 1.2, 1.5, 0xD89A50); a.ell(1.5, fy - 1, 1, 1.5, 1, 1.5, 0xE8B060); }
        else if (tool === 'can') { a.box(-2, fy - 7, -3, 2, fy - 2, 2, (x, y, z) => mul(0x5A9AC0, 0.92 + H3(x, y, z, 25) * 0.1)); for (let k = 0; k < 5; k++) a.set(0, fy - 5 + k, -4 - k, 0x5A9AC0); a.box(-1, fy - 1, -1, 1, fy, 1, 0x3A6A8A); }
      }
      if (!right && elder && role.tool === 'cane') { for (let y = -armLen - 22; y <= fy + 1; y++) a.set(0, y, -3, mul(0x8A5A3A, 0.9 + ((y & 1) ? 0.08 : 0))); a.set(0, fy + 2, -4, 0x8A5A3A); a.set(0, fy + 2, -5, 0x8A5A3A); a.set(0, fy + 1, -5, 0x8A5A3A); }
      return a;
    }
    const armL = arm(false), armR = arm(true);

    // ============================== legs (pivot at the hip)
    function leg(right) {
      const g = mk(-5, 5, -legH - 1, 1, -7, 5);
      const shoeH = kid ? 3 : 4;
      const pF = fab(pants, 0.06, right ? 26 : 27);
      if (kid) {
        const shortsTo = -5;
        g.rbox(-legW, -legH + shoeH, -2, legW, -1, 2, (x, y, z) => y >= shortsTo ? pF(x, y, z) : y >= -legH + shoeH + 2 ? mul(skin, 0.97) : 0xF4F4F0);
        const snk = [0xE84A4A, 0x4A8AE8, 0xF0C040, 0x40C0C0, 0xF06AA0][(sd >> 11) % 5];
        g.rbox(-legW, -legH, -3, legW, -legH + shoeH - 1, 2, (x, y, z) => y === -legH ? 0xF4F4F0 : snk, { top: true });
      } else {
        g.rbox(-legW, -legH + shoeH, -3, legW, -1, 3, pF);
        for (let y = -legH + shoeH + 1; y <= -2; y++) g.paint(0, y, -3, mul(pants, 0.86)); // crease
        for (let z = -3; z <= 3; z++) for (let x = -legW; x <= legW; x++) g.paint(x, -legH + shoeH, z, mul(pants, 0.84)); // cuff
        const sole = mul(shoes, 0.6), sc = (x, y, z) => mul(shoes, 0.95 + H3(x, y, z, 28) * 0.1);
        g.rbox(-legW, -legH, -4, legW, -legH + shoeH - 1, 3, (x, y, z) => y === -legH ? sole : (z <= -3 && y === -legH + shoeH - 1 && Math.abs(x) <= 1) ? mul(shoes, 1.3) : sc(x, y, z), { top: true });
        if (acc === 'suit') {
          const P2 = L.suit2 || 0xFF7A1A, P3 = L.suit3 || 0, ky = -Math.round(legH * 0.55);
          // the trailer suits (suit3) have white knee guards; the other suits keep their accent band
          const guard = P3 ? mul(P3, 0.92) : mul(P2, 1.12), band = P3 || P2;
          g.rbox(-legW, ky - 2, -4, legW, ky + 2, -3, (x, y) => y === ky + 2 ? guard : band, {});
          for (let y = -legH + shoeH; y <= -legH + shoeH + 3; y++) for (let z = -3; z <= 3; z++) for (let x = -legW; x <= legW; x++) g.paint(x, y, z, y === -legH + shoeH + 3 ? mul(P2, 1.1) : mul(P2, 0.92)); // boot shafts
          for (let y = -3; y <= -1; y++) for (let z = -3; z <= 3; z++) g.paint(right ? legW : -legW, y, z, mul(pants, 0.75)); // hip joint
        }
      }
      return g;
    }
    const legL = leg(false), legR = leg(true);

    const hipY = legH, headY = legH + bodyH + 2, shY = legH + bodyH - 1;
    // ============================== the rig: elbows and knees
    // each limb splits into two parts; the lower one is re-based on its joint so a pose rotates it about the elbow / knee.
    // Tools and the hand go with the forearm (whatever they reach up to), the shoe with the shin.
    const elbow = -Math.round(armLen * 0.47), knee = -Math.round(legH * 0.5);
    const split = (P, pred, jointY) => {
      const g = P.g, up = new VR.VoxGrid(g.sx, g.sy, g.sz, g.ox, g.oy, g.oz), lo = new VR.VoxGrid(g.sx, g.sy, g.sz, g.ox, g.oy + jointY, g.oz);
      for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) {
        const v = g.c[g.i(x, y, z)]; if (!v) continue;
        const py = y - g.oy, pz = z - g.oz;
        if (pred(py, pz)) lo.c[lo.i(x, y, z)] = v; else up.c[up.i(x, y, z)] = v;
      }
      return [up, lo];
    };
    const [armLU, foreL] = split(armL, (y, z) => y < elbow || (z <= -3 && y <= -5), elbow), [armRU, foreR] = split(armR, (y, z) => y < elbow || (z <= -3 && y <= -5), elbow);
    const [legLU, shinL] = split(legL, (y) => y < knee, knee), [legRU, shinR] = split(legR, (y) => y < knee, knee);
    return {
      unit: 32, h: kid ? 1.1 : 1.8, w: 0.3, gait: 'biped', kid, eyeY,
      parts: { body: body, head: head, arm_l: armLU, arm_r: armRU, fore_l: foreL, fore_r: foreR, leg_l: legLU, leg_r: legRU, shin_l: shinL, shin_r: shinR, lids, mouth },
      layout: { body: [0, hipY, 0], head: [0, headY, 0], lids: [0, headY, 0], mouth: [0, headY, 0], arm_l: [-armX, shY, 0], arm_r: [armX, shY, 0], leg_l: [-legX, hipY, 0], leg_r: [legX, hipY, 0] },
      // parent → [parent part, joint offset in the parent's space]; parts without an entry sit at their layout position
      rig: { head: ['body', [0, headY - hipY, 0]], lids: ['head', [0, 0, 0]], mouth: ['head', [0, 0, 0]], arm_l: ['body', [-armX, shY - hipY, 0]], arm_r: ['body', [armX, shY - hipY, 0]], fore_l: ['arm_l', [0, elbow, 0]], fore_r: ['arm_r', [0, elbow, 0]], shin_l: ['leg_l', [0, knee, 0]], shin_r: ['leg_r', [0, knee, 0]] },
      order: ['body', 'head', 'lids', 'mouth', 'arm_l', 'arm_r', 'fore_l', 'fore_r', 'leg_l', 'leg_r', 'shin_l', 'shin_r'],
    };
  }

  // half-resolution copy for distant villagers
  function downsample(g) {
    const sx = Math.ceil(g.sx / 2), sy = Math.ceil(g.sy / 2), sz = Math.ceil(g.sz / 2);
    const o = new VR.VoxGrid(sx, sy, sz, g.ox / 2, g.oy / 2, g.oz / 2);
    for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) {
      let n = 0, r = 0, gg = 0, b = 0, em = 0;
      for (let k = 0; k < 8; k++) {
        const v = g.get(x * 2 + (k & 1), y * 2 + ((k >> 1) & 1), z * 2 + (k >> 2));
        if (!v) continue;
        n++; r += (v >> 16) & 255; gg += (v >> 8) & 255; b += v & 255; if ((v >> 24) & 1) em++;
      }
      if (n >= 3) o.set(x, y, z, ((r / n) << 16) | ((gg / n) << 8) | (b / n), em * 2 >= n);
    }
    return o;
  }

  const parts = (P) => { const o = {}; for (const k in P) o[k] = { grid: P[k].g || P[k], pivot: [0, 0, 0] }; return o; };
  V.JOINTS = ['body', 'head', 'arm_l', 'arm_r', 'fore_l', 'fore_r', 'leg_l', 'leg_r', 'shin_l', 'shin_r'];
  V.buildHiRes = function (L) { const m = build(L); m.parts = parts(m.parts); return m; };
  V.buildLow = function (L) {
    const m = build(L);
    const out = {}; for (const k in m.parts) out[k] = { grid: downsample(m.parts[k].g || m.parts[k]), pivot: [0, 0, 0] };
    const lay = {}; for (const k in m.layout) lay[k] = m.layout[k].map(v => v / 2);
    const rig = {}; for (const k in m.rig) rig[k] = [m.rig[k][0], m.rig[k][1].map(v => v / 2)];
    return Object.assign({}, m, { unit: 16, parts: out, layout: lay, rig });
  };
  // model accessor: full detail close up, half-res further away
  V.model = function (gl, L, far) {
    const key = V.lookKey(L) + (far ? ':lo' : ':hi');
    if (!VR.VOXMODELS[key]) VR.VOXMODELS[key] = far ? () => V.buildLow(L) : () => V.buildHiRes(L);
    return VR.getVoxModel(gl, key);
  };
})(VR);
