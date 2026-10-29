#!/usr/bin/env python3
# u-orbit3 · the orbit pictures in numbers (test/orbit3.js runs it on the offline renders; usable on browser shots too)
#   day:   the land's luma sd, its mean saturation (HSV), the veil: the 10th percentile of min(r, g, b) in the nadir band
#          (the frame's bottom 18 %) over the same in the band just under the limb (haze lifts the floor; real orbital
#          pictures are hazy only toward the limb)
#   night: the lit share of the ground (luma > 40) and the glow floor (the median luma of the ground) — a carpet of lights
#          lifts both
# usage: python3 test/orbit3_measure.py <png> [day|night] → one JSON line.   regress: skip
import sys, json
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB'); mode = sys.argv[2] if len(sys.argv) > 2 else 'day'
W, H = im.size; px = im.load()
def lum(p): return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]
# the limb: the first row from the top whose middle half is lit on average (the black sky above it)
limb = H // 3
for y in range(H):
    m = sum(lum(px[x, y]) for x in range(W // 4, 3 * W // 4, 4)) / len(range(W // 4, 3 * W // 4, 4))
    if m > (30 if mode == 'day' else 6): limb = y; break
y0 = min(H - 1, limb + max(4, H // 40)) if mode == 'day' else int(H * 0.6)   # (night: the ground's lower 40 %)
rows = list(range(y0, H, 2)); cols = range(0, W, 2)
L = [lum(px[x, y]) for y in rows for x in cols]
n = len(L); mean = sum(L) / n; sd = (sum((l - mean) ** 2 for l in L) / n) ** 0.5
out = {'limb': limb, 'mean': round(mean, 1), 'sd': round(sd, 1)}
if mode == 'day':
    sat = []
    for y in rows:
        for x in cols:
            r, g, b = px[x, y]; mx, mn = max(r, g, b), min(r, g, b)
            if mx > 8: sat.append((mx - mn) / mx)
    out['sat'] = round(sum(sat) / max(1, len(sat)), 3)
    def floor(ya, yb, cs):
        v = sorted(min(px[x, y]) for y in range(ya, yb) for x in cs)
        return v[len(v) // 10] if v else 0
    fn, fl = floor(int(H * 0.82), H, cols), floor(y0 + 2, min(H, y0 + 2 + max(6, (H - y0) // 6)), range(W // 3, 2 * W // 3, 2))
    out.update({'floorNadir': fn, 'floorLimb': fl, 'haze': round(fn / max(1, fl), 3)})
else:
    out['lit'] = round(sum(1 for l in L if l > 40) / n, 4)
    s = sorted(L); out['median'] = round(s[n // 2], 1)
print(json.dumps(out))
