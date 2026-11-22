// ============================================================================
// v0.56 · Klangphysik — two pieces of acoustics for the world's sound, pure (node: test/klangphys.js), used by audio.js:
//
//  1 · VR.KS — plucked strings by physical modelling (Karplus & Strong 1983, with the extensions of Jaffe & Smith 1983):
//      a delay line one period long, filled with a noise burst, fed back through a loss filter. Each pass the averaging
//      filter takes away a little of the highs, so the tone starts bright and mellows as it dies — the way a real string
//      does, and for nothing. Our version:
//        · tuning: the loop's delay is N = sr / f samples; the averaging filter adds half a sample, the integer part is
//          floor(N − ½ − ε) and the rest η is made by a first-order allpass with C = (1 − η) / (1 + η)
//        · decay: a loss factor ρ per pass so the fundamental falls by 60 dB in T60 seconds:
//          ρ = 10^(−3 / (T60 · f)) / |H(f)|, H the two-tap average, |H(f)| = cos(π f / sr)
//        · the pick: the burst is a lowpassed noise (brightness), minus itself β·N samples later — the comb a pick
//          position β along the string makes (the harmonics at multiples of 1/β are missing)
//      Rendered once per pitch and brightness into a buffer (audio.js caches them), so a note costs one buffer source.
//
//  2 · VR.RoomAcoustics — how long a place rings, from the blocks around the ear:
//        · 48 rays in a Fibonacci sphere from the ear, each marched through the blocks up to REACH; where it hits, the
//          face's absorption α (stone, wood, leaves, wool, glass, water); a ray that leaves (the sky, a far opening)
//          counts as an open window, α = 1
//        · Kuttruff's mean free path: in a closed room ℓ̄ = 4V / S — the mean hit distance of the rays gives V / S
//        · Eyring's reverberation time, with the air's absorption m:  T60 = 0.161 V / (−S ln(1 − ᾱ) + 4 m V)
//          = 0.161 · (ℓ̄ / 4) / (−ln(1 − ᾱ) + m ℓ̄)
//      The result picks one of a few synthesized impulses (audio.js): a stone hall rings for seconds, a wooden room
//      briefly, a room with an open door less, a cave booms; soft walls (wool, leaves) also darken the tail.
// ============================================================================
(function (VR) {
  'use strict';

  // ---------------------------------------------------------------- 1 · Karplus–Strong
  const KS = VR.KS = {};
  // o: { dur (s), t60 (s), bright (0…1), pick (β, 0…0.5), seed }
  KS.render = function (f, sr, o) {
    o = o || {};
    const dur = o.dur || 1.6, t60 = o.t60 || 1.2, bright = o.bright === undefined ? 0.6 : o.bright, beta = o.pick === undefined ? 0.13 : o.pick;
    const n = Math.max(1, Math.floor(dur * sr)), out = new Float32Array(n);
    const N = sr / f, Ni = Math.max(2, Math.floor(N - 0.5 - 1e-3)), eta = N - 0.5 - Ni, C = (1 - eta) / (1 + eta);
    const H = Math.cos(Math.PI * f / sr), rho = Math.min(0.99995, Math.pow(10, -3 / (t60 * f)) / Math.max(1e-6, H));
    // the excitation: noise, lowpassed by the brightness, then the pick's comb
    const buf = new Float32Array(Ni);
    let s = (o.seed === undefined ? 0x2545f491 : o.seed) >>> 0, lp = 0;
    const a = 0.08 + 0.9 * bright;
    const ex = new Float32Array(Ni);
    for (let i = 0; i < Ni; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; lp += a * ((s / 2147483648 - 1) - lp); ex[i] = lp; }
    const pd = Math.max(1, Math.round(beta * Ni));
    let mean = 0;
    for (let i = 0; i < Ni; i++) { buf[i] = ex[i] - (i >= pd ? ex[i - pd] : 0); mean += buf[i]; }
    mean /= Ni; let peak = 1e-9;
    for (let i = 0; i < Ni; i++) { buf[i] -= mean; peak = Math.max(peak, Math.abs(buf[i])); }
    for (let i = 0; i < Ni; i++) buf[i] /= peak;
    // the loop: delay Ni, two-tap average (half a sample), allpass (η), loss ρ
    let p = 0, prev = 0, apX = 0, apY = 0;
    for (let i = 0; i < n; i++) {
      const x = buf[p];
      const avg = 0.5 * (x + prev); prev = x;
      const y = C * avg + apX - C * apY; apX = avg; apY = y;   // allpass: y[n] = C x[n] + x[n−1] − C y[n−1]
      const v = rho * y;
      buf[p] = v; out[i] = x;
      p = p + 1 === Ni ? 0 : p + 1;
    }
    // a short fade at the end (no click where the buffer stops)
    const fo = Math.min(n, Math.floor(sr * 0.02));
    for (let i = 0; i < fo; i++) out[n - 1 - i] *= i / fo;
    return out;
  };
  // the pitch a rendered buffer really has (autocorrelation, parabolic peak) — for the tests
  KS.pitchOf = function (x, sr, fMin, fMax) {
    const lo = Math.floor(sr / fMax), hi = Math.ceil(sr / fMin), from = Math.floor(sr * 0.05), len = Math.min(x.length - hi - from, Math.floor(sr * 0.25));
    let best = -Infinity, bl = lo; const r = new Float64Array(hi + 2);
    for (let l = lo; l <= hi + 1; l++) { let acc = 0; for (let i = 0; i < len; i++) acc += x[from + i] * x[from + i + l]; r[l] = acc; if (l <= hi && acc > best) { best = acc; bl = l; } }
    const y0 = r[bl - 1], y1 = r[bl], y2 = r[bl + 1], d = (y0 - y2) / (2 * (y0 - 2 * y1 + y2) || 1);
    return sr / (bl + (isFinite(d) ? d : 0));
  };

  // ---------------------------------------------------------------- 2 · the room
  const RA = VR.RoomAcoustics = {};
  RA.NRAYS = 48; RA.REACH = 48; RA.STEP = 0.4; RA.AIR = 0.0012;   // m: the air's intensity absorption per metre (~1–2 kHz)
  RA.ALPHA = { stone: 0.05, wood: 0.12, soft: 0.45, leaves: 0.3, glass: 0.04, water: 0.02, metal: 0.04, open: 1 };
  RA.T_MIN = 0.25; RA.T_MAX = 4.0;
  const DIRS = new Float64Array(RA.NRAYS * 3);
  (function () { const n = RA.NRAYS; for (let i = 0; i < n; i++) { const y = 1 - (2 * i + 1) / n, r = Math.sqrt(1 - y * y), ph = i * 2.399963229728653; DIRS[i * 3] = Math.cos(ph) * r; DIRS[i * 3 + 1] = y; DIRS[i * 3 + 2] = Math.sin(ph) * r; } })();
  // a block state's acoustic class (cached per state); null: air (the sound passes)
  let cls = null, clsN = 0;
  RA.classOf = function (state) {
    const R = VR.R, F = VR.F;
    if (!state) return null;
    if (!cls || clsN !== R.T.flags.length) { cls = new Int8Array(R.T.flags.length).fill(-2); clsN = R.T.flags.length; }
    let c = cls[state];
    if (c === -2) {
      const fl = R.T.flags[state], t = R.types[R.T.type[state]], nm = (t && t.name) || '';
      if (fl & F.LEAVES) c = 4;
      else if (fl & F.FLUID) c = 6;
      else if (!(fl & (F.SOLID | F.OPAQUE))) c = -1;   // grass, flowers, torches: the sound passes
      else if (/wool|carpet|hay|bed|cushion|sofa|curtain|banner/.test(nm)) c = 2;
      else if (/glass|pane/.test(nm)) c = 5;
      else if (/plank|log|wood|_door|bookshelf|barrel|crate/.test(nm)) c = 1;
      else if (/iron|copper|metal|steel|gold_block/.test(nm)) c = 7;
      else c = 0;
      cls[state] = c;
    }
    return c < 0 ? null : c;
  };
  const AL = [RA.ALPHA.stone, RA.ALPHA.wood, RA.ALPHA.soft, 0, RA.ALPHA.leaves, RA.ALPHA.glass, RA.ALPHA.water, RA.ALPHA.metal];
  // getBlock(x, y, z) → state. → { mfp (m), alpha (mean, open rays included), open (share of rays that left), soft (share
  // of hits on soft surfaces), t60 (s) }
  RA.measure = function (getBlock, ex, ey, ez) {
    const n = RA.NRAYS, step = RA.STEP, reach = RA.REACH;
    let sumD = 0, hits = 0, sumA = 0, open = 0, soft = 0;
    for (let k = 0; k < n; k++) {
      const dx = DIRS[k * 3], dy = DIRS[k * 3 + 1], dz = DIRS[k * 3 + 2];
      let hit = -1, d = 0;
      for (let t = step; t <= reach; t += step) {
        const c = RA.classOf(getBlock(Math.floor(ex + dx * t), Math.floor(ey + dy * t), Math.floor(ez + dz * t)));
        if (c !== null) { hit = c; d = t; break; }
      }
      if (hit < 0) { open++; sumA += RA.ALPHA.open; continue; }
      hits++; sumD += d; sumA += AL[hit]; if (hit === 2 || hit === 4) soft++;
    }
    const mfp = hits ? sumD / hits : reach, alpha = Math.min(0.999, sumA / n);
    return { mfp, alpha, open: open / n, soft: hits ? soft / hits : 0, t60: RA.eyring(mfp, alpha) };
  };
  // Eyring with the air: T60 = 0.161 V / (−S ln(1 − α) + 4 m V), V / S = ℓ̄ / 4 (Kuttruff)
  RA.eyring = function (mfp, alpha) {
    const vs = mfp / 4, t = 0.161 * vs / (-Math.log(1 - Math.min(0.999, alpha)) + 4 * RA.AIR * vs);
    return Math.max(RA.T_MIN, Math.min(RA.T_MAX, t));
  };
  // the impulse class: the reverberation time in steps (the impulses audio.js keeps), darker for soft rooms;
  // null: no room (more than half of the rays leave — the open air)
  RA.BUCKETS = [0.3, 0.5, 0.8, 1.2, 1.8, 2.6, 3.6];
  RA.bucket = function (m) {
    if (!m || m.open > 0.5) return null;
    let b = 0; for (let i = 1; i < RA.BUCKETS.length; i++) if (Math.abs(Math.log(m.t60 / RA.BUCKETS[i])) < Math.abs(Math.log(m.t60 / RA.BUCKETS[b]))) b = i;
    return b * 2 + (m.soft > 0.35 ? 1 : 0);
  };
})(typeof VR !== 'undefined' ? VR : (globalThis.VR = globalThis.VR || {}));
