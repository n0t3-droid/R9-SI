# Self-review — how every release makes the next one better

The owner (22 Oct 2026, translated): *"I want every newest version to improve itself exponentially and ultra
self-reflectively. I want implementations to be enhanced again and again."* This file is the loop that does it. It
holds for every wave from wave 3 on (`docs/superpowers/specs/2026-10-22-waves.md`) and for every release `v0.NN`.

## 1 · The loop

1. **Fronts build** — each ends its plan with its own self-review (§4).
2. **The coordinator merges and gates** — the release regression (`R9_EXCLUSIVE=1 bash test/regress.sh`), the hard
   rules of CONTRIBUTING.md, then the release candidate.
3. **An independent critic looks** — fresh eyes on everything (§2); the result is a ranked list of what is weak:
   `docs/reviews/v0.NN.md` (§6).
4. **The owner reads the top five** — in plain German, two sentences each; his comments go to the very top of the list.
5. **The next wave is cut from the top of the list** (§3); every task text names the items it fixes and the measure that
   will prove it.
6. **Every wave also sharpens the tools** the next one builds on (§5) — that is what makes the improvement compound.

## 2 · The critic pass — fresh eyes

**Who.** An agent that built none of the release's fronts. It reads, in this order: the release build (`dist/`), every
picture sheet of the release and its fronts (`test/shots/*sheet*.png`), the trailer frames (`docs/trailer/frames`), the
real-space reference (`docs/universe/REFERENCE.md`), the session logs (`test/shots/session_*.json` and their sheets,
erlebnis §7), the cost tables, and the previous review. It does **not** read the fronts' plans and self-reviews until
its own list is written — then it compares and records the *blind spots* (weaknesses a front's self-review missed).

**What it checks**, every time, in this order:
1. **The rules.** The hard rules (block ids append-only, the reference hashes, bilingual texts, no AI account, no
   external requests, low-end first, our own assets and names) and the legal look (every new proper name searched,
   every new texture or sound procedural). Any violation is item 1, whatever else is found.
2. **The pictures against the trailer.** Every sheet beside its frames. Each picture scored 1–5 on five axes —
   **Wow** (would a stranger say it?), **Treue** (likeness to the trailer's shot, where there is one), **Wahrheit**
   (physics and the reference: is the sunset on the dust moon blue round the sun, is the ring lit from the right side,
   do the sizes in the sky match?), **Klarheit** (silhouettes, contrast, readable HUD), **Leben** (motion, things
   happening) — plus the measured numbers where they exist (ΔE per sky band, star density, the frame-difference motion
   measure, triangles and draws).
3. **The pictures against reality** — the universe's bodies, skies and scales against REFERENCE.md's facts.
4. **Never boring.** `test/session.mjs` (builder, adventurer, pilot; 10 game-minutes each) on the release: the metrics
   against the targets (erlebnis §7), the frame at the longest gap (what was on screen?), the act that repeated most.
5. **The cost on Very Low.** The frame at six standing places — the Heartland plaza, the hall city, the canyon, the
   Sky Isles, Herzwelt's orbit, a moon (once they exist) — against the previous release (×1.00 ± 0.03; worse is an
   item), the JS heap and GPU arenas, the loading phases, the first frame.
6. **A free look.** Ten minutes per player type, and the photo mode at ten seeded random places of the release's new
   content (seeded so the next review can stand at the same places).
7. **The owner's standing wishes**, ticked one by one: beautiful; immer etwas los; Friedlich by default; no combat
   forced on builders; low-end PCs first (his: an integrated Vega, 16 GB shared); no AI account; nothing legally
   doubtful; procedural and our own; safe for children (Kindersicher); German first.

**Ranking.** `score = impact (1–5: how many players see it, how often, how plainly) × weight of the wish it hurts
(legal and safety 5, beauty and never-boring 3, low-end 3, trailer fidelity 2, features 1) × confidence (0.5–1) ÷
effort (agent-days, 1–3)`. Rule violations rank first regardless of score. 10–20 items, no more.

**Budget on this machine** (2 CPUs, two browser slots): half an agent-day; the sessions take one browser slot for about
an hour and the Very Low benches twenty minutes, both in the release lane (`R9_EXCLUSIVE=1`, wt_run.sh's own slot)
after the release regression, so nothing waits on the fronts. Pictures the fronts already made are reused.

## 3 · From the list to the next wave

- The coordinator takes the owner's comments first, then the list by score, and groups items into 4–6 fronts — one
  coherent piece each; items that touch the same files go into the same front. Each task text cites the item ids and
  takes their "proves fixed" measures as its acceptance.
- The planned fronts of the waves roadmap compete with the list: a planned front enters a wave only if no review item
  outranks it — except a **Fundament** (a foundation the next spectacle needs), which may be marked as such and goes in.
- An item that has waited three releases is either taken next or dropped with a written reason — no eternal backlog.
- The wave's launch note lists, per front, the items it addresses.

## 4 · The front's own self-review — the last section of every plan

```markdown
## N · Self-review
1. Asked vs got — what the task asked; what the pictures show (paths), in two to five lines.
2. The three weakest things left — each with its evidence (a picture or a number) and why it is weak.
3. The numbers — before → after, the cost on Very Low and on High, the gates and their results.
4. What I would do next — front-sized, in order.
5. The tool I left better — the test, sheet, measure, debug view or generator parameter the next front can use, and how.
```
Written after the last run, looking at the pictures, not from memory. "Not reached" is an honest and valid answer. The
coordinator carries items 2 and 4 of every front into the critic's inputs (read after the critic's own list, §2).

## 5 · What "exponential" means in practice

1. **Every front leaves a tool better.** Item 5 of every self-review is mandatory. The tools so far: the sheets that
   put the game's picture beside the trailer's frame (`sky3.mjs`, `wow48.mjs`), the sky band ΔE (`test/sky_ref.js`),
   the frame-difference motion measure (`motion.mjs`), the software iso pictures (`isopic.js`), the Stufentest and the
   F3 GPU profile, `frame_cost.js`, the generator pins. Wave 3 adds the event log and the session metrics (erlebnis
   §7), the orbital test bench (`test/universe.js`), the dim registry's test. Later: a body-generator preview sheet,
   the planet-from-orbit sheet, a story-beat timeline viewer.
2. **Measures become gates.** A fixed weakness gets its check into the regression suite (`test/regress.sh` picks up
   any test that prints `ALL OK`), so it stays fixed; from wave 6 the session targets gate releases too. The suite grows
   each release — that is what lets later waves move faster without breaking earlier work.
3. **The quality index** heads every review and must rise from release to release:

| Index | How | Target |
|---|---|---|
| picture score | the mean of the five axes over the release's pictures | rising |
| never-boring | the share of session targets met (builder · adventurer · pilot) | all from wave 6 |
| Very Low cost | the frame at the six places against v0.48 | ≤ 1.00 |
| rule violations | open items of §2.1 | 0 |
| last review's top three | fixed, by their own measures | 3 of 3 |

   If a release does not fix the last review's top three, the next wave attacks them again before any new spectacle:
   first make it good, then make it more.
4. **The process learns too.** Each review ends with *Lessons* — what slowed the fronts (browser-slot waits, flaky
   tests, unclear task texts) and what to change; the coordinator applies them to the next task texts and to this file.

## 6 · The review file — `docs/reviews/v0.NN.md`

```markdown
# Review v0.NN — <date> · critic <agent>
Release <tag @ commit> · fronts <list> · inputs read <list>

## Quality index
| | v0.(NN−1) | v0.NN | target |
|---|---|---|---|
| picture score (5 axes, mean) | | | rising |
| never-boring targets met (B · A · P) | | | all |
| Very Low cost (six places, vs v0.48) | | | ≤ 1.00 |
| rule violations | | | 0 |
| last review's top three fixed | | | 3/3 |

## Ranked weaknesses
| # | id | What (one line) | Evidence (picture · number) | Impact · wish | Cause (file:line if known) | Fix (one front) | Proves fixed | Score |
|---|---|---|---|---|---|---|---|---|
| 1 | R50-01 | … | test/shots/… | … | … | … | … | … |

## Blind spots — what the fronts' self-reviews missed
## Fixed since the last review — with their measures
## Tools — added, used, left unused
## Für den Owner — die fünf wichtigsten Punkte, je zwei Sätze
## Lessons for the process
```

## 7 · The first one

v0.49 (WOW wave 2: t-sky3, t-wild, t-first, t-polish2) is the first release reviewed this way. The session harness
arrives with wave 3 (`e-log`), so v0.49's review uses the pictures, the costs and a manual ten-minute look per player
type; v0.50's review is the first with session numbers.
