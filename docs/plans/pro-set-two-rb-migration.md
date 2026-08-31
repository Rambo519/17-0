# Pro-set two-RB migration

Status: audit complete. Do not implement until explicitly approved.

This plan removes FULLBACK as a player-facing draft slot and changes the offense to a pro-set backfield. The live game stays otherwise the same: six slots, same field chrome, IQ as the player-facing mode, no visual redesign.

## Decisions (locked)

- New playable slots: `QB`, `RB1`, `RB2`, `WR1`, `WR2`, `TE`
- `WR1` / `WR2` stay where they are and still both accept `WR`
- `TE` and `QB` stay where they are
- `RB1` and `RB2` sit **side by side behind the QB** (classic pro-set). No vertical FB/RB stack.
- `FB` remains in historical / database position data (`normalized_position`, card positions, season positions, overrides). It is **no longer playable**.
- Do not delete FB rows, cards, or positions.
- Do not rerun destructive imports or card rebuilds.
- Do not regenerate the peer-baseline snapshot.
- Do not change `WIN_PROJECTION_MODEL`.
- Both RB slots use the **same normal RB eligibility and scoring**. Do not reuse FB-slot scoring for `RB2`.
- Recommended lineup weights: `RB1 = 0.115`, `RB2 = 0.115`. Other slot weights unchanged. Total remains `0.95`.
- Franchise-era viability becomes **183 / 183**. No franchise-era is lost.

## Slot model

Mirror the existing WR1/WR2 pattern:

```text
LINEUP_SLOTS = ["QB", "RB1", "RB2", "WR1", "WR2", "TE"]

SLOT_ELIGIBILITY = {
  QB:  QB
  RB1: RB
  RB2: RB
  WR1: WR
  WR2: WR
  TE:  TE
}

NORMALIZED_POSITIONS = ["QB", "RB", "FB", "WR", "TE"]  // unchanged
```

Implications that fall out of this without extra eligibility code:

- `slotsForPosition("RB")` → `["RB1", "RB2"]`
- After one RB is drafted, `usefulPositions` still includes `RB`
- `listDraftableCards({ positions: usefulPositions })` still fetches RBs
- FB-only cards are not fetched (they only have `FB`)
- Dual RB/FB cards still appear if they are valid as `RB`
- Drafting RB1 does not close RB as a filter/position
- IQ order stays alphabetical
- Classic ranking already scores once per normalized position, so RB1/RB2 collapse to one RB rank

Runtime spin never required a full formation. It only needs one legal candidate for an **open** slot. The QB + 2 RB + 2 WR + TE rule is the coverage/audit definition, not the spin engine.

## Player-facing rules

- Remove FB as a draft slot.
- Remove FB from position filter chips.
- FB-only cards must not appear as selectable candidates.
- Dual-position RB/FB players may still appear if they are valid as RB.
- Filters must reflect open slots: after drafting one RB, the RB chip remains if `RB2` is still open.
- Candidate cards should not present `FB` as a playable label. Historical `["RB", "FB"]` data stays in the database; hide `FB` on the player-facing badge.
- Lineup / results show **RB1** and **RB2** (do not collapse those labels to `RB` the way WR1/WR2 collapse to `WR`).
- Formation field: two RB boxes side by side behind QB.
- Preserve approved desktop/mobile styling. Fonts and colors stay untouched.

## Scoring

Current FB path is slot-aware, not “just another position”:

- Complementary weights (`FB_SLOT_METRIC_WEIGHTS`, receive-heavy)
- `fbSlotPeerPosition` (feature backs vs RB peers; duals mix RB rush / FB rec)
- Feature-back blend toward 50 (`FB_SLOT_FEATURE_PERCENTILE_BLEND = 0.6`)
- Lineup weight `FB: 0.08` vs `RB: 0.15`

None of that may apply to `RB2`.

Current weights (sum **0.95**; `evaluateOffense` divides by the sum):

| Slot | Weight |
|---|---|
| QB | 0.30 |
| RB | 0.15 |
| FB | 0.08 |
| WR1 | 0.16 |
| WR2 | 0.14 |
| TE | 0.12 |

