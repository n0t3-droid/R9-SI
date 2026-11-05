// f-polish9 · the Sky Isles calmer (vgen 16; docs/superpowers/plans/2026-11-02-f-polish9.md §1), o-wander3's self-review:
//  · vgen 15's isle chunks stay exactly as they were (pinned below; test/isles15.js still pins vgen 14);
//  · vgen 16: from below the isle reads as big calm shapes — the underside's colour changes between neighbouring
//    columns far less (the speckle), moss in large patches, glowing mushrooms rare and in clusters; the vine curtains
//    shorter (2–7) and sparser (about a quarter of the rim); still warm or green from below, still a garden.
//   bash test/wt_run.sh isles16.js 300   (PIN=1 prints vgen 15's hash)
const V = require('./load_shared.js');
const R = V.R;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const PIN15 = '549504d6';
const CH = [[20, 8], [19, 2], [25, 4], [26, 9], [21, 14], [15, 12], [14, 7], [22, 10], [18, 6], [17, 9], [23, 7]];
const fnv = (h, a) => { for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
const nm = (s) => { const t = R.types[R.T.type[s]]; return t ? t.name : ''; };
function scan(vgen) {
  const g = V.makeGen('overworld', 4242, { vgen });
  let h = 2166136261 >>> 0;
  const o = { under: 0, warm: 0, green: 0, grey: 0, pairs: 0, diff: 0, shroom: 0, vines: 0, strands: 0, glow: 0, flowers: 0 };
  const WARM = /ochre|umber|terracotta/, GREEN = /moss_block|azalea_leaves/, GREY = /^(stone|andesite|granite|tuff|dirt|coarse_dirt|diorite)$/, FL = /poppy|dandelion|cornflower|allium|pink_petals|wildflowers|azalea|tulip|oxeye|bluet/;
  for (const [cx, cz] of CH) {
    const c = g.generate(cx, cz), b = c.blocks; h = fnv(h, b);
    const cls = new Array(256).fill(null);
    for (let col = 0; col < 256; col++) {
      let seenSolid = false, run = 0;
      for (let y = 120; y < 200; y++) {
        const s = b[(y << 8) | col]; const n = s ? nm(s) : '';
        if (n === 'vines') { o.vines++; run++; } else { if (run) o.strands++; run = 0; }
        if (!s) continue;
        if (!seenSolid && R.T.shape[s] === 1) {
          seenSolid = true; o.under++;
          cls[col] = n;   // the face seen from below: its block (each strata colour its own class)
          if (WARM.test(n)) o.warm++; else if (GREEN.test(n)) o.green++; else if (GREY.test(n)) o.grey++;
        }
        if (n === 'lumishroom') o.shroom++;
        if (R.T.emit[s] && !/lava|magma|lamp|light|beacon|glow_bar|slit|gate/.test(n)) o.glow++;
        if (FL.test(n)) o.flowers++;
      }
      if (run) o.strands++;
    }
    for (let col = 0; col < 256; col++) {
      if (!cls[col]) continue;
      const x = col & 15, z = col >> 4;
      if (x < 15 && cls[col + 1]) { o.pairs++; if (cls[col + 1] !== cls[col]) o.diff++; }
      if (z < 15 && cls[col + 16]) { o.pairs++; if (cls[col + 16] !== cls[col]) o.diff++; }
    }
  }
  return { hash: h.toString(16).padStart(8, '0'), o };
}
const t0 = Date.now();
const a = scan(15);
if (process.env.PIN) console.log('PIN15 = ' + a.hash);
check(a.hash === PIN15, `vgen 15's isle chunks unchanged (${a.hash})`);
const b = scan(16);
const A = a.o, B = b.o;
console.log('  vgen 15 ' + JSON.stringify(A) + '\n  vgen 16 ' + JSON.stringify(B));
const sp = (o) => o.diff / Math.max(1, o.pairs), col = (o) => (o.warm + o.green) / Math.max(1, o.under), ml = (o) => o.vines / Math.max(1, o.strands);
check(sp(B) <= 0.5 && sp(B) <= sp(A) * 0.65, `the speckle from below (neighbouring faces of another block): ${Math.round(sp(A) * 100)} % → ${Math.round(sp(B) * 100)} % (≤ 50 %, ≤ ⅔ of vgen 15)`);
check(col(B) >= 0.6, `the undersides still warm or green from below: ${Math.round(col(A) * 100)} % → ${Math.round(col(B) * 100)} % (≥ 60 %)`);
check(B.green >= 0.2 * B.under, `moss in large patches: ${Math.round(B.green / Math.max(1, B.under) * 100)} % of the faces from below (≥ 20 %)`);
check(B.shroom <= A.shroom * 0.4 && B.shroom >= 3, `glowing mushrooms rare: ${A.shroom} → ${B.shroom} (≤ 40 %, a few left)`);
check(B.vines <= A.vines * 0.55 && B.vines >= 80, `the vine curtains sparser: ${A.vines} → ${B.vines} vines (≤ 55 %, ≥ 80)`);
check(ml(B) <= 4 && ml(B) < ml(A), `the strands shorter: ${ml(A).toFixed(1)} → ${ml(B).toFixed(1)} a strand (≤ 4)`);
check(B.flowers >= A.flowers * 0.9, `the flowers on top kept: ${A.flowers} → ${B.flowers}`);
check(V.makeGen('overworld', 4242, { vgen: 16 }).generate(0, 0).blocks.length > 0, 'a vgen-16 world generates');
const gm = require('fs').readFileSync(require('path').join(__dirname, '../src/main/game.js'), 'utf8');
check(/vgen: o\.vgen \? \+o\.vgen : (16|17)\b/.test(gm), 'new worlds are vgen 16 or later (game.js; v-flora: 17)');
console.log(`  (${Date.now() - t0} ms)`);
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
