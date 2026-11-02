// o-wander3 · the Sky Isles as floating gardens (vgen 15; docs/superpowers/plans/2026-11-02-o-wander3.md §2):
//  · vgen 14's isle chunks stay exactly as they were (pinned below — saved worlds keep their chunks);
//  · vgen 15 (new worlds): warm strata under the designed isles with moss patches, a moss lip under the rim, green vine
//    curtains down the rims, flowering vines, glowing berries and mushrooms under them, more flowers on top, one more
//    little waterfall an isle — counted over the seven isles' chunks: the underside's colour (the share of warm and
//    green faces seen from below), the hanging greenery, the glow.
//   bash test/wt_run.sh isles15.js 300   (PIN=1 prints vgen 14's hash)
const V = require('./load_shared.js');
const R = V.R;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const PIN14 = '0deef07f';
const CH = [[20, 8], [19, 2], [25, 4], [26, 9], [21, 14], [15, 12], [14, 7], [22, 10], [18, 6], [17, 9], [23, 7]];
const fnv = (h, a) => { for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
const nm = (s) => { const t = R.types[R.T.type[s]]; return t ? t.name : ''; };
function scan(vgen) {
  const g = V.makeGen('overworld', 4242, { vgen });
  let h = 2166136261 >>> 0; const o = { under: 0, warm: 0, green: 0, grey: 0, hang: 0, vines: 0, glow: 0, flowers: 0, water: 0 };
  const WARM = /ochre|umber|terracotta/, GREEN = /moss_block|azalea_leaves/, GREY = /^(stone|andesite|granite|tuff|dirt|coarse_dirt|diorite)$/, FL = /poppy|dandelion|cornflower|allium|pink_petals|wildflowers|azalea|tulip|oxeye|lilac/;
  for (const [cx, cz] of CH) {
    const c = g.generate(cx, cz), b = c.blocks; h = fnv(h, b);
    for (let col = 0; col < 256; col++) {
      let seenSolid = false;
      for (let y = 120; y < 200; y++) {   // from below: the first solid of the column is its underside face
        const s = b[(y << 8) | col]; if (!s) continue; const n = nm(s);
        if (!seenSolid && R.T.shape[s] === 1) { seenSolid = true; o.under++; if (WARM.test(n)) o.warm++; else if (GREEN.test(n)) o.green++; else if (GREY.test(n)) o.grey++; }
        if (/vines|glow_berry_vine|hanging_roots|spore_blossom|weeping/.test(n)) { o.hang++; if (n === 'vines') o.vines++; }
        if (R.T.emit[s] && !/lava|magma|lamp|light|beacon|glow_bar|slit|gate/.test(n)) o.glow++;
        if (FL.test(n)) o.flowers++;
        if (R.T.flags[s] & V.F.WATER) o.water++;
      }
    }
  }
  return { hash: h.toString(16).padStart(8, '0'), o };
}
const t0 = Date.now();
const a = scan(14);
if (process.env.PIN) console.log('PIN14 = ' + a.hash);
check(a.hash === PIN14, `vgen 14's isle chunks unchanged (${a.hash})`);
const b = scan(15);
const A = a.o, B = b.o;
console.log('  vgen 14 ' + JSON.stringify(A) + '\n  vgen 15 ' + JSON.stringify(B));
const col = (o) => (o.warm + o.green) / Math.max(1, o.under);
check(col(B) >= 0.6 && col(B) > col(A) + 0.3, `the undersides seen from below: warm or green ${Math.round(col(A) * 100)} % → ${Math.round(col(B) * 100)} % (≥ 60 %)`);
check(B.grey / Math.max(1, B.under) <= 0.3, `grey/dark undersides ≤ 30 % (${Math.round(B.grey / Math.max(1, B.under) * 100)} %)`);
check(B.vines >= 300 && B.hang >= A.hang * 2, `green vine curtains: ${A.vines} → ${B.vines} vines, hanging greenery ${A.hang} → ${B.hang}`);
check(B.glow >= A.glow * 1.5 && B.glow >= 60, `the glow under the isles (berries, mushrooms): ${A.glow} → ${B.glow}`);
check(B.flowers >= A.flowers * 1.5, `flowers on top: ${A.flowers} → ${B.flowers}`);
check(B.water > A.water, `one more little waterfall an isle: water cells ${A.water} → ${B.water}`);
check(V.makeGen('overworld', 4242, { vgen: 15 }).generate(0, 0).blocks.length > 0, 'a vgen-15 world generates');
console.log(`  (${Date.now() - t0} ms)`);
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
