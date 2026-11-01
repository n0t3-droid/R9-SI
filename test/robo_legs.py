# x-robo · draws .tmp_tests/robo_legs.json (test/robo_legs.js) → test/shots/robo_legs.png: a villager's legs walking up
# a half-block stair, every 6th frame of 2.4 s, before (the flat-ground walk over the stepped body) and after (planted)
# usage: python3 test/robo_legs.py
import json, os
from PIL import Image, ImageDraw
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = json.load(open(os.path.join(root, '.tmp_tests', 'robo_legs.json')))
W, H, S = 620, 380, 130          # panel size, pixels a block
X0, Y0 = -1.9, 80.6              # the world's corner at the panel's bottom left
def P(x, y): return (int((x - X0) * S), int(H - (y - Y0) * S))
panels = []
for key, title in (('before', 'before: walk as on flat ground'), ('after', 'after: feet planted (x-robo)')):
    im = Image.new('RGB', (W, H), (246, 244, 238)); d = ImageDraw.Draw(im)
    pts = [P(x, y) for x, y in D['prof']]
    d.polygon(pts + [P(D['prof'][-1][0], Y0), P(D['prof'][0][0], Y0)], fill=(170, 150, 120))
    d.line(pts, fill=(90, 70, 50), width=2)
    for i, f in enumerate(D[key]):
        if i % 6: continue
        for s, col in (('l', (40, 90, 200)), ('r', (230, 120, 30))):
            L = f['legs'][s]; d.line([P(*L[0]), P(*L[1]), P(*L[2])], fill=col, width=3)
            fx, fy = P(*L[2]); d.ellipse([fx - 3, fy - 3, fx + 3, fy + 3], fill=col)
    d.line([P(f['x'], f['legs']['l'][0][1]) for f in D[key]], fill=(120, 120, 120), width=1)
    st = D['stats'][key]
    d.text((10, 8), f"{title}", fill=(20, 20, 20))
    d.text((10, 24), f"carrying foot off its tread: mean {st[0]:.3f} b, worst {st[1]:.3f} b", fill=(20, 20, 20))
    panels.append(im)
out = Image.new('RGB', (W * 2 + 10, H), 'white'); out.paste(panels[0], (0, 0)); out.paste(panels[1], (W + 10, 0))
os.makedirs(os.path.join(root, 'test', 'shots'), exist_ok=True)
out.save(os.path.join(root, 'test', 'shots', 'robo_legs.png')); print('test/shots/robo_legs.png')
