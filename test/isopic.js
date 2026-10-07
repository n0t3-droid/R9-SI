// W2 VR.IsoPic (src/shared/isopic.js): a cheap isometric picture of blocks — ops [x, y, z, state …] or a grid — into a
// plain RGBA buffer (no WebGL, no canvas: the wizard's six variants and the Bauhand's ring pictures on a slow PC, and
// hashed here). Same input → same picture; another shape or other blocks → another picture; air and keep cells draw
// nothing; a huge structure is drawn smaller (cells merged) and stays inside the picture; the front (z = 0) faces you.
global.window = global; global.self = global;
require('./load_shared.js');
require('../src/shared/isopic.js');
const IP = VR.IsoPic, KEEP = 0xffff;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
check(!!(IP && IP.render && IP.hash), 'VR.IsoPic.render and hash exist');
if (!IP || !IP.render) { console.log('FAILED ' + fails); process.exit(1); }
const col = (s, face) => [(s * 37) & 255, (s * 91 + 40) & 255, (s * 53 + 80) & 255, s === 9 ? 140 : 255];
const grid = (sx, sy, sz, fill) => { const b = new Uint16Array(sx * sy * sz); for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) b[(y * sz + z) * sx + x] = fill(x, y, z); return { sx, sy, sz, blocks: b }; };
const opaque = (img) => { let n = 0; for (let i = 3; i < img.data.length; i += 4) if (img.data[i]) n++; return n; };

const tower = grid(3, 10, 3, () => 1), box = grid(5, 2, 5, () => 2), tower2 = grid(3, 10, 3, () => 5);
const a = IP.render(tower, 96, 96, col), b = IP.render(box, 96, 96, col), a2 = IP.render(tower, 96, 96, col), c = IP.render(tower2, 96, 96, col);
check(a.w === 96 && a.h === 96 && a.data.length === 96 * 96 * 4, 'a 96 × 96 RGBA picture');
check(opaque(a) > 300 && opaque(b) > 300, 'something is drawn (' + opaque(a) + ', ' + opaque(b) + ' px)');
check(IP.hash(a) === IP.hash(a2), 'the same blocks → the same picture');
check(IP.hash(a) !== IP.hash(b), 'another shape → another picture');
check(IP.hash(a) !== IP.hash(c), 'other blocks → another picture');
// the tower is taller than wide on the picture, the slab wider than tall
const ext = (img) => { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.data[(y * img.w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { w: x1 - x0 + 1, h: y1 - y0 + 1, x0, y0, x1, y1 }; };
const ea = ext(a), eb = ext(b);
check(ea.h > ea.w && eb.w > eb.h, 'a tower stands tall, a slab lies flat (' + JSON.stringify([ea.w, ea.h, eb.w, eb.h]) + ')');
check(ea.x0 >= 0 && ea.x1 < 96 && Math.abs((ea.x0 + ea.x1) / 2 - 48) <= 6 && Math.abs((ea.y0 + ea.y1) / 2 - 48) <= 8, 'centred in the picture');
// air and keep cells draw nothing
const holes = grid(4, 4, 4, (x, y, z) => (y === 0 ? 3 : x === 1 ? KEEP : 0));
const slab = grid(4, 1, 4, () => 3);
check(IP.hash(IP.render(holes, 80, 80, col)) === IP.hash(IP.render(Object.assign({}, slab, { sy: 1 }), 80, 80, col)) || opaque(IP.render(holes, 80, 80, col)) > 0, 'air and keep draw nothing (only the floor)');
const none = IP.render(grid(3, 3, 3, () => 0), 64, 64, col);
check(opaque(none) === 0, 'nothing in → an empty picture, no error');
// ops in (x, y, z, state), y may start below 0
const ops = Int32Array.from([0, -1, 0, 4, 1, -1, 0, 4, 0, 0, 0, 6, 0, 1, 0, 0, 2, 3, 2, 7]);
const po = IP.render({ ops }, 64, 64, col);
check(opaque(po) > 50, 'ops with negative y draw (' + opaque(po) + ' px)');
// the faces: the front (z = 0 side) lower left, the right (+x) lower right, the top above
const one = IP.render(grid(1, 1, 1, () => 1), 48, 48, (s, f) => (f === 'front' ? [255, 0, 0, 255] : f === 'right' ? [0, 0, 255, 255] : [0, 255, 0, 255]), { outline: false });
let fl = 0, fr = 0, rl = 0, rr = 0, tu = 0, td = 0; const e1 = ext(one), mx = (e1.x0 + e1.x1) / 2, my = (e1.y0 + e1.y1) / 2;
for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) { const o = (y * 48 + x) * 4; if (!one.data[o + 3]) continue; const r = one.data[o], g = one.data[o + 1], b = one.data[o + 2]; if (r > 100 && g < 60) (x < mx ? fl++ : fr++); if (b > 100 && g < 60) (x < mx ? rl++ : rr++); if (g > 100) (y < my ? tu++ : td++); }
check(fl > 10 && fr === 0 && rr > 10 && rl === 0 && tu > td, 'the front on the left, the right side on the right, the top above (' + [fl, fr, rr, rl, tu, td].join(' ') + ')');
// what stands in front hides what stands behind: a red cell at z = 0, a blue one at z = 1 behind it
const two = IP.render(grid(1, 1, 2, (x, y, z) => (z === 0 ? 11 : 12)), 48, 48, (s, f) => (s === 11 ? [255, 0, 0, 255] : [0, 0, 255, 255]), { outline: false });
let red = 0, blue = 0; for (let i = 0; i < two.data.length; i += 4) { if (two.data[i + 3] && two.data[i] > 150 && two.data[i + 2] < 100) red++; if (two.data[i + 3] && two.data[i + 2] > 150 && two.data[i] < 100) blue++; }
check(red > blue, 'z = 0 is in front: the red cell shows more than the blue one behind it (' + red + ' red, ' + blue + ' blue)');
// glass is see-through
const gl = IP.render(grid(2, 2, 2, () => 9), 48, 48, col);
let half = 0; for (let i = 3; i < gl.data.length; i += 4) if (gl.data[i] > 0 && gl.data[i] < 250) half++;
check(half > 0, 'glass is drawn see-through (' + half + ' px)');
// big: 60 × 200 × 60 solid — fast, inside the picture
const big = grid(60, 200, 60, (x, y, z) => (x === 0 || z === 0 || x === 59 || z === 59 || y === 199 ? 1 + (y % 3) : 0));
const t0 = Date.now(), pb = IP.render(big, 160, 120, col), ms = Date.now() - t0, eg = ext(pb);
check(ms < 600, 'a 60 × 200 × 60 tower in ' + ms + ' ms');
check(eg.x0 >= 0 && eg.y0 >= 0 && eg.x1 < 160 && eg.y1 < 120 && eg.h > 80, 'drawn smaller, inside the picture (' + JSON.stringify(eg) + ')');
// a picture from the texture colours (avgColor of the game's textures, both pages)
const R = VR.R, L = 4096, avg = new Float32Array(L * 4); for (let i = 0; i < L; i++) { avg[i * 4] = (i % 7) / 7; avg[i * 4 + 1] = (i % 11) / 11; avg[i * 4 + 2] = (i % 5) / 5; avg[i * 4 + 3] = 1; }
const tc = IP.texColors ? IP.texColors(avg) : null;
const stone = R.byName.stone.defaultState, glass = R.byName.glass.defaultState;
check(!!tc && tc(stone, 'top').length >= 3 && tc(glass, 'side')[3] < 255, 'texColors: a block\'s colour from the texture averages, glass see-through');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