Recommended new weights (sum still **0.95**):

| Slot | Weight | Share of 0.95 |
|---|---|---|
| QB | 0.30 | 31.6% (unchanged) |
| RB1 | 0.115 | 12.1% |
| RB2 | 0.115 | 12.1% |
| WR1 | 0.16 | 16.8% (unchanged) |
| WR2 | 0.14 | 14.7% (unchanged) |
| TE | 0.12 | 12.6% (unchanged) |

Rationale:

- Split the old backfield mass (`0.15 + 0.08 = 0.23`) equally.
- Do **not** use `0.15 + 0.15` — that raises backfield from 24.2% to ~29% and makes 17-0 easier.
- Do **not** give RB2 the old `0.08` — that reuses FB weighting.
- Leave `POSITION_METRIC_WEIGHTS.FB` and FB peer buckets in place so historical seasons and the snapshot stay valid. They simply will not be used for new lineups.
- Do **not** change `WIN_PROJECTION_MODEL`.

Expected residual shift (accept, then verify): RB2 uses full RB math, so two real RBs will usually outscore old RB + compressed-FB. After implement, run `scoring:audit` / a small Monte Carlo. If median projected wins jump more than ~0.3, shave both RB weights together (e.g. `0.11` / `0.11`) rather than touching the win curve.

## Data / migration

### Database migration is required

Only for `lineup_slot` and `game_picks`.

| Object | Change? |
|---|---|
| `normalized_position` enum | **No** — keep `FB` |
| Card / season / position rows | **No** |
| `lineup_slot` enum | **Yes** — today `QB, RB, FB, WR1, WR2, TE` |
| `game_picks.lineup_slot` | **Yes** — production stores `RB` and `FB` |

`lineupSlotEnum` is derived from `LINEUP_SLOTS`, so TypeScript and Postgres must move together. Postgres cannot rename enum values in place. Need a real Drizzle SQL migration:

1. Add `RB1` / `RB2`
2. `UPDATE game_picks` (`RB → RB1`, `FB → RB2`)
3. Replace the `lineup_slot` enum

Local PGlite uses the same `drizzle/*.sql` files. Do **not** use `db:push` on production.

Completed games **recompute** on view (`evaluateCompletedGame`), so remapped FB picks will re-score as RBs if those games are reopened.

### Historical data rebuild

**No.** Do not reimport, rebuild cards, or flip `draftable` on FB-only cards. They can stay `draftable = true` and simply never enter `usefulPositions`.

Keep the FB participation exception in `src/data/draftable.ts`. It only matters at card-build time.

### Peer-baseline snapshot

**Do not regenerate.**

Buckets are `season + NormalizedPosition + metric`, not lineup slot. RB1/RB2 both score as `RB` against existing RB buckets. FB buckets remain unused by the new game. Regeneration is only required after import/production or peer-rule changes.

## Viability

Local historical corpus (read-only audit):

| | Count |
|---|---|
| Combinations | 183 |
| Current rule (`QB + 1 RB + 1 FB + 2 WR + TE`) | 156 / 183 |
| New rule (`QB + 2 RB + 2 WR + TE`) | **183 / 183** |
| Lost | **0** |
| Gained (fail only for 0 FB today) | 27 |
| Combinations with fewer than 2 RB | **0** |

Gained combinations (no franchise/era lost):

- **1970s (17):** Cardinals, Bears, Browns, Cowboys, Broncos, Lions, Packers, Raiders, Chargers, Vikings, Giants, Eagles, Steelers, 49ers, Seahawks, Titans, Commanders — era goes **11/28 → 28/28**
- **1980s (5):** Falcons, Bengals, Chargers, Giants, Commanders — **23/28 → 28/28**
- **2020s (5):** Cardinals, Bengals, Colts, Rams, Buccaneers — **27/32 → 32/32**
- 1990s–2010s already 100%

This widens the 1970s spin pool. It does not remove teams.

## Files affected

### Source of truth (change first)

