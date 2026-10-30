# e-music · the score's renders checked (after test/music.mjs wrote test/shots/music/*.wav): per cue a loudness after
# ITU-R BS.1770's K-weighting (the two filters derived for the file's rate, a −70 LUFS absolute and a −10 LU relative
# gate: "LUFS-ish"), the true sample peak, the crest, and a spectrogram (log frequency, dB) beside the waveform's envelope;
# the pictures into test/shots/music/*.png and test/shots/music_sheet.jpg.
#   python3 test/music_check.py          (range: −30 … −12 LUFS-ish at full music bus, no sample above −0.5 dBFS)
# regress: skip  (needs music.mjs's renders)
import os, sys, json, glob, math, subprocess
import numpy as np
from scipy.io import wavfile
from scipy import signal
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
D = os.path.join(ROOT, 'test/shots/music')
fails = 0
def check(ok, msg):
    global fails
    if not ok: fails += 1
    print(('  ✓ ' if ok else '  ✗ ') + msg)

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

files = sorted(glob.glob(os.path.join(D, '*.wav')))
check(len(files) >= 7, '%d renders found in test/shots/music' % len(files))
rows = []; stats = {}
LABEL = {'home_day': 'Heimat (Tag, Stufe 1)', 'home_night': 'Heimat (Nacht: Glocken, langsamer)', 'space_cruise': 'Weite (Orbit / Reise)',
         'adventure_boss3': 'Aufbruch (Boss Phase 3, Stufe 2)', 'wonder_day': 'Staunen (Stich)', 'funke_day': 'Funkes Motiv', 'wander_day': 'Wandern (Tagesplan)',
         'home_day_vl': 'Heimat — Sehr niedrig', 'adventure_boss3_vl': 'Aufbruch — Sehr niedrig'}
for f in files:
    name = os.path.basename(f)[:-4]
    fs, x = wavfile.read(f); x = x.astype(np.float64) / 32768.0
    peak = 20 * math.log10(max(1e-9, np.max(np.abs(x))))
    L = lufs(x, fs); crest = peak - L
    stats[name] = {'lufs': round(L, 1), 'peak': round(peak, 1)}
    check(peak <= -0.5, '%-20s peak %.1f dBFS (≤ −0.5: no clipping)' % (name, peak))
    check(-30 <= L <= -12, '%-20s loudness %.1f LUFS-ish (−30 … −12)' % (name, L))
    # the picture: spectrogram (log f) over the envelope
    mono = x.mean(axis=1)
    fr, tt, S = signal.spectrogram(mono, fs, nperseg=2048, noverlap=1536)
    fig, ax = plt.subplots(2, 1, figsize=(6.2, 3.2), dpi=100, gridspec_kw={'height_ratios': [3, 1]}, facecolor='#101016')
    ax[0].pcolormesh(tt, fr[1:], 10 * np.log10(S[1:] + 1e-12), shading='auto', cmap='magma', vmin=-110, vmax=-30)
    ax[0].set_yscale('log'); ax[0].set_ylim(40, 12000); ax[0].set_ylabel('Hz', color='w', fontsize=7); ax[0].tick_params(colors='w', labelsize=6)
    env = np.sqrt(np.convolve(mono ** 2, np.ones(int(fs * 0.05)) / int(fs * 0.05), mode='same'))
    t2 = np.arange(len(env)) / fs
    ax[1].fill_between(t2[::64], 20 * np.log10(env[::64] + 1e-6), -80, color='#7ad7ff'); ax[1].set_ylim(-60, 0); ax[1].set_xlim(0, t2[-1])
    ax[1].tick_params(colors='w', labelsize=6); ax[1].set_ylabel('dB', color='w', fontsize=7); ax[1].set_xlabel('s', color='w', fontsize=7)
    for a in ax: a.set_facecolor('#101016')
    fig.tight_layout(); png = os.path.join(D, name + '.png'); fig.savefig(png, facecolor='#101016'); plt.close(fig)
    rows.append({'label': '%s · %.1f LUFS-ish · Spitze %.1f dBFS' % (LABEL.get(name, name), L, peak), 'imgs': [png]})
json.dump(stats, open(os.path.join(D, 'loudness.json'), 'w'), indent=1)
# two per row
spec = {'w': 620, 'rows': []}
for i in range(0, len(rows), 2):
    pair = rows[i:i + 2]
    spec['rows'].append({'label': '  |  '.join(r['label'] for r in pair), 'imgs': [p for r in pair for p in r['imgs']]})
sp = os.path.join(D, 'sheet.json'); json.dump(spec, open(sp, 'w'))
subprocess.run(['python3', '/root/r9coord/pairs.py', os.path.join(ROOT, 'test/shots/music_sheet.jpg'), sp], check=False)
print('FAILED %d' % fails if fails else 'ALL OK')
sys.exit(1 if fails else 0)
