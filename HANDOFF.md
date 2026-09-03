# 17-0 handoff (2026-09-03)

This file is for a **fresh agent**. Do not treat chat memory as required. Player evaluation is **LOCKED** unless the user explicitly reopens it.

**Do not push. Do not touch Supabase. Do not touch Vercel.** Do not rebuild nflverse / peer baselines / cards unless the user asks. Do not restart the killed human-strategy audit unless the user asks.

Prior chat: Cursor agent transcript [`17-0 scoring lock through skips`](C:\Users\kevin\.cursor\projects\e-Dev-17-0\agent-transcripts\5e001301-a67f-4b74-a2f5-fd602854e6c4) (uuid `5e001301-a67f-4b74-a2f5-fd602854e6c4`).

---

## Current branch and production

Work in `E:\Dev\17-0` on branch **`scoring-lock`**. That branch holds **all scoring-lock work plus the C6 record ladder, committed**. **`master` is still `9bf72f03`.** **Nothing has been pushed.**

**Latest commit on `scoring-lock`:** `610e0c73` — record ladder C6.

| Knot | Config | Live binary-search threshold |
|---|---:|---:|
| 14-3 | logistic (unchanged) | **78.668** |
| 15-2 | **84.0** | **84.003** |
| 16-1 | **87.0** | **87.006** |
| 17-0 | **88.5** | **88.501** |

Join remains 80; end remains 95 at p = 0.99. Logistic at or below 80 is unchanged.

**Design rationale:** the old ladder (15-2=85, 16-1=89, 17-0=90.75) made 17-0 unreachable (no-skip BEST max 90.794; skip-aware GREEDY max 91.151; 4/10000 at 90.753). C6 targets roughly **10% 17-0 for excellent play**, about **5 in 50 games**. Measured by re-projecting saved paired ratings (`tmp-variance-decomposition-ratings.json`, 10k seeds, no skips): **BEST 10.17% 17-0**, **TOP_3 0.73%**. RANDOM remains **0% at 15-2 and above**.

**Vercel production tracks branch `master` and currently runs `9bf72f03`**, which does **not** include any of this lock or C6 work.

Player evaluation remains **LOCKED**. Do not reopen.

---

## NEXT PLANNED WORK: stochastic season variance

The displayed record is currently **deterministic**: `round(17 × p)`. The same lineup always yields the same record.

Plan: add variance so a strong team varies between 15-2, 16-1, and 17-0 rather than returning one fixed result. Candidate model (not implemented):

```
B ~ Binomial(17, p)
wins = round(17p + k * (B - 17p))  clamped 0..17
```

Sweep **k** over `0, 0.25, 0.4, 0.6, 0.8, 1.0`. Do not start unless the user asks.

---

## 1. Worktrees and branches

Two git worktrees, **same origin `master` commit**, **different uncommitted / committed work**. They must not be mixed.

| Path | Branch | Tracks | HEAD | What it is |
|---|---|---|---|---|
| `E:\Dev\17-0` | **`scoring-lock`** | *(no upstream; not pushed)* | **`610e0c73`** | **Gameplay / scoring lock.** INT fix, peer snapshot, C6 win-curve, audits. Forked from `master` `9bf72f03`. |
| `E:\Dev\17-0-telemetry` | `telemetry-picks` | **`origin/master`** (not a distinct remote branch) | **`9bf72f03`** | **Telemetry-only worktree.** Anonymous pick/spin logging, drizzle `0004`, **older** peer snapshot than the lock. |

Local branches **not** checked out as this worktree:

- `master` at `9bf72f03` — “Add 17-0 celebration and rebalance audio volume”. Vercel production.
- `pro-set-two-rb` at `433270c` — “Replace fullback with two-RB pro set”. Historical. Pro-set is already in `master` at `9bf72f03` plus committed lock work on `scoring-lock`.

`scoring-lock` tip:

```
610e0c7393e20883032a34eb2f15a24620c46cd4
Lower the upper record ladder to 15-2 at 84, 16-1 at 87, and 17-0 at 88.5.
```

