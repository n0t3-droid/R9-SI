// ============================================================================
// Villager folk: names & families, appearance → detailed mini-voxel models
// (faces, hair styles, role outfits & tools, kids and elders), a warm
// dialogue library, and a block-grid A* pathfinder that opens doors, climbs
// steps and keeps off the crops.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, F = VR.F, PH = VR.PHYS;
  const V = VR.Folk = {};
  const hash = (a, b, c) => { let h = (a * 374761393 + b * 668265263 + (c | 0) * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
  V.hash = hash;

  // ---------------------------------------------------------------- names
  const FIRST = ['Mira', 'Oren', 'Talia', 'Juno', 'Kael', 'Suri', 'Nilo', 'Aven', 'Lio', 'Rhea', 'Tomas', 'Ayla', 'Bram', 'Cora', 'Dax', 'Elin', 'Faro', 'Gia', 'Hale', 'Ivo', 'Jora', 'Kiri', 'Luca', 'Mae', 'Nox', 'Opal', 'Pax', 'Quin', 'Rosa', 'Sol', 'Tev', 'Uma', 'Vesper', 'Wren', 'Yara', 'Zeph', 'Ansel', 'Bea', 'Cyrus', 'Dara', 'Emil', 'Fern', 'Gus', 'Hana', 'Iris', 'Jasper', 'Kaia', 'Leo', 'Maya', 'Nico', 'Olive', 'Rune', 'Sage', 'Theo', 'Una', 'Willa', 'Yuki', 'Zara', 'Arlo', 'Clem', 'Eli', 'Finn', 'Hugo', 'Ines', 'Lulu', 'Nell', 'Otto', 'Ria', 'Tully', 'Wynn', 'Ada', 'Bodhi', 'Cleo', 'Esme', 'Idris', 'Mika', 'Noor', 'Orla', 'Remy', 'Selma'];
  const KIDS = ['Pip', 'Dot', 'Bo', 'Kip', 'Poppy', 'Tink', 'Moss', 'Sprout', 'Bean', 'Lark', 'Pebble', 'Button', 'Fizz', 'Juniper', 'Nova', 'Sunny', 'Twig', 'Wiggles', 'Mochi', 'Pico', 'Rue', 'Sky', 'Taro', 'Ziggy'];
  const SUR = ['Oakhart', 'Brightwater', 'Stonefield', 'Skylark', 'Emberly', 'Mossgrove', 'Starling', 'Vale', 'Quill', 'Thornbury', 'Amberly', 'Fairwind', 'Hollis', 'Larkspur', 'Meadows', 'Nightingale', 'Pennywhistle', 'Rivers', 'Tinsley', 'Willowby', 'Ashdown', 'Bellweather', 'Copperfield', 'Dawnbrook', 'Evergreen', 'Fernsby', 'Goldleaf', 'Honeywell', 'Ironwood', 'Juniper', 'Kettleby', 'Lumen', 'Marlow', 'Northwind', 'Orchard', 'Puddlefoot', 'Quinby', 'Rosewood', 'Sunderly', 'Thistle'];
  V.FIRST = FIRST; V.KIDS = KIDS; V.SUR = SUR;

  // ---------------------------------------------------------------- roles
  const ROLES = V.ROLES = {
    farmer: { title: 'Farmer', hat: 'straw', shirts: [0x6A9A4A, 0x8AB05A, 0xC8A060, 0x5A8AC8], acc: 'overalls', tool: 'hoe', job: 'farm' },
    baker: { title: 'Baker', hat: 'chef', shirts: [0xF4EEE4], acc: 'apron', tool: 'bread', job: 'bake' },
    smith: { title: 'Smith', hat: null, shirts: [0x6A4A3A, 0x5A5A60], acc: 'leather', tool: 'hammer', job: 'forge' },
    scholar: { title: 'Scholar', hat: null, glasses: true, shirts: [0x3F4F8A, 0x7A55C8, 0x2F6A6A], acc: 'robe', tool: 'book', job: 'read' },
    healer: { title: 'Healer', hat: 'cap', shirts: [0xF4F4F0], acc: 'cross', tool: null, job: 'heal' },
    mayor: { title: 'Mayor', hat: 'top', shirts: [0x8A2A3A, 0x2A3A6A], acc: 'sash', tool: null, job: 'council' },
    builder: { title: 'Builder', hat: 'hard', shirts: [0xE07A2A, 0x3A6AB0, 0x4A8A5A], acc: 'belt', tool: 'hammer', job: 'build' },
    ranger: { title: 'Ranger', hat: 'visor', shirts: [0x3A4A3A, 0x2A3A4A], acc: 'armor', tool: 'rifle', job: 'patrol' },
    pilot: { title: 'Pilot', hat: 'goggles', shirts: [0xE8ECF0], acc: 'flight', tool: null, job: 'pad' },
    operator: { title: 'Flight Controller', hat: null, shirts: [0x2F55C8, 0x3A6AD8], acc: 'flight', tool: null, job: 'control' },
    cashier: { title: 'Cashier', hat: 'cap', shirts: [0x3AA0E0, 0x40B080], acc: 'apron', tool: null, job: 'till' },
    clerk: { title: 'Shop Clerk', hat: 'cap', shirts: [0x3AA0E0, 0xF0A030], acc: 'apron2', tool: null, job: 'stock' },
    gardener: { title: 'Gardener', hat: 'sun', shirts: [0x8AC06A, 0xE8A0B0, 0xF0D070], acc: 'apron2', tool: 'can', job: 'garden' },
    crafter: { title: 'Crafter', hat: null, shirts: [0xB06A3A, 0x6A8AA0], acc: 'belt', tool: 'hammer', job: 'craft' },
    teacher: { title: 'Teacher', hat: null, glasses: true, shirts: [0x7A55C8, 0x2F8C8A, 0xC0443A], acc: 'robe', tool: 'book', job: 'teach' },
    worker: { title: 'Factory Worker', hat: 'hard', shirts: [0x3A6AB0, 0xE07A2A, 0x4A4A4A], acc: 'belt', tool: 'hammer', job: 'assemble' },
    office: { title: 'Office Clerk', hat: null, shirts: [0xF2F2EE, 0x9AB4D0, 0x2A3A6A, 0xE8D8B8], acc: 'sash', tool: null, job: 'office' },
    barista: { title: 'Barista', hat: 'cap', shirts: [0x6A4A3A, 0x2F9C98, 0xF0A030], acc: 'apron', tool: null, job: 'brew' },
    child: { title: 'Kid', hat: null, shirts: [0xE84A4A, 0x4A8AE8, 0xF0C040, 0x6AC06A, 0xC070E0, 0xF08AB0, 0x40C0C0], acc: null, tool: null, job: 'play' },
    elder: { title: 'Elder', hat: null, shirts: [0x8A7A6A, 0x6A5A7A, 0x5A6A7A], acc: 'shawl', tool: 'cane', job: 'stroll' },
    hero: { title: 'Explorer', hat: null, shirts: [0x2F55C8], acc: 'suit', tool: null, job: 'explore' },
  };
  const SKIN = [0xF6D7BD, 0xEEC39E, 0xDDA57A, 0xC18558, 0x9C6440, 0x74462C, 0x5A3624];
  const HAIR = [0x2A1A12, 0x4A2E1A, 0x7A4A24, 0xB07A3A, 0xE0C888, 0xA83A22, 0x303030, 0x6A4AC0, 0x2A7AB0, 0xD86AA0];
  const PANTS = [0x3A4A6A, 0x5A4A3A, 0x4A4A4A, 0x6A5A8A, 0x2A5A4A, 0x7A6A5A];
  const STYLES_H = ['short', 'long', 'bun', 'pony', 'curly', 'spiky', 'bob', 'braids', 'afro', 'short'];
  V.TRAITS = ['cheerful', 'curious', 'shy', 'dreamy', 'jokester', 'wise', 'kind', 'energetic'];
  V.LIKES = ['stars', 'bread', 'starships', 'flowers', 'crystals', 'music', 'rain', 'books', 'gardening', 'stories'];

  // ---------------------------------------------------------------- appearance
  V.look = function (seed, role, age, parentLook) {
    const r = (k) => hash(seed, k, 911);
    const R0 = ROLES[role] || ROLES.farmer;
    const skin = parentLook && (r(1) & 3) ? parentLook.skin : SKIN[r(1) % SKIN.length];
    let hair = parentLook && (r(2) & 1) ? parentLook.hair : HAIR[r(2) % (r(9) % 7 === 0 ? HAIR.length : 7)];
    if (age === 'elder') hair = (r(2) & 1) ? 0xE8E8E8 : 0xB8B8B8;
    let hs = STYLES_H[r(3) % STYLES_H.length];
    if (age === 'elder' && (r(3) & 3) === 0) hs = 'bald';
    return {
      skin, hair, hs, age, role,
      shirt: R0.shirts[r(4) % R0.shirts.length],
      pants: PANTS[r(5) % PANTS.length],
      shoes: (r(6) & 1) ? 0x3A2A1E : 0x2A2A30,
      beard: age !== 'child' && (r(7) % 6 === 0),
      freckles: (r(8) % 4) === 0,
      eye: [0x2A1E16, 0x2A4A7A, 0x3A6A3A, 0x6A4A2A][r(10) & 3],
      // extra variety for the hi-res rig
      kidHat: age === 'child' ? [null, null, 'beanie', 'kidcap', 'bow', null][r(11) % 6] : null,
      elderHat: age === 'elder' && (r(12) % 3) === 0 ? 'flat' : null,
      dress: age !== 'elder' && !R0.acc && (r(13) % 4) === 0,
      dressCol: [0xE86A8A, 0x6AA0E8, 0xF0C050, 0x8ACB6A, 0xB48AE8, 0xF4F0E8][r(14) % 6],
      emblem: r(15) % 12,
      lashes: (r(16) & 1) === 1,
    };
  };
  const lookKey = (L) => ['vil2', L.skin, L.hair, L.hs, L.age, L.role, L.shirt, L.pants, L.shoes, L.beard ? 1 : 0, L.freckles ? 1 : 0, L.eye, L.kidHat || '', L.elderHat || '', L.dress ? L.dressCol : 0, L.emblem | 0, L.lashes ? 1 : 0, L.suit2 | 0, L.tool || ''].join(':');

  // ---------------------------------------------------------------- heroes (players): armour suits from the trailer
  V.SKIN = SKIN; V.HAIR = HAIR; V.HAIR_STYLES = STYLES_H.slice(0, 9);
  V.HERO_SUITS = [
    { name: 'Nova Blue', c: 0x2F55C8, a: 0xFF7A1A },
    { name: 'Ember Red', c: 0xC8402E, a: 0xF2F2EC },
    { name: 'Jungle Green', c: 0x3A8A4A, a: 0xF0C040 },
    { name: 'Violet Star', c: 0x7048C0, a: 0x3AF0FF },
    { name: 'Arctic White', c: 0xE4E8EE, a: 0x2F8AE0 },
    { name: 'Shadow', c: 0x2E323C, a: 0xFF4AA0 },
    { name: 'Solar Orange', c: 0xE8782A, a: 0x2F55C8 },
    { name: 'Teal Wave', c: 0x1F9A9A, a: 0xFFE04A },
  ];
  const clampI = (v, n) => { v = v | 0; return v < 0 ? 0 : v >= n ? n - 1 : v; };
  // o: {suit, hair, hs, skin, tool} (indices) → a look for the folk rig
  V.heroLook = function (o) {
    o = o || {};
    const su = V.HERO_SUITS[clampI(o.suit, V.HERO_SUITS.length)];
    const d = (c, k) => sh(c, k);
    return {
      skin: SKIN[clampI(o.skin, SKIN.length)], hair: HAIR[clampI(o.hair, HAIR.length)], hs: V.HAIR_STYLES[clampI(o.hs, V.HAIR_STYLES.length)], age: 'adult', role: 'hero',
      shirt: su.c, pants: d(su.c, 0.8), shoes: su.a, suit2: su.a, beard: false, freckles: false, eye: 0x2A4A7A,
      kidHat: null, elderHat: null, dress: false, dressCol: 0, emblem: 0, lashes: !!o.lashes, tool: o.tool || null,
    };
  };
  V.randomHero = function (seed) { const r = (k) => hash(seed | 0, k, 4711); return { suit: r(1) % V.HERO_SUITS.length, hair: r(2) % 7, hs: r(3) % V.HAIR_STYLES.length, skin: r(4) % SKIN.length, lashes: (r(5) & 1) === 1 }; };
  // walking / flying / aiming pose for a hero (same part names as the villager rig)
  V.heroPose = function (a) {
    const wa = a.walkAmt || 0, ph = (a.walk || 0) * 3, s = Math.sin(ph) * 0.7 * wa;
    const bob = Math.abs(Math.cos(ph)) * wa * 0.9;
    const up = (rx, ry, rz) => [rx || 0, ry || 0, rz || 0, 0, bob, 0];
    const P = VR.FolkAnim ? VR.FolkAnim.walk(ph, wa, false, {}) : { leg_l: [s, 0, 0], leg_r: [-s, 0, 0], arm_l: up(-s * 0.9, 0, -0.07), arm_r: up(s * 0.9, 0, 0.07), body: up() };
    P.head = up(Math.max(-0.6, Math.min(0.6, -(a.pitch || 0))), 0, 0);
    if (a.aim) { P.arm_r = up(1.45 + Math.max(-0.5, Math.min(0.5, -(a.pitch || 0))), 0, 0.05); P.fore_r = [0.05, 0, 0]; }
    if (a.swing > 0) P.arm_r = up(1.2 + Math.sin(a.swing * Math.PI) * 0.9, 0, 0.1);
    if (a.fly) { P.leg_l = [0.15, 0, -0.05]; P.leg_r = [0.1, 0, 0.05]; P.arm_l = up(0.25, 0, -0.3); if (!a.aim) P.arm_r = up(0.25, 0, 0.3); }
    if (a.sneak) { P.body[0] = 0.35; P.head[0] -= 0.2; }
    return P;
  };
  V.isBlaster = (id) => !!id && /blaster|laser|rifle|gun/.test(id);
  V.lookKey = lookKey;

  // ---------------------------------------------------------------- model factory (1 voxel = 1/16 block)
  const sh = (c, k) => { const r = Math.min(255, ((c >> 16) & 255) * k) | 0, g = Math.min(255, ((c >> 8) & 255) * k) | 0, b = Math.min(255, (c & 255) * k) | 0; return (r << 16) | (g << 8) | b; };
  function part(sx, sy, sz, pivot, fn) { const g = new VR.VoxGrid(sx, sy, sz, pivot[0], pivot[1], pivot[2]); fn(g); return { grid: g, pivot: [0, 0, 0] }; }
  function buildModel(L) {
    const kid = L.age === 'child', elder = L.age === 'elder';
    const role = ROLES[L.role] || ROLES.farmer;
    const legH = kid ? 7 : 11, bodyH = kid ? 8 : 11, armH = kid ? 8 : 11;
    const skin = L.skin, shirt = L.shirt, pants = L.pants;
    // ---- head (grid 12x12x12, head cube at 2..9, face toward -z at z=2)
    const head = part(12, 13, 12, [6, 0, 6], (g) => {
      const H = (x, y, z, c, e) => g.set(x + 2, y, z + 2, c, e);
      const HB = (x0, y0, z0, x1, y1, z1, c, e) => g.box(x0 + 2, y0, z0 + 2, x1 + 2, y1, z1 + 2, c, e ? { emis: 1 } : undefined);
      HB(0, 0, 0, 7, 7, 7, skin, false);
      // face
      const eyeY = 4;
      H(1, eyeY, -0, 0xFFFFFF); H(2, eyeY, 0, L.eye); H(5, eyeY, 0, L.eye); H(6, eyeY, 0, 0xFFFFFF);
      H(2, eyeY + 1, 0, 0xFFFFFF);
      if (!elder || (L.skin & 1)) { H(1, eyeY + 1, 0, sh(L.hair, 0.8)); H(2, eyeY + 2, 0, sh(L.hair, 0.8)); H(5, eyeY + 2, 0, sh(L.hair, 0.8)); H(6, eyeY + 1, 0, sh(L.hair, 0.8)); }
      H(3, 3, -1, sh(skin, 1.02)); H(4, 3, -1, sh(skin, 0.98)); // nose (soft, no dark underside)
      H(3, 1, 0, 0xB0485A); H(4, 1, 0, 0xB0485A); H(2, 2, 0, 0xD8888E); H(5, 2, 0, 0xD8888E); // smile
      if (kid || L.freckles) { H(1, 2, 0, 0xF09A9A); H(6, 2, 0, 0xF09A9A); }
      if (elder) { H(1, 3, 0, sh(skin, 0.88)); H(6, 3, 0, sh(skin, 0.88)); }
      if (role.glasses) { for (const x of [1, 2, 5, 6]) H(x, eyeY, -1, 0x3A3A40); H(3, eyeY, -1, 0x3A3A40); H(4, eyeY, -1, 0x3A3A40); H(1, eyeY, 0, 0xC8E8FF); H(6, eyeY, 0, 0xC8E8FF); }
      if (L.beard) { HB(1, 0, 0, 6, 1, 0, L.hair); H(2, 2, 0, L.hair); H(5, 2, 0, L.hair); H(3, 0, -1, L.hair); H(4, 0, -1, L.hair); H(3, 1, 0, 0xB0485A); H(4, 1, 0, 0xB0485A); }
      // hair
      const hc = L.hair, hd = sh(L.hair, 0.82);
      const hairTop = () => { HB(0, 7, 0, 7, 8, 7, hc); HB(-1, 5, 0, -1, 7, 7, hd); HB(8, 5, 0, 8, 7, 7, hd); HB(0, 5, 8, 7, 8, 8, hd); for (let x = 0; x < 8; x++) if ((x & 1) || x < 2 || x > 5) H(x, 7, -1, hc); };
      switch (L.hs) {
        case 'bald': HB(-1, 3, 1, -1, 5, 6, hc); HB(8, 3, 1, 8, 5, 6, hc); HB(0, 3, 8, 7, 5, 8, hc); break;
        case 'short': hairTop(); break;
        case 'spiky': hairTop(); for (let x = 0; x < 8; x += 2) { H(x, 9, 2 + (x & 2), hc); H(x + 1, 9, 5, hc); } break;
        case 'long': hairTop(); HB(-1, 0, 2, -1, 5, 7, hd); HB(8, 0, 2, 8, 5, 7, hd); HB(0, 0, 8, 7, 5, 8, hd); break;
        case 'bob': hairTop(); HB(-1, 2, 0, -1, 5, 7, hd); HB(8, 2, 0, 8, 5, 7, hd); HB(0, 2, 8, 7, 5, 8, hd); break;
        case 'bun': hairTop(); HB(2, 9, 2, 5, 10, 5, hc); HB(3, 11, 3, 4, 11, 4, hc); break;
        case 'pony': hairTop(); HB(3, 3, 9, 4, 7, 9, hc); HB(3, 1, 10, 4, 4, 10, hd); break;
        case 'curly': hairTop(); for (let x = -1; x <= 8; x++) for (let z = 0; z <= 8; z++) if (((x + z) & 1) === 0) H(x, 9, z, hc); HB(-1, 3, 0, -1, 7, 7, hc); HB(8, 3, 0, 8, 7, 7, hc); break;
        case 'braids': hairTop(); HB(-1, 0, 3, -1, 5, 4, hd); HB(8, 0, 3, 8, 5, 4, hd); H(-1, 0, 3, 0xE84A6A); H(8, 0, 3, 0xE84A6A); break;
      }
      // hats
      const hat = kid ? null : role.hat;
      if (hat === 'straw') { HB(-2, 8, -2, 9, 8, 9, 0xE8C860); HB(0, 9, 0, 7, 10, 7, 0xD8B048); HB(0, 9, 0, 7, 9, 7, 0xB05A3A); }
      else if (hat === 'chef') { HB(0, 8, 0, 7, 8, 7, 0xFFFFFF); HB(-1, 9, -1, 8, 11, 8, 0xF8F8F4); HB(0, 12, 0, 7, 12, 7, 0xF0F0EC); }
      else if (hat === 'hard') { HB(-1, 7, -1, 8, 9, 8, 0xF0A020); HB(-1, 7, -2, 8, 7, -2, 0xF0A020); HB(3, 10, 0, 4, 10, 7, 0xF8C040); }
      else if (hat === 'top') { HB(-1, 8, -1, 8, 8, 8, 0x1A1A22); HB(0, 9, 0, 7, 12, 7, 0x1A1A22); HB(0, 9, 0, 7, 9, 7, 0x8A2A3A); }
      else if (hat === 'visor') { HB(-1, 5, -1, 8, 9, 8, 0x3A4A3A); HB(0, 4, -1, 7, 5, -1, 0x3AF0FF, true); HB(0, 9, 0, 7, 9, 7, 0x4A5A4A); }
      else if (hat === 'goggles') { HB(-1, 6, 0, 8, 6, 8, 0x5A3A2A); HB(1, 6, -1, 2, 6, -1, 0x9AD8FF, true); HB(5, 6, -1, 6, 6, -1, 0x9AD8FF, true); }
      else if (hat === 'cap') { HB(0, 8, 0, 7, 9, 7, 0xF4F4F0); H(3, 8, -1, 0xE04040); H(4, 8, -1, 0xE04040); }
      else if (hat === 'sun') { HB(-2, 8, -2, 9, 8, 9, 0xF0E0C0); HB(0, 9, 0, 7, 10, 7, 0xF0E0C0); H(6, 10, 1, 0xE84A6A); H(6, 10, 2, 0xF6D23A); }
    });
    // ---- body
    const body = part(8, bodyH, 5, [4, 0, 2], (g) => {
      g.box(0, 0, 0, 7, bodyH - 1, 3, shirt, { shade: 0.05 });
      g.box(0, 0, 0, 7, 1, 3, pants); // waistband
      g.box(0, 2, 0, 7, 2, 3, sh(pants, 0.6)); // belt
      const top = bodyH - 1, acc = kid ? null : role.acc;
      g.box(2, top, 0, 5, top, 0, sh(shirt, 0.8)); // collar
      if (acc === 'apron') { g.box(1, 0, -1 + 1, 6, top - 2, 0, 0xFFFFFF); g.box(2, top - 1, 0, 5, top - 1, 0, 0xFFFFFF); }
      else if (acc === 'apron2') g.box(1, 0, 0, 6, top - 3, 0, 0x7AB05A);
      else if (acc === 'leather') g.box(1, 0, 0, 6, top - 1, 0, 0x6A4028);
      else if (acc === 'overalls') { g.box(1, 0, 0, 6, 5, 0, 0x3A5A9A); g.box(2, 6, 0, 2, top, 0, 0x3A5A9A); g.box(5, 6, 0, 5, top, 0, 0x3A5A9A); g.set(2, 5, 0, 0xE0C060); g.set(5, 5, 0, 0xE0C060); }
      else if (acc === 'robe') { g.box(3, 0, 0, 4, top, 0, 0xE0C060); }
      else if (acc === 'cross') { g.box(3, 4, 0, 4, 8, 0, 0xE04040); g.box(2, 5, 0, 5, 7, 0, 0xE04040); }
      else if (acc === 'sash') for (let y = 0; y <= top; y++) { const x = Math.round(y * 7 / top); g.set(x, y, 0, 0xE0B040); g.set(x, y, 3, 0xE0B040); }
      else if (acc === 'belt') { g.box(0, 2, 0, 7, 2, 3, 0x6A4A2A); g.set(2, 1, 0, 0x9AA0A8); g.set(5, 1, 0, 0xC89A3A); }
      else if (acc === 'armor') { g.box(1, 3, 0, 6, top - 1, 0, 0x6A7A6A); g.box(1, 6, 0, 6, 6, 0, 0x3AF0FF, { emis: 1 }); g.box(0, top, 0, 7, top, 3, 0x5A6A5A); }
      else if (acc === 'flight') { g.box(0, 5, 0, 7, 5, 3, 0xFF7A1A); g.box(0, 7, 0, 7, 7, 3, 0x2A7AE0); g.set(5, 9, 0, 0x3AF0FF, 1); }
      else if (acc === 'shawl') { g.box(0, top - 3, 0, 7, top, 3, sh(shirt, 1.25)); }
      else if (!kid) { g.set(3, 4, 0, sh(shirt, 0.7)); g.set(3, 7, 0, sh(shirt, 0.7)); }
      if (kid) { g.box(2, 3, 0, 5, 5, 0, (L.shirt & 0x100) ? 0xFFFFFF : 0xF6D23A); }
    });
    // ---- arms (pivot at the shoulder); tools baked into the right hand
    const armL = part(4, armH + 1, 4, [2, armH, 2], (g) => {
      g.box(0, 0, 0, 3, armH, 3, (x, y) => y < 3 ? skin : shirt, { shade: 0.04 });
      if ((ROLES[L.role] || {}).tool === 'cane' && !kid) { g.box(1, -8 + 8, -2 + 2, 2, 1, 1, 0x8A5A3A); }
    });
    const tool = kid ? null : role.tool;
    const armR = part(6, armH + 10, 16, [3, armH + 9, 8], (g) => {
      g.box(1, 9, 6, 4, armH + 9, 9, (x, y) => y < 12 ? skin : shirt, { shade: 0.04 });
      // hand at y≈9..11, tools extend forward (−z) / down
      if (tool === 'hammer') { g.box(2, 8, 2, 3, 10, 7, 0x8A5A3A); g.box(1, 7, 1, 4, 11, 2, 0x8A8E96); }
      else if (tool === 'hoe') { g.box(2, 9, 0, 3, 10, 7, 0x8A5A3A); g.box(2, 5, 0, 3, 8, 0, 0x9AA0A8); }
      else if (tool === 'rifle') { g.box(2, 9, 0, 3, 11, 8, 0x3A3E46); g.box(2, 12, 2, 3, 12, 5, 0x5A5E66); g.set(2, 10, 0, 0x3AF0FF, 1); g.set(3, 10, 0, 0x3AF0FF, 1); g.box(2, 7, 6, 3, 8, 7, 0x2A2E36); }
      else if (tool === 'book') { g.box(1, 8, 3, 4, 11, 6, 0x3F63A8); g.box(2, 8, 3, 3, 11, 3, 0xF0EAD8); }
      else if (tool === 'bread') { g.box(1, 9, 3, 4, 10, 6, 0xD8A060); g.set(2, 11, 4, 0xE8B870); }
      else if (tool === 'can') { g.box(1, 6, 4, 4, 9, 7, 0x6AA0C0); g.box(2, 8, 1, 3, 8, 4, 0x6AA0C0); }
    });
    const legL = part(4, legH + 1, 4, [2, legH, 2], (g) => g.box(0, 0, 0, 3, legH - 1, 3, (x, y) => y < 2 ? L.shoes : pants, { shade: 0.04 }));
    const legR = part(4, legH + 1, 4, [2, legH, 2], (g) => g.box(0, 0, 0, 3, legH - 1, 3, (x, y) => y < 2 ? L.shoes : pants, { shade: 0.04 }));
    const bodyY = legH, headY = legH + bodyH, armY = legH + bodyH - 1;
    return {
      h: kid ? 1.1 : 1.8, w: 0.3,
      parts: { body, head, arm_l: armL, arm_r: armR, leg_l: legL, leg_r: legR },
      layout: { body: [0, bodyY, 0], head: [0, headY, 0], arm_l: [-6, armY, 0], arm_r: [6, armY, 0], leg_l: [-2, bodyY, 0], leg_r: [2, bodyY, 0] },
      gait: 'biped', kid,
    };
  }
  V.model = function (gl, L) {
    const key = lookKey(L);
    if (!VR.VOXMODELS[key]) VR.VOXMODELS[key] = () => buildModel(L);
    return VR.getVoxModel(gl, key);
  };
  V.buildModel = buildModel;

  // ---------------------------------------------------------------- dialogue library
  // The lines live in the language tables (lang_de.js / lang_en.js) as g.folk.<key> lists; V.say picks one by a
  // hash and fills {name} placeholders. V.lines(key) is the list in the player's language.
  const pick = (arr, h) => arr[(h >>> 0) % arr.length];
  V.pick = pick;
  V.lines = function (key) { const I = VR.I18N; const arr = I && I.list ? I.list('g.folk.' + key) : []; return arr.length ? arr : (I && I.list ? I.list('g.folk.hello') : ['Hello!']); };
  V.say = function (key, h, vars) {
    let s = pick(V.lines(key), h);
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => vars[k] !== undefined ? vars[k] : m);
    return s;
  };
  // a text of the tables (a role's title, a trait, a like): the English word when the key is unknown
  V.T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  V.roleTitle = (role) => V.T('g.role.' + role, null, ROLES[role] ? ROLES[role].title : role);

  // ---------------------------------------------------------------- pathfinding on the block grid
  // Node = feet cell. Walkable when the two cells above the ground are free (doors & gates count as free)
  // and the cell below can be stood on. Moves: 8-way (no corner cutting), step up 1, drop up to 3.
  const T = () => R.T;
  let passC = null, standC = null;
  function caches() {
    if (passC) return;
    const n = R.T.type.length;
    passC = new Uint8Array(n); standC = new Uint8Array(n);
    for (let s = 0; s < n; s++) {
      const fl = R.T.flags[s], t = R.types[R.T.type[s]];
      const kind = t && t.o.kind;
      // pass: 1 free, 2 door/gate (openable), 3 water (slow), 0 blocked
      if (!s) passC[s] = 1;
      else if (fl & F.LAVA) passC[s] = 0;
      else if (fl & F.FLUID) passC[s] = 3;
      else if (kind === 'door' || kind === 'gate') passC[s] = 2;
      else if (!(fl & F.SOLID)) passC[s] = (fl & F.PLANT) && t && /wheat|carrot|potato|beetroot|melon_stem|pumpkin_stem|berry/.test(t.name) ? 4 : 1;
      else { const b = PH.collision(s); passC[s] = b.length === 0 ? 1 : 0; }
      // stand: solid top (not fences / walls / 1.5-tall collisions)
      if (s && (fl & F.SOLID) && !(fl & F.FLUID) && kind !== 'door' && kind !== 'gate' && kind !== 'fence' && kind !== 'wall') {
        const b = PH.collision(s);
        let top = 0; for (const bb of b) top = Math.max(top, bb[4]);
        standC[s] = b.length && top <= 1.01 && top > 0.3 ? 1 : 0;
      } else standC[s] = 0;
    }
  }
  class Heap {
    constructor() { this.k = []; this.v = []; }
    push(key, pri) { const k = this.k, v = this.v; k.push(key); v.push(pri); let i = k.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (v[p] <= v[i]) break; [k[p], k[i]] = [k[i], k[p]]; [v[p], v[i]] = [v[i], v[p]]; i = p; } }
    pop() { const k = this.k, v = this.v; const top = k[0]; const lk = k.pop(), lv = v.pop(); if (k.length) { k[0] = lk; v[0] = lv; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < k.length && v[l] < v[m]) m = l; if (r < k.length && v[r] < v[m]) m = r; if (m === i) break; [k[m], k[i]] = [k[i], k[m]]; [v[m], v[i]] = [v[i], v[m]]; i = m; } } return top; }
    get size() { return this.k.length; }
  }
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  // world: {getBlock}, from/to: [x,y,z] integer feet cells. opts: {max, kid, avoidCrops, near (stop within d)}
  V.findPath = function (w, from, to, opts) {
    caches();
    opts = opts || {};
    const max = opts.max || 2600, tall = opts.kid ? 1 : 2, near = opts.near || 0;
    const ox = from[0] - 1024, oz = from[2] - 1024;
    const key = (x, y, z) => ((x - ox) * 2048 + (z - oz)) * 256 + y;
    const P = (x, y, z) => passC[w.getBlock(x, y, z)];
    const Sd = (x, y, z) => standC[w.getBlock(x, y, z)];
    const free = (x, y, z) => { const a = P(x, y, z); if (!a) return 0; if (tall > 1 && !P(x, y + 1, z)) return 0; return a; };
    const cost = new Map(), came = new Map(), open = new Heap();
    const h = (x, y, z) => Math.abs(x - to[0]) + Math.abs(z - to[2]) + Math.abs(y - to[1]) * 1.2;
    const k0 = key(from[0], from[1], from[2]);
    cost.set(k0, 0); open.push(k0, h(from[0], from[1], from[2]));
    let best = k0, bestH = h(from[0], from[1], from[2]), n = 0, goal = -1;
    const dec = (k) => { const y = k % 256; const q = (k - y) / 256; const zz = q % 2048; const xx = (q - zz) / 2048; return [xx + ox, y, zz + oz]; };
    while (open.size && n < max) {
      const k = open.pop(); n++;
      const [x, y, z] = dec(k);
      const dx0 = x - to[0], dz0 = z - to[2];
      if ((dx0 === 0 && dz0 === 0 && Math.abs(y - to[1]) <= 1) || (near && dx0 * dx0 + dz0 * dz0 <= near * near && Math.abs(y - to[1]) <= 2)) { goal = k; break; }
      const hc = h(x, y, z); if (hc < bestH) { bestH = hc; best = k; }
      const c0 = cost.get(k);
      for (let di = 0; di < 8; di++) {
        const dx = DIRS[di][0], dz = DIRS[di][1];
        const nx = x + dx, nz = z + dz;
        if (di >= 4 && (!free(x + dx, y, z) || !free(x, y, z + dz))) continue;
        let ny = -1, extra = 0;
        const f0 = free(nx, y, nz);
        if (f0 && Sd(nx, y - 1, nz)) { ny = y; extra = f0 === 3 ? 6 : f0 === 4 ? (opts.farmer ? 0.5 : 12) : f0 === 2 ? 0.5 : 0; }
        else if (!f0 && di < 4 && Sd(nx, y, nz) && free(nx, y + 1, nz) && P(x, y + tall, z)) { ny = y + 1; extra = 0.6; }
        else if (f0) { for (let dd = 1; dd <= 3; dd++) { if (!free(nx, y - dd, nz)) break; if (Sd(nx, y - dd - 1, nz)) { ny = y - dd; extra = 0.3 * dd; break; } } }
        if (ny < 0) continue;
        const nk = key(nx, ny, nz);
        const ground = w.getBlock(nx, ny - 1, nz);
        const roadBonus = V.isRoad(ground) ? -0.35 : 0;
        const nc = c0 + (di >= 4 ? 1.414 : 1) + extra + roadBonus;
        const old = cost.get(nk);
        if (old !== undefined && old <= nc) continue;
        cost.set(nk, nc); came.set(nk, k);
        open.push(nk, nc + h(nx, ny, nz) * 1.05);
      }
    }
    const end = goal >= 0 ? goal : (opts.partial ? best : -1);
    if (end < 0) return null;
    const path = [];
    for (let k = end; k !== undefined; k = came.get(k)) { path.push(dec(k)); if (k === k0) break; }
    path.reverse();
    return { path, complete: goal >= 0, expanded: n };
  };
  let roadSet = null;
  V.isRoad = (s) => {
    if (!roadSet) { roadSet = new Uint8Array(R.T.type.length); for (const n of ['dirt_path', 'coarse_dirt', 'vx_floor_stone', 'stone_bricks', 'polished_andesite', 'cobblestone', 'mossy_cobblestone', 'smooth_sandstone', 'cut_sandstone', 'vx_floor_marble', 'vx_floor_checker', 'vx_floor_tile', 'packed_ice', 'landing_pad']) { const t = R.byName[n]; if (t) for (let s2 = t.base; s2 < t.base + t.nstates; s2++) roadSet[s2] = 1; } }
    return roadSet[s] === 1;
  };
  V.passable = (s) => { caches(); return passC[s]; };
  V.standable = (s) => { caches(); return standC[s]; };
})(VR);
