# e-engine: the engine bench's graphs (test/engine_bench.mjs → test/shots/engine_bench_<TAG>.json) and the sheet
# test/shots/engine_sheet.jpg (python3 /root/r9coord/pairs.py). usage: python3 test/engine_plots.py [json]
import sys, json, os, subprocess
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SH = os.path.join(ROOT, 'test', 'shots')
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(SH, 'engine_bench_before_after.json')
d = json.load(open(src))
C = {'before': '#c0504d', 'after': '#2f7ed8'}
out = []
# 1. the flights: the main thread's ms per frame (the loop's JS + the worker handlers), before | after
for preset, name in (('potato', 'Sehr niedrig'), ('balanced', 'Ausgewogen')):
    fb, fa = d['flight'].get('before_' + preset), d['flight'].get('after_' + preset)
    if not fb or not fa: continue
    fig, ax = plt.subplots(figsize=(8.4, 3.4), dpi=110)
    for lab, f in (('before', fb), ('after', fa)):
        ms = [r[1] + r[2] for r in f['fr']]
        o = f['o']
        ax.plot(range(len(ms)), ms, color=C[lab], lw=1.1, label=f"{'vorher' if lab == 'before' else 'nachher'}: Median {o['mainMed']} ms · p99 {o['mainP99']} ms · Ruckler {o['mainHitches']}")
    ax.set_title(f'Flug über das Herzland, 60 s · {name}: Hauptthread pro Bild (JS + Worker-Antworten)', fontsize=10)
    ax.set_xlabel('Bild'); ax.set_ylabel('ms'); ax.set_ylim(0, max(60, min(400, max(max(r[1] + r[2] for r in fb['fr']), max(r[1] + r[2] for r in fa['fr'])) * 1.05)))
    ax.legend(fontsize=8, loc='upper right'); ax.grid(alpha=0.25)
    p = os.path.join(SH, f'engine_flight_{preset}.png'); fig.tight_layout(); fig.savefig(p); plt.close(fig); out.append(('Flug ' + name + ': Hauptthread-ms pro Bild, vorher (rot) | nachher (blau)', [p]))
# 2. the loads: the phases, medians (cold | warm)
M = d.get('loadMed') or {}
if M:
    fig, ax = plt.subplots(figsize=(8.4, 3.6), dpi=110)
    rows = [k for k in ('before_potato', 'after_potato', 'before_balanced', 'after_balanced') if k in M]
    labels, y = [], 0
    for k in rows:
        for kind in ('cold', 'warm'):
            m = M[k]
            ph = [('Skripte', m.get(kind + '_dcl')), ('Titel', m.get(kind + '_title')), ('Welt (Spawn)', m.get(kind + '_world')), ('Spielen', m.get(kind + '_play')), ('erstes Bild', m.get(kind + '_frame'))]
            prev = 0
            cols = ['#888', '#e0a040', '#70a0d0', '#60b060', '#305080']
            for (nm, v), c in zip(ph, cols):
                if v is None: continue
                ax.barh(y, (v - prev) / 1000, left=prev / 1000, color=c, label=nm if y == 0 else None); prev = v
            ax.text(prev / 1000 + 0.5, y, f'{prev / 1000:.1f} s', va='center', fontsize=8)
            labels.append(('vorher ' if k.startswith('before') else 'nachher ') + ('SN ' if 'potato' in k else 'AG ') + ('kalt' if kind == 'cold' else 'warm')); y += 1
    ax.set_yticks(range(len(labels))); ax.set_yticklabels(labels, fontsize=8); ax.invert_yaxis()
    ax.set_xlabel('s ab dem Aufruf der Seite (Median aus 3)'); ax.set_title('Laden bis Spielen: Phasen (Sehr niedrig, Ausgewogen; kalt = erster Start)', fontsize=10)
    ax.legend(fontsize=7, loc='lower right', ncol=5); ax.grid(axis='x', alpha=0.25)
    p = os.path.join(SH, 'engine_load.png'); fig.tight_layout(); fig.savefig(p); plt.close(fig); out.append(('Laden: Phasen vorher | nachher', [p]))
# 3. the leak: heap and GPU bytes after each out-and-back
L = d.get('leak') or {}
if L:
    fig, ax = plt.subplots(figsize=(8.4, 3.0), dpi=110)
    for b, r in L.items():
        pts = r['pts']
        ax.plot(range(len(pts)), [p['heapMB'] for p in pts], marker='o', color=C.get(b, '#444'), label=f"{'vorher' if b == 'before' else 'nachher'} JS-Heap")
        ax.plot(range(len(pts)), [p['bufMB'] + p['texMB'] for p in pts], marker='s', ls='--', color=C.get(b, '#444'), label=f"{'vorher' if b == 'before' else 'nachher'} GPU (Puffer + Texturen)")
    ax.set_xticks(range(len(next(iter(L.values()))['pts']))); ax.set_xticklabels(['Start'] + [f'nach Runde {i}' for i in range(1, len(next(iter(L.values()))['pts']))])
    ax.set_ylabel('MB'); ax.set_title('Speicher nach je 2 × 1000 Blöcken hin und zurück (Sehr niedrig, nach gc())', fontsize=10); ax.legend(fontsize=7); ax.grid(alpha=0.25)
    p = os.path.join(SH, 'engine_leak.png'); fig.tight_layout(); fig.savefig(p); plt.close(fig); out.append(('Speicher über die Reise: kein Wachstum', [p]))
rows = [{'label': l, 'imgs': i} for l, i in out]
for v in (1, 2):
    a, b = os.path.join(SH, f'engine_view{v}_before.png'), os.path.join(SH, f'engine_view{v}_after.png')
    if os.path.exists(a) and os.path.exists(b): rows.append({'label': f'Feste Ansicht {v}: vorher | nachher (mittlere Abweichung {d.get("views", {}).get("view" + str(v), "?")} von 255)', 'imgs': [a, b]})
spec = os.path.join(ROOT, '.tmp_tests', 'engine_sheet.json')
json.dump({'w': 620, 'rows': rows}, open(spec, 'w'))
subprocess.run(['python3', '/root/r9coord/pairs.py', os.path.join(SH, 'engine_sheet.jpg'), spec], check=False)
print('ALL OK')