Commits on `scoring-lock` after `9bf72f03` (oldest first):

```
530bc1d Ignore local tmp-* audit harnesses and dumps.
b7d30fc Score modern QBs on regular-season passing interceptions.
6494b3c Lock player evaluation: INT-aware peers, strike windows, RB floor, and record ladder.
568105d Rename results record copy and add fail-tier sound.
6b02a74 Record the scoring-lock handoff and read-only project audit.
610e0c7 Lower the upper record ladder to 15-2 at 84, 16-1 at 87, and 17-0 at 88.5.
```

`master` / `origin/master` remain `9bf72f03`. Telemetry worktree has **uncommitted** telemetry only.

---

## 2. Current git status

### `E:\Dev\17-0` (`scoring-lock`)

Committed lock + C6. Leftovers (do not commit unless asked):

- `M data/manifests/historical-stats.json` — `downloadedAt` timestamp only
- `?? AGENTS.md` / `?? CLAUDE.md` — Next.js `generate-agent-files` stubs
- `tmp-*` gitignored

### `E:\Dev\17-0-telemetry` (`telemetry-picks`)

```
## telemetry-picks...origin/master
```

Nothing staged. Telemetry schema/API/tests uncommitted. **Does not contain** the INT/lock/C6 scoring source changes except an **older** modified `peer-baselines.json` and `historical-stats.json` timestamp.

---

## 3. Scoring-lock source (now committed on `scoring-lock`)

| File | What it does and why |
|---|---|
| `src/data/sources/nflverse/regularSeasonProduction.ts` | REG-only weekly aggregation; `"0"` INT stays 0, blank stays NULL; POST weeks ignored. Fixes modern QBs missing interceptions. |
| `src/data/sources/nflverse/import.ts` | Threads `interceptions` through pending seasons and insert. Same INT hole. |
| `src/data/sources/nflverse/config.ts` | Manifest note: player_stats weeks are REG only. |
| `src/lib/scoring/config.ts` | Strike 3-year peers (1982/1987); `RB_ELITE_RUSHING_FLOOR` 98.5/−2; `SCORING_SEASON_SWITCH_THRESHOLD = 0.5`; **C6** `upperLadder` 15-2=84, 16-1=87, 17-0=88.5. RB metric weights remain 65% rush / 35% receive. |
| `src/lib/scoring/playerSeasonScore.ts` | Applies RB elite rushing floor after composite percentile. |
| `src/lib/scoring/peerBaselines.ts` | Uses `peerComparisonSeasons()` so only 1982/1987 expand; other years including early-1970s stay **same-season**. |
| `src/lib/scoring/selectScoringSeason.ts` | Optional `switchThreshold` (tests/audits); production default 0.50 hysteresis. |
| `src/lib/scoring/winProjection.ts` | Upper-ladder piecewise win curve through those knots; `ratingThresholdForProjectedWins` binary search. |
| `src/lib/scoring/generated/peer-baselines.json` | Regenerated **2026-09-03T02:34:26.373Z**, 39,795 seasons, **1,229** buckets after INT-aware rebuild. |
| `src/components/game/ResultsView.tsx` | Copy: “Projected Record” → “Expected Record”; “17–0 Chance” → “Perfect Season Chance”. Not a scoring change. |
| `tests/resultsUi.test.tsx` | Matches that ResultsView copy. |
| `tests/scoringCalibration.test.ts` | Switch-threshold hysteresis fixture. |
| `tests/scoringFbSlot.test.ts` | Expectation updates after lock / C6. |
| `tests/scoringTopEnd.test.ts` | Top-end expectations after INT/floor/C6 curve. |
| `tests/seasonLength.test.ts` | 17-0 threshold expectations after C6. |
| `tests/nflverseRegularSeasonProduction.test.ts` | REG vs POST; true-zero vs null INT; cache examples (Rodgers 2011 REG yards 4636). |
| `tests/scoringStrikeAndRushFloor.test.ts` | Strike windows + RB floor. |
| `public/sounds/bad-luck-fail.mp3` | Fail-tier SFX (pairs with committed 17-0 celebration audio). |
| `HANDOFF.md` / `PROJECT-AUDIT.md` | Agent handoff and read-only project audit. |
| `.gitignore` | `tmp-*` ignored. |

