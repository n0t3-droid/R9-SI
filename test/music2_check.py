# e-music2 · the richer score's renders checked (after test/music2.mjs wrote test/shots/music2/*.wav): per render the
# loudness (LUFS-ish: BS.1770 K-weighting with its gates, as test/music_check.py), the sample peak, and the TAIL — from the
# cue's last note onset to the last moment its 50 ms envelope is within 40 dB of the render's loudest (≥ 2.5 s: the
# endings ring); spectrograms (log frequency) with the envelope and the last onset marked; the sheet
# test/shots/music2_sheet.jpg; the costs (oscillators a second, render ms) from summary.json.
#   python3 test/music2_check.py
# regress: skip  (needs music2.mjs's renders)
import os, sys, json, math, subprocess
import numpy as np
from scipy.io import wavfile
from scipy import signal
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
D = os.path.join(ROOT, 'test/shots/music2')
fails = 0
def check(ok, msg):
    global fails
    if not ok: fails += 1
    print(('  \u2713 ' if ok else '  \u2717 ') + msg)

def kweight(x, fs):
    # stage 1: the high shelf (+4 dB above ~1.5 kHz), stage 2: the RLB high-pass (~38 Hz) — BS.1770-4's analog prototypes
    f0, G, Q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    K = math.tan(math.pi * f0 / fs); Vh = 10 ** (G / 20); Vb = Vh ** 0.4996667741545416
    a0 = 1 + K / Q + K * K
    b1 = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0]
    a1 = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
    f0, Q = 38.13547087602444, 0.5003270373238773
    K = math.tan(math.pi * f0 / fs)
    a2 = [1, 2 * (K * K - 1) / (1 + K / Q + K * K), (1 - K / Q + K * K) / (1 + K / Q + K * K)]
    b2 = [1, -2, 1]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)

def lufs(x, fs):
    y = kweight(x, fs); n = int(0.4 * fs); hop = int(0.1 * fs)
    blocks = [np.sum(np.mean(y[i:i + n] ** 2, axis=0)) for i in range(0, max(1, len(y) - n), hop)]
    L = np.array([-0.691 + 10 * math.log10(b) if b > 0 else -200 for b in blocks])
    z = np.array(blocks)
    g1 = z[L > -70]
    if not len(g1): return -200
    rel = -0.691 + 10 * math.log10(np.mean(g1)) - 10
    g2 = z[(L > -70) & (L > rel)]
    return -0.691 + 10 * math.log10(np.mean(g2))


LABEL = {'home_t3': 'Heimat A · Hoch', 'home_t2': 'Heimat A · Mittel', 'home_t1': 'Heimat A · Niedrig', 'home_t0': 'Heimat A · Sehr niedrig',
         'home_AB': 'Heimat A+B (Hoch)', 'space_BA': 'Weite B+A (Hoch)', 'boss3_t3': 'Aufbruch Boss 3 · Hoch', 'boss3_t0': 'Aufbruch Boss 3 · Sehr niedrig',
         'wonder': 'Staunen (Stich)', 'funke': 'Funkes Motiv', 'wander': 'Wandern', 'home_moon': 'Heimat auf einem Mond (Glas, trocken)',
         'home_ocker': 'Heimat auf Ocker (Rohrblatt, tief)', 'home_aqua': 'Heimat auf Aquamarin (Tropfen)', 'home_redstar': 'Heimat unter rotem Stern (aeolisch)'}
