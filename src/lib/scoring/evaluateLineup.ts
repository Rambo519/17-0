import { evaluateOffense } from "./offenseRating";
import { evaluateLineupPick } from "./playerEvaluation";
import type { PeerBaselineIndex } from "./peerBaselines";
import { projectWinsFromRating } from "./winProjection";
import type { GameScoringResult, LineupPickInput } from "./types";

export function evaluateLineup(
  picks: readonly LineupPickInput[],
  baselines: PeerBaselineIndex,
): GameScoringResult {
  const players = picks.map((pick) => evaluateLineupPick(pick, baselines));
  const offense = evaluateOffense(players);
  const projection = projectWinsFromRating(offense.overallRating);

  return {
    offense,
    projection,
  };
}