- `src/lib/football/positions.ts` — `LINEUP_SLOTS`, `SLOT_ELIGIBILITY`, comments
- `src/lib/game/lineup.ts` — `createEmptyLineup()` keys
- `src/lib/validation/game.ts` — Zod `lineupSlotSchema` (derived from `LINEUP_SLOTS`)
- `src/db/schema/enums.ts` — `lineup_slot` Postgres enum is derived from `LINEUP_SLOTS`
- `drizzle/0000_swift_quasimodo.sql` — historical; do not edit
- **new** `drizzle/0003_*.sql` — enum + `game_picks` remapping

### Game rules / eligibility / spin

- `src/lib/game/eligibility.ts` — works if both RB slots map to `RB`; tests must change
- `src/lib/game/gameState.ts` — `usefulPositions` already uses `positionsForSlots(open)`
- `src/lib/game/draftPlayer.ts` — slot names in errors/tests
- `src/lib/game/spin.ts` — no FB-specific logic; fixtures do
- `src/lib/game/skip.ts` — uses `usefulPositions` only
- `src/lib/game/uiHelpers.ts` — chips, `slotDisplayLabel`, Classic FB display paths
- `src/lib/game/view.ts` — lineup serialization from `LINEUP_SLOTS`
- `src/lib/scoring/rankSpinCandidates.ts` — already unique-by-position

### Scoring

- `src/lib/scoring/config.ts` — `LINEUP_SLOT_WEIGHTS`; FB slot constants become unused by the game
- `src/lib/scoring/playerSeasonScore.ts` — `isFbSlot()` / `FB_SLOT_METRIC_WEIGHTS`
- `src/lib/scoring/fbSlot.ts` — entire FB-slot path
- `src/lib/scoring/offenseRating.ts` — weights keyed by slot
- `src/lib/scoring/evaluateGame.ts` — iterates `LINEUP_SLOTS`
- `src/lib/scoring/playerEvaluation.ts` — `positionForSlot(pick.lineupSlot)`
- `src/lib/scoring/reliability.ts` — keep FB as a data position
- `src/lib/scoring/peerBaselines.ts` — keep FB peer fallback; unused by new slots
- `src/data/scoring/audit.ts` — slot-looped audit
- `src/data/cli/integrityAudit.ts` — FB slot weight / FB eval dump

### UI

- `src/components/game/FormationField.tsx`
- `src/components/game/formationField.module.css` — 5-row grid → 4-row + side-by-side backfield
- `src/components/game/FormationSlot.tsx`
- `src/components/game/ResultsView.tsx`
- `src/components/game/CandidateList.tsx`
- `src/components/game/CandidateCard.tsx`
- `src/components/game/ModeSelector.tsx` — “I-formation” copy
- `src/components/game/CompletedLineup.tsx`
- `README.md` — formation diagram / slot list

### Audit / coverage (rules text, not player data)

- `src/data/audit/coverage.ts` — `fullFormationViable` currently requires `fb >= 1`
- `src/data/audit/draftabilityImpact.ts` — `isViable` requires FB
- `src/data/cli/refresh.ts` — FB coverage log line
- `src/data/audit/displayedProduction.ts` — keep FB exception buckets for Classic/data audit

### Tests / fixtures

Must update for new slots: `tests/lineup.test.ts`, `eligibility.test.ts`, `draftPlayer.test.ts`, `spin.test.ts`, `uiHelpers.test.ts`, `phase3Gameplay.test.ts`, `phase4Ui.test.tsx`, `resultsUi.test.tsx`, `database.test.ts`, `scoring.test.ts`, `scoringFbSlot.test.ts`, `scoringCalibration.test.ts`, `scoringFairness.test.ts`, `coverageAudit.test.ts`, `helpers/inMemoryGameRepository.ts` (`singleTeamCards` has an FB-only card and a no-FB franchise).

Data-layer tests that **keep FB** (`draftable.test.ts`, `normalizePosition.test.ts`, `fbOverrides.test.ts`, `displayedProduction.test.ts`, `historicalImport.pglite.test.ts`): update only if they assume FB is a playable slot.

### Do not change

