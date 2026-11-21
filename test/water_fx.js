// t-material · the trailer's water (plan docs/superpowers/plans/2026-10-15-t-material.md, step 7), no browser:
//  a · the colour by depth (water_fx.js): the floor seen through the water loses its red first (turquoise shallows), the
//      water's own colour turns from turquoise to deep blue
//  b · the shore-distance mask: solid foam at the bank, broken by the noise further out, none past a block and a half
//  c · the crests' foam: on high crests of a rough water only
//  d · the caustics: a light network (a small share of bright lines), animated; their cost tier (sines a pixel: none on
//      Very Low, 8 on tier 1, 12 on tier 2)
//  e · the shader: the GLSL is generated from the same table, it sits behind #ifndef LITE — Very Low's water program is the
//      same as before (none of it after the preprocessor)
//  f · the switch: the Wasser slider (0 · 1 · 2) in the settings with its texts, the presets' tiers
//   bash test/wt_run.sh water_fx.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
require('../src/main/water_fx.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const FX = V.WaterFx, r3 = (a) => a.map(v => v.toFixed(2)).join(', ');

console.log('a · the colour by depth');
{
  const t05 = FX.absorb(0.5), t3 = FX.absorb(3), t10 = FX.absorb(10);
  console.log(`     the floor's light through 0.5 / 3 / 10 blocks: (${r3(t05)}) · (${r3(t3)}) · (${r3(t10)})`);
  check(t05[0] > 0.75 && t05[1] > 0.95, 'half a block of water hardly dims the floor (the sand shows)');
  check(t3[0] < 0.3 && t3[1] > 0.75 && t3[2] > 0.8, 'through three blocks the red is mostly gone: the floor turns turquoise');
  check(t10[0] < 0.02 && t10[2] > t10[1] && t10[1] > 0.4, 'through ten the blue stays longest');
  const s = FX.tint(0.5), d = FX.tint(15);
  console.log(`     the water's own colour at 0.5 / 15 blocks: (${r3(s)}) · (${r3(d)})`);
  check(s[1] > s[0] * 5 && s[2] > s[0] * 5 && Math.abs(s[1] - s[2]) < 0.15, 'the shallows are turquoise (green ≈ blue ≫ red)');
  check(d[2] > d[1] * 1.8 && d[1] > d[0], 'the depth is deep blue');
}

console.log('b · the shore-distance mask');
{
  const frac = (d) => { let n = 0; for (let i = 0; i < 1000; i++) if (FX.shore(d, i / 999) > 0.5) n++; return n / 1000; };
  const f0 = frac(0), f04 = frac(0.4), f08 = frac(0.8), f14 = frac(1.4);
  console.log(`     foam over the noise at 0 / 0.4 / 0.8 / 1.4 blocks deep: ${f0.toFixed(2)} · ${f04.toFixed(2)} · ${f08.toFixed(2)} · ${f14.toFixed(2)}`);
  check(f0 >= 0.4 && f0 <= 0.65, 'at the bank about half the noise foams: a broken line, never a solid white band (run 2: the river\'s banks looked snowed in)');
  check(f04 < f0 * 0.5 && f08 === 0, 'further out it breaks up fast and is gone by 0.6 deep (v0.55.92: shallow lakes and rivers foamed all over)');
  check(f14 === 0 && FX.shore(2, 1) === 0, 'past a block and a half there is none');
}

console.log('c · the crests');
{
  check(FX.crest(0.95, 1.6, 0.9) > 0.8, 'a high crest of a rough body foams', FX.crest(0.95, 1.6, 0.9).toFixed(2));
  check(FX.crest(0.2, 1.6, 0.9) === 0 && FX.crest(-0.8, 2, 1) === 0, 'the slopes and the troughs do not');
  check(FX.crest(0.95, 0.3, 0.9) === 0, 'a calm pond does not');
}

console.log('d · the caustics');
{
  const stats = (oct, t) => { let n = 0, br = 0, sum = 0; for (let z = 0; z < 60; z += 0.25) for (let x = 0; x < 60; x += 0.25) { const c = FX.caustic(x, z, t, oct); sum += c; n++; if (c > 0.35) br++; } return { mean: sum / n, bright: br / n }; };
  const s1 = stats(2, 0), s2 = stats(3, 0), s2b = stats(3, 2.5);
  console.log(`     tier 1: mean ${s1.mean.toFixed(3)}, bright ${(s1.bright * 100).toFixed(1)} % · tier 2: mean ${s2.mean.toFixed(3)}, bright ${(s2.bright * 100).toFixed(1)} %`);
  check(s1.bright > 0.02 && s1.bright < 0.35 && s2.bright > 0.02 && s2.bright < 0.35 && s1.mean < 0.3 && s2.mean < 0.3, 'a network of bright lines over a darker floor (2–35 % bright)');
  check(Math.abs(s2b.mean - s2.mean) < 0.1 && FX.caustic(10.3, 7.7, 0, 3) !== FX.caustic(10.3, 7.7, 2.5, 3), 'it moves with the time, its brightness the same');
  check(FX.CAUSTIC_OCT[0] === 0 && FX.caustic(1, 2, 3, 0) === 0, 'tier 0 (Very Low): none');
  check(FX.causticSines(FX.CAUSTIC_OCT[1]) === 8 && FX.causticSines(FX.CAUSTIC_OCT[2]) === 12, 'tier 1: 8 sines a pixel, tier 2: 12 (the F7 pattern had 12 on both)');
}

console.log('e · the shader');
{
  global.self = global; require('../src/shared/water_wave.js'); require('../src/main/shaders.js');
  const S = V.SHADERS;
  const pp = (src, defs) => {
    const out = [], st = [], ev = (e) => !!eval(e.replace(/defined\s*\(\s*(\w+)\s*\)/g, (_, d) => defs.includes(d) ? 'true' : 'false'));
    for (const line of src.split('\n')) { const t = line.trim(); let m;
      if ((m = /^#ifdef\s+(\w+)/.exec(t))) { const v = defs.includes(m[1]); st.push({ on: v, done: v }); continue; }
      if ((m = /^#ifndef\s+(\w+)/.exec(t))) { const v = !defs.includes(m[1]); st.push({ on: v, done: v }); continue; }
      if ((m = /^#if\s+(.*)$/.exec(t))) { const v = ev(m[1]); st.push({ on: v, done: v }); continue; }
      if ((m = /^#elif\s+(.*)$/.exec(t))) { const q = st[st.length - 1], v = !q.done && ev(m[1]); q.on = v; q.done = q.done || v; continue; }
      if (/^#else/.test(t)) { const q = st[st.length - 1]; q.on = !q.done; q.done = true; continue; }
      if (/^#endif/.test(t)) { st.pop(); continue; }
      if (st.every(q => q.on)) out.push(line); }
    return out.join('\n');
  };
  const full = S.TRANS_FS.replace("${'__COMMON__'}", S.COMMON).replace('__COMMON__', S.COMMON);
  check(full.includes(FX.glsl().trim().split('\n')[1]), 'the GLSL is generated from the same table (water_fx.js glsl())');
  const lite = pp(full, ['LITE']), high = pp(full, []);
  check(!/wfx|WFX_|whN|pathL/.test(lite), 'Very Low\'s water program has none of it (LITE, after the preprocessor)');
  check(/wfxShore\(vdep/.test(high) && /wfxCrest\(whN/.test(high) && /wfxCaustic\(fl, u_time, u_waterTier > 1.5 \? 3 : 2\)/.test(high) && /pow\(max\(dot\(reflect\(-V, gnm\), L\), 0.0\), 900.0\)/.test(high), 'Low and up: the banks\' and crests\' foam, the caustics by tier, the sun\'s glitter');
  check(/skyColor\(R, u_waterTier > 1.5 && u_reflOn < 0.5\)/.test(high), 'tier 2 mirrors the whole sky (its stars and the nebula at night) where the planar mirror does not reach');
}

console.log('f · the switch');
{
  require('../src/main/i18n.js'); require('../src/main/lang_en.js'); require('../src/main/lang_de.js'); require('../src/main/settings_reg.js');
  require('../src/main/bench.js'); require('../src/main/ultralite.js'); require('../src/main/ipu.js'); require('../src/main/game.js');
  const it = V.Settings.byKey('water'), I = V.I18N;
  check(!!it && it.t === 'slider' && it.min === 0 && it.max === 2 && it.cost === 'mid', 'the Wasser slider 0–2 is in the settings (cost 🟡)', it && JSON.stringify({ t: it.t, min: it.min, max: it.max, cost: it.cost, sec: it.sec }));
  for (const lang of ['de', 'en']) { const d = I.dict[lang] || {}; check(typeof d[it.lab] === 'string' && typeof d[it.tip] === 'string' && Array.isArray(d[it.vals]) && d[it.vals].length === 3, `its texts in ${lang}`, `${d[it.lab]} — ${d[it.vals]}`); }
  const P = V.Game.PRESETS, tiers = ['potato', 'low', 'balanced', 'high', 'ultra'].map(p => P[p].water);
  check(JSON.stringify(tiers) === '[0,1,1,2,2]', 'the presets: Very Low 0, Low/Balanced 1, High/Ultra 2', JSON.stringify(tiers));
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
