// ============================================================================
// The story's faces and its Eiswächter (a-story2; plan docs/superpowers/plans/2026-10-30-a-story2.md §2). All our own
// designs, procedural, no picture files:
//   VR.Portrait — the speakers of „Funke und die Leuchtfeuer" as small flat-shaded voxel faces on a 24 × 24 grid (light
//     from the upper left: each plane lit · base · shade). Funke (a round white drone with a dark visor and two cyan
//     screen-eyes, an antenna), Meisterin Ilka (a craftswoman: a dark bun, goggles up on her brow, an orange collar),
//     Oskar (the old keeper of the beacons: a white beard, a navy cap, red cheeks), Selma (the map-maker: a copper braid,
//     round glasses, freckles, a green scarf), Kapitän Jonte (a cap with a gold wing badge, grey temples, stubble),
//     Lumi (a girl: two puffy buns, a pink clip, a yellow coat). Four moods: neutral · happy · surprised · worried
//     (brows, eyes, mouth); a blink, the mouth open or shut.
//       ops(who, mood, blink, mouth) → [[x, y, w, h, '#rrggbb'], …] (pure) · paint(canvas, ops) · anim(who, t, len) →
//       {blink, mouth} (blinks 2.4–4.2 s apart, seeded by the speaker; the mouth moves through the first 75 % of a line)
//   VOXMODELS.story_warden — der Eiswächter: an ancient guardian of crystal ice, 43 voxels tall (8 m at the story's ×3):
//     faceted ice-plate robe and legs, shoulder crystals rising, a crested helm, both hands on a long crystal blade
//     planted before it, faint runes on its chest; its one round eye a part of its own ('optic', tinted when it wakes)
//   VOXMODELS.story_icewin — the clear window in Opal's ice over it: 'win' (a disc from a clear deep blue in the middle to
//     the ice's white at the rim), 'veil' (the ice over the figure, faint) and 'cracks' (a few white crack lines)
// Cost: the faces only while a scene plays (a 24 × 24 canvas, repainted when the blink or the mouth changes); the models
// built on the first use, drawn only in the Eiswächter's scene (story.js).
// ============================================================================
(function (VR) {
  'use strict';
  const N = 24;
  const Po = VR.Portrait = VR.Portrait || {};
  Po.N = N;

  // ---------------------------------------------------------------- the speakers (palettes: [lit, base, shade])
  const LOOK = {
    ilka: { skin: ['#d39a72', '#b9805a', '#96633f'], hair: ['#4a3229', '#36241d', '#251812'], iris: '#4a2f1c', lash: '#2a1a12', brow: '#2c1c15', mouth: '#6e2f2a', tongue: '#c85a52', cloth: ['#7a6550', '#5f4d3c', '#46382b'], ring: '#ffc37a' },
    oskar: { skin: ['#f5d8c2', '#e8c2a6', '#c99f84'], hair: ['#ffffff', '#e4e8ec', '#bcc3cb'], iris: '#3d6e9c', lash: '#4a3a34', brow: '#f2f4f6', mouth: '#7a3a36', tongue: '#d06a62', cloth: ['#466a9a', '#34507a', '#243a5a'], cap: ['#3a5288', '#2c3e66', '#1e2b4a'], ring: '#ffe08a' },
    selma: { skin: ['#fbe0c8', '#f1cdb0', '#d4aa8a'], hair: ['#ec8a48', '#cf6a30', '#a24e20'], iris: '#2f7a4a', lash: '#5a2e18', brow: '#a8521f', mouth: '#9a3e3c', tongue: '#e07a74', cloth: ['#5ab878', '#3f9a5a', '#2c7442'], ring: '#b9f2a0' },
    jonte: { skin: ['#dba27a', '#c48a5e', '#a06a44'], hair: ['#3a3634', '#262322', '#161414'], iris: '#2f4a6a', lash: '#1c1a19', brow: '#2a2624', mouth: '#6a3428', tongue: '#c06048', cloth: ['#36507a', '#263a5c', '#1a2840'], cap: ['#ffffff', '#e8ecf0', '#c3cad2'], ring: '#a8c8ff' },
    lumi: { skin: ['#e9b893', '#d9a37c', '#b98260'], hair: ['#3c2a24', '#2a1d19', '#1a110e'], iris: '#5a3420', lash: '#1e1410', brow: '#2e1f1a', mouth: '#a0403e', tongue: '#ec8a86', cloth: ['#ffd84a', '#f2c230', '#cc9a18'], ring: '#ffb0d8' },
    // a-story3: the natives of the worlds (worldeco.js's species: their skin, their head's feature, their garb) and Lumi's grandfather
    solgani: { skin: ['#5a4646', '#463638', '#30262a'], iris: '#ff9a20', lash: '#1a1214', brow: '#ffb840', mouth: '#2a1416', tongue: '#e0603a', cloth: ['#e85a32', '#c8401e', '#962c12'], crest: ['#ffe070', '#ffb02a', '#e0761a'], band: '#f2c440', ring: '#ffb02a' },
    ariveli: { skin: ['#7ad0d6', '#5cb8c0', '#3e96a8'], iris: '#1a3a5a', lash: '#123048', brow: '#2a7a9a', mouth: '#2a5a78', tongue: '#e88a90', cloth: ['#fbf6e6', '#f2eedc', '#d8ceb0'], fin: ['#4a9ac0', '#2a6a9a', '#1f4a78'], shell: '#f0a890', ring: '#6ae0d0' },
    selkatun: { skin: ['#a4a6d8', '#8a8cc0', '#6e70a4'], iris: '#101828', lash: '#0a0e18', brow: '#5a5c90', mouth: '#3a2a50', tongue: '#d080a0', cloth: ['#4e5e82', '#3a4a6a', '#28344c'], ant: '#c8c8e8', tip: '#7af0ff', tip2: '#d8fcff', ring: '#c0b0ff' },
    anselm: { skin: ['#f6dcc6', '#e9c7ab', '#caa486'], hair: ['#fafafa', '#e2e2e2', '#bdbdbd'], iris: '#5a7a3a', lash: '#6a5a4a', brow: '#f4f4f4', mouth: '#8a4a40', tongue: '#d87068', cloth: ['#9a6a42', '#7e5232', '#5e3c22'], glass: '#c07a3a', pencil: '#f2c040', ring: '#e8c890' },
    // a-story4: Dumarin of the Dunelin (sand-gold skin, curled horns, a rust robe), Ylosenis of the Nivari (ice-blue skin,
    // branching antlers, a navy coat with a red scarf), Flimmi (a star being born: a warm glowing face in its rays), Echo
    // (the beacons' old voice: a calm violet-cyan light in three soft rings)
    dumarin: { skin: ['#e6c766', '#d1ae48', '#a9872e'], iris: '#2a1a10', lash: '#2a1a10', brow: '#8a6a30', mouth: '#6a3a1a', tongue: '#d0705a', cloth: ['#b4603a', '#9a4a2a', '#6e321c'], horn: ['#f6ead0', '#e0d0a8', '#b8a47c'], band: '#3a6a6a', ring: '#e0b050' },
    ylosenis: { skin: ['#b4daf6', '#9ac8f0', '#76a8d6'], iris: '#2a3a6a', lash: '#1e2a50', brow: '#5a86b8', mouth: '#4a5a8a', tongue: '#e08aa0', cloth: ['#3a5a8e', '#2a4a7a', '#1c3256'], ant: ['#e8faff', '#c8f0ff', '#8ad0f4'], scarf: '#c84a4a', ring: '#9ad8ff' },
    flimmi: { skin: ['#fffbe6', '#ffe9a0', '#ffc860'], iris: '#7a3a10', lash: '#8a4a12', brow: '#e09a30', mouth: '#c0602a', tongue: '#ff8a7a', ray: ['#fff4c0', '#ffd25a', '#ff9a40'], blush: '#ff9ab0', ring: '#ffd25a' },
    echo: { skin: ['#d8d0ff', '#a898f0', '#7a6ad0'], iris: '#1c1640', lash: '#2a2260', brow: '#5a4ab0', mouth: '#3a2a80', tongue: '#e08ad0', glow: ['#e8fcff', '#8ae8ff', '#3ab0d8'], deep: '#241c58', ring: '#b8a8ff' },
    funke: { shell: ['#ffffff', '#e9eff5', '#bcc7d3'], visor: '#16202e', visor2: '#22324a', eye: '#62f2ff', eye2: '#bffaff', ring: '#8fe4ff' },
  };
  Po.LOOK = LOOK;

  // ---------------------------------------------------------------- a human face (the common parts; mood, blink, mouth)
  function eyes(R, L, mood, blink, ex0, ex1, ey) {
    for (let s = 0; s < 2; s++) {
      const ex = s ? ex1 : ex0, inner = s ? 0 : 2;   // (the eye's side toward the nose)
      if (blink) { R(ex, ey + 2, 3, 1, L.lash); R(s ? ex + 2 : ex, ey + 1, 1, 1, L.lash); continue; }
      if (mood === 'happy') { R(ex, ey + 2, 1, 1, L.lash); R(ex + 1, ey + 1, 1, 1, L.lash); R(ex + 2, ey + 2, 1, 1, L.lash); continue; }
      if (mood === 'surprised') { R(ex, ey - 1, 3, 4, '#ffffff'); R(ex + 1, ey + 1, 1, 1, L.iris); R(ex + 1, ey, 1, 1, L.lash); continue; }
      R(ex, ey, 3, 3, '#ffffff');
      if (mood === 'worried') { R(ex + (s ? 0 : 1), ey + 1, 2, 2, L.iris); R(ex + inner, ey, 1, 1, L.lash); R(ex + (s ? 1 : 1), ey + 1, 1, 1, L.lash); continue; }
      R(ex + 1, ey + 1, 2, 2, L.iris); R(ex + 1, ey + 1, 1, 1, '#ffffff'); R(ex, ey, 3, 1, L.lash);
    }
  }
  function brows(R, L, mood, ex0, ex1, by) {
    if (mood === 'surprised') { R(ex0, by - 2, 3, 1, L.brow); R(ex1, by - 2, 3, 1, L.brow); return; }
    if (mood === 'happy') { R(ex0, by - 1, 3, 1, L.brow); R(ex1, by - 1, 3, 1, L.brow); return; }
    if (mood === 'worried') { R(ex0, by, 2, 1, L.brow); R(ex0 + 2, by - 1, 1, 1, L.brow); R(ex1, by - 1, 1, 1, L.brow); R(ex1 + 1, by, 2, 1, L.brow); return; }
    R(ex0, by, 3, 1, L.brow); R(ex1, by, 3, 1, L.brow);
  }
  function mouthOf(R, L, mood, open, mx, my) {
    if (mood === 'surprised') { if (open) { R(mx + 1, my, 2, 3, L.mouth); R(mx + 1, my + 2, 2, 1, L.tongue); } else R(mx + 1, my, 2, 2, L.mouth); return; }
    if (mood === 'happy') { R(mx - 1, my - 1, 1, 1, L.mouth); R(mx + 4, my - 1, 1, 1, L.mouth); if (open) { R(mx, my, 4, 2, L.mouth); R(mx, my, 4, 1, '#ffffff'); R(mx + 1, my + 1, 2, 1, L.tongue); } else R(mx, my, 4, 1, L.mouth); return; }
    if (mood === 'worried') { R(mx - 1, my + 1, 1, 1, L.mouth); R(mx + 4, my + 1, 1, 1, L.mouth); if (open) { R(mx, my, 4, 2, L.mouth); R(mx + 1, my + 1, 2, 1, L.tongue); } else R(mx, my, 4, 1, L.mouth); return; }
    if (open) { R(mx, my, 4, 2, L.mouth); R(mx + 1, my + 1, 2, 1, L.tongue); } else R(mx + 1, my, 3, 1, L.mouth);
  }
  // the head: a block face, lit on the left, shaded on the right and under the chin
  function head(R, L, x0, y0, w, h) {
    const S = L.skin;
    R(x0, y0, w, h, S[1]); R(x0, y0, 2, h - 1, S[0]); R(x0 + w - 2, y0, 2, h, S[2]); R(x0 + 1, y0 + h - 1, w - 2, 1, S[2]);
    R(x0 - 1, y0 + 5, 1, 3, S[1]); R(x0 + w, y0 + 5, 1, 3, S[2]);   // (the ears)
  }
  function body(R, C, x0, w, y0) { R(x0, y0, w, N - y0, C[1]); R(x0, y0, 3, N - y0, C[0]); R(x0 + w - 3, y0, 3, N - y0, C[2]); }
  function neck(R, L, y0) { R(10, y0, 4, 3, L.skin[2]); }

  const FACE = {
    ilka(R, L, m, bl, mo) {
      R(8, 0, 8, 4, L.hair[1]); R(9, 0, 4, 1, L.hair[0]); R(13, 1, 3, 3, L.hair[2]);   // (the bun)
      body(R, L.cloth, 3, 18, 19); R(7, 18, 10, 2, '#e2702c'); R(7, 18, 3, 2, '#f08a48'); R(14, 18, 3, 2, '#b4521c');   // (the orange work collar)
      neck(R, L, 16);
      R(5, 4, 14, 9, L.hair[1]); R(5, 4, 3, 9, L.hair[0]); R(16, 4, 3, 9, L.hair[2]);
      head(R, L, 6, 6, 12, 12);
      R(6, 6, 12, 1, L.hair[1]); R(6, 7, 2, 3, L.hair[0]); R(16, 7, 2, 3, L.hair[2]);
      R(5, 5, 14, 1, '#4a3c30');   // (the goggles' strap and lenses up on the brow)
      R(7, 4, 4, 3, '#4a3c30'); R(13, 4, 4, 3, '#4a3c30'); R(8, 5, 2, 1, '#86d6ee'); R(14, 5, 2, 1, '#86d6ee'); R(8, 5, 1, 1, '#e8fbff'); R(14, 5, 1, 1, '#e8fbff');
      brows(R, L, m, 7, 14, 9); eyes(R, L, m, bl, 7, 14, 10);
      R(11, 13, 2, 1, L.skin[2]);
      if (m === 'happy') { R(7, 14, 2, 1, '#d97a6a'); R(15, 14, 2, 1, '#d97a6a'); }
      mouthOf(R, L, m, mo, 10, 15);
    },
    oskar(R, L, m, bl, mo) {
      body(R, L.cloth, 2, 20, 19); for (let x = 3; x < 21; x += 2) R(x, 20, 1, 4, L.cloth[2]);   // (a knitted sweater)
      neck(R, L, 16);
      head(R, L, 6, 5, 12, 12);
      R(7, 12, 2, 1, '#e88a7a'); R(15, 12, 2, 1, '#e88a7a');   // (red cheeks — the sea wind)
      R(5, 15, 14, 4, L.hair[1]); R(6, 19, 12, 1, L.hair[1]); R(8, 20, 8, 1, L.hair[2]); R(5, 15, 3, 4, L.hair[0]); R(16, 15, 3, 4, L.hair[2]);   // (the white beard)
      R(8, 13, 8, 2, L.hair[1]); R(8, 13, 3, 1, L.hair[0]);   // (the moustache)
      R(5, 8, 1, 4, L.hair[1]); R(18, 8, 1, 4, L.hair[2]);
      R(5, 2, 14, 4, L.cap[1]); R(5, 2, 3, 4, L.cap[0]); R(16, 2, 3, 4, L.cap[2]); R(4, 6, 16, 1, L.cap[2]); R(11, 3, 2, 2, '#e9c44a');   // (the navy cap, its brim, a little gold button)
      brows(R, L, m, 7, 14, 8); eyes(R, L, m, bl, 7, 14, 9);
      R(11, 11, 2, 2, '#d88f78');   // (a round nose)
      mouthOf(R, L, m, mo, 10, 15);
    },
    selma(R, L, m, bl, mo) {
      R(5, 3, 14, 13, L.hair[1]); R(5, 3, 3, 13, L.hair[0]); R(16, 3, 3, 13, L.hair[2]);
      R(17, 13, 3, 3, L.hair[1]); R(18, 16, 3, 3, L.hair[2]); R(18, 19, 2, 1, '#3f9a5a'); R(18, 20, 2, 2, L.hair[1]);   // (the braid over her shoulder)
      body(R, ['#8a6a9a', '#6e5280', '#523c60'], 3, 18, 19); R(5, 18, 14, 3, L.cloth[1]); R(5, 18, 4, 3, L.cloth[0]); R(15, 18, 4, 3, L.cloth[2]);   // (a violet coat, the green scarf)
      neck(R, L, 16);
      head(R, L, 6, 5, 12, 12);
      R(6, 5, 12, 2, L.hair[1]); R(6, 5, 4, 3, L.hair[0]); R(14, 7, 4, 1, L.hair[2]);   // (the fringe, swept)
      brows(R, L, m, 7, 14, 8); eyes(R, L, m, bl, 7, 14, 9);
      const gl = '#5a4232'; for (const x of [6, 13]) { R(x, 8, 5, 1, gl); R(x, 12, 5, 1, gl); R(x, 9, 1, 3, gl); R(x + 4, 9, 1, 3, gl); } R(11, 10, 2, 1, gl);   // (round glasses)
      for (const p of [[7, 13], [9, 14], [15, 13], [16, 14]]) R(p[0], p[1], 1, 1, '#c27a52');   // (freckles)
      R(11, 12, 2, 1, L.skin[2]);
      mouthOf(R, L, m, mo, 10, 14);
    },
    jonte(R, L, m, bl, mo) {
      body(R, L.cloth, 2, 20, 19); R(8, 19, 8, 2, '#f2f4f6'); R(11, 19, 2, 5, '#1d2330'); R(6, 21, 1, 1, '#e9c44a'); R(17, 21, 1, 1, '#e9c44a');   // (the coat, a white collar, a dark tie, gold buttons)
      neck(R, L, 16);
      head(R, L, 6, 5, 12, 12);
      R(6, 7, 1, 4, L.hair[1]); R(17, 7, 1, 4, L.hair[1]); R(6, 8, 1, 2, '#a3a9b0'); R(17, 8, 1, 2, '#a3a9b0');   // (grey temples)
      for (const p of [[7, 14], [9, 16], [14, 16], [16, 14], [8, 15], [15, 15], [12, 16]]) R(p[0], p[1], 1, 1, L.skin[2]);   // (stubble)
      R(5, 1, 14, 5, L.cap[1]); R(5, 1, 3, 5, L.cap[0]); R(16, 1, 3, 5, L.cap[2]); R(5, 5, 14, 1, '#1d2330'); R(4, 6, 16, 1, '#141922');   // (the captain's cap, its band and peak)
      R(9, 3, 6, 1, '#e9c44a'); R(11, 2, 2, 3, '#f6d860');   // (a gold wing with a star)
      brows(R, L, m, 7, 14, 8); eyes(R, L, m, bl, 7, 14, 9);
      R(11, 12, 2, 1, L.skin[2]);
      mouthOf(R, L, m, mo, 10, 14);
    },
    lumi(R, L, m, bl, mo) {
      R(3, 3, 6, 6, L.hair[1]); R(3, 3, 2, 6, L.hair[0]); R(15, 3, 6, 6, L.hair[1]); R(19, 3, 2, 6, L.hair[2]);   // (two puffy buns)
      body(R, L.cloth, 4, 16, 19); R(4, 18, 16, 2, L.cloth[0]); R(11, 20, 2, 4, '#e8a818'); R(9, 21, 1, 1, '#ffffff');   // (the yellow coat, its hood's rim)
      neck(R, L, 16);
      R(6, 5, 12, 6, L.hair[1]);
      head(R, L, 7, 6, 10, 11);
      R(7, 6, 10, 2, L.hair[1]); R(7, 6, 3, 3, L.hair[0]); R(13, 8, 4, 1, L.hair[2]);
      R(15, 5, 3, 2, '#ff7fbf'); R(15, 5, 1, 1, '#ffd0e8');   // (the pink clip)
      brows(R, L, m, 8, 13, 9); eyes(R, L, m, bl, 8, 13, 10);
      R(8, 14, 1, 1, '#f09a8a'); R(15, 14, 1, 1, '#f09a8a');
      R(11, 13, 2, 1, L.skin[2]);
      mouthOf(R, L, m, mo, 10, 14);
    },
    // a-story3 · Solgani of the Glutani: charcoal skin, a glowing crest of flame-coloured spines, ember eyes, a red robe with a gold band
    solgani(R, L, m, bl, mo) {
      body(R, L.cloth, 3, 18, 19); R(3, 21, 18, 1, L.band); R(10, 19, 4, 2, L.band);
      neck(R, L, 16);
      for (let i = 0; i < 5; i++) { const x = 6 + i * 3, hh = 5 - Math.abs(i - 2); R(x, 5 - hh, 2, hh + 1, L.crest[i % 2]); R(x, 5 - hh, 1, 1, L.crest[0]); }   // (the crest: five spines)
      R(5, 4, 14, 2, L.crest[2]);
      head(R, L, 6, 5, 12, 12);
      brows(R, L, m, 7, 14, 8); eyes(R, L, m, bl, 7, 14, 9);
      R(7, 13, 1, 1, L.crest[1]); R(16, 13, 1, 1, L.crest[1]);   // (the glowing cheek marks)
      R(11, 12, 2, 1, L.skin[2]);
      mouthOf(R, L, m, mo, 10, 14);
    },
    // Ariveli of the Wellari: sea-green skin, a fin on each side and a small fin crest, a shell clip, a cream gown
    ariveli(R, L, m, bl, mo) {
      body(R, L.cloth, 4, 16, 19); R(9, 18, 6, 2, L.cloth[2]); R(11, 20, 2, 2, L.shell);
      neck(R, L, 16);
      R(3, 6, 3, 8, L.fin[1]); R(2, 7, 1, 6, L.fin[2]); R(3, 6, 1, 3, L.fin[0]); R(18, 6, 3, 8, L.fin[1]); R(21, 7, 1, 6, L.fin[2]); R(20, 6, 1, 3, L.fin[0]);   // (the side fins)
      R(9, 2, 6, 3, L.fin[1]); R(10, 1, 4, 1, L.fin[0]); R(11, 0, 2, 1, L.fin[2]);   // (the crest fin)
      head(R, L, 6, 4, 12, 13);
      R(14, 5, 3, 2, L.shell); R(14, 5, 1, 1, '#ffd8c8');   // (the shell clip)
      brows(R, L, m, 7, 14, 8); eyes(R, L, m, bl, 7, 14, 9);
      R(11, 12, 2, 1, L.skin[2]); for (const p of [[7, 13], [16, 13]]) R(p[0], p[1], 1, 1, L.fin[0]);
      mouthOf(R, L, m, mo, 10, 14);
    },
    // Selkatun of the Regoli: lilac skin, two antennae with glowing tips, large dark eyes, a navy travelling coat
    selkatun(R, L, m, bl, mo) {
      body(R, L.cloth, 3, 18, 19); R(7, 18, 10, 1, L.cloth[0]); R(11, 19, 2, 5, L.tip);
      neck(R, L, 16);
      R(7, 1, 1, 5, L.ant); R(6, 0, 3, 2, L.tip); R(6, 0, 1, 1, L.tip2); R(16, 1, 1, 5, L.ant); R(15, 0, 3, 2, L.tip); R(15, 0, 1, 1, L.tip2);   // (the antennae)
      head(R, L, 6, 5, 12, 12);
      R(6, 5, 12, 1, L.skin[0]);
      brows(R, L, m, 7, 14, 8); eyes(R, L, m, bl, 7, 14, 9);
      if (!bl && m !== 'happy') { R(7, 10, 3, 2, L.iris); R(14, 10, 3, 2, L.iris); R(8, 10, 1, 1, L.tip2); R(15, 10, 1, 1, L.tip2); }   // (the big dark eyes, a glint)
      R(11, 12, 2, 1, L.skin[2]);
      mouthOf(R, L, m, mo, 10, 14);
    },
    // Opa Anselm: bald on top, white tufts, bushy white brows, round copper spectacles, a pencil behind his ear, a brown cardigan
    anselm(R, L, m, bl, mo) {
      body(R, L.cloth, 2, 20, 19); R(9, 19, 6, 5, '#e8e0d0'); R(11, 20, 2, 4, '#3a6a8a'); R(5, 21, 1, 1, '#e8c890'); R(18, 21, 1, 1, '#e8c890');   // (cardigan, shirt, a blue tie, buttons)
      neck(R, L, 16);
      head(R, L, 6, 4, 12, 13);
      R(8, 4, 8, 1, L.skin[0]); R(9, 5, 3, 1, '#fff0e0');   // (the bald crown, its shine)
      R(4, 7, 3, 5, L.hair[1]); R(4, 7, 1, 5, L.hair[0]); R(17, 7, 3, 5, L.hair[1]); R(19, 7, 1, 5, L.hair[2]);   // (the white tufts)
      R(18, 4, 4, 1, L.pencil); R(21, 4, 1, 1, '#3a3a3a');   // (the pencil)
      brows(R, L, m, 7, 14, 8); R(6, m === 'surprised' ? 6 : 7, 1, 1, L.brow); R(17, m === 'surprised' ? 6 : 7, 1, 1, L.brow);
      eyes(R, L, m, bl, 7, 14, 9);
      for (const x of [6, 13]) { R(x, 8, 5, 1, L.glass); R(x, 12, 5, 1, L.glass); R(x, 9, 1, 3, L.glass); R(x + 4, 9, 1, 3, L.glass); } R(11, 10, 2, 1, L.glass);
      R(11, 12, 2, 2, L.skin[2]);
      R(8, 15, 1, 1, '#e0a090'); R(15, 15, 1, 1, '#e0a090');
      mouthOf(R, L, m, mo, 10, 15);
    },
    // a-story4 · Dumarin: a broad sand-gold face, two horns curling out of the brow, a rust robe with a teal band
    dumarin(R, L, m, bl, mo) {
      body(R, L.cloth, 2, 20, 19); R(2, 20, 20, 1, L.band); R(10, 19, 4, 5, L.cloth[0]);
      neck(R, L, 16);
      head(R, L, 5, 5, 14, 12);
      R(2, 3, 3, 2, L.horn[1]); R(2, 1, 2, 2, L.horn[0]); R(4, 5, 2, 2, L.horn[2]); R(19, 3, 3, 2, L.horn[1]); R(20, 1, 2, 2, L.horn[0]); R(18, 5, 2, 2, L.horn[2]);   // (the horns)
      R(5, 5, 14, 1, L.skin[0]); R(8, 4, 8, 1, L.skin[1]);
      brows(R, L, m, 7, 14, 8); eyes(R, L, m, bl, 7, 14, 9);
      R(11, 11, 2, 2, L.skin[2]); R(7, 13, 2, 1, '#e8a060'); R(15, 13, 2, 1, '#e8a060');
      mouthOf(R, L, m, mo, 10, 14);
    },
    // Ylosenis: ice-blue, branching antlers, frost-white brows, a navy coat and a red scarf
    ylosenis(R, L, m, bl, mo) {
      body(R, L.cloth, 3, 18, 19); R(6, 18, 12, 2, L.scarf); R(14, 20, 3, 4, L.scarf);
      neck(R, L, 16);
      R(5, 0, 1, 5, L.ant[1]); R(3, 1, 2, 1, L.ant[2]); R(4, 3, 1, 1, L.ant[0]); R(18, 0, 1, 5, L.ant[1]); R(19, 1, 2, 1, L.ant[2]); R(19, 3, 1, 1, L.ant[0]);   // (the antlers)
      R(6, 2, 1, 3, L.ant[2]); R(17, 2, 1, 3, L.ant[2]);
      head(R, L, 6, 5, 12, 12);
      R(6, 5, 12, 1, L.skin[0]); R(7, 6, 1, 1, '#ffffff'); R(16, 6, 1, 1, '#ffffff');   // (frost)
      brows(R, L, m, 7, 14, 8); eyes(R, L, m, bl, 7, 14, 9);
      R(11, 12, 2, 1, L.skin[2]);
      mouthOf(R, L, m, mo, 10, 14);
    },
    // Flimmi: a newborn star — a round warm face in four rays and four short ones, rosy cheeks, big shining eyes
    flimmi(R, L, m, bl, mo) {
      R(11, 0, 2, 4, L.ray[1]); R(11, 20, 2, 4, L.ray[1]); R(0, 11, 4, 2, L.ray[1]); R(20, 11, 4, 2, L.ray[1]);   // (the rays)
      R(11, 0, 1, 2, L.ray[0]); R(0, 11, 2, 1, L.ray[0]);
      R(3, 3, 2, 2, L.ray[2]); R(19, 3, 2, 2, L.ray[2]); R(3, 19, 2, 2, L.ray[2]); R(19, 19, 2, 2, L.ray[2]);
      R(7, 4, 10, 16, L.skin[1]); R(5, 6, 14, 12, L.skin[1]); R(6, 5, 12, 14, L.skin[1]);   // (the round glow)
      R(6, 6, 3, 6, L.skin[0]); R(7, 5, 4, 2, L.skin[0]); R(16, 9, 2, 8, L.skin[2]); R(8, 18, 9, 1, L.skin[2]);
      brows(R, L, m, 7, 14, 8); eyes(R, L, m, bl, 7, 14, 9);
      if (!bl && m !== 'happy') { R(8, 10, 1, 1, '#ffffff'); R(15, 10, 1, 1, '#ffffff'); }
      R(6, 13, 2, 1, L.blush); R(16, 13, 2, 1, L.blush);
      mouthOf(R, L, m, mo, 10, 14);
    },
    // Echo: the beacons' old voice — a calm violet light in three soft rings, gentle half-closed eyes, a cyan core
    echo(R, L, m, bl, mo) {
      R(0, 0, 24, 24, L.deep);
      R(2, 4, 20, 16, L.glow[2]); R(4, 2, 16, 20, L.glow[2]); R(3, 3, 18, 18, L.glow[2]);   // (the outer ring)
      R(4, 5, 16, 14, L.skin[2]); R(5, 4, 14, 16, L.skin[2]);
      R(5, 6, 14, 12, L.skin[1]); R(6, 5, 12, 14, L.skin[1]); R(6, 6, 4, 4, L.skin[0]);
      R(11, 19, 2, 2, L.glow[1]); R(11, 20, 2, 1, L.glow[0]); R(11, 3, 2, 1, L.glow[1]);   // (its cyan core's light, the old network's colour)
      brows(R, L, m, 7, 14, 8); eyes(R, L, m, bl, 7, 14, 9);
      R(11, 12, 2, 1, L.skin[2]);
      mouthOf(R, L, m, mo, 10, 15);
    },
    funke(R, L, m, bl, mo) {
      const Sh = L.shell, E = L.eye;
      R(11, 0, 2, 2, '#ffd25a'); R(11, 0, 1, 1, '#fff2b0'); R(11, 2, 2, 3, '#9aa6b4');   // (the antenna, its warm tip)
      R(2, 10, 2, 6, '#5fd8f0'); R(20, 10, 2, 6, '#3aa8c8');   // (the side fins)
      R(6, 4, 12, 2, Sh[1]); R(4, 6, 16, 12, Sh[1]); R(6, 18, 12, 2, Sh[2]); R(5, 5, 14, 1, Sh[1]);
      R(4, 6, 3, 11, Sh[0]); R(6, 4, 4, 2, Sh[0]); R(17, 6, 3, 12, Sh[2]); R(7, 17, 12, 1, Sh[2]);
      R(8, 20, 8, 2, '#5fe8ff'); R(9, 22, 6, 1, '#2aa8d0');   // (the glow under it)
      R(6, 8, 12, 9, L.visor); R(6, 8, 12, 1, L.visor2); R(6, 8, 1, 9, L.visor2);
      // the screen-eyes (the visor shows his mood)
      for (let s = 0; s < 2; s++) {
        const ex = s ? 13 : 8, ey = 10;
        if (bl) { R(ex, ey + 2, 3, 1, E); continue; }
        if (m === 'happy') { R(ex, ey + 2, 1, 1, E); R(ex + 1, ey + 1, 1, 1, E); R(ex + 2, ey + 2, 1, 1, E); continue; }
        if (m === 'surprised') { R(ex, ey - 1, 3, 4, E); R(ex + 1, ey, 1, 2, L.visor); continue; }
        if (m === 'worried') { R(ex, ey + 1, 3, 2, E); R(s ? ex : ex + 2, ey, 1, 1, E); continue; }
        R(ex, ey, 3, 3, E); R(ex, ey, 1, 1, L.eye2);
      }
      if (m === 'happy') { R(7, 13, 1, 1, '#ff8fb8'); R(16, 13, 1, 1, '#ff8fb8'); }
      const my = 15;
      if (m === 'surprised') { if (mo) R(11, my - 1, 2, 2, E); else R(11, my, 2, 1, E); }
      else if (m === 'happy') { R(10, my, 4, 1, E); R(9, my - 1, 1, 1, E); R(14, my - 1, 1, 1, E); if (mo) R(10, my - 1, 4, 1, L.eye2); }
      else if (m === 'worried') { R(10, my - 1, 4, 1, E); R(9, my, 1, 1, E); R(14, my, 1, 1, E); if (mo) R(11, my, 2, 1, E); }
      else { R(10, my, 4, 1, E); if (mo) R(11, my - 1, 2, 1, E); }
    },
  };
  Po.WHO = Object.keys(FACE);

  // ops: the face as rects, painted in order (pure)
  Po.ops = function (who, mood, blink, mouth) {
    const f = FACE[who] || FACE.funke, L = LOOK[who] || LOOK.funke, out = [];
    const R = (x, y, w, h, c) => {   // (clipped to the grid)
      if (x < 0) { w += x; x = 0; } if (y < 0) { h += y; y = 0; } if (x + w > N) w = N - x; if (y + h > N) h = N - y;
      if (w > 0 && h > 0) out.push([x, y, w, h, c]);
    };
    f(R, L, mood || 'neutral', !!blink, !!mouth);
    return out;
  };
  Po.paint = function (cv, ops) {
    if (!cv || !cv.getContext) return false;
    if (cv.width !== N) cv.width = N; if (cv.height !== N) cv.height = N;
    const c = cv.getContext('2d'); if (!c) return false;
    c.clearRect(0, 0, N, N);
    for (const r of ops) { c.fillStyle = r[4]; c.fillRect(r[0], r[1], r[2], r[3]); }
    return true;
  };
  // the animation of a line: blinks 2.4–4.2 s apart (seeded by the speaker), the mouth through the line's first 75 %
  const hs = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const fr = (x) => x - Math.floor(x);
  Po.anim = function (who, t, len) {
    const seed = (hs(String(who)) % 1000) / 1000;
    let s = 0.7 + seed * 1.2, k = 0, blink = false;
    while (s <= t && k < 200) { if (t < s + 0.13) { blink = true; break; } s += 2.4 + 1.8 * fr(Math.sin((k + 1) * 12.9898 + seed * 78.233) * 43758.5453); k++; }
    const speak = t >= 0 && t < 0.75 * (len || 3);
    const mouth = speak && (Math.sin(t * 21 + seed * 6) + 0.6 * Math.sin(t * 13.3 + seed * 3)) > 0.15;
    return { blink, mouth };
  };

  // ---------------------------------------------------------------- der Eiswächter (VOXMODELS.story_warden)
  const MV = VR.VOXMODELS, Grid = VR.VoxGrid;
  if (MV && Grid) {
    const ICE = [0xe2f5ff, 0xb4ddf7, 0x86bde6, 0x5a91c6, 0x3a6aa0, 0x27507e], STONE = 0x5a6e86, RUNE = 0x9ff0ff, LENS = 0xf2fbff;
    const hash = (x, y, z) => ((((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) >>> 0) % 1000) / 1000;
    // a facet's colour: lit on the left (−x) and on top, shaded right and low; facets of 3 × 4 × 3 voxels jitter a step
    const facet = (x, y, z, base) => { const f = Math.floor(hash(Math.floor(x / 3), Math.floor(y / 4), Math.floor(z / 3)) * 3) - 1; return ICE[Math.max(0, Math.min(5, base + f))]; };
    const side = (x) => (x < -3 ? 1 : x > 3 ? 3 : 2);
    MV.story_warden = function () {
      const W = new Grid(26, 43, 14, 13, 0, 7);   // (x −13…12, y 0…42, z −7…6: the front is −z)
      const S = (x, y, z, c, e) => W.set(x + 13, y, z + 7, c, e);
      const box = (x0, y0, z0, x1, y1, z1, col) => { for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const c = typeof col === 'function' ? col(x, y, z) : col; if (c !== null && c !== undefined) S(x, y, z, c); } };
      // the boots and the robe of ice plates (wider at the hem; a darker split between the legs in front)
      box(-6, 0, -3, -2, 2, 3, (x, y, z) => facet(x, y, z, side(x) + 1)); box(1, 0, -3, 5, 2, 3, (x, y, z) => facet(x, y, z, side(x) + 1));
      for (let y = 3; y <= 20; y++) { const hw = Math.round(8 - (y - 3) * 0.12), d0 = -3, d1 = 3; box(-hw, y, d0, hw - 1, y, d1, (x, yy, z) => (z === d0 && (x === -1 || x === 0) && y < 14 ? ICE[5] : (z === d0 && (x + 20) % 4 === 0 ? facet(x, y, z, side(x) + 1) : facet(x, y, z, side(x))))); }
      // the chest: broad, a plate over it, the runes faint in the ice (a diamond and a ring of points)
      for (let y = 21; y <= 30; y++) { const hw = y < 25 ? 6 : 7; box(-hw, y, -3, hw - 1, y, 3, (x, yy, z) => facet(x, y, z, side(x) - (y > 27 ? 1 : 0))); }
      box(-5, 22, -4, 4, 29, -4, (x, y, z) => facet(x, y, z, side(x) - 1));
      for (let k = 0; k <= 3; k++) { S(-1 - k, 23 + k, -5, RUNE, 1); S(k, 23 + k, -5, RUNE, 1); }   // (the diamond's lower half …)
      for (let k = 0; k <= 2; k++) { S(-3 + k, 27 + k, -5, RUNE, 1); S(2 - k, 27 + k, -5, RUNE, 1); }   // (… and its upper half)
      // the inner stone shows at the waist (the old guardian under its ice)
      box(-5, 20, -4, 4, 20, -4, STONE);
      // the shoulders and their crystals, rising
      for (const sx of [-1, 1]) {
        const x0 = sx < 0 ? -11 : 7, x1 = sx < 0 ? -8 : 10;
        box(x0, 27, -3, x1, 31, 3, (x, y, z) => facet(x, y, z, sx < 0 ? 0 : 2));
        const cx = sx < 0 ? -10 : 8;
        box(cx, 32, -1, cx + 1, 35, 1, (x, y, z) => facet(x, y, z, sx < 0 ? 0 : 1)); box(cx + (sx < 0 ? 0 : 1), 36, 0, cx + (sx < 0 ? 0 : 1), 38, 0, ICE[0]);
        const c2 = sx < 0 ? -8 : 7; box(c2, 32, 1, c2, 33, 2, ICE[1]);
        // the arms down to the hands on the blade's hilt
        box(sx < 0 ? -10 : 7, 19, -2, sx < 0 ? -8 : 9, 26, 1, (x, y, z) => facet(x, y, z, sx < 0 ? 1 : 3));
        box(sx < 0 ? -8 : 2, 17, -5, sx < 0 ? -3 : 7, 19, -2, (x, y, z) => facet(x, y, z, sx < 0 ? 1 : 3));
      }
      box(-3, 16, -7, 2, 20, -5, (x, y, z) => facet(x, y, z, side(x)));   // (the gauntlets, closed on the hilt)
      // the blade: planted before it, bright crystal with a glowing edge; the guard, the pommel above the hands
      box(-1, 1, -7, 0, 14, -6, (x, y, z) => (x === -1 ? ICE[0] : ICE[1])); S(-1, 0, -7, ICE[1]); S(0, 0, -7, ICE[2]);
      for (let y = 2; y <= 14; y += 3) S(-1, y, -8 + 1, RUNE, 1);
      box(-4, 15, -7, 3, 15, -6, ICE[3]); box(-1, 21, -7, 0, 22, -6, ICE[2]);
      // the head: a tall helm of ice, a dark face, the crest along the top
      for (let y = 32; y <= 39; y++) { const hw = y <= 35 ? 4 : y <= 37 ? 3 : 2; box(-hw, y, -3, hw - 1, y, 3, (x, yy, z) => facet(x, y, z, side(x) - (y > 37 ? 1 : 0))); }   // (the helm, tapering to its crown)
      box(-6, 30, -4, 5, 31, 4, (x, y, z) => (Math.abs(x + 0.5) + Math.abs(z) > 8.5 ? null : facet(x, y, z, side(x) - 1)));   // (a collar of ice round the neck)
      // shards: crystals grown out of it, slanting up and out (the shoulders, the hips, the back)
      const shard = (x0, y0, z0, dx, dz, len, base) => { for (let i = 0; i < len; i++) { const x = Math.round(x0 + dx * i), y = y0 + i, z = Math.round(z0 + dz * i), c = ICE[Math.max(0, base - (i > len - 3 ? 1 : 0))]; S(x, y, z, c); if (i < len - 2) { S(x + (dx < 0 ? 1 : -1), y, z, c); S(x, y, z + 1, c); } } };
      shard(-11, 30, 2, -0.35, 0.2, 6, 1); shard(10, 30, 2, 0.35, 0.2, 6, 2); shard(-8, 12, 2, -0.45, 0.3, 5, 2); shard(7, 10, 2, 0.45, 0.3, 5, 3);
      shard(-3, 24, 4, -0.2, 0.5, 6, 1); shard(2, 22, 4, 0.25, 0.5, 6, 2);
      // the back: a mantle of ice plates, wider toward the hem
      for (let y = 4; y <= 29; y++) { const hw = Math.round(6 + (29 - y) * 0.1); box(-hw, y, 4, hw - 1, y, 5, (x, yy, z) => ((x + y) % 5 === 0 ? ICE[4] : facet(x, y, z, side(x) + 1))); }
      box(-3, 33, -4, 2, 37, -4, (x, y, z) => (y === 37 || x === -3 || x === 2 ? facet(x, y, z, 3) : 0x10284a));   // (the face: dark, the eye in it)
      box(-1, 40, -2, 0, 41, 4, (x, y, z) => facet(x, y, z, 1)); box(-1, 42, -1, 0, 42, 2, ICE[0]); box(-1, 39, 4, 0, 39, 5, ICE[2]);
      box(-5, 34, -2, -5, 37, 1, ICE[1]); box(4, 34, -2, 4, 37, 1, ICE[3]);   // (the helm's cheek plates)
      const optic = new Grid(4, 4, 1, 2, 2, 0); optic.ell(2, 2, 0.5, 2, 2, 0.8, LENS, { emis: 1 });
      return { h: 43 / 16, w: 1.2, gait: 'none', parts: { whole: { grid: W, pivot: [0, 0, 0] }, optic: { grid: optic, pivot: [0, 0, 0] } }, layout: { whole: [0, 0, 0], optic: [0, 35, -4.6] }, order: ['whole'] };
    };
    // a-story4 · a beam of light (one emissive column, 1 × 16 voxels: story.js stretches it into the beacons' beams and arcs)
    MV.story_beam = function () { const g = new Grid(1, 16, 1, 0, 0, 0); for (let y = 0; y < 16; y++) g.set(0, y, 0, 0xffffff, 1); return { parts: { whole: { grid: g, pivot: [0, 0, 0] } }, layout: { whole: [0, 0, 0] } }; };
    // the ice window over it (1 voxel thick discs, R 24; story.js scales them flat)
    MV.story_icewin = function () {
      const R = 24, D = 2 * R + 1;
      const disc = (col) => { const g = new Grid(D, 1, D, R, 0, R); for (let z = 0; z < D; z++) for (let x = 0; x < D; x++) { const d = Math.hypot(x - R, z - R) / R; if (d > 1) continue; const c = col(d, x - R, z - R); if (c !== null) g.set(x, 0, z, c); } return g; };
      const win = disc((d) => (d < 0.42 ? 0x1f5682 : d < 0.6 ? 0x2f6c9a : d < 0.74 ? 0x5d97c4 : d < 0.87 ? 0x9cc8e6 : 0xd7ecf8));
      const veil = disc((d) => (d < 0.87 ? 0xcfe8f7 : null));
      // the cracks: thin (their own finer disc, R 60 — story.js draws it at 1/8 m a voxel), a few walks round the figure
      // (from 0.35 R outward, never across its middle), seeded (the same every time)
      const RC = 60, DC = 2 * RC + 1, cg = new Grid(DC, 1, DC, RC, 0, RC); let s = 77;
      const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 8) / 16777216; };
      for (let k = 0; k < 7; k++) {
        let a = k * 0.9 + rnd() * 0.6, rr = RC * (0.36 + 0.2 * rnd()), x = Math.cos(a) * rr, z = Math.sin(a) * rr, h = a + (rnd() - 0.5) * 1.2;
        for (let i = 0; i < 70; i++) { h += (rnd() - 0.5) * 0.7; x += Math.cos(h); z += Math.sin(h); const d = Math.hypot(x, z); if (d > RC - 2 || d < RC * 0.3) break; cg.set(Math.round(x) + RC, 0, Math.round(z) + RC, 0xf4fbff); if (rnd() < 0.08) { const b = h + (rnd() < 0.5 ? 1 : -1) * 0.8; for (let q = 1; q < 6; q++) cg.set(Math.round(x + Math.cos(b) * q) + RC, 0, Math.round(z + Math.sin(b) * q) + RC, 0xe6f4ff); } }
      }
      const cracks = cg;
      return { parts: { win: { grid: win, pivot: [0, 0, 0] }, veil: { grid: veil, pivot: [0, 0, 0] }, cracks: { grid: cracks, pivot: [0, 0, 0] } }, layout: { win: [0, 0, 0], veil: [0, 0, 0], cracks: [0, 0, 0] } };
    };
  }

  // ---------------------------------------------------------------- a-story3 · the film's own pictures (VR.StoryFx)
  // Drawn over the frame on a small transparent 2-D canvas while a scene plays (story.js P.fxTick): our own shapes —
  //   embers (Zinnober's sparks rising) · song (the glass beacon's song: rings of cyan light) · hum (Funke humming it)
  //   spray (the atoll's spray) · notes (Opa Anselm's notebook page: Funke sketched beside a beacon) · beacons (from the
  //   Ringstation's window: the beacons light one by one into an arrow toward a star) · blink2 (a far beacon blinking
  //   twice) · twin (two suns) · beam (the beam swinging to a nebula). draw(c, kind, t, u, w, h, {low, seed}).
  const Fx = VR.StoryFx = VR.StoryFx || {};
  Fx.KINDS = ['embers', 'song', 'hum', 'spray', 'notes', 'beacons', 'blink2', 'twin', 'beam', 'nebin', 'flimmi', 'redsun', 'echo', 'wake', 'gather', 'finale', 'blink3'];   // (a-story4: the last eight)
  Fx.FOLK = ['255,176,42', '106,224,208', '192,176,255', '224,176,80', '154,216,255'];   // the five peoples' colours: Glutani, Wellari, Regoli, Dunelin, Nivari
  const rnd = (i, k) => fr(Math.sin(i * 127.1 + k * 311.7) * 43758.5453);
  const glow = (c, x, y, r, col, a) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + col + ',' + a + ')'); g.addColorStop(1, 'rgba(' + col + ',0)'); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); };
  const ease = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
  // the arrow the beacons draw (normalised, on the planet below the window), lit one after another
  Fx.ARROW = (() => { const out = []; for (let i = 0; i < 9; i++) out.push([0.26 + i * 0.045, 0.66 - i * 0.03]); for (let i = 1; i < 4; i++) { out.push([0.62 - i * 0.04, 0.42 + i * 0.006]); out.push([0.62 - i * 0.008, 0.42 + i * 0.045]); } for (const q of out) q[1] = 0.2 + (q[1] - 0.39) * 0.8; return out; })();   // (a-story4: on the planet's face — from inside the glass the planet stands over the deck's horizon)   // (on the planet's face in the window: the frame's middle band)
  Fx.draw = function (c, kind, t, u, w, h, o) {
    o = o || {}; const low = !!o.low, S0 = Math.min(w, h);
    c.clearRect(0, 0, w, h);
    c.save(); c.globalCompositeOperation = 'lighter';
    if (kind === 'embers' || kind === 'spray') {
      const n = low ? 14 : 40, warm = kind === 'embers';
      if (warm) { const g = c.createLinearGradient(0, h, 0, h * 0.55); g.addColorStop(0, 'rgba(255,90,20,0.22)'); g.addColorStop(1, 'rgba(255,90,20,0)'); c.fillStyle = g; c.fillRect(0, h * 0.55, w, h * 0.45); }
      for (let i = 0; i < n; i++) {
        const sp = 0.06 + 0.1 * rnd(i, 1), life = fr(t * sp + rnd(i, 2)), x = (rnd(i, 3) + 0.04 * Math.sin(t * 1.3 + i)) * w, y = h * (warm ? 1.02 - life * 0.9 : 0.95 - Math.sin(life * Math.PI) * 0.35 * (0.5 + rnd(i, 4)));
        const a = (1 - life) * (warm ? 0.9 : 0.6), r = S0 * (warm ? 0.006 + 0.008 * rnd(i, 5) : 0.004 + 0.006 * rnd(i, 5));
        glow(c, x, y, r * 4, warm ? '255,150,40' : '200,250,255', a * 0.5); c.fillStyle = warm ? 'rgba(255,230,140,' + a + ')' : 'rgba(255,255,255,' + a + ')'; c.fillRect(x - r * 0.5, y - r * 0.5, r, r);
      }
    } else if (kind === 'song' || kind === 'hum') {
      const cx = w * (kind === 'hum' ? 0.5 : 0.52), cy = h * (kind === 'hum' ? 0.5 : 0.42), n = low ? 3 : 5, R = S0 * (kind === 'hum' ? 0.35 : 0.6);
      glow(c, cx, cy, S0 * 0.18, '120,240,255', 0.35 + 0.15 * Math.sin(t * 6));
      c.lineWidth = Math.max(1, S0 * 0.004);
      for (let i = 0; i < n; i++) { const q = fr(t * 0.35 + i / n), rr = q * R; c.strokeStyle = 'rgba(140,240,255,' + (0.55 * (1 - q)) + ')'; c.beginPath(); c.ellipse(cx, cy, rr, rr * 0.62, 0, 0, Math.PI * 2); c.stroke(); }
      // the song's line: a sine that trembles across the frame, high and thin
      c.strokeStyle = 'rgba(190,250,255,0.5)'; c.beginPath();
      for (let x = 0; x <= w; x += low ? 8 : 4) { const k = x / w, y = cy + Math.sin(k * 22 + t * 5) * S0 * 0.02 * Math.sin(k * Math.PI) + Math.sin(k * 61 - t * 9) * S0 * 0.006; if (x) c.lineTo(x, y); else c.moveTo(x, y); }
      c.stroke();
      if (kind === 'song') for (let i = 0; i < (low ? 6 : 14); i++) { const q = fr(t * 0.2 + rnd(i, 7)), x = cx + (rnd(i, 8) - 0.5) * w * 0.8, y = cy - q * h * 0.35; glow(c, x, y, S0 * 0.012, '160,255,250', 0.7 * (1 - q)); }
    } else if (kind === 'notes') {
      c.globalCompositeOperation = 'source-over';
      const a = ease((t % 30) * 1.2) * ease(1.6 - u * 1.6 + 0.6), pw = S0 * 0.62, ph = pw * 0.72, x0 = w * 0.62 - pw / 2 + (1 - a) * w * 0.08, y0 = h * 0.15;
      c.globalAlpha = Math.min(1, a); c.translate(x0 + pw / 2, y0 + ph / 2); c.rotate(-0.06 + 0.01 * Math.sin(t)); c.translate(-pw / 2, -ph / 2);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(6, 8, pw, ph);
      c.fillStyle = '#f3ead2'; c.fillRect(0, 0, pw, ph); c.fillStyle = '#e4d6b2'; c.fillRect(0, 0, pw, ph * 0.08);
      c.strokeStyle = 'rgba(120,150,190,0.35)'; c.lineWidth = 1; for (let i = 1; i < 9; i++) { c.beginPath(); c.moveTo(0, ph * (0.08 + i * 0.1)); c.lineTo(pw, ph * (0.08 + i * 0.1)); c.stroke(); }
      const ink = '#2c3a5a'; c.strokeStyle = ink; c.lineWidth = Math.max(1.5, S0 * 0.005);
      // the beacon tower (left) and its spark flying out of it
      const bx = pw * 0.2, by = ph * 0.85; c.beginPath(); c.moveTo(bx - pw * 0.06, by); c.lineTo(bx - pw * 0.025, by - ph * 0.5); c.lineTo(bx + pw * 0.025, by - ph * 0.5); c.lineTo(bx + pw * 0.06, by); c.stroke();
      c.beginPath(); c.arc(bx, by - ph * 0.56, pw * 0.035, 0, Math.PI * 2); c.stroke();
      c.setLineDash([4, 4]); c.beginPath(); c.moveTo(bx + pw * 0.04, by - ph * 0.58); c.quadraticCurveTo(pw * 0.38, ph * 0.12, pw * 0.55, ph * 0.38); c.stroke(); c.setLineDash([]);
      // Funke, sketched: a round body, the visor, two eyes, the antenna
      const fx0 = pw * 0.66, fy = ph * 0.52, fr0 = pw * 0.11; c.beginPath(); c.arc(fx0, fy, fr0, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.ellipse(fx0, fy - fr0 * 0.1, fr0 * 0.7, fr0 * 0.38, 0, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#2aa8c8'; c.fillRect(fx0 - fr0 * 0.4, fy - fr0 * 0.2, fr0 * 0.2, fr0 * 0.2); c.fillRect(fx0 + fr0 * 0.2, fy - fr0 * 0.2, fr0 * 0.2, fr0 * 0.2);
      c.beginPath(); c.moveTo(fx0, fy - fr0); c.lineTo(fx0 + fr0 * 0.2, fy - fr0 * 1.5); c.stroke(); c.beginPath(); c.arc(fx0 + fr0 * 0.2, fy - fr0 * 1.6, fr0 * 0.12, 0, Math.PI * 2); c.stroke();
      // handwriting: wavy lines (no letters — the words are the subtitles')
      c.lineWidth = Math.max(1, S0 * 0.003);
      for (let l = 0; l < 3; l++) { c.beginPath(); const yy = ph * (0.83 + l * 0.0) + l * ph * 0.05; for (let x = pw * 0.44; x < pw * 0.92; x += 3) { const y = yy + Math.sin(x * 0.5 + l) * 1.6; if (x === pw * 0.44) c.moveTo(x, y); else c.lineTo(x, y); } c.stroke(); }
      c.globalAlpha = 1;
    } else if (kind === 'beacons') {
      // the beacons light one after another into an arrow, then a dotted path from its tip to a star
      const A = Fx.ARROW, lit = ease(u * 1.6) * A.length;
      for (let i = 0; i < A.length; i++) { const q = Math.max(0, Math.min(1, lit - i)); if (!q) continue; if (o.beams3d) { glow(c, A[i][0] * w, A[i][1] * h, S0 * 0.022 * q, '160,245,255', 0.5); continue; }   /* (a-story4: the beams are 3-D in the world — here only a spark at their feet) */ const x = A[i][0] * w, y = A[i][1] * h, pul = 0.75 + 0.25 * Math.sin(t * 5 + i); glow(c, x, y, S0 * 0.05 * q, '90,230,255', 0.5 * pul); glow(c, x, y, S0 * 0.012, '220,255,255', 0.95 * q); }
      const k = ease((u - 0.55) * 3);
      if (k > 0) {
        const tip = A[8], sx = w * 0.9, sy = h * 0.14; c.strokeStyle = 'rgba(140,240,255,' + (0.7 * k) + ')'; c.lineWidth = Math.max(1, S0 * 0.004); c.setLineDash([S0 * 0.012, S0 * 0.014]); c.lineDashOffset = -t * 30;
        c.beginPath(); c.moveTo(tip[0] * w, tip[1] * h); c.lineTo(tip[0] * w + (sx - tip[0] * w) * k, tip[1] * h + (sy - tip[1] * h) * k); c.stroke(); c.setLineDash([]);
        glow(c, sx, sy, S0 * 0.09 * k, '255,200,120', 0.7 * k); glow(c, sx, sy, S0 * 0.02, '255,250,230', k);
        c.strokeStyle = 'rgba(255,230,180,' + (0.6 * k) + ')'; c.beginPath(); c.moveTo(sx - S0 * 0.06, sy); c.lineTo(sx + S0 * 0.06, sy); c.moveTo(sx, sy - S0 * 0.06); c.lineTo(sx, sy + S0 * 0.06); c.stroke();
      }
    } else if (kind === 'blink2') {
      // a far beacon in the sky: two blinks, then a pause (the 'here, here')
      const x = w * 0.66, y = h * 0.28, ph0 = t % 2.2, on = (ph0 < 0.25 || (ph0 > 0.5 && ph0 < 0.75)) ? 1 : 0.3;
      { const g1 = c.createLinearGradient(x, y, x, h * 0.95); g1.addColorStop(0, 'rgba(120,240,255,' + (0.35 * on) + ')'); g1.addColorStop(1, 'rgba(120,240,255,0)'); c.fillStyle = g1; c.fillRect(x - S0 * 0.006, y, S0 * 0.012, h * 0.95 - y); }   // (its light column down to the land)
      glow(c, x, y, S0 * 0.14 * on, '90,230,255', 0.55); glow(c, x, y, S0 * 0.025, '230,255,255', on);
      c.strokeStyle = 'rgba(180,250,255,' + (0.6 * on) + ')'; c.lineWidth = Math.max(1, S0 * 0.003); c.beginPath(); c.moveTo(x - S0 * 0.1 * on, y); c.lineTo(x + S0 * 0.1 * on, y); c.moveTo(x, y - S0 * 0.06 * on); c.lineTo(x, y + S0 * 0.06 * on); c.stroke();
    } else if (kind === 'twin') {
      // two suns' light: a gold wash from the upper left, a rose one from the upper right (the real suns are in the sky)
      const k = 0.16 + 0.04 * Math.sin(t * 0.7);
      let g0 = c.createRadialGradient(0, 0, 0, 0, 0, S0 * 1.3); g0.addColorStop(0, 'rgba(255,200,110,' + k + ')'); g0.addColorStop(1, 'rgba(255,200,110,0)'); c.fillStyle = g0; c.fillRect(0, 0, w, h);
      g0 = c.createRadialGradient(w, 0, 0, w, 0, S0 * 1.1); g0.addColorStop(0, 'rgba(255,120,110,' + (k * 0.9) + ')'); g0.addColorStop(1, 'rgba(255,120,110,0)'); c.fillStyle = g0; c.fillRect(0, 0, w, h);
      for (let i = 0; i < (low ? 6 : 16); i++) { const q = fr(t * 0.05 + rnd(i, 12)), x = rnd(i, 13) * w, y = h * (0.2 + 0.7 * rnd(i, 14)) - q * h * 0.1; glow(c, x, y, S0 * 0.008, i % 2 ? '255,210,140' : '255,160,150', 0.5 * Math.sin(q * Math.PI)); }   // (dust in the two lights)
    } else if (kind === 'beam') {
      // the nebula (pink, violet, a teal edge) and the beam swinging to it from below
      const nx = w * 0.78, ny = h * 0.2;
      for (let i = 0; i < (low ? 4 : 8); i++) glow(c, nx + (rnd(i, 9) - 0.5) * S0 * 0.4, ny + (rnd(i, 10) - 0.5) * S0 * 0.2, S0 * (0.12 + 0.1 * rnd(i, 11)), i % 3 === 0 ? '90,200,220' : i % 2 ? '220,90,190' : '150,90,230', 0.18);
      const k = ease(u * 1.3), bx = w * 0.42, by = h * 1.0, tx = bx + (nx - bx) * k + (1 - k) * w * -0.2, ty = by + (ny - by) * (0.4 + 0.6 * k);
      const g = c.createLinearGradient(bx, by, tx, ty); g.addColorStop(0, 'rgba(120,240,255,0.55)'); g.addColorStop(1, 'rgba(120,240,255,0)');
      c.strokeStyle = g; c.lineWidth = S0 * 0.03; c.lineCap = 'round'; c.beginPath(); c.moveTo(bx, by); c.lineTo(tx, ty); c.stroke();
      c.lineWidth = S0 * 0.008; c.strokeStyle = 'rgba(230,255,255,0.7)'; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + (tx - bx) * 0.7, by + (ty - by) * 0.7); c.stroke();
    } else if (kind === 'nebin') {
      // a-story4 · the nebula from inside: walls of Hα pink and violet, a teal rim round a hot young star, dark dust lanes
      // in front of them, newborn stars twinkling; strongest high in the frame, fading to the land
      const n = low ? 5 : 11, drift = t * 0.006;
      for (let i = 0; i < n; i++) { const x = (rnd(i, 21) + drift * (rnd(i, 22) - 0.5)) * w, y = h * (0.05 + 0.5 * rnd(i, 23)), r = S0 * (0.25 + 0.3 * rnd(i, 24)); glow(c, x, y, r, i % 4 === 0 ? '150,80,220' : i % 3 === 0 ? '255,110,150' : '235,70,120', 0.16 + 0.08 * rnd(i, 25)); }
      const hx = w * 0.68, hy = h * 0.2; glow(c, hx, hy, S0 * 0.42, '60,210,200', 0.16); glow(c, hx, hy, S0 * 0.06, '220,250,255', 0.6); glow(c, hx, hy, S0 * 0.015, '255,255,255', 1);
      c.globalCompositeOperation = 'source-over';
      for (let i = 0; i < (low ? 3 : 6); i++) { const x = w * (0.1 + 0.15 * i + 0.05 * Math.sin(t * 0.05 + i)), y = h * (0.28 + 0.12 * rnd(i, 26)); const g = c.createRadialGradient(x, y, 0, x, y, S0 * 0.22); g.addColorStop(0, 'rgba(18,8,22,0.42)'); g.addColorStop(1, 'rgba(18,8,22,0)'); c.fillStyle = g; c.beginPath(); c.ellipse(x, y, S0 * 0.34, S0 * 0.08, -0.25 + 0.2 * rnd(i, 27), 0, Math.PI * 2); c.fill(); }   // (the dust lanes)
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < (low ? 10 : 28); i++) { const x = rnd(i, 28) * w, y = h * 0.62 * rnd(i, 29), tw = 0.55 + 0.45 * Math.sin(t * (1.5 + rnd(i, 30) * 3) + i); glow(c, x, y, S0 * 0.008 * (1 + rnd(i, 31)), i % 3 ? '255,240,250' : '180,230,255', 0.7 * tw); }
    } else if (kind === 'flimmi') {
      // Flimmi: a star being born — a bright point in a flat glowing disc, two thin jets out of its poles, sparks round it;
      // it pulses as it speaks
      const x = w * 0.5, y = h * 0.3, pu = 0.8 + 0.2 * Math.sin(t * 7) * Math.sin(t * 2.3);
      glow(c, x, y, S0 * 0.3, '255,170,90', 0.22 * pu);
      c.save(); c.translate(x, y); c.rotate(-0.18); c.scale(1, 0.18); glow(c, 0, 0, S0 * 0.22, '255,200,120', 0.5); c.restore();   // (the disc, seen nearly edge on)
      for (const sg of [-1, 1]) { const g = c.createLinearGradient(x, y, x + sg * S0 * 0.05, y - sg * S0 * 0.32); g.addColorStop(0, 'rgba(160,220,255,0.6)'); g.addColorStop(1, 'rgba(160,220,255,0)'); c.strokeStyle = g; c.lineWidth = Math.max(1, S0 * 0.006); c.beginPath(); c.moveTo(x, y); c.lineTo(x + sg * S0 * 0.05, y - sg * S0 * 0.32); c.stroke(); }   // (the jets)
      glow(c, x, y, S0 * 0.05 * pu, '255,240,200', 0.9); glow(c, x, y, S0 * 0.014, '255,255,255', 1);
      for (let i = 0; i < (low ? 5 : 12); i++) { const a = t * (0.4 + 0.3 * rnd(i, 32)) + i * 2.1, rr = S0 * (0.08 + 0.1 * rnd(i, 33)); glow(c, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.3, S0 * 0.006, '255,230,170', 0.8); }
    } else if (kind === 'redsun') {
      // the patient sun: a huge red dwarf low in the sky, its limb darker, a few spots, a deep red wash over everything
      const x = w * 0.26, y = h * 0.3, R0 = S0 * 0.17;
      let g = c.createRadialGradient(x, y, R0 * 0.8, x, y, S0 * 0.9); g.addColorStop(0, 'rgba(255,70,30,0.3)'); g.addColorStop(1, 'rgba(255,70,30,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'source-over';
      g = c.createRadialGradient(x - R0 * 0.2, y - R0 * 0.2, 0, x, y, R0); g.addColorStop(0, 'rgba(255,170,90,0.95)'); g.addColorStop(0.7, 'rgba(240,80,40,0.92)'); g.addColorStop(1, 'rgba(170,30,20,0.85)'); c.fillStyle = g; c.beginPath(); c.arc(x, y, R0, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(110,20,10,0.45)'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x + (rnd(i, 34) - 0.5) * R0, y + (rnd(i, 35) - 0.5) * R0, R0 * (0.05 + 0.05 * rnd(i, 36)), 0, Math.PI * 2); c.fill(); }   // (star spots)
      c.globalCompositeOperation = 'lighter'; glow(c, x, y, R0 * 1.6, '255,110,60', 0.25 + 0.03 * Math.sin(t));
    } else if (kind === 'echo' || kind === 'wake') {
      // Echo: a big calm violet ring breathing slowly in the middle; round it the five peoples' lanterns. Waking, the ring
      // brightens to cyan and rings of light run outward
      const x = w * 0.5, y = h * 0.42, wk = kind === 'wake' ? ease(u * 1.4) : 0, br = 0.5 + 0.5 * Math.sin(t * (0.8 + wk * 2));
      const col = wk > 0.5 ? '120,235,255' : '170,150,255';
      c.lineWidth = Math.max(2, S0 * (0.012 + 0.01 * wk)); c.strokeStyle = 'rgba(' + col + ',' + (0.25 + 0.2 * br + 0.4 * wk) + ')'; c.beginPath(); c.ellipse(x, y, S0 * 0.24, S0 * 0.24 * 0.55, 0, 0, Math.PI * 2); c.stroke();
      glow(c, x, y, S0 * (0.12 + 0.1 * wk), col, 0.2 + 0.15 * br + 0.5 * wk);
      if (wk > 0) for (let i = 0; i < (low ? 3 : 6); i++) { const q = fr(t * 0.45 + i / 6), rr = S0 * (0.24 + q * 0.7); c.strokeStyle = 'rgba(140,240,255,' + (0.5 * (1 - q) * wk) + ')'; c.lineWidth = Math.max(1, S0 * 0.004); c.beginPath(); c.ellipse(x, y, rr, rr * 0.55, 0, 0, Math.PI * 2); c.stroke(); }
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5 + t * 0.05, lx = x + Math.cos(a) * S0 * 0.42, ly = y + Math.sin(a) * S0 * 0.24 + Math.sin(t * 1.3 + i) * S0 * 0.01; glow(c, lx, ly, S0 * 0.06, Fx.FOLK[i], 0.45); glow(c, lx, ly, S0 * 0.012, '255,255,240', 0.9); }
    } else if (kind === 'gather') {
      // the feast: lanterns in the five peoples' colours rising softly over the square
      for (let i = 0; i < (low ? 10 : 26); i++) { const q = fr(t * (0.04 + 0.03 * rnd(i, 37)) + rnd(i, 38)), x = (rnd(i, 39) + 0.03 * Math.sin(t * 0.7 + i)) * w, y = h * (1.05 - q * 0.95), a = Math.sin(q * Math.PI); glow(c, x, y, S0 * 0.03, Fx.FOLK[i % 5], 0.45 * a); glow(c, x, y, S0 * 0.006, '255,250,230', 0.9 * a); }
    } else if (kind === 'finale') {
      // every beacon at once: arcs of light across the whole sky (the network), fireworks in the peoples' colours, and
      // Flimmi's new star (the 3-D beams over the land are the world's own: story.js drawBeams)
      const nA = low ? 5 : 9, k = ease(u * 2.2 + (t > 8 ? 1 : 0));
      c.lineWidth = Math.max(1, S0 * 0.004);
      for (let i = 0; i < nA; i++) { const x0 = w * rnd(i, 40), x1 = w * rnd(i, 41), top = h * (0.04 + 0.2 * rnd(i, 42)), y0 = h * 0.62; c.strokeStyle = 'rgba(120,235,255,' + (0.35 * k) + ')'; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, top - h * 0.25, x1, y0); c.stroke(); glow(c, (x0 + x1) / 2, top - h * 0.12 + h * 0.12 * 0, S0 * 0.01, '200,250,255', 0.6 * k); }
      const sx = w * 0.62, sy = h * 0.12, tw = 0.75 + 0.25 * Math.sin(t * 3);
      glow(c, sx, sy, S0 * 0.08 * tw, '255,220,140', 0.5 * k); glow(c, sx, sy, S0 * 0.012, '255,255,255', k);
      c.strokeStyle = 'rgba(255,240,200,' + (0.6 * k * tw) + ')'; c.beginPath(); c.moveTo(sx - S0 * 0.07, sy); c.lineTo(sx + S0 * 0.07, sy); c.moveTo(sx, sy - S0 * 0.05); c.lineTo(sx, sy + S0 * 0.05); c.stroke();
      const nB = low ? 2 : 5;
      for (let b = 0; b < nB; b++) {
        const per = 2.4 + rnd(b, 43), q = fr(t / per + rnd(b, 44)), cyc = Math.floor(t / per + rnd(b, 44)), bx = w * (0.12 + 0.76 * rnd(b + cyc * 7, 45)), by = h * (0.12 + 0.3 * rnd(b + cyc * 7, 46));
        if (q < 0.15) { glow(c, bx, by + (0.15 - q) * h * 2, S0 * 0.008, '255,230,180', 0.9); continue; }   // (the rocket rising)
        const e = (q - 0.15) / 0.85, col = Fx.FOLK[(b + cyc) % 5], a = (1 - e) * 0.9, pn = low ? 10 : 22;
        for (let i = 0; i < pn; i++) { const an = i / pn * Math.PI * 2, rr = S0 * 0.16 * ease(e * 1.6); glow(c, bx + Math.cos(an) * rr, by + Math.sin(an) * rr + e * e * S0 * 0.05, S0 * 0.012, col, a); }
        if (e < 0.25) glow(c, bx, by, S0 * 0.09, '255,250,230', 0.5 * (1 - e * 4));
      }
    } else if (kind === 'blink3') {
      // the new signal: far out, a pale violet point blinks three times, then waits
      const x = w * 0.72, y = h * 0.2, ph0 = t % 3, on = (ph0 < 0.2 || (ph0 > 0.45 && ph0 < 0.65) || (ph0 > 0.9 && ph0 < 1.1)) ? 1 : 0.15;
      glow(c, x, y, S0 * 0.12 * on, '200,170,255', 0.5); glow(c, x, y, S0 * 0.018, '250,245,255', on);
      c.strokeStyle = 'rgba(220,200,255,' + (0.6 * on) + ')'; c.lineWidth = Math.max(1, S0 * 0.003); c.beginPath(); c.moveTo(x - S0 * 0.08 * on, y); c.lineTo(x + S0 * 0.08 * on, y); c.moveTo(x, y - S0 * 0.05 * on); c.lineTo(x, y + S0 * 0.05 * on); c.stroke();
    }
    c.restore();
    return true;
  };
})(VR);