- `NORMALIZED_POSITIONS` still includes `FB`
- `normalized_position` Postgres enum
- `player_team_era_positions` / `player_season_positions` FB rows
- `data/overrides/position-overrides.json`
- `src/lib/football/normalizePosition.ts` (`FB` → `FB`)
- `src/data/draftable.ts` FB participation exception
- `src/lib/scoring/generated/peer-baselines.json`
- Import / card-build / enrich CLIs

## Risk checklist

1. **Live `game_picks`.** In-progress games with `FB` / `RB` break if the enum changes without a remap. Remap `RB → RB1`, `FB → RB2`. Completed games recompute on view, so old FB picks will re-score as RBs.
2. **Postgres enum swap** on production. Hand-written SQL; test on PGlite first. Never `db:push`.
3. **Filter chips from `card.positions`.** Dual RB/FB cards will still produce an `FB` chip unless chips are derived from open-slot positions.
4. **FB-only cards stay draftable** in the DB but must never be selectable. Relies on `usefulPositions` omitting `FB`. Add a test that an FB-only card is rejected for both RB slots.
5. **Two-RB rating inflation** vs old complementary FB. Equal `0.115` weights are the mitigation; verify after.
6. **Test fixtures** (`singleTeamCards`) include an FB-only player and a no-FB franchise used for last-slot FB spins. Rewrite to a second RB / one-RB franchise.
7. **`scoringFbSlot.test.ts`.** Either delete or keep as documentation that FB-slot math is unused. Do not leave `isFbSlot` live for `RB2`.
8. **Formation height.** One fewer row; preserve slot box sizes and mobile widths.
9. **Copy drift.** “I-formation” in start screen / README / comments.
10. **Do not** “clean up” FB-only `draftable` flags or overrides — that is a data rebuild.

## Implementation order

Do not start until this plan is approved.

1. **Domain first** in `positions.ts`: slots `QB, RB1, RB2, WR1, WR2, TE`; both RBs accept `RB`; comments say pro-set. Leave `NORMALIZED_POSITIONS` including `FB`.
2. **Write `drizzle/0003_*`**: add `RB1`/`RB2`, remap `game_picks`, replace `lineup_slot` enum. Apply to isolated PGlite, then production. Confirm no leftover `FB`/`RB` pick values.
3. **Lineup + validation:** `createEmptyLineup`, Zod, empty-lineup tests.
4. **Eligibility tests:** WR-style cases for RB — first RB does not drop `RB` from `usefulPositions`; FB-only card cannot fill RB1/RB2; dual RB/FB can fill either.
5. **Scoring:** apply recommended weights; stop calling `isFbSlot` / `fbSlot.ts` from the game path; keep FB position weights and peer code; leave `WIN_PROJECTION_MODEL` alone. Update scoring tests; retire or quarantine `scoringFbSlot.test.ts`.
6. **UI:** `FormationField` backfield row + CSS; labels show RB1/RB2; chips from open-slot positions only; hide `FB` on candidate badges; ModeSelector/README copy. No visual redesign.
7. **Coverage audits:** `fullFormationViable` / `isViable` → QB + 2 RB + 2 WR + TE. Keep reporting FB counts as data coverage, not playability.
8. **Fixtures:** `singleTeamCards` — two RBs, no playable FB slot; replace “no FB” franchise with “only one RB” if a dead-end spin test is still needed.
9. **Run** `npm test`, `npm run typecheck`. Do **not** run import, card rebuild, or `scoring:build-baselines`.
10. **Verify in browser (IQ):** empty field (two RBs behind QB); draft one RB, confirm RB chip and RB2 still open; FB-only names never appear; dual RB/FB can go in either box; complete game; results show RB1/RB2; desktop + mobile.
11. **Post-check:** `npm run scoring:audit` (or a small lineup sample) to confirm projected-win distribution did not jump. Adjust both RB weights together only if needed.
12. **Ship** with the enum migration. Expect in-flight games to remap; old results will re-score if reopened.

## Bottom line

This is a rules + scoring + UI change plus a **`lineup_slot` enum migration**. It is not a historical data rebuild. Viability improves (156 → 183, nothing lost). Peer baselines stay. The win curve stays. The only scoring retune is splitting the old `0.23` backfield weight across two equal RB slots (`0.115` / `0.115`).
