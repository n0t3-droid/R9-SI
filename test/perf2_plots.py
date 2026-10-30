# e-perf2: the hitch gate's graphs (test/hitch_gate.mjs → test/shots/hitch_gate_<TAG>.json) and the sheet
# test/shots/perf2_sheet.jpg (python3 /root/r9coord/pairs.py).
# usage: python3 test/perf2_plots.py <label>=<json> [<label>=<json> …]   (e.g. run1=…/hitch_gate_run1.json)
import sys, json, os, subprocess
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SH = os.path.join(ROOT, 'test', 'shots')
C = {'base': '#c0504d', 'head': '#2f7ed8'}
NAME = {'potato': 'Sehr niedrig', 'balanced': 'Ausgewogen'}
rows = []
for arg in sys.argv[1:]:
    lab, src = arg.split('=', 1)
    d = json.load(open(src))
    for preset in ('potato', 'balanced'):
        runs = [r for r in d['runs'] if r['preset'] == preset]
        if not runs: continue
        S = (d.get('sum') or {}).get(preset)
        # 1. the frames of every round, one after the other (the builds flown in turns, frame by frame)
        fig, ax = plt.subplots(figsize=(9.6, 3.3), dpi=110)
        off = 0
        for r in runs:
            for b in ('base', 'head'):
                ms = [f[0] for f in r['builds'][b]['fr']]
                ax.plot(range(off, off + len(ms)), ms, color=C[b], lw=0.9, alpha=0.85, label=None if r is not runs[0] else f"{d[b]}")
            off += len(r['builds']['base']['fr']) + 8
            ax.axvline(off - 4, color='#888', lw=0.6, ls=':')
        bm = [r['builds']['base']['med'] for r in runs]
        top = max(60, min(400, max(max(f[0] for f in r['builds'][b]['fr']) for r in runs for b in ('base', 'head')) * 1.05))
        ax.set_ylim(0, top); ax.grid(alpha=0.25)
        t = f"{lab} · {NAME[preset]}: Hauptthread pro Bild (JS + Worker-Antworten), {len(runs)} Runden im Wechsel"
        if S: t += f"\nMedian {S['base']['med']} → {S['head']['med']} ms (× {S['ratio']}) · p99 {S['base']['p99']} → {S['head']['p99']} · Ruckler {S['base']['hitches']} → {S['head']['hitches']}"
        ax.set_title(t, fontsize=9); ax.set_xlabel('Bild (Runden hintereinander)'); ax.set_ylabel('ms')
        ax.legend(fontsize=8, loc='upper right')
        p1 = os.path.join(SH, f'perf2_{lab}_{preset}_frames.png'); fig.tight_layout(); fig.savefig(p1); plt.close(fig)
        # 2. the frames sorted (all rounds): the tail is the hitches
        fig, ax = plt.subplots(figsize=(4.6, 3.3), dpi=110)
        for b in ('base', 'head'):
            ms = sorted(f[0] for r in runs for f in r['builds'][b]['fr'])
            n = len(ms)
            ax.plot([100 * i / n for i in range(n)], ms, color=C[b], lw=1.4, label=d[b])
        ax.set_xlim(80, 100); ax.set_ylim(0, top); ax.grid(alpha=0.25)
        ax.set_title(f'{NAME[preset]}: die langsamsten 20 % der Bilder', fontsize=9); ax.set_xlabel('Perzentil'); ax.set_ylabel('ms'); ax.legend(fontsize=8)
        p2 = os.path.join(SH, f'perf2_{lab}_{preset}_tail.png'); fig.tight_layout(); fig.savefig(p2); plt.close(fig)
        rows.append({'label': f'{lab} · {NAME[preset]}: {d["base"]} (rot) | {d["head"]} (blau) — Bild für Bild, und das Ende der Verteilung', 'imgs': [p1, p2]})
        shots = next((r['shots'] for r in runs if r.get('shots') and len(r['shots']) == 2), None)
        if shots: rows.append({'label': f'{lab} · {NAME[preset]}: dieselbe Sicht am Ende des Flugs — {d["base"]} | {d["head"]}', 'imgs': shots})
spec = os.path.join(SH, 'perf2_sheet.json')
json.dump({'w': 620, 'rows': rows}, open(spec, 'w'))
out = os.path.join(SH, 'perf2_sheet.jpg')
subprocess.run(['python3', '/root/r9coord/pairs.py', out, spec], check=True)
print(out)
