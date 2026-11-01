# The release gate (w-golden, 2026-11-02)

Three browser checks that catch what a person used to catch by looking: a page that breaks (smoke), a place that no
longer looks like itself — the vanished citadel, a grey sky, a black café (golden shots), and a game that locks up or
loses a save under careless hands (the monkey).

## How the coordinator calls it
On the integration branch, after the merge and before tagging, from the checkout being released:

```
cd <checkout> && R9_EXCLUSIVE=1 bash test/release_gate.sh .tmp_tests/gate_<version>
```

- It builds `dist/` (`node build.js`), then runs `smoke.mjs`, `golden.mjs`, `monkey.mjs` one after another through
  `test/wt_run.sh` (with `R9_EXCLUSIVE=1`: the release lane, one browser test at a time).
- Exit 0 and a last line `GATE ALL OK` = pass; otherwise `GATE FAILED n` and the failing checks (✗ lines) in
  `<dir>/gate.txt`. Each stage's full log is `<dir>/<stage>.log`. About 12–15 minutes on the 2-CPU machine.
- `GATE_ONLY="golden"` runs one stage; `GATE_SKIP_BUILD=1` keeps `dist/` as it is.
- It does not replace `REGRESS_ONLY=node bash test/regress.sh` (the node gates) or `classic_v2.mjs`; it runs after them.

## When a golden shot fails
`test/shots/golden_<id>_diff.png` shows reference · now · the SSIM map (dark = different). Look at it:
- a regression → fix the build; the reference stays.
- an intended change of the look (a new sky, a new café) → refresh the references on purpose and commit them with a
  line saying why: `UPDATE=1 bash test/wt_run.sh golden.mjs 1200`, then look at every new `test/golden/*.png`.
  The front that changed the look refreshes them in its branch; the coordinator never refreshes them to make a red gate green.
- world generation changed on purpose (a new `vgen`): the references of the new default world move with it.

The shots: `vista_vl`, `citadel_vl` (Very Low), `vista`, `citadel`, `plaza`, `fairy`, `starmap`, `cafe`, `aqua`
(Balanced) — seed 4242, 640 × 360, the clock and weather frozen, animals and people not drawn. Thresholds per shot in
`test/golden.mjs` (THR): luma SSIM, chroma SSIM, and the worst of 8 × 8 tiles (a small landmark gone).

## The monkey
`test/monkey.mjs`: 3 min of seeded random play (`MONKEY_SEED`), save → reload → 30 s more. A failure names the seed;
the same seed replays the same input (the frame timing of the machine still differs, so a rare hang may need a few seeds:
`MONKEY_SEED=2 bash test/wt_run.sh monkey.mjs 1200`).
