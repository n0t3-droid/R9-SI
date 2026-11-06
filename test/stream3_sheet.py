# p-stream3 · the sheet of test/stream_low.mjs (before = v0.55.40, after = p-stream3): charts from its measurements
# (.tmp_tests/stream_low.json) above its pictures, German captions — the 80 m/s flights over 30 s, the walk's time until
# land coming into view is there, the stand-in up close (fine 2-block tiles, then the chunks, before and after), the
# moment a flight stopped.
#   python3 test/stream3_sheet.py [.tmp_tests/stream_low.json]  →  test/shots/stream3_sheet.jpg
import sys, json, os, subprocess
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '.tmp_tests/stream_low.json')
D = json.load(open(src))
SH = os.path.join(ROOT, 'test/shots'); TMP = os.path.join(ROOT, '.tmp_tests')
NAME = {'low': 'Niedrig', 'potato': 'Sehr niedrig'}
COL = {'before': '#9a9aa6', 'after': '#2f7de1'}
LAB = {'before': 'vorher (v0.55.40)', 'after': 'nachher (p-stream3)'}
def fig():
    f, ax = plt.subplots(figsize=(6.2, 3.3), dpi=100)
    ax.spines[['top', 'right']].set_visible(False); ax.grid(axis='y', color='#e4e4ea', lw=0.8)
    return f, ax
charts = []
for preset in ['low', 'potato']:
    f, ax = fig()
    for b in ['before', 'after']:
        r = D.get(f'{preset}_80_{b}')
        if not r: continue
        t = [x['t'] for x in r['rec']]; y = [100 * x['real'] for x in r['rec']]
        ax.plot(t, y, color=COL[b], lw=2, label=f"{LAB[b]}: Ø {r['out']['real']} %")
    ax.axhline(80, color='#d9534f', lw=1, ls=':'); ax.text(0.3, 81.5, 'Ziel 80 %', color='#d9534f', fontsize=8)
    ax.set_ylim(0, 102); ax.set_xlabel('Flugzeit (s)'); ax.set_ylabel('echtes Land voraus (%)')
    ax.set_title(f'{NAME[preset]} · 80 m/s: Anteil echter Chunks im Blickfeld', fontsize=10, loc='left')
    ax.legend(frameon=False, fontsize=9, loc='lower right'); f.tight_layout()
    p = os.path.join(TMP, f'chart3_{preset}_80.png'); f.savefig(p); plt.close(f); charts.append(p)
f, ax = fig(); xs = []; i = 0
for preset in ['low', 'potato']:
    for b in ['before', 'after']:
        r = D.get(f'{preset}_5_{b}')
        if not r: continue
        o = r['out']; ax.bar(i, o['ttvP90'] / 1000, color=COL[b], width=0.8); ax.bar(i, o['ttvMed'] / 1000, color='#1b1b22', width=0.3)
        ax.text(i, o['ttvP90'] / 1000 + 0.04, f"{o['ttvP90'] / 1000:.2f} s · {o['entered']} Sp.", ha='center', fontsize=8); xs.append((i, f"{NAME[preset]}\n{LAB[b].split(' ')[0]}")); i += 1
    i += 0.6
ax.axhline(1, color='#d9534f', lw=1, ls=':')
ax.set_xticks([x for x, _ in xs], [l for _, l in xs], fontsize=8); ax.set_ylabel('Sekunden (Balken p90, Strich Median)')
ax.set_title('Gehen 5 m/s: bis Land, das in den Blick kommt, fertig ist', fontsize=10, loc='left'); f.tight_layout()
p1 = os.path.join(TMP, 'chart3_walk.png'); f.savefig(p1); plt.close(f)
f, ax = fig(); xs = []; i = 0
for preset in ['low', 'potato']:
    for b in ['before', 'after']:
        r = D.get(f'{preset}_80_{b}')
        if not r or not r['out'].get('jobs'): continue
        J = r['out']['jobs']; ms = lambda k: float(J.get(k, '0× 0 ms').split('× ')[1].split(' ')[0]) / 1000
        g, m, l = ms('gen'), ms('mesh'), ms('lod')
        ax.bar(i, g, color='#6b8e23', width=0.8); ax.bar(i, m, bottom=g, color=COL[b], width=0.8); ax.bar(i, l, bottom=g + m, color='#e0a040', width=0.8)
        ax.text(i, g + m + l + 0.2, f"{g + m + l:.1f} s", ha='center', fontsize=8); xs.append((i, f"{NAME[preset]}\n{LAB[b].split(' ')[0]}")); i += 1
    i += 0.6
ax.set_xticks([x for x, _ in xs], [l for _, l in xs], fontsize=8); ax.set_ylabel('Worker-Sekunden in 30 s')
ax.set_title('Flug 80 m/s: Arbeit des Workers (grün Erzeugen, Mitte Meshes, orange Fernkacheln)', fontsize=9, loc='left'); f.tight_layout()
p2 = os.path.join(TMP, 'chart3_work.png'); f.savefig(p2); plt.close(f)
rows = [
    {'label': '80 m/s · echtes Land im Blickfeld über 30 s (grau vorher, blau nachher; ein Worker, SLOW 3) — links Niedrig, rechts Sehr niedrig', 'imgs': charts},
    {'label': 'Gehen: Zeit bis neues Land im Blick fertig ist (Sp. = Spalten, die noch nicht da waren) · Schnellflug: wofür der Worker arbeitet', 'imgs': [p1, p2]},
]
for preset in ['low', 'potato']:
    for b in ['before', 'after']:
        x = D.get(f'fine_{preset}_{b}')
        if not x: continue
        rows.append({'label': f"{NAME[preset]} · {LAB[b]}: Ersatz aus feinen 2-Block-Kacheln (links, Chunks zurückgehalten) und dieselbe Sicht mit den Chunks (rechts)", 'imgs': [x['fine'], x['real']]})
for preset in ['low', 'potato']:
    for v in [80]:
        s = [D.get(f'shot_{preset}_{v}_{b}') for b in ['before', 'after']]
        if not all(s): continue
        cap = ' | '.join(f"{'vorher' if b == 'before' else 'nachher'}: echt {round(100 * (x.get('real') or 0))} %, fein {round(100 * (x.get('fine') or 0))} %" for b, x in zip(['before', 'after'], s))
        rows.append({'label': f'{NAME[preset]} · {v} m/s, Bild nach 12 s im Moment des Anhaltens ({cap})', 'imgs': [x['shot'] for x in s]})
spec = os.path.join(TMP, 'stream3_sheet_full.json'); json.dump({'w': 620, 'rows': rows}, open(spec, 'w'))
subprocess.run(['python3', '/root/r9coord/pairs.py', os.path.join(SH, 'stream3_sheet.jpg'), spec], check=True)
