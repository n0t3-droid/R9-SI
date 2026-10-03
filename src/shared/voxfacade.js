// ============================================================================
// The facade kit — VX32 models (voxmodel.js) for the outside of the villas:
// window assemblies (one frame around the whole opening with slim mullions and a
// transom, a casement with its handle, a stone sill outside and a window board
// inside, the roller-shutter box over the modern frames, the reveal left to the
// wall blocks around), arched windows for the classic skins, frosted bathroom
// lights, half-round gutters with corner outlets and downpipes under the hip
// roofs, wall lanterns, house signs, letterboxes and a sectional garage door.
// Front = −z (facing 0): the OUTSIDE of a window / the eave side of a gutter.
// ============================================================================
(function (VR) {
  'use strict';
  const VM = VR.VM;
  if (!VM) return;
  const M = VM.M, def = VM.define, sh = VR.VX.sh;
  const FRAME = { black: 0x2A2D33, white: 0xF2F2EE };
  const GLASS = 0xC9E2EE, SILL = 0xE8E6E0, ZINC = 0x9A9EA4;

  // ------------------------------------------------------------------ windows
  // kind: tall (4 high) · high (2, a top band) · std (3) · arch (3, round-headed) — w blocks wide, one deep
  // z: 0 = outer wall face, 16 = inner face. Frame plane at z 4–7.5, glass at z 5.5–6.
  function window(kind, w, frame) {
    const H = kind === 'tall' ? 4 : kind === 'high' ? 2 : 3, Wd = w * 16, Hd = H * 16, fc = FRAME[frame], fr = M.gloss(fc), frD = M.gloss(sh(fc, 0.85));
    def('vm_win_' + kind + w + '_' + frame, 'Window · ' + kind + ' ' + w + ' · ' + frame, { size: [w, H, 1], sound: 'glass', hard: 0.6, build: (b) => {
      const arch = kind === 'arch', rimW = 1.2, top = Hd - (frame === 'black' && !arch ? 2.5 : 0);   // the shutter box takes the top 2.5 units of modern windows
      const archR = Wd / 2, archC = top - archR;                                                     // round head: a half circle on the top of the frame
      // the frame body (then the glass opening is cut out of it)
      if (arch) { b.box(0, 1.5, 4, Wd, archC, 7.5, fr); b.cyl('z', Wd / 2, archC, archR, 4, 7.5, fr); }
      else b.box(0, 1.5, 4, Wd, top, 7.5, fr);
      if (arch) { b.cut(rimW, 1.5 + 1.5, 4, Wd - rimW, archC, 7.5); b.cyl('z', Wd / 2, archC, archR - rimW, 4, 7.5, 0); }
      else b.cut(rimW, 3, 4, Wd - rimW, top - rimW, 7.5);
      // glass pane filling the opening
      if (arch) { b.box(rimW, 3, 5.5, Wd - rimW, archC, 6, M.glass(GLASS)); b.cyl('z', Wd / 2, archC, archR - rimW, 5.5, 6, M.glass(GLASS)); }
      else b.box(rimW, 3, 5.5, Wd - rimW, top - rimW, 6, M.glass(GLASS));
      // mullions at every block join, a transom two blocks up (tall / std) — classic white frames get a glazing-bar grid instead
      for (let k = 1; k < w; k++) b.box(k * 16 - 0.5, 3, 4, k * 16 + 0.5, arch ? archC : top - rimW, 7.5, fr);
      if (H >= 3 && !arch) b.box(rimW, 32 - 0.4, 4, Wd - rimW, 32 + 0.4, 7.5, fr);
      if (frame === 'white') { for (let k = 1; k < w * 2; k++) b.box(k * 8 - 0.25, 3, 5.5, k * 8 + 0.25, arch ? archC : top - rimW, 6, fr); for (let y = 3 + 8; y < (arch ? archC : top - rimW) - 2; y += 8) b.box(rimW, y - 0.25, 5.5, Wd - rimW, y + 0.25, 6, fr); }   // glazing bars inside the pane
      // one casement (the right pane): an inner frame with a handle on the inside face
      if (!arch) {
        const cx0 = w === 1 ? rimW : (w - 1) * 16 + 0.5, cx1 = Wd - rimW, cy0 = H >= 3 ? 32 + 0.4 : 3, cy1 = top - rimW;
        b.box(cx0, cy0, 6, cx1, cy1, 7.5, fr); b.cut(cx0 + 1, cy0 + 1, 6, cx1 - 1, cy1 - 1, 7.5); b.box(cx0 + 1, cy0 + 1, 6, cx1 - 1, cy1 - 1, 6.3, M.glass(GLASS));
        b.box(cx0 + 0.3, (cy0 + cy1) / 2 - 2, 7.5, cx0 + 1.1, (cy0 + cy1) / 2 + 2, 8.5, M.metal(frame === 'black' ? 0x8A8E96 : 0xD8DEE4));
      }
      // the roller-shutter box (modern frames) sits over the frame inside the reveal
      if (frame === 'black' && !arch) { b.box(0, Hd - 2.5, 3.5, Wd, Hd, 9, frD); b.box(0, Hd - 2.5, 3.5, Wd, Hd - 2, 9, M.gloss(sh(fc, 0.7))); }
      // outer stone sill with a drip, inner window board
      b.box(0, 0, 0, Wd, 1.5, 4.5, M.stone(SILL)); b.box(0, 1.5, 3, Wd, 2, 4.5, M.stone(SILL)); b.box(0, 0.5, 0, Wd, 1.5, 0.6, M.stone(sh(SILL, 0.85)));
      b.box(0, 0, 7.5, Wd, 1.2, 16, M.gloss(frame === 'black' ? 0xF2F2EE : 0xEDEAE2));
    } });
  }
  for (const frame of ['black', 'white']) for (const kind of ['tall', 'std', 'high', 'arch']) for (let w = 1; w <= 3; w++) window(kind, w, frame);
  // a frosted bathroom light: a square frame with obscured glass
  for (const frame of ['black', 'white']) def('vm_win_frosted1_' + frame, 'Window · frosted · ' + frame, { size: [1, 1, 1], sound: 'glass', hard: 0.6, build: (b) => {
    const fr = M.gloss(FRAME[frame]);
    b.box(0, 1.5, 4, 16, 16, 7.5, fr); b.cut(1.2, 3, 4, 14.8, 14.8, 7.5); b.box(1.2, 3, 5.5, 14.8, 14.8, 6, M.glass(0xE4EEF2));
    b.box(0, 0, 0, 16, 1.5, 4.5, M.stone(SILL)); b.box(0, 0, 7.5, 16, 1.2, 16, M.gloss(0xF2F2EE));
    b.box(2, 7.5, 7.5, 2.8, 10, 8.5, M.metal(0x8A8E96));
  } });

  // ------------------------------------------------------------------ gutters & downpipes (under the eave cells; the wall is at +z)
  const ZN = M.metal(ZINC);
  // a half-round gutter along x at the top outer edge of the cell, two brackets
  def('vm_gutter', 'Gutter', { size: [1, 1, 1], sound: 'metal', hard: 0.4, build: (b) => {
    b.tube('x', 14, 3, 2.6, 0.6, 0, 16, ZN); b.cut(0, 14, 0, 16, 16, 16); b.box(0, 13.4, 5.3, 16, 14, 5.9, ZN);
    for (const x of [3, 11]) b.box(x, 11, 5.8, x + 0.8, 14.5, 6.6, M.metal(0x6A7078));   // hanger tabs behind the trough
  } });
  // the corner: both gutters meet at the outer corner with an outlet that drops and runs +x to the next cell (the downpipe top)
  def('vm_gutter_corner', 'Gutter · corner', { size: [1, 1, 1], sound: 'metal', hard: 0.4, build: (b) => {
    b.tube('x', 14, 3, 2.6, 0.6, 3, 16, ZN); b.tube('z', 3, 14, 2.6, 0.6, 3, 16, ZN); b.sphere(3, 14, 3, 2.6, ZN); b.sphere(3, 14, 3, 2, 0); b.cut(0, 14, 0, 16, 16, 16);
    b.cyl('y', 3, 3, 1, 8, 12, ZN); b.sphere(3, 8, 3, 1.1, ZN); b.rod(3, 8, 3, 16, 8, 3, 1, ZN);
  } });
  // the downpipe's top cell: the run comes in from −x at the outer edge, turns to the wall and drops
  def('vm_downpipe_top', 'Downpipe · top', { size: [1, 1, 1], sound: 'metal', hard: 0.4, build: (b) => {
    b.rod(0, 8, 3, 8, 8, 3, 1, ZN); b.sphere(8, 8, 3, 1.1, ZN); b.rod(8, 8, 3, 8, 7, 14, 1, ZN); b.sphere(8, 7, 14, 1.1, ZN); b.cyl('y', 8, 14, 1, 0, 7, ZN);
    b.box(6.5, 2, 14.5, 9.5, 3, 16, M.metal(0x6A7078));
  } });
  def('vm_downpipe', 'Downpipe', { size: [1, 1, 1], sound: 'metal', hard: 0.4, build: (b) => { b.cyl('y', 8, 14, 1, 0, 16, ZN); b.box(6.5, 7, 14.5, 9.5, 8, 16, M.metal(0x6A7078)); } });

  // ------------------------------------------------------------------ entrance details (the wall is at +z)
  def('vm_wall_lantern', 'Wall Lantern', { size: [1, 1, 1], sound: 'metal', hard: 0.4, light: [12, 9, 5], build: (b) => {
    const bk = M.metal(0x1C1E22);
    b.box(6.5, 6, 14.5, 9.5, 11, 16, bk); b.rod(8, 10, 14.5, 8, 10, 10.5, 0.5, bk);
    b.box(5, 6, 8, 11, 6.6, 13, bk); b.box(5, 12.4, 8, 11, 13, 13, bk); for (const [x, z] of [[5.3, 8.3], [10.3, 8.3], [5.3, 12.3], [10.3, 12.3]]) b.box(x, 6.6, z, x + 0.4, 12.4, z + 0.4, bk);
    b.box(5.4, 6.6, 8.4, 10.6, 12.4, 12.6, M.glass(0xFFE8C0)); b.sphere(8, 9.5, 10.5, 1.2, M.light(0xFFD27A));
    b.extrude([[4.5, 13], [11.5, 13], [8, 15]], 'z', 8, 13, bk);
  } });
  def('vm_house_sign', 'House Number', { size: [1, 1, 1], sound: 'metal', hard: 0.3, light: [4, 4, 4], build: (b) => {
    b.box(4, 6, 15, 12, 11, 16, M.metal(0x1C1E22)); b.box(4.4, 6.4, 14.7, 11.6, 10.6, 15, M.gloss(0x2A2D33));
    // "12" in a 3×5 pixel font, backlit white
    const px = (x, y) => b.box(5 + x * 0.9, 7 + y * 0.6, 14.4, 5.8 + x * 0.9, 7.5 + y * 0.6, 14.7, M.light(0xFFFFFF));
    for (let y = 0; y < 5; y++) px(1, y); px(0, 3); px(0, 0); px(2, 0);
    px(4, 4); px(5, 4); px(6, 3); px(5, 2); px(4, 1); px(4, 0); px(5, 0); px(6, 0);
  } });
  def('vm_letterbox', 'Letterbox', { size: [1, 1, 1], sound: 'metal', hard: 0.5, build: (b) => {
    const st = M.metal(0x6A7078);
    b.box(7, 0, 9, 9, 8, 11, st); b.rbox(3, 8, 6, 13, 16, 13, 0.8, M.metal(0x2A2D33)); b.box(3.5, 13.5, 5.8, 12.5, 14.2, 6.2, M.metal(0x8A8E96)); b.box(4, 9.5, 5.8, 8, 12, 6.2, M.gloss(0xF2F2EE)); b.cyl('z', 10.5, 10.5, 0.7, 5.5, 6.2, M.chrome());
  } });
  // sectional garage door: four panels with shadow joints, a window strip in the upper panel, a handle; 7 blocks wide, 4 high
  def('vm_garage_door7', 'Garage Door · sectional', { size: [7, 4, 1], sound: 'metal', hard: 1, build: (b) => {
    const W = 112, H = 64, pn = M.gloss(0x2E3136), jt = M.gloss(0x1A1C20);
    b.box(0, 0, 2, W, H, 5, pn);
    for (let y = 16; y < H; y += 16) b.box(0, y - 0.5, 2, W, y + 0.5, 3, jt);
    for (let y = 2; y < H; y += 16) for (let x = 0; x < W; x += 2.2) b.box(x, y, 2, x + 0.8, y + 12, 2.4, M.gloss(0x34373E));          // a fine vertical ribbing on each panel
    for (let k = 0; k < 7; k++) b.box(k * 16 + 2, 50, 1.8, k * 16 + 14, 60, 3, M.glass(0x4A5A66));                                      // the window strip
    b.box(52, 22, 1.4, 60, 23.5, 2, M.metal(0x8A8E96)); b.box(52, 22, 1.4, 53, 24, 2.2, M.metal(0x8A8E96)); b.box(59, 22, 1.4, 60, 24, 2.2, M.metal(0x8A8E96));
    for (const x of [0, W - 1.5]) b.box(x, 0, 5, x + 1.5, H, 7, M.metal(0x1A1C20));                                                       // guide rails
  } });
})(VR);
