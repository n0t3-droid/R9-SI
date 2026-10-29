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
      box(-4, 32, -3, 3, 39, 3, (x, y, z) => facet(x, y, z, side(x) - (y > 37 ? 1 : 0)));
      box(-3, 33, -4, 2, 37, -4, (x, y, z) => (y === 37 || x === -3 || x === 2 ? facet(x, y, z, 3) : ICE[5]));
      box(-1, 40, -2, 0, 41, 4, (x, y, z) => facet(x, y, z, 1)); box(-1, 42, -1, 0, 42, 2, ICE[0]); box(-1, 39, 4, 0, 39, 5, ICE[2]);
      box(-5, 34, -2, -5, 37, 1, ICE[1]); box(4, 34, -2, 4, 37, 1, ICE[3]);   // (the helm's cheek plates)
      const optic = new Grid(4, 4, 1, 2, 2, 0); optic.ell(2, 2, 0.5, 2, 2, 0.8, LENS, { emis: 1 });
      return { h: 43 / 16, w: 1.2, gait: 'none', parts: { whole: { grid: W, pivot: [0, 0, 0] }, optic: { grid: optic, pivot: [0, 0, 0] } }, layout: { whole: [0, 0, 0], optic: [0, 35, -4.6] }, order: ['whole'] };
    };
    // the ice window over it (1 voxel thick discs, R 24; story.js scales them flat)
    MV.story_icewin = function () {
      const R = 24, D = 2 * R + 1;
      const disc = (col) => { const g = new Grid(D, 1, D, R, 0, R); for (let z = 0; z < D; z++) for (let x = 0; x < D; x++) { const d = Math.hypot(x - R, z - R) / R; if (d > 1) continue; const c = col(d, x - R, z - R); if (c !== null) g.set(x, 0, z, c); } return g; };
      const win = disc((d) => (d < 0.42 ? 0x1f5682 : d < 0.6 ? 0x2f6c9a : d < 0.74 ? 0x5d97c4 : d < 0.87 ? 0x9cc8e6 : 0xd7ecf8));
      const veil = disc((d) => (d < 0.87 ? 0xcfe8f7 : null));
      // the cracks: a few walks out from near the middle, seeded (the same every time)
      const cr = new Set(); let s = 77;
      const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 8) / 16777216; };
      for (let k = 0; k < 5; k++) {
        let a = k * 1.3 + rnd(), x = Math.cos(a) * 4, z = Math.sin(a) * 4;
        for (let i = 0; i < 26; i++) { a += (rnd() - 0.5) * 0.9; x += Math.cos(a); z += Math.sin(a); if (Math.hypot(x, z) > R - 2) break; cr.add(Math.round(x) + ',' + Math.round(z)); if (rnd() < 0.12) { const b = a + (rnd() < 0.5 ? 1 : -1) * 0.9; cr.add(Math.round(x + Math.cos(b) * 1.5) + ',' + Math.round(z + Math.sin(b) * 1.5)); } }
      }
      const cracks = disc((d, x, z) => (cr.has(x + ',' + z) ? 0xf4fbff : null));
      return { parts: { win: { grid: win, pivot: [0, 0, 0] }, veil: { grid: veil, pivot: [0, 0, 0] }, cracks: { grid: cracks, pivot: [0, 0, 0] } }, layout: { win: [0, 0, 0], veil: [0, 0, 0], cracks: [0, 0, 0] } };
    };
  }
})(VR);
