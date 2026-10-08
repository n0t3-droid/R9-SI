# regress: skip — the F1 comparison sheet (not a test): the trailer, v0.41 and this build side by side, one row per
# weather scene of test/atmosphere.mjs. Pictures: v0.41's reference shots (the v041 worktree), this checkout's
# test/shots/<prefix><scene>.png (atmosphere.mjs writes atmo_<scene>.png; test/f1_look.mjs <tag>_<variant>_<scene>.png).
#   python3 test/f1_sheet.py <out.jpg> [prefix, default atmo_] [label, default "F1 Licht & Luft"] [ref dir]
import sys, os
from PIL import Image, ImageDraw, ImageFont
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.dirname(here)
out = sys.argv[1]
prefix = sys.argv[2] if len(sys.argv) > 2 else 'atmo_'
label = sys.argv[3] if len(sys.argv) > 3 else 'F1 Licht & Luft'
refdir = sys.argv[4] if len(sys.argv) > 4 else os.path.join(os.path.dirname(root), 'v041', 'test', 'shots')
rows = [('klar', 'klar', 't1_01.jpg'), ('bewoelkt', 'bewölkt', 't3_02.jpg'), ('nebel', 'Nebel', None), ('regen', 'Regen', None), ('gewitter', 'Gewitter', None), ('schnee', 'Schnee', None)]
W, H, PAD, TOP = 440, 248, 8, 22
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
except Exception:
    font = ImageFont.load_default()
sheet = Image.new('RGB', (3 * W + 4 * PAD, len(rows) * (H + TOP + PAD) + PAD), (12, 12, 16))
d = ImageDraw.Draw(sheet)
def put(path, x, y, cover=False):
    try:
        im = Image.open(path).convert('RGB')
        if cover:   # the trailer's frame is wider: crop to 16:9 around its centre
            w, h = im.size; tw = int(h * W / H)
            if tw < w: im = im.crop(((w - tw) // 2, 0, (w - tw) // 2 + tw, h))
        sheet.paste(im.resize((W, H), Image.LANCZOS), (x, y))
    except Exception:
        d.rectangle([x, y, x + W, y + H], fill=(24, 24, 30))
        d.text((x + 10, y + 10), 'kein Bild', fill=(140, 140, 150), font=font)
for r, (key, word, trailer) in enumerate(rows):
    y = PAD + r * (H + TOP + PAD)
    cols = [('Trailer · ' + word, os.path.join(root, 'docs', 'trailer', 'frames', trailer) if trailer else None, True),
            ('Vorher (v0.41) · ' + word, os.path.join(refdir, 'atmo_' + key + '.png'), False),
            ('Nachher (' + label + ') · ' + word, os.path.join(root, 'test', 'shots', prefix + key + '.png'), False)]
    for c, (title, path, cover) in enumerate(cols):
        x = PAD + c * (W + PAD)
        d.text((x + 2, y + 4), title, fill=(225, 225, 232), font=font)
        put(path or '', x, y + TOP, cover)
sheet.save(out, quality=88)
print('wrote', out, sheet.size)
