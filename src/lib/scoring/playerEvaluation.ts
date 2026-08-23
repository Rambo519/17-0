import { positionForSlot } from "@/lib/football/positions";

import type { PeerBaselineIndex } from "./peerBaselines";
import { selectScoringSeason } from "./selectScoringSeason";
import type { LineupPickInput, PlayerEvaluation } from "./types";

export function evaluateLineupPick(
  pick: LineupPickInput,
  baselines: PeerBaselineIndex,
): PlayerEvaluation {
  const normalizedPosition = positionForSlot(pick.lineupSlot);
  const selected = selectScoringSeason(pick.seasons, normalizedPosition, baselines);

  return {
    playerId: pick.playerId,
    playerName: pick.playerName,
    lineupSlot: pick.lineupSlot,
    normalizedPosition,
    franchiseId: pick.franchiseId,
    eraId: pick.eraId,
    scoringSeason: selected.season,
    overall: selected.score.productionScore,
    productionScore: selected.score.productionScore,
    percentileRank: selected.score.percentileRank,
    dataConfidence: selected.score.dataConfidence,
    metrics: selected.score.metrics,
  };
}