**Still uncommitted (intentionally):** `data/manifests/historical-stats.json` timestamp; `AGENTS.md` / `CLAUDE.md`.

### `E:\Dev\17-0-telemetry` — telemetry (do not copy into scoring lock tree)

| File | Status | What it does and why |
|---|---|---|
| `src/db/schema/telemetry.ts` | ?? | `telemetry_games` / `_spins` / `_spin_candidates` / `_picks`; no FKs onto gameplay tables. |
| `src/db/schema/enums.ts` | M | `telemetry_completion_state` enum. |
| `src/db/schema/index.ts` | M | Exports telemetry schema. |
| `drizzle/0004_telemetry.sql` | ?? | Migration creating those tables/indexes. |
| `drizzle/meta/0004_snapshot.json` | ?? | Drizzle snapshot for 0004. |
| `drizzle/meta/_journal.json` | M | Registers 0004. |
| `src/lib/telemetry/record.ts` | ?? | Persist spin/pick/complete; errors must not fail the game. |
| `src/lib/telemetry/versions.ts` | ?? | Hashes scoring/projection/data model versions; git SHA fallback `9bf72f03…`. |
| `src/lib/scoring/evaluateSpinOffers.ts` | ?? | Per-card per-slot offer scores for telemetry + ranking. |
| `src/lib/scoring/rankSpinCandidates.ts` | M | Uses offer evaluation; CLASSIC vs IQ ordering. |
| `src/app/api/game/spin/route.ts` | M | Records spin telemetry after order. |
| `src/app/api/game/team-skip/route.ts` | M | Same for team skip. |
| `src/app/api/game/era-skip/route.ts` | M | Same for era skip. |
| `src/app/api/game/pick/route.ts` | M | Records pick telemetry. |
| `src/app/api/game/[id]/score/route.ts` | M | Records completed-game telemetry. |
| `src/server/telemetryService.ts` | ?? | Safe wrappers around persist. |
| `tests/telemetryMigration.test.ts` | ?? | 0004 migration tests. |
| `tests/telemetryRecord.test.ts` | ?? | Persist tests. |
| `tests/candidateOrder.test.ts` | M | Ranking/order with offers. |
| `tests/spinApi.test.ts` | M | Spin API + telemetry hook. |
| `src/lib/scoring/generated/peer-baselines.json` | M | **Not the lock snapshot.** `generatedAt` **2026-09-02T21:10:08.321Z**, **1,203** buckets vs lock **1,229**. Do not overwrite 17-0 lock file with this, or vice versa, without an explicit user request. |
| `data/manifests/historical-stats.json` | M | Timestamp drift vs HEAD; not the lock rebuild of record. |

Telemetry tmp: `tmp-dump-pre-correction-card-ratings.ts`, `tmp-telemetry-spin-benchmark.ts`, `tmp/pre-correction-card-ratings.json`, `tmp/pre-correction-card-ratings-summary.json`.

---

## 4. Generated / audit artifacts **do not recompute** unless asked

Scripts are gitignored `tmp-*.ts`. JSON is the result. **Prefer reading JSON.**

### Must-keep (lock + skip + C6 measurement)