summ = json.load(open(os.path.join(D, 'summary.json')))
check(len(summ) >= 15, '%d renders in summary.json' % len(summ))
rows = []; stats = {}
for s in summ:
    name = s['name']; f = os.path.join(D, name + '.wav')
    fs, x = wavfile.read(f); x = x.astype(np.float64) / 32768.0
    peak = 20 * math.log10(max(1e-9, np.max(np.abs(x))))
    L = lufs(x, fs)
    mono = x.mean(axis=1)
    w = int(fs * 0.05); env = np.sqrt(np.convolve(mono ** 2, np.ones(w) / w, mode='same')); edb = 20 * np.log10(env + 1e-9)
    above = np.where(edb >= edb.max() - 40)[0]; endT = above[-1] / fs if len(above) else 0
    tail = endT - s['lastOn']
    stats[name] = {'lufs': round(L, 1), 'peak': round(peak, 1), 'tail': round(tail, 2), 'oscPerS': round(s['oscs'] / s['dur'], 1), 'ms': round(s['ms'])}
    check(peak <= -0.5, '%-13s peak %.1f dBFS (no clipping)' % (name, peak))
    check(-30 <= L <= -12, '%-13s loudness %.1f LUFS-ish (-30 … -12)' % (name, L))
    check(tail >= 2.5, '%-13s the ending rings %.2f s after the last onset (≥ 2.5)' % (name, tail))
    fr, tt, S = signal.spectrogram(mono, fs, nperseg=2048, noverlap=1536)
    fig, ax = plt.subplots(2, 1, figsize=(6.2, 3.2), dpi=100, gridspec_kw={'height_ratios': [3, 1]}, facecolor='#101016')
    ax[0].pcolormesh(tt, fr[1:], 10 * np.log10(S[1:] + 1e-12), shading='auto', cmap='magma', vmin=-110, vmax=-30)
    ax[0].set_yscale('log'); ax[0].set_ylim(40, 12000); ax[0].set_ylabel('Hz', color='w', fontsize=7); ax[0].tick_params(colors='w', labelsize=6)
    ax[0].axvline(s['lastOn'], color='#7ad7ff', lw=0.8, ls='--'); ax[0].axvline(s['dur'], color='#ffffff', lw=0.6, ls=':')
    t2 = np.arange(len(env)) / fs
    ax[1].fill_between(t2[::64], edb[::64], -80, color='#7ad7ff'); ax[1].set_ylim(-70, 0); ax[1].set_xlim(0, t2[-1])
    ax[1].axvline(endT, color='#ffcc55', lw=0.8)
    ax[1].tick_params(colors='w', labelsize=6); ax[1].set_ylabel('dB', color='w', fontsize=7); ax[1].set_xlabel('s', color='w', fontsize=7)
    for a in ax: a.set_facecolor('#101016')
    fig.tight_layout(); png = os.path.join(D, name + '.png'); fig.savefig(png, facecolor='#101016'); plt.close(fig)
    rows.append({'label': '%s · %s · %.1f LUFS · Ausklang %.1f s' % (LABEL.get(name, name), s['form'], L, tail), 'imgs': [png]})
json.dump(stats, open(os.path.join(D, 'loudness.json'), 'w'), indent=1)
t0, t3 = stats['home_t0'], stats['home_t3']
print('    cost (Heimat A, oscillators a second · render ms): Very Low %.1f · %d   Low %.1f · %d   Balanced %.1f · %d   High %.1f · %d' % (
    t0['oscPerS'], t0['ms'], stats['home_t1']['oscPerS'], stats['home_t1']['ms'], stats['home_t2']['oscPerS'], stats['home_t2']['ms'], t3['oscPerS'], t3['ms']))
spec = {'w': 620, 'rows': []}
for i in range(0, len(rows), 2):
    pair = rows[i:i + 2]
    spec['rows'].append({'label': '  |  '.join(r['label'] for r in pair), 'imgs': [p for r in pair for p in r['imgs']]})
sp = os.path.join(D, 'sheet.json'); json.dump(spec, open(sp, 'w'))
subprocess.run(['python3', '/root/r9coord/pairs.py', os.path.join(ROOT, 'test/shots/music2_sheet.jpg'), sp], check=False)
print('FAILED %d' % fails if fails else 'ALL OK')
sys.exit(1 if fails else 0)
