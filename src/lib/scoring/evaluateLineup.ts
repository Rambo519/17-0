import { evaluateOffense } from "./offenseRating";
import { evaluateLineupPick } from "./playerEvaluation";
import type { PeerBaselineIndex } from "./peerBaselines";
import { projectWinsFromRating } from "./winProjection";
import type { GameScoringResult, LineupPickInput } from "./types";

/** Pass `seasonSeed` (game session id) so the displayed record is deterministic per game. */
export function evaluateLineup(
  picks: readonly LineupPickInput[],
  baselines: PeerBaselineIndex,
  seasonSeed?: string,
): GameScoringResult {
  const players = picks.map((pick) => evaluateLineupPick(pick, baselines));
  const offense = evaluateOffense(players);
  const projection = projectWinsFromRating(offense.overallRating, seasonSeed);

  return {
    offense,
    projection,
  };
}