| Path | Contains |
|---|---|
| `tmp-variance-decomposition-results.json` | Paired 10k seeds **1–10000**, five strategies, **no skips**. BEST mean **86.658**, SD **1.506**, max **90.794**. TOP_3 beats greedy on **704/10000 (7.04%)**. ANOVA / regret / elite frequencies. Generated 2026-09-03T03:48:01Z. |
| `tmp-variance-decomposition-ratings.json` | Per-seed ratings + regrets + first pool sizes. **Used to re-project C6** without re-running the harness. |
| `tmp-variance-decomposition-extra.json` | Restricted ANOVA (no RANDOM; BEST vs TOP_3) + conditional elite tails. |
| `tmp-variance-decomposition.ts` | Harness. Split RNGs: `mulberry32(seed)` spins, `mulberry32(seed ^ 0x9e3779b9)` picks. |
| `tmp-ceiling-stage1-results.json` | GREEDY_POSTHOC Hungarian/exhaustive slot reassignment on **same six greedy cards**. Mean lift **+0.021**. Recovers **24/704** TOP_3 wins. Cause split S=24, P=673, D=7. Gate opened for search; Stage 2/3 **not** run. |
| `tmp-ceiling-stage1.ts` | Stage 1 harness. |
| `tmp-skip-aware-ceiling-results.json` | Skip-aware **GREEDY only**, policy = hidden **#1** combo-best. Tuning 2k + final 10k seeds **1–10000**. Honest **P30 both skips**: mean **87.420**, max **91.151**, ≥90.753 **4/10000** (old knot). Clairvoyant immediate mean **87.242** (worse mean than honest). Team-only +0.345, Era-only +0.360, Both +0.762 on those seeds. Generated 2026-09-03T04:45:39Z. |
| `tmp-skip-aware-ceiling.ts` | That harness. |
| `tmp-skip-aware-human-strategy.ts` | **Revised** policy-conditional skip harness (TOP_N/RANDOM expected pick, not hidden #1). Tuning 1–2000, eval 2001–12000, optional tail 12001+. |
| `tmp-skip-aware-human-strategy-results.json` | **SMOKE TEST ONLY** (`games: 15`, `generatedAt` 2026-09-03T20:44:11Z). **Not** the killed 10k run. Do not cite as evaluation. |
| `tmp-game-balance-audit-results-int-lock.json` | Unpaired 10k/strategy after INT lock, `SKIP_SPINS=1`. BEST max ≈90.748. **Different seeds per strategy** (101, 202, …). |
| `tmp-game-balance-audit-ratings-int-lock.json` | Ratings dump for that run. |
| `tmp-game-balance-audit.ts` | Unpaired balance harness. `SKIP_SPINS=1` means **omit extra candidate-presentation spins**, **not** Team/Era Skip. `skipUsed` is hardcoded 0. |
| `tmp-qb-int-lock-audit.json` | Manning/Rodgers/Brady after INT; residual null classification. |
| `src/lib/scoring/generated/peer-baselines.json` | Lock peer index (see §3). |

### Older / supporting audits (keep; do not rebuild for the current question)

| Path | Contains |
|---|---|
| `tmp-game-balance-audit-results.json` | Earlier unpaired balance. |
| `tmp-game-balance-audit-results-post-correction.json` | Post-correction unpaired. |
| `tmp-game-balance-audit-results-pro-set.json` | Pro-set balance. |
| `tmp-game-balance-audit-results-selection-models.json` | Selection-model unpaired. |
| `tmp-game-balance-audit-results-tail-92.25.json` | Tail-curve experiment (rejected). |
| `tmp-game-balance-audit-ratings-current.json` | Ratings companion (unpaired). |
| `tmp-game-balance-audit-ratings-post-correction.json` | Post-correction ratings. |
| `tmp-win-curve-sweep.json` / `tmp-win-curve-sweep.ts` | Curve knot sweep. |
| `tmp-win-curve-rescored.json` / `tmp-win-curve-rescored.ts` | Rescore vs frozen knots. |
| `tmp-legend-rating-audit.json` + `-before.json` + `tmp-legend-compare.json` + `tmp-legend-named-before.json` + `tmp-legend-rating-audit.ts` | Named-legend rating audits. |
| `tmp-player-eval-audit.json` / `.ts` | Player-eval audit. |
| `tmp-player-eval-lock-investigation.json` / `.ts` | Lock investigation. |
| `tmp-qb-int-before.json` / `.ts`, `tmp-qb-int-lock-audit.ts`, `tmp-qb-int-residual.ts`, `tmp-qb-int-residual-classify.ts`, `tmp-qb-int-cache-totals.ts` | INT hole investigation. |
| `tmp-rb-weight-calibration.json` / `.ts` | RB 65/35 calibration (locked). |
| `tmp-scoring-correction-audit.json` / `.ts` | Scoring correction. |
| `tmp-top-end-rating-analysis.json` / `.ts` | Top-end / rejected unified tail. |
| `tmp-verify-corrected-production.json` / `.ts` | Production verify after INT. |
| `tmp-nflverse-season-type-audit.ts` | REG vs POST audit script. |
| `tmp-pro-set-local-verify.json` / `.ts` | Local pro-set verify. |
| `tmp-readonly-check.ts` | Read-only check. |
| `tmp-int-lock-snapshot.patch` | Snapshot patch artifact. |
| `tmp-confirm-local-0003.ts` | **Local PGlite only** — prints whether `0003_pro_set_lineup_slots.sql` is applied. Refuses if `DATABASE_URL` set. |

Local durable DB: `.data/pglite` (not rebuilt this handoff). Audits copy it excluding `postmaster.pid`.

---

## 5. FROZEN decisions (do not reopen)

**PLAYER EVALUATION = LOCKED (OPTION A)** on `E:\Dev\17-0` / `scoring-lock`.

| Decision | Exact lock | Why |
|---|---|---|
| nflverse production | **REG weeks only**; POST excluded | POST was leaking into season totals. |
| Modern INT | Field **`interceptions`** (passing INTs thrown), not `def_interceptions`. `"0"` is 0; blank is NULL. | 1999+ import never wrote INT; renormalized the 15% QB term away. Residual INT-null 1999+: 1045, all roster-only or 2025 missing weekly file — **0** yards/TDs with INT null. |
| **RB weighting 65/35** | Rush 0.40 yards + 0.25 TDs; receive 0.10 rec + 0.15 yards + 0.10 TDs | Calibration choice; do not retune. |
| **RB elite rushing floor** | If rushing-only pctl ≥ **98.5**, composite cannot fall more than **2** points | Protects volume RBs from receive collapse; ordinary RBs unchanged. |
| Strike peers | **1982** → 1981–83; **1987** → 1986–88 | Diluted lockout pools. |
| **Early-1970s peers** | **Same season only** (`peerComparisonSeasons` returns `[season]` except strike years) | Do not 3-year-smooth 1970–71. Thin samples are a known model characteristic. |
| Season switch | **`SCORING_SEASON_SWITCH_THRESHOLD = 0.5`** | Later season must beat best by **> 0.5** adjusted points; inside band prefer reliability then games. 0.25/0.00 were audited and rejected. |
| Unified P90-excess tail | **Rejected (OPTION B).** Not in production `src/lib/scoring/` | Elite RB/WR Jaccard collapse (Faulk, CMC, Charles). |
| Positional metric weights | QB 35/30/15/10/10 (pass yds/TD/INT/rush yds/TD) unchanged | INT restore uses existing weights. |
| Lineup slot weights | QB 0.30, RB1/RB2 0.115 each, WR1 0.16, WR2 0.14, TE 0.12 | Unchanged. |
| **Record ladder C6** | `upperLadder`: 15-2 **84.00**, 16-1 **87.00**, 17-0 **88.50**; join 80; end 95 | Live thresholds 15-2 **84.003**, 16-1 **87.006**, 17-0 **88.501**. 14-3 **78.668** unchanged. Do not retune player eval to chase records. Next record work is **stochastic k**, not another knot sweep, unless the user asks. |
| **IQ pick-time season hidden** | IQ candidate UI must **not** show scoring season / engine score / rank. Results **may** show selected-slot season (`ResultsView` “Season …”). | Product rule. Do not “help” IQ by revealing the engine year at pick time. |
| Candidate pools | No caps. Prior audit: early-game median ~63, max 106; QB/RB/WR/TE filter medians ~9/20/21/11 | Pool size ~uncorrelated with BEST rating. |
| Stochastic seasons | **Not implemented.** Candidate Binomial blend with k sweep. | **Next planned work** when the user asks. |
| Telemetry | Lives only in `E:\Dev\17-0-telemetry`. Do not port into lock tree unless asked. | Separate dirty tree. |

Known locked-model characteristics (do not “fix”): Peyton 2013 rank ~163 with rush/INT shape; 2025-only roster rows undraftable without weekly stats.

---

## 6. Open questions (not answered)

1. **Skip-aware TOP_3 / TOP_5 / TOP_7 / RANDOM distributions** — harness exists (`tmp-skip-aware-human-strategy.ts`); **full eval JSON was never written** (killed mid-tail). Smoke JSON is n=15 only.
2. Whether **P20 vs P30 vs P40** for TOP_N is truly tied: the script’s tie band used `max(0.04, 2*unpaired SE)`, which on 2000 games with SD~3 forced **P20 for every TOP_N/RANDOM**. Revisit with **paired** mean differences before locking those thresholds.
3. **Team vs Era / superadditivity CIs** on the **policy-conditional** definition and held-out seeds 2001–12000 — not on disk. Prior CIs exist only for **GREEDY + hidden #1** on seeds 1–10000 (`tmp-skip-aware-ceiling-results.json` `incrementalLiftVsNoSkip` / would need SE from ratings if recomputed).
4. **C6 17-0 rates for skip-aware TOP_N** — unknown. Under the **old** 90.753 knot, GREEDY honest P30 was **4/10000**. Skip-aware GREEDY share ≥89.0 was **10.63%** (summary CDF only).
5. **Beam / ORACLE_HONEST vs ORACLE_CLAIRVOYANT path search** — Stage 1 said greedy 7% is **player/path (P)**, not slots. Stages 2–3 of the ceiling prompt were **never started**. Immediate-skip clairvoyant is **not** a mean upper bound (it burned skips).
6. **Stochastic k** — not implemented. Record is still `round(17 × p)`.
7. **What BEST means for calibration** — skip-aware GREEDY work recommended **GREEDY + honest P30 skips**. C6 was chosen against **no-skip paired BEST** (10.17% / ~5 in 50). Those populations differ.
8. **Anecdotal testers** (old live model: A ~40 games ~75% at 15-2-ish; B ~50 games ~38 at 13-4/14-3 combined) — **not validation**. C6 knots: 13-4 ≈74.62, 14-3 ≈78.67, 15-2 ≈84.00, 16-1 ≈87.00, 17-0 ≈88.50. B’s combined bucket is **not** a ≥14-3 rate.
9. **Telemetry `0004` vs Supabase** — not applied; do not apply without explicit ask.
10. Whether to merge telemetry worktree with locked scoring snapshot (1,229 buckets) — not decided.

---

## 7. Known hazards

1. **Supabase migration 0003 (`0003_pro_set_lineup_slots.sql`)**  
   Changes `lineup_slot` enum RB/FB → RB1/RB2. **`tmp-confirm-local-0003.ts` is local PGlite only** and throws if `DATABASE_URL` is set. **Did not** apply 0003 on Supabase. Remote may still be pre-pro-set. **Do not run drizzle migrate against production.** Telemetry worktree adds **0004** on top; applying 0004 remotely without 0003/lock awareness is unsafe.

2. **Turbopack / `next build` in the telemetry worktree**  
   Scoring-lock tree completed `next build`. Telemetry tree has extra API/schema and was reported to have **Turbopack build failures**. Do not “fix” by changing lock-tree Next config. Diagnose only in `E:\Dev\17-0-telemetry`.

3. **Two peer snapshots**  
   Lock: 2026-09-03 02:34Z, 1229 buckets. Telemetry working copy: 2026-09-02 21:10Z, 1203 buckets. Mixing them silently rescoring live games vs audits.

4. **`SKIP_SPINS=1` ≠ Team/Era Skip**  
   It skips the extra 10k presentation-spin pass in `tmp-game-balance-audit.ts`. All prior 10k/variance/ceiling-stage1 runs used **zero** user skips.

5. **Old “unreachable 17-0” line is obsolete twice**  
   Paired no-skip BEST max **90.794** already cleared the old 90.753 knot (1/10000). C6 moved 17-0 to **88.5** (BEST 10.17% on those same saved ratings). Do not cite 90.753 as the live threshold.

6. **PGlite lock**  
   Audits `cp` `.data/pglite` excluding `postmaster.pid`. Don’t run `data:import` while `next dev` holds the live DB; copy like the harnesses.

7. **Killed Node/tsx**  
   PID 10144 / `npx tsx tmp-skip-aware-human-strategy.ts` was **Stop-Process**’d. Windows `exit_code: 4294967295`. Do not assume a results file was flushed — `writeFile` is at the **end** of `main()`.

8. **Vercel ≠ scoring-lock**  
   Production is `master` `9bf72f03`. Deploying C6 requires an explicit push / branch change. Do not push unless asked.

---

## 8. What was running when interrupted (historical)

**Command** (cwd `E:\Dev\17-0`):

```
TUNING_GAMES=2000 FINAL_GAMES=10000 TAIL_EXTRA=40000
TUNING_SEED=1 FINAL_SEED=2001 TAIL_SEED=12001
npx tsx tmp-skip-aware-human-strategy.ts
```

Started **2026-09-03T20:49:28Z**, killed **2026-09-03T21:24:41Z** (~35 min). Terminal: `C:\Users\kevin\.cursor\projects\e-Dev-17-0\terminals\452905.txt`.

**Completed in that process (results only in RAM — lost):**

- Tuning no-skip CDFs, seeds 1–2000, all five strategies  
- Tuning skip: GREEDY P30; TOP_3/5/7/RANDOM each P20/P30/P40  
- Threshold choice printed: GREEDY **P30**; TOP_3/5/7/RANDOM **P20** (wide unpaired-SE tie rule)  
- Held-out seeds **2001–12000** (10k): no-skip **and** skip-aware for GREEDY, TOP_3, TOP_5, TOP_7, RANDOM  
- GREEDY team-only and era-only, same 10k  
- Started tail: `Tail extra n=40000 for GREEDY,TOP_3,TOP_5`

**Killed during:** `tail/skip/GREEDY` at about **18400 / 40000** (last logged 18400). TOP_3 and TOP_5 tail never started.

**Not on disk:** the 10k human-strategy evaluation object. `tmp-skip-aware-human-strategy-results.json` is still the **n=15 smoke test** from 20:44Z.

**Do not restart** this run unless the user asks. If resumed: fix the P20 tie-band first; consider writing incremental JSON after held-out (before 40k tail). Tail counts at ≥90.5 / ≥90.753 are **old-knot** rarities; under C6, 17-0 is `rating >= 88.5`.

---

## Resume map (when the user asks)

| Next likely task | Start from |
|---|---|
| **Stochastic season variance** | Candidate `wins = round(17p + k*(B−17p))`, `B~Binomial(17,p)`, sweep k ∈ {0, 0.25, 0.4, 0.6, 0.8, 1.0}. Re-project saved ratings; do not reopen player eval. |
| Finish skip-aware human ladder | `tmp-skip-aware-human-strategy.ts`; **discard** smoke JSON; do not cite killed RAM run |
| Beam / oracle path ceiling | Stage 1 said **P dominates**; Stages 2–3 not started |
| Telemetry ship | `E:\Dev\17-0-telemetry` only; 0004; don’t apply to Supabase unasked |
| Push / Vercel | **Forbidden** unless user asks. Production is `master` `9bf72f03`. |
| Player-eval / scoring edits | **Forbidden** unless user reopens the lock |
