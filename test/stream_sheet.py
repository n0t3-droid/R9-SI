# p-stream · the sheet of test/stream_low.mjs: charts from its measurements (.tmp_tests/stream_low.json) above its pictures,
# German captions. The pictures are drawn a few seconds after the flight stopped (a software frame costs seconds here, the
# workers go on loading meanwhile), so the charts carry the mid-flight state.
#   python3 test/stream_sheet.py [.tmp_tests/stream_low.json]  →  test/shots/stream_sheet.jpg
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
LAB = {'before': 'vorher (v042)', 'after': 'nachher'}
def fig():
    f, ax = plt.subplots(figsize=(6.2, 3.3), dpi=100)
    ax.spines[['top', 'right']].set_visible(False); ax.grid(axis='y', color='#e4e4ea', lw=0.8)
    return f, ax
charts = []
for preset in ['low', 'potato']:
    for v in [40, 80]:
        f, ax = fig()
        for b in ['before', 'after']:
            r = D.get(f'{preset}_{v}_{b}')
            if not r: continue
            t = [x['t'] for x in r['rec']]; y = [100 * x['real'] for x in r['rec']]
            ax.plot(t, y, color=COL[b], lw=2, label=f"{LAB[b]}: Ø {r['out']['real']} %")
        ax.set_ylim(0, 102); ax.set_xlabel('Flugzeit (s)'); ax.set_ylabel('echtes Land voraus (%)')
        ax.set_title(f'{NAME[preset]} · {v} m/s: Anteil echter Chunks im Blickfeld', fontsize=10, loc='left')
        ax.legend(frameon=False, fontsize=9, loc='lower right'); f.tight_layout()
        p = os.path.join(TMP, f'chart_{preset}_{v}.png'); f.savefig(p); plt.close(f); charts.append(p)
# walking: time until a column coming into view is there; 80 m/s: columns made and never shown
f, ax = fig(); xs = []; i = 0
for preset in ['low', 'potato']:
    for b in ['before', 'after']:
        r = D.get(f'{preset}_5_{b}')
        if not r: continue
        o = r['out']; ax.bar(i, o['ttvP90'] / 1000, color=COL[b], width=0.8); ax.bar(i, o['ttvMed'] / 1000, color='#1b1b22', width=0.3)
        ax.text(i, o['ttvP90'] / 1000 + 0.05, f"{o['ttvP90'] / 1000:.1f} s", ha='center', fontsize=9); xs.append((i, f"{NAME[preset]}\n{LAB[b].split(' ')[0]}")); i += 1
    i += 0.6
ax.set_xticks([x for x, _ in xs], [l for _, l in xs], fontsize=8); ax.set_ylabel('Sekunden (Balken p90, Strich Median)')
ax.set_title('Gehen 5 m/s: bis neues Land im Blick fertig ist', fontsize=10, loc='left'); f.tight_layout()
p1 = os.path.join(TMP, 'chart_walk.png'); f.savefig(p1); plt.close(f)
f, ax = fig(); xs = []; i = 0
for preset in ['low', 'potato']:
    for b in ['before', 'after']:
        r = D.get(f'{preset}_80_{b}')
        if not r: continue
        o = r['out']; ax.bar(i, o['gen'], color=COL[b], width=0.8); ax.bar(i, o['wasted'], color='#d9534f', width=0.8)
        ax.text(i, o['gen'] + 20, f"{o['wasted']} / {o['gen']}", ha='center', fontsize=9); xs.append((i, f"{NAME[preset]}\n{LAB[b].split(' ')[0]}")); i += 1
    i += 0.6
ax.set_xticks([x for x, _ in xs], [l for _, l in xs], fontsize=8); ax.set_ylabel('Spalten in 30 s (rot: nie gezeigt)')
ax.set_title('Flug 80 m/s: erzeugte Spalten, davon umsonst', fontsize=10, loc='left'); f.tight_layout()
p2 = os.path.join(TMP, 'chart_waste.png'); f.savefig(p2); plt.close(f)
rows = [
    {'label': 'Niedrig · Flug 40 und 80 m/s — echtes Land im Blickfeld über 30 s (grau vorher, blau nachher)', 'imgs': charts[0:2]},
    {'label': 'Sehr niedrig · Flug 40 und 80 m/s — echtes Land im Blickfeld über 30 s', 'imgs': charts[2:4]},
    {'label': 'Gehen: Land am Rand ist früher fertig · Schnellflug: weniger Arbeit umsonst', 'imgs': [p1, p2]},
]
for preset in ['low', 'potato']:
    for v in [40, 80]:
        s = [D.get(f'shot_{preset}_{v}_{b}') for b in ['before', 'after']]
        if not all(s): continue
        cap = ' | '.join(f"{'vorher' if b == 'before' else 'nachher'}: echt {round(100 * (x.get('real') or 0))} %" for b, x in zip(['before', 'after'], s))
        rows.append({'label': f'{NAME[preset]} · {v} m/s, Bild nach 12 s ({cap} beim Anhalten; gezeichnet Sekunden später)', 'imgs': [x['shot'] for x in s]})
spec = os.path.join(TMP, 'stream_sheet_full.json'); json.dump({'w': 620, 'rows': rows}, open(spec, 'w'))
subprocess.run(['python3', '/root/r9coord/pairs.py', os.path.join(SH, 'stream_sheet.jpg'), spec], check=True)
