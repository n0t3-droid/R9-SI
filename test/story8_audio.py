# a-story8 · the music's renders checked (after test/story8.mjs's audio section wrote test/shots/story8_audio/*.wav):
# the loudness (score2_check.py's LUFS-ish, BS.1770 K-weighting with its gates), the peak, spectrograms; the waltz's
# loudness against e-score2's -31 LUFS (target: about -24 like the others); then test/shots/story8_sheet.jpg with the
# pictures (.tmp_tests/story8_sheet.json) and a row of spectrograms.
#   python3 test/story8_audio.py
# regress: skip  (needs story8.mjs's renders)
import os, json, math, subprocess
import numpy as np
from scipy.io import wavfile
from scipy import signal
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
D = os.path.join(ROOT, 'test/shots/story8_audio')
src = open(os.path.join(ROOT, 'test/score2_check.py')).read()
exec(src[src.index('def kweight'):src.index('LABEL = ')])   # kweight, lufs (score2_check.py's own)
fails = 0
def check(ok, msg):
    global fails
    if not ok: fails += 1
    print(('  ✓ ' if ok else '  ✗ ') + msg)
summ = json.load(open(os.path.join(D, 'summary.json')))
stats = {}; specs = []
for s in summ:
    name = s['name']; fs, x = wavfile.read(os.path.join(D, name + '.wav')); x = x.astype(np.float64) / 32768.0
    peak = 20 * math.log10(max(1e-9, np.max(np.abs(x)))); L = lufs(x, fs); mono = x.mean(axis=1)
    stats[name] = {'lufs': round(L, 1), 'peak': round(peak, 1), 'oscPerS': round(s['oscs'] / s['dur'], 1)}
    print('    %-9s %5.1f LUFS-ish  peak %5.1f dBFS  %4.1f osc/s  %s' % (name, L, peak, s['oscs'] / s['dur'], s['form']))
    check(peak <= -0.5, name + ' no clipping')
    if name in ('waltz', 'waltz_B', 'st_wide', 'p_zinn_B'):
        fr, tt, S = signal.spectrogram(mono, fs, nperseg=2048, noverlap=1536)
        fig, ax = plt.subplots(1, 1, figsize=(6.2, 2.4), dpi=100, facecolor='#101016')
        ax.pcolormesh(tt, fr[1:], 10 * np.log10(S[1:] + 1e-12), shading='auto', cmap='magma', vmin=-110, vmax=-30)
        ax.set_yscale('log'); ax.set_ylim(40, 12000); ax.tick_params(colors='w', labelsize=6)
        ax.set_title('%s · %.0f LUFS' % (name, L), color='w', fontsize=8)
        fig.tight_layout(); png = os.path.join(D, name + '.png'); fig.savefig(png, facecolor='#101016'); plt.close(fig); specs.append(png)
json.dump(stats, open(os.path.join(D, 'loudness.json'), 'w'), indent=1)
w = stats.get('waltz', {}).get('lufs', -99)
check(w >= -28, 'the Mondstein waltz fuller: %.1f LUFS-ish (e-score2: -31)' % w)
check(all(-34 <= stats[n]['lufs'] <= -14 for n in stats if n.startswith('st_')), 'the story cues in range: ' + ', '.join('%s %.0f' % (n, stats[n]['lufs']) for n in stats if n.startswith('st_')))
sp = os.path.join(ROOT, '.tmp_tests/story8_sheet.json')
if os.path.exists(sp):
    spec = json.load(open(sp)); spec['rows'].append({'label': 'Musik: Mondsteinwalzer A · mit B-Teil · Wiegelinds Stich (weit) · Funkelweise mit B-Teil', 'imgs': specs})
    json.dump(spec, open(sp, 'w'))
    subprocess.run(['python3', '/root/r9coord/pairs.py', os.path.join(ROOT, 'test/shots/story8_sheet.jpg'), sp], check=False)
    print('    sheet test/shots/story8_sheet.jpg')
print('FAILED %d' % fails if fails else 'ALL OK')
